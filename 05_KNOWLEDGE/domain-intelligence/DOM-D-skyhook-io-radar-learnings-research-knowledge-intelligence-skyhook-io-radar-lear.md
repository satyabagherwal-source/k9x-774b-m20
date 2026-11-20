# Domain D — Research & Knowledge Intelligence: Research & Knowledge Intelligence: skyhook-io-radar-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "skyhook-io-radar-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T22:42:05.904Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-skyhook-io-radar-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyhook-io-radar-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T22:42:05.904Z`  
> **Learning ID**: `LEARN-EVO-skyhook-io-radar-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain D (Research & Knowledge Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), L (Deployment & Operations Intelligence), H (Technical Construction Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence), E (Creative Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from skyhook-io-radar-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/skyhook-io-radar-learnings.md`  
> **Source**: github ([https://github.com/skyhook-io/radar](https://github.com/skyhook-io/radar))  
> **Source Version**: `778697dd`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T22:41:36.064Z  
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
> **Harvest Timestamp**: 2026-11-20T22:39:43.758Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skyhook-io/radar`
- **Description**: The missing open-source Kubernetes UI with a built-in MCP server for AI agents. See what's broken, why, and what changed. Issues, Topology, event timeline, Helm, GitOps, live service traffic, and cluster audits - all in one Go binary.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4174 stars

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

### Incident Patch 1: `d7903f85` (2026-11-20)
**Commit Message**: fix(traffic): no Forwarded verdict for Beyla flows, and keep the end of long node titles (#2759)

## Description

Two small display fixes for the traffic map.

- **Beyla flows no longer read `Forwarded`.** Beyla observes traffic and
makes no datapath decision, but its flows defaulted to `Verdict:
"forwarded"` in three places in `internal/traffic/beyla.go`. Those
defaults are gone, and `error` is still set from the error rate. The
flow list shows a muted "—" for a flow with no verdict.
- Go aggregation already skips an empty verdict, so `verdictCounts`
holds only `error`.
- `verdictChoices` offers only "Error" for Beyla, or no chip when there
are no errors.
- Edge filtering and colouring read `verdictCounts`, so they are
unchanged.
- Hubble keeps its verdicts. Istio and Caretta still default to
`forwarded`; I left them out of this change.
- **Node titles keep their end.** Workloads of one release share a long
prefix, so a trailing ellipsis made them all read `<release>…`. The node
title now uses the existing `MiddleEllipsis` from k8s-ui, with the full
name as `title`. The component is shared with the other sources, which
helps them too.

The Source and Destination columns of the flo

**File**: `internal/traffic/beyla.go` (modified, +0/-3)
```diff
@@ -1118,7 +1118,6 @@ func (s *BeylaSource) queryUnorientable(ctx context.Context, opts FlowOptions, s
 			Source:      Endpoint{Name: conv.key.srcWorkload, Namespace: conv.key.srcNs, Kind: mapBeylaKind(att.srcType), Workload: conv.key.srcWorkload},
 			Destination: Endpoint{Name: conv.key.dstWorkload, Namespace: conv.key.dstNs, Kind: mapBeylaKind(att.dstType), Workload: conv.key.dstWorkload},
 			Protocol:    mapBeylaTransport(conv.transport),
-			Verdict:     "forwarded",
 			LastSeen:    time.Now(),
 			BytesSent:   h.forward,
 			BytesRecv:   h.backward,
@@ -1314,7 +1313,6 @@ func (s *BeylaSource) parseL4Flows(result *prom.QueryResult, w rateWindow) (map[
 			Destination: Endpoint{Name: dstName, Namespace: dstNs, Kind: mapBeylaKind(dstType), Workload: dstName, Port: port},
 			Protocol:    mapBeylaTransport(labels["transport"]),
 			Port:        port,
-			Verdict:     "forwarded",
 			LastSeen:    time.Now(),
 			BytesSent:   int64(val * w.seconds),
 			// Deliberately not set here. Beyla exports rates, not connection counts,
@@ -1379,7 +1377,6 @@ func (s *BeylaSource) parseL7Flows(result *prom.QueryResult) []Flow {
 			HTTPMethod:  labels["http_request_method"],
 			HTTPPath:    labels["http_route"],
 			HTTPStatus:  parseIntLabel(labels["http_response_status_code"]),
-			Verdict:     "forwarded",
 			LastSeen:    time.Now(),
 			// val is a per-second request rate over a 5m window, not a
 			// connection count; Connections here is only a non-zero weight for
```

**File**: `internal/traffic/beyla_test.go` (modified, +4/-1)
```diff
@@ -194,7 +194,8 @@ func TestBeylaSource_GetFlows_OwnerLevel(t *testing.T) {
 	assertEq(t, "dest kind", f.Destination.Kind, "Workload")
 	assertEq(t, "port", fmt.Sprintf("%d", f.Port), "8080")
 	assertEq(t, "protocol", f.Protocol, "tcp")
-	assertEq(t, "verdict", f.Verdict, "forwarded")
+	// Beyla observes traffic, not a datapath decision: no error, no verdict.
+	assertEq(t, "verdict", f.Verdict, "")
 	// No HTTP data on this edge, so there is no rate to report. Beyla exports no
 	// connection count at all, and a placeholder here would drive edge thickness
 	// and the node totals from a number nothing measured.
@@ -641,6 +642,7 @@ func TestBeylaSource_ParseL7Flows_OwnerFallback(t *testing.T) {
 			}
 			assertEq(t, "dest name", flows[0].Destination.Name, tt.wantName)
 			assertEq(t, "dest kind", flows[0].Destination.Kind, tt.wantKind)
+			assertEq(t, "verdict", flows[0].Verdict, "")
 		})
 	}
 }
@@ -1263,6 +1265,7 @@ func TestBeylaSource_GetFlows_UnorientableConversationBecomesOneUndirectedEdge(t
 		t.Error("the edge must declare that its direction is unknown, or the graph will draw an arrow")
 	}
 	assertEq(t, "protocol", f.Protocol, "udp")
+	assertEq(t, "verdict", f.Verdict, "")
 	// Endpoints are ordered deterministically so the edge does not flip between
 	// polls; demo/client sorts before kube-system/coredns.
 	assertEq(t, "source", f.Source.Name, "client")
```

**File**: `packages/k8s-ui/src/types/core.ts` (modified, +1/-1)
```diff
@@ -1684,7 +1684,7 @@ export interface TrafficFlow {
    *  measures a rate rather than observing individual responses, so it has a
    *  status code for no single flow. */
   errorRate?: number
-  verdict: string // forwarded, dropped, error
+  verdict: string // forwarded, dropped, error; empty when the source reports none
   /** The network plugin's own account of which policies decided this flow
    *  (Hubble reports it). Absent when the plugin said nothing. */
   policyVerdict?: {
```

**File**: `pkg/traffic/types.go` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ type Flow struct {
 	// The graph draws these without an arrowhead: the traffic is real, only its
 	// direction is not known.
 	DirectionUnknown bool   `json:"directionUnknown,omitempty"`
-	Verdict          string `json:"verdict"` // forwarded, dropped, error
+	Verdict          string `json:"verdict"` // forwarded, dropped, error; empty when the source reports none
 	// PolicyVerdict is the network plugin's own account of which policies
 	// decided this flow, when it reports one (Hubble does). It is the ground
 	// truth a static evaluation can only approximate, and it names policy
```

**File**: `web/src/components/traffic/TrafficFlowList.tsx` (modified, +8/-4)
```diff
@@ -224,10 +224,14 @@ export function TrafficFlowList({ flows, responsesCallerOriented }: TrafficFlowL
                     {flow.latencyNs && flow.latencyNs > 0 ? formatLatency(flow.latencyNs) : '—'}
                   </span>
 
-                  {/* Verdict */}
-                  <span className={clsx('text-right badge badge-sm text-[10px] capitalize', VERDICT_BADGE[flow.verdict] ?? SEVERITY_BADGE.neutral)}>
-                    {flow.verdict}
-                  </span>
+                  {/* Verdict: sources that only observe traffic (Beyla) report none */}
+                  {flow.verdict ? (
+                    <span className={clsx('text-right badge badge-sm text-[10px] capitalize', VERDICT_BADGE[flow.verdict] ?? SEVERITY_BADGE.neutral)}>
+                      {flow.verdict}
+                    </span>
+                  ) : (
+                    <span className="text-right text-theme-text-tertiary">—</span>
+                  )}
                 </button>
 
                 {/* Expanded detail */}
```

**File**: `web/src/components/traffic/TrafficGraph.test.tsx` (modified, +31/-1)
```diff
@@ -4,7 +4,7 @@ import { createRoot, type Root } from 'react-dom/client'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import type { Edge, Node } from '@xyflow/react'
 import type { AggregatedFlow } from '../../types'
-import { TrafficGraph } from './TrafficGraph'
+import { TrafficGraph, TrafficNode } from './TrafficGraph'
 import { endpointPair, groupAddonFlows } from './trafficFilters'
 
 const { fitView } = vi.hoisted(() => ({ fitView: vi.fn() }))
@@ -267,3 +267,33 @@ describe('TrafficGraph edge labels for traffic measured only in bytes', () => {
     expect(container.querySelector('[data-edge]')!.textContent).toBe('TCP · 2.4 KB/s · UDP · <1 B/s')
   })
 })
+
+describe('TrafficNode title', () => {
+  // jsdom has no layout or canvas: give the title 100px and every glyph 7px.
+  beforeEach(() => {
+    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
+    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
+      { font: '', measureText: (t: string) => ({ width: t.length * 7 }) } as unknown as CanvasRenderingContext2D)
+    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100 } as DOMRect)
+  })
+  afterEach(() => vi.restoreAllMocks())
+
+  it('keeps the end of a long name, so names sharing a prefix stay apart', () => {
+    const titles = ['checkout-platform-release-engine', 'checkout-platform-release-redis'].map(label => {
+      act(() => root.render(<TrafficNode data={{ label, namespace: 'demo', kind: 'Deployment' }} />))
+      const title = container.querySelector(`[title="${label}"]`)!
+      return title.lastElementChild!.textContent!
+    })
+    expect(titles[0]).toBe('checko…engine')
+    expect(titles[1]).toMatch(/redis$/)
+    expect(titles[0]).not.toBe(titles[1])
+  })
+
+  it('gives screen readers the full name, not the cut one', () => {
+    const label = 'checkout-platform-release-engine'
+    act(() => root.render(<TrafficNode data={{ label, namespace: 'demo', kind: 'Deployment' }} />))
+    const srOnly = container.querySelector('.sr-only')
+    expect(srOnly?.textContent).toBe(label)
+    expect(container.querySelector(`[title="${label}"]`)!.closest('[aria-hidden="true"]')).not.toBeNull()
+  })
+})
```

**File**: `web/src/components/traffic/TrafficGraph.tsx` (modified, +11/-6)
```diff
@@ -19,7 +19,7 @@ import type { ELK } from 'elkjs/lib/elk.bundled.js'
 import type { AggregatedFlow } from '../../types'
 import { clsx } from 'clsx'
 import { X, ArrowRight, Globe, Server, Activity, Puzzle, Crosshair } from 'lucide-react'
-import { PaneLoader } from '@skyhook-io/k8s-ui'
+import { MiddleEllipsis, PaneLoader } from '@skyhook-io/k8s-ui'
 import { isClusterAddon, type AddonMode } from './TrafficView'
 import { SEVERITY_BADGE, SEVERITY_DOT, SEVERITY_TEXT } from '@skyhook-io/k8s-ui/utils/badge-colors'
 import { getNamespaceColor } from '../../utils/traffic-colors'
@@ -208,7 +208,7 @@ const NODE_PORT_HEIGHT = 18 // Height per port row
 const MAX_VISIBLE_PORTS = 4 // Maximum ports to show before "+N more"
 
 // Custom node component
-function TrafficNode({ data }: { data: TrafficNodeData }) {
+export function TrafficNode({ data }: { data: TrafficNodeData }) {
   const isExternal = isExternalKind(data.kind)
   const isInternet = data.kind === 'Internet'
   const isAddonInternet = data.kind === 'AddonInternet' // Separate internet for addon traffic
@@ -269,10 +269,15 @@ function TrafficNode({ data }: { data: TrafficNodeData }) {
           />
         )}
         <div className="flex-1 min-w-0">
-          <div className={clsx(
-            'text-sm font-medium truncate',
-            isAddonInternet ? 'text-purple-300' : isInternet ? 'text-sky-300' : (isAddon || isAddonNode) ? 'text-purple-200' : hasNamespaceColor ? 'text-white' : 'text-theme-text-primary'
-          )}>{data.label}</div>
+          {/* Middle-cut: workloads of one release share a long prefix and differ only at the end.
+              MiddleEllipsis exposes only the cut text, so screen readers get the full name instead. */}
+          <span className="sr-only">{data.label}</span>
+          <div aria-hidden="true">
+            <MiddleEllipsis text={data.label} title={data.label} className={clsx(
+              'text-sm font-medium',
+              isAddonInternet ? 'text-purple-300' : isInternet ? 'text-sky-300' : (isAddon || isAddonNode) ? 'text-purple-200' : hasNamespaceColor ? 'text-white' : 'text-theme-text-primary'
+            )} />
+          </div>
           {data.namespace ? (
             <div className={clsx(
               'text-xs truncate',
```

**File**: `web/src/components/traffic/trafficFilters.ts` (modified, +4/-4)
```diff
@@ -836,10 +836,10 @@ export function connectionRows<T extends AggregatedFlow>(flows: T[]): T[] {
 }
 
 /**
- * The verdict filter's choices, from the verdicts the flows contain. Caretta,
- * Beyla and Istio report every flow forwarded unless they saw an error, so when
- * forwarded is the only verdict present the filter would match everything and
- * none is offered. Any other verdict, even one without a chip of its own (Hubble
+ * The verdict filter's choices, from the verdicts the flows contain. Caretta
+ * and Istio report every flow forwarded unless they saw an error, and Beyla
+ * reports no verdict unless it saw one, so when forwarded is the only verdict
+ * present the filter would match everything and none is offered. Any other verdict, even one without a chip of its own (Hubble
  * also reports redirected, audit and more), makes Forwarded a real choice.
  */
 export function verdictChoices(seen: Iterable<string>): string[] {
```

---

### Incident Patch 2: `81e74dc3` (2026-11-20)
**Commit Message**: Show what depends on a Flux Kustomization or HelmRelease, and flag a revision that isn't the last successful apply (#2630)

## Description

Two small gaps on the Flux drawers (#2629).

### What changes

- **`spec.dependsOn` becomes a dependency edge.** `addFluxSourceEdges`
(`pkg/topology/flux_sources.go`) already turns a Flux object's source
references into `declaredDependency` edges. It now also adds one per
`spec.dependsOn` entry on a Kustomization or HelmRelease. The object
depended on shows the dependent under **Required By** in Related
Resources; the dependent shows it under **Depends On**.
- The target is the root's own kind and API group, the only thing Flux
accepts there. An entry without a namespace means the root's namespace.
- A missing target adds nothing, the same as source references
(`addObservedDependencyEdges` only links nodes that exist). A
self-reference is skipped.
- **Revision visible by default, with a marker.** The Kustomization
**Revision** and HelmRelease **Revision Info** sections open by default.
When the attempted revision differs from the applied one, it gets a `not
the last successful apply` badge. The revision text wraps next to the
badge, so a long G

**File**: `docs/gitops.md` (modified, +1/-0)
```diff
@@ -360,6 +360,7 @@ Scoping and lifecycle:
 The GitOps tab isn't the only place Argo/Flux ownership matters. Surfaces across Radar know about GitOps and route into the right detail page when they should:
 
 - **K8s resource drawer** — the header chip reads `relationships.ownership.manager` ([states](ownership.md#what-manages-an-object)): **Managed by** for `agree`, **Listed by** for `listed` and `shared`, **Tracked by** for `claimed` and `disagree` (with a warning for `disagree`), and **via <Kind>** when a controller ancestor answers. `unknown`/`none` show no chip; native Helm keeps its Helm chip. The tooltip says what names each manager; the manager's sync status shows only for `agree`. Several candidates open a menu naming each; only managers Radar found are linked, and an Application's namespace is never guessed. Older Radars without the answer keep the metadata-based chip. For a Flux manager, the tooltip of a **Tracked by** chip says what its inventory shows. A Kustomization whose `status.inventory` doesn't list the object usually means the object was removed from the source while `prune: false`, or the latest apply hasn't finished. For a HelmRelease, the usual causes are a Helm hook, an object kept by `helm.sh/resource-policy: keep`, or an unfinished release. When Radar can't read an inventory at all, the tooltip says so: a Kustomization records one once an apply succeeds, and a HelmRelease from Flux 2.8, whose helm-controller records it at each install or upgrade, so one on older Flux, or not upgraded since then, has none. An inventory with an entry Radar can't parse reads the same way.
+- **Flux `dependsOn`** — a Kustomization or HelmRelease listed in another one's `spec.dependsOn` shows that one under **Required By**, and the dependent shows it under **Depends On**. Only the same kind counts, as in Flux; an entry without a namespace means the dependent's namespace. The Revision section of both drawers is open by default and marks an attempted revision that differs from the applied one (for a HelmRelease, the deployed chart version, or `status.lastAppliedRevision` when there is no release history) as **not the last successful apply**. Flux records the applied revision only after the apply and its health checks succeed, so the attempted revision's objects may already be in the cluster.
 - **Flux drawers** — the Kustomization and HelmRelease drawers list `status.inventory`, the objects the last apply recorded, when the controller records one, with the count in the section title.
 - **Related Resources in the resource drawer**:
   - **Owner** and **Children** come from owner references, the links Kubernetes' garbage collector follows. A Deployment's or Rollout's old ReplicaSets (no Pods, not the current revision) sit behind *Show N older ReplicaSets*.
```

**File**: `docs/integrations.md` (modified, +2/-0)
```diff
@@ -828,6 +828,8 @@ observed Flux sources in both directions within Radar's namespace scope.
 Kustomizations use `spec.sourceRef`; HelmReleases use `spec.chart.spec.sourceRef`
 or `spec.chartRef`. Inline releases also link the generated HelmChart named by
 `status.helmChart`; an observed HelmChart links its source in its own namespace.
+`spec.dependsOn` links a Kustomization or HelmRelease to the objects of the same
+kind it waits for (an entry without a namespace means its own namespace).
 These are dependencies, not owners: topology draws each source upstream, with
 the edge pointing into the object that reads it. A link does not prove that Flux
 permits the reference or has produced an artifact.
```

**File**: `packages/k8s-ui/src/components/resources/renderers/FluxHelmReleaseRenderer.tsx` (modified, +4/-2)
```diff
@@ -7,6 +7,7 @@ import { fluxConditionsToGitOpsStatus, parseFluxInventory, type FluxCondition }
 import { TimeValue } from '../../ui/ScheduleValue'
 import { getFluxDeployedRelease, getFluxHandledRequestToken, getFluxReleaseAttemptTime } from '../../../utils/flux-history'
 import { Tooltip } from '../../ui/Tooltip'
+import { Badge } from '../../ui/Badge'
 
 export interface FluxValuesReference {
   kind?: 'ConfigMap' | 'Secret'
@@ -85,6 +86,7 @@ export function FluxHelmReleaseRenderer({ data, onNavigate, renderValuesReferenc
   const sourceRef = chartRef.sourceRef || {}
 
   const lastRelease = getFluxDeployedRelease(data)
+  const deployedRevision = lastRelease?.chartVersion || status.lastAppliedRevision
 
   return (
     <>
@@ -338,7 +340,7 @@ export function FluxHelmReleaseRenderer({ data, onNavigate, renderValuesReferenc
 
       {/* Revision info */}
       {(status.helmChart || status.lastAppliedRevision || status.lastAttemptedRevision || handledRequest) && (
-        <Section title="Revision Info" defaultExpanded={false}>
+        <Section title="Revision Info" defaultExpanded={true}>
           <PropertyList>
             {status.helmChart && (
               <Property label="Helm Chart" value={status.helmChart} />
@@ -347,7 +349,7 @@ export function FluxHelmReleaseRenderer({ data, onNavigate, renderValuesReferenc
               <Property label="Applied Revision" value={status.lastAppliedRevision} />
             )}
             {status.lastAttemptedRevision && (
-              <Property label="Attempted Revision" value={status.lastAttemptedRevision} />
+              <Property label="Attempted Revision" value={<><span className="break-words">{status.lastAttemptedRevision}</span>{deployedRevision && deployedRevision !== status.lastAttemptedRevision && <> <Badge severity="warning" size="sm">not the last successful apply</Badge></>}</>} />
             )}
             <Property label="Last handled manual request" value={handledRequest} />
           </PropertyList>
```

**File**: `packages/k8s-ui/src/components/resources/renderers/FluxTiming.test.tsx` (modified, +46/-0)
```diff
@@ -99,4 +99,50 @@ describe('Flux drawer and resource timing', () => {
     const invalidHistory = renderToString(<FluxHelmReleaseRenderer data={{ ...helm, status: { history: [{ ...helm.status.history[0], lastDeployed: 'invalid' }] } }} />)
     expect(invalidHistory).not.toContain('Attempt started')
   })
+
+  const text = (html: string) => html.replaceAll('<!-- -->', '')
+  const ready = [{ type: 'Ready', status: 'True', reason: 'ReconciliationSucceeded' }]
+
+  it('opens Revision and flags an attempted revision that is not the last successful apply (Kustomization)', () => {
+    const html = text(renderToString(<KustomizationRenderer data={{ ...base, apiVersion: 'kustomize.toolkit.fluxcd.io/v1', kind: 'Kustomization', status: { ...base.status, conditions: ready, lastAppliedRevision: 'main@sha1:aaa', lastAttemptedRevision: 'main@sha1:bbb' } }} />))
+    expect(html).toContain('main@sha1:aaa')
+    expect(html).toContain('not the last successful apply')
+    // The badge turns the value into an element, which Property no longer wraps; a long digest must still break.
+    expect(html).toContain('<span class="break-words">main@sha1:bbb</span>')
+    const section = html.match(/<button\b[\s\S]*?<\/button>/g)?.find(button => button.includes('>Revision<'))
+    expect(section).toContain('aria-expanded="true"')
+  })
+
+  it('does not call a revision that failed its health checks unapplied', () => {
+    // kustomize-controller applies the objects, then records lastAppliedRevision only once health checks pass.
+    const healthFailed = [{ type: 'Ready', status: 'False', reason: 'HealthCheckFailed' }]
+    const html = text(renderToString(<KustomizationRenderer data={{ ...base, apiVersion: 'kustomize.toolkit.fluxcd.io/v1', kind: 'Kustomization', status: { ...base.status, conditions: healthFailed, lastAppliedRevision: 'main@sha1:aaa', lastAttemptedRevision: 'main@sha1:bbb' } }} />))
+    expect(html).not.toContain('not yet applied')
+    expect(html).toContain('not the last successful apply')
+  })
+
+  it('falls back to the applied revision for a HelmRelease without release history', () => {
+    const html = text(renderToString(<FluxHelmReleaseRenderer data={{ ...helm, status: { lastAppliedRevision: '1.2.0', lastAttemptedRevision: '1.4.0' } }} />))
+    expect(html).toContain('not the last successful apply')
+    const noChart = text(renderToString(<FluxHelmReleaseRenderer data={{ ...helm, status: { history: [{ version: 4, status: 'deployed' }], lastAppliedRevision: '1.2.0', lastAttemptedRevision: '1.4.0' } }} />))
+    expect(noChart).toContain('not the last successful apply')
+  })
+
+  it('flags a HelmRelease whose attempted chart differs from the deployed one', () => {
+    const html = text(renderToString(<FluxHelmReleaseRenderer data={{ ...helm, status: { ...helm.status, conditions: ready, lastAttemptedRevision: '1.4.0' } }} />))
+    expect(html).toContain('not the last successful apply')
+    expect(html).toContain('<span class="break-words">1.4.0</span>')
+    const section = html.match(/<button\b[\s\S]*?<\/button>/g)?.find(button => button.includes('Revision Info'))
+    expect(section).toContain('aria-expanded="true"')
+  })
+
+  it('shows no marker when the revisions match or one is missing', () => {
+    const ks = text(renderToString(<KustomizationRenderer data={{ ...base, apiVersion: 'kustomize.toolkit.fluxcd.io/v1', kind: 'Kustomization', status: { ...base.status, lastAppliedRevision: 'main@sha1:aaa', lastAttemptedRevision: 'main@sha1:aaa' } }} />))
+    const hrMatch = text(renderToString(<FluxHelmReleaseRenderer data={{ ...helm, status: { ...helm.status, lastAttemptedRevision: '1.2.0' } }} />))
+    const hrNoHistory = text(renderToString(<FluxHelmReleaseRenderer data={{ ...helm, status: { lastAttemptedRevision: '1.4.0' } }} />))
+    expect(ks).not.toContain('not the last successful apply')
+    expect(hrMatch).not.toContain('not the last successful apply')
+    expect(hrNoHistory).not.toContain('not the last successful apply')
+  })
 })
+
```

**File**: `packages/k8s-ui/src/components/resources/renderers/KustomizationRenderer.tsx` (modified, +3/-2)
```diff
@@ -3,6 +3,7 @@ import { Section, PropertyList, Property, ConditionsSection, ProblemAlerts, Reso
 import { GitOpsStatusBadge, ManagedResourcesList, SyncCountdown } from '../../gitops'
 import { fluxConditionsToGitOpsStatus, parseFluxInventory, type FluxCondition } from '../../../types/gitops'
 import { TimeValue } from '../../ui/ScheduleValue'
+import { Badge } from '../../ui/Badge'
 import { getFluxHandledRequestToken, getFluxLastApply } from '../../../utils/flux-history'
 
 interface KustomizationRendererProps {
@@ -166,13 +167,13 @@ export function KustomizationRenderer({ data, onNavigate }: KustomizationRendere
 
       {/* Revision info */}
       {(status.lastAppliedRevision || status.lastAttemptedRevision || lastApply || handledRequest) && (
-        <Section title="Revision" defaultExpanded={false}>
+        <Section title="Revision" defaultExpanded={true}>
           <PropertyList>
             {status.lastAppliedRevision && (
               <Property label="Applied" value={status.lastAppliedRevision} />
             )}
             {status.lastAttemptedRevision && status.lastAttemptedRevision !== status.lastAppliedRevision && (
-              <Property label="Attempted" value={status.lastAttemptedRevision} />
+              <Property label="Attempted" value={<><span className="break-words">{status.lastAttemptedRevision}</span>{status.lastAppliedRevision && <> <Badge severity="warning" size="sm">not the last successful apply</Badge></>}</>} />
             )}
             {lastApply && (
               <Property
```

**File**: `pkg/topology/flux_sources.go` (modified, +30/-0)
```diff
@@ -12,6 +12,7 @@ func addFluxSourceEdges(nodes []Node, edges []Edge, roots []*unstructured.Unstru
 	var refs []declaredDependency
 	chartTargets := map[string]bool{}
 	for _, root := range roots {
+		refs = append(refs, fluxDependsOn(root)...)
 		for _, ref := range gitops.FluxSourceReferences(root) {
 			refs = append(refs, declaredDependency{Source: resourceid.NewRef(resourceid.GroupFromAPIVersion(root.GetAPIVersion()), root.GetKind(), root.GetNamespace(), root.GetName()), Target: ref.Ref, Label: ref.Role, Configuration: true})
 			if ref.Kind == "HelmChart" {
@@ -53,3 +54,32 @@ func addFluxSourceEdges(nodes []Node, edges []Edge, roots []*unstructured.Unstru
 	nodes, edges, sourceWarnings := addObservedDependencyEdges(nodes, edges, refs, provider, opts)
 	return nodes, edges, append(warnings, sourceWarnings...)
 }
+
+// fluxDependsOn turns spec.dependsOn into dependencies on objects of the
+// root's own kind and group, the only targets Flux allows there.
+func fluxDependsOn(root *unstructured.Unstructured) []declaredDependency {
+	kind := root.GetKind()
+	if kind != "Kustomization" && kind != "HelmRelease" {
+		return nil
+	}
+	entries, _, _ := unstructured.NestedSlice(root.Object, "spec", "dependsOn")
+	group := resourceid.GroupFromAPIVersion(root.GetAPIVersion())
+	source := resourceid.NewRef(group, kind, root.GetNamespace(), root.GetName())
+	var refs []declaredDependency
+	for _, entry := range entries {
+		dep, ok := entry.(map[string]any)
+		if !ok {
+			continue
+		}
+		name, _ := dep["name"].(string)
+		namespace, _ := dep["namespace"].(string)
+		if namespace == "" {
+			namespace = root.GetNamespace()
+		}
+		if namespace == root.GetNamespace() && name == root.GetName() {
+			continue
+		}
+		refs = append(refs, declaredDependency{Source: source, Target: resourceid.NewRef(group, kind, namespace, name), Label: "depends on"})
+	}
+	return refs
+}
```

**File**: `pkg/topology/flux_sources_test.go` (modified, +43/-0)
```diff
@@ -88,3 +88,46 @@ func TestFluxSourceGraphFollowsReferencedChart(t *testing.T) {
 		})
 	}
 }
+
+func TestFluxDependsOnBecomesRequiredBy(t *testing.T) {
+	makeObject := func(group, kind, namespace, name string, dependsOn ...map[string]any) *unstructured.Unstructured {
+		deps := make([]any, 0, len(dependsOn))
+		for _, d := range dependsOn {
+			deps = append(deps, d)
+		}
+		return &unstructured.Unstructured{Object: map[string]any{"apiVersion": group + "/v1", "kind": kind, "metadata": map[string]any{"namespace": namespace, "name": name}, "spec": map[string]any{"dependsOn": deps}}}
+	}
+	const ksGroup, hrGroup = "kustomize.toolkit.fluxcd.io", "helm.toolkit.fluxcd.io"
+	base := makeObject(ksGroup, "Kustomization", "team", "base")
+	overlay := makeObject(ksGroup, "Kustomization", "team", "overlay", map[string]any{"name": "base"})
+	app := makeObject(hrGroup, "HelmRelease", "team", "app", map[string]any{"name": "base"})
+	db := makeObject(hrGroup, "HelmRelease", "team", "db-hr", map[string]any{"name": "missing"}, map[string]any{"name": "db-hr"})
+	gvrs := map[string]schema.GroupVersionResource{
+		"Kustomization": {Group: ksGroup, Version: "v1", Resource: "kustomizations"},
+		"HelmRelease":   {Group: hrGroup, Version: "v2", Resource: "helmreleases"},
+	}
+	p := &issuerTestProvider{monitorDynamicProvider: monitorDynamicProvider{gvrs: gvrs, resources: map[schema.GroupVersionResource][]*unstructured.Unstructured{
+		gvrs["Kustomization"]: {base, overlay}, gvrs["HelmRelease"]: {app, db},
+	}}, listCalls: map[string]int{}}
+	node := func(kind NodeKind, prefix, name, apiVersion string) Node {
+		return Node{ID: prefix + "/team/" + name, Kind: kind, Name: name, Data: map[string]any{"namespace": "team", "apiVersion": apiVersion}}
+	}
+	nodes := []Node{
+		node(KindKustomization, "kustomization", "base", base.GetAPIVersion()),
+		node(KindKustomization, "kustomization", "overlay", overlay.GetAPIVersion()),
+		node(KindHelmRelease, "helmrelease", "app", app.GetAPIVersion()),
+		node(KindHelmRelease, "helmrelease", "db-hr", db.GetAPIVersion()),
+	}
+	nodes, edges, warnings := addFluxSourceEdges(nodes, nil, []*unstructured.Unstructured{base, overlay, app, db}, p, DefaultBuildOptions())
+	if len(warnings) != 0 || len(nodes) != 4 {
+		t.Fatalf("nodes=%d warnings=%v, want 4 nodes and no warnings", len(nodes), warnings)
+	}
+	want := Edge{ID: "kustomization/team/overlay-to-kustomization/team/base", Source: "kustomization/team/overlay", Target: "kustomization/team/base", Type: EdgeUses, Label: "depends on"}
+	if len(edges) != 1 || !reflect.DeepEqual(edges[0], want) {
+		t.Fatalf("edges = %+v, want only %+v", edges, want)
+	}
+	rel := GetRelationships("Kustomization", "team", "base", &Topology{Nodes: nodes, Edges: edges}, nil, p)
+	if rel == nil || len(rel.Dependents) != 1 || rel.Dependents[0].Name != "overlay" {
+		t.Fatalf("base dependents = %+v, want overlay", rel)
+	}
+}
```

---

### Incident Patch 3: `7feff693` (2026-11-20)
**Commit Message**: fix(gitops): keep Flux HelmRelease chart versions whole (#2783)

## Description

The GitOps tree shows a warning chip `attempted <version>` on a Flux
HelmRelease whose last attempt installed exactly the version it runs,
whenever that version is longer than 12 characters.

`enrichNodeFromObject`
([graph.go#L139-L150](https://github.com/skyhook-io/radar/blob/e02bbdaa3c06e36e13bdc02d7dc85975290f0b7c/pkg/gitops/tree/graph.go#L139-L150))
cuts `status.lastAttemptedRevision` to 12 characters with
`truncateRevision`, which is meant for Git revisions, and then sets
`revision` to the whole chart version from `status.history`. The tree
adds the chip when the two differ
([GitOpsTreeGraph.tsx#L719-L722](https://github.com/skyhook-io/radar/blob/e02bbdaa3c06e36e13bdc02d7dc85975290f0b7c/packages/k8s-ui/src/components/gitops/tree/GitOpsTreeGraph.tsx#L719-L722)),
so a version with build metadata such as `1.4.2+0f3c9a1b7e` never equals
its own attempt.

The fix stops cutting a Flux HelmRelease's `lastAppliedRevision` and
`lastAttemptedRevision`: they are chart versions, not Git revisions, so
both sides of the comparison now have the same form. A failed first
install, with nothing installed yet, now n

**File**: `pkg/gitops/tree/flux_source_facts_test.go` (modified, +20/-0)
```diff
@@ -111,4 +111,24 @@ func TestHelmReleaseRevisionIsTheInstalledChart(t *testing.T) {
 	if node.Data["revision"] != "6.15.0" || node.Data["attemptedRevision"] != "6.16.0" {
 		t.Fatalf("failed upgrade: revision = %v attempted = %v", node.Data["revision"], node.Data["attemptedRevision"])
 	}
+	// A version with build metadata is longer than a short revision; the
+	// attempt that installed it must still equal it.
+	obj.Object["status"] = map[string]any{
+		"lastAttemptedRevision": "1.4.2+0f3c9a1b7e",
+		"history":               []any{map[string]any{"version": int64(4), "chartVersion": "1.4.2+0f3c9a1b7e", "status": "deployed"}},
+	}
+	node = enrichNodeFromObject(Node{Tool: ToolFluxCD}, obj)
+	if node.Data["revision"] != "1.4.2+0f3c9a1b7e" || node.Data["attemptedRevision"] != "1.4.2+0f3c9a1b7e" {
+		t.Fatalf("long version: revision = %v attempted = %v", node.Data["revision"], node.Data["attemptedRevision"])
+	}
+	// A failed first install leaves nothing installed; the attempt still
+	// names the version it tried, not a prefix of it.
+	obj.Object["status"] = map[string]any{
+		"lastAttemptedRevision": "1.4.2+0f3c9a1b7e",
+		"history":               []any{map[string]any{"version": int64(1), "chartVersion": "1.4.2+0f3c9a1b7e", "status": "failed"}},
+	}
+	node = enrichNodeFromObject(Node{Tool: ToolFluxCD}, obj)
+	if node.Data["revision"] != nil || node.Data["attemptedRevision"] != "1.4.2+0f3c9a1b7e" {
+		t.Fatalf("failed install: revision = %v attempted = %v", node.Data["revision"], node.Data["attemptedRevision"])
+	}
 }
```

**File**: `pkg/gitops/tree/graph.go` (modified, +10/-2)
```diff
@@ -133,11 +133,19 @@ func enrichNodeFromObject(node Node, obj *unstructured.Unstructured) Node {
 	if rev, ok, _ := unstructured.NestedString(obj.Object, "status", "operationState", "syncResult", "revision"); ok && rev != "" {
 		node.Data["lastSyncRevision"] = truncateRevision(rev)
 	}
+	// A Flux HelmRelease's revisions are chart versions, not Git revisions.
+	// Cut to 12 characters, a version with build metadata (1.4.2+0f3c9a1b7e)
+	// no longer equals the whole version status.history records, and the tree
+	// flags a healthy release as a failed attempt.
+	displayRevision := truncateRevision
+	if obj.GetKind() == "HelmRelease" && gitops.ToolOf(obj) == gitops.ToolFluxCD {
+		displayRevision = func(rev string) string { return rev }
+	}
 	if rev, ok, _ := unstructured.NestedString(obj.Object, "status", "lastAppliedRevision"); ok && rev != "" {
-		node.Data["revision"] = truncateRevision(rev)
+		node.Data["revision"] = displayRevision(rev)
 	}
 	if rev, ok, _ := unstructured.NestedString(obj.Object, "status", "lastAttemptedRevision"); ok && rev != "" {
-		node.Data["attemptedRevision"] = truncateRevision(rev)
+		node.Data["attemptedRevision"] = displayRevision(rev)
 	}
 	if rev, ok, _ := unstructured.NestedInt64(obj.Object, "status", "lastReleaseRevision"); ok && rev > 0 {
 		node.Data["revision"] = fmt.Sprintf("rev:%d", rev)
```

#### Recent Merged Pull Requests:
- **PR #2822** (2026-11-20): Stop logging the large-cluster notice on every topology build (@nadaverell)
- **PR #2812** (2026-11-20): Scale Java4Shell scans and support Amazon ECR (@nadaverell)
- **PR #2811** (2026-11-20): Show MetalLB pools, advertisements, peers and rejected configuration (@officialasishkumar)
- **PR #2810** (2026-11-19): Surface likely Java workloads in the Java4Shell check (@nadaverell)
- **PR #2809** (2026-11-19): Draw Karpenter, Crossplane and MachineHealthCheck links on a neighborhood's last hop (@nadaverell)
- **PR #2808** (2026-11-19): Place an Argo CD Application that Managed By names without a namespace (@nadaverell)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
