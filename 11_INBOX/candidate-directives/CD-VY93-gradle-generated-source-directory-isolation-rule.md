# Candidate Directive: [CD-VY93] Gradle Generated Source Directory Isolation Rule

<!-- PROVENANCE_START
{
  "source_repository": "yshrsmz-buildkonfig-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T07:04:35.242Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yshrsmz-buildkonfig-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yshrsmz-buildkonfig-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T07:04:35.242Z`  
> **Learning ID**: `LEARN-EVO-yshrsmz-buildkonfig-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When a Gradle plugin registers a task that generates source code or assets consumed by subsequent compiler tasks, the output directory MUST be isolated within a dedicated, task-unique subpath and MUST NEVER share or collide with directories inspected by analytical, packaging, or profiling tasks (such as AGP Baseline/Art Profile tasks). Furthermore, registration into source sets MUST be bound through explicit task provider outputs (`taskProvider.flatMap { it.outputDirectory }`) rather than plain file paths.

**WHY**:
Gradle 8.x+ and 9.x enforce strict task validation rules against implicit dependencies. If Task B (e.g., AGP’s `ProcessLibraryArtProfileTask` / `prepareAndroidMainArtProfile`) scans the output directory tree of Task A (e.g., `generateBuildKonfig`) without a declared task dependency (`dependsOn` or output-to-input mapping), Gradle halts execution immediately with an `Implicit dependency validation error`. Sharing root directories (e.g., `build/generated/source/...`) or overlapping directory trees causes non-deterministic build ordering and race conditions during parallel task execution.

**WHEN TO APPLY**:
Apply in any Gradle plugin (Kotlin, Java, Android, C++) that synthesizes code, manifests, or resources intended for consumption by compilers or packaging pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// In BuildKonfigPlugin.kt
val generateBuildKonfigTask: TaskProvider<BuildKonfigTask> = project.tasks.register(
    "generateBuildKonfig",
    BuildKonfigTask::class.java
) { task ->
    // Dedicated, fully isolated directory per task and sub-target
    task.outputDirectory.convention(
        project.layout.buildDirectory.dir("generated/source/buildkonfig/src")
    )
    task.packageName.set(extension.packageName)
    task.objectName.set(extension.objectName)
}

// Bind to KotlinSourceSet via TaskProvider / DirectoryProperty to register implicit task dependency correctly
kotlinExtension.sourceSets.named("commonMain").configure { sourceSet ->
    // flatMap preserves task dependency graph metadata
    sourceSet.kotlin.srcDir(
        generateBuildKonfigTask.flatMap { it.outputDirectory }
    )
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Never pass raw File, absolute String path, or shared common directory
val outputDir = File(project.buildDir, "generated/source/buildkonfig") // Broken: loses task graph metadata!
kotlinExtension.sourceSets.getByName("commonMain").kotlin.srcDir(outputDir)

// ANTI-PATTERN: Never place generated files where AGP looks for baseline profiles
task.outputDirectory.set(project.layout.buildDirectory.dir("buildkonfig/baselineProfiles")) 
// Will cause ProcessLibraryArtProfileTask to fail with implicit dependency crash!
```

**VERIFICATION METHOD**:
Run the Gradle validation build with configuration cache and strict validation enabled:
```bash
./gradlew check -Dorg.gradle.warning.mode=fail --configuration-cache --rerun-tasks
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:04:35.364Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158275364",
    "title": "Gradle Generated Source Directory Isolation Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yshrsmz-buildkonfig-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "871035206f0672270d3e3dbe45383743e6d002687e145299b8d8a8d8bb8cf61f"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:04:35.364Z"
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
  "auth_token": "78128dc334b47c763ab4023bddedec5200150642a55a48bd882d106b310a9a40"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
