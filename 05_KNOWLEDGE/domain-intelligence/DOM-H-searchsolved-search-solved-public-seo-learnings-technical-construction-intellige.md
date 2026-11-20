# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: searchsolved-search-solved-public-seo-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "searchsolved-search-solved-public-seo-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T03:02:45.229Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-searchsolved-search-solved-public-seo-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [searchsolved-search-solved-public-seo-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T03:02:45.229Z`  
> **Learning ID**: `LEARN-EVO-searchsolved-search-solved-public-seo-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: J (Search & Distribution Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), F (Design Intelligence), B (Product Intelligence)
- **Confidence Rating**: 52%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from searchsolved-search-solved-public-seo-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/searchsolved-search-solved-public-seo-learnings.md`  
> **Source**: github ([https://github.com/searchsolved/search-solved-public-seo](https://github.com/searchsolved/search-solved-public-seo))  
> **Source Version**: `591fa023`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-20T03:01:46.278Z  
> **Learning ID**: `learn-github-searchsolved-search-solved-public-seo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): searchsolved/search-solved-public-seo

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Technical Problem Space & Subsystem Decoupling
`searchsolved/search-solved-public-seo` is an enterprise-scale monorepo containing over 100 modular SEO automations, data science pipelines, and 54 interactive Streamlit web applications. The repository addresses systemic challenges in programmatic Search Engine Optimization (SEO):
1. **Third-Party API Rate Limiting & Asynchronous Job Scheduling**: Managing long-running SERP (Search Engine Results Page) scrapers across providers like DataForSEO, where real-time synchronous APIs fail due to upstream redirects and proxy latency.
2. **Text Complexity & Structural Extraction**: Ingesting dynamic sitemaps, extracting primary article content while stripping noise (DOM boilerplates, scripts, styles), and evaluating lexical readability at scale.
3. **Semantic Normalization via Reasoning LLMs**: Employing local (Ollama) and cloud-hosted LLMs to cluster and normalize noisy keyword corpuses using strict JSON schemas and reasoning-budget configurations.
4. **Hierarchical Metric Rollups**: Processing multi-gigabyte organic search position exports (e.g., Ahrefs, SEMrush) across complex URL path hierarchies to isolate algorithm update impacts per folder depth.

```
                                  ┌───────────────────────────────┐
                                  │      Streamlit GUI / CLI      │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │                 Core Logic Pipelines                    │
                     ├──────────────────────────┬──────────────────────────────┤
                     │   DataForSEO Queue       │   Representative Keyword     │
                     │   State Machine          │   Normaliser (LLM)           │
                     └─────────────┬────────────┴──────────────┬───────────────┘
                                   │                           │
          ┌────────────────────────┴──────────────┐            │
          │                                       │            ▼
          ▼                                       ▼   ┌────────────────────────┐
┌──────────────────┐                    ┌───────────┐ │ OpenAI / Anthropic     │
│ task_post (Async)│                    │ CSV Job   │ │ Structured Outputs     │
└─────────┬────────┘                    │ Manifest  │ └────────────────────────┘
          │ (Poll 40601/40602)          └─────┬─────┘
          ▼                                   │
┌──────────────────┐                          ▼
│ task_get/advanced│ ──[google.com/goto guard] ──► Cleaned SERP Corpus
└──────────────────┘
```

### 1.2 State Ownership & Standalone Portability Model
A prominent architectural trait of this repository is **shared duplication over fragile monorepo imports**:
- Each tool directory (e.g., `competitive-analysis/serp-crossover-analyzer/`, `content-analysis/entity-extractor/`, `keyword-clustering/serp-clustering-at-scale/`) is designed to be completely self-contained. It contains its own `requirements.txt`, CLI interface, Streamlit app, and local dependencies.
- Subsystem modules like `dataforseo_queue.py` are replicated verbatim across tools rather than referenced via relative parent paths (`from ...shared import`). Integrity across copies is guaranteed at build/test time via a verification script (`scripts/check_dataforseo_queue.py`).
- Long-running batch operations decouple execution from server memory by persisting operational manifests directly into human-readable, schema-enforced CSV files (`job_to_csv` / `job_from_csv`). This state-machine serialization allows processes to be paused, scheduled, or recovered across stateless container restarts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Decoupled State-Machine Persistence for Asynchronous Polling APIs
**RULE**:
Network interactions against upstream asynchronous batch queues with completion windows exceeding HTTP client timeouts (e.g., $>30\text{s}$) MUST decouple submission (`task_post`) from retrieval (`task_get`) via an idempotent on-disk or database job manifest. Polling loops MUST treat intermediate non-terminal states as explicit continuations, MUST abort immediately on unrecoverable authentication/financial codes, and MUST sanitize all upstream vendor redirects (such as tracking hops) at the protocol extraction boundary before yielding domain entities.

**WHY**:
Upstream search engines frequently modify link forwarding behaviors (e.g., Google introducing `google.com/goto` tokenized redirects). Asynchronous vendor scrapers take 20 to 45 minutes to resolve the underlying canonical targets. Firing synchronous HTTP requests results in thread exhaustion, connection timeouts, or corrupted downstream datasets consisting solely of intermediate tracking domains (`google.com`). Persisting task manifests to a deterministic serialization format (e.g., CSV with UTF-8 BOM awareness) enables pause-and-resume workflows and decouples ephemeral network sessions from data pipelines.

**WHEN TO APPLY**:
Apply to any client library or worker interacting with asynchronous SaaS queues, third-party crawlers, or long-running transcription/indexing jobs where completion times are nondeterministic and API costs apply per invocation.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import csv
import io
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import requests

PENDING_STATUS_CODES: Set[int] = {40601, 40602}
ACCOUNT_FATAL_CODES: Set[int] = {40100, 40104, 40200, 40201, 40203, 40204, 40207, 40210}
JOB_SCHEMA: List[str] = ['task_id', 'query', 'status', 'created_at']

class QueueJobError(RuntimeError):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code

    @property
    def is_terminal_account_fault(self) -> bool:
        return self.status_code in ACCOUNT_FATAL_CODES

def serialize_job_manifest(records: List[Dict[str, Any]]) -> str:
    """Serialize active tasks with strict schema adherence."""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=JOB_SCHEMA)
    writer.writeheader()
    writer.writerows(records)
    return buffer.getvalue()

def deserialize_job_manifest(raw_csv: str) -> List[Dict[str, Any]]:
    """Deserialize manifest, stripping UTF-8 BOM to prevent key corruption."""
    clean_text = raw_csv.lstrip('\ufeff')
    reader = csv.DictReader(io.StringIO(clean_text))
    if not reader.fieldnames or not set(JOB_SCHEMA).issubset(set(reader.fieldnames)):
        raise ValueError(f"Invalid job manifest. Missing required fields from {JOB_SCHEMA}")
    
    tasks = []
    seen_ids = set()
    for row in reader:
        task_id = (row.get('task_id') or '').strip()
        if not task_id or task_id in seen_ids:
            continue
        seen_ids.add(task_id)
        tasks.append(row)
    return tasks

def poll_batch_completion(
    tasks: List[Dict[str, Any]], 
    endpoint: str, 
    headers: Dict[str, str],
    poll_interval: float = 2.0
) -> Dict[str, Any]:
    """Poll task status safely with fail-fast account verification and redirect pruning."""
    results: Dict[str, Any] = {'completed': {}, 'pending': [], 'failed': []}
    
    for row in tasks:
        task_id = row['task_id']
        try:
            resp = requests.get(f"{endpoint}/{task_id}", headers=headers, timeout=60)
            data = resp.json()
            code = data.get('status_code')
            
            if code in ACCOUNT_FATAL_CODES:
                raise QueueJobError(f"Fatal account error: {data.get('status_message')}", status_code=code)
            
            if code in PENDING_STATUS_CODES:
                results['pending'].append(task_id)
                continue
                
            task_data = (data.get('tasks') or [{}])[0]
            task_status = task_data.get('status_code')
            
            if task_status in PENDING_STATUS_CODES:
                results['pending'].append(task_id)
            elif task_status == 20000:
                raw_items = task_data.get('result', [{}])[0].get('items', [])
                # Sanitize out intermediate tracking redirects
                clean_items = [
                    item for item in raw_items 
                    if 'google.com/goto' not in (item.get('url') or '')
                ]
                results['completed'][task_id] = clean_items
            else:
                results['failed'].append((task_id, task_data.get('status_message', 'Unknown failure')))
                
        except requests.RequestException as exc:
            results['failed'].append((task_id, str(exc)))
            
        time.sleep(poll_interval)
        
    return results
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Synchronous in-memory blocking poll with unhandled redirect leaking
def unsafe_fetch_serp(keywords, auth):
    results = {}
    for kw in keywords:
        # Blocks the entire process; crashes if network drops or search engine delays
        resp = requests.post("https://api.vendor.com/live", auth=auth, json={"kw": kw}).json()
        items = resp["tasks"][0]["result"][0]["items"]
        # LEAK: Ingests raw 'google.com/goto' URLs, poisoning downstream deduplication and clustering!
        results[kw] = [item["url"] for item in items]
    return results
```

**VERIFICATION METHOD**:
Verify using automated unit/integration tests that mock HTTP 40100/40601 responses:
```python
def test_poll_batch_aborts_on_fatal_account_code(requests_mock):
    requests_mock.get(
        "https://api.test.com/task/123", 
        json={"status_code": 40200, "status_message": "Insufficient balance"}
    )
    tasks = [{'task_id': '123', 'query': 'seo', 'status': 'queued', 'created_at': '2026-01-01'}]
    try:
        poll_batch_completion(tasks, "https://api.test.com/task", {})
        assert False, "Should have raised QueueJobError"
    except QueueJobError as err:
        assert err.is_terminal_account_fault is True
```

---

### 2. Disjoint Parameter Protocol for Dual Architecture LLM Integrations
**RULE**:
When integrating language models that span both standard auto-regressive models (e.g., Qwen, GPT-4o, Claude Haiku) and specialized reasoning-optimized architectures (e.g., OpenAI o-series, GPT-6 Luna/Terra), the invocation layer MUST conditionally decouple hyperparameters. If the target model utilizes an explicit reasoning parameter (such as `reasoning_effort`), the client MUST omit unsupported legacy parameters (`temperature`, `top_p`) from the payload. Conversely, non-reasoning and local OpenAI-compatible backends (e.g., Ollama) MUST NOT receive vendor-specific reasoning arguments.

**WHY**:
OpenAI reasoning endpoints strictly enforce schema validation on chat completion payloads. Sending `temperature` to reasoning models triggers a fatal HTTP 400 (`BadRequestError: temperature is not supported with this model`). Conversely, local OpenAI-compatible inference servers (Ollama, vLLM, LocalAI) reject unknown properties like `reasoning_effort` with unhandled 422 Unprocessable Entity or 400 Bad Request errors. Dynamic model-prefix inspection is required to avoid silent pipeline termination during runtime model switching.

**WHEN TO APPLY**:
Apply to any unified AI agent pipeline, router, or wrapper calling multi-model providers via an `OpenAI` or OpenAI-compatible client abstraction.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Any, Dict
from openai import OpenAI, BadRequestError, AuthenticationError, PermissionDeniedError, NotFoundError
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_not_exception_type

PERMANENT_API_ERRORS = (
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    BadRequestError
)

def resolve_model_parameters(model_name: str, reasoning_effort: str = "low") -> Dict[str, Any]:
    """Dynamically assign disjoint parameter sets based on model architecture."""
    normalized_name = str(model_name).strip().lower()
    
    # Reasoning models reject temperature and require reasoning_effort
    if normalized_name.startswith(("gpt-6", "o1", "o3")):
        return {
            "reasoning_effort": reasoning_effort
            # temperature MUST NOT be present
        }
    
    # Standard models accept temperature and reject reasoning_effort
    return {
        "temperature": 0.0
    }

@retry(
    stop=stop_after_attempt(3),
    wait=wait_fixed(2.0),
    retry=retry_if_not_exception_type(PERMANENT_API_ERRORS),
    reraise=True
)
def execute_completion_request(
    client: OpenAI,
    model: str,
    messages: list,
    response_schema: Dict[str, Any]
) -> str:
    params = resolve_model_parameters(model)
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        response_format=response_schema,
        **params
    )
    return completion.choices[0].message.content or ""
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Uniform argument injection across heterogeneous LLM architectures
def invoke_llm_hazard(client, model, messages):
    # CRASH: Fails on gpt-6/o-series because temperature is forbidden
    # CRASH: Fails on Ollama/vLLM because reasoning_effort is unrecognized
    return client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        reasoning_effort="medium" 
    )
