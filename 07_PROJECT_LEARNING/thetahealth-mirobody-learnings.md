> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/thetahealth-mirobody-learnings.md`  
> **Source**: github ([https://github.com/thetahealth/mirobody](https://github.com/thetahealth/mirobody))  
> **Source Version**: `18bbe471`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-27T07:15:12.594Z  
> **Learning ID**: `learn-github-thetahealth-mirobody`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): thetahealth/mirobody

---

## 1. Executive Forensic Architecture & System Mechanics

```
                      ┌──────────────────────────────────────────────────────────┐
                      │                   INCOMING SOURCES                       │
                      │  (Lab PDFs, Apple Health, Wearables, Genotype Arrays)    │
                      └────────────────────────────┬─────────────────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ① COLLECT & PARSE (mirobody.engine.parse / mirobody.documents.render)                           │
│   • Multi-modal ingestion: PDF rasterization, OCR, vision flattening (alpha -> RGB on white)   │
│   • Edge downscaling: MAX_VISION_EDGE_PX = 1536, Lanczos resampling, progressive JPEG           │
└──────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ② STANDARDIZE (mirobody.engine.resolver / mirobody.units / mirobody.engine.observation)        │
│   • Lexical LOINC/UCUM Resolution: Multilingual alias index (CJK, kana, Latin)                  │
│   • Refusal Boundaries: Rejects conditions/symptoms ("发烧" != Crimean-Congo virus LOINC)       │
│   • Emit FHIR R4 Observations with `coding-decision` extensions                                 │
└──────────────────────────────────┬──────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ③ STORE & QUERY KERNEL (mirobody.kernel.query / PostgreSQL Day Authority)                       │
│   • Day Authority Engine: Daily bucket aggregation, 400-day bounded input budgets               │
│   • Trend Arithmetic: First-third vs. last-third observed-day means, descriptive slope/day      │
│   • Citation Lineage: Generates immutable row IDs (`rid`, e.g., `r1`, `r2`) linked to provenance│
└──────────────────────────────────┬──────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ④ AGENT DISPATCH & RENDER (mirobody.agent.tools._render / mirobody.agent.chat.citations_auto)   │
│   • Compact Representation: Pipe-delimited tables hoisting invariants into `(constants: ...)`  │
│   • Context Budget Cap: Hard ceiling at 40,000 characters with explicit front-loaded cut note   │
│   • Auto-Citation Verification: Unit validation, prose disambiguation ("in" unit vs preposition)│
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Mirobody addresses the problem of **uncalibrated semantic drift, loss of clinical provenance, and context-window exhaustion** when language models interact with personal health records (EHR, lab results, continuous wearable metrics, and genomic data). 

The architecture enforces strict decoupling between four discrete tiers:
1. **Zero-Dependency Standardization Engine (`mirobody.engine`)**: Resolves arbitrary clinical terminology (e.g., "LDL cholesterol", "血红蛋白", "ヘモグロビン") to standardized LOINC codes and UCUM units without requiring databases or external API calls. It relies on pre-compiled numpy offset array string tables (`_strtab`, `_bundle`).
2. **Day Authority Query Kernel (`mirobody.kernel.query`)**: Enforces temporal coherence. Rather than streaming raw high-frequency observations to an LLM, intraday points are aggregated into daily authority records. Pure functions calculate statistical trends (first-third vs. last-third mean comparison over observed days, bounded at a 400-day input horizon).
3. **Information-Dense LLM Render Engine (`mirobody.agent.tools._render`)**: LLMs are billed per token; printing repeated metadata (e.g., `unit=mmol/L`, `system=http://loinc.org`) across hundreds of tabular rows exhausts the context budget and induces hallucinations. The render engine extracts uniform column values into a hoisted `(constants: ...)` header, collapses rows into pipe-delimited vectors, separates self-reported patient symptoms from verified clinical observations, and injects machine-verifiable citation anchors (`[r1]`, `[r2]`).
4. **Autonomous Capability Probes & Citation Verifier (`benchmarks/local_models`, `mirobody.agent.chat.citations_auto`)**: Post-processing validators enforce mathematical and citation integrity. They prevent hallucinations by calculating numerical distance tolerances dynamically scaled to analyte magnitudes, resolving ambiguous units, and catching token boundary anomalies across CJK, Latin, and Cyrillic scripts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dynamic Scale-Relative Numeric Tolerance Verification
**RULE**:
When validating floating-point clinical metrics, aggregates, or model extractions against ground truth, the comparison harness **MUST NOT** use a static absolute epsilon floor (e.g., `abs(actual - target) < 0.01`). The validation predicate **MUST** calculate tolerance as a scale-relative ratio against the target magnitude (`max(abs(target) * relative_ratio, precision_floor)`), where `precision_floor` is strictly reserved for IEEE-754 precision limits (e.g., `1e-9`).

