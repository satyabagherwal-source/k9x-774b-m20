# Forensic Learning Record (Deep Inspection): argoproj/argo-workflows

> **Canonical Artifact**: `07_PROJECT_LEARNING/argoproj-argo-workflows-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/argoproj/argo-workflows](https://github.com/argoproj/argo-workflows))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:27:14.495Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `argoproj/argo-workflows`
- **Description**: Workflow Engine for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 17022 stars

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

### Core Architecture Module: `server/auth/webhook/gitlab.go`
```
package webhook

import (
	"net/http"

	"github.com/go-playground/webhooks/v6/gitlab"
)

func gitlabMatch(secret string, r *http.Request) bool {
	hook, err := gitlab.New(gitlab.Options.Secret(secret))
	if err != nil {
		return false
	}
	_, err = hook.Parse(r,
		gitlab.PushEvents,
		gitlab.TagEvents,
		gitlab.IssuesEvents,
		gitlab.ConfidentialIssuesEvents,
		gitlab.CommentEvents,
		gitlab.MergeRequestEvents,
		gitlab.WikiPageEvents,
		gitlab.PipelineEvents,
		gitlab.BuildEvents,
		gitlab.JobEvents,
		gitlab.SystemHookEvents,
	)
	return err == nil
}

```

### Core Architecture Module: `server/auth/webhook/interceptor.go`
```
package webhook

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/argoproj/argo-workflows/v4/util/logging"
	"github.com/argoproj/argo-workflows/v4/util/secrets"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

type webhookClient struct {
	// e.g "github"
	Type string `json:"type"`
	// e.g. "shh!"
	Secret string `json:"secret"`
}

type matcher = func(secret string, r *http.Request) bool

// parser for each types, these should be fast, i.e. no database or API interactions
var webhookParsers = map[string]matcher{
	"bitbucket":       bitbucketMatch,
	"bitbucketserver": bitbucketserverMatch,
	"github":          githubMatch,
	"gitlab":          gitlabMatch,
}

const pathPrefix = "/api/v1/events/"

type Interceptor struct {
	logger logging.Logger
}

func NewInterceptor(logger logging.Logger) *Interceptor {
	return &Interceptor{logger: logger}
}

// Interceptor creates an annotator that verifies webhook signatures and adds the appropriate access token to the request.
func (i *Interceptor) Interceptor(client kubernetes.Interface) func(w http.ResponseWriter, r *http.Request, next http.Handler) {
	return func(w http.ResponseWriter, r *http.Request, next http.Handler) {
		err := i.addWebhookAuthorization(r, client)
		if err != nil {
			i.logger.WithError(err).Error(r.Context(), "Failed to process webhook request")
			w.WriteHeader(http.StatusForbidden)
			// hide the message from the user, because it could help them attack us
			_, _ = w.Write([]byte(`{"message": "failed to process webhook request"}`))
		} else {
			next.ServeHTTP(w, r)
		}
	}
}

func (i *Interceptor) addWebhookAuthorization(r *http.Request, kube kubernetes.Interface) error {
	// try and exit quickly before we do anything API calls
	if r.Method != http.MethodPost || len(r.Header["Authorization"]) > 0 || !strings.HasPrefix(r.URL.Path, pathPrefix) {
		return nil
	}
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, pathPrefix), "/", 2)
	if len(parts) != 2 {
		return nil
	}
	namespace := parts[0]
	secretsInterface := kube.CoreV1().Secrets(namespace)
	ctx := r.Context()

	webhookClients, err := secretsInterface.Get(ctx, "argo-workflows-webhook-clients", metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get webhook clients: %w", err)
	}
	// we need to read the request body to check the signature, but we still need it for the GRPC request,
	// so read it all now, and then reinstate when we are done.
	// Limit to 2MB to prevent denial-of-service via oversized webhook payloads.
	const maxWebhookSize = 2 * 1024 * 1024 // 2MB
	buf, err2 := io.ReadAll(io.LimitReader(r.Body, maxWebhookSize+1))
	if err2 != nil {
		return fmt.Errorf("failed to read webhook request body: %w", err2)
	}
	if len(buf) > maxWebhookSize {
		return fmt.Errorf("webhook request body exceeds maximum size of 2MB")
	}
	defer func() { r.Body = io.NopCloser(bytes.NewBuffer(buf)) }()
	serviceAccountInterface := kube.CoreV1().ServiceAccounts(namespace)
	for serviceAccountName, data := range webhookClients.Data {
		r.Body = io.NopCloser(bytes.NewBuffer(buf))
		client := &webhookClient{}
		err := yaml.Unmarshal(data, client)
		if err != nil {
			return fmt.Errorf("failed to unmarshal webhook client \"%s\": %w", serviceAccountName, err)
		}
		i.logger.WithFields(logging.Fields{"serviceAccountName": serviceAccountName, "webhookType": client.Type}).Debug(r.Context(), "Attempting to match webhook request")
		ok := webhookParsers[client.Type](client.Secret, r)
		if ok {
			i.logger.WithField("serviceAccountName", serviceAccountName).Debug(r.Context(), "Matched webhook request")
			serviceAccount, err := serviceAccountInterface.Get(ctx, serviceAccountName, metav1.GetOptions{})
			if err != nil {
				return fmt.Errorf("failed to get service account \"%s\": %w", serviceAccountName, err)
			}
			tokenSecret, err := secretsInterface.Get(ctx, secrets.TokenNameForServiceAccount(serviceAccount), metav1.GetOptions{})
			if err != nil {
				return fmt.Errorf("failed to get token secret \"%s\": %w", tokenSecret, err)
			}
			r.Header["Authorization"] = []string{"Bearer " + string(tokenSecret.Data["token"])}
			return nil
		}
	}
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17123** (2026-10-05): **Upload Artifact UI is not sending Auth Headers**
  *Symptoms*: ### Pre-requisites  - [x] I have double-checked my configuration - [x] I have tested with the `:latest` image tag (i.e. `quay.io/argoproj/workflow-controller:latest`) and can confirm the issue still exists on `:latest`. If not, I have explained why, **in detail**, in my description below. - [x] I have searched existing issues and could not find a match for this bug - [ ] I'd like to contribute the fix myself (see [contributing guide](https://github.com/argoproj/argo-workflows/blob/main/docs/CONTRIBUTING.md))  ### What happened? What did you expect to happen?   In addition to the following bug: https://github.com/argoproj/argo-workflows/issues/17110  I found that the UI does not send the Authorization Header to the api request which will result in a 401 error if security is enabled on the argo server.    https://github.com/argoproj/argo-workflows/blob/main/ui/src/shared/components/artifacts-input/artifacts-input.tsx#L78  I have validated that the api works in postman if I send the Authorization header, but as is it won't work when calling from the UI.  In chrome developer tools I do not see the Authorization header in the "request header"   ### Version(s)  v4.1.4  ### Paste a minimal workflow that reproduces the issue. We must be able to run the workflow; don't enter a workflow that uses private images.  ```YAML Enable Security on Argo Server  apiVersion: v1 kind: Secret metadata:   name: s3-creds   namespace: argo type: Opaque stringData:   accessKey: AKI**********   secretKe
  **Post-Mortem & Fix Analysis**:
  > Hello @kmcrawford , the authorization in ui for api calls works with cookies. From UI you will not see any Authorization header. The cookies are automatically added to api calls with same-origin. Hence the cookies should be present for all and any calls for going to server. 
  > @gaurang9991  I see the cookie is path based and b/c https://github.com/argoproj/argo-workflows/issues/17110 the path isn't correct

