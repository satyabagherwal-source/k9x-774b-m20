# Candidate Directive: [CD-H0W6] Atomic Swapped Persistence for Multi-Process Shared Configurations

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable-pixeltable-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:18:01.049Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pixeltable-pixeltable-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable-pixeltable-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:18:01.049Z`  
> **Learning ID**: `LEARN-EVO-pixeltable-pixeltable-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:18:01.157Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885481157",
    "title": "Atomic Swapped Persistence for Multi-Process Shared Configurations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pixeltable-pixeltable-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "4b22f2d7375e4b8562275904aec21292f832b220befe39b7fa1342b8141bd815"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Expresses generalized engineering invariants (4 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T03:18:01.157Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "e3d49e2b4feb2ced16e35e2a45b957a8c814de8cc1aded3c8a0275b9006dc34e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