**WHY**:
In clinical and physiological reporting, measured quantities vary across dozens of orders of magnitude. For example, serum calcium may be $2.2\text{ mmol/L}$, creatinine $88\text{ }\mu\text{mol/L}$, but heavy metal concentrations or hormone panels can be $0.003\text{ g/L}$ ($3\text{ mg/L}$). An absolute tolerance floor of $0.011$ allows an extraction of $0.01\text{ g/L}$ to validate against a ground truth of $0.002\text{ g/L}$ (a 400% error), allowing completely incorrect patient diagnostics to pass automated verification.

**WHEN TO APPLY**:
Applies to all numeric verification engines, benchmark grading harnesses, unit-conversion systems, and automated citation matching across medical, scientific, and financial domains.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def scale_relative_tolerance(target: float, relative_ratio: float = 0.002, fp_floor: float = 1e-9) -> float:
    """Computes dynamic acceptance threshold scaled to target magnitude.
    
    Prevents low-scale values (e.g. 0.003 g/L) from accepting arbitrary
    near-zero values due to coarse static tolerances.
    """
    if not math.isfinite(target):
        return 0.0
    return max(abs(target) * relative_ratio, fp_floor)

def verify_numeric_claim(actual: float, expected: float, relative_ratio: float = 0.002) -> bool:
    tol = scale_relative_tolerance(expected, relative_ratio=relative_ratio)
    return abs(actual - expected) <= tol
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Coarse static floor that swamps low-magnitude clinical metrics
def verify_numeric_claim_unsafe(actual: float, expected: float) -> bool:
    # 0.011 is larger than the entire measurement for micro-concentrations!
    tol = max(0.011, abs(expected) * 0.002)
    return abs(actual - expected) <= tol
```

**VERIFICATION METHOD**:
```python
def test_low_scale_concentrations_reject_coarse_drift():
    ground_truth = 0.003  # e.g., 0.003 g/L
    hallucinated = 0.010  # Model reports 0.010 g/L (3.3x actual value)
    
    # Must fail under dynamic relative tolerance (0.2% = 0.000006)
    assert not verify_numeric_claim(hallucinated, ground_truth, relative_ratio=0.002)
    
    # Must pass only within legitimate measurement noise
    acceptable = 0.003005
    assert verify_numeric_claim(acceptable, ground_truth, relative_ratio=0.002)
```

---

### 2. Context-Budget Compression via Constant Column Hoisting
**RULE**:
When serializing structured tabular database records into agent prompts or context windows, the serializer **MUST NOT** repeat identical column-value bindings across rows. The serializer **MUST** partition uniform columns across the result set, hoist them into a single declarative constant header (e.g., `(constants: key=val, ...)`), and emit remaining variable fields as pipe-delimited rows.

**WHY**:
Medical indicators, wearable series, and financial logs share redundant fields across hundreds of rows (e.g., `user_id`, `unit`, `system`, `code`, `patient_tz`). Serializing 200 rows of JSON or naive markdown tables wastes 60–80% of the token context budget on invariant repetitions. Furthermore, small local LLMs experience "attention dilution," frequently misattributing codes between adjacent rows when bombarded with repetitive schema definitions.

**WHEN TO APPLY**:
Applies to any LLM tool execution result serializer, MCP server output formatting, RAG context assembler, and tabular telemetry injector.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from collections.abc import Mapping, Sequence
from typing import Any

def serialize_tabular_for_llm(
    rows: Sequence[Mapping[str, Any]], 
    display_columns: Sequence[str]
) -> str:
    """Serializes structured rows into token-dense pipe notation with hoisted constants."""
    if not rows:
        return "(no rows)"
    
    # 1. Identify universal constant columns across all returned rows
    first = rows[0]
    candidate_constants = {
        col: first[col] for col in display_columns 
        if col in first and first[col] is not None and str(first[col]).strip() != ""
    }
    
    for row in rows[1:]:
        for col in list(candidate_constants.keys()):
            if row.get(col) != candidate_constants[col]:
                del candidate_constants[col]
                
    variable_cols = [c for c in display_columns if c not in candidate_constants]
    
    lines = []
    # 2. Hoist constant metadata into a single compact header line
    if candidate_constants:
        const_str = ", ".join(f"{k}={v}" for k, v in candidate_constants.items())
        lines.append(f"(constants: {const_str})")
        
    # 3. Output header for variable columns only
    lines.append("|".join(variable_cols))
    
    # 4. Stream rows using variable values
    for row in rows:
        line = "|".join(str(row.get(c, "")).replace("|", "\\|") for c in variable_cols)
        lines.append(line)
        
    return "\n".join(lines)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Full JSON or naive markdown table dumping redundant strings
def serialize_tabular_naive(rows: list[dict[str, Any]]) -> str:
    # Wastes thousands of tokens repeating unit="mmol/L", system="http://loinc.org" on every row
    import json
    return json.dumps(rows, indent=2)
```

