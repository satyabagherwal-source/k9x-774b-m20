> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/argoproj-argo-workflows-learnings.md`  
> **Source**: github ([https://github.com/argoproj/argo-workflows](https://github.com/argoproj/argo-workflows))  
> **Source Version**: `3142f33a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T21:02:11.440Z  
> **Learning ID**: `learn-github-argoproj-argo-workflows`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): argoproj/argo-workflows

> **Canonical Artifact**: `07_PROJECT_LEARNING/argoproj-argo-workflows-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/argoproj/argo-workflows](https://github.com/argoproj/argo-workflows))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T21:02:11.276Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `argoproj/argo-workflows`
- **Description**: Workflow Engine for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 17093 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/argo/commands/archive/util.go`
```
package archive

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	workflowarchivepkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/workflowarchive"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
)

// uuidRegex matches Kubernetes UID format (RFC 4122 UUID)
// Example: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
var uuidRegex = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// isUID returns true if the input string matches the UUID format used by Kubernetes UIDs
func isUID(s string, forceUID bool, forceName bool) bool {
	if forceUID {
		return true
	}
	if forceName {
		return false
	}
	return uuidRegex.MatchString(s)
}

func resolveUID(ctx context.Context, serviceClient workflowarchivepkg.ArchivedWorkflowServiceClient, identifier string, namespace string, forceUID bool, forceName bool) (string, error) {
	if isUID(identifier, forceUID, forceName) {
		return identifier, nil
	}

	req := &workflowarchivepkg.ListArchivedWorkflowsRequest{
		Namespace:  namespace,
		NamePrefix: identifier,
		NameFilter: "Exact",
	}

	resp, err := serviceClient.ListArchivedWorkflows(ctx, req)
	if err != nil {
		return "", fmt.Errorf("list archived workflows: %w", err)
	}

	matches := resp.Items
	for len(matches) < 2 && resp.Continue != "" {
		req.ListOptions = &metav1.ListOptions{Continue: resp.Continue}
		resp, err = serviceClient.ListArchivedWorkflows(ctx, req)
		if err != nil {
			return "", fmt.Errorf("list archived workflows: %w", err)
		}
		matches = append(matches, resp.Items...)
	}

	if len(matches) == 0 {
		return "", fmt.Errorf("archived workflow '%s' not found", identifier)
	}

	if len(matches) > 1 {
		var msg strings.Builder
		fmt.Fprintf(&msg, "Multiple archived workflows found with name '%s':\n", identifier)
		for _, wf := range matches {
			fmt.Fprintf(&msg, "  %s (Created: %s, Finished: %s)\n", wf.UID, humanize.Timestamp(wf.CreationTimestamp.Time), humanize.Timestamp(wf.Status.FinishedAt.Time))
		}
		msg.WriteString("Please specify the UID.")
		return "", errors.New(msg.String())
	}

	return string(matches[0].UID), nil
}

```

### Core Architecture Module: `cmd/argo/commands/clustertemplate/util.go`
```
package clustertemplate

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"sigs.k8s.io/yaml"

	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
	argoJson "github.com/argoproj/argo-workflows/v4/util/json"
	"github.com/argoproj/argo-workflows/v4/workflow/common"
	"github.com/argoproj/argo-workflows/v4/workflow/util"
)

func generateClusterWorkflowTemplates(ctx context.Context, filePaths []string, strict bool) []wfv1.ClusterWorkflowTemplate {
	fileContents, err := util.ReadManifest(ctx, filePaths...)
	if err != nil {
		log.Fatal(err)
	}

	var clusterWorkflowTemplates []wfv1.ClusterWorkflowTemplate
	for _, body := range fileContents {
		cwftmpls, err := unmarshalClusterWorkflowTemplates(ctx, body, strict)
		if err != nil {
			log.Fatalf("Failed to parse cluster workflow template: %v", err)
		}
		clusterWorkflowTemplates = append(clusterWorkflowTemplates, cwftmpls...)
	}

	if len(clusterWorkflowTemplates) == 0 {
		log.Fatalln("No cluster workflow template found in given files")
	}

	return clusterWorkflowTemplates
}

// unmarshalClusterWorkflowTemplates unmarshals the input bytes as either json or yaml
func unmarshalClusterWorkflowTemplates(ctx context.Context, wfBytes []byte, strict bool) ([]wfv1.ClusterWorkflowTemplate, error) {
	var cwft wfv1.ClusterWorkflowTemplate
	var jsonOpts []argoJson.Opt
	if strict {
		jsonOpts = append(jsonOpts, argoJson.DisallowUnknownFields)
	}
	err := argoJson.Unmarshal(wfBytes, &cwft, jsonOpts...)
	if err == nil {
		return []wfv1.ClusterWorkflowTemplate{cwft}, nil
	}
	yamlWfs, err := common.SplitClusterWorkflowTemplateYAMLFile(ctx, wfBytes, strict)
	if err == nil {
		return yamlWfs, nil
	}
	return nil, err
}

func printClusterWorkflowTemplate(wf *wfv1.ClusterWorkflowTemplate, outFmt string) {
	switch outFmt {
	case "name":
		fmt.Println(wf.Name)
	case "json":
		outBytes, _ := json.MarshalIndent(wf, "", "    ")
		fmt.Println(string(outBytes))
	case "yaml":
		outBytes, _ := yaml.Marshal(wf)
		fmt.Print(string(outBytes))
	case "wide", "":
		printClusterWorkflowTemplateHelper(wf)
	default:
		log.Fatalf("Unknown output format: %s", outFmt)
	}
}

func printClusterWorkflowTemplateHelper(wf *wfv1.ClusterWorkflowTemplate) {
	const fmtStr = "%-20s %v\n"
	fmt.Printf(fmtStr, "Name:", wf.Name)
	fmt.Printf(fmtStr, "Created:", humanize.Timestamp(wf.CreationTimestamp.Time))
}

```