- **Issue #17116** (2026-10-02): **test: move inline controller workflow fixtures to testdata**
  *Symptoms*: Related to #13610. This PR handles `workflow/controller/inline_test.go` as one part of the broader fixture migration.  ### Motivation  The inline controller tests embed large YAML fixtures in the Go test file. Moving these fixtures into `testdata` makes the test assertions easier to read and the YAML easier to maintain.  ### Modifications  - Extract the five existing Workflow and WorkflowTemplate fixtures into `workflow/controller/testdata/inline/`. - Load them with the existing `MustUnmarshalWorkflow` / `MustUnmarshalWorkflowTemplate` file-reference support. - Preserve all test assertions and share the Workflow fixture between the two template-reference tests.  ### Verification  - All four affected tests passed before and after the migration. - The full `workflow/controller` test package passed after the migration. - Compared the five YAML files with their original literals: contents are identical apart from leading/trailing blank lines. - `git diff --check`: passed. - `make pre-commit -B` was attempted locally. It could not complete because the code-generation dependency downloads failed: first a Buf registry export reported an unavailable server, and a subsequent retry failed to connect to `github.com/kubernetes/api`. The controller tests passed independently. Full codegen/lint/docs validation remains pending in an environment with working access to these dependencies.  ### Documentation  No user-facing behavior changes; no product documentation changes are needed.  ### AI
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/argoproj/argo-workflows/pull/17116?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 44.90%. Comparing base ([`98f5436`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/98f5436c32cff8b66caae48ccea439f674f5b79c?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)) to head ([`1d659a1`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/1d659a17d69160428ac26cdcd74dd0fb41f6f5c1?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main   #17116      +/-   

- **Issue #17106** (2026-09-30): **chore(deps): update module github.com/google/go-containerregistry to v0.22.1 (main)**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Adoption](https://docs.renovatebot.com/merge-confidence/) | [Passing](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---|---|---| | [github.com/google/go-containerregistry](https://redirect.github.com/google/go-containerregistry) | `v0.21.9` → `v0.22.1` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fgoogle%2fgo-containerregistry/v0.22.1?slim=true) | ![adoption](https://developer.mend.io/api/mc/badges/adoption/go/github.com%2fgoogle%2fgo-containerregistry/v0.22.1?slim=true) | ![passing](https://developer.mend.io/api/mc/badges/compatibility/go/github.com%2fgoogle%2fgo-containerregistry/v0.21.9/v0.22.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fgoogle%2fgo-containerregistry/v0.21.9/v0.22.1?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/15285) for more information.  ---  ### Release Notes  <details> <summary>google/go-containerregistry (github.com/google/go-containerregistry)</summary>  ### [`v0.22.1`](https://redirect.github.com/google/go-containerregistry/releases/tag/v0.22.1)  [Compare Source](https://redirect.github.com/google/go-containerregistry/compare/v0.22.0...v0.22.1)  #### What's Changed  - Reject non-canonical IP literals in all SS
  **Post-Mortem & Fix Analysis**:
  > ### ℹ️ Artifact update notice  ##### File name: go.mod  In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):   - 1 additional dependency was updated   Details:   | **Package**             | **Change**                                       | | :---------------------- | :----------------------------------------------- | | `github.com/docker/cli` | `v29.6.2+incompatible` -> `v29.7.2+incompatible` |
  > ## [Codecov](https://app.codecov.io/gh/argoproj/argo-workflows/pull/17106?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 32.79%. Comparing base ([`dadd691`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/dadd69141c570fa678f7d51ee6decfe3fa77f109?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)) to head ([`e285336`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/e2853362ef97e47a1be6d002ea4f90dac15395fd?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)).  <details><summary>Additional details and impacted files</summary>    ```diff @@             Coverage Diff             @@ ##             main   #17106       +/- 

- **Issue #17105** (2026-09-29): **chore(deps): update google.golang.org/genproto/googleapis/api digest to 8a89bd6 (main)**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [google.golang.org/genproto/googleapis/api](https://redirect.github.com/googleapis/go-genproto) | require | digest | `b142276` → `8a89bd6` |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/15285) for more information.  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/argoproj/argo-workflows). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMTIuMCIsInVwZGF0ZWRJblZlciI6IjQ0LjExMi4wIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6WyJ0eXBlL2RlcGVuZGVuY2llcyJdfQ==--> 
  **Post-Mortem & Fix Analysis**:
  > ### ℹ️ Artifact update notice  ##### File name: go.mod  In order to perform the update(s) described in the table above, Renovate ran the `go get` command, which resulted in the following additional change(s):   - 1 additional dependency was updated   Details:   | **Package**                                 | **Change**                                                                   | | :------------------------------------------ | :--------------------------------------------------------------------------- | | `google.golang.org/genproto/googleapis/rpc` | `v0.0.0-20260918162117-cecb64721679` -> `v0.0.0-20260921155816-b14227669459` |
  > ## [Codecov](https://app.codecov.io/gh/argoproj/argo-workflows/pull/17105?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 44.91%. Comparing base ([`9b6bdff`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/9b6bdff3cf5d08a1cdc728063f7f9e10f418cd19?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)) to head ([`3f96edd`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/3f96eddde28c3a18da5ecabf215208918fcbe669?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main   #17105      +/-   
  > ### Edited/Blocked Notification  Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.  You can manually request rebase by checking the rebase/retry box above.   ⚠️ **Warning**: custom changes will be lost.

- **Issue #17104** (2026-09-29): **fix(examples): mark retry-script as flaky so it is skipped in e2e**
  *Symptoms*: - [ ] Ran `make pre-commit -B` - [x] Signed-off commits with [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) messages - [x] PR title is a conventional commit message (it becomes the release notes entry) - [x] Unit or e2e tests cover the change - [ ] For features: an associated issue and a feature description file (`make feature-new`) - [x] Opened as draft; will mark "Ready for review" once builds are green  ### Motivation  `TestExampleWorkflows/../../examples/retry-script.yaml` fails intermittently in CI. The example fails deliberately with a 66% probability per attempt and sets `retryStrategy: limit: "10"`, so all 11 attempts fail about 1.2% of the time — roughly 1 run in 86. When that happens the workflow ends Failed and the e2e examples suite fails with it.  I hit this on #17085:  ``` DONE 199 tests, 96 skipped, 2 failures in 350.686s FAIL test/e2e.TestExampleWorkflows/../../examples/retry-script.yaml (55.14s) ```  with all 11 attempts logged as `main: Error (exit code 1)`.  ### Modifications  Add `workflows.argoproj.io/no-test: "flaky"` to the example, which the examples harness already honours by skipping.  This matches the sibling examples: `retry-container.yaml` is functionally identical (same 66% failure, same `limit: "10"`) and already carries the label, as does `retry-with-steps.yaml`. Eleven examples use it today. `retry-script.yaml` looks like it was simply missed.  If you would rather keep the example under test, the alternative is raising `
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/argoproj/argo-workflows/pull/17104?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository: argoproj/argo-workflows/.coderabbit.yaml  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `237164c9-15ca-4a03-9616-9798bcbad30d`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and

- **Issue #17102** (2026-09-29): **fix: tie database queries to the caller's context (cherry-pick #17076 for 4.1)**
  *Symptoms*: Cherry-picked fix: tie database queries to the caller's context (#17076)  Signed-off-by: Alan Clucas <alan@clucas.org>

- **Issue #17101** (2026-09-29): **chore(deps): update module github.com/azure/azure-sdk-for-go/sdk/azcore to v1.23.2 (main)**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Adoption](https://docs.renovatebot.com/merge-confidence/) | [Passing](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---|---|---| | [github.com/Azure/azure-sdk-for-go/sdk/azcore](https://redirect.github.com/Azure/azure-sdk-for-go) | `v1.23.1` → `v1.23.2` | ![age](https://developer.mend.io/api/mc/badges/age/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.2?slim=true) | ![adoption](https://developer.mend.io/api/mc/badges/adoption/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.2?slim=true) | ![passing](https://developer.mend.io/api/mc/badges/compatibility/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.1/v1.23.2?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/go/github.com%2fAzure%2fazure-sdk-for-go%2fsdk%2fazcore/v1.23.1/v1.23.2?slim=true) |  ---  > [!WARNING] > Some dependencies could not be looked up. Check the [Dependency Dashboard](../issues/15285) for more information.  ---  ### Release Notes  <details> <summary>Azure/azure-sdk-for-go (github.com/Azure/azure-sdk-for-go/sdk/azcore)</summary>  ### [`v1.23.2`](https://redirect.github.com/Azure/azure-sdk-for-go/releases/tag/sdk/azcore/v1.23.2)  #### 1.23.2 (2026-09-28)  ##### Bugs Fixed  - Fixed unmarshalling `datetime.RFC7231` to use a fixed `GMT` zone.  </det
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/argoproj/argo-workflows/pull/17101?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 44.81%. Comparing base ([`258ec1b`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/258ec1be469d55ca58cec85716b3900af2f486a5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)) to head ([`c23046a`](https://app.codecov.io/gh/argoproj/argo-workflows/commit/c23046a33ee6f6ea4e3f5d2bb4f5650e6354fa01?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=argoproj)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main   #17101      +/-   
  > ### Edited/Blocked Notification  Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.  You can manually request rebase by checking the rebase/retry box above.   ⚠️ **Warning**: custom changes will be lost.

- **Issue #17100** (2026-09-28): **fix: termination of suspended workflow (cherry-pick #17052 for 4.1)**
  *Symptoms*: Cherry-picked fix: termination of suspended workflow (#17052)  Signed-off-by: Gaurang Mishra <gaurang.mishra@amadeus.net>

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

### Incident Patch 1: `e2171d28` (2026-10-05)
**Commit Message**: chore: use upstream envcar carrier for TRACEPARENT propagation (#17015)

Signed-off-by: Alan Clucas <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-0)
```diff
@@ -66,6 +66,7 @@ require (
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.70.0
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0
 	go.opentelemetry.io/contrib/instrumentation/runtime v0.70.0
+	go.opentelemetry.io/contrib/propagators/envcar v0.70.0
 	go.opentelemetry.io/otel v1.46.0
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.45.0
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.45.0
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -877,6 +877,8 @@ go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0 h1:LMuyCAy
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0/go.mod h1:085m8qbm4hgc8rZWGDEa4vmyyo2c3nPxUslYUKUIU04=
 go.opentelemetry.io/contrib/instrumentation/runtime v0.70.0 h1:1+WLVYezXA9tkuVzKQri8zgB1cEIVYKUSoYIRjsBiMU=
 go.opentelemetry.io/contrib/instrumentation/runtime v0.70.0/go.mod h1:rbAXUUXqQDMxpSnmof4VtcZ+7YpZQEtjXSCIfdvR0Go=
+go.opentelemetry.io/contrib/propagators/envcar v0.70.0 h1:ff/FI6f/ZRgcFluGTATyhGjVOuCGeWV2tg35kKvjie0=
+go.opentelemetry.io/contrib/propagators/envcar v0.70.0/go.mod h1:5AvLH2mk5oz7vcmpd6LZ4FJs+NGe13hX1ad24c3OxLI=
 go.opentelemetry.io/otel v1.46.0 h1:FHt5/CDyVxi/8IM1CH7VE/rRgq3kLHa2mSTVMO8AWyc=
 go.opentelemetry.io/otel v1.46.0/go.mod h1:Gj3SEScelsNC45tp4nSxRYlS+f5iez7W8XPMCt905kE=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.45.0 h1:klTViGcsvLCd1xN3rZzfZ12NslC/OimbmR+k+A006RI=
```

**File**: `util/telemetry/carrier.go` (removed, +0/-64)
```diff
@@ -1,64 +0,0 @@
-// Copyright The OpenTelemetry Authors
-// SPDX-License-Identifier: Apache-2.0
-
-package telemetry
-
-import (
-	"os"
-	"strings"
-
-	"go.opentelemetry.io/otel/propagation"
-)
-
-// Carrier is a TextMapCarrier that uses the environment variables as a
-// storage medium for propagated key-value pairs. The keys are uppercased
-// before being used to access the environment variables.
-// This is useful for propagating values that are set in the environment
-// and need to be accessed by different processes or services.
-// The keys are uppercased to avoid case sensitivity issues across different
-// operating systems and environments.
-type Carrier struct {
-	// SetEnvFunc is a function that sets the environment variable.
-	// Usually, you want to set the environment variable for processes
-	// that are spawned by the current process.
-	// By default implementation, it does nothing.
-	// Using os.Setenv here is discouraged as the environment should
-	// be immutable:
-	// https://opentelemetry.io/docs/specs/otel/context/env-carriers/#environment-variable-immutability
-	SetEnvFunc func(key, value string)
-}
-
-// Compile time check that Carrier implements the TextMapCarrier.
-var _ propagation.TextMapCarrier = Carrier{}
-
-// Get returns the value associated with the passed key.
-// The key is uppercased before being used to access the environment variable.
-func (Carrier) Get(key string) string {
-	k := strings.ToUpper(key)
-	return os.Getenv(k)
-}
-
-// Set stores the key-value pair in the environment variable.
-// The key is uppercased before being used to set the environment variable.
-// If SetEnvFunc is not set, this method does nothing.
-func (e Carrier) Set(key, value string) {
-	if e.SetEnvFunc == nil {
-		return
-	}
-	k := strings.ToUpper(key)
-	e.SetEnvFunc(k, value)
-}
-
-// Keys lists the keys stored in this carrier.
-// This returns all the keys in the environment variables.
-func (Carrier) Keys() []string {
-	keys := make([]string, 0, len(os.Environ()))
-	for _, kv := range os.Environ() {
-		kvPair := strings.SplitN(kv, "=", 2)
-		if len(kvPair) < 1 {
-			continue
-		}
-		keys = append(keys, strings.ToLower(kvPair[0]))
-	}
-	return keys
-}
```

**File**: `workflow/controller/workflowpod.go` (modified, +2/-2)
```diff
@@ -13,6 +13,7 @@ import (
 
 	"k8s.io/apimachinery/pkg/util/strategicpatch"
 
+	"go.opentelemetry.io/contrib/propagators/envcar"
 	"go.opentelemetry.io/otel/propagation"
 	apiv1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
@@ -25,7 +26,6 @@ import (
 	cmdutil "github.com/argoproj/argo-workflows/v4/util/cmd"
 	"github.com/argoproj/argo-workflows/v4/util/intstr"
 	"github.com/argoproj/argo-workflows/v4/util/logging"
-	"github.com/argoproj/argo-workflows/v4/util/telemetry"
 	"github.com/argoproj/argo-workflows/v4/util/template"
 	varkeys "github.com/argoproj/argo-workflows/v4/util/variables/keys"
 	"github.com/argoproj/argo-workflows/v4/workflow/common"
@@ -646,7 +646,7 @@ func (pb *podBuilder) build(ctx context.Context) (*podBuildResult, error) {
 		{Name: common.EnvVarWorkflowName, Value: pb.in.wfName},
 	}
 
-	carrier := telemetry.Carrier{SetEnvFunc: func(key, value string) {
+	carrier := &envcar.Carrier{SetEnvFunc: func(key, value string) {
 		envVars = append(envVars, apiv1.EnvVar{Name: key, Value: value})
 	}}
 	prop := propagation.TraceContext{}
```

**File**: `workflow/executor/tracing/tracing.go` (modified, +4/-1)
```diff
@@ -3,6 +3,7 @@ package tracing
 import (
 	"context"
 
+	"go.opentelemetry.io/contrib/propagators/envcar"
 	"go.opentelemetry.io/otel/propagation"
 
 	"github.com/argoproj/argo-workflows/v4/util/telemetry"
@@ -23,7 +24,9 @@ func New(ctx context.Context, serviceName string) (*Tracing, error) {
 }
 
 func InjectTraceContext(ctx context.Context) context.Context {
-	carrier := telemetry.Carrier{}
+	// Extract-only carrier: no SetEnvFunc, so it reads TRACEPARENT from the
+	// process environment the controller injected into the pod spec.
+	carrier := &envcar.Carrier{}
 	prop := propagation.TraceContext{}
 	return prop.Extract(ctx, carrier)
 }
```

---

### Incident Patch 2: `9b2e8fd2` (2026-09-29)
**Commit Message**: fix(examples): mark retry-script as flaky so it is skipped in e2e (#17104)

Signed-off-by: Jeffery Lofoneh Asamani <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `examples/retry-script.yaml` (modified, +2/-0)
```diff
@@ -3,6 +3,8 @@ apiVersion: argoproj.io/v1alpha1
 kind: Workflow
 metadata:
   generateName: retry-script-
+  labels:
+    workflows.argoproj.io/no-test: "flaky"
 spec:
   entrypoint: retry-script
   templates:
```

---

### Incident Patch 3: `aa1912fc` (2026-09-29)
**Commit Message**: fix: tie database queries to the caller's context (#17076)

Signed-off-by: Alan Clucas <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `persist/sqldb/workflow_archive.go` (modified, +2/-2)
```diff
@@ -119,7 +119,7 @@ func (r *workflowArchive) ArchiveWorkflow(ctx context.Context, wf *wfv1.Workflow
 		workflow = bytes.ReplaceAll(workflow, []byte("\\u0000"), []byte(postgresNullReplacement))
 	}
 	return r.sessionProxy.TxWith(ctx, func(s *sqldb.SessionProxy) error {
-		sess := s.Session()
+		sess := s.Session(ctx)
 		_, err := sess.SQL().
 			DeleteFrom(archiveTableName).
 			Where(r.clusterManagedNamespaceAndInstanceID()).
@@ -679,7 +679,7 @@ func (r *workflowArchive) GetWorkflowForEstimator(ctx context.Context, namespace
 
 	var result *wfv1.Workflow
 	err := r.sessionProxy.With(queryCtx, func(s db.Session) error {
-		selector := s.WithContext(queryCtx).SQL().
+		selector := s.SQL().
 			Select("name", "namespace", "uid", "startedat", "finishedat").
 			From(archiveTableName).
 			Where(r.clusterManagedNamespaceAndInstanceID()).
```

**File**: `persist/sqldb/workflow_archive_mysql_test.go` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ func setupMySQLArchiveTest(ctx context.Context, t *testing.T, v usqldb.MySQLVari
 	})
 	require.NoError(t, err)
 
-	err = Migrate(ctx, proxy.Session(), "test", "argo_workflows", proxy.DBType())
+	err = Migrate(ctx, proxy.Session(ctx), "test", "argo_workflows", proxy.DBType())
 	require.NoError(t, err)
 
 	t.Cleanup(func() { proxy.Close() })
```

**File**: `util/sqldb/migrate.go` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ func ByType(dbType DBType, changes TypedChanges) Change {
 func Migrate(ctx context.Context, session db.Session, dbType DBType, versionTableName string, changes []Change) error {
 	ctx, logger := logging.RequireLoggerFromContext(ctx).WithField("dbType", dbType).InContext(ctx)
 	logger.Info(ctx, "Migrating database schema")
+	session = session.WithContext(ctx)
 
 	{
 		// poor mans SQL migration
```

**File**: `util/sqldb/session.go` (modified, +18/-8)
```diff
@@ -203,6 +203,12 @@ func (sp *SessionProxy) isNetworkError(err error) bool {
 		return false
 	}
 
+	// context.DeadlineExceeded satisfies net.Error with Timeout() == true, so
+	// check for it before the pattern and net.Error checks below.
+	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
+		return false
+	}
+
 	errStr := strings.ToLower(err.Error())
 
 	if errors.Is(err, io.ErrUnexpectedEOF) ||
@@ -260,7 +266,8 @@ func (sp *SessionProxy) isNetworkError(err error) bool {
 	return false
 }
 
-// With executes with a db Session
+// With executes fn with a db Session bound to ctx, so cancelling ctx cancels
+// the running statement.
 func (sp *SessionProxy) With(ctx context.Context, fn func(db.Session) error) error {
 	logger := logging.RequireLoggerFromContext(ctx)
 	sp.mu.RLock()
@@ -277,13 +284,13 @@ func (sp *SessionProxy) With(ctx context.Context, fn func(db.Session) error) err
 		return fmt.Errorf("no active session")
 	}
 
-	err := fn(sess)
+	err := fn(sess.WithContext(ctx))
 	if err == nil {
 		return nil
 	}
 
-	// If it's not a network error or inside a tx do not retry
-	if !sp.isNetworkError(err) || sp.insideTransaction {
+	// If the caller has given up, it's not a network error, or inside a tx do not retry
+	if ctx.Err() != nil || !sp.isNetworkError(err) || sp.insideTransaction {
 		return err
 	}
 
@@ -299,7 +306,7 @@ func (sp *SessionProxy) With(ctx context.Context, fn func(db.Session) error) err
 		return fmt.Errorf("no active session after reconnection")
 	}
 
-	if retryErr := fn(sess); retryErr != nil {
+	if retryErr := fn(sess.WithContext(ctx)); retryErr != nil {
 		return fmt.Errorf("operation failed after reconnection: %w", retryErr)
 	}
 
@@ -365,13 +372,16 @@ func (sp *SessionProxy) reconnectLocked(ctx context.Context) error {
 	return fmt.Errorf("reconnection failed after %d retries, last error: %w", sp.maxRetries, err)
 }
 
-// Session returns the underlying session. Use With() for operations that need reconnection.
+// Session returns the underlying session bound to ctx. Use With() for operations that need reconnection.
 // This method is provided for cases where you need direct access to the session,
 // but it won't provide automatic reconnection.
-func (sp *SessionProxy) Session() db.Session {
+func (sp *SessionProxy) Session(ctx context.Context) db.Session {
 	sp.mu.RLock()
 	defer sp.mu.RUnlock()
-	return sp.sess
+	if sp.sess == nil {
+		return nil
+	}
+	return sp.sess.WithContext(ctx)
 }
 
 // Close closes the session proxy and underlying session
```

**File**: `util/sqldb/session_test.go` (modified, +53/-2)
```diff
@@ -2,6 +2,8 @@ package sqldb
 
 import (
 	"context"
+	"errors"
+	"fmt"
 	"net/netip"
 	"runtime"
 	"testing"
@@ -101,11 +103,11 @@ func TestSessionReconnect(t *testing.T) {
 	})
 	require.NoError(t, err)
 
-	err = sessionProxy.Session().Ping()
+	err = sessionProxy.Session(ctx).Ping()
 	require.NoError(t, err)
 	cancel()
 
-	err = sessionProxy.Session().Ping()
+	err = sessionProxy.Session(ctx).Ping()
 	require.Error(t, err)
 
 	doneChan := make(chan struct{})
@@ -130,3 +132,52 @@ func TestSessionReconnect(t *testing.T) {
 	<-doneChan
 	cancel()
 }
+
+func TestIsNetworkErrorIgnoresContextErrors(t *testing.T) {
+	sp := &SessionProxy{}
+	assert.False(t, sp.isNetworkError(context.Canceled))
+	assert.False(t, sp.isNetworkError(context.DeadlineExceeded))
+	assert.False(t, sp.isNetworkError(fmt.Errorf("query: %w", context.DeadlineExceeded)))
+	assert.True(t, sp.isNetworkError(errors.New("read tcp: i/o timeout")))
+}
+
+func TestSessionWithCancelsStatement(t *testing.T) {
+	if runtime.GOOS == "windows" {
+		t.Skip("This test uses the Linux container image and therefore cannot be performed on the Windows platform")
+	}
+
+	ctx := logging.TestContext(t.Context())
+	cfg, cancel, err := setupPostgresContainer(ctx, t)
+	require.NoError(t, err)
+	defer cancel()
+
+	sessionProxy, err := NewSessionProxy(ctx, SessionProxyConfig{
+		DBConfig: cfg,
+		Username: userName,
+		Password: password,
+	})
+	require.NoError(t, err)
+	origSess := sessionProxy.sess
+
+	queryCtx, queryCancel := context.WithTimeout(ctx, 500*time.Millisecond)
+	defer queryCancel()
+	start := time.Now()
+	err = sessionProxy.With(queryCtx, func(s db.Session) error {
+		_, execErr := s.SQL().Exec("SELECT pg_sleep(30)")
+		return execErr
+	})
+	require.Error(t, err)
+	assert.Less(t, time.Since(start), 10*time.Second, "statement should be cancelled with its context")
+	assert.Same(t, origSess, sessionProxy.sess, "a cancelled statement must not trigger a reconnect")
+
+	// The server-side statement is cancelled too, not just abandoned by the client.
+	assert.Eventually(t, func() bool {
+		var count int
+		row, err := sessionProxy.Session(ctx).SQL().QueryRow(
+			"SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query = 'SELECT pg_sleep(30)'")
+		if err != nil || row.Scan(&count) != nil {
+			return false
+		}
+		return count == 0
+	}, 10*time.Second, 200*time.Millisecond)
+}
```

**File**: `util/sync/db/config.go` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ func (d *Info) Migrate(ctx context.Context) {
 	logger := logging.RequireLoggerFromContext(ctx)
 	logger.Info(ctx, "Setting up sync manager database")
 	if !d.Config.SkipMigration {
-		err := migrate(ctx, d.SessionProxy.Session(), d.SessionProxy.DBType(), &d.Config)
+		err := migrate(ctx, d.SessionProxy.Session(ctx), d.SessionProxy.DBType(), &d.Config)
 		if err != nil {
 			// Carry on anyway, but database sync locks won't work
 			logger.WithError(err).Warn(ctx, "cannot initialize semaphore database, database sync locks won't work")
```

**File**: `workflow/controller/config.go` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@ func (wfc *WorkflowController) updateConfig(ctx context.Context) error {
 			logger.Info(ctx, "Persistence Session created successfully")
 			wfc.sessionProxy = sessionProxy
 		}
-		sqldb.ConfigureDBSession(wfc.sessionProxy.Session(), persistence.ConnectionPool)
+		sqldb.ConfigureDBSession(wfc.sessionProxy.Session(ctx), persistence.ConnectionPool)
 		if persistence.NodeStatusOffload {
 			wfc.offloadNodeStatusRepo, err = persist.NewOffloadNodeStatusRepo(ctx, logger, wfc.sessionProxy, persistence.GetClusterName(), tableName)
 			if err != nil {
@@ -105,7 +105,7 @@ func (wfc *WorkflowController) initDB(ctx context.Context) error {
 		return err
 	}
 
-	return persist.Migrate(ctx, wfc.sessionProxy.Session(), persistence.GetClusterName(), tableName, wfc.sessionProxy.DBType())
+	return persist.Migrate(ctx, wfc.sessionProxy.Session(ctx), persistence.GetClusterName(), tableName, wfc.sessionProxy.DBType())
 }
 
 func (wfc *WorkflowController) newRateLimiter() *rate.Limiter {
```

**File**: `workflow/sync/database_helper_test.go` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ func createTestDBSession(ctx context.Context, t *testing.T, dbType sqldb.DBType)
 	require.NotNil(t, info.SessionProxy, "failed to migrate database")
 
 	// Mark this controller as alive immediately
-	_, err = info.SessionProxy.Session().Collection(info.Config.ControllerTable).
+	_, err = info.SessionProxy.Session(ctx).Collection(info.Config.ControllerTable).
 		Insert(&syncdb.ControllerHealthRecord{
 			Controller: info.Config.ControllerName,
 			Time:       time.Now(),
```

---

### Incident Patch 4: `258ec1be` (2026-09-28)
**Commit Message**: fix: termination of suspended workflow (#17052)

Signed-off-by: Gaurang Mishra <[REDACTED_EMAIL]>
Co-authored-by: Gaurang Mishra <[REDACTED_EMAIL]>

**File**: `ui/src/shared/workflow-operations-map.test.ts` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+import {Workflow} from './models';
+import {WorkflowOperationsMap} from './workflow-operations-map';
+
+const suspendedWorkflow = (shutdown?: 'Terminate' | 'Stop'): Workflow =>
+    ({
+        metadata: {name: 'hello-world', namespace: 'argo'},
+        spec: {suspend: true, shutdown},
+        status: {phase: 'Running'}
+    }) as unknown as Workflow;
+
+const terminatedWorkflow = (shutdown?: 'Terminate' | 'Stop'): Workflow =>
+    ({
+        metadata: {name: 'hello-world', namespace: 'argo'},
+        spec: {suspend: true, shutdown},
+        status: {phase: 'Failed'}
+    }) as unknown as Workflow;
+
+const failedWorkflow = (suspend?: boolean): Workflow =>
+    ({
+        metadata: {name: 'hello-world', namespace: 'argo'},
+        spec: {suspend},
+        status: {phase: 'Failed'}
+    }) as unknown as Workflow;
+
+describe('WorkflowOperationsMap RESUME', () => {
+    test('enabled for a suspended workflow with no shutdown strategy', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(suspendedWorkflow())).toBe(false);
+    });
+
+    test('enabled when the workflow is being terminated', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(suspendedWorkflow('Terminate'))).toBe(false);
+    });
+
+    test('enabled once the workflow is being stopped', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(suspendedWorkflow('Stop'))).toBe(false);
+    });
+
+    test('disabled when the workflow is not suspended', () => {
+        const wf = suspendedWorkflow();
+        wf.spec.suspend = false;
+        expect(WorkflowOperationsMap.RESUME.disabled(wf)).toBe(true);
+    });
+
+    test('disabled once the workflow is terminated', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(terminatedWorkflow('Terminate'))).toBe(true);
+    });
+
+    test('disabled once the workflow is stopped', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(terminatedWorkflow('Stop'))).toBe(true);
+    });
+
+    test('disabled for a failed workflow', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(failedWorkflow())).toBe(true);
+    });
+
+    test('disabled for a completed suspended workflow', () => {
+        expect(WorkflowOperationsMap.RESUME.disabled(failedWorkflow(true))).toBe(true);
+    });
+});
```

**File**: `ui/src/shared/workflow-operations-map.ts` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ export const WorkflowOperationsMap: WorkflowOperations = {
     RESUME: {
         title: 'RESUME',
         iconClassName: 'fa fa-play',
-        disabled: (wf: Workflow) => !isWorkflowSuspended(wf),
+        disabled: (wf: Workflow) => !isWorkflowRunning(wf) || !isWorkflowSuspended(wf),
         action: (wf: Workflow) => services.workflows.resume(wf.metadata.name, wf.metadata.namespace, null)
     },
     STOP: {
```

**File**: `workflow/controller/operator.go` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@ func (woc *wfOperationCtx) operate(ctx context.Context) {
 		}
 	}
 
-	if woc.ShouldSuspend() {
+	if woc.ShouldSuspend() && !woc.GetShutdownStrategy().Enabled() {
 		woc.log.Info(ctx, "workflow suspended")
 		return
 	}
```

**File**: `workflow/controller/operator_test.go` (modified, +182/-0)
```diff
@@ -3001,6 +3001,188 @@ func TestSuspendResume(t *testing.T) {
 	assert.Len(t, pods.Items, 2)
 }
 
+func suspendedShutdownWorkflow() *wfv1.Workflow {
+	wf := wfv1.MustUnmarshalWorkflow(noPodsWhenShutdown)
+	wf.Spec.Shutdown = ""
+	wf.Spec.OnExit = "exit-handler"
+	wf.Spec.Templates = append(wf.Spec.Templates, wfv1.Template{
+		Name: "exit-handler",
+		Container: &apiv1.Container{
+			Image:   "docker/whalesay:latest",
+			Command: []string{"cowsay"},
+			Args:    []string{"goodbye world"},
+		},
+	})
+	return wf
+}
+
+func TestTerminateOnSuspendedWorkflow(t *testing.T) {
+	t.Run("StartedSuspended", func(t *testing.T) {
+		wf := suspendedShutdownWorkflow()
+		wf.Spec.Suspend = new(true)
+		cancel, controller := newController(logging.TestContext(t.Context()), wf)
+		defer cancel()
+
+		ctx := logging.TestContext(t.Context())
+		woc := newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+		assert.Empty(t, woc.wf.Status.Nodes)
+		pods, err := listPods(ctx, woc)
+		require.NoError(t, err)
+		assert.Empty(t, pods.Items)
+
+		wf = woc.wf.DeepCopy()
+		wf.Spec.Shutdown = wfv1.ShutdownStrategyTerminate
+		woc = newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+
+		node := woc.wf.Status.Nodes.FindByDisplayName("hello-world")
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		assert.Nil(t, woc.wf.Status.Nodes.FindByDisplayName("hello-world.onExit"), "terminate must not run the exit handler")
+		pods, err = listPods(ctx, woc)
+		require.NoError(t, err)
+		assert.Empty(t, pods.Items)
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "Stopped with strategy 'Terminate'", woc.wf.Status.Message)
+		persistedWf, err := controller.wfclientset.ArgoprojV1alpha1().Workflows(wf.Namespace).Get(ctx, wf.Name, metav1.GetOptions{})
+		require.NoError(t, err)
+		assert.True(t, *persistedWf.Spec.Suspend)
+	})
+
+	t.Run("SuspendedWhileRunning", func(t *testing.T) {
+		wf := suspendedShutdownWorkflow()
+		cancel, controller := newController(logging.TestContext(t.Context()), wf)
+		defer cancel()
+
+		ctx := logging.TestContext(t.Context())
+		woc := newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+		node := woc.wf.Status.Nodes.FindByDisplayName("hello-world")
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodePending, node.Phase)
+		makePodsPhase(ctx, woc, apiv1.PodPending)
+
+		wf = woc.wf.DeepCopy()
+		wf.Spec.Suspend = new(true)
+		woc = newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+
+		wf = woc.wf.DeepCopy()
+		wf.Spec.Shutdown = wfv1.ShutdownStrategyTerminate
+		woc = newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+
+		node = woc.wf.Status.Nodes.FindByDisplayName("hello-world")
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		assert.Nil(t, woc.wf.Status.Nodes.FindByDisplayName("hello-world.onExit"), "terminate must not run the exit handler")
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "Stopped with strategy 'Terminate'", woc.wf.Status.Message)
+		persistedWf, err := controller.wfclientset.ArgoprojV1alpha1().Workflows(wf.Namespace).Get(ctx, wf.Name, metav1.GetOptions{})
+		require.NoError(t, err)
+		assert.True(t, *persistedWf.Spec.Suspend)
+	})
+}
+
+func TestStopOnSuspendedWorkflow(t *testing.T) {
+	t.Run("StartedSuspended", func(t *testing.T) {
+		wf := suspendedShutdownWorkflow()
+		wf.Spec.Suspend = new(true)
+		cancel, controller := newController(logging.TestContext(t.Context()), wf)
+		defer cancel()
+
+		ctx := logging.TestContext(t.Context())
+		woc := newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+		assert.Empty(t, woc.wf.Status.Nodes)
+		pods, err := listPods(ctx, woc)
+		require.NoError(t, err)
+		assert.Empty(t, pods.Items)
+
+		wf = woc.wf.DeepCopy()
+		wf.Spec.Shutdown = wfv1.ShutdownStrategyStop
+		woc = newWorkflowOperationCtx(ctx, wf, controller)
+		woc.operate(ctx)
+
+		node := woc.wf.Status.Nodes.FindByDisplayName("hello-world")
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		onExitNode := woc.wf.Status.Nodes.FindByDisplayName("hello-world.onExit")
+		require.NotNil(t, onExitNode, "stop must run the exit handler")
+		assert.Equal(t, wfv1.NodePending, onExitNode.Phase)
+		pods, err = listPods(ctx, woc)
+		require.NoError(t, err)
+		assert.Len(t, pods.Items, 1)
+
+		makePodsPhase(ctx, woc, apiv1.PodSucceeded)
+		woc = newWorkflowOperationCtx(ctx, woc.wf, controller)
+		woc.operate(ctx)
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "
```

**File**: `workflow/controller/operator_workflow_template_ref_test.go` (modified, +59/-0)
```diff
@@ -491,6 +491,65 @@ func TestWorkflowTemplateRefWithShutdownAndSuspend(t *testing.T) {
 			assert.Contains(t, node.Message, "Stop")
 		}
 	})
+	t.Run("WorkflowTemplateRefWithSuspendWithShutdownTerminate", func(t *testing.T) {
+		wf := wfv1.MustUnmarshalWorkflow(wfWithTmplRef)
+		wf1 := wf.DeepCopy()
+		wf1.Spec.Suspend = new(true)
+		ctx := logging.TestContext(t.Context())
+		cancel, controller := newController(ctx, wf1, wfv1.MustUnmarshalWorkflowTemplate(wfTmpl))
+		defer cancel()
+
+		woc := newWorkflowOperationCtx(ctx, wf1, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+		assert.Empty(t, woc.wf.Status.Nodes)
+		require.NotNil(t, woc.wf.Status.StoredWorkflowSpec.Suspend)
+		assert.True(t, *woc.wf.Status.StoredWorkflowSpec.Suspend)
+
+		wf2 := woc.wf.DeepCopy()
+		wf2.Spec.Shutdown = wfv1.ShutdownStrategyTerminate
+		woc = newWorkflowOperationCtx(ctx, wf2, controller)
+		woc.operate(ctx)
+
+		node := woc.wf.Status.Nodes.FindByDisplayName(wf.Name)
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		assert.Contains(t, node.Message, "Terminate")
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "Stopped with strategy 'Terminate'", woc.wf.Status.Message)
+	})
+
+	t.Run("WorkflowTemplateRefWithSuspendWithShutdownStop", func(t *testing.T) {
+		wf := wfv1.MustUnmarshalWorkflow(wfWithTmplRef)
+		wf1 := wf.DeepCopy()
+		wf1.Spec.Suspend = new(true)
+		ctx := logging.TestContext(t.Context())
+		cancel, controller := newController(ctx, wf1, wfv1.MustUnmarshalWorkflowTemplate(wfTmpl))
+		defer cancel()
+
+		woc := newWorkflowOperationCtx(ctx, wf1, controller)
+		woc.operate(ctx)
+		assert.Equal(t, wfv1.WorkflowRunning, woc.wf.Status.Phase)
+		assert.Empty(t, woc.wf.Status.Nodes)
+		require.NotNil(t, woc.wf.Status.StoredWorkflowSpec.Suspend)
+		assert.True(t, *woc.wf.Status.StoredWorkflowSpec.Suspend)
+
+		wf2 := woc.wf.DeepCopy()
+		wf2.Spec.Shutdown = wfv1.ShutdownStrategyStop
+		woc = newWorkflowOperationCtx(ctx, wf2, controller)
+		woc.operate(ctx)
+
+		node := woc.wf.Status.Nodes.FindByDisplayName(wf.Name)
+		require.NotNil(t, node)
+		assert.Equal(t, wfv1.NodeFailed, node.Phase)
+		assert.Contains(t, node.Message, "workflow shutdown with strategy")
+		assert.Contains(t, node.Message, "Stop")
+
+		assert.Equal(t, wfv1.WorkflowFailed, woc.wf.Status.Phase)
+		assert.Equal(t, "Stopped with strategy 'Stop'", woc.wf.Status.Message)
+	})
 }
 
 var suspendwf = `apiVersion: argoproj.io/v1alpha1
```

---

### Incident Patch 5: `9c3b1f7a` (2026-09-28)
**Commit Message**: test(controller): move DAG fixtures into testdata (#17085)

Signed-off-by: Jeffery Lofoneh Asamani <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `workflow/controller/testdata/dag/artifact-resolution-when-skipped-dag.yaml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  generateName: conditional-artifact-passing-
+spec:
+  entrypoint: artifact-example
+  templates:
+  - name: artifact-example
+    dag:
+      tasks:
+      - name: generate-artifact
+        template: whalesay
+        when: "false"
+      - name: consume-artifact
+        dependencies: [generate-artifact]
+        template: print-message
+        when: "false"
+        arguments:
+          artifacts:
+          - name: message
+            from: "{{tasks.generate-artifact.outputs.artifacts.hello-art}}"
+      - name: sequence-param
+        template: print-message
+        dependencies: [generate-artifact]
+        when: "false"
+        arguments:
+          artifacts:
+          - name: message
+            from: "{{tasks.generate-artifact.outputs.artifacts.hello-art}}"
+        withSequence:
+          count: "5"
+
+  - name: whalesay
+    container:
+      image: docker/whalesay:latest
+      command: [sh, -c]
+      args: ["sleep 1; cowsay hello world | tee /tmp/hello_world.txt"]
+    outputs:
+      artifacts:
+      - name: hello-art
+        path: /tmp/hello_world.txt
+
+  - name: print-message
+    inputs:
+      artifacts:
+      - name: message
+        path: /tmp/message
+    container:
+      image: alpine:3.23
+      command: [sh, -c]
+      args: ["cat /tmp/message"]
+
```

**File**: `workflow/controller/testdata/dag/dag-assess-phase-continue-on-expanded-task-variables.yaml` (added, +255/-0)
```diff
@@ -0,0 +1,255 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: parameter-aggregation-one-will-fail2-jt776
+spec:
+
+  entrypoint: parameter-aggregation-one-will-fail2
+  templates:
+  -
+    dag:
+      tasks:
+      -
+        continueOn:
+          failed: true
+        name: generate
+        template: gen-number-list
+      - arguments:
+          parameters:
+          - name: num
+            value: '{{item}}'
+        continueOn:
+          failed: true
+        dependencies:
+        - generate
+        name: one-will-fail
+        template: one-will-fail
+        withParam: '{{tasks.generate.outputs.result}}'
+      -
+        continueOn:
+          failed: true
+        dependencies:
+        - one-will-fail
+        name: whalesay
+        template: whalesay
+    inputs: {}
+    metadata: {}
+    name: parameter-aggregation-one-will-fail2
+    outputs: {}
+  -
+    container:
+      args:
+      - |
+        if [ $(({{inputs.parameters.num}})) == 1 ]; then
+          exit 1;
+        else
+          echo {{inputs.parameters.num}}
+        fi
+      command:
+      - sh
+      - -xc
+      image: alpine:3.23
+      name: ""
+      resources: {}
+    inputs:
+      parameters:
+      - name: num
+    metadata: {}
+    name: one-will-fail
+    outputs: {}
+  -
+    container:
+      command:
+      - cowsay
+      image: docker/whalesay:latest
+      name: ""
+      resources: {}
+    inputs: {}
+    metadata: {}
+    name: whalesay
+    outputs: {}
+  -
+    inputs: {}
+    metadata: {}
+    name: gen-number-list
+    outputs: {}
+    script:
+      command:
+      - python
+      image: python:alpine3.23
+      name: ""
+      resources: {}
+      source: |
+        import json
+        import sys
+        json.dump([i for i in range(0, 2)], sys.stdout)
+status:
+  nodes:
+    parameter-aggregation-one-will-fail2-jt776:
+      children:
+      - parameter-aggregation-one-will-fail2-jt776-1457662774
+      displayName: parameter-aggregation-one-will-fail2-jt776
+      id: parameter-aggregation-one-will-fail2-jt776
+      name: parameter-aggregation-one-will-fail2-jt776
+      outboundNodes:
+      - parameter-aggregation-one-will-fail2-jt776-3936077093
+      phase: Running
+      startedAt: "2020-04-20T16:39:00Z"
+      templateName: parameter-aggregation-one-will-fail2
+      templateScope: local/parameter-aggregation-one-will-fail2-jt776
+      type: DAG
+    parameter-aggregation-one-will-fail2-jt776-6921149:
+      boundaryID: parameter-aggregation-one-will-fail2-jt776
+      children:
+      - parameter-aggregation-one-will-fail2-jt776-1842114754
+      - parameter-aggregation-one-will-fail2-jt776-4113411742
+      displayName: one-will-fail
+      finishedAt: "2020-04-20T16:39:09Z"
+      id: parameter-aggregation-one-will-fail2-jt776-6921149
+      name: parameter-aggregation-one-will-fail2-jt776.one-will-fail
+      phase: Failed
+      startedAt: "2020-04-20T16:39:03Z"
+      templateName: one-will-fail
+      templateScope: local/parameter-aggregation-one-will-fail2-jt776
+      type: TaskGroup
+    parameter-aggregation-one-will-fail2-jt776-1457662774:
+      boundaryID: parameter-aggregation-one-will-fail2-jt776
+      children:
+      - parameter-aggregation-one-will-fail2-jt776-6921149
+      displayName: generate
+      finishedAt: "2020-04-20T16:39:02Z"
+      id: parameter-aggregation-one-will-fail2-jt776-1457662774
+      name: parameter-aggregation-one-will-fail2-jt776.generate
+      outputs:
+        artifacts:
+        - archiveLogs: true
+          name: main-logs
+          s3:
+            accessKeySecret:
+              key: accesskey
+              name: my-minio-cred
+            bucket: my-bucket
+            endpoint: minio:9000
+            insecure: true
+            key: parameter-aggregation-one-will-fail2-jt776/parameter-aggregation-one-will-fail2-jt776-1457662774/main.log
+            secretKeySecret:
+              key: secretkey
+              name: my-minio-cred
+        exitCode: "0"
+        result: '[0, 1]'
+      phase: Succeeded
+      resourcesDuration:
+        cpu: 2
+        memory: 0
+      startedAt: "2020-04-20T16:39:00Z"
+      templateName: gen-number-list
+      templateScope: local/parameter-aggregation-one-will-fail2-jt776
+      type: Pod
+    parameter-aggregation-one-will-fail2-jt776-1842114754:
+      boundaryID: parameter-aggregation-one-will-fail2-jt776
+      children:
+      - parameter-aggregation-one-will-fail2-jt776-3936077093
+      displayName: one-will-fail(0:0)
+      finishedAt: "2020-04-20T16:39:06Z"
+      id: parameter-aggregation-one-will-fail2-jt776-1842114754
+      inputs:
+        parameters:
+        - name: num
+          value: "0"
+      name: parameter-aggregation-one-will-fail2-jt776.one-will-fail(0:0)
+      outputs:
+        artifacts:
+        - archiveLogs: true
+          name: main-logs
+          s3:
+            accessKeySecret:
+              key: accesskey
+              name: m
```

**File**: `workflow/controller/testdata/dag/dag-assess-phase-continue-on-expanded-task.yaml` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: parameter-aggregation-one-will-fail-69x7k
+spec:
+
+  entrypoint: parameter-aggregation-one-will-fail
+  templates:
+  -
+    dag:
+      tasks:
+      - arguments:
+          parameters:
+          - name: num
+            value: '{{item}}'
+        continueOn:
+          failed: true
+        name: one-will-fail
+        template: one-will-fail
+        withItems:
+        - 1
+        - 2
+      -
+        continueOn:
+          failed: true
+        dependencies:
+        - one-will-fail
+        name: whalesay
+        template: whalesay
+    inputs: {}
+    metadata: {}
+    name: parameter-aggregation-one-will-fail
+    outputs: {}
+  -
+    container:
+      args:
+      - |
+        if [ $(({{inputs.parameters.num}})) == 1 ]; then
+          exit 1;
+        else
+          echo {{inputs.parameters.num}}
+        fi
+      command:
+      - sh
+      - -xc
+      image: alpine:3.23
+      name: ""
+      resources: {}
+    inputs:
+      parameters:
+      - name: num
+    metadata: {}
+    name: one-will-fail
+    outputs: {}
+  -
+    container:
+      command:
+      - cowsay
+      image: docker/whalesay:latest
+      name: ""
+      resources: {}
+    inputs: {}
+    metadata: {}
+    name: whalesay
+    outputs: {}
+status:
+  nodes:
+    parameter-aggregation-one-will-fail-69x7k:
+      children:
+      - parameter-aggregation-one-will-fail-69x7k-4292161196
+      displayName: parameter-aggregation-one-will-fail-69x7k
+      id: parameter-aggregation-one-will-fail-69x7k
+      name: parameter-aggregation-one-will-fail-69x7k
+      outboundNodes:
+      - parameter-aggregation-one-will-fail-69x7k-3555414042
+      phase: Running
+      startedAt: "2020-04-20T16:47:22Z"
+      templateName: parameter-aggregation-one-will-fail
+      templateScope: local/parameter-aggregation-one-will-fail-69x7k
+      type: DAG
+    parameter-aggregation-one-will-fail-69x7k-1324058456:
+      boundaryID: parameter-aggregation-one-will-fail-69x7k
+      children:
+      - parameter-aggregation-one-will-fail-69x7k-3555414042
+      displayName: one-will-fail(0:1)
+      finishedAt: "2020-04-20T16:47:26Z"
+      id: parameter-aggregation-one-will-fail-69x7k-1324058456
+      inputs:
+        parameters:
+        - name: num
+          value: "1"
+      message: failed with exit code 1
+      name: parameter-aggregation-one-will-fail-69x7k.one-will-fail(0:1)
+      outputs:
+        artifacts:
+        - archiveLogs: true
+          name: main-logs
+          s3:
+            accessKeySecret:
+              key: accesskey
+              name: my-minio-cred
+            bucket: my-bucket
+            endpoint: minio:9000
+            insecure: true
+            key: parameter-aggregation-one-will-fail-69x7k/parameter-aggregation-one-will-fail-69x7k-1324058456/main.log
+            secretKeySecret:
+              key: secretkey
+              name: my-minio-cred
+        exitCode: "1"
+      phase: Failed
+      resourcesDuration:
+        cpu: 2
+        memory: 0
+      startedAt: "2020-04-20T16:47:22Z"
+      templateName: one-will-fail
+      templateScope: local/parameter-aggregation-one-will-fail-69x7k
+      type: Pod
+    parameter-aggregation-one-will-fail-69x7k-3086527730:
+      boundaryID: parameter-aggregation-one-will-fail-69x7k
+      children:
+      - parameter-aggregation-one-will-fail-69x7k-3555414042
+      displayName: one-will-fail(1:2)
+      finishedAt: "2020-04-20T16:47:28Z"
+      id: parameter-aggregation-one-will-fail-69x7k-3086527730
+      inputs:
+        parameters:
+        - name: num
+          value: "2"
+      name: parameter-aggregation-one-will-fail-69x7k.one-will-fail(1:2)
+      outputs:
+        artifacts:
+        - archiveLogs: true
+          name: main-logs
+          s3:
+            accessKeySecret:
+              key: accesskey
+              name: my-minio-cred
+            bucket: my-bucket
+            endpoint: minio:9000
+            insecure: true
+            key: parameter-aggregation-one-will-fail-69x7k/parameter-aggregation-one-will-fail-69x7k-3086527730/main.log
+            secretKeySecret:
+              key: secretkey
+              name: my-minio-cred
+        exitCode: "0"
+      phase: Succeeded
+      resourcesDuration:
+        cpu: 4
+        memory: 0
+      startedAt: "2020-04-20T16:47:22Z"
+      templateName: one-will-fail
+      templateScope: local/parameter-aggregation-one-will-fail-69x7k
+      type: Pod
+    parameter-aggregation-one-will-fail-69x7k-3555414042:
+      boundaryID: parameter-aggregation-one-will-fail-69x7k
+      displayName: whalesay
+      finishedAt: "2020-04-20T16:47:33Z"
+      id: parameter-aggregation-one-will-fail-69x7k-3555414042
+      name: parameter-aggregation-one-will-fail-69x7k.whalesay
+      outputs:
+        artifacts:
+        - archiveLogs: true
+          name: main-logs
+          s3:
+            accessKeySecret:
+ 
```

**File**: `workflow/controller/testdata/dag/dag-http-children-assigned.yaml` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: http-template-nv52d
+spec:
+  entrypoint: main
+  templates:
+  - dag:
+      tasks:
+      - arguments:
+          parameters:
+          - name: url
+            value: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
+        name: good1
+        template: http
+      - arguments:
+          parameters:
+          - name: url
+            value: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
+        dependencies:
+        - good1
+        name: good2
+        template: http
+    name: main
+  - http:
+      url: '{{inputs.parameters.url}}'
+    inputs:
+      parameters:
+      - name: url
+    name: http
+status:
+  nodes:
+    http-template-nv52d:
+      children:
+      - http-template-nv52d-444770636
+      displayName: http-template-nv52d
+      id: http-template-nv52d
+      name: http-template-nv52d
+      outboundNodes:
+      - http-template-nv52d-478325874
+      phase: Running
+      startedAt: "2021-10-27T13:46:08Z"
+      templateName: main
+      templateScope: local/http-template-nv52d
+      type: DAG
+    http-template-nv52d-444770636:
+      boundaryID: http-template-nv52d
+      children:
+      - http-template-nv52d-495103493
+      displayName: good1
+      finishedAt: null
+      id: http-template-nv52d-444770636
+      name: http-template-nv52d.good1
+      phase: Succeeded
+      startedAt: "2021-10-27T13:46:08Z"
+      templateName: http
+      templateScope: local/http-template-nv52d
+      type: HTTP
+  phase: Running
+  startedAt: "2021-10-27T13:46:08Z"
```

**File**: `workflow/controller/testdata/dag/dag-optional-input-artifacts.yaml` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: dag-optional-inputartifacts
+spec:
+  entrypoint: test
+  templates:
+  - name: condition
+    outputs:
+      artifacts:
+      - {name: A-out, from: '{{tasks.A.outputs.artifacts.A-out}}'}
+    dag:
+      tasks:
+      - {name: A, template: A}
+  - name: A
+    container:
+      args: ['mkdir -p /tmp/outputs/A && echo "exist" > /tmp/outputs/A/data']
+      command: [sh, -c]
+      image: alpine:3.23
+    outputs:
+      artifacts:
+      - {name: A-out, path: /tmp/outputs/A/data}
+  - name: B
+    container:
+      args: ['[ -f /tmp/outputs/condition/data ] && cat /tmp/outputs/condition/data || echo not exist']
+      command: [sh, -c]
+      image: alpine:3.23
+    inputs:
+      artifacts:
+      - {name: B-in, optional: true,  path: /tmp/outputs/condition/data}
+  - name: test
+    dag:
+      tasks:
+      - name: condition
+        template: condition
+        when: 'false'
+      - name: B
+        template: B
+        dependencies: [condition]
+        arguments:
+          artifacts:
+          - {name: B-in, optional: true, from: '{{tasks.condition.outputs.artifacts.A-out}}'}
+  arguments:
+    parameters: []
+status:
+  conditions:
+  - status: "True"
+    type: Completed
+  finishedAt: "2020-07-21T01:56:24Z"
+  nodes:
+    dag-optional-inputartifacts:
+      children:
+      - dag-optional-inputartifacts-3418089753
+      displayName: dag-optional-inputartifacts
+      finishedAt: "2020-07-21T01:56:24Z"
+      id: dag-optional-inputartifacts
+      name: dag-optional-inputartifacts
+      outboundNodes:
+      - dag-optional-inputartifacts-1920355018
+      phase: Running
+      startedAt: "2020-07-21T01:56:18Z"
+      templateName: test
+      templateScope: local/dag-optional-inputartifacts
+      type: DAG
+    dag-optional-inputartifacts-3418089753:
+      boundaryID: dag-optional-inputartifacts
+      children:
+      - dag-optional-inputartifacts-1920355018
+      displayName: condition
+      finishedAt: "2020-07-21T01:56:18Z"
+      id: dag-optional-inputartifacts-3418089753
+      message: when 'false' evaluated false
+      name: dag-optional-inputartifacts.condition
+      phase: Skipped
+      startedAt: "2020-07-21T01:56:18Z"
+      templateName: condition
+      templateScope: local/dag-optional-inputartifacts
+      type: Skipped
+  phase: Running
+  resourcesDuration:
+    cpu: 1
+    memory: 0
+  startedAt: "2020-07-21T01:56:18Z"
```

**File**: `workflow/controller/testdata/dag/dag-orphaned-task-group-completes.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: dag-orphaned-taskgroup
+  namespace: argo
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    dag:
+      tasks:
+      - name: fanout
+        template: echo
+        withItems: [a, b]
+      - name: leaf
+        template: echo
+        depends: fanout
+  - name: echo
+    container:
+      image: alpine:3.23
+      command: [sh, -c, "exit 0"]
```

**File**: `workflow/controller/testdata/dag/dag-outputs-refer-task-aggregated-ouputs.yaml` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: parameter-aggregation-dag-h8b82
+spec:
+
+  entrypoint: parameter-aggregation
+  templates:
+  -
+    dag:
+      tasks:
+      - arguments:
+          parameters:
+          - name: num
+            value: '{{item}}'
+        name: odd-or-even
+        template: odd-or-even
+        withItems:
+        - 1
+        - 2
+    inputs: {}
+    metadata: {}
+    name: parameter-aggregation
+    outputs:
+      parameters:
+      - name: dag-nums
+        valueFrom:
+          parameter: '{{tasks.odd-or-even.outputs.parameters.num}}'
+      - name: dag-evenness
+        valueFrom:
+          parameter: '{{tasks.odd-or-even.outputs.parameters.evenness}}'
+  -
+    container:
+      args:
+      - |
+        sleep 1 &&
+        echo {{inputs.parameters.num}} > /tmp/num &&
+        if [ $(({{inputs.parameters.num}}%2)) -eq 0 ]; then
+          echo "even" > /tmp/even;
+        else
+          echo "odd" > /tmp/even;
+        fi
+      command:
+      - sh
+      - -c
+      image: alpine:3.23
+      name: ""
+      resources: {}
+    inputs:
+      parameters:
+      - name: num
+    metadata: {}
+    name: odd-or-even
+    outputs:
+      parameters:
+      - name: num
+        valueFrom:
+          path: /tmp/num
+      - name: evenness
+        valueFrom:
+          path: /tmp/even
+status:
+  nodes:
+    parameter-aggregation-dag-h8b82:
+      children:
+      - parameter-aggregation-dag-h8b82-3379492521
+      displayName: parameter-aggregation-dag-h8b82
+      finishedAt: "2020-12-09T15:37:07Z"
+      id: parameter-aggregation-dag-h8b82
+      name: parameter-aggregation-dag-h8b82
+      outboundNodes:
+      - parameter-aggregation-dag-h8b82-3175470584
+      - parameter-aggregation-dag-h8b82-2243926302
+      phase: Running
+      startedAt: "2020-12-09T15:36:46Z"
+      templateName: parameter-aggregation
+      templateScope: local/parameter-aggregation-dag-h8b82
+      type: DAG
+    parameter-aggregation-dag-h8b82-1440345089:
+      boundaryID: parameter-aggregation-dag-h8b82
+      displayName: odd-or-even(1:2)
+      finishedAt: "2020-12-09T15:36:54Z"
+      hostNodeName: minikube
+      id: parameter-aggregation-dag-h8b82-1440345089
+      inputs:
+        parameters:
+        - name: num
+          value: "2"
+      name: parameter-aggregation-dag-h8b82.odd-or-even(1:2)
+      outputs:
+        exitCode: "0"
+        parameters:
+        - name: num
+          value: "2"
+          valueFrom:
+            path: /tmp/num
+        - name: evenness
+          value: even
+          valueFrom:
+            path: /tmp/even
+      phase: Succeeded
+      startedAt: "2020-12-09T15:36:46Z"
+      templateName: odd-or-even
+      templateScope: local/parameter-aggregation-dag-h8b82
+      type: Pod
+    parameter-aggregation-dag-h8b82-3379492521:
+      boundaryID: parameter-aggregation-dag-h8b82
+      children:
+      - parameter-aggregation-dag-h8b82-3572919299
+      - parameter-aggregation-dag-h8b82-1440345089
+      displayName: odd-or-even
+      finishedAt: "2020-12-09T15:36:55Z"
+      id: parameter-aggregation-dag-h8b82-3379492521
+      name: parameter-aggregation-dag-h8b82.odd-or-even
+      phase: Succeeded
+      startedAt: "2020-12-09T15:36:46Z"
+      templateName: odd-or-even
+      templateScope: local/parameter-aggregation-dag-h8b82
+      type: TaskGroup
+    parameter-aggregation-dag-h8b82-3572919299:
+      boundaryID: parameter-aggregation-dag-h8b82
+      displayName: odd-or-even(0:1)
+      finishedAt: "2020-12-09T15:36:53Z"
+      hostNodeName: minikube
+      id: parameter-aggregation-dag-h8b82-3572919299
+      inputs:
+        parameters:
+        - name: num
+          value: "1"
+      name: parameter-aggregation-dag-h8b82.odd-or-even(0:1)
+      outputs:
+        exitCode: "0"
+        parameters:
+        - name: num
+          value: "1"
+          valueFrom:
+            path: /tmp/num
+        - name: evenness
+          value: odd
+          valueFrom:
+            path: /tmp/even
+      phase: Succeeded
+      startedAt: "2020-12-09T15:36:46Z"
+      templateName: odd-or-even
+      templateScope: local/parameter-aggregation-dag-h8b82
+      type: Pod
+  phase: Succeeded
+  startedAt: "2020-12-09T15:36:46Z"
```

**File**: `workflow/controller/testdata/dag/dag-parallelism.yaml` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-parallelism
+  namespace: argo
+spec:
+  entrypoint: main
+  parallelism: 1
+  templates:
+    - name: main
+      dag:
+        tasks:
+          - name: do-it-once
+            template: do-it
+            arguments:
+              parameters:
+                - name: thing
+                  value: 1
+          - name: do-it-twice
+            template: do-it
+            arguments:
+              parameters:
+                - name: thing
+                  value: 2
+          - name: do-it-thrice
+            template: do-it
+            arguments:
+              parameters:
+                - name: thing
+                  value: 3
+    - name: do-it
+      inputs:
+        parameters:
+          - name: thing
+      container:
+        image: docker/whalesay:latest
+        command: [cowsay]
+        args: ["I have a {{inputs.parameters.thing}}"]
```

---

### Incident Patch 6: `31d00e57` (2026-09-28)
**Commit Message**: test(controller): move controller fixtures into testdata (#17081)

Signed-off-by: Hahhhy <[REDACTED_EMAIL]>

**File**: `workflow/controller/testdata/controller/from-expressing.yaml` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: from-expression
+spec:
+  entrypoint: main
+  arguments:
+    artifacts:
+    - name: foo
+      raw:
+        data: |
+          Hello
+  templates:
+    - name: main
+      inputs:
+        artifacts:
+        - name: foo
+      steps:
+      - - name: hello
+          inline:
+            container:
+              image: docker/whalesay:latest
+      outputs:
+        artifacts:
+        - name: result
+          fromExpression: "1 == 1 ? inputs.artifacts.foo : inputs.artifacts.foo"
```

**File**: `workflow/controller/testdata/controller/hello-daemon.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    daemon: true
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

**File**: `workflow/controller/testdata/controller/hello-world.yaml` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
\ No newline at end of file
```

**File**: `workflow/controller/testdata/controller/test-default-ttl.yaml` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  serviceAccountName: whalesay
+  ttlStrategy:
+    secondsAfterCompletion: 5
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

**File**: `workflow/controller/testdata/controller/test-default-volume-claim-template.yaml` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+  labels:
+    foo: bar
+spec:
+  volumeClaimTemplates:
+  - metadata:
+      name: workdir
+    spec:
+      accessModes:
+      - ReadWriteOnce
+      resources:
+        requests:
+          storage: 1Mi
+      storageClassName: local-path
+  entrypoint: whalesay
+  serviceAccountName: whalesay
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

**File**: `workflow/controller/testdata/controller/test-default.yaml` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+  labels:
+    foo: bar
+spec:
+  entrypoint: whalesay
+  serviceAccountName: whalesay
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

**File**: `workflow/controller/testdata/controller/workflow-with-semaphore.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+ name: hello-world
+ namespace: default
+ labels:
+   workflows.argoproj.io/completed: false
+spec:
+ entrypoint: whalesay
+ synchronization:
+   semaphores:
+     - configMapKeyRef:
+         name: my-config
+         key: workflow
+ templates:
+ - name: whalesay
+   container:
+     image: docker/whalesay:latest
+     command: [cowsay]
+     args: ["hello world"]
```

---

### Incident Patch 7: `81b57fd4` (2026-09-28)
**Commit Message**: test(ui): cover logs and live updates in the Playwright suite (#16907)

Signed-off-by: Alan Clucas <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `ui/e2e/README.md` (modified, +5/-3)
```diff
@@ -57,9 +57,11 @@ and point the tests at it with `ARGO_UI_BASE_URL`.
   token with `ARGO_TOKEN`, or point at a different UI with `ARGO_UI_BASE_URL`.
 - **Backend state** (`e2e/fixtures/api.ts`): tests seed workflows over the REST
   API and wait for a terminal phase *before* asserting on the rendered page, so
-  rendering never races the controller. Created workflows are cleaned up on
-  teardown; workflows the *browser* creates (submit, resubmit) are handed to
-  `api.track()` so they are cleaned up too.
+  rendering never races the controller. The one exception is
+  `workflow-live-update.spec.ts`, which watches a workflow run to completion in
+  the browser on purpose, to cover the server-sent-events watch. Created
+  workflows are cleaned up on teardown; workflows the *browser* creates (submit,
+  resubmit) are handed to `api.track()` so they are cleaned up too.
 - **Page objects** (`e2e/pages/`) centralise selectors. Prefer role/text/href
   locators; add a `data-testid` only when nothing stable exists.
 
```

**File**: `ui/e2e/fixtures/test.ts` (modified, +5/-0)
```diff
@@ -4,6 +4,7 @@ import {ConfirmDialog} from '../pages/confirm-dialog';
 import {LoginPage} from '../pages/login-page';
 import {WorkflowDetailsPage} from '../pages/workflow-details-page';
 import {WorkflowListPage} from '../pages/workflow-list-page';
+import {WorkflowLogsPanel} from '../pages/workflow-logs-panel';
 import {ApiClient} from './api';
 
 interface Fixtures {
@@ -12,6 +13,7 @@ interface Fixtures {
     loginPage: LoginPage;
     workflowDetailsPage: WorkflowDetailsPage;
     workflowListPage: WorkflowListPage;
+    workflowLogsPanel: WorkflowLogsPanel;
 }
 
 export const test = base.extend<Fixtures>({
@@ -43,6 +45,9 @@ export const test = base.extend<Fixtures>({
     },
     workflowListPage: async ({page}, use) => {
         await use(new WorkflowListPage(page));
+    },
+    workflowLogsPanel: async ({page}, use) => {
+        await use(new WorkflowLogsPanel(page));
     }
 });
 
```

**File**: `ui/e2e/pages/workflow-logs-panel.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import {Locator, Page} from '@playwright/test';
+
+// Page object for the Logs side panel (ui/src/workflows/components/workflow-logs-viewer),
+// opened from the details page toolbar.
+export class WorkflowLogsPanel {
+    readonly container: Locator;
+    readonly heading: Locator;
+    readonly viewer: Locator;
+
+    constructor(page: Page) {
+        this.container = page.locator('.workflow-logs-viewer');
+        this.heading = this.container.getByRole('heading', {name: 'Logs'});
+        // argo-ui's LogsViewer, mounted once the first log entry (or end of
+        // stream) replaces the "Waiting for data..." placeholder.
+        this.viewer = this.container.locator('.logs-viewer');
+    }
+
+    /**
+     * The text currently shown in the log terminal, one line per row.
+     *
+     * argo-ui's LogsViewer renders through xterm, which paints to a canvas, so
+     * the text is not in the DOM for a locator to read. It is in xterm's line
+     * buffer, and LogsViewer keeps its Terminal on the component instance, which
+     * React exposes from the root element through the fiber tree. This reads
+     * what a user would get by selecting all and copying, and is polled because
+     * xterm writes asynchronously.
+     */
+    async text(): Promise<string> {
+        return this.viewer.evaluate(el => {
+            const fiberKey = Object.keys(el).find(key => key.startsWith('__reactFiber$'));
+            let fiber = fiberKey ? (el as any)[fiberKey] : undefined;
+            while (fiber && !fiber.stateNode?.terminal) {
+                fiber = fiber.return;
+            }
+            if (!fiber) {
+                throw new Error('no LogsViewer component (with a terminal) above .logs-viewer');
+            }
+            const buffer = fiber.stateNode.terminal.buffer.active;
+            const lines: string[] = [];
+            for (let y = 0; y < buffer.length; y++) {
+                lines.push(buffer.getLine(y)?.translateToString(true) ?? '');
+            }
+            return lines.join('\n').trimEnd();
+        });
+    }
+}
```

**File**: `ui/e2e/tests/workflow-live-update.spec.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import {ENV_FACTOR} from '../fixtures/auth';
+import {expect, test} from '../fixtures/test';
+import {sleepWorkflow} from '../fixtures/workflows';
+
+// The only test that watches a phase transition in the browser: it covers the
+// server-sent-events watch (api/v1/workflow-events) that keeps the details page
+// current, which nothing else exercises — the other tests seed workflows in a
+// terminal phase first.
+test('details page follows a running workflow to completion without reloading', async ({api, page, workflowDetailsPage}) => {
+    // Long enough that the page reliably catches Running before the pod exits;
+    // short enough that Succeeded arrives well inside the per-test timeout.
+    const name = await api.submitWorkflow(sleepWorkflow(20, 'e2e-live-'));
+
+    await workflowDetailsPage.goto(name);
+    await workflowDetailsPage.openTab('Summary');
+    const status = workflowDetailsPage.summaryAttribute('Status');
+    await expect(status).toContainText('Running', {timeout: 30_000 * ENV_FACTOR});
+
+    // Mark this document so a reload — which would produce a fresh window
+    // without the mark — can be told apart from a live update.
+    await page.evaluate(() => {
+        (window as any).__e2eSameDocument = true;
+    });
+
+    await expect(status).toContainText('Succeeded', {timeout: 45_000 * ENV_FACTOR});
+    expect(await page.evaluate(() => (window as any).__e2eSameDocument)).toBe(true);
+});
```

**File**: `ui/e2e/tests/workflow-logs.spec.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import {ENV_FACTOR} from '../fixtures/auth';
+import {expect, test} from '../fixtures/test';
+import {echoWorkflow} from '../fixtures/workflows';
+
+test('shows the container logs of a completed workflow', async ({api, workflowDetailsPage, workflowLogsPanel}) => {
+    const message = 'hello from the logs test';
+    const name = await api.submitWorkflow(echoWorkflow(message, 'e2e-logs-'));
+    await api.waitForPhase(name, 'Succeeded');
+
+    await workflowDetailsPage.goto(name);
+    await workflowDetailsPage.operation('Logs').click();
+    await expect(workflowLogsPanel.heading).toBeVisible();
+
+    // The panel opens on "All" pods, so each line is prefixed with its pod name;
+    // a single-step workflow's only pod is named after the workflow. The stream
+    // is served over SSE from the (completed, not garbage-collected) pod.
+    await expect.poll(() => workflowLogsPanel.text(), {timeout: 30_000 * ENV_FACTOR}).toContain(`${name}: ${message}`);
+});
```

---

### Incident Patch 8: `dc610f09` (2026-09-25)
**Commit Message**: test(controller): move template scope fixtures into testdata (#17066)

Signed-off-by: Jeffery Lofoneh Asamani <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>
Co-authored-by: Alan Clucas <[REDACTED_EMAIL]>

**File**: `workflow/controller/operator_template_scope_test.go` (modified, +12/-257)
```diff
@@ -11,71 +11,10 @@ import (
 	"github.com/argoproj/argo-workflows/v4/util/logging"
 )
 
-var testTemplateScopeWorkflowYaml = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: test-template-scope
-  namespace: default
-spec:
-  entrypoint: entry
-  templates:
-  - name: entry
-    steps:
-      - - name: step
-          templateRef:
-            name: test-template-scope-1
-            template: steps
-`
-
-var testTemplateScopeWorkflowTemplateYaml1 = `
-apiVersion: argoproj.io/v1alpha1
-kind: WorkflowTemplate
-metadata:
-  name: test-template-scope-1
-  namespace: default
-spec:
-  templates:
-  - name: steps
-    steps:
-    - - name: hello
-        template: hello
-      - name: other-wftmpl
-        templateRef:
-          name: test-template-scope-2
-          template: steps
-  - name: hello
-    script:
-      image: python:alpine3.23
-      command: [python]
-      source: |
-        print("hello world")
-`
-
-var testTemplateScopeWorkflowTemplateYaml2 = `
-apiVersion: argoproj.io/v1alpha1
-kind: WorkflowTemplate
-metadata:
-  name: test-template-scope-2
-  namespace: default
-spec:
-  templates:
-  - name: steps
-    steps:
-    - - name: hello
-        template: hello
-  - name: hello
-    script:
-      image: python:alpine3.23
-      command: [python]
-      source: |
-        print("hello world")
-`
-
 func TestTemplateScope(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(testTemplateScopeWorkflowYaml)
-	wftmpl1 := wfv1.MustUnmarshalWorkflowTemplate(testTemplateScopeWorkflowTemplateYaml1)
-	wftmpl2 := wfv1.MustUnmarshalWorkflowTemplate(testTemplateScopeWorkflowTemplateYaml2)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/operator_template_scope/workflow.yaml")
+	wftmpl1 := wfv1.MustUnmarshalWorkflowTemplate("@testdata/operator_template_scope/workflow-template-1.yaml")
+	wftmpl2 := wfv1.MustUnmarshalWorkflowTemplate("@testdata/operator_template_scope/workflow-template-2.yaml")
 
 	cancel, controller := newController(logging.TestContext(t.Context()), wf, wftmpl1, wftmpl2)
 	defer cancel()
@@ -117,53 +56,9 @@ func TestTemplateScope(t *testing.T) {
 	assert.Equal(t, "namespaced/test-template-scope-2", node.TemplateScope)
 }
 
-var testTemplateScopeWithParamWorkflowYaml = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: test-template-scope-with-param
-  namespace: default
-spec:
-  entrypoint: main
-  templates:
-    - name: main
-      steps:
-        - - name: step
-            templateRef:
-              name: test-template-scope-with-param-1
-              template: main
-`
-
-var testTemplateScopeWithParamWorkflowTemplateYaml1 = `
-apiVersion: argoproj.io/v1alpha1
-kind: WorkflowTemplate
-metadata:
-  name: test-template-scope-with-param-1
-  namespace: default
-spec:
-  templates:
-    - name: main
-      steps:
-        - - name: print-string
-            template: print-string
-            arguments:
-              parameters:
-               - name: letter
-                 value: '{{item}}'
-            withParam: '["x", "y", "z"]'
-    - name: print-string
-      inputs:
-        parameters:
-         - name: letter
-      container:
-        image: alpine:3.23
-        command: [sh, -c]
-        args: ["echo {{inputs.parameters.letter}}"]
-`
-
 func TestTemplateScopeWithParam(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(testTemplateScopeWithParamWorkflowYaml)
-	wftmpl := wfv1.MustUnmarshalWorkflowTemplate(testTemplateScopeWithParamWorkflowTemplateYaml1)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/operator_template_scope/with-param-workflow.yaml")
+	wftmpl := wfv1.MustUnmarshalWorkflowTemplate("@testdata/operator_template_scope/with-param-workflow-template-1.yaml")
 
 	cancel, controller := newController(logging.TestContext(t.Context()), wf, wftmpl)
 	defer cancel()
@@ -202,57 +97,9 @@ func TestTemplateScopeWithParam(t *testing.T) {
 	assert.Equal(t, "namespaced/test-template-scope-with-param-1", node.TemplateScope)
 }
 
-var testTemplateScopeNestedStepsWithParamsWorkflowYaml = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: test-template-scope-nested-steps-with-params
-  namespace: default
-spec:
-  entrypoint: main
-  templates:
-    - name: main
-      steps:
-        - - name: step
-            templateRef:
-              name: test-template-scope-nested-steps-with-params-1
-              template: main
-`
-
-var testTemplateScopeNestedStepsWithParamsWorkflowTemplateYaml1 = `
-apiVersion: argoproj.io/v1alpha1
-kind: WorkflowTemplate
-metadata:
-  name: test-template-scope-nested-steps-with-params-1
-  namespace: default
-spec:
-  templates:
-    - name: main
-      steps:
-        - - name: main
-            template: sub
-    - name: sub
-      steps:
-        - - name: print-string
-            template: print-string
-            arguments:
-              parameters:
-               - name: letter
-                 value: '{{item}}'
-            withParam: '["x", "y", "z"]'
-    - name: print-string
-    
```

**File**: `workflow/controller/testdata/operator_template_scope/cluster-scope-workflow-template-1.yaml` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+apiVersion: argoproj.io/v1alpha1
+kind: ClusterWorkflowTemplate
+metadata:
+  name: test-template-scope-1
+spec:
+  templates:
+  - name: steps
+    steps:
+    - - name: hello
+        template: hello
+      - name: other-wftmpl
+        templateRef:
+          name: test-template-scope-2
+          template: steps
+  - name: hello
+    script:
+      image: python:alpine3.23
+      command: [python]
+      source: |
+        print("hello world")
```

**File**: `workflow/controller/testdata/operator_template_scope/cluster-scope-workflow.yaml` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-template-scope
+  namespace: default
+spec:
+  entrypoint: entry
+  templates:
+  - name: entry
+    steps:
+      - - name: step
+          templateRef:
+            name: test-template-scope-1
+            template: steps
+            clusterScope: true
```

**File**: `workflow/controller/testdata/operator_template_scope/dag-workflow-template-1.yaml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+apiVersion: argoproj.io/v1alpha1
+kind: WorkflowTemplate
+metadata:
+  name: test-template-scope-dag-1
+  namespace: default
+spec:
+  templates:
+    - name: main
+      dag:
+        tasks:
+        - name: A
+          template: print-string
+          arguments:
+            parameters:
+            - name: letter
+              value: 'A'
+        - name: B
+          template: print-string
+          arguments:
+            parameters:
+            - name: letter
+              value: '{{item}}'
+          withParam: '["x", "y", "z"]'
+    - name: print-string
+      inputs:
+        parameters:
+         - name: letter
+      container:
+        image: alpine:3.23
+        command: [sh, -c]
+        args: ["echo {{inputs.parameters.letter}}"]
```

**File**: `workflow/controller/testdata/operator_template_scope/dag-workflow.yaml` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-template-scope-dag
+  namespace: default
+spec:
+  entrypoint: main
+  templates:
+    - name: main
+      steps:
+        - - name: step
+            templateRef:
+              name: test-template-scope-dag-1
+              template: main
```

**File**: `workflow/controller/testdata/operator_template_scope/nested-steps-with-params-workflow-template-1.yaml` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+apiVersion: argoproj.io/v1alpha1
+kind: WorkflowTemplate
+metadata:
+  name: test-template-scope-nested-steps-with-params-1
+  namespace: default
+spec:
+  templates:
+    - name: main
+      steps:
+        - - name: main
+            template: sub
+    - name: sub
+      steps:
+        - - name: print-string
+            template: print-string
+            arguments:
+              parameters:
+               - name: letter
+                 value: '{{item}}'
+            withParam: '["x", "y", "z"]'
+    - name: print-string
+      inputs:
+        parameters:
+         - name: letter
+      container:
+        image: alpine:3.23
+        command: [sh, -c]
+        args: ["echo {{inputs.parameters.letter}}"]
```

**File**: `workflow/controller/testdata/operator_template_scope/nested-steps-with-params-workflow.yaml` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-template-scope-nested-steps-with-params
+  namespace: default
+spec:
+  entrypoint: main
+  templates:
+    - name: main
+      steps:
+        - - name: step
+            templateRef:
+              name: test-template-scope-nested-steps-with-params-1
+              template: main
```

**File**: `workflow/controller/testdata/operator_template_scope/with-param-workflow-template-1.yaml` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+apiVersion: argoproj.io/v1alpha1
+kind: WorkflowTemplate
+metadata:
+  name: test-template-scope-with-param-1
+  namespace: default
+spec:
+  templates:
+    - name: main
+      steps:
+        - - name: print-string
+            template: print-string
+            arguments:
+              parameters:
+               - name: letter
+                 value: '{{item}}'
+            withParam: '["x", "y", "z"]'
+    - name: print-string
+      inputs:
+        parameters:
+         - name: letter
+      container:
+        image: alpine:3.23
+        command: [sh, -c]
+        args: ["echo {{inputs.parameters.letter}}"]
```

---

### Incident Patch 9: `18149c92` (2026-09-25)
**Commit Message**: fix: run the quick-start artifact repository on pgsty/silo. Fixes #17030 (#17073)

Signed-off-by: Alan Clucas <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `manifests/quick-start-minimal.yaml` (modified, +4/-4)
```diff
@@ -192930,17 +192930,17 @@ spec:
       automountServiceAccountToken: false
       containers:
       - command:
-        - minio
+        - silo
         - server
         - --console-address
         - :9001
         - /data
         env:
-        - name: MINIO_ACCESS_KEY
+        - name: MINIO_ROOT_USER
           value: admin
-        - name: MINIO_SECRET_KEY
+        - name: MINIO_ROOT_PASSWORD
           value: password
-        image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+        image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
         lifecycle:
           postStart:
             exec:
```

**File**: `manifests/quick-start-mysql.yaml` (modified, +4/-4)
```diff
@@ -192996,17 +192996,17 @@ spec:
       automountServiceAccountToken: false
       containers:
       - command:
-        - minio
+        - silo
         - server
         - --console-address
         - :9001
         - /data
         env:
-        - name: MINIO_ACCESS_KEY
+        - name: MINIO_ROOT_USER
           value: admin
-        - name: MINIO_SECRET_KEY
+        - name: MINIO_ROOT_PASSWORD
           value: password
-        image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+        image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
         lifecycle:
           postStart:
             exec:
```

**File**: `manifests/quick-start-postgres.yaml` (modified, +4/-4)
```diff
@@ -192995,17 +192995,17 @@ spec:
       automountServiceAccountToken: false
       containers:
       - command:
-        - minio
+        - silo
         - server
         - --console-address
         - :9001
         - /data
         env:
-        - name: MINIO_ACCESS_KEY
+        - name: MINIO_ROOT_USER
           value: admin
-        - name: MINIO_SECRET_KEY
+        - name: MINIO_ROOT_PASSWORD
           value: password
-        image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+        image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
         lifecycle:
           postStart:
             exec:
```

**File**: `manifests/quick-start-telemetry.yaml` (modified, +4/-4)
```diff
@@ -193120,17 +193120,17 @@ spec:
       automountServiceAccountToken: false
       containers:
       - command:
-        - minio
+        - silo
         - server
         - --console-address
         - :9001
         - /data
         env:
-        - name: MINIO_ACCESS_KEY
+        - name: MINIO_ROOT_USER
           value: admin
-        - name: MINIO_SECRET_KEY
+        - name: MINIO_ROOT_PASSWORD
           value: password
-        image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+        image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
         lifecycle:
           postStart:
             exec:
```

**File**: `manifests/quick-start/base/minio/minio-deploy.yaml` (modified, +6/-4)
```diff
@@ -16,18 +16,20 @@ spec:
       automountServiceAccountToken: false
       containers:
         - name: main
-          image: quay.io/minio/minio:RELEASE.2022-11-17T23-20-09Z@sha256:b2a98df34c3e8d605a5e96f0bc1657dd440a5bd53d95465a7b342e736da9c6cf
+          # Silo is a maintained fork of the MinIO server (MinIO stopped publishing
+          # community images); it keeps the S3 API, MINIO_* settings and data format.
+          image: docker.io/pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46
           env:
-            - name: MINIO_ACCESS_KEY
+            - name: MINIO_ROOT_USER
               value: admin
-            - name: MINIO_SECRET_KEY
+            - name: MINIO_ROOT_PASSWORD
               value: password
           ports:
             - containerPort: 9000
               name: api
             - containerPort: 9001
               name: dashboard
-          command: [minio, server, --console-address, ":9001", /data]
+          command: [silo, server, --console-address, ":9001", /data]
           lifecycle:
             postStart:
               exec:
```

---

### Incident Patch 10: `88a99597` (2026-09-24)
**Commit Message**: test(controller): move workflow pod fixtures into testdata (#17067)

Signed-off-by: Jeffery Lofoneh Asamani <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `workflow/controller/testdata/workflowpod/container-args-offloading.yaml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-large-args
+  namespace: default
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    container:
+      image: alpine:latest
+      command: ["/bin/sh"]
```

**File**: `workflow/controller/testdata/workflowpod/hello-windows-wf.yaml` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-hybrid-win
+spec:
+  entrypoint: hello-win
+  templates:
+    - name: hello-win
+      nodeSelector:
+        kubernetes.io/os: windows
+      container:
+        image: mcr.microsoft.com/windows/nanoserver:1809
+        command: ["cmd", "/c"]
+        args: ["echo", "Hello from Windows Container!"]
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-step-wf-with-patch.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: hello
+  templates:
+  - name: hello
+    steps:
+    - - name: hello
+        template: whalesay
+  - name: whalesay
+    podSpecPatch: '{"containers":[{"name":"main", "resources":{"limits":{"cpu": "800m"}}}]}'
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
+    outputs:
+      parameters:
+      - name: pod-name
+        value: "{{pod.name}}"
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-wf-with-env-refer-secret.yaml` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    metadata:
+      annotations:
+        annotationKey1: "annotationValue1"
+        annotationKey2: "annotationValue2"
+      labels:
+        labelKey1: "labelValue1"
+        labelKey2: "labelValue2"
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
+      env:
+      - name: ENV3
+        valueFrom:
+          secretKeyRef:
+            name: mysecret
+            key: sec
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-wf-with-invalid-patch-format.yaml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    podSpecPatch: '{"containers"}' # not a valid JSON here
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-wf-with-patch.yaml` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  templates:
+  - name: whalesay
+    podSpecPatch: '{"containers":[{"name":"main", "resources":{"limits":{"cpu": "800m"}}}]}'
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
+    outputs:
+      parameters:
+      - name: pod-name
+        value: "{{pod.name}}"
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-wf-with-tmpl-and-wf-patch.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  podSpecPatch: |
+    containers:
+      - name: main
+        securityContext:
+          runAsNonRoot: true
+          capabilities:
+            drop:
+              - ALL
+  templates:
+  - name: whalesay
+    podSpecPatch: '{"containers":[{"name":"main", "securityContext":{"capabilities":{"add":["ALL"],"drop":null}}}]}'
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

**File**: `workflow/controller/testdata/workflowpod/hello-world-wf-with-wf-patch.yaml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world
+spec:
+  entrypoint: whalesay
+  podSpecPatch: '{"containers":[{"name":"main", "resources":{"limits":{"cpu": "800m"}}}]}'
+  templates:
+  - name: whalesay
+    container:
+      image: docker/whalesay:latest
+      command: [cowsay]
+      args: ["hello world"]
```

---

### Incident Patch 11: `096976e6` (2026-09-24)
**Commit Message**: fix: resolve node ID collisions made by a memoized resubmit (#17028)

Signed-off-by: Alan Clucas <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `workflow/util/node_id_collision_test.go` (modified, +67/-0)
```diff
@@ -1,6 +1,7 @@
 package util
 
 import (
+	"strings"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -105,3 +106,69 @@ func TestFormulateRetryWorkflowWithCollision(t *testing.T) {
 		assert.Contains(t, []string{newWf.NodeID(n.Name), newWf.NodeID64(n.Name)}, n.ID)
 	}
 }
+
+// Two sibling node names of a withItems fan-out that collide under NodeID
+// once the workflow is called custom-job-abcde. Renaming a workflow rehashes
+// every node name, so a resubmit can create a collision that the original
+// workflow did not have; these were found by searching for one.
+const (
+	renamedWfName     = "custom-job-abcde"
+	collidingFanoutA  = "[0].fanout(26094:item26094)"
+	collidingFanoutB  = "[0].fanout(35221:item35221)"
+	uncollidingWfName = "custom-job-thbh7"
+)
+
+func TestNewNodeIDsWidensACollisionMadeByTheRename(t *testing.T) {
+	wf := &wfv1.Workflow{}
+	wf.Name = uncollidingWfName
+	wf.Status.Nodes = wfv1.Nodes{}
+	for _, suffix := range []string{"", collidingFanoutA, collidingFanoutB} {
+		name := wf.Name + suffix
+		wf.Status.Nodes[wf.NodeID(name)] = wfv1.NodeStatus{Name: name, ID: wf.NodeID(name)}
+	}
+	require.Len(t, wf.Status.Nodes, 3, "the names must not collide under the old workflow name")
+
+	newWf := &wfv1.Workflow{}
+	newWf.Name = renamedWfName
+	nameA, nameB := newWf.Name+collidingFanoutA, newWf.Name+collidingFanoutB
+	require.Equal(t, newWf.NodeID(nameA), newWf.NodeID(nameB), "the names must collide under the new workflow name")
+
+	rename := func(name string) string { return newWf.Name + strings.TrimPrefix(name, wf.Name) }
+	newIDs, err := newNodeIDs(wf, newWf, rename)
+	require.NoError(t, err)
+
+	// the first name in name order keeps the 32-bit slot, the loser is widened
+	assert.Equal(t, newWf.NodeID(nameA), newIDs[wf.NodeID(wf.Name+collidingFanoutA)])
+	assert.Equal(t, newWf.NodeID64(nameB), newIDs[wf.NodeID(wf.Name+collidingFanoutB)])
+
+	// which is where the resubmitted workflow can find them again
+	newWf.Status.Nodes = wfv1.Nodes{}
+	for oldID, newID := range newIDs {
+		newWf.Status.Nodes[newID] = wfv1.NodeStatus{Name: rename(wf.Status.Nodes[oldID].Name), ID: newID}
+	}
+	assert.Len(t, newWf.Status.Nodes, len(wf.Status.Nodes), "no node may be lost to a collision")
+	for _, name := range []string{newWf.Name, nameA, nameB} {
+		node, err := newWf.GetNodeByName(name)
+		require.NoError(t, err)
+		assert.Equal(t, name, node.Name)
+	}
+}
+
+func TestNewNodeIDsKeepsDeletedNodesOutOfTheWay(t *testing.T) {
+	wf := collidingWorkflow(t, wfv1.NodeFailed)
+	newWf := &wfv1.Workflow{}
+	newWf.Name = renamedWfName
+	rename := func(name string) string { return newWf.Name + strings.TrimPrefix(name, wf.Name) }
+
+	newIDs, err := newNodeIDs(wf, newWf, rename)
+	require.NoError(t, err)
+
+	// every node is mapped, including ones a reset plan goes on to delete, and
+	// no two share an ID, so a dangling reference cannot alias a kept node
+	assert.Len(t, newIDs, len(wf.Status.Nodes))
+	seen := map[string]bool{}
+	for _, id := range newIDs {
+		assert.False(t, seen[id], "IDs must be unique")
+		seen[id] = true
+	}
+}
```

**File**: `workflow/util/util.go` (modified, +47/-7)
```diff
@@ -859,8 +859,15 @@ func FormulateResubmitWorkflow(ctx context.Context, wf *wfv1.Workflow, memoized
 	// reference has to be rewritten.
 	replaceRegexp := regexp.MustCompile("^" + regexp.QuoteMeta(wf.Name))
 	now := metav1.Time{Time: time.Now().UTC()}
+	rename := func(name string) string {
+		return replaceRegexp.ReplaceAllString(name, newWF.Name)
+	}
+	newIDs, err := newNodeIDs(wf, &newWF, rename)
+	if err != nil {
+		return nil, err
+	}
 	memoize := func(node wfv1.NodeStatus) wfv1.NodeStatus {
-		node.Name = replaceRegexp.ReplaceAllString(node.Name, newWF.Name)
+		node.Name = rename(node.Name)
 		node.StartedAt = now
 		node.FinishedAt = now
 		if node.Type == wfv1.NodeTypePod {
@@ -880,8 +887,10 @@ func FormulateResubmitWorkflow(ctx context.Context, wf *wfv1.Workflow, memoized
 		}
 		return node
 	}
+	// A reference to a node that is not in the status at all maps to no ID,
+	// and applyResetPlan drops it.
 	mapID := func(id string) string {
-		return convertNodeID(&newWF, replaceRegexp, id, wf.Status.Nodes)
+		return newIDs[id]
 	}
 	applyResetPlan(ctx, wf, &newWF, plan, memoize, mapID)
 
@@ -919,11 +928,42 @@ func keepExistingNodeIDs(nodes wfv1.Nodes, ids []string) []string {
 	return kept
 }
 
-// convertNodeID converts an old nodeID to a new nodeID
-func convertNodeID(newWf *wfv1.Workflow, regex *regexp.Regexp, oldNodeID string, oldNodes map[string]wfv1.NodeStatus) string {
-	node := oldNodes[oldNodeID]
-	newNodeName := regex.ReplaceAllString(node.Name, newWf.Name)
-	return newWf.NodeID(newNodeName)
+// newNodeIDs works out the ID each node of wf takes under the name of newWf.
+// A node ID is a hash of the node name, which starts with the workflow name,
+// so renaming the workflow rehashes the whole graph: names that collided
+// before may not any more, and names that did not may now. Nodes are assigned
+// in name order, so the result does not depend on map iteration order, and a
+// name that finds its 32-bit slot taken gets the widened one instead, which is
+// where Workflow.ResolveNode looks for it.
+//
+// Nodes the reset plan deletes are given an ID too, so that a reference to one
+// cannot land on the ID of a node that is kept and so survive the pruning
+// applyResetPlan does.
+func newNodeIDs(wf, newWf *wfv1.Workflow, rename func(name string) string) (map[string]string, error) {
+	oldIDs := make([]string, 0, len(wf.Status.Nodes))
+	for id := range wf.Status.Nodes {
+		oldIDs = append(oldIDs, id)
+	}
+	slices.SortFunc(oldIDs, func(a, b string) int {
+		return strings.Compare(wf.Status.Nodes[a].Name, wf.Status.Nodes[b].Name)
+	})
+	newIDs := make(map[string]string, len(oldIDs))
+	taken := make(map[string]bool, len(oldIDs))
+	for _, oldID := range oldIDs {
+		name := rename(wf.Status.Nodes[oldID].Name)
+		newID := newWf.NodeID(name)
+		if taken[newID] {
+			// the 32-bit slot has gone to another name: widen, as the
+			// controller does when it creates a node
+			newID = newWf.NodeID64(name)
+			if taken[newID] {
+				return nil, errors.Errorf(errors.CodeBadRequest, "cannot resubmit %s as %s: node %s collides with another node at both ID widths", wf.Name, newWf.Name, name)
+			}
+		}
+		taken[newID] = true
+		newIDs[oldID] = newID
+	}
+	return newIDs, nil
 }
 
 func isDescendantNodeSucceeded(ctx context.Context, wf *wfv1.Workflow, node wfv1.NodeStatus, nodeIDsToReset map[string]bool) bool {
```

---

### Incident Patch 12: `084009d5` (2026-09-23)
**Commit Message**: test(controller): move hook fixtures into testdata (#17061)

Signed-off-by: Jeffery Lofoneh Asamani <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `workflow/controller/hooks_test.go` (modified, +14/-1050)
```diff
@@ -15,128 +15,7 @@ import (
 )
 
 func TestExecuteWfLifeCycleHook(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(`
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: lifecycle-hook-bgsf6
-  namespace: argo
-  resourceVersion: "33638"
-spec:
-  entrypoint: main
-  hooks:
-    exit:
-      template: http
-    error:
-      expression: workflow.status == "Error"
-      template: http
-    running:
-      expression: workflow.status == "Running"
-      template: http
-  templates:
-  - name: main
-    steps:
-    - - name: step1
-        template: heads
-  - container:
-      args:
-      - echo "it was heads"
-      command:
-      - sh
-      - -c
-      image: alpine:3.23
-      name: ""
-    name: heads
-  - http:
-      url: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
-    name: http
-status:
-  artifactRepositoryRef:
-    artifactRepository:
-      archiveLogs: true
-      s3:
-        accessKeySecret:
-          key: accesskey
-          name: my-minio-cred
-        bucket: my-bucket
-        endpoint: minio:9000
-        insecure: true
-        secretKeySecret:
-          key: secretkey
-          name: my-minio-cred
-    configMap: artifact-repositories
-    key: default-v1
-    namespace: argo
-  conditions:
-  - status: "False"
-    type: PodRunning
-  - status: "True"
-    type: Completed
-  finishedAt: "2022-01-26T19:25:42Z"
-  nodes:
-    lifecycle-hook-bgsf6:
-      children:
-      - lifecycle-hook-bgsf6-2367710970
-      displayName: lifecycle-hook-bgsf6
-      finishedAt: "2022-01-26T19:25:42Z"
-      id: lifecycle-hook-bgsf6
-      name: lifecycle-hook-bgsf6
-      outboundNodes:
-      - lifecycle-hook-bgsf6-3057272397
-      phase: Error
-      progress: 1/1
-      resourcesDuration:
-        cpu: 4
-        memory: 2
-      startedAt: "2022-01-26T19:23:48Z"
-      templateName: main
-      templateScope: local/lifecycle-hook-bgsf6
-      type: Steps
-    lifecycle-hook-bgsf6-2367710970:
-      boundaryID: lifecycle-hook-bgsf6
-      children:
-      - lifecycle-hook-bgsf6-3057272397
-      displayName: '[0]'
-      finishedAt: "2022-01-26T19:25:42Z"
-      id: lifecycle-hook-bgsf6-2367710970
-      name: lifecycle-hook-bgsf6[0]
-      phase: Error
-      progress: 1/1
-      resourcesDuration:
-        cpu: 4
-        memory: 2
-      startedAt: "2022-01-26T19:23:48Z"
-      templateScope: local/lifecycle-hook-bgsf6
-      type: StepGroup
-    lifecycle-hook-bgsf6-3057272397:
-      boundaryID: lifecycle-hook-bgsf6
-      displayName: step1
-      finishedAt: "2022-01-26T19:25:41Z"
-      hostNodeName: k3d-k3s-default-server-0
-      id: lifecycle-hook-bgsf6-3057272397
-      name: lifecycle-hook-bgsf6[0].step1
-      outputs:
-        artifacts:
-        - name: main-logs
-          s3:
-            key: lifecycle-hook-bgsf6/lifecycle-hook-bgsf6-3057272397/main.log
-        exitCode: "0"
-      phase: Error
-      progress: 1/1
-      resourcesDuration:
-        cpu: 4
-        memory: 2
-      startedAt: "2022-01-26T19:23:48Z"
-      templateName: heads
-      templateScope: local/lifecycle-hook-bgsf6
-      type: Pod
-  phase: Error
-  progress: 1/1
-  resourcesDuration:
-    cpu: 4
-    memory: 2
-  startedAt: "2022-01-26T19:23:48Z"
-`)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/hooks/execute-wf-life-cycle-hook.yaml")
 
 	ctx := logging.TestContext(t.Context())
 	cancel, controller := newController(ctx, wf)
@@ -153,110 +32,7 @@ status:
 }
 
 func TestExecuteTmplLifeCycleHook(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(`
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: lifecycle-hook-tmpl-levelg8mqq
-  namespace: argo
-spec:
-  entrypoint: main
-  templates:
-  - name: main
-    steps:
-    - - hooks:
-          running:
-            expression: steps.step1.status == "Running"
-            template: http
-          error:
-            expression: steps.step1.status == "Error"
-            template: http
-        name: step1
-        template: echo
-  - container:
-      args:
-      - echo "it was heads"
-      command:
-      - sh
-      - -c
-      image: alpine:3.23
-    name: echo
-  - http:
-      url: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
-    name: http
-status:
-  conditions:
-  - status: "False"
-    type: PodRunning
-  - status: "True"
-    type: Completed
-  finishedAt: "2022-01-26T21:28:37Z"
-  nodes:
-    lifecycle-hook-tmpl-levelg8mqq:
-      children:
-      - lifecycle-hook-tmpl-levelg8mqq-2902815070
-      displayName: lifecycle-hook-tmpl-levelg8mqq
-      finishedAt: "2022-01-26T21:28:37Z"
-      id: lifecycle-hook-tmpl-levelg8mqq
-      name: lifecycle-hook-tmpl-levelg8mqq
-      outboundNodes:
-      - lifecycle-hook-tmpl-levelg8mqq-3824639481
-      phase: Running
-      progress: 1/1
-      resource
```

**File**: `workflow/controller/testdata/hooks/execute-tmpl-life-cycle-hook.yaml` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: lifecycle-hook-tmpl-levelg8mqq
+  namespace: argo
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    steps:
+    - - hooks:
+          running:
+            expression: steps.step1.status == "Running"
+            template: http
+          error:
+            expression: steps.step1.status == "Error"
+            template: http
+        name: step1
+        template: echo
+  - container:
+      args:
+      - echo "it was heads"
+      command:
+      - sh
+      - -c
+      image: alpine:3.23
+    name: echo
+  - http:
+      url: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
+    name: http
+status:
+  conditions:
+  - status: "False"
+    type: PodRunning
+  - status: "True"
+    type: Completed
+  finishedAt: "2022-01-26T21:28:37Z"
+  nodes:
+    lifecycle-hook-tmpl-levelg8mqq:
+      children:
+      - lifecycle-hook-tmpl-levelg8mqq-2902815070
+      displayName: lifecycle-hook-tmpl-levelg8mqq
+      finishedAt: "2022-01-26T21:28:37Z"
+      id: lifecycle-hook-tmpl-levelg8mqq
+      name: lifecycle-hook-tmpl-levelg8mqq
+      outboundNodes:
+      - lifecycle-hook-tmpl-levelg8mqq-3824639481
+      phase: Running
+      progress: 1/1
+      resourcesDuration:
+        cpu: 1
+        memory: 0
+      startedAt: "2022-01-26T21:28:33Z"
+      templateName: main
+      templateScope: local/lifecycle-hook-tmpl-levelg8mqq
+      type: Steps
+    lifecycle-hook-tmpl-levelg8mqq-2902815070:
+      boundaryID: lifecycle-hook-tmpl-levelg8mqq
+      children:
+      - lifecycle-hook-tmpl-levelg8mqq-3824639481
+      displayName: '[0]'
+      finishedAt: "2022-01-26T21:28:37Z"
+      id: lifecycle-hook-tmpl-levelg8mqq-2902815070
+      name: lifecycle-hook-tmpl-levelg8mqq[0]
+      phase: Running
+      progress: 1/1
+      resourcesDuration:
+        cpu: 1
+        memory: 0
+      startedAt: "2022-01-26T21:28:33Z"
+      templateScope: local/lifecycle-hook-tmpl-levelg8mqq
+      type: StepGroup
+    lifecycle-hook-tmpl-levelg8mqq-3824639481:
+      boundaryID: lifecycle-hook-tmpl-levelg8mqq
+      children:
+      - lifecycle-hook-tmpl-levelg8mqq-4216202210
+      displayName: step1
+      finishedAt: "2022-01-26T21:28:36Z"
+      hostNodeName: k3d-k3s-default-server-0
+      id: lifecycle-hook-tmpl-levelg8mqq-3824639481
+      name: lifecycle-hook-tmpl-levelg8mqq[0].step1
+      outputs:
+        artifacts:
+        - name: main-logs
+          s3:
+            key: lifecycle-hook-tmpl-levelg8mqq/lifecycle-hook-tmpl-levelg8mqq-3824639481/main.log
+        exitCode: "0"
+      phase: Running
+      progress: 1/1
+      resourcesDuration:
+        cpu: 1
+        memory: 0
+      startedAt: "2022-01-26T21:28:33Z"
+      templateName: echo
+      templateScope: local/lifecycle-hook-tmpl-levelg8mqq
+      type: Pod
+  phase: Running
+  progress: 1/1
+  resourcesDuration:
+    cpu: 1
+    memory: 0
+  startedAt: "2022-01-26T21:28:33Z"
```

**File**: `workflow/controller/testdata/hooks/execute-wf-life-cycle-hook.yaml` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: lifecycle-hook-bgsf6
+  namespace: argo
+  resourceVersion: "33638"
+spec:
+  entrypoint: main
+  hooks:
+    exit:
+      template: http
+    error:
+      expression: workflow.status == "Error"
+      template: http
+    running:
+      expression: workflow.status == "Running"
+      template: http
+  templates:
+  - name: main
+    steps:
+    - - name: step1
+        template: heads
+  - container:
+      args:
+      - echo "it was heads"
+      command:
+      - sh
+      - -c
+      image: alpine:3.23
+      name: ""
+    name: heads
+  - http:
+      url: https://raw.githubusercontent.com/argoproj/argo-workflows/4e450e250168e6b4d51a126b784e90b11a0162bc/pkg/apis/workflow/v1alpha1/generated.swagger.json
+    name: http
+status:
+  artifactRepositoryRef:
+    artifactRepository:
+      archiveLogs: true
+      s3:
+        accessKeySecret:
+          key: accesskey
+          name: my-minio-cred
+        bucket: my-bucket
+        endpoint: minio:9000
+        insecure: true
+        secretKeySecret:
+          key: secretkey
+          name: my-minio-cred
+    configMap: artifact-repositories
+    key: default-v1
+    namespace: argo
+  conditions:
+  - status: "False"
+    type: PodRunning
+  - status: "True"
+    type: Completed
+  finishedAt: "2022-01-26T19:25:42Z"
+  nodes:
+    lifecycle-hook-bgsf6:
+      children:
+      - lifecycle-hook-bgsf6-2367710970
+      displayName: lifecycle-hook-bgsf6
+      finishedAt: "2022-01-26T19:25:42Z"
+      id: lifecycle-hook-bgsf6
+      name: lifecycle-hook-bgsf6
+      outboundNodes:
+      - lifecycle-hook-bgsf6-3057272397
+      phase: Error
+      progress: 1/1
+      resourcesDuration:
+        cpu: 4
+        memory: 2
+      startedAt: "2022-01-26T19:23:48Z"
+      templateName: main
+      templateScope: local/lifecycle-hook-bgsf6
+      type: Steps
+    lifecycle-hook-bgsf6-2367710970:
+      boundaryID: lifecycle-hook-bgsf6
+      children:
+      - lifecycle-hook-bgsf6-3057272397
+      displayName: '[0]'
+      finishedAt: "2022-01-26T19:25:42Z"
+      id: lifecycle-hook-bgsf6-2367710970
+      name: lifecycle-hook-bgsf6[0]
+      phase: Error
+      progress: 1/1
+      resourcesDuration:
+        cpu: 4
+        memory: 2
+      startedAt: "2022-01-26T19:23:48Z"
+      templateScope: local/lifecycle-hook-bgsf6
+      type: StepGroup
+    lifecycle-hook-bgsf6-3057272397:
+      boundaryID: lifecycle-hook-bgsf6
+      displayName: step1
+      finishedAt: "2022-01-26T19:25:41Z"
+      hostNodeName: k3d-k3s-default-server-0
+      id: lifecycle-hook-bgsf6-3057272397
+      name: lifecycle-hook-bgsf6[0].step1
+      outputs:
+        artifacts:
+        - name: main-logs
+          s3:
+            key: lifecycle-hook-bgsf6/lifecycle-hook-bgsf6-3057272397/main.log
+        exitCode: "0"
+      phase: Error
+      progress: 1/1
+      resourcesDuration:
+        cpu: 4
+        memory: 2
+      startedAt: "2022-01-26T19:23:48Z"
+      templateName: heads
+      templateScope: local/lifecycle-hook-bgsf6
+      type: Pod
+  phase: Error
+  progress: 1/1
+  resourcesDuration:
+    cpu: 4
+    memory: 2
+  startedAt: "2022-01-26T19:23:48Z"
```

**File**: `workflow/controller/testdata/hooks/step-hook-no-expression.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hook-failures
+  namespace: argo
+spec:
+  entrypoint: main
+  templates:
+    - name: main
+      steps:
+        - - name: step-1
+            template: message
+            hooks:
+              foo:
+                template: message
+    - name: message
+      script:
+        image: alpine:3.23
+        command: [sh]
+        source: |
+          echo Hi
```

**File**: `workflow/controller/testdata/hooks/steps-skipped-ref-exit-hook.yaml` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: steps-skipped-ref-exit-hook
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    steps:
+    - - name: producer
+        template: produce
+        when: "false"
+    - - name: work
+        template: simple
+        hooks:
+          exit:
+            template: consume
+            arguments:
+              parameters:
+              - name: in
+                value: "{{steps.producer.outputs.parameters.msg}}"
+              - name: in2
+                value: "{{= steps.producer.outputs.parameters.msg ?? 'hook-fallback'}}"
+  - name: produce
+    outputs:
+      parameters:
+      - name: msg
+        valueFrom:
+          path: /tmp/out.txt
+    container:
+      image: alpine:3.23
+      command: [sh, -c]
+      args: ["echo hello > /tmp/out.txt"]
+  - name: simple
+    container:
+      image: alpine:3.23
+      command: [echo, "hello"]
+  - name: consume
+    inputs:
+      parameters:
+      - name: in
+        default: "FALLBACK"
+      - name: in2
+    container:
+      image: alpine:3.23
+      command: [echo, "{{inputs.parameters.in}} {{inputs.parameters.in2}}"]
```

**File**: `workflow/controller/testdata/hooks/template-ref-with-hook.yaml` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: workflow-template-whalesay-template-1
+  namespace: default
+spec:
+
+  entrypoint: main
+
+  templates:
+  - name: main
+    steps:
+    - - hooks:
+          exit:
+            expression: steps["step-1"].status == "Running"
+            templateRef:
+              name: workflow-template-whalesay-template
+              template: http
+          error:
+            expression: steps["step-1"].status == "Error"
+            template: ""
+            templateRef:
+              name: workflow-template-whalesay-template
+              template: http
+        name: step-1
+        templateRef:
+          name: workflow-template-whalesay-template
+          template: main
+  ttlStrategy:
+    secondsAfterCompletion: 600
+status:
+  conditions:
+  - status: "False"
+    type: PodRunning
+  - status: "True"
+    type: Completed
+  finishedAt: "2022-01-28T07:01:04Z"
+  nodes:
+    workflow-template-whalesay-template-1:
+      children:
+      - workflow-template-whalesay-template-1-1761665519
+      displayName: workflow-template-whalesay-template-1
+      finishedAt: "2022-01-28T07:01:04Z"
+      id: workflow-template-whalesay-template-1
+      name: workflow-template-whalesay-template-1
+      outboundNodes:
+      - workflow-template-whalesay-template-1-79192944
+      phase: Running
+      progress: 2/2
+      resourcesDuration:
+        cpu: 3
+        memory: 0
+      startedAt: "2022-01-28T07:00:55Z"
+      templateName: main
+      templateScope: local/workflow-template-whalesay-template-1
+      type: Steps
+    workflow-template-whalesay-template-1-1236010667:
+      boundaryID: workflow-template-whalesay-template-1-1438125631
+      children:
+      - workflow-template-whalesay-template-1-2715724931
+      displayName: '[0]'
+      finishedAt: "2022-01-28T07:01:00Z"
+      id: workflow-template-whalesay-template-1-1236010667
+      name: workflow-template-whalesay-template-1[0].step-1[0]
+      phase: Running
+      progress: 2/2
+      resourcesDuration:
+        cpu: 3
+        memory: 0
+      startedAt: "2022-01-28T07:00:55Z"
+      templateScope: namespaced/workflow-template-whalesay-template
+      type: StepGroup
+    workflow-template-whalesay-template-1-1438125631:
+      boundaryID: workflow-template-whalesay-template-1
+      children:
+      - workflow-template-whalesay-template-1-1236010667
+      - workflow-template-whalesay-template-1-986640140
+      - workflow-template-whalesay-template-1-1359034694
+      displayName: step-1
+      finishedAt: "2022-01-28T07:01:04Z"
+      id: workflow-template-whalesay-template-1-1438125631
+      name: workflow-template-whalesay-template-1[0].step-1
+      outboundNodes:
+      - workflow-template-whalesay-template-1-79192944
+      phase: Running
+      progress: 2/2
+      resourcesDuration:
+        cpu: 3
+        memory: 0
+      startedAt: "2022-01-28T07:00:55Z"
+      templateRef:
+        name: workflow-template-whalesay-template
+        template: main
+      templateScope: local/workflow-template-whalesay-template-1
+      type: Steps
+    workflow-template-whalesay-template-1-1761665519:
+      boundaryID: workflow-template-whalesay-template-1
+      children:
+      - workflow-template-whalesay-template-1-1438125631
+      displayName: '[0]'
+      finishedAt: "2022-01-28T07:01:04Z"
+      id: workflow-template-whalesay-template-1-1761665519
+      name: workflow-template-whalesay-template-1[0]
+      phase: Running
+      progress: 2/2
+      resourcesDuration:
+        cpu: 3
+        memory: 0
+      startedAt: "2022-01-28T07:00:55Z"
+      templateScope: local/workflow-template-whalesay-template-1
+      type: StepGroup
+    workflow-template-whalesay-template-1-2377035854:
+      boundaryID: workflow-template-whalesay-template-1-1438125631
+      children:
+      - workflow-template-whalesay-template-1-79192944
+      displayName: '[1]'
+      finishedAt: "2022-01-28T07:01:04Z"
+      id: workflow-template-whalesay-template-1-2377035854
+      name: workflow-template-whalesay-template-1[0].step-1[1]
+      phase: Running
+      progress: 1/1
+      resourcesDuration:
+        cpu: 2
+        memory: 0
+      startedAt: "2022-01-28T07:01:00Z"
+      templateScope: namespaced/workflow-template-whalesay-template
+      type: StepGroup
+    workflow-template-whalesay-template-1-2715724931:
+      boundaryID: workflow-template-whalesay-template-1-1438125631
+      children:
+      - workflow-template-whalesay-template-1-3456567280
+      - workflow-template-whalesay-template-1-1403479850
+      - workflow-template-whalesay-template-1-2377035854
+      displayName: step-1
+      finishedAt: "2022-01-28T07:00:58Z"
+      hostNodeName: k3d-k3s-default-server-0
+      id: workflow-template-whalesay-template-1-2715724931
+      name: workflow-template-whalesay-template-1[0].step-1[0].step-1
+      outputs:
+        artifacts:
+        - name: main-logs
+ 
```

**File**: `workflow/controller/testdata/hooks/wf-hook-has-failures.yaml` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hook-failures
+  namespace: argo
+spec:
+  entrypoint: intentional-fail
+  hooks:
+    failure:
+      expression: workflow.status == "Failed"
+      template: message
+      arguments:
+        parameters:
+          - name: message
+            value: |
+              Workflow {{ workflow.name }} {{ workflow.status }} {{ workflow.failures }}
+  templates:
+    - name: intentional-fail
+      container:
+        image: alpine:3.23
+        command: [sh, -c]
+        args: ["echo intentional failure; exit 1"]
+    - name: message
+      inputs:
+        parameters:
+          - name: message
+      script:
+        image: alpine:3.23
+        command: [sh]
+        source: |
+          echo {{ inputs.parameters.message }}
```

**File**: `workflow/controller/testdata/hooks/wf-hook-no-expression.yaml` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hook-failures
+  namespace: argo
+spec:
+  entrypoint: message
+  hooks:
+    failure:
+      template: message
+  templates:
+    - name: message
+      script:
+        image: alpine:3.23
+        command: [sh]
+        source: |
+          echo Hi
```

---

### Incident Patch 13: `0cb825c5` (2026-09-23)
**Commit Message**: test(controller): move metrics fixtures into testdata (#17062)

Signed-off-by: Jeffery Lofoneh Asamani <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `workflow/controller/operator_metrics_test.go` (modified, +11/-607)
```diff
@@ -14,42 +14,12 @@ import (
 	"github.com/argoproj/argo-workflows/v4/util/logging"
 )
 
-var basicMetric = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  generateName: hello-world-
-spec:
-  entrypoint: random-int
-  templates:
-    - name: random-int
-      metrics:
-        prometheus:
-          - name: duration_gauge
-            labels:
-              - key: name
-                value: random-int
-            help: "Duration gauge by name"
-            gauge:
-              value: "{{duration}}"
-      outputs:
-        parameters:
-          - name: rand-int-value
-            globalName: rand-int-value
-            valueFrom:
-              path: /tmp/rand_int.txt
-      container:
-        image: alpine:3.23
-        command: [sh, -c]
-        args: ["RAND_INT=$((1 + RANDOM % 10)); echo $RAND_INT; echo $RAND_INT > /tmp/rand_int.txt"]
-`
-
 func TestBasicMetric(t *testing.T) {
 	ctx := logging.TestContext(t.Context())
 	cancel, controller := newController(ctx)
 	defer cancel()
 	wfcset := controller.wfclientset.ArgoprojV1alpha1().Workflows("")
-	wf := v1alpha1.MustUnmarshalWorkflow(basicMetric)
+	wf := v1alpha1.MustUnmarshalWorkflow("@testdata/operator_metrics/basic-metric.yaml")
 	_, err := wfcset.Create(ctx, wf, metav1.CreateOptions{})
 	require.NoError(t, err)
 	woc := newWorkflowOperationCtx(ctx, wf, controller)
@@ -71,56 +41,8 @@ func TestBasicMetric(t *testing.T) {
 	require.NoError(t, err)
 }
 
-var gaugeMetric = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: gauge-metric
-spec:
-  entrypoint: whalesay
-  templates:
-    - name: whalesay
-      metrics:
-        prometheus:
-          - name: custom_gauge_add
-            labels:
-              - key: name
-                value: random-int
-            help: "A custom gauge"
-            gauge:
-              operation: Add
-              value: "10"
-          - name: custom_gauge_sub
-            labels:
-              - key: name
-                value: random-int
-            help: "A custom gauge"
-            gauge:
-              operation: Sub
-              value: "5"
-          - name: custom_gauge_set
-            labels:
-              - key: name
-                value: random-int
-            help: "A custom gauge"
-            gauge:
-              operation: Set
-              value: "50"
-          - name: custom_gauge_default
-            labels:
-              - key: name
-                value: random-int
-            help: "A custom gauge"
-            gauge:
-              value: "15"
-      container:
-        image: docker/whalesay:latest
-        command: [cowsay]
-
-`
-
 func TestGaugeMetric(t *testing.T) {
-	wf := v1alpha1.MustUnmarshalWorkflow(gaugeMetric)
+	wf := v1alpha1.MustUnmarshalWorkflow("@testdata/operator_metrics/gauge-metric.yaml")
 	ctx := logging.TestContext(t.Context())
 	cancel, controller := newController(ctx, wf)
 	defer cancel()
@@ -153,40 +75,8 @@ func TestGaugeMetric(t *testing.T) {
 	assert.InEpsilon(t, float64(15.0), valDefault, 0.001)
 }
 
-var counterMetric = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: counter-metric
-spec:
-  entrypoint: whalesay
-  templates:
-    - name: whalesay
-      metrics:
-        prometheus:
-          - name: execution_counter
-            help: "How many times a step has executed"
-            labels:
-              - key: name
-                value: flakey
-            counter:
-              value: "1"
-          - name: failure_counter
-            help: "How many times a step has failed"
-            labels:
-              - key: name
-                value: flakey
-            when: "{{status}} == Failed"
-            counter:
-              value: "1"
-      container:
-        image: docker/whalesay:latest
-        command: [cowsay]
-
-`
-
 func TestCounterMetric(t *testing.T) {
-	wf := v1alpha1.MustUnmarshalWorkflow(counterMetric)
+	wf := v1alpha1.MustUnmarshalWorkflow("@testdata/operator_metrics/counter-metric.yaml")
 	ctx := logging.TestContext(t.Context())
 	cancel, controller := newController(ctx, wf)
 	defer cancel()
@@ -211,65 +101,12 @@ func TestCounterMetric(t *testing.T) {
 	assert.InDelta(t, float64(1), valError, 0.001)
 }
 
-var testMetricEmissionSameOperationCreationAndFailure = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  creationTimestamp: "2020-05-14T14:30:31Z"
-  name: steps-s5rz4
-spec:
-  entrypoint: steps-1
-  onExit: whalesay
-  templates:
-  - inputs: {}
-    metadata: {}
-    name: steps-1
-    outputs: {}
-    steps:
-    - -
-        name: hello2a
-        template: steps-2
-  - inputs: {}
-    metadata: {}
-    metrics:
-      prometheus:
-      - counter:
-          value: "1"
-        gauge: null
-        help: Failure
-        histogram: null
-        labels: null
-        name: failure
-        when: '{{status}} == Failed'
-    name: steps-2
-    outputs: {}
-    steps:
-    - - name: hello1
-        template: whalesay
-        with
```

**File**: `workflow/controller/testdata/operator_metrics/basic-metric.yaml` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  generateName: hello-world-
+spec:
+  entrypoint: random-int
+  templates:
+    - name: random-int
+      metrics:
+        prometheus:
+          - name: duration_gauge
+            labels:
+              - key: name
+                value: random-int
+            help: "Duration gauge by name"
+            gauge:
+              value: "{{duration}}"
+      outputs:
+        parameters:
+          - name: rand-int-value
+            globalName: rand-int-value
+            valueFrom:
+              path: /tmp/rand_int.txt
+      container:
+        image: alpine:3.23
+        command: [sh, -c]
+        args: ["RAND_INT=$((1 + RANDOM % 10)); echo $RAND_INT; echo $RAND_INT > /tmp/rand_int.txt"]
```

**File**: `workflow/controller/testdata/operator_metrics/counter-metric.yaml` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: counter-metric
+spec:
+  entrypoint: whalesay
+  templates:
+    - name: whalesay
+      metrics:
+        prometheus:
+          - name: execution_counter
+            help: "How many times a step has executed"
+            labels:
+              - key: name
+                value: flakey
+            counter:
+              value: "1"
+          - name: failure_counter
+            help: "How many times a step has failed"
+            labels:
+              - key: name
+                value: flakey
+            when: "{{status}} == Failed"
+            counter:
+              value: "1"
+      container:
+        image: docker/whalesay:latest
+        command: [cowsay]
+
```

**File**: `workflow/controller/testdata/operator_metrics/dag-tmpl-metrics.yaml` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: hello-world-nl9bj
+spec:
+  entrypoint: steps
+  templates:
+  - dag:
+      tasks:
+      - name: random-int-dag
+        template: random-int
+      - name: flakey-dag
+        template: flakey
+    name: steps
+    outputs: {}
+  - container:
+      args:
+      - RAND_INT=$((1 + RANDOM % 10)); echo $RAND_INT; echo $RAND_INT > /tmp/rand_int.txt
+      command:
+      - sh
+      - -c
+      image: alpine:3.23
+      name: ""
+      resources: {}
+    inputs: {}
+    metadata: {}
+    metrics:
+      prometheus:
+      - help: Value of the int emitted by random-int at step level
+        histogram:
+          buckets:
+          - 2.01
+          - 4.01
+          - 6.01
+          - 8.01
+          - 10.01
+          value: 5
+        name: random_int_step_histogram_dag
+      - gauge:
+          realtime: true
+          value: '{{duration}}'
+        help: Duration gauge by name
+        labels:
+        - key: name
+          value: random-int
+        name: duration_gauge_dag
+    name: random-int
+    outputs:
+      parameters:
+      - globalName: rand-int-value
+        name: rand-int-value
+        valueFrom:
+          path: /tmp/rand_int.txt
+  - container:
+      args:
+      - import random; import sys; exit_code = random.choice([0, 1, 1]); sys.exit(exit_code)
+      command:
+      - python
+      - -c
+      image: python:alpine3.23
+      name: ""
+      resources: {}
+    inputs: {}
+    metadata: {}
+    metrics:
+      prometheus:
+      - counter:
+          value: "1"
+        help: Count of step execution by result status
+        labels:
+        - key: name
+          value: flakey
+        - key: status
+          value: Failed
+        name: result_counter_dag
+    name: flakey
+    outputs: {}
```

**File**: `workflow/controller/testdata/operator_metrics/gauge-metric.yaml` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: gauge-metric
+spec:
+  entrypoint: whalesay
+  templates:
+    - name: whalesay
+      metrics:
+        prometheus:
+          - name: custom_gauge_add
+            labels:
+              - key: name
+                value: random-int
+            help: "A custom gauge"
+            gauge:
+              operation: Add
+              value: "10"
+          - name: custom_gauge_sub
+            labels:
+              - key: name
+                value: random-int
+            help: "A custom gauge"
+            gauge:
+              operation: Sub
+              value: "5"
+          - name: custom_gauge_set
+            labels:
+              - key: name
+                value: random-int
+            help: "A custom gauge"
+            gauge:
+              operation: Set
+              value: "50"
+          - name: custom_gauge_default
+            labels:
+              - key: name
+                value: random-int
+            help: "A custom gauge"
+            gauge:
+              value: "15"
+      container:
+        image: docker/whalesay:latest
+        command: [cowsay]
+
```

**File**: `workflow/controller/testdata/operator_metrics/metric-emission-same-operation-creation-and-failure.yaml` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  creationTimestamp: "2020-05-14T14:30:31Z"
+  name: steps-s5rz4
+spec:
+  entrypoint: steps-1
+  onExit: whalesay
+  templates:
+  - inputs: {}
+    metadata: {}
+    name: steps-1
+    outputs: {}
+    steps:
+    - -
+        name: hello2a
+        template: steps-2
+  - inputs: {}
+    metadata: {}
+    metrics:
+      prometheus:
+      - counter:
+          value: "1"
+        gauge: null
+        help: Failure
+        histogram: null
+        labels: null
+        name: failure
+        when: '{{status}} == Failed'
+    name: steps-2
+    outputs: {}
+    steps:
+    - - name: hello1
+        template: whalesay
+        withParam: mary had a little lamb
+  - container:
+      args:
+      - hello
+      command:
+      - cowsay
+      image: docker/whalesay
+      name: ""
+      resources: {}
+    inputs: {}
+    metadata: {}
+    name: whalesay
+    outputs: {}
+status:
+  phase: Running
+  startedAt: "2020-05-14T14:30:31Z"
```

**File**: `workflow/controller/testdata/operator_metrics/processed-retry-node.yaml` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: metrics-eg-lq4nj
+spec:
+  entrypoint: my-dag
+  templates:
+  - dag:
+      tasks:
+      - name: A
+        template: A
+    name: my-dag
+  - container:
+      args:
+      - hello from A
+      command:
+      - cowsay
+      image: docker/whalesay
+    metrics:
+      prometheus:
+      - counter:
+          value: "1"
+        help: Number of argo workflows
+        labels:
+        - key: work_unit
+          value: metrics-eg::A
+        - key: workflow_result
+          value: '{{status}}'
+        name: result_counter
+    name: A
+    retryStrategy:
+      backoff:
+        duration: 2s
+        factor: 1
+        maxDuration: 6m
+      limit: 2
+      retryPolicy: Always
+status:
+  nodes:
+    metrics-eg-lq4nj:
+      children:
+      - metrics-eg-lq4nj-4266717436
+      displayName: metrics-eg-lq4nj
+      finishedAt: "2021-01-13T16:14:03Z"
+      id: metrics-eg-lq4nj
+      name: metrics-eg-lq4nj
+      outboundNodes:
+      - metrics-eg-lq4nj-2568729143
+      phase: Running
+      startedAt: "2021-01-13T16:13:53Z"
+      templateName: my-dag
+      templateScope: local/metrics-eg-lq4nj
+      type: DAG
+    metrics-eg-lq4nj-2568729143:
+      boundaryID: metrics-eg-lq4nj
+      displayName: A(0)
+      finishedAt: "2021-01-13T16:13:57Z"
+      id: metrics-eg-lq4nj-2568729143
+      name: metrics-eg-lq4nj.A(0)
+      phase: Succeeded
+      startedAt: "2021-01-13T16:13:53Z"
+      templateName: A
+      templateScope: local/metrics-eg-lq4nj
+      type: Pod
+      nodeFlag:
+        retried: true
+    metrics-eg-lq4nj-4266717436:
+      boundaryID: metrics-eg-lq4nj
+      children:
+      - metrics-eg-lq4nj-2568729143
+      displayName: A
+      finishedAt: "2021-01-13T16:14:03Z"
+      id: metrics-eg-lq4nj-4266717436
+      name: metrics-eg-lq4nj.A
+      phase: Running
+      startedAt: "2021-01-13T16:13:53Z"
+      templateName: A
+      templateScope: local/metrics-eg-lq4nj
+      type: Retry
+  phase: Running
+  startedAt: "2021-01-13T16:13:53Z"
```

**File**: `workflow/controller/testdata/operator_metrics/realtime-workflow-metric-with-global-parameters.yaml` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-foobar
+  labels:
+    testLabel: foobar
+spec:
+  arguments:
+    parameters:
+      - name: testParam
+        value: foo
+  entrypoint: whalesay
+  metrics:
+    prometheus:
+      - name: intuit_data_persistplat_dppselfservice_workflow_test_duration
+        help: Duration of workflow
+        labels:
+          - key: workflowName
+            value: "{{workflow.name}}"
+          - key: label
+            value: "{{workflow.labels.testLabel}}"
+        gauge:
+          realtime: true
+          value: "{{workflow.duration}}"
+  templates:
+    - name: whalesay
+      container:
+        image: docker/whalesay
+        command: [ cowsay ]
+        args: [ "hello world" ]
```

---

### Incident Patch 14: `23902888` (2026-09-23)
**Commit Message**: test(controller): move exit handler fixtures into testdata (#17059)

Signed-off-by: Jeffery Lofoneh Asamani <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `workflow/controller/exit_handler_test.go` (modified, +11/-737)
```diff
@@ -14,54 +14,8 @@ import (
 	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
 )
 
-var stepsOnExitTmpl = `apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: steps-on-exit
-spec:
-  entrypoint: suspend
-  templates:
-  - name: suspend
-    steps:
-    - - name: leafA
-        hooks:
-          exit:
-            template: exitContainer
-            arguments:
-              parameters:
-              - name: input
-                value: '{{steps.leafA.outputs.parameters.result}}'
-        template: whalesay
-    - - name: leafB
-        hooks:
-          exit:
-            template: exitContainer
-            arguments:
-              parameters:
-              - name: input
-                value: '{{steps.leafB.outputs.parameters.result}}'
-        template: whalesay
-  - name: whalesay
-    container:
-      image: docker/whalesay
-      command: [cowsay]
-      args: ["hello world"]
-    outputs:
-      parameters:
-      - name: result
-        valueFrom:
-          default: "welcome"
-          path: /tmp/hello_world.txt
-  - name: exitContainer
-
-    container:
-      image: docker/whalesay
-      command: [cowsay]
-      args: ["goodbye world"]
-`
-
 func TestStepsOnExitTmpl(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(stepsOnExitTmpl)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/exit_handler/steps-on-exit-tmpl.yaml")
 	ctx := logging.TestContext(t.Context())
 	cancel, controller := newController(ctx, wf)
 	defer cancel()
@@ -81,55 +35,8 @@ func TestStepsOnExitTmpl(t *testing.T) {
 	assert.True(t, onExitNodeIsPresent)
 }
 
-var dagOnExitTmpl = `apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: dag-on-exit
-spec:
-  entrypoint: suspend
-  templates:
-  - name: suspend
-    dag:
-      tasks:
-      - name: leafA
-        hooks:
-          exit:
-            template: exitContainer
-            arguments:
-              parameters:
-              - name: input
-                value: '{{tasks.leafA.outputs.parameters.result}}'
-        template: whalesay
-      - name: leafB
-        dependencies: [leafA]
-        hooks:
-          exit:
-            template: exitContainer
-            arguments:
-              parameters:
-              - name: input
-                value: '{{tasks.leafB.outputs.parameters.result}}'
-        template: whalesay
-  - name: whalesay
-    container:
-      image: docker/whalesay
-      command: [cowsay]
-      args: ["hello world"]
-    outputs:
-      parameters:
-      - name: result
-        valueFrom:
-          default: "welcome"
-          path: /tmp/hello_world.txt
-  - name: exitContainer
-    container:
-      image: docker/whalesay
-      command: [cowsay]
-      args: ["goodbye world"]
-`
-
 func TestDAGOnExitTmpl(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(dagOnExitTmpl)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/exit_handler/dag-on-exit-tmpl.yaml")
 	ctx := logging.TestContext(t.Context())
 	cancel, controller := newController(ctx, wf)
 	defer cancel()
@@ -149,47 +56,8 @@ func TestDAGOnExitTmpl(t *testing.T) {
 	assert.True(t, onExitNodeIsPresent)
 }
 
-var stepsOnExitTmplWithArt = `
-apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: steps-on-exit
-spec:
-  entrypoint: suspend
-  templates:
-  - name: suspend
-    steps:
-    - - name: leafA
-        hooks:
-          exit:
-            template: exitContainer
-            arguments:
-              artifacts:
-              - name: input
-                from: '{{steps.leafA.outputs.artifacts.result}}'
-        template: whalesay
-  - name: whalesay
-    container:
-      image: docker/whalesay
-      command: [cowsay]
-      args: ["hello world"]
-    outputs:
-      artifacts:
-      - name: result
-        path: /tmp/hello_world.txt
-  - name: exitContainer
-    inputs:
-      artifacts:
-      - name: input
-        path: /my-artifact
-    container:
-      image: docker/whalesay
-      command: [cowsay]
-      args: ["goodbye world"]
-`
-
 func TestStepsOnExitTmplWithArt(t *testing.T) {
-	wf := wfv1.MustUnmarshalWorkflow(stepsOnExitTmplWithArt)
+	wf := wfv1.MustUnmarshalWorkflow("@testdata/exit_handler/steps-on-exit-tmpl-with-art.yaml")
 	ctx := logging.TestContext(t.Context())
 	cancel, controller := newController(ctx, wf)
 	defer cancel()
@@ -225,46 +93,8 @@ func TestStepsOnExitTmplWithArt(t *testing.T) {
 	assert.True(t, onExitNodeIsPresent)
 }
 
-var dagOnExitTmplWithArt = `apiVersion: argoproj.io/v1alpha1
-kind: Workflow
-metadata:
-  name: dag-on-exit
-spec:
-  entrypoint: main
-  templates:
-  - name: main
-    dag:
-      tasks:
-      - name: leafA
-        hooks:
-          exit:
-            template: exitContainer
-            arguments:
-              artifacts:
-              - name: input
-                from: '{{tasks.leafA.outputs.artifacts.result}}'
-        template: whalesay
-  - name: whalesay
-    container:
-      image: docker/whalesay
-      command: [cowsay]
-      args: ["hell
```

**File**: `workflow/controller/testdata/exit_handler/dag-on-exit-and-retry-strategy.yaml` (added, +180/-0)
```diff
@@ -0,0 +1,180 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: test-workflow-with-retry-strategy8h899
+spec:
+  entrypoint: WORKFLOW
+  templates:
+  - name: WORKFLOW
+    steps:
+    - - name: Execute
+        template: DAG
+  - container:
+      args:
+      - -c
+      - set -xe && ls -ltr /
+      command:
+      - sh
+      image: alpine:3.23
+    inputs:
+      parameters:
+      - name: IMAGE
+    name: LinuxExitHandler
+  - container:
+      args:
+      - -c
+      - set -xe && ls -ltr /
+      command:
+      - sh
+      image: alpine:3.23
+    name: LinuxJobBase
+    retryStrategy:
+      limit: "3"
+      retryPolicy: OnError
+  - dag:
+      tasks:
+      - hooks:
+          exit:
+            arguments:
+              parameters:
+              - name: IMAGE
+                value: alpine:3.23
+            template: LinuxExitHandler
+        name: Python2Compile
+        template: LinuxJobBase
+      - depends: Python2Compile.Succeeded
+        hooks:
+          exit:
+            arguments:
+              parameters:
+              - name: IMAGE
+                value: alpine:3.23
+            template: LinuxExitHandler
+        name: DependencyTesting
+        template: LinuxJobBase
+    name: DAG
+status:
+  nodes:
+    test-workflow-with-retry-strategy8h899:
+      children:
+      - test-workflow-with-retry-strategy8h899-1555287363
+      displayName: test-workflow-with-retry-strategy8h899
+      finishedAt: "2021-07-29T16:16:47Z"
+      id: test-workflow-with-retry-strategy8h899
+      name: test-workflow-with-retry-strategy8h899
+      outboundNodes:
+      - test-workflow-with-retry-strategy8h899-4242067666
+      phase: Running
+      startedAt: "2021-07-29T16:16:07Z"
+      templateName: WORKFLOW
+      templateScope: local/test-workflow-with-retry-strategy8h899
+      type: Steps
+    test-workflow-with-retry-strategy8h899-379180998:
+      boundaryID: test-workflow-with-retry-strategy8h899-3078096906
+      displayName: DependencyTesting(0)
+      finishedAt: "2021-07-29T16:16:23Z"
+      id: test-workflow-with-retry-strategy8h899-379180998
+      name: test-workflow-with-retry-strategy8h899[0].Execute.DependencyTesting(0)
+      phase: Succeeded
+      startedAt: "2021-07-29T16:16:17Z"
+      templateName: LinuxJobBase
+      templateScope: local/test-workflow-with-retry-strategy8h899
+      type: Pod
+    test-workflow-with-retry-strategy8h899-961031240:
+      boundaryID: test-workflow-with-retry-strategy8h899-3078096906
+      children:
+      - test-workflow-with-retry-strategy8h899-3783705931
+      displayName: Python2Compile(0)
+      finishedAt: "2021-07-29T16:16:13Z"
+      id: test-workflow-with-retry-strategy8h899-961031240
+      name: test-workflow-with-retry-strategy8h899[0].Execute.Python2Compile(0)
+      phase: Succeeded
+      startedAt: "2021-07-29T16:16:07Z"
+      templateName: LinuxJobBase
+      templateScope: local/test-workflow-with-retry-strategy8h899
+      type: Pod
+    test-workflow-with-retry-strategy8h899-1555287363:
+      boundaryID: test-workflow-with-retry-strategy8h899
+      children:
+      - test-workflow-with-retry-strategy8h899-3078096906
+      displayName: '[0]'
+      id: test-workflow-with-retry-strategy8h899-1555287363
+      name: test-workflow-with-retry-strategy8h899[0]
+      phase: Running
+      startedAt: "2021-07-29T16:16:07Z"
+      templateScope: local/test-workflow-with-retry-strategy8h899
+      type: StepGroup
+    test-workflow-with-retry-strategy8h899-3078096906:
+      boundaryID: test-workflow-with-retry-strategy8h899
+      children:
+      - test-workflow-with-retry-strategy8h899-3585476721
+      displayName: Execute
+      id: test-workflow-with-retry-strategy8h899-3078096906
+      name: test-workflow-with-retry-strategy8h899[0].Execute
+      outboundNodes:
+      - test-workflow-with-retry-strategy8h899-4242067666
+      phase: Running
+      startedAt: "2021-07-29T16:16:07Z"
+      templateName: DAG
+      templateScope: local/test-workflow-with-retry-strategy8h899
+      type: DAG
+    test-workflow-with-retry-strategy8h899-3585476721:
+      boundaryID: test-workflow-with-retry-strategy8h899-3078096906
+      children:
+      - test-workflow-with-retry-strategy8h899-961031240
+      - test-workflow-with-retry-strategy8h899-3756356520
+      displayName: Python2Compile
+      finishedAt: "2021-07-29T16:16:17Z"
+      id: test-workflow-with-retry-strategy8h899-3585476721
+      name: test-workflow-with-retry-strategy8h899[0].Execute.Python2Compile
+      phase: Succeeded
+      startedAt: "2021-07-29T16:16:07Z"
+      templateName: LinuxJobBase
+      templateScope: local/test-workflow-with-retry-strategy8h899
+      type: Retry
+    test-workflow-with-retry-strategy8h899-3756356520:
+      boundaryID: test-workflow-with-retry-strategy8h899-3078096906
+      displayName: Python2Compile.onExit
+      finishedAt: "2021-07-29T16:16:33Z"
+      id: test-workflow-with-retry-strategy8h899-37
```

**File**: `workflow/controller/testdata/exit_handler/dag-on-exit-tmpl-with-art.yaml` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: dag-on-exit
+spec:
+  entrypoint: main
+  templates:
+  - name: main
+    dag:
+      tasks:
+      - name: leafA
+        hooks:
+          exit:
+            template: exitContainer
+            arguments:
+              artifacts:
+              - name: input
+                from: '{{tasks.leafA.outputs.artifacts.result}}'
+        template: whalesay
+  - name: whalesay
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["hello world"]
+    outputs:
+      artifacts:
+      - name: result
+        path: /tmp/hello_world.txt
+  - name: exitContainer
+    inputs:
+      artifacts:
+      - name: input
+        path: /my-artifact
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["goodbye world"]
```

**File**: `workflow/controller/testdata/exit_handler/dag-on-exit-tmpl.yaml` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: dag-on-exit
+spec:
+  entrypoint: suspend
+  templates:
+  - name: suspend
+    dag:
+      tasks:
+      - name: leafA
+        hooks:
+          exit:
+            template: exitContainer
+            arguments:
+              parameters:
+              - name: input
+                value: '{{tasks.leafA.outputs.parameters.result}}'
+        template: whalesay
+      - name: leafB
+        dependencies: [leafA]
+        hooks:
+          exit:
+            template: exitContainer
+            arguments:
+              parameters:
+              - name: input
+                value: '{{tasks.leafB.outputs.parameters.result}}'
+        template: whalesay
+  - name: whalesay
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["hello world"]
+    outputs:
+      parameters:
+      - name: result
+        valueFrom:
+          default: "welcome"
+          path: /tmp/hello_world.txt
+  - name: exitContainer
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["goodbye world"]
```

**File**: `workflow/controller/testdata/exit_handler/dag-on-exit.yaml` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: dag-on-exit
+spec:
+  entrypoint: suspend
+  templates:
+  - name: suspend
+    dag:
+      tasks:
+      - name: leafA
+        onExit: exitContainer1
+        template: whalesay
+      - name: leafB
+        dependencies: [leafA]
+        hooks:
+          exit:
+            template: exitContainer
+            arguments:
+              parameters:
+              - name: input
+                value: '{{tasks.leafB.outputs.parameters.result}}'
+        template: whalesay
+  - name: whalesay
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["hello world"]
+    outputs:
+      parameters:
+      - name: result
+        valueFrom:
+          default: "welcome"
+          path: /tmp/hello_world.txt
+  - name: exitContainer
+    inputs:
+      parameters:
+      - name: input
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["goodbye world  {{inputs.parameters.input}}"]
+  - name: exitContainer1
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["goodbye world"]
```

**File**: `workflow/controller/testdata/exit_handler/steps-on-exit-tmpl-with-art.yaml` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: steps-on-exit
+spec:
+  entrypoint: suspend
+  templates:
+  - name: suspend
+    steps:
+    - - name: leafA
+        hooks:
+          exit:
+            template: exitContainer
+            arguments:
+              artifacts:
+              - name: input
+                from: '{{steps.leafA.outputs.artifacts.result}}'
+        template: whalesay
+  - name: whalesay
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["hello world"]
+    outputs:
+      artifacts:
+      - name: result
+        path: /tmp/hello_world.txt
+  - name: exitContainer
+    inputs:
+      artifacts:
+      - name: input
+        path: /my-artifact
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["goodbye world"]
```

**File**: `workflow/controller/testdata/exit_handler/steps-on-exit-tmpl.yaml` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  name: steps-on-exit
+spec:
+  entrypoint: suspend
+  templates:
+  - name: suspend
+    steps:
+    - - name: leafA
+        hooks:
+          exit:
+            template: exitContainer
+            arguments:
+              parameters:
+              - name: input
+                value: '{{steps.leafA.outputs.parameters.result}}'
+        template: whalesay
+    - - name: leafB
+        hooks:
+          exit:
+            template: exitContainer
+            arguments:
+              parameters:
+              - name: input
+                value: '{{steps.leafB.outputs.parameters.result}}'
+        template: whalesay
+  - name: whalesay
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["hello world"]
+    outputs:
+      parameters:
+      - name: result
+        valueFrom:
+          default: "welcome"
+          path: /tmp/hello_world.txt
+  - name: exitContainer
+
+    container:
+      image: docker/whalesay
+      command: [cowsay]
+      args: ["goodbye world"]
```

**File**: `workflow/controller/testdata/exit_handler/steps-template-on-exit-status-argument.yaml` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+apiVersion: argoproj.io/v1alpha1
+kind: Workflow
+metadata:
+  generateName: lifecycle-hook-tmpl-level-
+  labels:
+    test: test
+spec:
+  entrypoint: main
+  templates:
+    - name: main
+      steps:
+        - - name: main
+            template: echo
+            hooks:
+              exit:
+                template: hook
+                arguments:
+                  parameters:
+                    - name: status
+                      value: "{{steps.main.status}}"
+    - name: echo
+      container:
+        image: alpine:3.23
+        command: [sh, -c]
+        args: ["echo hi"]
+    - name: hook
+      inputs:
+        parameters:
+          - name: status
+      container:
+        image: alpine:3.23
+        command: [sh, -c]
+        args: ["echo {{inputs.parameters.status}}"]
```

---

### Incident Patch 15: `b0557797` (2026-09-23)
**Commit Message**: fix(controller): deflake TestRealtimeWorkflowMetric (#17060)

Signed-off-by: Jeffery Lofoneh Asamani <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `workflow/controller/operator_metrics_test.go` (modified, +6/-0)
```diff
@@ -519,6 +519,12 @@ func TestRealtimeWorkflowMetric(t *testing.T) {
 	attribs := attribute.NewSet(attribute.String("label", "foobar"), attribute.String("workflowName", "test-foobar"))
 	value, err := testExporter.GetFloat64GaugeValue(ctx, woc.wf.Spec.Metrics.Prometheus[0].Name, &attribs)
 	require.NoError(t, err)
+	// The realtime value is derived from time.Since(Status.StartedAt), and StartedAt
+	// carries no monotonic reading, so this reads the wall clock. Two back-to-back
+	// collections land in the same wall clock tick on platforms with a coarse timer
+	// (~0.5ms on Windows) and report an identical duration, so wait out a tick before
+	// asserting the gauge has advanced.
+	time.Sleep(10 * time.Millisecond)
 	value1, err := testExporter.GetFloat64GaugeValue(ctx, woc.wf.Spec.Metrics.Prometheus[0].Name, &attribs)
 	require.NoError(t, err)
 	t.Logf("%v new %v old", value1, value)
```

#### Recent Merged Pull Requests:
- **PR #17116** (closed): test: move inline controller workflow fixtures to testdata (@HYBJzzq)
- **PR #17106** (2026-09-30): chore(deps): update module github.com/google/go-containerregistry to v0.22.1 (main) (@renovate[bot])
- **PR #17105** (2026-09-29): chore(deps): update google.golang.org/genproto/googleapis/api digest to 8a89bd6 (main) (@renovate[bot])
- **PR #17104** (2026-09-29): fix(examples): mark retry-script as flaky so it is skipped in e2e (@lofoneh)
- **PR #17102** (2026-09-29): fix: tie database queries to the caller's context (cherry-pick #17076 for 4.1) (@argo-cd-cherry-pick-bot[bot])
- **PR #17101** (2026-09-29): chore(deps): update module github.com/azure/azure-sdk-for-go/sdk/azcore to v1.23.2 (main) (@renovate[bot])
- **PR #17100** (2026-09-28): fix: termination of suspended workflow (cherry-pick #17052 for 4.1) (@argo-cd-cherry-pick-bot[bot])
- **PR #17099** (2026-09-29): fix: termination of suspended workflow (cherry-pick #17052 for 4.0) (@argo-cd-cherry-pick-bot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