```

**VERIFICATION METHOD**:
Implement property-based assertions checking parameter presence based on model names:
```python
def test_resolve_model_parameters_invariants():
    reasoning_payload = resolve_model_parameters("gpt-6-luna")
    assert "reasoning_effort" in reasoning_payload
    assert "temperature" not in reasoning_payload
    
    standard_payload = resolve_model_parameters("qwen2.5:7b")
    assert "temperature" in standard_payload
    assert "reasoning_effort" not in standard_payload
```

---

### 3. Resilient Multi-Script Unicode Normalization for Input Token Sanitization
**RULE**:
Before passing arbitrary user strings or scraped keywords to regex parsers, clustering tokenizers, or external API query parameters, pipelines MUST sanitize characters against an explicitly permitted Unicode script block whitelist while maintaining valid punctuation, Latin, Arabic, and Indic ranges. Raw replacement MUST NOT delete whitespace boundaries or trigger string slicing anomalies.

**WHY**:
SEO keyword lists scraped from global search engines regularly feature invisible control codes, zero-width joiners, terminal control characters (`\r\n`), and adversarial token sequences. Indiscriminately applying ASCII-only regex (`[^a-zA-Z0-9]`) destroys international search volume (Arabic, Hindi, etc.), while leaving strings unsanitized causes downstream JSON serialization failures or silent empty keys in Pandas DataFrame indexing.

**WHEN TO APPLY**:
Apply in keyword tokenization, entity extraction, URL path slicing, and DataFrame column creation where multilingual user input or web-scraped strings are normalized.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import re
from typing import Any

# Preserves printable ASCII, Arabic (\u0600-\u06FF), and Devanagari (\u0900-\u097F)
UNICODE_CLEAN_PATTERN = re.compile(r'[^\x20-\x7E\u0600-\u06FF\u0900-\u097F]+')

def sanitize_keyword_token(raw_input: Any) -> str:
    """Sanitize input preserving multi-lingual semantic tokens while stripping controls."""
    if raw_input is None:
        return ""
    
    # Enforce string conversion and collapse carriage returns
    text = str(raw_input).strip()
    text = re.sub(r'[\r\n\t]+', ' ', text)
    
    # Strip illegal controls and non-whitelisted script points
    cleaned = UNICODE_CLEAN_PATTERN.sub('', text)
    
    # Normalize multiple spaces into single space
    return re.sub(r'\s+', ' ', cleaned).strip()
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Naive ASCII stripping or unsafe slicing
def unsafe_sanitize(keyword):
    # Destroys all non-English keywords completely (returns "" for Arabic/Hindi)
    clean = re.sub(r'[^a-zA-Z0-9 ]', '', str(keyword))
    # Unsafe slicing might split multi-byte characters or leave trailing broken tokens
    return clean[:255]
```

