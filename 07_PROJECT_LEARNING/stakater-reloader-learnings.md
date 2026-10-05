# Forensic Learning Record (Deep Inspection): stakater/Reloader

> **Canonical Artifact**: `07_PROJECT_LEARNING/stakater-reloader-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stakater/Reloader](https://github.com/stakater/Reloader))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:07:43.857Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stakater/Reloader`
- **Description**: A Kubernetes controller to watch changes in ConfigMap and Secrets and do rolling upgrades on Pods with their associated Deployment, StatefulSet, DaemonSet and DeploymentConfig – [✩Star] if you're using it!
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 10464 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/pkg/util/util.go`
```
package util

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/spf13/cobra"
	v1 "k8s.io/api/core/v1"
	csiv1 "sigs.k8s.io/secrets-store-csi-driver/apis/v1"

	"github.com/stakater/Reloader/internal/pkg/constants"
	"github.com/stakater/Reloader/internal/pkg/crypto"
	"github.com/stakater/Reloader/internal/pkg/options"
)

// ConvertToEnvVarName converts the given text into a usable env var
// removing any special chars with '_' and transforming text to upper case
func ConvertToEnvVarName(text string) string {
	var buffer bytes.Buffer
	upper := strings.ToUpper(text)
	lastCharValid := false
	for i := 0; i < len(upper); i++ {
		ch := upper[i]
		if (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') {
			buffer.WriteString(string(ch))
			lastCharValid = true
		} else {
			if lastCharValid {
				buffer.WriteString("_")
			}
			lastCharValid = false
		}
	}
	return buffer.String()
}

func GetSHAfromConfigmap(configmap *v1.ConfigMap) string {
	values := []string{}
	for k, v := range configmap.Data {
		values = append(values, k+"="+v)
	}
	for k, v := range configmap.BinaryData {
		values = append(values, k+"="+base64.StdEncoding.EncodeToString(v))
	}
	sort.Strings(values)
	return crypto.GenerateSHA(strings.Join(values, ";"))
}

func GetSHAfromSecret(data map[string][]byte) string {
	values := []string{}
	for k, v := range data {
		values = append(values, k+"="+string(v[:]))
	}
	sort.Strings(values)
	return crypto.GenerateSHA(strings.Join(values, ";"))
}

func GetSHAfromSecretProviderClassPodStatus(data csiv1.SecretProviderClassPodStatusStatus) string {
	values := []string{}
	for _, v := range data.Objects {
		values = append(values, v.ID+"="+v.Version)
	}
	values = append(values, "SecretProviderClassName="+data.SecretProviderClassName)
	sort.Strings(values)
	return crypto.GenerateSHA(strings.Join(values, ";"))
}

type List []string

func (l *List) Contains(s string) bool {
	for _, v := range *l {
		if v == s {
			return true
		}
	}
	return false
}

func ConfigureReloaderFlags(cmd *cobra.Command) {
	cmd.PersistentFlags().BoolVar(&options.AutoReloadAll, "auto-reload-all", false, "Auto reload all resources")
	cmd.PersistentFlags().StringVar(&options.ConfigmapUpdateOnChangeAnnotation, "configmap-annotation", "configmap.reloader.stakater.com/reload", "annotation to detect changes in configmaps, specified by name")
	cmd.PersistentFlags().StringVar(&options.SecretUpdateOnChangeAnnotation, "secret-annotation", "secret.reloader.stakater.com/reload", "annotation to detect changes in secrets, specified by name")
	cmd.PersistentFlags().StringVar(&options.ReloaderAutoAnnotation, "auto-annotation", "reloader.stakater.com/auto", "annotation to detect changes in secrets/configmaps")
	cmd.PersistentFlags().StringVar(&options.IgnoreResourceAnnotation, "ignore-annotation", "reloader.stakater.com/ignore", "annotation to ignore a resource when watching for changes in secrets/configmaps")
	cmd.PersistentFlags().StringVar(&options.ConfigmapReloaderAutoAnnotation, "configmap-auto-annotation", "configmap.reloader.stakater.com/auto", "annotation to detect changes in configmaps")
	cmd.PersistentFlags().StringVar(&options.SecretReloaderAutoAnnotation, "secret-auto-annotation", "secret.reloader.stakater.com/auto", "annotation to detect changes in secrets")
	cmd.PersistentFlags().StringVar(&options.AutoSearchAnnotation, "auto-search-annotation", "reloader.stakater.com/search", "annotation to detect changes in configmaps or secrets tagged with special match annotation")
	cmd.PersistentFlags().StringVar(&options.SearchMatchAnnotation, "search-match-annotation", "reloader.stakater.com/match", "annotation to mark secrets or configmaps to match the search")
	cmd.PersistentFlags().StringVar(&options.PauseDeploymentAnnotation, "pause-deployment-annotation", "deployment.reloader.stakater.com/pause-period", "annotation to define the time period to pause a deployment after a configmap/secret change has been detected")
	cmd.PersistentFlags().StringVar(&options.PauseDeploymentTimeAnnotation, "pause-deployment-time-annotation", "deployment.reloader.stakater.com/paused-at", "annotation to indicate when a deployment was paused by Reloader")
	cmd.PersistentFlags().StringVar(&options.LogFormat, "log-format", "", "Log format to use (empty string for text, or JSON)")
	cmd.PersistentFlags().StringVar(&options.LogLevel, "log-level", "info", "Log level to use (trace, debug, info, warning, error, fatal and panic)")
	cmd.PersistentFlags().StringVar(&options.WebhookUrl, "webhook-url", "", "webhook to trigger instead of performing a reload")
	cmd.PersistentFlags().StringSliceVar(&options.ResourcesToIgnore, "resources-to-ignore", options.ResourcesToIgnore, "list of resources to ignore (valid options 'configmaps' or 'secrets')")
	cmd.PersistentFlags().StringSliceVar(&options.WorkloadTypesToIgnore, "ignored-workload-types", options.WorkloadTypesToIgnore, "list of workload types to ignore (valid options: 'jobs', 'cronjobs', or both)")
	cmd.PersistentFlags().StringSliceVar(&options.Namespaces, "namespaces", options.Namespaces, "explicit list of namespaces to watch (scoped mode; creates no ClusterRole)")
	cmd.PersistentFlags().StringSliceVar(&options.NamespacesToIgnore, "namespaces-to-ignore", options.NamespacesToIgnore, "list of namespaces to ignore")
	cmd.PersistentFlags().StringSliceVar(&options.NamespaceSelectors, "namespace-selector", options.NamespaceSelectors, "list of key:value labels to filter on for namespaces")
	cmd.PersistentFlags().StringSliceVar(&options.ResourceSelectors, "resource-label-selector", options.ResourceSelectors, "list of key:value labels to filter on for configmaps and secrets")
	cmd.PersistentFlags().StringVar(&options.IsArgoRollouts, "is-Argo-Rollouts", "false", "Add support for argo rollouts")
	cmd.PersistentFlags().StringVar(&options.ReloadStrategy, constants.ReloadStrategyFlag, constants.EnvVarsReloadStrategy, "Specifies the desired reload strategy")
	cmd.PersistentFlags().StringVar(&options.ReloadOnCreate, "reload-on-create", "false", "Add support to watch create events")
	cmd.PersistentFlags().StringVar(&options.ReloadOnDelete, "reload-on-delete", "false", "Add support to watch delete events")
	cmd.PersistentFlags().BoolVar(&options.EnableHA, "enable-ha", false, "Adds support for running multiple replicas via leadership election")
	cmd.PersistentFlags().DurationVar(&options.LeaderElectionLeaseDuration, "leader-election-lease-duration", options.LeaderElectionLeaseDuration, "Duration non-leader candidates wait before force acquiring leadership, only used when --enable-ha is set")
	cmd.PersistentFlags().DurationVar(&options.LeaderElectionRenewDeadline, "leader-election-renew-deadline", options.LeaderElectionRenewDeadline, "Duration the acting leader retries refreshing leadership before giving up, only used when --enable-ha is set")
	cmd.PersistentFlags().DurationVar(&options.LeaderElectionRetryPeriod, "leader-election-retry-period", options.LeaderElectionRetryPeriod, "Duration clients wait between attempting acquisition and renewal of leadership, only used when --enable-ha is set")
	cmd.PersistentFlags().BoolVar(&options.SyncAfterRestart, "sync-after-restart", false, "Sync add events after reloader restarts")
	cmd.PersistentFlags().BoolVar(&options.EnablePProf, "enable-pprof", false, "Enable pprof for profiling")
	cmd.PersistentFlags().StringVar(&options.PProfAddr, "pprof-addr", ":6060", "Address to start pprof server on. Default is :6060")
	cmd.PersistentFlags().BoolVar(&options.EnableCSIIntegration, "enable-csi-integration", false, "Enables CSI integration. Default is :false")
}

func GetIgnoredResourcesList() (List, error) {

	ignoredResourcesList := options.ResourcesToIgnore // getStringSliceFromFlags(cmd, "resources-to-ignore")

	// Normalize to the canonical lowercase keys used in kube.ResourceMap so the
	// comparison is case-insensitive (e.g. "configMaps", "ConfigMaps", "sEcrets"
	// all map to their canonical lowercase form).
	normalized := make(List, 0, len(ignoredResourcesList))
	for _, v := range ignoredResourcesList {
		switch strings.ToLower(v) {
		case "configmaps":
			normalized = append(normalized, "configmaps")
		case "secrets":
			normalized = append(normalized, "secrets")
		default:
			return nil, fmt.Errorf("'resources-to-ignore' only accepts 'configmaps' or 'secrets', not '%s'", v)
		}
	}

	if len(normalized) > 1 {
		return nil, errors.New("'resources-to-ignore' only accepts 'configmaps' or 'secrets', not both")
	}

	return normalized, nil
}

func GetIgnoredWorkloadTypesList() (List, error) {

	ignoredWorkloadTypesList := options.WorkloadTypesToIgnore

	for _, v := range ignoredWorkloadTypesList {
		if v != "jobs" && v != "cronjobs" {
			return nil, fmt.Errorf("'ignored-workload-types' accepts 'jobs', 'cronjobs', or both, not '%s'", v)
		}
	}

	return ignoredWorkloadTypesList, nil
}

```

### Core Architecture Module: `internal/pkg/alerts/alert.go`
```
package alert

import (
	"fmt"
	"os"
	"strings"

	"github.com/parnurzeal/gorequest"
	"github.com/sirupsen/logrus"
)

type AlertSink string

const (
	AlertSinkSlack      AlertSink = "slack"
	AlertSinkTeams      AlertSink = "teams"
	AlertSinkGoogleChat AlertSink = "gchat"
	AlertSinkRaw        AlertSink = "raw"
)

// function to send alert msg to webhook service
func SendWebhookAlert(msg string) {
	webhook_url, ok := os.LookupEnv("ALERT_WEBHOOK_URL")
	if !ok {
		logrus.Error("ALERT_WEBHOOK_URL env variable not provided")
		return
	}
	webhook_url = strings.TrimSpace(webhook_url)
	alert_sink := os.Getenv("ALERT_SINK")
	alert_sink = strings.ToLower(strings.TrimSpace(alert_sink))

	// Provision to add Proxy to reach webhook server if required
	webhook_proxy := os.Getenv("ALERT_WEBHOOK_PROXY")
	webhook_proxy = strings.TrimSpace(webhook_proxy)

	// Provision to add Additional information in the alert. e.g ClusterName
	alert_additional_info, ok := os.LookupEnv("ALERT_ADDITIONAL_INFO")
	if ok {
		alert_additional_info = strings.TrimSpace(alert_additional_info)
		msg = fmt.Sprintf("%s : %s", alert_additional_info, msg)
	}

	var errs []error
	switch AlertSink(alert_sink) {
	case AlertSinkSlack:
		errs = sendSlackAlert(webhook_url, webhook_proxy, msg)
	case AlertSinkTeams:
		errs = sendTeamsAlert(webhook_url, webhook_proxy, msg)
	case AlertSinkGoogleChat:
		errs = sendGoogleChatAlert(webhook_url, webhook_proxy, msg)
	default:
		msg = strings.ReplaceAll(msg, "*", "")
		errs = sendRawWebhookAlert(webhook_url, webhook_proxy, msg)
	}

	// Previously the errors returned by the send functions were discarded, so a
	// failing webhook (e.g. Teams) produced no output at all. Surface them. (#949)
	for _, err := range errs {
		logrus.Errorf("Error sending alert: %s", err.Error())
	}
}

// function to handle server redirection
func redirectPolicy(req gorequest.Request, via []gorequest.Request) error {
	return fmt.Errorf("incorrect token (redirection)")
}

// function to send alert to slack
func sendSlackAlert(webhookUrl string, proxy string, msg string) []error {
	attachment := Attachment{
		Text:       msg,
		Color:      "good",
		AuthorName: "Reloader",
	}

	payload := WebhookMessage{
		Attachments: []Attachment{attachment},
	}

	request := gorequest.New().Proxy(proxy)
	resp, _, err := request.
		Post(webhookUrl).
		RedirectPolicy(redirectPolicy).
		Send(payload).
		End()

	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return []error{fmt.Errorf("error sending msg. status: %v", resp.Status)}
	}

	return nil
}

// function to send alert to Microsoft Teams webhook
func sendTeamsAlert(webhookUrl string, proxy string, msg string) []error {
	attachment := Attachment{
		Text: msg,
	}

	request := gorequest.New().Proxy(proxy)
	resp, _, err := request.
		Post(webhookUrl).
		RedirectPolicy(redirectPolicy).
		Send(attachment).
		End()

	if err != nil {
		return err
	}
	if resp.StatusCode != 200 {
		return []error{fmt.Errorf("error sending msg. status: %v", resp.Status)}
	}

	return nil
}

// function to send alert to Google Chat webhook
func sendGoogleChatAlert(webhookUrl string, proxy string, msg string) []error {
	payload := map[string]interface{}{
		"text": msg,
	}

	request := gorequest.New().Proxy(proxy)
	resp, _, err := request.
		Post(webhookUrl).
		RedirectPolicy(redirectPolicy).
		Send(payload).
		End()

	if err != nil {
		return err
	}
	if resp.StatusCode != 200 {
		return []error{fmt.Errorf("error sending msg. status: %v", resp.Status)}
	}

	return nil
}

// function to send alert to webhook service as text
func sendRawWebhookAlert(webhookUrl string, proxy string, msg string) []error {
	request := gorequest.New().Proxy(proxy)
	resp, _, err := request.
		Post(webhookUrl).
		Type("text").
		RedirectPolicy(redirectPolicy).
		Send(msg).
		End()

	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return []error{fmt.Errorf("error sending msg. status: %v", resp.Status)}
	}

	return nil
}

```

### Core Architecture Module: `internal/pkg/alerts/slack_alert.go`
```
package alert

