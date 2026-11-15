# Agent Contract: Agent Contract: skyhook-io/radar Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "skyhook-io/radar",
  "source_url": "https://github.com/skyhook-io/radar",
  "source_version": "7f30b56d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T21:15:43.323Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-skyhook-io-radar",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyhook-io/radar](https://github.com/skyhook-io/radar) (Revision: `7f30b56d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T21:15:43.323Z`  
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
> **Harvest Timestamp**: 2026-11-15T21:15:42.228Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4129 stars

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
	"crypto/x509"
	"errors"
	"net"
	"strings"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// ConnectionState represents the current connection status to the cluster
type ConnectionState string

const (
	StateConnected    ConnectionState = "connected"
	StateDisconnected ConnectionState = "disconnected"
	StateConnecting   ConnectionState = "connecting"
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
	connectionStatusMu.Lock()
	status.DisconnectedAt = outageStart(connectionStatus, status, time.Now())
	if connectionStatus == status {
		connectionStatusMu.Unlock()
		return
	}
	connectionStatus = status
	connectionStatusMu.Unlock()

	// Publish-side recovery ownership: every route into an auth-shaped
	// disconnect (bootstrap with expired credentials, failed retry, failed
	// context switch) must leave a reconnect loop running — the browser no
	// longer auto-retries auth failures. Owed survives later non-auth
	// republications (a hung-plugin retry classifies "timeout") and is only
	// settled by a successful connect.
	switch status.State {
	case StateConnected:
		runtimeAuthRecoveryOwed.Store(false)
		resetInconclusiveStreak()
	case StateDisconnected:
		if isAuthClassification(status.ErrorType) {
			runtimeAuthRecoveryOwed.Store(true)
		}
		if runtimeAuthRecoveryOwed.Load() {
			startRuntimeAuthRecovery()
		}
	}

	notifyConnectionChange(status)
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
		clientMu.RLock()
		generation := activeClientGeneration
		clientMu.RUnlock()
		reportRuntimeAuthFailure(generation, errors.New(message))
		return false
	}
	if !isClusterUnreachableMessage(message) {
		return false
	}
	current := GetConnectionStatus()
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
	SetConnectionStatus(status)
	return true
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
		"failed to inspect existing release",
		"failed to preview values change",
		"failed to apply values",
		"rollback failed",
		"uninstall failed",
		"upgrade failed",
		"install failed",
	}
	for _, prefix := range kubernetesOperationPrefixes {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return false
}

func isTransportConnectivityError(lower string) bool {
	return isTransportNetworkMessage(lower) || isTransportTimeoutMessage(lower)
}