**VERIFICATION METHOD**:
```python
def test_constant_hoisting_token_reduction():
    test_rows = [
        {"time": f"2026-01-{i:02d}", "value": 5.0 + i * 0.1, "unit": "mmol/L", "system": "http://loinc.org", "code": "1558-6"}
        for i in range(1, 31)
    ]
    cols = ("time", "value", "unit", "system", "code")
    compact = serialize_tabular_for_llm(test_rows, cols)
    
    assert "(constants: " in compact
    assert "unit=mmol/L" in compact
    assert "system=http://loinc.org" in compact
    # Invariant: Constant columns must NOT appear in individual row lines
    for line in compact.splitlines()[2:]:  # Skip constants and header
        assert "mmol/L" not in line
        assert "loinc.org" not in line
```

---

### 3. Preserving True Denominators in Multi-Stage Execution Harnesses
**RULE**:
Benchmarking, evaluation, and test execution harnesses **MUST** initialize the complete case manifest denominator before execution commences. If a session fails to create, crashes prematurely, or exits early on a fault boundary, unattempted tasks **MUST NOT** be dropped or omitted from the final capability summary; they **MUST** be explicitly cataloged as `status="not_attempted"` and factored into the total denominator.

**WHY**:
When an evaluation run crashes at turn 1 of 20 due to network or authentication drops, an implementation that aggregates metrics only over attempted items reports $0/1 = 0\%$ or $1/1 = 100\%$ accuracy. This hides cascading system instability, corrupts historical telemetry, and produces falsified model capability metrics where severe infra failure masquerades as zero error.

**WHEN TO APPLY**:
Applies to automated agent evaluation pipelines, LLM capability test harnesses, load test orchestrators, and multi-stage batch processing pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Any

def run_evaluation_suite(cases: list[dict[str, Any]], runner_client: Any) -> dict[str, Any]:
    # 1. Pre-seed every case into the results array with default unattempted status
    results = [
        {**case, "status": "not_attempted", "ok": False, "detail": "initialized"}
        for case in cases
    ]
    
    packet = {
        "complete": False,
        "selected_total": len(cases),
        "results": results
    }
    
    for idx, case in enumerate(cases):
        try:
            res = runner_client.execute(case["query"])
            results[idx] = {**case, "status": "completed", "ok": res["success"], "detail": res["payload"]}
        except Exception as exc:
            results[idx] = {**case, "status": "run_failure", "ok": False, "detail": str(exc)}
            # Early break on fatal harness error, leaving remaining cases unattempted
            break
            
    # Mark completion only if loop survived to terminal case
    packet["complete"] = (all(r["status"] != "not_attempted" for r in results))
    return packet
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Dynamically appending results, corrupting the denominator on failure
def run_evaluation_suite_flawed(cases: list[dict[str, Any]], runner_client: Any) -> dict[str, Any]:
    results = []
    for case in cases:
        # If sign_in or turn 1 fails, loop terminates and results length is 0 or 1!
        res = runner_client.execute(case["query"])
        results.append({"case_id": case["id"], "ok": res["success"]})
    # Denominator now claims total evaluation count was 1 instead of 20!
    return {"passed": sum(r["ok"] for r in results), "total": len(results)}