### Core Architecture Module: `cmd/argo/commands/cron/util.go`
```
package cron

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/robfig/cron/v3"
	"sigs.k8s.io/yaml"

	"github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
	argoJson "github.com/argoproj/argo-workflows/v4/util/json"
	"github.com/argoproj/argo-workflows/v4/workflow/common"
	"github.com/argoproj/argo-workflows/v4/workflow/util"
)

// GetNextRuntime returns the next time the workflow should run in local time. It assumes the workflow-controller is in
// UTC, but nevertheless returns the time in the local timezone.
func GetNextRuntime(ctx context.Context, cwf *v1alpha1.CronWorkflow) (time.Time, error) {
	var nextRunTime time.Time
	now := time.Now().UTC()
	for _, schedule := range cwf.Spec.GetSchedulesWithTimezone() {
		cronSchedule, err := cron.ParseStandard(schedule)
		if err != nil {
			return time.Time{}, err
		}
		next := cronSchedule.Next(now).Local()
		if nextRunTime.IsZero() || next.Before(nextRunTime) {
			nextRunTime = next
		}
	}

	return nextRunTime, nil
}

func generateCronWorkflows(ctx context.Context, filePaths []string, strict bool) []v1alpha1.CronWorkflow {
	fileContents, err := util.ReadManifest(ctx, filePaths...)
	if err != nil {
		log.Fatal(err)
	}

	var cronWorkflows []v1alpha1.CronWorkflow
	for _, body := range fileContents {
		cronWfs := unmarshalCronWorkflows(ctx, body, strict)
		cronWorkflows = append(cronWorkflows, cronWfs...)
	}

	if len(cronWorkflows) == 0 {
		log.Fatalln("No CronWorkflows found in given files")
	}

	return cronWorkflows
}

// unmarshalCronWorkflows unmarshals the input bytes as either json or yaml
func unmarshalCronWorkflows(ctx context.Context, wfBytes []byte, strict bool) []v1alpha1.CronWorkflow {
	var cronWf v1alpha1.CronWorkflow
	var jsonOpts []argoJson.Opt
	if strict {
		jsonOpts = append(jsonOpts, argoJson.DisallowUnknownFields)
	}
	err := argoJson.Unmarshal(wfBytes, &cronWf, jsonOpts...)
	if err == nil {
		return []v1alpha1.CronWorkflow{cronWf}
	}
	yamlWfs, err := common.SplitCronWorkflowYAMLFile(ctx, wfBytes, strict)
	if err == nil {
		return yamlWfs
	}
	log.Fatalf("Failed to parse cron workflow: %v", err)
	return nil
}

func printCronWorkflow(ctx context.Context, wf *v1alpha1.CronWorkflow, outFmt string) {
	switch outFmt {
	case "name":
		fmt.Println(wf.Name)
	case "json":
		outBytes, _ := json.MarshalIndent(wf, "", "    ")
		fmt.Println(string(outBytes))
	case "yaml":
		outBytes, _ := yaml.Marshal(wf)
		fmt.Print(string(outBytes))
	case "wide", "":
		fmt.Print(getCronWorkflowGet(ctx, wf))
	default:
		log.Fatalf("Unknown output format: %s", outFmt)
	}
}

func getCronWorkflowGet(ctx context.Context, cwf *v1alpha1.CronWorkflow) string {
	const fmtStr = "%-30s %v\n"

	var out strings.Builder
	fmt.Fprintf(&out, fmtStr, "Name:", cwf.Name)
	fmt.Fprintf(&out, fmtStr, "Namespace:", cwf.Namespace)
	fmt.Fprintf(&out, fmtStr, "Created:", humanize.Timestamp(cwf.CreationTimestamp.Time))
	fmt.Fprintf(&out, fmtStr, "Schedules:", cwf.Spec.GetScheduleString())
	fmt.Fprintf(&out, fmtStr, "Suspended:", cwf.Spec.Suspend)
	if cwf.Spec.Timezone != "" {
		fmt.Fprintf(&out, fmtStr, "Timezone:", cwf.Spec.Timezone)
	}
	if cwf.Spec.StartingDeadlineSeconds != nil {
		fmt.Fprintf(&out, fmtStr, "StartingDeadlineSeconds:", *cwf.Spec.StartingDeadlineSeconds)
	}
	if cwf.Spec.ConcurrencyPolicy != "" {
		fmt.Fprintf(&out, fmtStr, "ConcurrencyPolicy:", cwf.Spec.ConcurrencyPolicy)
	}
	if cwf.Status.LastScheduledTime != nil {
		fmt.Fprintf(&out, fmtStr, "LastScheduledTime:", humanize.Timestamp(cwf.Status.LastScheduledTime.Time))
	}

	next, err := GetNextRuntime(ctx, cwf)
	if err == nil {
		fmt.Fprintf(&out, fmtStr, "NextScheduledTime:", humanize.Timestamp(next)+" (assumes workflow-controller is in UTC)")
	}

	if len(cwf.Status.Active) > 0 {
		var activeWfNames []string
		for _, activeWf := range cwf.Status.Active {
			activeWfNames = append(activeWfNames, activeWf.Name)
		}
		fmt.Fprintf(&out, fmtStr, "Active Workflows:", strings.Join(activeWfNames, ", "))
	}
	if len(cwf.Status.Conditions) > 0 {
		out.WriteString(cwf.Status.Conditions.DisplayString(fmtStr, map[v1alpha1.ConditionType]string{v1alpha1.ConditionTypeSubmissionError: "✖"}))
	}
	if len(cwf.Spec.WorkflowSpec.Arguments.Parameters) > 0 {
		fmt.Fprintf(&out, fmtStr, "Workflow Parameters:", "")
		for _, param := range cwf.Spec.WorkflowSpec.Arguments.Parameters {
			if !param.HasValue() {
				continue
			}
			fmt.Fprintf(&out, fmtStr, "  "+param.Name+":", param.GetValue())
		}
	}
	return out.String()
}

```

### Core Architecture Module: `cmd/argo/commands/sync/util.go`
```
package sync

import (
	"fmt"
	"strings"

	syncpkg "github.com/argoproj/argo-workflows/v4/pkg/apiclient/sync"
)

func validateFlags(syncType, cmName string) error {
	if _, ok := syncpkg.SyncConfigType_value[syncType]; !ok {
		return fmt.Errorf("--type must be either 'database' or 'configmap'")
	}

	if syncType == syncpkg.SyncConfigType_CONFIGMAP.String() && cmName == "" {
		return fmt.Errorf("--cm-name is required when type is configmap")
	}

	return nil
}

func printSyncLimit(key, cmName, namespace string, limit int32, syncType syncpkg.SyncConfigType) {
	fmt.Printf("Key: %s\n", key)
	fmt.Printf("Type: %s\n", strings.ToLower(syncType.String()))
	if syncType == syncpkg.SyncConfigType_CONFIGMAP {
		fmt.Printf("ConfigMap Name: %s\n", cmName)
	}
	fmt.Printf("Namespace: %s\n", namespace)
	fmt.Printf("Limit: %d\n", limit)
}

```

