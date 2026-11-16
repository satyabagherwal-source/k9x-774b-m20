# Candidate Directive: [CD-4NMF] Progressive Degradation Execution Harness for Container Triage

<!-- PROVENANCE_START
{
  "source_repository": "cilium-cilium-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T03:48:43.223Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-cilium-cilium-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium-cilium-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T03:48:43.223Z`  
> **Learning ID**: `LEARN-EVO-cilium-cilium-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When an autonomous diagnostic or operational tool requires shell/binary execution inside a targeted node container, it MUST implement a 3-tier fallback ladder: (1) In-place container exec, (2) Ephemeral Debug Container attachment with shared namespaces (`TargetContainerName`), and (3) Synthetic cloned Pod injection scheduled onto the exact node (`pod.Spec.NodeName`) with identical volume mounts, host networking, and universal tolerations (`TolerationOpExists`). Every stage MUST return an idempotent, context-aware `cleanup` closure that executes even under partial failure.

**WHY**:
In critical cluster brownout conditions, the targeted container is frequently crashing or in `CrashLoopBackOff`. Relying solely on `client.Exec` fails immediately. Relying only on ephemeral containers fails if the Kubernetes API server has ephemeral containers feature-gated or disabled by admission policy. Without tier-3 synthetic pod scheduling and explicit deferred cleanup closures, nodes become polluted with zombie pods holding locked volumes, blocking CNI recovery.

**WHEN TO APPLY**:
Diagnostic daemons, live forensics agents, sysdump collectors, auto-remediation controllers, and eBPF tracing probes.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted & Adapted from cilium-cli/sysdump/k8sutils.go
func (c *Collector) EnsureExecTarget(ctx context.Context, pod *corev1.Pod, container string) (
    targetPod *corev1.Pod,
    targetContainer string,
    cleanup func(context.Context) error,
    err error,
) {
    cleanup = func(_ context.Context) error { return nil }

    // Tier 1: Target container is active
    for _, status := range pod.Status.ContainerStatuses {
        if status.Name == container && status.State.Running != nil {
            return pod, container, cleanup, nil
        }
    }

    // Tier 2: EphemeralContainer injection
    var fromContainer *corev1.Container
    for _, cs := range pod.Spec.Containers {
        if cs.Name == container {
            fromContainer = cs.DeepCopy()
            break
        }
    }
    if fromContainer == nil {
        return nil, "", cleanup, fmt.Errorf("container %s missing from spec", container)
    }

    ec := &corev1.EphemeralContainer{
        EphemeralContainerCommon: corev1.EphemeralContainerCommon{
            Name:            fmt.Sprintf("probe-%d", time.Now().UnixNano()),
            Image:           fromContainer.Image,
            Command:         []string{"/bin/sleep", "1d"},
            VolumeMounts:    fromContainer.VolumeMounts,
            SecurityContext: fromContainer.SecurityContext,
        },
        TargetContainerName: fromContainer.Name,
    }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:48:43.286Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800923286",
    "title": "Progressive Degradation Execution Harness for Container Triage",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium-cilium-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c888f552667787a51c0dc81d48d6c44acf576e0ff54c76bb017fde30007196ea"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:48:43.286Z"
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
  "auth_token": "d08dad61942ef6c68ec4a73294bda31f0c31eb31d6e6227c5b1dd439850a6e35"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