type WebhookMessage struct {
	Username        string       `json:"username,omitempty"`
	IconEmoji       string       `json:"icon_emoji,omitempty"`
	IconURL         string       `json:"icon_url,omitempty"`
	Channel         string       `json:"channel,omitempty"`
	ThreadTimestamp string       `json:"thread_ts,omitempty"`
	Text            string       `json:"text,omitempty"`
	Attachments     []Attachment `json:"attachments,omitempty"`
	Parse           string       `json:"parse,omitempty"`
	ResponseType    string       `json:"response_type,omitempty"`
	ReplaceOriginal bool         `json:"replace_original,omitempty"`
	DeleteOriginal  bool         `json:"delete_original,omitempty"`
	ReplyBroadcast  bool         `json:"reply_broadcast,omitempty"`
}

type Attachment struct {
	Color    string `json:"color,omitempty"`
	Fallback string `json:"fallback,omitempty"`

	CallbackID string `json:"callback_id,omitempty"`
	ID         int    `json:"id,omitempty"`

	AuthorID      string `json:"author_id,omitempty"`
	AuthorName    string `json:"author_name,omitempty"`
	AuthorSubname string `json:"author_subname,omitempty"`
	AuthorLink    string `json:"author_link,omitempty"`
	AuthorIcon    string `json:"author_icon,omitempty"`

	Title     string `json:"title,omitempty"`
	TitleLink string `json:"title_link,omitempty"`
	Pretext   string `json:"pretext,omitempty"`
	Text      string `json:"text,omitempty"`

	ImageURL string `json:"image_url,omitempty"`
	ThumbURL string `json:"thumb_url,omitempty"`

	ServiceName string `json:"service_name,omitempty"`
	ServiceIcon string `json:"service_icon,omitempty"`
	FromURL     string `json:"from_url,omitempty"`
	OriginalURL string `json:"original_url,omitempty"`

	MarkdownIn []string `json:"mrkdwn_in,omitempty"`

	Footer     string `json:"footer,omitempty"`
	FooterIcon string `json:"footer_icon,omitempty"`
}

type Field struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Short bool   `json:"short"`
}

type Action struct {
	Type  string `json:"type"`
	Text  string `json:"text"`
	Url   string `json:"url"`
	Style string `json:"style"`
}

```

### Core Architecture Module: `internal/pkg/app/app.go`
```
package app

import "github.com/stakater/Reloader/internal/pkg/cmd"

// Run runs the command
func Run() error {
	rootCmd := cmd.NewReloaderCommand()
	return rootCmd.Execute()
}

```

### Core Architecture Module: `internal/pkg/callbacks/rolling_upgrade.go`
```
package callbacks

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	patchtypes "k8s.io/apimachinery/pkg/types"

	"github.com/stakater/Reloader/internal/pkg/options"
	"github.com/stakater/Reloader/pkg/kube"

	"maps"

	argorolloutv1alpha1 "github.com/argoproj/argo-rollouts/pkg/apis/rollouts/v1alpha1"
)

// ItemFunc is a generic function to return a specific resource in given namespace
type ItemFunc func(kube.Clients, string, string) (runtime.Object, error)

// ItemsFunc is a generic function to return a specific resource array in given namespace
type ItemsFunc func(kube.Clients, string) []runtime.Object

// ContainersFunc is a generic func to return containers
type ContainersFunc func(runtime.Object) []v1.Container

// InitContainersFunc is a generic func to return containers
type InitContainersFunc func(runtime.Object) []v1.Container

// VolumesFunc is a generic func to return volumes
type VolumesFunc func(runtime.Object) []v1.Volume

// UpdateFunc performs the resource update
type UpdateFunc func(kube.Clients, string, runtime.Object) error

// PatchFunc performs the resource patch
type PatchFunc func(kube.Clients, string, runtime.Object, patchtypes.PatchType, []byte) error

// PatchTemplateFunc is a generic func to return strategic merge JSON patch template
type PatchTemplatesFunc func() PatchTemplates

// AnnotationsFunc is a generic func to return annotations
type AnnotationsFunc func(runtime.Object) map[string]string

// PodAnnotationsFunc is a generic func to return annotations
type PodAnnotationsFunc func(runtime.Object) map[string]string

// RollingUpgradeFuncs contains generic functions to perform rolling upgrade
type RollingUpgradeFuncs struct {
	ItemFunc               ItemFunc
	ItemsFunc              ItemsFunc
	AnnotationsFunc        AnnotationsFunc
	PodAnnotationsFunc     PodAnnotationsFunc
	ContainersFunc         ContainersFunc
	ContainerPatchPathFunc ContainersFunc
	InitContainersFunc     InitContainersFunc
	UpdateFunc             UpdateFunc
	PatchFunc              PatchFunc
	PatchTemplatesFunc     PatchTemplatesFunc
	VolumesFunc            VolumesFunc
	ResourceType           string
	SupportsPatch          bool
}

// PatchTemplates contains merge JSON patch templates
type PatchTemplates struct {
	AnnotationTemplate   string
	EnvVarTemplate       string
	DeleteEnvVarTemplate string
}

// GetDeploymentItem returns the deployment in given namespace
func GetDeploymentItem(clients kube.Clients, name string, namespace string) (runtime.Object, error) {
	deployment, err := clients.KubernetesClient.AppsV1().Deployments(namespace).Get(context.TODO(), name, meta_v1.GetOptions{})
	if err != nil {
		logrus.Errorf("Failed to get deployment %v", err)
		return nil, err
	}

	if deployment.Spec.Template.Annotations == nil {
		annotations := make(map[string]string)
		deployment.Spec.Template.Annotations = annotations
	}

	return deployment, nil
}

// GetDeploymentItems returns the deployments in given namespace
func GetDeploymentItems(clients kube.Clients, namespace string) []runtime.Object {
	deployments, err := clients.KubernetesClient.AppsV1().Deployments(namespace).List(context.TODO(), meta_v1.ListOptions{})
	if err != nil {
		logrus.Errorf("Failed to list deployments %v", err)
	}

	items := make([]runtime.Object, len(deployments.Items))
	// Ensure we always have pod annotations to add to
	for i, v := range deployments.Items {
		if v.Spec.Template.Annotations == nil {
			annotations := make(map[string]string)
			deployments.Items[i].Spec.Template.Annotations = annotations
		}
		items[i] = &deployments.Items[i]
	}

	return items
}

// GetCronJobItem returns the job in given namespace
func GetCronJobItem(clients kube.Clients, name string, namespace string) (runtime.Object, error) {
	cronjob, err := clients.KubernetesClient.BatchV1().CronJobs(namespace).Get(context.TODO(), name, meta_v1.GetOptions{})
	if err != nil {
		logrus.Errorf("Failed to get cronjob %v", err)
		return nil, err
	}

	return cronjob, nil
}

// GetCronJobItems returns the jobs in given namespace
func GetCronJobItems(clients kube.Clients, namespace string) []runtime.Object {
	cronjobs, err := clients.KubernetesClient.BatchV1().CronJobs(namespace).List(context.TODO(), meta_v1.ListOptions{})
	if err != nil {
		logrus.Errorf("Failed to list cronjobs %v", err)
	}

	items := make([]runtime.Object, len(cronjobs.Items))
	// Ensure we always have pod annotations to add to
	for i, v := range cronjobs.Items {
		if v.Spec.JobTemplate.Spec.Template.Annotations == nil {
			annotations := make(map[string]string)
			cronjobs.Items[i].Spec.JobTemplate.Spec.Template.Annotations = annotations
		}
		items[i] = &cronjobs.Items[i]
	}

	return items
}

// GetJobItem returns the job in given namespace
func GetJobItem(clients kube.Clients, name string, namespace string) (runtime.Object, error) {
	job, err := clients.KubernetesClient.BatchV1().Jobs(namespace).Get(context.TODO(), name, meta_v1.GetOptions{})
	if err != nil {
		logrus.Errorf("Failed to get job %v", err)
		return nil, err
	}

	return job, nil
}

// GetJobItems returns the jobs in given namespace
func GetJobItems(clients kube.Clients, namespace string) []runtime.Object {
	jobs, err := clients.KubernetesClient.BatchV1().Jobs(namespace).List(context.TODO(), meta_v1.ListOptions{})
	if err != nil {
		logrus.Errorf("Failed to list jobs %v", err)
	}

	items := make([]runtime.Object, len(jobs.Items))
	// Ensure we always have pod annotations to add to
	for i, v := range jobs.Items {
		if v.Spec.Template.Annotations == nil {
			annotations := make(map[string]string)
			jobs.Items[i].Spec.Template.Annotations = annotations
		}
		items[i] = &jobs.Items[i]
	}

	return items
}

// GetDaemonSetItem returns the daemonSet in given namespace
func GetDaemonSetItem(clients kube.Clients, name string, namespace string) (runtime.Object, error) {
	daemonSet, err := clients.KubernetesClient.AppsV1().DaemonSets(namespace).Get(context.TODO(), name, meta_v1.GetOptions{})
	if err != nil {
		logrus.Errorf("Failed to get daemonSet %v", err)
		return nil, err
	}

	return daemonSet, nil
}

// GetDaemonSetItems returns the daemonSets in given namespace
func GetDaemonSetItems(clients kube.Clients, namespace string) []runtime.Object {
	daemonSets, err := clients.KubernetesClient.AppsV1().DaemonSets(namespace).List(context.TODO(), meta_v1.ListOptions{})
	if err != nil {
		logrus.Errorf("Failed to list daemonSets %v", err)
	}

	items := make([]runtime.Object, len(daemonSets.Items))
	// Ensure we always have pod annotations to add to
	for i, v := range daemonSets.Items {
		if v.Spec.Template.Annotations == nil {
			daemonSets.Items[i].Spec.Template.Annotations = make(map[string]string)
		}
		items[i] = &daemonSets.Items[i]
	}

	return items
}

// GetStatefulSetItem returns the statefulSet in given namespace
func GetStatefulSetItem(clients kube.Clients, name string, namespace string) (runtime.Object, error) {
	statefulSet, err := clients.KubernetesClient.AppsV1().StatefulSets(namespace).Get(context.TODO(), name, meta_v1.GetOptions{})
	if err != nil {
		logrus.Errorf("Failed to get statefulSet %v", err)
		return nil, err
	}

	return statefulSet, nil
}

// GetStatefulSetItems returns the statefulSets in given namespace
func GetStatefulSetItems(clients kube.Clients, namespace string) []runtime.Object {
	statefulSets, err := clients.KubernetesClient.AppsV1().StatefulSets(namespace).List(context.TODO(), meta_v1.ListOptions{})
	if err != nil {
		logrus.Errorf("Failed to list statefulSets %v", err)
	}

	items := make([]runtime.Object, len(statefulSets.Items))
	// Ensure we always have pod annotations to add to
	for i, v := range statefulSets.Items {
		if v.Spec.Template.Annotations == nil {
			statefulSets.Items[i].Spec.Template.Annotations = make(map[string]string)
		}
		items[i] = &statefulSets.Items[i]
	}

	return items
}

// GetRolloutItem returns the rollout in given namespace
func GetRolloutItem(clients kube.Clients, name string, namespace string) (runtime.Object, error) {
	rollout, err := clients.ArgoRolloutClient.ArgoprojV1alpha1().Rollouts(namespace).Get(context.TODO(), name, meta_v1.GetOptions{})
	if err != nil {
		logrus.Errorf("Failed to get Rollout %v", err)
		return nil, err
	}

	return rollout, nil
}

// GetRolloutItems returns the rollouts in given namespace
func GetRolloutItems(clients kube.Clients, namespace string) []runtime.Object {
	rollouts, err := clients.ArgoRolloutClient.ArgoprojV1alpha1().Rollouts(namespace).List(context.TODO(), meta_v1.ListOptions{})
	if err != nil {
		logrus.Errorf("Failed to list Rollouts %v", err)
	}

	items := make([]runtime.Object, len(rollouts.Items))
	// Ensure we always have pod annotations to add to
	for i, v := range rollouts.Items {
		if v.Spec.Template.Annotations == nil {
			rollouts.Items[i].Spec.Template.Annotations = make(map[string]string)
		}
		items[i] = &rollouts.Items[i]
	}

	return items
}

// GetDeploymentAnnotations returns the annotations of given deployment
func GetDeploymentAnnotations(item runtime.Object) map[string]string {
	deployment, ok := item.(*appsv1.Deployment)
	if !ok {
		return nil
	}
	if deployment.Annotations == nil {
		deployment.Annotations = make(map[string]string)
	}
	return deployment.Annotations
}

// GetCronJobAnnotations returns the annotations of given cronjob
func GetCronJobAnnotations(item runtime.Object) map[string]string {
	cronJob, ok := item.(*batchv1.CronJob)
	if !ok {
		return nil
	}
	if cronJob.Annotations == nil {
		cronJob.Annotations = make(map[string]string)
	}
	return cronJob.Annotations
}

// GetJobAnnotations returns the annotations of given job
func GetJobAnnotations(item runtime.Object) map[string]string {
	job, ok := item.(*batchv1.Job)
	if !ok {
		return nil
	}
	if job.Annotations == nil {
		job.Annotations = make(map[string]string)
	}
	return job.Ann
```

### Core Architecture Module: `internal/pkg/cmd/reloader.go`
```
package cmd

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	_ "net/http/pprof"
	"os"
	"strings"
	"time"

	"github.com/stakater/Reloader/internal/pkg/constants"
	"github.com/stakater/Reloader/internal/pkg/leadership"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/leaderelection"

	"github.com/stakater/Reloader/internal/pkg/controller"
	"github.com/stakater/Reloader/internal/pkg/metrics"
	"github.com/stakater/Reloader/internal/pkg/options"
	"github.com/stakater/Reloader/internal/pkg/util"
	"github.com/stakater/Reloader/pkg/common"
	"github.com/stakater/Reloader/pkg/kube"
)

// NewReloaderCommand starts the reloader controller
func NewReloaderCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "reloader",
		Short:   "A watcher for your Kubernetes cluster",
		PreRunE: validateFlags,
		Run:     startReloader,
	}

	// options
	util.ConfigureReloaderFlags(cmd)

	return cmd
}

func validateFlags(*cobra.Command, []string) error {
	// Ensure the reload strategy is one of the following...
	var validReloadStrategy bool
	valid := []string{constants.EnvVarsReloadStrategy, constants.AnnotationsReloadStrategy}
	for _, s := range valid {
		if s == options.ReloadStrategy {
			validReloadStrategy = true
		}
	}

	if !validReloadStrategy {
		err := fmt.Sprintf("%s must be one of: %s", constants.ReloadStrategyFlag, strings.Join(valid, ", "))
		return errors.New(err)
	}

	// Validate that HA options are correct
	if options.EnableHA {
		if err := validateHAEnvs(); err != nil {
			return err
		}
		if err := validateLeaderElectionTimings(); err != nil {
			return err
		}
	}

	return nil
}

func configureLogging(logFormat, logLevel string) error {
	switch logFormat {
	case "json":
		logrus.SetFormatter(&logrus.JSONFormatter{})
	default:
		// just let the library use default on empty string.
		if logFormat != "" {
			return fmt.Errorf("unsupported logging formatter: %q", logFormat)
		}
	}
	// set log level
	level, err := logrus.ParseLevel(logLevel)
	if err != nil {
		return err
	}
	logrus.SetLevel(level)
	return nil
}