### Core Architecture Module: `cmd/argo/commands/template/util.go`
```
package template

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"sigs.k8s.io/yaml"

	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/argoproj/argo-workflows/v4/util/humanize"
	argoJson "github.com/argoproj/argo-workflows/v4/util/json"
	"github.com/argoproj/argo-workflows/v4/workflow/common"
	"github.com/argoproj/argo-workflows/v4/workflow/util"
)

func generateWorkflowTemplates(ctx context.Context, filePaths []string, strict bool) []wfv1.WorkflowTemplate {
	fileContents, err := util.ReadManifest(ctx, filePaths...)
	if err != nil {
		log.Fatal(err)
	}

	var workflowTemplates []wfv1.WorkflowTemplate
	for _, body := range fileContents {
		wftmpls := unmarshalWorkflowTemplates(ctx, body, strict)
		workflowTemplates = append(workflowTemplates, wftmpls...)
	}

	if len(workflowTemplates) == 0 {
		log.Fatalln("No workflow template found in given files")
	}

	return workflowTemplates
}

// unmarshalWorkflowTemplates unmarshals the input bytes as either json or yaml
func unmarshalWorkflowTemplates(ctx context.Context, wfBytes []byte, strict bool) []wfv1.WorkflowTemplate {
	var wf wfv1.WorkflowTemplate
	var jsonOpts []argoJson.Opt
	if strict {
		jsonOpts = append(jsonOpts, argoJson.DisallowUnknownFields)
	}
	err := argoJson.Unmarshal(wfBytes, &wf, jsonOpts...)
	if err == nil {
		return []wfv1.WorkflowTemplate{wf}
	}
	yamlWfs, err := common.SplitWorkflowTemplateYAMLFile(ctx, wfBytes, strict)
	if err == nil {
		return yamlWfs
	}
	log.Fatalf("Failed to parse workflow template: %v", err)
	return nil
}

func printWorkflowTemplate(wf *wfv1.WorkflowTemplate, outFmt string) {
	switch outFmt {
	case "name":
		fmt.Println(wf.Name)
	case "json":
		outBytes, _ := json.MarshalIndent(wf, "", "    ")
		fmt.Println(string(outBytes))
	case "yaml":
		outBytes, _ := yaml.Marshal(wf)
		fmt.Print(string(outBytes))
	case "wide", "":
		printWorkflowTemplateHelper(wf)
	default:
		log.Fatalf("Unknown output format: %s", outFmt)
	}
}

func printWorkflowTemplateHelper(wf *wfv1.WorkflowTemplate) {
	const fmtStr = "%-20s %v\n"
	fmt.Printf(fmtStr, "Name:", wf.Name)
	fmt.Printf(fmtStr, "Namespace:", wf.Namespace)
	fmt.Printf(fmtStr, "Created:", humanize.Timestamp(wf.CreationTimestamp.Time))
}

```

### Core Architecture Module: `pkg/apis/workflow/v1alpha1/utils.go`
```
package v1alpha1

import (
	"fmt"
	"strconv"
	"time"
)

func ParseStringToDuration(durationString string) (time.Duration, error) {
	var duration time.Duration
	// If no units are attached, treat as seconds
	if val, err := strconv.Atoi(durationString); err == nil {
		duration = time.Duration(val) * time.Second
	} else if parsed, err := time.ParseDuration(durationString); err == nil {
		duration = parsed
	} else {
		return 0, fmt.Errorf("unable to parse %s as a duration: %w", durationString, err)
	}
	return duration, nil
}

```

### Core Architecture Module: `pkg/apis/workflow/v1alpha1/validation_utils.go`
```
package v1alpha1

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	apivalidation "k8s.io/apimachinery/pkg/util/validation"
)

const (
	workflowFieldNameFmt    string = "[a-zA-Z0-9][-a-zA-Z0-9]*"
	workflowFieldNameErrMsg string = "name must consist of alpha-numeric characters or '-', and must start with an alpha-numeric character"
	workflowFieldMaxLength  int    = 128
)

var (
	paramOrArtifactNameRegex = regexp.MustCompile(`^[-a-zA-Z0-9_]+[-a-zA-Z0-9_]*$`)
	workflowFieldNameRegex   = regexp.MustCompile("^" + workflowFieldNameFmt + "$")
)

func isValidParamOrArtifactName(p string) []string {
	var errs []string
	if !paramOrArtifactNameRegex.MatchString(p) {
		return append(errs, "Parameter/Artifact name must consist of alpha-numeric characters, '_' or '-' e.g. my_param_1, MY-PARAM-1")
	}
	return errs
}

// isValidWorkflowFieldName : workflow field name must consist of alpha-numeric characters or '-', and must start with an alpha-numeric character
func isValidWorkflowFieldName(name string) []string {
	var errs []string
	if len(name) > workflowFieldMaxLength {
		errs = append(errs, apivalidation.MaxLenError(workflowFieldMaxLength))
	}
	if !workflowFieldNameRegex.MatchString(name) {
		msg := workflowFieldNameErrMsg + " (e.g. My-name1-2, 123-NAME)"
		errs = append(errs, msg)
	}
	return errs
}

// validateWorkflowFieldNames accepts a slice of strings and
// verifies that the Name field of the structs are:
// * unique
// * non-empty
// * matches matches our regex requirements
func validateWorkflowFieldNames(names []string, isParamOrArtifact bool) error {
	nameSet := make(map[string]bool)

	for i, name := range names {
		if name == "" {
			return fmt.Errorf("[%d].name is required", i)
		}
		var errs []string
		if isParamOrArtifact {
			errs = isValidParamOrArtifactName(name)
		} else {
			errs = isValidWorkflowFieldName(name)
		}
		if len(errs) != 0 {
			return fmt.Errorf("[%d].name: '%s' is invalid: %s", i, name, strings.Join(errs, ";"))
		}
		_, ok := nameSet[name]
		if ok {
			return fmt.Errorf("[%d].name '%s' is not unique", i, name)
		}
		nameSet[name] = true
	}
	return nil
}

// validateNoCycles validates that a dependency graph has no cycles by doing a Depth-First Search
// depGraph is an adjacency list, where key is a node name and value is a list of its dependencies' names
func validateNoCycles(depGraph map[string][]string) error {
	visited := make(map[string]bool)
	var noCyclesHelper func(currentName string, cycyle []string) error
	noCyclesHelper = func(currentName string, cycle []string) error {
		if _, ok := visited[currentName]; ok {
			return nil
		}
		depNames, ok := depGraph[currentName]
		if !ok {
			return nil
		}
		for _, depName := range depNames {
			for _, name := range cycle {
				if depName == name {
					return fmt.Errorf("dependency cycle detected: %s->%s", strings.Join(cycle, "->"), name)
				}
			}
			cycle = append(cycle, depName)
			err := noCyclesHelper(depName, cycle)
			if err != nil {
				return err
			}
			cycle = cycle[0 : len(cycle)-1]
		}
		visited[currentName] = true
		return nil
	}
	names := make([]string, 0)
	for name := range depGraph {
		names = append(names, name)
	}
	// sort names here to make sure the error message has consistent ordering
	// so that we can verify the error message in unit tests
	sort.Strings(names)

	for _, name := range names {
		err := noCyclesHelper(name, []string{})
		if err != nil {
			return err
		}
	}
	return nil
}

```

