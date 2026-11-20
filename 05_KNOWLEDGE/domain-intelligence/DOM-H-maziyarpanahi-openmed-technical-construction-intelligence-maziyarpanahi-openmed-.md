# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: maziyarpanahi/openmed Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "maziyarpanahi/openmed",
  "source_url": "https://github.com/maziyarpanahi/openmed",
  "source_version": "e8325586",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T01:01:06.407Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-maziyarpanahi-openmed",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed) (Revision: `e8325586`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T01:01:06.407Z`  
> **Learning ID**: `learn-github-maziyarpanahi-openmed`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 72%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from maziyarpanahi/openmed:

# Project Learning Record (Full-Spectrum Forensic Harvest): maziyarpanahi/openmed

---

## 1. Executive Forensic Architecture & System Mechanics

`openmed` is an offline-first, sovereign clinical NLP and Protected Health Information (PHI) de-identification framework designed to execute under zero-trust, air-gapped on-premise and edge constraints (Apple Silicon MLX, Android ONNX Runtime Mobile, Electron utility processes, and Linux container runtimes). 

```
                                  [ Host Application / Edge Client ]
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                 ▼
    [ Edge Intake / Context ]                                      [ Registry / Gate Service ]
  - Android: ComponentCallbacks2                                  - Champion-Challenger Evaluation
  - Memory: OpenMedMemoryPressure                                 - GateLedger (Recall / F1 / Latency)
  - Lifecycle: LeaseGate Reference-Count                          - Atomic State Swaps (_write_state_atomic)
  - PDF/OCR: Bounded Stream + Recycle                             - Model Generation Counter Invalidation
                 │                                                                 │
                 └────────────────────────────────┬────────────────────────────────┘
                                                  ▼
                                      [ Execution Pipeline ]
                                                  │
                        ┌─────────────────────────┴─────────────────────────┐
                        ▼                                                   ▼
            [ ONNX / MLX Runtime ]                              [ Policy & De-ID Engine ]
      - KV-Cache Pre-fill & Step Decode                   - Offset Validation (Unicode Scalars)
      - Dynamic Rank-4 Shape Enforcers                    - Overlap Cluster Resolution (PPM Floors)
      - Coroutine Cancellation Bounds                     - Right-To-Left (RTL) Replacements
      - Strict Closed Error Codes                         - Hardware Keystore HMAC Surrogates
                        │                                                   │
                        └─────────────────────────┬─────────────────────────┘
                                                  ▼
                                        [ SafeLog Boundary ]
                                   - Zero Surface Text Leakage
                                   - Pre-hashed Hex & Provenance Only
                                   - Sink Disconnected by Default
```

The system is decoupled along four sovereign subsystem boundaries:
1. **Dynamic Engine Subsystem (`openmed.mlx`, `org.openmed.maple`)**: Manages quantized transformer execution (MLX 2-bit/4-bit/8-bit and ONNX Mobile). It isolates the execution context, enforces step-by-step tensor disposal, controls past key-value (KV) cache shapes, and encapsulates failures inside closed-set machine-readable exception contracts (`MapleResponseError`).
2. **De-identification & Portable Policy Subsystem (`openmedkit.deid`, `openmedkit.policy`)**: Executes tokenization-independent text scrubbing. It decouples detection from redaction through half-open Unicode scalar offset math, parts-per-million (PPM) integer confidence floors, greedy overlap resolution, and right-to-left text rebuilding. Secret hashing is completely delegated to cryptographic boundaries (e.g., Android Keystore), refusing plain text salts held in application RAM.
3. **Model Life-Cycle & Cache Invalidation Subsystem (`openmed.core.registry_service`, `result_cache`)**: Oversees model promotion, pointer flips, and local rollbacks through signed gate ledgers. It maintains cache consistency by binding opt-in result caches not only to model identities and text payloads, but to composite keys parameterized by explicit model weights revisions and atomic monotonically increasing generation counters (`_MODEL_GENERATION`).
4. **Boundary Isolation & Host Safety (`OpenMedLifecycle`, `LeaseGate`, `SafeLog`)**: Protects native resources from sudden termination or memory exhaustion via ref-counted session leasing, transforms OS trim-memory signals into value-free admission gates, isolates Electron runtimes via headless utility processes with offline network probes, and filters telemetry through an opt-in logging boundary where surface text is mathematically prevented from reaching sinks.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Generation-Pinned Revision-Bound In-Memory Cache Invariant
**RULE**:
Every cache key calculated over model, pipeline, or compiler-derived results MUST incorporate both the immutable artifact revision hash and an atomic process-wide model generation counter. Any administrative lifecycle operation (promotion, pointer flip, rollback, hot-reload, or weight swap) that mutates served weights MUST atomically increment the generation counter and explicitly flush the local cache instance.