func validateHAEnvs() error {
	podName, podNamespace := getHAEnvs()

	if podName == "" {
		return fmt.Errorf("%s not set, cannot run in HA mode without %s set", constants.PodNameEnv, constants.PodNameEnv)
	}
	if podNamespace == "" {
		return fmt.Errorf("%s not set, cannot run in HA mode without %s set", constants.PodNamespaceEnv, constants.PodNamespaceEnv)
	}
	return nil
}

// maxLeaseDuration is the largest lease duration client-go can persist, since it
// records the duration on the Lease as int32 seconds.
const maxLeaseDuration = math.MaxInt32 * time.Second

// validateLeaderElectionTimings enforces the constraints of client-go's
// leaderelection.NewLeaderElector, which panics via RunOrDie when they are violated,
// plus the whole-second lease duration that leader exclusivity depends on.
func validateLeaderElectionTimings() error {
	// client-go persists the lease duration on the Lease as whole seconds, and a follower
	// judges expiry from that truncated value while the leader renews on the configured
	// one. A fractional lease therefore lets a follower force acquire the lease before the
	// incumbent reaches its renew deadline, allowing two leaders at once.
	if options.LeaderElectionLeaseDuration%time.Second != 0 {
		return errors.New("--leader-election-lease-duration must be a whole number of seconds")
	}
	if options.LeaderElectionLeaseDuration < time.Second {
		return errors.New("--leader-election-lease-duration must be at least 1s")
	}
	if options.LeaderElectionLeaseDuration > maxLeaseDuration {
		return fmt.Errorf("--leader-election-lease-duration must not exceed %s, the largest value representable on the Lease API", maxLeaseDuration)
	}
	if options.LeaderElectionRenewDeadline <= 0 {
		return errors.New("--leader-election-renew-deadline must be greater than zero")
	}
	if options.LeaderElectionRetryPeriod <= 0 {
		return errors.New("--leader-election-retry-period must be greater than zero")
	}
	if options.LeaderElectionLeaseDuration <= options.LeaderElectionRenewDeadline {
		return errors.New("--leader-election-lease-duration must be greater than --leader-election-renew-deadline")
	}
	if options.LeaderElectionRenewDeadline <= time.Duration(leaderelection.JitterFactor*float64(options.LeaderElectionRetryPeriod)) {
		return fmt.Errorf("--leader-election-renew-deadline must be greater than --leader-election-retry-period multiplied by the jitter factor (%v)", leaderelection.JitterFactor)
	}
	return nil
}

func getHAEnvs() (string, string) {
	podName := os.Getenv(constants.PodNameEnv)
	podNamespace := os.Getenv(constants.PodNamespaceEnv)

	return podName, podNamespace
}

// resolveWatchNamespaces determines the set of namespaces to watch and whether
// Reloader runs in global (all-namespaces) mode. Precedence:
//  1. an explicit --namespaces list (scoped mode) — watch exactly those namespaces;
//  2. the KUBERNETES_NAMESPACE env var (single-namespace mode);
//  3. otherwise watch all namespaces (global mode).
func resolveWatchNamespaces(namespaces []string, kubernetesNamespace string) ([]string, bool) {
	if len(namespaces) > 0 {
		return namespaces, false
	}
	if len(kubernetesNamespace) > 0 {
		return []string{kubernetesNamespace}, false
	}
	return []string{v1.NamespaceAll}, true
}

// namespaceWatchScopeMessage returns the startup log message describing the
// namespace scope Reloader will watch when KUBERNETES_NAMESPACE is unset
// (global mode). It reflects --namespaces-to-ignore so the log is not
// misleading when namespace filtering is configured.
func namespaceWatchScopeMessage(ignoredNamespaces []string) string {
	if len(ignoredNamespaces) > 0 {
		return fmt.Sprintf(
			"KUBERNETES_NAMESPACE is unset, will detect changes in all namespaces except: %s.",
			strings.Join(ignoredNamespaces, ", "),
		)
	}
	return "KUBERNETES_NAMESPACE is unset, will detect changes in all namespaces."
}

func startReloader(cmd *cobra.Command, args []string) {
	common.GetCommandLineOptions()
	err := configureLogging(options.LogFormat, options.LogLevel)
	if err != nil {
		logrus.Warn(err)
	}

	logrus.Info("Starting Reloader")
	watchNamespaces, isGlobal := resolveWatchNamespaces(options.Namespaces, os.Getenv("KUBERNETES_NAMESPACE"))
	if !isGlobal && len(options.Namespaces) > 0 {
		logrus.Infof("Watching scoped namespaces: %s", strings.Join(watchNamespaces, ", "))
	}

	// create the clientset
	clientset, err := kube.GetKubernetesClient()
	if err != nil {
		logrus.Fatal(err)
	}

	ignoredResourcesList, err := util.GetIgnoredResourcesList()
	if err != nil {
		logrus.Fatal(err)
	}

	// namespaces-to-ignore and namespace-selector only make sense when watching all
	// namespaces. In single-namespace and scoped modes the watched set is already
	// explicit, so both are intentionally left empty.
	ignoredNamespacesList := []string{}
	namespaceLabelSelector := ""

	if isGlobal {
		ignoredNamespacesList = options.NamespacesToIgnore
		logrus.Warn(namespaceWatchScopeMessage(ignoredNamespacesList))
		namespaceLabelSelector, err = common.GetNamespaceLabelSelector(options.NamespaceSelectors)
		if err != nil {
			logrus.Fatal(err)
		}
	} else if len(options.NamespacesToIgnore) > 0 {
		logrus.Warnf("namespaces-to-ignore is set but is only honored in global mode (watchGlobally=true); ignoring it.")
	}

	resourceLabelSelector, err := common.GetResourceLabelSelector(options.ResourceSelectors)
	if err != nil {
		logrus.Fatal(err)
	}

	if len(namespaceLabelSelector) > 0 {
		logrus.Warnf("namespace-selector is set, will only detect changes in namespaces with these labels: %s.", namespaceLabelSelector)
	}

	if len(resourceLabelSelector) > 0 {
		logrus.Warnf("resource-label-selector is set, will only detect changes on resources with these labels: %s.", resourceLabelSelector)
	}

	if options.WebhookUrl != "" {
		logrus.Warnf("webhook-url is set, will only send webhook, no resources will be reloaded")
	}

	collectors := metrics.SetupPrometheusEndpoint()

	var controllers []*controller.Controller
	for _, currentNamespace := range watchNamespaces {
		for k := range kube.ResourceMap {
			if k == constants.SecretProviderClassController && !shouldRunCSIController() {
				continue
			}

			if ignoredResourcesList.Contains(k) || (len(namespaceLabelSelector) == 0 && k == "namespaces") {
				continue
			}

			c, err := controller.NewController(clientset, k, currentNamespace, ignoredNamespacesList, namespaceLabelSelector, resourceLabelSelector, collectors)
			if err != nil {
				logrus.Fatalf("%s", err)
			}

			controllers = append(controllers, c)

			// If HA is enabled we only run the controller when
			if options.EnableHA {
				continue
			}
			// Now let's start the controller
			stop := make(chan struct{})
			defer close(stop)
			logrus.Infof("Starting Controller to watch resource type: %s in namespace: %s", k, currentNamespace)
			go c.Run(1, stop)
		}
	}

	// Run leadership election
	if options.EnableHA {
		podName, podNamespace := getHAEnvs()
		lock := leadership.GetNewLock(clientset.CoordinationV1(), constants.LockName, podName, podNamespace)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		leadership.RunLeaderElection(lock, ctx, cancel, podName, controllers)
	}

	common.PublishMetaInfoConfigmap(clientset)

	if options.EnablePProf {
		go startPProfServer()
	}

	leadership.SetupLivenessEndpoint()
	logrus.Fatal(http.ListenAndServe(constants.DefaultHttpListenAddr, nil))
}

func startPProfServer() {
	logrus.Infof("Starting pprof server on %s", options.PProfAddr)
	if err := http.ListenAndServe(options.PProfAddr, nil); err != nil {
		logrus.Errorf("Failed to start pprof server: %v", err)
	}
}

func shouldRunCSIController() bool {
	if !options.EnableCSIIntegration {
		logrus.Info("Skipping secretproviderclasspodstatuses controller: EnableCSIIntegration is disabled")
		return false
	}
	if !kube.IsCSIInstalled {
		logrus.Info("Skipping secretprovid
```

### Core Architecture Module: `internal/pkg/constants/constants.go`
```
package constants

const (
	// DefaultHttpListenAddr is the default listening address for global http server
	DefaultHttpListenAddr = ":9090"

	// ConfigmapEnvVarPostfix is a postfix for configmap envVar
	ConfigmapEnvVarPostfix = "CONFIGMAP"
	// SecretEnvVarPostfix is a postfix for secret envVar
	SecretEnvVarPostfix = "SECRET"
	// SecretProviderClassEnvVarPostfix is a postfix for secretproviderclasspodstatus envVar
	SecretProviderClassEnvVarPostfix = "SECRETPROVIDERCLASS"
	// EnvVarPrefix is a Prefix for environment variable
	EnvVarPrefix = "STAKATER_"

	// ReloaderAnnotationPrefix is a Prefix for all reloader annotations
	ReloaderAnnotationPrefix = "reloader.stakater.com"
	// LastReloadedFromAnnotation is an annotation used to describe the last resource that triggered a reload
	LastReloadedFromAnnotation = "last-reloaded-from"

	// 	ReloadStrategyFlag The reload strategy flag name
	ReloadStrategyFlag = "reload-strategy"
	// EnvVarsReloadStrategy instructs Reloader to add container environment variables to facilitate a restart
	EnvVarsReloadStrategy = "env-vars"
	// AnnotationsReloadStrategy instructs Reloader to add pod template annotations to facilitate a restart
	AnnotationsReloadStrategy = "annotations"
	// SecretProviderClassController enables support for SecretProviderClassPodStatus resources
	SecretProviderClassController = "secretproviderclasspodstatuses"
)

// Leadership election related consts
const (
	LockName        string = "stakater-reloader-lock"
	PodNameEnv      string = "POD_NAME"
	PodNamespaceEnv string = "POD_NAMESPACE"
)

```

### Core Architecture Module: `internal/pkg/constants/enums.go`
```
package constants

// Result is a status for deployment update
type Result int

const (
	// Updated is returned when environment variable is created/updated
	Updated Result = 1 + iota
	// NotUpdated is returned when environment variable is found but had value equals to the new value
	NotUpdated
	// NoEnvVarFound is returned when no environment variable is found
	NoEnvVarFound
	// NoContainerFound is returned when no environment variable is found
	NoContainerFound
)

```

### Core Architecture Module: `internal/pkg/controller/controller.go`
```
package controller

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	typedcorev1 "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/record"
	"k8s.io/client-go/util/workqueue"
	"k8s.io/kubectl/pkg/scheme"
	csiv1 "sigs.k8s.io/secrets-store-csi-driver/apis/v1"

	"github.com/stakater/Reloader/internal/pkg/constants"
	"github.com/stakater/Reloader/internal/pkg/handler"
	"github.com/stakater/Reloader/internal/pkg/metrics"
	"github.com/stakater/Reloader/internal/pkg/options"
	"github.com/stakater/Reloader/internal/pkg/util"
	"github.com/stakater/Reloader/pkg/kube"
)

// Controller for checking events
type Controller struct {
	client            kubernetes.Interface
	queue             workqueue.TypedRateLimitingInterface[any]
	informer          cache.Controller
	namespace         string
	resource          string
	ignoredNamespaces util.List
	collectors        metrics.Collectors
	recorder          record.EventRecorder
	namespaceSelector string
	resourceSelector  string
}

// controllerInitialized flags guard against processing Add/Delete events before
// the worker goroutines have started. Written by runWorker (in a goroutine) and
// read by the informer event handlers, so they must be atomic.
var secretControllerInitialized atomic.Bool
var configmapControllerInitialized atomic.Bool

// selectedNamespacesCache holds an immutable snapshot of the set of namespace
// names that match the namespace label selector. Written exclusively by the
// namespace controller's informer goroutine; read concurrently by configmap/
// secret controller informer goroutines. Using atomic.Value with an immutable
// map[string]struct{} snapshot avoids mutexes and prevents data races.
var selectedNamespacesCache atomic.Value // always stores map[string]struct{}

// loadSelectedNamespaces returns the current namespace snapshot (never nil).
func loadSelectedNamespaces() map[string]struct{} {
	if v := selectedNamespacesCache.Load(); v != nil {
		if m, ok := v.(map[string]struct{}); ok {
			return m
		}
	}
	return map[string]struct{}{}
}

// storeSelectedNamespaces replaces the current snapshot with one built from ns.
// It is the only mutator of selectedNamespacesCache and is called only from
// the namespace controller's informer goroutine (or from tests for setup).
func storeSelectedNamespaces(ns []string) {
	m := make(map[string]struct{}, len(ns))
	for _, n := range ns {
		m[n] = struct{}{}
	}
	selectedNamespacesCache.Store(m)
}

// loadSelectedNamespacesList returns the current namespace names as a slice.
// Intended for use in tests where slice-based assertions are more convenient.
func loadSelectedNamespacesList() []string {
	m := loadSelectedNamespaces()
	result := make([]string, 0, len(m))
	for k := range m {
		result = append(result, k)
	}
	return result
}

// NewController for initializing a Controller
func NewController(client kubernetes.Interface, resource string, namespace string, ignoredNamespaces []string, namespaceLabelSelector string, resourceLabelSelector string, collectors metrics.Collectors) (*Controller, error) {
	if options.SyncAfterRestart {
		secretControllerInitialized.Store(true)
		configmapControllerInitialized.Store(true)
	}

	c := Controller{
		client:            client,
		namespace:         namespace,
		ignoredNamespaces: ignoredNamespaces,
		namespaceSelector: namespaceLabelSelector,
		resourceSelector:  resourceLabelSelector,
		resource:          resource,
	}
	eventBroadcaster := record.NewBroadcaster()
	eventBroadcaster.StartRecordingToSink(&typedcorev1.EventSinkImpl{
		Interface: client.CoreV1().Events(""),
	})
	recorder := eventBroadcaster.NewRecorder(scheme.Scheme,
		v1.EventSource{Component: fmt.Sprintf("reloader-%s", resource)})

	queue := workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[any]())

	optionsModifier := func(opts *metav1.ListOptions) {
		if resource == "namespaces" {
			opts.LabelSelector = c.namespaceSelector
		} else if len(c.resourceSelector) > 0 {
			opts.LabelSelector = c.resourceSelector
		} else {
			opts.FieldSelector = fields.Everything().String()
		}
	}

	getterRESTClient, err := getClientForResource(resource, client)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize REST client for %s: %w", resource, err)
	}

	listWatcher := cache.NewFilteredListWatchFromClient(getterRESTClient, resource, namespace, optionsModifier)

	_, informer := cache.NewInformerWithOptions(cache.InformerOptions{
		ListerWatcher: listWatcher,
		ObjectType:    kube.ResourceMap[resource],
		ResyncPeriod:  0,
		Handler: cache.ResourceEventHandlerFuncs{
			AddFunc:    c.Add,
			UpdateFunc: c.Update,
			DeleteFunc: c.Delete,
		},
		Indexers: cache.Indexers{},
	})
	c.informer = informer
	c.queue = queue
	c.collectors = collectors
	c.recorder = recorder

	logrus.Infof("created controller for: %s", resource)
	return &c, nil
}

