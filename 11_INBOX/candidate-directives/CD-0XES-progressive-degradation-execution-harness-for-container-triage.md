# Candidate Directive: [CD-0XES] Progressive Degradation Execution Harness for Container Triage

<!-- PROVENANCE_START
{
  "source_repository": "cilium/cilium",
  "source_url": "https://github.com/cilium/cilium",
  "source_version": "d3bfd511",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T03:45:49.348Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-cilium-cilium",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium/cilium](https://github.com/cilium/cilium) (Revision: `d3bfd511`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T03:45:49.348Z`  
> **Learning ID**: `learn-github-cilium-cilium`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    
    if targetPod, err = c.Client.CreateEphemeralContainer(ctx, pod, ec); err == nil {
        pollErr := wait.PollUntilContextTimeout(ctx, 2*time.Second, 30*time.Second, false, func(ctx context.Context) (bool, error) {
            targetPod, err = c.Client.GetPod(ctx, targetPod.Namespace, targetPod.Name, metav1.GetOptions{})
            if err != nil { return false, err }
            for _, s := range targetPod.Status.EphemeralContainerStatuses {
                if s.Name == ec.Name { return s.State.Running != nil, nil }
            }
            return false, nil
        })
        if pollErr == nil {
            return targetPod, ec.Name, cleanup, nil
        }
    }

    // Tier 3: Synthetic Node-Pinned Clone Pod
    newPod := &corev1.Pod{
        ObjectMeta: metav1.ObjectMeta{
            Namespace:    pod.Namespace,
            GenerateName: "probe-rescue-",
        },
        Spec: corev1.PodSpec{
            NodeName:           pod.Spec.NodeName, // CRITICAL: Pin to identical node
            HostNetwork:        pod.Spec.HostNetwork,
            HostPID:            pod.Spec.HostPID,
            RestartPolicy:      corev1.RestartPolicyNever,
            Tolerations:        []corev1.Toleration{{Operator: corev1.TolerationOpExists}}, // Bypass taints
            Containers: []corev1.Container{{
                Name:            fromContainer.Name,
                Image:           fromContainer.Image,
                Command:         []string{"/bin/sleep", "1d"},
                VolumeMounts:    fromContainer.VolumeMounts,
                SecurityContext: fromContainer.SecurityContext,
            }},
            Volumes: pod.Spec.Volumes,
        },
    }

    targetPod, err = c.Client.CreatePod(ctx, pod.Namespace, newPod, metav1.CreateOptions{})
    if err != nil {
        return nil, "", cleanup, fmt.Errorf("all tiers failed to schedule: %w", err)
    }

    cleanup = func(cctx context.Context) error {
        return c.Client.DeletePod(cctx, targetPod.Namespace, targetPod.Name, metav1.DeleteOptions{})
    }

    return targetPod, fromContainer.Name, cleanup, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Fragile Single-Tier Execution without Cleanup
func ExecDangerous(client *kubernetes.Clientset, pod *corev1.Pod, container string) {
    // If pod is CrashLoopBackOff, this fails immediately with no triage possible
    req := client.CoreV1().RESTClient().Post().Resource("pods").SubResource("exec").
        Param("container", container)
    // No fallback, no ephemeral debug, no node-pinned pod
}
```

**VERIFICATION METHOD**:
Simulate a crushed node pod in an automated test using `client-go` testenv:
1. Set `pod.Status.ContainerStatuses[0].State.Waiting = &CrashLoopBackOff`.
2. Disable EphemeralContainers via FeatureGate mock.
3. Call `EnsureExecTarget` and assert that a new Pod with `NodeName == pod.Spec.NodeName` is spawned, ready, and subsequently cleaned up when the returned closure is called.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:45:49.347Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800749347",
    "title": "Progressive Degradation Execution Harness for Container Triage",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium/cilium",
    "source_uri": "https://github.com/cilium/cilium",
    "source_version": "HEAD",
    "content_hash": "1473bf78cbe26c8230418174482c00e6599d9ba9d6acf04ef7724ee60729941f"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:45:49.347Z"
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
  "auth_token": "79d91cc21a620414200ec5d268a889f6a841c45453a0d19ea7fc1ca9b9cd31d0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