```

**VERIFICATION METHOD**:
```python
def test_harness_preserves_denominator_on_early_crash():
    mock_cases = [{"id": f"c_{i}", "query": "q"} for i in range(10)]
    
    class FailingClient:
        def execute(self, q):
            raise ConnectionError("Auth session expired")
            
    out = run_evaluation_suite(mock_cases, FailingClient())
    assert len(out["results"]) == 10
    assert out["results"][0]["status"] == "run_failure"
    assert all(r["status"] == "not_attempted" for r in out["results"][1:])
    assert out["complete"] is False
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Evaluator Run Denial via Truncated Denominator (BUG-MIRO-01)
- **Context**: Capability probe diagnostic benchmark harness (`benchmarks/local_models/probes.py`).
- **What Was Expected**: If session creation or the initial API handshake fails when running capability probes against an account, the evaluation manifest should record all selected questions in the summary denominator, marking probe #0 as `run_failure` and probes #1..N as `not_attempted`.
- **What Actually Happened**: Unattempted questions were calculated at the end of the script using a post-loop `done` set reconciliation. When session creation threw an exception during `bench.ask`, the script crashed or exited before appending the remaining cases. The resulting JSON summary emitted a collapsed denominator (or empty manifest), distorting test pass-rates.
- **Evidence in Repo**: Commit `1fba33f7`, `benchmarks/local_models/probes.py`, and test additions in `mirobody/tests/test_capability_probes.py`.
- **Root Cause**: The result packet was populated incrementally via `.append(result)` inside the execution loop. Denominator tracking depended on the successful completion of the loop.
- **Remediation Code Diff**:
```diff
--- a/benchmarks/local_models/probes.py
+++ b/benchmarks/local_models/probes.py
@@ -219,7 +220,7 @@ def main() -> int:
     packet = {"person": args.person, "email": args.email, "source_sha256": plan["provenance"]["sha256"],
               "record_sha256": record_identity(plan), "tz": config["tz"], "as_of": AS_OF,
               "case_manifest": probes, "cases_sha256": digest_json(probes), "skipped": skipped,
-              "dry_run": args.dry_run, "results": []}
+              "dry_run": args.dry_run, "complete": False, "results": []}
     write_json(args.out, packet)
@@ -230,19 +231,23 @@ def main() -> int:
     entry = read_json(LOAD_STATE, {}).get(args.email, {})
     validate_account(plan, args.person, entry)
     account = common.sign_in(args.email, tz=config["tz"], lang="en")
-    for probe in probes:
-        turn = bench.ask(account, probe["question"], args.timeout, as_of=AS_OF)
+    packet["results"] = [{**p, "status": "not_attempted", "ok": False, "cited": False, "detail": "not attempted"}
+                         for p in probes]
+    packet["capabilities"] = summarize(packet["results"])
+    write_json(args.out, packet)
+    for index, probe in enumerate(probes):
+        try:
+            turn = bench.ask(account, probe["question"], args.timeout, as_of=AS_OF)
+        except (common.ApiError, requests.RequestException) as exc:
+            turn = {"error": type(exc).__name__, "finish_reason": "error", "blocks": []}
         result = grade(probe, turn)
-        packet["results"].append(result)
+        packet["results"][index] = result
         packet["capabilities"] = summarize(packet["results"])
         write_json(args.out, packet)
         print(f"{result['status']} {probe['id']} {probe['capability']} ok={result['ok']} cited={result['cited']}", flush=True)
         if result["status"] == "run_failure":
             break
-    # Unattempted probes remain in the selected denominator if execution stops.
-    done = {r["id"] for r in packet["results"]}
-    packet["results"].extend({**p, "status": "not_attempted", "ok": False, "cited": False, "detail": "not attempted"}
-                             for p in probes if p["id"] not in done)
+    packet["complete"] = True
```
- **Lesson**: Pre-allocate output slots matching the full task manifest prior to entering network I/O loops. Intermediate state mutations must overwrite existing indices, ensuring persistence writes always capture the true denominator regardless of when termination occurs.

---