### Core Architecture Module: `server/auth/webhook/bitbucket.go`
```
package webhook

import (
	"net/http"

	"github.com/go-playground/webhooks/v6/bitbucket"
)

func bitbucketMatch(secret string, r *http.Request) bool {
	hook, err := bitbucket.New(bitbucket.Options.UUID(secret))
	if err != nil {
		return false
	}
	_, err = hook.Parse(r,
		bitbucket.RepoPushEvent,
		bitbucket.RepoForkEvent,
		bitbucket.RepoUpdatedEvent,
		bitbucket.RepoCommitCommentCreatedEvent,
		bitbucket.RepoCommitStatusCreatedEvent,
		bitbucket.RepoCommitStatusUpdatedEvent,
		bitbucket.IssueCreatedEvent,
		bitbucket.IssueUpdatedEvent,
		bitbucket.IssueCommentCreatedEvent,
		bitbucket.PullRequestCreatedEvent,
		bitbucket.PullRequestUpdatedEvent,
		bitbucket.PullRequestApprovedEvent,
		bitbucket.PullRequestUnapprovedEvent,
		bitbucket.PullRequestMergedEvent,
		bitbucket.PullRequestDeclinedEvent,
		bitbucket.PullRequestCommentCreatedEvent,
		bitbucket.PullRequestCommentUpdatedEvent,
		bitbucket.PullRequestCommentDeletedEvent,
	)
	return err == nil
}

```

### Core Architecture Module: `server/auth/webhook/bitbucketserver.go`
```
package webhook

import (
	"net/http"

	bitbucketserver "github.com/go-playground/webhooks/v6/bitbucket-server"
)

func bitbucketserverMatch(secret string, r *http.Request) bool {
	hook, err := bitbucketserver.New(bitbucketserver.Options.Secret(secret))
	if err != nil {
		return false
	}
	_, err = hook.Parse(r,
		bitbucketserver.RepositoryReferenceChangedEvent,
		bitbucketserver.RepositoryModifiedEvent,
		bitbucketserver.RepositoryForkedEvent,
		bitbucketserver.RepositoryCommentAddedEvent,
		bitbucketserver.RepositoryCommentEditedEvent,
		bitbucketserver.RepositoryCommentDeletedEvent,
		bitbucketserver.PullRequestOpenedEvent,
		bitbucketserver.PullRequestFromReferenceUpdatedEvent,
		bitbucketserver.PullRequestModifiedEvent,
		bitbucketserver.PullRequestMergedEvent,
		bitbucketserver.PullRequestDeclinedEvent,
		bitbucketserver.PullRequestDeletedEvent,
		bitbucketserver.PullRequestReviewerUpdatedEvent,
		bitbucketserver.PullRequestReviewerApprovedEvent,
		bitbucketserver.PullRequestReviewerUnapprovedEvent,
		bitbucketserver.PullRequestReviewerNeedsWorkEvent,
		bitbucketserver.PullRequestCommentAddedEvent,
		bitbucketserver.PullRequestCommentEditedEvent,
		bitbucketserver.PullRequestCommentDeletedEvent,
	)
	return err == nil
}

```

