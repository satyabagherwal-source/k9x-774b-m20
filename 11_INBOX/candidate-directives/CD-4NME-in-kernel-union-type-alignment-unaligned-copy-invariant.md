# Candidate Directive: [CD-4NME] In-Kernel Union Type Alignment & Unaligned Copy Invariant

<!-- PROVENANCE_START
{
  "source_repository": "cilium-cilium-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T03:48:43.223Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-cilium-cilium-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium-cilium-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T03:48:43.223Z`  
> **Learning ID**: `LEARN-EVO-cilium-cilium-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When serializing or operating on composite network layer types (IPv4/IPv6 addresses, L4 headers) crossing the boundary between user-space Go and kernel-space eBPF, the data structure MUST be defined as a `union` packed to the maximum architecture word width, and field comparisons MUST evaluate 64-bit word pairs rather than byte-by-byte loops. Unaligned destination copies MUST execute direct field-to-field primitive assignments to prevent unaligned memory access crashes on non-x86 hardware (ARM64/s390x).

**WHY**:
Byte-by-byte comparisons in eBPF generate unbounded loop unrolling instructions that rapidly exceed the kernel eBPF verifier's strict instruction limit (typically 1,000,000 verified instructions in modern kernels, or 4096 in legacy kernels). Furthermore, emitting unaligned 64-bit loads from an arbitrary packet buffer triggers a kernel-level hardware alignment fault on architectures like ARM64 (`SIGBUS` or kernel verification rejection: `misaligned value access off packet_end`).

**WHEN TO APPLY**:
Apply to any cross-boundary struct definition (C / eBPF / Rust FFI / Go unsafe pointer) handling network headers, IP addresses, or packed ring-buffer messages.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
/* Verified Production Datapath: bpf/lib/ipv6_core.h */
#pragma once

union v6addr {
    __u8 addr[16];
    struct {
        __u32 p1;
        __u32 p2;
        __u32 p3;
        __u32 p4;
    } p;
#define p1 p.p1
#define p2 p.p2
#define p3 p.p3
#define p4 p.p4
    struct {
        __u64 d1;
        __u64 d2;
    } d;
#define d1 d.d1
#define d2 d.d2
} __packed;

/* Fast 64-bit dual-word equality check: 2 instructions, zero verifier branching penalty */
static __always_inline bool ipv6_addr_equals(const union v6addr *a,
                                             const union v6addr *b)
{
    if (a->d1 != b->d1)
        return false;
    return a->d2 == b->d2;
}

/* Fast-path assignment guaranteeing alignment compatibility */
static __always_inline void ipv6_addr_copy_unaligned(union v6addr *dst,
                                                     const union v6addr *src)
{
    dst->d1 = src->d1;
    dst->d2 = src->d2;

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:48:43.285Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800923285",
    "title": "In-Kernel Union Type Alignment & Unaligned Copy Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium-cilium-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7813df60438321cdbe564243f34da5f3a2caac7d80133a25408e67484cdd212b"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:48:43.285Z"
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
  "auth_token": "f7409c0ab6e27b4c235ea0734997d1e7ddd5b5a6e6f6e0241820764b8a9f9b15"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
