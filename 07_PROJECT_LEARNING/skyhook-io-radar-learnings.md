# Forensic Learning Record (Deep Inspection): skyhook-io/radar

> **Canonical Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:37:35.049Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3558 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.design-sync/previews/AgentControls.tsx`
```
import { useState } from 'react'
import { AgentControls } from '@skyhook-io/k8s-ui'

const wrap = { width: 380, padding: 12 }

const claude = {
  name: 'claude', label: 'Claude Code', path: '/opt/homebrew/bin/claude', version: '2.1.4',
  present: true, supported: true, profiles: ['safeguarded', 'full-local'] as const,
}
const codex = {
  name: 'codex', label: 'Codex', path: '/usr/local/bin/codex', version: '0.46.0',
  present: true, supported: true, profiles: ['safeguarded', 'full-local'] as const,
}
const cursor = {
  name: 'cursor-agent', label: 'Cursor', path: '/usr/local/bin/cursor-agent', version: '2025.10.2',
  present: true, supported: true, profiles: ['full-local'] as const,
}
const agents = [claude, codex, cursor].map((a) => ({ ...a, profiles: [...a.profiles] }))

function Controls({ agent, profile, model = '', effort = '' }: { agent: string; profile: 'safeguarded' | 'full-local'; model?: string; effort?: string }) {
  const [a, setA] = useState(agent)
  const [p, setP] = useState(profile)
  const [m, setM] = useState(model)
  const [e, setE] = useState(effort)
  return (
    <div style={wrap}>
      <AgentControls
        agents={agents}
        selectedAgent={a}
        onSelectAgent={(v) => { setA(v); setM(''); setE('') }}
        profile={p}
        onSetProfile={setP}
        model={m}
        onSetModel={setM}
        effort={e}
        onSetEffort={setE}
      />
    </div>
  )
}

export function ClaudeSafeguarded() {
  return <Controls agent="claude" profile="safeguarded" model="sonnet" />
}

export function CodexFullLocal() {
  return <Controls agent="codex" profile="full-local" model="gpt-5-codex" effort="high" />
}

export function CursorOnlyFullLocal() {
  return <Controls agent="cursor-agent" profile="full-local" />
}

```

### Core Architecture Module: `.design-sync/previews/AlertBanner.tsx`
```
import { AlertBanner } from '@skyhook-io/k8s-ui'
import { ShieldAlert } from 'lucide-react'

const wrap = { width: 480 }

export function Variants() {
  return (
    <div style={wrap}>
      <AlertBanner
        variant="error"
        title="Gateway Not Accepted"
        message={<><span className="font-medium">InvalidParameters: </span>GatewayClass "istio" does not support listener protocol UDP.</>}
      />
      <AlertBanner
        variant="warning"
        title="Gateway Not Programmed"
        message={<><span className="font-medium">Pending: </span>Waiting for the load balancer address to be assigned.</>}
      />
      <AlertBanner variant="info" title="Suspended" message="Reconciliation is paused; changes in Git will not be applied until resumed." />
      <AlertBanner variant="success" title="Workflow Completed Successfully" />
    </div>
  )
}

export function WithItems() {
  return (
    <div style={wrap}>
      <AlertBanner
        variant="error"
        title="Backup Failed"
        items={[
          'Invalid included/excluded namespace lists: namespace "paymnts" not found',
          'BackupStorageLocation "aws-us-east-1" is unavailable',
        ]}
      />
    </div>
  )
}

export function CustomIcon() {
  return (
    <div style={wrap}>
      <AlertBanner
        variant="warning"
        icon={ShieldAlert}
        title="Policy violations in payments"
        message="3 resources fail require-requests-limits. Admission is set to Audit, so they were not blocked."
      />
    </div>
  )
}

```

### Core Architecture Module: `.design-sync/previews/AllClearCard.tsx`
```
import { AllClearCard } from '@skyhook-io/k8s-ui'

const wrap = { width: 540, padding: 8 }
const noop = () => {}

export function NoProblemFound() {
  return (
    <div style={wrap}>
      <AllClearCard
        animate={false}
        showDisclaimer
        coverageLimited={false}
        evidenceConflict={false}
        diagnosis={{
          healthy: true,
          rootCause: '',
          report: 'All 3 replicas of `payments/checkout-api` are Ready, no restarts in the last 6h, and recent logs show only request traffic.',
          remediation: [],
        }}
      />
    </div>
  )
}

export function CoverageLimited() {
  return (
    <div style={wrap}>
      <AllClearCard
        animate={false}
        showDisclaimer
        coverageLimited
        evidenceConflict={false}
        diagnosis={{
          healthy: true,
          rootCause: '',
          report: 'Pods are Running and Ready; events show no warnings. Logs could not be read (403 on `pods/log`).',
          remediation: [],
        }}
      />
    </div>
  )
}

export function EvidenceConflict() {
  return (
    <div style={wrap}>
      <AllClearCard
        animate={false}
        showDisclaimer
        coverageLimited={false}
        evidenceConflict
        diagnosis={{
          healthy: true,
          rootCause: '',
          report: 'The Deployment reports 3/3 available replicas and the rollout completed.',
          remediation: [],
        }}
      />
    </div>
  )
}

export function StoryWithSignals() {
  return (
    <div style={wrap}>
      <AllClearCard
        animate={false}
        showDisclaimer
        coverageLimited={false}
        evidenceConflict={false}
        onRevealSource={noop}
        diagnosis={{
          healthy: true,
          summary: 'checkout-api is healthy — the restarts you saw were a one-off node drain this morning.',
          certainty: 'established',
          rootCause: '',
          report: 'All replicas are Ready. [[radar:evidence=1]]',
          remediation: [],
        }}
        healthSignals={[
          { title: 'Pod checkout-api-7d9f8c6b5-x2kqp restarts', status: 'explained', sourceId: 's1', claim: 'the 2 restarts at 06:12 line up with node ip-10-0-3-41 draining; none since.' },
          { title: 'Warning event FailedScheduling', status: 'unaddressed', sourceId: 's2' },
        ]}
      />
    </div>
  )
}

```

### Core Architecture Module: `.design-sync/previews/AnalysisStory.tsx`
```
import { AnalysisStory, EvidenceCard, RuledOutBlock } from '@skyhook-io/k8s-ui'

// Investigation of Deployment payments/checkout-api crash-looping after the
// v2.15.0 rollout. Shapes match what Radar's evidence projection produces
// from the agent's diagnose / get_pod_logs / get_resource calls.
const POD = 'checkout-api-7d9f8c6b5-x2kqp'
const TARGET = 'deployment payments/checkout-api'

function source(stepId: string, tool: string, args: object, order: number, primaryGroupId: string | undefined, evidenceRef: string) {
  return {
    id: `turn-0-step-${stepId}`, turnIndex: 0, timelineIndex: order, stepId, tool, args: JSON.stringify(args),
    order, phase: 'initial' as const, confirmedSuccess: true, evidenceRef, primaryGroupId,
  }
}
function group(id: string, kind: string, source: ReturnType<typeof source>, o: Record<string, unknown>) {
  const observation = { source, revision: 1, historical: false, changedFromPrevious: false, ...o } as any
  return { id, identity: id, kind, historical: false, firstOrder: source.order, observations: [observation], latest: observation, chronologicalLatest: observation } as any
}

const diagnoseCall = source('diag-1', 'diagnose', { kind: 'deployment', namespace: 'payments', name: 'checkout-api' }, 0, 'evidence-issue-crashloop', 'ev_diag1')
const logsCall = source('logs-1', 'get_pod_logs', { namespace: 'payments', name: POD, container: 'checkout-api', previous: true, tail_lines: 100 }, 1, 'evidence-logs-previous', 'ev_logs1')
const nodeCall = source('node-1', 'get_resource', { kind: 'node', name: 'ip-10-0-3-41.ec2.internal' }, 2, 'evidence-node', 'ev_node1')

const issueGroup = group('evidence-issue-crashloop', 'issue', diagnoseCall, {
  tier: 'key', tone: 'error', relevance: 'target', title: 'CrashLoopBackOff',
  summary: '3/3 pods of checkout-api are in CrashLoopBackOff (container checkout-api restarted 14 times).',
  data: { type: 'issue', relevance: 'target', issue: {
    id: 'issue-checkout-crash', severity: 'critical', source: 'problem', category: 'crashloop', category_group: 'runtime', grouping_scope: 'workload',
    kind: 'Deployment', group: 'apps', namespace: 'payments', name: 'checkout-api', reason: 'CrashLoopBackOff',
    message: '3/3 pods of checkout-api are in CrashLoopBackOff (container checkout-api restarted 14 times).',
  } },
})
const deploymentGroup = group('evidence-deployment', 'resource', diagnoseCall, {
  tier: 'supporting', relevance: 'target', tone: 'error', title: 'Deployment payments/checkout-api', summary: '0/3 replicas ready',
  data: { type: 'resource', warnings: [],
    resource: { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { namespace: 'payments', name: 'checkout-api' }, spec: { replicas: 3 }, status: { replicas: 3, readyReplicas: 0, unavailableReplicas: 3 } },
    resourceContext: { tier: 'diagnostic', issueSummary: { count: 1, highestSeverity: 'critical', topReason: 'CrashLoopBackOff' }, workloadSummary: { replicas: { desired: 3, ready: 0, available: 0, unavailable: 3 } } },
  },
})
const crashGroup = group('evidence-crash-oomkilled', 'crash', diagnoseCall, {
  tier: 'key', relevance: 'producer-related', tone: 'error', title: 'checkout-api OOMKilled',
  summary: 'INFO  c.a.checkout.cache.ProductCache - warming product cache (48,210 SKUs)',
  data: { type: 'crash', namespace: 'payments', crash: {
    pods: [POD, 'checkout-api-7d9f8c6b5-m4v7t', 'checkout-api-7d9f8c6b5-zq8wn'], container: 'checkout-api', state: 'terminated', reason: 'OOMKilled', exitCode: 137,
    logLine: 'INFO  c.a.checkout.cache.ProductCache - warming product cache (48,210 SKUs)', logSource: 'previous', logLineSelection: 'log_tail',
  } },
})
const eventsGroup = group('evidence-events', 'events', diagnoseCall, {
  tier: 'supporting', relevance: 'producer-related', tone: 'warning', title: 'Kubernetes events',
  summary: `BackOff: Back-off restarting failed container checkout-api in pod ${POD} · 2 event groups · ${TARGET}`,
  data: { type: 'events', scope: TARGET, events: [
    { reason: 'BackOff', message: `Back-off restarting failed container checkout-api in pod ${POD}`, type: 'Warning', count: 14, lastTimestamp: '2026-09-28T09:41:12Z' },
    { reason: 'Pulled', message: 'Container image "ghcr.io/acme/checkout-api:v2.15.0" already present on machine', type: 'Normal', count: 15, lastTimestamp: '2026-09-28T09:40:31Z' },
  ] },
})
const changesGroup = group('evidence-changes', 'changes', diagnoseCall, {
  tier: 'context', relevance: 'producer-related', tone: 'info', title: 'Recent changes', summary: `1 change · ${TARGET}`,
  data: { type: 'changes', scope: TARGET, subject: { kind: 'Deployment', namespace: 'payments', name: 'checkout-api' }, changes: [
    { kind: 'Deployment', namespace: 'payments', name: 'checkout-api', changeType: 'update', timestamp: '2026-09-28T09:12:04Z', summary: 'image ghcr.io/acme/checkout-api:v2.14.1 → v2.15.0' },
  ] },
})
const logsGroup = group('evidence-logs-previous', 'logs', logsCall, {
  tier: 'context', relevance: 'broader', tone: 'neutral', title: `Previous logs · ${POD} / checkout-api`, summary: '3 selected lines',
  data: { type: 'logs', pod: POD, container: 'checkout-api', namespace: 'payments', previous: true, warnings: [], logs: {
    lines: [
      '2026-09-28T09:40:52Z INFO  o.s.b.StartupInfoLogger - Starting CheckoutApplication v2.15.0 using Java 21.0.4',
      '2026-09-28T09:41:05Z INFO  c.a.checkout.cache.ProductCache - warming product cache (48,210 SKUs)',
      '2026-09-28T09:41:09Z WARN  c.a.checkout.cache.ProductCache - heap usage 238Mi / 256Mi during warm-up',
    ], totalLines: 100, matchedLines: 3, fallback: false,
  } },
})
const nodeGroup = group('evidence-node', 'resource', nodeCall, {
  tier: 'context', relevance: 'broader', tone: 'neutral', title: 'Node ip-10-0-3-41.ec2.internal',
  data: { type: 'resource', warnings: [], resource: { apiVersion: 'v1', kind: 'Node', metadata: { name: 'ip-10-0-3-41.ec2.internal' }, status: {
    conditions: [
      { type: 'MemoryPressure', status: 'False', reason: 'KubeletHasSufficientMemory', message: 'kubelet has sufficient memory available' },
      { type: 'Ready', status: 'True', reason: 'KubeletReady', message: 'kubelet is posting ready status' },
    ],
    allocatable: { cpu: '3920m', memory: '14.2Gi' },
  } } },
})

