> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source**: github ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Source Version**: `0173895f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T09:14:37.119Z  
> **Learning ID**: `learn-github-skyhook-io-radar`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): skyhook-io/radar

> **Canonical Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T09:13:00.123Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3908 stars

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
		"no context configured",
		"no current context",
		"current-context is not set",
		"context was not found for specified context",
		"no configuration has been provided",
		"failed to build kubeconfig",
		"no valid kubeconfig files found",
		"no usable context found",
		"no contexts found",
		"k8s config not initialized",
		"kubernetes client is not initialized",
		"kubernetes discovery client is not initialized",
		"failed to load kubeconfig",
		"kubeconfig source for context",
		"selected context not found",
		"selected context client setup failed",
		"no auth provider found for name",
	}
	for _, marker := range configMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func isTLSCertificateMessage(lower string) bool {
	return strings.Contains(lower, "x509:") ||
		strings.Contains(lower, "certificate signed by unknown authority") ||
		strings.Contains(lower, "certificate is valid
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
	memoryLimit    bool
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
	best.memoryLimit = containerHasMemoryLimit(pod, best.container)
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
	if l.lastReason != "OOMKilled" || l.init || l.sidecar {
		return nil
	}
	return []corev1.ContainerStatus{l.status}
}

// containerRestartsAlways reports whether the kubelet restarts this regular
// container after every exit: its own restartPolicy when set (per-container
// policies, Kubernetes 1.34+), else the pod's. OnFailure and Never containers
// (Job workers) retry or stop by design and are not restart loops.
func containerRestartsAlways(pod *corev1.Pod, name string) bool {
	policy := corev1.ContainerRestartPolicy(pod.Spec.RestartPolicy)
	for i := range pod.Spec.Containers {
		if c := &pod.Spec.Containers[i]; c.Name == name && c.RestartPolicy != nil {
			policy = *c.RestartPolicy
		}
	}
	return policy == "" || policy == corev1.ContainerRestartPolicyAlways
}

func isNativeSidecarName(pod *corev1.Pod, name string) bool {
	for _, c := range pod.Spec.InitContainers {
		if c.Name == name {
			return isRestartableInitContainer(c)
		}
	}
	return false
}

func containerRestartLoop(cs *corev1.ContainerStatus, now time.Time) (restartLoop, bool) {
	if cs.RestartCount < restartLoopMinRestarts {
		return restartLoop{}, false
	}
	// The current termination is the newest one when present; the kubelet
	// only moves it to LastTerminationState once the next run starts.
	term := cs.State.Terminated
	if term == nil {
		term = cs.LastTerminationState.Terminated
	}
	if term == nil || term.FinishedAt.IsZero() {
		return restartLoop{}, false
	}
	finished := term.FinishedAt.Time
	if now.Sub(finished) > restartLoopWindow {
		return restartLoop{}, false
	}
	// A run that lasted longer than the window was not part of a loop: a
	// container that served for days and restarted once
```

