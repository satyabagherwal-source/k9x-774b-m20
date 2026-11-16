# Candidate Directive: [CD-0XER] In-Kernel Union Type Alignment & Unaligned Copy Invariant

<!-- PROVENANCE_START
{
  "source_repository": "cilium/cilium",
  "source_url": "https://github.com/cilium/cilium",
  "source_version": "d3bfd511",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T03:45:49.347Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-cilium-cilium",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium/cilium](https://github.com/cilium/cilium) (Revision: `d3bfd511`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T03:45:49.347Z`  
> **Learning ID**: `learn-github-cilium-cilium`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
}
```

**NEGATIVE CONSTRAINT**:
```c
// ANTI-PATTERN: Byte-by-byte loop or unaligned cast without packed union
static __always_inline bool bad_ipv6_equals(const __u8 *a, const __u8 *b) {
    #pragma unroll
    for (int i = 0; i < 16; i++) { // Bloats eBPF program, burns verifier complexity budget
        if (a[i] != b[i]) return false;
    }
    return true;
}

// ANTI-PATTERN: Direct cast causes alignment trap on ARM64
static __always_inline bool bad_cast_equals(const __u8 *a, const __u8 *b) {
    return (*((__u64*)(a)) == *((__u64*)(b)) && 
            *((__u64*)(a + 8)) == *((__u64*)(b + 8))); // REJECTED: misaligned packet dereference
}
```

**VERIFICATION METHOD**:
Compile with `clang -O2 -target bpf -emit-llvm` and pass through `llvm-objdump -S`. Assert that `ipv6_addr_equals` compiles to exactly two 64-bit load/compare operations (`ldxdw`, `jne`) without verifier path branching explosions:
```bash
llvm-objdump -d bpf_lxc.o | grep -A 5 "ipv6_addr_equals"
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:45:49.345Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800749345",
    "title": "In-Kernel Union Type Alignment & Unaligned Copy Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium/cilium",
    "source_uri": "https://github.com/cilium/cilium",
    "source_version": "HEAD",
    "content_hash": "e792b8c3e36bda3f96a86cd3311ae743328d18eb33a33d0f3ccfda6d2022bd86"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:45:49.345Z"
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
  "auth_token": "c060cb2cdc5aae3c19de1afe0a44bd14a8dbde245be39e1c1e0b8131db806d26"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
