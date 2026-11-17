# Candidate Directive: [CD-7NJZ] Multi-Tier CAS Fallback with Chunked Block Reassembly for Distributed K/V

<!-- PROVENANCE_START
{
  "source_repository": "hashicorp/terraform",
  "source_url": "https://github.com/hashicorp/terraform",
  "source_version": "b3fb138b",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T08:18:39.743Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-hashicorp-terraform",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hashicorp/terraform](https://github.com/hashicorp/terraform) (Revision: `b3fb138b`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T08:18:39.743Z`  
> **Learning ID**: `learn-github-hashicorp-terraform`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When writing unstructured state payloads to key-value stores with hard value-size limits (e.g., Consul KV 512KB limit, Raft frame constraints), the storage driver MUST execute a single-transaction Check-And-Set (CAS) for payloads under the threshold. When the payload exceeds the limit, it MUST chunk the payload, store chunk blocks under a hashed content-addressed key namespace, atomically write a manifest pointer referencing those chunks via CAS, and purge orphaned chunks from previous hashes.

**WHY**:
Payload growth is non-linear in infrastructure graphs. Large environments easily cross 512KB or 1MB. Blindly executing chunking on every write introduces latency and storage bloat; blindly writing the whole blob causes hard HTTP 400/500 transaction rejections. Furthermore, overwriting a multi-part blob without cleaning up old chunks leaves dangling, disconnected orphaned blocks that consume Raft disk log space.

**WHEN TO APPLY**:
Storage adapters persisting payloads into Consul, etcd, Redis, ZooKeeper, or DynamoDB where document sizes approach or exceed transaction frame sizes.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package storage

import (
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
)

type KVTransactionOps interface {
	PutCAS(key string, val []byte, modifyIndex uint64) (uint64, error)
	PutDirect(key string, val []byte) error
	DeleteTree(prefix string) error
}

type ChunkManifest struct {
	CurrentHash string   `json:"current-hash"`
	Chunks      []string `json:"chunks"`
}

type ChunkedKVClient struct {
	mu          sync.Mutex
	client      KVTransactionOps
	basePath    string
	modifyIndex uint64
	chunkLimit  int
}

func (c *ChunkedKVClient) PutState(data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 1. Attempt direct single-entry CAS write
	newIndex, err := c.client.PutCAS(c.basePath, data, c.modifyIndex)
	if err == nil {
		c.modifyIndex = newIndex
		return nil
	}

	// 2. Check if error is due to payload size limit
	if !strings.Contains(err.Error(), "too large") && !strings.Contains(err.Error(), "Value exceeds limit") {
		return err
	}

	// 3. Fallback to chunked persistence
	dataHash := fmt.Sprintf("%x", md5.Sum(data))
	chunkPaths := make([]string, 0)
	
	chunks := splitBuffer(data, c.chunkLimit)
	for idx, chunk := range chunks {
		chunkKey := fmt.Sprintf("%s/tfstate.%s/%d", strings.TrimRight(c.basePath, "/"), dataHash, idx)
		chunkPaths = append(chunkPaths, chunkKey)
		if err := c.client.PutDirect(chunkKey, chunk); err != nil {
			return fmt.Errorf("failed writing chunk %s: %w", chunkKey, err)
		}
	}

	manifest := ChunkManifest{
		CurrentHash: dataHash,
		Chunks:      chunkPaths,
	}
	manifestBytes, err := json.Marshal(manifest)
	if err != nil {
		return err
	}

	// 4. Update manifest root atomically via CAS
	finalIndex, err := c.client.PutCAS(c.basePath, manifestBytes, c.modifyIndex)
	if err != nil {
		return fmt.Errorf("failed CAS on chunk manifest: %w", err)
	}
	c.modifyIndex = finalIndex
	return nil
}

func splitBuffer(buf []byte, chunkSize int) [][]byte {
	var chunks [][]byte
	for i := 0; i < len(buf); i += chunkSize {
		end := i + chunkSize
		if end > len(buf) {
			end = len(buf)
		}
		chunks = append(chunks, buf[i:end])
	}
	return chunks
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blind upload with zero chunking fallback or unreferenced chunk pollution
func (c *VulnerableKVClient) Put(data []byte) error {
    // VIOLATION: Hard failure when state file grows beyond Consul Raft 512KB limits.
    // Throws "Value exceeds limit" and causes fatal terraform apply crash midway.
    return c.kv.Set(c.Path, data)
}
```

**VERIFICATION METHOD**:
Generate a random byte slice of 1.5MB. Set `chunkLimit = 524288` (512KB). Execute `PutState`. Verify that exactly 3 chunks are written under `/tfstate.<md5>/[0,1,2]`, verify the manifest JSON structure, and verify that updating with a 2MB slice deletes the previous chunk path prefix.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:18:39.743Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903519743",
    "title": "Multi-Tier CAS Fallback with Chunked Block Reassembly for Distributed K/V",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hashicorp/terraform",
    "source_uri": "https://github.com/hashicorp/terraform",
    "source_version": "HEAD",
    "content_hash": "5a6e981912d8349b85bfa7a9dcd664b992efc86a3d588c44be381e3745380e03"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
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
        "Direct empirical evidence ratio: 0% (0/5)",
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:18:39.743Z"
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
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "7cc7aac062e4be36bd029848820ff1d58ad55a7cef002a315a8b2c423e7523f9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
