# Candidate Directive: [CD-9YEI] Invariant Compilation Separation Principle (SSOT Data vs. Rendered Projections)

<!-- PROVENANCE_START
{
  "source_repository": "dkhamsing-open-source-ios-apps-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:20:27.019Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dkhamsing-open-source-ios-apps-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dkhamsing-open-source-ios-apps-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:20:27.019Z`  
> **Learning ID**: `LEARN-EVO-dkhamsing-open-source-ios-apps-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
In static compilation and documentation engines, the primary mutation surface MUST be restricted to the raw structured data source (e.g., JSON, YAML, SQLite). Rendered views (Markdown, HTML, static summaries) MUST NOT accept human contributions and MUST be marked immutable to pull requests via automated commit guards and pre-flight linters.

**WHY**:
Allowing manual updates to rendered targets (`README.md`) concurrently with structured state (`contents.json`) creates catastrophic merge divergence, two-way sync desynchronization, and silent data loss during subsequent automated regenerations.

**WHEN TO APPLY**:
Apply to any metadata repository, documentation generator, catalog, static site generator (SSG), or data registry where compiled artifacts are committed back to the repository.

**VERIFIED IMPLEMENTATION PATTERN**:
```ruby
# .github/osia_convert.rb - Deterministic markdown compilation with mutation ban warning
def generate_markdown(contents_path, output_path)
  data = JSON.parse(File.read(contents_path))
  
  header = <<~MARKDOWN
    # Open-Source iOS Apps
    
    <!-- 
    ⚠️ This README is generated, please do not update. To contribute, make changes to contents.json ⚠️ 
    https://github.com/dkhamsing/open-source-ios-apps -->
    
    A collaborative list of open-source iOS apps.
  MARKDOWN

  sorted_categories = data['categories'].sort_by { |c| c['title'].downcase }
  content_buffer = StringIO.new
  content_buffer.puts header

  sorted_categories.each do |cat|
    content_buffer.puts "\n## #{cat['title']}\n\n[back to top](#readme)\n\n"
    matching_apps = data['projects'].select { |app| app['category-ids'].include?(cat['id']) }
    matching_apps.sort_by { |a| a['title'].downcase }.each do |app|
      content_buffer.puts "- [#{app['title']}](#{app['source']}): #{app['description']}"
      content_buffer.puts "  - `#{app['tags'].join('` `')}`" if app['tags']&.any?
    end
  end

  File.write(output_path, content_buffer.string)
end
```

**NEGATIVE CONSTRAINT**:
```markdown
<!-- Anti-pattern: Allowing contributors to directly update markdown lists -->

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:20:27.113Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903627113",
    "title": "Invariant Compilation Separation Principle (SSOT Data vs. Rendered Projections)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dkhamsing-open-source-ios-apps-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "36daf7dc000765a170a9e33877430de872f4161865105062dbf70037845c43ee"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:20:27.113Z"
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
  "auth_token": "3f26888f79ddf6018ef6c4aad22701e40d66e4ff54c2aec7f4ed7dcffaaac392"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