// Add function to add a new object to the queue in case of creating a resource
func (c *Controller) Add(obj interface{}) {
	c.collectors.RecordEventReceived("add", c.resource)

	switch object := obj.(type) {
	case *v1.Namespace:
		c.addSelectedNamespaceToCache(*object)
		return
	case *csiv1.SecretProviderClassPodStatus:
		return
	}

	if options.ReloadOnCreate == "true" {
		if !c.resourceInIgnoredNamespace(obj) && c.resourceInSelectedNamespaces(obj) && secretControllerInitialized.Load() && configmapControllerInitialized.Load() {
			c.enqueue(handler.ResourceCreatedHandler{
				Resource:    obj,
				Collectors:  c.collectors,
				Recorder:    c.recorder,
				EnqueueTime: time.Now(),
			})
		} else {
			c.collectors.RecordSkipped("ignored_or_not_selected")
		}
	}
}

func (c *Controller) resourceInIgnoredNamespace(raw interface{}) bool {
	switch obj := raw.(type) {
	case *v1.ConfigMap:
		return c.ignoredNamespaces.Contains(obj.Namespace)
	case *v1.Secret:
		return c.ignoredNamespaces.Contains(obj.Namespace)
	case *csiv1.SecretProviderClassPodStatus:
		return c.ignoredNamespaces.Contains(obj.Namespace)
	}
	return false
}

func (c *Controller) resourceInSelectedNamespaces(raw interface{}) bool {
	if len(c.namespaceSelector) == 0 {
		return true
	}

	namespaces := loadSelectedNamespaces()
	var ns string
	switch object := raw.(type) {
	case *v1.ConfigMap:
		ns = object.GetNamespace()
	case *v1.Secret:
		ns = object.GetNamespace()
	case *csiv1.SecretProviderClassPodStatus:
		ns = object.GetNamespace()
	default:
		return false
	}
	_, ok := namespaces[ns]
	return ok
}

func (c *Controller) addSelectedNamespaceToCache(namespace v1.Namespace) {
	old := loadSelectedNamespaces()
	next := make(map[string]struct{}, len(old)+1)
	for k := range old {
		next[k] = struct{}{}
	}
	next[namespace.GetName()] = struct{}{}
	selectedNamespacesCache.Store(next)
	logrus.Infof("added namespace to be watched: %s", namespace.GetName())
}

func (c *Controller) removeSelectedNamespaceFromCache(namespace v1.Namespace) {
	old := loadSelectedNamespaces()
	if _, ok := old[namespace.GetName()]; !ok {
		return
	}
	next := make(map[string]struct{}, len(old))
	for k := range old {
		next[k] = struct{}{}
	}
	delete(next, namespace.GetName())
	selectedNamespacesCache.Store(next)
	logrus.Infof("removed namespace from watch: %s", namespace.GetName())
}

// Update function to add an old object and a new object to the queue in case of updating a resource
func (c *Controller) Update(old interface{}, new interface{}) {
	c.collectors.RecordEventReceived("update", c.resource)

	switch new.(type) {
	case *v1.Namespace:
		return
	}

	if !c.resourceInIgnoredNamespace(new) && c.resourceInSelectedNamespaces(new) {
		c.enqueue(handler.ResourceUpdatedHandler{
			Resource:    new,
			OldResource: old,
			Collectors:  c.collectors,
			Recorder:    c.recorder,
			EnqueueTime: time.Now(),
		})
	} else {
		c.collectors.RecordSkipped("ignored_or_not_selected")
	}
}

// Delete function to add an object to the queue in case of deleting a resource
func (c *Controller) Delete(old interface{}) {
	c.collectors.RecordEventReceived("delete", c.resource)

	if _, ok := old.(*csiv1.SecretProviderClassPodStatus); ok {
		return
	}

	if options.ReloadOnDelete == "true" {
		if !c.resourceInIgnoredNamespace(old) && c.resourceInSelectedNamespaces(old) && secretControllerInitialized.Load() && configmapControllerInitialized.Load() {
			c.enqueue(handler.ResourceDeleteHandler{
				Resource:    old,
				Collectors:  c.collectors,
				Recorder:    c.recorder,
				EnqueueTime: time.Now(),
			})
		} else {
			c.collectors.RecordSkipped("ignored_or_not_selected")
		}
	}

	switch object := old.(type) {
	case *v1.Namespace:
		c.removeSelectedNamespaceFromCache(*object)
		return
	}
}

// enqueue adds an item to the queue and records metrics
func (c *Controller) enqueue(item interface{}) {
	c.queue.Add(item)
	c.collectors.RecordQueueAdd()
	c.collectors.SetQueueDepth(c.queue.Len())
}

// Run function for controller which handles the queue
func (c *Controller) Run(threadiness int, stopCh chan struct{}) {
	defer runtime.HandleCrash()

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		c.informer.Run(stopCh)
	}()

	// Wait for all involved caches to be synced, before processing items from the queue is started
	if !cache.WaitForCacheSync(stopCh, c.informer.HasSynced) {
		runtime.HandleError(fmt.Errorf("timed out waiting for caches to sync"))
		c.queue.ShutDown()
		wg.Wait()
		return
	}

	for i := 0; i < threadiness; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			wait.Until(c.runWorker, time.Second, stopCh)
		}()
	}

	<-stopCh
	logrus.Infof("Stopping Controller for %s", c.resource)
	c.queue.ShutDown() // unblock workers so they drain and exit
	logrus.Infof("Queue shut down for %s, waiting for goroutines", c.resource)
	wg.Wait() // block unti
```

### Core Architecture Module: `internal/pkg/crypto/sha.go`
```
package crypto

import (
	"crypto/sha1"
	"fmt"
	"io"

	"github.com/sirupsen/logrus"
)

// GenerateSHA generates SHA from string
func GenerateSHA(data string) string {
	hasher := sha1.New()
	_, err := io.WriteString(hasher, data)
	if err != nil {
		logrus.Errorf("Unable to write data in hash writer %v", err)
	}
	sha := hasher.Sum(nil)
	return fmt.Sprintf("%x", sha)
}

```

### Core Architecture Module: `internal/pkg/handler/create.go`
```
package handler

import (
	"time"

	"github.com/sirupsen/logrus"
	v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/tools/record"

	"github.com/stakater/Reloader/internal/pkg/metrics"
	"github.com/stakater/Reloader/internal/pkg/options"
	"github.com/stakater/Reloader/pkg/common"
)

// ResourceCreatedHandler contains new objects
type ResourceCreatedHandler struct {
	Resource    interface{}
	Collectors  metrics.Collectors
	Recorder    record.EventRecorder
	EnqueueTime time.Time // Time when this handler was added to the queue
}

// GetEnqueueTime returns when this handler was enqueued
func (r ResourceCreatedHandler) GetEnqueueTime() time.Time {
	return r.EnqueueTime
}

// Handle processes the newly created resource
func (r ResourceCreatedHandler) Handle() error {
	startTime := time.Now()
	result := "error"

	defer func() {
		r.Collectors.RecordReconcile(result, time.Since(startTime))
	}()

	if r.Resource == nil {
		logrus.Errorf("Resource creation handler received nil resource")
		return nil
	}

	config, _ := r.GetConfig()
	// Send webhook
	if options.WebhookUrl != "" {
		err := sendUpgradeWebhook(config, options.WebhookUrl)
		if err == nil {
			result = "success"
		}
		return err
	}
	// process resource based on its type
	err := doRollingUpgrade(config, r.Collectors, r.Recorder, invokeReloadStrategy)
	if err == nil {
		result = "success"
	}
	return err
}

// GetConfig gets configurations containing SHA, annotations, namespace and resource name
func (r ResourceCreatedHandler) GetConfig() (common.Config, string) {
	var oldSHAData string
	var config common.Config
	if cm, ok := r.Resource.(*v1.ConfigMap); ok {
		config = common.GetConfigmapConfig(cm)
	} else if secret, ok := r.Resource.(*v1.Secret); ok {
		config = common.GetSecretConfig(secret)
	} else {
		logrus.Warnf("Invalid resource: Resource should be 'Secret' or 'Configmap' but found, %v", r.Resource)
	}
	return config, oldSHAData
}

```

### Core Architecture Module: `internal/pkg/handler/delete.go`
```
package handler

import (
	"fmt"
	"slices"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/stakater/Reloader/internal/pkg/callbacks"
	"github.com/stakater/Reloader/internal/pkg/constants"
	"github.com/stakater/Reloader/internal/pkg/metrics"
	"github.com/stakater/Reloader/internal/pkg/options"
	"github.com/stakater/Reloader/internal/pkg/testutil"
	"github.com/stakater/Reloader/pkg/common"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	patchtypes "k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/tools/record"
)

// ResourceDeleteHandler contains new objects
type ResourceDeleteHandler struct {
	Resource    interface{}
	Collectors  metrics.Collectors
	Recorder    record.EventRecorder
	EnqueueTime time.Time // Time when this handler was added to the queue
}

// GetEnqueueTime returns when this handler was enqueued
func (r ResourceDeleteHandler) GetEnqueueTime() time.Time {
	return r.EnqueueTime
}

// Handle processes resources being deleted
func (r ResourceDeleteHandler) Handle() error {
	startTime := time.Now()
	result := "error"

	defer func() {
		r.Collectors.RecordReconcile(result, time.Since(startTime))
	}()

	if r.Resource == nil {
		logrus.Errorf("Resource delete handler received nil resource")
		return nil
	}

	config, _ := r.GetConfig()
	// Send webhook
	if options.WebhookUrl != "" {
		err := sendUpgradeWebhook(config, options.WebhookUrl)
		if err == nil {
			result = "success"
		}
		return err
	}
	// process resource based on its type
	err := doRollingUpgrade(config, r.Collectors, r.Recorder, invokeDeleteStrategy)
	if err == nil {
		result = "success"
	}
	return err
}

// GetConfig gets configurations containing SHA, annotations, namespace and resource name
func (r ResourceDeleteHandler) GetConfig() (common.Config, string) {
	var oldSHAData string
	var config common.Config
	if cm, ok := r.Resource.(*v1.ConfigMap); ok {
		config = common.GetConfigmapConfig(cm)
	} else if secret, ok := r.Resource.(*v1.Secret); ok {
		config = common.GetSecretConfig(secret)
	} else {
		logrus.Warnf("Invalid resource: Resource should be 'Secret' or 'Configmap' but found, %v", r.Resource)
	}
	return config, oldSHAData
}

func invokeDeleteStrategy(upgradeFuncs callbacks.RollingUpgradeFuncs, item runtime.Object, config common.Config, autoReload bool) InvokeStrategyResult {
	if options.ReloadStrategy == constants.AnnotationsReloadStrategy {
		return removePodAnnotations(upgradeFuncs, item, config, autoReload)
	}

	return removeContainerEnvVars(upgradeFuncs, item, config, autoReload)
}

func removePodAnnotations(upgradeFuncs callbacks.RollingUpgradeFuncs, item runtime.Object, config common.Config, autoReload bool) InvokeStrategyResult {
	config.SHAValue = testutil.GetSHAfromEmptyData()
	return updatePodAnnotations(upgradeFuncs, item, config, autoReload)
}

func removeContainerEnvVars(upgradeFuncs callbacks.RollingUpgradeFuncs, item runtime.Object, config common.Config, autoReload bool) InvokeStrategyResult {
	envVar := getEnvVarName(config.ResourceName, config.Type)
	container := getContainerUsingResource(upgradeFuncs, item, config, autoReload)

	if container == nil {
		return InvokeStrategyResult{constants.NoContainerFound, nil}
	}

	// remove if env var exists
	if len(container.Env) > 0 {
		index := slices.IndexFunc(container.Env, func(envVariable v1.EnvVar) bool {
			return envVariable.Name == envVar
		})
		if index != -1 {
			var patch []byte
			if upgradeFuncs.SupportsPatch {
				containers := upgradeFuncs.ContainersFunc(item)
				containerIndex := slices.IndexFunc(containers, func(c v1.Container) bool {
					return c.Name == container.Name
				})
				patch = fmt.Appendf(nil, upgradeFuncs.PatchTemplatesFunc().DeleteEnvVarTemplate, containerIndex, index)
			}

			container.Env = append(container.Env[:index], container.Env[index+1:]...)
			return InvokeStrategyResult{constants.Updated, &Patch{Type: patchtypes.JSONPatchType, Bytes: patch}}
		}
	}

	return InvokeStrategyResult{constants.NotUpdated, nil}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1237** (2026-09-30): **chore: add v2 announcement and master feature freeze notice to README**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 142 burst updates, each triggers 1 dep... | 142/142 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 146 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36714818341)

- **Issue #1236** (2026-09-30): **chore: add v2 announcement and master feature freeze notice to README**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 142 burst updates, each triggers 1 dep... | 141/142 | 0 | | ✅ | **S4** | S4: 0 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 141 updates during restart | 140 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36714814845)

- **Issue #1235** (2026-09-29): **feat(chart): render image fields with tpl**
  *Symptoms*: Same change as #1234 on master, ported to v2: the chart's `image.repository`, `image.tag` and `image.digest` are now rendered through `tpl`, the way the `stakater/application` chart already allows for its image fields.  This lets a wrapper chart point Reloader's image at a value a packaging platform rewrites — specifically Azure marketplace's `global.azure.images`, needed for the Azure marketplace listing.  Default rendering is unchanged, and the tag still defaults to the chart's `appVersion` (v2's existing convention, kept inside the `tpl` call).  Chart bumped 3.0.0-beta.1 -> 3.0.0-beta.2, since 3.0.0-beta.1 is the version currently published (per PR #1230).
  **Post-Mortem & Fix Analysis**:
  > NOTES.txt now renders .Values.image.repository with tpl before comparing it to "ghcr.io/stakater/reloader". Checked with `helm install --dry-run=client` for the three cases: a templated repository resolving to ghcr.io/stakater/reloader with enterprise.enabled=true shows the warning; the same resolving to another repository shows no warning; defaults with enterprise.enabled=true still show the warning. The two test digests in tests/deployment_test.yaml are now 64 hex characters.

- **Issue #1234** (2026-09-30): **chore(chart): render image fields with tpl**
  *Symptoms*: The image repository, tag and digest can now reference other values, the way the stakater/application chart already allows. Needed so a wrapper chart can point Reloader at a value the packaging platform rewrites (Azure marketplace's global.azure.images). Default rendering is unchanged.
  **Post-Mortem & Fix Analysis**:
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 143/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 136 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36423171506)
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 143/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 145 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36530757353)
  > Added two helm-unittest cases to tests/deployment_test.yaml: "renders a templated repository and digest through tpl" and "renders a templated repository and tag through tpl when no digest is set".

