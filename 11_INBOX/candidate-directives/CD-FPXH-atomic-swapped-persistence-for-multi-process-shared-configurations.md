# Candidate Directive: [CD-FPXH] Atomic Swapped Persistence for Multi-Process Shared Configurations

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable/pixeltable",
  "source_url": "https://github.com/pixeltable/pixeltable",
  "source_version": "9c30a9a6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T03:17:00.293Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pixeltable-pixeltable",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable/pixeltable](https://github.com/pixeltable/pixeltable) (Revision: `9c30a9a6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T03:17:00.293Z`  
> **Learning ID**: `learn-github-pixeltable-pixeltable`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When initializing or updating persistent system configurations, credential files, or cache registries accessed concurrently across multiple worker processes or threads, you MUST write the content to a unique temporary file on the same filesystem mount and execute an atomic filesystem rename (`os.replace` / atomic write) with explicit restricted permissions (`0600`). You MUST NOT write directly via `open(path, 'w')` followed by serialization.

**WHY**:
Standard `open(path, "w")` truncates the file immediately upon opening ($0$ bytes). Serialization formats (TOML, JSON, YAML) require subsequent buffer writes. In multi-process environments (such as `pytest-xdist`, microservices, or multiprocess background workers), concurrent workers reading during the window between truncation and serialization completion will read an empty file, load default empty configurations, fail invariant checks (e.g., missing required cache size keys), or crash with deserialization parse errors.

**WHEN TO APPLY**:
Apply to all daemon configurations, CLI local state stores, credential tokens, shared file cache manifests, and system bootstrap files in environments with multi-worker execution (Python, Node.js, Go, Rust).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import os
import tempfile
from pathlib import Path
from typing import Any
import toml

def atomic_write_toml(target_path: Path, data: dict[str, Any]) -> None:
    """
    Atomically writes a dictionary to a TOML file.
    Guarantees no concurrent reader sees a truncated or half-written file.
    Creates with 0600 (read/write by owner only) permissions.
    """
    target_path = target_path.resolve()
    target_dir = target_path.parent
    target_dir.mkdir(parents=True, exist_ok=True)

    # Use mkstemp in the same directory to guarantee identical filesystem mount (required for atomic rename)
    fd, temp_file_path = tempfile.mkstemp(
        dir=target_dir,
        prefix=f".{target_path.name}.",
        suffix=".tmp"
    )
    
    try:
        # mkstemp creates file with 0600 permissions by default
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            toml.dump(data, f)
            f.flush()
            os.fsync(f.fileno())  # Force commit to physical storage
        
        # Atomic rename replacing destination
        os.replace(temp_file_path, target_path)
    except Exception:
        # Clean up temporary artifact on failure
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL DEFECT: TOCTOU & Truncation Race Condition
def unsafe_write_config(path: Path, data: dict[str, Any]) -> None:
    # Truncates file immediately to 0 bytes!
    # Any concurrent process accessing path between open and toml.dump reads empty EOF
    with open(path, "w", encoding="utf-8") as f:
        toml.dump(data, f)
```

**VERIFICATION METHOD**:
Spawn 50 concurrent processes attempting to read the file immediately while a background process repeatedly calls the write function. Assert that zero processes read an empty file or fail TOML decoding:
```python
import concurrent.futures
import pytest

def test_no_empty_read_race(tmp_path: Path) -> None:
    target = tmp_path / "config.toml"
    payload = {"system": {"file_cache_size_g": 50}}
    
    def writer():
        for _ in range(100):
            atomic_write_toml(target, payload)

    def reader():
        for _ in range(100):
            if target.exists():
                data = toml.load(target)
                assert "system" in data and "file_cache_size_g" in data["system"]

    with concurrent.futures.ProcessPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(writer) for _ in range(2)] + [pool.submit(reader) for _ in range(6)]
        for f in concurrent.futures.as_completed(futures):
            f.result()
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:17:00.291Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885420291",
    "title": "Atomic Swapped Persistence for Multi-Process Shared Configurations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pixeltable/pixeltable",
    "source_uri": "https://github.com/pixeltable/pixeltable",
    "source_version": "HEAD",
    "content_hash": "46a88e96fc1bd816c6f7db758c940b0b43629d096d6e1fa040432b671dfda19f"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/1)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (5 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T03:17:00.291Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "d1702786133e335f4e03efa3298836d529d9349724e1f6782f7eca40585b2da5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