**WHY**:
Model pipelines often retain static logical names (e.g., `model_name="ner-core"`) across weight updates or rollback events. When cache keys are derived strictly from inquiry parameters and input payload, changing the underlying checkpoint while the process remains running causes the cache to return stale inference outputs generated by previous weights. In medical NLP and clinical NER, this leads to silent safety regressions where recently patched false-negative vulnerabilities remain unredacted due to cache hits on poisoned legacy predictions.

**WHEN TO APPLY**:
Apply to all in-memory, distributed, or disk-backed memoization layers serving machine learning inferences, rule-engine policy outputs, compiled ASTs, or dynamic configuration resolvers where target binaries or weights mutate independently of input query identifiers.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import hashlib
import json
from threading import RLock
from typing import Any

_CACHE_LOCK = RLock()
_GLOBAL_MODEL_GENERATION: int = 0
_RESULT_CACHE: dict[str, Any] = {}

def current_model_generation() -> int:
    with _CACHE_LOCK:
        return _GLOBAL_MODEL_GENERATION

def notify_model_generation_change() -> int:
    """Must be invoked by registry, deployer, or router whenever served weights change."""
    global _GLOBAL_MODEL_GENERATION
    with _CACHE_LOCK:
        _GLOBAL_MODEL_GENERATION += 1
        _RESULT_CACHE.clear()
        return _GLOBAL_MODEL_GENERATION

def _resolve_model_revision(params: dict[str, Any]) -> str:
    revision = params.get("revision")
    if revision is None:
        pipeline_kwargs = params.get("pipeline_kwargs")
        if isinstance(pipeline_kwargs, dict):
            revision = pipeline_kwargs.get("revision")
    return str(revision or "default")

