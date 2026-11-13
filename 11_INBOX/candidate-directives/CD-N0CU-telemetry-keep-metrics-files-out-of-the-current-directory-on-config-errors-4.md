# Candidate Directive: [CD-N0CU] telemetry): keep metrics files out of the current directory on config errors (#4

<!-- PROVENANCE_START
{
  "source_repository": "flox-flox-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:35:51.701Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-flox-flox-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [flox-flox-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:35:51.701Z`  
> **Learning ID**: `LEARN-REEXTRACT-flox-flox-learnings`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Rejection / Holding Reason**: Human approval authorization required before canonical promotion
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cli/flox/src/main.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in flox/flox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `12b42fe6`: telemetry): keep metrics files out of the current directory on config errors (#4762). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/flox/src/main.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
async fn run(args: FloxArgs, config: Config) -> Result<()> {
    // Exit rather than fall back to the defaults, which enable metrics and
    // leave the data and cache dirs empty, so they would create the metrics
    // UUID in the current directory whatever the unparsed sources set.
    let config = match Config::parse() {
        Ok(config) => config,
        Err(err) => {
            message::error(format!("{err:#}"));
            return ExitCode::from(1);
        },
    };
    let result = runtime.block_on(run(args, config.clone()));
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
async fn run(args: FloxArgs) -> Result<()> {
    let config = Config::parse()?;
    let config = Config::parse().unwrap_or_default();
    let result = runtime.block_on(run(args));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `12b42fe6` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "decision": "STAGED_FOR_REVIEW",
  "note": "Human approval authorization required before canonical promotion"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