### Incident 2: Coarse Absolute Tolerance Endorsing Bogus Unit Citations (BUG-MIRO-02)
- **Context**: Chat engine automatic citation verification module (`mirobody/agent/chat/citations_auto.py`).
- **What Was Expected**: Auto-citation verification must verify whether an LLM's generated response accurately quotes an analyte reading from a row. When matching numbers, small floating-point discrepancies should be tolerated without allowing completely different values to match.
- **What Actually Happened**: The numeric tolerance function had an absolute floor of `0.011` (`max(0.011, abs(target) * 0.002)`). For low-concentration analytes measured in `g/L` or `ng/mL` (e.g., $0.003\text{ g/L}$), any number between $0.000$ and $0.014$ was considered a match. An LLM claim stating $0.01\text{ g/L}$ was mistakenly cited and validated against a ground truth row of $0.003\text{ g/L}$.
- **Evidence in Repo**: PR #182 / Commit `2bd7db24`, `mirobody/agent/chat/citations_auto.py`.
- **Root Cause**: Hardcoding a static decimal constant (`0.011`) intended for standard macroscopic numbers (such as weights or steps) without considering micro-scale biochemical units.
- **Remediation Code Diff**:
```diff
--- a/mirobody/agent/chat/citations_auto.py
+++ b/mirobody/agent/chat/citations_auto.py
@@ -37,7 +37,13 @@ _BINDING = re.compile(r"(?:\s|[:：*()=]|is|was|at|averaged|average|measured|re
 
 def _tolerance(target: float) -> float:
-    return max(0.011, abs(target) * 0.002)
+    """How close two numbers must be to be the same reading, in the value's own scale.
+
+    The floor used to be 0.011 absolute, which for a concentration of 0.003 g/L makes every
+    figure in the row "match": a row with min=0.002, avg=0.003, max=0.004 endorsed "0.01 g/L".
+    The tolerance now follows the magnitude, with only a tiny floor for floating point.
+    """
+    return max(abs(target) * 0.002, 1e-9)
```
- **Lesson**: Never establish a domain-specific absolute tolerance floor in a generic mathematical validation utility. Precision floors must be strictly set to the machine epsilon of the data type (`1e-9`).

---

### Incident 3: Grammatical Preposition Colliding with Measurement Unit "in" (BUG-MIRO-03)
- **Context**: Auto-citation unit token parsing (`mirobody/agent/chat/citations_auto.py`).
- **What Was Expected**: The citation parser extracts units immediately following a numeric value to prevent unit mismatches (e.g., rejecting an LLM stating `70 kg` if the database row is `70 lb`).
- **What Actually Happened**: The English word "in" is both an abbreviation for inches (`70 in`) and an English preposition (`7.659 in the first third`). When the parser encountered the preposition "in", it treated "in" as a unit. Later, when looking at prose such as "Height is 70 in.", dropping "in" allowed a `70 cm` row to match the sentence as if no unit had been specified.
- **Evidence in Repo**: PR #182 / Commit `2bd7db24`, `mirobody/agent/chat/citations_auto.py`.
- **Root Cause**: Lexical token matching without forward-looking grammatical context. The lexer failed to inspect what followed the ambiguous token "in".
- **Remediation Code Diff**:
```diff
--- a/mirobody/agent/chat/citations_auto.py
+++ b/mirobody/agent/chat/citations_auto.py
@@ -19,6 +19,20 @@ _RID = re.compile(r"^r\d+$")
-_UNIT = re.compile(r"\s?(?:[a-zA-Zµμ%/][a-zA-Zµμ%^0-9/\-.]{0,23})?")
+_UNIT = re.compile(r"[ \t]*([\wµμ%°/\[\]{][\wµμ%°/^*.\\-\[\]{}]{0,47})")
+_PROSE_AFTER_VALUE = frozenset({"to", "from", "between", "and", "on", "at", "in", "for",
+                               "before", "after", "today", "this", "the", "was", "is"})
+#: One prose word is also a measured unit: "in" is inches after a value ("70 in") and a
+#: preposition in running text ("7.659 in the first third"). The word after it decides.
+_AMBIGUOUS_UNITS = frozenset({"in"})
+#: Words that follow a preposition and never follow a unit.
+_PROSE_FOLLOW = frozenset({
+    "the", "a", "an", "this", "that", "these", "those", "which", "what", "both", "each",
+    "every", "some", "any", "all", "most", "many", "few", "several", "one", "two", "my", "his",
+    "her", "their", "our", "your", "its", "order", "total", "general", "particular", "addition",
+    "comparison", "contrast", "fact", "practice", "detail", "short", "summary", "terms", "term",
+    "case", "cases", "front", "between", "place", "response",
+})
+
+def _looks_prepositional(rest: str) -> bool:
+    """Whether the word after a value opens a phrase, not a unit."""
+    match = re.match(r"[ \t]*([A-Za-z0-9][\w-]*)", rest)
+    if match is None:
+        return False
+    word = match.group(1)
+    if word[0].isdigit() or word[0].isupper():
+        return True
+    return word.casefold() in _PROSE_FOLLOW
```
- **Lesson**: When domain tokens (e.g., units, currencies) overlap with natural language stop-words, the tokenizer must use lookahead grammar invariants (determiners, noun phrases) to classify tokens before binding them to semantic schemas.