// The agent's case: each cited result with its role, bound to one card.
const evidence = [
  { status: 'linked' as const, ref: 'ev_diag1', role: 'cause' as const, claim: 'Every pod is OOMKilled (exit 137) ~40s after start — the 256Mi limit is hit during cache warm-up.', subject: { kind: 'Deployment', namespace: 'payments', name: 'checkout-api', observation: 'crash' } },
  { status: 'linked' as const, ref: 'ev_logs1', role: 'symptom' as const, claim: 'The log ends mid warm-up with heap at 238Mi of 256Mi — no application error.', gap: 'Only the last 100 lines of the previous container were read.' },
  { status: 'linked' as const, ref: 'ev_diag1', role: 'context' as const, claim: 'The crash loop began after the v2.15.0 rollout, which added the in-memory product cache.', subject: { kind: 'Deployment', namespace: 'payments', name: 'checkout-api', observation: 'changes' } },
  { status: 'linked' as const, ref: 'ev_node1', role: 'rules_out' as const, claim: 'The node reports MemoryPressure=False with 14.2Gi allocatable, so this is not node-level eviction.' },
]
const cardItem = (index: number, g: any) => {
  const { status: _s, ref: _r, ...rest } = evidence[index]
  return { index, ...rest, source: g.latest.source, placement: 'card' as const, groupId: g.id, observation: g.latest } as any
}
const caseItems = [cardItem(0, crashGroup), cardItem(1, logsGroup), cardItem(2, changesGroup), cardItem(3, nodeGroup)]
const investigationCase = {
  items: caseItems,
  ruledOut: [{ hypothesis: 'Node memory pressure is evicting the pods', item: caseItems[3] }],
}
const report = [
  'Every checkout-api pod is killed by the kernel about 40 seconds after it starts. The container’s last state is **OOMKilled** with exit cod
```

### Core Architecture Module: `.design-sync/previews/ApplyDialog.tsx`
```
import { ApplyDialog } from '@skyhook-io/k8s-ui'

const noop = () => {}

const fix = 'Raise the memory limit on the `checkout-api` container from 256Mi to 512Mi:\n\n```\nkubectl -n payments set resources deployment/checkout-api -c checkout-api --limits=memory=512Mi\n```'

export function RecommendedFix() {
  return (
    <ApplyDialog
      open
      onClose={noop}
      onConfirm={noop}
      agentLabel="Claude Code"
      resourceLabel="Deployment payments/checkout-api"
      context="gke_acme-prod_us-east1_prod-cluster-us-east1"
      fix={fix}
      reason="the container is OOMKilled at its 256Mi limit within a minute of each start; raising the limit stops the restarts without touching application code."
      precondition="the node pool has at least 512Mi allocatable per replica"
      confidence={0.86}
    />
  )
}

export function GitOpsManaged() {
  return (
    <ApplyDialog
      open
      onClose={noop}
      onConfirm={noop}
      agentLabel="Codex"
      resourceLabel="Deployment payments/checkout-api"
      context="kind-radar-gitops-demo"
      fix={'Point the image back to the last tag that pulled successfully:\n\n```\nkubectl -n payments set image deployment/checkout-api checkout-api=ghcr.io/acme/checkout-api:v2.14.1\n```'}
      managedBy="Argo CD"
      confidence={0.42}
    />
  )
}

```

### Core Architecture Module: `.design-sync/previews/ApplyOutcomeCard.tsx`
```
import { ApplyOutcomeCard } from '@skyhook-io/k8s-ui'

const wrap = { width: 480, padding: 8 }
const noop = () => {}

export function Confirmed() {
  return (
    <div style={wrap}>
      <ApplyOutcomeCard
        animate={false}
        applyOutcome="confirmed"
        onCheckStatus={noop}
        diagnosis={{
          rootCause: 'Memory limit raised',
          report: 'Patched `deployment/checkout-api` in `payments`: memory limit on container `checkout-api` is now **512Mi**. A new ReplicaSet `checkout-api-6b7f9d8c4` is rolling out.',
          remediation: [],
        }}
      />
    </div>
  )
}

export function Failed() {
  return (
    <div style={wrap}>
      <ApplyOutcomeCard
        animate={false}
        applyOutcome="failed"
        error={'deployments.apps "checkout-api" is forbidden: User "dev@acme.io" cannot patch resource "deployments" in API group "apps" in the namespace "payments"'}
        diagnosis={{ rootCause: '', report: '', remediation: [] }}
      />
    </div>
  )
}

export function Unknown() {
  return (
    <div style={wrap}>
      <ApplyOutcomeCard
        animate={false}
        applyOutcome="unknown"
        onCheckStatus={noop}
        diagnosis={{ rootCause: '', report: '', remediation: [] }}
      />
    </div>
  )
}

```

### Core Architecture Module: `.design-sync/previews/AreaChart.tsx`
```
import { AreaChart } from '@skyhook-io/k8s-ui'

const box = { width: 480, height: 220, padding: 8 }
const BASE = 1720180800
const N = 32

export function CpuWithLimits() {
  const dataPoints = Array.from({ length: N }, (_, i) => ({
    timestamp: BASE + i * 60,
    value: 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(i / 4)) + (i > 20 ? (i - 20) * 0.01 : 0),
  }))
  return (
    <div style={box}>
      <AreaChart
        series={[{ labels: { pod: 'checkout-7d9f8c-4tzkg' }, dataPoints }]}
        color="#3b82f6"
        fillColor="#3b82f622"
        unit="cores"
        referenceLines={[
          { value: 0.1, label: 'request 100m', kind: 'request' },
          { value: 0.5, label: 'limit 500m', kind: 'limit' },
        ]}
      />
    </div>
  )
}

export function MemoryMultiPod() {
  const MiB = 1048576
  const pods = [
    { pod: 'api-6b4c9d-2xq7v', base: 214, amp: 42 },
    { pod: 'api-6b4c9d-7m4kf', base: 268, amp: 56 },
    { pod: 'api-6b4c9d-9plzc', base: 176, amp: 30 },
  ]
  const series = pods.map(({ pod, base, amp }, s) => ({
    labels: { pod },
    dataPoints: Array.from({ length: N }, (_, i) => ({
      timestamp: BASE + i * 60,
      value: (base + amp * (0.5 + 0.5 * Math.sin(i / 5 + s * 1.3))) * MiB,
    })),
  }))
  return (
    <div style={box}>
      <AreaChart series={series} color="#10b981" fillColor="#10b98122" unit="bytes" />
    </div>
  )
}

```

### Core Architecture Module: `.design-sync/previews/Badge.tsx`
```
import { Badge } from '@skyhook-io/k8s-ui'

const row = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } as const

export function Severities() {
  return (
    <div style={row}>
      <Badge severity="success">Healthy</Badge>
      <Badge severity="info">Syncing</Badge>
      <Badge severity="warning">Warning</Badge>
      <Badge severity="alert">Degraded</Badge>
      <Badge severity="error">Failed</Badge>
      <Badge severity="neutral">Unknown</Badge>
    </div>
  )
}