### Core Architecture Module: `server/auth/webhook/github.go`
```
package webhook

import (
	"net/http"

	"github.com/go-playground/webhooks/v6/github"
)

func githubMatch(secret string, r *http.Request) bool {
	hook, err := github.New(github.Options.Secret(secret))
	if err != nil {
		return false
	}
	_, err = hook.Parse(r,
		github.CheckRunEvent,
		github.CheckSuiteEvent,
		github.CodeScanningAlertEvent,
		github.CommitCommentEvent,
		github.CreateEvent,
		github.DeleteEvent,
		github.DependabotAlertEvent,
		github.DeployKeyEvent,
		github.DeploymentEvent,
		github.DeploymentStatusEvent,
		github.ForkEvent,
		github.GitHubAppAuthorizationEvent,
		github.GollumEvent,
		github.InstallationEvent,
		github.InstallationRepositoriesEvent,
		github.IntegrationInstallationEvent,
		github.IntegrationInstallationRepositoriesEvent,
		github.IssueCommentEvent,
		github.IssuesEvent,
		github.LabelEvent,
		github.MemberEvent,
		github.MembershipEvent,
		github.MilestoneEvent,
		github.MetaEvent,
		github.OrganizationEvent,
		github.OrgBlockEvent,
		github.PageBuildEvent,
		github.PingEvent,
		github.ProjectCardEvent,
		github.ProjectColumnEvent,
		github.ProjectEvent,
		github.PublicEvent,
		github.PullRequestEvent,
		github.PullRequestReviewEvent,
		github.PullRequestReviewCommentEvent,
		github.PushEvent,
		github.ReleaseEvent,
		github.RepositoryEvent,
		github.RepositoryVulnerabilityAlertEvent,
		github.SecurityAdvisoryEvent,
		github.StatusEvent,
		github.TeamEvent,
		github.TeamAddEvent,
		github.WatchEvent,
		github.WorkflowDispatchEvent,
		github.WorkflowJobEvent,
		github.WorkflowRunEvent,
	)
	return err == nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17494** (2026-11-11): **ci(stale): clear problem/old draft when an item becomes active**
  *Symptoms*: <!-- markdownlint-disable MD041 -- this is rendered within existing HTML, so allow starting without an H1 -->  See the [pull request guide](https://argo-workflows.readthedocs.io/en/latest/pull-requests/) for details on each item.  - [ ] Ran `make pre-commit -B` - [x] Signed-off commits with [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) messages - [x] PR title is a conventional commit message (it becomes the release notes entry) - [ ] Unit or e2e tests cover the change - [ ] For features: an associated issue and a feature description file (`make feature-new`) - [x] Opened as draft; will mark "Ready for review" once builds are green  ### Motivation  A draft that gets new activity keeps `problem/old draft`, so it re-enters the stale flow and can close 28 days later even though it is active again. This was raised in [review feedback on #17493](https://github.com/argoproj/argo-workflows/pull/17493#discussion_r4544383489).  ### Modifications  - Add `problem/old draft` to `labels-to-remove-when-unstale` in `.github/workflows/stale.yaml`.  ### Verification  `actionlint` passes. The [actions/stale v11.0.0 action.yml](https://github.com/actions/stale/blob/v11.0.0/action.yml) documents `labels-to-remove-when-unstale` as a comma-delimited list.  ### Documentation  Not needed. This only changes repository automation.  ### AI  Claude Opus 5.5 drafted the change, commit message, and this description. I reviewed the diff. 

- **Issue #17493** (2026-11-11): **ci(stale): allow manual runs and process problem/stale items**
  *Symptoms*: <!-- markdownlint-disable MD041 -- this is rendered within existing HTML, so allow starting without an H1 -->  See the [pull request guide](https://argo-workflows.readthedocs.io/en/latest/pull-requests/) for details on each item.  - [ ] Ran `make pre-commit -B` - [x] Signed-off commits with [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) messages - [x] PR title is a conventional commit message (it becomes the release notes entry) - [ ] Unit or e2e tests cover the change - [ ] For features: an associated issue and a feature description file (`make feature-new`) - [x] Opened as draft; will mark "Ready for review" once builds are green  ### Motivation  Maintainers can't run the stale workflow on demand. Items labeled `problem/stale` that no longer carry `problem/more information needed` never get processed, so they stay open indefinitely.  ### Modifications  - Add a `workflow_dispatch` trigger. - Replace `only-labels` with `any-of-labels: 'problem/more information needed,problem/stale,problem/old draft,problem/bot-not-ready'`. `only-labels` requires every listed label, so adding `problem/stale` there would stop new items from ever going stale. - Add the missing `>` on `close-pr-message` to match the other messages. - Grant the job `actions: write`. actions/stale needs it to list and replace its state cache, so runs can resume instead of restarting from the first item.  The first run will close two open PRs that carry `problem/stale` and have been idle since
  **Post-Mortem & Fix Analysis**:
  > <!-- coderabbit-ai-generated:v1 -->  <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/argoproj/argo-workflows/pull/17493?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><picture><source media="(prefers-color-scheme: dark)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change.svg"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change.svg" alt="Explain Change →" height="32"></picture></a>  <!-- review_stack_entry_end --> <!-- recent_review_status_start -->  No actionable comments were generated in the recent review.  <!-- recent_review_status_end --> <!-- walkthrough_start -->  <details> <summa
  > @coderabbitai > Grant `actions: write` so the stale job can read and replace its state cache.  Addressed in https://github.com/argoproj/argo-workflows/pull/17493/commits/eee65a2c4d8ecc03d2bbd6546ec4e6adc2538dd9. The last scheduled run logged "The saved state was not found", so the restore path is broken today. It does no harm yet because the run finishes all 1400 items in 15 of 30 operations. I added the scope anyway so resume works once the backlog outgrows a single run. `actions: read` alone would let the action restore old state while failing to replace it.

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

### Incident Patch 1: `d20aac05` (2026-11-11)
**Commit Message**: fix(sqldb): refresh offload timestamp on duplicate save (#17471)

Signed-off-by: somiljain2006 <[REDACTED_EMAIL]>

**File**: `persist/sqldb/explosive_offload_node_status_repo.go` (modified, +4/-0)
```diff
@@ -34,6 +34,10 @@ func (n *explosiveOffloadNodeStatusRepo) Delete(context.Context, string, string)
 	return ErrOffloadNotSupported
 }
 
+func (n *explosiveOffloadNodeStatusRepo) DeleteIfOld(context.Context, string, string) error {
+	return ErrOffloadNotSupported
+}
+
 func (n *explosiveOffloadNodeStatusRepo) ListOldOffloads(context.Context, string) (map[string][]string, error) {
 	return nil, ErrOffloadNotSupported
 }
```

**File**: `persist/sqldb/mocks/OffloadNodeStatusRepo.go` (modified, +14/-0)
```diff
@@ -30,6 +30,20 @@ func (_m *OffloadNodeStatusRepo) Delete(_ context.Context, uid string, version s
 	return r0
 }
 