- **Issue #1233** (2026-09-29): **ci: enforce semantic PR title prefixes**
  *Symptoms*: ## Problem  `v2` is now the development branch and `master` is frozen for fixes and chores only. PR title rules need to be enforced on both branches, and GitHub loads PR workflows from the target branch, so the check has to exist on v2 too.  ## Solution  Adds `pr-title.yaml`, identical to the one in the master PR. On `v**` it accepts `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `ci`, `build`, `revert` (scope and `!` allowed). The bot comment only fires for master PRs. Also adds the "Branches and PR titles" README section.   Also fixes the PR build: the UBI builder image came from the highest tag with its suffix stripped, so `v2.0.0-beta.1` became `v2.0.0`, an image that does not exist. It now uses the highest `v2.*` tag as is.  ## Before/After  | Title into v2 | Before | After | |---|---|---| | `feat(chart): add X` | passes | passes | | `feat!: drop old API` | passes | passes | | `chart: foo` | passes | fails, no conventional prefix |  After merging, mark `semantic-prefix` as a required check on v2. 
  **Post-Mortem & Fix Analysis**:
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 142 burst updates, each triggers 1 dep... | 142/142 | 0 | | ✅ | **S4** | S4: 0 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 135 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36112562492)
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 142 burst updates, each triggers 1 dep... | 141/142 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 136 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36115550483)
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 143/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 136 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36118938036)

- **Issue #1232** (2026-09-29): **chore: enforce PR title prefixes for the master feature freeze**
  *Symptoms*: ## Problem  `master` is going into feature freeze while `v2` becomes the development branch, but nothing enforces it. Contributors from forks keep opening feature PRs against master. Separately, master's chart version gate compares against the newest chart in the shared Helm repo, so it will break once v2 publishes a stable 3.x chart.  ## Solution  | Change | Why | |---|---| | New `pr-title.yaml`: master accepts only `fix:` / `chore:`, `v**` accepts all conventional types | Enforces the freeze. Failing master PRs get one bot comment explaining the freeze and linking the README | | Chart gate uses `helm search repo stakater/reloader --version '^2'` | Master stays on 2.x; without the pin `2.2.18` would be compared to `3.0.0` and fail | | Enterprise dispatch skips `chart-v*` releases (ported from v2) | A chart release was triggering an enterprise build for a chart tag | | Renovate `semanticCommits: enabled` | Renovate PRs become `chore(deps): ...` and pass the title check | | README "Branches and PR titles" section, CLAUDE.md branch policy | Where the bot comment points | | UBI builder image in `pull_request.yaml` taken from the highest stable `v1.*` tag | The `v2.0.0-beta.1` tag was picked and stripped to `v2.0.0`, an image that does not exist, so every PR build failed |  `pr-title.yaml` uses `pull_request_target` so it can comment on fork PRs. It never checks out PR code and the title only reaches the shell through `env`.  ## Before/After  | | Before | After | |---|---|---| | 
  **Post-Mortem & Fix Analysis**:
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 143/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 141 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36112557104)
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 143/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 142 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36115545240)
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 143/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 145 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/36118934385)

- **Issue #1230** (2026-09-23): **ci: allow prerelease chart versions, and publish chart 3.0.0-beta.1**
  *Symptoms*: Publishes chart `3.0.0-beta.1` (appVersion `v2.0.0-beta.1`) by fixing the CI gate that made prerelease chart versions impossible to publish.  ## Problem  The chart version and appVersion have been correct on `v2` for a while, but the chart was never published: `push-helm-chart.yaml` only runs for a merged PR that both touches the chart path and carries the `release/helm-chart` label.  Opening that PR then surfaced the real problem. Both the PR check and the publish job gate on `check-semver-increased-action`, which defaults `allow-pre-release` to `false`, so it rejected the beta outright instead of comparing it:  ``` current-version: 3.0.0-beta.1 previous-version: 2.2.17 allow-pre-release: False Error: currentVersion is not valid. previousVersion is valid. ```  No prerelease chart version could ever have been published.  ## Solution  `allow-pre-release: true` in both places, since the same gate runs twice:  | File | Runs on | |---|---| | `pull_request-helm.yaml` | PR validation | | `push-helm-chart.yaml` | the publish job |  Fixing only the first would pass the PR and then fail the actual publish.  The version gate still works. `helm search repo --devel` includes prereleases, so a beta bump is still required to increase.  Merging this publishes chart `3.0.0-beta.1`, since `push-helm-chart.yaml` is itself inside that workflow's path filter and the PR carries the `release/helm-chart` label.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 143/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 135 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/35841390644)
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 142/143 | 0 | | ✅ | **S4** | S4: 0 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 145 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/35841661801)

- **Issue #1229** (2026-09-23): **ci: dispatch the enterprise build for prereleases, and remove CLAUDE.md**
  *Symptoms*: ## Problem  The enterprise dispatch skipped every prerelease:  ```yaml if: ${{ !github.event.release.prerelease && !startsWith(github.event.release.tag_name, 'chart-v') }} ```  Tagging `v2.0.0-beta.1` would publish the OSS image and create the GitHub prerelease, but never dispatch the enterprise build for that tag.  ## Solution  Drop the prerelease condition, keep the chart one:  ```yaml if: ${{ !startsWith(github.event.release.tag_name, 'chart-v') }} ```  The `chart-v` check has to stay, and it becomes load bearing. `release-helm-chart.yaml` publishes chart tags as GitHub releases too, and this workflow fires on any published release, so without that check a `chart-v3.0.0-beta.1` tag would dispatch and build an image named after a chart version. Until now the prerelease condition happened to mask chart betas as well, since those are also marked prerelease.  ## Before / After  | Tag | Before | After | |---|---|---| | `v1.4.22` | dispatches | dispatches | | `v2.0.0-beta.1` | **skipped** | dispatches | | `chart-v3.0.0-beta.1` | skipped | skipped |  ## Also  Deletes `CLAUDE.md`. It will be regenerated.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 142 burst updates, each triggers 1 dep... | 140/142 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 140 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/35827886003)
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 141/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 140 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/35829903175)
  > ## :white_check_mark: Load Test Results (quick)  ## ✅ Load Test Results: ALL TESTS PASSED  > 🚀 **Quick Test** (S1, S4, S6) — Use `/loadtest` for full suite  **3/3 passed** (100%)  | | Scenario | Description | Actions | Errors | |:-:|:--------:|-------------|:-------:|:------:| | ✅ | **S1** | S1: 143 burst updates, each triggers 1 dep... | 143/143 | 0 | | ✅ | **S4** | S4: 143 no-op updates, all should be skipped | 0 | 0 | | ✅ | **S6** | S6: Restart test - 142 updates during restart | 136 | 0 |  📦 **[Download detailed results](../artifacts)**   --- **Artifacts:** [Download](https://github.com/stakater/Reloader/actions/runs/35830187766)

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

### Incident Patch 1: `fdd50121` (2026-10-02)
**Commit Message**: Merge pull request #1220 from kaanisthatyou/fix/resume-timer-cleanup

fix: remove the resume timer before resuming a paused deployment

**File**: `internal/pkg/handler/pause_deployment.go` (modified, +9/-8)
```diff
@@ -179,6 +179,15 @@ func CreateResumeTimer(deployment *app.Deployment, clients kube.Clients, namespa
 func ResumeDeployment(deployment *app.Deployment, namespace string, clients kube.Clients) {
 	deploymentName := deployment.Name
 
+	// Remove the timer first: if this attempt fails, a later change to the
+	// deployment must find no timer, so that HandleMissingTimer retries the resume.
+	timerKey := getTimerKey(namespace, deploymentName)
+	if timer, exists := activeTimers[timerKey]; exists {
+		timer.Stop()
+		delete(activeTimers, timerKey)
+		logrus.Debugf("Removed pause timer for deployment '%s' in namespace '%s'", deploymentName, namespace)
+	}
+
 	currentDeployment, err := clients.KubernetesClient.AppsV1().Deployments(namespace).Get(context.TODO(), deploymentName, metav1.GetOptions{})
 
 	if err != nil {
@@ -199,14 +208,6 @@ func ResumeDeployment(deployment *app.Deployment, namespace string, clients kube
 		return
 	}
 
-	// Remove the timer
-	timerKey := getTimerKey(namespace, deploymentName)
-	if timer, exists := activeTimers[timerKey]; exists {
-		timer.Stop()
-		delete(activeTimers, timerKey)
-		logrus.Debugf("Removed pause timer for deployment '%s' in namespace '%s'", deploymentName, namespace)
-	}
-
 	err = deploymentFuncs.PatchFunc(clients, namespace, currentDeployment, patchtypes.StrategicMergePatchType, resumePatch)
 
 	if err != nil {
```

**File**: `internal/pkg/handler/pause_deployment_test.go` (modified, +99/-0)
```diff
@@ -2,6 +2,7 @@ package handler
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"testing"
 	"time"
@@ -12,6 +13,7 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	testclient "k8s.io/client-go/kubernetes/fake"
+	clienttesting "k8s.io/client-go/testing"
 
 	"github.com/stakater/Reloader/internal/pkg/options"
 	"github.com/stakater/Reloader/pkg/kube"
@@ -285,6 +287,103 @@ func TestHandleMissingTimerSimple(t *testing.T) {
 	}
 }
 
+func TestResumeDeploymentRecoversAfterFailedGet(t *testing.T) {
+	deployment := &appsv1.Deployment{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "test-deployment",
+			Namespace: "default",
+			Annotations: map[string]string{
+				options.PauseDeploymentTimeAnnotation: time.Now().Add(-6 * time.Minute).Format(time.RFC3339),
+				options.PauseDeploymentAnnotation:     "5m",
+			},
+		},
+		Spec: appsv1.DeploymentSpec{
+			Paused: true,
+		},
+	}
+	fakeClient := testclient.NewClientset(deployment)
+	clients := kube.Clients{KubernetesClient: fakeClient}
+
+	timerKey := getTimerKey("default", deployment.Name)
+	activeTimers[timerKey] = time.NewTimer(time.Hour)
+	defer func() {
+		for key, timer := range activeTimers {
+			timer.Stop()
+			delete(activeTimers, key)
+		}
+	}()
+
+	// The API server is unavailable when the resume timer fires.
+	failGet := true
+	fakeClient.PrependReactor("get", "deployments", func(clienttesting.Action) (bool, runtime.Object, error) {
+		if failGet {
+			return true, nil, errors.New("apiserver unavailable")
+		}
+		return false, nil, nil
+	})
+	ResumeDeployment(deployment, "default", clients)
+
+	_, timerExists := activeTimers[timerKey]
+	assert.False(t, timerExists, "Timer should be removed even if the resume fails")
+
+	// The next change to the deployment recovers through HandleMissingTimer.
+	failGet = false
+	_, err := PauseDeployment(deployment, clients, "default", deployment.Annotations[options.PauseDeploymentAnnotation])
+	assert.NoError(t, err)
+
+	updatedDeployment, err := fakeClient.AppsV1().Deployments("default").Get(context.TODO(), deployment.Name, metav1.GetOptions{})
+	assert.NoError(t, err)
+	assert.False(t, updatedDeployment.Spec.Paused, "Deployment should be resumed after the failed attempt")
+}
+
+func TestResumeDeploymentRecoversAfterManualResume(t *testing.T) {
+	pausedDeployment := &appsv1.Deployment{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "test-deployment",
+			Namespace: "default",
+			Annotations: map[string]string{
+				options.PauseDeploymentTimeAnnotation: time.Now().Add(-6 * time.Minute).Format(time.RFC3339),
+				options.PauseDeploymentAnnotation:     "5m",
+			},
+		},
+		Spec: appsv1.DeploymentSpec{
+			Paused: true,
+		},
+	}
+	// The deployment was un-paused by hand before the resume timer fired.
+	resumedDeployment := pausedDeployment.DeepCopy()
+	resumedDeployment.Spec.Paused = false
+	fakeClient := testclient.NewClientset(resumedDeployment)
+	clients := kube.Clients{KubernetesClient: fakeClient}
+
+	timerKey := getTimerKey("default", pausedDeployment.Name)
+	staleTimer := time.NewTimer(time.Hour)
+	activeTimers[timerKey] = staleTimer
+	defer func() {
+		for key, timer := range activeTimers {
+			timer.Stop()
+			delete(activeTimers, key)
+		}
+	}()
+
+	ResumeDeployment(pausedDeployment, "default", clients)
+
+	_, timerExists := activeTimers[timerKey]
+	assert.False(t, timerExists, "Timer should be removed even if the deployment is no longer paused by reloader")
+
+	// The next change pauses the deployment again and must get a fresh resume timer.
+	_, err := PauseDeployment(resumedDeployment, clients, "default", resumedDeployment.Annotations[options.PauseDeploymentAnnotation])
+	assert.NoError(t, err)
+
+	updatedDeployment, err := fakeClient.AppsV1().Deployments("default").Get(context.TODO(), resumedDeployment.Name, metav1.GetOptions{})
+	assert.NoError(t, err)
+	assert.True(t, updatedDeployment.Spec.Paused, "Deployment should be paused by the new change")
+
+	timer, timerExists := activeTimers[timerKey]
+	assert.True(t, timerExists, "A resume timer should exist for the new pause")
+	assert.NotSame(t, staleTimer, timer, "The resume timer should not be the stale one")
+}
+
 func TestPauseDeployment(t *testing.T) {
 	tests := []struct {
 		name               string
```

---

### Incident Patch 2: `06f7c458` (2026-09-28)
**Commit Message**: chart: render image repository, tag and digest with tpl

**File**: `deployments/kubernetes/chart/reloader/Chart.yaml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 apiVersion: v1
 name: reloader
 description: Reloader chart that runs on kubernetes
-version: 2.2.17
+version: 2.2.18
 appVersion: v1.4.22
 keywords:
   - Reloader
```

**File**: `deployments/kubernetes/chart/reloader/templates/deployment.yaml` (modified, +7/-4)
```diff
@@ -85,13 +85,16 @@ spec:
       {{- toYaml . | nindent 8 }}
       {{- end }}
       containers:
+      {{- $repository := tpl (.Values.image.repository | toString) . }}
+      {{- $tag := tpl (.Values.image.tag | toString) . }}
+      {{- $digest := tpl (.Values.image.digest | default "" | toString) . }}
       {{- if .Values.global.imageRegistry }}
-      - image: "{{ .Values.global.imageRegistry }}/{{ .Values.image.name }}:{{ .Values.image.tag }}"
+      - image: "{{ .Values.global.imageRegistry }}/{{ .Values.image.name }}:{{ $tag }}"
       {{- else }}
-      {{- if .Values.image.digest }}
-      - image: "{{ .Values.image.repository }}@{{ .Values.image.digest }}"
+      {{- if $digest }}
+      - image: "{{ $repository }}@{{ $digest }}"
       {{- else }}
-      - image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
+      - image: "{{ $repository }}:{{ $tag }}"
       {{- end }}
       {{- end }}
         imagePullPolicy: {{ .Values.image.pullPolicy }}
```

**File**: `deployments/kubernetes/chart/reloader/values.yaml` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ image:
   repository: ghcr.io/stakater/reloader
   tag: v1.4.22
   # digest: sha256:1234567
+  # repository, tag and digest are rendered with tpl, so they may reference other values.
   pullPolicy: IfNotPresent
 
 reloader:
