# Candidate Directive: [CD-S0WK] Fork-Isolated Workflow Checkout and Execution Barrier

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:34:51.926Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:34:51.926Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant): Opposing directive on 'disable': candidate prescribes action ('always disable') while canonical Rule CANON-002 forbids it ('never disable'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
GitHub Actions workflows triggered by `pull_request_target` MUST check out the trusted base branch exclusively into `$GITHUB_WORKSPACE`, MUST NEVER check out untrusted fork pull request heads directly into the workspace, MUST disable credential persistence (`persist-credentials: false`), and MUST NOT materialize untrusted IDE/agent configuration files (`.claude/`, `.mcp.json`, `.vscode/`) in the runner workspace. All analysis tools (linters, AI review agents) MUST be restricted strictly to user-level configuration sources (`--setting-sources user`) with bash and write tools completely disabled.

**WHY**:
`pull_request_target` workflows run with read/write repo secrets and tokens. If actions check out the untrusted fork PR branch (`ref: ${{ github.event.pull_request.head.sha }}`), an attacker can supply malicious configuration files (e.g., custom `.claude/settings.json`, `.mcp.json`, or pre-commit git hooks) that execute arbitrary commands or leverage AI agent tool definitions to read `$GITHUB_TOKEN` and secrets from the runner filesystem. Furthermore, inline interpolation of `${{ github.event.pull_request.title }}` inside bash `run:` scripts allows direct shell command injection.

**WHEN TO APPLY**:
Apply to any CI/CD pipeline using `pull_request_target`, bot automation, or LLM-assisted code review operating over public open-source repositories accepting external pull requests.

**VERIFIED IMPLEMENTATION PATTERN**:
```yaml
# In .github/workflows/claude-pr-review.yml
name: Claude PR Rule Review
on:
  pull_request_target:
    types: [opened, synchronize, reopened, labeled]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      statuses: write
    steps:
      # 1. Base checkout only; omit 'ref' so it defaults to the trusted target branch
      - name: Checkout repository
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
          persist-credentials: false

      # 2. Fetch fork commit into .git object store WITHOUT checking it out to the working directory
      - name: Fetch PR head commit without checkout
        env:
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
        run: |
          git fetch origin "${BASE_SHA}" --depth=1
          git fetch "${{ github.event.pull_request.head.repo.clone_url }}" "${HEAD_SHA}":refs/remotes/pull/head --depth=1
          git cat-file -e "${HEAD_SHA}^{commit}"
          git cat-file -e "${BASE_SHA}^{commit}"

      # 3. Snapshot review rules from TRUSTED base ref into temporary quarantine folder
      - name: Snapshot trusted rules and compute PR diff
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:34:52.052Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant): Opposing directive on 'disable': candidate prescribes action ('always disable') while canonical Rule CANON-002 forbids it ('never disable'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1795858492052",
    "title": "Fork-Isolated Workflow Checkout and Execution Barrier",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet-freenet-core-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "61cfd90328eba8f8c7b4a941f8f798f5c654a3ee7a12a65eb52bc0ae92f266a1"
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
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-002 (Security and Authentication Boundary Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant): Opposing directive on 'disable': candidate prescribes action ('always disable') while canonical Rule CANON-002 forbids it ('never disable')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:34:52.052Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-002 (Security and Authentication Boundary Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-002 (Security and Authentication Boundary Invariant)",
    "Conflict with RULE-CANON-002 (Security and Authentication Boundary Invariant)"
  ],
  "missing_information": [
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "437c05f09a7b7006b3b0dff53dc7abe392c59a8d36c99da4ca8de4383c1067d2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