export function ResourceKinds() {
  return (
    <div style={row}>
      <Badge kind="Deployment">Deployment</Badge>
      <Badge kind="Pod">Pod</Badge>
      <Badge kind="Service">Service</Badge>
      <Badge kind="Ingress">Ingress</Badge>
      <Badge kind="ConfigMap">ConfigMap</Badge>
      <Badge kind="Secret">Secret</Badge>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={row}>
      <Badge severity="success" size="sm">sm</Badge>
      <Badge severity="success" size="default">default</Badge>
    </div>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1870** (2026-09-25): **Traffic: Istio not detected when istiod uses a revisioned name (e.g. istiod-1-30-1)**
  *Symptoms*: Moved from discussion #1765. Thanks @Svm1905 for the clear diagnosis there.  ## Summary  The Traffic view doesn't detect Istio when the `istiod` control plane uses a **revisioned** Deployment name such as `istiod-1-30-1`, the standard pattern for Istio canary / revision-based upgrades. The mesh is healthy and `istio_requests_total` is in Prometheus, but Radar reports Istio as not detected and recommends installing Caretta instead.  ## Cause  `IstioSource.Detect()` in `internal/traffic/istio.go` looks for `istiod` by an exact Deployment name across a fixed list of namespaces:  ```go const istiodName = "istiod" var istioNamespaces = []string{"istio-system", "istio", "default"} ... deploy, err := s.k8sClient.AppsV1().Deployments(ns).Get(ctx, istiodName, metav1.GetOptions{}) ```  On a revisioned install that `Get` returns NotFound in every namespace, so the source ends up `Available: false`. Downstream, the Istio branch of `generateRecommendation` (`internal/traffic/manager.go`) only fires for a detected source, so the user falls through to the CNI-based recommendation (Caretta).  Once detection passes, `GetFlows()` already works against the existing Prometheus metrics. The reporter confirmed this with direct PromQL. So the fix is detection only.  ## Desired behavior  Detect `istiod` by **label** instead of exact name, keeping today's behavior for default installs:  - In each candidate namespace, **list** Deployments with the label selector `app=istiod`. Istio's chart sets this l

- **Issue #1651** (2026-09-22): **Node debug: closing a terminal must clean up only its own pod**
  *Symptoms*: ## Problem  Closing one node-debug terminal can terminate another person's debug session on the same node. Each terminal creates its own privileged debug pod, but cleanup deletes every Radar debug pod labeled for that node.  Cleanup also races with pod creation: closing a tab while creation is pending can run cleanup before the pod exists, then leave the newly created pod behind. A delayed cleanup after a kubeconfig context switch can target debug pods for an identically named node in the newly active cluster.  This is a session-isolation and cleanup bug. The goal is that a terminal cleans up only the exact pod it created.  ## Current behavior  Verified in the current code on September 6, 2026:  - `pkg/k8score/node_debug.go`: `CreateNodeDebugPod` returns pod name, namespace, container name, and node name, but not the created pod's UID. `DeleteNodeDebugPods` calls `DeleteCollection` for both current and legacy node-debug label selectors. - `internal/server/exec.go`: `POST /api/nodes/{name}/debug` creates the pod and waits up to 60 seconds for Running before responding. `DELETE` on that route identifies cleanup only by node name. - `packages/k8s-ui/src/components/dock/NodeTerminalTab.tsx`: unmount and page-unload cleanup use the node name; creation may resolve after unmount. - `web/src/components/dock/NodeTerminalTab.tsx`: wraps these operations in HTTP calls, with `keepalive` for cleanup.  ### Reproduction  On a disposable cluster that permits node-debug pods:  1. Open Radar i
  **Post-Mortem & Fix Analysis**:
  > Hi @nadaverell, I'd like to work on this issue.  I've reviewed the required behavior and plan to keep the change scoped to per-terminal pod identity:  - return and retain the created pod's namespace, name, and UID; - replace interactive `DeleteCollection` cleanup with exact-name deletion using a UID precondition; - reject cleanup when identity is missing, treat `NotFound` as idempotent success, and leave UID conflicts untouched; - handle pod creation resolving after terminal unmount with exactly-once cleanup; - add backend and frontend regression tests, then run the two-session smoke test on a disposable kind cluster.  If that direction looks right, could you assign the issue to me?
  > Hi @jjj-n sorry for the delay, I've been swamped with some critical things to get out the door for v1.14 (check out the new stuff! https://radarhq.io/changelog) and some other matters.  As for the plan - looks right, go ahead. couple of notes: - the DELETE route currently carries only the node name, so add the pod's namespace/name/UID as path/query params rather than a DELETE body - the Retry button re-runs createPod, so tie the once-only cleanup to each creation result, not to the component instance.  Thanks for picking this up!

- **Issue #1647** (2026-09-12): **Fix topology sidebar counts when a namespace is selected**
  *Symptoms*: ## Problem  When a user selects one or more namespaces in Topology, the graph is filtered to that scope but the adjacent **Filters** sidebar still receives the raw topology. Its kind rows and counts therefore describe the cluster-wide stream rather than what is on the canvas — for example, it can show `Ingress (12)` even when the selected namespace has no Ingresses.  ## Expected behavior  The sidebar should describe the same namespace-scoped topology the user is viewing.  - Count and list kinds from the namespace-filtered node set. - Retain cluster-scoped nodes with no namespace (for example Nodes, PersistentVolumes, and Namespaces), because they remain visible in every namespace scope. - Use the pause-buffered `displayedTopology`, so sidebar counts stay frozen while the graph is paused. - Filter by namespace only before passing nodes to the sidebar. Do **not** pass the already kind-filtered graph nodes: the sidebar needs the full scoped set to calculate its visible/hidden counts correctly.  ## Where to look  - `web/src/App.tsx`: `filteredTopology` already demonstrates the required namespace carve-out; `TopologyFilterSidebar` is currently passed raw `topology?.nodes`. - `packages/k8s-ui/src/components/topology/TopologyFilterSidebar.tsx`: derives the displayed kinds and counts solely from its `nodes` prop.  ## Acceptance criteria  With a namespace selected, the graph and sidebar agree on which kinds exist and their counts. Changing the selected namespace updates the sidebar ac

- **Issue #1616** (2026-09-04): **Scrolling moves the whole UI layout beyond its intended limits**
  *Symptoms*: When there's an element in the UI that requires scrolling (Eg: the logs, the pod drawer), scrolling continues beyond the limits of the UI.  I'm using Firefox on MacOS.  You can see the issue in the screenshot. The yellow scrollbar is from the drawer and then there's another red one created fro the whole page that scrolls beyond the content.  This is not a new issue, I've been having this for a few versions back.  <img width="3892" height="1473" alt="Image" src="https://github.com/user-attachments/assets/c45c79fb-27d9-4f28-be29-f954f7a46f05" />

- **Issue #1511** (2026-08-30): **Radar fails to download file from pod**
  *Symptoms*: ## Describe the bug  Radar app&desktop fails to download a large file ~250MB from the pod.  In smaller files download works fine.  ## To reproduce  Steps to reproduce the behavior:  1. on Resources tab choose a pod 2. Click on 'Browse files' 3. File explorer opens 4. Go to the folder where the csv file is 5. Click on 'Download file' 6. File is not downloaded  ## Expected behavior  The csv file should be downloaded.  ## Logs  ``` 2026/08/27 13:06:56 [copy] Failed to read file from tar <namespace>/<pod>: unexpected EOF 2026/08/27 13:06:56 "GET http://localhost:9280/api/pods/<namespace>/<pod>/files/download?container=<container>&path=%2Foutput%2Fdata_2026-08-27T10%3A02%3A03.511991310Z.csv HTTP/1.1" from 127.0.0.1:50126 - 500 73B in 32.211367041s ```  ## Additional context  If debug logs are needed i can provide them

- **Issue #1473** (2026-08-27): **In-cluster multi-cluster + OIDC: pod log EventSource stays pending (0 B); static /logs works**
  *Symptoms*: With Radar deployed in-cluster on one EKS cluster and a remote cluster connected via kubeconfig + ServiceAccount token, the pod log UI opens an EventSource to /api/pods/.../logs/stream but the request stays pending with 0 B transferred. The log panel shows “Loading logs…” indefinitely.  Static log fetch works: opening /api/pods/{ns}/{pod}/logs?container=...&tailLines=10 returns JSON with log lines.  Same behavior on Radar 1.8.7 and 1.11.0.   Radar image | ghcr.io/skyhook-io/radar:1.8.7 and 1.11.0  Deploy | In-cluster Helm (skyhook/radar), OIDC (Azure AD) Host cluster | EKS (cwcloudplatform) Remote cluster | EKS (cwcmddev), via mounted kubeconfig Secret Remote auth | SA radar-readonly in radar-agent + ClusterRole view + impersonator RBAC Azure users | Impersonated via OIDC groups → view bindings Ingress | AWS ALB (idle_timeout.timeout_seconds=3600, HTTP/2 enabled)  Regression / timing notes Issue worsened after gitops change to long-lived SA token Secret (kubernetes.io/service-account-token). Root cause was often stale token in GitLab → SM → radar-kubeconfigs (fixed by syncing token). After token sync, static /logs works but stream still pending. Upgrading to 1.11.0 did not fix streaming; fresh pod correctly connects to remote cluster but stream behavior unchanged. Deleting/recreating radar-readonly-token Secret causes brief UI flicker then failure again until token is re-synced to host kubeconfig.
  **Post-Mortem & Fix Analysis**:
  > Should be fixed by #1517 - flagging up front that we couldn't reproduce your exact setup (in-cluster + OIDC + ALB + remote kubeconfig), so this is our best read of the cause. The stream handler wasn't flushing anything until the follow stream opened, so a buffering proxy like your ALB would hold the empty response and the EventSource would never open. The fix flushes the `connected` event first, before that call.  Merged to main, should go out in the next release. When it lands, can you confirm it clears up in your ALB/OIDC setup? 

- **Issue #1334** (2026-08-10): **Edit → Cut and Edit → Copy do nothing on Windows**
  *Symptoms*: ## Describe the bug  In the desktop app on Windows, the **Edit → Cut** and **Edit → Copy** menu items do nothing at all. Clicking them has no effect: the clipboard is not written and a selection is not removed.  `Ctrl+C` / `Ctrl+X` still work, because `web/src/main.tsx` has its own `keydown` listener that handles them (it checks `e.ctrlKey`, not just `e.metaKey`). Only the menu items are dead.  The cause is that both items are registered with a `nil` callback:  ```go editMenu.AddText("Cut", keys.CmdOrCtrl("x"), nil) editMenu.AddText("Copy", keys.CmdOrCtrl("c"), nil) ```  A `nil` callback is intentional on macOS — it delegates to the native responder chain. There is no equivalent off macOS. Wails only binds a handler when `Click != nil` (`internal/frontend/desktop/windows/menu.go`):  ```go if menuItem.Click != nil {     newItem.OnClick().Bind(func(e *winc.Event) { ... }) } ```  and firing an unbound event is a no-op (`winc/eventmanager.go`):  ```go func (evm *EventManager) Fire(arg *Event) {     if evm.handler != nil {         evm.handler(arg)     } } ```  So on Windows the menu entries are wired to nothing.  This is separate from #1276. That one is Paste inserting twice; this one is Cut/Copy doing nothing.  ## To reproduce  Steps to reproduce the behavior:  1. Run Radar Desktop on Windows 2. Select some text — for example in the resource search box, or in the Monaco YAML editor 3. Click **Edit → Copy** in the menu bar 4. Paste somewhe
  **Post-Mortem & Fix Analysis**:
  > Thanks, labelled and assigned. Your fix in #1336 is queued for review. 

- **Issue #1295** (2026-08-24): **UI movement on select**
  *Symptoms*: ## Describe the bug  UI elements moves on select/deselect  ## To reproduce  Steps to reproduce the behavior:  1. Open configmap list 2. Left click on any, look closely at app title and namespace column 3. It moves few pixels to the left and back  This is not limited to configmap view, it happens on all objects  ## Expected behavior  Elements should stay where they are  ## Diagnostics (optional)  - Radar version: desktop 1.8.6 
  **Post-Mortem & Fix Analysis**:
  > thanks for reporting! and sorry it took a while - fixed now

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `0c2e7adb` (2026-09-30)
**Commit Message**: Slim CLAUDE.md and fix stale agent guidance (#1945)

## Summary

`CLAUDE.md` is loaded into every agent session on this repo. It had
grown to 45.6K chars, several of its claims were stale, and many docs
agents need had no pointer from it.

This PR:
1. **Trims** the always-loaded content that restates code or duplicates
`docs/` and handler comments.
2. **Makes the routing table the index** for every area whose depth
lives elsewhere. Agents have to read the matching row before editing, so
moving detail out of CLAUDE.md doesn't hide it.
3. **Fixes** stale claims, including two stale security comments in code
that CLAUDE.md now points agents to.

The size goes from 45.6K to 41.8K. The trim alone reached −21%; most of
that was spent back on routing rows, on purpose: the goal was to move
per-area depth where agents will still find it, not to hide it. Security
gates, CI-enforced checklists, library-consumer contracts and build
traps all stay always-loaded.

The work was reviewed with a second model over three rounds: independent
cut lists, then reconciliation, then adversarial "what did we lose / is
this true" passes. Every finding was verified against the code before it
was applied.

## 

**File**: `CLAUDE.md` (modified, +55/-111)
```diff
@@ -1,7 +1,5 @@
 # CLAUDE.md
 
-This file provides guidance to Claude Code (claude.ai/code) when working with this repository.
-
 ## Project Overview
 
 Radar is a modern Kubernetes visibility tool — local-first, no account required, no cloud dependency, fast. It provides topology visualization, event timeline, service traffic maps, resource browsing, Helm management, cluster audit (best-practices scanning), and Kubernetes upgrade impact analysis. Runs as a kubectl plugin (`kubectl-radar`) or standalone binary and opens a web UI in the browser. Open source, free forever. Built by Skyhook.
@@ -20,68 +18,52 @@ Radar is a modern Kubernetes visibility tool — local-first, no account require
 
 ## Reference Docs — MUST READ before making changes
 
-Not everything is in this file. The following files contain critical details that are **not duplicated here**. You MUST read them when working in the relevant area — do not guess or rely on memory.
+Not everything is in this file. The following files contain critical details that are **not duplicated here** — this file keeps the cross-cutting rules; per-area depth (gating rationale, lifecycle rules, scope semantics) lives in the files below. You MUST read the matching row's files **before editing** in that area — do not guess or rely on memory. If your area has no row, the handler's or package's own doc comments are the spec; read them first.
 
 | When you are... | Read this file FIRST |
 |-----------------|---------------------|
-| Adding or modifying **HTTP endpoints** | `internal/server/server.go` — all routes are defined here |
+| Adding or modifying **HTTP endpoints** | `internal/server/server.go` — all routes are defined here — **plus** the handler's doc comments (why the route is gated the way it is lives there; copy the gate of the closest sibling only after reading it) and the integration's section in [docs/integrations.md](docs/integrations.md) |
 | Adding or modifying **CLI flags** | `cmd/explorer/main.go` — flag definitions and defaults |
 | Adding a **new CRD integration** (renderer, topology, discovery) | [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md) — full checklist with collision gotchas |
 | Working on **local per-cluster integration settings** (Metrics, Argo CD, Cost in `~/.radar/clusters.json`) | [docs/configuration.md](docs/configuration.md#local-integration-connections) — store `internal/config/profiles.go`, resolve/update `internal/connections`, activation `internal/connectionruntime`, routes `GET/PUT /api/integrations/connections`. In local mode the older `PUT /api/integrations/{prometheus,argocd,cost}` return 409 |
+| Working on **GitOps** (Argo CD / Flux detail pages, operations, Terminating lifecycle, drift, per-resource health, remote destinations) | [docs/gitops.md](docs/gitops.md) — detail-page tabs, operation semantics, the Terminating severity ramp, nested navigation, single-cluster scope. Engine in `pkg/gitops/`, handlers `internal/server/gitops_handlers.go` |
+| Working on an **integration's reverse-lookup or actions** (Velero, CloudNativePG, Kyverno, Argo Rollouts, …) | That integration's section in [docs/integrations.md](docs/integrations.md) + the doc comments in `internal/server/<name>_handlers.go` — both carry the per-integration gating and scope rules this file only summarizes |
+| Working on **RBAC visibility** (Permissions / blast radius, SA/Role/Binding reverse lookups) | `pkg/rbac/index.go` (index, implicit groups, `MaxFlatRules`), `internal/server/rbac_handlers.go`, and the header of `packages/k8s-ui/src/utils/rbac-blast-radius.ts` — the rule that resource-only wildcards must NOT trigger is load-bearing |
+| Working on **SSE / live updates** or anything the **topology** emits to a browser | `Server.handleSSE` in `internal/server/server.go` (per-user filtering), `internal/server/sse.go` (per-client RBAC grouping, `clientCanSeeChange`) + `pkg/topology/cluster_scoped_kinds.go` |
+| Working on the **informer cache** (new typed kind, field s
```

**File**: `internal/server/sse.go` (modified, +8/-15)
```diff
@@ -1022,24 +1022,17 @@ func (b *SSEBroadcaster) Broadcast(event SSEEvent) {
 }
 
 // broadcastResourceChange sends a per-resource change frame (k8s_event, which
-// can carry a spec/data diff) only to clients whose RBAC plausibly permits the
-// resource. Namespaced changes go only to clients whose RBAC-filtered namespace
-// set includes the namespace; cluster-scoped changes go only to clients not
-// denied that kind (the topology denied set resolved at subscribe time).
-//
-// This is a PARTIAL gate, not a complete authorization boundary, and is a big
-// reduction over the previous broadcast-to-all (which leaked every diff to every
-// client). Two gaps remain, both needing per-(group,resource) state this path
-// doesn't carry yet (ResourceChange has only Kind):
-//   - namespaced kinds the user can't read WITHIN an allowed namespace (e.g.
-//     Secrets/Roles for a list-pods-only viewer) still pass the namespace check;
-//   - cluster-scoped kinds outside the topology set (ClusterRole, webhooks,
-//     cluster-scoped CRDs) aren't in DeniedKinds, and kind-string matching misses
-//     CRD variants (EC2NodeClass vs synthesized NodeClass).
+// can carry a spec/data diff) only to clients whose RBAC permits the resource.
+// clientCanSeeChange requires the client's filtered namespace set to include a
+// namespaced change, then SAR-checks list on the exact (group, resource) — in
+// that namespace, or cluster-wide for a cluster-scoped change — so a viewer who
+// can list pods but not Secrets in a namespace never receives a Secret diff.
 //
 // The group/resource come from the change's GVR (dynamic cache) or are resolved
 // from its Kind (typed cache); an empty resource means the kind couldn't be
-// resolved and the frame fails closed for authenticated clients.
+// resolved and the frame fails closed for authenticated clients. Only a client
+// subscribed without an authorizer falls back to the coarser namespace +
+// denied-kind check.
 //
 // Clients are snapshotted under the lock, then authorized + sent WITHOUT it: an
 // authorization can miss the per-user memo and do a SAR round-trip, and holding
```

**File**: `pkg/k8score/transform.go` (modified, +4/-3)
```diff
@@ -134,9 +134,10 @@ func DropUnstructuredManagedFields(obj any) (any, error) {
 }
 
 // StripUnstructuredFields removes managedFields and heavy internal annotations
-// from a deep copy of an unstructured object. The dynamic cache keeps
-// last-applied internally for GitOps drift, but outward cache readers should
-// not leak full desired manifests in annotations.
+// from a deep copy of an unstructured object, so outward readers never leak a
+// full desired manifest through last-applied. The informer transform already
+// drops it from cached objects; GitOps drift reads it through
+// GetDirectPreserveLastApplied instead.
 func StripUnstructuredFields(u *unstructured.Unstructured) *unstructured.Unstructured {
 	return stripUnstructuredFields(u, false)
 }
```

---

### Incident Patch 2: `14d329a2` (2026-09-30)
**Commit Message**: Log viewer: trust the logger's level, keep stack traces under ERR, add Hide matching (#1926)

## Description

The log viewer's level chips and line colours were often wrong on real
Kubernetes logs, and filtering to ERR dropped the stack traces of the
errors you were filtering for.

**Level detection** now reads the level the logging library wrote before
guessing from words in the message:
- JSON and logfmt level fields (quote-aware, any number of pairs, empty
values fall through)
- klog `I/W/E/F` headers — most controllers
- header level words from zap/zerolog console, log4j/logback, Python,
NestJS, nginx/envoy `[error]`, ClickHouse `<Error>`, telegraf/CloudWatch
`E!`, supervisord
- keyword fallback last, ignoring key names (`errors=0`, `debug=false`)
and treating exception heads (`MongoServerError:`, `TypeError [ERR_X]:`,
`Traceback`) as errors

The structured-line badge and the line colour now come from the same
resolved level, so a `level=info` line mentioning "error" no longer
renders red under an INFO badge.

**Stack traces** are linked to the line that started their record, per
pod and container. Filtering to ERR keeps the whole exception, chip
counts count records instead of

**File**: `packages/k8s-ui/src/components/logs/LogCore.tsx` (modified, +131/-97)
```diff
@@ -1,8 +1,8 @@
 import { useRef, useCallback, useState, useMemo, useEffect, type ReactNode } from 'react'
 import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
-import { Play, Square, Download, FileDown, Search, X, Terminal, RotateCcw, ChevronUp, ChevronDown, ChevronRight, CaseSensitive, Regex, WrapText, Clock, Copy, Trash2, Filter, Braces, Palette, ListCollapse, Sun, Moon } from 'lucide-react'
+import { Play, Square, Download, FileDown, Search, X, Terminal, RotateCcw, ChevronUp, ChevronDown, ChevronRight, CaseSensitive, Regex, WrapText, Clock, Copy, Trash2, Filter, EyeOff, Highlighter, Braces, Palette, ListCollapse, Sun, Moon } from 'lucide-react'
 import type { LogEntry, LogLevel } from './useLogBuffer'
-import { useLogSearch } from './useLogSearch'
+import { useLogSearch, type LogSearchMode } from './useLogSearch'
 import { StructuredLogLine } from './StructuredLogLine'
 import { Tooltip } from '../ui/Tooltip'
 import { Input } from '../ui/Input'
@@ -16,6 +16,7 @@ import {
   TIMESTAMP_FORMAT_LABELS,
 } from '../../utils/log-format'
 import { getLogPalette, getLogLevelColor, type LogPalette } from './log-palette'
+import { associateContinuations, groupContinuations, type LogGroup } from '../../utils/log-level'
 import { copyText } from '../../utils/clipboard'
 import { useAnimatedUnmount } from '../../hooks/useAnimatedUnmount'
 import { TRANSITION_MENU, overlayExitMs, overlayTransitionStyle } from '../../utils/animation'
@@ -71,13 +72,16 @@ interface LogCoreProps {
 interface LevelOption {
   level: LogLevel
   label: string
+  /** What the chip's lines are called in its tooltip */
+  noun: string
 }
 
 const LEVEL_OPTIONS: LevelOption[] = [
-  { level: 'error', label: 'ERR' },
-  { level: 'warn', label: 'WARN' },
-  { level: 'info', label: 'INFO' },
-  { level: 'debug', label: 'DBG' },
+  { level: 'error', label: 'ERR', noun: 'error logs' },
+  { level: 'warn', label: 'WARN', noun: 'warning logs' },
+  { level: 'info', label: 'INFO', noun: 'info logs' },
+  { level: 'debug', label: 'DBG', noun: 'debug logs' },
+  { level: 'unknown', label: 'OTHER', noun: 'lines with no level' },
 ]
 
 function getLevelActiveColor(level: LogLevel, palette: LogPalette): string {
@@ -86,7 +90,7 @@ function getLevelActiveColor(level: LogLevel, palette: LogPalette): string {
     case 'warn': return palette.levelActiveWarn
     case 'info': return palette.levelActiveInfo
     case 'debug': return palette.levelActiveDebug
-    default: return palette.levelActiveDebug
+    default: return palette.levelActiveOther
   }
 }
 
@@ -121,19 +125,6 @@ const TIMESTAMP_FORMAT_SHORT_LABELS: Record<TimestampFormat, string> = {
   'epoch': 'Unix time',
 }
 
-function isContinuationLine(content: string): boolean {
-  // Lines starting with whitespace are the dominant stack-trace continuation pattern:
-  // Java `\tat com.foo.Bar`, Go `\tpackage.func`, Node `    at func`, Python `  File "..."`.
-  if (/^\s/.test(content)) return true
-  // Java's secondary chain markers that don't start with whitespace.
-  return /^(Caused by:|Suppressed:|\.\.\. \d+ more)/.test(content)
-}
-
-interface LogGroup {
-  head: LogEntry
-  continuations: LogEntry[]
-}
-
 const TIP_DELAY = 150
 
 export function LogCore({
@@ -201,7 +192,7 @@ export function LogCore({
     try { return localStorage.getItem('radar-logs-collapse-stacks') !== 'false' } catch { return true }
   })
   const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(
-    new Set(['error', 'warn', 'info', 'debug'])
+    new Set(['error', 'warn', 'info', 'debug', 'unknown'])
   )
   const [showDownloadMenu, setShowDownloadMenu] = useState(false)
   const downloadMenu = useAnimatedUnmount(showDownloadMenu, overlayExitMs('menu'))
@@ -232,32 +223,50 @@ export function LogCore({
     return () => clearInterval(id)
   }, [tsFormat, showTimestamps])
 
-  // Level-filtered entries
-  // 'unknown' logs are shown when all 4 known levels are enabled (no active filtering)
+  // One membership rule for filter
```

**File**: `packages/k8s-ui/src/components/logs/StructuredLogLine.tsx` (modified, +18/-28)
```diff
@@ -1,6 +1,7 @@
 import { useState, useMemo } from 'react'
 import { ChevronRight, ChevronDown, Filter } from 'lucide-react'
 import type { LogLevel } from './useLogBuffer'
+import { selectLevelField } from '../../utils/log-level'
 import { unescapeJsonStrings, parseLogfmt } from '../../utils/log-format'
 import { getLogPalette, getLogLevelColor, type LogPalette } from './log-palette'
 
@@ -65,7 +66,7 @@ export function StructuredLogLine({ content, level, wordWrap, isLogfmt, defaultE
           className={`cursor-pointer ${palette.hoverSurface} rounded px-0.5 -ml-0.5 ${wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
         >
           <span className="inline-flex items-center align-middle mr-0.5">{chevron}</span>
-          <SummaryLine obj={parsed} palette={palette} />
+          <SummaryLine obj={parsed} level={level} palette={palette} />
           <span className={`${palette.textTertiary} ml-1`}>{`{${fieldCount} fields}`}</span>
         </span>
       ) : (
@@ -76,7 +77,7 @@ export function StructuredLogLine({ content, level, wordWrap, isLogfmt, defaultE
           className={`cursor-pointer ${palette.hoverSurface} rounded px-0.5 -ml-0.5`}
         >
           <span className="inline-flex items-center align-middle mr-0.5">{chevron}</span>
-          <SummaryLine obj={parsed} palette={palette} />
+          <SummaryLine obj={parsed} level={level} palette={palette} />
           <span className={`${palette.textTertiary} ml-1`}>{`{${fieldCount} fields}`}</span>
         </span>
         <span className={`block ml-4 ${wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
@@ -167,8 +168,8 @@ function JsonExpanded({ text, onFilterValue, palette }: { text: string; onFilter
   return <>{nodes}</>
 }
 
-function SummaryLine({ obj, palette }: { obj: Record<string, unknown>; palette: LogPalette }) {
-  const lvl = obj.level ?? obj.severity ?? obj.lvl ?? nestedField(obj, 'log', 'level')
+function SummaryLine({ obj, level, palette }: { obj: Record<string, unknown>; level: LogLevel; palette: LogPalette }) {
+  const lvl = selectLevelField(obj)?.raw
   const msg = obj.msg ?? obj.message
   const rawErr = obj.error ?? obj.err
   const err = typeof rawErr === 'string'
@@ -179,8 +180,8 @@ function SummaryLine({ obj, palette }: { obj: Record<string, unknown>; palette:
   return (
     <>
       {lvl != null && (
-        <span className={`${getLevelBadgeColor(lvl, palette)} text-[10px] font-semibold px-1 py-px rounded mr-1.5 inline-block`}>
-          {formatLevel(lvl)}
+        <span className={`${levelBadgeColor(level, palette)} text-[10px] font-semibold px-1 py-px rounded mr-1.5 inline-block`}>
+          {formatLevel(lvl, level)}
         </span>
       )}
       {typeof msg === 'string' && (
@@ -221,30 +222,19 @@ function nestedField(obj: Record<string, unknown>, parent: string, child: string
   return undefined
 }
 
-function formatLevel(lvl: unknown): string {
-  if (typeof lvl === 'number') {
-    if (lvl >= 50) return 'ERR'
-    if (lvl >= 40) return 'WARN'
-    if (lvl >= 30) return 'INFO'
-    return 'DBG'
-  }
+const NUMERIC_LEVEL_LABELS: Record<LogLevel, string> = { error: 'ERR', warn: 'WARN', info: 'INFO', debug: 'DBG', unknown: '?' }
+
+function formatLevel(lvl: unknown, level: LogLevel): string {
+  if (typeof lvl === 'number') return NUMERIC_LEVEL_LABELS[level]
   return String(lvl).toUpperCase()
 }
 
-function getLevelBadgeColor(lvl: unknown, palette: LogPalette): string {
-  let normalized: string
-  if (typeof lvl === 'number') {
-    // Pino/bunyan numeric levels: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
-    if (lvl >= 50) normalized = 'error'
-    else if (lvl >= 40) normalized = 'warn'
-    else if (lvl >= 30) normalized = 'info'
-    else normalized = 'debug'
-  } else {
-    normalized = String(lvl).toLowerCase()
+function levelBadgeColor(level: LogLevel, palette: LogPalette): string {
+  switch (level) {
+    case 'error': return palette.levelBadgeError
+    case 'w
```

**File**: `packages/k8s-ui/src/components/logs/log-palette.ts` (modified, +4/-0)
```diff
@@ -53,6 +53,8 @@ export interface LogPalette {
   levelActiveWarn: string
   levelActiveInfo: string
   levelActiveDebug: string
+  /** Lines with no recognizable level */
+  levelActiveOther: string
 
   // Level-badge colors used inside StructuredLogLine
   levelBadgeError: string
@@ -110,6 +112,7 @@ const DARK_PALETTE: LogPalette = {
   levelActiveWarn: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
   levelActiveInfo: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
   levelActiveDebug: 'bg-slate-700 text-slate-300 border-slate-600',
+  levelActiveOther: 'bg-transparent text-slate-300 border-slate-500',
 
   levelBadgeError: 'bg-red-500/20 text-red-400 border border-red-500/40',
   levelBadgeWarn: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
@@ -166,6 +169,7 @@ const LIGHT_PALETTE: LogPalette = {
   levelActiveWarn: 'bg-amber-100 text-amber-700 border-amber-400',
   levelActiveInfo: 'bg-blue-100 text-blue-700 border-blue-400',
   levelActiveDebug: 'bg-slate-200 text-slate-700 border-slate-400',
+  levelActiveOther: 'bg-white text-slate-700 border-slate-400',
 
   levelBadgeError: 'bg-red-100 text-red-700 border border-red-400',
   levelBadgeWarn: 'bg-amber-100 text-amber-700 border border-amber-400',
```

**File**: `packages/k8s-ui/src/components/logs/useLogBuffer.ts` (modified, +8/-39)
```diff
@@ -1,7 +1,9 @@
 import { useState, useRef, useCallback } from 'react'
 import { isLogfmt } from '../../utils/log-format'
+import { detectLevel, type LevelSource, type LogLevel } from '../../utils/log-level'
 
-export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'unknown'
+export type { LevelSource, LogLevel }
+export { detectLogLevel } from '../../utils/log-level'
 
 export interface LogEntry {
   sourceLabel?: string
@@ -17,54 +19,19 @@ export interface LogEntry {
    */
   podColorIndex?: number
   level: LogLevel
+  levelSource: LevelSource
   isJson: boolean
   isLogfmt: boolean
 }
 
 const MAX_BUFFER_SIZE = 10_000
 
-/**
- * Detect log level from content using word-boundary matching.
- * For JSON logs, prefer the `level`, `severity`, or `lvl` field.
- */
-export function detectLogLevel(content: string): LogLevel {
-  // Fast path for JSON: check level/severity field
-  const trimmed = content.trimStart()
-  if (trimmed[0] === '{') {
-    try {
-      const obj = JSON.parse(trimmed)
-      const rawLevel = obj.level ?? obj.severity ?? obj.lvl ?? ''
-      // Numeric levels (pino/bunyan): 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
-      if (typeof rawLevel === 'number') {
-        if (rawLevel >= 50) return 'error'
-        if (rawLevel >= 40) return 'warn'
-        if (rawLevel >= 30) return 'info'
-        return 'debug'
-      }
-      const lvl = String(rawLevel).toLowerCase()
-      if (/^(error|err|fatal|panic|critical|crit)$/.test(lvl)) return 'error'
-      if (/^(warn|warning)$/.test(lvl)) return 'warn'
-      if (/^(info|information|notice)$/.test(lvl)) return 'info'
-      if (/^(debug|trace|verbose)$/.test(lvl)) return 'debug'
-    } catch {
-      // Not valid JSON, fall through to text matching
-    }
-  }
-
-  const lower = content.toLowerCase()
-  if (/\b(error|fatal|panic|critical|crit|exception)\b/.test(lower)) return 'error'
-  if (/\b(warn|warning)\b/.test(lower)) return 'warn'
-  if (/\b(debug|trace)\b/.test(lower)) return 'debug'
-  if (/\b(info)\b/.test(lower)) return 'info'
-  return 'unknown'
-}
-
 function isJsonContent(content: string): boolean {
   const trimmed = content.trimStart()
   return trimmed[0] === '{' && trimmed[trimmed.length - 1] === '}'
 }
 
-type RawLogEntry = Omit<LogEntry, 'id' | 'level' | 'isJson' | 'isLogfmt'>
+type RawLogEntry = Omit<LogEntry, 'id' | 'level' | 'levelSource' | 'isJson' | 'isLogfmt'>
 
 interface UseLogBufferReturn {
   entries: LogEntry[]
@@ -82,10 +49,12 @@ export function useLogBuffer(): UseLogBufferReturn {
 
   const enrichEntry = useCallback((raw: RawLogEntry): LogEntry => {
     const isJ = isJsonContent(raw.content)
+    const detected = detectLevel(raw.content)
     return {
       ...raw,
       id: idCounter.current++,
-      level: detectLogLevel(raw.content),
+      level: detected.level,
+      levelSource: detected.source,
       isJson: isJ,
       isLogfmt: !isJ && isLogfmt(raw.content),
     }
```

**File**: `packages/k8s-ui/src/components/logs/useLogSearch.ts` (modified, +52/-24)
```diff
@@ -3,6 +3,8 @@ import type { VirtuosoHandle } from 'react-virtuoso'
 import type { LogEntry } from './useLogBuffer'
 import { stripAnsi, escapeRegExp } from '../../utils/log-format'
 
+export type LogSearchMode = 'highlight' | 'only' | 'hide'
+
 interface UseLogSearchReturn {
   query: string
   setQuery: (q: string) => void
@@ -11,14 +13,16 @@ interface UseLogSearchReturn {
   setIsRegex: (v: boolean) => void
   isCaseSensitive: boolean
   toggleCaseSensitive: () => void
-  isFilterMode: boolean
-  toggleFilterMode: () => void
-  setFilterMode: (v: boolean) => void
+  /** highlight: show every line, mark matches · only: show matching lines · hide: drop matching lines */
+  mode: LogSearchMode
+  setMode: (mode: LogSearchMode) => void
+  /** Whether the query currently narrows the visible lines (only/hide with a non-empty, valid query) */
+  isFiltering: boolean
   matchCount: number
   currentMatch: number
   /** Indices into the entries array that match */
   matchIndices: number[]
-  /** When filter mode is on, only matching entries */
+  /** The lines left after applying the mode: matching lines for `only`, non-matching for `hide` */
   filteredEntries: LogEntry[]
   /** Error message when regex is invalid (null when valid) */
   regexError: string | null
@@ -29,14 +33,32 @@ interface UseLogSearchReturn {
   close: () => void
 }
 
+/**
+ * The lines a search mode leaves visible. Only and Hide act on whole records:
+ * a match on any line of a stack trace keeps or hides the trace together.
+ */
+export function applySearchMode<T extends { id: number }>(
+  entries: readonly T[],
+  matchIndices: readonly number[],
+  mode: LogSearchMode,
+  recordIdOf: (entry: T) => number = e => e.id,
+): T[] {
+  if (mode === 'highlight') return [...entries]
+  const matchedRecords = new Set(matchIndices.map(i => recordIdOf(entries[i])))
+  const keepMatches = mode === 'only'
+  return entries.filter(e => matchedRecords.has(recordIdOf(e)) === keepMatches)
+}
+
 export function useLogSearch(
   entries: LogEntry[],
   virtuosoRef: React.RefObject<VirtuosoHandle | null>,
+  /** Id of the record an entry belongs to (its first line's id); defaults to the entry itself */
+  recordIdOf?: (entry: LogEntry) => number,
 ): UseLogSearchReturn {
   const [query, setQuery] = useState('')
   const [isRegex, setIsRegex] = useState(false)
   const [isCaseSensitive, setIsCaseSensitive] = useState(false)
-  const [isFilterMode, setIsFilterMode] = useState(false)
+  const [mode, setMode] = useState<LogSearchMode>('highlight')
   const [currentMatch, setCurrentMatch] = useState(0)
   const [isOpen, setIsOpen] = useState(false)
 
@@ -72,12 +94,17 @@ export function useLogSearch(
     }
   }, [entries, deferredQuery, isRegex, isCaseSensitive])
 
-  // Filtered entries for filter mode
-  const filteredEntries = useMemo(() => {
-    if (!isFilterMode || !deferredQuery) return entries
-    const matchSet = new Set(matchIndices)
-    return entries.filter((_, i) => matchSet.has(i))
-  }, [entries, isFilterMode, deferredQuery, matchIndices])
+  // Gate on the live query too, so clearing or closing search unfilters immediately
+  // rather than after the deferred value catches up.
+  const isFiltering = mode !== 'highlight' && !!query && !!deferredQuery && !regexError
+  const filteredEntries = useMemo(
+    () => (isFiltering ? applySearchMode(entries, matchIndices, mode, recordIdOf) : entries),
+    [entries, isFiltering, mode, matchIndices, recordIdOf],
+  )
+  const filteredIndexById = useMemo(() => {
+    if (mode !== 'only' || !isFiltering) return null
+    return new Map(filteredEntries.map((e, i) => [e.id, i]))
+  }, [mode, isFiltering, filteredEntries])
 
   // Reset current match when search criteria change (but not when new entries arrive during streaming)
   const prevCriteria = useRef({ query, isRegex, isCaseSensitive })
@@ -94,10 +121,13 @@ export function useLogSearch(
 
   const scrollToMatch = useCallback((matchIdx: number) => {
     if (matchIdx 
```

---

### Incident Patch 3: `92e08957` (2026-09-30)
**Commit Message**: deps(npm): bump brace-expansion from 5.0.7 to 5.0.12 (#1943)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion)
from 5.0.7 to 5.0.12.
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/f3410159d768f56c9d9f4511d3e1b46425fc1099"><code>f341015</code></a>
5.0.12</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/33a5ef17b8d800bbfa8c52b14c39043b6aac1a96"><code>33a5ef1</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/82479277b90f2f86263e946f9ff89689b3734568"><code>8247927</code></a>
5.0.11</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/935d78f32f335b2ff76578e5c5e877d31ae9888c"><code>935d78f</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/df7682f386cdf2d7fef6067bc78ed70d824e1f3f"><code>df7682f</code></a>
5.0.10</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/1ade9de71f3a8719c82c61a7977121067bb55b02"><code>1ade9de</code></a>
npm run format</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/6735c94873c

**File**: `package-lock.json` (modified, +4/-4)
```diff
@@ -2557,16 +2557,16 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.7",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.7.tgz",
-      "integrity": "sha512-7oFy703dxfY3/NLxC1fh2SUCQ0H9rmAY+5EpDVfXjUTTs+HEwR2nYaqLv+GWcTsumwxPfiz6CzCNkwXwBUwqCA==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
       },
       "engines": {
-        "node": "18 || 20 || >=22"
+        "node": "20 || >=22"
       }
     },
     "node_modules/browserslist": {
```

---

### Incident Patch 4: `a78e11f8` (2026-09-29)
**Commit Message**: fix(copy): keep spaces in file names when parsing the ls -la fallback (#1925)

## Description

When `find -printf` is unavailable (BusyBox images, see the comment in
`listPodFiles`), the pod file browser falls back to `ls -la` and
`parseLSOutput`. That parser splits the line with `strings.Fields` and
takes `fields[8]` as the name, so:

- `my report.txt` is listed as `my` with path `/data/my`, and opening or
downloading it asks for a file that does not exist;
- a symlink `current link -> /data/releases/v 2` is listed as `current`,
and the target is taken from the first `->` token;
- a character/block device (`crw-rw-rw- 1 root root 1, 3 Sep 29 10:00
null`) prints `major, minor` where the size goes, so every column shifts
by one and the entry is named after its time (`10:00`).

This change:

- adds `splitLSLine`, which takes the first N whitespace-separated
fields and keeps the rest of the line verbatim, so names keep their
inner spaces;
- splits a symlink's name and target on the first ` -> `;
- re-reads device rows with one extra field and reports size 0 for them.

Directory, regular file and `.`/`..` handling is unchanged.

## Type of change

- [x] Bug fix (non-breaking change tha

**File**: `internal/server/copy.go` (modified, +35/-18)
```diff
@@ -811,21 +811,19 @@ func parseLSOutput(output, dirPath string) []*images.FileNode {
 		}
 
 		// ls -la output: permissions links owner group size month day time name [-> target]
-		fields := strings.Fields(line)
-		if len(fields) < 9 {
+		fields, name, ok := splitLSLine(line, 8)
+		if !ok {
 			continue
 		}
-
-		perms := fields[0]
-		sizeStr := fields[4]
-		name := fields[8]
-
-		// Skip . and ..
-		if name == "." || name == ".." {
-			continue
+		size, _ := strconv.ParseInt(fields[4], 10, 64)
+		if strings.HasSuffix(fields[4], ",") {
+			// Character and block devices print "major, minor" where the size goes.
+			if fields, name, ok = splitLSLine(line, 9); !ok {
+				continue
+			}
+			size = 0
 		}
-
-		size, _ := strconv.ParseInt(sizeStr, 10, 64)
+		perms := fields[0]
 
 		var nodeType string
 		var linkTarget string
@@ -834,17 +832,18 @@ func parseLSOutput(output, dirPath string) []*images.FileNode {
 			nodeType = "dir"
 		case perms[0] == 'l':
 			nodeType = "symlink"
-			// Extract link target (after "->")
-			for i, f := range fields {
-				if f == "->" && i+1 < len(fields) {
-					linkTarget = strings.Join(fields[i+1:], " ")
-					break
-				}
+			if i := strings.Index(name, " -> "); i >= 0 {
+				name, linkTarget = name[:i], name[i+len(" -> "):]
 			}
 		default:
 			nodeType = "file"
 		}
 
+		// Skip . and ..
+		if name == "." || name == ".." {
+			continue
+		}
+
 		nodePath := path.Join(dirPath, name)
 
 		node := &images.FileNode{
@@ -863,6 +862,24 @@ func parseLSOutput(output, dirPath string) []*images.FileNode {
 	return nodes
 }
 
+// splitLSLine returns the first n whitespace-separated fields of an `ls -l`
+// line and the rest of the line verbatim, so a name keeps its inner spaces.
+// ok is false when the line has no name after those fields.
+func splitLSLine(line string, n int) (fields []string, rest string, ok bool) {
+	rest = line
+	for len(fields) < n {
+		rest = strings.TrimLeft(rest, " \t")
+		end := strings.IndexAny(rest, " \t")
+		if end <= 0 {
+			return nil, "", false
+		}
+		fields = append(fields, rest[:end])
+		rest = rest[end:]
+	}
+	rest = strings.TrimLeft(rest, " \t")
+	return fields, rest, rest != ""
+}
+
 // buildRootNode wraps file nodes in a root directory node
 func buildRootNode(dirPath string, children []*images.FileNode) *images.FileNode {
 	return &images.FileNode{
```

**File**: `internal/server/copy_ls_test.go` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+package server
+
+import (
+	"testing"
+
+	"github.com/skyhook-io/radar/internal/images"
+)
+
+// busyboxLS is `ls -la` output from a BusyBox image, where the listing falls
+// back to ls because find has no -printf.
+const busyboxLS = `total 24
+drwxr-xr-x    4 root     root          4096 Sep 29 10:00 .
+drwxr-xr-x    1 root     root          4096 Sep 29 09:00 ..
+-rw-r--r--    1 root     root          1234 Sep 29 10:00 my report.txt
+-rw-r--r--    1 root     root            42 Sep 29 10:00 two  spaces.txt
+lrwxrwxrwx    1 root     root            20 Sep 29 10:00 current link -> /data/releases/v 2
+crw-rw-rw-    1 root     root        1,   3 Sep 29 10:00 null
+drwxr-xr-x    2 root     root          4096 Jan  3  2025 old logs
+-rw-r--r--    1 root     root             7 Sep 29 10:00 plain
+`
+
+func TestParseLSOutput(t *testing.T) {
+	nodes := parseLSOutput(busyboxLS, "/data")
+
+	byName := map[string]*images.FileNode{}
+	for _, n := range nodes {
+		byName[n.Name] = n
+	}
+
+	want := []images.FileNode{
+		{Name: "my report.txt", Path: "/data/my report.txt", Type: "file", Size: 1234},
+		{Name: "two  spaces.txt", Path: "/data/two  spaces.txt", Type: "file", Size: 42},
+		{Name: "current link", Path: "/data/current link", Type: "symlink", Size: 20, LinkTarget: "/data/releases/v 2"},
+		{Name: "null", Path: "/data/null", Type: "file", Size: 0},
+		{Name: "old logs", Path: "/data/old logs", Type: "dir", Size: 4096},
+		{Name: "plain", Path: "/data/plain", Type: "file", Size: 7},
+	}
+
+	if len(nodes) != len(want) {
+		names := make([]string, 0, len(nodes))
+		for _, n := range nodes {
+			names = append(names, n.Name)
+		}
+		t.Fatalf("got %d entries %q, want %d", len(nodes), names, len(want))
+	}
+	for _, w := range want {
+		got, ok := byName[w.Name]
+		if !ok {
+			t.Errorf("missing entry %q", w.Name)
+			continue
+		}
+		if got.Path != w.Path || got.Type != w.Type || got.Size != w.Size || got.LinkTarget != w.LinkTarget {
+			t.Errorf("entry %q = {Path:%q Type:%q Size:%d LinkTarget:%q}, want {Path:%q Type:%q Size:%d LinkTarget:%q}",
+				w.Name, got.Path, got.Type, got.Size, got.LinkTarget, w.Path, w.Type, w.Size, w.LinkTarget)
+		}
+	}
+}
+
+func TestParseLSOutputSkipsLinesWithoutAName(t *testing.T) {
+	out := "total 0\n-rw-r--r-- 1 root root 12 Sep 29 10:00\n\n"
+	if nodes := parseLSOutput(out, "/data"); len(nodes) != 0 {
+		t.Fatalf("expected no entries, got %d (first %q)", len(nodes), nodes[0].Name)
+	}
+}
```

---

### Incident Patch 5: `d36dff8d` (2026-09-29)
**Commit Message**: fix(timeline): list managed rows when a kind is selected (#1891)

## Description

On the Timeline page, List view, selecting **Kinds → Pod** always shows
"No activity found", even while the scrubber histogram above it counts
hundreds of Pod events in the same window.

**Root cause.** `TimelineList` asks the timeline source for
`includeManaged: appScoped`, which is `false` everywhere except
Applications. `applyClientFilters` then drops every managed row — kind
`Pod` / `ReplicaSet` / `Event`, **or any row with an `owner`** — before
the k8s-ui list applies the Kinds selection. So a Pod selection filters
an already Pod-free set. The histogram is fed by `TimelineView`'s own
query with `includeManaged: true`, which is why the two disagree. The
same filter also hides CronJob-owned Jobs under **Kinds → Job**, since
those rows carry an owner.

`includeManaged: appScoped` came in with #1158; before it the list
passed no `includeManaged`, so nothing was dropped.

**Fix.** Include managed rows whenever a kind is explicitly selected.
With no kind selected the list behaves exactly as today (managed rows
hidden). No extra fetch: the ring query key doesn't carry
`includeManaged`, so this only chan

**File**: `web/src/components/timeline/TimelineList.test.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import { describe, expect, it } from 'vitest'
+import { applyClientFilters } from '../../api/timelineSource'
+import type { TimelineEvent } from '../../types'
+import { listIncludesManaged } from './TimelineList'
+
+function ev(over: Partial<TimelineEvent> & { id: string }): TimelineEvent {
+  return {
+    timestamp: '2024-01-01T00:00:00.000Z',
+    source: 'informer',
+    kind: 'Deployment',
+    namespace: 'ns-a',
+    name: over.id,
+    eventType: 'update',
+    ...over,
+  }
+}
+
+// Mirrors the host: the source filter runs first, then the UI keeps the selected kinds.
+function listRows(events: TimelineEvent[], kinds: string[]): string[] {
+  return applyClientFilters(events, { includeManaged: listIncludesManaged(false, kinds) })
+    .filter((e) => kinds.length === 0 || kinds.includes(e.kind))
+    .map((e) => e.id)
+}
+
+describe('listIncludesManaged', () => {
+  it('includes managed rows when app-scoped or when any kind is selected', () => {
+    expect(listIncludesManaged(true, [])).toBe(true)
+    expect(listIncludesManaged(false, ['Pod'])).toBe(true)
+    expect(listIncludesManaged(false, ['Job'])).toBe(true)
+  })
+
+  it('keeps hiding managed rows for the unfiltered list', () => {
+    expect(listIncludesManaged(false, [])).toBe(false)
+  })
+})
+
+describe('timeline list rows', () => {
+  const events = [
+    ev({ id: 'dep', kind: 'Deployment' }),
+    ev({ id: 'pod', kind: 'Pod' }),
+    ev({ id: 'job', kind: 'Job' }),
+    ev({ id: 'cron-job', kind: 'Job', owner: { kind: 'CronJob', name: 'nightly' } }),
+  ]
+
+  it('lists pod rows for a Pod selection', () => {
+    expect(listRows(events, ['Pod'])).toEqual(['pod'])
+  })
+
+  it('lists owned rows of an unmanaged kind for that kind', () => {
+    expect(listRows(events, ['Job']).sort()).toEqual(['cron-job', 'job'])
+  })
+
+  it('hides pod and owned rows when no kind is selected', () => {
+    expect(listRows(events, []).sort()).toEqual(['dep', 'job'])
+  })
+})
```

**File**: `web/src/components/timeline/TimelineList.tsx` (modified, +7/-1)
```diff
@@ -24,6 +24,12 @@ export type { ActivityTypeFilter, ActivityFilterKey }
 const LIST_FETCH_LIMIT = 2000
 const APP_SCOPED_FETCH_LIMIT = 10000
 
+// The source drops managed rows (Pod, ReplicaSet, Event, or any owned row) before
+// the kind filter runs, so an explicit kind selection must keep them or it lists nothing.
+export function listIncludesManaged(appScoped: boolean, kinds: string[]): boolean {
+  return appScoped || kinds.length > 0
+}
+
 interface TimelineListProps {
   namespaces: string[]
   onViewChange?: (view: 'list' | 'swimlane') => void
@@ -76,7 +82,7 @@ export function TimelineList({ namespaces, onViewChange, currentView, onResource
     kinds: queryParams.kinds,
     timeRange: queryParams.timeRange,
     includeK8sEvents: true,
-    includeManaged: appScoped,
+    includeManaged: listIncludesManaged(appScoped, queryParams.kinds),
     includeDeleted: showDeleted,
     limit: fetchLimit,
     fromMs: selectionWindow?.fromMs,
```

---

### Incident Patch 6: `d6db76f2` (2026-09-29)
**Commit Message**: fix(ui): update namespacePicker to explain restricted RBAC lists (#1913)

Resolves issue #1869

## Description

Refactored the `NamespacePicker`'s warning tooltip, footer, and empty
states to rely strictly on the `authoritative` boolean instead of the
previous 'restricted' check.

Additionally, this introduces a `limitedListHelp` prop to the shared
presentational component, allowing the host to inject context-specific
instructions.

## Type of change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to change)
- [ ] Documentation update

## How has this been tested?

Added a new Vitest test suite (`NamespacePicker.test.tsx`) that verifies
the `!isAuthoritative` rendering logic. The tests explicitly cover:
1. Rendering the generic fallback note when `authoritative === false`
without a custom help prop.
2. Rendering the host-supplied CLI/config instructions when
`limitedListHelp` is provided.
3. Completely hiding the footer note when `authoritative === true`.

- [ ] Tested locally with minikube/kind
- [ ] Tested against a remote cluster


**File**: `docs/configuration.md` (modified, +13/-5)
```diff
@@ -383,19 +383,27 @@ The pick is a per-user view filter — it doesn't change anything for other user
 
 Until you make a pick, local sessions default to the namespace set on the kubeconfig context (kubectl parity — the same namespace `kubectl` would use, including one set via `kubectl config set-context` or `kubens`). An explicit `--namespace` / `--namespaces` flag outranks the kubeconfig value, and contexts without either default to **All namespaces**. Once you pick namespaces or explicitly choose **All namespaces**, that choice sticks for the context and the kubeconfig value is no longer consulted.
 
-If your account can list resources inside several namespaces but cannot list namespaces cluster-wide, start Radar with an explicit list:
+When Radar starts with `--namespace-scope`, the picker controls the process-wide cache scope instead of just a view filter. Namespaced informer caches are pinned to one namespace while cluster-scoped resources remain cluster-wide. Local/no-auth sessions can switch the scoped namespace, which rebuilds the cache in place. Auth-enabled and Radar Cloud sessions lock the picker to the startup namespace so one user cannot reshape the shared backend cache for everyone.
+
+**Single namespace only.** `--namespace-scope` pins the cache to exactly one namespace; scoping to several namespaces at once is not supported yet. Passing more than one (e.g. `--namespace=a,b`) fails at startup with a clear error rather than silently caching nothing. When scoped, the namespace picker becomes single-select, and a switch re-points the whole cache to the new namespace rather than adding to it.
+
+### Namespaces missing from the picker
+
+If your account can use resources in some namespaces but isn't allowed to list namespaces cluster-wide, Radar can't discover which namespaces exist. The picker then shows only the namespaces Radar has been given: the kubeconfig context's namespace and any you configure. Add every namespace you use, then restart Radar:
 
 ```bash
 kubectl radar --namespaces ns1,ns2,ns3
 ```
 
-Radar probes each listed namespace for access and watches every namespace where access is granted — resource views then cover all of them, not just the first. The list is also each user's initial picker selection: locally via the launch URL, and in shared (auth-enabled) deployments as a per-session default seeded on first read. Clearing the picker back to **All namespaces** sticks for the rest of the session. The picker can switch between those namespaces or keep several selected at once.
+Radar Desktop doesn't take command-line flags, so set the same list in `~/.radar/config.json` (this works for the CLI too):
 
-This covers built-in resource types and custom resources alike: CRDs (GitOps, Gateway API, etc.) are probed per-kind across the same list and watched in every granted namespace. The list is capped by `--max-scope-candidates` (default 20) — startup fails with a clear error rather than silently probing a subset.
+```json
+{ "namespaces": ["ns1", "ns2", "ns3"] }
+```
 
-When Radar starts with `--namespace-scope`, the picker controls the process-wide cache scope instead of just a view filter. Namespaced informer caches are pinned to one namespace while cluster-scoped resources remain cluster-wide. Local/no-auth sessions can switch the scoped namespace, which rebuilds the cache in place. Auth-enabled and Radar Cloud sessions lock the picker to the startup namespace so one user cannot reshape the shared backend cache for everyone.
+Radar probes each listed namespace for access and watches every namespace where access is granted — resource views then cover all of them, not just the first. The list is also each user's initial picker selection: locally via the launch URL, and in shared (auth-enabled) deployments as a per-session default seeded on first read. Clearing the picker back to **All namespaces** sticks for the rest of the session. The picker can switch between those namespaces or keep several selected 
```

**File**: `packages/k8s-ui/src/components/namespace-switcher/NamespacePicker.test.tsx` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+// @vitest-environment jsdom
+import { act, type ReactNode } from 'react'
+import { createRoot, type Root } from 'react-dom/client'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { NamespacePicker, type NamespacePickerProps, type NamespaceScopeView } from './NamespacePicker'
+
+vi.mock('../ui/Tooltip', () => ({
+  Tooltip: ({ children, content }: { children: ReactNode; content: ReactNode }) => (
+    <>
+      {children}
+      <span data-testid="tooltip">{content}</span>
+    </>
+  ),
+}))
+
+Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
+let root: Root
+
+beforeEach(() => {
+  const element = document.createElement('div')
+  document.body.appendChild(element)
+  root = createRoot(element)
+})
+
+afterEach(async () => {
+  await act(async () => root.unmount())
+  document.body.replaceChildren()
+})
+
+const baseScope: NamespaceScopeView = {
+  actives: ['team-a'],
+  accessibleNamespaces: ['team-a'],
+  kubeconfigNamespace: 'team-a',
+  deniedNamespaces: [],
+  mode: 'namespace',
+  cacheScoped: false,
+  namespaceRescope: false,
+  canClearNamespace: true,
+  authoritative: false,
+}
+
+const help = <a data-testid="help">How to add namespaces</a>
+
+async function renderOpen(scope: Partial<NamespaceScopeView>, props: Partial<NamespacePickerProps> = {}) {
+  await act(async () => {
+    root.render(<NamespacePicker scope={{ ...baseScope, ...scope }} onApply={vi.fn()} {...props} />)
+  })
+  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Switch active namespaces"]')!
+  const warning = trigger.querySelector('.lucide-triangle-alert, .lucide-alert-triangle') !== null
+  const tooltip = document.querySelector('[data-testid="tooltip"]')?.textContent ?? ''
+  await act(async () => { trigger.click() })
+  return { warning, tooltip, text: document.body.textContent ?? '' }
+}
+
+describe('NamespacePicker incomplete-list notice', () => {
+  it.each(['namespace', 'restricted'] as const)('offers the host action for a non-authoritative list in %s mode', async (mode) => {
+    const { text } = await renderOpen({ mode }, { limitedListHelp: help })
+    expect(text).toContain('Missing a namespace?')
+    expect(document.querySelector('[data-testid="help"]')).not.toBeNull()
+  })
+
+  it('says nothing about the list when the host has no action to offer', async () => {
+    const { warning, text } = await renderOpen({})
+    expect(warning).toBe(false)
+    expect(text).not.toContain('Missing a namespace?')
+  })
+
+  it('says nothing when the list is authoritative', async () => {
+    const { warning, text } = await renderOpen({ authoritative: true }, { limitedListHelp: help })
+    expect(warning).toBe(false)
+    expect(text).not.toContain('Missing a namespace?')
+    expect(document.querySelector('[data-testid="help"]')).toBeNull()
+  })
+
+  it('points an empty list at the note below it', async () => {
+    const { text } = await renderOpen(
+      { actives: [], accessibleNamespaces: [], mode: 'restricted' },
+      { limitedListHelp: help },
+    )
+    expect(text).toContain('No namespaces yet.')
+    expect(text).toContain('Missing a namespace?')
+  })
+
+  // The picker can't tell an unconfigured list from a configured or timed-out
+  // one, so a standing warning icon would nag users who have nothing to fix.
+  it('never puts a warning icon on the trigger', async () => {
+    const { warning } = await renderOpen({ mode: 'namespace' }, { limitedListHelp: help })
+    expect(warning).toBe(false)
+  })
+
+  it('says Radar can\u2019t list namespaces when the host can help and nothing is picked', async () => {
+    const { tooltip } = await renderOpen({ actives: [], mode: 'restricted' }, { limitedListHelp: help })
+    expect(tooltip).toBe('Radar can\u2019t list namespaces on this cluster.')
+  })
+
+  // A picked view keeps describing its filter; the footer carries the help.
+  it('keeps the filter tooltip once a namespace is picked', a
```

**File**: `packages/k8s-ui/src/components/namespace-switcher/NamespacePicker.tsx` (modified, +21/-18)
```diff
@@ -1,6 +1,6 @@
-import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
+import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
 import { createPortal } from 'react-dom'
-import { ChevronDown, Globe, Search, AlertTriangle } from 'lucide-react'
+import { ChevronDown, Globe, Search } from 'lucide-react'
 import { Badge } from '../ui/Badge'
 import { Tooltip } from '../ui/Tooltip'
 import { MultiSelectPicker } from '../ui/MultiSelectPicker'
@@ -57,6 +57,12 @@ export interface NamespacePickerProps {
   variant?: 'chip' | 'segment'
   /** Muted label shown before the value in the 'segment' variant (e.g. "Namespace"). */
   label?: string
+  /**
+   * A short action (e.g. a "How to add namespaces" link) for when the list is
+   * not authoritative and the viewer can supply namespaces themselves. Omit it
+   * when the viewer can't act — the picker then says nothing about the list.
+   */
+  limitedListHelp?: ReactNode
 }
 
 /**
@@ -79,7 +85,7 @@ export interface NamespacePickerProps {
  * onApply. "Clear all" applies immediately and closes.
  */
 export const NamespacePicker = forwardRef<NamespacePickerHandle, NamespacePickerProps>(function NamespacePicker(
-  { scope, onApply, loading = false, pending = false, disabled = false, disabledTooltip, className = '', variant = 'chip', label },
+  { scope, onApply, loading = false, pending = false, disabled = false, disabledTooltip, className = '', variant = 'chip', label, limitedListHelp },
   ref,
 ) {
   const [isOpen, setIsOpen] = useState(false)
@@ -201,8 +207,9 @@ export const NamespacePicker = forwardRef<NamespacePickerHandle, NamespacePicker
   const triggerLabel =
     activeCount === 0 ? 'All namespaces' : activeCount === 1 ? scopeActives[0] : `${activeCount} namespaces`
   const isClusterWide = activeCount === 0
-  const restrictedHint = scope.mode === 'restricted'
   const cacheScopeLocked = scope.cacheScoped && !scope.namespaceRescope
+  const needsNamespaces = scope.authoritative === false && limitedListHelp != null
+  const emptyStateLabel = needsNamespaces ? 'No namespaces yet.' : 'No namespaces available.'
   const isDisabled = disabled || loading || pending || cacheScopeLocked
   const canClearAll = scope.canClearNamespace || activeCount === 0
   const tooltipContent = disabled && disabledTooltip
@@ -211,8 +218,10 @@ export const NamespacePicker = forwardRef<NamespacePickerHandle, NamespacePicker
       ? scope.namespaceRescope
         ? `Radar is watching only ${scope.cacheScopeNamespace || triggerLabel} to stay fast on large clusters. Pick another namespace to re-point it (takes a moment; closes open terminals).`
         : `Radar is watching only ${scope.cacheScopeNamespace || triggerLabel} on this cluster.`
-      : restrictedHint
-      ? 'Limited namespace visibility — only namespaces granted by your RBAC are shown.'
+      : needsNamespaces && isClusterWide
+      ? 'Radar can\u2019t list namespaces on this cluster.'
+      : scope.authoritative === false && isClusterWide
+      ? 'Showing the namespaces your account can access.'
       : isClusterWide
         ? 'Currently viewing all namespaces. Click to narrow the view.'
         : activeCount === 1
@@ -255,11 +264,7 @@ export const NamespacePicker = forwardRef<NamespacePickerHandle, NamespacePicker
           {label && (
             <span className="shrink-0 font-normal text-theme-text-tertiary">{label}</span>
           )}
-          {isClusterWide ? (
-            <Globe className="w-3.5 h-3.5 shrink-0 text-theme-text-tertiary" />
-          ) : restrictedHint ? (
-            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-theme-text-tertiary" />
-          ) : null}
+          {isClusterWide && <Globe className="w-3.5 h-3.5 shrink-0 text-theme-text-tertiary" />}
           <span className={`font-medium truncate ${variant === 'segment' ? 'min-w-0' : 'max-w-[180px]'}`}>
             {p
```

**File**: `web/src/components/NamespaceSwitcher.test.tsx` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { renderToStaticMarkup } from 'react-dom/server'
+import type { ReactNode } from 'react'
+import { beforeEach, describe, expect, it, vi } from 'vitest'
+
+const state = vi.hoisted(() => ({
+  mode: 'local' as string | undefined,
+  authEnabled: false as boolean | undefined,
+}))
+
+vi.mock('@skyhook-io/k8s-ui', () => ({
+  NamespacePicker: ({ limitedListHelp }: { limitedListHelp?: ReactNode }) => <div>{limitedListHelp ?? 'no-help'}</div>,
+}))
+vi.mock('../api/client', () => ({
+  useNamespaceScope: () => ({ data: undefined, isLoading: false }),
+  useSetActiveNamespace: () => ({ isPending: false, mutate: vi.fn() }),
+  useCapabilities: () => ({ data: state.mode === undefined ? undefined : { deployment: { mode: state.mode } } }),
+  useAuthMe: () => ({ data: state.authEnabled === undefined ? undefined : { authEnabled: state.authEnabled } }),
+}))
+
+import { NamespaceSwitcher } from './NamespaceSwitcher'
+
+describe('NamespaceSwitcher namespace help', () => {
+  beforeEach(() => {
+    state.mode = 'local'
+    state.authEnabled = false
+  })
+
+  it('links to the namespace docs in local Radar without auth', () => {
+    const html = renderToStaticMarkup(<NamespaceSwitcher />)
+    expect(html).toContain('How to add namespaces')
+    expect(html).toContain('#namespaces-missing-from-the-picker')
+  })
+
+  // --namespaces and config.json belong to whoever runs the server; on a shared
+  // install the viewer can't use them.
+  it.each([
+    ['in-cluster Radar', 'in-cluster', false],
+    ['Radar Cloud', 'cloud', true],
+    ['auth-enabled local Radar', 'local', true],
+    ['capabilities still loading', undefined, false],
+    ['auth state still loading', 'local', undefined],
+  ] as const)('offers no help for %s', (_label, mode, authEnabled) => {
+    state.mode = mode
+    state.authEnabled = authEnabled
+    expect(renderToStaticMarkup(<NamespaceSwitcher />)).toContain('no-help')
+  })
+})
```

**File**: `web/src/components/NamespaceSwitcher.tsx` (modified, +17/-1)
```diff
@@ -1,9 +1,11 @@
 import { forwardRef } from 'react'
 import { NamespacePicker, type NamespacePickerHandle } from '@skyhook-io/k8s-ui'
-import { useNamespaceScope, useSetActiveNamespace } from '../api/client'
+import { useAuthMe, useCapabilities, useNamespaceScope, useSetActiveNamespace } from '../api/client'
 
 export type NamespaceSwitcherHandle = NamespacePickerHandle
 
+const NAMESPACES_HELP_URL = 'https://radarhq.io/docs/configuration/files#namespaces-missing-from-the-picker'
+
 interface NamespaceSwitcherProps {
   className?: string
   disabled?: boolean
@@ -24,6 +26,19 @@ export const NamespaceSwitcher = forwardRef<NamespaceSwitcherHandle, NamespaceSw
   const { data: scope, isLoading } = useNamespaceScope()
   const setActive = useSetActiveNamespace()
 
+  const { data: capabilities } = useCapabilities()
+  const { data: authMe } = useAuthMe()
+  // --namespaces and ~/.radar/config.json only reach a Radar the user launched
+  // themselves. With auth enabled, a non-authoritative list is also the
+  // per-user RBAC filter on a shared install, where neither applies.
+  const canConfigureNamespaces = capabilities?.deployment?.mode === 'local' && authMe?.authEnabled === false
+
+  const limitedListHelp = canConfigureNamespaces ? (
+    <a href={NAMESPACES_HELP_URL} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
+      How to add namespaces
+    </a>
+  ) : undefined
+
   return (
     <NamespacePicker
       ref={ref}
@@ -36,6 +51,7 @@ export const NamespaceSwitcher = forwardRef<NamespaceSwitcherHandle, NamespaceSw
       className={className}
       variant={variant}
       label={label}
+      limitedListHelp={limitedListHelp}
     />
   )
 })
```

---

### Incident Patch 7: `7efd611c` (2026-09-28)
**Commit Message**: Fix collapsed ResourceBar track and unstyled Hub brand tokens in OSS (#1919)

Two display bugs found during the Claude Design sync (#1918), both
verified in a real browser before and after.

## ResourceBar track collapses when it has a tooltip

`Tooltip`'s wrapper is `inline-flex`, so the bar row inside it sized to
its content and the `flex-1` track got no room.

Measured in Chromium, 300px container:

| Case | Before | After |
|---|---|---|
| inline + tooltip (Capacity Actual Usage rows) | **2px** | 228px |
| stacked + tooltip (ResourcesView pod CPU/memory cells) | **73px** |
300px |
| inline, no tooltip | 228px | 228px |
| stacked, no tooltip | 300px | 300px |

Fix: the bar row gets `w-full` when a tooltip is set, and the tooltip
branch is wrapped in a block `div`. The wrapper is inline-level, so
without it two bars in one nowrap cell (Capacity's CPU + MEM) share a
line and the second spills into the next column. The inline layout's
track also gets a 64px floor (`min-w-16`); its only use is that
auto-layout table cell, where the track otherwise has no preferred
width. The no-tooltip path is unchanged apart from that floor.

Live check (build from this branch):
- **EKS `skh-nonpro

**File**: `packages/k8s-ui/src/components/audit/AuditFindingsTable.tsx` (modified, +1/-1)
```diff
@@ -515,7 +515,7 @@ function FlatFindingRow({ finding, onResourceClick, showCluster, onClusterClick
         onClusterClick ? (
           <button
             onClick={() => onClusterClick(finding.cluster!.id)}
-            className="text-xs text-[var(--color-radar-accent)] hover:underline shrink-0 max-w-[160px] truncate text-left"
+            className="text-xs text-[var(--color-radar-accent,var(--accent))] hover:underline shrink-0 max-w-[160px] truncate text-left"
           >
             {finding.cluster.name}
           </button>
```

**File**: `packages/k8s-ui/src/components/checks/ChecksView.tsx` (modified, +8/-8)
```diff
@@ -285,7 +285,7 @@ export function ChecksView({ checks, catalog, anyData, evaluated, missingInputs
               placeholder="Search checks…"
               value={search}
               onChange={(e) => filters.setString('q', e.target.value)}
-              className="w-64 rounded-lg border border-theme-border-light bg-theme-base py-1.5 pl-9 pr-8 text-sm text-theme-text-primary placeholder-theme-text-disabled focus:outline-none focus:ring-2 focus:ring-[var(--color-radar-accent)]"
+              className="w-64 rounded-lg border border-theme-border-light bg-theme-base py-1.5 pl-9 pr-8 text-sm text-theme-text-primary placeholder-theme-text-disabled focus:outline-none focus:ring-2 focus:ring-[var(--color-radar-accent,var(--accent))]"
             />
             {search && (
               <button
@@ -340,7 +340,7 @@ export function ChecksView({ checks, catalog, anyData, evaluated, missingInputs
                 return (
                   <span
                     key={id}
-                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-radar-accent)]/30 bg-[var(--color-radar-accent)]/10 py-1 pl-2.5 pr-1 text-xs text-theme-text-primary"
+                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-radar-accent,var(--accent))]/30 bg-[var(--color-radar-accent,var(--accent))]/10 py-1 pl-2.5 pr-1 text-xs text-theme-text-primary"
                   >
                     <span className="min-w-0 max-w-[12rem] truncate">
                       <ClusterName name={label} />
@@ -520,7 +520,7 @@ function CheckReferenceLinks({ references }: { references: CheckReference[] }) {
           href={r.url}
           target="_blank"
           rel="noreferrer"
-          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-radar-accent)] hover:underline"
+          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-radar-accent,var(--accent))] hover:underline"
         >
           {r.label}
           <ExternalLink className="h-3 w-3" />
@@ -594,7 +594,7 @@ export function CheckCardShell({
             onToggle()
           }
         }}
-        className={`group flex cursor-pointer items-center gap-3 border-l-[3px] py-3 pl-3 pr-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-radar-accent)]/40 ${open ? SEVERITY_HEADER_BAND_CLASS[sev] : SEVERITY_RAIL_CLASS[sev]}`}
+        className={`group flex cursor-pointer items-center gap-3 border-l-[3px] py-3 pl-3 pr-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-radar-accent,var(--accent))]/40 ${open ? SEVERITY_HEADER_BAND_CLASS[sev] : SEVERITY_RAIL_CLASS[sev]}`}
       >
         <SeverityIcon className={`h-[18px] w-[18px] shrink-0 ${SEVERITY_TEXT_CLASS[sev]}`} aria-hidden />
 
@@ -701,7 +701,7 @@ export function CheckClusterBreakdownShell<T extends CheckClusterBreakdownGroup>
         <button
           type="button"
           onClick={() => setShowAllClusters(true)}
-          className="mt-0.5 inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--color-radar-accent)] hover:underline"
+          className="mt-0.5 inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--color-radar-accent,var(--accent))] hover:underline"
         >
           View all {groups.length} clusters →
         </button>
@@ -849,7 +849,7 @@ function ResourceList({
         <button
           type="button"
           onClick={() => setShowAll(true)}
-          className="mt-0.5 inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--color-radar-accent)] hover:underline"
+          className="mt-0.5 inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--color-radar-accent,var(--accent))] hover:underline"
         >
           View all {check.findings.length} →
     
```

**File**: `packages/k8s-ui/src/components/issues/IssuesView.tsx` (modified, +2/-2)
```diff
@@ -283,7 +283,7 @@ export function IssueRow({
             onToggle();
           }
         }}
-        className={`group @container/issue flex cursor-pointer items-center gap-3 border-l-[3px] py-3 pl-3 pr-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-radar-accent)]/40 ${open ? ISSUE_SEVERITY_HEADER_BAND_CLASS[severity] : ISSUE_SEVERITY_RAIL_CLASS[severity]}`}
+        className={`group @container/issue flex cursor-pointer items-center gap-3 border-l-[3px] py-3 pl-3 pr-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-radar-accent,var(--accent))]/40 ${open ? ISSUE_SEVERITY_HEADER_BAND_CLASS[severity] : ISSUE_SEVERITY_RAIL_CLASS[severity]}`}
       >
         <SeverityIcon className={`h-[18px] w-[18px] shrink-0 ${ISSUE_SEVERITY_TEXT_CLASS[severity]}`} aria-hidden />
 
@@ -719,7 +719,7 @@ function ResourceLine({
       ) : (
         <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-theme-text-tertiary">{r.kind}</span>
       )}
-      <span className={`min-w-0 truncate text-sm ${linkable ? `${compact ? 'font-semibold' : 'font-medium'} text-[var(--color-radar-accent)]` : 'font-medium text-theme-text-primary'}`}>
+      <span className={`min-w-0 truncate text-sm ${linkable ? `${compact ? 'font-semibold' : 'font-medium'} text-[var(--color-radar-accent,var(--accent))]` : 'font-medium text-theme-text-primary'}`}>
         {r.namespace ? `${r.namespace} / ` : ''}
         {r.name}
       </span>
```

**File**: `packages/k8s-ui/src/components/ui/FilterPill.tsx` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ const TONE_ACTIVE: Record<FilterPillTone, string> = {
   high:    'bg-orange-500/15 border-orange-500/40 text-orange-800 dark:text-orange-300',
   medium:  'bg-yellow-500/15 border-yellow-500/40 text-yellow-800 dark:text-yellow-300',
   ok:      'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
-  brand:   'bg-[var(--color-brand-50)] border-[var(--color-radar-accent)] text-theme-text-primary dark:bg-[var(--color-brand-950)]',
+  brand:   'bg-[var(--color-brand-50,var(--accent-muted))] border-[var(--color-radar-accent,var(--accent))] text-theme-text-primary dark:bg-[var(--color-brand-950,var(--accent-muted))]',
 }
 
 const INACTIVE = 'border-theme-border-light text-theme-text-secondary hover:border-theme-border hover:text-theme-text-primary hover:bg-theme-hover/50'
```

**File**: `packages/k8s-ui/src/components/ui/ResourceBar.tsx` (modified, +12/-6)
```diff
@@ -60,7 +60,7 @@ export function ResourceBar({
   label,
 }: ResourceBarProps) {
   const track = (
-    <div className={clsx('relative', layout === 'inline' && 'min-w-0 flex-1')}>
+    <div className={clsx('relative', layout === 'inline' && 'min-w-16 flex-1')}>
       <div className={clsx('rounded-full border border-theme-border bg-theme-elevated overflow-hidden', layout === 'inline' ? 'h-1' : 'h-1.5')}>
         <div
           className={clsx('h-full rounded-full transition-[width] duration-300 ease-out', getBarColor(percent, colorScheme))}
@@ -78,15 +78,15 @@ export function ResourceBar({
 
   const bar =
     layout === 'inline' ? (
-      <div className="flex items-center gap-1.5 min-w-0">
+      <div className={clsx('flex items-center gap-1.5 min-w-0', tooltip && 'w-full')}>
         <span className="w-7 shrink-0 text-[10px] font-medium uppercase tracking-wide text-theme-text-tertiary">{label}</span>
         {track}
         <span className="w-8 shrink-0 text-right text-[10.5px] font-mono tabular-nums text-theme-text-secondary">
           {Math.round(percent)}%
         </span>
       </div>
     ) : (
-      <div className="flex flex-col gap-0.5 min-w-0">
+      <div className={clsx('flex flex-col gap-0.5 min-w-0', tooltip && 'w-full')}>
         <div className="flex items-baseline justify-between gap-1">
           <span className="text-xs font-mono text-theme-text-secondary truncate">
             {used} / {total}
@@ -99,11 +99,17 @@ export function ResourceBar({
       </div>
     )
 
+  // Tooltip's wrapper is inline-flex: it sizes the row to its content (hence
+  // w-full on the row, or the track collapses to the labels' width) and it is
+  // inline-level, so the block div keeps sibling bars stacked instead of
+  // sharing one line.
   if (tooltip) {
     return (
-      <Tooltip content={tooltip} delay={200} position="top" wrapperClassName="w-full min-w-0">
-        {bar}
-      </Tooltip>
+      <div className="min-w-0">
+        <Tooltip content={tooltip} delay={200} position="top" wrapperClassName="w-full min-w-0">
+          {bar}
+        </Tooltip>
+      </div>
     )
   }
 
```

---

### Incident Patch 8: `02e30aff` (2026-09-26)
**Commit Message**: Type-check k8s-ui's tests in CI and fix the 19 errors (#1910)

k8s-ui's test files had 19 type errors that nothing caught. CI's k8s-ui
job runs the tests but never type-checks them, and Radar's `make tsc`
only reaches k8s-ui source through imports, never its tests. This PR
fixes the errors and adds the missing CI step.

## Tests that could not fail

Several errors were hiding assertions that pass whatever the code does.
Each now tests what it was written to test:

- **`ResourceRendererDispatch.test.tsx`, "does not score a Katib
Experiment with the Argo vocabulary":**
- It checked `status.level`, a field `getResourceStatus` doesn't return,
so the check was always `undefined`.
- It now asserts a kubeflow.org Experiment is read the same way as any
unrelated CRD with the same status.
- Verified: this fails if the `argoproj.io` gate on `experiments` is
removed; the old assertion passed.
- **`reachInspector.test.ts`, "answers the path question with nothing
selected":** asserted `sidebar.resource` was undefined, but that field
no longer exists. The panel reports every hop now, which the next test
covers, so the stale line is removed.
- **`reachInspector.test.ts`, verdict fallbacks:** pass

**File**: `.github/workflows/ci.yml` (modified, +5/-0)
```diff
@@ -138,6 +138,11 @@ jobs:
       - name: Install dependencies
         run: npm ci
 
+      # Radar's own type-check covers k8s-ui source through imports, never its tests.
+      - name: Type-check (including tests)
+        run: npm run tsc
+        working-directory: packages/k8s-ui
+
       - name: Run tests
         run: npm test
         working-directory: packages/k8s-ui
```

**File**: `packages/k8s-ui/src/components/gitops/health-provenance.test.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ describe('radarHealthNote', () => {
 
   test('hasRadarFinding reads the rows the markers read', () => {
     const row = (health: string, healthSource?: string) =>
-      ({ ref: { kind: 'Deployment', namespace: 'p', name: 'w' }, category: 'Unknown', health, healthSource, hasDesired: false, hasLive: true }) as const
+      ({ ref: { kind: 'Deployment', namespace: 'p', name: 'w' }, category: 'Unknown', health, healthSource, hasDesired: false, hasLive: true, partial: false }) as const
     expect(hasRadarFinding(undefined)).toBe(false)
     expect(hasRadarFinding([row('Degraded', 'controller')])).toBe(false)
     expect(hasRadarFinding([row('Healthy', 'radar')])).toBe(false)
```

**File**: `packages/k8s-ui/src/components/resources/printer-columns.test.ts` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ describe('formatPrinterCell', () => {
 describe('printerCellSortValue', () => {
   // Sorting must use the value, not its rendered text, or 10 sorts before 9.
   it('sorts numbers numerically', () => {
-    expect([10, 9, 100].map(printerCellSortValue).sort((a, b) => (a as number) - (b as number)))
+    expect([10, 9, 100].map(v => printerCellSortValue(v)).sort((a, b) => (a as number) - (b as number)))
       .toEqual([9, 10, 100])
   })
   it('sorts booleans by truth and falls back to empty for anything else', () => {
```

**File**: `packages/k8s-ui/src/components/resources/renderers/KueueQueueNavigation.test.tsx` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ import { expect, it, vi } from 'vitest'
 import { ClusterQueueRenderer, LocalQueueRenderer } from './KueueQueueRenderers'
 
 it('navigates from a namespaced LocalQueue to exact cluster-scoped Kueue dependencies', async () => {
-  globalThis.IS_REACT_ACT_ENVIRONMENT = true
+  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
   const container = document.createElement('div')
   const root = createRoot(container)
   const onNavigate = vi.fn()
@@ -64,6 +64,6 @@ it('navigates from a namespaced LocalQueue to exact cluster-scoped Kueue depende
     })
   } finally {
     await act(async () => root.unmount())
-    globalThis.IS_REACT_ACT_ENVIRONMENT = false
+    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false })
   }
 })
```

**File**: `packages/k8s-ui/src/components/resources/renderers/ReflectorSection.test.tsx` (modified, +4/-2)
```diff
@@ -225,13 +225,14 @@ describe("Reflector resource hierarchy", () => {
   it("keeps ConfigMap data ahead of detailed settings and source mirror list", () => {
     const html = renderToStaticMarkup(
       <ResourceRendererDispatch
-        kind="configmaps"
         data={{
           ...resource({ "reflection-allowed": "true" }),
           data: { setting: "value" },
         }}
         resource={{ kind: "configmaps", namespace: "app", name: "mirror" }}
         relationships={{ reflection: { mirrors: [mirror] } }}
+        onCopy={() => {}}
+        copied={null}
       />,
     );
     expect(html.indexOf("Data (1 keys)")).toBeLessThan(
@@ -242,7 +243,6 @@ describe("Reflector resource hierarchy", () => {
   it("puts TLS expiry and mirror provenance ahead of data, with details below", () => {
     const html = renderToStaticMarkup(
       <ResourceRendererDispatch
-        kind="secrets"
         data={{
           ...resource({ reflects: "source/settings" }),
           type: "kubernetes.io/tls",
@@ -268,6 +268,8 @@ describe("Reflector resource hierarchy", () => {
             ],
           } as any
         }
+        onCopy={() => {}}
+        copied={null}
       />,
     );
     expect(html.indexOf("Certificate has expired")).toBeLessThan(
```

---

### Incident Patch 9: `5f559b34` (2026-09-25)
**Commit Message**: fix(traffic): detect revisioned istiod deployments (#1895)

## Description

Fixes #1870.

Radar looked up istiod by the fixed name `istiod`, so a revisioned Istio
install (Deployment named `istiod-<rev>`, as the Istio Helm chart
creates when revision tags are used) was never found and Istio reported
as not detected. This change lists Deployments by the `app=istiod` label
instead, which every revision carries, and picks the first ready one
(falling back to a stable name order when none are ready). When more
than one revision is running, the detection message now lists all of
them instead of only reporting a single deployment.

## Type of change

- [x] Bug fix (non-breaking change that fixes an issue)

## How has this been tested?

- [x] Added/updated unit tests

`go test ./internal/traffic/... -count=1 -v`: 153 passed / 5 failed at
baseline, 158 passed / 0 failed with the fix. The new test file was also
run unmodified against the unfixed code to confirm it fails on the
revisioned-deployment cases specifically.

## Checklist

- [x] My code follows the project's coding standards
- [x] I have performed a self-review of my code
- [x] I have added comments where necessary
- [x] My change

**File**: `internal/traffic/istio.go` (modified, +43/-9)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"fmt"
 	"log"
+	"sort"
 	"strings"
 	"time"
 
@@ -15,9 +16,10 @@ import (
 	"github.com/skyhook-io/radar/pkg/prom"
 )
 
-const (
-	istiodName = "istiod"
-)
+// istiodSelector matches istiod Deployments by label rather than by name: a
+// revisioned install is named istiod-<rev>, but the istiod chart labels every
+// revision app=istiod.
+const istiodSelector = "app=istiod"
 
 // Namespaces where istiod is commonly deployed
 var istioNamespaces = []string{"istio-system", "istio", "default"}
@@ -48,11 +50,21 @@ func (s *IstioSource) Detect(ctx context.Context) (*DetectionResult, error) {
 	}
 
 	for _, ns := range istioNamespaces {
-		deploy, err := s.k8sClient.AppsV1().Deployments(ns).Get(ctx, istiodName, metav1.GetOptions{})
-		if err != nil {
+		list, err := s.k8sClient.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{LabelSelector: istiodSelector})
+		if err != nil || len(list.Items) == 0 {
 			continue
 		}
 
+		deploys := list.Items
+		sort.Slice(deploys, func(i, j int) bool {
+			iReady, jReady := deploys[i].Status.ReadyReplicas > 0, deploys[j].Status.ReadyReplicas > 0
+			if iReady != jReady {
+				return iReady
+			}
+			return deploys[i].Name < deploys[j].Name
+		})
+		deploy := &deploys[0]
+
 		totalReplicas := int32(1)
 		if deploy.Spec.Replicas != nil {
 			totalReplicas = *deploy.Spec.Replicas
@@ -63,6 +75,22 @@ func (s *IstioSource) Detect(ctx context.Context) (*DetectionResult, error) {
 			result.Message = fmt.Sprintf("Istio detected with istiod running in namespace %s (%d/%d ready)",
 				ns, deploy.Status.ReadyReplicas, totalReplicas)
 
+			var running []string
+			for _, d := range deploys {
+				if d.Status.ReadyReplicas > 0 {
+					rev := d.Spec.Template.Labels["istio.io/rev"]
+					if rev == "" {
+						rev = d.Name
+					}
+					running = append(running, rev)
+				}
+			}
+			sort.Strings(running)
+			if len(running) > 1 {
+				result.Message = fmt.Sprintf("Istio detected with %d istiod revisions running in namespace %s: %s",
+					len(running), ns, strings.Join(running, ", "))
+			}
+
 			// Try to get version from pod labels
 			if ver, ok := deploy.Spec.Template.Labels["istio.io/rev"]; ok && ver != "" {
 				result.Version = ver
@@ -81,12 +109,18 @@ func (s *IstioSource) Detect(ctx context.Context) (*DetectionResult, error) {
 			return result, nil
 		}
 
-		result.Message = fmt.Sprintf("istiod found in %s but not ready (%d/%d replicas)",
-			ns, deploy.Status.ReadyReplicas, totalReplicas)
-		return result, nil
+		// Keep looking: a stale revision here must not hide a ready istiod in
+		// a later namespace, so the first unready match is reported only if no
+		// namespace has a ready one.
+		if result.Message == "" {
+			result.Message = fmt.Sprintf("istiod found in %s but not ready (%d/%d replicas)",
+				ns, deploy.Status.ReadyReplicas, totalReplicas)
+		}
 	}
 
-	result.Message = "Istio not detected. Install Istio for service mesh traffic visibility."
+	if result.Message == "" {
+		result.Message = "Istio not detected. Install Istio for service mesh traffic visibility."
+	}
 	return result, nil
 }
 
```

**File**: `internal/traffic/istio_test.go` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+package traffic
+
+import (
+	"context"
+	"strings"
+	"testing"
+
+	appsv1 "k8s.io/api/apps/v1"
+	corev1 "k8s.io/api/core/v1"
+	apierrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/kubernetes/fake"
+	k8stesting "k8s.io/client-go/testing"
+)
+
+// istiodDeployment builds a Deployment shaped like the one Istio's chart
+// installs: app=istiod on both the Deployment and its pod template, with
+// istio.io/rev on the template when the install is revisioned.
+func istiodDeployment(name, ns, rev string, ready int32, labels map[string]string) *appsv1.Deployment {
+	replicas := int32(1)
+	tmplLabels := map[string]string{}
+	for k, v := range labels {
+		tmplLabels[k] = v
+	}
+	if rev != "" {
+		tmplLabels["istio.io/rev"] = rev
+	}
+	return &appsv1.Deployment{
+		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns, Labels: labels},
+		Spec: appsv1.DeploymentSpec{
+			Replicas: &replicas,
+			Template: corev1.PodTemplateSpec{
+				ObjectMeta: metav1.ObjectMeta{Labels: tmplLabels},
+				Spec: corev1.PodSpec{Containers: []corev1.Container{
+					{Name: "discovery", Image: "docker.io/istio/pilot:1.30.1"},
+				}},
+			},
+		},
+		Status: appsv1.DeploymentStatus{ReadyReplicas: ready},
+	}
+}
+
+func TestIstioSource_Detect(t *testing.T) {
+	istiodLabels := map[string]string{"app": "istiod"}
+
+	tests := []struct {
+		name        string
+		objects     []runtime.Object
+		wantAvail   bool
+		wantVersion string
+		msgContains []string
+	}{
+		{
+			name:        "default istiod in istio-system, ready",
+			objects:     []runtime.Object{istiodDeployment("istiod", "istio-system", "default", 1, istiodLabels)},
+			wantAvail:   true,
+			wantVersion: "default",
+			msgContains: []string{"istio-system"},
+		},
+		{
+			name:        "revisioned istiod, ready",
+			objects:     []runtime.Object{istiodDeployment("istiod-1-30-1", "istio-system", "1-30-1", 1, istiodLabels)},
+			wantAvail:   true,
+			wantVersion: "1-30-1",
+			msgContains: []string{"istio-system"},
+		},
+		{
+			name: "two revisions, both ready",
+			objects: []runtime.Object{
+				istiodDeployment("istiod-canary", "istio-system", "1-30-1", 1, istiodLabels),
+				istiodDeployment("istiod-stable", "istio-system", "1-29-0", 1, istiodLabels),
+			},
+			wantAvail:   true,
+			msgContains: []string{"2 istiod revisions running in namespace istio-system: 1-29-0, 1-30-1"},
+		},
+		{
+			name: "one revision ready, one not",
+			objects: []runtime.Object{
+				istiodDeployment("istiod-1-29-0", "istio-system", "1-29-0", 0, istiodLabels),
+				istiodDeployment("istiod-1-30-1", "istio-system", "1-30-1", 1, istiodLabels),
+			},
+			wantAvail:   true,
+			wantVersion: "1-30-1",
+		},
+		{
+			name: "unready revision in istio-system, ready one in istio",
+			objects: []runtime.Object{
+				istiodDeployment("istiod-1-29-0", "istio-system", "1-29-0", 0, istiodLabels),
+				istiodDeployment("istiod-1-30-1", "istio", "1-30-1", 1, istiodLabels),
+			},
+			wantAvail:   true,
+			wantVersion: "1-30-1",
+			msgContains: []string{"namespace istio "},
+		},
+		{
+			name:        "matching deployment with no ready replicas",
+			objects:     []runtime.Object{istiodDeployment("istiod-1-30-1", "istio-system", "1-30-1", 0, istiodLabels)},
+			wantAvail:   false,
+			msgContains: []string{"found in istio-system but not ready"},
+		},
+		{
+			name:        "no matching deployment anywhere",
+			objects:     nil,
+			wantAvail:   false,
+			msgContains: []string{"Istio not detected"},
+		},
+		{
+			name: "istiod-prefixed deployment without app=istiod",
+			objects: []runtime.Object{
+				istiodDeployment("istiod-something", "istio-system", "", 1, map[string]string{"app": "something-else"}),
+			},
+			wantAvail:   false,
+			msgContains: []string{"Istio not detected"},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			s
```

---

### Incident Patch 10: `77eec105` (2026-09-25)
**Commit Message**: fix(install): refresh radar.exe convenience copy on re-install (#1898)

## Description

`install.ps1` only creates the `radar.exe` convenience copy when it does
not already exist (`if (-not (Test-Path $RadarExe))`). On a re-install
after a version bump, the copy step is skipped, leaving `radar.exe` as a
stale copy of the previously installed `kubectl-radar.exe`. Always
overwrite the copy so the alias matches the newly installed binary.

## Type of change

- [x] Bug fix (non-breaking change that fixes an issue)

## How has this been tested?

- Ran `install.ps1` against an existing install with an older
`radar.exe`; confirmed the copy is refreshed to the new
`kubectl-radar.exe`.

**File**: `install.ps1` (modified, +1/-3)
```diff
@@ -79,9 +79,7 @@ Move-Item -Path (Join-Path $TmpDir $BinaryName) -Destination $InstallDir -Force
 
 # Create radar.exe symlink/copy for convenience
 $RadarExe = Join-Path $InstallDir "radar.exe"
-if (-not (Test-Path $RadarExe)) {
-    Copy-Item -Path (Join-Path $InstallDir $BinaryName) -Destination $RadarExe
-}
+Copy-Item -Path (Join-Path $InstallDir $BinaryName) -Destination $RadarExe -Force
 
 # Cleanup
 Remove-Item -Path $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
```

#### Recent Merged Pull Requests:
- **PR #1946** (2026-09-30): Remove stale multi-context design plan (@nadaverell)
- **PR #1945** (2026-09-30): Slim CLAUDE.md and fix stale agent guidance (@nadaverell)
- **PR #1944** (2026-09-30): ci: move Node to 24 LTS everywhere (@nadaverell)
- **PR #1943** (2026-09-30): deps(npm): bump brace-expansion from 5.0.7 to 5.0.12 (@dependabot[bot])
- **PR #1942** (2026-09-30): deps: batch soaked Dependabot updates (2026-09-30) (@nadaverell)
- **PR #1938** (closed): deps(go): bump github.com/jackc/pgx/v5 from 5.10.0 to 5.11.0 (@dependabot[bot])
- **PR #1937** (closed): deps(npm): bump eslint from 10.10.0 to 10.11.0 (@dependabot[bot])
- **PR #1936** (closed): deps(go): bump github.com/klauspost/compress from 1.20.0 to 1.20.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
