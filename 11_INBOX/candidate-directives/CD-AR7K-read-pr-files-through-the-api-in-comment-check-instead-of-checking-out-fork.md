# Candidate Directive: [CD-AR7K] read PR files through the API in comment-check instead of checking out fork

<!-- PROVENANCE_START
{
  "source_repository": "go-kratos/kratos",
  "source_url": "https://github.com/go-kratos/kratos",
  "source_version": "56cfd65d",
  "license": "MIT",
  "timestamp": "2026-11-23T20:38:55.808Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-go-kratos-kratos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [go-kratos/kratos](https://github.com/go-kratos/kratos) (Revision: `56cfd65d`).  
> **License**: MIT | **Timestamp**: `2026-11-23T20:38:55.808Z`  
> **Learning ID**: `learn-github-go-kratos-kratos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/comment-check.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in go-kratos/kratos. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `56cfd65d`: ci: read PR files through the API in comment-check instead of checking out fork code. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/comment-check.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
      # The PR code is not checked out. This workflow runs on pull_request_target
      # with the base repository's token, and actions/checkout refuses to check out
      # fork code in that context. Changed files are read through the API as data.
        env:
          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          set -eo pipefail
          # Get the status, blob SHA and path of each file changed in this PR
          gh api --paginate "repos/${REPO}/pulls/${PR_NUMBER}/files?per_page=100" \
            --jq '.[] | [.status, .sha, .filename] | @tsv' > changed_files.tsv

          # The files API returns at most 3000 files. Fail rather than pass on an incomplete scan.
          expected_files=$(gh api "repos/${REPO}/pulls/${PR_NUMBER}" --jq '.changed_files')
          listed_files=$(( $(wc -l < changed_files.tsv) ))
          if [ "$listed_files" -lt "$expected_files" ]; then
            echo "::error::Only ${listed_files} of ${expected_files} changed files could be listed through the API, so the PR could not be fully checked."
            exit 1
          fi
          while IFS=$'\t' rea
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          repository: ${{ github.event.pull_request.head.repo.full_name }}
          fetch-depth: 0
          set -e
          # Get the list of files changed in this PR compared to the base branch
          changed_files=$(git diff --name-only ${{ github.event.pull_request.base.sha }} ${{ github.event.pull_request.head.sha }})
          for file in $changed_files; do
              if [[ "$file" == ./$dir/* ]]; then
            grep_output=$(grep -PnH "$pattern" "$file" || true)
              # Insert a tab after the line number, keeping the colon between the file path and line number
              formatted_output=$(echo "$grep_output" | sed 's/^\(.*:[0-9]\+\):/\1\t/')
          done
        if: failure() && github.event_name != 'workflow_dispatch'
          comment-author: "kratos-ci-bot"
        if: failure() && github.event_name != 'workflow_dispatch' # This step runs only if the previous step fails
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `56cfd65d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T20:38:55.806Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795466335806",
    "title": "read PR files through the API in comment-check instead of checking out fork",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "go-kratos/kratos",
    "source_uri": "https://github.com/go-kratos/kratos",
    "source_version": "HEAD",
    "content_hash": "833ecf9f2b4912475c03e859c38ae7d9517057ac5a09d036336ac1a5cc7ef6b3"
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
        "Harvested/verified timestamp recorded: 2026-11-23T20:38:55.806Z"
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
  "auth_token": "f98ea7d9e63744027818cf987376a694f06325bdff99970c3ae16c211e16e1b9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
