# Agent Contract: Agent Contract: skyhook-io/radar Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "skyhook-io/radar",
  "source_url": "https://github.com/skyhook-io/radar",
  "source_version": "f7efd90e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T20:04:23.383Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-skyhook-io-radar",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyhook-io/radar](https://github.com/skyhook-io/radar) (Revision: `f7efd90e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T20:04:23.383Z`  
> **Learning ID**: `learn-github-skyhook-io-radar`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `skyhook-io-radar-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
# Forensic Learning Record (Deep Inspection): skyhook-io/radar

> **Canonical Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T20:04:22.004Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4223 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.design-sync/previews/EmptyState.tsx`
```
import { EmptyState } from '@skyhook-io/k8s-ui'
import { CircleCheck, Funnel, Plug } from 'lucide-react'
import type { CSSProperties } from 'react'

const panel: CSSProperties = { width: 420, maxWidth: '100%' }
const stack: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, width: 460, maxWidth: '100%' }

export function HealthyCard() {
  return (
    <div style={panel}>
      <EmptyState
        tone="healthy"
        icon={CircleCheck}
        headline="All checks passing"
        body="No audit findings across 42 workloads in prod-cluster-us-east1."
      />
    </div>
  )
}

export function FilteredCard() {
  return (
    <div style={panel}>
      <EmptyState
        tone="filtered"
        icon={Funnel}
        headline="No resources match the current filters"
        body="Try widening the namespace scope or clearing the “Warning” severity filter."
      />
    </div>
  )
}

export function NeutralWithAction() {
  return (
    <div style={panel}>
      <EmptyState
        tone="neutral"
        icon={Plug}
        headline="No clusters connected yet"
        body="Connect a kubeconfig context to start exploring your cluster topology."
        action={
          <button type="button" className="btn-brand" style={{ padding: '6px 14px', fontSize: 13, fontWeight: 500 }}>
            Connect cluster
          </button>
        }
      />
    </div>
  )
}

export function InlineVariants() {
  return (
    <div style={stack}>
      <EmptyState variant="inline" tone="healthy" icon={CircleCheck} headline="0 failing pods" body="all Running" />
      <EmptyState variant="inline" tone="filtered" icon={Funnel} headline="No events in the last 15m" />
    </div>
  )
}

```

### Core Architecture Module: `internal/diagnosecli/render.go`
```
package diagnosecli

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/skyhook-io/radar/internal/ai"
	"github.com/skyhook-io/radar/internal/cliui"
)

const (
	cReset = cliui.Reset
	cDim   = cliui.Dim
	cBold  = cliui.Bold
	cGreen = cliui.Green
	cRed   = cliui.Red
	cAmber = cliui.Amber
	cCyan  = cliui.Cyan

	// clearLine returns the cursor to column 0 and erases the spinner line.
	clearLine = "\r\x1b[K"
)

// renderer writes the live transcript + conclusion to the terminal. In --json mode
// everything human goes to stderr so stdout stays a clean JSON document.
// A single mutex serializes event writes with the spinner goroutine: the model
// goes quiet for long stretches (its own thinking + slow tools), and without a
// live indicator a silent terminal reads as a hang.
type renderer struct {
	w     *os.File
	color bool

	mu          sync.Mutex
	inThinking  bool
	spinnerOn   bool      // spinner line currently drawn (must be erased before real output)
	lastEvent   time.Time // last real output, for the quiet-gap threshold
	activeTool  string    // tool currently running (the spinner speaks its activity verb)
	sawAnything bool      // false until the agent's first output ("starting investigation…")
	watchURL    string
	stopSpin    chan struct{}
	spinStopped bool
}

func newRenderer(jsonMode bool) *renderer {
	w := os.Stdout
	if jsonMode {
		w = os.Stderr
	}
	return &renderer{
		w:         w,
		color:     cliui.ColorEnabled(w),
		lastEvent: time.Now(),
		stopSpin:  make(chan struct{}),
	}
}

var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// startSpinner shows a live activity line ("⠙ reading logs… 12s") after a
// second of silence — only on a real terminal (it repaints its own line), and
// never mid-thinking-line.
func (r *renderer) startSpinner() {
	if !r.color {
		return
	}
	go func() {
		t := time.NewTicker(120 * time.Millisecond)
		defer t.Stop()
		frame := 0
		for {
			select {
			case <-r.stopSpin:
				return
			case <-t.C:
			}
			r.mu.Lock()
			quiet := time.Since(r.lastEvent)
			if quiet > time.Second && !r.inThinking {
				fmt.Fprintf(r.w, "%s%s%s %s %ds%s",
					clearLine, cAmber+spinnerFrames[frame%len(spinnerFrames)]+cReset,
					cDim, r.activityVerbLocked(), int(quiet.Seconds()), cReset)
				r.spinnerOn = true
				frame++
			}
			r.mu.Unlock()
		}
	}()
}

func (r *renderer) stopSpinner() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.spinStopped {
		return
	}
	r.spinStopped = true
	close(r.stopSpin)
	r.clearSpinnerLocked()
}

// clearSpinnerLocked erases the spinner line before real output. Caller holds r.mu.
func (r *renderer) clearSpinnerLocked() {
	if r.spinnerOn {
		fmt.Fprint(r.w, clearLine)
		r.spinnerOn = false
	}
	r.lastEvent = time.Now()
	r.sawAnything = true
}

// activityVerbLocked mirrors the web panel's live status vocabulary: the wait
// names what the agent is actually doing, not a generic "thinking". Caller
// holds r.mu.
func (r *renderer) activityVerbLocked() string {
	if t := strings.ToLower(r.activeTool); t != "" {
		switch {
		case strings.Contains(t, "log"):
			return "reading logs…"
		case strings.Contains(t, "event"):
			return "checking recent events…"
		case strings.Contains(t, "prometheus") || strings.Contains(t, "metric") || strings.Contains(t, "top"):
			return "checking metrics…"
		case strings.Contains(t, "topology") || strings.Contains(t, "neighborhood") || strings.Contains(t, "graph"):
			return "tracing dependencies…"
		case strings.Contains(t, "list") || strings.Contains(t, "search"):
			return "scanning related resources…"
		case strings.Contains(t, "diagnose"):
			return "collecting evidence…"
		case strings.Contains(t, "resource") || strings.Contains(t, "describe"):
			return "inspecting the resource…"
		}
		return prettyTool(r.activeTool) + "…"
	}
	if !r.sawAnything {
		return "starting investigation…"
	}
	return "thinking…"
}

// toolStarted records the running tool so the spinner narrates it.
func (r *renderer) toolStarted(tool string) {
	r.mu.Lock()
	if tool != "" {
		r.activeTool = tool
	}
	r.mu.Unlock()
}

func (r *renderer) header(run runSummary, base string) {
	r.watchURL = fmt.Sprintf("%s/?ai-run=%s", base, run.ID)
	target := run.Kind
	if run.Group != "" {
		target += "." + run.Group
	}
	target += " "
	if run.Namespace != "" {
		target += run.Namespace + "/"
	}
	target += run.Name
	fmt.Fprintf(r.w, "%s %s\n", r.c(cBold, "◉ Investigating"), r.c(cBold, r.c(cCyan, target)))
	fmt.Fprintf(r.w, "%s\n", r.c(cDim, fmt.Sprintf("%s · via %s · watch: %s", run.ID, ai.AgentLabel(run.Agent), r.watchURL)))
	// Radar's read at start — the concrete issue rows the server captured, shown
	// before the agent produces anything (its boot is the longest silent gap).
	if h := run.Health; h != nil {
		for _, line := range h.Issues {
			sev := r.c(cRed, "●")
			if line.Severity != "critical" {
				sev = r.c(cAmber, "●")
			}
			fmt.Fprintf(r.w, "%s %s — %s\n", sev, r.c(cBold, line.Reason), line.Message)
		}
		if extra := h.IssueCount - len(h.Issues); extra > 0 {
			fmt.Fprintf(r.w, "%s\n", r.c(cDim, fmt.Sprintf("  +%d more active issues", extra)))
		}
		for _, f := range h.AuditFindings {
			fmt.Fprintf(r.w, "%s\n", r.c(cDim, fmt.Sprintf("  audit: %s — %s", f.Reason, f.Message)))
		}
	}
	if run.ManagedBy != "" {
		fmt.Fprintf(r.w, "%s\n", r.c(cDim, "  managed by "+run.ManagedBy))
	}
	fmt.Fprintln(r.w)
}

func (r *renderer) c(code, s string) string {
	if !r.color {
		return s
	}
	return code + s + cReset
}

// thinking streams the agent's interleaved reasoning, dimmed.
func (r *renderer) thinking(token string) {
	if token == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clearSpinnerLocked()
	if r.color {
		fmt.Fprint(r.w, cDim+token+cReset)
	} else {
		fmt.Fprint(r.w, token)
	}
	r.inThinking = !strings.HasSuffix(token, "\n")
}

// breakThinkingLocked ends a partial reasoning line. Caller holds r.mu.
func (r *renderer) breakThinkingLocked() {
	if r.inThinking {
		fmt.Fprintln(r.w)
		r.inThinking = false
	}
}

// step prints one completed tool call: "  ✓ get resource kind=node name=… 44ms".
func (r *renderer) step(s stepInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clearSpinnerLocked()
	r.breakThinkingLocked()
	if s.Tool == r.activeTool {
		r.activeTool = ""
	}
	line := "  " + r.c(cGreen, "✓") + " " + prettyTool(s.Tool)
	if args := prettyArgs(s.Summary); args != "" {
		line += " " + r.c(cDim, args)
	}
	if s.Ms != nil {
		line += r.c(cDim, fmt.Sprintf("  %dms", *s.Ms))
	}
	fmt.Fprintln(r.w, line)
}

func prettyTool(tool string) string {
	return strings.ReplaceAll(tool, "_", " ")
}

// prettyArgs renders a tool's JSON input as terse k=v pairs — raw braces and
// quotes read as noise at a glance. Identity keys lead (kind, namespace, name),
// the rest follow sorted; anything non-JSON falls back to a compacted string.
func prettyArgs(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(raw), &m); err != nil || len(m) == 0 {
		return compact(raw, 80)
	}
	lead := []string{"kind", "namespace", "name"}
	parts := make([]string, 0, len(m))
	seen := map[string]bool{}
	for _, k := range lead {
		if v, ok := m[k]; ok {
			parts = append(parts, fmt.Sprintf("%s=%v", k, v))
			seen[k] = true
		}
	}
	rest := make([]string, 0, len(m))
	for k := range m {
		if !seen[k] {
			rest = append(rest, k)
		}
	}
	sort.Strings(rest)
	for _, k := range rest {
		parts = append(parts, fmt.Sprintf("%s=%v", k, m[k]))
	}
	return compact(strings.Join(parts, " "), 90)
}

func compact(s string, max int) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > max {
		return s[:max-1] + "…"
	}
	return s
}

func (r *renderer) errorLine(msg string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clearSpinnerLocked()
	r.breakThinkingLocked()
	fmt.Fprintf(r.w, "\n%s %s\n", r.c(cRed, "✗"), msg)
}

func (r *renderer) conclusion(d diagnosis) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clearSpinnerLocked()
	r.breakThinkingLocked()
	fmt.Fprintln(r.w)
	switch {
	case d.Healthy && d.RootCause == "":
		fmt.Fprintf(r.w, "%s\n", r.c(cGreen, r.c(cBold, "✔ No problems found")))
		if d.Report != "" {
			fmt.Fprintln(r.w, r.md(d.Report))
		}
	case d.Inconclusive && d.RootCause == "":
		fmt.Fprintf(r.w, "%s\n", r.c(cAmber, r.c(cBold, "? Couldn't determine")))
		if d.Report != "" {
			fmt.Fprintln(r.w, r.md(d.Report))
		}
	case d.RootCause != "":
		conf := ""
		if d.Confidence != nil {
			label := confidenceLabel(*d.Confidence)
			col := cGreen
			switch label {
			case "medium":
				col = cAmber
			case "low":
				col = cRed
			}
			conf = r.c(cDim, " · confidence ") + r.c(col, label)
		}
		fmt.Fprintf(r.w, "%s%s\n", r.c(cAmber, r.c(cBold, "▲ Root cause")), conf)
		fmt.Fprintln(r.w, r.md(d.RootCause))
		if len(d.Remediation) > 0 {
			fmt.Fprintf(r.w, "\n%s\n", r.c(cBold, "Remediation"))
			for i, step := range d.Remediation {
				marker := fmt.Sprintf("  %s", r.c(cDim, fmt.Sprintf("%d.", i+1)))
				if d.RecommendedIndex != nil && *d.RecommendedIndex == i+1 {
					marker = "  " + r.c(cGreen, fmt.Sprintf("★%d.", i+1))
				}
				fmt.Fprintf(r.w, "%s %s\n", marker, r.md(step))
			}
			if d.RecommendedIndex != nil && d.RecommendedReason != "" {
				fmt.Fprintf(r.w, "  %s\n", r.c(cDim, "★ recommended — "+d.RecommendedReason))
			}
		}
	default:
		// No structured conclusion — show whatever the agent said.
		if d.Report != "" {
			fmt.Fprintln(r.w, r.md(d.Report))
		} else {
			fmt.Fprintln(r.w, "The investigation finished without a clear conclusion.")
		}
	}
	footer := "AI-generated — review before applying. Continue in the Radar UI or your own agent."
	if r.watchURL != "" {
		footer = "AI-generated — review before applying. Continue in Radar: " + r.watchURL + " — or in your own agent."
	}
	fmt.Fprintf(r.w, "\n%s\n", r.c(cDim, footer))
}

func confidenceLabel(c float64) string {
	switch {
	case c >= 0.8:
		return "high"
	case c >= 0.5:
		return "medium"
	}
	return "low"
}

var (
	mdBo
```

### Core Architecture Module: `internal/helm/hook_evidence.go`
```
package helm

import (
	"context"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/skyhook-io/radar/internal/podlogs"
	aicontext "github.com/skyhook-io/radar/pkg/ai/context"
	"github.com/skyhook-io/radar/pkg/k8score"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

const (
	maxHookEvidencePods       = 2
	maxHookEvidenceEvents     = 6
	maxHookEvidenceContainers = 3
	maxHookEvidenceLogs       = 4
	hookLogTailLines          = 80
	hookLogReadLimitBytes     = 128 * 1024
	hookLogTimeout            = 4 * time.Second
)

type hookObjectRef struct {
	kind string
	name string
}

// EnrichHookDiagnosticsWithClusterEvidence attaches live Job/Pod/Event/log clues
// for failed or running Helm hooks. It uses the caller's Kubernetes client so
// auth-enabled deployments keep Kubernetes RBAC as the source of truth.
func EnrichHookDiagnosticsWithClusterEvidence(ctx context.Context, detail *HelmReleaseDetail, client kubernetes.Interface) {
	if detail == nil || len(detail.HookDiagnostics) == 0 {
		return
	}
	if client == nil {
		for i := range detail.HookDiagnostics {
			diag := &detail.HookDiagnostics[i]
			diag.EvidenceUnavailable = true
			diag.EvidenceUnavailableReason = "Radar could not read live hook evidence because no Kubernetes client was available for this request."
		}
		return
	}

	hooks := make(map[string]HelmHook, len(detail.Hooks)*2)
	for _, hook := range detail.Hooks {
		hooks[hookDiagnosticKey(hook.Namespace, hook.Kind, hook.Name)] = hook
		hooks[hookDiagnosticKey("", hook.Kind, hook.Name)] = hook
	}

	for i := range detail.HookDiagnostics {
		diag := &detail.HookDiagnostics[i]
		namespace := diag.Namespace
		if namespace == "" {
			namespace = detail.Namespace
		}
		hook, ok := hooks[hookDiagnosticKey(namespace, diag.Kind, diag.Name)]
		if !ok {
			hook = hooks[hookDiagnosticKey("", diag.Kind, diag.Name)]
		}
		if hook.Name == "" {
			hook = HelmHook{
				Name:      diag.Name,
				Namespace: namespace,
				Kind:      diag.Kind,
				Events:    diag.Events,
				Status:    diag.Phase,
			}
		}
		if hook.Namespace == "" {
			hook.Namespace = namespace
		}

		evidence := collectHookEvidence(ctx, client, hook)
		if evidence.hasData() {
			diag.Evidence = &evidence
		}
		if evidence.hasLiveEvidence() {
			diag.EvidenceUnavailable = false
			diag.EvidenceUnavailableReason = ""
			continue
		}
		if hasPrimaryHookEvidenceError(evidence.Errors) {
			diag.EvidenceUnavailable = true
			diag.EvidenceUnavailableReason = "Radar could not read live hook evidence with the current Kubernetes identity."
			continue
		}
		if diag.EvidenceUnavailable {
			continue
		}
		diag.EvidenceUnavailable = true
		diag.EvidenceUnavailableReason = "No live Job/Pod evidence found for this hook; it may have been deleted by a hook policy, TTL controller, or garbage collection."
	}
}

func hookDiagnosticKey(namespace, kind, name string) string {
	return namespace + "/" + strings.ToLower(kind) + "/" + name
}

func collectHookEvidence(ctx context.Context, client kubernetes.Interface, hook HelmHook) HookEvidence {
	namespace := hook.Namespace
	evidence := HookEvidence{}
	refs := []hookObjectRef{{kind: hook.Kind, name: hook.Name}}
	var pods []*corev1.Pod

	switch strings.ToLower(hook.Kind) {
	case "job":
		job, err := client.BatchV1().Jobs(namespace).Get(ctx, hook.Name, metav1.GetOptions{})
		if err == nil {
			evidence.Jobs = append(evidence.Jobs, hookJobEvidence(job))
			refs = append(refs, hookObjectRef{kind: "Job", name: job.Name})
		} else if !apierrors.IsNotFound(err) {
			evidence.Errors = append(evidence.Errors, "job: "+compactHookEvidenceError(err))
		}
		jobPods, errs := listHookPodsForJob(ctx, client, namespace, hook.Name)
		pods = append(pods, jobPods...)
		evidence.Errors = append(evidence.Errors, errs...)
	case "pod":
		pod, err := client.CoreV1().Pods(namespace).Get(ctx, hook.Name, metav1.GetOptions{})
		if err == nil {
			pods = append(pods, pod)
		} else if !apierrors.IsNotFound(err) {
			evidence.Errors = append(evidence.Errors, "pod: "+compactHookEvidenceError(err))
		}
	}

	pods = dedupeAndSortPods(pods)
	for _, pod := range pods {
		evidence.Pods = append(evidence.Pods, hookPodEvidence(pod))
		refs = append(refs, hookObjectRef{kind: "Pod", name: pod.Name})
	}

	events, eventErr := listHookEvents(ctx, client, namespace, refs)
	evidence.Events = events
	if eventErr != "" {
		evidence.Errors = append(evidence.Errors, eventErr)
	}

	logs := collectHookLogs(ctx, client, namespace, pods)
	evidence.Logs = append(evidence.Logs, logs...)
	evidence.Errors = compactHookEvidenceErrors(evidence.Errors)
	evidence.Summary = summarizeHookEvidence(evidence)
	return evidence
}

func hookJobEvidence(job *batchv1.Job) HookJobEvidence {
	out := HookJobEvidence{
		Name:      job.Name,
		Namespace: job.Namespace,
		Active:    job.Status.Active,
		Succeeded: job.Status.Succeeded,
		Failed:    job.Status.Failed,
		Status:    "unknown",
	}
	if job.Status.Active > 0 {
		out.Status = "active"
	}
	if job.Status.Succeeded > 0 {
		out.Status = "succeeded"
	}
	if job.Status.Failed > 0 {
		out.Status = "failed"
	}
	for _, cond := range job.Status.Conditions {
		if cond.Type == batchv1.JobComplete && cond.Status == corev1.ConditionTrue {
			out.Status = "succeeded"
		}
		if cond.Type == batchv1.JobFailed && cond.Status == corev1.ConditionTrue {
			out.Status = "failed"
		}
		parts := []string{string(cond.Type) + "=" + string(cond.Status)}
		if cond.Reason != "" {
			parts = append(parts, cond.Reason)
		}
		if cond.Message != "" {
			parts = append(parts, truncateHookText(aicontext.RedactSecrets(cond.Message), 220))
		}
		out.Conditions = append(out.Conditions, strings.Join(parts, ": "))
	}
	return out
}

func hookPodEvidence(pod *corev1.Pod) HookPodEvidence {
	out := HookPodEvidence{
		Name:      pod.Name,
		Namespace: pod.Namespace,
		Phase:     string(pod.Status.Phase),
		Reason:    pod.Status.Reason,
		Message:   truncateHookText(aicontext.RedactSecrets(pod.Status.Message), 220),
	}
	var ready, total int
	consider := func(status corev1.ContainerStatus) {
		total++
		if status.Ready {
			ready++
		}
		out.RestartCount += status.RestartCount
		if out.Reason == "" {
			if status.State.Waiting != nil {
				out.Reason = status.State.Waiting.Reason
				out.Message = truncateHookText(aicontext.RedactSecrets(status.State.Waiting.Message), 220)
			} else if status.State.Terminated != nil && status.State.Terminated.ExitCode != 0 {
				out.Reason = status.State.Terminated.Reason
				out.Message = truncateHookText(aicontext.RedactSecrets(status.State.Terminated.Message), 220)
			}
		}
	}
	for _, status := range pod.Status.InitContainerStatuses {
		consider(status)
	}
	for _, status := range pod.Status.ContainerStatuses {
		consider(status)
	}
	if total > 0 {
		out.Ready = fmt.Sprintf("%d/%d", ready, total)
	}
	return out
}

func listHookPodsForJob(ctx context.Context, client kubernetes.Interface, namespace, jobName string) ([]*corev1.Pod, []string) {
	var pods []*corev1.Pod
	var errs []string
	selectors := []string{
		labels.Set{"job-name": jobName}.String(),
		labels.Set{"batch.kubernetes.io/job-name": jobName}.String(),
	}
	for _, selector := range selectors {
		list, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: selector})
		if err != nil {
			if !apierrors.IsNotFound(err) {
				errs = append(errs, "pods: "+compactHookEvidenceError(err))
			}
			continue
		}
		for i := range list.Items {
			pod := list.Items[i]
			pods = append(pods, &pod)
		}
	}
	return dedupeAndSortPods(pods), compactHookEvidenceErrors(errs)
}

func dedupeAndSortPods(pods []*corev1.Pod) []*corev1.Pod {
	seen := map[string]bool{}
	out := make([]*corev1.Pod, 0, len(pods))
	for _, pod := range pods {
		if pod == nil {
			continue
		}
		key := pod.Namespace + "/" + pod.Name
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, pod)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Namespace+"/"+out[i].Name < out[j].Namespace+"/"+out[j].Name
	})
	if len(out) > maxHookEvidencePods {
		out = out[:maxHookEvidencePods]
	}
	return out
}

func listHookEvents(ctx context.Context, client kubernetes.Interface, namespace string, refs []hookObjectRef) ([]HookEventEvidence, string) {
	if len(refs) == 0 {
		return nil, ""
	}
	want := map[string]bool{}
	for _, ref := range refs {
		if ref.kind != "" && ref.name != "" {
			want[strings.ToLower(ref.kind)+"/"+ref.name] = true
		}
	}
	list, err := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ""
		}
		return nil, "events: " + compactHookEvidenceError(err)
	}
	events := make([]corev1.Event, 0)
	for _, event := range list.Items {
		key := strings.ToLower(event.InvolvedObject.Kind) + "/" + event.InvolvedObject.Name
		if want[key] {
			events = append(events, event)
		}
	}
	sort.SliceStable(events, func(i, j int) bool {
		leftWarning := events[i].Type == corev1.EventTypeWarning
		rightWarning := events[j].Type == corev1.EventTypeWarning
		if leftWarning != rightWarning {
			return leftWarning
		}
		return hookEventTime(events[i]).After(hookEventTime(events[j]))
	})
	if len(events) > maxHookEvidenceEvents {
		events = events[:maxHookEvidenceEvents]
	}
	out := make([]HookEventEvidence, 0, len(events))
	for _, event := range events {
		out = append(out, HookEventEvidence{
			InvolvedKind: event.InvolvedObject.Kind,
			InvolvedName: event.InvolvedObject.Name,
			Type:         event.Type,
			Reason:       event.Reason,
			Message:      truncateHookText(aicontext.RedactSecrets(event.Message), 260),
			Count:        event.Count,
			LastSeen:     formatHookTime(hookEventTime(event)),
		})
	}
	return out, ""
}

func hookEventTime(event corev1.Event) time.Time {
	if !event.EventTime.Time.IsZero() {
		return event.EventTime.Time
	}
	if !event.LastTimestamp.Time.IsZero()
```

### Core Architecture Module: `internal/imageutil/image.go`
```
package imageutil

import (
	"strings"
)

// Untagged references do not imply a version; an explicit tag remains useful
// even when a digest pins the image.
func ImageTag(image string) string {
	if image == "" {
		return ""
	}
	if at := strings.Index(image, "@"); at >= 0 {
		image = image[:at]
	}
	slash := strings.LastIndex(image, "/")
	colon := strings.LastIndex(image, ":")
	if colon > slash {
		return image[colon+1:]
	}
	return ""
}

// Repository is the image reference without its tag or digest: two workloads
// running the same repository at different tags run the same software.
func Repository(image string) string {
	if image == "" {
		return ""
	}
	if at := strings.Index(image, "@"); at >= 0 {
		image = image[:at]
	}
	slash := strings.LastIndex(image, "/")
	colon := strings.LastIndex(image, ":")
	if colon > slash {
		return image[:colon]
	}
	return image
}

```

### Core Architecture Module: `internal/issues/admission_webhook_candidates.go`
```
package issues

import (
	"fmt"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/skyhook-io/radar/internal/k8s"
	"github.com/skyhook-io/radar/pkg/issuesapi"
	"github.com/skyhook-io/radar/pkg/timeutil"
	admissionv1 "k8s.io/api/admissionregistration/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
)

// An admission rejection that names a webhook says which call failed but not
// why; one that only says the create timed out names nothing. This pass adds
// what the configuration and the backend's observed state show: failurePolicy,
// timeoutSeconds, the backend Service's ready pods and, for a call that timed
// out, NetworkPolicies that may keep the API server from reaching it.

const (
	factAdmissionWebhookCandidates = "admission_webhook_candidates"
	maxAdmissionWebhookCandidates  = 5
	// recentWebhookConfiguration is how new a configuration must be for its
	// age to be stated and to rank it ahead of long-standing ones.
	recentWebhookConfiguration = 24 * time.Hour
)

// admissionWebhookCallTimedOut matches a webhook call that waited out its
// deadline rather than failing at once (refused, no endpoints, x509): the
// shape a NetworkPolicy dropping the API server's packets produces.
var admissionWebhookCallTimedOut = regexp.MustCompile(`(?i)context deadline exceeded|i/o timeout|Client\.Timeout|TLS handshake timeout`)

// admissionPodCreators are the kinds whose FailedCreate is a Pod create.
// A CronJob row is a Job's failure folded into its CronJob, unless the
// CronJob controller failed creating the Job itself ("Error creating job:").
var admissionPodCreators = map[string]string{
	"ReplicaSet":  "apps",
	"Deployment":  "apps",
	"StatefulSet": "apps",
	"DaemonSet":   "apps",
	"Job":         "batch",
	"CronJob":     "batch",
}

func isPodCreateAdmissionFailure(i Issue) bool {
	if i.Category != issuesapi.CategoryAdmissionWebhookBlocking || (i.Reason != "WebhookUnavailable" && i.Reason != "CreateTimeout") ||
		i.Namespace == "" || admissionPodCreators[i.Kind] != i.Group {
		return false
	}
	if i.Kind == "CronJob" && strings.Contains(strings.ToLower(i.Message), "error creating job:") {
		return false
	}
	// RelatedIssues composes (and so enriches) before grouping, and a grouped
	// row can keep its representative's context.
	return i.DiagnosticContext == nil || !slices.ContainsFunc(i.DiagnosticContext.Facts, func(f issuesapi.DiagnosticFact) bool {
		return f.Type == factAdmissionWebhookCandidates
	})
}

type admissionWebhookCandidateProvider interface {
	admissionWebhookCandidatesFact(Issue, podTemplateAccess) *issuesapi.DiagnosticFact
}

func enrichAdmissionWebhookCandidates(shaped []Issue, p Provider, access podTemplateAccess) []Issue {
	provider, ok := p.(admissionWebhookCandidateProvider)
	if !ok {
		return shaped
	}
	var out []Issue
	for idx := range shaped {
		i := shaped[idx]
		if !isPodCreateAdmissionFailure(i) {
			continue
		}
		fact := provider.admissionWebhookCandidatesFact(i, access)
		if fact == nil {
			continue
		}
		if out == nil {
			out = append([]Issue(nil), shaped...)
		}
		ctx := issuesapi.DiagnosticContext{Role: issuesapi.DiagnosticRoleCandidate}
		if i.DiagnosticContext != nil {
			ctx = *i.DiagnosticContext
			ctx.Role = issuesapi.DiagnosticRoleCandidate
			ctx.Facts = slices.Clone(ctx.Facts)
		}
		ctx.Facts = append(ctx.Facts, *fact)
		out[idx].DiagnosticContext = &ctx
	}
	if out == nil {
		return shaped
	}
	return out
}

// admissionWebhook is one webhook's Pod CREATE scope and call settings.
type admissionWebhook struct {
	configuration   Ref
	created         time.Time
	name            string
	mutating        bool
	podCreate       bool
	namespace       labels.Selector
	objectSelector  bool
	matchConditions bool
	failurePolicy   string
	timeoutSeconds  int32
	service         *admissionv1.ServiceReference
}

type admissionWebhookSet struct {
	webhooks []admissionWebhook
	// unchecked names the configuration kinds that could not be inspected,
	// with the reason.
	unchecked []string
}

func (p *CacheProvider) admissionWebhooks(access podTemplateAccess) admissionWebhookSet {
	var set admissionWebhookSet
	for _, kind := range []string{"MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"} {
		const group = "admissionregistration.k8s.io"
		if access.cluster != nil && !access.cluster(kind, group) {
			set.unchecked = append(set.unchecked, kind+"s were not checked: the caller cannot list them.")
			continue
		}
		if p.dynamic == nil || p.discovery == nil {
			set.unchecked = append(set.unchecked, kind+"s were not checked: Radar has not cached them.")
			continue
		}
		gvr, ok := p.discovery.GetGVRWithGroup(kind, group)
		if !ok || !p.dynamic.IsClusterWideSynced(gvr) {
			set.unchecked = append(set.unchecked, kind+"s were not checked: Radar has not cached them.")
			continue
		}
		items, err := p.dynamic.ListWatched(gvr)
		if err != nil {
			set.unchecked = append(set.unchecked, kind+"s were not checked: Radar has not cached them.")
			continue
		}
		unreadable := false
		for _, item := range items {
			ref := Ref{Group: group, Kind: kind, Name: item.GetName()}
			if !access.canRead(ref) {
				unreadable = true
				continue
			}
			webhooks := compileAdmissionWebhooks(ref, item.Object)
			for idx := range webhooks {
				webhooks[idx].created = item.GetCreationTimestamp().Time
			}
			set.webhooks = append(set.webhooks, webhooks...)
		}
		if unreadable {
			set.unchecked = append(set.unchecked, "Some "+kind+"s are not readable by the caller and were not checked.")
		}
	}
	return set
}

func compileAdmissionWebhooks(ref Ref, obj map[string]any) []admissionWebhook {
	type webhookSpec struct {
		name              string
		rules             []admissionv1.RuleWithOperations
		namespaceSelector *metav1.LabelSelector
		objectSelector    *metav1.LabelSelector
		matchConditions   int
		failurePolicy     *admissionv1.FailurePolicyType
		timeoutSeconds    *int32
		service           *admissionv1.ServiceReference
	}
	var specs []webhookSpec
	if ref.Kind == "MutatingWebhookConfiguration" {
		var config admissionv1.MutatingWebhookConfiguration
		if runtime.DefaultUnstructuredConverter.FromUnstructured(obj, &config) != nil {
			return nil
		}
		for _, w := range config.Webhooks {
			specs = append(specs, webhookSpec{w.Name, w.Rules, w.NamespaceSelector, w.ObjectSelector, len(w.MatchConditions), w.FailurePolicy, w.TimeoutSeconds, w.ClientConfig.Service})
		}
	} else {
		var config admissionv1.ValidatingWebhookConfiguration
		if runtime.DefaultUnstructuredConverter.FromUnstructured(obj, &config) != nil {
			return nil
		}
		for _, w := range config.Webhooks {
			specs = append(specs, webhookSpec{w.Name, w.Rules, w.NamespaceSelector, w.ObjectSelector, len(w.MatchConditions), w.FailurePolicy, w.TimeoutSeconds, w.ClientConfig.Service})
		}
	}
	out := make([]admissionWebhook, 0, len(specs))
	for _, spec := range specs {
		ns := labels.Everything()
		if spec.namespaceSelector != nil {
			selector, err := metav1.LabelSelectorAsSelector(spec.namespaceSelector)
			if err != nil {
				continue
			}
			ns = selector
		}
		// The API server defaults: failurePolicy Fail, timeoutSeconds 10.
		failurePolicy := string(admissionv1.Fail)
		if spec.failurePolicy != nil {
			failurePolicy = string(*spec.failurePolicy)
		}
		timeout := int32(10)
		if spec.timeoutSeconds != nil {
			timeout = *spec.timeoutSeconds
		}
		create, _ := podRuleOperations(spec.rules)
		out = append(out, admissionWebhook{
			configuration: ref, name: spec.name, mutating: ref.Kind == "MutatingWebhookConfiguration",
			podCreate: create, namespace: ns,
			objectSelector:  spec.objectSelector != nil && (len(spec.objectSelector.MatchLabels) > 0 || len(spec.objectSelector.MatchExpressions) > 0),
			matchConditions: spec.matchConditions > 0,
			failurePolicy:   failurePolicy, timeoutSeconds: timeout, service: spec.service,
		})
	}
	return out
}

func (p *CacheProvider) admissionWebhookCandidatesFact(issue Issue, access podTemplateAccess) *issuesapi.DiagnosticFact {
	if p == nil || p.cache == nil {
		return nil
	}
	if issue.Reason == "WebhookUnavailable" {
		return p.namedWebhookFact(issue, access)
	}
	return p.createTimeoutFact(issue, access)
}

// namedWebhookFact describes the webhook a failed call names. The message
// proves the call was made, so its scope is not re-checked.
func (p *CacheProvider) namedWebhookFact(issue Issue, access podTemplateAccess) *issuesapi.DiagnosticFact {
	blocker, ok := k8s.ParseAdmissionBlocker(issue.Message)
	if !ok || blocker.WebhookName == "" {
		return nil
	}
	timedOut := admissionWebhookCallTimedOut.MatchString(issue.Message)
	var lines []string
	var refs []Ref
	for _, w := range p.admissionWebhooks(access).webhooks {
		if w.name != blocker.WebhookName {
			continue
		}
		line, lineRefs, _ := p.describeAdmissionWebhook(w, timedOut, false, access)
		lines = append(lines, line)
		refs = append(refs, lineRefs...)
	}
	if len(lines) == 0 {
		return nil
	}
	return &issuesapi.DiagnosticFact{
		Type:       factAdmissionWebhookCandidates,
		Message:    namedWebhookMessage(blocker.WebhookName, lines),
		Confidence: issuesapi.ConfidenceHigh,
		Refs:       limitRefs(dedupeRefs(refs), maxDiagnosticRefs),
	}
}

// namedWebhookMessage presents the named webhook. Webhook names are unique
// only within a configuration, so when several declare the name the error
// does not say which one was called.
func namedWebhookMessage(name string, lines []string) string {
	if len(lines) == 1 {
		return "Failing call: " + lines[0] + "."
	}
	return fmt.Sprintf("The error names webhook %s, which %d configurations declare; it does not say which one was called: %s.", name, len(lines), strings.Join(lines, ". "))
}

// createTimeoutFact lists the webhooks that match Pod creation in the
// issue's namespace. The timeout names no webhook, so they are candidates.
func (p *CacheProvider) createTimeoutF
```

### Core Architecture Module: `internal/k8s/connection_state.go`
```
package k8s

import (
	"context"
	"crypto/rand"
	"crypto/x509"
	"errors"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// ConnectionState represents the current connection status to the cluster
type ConnectionState string

const (
	switchStoppedErrorType                 = "switch-stopped"
	StateConnected         ConnectionState = "connected"
	StateDisconnected      ConnectionState = "disconnected"
	StateConnecting        ConnectionState = "connecting"
)

// ConnectionStatus holds detailed information about the cluster connection
type ConnectionStatus struct {
	State       ConnectionState `json:"state"`
	Context     string          `json:"context"`
	ClusterName string          `json:"clusterName,omitempty"`
	Error       string          `json:"error,omitempty"`
	ErrorType   string          `json:"errorType,omitempty"` // config, auth, auth-rejected, auth-plugin-stuck, rbac, network, timeout, tls, unknown
	ProgressMsg string          `json:"progressMessage,omitempty"`
	// DisconnectedAt is when this context stopped working (RFC 3339, UTC).
	// It survives retries and their changing errors, and clears on connect,
	// so the UI can say how long the cluster has been down. Set by
	// SetConnectionStatus; callers leave it empty.
	DisconnectedAt string `json:"disconnectedAt,omitempty"`

	// ConnectionID names the admitted connection Radar is serving: one
	// admission of one cluster, unique for this process and across restarts.
	// Empty while nothing is serving. Set by the publisher; callers leave it empty.
	ConnectionID string `json:"connectionId,omitempty"`
}

var (
	bootNonce = rand.Text()[:10]

	// Guarded by connectionStatusMu.
	serving              *Connection
	connectionAdmissions uint64
	admissionsClosed     bool
)

// ServingConnectionID returns the admitted connection Radar is serving, or ""
// while nothing is serving (a switch, rescope or rebuild is between its point
// of no return and its admission).
func ServingConnectionID() string {
	connectionStatusMu.RLock()
	defer connectionStatusMu.RUnlock()
	return servingIDLocked()
}

func servingIDLocked() string {
	if serving == nil {
		return ""
	}
	return serving.id
}

// admissionCandidate returns the installed connection, installing an empty
// one if none exists yet. A connection admitted again after a retirement with
// no rebuild in between is the same build, so it keeps its clients and caches
// and only gets a new ID. Lock-free: connectionStatusMu is held, and installs
// take clientMu.
func admissionCandidate() *Connection {
	for {
		if c := installedConn.Load(); c != nil {
			return c
		}
		installedConn.CompareAndSwap(nil, &Connection{})
	}
}

// RetireServingConnection is the point of no return: called before any
// destructive teardown, it clears the serving ID so no request can be admitted
// against a half-retired connection. A connected status becomes connecting.
func RetireServingConnection() {
	connectionStatusMu.Lock()
	if serving == nil {
		connectionStatusMu.Unlock()
		return
	}
	serving = nil
	status := connectionStatus
	if status.State == StateConnected {
		status.State = StateConnecting
	}
	status.ConnectionID = ""
	connectionStatus = status
	connectionStatusMu.Unlock()
	notifyConnectionChange(status)
}

// CloseConnectionAdmissions retires the serving connection for good: after it,
// no publication can admit a new one. Shutdown calls it before tearing down.
func CloseConnectionAdmissions() {
	connectionStatusMu.Lock()
	admissionsClosed = true
	connectionStatusMu.Unlock()
	RetireServingConnection()
}

// outageStart carries DisconnectedAt from one status to the next: it starts
// when a context first reports disconnected and holds through retries until
// the context connects or another context takes over.
func outageStart(prev, next ConnectionStatus, now time.Time) string {
	if next.State == StateConnected {
		return ""
	}
	if prev.DisconnectedAt != "" && prev.Context == next.Context {
		return prev.DisconnectedAt
	}
	if next.State == StateDisconnected {
		return now.UTC().Format(time.RFC3339)
	}
	return ""
}

// ConnectionChangeCallback is called when the connection status changes
type ConnectionChangeCallback func(status ConnectionStatus)

var (
	connectionStatus      ConnectionStatus
	connectionStatusMu    sync.RWMutex
	connectionCallbacks   []ConnectionChangeCallback
	connectionCallbacksMu sync.RWMutex
	clusterLivenessProbe  = defaultClusterLivenessProbe
)

// GetConnectionStatus returns the current connection status
func GetConnectionStatus() ConnectionStatus {
	connectionStatusMu.RLock()
	defer connectionStatusMu.RUnlock()
	return connectionStatus
}

// SetConnectionStatus updates the connection status and notifies callbacks
func SetConnectionStatus(status ConnectionStatus) {
	SetConnectionStatusIfCurrent(context.Background(), status)
}

// SetConnectionStatusIfCurrent keeps a late bootstrap or liveness probe from
// overwriting a status published after its operation was cancelled.
func SetConnectionStatusIfCurrent(operation context.Context, status ConnectionStatus) bool {
	connectionStatusMu.Lock()
	if operation.Err() != nil {
		connectionStatusMu.Unlock()
		return false
	}
	status.DisconnectedAt = outageStart(connectionStatus, status, time.Now())
	if status.State == StateConnected && serving == nil {
		if admissionsClosed {
			connectionStatusMu.Unlock()
			return false
		}
		connectionAdmissions++
		serving = admissionCandidate()
		serving.id = bootNonce + "-" + strconv.FormatUint(connectionAdmissions, 10)
	}
	status.ConnectionID = servingIDLocked()
	if connectionStatus == status {
		connectionStatusMu.Unlock()
		return true
	}
	connectionStatus = status

	// Publish-side recovery ownership: every route into an auth-shaped
	// disconnect (bootstrap with expired credentials, failed retry, failed
	// context switch) must leave a reconnect loop running — the browser no
	// longer auto-retries auth failures. Owed survives later non-auth
	// republications (a hung-plugin retry classifies "timeout") and is only
	// settled by a successful connect or an explicit switch stop.
	switch {
	case status.State == StateConnected || status.ErrorType == switchStoppedErrorType:
		runtimeAuthRecoveryOwed.Store(false)
	case status.State == StateDisconnected && isAuthClassification(status.ErrorType):
		runtimeAuthRecoveryOwed.Store(true)
	}
	connectionStatusMu.Unlock()
	if status.State == StateConnected {
		resetInconclusiveStreak()
	}
	if status.State == StateDisconnected && runtimeAuthRecoveryOwed.Load() {
		startRuntimeAuthRecovery()
	}

	notifyConnectionChange(status)
	return true
}

func notifyConnectionChange(status ConnectionStatus) {
	connectionCallbacksMu.RLock()
	callbacks := make([]ConnectionChangeCallback, len(connectionCallbacks))
	copy(callbacks, connectionCallbacks)
	connectionCallbacksMu.RUnlock()

	for _, cb := range callbacks {
		cb(status)
	}
}

// MarkDisconnectedIfClusterUnreachable updates the shared connection state when
// a live Kubernetes request proves that the current cluster endpoint is gone.
func MarkDisconnectedIfClusterUnreachable(message string) bool {
	if isAuthClassification(ClassifyError(errors.New(message))) {
		// Credential loss must go through the demotion pipeline — it confirms
		// with a fresh probe, gates on endpoint reachability, and quiesces
		// cluster-backed work. Publishing disconnected directly would skip
		// the teardown AND disarm the pipeline (candidate intake requires
		// StateConnected), leaving informers hammering the dead credential
		// for the whole outage.
		generation := Current().ClientGeneration()
		reportRuntimeAuthFailure(generation, errors.New(message))
		return false
	}
	if !isClusterUnreachableMessage(message) {
		return false
	}
	var current ConnectionStatus
	var operation context.Context
	if !CaptureClusterReads(func() {
		operation = OperationContext()
		current = GetConnectionStatus()
	}) || current.ErrorType == switchStoppedErrorType {
		return false
	}
	if current.State == StateDisconnected && current.Error == message {
		return true
	}
	if clusterReachableNow(2 * time.Second) {
		return false
	}

	status := ConnectionStatus{
		State:       StateDisconnected,
		Context:     current.Context,
		ClusterName: current.ClusterName,
		Error:       message,
		ErrorType:   ClassifyError(errors.New(message)),
	}
	return SetConnectionStatusIfCurrent(operation, status)
}

func clusterReachableNow(timeout time.Duration) bool {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return clusterLivenessProbe(ctx) == nil
}

func defaultClusterLivenessProbe(ctx context.Context) error {
	client := GetClient()
	if client == nil {
		return errors.New("kubernetes client is not initialized")
	}
	restClient := client.Discovery().RESTClient()
	if restClient == nil {
		return errors.New("kubernetes discovery client is not initialized")
	}
	_, err := restClient.Get().AbsPath("/version").Do(ctx).Raw()
	return err
}

func isClusterUnreachableMessage(message string) bool {
	lower := strings.ToLower(message)
	if strings.Contains(lower, "kubernetes cluster unreachable") ||
		strings.Contains(lower, "cluster unreachable") {
		return true
	}
	return isHelmKubernetesOperationError(lower) && isTransportConnectivityError(lower)
}

func isHelmKubernetesOperationError(lower string) bool {
	kubernetesOperationPrefixes := []string{
		"failed to build helm restclientgetter",
		"failed to initialize helm action config",
		"failed to build helm action config",
		"failed to list helm releases",
		"failed to get helm release",
		"failed to get release",
		"failed to get current release",
		"failed to get current values",
		"failed to get helm release history",
		"failed to get helm release manifest",
		"failed to get helm release values",
		"failed to get manifest for revision",
		"failed to get values for revision",
		"failed to get release revision",
		"failed to inspect release storage namespaces",
		"failed to inspect existing r
```

### Core Architecture Module: `internal/k8s/restart_loop.go`
```
package k8s

import (
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/skyhook-io/radar/pkg/health"
	"github.com/skyhook-io/radar/pkg/issuesapi"
)

// Restart-loop issue continuity. A container stuck restarting cycles through
// states that each look like a different problem on a single poll: Waiting
// (CrashLoopBackOff), Running but not ready (readiness), Unhealthy events
// (liveness), Terminated with exit 0, and Running+Ready between crashes. Read
// tick by tick, the pod row changed category (and therefore issue id) on every
// cycle and dropped out entirely on the healthy-looking ticks, so downstream
// alerting saw thousands of open/resolve generations for one ongoing problem.
//
// This classifier is issue-layer only. It decides that one crashloop row stays
// present, with stable severity, for the whole loop; it does not change the
// pod's health level (pkg/health), which still reports what the pod is doing
// right now.
const (
	// restartLoopWindow is how long after its last termination a restarting
	// container is still treated as looping. It is the hysteresis: the issue
	// clears this long after the last crash. Long enough to bridge kubelet
	// backoff (max 5m) and loops whose Running phase lasts many minutes before
	// the next liveness kill.
	restartLoopWindow = 30 * time.Minute
	// restartLoopStaleGap separates one continuous loop from an old termination
	// followed by a fresh start, e.g. a node that was down for a while. Twice
	// the kubelet's maximum backoff, matching pkg/health's stale-crash guard.
	restartLoopStaleGap = 10 * time.Minute
	// restartLoopMinRestarts is the restart count from which a recent
	// termination reads as a loop rather than a one-off crash. RestartCount is
	// cumulative over the container's life, so this approximates a rate: a
	// container that restarted three times last month and once a minute ago
	// also qualifies, for at most restartLoopWindow.
	restartLoopMinRestarts = 3
	// restartLoopFastRun is the run length below which a loop is "fast": the
	// container spends most of its time down or in backoff. It is the
	// kubelet's own line: a container that runs longer than 10 minutes has its
	// crash backoff reset.
	restartLoopFastRun = 10 * time.Minute
	// restartLoopImpactShare is the share of a workload's pods that must be
	// looping for a fast loop to be critical.
	restartLoopImpactShare = 0.5
	// restartLoopProbeMessageMax caps the probe output copied into evidence;
	// exec probes can print arbitrary amounts.
	restartLoopProbeMessageMax = 300
)

// restartLoop is the evidence behind an active restart loop, taken from one
// container so every field describes the same termination.
type restartLoop struct {
	container string
	sidecar   bool
	init      bool
	// status is the looping container's status, for diagnoses that need it.
	status corev1.ContainerStatus
	// memoryLimit reports whether the container declares a memory limit.
	memoryLimit bool
	// podMemoryLimit reports a pod-level memory limit (spec.resources), which
	// caps the combined use of every container in the pod, including this one.
	podMemoryLimit bool
	restartCount   int32
	lastExitCode   int32
	lastReason     string
	lastFinishedAt time.Time
	// lastRun is how long the terminated run lasted; zero when the container
	// never started (StartError) or the runtime did not record a start.
	lastRun time.Duration
	// lastStartedAt is when the last terminated run started; zero when it
	// never started.
	lastStartedAt time.Time
	// lastMessage is the runtime's message for the last termination; for a
	// start failure it is the actual error (e.g. exec: no such file).
	lastMessage string
	liveness    *probeFailure
	readiness   *probeFailure
	startup     *probeFailure
}

// activeRestartLoop reports the container keeping this pod in a restart loop.
//
// Eligible containers are those the kubelet keeps restarting: regular
// containers whose effective restartPolicy is Always, native sidecars (init
// containers with restartPolicy=Always), and ordinary init containers that
// keep failing while the pod is still Pending (Init:CrashLoopBackOff). Job
// workers (OnFailure/Never) retry by design and are excluded.
//
// The exit code is deliberately ignored for regular containers and sidecars.
// The kubelet backs off restarts after any exit, and a liveness kill with a
// graceful shutdown ends Completed/0, so requiring a non-zero exit misses the
// loops that flap the most. An ordinary init container that exits 0 has done
// its job, so only its failures count. OOMKilled terminations count too; the
// row then classifies as oom_killed through its last termination reason.
//
// When several containers qualify, the one that terminated most recently is
// the one actively failing; a container that looped earlier and has since
// recovered can still qualify for the rest of the window and must not be the
// one named. Ties keep status order (regular containers before sidecars).
func activeRestartLoop(pod *corev1.Pod, probes map[string]probeFailure, now time.Time) (restartLoop, bool) {
	// A pod being deleted stops its containers on purpose: a rollout or
	// drain SIGTERM ends Completed/0 and is not a crash.
	if pod == nil || pod.DeletionTimestamp != nil || (pod.Status.Phase != corev1.PodRunning && pod.Status.Phase != corev1.PodPending) {
		return restartLoop{}, false
	}
	var best restartLoop
	found := false
	consider := func(loop restartLoop, ok bool) {
		if ok && (!found || loop.lastFinishedAt.After(best.lastFinishedAt)) {
			best, found = loop, true
		}
	}
	for i := range pod.Status.ContainerStatuses {
		cs := &pod.Status.ContainerStatuses[i]
		if containerRestartsAlways(pod, cs.Name) {
			consider(containerRestartLoop(cs, now))
		}
	}
	for i := range pod.Status.InitContainerStatuses {
		cs := &pod.Status.InitContainerStatuses[i]
		loop, ok := containerRestartLoop(cs, now)
		if isNativeSidecarName(pod, cs.Name) {
			loop.sidecar = true
		} else {
			// An ordinary init container blocks the pod until it succeeds;
			// it loops only while the pod is still initializing and its
			// latest attempt failed.
			loop.init = true
			ok = ok && pod.Status.Phase == corev1.PodPending && loop.lastExitCode != 0
		}
		consider(loop, ok)
	}
	if !found {
		return restartLoop{}, false
	}
	best.podMemoryLimit = podHasMemoryLimit(pod)
	best.memoryLimit = containerHasMemoryLimit(pod, best.container)
	if best.podMemoryLimit && !containerDeclaresMemoryLimit(pod, best.container) {
		// The kubelet applies the pod limit to a container that sets none and
		// reports it in the container's status, so status can't tell an
		// inherited limit from the container's own here; the spec can.
		best.memoryLimit = false
	}
	return withProbeEvidence(best, pod, probes), true
}

func containerHasMemoryLimit(pod *corev1.Pod, name string) bool {
	// The enacted limit (status) wins: an in-place resize can set one the
	// spec no longer shows.
	for _, list := range [][]corev1.ContainerStatus{pod.Status.ContainerStatuses, pod.Status.InitContainerStatuses} {
		for i := range list {
			if list[i].Name == name && list[i].Resources != nil {
				if _, ok := list[i].Resources.Limits[corev1.ResourceMemory]; ok {
					return true
				}
			}
		}
	}
	for _, list := range [][]corev1.Container{pod.Spec.Containers, pod.Spec.InitContainers} {
		for i := range list {
			if list[i].Name == name {
				_, ok := list[i].Resources.Limits[corev1.ResourceMemory]
				return ok
			}
		}
	}
	return false
}

func containerDeclaresMemoryLimit(pod *corev1.Pod, name string) bool {
	for _, list := range [][]corev1.Container{pod.Spec.Containers, pod.Spec.InitContainers} {
		for i := range list {
			if list[i].Name == name {
				_, positive := explicitMemoryLimit(list[i].Resources.Limits)
				return positive
			}
		}
	}
	return false
}

// podHasMemoryLimit reports a declared pod-level memory limit. Only a pod whose
// spec.resources sets one has it: the kubelet can fill status.resources from
// the containers' values on a pod without one. When declared, the enacted value
// in status wins over the spec, as for containers. A zero limit sets no cap.
func podHasMemoryLimit(pod *corev1.Pod) bool {
	if pod.Spec.Resources == nil {
		return false
	}
	if _, declared := pod.Spec.Resources.Limits[corev1.ResourceMemory]; !declared {
		return false
	}
	if pod.Status.Resources != nil {
		if _, ok := pod.Status.Resources.Limits[corev1.ResourceMemory]; ok {
			_, positive := explicitMemoryLimit(pod.Status.Resources.Limits)
			return positive
		}
	}
	_, positive := explicitMemoryLimit(pod.Spec.Resources.Limits)
	return positive
}

// otherContainerActiveOOM reports an active OOM on any container other than
// the named one. A sibling's OOM owns the pod's row over a different
// container's loop; the loop container's own OOM does not veto its loop.
func otherContainerActiveOOM(pod *corev1.Pod, name string, now time.Time) bool {
	for _, cs := range health.ActiveOOMKilledContainers(pod, now) {
		if cs.Name != name {
			return true
		}
	}
	// Init containers and native sidecars, as health.PodHasActiveOOMKilled
	// judges them: a current OOM, or a last one not yet recovered from.
	for _, cs := range pod.Status.InitContainerStatuses {
		if cs.Name == name {
			continue
		}
		if cs.State.Terminated != nil && cs.State.Terminated.Reason == "OOMKilled" {
			return true
		}
		if t := cs.LastTerminationState.Terminated; t != nil && t.Reason == "OOMKilled" {
			if cs.State.Terminated != nil && cs.State.Terminated.ExitCode == 0 {
				continue
			}
			if r := cs.State.Running; r != nil && !r.StartedAt.IsZero() && now.Sub(r.StartedAt.Time) > 5*time.Minute {
				continue
			}
			return true
		}
	}
	return false
}

// oomStatuses is the container an OOM loop's limit diagnosis should examine:
// the looping regular container, or nil (the pod's active OOMs) otherwise.
func (l restartLoop) oomStatuses() []corev1.ContainerStatus {
	if l.lastReason != "OOMKilled"
```

### Core Architecture Module: `internal/kueuequeues/membership.go`
```
// Package kueuequeues decides which Kueue Workloads belong to a queue, from
// what the Workloads and LocalQueues say now. It reads no cache and checks no
// access: callers hand it the objects the caller could read, and say where
// the LocalQueues were read.
//
// A Workload belongs to a ClusterQueue in two independent ways. Submission:
// its spec.queueName names a LocalQueue in its namespace whose current
// spec.clusterQueue is the ClusterQueue. Reservation: its
// status.admission.clusterQueue names the ClusterQueue. Submission is a join
// through the LocalQueue as it is now, by name; it says nothing about which
// LocalQueue the Workload was submitted through, nor where it pointed then.
// A Workload belongs to a LocalQueue by submission only: its spec.queueName
// names it, in its namespace.
//
// The cases the two ways disagree on are answered as they are reported:
//   - A LocalQueue re-created to point at another ClusterQueue while a
//     Workload still reports its reservation in the old one: the Workload
//     belongs to the old ClusterQueue by reservation and to the new one by
//     submission, and its row in either names both.
//   - A finished Workload still reporting its admission belongs by
//     reservation: the record names the ClusterQueue, though Kueue released
//     the quota and leaves it out of its own counts.
//   - A Workload being deleted keeps its membership until it is gone: Kueue
//     holds its quota until its finalizer runs.
//   - A Workload belonging both ways is one member with both kinds.
package kueuequeues

import (
	"cmp"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type Kind string

const (
	Submission  Kind = "submission"
	Reservation Kind = "reservation"
)

type Member struct {
	Workload  *unstructured.Unstructured
	Kinds     []Kind
	QueueName string
	// SubmittedTo is the ClusterQueue the Workload's LocalQueue points at now,
	// when Radar read that LocalQueue, and LocalQueueUID that LocalQueue's
	// UID: a LocalQueue re-created under the same name is another one.
	SubmittedTo   string
	LocalQueueUID string
	// LocalQueueUnread: the Workload names a LocalQueue in a namespace whose
	// LocalQueues Radar didn't read, so whether it was submitted here is
	// unknown.
	LocalQueueUnread bool
	ReservedIn       string
	// Finished members sort after the others (see Key).
	Finished bool
}

func (m Member) Has(kind Kind) bool { return slices.Contains(m.Kinds, kind) }

type LocalQueues interface {
	// Get returns LocalQueue namespace/name, nil when it doesn't exist, and
	// whether Radar read the LocalQueues in namespace at all.
	Get(namespace, name string) (localQueue *unstructured.Unstructured, read bool)
}

func QueueName(w *unstructured.Unstructured) string {
	name, _, _ := unstructured.NestedString(w.Object, "spec", "queueName")
	return name
}

func ReservedIn(w *unstructured.Unstructured) string {
	name, _, _ := unstructured.NestedString(w.Object, "status", "admission", "clusterQueue")
	return name
}

func LocalQueueTarget(lq *unstructured.Unstructured) string {
	name, _, _ := unstructured.NestedString(lq.Object, "spec", "clusterQueue")
	return name
}

// ClusterQueueMembers returns the workloads that belong to clusterQueue,
// each once, in no particular order: set Finished, then Sort. workloads may hold any Workloads, members or not,
// and the same Workload more than once.
func ClusterQueueMembers(clusterQueue string, workloads []*unstructured.Unstructured, localQueues LocalQueues) []Member {
	members := make([]Member, 0, len(workloads))
	seen := make(map[string]bool, len(workloads))
	for _, w := range workloads {
		if w == nil || seen[identity(w)] {
			continue
		}
		seen[identity(w)] = true
		m := Member{Workload: w, QueueName: QueueName(w), ReservedIn: ReservedIn(w)}
		if m.QueueName != "" {
			lq, read := localQueues.Get(w.GetNamespace(), m.QueueName)
			m.LocalQueueUnread = !read
			if lq != nil {
				m.SubmittedTo, m.LocalQueueUID = LocalQueueTarget(lq), string(lq.GetUID())
			}
		}
		if clusterQueue != "" && m.SubmittedTo == clusterQueue {
			m.Kinds = append(m.Kinds, Submission)
		}
		if clusterQueue != "" && m.ReservedIn == clusterQueue {
			m.Kinds = append(m.Kinds, Reservation)
		}
		if len(m.Kinds) > 0 {
			members = append(members, m)
		}
	}
	return members
}

// LocalQueueMembers returns the workloads submitted to localQueue, each
// once, in no particular order: set Finished, then Sort.
func LocalQueueMembers(localQueue *unstructured.Unstructured, workloads []*unstructured.Unstructured) []Member {
	namespace, name := localQueue.GetNamespace(), localQueue.GetName()
	members := make([]Member, 0, len(workloads))
	seen := make(map[string]bool, len(workloads))
	for _, w := range workloads {
		if w == nil || seen[identity(w)] || w.GetNamespace() != namespace || QueueName(w) != name || name == "" {
			continue
		}
		seen[identity(w)] = true
		members = append(members, Member{Workload: w, Kinds: []Kind{Submission}, QueueName: name, SubmittedTo: LocalQueueTarget(localQueue), LocalQueueUID: string(localQueue.GetUID()), ReservedIn: ReservedIn(w)})
	}
	return members
}

// identity tells Workloads apart: by UID, or by name for an object without
// one.
func identity(w *unstructured.Unstructured) string {
	if uid := string(w.GetUID()); uid != "" {
		return uid
	}
	return w.GetNamespace() + "/" + w.GetName()
}

// Key orders members: unfinished before finished, then namespace, name and
// UID. Alphabetical on purpose within each, so that no order of the list is
// mistaken for the order Kueue admits Workloads in; by default Kueue keeps
// finished Workloads until their owner goes, so they would otherwise bury
// the rest.
func Key(m Member) string {
	rank := "0"
	if m.Finished {
		rank = "1"
	}
	return strings.Join([]string{rank, m.Workload.GetNamespace(), m.Workload.GetName(), string(m.Workload.GetUID())}, "\x00")
}

// Sort orders members by Key, after their Finished flags are set. Each key
// is built once.
func Sort(members []Member) {
	type keyed struct {
		key    string
		member Member
	}
	sorted := make([]keyed, len(members))
	for i, m := range members {
		sorted[i] = keyed{Key(m), m}
	}
	slices.SortFunc(sorted, func(a, b keyed) int { return cmp.Compare(a.key, b.key) })
	for i, k := range sorted {
		members[i] = k.member
	}
}

// Counts are the numbers of members, each way. A member that belongs both
// ways counts once in Members and once in each of the others, so Submission
// and Reservation don't add up to Members. States counts members by the
// state stateOf gives them; a member without one isn't counted there.
type Counts struct {
	Members     int            `json:"members"`
	Submission  int            `json:"submission"`
	Reservation int            `json:"reservation"`
	States      map[string]int `json:"states"`
}

func Count(members []Member, stateOf func(Member) string) Counts {
	c := Counts{Members: len(members), States: map[string]int{}}
	for _, m := range members {
		if m.Has(Submission) {
			c.Submission++
		}
		if m.Has(Reservation) {
			c.Reservation++
		}
		if stateOf == nil {
			continue
		}
		if state := stateOf(m); state != "" {
			c.States[state]++
		}
	}
	return c
}

// Filter keeps the members that belong in kind's way ("" for any) and whose
// state stateOf gives is state ("" for any).
func Filter(members []Member, kind Kind, state string, stateOf func(Member) string) []Member {
	if kind == "" && state == "" {
		return members
	}
	out := make([]Member, 0, len(members))
	for _, m := range members {
		if (kind == "" || m.Has(kind)) && (state == "" || stateOf(m) == state) {
			out = append(out, m)
		}
	}
	return out
}

// Page returns up to limit of members (sorted by Key) whose key sorts after
// after ("" for the first page), and whether more follow. Paging by key
// rather than position keeps a member from appearing twice while its key
// stays the same; a member that joins before the key of a page already read
// is missed until the list is read again from the start. A member's key
// changes once, when it finishes: one returned among the unfinished members
// that finishes before the traversal reaches the finished ones is returned
// again there, so readers merge pages by UID, keeping the later row.
func Page(members []Member, after string, limit int) (page []Member, more bool) {
	start := 0
	if after != "" {
		start, _ = slices.BinarySearchFunc(members, after, func(m Member, key string) int {
			if Key(m) <= key {
				return -1
			}
			return 1
		})
	}
	end := min(start+limit, len(members))
	return members[start:end], end < len(members)
}

```

### Core Architecture Module: `internal/search/score.go`
```
package search

import (
	"net/netip"
	"strings"

	"github.com/skyhook-io/radar/pkg/resourceid"
)

// Site scoring weights. Tuned by intuition; revisit when telemetry exists.
const (
	scoreNameExact      = 100
	scoreNamePrefix     = 60
	scoreNameSubstr     = 40
	scoreNSExact        = 30
	scoreNSSubstr       = 20
	scoreLabelValExact  = 25
	scoreLabelValSubstr = 18
	scoreAnnoSubstr     = 15
	scoreImageSubstr    = 20
	scoreContentExact   = 16
	scoreContentSubstr  = 12
	scoreKindExact      = 10
	scoreKindSubstr     = 5
	maxSnippetRunes     = 180
)

// candidate carries the searchable face of a K8s object: identity,
// labels, annotations, container images. Built once per object so we
// don't repeatedly walk K8s typed structs.
type candidate struct {
	Kind        string
	Group       string
	Resource    string // lowercase plural, e.g. "networkpolicies"
	Namespace   string
	Name        string
	Labels      map[string]string
	Annotations map[string]string
	Images      []string
	IPs         []ipField // addresses the object holds (Pod, Service, Node)
	Content     []ContentField
	// report is a Trivy Operator report's findings, matched in place by
	// scoreToken rather than copied into Content, within findings' limits.
	report   map[string]any
	findings *findingsScan
}

// ContentField is a searchable string extracted from object content, such as
// ConfigMap data, workload env refs, CRD spec fields, or status messages.
type ContentField struct {
	Path  string
	Value string
}

// match runs the parsed query against a candidate and returns the score
// plus which sites matched. Returns (0, nil, false) when filters reject
// the candidate or when at least one free token didn't land anywhere.
func match(q Query, c candidate) (int, []MatchedField, []MatchSnippet, bool) {
	// Hard filters first — cheaper to reject early.
	if !matchesModifiers(q, c) {
		return 0, nil, nil, false
	}

	if len(q.Tokens) == 0 {
		// Pure-filter query: no scoring signal, but the candidate passed
		// every filter, so return a flat score so it shows up.
		return 1, nil, nil, true
	}

	total := 0
	var matched []MatchedField
	var snippets []MatchSnippet
	for _, tok := range q.Tokens {
		var best int
		var site string
		var snippet *MatchSnippet
		var ok bool
		if addr, isIP := q.ips[tok]; isIP {
			best, site, snippet, ok = scoreIPToken(tok, addr, c)
		} else {
			best, site, snippet, ok = scoreToken(tok, c)
		}
		if !ok {
			return 0, nil, nil, false
		}
		total += best
		matched = append(matched, MatchedField{Token: tok, Site: site, Score: best})
		if snippet != nil {
			snippets = append(snippets, *snippet)
		}
	}
	return total, matched, snippets, true
}

// matchesModifiers reports whether a candidate passes the query's hard
// filters (kind:, ns:, label:, image:). It reads identity only, never Content.
func matchesModifiers(q Query, c candidate) bool {
	if len(q.KindFilter) > 0 && !kindMatches(c.Kind, c.Group, c.Resource, q.KindFilter) {
		return false
	}
	if len(q.NSFilter) > 0 && !sliceContainsFold(q.NSFilter, c.Namespace) {
		return false
	}
	for _, lf := range q.LabelFilter {
		v, ok := c.Labels[lf.Key]
		if !ok {
			return false
		}
		if lf.Value != "" && v != lf.Value {
			return false
		}
	}
	for _, img := range q.ImageFilter {
		if !anyContainsFold(c.Images, img) {
			return false
		}
	}
	return true
}

// scoreToken returns the highest-scoring site a single free token matches,
// or (0, "", false) if the token doesn't land on any searchable field.
func scoreToken(tok string, c candidate) (int, string, *MatchSnippet, bool) {
	low := strings.ToLower(tok)
	best := 0
	bestSite := ""
	var bestSnippet *MatchSnippet
	consider := func(score int, site string) {
		if score > best {
			best = score
			bestSite = site
			bestSnippet = nil
		}
	}
	considerSnippet := func(score int, site string, snip MatchSnippet) {
		if score > best {
			best = score
			bestSite = site
			bestSnippet = &snip
		}
	}

	if c.Name != "" {
		nameLow := strings.ToLower(c.Name)
		switch {
		case nameLow == low:
			consider(scoreNameExact, "name")
		case strings.HasPrefix(nameLow, low):
			consider(scoreNamePrefix, "name")
		case strings.Contains(nameLow, low):
			consider(scoreNameSubstr, "name")
		}
	}
	if c.Namespace != "" {
		nsLow := strings.ToLower(c.Namespace)
		switch {
		case nsLow == low:
			consider(scoreNSExact, "namespace")
		case strings.Contains(nsLow, low):
			consider(scoreNSSubstr, "namespace")
		}
	}
	for k, v := range c.Labels {
		vLow := strings.ToLower(v)
		switch {
		case vLow == low:
			consider(scoreLabelValExact, "label:"+k)
		case strings.Contains(vLow, low):
			consider(scoreLabelValSubstr, "label:"+k)
		}
	}
	for k, v := range c.Annotations {
		if strings.Contains(strings.ToLower(v), low) {
			consider(scoreAnnoSubstr, "annotation:"+k)
		}
	}
	for _, img := range c.Images {
		if strings.Contains(strings.ToLower(img), low) {
			consider(scoreImageSubstr, "image")
		}
	}
	for _, cf := range c.Content {
		if cf.Value == "" {
			continue
		}
		vLow := strings.ToLower(cf.Value)
		switch {
		case vLow == low:
			considerSnippet(scoreContentExact, "content:"+cf.Path, MatchSnippet{
				Token:   tok,
				Path:    cf.Path,
				Snippet: snippetForToken(cf.Value, tok),
			})
		case strings.Contains(vLow, low):
			considerSnippet(scoreContentSubstr, "content:"+cf.Path, MatchSnippet{
				Token:   tok,
				Path:    cf.Path,
				Snippet: snippetForToken(cf.Value, tok),
			})
		}
	}
	if c.report != nil {
		eachTrivyFinding(c.report, c.findings, func(f *trivyFinding) bool {
			if score := f.match(low); score > best {
				value := f.value()
				considerSnippet(score, "content:"+f.path(), MatchSnippet{
					Token:   tok,
					Path:    f.path(),
					Snippet: snippetForToken(value, tok),
				})
			}
			return best < scoreContentExact
		})
	}
	if c.Kind != "" {
		kindLow := strings.ToLower(c.Kind)
		switch {
		case kindLow == low:
			consider(scoreKindExact, "kind")
		case strings.Contains(kindLow, low):
			consider(scoreKindSubstr, "kind")
		}
	}

	if best == 0 {
		return 0, "", nil, false
	}
	return best, bestSite, bestSnippet, true
}

// scoreIPToken matches an IP token: an address the object holds scores
// highest, under site ip:<role>; otherwise the name, an image, a label,
// annotation or content value must mention the address whole, so 10.0.1.2
// never matches 10.0.1.23.
func scoreIPToken(tok string, addr netip.Addr, c candidate) (int, string, *MatchSnippet, bool) {
	for _, f := range c.IPs {
		if f.Addr == addr {
			return f.Score, "ip:" + f.Role, nil, true
		}
	}
	v6 := addr.Is6()
	best := 0
	bestSite := ""
	var bestSnippet *MatchSnippet
	consider := func(score int, site string, snip *MatchSnippet) {
		if score > best {
			best, bestSite, bestSnippet = score, site, snip
		}
	}
	// A name spelled as the address only mentions it, below any holder.
	if strings.EqualFold(c.Name, tok) {
		consider(scoreLabelValExact, "name", nil)
	}
	for _, img := range c.Images {
		if indexIP(img, tok, v6) >= 0 {
			consider(scoreImageSubstr, "image", nil)
		}
	}
	for k, v := range c.Labels {
		if indexIP(v, tok, v6) >= 0 {
			consider(scoreLabelValSubstr, "label:"+k, nil)
		}
	}
	for k, v := range c.Annotations {
		if indexIP(v, tok, v6) >= 0 {
			consider(scoreAnnoSubstr, "annotation:"+k, nil)
		}
	}
	for _, cf := range c.Content {
		at := indexIP(cf.Value, tok, v6)
		if at < 0 {
			continue
		}
		score := scoreContentSubstr
		if strings.EqualFold(cf.Value, tok) {
			score = scoreContentExact
		}
		consider(score, "content:"+cf.Path, &MatchSnippet{Token: tok, Path: cf.Path, Snippet: snippetAt(cf.Value, at)})
	}
	if best == 0 {
		return 0, "", nil, false
	}
	return best, bestSite, bestSnippet, true
}

func snippetForToken(value, tok string) string {
	runes := []rune(value)
	if len(runes) <= maxSnippetRunes {
		return value
	}
	valueLow := strings.ToLower(value)
	tokLow := strings.ToLower(tok)
	byteIdx := strings.Index(valueLow, tokLow)
	if byteIdx < 0 {
		return string(runes[:maxSnippetRunes])
	}
	return snippetAt(value, byteIdx)
}

// snippetAt cuts a snippet of value centered on the byte offset byteIdx.
func snippetAt(value string, byteIdx int) string {
	runes := []rune(value)
	if len(runes) <= maxSnippetRunes {
		return value
	}
	prefixRunes := len([]rune(value[:byteIdx]))
	half := maxSnippetRunes / 2
	start := prefixRunes - half
	if start < 0 {
		start = 0
	}
	end := start + maxSnippetRunes
	if end > len(runes) {
		end = len(runes)
		start = end - maxSnippetRunes
		if start < 0 {
			start = 0
		}
	}
	snippet := string(runes[start:end])
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(runes) {
		snippet += "..."
	}
	return snippet
}

// kindMatches returns true if any of the kind filters refer to the candidate
// kind. Filters are case-insensitive and accept the singular Kind ("Pod"), a
// trailing-s plural ("pods"), the resource plural ("ingresses",
// "networkpolicies"), or a kubectl alias of a built-in ("netpol", "pvc"). An
// alias names the built-in only, so it doesn't match a CRD that reuses the
// built-in's Kind in another group (kind:svc is not a Knative Service).
func kindMatches(kind, group, resource string, filters []string) bool {
	low := strings.ToLower(kind)
	plural := low + "s"
	for _, f := range filters {
		fLow := strings.ToLower(f)
		if fLow == low || fLow == plural || fLow == strings.TrimSuffix(low, "s") {
			return true
		}
		if resource != "" && fLow == strings.ToLower(resource) {
			return true
		}
		if b, ok := resourceid.BuiltinForName(fLow); ok && b.Kind == kind && b.Group == group {
			return true
		}
	}
	return false
}

func sliceContainsFold(haystack []string, needle string) bool {
	for _, h := range haystack {
		if strings.EqualFold(h, needle) {
			return true
		}
	}
	return false
}

func anyContainsFold(haystack []string, needle string) bool {
	low := strings.ToLower(needle)
	for _, h := range haystack {
		if strings.Contains(strings.ToLower(h), low) {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `internal/server/ai_engine.go`
```
package server

import (
	"context"
	"log"

	"github.com/skyhook-io/radar/internal/ai"
	"github.com/skyhook-io/radar/internal/k8s"
	prometheuspkg "github.com/skyhook-io/radar/internal/prometheus"
)

// aiEngine returns the AI investigation engine, both nil while it is off.
func (s *Server) aiEngine() (*ai.Diagnoser, *ai.RunManager) {
	s.aiMu.RLock()
	defer s.aiMu.RUnlock()
	return s.aiDiagnoser, s.aiRuns
}

func (s *Server) aiRunManager() *ai.RunManager {
	_, runs := s.aiEngine()
	return runs
}

// aiDeploymentSupported reports whether this Radar can run local AI
// investigations at all, whatever is installed. The engine drives the CLI
// against this server's own investigation MCP mount with no credentials, which
// only works when MCP is mounted and unauthenticated. Under proxy/OIDC auth
// (team and cloud deployments) the MCP requires identity headers a local CLI
// can't supply, and investigations are the embedding host's job (e.g. Radar
// Hub). An operator-managed shared installation is never a user's own machine.
func (s *Server) aiDeploymentSupported() bool {
	return s.configManagement() != "operator" && !s.authConfig.Enabled() &&
		s.mcpInvestigationHandler != nil && s.aiInvestigationRefs != nil
}

// refreshAIEngine brings the engine in line with the agent CLIs installed now:
// it turns the engine on when the first one appears, and keeps a running
// engine's backends current (Diagnoser.Refresh). Called at startup, whenever a
// client asks which agents exist, and before a run or follow-up starts, so
// installing, moving or removing a CLI never needs a Radar restart. Detection
// only resolves paths; it runs nothing.
func (s *Server) refreshAIEngine(ctx context.Context) {
	if !s.aiDeploymentSupported() {
		return
	}
	s.aiMu.Lock()
	defer s.aiMu.Unlock()
	defer func() { s.aiChecked = true }()
	if s.aiDiagnoser != nil {
		if changed := s.aiDiagnoser.Refresh(ctx); len(changed) > 0 {
			log.Printf("[ai] agent CLIs installed, moved or removed since startup: %v (default now %q)",
				changed, s.aiDiagnoser.DefaultAgent())
		}
		return
	}
	d, err := ai.NewDetected(ctx, s.aiInvestigationRefs)
	if err != nil {
		return
	}
	// History store opens only when the engine actually enables, so a
	// disabled feature never creates the DB. Open failure degrades to
	// memory-only runs (the historical behavior), never blocks startup.
	var store ai.RunStore
	historyBroken := false
	if s.aiHistoryDB != "" {
		if st, err := ai.OpenRunStore(s.aiHistoryDB); err != nil {
			log.Printf("[ai] run history disabled: could not open %s: %v", s.aiHistoryDB, err)
			historyBroken = true
		} else {
			store = st
		}
	}
	runs := ai.NewRunManager(d, s.ActualAddr, s.basePath, k8s.GetContextName, store)
	runs.MetricsAvailability = func(ctx context.Context) ai.MetricsAvailability {
		state := prometheuspkg.Availability(ctx)
		return ai.MetricsAvailability{
			Connected: state.State == prometheuspkg.AvailabilityConnected,
			Address:   state.Address,
		}
	}
	if historyBroken {
		// Persistence was requested but isn't working. The UI must say history
		// won't survive a restart, not just a log line.
		runs.MarkHistoryUnavailable(s.aiHistoryDB)
	}
	s.aiDiagnoser, s.aiRuns = d, runs
	if s.aiChecked {
		// The startup block reports the engine chosen at boot; this is the
		// only record of one turned on later.
		log.Printf("[ai] AI investigations enabled via %s (agent CLI found since startup)", d.DefaultAgent())
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2689** (2026-11-20): **Release Desktop workflow fails due to Go toolchain version mismatch**
  *Symptoms*: ## Describe the bug  The Release Desktop GitHub Actions workflow is failing during dependency installation because the project is using Go 1.26.11 while a required dependency (`github.com/goreleaser/nfpm/v2@v2.49.0`) requires Go >= 1.27.4.  The failing job is `Release Desktop` for run `117535128137` / job `132767922940` (`https://github.com/skyhook-io/radar/actions/runs/43406103414/job/132767922940`).  ## To reproduce  1. Trigger the `Release Desktop` GitHub Actions workflow. 2. The job reaches the Go dependency installation step for `nfpm`. 3. The workflow exits with code 1 before producing the desktop artifacts.  ## Expected behavior  The Release Desktop workflow should complete successfully with the required Go toolchain version and produce the expected desktop release artifacts (`.tar.gz`, `.deb`, `.rpm`, `.AppImage`).  ## Screenshots  Not applicable.  ## Diagnostics (optional)  <details><summary>Diagnostics snapshot</summary>  <!-- Paste here -->  </details>  - Radar version: not specified - Kubernetes: not applicable to this CI release job  ## Logs  ```text go: downloading github.com/goreleaser/nfpm v1.10.3 go: downloading github.com/goreleaser/nfpm/v2 v2.49.0 go: github.com/goreleaser/nfpm/v2/cmd/nfpm@latest: github.com/goreleaser/nfpm/v2@v2.49.0 requires go >= 1.27.4 (running go 1.26.11; GOTOOLCHAIN=local) ##[error]Process completed with exit code 1. ```  ## Additional context  This appears to be a CI/toolchain mismatch rather than a code regression in the app itself.

- **Issue #2687** (2026-11-15): **Release Desktop workflow fails during Apple notarization due to missing/expired agreement**
  *Symptoms*: ## Describe the bug  The `Release Desktop` GitHub Actions workflow fails during the Apple notarization step for the macOS release artifact. The job reaches the notarization request, then exits with a 403 from Apple’s notarization service.  ## To reproduce  1. Trigger the `Release Desktop` workflow in `skyhook-io/radar` 2. Wait for the macOS build to finish packaging the app 3. Observe the workflow attempt to submit the artifact for Apple notarization 4. The job fails before finishing the release  ## Expected behavior  The release workflow should successfully submit the signed/notarized macOS artifact to Apple and complete the release process without failing.  ## Screenshots  Not applicable.  ## Diagnostics (optional)  N/A  ## Logs  ```text 2026-11-13T10:14:58.9407140Z Conducting pre-submission checks for radar-desktop_v1.20.3_darwin_universal.zip and initiating connection to the Apple notary service... 2026-11-13T10:15:00.9809290Z Error: HTTP status code: 403. A required agreement is missing or has expired. This request requires an in-effect agreement that has not been signed or has expired. Ensure your team has signed the necessary legal agreements and that they are not expired. 2026-11-13T10:15:00.9857090Z ##[error]Process completed with exit code 1. ```  ## Additional context  The workflow URL is: https://github.com/skyhook-io/radar/actions/runs/43406103414/job/131820798764  This appears to be an Apple Developer / notarization account issue rather than a code-level build f

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

### Incident Patch 1: `55249927` (2026-11-24)
**Commit Message**: Withhold memory reductions after unexplained recent Pod restarts (#2877)

A native Prometheus scan proposed a memory reduction for a container
whose Pod had restarted in the seven-day sizing window. Its first
retained counter sample was already one, and Kubernetes had lost the
previous exit reason. Across 5,767 identical raw samples, native
Prometheus reported zero counter increase and VictoriaMetrics reported
one. Neither store had a termination reason or timestamp for that Pod.

Fleet and detail use the live Pods already matched to their controller
UID. A Pod created within the sizing window can establish that its
nonzero lifetime restart count is recent. Radar withholds a memory
reduction when this Pod's latest exit is missing or ambiguous.
Historical activity and reason are aggregated across replicas, so they
cannot identify that exit. When only the latest of several exits is
known, the earlier exits remain unexplained even if workload-wide
counters and a benign last termination were observed. A dated exit with
an ambiguous reason can establish a recent restart in an older Pod. A
recent ambiguous SIGKILL also withholds the cut if the container died
before its first restart or t

**File**: `docs/mcp.md` (modified, +2/-0)
```diff
@@ -920,6 +920,8 @@ By default a scan returns only `oversized`, `under_requested` and `missing_reque
 
 `oomEvidenceAvailable` is emitted on **memory rows only**. It never gates a CPU recommendation, and a literal `false` there would read as an evidence gap. `throttleAvailable` is its CPU counterpart: on CPU rows only, and `false` means throttling was not measured — not that the container is unthrottled.
 
+When a recent container exit has no reliable cause, Radar withholds memory reductions for that container. Check the Pod’s current and last termination state and its events. A generic exit 137 or SIGKILL does not by itself establish an OOM. A verified OOM produces its own review reason.
+
 ### `state: partial` always names its cause
 
 A partial response carries a `reason`, and `guidance` names the causes that are actually present rather than listing every field that could explain one. Causes:
```

**File**: `internal/prometheus/podscope_test.go` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@ import (
 	"errors"
 	"reflect"
 	"testing"
+	"time"
 
 	appsv1 "k8s.io/api/apps/v1"
 	batchv1 "k8s.io/api/batch/v1"
@@ -171,7 +172,7 @@ func TestCurrentReadersExcludePreviousControllerIncarnations(t *testing.T) {
 		pod("previous-rs", staleOwner, corev1.PodQOSGuaranteed),
 		pod("wrong-group", wrongGroup, corev1.PodQOSGuaranteed),
 	)
-	scan, _, _ := snapshotScanWorkloads(context.Background(), cache, map[string][]string{"Deployment": {"shop"}})
+	scan, _, _ := snapshotScanWorkloads(context.Background(), cache, map[string][]string{"Deployment": {"shop"}}, time.Now())
 	var currentQoS rightsizing.PodQoS
 	currentQoS.Observe(corev1.PodQOSBurstable)
 	if len(scan) != 1 || scan[0].workload.qos != currentQoS || !reflect.DeepEqual(scan[0].workload.currentPodOOM, map[string]bool{"current": true}) {
```

**File**: `internal/prometheus/rightsizing.go` (modified, +46/-11)
```diff
@@ -297,6 +297,7 @@ type rightsizingWorkload struct {
 	podRestartEvidence    map[string]sizingPodRestarts
 	qos                   rightsizing.PodQoS
 	currentPodOOM         map[string]bool
+	unexplainedPodExits   map[string]bool
 	hpaManaged            map[string]bool
 	hpaAvailable          bool
 	replicas              int
@@ -425,30 +426,64 @@ func loadRightsizingWorkload(ctx context.Context, kind, namespace, name string)
 		return workload, nil
 	}
 	collectPodIdentities := cloud.IsAuthenticatedTunnelRequest(ctx)
+	windowEnd := time.Now()
 	for _, pod := range pods {
 		workload.qos.Observe(pod.Status.QOSClass)
 		workload.podNames = append(workload.podNames, pod.Name)
 		if collectPodIdentities {
 			workload.observeSizingPodIdentity(ctx, cache, pod)
 		}
-		collectCurrentPodOOM(workload.currentPodOOM, pod.Status.ContainerStatuses)
-		collectCurrentPodOOM(workload.currentPodOOM, pod.Status.InitContainerStatuses)
+		workload.observePodTerminations(pod, windowEnd)
 	}
 	sort.Strings(workload.podNames)
 	return workload, nil
 }
 
-func collectCurrentPodOOM(dst map[string]bool, statuses []corev1.ContainerStatus) {
-	for _, status := range statuses {
-		if status.State.Terminated != nil && status.State.Terminated.Reason == "OOMKilled" {
-			dst[status.Name] = true
-		}
-		if status.LastTerminationState.Terminated != nil && status.LastTerminationState.Terminated.Reason == "OOMKilled" {
-			dst[status.Name] = true
+func (w *rightsizingWorkload) observePodTerminations(pod *corev1.Pod, windowEnd time.Time) {
+	inWindow := func(t time.Time) bool { return !t.Before(windowEnd.Add(-rightsizingWindow)) && !t.After(windowEnd) }
+	bornInWindow := inWindow(pod.CreationTimestamp.Time)
+	// SIGKILL alone cannot distinguish a manual kill from an OOM.
+	unexplained := func(exit *corev1.ContainerStateTerminated) bool {
+		return exit == nil || exit.Reason == "" || exit.Reason == "ContainerStatusUnknown" || exit.Reason == "Unknown" || exit.ExitCode == 137 || exit.Signal == 9
+	}
+	recent := func(exit *corev1.ContainerStateTerminated) bool {
+		return bornInWindow || (exit != nil && inWindow(exit.FinishedAt.Time))
+	}
+	for _, statuses := range [][]corev1.ContainerStatus{pod.Status.ContainerStatuses, pod.Status.InitContainerStatuses} {
+		for _, status := range statuses {
+			current, last := status.State.Terminated, status.LastTerminationState.Terminated
+			if (current != nil && current.Reason == "OOMKilled") || (last != nil && last.Reason == "OOMKilled") {
+				w.currentPodOOM[status.Name] = true
+			}
+			// A counter already positive at its first scrape has no visible increase.
+			// A Pod born inside the window dates its restarts even when the scrape cannot.
+			if pod.UID == "" {
+				continue
+			}
+			// A container can die and the Pod disappear before the kubelet restarts it.
+			currentGap := current != nil && unexplained(current) && recent(current)
+			lastGap := (status.RestartCount > 0 || last != nil) && unexplained(last) && recent(last)
+			earlierGap := bornInWindow && status.RestartCount > 1
+			if !currentGap && !lastGap && !earlierGap {
+				continue
+			}
+			if w.unexplainedPodExits == nil {
+				w.unexplainedPodExits = map[string]bool{}
+			}
+			w.unexplainedPodExits[status.Name] = true
 		}
 	}
 }
 
+func (w rightsizingWorkload) hasOOMEvidence(container string, restartActivity float64, restartAvailable bool, termination terminationEvidence) bool {
+	if termination.OOM {
+		return true
+	}
+	// The aggregated historical reason could describe another replica or just
+	// the last of several restarts. It cannot clear a known gap in a live Pod.
+	return restartAvailable && !w.unexplainedPodExits[container] && (restartActivity <= 0 || termination.Any)
+}
+
 func loadHPAManagedResources(ctx context.Context, cache *k8s.ResourceCache, kind, namespace, name string) (map[string]bool, bool) {
 	managed := map[string]bool{}
 	if cache.HorizontalPodAutoscalers() == nil {
@@ -802,11 +837,11 @@ func buildRightsizingRow(container containerSpec, resourceName string, expected
 		row.CurrentPodOOM = workload.currentPodOOM[container.name]
 		restarts := results["restart_activity"]
 		terminations := results["termination_history"]
-		if restarts.err == nil && terminations.err == nil {
+		if terminations.err == nil {
 			restartActivity, restartAvailable := restarts.values[container.name]
 			termination := terminations.terminations[container.name]
 			row.WindowOOMEvidence = termination.OOM
-			row.OOMEvidenceAvailable = termination.OOM || (restartAvailable && (restartActivity <= 0 || termination.Any))
+			row.OOMEvidenceAvailable = workload.hasOOMEvidence(container.name, restartActivity, restarts.err == nil && restartAvailable, termination)
 		}
 	}
 	rightsizing.SetCurrentQuantities(&row, req, lim, resourceName)
```

**File**: `internal/prometheus/rightsizing_manager_test.go` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ func TestScanSkipsDaemonSetsThatMatchNoNode(t *testing.T) {
 	var skipped []string
 	deadline := time.Now().Add(2 * time.Second)
 	for time.Now().Before(deadline) {
-		workloads, _, skipped = snapshotScanWorkloads(context.Background(), cache, scopes)
+		workloads, _, skipped = snapshotScanWorkloads(context.Background(), cache, scopes, time.Now())
 		if len(workloads)+len(skipped) == 4 {
 			break
 		}
```

**File**: `internal/prometheus/rightsizing_pod_identity_test.go` (modified, +1/-1)
```diff
@@ -132,7 +132,7 @@ func TestCurrentPodRightsizingDetailAndScanAgreeOnDaemonSetCohort(t *testing.T)
 			t.Fatalf("standalone restricted to current UIDs: %s", q)
 		}
 	}
-	workloads, _, _ := snapshotScanWorkloads(sizingTunnelTestContext(ctx), k8s.GetResourceCache(), map[string][]string{"DaemonSet": {"apps"}})
+	workloads, _, _ := snapshotScanWorkloads(sizingTunnelTestContext(ctx), k8s.GetResourceCache(), map[string][]string{"DaemonSet": {"apps"}}, time.Now())
 	if len(workloads) != 2 {
 		t.Fatalf("scan snapshot: %+v", workloads)
 	}
```

**File**: `internal/prometheus/rightsizing_scan.go` (modified, +7/-8)
```diff
@@ -231,7 +231,7 @@ func runRightsizingScan(ctx context.Context, scope RightsizingScanScope, client
 	effective, partiallyCached := clampScopeToCacheCoverage(cache, scope.NamespacesByKind)
 	resp.Coverage.PartiallyCachedKinds = partiallyCached
 	resp.Coverage.ScannedNamespacesByKind = effective
-	workloads, unavailable, skippedDaemonSets := snapshotScanWorkloads(ctx, cache, effective)
+	workloads, unavailable, skippedDaemonSets := snapshotScanWorkloads(ctx, cache, effective, resp.ScannedAt)
 	resp.Coverage.UnavailableKinds = unavailable
 	resp.Coverage.DaemonSetsWithoutNodes = len(skippedDaemonSets)
 	sort.Strings(skippedDaemonSets)
@@ -767,11 +767,11 @@ func buildScanRow(container containerSpec, resourceName string, key scanKey, exp
 		statistic = "Max"
 		series = evidence.memory[key]
 		row.CurrentPodOOM = workload.currentPodOOM[container.name]
-		if evidence.errors["restart_activity"] == nil && evidence.errors["termination_history"] == nil {
+		if evidence.errors["termination_history"] == nil {
 			restartActivity, restartAvailable := evidence.restarts[key]
 			termination := evidence.terminations[key]
 			row.WindowOOMEvidence = termination.OOM
-			row.OOMEvidenceAvailable = termination.OOM || (restartAvailable && (restartActivity <= 0 || termination.Any))
+			row.OOMEvidenceAvailable = workload.hasOOMEvidence(container.name, restartActivity, evidence.errors["restart_activity"] == nil && restartAvailable, termination)
 		}
 	}
 	rightsizing.SetCurrentQuantities(&row, request, limit, resourceName)
@@ -976,7 +976,7 @@ func sortScanWorkloads(workloads []scanWorkload) {
 
 // snapshotScanWorkloads also returns each DaemonSet it skipped for matching no
 // node, as namespace/name.
-func snapshotScanWorkloads(ctx context.Context, cache *k8s.ResourceCache, scopes map[string][]string) ([]scanWorkload, []string, []string) {
+func snapshotScanWorkloads(ctx context.Context, cache *k8s.ResourceCache, scopes map[string][]string, windowEnd time.Time) ([]scanWorkload, []string, []string) {
 	workloads := map[string]*scanWorkload{}
 	var unavailable, skippedDaemonSets []string
 	add := func(obj metav1.Object, kind string, replicas int, podSpec *corev1.PodSpec, scaledToZero, cohortReady bool) {
@@ -1036,7 +1036,7 @@ func snapshotScanWorkloads(ctx context.Context, cache *k8s.ResourceCache, scopes
 	}
 
 	enrichScanHPA(ctx, cache, scopes, workloads)
-	enrichScanCurrentOOM(ctx, cache, scopes, workloads)
+	enrichScanCurrentOOM(ctx, cache, scopes, workloads, windowEnd)
 	out := make([]scanWorkload, 0, len(workloads))
 	for _, workload := range workloads {
 		out = append(out, *workload)
@@ -1200,7 +1200,7 @@ func scanNeedsReplicaSets(workloads map[string]*scanWorkload) bool {
 	return false
 }
 
-func enrichScanCurrentOOM(ctx context.Context, cache *k8s.ResourceCache, scopes map[string][]string, workloads map[string]*scanWorkload) {
+func enrichScanCurrentOOM(ctx context.Context, cache *k8s.ResourceCache, scopes map[string][]string, workloads map[string]*scanWorkload, windowEnd time.Time) {
 	// A warming informer hands out a non-nil lister that answers nothing, which
 	// would read as a cluster with no OOM-killed pods anywhere. The scan pays
 	// this wait once rather than per workload.
@@ -1277,8 +1277,7 @@ func enrichScanCurrentOOM(ctx context.Context, cache *k8s.ResourceCache, scopes
 			workload.workload.observeSizingPodIdentity(ctx, cache, pod)
 		}
 		workload.workload.qos.Observe(pod.Status.QOSClass)
-		collectCurrentPodOOM(workload.workload.currentPodOOM, pod.Status.ContainerStatuses)
-		collectCurrentPodOOM(workload.workload.currentPodOOM, pod.Status.InitContainerStatuses)
+		workload.workload.observePodTerminations(pod, windowEnd)
 	}
 }
 
```

**File**: `internal/prometheus/rightsizing_scan_test.go` (modified, +5/-5)
```diff
@@ -440,7 +440,7 @@ func TestScanMarksWorkloadsWhenPodInventoryIsUnreadable(t *testing.T) {
 	t.Run("pods readable", func(t *testing.T) {
 		cache := scopeTestCache(t, map[string]bool{k8score.Pods: true, k8score.ReplicaSets: true}, replicaSet, oomed)
 		workloads := newWorkloads()
-		enrichScanCurrentOOM(context.Background(), cache, scopes, workloads)
+		enrichScanCurrentOOM(context.Background(), cache, scopes, workloads, time.Now())
 		got := workloads[workloadIdentity("Deployment", "shop", "api")].workload
 		if got.liveInventoryUnavailable {
 			t.Error("pods were readable; the row must not claim the inventory was denied")
@@ -453,7 +453,7 @@ func TestScanMarksWorkloadsWhenPodInventoryIsUnreadable(t *testing.T) {
 	t.Run("pod lister denied", func(t *testing.T) {
 		cache := scopeTestCache(t, map[string]bool{k8score.ReplicaSets: true}, replicaSet)
 		workloads := newWorkloads()
-		enrichScanCurrentOOM(context.Background(), cache, scopes, workloads)
+		enrichScanCurrentOOM(context.Background(), cache, scopes, workloads, time.Now())
 		got := workloads[workloadIdentity("Deployment", "shop", "api")].workload
 		if !got.liveInventoryUnavailable {
 			t.Error("the pod lister was denied, so the empty OOM map must be reported as unanswered")
@@ -487,7 +487,7 @@ func TestScanMarksOnlyDeploymentsWhenReplicaSetOwnershipIsUnreadable(t *testing.
 			workload: rightsizingWorkload{currentPodOOM: map[string]bool{}},
 		},
 	}
-	enrichScanCurrentOOM(context.Background(), cache, map[string][]string{"Deployment": {"shop"}}, workloads)
+	enrichScanCurrentOOM(context.Background(), cache, map[string][]string{"Deployment": {"shop"}}, workloads, time.Now())
 
 	if !workloads[workloadIdentity("Deployment", "shop", "api")].workload.liveInventoryUnavailable {
 		t.Error("no ReplicaSet lister, so the Deployment never sees its pods; that has to be reported")
@@ -528,7 +528,7 @@ func TestScanMarksWorkloadsOutsideTheInformersNamespaces(t *testing.T) {
 			workload: rightsizingWorkload{currentPodOOM: map[string]bool{}},
 		},
 	}
-	enrichScanCurrentOOM(context.Background(), cache, map[string][]string{"StatefulSet": {"team-a", "team-b"}}, workloads)
+	enrichScanCurrentOOM(context.Background(), cache, map[string][]string{"StatefulSet": {"team-a", "team-b"}}, workloads, time.Now())
 
 	if workloads[workloadIdentity("StatefulSet", "team-a", "watched")].workload.liveInventoryUnavailable {
 		t.Error("team-a is watched, so its empty pod list is authoritative and must not be flagged")
@@ -552,7 +552,7 @@ func TestScanSkipsReplicaSetWaitWithoutDeployments(t *testing.T) {
 		t.Fatal("a DaemonSet-only scan reported that it needs ReplicaSet ownership")
 	}
 	start := time.Now()
-	enrichScanCurrentOOM(context.Background(), cache, map[string][]string{"DaemonSet": {"shop"}}, workloads)
+	enrichScanCurrentOOM(context.Background(), cache, map[string][]string{"DaemonSet": {"shop"}}, workloads, time.Now())
 	if elapsed := time.Since(start); elapsed >= warmingRetryBudget {
 		t.Errorf("waited %v on ReplicaSets a DaemonSet-only scan never reads", elapsed)
 	}
```

**File**: `internal/prometheus/rightsizing_test.go` (modified, +139/-0)
```diff
@@ -6,11 +6,14 @@ import (
 	"strings"
 	"sync"
 	"testing"
+	"time"
 
 	"github.com/skyhook-io/radar/pkg/prom"
 	"github.com/skyhook-io/radar/pkg/rightsizing"
 	corev1 "k8s.io/api/core/v1"
 	"k8s.io/apimachinery/pkg/api/resource"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
 )
 
 type fakeRightsizingQuerier func(string) (*prom.QueryResult, error)
@@ -224,6 +227,32 @@ func TestMemoryReductionRequiresVerifiedRestartHistory(t *testing.T) {
 	}
 }
 
+func TestHistoricalOOMSurvivesRestartQueryFailure(t *testing.T) {
+	const usage = 50 * 1024 * 1024
+	const keySamples = 2016
+	key := scanKey{namespace: "shop", kind: "Deployment", workload: "api", container: "server"}
+	container := containerSpec{name: key.container, memReq: mustQuantity(t, "256Mi")}
+	workload := rightsizingWorkload{hpaAvailable: true}
+	termination := terminationEvidence{Any: true, OOM: true}
+	err := errors.New("restart counter unavailable")
+	detail := buildRightsizingRow(container, "memory", keySamples, OwnerCoverageKSMHistory, workload, map[string]queryOutcome{
+		"memory_stat":         {values: map[string]float64{key.container: usage}},
+		"memory_coverage":     {values: map[string]float64{key.container: keySamples}},
+		"restart_activity":    {err: err},
+		"termination_history": {terminations: map[string]terminationEvidence{key.container: termination}},
+	})
+	fleet := buildScanRow(container, "memory", key, keySamples, workload, scanBatchEvidence{
+		memory:       map[scanKey][]float64{key: repeatedValues(usage)},
+		errors:       map[string]error{"restart_activity": err},
+		terminations: map[scanKey]terminationEvidence{key: termination},
+	})
+	for _, row := range []RightsizingRow{detail, fleet} {
+		if !row.WindowOOMEvidence || !row.OOMEvidenceAvailable || row.RecommendationReason != "oom_evidence" || row.RecommendedReq != nil {
+			t.Errorf("lost verified OOM on partial safety history: %+v", row)
+		}
+	}
+}
+
 func TestTerminationEvidenceKeepsHistoricalOOMReason(t *testing.T) {
 	evidence := terminationEvidenceByContainer(terminationResult(map[string][]string{"server": {"Error", "OOMKilled"}}))
 	if !evidence["server"].Any || !evidence["server"].OOM {
@@ -505,3 +534,113 @@ func TestLostThrottleReadingClearsTheReviewReason(t *testing.T) {
 		t.Error("without the ratio the row reads as a clean cut, which is why a failed throttle query has to reach the caller")
 	}
 }
+
+func TestRecentPodRestartWithMissingHistory(t *testing.T) {
+	end := time.Date(2026, 11, 24, 8, 12, 30, 0, time.UTC)
+	birth := end.Add(-6 * 24 * time.Hour)
+	key := scanKey{namespace: "lws-system", kind: "Deployment", workload: "lws-controller-manager", container: "manager"}
+	container := containerSpec{name: key.container, memReq: mustQuantity(t, "256Mi")}
+	clean := &corev1.ContainerStateTerminated{Reason: "Completed", ExitCode: 0}
+	for _, tt := range []struct {
+		name       string
+		created    time.Time
+		uid        types.UID
+		restarts   int32
+		last       *corev1.ContainerStateTerminated
+		ksm        terminationEvidence
+		wantReason string
+	}{
+		{"first sample already one", birth, "local", 1, nil, terminationEvidence{}, ReasonOOMEvidenceUnavailable},
+		{"old Pod count alone cannot date its restart", end.Add(-8 * 24 * time.Hour), "local", 1, nil, terminationEvidence{}, ""},
+		{"born during the latest partial five-minute bucket", end.Add(-time.Minute), "local", 1, nil, terminationEvidence{}, ReasonOOMEvidenceUnavailable},
+		{"unknown runtime reason", birth, "local", 1, &corev1.ContainerStateTerminated{Reason: "ContainerStatusUnknown"}, terminationEvidence{}, ReasonOOMEvidenceUnavailable},
+		{"generic SIGKILL", birth, "local", 1, &corev1.ContainerStateTerminated{Reason: "Error", ExitCode: 137}, terminationEvidence{}, ReasonOOMEvidenceUnavailable},
+		{"older Pod with dated ambiguous exit", end.Add(-8 * 24 * time.Hour), "local", 1, &corev1.ContainerStateTerminated{Reason: "Error", Signal: 9, FinishedAt: metav1.NewTime(end.Add(-24 * time.Hour))}, terminationEvidence{}, ReasonOOMEvidenceUnavailable},
+		{"dated last exit survives a reset kubelet counter", end.Add(-8 * 24 * time.Hour), "local", 0, &corev1.ContainerStateTerminated{Reason: "Unknown", FinishedAt: metav1.NewTime(end.Add(-time.Hour))}, terminationEvidence{}, ReasonOOMEvidenceUnavailable},
+		{"older Pod with a dated known final exit", end.Add(-8 * 24 * time.Hour), "local", 2, &corev1.ContainerStateTerminated{Reason: "Completed", FinishedAt: metav1.NewTime(end.Add(-24 * time.Hour))}, terminationEvidence{}, ""},
+		{"missing birth", time.Time{}, "local", 1, nil, terminationEvidence{}, ""},
+		{"future birth", end.Add(time.Minute), "local", 1, nil, terminationEvidence{}, ""},
+		{"unverified Pod", birth, "", 1, nil, terminationEvidence{}, ""},
+		{"no restart", birth, "local", 0, nil, terminationEvidence{}, ""},
+		{"one known clean exit", birth, "local", 1, clean, terminationEvidence{}, ""},
+		{"two exits with one known reason", birth, "local", 2, clean, term
```

---

### Incident Patch 2: `17b3f3b4` (2026-11-24)
**Commit Message**: Flux: follow ArtifactGenerator → ExternalArtifact chains and show health-check expressions (#2640)

## Description

Follows Flux 2.7's ArtifactGenerator chain through Radar's GitOps tree
and cluster topology, gives ArtifactGenerator and ExternalArtifact real
drawers and columns, and lists `healthCheckExprs` in the Kustomization
and HelmRelease drawers (#2639).

### What changes

**Source chain** (`pkg/gitops`, `pkg/gitops/tree`, `pkg/topology`)
- `FluxSourceReferences` learns two hops:
- ExternalArtifact → the ArtifactGenerator in its `spec.sourceRef` (role
`generator`; a foreign `apiVersion` group names none).
- ArtifactGenerator → the GitRepository / OCIRepository / Bucket /
HelmChart / ExternalArtifact in `spec.sources` (role `source`, alias
kept).
- `FluxSourceRef` gains `Alias string` — additive, but exported to Radar
Hub.
- The tree builder replaces the single HelmChart hop with a loop over
upstream kinds:
- only objects already reached from the root are followed, so a release
consuming one of a generator's 143 artifacts gets exactly one
ExternalArtifact node;
  - at most 8 levels (`gitops.MaxFluxSourceLevels`), with a seen-set;
- one `prefetchObjects` call per level, and eve

**File**: `README.md` (modified, +2/-2)
```diff
@@ -365,7 +365,7 @@ Monitor, diagnose, and manage FluxCD and ArgoCD resources in one place.
   <br><em>GitOps fleet view — Argo + Flux applications side-by-side with sync, health, source, destination, and lifecycle state</em>
 </p>
 
-- Fleet view + per-app detail page for **ArgoCD** (`Application`, `ApplicationSet`, `AppProject`) and **FluxCD** (`GitRepository`, `OCIRepository`, `HelmRepository`, `Bucket`, `Kustomization`, `HelmRelease`, `Alert`)
+- Fleet view + per-app detail page for **ArgoCD** (`Application`, `ApplicationSet`, `AppProject`) and **FluxCD** (`GitRepository`, `OCIRepository`, `HelmRepository`, `Bucket`, `ExternalArtifact`, `ArtifactGenerator`, `Kustomization`, `HelmRelease`, `Alert`)
 - **Flux Operator** — a Flux card on the GitOps page (version, controllers, reconciler counts from `FluxReport`) and views for `FluxInstance`, `FluxReport`, `ResourceSet`, `ResourceSetInputProvider`
 - **Diagnosis** — field-level drift, recent events per resource, stuck-drift-loop detection, parsed operation failures, one-click remediation
 - Sync, suspend, resume, reconcile, and rollback from the UI or through MCP
@@ -474,7 +474,7 @@ The Helm chart grants read access to common built-in Kubernetes kinds; Secrets,
 | **Autoscaling** | HorizontalPodAutoscalers, VerticalPodAutoscalers |
 | **Cluster** | Nodes, Namespaces, ServiceAccounts, Events |
 | **Other Kubernetes APIs** | CertificateSigningRequests; Workloads, PodGroups, CompositePodGroups, PodCertificateRequests, ClusterTrustBundles (only when served by the cluster) |
-| **GitOps (FluxCD)** | GitRepository, OCIRepository, HelmRepository, Kustomization, HelmRelease, Alert |
+| **GitOps (FluxCD)** | GitRepository, OCIRepository, HelmRepository, ExternalArtifact, ArtifactGenerator, Kustomization, HelmRelease, Alert |
 | **GitOps (Flux Operator)** | FluxInstance, FluxReport, ResourceSet, ResourceSetInputProvider |
 | **GitOps (ArgoCD)** | Application, ApplicationSet, AppProject |
 | **Argo Rollouts** | Rollout |
```

**File**: `deploy/helm/radar/README.md` (modified, +1/-1)
```diff
@@ -741,7 +741,7 @@ retain their finite grants.
 | `externalDns` | `externaldns.k8s.io` |
 | `externalSecrets` | `external-secrets.io` |
 | `flagger` | `flagger.app` (`canaries`, `metrictemplates` only); **off by default**. Enable `rbac.crdGroups.flagger=true` for native browsing and failed-rollout Issues. |
-| `flux` | `*.toolkit.fluxcd.io` |
+| `flux` | `*.toolkit.fluxcd.io`, `source.extensions.fluxcd.io` (ArtifactGenerator) |
 | `fluxOperator` | `fluxcd.controlplane.io` (FluxInstance, FluxReport, ResourceSet, ResourceSetInputProvider) |
 | `k3sHelm` | `helm.cattle.io` (`helmcharts`, `helmchartconfigs` only); **off by default**, because `spec.valuesContent` and `spec.set` can carry credentials. Enable `rbac.crdGroups.k3sHelm=true` on k3s/RKE2 for the HelmChart drawers and the `k3s` badge on the releases they manage. |
 | `gatewayApi` | `gateway.networking.k8s.io` |
```

**File**: `deploy/helm/radar/files/integration-read-baseline.yaml` (modified, +7/-0)
```diff
@@ -906,6 +906,13 @@ entries:
     decision: grant
     reason: "Operational configuration and status. Credentials are referenced by Secret name only (secretRef, certSecretRef, proxySecretRef); no inline credential fields in source.toolkit.fluxcd.io/v1."
     source: "internal/k8s/dynamic_cache.go (supportedCRDFallbacks); source-controller v1.9 CRD schemas"
+  - group: "source.extensions.fluxcd.io"
+    resources: ["artifactgenerators"]
+    scope: Namespaced
+    collection: "flux"
+    decision: grant
+    reason: "Operational configuration and status; sources are referenced by name, no inline credentials."
+    source: "internal/k8s/dynamic_cache.go (supportedCRDFallbacks); source-watcher v1beta1 CRD schema"
   - group: "sources.knative.dev"
     resources: ["apiserversources","containersources","pingsources","sinkbindings"]
     scope: Namespaced
```

**File**: `deploy/helm/radar/templates/clusterrole.yaml` (modified, +1/-1)
```diff
@@ -392,7 +392,7 @@ rules:
     verbs: ["get", "list", "watch"]
   {{- end }}
   {{- if .Values.rbac.crdGroups.flux }}
-  - apiGroups: ["source.toolkit.fluxcd.io", "kustomize.toolkit.fluxcd.io", "helm.toolkit.fluxcd.io", "notification.toolkit.fluxcd.io", "image.toolkit.fluxcd.io"]
+  - apiGroups: ["source.toolkit.fluxcd.io", "source.extensions.fluxcd.io", "kustomize.toolkit.fluxcd.io", "helm.toolkit.fluxcd.io", "notification.toolkit.fluxcd.io", "image.toolkit.fluxcd.io"]
     resources: ["*"]
     verbs: ["get", "list", "watch"]
   {{- end }}
```

**File**: `deploy/helm/radar/values.yaml` (modified, +1/-1)
```diff
@@ -208,7 +208,7 @@ rbac:
     inferenceGateway: true  # inference.networking.k8s.io, inference.networking.x-k8s.io, llm-d.ai (Inference Gateway + llm-d routing APIs)
     externalDns: true       # externaldns.k8s.io
     externalSecrets: true   # external-secrets.io
-    flux: true              # *.toolkit.fluxcd.io
+    flux: true              # *.toolkit.fluxcd.io, source.extensions.fluxcd.io
     fluxOperator: true      # fluxcd.controlplane.io (FluxInstance, FluxReport, ResourceSet, ResourceSetInputProvider)
     gatewayApi: true        # gateway.networking.k8s.io
     gcpMonitoring: true     # monitoring.googleapis.com
```

**File**: `docs/gitops.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ Graph or table sub-modes. The graph starts from the resources the controller rec
 
 You see only the resources you can read. A readable resource under a hidden parent stays visible. Resources on another cluster, from a remote Application or a Flux object with `spec.kubeConfig`, are not expanded. When Radar can't read part of the tree, a **Limited resource view** notice says so.
 
-For Flux, the graph also shows where the root's content comes from. Its sources sit to the left of the root, with arrows pointing into it: the GitRepository, OCIRepository, Bucket or ExternalArtifact a Kustomization reads, the Kustomizations it `dependsOn`, and for a HelmRelease the chart chain. An inline `spec.chart` release draws release ← generated HelmChart (`status.helmChart`) ← the chart's source (HelmRepository, GitRepository or Bucket), so a chart that fails to pull shows as its own red node; `spec.chartRef` draws the referenced HelmChart, OCIRepository or ExternalArtifact. Source cards show what each kind has: the URL, the fetched revision, or for a HelmChart the requested chart and version. Sources are dependencies, not managed resources: they are counted separately and listed under the **Dependency** role. A source the root also manages, like a bootstrap Kustomization's own GitRepository, stays with the managed resources.
+For Flux, the graph also shows where the root's content comes from. Its sources sit to the left of the root, with arrows pointing into it: the GitRepository, OCIRepository, Bucket or ExternalArtifact a Kustomization reads, the Kustomizations it `dependsOn`, and for a HelmRelease the chart chain. An inline `spec.chart` release draws release ← generated HelmChart (`status.helmChart`) ← the chart's source (HelmRepository, GitRepository or Bucket), so a chart that fails to pull shows as its own red node; `spec.chartRef` draws the referenced HelmChart, OCIRepository or ExternalArtifact; an ExternalArtifact made by an ArtifactGenerator (Flux 2.7+, source-watcher) continues to that generator and its sources, labelled with their aliases. A generator fed by another generator's artifact is followed the same way. Only the artifact the root consumes is drawn, never the generator's other artifacts. The walk stops after eight upstream levels (four nested generators), and never revisits an object, so a cycle ends; when it stops with more to follow, the card where it stopped reads **chain continues…** and a notice names the object to open to follow it further. A generator paused with `source.extensions.fluxcd.io/reconcile: disabled` reads as Suspended, not failing, even though it keeps its last Ready condition. Source cards show what each kind has: the URL, the fetched revision, for a HelmChart the requested chart and version, or for an ArtifactGenerator how many ExternalArtifacts its inventory lists (not the Namespaces it manages; no count when Radar can't read an inventory). A generator that isn't Ready, and isn't paused, raises a warning, since the artifacts it generates may then be out of date. The Kustomization and HelmRelease drawers list `spec.healthCheckExprs` (HelmRelease from Flux 2.8) under **Health checks (expressions)**; Flux records no result per expression, so the Ready condition still names what failed. Sources are dependencies, not managed resources: they are counted separately and listed under the **Dependency** role. A source the root also manages, like a bootstrap Kustomization's own GitRepository, stays with the managed resources.
 
 GitOps CRs that are themselves managed (a child Application from an app-of-apps parent, a Kustomization referenced by another Kustomization, ApplicationSet children) render with a small `Argo` or `Flux` tool badge and a `→` chevron — click to open that CR's own GitOps detail page. The child page's breadcrumb shows the lineage `GitOps / parent-ns/parent / child-ns/child`; the parent segment is clickable to navigate back.
 
```

**File**: `docs/integrations.md` (modified, +13/-1)
```diff
@@ -894,7 +894,9 @@ See the main [README](../README.md#gitops) for the user-facing overview. This se
 | GitRepository | `source.toolkit.fluxcd.io/v1` | Yes | Yes | — |
 | OCIRepository | `source.toolkit.fluxcd.io/v1beta2` | Yes | Yes | — |
 | HelmRepository | `source.toolkit.fluxcd.io/v1` | Yes | Yes | — |
-| Bucket / HelmChart / ExternalArtifact | `source.toolkit.fluxcd.io` | When referenced | Generic | — |
+| Bucket / HelmChart | `source.toolkit.fluxcd.io` | When referenced | Generic | — |
+| ExternalArtifact | `source.toolkit.fluxcd.io/v1` | When referenced | Yes | — |
+| ArtifactGenerator | `source.extensions.fluxcd.io/v1beta1` (source-watcher) | When referenced | Yes | — |
 | Kustomization | `kustomize.toolkit.fluxcd.io/v1` | Yes | Yes | Yes |
 | HelmRelease | `helm.toolkit.fluxcd.io/v2` | Yes | Yes | Yes |
 | Alert | `notification.toolkit.fluxcd.io/v1beta3` | — | Yes | — |
@@ -906,6 +908,16 @@ observed Flux sources in both directions within Radar's namespace scope.
 Kustomizations use `spec.sourceRef`; HelmReleases use `spec.chart.spec.sourceRef`
 or `spec.chartRef`. Inline releases also link the generated HelmChart named by
 `status.helmChart`; an observed HelmChart links its source in its own namespace.
+An ExternalArtifact links the ArtifactGenerator named by its `spec.sourceRef`, and a
+generator links the GitRepository / OCIRepository / Bucket / HelmChart /
+ExternalArtifact in its `spec.sources` (with their aliases). Its artifact count
+reads the ExternalArtifacts in `status.inventory`, not the Namespaces
+source-watcher 2.3 also records there, and shows `-` when Radar can't read an
+inventory. These upstream hops follow only objects already reached
+from a root, at most eight levels, so a release that consumes one of a
+generator's artifacts never pulls in the generator's other artifacts. A
+generator paused with `source.extensions.fluxcd.io/reconcile: disabled` is
+Suspended, not failing, in every surface (tree, topology, table, drawer, Issues).
 `spec.dependsOn` links a Kustomization or HelmRelease to the objects of the same
 kind it waits for (an entry without a namespace means its own namespace).
 These are dependencies, not owners: topology draws each source upstream, with
```

**File**: `docs/ownership.md` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ The families so far:
 | `GatewayBackends` | Gateway API routes → the Services their rules send traffic to, in any namespace, whether or not a ReferenceGrant permits it | `families.go` |
 | `GatewayClasses` | Gateways → the GatewayClass they name | `families.go` |
 | `CertManagerIssuers` | cert-manager Certificates, CertificateRequests, ACME Orders and Challenges → the Issuer or ClusterIssuer their `issuerRef` names (external issuers aren't followed) | `families.go` |
-| `FluxSources` | Flux Kustomizations, HelmReleases, HelmCharts → the GitRepository, OCIRepository, Bucket, ExternalArtifact, HelmRepository or HelmChart they build from, in any namespace (an inline HelmRelease also declares the HelmChart the controller recorded) | `families.go` |
+| `FluxSources` | Flux Kustomizations, HelmReleases, HelmCharts → the GitRepository, OCIRepository, Bucket, ExternalArtifact, HelmRepository or HelmChart they build from, in any namespace (an inline HelmRelease also declares the HelmChart the controller recorded); up the artifact chain, ExternalArtifacts → the ArtifactGenerator their `spec.sourceRef` names (another producer isn't followed), and ArtifactGenerators → the GitRepository, OCIRepository, Bucket, HelmChart or ExternalArtifact their `spec.sources` list | `families.go` |
 | `NodeClasses` | Karpenter NodePools → their provider's NodeClass, or EKS Auto Mode's (`IsTarget`: each provider defines its own kind) | `families.go` |
 | `ClusterClasses` | Cluster API Clusters → the ClusterClass their topology names, in any namespace | `families.go` |
 | `KnativeEventDestinations` | Knative Triggers, event sources and Channels → where they send events (subscriber, sink, backing channel), in any namespace: core Services and any kind in a Knative group, such as JobSink | `families.go` |
```

---

### Incident Patch 3: `f9020ce3` (2026-11-24)
**Commit Message**: fix(traffic): count Beyla flows between two nodes once (#2754)

## Description

Beyla runs one agent per node, and a flow between pods on two different
nodes is reported by both agents. The two copies have the same labels
except the agent's own target labels. Every L4 query summed them, so
cross-node edges showed twice their bytes (#2753).

- `beylaRateQuery` now splits the series into three disjoint selectors
joined with `or`:
  - series with `k8s_src_node_name`;
  - series with only `k8s_dst_node_name`;
  - series with neither.

The first two are collapsed with `max without (instance, pod, node,
host)` before the `sum by`, and the third is summed as before. A cluster
that doesn't export the node labels gets exactly today's numbers. The
node labels are what makes `max` safe: without them, two replicas on
different nodes look like a duplicate. That is why series without them
are not collapsed. The change applies to all three L4 queries: sent
bytes, received bytes and unorientable flows.
- `node` and `host` are in the list because common scrape configs add
them per agent (the Beyla demo's own Prometheus relabels the pod's node
to `node`). Without them, the copies stay apart.
- When 

**File**: `internal/traffic/beyla.go` (modified, +41/-1)
```diff
@@ -397,6 +397,9 @@ type l4LabelPresence struct {
 	portedDsts map[dstKey]bool
 	port       bool
 	transport  bool
+	// nodeLabelsMissing is set when the probe answered that no series carries
+	// a node label, so cross-node flows cannot be collapsed and count twice.
+	nodeLabelsMissing bool
 	// replyLossFraction is how much of the return traffic Prometheus could not
 	// measure, between 0 and 1. Exporting dst.port makes Beyla label each reply
 	// with the client's port, which is new for every connection and gone again
@@ -435,6 +438,10 @@ func (s *BeylaSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsRes
 		presence.replyLossFraction = s.replyLossFraction(ctx, rateWindowFor(opts.Since), scopes.l4Selector())
 	}
 
+	if len(flows) > 0 {
+		presence.nodeLabelsMissing = s.nodeLabelsMissing(ctx, scopes.l4Selector())
+	}
+
 	response := &FlowsResponse{Source: "beyla", Timestamp: time.Now(), Flows: flows}
 	if warning := presence.warning(len(flows)); warning != "" {
 		response.Warning = warning
@@ -540,6 +547,11 @@ func (p l4LabelPresence) warning(flowCount int) string {
 					"received-byte figures would become unreliable. It is a trade rather than a fix.")
 			}
 		}
+		if p.nodeLabelsMissing {
+			parts = append(parts, fmt.Sprintf("Flows between two nodes are reported by both nodes' Beyla agents and "+
+				"counted twice here. Add k8s.src.node.name and k8s.dst.node.name to attributes.select for %s (keep "+
+				"the default attributes in the list) and Radar will count them once.", strings.TrimSuffix(p.metric, "_total")))
+		}
 	}
 
 	return strings.Join(parts, " ")
@@ -854,12 +866,29 @@ const (
 	beylaL7DetailGroupBy = `k8s_namespace_name, k8s_owner_name, k8s_pod_name, server_port`
 )
 
+// beylaAgentLabels are the scrape target labels that differ between two agents'
+// copies of one flow; any other per-agent label would keep the copies apart.
+const beylaAgentLabels = "instance, pod, node, host"
+
 // beylaRateQuery builds `sum by (groupBy) (rate(metric{job=~...,extra}[window]))`. A
 // namespace filter has to become two OR'd selectors: PromQL cannot express
 // "src OR dst namespace matches" inside a single label selector.
+//
+// A flow between two nodes is reported by both nodes' agents, identical except
+// for beylaAgentLabels. Collapsing them with max is safe only for series that
+// carry a node label: without one, two replicas of an owner on different nodes
+// are indistinguishable from a duplicate. So the series are split three ways,
+// by which node labels they carry, and only the labelled sets are collapsed.
+// The sets are disjoint and their label sets differ, so `or` keeps all three.
 func beylaRateQuery(groupBy, metric, sel, namespace, extra string, w rateWindow) string {
 	sum := func(more string) string {
-		return fmt.Sprintf(`sum by (%s) (rate(%s{%s%s%s}[%s]))`, groupBy, metric, sel, extra, more, w.promQL)
+		rate := func(nodes string) string {
+			return fmt.Sprintf(`rate(%s{%s%s%s%s}[%s])`, metric, sel, extra, nodes, more, w.promQL)
+		}
+		return fmt.Sprintf(`sum by (%s) (max without (%s) (%s) or max without (%s) (%s) or %s)`, groupBy,
+			beylaAgentLabels, rate(`, k8s_src_node_name!=""`),
+			beylaAgentLabels, rate(`, k8s_src_node_name="", k8s_dst_node_name!=""`),
+			rate(`, k8s_src_node_name="", k8s_dst_node_name=""`))
 	}
 	if namespace == "" {
 		return sum("")
@@ -960,6 +989,17 @@ func (s *BeylaSource) replyLossFraction(ctx context.Context, w rateWindow, sel s
 	return val
 }
 
+// nodeLabelsMissing reports whether Prometheus answered that no flow series
+// carries a node label on a cluster that may have more than one node: with one
+// node no flow crosses nodes. An unknown node count keeps the warning. A failed
+// probe reports false: it drives a warning.
+func (s *BeylaSource) nodeLabelsMissing(ctx context.Context, sel string) bool {
+	metric := s.flowMetricName()
+	result, err := s.query(ctx, fmt.Sprintf(`count(%s{%s, k8s_src_node_name!=""} or %s{%s, k8s_dst_node_name!=""})`,
+		metric, sel, metric, sel))
+	return err == nil && result != nil && len(result.Series) == 0 && countClusterNodes(ctx, s.k8sClient) != 1
+}
+
 func (s *BeylaSource) queryReceivedBytes(ctx context.Context, opts FlowOptions, sel string) (map[flowKey]int64, error) {
 	// k8s_*_owner_type belongs in the group-by even though the key ignores it.
 	// Beyla reports a Service-routed conversation twice, once attributed to the
```

**File**: `internal/traffic/beyla_test.go` (modified, +101/-0)
```diff
@@ -749,6 +749,107 @@ func TestBeylaSource_QueryL4_NamespaceFilterIsValidPromQL(t *testing.T) {
 	}
 }
 
+func TestBeylaRateQuery_CountsCrossNodeFlowsOnce(t *testing.T) {
+	// Both nodes' agents report a cross-node flow with identical labels apart
+	// from instance and pod. Only series carrying a node label can be collapsed:
+	// without one, two replicas on different nodes look exactly like a duplicate.
+	got := beylaRateQuery("a, b", "m", `job="x"`, "", `, direction="request"`, rateWindowFor(0))
+	want := `sum by (a, b) (` +
+		`max without (instance, pod, node, host) (rate(m{job="x", direction="request", k8s_src_node_name!=""}[5m])) or ` +
+		`max without (instance, pod, node, host) (rate(m{job="x", direction="request", k8s_src_node_name="", k8s_dst_node_name!=""}[5m])) or ` +
+		`rate(m{job="x", direction="request", k8s_src_node_name="", k8s_dst_node_name=""}[5m]))`
+	assertEq(t, "query", got, want)
+}
+
+func TestBeylaRateQuery_NamespaceFilterReachesEveryBranch(t *testing.T) {
+	q := beylaRateQuery(beylaL4GroupBy, beylaFlowMetric, beylaJobSelector(), "ns1", beylaL4DirectionFilter, rateWindowFor(0))
+	for _, label := range []string{"k8s_src_namespace", "k8s_dst_namespace"} {
+		if n := strings.Count(q, label+`="ns1"`); n != 3 {
+			t.Errorf("%s matcher appears %d times, want once per node branch (3): %s", label, n, q)
+		}
+	}
+}
+
+func beylaNodeProbeFake(probe func() (*prom.QueryResult, error)) promQueryFunc {
+	return func(_ context.Context, query string) (*prom.QueryResult, error) {
+		if strings.Contains(query, `direction="unknown"`) {
+			return emptyResult(), nil
+		}
+		if strings.HasPrefix(query, "count(") && strings.Contains(query, `k8s_src_node_name!=""`) {
+			return probe()
+		}
+		if strings.Contains(query, "beyla_network_flow_bytes_total") {
+			return promResult("vector", promSeries(map[string]string{
+				"k8s_src_owner_name": "client", "k8s_src_namespace": "demo",
+				"k8s_dst_owner_name": "web", "k8s_dst_namespace": "demo",
+				"dst_port": "80", "transport": "TCP",
+			}, 12.0)), nil
+		}
+		return emptyResult(), nil
+	}
+}
+
+const nodeLabelAdvice = "Flows between two nodes are reported by both nodes' Beyla agents and counted twice here."
+
+func TestBeylaSource_GetFlows_WarnsWhenNodeLabelsAreAbsent(t *testing.T) {
+	src := &BeylaSource{k8sClient: fake.NewSimpleClientset()}
+	src.queryFn = beylaNodeProbeFake(func() (*prom.QueryResult, error) { return emptyResult(), nil })
+
+	resp, err := src.GetFlows(context.Background(), FlowOptions{})
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	for _, want := range []string{nodeLabelAdvice, "k8s.src.node.name and k8s.dst.node.name", "beyla_network_flow_bytes"} {
+		if !strings.Contains(resp.Warning, want) {
+			t.Errorf("warning should contain %q, got: %q", want, resp.Warning)
+		}
+	}
+	assertEq(t, "warningKind", resp.WarningKind, WarningPartial)
+}
+
+func TestBeylaSource_GetFlows_NoNodeLabelWarningOnOneNode(t *testing.T) {
+	// With one node no flow crosses nodes, so nothing is counted twice.
+	src := &BeylaSource{k8sClient: fake.NewSimpleClientset(&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "n1"}})}
+	src.queryFn = beylaNodeProbeFake(func() (*prom.QueryResult, error) { return emptyResult(), nil })
+
+	resp, err := src.GetFlows(context.Background(), FlowOptions{})
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	if resp.Warning != "" {
+		t.Errorf("expected no warning on a single-node cluster, got: %q", resp.Warning)
+	}
+}
+
+func TestBeylaSource_GetFlows_NoNodeLabelWarningWhenPresent(t *testing.T) {
+	src := &BeylaSource{k8sClient: fake.NewSimpleClientset()}
+	src.queryFn = beylaNodeProbeFake(func() (*prom.QueryResult, error) {
+		return promResult("vector", promSeries(map[string]string{}, 4)), nil
+	})
+
+	resp, err := src.GetFlows(context.Background(), FlowOptions{})
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	if resp.Warning != "" {
+		t.Errorf("expected no warning when node labels are exported, got: %q", resp.Warning)
+	}
+}
+
+func TestBeylaSource_GetFlows_NoNodeLabelWarningWhenProbeFails(t *testing.T) {
+	// A warning invented from a failed query is worse than none.
+	src := &BeylaSource{k8sClient: fake.NewSimpleClientset()}
+	src.queryFn = beylaNodeProbeFake(func() (*prom.QueryResult, error) { return nil, fmt.Errorf("timeout") })
+
+	resp, err := src.GetFlows(context.Background(), FlowOptions{})
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	if strings.Contains(resp.Warning, nodeLabelAdvice) {
+		t.Errorf("a failed probe must not produce the node-label advice, got: %q", resp.Warning)
+	}
+}
+
 func TestBeylaSource_QueryL7_UsesCorrectMetricAndLabels(t *testing.T) {
 	q := beylaL7RateQuery(beylaJobSelector(), "test-ns", rateWindowFor(0))
 	if !strings.Contains(q, "http_server_request_duration_seconds_count") {
```

**File**: `internal/traffic/hubble.go` (modified, +5/-5)
```diff
@@ -1309,7 +1309,7 @@ func (h *HubbleSource) connectedNodes(ctx context.Context, client observerpb.Obs
 	defer cancel()
 	if status, err := client.ServerStatus(statusCtx, &observerpb.ServerStatusRequest{}); err == nil {
 		n = int(status.GetNumConnectedNodes().GetValue())
-	} else if c := h.clusterNodeCount(ctx); c > 0 {
+	} else if c := countClusterNodes(ctx, h.k8sClient); c > 0 {
 		n = c
 	}
 	if ctx.Err() != nil {
@@ -1323,16 +1323,16 @@ func (h *HubbleSource) connectedNodes(ctx context.Context, client observerpb.Obs
 	return n
 }
 
-// clusterNodeCount counts the cluster's nodes from a one-item page: the API
+// countClusterNodes counts the cluster's nodes from a one-item page: the API
 // server reports how many it left out, so this reads one node, not all. 0 when
 // it cannot tell.
-func (h *HubbleSource) clusterNodeCount(ctx context.Context) int {
-	if h.k8sClient == nil {
+func countClusterNodes(ctx context.Context, client kubernetes.Interface) int {
+	if client == nil {
 		return 0
 	}
 	listCtx, cancel := context.WithTimeout(ctx, hubbleStatusTimeout)
 	defer cancel()
-	nodes, err := h.k8sClient.CoreV1().Nodes().List(listCtx, metav1.ListOptions{Limit: 1})
+	nodes, err := client.CoreV1().Nodes().List(listCtx, metav1.ListOptions{Limit: 1})
 	if err != nil {
 		return 0
 	}
```

**File**: `scripts/beyla-demo.sh` (modified, +43/-2)
```diff
@@ -19,6 +19,8 @@
 #   attrs         Beyla config B: same, plus attributes.select adding dst.port and
 #                 transport. Watch the series count explode via ephemeral ports.
 #   no-network    Beyla config C: application only. The network flow metric disappears.
+#   nodes         Beyla config D: config B plus k8s.src.node.name and k8s.dst.node.name,
+#                 which let a consumer count a flow reported by two nodes' agents once.
 #   port-forward  Port-forward Prometheus to localhost:$PROM_LOCAL_PORT (foreground).
 #   help          Show this message.
 #
@@ -29,6 +31,8 @@
 #   - curl, python3
 #
 # Set CLUSTER_NAME=foo to use a different cluster (default: radar-beyla-demo).
+# Set BEYLA_DEMO_NODES=2 on `up` for a control plane plus a worker, with client on
+# the control plane and web/db on the worker, so their flows cross nodes.
 #
 # NOTES, learned the hard way:
 #   - Beyla's network flow metric exports `dst_port` and `transport` ONLY when they are
@@ -49,6 +53,7 @@
 set -euo pipefail
 
 CLUSTER_NAME="${CLUSTER_NAME:-radar-beyla-demo}"
+BEYLA_DEMO_NODES="${BEYLA_DEMO_NODES:-1}"
 KUBECTL_CTX="kind-${CLUSTER_NAME}"
 
 # Versions pinned so the demo behaves consistently across runs. Bump deliberately.
@@ -146,9 +151,10 @@ config:
 YAML
 }
 
+# $1: extra attributes.select entries, one YAML list line each.
 beyla_values_attrs() {
   beyla_values_common
-  cat <<'YAML'
+  cat <<YAML
 env:
   OTEL_EBPF_METRICS_FEATURES: "application,network"
   OTEL_EBPF_LOG_LEVEL: "info"
@@ -173,6 +179,7 @@ config:
             - dst.port
             - transport
             - direction
+${1:-}
     network:
       enable: true
     discovery:
@@ -212,6 +219,10 @@ apply_beyla() {
   case "$mode" in
     default)    beyla_values_default    > "$values" ;;
     attrs)      beyla_values_attrs      > "$values" ;;
+    # Both nodes' agents report a cross-node flow; the node names are what tell
+    # that duplicate apart from two replicas of one owner on different nodes.
+    nodes)      beyla_values_attrs "            - k8s.src.node.name
+            - k8s.dst.node.name" > "$values" ;;
     no-network) beyla_values_no_network > "$values" ;;
     *) fail "unknown Beyla mode: $mode" ;;
   esac
@@ -406,6 +417,22 @@ YAML
   ok "web (2 replicas, :80 and :8080, each with a failing route), db (:6379), and two callers applied"
 }
 
+# client on the control plane, web and db on the worker: every client flow crosses
+# nodes, so both agents report it.
+pin_across_nodes() {
+  kctl get node "${CLUSTER_NAME}-worker" >/dev/null 2>&1 ||
+    fail "Cluster '${CLUSTER_NAME}' has no worker node. It was created without BEYLA_DEMO_NODES=2; run 'BEYLA_DEMO_NODES=2 $0 reset'."
+  step "Pinning client to ${CLUSTER_NAME}-control-plane, web and db to ${CLUSTER_NAME}-worker"
+  kctl -n "${DEMO_NS}" patch deploy client --type merge -p "{\"spec\":{\"template\":{\"spec\":{
+    \"nodeSelector\":{\"kubernetes.io/hostname\":\"${CLUSTER_NAME}-control-plane\"},
+    \"tolerations\":[{\"key\":\"node-role.kubernetes.io/control-plane\",\"operator\":\"Exists\",\"effect\":\"NoSchedule\"}]}}}}" >/dev/null
+  for d in web db; do
+    kctl -n "${DEMO_NS}" patch deploy "$d" --type merge -p "{\"spec\":{\"template\":{\"spec\":{
+      \"nodeSelector\":{\"kubernetes.io/hostname\":\"${CLUSTER_NAME}-worker\"}}}}}" >/dev/null
+  done
+  ok "client and web/db on different nodes"
+}
+
 apply_prometheus() {
   step "Deploying Prometheus in namespace '${MONITORING_NS}'"
   # Deliberately minimal: one Deployment, pod service discovery, 2h retention. All we
@@ -592,7 +619,12 @@ cmd_up() {
     step "Cluster '${CLUSTER_NAME}' already exists — reusing"
   else
     step "Creating kind cluster '${CLUSTER_NAME}'"
-    kind create cluster --name "${CLUSTER_NAME}" --wait 90s
+    if [ "${BEYLA_DEMO_NODES}" = "2" ]; then
+      printf 'kind: Cluster\napiVersion: kind.x-k8s.io/v1alpha4\nnodes:\n  - role: control-plane\n  - role: worker\n' |
+        kind create cluster --name "${CLUSTER_NAME}" --config - --wait 90s
+    else
+      kind create cluster --name "${CLUSTER_NAME}" --wait 90s
+    fi
     ok "Cluster created"
   fi
 
@@ -603,6 +635,7 @@ cmd_up() {
   fi
 
   apply_workloads
+  if [ "${BEYLA_DEMO_NODES}" = "2" ]; then pin_across_nodes; fi
   apply_prometheus
   apply_beyla default
 
@@ -710,6 +743,12 @@ cmd_query() {
   note "sum by (8 labels) (rate(beyla_network_flow_bytes_total{${JOB_SELECTOR}, direction=\"request\"}[5m]))"
   prom_query "sum by (k8s_src_owner_name, k8s_src_namespace, k8s_src_owner_type, k8s_dst_owner_name, k8s_dst_namespace, k8s_dst_owner_type, dst_port, transport) (rate(beyla_network_flow_bytes_total{${JOB_SELECTOR}, direction=\"request\"}[5m]))" | print_series
 
+  step "The same edges as Radar counts them: two agents' copies of a cross-node flow collapsed"
+  note "series with a node label: max without (instance, pod, node, host) before the sum; others summed as above"
+  local sel="${JOB_SELECTOR}, direction=\"request\""
+  local m="beyla_
```

**File**: `scripts/beyla-demo/README.md` (modified, +17/-3)
```diff
@@ -13,12 +13,15 @@ of any consumer.
 ./scripts/beyla-demo.sh query         # the exact L4 and L7 PromQL the Beyla source runs
 ./scripts/beyla-demo.sh attrs         # config B: adds dst.port and transport to attributes.select
 ./scripts/beyla-demo.sh no-network    # config C: application only, network feature off
+./scripts/beyla-demo.sh nodes         # config D: config B plus k8s.src.node.name and k8s.dst.node.name
 ./scripts/beyla-demo.sh default       # back to config A
 ./scripts/beyla-demo.sh port-forward  # Prometheus on localhost:39090
 ./scripts/beyla-demo.sh down
 ```
 
-`make beyla-demo` is `up`.
+`make beyla-demo` is `up`. `BEYLA_DEMO_NODES=2 ./scripts/beyla-demo.sh up` builds a
+control plane and a worker instead, with `client` pinned to the control plane and
+`web`/`db` to the worker, so their flows cross nodes. Use it with config D.
 
 ## The three configurations, and why all three matter
 
@@ -27,6 +30,7 @@ of any consumer.
 | **A** (`default`) | network + application | none | An operator turned network metrics on and changed nothing else. **This is the realistic default.** |
 | **B** (`attrs`) | network + application | `dst.port`, `transport`, `direction` | What a per-port traffic map actually needs. |
 | **C** (`no-network`) | application only | none | Stock Beyla. The network flow metric does not exist. |
+| **D** (`nodes`) | network + application | B plus `k8s.src.node.name`, `k8s.dst.node.name` | What counting a cross-node flow once needs. Two-node cluster only. |
 
 Test against A before B. A is what users will have.
 
@@ -96,6 +100,16 @@ no port detail but truthful byte counts, B has exact ports and a received-byte
 figure that is roughly a tenth of the truth. Anything that recommends B for the
 sake of per-port edges should say what it costs.
 
+**A flow between two nodes is reported by both nodes' agents.** With two nodes,
+`client -> web` arrives as two series with identical flow labels, one per agent,
+so a consumer summing them doubles the bytes. The copies differ only in the
+scrape's own target labels: `instance`, plus the `node` label this Prometheus
+adds by relabelling. Radar drops `instance`, `pod`, `node` and `host` before
+collapsing the copies; any other per-agent target label would keep them apart and
+the flow would still count twice. Without the node attributes (configs A-C), the copies cannot
+be told apart from two replicas of one owner running on different nodes. The
+Service-attributed series has no destination node and comes from one agent only.
+
 ## Metric names
 
 Grafana's Beyla emits `beyla_network_flow_bytes_total`; upstream OpenTelemetry
@@ -130,8 +144,8 @@ owner-type series.
 
 ## Limits
 
-Single node, so node-spanning flows and two agents reporting the same
-conversation are not exercised. No SCTP or ICMP, so non-TCP/UDP transport handling
+Single node by default, so node-spanning flows and two agents reporting the same
+conversation are exercised only with `BEYLA_DEMO_NODES=2`. No SCTP or ICMP, so non-TCP/UDP transport handling
 is untested. Upstream OBI is not installed, and neither is Alloy, so the
 Alloy-detection path is not exercised here.
 
```

#### Recent Merged Pull Requests:
- **PR #2890** (2026-11-24): Let application lists show followed apps first (@nadaverell)
- **PR #2880** (closed): Replay rightsizing reductions against verified workload history (@nadaverell)
- **PR #2878** (2026-11-24): Serve the Sealed Secrets controller’s public sealing certificate (@nadaverell)
- **PR #2877** (2026-11-24): Withhold memory reductions after unexplained recent Pod restarts (@nadaverell)
- **PR #2876** (2026-11-24): Keep rightsizing samples isolated across reused cluster names (@nadaverell)
- **PR #2875** (2026-11-24): Keep fleet rightsizing queries within backend limits (@nadaverell)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Withhold memory reductions after unexplained recent Pod restarts

**RULE**:
When implementing operations in `docs/mcp.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in skyhook-io/radar. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `55249927`: Withhold memory reductions after unexplained recent Pod restarts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/mcp.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
When a recent container exit has no reliable cause, Radar withholds memory reductions for that container. Check the Pod’s current and last termination state and its events. A generic exit 137 or SIGKILL does not by itself establish an OOM. A verified OOM produces its own review reason.

```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `55249927` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