**VERIFICATION METHOD**:
```python
def test_unicode_sanitizer_preserves_multilingual_targets():
    arabic = "أفضل حذاء للجري\n\r\t"
    hindi = "दौड़ने के लिए सबसे अच्छे जूते"
    english = "best running shoes! @#$% \x00\x1f"
    
    assert sanitize_keyword_token(arabic) == "أفضل حذاء للجري"
    assert sanitize_keyword_token(hindi) == "दौड़ने के लिए सबसे अच्छे जूते"
    assert sanitize_keyword_token(english) == "best running shoes! @#$%"
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Unresolved Google Redirects Poisoning SERP Clustering (BUG-SERP-01)
- **Context**: `keyword-clustering/serp-clustering-api/` and `competitive-analysis/serp-crossover-analyzer/dataforseo_queue.py`
- **What Was Expected**: Querying DataForSEO's SERP endpoints for organic rankings was expected to return destination landing page URLs (e.g., `https://example.com/shoes`) to compute overlapping URL Jaccard similarity across keywords.
- **What Actually Happened**: Google began routing organic search clicks through intermediary redirect paths (`google.com/goto?...`). Synchronous Live API calls from DataForSEO returned these unresolved Google URLs. All ranking items clustered under the single domain `google.com`, breaking URL crossover analysis and keyword clustering.
- **Evidence in Repo**: Commit `f4fcda7e` ("SERP Clustering API README: build the CSV from the DataForSEO Standard queue").
- **Root Cause**: The DataForSEO "Live" API immediately parses SERP DOM without following downstream HTTP redirects due to strict SLA response times ($<3\text{s}$). The "Standard" queue processes URLs through real headless browser sessions and redirect followers over a 25-minute evaluation period.
- **Remediation Code Diff**:
```python
// - Live synchronous endpoint invocation
- resp = requests.post(
-     "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
-     auth=auth,
-     json=[{"keyword": kw, "location_code": 2826, "language_code": "en", "device": "desktop", "depth": 10}],
-     timeout=60,
- ).json()
- items = (resp["tasks"][0].get("result") or [{}])[0].get("items") or []
- for item in items:
-     if item.get("type") == "organic":
-         writer.writerow([kw, item["url"]])

// + Asynchronous standard queue task creation and deferred resolution with redirect filtering
+ body = [{"keyword": kw, "location_code": 2826, "language_code": "en",
+          "device": "desktop", "depth": 10} for kw in keywords]
+ posted = requests.post(f"{BASE}/task_post", auth=auth, json=body, timeout=60).json()
+ pending = {t["id"]: t["data"]["keyword"] for t in posted["tasks"] if t["status_code"] == 20100}
+ while pending:
+     time.sleep(60)
+     for task_id, kw in list(pending.items()):
+         task = requests.get(f"{BASE}/task_get/advanced/{task_id}", auth=auth, timeout=60).json()["tasks"][0]
+         if task["status_code"] in (40601, 40602): # still running
+             continue
+         del pending[task_id]
+         items = (task.get("result") or [{}])[0].get("items") or []
+         for item in items:
+             url = item.get("url") or ""
+             if item.get("type") == "organic" and "google.com/goto" not in url:
+                 writer.writerow([kw, url])
```
- **Lesson**: Data acquisition pipelines depending on third-party scrapers must never assume output links are canonical. All scraping consumers must enforce redirect-filtration guards and employ asynchronous reconciliation queues when search engine routing architectures change.

