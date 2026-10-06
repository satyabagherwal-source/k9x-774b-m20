# Forensic Learning Record (Deep Inspection): skyhook-io/radar

> **Canonical Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:53:23.442Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 3650 stars

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
	if !event.LastTimestamp.Time.IsZero() {
		return event.LastTimestamp.Time
	}
	return 
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
	// container that served for days and restarted once (a node or kubelet
	// bounce) k
```

### Core Architecture Module: `internal/search/score.go`
```
package search

import "strings"

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
	Namespace   string
	Name        string
	Labels      map[string]string
	Annotations map[string]string
	Images      []string
	Content     []ContentField
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
	if len(q.KindFilter) > 0 && !kindMatches(c.Kind, q.KindFilter) {
		return 0, nil, nil, false
	}
	if len(q.NSFilter) > 0 && !sliceContainsFold(q.NSFilter, c.Namespace) {
		return 0, nil, nil, false
	}
	for _, lf := range q.LabelFilter {
		v, ok := c.Labels[lf.Key]
		if !ok {
			return 0, nil, nil, false
		}
		if lf.Value != "" && v != lf.Value {
			return 0, nil, nil, false
		}
	}
	for _, img := range q.ImageFilter {
		if !anyContainsFold(c.Images, img) {
			return 0, nil, nil, false
		}
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

// kindMatches returns true if any of the kind filters refer to the candidate kind.
// Filters are case-insensitive and accept either the singular Kind ("Pod") or the
// lowercase plural resource ("pods"). Trailing-s pluralization is the only tolerance.
func kindMatches(kind string, filters []string) bool {
	low := strings.ToLower(kind)
	plural := low + "s"
	for _, f := range filters {
		fLow := strings.ToLower(f)
		if fLow == low || fLow == plural || fLow+"s" == plural || fLow == strings.TrimSuffix(low, "s") {
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

### Core Architecture Module: `packages/k8s-ui/src/components/logs/LogCore.tsx`
```
import { useRef, useCallback, useState, useMemo, useEffect, type ReactNode } from 'react'
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
  emptyMessage?: string
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
  emptyCommand,
  errorMessage,
  forceDark,
  defaultDark = true,
}: LogCoreProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [atBottom, setAtBottom] = useState(true)
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
      const v = localStorage.getItem('radar-logs-export-format') as LogExportFormat | null
      return v === 'txt' || v === 'json' || v === 'csv' ? v : 'txt'
    } catch { return 'txt' }
  })
  const [showTsMenu, setShowTsMenu] = useState(false)
  const tsMenu = useAnimatedUnmount(showTsMenu, overlayExitMs('menu'))
  const [showStructuredMenu, setShowStructuredMenu] = useState(false)
  const structuredMenu = useAnimatedUnmount(showStructuredMenu, overlayExitMs('menu'))
  const [structuredMode, setStructuredMode] = useState<StructuredMode>(() => {
    try {
      const v = localStorage.getItem('radar-logs-structured-mode') as StructuredMode | null
      return v && STRUCTURED_MODE_ORDER.includes(v) ? v : 'compact'
    } catch { return 'compact' }
  })
  const [expandedStacks, setExpandedStacks] = useState<Set<number>>(() => new Set())

  // Re-render every 15s so "relative" timestamps tick forward during idle viewing.
  const [, setNowTick] = useState(0)
  useEffect(() => {
    if (tsFormat !== 'relative' || !showTimestamps) return
    const id = setInterval(() => setNowTick(n => n + 1), 15_000)
    return () => clearInterval(id)
  }, [tsFormat, showTimestamps])

  // One membership rule for filtering, counting and grouping: a stack-trace
  // line belongs to the record its own pod and container started.
  const association = useMemo(() => {
    const { headOf, effectiveLevel } = associateContinuations(entries)
    const headIdById = new Map<number, number>()
    for (let i = 0; i < entries.length; i++) {
      if (headOf[i] !== i) headIdById.set(entries[i].id, entries[headOf[i]].id)
    }
    return { headOf, effectiveLevel, headIdById }
  }, [entries])

  // Frames take their record's level so they filter and render as part of it.
  const recordEntries = useMemo(
    () => entries.map((e, i) => (association.effectiveLevel[i] =
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

### Core Architecture Module: `packages/k8s-ui/src/components/resources/renderers/AWSMachineTemplateRenderer.tsx`
```
import { Cpu, Server } from 'lucide-react'
import { Section, PropertyList, Property } from '../../ui/drawer-components'
import { getAWSMTInstanceType } from '../resource-utils-aws-capi'

interface Props {
  data: any
}

export function AWSMachineTemplateRenderer({ data }: Props) {
  const templateSpec = data.spec?.template?.spec || {}
  const status = data.status || {}

  return (
    <>
      <Section title="Template Spec" icon={Cpu}>
        <PropertyList>
          <Property label="Instance Type" value={getAWSMTInstanceType(data)} />
          {templateSpec.subnet?.id && (
            <Property label="Subnet" value={<span className="font-mono text-[11px]">{templateSpec.subnet.id}</span>} />
          )}
          {templateSpec.iamInstanceProfile && <Property label="IAM Profile" value={templateSpec.iamInstanceProfile} />}
          {templateSpec.sshKeyName && <Property label="SSH Key" value={templateSpec.sshKeyName} />}
        </PropertyList>
      </Section>

      {/* Resolved capacity from status */}
      {(status.capacity || status.nodeInfo) && (
        <Section title="Resolved Info" icon={Server}>
          <PropertyList>
            {status.capacity?.cpu && <Property label="CPU" value={status.capacity.cpu} />}
            {status.capacity?.memory && <Property label="Memory" value={status.capacity.memory} />}
            {status.nodeInfo?.architecture && <Property label="Architecture" value={status.nodeInfo.architecture} />}
            {status.nodeInfo?.operatingSystem && <Property label="OS" value={status.nodeInfo.operatingSystem} />}
          </PropertyList>
        </Section>
      )}
    </>
  )
}

```

### Core Architecture Module: `packages/k8s-ui/src/components/resources/renderers/AWSManagedClusterRenderer.tsx`
```
import { Globe, Server } from 'lucide-react'
import { Section, PropertyList, Property, ConditionsSection, AlertBanner, useOperationalIssuesShown} from '../../ui/drawer-components'
import { getCAPIConditions } from '../resource-utils-capi'
import { getAWSManagedClusterStatus, getAWSManagedClusterEndpoint, getAWSManagedClusterFailureDomains } from '../resource-utils-aws-capi'

interface Props {
  data: any
}

export function AWSManagedClusterRenderer({ data }: Props) {
  const conditions = getCAPIConditions(data)
  const clusterStatus = getAWSManagedClusterStatus(data)
  const isFailed = clusterStatus.level === 'unhealthy'
  const operationalIssuesShown = useOperationalIssuesShown()
  const readyCond = conditions.find((c: any) => c.type === 'Ready')
  const failureDomains = getAWSManagedClusterFailureDomains(data)
  const endpoint = getAWSManagedClusterEndpoint(data)

  return (
    <>
      {isFailed && !operationalIssuesShown && (
        <AlertBanner
          variant="error"
          title="Managed Cluster Not Ready"
          message={readyCond?.message || 'AWSManagedCluster is not ready.'}
        />
      )}

      <Section title="Overview" icon={Globe}>
        <PropertyList>
          {endpoint !== '-' && (
            <Property label="Endpoint" value={<span className="font-mono text-[10px] break-all">{endpoint}</span>} />
          )}
        </PropertyList>
      </Section>

      {failureDomains.length > 0 && (
        <Section title="Failure Domains" icon={Server}>
          <div className="flex flex-wrap gap-1">
            {failureDomains.map((az) => (
              <span key={az} className="badge badge-sm bg-theme-elevated text-theme-text-secondary border-theme-border">{az}</span>
            ))}
          </div>
        </Section>
      )}

      <ConditionsSection conditions={conditions} />
    </>
  )
}

```

### Core Architecture Module: `packages/k8s-ui/src/components/resources/renderers/AWSManagedControlPlaneRenderer.tsx`
```
import { Globe, Network, Shield, Server, Package } from 'lucide-react'
import { Section, PropertyList, Property, ConditionsSection, AlertBanner, useOperationalIssuesShown} from '../../ui/drawer-components'
import { getCAPIConditions } from '../resource-utils-capi'
import {
  getAWSMCPStatus, getAWSMCPEKSClusterName, getAWSMCPRegion, getAWSMCPVersion,
  getAWSMCPEndpointAccess, getAWSMCPAddons, getAWSMCPSubnets, getAWSMCPSecurityGroups,
  getAWSMCPNATGatewayIPs, getAWSMCPFailureDomains, getAWSMCPVPC,
} from '../resource-utils-aws-capi'

interface Props {
  data: any
  onNavigate?: (ref: { kind: string; namespace: string; name: string; group?: string }) => void
}

export function AWSManagedControlPlaneRenderer({ data }: Props) {
  const spec = data.spec || {}
  const conditions = getCAPIConditions(data)

  const mcpStatus = getAWSMCPStatus(data)
  const isFailed = mcpStatus.level === 'unhealthy'
  const operationalIssuesShown = useOperationalIssuesShown()
  const readyCond = conditions.find((c: any) => c.type === 'Ready')

  const vpc = getAWSMCPVPC(data)
  const subnets = getAWSMCPSubnets(data)
  const securityGroups = getAWSMCPSecurityGroups(data)
  const natIPs = getAWSMCPNATGatewayIPs(data)
  const failureDomains = getAWSMCPFailureDomains(data)
  const addons = getAWSMCPAddons(data)

  return (
    <>
      {isFailed && !operationalIssuesShown && (
        <AlertBanner
          variant="error"
          title="EKS Control Plane Not Ready"
          message={readyCond?.message || 'AWSManagedControlPlane is not ready.'}
        />
      )}

      <Section title="Overview" icon={Globe}>
        <PropertyList>
          <Property label="EKS Cluster" value={getAWSMCPEKSClusterName(data)} />
          <Property label="Region" value={getAWSMCPRegion(data)} />
          <Property label="Version" value={getAWSMCPVersion(data)} />
          <Property label="Endpoint Access" value={getAWSMCPEndpointAccess(data)} />
          {spec.roleName && <Property label="IAM Role" value={spec.roleName} />}
          {spec.identityRef?.name && (
            <Property label="Identity" value={`${spec.identityRef.kind}/${spec.identityRef.name}`} />
          )}
        </PropertyList>
      </Section>

      {/* Network - VPC */}
      {vpc.id !== '-' && (
        <Section title="VPC" icon={Network}>
          <PropertyList>
            <Property label="VPC ID" value={<span className="font-mono text-[11px]">{vpc.id}</span>} />
            {vpc.cidrBlock !== '-' && <Property label="CIDR" value={vpc.cidrBlock} />}
          </PropertyList>
        </Section>
      )}

      {/* Subnets */}
      {subnets.length > 0 && (
        <Section title={`Subnets (${subnets.length})`} icon={Network}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-theme-text-tertiary">
                <th className="text-left font-medium py-1">ID</th>
                <th className="text-left font-medium py-1">AZ</th>
                <th className="text-left font-medium py-1">Type</th>
                <th className="text-left font-medium py-1">CIDR</th>
              </tr>
            </thead>
            <tbody>
              {subnets.map((s, i) => (
                <tr key={i} className="border-t border-theme-border">
                  <td className="py-1 text-theme-text-secondary font-mono text-[10px]">{s.id}</td>
                  <td className="py-1 text-theme-text-secondary">{s.az}</td>
                  <td className="py-1">
                    <span className={`badge badge-sm ${s.isPublic
                      ? 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-700/40'
                      : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-700/40'
                    }`}>{s.isPublic ? 'Public' : 'Private'}</span>
                  </td>
                  <td className="py-1 text-theme-text-secondary font-mono text-[10px]">{s.cidrBlock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Security Groups */}
      {securityGroups.length > 0 && (
        <Section title="Security Groups" icon={Shield}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-theme-text-tertiary">
                <th className="text-left font-medium py-1">Role</th>
                <th className="text-left font-medium py-1">ID</th>
                <th className="text-left font-medium py-1">Name</th>
              </tr>
            </thead>
            <tbody>
              {securityGroups.map((sg, i) => (
                <tr key={i} className="border-t border-theme-border">
                  <td className="py-1 text-theme-text-secondary font-medium">{sg.role}</td>
                  <td className="py-1 text-theme-text-secondary font-mono text-[10px]">{sg.id}</td>
                  <td className="py-1 text-theme-text-secondary text-[10px] break-all">{sg.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* NAT Gateways */}
      {natIPs.length > 0 && (
        <Section title="NAT Gateways" icon={Network}>
          <div className="flex flex-wrap gap-1">
            {natIPs.map((ip, i) => (
              <span key={i} className="badge badge-sm bg-theme-elevated text-theme-text-secondary border-theme-border font-mono text-[10px]">{ip}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Addons */}
      {addons.length > 0 && (
        <Section title="EKS Addons" icon={Package}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-theme-text-tertiary">
                <th className="text-left font-medium py-1">Name</th>
                <th className="text-left font-medium py-1">Version</th>
                <th className="text-left font-medium py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {addons.map((a, i) => (
                <tr key={i} className="border-t border-theme-border">
                  <td className="py-1 text-theme-text-secondary font-medium">{a.name}</td>
                  <td className="py-1 text-theme-text-secondary font-mono text-[10px]">{a.statusVersion !== '-' ? a.statusVersion : a.specVersion}</td>
                  <td className="py-1">
                    <span className={`badge badge-sm ${a.status === 'ACTIVE'
                      ? 'status-green'
                      : a.status === 'DEGRADED'
                      ? 'status-red'
                      : 'status-neutral'
                    }`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Failure Domains */}
      {failureDomains.length > 0 && (
        <Section title="Failure Domains" icon={Server}>
          <div className="flex flex-wrap gap-1">
            {failureDomains.map((az) => (
              <span key={az} className="badge badge-sm bg-theme-elevated text-theme-text-secondary border-theme-border">{az}</span>
            ))}
          </div>
        </Section>
      )}

      <ConditionsSection conditions={conditions} />
    </>
  )
}

```

### Core Architecture Module: `packages/k8s-ui/src/components/resources/renderers/AWSManagedMachinePoolRenderer.tsx`
```
import { Server, Settings } from 'lucide-react'
import { clsx } from 'clsx'
import { Section, PropertyList, Property, ConditionsSection, AlertBanner, useOperationalIssuesShown} from '../../ui/drawer-components'
import { getCAPIConditions } from '../resource-utils-capi'
import { getAWSMMPStatus, getAWSMMPInstanceType, getAWSMMPCapacityType, getAWSMMPAMIType, getAWSMMPNodegroupName, getAWSMMPScaling } from '../resource-utils-aws-capi'
import { CAPACITY_TYPE_BADGE } from '../../../utils/badge-colors'

interface Props {
  data: any
  onNavigate?: (ref: { kind: string; namespace: string; name: string; group?: string }) => void
}

export function AWSManagedMachinePoolRenderer({ data }: Props) {
  const spec = data.spec || {}
  const status = data.status || {}
  const conditions = getCAPIConditions(data)

  const mmpStatus = getAWSMMPStatus(data)
  const isFailed = mmpStatus.level === 'unhealthy'
  const operationalIssuesShown = useOperationalIssuesShown()
  const readyCond = conditions.find((c: any) => c.type === 'Ready')

  const scaling = getAWSMMPScaling(data)
  const capacityType = getAWSMMPCapacityType(data)
  const labels = spec.labels || {}
  const subnetIDs = spec.subnetIDs || []

  return (
    <>
      {isFailed && !operationalIssuesShown && (
        <AlertBanner
          variant="error"
          title="Managed Machine Pool Not Ready"
          message={readyCond?.message || 'AWSManagedMachinePool is not ready.'}
        />
      )}

      <Section title="Overview" icon={Server}>
        <PropertyList>
          <Property label="Node Group" value={getAWSMMPNodegroupName(data)} />
          <Property label="Instance Type" value={getAWSMMPInstanceType(data)} />
          <Property label="AMI Type" value={getAWSMMPAMIType(data)} />
          <Property label="Capacity Type" value={
            <span className={clsx('badge badge-sm', capacityType === 'spot' ? CAPACITY_TYPE_BADGE.spot : CAPACITY_TYPE_BADGE.onDemand)}>{capacityType === 'onDemand' ? 'On-Demand' : capacityType}</span>
          } />
          {spec.roleName && <Property label="IAM Role" value={spec.roleName} />}
        </PropertyList>
      </Section>

      <Section title="Scaling" icon={Settings}>
        <PropertyList>
          <Property label="Min Size" value={String(scaling.min)} />
          <Property label="Max Size" value={String(scaling.max)} />
          <Property label="Current Replicas" value={String(status.replicas ?? 0)} />
          {spec.updateConfig?.maxUnavailable != null && (
            <Property label="Max Unavailable" value={String(spec.updateConfig.maxUnavailable)} />
          )}
        </PropertyList>
      </Section>

      {/* Subnets */}
      {subnetIDs.length > 0 && (
        <Section title="Subnets" icon={Server}>
          <div className="flex flex-wrap gap-1">
            {subnetIDs.map((id: string) => (
              <span key={id} className="badge badge-sm bg-theme-elevated text-theme-text-secondary border-theme-border font-mono text-[10px]">{id}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Labels */}
      {Object.keys(labels).length > 0 && (
        <Section title="Node Labels" icon={Settings}>
          <div className="flex flex-wrap gap-1">
            {Object.entries(labels).map(([k, v]) => (
              <span key={k} className="badge badge-sm bg-theme-elevated text-theme-text-secondary border-theme-border text-[10px]">
                {k}={v as string}
              </span>
            ))}
          </div>
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
- **Issue #1870** (2026-09-25): **Traffic: Istio not detected when istiod uses a revisioned name (e.g. istiod-1-30-1)**
  *Symptoms*: Moved from discussion #1765. Thanks @Svm1905 for the clear diagnosis there.  ## Summary  The Traffic view doesn't detect Istio when the `istiod` control plane uses a **revisioned** Deployment name such as `istiod-1-30-1`, the standard pattern for Istio canary / revision-based upgrades. The mesh is healthy and `istio_requests_total` is in Prometheus, but Radar reports Istio as not detected and recommends installing Caretta instead.  ## Cause  `IstioSource.Detect()` in `internal/traffic/istio.go` looks for `istiod` by an exact Deployment name across a fixed list of namespaces:  ```go const istiodName = "istiod" var istioNamespaces = []string{"istio-system", "istio", "default"} ... deploy, err := s.k8sClient.AppsV1().Deployments(ns).Get(ctx, istiodName, metav1.GetOptions{}) ```  On a revisioned install that `Get` returns NotFound in every namespace, so the source ends up `Available: false`. Downstream, the Istio branch of `generateRecommendation` (`internal/traffic/manager.go`) only fires for a detected source, so the user falls through to the CNI-based recommendation (Caretta).  Once detection passes, `GetFlows()` already works against the existing Prometheus metrics. The reporter confirmed this with direct PromQL. So the fix is detection only.  ## Desired behavior  Detect `istiod` by **label** instead of exact name, keeping today's behavior for default installs:  - In each candidate namespace, **list** Deployments with the label selector `app=istiod`. Istio's chart sets this l

- **Issue #1790** (2026-10-03): **Logs panel theme black by default**
  *Symptoms*: ## Describe the bug  Pod logs panel opens always with dark mode, even if application with white theme.   ## To reproduce  Steps to reproduce the behavior:  1. Run radar with white style 2. Click on any pod, click logs 3. See error: logs panel gonna be black style  ## Expected behavior  if radar runs with white theme, logs panel also should opens with white style.   ## Screenshots    <img width="3600" height="2130" alt="Image" src="https://github.com/user-attachments/assets/51d54118-ed5b-4a8e-bc6d-c1f7ac24ce67" />   - Radar version: [1.14.0] 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The default is wrong here.  The logs viewer keeps its own light/dark setting separate from the app theme, and it defaults to dark no matter which theme Radar is running. There is a sun/moon toggle in the logs toolbar (just right of the search icon) that switches it and remembers the choice, so that gets you a light panel in the meantime.  The default should follow the app theme instead. The same wiring also hides that toggle when Radar is in dark theme, so it is not currently possible to go the other way either; both come from the same place.  Should be a small fix; we'll try to get to it soon.

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

### Incident Patch 1: `1003fe6f` (2026-10-04)
**Commit Message**: fix(issues): one stable issue per restart loop (#1967)

## Problem

A container stuck restarting looks like a different problem on almost
every poll:

- Waiting `CrashLoopBackOff` → `crashloop`
- Running but not ready → `readiness_failed` / `high_restart` / nothing
- A liveness `Unhealthy` event → `liveness_probe_failed`
- Terminated `Completed/0` (graceful liveness kill) → breaks the
stable-crashloop check
- Running + Ready between crashes → nothing, so the issue resolves

Each flip is a new issue id, and the Deployment's `workload_degraded`
row comes and goes with it. Downstream, every flip is a new alert and a
new AI investigation. One production gateway (restartCount 4592, last
state `Completed/0`) produced thousands of open/resolve generations. On
our own clusters, 15 workloads loop like this right now.

## Change

**One issue per restart loop.**
- A container is looping while it has ≥3 restarts and its current or
last termination ended within 30 minutes, whatever the exit code, after
a run shorter than 30 minutes.
- While it loops, its pod keeps one row through every kubelet state:
`crashloop`, or `oom_killed` for an OOM loop.
- The workload's `workload_degraded` row folds in

**File**: `internal/issues/dedupe.go` (modified, +32/-1)
```diff
@@ -75,6 +75,17 @@ var childCategories = map[issuesapi.Category]bool{
 	issuesapi.CategoryPVCPending:               true,
 }
 
+// podCreationChildCategories are the child symptoms that explain a
+// ReplicaFailure parent: the controller could not create pods at all, so only a
+// rejection of pod creation names the cause. A pod runtime symptom such as a
+// crashloop on an existing pod does not, and must not fold it.
+var podCreationChildCategories = map[issuesapi.Category]bool{
+	issuesapi.CategoryQuotaExceeded:            true,
+	issuesapi.CategoryAdmissionWebhookBlocking: true,
+	issuesapi.CategoryPodSecurityViolation:     true,
+	issuesapi.CategoryRBACForbidden:            true,
+}
+
 // parentRollupCategories are the workload-level summaries that should be
 // suppressed when a more-specific child symptom exists for the same subject.
 //
@@ -139,12 +150,27 @@ func dedupeRepeatedCronJobFailureOverChild(in []Issue) []Issue {
 func dedupeWorkloadDegradedOverChild(in []Issue) []Issue {
 	// Per subject, the worst severity among its specific child-symptom rows.
 	maxChildSev := map[string]int{}
+	maxCreationChildSev := map[string]int{}
+	// A restart loop explains its workload's unavailability at any severity:
+	// a slow loop or one bad replica is a warning, while the Deployment's
+	// "N/M available" row is critical whenever a replica is down and comes
+	// and goes with the crash cycle.
+	loopChild := map[string]bool{}
 	for _, i := range in {
 		if childCategories[i.Category] {
 			k := subjectKeyOf(subjectRef(i))
+			if i.RestartLoop != nil {
+				loopChild[k] = true
+			}
 			if r := SeverityRank(i.Severity); r > maxChildSev[k] {
 				maxChildSev[k] = r
 			}
+			// Only the scheduling source's admission rejections are about pod
+			// creation; the same categories from a running pod (an RBAC
+			// denial at runtime) are not.
+			if r := SeverityRank(i.Severity); i.Source == SourceScheduling && podCreationChildCategories[i.Category] && r > maxCreationChildSev[k] {
+				maxCreationChildSev[k] = r
+			}
 		}
 	}
 	if len(maxChildSev) == 0 {
@@ -164,7 +190,12 @@ func dedupeWorkloadDegradedOverChild(in []Issue) []Issue {
 			// Suppress only when a child at least as severe exists — never
 			// downgrade a critical rollup to a warning child.
 			k := subjectKeyOf(subjectRef(i))
-			if r, ok := maxChildSev[k]; ok && r >= SeverityRank(i.Severity) {
+			sev := maxChildSev
+			if i.Reason == "ReplicaFailure" {
+				sev = maxCreationChildSev
+			}
+			loopFolds := i.Category == issuesapi.CategoryWorkloadDegraded && loopChild[k]
+			if r, ok := sev[k]; loopFolds || (ok && r >= SeverityRank(i.Severity)) {
 				if i.IssueTiming != "" {
 					if prev, seen := suppressedIssueTiming[k]; seen && prev != i.IssueTiming {
 						suppressedIssueTiming[k] = ""
```

**File**: `internal/issues/dedupe_test.go` (modified, +39/-0)
```diff
@@ -104,6 +104,45 @@ func TestDedupeWorkloadDegradedOverChild_Phase0(t *testing.T) {
 		}
 	})
 
+	t.Run("ReplicaFailure is not folded into a crashloop on an existing pod", func(t *testing.T) {
+		rollout := Issue{Source: SourceProblem, Group: "apps", Kind: "Deployment", Namespace: "ns", Name: "web",
+			Category: issuesapi.CategoryRolloutStalled, Severity: SeverityCritical, Reason: "ReplicaFailure"}
+		crash := Issue{Source: SourceProblem, Kind: "Pod", Namespace: "ns", Name: "web-abc",
+			Owner: dep, Category: issuesapi.CategoryCrashLoop, Severity: SeverityCritical}
+		out := dedupeWorkloadDegradedOverChild([]Issue{rollout, crash})
+		if !hasCategory(out, issuesapi.CategoryRolloutStalled) {
+			t.Fatalf("pod creation failure is independent of a crashlooping pod and must survive, got %+v", out)
+		}
+	})
+
+	t.Run("ReplicaFailure is not folded into a runtime RBAC denial on a running pod", func(t *testing.T) {
+		rollout := Issue{Source: SourceProblem, Group: "apps", Kind: "Deployment", Namespace: "ns", Name: "web",
+			Category: issuesapi.CategoryRolloutStalled, Severity: SeverityCritical, Reason: "ReplicaFailure"}
+		runtimeDenial := Issue{Source: SourceProblem, Kind: "Pod", Namespace: "ns", Name: "web-old",
+			Owner: dep, Category: issuesapi.CategoryRBACForbidden, Severity: SeverityCritical}
+		out := dedupeWorkloadDegradedOverChild([]Issue{rollout, runtimeDenial})
+		if !hasCategory(out, issuesapi.CategoryRolloutStalled) {
+			t.Fatalf("a running pod's RBAC denial does not explain a pod creation failure, got %+v", out)
+		}
+	})
+
+	t.Run("a warning restart loop folds its workload's critical availability row", func(t *testing.T) {
+		degraded := Issue{Source: SourceProblem, Group: "apps", Kind: "Deployment", Namespace: "ns", Name: "web",
+			Category: issuesapi.CategoryWorkloadDegraded, Severity: SeverityCritical, Reason: "9/10 available"}
+		loop := Issue{Source: SourceProblem, Kind: "Pod", Namespace: "ns", Name: "web-abc", Owner: dep,
+			Category: issuesapi.CategoryCrashLoop, Severity: SeverityWarning, RestartLoop: &issuesapi.RestartLoop{Container: "app"}}
+		out := dedupeWorkloadDegradedOverChild([]Issue{degraded, loop})
+		if hasCategory(out, issuesapi.CategoryWorkloadDegraded) {
+			t.Fatalf("the loop explains the unavailability and must own it at any severity, got %+v", out)
+		}
+		stalled := Issue{Source: SourceProblem, Group: "apps", Kind: "Deployment", Namespace: "ns", Name: "web",
+			Category: issuesapi.CategoryRolloutStalled, Severity: SeverityCritical, Reason: "Rollout stuck"}
+		out = dedupeWorkloadDegradedOverChild([]Issue{stalled, loop})
+		if !hasCategory(out, issuesapi.CategoryRolloutStalled) {
+			t.Fatalf("rollout_stalled keeps the severity gate; a warning loop must not hide it, got %+v", out)
+		}
+	})
+
 	t.Run("cronjob_failed is not a rollup and survives alongside an unrelated job_failed", func(t *testing.T) {
 		cron := Issue{Source: SourceProblem, Group: "batch", Kind: "CronJob", Namespace: "ns", Name: "nightly",
 			Category: issuesapi.CategoryCronJobFailed, Severity: SeverityWarning, Reason: "stale"}
```

**File**: `internal/issues/diagnostic_context.go` (modified, +48/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"fmt"
 	"sort"
 	"strings"
+	"time"
 
 	"github.com/skyhook-io/radar/internal/k8s"
 	"github.com/skyhook-io/radar/pkg/issuesapi"
@@ -973,6 +974,9 @@ func isBlockedInitContainer(i Issue) bool {
 }
 
 func restartCauseFact(i Issue) (issuesapi.DiagnosticFact, bool) {
+	if l := i.RestartLoop; l != nil {
+		return issuesapi.DiagnosticFact{Type: factRestartCause, Message: restartLoopEvidenceMessage(l)}, true
+	}
 	if i.RestartCount <= 0 && i.LastTerminatedReason == "" {
 		return issuesapi.DiagnosticFact{}, false
 	}
@@ -992,6 +996,50 @@ func restartCauseFact(i Issue) (issuesapi.DiagnosticFact, bool) {
 	}, true
 }
 
+// restartLoopEvidenceMessage states what was observed for a looping container.
+// Probe failures are listed beside the restarts, never as their cause.
+func restartLoopEvidenceMessage(l *issuesapi.RestartLoop) string {
+	parts := []string{
+		fmt.Sprintf("container=%s", l.Container),
+		fmt.Sprintf("restartCount=%d", l.RestartCount),
+	}
+	last := fmt.Sprintf("lastExitCode=%d", l.LastExitCode)
+	if l.LastReason != "" {
+		last += fmt.Sprintf(" (%s)", l.LastReason)
+	}
+	if !l.LastFinishedAt.IsZero() {
+		last += " at " + l.LastFinishedAt.UTC().Format(time.RFC3339)
+	}
+	switch {
+	case !l.LastStartedAt.IsZero() && !l.LastFinishedAt.IsZero():
+		last += fmt.Sprintf(" after running %s", l.LastFinishedAt.Sub(l.LastStartedAt).Round(time.Second))
+	case !l.LastFinishedAt.IsZero():
+		last += " without starting"
+	}
+	parts = append(parts, last)
+	if l.WorkloadPods > 0 {
+		parts = append(parts, fmt.Sprintf("loopingPods=%d/%d", l.LoopingPods, l.WorkloadPods))
+	}
+	for _, p := range []struct {
+		name string
+		pf   *issuesapi.ProbeFailure
+	}{{"startup", l.StartupProbeFailure}, {"liveness", l.LivenessProbeFailure}, {"readiness", l.ReadinessProbeFailure}} {
+		if p.pf == nil {
+			continue
+		}
+		obs := fmt.Sprintf("%s probe failure last seen %s", p.name, p.pf.LastSeen.UTC().Format(time.RFC3339))
+		if p.pf.Message != "" {
+			obs += fmt.Sprintf(" (%q)", p.pf.Message)
+		}
+		parts = append(parts, obs)
+	}
+	msg := "Restart loop evidence: " + strings.Join(parts, ", ") + "."
+	if l.SeverityReason != "" {
+		msg += " Severity " + l.SeverityReason + "."
+	}
+	return msg
+}
+
 func diagnosticMessage(i Issue) string {
 	if i.Message != "" {
 		return i.Message
```

**File**: `internal/issues/grouping.go` (modified, +1/-0)
```diff
@@ -157,6 +157,7 @@ func foldGroup(members []Issue) Issue {
 		Fingerprint:          rep.Fingerprint,
 		RestartCount:         rep.RestartCount,
 		LastTerminatedReason: rep.LastTerminatedReason,
+		RestartLoop:          rep.RestartLoop,
 		FirstSeen:            rep.FirstSeen,
 		OnsetUnknown:         rep.OnsetUnknown,
 		ResourceCreatedAt:    rep.ResourceCreatedAt,
```

**File**: `internal/issues/normalize.go` (modified, +1/-0)
```diff
@@ -180,6 +180,7 @@ func fromProblem(p k8s.Detection, now time.Time, source Source) Issue {
 		Count:                1,
 		RestartCount:         p.RestartCount,
 		LastTerminatedReason: p.LastTerminatedReason,
+		RestartLoop:          p.RestartLoop,
 		IssueTiming:          issueTiming,
 		IssueTimingBasis:     issueTimingBasis,
 	}
```

**File**: `internal/issues/restart_loop_integration_test.go` (added, +253/-0)
```diff
@@ -0,0 +1,253 @@
+package issues
+
+import (
+	"strings"
+	"testing"
+	"time"
+
+	appsv1 "k8s.io/api/apps/v1"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/client-go/kubernetes/fake"
+
+	"github.com/skyhook-io/radar/internal/k8s"
+	"github.com/skyhook-io/radar/pkg/issuesapi"
+)
+
+// restartLoopTick is one poll of a Deployment whose single pod is in a restart
+// loop: the pod's container state, the Deployment's availability, and the
+// kubelet events visible at that moment.
+type restartLoopTick struct {
+	name   string
+	status corev1.ContainerStatus
+	ready  bool
+	events []*corev1.Event
+}
+
+// composeRestartLoopTick runs one tick through the real detector and composer
+// and returns the grouped issues plus the raw detections.
+func composeRestartLoopTick(t *testing.T, now time.Time, tick restartLoopTick) ([]Issue, []k8s.Detection) {
+	t.Helper()
+	k8s.ResetTestState()
+	controller := true
+	replicas := int32(1)
+	available, unavailable := int32(0), int32(1)
+	podReady := corev1.ConditionFalse
+	if tick.ready {
+		available, unavailable = 1, 0
+		podReady = corev1.ConditionTrue
+	}
+	created := metav1.NewTime(now.Add(-48 * time.Hour))
+	objs := []runtime.Object{
+		&appsv1.Deployment{
+			ObjectMeta: metav1.ObjectMeta{Name: "gateway", Namespace: "knative", CreationTimestamp: created},
+			Spec:       appsv1.DeploymentSpec{Replicas: &replicas},
+			Status: appsv1.DeploymentStatus{
+				Replicas:            1,
+				UpdatedReplicas:     1,
+				ReadyReplicas:       available,
+				AvailableReplicas:   available,
+				UnavailableReplicas: unavailable,
+			},
+		},
+		&appsv1.ReplicaSet{ObjectMeta: metav1.ObjectMeta{
+			Name:              "gateway-rs",
+			Namespace:         "knative",
+			CreationTimestamp: created,
+			OwnerReferences:   []metav1.OwnerReference{{APIVersion: "apps/v1", Kind: "Deployment", Name: "gateway", Controller: &controller}},
+		}},
+		&corev1.Pod{
+			ObjectMeta: metav1.ObjectMeta{
+				Name:              "gateway-abc",
+				Namespace:         "knative",
+				CreationTimestamp: created,
+				OwnerReferences:   []metav1.OwnerReference{{APIVersion: "apps/v1", Kind: "ReplicaSet", Name: "gateway-rs", Controller: &controller}},
+			},
+			Spec: corev1.PodSpec{Containers: []corev1.Container{{
+				Name:           "gateway",
+				LivenessProbe:  &corev1.Probe{},
+				ReadinessProbe: &corev1.Probe{},
+			}}},
+			Status: corev1.PodStatus{
+				Phase: corev1.PodRunning,
+				Conditions: []corev1.PodCondition{
+					{Type: corev1.PodReady, Status: podReady, LastTransitionTime: metav1.NewTime(now.Add(-6 * time.Minute))},
+					{Type: corev1.ContainersReady, Status: podReady, LastTransitionTime: metav1.NewTime(now.Add(-6 * time.Minute))},
+				},
+				ContainerStatuses: []corev1.ContainerStatus{tick.status},
+			},
+		},
+	}
+	for _, e := range tick.events {
+		objs = append(objs, e)
+	}
+	if err := k8s.InitTestResourceCache(fake.NewClientset(objs...)); err != nil {
+		t.Fatalf("%s: InitTestResourceCache: %v", tick.name, err)
+	}
+	provider := &CacheProvider{cache: k8s.GetResourceCache()}
+	var detections []k8s.Detection
+	deadline := time.Now().Add(2 * time.Second)
+	for time.Now().Before(deadline) {
+		detections = provider.DetectProblems([]string{"knative"})
+		if hasDetection(detections, "Pod", "gateway-abc") || tick.ready {
+			break
+		}
+		time.Sleep(20 * time.Millisecond)
+	}
+	return Compose(provider, Filters{Namespaces: []string{"knative"}, Grouped: true, Limit: NoLimit}), detections
+}
+
+func hasDetection(ds []k8s.Detection, kind, name string) bool {
+	for _, d := range ds {
+		if d.Kind == kind && d.Name == name {
+			return true
+		}
+	}
+	return false
+}
+
+func probeEvent(name, probe string, at time.Time) *corev1.Event {
+	return &corev1.Event{
+		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "knative"},
+		InvolvedObject: corev1.ObjectReference{
+			Kind: "Pod", Namespace: "knative", Name: "gateway-abc",
+			FieldPath: "spec.containers{gateway}",
+		},
+		Type:          corev1.EventTypeWarning,
+		Reason:        "Unhealthy",
+		Message:       probe + " probe failed: HTTP probe failed with statuscode: 503",
+		LastTimestamp: metav1.NewTime(at),
+	}
+}
+
+// TestCompose_RestartLoopKeepsOneIssueAcrossTheCycle walks a liveness-driven
+// restart loop (graceful exit 0, the kourier-gateway pattern seen in
+// production) through every state the kubelet reports during one cycle. Each
+// state alone looks like a different problem (crash backoff, readiness,
+// liveness, a degraded Deployment, or a healthy pod); across all of them the
+// loop must stay one critical crashloop issue with one id.
+func TestCompose_RestartLoopKeepsOneIssueAcrossTheCycle(t *testing.T) {
+	defer k8s.ResetTestState()
+	now := time.Now()
+	at := func(ago time.Duration) metav1.Time { return metav1.NewTime(now.Add(-ago)) }
+	completed := func(ago time.Duration) *corev1.ContainerStateTerminated {
+		return &corev1.ContainerS
```

**File**: `internal/k8s/detect.go` (modified, +118/-11)
```diff
@@ -23,6 +23,7 @@ import (
 	"k8s.io/apimachinery/pkg/util/intstr"
 
 	"github.com/skyhook-io/radar/pkg/health"
+	"github.com/skyhook-io/radar/pkg/issuesapi"
 	"github.com/skyhook-io/radar/pkg/k8score"
 )
 
@@ -43,6 +44,10 @@ const ScaledToZeroReason = "Backing workload scaled to 0"
 
 const livenessProbeFailedReason = "LivenessProbeFailed"
 
+// startupProbeFailedReason is evidence only: a failed startup probe restarts
+// the container like a liveness failure, but it never becomes a row reason.
+const startupProbeFailedReason = "StartupProbeFailed"
+
 // Core ConfigMaps and Secrets have no kind-specific graceful termination phase.
 // Once deletion starts, a remaining finalizer is the only thing keeping the
 // object present, so delayed cleanup is actionable sooner than workload drain.
@@ -103,6 +108,9 @@ type Detection struct {
 	// mean either non-Pod problem or no crash data on this Pod yet.
 	RestartCount         int32
 	LastTerminatedReason string
+	// RestartLoop is set on a Pod crashloop row emitted because a container is
+	// in an active restart loop (see activeRestartLoop). Nil otherwise.
+	RestartLoop *issuesapi.RestartLoop
 	// OwnerKind + OwnerName name the topmost stable controller of a Pod
 	// problem (Pod→Deployment, not the intermediate ReplicaSet), resolved
 	// via topOwnerForPod when the Pod is detected. Empty for non-Pod and
@@ -447,7 +455,8 @@ func DetectProblems(cache *ResourceCache, namespace string) []Detection {
 		}
 	}
 
-	probeFailures := latestProbeFailures(cache, namespace, now)
+	probeFailures, containerProbeFailures := latestProbeFailures(cache, namespace, now)
+	var loopRows []loopRow
 	pvcPendingFailures := latestPVCPendingFailures(cache, namespace)
 
 	// Pod problems: high-signal container waiting/terminated states, old
@@ -461,7 +470,10 @@ func DetectProblems(cache *ResourceCache, namespace string) []Detection {
 			}
 			healthStr := health.Pod(pod, now).LegacyString()
 			earlyProbeTargetProblem, hasEarlyProbeTargetProblem := activeProbeTargetProblem(pod, "")
-			if healthStr == "healthy" && !hasEarlyProbeTargetProblem {
+			// A restart loop keeps its row through the ticks where the pod
+			// looks healthy between crashes; see restart_loop.go.
+			loop, looping := activeRestartLoop(pod, containerProbeFailures, now)
+			if healthStr == "healthy" && !hasEarlyProbeTargetProblem && !looping {
 				continue
 			}
 			// Unschedulable pods are owned by the scheduling source, which
@@ -482,6 +494,29 @@ func DetectProblems(cache *ResourceCache, namespace string) []Detection {
 				reason = pf.reason
 				message = pf.message
 			}
+			// Every per-tick face of a restart loop (crash backoff, a bare
+			// phase, probe failures, high restarts) becomes the one crashloop
+			// row, so the issue id holds for the whole loop. Specific reasons
+			// (image pulls, create errors) and an active OOM keep their own
+			// paths. Applied before the structural checks below so an invalid
+			// probe target still wins on every tick, not only on some.
+			loopActive := looping
+			// An OOM loop replaces the OOM reason too: the row keeps the
+			// crashloop reason and classifies as oom_killed through the loop
+			// container's OOMKilled termination. Another container's active
+			// OOM still owns the row.
+			oomLoop := looping && loop.lastReason == "OOMKilled"
+			oomVeto := health.PodHasActiveOOMKilled(pod, now)
+			if oomLoop {
+				oomVeto = otherContainerActiveOOM(pod, loop.container, now)
+			}
+			if looping && (restartLoopMayReplace(reason) || (oomLoop && reason == "OOMKilled")) && !oomVeto {
+				reason = crashLoopReason
+				message = loop.message()
+			} else {
+				looping = false
+			}
+			rawMessage := ""
 			fingerprint := ""
 			if inv, ok := activeProbeTargetProblem(pod, reason); ok {
 				reason = inv.reason
@@ -491,14 +526,41 @@ func DetectProblems(cache *ResourceCache, namespace string) []Detection {
 				reason = earlyProbeTargetProblem.reason
 				message = earlyProbeTargetProblem.message
 				fingerprint = earlyProbeTargetProblem.fingerprint
-			} else if init, ok := stalledInitContainerProblem(pod, now); ok {
+			} else if init, ok := stalledInitContainerProblem(pod, now, loopingInitContainer(loop, looping)); ok {
 				reason = init.reason
 				message = init.message
 				fingerprint = init.fingerprint
 			}
-			cause, action, diagnosisSource := oomLimitDiagnosis(cache, pod, reason, lastTermReason, now)
+			// Severity is pinned for the loop (set by setLoopSeverities once
+			// every pod has been seen): serving or down at this instant is a
+			// per-tick fact, and letting it move the severity would drop the
+			// issue out of severity-filtered alerts and bring it back on every
+			// cycle. A structural root (an invalid probe target) that wins the
+			// row during a loop is pinned the same way.
+			pinLoopSeverity := loopActive && (fingerprint != "" || (looping && reason == crashLoopReason))
+			// Rows pinned for a loop carry its evidence, including a
+
```

**File**: `internal/k8s/detect_crashloop_severity_test.go` (modified, +3/-1)
```diff
@@ -152,7 +152,9 @@ func TestDetectProblems_CrashLoopSeverityTracksCurrentState(t *testing.T) {
 	if !strings.Contains(recovered.Action, "Watch for another restart") {
 		t.Fatalf("recovered startup action = %q, want repeat-crash guidance", recovered.Action)
 	}
-	assertProblem(t, problems, "Pod", "high-count-serving", "CrashLoopBackOff", "high")
+	// Past the restart-loop threshold, serving at this instant no longer
+	// lowers severity: the loop keeps one critical row through its ready ticks.
+	assertProblem(t, problems, "Pod", "high-count-serving", "CrashLoopBackOff", "critical")
 	assertProblem(t, problems, "Pod", "down-at-creation", "CrashLoopBackOff", "critical")
 	assertProblem(t, problems, "Pod", "runtime-down", "CrashLoopBackOff", "critical")
 	assertProblem(t, problems, "Pod", "image-pull-sibling", "ImagePullBackOff", "critical")
```

---

### Incident Patch 2: `3102ae76` (2026-10-03)
**Commit Message**: fix(logs): default log viewer palette to the app theme (#1871)

## Description

The logs panel always opened dark, and in dark app theme the web app
passed `forceDark`, which also hid the Sun/Moon toggle (as described in
#1790).

This adds a `defaultDark` prop to `LogCore` / `LogsViewer` /
`WorkloadLogsViewer`: the palette the viewer starts with when the user
hasn't picked one. Unlike `forceDark`, it leaves the toggle visible.

In the web app:

- **Light theme:** logs start light, and the toggle can switch them to
dark. That choice is saved in `radar-logs-dark` and wins from then on.
- **Dark theme:** logs stay dark and the toggle is hidden (`forceDark`,
as before). Light logs on a dark app are never what anyone wants, so
dark theme doesn't offer them.
- When the app switches from dark to light, the viewer goes back to the
user's saved choice, or light if there isn't one.

`forceDark` works the same for other consumers of `@skyhook-io/k8s-ui`;
with no hint the default stays dark.

_Maintainer update: dark theme keeps logs pinned dark (product call),
and the viewer re-reads the saved choice when that pin lifts._

## Type of change

- [x] Bug fix (non-breaking change that fixes an is

**File**: `packages/k8s-ui/src/components/logs/LogCore.theme.test.tsx` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+// @vitest-environment jsdom
+import { act } from 'react'
+import { createRoot, type Root } from 'react-dom/client'
+import { afterEach, beforeEach, describe, expect, it } from 'vitest'
+import { LogCore } from './LogCore'
+
+Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
+
+let root: Root
+let element: HTMLDivElement
+beforeEach(() => {
+  localStorage.clear()
+  element = document.createElement('div')
+  document.body.appendChild(element)
+  root = createRoot(element)
+})
+afterEach(async () => {
+  await act(async () => root.unmount())
+  element.remove()
+})
+
+const noop = () => {}
+async function render(props: { forceDark?: boolean; defaultDark?: boolean }) {
+  await act(async () =>
+    root.render(
+      <LogCore
+        entries={[]}
+        isLoading={false}
+        isStreaming={false}
+        onStopStream={noop}
+        onRefresh={noop}
+        onDownload={noop}
+        {...props}
+      />,
+    ),
+  )
+}
+const toggle = () => element.querySelector<HTMLButtonElement>('button[aria-label^="Switch log viewer"]')
+
+describe('LogCore theme', () => {
+  it('defaults to dark when no theme hint is given', async () => {
+    await render({})
+    expect(toggle()?.getAttribute('aria-label')).toBe('Switch log viewer to light mode')
+  })
+
+  it('follows defaultDark and keeps the toggle available', async () => {
+    await render({ defaultDark: false })
+    expect(toggle()?.getAttribute('aria-label')).toBe('Switch log viewer to dark mode')
+    await render({ defaultDark: true })
+    expect(toggle()?.getAttribute('aria-label')).toBe('Switch log viewer to light mode')
+  })
+
+  it('prefers the saved toggle choice over defaultDark', async () => {
+    localStorage.setItem('radar-logs-dark', 'true')
+    await render({ defaultDark: false })
+    expect(toggle()?.getAttribute('aria-label')).toBe('Switch log viewer to light mode')
+  })
+
+  it('returns to the saved choice when a forceDark pin is lifted', async () => {
+    localStorage.setItem('radar-logs-dark', 'false')
+    await render({ forceDark: true, defaultDark: false })
+    expect(toggle()).toBeNull()
+    await render({ defaultDark: false })
+    expect(toggle()?.getAttribute('aria-label')).toBe('Switch log viewer to dark mode')
+  })
+
+  it('ignores a saved value that is not a palette choice', async () => {
+    localStorage.setItem('radar-logs-dark', 'garbage')
+    await render({ defaultDark: false })
+    expect(toggle()?.getAttribute('aria-label')).toBe('Switch log viewer to dark mode')
+  })
+
+  it('hides the toggle when forceDark is set', async () => {
+    await render({ forceDark: true, defaultDark: false })
+    expect(toggle()).toBeNull()
+  })
+})
```

**File**: `packages/k8s-ui/src/components/logs/LogCore.tsx` (modified, +23/-2)
```diff
@@ -67,6 +67,12 @@ interface LogCoreProps {
    * the viewer manages its own palette via localStorage and the Sun/Moon button.
    */
   forceDark?: boolean
+  /**
+   * Palette to use when the user hasn't picked one with the Sun/Moon toggle
+   * (e.g. the host app's theme). Unlike `forceDark`, the toggle stays visible.
+   * Defaults to dark.
+   */
+  defaultDark?: boolean
 }
 
 interface LevelOption {
@@ -143,12 +149,14 @@ export function LogCore({
   emptyCommand,
   errorMessage,
   forceDark,
+  defaultDark = true,
 }: LogCoreProps) {
   const virtuosoRef = useRef<VirtuosoHandle>(null)
   const [atBottom, setAtBottom] = useState(true)
   const themeLocked = typeof forceDark === 'boolean'
   // Seed isDark: forceDark prop wins; else localStorage['radar-logs-dark'];
-  // else default dark. See log-palette.ts for why the viewer is palette-driven
+  // else defaultDark (the host app's theme, dark if not given). See
+  // log-palette.ts for why the viewer is palette-driven
   // instead of theme-token-driven.
   const [isDark, setIsDark] = useState<boolean>(() => {
     if (typeof forceDark === 'boolean') return forceDark
@@ -157,13 +165,26 @@ export function LogCore({
       if (v === 'false') return false
       if (v === 'true') return true
     } catch {}
-    return true
+    return defaultDark
   })
   useEffect(() => {
     if (typeof forceDark === 'boolean') {
       setIsDark(forceDark)
     }
   }, [forceDark])
+  // Re-resolve whenever the host's hint changes, including when a forceDark pin
+  // is lifted: the user's saved pick wins, otherwise the host default.
+  useEffect(() => {
+    if (typeof forceDark === 'boolean') return
+    try {
+      const v = localStorage.getItem('radar-logs-dark')
+      if (v === 'true' || v === 'false') {
+        setIsDark(v === 'true')
+        return
+      }
+    } catch {}
+    setIsDark(defaultDark)
+  }, [defaultDark, forceDark])
   const palette = useMemo(() => getLogPalette(isDark), [isDark])
   const toggleDark = useCallback(() => {
     if (themeLocked) return
```

**File**: `packages/k8s-ui/src/components/logs/LogsViewer.tsx` (modified, +5/-1)
```diff
@@ -28,8 +28,10 @@ export interface LogsViewerProps {
   createStream?: (params: Omit<LogsFetchParams, 'previous'>) => EventSource
   /** Override the download mechanism (e.g. for desktop apps where blob URLs fail). */
   overrideDownload?: (content: string, mime: string, filename: string) => void
-  /** Force dark mode on the logs container (default: true) */
+  /** Pin the logs container to dark (true) or light (false) and hide the toggle */
   forceDark?: boolean
+  /** Palette used until the user toggles it, e.g. the app theme (default: true) */
+  defaultDark?: boolean
   /**
    * Open the stream automatically on mount (and on container switch) instead of
    * loading a static snapshot. The user can still Stop, and a manual Stop is not
@@ -47,6 +49,7 @@ export function LogsViewer({
   createStream,
   overrideDownload,
   forceDark,
+  defaultDark,
   autoStream = false,
 }: LogsViewerProps) {
   const [selectedContainer, setSelectedContainer] = useState(initialContainer || containers[0] || '')
@@ -190,6 +193,7 @@ export function LogsViewer({
       onClear={clear}
       toolbarExtra={renderToolbarExtra}
       forceDark={forceDark}
+      defaultDark={defaultDark}
     />
   )
 }
```

**File**: `packages/k8s-ui/src/components/logs/WorkloadLogsViewer.tsx` (modified, +5/-2)
```diff
@@ -53,8 +53,10 @@ export interface WorkloadLogsViewerProps {
   createStream?: (params: WorkloadLogsFetchParams) => EventSource
   /** Override the download mechanism (e.g. for desktop apps where blob URLs fail). */
   overrideDownload?: (content: string, mime: string, filename: string) => void
-  /** Force dark mode on the logs container (default: true) */
+  /** Pin the logs container to dark (true) or light (false) and hide the toggle */
   forceDark?: boolean
+  /** Palette used until the user toggles it, e.g. the app theme (default: true) */
+  defaultDark?: boolean
   /**
    * Open the stream automatically on mount (and on container switch) instead of
    * loading a static snapshot. The user can still Stop, and a manual Stop is not
@@ -63,7 +65,7 @@ export interface WorkloadLogsViewerProps {
   autoStream?: boolean
 }
 
-export function WorkloadLogsViewer({ name, fetchAll, createStream, overrideDownload, forceDark, autoStream = false }: WorkloadLogsViewerProps) {
+export function WorkloadLogsViewer({ name, fetchAll, createStream, overrideDownload, forceDark, defaultDark, autoStream = false }: WorkloadLogsViewerProps) {
   const [selectedContainer, setSelectedContainer] = useState<string>('')
   const [pods, setPods] = useState<WorkloadPodInfo[]>([])
   const [selectedPods, setSelectedPods] = useState<Set<string>>(new Set())
@@ -400,6 +402,7 @@ export function WorkloadLogsViewer({ name, fetchAll, createStream, overrideDownl
       emptyCommand={emptyCommand}
       errorMessage={entries.length === 0 ? fetchError || streamError : null}
       forceDark={forceDark}
+      defaultDark={defaultDark}
     /></div></div>
   )
 }
```

**File**: `web/src/components/logs/LogsViewer.tsx` (modified, +3/-0)
```diff
@@ -43,7 +43,10 @@ export function LogsViewer({ namespace, podName, containers, initialContainer, a
       fetchLogs={fetchLogs}
       createStream={makeStream}
       overrideDownload={desktopDownload}
+      // Light logs on a dark app are never wanted: dark theme pins the palette,
+      // light theme only sets where it starts and leaves the toggle available.
       forceDark={theme === 'dark' ? true : undefined}
+      defaultDark={false}
       autoStream={autoStream}
     />
   )
```

**File**: `web/src/components/logs/WorkloadLogsViewer.tsx` (modified, +3/-0)
```diff
@@ -42,7 +42,10 @@ export function WorkloadLogsViewer({ kind, namespace, name, autoStream = true, s
       fetchAll={fetchAll}
       createStream={snapshotOnly ? undefined : makeStream}
       overrideDownload={desktopDownload}
+      // Light logs on a dark app are never wanted: dark theme pins the palette,
+      // light theme only sets where it starts and leaves the toggle available.
       forceDark={theme === 'dark' ? true : undefined}
+      defaultDark={false}
       autoStream={autoStream}
     />
   )
```

---

### Incident Patch 3: `0e3c2941` (2026-10-02)
**Commit Message**: fix(timeline): avoid NULs in condition diffs (#1958)

## Description

Generic resource and SealedSecret condition diffs join status and reason
with a raw NUL. When the PostgreSQL timeline store writes the diff to
`diff_json` (`jsonb`), even an ordinary `False/Pending` → `True/Ready`
transition fails with SQLSTATE `22P05` (`unsupported Unicode escape
sequence`), rolling back the append batch. This is reproducible on
PostgreSQL 18.6.

Quote each component and join them with a colon, producing values such
as `"False":"Pending"` and `"True":"Ready"`. This keeps distinct
status/reason pairs distinguishable, including delimiter and escape
characters. Update the Karpenter activity decoder to read this encoding
while retaining support for existing NUL-delimited SQLite history. CI
runs the condition-to-PostgreSQL round-trip test alongside the existing
storage tests.

## Type of change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to change)
- [ ] Documentation update

## How has this been tested?

With Go 1.26.5:

- `go test ./...`, with `R

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ jobs:
           # it, losing the service or the env block above would leave the whole
           # PostgreSQL backend untested while this job still reported green.
           RADAR_REQUIRE_POSTGRES_TESTS: "1"
-        run: go test ./internal/timeline
+        run: go test ./internal/timeline ./internal/k8s
 
       - name: Build
         run: go build -o explorer ./cmd/explorer
```

**File**: `internal/capacity/activity.go` (modified, +27/-2)
```diff
@@ -383,7 +383,7 @@ func classifyNodeClaimConditionChange(event timeline.TimelineEvent) (activityCla
 		if !ok {
 			continue
 		}
-		status, reason, _ := strings.Cut(signal, "\x00")
+		status, reason := splitConditionSignal(signal)
 		if conditionType == "Ready" && status == "True" {
 			return directActivity(capacityapi.ActivityProvision, capacityapi.ActivityCompleted, "nodeclaim_ready"), true
 		}
@@ -410,14 +410,39 @@ func classifyNodeClaimConditionChange(event timeline.TimelineEvent) (activityCla
 		if !ok {
 			continue
 		}
-		status, reason, _ := strings.Cut(signal, "\x00")
+		status, reason := splitConditionSignal(signal)
 		if (status == string(metav1.ConditionFalse) || status == string(metav1.ConditionUnknown)) && karpenter.IsFailureReason(reason) {
 			return directActivity(capacityapi.ActivityProvision, capacityapi.ActivityFailed, "nodeclaim_not_ready"), true
 		}
 	}
 	return activityClassification{}, false
 }
 
+func splitConditionSignal(signal string) (string, string) {
+	// SQLite history can still contain the NUL-delimited encoding.
+	status, reason, legacy := strings.Cut(signal, "\x00")
+	if legacy || !strings.HasPrefix(signal, `"`) {
+		return status, reason
+	}
+	quotedStatus, err := strconv.QuotedPrefix(signal)
+	if err != nil {
+		return "", ""
+	}
+	quotedReason, found := strings.CutPrefix(signal[len(quotedStatus):], ":")
+	if !found {
+		return "", ""
+	}
+	status, err = strconv.Unquote(quotedStatus)
+	if err != nil {
+		return "", ""
+	}
+	reason, err = strconv.Unquote(quotedReason)
+	if err != nil {
+		return "", ""
+	}
+	return status, reason
+}
+
 // karpenterEventClassifications maps exact event reasons Karpenter emits to
 // their real meaning. Exact matches are direct/high-confidence evidence; the
 // substring fallback below stays inferred/low. Without this table,
```

**File**: `internal/k8s/history.go` (modified, +2/-1)
```diff
@@ -301,7 +301,8 @@ func genericConditionSignalMap(obj map[string]any, fields ...string) map[string]
 		}
 		status, _ := cond["status"].(string)
 		reason, _ := cond["reason"].(string)
-		out[typ] = status + "\x00" + reason
+		// Quote both components to avoid delimiter collisions and NULs in jsonb.
+		out[typ] = fmt.Sprintf("%q:%q", status, reason)
 	}
 	return out
 }
```

**File**: `internal/k8s/history_condition_activity_test.go` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+package k8s
+
+import (
+	"testing"
+	"time"
+
+	"github.com/skyhook-io/radar/internal/capacity"
+	"github.com/skyhook-io/radar/pkg/capacityapi"
+	"github.com/skyhook-io/radar/pkg/timeline"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+)
+
+func TestComputeDiff_ConditionCapacityActivity(t *testing.T) {
+	nodeClaim := func(conditions [][3]string) *unstructured.Unstructured {
+		var items []any
+		for _, condition := range conditions {
+			items = append(items, map[string]any{
+				"type": condition[0], "status": condition[1], "reason": condition[2],
+			})
+		}
+		return &unstructured.Unstructured{Object: map[string]any{
+			"apiVersion": "karpenter.sh/v1", "kind": "NodeClaim",
+			"status": map[string]any{"conditions": items},
+		}}
+	}
+	tests := []struct {
+		name       string
+		conditions [][3]string
+		wantType   capacityapi.ActivityType
+		wantState  capacityapi.ActivityState
+		wantReason string
+	}{
+		{"ready", [][3]string{{"Ready", "True", "Ready"}}, capacityapi.ActivityProvision, capacityapi.ActivityCompleted, "nodeclaim_ready"},
+		{"launch failure", [][3]string{{"Launched", "Unknown", "InsufficientInstanceCapacity"}}, capacityapi.ActivityLaunchFailure, capacityapi.ActivityFailed, "launch_failed"},
+		{"registration failure", [][3]string{{"Registered", "Unknown", "RegistrationFailed"}}, capacityapi.ActivityRegistrationFailure, capacityapi.ActivityFailed, "registration_failed"},
+		{"initialization failure", [][3]string{{"Initialized", "Unknown", "InitializationFailed"}}, capacityapi.ActivityInitializationFailure, capacityapi.ActivityFailed, "initialization_failed"},
+		{"ready failure", [][3]string{{"Ready", "Unknown", "LaunchFailed"}}, capacityapi.ActivityProvision, capacityapi.ActivityFailed, "nodeclaim_not_ready"},
+		{"still provisioning", [][3]string{{"Ready", "False", "NotInitialized"}}, "", "", ""},
+		{"specific stage wins", [][3]string{{"Ready", "Unknown", "RegistrationFailed"}, {"Registered", "Unknown", "RegistrationFailed"}}, capacityapi.ActivityRegistrationFailure, capacityapi.ActivityFailed, "registration_failed"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			diff := ComputeDiffFromUnstructured("NodeClaim",
+				nodeClaim([][3]string{{"Ready", "False", "Pending"}}), nodeClaim(tt.conditions))
+			if diff == nil {
+				t.Fatal("condition update produced no diff")
+			}
+			records := capacity.BuildActivityRecords([]timeline.TimelineEvent{{
+				ID: "condition-update", Seq: 1, Timestamp: time.Now().UTC(), Source: timeline.SourceInformer,
+				Kind: "NodeClaim", APIVersion: "karpenter.sh/v1", Name: "claim", UID: "claim-uid",
+				EventType: timeline.EventTypeUpdate, Diff: diff,
+			}})
+			if tt.wantType == "" {
+				if len(records) != 0 {
+					t.Fatalf("non-failure condition produced activity: %+v", records)
+				}
+				return
+			}
+			if len(records) != 1 {
+				t.Fatalf("condition produced %d activities, want 1: %+v", len(records), records)
+			}
+			got := records[0].Episode
+			if got.Type != tt.wantType || got.State != tt.wantState || got.PrimaryReasonCode != tt.wantReason {
+				t.Fatalf("condition activity = %s/%s/%s, want %s/%s/%s",
+					got.Type, got.State, got.PrimaryReasonCode, tt.wantType, tt.wantState, tt.wantReason)
+			}
+		})
+	}
+}
```

**File**: `internal/k8s/history_condition_encoding_test.go` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+package k8s
+
+import (
+	"strings"
+	"testing"
+
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+)
+
+func conditionEncodingResource(status, reason string) *unstructured.Unstructured {
+	return &unstructured.Unstructured{Object: map[string]any{
+		"apiVersion": "example.com/v1",
+		"kind":       "Widget",
+		"status": map[string]any{"conditions": []any{map[string]any{
+			"type": "Ready", "status": status, "reason": reason,
+		}}},
+	}}
+}
+
+func TestComputeDiff_ConditionSignalEncoding(t *testing.T) {
+	tests := []struct {
+		name string
+		old  [2]string
+		new  [2]string
+	}{
+		{"unchanged", [2]string{"True", "Ready"}, [2]string{"True", "Ready"}},
+		{"status change", [2]string{"False", "Ready"}, [2]string{"True", "Ready"}},
+		{"reason change", [2]string{"True", "Waiting"}, [2]string{"True", "Ready"}},
+		{"NUL separator collision", [2]string{"a\x00b", "c"}, [2]string{"a", "b\x00c"}},
+		{"colon separator collision", [2]string{"a:b", "c"}, [2]string{"a", "b:c"}},
+		{"quote separator collision", [2]string{"a\":\"b", "c"}, [2]string{"a", "b\":\"c"}},
+		{"escaped NUL collision", [2]string{"True", "\x00"}, [2]string{"True", `\x00`}},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			oldU := conditionEncodingResource(tt.old[0], tt.old[1])
+			newU := conditionEncodingResource(tt.new[0], tt.new[1])
+			for _, obj := range []*unstructured.Unstructured{oldU, newU} {
+				signal := genericConditionSignalMap(obj.Object, "status", "conditions")["Ready"]
+				if strings.ContainsRune(signal, '\x00') {
+					t.Fatalf("condition signal contains a PostgreSQL-incompatible NUL: %q", signal)
+				}
+			}
+			diff := ComputeDiffFromUnstructured("Widget", oldU, newU)
+			if tt.old == tt.new {
+				if diff != nil {
+					t.Fatalf("unchanged condition produced a diff: %+v", diff)
+				}
+				return
+			}
+			if diff == nil || len(diff.Fields) != 1 || diff.Fields[0].Path != "status.conditions[Ready]" {
+				t.Fatalf("changed condition did not produce one condition field: %+v", diff)
+			}
+			if diff.Fields[0].OldValue == diff.Fields[0].NewValue {
+				t.Fatalf("distinct condition pairs encoded identically: %+v", diff.Fields[0])
+			}
+		})
+	}
+}
```

**File**: `internal/k8s/history_condition_postgres_test.go` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+package k8s
+
+import (
+	"context"
+	"database/sql"
+	"fmt"
+	"net/url"
+	"os"
+	"reflect"
+	"testing"
+	"time"
+
+	"github.com/skyhook-io/radar/internal/timeline"
+)
+
+func TestComputeDiff_ConditionPostgresRoundTrip(t *testing.T) {
+	baseDSN := os.Getenv("RADAR_TEST_POSTGRES_DSN")
+	if baseDSN == "" {
+		t.Skip("RADAR_TEST_POSTGRES_DSN is not set")
+	}
+	admin, err := sql.Open("pgx", baseDSN)
+	if err != nil {
+		t.Fatalf("open PostgreSQL test database: %v", err)
+	}
+	t.Cleanup(func() {
+		if err := admin.Close(); err != nil {
+			t.Errorf("close PostgreSQL test database: %v", err)
+		}
+	})
+	schema := fmt.Sprintf("radar_condition_test_%d", time.Now().UnixNano())
+	if _, err := admin.ExecContext(t.Context(), "CREATE SCHEMA "+schema); err != nil {
+		t.Fatalf("create PostgreSQL test schema: %v", err)
+	}
+	t.Cleanup(func() {
+		if _, err := admin.ExecContext(context.Background(), "DROP SCHEMA "+schema+" CASCADE"); err != nil {
+			t.Errorf("drop PostgreSQL test schema: %v", err)
+		}
+	})
+	parsed, err := url.Parse(baseDSN)
+	if err != nil {
+		t.Fatalf("parse RADAR_TEST_POSTGRES_DSN: %v", err)
+	}
+	query := parsed.Query()
+	query.Set("search_path", schema)
+	parsed.RawQuery = query.Encode()
+	store, err := timeline.NewPostgresStore(parsed.String())
+	if err != nil {
+		t.Fatalf("NewPostgresStore: %v", err)
+	}
+	t.Cleanup(func() {
+		if err := store.Close(); err != nil {
+			t.Errorf("Close: %v", err)
+		}
+	})
+
+	var events []timeline.TimelineEvent
+	for i, reasons := range [][2]string{
+		{"Pending", "Ready"},
+		{`Waiting: "update"`, `Ready: "updated"`},
+		{"\x00", `\x00`},
+	} {
+		diff := ComputeDiffFromUnstructured("Widget",
+			conditionEncodingResource("False", reasons[0]),
+			conditionEncodingResource("True", reasons[1]))
+		if diff == nil || len(diff.Fields) != 1 || diff.Fields[0].Path != "status.conditions[Ready]" {
+			t.Fatalf("condition diff = %+v, want one condition field", diff)
+		}
+		events = append(events, timeline.TimelineEvent{
+			ID: fmt.Sprintf("condition-%d", i), Timestamp: time.Now().UTC(),
+			Source: timeline.SourceInformer, EventType: timeline.EventTypeUpdate,
+			Kind: "Widget", APIVersion: "example.com/v1", Namespace: "default", Name: "widget",
+			Diff: diff,
+		})
+	}
+	if err := store.AppendBatch(t.Context(), events); err != nil {
+		t.Fatalf("AppendBatch condition diffs: %v", err)
+	}
+	for _, want := range events {
+		got, err := store.GetEvent(t.Context(), want.ID)
+		if err != nil || got == nil {
+			t.Fatalf("GetEvent(%q): %v %+v", want.ID, err, got)
+		}
+		if !reflect.DeepEqual(got.Diff, want.Diff) {
+			t.Errorf("GetEvent(%q) diff = %+v, want %+v", want.ID, got.Diff, want.Diff)
+		}
+	}
+}
```

---

### Incident Patch 4: `2407abcb` (2026-10-01)
**Commit Message**: k8s-ui: drop two version-skew API leftovers before 1.16.0 (#1954)

Two leftovers from #1948, removed before k8s-ui 1.16.0 is published so
they don't become public API.

- **`formatRadarVersion`** came off k8s-ui's package index. Its only
caller is `RadarUpgradeNote` (plus its own test), and radar-hub-web
doesn't use it. The module still exports it for the test.
- **`ResourceActionsBar.drainPlanUnsupported`** is removed. Since #1948,
`WorkloadView` passes `drainPlanUpgrade` instead, and radar-hub-web
never set it. The drain dialog's latch drops from two states to one: the
plan counts as unsupported while an upgrade requirement is held, and
closing the dialog clears it.

`drainPlanUnsupported` shipped in k8s-ui 1.15.0, so removing it is
breaking for that package. Radar OSS and Radar Hub are its only
consumers, and neither sets it.

## Verification
- `make tsc` and k8s-ui `tsc` pass.
- k8s-ui `src/components/shared` + `src/components/ui`: 275 tests pass.
Web `npm test`: 1834 pass.
- Drain dialog on an older Radar: unchanged. The latch keeps the
plan-less mode, and the upgrade note shows for as long as the dialog is
open.

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Medium Risk**
> Remo

**File**: `packages/k8s-ui/src/components/shared/ResourceActionsBar.tsx` (modified, +9/-14)
```diff
@@ -144,12 +144,11 @@ interface ResourceActionsBarProps {
   drainPlan?: DrainPlan | null
   isPlanningDrain?: boolean
   drainPlanError?: string | null
-  // The connected backend has no drain-plan endpoint (version skew, e.g. a newer
-  // frontend against an older radar). The dialog falls back to the plan-less
-  // acknowledgement-only mode instead of keeping Drain disabled on a dead request.
-  drainPlanUnsupported?: boolean
-  // The same, with the Radar version that serves drain plans; the plan-less
-  // dialog says so, so the user knows a preview exists.
+  // The connected Radar predates the drain-plan endpoint (a newer frontend
+  // against an older Radar). The dialog falls back to the plan-less
+  // acknowledgement-only mode instead of keeping Drain disabled on a dead
+  // request, and names the Radar version that serves plans so the user knows a
+  // preview exists.
   drainPlanUpgrade?: RadarUpgradeRequirement | null
 }
 
@@ -181,7 +180,7 @@ export function ResourceActionsBar({
   onCordonNode, isCordoningNode,
   onUncordonNode, isUncordoningNode,
   onDrainNode, isDrainingNode,
-  onPlanDrain, onPlanDrainReset, drainPlan, isPlanningDrain, drainPlanError, drainPlanUnsupported, drainPlanUpgrade,
+  onPlanDrain, onPlanDrainReset, drainPlan, isPlanningDrain, drainPlanError, drainPlanUpgrade,
 }: ResourceActionsBarProps) {
   const kind = resource.kind.toLowerCase()
   const coreBatchJob = isCoreBatchJob(kind, resource.group)
@@ -206,18 +205,14 @@ export function ResourceActionsBar({
   // open: the host reports it through a mutation error, which the next request clears,
   // so without latching every option change would refire a request known to 404 and
   // bounce the dialog out of its fallback mode.
-  const [planUnsupported, setPlanUnsupported] = useState(false)
   const [planUpgrade, setPlanUpgrade] = useState<RadarUpgradeRequirement | null>(null)
   useEffect(() => {
-    if (drainPlanUnsupported || drainPlanUpgrade) setPlanUnsupported(true)
     if (drainPlanUpgrade) setPlanUpgrade(drainPlanUpgrade)
-  }, [drainPlanUnsupported, drainPlanUpgrade])
+  }, [drainPlanUpgrade])
   useEffect(() => {
-    if (!showDrainConfirm) {
-      setPlanUnsupported(false)
-      setPlanUpgrade(null)
-    }
+    if (!showDrainConfirm) setPlanUpgrade(null)
   }, [showDrainConfirm])
+  const planUnsupported = planUpgrade !== null
   const planSupported = Boolean(onPlanDrain) && !planUnsupported
 
   // Fetch (and refetch on option changes) the read-only plan while the drain dialog is open.
```

**File**: `packages/k8s-ui/src/components/ui/index.ts` (modified, +0/-1)
```diff
@@ -78,7 +78,6 @@ export {
   RadarUpgradeNote,
   RadarUpgradeAction,
   RadarUpgradeContext,
-  formatRadarVersion,
   radarUpgradeDetail,
   radarUpgradeHeadline,
 } from "./RadarUpgradeNote";
```

---

### Incident Patch 5: `23230763` (2026-10-01)
**Commit Message**: fix(traffic): report what each traffic source measured, not doubled, rounded or missing figures (#1929)

## Description

Radar's Live Traffic view reported figures its sources never measured.
Each bug below was reproduced first: a test that fails against `main`,
and a live kind-cluster repro where one existed.

**Hubble (Cilium)**
- **Reply packets drew reversed edges.** Hubble records both directions
of a connection. Radar ignored `is_reply`, so every reply became a
second, backwards edge (server → client on the client's ephemeral port).
On the Cilium demo, about 285 of 291 edges were replies, and the graph
showed the client "listening" on `:37174` etc. L7 responses put their
status code and latency on that reversed edge instead of the caller's.
Now L3/L4 replies are dropped, and L7 responses are turned around onto
the request's edge. Only an explicit `is_reply=true` is acted on:
Hubble's own reply filter would discard flows whose direction is
unknown, so it is not pushed into the request.
- **A stream cut short, lost events and unreachable nodes looked
complete.** All three are now reported.
- **A relay that is installed but unusable was reported as never
installed.** The cases a

**File**: `internal/server/traffic_handlers.go` (modified, +14/-3)
```diff
@@ -171,14 +171,25 @@ func trafficFlowsPayload(response *traffic.FlowsResponse, flows []traffic.Flow)
 		"timestamp":  response.Timestamp,
 		"flows":      flows,
 		"aggregated": traffic.AggregateFlows(flows),
+		// L7 responses arrive on their request's edge, caller to callee on the
+		// server's port. A client pairing responses with requests needs to know
+		// that rather than guess it from which records happen to be present.
+		"l7ResponsesCallerOriented": true,
+	}
+	// Coverage describes what the source returned, not what this user may see,
+	// so it stays when filtering removes flows: it explains a thin view.
+	if response.CoveredSince != nil {
+		result["coveredSince"] = response.CoveredSince
+		result["nodeFlowLimit"] = response.NodeFlowLimit
 	}
 
 	// A partial-data warning qualifies the flows it came with. If the namespace
 	// filtering above removed all of them, it now qualifies nothing this user can
 	// see — and describing the shape of edges they have no access to is both
-	// confusing and more than they asked. A source that returned no flows in the
-	// first place is different: there the warning is the explanation for the empty
-	// result, which is exactly what it is for.
+	// confusing and more than they asked. An incomplete one stays: it means flows
+	// may be missing, which may be exactly why this user sees none. A source
+	// that returned no flows in the first place is different again: there the
+	// warning is the explanation for the empty result, which is what it is for.
 	filteredEverythingOut := len(flows) == 0 && len(response.Flows) > 0
 	if response.WarningKind == traffic.WarningPartial && filteredEverythingOut {
 		return result
```

**File**: `internal/server/traffic_warning_kind_test.go` (modified, +41/-5)
```diff
@@ -3,6 +3,7 @@ package server
 import (
 	"encoding/json"
 	"testing"
+	"time"
 
 	"github.com/skyhook-io/radar/pkg/traffic"
 )
@@ -72,15 +73,50 @@ func TestTrafficFlowsPayloadDropsPartialWarningWhenFilteringRemovedEverything(t
 		t.Error("an empty result needs its explanation kept")
 	}
 
-	// A transient warning is about the fetch, not about the flows, so filtering
-	// does not affect it.
+	// An incomplete warning means flows may be missing — a node the relay could
+	// not reach — which may be exactly why this user sees none, so filtering
+	// does not remove it.
 	transient := &traffic.FlowsResponse{
-		Source:      "beyla",
+		Source:      "hubble",
 		Flows:       []traffic.Flow{{Source: traffic.Endpoint{Namespace: "other"}}},
+		Warning:     "Traffic data is incomplete: Hubble Relay could not read flows from 1 node(s), so their traffic is missing.",
+		WarningKind: traffic.WarningIncomplete,
+	}
+	if _, ok := trafficFlowsPayload(transient, []traffic.Flow{})["warning"]; !ok {
+		t.Error("a warning that flows may be missing must survive filtering")
+	}
+
+	// A failed fetch returns no flows at all, so nothing was filtered and the
+	// warning is the whole answer.
+	failed := &traffic.FlowsResponse{
+		Source:      "beyla",
+		Flows:       []traffic.Flow{},
 		Warning:     "Failed to query Beyla metrics: connection refused",
 		WarningKind: traffic.WarningTransient,
 	}
-	if _, ok := trafficFlowsPayload(transient, []traffic.Flow{})["warning"]; !ok {
-		t.Error("a transient warning is about the fetch and must survive filtering")
+	if _, ok := trafficFlowsPayload(failed, []traffic.Flow{})["warning"]; !ok {
+		t.Error("a failed fetch must keep its warning")
+	}
+}
+
+// The flow list pairs a response with its request by orientation. It has to be
+// told which orientation this server uses: inferring it from whichever records
+// the window happens to hold lets a response hide an unanswered call.
+func TestTrafficFlowsPayloadDeclaresResponseOrientation(t *testing.T) {
+	payload := trafficFlowsPayload(&traffic.FlowsResponse{Source: "hubble"}, []traffic.Flow{})
+	if payload["l7ResponsesCallerOriented"] != true {
+		t.Errorf("l7ResponsesCallerOriented = %v, want true", payload["l7ResponsesCallerOriented"])
+	}
+}
+
+func TestTrafficFlowsPayloadCarriesCoverage(t *testing.T) {
+	since := time.Now().Add(-90 * time.Second)
+	payload := trafficFlowsPayload(&traffic.FlowsResponse{Source: "hubble", CoveredSince: &since, NodeFlowLimit: 1000,
+		Flows: []traffic.Flow{{Source: traffic.Endpoint{Namespace: "other"}}}}, []traffic.Flow{})
+	if payload["coveredSince"] != &since || payload["nodeFlowLimit"] != 1000 {
+		t.Errorf("coverage = %v / %v, want it kept even when filtering removed every flow", payload["coveredSince"], payload["nodeFlowLimit"])
+	}
+	if _, ok := trafficFlowsPayload(&traffic.FlowsResponse{Source: "hubble"}, nil)["coveredSince"]; ok {
+		t.Error("coveredSince set for a window that was fully covered")
 	}
 }
```

**File**: `internal/traffic/beyla.go` (modified, +39/-12)
```diff
@@ -320,6 +320,10 @@ type l4LabelPresence struct {
 	// long-lived connections keep a stable port and measure fine — so it is
 	// measured rather than assumed from the configuration.
 	replyLossFraction float64
+	// failed names the enrichment queries that errored. Their figures are absent
+	// from the edges, which without a warning reads as measured zero: no errors,
+	// no requests, nothing received.
+	failed []string
 }
 
 func (s *BeylaSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsResponse, error) {
@@ -348,6 +352,13 @@ func (s *BeylaSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsRes
 		// is never coming.
 		response.WarningKind = WarningPartial
 	}
+	if len(presence.failed) > 0 && len(flows) > 0 {
+		failed := fmt.Sprintf("Beyla metrics are incomplete: %s could not be read from Prometheus, so those figures are missing from these edges rather than zero.", strings.Join(presence.failed, ", "))
+		response.Warning = strings.TrimSpace(failed + " " + response.Warning)
+		// About figures on the edges shown, like the attribute warning it may
+		// join: shown beside them, and gone when they are filtered away.
+		response.WarningKind = WarningPartial
+	}
 	return response, nil
 }
 
@@ -434,6 +445,7 @@ func (s *BeylaSource) getFlowsInternal(ctx context.Context, opts FlowOptions) ([
 	if err != nil {
 		log.Printf("[beyla] L7 query failed (continuing with L4 only): %v", err)
 		l7Flows = nil
+		presence.failed = append(presence.failed, "HTTP request rates")
 	}
 
 	// Fill in what came back before anything else reads BytesRecv: the L7 split
@@ -444,7 +456,11 @@ func (s *BeylaSource) getFlowsInternal(ctx context.Context, opts FlowOptions) ([
 	// pair's edges. Where a pair has several edges the total is divided between
 	// them by their share of bytes sent — copying it onto each would count the same
 	// return traffic once per port.
-	received := s.queryReceivedBytes(ctx, opts)
+	received, err := s.queryReceivedBytes(ctx, opts)
+	if err != nil {
+		log.Printf("[beyla] Received-bytes query failed (continuing without them): %v", err)
+		presence.failed = append(presence.failed, "received bytes")
+	}
 	if len(received) > 0 {
 		sentPerPair := make(map[flowKey]int64)
 		edgesPerPair := make(map[flowKey][]*Flow)
@@ -507,7 +523,8 @@ func (s *BeylaSource) getFlowsInternal(ctx context.Context, opts FlowOptions) ([
 	// could not name, in which case no bucket carries that port at all.
 	portedDsts := presence.portedDsts
 
-	latency, errorRates := s.queryL7Detail(ctx, opts)
+	latency, errorRates, detailFailed := s.queryL7Detail(ctx, opts)
+	presence.failed = append(presence.failed, detailFailed...)
 	perPort, perDst := l7ByPortAndDestination(l7Flows)
 	for key, edges := range byDstPort {
 		l7, ok := perPort[key]
@@ -851,7 +868,7 @@ func (s *BeylaSource) replyLossFraction(ctx context.Context, w rateWindow) float
 	return val
 }
 
-func (s *BeylaSource) queryReceivedBytes(ctx context.Context, opts FlowOptions) map[flowKey]int64 {
+func (s *BeylaSource) queryReceivedBytes(ctx context.Context, opts FlowOptions) (map[flowKey]int64, error) {
 	// k8s_*_owner_type belongs in the group-by even though the key ignores it.
 	// Beyla reports a Service-routed conversation twice, once attributed to the
 	// workload and once to the Service, with identical values; without the label
@@ -861,9 +878,12 @@ func (s *BeylaSource) queryReceivedBytes(ctx context.Context, opts FlowOptions)
 	w := beylaWindow(opts.Since)
 	query := beylaRateQuery(groupBy, s.flowMetricName(), opts.Namespace, `, direction="response"`, w)
 	result, err := s.query(ctx, query)
-	if err != nil || result == nil {
+	if err != nil {
 		// Received bytes are an enrichment; without them edges still draw.
-		return nil
+		return nil, err
+	}
+	if result == nil {
+		return nil, nil
 	}
 
 	received := make(map[flowKey]int64, len(result.Series))
@@ -896,7 +916,7 @@ func (s *BeylaSource) queryReceivedBytes(ctx context.Context, opts FlowOptions)
 			received[key] = bytes
 		}
 	}
-	return received
+	return received, nil
 }
 
 // queryUnorientable reads the conversations Beyla reports as direction="unknown"
@@ -1061,12 +1081,18 @@ func serviceEnds(a attribution) int {
 }
 
 // queryL7Detail reads mean latency and 5xx rate per destination and port. Both are
-// enrichments: a failure leaves the fields unset rather than blocking the edges.
-func (s *BeylaSource) queryL7Detail(ctx context.Context, opts FlowOptions) (latency, errors l7Detail) {
-	read := func(query string, combine func(a, b float64) float64) l7Detail {
+// enrichments: a failure leaves the fields unset rather than blocking the edges,
+// and is named in failed so the gap is reported rather than read as zero.
+func (s *BeylaSource) queryL7Detail(ctx context.Context, opts FlowOptions) (latency, errors l7Detail, failed []string) {
+	read := func(query, what string, combine func(a, b float64) float64) l7Detail {
 		out := l7Detail{perPort: map[dstPortKey]float64{}, perDst: map[dstKe
```

**File**: `internal/traffic/beyla_test.go` (modified, +49/-1)
```diff
@@ -1625,7 +1625,7 @@ func TestQueryL7DetailCombinesReplicasOnOnePort(t *testing.T) {
 		return emptyResult(), nil
 	}
 
-	latency, errors := src.queryL7Detail(context.Background(), FlowOptions{})
+	latency, errors, _ := src.queryL7Detail(context.Background(), FlowOptions{})
 	key := dstPortKey{"demo", "web", 80}
 
 	got, ok := errors.perPort[key]
@@ -1803,3 +1803,51 @@ func TestGetFlowsRatesAndScalesOverTheRequestedWindow(t *testing.T) {
 		t.Errorf("bytes must be scaled by the requested window: got %d, want 36000", got)
 	}
 }
+
+func TestBeylaSource_GetFlows_FailedEnrichmentIsReportedNotZeroed(t *testing.T) {
+	isL7Rate := func(q string) bool {
+		return strings.Contains(q, beylaL7Metric) && !strings.Contains(q, "_sum") && !strings.Contains(q, `=~"5.."`)
+	}
+	for _, tc := range []struct {
+		name  string
+		fails func(query string) bool
+		want  string
+	}{
+		{"request rates", isL7Rate, "HTTP request rates"},
+		{"latency", func(q string) bool { return strings.Contains(q, "http_server_request_duration_seconds_sum") }, "HTTP latency"},
+		{"5xx", func(q string) bool { return strings.Contains(q, `http_response_status_code=~"5.."`) }, "HTTP 5xx error rates"},
+		{"received bytes", func(q string) bool { return strings.Contains(q, `direction="response"`) }, "received bytes"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			src := &BeylaSource{k8sClient: fake.NewSimpleClientset()}
+			src.queryFn = func(_ context.Context, query string) (*prom.QueryResult, error) {
+				if tc.fails(query) {
+					return nil, fmt.Errorf("query timed out")
+				}
+				if strings.Contains(query, `direction="unknown"`) {
+					return emptyResult(), nil
+				}
+				if strings.Contains(query, "beyla_network_flow_bytes_total") && !strings.Contains(query, `direction="response"`) {
+					return promResult("vector", promSeries(map[string]string{
+						"k8s_src_owner_name": "frontend", "k8s_src_namespace": "web",
+						"k8s_dst_owner_name": "backend", "k8s_dst_namespace": "api",
+						"dst_port": "8080", "transport": "TCP",
+					}, 10.0)), nil
+				}
+				return emptyResult(), nil
+			}
+
+			resp, err := src.GetFlows(context.Background(), FlowOptions{})
+			if err != nil {
+				t.Fatalf("unexpected error: %v", err)
+			}
+			if len(resp.Flows) != 1 {
+				t.Fatalf("the L4 edge must still be returned, got %d flows", len(resp.Flows))
+			}
+			if !strings.Contains(resp.Warning, tc.want) {
+				t.Errorf("warning = %q, want it to name %q", resp.Warning, tc.want)
+			}
+			assertEq(t, "warningKind", resp.WarningKind, WarningPartial)
+		})
+	}
+}
```

**File**: `internal/traffic/hubble.go` (modified, +247/-50)
```diff
@@ -9,16 +9,17 @@ import (
 	"io"
 	"log"
 	"net"
+	"slices"
 	"strings"
 	"sync"
 	"time"
 
 	flowpb "github.com/cilium/cilium/api/v1/flow"
 	observerpb "github.com/cilium/cilium/api/v1/observer"
+	relaypb "github.com/cilium/cilium/api/v1/relay"
 	"google.golang.org/grpc"
 	"google.golang.org/grpc/credentials"
 	"google.golang.org/grpc/credentials/insecure"
-	"google.golang.org/protobuf/types/known/timestamppb"
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/client-go/kubernetes"
@@ -101,6 +102,10 @@ func (h *HubbleSource) Detect(ctx context.Context) (*DetectionResult, error) {
 		result.Message = "Hubble Relay not found. Install Cilium with Hubble enabled for traffic visibility."
 		return result, nil
 	}
+	// From here on Hubble is installed, so every way this can still fail is a
+	// problem with that install and its message has to reach the user — without
+	// Present it is reported as never installed, with advice to install it.
+	result.Present = true
 
 	// Count running pods and get the namespace
 	var relayNamespace string
@@ -830,7 +835,7 @@ func (h *HubbleSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsRe
 		}, nil
 	}
 
-	flows, err := h.fetchFlowsViaGRPC(ctx, opts)
+	fetched, err := h.fetchFlowsViaGRPC(ctx, opts)
 	if err != nil {
 		log.Printf("[hubble] gRPC error: %v", err)
 		return &FlowsResponse{
@@ -841,85 +846,284 @@ func (h *HubbleSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsRe
 		}, nil
 	}
 
-	return &FlowsResponse{
-		Source:    "hubble",
-		Timestamp: time.Now(),
-		Flows:     flows,
-	}, nil
-}
-
-// fetchFlowsViaGRPC fetches flows using gRPC client
-func (h *HubbleSource) fetchFlowsViaGRPC(ctx context.Context, opts FlowOptions) ([]Flow, error) {
-	h.mu.RLock()
-	client := h.observerClient
-	h.mu.RUnlock()
-
-	if client == nil {
-		return nil, fmt.Errorf("not connected to Hubble Relay")
+	flows := fetched.flows
+	response := &FlowsResponse{
+		Source:        "hubble",
+		Timestamp:     time.Now(),
+		Flows:         flows,
+		CoveredSince:  fetched.coveredSince,
+		NodeFlowLimit: fetched.nodeLimit,
+	}
+	if fetched.incomplete != "" {
+		response.Warning = fetched.incomplete
+		// The fetch worked; it could not see everything. A busy node that keeps
+		// dropping events will keep saying so, which is the truth about its data
+		// rather than a failure to retry.
+		response.WarningKind = WarningIncomplete
+		// A stream that failed before any flow arrived is a failed fetch that
+		// happened to report some gaps first; retrying it can bring the flows.
+		if fetched.streamFailed && len(flows) == 0 {
+			response.WarningKind = WarningTransient
+		}
 	}
+	return response, nil
+}
 
-	// Build request
-	req := &observerpb.GetFlowsRequest{
-		Number: 1000, // Default limit
-		Follow: false,
-	}
+// hubbleFetch is what one GetFlows call established.
+type hubbleFetch struct {
+	flows []Flow
+	// incomplete explains, in terms a reader can act on, why the flows are not
+	// everything Hubble holds for the window; empty when nothing is missing.
+	incomplete   string
+	streamFailed bool
+	// coveredSince is when the flows start being complete: some node reached
+	// the per-node limit, and older traffic from it is not included. Nil when
+	// every node's traffic covers the whole window.
+	coveredSince *time.Time
+	nodeLimit    int
+}
 
-	if opts.Limit > 0 {
-		req.Number = uint64(opts.Limit)
+// hubbleFlowsRequest builds the request for the newest flows. Since is left out
+// on purpose: given Since, Hubble rewinds to it and reads forward, so a node
+// with more than Number flows in the window returns its oldest ones and the
+// view ends minutes before now. Without it each node returns its newest Number,
+// and the window is applied as those arrive.
+func hubbleFlowsRequest(opts FlowOptions, follow bool) *observerpb.GetFlowsRequest {
+	req := &observerpb.GetFlowsRequest{Follow: follow}
+	if !follow {
+		req.Number = hubbleDefaultNodeLimit
+		if opts.Limit > 0 {
+			req.Number = uint64(opts.Limit)
+		}
 	}
-
-	// Add namespace filter if specified
-	// Use separate filters for source OR destination (each filter is AND within itself,
-	// but multiple filters are OR'd together)
+	// Source OR destination: each filter is AND within itself, filters are OR'd.
 	if opts.Namespace != "" {
 		req.Whitelist = []*flowpb.FlowFilter{
 			{SourcePod: []string{opts.Namespace + "/"}},
 			{DestinationPod: []string{opts.Namespace + "/"}},
 		}
 	}
+	req.Blacklist = []*flowpb.FlowFilter{
+		// Reply packets at L3/L4 are dropped by callerOrientedFlow anyway;
+		// excluding them here stops them spending the per-node limit, which on a
+		// live cluster they took over 40% of. Only packet traces with an explicit
+		// is_reply=true match — the only L3/L4 records Cilium marks as replies —
+		// so L7 responses, drops, policy verdicts, socket traces and flows of
+		// unknown direction all still arrive.
+		{
+			Reply:     []bool{true},
+			E
```

**File**: `internal/traffic/hubble_flow_test.go` (modified, +50/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"testing"
 
 	flowpb "github.com/cilium/cilium/api/v1/flow"
+	"google.golang.org/protobuf/types/known/wrapperspb"
 )
 
 func TestConvertEndpointKinds(t *testing.T) {
@@ -90,3 +91,52 @@ func TestConvertHubbleFlowDropReason(t *testing.T) {
 		}
 	})
 }
+
+func TestCallerOrientedFlow(t *testing.T) {
+	client := &flowpb.Endpoint{Namespace: "demo", PodName: "client-0"}
+	server := &flowpb.Endpoint{Namespace: "demo", PodName: "echo-0"}
+	tcp := func(src, dst uint32) *flowpb.Layer4 {
+		return &flowpb.Layer4{Protocol: &flowpb.Layer4_TCP{TCP: &flowpb.TCP{SourcePort: src, DestinationPort: dst}}}
+	}
+	reply := func(v bool) *wrapperspb.BoolValue { return wrapperspb.Bool(v) }
+
+	t.Run("request direction is kept as is", func(t *testing.T) {
+		f, ok := callerOrientedFlow(&flowpb.Flow{Source: client, Destination: server, L4: tcp(41732, 80), IsReply: reply(false)})
+		if !ok || f.Source.Name != "client-0" || f.Destination.Name != "echo-0" || f.Port != 80 || f.Connections != 1 {
+			t.Fatalf("got ok=%v %+v", ok, f)
+		}
+	})
+	t.Run("an L4 reply draws no edge", func(t *testing.T) {
+		if f, ok := callerOrientedFlow(&flowpb.Flow{Source: server, Destination: client, L4: tcp(80, 41732), IsReply: reply(true)}); ok {
+			t.Fatalf("reply packet became an edge: %+v", f)
+		}
+	})
+	t.Run("an L7 response lands on the request's edge", func(t *testing.T) {
+		f, ok := callerOrientedFlow(&flowpb.Flow{
+			Source: server, Destination: client, L4: tcp(80, 41732), IsReply: reply(true),
+			DestinationService: &flowpb.Service{Name: "client-svc"}, SourceService: &flowpb.Service{Name: "echo"},
+			L7: &flowpb.Layer7{Type: flowpb.L7FlowType_RESPONSE, LatencyNs: 5e6, Record: &flowpb.Layer7_Http{Http: &flowpb.HTTP{Code: 503}}},
+		})
+		if !ok {
+			t.Fatal("the response carries the status and latency and must be kept")
+		}
+		if f.Source.Name != "client-0" || f.Destination.Name != "echo-0" || f.Port != 80 {
+			t.Errorf("response oriented %s -> %s :%d, want client-0 -> echo-0 :80", f.Source.Name, f.Destination.Name, f.Port)
+		}
+		if f.DestService != "echo" {
+			t.Errorf("DestService = %q, want the server's Service", f.DestService)
+		}
+		if f.Connections != 0 {
+			t.Errorf("Connections = %d, want 0: the request already counted this connection", f.Connections)
+		}
+		if f.HTTPStatus != 503 || f.LatencyNs != 5e6 {
+			t.Errorf("lost L7 detail: status %d latency %d", f.HTTPStatus, f.LatencyNs)
+		}
+	})
+	t.Run("unknown direction keeps its orientation", func(t *testing.T) {
+		f, ok := callerOrientedFlow(&flowpb.Flow{Source: server, Destination: client, L4: tcp(80, 41732), Verdict: flowpb.Verdict_DROPPED})
+		if !ok || f.Source.Name != "echo-0" {
+			t.Fatalf("a flow Hubble could not orient must pass through untouched, got ok=%v %+v", ok, f)
+		}
+	})
+}
```

**File**: `internal/traffic/hubble_getflows_test.go` (added, +390/-0)
```diff
@@ -0,0 +1,390 @@
+package traffic
+
+import (
+	"context"
+	"net"
+	"slices"
+	"strings"
+	"testing"
+	"time"
+
+	flowpb "github.com/cilium/cilium/api/v1/flow"
+	observerpb "github.com/cilium/cilium/api/v1/observer"
+	relaypb "github.com/cilium/cilium/api/v1/relay"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/credentials/insecure"
+	"google.golang.org/grpc/status"
+	"google.golang.org/protobuf/types/known/timestamppb"
+	"google.golang.org/protobuf/types/known/wrapperspb"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/util/intstr"
+	"k8s.io/client-go/kubernetes/fake"
+)
+
+// scriptedObserver replays a fixed GetFlows stream, optionally ending in an error.
+type scriptedObserver struct {
+	observerpb.UnimplementedObserverServer
+	responses []*observerpb.GetFlowsResponse
+	endErr    error
+	got       *observerpb.GetFlowsRequest
+}
+
+func (s *scriptedObserver) GetFlows(req *observerpb.GetFlowsRequest, stream grpc.ServerStreamingServer[observerpb.GetFlowsResponse]) error {
+	s.got = req
+	for _, r := range s.responses {
+		if err := stream.Send(r); err != nil {
+			return err
+		}
+	}
+	return s.endErr
+}
+
+func connectedHubble(t *testing.T, obs *scriptedObserver) *HubbleSource {
+	t.Helper()
+	lis, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatal(err)
+	}
+	srv := grpc.NewServer()
+	observerpb.RegisterObserverServer(srv, obs)
+	go srv.Serve(lis)
+	t.Cleanup(srv.Stop)
+	conn, err := grpc.NewClient(lis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { conn.Close() })
+	h := NewHubbleSource(fake.NewSimpleClientset())
+	h.observerClient = observerpb.NewObserverClient(conn)
+	h.isConnected = true
+	return h
+}
+
+func flowResponse(src, dst string) *observerpb.GetFlowsResponse {
+	return &observerpb.GetFlowsResponse{ResponseTypes: &observerpb.GetFlowsResponse_Flow{Flow: &flowpb.Flow{
+		Source:      &flowpb.Endpoint{Namespace: "demo", PodName: src},
+		Destination: &flowpb.Endpoint{Namespace: "demo", PodName: dst},
+		L4:          &flowpb.Layer4{Protocol: &flowpb.Layer4_TCP{TCP: &flowpb.TCP{SourcePort: 40000, DestinationPort: 80}}},
+		IsReply:     wrapperspb.Bool(false),
+		Verdict:     flowpb.Verdict_FORWARDED,
+	}}}
+}
+
+func TestHubbleGetFlows_ReportsWhatTheStreamDidNotDeliver(t *testing.T) {
+	t.Run("a complete stream carries no warning", func(t *testing.T) {
+		h := connectedHubble(t, &scriptedObserver{responses: []*observerpb.GetFlowsResponse{flowResponse("a", "b")}})
+		resp, err := h.GetFlows(context.Background(), DefaultFlowOptions())
+		if err != nil {
+			t.Fatal(err)
+		}
+		if len(resp.Flows) != 1 || resp.Warning != "" {
+			t.Fatalf("got %d flows, warning %q", len(resp.Flows), resp.Warning)
+		}
+	})
+
+	t.Run("a stream cut short keeps its flows and says so", func(t *testing.T) {
+		h := connectedHubble(t, &scriptedObserver{
+			responses: []*observerpb.GetFlowsResponse{flowResponse("a", "b"), flowResponse("a", "c")},
+			endErr:    status.Error(codes.Unavailable, "relay lost its peer"),
+		})
+		resp, err := h.GetFlows(context.Background(), DefaultFlowOptions())
+		if err != nil {
+			t.Fatal(err)
+		}
+		if len(resp.Flows) != 2 {
+			t.Fatalf("the flows that did arrive must be kept, got %d", len(resp.Flows))
+		}
+		if !strings.Contains(resp.Warning, "ended early") || !strings.Contains(resp.Warning, "first 2") {
+			t.Errorf("warning = %q, want it to say the stream ended early after 2 flows", resp.Warning)
+		}
+		if resp.WarningKind != WarningIncomplete {
+			t.Errorf("warningKind = %q, want incomplete: the fetch worked but could not see everything", resp.WarningKind)
+		}
+	})
+
+	t.Run("lost events are reported", func(t *testing.T) {
+		h := connectedHubble(t, &scriptedObserver{responses: []*observerpb.GetFlowsResponse{
+			flowResponse("a", "b"),
+			{ResponseTypes: &observerpb.GetFlowsResponse_LostEvents{LostEvents: &flowpb.LostEvent{
+				Source: flowpb.LostEventSource_HUBBLE_RING_BUFFER, NumEventsLost: 42,
+			}}},
+			{ResponseTypes: &observerpb.GetFlowsResponse_LostEvents{LostEvents: &flowpb.LostEvent{NumEventsLost: 8}}},
+		}})
+		resp, err := h.GetFlows(context.Background(), DefaultFlowOptions())
+		if err != nil {
+			t.Fatal(err)
+		}
+		if !strings.Contains(resp.Warning, "50 events lost") {
+			t.Errorf("warning = %q, want the total of lost events", resp.Warning)
+		}
+	})
+
+	t.Run("a handful of losses against many delivered events is not a warning", func(t *testing.T) {
+		responses := make([]*observerpb.GetFlowsResponse, 0, 402)
+		for range 400 {
+			responses = append(responses, flowResponse("a", "b"))
+		}
+		responses = append(responses, &observerpb.GetFlowsResponse{ResponseTypes: &observerpb.GetFlowsResponse_LostEvents{LostEvents: &flowpb.LostEvent{NumEventsLost: 3}}})
+		h := connectedHubble(t, &scriptedObserver{responses: responses})
+		r
```

**File**: `internal/traffic/istio.go` (modified, +135/-151)
```diff
@@ -2,6 +2,7 @@ package traffic
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"log"
 	"sort"
@@ -29,13 +30,14 @@ var istioNamespaces = []string{"istio-system", "istio", "default"}
 // rather than maintaining its own connection state.
 type IstioSource struct {
 	k8sClient kubernetes.Interface
+	queryFn   promQueryFunc
 }
 
 // NewIstioSource creates a new Istio traffic source
 func NewIstioSource(client kubernetes.Interface) *IstioSource {
-	return &IstioSource{
-		k8sClient: client,
-	}
+	s := &IstioSource{k8sClient: client}
+	s.queryFn = s.defaultQuery
+	return s
 }
 
 // Name returns the source identifier
@@ -133,20 +135,31 @@ func (s *IstioSource) getPrometheusClient() (*promclient.Client, error) {
 	return client, nil
 }
 
-// GetFlows retrieves flows from Istio metrics via the shared Prometheus client
-func (s *IstioSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsResponse, error) {
+// errIstioPrometheusUnavailable marks a query that never reached Prometheus
+// because there is no client to send it through.
+var errIstioPrometheusUnavailable = errors.New("prometheus not available for Istio metrics")
+
+func (s *IstioSource) defaultQuery(ctx context.Context, query string) (*prom.QueryResult, error) {
 	client, err := s.getPrometheusClient()
 	if err != nil {
+		return nil, fmt.Errorf("%w: %v", errIstioPrometheusUnavailable, err)
+	}
+	return client.Query(ctx, query)
+}
+
+// GetFlows retrieves flows from Istio metrics via the shared Prometheus client
+func (s *IstioSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsResponse, error) {
+	var missing []string
+
+	httpFlows, err := s.queryHTTPFlows(ctx, opts, &missing)
+	if errors.Is(err, errIstioPrometheusUnavailable) {
 		return &FlowsResponse{
 			Source:    "istio",
 			Timestamp: time.Now(),
 			Flows:     []Flow{},
 			Warning:   "Prometheus not available for Istio metrics",
 		}, nil
 	}
-
-	// Build HTTP request rate query
-	httpFlows, err := s.queryHTTPFlows(ctx, client, opts)
 	if err != nil {
 		log.Printf("[istio] Error querying HTTP flows: %v", err)
 		return &FlowsResponse{
@@ -157,20 +170,35 @@ func (s *IstioSource) GetFlows(ctx context.Context, opts FlowOptions) (*FlowsRes
 		}, nil
 	}
 
-	// Query TCP connections
-	tcpFlows, err := s.queryTCPFlows(ctx, client, opts)
-	if err != nil {
-		log.Printf("[istio] Error querying TCP flows (continuing with HTTP only): %v", err)
+	tcpFlows, tcpErr := s.queryTCPFlows(ctx, opts)
+	if tcpErr != nil {
+		log.Printf("[istio] Error querying TCP flows (continuing with HTTP only): %v", tcpErr)
+		missing = append(missing, "TCP connections")
 	} else {
 		httpFlows = append(httpFlows, tcpFlows...)
 	}
 
 	log.Printf("[istio] Retrieved %d flows from Prometheus", len(httpFlows))
-	return &FlowsResponse{
+	response := &FlowsResponse{
 		Source:    "istio",
 		Timestamp: time.Now(),
 		Flows:     httpFlows,
-	}, nil
+	}
+	// With no flows a missing enrichment qualifies nothing, but missing TCP
+	// connections can be why there are no flows: a TCP-only mesh whose query
+	// failed must not read as idle.
+	if len(missing) > 0 && (len(httpFlows) > 0 || tcpErr != nil) {
+		// Without this the edges read as measured: a failed 5xx query shows as no
+		// errors, and failed TCP or byte queries as no traffic of that kind.
+		response.Warning = fmt.Sprintf("Istio metrics are incomplete: %s could not be read from Prometheus, so those figures are missing from these edges rather than zero.", strings.Join(missing, ", "))
+		// Missing figures qualify the edges shown. Missing TCP connections are
+		// edges that may not be shown at all, which holds whatever is filtered.
+		response.WarningKind = WarningPartial
+		if tcpErr != nil {
+			response.WarningKind = WarningTransient
+		}
+	}
+	return response, nil
 }
 
 // flowKey uniquely identifies a source→destination service pair for map lookups
@@ -181,58 +209,91 @@ type flowKey struct {
 	dstNs       string
 }
 
-// queryHTTPFlows queries istio_requests_total for HTTP/gRPC traffic.
-// Response codes are aggregated (not split per-code) and a separate error query
-// provides 5xx error rates per service pair.
-func (s *IstioSource) queryHTTPFlows(ctx context.Context, client *promclient.Client, opts FlowOptions) ([]Flow, error) {
-	// Main query: all requests, no response_code grouping
-	query := `sum by (source_workload, source_workload_namespace, destination_workload, destination_workload_namespace, destination_service_name, request_protocol, reporter) (rate(istio_requests_total{reporter="destination"}[5m]))`
-	if opts.Namespace != "" {
-		safeNS := prom.SanitizeLabelValue(opts.Namespace)
-		query = fmt.Sprintf(`sum by (source_workload, source_workload_namespace, destination_workload, destination_workload_namespace, destination_service_name, request_protocol, reporter) (rate(istio_requests_total{reporter="destination", source_workload_namespace="%s"}[5m])) or sum by (source_workload, source_workload_namespace, destination_workload, destination_worklo
```

---

### Incident Patch 6: `0c2e7adb` (2026-09-30)
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
+| Working on the **informer cache** (new typed kind, field stripping, scope) | `pkg/k8score/cache.go` + `pkg/k8score/transform.go` (what is stripped and why), `internal/k8s/capabilities.go` (probe-based scope) |
+| Working on the **timeline / workload history** | `pkg/timeline/store.go` (`ResourceScope`: owner UID, `OwnerlessRefs`) + the `handleWorkloadHistory` doc comment in `internal/server/workload_history.go` |
+| Working on **network trace / reachability** | [docs/reachability.md](docs/reachability.md) + `internal/server/trace_handlers.go` |
+| Working on **authentication, auth-enabled mode, impersonation or per-user authorization** | [docs/authentication.md](docs/authentication.md) — auth modes, how per-user RBAC is enforced, ServiceAccount RBAC, session cookies. For Radar Cloud's default permission tiers and the integration-read policy, [docs/cloud-rbac-baseline.md](docs/cloud-rbac-baseline.md) |
+| Changing the **Helm chart** or **in-cluster deployment** (chart values, chart RBAC, ingress) | [deploy/helm/radar/README.md](deploy/helm/rad
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

### Incident Patch 7: `14d329a2` (2026-09-30)
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
+  // One membership rule for filtering, counting and grouping: a stack-trace
+  // line belongs to the record its own pod and container started.
+  const association = useMemo(() => {
+    const { headOf, effectiveLevel } = associateContinuations(entries)
+    const headIdById = new Map<number, number>()
+    for (let i = 0; i < entries.length; i++) {
+      if (headOf[i] !== i) headIdById.set(entries[i].id, entries[headOf[i]].id)
+    }
+    return { headOf, effectiveLevel, headIdById }
+  }, [entries])
+
+  // Frames take their record's level so they filter and render as part of it.
+  const recordEntries = useMemo(
+    () => entries.map((e, i) => (association.effectiveLevel[i] === e.level ? e : { ...e, level: association.effectiveLevel[i] })),
+    [entries, association],
+  )
+
   const levelFilteredEntries = useMemo(() => {
     const allEnabled = LEVEL_OPTIONS.every(opt => enabledLevels.has(opt.level))
-    if (allEnabled) return entries
-    return entries.filter(e => enabledLevels.has(e.level))
-  }, [entries, 
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
+    case 'warn': return palette.levelBadgeWarn
+    case 'info': return palette.levelBadgeInfo
+    case 'debug': return palette.levelBadgeDebug
+    default: return palette.levelBadgeNeutral
   }
-  if (/^(error|err|fatal|panic|critical|crit)$/.test(normalized)) return palette.levelBadgeError
-  if (/^(warn|warning)$/.test(normalized)) return palette.levelBadgeWarn
-  if (/^(info|information|notice)$/.test(normalized)) return palette.levelBadgeInfo
-  if (/^(debug|dbg|trace|verbose)$/.test(normalized)) return palette.levelBadgeDebug
-  return palette.levelBadgeNeutral
 }
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
     if (matchIdx < 0 || matchIdx >= matchIndices.length) return
-    if (isFilterMode) {
-      // In filter mode, match index maps directly to filtered list index
+    if (mode === 'hide') return
+    if (mode === 'only') {
+      // The list holds whole matching records, so find the matched line within it
+      const index = filteredIndexById?.get(entries[matchIndices[matchIdx]].id)
+      if (index === undefined) return
       virtuosoRef.current?.scrollToIndex({
-        index: matchIdx,
+        index,
         align: 'center',
         behavior: 'smooth',
       })
@@ -109,26 +139,24 @@ export function useLogSearch(
         behavior: 'smooth',
       })
     }
-  }, [matchIndices, isFilterMode, virtuosoRef])
+  }, [entries, matchIndices, mode, filteredIndexById, virtuosoRef])
 
   const goToNext = useCallback(() => {
-    if (matchIndices.length === 0) return
+    if (matchIndices.length === 0 || mode === 'hide') return
     const next = (currentMatch + 1) % matchIndices.length
     setCurrentM
```

**File**: `packages/k8s-ui/src/utils/log-format.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
  * Shared between LogsViewer and WorkloadLogsViewer components.
  */
 
-import type { LogLevel } from '../components/logs/useLogBuffer'
+import type { LogLevel } from './log-level'
 
 export type TimestampFormat =
   | 'time-local'
```

**File**: `packages/k8s-ui/src/utils/log-level.test.ts` (added, +269/-0)
```diff
@@ -0,0 +1,269 @@
+import { describe, expect, it } from 'vitest'
+import {
+  associateContinuations,
+  detectLevel,
+  groupContinuations,
+  isContinuationLine,
+  normalizeLevel,
+  selectLevelField,
+  type LevelSource,
+  type LogLevel,
+} from './log-level'
+import { applySearchMode } from '../components/logs/useLogSearch'
+
+// Lines taken from real clusters (lightly shortened), grouped by the library that wrote them.
+const CASES: [string, string, LogLevel, LevelSource][] = [
+  // klog — most Kubernetes controllers
+  ['klog error', 'E0929 22:27:48.228549       1 controller.go:157] "re-queuing item due to error processing" err="secrets \\"capi-serving-cert-\\" is forbidden"', 'error', 'header'],
+  ['klog info', 'I0929 22:27:51.404929       1 reflector.go:376] Caches populated for *v1.Gateway from k8s.io/client-go@v0.32.0/tools/cache/reflector.go:251', 'info', 'header'],
+  ['klog warning', 'W0930 10:00:00.000001       1 warnings.go:70] v1 Endpoints is deprecated in v1.33+', 'warn', 'header'],
+  ['klog fatal', 'F0930 10:00:00.000001       1 main.go:12] cannot start', 'error', 'header'],
+
+  // logfmt — Argo CD, Grafana, slog text (Prometheus, Beyla), logrus
+  ['logfmt level beats message words', 'time=2026-09-30T10:00:00Z level=info msg="retrying after error: connection reset"', 'info', 'structured'],
+  ['two-pair logfmt', 'level=info msg="retrying after error"', 'info', 'structured'],
+  ['argocd', 'time="2026-09-29T22:28:21Z" level=info msg="started call" grpc.component=server grpc.method=GetGitFiles', 'info', 'structured'],
+  ['slog uppercase', 'time=2026-09-12T22:00:43.702Z level=WARN msg="can\'t fetch Kubernetes Cluster Name"', 'warn', 'structured'],
+  ['prometheus warning text at INFO', 'time=2026-09-25T09:12:00.796Z level=INFO source=warnings.go:107 msg="Warning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice"', 'info', 'structured'],
+  ['grafana', 'logger=dashboard-service t=2026-09-29T22:28:31.732506197Z level=info msg="No last resource version found, starting from scratch" orgID=1', 'info', 'structured'],
+  ['header level before a level= pair in the message', '2026-09-30T10:00:00Z ERROR request failed level=debug', 'error', 'header'],
+  ['level inside quoted message', 'msg="upstream said level=error" level=info', 'info', 'structured'],
+  ['unrecognized structured level', 'level=custom_level msg="error happened"', 'unknown', 'structured'],
+
+  // JSON — zap, controller-runtime, pino, GCP, ECS
+  ['zap json', '{"level":"error","ts":"2026-09-29T22:20:12.561715963Z","msg":"Reconciler error","controller":"cluster"}', 'error', 'structured'],
+  ['json info with error key', '{"level":"info","ts":"2026-09-29T20:42:20.831Z","message":"RequestCompleted HTTP/1.1 GET / 404","error":null}', 'info', 'structured'],
+  ['pino numeric wins over severity text', '{"severity":"ERROR","level":50,"time":1790720767281,"errmsg":"Authentication failed."}', 'error', 'structured'],
+  ['gcp severity', '{"time":"2026-09-29T12:18:58.483192609Z","severity":"INFO","message":"[audit] retention sweep"}', 'info', 'structured'],
+  ['logfmt dotted level key', 'time=2026-09-30T10:00:00Z log.level=info msg="retry after error"', 'info', 'structured'],
+  ['ecs dotted key', '{"@timestamp":"2026-09-30T10:00:00Z","log.level":"warn","message":"slow"}', 'warn', 'structured'],
+  ['ecs nested', '{"log":{"level":"debug"},"message":"cache miss"}', 'debug', 'structured'],
+  ['empty level falls through to next field', '{"level":"","severity":"error","msg":"failed"}', 'error', 'structured'],
+  ['json without level, null error', '{"msg":"ok","error":null}', 'unknown', 'none'],
+
+  // Console encoders and Java/Python loggers — level word in the line header
+  ['zap console', '2026-09-29T22:19:30.112Z\tERROR\tprovider\tkubernetes/controller.go:639\tfailed to get Service\t{"runner": "provider"}', 'error', 'header'],
+  ['zap console info', '2026-09-29T22:26:08.897Z\tINFO\tinfrastructure\trunner/runner.go:100\treceived an update', 'info', 'header'],
+  ['zap verbosity', '2026-09-29T22:20:31Z\tLEVEL(-2)\tReconciling JobSet\t{"controller": "jobset"}', 'debug', 'header'],
+  ['zerolog console', '2026-09-25T11:58:46Z WRN Controller is running', 'warn', 'header'],
+  ['zerolog console info', '2026-09-25T11:58:46Z INF Starting controllers', 'info', 'header'],
+  ['log4j kafka', '[2026-09-29 22:12:42,867] INFO [SnapshotEmitter id=0] Successfully wrote snapshot (org.apache.kafka.image.publisher.SnapshotEmitter)', 'info', 'header'],
+  ['java agent prefix', '[otel.javaagent 2026-09-29 22:31:56:986 +0000] [EndpointMetricCollector] INFO software.amazon.opentelemetry.EndpointCollector - Error rate 0', 'info', 'header'],
+  ['python logging', 'WARNING:root:disk almost full', 'warn', 'header'],
+  ['nginx error log', '2026/09/30 10:00:00 [error] 29#29: *1 connect() failed (111: Connection refused)', 'error', 'header'],
+  ['nestjs with ANSI colours', '\x1b[31m[Nest] 1  - \x1b[39m09/29/2026, 10:23:14 PM \x1b[31m 
```

**File**: `packages/k8s-ui/src/utils/log-level.ts` (added, +301/-0)
```diff
@@ -0,0 +1,301 @@
+import { stripAnsi } from './log-format'
+import type { LogEntry } from '../components/logs/useLogBuffer'
+
+export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'unknown'
+
+/**
+ * Where a line's level came from. `structured` and `header` are the line
+ * stating its own severity; `keyword` is a guess from words in the message, so
+ * it must not override a line's membership in a stack trace or a structured
+ * field that says otherwise.
+ */
+export type LevelSource = 'structured' | 'header' | 'keyword' | 'none'
+
+export interface DetectedLevel {
+  level: LogLevel
+  source: LevelSource
+}
+
+const ERROR_NAMES = new Set(['error', 'err', 'eror', 'fatal', 'ftl', 'panic', 'pnc', 'dpanic', 'critical', 'crit', 'alert', 'emerg', 'emergency', 'severe'])
+const WARN_NAMES = new Set(['warn', 'warning', 'wrn'])
+const INFO_NAMES = new Set(['info', 'inf', 'information', 'notice', 'log'])
+const DEBUG_NAMES = new Set(['debug', 'dbg', 'debg', 'trace', 'trc', 'verbose', 'fine', 'finer', 'finest'])
+
+function levelFromNumber(n: number): LogLevel {
+  // Pino/bunyan: 10 trace, 20 debug, 30 info, 40 warn, 50 error, 60 fatal
+  if (n >= 50) return 'error'
+  if (n >= 40) return 'warn'
+  if (n >= 30) return 'info'
+  return 'debug'
+}
+
+/**
+ * Map a raw level value to a LogLevel. Returns null when the value carries no
+ * level at all (missing, empty, non-scalar) so callers can fall through to the
+ * next source; a present but unrecognized name is `unknown`.
+ */
+export function normalizeLevel(raw: unknown): LogLevel | null {
+  if (typeof raw === 'number') return Number.isFinite(raw) ? levelFromNumber(raw) : null
+  if (typeof raw !== 'string') return null
+  const v = raw.trim().toLowerCase()
+  if (!v) return null
+  if (/^\d+$/.test(v)) return levelFromNumber(Number(v))
+  if (ERROR_NAMES.has(v)) return 'error'
+  if (WARN_NAMES.has(v)) return 'warn'
+  if (INFO_NAMES.has(v)) return 'info'
+  if (DEBUG_NAMES.has(v)) return 'debug'
+  // zap/logr verbosity levels render as LEVEL(-2)
+  if (/^level\(-\d+\)$/.test(v)) return 'debug'
+  return 'unknown'
+}
+
+const LEVEL_FIELD_KEYS = ['level', 'lvl', 'severity', 'levelname', 'log.level'] as const
+
+/**
+ * Pick the level field of a structured record. Shared by detection and the
+ * structured-line badge so the badge text and the line's resolved level always
+ * come from the same field.
+ */
+export function selectLevelField(obj: Record<string, unknown>): { raw: unknown; level: LogLevel } | null {
+  for (const key of LEVEL_FIELD_KEYS) {
+    const level = normalizeLevel(obj[key])
+    if (level) return { raw: obj[key], level }
+  }
+  const log = obj.log
+  if (log && typeof log === 'object' && !Array.isArray(log)) {
+    const raw = (log as Record<string, unknown>).level
+    const level = normalizeLevel(raw)
+    if (level) return { raw, level }
+  }
+  return null
+}
+
+// Same tokenization as parseLogfmt: a quoted value is consumed whole, so a
+// `level=` inside a quoted message is never read as the line's own level.
+const LOGFMT_PAIR_RE = /(?:^|\s)([a-zA-Z_][\w.]*)=((?:"(?:[^"\\]|\\.)*")|(?:[^\s]*))/g
+const LOGFMT_LEVEL_KEYS = new Set(['level', 'lvl', 'severity', 'log.level'])
+const LOGFMT_LEVEL_HINT = /(?:^|\s)(?:level|lvl|severity|log\.level)=/
+
+interface PlacedLevel {
+  level: LogLevel
+  /** Where in the line the level marker starts */
+  at: number
+}
+
+function logfmtLevel(line: string): PlacedLevel | null {
+  if (!LOGFMT_LEVEL_HINT.test(line)) return null
+  const re = LOGFMT_PAIR_RE
+  re.lastIndex = 0
+  let match: RegExpExecArray | null
+  while ((match = re.exec(line)) !== null) {
+    if (!LOGFMT_LEVEL_KEYS.has(match[1])) continue
+    let value = match[2]
+    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1)
+    const level = normalizeLevel(value)
+    if (level) return { level, at: match.index }
+  }
+  return null
+}
+
+// klog: Lmmdd hh:mm:ss.uuuuuu threadid file:line]
+const KLOG_RE = /^([IWEF])\d{4} \d{2}:\d{2}:\d{2}\.\d+\s/
+const KLOG_LEVELS: Record<string, LogLevel> = { I: 'info', W: 'warn', E: 'error', F: 'error' }
+
+// A standalone uppercase level word near the start of the line: zap and
+// zerolog console output, logback/log4j, Python logging, NestJS. The window
+// covers prefixes such as timestamps, thread names and agent tags.
+const HEADER_WINDOW = 100
+const HEADER_TOKEN_RE = /(?:^|[\s[<|(])(TRACE|TRC|DEBUG|DBG|DEBG|VERBOSE|INFO|INF|LOG|NOTICE|WARN|WARNING|WRN|ERROR|ERR|FATAL|FTL|PANIC|PNC|DPANIC|CRITICAL|CRIT|SEVERE|LEVEL\(-\d+\))(?=$|[\s\]>|:)])/
+// `[error]` (nginx, envoy), `<Information>` (ClickHouse)
+const BRACKETED_TOKEN_RE = /[[<](trace|debug|information|info|notice|warning|warn|error|critical|crit|alert|emerg|fatal)[\]>]/i
+// telegraf and the CloudWatch agent: `2026-09-29T20:38:42Z E! message`
+const BANG_PREFIX_RE = /^\S+\s([DIWE])!\s/
+const BANG_LEVELS: Record<string, LogLevel> = { D: 'debug', I: 'info', W: 'warn', E: 'error' }
+
```

---

### Incident Patch 8: `92e08957` (2026-09-30)
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

### Incident Patch 9: `a78e11f8` (2026-09-29)
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

### Incident Patch 10: `d36dff8d` (2026-09-29)
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

### Incident Patch 11: `d6db76f2` (2026-09-29)
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
+Radar probes each listed namespace for access and watches every namespace where access is granted — resource views then cover all of them, not just the first. The list is also each user's initial picker selection: locally via the launch URL, and in shared (auth-enabled) deployments as a per-session default seeded on first read. Clearing the picker back to **All namespaces** sticks for the rest of the session. The picker can switch between those namespaces or keep several selected at once.
 
-**Single namespace only.** `--namespace-scope` pins the cache to exactly one namespace; scoping to several namespaces at once is not supported yet. Passing more than one (e.g. `--namespace=a,b`) fails at startup with a clear error rather than silently caching nothing. When scoped, the namespace picker becomes single-select, and a switch re-points the whole cache to the new namespace rather than adding to it.
+This covers built-in resource types and custom resources alike: CRDs (GitOps, Gateway API, etc.) are probed per-kind across the same list and watched in every granted namespace. The list is capped by `--max-scope-candidates` (default 20) — startup fails with a clear error rather than silently probing a subset.
 
 ## Audit evidence under partial access
 
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
+  it('keeps the filter tooltip once a namespace is picked', async () => {
+    const { tooltip, text } = await renderOpen({ mode: 'namespace' }, { limitedListHelp: help })
+    expect(tooltip).toBe('View is filtered to namespace team-a. Click to switch or reset.')
+    expect(text).toContain('Missing a namespace?')
+  })
+
+  // Without a host action the list is usually the viewer's complete RBAC view
+  // (auth-enabled installs, Radar Cloud), so say what it is rather than warn.
+  it('describes an RBAC-scoped list with nothing picked', async () => {
+    const { tooltip, text } = await renderOpen({ actives: [], mode: 'restricted' })
+    expect(tooltip).toBe('Showing the namespaces your account can access.')
+    expect(text).not.toContain('Missing a namespace?')
+  })
+
+  it('keeps the usual tooltip for an authoritative list', async () => {
+    const { tooltip } = await renderOpen({ actives: [], mode: 'cluster-wide', authoritative: true })
+    expect(tooltip).toBe('Currently viewing all namespaces. Click to narrow the view.')
+  })
+})
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
             {pending ? 'Switching…' : triggerLabel}
           </span>
@@ -299,7 +304,7 @@ export const NamespacePicker = forwardRef<NamespacePickerHandle, NamespacePicker
                 <ul className="max-h-80 overflow-y-auto py-1">
                   {filteredItems.length === 0 && (
                     <li className="px-3 py-2 text-xs text-theme-text-tertiary">
-                      {search ? 'No matches.' : 'No namespaces available.'}
+                      {search ? 'No matches.' : emptyStateLabel}
                     </li>
                   )}
 
@@ -346,18 +351,16 @@ export const NamespacePicker = forwardRef<NamespacePickerHandle, NamespacePicker
                 onSearchChange={setSearch}
                 searchPlaceholder="Filter namespaces"
                 summaryEmptyLabel="All namespaces"
-                noItemsLabel="No namespaces available."
+                noItemsLabel={emptyStateLabel}
                 clearAllDisabled={!canClearAll || activeCount === 0}
                 clear
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

### Incident Patch 12: `7efd611c` (2026-09-28)
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
         </button>
@@ -875,7 +875,7 @@ function FindingLine({
     <>
       <span className="flex min-w-0 items-baseline gap-2">
         <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-theme-text-tertiary">{r.kind}</span>
-        <span className={`min-w-0 break-all font-medium ${linkable ? 'text-[var(--color-radar-accent)]' : 'text-theme-text-primary'}`}>
+        <span className={`min-w-0 break-all font-medium ${linkable ? 'text-[var(--color-radar-accent,var(--accent))]' : 'text-theme-text-primary'}`}>
           {r.namespace ? `${r.namespace} / ` : ''}
           {r.name}
         </span>
@@ -1010,7 +1010,7 @@ function ClusterFilter({
                   onClick={() => onToggle(o.id)}
                   className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-theme-text-secondary transition-colors hover:bg-theme-hover hover:text-theme-text-primary"
                 >
-                  <span className={`flex h-3.5 w-3.5 shrink-0 items-cen
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

**File**: `web/src/components/home/HomeView.tsx` (modified, +1/-1)
```diff
@@ -351,7 +351,7 @@ function ProblemsPanel({
         <div className="flex items-center gap-2">
           <button
             type="button"
-            className="rounded-md px-2 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-radar-accent)]/40"
+            className="rounded-md px-2 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-radar-accent,var(--accent))]/40"
             onClick={onNavigateToIssues}
           >
             View all
```

**File**: `web/src/components/ui/Omnibar.tsx` (modified, +1/-1)
```diff
@@ -543,7 +543,7 @@ export const Omnibar = forwardRef<OmnibarHandle, OmnibarProps>(function Omnibar(
     >
       <SearchPillInput
         className={hero
-          ? `min-h-14 px-5 rounded-2xl bg-theme-surface border border-theme-border shadow-theme-sm transition-[color,background-color,border-color,box-shadow] duration-[140ms] ${TW_EASE_UI} focus-within:border-[var(--color-brand-500)] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand-500)_15%,transparent)]`
+          ? `min-h-14 px-5 rounded-2xl bg-theme-surface border border-theme-border shadow-theme-sm transition-[color,background-color,border-color,box-shadow] duration-[140ms] ${TW_EASE_UI} focus-within:border-[var(--color-brand-500,var(--accent))] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand-500,var(--accent))_15%,transparent)]`
           : `min-h-8 px-2.5 rounded-md bg-theme-elevated border border-transparent focus-within:border-theme-border focus-within:bg-theme-surface transition-[color,background-color,border-color] duration-[140ms] ${TW_EASE_UI}`}
         inputClassName={hero ? 'text-lg py-4' : undefined}
         text={text}
```

---

### Incident Patch 13: `30d184a2` (2026-09-28)
**Commit Message**: Add Claude Design sync config for k8s-ui (#1918)

## What

Commits the durable inputs for syncing `@skyhook-io/k8s-ui` — plus the
prop-driven feature components from `web/` (radar-app) — to the
**Skyhook Radar** design system in Claude Design (claude.ai/design), so
the design agent builds with Radar's real components and theme. The July
sync never committed its config or previews; this makes re-syncs a
one-command, incremental operation from any clone.

- `.design-sync/build-pkg.mjs`: k8s-ui ships source only, so this builds
a sync-only package (gitignored, `packages/k8s-ui/.ds-sync-pkg/`):
- minified ESM dist of the main barrel + `charts` +
`resources/renderers` (subpath-only exports)
  - `.d.ts` via typescript-7
- Tailwind v4 compiled over the k8s-ui theme layers plus the app
`@theme` / base rules from `web/src/index.css`, so designs get DM Sans,
radii and shadows
- 37 opt-in `web/` exports (`WEB_COMPONENTS`): Diagnose
story/evidence/result cards, `ClusterSchedulingCard`,
`CurrentAllocationUse`, Helm diff/history/manifest, `TrafficGraph` +
filters, `TopologyPreview`, timeline scrubber. Most of `web/` fetches
its own data and stays out; only components that render from props are
i

**File**: `.design-sync/NOTES.md` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+# design-sync notes — @skyhook-io/k8s-ui → claude.ai/design "Skyhook Radar"
+
+## Re-sync (from repo root)
+
+```sh
+# stage converter (skill base dir) into .ds-sync/, then:
+(cd .ds-sync && npm i esbuild ts-morph @types/react playwright@<repo playwright version>)
+node .design-sync/build-pkg.mjs
+# fetch the project's _ds_sync.json -> .design-sync/.cache/remote-sync.json
+node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
+  --entry ./packages/k8s-ui/.ds-sync-pkg/dist/index.js --out ./ds-bundle \
+  --remote .design-sync/.cache/remote-sync.json
+```
+
+Last synced 2026-09-28: 414 components (37 from web/), 89 authored previews, bundle ~7.3 MB.
+
+## Build
+
+- `web/src/index.css` (app `@theme` — DM Sans/Mono, radii, shadows, breakpoints — plus component
+  classes like `.investigation-evidence`, React Flow/xterm styling, keyframes) is included whole in
+  the Tailwind input minus its own `@import`/`@source`/`@variant` lines. Without it everything
+  renders in the system font and Diagnose panels lose their fills.
+
+- k8s-ui ships source only. `node .design-sync/build-pkg.mjs` (cfg.buildCmd) builds a sync-only
+  package at `packages/k8s-ui/.ds-sync-pkg/` (gitignored): minified ESM `dist/`, `.d.ts` via
+  `typescript-7` tsc, Tailwind v4 compiled over the theme layers, one merged `styles.css`.
+  Converter command: `--node-modules ./node_modules --entry ./packages/k8s-ui/.ds-sync-pkg/dist/index.js`.
+  Config paths (`srcDir`, `cssEntry`, `extraFonts`, `componentSrcMap`) are relative to that dir.
+- Entry = main barrel + `components/charts` + `components/resources/renderers` (the last two are
+  only reachable through package.json subpath exports). A new subpath-only component group must
+  be added to `entry.ts` in build-pkg.mjs or it silently drops out of the sync.
+- React must come from the page (`window.React`): build-pkg reuses the converter's `reactShim`.
+  Externalizing react instead leaves CJS deps doing `require("react")` → every card throws
+  "Dynamic require of react is not supported".
+- shiki is stubbed (dynamic grammar imports can't live in one IIFE) — CodeViewer renders plain `<pre>`.
+- **Monaco is stubbed** (`@monaco-editor/react`, `monaco-editor`, `monaco-yaml`): it was ~6 MB of
+  the bundle. In cards and designs `Editor` is a read-only code view with line numbers and
+  `DiffEditor` a unified line diff (stubs generated by build-pkg). Editing behavior never matters
+  in a design; the product build is untouched.
+- **`web/` (radar-app) components** are opt-in via `WEB_COMPONENTS` in build-pkg.mjs — only exports
+  that render from props alone. Most of `web/` fetches its own data (React Query / router /
+  app contexts) and renders empty without a backend. Each web export is also pinned in
+  `componentSrcMap` (to `../../../web/src/components/<file>`) so it groups by feature dir.
+  The durable fix for data-coupled feature views (Capacity, Home cards) is moving their
+  presentational parts into k8s-ui, which then syncs automatically.
+- `*Cell` table-cell renderers (127) are excluded via `componentSrcMap: null` — they only make
+  sense inside ResourcesView tables. They stay in the bundle.
+- Renderers living in multi-component files (Kueue*, Knative*, Kyverno*, CNPG declarative…) are
+  pinned in `componentSrcMap` so they group under `renderers` instead of `general`.
+
+## Authoring previews
+
+- Port canonical usages first; the old previews were recovered from the project's compiled
+  `_preview/*.js` (the tsx follows the `// .design-sync/previews/<Name>.tsx` marker).
+- `.btn-brand` carries no padding — give preview buttons explicit padding.
+- Tailwind classes used only in a preview are compiled by the full build (build-pkg `@source`s
+  `.design-sync/previews`), not by a targeted `preview-rebuild` — use inline style while iterating.
+- `position: fixed` surfaces (EventDetailPanel) stay inside the card under a
+  `transform: translateZ(0)` wrapper.
+- Only one Tooltip can be open at a time (module singleton); SelectMenu's open state closes if
+  another cell steals focus — keep one auto-open cell per card.
+- `GitOpsFilterSection`/`GitOpsFacetButton` alias `FacetSection`/`FacetButton` (identical render).
+- The capture clock is frozen, so `Date.now()`-relative fixtures are stable.
+- Monaco editors (YamlEditor, YamlDiffEditor, YamlReview) DO render in the capture sandbox;
+  YamlReview switches to side-by-side above 900px, hence its 1100x700 single-card viewport.
+- Trace fixtures (`reachFixtures.ts`) aren't exported; TraceSummary/ReachabilityView previews
+  inline their fixture builders.
+- **web/ previews**: Diagnose fixtures were generated by running the real
+  `projectInvestigationEvidence` / `resolveInvestigationCase` / `resolveStoryPlacements` and
+  transcribing the output into small constructors (story placements hold Maps — rebuild with
+  `new Map([...])`). When those projections change shape, regenerate rather t
```

**File**: `.design-sync/build-pkg.mjs` (added, +290/-0)
```diff
@@ -0,0 +1,290 @@
+// Builds the package the design-sync converter consumes. @skyhook-io/k8s-ui
+// ships source only, so this stands in for its missing `build`: a minified ESM
+// dist, emitted .d.ts, and compiled Tailwind CSS under a sync-only package dir.
+// Run from the repo root (cfg.buildCmd). Output is gitignored.
+//
+// - Entry = the main barrel plus charts/ and resources/renderers/, which are
+//   reachable only through package.json subpath exports, plus WEB_COMPONENTS:
+//   the prop-driven feature components in web/ (radar-app). Most of web/ fetches
+//   its own data and can't render without a backend, so it is opt-in per export.
+// - Minified because monaco alone is ~9MB unminified and the upload caps a
+//   file at 12MB; the converter re-bundles without minifying.
+// - shiki is stubbed: it loads every grammar through dynamic import, which the
+//   converter's single IIFE can't split. CodeViewer falls back to a plain <pre>.
+// - React stays the host page's (window.React), never a bundled copy.
+// - Monaco is stubbed: it is ~6MB of the bundle and the upload caps a file at
+//   12MB. Editor/DiffEditor render the same YAML as a read-only code view and a
+//   line diff, which is what a design needs; editing behavior never matters there.
+import { execFileSync } from 'node:child_process';
+import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
+import { dirname, join, resolve } from 'node:path';
+import { createRequire } from 'node:module';
+
+const ROOT = resolve('.');
+const SRC_PKG = join(ROOT, 'packages/k8s-ui');
+const OUT = join(SRC_PKG, '.ds-sync-pkg');
+const require = createRequire(join(ROOT, '.ds-sync/package.json'));
+const { build } = require('esbuild');
+// Route react/react-dom/react-is/scheduler to the page's globals the same way
+// the converter does, so CJS deps bundled here (their `require("react")`)
+// don't become dynamic requires the browser can't satisfy.
+const { reactShim } = await import(join(ROOT, '.ds-sync/lib/bundle.mjs'));
+
+const srcPkg = JSON.parse(readFileSync(join(SRC_PKG, 'package.json'), 'utf8'));
+rmSync(OUT, { recursive: true, force: true });
+mkdirSync(join(OUT, 'stubs'), { recursive: true });
+
+// web/src/components/<file> -> exports. Only components that render from props
+// alone (no React Query, router, or app-context reads) belong here.
+const WEB_COMPONENTS = {
+  'diagnose/AnalysisStory.tsx': ['AnalysisStory'],
+  'diagnose/StoryExcerpt.tsx': ['StoryExcerpt'],
+  'diagnose/AssessmentCard.tsx': ['ResultCard', 'AssessmentSources', 'WorkingNotes', 'AllClearCard', 'InconclusiveCard'],
+  'diagnose/EvidenceCard.tsx': ['EvidenceCard'],
+  'diagnose/InvestigationEvidencePane.tsx': ['InvestigationEvidencePane'],
+  'diagnose/InvestigationEvidenceSections.tsx': ['RuledOutBlock', 'AssessmentEvidenceQualification', 'EmptyCollection', 'CollapsedEvidenceCollection', 'CoverageStrip'],
+  'diagnose/InvestigationResourceEvidence.tsx': ['InvestigationResourceEvidence'],
+  'diagnose/AgentCase.tsx': ['AgentRoleChip', 'AgentClaimNote'],
+  'diagnose/AgentControls.tsx': ['Segmented', 'AgentControls', 'ConsentCard'],
+  'diagnose/AgentSetupNotice.tsx': ['AgentSetupNotice'],
+  'diagnose/ActivityTurn.tsx': ['TurnView', 'FollowupAnswer'],
+  'diagnose/ApplyDialog.tsx': ['ApplyDialog', 'ApplyOutcomeCard'],
+  'diagnose/AIMarkdown.tsx': ['AIMarkdown'],
+  'diagnose/Home.tsx': ['InvestigationHome', 'RecentList'],
+  'capacity/ClusterSchedulingCard.tsx': ['ClusterSchedulingCard'],
+  'cost/CurrentAllocationUse.tsx': ['CurrentAllocationUse'],
+  'helm/ManifestViewer.tsx': ['ManifestViewer'],
+  'helm/RevisionHistory.tsx': ['RevisionHistory'],
+  'helm/ValuesDiffPreview.tsx': ['ValuesDiffPreview'],
+  'home/TopologyPreview.tsx': ['TopologyPreview'],
+  'timeline/LocalTimelineScrubber.tsx': ['LocalTimelineScrubber'],
+  'traffic/TrafficGraph.tsx': ['TrafficGraph'],
+  'traffic/TrafficFilterSidebar.tsx': ['TrafficFilterSidebar'],
+};
+const WEB_SRC = join(ROOT, 'web/src');
+
+writeFileSync(join(OUT, 'entry.ts'), [
+  "export * from '../src/index'",
+  "export * from '../src/components/charts'",
+  "export * from '../src/components/resources/renderers'",
+  ...Object.entries(WEB_COMPONENTS).map(([file, names]) =>
+    `export { ${names.join(', ')} } from '../../../web/src/components/${file.replace(/\.tsx$/, '')}'`),
+  '',
+].join('\n'));
+
+writeFileSync(join(OUT, 'stubs/shiki.ts'), `
+const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
+export async function codeToHtml(code: string, _opts?: unknown): Promise<string> {
+  return \`<pre class="shiki"><code>\${esc(code)}</code></pre>\`
+}
+`);
+
+writeFileSync(join(OUT, 'package.json'), JSON.stringify({
+  name: srcPkg.name,
+  version: srcPkg.version,
+  type: 'module',
+  module: 'dist/index.js',
+  types: 'types/packages/k8s-ui/.ds-sync-pkg/entry.d.ts',
+}, null, 2) + '\n');
+
+writeFileSync(join(OUT, 'stubs/monaco-react.tsx'), `
+impo
```

**File**: `.design-sync/config.json` (added, +412/-0)
```diff
@@ -0,0 +1,412 @@
+{
+  "projectId": "cd66db23-f991-4d87-8ac2-721650c81721",
+  "shape": "package",
+  "pkg": "@skyhook-io/k8s-ui",
+  "globalName": "K8sUI",
+  "buildCmd": "node .design-sync/build-pkg.mjs",
+  "srcDir": "../src",
+  "cssEntry": "styles.css",
+  "extraFonts": [
+    "../../../node_modules/@fontsource-variable/dm-sans/index.css",
+    "../../../node_modules/@fontsource/dm-mono/index.css"
+  ],
+  "componentSrcMap": {
+    "AWSMachineCell": null,
+    "AWSMachineTemplateCell": null,
+    "AWSManagedClusterCell": null,
+    "AWSManagedControlPlaneCell": null,
+    "AWSManagedMachinePoolCell": null,
+    "ApiServerSourceCell": null,
+    "ArgoAppProjectCell": null,
+    "ArgoApplicationCell": null,
+    "ArgoApplicationSetCell": null,
+    "AuthorizationPolicyCell": null,
+    "AzureMachineCell": null,
+    "AzureMachineTemplateCell": null,
+    "AzureManagedClusterCell": null,
+    "AzureManagedControlPlaneCell": null,
+    "AzureManagedMachinePoolCell": null,
+    "BackupCell": null,
+    "BackupRepositoryCell": null,
+    "BackupStorageLocationCell": null,
+    "BrokerCell": null,
+    "CAPIClusterCell": null,
+    "CAPIClusterClassCell": null,
+    "CAPIKubeadmControlPlaneCell": null,
+    "CAPIMachineCell": null,
+    "CAPIMachineDeploymentCell": null,
+    "CAPIMachineHealthCheckCell": null,
+    "CAPIMachinePoolCell": null,
+    "CAPIMachineSetCell": null,
+    "CNPGBackupCell": null,
+    "CNPGClusterCell": null,
+    "CNPGDeclarativeCell": null,
+    "CNPGImageCatalogCell": null,
+    "CNPGObjectStoreCell": null,
+    "CNPGPoolerCell": null,
+    "CNPGScheduledBackupCell": null,
+    "CalicoInfraCell": null,
+    "CalicoPolicyCell": null,
+    "CertificateCell": null,
+    "CertificateRequestCell": null,
+    "ChallengeCell": null,
+    "ChannelCell": null,
+    "ClusterComplianceReportCell": null,
+    "ClusterExternalSecretCell": null,
+    "ClusterIssuerCell": null,
+    "ClusterPolicyCell": null,
+    "ClusterPolicyReportCell": null,
+    "ClusterSecretStoreCell": null,
+    "ClusterTriggerAuthenticationCell": null,
+    "CompositeResourceCell": null,
+    "CompositionCell": null,
+    "ConfigAuditReportCell": null,
+    "ConfigurationCell": null,
+    "ContainerSourceCell": null,
+    "CrossplaneProviderCell": null,
+    "CrossplaneProviderConfigCell": null,
+    "DestinationRuleCell": null,
+    "DeviceClassCell": null,
+    "DomainMappingCell": null,
+    "EC2NodeClassCell": null,
+    "EventTypeCell": null,
+    "ExposedSecretReportCell": null,
+    "ExternalSecretCell": null,
+    "FluxAlertCell": null,
+    "FluxHelmReleaseCell": null,
+    "GCPMachineCell": null,
+    "GCPMachineTemplateCell": null,
+    "GCPManagedClusterCell": null,
+    "GCPManagedControlPlaneCell": null,
+    "GCPManagedMachinePoolCell": null,
+    "GitRepositoryCell": null,
+    "HTTPProxyCell": null,
+    "HelmRepositoryCell": null,
+    "InMemoryChannelCell": null,
+    "IngressRouteCell": null,
+    "IssuerCell": null,
+    "IstioGatewayCell": null,
+    "KnativeCertificateCell": null,
+    "KnativeIngressCell": null,
+    "KnativeServiceCell": null,
+    "KustomizationCell": null,
+    "KyvernoCleanupPolicyCell": null,
+    "KyvernoEphemeralReportCell": null,
+    "KyvernoModernPolicyCell": null,
+    "KyvernoPolicyCell": null,
+    "KyvernoPolicyExceptionCell": null,
+    "KyvernoUpdateRequestCell": null,
+    "ManagedResourceCell": null,
+    "MiddlewareCell": null,
+    "NodeClaimCell": null,
+    "NodePoolCell": null,
+    "NvidiaClusterPolicyCell": null,
+    "NvidiaDriverCell": null,
+    "OCIRepositoryCell": null,
+    "OrderCell": null,
+    "ParallelCell": null,
+    "PeerAuthenticationCell": null,
+    "PingSourceCell": null,
+    "PodMonitorCell": null,
+    "PolicyReportCell": null,
+    "PrometheusRuleCell": null,
+    "RbacAssessmentReportCell": null,
+    "ResourceClaimCell": null,
+    "ResourceClaimTemplateCell": null,
+    "ResourceSliceCell": null,
+    "RestoreCell": null,
+    "RevisionCell": null,
+    "RouteCell": null,
+    "SbomReportCell": null,
+    "ScaledJobCell": null,
+    "ScaledObjectCell": null,
+    "ScheduleCell": null,
+    "SecretStoreCell": null,
+    "SequenceCell": null,
+    "ServerlessServiceCell": null,
+    "ServersTransportCell": null,
+    "ServiceEntryCell": null,
+    "ServiceMonitorCell": null,
+    "SinkBindingCell": null,
+    "SubscriptionCell": null,
+    "TLSOptionCell": null,
+    "TraefikServiceCell": null,
+    "TriggerAuthenticationCell": null,
+    "TriggerCell": null,
+    "TrivySeverityCell": null,
+    "VirtualServiceCell": null,
+    "VolumeSnapshotLocationCell": null,
+    "VulnerabilityReportCell": null,
+    "XRDCell": null,
+    "AdmissionCheckRenderer": "../src/components/resources/renderers/KueueProvisioningRenderers.tsx",
+    "ApiServerSourceRenderer": "../src/components/resources/renderers/KnativeSourceRenderer.tsx",
+    "BrokerRenderer": "../src/components/resources/renderers/KnativeEventingRenderer.tsx",
+    "CNPGDatabaseRe
```

**File**: `.design-sync/conventions.md` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+# Building with Skyhook Radar (`@skyhook-io/k8s-ui`)
+
+This is Radar's Kubernetes UI library — the components behind Skyhook's cluster-visibility product. Every component is on `window.K8sUI.*` (import as `import { Badge, StatusDot } from '@skyhook-io/k8s-ui'`). Build Kubernetes/infra dashboards, resource views, and operational surfaces from these real parts; they map 1:1 onto shippable Radar code.
+
+## Setup & wrapping
+- **No app-wide provider.** Most components (Badge, StatusDot, HealthRing, DistributionBar, Property, Section, CardSection, PageHeader, EmptyState, Facet, charts, every `*Renderer` resource view…) render standalone.
+- **Theme is CSS, not a React provider.** Tokens live on `:root`; default is **light**. For dark mode add `class="dark"` to a root element (`document.documentElement.classList.toggle('dark', isDark)`).
+- Only these need their own provider, and only when used: `ToastProvider` (toasts), `DockProvider` (logs/terminal dock).
+- **App feature components** (from Radar's app, same global): Diagnose/AI investigation (`AnalysisStory`, `ResultCard`, `AllClearCard`, `InconclusiveCard`, `EvidenceCard`, `InvestigationEvidencePane`, `TurnView`, `ApplyDialog`), `ClusterSchedulingCard`, `CurrentAllocationUse`, `TrafficGraph`, `TrafficFilterSidebar`, `TopologyPreview`, Helm `RevisionHistory` / `ValuesDiffPreview` / `ManifestViewer`. They take data as props — see each `.prompt.md` for realistic shapes.
+- YAML editors (`YamlEditor`, `YamlDiffEditor`, `YamlReview`) render as read-only code / line-diff views in designs.
+- Icons: `lucide-react` (Radar's icon set) — e.g. `RefreshCw`, `Trash2`, `CirclePause`. `RowActionMenu` items take an `icon` component.
+
+## Styling idiom — Tailwind v4 utilities over theme tokens
+Style your own layout with these theme classes (never hard-code hex — they adapt to light/dark):
+
+| Purpose | Classes |
+|---|---|
+| Backgrounds | `bg-theme-base` (page) · `bg-theme-surface` (cards/panels) · `bg-theme-elevated` (inputs/dropdowns) · `bg-theme-hover` |
+| Text | `text-theme-text-primary` · `text-theme-text-secondary` · `text-theme-text-tertiary` |
+| Borders | `border-theme-border` · `border-theme-border-light` |
+| Accent | `text-accent` · `bg-accent` · `border-accent` |
+| Fonts | DM Sans is the root default (no class needed) · `font-mono` (DM Mono — IDs, images, metrics, YAML) |
+| Shape | `rounded-md` / `rounded-lg` · `shadow-theme-sm` / `shadow-theme-md` / `shadow-theme-lg` |
+
+Component-layer classes: `.badge` / `.badge-sm`, `.btn-brand` / `.btn-brand-muted` (color + radius only — **add your own padding**, e.g. `px-3 py-1.5 text-sm`), `.card-inner` / `.card-inner-lg`, `.dialog`.
+
+**Status vocabulary is first-class — never invent status colors.** Health tones: `healthy` (green) → `degraded` (amber) → `alert` (orange) → `unhealthy` (red), plus `neutral` and `unknown`. Use `<StatusDot tone="degraded" />`, the `.status-healthy|degraded|alert|unhealthy|neutral|unknown` classes, or `<Badge severity="success|info|warning|alert|error|neutral">`. For Kubernetes kinds use `<Badge kind="Deployment">` (per-kind colors).
+
+## Where the truth lives
+`styles.css` imports the compiled stylesheet (`_ds_bundle.css`) that defines every token (`--bg-*`, `--text-*`, `--border-*`, `--accent`) and the classes above. Per-component API is in each `<Name>.d.ts`; usage with realistic examples in `<Name>.prompt.md`.
+
+## Idiomatic example
+```tsx
+import { PageHeader, Badge, StatusDot, Property } from '@skyhook-io/k8s-ui'
+
+export function WorkloadPanel() {
+  return (
+    <div className="bg-theme-surface border border-theme-border rounded-lg p-4">
+      <PageHeader title="checkout-api" description="Deployment · namespace payments" />
+      <div className="flex items-center gap-2 mt-2">
+        <Badge kind="Deployment">Deployment</Badge>
+        <Badge severity="alert">Degraded</Badge>
+      </div>
+      <div className="flex items-center gap-2 mt-3 text-sm text-theme-text-secondary">
+        <StatusDot tone="degraded" /> 2 / 3 pods ready
+      </div>
+      <Property label="Image" value="ghcr.io/acme/checkout:1.14.2" />
+    </div>
+  )
+}
+```
+Compose Radar's real parts for the UI; use the theme classes above only for your own layout glue.
+
+Only utilities Radar itself uses are compiled into the stylesheet; prefer the classes above and common layout utilities (`flex`, `gap-*`, `p-*`, `text-sm`/`text-xs`), and fall back to inline `style` for anything unusual.
```

**File**: `.design-sync/previews/AgentControls.tsx` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { useState } from 'react'
+import { AgentControls } from '@skyhook-io/k8s-ui'
+
+const wrap = { width: 380, padding: 12 }
+
+const claude = {
+  name: 'claude', label: 'Claude Code', path: '/opt/homebrew/bin/claude', version: '2.1.4',
+  present: true, supported: true, profiles: ['safeguarded', 'full-local'] as const,
+}
+const codex = {
+  name: 'codex', label: 'Codex', path: '/usr/local/bin/codex', version: '0.46.0',
+  present: true, supported: true, profiles: ['safeguarded', 'full-local'] as const,
+}
+const cursor = {
+  name: 'cursor-agent', label: 'Cursor', path: '/usr/local/bin/cursor-agent', version: '2025.10.2',
+  present: true, supported: true, profiles: ['full-local'] as const,
+}
+const agents = [claude, codex, cursor].map((a) => ({ ...a, profiles: [...a.profiles] }))
+
+function Controls({ agent, profile, model = '', effort = '' }: { agent: string; profile: 'safeguarded' | 'full-local'; model?: string; effort?: string }) {
+  const [a, setA] = useState(agent)
+  const [p, setP] = useState(profile)
+  const [m, setM] = useState(model)
+  const [e, setE] = useState(effort)
+  return (
+    <div style={wrap}>
+      <AgentControls
+        agents={agents}
+        selectedAgent={a}
+        onSelectAgent={(v) => { setA(v); setM(''); setE('') }}
+        profile={p}
+        onSetProfile={setP}
+        model={m}
+        onSetModel={setM}
+        effort={e}
+        onSetEffort={setE}
+      />
+    </div>
+  )
+}
+
+export function ClaudeSafeguarded() {
+  return <Controls agent="claude" profile="safeguarded" model="sonnet" />
+}
+
+export function CodexFullLocal() {
+  return <Controls agent="codex" profile="full-local" model="gpt-5-codex" effort="high" />
+}
+
+export function CursorOnlyFullLocal() {
+  return <Controls agent="cursor-agent" profile="full-local" />
+}
```

**File**: `.design-sync/previews/AlertBanner.tsx` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import { AlertBanner } from '@skyhook-io/k8s-ui'
+import { ShieldAlert } from 'lucide-react'
+
+const wrap = { width: 480 }
+
+export function Variants() {
+  return (
+    <div style={wrap}>
+      <AlertBanner
+        variant="error"
+        title="Gateway Not Accepted"
+        message={<><span className="font-medium">InvalidParameters: </span>GatewayClass "istio" does not support listener protocol UDP.</>}
+      />
+      <AlertBanner
+        variant="warning"
+        title="Gateway Not Programmed"
+        message={<><span className="font-medium">Pending: </span>Waiting for the load balancer address to be assigned.</>}
+      />
+      <AlertBanner variant="info" title="Suspended" message="Reconciliation is paused; changes in Git will not be applied until resumed." />
+      <AlertBanner variant="success" title="Workflow Completed Successfully" />
+    </div>
+  )
+}
+
+export function WithItems() {
+  return (
+    <div style={wrap}>
+      <AlertBanner
+        variant="error"
+        title="Backup Failed"
+        items={[
+          'Invalid included/excluded namespace lists: namespace "paymnts" not found',
+          'BackupStorageLocation "aws-us-east-1" is unavailable',
+        ]}
+      />
+    </div>
+  )
+}
+
+export function CustomIcon() {
+  return (
+    <div style={wrap}>
+      <AlertBanner
+        variant="warning"
+        icon={ShieldAlert}
+        title="Policy violations in payments"
+        message="3 resources fail require-requests-limits. Admission is set to Audit, so they were not blocked."
+      />
+    </div>
+  )
+}
```

**File**: `.design-sync/previews/AllClearCard.tsx` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import { AllClearCard } from '@skyhook-io/k8s-ui'
+
+const wrap = { width: 540, padding: 8 }
+const noop = () => {}
+
+export function NoProblemFound() {
+  return (
+    <div style={wrap}>
+      <AllClearCard
+        animate={false}
+        showDisclaimer
+        coverageLimited={false}
+        evidenceConflict={false}
+        diagnosis={{
+          healthy: true,
+          rootCause: '',
+          report: 'All 3 replicas of `payments/checkout-api` are Ready, no restarts in the last 6h, and recent logs show only request traffic.',
+          remediation: [],
+        }}
+      />
+    </div>
+  )
+}
+
+export function CoverageLimited() {
+  return (
+    <div style={wrap}>
+      <AllClearCard
+        animate={false}
+        showDisclaimer
+        coverageLimited
+        evidenceConflict={false}
+        diagnosis={{
+          healthy: true,
+          rootCause: '',
+          report: 'Pods are Running and Ready; events show no warnings. Logs could not be read (403 on `pods/log`).',
+          remediation: [],
+        }}
+      />
+    </div>
+  )
+}
+
+export function EvidenceConflict() {
+  return (
+    <div style={wrap}>
+      <AllClearCard
+        animate={false}
+        showDisclaimer
+        coverageLimited={false}
+        evidenceConflict
+        diagnosis={{
+          healthy: true,
+          rootCause: '',
+          report: 'The Deployment reports 3/3 available replicas and the rollout completed.',
+          remediation: [],
+        }}
+      />
+    </div>
+  )
+}
+
+export function StoryWithSignals() {
+  return (
+    <div style={wrap}>
+      <AllClearCard
+        animate={false}
+        showDisclaimer
+        coverageLimited={false}
+        evidenceConflict={false}
+        onRevealSource={noop}
+        diagnosis={{
+          healthy: true,
+          summary: 'checkout-api is healthy — the restarts you saw were a one-off node drain this morning.',
+          certainty: 'established',
+          rootCause: '',
+          report: 'All replicas are Ready. [[radar:evidence=1]]',
+          remediation: [],
+        }}
+        healthSignals={[
+          { title: 'Pod checkout-api-7d9f8c6b5-x2kqp restarts', status: 'explained', sourceId: 's1', claim: 'the 2 restarts at 06:12 line up with node ip-10-0-3-41 draining; none since.' },
+          { title: 'Warning event FailedScheduling', status: 'unaddressed', sourceId: 's2' },
+        ]}
+      />
+    </div>
+  )
+}
```

**File**: `.design-sync/previews/AnalysisStory.tsx` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+import { AnalysisStory, EvidenceCard, RuledOutBlock } from '@skyhook-io/k8s-ui'
+
+// Investigation of Deployment payments/checkout-api crash-looping after the
+// v2.15.0 rollout. Shapes match what Radar's evidence projection produces
+// from the agent's diagnose / get_pod_logs / get_resource calls.
+const POD = 'checkout-api-7d9f8c6b5-x2kqp'
+const TARGET = 'deployment payments/checkout-api'
+
+function source(stepId: string, tool: string, args: object, order: number, primaryGroupId: string | undefined, evidenceRef: string) {
+  return {
+    id: `turn-0-step-${stepId}`, turnIndex: 0, timelineIndex: order, stepId, tool, args: JSON.stringify(args),
+    order, phase: 'initial' as const, confirmedSuccess: true, evidenceRef, primaryGroupId,
+  }
+}
+function group(id: string, kind: string, source: ReturnType<typeof source>, o: Record<string, unknown>) {
+  const observation = { source, revision: 1, historical: false, changedFromPrevious: false, ...o } as any
+  return { id, identity: id, kind, historical: false, firstOrder: source.order, observations: [observation], latest: observation, chronologicalLatest: observation } as any
+}
+
+const diagnoseCall = source('diag-1', 'diagnose', { kind: 'deployment', namespace: 'payments', name: 'checkout-api' }, 0, 'evidence-issue-crashloop', 'ev_diag1')
+const logsCall = source('logs-1', 'get_pod_logs', { namespace: 'payments', name: POD, container: 'checkout-api', previous: true, tail_lines: 100 }, 1, 'evidence-logs-previous', 'ev_logs1')
+const nodeCall = source('node-1', 'get_resource', { kind: 'node', name: 'ip-10-0-3-41.ec2.internal' }, 2, 'evidence-node', 'ev_node1')
+
+const issueGroup = group('evidence-issue-crashloop', 'issue', diagnoseCall, {
+  tier: 'key', tone: 'error', relevance: 'target', title: 'CrashLoopBackOff',
+  summary: '3/3 pods of checkout-api are in CrashLoopBackOff (container checkout-api restarted 14 times).',
+  data: { type: 'issue', relevance: 'target', issue: {
+    id: 'issue-checkout-crash', severity: 'critical', source: 'problem', category: 'crashloop', category_group: 'runtime', grouping_scope: 'workload',
+    kind: 'Deployment', group: 'apps', namespace: 'payments', name: 'checkout-api', reason: 'CrashLoopBackOff',
+    message: '3/3 pods of checkout-api are in CrashLoopBackOff (container checkout-api restarted 14 times).',
+  } },
+})
+const deploymentGroup = group('evidence-deployment', 'resource', diagnoseCall, {
+  tier: 'supporting', relevance: 'target', tone: 'error', title: 'Deployment payments/checkout-api', summary: '0/3 replicas ready',
+  data: { type: 'resource', warnings: [],
+    resource: { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { namespace: 'payments', name: 'checkout-api' }, spec: { replicas: 3 }, status: { replicas: 3, readyReplicas: 0, unavailableReplicas: 3 } },
+    resourceContext: { tier: 'diagnostic', issueSummary: { count: 1, highestSeverity: 'critical', topReason: 'CrashLoopBackOff' }, workloadSummary: { replicas: { desired: 3, ready: 0, available: 0, unavailable: 3 } } },
+  },
+})
+const crashGroup = group('evidence-crash-oomkilled', 'crash', diagnoseCall, {
+  tier: 'key', relevance: 'producer-related', tone: 'error', title: 'checkout-api OOMKilled',
+  summary: 'INFO  c.a.checkout.cache.ProductCache - warming product cache (48,210 SKUs)',
+  data: { type: 'crash', namespace: 'payments', crash: {
+    pods: [POD, 'checkout-api-7d9f8c6b5-m4v7t', 'checkout-api-7d9f8c6b5-zq8wn'], container: 'checkout-api', state: 'terminated', reason: 'OOMKilled', exitCode: 137,
+    logLine: 'INFO  c.a.checkout.cache.ProductCache - warming product cache (48,210 SKUs)', logSource: 'previous', logLineSelection: 'log_tail',
+  } },
+})
+const eventsGroup = group('evidence-events', 'events', diagnoseCall, {
+  tier: 'supporting', relevance: 'producer-related', tone: 'warning', title: 'Kubernetes events',
+  summary: `BackOff: Back-off restarting failed container checkout-api in pod ${POD} · 2 event groups · ${TARGET}`,
+  data: { type: 'events', scope: TARGET, events: [
+    { reason: 'BackOff', message: `Back-off restarting failed container checkout-api in pod ${POD}`, type: 'Warning', count: 14, lastTimestamp: '2026-09-28T09:41:12Z' },
+    { reason: 'Pulled', message: 'Container image "ghcr.io/acme/checkout-api:v2.15.0" already present on machine', type: 'Normal', count: 15, lastTimestamp: '2026-09-28T09:40:31Z' },
+  ] },
+})
+const changesGroup = group('evidence-changes', 'changes', diagnoseCall, {
+  tier: 'context', relevance: 'producer-related', tone: 'info', title: 'Recent changes', summary: `1 change · ${TARGET}`,
+  data: { type: 'changes', scope: TARGET, subject: { kind: 'Deployment', namespace: 'payments', name: 'checkout-api' }, changes: [
+    { kind: 'Deployment', namespace: 'payments', name: 'checkout-api', changeType: 'update', timestamp: '2026-09-28T09:12:04Z', summary: 'image ghcr.io/acme/checkout-api:v2.14.1 → v2.15.0' },
+  ] },
+})
+const logsGroup = group('evidence-logs
```

---

### Incident Patch 14: `02e30aff` (2026-09-26)
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

**File**: `packages/k8s-ui/src/components/resources/renderers/RolloutRenderer.test.tsx` (modified, +1/-1)
```diff
@@ -371,7 +371,7 @@ describe('rolloutActions promote reachability', () => {
 
   it('blocks promote, promote-full and skip-step alike on an aborted rollout', () => {
     const data = canaryRollout({ phase: 'Degraded', abort: true, currentStepIndex: 1 })
-    for (const action of ['promote', 'promote-full', 'skip-step']) {
+    for (const action of ['promote', 'promote-full', 'skip-step'] as const) {
       expect(blockedReason(data, action)).toBe('Retry the rollout first')
     }
   })
```

**File**: `packages/k8s-ui/src/components/shared/ResourceRendererDispatch.test.tsx` (modified, +3/-5)
```diff
@@ -315,11 +315,9 @@ describe('getResourceStatus — colliding plurals', () => {
   // fine; being scored with Argo's vocabulary is not, because that attaches a
   // HealthLevel derived from a phase Katib never reports.
   it('does not score a Katib Experiment with the Argo vocabulary', () => {
-    const katib = getResourceStatus('experiments', {
-      apiVersion: 'kubeflow.org/v1beta1',
-      status: { conditions: [{ type: 'Running', status: 'True' }] },
-    })
-    expect(katib?.level).toBeUndefined()
+    const katib = { apiVersion: 'kubeflow.org/v1beta1', status: { conditions: [{ type: 'Running', status: 'True' }] } }
+    // Read the way any unrelated CRD with the same status would be.
+    expect(getResourceStatus('experiments', katib)).toEqual(getResourceStatus('trainingruns', katib))
   })
 
   it('fabricates no engine status for a third-party backups CRD', () => {
```

**File**: `packages/k8s-ui/src/components/shared/revision-role-badges.test.ts` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ describe('offersPromoteAfterRollback', () => {
 })
 
 function revision(overrides: Partial<WorkloadRevision>): WorkloadRevision {
-  return { number: 1, image: 'web:v1', createdAt: '2026-08-07T00:00:00Z', ...overrides }
+  return { number: 1, image: 'web:v1', createdAt: '2026-08-07T00:00:00Z', isCurrent: false, replicas: 0, ...overrides }
 }
 
 describe('revisionRoleBadges', () => {
```

---

### Incident Patch 15: `f3aa4cca` (2026-09-25)
**Commit Message**: Serve KueueAdmissionSection through k8s-ui's exports map (#1903)

## Summary

`@skyhook-io/radar-app` 1.14.6 doesn't build in a consumer that installs
the published packages. Radar Hub's build fails with:

```
Rolldown failed to resolve import "@skyhook-io/k8s-ui/components/resources/KueueAdmissionSection"
from ".../@skyhook-io/radar-app/src/components/execution/JobSetAdmission.tsx"
```

k8s-ui's `./components/resources/*` export lists `*.ts` before `*.tsx`.
Node and bundlers resolve an array target to its first entry and don't
fall back when that file is missing. `KueueAdmissionSection` is the only
`.tsx` file radar-app imports through that pattern, and the import is
new in 1.14.6. Radar's own build never sees this because it aliases
k8s-ui to its source.

## What changed

- **Fix:** an explicit `exports` entry for
`./components/resources/KueueAdmissionSection`. A specific key takes
precedence over the wildcard, so the published radar-app 1.14.6 works as
soon as consumers get a k8s-ui with this entry; its peer range
(`>=1.14.8`) already allows it, and no radar-app release is needed.
- **Guard:** `web/src/k8s-ui-exports.test.ts` resolves every
`@skyhook-io/k8s-ui/...` specifier in 

**File**: `packages/k8s-ui/package.json` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@
       "./src/components/resources/*.ts",
       "./src/components/resources/*.tsx"
     ],
+    "./components/resources/KueueAdmissionSection": "./src/components/resources/KueueAdmissionSection.tsx",
     "./components/resources/renderers/*": [
       "./src/components/resources/renderers/*.tsx",
       "./src/components/resources/renderers/*.ts"
```

**File**: `web/src/k8s-ui-exports.test.ts` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+/// <reference types="node" />
+import { describe, expect, test } from 'vitest'
+import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
+import { dirname, join, resolve } from 'node:path'
+import { fileURLToPath } from 'node:url'
+
+// Radar's own build aliases @skyhook-io/k8s-ui to its source, so a deep
+// import that the package's `exports` map can't serve still builds here and
+// only fails in a consumer that installs the published packages (Radar Hub).
+// This resolves every deep import the way Node and bundlers do: the most
+// specific matching key wins, and an array target resolves to its first entry
+// without falling back when that file doesn't exist.
+
+const here = dirname(fileURLToPath(import.meta.url))
+const k8sUiRoot = resolve(here, '../../packages/k8s-ui')
+const exportsMap: Record<string, string | string[]> = JSON.parse(
+  readFileSync(join(k8sUiRoot, 'package.json'), 'utf8'),
+).exports
+
+function resolveExport(subpath: string): string | undefined {
+  const key = `./${subpath}`
+  let target = exportsMap[key]
+  let star: string | undefined
+  if (target === undefined) {
+    let best = ''
+    for (const pattern of Object.keys(exportsMap)) {
+      const i = pattern.indexOf('*')
+      if (i < 0) continue
+      const prefix = pattern.slice(0, i)
+      const suffix = pattern.slice(i + 1)
+      if (key.startsWith(prefix) && key.endsWith(suffix) && key.length >= prefix.length + suffix.length && prefix.length > best.length) {
+        best = prefix
+        target = exportsMap[pattern]
+        star = key.slice(prefix.length, key.length - suffix.length)
+      }
+    }
+  }
+  if (target === undefined) return undefined
+  const first = Array.isArray(target) ? target[0] : target
+  return join(k8sUiRoot, star === undefined ? first : first.split('*').join(star))
+}
+
+// Everything radar-app publishes that can import from k8s-ui, stylesheets
+// included (vitest doesn't load CSS, so these are read from disk).
+function sourceFiles(dir: string): string[] {
+  return readdirSync(dir).flatMap((name) => {
+    const path = join(dir, name)
+    if (statSync(path).isDirectory()) return sourceFiles(path)
+    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : []
+  })
+}
+
+describe('@skyhook-io/k8s-ui deep imports', () => {
+  const imports = new Set<string>()
+  for (const file of sourceFiles(here)) {
+    // Any quoted specifier: `from` imports, side-effect and dynamic imports,
+    // and stylesheet @imports all resolve through the same map.
+    for (const m of readFileSync(file, 'utf8').matchAll(/['"]@skyhook-io\/k8s-ui\/([^'"]+)['"]/g)) {
+      imports.add(m[1])
+    }
+  }
+
+  test('finds the deep imports it checks, stylesheets included', () => {
+    expect(imports.size).toBeGreaterThan(10)
+    expect(imports).toContain('theme/variables.css')
+  })
+
+  test.each([...imports].sort())('%s resolves through the published exports map', (subpath) => {
+    const file = resolveExport(subpath)
+    expect(file, `no exports entry serves "@skyhook-io/k8s-ui/${subpath}"`).toBeDefined()
+    expect(existsSync(file!), `"@skyhook-io/k8s-ui/${subpath}" resolves to missing ${file}`).toBe(true)
+  })
+})
```

#### Recent Merged Pull Requests:
- **PR #1973** (2026-10-05): Rename the Cloud AI group to radar:ai:reader before 1.16.0 (@nadaverell)
- **PR #1971** (2026-10-04): Close the review gaps from #1899: Cloud role gates, Helm write checks, no-access banner (@nadaverell)
- **PR #1970** (2026-10-04): Stop calling the investigations page a workspace (@nadaverell)
- **PR #1969** (2026-10-04): Share the workspace building blocks extracted from the CloudNativePG workspace (@nadaverell)
- **PR #1968** (2026-10-03): Move focus into a new settings draft in the same commit (@nadaverell)
- **PR #1967** (2026-10-04): fix(issues): one stable issue per restart loop (@nadaverell)
- **PR #1966** (2026-10-03): Settings follow-ups: dropdown keyboard and names, per-identity reviews, auto-discovery in the cluster list (@nadaverell)
- **PR #1965** (2026-10-02): feat(helm): add extraArgs to pass through flags the chart does not expose (@ibra-coul)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