### Core Architecture Module: `internal/search/score.go`
```
package search

import (
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
		best, site, snippet, ok := scoreToken(tok, c)
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

### Core Architecture Module: `packages/k8s-ui/src/components/logs/LogCore.tsx`
```
import { useRef, useCallback, useState, useMemo, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { Play, Square, Download, FileDown, Search, X, Terminal, RotateCcw, ChevronUp, ChevronDown, ChevronRight, CaseSensitive, Regex, WrapText, Clock, Copy, Trash2, Filter, EyeOff, Highlighter, Braces, Palette, ListCollapse, Sun, Moon } from 'lucide-react'
import type { LogEntry, LogLevel } from './useLogBuffer'
import { useLogSearch, type LogSearchMode } from './useLogSearch'
import { StructuredLogLine } from './StructuredLogLine'
import { Tooltip } from '../ui/Tooltip'
import { Input } from '../ui/Input'
import { showApiError, showApiSuccess } from '../ui/Toast'
import {
  formatLogTimestamp,
  highlightSearchMatches,
  stripAnsi,
  ansiToHtml,
  type TimestampFormat,
  TIMESTAMP_FORMAT_LABELS,
} from '../../utils/log-format'
import { getLogPalette, getLogLevelColor, type LogPalette } from './log-palette'
import { associateContinuations, groupContinuations, type LogGroup } from '../../utils/log-level'
import { copyText } from '../../utils/clipboard'
import { useAnimatedUnmount } from '../../hooks/useAnimatedUnmount'
import { TRANSITION_MENU, overlayExitMs, overlayTransitionStyle } from '../../utils/animation'
import {
  LOG_EXPORT_FORMAT_LABELS,
  LOG_EXPORT_FORMATS,
  previewLogExport,
  serializeLogEntries,
  type LogExportFormat,
  type LogExportPayload,
} from '../../utils/log-export'

/** Retained for consumers that already import it; the export module owns the definition. */
export type DownloadFormat = LogExportFormat

/**
 * `toolbarExtra` may be a plain ReactNode, or a function that receives the
 * current dark/light context so wrappers can produce palette-matched controls.
 */
export type ToolbarExtraRenderer =
  | ReactNode
  | ((ctx: { isDark: boolean; palette: LogPalette }) => ReactNode)

interface LogCoreProps {
  entries: LogEntry[]
  isFollowing?: boolean
  onFollowingChange?: (following: boolean) => void
  pendingLineCount?: number
  retainedLineCount?: number
  missingLineCount?: number
  getRetainedEntries?: () => LogEntry[]
  /**
   * The unfiltered buffer, when the host filters `entries` before passing them
   * (the workload viewer's pod picker), so that export's "All" describes the
   * real buffer rather than the slice currently on screen.
   */
  allEntries?: LogEntry[]
  isLoading: boolean
  isStreaming: boolean
  onStartStream?: () => void
  onStopStream: () => void
  onRefresh: () => void
  /** Receives a finished payload — the viewer owns serialization so copy and download cannot diverge. */
  onDownload: (payload: LogExportPayload) => void
  onClear?: () => void
  toolbarExtra?: ToolbarExtraRenderer
  showPodName?: boolean
  emptyMessage?: ReactNode
  sourceUnavailable?: boolean
  emptyCommand?: string | null
  errorMessage?: string | null
  /**
   * Hard override for the viewer palette. When set, the viewer stays pinned to
   * that mode and hides the in-viewer dark/light toggle. When undefined,
   * the viewer manages its own palette via localStorage and the Sun/Moon button.
   */
  forceDark?: boolean
  /**
   * Palette to use when the user hasn't picked one with the Sun/Moon toggle
   * (e.g. the host app's theme). Unlike `forceDark`, the toggle stays visible.
   * Defaults to dark.
   */
  defaultDark?: boolean
}

interface LevelOption {
  level: LogLevel
  label: string
  /** What the chip's lines are called in its tooltip */
  noun: string
}

const LEVEL_OPTIONS: LevelOption[] = [
  { level: 'error', label: 'ERR', noun: 'error logs' },
  { level: 'warn', label: 'WARN', noun: 'warning logs' },
  { level: 'info', label: 'INFO', noun: 'info logs' },
  { level: 'debug', label: 'DBG', noun: 'debug logs' },
  { level: 'unknown', label: 'OTHER', noun: 'lines with no level' },
]

function getLevelActiveColor(level: LogLevel, palette: LogPalette): string {
  switch (level) {
    case 'error': return palette.levelActiveError
    case 'warn': return palette.levelActiveWarn
    case 'info': return palette.levelActiveInfo
    case 'debug': return palette.levelActiveDebug
    default: return palette.levelActiveOther
  }
}

const TIMESTAMP_FORMAT_ORDER: TimestampFormat[] = [
  'time-local', 'time-utc', 'iso-local', 'iso-utc', 'relative', 'epoch',
]

export type StructuredMode = 'compact' | 'expanded' | 'raw'

const STRUCTURED_MODE_ORDER: StructuredMode[] = ['compact', 'expanded', 'raw']

const STRUCTURED_MODE_LABELS: Record<StructuredMode, string> = {
  compact: 'Compact',
  expanded: 'Expanded',
  raw: 'Raw',
}

const STRUCTURED_MODE_DESCRIPTIONS: Record<StructuredMode, string> = {
  compact: 'Summary line with field count',
  expanded: 'All fields shown as a tree',
  raw: 'Original log line, unparsed',
}

const EMPTY_STATE_CLASS = 'flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center'

const TIMESTAMP_FORMAT_SHORT_LABELS: Record<TimestampFormat, string> = {
  'time-local': 'Local time',
  'time-utc': 'UTC time',
  'iso-local': 'Full date',
  'iso-utc': 'UTC date',
  'relative': 'Relative',
  'epoch': 'Unix time',
}

const TIP_DELAY = 150

export function LogCore({
  entries,
  isFollowing: controlledFollowing,
  onFollowingChange,
  pendingLineCount = 0,
  retainedLineCount,
  missingLineCount = 0,
  getRetainedEntries,
  allEntries,
  isLoading,
  isStreaming,
  onStartStream,
  onStopStream,
  onRefresh,
  onDownload,
  onClear,
  toolbarExtra,
  showPodName = false,
  emptyMessage = 'No logs available',
  sourceUnavailable = false,
  emptyCommand,
  errorMessage,
  forceDark,
  defaultDark = true,
}: LogCoreProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [localFollowing, setLocalFollowing] = useState(true)
  const isFollowing = controlledFollowing ?? localFollowing
  const followingRef = useRef(isFollowing)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const resumeAtBottom = useRef(false)
  const scrollbarDragging = useRef(false)
  const scrollPosition = useRef<number | null>(null)
  const setFollowing = useCallback((following: boolean) => {
    followingRef.current = following
    resumeAtBottom.current = false
    setLocalFollowing(following)
    onFollowingChange?.(following)
  }, [onFollowingChange])
  const touchY = useRef<number | null>(null)
  const pauseFollowing = useCallback(() => setFollowing(false), [setFollowing])
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = document.getSelection()
      if (!followingRef.current || !selection || selection.isCollapsed || !selection.anchorNode || !scrollerRef.current?.contains(selection.anchorNode)) return
      pauseFollowing()
      const anchor = selection.anchorNode
      const element = anchor instanceof Element ? anchor : anchor.parentElement
      element?.closest('[data-index]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [pauseFollowing])
  const themeLocked = typeof forceDark === 'boolean'
  // Seed isDark: forceDark prop wins; else localStorage['radar-logs-dark'];
  // else defaultDark (the host app's theme, dark if not given). See
  // log-palette.ts for why the viewer is palette-driven
  // instead of theme-token-driven.
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof forceDark === 'boolean') return forceDark
    try {
      const v = localStorage.getItem('radar-logs-dark')
      if (v === 'false') return false
      if (v === 'true') return true
    } catch {}
    return defaultDark
  })
  useEffect(() => {
    if (typeof forceDark === 'boolean') {
      setIsDark(forceDark)
    }
  }, [forceDark])
  // Re-resolve whenever the host's hint changes, including when a forceDark pin
  // is lifted: the user's saved pick wins, otherwise the host default.
  useEffect(() => {
    if (typeof forceDark === 'boolean') return
    try {
      const v = localStorage.getItem('radar-logs-dark')
      if (v === 'true' || v === 'false') {
        setIsDark(v === 'true')
        return
      }
    } catch {}
    setIsDark(defaultDark)
  }, [defaultDark, forceDark])
  const palette = useMemo(() => getLogPalette(isDark), [isDark])
  const toggleDark = useCallback(() => {
    if (themeLocked) return
    setIsDark(prev => {
      const next = !prev
      try { localStorage.setItem('radar-logs-dark', String(next)) } catch {}
      return next
    })
  }, [themeLocked])
  const [wordWrap, setWordWrap] = useState(() => {
    try { return localStorage.getItem('radar-logs-wrap') !== 'false' } catch { return true }
  })
  const [showTimestamps, setShowTimestamps] = useState(() => {
    try { return localStorage.getItem('radar-logs-timestamps') !== 'false' } catch { return true }
  })
  const [tsFormat, setTsFormat] = useState<TimestampFormat>(() => {
    try {
      const v = localStorage.getItem('radar-logs-ts-format') as TimestampFormat | null
      return v && TIMESTAMP_FORMAT_ORDER.includes(v) ? v : 'time-local'
    } catch { return 'time-local' }
  })
  const [ansiEnabled, setAnsiEnabled] = useState(() => {
    try { return localStorage.getItem('radar-logs-ansi') !== 'false' } catch { return true }
  })
  const [collapseStacks, setCollapseStacks] = useState(() => {
    try { return localStorage.getItem('radar-logs-collapse-stacks') !== 'false' } catch { return true }
  })
  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(
    new Set(['error', 'warn', 'info', 'debug', 'unknown'])
  )
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const downloadMenu = useAnimatedUnmount(showDownloadMenu, overlayExitMs('menu'))
  const [exportScope, setExportScope] = useState<'visible' | 'all'>('visible')
  const [exportFormat, setExportFormat] = useState<LogExportFormat>(() => {
    try {
      const v = localStorage.getItem('radar-logs-export-format') as LogExport
```

### Core Architecture Module: `packages/k8s-ui/src/components/resources/renderers/AWSMachineRenderer.tsx`
```
import { Cpu, Network, Cloud } from 'lucide-react'
import { clsx } from 'clsx'
import { Section, PropertyList, Property, ConditionsSection, AlertBanner, useOperationalIssuesShown} from '../../ui/drawer-components'
import { getCAPIConditions } from '../resource-utils-capi'
import { getAWSMachineStatus, getAWSMachineInstanceType, getAWSMachineInstanceState, getAWSMachineInstanceID } from '../resource-utils-aws-capi'

interface Props {
  data: any
  onNavigate?: (ref: { kind: string; namespace: string; name: string; group?: string }) => void
}

export function AWSMachineRenderer({ data }: Props) {
  const spec = data.spec || {}
  const status = data.status || {}
  const conditions = getCAPIConditions(data)

  const machineStatus = getAWSMachineStatus(data)
  const isFailed = machineStatus.level === 'unhealthy'
  const operationalIssuesShown = useOperationalIssuesShown()
  const readyCond = conditions.find((c: any) => c.type === 'Ready')

  const instanceState = getAWSMachineInstanceState(data)
  const addresses = status.addresses || []

  return (
    <>
      {isFailed && !operationalIssuesShown && (
        <AlertBanner
          variant="error"
          title="AWS Machine Not Ready"
          message={readyCond?.message || 'AWSMachine is not ready.'}
        />
      )}

      <Section title="Instance" icon={Cloud}>
        <PropertyList>
          <Property label="Instance Type" value={getAWSMachineInstanceType(data)} />
          <Property label="Instance ID" value={
            <span className="font-mono text-[11px]">{getAWSMachineInstanceID(data)}</span>
          } />
          <Property label="State" value={
            <span className={clsx('badge badge-sm', instanceState === 'running'
              ? 'status-healthy'
              : instanceState === 'pending' || instanceState === 'stopping' || instanceState === 'stopped'
              ? 'status-degraded'
              : instanceState === 'terminated' || instanceState === 'shutting-down'
              ? 'status-unhealthy'
              : 'status-neutral'
            )}>{instanceState}</span>
          } />
          {spec.providerID && spec.providerID !== '-' && (
            <Property label="Provider ID" value={
              <span className="font-mono text-[10px] break-all">{spec.providerID}</span>
            } />
          )}
        </PropertyList>
      </Section>

      <Section title="Configuration" icon={Cpu}>
        <PropertyList>
          {spec.iamInstanceProfile && <Property label="IAM Profile" value={spec.iamInstanceProfile} />}
          {spec.sshKeyName && <Property label="SSH Key" value={spec.sshKeyName} />}
          {spec.subnet?.id && (
            <Property label="Subnet" value={<span className="font-mono text-[11px]">{spec.subnet.id}</span>} />
          )}
          {spec.cloudInit?.secureSecretsBackend && (
            <Property label="Secrets Backend" value={spec.cloudInit.secureSecretsBackend} />
          )}
        </PropertyList>
      </Section>

      {/* Addresses */}
      {addresses.length > 0 && (
        <Section title="Addresses" icon={Network}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-theme-text-tertiary">
                <th className="text-left font-medium py-1">Type</th>
                <th className="text-left font-medium py-1">Address</th>
              </tr>
            </thead>
            <tbody>
              {addresses.map((addr: any, i: number) => (
                <tr key={i} className="border-t border-theme-border">
                  <td className="py-1 text-theme-text-secondary">{addr.type}</td>
                  <td className="py-1 text-theme-text-secondary font-mono">{addr.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <ConditionsSection conditions={conditions} />
    </>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2236** (2026-10-25): **Live Traffic Source Selection**
  *Symptoms*: ## Describe the bug and snapshot  Try the radar both v1.16 and v1.17 and face below issues. I have istio and hubble for my live traffic. If I select to Istio, then I could not choose back to hubble anymore.  ##   <img width="342" height="129" alt="Image" src="https://github.com/user-attachments/assets/a90bbf4c-d2c2-4814-8361-6dfb0e09e068" /> <img width="267" height="50" alt="Image" src="https://github.com/user-attachments/assets/36bbb5ef-63f3-4985-bb8b-ec2651ea569f" /> <img width="116" height="46" alt="Image" src="https://github.com/user-attachments/assets/cead954c-f945-46d0-bb47-47586dc16818" />  Can you guide how to do the selection. If this is a bug, can you help fix it.  Thanks a lot! 

- **Issue #2158** (2026-10-21): **While streaming a pod's logs, Radar stops receiving lines and prints `failed to create fsnotify watcher: too many open files` into the log pane / terminal**
  *Symptoms*: ## Describe the bug  While streaming a pod's logs, Radar stops receiving lines and prints `failed to create fsnotify watcher: too many open files` into the log pane / terminal.  The error is emitted by the Radar client process, not by the workload: the pod's own container logs are ECS JSON and contain no occurrence of `fsnotify` (checked across the last 5,000 lines).  It is not environmental resource exhaustion: at the moment of the failure Radar holds ~20 file descriptors and **zero** inotify file descriptors, against very high limits (details below), and creating inotify watchers succeeds from the same shell.  It has recurred across separate Radar process starts (i.e. it is not a one-off after a very long session).  ## To reproduce  1. On WSL2 (Ubuntu), with a kubeconfig pointing at a k3s cluster, start Radar:    `radar -prometheus-url https://<redacted>/api/prom -prometheus-header-from-env Authorization=RADAR_PROMETHEUS_AUTHORIZATION`    (the working directory is a Docker Desktop bind mount, i.e. a 9p filesystem) 2. Open a workload's **Logs** pane and stream a pod's logs (e.g. a Deployment's pod). 3. Log lines arrive normally for a while, then the pane stops updating and    `failed to create fsnotify watcher: too many open files` is printed.  ## Expected behavior  The log stream keeps following the pod without emitting a filesystem-watcher error, and opening/switching log streams does not consume or leak inotify watchers.  ## Screenshots  <!-- optional: the log pane showin

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

### Incident Patch 1: `8c0cd526` (2026-10-22)
**Commit Message**: get_runtime_versions: classify Node fixes by major, Rust as one line

ClassifyFix took every fixed version minus its last component as its
release line. Node.js lines are majors with semver minors, so with
fixed_in 22.23.4,24.22.1,26.12.1 a declared 22.12.0, 24.11.0 or 26.3.0
came back branch_not_listed instead of declared_below_fix. Rust has a
single release train, so 1.80.0 against a 1.82.0 fix had the same gap.

Release lines are now per runtime: Node uses the major, Rust one line,
every other curated runtime is unchanged. Semver prereleases such as
22.23.4-rc.1 parse and sit below their release; a prerelease of a later
Node minor or Rust release is unparsed, since it may predate the fix.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/mcp.md` (modified, +1/-1)
```diff
@@ -567,7 +567,7 @@ For `get_cost` and `get_rightsizing`, see [Cost and rightsizing evidence limits]
 | `get_workload_logs` | Aggregated logs from all pods of a workload (Deployment, StatefulSet, DaemonSet, Job, Argo Workflow). Without `grep`, auto-filters for diagnostic relevance; with `grep`, returns only matching timestamp-prefixed lines. | `kind` (required), `namespace` (required), `name` (required), `container` (optional), `tail_lines` (optional, default 100 per pod), `grep` (optional) |
 | `get_cluster_audit` | `missingInputs`, when present, names unavailable inputs in the scan; zero findings do not establish that all checks passed. Static config posture — best-practice findings (Security / Reliability / Efficiency) with remediation. INDEPENDENT of operational health. Finding severity and the explicit `summary.critical`/`high`/`medium`/`low` counts are posture remediation priority; current built-in checks emit `high` or `medium`. For "what's broken right now?" use `issues`. | `namespace` (optional), `category` (optional), `severity` (optional: `critical`, `high`, `medium`, or `low`) |
 | `get_cluster_upgrade_readiness` | Upgrade impact analysis for a target Kubernetes minor — the evidenced check catalog (version skew, removed/deprecated API usage across live manifests / Helm sources / API-server metrics, node runtime + cgroup evidence, drain feasibility, webhook readiness, release-specific config checks). The verdict is not a readiness guarantee: `unknown` checks had incomplete evidence, `coverage` states what the caller's RBAC could actually inspect, and `no_access` returns no verdict at all. Tier 1 is one row per check; `check=<id>` expands into findings with evidence + remediation, paged 25 at a time (`offset` + `scan_id` bind pages to one scan snapshot). Results are memoized ~60s per caller; `refresh=true` re-scans after a fix. Fix findings at the source `evidence.source` names — live objects via `patch_resource`/`apply_resource`, Helm findings in the chart, GitOps-managed resources in Git. | `target` (optional, default next minor), `check` (optional), `level` (optional: `blocker`, `warning`, `review`), `offset` (optional), `scan_id` (required when `offset` > 0), `refresh` (optional) |
-| `get_runtime_versions` | Which running workloads use which runtime version, for runtime CVEs (PHP2Shell and the like). For each image a visible Pod runs, Radar reads the image config for the digest the Pod reports and the node's platform (manifest and config only, never layers) and returns the versions it declares: curated keys Docker official images set and images built `FROM` them inherit (`PHP_VERSION`, `NODE_VERSION`, `PYTHON_VERSION`, `GOLANG_VERSION`, `RUBY_VERSION`, `JAVA_VERSION`, `HTTPD_VERSION`, `NGINX_VERSION`, `TOMCAT_VERSION`, `PG_VERSION`, `REDIS_VERSION`, `MONGO_VERSION`, `MARIADB_VERSION`, `MYSQL_VERSION`, `RUST_VERSION`) plus the OCI `version` and `base.name` labels; no other env value is ever read. A declared version is what the image says, not proof of the binary, and runtimes installed from distro packages declare nothing here (Trivy reports cover those; use `search`). `fixed_in` classifies each version against the first fix on its branch (`8.3.36` covers 8.3.x, `17.6` covers 17.x): `declared_below_fix`, `declared_at_or_above_fix`, `branch_not_listed`, `unparsed`. An image `status` other than `ok` (`no_declaration`, `auth_required`, `not_found`, `rate_limited`, `blocked`, `error`, `not_checked`) means unknown, not absent. `resolvedFrom: spec` or `tag` means the kubelet reported no registry digest, so the image named in the Pod spec is shown without a fix verdict; `platformAssumed` means the node's platform wasn't readable and linux/amd64 was used, so no fix verdict is emitted. Missing runtime declarations stay visible as `no_declaration`, counted as unknown; unsupported or distro version formats remain `unparsed`. Only Pods the caller may list are read. Each image is looked up with its Pods' own pull secrets one at a time, then anonymously; node registry credentials are not used, so images pulled only with node identity may remain unreadable; Radar's own registry credentials are used only when Radar runs locally with auth off. A result read with a credential is cached for that credential only, an anonymous one for everyone. Credentialed lookups require HTTPS, including token exchanges and redirects. The call returns within a 40-second lookup budget. Registry use is bounded: at most 4 lookups run at once across callers and 200 attempts per call, 429s are not retried and pause that registry for 5 minutes, configs over 1 MiB are refused, and only the registry a Pod names may sit on a private or (outside the cluster) loopback address; link-local addresses, and redirects or token endpoints elsewhere on internal addresses, are refused. Behind an HTTP proxy, HTTPS goes through a CONNECT tunnel to the checked address; requests that can't be pinned that way are refused when Radar runs in-cluster. `fixe
```

**File**: `internal/images/runtime_inventory.go` (modified, +1/-1)
```diff
@@ -760,7 +760,7 @@ func shapeInventory(items []*work, results []configResult, opts InventoryOptions
 				// A tag resolved now may not be what runs: report what it
 				// declares, but don't call the workload fixed or not.
 				if runtime != "" && len(opts.FixedIn) > 0 && d.Runtime != "image" && w.resolvedFrom == "digest" && !w.platformAssumed {
-					d.Fix, d.FixedIn = ClassifyFix(d.Version, opts.FixedIn)
+					d.Fix, d.FixedIn = ClassifyFix(d.Runtime, d.Version, opts.FixedIn)
 					if d.Fix == FixBelow {
 						rank = 0
 					}
```

**File**: `internal/images/runtime_inventory_test.go` (modified, +26/-0)
```diff
@@ -169,6 +169,32 @@ func TestInventory_GroupsByRunningDigestAndClassifies(t *testing.T) {
 	}
 }
 
+func TestInventory_ClassifiesNodeByMajorLine(t *testing.T) {
+	const (
+		node22 = "docker.io/library/node@sha256:2222222222222222222222222222222222222222222222222222222222222222"
+		node25 = "docker.io/library/node@sha256:2525252525252525252525252525252525252525252525252525252525252525"
+	)
+	f := &fakeLookup{configs: map[string]*v1.ConfigFile{
+		refKey(t, node22): {Config: v1.Config{Env: []string{"NODE_VERSION=22.12.0"}}},
+		refKey(t, node25): {Config: v1.Config{Env: []string{"NODE_VERSION=25.1.0"}}},
+	}}
+	src := podSource(
+		runningPod("shop", "eol-1", "x86-node", "eol", map[string][2]string{"node": {"node:25", node25}}),
+		runningPod("shop", "api-1", "x86-node", "api", map[string][2]string{"node": {"node:22", node22}}),
+	)
+	got := fakeInventory(f).Inventory(context.Background(), src, InventoryOptions{Runtime: "node", FixedIn: []string{"22.23.4", "24.22.1", "26.12.1"}})
+
+	if got.Totals.BelowFix != 1 || len(got.Images) != 2 {
+		t.Fatalf("totals = %+v, images = %+v", got.Totals, got.Images)
+	}
+	if d := got.Images[0].Declared; len(d) != 1 || d[0].Version != "22.12.0" || d[0].Fix != FixBelow || d[0].FixedIn != "22.23.4" {
+		t.Fatalf("first image must be the one below its major's fix: %+v", d)
+	}
+	if d := got.Images[1].Declared; len(d) != 1 || d[0].Version != "25.1.0" || d[0].Fix != FixBranchUnknown {
+		t.Fatalf("an unfixed end-of-life major stays unlisted: %+v", d)
+	}
+}
+
 func TestInventory_SpecDigestIsNotProofOfWhatRuns(t *testing.T) {
 	f := &fakeLookup{configs: map[string]*v1.ConfigFile{refKey(t, phpDigest): phpConfig("8.3.36")}}
 	got := fakeInventory(f).Inventory(context.Background(), podSource(
```

**File**: `internal/images/runtimes.go` (modified, +27/-11)
```diff
@@ -105,13 +105,20 @@ const (
 var (
 	leadingVersion = regexp.MustCompile(`(?i)^(?:v|jdk-)?(\d+(?:\.\d+)*)(.*)$`)
 	// prerelease marks a version that comes before its numeric release
-	// (8.3.36RC1, 8.3.36-dev, 8.3.36~rc1, 21.0.5-ea+7), so it lacks that
-	// release's fix.
-	prerelease = regexp.MustCompile(`(?i)^[-~._]?(rc|alpha|beta|dev|pre|ea|nightly|snapshot|canary|internal|a|b)\d*(\+[0-9A-Za-z.-]+)?$`)
+	// (8.3.36RC1, 8.3.36-dev, 8.3.36~rc1, 21.0.5-ea+7, 22.23.4-rc.1), so it
+	// lacks that release's fix.
+	prerelease = regexp.MustCompile(`(?i)^[-~._]?(rc|alpha|beta|dev|pre|ea|nightly|snapshot|canary|internal|a|b)(\.?\d+)?(\+[0-9A-Za-z.-]+)?$`)
 	// Distro revisions require package-specific comparison and backport data.
 	finalSuffix = regexp.MustCompile(`^(\+[0-9A-Za-z.-]+)?$`)
 )
 
+// releaseLineLength sets how many leading components of a fixed version name
+// its branch, for runtimes whose release lines aren't "all but the last
+// component". A Node.js line is a major with semver minors, so 22.23.4 fixes
+// 22.x; Rust ships one stable train with no maintained older lines, so 1.82.0
+// fixes every earlier version.
+var releaseLineLength = map[string]int{"node": 1, "rust": 0}
+
 func ValidateRuntimeQuery(runtime string, fixedIn []string) error {
 	if runtime == "image" && len(fixedIn) > 0 {
 		return fmt.Errorf("fixed_in requires a runtime such as php or node; image labels are not runtime fix evidence")
@@ -139,14 +146,15 @@ func ValidateRuntimeQuery(runtime string, fixedIn []string) error {
 	return nil
 }
 
-// ClassifyFix compares a declared version against fixed releases. A fixed
-// version's branch is everything but its last component (8.3.36 → 8.3,
-// 17.6 → 17; a one-part fix is its own branch); a declared version is
-// compared with the earliest fix on the longest branch it falls in. Only
-// upstream versions with up to three numeric components, known prereleases
-// and build metadata are supported; distro revisions stay unparsed.
+// ClassifyFix compares a declared version of runtime against fixed releases.
+// A fixed version's branch is everything but its last component (8.3.36 →
+// 8.3, 17.6 → 17; a one-part fix is its own branch) unless releaseLineLength
+// says otherwise for the runtime; a declared version is compared with the
+// earliest fix on the longest branch it falls in. Only upstream versions with
+// up to three numeric components, known prereleases and build metadata are
+// supported; distro revisions stay unparsed.
 // It returns the classification and the fixed version used.
-func ClassifyFix(version string, fixedIn []string) (string, string) {
+func ClassifyFix(runtime, version string, fixedIn []string) (string, string) {
 	got, rest := parseVersionRest(version)
 	if got == nil || len(got) > 3 || (!finalSuffix.MatchString(rest) && !prerelease.MatchString(rest)) {
 		return FixUnparsed, ""
@@ -160,7 +168,11 @@ func ClassifyFix(version string, fixedIn []string) (string, string) {
 			return FixUnparsed, ""
 		}
 		// A one-part fix ("17") covers its own major.
-		branch := fixed[:max(len(fixed)-1, 1)]
+		line := max(len(fixed)-1, 1)
+		if n, ok := releaseLineLength[runtime]; ok {
+			line = n
+		}
+		branch := fixed[:line]
 		if len(got) < len(branch) || !hasPrefix(got, branch) {
 			continue
 		}
@@ -182,6 +194,10 @@ func ClassifyFix(version string, fixedIn []string) (string, string) {
 		// The fixed version with a suffix this can't read: it may be a
 		// pre-release build without the fix.
 		return FixUnparsed, bestRaw
+	case prerelease.MatchString(rest) && !hasPrefix(got, best[:max(len(best)-1, 1)]):
+		// Past the fix's own patch line (a later Node minor, a later Rust
+		// release), a prerelease may have been cut before the fix landed.
+		return FixUnparsed, bestRaw
 	}
 	return FixAtOrAbove, bestRaw
 }
```

**File**: `internal/images/runtimes_test.go` (modified, +47/-1)
```diff
@@ -105,9 +105,55 @@ func TestClassifyFix(t *testing.T) {
 		{"8.3.38", []string{"8.3.36", "8.3.40"}, FixAtOrAbove, "8.3.36"},
 	}
 	for _, tc := range cases {
-		got, against := ClassifyFix(tc.version, tc.fixedIn)
+		got, against := ClassifyFix("php", tc.version, tc.fixedIn)
 		if got != tc.want || against != tc.against {
 			t.Errorf("ClassifyFix(%q, %v) = %s against %q, want %s against %q", tc.version, tc.fixedIn, got, against, tc.want, tc.against)
 		}
 	}
 }
+
+func TestClassifyFix_ReleaseLines(t *testing.T) {
+	node := []string{"22.23.4", "24.22.1", "26.12.1"}
+	cases := []struct {
+		runtime string
+		version string
+		fixedIn []string
+		want    string
+		against string
+	}{
+		{"node", "22.12.0", node, FixBelow, "22.23.4"},
+		{"node", "24.11.0", node, FixBelow, "24.22.1"},
+		{"node", "26.3.0", node, FixBelow, "26.12.1"},
+		{"node", "22.23.3", node, FixBelow, "22.23.4"},
+		{"node", "22.23.4-rc.1", node, FixBelow, "22.23.4"},
+		{"node", "v22.12.0", node, FixBelow, "22.23.4"},
+		{"node", "22.23.4", node, FixAtOrAbove, "22.23.4"},
+		{"node", "22.24.0", node, FixAtOrAbove, "22.23.4"},
+		{"node", "22.23.5-rc.1", node, FixAtOrAbove, "22.23.4"},
+		{"node", "22.24.0-rc.1", node, FixUnparsed, "22.23.4"},
+		{"node", "26.12.1", node, FixAtOrAbove, "26.12.1"},
+		{"node", "20.18.0", node, FixBranchUnknown, ""},
+		{"node", "25.1.0", node, FixBranchUnknown, ""},
+		{"node", "22", node, FixUnparsed, "22.23.4"},
+		{"rust", "1.80.0", []string{"1.82.0"}, FixBelow, "1.82.0"},
+		{"rust", "1.82.0-beta.3", []string{"1.82.0"}, FixBelow, "1.82.0"},
+		{"rust", "1.82.0", []string{"1.82.0"}, FixAtOrAbove, "1.82.0"},
+		{"rust", "1.83.1", []string{"1.82.0"}, FixAtOrAbove, "1.82.0"},
+		{"rust", "1.83.0-beta.1", []string{"1.82.0"}, FixUnparsed, "1.82.0"},
+		{"rust", "1.83.0-nightly", []string{"1.82.0"}, FixUnparsed, "1.82.0"},
+		{"rust", "1.77.1", []string{"1.78.0", "1.77.2"}, FixBelow, "1.77.2"},
+		{"rust", "1.77.2", []string{"1.78.0", "1.77.2"}, FixAtOrAbove, "1.77.2"},
+		// Every other runtime keeps all-but-last-component branches.
+		{"python", "3.12.4", []string{"3.12.7", "3.13.1"}, FixBelow, "3.12.7"},
+		{"python", "3.11.9", []string{"3.12.7", "3.13.1"}, FixBranchUnknown, ""},
+		{"go", "1.22.5", []string{"1.23.4"}, FixBranchUnknown, ""},
+		{"php", "8.3.36-rc.1", []string{"8.3.36"}, FixBelow, "8.3.36"},
+		{"postgres", "16.4", []string{"17.6"}, FixBranchUnknown, ""},
+	}
+	for _, tc := range cases {
+		got, against := ClassifyFix(tc.runtime, tc.version, tc.fixedIn)
+		if got != tc.want || against != tc.against {
+			t.Errorf("ClassifyFix(%q, %q, %v) = %s against %q, want %s against %q", tc.runtime, tc.version, tc.fixedIn, got, against, tc.want, tc.against)
+		}
+	}
+}
```

**File**: `internal/mcp/tools_runtimes.go` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ import (
 type runtimeVersionsInput struct {
 	Namespace string `json:"namespace,omitempty" jsonschema:"limit to one namespace; omit for every namespace you can list Pods in"`
 	Runtime   string `json:"runtime,omitempty" jsonschema:"keep images declaring this runtime (php, node, python, go, ruby, java, nginx, postgres, …) plus unreadable ones"`
-	FixedIn   string `json:"fixed_in,omitempty" jsonschema:"first fixed release per branch, comma-separated, e.g. 8.2.35,8.3.36"`
+	FixedIn   string `json:"fixed_in,omitempty" jsonschema:"first fix per branch (node: per major), comma-separated, e.g. 8.2.35,8.3.36"`
 	Limit     int    `json:"limit,omitempty" jsonschema:"max images (default 50, max 200); below-fix first"`
 }
 
```

---

### Incident Patch 2: `d5f37ac9` (2026-10-25)
**Commit Message**: fix(traffic): keep source picker available when connection fails

Keep traffic source switching available after connection failures, alongside retry.

**File**: `web/src/components/traffic/TrafficSourcePill.test.tsx` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+// @vitest-environment jsdom
+import { act, type ComponentProps } from 'react'
+import { createRoot, type Root } from 'react-dom/client'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { TrafficSourcePill } from './TrafficSourcePill'
+
+Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
+
+type Props = ComponentProps<typeof TrafficSourcePill>
+
+const props = (overrides: Partial<Props>): Props => ({
+  sources: ['hubble', 'istio'],
+  active: 'istio',
+  connection: 'connected',
+  onSwitch: vi.fn(),
+  onRetry: vi.fn(),
+  ...overrides,
+})
+
+let container: HTMLDivElement
+let root: Root
+
+beforeEach(() => {
+  container = document.createElement('div')
+  document.body.appendChild(container)
+  root = createRoot(container)
+})
+
+afterEach(() => {
+  act(() => root.unmount())
+  container.remove()
+})
+
+const render = (p: Props) => act(() => root.render(<TrafficSourcePill {...p} />))
+
+const button = (label: string) =>
+  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)
+
+const open = () => act(() => button('istio')!.click())
+
+describe('TrafficSourcePill', () => {
+  it('switches source from the picker when connected', () => {
+    const p = props({})
+    render(p)
+    open()
+    act(() => button('hubble')!.click())
+    expect(p.onSwitch).toHaveBeenCalledWith('hubble')
+  })
+
+  it('keeps the picker available when the active source failed to connect', () => {
+    const p = props({ connection: 'error' })
+    render(p)
+    open()
+    act(() => button('hubble')!.click())
+    expect(p.onSwitch).toHaveBeenCalledWith('hubble')
+  })
+
+  it('offers retry next to the picker on error', () => {
+    const p = props({ connection: 'error' })
+    render(p)
+    act(() => button('retry')!.click())
+    expect(p.onRetry).toHaveBeenCalledTimes(1)
+    expect(button('istio')).toBeDefined()
+  })
+
+  it('does not switch when the active source is picked again', () => {
+    const p = props({})
+    render(p)
+    open()
+    act(() => container.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')!.click())
+    expect(p.onSwitch).not.toHaveBeenCalled()
+  })
+
+  it('shows no picker with a single available source', () => {
+    render(props({ sources: ['istio'] }))
+    expect(container.querySelector('button[aria-haspopup]')).toBeNull()
+    expect(container.textContent).toContain('istio')
+  })
+
+  it('shows no picker or retry while connecting', () => {
+    render(props({ connection: 'connecting' }))
+    expect(container.textContent).toContain('Connecting...')
+    expect(container.querySelector('button')).toBeNull()
+  })
+
+  it('does not reopen the menu after a retry made without a mouse', () => {
+    const p = props({ connection: 'error' })
+    render(p)
+    open()
+    expect(container.querySelector('[role="listbox"]')).not.toBeNull()
+    act(() => button('retry')!.click())
+    render({ ...p, connection: 'connecting' })
+    render({ ...p, connection: 'connected' })
+    const menu = container.querySelector('[role="listbox"]')
+    expect(menu === null || menu.hasAttribute('inert')).toBe(true)
+    expect(button('istio')!.getAttribute('aria-expanded')).toBe('false')
+  })
+
+  it('makes the menu inert while it animates closed, so its options cannot be activated', () => {
+    const p = props({})
+    render(p)
+    open()
+    expect(container.querySelector('[role="listbox"]')!.hasAttribute('inert')).toBe(false)
+    act(() => {
+      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
+    })
+    const closing = container.querySelector('[role="listbox"]')
+    expect(closing === null || closing.hasAttribute('inert')).toBe(true)
+  })
+})
```

**File**: `web/src/components/traffic/TrafficSourcePill.tsx` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import { useEffect, useRef, useState } from 'react'
+import { clsx } from 'clsx'
+import { ChevronDown, Loader2 } from 'lucide-react'
+import { StatusDot, toneTextClass } from '@skyhook-io/k8s-ui'
+import { useAnimatedUnmount } from '../../hooks/useAnimatedUnmount'
+import { TRANSITION_MENU, overlayExitMs, overlayTransitionStyle } from '../../utils/animation'
+
+export type TrafficSourceConnectionState = 'connecting' | 'error' | 'connected'
+
+interface TrafficSourcePillProps {
+  sources: string[]
+  active: string
+  connection: TrafficSourceConnectionState
+  onSwitch: (name: string) => void
+  onRetry: () => void
+}
+
+// The picker is shown for every connection state except connecting: a source
+// that cannot connect is the case where the user most needs to pick another.
+export function TrafficSourcePill({ sources, active, connection, onSwitch, onRetry }: TrafficSourcePillProps) {
+  const [open, setOpen] = useState(false)
+  const pickerRef = useRef<HTMLDivElement>(null)
+  const canPick = sources.length > 1
+  const menuOpen = open && canPick && connection !== 'connecting'
+  const { shouldRender, isOpen } = useAnimatedUnmount(menuOpen, overlayExitMs('menu'))
+
+  // Capture phase so the handler runs before ReactFlow swallows the event.
+  useEffect(() => {
+    if (!open) return
+    const handler = (e: MouseEvent) => {
+      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
+        setOpen(false)
+      }
+    }
+    document.addEventListener('mousedown', handler, true)
+    return () => document.removeEventListener('mousedown', handler, true)
+  }, [open])
+
+  const choose = (name: string) => {
+    setOpen(false)
+    if (name !== active) onSwitch(name)
+  }
+
+  // Keyboard activation of retry fires no outside mousedown, so the menu has to
+  // be closed here or it would reappear once the attempt finishes.
+  const retry = () => {
+    setOpen(false)
+    onRetry()
+  }
+
+  return (
+    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-theme-surface/90 backdrop-blur border border-theme-border text-[11px]">
+      {connection === 'connecting' ? (
+        <>
+          <Loader2 className="h-3 w-3 animate-spin text-accent" />
+          <span className="text-accent">Connecting...</span>
+        </>
+      ) : (
+        <>
+          <StatusDot tone={connection === 'error' ? 'degraded' : 'healthy'} size="md" />
+          {canPick ? (
+            <div className="relative" ref={pickerRef}>
+              <button
+                type="button"
+                onClick={() => setOpen(!open)}
+                aria-haspopup="listbox"
+                aria-expanded={menuOpen}
+                className="flex items-center gap-1 text-theme-text-secondary hover:text-theme-text-primary"
+              >
+                {active} <ChevronDown className="h-3 w-3" />
+              </button>
+              {shouldRender && (
+                <div
+                  role="listbox"
+                  inert={!menuOpen || undefined}
+                  className={clsx(
+                    'absolute top-full left-0 mt-1 z-50 bg-theme-surface border border-theme-border rounded-md shadow-theme-lg py-1 min-w-[120px] origin-top-left',
+                    TRANSITION_MENU,
+                    isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]',
+                    !menuOpen && 'pointer-events-none',
+                  )}
+                  style={overlayTransitionStyle(isOpen, 'menu')}
+                >
+                  {sources.map(name => (
+                    <button
+                      key={name}
+                      type="button"
+                      role="option"
+                      aria-selected={name === active}
+                      onClick={() => choose(name)}
+                      className={clsx('w-full text-left px-3 py-1 text-xs hover:bg-theme-hover capitalize', name === active && 'text-accent')}
+                    >
+                      {name}
+                    </button>
+                  ))}
+                </div>
+              )}
+            </div>
+          ) : (
+            <span className="text-theme-text-secondary">{active}</span>
+          )}
+          {connection === 'error' && (
+            <button type="button" onClick={retry} className={clsx('font-medium hover:underline', toneTextClass('degraded'))}>
+              retry
+            </button>
+          )}
+        </>
+      )}
+    </div>
+  )
+}
```

**File**: `web/src/components/traffic/TrafficView.tsx` (modified, +9/-55)
```diff
@@ -7,10 +7,10 @@ import { TrafficWizard } from './TrafficWizard'
 import { TrafficGraph, type TrafficGraphSelection } from './TrafficGraph'
 import { TrafficFilterSidebar } from './TrafficFilterSidebar'
 import { TrafficFlowListProvider } from './TrafficFlowListContext'
-import { Loader2, Filter, Plug, ChevronDown, List, Activity, AlertTriangle, Clock, Crosshair, X } from 'lucide-react'
+import { Filter, Plug, List, Activity, AlertTriangle, Clock, Crosshair, X } from 'lucide-react'
 import { TrafficFocusSearch } from './TrafficFocusSearch'
+import { TrafficSourcePill } from './TrafficSourcePill'
 import { TrafficGraphTooLarge } from './TrafficGraphTooLarge'
-import { clsx } from 'clsx'
 import { useQueryClient } from '@tanstack/react-query'
 import { useDock } from '../dock'
 import { AlertBanner, EmptyState, PaneLoader, FreshnessControl } from '@skyhook-io/k8s-ui'
@@ -457,8 +457,6 @@ export function TrafficView({ namespaces, onSetNamespaces }: TrafficViewProps) {
   const connectMutation = useTrafficConnect()
   const setSourceMutation = useSetTrafficSource()
   const hasAutoConnectedRef = useRef(false)
-  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
-  const sourcePickerRef = useRef<HTMLDivElement>(null)
 
   // Track cluster context to reset state on cluster change
   const { data: clusterInfo } = useClusterInfo()
@@ -479,18 +477,6 @@ export function TrafficView({ namespaces, onSetNamespaces }: TrafficViewProps) {
     lastClusterRef.current = currentCluster
   }, [clusterInfo?.context, queryClient])
 
-  // Close source picker on outside click (capture phase to beat ReactFlow)
-  useEffect(() => {
-    if (!sourcePickerOpen) return
-    const handler = (e: MouseEvent) => {
-      if (sourcePickerRef.current && !sourcePickerRef.current.contains(e.target as Node)) {
-        setSourcePickerOpen(false)
-      }
-    }
-    document.addEventListener('mousedown', handler, true)
-    return () => document.removeEventListener('mousedown', handler, true)
-  }, [sourcePickerOpen])
-
   const {
     data: sourcesData,
     isLoading: sourcesLoading,
@@ -1449,8 +1435,6 @@ export function TrafficView({ namespaces, onSetNamespaces }: TrafficViewProps) {
             const activeSource = availableSources.find(s => s.name === activeName) || availableSources[0]
 
             const handleSwitchSource = (name: string) => {
-              if (name === activeSource?.name) { setSourcePickerOpen(false); return }
-              setSourcePickerOpen(false)
               setIsConnecting(true)
               setConnectionError(null)
               hasAutoConnectedRef.current = true
@@ -1509,43 +1493,13 @@ export function TrafficView({ namespaces, onSetNamespaces }: TrafficViewProps) {
                     />
                   )}
                   {activeSource && (
-                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-theme-surface/90 backdrop-blur border border-theme-border text-[11px]">
-                      {isConnecting ? (
-                        <>
-                          <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
-                          <span className="text-blue-400">Connecting...</span>
-                        </>
-                      ) : connectionError ? (
-                        <>
-                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
-                          <span className="text-theme-text-secondary">{activeSource.name}</span>
-                          <button onClick={() => handleConnect(true)} className="text-yellow-500 hover:text-yellow-400 font-medium">retry</button>
-                        </>
-                      ) : (
-                        <>
-                          <span className="w-2 h-2 rounded-full bg-green-500" />
-                          {availableSources.length > 1 ? (
-                            <div className="relative" ref={sourcePickerRef}>
-                              <button onClick={() => setSourcePickerOpen(!sourcePickerOpen)} className="flex items-center gap-1 text-theme-text-secondary hover:text-theme-text-primary">
-                                {activeSource.name} <ChevronDown className="h-3 w-3" />
-                              </button>
-                              {sourcePickerOpen && (
-                                <div className="absolute top-full left-0 mt-1 z-50 bg-theme-surface border border-theme-border rounded-md shadow-lg py-1 min-w-[120px]">
-                                  {availableSources.map(source => (
-                                    <button key={source.name} onClick={() => handleSwitchSource(source.name)}
-                                      className={clsx('w-full text-left px-3 py-1 text-xs hover:bg-theme-hover capitalize', source.name === activeSource.name && 'text-blue-400')}>
-                                      {source.name}
-                                    </button>
-                                  ))}
-        
```

---

### Incident Patch 3: `0200075d` (2026-10-23)
**Commit Message**: Reject blank advertised checksums and correct retry guidance

**File**: `internal/helm/chart_digest.go` (modified, +15/-3)
```diff
@@ -18,23 +18,23 @@ var errChartDigest = errors.New("chart digest validation failed")
 // Legacy repositories may omit a digest. An advertised digest must be valid
 // and match the exact archive consumed, before Helm loads or renders it.
 func verifyChartDigest(data []byte, digest string) error {
-	digest = strings.TrimSpace(strings.ToLower(digest))
 	if digest == "" {
 		return nil
 	}
+	digest = strings.TrimSpace(strings.ToLower(digest))
 	want, err := hex.DecodeString(strings.TrimPrefix(digest, "sha256:"))
 	if err != nil || len(want) != sha256.Size {
 		return fmt.Errorf("%w: invalid SHA-256 digest in repository index", errChartDigest)
 	}
 	actual := sha256.Sum256(data)
 	if !bytes.Equal(actual[:], want) {
-		return fmt.Errorf("%w: chart digest does not match repository index; refresh the repository and retry. If it still fails, contact the repository maintainer", errChartDigest)
+		return fmt.Errorf("%w: chart digest does not match repository index", errChartDigest)
 	}
 	return nil
 }
 
 func loadChartWithDigest(path, digest string) (*chart.Chart, error) {
-	if strings.TrimSpace(digest) == "" {
+	if digest == "" {
 		return loader.Load(path)
 	}
 	data, err := os.ReadFile(path)
@@ -46,3 +46,15 @@ func loadChartWithDigest(path, digest string) (*chart.Chart, error) {
 	}
 	return loader.LoadArchive(bytes.NewReader(data))
 }
+
+// The source loader refreshes its index itself; cached-index consumers can
+// recover from a republished archive by refreshing before retrying.
+func withChartDigestGuidance(err error, freshIndex bool) error {
+	if !errors.Is(err, errChartDigest) {
+		return err
+	}
+	if freshIndex {
+		return fmt.Errorf("%w. Radar just downloaded the repository index. Contact the repository maintainer", err)
+	}
+	return fmt.Errorf("%w. Refresh the repository and retry. If it still fails, contact the repository maintainer", err)
+}
```

**File**: `internal/helm/client.go` (modified, +4/-4)
```diff
@@ -3376,7 +3376,7 @@ func (c *Client) GetChartDetail(repoName, chartName, version string) (*ChartDeta
 	chart, err := loadChartWithDigest(cp, chartVersion.Digest)
 	if err != nil {
 		if errors.Is(err, errChartDigest) {
-			return nil, fmt.Errorf("chart %s version %s: %w", chartName, chartVersion.Version, err)
+			return nil, fmt.Errorf("chart %s version %s: %w", chartName, chartVersion.Version, withChartDigestGuidance(err, false))
 		}
 		return &ChartDetail{
 			ChartInfo: chartVersionToInfo(chartVersion, repoName),
@@ -3605,7 +3605,7 @@ func (c *Client) installWith(actionConfig *action.Configuration, req *InstallReq
 	}
 	chart, err := loadChartWithDigest(cp, indexDigest)
 	if err != nil {
-		return nil, fmt.Errorf("failed to load chart %s version %s: %w", req.ChartName, resolvedVersion, err)
+		return nil, fmt.Errorf("failed to load chart %s version %s: %w", req.ChartName, resolvedVersion, withChartDigestGuidance(err, isRepoURL))
 	}
 
 	if mode != installFresh {
@@ -3810,7 +3810,7 @@ func (c *Client) installWithProgressUsing(actionConfig *action.Configuration, re
 		sendProgress("loading", "Loading chart...", chartPath)
 		loadedChart, err = loadChartWithDigest(chartPath, indexDigest)
 		if err != nil {
-			return nil, fmt.Errorf("failed to load chart %s version %s: %w", req.ChartName, resolvedVersion, err)
+			return nil, fmt.Errorf("failed to load chart %s version %s: %w", req.ChartName, resolvedVersion, withChartDigestGuidance(err, isRepoURL))
 		}
 	} else {
 		// Preserve the existing direct HTTP path. Helm's ChartDownloader loads all
@@ -3840,7 +3840,7 @@ func (c *Client) installWithProgressUsing(actionConfig *action.Configuration, re
 		sendProgress("loading", "Loading chart...", tmpChart.Name())
 		loadedChart, err = loadChartWithDigest(tmpChart.Name(), indexDigest)
 		if err != nil {
-			return nil, fmt.Errorf("failed to load chart %s version %s: %w", req.ChartName, resolvedVersion, err)
+			return nil, fmt.Errorf("failed to load chart %s version %s: %w", req.ChartName, resolvedVersion, withChartDigestGuidance(err, isRepoURL))
 		}
 	}
 
```

**File**: `internal/helm/download_checksum_test.go` (modified, +12/-3)
```diff
@@ -18,7 +18,7 @@ import (
 )
 
 func TestRepositoryChartChecksum(t *testing.T) {
-	for _, digest := range []string{"wrong", "malformed", "valid", "absent"} {
+	for _, digest := range []string{"wrong", "malformed", "whitespace", "valid", "absent"} {
 		for _, consumer := range []string{"source", "install", "progress", "detail", "direct-install", "direct-progress"} {
 			t.Run(digest+"/"+consumer, func(t *testing.T) {
 				c := newChartSourceTestClient(t)
@@ -36,12 +36,14 @@ func TestRepositoryChartChecksum(t *testing.T) {
 					advertised = strings.Repeat("0", 64)
 				case "malformed":
 					advertised = "not-sha256"
+				case "whitespace":
+					advertised = "   "
 				case "valid":
 					advertised = fmt.Sprintf("%x", sha256.Sum256(body))
 				}
 				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 					if r.URL.Path == "/index.yaml" {
-						fmt.Fprintf(w, "apiVersion: v1\nentries:\n  radar:\n  - apiVersion: v2\n    name: radar\n    version: 1.0.0\n    urls: [radar.tgz]\n    digest: %s\n", advertised)
+						fmt.Fprintf(w, "apiVersion: v1\nentries:\n  radar:\n  - apiVersion: v2\n    name: radar\n    version: 1.0.0\n    urls: [radar.tgz]\n    digest: %q\n", advertised)
 					} else {
 						w.Write(body)
 					}
@@ -70,10 +72,17 @@ func TestRepositoryChartChecksum(t *testing.T) {
 				case "detail":
 					_, err = c.GetChartDetail("probe", "radar", "1.0.0")
 				}
-				if digest == "wrong" || digest == "malformed" {
+				if digest == "wrong" || digest == "malformed" || digest == "whitespace" {
 					if err == nil || !strings.Contains(err.Error(), "digest") {
 						t.Fatalf("expected digest rejection, got %v", err)
 					}
+					if consumer == "source" || strings.HasPrefix(consumer, "direct-") {
+						if strings.Contains(strings.ToLower(err.Error()), "refresh the repository") {
+							t.Fatalf("fresh index must not recommend another refresh: %v", err)
+						}
+					} else if !strings.Contains(strings.ToLower(err.Error()), "refresh the repository") {
+						t.Fatalf("cached index needs actionable refresh guidance: %v", err)
+					}
 					if consumer == "install" || consumer == "progress" {
 						if _, e := cfg.Releases.Last(req.ReleaseName); e == nil {
 							t.Fatal("rejected chart created release")
```

**File**: `internal/helm/source_upgrade.go` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ func (c *Client) loadSourceChart(cfg *action.Configuration, source ChartSourceCa
 		}
 	}
 	if err := verifyChartDigest(data, indexDigest); err != nil {
-		return nil, "", fmt.Errorf("chart %s version %s: %w", name, version, err)
+		return nil, "", fmt.Errorf("chart %s version %s: %w", name, version, withChartDigestGuidance(err, true))
 	}
 	sum := sha256.Sum256(data)
 	ch, err := loader.LoadArchive(bytes.NewReader(data))
```

#### Recent Merged Pull Requests:
- **PR #2296** (2026-10-24): Document audit resource budgets, drain completion and Trivy search (@nadaverell)
- **PR #2295** (2026-10-24): Add a discoverable What's New skill with companion-repo workflows (@nadaverell)
- **PR #2294** (2026-10-24): Show v1.18 What's New automatically after upgrades (@nadaverell)
- **PR #2292** (2026-10-25): sec(install): verify SHA-256 checksums before archive extraction (@AbdullahNM)
- **PR #2284** (2026-10-25): Verify advertised Helm chart checksums before use (@hisco)
- **PR #2281** (2026-10-23): Gate Trivy reports on report RBAC on every read surface (@hisco)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