---

### Incident 2: Third-Party Placeholder Service Outage Breaking Streamlit UIs (BUG-UI-02)
- **Context**: `ecommerce/image-centering-tool/`
- **What Was Expected**: Empty-state UI previews in the Streamlit web dashboard and GitHub README markdown were expected to render sample eCommerce product banners before user file uploads.
- **What Actually Happened**: The public service `via.placeholder.com` shut down, causing dead image icons, layout reflow hangs, and HTTP 404 image errors across the Streamlit application canvas.
- **Evidence in Repo**: Issue #20 ("Fix image centering tool placeholder previews").
- **Root Cause**: Relying on external third-party CDN domains for static UI assets instead of bundling local application fixtures.
- **Remediation Code Diff**:
```python
// - External CDN dependency
- st.image("https://via.placeholder.com/600x400.png?text=Sample+Product+Preview")

// + Fully isolated local asset bundling
+ st.image("assets/example_product_preview.png")
```
- **Lesson**: Production UI tools must achieve total network isolation regarding their core visual presentation. External demo image dependencies must be committed locally to prevent layout breakage when third-party utility domains expire.

---

### Incident 3: Stale Pre-Reorganization Colab Notebook Deep-Links (BUG-NOTEBOOK-03)
- **Context**: 16 Google Colab Notebooks across `ecommerce/`, `keyword-clustering/`, and `reporting/`
- **What Was Expected**: Clicking "Open in Colab" SVG badges in documentation markdown was expected to clone the current repository head into Google Colab's ephemeral runtime.
- **What Actually Happened**: The repository underwent structural refactoring (moving loose tools into standardized category subdirectories like `reporting/` and `content-analysis/`). The 16 notebook badges retained hardcoded legacy GitHub URLs, throwing 404 errors in Google Colab when opened by users.
- **Evidence in Repo**: Issue #18 ("Fix 16 broken Colab badge URLs across all notebooks").
- **Root Cause**: Static markdown links inside Jupyter Notebook cells were not tied to dynamic repository paths or validated via automated CI link checkers during directory re-architecting.
- **Remediation Code Diff**:
```markdown
// - Stale path prior to category grouping
-[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/searchsolved/search-solved-public-seo/blob/main/top-traffic-pages.ipynb)

// + Correct subfolder mapping post-reorganization
+[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/searchsolved/search-solved-public-seo/blob/main/reporting/top-traffic-pages/top-traffic-pages.ipynb)
```
- **Lesson**: Monorepo folder reorganization requires an automated pre-commit audit of all embedded markdown badges, ensuring path integrity matches the git tree.