```

**File**: `deployments/kubernetes/templates/chart/values.yaml.tmpl` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ reloader:
     image:
       name: {{ getenv "DOCKER_IMAGE" }}
       tag: "{{ getenv "VERSION" }}"
+      # repository, tag and digest are rendered with tpl, so they may reference other values.
       pullPolicy: IfNotPresent
     # Support for extra environment variables.
     env:
```

---

### Incident Patch 3: `892d41d6` (2026-09-25)
**Commit Message**: fix: pick the UBI builder image from this branch's major version tags

**File**: `.github/workflows/pull_request.yaml` (modified, +4/-3)
```diff
@@ -74,12 +74,13 @@ jobs:
       run: echo "created=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> $GITHUB_OUTPUT
 
 
-    # Get highest tag and remove any suffixes with '-'
+    # Highest stable v1 tag, used as the UBI builder image. master stays on v1,
+    # so v2 tags (including prereleases like v2.0.0-beta.1) must not be picked.
     - name: Get Highest tag
       id: highest_tag
       run: |
-        highest=$(git tag -l --sort -version:refname | head -n 1)
-        echo "tag=${highest%%-*}" >> $GITHUB_OUTPUT
+        highest=$(git tag -l 'v1.*' --sort -version:refname | grep -v -e '-' | head -n 1)
+        echo "tag=${highest}" >> $GITHUB_OUTPUT
 
     - name: Install Dependencies
       run: |
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -215,7 +215,7 @@ The `reloader.stakater.com/search` annotation on a workload pairs with `reloader
 
 **Helm chart**: `deployments/kubernetes/chart/reloader/` — install via Helm or `kubectl apply -f deployments/kubernetes/reloader.yaml`.
 
-**Branch policy**: `master` is in feature freeze, `pr-title.yaml` only lets `fix:` and `chore:` PR titles through. New features go to `v2`. The master chart stays on 2.x, so its version gate compares against `helm search repo stakater/reloader --version '^2'`, not the newest chart (v2 publishes 3.x to the same repo).
+**Branch policy**: `master` is in feature freeze, `pr-title.yaml` only lets `fix:` and `chore:` PR titles through. New features go to `v2`. The master chart stays on 2.x, so its version gate compares against `helm search repo stakater/reloader --version '^2'`, not the newest chart (v2 publishes 3.x to the same repo). Likewise the UBI builder image in `pull_request.yaml` comes from the highest stable `v1.*` tag.
 
 ---
 
```

---

### Incident Patch 4: `02c536f3` (2026-09-25)
**Commit Message**: chore: enforce PR title prefixes for the master feature freeze

Add pr-title.yaml: master accepts only fix and chore titles, v2 accepts all conventional types. Failing master PRs get a one time comment pointing to the README.
Pin the master chart version gate to 2.x so it keeps working once v2 publishes a stable 3.x chart.
Skip the enterprise dispatch for chart-v releases.
Enable Renovate semantic commits so its PRs pass the title check.

**File**: `.github/workflows/pr-title.yaml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+name: PR Title
+
+# pull_request_target so the comment step also works on fork PRs.
+# Safe because nothing from the PR is checked out, the title only reaches the shell via env.
+on:
+  pull_request_target:
+    types: [opened, edited, synchronize, reopened]
+    branches:
+      - master
+      - 'v**'
+
+permissions:
+  pull-requests: write
+
+jobs:
+  semantic-prefix:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Check semantic prefix
+        env:
+          TITLE: ${{ github.event.pull_request.title }}
+          BASE: ${{ github.base_ref }}
+        run: |
+          # master is in feature freeze, only fixes and chores land there.
+          if [ "$BASE" = master ]; then
+            pattern='^(fix|chore)(\([a-z0-9./_-]+\))?: .+'
+          else
+            pattern='^(feat|fix|chore|docs|refactor|perf|test|ci|build|revert)(\([a-z0-9./_-]+\))?!?: .+'
+          fi
+          if ! printf '%s' "$TITLE" | grep -qE "$pattern"; then
+            echo "::error::PR title \"$TITLE\" must match $pattern for base branch $BASE"
+            exit 1
+          fi
+
+      - name: Explain the master freeze
+        if: failure() && github.base_ref == 'master'
+        env:
+          GH_TOKEN: ${{ github.token }}
+          PR: ${{ github.event.pull_request.number }}
+          BODY: |
+            <!-- pr-title-freeze -->
+            👋 Thanks for the PR! `master` is in feature freeze and only accepts `fix:` and `chore:` PRs.
+
+            - Bug fix or maintenance: rename the title to start with `fix:` or `chore:` (e.g. `fix(chart): ...`).
+            - New feature: please retarget this PR to the `v2` branch, which is where new development happens.
+
+            See [Branches and PR titles](https://github.com/stakater/Reloader/blob/master/README.md#branches-and-pr-titles) for details.
+        run: |
+          # Marker keeps it to one comment per PR, however many times the title is edited.
+          if ! gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate --jq '.[].body' | grep -q 'pr-title-freeze'; then
+            gh pr comment "$PR" --repo "$GITHUB_REPOSITORY" --body "$BODY"
+          fi
```

**File**: `.github/workflows/pull_request-helm.yaml` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ jobs:
     - name: Get version for chart from helm repo
       id: chart_eval
       run: |
-        current_chart_version=$(helm search repo stakater/reloader | tail -n 1 | awk '{print $2}')
+        current_chart_version=$(helm search repo stakater/reloader --version '^2' | tail -n 1 | awk '{print $2}')
         echo "CURRENT_CHART_VERSION=$(echo ${current_chart_version})" >> $GITHUB_OUTPUT
 
     - name: Get Updated Chart version from Chart.yaml
```

**File**: `.github/workflows/push-helm-chart.yaml` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ jobs:
       - name: Get version for chart from helm repo
         id: chart_eval
         run: |
-          current_chart_version=$(helm search repo stakater/reloader | tail -n 1 | awk '{print $2}')
+          current_chart_version=$(helm search repo stakater/reloader --version '^2' | tail -n 1 | awk '{print $2}')
           echo "CURRENT_CHART_VERSION=$(echo ${current_chart_version})" >> $GITHUB_OUTPUT
 
       - name: Get Updated Chart version from Chart.yaml
```

**File**: `.github/workflows/reloader-enterprise-published.yml` (modified, +3/-0)
```diff
@@ -9,6 +9,9 @@ permissions: {}
 
 jobs:
   dispatch:
+    # Skip chart releases. release-helm-chart.yaml publishes those as GitHub
+    # releases too, and a chart tag carries no operator source to build.
+    if: ${{ !startsWith(github.event.release.tag_name, 'chart-v') }}
     runs-on: ubuntu-latest
     steps:
       - name: Trigger target repository workflow
```

**File**: `CLAUDE.md` (modified, +2/-0)
```diff
@@ -215,6 +215,8 @@ The `reloader.stakater.com/search` annotation on a workload pairs with `reloader
 
 **Helm chart**: `deployments/kubernetes/chart/reloader/` — install via Helm or `kubectl apply -f deployments/kubernetes/reloader.yaml`.
 
+**Branch policy**: `master` is in feature freeze, `pr-title.yaml` only lets `fix:` and `chore:` PR titles through. New features go to `v2`. The master chart stays on 2.x, so its version gate compares against `helm search repo stakater/reloader --version '^2'`, not the newest chart (v2 publishes 3.x to the same repo).
+
 ---
 
 ## Coding Conventions
```

**File**: `README.md` (modified, +7/-0)
```diff
@@ -493,6 +493,13 @@ Join and talk to us on Slack for discussing Reloader:
 
 ## Contributing
 
+### Branches and PR titles
+
+- `master` is in feature freeze and only accepts `fix:` and `chore:` PRs.
+- `v2` is the development branch, new features go there.
+
+PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/), e.g. `fix(chart): correct probe port`. Allowed prefixes on `v2`: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `ci`, `build`, `revert`.
+
 ### Bug Reports & Feature Requests
 
 Please use the [issue tracker](https://github.com/stakater/Reloader/issues) to report any bugs or file feature requests.
```

**File**: `renovate.json` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
     "dependencies"
   ],
   "baseBranches": ["master", "v2"],