def make_cache_key(inquiry_type: str, text: str, params: dict[str, Any]) -> str:
    normalized = dict(params)
    model_name = normalized.pop("model_name", normalized.pop("model_id", "default"))
    revision = _resolve_model_revision(normalized)
    generation = current_model_generation()
    
    # Hash the text payload to preserve memory and avoid storing sensitive PHI in keys
    payload_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    
    components = {
        "inquiry_type": inquiry_type,
        "model_name": model_name,
        "revision": revision,
        "generation": generation,
        "payload_hash": payload_hash,
        "params": normalized,
    }
    
    serialized = json.dumps(components, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER bind cache keys solely to request text and model names
def make_cache_key_broken(model_name: str, text: str) -> str:
    # BUG: When model_name 'ner-prod' is pointed from checkpoint_A to checkpoint_B,
    # or rolled back after a failed audit, this key yields the old model's predictions!
    return f"{model_name}:{hash(text)}"
```

**VERIFICATION METHOD**:
Automated integration test verifying that (1) changing the revision produces a distinct key, (2) invoking `notify_model_generation_change()` creates distinct keys for identical input text/model name, and (3) a pipeline rerun after `notify_model_generation_change()` causes a cache miss and returns fresh outputs.

---

### 2. Closed-Set Enumerated Machine Codes on Domain Exceptions
**RULE**:
Domain-specific exceptions emitted across subsystem boundaries (especially model runtimes, parsers, and external microservices) MUST require a machine-readable failure reason parameter constrained to an immutable, closed set of frozen string identifiers. Exception subclasses MUST preserve standard root exception argument signatures (`*args: object`) to guarantee uncompromised serialization, pickling, and standard formatting compatibility, and MUST NEVER embed dynamic unparsed model/runtime outputs inside the failure code attribute.

**WHY**:
Callers handling deep pipeline failures often branch on error conditions (e.g., retrying with higher `max_tokens` when reasoning is unfinished versus raising security halts on illegal labels). If error branching relies on parsing freeform human-readable error messages, localized message updates or internal parser tweaks silently break downstream error-handling trees. Furthermore, overriding exception `__init__` without forwarding arbitrary `*args` to `super().__init__(*args)` breaks standard Python exception pickling and multiprocess transfer via `pickle.loads(pickle.dumps(err))`. Finally, injecting unparsed model output directly into exception codes enables arbitrary data injection and telemetry poisoning.

**WHEN TO APPLY**:
Apply to all core exception definitions in SDKs, microservices, runtime wrappers, and parsers where downstream consumers must programmatically branch, map fallback behavior, or record telemetry without scraping error message text.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Final

MAPLE_RESPONSE_ERROR_CODES: Final[frozenset[str]] = frozenset({
    "empty_response",
    "non_text_response",
    "unfinished_reasoning",
    "invalid_json",
    "trailing_text",
    "invalid_keys",
    "invalid_answer",
    "invalid_span",
    "label_not_allowed",
    "invalid_response",
})

class MapleResponseError(ValueError):
    """Raised when model runtime output violates bounded task contracts."""
    
    default_code: Final[str] = "invalid_response"

    def __init__(self, *args: object, code: str | None = None) -> None:
        # Preserve standard root exception tuple behavior (args[0] as message, pickle compat)
        super().__init__(*args)
        # Strictly validate code against the immutable closed set; fallback to default
        if isinstance(code, str) and code in MAPLE_RESPONSE_ERROR_CODES:
            self.code: str = code
        else:
            self.code = self.default_code
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER constrain __init__ to only a custom message parameter,
# and NEVER construct error codes dynamically from untrusted runtime input!
class BrokenResponseError(ValueError):
    def __init__(self, message: str, code: str):
        # BUG 1: Breaks pickle/unpickle protocol when args are missing or multiple
        # BUG 2: Unvalidated code allows arbitrary telemetry poisoning
        # BUG 3: Unsanitized model output in code field
        super().__init__(message)
        self.code = code  # e.g., code = raw_model_response[:10]
```

**VERIFICATION METHOD**:
Implement property-based testing and parameterized unit tests ensuring:
1. `MapleResponseError(*args).args == ValueError(*args).args` for `args` in `[(), ("msg",), ("msg", 42)]`.
2. `pickle.loads(pickle.dumps(err)).code == err.code`.
3. Supplying non-string, unlisted, or adversarial codes (e.g., `code="<script>alert()</script>"`) safely falls back to `invalid_response`.

---

### 3. Asymmetric Safety-Gate Preservation in Regression Ledgers
**RULE**:
When comparing candidate artifacts (e.g., fine-tuned models, algorithmic revisions, configuration policies) against a baseline champion in an automated promotion ledger, any evaluation axis or safety gate present in and passed by the champion that is omitted or unreported by the challenger MUST be evaluated as a blocking `REGRESSION` (`missing_in_challenger`) rather than a silent skip or neutral pass.

**WHY**:
In evaluation and deployment frameworks, matrix comparisons that iterate over the intersection of candidate and baseline metrics create an existential blind spot: a fine-tuned model or configuration that fails to output a critical security evaluation axis (such as an adversarial PII recall metric or HIPAA PHI gate) will emit zero records for that axis. If the ledger engine only scores reported gates, missing critical measurements are dropped entirely from the ledger, allowing a deficient challenger to bypass critical regression barriers and get promoted to production.

**WHEN TO APPLY**:
Apply to all model promotion evaluators, canary release gates, CI/CD automated deployment blockers, and ML continuous evaluation pipelines measuring accuracy, drift, safety, and latency invariants.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from dataclasses import dataclass
from enum import Enum
from typing import Any

class GateStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REGRESSION = "REGRESSION"

@dataclass(frozen=True)
class GateLedgerEntry:
    axis: str
    status: GateStatus
    reason: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {"axis": self.axis, "status": self.status.value}
        if self.reason is not None:
            data["reason"] = self.reason
        return data

def build_gate_ledger(
    champion_report: dict[str, float],
    challenger_report: dict[str, float],
    critical_axes: set[str],
    tolerance: float = 0.02,
) -> list[GateLedgerEntry]:
    ledger: list[GateLedgerEntry] = []
    
    # 1. Asymmetric Challenger Audit: Check all axes the champion reported
    for axis, champ_score in champion_report.items():
        if axis in critical_axes and axis not in challenger_report:
            # MUST block promotion when challenger drops a safety axis
            ledger.append(
                GateLedgerEntry(
                    axis=axis,
                    status=GateStatus.REGRESSION,
                    reason="missing_in_challenger",
                )
            )
            continue
            
        if axis in challenger_report:
            chal_score = challenger_report[axis]
            if (champ_score - chal_score) > tolerance:
                ledger.append(
                    GateLedgerEntry(
                        axis=axis,
                        status=GateStatus.REGRESSION,
                        reason=f"score_dropped_{champ_score:.4f}_to_{chal_score:.4f}",
                    )
                )
            else:
                ledger.append(GateLedgerEntry(axis=axis, status=GateStatus.PASS))

    return ledger

def evaluate_promotion(ledger: list[GateLedgerEntry]) -> tuple[bool, list[str]]:
    blocking_reasons = [
        f"blocking safety regression on {e.axis} ({e.reason})"
        for e in ledger
        if e.status == GateStatus.REGRESSION
    ]
    is_promotable = len(blocking_reasons) == 0
    return is_promotable, blocking_reasons
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER compute promotion eligibility solely over the intersection of keys
def build_broken_ledger(champion: dict, challenger: dict) -> bool:
    # BUG: If challenger completely omits 'HIPAA_API_KEY_RECALL', this loop
    # silently passes the challenger because champion keys are never validated!
    for axis in challenger.keys():
        if challenger[axis] < champion.get(axis, 0.0):
            return False
    return True
```

**VERIFICATION METHOD**:
Implement offline synthetic regression tests confirming that:
1. Providing a challenger report with 100% metrics across common keys but omitting a single critical gate present in the champion report results in an immediate `REGRESSION` entry tagged with `reason="missing_in_challenger"`.
2. The promotion decision evaluator returns `False` and explicitly formats the blocking axis name into the rejection log.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: In-Process Result-Cache Stale Reads on Model Weight Swap (BUG-OPENMED-01)
- **Context**: `openmed/core/result_cache.py`, `openmed/core/registry_service.py`, `openmed/core/registry_slots.py`.
- **What Was Expected**: When a model is updated via pointer flip, promotion, or rollback through `RegistryService._commit` or `SlotRegistryService._commit`, any subsequent inference call to `analyze_text` using the unchanged logical model name must produce fresh predictions evaluated with the new weights.
- **What Actually Happened**: The opt-in in-memory result cache key generation (`make_cache_key`) only factored in inquiry type, text, and logical `model_name`. Swapping weights while maintaining the same logical model alias returned cached inferences from the previous model revision, completely invalidating rollbacks and hotfixes.
- **Evidence in Repo**: Commit `9847b7c0`, PR #5669, closed issue #4538.
- **Root Cause**: Cache key normalization stripped versioning metadata and lacked awareness of registry mutations, decoupling the memory store lifecycle from registry transactions.
- **Remediation Code Diff**:
```python
# openmed/core/result_cache.py
@@ -12,6 +12,7 @@
 RESULT_CACHE = None
 _CACHE_LOCK = RLock()
+_MODEL_GENERATION = 0

+def current_model_generation():
+    with _CACHE_LOCK:
+        return _MODEL_GENERATION

+def notify_model_generation_change():
+    global _MODEL_GENERATION
+    with _CACHE_LOCK:
+        _MODEL_GENERATION += 1
+        if RESULT_CACHE is not None:
+            RESULT_CACHE.clear()
+        return _MODEL_GENERATION

 def make_cache_key(inquiry_type, params):
     normalized = dict(params)
     # ...
+    normalized["model_revision"] = _resolve_model_revision(normalized)
+    normalized["model_generation"] = current_model_generation()

# openmed/core/registry_service.py & registry_slots.py
@@ -533,6 +534,7 @@ def _commit(self, candidate: dict[str, Any]) -> None:
     self._validate_coherence(candidate)
     _write_state_atomic(self.state_path, candidate)
     self._state = candidate
+    notify_model_generation_change()
```
- **Lesson**: Caching nondeterministic or evolving computational kernels based purely on high-level logical identifiers without an atomic generational fence produces silent data stale-read bugs across administrative lifecycle events.

---

### Incident 2: Silent Omission of Critical Safety Gates in Model Promotion (BUG-OPENMED-02)
- **Context**: `openmed/eval/champion_challenger.py`, `openmed/eval/ledger.py`.
- **What Was Expected**: If an automated fine-tuning run or challenger model omits a critical safety gate (e.g., HIPAA label recall or PII recall) that the champion previously passed, the comparison engine must reject promotion.
- **What Actually Happened**: `_build_ledger` compared only the intersection of gates present in both reports. If a challenger failed to calculate or report a critical recall dimension, the ledger created no record for that axis. The evaluation gate `_decide` inspected only recorded entries, found zero failures, and allowed the flawed model to be promoted.
- **Evidence in Repo**: PR #5585, closed issue #4544, test `tests/unit/eval/test_champion_challenger.py`.
- **Root Cause**: The comparison logic iterated over challenger keys rather than champion requirements, treating omission as non-applicable instead of an invariant violation.
- **Remediation Code Diff**:
```python
# openmed/eval/ledger.py
@@ -45,6 +45,18 @@ def _build_ledger(champion_report, challenger_report, critical_labels):
     ledger = []
+    for label in critical_labels:
+        if label in champion_report.per_label_recall and label not in challenger_report.per_label_recall:
+            ledger.append(_missing_entry(f"per_label_recall.{label}", "missing_in_challenger"))
+
+    for gate in champion_report.passed_gates:
+        if gate not in challenger_report.all_gates:
+            ledger.append(_missing_entry(f"gate.{gate}", "missing_in_challenger"))

     # Normal comparison loop for intersecting gates follows...
```
- **Lesson**: Verification ledgers comparing versions must execute full outer directional joins against required baseline safety criteria; missing metrics in candidate releases are always blocking regressions.

---

### Incident 3: Exception Signature Incompatibility and Pickle Serialization Failure (BUG-OPENMED-03)
- **Context**: `openmed/mlx/maple.py`, `scripts/release/public_api_baseline.json`.
- **What Was Expected**: Custom domain exception `MapleResponseError` inherits from standard `ValueError` and must preserve polymorphic positional constructor conventions (`*args`) so that serialization tools, Python `pickle`, and multiprocessing pools can transport exceptions transparently.
- **What Actually Happened**: An initial refactoring constrained `__init__` to `def __init__(self, message: str, *, code: str | None = None)`. Passing zero arguments, multiple tuple arguments, or pickling/unpickling the error via standard library mechanics crashed with a `TypeError: missing required positional argument: 'message'`.
- **Evidence in Repo**: Commits `86afc9f9` and `f7a02ca1`, tests in `tests/unit/mlx/test_maple.py`.
- **Root Cause**: Overriding base class `__init__` signatures with a non-variadic signature violated the `ValueError` base class contract.
- **Remediation Code Diff**:
```python
# openmed/mlx/maple.py
@@ -183,9 +183,13 @@ class MapleResponseError(ValueError):

     default_code = "invalid_response"

-    def __init__(self, message: str, *, code: str | None = None) -> None:
-        super().__init__(message)
-        self.code = code if code in MAPLE_RESPONSE_ERROR_CODES else self.default_code
+    def __init__(self, *args: object, code: str | None = None) -> None:
+        super().__init__(*args)
+        self.code = (
+            code
+            if isinstance(code, str) and code in MAPLE_RESPONSE_ERROR_CODES
+            else self.default_code
+        )
```
- **Lesson**: Subclasses of built-in exceptions (`ValueError`, `RuntimeError`) must retain `*args: object` variadic forwarding to `super().__init__(*args)` to prevent object reconstitution failures during cross-process pickling.

---

### Incident 4: Premature Destruction of Native Sessions Under Active Concurrency (BUG-OPENMED-04)
- **Context**: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/util/LeaseGate.kt`.
- **What Was Expected**: When Android or edge lifecycle triggers tear down an inference engine session, active ONNX or C++ native inferences currently executing on worker threads must finish without a segmentation fault.
- **What Actually Happened**: Unsynchronized teardown calls invoked native C++ session `release()` immediately while a coroutine was midway through forward passes, yielding native SIGSEGV crashes on dangling JNI pointers.
- **Evidence in Repo**: Source code implementation of `LeaseGate.kt`.
- **Root Cause**: Conflation of "stopping new work" with "destroying allocated native pointers".
- **Remediation Code Diff**:
```kotlin
// android/openmedkit/src/main/kotlin/com/openmed/openmedkit/util/LeaseGate.kt
internal class LeaseGate(private val onRelease: () -> Unit) {
    private var active = 0
    private var closeRequested = false
    private var released = false

    @Synchronized fun tryAcquire(): Boolean {
        if (closeRequested) return false
        active += 1
        return true
    }

    fun release() {
        val releaseNow = synchronized(this) {
            check(active > 0) { "lease released more times than acquired" }
            active -= 1
            claimReleaseLocked()
        }
        if (releaseNow) {
            try { onRelease() } catch (_: Exception) {}
        }
    }

    fun close() {
        val releaseNow = synchronized(this) {
            if (closeRequested) return
            closeRequested = true
            claimReleaseLocked()
        }
        if (releaseNow) onRelease()
    }

    private fun claimReleaseLocked(): Boolean {
        if (!closeRequested || active != 0 || released) return false
        released = true
        return true
    }
}
```
- **Lesson**: Native foreign function interfaces (FFI) and on-device runtime wrappers require reference-counted lease gates that separate lease admission closure from final memory reclamation.

---

### Incident 5: Redaction Drift from Left-to-Right String Replacement (BUG-OPENMED-05)
- **Context**: `android/openmedkit/src/main/kotlin/com/openmed/openmedkit/deid/DeidentifyEngine.kt`.
- **What Was Expected**: Scrubbing multiple entity spans within a raw medical note must replace exact offsets without corrupting neighboring text or misaligning subsequent replacements.
- **What Actually Happened**: Left-to-right replacement modified the length of the string buffer. A span replaced at `0..5` with an 18-character token shifted all downstream characters by `+13`, causing subsequent span offsets to cut across words or slice into unintended PHI.
- **Evidence in Repo**: `DeidentifyEngine.kt` and `actions.asReversed()` implementation.
- **Root Cause**: Applying non-isometric character transformations in sequential order without adjusting downstream index deltas or applying substitutions in reverse index order.
- **Remediation Code Diff**:
```kotlin
// android/openmedkit/src/main/kotlin/com/openmed/openmedkit/deid/DeidentifyEngine.kt
@@ -115,8 +115,8 @@ class DeidentifyEngine {
         val redacted = StringBuilder(text)
-        for (action in actions) {
-            redacted.replace(action.span.start, action.span.end, action.replacement)
-        }
+        for (action in actions.asReversed()) {
+            redacted.replace(action.span.start, action.span.end, action.replacement)
+        }
         return DeidentifyResult(redacted.toString(), actions)
```
- **Lesson**: Multiple non-overlapping in-place substring replacements across a shared character buffer must always execute in descending offset order (right-to-left) to keep antecedent offsets mathematically invariant.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Zero vs Null vs Empty Disambiguation**: In `MapleOnnxEngine.kt`, checking cache sequence dimensions must explicitly distinguish between uninitialized past context (`past_seq == 0L`) and dynamic unbounded dimensions (`declaredShape[2] <= 0L`). A negative dimension in ONNX represents a dynamic dimension, whereas `0` represents a static empty dimension. Confusing `<= 0` with `== 0` leads to invalid tensor allocation crashes.
* **Offset Substring Math (Unicode Scalar Precision)**: In `PolicyEngine.kt`, raw character indexing (`String.substring`) on UTF-16 surrogate pairs (e.g., emojis or clinical symbols like `µ`) causes off-by-one text slicing. All boundaries are validated and cut using explicit scalar contracts:
  ```kotlin
  validate(detections, UnicodeOffsetContract.scalarLength(text))
  val surface = UnicodeOffsetContract.substring(text, start, end)
  ```
* **Shallow vs Deep Copy Mutation Leak**: In `result_cache.py`, caching normalizes dictionary parameters. Passing `params` into helper methods without a shallow copy mutation defense (`normalized = dict(params)`) resulted in `normalized.pop("model_id", None)` inadvertently mutating the caller's input dictionary.

### 2. Infinite Loop & Recursion Guards
* **Coroutine Microtask Starvation Guard**: In `MapleOnnxEngine.kt`, generation loops must guarantee cooperative preemption:
  ```kotlin
  for (step in 0 until maxNewTokens) {
      currentCoroutineContext().ensureActive()
      // ...
  }
  ```
  Calling `ensureActive()` on every autoregressive step prevents a runaway loop if the host cancels the parent coroutine during token sampling.
* **Coerced Upper Bound Generation Budget**:
  ```kotlin
  val maxNewTokens = request.maxNewTokens.coerceAtMost(
      limits.maxContextTokens - encoded.size
  )
  require(maxNewTokens > 0) { "The prompt leaves no room for generation" }
  ```
  An unconditional subtraction without `coerceAtMost` produces integer underflow or negative range bounds when `encoded.size >= maxContextTokens`, leading to loop bounds checks failure or immediate runtime panics.

### 3. UI & UX Micro-Mechanics
* **Electron Renderer Bridge Isolation**: In `harness/src/renderer.ts`, the UI renderer never receives direct IPC handles or raw text pipelines. Communication traverses an isolated `window.openmed` bridge where all errors must be serialized via structured clones:
  ```typescript
  // contextBridge strips non-enumerable properties like error.code!
  task.outcome.then(
    (response) => harness.reply(response.ok ? outcome(response) : { ok: false, errorCode: response.errorCode }),
    (error: unknown) => harness.reply({ ok: false, errorCode: codeOf(error) })
  );
  ```
* **Bitmap Memory Recycling Invariant**: In `PdfPageRenderer.kt`, rendering high-resolution documents for clinical OCR thrashes the Android GC and triggers `OutOfMemoryError`. Each rendered page is delivered to a consumer callback and recycled immediately in a `finally` block:
  ```kotlin
  try {
      block(PdfPageEvent.Rendered(rendered))
  } finally {
      rendered.bitmap.recycle()
  }
  ```

### 4. Backend Concurrency & Memory Safety
* **TOCTOU Race Prevention in State Writes**: In `registry_service.py`, writing state files to disk uses `_write_state_atomic(path, candidate)` which executes an atomic POSIX write to a sibling tempfile followed by `os.replace`. This prevents concurrent readers from ingesting partially written JSON structures.
* **Resource Suppression Chaining**: In `MapleOnnxEngine.kt`, closing composite resources must never mask intermediate failures:
  ```kotlin
  var failure: Throwable? = null
  listOfNotNull(decodeSession, prefillSession).distinct().forEach { session ->
      try { session.close() } catch (error: Throwable) {
          if (failure == null) failure = error else failure?.addSuppressed(error)
      }
  }
  failure?.let { throw it }
  ```

###

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