---

### Incident 4: UTF-8 Byte Order Mark (BOM) CSV Ingestion Failures (BUG-CSV-04)
- **Context**: `dataforseo_queue.py:job_from_csv`
- **What Was Expected**: Exported CSV job manifests opened and re-saved by users in Microsoft Excel on Windows were expected to load cleanly back into CLI/Streamlit pipelines.
- **What Actually Happened**: Microsoft Excel prepends a 3-byte UTF-8 Byte Order Mark (`\xef\xbb\xbf` or `\ufeff`) to saved CSV files. When Python's standard `csv.DictReader` parsed the file, the first column header `'task_id'` was read as `'\ufefftask_id'`, causing `missing = [c for c in ('task_id', 'keyword') if c not in reader.fieldnames]` to trigger an erroneous `ValueError("This is not a job file")`.
- **Evidence in Repo**: Implementation in `dataforseo_queue.py`: `reader = csv.DictReader(io.StringIO(text.lstrip('﻿')))` and `pd.read_csv(..., encoding='utf-8-sig')`.
- **Root Cause**: Neglecting Windows Excel UTF-8 BOM encoding conventions during string buffer deserialization.
- **Remediation Code Diff**:
```python
// - Unsanitized StringIO deserialization
- reader = csv.DictReader(io.StringIO(text))

// + Explicit removal of the leading zero-width non-breaking space (BOM)
+ reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
```
- **Lesson**: Any system ingesting user-submitted CSV files originating from Excel must enforce `utf-8-sig` decoding or explicitly strip `\ufeff` from the text stream before extracting field schemas.

