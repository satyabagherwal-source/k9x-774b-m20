# Candidate Directive: [CD-744B] remove state read on IO thread

<!-- PROVENANCE_START
{
  "source_repository": "nsh07/Tomato",
  "source_url": "https://github.com/nsh07/Tomato",
  "source_version": "43897a66",
  "license": "GPL-3.0",
  "timestamp": "2026-11-15T20:22:44.123Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nsh07-tomato",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nsh07/Tomato](https://github.com/nsh07/Tomato) (Revision: `43897a66`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-15T20:22:44.123Z`  
> **Learning ID**: `learn-github-nsh07-tomato`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/settingsScreen/viewModel/SettingsViewModel.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nsh07/Tomato. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9fae625b`: concurrency): remove state read on IO thread. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/settingsScreen/viewModel/SettingsViewModel.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
import kotlinx.coroutines.withContext
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                if (deleteStats) topicRepository.deleteTopic(topic)
                else topicRepository.deleteTopicMergingStats(topic, Topic.DEFAULT_TOPIC_ID)
                val fallback = topicRepository.getTopicById(Topic.DEFAULT_TOPIC_ID) ?: defaultTopic
                if (stateRepository.currentTopicId.value == topic.id) {
                    stateRepository.setTopic(fallback)
                }
                if (_editingTopic.value.id == topic.id) setEditingTopic(fallback)
            val success = withContext(Dispatchers.IO) {
                topicRepository.updateTopic(topic)
            }
            if (!success) {
        viewModelScope.launch {
        viewModelScope.launch {
        viewModelScope.launch {
        viewModelScope.launch {
        viewModelScope.launch {
        viewModelScope.launch {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                statRepository.deleteAllStats()
            }
        minutesWriteJob = viewModelScope.launch {
            val currentInputs = minuteInputs
            viewModelScope.la
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
        viewModelScope.launch(Dispatchers.IO) {
            if (deleteStats) topicRepository.deleteTopic(topic)
            else topicRepository.deleteTopicMergingStats(topic, Topic.DEFAULT_TOPIC_ID)
            val fallback = topicRepository.getTopicById(Topic.DEFAULT_TOPIC_ID) ?: defaultTopic
            if (stateRepository.currentTopicId.value == topic.id) {
                stateRepository.setTopic(fallback)
            if (_editingTopic.value.id == topic.id) setEditingTopic(fallback)
            if (!topicRepository.updateTopic(topic)) {
        viewModelScope.launch(Dispatchers.IO) {
        viewModelScope.launch(Dispatchers.IO) {
        viewModelScope.launch(Dispatchers.IO) {
        viewModelScope.launch(Dispatchers.IO) {
        viewModelScope.launch(Dispatchers.IO) {
        viewModelScope.launch(Dispatchers.IO) {

        viewModelScope.launch(Dispatchers.IO) {

            statRepository.deleteAllStats()
        minutesWriteJob = viewModelScope.launch(Dispatchers.IO) {
            viewModelScope.launch(Dispatchers.IO) { saveMinutes(minuteInputs) }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9fae625b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T20:22:44.121Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794774164121",
    "title": "remove state read on IO thread",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nsh07/Tomato",
    "source_uri": "https://github.com/nsh07/Tomato",
    "source_version": "HEAD",
    "content_hash": "f41b87f3a6c5ffc23f450f13072866a8d13ab8d6ecd99784cf81cc60af5429e3"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T20:22:44.121Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "8ce1f5993bd14297c59e03107d86d9af9cb6a4ff82eb42198c909f08438567f6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