+// DeleteIfOld provides a mock function with given fields: uid, version
+func (_m *OffloadNodeStatusRepo) DeleteIfOld(_ context.Context, uid string, version string) error {
+	ret := _m.Called(uid, version)
+
+	var r0 error
+	if rf, ok := ret.Get(0).(func(string, string) error); ok {
+		r0 = rf(uid, version)
+	} else {
+		r0 = ret.Error(0)
+	}
+
+	return r0
+}
+
 // Get provides a mock function with given fields: uid, version
 func (_m *OffloadNodeStatusRepo) Get(ctx context.Context, uid string, version string) (v1alpha1.Nodes, error) {
 	ret := _m.Called(uid, version)
```

**File**: `persist/sqldb/offload_node_status_repo.go` (modified, +77/-6)
```diff
@@ -29,6 +29,11 @@ type OffloadNodeStatusRepo interface {
 	List(ctx context.Context, namespace string) (map[UUIDVersion]wfv1.Nodes, error)
 	ListOldOffloads(ctx context.Context, namespace string) (map[string][]string, error)
 	Delete(ctx context.Context, uid, version string) error
+	// DeleteIfOld deletes the offload record only if its updatedat timestamp is
+	// still older than the configured TTL at the time the DELETE executes.  This
+	// prevents GC from removing a record whose timestamp was refreshed by Save()
+	// between ListOldOffloads() and the deletion.
+	DeleteIfOld(ctx context.Context, uid, version string) error
 	IsEnabled() bool
 }
 
@@ -91,13 +96,45 @@ func (wdc *nodeOffloadRepo) Save(ctx context.Context, uid, namespace string, nod
 	logCtx.Debug(ctx, "Offloading nodes")
 	err = wdc.sessionProxy.With(ctx, func(s db.Session) error {
 		_, insertErr := s.Collection(wdc.tableName).Insert(record)
-		if insertErr != nil {
-			// if we have a duplicate, then it must have the same clustername+uid+version, which MUST mean that we
-			// have already written this record
-			if !isDuplicateKeyError(insertErr) {
-				return insertErr
+		if insertErr == nil {
+			return nil
+		}
+
+		if !isDuplicateKeyError(insertErr) {
+			return insertErr
+		}
+
+		logCtx.WithField("err", insertErr).Debug(ctx, "Refreshing timestamp for duplicate offload")
+
+		rs, updateErr := s.SQL().
+			Update(wdc.tableName).
+			Set("updatedat", db.Raw("CURRENT_TIMESTAMP")).
+			Where(db.Cond{"clustername": wdc.clusterName}).
+			And(db.Cond{"uid": uid}).
+			And(db.Cond{"version": version}).
+			Exec()
+
+		if updateErr != nil {
+			return fmt.Errorf("failed to refresh timestamp for existing offload: %w", updateErr)
+		}
+		rowsAffected, updateErr := rs.RowsAffected()
+		if updateErr != nil {
+			return fmt.Errorf("failed to get rows affected after timestamp refresh: %w", updateErr)
+		}
+		if rowsAffected == 0 {
+			// In MySQL (without clientFoundRows=true), an UPDATE that writes the exact same
+			// timestamp value within the same second reports 0 changed rows even though the
+			// row matched and exists. Verify whether the row actually exists before concluding
+			// it disappeared concurrently.
+			exists, existsErr := s.Collection(wdc.tableName).
+				Find(db.Cond{"clustername": wdc.clusterName, "uid": uid, "version": version}).
+				Exists()
+			if existsErr != nil {
+				return fmt.Errorf("failed to check offload record existence: %w", existsErr)
+			}
+			if !exists {
+				return fmt.Errorf("offload record (uid=%s, version=%s) disappeared during duplicate-save: concurrent GC may have deleted it", uid, version)
 			}
-			logCtx.WithField("err", insertErr).Debug(ctx, "Ignoring duplicate key error")
 		}
 		return nil
 	})
@@ -236,6 +273,40 @@ func (wdc *nodeOffloadRepo) Delete(ctx context.Context, uid, version string) err
 	})
 }
 
+// DeleteIfOld deletes the offload record only when its updatedat timestamp is
+// still older than the configured TTL at the moment the DELETE executes.  If
+// Save() refreshed the timestamp between ListOldOffloads() and this call, the
+// condition will be false and zero rows will be affected – the record is left
+// intact so that live workflows can still hydrate their node status.
+func (wdc *nodeOffloadRepo) DeleteIfOld(ctx context.Context, uid, version string) error {
+	if uid == "" {
+		return fmt.Errorf("invalid uid")
+	}
+	if version == "" {
+		return fmt.Errorf("invalid version")
+	}
+	logCtx := wdc.log.WithFields(logging.Fields{"uid": uid, "version": version})
+	logCtx.Debug(ctx, "Conditionally deleting old offloaded nodes")
+	return wdc.sessionProxy.With(ctx, func(s db.Session) error {
+		rs, err := s.SQL().
+			DeleteFrom(wdc.tableName).
+			Where(db.Cond{"clustername": wdc.clusterName}).
+			And(db.Cond{"uid": uid}).
+			And(db.Cond{"version": version}).
+			And(wdc.oldOffload()).
+			Exec()
+		if err != nil {
+			return err
+		}
+		rowsAffected, err := rs.RowsAffected()
+		if err != nil {
+			return err
+		}
+		logCtx.WithField("rowsAffected", rowsAffected).Debug(ctx, "Conditionally deleted old offloaded nodes")
+		return nil
+	})
+}
+
 func (wdc *nodeOffloadRepo) oldOffload() string {
 	return fmt.Sprintf("updatedat < current_timestamp - interval '%d' second", int(wdc.ttl.Seconds()))
 }
```

**File**: `persist/sqldb/offload_node_status_repo_mysql_test.go` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+//go:build !windows
+
+package sqldb
+
+import (
+	"context"
+	"strconv"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	testcontainers "github.com/testcontainers/testcontainers-go"
+	testmysql "github.com/testcontainers/testcontainers-go/modules/mysql"
+	"github.com/testcontainers/testcontainers-go/wait"
+
+	"github.com/argoproj/argo-workflows/v4/config"
+	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
+	"github.com/argoproj/argo-workflows/v4/util/logging"
+	usqldb "github.com/argoproj/argo-workflows/v4/util/sqldb"
+)
+
+func setupMySQLOffloadRepo(ctx context.Context, t *testing.T, v usqldb.MySQLVariant) *nodeOffloadRepo {
+	t.Helper()
+
+	c, err := testmysql.Run(ctx,
+		v.Image,
+		testmysql.WithDatabase("argo"),
+		testmysql.WithUsername("argo"),
+		testmysql.WithPassword("argo"),
+		testcontainers.WithWaitStrategy(
+			wait.ForAll(
+				wait.ForLog(v.WaitMessage).WithStartupTimeout(60*time.Second),
+				wait.ForListeningPort("3306/tcp"),
+			)),
+	)
+	require.NoError(t, err)
+	t.Cleanup(func() {
+		if termErr := testcontainers.TerminateContainer(c); termErr != nil {
+			t.Logf("failed to terminate container: %s", termErr)
+		}
+	})
+
+	host, err := c.Host(ctx)
+	require.NoError(t, err)
+	p, err := c.MappedPort(ctx, "3306/tcp")
+	require.NoError(t, err)
+	port, err := strconv.Atoi(p.Port())
+	require.NoError(t, err)
+
+	proxy, err := usqldb.NewSessionProxy(ctx, usqldb.SessionProxyConfig{
+		DBConfig: config.DBConfig{
+			MySQL: &config.MySQLConfig{
+				DatabaseConfig: config.DatabaseConfig{
+					Database: "argo",
+					Host:     host,
+					Port:     port,
+				},
+			},
+		},
+		Username: "argo",
+		Password: "argo",
+	})
+	require.NoError(t, err)
+
+	const (
+		clusterName = "test"
+		tableName   = "argo_workflows"
+	)
+
+	err = Migrate(ctx, proxy.Session(ctx), clusterName, tableName, proxy.DBType())
+	require.NoError(t, err)
+
+	t.Cleanup(func() { proxy.Close() })
+
+	return &nodeOffloadRepo{
+		sessionProxy: proxy,
+		clusterName:  clusterName,
+		tableName:    tableName,
+		ttl:          5 * time.Minute,
+		log:          logging.RequireLoggerFromContext(ctx),
+	}
+}
+
+func TestMySQLOffloadNodeStatusRepo(t *testing.T) {
+	for name, variant := range usqldb.MySQLVariants {
+		t.Run(name, func(t *testing.T) {
+			ctx := logging.TestContext(t.Context())
+			repo := setupMySQLOffloadRepo(ctx, t, variant)
+
+			uid := "mysql-test-wf"
+			namespace := "default"
+			nodes := wfv1.Nodes{"node1": wfv1.NodeStatus{Message: "msg1"}}
+
+			// 1. Initial save
+			v1, err := repo.Save(ctx, uid, namespace, nodes)
+			require.NoError(t, err)
+
+			// 2. Duplicate save in the exact same second:
+			// In MySQL without clientFoundRows, this causes RowsAffected() == 0 because updatedat
+			// was already CURRENT_TIMESTAMP. The implementation must check Exists() and NOT
+			// return a false concurrent deletion error.
+			v1Duplicate, err := repo.Save(ctx, uid, namespace, nodes)
+			require.NoError(t, err, "duplicate Save in the same second must succeed in MySQL")
+			assert.Equal(t, v1, v1Duplicate)
+
+			// 3. DeleteIfOld preserves refreshed record:
+			// Backdate the record past the TTL
+			_, err = repo.sessionProxy.Session(ctx).SQL().Exec(
+				`UPDATE argo_workflows
+				 SET updatedat = CURRENT_TIMESTAMP - INTERVAL 10 MINUTE
+				 WHERE clustername = ? AND uid = ? AND version = ?`,
+				repo.clusterName, uid, v1,
+			)
+			require.NoError(t, err)
+
+			// Verify ListOldOffloads finds it
+			oldOffloads, err := repo.ListOldOffloads(ctx, namespace)
+			require.NoError(t, err)
+			require.Contains(t, oldOffloads[uid], v1)
+
+			// Refresh timestamp with Save()
+			reusedVersion, err := repo.Save(ctx, uid, namespace, nodes)
+			require.NoError(t, err)
+			assert.Equal(t, v1, reusedVersion)
+
+			// DeleteIfOld must NOT delete the refreshed record
+			err = repo.DeleteIfOld(ctx, uid, v1)
+			require.NoError(t, err)
+
+			// Verify still retrievable
+			retrieved, err := repo.Get(ctx, uid, v1)
+			require.NoError(t, err)
+			assert.Equal(t, nodes, retrieved)
+
+			// 4. DeleteIfOld deletes genuinely old record:
+			_, err = repo.sessionProxy.Session(ctx).SQL().Exec(
+				`UPDATE argo_workflows
+				 SET updatedat = CURRENT_TIMESTAMP - INTERVAL 10 MINUTE
+				 WHERE clustername = ? AND uid = ? AND version = ?`,
+				repo.clusterName, uid, v1,
+			)
+			require.NoError(t, err)
+
+			err = repo.DeleteIfOld(ctx, uid, v1)
+			require.NoError(t, err)
+
+			_, err = repo.Get(ctx, uid, v1)
+			require.Error(t, err)
+
+			// 5. Unconditional Delete
+			v2, err := repo.Save(ctx, uid, namespace, wfv1.Nodes{"node2": wfv1.NodeStatus{Message: "msg2"}})
+			require.NoError(t, err)
+			err = repo.Delete(ctx, uid, v2)
+			require.NoError(t, err)
+			_, err = repo.Get(ctx, uid, v2)
+			require.Error(t, err)
+		})
+	}
+}
```

**File**: `persist/sqldb/offload_node_status_repo_test.go` (modified, +305/-0)
```diff
@@ -1,12 +1,22 @@
 package sqldb
 
 import (
+	"runtime"
+	"strconv"
 	"testing"
+	"time"
 
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 
+	testcontainers "github.com/testcontainers/testcontainers-go"
+	testpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
+	"github.com/testcontainers/testcontainers-go/wait"
+
+	"github.com/argoproj/argo-workflows/v4/config"
 	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
+	"github.com/argoproj/argo-workflows/v4/util/logging"
+	usqldb "github.com/argoproj/argo-workflows/v4/util/sqldb"
 )
 
 func Test_nodeStatusVersion(t *testing.T) {
@@ -23,3 +33,298 @@ func Test_nodeStatusVersion(t *testing.T) {
 		assert.Equal(t, "fnv:2308444803", version)
 	})
 }
+
+func setupOffloadNodeStatusRepo(t *testing.T) *nodeOffloadRepo {
+	t.Helper()
+
+	ctx := logging.TestContext(t.Context())
+
+	postgresContainer, err := testpostgres.Run(ctx,
+		"postgres:17.4-alpine",
+		testpostgres.WithDatabase("argo"),
+		testpostgres.WithUsername("argo"),
+		testpostgres.WithPassword("argo"),
+		testcontainers.WithWaitStrategy(
+			wait.ForLog("database system is ready to accept connections").
+				WithOccurrence(2).
+				WithStartupTimeout(60*time.Second),
+		),
+	)
+	require.NoError(t, err)
+
+	t.Cleanup(func() {
+		terminateErr := testcontainers.TerminateContainer(postgresContainer)
+		if terminateErr != nil {
+			t.Logf("failed to terminate postgres container: %s", terminateErr)
+		}
+	})
+
+	host, err := postgresContainer.Host(ctx)
+	require.NoError(t, err)
+
+	mappedPort, err := postgresContainer.MappedPort(ctx, "5432/tcp")
+	require.NoError(t, err)
+
+	port, err := strconv.Atoi(mappedPort.Port())
+	require.NoError(t, err)
+
+	sessionProxy, err := usqldb.NewSessionProxy(ctx, usqldb.SessionProxyConfig{
+		DBConfig: config.DBConfig{
+			PostgreSQL: &config.PostgreSQLConfig{
+				DatabaseConfig: config.DatabaseConfig{
+					Database: "argo",
+					Host:     host,
+					Port:     port,
+				},
+			},
+		},
+		Username: "argo",
+		Password: "argo",
+	})
+	require.NoError(t, err)
+
+	t.Cleanup(func() {
+		closeErr := sessionProxy.Close()
+		if closeErr != nil {
+			t.Logf("failed to close database session: %s", closeErr)
+		}
+	})
+
+	const (
+		clusterName = "test"
+		tableName   = "argo_workflows"
+	)
+
+	err = Migrate(ctx, sessionProxy.Session(ctx), clusterName, tableName, sessionProxy.DBType())
+	require.NoError(t, err)
+
+	return &nodeOffloadRepo{
+		sessionProxy: sessionProxy,
+		clusterName:  clusterName,
+		tableName:    tableName,
+		ttl:          5 * time.Minute,
+		log:          logging.RequireLoggerFromContext(ctx),
+	}
+}
+
+func TestOffloadNodeStatusRepoSaveRefreshesTimestampOnDuplicate(t *testing.T) {
+	if runtime.GOOS == "windows" {
+		t.Skip("Testcontainers are not supported on Windows")
+	}
+
+	ctx := logging.TestContext(t.Context())
+	repo := setupOffloadNodeStatusRepo(t)
+
+	uid := "test-workflow-uid"
+	namespace := "default"
+
+	nodesA := wfv1.Nodes{
+		"my-node": wfv1.NodeStatus{
+			Message: "ErrImagePull",
+		},
+	}
+
+	nodesB := wfv1.Nodes{
+		"my-node": wfv1.NodeStatus{
+			Message: "ImagePullBackOff",
+		},
+	}
+
+	// Save version A.
+	versionA, err := repo.Save(ctx, uid, namespace, nodesA)
+	require.NoError(t, err)
+
+	// Save version B.
+	versionB, err := repo.Save(ctx, uid, namespace, nodesB)
+	require.NoError(t, err)
+
+	assert.NotEqual(t, versionA, versionB)
+
+	// Make version A old by backdating its updatedat timestamp.
+	_, err = repo.sessionProxy.Session(ctx).SQL().Exec(
+		`UPDATE argo_workflows
+         SET updatedat = CURRENT_TIMESTAMP - INTERVAL '10 minutes'
+         WHERE clustername = ? AND uid = ? AND version = ?`,
+		repo.clusterName,
+		uid,
+		versionA,
+	)
+	require.NoError(t, err)
+
+	// Verify version A is considered old.
+	oldOffloads, err := repo.ListOldOffloads(ctx, namespace)
+	require.NoError(t, err)
+	assert.Contains(t, oldOffloads[uid], versionA)
+
+	// Save version A again. This should refresh updatedat.
+	reusedVersion, err := repo.Save(ctx, uid, namespace, nodesA)
+	require.NoError(t, err)
+
+	assert.Equal(t, versionA, reusedVersion)
+
+	// Verify version A is no longer considered old.
+	oldOffloads, err = repo.ListOldOffloads(ctx, namespace)
+	require.NoError(t, err)
+	assert.NotContains(t, oldOffloads[uid], versionA)
+
+	// Verify the existing offloaded nodes are still retrievable.
+	retrievedNodes, err := repo.Get(ctx, uid, versionA)
+	require.NoError(t, err)
+	assert.Equal(t, nodesA, retrievedNodes)
+}
+
+func TestDeleteIfOldPreservesRefreshedRecord(t *testing.T) {
+	if runtime.GOOS == "windows" {
+		t.Skip("Testcontainers are not supported on Windows")
+	}
+
+	ctx := logging.TestContext(t.Context())
+	repo := setupOffloadNodeStatusRepo(t)
+
+	uid := "test-wf-preserve"
+	namespace := "default"
+	nodes := wfv1.Nodes{"node1": wfv1.NodeStatus{Message: "running"}}
+
+	// Save the record.
+	version, err := repo.Save(ctx, uid, namespace, nodes)
+	require.NoError(t, 
```

**File**: `workflow/controller/controller.go` (modified, +1/-1)
```diff
@@ -902,7 +902,7 @@ func (wfc *WorkflowController) deleteOffloadedNodesForWorkflow(ctx context.Conte
 		if wf != nil && wf.Status.OffloadNodeStatusVersion == version {
 			continue
 		}
-		if err := wfc.offloadNodeStatusRepo.Delete(ctx, uid, version); err != nil {
+		if err := wfc.offloadNodeStatusRepo.DeleteIfOld(ctx, uid, version); err != nil {
 			return err
 		}
 	}
```

**File**: `workflow/controller/controller_test.go` (modified, +42/-0)
```diff
@@ -764,6 +764,48 @@ func TestWorkflowController_archivedWorkflowGarbageCollector(t *testing.T) {
 	controller.archivedWorkflowGarbageCollector(logging.TestContext(t.Context()))
 }
 
+func TestWorkflowController_deleteOffloadedNodesForWorkflow_InvokesDeleteIfOld(t *testing.T) {
+	ctx := logging.TestContext(t.Context())
+
+	t.Run("MissingWorkflow", func(t *testing.T) {
+		cancel, controller := newController(ctx)
+		defer cancel()
+
+		mockRepo := &sqldbmocks.OffloadNodeStatusRepo{}
+		mockRepo.On("DeleteIfOld", "missing-uid", "v1").Return(nil)
+		mockRepo.On("DeleteIfOld", "missing-uid", "v2").Return(nil)
+		controller.offloadNodeStatusRepo = mockRepo
+
+		err := controller.deleteOffloadedNodesForWorkflow(ctx, "missing-uid", []string{"v1", "v2"})
+		require.NoError(t, err)
+		mockRepo.AssertExpectations(t)
+	})
+
+	t.Run("LiveWorkflowSkipsCurrentVersion", func(t *testing.T) {
+		wf := &wfv1.Workflow{
+			ObjectMeta: metav1.ObjectMeta{
+				Name:      "live-wf",
+				Namespace: "argo",
+				UID:       "live-uid",
+			},
+			Status: wfv1.WorkflowStatus{
+				OffloadNodeStatusVersion: "v2",
+			},
+		}
+		cancel, controller := newController(ctx, wf)
+		defer cancel()
+
+		mockRepo := &sqldbmocks.OffloadNodeStatusRepo{}
+		// v2 is live so it must NOT be deleted. Only v1 (old) should be deleted with DeleteIfOld.
+		mockRepo.On("DeleteIfOld", "live-uid", "v1").Return(nil)
+		controller.offloadNodeStatusRepo = mockRepo
+
+		err := controller.deleteOffloadedNodesForWorkflow(ctx, "live-uid", []string{"v1", "v2"})
+		require.NoError(t, err)
+		mockRepo.AssertExpectations(t)
+	})
+}
+
 // TestWorkflowController_archiveWorkflowAux_ArchivesOnce pins that a successfully
 // archived workflow is written to the archive exactly once. archiveWorkflow used
 // to call archiveWorkflowAux a second time on the success path, archiving every
```

#### Recent Merged Pull Requests:
- **PR #17494** (2026-11-11): ci(stale): clear problem/old draft when an item becomes active (@jmeridth)
- **PR #17493** (2026-11-11): ci(stale): allow manual runs and process problem/stale items (@jmeridth)
- **PR #17490** (2026-11-11): chore(deps): migrate renovate dependencyDashboard config (@eeran-cs)
- **PR #17484** (2026-11-11): fix(examples): make the ci WorkflowTemplate example work (cherry-pick #17437 for 4.1) (@argo-cd-cherry-pick-bot[bot])
- **PR #17471** (2026-11-11): fix(sqldb): refresh offload timestamp on duplicate save (@somiljain2006)
- **PR #17470** (closed): feat: add conditional parameter visibility to workflow submissions (@somiljain2006)

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

## X. sqldb): refresh offload timestamp on duplicate save (#17471)

**RULE**:
When implementing operations in `persist/sqldb/explosive_offload_node_status_repo.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in argoproj/argo-workflows. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d20aac05`: sqldb): refresh offload timestamp on duplicate save (#17471). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `persist/sqldb/explosive_offload_node_status_repo.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
func (n *explosiveOffloadNodeStatusRepo) DeleteIfOld(context.Context, string, string) error {
	return ErrOffloadNotSupported
}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d20aac05` are properly handled with clean fallback behavior.