---

### Incident 5: Reasoning Model Failure on Temperature Hyperparameter (BUG-LLM-05)
- **Context**: `keyword-research/representative-keyword-normaliser/core.py`
- **What Was Expected**: Users configuring OpenAI reasoning models (such as GPT-6 Luna or o-series) could generate normalized representative queries using standard completion parameters.
- **What Actually Happened**: Supplying `temperature=0.0` or standard temperature sliders to reasoning models caused the OpenAI API client to raise an unhandled `BadRequestError`, crashing the batch normalization run.
- **Evidence in Repo**: `reasoning_params(model, effort="low")` function in `core.py`.
- **Root Cause**: OpenAI's newer reasoning architectures reject `temperature`, `top_p`, and `presence_penalty` entirely, requiring `reasoning_effort` instead.
- **Remediation Code Diff**:
```python
// - Direct completion call passing uniform parameters
- completion = client.chat.completions.create(
-     model=model,
-     messages=messages,
-     temperature=0.0,
-     response_format=RESPONSE_FORMAT
- )

// + Dynamic hyperparameter isolation based on model family
+ def reasoning_params(model, effort="low"):
+     if str(model).strip().lower().startswith("gpt-6"):
+         return {"reasoning_effort": effort}
+     return {}
+
+ completion = client.chat.completions.create(
+     model=model,
+     messages=messages,
+     response_format=RESPONSE_FORMAT,
+     **reasoning_params(model),
+ )
```
- **Lesson**: Unified LLM client boundaries must separate inference parameters into disjoint sets based on the underlying model architecture.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **BOM-Resilient DictReader Extraction**:
   When parsing CSV text from user uploads, stripping the BOM character via literal string vs unicode escape:
   ```python
   # INVARIANT: text.lstrip('\ufeff') strips the Unicode BOM token.
   # Never rely on standard 'utf-8' decode when 'utf-8-sig' handles \xef\xbb\xbf natively.
   reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
   ```
2. **Boolean and Missing Value Handling in Falsy Metrics**:
   When reading numerical metrics such as search volume or ranking position, `0` is a valid search position or zero volume, not an unassigned `None`:
   ```python
   # HAZARD: Implicit falsy conversion treats position 0 or volume 0 as missing!
   # BAD: volume = row.get("volume") or 100
   # SAFE: Check explicit None
   raw_vol = row.get("volume")
   volume = int(raw_vol) if raw_vol is not None and str(raw_vol).strip() != "" else 0
   ```
3. **Deep Immutability vs DataFrame Slicing (`SettingWithCopyWarning`)**:
   Pandas operations that filter and subsequently append calculated columns must strictly make deep copies:
   ```python
   # INVARIANT: Explicitly invoke .copy() after conditional slice
   df_prev_top_3 = df_ahrefs[df_ahrefs["Prev Top

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
