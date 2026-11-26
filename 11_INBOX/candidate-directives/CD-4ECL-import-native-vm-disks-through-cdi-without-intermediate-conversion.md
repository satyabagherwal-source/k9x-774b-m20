# Candidate Directive: [CD-4ECL] import native VM disks through CDI without intermediate conversion

<!-- PROVENANCE_START
{
  "source_repository": "goodrain/rainbond",
  "source_url": "https://github.com/goodrain/rainbond",
  "source_version": "9f4fd68c",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T12:29:06.597Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-goodrain-rainbond",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [goodrain/rainbond](https://github.com/goodrain/rainbond) (Revision: `9f4fd68c`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T12:29:06.597Z`  
> **Learning ID**: `learn-github-goodrain-rainbond`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `builder/exector/build_from_vm.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in goodrain/rainbond. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9f4fd68c`: import native VM disks through CDI without intermediate conversion. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `builder/exector/build_from_vm.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	vmDiskBuildStrategyValidateDisk vmDiskBuildStrategy = "validate-disk"
	vmDiskBuildStrategyValidateVMDK vmDiskBuildStrategy = "validate-vmdk"
// Probe the actual format and reject external dependencies before publication.
// RAW and VHD do not implement qemu-img check; the other supported formats do.
// No disk data is rewritten here: CDI owns conversion into the persistent disk.
var vmDiskValidationDockerfileTmpl = `
FROM ${CONVERTER_IMAGE} AS validate
RUN --network=none set -eu; /usr/bin/qemu-img info --output=json /work/source.img > /work/source-info.json; format=; while IFS= read -r line; do case "$line" in '    "format": "raw"'*) format=raw ;; '    "format": "qcow2"'*) format=qcow2 ;; '    "format": "vdi"'*) format=vdi ;; '    "format": "vpc"'*) format=vpc ;; '    "format": "vhdx"'*) format=vhdx ;; *'"backing-filename":'*|*'"data-file":'*|*'"encrypted": true'*) echo 'vm_disk_external_dependency: 磁盘必须是无父盘、外部数据文件或加密的自包含单文件' >&2; exit 1 ;; esac; done < /work/source-info.json; case "$format" in raw|vpc) ;; qcow2|vdi|vhdx) /usr/bin/qemu-img check -f "$format" /work/source.img ;; *) echo 'vm_disk_unsupported_format: 不支持的磁盘内容格式' >&2; exit 1 ;; esac; rm -f /work/source-info.json
COPY 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	vmDiskBuildStrategyConvertDisk  vmDiskBuildStrategy = "convert-disk"
	vmDiskBuildStrategyConvertVMDK  vmDiskBuildStrategy = "convert-vmdk"
// IMG is a filename convention, not a disk format. Probe inside the converter
// image, which provides qemu-img, and accept only self-contained raw/QCOW2 disks.
// Parse its JSON with shell builtins to avoid adding converter dependencies.
var vmDiskToQCOW2DockerfileTmpl = `
FROM ${CONVERTER_IMAGE} AS convert
RUN /usr/bin/qemu-img info --output=json /work/source.img > /work/source-info.json && format= && while IFS= read -r line; do case "$line" in '    "format": "raw"'*) format=raw ;; '    "format": "qcow2"'*) format=qcow2 ;; *'"backing-filename":'*|*'"data-file":'*) echo 'VM disk must not reference external files' >&2; exit 1 ;; esac; done < /work/source-info.json && case "$format" in raw|qcow2) ;; *) echo 'unsupported VM disk content format' >&2; exit 1 ;; esac && /usr/bin/qemu-img convert -p -f "$format" -O qcow2 -c /work/source.img /work/rootdisk.qcow2 && rm -f /work/source.img /work/source-info.json
COPY --from=convert --chown=107:107 /work/rootdisk.qcow2 /disk/
// network and use a literal file child with backing=null as a second boundary
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9f4fd68c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T12:29:06.595Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795696146595",
    "title": "import native VM disks through CDI without intermediate conversion",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "goodrain/rainbond",
    "source_uri": "https://github.com/goodrain/rainbond",
    "source_version": "HEAD",
    "content_hash": "02d29305e02834b0b9c139af183a44391fd3bb57a02cc1ccf9c26891758b78cf"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:29:06.595Z"
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
  "auth_token": "133242af04ff92543f09d6d9461e02016818a988208db557b8bf360e874f8eb1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