---

### Incident 4: Non-Analyte Complaint Collision with Pathogen LOINC Codes (BUG-MIRO-04)
- **Context**: Observation standardization engine (`mirobody/engine/observation.py`).
- **What Was Expected**: Clinical symptoms entered by a patient (e.g., "发烧" / fever, "高血压" / hypertension) must be mapped to condition/symptom vocabularies (e.g., ICPC-3) or flagged as complaints, rather than coerced into laboratory observation LOINC codes.
- **What Actually Happened**: The unconstrained lexical LOINC resolver indexed substrings. When queried with the symptom "发烧" (fever), it resolved to LOINC `103717-5` (*Crimean-Congo hemorrhagic fever virus RNA*). When queried with "高血压" (high blood pressure as a self-reported symptom), it matched LOINC `41218-9` (*Urine hippurate*).
- **Evidence in Repo**: `mirobody/engine/observation.py`, function `standardize_reading`.
- **Root Cause**: Absence of an ontological refusal boundary between measurable laboratory analytes and subjective patient-reported complaints prior to triggering lexical search.
- **Remediation Code Diff**:
```diff
--- a/mirobody/engine/observation.py
+++ b/mirobody/engine/observation.py
@@ -37,6 +37,12 @@ def standardize_reading(name: str, value: str | float | None = None, unit: str
     if not str(name or "").strip():
         raise ValueError("a reading needs a name")
     text = "" if value is None else str(value).strip()
     resolution = resolve_reading(name, text or None, unit or None)
+    complaint = _complaint(name, text)
+    if complaint:
+        # 发烧 reached 103717-5 (Crimean-Congo hemorrhagic fever virus RNA) and
+        # 高血压 41218-9 (urine hippurate): the lexical index cannot abstain
+        # from a word that is not an analyte. A diagnosis with a value is kept
+        # (`HIV 阴性` is a test result); a complaint never is.
+        resolution = replace(resolution, resolved=False, loinc="", axes=("", "", ""),
+                             rejected_code=resolution.loinc, **complaint)
     return observation(name, text, unit or "", resolution)
```
- **Lesson**: High-recall lexical and vector search indices must be constrained by pre-classification negative filters. When an input matches an out-of-domain ontology category (e.g., ICPC-3 symptom vs LOINC analyte), the engine must abstain with an explicit refusal reason rather than returning a spurious nearest-neighbor hit.

---

### Incident 5: Transparent Alpha Mask Rendering Black in Vision Models (BUG-MIRO-05)
- **Context**: Multi-modal document ingestion and vision pipeline (`mirobody/documents/render.py`).
- **What Was Expected**: Scanned lab documents or PDFs converted from transparent PNGs must retain legible black text when resized and handed to a vision model.
- **What Actually Happened**: Images formatted in `RGBA` or `LA` (greyscale + alpha) with transparent backgrounds were converted using Pillow's `convert("RGB")`. In Pillow, naive RGB conversion fills the alpha channel with black (`(0, 0, 0)`). Since lab report text is almost universally black, black text was composited on a black background, rendering the entire document unreadable and causing OCR and vision models to return zero indicators.
- **Evidence in Repo**: `mirobody/documents/render.py`, function `flatten`.
- **Root Cause**: Naive mode conversion in PIL (`img.convert("RGB")`) without compositing over an explicit white background mask for transparent modes (`RGBA`, `LA`, `P` with transparency).
- **Remediation Code Diff**:
```diff
--- a/mirobody/documents/render.py
+++ b/mirobody/documents/render.py
@@ -31,6 +31,18 @@ def image_info(data: bytes) -> tuple[int, int, str]:
 def flatten(img: Image.Image) -> Image.Image:
-    return img.convert("RGB")
+    """img as RGB, or L when it is grey, with any transparency composited
+    onto white. Dropped instead, a transparent pixel keeps the colour stored
+    under it, black in a PNG exported from a report viewer, and the black text
+    on it is gone: convert("RGB") did that to RGBA, and pasting without a
+    mask did it to LA."""
+    from PIL import Image
+
+    if img.mode in ("P", "PA") or (img.mode in ("L", "RGB") and "transparency" in img.info):
+        img = img.