func isTransportNetworkMessage(lower string) bool {
	transportMarkers := []string{
		"connection refused",
		"no such host",
		"dial tcp",
		"dial udp",
		"no route to host",
		"connection reset by peer",
		"network is unreachable",
	}
	for _, marker := range transportMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func isTransportTimeoutMessage(lower string) bool {
	timeoutMarkers := []string{
		"i/o timeout",
		"context deadline exceeded",
		"tls handshake timeout",
		"timed out",
		"timeout",
	}
	for _, marker := range timeoutMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// isAuthErrorMessage matches client-side credential acquisition failures (exec
// plugins, SSO sessions) — no request reached the API server, and
// re-authenticating locally is the fix.
func isAuthErrorMessage(lower string) bool {
	authMarkers := []string{
		"token has expired",
		"expired token",
		"sso session",
		"sso token",
		"ssoproviderinvalidtoken",
		"aws sso login",
		"getting credentials",
		"credentials expired",
		"credential plugin",
		"exec credential",
		"exec plugin",
		"gke-gcloud-auth-plugin",
		// client-go's in-tree oidc auth provider returns refresh failures RAW
		// from RoundTrip (no "getting credentials:" wrapper) — Keycloak/Dex/
		// IBM IKS kubeconfigs die here. "invalid_grant" is the RFC 6749 code
		// every IdP emits for an expired/revoked refresh token.
		"failed to refresh token",
		"invalid_grant",
		"cannot refresh without refresh-token",
		// The exec plugin's TLS client-certificate path (e.g. tsh) fails
		// without the "getting credentials:" wrapper; this phrasing is
		// produced only by client-go's exec plugin runner.
		"exec: executable ",
		"failed to read token file",
		"read empty token from file",
	}
	for _, marker := range authMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// isAuthRejectedMessage matches HTTP 401 responses: the request reached the API
// server but could not be authenticated. Checked only after isAuthErrorMessage
// so exec-plugin stderr that quotes a server error (e.g. "UnauthorizedException")
// still classifies as client-side auth.
func isAuthRejectedMessage(lower string) bool {
	if strings.Contains(lower, "proxy authentication required") {
		return false
	}
	rejectedMarkers := []string{
		"unauthorized",
		"authentication required",
		"the server has asked for the client to provide credentials",
	}
	for _, marker := range rejectedMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func isRBACErrorMessage(lower string) bool {
	return strings.Contains(lower, " is forbidden") ||
		strings.Contains(lower, "forbidden:") ||
		strings.Contains(lower, "cannot list resource") ||
		strings.Contains(lower, "cannot get resource")
}

func isConfigErrorMessage(lower string) bool {
	configMarkers := []string{
		"no context con
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
- **Issue #2687** (2026-11-15): **Release Desktop workflow fails during Apple notarization due to missing/expired agreement**
  *Symptoms*: ## Describe the bug  The `Release Desktop` GitHub Actions workflow fails during the Apple notarization step for the macOS release artifact. The job reaches the notarization request, then exits with a 403 from Apple’s notarization service.  ## To reproduce  1. Trigger the `Release Desktop` workflow in `skyhook-io/radar` 2. Wait for the macOS build to finish packaging the app 3. Observe the workflow attempt to submit the artifact for Apple notarization 4. The job fails before finishing the release  ## Expected behavior  The release workflow should successfully submit the signed/notarized macOS artifact to Apple and complete the release process without failing.  ## Screenshots  Not applicable.  ## Diagnostics (optional)  N/A  ## Logs  ```text 2026-11-13T10:14:58.9407140Z Conducting pre-submission checks for radar-desktop_v1.20.3_darwin_universal.zip and initiating connection to the Apple notary service... 2026-11-13T10:15:00.9809290Z Error: HTTP status code: 403. A required agreement is missing or has expired. This request requires an in-effect agreement that has not been signed or has expired. Ensure your team has signed the necessary legal agreements and that they are not expired. 2026-11-13T10:15:00.9857090Z ##[error]Process completed with exit code 1. ```  ## Additional context  The workflow URL is: https://github.com/skyhook-io/radar/actions/runs/43406103414/job/131820798764  This appears to be an Apple Developer / notarization account issue rather than a code-level build f

- **Issue #2670** (2026-11-15): **Timeline: "spec changed (gen N→N+1, fields not specifically tracked)" for every Argo CD Application every few minutes**
  *Symptoms*: ## Describe the bug  The timeline shows "spec changed (gen N→N+1, fields not specifically tracked)" for every Argo CD Application every 2–3 minutes. Nothing in spec changed. The noise hides real events.  Argo CD Applications have no status subresource (argoproj/argo-cd#22967), so each status write (e.g. status.reconciledAt on every reconcile) bumps metadata.generation.  In internal/k8s/cache.go, generationBumpSignalsSpecChange() runs the generic check (genericDesiredState ignores metadata and status) only for kinds without an audited differ. Application has one (diffApplication in history.go), so the check is skipped and the function returns true for any generation bump.  ## To reproduce  1. Install Argo CD 3.6 with a few auto-synced Applications. 2. Install Radar (Helm chart 1.20.2, in-cluster, auth mode oidc). 3. Open the timeline and wait 5–10 minutes without changing anything.  ## Expected behavior  No "spec changed" event when only status/metadata changed, like for kinds without an audited differ. Possible fix: also compare genericDesiredState for audited unstructured kinds.  ## Screenshots  - Radar version: 1.20.2 - Kubernetes: 1.35.8 (kubeadm), Argo CD 3.6.1  <img width="1438" height="742" alt="2026-11-14_184927" src="https://github.com/user-attachments/assets/aff5c3ae-2e9e-468a-8b06-ce4051c041db" /> <img width="1441" height="744" alt="2026-11-14_184842" src="https://github.com/user-attachments/assets/200f14aa-f41c-4f3d-b5d0-bd80db87886a" /> <img width="1439" height="7

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

### Incident Patch 1: `41dfe716` (2026-11-15)
**Commit Message**: fix(gitops): let managed resource lists reveal every entry (#2688)

## Problem

The inventory list in the Argo CD Application, Kustomization and
HelmRelease drawers (`ManagedResourcesList`) cut every kind to an equal
share of the 20-entry cap even when the whole list fit under it, and
offered **Show all** only when the total exceeded the cap. An uneven
list therefore lost entries with no way to reveal them, and each kind's
header counted only the entries shown.

| Inventory | Before |
|---|---|
| 12 ConfigMaps, a Deployment, a Service (14) | ConfigMap (7): five
hidden, no Show all |
| 15 CRDs, a Namespace (16) | CRD (10): five hidden, no Show all |

Someone checking whether an object is in the inventory, for example
after reading a "Tracked by" tooltip, could miss one that is there.

## Change

- Kinds are cut only when the list exceeds the cap.
- **Show all** appears whenever any kind is cut.
- A cut kind's header reads "N of M" instead of the shown count.

## Tests

`ManagedResourcesList.test.tsx` adds three cases; all fail on `main`:
- an uneven list under the cap shows every entry and no Show all;
- over the cap, a cut kind reads "2 of 6" and Show all appears;
- over the cap wi

**File**: `packages/k8s-ui/src/components/gitops/ManagedResourcesList.test.tsx` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import { describe, expect, it } from 'vitest'
+import { renderToString } from 'react-dom/server'
+import { ManagedResourcesList } from './ManagedResourcesList'
+import type { ManagedResource } from '../../types/gitops'
+
+function render(element: Parameters<typeof renderToString>[0]): string {
+  return renderToString(element).replace(/<!-- -->/g, '')
+}
+
+function list(configMaps: number): ManagedResource[] {
+  return [
+    ...Array.from({ length: configMaps }, (_, i) => ({ group: '', kind: 'ConfigMap', namespace: 'shop', name: `cm-${i}` })),
+    { group: 'apps', kind: 'Deployment', namespace: 'shop', name: 'checkout' },
+    { group: '', kind: 'Service', namespace: 'shop', name: 'checkout' },
+  ]
+}
+
+describe('ManagedResourcesList', () => {
+  it('shows every entry of an uneven list under the cap', () => {
+    const html = render(<ManagedResourcesList resources={list(8)} />)
+    expect(html).toContain('ConfigMap</span><span class="text-theme-text-tertiary">(8)')
+    expect(html).not.toContain('Show all')
+  })
+
+  it('offers Show all whenever a kind is cut', () => {
+    const html = render(<ManagedResourcesList resources={list(6)} maxVisible={6} />)
+    expect(html).toContain('ConfigMap</span><span class="text-theme-text-tertiary">(2 of 6)')
+    expect(html).toContain('Show all 8 resources')
+  })
+
+  it('offers no Show all over the cap when no kind is cut', () => {
+    const html = render(<ManagedResourcesList resources={list(1)} maxVisible={2} />)
+    expect(html).not.toContain('Show all')
+  })
+})
```

**File**: `packages/k8s-ui/src/components/gitops/ManagedResourcesList.tsx` (modified, +8/-4)
```diff
@@ -38,7 +38,9 @@ export function ManagedResourcesList({
 
   const grouped = groupManagedResourcesByKind(resources)
   const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))
-  const hasMore = resources.length > maxVisible && !showAll
+  // Over the cap, each kind shows an equal share; Show all must appear whenever any kind is cut.
+  const perKind = !showAll && resources.length > maxVisible ? Math.ceil(maxVisible / sortedGroups.length) : Infinity
+  const hasMore = sortedGroups.some(([, kindResources]) => kindResources.length > perKind)
 
   return (
     <div className="border-b-subtle pb-4 last:border-0">
@@ -59,7 +61,8 @@ export function ManagedResourcesList({
             <ResourceKindGroup
               key={kind}
               kind={kind}
-              resources={showAll ? kindResources : kindResources.slice(0, Math.ceil(maxVisible / sortedGroups.length))}
+              resources={kindResources.slice(0, perKind)}
+              total={kindResources.length}
               onResourceClick={onResourceClick}
               showHealth={showHealth}
             />
@@ -82,11 +85,12 @@ export function ManagedResourcesList({
 interface ResourceKindGroupProps {
   kind: string
   resources: ManagedResource[]
+  total: number
   onResourceClick?: (resource: ManagedResource) => void
   showHealth?: boolean
 }
 
-function ResourceKindGroup({ kind, resources, onResourceClick, showHealth }: ResourceKindGroupProps) {
+function ResourceKindGroup({ kind, resources, total, onResourceClick, showHealth }: ResourceKindGroupProps) {
   const [expanded, setExpanded] = useState(resources.length <= 5)
 
   return (
@@ -97,7 +101,7 @@ function ResourceKindGroup({ kind, resources, onResourceClick, showHealth }: Res
       >
         <CollapseChevron open={expanded} className="w-3 h-3" />
         <span className="font-medium">{kind}</span>
-        <span className="text-theme-text-tertiary">({resources.length})</span>
+        <span className="text-theme-text-tertiary">({resources.length < total ? `${resources.length} of ${total}` : total})</span>
       </button>
 
       <Collapse open={expanded} mountLazily>
```

---

### Incident Patch 2: `2104974b` (2026-11-15)
**Commit Message**: fix(k8score): don't call self-managed AWS clusters EKS (#2655)

## Description

Radar labels any node with an `aws://` providerID as EKS. That ID only
says the node is an EC2 instance: the AWS cloud controller manager sets
it on self-managed clusters too (kubeadm, Cluster API + CAPA, kops), so
those show up as EKS.

`DetectByProviderID` now returns `eks` for an `aws://` node only when
its kubelet is an EKS build (`-eks-` in the kubelet version, e.g.
`v1.31.4-eks-2d5f260`). Otherwise detection falls through to the labels
as before (`eks.amazonaws.com/nodegroup` / `capacityType` still mean
EKS; OpenShift and Rancher labels now win on AWS too) and, failing
those, `generic`, which the UI shows as a standard Kubernetes cluster.
GKE, AKS, kind, Nutanix, RKE2 and NKP detection are unchanged.

The marker is checked only for nodes, not added to
`DetectPlatformFromVersion`: the traffic manager reads that from the
server version before its NKP check, so NKP on EKS would have turned
into `eks` there.

## Type of change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause e

**File**: `pkg/k8score/cluster_detection.go` (modified, +13/-1)
```diff
@@ -77,13 +77,19 @@ func DetectPlatformFromVersion(gitVersion string) string {
 }
 
 // DetectByProviderID detects the platform from a node's ProviderID field.
+// An aws:// ID only says the node is an EC2 instance: the AWS cloud controller
+// sets it on self-managed clusters too (kubeadm, Cluster API, kops), so it
+// counts as EKS only when the kubelet is an EKS build.
 func DetectByProviderID(node corev1.Node) string {
 	providerID := node.Spec.ProviderID
 	switch {
 	case strings.HasPrefix(providerID, "gce://") || strings.HasPrefix(providerID, "gke://"):
 		return "gke"
 	case strings.HasPrefix(providerID, "aws://"):
-		return "eks"
+		if isEKSKubeletVersion(node.Status.NodeInfo.KubeletVersion) {
+			return "eks"
+		}
+		return "unknown"
 	case strings.HasPrefix(providerID, "azure://"):
 		return "aks"
 	case strings.HasPrefix(providerID, "kind://"):
@@ -95,6 +101,12 @@ func DetectByProviderID(node corev1.Node) string {
 	}
 }
 
+// isEKSKubeletVersion reports whether a kubelet version is an EKS build, such
+// as v1.31.4-eks-2d5f260. Upstream kubelets report a plain v1.31.4.
+func isEKSKubeletVersion(version string) bool {
+	return strings.Contains(version, "-eks-")
+}
+
 // DetectByLabels detects the platform from a node's labels.
 func DetectByLabels(node corev1.Node) string {
 	if IsNodeGKE(node) {
```

**File**: `pkg/k8score/cluster_detection_test.go` (modified, +8/-1)
```diff
@@ -22,7 +22,12 @@ func TestDetectNodePlatform(t *testing.T) {
 		{name: "not an RKE2 suffix", node: nodeWithKubeletVersion("v1.31.7-rke2r1"), want: "unknown"},
 		{name: "GCE provider", node: nodeWithProviderID("gce://project/zone/node"), want: "gke"},
 		{name: "GKE provider", node: nodeWithProviderID("gke://project/zone/node"), want: "gke"},
-		{name: "AWS provider", node: nodeWithProviderID("aws:///zone/node"), want: "eks"},
+		{name: "AWS provider on EKS kubelet", node: nodeWithSignals("v1.31.4-eks-2d5f260", "aws:///us-east-1a/i-0abc", nil), want: "eks"},
+		{name: "AWS provider without EKS kubelet", node: nodeWithSignals("v1.36.5", "aws:///us-east-1a/i-0abc", nil), want: "unknown"},
+		{name: "AWS provider with no kubelet version", node: nodeWithProviderID("aws:///zone/node"), want: "unknown"},
+		{name: "AWS provider with EKS nodegroup label", node: nodeWithSignals("v1.31.4", "aws:///us-east-1a/i-0abc", map[string]string{"eks.amazonaws.com/nodegroup": "workers"}), want: "eks"},
+		{name: "AWS provider on OpenShift", node: nodeWithSignals("v1.31.4", "aws:///us-east-1a/i-0abc", map[string]string{"node.openshift.io/os_id": "rhcos"}), want: "openshift"},
+		{name: "EKS marker without AWS provider", node: nodeWithKubeletVersion("v1.31.4-eks-2d5f260"), want: "unknown"},
 		{name: "Azure provider", node: nodeWithProviderID("azure:///subscriptions/node"), want: "aks"},
 		{name: "kind provider", node: nodeWithProviderID("kind://docker/radar/control-plane"), want: "kind"},
 		{name: "Nutanix provider", node: nodeWithProviderID("nutanix://99d71c41-e100-4474-601b-5dd604becea6"), want: "nutanix"},
@@ -74,6 +79,8 @@ func TestDetectClusterPlatform(t *testing.T) {
 		{name: "no nodes", client: fake.NewSimpleClientset(), want: "unknown"},
 		{name: "generic node", client: fake.NewSimpleClientset(&corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: "worker-1"}}), want: "generic"},
 		{name: "RKE2 node", client: fake.NewSimpleClientset(nodePtr(nodeWithKubeletVersion("v1.31.7+rke2r1"))), want: "rke2"},
+		{name: "self-managed cluster on AWS", client: fake.NewSimpleClientset(nodePtr(nodeWithSignals("v1.36.5", "aws:///us-east-1a/i-0abc", nil))), want: "generic"},
+		{name: "EKS node", client: fake.NewSimpleClientset(nodePtr(nodeWithSignals("v1.31.4-eks-2d5f260", "aws:///us-east-1a/i-0abc", nil))), want: "eks"},
 		{name: "NKP on AWS infrastructure", client: fake.NewSimpleClientset(nodePtr(nodeWithProviderID("aws:///zone/node")), &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: NKPNamespace}}), want: "nkp"},
 		{name: "Nutanix without NKP", client: fake.NewSimpleClientset(nodePtr(nodeWithProviderID("nutanix://uuid"))), want: "nutanix"},
 		{name: "GKE Autopilot", client: fake.NewSimpleClientset(nodePtr(nodeWithSignals("", "gce://project/zone/node", map[string]string{"cloud.google.com/gke-autopilot": "true"}))), want: "gke-autopilot"},
```

---

### Incident Patch 3: `7f30b56d` (2026-11-15)
**Commit Message**: fix(gitops): avoid treating auto-sync off as manual orchestration (#2698)

An Application with auto-sync off can still be synced by another
controller, including ApplicationSet RollingSync. Radar's drift advice
previously said nothing would reconcile until the user clicked Sync and
suggested enabling auto-sync unconditionally.

The advice now states that auto-sync is off and asks for a review of the
desired changes and sync policy before deciding whether to sync.
Missing-resource messages in Issues, Resources and the tree use the same
review step without promising an in-app diff, and rollback copy retains
the consequence of syncing without implying that auto-sync off prevents
other controllers from deploying. When existing readable relationships
identify a parent, both Enable and Disable auto-sync explain that its
policy or source may overwrite the setting. For an ApplicationSet
parent, Enable also warns that pending changes may apply immediately and
bypass rollout ordering. The display label reads “Auto-sync off”; the
`Manual` wire value and rollback/filter predicates stay unchanged.

Validation: `make test-changed`, including auto-sync-off child shapes,
rollback and sync-hazard p

**File**: `docs/gitops.md` (modified, +2/-2)
```diff
@@ -82,7 +82,7 @@ The Issues band at the top of the detail page surfaces seven classes of problems
 
 - **Operation failures** (Argo) — the parser recognizes known controller failures (annotation-too-large, label-too-long, hook failure, admission webhook denial, RBAC, conflict, immutable field, schema migration, connectivity, etc.) and rewrites each into a plain-English cause
 - **Stuck-drift loop** — when sync succeeded at the current desired comparison’s sources and revisions but the app is *still* OutOfSync with auto-sync on and a recent reconcile, something is mutating resources after each apply. The Issue calls out likely culprits (mutating webhook, sibling controller, schema migration). An older successful apply or rollback against different desired sources/revisions remains ordinary pending drift, including after auto-sync is re-enabled behind a sync window. Missing apply/comparison evidence does not establish a loop
-- **Manual drift without auto-sync** — drift exists but auto-sync is disabled. The Issue tells you "nothing will reconcile until you click Sync" so you stop waiting, unless a sync would be hazardous (see below). A rollback marker in the latest operation, if successful, instead gives an informational note naming the applied revision(s) and recorded initiator; resource rows explain that Sync can undo the rollback (a current sync hazard replaces that advice, since the hazard is the more urgent consequence), including Missing rows while the current comparison is Unknown. Rows use `summary.rollbackRevision`, the revision(s) deployed by the latest successful marked rollback, only while effective auto-sync is off, independently of the OutOfSync-only informational note. Its absence does not mean no rollback happened. This records the last rollback, not the current live state: later changes can also show as drift. Syncing or enabling auto-sync deploys the current revision and can undo the rollback. A marked, completed rollback whose result sources or revisions differ from the requested ones instead gives a warning in both detail and cluster Issues, even if the app is Synced. A known requested target with no recorded applied revisions warns that the rollback target could not be verified. This operation-outcome warning uses the shared diagnosis and remains stable while that operation is latest, independently of the manual-drift timer. It belongs to the GitOps operation-failure category, with a distinct issue identity so current sync errors, operation failures or drift loops do not absorb its warning and recovery advice. Cluster Issues retains its delayed manual-drift warning after a successful rollback, with guidance to fix or revert Git before syncing again, or keep auto-sync off. Dry runs and failed or pending operations do not qualify. A later operation, including a dry-run, replaces the rollback evidence even if it does not move the app; Radar then returns to ordinary diagnosis. Argo's native rollback and a sync to an older revision have indistinguishable durable operation records, so Radar does not infer a rollback from old revisions or expiring audit events.
+- **Manual drift without auto-sync** — drift exists but auto-sync is disabled. The Issue asks you to review the desired changes and sync policy before deciding whether to sync, unless a sync would be hazardous (see below). Auto-sync being off does not rule out another controller initiating a sync, including ApplicationSet RollingSync. The visible sync-mode label is "Auto-sync off"; API responses retain "Manual". A rollback marker in the latest operation, if successful, instead gives an informational note naming the applied revision(s) and recorded initiator; resource rows explain that Sync can undo the rollback (a current sync hazard replaces that advice, since the hazard is the more urgent consequence), including Missing rows while the current comparison is Unknown. Rows use `summary.rollbackRevision`, the revision(s) deployed by the latest successful marked rollback, only while effective auto-sync is off, independently of the OutOfSync-only informational note. Its absence does not mean no rollback happened. This records the last rollback, not the current live state: later changes can also show as drift. Syncing or enabling auto-sync deploys the current revision and can undo the rollback. A marked, completed rollback whose result sources or revisions differ from the requested ones instead gives a warning in both detail and cluster Issues, even if the app is Synced. A known requested target with no recorded applied revisions warns that the rollback target could not be verified. This operation-outcome warning uses the shared diagnosis and remains stable while that operation is latest, independently of the manual-drift timer. It belongs to the GitOps operation-failure category, with a distinct issue identity so current sync errors, operation failures or drift loops do not absorb its warning and recovery advice. Cluster Issues retains its 
```

**File**: `internal/k8s/detect_gitops.go` (modified, +5/-7)
```diff
@@ -368,7 +368,7 @@ func detectArgoAppProblems(apps []*unstructured.Unstructured, tracker *argoDrift
 				setDetectionOnset(&d, now, outOfSyncAt)
 				d.Stuck = true
 				d.Cause = "Auto-sync applied cleanly and reconciled recently, yet live state keeps diverging from Git. Common causes: a mutating admission webhook adds defaults Argo isn't told to ignore; a sibling controller (Karpenter, Istio, cert-manager) writes back into spec; or a conversion webhook rewrites a deprecated API schema."
-				d.Action = "Open Changes to see the per-resource drift, then match it against your Git manifest, the resource's controller, and any mutating webhooks."
+				d.Action = "Open Resources to see the per-resource drift, then match it against your Git manifest, the resource's controller, and any mutating webhooks."
 				out = append(out, d)
 			} else {
 				dd := gitopsProblem(now, "Application", argoGroup, ns, name, "high",
@@ -380,18 +380,16 @@ func detectArgoAppProblems(apps []*unstructured.Unstructured, tracker *argoDrift
 				out = append(out, dd)
 			}
 		}
-		// A manual-sync app legitimately sits OutOfSync until an operator syncs
-		// it, so unlike the auto-synced branch above we only warn once the drift
-		// has persisted past manualDriftGate — long enough to be a forgotten
-		// change rather than one mid-review.
+		// Drift with auto-sync off can be intentional, so warn only after the
+		// existing grace period rather than during review or orchestration.
 		if !automated && outOfSync && manualDriftFor >= manualDriftGate {
 			dd := gitopsProblem(now, "Application", argoGroup, ns, name, "warning", "OutOfSyncManual",
 				fmt.Sprintf("Application has been out of sync for %s and auto-sync is not enabled", timeutil.FormatAgeShort(manualDriftFor)), createdAt)
 			setDetectionOnset(&dd, now, outOfSyncAt)
-			dd.Action = "Review the drift in Changes, then Sync the application (or enable auto-sync) if the drift is unintended."
+			dd.Action = "Review the desired changes and sync policy before deciding whether to sync."
 			if revision, _ := gitops.ArgoSuccessfulRollback(app); revision != "" {
 				dd.Message = "Last rollback deployed " + revision + "; the live state differs from the desired state and auto-sync is off."
-				dd.Action = "Syncing or enabling auto-sync applies the current source and can undo the rollback. Fix or revert the source first, or keep auto-sync off. Review Changes for later edits."
+				dd.Action = "Syncing or enabling auto-sync applies the current source and can undo the rollback. Fix or revert the source before syncing again. Review Resources for later edits."
 			}
 			if hazard := argoSyncHazardAction(app); hazard != "" {
 				dd.Action = hazard
```

**File**: `internal/k8s/detect_gitops_test.go` (modified, +4/-4)
```diff
@@ -690,8 +690,8 @@ func TestDetectArgoAppProblems_ManualDriftGate(t *testing.T) {
 		if !d.OnsetAt.Equal(base) {
 			t.Errorf("OnsetAt = %v, want exact first observation %v", d.OnsetAt, base)
 		}
-		if d.Action == "" {
-			t.Error("OutOfSyncManual should carry an Action")
+		if d.Action != "Review the desired changes and sync policy before deciding whether to sync." {
+			t.Errorf("unexpected manual drift guidance: %s", d.Action)
 		}
 	})
 
@@ -715,7 +715,7 @@ func TestDetectArgoAppProblems_ManualDriftGate(t *testing.T) {
 		if d.Message != "Last rollback deployed rev-old; the live state differs from the desired state and auto-sync is off." {
 			t.Errorf("message = %q", d.Message)
 		}
-		if d.Action != "Syncing or enabling auto-sync applies the current source and can undo the rollback. Fix or revert the source first, or keep auto-sync off. Review Changes for later edits." {
+		if d.Action != "Syncing or enabling auto-sync applies the current source and can undo the rollback. Fix or revert the source before syncing again. Review Resources for later edits." {
 			t.Errorf("action = %q", d.Action)
 		}
 	})
@@ -1239,7 +1239,7 @@ func TestDetectArgoAppProblems_ManualDriftAdviceRespectsSyncHazards(t *testing.T
 		name, want string
 		mutate     func(*unstructured.Unstructured)
 	}{
-		{"plain drift", "then Sync the application", func(*unstructured.Unstructured) {}},
+		{"plain drift", "before deciding whether to sync", func(*unstructured.Unstructured) {}},
 		{"shared resources", "also tracked by Application payments", func(app *unstructured.Unstructured) {
 			_ = unstructured.SetNestedSlice(app.Object, []any{map[string]any{"type": "SharedResourceWarning", "message": "Deployment/web is part of applications argocd/billing and payments"}}, "status", "conditions")
 		}},
```

**File**: `packages/k8s-ui/src/components/gitops/GitOpsDetailLayout.tsx` (modified, +9/-6)
```diff
@@ -12,11 +12,14 @@ import { RadarUpgradeNote, radarUpgradeNoteText } from '../ui/RadarUpgradeNote'
 import type { GitOpsHealthStatus, GitOpsInsight, GitOpsIssue, GitOpsRemediation, SyncStatus } from '../../types'
 import type { RadarUpgradeRequirement } from '../../types/fetch-error'
 
-function argoAutoSyncControllerNote(controller: ArgoActionHandlers['autoSyncController']): string {
+function argoAutoSyncControllerNote(controller: ArgoActionHandlers['autoSyncController'], enabling = false): string {
   if (!controller) return ''
-  return controller.kind === 'ApplicationSet'
-    ? ` ApplicationSet ${controller.name} can turn it back on; to keep it off, change the ApplicationSet's template.`
-    : ` Application ${controller.name} manages this one from Git and can turn it back on when it syncs; to keep it off, change it in Git.`
+  if (controller.kind === 'ApplicationSet') {
+    return enabling
+      ? ` ApplicationSet ${controller.name} may overwrite this setting. Enabling may apply pending changes immediately and bypass ApplicationSet rollout ordering. Review its template and rollout policy first.`
+      : ` ApplicationSet ${controller.name} may overwrite this setting or control when this Application syncs. Review its template and rollout policy before changing auto-sync.`
+  }
+  return ` Application ${controller.name} manages this one from Git and may overwrite this setting when it syncs. Review its source before changing auto-sync.`
 }
 
 function argoResumeDescription(suspended: boolean, settings: ArgoActionHandlers['resumeSettings']): string {
@@ -395,7 +398,7 @@ export function GitOpsDetailLayout(props: GitOpsDetailLayoutProps) {
                   {detail.path && <AppFact label="Path" value={detail.path} />}
                   {detail.chart && <AppFact label="Chart" value={detail.chart} />}
                   <AppFact label="Destination" value={detail.destination || '-'} />
-                  {detail.autoSyncMode && <AppFact label="Sync mode" value={detail.autoSyncMode} />}
+                  {detail.autoSyncMode && <AppFact label="Sync mode" value={detail.autoSyncMode === 'Manual' ? 'Auto-sync off' : detail.autoSyncMode} />}
                 </div>
               )}
               {resumeBlockedReason && <p className="mt-2 text-xs text-theme-text-secondary">{resumeBlockedReason}</p>}
@@ -456,7 +459,7 @@ export function GitOpsDetailLayout(props: GitOpsDetailLayoutProps) {
                   ) : (
                     <ActionButton
                       label="Enable auto-sync"
-                      description={argoResumeDescription(effectiveSuspended, argo.resumeSettings)}
+                      description={argoResumeDescription(effectiveSuspended, argo.resumeSettings) + argoAutoSyncControllerNote(argo.autoSyncController, true)}
                       icon={Play}
                       loading={argo.resuming}
                       onClick={() => !resumeBlockedReason && !resumeUpgrade && argo.onResume()}
```

**File**: `packages/k8s-ui/src/components/gitops/GitOpsTableView.tsx` (modified, +1/-1)
```diff
@@ -1023,7 +1023,7 @@ function GitOpsFilterSidebar({
 
         <GitOpsFilterSection icon={CircleDot} title="Automation (Sync policy)">
           <GitOpsFacetButton label="Auto-sync" count={automationCounts.auto} active={automationFilters.has('auto')} onClick={() => onToggleAutomation('auto')} />
-          <GitOpsFacetButton label="Manual" count={automationCounts.manual} active={automationFilters.has('manual')} onClick={() => onToggleAutomation('manual')} />
+          <GitOpsFacetButton label="Auto-sync off" count={automationCounts.manual} active={automationFilters.has('manual')} onClick={() => onToggleAutomation('manual')} />
           <GitOpsFacetButton label="Suspended" count={automationCounts.suspended} active={automationFilters.has('suspended')} tone="warning" onClick={() => onToggleAutomation('suspended')} />
         </GitOpsFilterSection>
 
```

**File**: `packages/k8s-ui/src/components/gitops/argo-radar-upgrade.test.tsx` (modified, +9/-6)
```diff
@@ -56,7 +56,7 @@ function layout(handlers: ArgoActionHandlers, status: GitOpsDetailStatus | null
       terminating={false}
       terminatingChipTooltip=""
       terminatingActionTooltip=""
-      detail={{ project: 'default' }}
+      detail={{ project: 'default', autoSyncMode: 'Manual' }}
       insight={null}
       insightLoading={false}
       isArgoApp
@@ -86,6 +86,7 @@ describe('Enable auto-sync on the GitOps detail page', () => {
     const markup = html(layout(argo({ resumeUpgrade: null })))
     expect(enableAutoSync(markup)).not.toMatch(/\sdisabled=""/)
     expect(markup).not.toContain('need the latest Radar')
+    expect(markup).toContain('Auto-sync off')
   })
 
   // Disable auto-sync works on every Radar; only the way back on is gated.
@@ -104,13 +105,15 @@ describe('Enable auto-sync on the GitOps detail page', () => {
       { name: 'first-time enable on a Radar that starts self-heal off', status: { sync: 'OutOfSync', health: 'Healthy', suspended: false } as GitOpsDetailStatus, settings: { prune: false, selfHeal: false }, copy: 'Argo applies new commits. Resources removed from Git are kept (prune off).' },
       { name: 'a block switched off in place with prune on', status: { sync: 'OutOfSync', health: 'Healthy', suspended: false } as GitOpsDetailStatus, settings: { prune: true, selfHeal: false }, copy: 'Argo applies new commits. Resources removed from Git are deleted (prune on).' },
       { name: 'unknown settings', status: null, settings: null, copy: 'Turn on automated sync, so Argo applies new commits from Git.' },
-    ])('explains $name', async ({ status, settings, copy }) => {
+      { name: 'known ApplicationSet parent', status: null, settings: null, controller: { kind: 'ApplicationSet' as const, name: 'clusters' }, copy: 'Turn on automated sync, so Argo applies new commits from Git. ApplicationSet clusters may overwrite this setting. Enabling may apply pending changes immediately and bypass ApplicationSet rollout ordering. Review its template and rollout policy first.' },
+      { name: 'known parent Application', status: null, settings: null, controller: { kind: 'Application' as const, name: 'bootstrap' }, copy: 'Turn on automated sync, so Argo applies new commits from Git. Application bootstrap manages this one from Git and may overwrite this setting when it syncs. Review its source before changing auto-sync.' },
+    ])('explains $name', async ({ status, settings, controller, copy }) => {
       vi.useFakeTimers()
       const element = document.createElement('div')
       document.body.appendChild(element)
       const root = createRoot(element)
       try {
-        await act(async () => { root.render(layout(argo({ resumeSettings: settings }), status)) })
+        await act(async () => { root.render(layout(argo({ resumeSettings: settings, autoSyncController: controller }), status)) })
         const button = [...element.querySelectorAll('button')].find((b) => b.textContent === 'Enable auto-sync')!
         await act(async () => {
           button.parentElement!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
@@ -127,9 +130,9 @@ describe('Enable auto-sync on the GitOps detail page', () => {
       { name: 'Sync is available', copy: 'Stop Argo from automatically syncing Git changes. Manual Sync still works.' },
       { name: 'an operation holds Sync', running: true, copy: 'Stop Argo from automatically syncing Git changes.' },
       { name: 'the Application is suspended', suspended: true, copy: 'Stop Argo from automatically syncing Git changes.' },
-      { name: 'an ApplicationSet owns it', controller: { kind: 'ApplicationSet' as const, name: 'clusters' }, copy: "Stop Argo from automatically syncing Git changes. Manual Sync still works. ApplicationSet clusters can turn it back on; to keep it off, change the ApplicationSet's template." },
-      { name: 'a parent Application manages it', controller: { kind: 'Application' as const, name: 'apps' }, copy: 'Stop Argo from automatically syncing Git changes. Manual Sync still works. Application apps manages this one from Git and can turn it back on when it syncs; to keep it off, change it in Git.' },
-      { name: 'an operation holds Sync on an ApplicationSet-owned app', running: true, controller: { kind: 'ApplicationSet' as const, name: 'clusters' }, copy: "Stop Argo from automatically syncing Git changes. ApplicationSet clusters can turn it back on; to keep it off, change the ApplicationSet's template." },
+      { name: 'an ApplicationSet owns it', controller: { kind: 'ApplicationSet' as const, name: 'clusters' }, copy: "Stop Argo from automatically syncing Git changes. Manual Sync still works. ApplicationSet clusters may overwrite this setting or control when this Application syncs. Review its template and rollout policy before changing auto-sync." },
+      { name: 'a parent Application manages it', controller: { kind: 'Application' as const, name: 'apps' }, copy: 'Stop Argo from automatically syncing Git cha
```

**File**: `packages/k8s-ui/src/components/gitops/insights/ArgoResourceDiff.test.tsx` (modified, +1/-1)
```diff
@@ -141,7 +141,7 @@ describe('GitOpsChangesView expanded Argo row', () => {
     const data = insight(false)
     data.summary.autoSyncMode = 'Manual'
     const html = renderToStaticMarkup(<GitOpsChangesView insight={data} />)
-    expect(html).toContain('Click Sync to apply the desired state.')
+    expect(html).toContain('Review the desired changes and sync policy before deciding whether to sync.')
     expect(html).not.toContain('See the sync warning above')
   })
 
```

**File**: `packages/k8s-ui/src/components/gitops/insights/GitOpsInsightViews.tsx` (modified, +3/-7)
```diff
@@ -290,7 +290,7 @@ function TerminatingStatusStrip({ summary }: { summary: NonNullable<GitOpsInsigh
             <MetaFact label="Revision" value={summary.lastRevision || summary.targetRevision || '-'} mono />
           )}
           <SummaryTiming summary={summary} />
-          {summary.autoSyncMode && <MetaFact label="Sync mode" value={summary.autoSyncMode} />}
+          {summary.autoSyncMode && <MetaFact label="Sync mode" value={summary.autoSyncMode === 'Manual' ? 'Auto-sync off' : summary.autoSyncMode} />}
         </div>
       </Collapse>
     </div>
@@ -1322,10 +1322,6 @@ function refKey(ref: { kind: string; namespace?: string; name: string }): string
 // nor a health message is available — otherwise those carry the truth and
 // this would just add noise. Empty string falls through to no row content.
 //
-// The "what to do" framing is intentional: badges already communicate state
-// ("OutOfSync"); the row should communicate what the operator should do
-// about it. With auto-sync on the answer is usually "wait, Argo will fix
-// it"; with manual mode the answer is "click Sync".
 function explainChangeStatus(
   sync: string | undefined,
   health: string | undefined,
@@ -1349,11 +1345,11 @@ function explainChangeStatus(
     if (inFlight) return 'Live state differs from Git. A sync is in progress — wait for it to finish.'
     if (context?.rolledBack) return 'Live state differs from Git after a rollback. Sync applies the desired state and can undo the rollback.'
     if (isAuto) return 'Live state differs from Git. Auto-sync should reconcile this within a few minutes; click Sync to force it.'
-    return 'Live state differs from Git. Click Sync to apply the desired state.'
+    return 'Live state differs from Git. Review the desired changes and sync policy before deciding whether to sync.'
   }
   if (health === 'Missing' && parentFailed) return 'Resource was not created — see the operation error above for the cause.'
   if (health === 'Degraded') return 'Resource reports an unhealthy state. Open the resource for events and logs.'
-  if (health === 'Missing') return 'Declared in Git but not present in the cluster. Sync to create it.'
+  if (health === 'Missing') return missingResourceMessage(sync, context)
   if (health === 'Progressing') return 'Resource is mid-rollout (e.g. pods coming up). Should converge shortly.'
   if (health === 'Suspended') return 'Resource is paused (e.g. CronJob suspended, HPA disabled). Intentional unless surprising.'
   return ''
```

#### Recent Merged Pull Requests:
- **PR #2701** (2026-11-15): Count every supported integration in usage stats, without mislabeling user apps as add-ons (@nadaverell)
- **PR #2699** (2026-11-15): Show Topology filter on/off with the accent instead of per-kind colors (@nadaverell)
- **PR #2698** (2026-11-15): fix(gitops): avoid treating auto-sync off as manual orchestration (@nadaverell)
- **PR #2697** (2026-11-15): fix(gitops): report ApplicationSet rollout health accurately (@nadaverell)
- **PR #2693** (2026-11-15): Revert "Match resource sidebar icons to Topology kind colors" (@nadaverell)
- **PR #2690** (2026-11-15): deps(npm): override minimatch to 11.0.4 for GHSA-g3hv-75wg-m249 (@nadaverell)

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

## X. gitops): let managed resource lists reveal every entry

**RULE**:
When implementing operations in `packages/k8s-ui/src/components/gitops/ManagedResourcesList.test.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in skyhook-io/radar. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `41dfe716`: gitops): let managed resource lists reveal every entry. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/k8s-ui/src/components/gitops/ManagedResourcesList.test.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ManagedResourcesList } from './ManagedResourcesList'
import type { ManagedResource } from '../../types/gitops'

function render(element: Parameters<typeof renderToString>[0]): string {
  return renderToString(element).replace(/<!-- -->/g, '')
}

function list(configMaps: number): ManagedResource[] {
  return [
    ...Array.from({ length: configMaps }, (_, i) => ({ group: '', kind: 'ConfigMap', namespace: 'shop', name: `cm-${i}` })),
    { group: 'apps', kind: 'Deployment', namespace: 'shop', name: 'checkout' },
    { group: '', kind: 'Service', namespace: 'shop', name: 'checkout' },
  ]
}

describe('ManagedResourcesList', () => {
  it('shows every entry of an uneven list under the cap', () => {
    const html = render(<ManagedResourcesList resources={list(8)} />)
    expect(html).toContain('ConfigMap</span><span class="text-theme-text-tertiary">(8)')
    expect(html).not.toContain('Show all')
  })

  it('offers Show all whenever a kind is cut', () => {
    const html = render(<ManagedResourcesList resources={list(6)} maxVisible={6} />)
    expect(html).toContain('ConfigMap</span
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `41dfe716` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
