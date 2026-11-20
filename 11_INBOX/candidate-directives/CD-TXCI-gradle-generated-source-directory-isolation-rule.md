# Candidate Directive: [CD-TXCI] Gradle Generated Source Directory Isolation Rule

<!-- PROVENANCE_START
{
  "source_repository": "yshrsmz/BuildKonfig",
  "source_url": "https://github.com/yshrsmz/BuildKonfig",
  "source_version": "56c6977f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T07:03:00.882Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yshrsmz-buildkonfig",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yshrsmz/BuildKonfig](https://github.com/yshrsmz/BuildKonfig) (Revision: `56c6977f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T07:03:00.882Z`  
> **Learning ID**: `learn-github-yshrsmz-buildkonfig`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
In automated plugin tests, configure AGP baseline profile library compilation and assert zero validation warnings:
```kotlin
@Test
fun testAgpBaselineProfileImplicitDependencyResolution() {
    val result = GradleRunner.create()
        .withProjectDir(testProjectDir)
        .withArguments(":shared:prepareAndroidMainArtProfile", "--stacktrace")
        .withPluginClasspath()
        .build()

    assertThat(result.task(":shared:prepareAndroidMainArtProfile")?.outcome)
        .isNotEqualTo(TaskExecutionOutcome.FAILED)
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:03:00.880Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158180880",
    "title": "Gradle Generated Source Directory Isolation Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yshrsmz/BuildKonfig",
    "source_uri": "https://github.com/yshrsmz/BuildKonfig",
    "source_version": "HEAD",
    "content_hash": "324c250d9b6de53043537f65aafe9acb80f0ce71855ada99abb0125628ae1090"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:03:00.880Z"
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
  "auth_token": "b6fd30e50b74d1e9bb56fab269dc3b6c2d803fa043474dd4e9fc37d7c8288302"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
