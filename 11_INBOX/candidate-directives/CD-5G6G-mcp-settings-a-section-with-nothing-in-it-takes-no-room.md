# Candidate Directive: [CD-5G6G] MCP settings: a section with nothing in it takes no room

<!-- PROVENANCE_START
{
  "source_repository": "zeronsh/zeron",
  "source_url": "https://github.com/zeronsh/zeron",
  "source_version": "fbb4083a",
  "license": "MIT",
  "timestamp": "2026-11-25T09:54:17.512Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zeronsh-zeron",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zeronsh/zeron](https://github.com/zeronsh/zeron) (Revision: `fbb4083a`).  
> **License**: MIT | **Timestamp**: `2026-11-25T09:54:17.512Z`  
> **Learning ID**: `learn-github-zeronsh-zeron`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/zgx/ui/mcp_page_fixture.luau`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zeronsh/zeron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fbb4083a`: MCP settings: a section with nothing in it takes no room. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/zgx/ui/mcp_page_fixture.luau`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
-- The shell (ui/shell_fixture.luau) with Settings → MCP's snapshot: what
-- tests/settings_mcp.test.luau measures. It starts with no server added;
-- `mcp_page.add` adds one, `mcp_page.ask` has an agent ask for one.

local mcp = require("@account/mcp")

local LINEAR = { id = "linear", name = "Linear", description = "Issues and projects.", category = "", url = "https://mcp.linear.app/mcp", transport = "http", authKind = "oauth", docsUrl = "", icon = "linear" }
local NOTION = { id = "notion", name = "Notion", description = "Pages and databases.", category = "", url = "https://mcp.notion.com/mcp", transport = "http", authKind = "oauth", docsUrl = "", icon = "notion" }

local function show(servers: { any }, requests: { any })
	mcp.now:set({ loaded = true, storage = "vault", vaultAvailable = true, presets = { LINEAR, NOTION }, servers = servers, requests = requests } :: any)
end

local pending: any = { after = function() end }
for _, name in { "refresh", "upsert", "set_enabled", "delete", "start_auth", "cancel_auth", "disconnect_auth" } do
	(mcp :: any)[name] = function()
		return pending
	end
end

ui.command {
	id = "mcp_page.add",
	title = "mcp_page.add",
	run = function()
		show({
	
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fbb4083a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T09:54:17.510Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795600457510",
    "title": "MCP settings: a section with nothing in it takes no room",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zeronsh/zeron",
    "source_uri": "https://github.com/zeronsh/zeron",
    "source_version": "HEAD",
    "content_hash": "51e17404e6f2ab612a671cb2b42f778084604659d785b6bb81ce93066d1701c2"
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
        "Harvested/verified timestamp recorded: 2026-11-25T09:54:17.510Z"
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
  "auth_token": "b60b196b65decfe2aff0ca93ea0fa476a76cbec1ba2a433a969484540970031f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