+  "semanticCommits": "enabled",
   "rebaseWhen": "never",
   "vulnerabilityAlerts": {
     "enabled": true,
```

---

### Incident Patch 5: `583de2f9` (2026-09-14)
**Commit Message**: fix: remove the resume timer before resuming a paused deployment

ResumeDeployment removed the timer entry only after it had fetched the
deployment. If that Get failed, the already-fired timer stayed in
activeTimers, so PauseDeployment never called HandleMissingTimer again
and the deployment stayed paused.

Fixes #1219

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01EcwjgZmx8zbtn6PpwDY9A1

**File**: `internal/pkg/handler/pause_deployment.go` (modified, +9/-8)
```diff
@@ -179,6 +179,15 @@ func CreateResumeTimer(deployment *app.Deployment, clients kube.Clients, namespa
 func ResumeDeployment(deployment *app.Deployment, namespace string, clients kube.Clients) {
 	deploymentName := deployment.Name
 
+	// Remove the timer first: if this attempt fails, a later change to the
+	// deployment must find no timer, so that HandleMissingTimer retries the resume.
+	timerKey := getTimerKey(namespace, deploymentName)
+	if timer, exists := activeTimers[timerKey]; exists {
+		timer.Stop()
+		delete(activeTimers, timerKey)
+		logrus.Debugf("Removed pause timer for deployment '%s' in namespace '%s'", deploymentName, namespace)
+	}
+
 	currentDeployment, err := clients.KubernetesClient.AppsV1().Deployments(namespace).Get(context.TODO(), deploymentName, metav1.GetOptions{})
 
 	if err != nil {
@@ -199,14 +208,6 @@ func ResumeDeployment(deployment *app.Deployment, namespace string, clients kube
 		return
 	}
 
-	// Remove the timer
-	timerKey := getTimerKey(namespace, deploymentName)
-	if timer, exists := activeTimers[timerKey]; exists {
-		timer.Stop()
-		delete(activeTimers, timerKey)
-		logrus.Debugf("Removed pause timer for deployment '%s' in namespace '%s'", deploymentName, namespace)
-	}
-
 	err = deploymentFuncs.PatchFunc(clients, namespace, currentDeployment, patchtypes.StrategicMergePatchType, resumePatch)
 
 	if err != nil {
```

**File**: `internal/pkg/handler/pause_deployment_test.go` (modified, +51/-0)
```diff
@@ -2,6 +2,7 @@ package handler
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"testing"
 	"time"
@@ -12,6 +13,7 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	testclient "k8s.io/client-go/kubernetes/fake"
+	clienttesting "k8s.io/client-go/testing"
 
 	"github.com/stakater/Reloader/internal/pkg/options"
 	"github.com/stakater/Reloader/pkg/kube"
@@ -285,6 +287,55 @@ func TestHandleMissingTimerSimple(t *testing.T) {
 	}
 }
 
+func TestResumeDeploymentRetriesAfterFailedGet(t *testing.T) {
+	deployment := &appsv1.Deployment{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "test-deployment",
+			Namespace: "default",
+			Annotations: map[string]string{
+				options.PauseDeploymentTimeAnnotation: time.Now().Add(-6 * time.Minute).Format(time.RFC3339),
+				options.PauseDeploymentAnnotation:     "5m",
+			},
+		},
+		Spec: appsv1.DeploymentSpec{
+			Paused: true,
+		},
+	}
+	fakeClient := testclient.NewClientset(deployment)
+	clients := kube.Clients{KubernetesClient: fakeClient}
+
+	timerKey := getTimerKey("default", deployment.Name)
+	activeTimers[timerKey] = time.NewTimer(time.Hour)
+	defer func() {
+		for key, timer := range activeTimers {
+			timer.Stop()
+			delete(activeTimers, key)
+		}
+	}()
+
+	// The API server is unavailable when the resume timer fires.
+	failGet := true
+	fakeClient.PrependReactor("get", "deployments", func(clienttesting.Action) (bool, runtime.Object, error) {
+		if failGet {
+			return true, nil, errors.New("apiserver unavailable")
+		}
+		return false, nil, nil
+	})
+	ResumeDeployment(deployment, "default", clients)
+
+	_, timerExists := activeTimers[timerKey]
+	assert.False(t, timerExists, "Timer should be removed even if the resume fails")
+
+	// The next change to the deployment recovers through HandleMissingTimer.
+	failGet = false
+	_, err := PauseDeployment(deployment, clients, "default", deployment.Annotations[options.PauseDeploymentAnnotation])
+	assert.NoError(t, err)
+
+	updatedDeployment, err := fakeClient.AppsV1().Deployments("default").Get(context.TODO(), deployment.Name, metav1.GetOptions{})
+	assert.NoError(t, err)
+	assert.False(t, updatedDeployment.Spec.Paused, "Deployment should be resumed after the failed attempt")
+}
+
 func TestPauseDeployment(t *testing.T) {
 	tests := []struct {
 		name               string
```

---

### Incident Patch 6: `5d1bb7f5` (2026-08-28)
**Commit Message**: Address review: fix no-op chart assertions, document enableHA gate, serialize durations as strings

helm-unittest notContains compares whole array elements, so the prefix
assertions on the leader election args never matched. Assert the exact
rendered args instead; notMatchRegex rejects array paths and
notMatchRegexRaw never fails against a rendered manifest.

Document the --enable-ha=true gate change in the chart README.

Serialize the leader election timings into the meta-info ConfigMap as
duration strings rather than raw nanoseconds.

**File**: `deployments/kubernetes/chart/reloader/README.md` (modified, +14/-0)
```diff
@@ -166,11 +166,25 @@ helm uninstall {{RELEASE_NAME}} -n {{NAMESPACE}}
 ❌ Updates during leader downtime are missed
 ⏳ Potential 15s delay window (default `LeaseDuration`)
 
+#### 🗳️ `enableHA` Behavior
+**When true:**
+✅ `--enable-ha=true` and the `POD_NAME`/`POD_NAMESPACE` env vars are rendered
+✅ The `coordination.k8s.io` Lease RBAC is rendered when `reloader.rbac.enabled` is `true`
+✅ The default pod anti-affinity is rendered unless custom affinity is configured
+✅ `reloader.deployment.replicas` is honored, and any `reloader.leaderElection.*` timings are passed to the binary
+
+**When false:**
+❌ `reloader.deployment.replicas` is clamped to `1`, whatever value is set
+❌ `reloader.leaderElection.*` timings are ignored
+
+> ⚠️ **Behavior change:** earlier chart versions emitted `--enable-ha=true` whenever `reloader.deployment.replicas > 1`, even with `reloader.enableHA: false`. Every other HA component stayed gated on `enableHA` alone, so the pod rendered without `POD_NAME` and the binary exited with `POD_NAME not set, cannot run in HA mode without POD_NAME set`, leaving it in `CrashLoopBackOff`. The flag is now gated on `enableHA` alone. Raising `replicas` by itself therefore leaves HA off, consistent with the existing replica clamp. Setting `reloader.enableHA: true` is unaffected.
+
 #### Default Settings
 ⚠️ All flags default to `false` (must be enabled explicitly):
 - `reloadOnCreate`
 - `reloadOnDelete`
 - `syncAfterRestart`
+- `enableHA`
 
 ### Deprecation Notice
 - `serviceMonitor` will be removed in future releases in favor of `PodMonitor`
```

**File**: `deployments/kubernetes/chart/reloader/tests/deployment_test.yaml` (modified, +12/-24)
```diff
@@ -159,15 +159,12 @@ tests:
         leaderElection:
           leaseDuration: 30s
     asserts:
-      - contains:
-          path: spec.template.spec.containers[0].args
-          content: "--leader-election-lease-duration=30s"
-      - notContains:
-          path: spec.template.spec.containers[0].args
-          content: "--leader-election-renew-deadline="
-      - notContains:
+      - equal:
           path: spec.template.spec.containers[0].args
-          content: "--leader-election-retry-period="
+          value:
+            - "--log-level=info"
+            - "--enable-ha=true"
+            - "--leader-election-lease-duration=30s"
 
   - it: does not set leader election arguments when enableHA is false
     set:
@@ -178,30 +175,21 @@ tests:
           renewDeadline: 20s
           retryPeriod: 4s
     asserts:
-      - notContains:
-          path: spec.template.spec.containers[0].args
-          content: "--leader-election-lease-duration=30s"
-      - notContains:
-          path: spec.template.spec.containers[0].args
-          content: "--leader-election-renew-deadline=20s"
-      - notContains:
+      - equal:
           path: spec.template.spec.containers[0].args
-          content: "--leader-election-retry-period=4s"
+          value:
+            - "--log-level=info"
 
   - it: keeps the client-go defaults by not setting leader election arguments when enableHA is true and no timings are configured
     set:
       reloader:
         enableHA: true
     asserts:
-      - notContains:
-          path: spec.template.spec.containers[0].args
-          content: "--leader-election-lease-duration="
-      - notContains:
-          path: spec.template.spec.containers[0].args
-          content: "--leader-election-renew-deadline="
-      - notContains:
+      - equal:
           path: spec.template.spec.containers[0].args
-          content: "--leader-election-retry-period="
+          value:
+            - "--log-level=info"
+            - "--enable-ha=true"
 
   - it: template is still valid when leaderElection is null
     set:
```

**File**: `pkg/common/common.go` (modified, +9/-10)
```diff
@@ -7,7 +7,6 @@ import (
 	"regexp"
 	"strconv"
 	"strings"
-	"time"
 
 	"github.com/sirupsen/logrus"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
@@ -81,12 +80,12 @@ type ReloaderOptions struct {
 	SyncAfterRestart bool `json:"syncAfterRestart"`
 	// EnableHA indicates whether High Availability mode is enabled with leader election
 	EnableHA bool `json:"enableHA"`
-	// LeaderElectionLeaseDuration is the duration non-leader candidates wait before force acquiring leadership
-	LeaderElectionLeaseDuration time.Duration `json:"leaderElectionLeaseDuration"`
-	// LeaderElectionRenewDeadline is the duration the acting leader retries refreshing leadership before giving up
-	LeaderElectionRenewDeadline time.Duration `json:"leaderElectionRenewDeadline"`
-	// LeaderElectionRetryPeriod is the duration clients wait between attempting acquisition and renewal of leadership
-	LeaderElectionRetryPeriod time.Duration `json:"leaderElectionRetryPeriod"`
+	// LeaderElectionLeaseDuration is the duration non-leader candidates wait before force acquiring leadership, formatted as a Go duration string
+	LeaderElectionLeaseDuration string `json:"leaderElectionLeaseDuration"`
+	// LeaderElectionRenewDeadline is the duration the acting leader retries refreshing leadership before giving up, formatted as a Go duration string
+	LeaderElectionRenewDeadline string `json:"leaderElectionRenewDeadline"`
+	// LeaderElectionRetryPeriod is the duration clients wait between attempting acquisition and renewal of leadership, formatted as a Go duration string
+	LeaderElectionRetryPeriod string `json:"leaderElectionRetryPeriod"`
 	// EnableCSIIntegration indicates whether CSI integration is enabled to watch SecretProviderClassPodStatus
 	EnableCSIIntegration bool `json:"enableCSIIntegration"`
 	// WebhookUrl is the URL to send webhook notifications to instead of performing reloads
@@ -373,9 +372,9 @@ func GetCommandLineOptions() *ReloaderOptions {
 	CommandLineOptions.ReloadStrategy = options.ReloadStrategy
 	CommandLineOptions.SyncAfterRestart = options.SyncAfterRestart
 	CommandLineOptions.EnableHA = options.EnableHA
-	CommandLineOptions.LeaderElectionLeaseDuration = options.LeaderElectionLeaseDuration
-	CommandLineOptions.LeaderElectionRenewDeadline = options.LeaderElectionRenewDeadline
-	CommandLineOptions.LeaderElectionRetryPeriod = options.LeaderElectionRetryPeriod
+	CommandLineOptions.LeaderElectionLeaseDuration = options.LeaderElectionLeaseDuration.String()
+	CommandLineOptions.LeaderElectionRenewDeadline = options.LeaderElectionRenewDeadline.String()
+	CommandLineOptions.LeaderElectionRetryPeriod = options.LeaderElectionRetryPeriod.String()
 	CommandLineOptions.EnableCSIIntegration = options.EnableCSIIntegration
 	CommandLineOptions.WebhookUrl = options.WebhookUrl
 	CommandLineOptions.ResourcesToIgnore = options.ResourcesToIgnore
```

**File**: `pkg/common/common_test.go` (modified, +35/-0)
```diff
@@ -1,7 +1,9 @@
 package common
 
 import (
+	"encoding/json"
 	"testing"
+	"time"
 
 	"github.com/stakater/Reloader/internal/pkg/options"
 )
@@ -275,3 +277,36 @@ func TestShouldReload_InvalidRegexAnnotation_SkipsMalformedPattern(t *testing.T)
 		t.Errorf("Expected the malformed pattern to surface 1 error, got=%d: %v", len(result.Errors), result.Errors)
 	}
 }
+
+func TestGetCommandLineOptions_LeaderElectionTimingsAreDurationStrings(t *testing.T) {
+	origLease, origRenew, origRetry := options.LeaderElectionLeaseDuration, options.LeaderElectionRenewDeadline, options.LeaderElectionRetryPeriod
+	defer func() {
+		options.LeaderElectionLeaseDuration, options.LeaderElectionRenewDeadline, options.LeaderElectionRetryPeriod = origLease, origRenew, origRetry
+	}()
+	options.LeaderElectionLeaseDuration = 30 * time.Second
+	options.LeaderElectionRenewDeadline = 20 * time.Second
+	options.LeaderElectionRetryPeriod = 4 * time.Second
+
+	// the meta-info ConfigMap holds the marshalled options, so the timings must
+	// read as durations there rather than as raw nanoseconds
+	encoded, err := json.Marshal(GetCommandLineOptions())
+	if err != nil {
+		t.Fatalf("Expected the options to marshal, got err=%v", err)
+	}
+
+	decoded := map[string]any{}
+	if err := json.Unmarshal(encoded, &decoded); err != nil {
+		t.Fatalf("Expected the options to unmarshal, got err=%v", err)
+	}
+
+	expected := map[string]string{
+		"leaderElectionLeaseDuration": "30s",
+		"leaderElectionRenewDeadline": "20s",
+		"leaderElectionRetryPeriod":   "4s",
+	}
+	for key, want := range expected {
+		if got := decoded[key]; got != want {
+			t.Errorf("Expected %s=%q, got=%#v", key, want, got)
+		}
+	}
+}
```

---

### Incident Patch 7: `ae209c7d` (2026-08-28)
**Commit Message**: Merge pull request #1208 from nikolauspschuetz/fix/reject-non-positive-pause-duration

fix: reject non-positive pause-period durations

**File**: `internal/pkg/handler/pause_deployment.go` (modified, +5/-0)
```diff
@@ -59,6 +59,11 @@ func ParsePauseDuration(pauseIntervalValue string) (time.Duration, error) {
 		logrus.Warnf("Failed to parse pause interval value '%s': %v", pauseIntervalValue, err)
 		return 0, err
 	}
+	if pauseDuration <= 0 {
+		err = fmt.Errorf("pause interval must be positive, got '%s'", pauseIntervalValue)
+		logrus.Warn(err)
+		return 0, err
+	}
 	return pauseDuration, nil
 }
 
```

**File**: `internal/pkg/handler/pause_deployment_test.go` (modified, +12/-0)
```diff
@@ -179,6 +179,18 @@ func TestParsePauseDuration(t *testing.T) {
 			expectedDuration:   0,
 			invalidDuration:    true,
 		},
+		{
+			name:               "zero duration",
+			pauseIntervalValue: "0s",
+			expectedDuration:   0,
+			invalidDuration:    true,
+		},
+		{
+			name:               "negative duration",
+			pauseIntervalValue: "-5m",
+			expectedDuration:   0,
+			invalidDuration:    true,
+		},
 	}
 
 	for _, test := range tests {
```

---

### Incident Patch 8: `d0eb966f` (2026-08-28)
**Commit Message**: Merge pull request #1209 from stakater/fix/failing-link-check

ignore forbidden slack link from link check

**File**: `.github/md_config.json` (modified, +3/-0)
```diff
@@ -2,6 +2,9 @@
   "ignorePatterns": [
     {
       "pattern": "^(?!http).+"
+    },
+    {
+      "pattern": "^https?://([a-zA-Z0-9-]+\\.)*slack\\.com"
     }
   ],
   "retryOn429": true
```

---

### Incident Patch 9: `0e2092fa` (2026-08-26)
**Commit Message**: fix: reject non-positive pause-period durations

ParsePauseDuration parsed the pause-period annotation with only
time.ParseDuration, so "0s" or a negative value passed through. The flag
doc states only positive values are allowed, and downstream
CreateResumeTimer uses time.AfterFunc, which fires immediately for a
non-positive duration -- so a non-positive pause-period silently
degrades to no pause at all. Reject non-positive durations with a clear
error, and cover "0s"/"-5m" in TestParsePauseDuration.

Signed-off-by: Nikolaus Schuetz <[REDACTED_EMAIL]>

**File**: `internal/pkg/handler/pause_deployment.go` (modified, +5/-0)
```diff
@@ -59,6 +59,11 @@ func ParsePauseDuration(pauseIntervalValue string) (time.Duration, error) {
 		logrus.Warnf("Failed to parse pause interval value '%s': %v", pauseIntervalValue, err)
 		return 0, err
 	}
+	if pauseDuration <= 0 {
+		err = fmt.Errorf("pause interval must be positive, got '%s'", pauseIntervalValue)
+		logrus.Warn(err)
+		return 0, err
+	}
 	return pauseDuration, nil
 }
 
```

**File**: `internal/pkg/handler/pause_deployment_test.go` (modified, +12/-0)
```diff
@@ -179,6 +179,18 @@ func TestParsePauseDuration(t *testing.T) {
 			expectedDuration:   0,
 			invalidDuration:    true,
 		},
+		{
+			name:               "zero duration",
+			pauseIntervalValue: "0s",
+			expectedDuration:   0,
+			invalidDuration:    true,
+		},
+		{
+			name:               "negative duration",
+			pauseIntervalValue: "-5m",
+			expectedDuration:   0,
+			invalidDuration:    true,
+		},
 	}
 
 	for _, test := range tests {
```

---

### Incident Patch 10: `b6a6d8c6` (2026-08-10)
**Commit Message**: Merge pull request #1193 from nikolauspschuetz/fix/reload-annotation-invalid-regex-panic

fix: prevent panic on invalid regex in reload annotation

**File**: `internal/pkg/handler/upgrade.go` (modified, +4/-0)
```diff
@@ -310,6 +310,10 @@ func upgradeResource(clients kube.Clients, config common.Config, upgradeFuncs ca
 	podAnnotations := upgradeFuncs.PodAnnotationsFunc(resource)
 	result := common.ShouldReload(config, upgradeFuncs.ResourceType, annotations, podAnnotations, common.GetCommandLineOptions())
 
+	for _, reloadErr := range result.Errors {
+		logrus.Errorf("Skipping invalid reload annotation on %s '%s' in namespace '%s': %v", upgradeFuncs.ResourceType, resourceName, config.Namespace, reloadErr)
+	}
+
 	if !result.ShouldReload {
 		logrus.Debugf("No changes detected in '%s' of type '%s' in namespace '%s'", config.ResourceName, config.Type, config.Namespace)
 		return false, nil
```

**File**: `pkg/common/common.go` (modified, +12/-1)
```diff
@@ -2,6 +2,7 @@ package common
 
 import (
 	"context"
+	"fmt"
 	"os"
 	"regexp"
 	"strconv"
@@ -22,6 +23,7 @@ type Map map[string]string
 type ReloadCheckResult struct {
 	ShouldReload bool
 	AutoReload   bool
+	Errors       []error
 }
 
 // ReloaderOptions contains all configurable options for the Reloader controller.
@@ -273,14 +275,20 @@ func ShouldReload(config Config, resourceType string, annotations Map, podAnnota
 		}
 	}
 
+	var regexErrors []error
 	values := strings.Split(annotationValue, ",")
 	for _, value := range values {
 		value = strings.TrimSpace(value)
-		re := regexp.MustCompile("^" + value + "$")
+		re, err := regexp.Compile("^" + value + "$")
+		if err != nil {
+			regexErrors = append(regexErrors, fmt.Errorf("invalid regex %q in reload annotation %q: %w", value, config.Annotation, err))
+			continue
+		}
 		if re.Match([]byte(config.ResourceName)) {
 			return ReloadCheckResult{
 				ShouldReload: true,
 				AutoReload:   false,
+				Errors:       regexErrors,
 			}
 		}
 	}
@@ -291,6 +299,7 @@ func ShouldReload(config Config, resourceType string, annotations Map, podAnnota
 			return ReloadCheckResult{
 				ShouldReload: true,
 				AutoReload:   true,
+				Errors:       regexErrors,
 			}
 		}
 	}
@@ -301,11 +310,13 @@ func ShouldReload(config Config, resourceType string, annotations Map, podAnnota
 		return ReloadCheckResult{
 			ShouldReload: true,
 			AutoReload:   true,
+			Errors:       regexErrors,
 		}
 	}
 
 	return ReloadCheckResult{
 		ShouldReload: false,
+		Errors:       regexErrors,
 	}
 }
 
```

**File**: `pkg/common/common_test.go` (modified, +53/-0)
```diff
@@ -222,3 +222,56 @@ func TestShouldReload_IssueRBACPermissionFixed(t *testing.T) {
 		})
 	}
 }
+
+// A malformed regex in a named reload annotation must not panic the operator.
+// Regression test: previously regexp.MustCompile("^"+value+"$") panicked on an
+// invalid pattern, crashing Reloader cluster-wide (no recover on the worker).
+func TestShouldReload_InvalidRegexAnnotation_DoesNotPanic(t *testing.T) {
+	config := Config{
+		ResourceName: "app-config",
+		Annotation:   "secret.reloader.stakater.com/reload",
+	}
+	annotations := Map{
+		// unbalanced bracket => invalid regex
+		"secret.reloader.stakater.com/reload": "app-config[",
+	}
+	opts := &ReloaderOptions{
+		ReloaderAutoAnnotation: "reloader.stakater.com/auto",
+	}
+
+	// Before the fix this panicked inside ShouldReload.
+	result := ShouldReload(config, "Deployment", annotations, Map{}, opts)
+
+	if result.ShouldReload {
+		t.Errorf("Expected ShouldReload=false for an invalid regex pattern, got=%v", result.ShouldReload)
+	}
+	if len(result.Errors) != 1 {
+		t.Errorf("Expected 1 surfaced regex error, got=%d: %v", len(result.Errors), result.Errors)
+	}
+}
+
+// When a named reload annotation holds several comma-separated patterns, a
+// single malformed one is skipped while a valid one still matches, and the
+// skipped pattern's error is surfaced on the result.
+func TestShouldReload_InvalidRegexAnnotation_SkipsMalformedPattern(t *testing.T) {
+	config := Config{
+		ResourceName: "app-config",
+		Annotation:   "secret.reloader.stakater.com/reload",
+	}
+	annotations := Map{
+		// first pattern is invalid (unbalanced bracket), second matches
+		"secret.reloader.stakater.com/reload": "bad[,app-config",
+	}
+	opts := &ReloaderOptions{
+		ReloaderAutoAnnotation: "reloader.stakater.com/auto",
+	}
+
+	result := ShouldReload(config, "Deployment", annotations, Map{}, opts)
+
+	if !result.ShouldReload {
+		t.Errorf("Expected ShouldReload=true from the valid pattern, got=%v", result.ShouldReload)
+	}
+	if len(result.Errors) != 1 {
+		t.Errorf("Expected the malformed pattern to surface 1 error, got=%d: %v", len(result.Errors), result.Errors)
+	}
+}
```

---

### Incident Patch 11: `2a5da5b8` (2026-08-10)
**Commit Message**: Merge pull request #1204 from locker95/fix/namespaceSelector-helper-comment

chart: fix reloader-namespaceSelector helper comment

**File**: `deployments/kubernetes/chart/reloader/templates/_helpers.tpl` (modified, +2/-1)
```diff
@@ -80,7 +80,8 @@ meta.helm.sh/release-name: {{ .Release.Name | quote }}
 {{- end -}}
 
 {{/*
-Create the namespace selector if it does not watch globally
+Emit reloader.namespaceSelector when watching globally (label filter on namespaces).
+Only used when reloader.watchGlobally is true; see chart README / values comments.
 */}}
 {{- define "reloader-namespaceSelector" -}}
 {{- if and .Values.reloader.watchGlobally .Values.reloader.namespaceSelector -}}
```

---

### Incident Patch 12: `05289934` (2026-08-09)
**Commit Message**: chart: fix reloader-namespaceSelector helper comment

The helper only emits namespaceSelector when watchGlobally is true
(matches values.yaml and the chart README). The old comment said the
opposite and made the condition look inverted.

Fixes #1188

Signed-off-by: Dean Chen <[REDACTED_EMAIL]>

**File**: `deployments/kubernetes/chart/reloader/templates/_helpers.tpl` (modified, +2/-1)
```diff
@@ -80,7 +80,8 @@ meta.helm.sh/release-name: {{ .Release.Name | quote }}
 {{- end -}}
 
 {{/*
-Create the namespace selector if it does not watch globally
+Emit reloader.namespaceSelector when watching globally (label filter on namespaces).
+Only used when reloader.watchGlobally is true; see chart README / values comments.
 */}}
 {{- define "reloader-namespaceSelector" -}}
 {{- if and .Values.reloader.watchGlobally .Values.reloader.namespaceSelector -}}
```

---

### Incident Patch 13: `d455bbd4` (2026-08-07)
**Commit Message**: Merge pull request #1202 from stakater/fix/bump-golang-x-text

Bump golang.org/x/text to v0.39.0 to fix CVE-2026-56852

**File**: `go.mod` (modified, +8/-8)
```diff
@@ -247,16 +247,16 @@ require (
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	golang.org/x/exp/typeparams v0.0.0-20251023183803-a4bb9ffd2546 // indirect
-	golang.org/x/mod v0.35.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
+	golang.org/x/mod v0.37.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/sync v0.20.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
-	golang.org/x/telemetry v0.0.0-20260409153401-be6f6cb8b1fa // indirect
-	golang.org/x/term v0.43.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
+	golang.org/x/sync v0.21.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/telemetry v0.0.0-20260625142307-59b4966ccb57 // indirect
+	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/text v0.39.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.44.0 // indirect
+	golang.org/x/tools v0.47.0 // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
```

**File**: `go.sum` (modified, +16/-16)
```diff
@@ -603,8 +603,8 @@ golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91
 golang.org/x/mod v0.8.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.12.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.13.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
-golang.org/x/mod v0.35.0 h1:Ww1D637e6Pg+Zb2KrWfHQUnH2dQRLBQyAtpr/haaJeM=
-golang.org/x/mod v0.35.0/go.mod h1:+GwiRhIInF8wPm+4AoT6L0FA1QWAad3OMdTRx4tFYlU=
+golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
+golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
 golang.org/x/net v0.0.0-20190311183353-d8887717615a/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190404232315-eb5bcb51f2a3/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
@@ -619,8 +619,8 @@ golang.org/x/net v0.6.0/go.mod h1:2Tu9+aMcznHK/AK1HMvgo6xiTLG5rD5rZLDS+rp2Bjs=
 golang.org/x/net v0.10.0/go.mod h1:0qNGK6F8kojg2nk9dLZ2mShWaEBan6FAoqfSigmmuDg=
 golang.org/x/net v0.15.0/go.mod h1:idbUs1IY1+zTqbi8yxTbhexhEEk5ur9LInksu6HrEpk=
 golang.org/x/net v0.16.0/go.mod h1:NxSsAGuq816PNPmqtQdLE42eU2Fs7NoRIZrHJAlaCOE=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
@@ -632,8 +632,8 @@ golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.1.0/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.3.0/go.mod h1:FU7BRWz2tNW+3quACPkgCx/L+uEAv1htQ0V83Z9Rj+Y=
 golang.org/x/sync v0.4.0/go.mod h1:FU7BRWz2tNW+3quACPkgCx/L+uEAv1htQ0V83Z9Rj+Y=
-golang.org/x/sync v0.20.0 h1:e0PTpb7pjO8GAtTs2dQ6jYa5BWYlMuX047Dco/pItO4=
-golang.org/x/sync v0.20.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
+golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190412213103-97732733099d/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20200323222414-85ca7c5b95cd/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
@@ -653,18 +653,18 @@ golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.8.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.12.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.13.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/telemetry v0.0.0-20260409153401-be6f6cb8b1fa h1:efT73AJZfAAUV7SOip6pWGkwJDzIGiKBZGVzHYa+ve4=
-golang.org/x/telemetry v0.0.0-20260409153401-be6f6cb8b1fa/go.mod h1:kHjTxDEnAu6/Nl9lDkzjWpR+bmKfxeiRuSDlsMb70gE=
+golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
+golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/telemetry v0.0.0-20260625142307-59b4966ccb57 h1:nwGZBCt+FnXUrGsj5vjzAsEmkcaFvd82BbOjECiFYZc=
+golang.org/x/telemetry v0.0.0-20260625142307-59b4966ccb57/go.mod h1:3AWMyWHS+caVoiEXpiq6+tzKA40J4vQT3MYr80ZtQpc=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
 golang.org/x/term v0.5.0/go.mod h1:jMB1sMXY+tzblOD4FWmEbocvup2/aLOaQEp7JmGp78k=
 golang.org/x/term v0.8.0/go.mod h1:xPskH00ivmX89bAKVGSKKtLOWNx2+17Eiy94tnKShWo=
 golang.org/x/term v0.12.0/go.mod h1:owVbMEjm3cBLCHdkQu9b1opXd4ETQWc3BhuQGKgXgvU=
 golang.org/x/term v0.13.0/go.mod h1:LTmsnFJwVN6bCy1rVCoS+qHT1HhALEFxKncY3WNNh4U=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
+golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
+golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.2/go.mod h1:bEr9sfX3Q8Zfm5fL9x+3itogRgK3+ptLWKqgva+5dAk=
 gol
```

---

### Incident Patch 14: `756910eb` (2026-08-07)
**Commit Message**: Bump golang.org/x/text to v0.39.0 to fix CVE-2026-56852

Upgrades the golang.org/x/* module family in lockstep. Fixes the HIGH
severity DoS vulnerability in golang.org/x/text v0.37.0 that fails the
Trivy security gate in the enterprise release pipeline.

**File**: `go.mod` (modified, +8/-8)
```diff
@@ -247,16 +247,16 @@ require (
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	golang.org/x/exp/typeparams v0.0.0-20251023183803-a4bb9ffd2546 // indirect
-	golang.org/x/mod v0.35.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
+	golang.org/x/mod v0.37.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/sync v0.20.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
-	golang.org/x/telemetry v0.0.0-20260409153401-be6f6cb8b1fa // indirect
-	golang.org/x/term v0.43.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
+	golang.org/x/sync v0.21.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/telemetry v0.0.0-20260625142307-59b4966ccb57 // indirect
+	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/text v0.39.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.44.0 // indirect
+	golang.org/x/tools v0.47.0 // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
```

**File**: `go.sum` (modified, +16/-16)
```diff
@@ -603,8 +603,8 @@ golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91
 golang.org/x/mod v0.8.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.12.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.13.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
-golang.org/x/mod v0.35.0 h1:Ww1D637e6Pg+Zb2KrWfHQUnH2dQRLBQyAtpr/haaJeM=
-golang.org/x/mod v0.35.0/go.mod h1:+GwiRhIInF8wPm+4AoT6L0FA1QWAad3OMdTRx4tFYlU=
+golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
+golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
 golang.org/x/net v0.0.0-20190311183353-d8887717615a/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190404232315-eb5bcb51f2a3/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
@@ -619,8 +619,8 @@ golang.org/x/net v0.6.0/go.mod h1:2Tu9+aMcznHK/AK1HMvgo6xiTLG5rD5rZLDS+rp2Bjs=
 golang.org/x/net v0.10.0/go.mod h1:0qNGK6F8kojg2nk9dLZ2mShWaEBan6FAoqfSigmmuDg=
 golang.org/x/net v0.15.0/go.mod h1:idbUs1IY1+zTqbi8yxTbhexhEEk5ur9LInksu6HrEpk=
 golang.org/x/net v0.16.0/go.mod h1:NxSsAGuq816PNPmqtQdLE42eU2Fs7NoRIZrHJAlaCOE=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
@@ -632,8 +632,8 @@ golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.1.0/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.3.0/go.mod h1:FU7BRWz2tNW+3quACPkgCx/L+uEAv1htQ0V83Z9Rj+Y=
 golang.org/x/sync v0.4.0/go.mod h1:FU7BRWz2tNW+3quACPkgCx/L+uEAv1htQ0V83Z9Rj+Y=
-golang.org/x/sync v0.20.0 h1:e0PTpb7pjO8GAtTs2dQ6jYa5BWYlMuX047Dco/pItO4=
-golang.org/x/sync v0.20.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
+golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190412213103-97732733099d/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20200323222414-85ca7c5b95cd/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
@@ -653,18 +653,18 @@ golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.8.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.12.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.13.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/telemetry v0.0.0-20260409153401-be6f6cb8b1fa h1:efT73AJZfAAUV7SOip6pWGkwJDzIGiKBZGVzHYa+ve4=
-golang.org/x/telemetry v0.0.0-20260409153401-be6f6cb8b1fa/go.mod h1:kHjTxDEnAu6/Nl9lDkzjWpR+bmKfxeiRuSDlsMb70gE=
+golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
+golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/telemetry v0.0.0-20260625142307-59b4966ccb57 h1:nwGZBCt+FnXUrGsj5vjzAsEmkcaFvd82BbOjECiFYZc=
+golang.org/x/telemetry v0.0.0-20260625142307-59b4966ccb57/go.mod h1:3AWMyWHS+caVoiEXpiq6+tzKA40J4vQT3MYr80ZtQpc=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
 golang.org/x/term v0.5.0/go.mod h1:jMB1sMXY+tzblOD4FWmEbocvup2/aLOaQEp7JmGp78k=
 golang.org/x/term v0.8.0/go.mod h1:xPskH00ivmX89bAKVGSKKtLOWNx2+17Eiy94tnKShWo=
 golang.org/x/term v0.12.0/go.mod h1:owVbMEjm3cBLCHdkQu9b1opXd4ETQWc3BhuQGKgXgvU=
 golang.org/x/term v0.13.0/go.mod h1:LTmsnFJwVN6bCy1rVCoS+qHT1HhALEFxKncY3WNNh4U=
-golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
-golang.org/x/term v0.43.0/go.mod h1:lrhlHNdQJHO+1qVYiHfFKVuVioJIheAc3fBSMFYEIsk=
+golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
+golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.2/go.mod h1:bEr9sfX3Q8Zfm5fL9x+3itogRgK3+ptLWKqgva+5dAk=
 gol
```

---

### Incident Patch 15: `0ab56789` (2026-07-22)
**Commit Message**: changed the trim character to fix the indentation issue

**File**: `deployments/kubernetes/chart/reloader/templates/service.yaml` (modified, +5/-5)
```diff
@@ -22,12 +22,12 @@ spec:
 {{- if .Values.reloader.matchLabels }}
 {{ tpl (toYaml .Values.reloader.matchLabels) . | indent 4 }}
 {{- end }}
-{{ if .Values.reloader.service.ipFamilyPolicy -}}
+{{- if .Values.reloader.service.ipFamilyPolicy }}
   ipFamilyPolicy: {{ .Values.reloader.service.ipFamilyPolicy }}
-{{ end -}}
-{{ if .Values.reloader.service.ipFamilies -}}
-  ipFamilies: {{ .Values.reloader.service.ipFamilies | toYaml | nindent 4 }}
-{{ end -}}
+{{- end }}
+{{- if .Values.reloader.service.ipFamilies }}
+  ipFamilies: {{ .Values.reloader.service.ipFamilies | toYaml | nindent 2 }}
+{{- end }}
   ports:
   - port: {{ .Values.reloader.service.port }}
     name: http
```

#### Recent Merged Pull Requests:
- **PR #1237** (2026-09-30): chore: add v2 announcement and master feature freeze notice to README (@Felix-Stakater)
- **PR #1236** (2026-09-30): chore: add v2 announcement and master feature freeze notice to README (@Felix-Stakater)
- **PR #1235** (2026-09-29): feat(chart): render image fields with tpl (@jm-stakater)
- **PR #1234** (2026-09-30): chore(chart): render image fields with tpl (@jm-stakater)
- **PR #1233** (2026-09-29): ci: enforce semantic PR title prefixes (@msafwankarim)
- **PR #1232** (2026-09-29): chore: enforce PR title prefixes for the master feature freeze (@msafwankarim)
- **PR #1230** (2026-09-23): ci: allow prerelease chart versions, and publish chart 3.0.0-beta.1 (@msafwankarim)
- **PR #1229** (2026-09-23): ci: dispatch the enterprise build for prereleases, and remove CLAUDE.md (@msafwankarim)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
