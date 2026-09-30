# Forensic Learning Record (Deep Inspection): karmada-io/karmada

> **Canonical Artifact**: `07_PROJECT_LEARNING/karmada-io-karmada-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/karmada-io/karmada](https://github.com/karmada-io/karmada))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:56.055Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `karmada-io/karmada`
- **Description**: Open, Multi-Cloud, Multi-Cluster Kubernetes Orchestration
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5710 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/generating-release-notes/scripts/fetch_pr_info.py`
```
#!/usr/bin/env python3
# Copyright 2026 The Karmada Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Fetch merged PR metadata and user-facing changes for release notes."""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request


GITHUB_API_BASE = "https://api.github.com"
NO_RELEASE_NOTE_VALUES = {
    "",
    "n/a",
    "na",
    "no",
    "none",
    "noop",
    "nope",
    "nothing",
}


def github_request(url, token, payload=None):
    """Send an authenticated GitHub API request and decode its JSON body."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Release-Note-Generator",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        print(f"GitHub request failed ({error.code}): {detail}", file=sys.stderr)
    except urllib.error.URLError as error:
        print(f"GitHub request failed: {error.reason}", file=sys.stderr)
    return None


def get_commit_comparison(repo_owner, repo_name, base_tag, head_branch, token):
    """Get the GitHub comparison between the base tag and head branch."""
    base_url = (
        f"{GITHUB_API_BASE}/repos/{repo_owner}/{repo_name}/compare/"
        f"{base_tag}...{head_branch}"
    )
    comparison = None
    commits = []
    page = 1

    while True:
        response = github_request(f"{base_url}?per_page=100&page={page}", token)
        if not response:
            break
        if comparison is None:
            comparison = response.copy()

        page_commits = response.get("commits", [])
        commits.extend(page_commits)
        total_commits = comparison.get("total_commits", len(commits))
        if len(commits) >= total_commits or len(page_commits) < 100:
            break
        page += 1

    if comparison is not None:
        comparison["commits"] = commits
    return comparison


def get_pr_details_batch(repo_owner, repo_name, pr_numbers, token):
    """Fetch pull request title, body, and author in one GraphQL request."""
    if not pr_numbers:
        return {}

    query_parts = []
    for index, number in enumerate(pr_numbers):
        query_parts.append(
            f"pr{index}: pullRequest(number: {number}) {{ "
            "number title body author { login } "
            "labels(first: 100) { nodes { name } } }"
        )
    query = (
        "{ repository(owner: \""
        + repo_owner
        + "\", name: \""
        + repo_name
        + "\") { "
        + " ".join(query_parts)
        + " } }"
    )
    response = github_request(
        "https://api.github.com/graphql", token, {"query": query}
    )
    if not response:
        return None
    if response.get("errors"):
        print(f"GraphQL errors: {response['errors']}", file=sys.stderr)
        return None

    repository = response.get("data", {}).get("repository", {})
    result = {}
    for index, number in enumerate(pr_numbers):
        pull_request = repository.get(f"pr{index}")
        if pull_request:
            result[number] = pull_request
    return result


def normalize_release_note(content):
    """Normalize a candidate release note and reject standard empty values."""
    normalized = re.sub(r"\s+", " ", content.strip())
    if normalized.lower() in NO_RELEASE_NOTE_VALUES or len(normalized) <= 3:
        return None
    return normalized


def extract_user_facing_change(pr_body):
    """Extract a user-facing change from supported PR template formats."""
    if not pr_body:
        return None

    release_note_patterns = [
        r"```release-note[^\r\n]*[\r\n]+(.*?)^[ \t]*```[ \t]*$",
        r"```release-note\s*[\r\n]+([^\r\n]+(?:[\r\n]+[^\r\n`]+)*)",
    ]
    for pattern in release_note_patterns:
        match = re.search(pattern, pr_body, re.MULTILINE | re.DOTALL)
        if match:
            return normalize_release_note(match.group(1))

    fallback = re.search(
        r"\*\*Does this PR introduce a user-facing change\?\*\*:\s*"
        r"```[^\r\n]*[\r\n]+([\s\S]*?)```",
        pr_body,
        re.IGNORECASE,
    )
    if fallback:
        return normalize_release_note(fallback.group(1))
    return None


def extract_pr_kind_from_labels(labels):
    """Extract PR kinds from kind-prefixed labels."""
    kinds = []
    for label in (labels or {}).get("nodes", []):
        name = (label or {}).get("name", "")
        if name.startswith("kind/") and len(name) > len("kind/"):
            kind = name[len("kind/") :]
            if kind not in kinds:
                kinds.append(kind)
    return kinds or None


def extract_pr_kind_from_body(pr_body):
    """Extract PR kinds from the Karmada pull request template body."""
    if not pr_body:
        return None

    section = re.search(
        r"\*\*What type of PR is this\?\*\*(.*?)"
        r"\*\*What this PR does / why we need it\*\*:",
        pr_body,
        re.DOTALL | re.IGNORECASE,
    )
    if not section:
        return None

    without_comments = re.sub(r"<!--.*?-->", "", section.group(1), flags=re.DOTALL)
    kinds = re.findall(
        r"^\s*/kind\s+([a-zA-Z0-9-]+)\s*$", without_comments, re.MULTILINE
    )
    return kinds or None


def extract_pr_kind(labels, pr_body):
    """Extract PR kinds from labels, falling back to the PR body."""
    return extract_pr_kind_from_labels(labels) or extract_pr_kind_from_body(pr_body)


def extract_pr_number(commit_message):
    """Extract a PR number from a GitHub merge or squash commit title."""
    title = commit_message.splitlines()[0] if commit_message else ""
    merge_match = re.match(r"Merge pull request #(\d+)\b", title)
    if merge_match:
        return int(merge_match.group(1))

    squash_match = re.search(r"\(#(\d+)\)$", title)
    if squash_match:
        return int(squash_match.group(1))
    return None


def comparison_is_truncated(comparison):
    """Report whether the compare response omitted commits from its list."""
    commits = comparison.get("commits", [])
    return comparison.get("total_commits", len(commits)) > len(commits)


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Fetch merged PR information for release note generation."
    )
    parser.add_argument("base_tag", help="Base tag or branch to compare from")
    parser.add_argument("head_branch", help="Head tag or branch to compare to")
    parser.add_argument(
        "--repo",
        required=True,
        help="GitHub repository in owner/name format",
    )
    return parser.parse_args()


def main():
    """Fetch and print PRs that contain user-facing changes."""
    args = parse_arguments()
    if args.repo.count("/") != 1:
        print("Error: --repo must use owner/name format", file=sys.stderr)
        return 2

    token = os.getenv("GITHUB_TOKEN")
    if not token:
        print("Error: GITHUB_TOKEN is not set", file=sys.stderr)
        return 2

    repo_owner, repo_name = args.repo.split("/", 1)
    print(f"Fetching PR information for {args.repo}...")
    print(f"Comparing {args.base_tag}...{args.head_
```

### Core Architecture Module: `cmd/agent/app/agent.go`
```
/*
Copyright 2021 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package app

import (
	"context"
	"flag"
	"fmt"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/informers"
	kubeclientset "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/component-base/logs"
	logsv1 "k8s.io/component-base/logs/api/v1"
	"k8s.io/component-base/term"
	"k8s.io/klog/v2"
	controllerruntime "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/config"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	ctrlmetrics "sigs.k8s.io/controller-runtime/pkg/metrics"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	"github.com/karmada-io/karmada/cmd/agent/app/options"
	clusterv1alpha1 "github.com/karmada-io/karmada/pkg/apis/cluster/v1alpha1"
	workv1alpha1 "github.com/karmada-io/karmada/pkg/apis/work/v1alpha1"
	"github.com/karmada-io/karmada/pkg/controllers/certificate"
	controllerscontext "github.com/karmada-io/karmada/pkg/controllers/context"
	"github.com/karmada-io/karmada/pkg/controllers/execution"
	"github.com/karmada-io/karmada/pkg/controllers/mcs"
	"github.com/karmada-io/karmada/pkg/controllers/multiclusterservice"
	"github.com/karmada-io/karmada/pkg/controllers/status"
	"github.com/karmada-io/karmada/pkg/features"
	karmadaclientset "github.com/karmada-io/karmada/pkg/generated/clientset/versioned"
	"github.com/karmada-io/karmada/pkg/karmadactl/util/apiclient"
	"github.com/karmada-io/karmada/pkg/metrics"
	"github.com/karmada-io/karmada/pkg/resourceinterpreter"
	"github.com/karmada-io/karmada/pkg/sharedcli"
	"github.com/karmada-io/karmada/pkg/sharedcli/klogflag"
	"github.com/karmada-io/karmada/pkg/sharedcli/profileflag"
	"github.com/karmada-io/karmada/pkg/util"
	"github.com/karmada-io/karmada/pkg/util/fedinformer"
	"github.com/karmada-io/karmada/pkg/util/fedinformer/genericmanager"
	"github.com/karmada-io/karmada/pkg/util/fedinformer/typedmanager"
	"github.com/karmada-io/karmada/pkg/util/gclient"
	"github.com/karmada-io/karmada/pkg/util/helper"
	"github.com/karmada-io/karmada/pkg/util/indexregistry"
	"github.com/karmada-io/karmada/pkg/util/names"
	"github.com/karmada-io/karmada/pkg/util/objectwatcher"
	"github.com/karmada-io/karmada/pkg/util/restmapper"
	"github.com/karmada-io/karmada/pkg/version"
	"github.com/karmada-io/karmada/pkg/version/sharedcommand"
)

// NewAgentCommand creates a *cobra.Command object with default parameters
func NewAgentCommand(ctx context.Context) *cobra.Command {
	logConfig := logsv1.NewLoggingConfiguration()
	fss := cliflag.NamedFlagSets{}

	// Set klog flags
	logsFlagSet := fss.FlagSet("logs")
	logs.AddFlags(logsFlagSet, logs.SkipLoggingConfigurationFlags())
	logsv1.AddFlags(logConfig, logsFlagSet)
	klogflag.Add(logsFlagSet)

	genericFlagSet := fss.FlagSet("generic")
	genericFlagSet.AddGoFlagSet(flag.CommandLine)
	opts := options.NewOptions()
	opts.AddFlags(genericFlagSet, controllers.ControllerNames())

	cmd := &cobra.Command{
		Use: names.KarmadaAgentComponentName,
		Long: `The karmada-agent is the agent of member clusters. It can register a specific cluster to the Karmada control
plane and sync manifests from the Karmada control plane to the member cluster. In addition, it also syncs the status of member
cluster and manifests to the Karmada control plane.`,
		PersistentPreRunE: func(_ *cobra.Command, _ []string) error {
			if err := logsv1.ValidateAndApply(logConfig, features.FeatureGate); err != nil {
				return err
			}
			logs.InitLogs()
			return nil
		},
		RunE: func(_ *cobra.Command, _ []string) error {
			// validate options
			if errs := opts.Validate(); len(errs) != 0 {
				return errs.ToAggregate()
			}
			if err := run(ctx, opts); err != nil {
				return err
			}
			return nil
		},
		Args: func(cmd *cobra.Command, args []string) error {
			for _, arg := range args {
				if len(arg) > 0 {
					return fmt.Errorf("%q does not take any arguments, got %q", cmd.CommandPath(), args)
				}
			}
			return nil
		},
	}

	cmd.AddCommand(sharedcommand.NewCmdVersion(names.KarmadaAgentComponentName))
	cmd.Flags().AddFlagSet(genericFlagSet)
	cmd.Flags().AddFlagSet(logsFlagSet)

	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	sharedcli.SetUsageAndHelpFunc(cmd, fss, cols)
	return cmd
}

var controllers = make(controllerscontext.Initializers)

var controllersDisabledByDefault = sets.New(
	"certRotation",
)

func init() {
	controllers["clusterStatus"] = startClusterStatusController
	controllers["execution"] = startExecutionController
	controllers["workStatus"] = startWorkStatusController
	controllers["serviceExport"] = startServiceExportController
	controllers["certRotation"] = startCertRotationController
	controllers["endpointsliceCollect"] = startEndpointSliceCollectController
}

func run(ctx context.Context, opts *options.Options) error {
	klog.Infof("karmada-agent version: %s", version.Get())

	profileflag.ListenAndServe(opts.ProfileOpts)

	controlPlaneRestConfig, err := apiclient.RestConfig(opts.KarmadaContext, opts.KarmadaKubeConfig)
	if err != nil {
		return fmt.Errorf("error building kubeconfig of karmada control plane: %w", err)
	}
	controlPlaneRestConfig.RateLimiter = flowcontrol.NewTokenBucketRateLimiter(opts.KubeAPIQPS, opts.KubeAPIBurst)
	clusterConfig, err := controllerruntime.GetConfig()
	if err != nil {
		return fmt.Errorf("error building kubeconfig of member cluster: %w", err)
	}
	clusterKubeClient := kubeclientset.NewForConfigOrDie(clusterConfig)
	controlPlaneKubeClient := kubeclientset.NewForConfigOrDie(controlPlaneRestConfig)
	karmadaClient := karmadaclientset.NewForConfigOrDie(controlPlaneRestConfig)

	registerOption := util.ClusterRegisterOption{
		ClusterNamespace:   opts.ClusterNamespace,
		ClusterName:        opts.ClusterName,
		ReportSecrets:      opts.ReportSecrets,
		ClusterAPIEndpoint: opts.ClusterAPIEndpoint,
		ProxyServerAddress: opts.ProxyServerAddress,
		ClusterProvider:    opts.ClusterProvider,
		ClusterRegion:      opts.ClusterRegion,
		ClusterZones:       opts.ClusterZones,
		DryRun:             false,
		ControlPlaneConfig: controlPlaneRestConfig,
		ClusterConfig:      clusterConfig,
	}

	registerOption.ClusterID, err = util.ObtainClusterID(clusterKubeClient)
	if err != nil {
		return err
	}

	if err = registerOption.Validate(karmadaClient, true); err != nil {
		return err
	}

	clusterSecret, impersonatorSecret, err := util.ObtainCredentialsFromMemberCluster(clusterKubeClient, registerOption)
	if err != nil {
		return err
	}
	if clusterSecret != nil {
		registerOption.Secret = *clusterSecret
	}
	if impersonatorSecret != nil {
		registerOption.ImpersonatorSecret = *impersonatorSecret
	}
	err = util.RegisterClusterInControllerPlane(registerOption, controlPlaneKubeClient, generateClusterInControllerPlane)
	if err != nil {
		return fmt.Errorf("failed to register with karmada control plane: %w", err)
	}

	executionSpace := names.GenerateExecutionSpaceName(opts.ClusterName)

	controllerManager, err := controllerruntime.NewManager(controlPlaneRestConfig, controllerruntime.Options{
		Scheme:                     gclient.NewSchema(),
		Cache:                      cache.Options{SyncPeriod: &opts.ResyncPeriod.Duration, DefaultNamespaces: map[string]cache.Config{executionSpace: {}}},
		LeaderElection:             opts.Le
```

### Core Architecture Module: `cmd/agent/app/options/options.go`
```
/*
Copyright 2021 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package options

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/pflag"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/leaderelection/resourcelock"
	componentbaseconfig "k8s.io/component-base/config"

	"github.com/karmada-io/karmada/pkg/features"
	"github.com/karmada-io/karmada/pkg/sharedcli/profileflag"
	"github.com/karmada-io/karmada/pkg/sharedcli/ratelimiterflag"
	"github.com/karmada-io/karmada/pkg/util"
	"github.com/karmada-io/karmada/pkg/util/names"
)

const (
	// DefaultKarmadaClusterNamespace defines the default namespace where the member cluster secrets are stored.
	DefaultKarmadaClusterNamespace = "karmada-cluster"
)

var (
	defaultElectionLeaseDuration = metav1.Duration{Duration: 15 * time.Second}
	defaultElectionRenewDeadline = metav1.Duration{Duration: 10 * time.Second}
	defaultElectionRetryPeriod   = metav1.Duration{Duration: 2 * time.Second}
)

// Options contains everything necessary to create and run controller-manager.
type Options struct {
	// Controllers contains all controller names.
	Controllers       []string
	LeaderElection    componentbaseconfig.LeaderElectionConfiguration
	KarmadaKubeConfig string
	// ClusterContext is the name of the cluster context in control plane KUBECONFIG file.
	// Default value is the current-context.
	KarmadaContext string
	ClusterName    string
	// ClusterNamespace holds the namespace name where the member cluster secrets are stored.
	ClusterNamespace string
	// ClusterStatusUpdateFrequency is the frequency that controller computes and report cluster status.
	// It must work with ClusterMonitorGracePeriod(--cluster-monitor-grace-period) in karmada-controller-manager.
	ClusterStatusUpdateFrequency metav1.Duration
	// ClusterLeaseDuration is a duration that candidates for a lease need to wait to force acquire it.
	// This is measure against time of last observed RenewTime.
	ClusterLeaseDuration metav1.Duration
	// ClusterLeaseRenewIntervalFraction is a fraction coordinated with ClusterLeaseDuration that
	// how long the current holder of a lease has last updated the lease.
	ClusterLeaseRenewIntervalFraction float64
	// ClusterSuccessThreshold is the duration of successes for the cluster to be considered healthy after recovery.
	ClusterSuccessThreshold metav1.Duration
	// ClusterFailureThreshold is the duration of failure for the cluster to be considered unhealthy.
	ClusterFailureThreshold metav1.Duration
	// ClusterAPIQPS is the QPS to use while talking with cluster kube-apiserver.
	ClusterAPIQPS float32
	// ClusterAPIBurst is the burst to allow while talking with cluster kube-apiserver.
	ClusterAPIBurst int
	// KubeAPIQPS is the QPS to use while talking with karmada-apiserver.
	KubeAPIQPS float32
	// KubeAPIBurst is the burst to allow while talking with karmada-apiserver.
	KubeAPIBurst int

	ClusterCacheSyncTimeout metav1.Duration
	// ResyncPeriod is the base frequency the informers are resynced.
	// Defaults to 0, which means the created informer will never do resyncs.
	ResyncPeriod metav1.Duration

	// ClusterAPIEndpoint holds the apiEndpoint of the cluster.
	ClusterAPIEndpoint string
	// ProxyServerAddress holds the proxy server address that is used to proxy to the cluster.
	ProxyServerAddress string
	// ConcurrentClusterSyncs is the number of cluster objects that are
	// allowed to sync concurrently.
	ConcurrentClusterSyncs int
	// ConcurrentWorkSyncs is the number of work objects that are
	// allowed to sync concurrently.
	ConcurrentWorkSyncs int
	// MetricsBindAddress is the TCP address that the controller should bind to
	// for serving prometheus metrics.
	// It can be set to "0" to disable the metrics serving.
	// Defaults to ":8080".
	MetricsBindAddress string
	// HealthProbeBindAddress is the TCP address that the controller should bind to
	// for serving health probes
	// It can be set to "0" to disable serving the health probe.
	// Defaults to ":10357".
	HealthProbeBindAddress string

	RateLimiterOpts ratelimiterflag.Options

	ProfileOpts profileflag.Options

	// ReportSecrets specifies the secrets that are allowed to be reported to the Karmada control plane
	// during registering.
	// Valid values are:
	// - "None": Don't report any secrets.
	// - "KubeCredentials": Report the secret that contains mandatory credentials to access the member cluster.
	// - "KubeImpersonator": Report the secret that contains the token of impersonator.
	// - "KubeCredentials,KubeImpersonator": Report both KubeCredentials and KubeImpersonator.
	// Defaults to "KubeCredentials,KubeImpersonator".
	ReportSecrets []string

	// ClusterProvider is the cluster's provider.
	ClusterProvider string

	// ClusterRegion represents the region of the cluster locate in.
	ClusterRegion string

	// ClusterZones represents the zones of the cluster locate in.
	ClusterZones []string

	// EnableClusterResourceModeling indicates if enable cluster resource modeling.
	// The resource modeling might be used by the scheduler to make scheduling decisions
	// in scenario of dynamic replica assignment based on cluster free resources.
	// Disable if it does not fit your cases for better performance.
	EnableClusterResourceModeling bool

	// CertRotationCheckingInterval defines the interval of checking if the certificate need to be rotated.
	CertRotationCheckingInterval time.Duration
	// CertRotationRemainingTimeThreshold defines the threshold of remaining time of the valid certificate.
	// If the ratio of remaining time to total time is less than or equal to this threshold, the certificate rotation starts.
	CertRotationRemainingTimeThreshold float64
	// KarmadaKubeconfigNamespace is the namespace of the secret containing karmada-agent certificate.
	KarmadaKubeconfigNamespace string
}

// NewOptions builds an default scheduler options.
func NewOptions() *Options {
	return &Options{
		LeaderElection: componentbaseconfig.LeaderElectionConfiguration{
			LeaderElect:       true,
			ResourceLock:      resourcelock.LeasesResourceLock,
			ResourceNamespace: names.NamespaceKarmadaSystem,
		},
	}
}

// AddFlags adds flags of scheduler to the specified FlagSet
func (o *Options) AddFlags(fs *pflag.FlagSet, allControllers []string) {
	if o == nil {
		return
	}

	fs.StringSliceVar(&o.Controllers, "controllers", []string{"*"}, fmt.Sprintf(
		"A list of controllers to enable. '*' enables all on-by-default controllers, 'foo' enables the controller named 'foo', '-foo' disables the controller named 'foo'. All controllers: %s.",
		strings.Join(allControllers, ", "),
	))
	fs.BoolVar(&o.LeaderElection.LeaderElect, "leader-elect", true, "Start a leader election client and gain leadership before executing the main loop. Enable this when running replicated components for high availability.")
	fs.StringVar(&o.LeaderElection.ResourceNamespace, "leader-elect-resource-namespace", names.NamespaceKarmadaSystem, "The namespace of resource object that is used for locking during leader election.")
	fs.DurationVar(&o.LeaderElection.LeaseDuration.Duration, "leader-elect-lease-duration", defaultElectionLeaseDuration.Duration, ""+
		"The duration that non-leader candidates will wait after observing a leadership "+
		"renewal until attempting to acquire leadership of a led but unrenewed leader "+
		"slot. This is effectively the maximum duration that a leader can be stopped "+
		"before it is replaced by another candidate. This is only applicable if leader "+
		"election is enabled.")
	fs.D
```

### Core Architecture Module: `cmd/agent/app/options/validation.go`
```
/*
Copyright 2021 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package options

import (
	"strings"

	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/karmada-io/karmada/pkg/apis/cluster/validation"
)

// Validate checks Options and return a slice of found errs.
func (o *Options) Validate() field.ErrorList {
	errs := field.ErrorList{}

	newPath := field.NewPath("Options")
	if errMsgs := validation.ValidateClusterName(o.ClusterName); len(errMsgs) > 0 {
		errs = append(errs, field.Invalid(newPath.Child("ClusterName"), o.ClusterName, strings.Join(errMsgs, ",")))
	}

	if o.ClusterStatusUpdateFrequency.Duration < 0 {
		errs = append(errs, field.Invalid(newPath.Child("ClusterStatusUpdateFrequency"), o.ClusterStatusUpdateFrequency, "must be greater than or equal to 0"))
	}

	if o.ClusterLeaseDuration.Duration < 0 {
		errs = append(errs, field.Invalid(newPath.Child("ClusterLeaseDuration"), o.ClusterLeaseDuration, "must be greater than or equal to 0"))
	}

	if o.ClusterLeaseRenewIntervalFraction <= 0 || o.ClusterLeaseRenewIntervalFraction >= 1 {
		errs = append(errs, field.Invalid(newPath.Child("ClusterLeaseRenewIntervalFraction"), o.ClusterLeaseRenewIntervalFraction, "must be greater than 0 and less than 1"))
	}

	return errs
}

```

### Core Architecture Module: `cmd/agent/main.go`
```
/*
Copyright 2021 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"os"

	"k8s.io/component-base/cli"
	"k8s.io/component-base/logs"
	_ "k8s.io/component-base/logs/json/register" // for JSON log format registration
	"k8s.io/klog/v2"
	controllerruntime "sigs.k8s.io/controller-runtime"

	"github.com/karmada-io/karmada/cmd/agent/app"
)

func main() {
	ctx := controllerruntime.SetupSignalHandler()
	// Starting from version 0.15.0, controller-runtime expects its consumers to set a logger through log.SetLogger.
	// If SetLogger is not called within the first 30 seconds of a binaries lifetime, it will get
	// set to a NullLogSink and report an error. Here's to silence the "log.SetLogger(...) was never called; logs will not be displayed" error
	// by setting a logger through log.SetLogger.
	// More info refer to: https://github.com/karmada-io/karmada/pull/4885.
	controllerruntime.SetLogger(klog.Background())
	cmd := app.NewAgentCommand(ctx)
	code := cli.Run(cmd)
	// Ensure any buffered log entries are flushed
	logs.FlushLogs()
	os.Exit(code)
}

```

### Core Architecture Module: `cmd/aggregated-apiserver/app/aggregated-apiserver.go`
```
/*
Copyright 2021 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package app

import (
	"context"

	"github.com/spf13/cobra"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/component-base/logs"
	logsv1 "k8s.io/component-base/logs/api/v1"
	"k8s.io/component-base/term"

	"github.com/karmada-io/karmada/cmd/aggregated-apiserver/app/options"
	"github.com/karmada-io/karmada/pkg/features"
	"github.com/karmada-io/karmada/pkg/sharedcli"
	"github.com/karmada-io/karmada/pkg/sharedcli/klogflag"
	"github.com/karmada-io/karmada/pkg/util/names"
	"github.com/karmada-io/karmada/pkg/version/sharedcommand"
)

// NewAggregatedApiserverCommand creates a *cobra.Command object with default parameters
func NewAggregatedApiserverCommand(ctx context.Context) *cobra.Command {
	opts := options.NewOptions()
	logConfig := logsv1.NewLoggingConfiguration()
	fss := cliflag.NamedFlagSets{}

	// Set klog flags
	logsFlagSet := fss.FlagSet("logs")
	logs.AddFlags(logsFlagSet, logs.SkipLoggingConfigurationFlags())
	logsv1.AddFlags(logConfig, logsFlagSet)
	klogflag.Add(logsFlagSet)

	genericFlagSet := fss.FlagSet("generic")
	opts.AddFlags(genericFlagSet)

	cmd := &cobra.Command{
		Use: names.KarmadaAggregatedAPIServerComponentName,
		Long: `The karmada-aggregated-apiserver starts an aggregated server. 
It is responsible for registering the Cluster API and provides the ability to aggregate APIs, 
allowing users to access member clusters from the control plane directly.`,
		PersistentPreRunE: func(_ *cobra.Command, _ []string) error {
			if err := logsv1.ValidateAndApply(logConfig, features.FeatureGate); err != nil {
				return err
			}
			logs.InitLogs()
			return nil
		},
		RunE: func(_ *cobra.Command, _ []string) error {
			if err := opts.Complete(); err != nil {
				return err
			}
			if err := opts.Validate(); err != nil {
				return err
			}
			if err := opts.Run(ctx); err != nil {
				return err
			}
			return nil
		},
	}

	cmd.AddCommand(sharedcommand.NewCmdVersion(names.KarmadaAggregatedAPIServerComponentName))
	cmd.Flags().AddFlagSet(genericFlagSet)
	cmd.Flags().AddFlagSet(logsFlagSet)

	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	sharedcli.SetUsageAndHelpFunc(cmd, fss, cols)
	return cmd
}

```

### Core Architecture Module: `cmd/aggregated-apiserver/app/options/options.go`
```
/*
Copyright 2021 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package options

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/endpoints/openapi"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericfilters "k8s.io/apiserver/pkg/server/filters"
	genericoptions "k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/util/compatibility"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/flowcontrol"
	"k8s.io/klog/v2"
	netutils "k8s.io/utils/net"

	"github.com/karmada-io/karmada/pkg/aggregatedapiserver"
	clusterscheme "github.com/karmada-io/karmada/pkg/apis/cluster/scheme"
	clusterv1alpha1 "github.com/karmada-io/karmada/pkg/apis/cluster/v1alpha1"
	pkgfeatures "github.com/karmada-io/karmada/pkg/features"
	generatedopenapi "github.com/karmada-io/karmada/pkg/generated/openapi"
	"github.com/karmada-io/karmada/pkg/sharedcli/profileflag"
	"github.com/karmada-io/karmada/pkg/util/lifted"
	"github.com/karmada-io/karmada/pkg/version"
)

const defaultEtcdPathPrefix = "/registry"

// Options contains everything necessary to create and run aggregated-apiserver.
type Options struct {
	Etcd           *genericoptions.EtcdOptions
	SecureServing  *genericoptions.SecureServingOptionsWithLoopback
	Authentication *genericoptions.DelegatingAuthenticationOptions
	Authorization  *genericoptions.DelegatingAuthorizationOptions
	Audit          *genericoptions.AuditOptions
	Features       *genericoptions.FeatureOptions
	CoreAPI        *genericoptions.CoreAPIOptions

	// KubeAPIQPS is the QPS to use while talking with karmada-apiserver.
	KubeAPIQPS float32
	// KubeAPIBurst is the burst to allow while talking with karmada-apiserver.
	KubeAPIBurst int

	ProfileOpts profileflag.Options
}

// NewOptions returns a new Options.
func NewOptions() *Options {
	o := &Options{
		Etcd:           genericoptions.NewEtcdOptions(storagebackend.NewDefaultConfig(defaultEtcdPathPrefix, clusterscheme.Codecs.LegacyCodec(schema.GroupVersion{Group: clusterv1alpha1.GroupVersion.Group, Version: clusterv1alpha1.GroupVersion.Version}))),
		SecureServing:  genericoptions.NewSecureServingOptions().WithLoopback(),
		Authentication: genericoptions.NewDelegatingAuthenticationOptions(),
		Authorization:  genericoptions.NewDelegatingAuthorizationOptions(),
		Audit:          genericoptions.NewAuditOptions(),
		Features:       genericoptions.NewFeatureOptions(),
		CoreAPI:        genericoptions.NewCoreAPIOptions(),
	}
	o.Etcd.StorageConfig.EncodeVersioner = runtime.NewMultiGroupVersioner(schema.GroupVersion{Group: clusterv1alpha1.GroupVersion.Group, Version: clusterv1alpha1.GroupVersion.Version}, schema.GroupKind{Group: clusterv1alpha1.GroupName})
	return o
}

// AddFlags adds flags to the specified FlagSet.
func (o *Options) AddFlags(flags *pflag.FlagSet) {
	o.Etcd.AddFlags(flags)
	o.SecureServing.AddFlags(flags)
	o.Authentication.AddFlags(flags)
	o.Authorization.AddFlags(flags)
	o.Audit.AddFlags(flags)
	o.Features.AddFlags(flags)
	o.CoreAPI.AddFlags(flags)

	flags.Lookup("kubeconfig").Usage = "Path to karmada control plane kubeconfig file."

	flags.Float32Var(&o.KubeAPIQPS, "kube-api-qps", 40.0, "QPS to use while talking with karmada-apiserver.")
	flags.IntVar(&o.KubeAPIBurst, "kube-api-burst", 60, "Burst to use while talking with karmada-apiserver.")
	_ = utilfeature.DefaultMutableFeatureGate.Add(pkgfeatures.DefaultFeatureGates)
	utilfeature.DefaultMutableFeatureGate.AddFlag(flags)
	o.ProfileOpts.AddFlags(flags)
}

// Complete fills in fields required to have valid data.
func (o *Options) Complete() error {
	return nil
}

// Run runs the aggregated-apiserver with options. This should never exit.
func (o *Options) Run(ctx context.Context) error {
	klog.Infof("karmada-aggregated-apiserver version: %s", version.Get())

	profileflag.ListenAndServe(o.ProfileOpts)

	config, err := o.Config()
	if err != nil {
		return err
	}

	restConfig := config.GenericConfig.ClientConfig
	restConfig.RateLimiter = flowcontrol.NewTokenBucketRateLimiter(o.KubeAPIQPS, o.KubeAPIBurst)
	secretLister := config.GenericConfig.SharedInformerFactory.Core().V1().Secrets().Lister()
	config.GenericConfig.EffectiveVersion = compatibility.DefaultBuildEffectiveVersion()

	server, err := config.Complete().New(restConfig, secretLister)
	if err != nil {
		return err
	}

	server.GenericAPIServer.AddPostStartHookOrDie("start-aggregated-server-informers", func(context genericapiserver.PostStartHookContext) error {
		config.GenericConfig.SharedInformerFactory.Start(context.Done())
		return nil
	})

	return server.GenericAPIServer.PrepareRun().RunWithContext(ctx)
}

// Config returns config for the api server given Options
func (o *Options) Config() (*aggregatedapiserver.Config, error) {
	// TODO have a "real" external address
	if err := o.SecureServing.MaybeDefaultWithSelfSignedCerts("localhost", nil, []net.IP{netutils.ParseIPSloppy("127.0.0.1")}); err != nil {
		return nil, fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	o.Features = &genericoptions.FeatureOptions{EnableProfiling: false}

	serverConfig := genericapiserver.NewRecommendedConfig(clusterscheme.Codecs)
	serverConfig.LongRunningFunc = customLongRunningRequestCheck(sets.NewString("watch", "proxy"),
		sets.NewString("attach", "exec", "proxy", "log", "portforward"))
	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(generatedopenapi.GetOpenAPIDefinitions, openapi.NewDefinitionNamer(clusterscheme.Scheme))
	serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(generatedopenapi.GetOpenAPIDefinitions, openapi.NewDefinitionNamer(clusterscheme.Scheme))
	serverConfig.OpenAPIConfig.Info.Title = "Karmada"
	if err := o.applyTo(serverConfig); err != nil {
		return nil, err
	}

	config := &aggregatedapiserver.Config{
		GenericConfig: serverConfig,
		ExtraConfig:   aggregatedapiserver.ExtraConfig{},
	}
	return config, nil
}

func (o *Options) applyTo(config *genericapiserver.RecommendedConfig) error {
	if err := o.Etcd.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.SecureServing.ApplyTo(&config.Config.SecureServing, &config.Config.LoopbackClientConfig); err != nil {
		return err
	}
	if err := o.Authentication.ApplyTo(&config.Config.Authentication, config.SecureServing, config.OpenAPIConfig); err != nil {
		return err
	}
	if err := o.Authorization.ApplyTo(&config.Config.Authorization); err != nil {
		return err
	}
	if err := o.Audit.ApplyTo(&config.Config); err != nil {
		return err
	}
	if err := o.CoreAPI.ApplyTo(config); err != nil {
		return err
	}
	kubeClient, err := kubernetes.NewForConfig(config.ClientConfig)
	if err != nil {
		return err
	}
	if err = o.Features.ApplyTo(&config.Config, kubeClient, config.SharedInformerFactory); err != nil {
		return err
	}
	return nil
}

// disable `deprecation` check until the underlying genericfilters.BasicLongRunningRequestCheck starts using generic Set.
//
//nolint:staticcheck
func customLongRunningRequestCheck(longRunningVerbs, longRunningSubresources sets.String) apirequest.LongRunningRequestCheck {
	return func(r *http.Request, requestInfo *apirequest.RequestInfo) bool {
		reqClone := r.Clone(context.Background())
		p := reqClone.URL.Path
		currentParts := lifted.Split
```

### Core Architecture Module: `cmd/aggregated-apiserver/app/options/validation.go`
```
/*
Copyright 2022 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package options

import (
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
)

// Validate validates Options.
func (o *Options) Validate() error {
	var errs []error
	errs = append(errs, o.Etcd.Validate()...)
	errs = append(errs, o.SecureServing.Validate()...)
	errs = append(errs, o.Authentication.Validate()...)
	errs = append(errs, o.Authorization.Validate()...)
	errs = append(errs, o.Audit.Validate()...)
	errs = append(errs, o.Features.Validate()...)
	errs = append(errs, o.CoreAPI.Validate()...)
	return utilerrors.NewAggregate(errs)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7908** (2026-09-24): **Add release notes for v1.20.0-alpha.1**
  *Symptoms*: **What type of PR is this?**  /kind documentation  **What this PR does / why we need it**:  Add the release note for v1.20.0-alpha.1  **Which issue(s) this PR fixes**: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`.* --> Fixes #  <!-- *Optionally link to the umbrella issue if this PR resolves part of it. Usage: `Part of #<issue number>`, or `Part of (paste link of issue)`.* Part of # -->  **Special notes for your reviewer**: <!-- Such as a test report of this PR. -->  **Does this PR introduce a user-facing change?**:  ```release-note NONE ```  
  **Post-Mortem & Fix Analysis**:
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/karmada-io/karmada/pull/7908?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=karmada-io) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 42.47%. Comparing base ([`f37eea1`](https://app.codecov.io/gh/karmada-io/karmada/commit/f37eea1e0bee6f2cc53388b8ee7b6d8c05594b8b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=karmada-io)) to head ([`78a4ad2`](https://app.codecov.io/gh/karmada-io/karmada/commit/78a4ad2e89a2ff508779d3acfd3e3e911df3c85b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comme
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/karmada-io/karmada/pull/7908#pullrequestreview-5301633016" title="Approved">RainbowMango</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=karmada-io%2Fkarmada).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[docs/CHANGELOG/OWNERS](https://github.com/karmada-io/karmada/blob/master/docs/CHANGELOG/OWNERS)~~ [RainbowMango]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #7904** (2026-09-22): **build(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1**
  *Symptoms*: Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.3.0 to 4.4.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/docker/setup-buildx-action/releases">docker/setup-buildx-action's releases</a>.</em></p> <blockquote> <h2>v4.4.1</h2> <ul> <li>Skip BuildKit image pre-pulls for explicit endpoints by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/624">docker/setup-buildx-action#624</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/docker/setup-buildx-action/compare/v4.4.0...v4.4.1">https://github.com/docker/setup-buildx-action/compare/v4.4.0...v4.4.1</a></p> <h2>v4.4.0</h2> <ul> <li>Use official Buildx releases for cloud driver by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/606">docker/setup-buildx-action#606</a></li> <li>Pull BuildKit image before builder creation by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/609">docker/setup-buildx-action#609</a></li> <li>Use shared error helpers for Buildx and Docker commands by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-buildx-action/pull/620">docker/setup-buildx-action#620</a><
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/karmada-io/karmada/pull/7904#pullrequestreview-5275053185" title="Approved">RainbowMango</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=karmada-io%2Fkarmada).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[.github/workflows/OWNERS](https://github.com/karmada-io/karmada/blob/master/.github/workflows/OWNERS)~~ [RainbowMango]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #7903** (2026-09-22): **build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1**
  *Symptoms*: Bumps [codecov/codecov-action](https://github.com/codecov/codecov-action) from 7.0.0 to 7.1.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/codecov/codecov-action/releases">codecov/codecov-action's releases</a>.</em></p> <blockquote> <h2>v7.1.1</h2> <h2>What's Changed</h2> <ul> <li>chore(release): 7.1.1 by <a href="https://github.com/thomasrockhu-codecov"><code>@​thomasrockhu-codecov</code></a> in <a href="https://redirect.github.com/codecov/codecov-action/pull/1973">codecov/codecov-action#1973</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/codecov/codecov-action/compare/v7.1.0...v7.1.1">https://github.com/codecov/codecov-action/compare/v7.1.0...v7.1.1</a></p> <h2>v7.1.0</h2> <h2>What's Changed</h2> <ul> <li>chore(release): 7.1.0 by <a href="https://github.com/thomasrockhu-codecov"><code>@​thomasrockhu-codecov</code></a> in <a href="https://redirect.github.com/codecov/codecov-action/pull/1971">codecov/codecov-action#1971</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/codecov/codecov-action/compare/v7.0.0...v7.1.0">https://github.com/codecov/codecov-action/compare/v7.0.0...v7.1.0</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/codecov/codecov-action/commit/303a32d7a59b442fa8d48b6a1cc6825c09c847a5"><code>303a32d</code></a> chore(release): 7.1.1 (<a href="https://redirect.github.com/codecov/codecov-action/issues/
  **Post-Mortem & Fix Analysis**:
  > /retest
  > /retest 
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/karmada-io/karmada/pull/7903#pullrequestreview-5275058638" title="Approved">RainbowMango</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=karmada-io%2Fkarmada).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[.github/workflows/OWNERS](https://github.com/karmada-io/karmada/blob/master/.github/workflows/OWNERS)~~ [RainbowMango]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #7902** (2026-09-21): **build(deps): bump github/codeql-action/upload-sarif from 4.38.0 to 4.38.1**
  *Symptoms*: Bumps [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) from 4.38.0 to 4.38.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action/upload-sarif's releases</a>.</em></p> <blockquote> <h2>v4.38.1</h2> <ul> <li>The CodeQL Action now has experimental support for CodeQL releases for which per-language bundles are available. Per-language bundles support analysis for a single language and are therefore smaller than the combined bundles that allow analysis for all supported languages. As a result, per-language bundles take up less space on disk and are faster to download. We expect to roll this change out to everyone in the coming weeks. <a href="https://redirect.github.com/github/codeql-action/pull/4146">#4146</a></li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/github/codeql-action/blob/main/CHANGELOG.md">github/codeql-action/upload-sarif's changelog</a>.</em></p> <blockquote> <h1>CodeQL Action Changelog</h1> <p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p> <h2>[UNRELEASED]</h2> <p>No user facing changes.</p> <h2>4.38.1 - 18 Sept 2026</h2> <ul> <li>The CodeQL Action now has experimental support for CodeQL releases for which per-language bundles are available. Per-language bundles support a
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/karmada-io/karmada/pull/7902#pullrequestreview-5262417927" title="Approved">RainbowMango</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=karmada-io%2Fkarmada).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[.github/workflows/OWNERS](https://github.com/karmada-io/karmada/blob/master/.github/workflows/OWNERS)~~ [RainbowMango]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #7901** (2026-09-21): **build(deps): bump docker/setup-qemu-action from 4.3.0 to 4.4.0**
  *Symptoms*: Bumps [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) from 4.3.0 to 4.4.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/docker/setup-qemu-action/releases">docker/setup-qemu-action's releases</a>.</em></p> <blockquote> <h2>v4.4.0</h2> <ul> <li>Use the shared error helper for Docker commands by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/345">docker/setup-qemu-action#345</a></li> <li>Bump <code>@​docker/actions-toolkit</code> from 0.96.0 to 0.100.0 in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/344">docker/setup-qemu-action#344</a></li> <li>Bump <code>@​humanfs/node</code> from 0.16.7 to 0.16.8 in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/340">docker/setup-qemu-action#340</a></li> <li>Bump js-yaml from 4.3.1 to 4.3.2 in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/342">docker/setup-qemu-action#342</a></li> <li>Bump postcss-selector-parser from 7.1.1 to 7.1.5 in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/337">docker/setup-qemu-action#337</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/docker/setup-qemu-action/compare/v4.3.0...v4.4.0">https://github.com/docker/setup-qemu-action/compare/v4.3.0...v4.4.0</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/karmada-io/karmada/pull/7901#pullrequestreview-5262415820" title="Approved">RainbowMango</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=karmada-io%2Fkarmada).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[.github/workflows/OWNERS](https://github.com/karmada-io/karmada/blob/master/.github/workflows/OWNERS)~~ [RainbowMango]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #7900** (2026-09-21): **build(deps): bump jlumbroso/free-disk-space from 1.3.1 to 2.0.0**
  *Symptoms*: Bumps [jlumbroso/free-disk-space](https://github.com/jlumbroso/free-disk-space) from 1.3.1 to 2.0.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/jlumbroso/free-disk-space/releases">jlumbroso/free-disk-space's releases</a>.</em></p> <blockquote> <h2>v2.0.0 — three breaking changes, each with its reason</h2> <h2>Breaking changes</h2> <ol> <li><strong><code>swap-storage</code> now defaults to <code>false</code>.</strong> Closes <a href="https://redirect.github.com/jlumbroso/free-disk-space/issues/12">#12</a> — reported and diagnosed by <a href="https://github.com/zaikunzhang"><code>@​zaikunzhang</code></a>, whose proposed documentation fallback became the new FAQ. Removing swap can kill a job under memory pressure with no error pointing back at the cleanup step; a default should not break something that elementary.</li> <li><strong><code>tool-cache</code> is renamed <code>preinstalled-runtimes</code>.</strong> The old name still works until v3.0.0 and prints a deprecation warning. (Its default is unchanged: <code>false</code>, as it has been since 2022.) The new name says what actually breaks when you enable it: the runtimes that <code>actions/setup-node</code>, <code>setup-python</code>, <code>setup-go</code>, and <code>setup-ruby</code> rely on.</li> <li><strong>Specific options now override general ones.</strong> <code>dotnet: false</code> exempts .NET from every removal path, including <code>large-packages</code>. Fixes <a href=
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/karmada-io/karmada/pull/7900#pullrequestreview-5263707491" title="Approved">RainbowMango</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=karmada-io%2Fkarmada).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[.github/workflows/OWNERS](https://github.com/karmada-io/karmada/blob/master/.github/workflows/OWNERS)~~ [RainbowMango]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/karmada-io/karmada/pull/7900?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=karmada-io) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 42.47%. Comparing base ([`eea7f21`](https://app.codecov.io/gh/karmada-io/karmada/commit/eea7f2110835802ee74dfeb4083e8a5634af33d8?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=karmada-io)) to head ([`a90cbf8`](https://app.codecov.io/gh/karmada-io/karmada/commit/a90cbf8f3eb0722ad1303c0a9f199580e867a8c8?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comme

- **Issue #7899** (2026-09-18): **docs: remove retired Go Report Card badge from README**
  *Symptoms*: **What type of PR is this?**  /kind documentation /kind cleanup  **What this PR does / why we need it**:  The Go Report Card service has been sunset (https://goreportcard.com). The badge in README no longer reflects code quality and links to a sunset farewell page. This PR removes the retired Go Report Card badge from README.md to keep the documentation accurate.  **Which issue(s) this PR fixes**:  Fixes #7897  **Special notes for your reviewer**:  None  **Does this PR introduce a user-facing change?**:  ``` NONE ```
  **Post-Mortem & Fix Analysis**:
  > Welcome @lui01212! It looks like this is your first PR to karmada-io/karmada 🎉
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/karmada-io/karmada/pull/7899#pullrequestreview-5245109278" title="Approved">RainbowMango</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=karmada-io%2Fkarmada).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/karmada-io/karmada/blob/master/OWNERS)~~ [RainbowMango]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/karmada-io/karmada/pull/7899?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=karmada-io) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 42.47%. Comparing base ([`59900fd`](https://app.codecov.io/gh/karmada-io/karmada/commit/59900fda76f6251eba78f365838dd95574696e76?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=karmada-io)) to head ([`1e1b872`](https://app.codecov.io/gh/karmada-io/karmada/commit/1e1b872f91913e7a2d431839c9a5c73971c9580f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comme

- **Issue #7898** (2026-09-20): **docs: remove retired Go Report Card badge from README**
  *Symptoms*: ## Summary  Remove the retired Go Report Card badge from `README.md`.  The Go Report Card service has been sunset — the badge no longer reflects code quality and the link points to a farewell page, which is misleading to users and contributors.  ## Changes  - Removed the `[![Go Report Card](...)]` line from the badge section in `README.md`.  ## Checklist  - [x] Verified the badge is no longer present in `README.md`. - [x] No other references to Go Report Card remain in the README.  Fixes karmada-io/karmada#7897
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: **Once this PR has been reviewed and has the lgtm label**, please assign [chaunceyjiang](https://github.com/chaunceyjiang) for approval. For more information see [the Code Review Process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process).  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=karmada-io%2Fkarmada).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/karmada-io/karmada/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["chaunceyjiang"]} -->
  > Welcome @yunaremaia! It looks like this is your first PR to karmada-io/karmada 🎉
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/karmada-io/karmada/pull/7898?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=karmada-io) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 42.48%. Comparing base ([`59900fd`](https://app.codecov.io/gh/karmada-io/karmada/commit/59900fda76f6251eba78f365838dd95574696e76?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=karmada-io)) to head ([`e5e57e4`](https://app.codecov.io/gh/karmada-io/karmada/commit/e5e57e4492237ba3b9a622aa18c111d838923cfa?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comme

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

### Incident Patch 1: `960e69b0` (2026-08-31)
**Commit Message**: Merge pull request #7836 from asarj/ci-estimator-assumption-fix

test(e2e): make the NodeResource estimator assumption e2e test capacity-aware

**File**: `test/e2e/suites/base/estimator_test.go` (modified, +114/-24)
```diff
@@ -374,7 +374,7 @@ var _ = framework.SerialDescribe("[EstimatorAssumption] ResourceQuota plugin ass
 		// exceeding the 1000m ResourceQuota. This step verifies that the assumption cache also
 		// protects against over-scheduling of single-template workloads.
 		ginkgo.By("verifying a single-template Deployment requesting 200m CPU is also unschedulable due to assumed workloads", func() {
-			assertSingleTemplateDeploymentUnschedulable(quotaNamespace, targetCluster)
+			assertSingleTemplateDeploymentUnschedulable(quotaNamespace, targetCluster, 200, nil)
 		})
 	})
 })
@@ -423,19 +423,32 @@ var _ = framework.SerialDescribe("[EstimatorAssumption] NodeResource plugin assu
 	})
 
 	ginkgo.It("FlinkDeployment should be unschedulable when assumed workloads exhaust cluster resources", func(ctx context.Context) {
-		// Each FlinkDeployment has jobManager (100m) + taskManager (100m) = 200m total assumed CPU.
-		// We create FlinkDeployments sequentially (each scheduled before the next is created) so the
-		// assumption cache accumulates in-flight CPU on member1. Since no Flink Operator is installed,
-		// no pods are created and no real CPU is consumed, but karmada-scheduler treats these as
-		// assumed workloads. Within maxFlinkCount attempts, at least one must get NoClusterFit,
-		// which proves the assumption feature is working correctly.
+		targetNodeName, targetNodeHostname, availableMilliCPU := mostAvailableSchedulableNodeCPU(ctx, targetCluster)
+		targetNodeSelector := map[string]string{corev1.LabelHostname: targetNodeHostname}
 		const (
-			componentCPU  = 0.1 // 0.1 core (100m) as a number, matching the CRD schema type
-			maxFlinkCount = 50
+			// A FlinkDeployment reserves CPU for one JobManager and one TaskManager.
+			flinkComponentsPerDeployment int64 = 2
+			// Six scheduled deployments are enough to verify that assumed CPU accumulates while keeping the test bounded.
+			targetSchedulableFlinkDeployments int64 = 6
+			// Each component requests at least 50m CPU, even on a small node.
+			minimumComponentMilliCPU int64 = 50
 		)
-
-		// createFlinkDeployment creates a FlinkDeployment with fixed 100m per component and its
-		// PropagationPolicy targeting member1, then returns the ResourceBinding name.
+		// Divide the node's available CPU across the target deployments and their two components.
+		componentMilliCPU := max(minimumComponentMilliCPU,
+			availableMilliCPU/(flinkComponentsPerDeployment*targetSchedulableFlinkDeployments))
+		flinkDeploymentMilliCPU := flinkComponentsPerDeployment * componentMilliCPU
+		gomega.Expect(availableMilliCPU).Should(gomega.BeNumerically(">", flinkDeploymentMilliCPU),
+			"expected enough available CPU on node %q to schedule one FlinkDeployment", targetNodeName)
+		componentCPU := float64(componentMilliCPU) / 1000
+
+		// Create one more deployment than the node can fit, the final one must be unschedulable.
+		maxFlinkCount := int(availableMilliCPU/flinkDeploymentMilliCPU) + 1
+
+		ginkgo.By(fmt.Sprintf("targeting node %q with %dm available CPU, %dm per Flink component, and up to %d FlinkDeployments",
+			targetNodeName, availableMilliCPU, componentMilliCPU, maxFlinkCount))
+
+		// createFlinkDeployment creates a FlinkDeployment with the calculated CPU request,
+		// pins it to the selected node, and returns its ResourceBinding name.
 		createFlinkDeployment := func() string {
 			flinkName := fmt.Sprintf("flinkdeployment-%s", rand.String(RandomStrLength))
 
@@ -444,9 +457,11 @@ var _ = framework.SerialDescribe("[EstimatorAssumption] NodeResource plugin assu
 			gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
 			flinkObj.SetNamespace(testNamespace)
 			flinkObj.SetName(flinkName)
-			err = unstructured.SetNestedField(flinkObj.Object, float64(componentCPU), "spec", "jobManager", "resource", "cpu")
+			err = unstructured.SetNestedField(flinkObj.Object, componentCPU, "spec", "jobManager", "resource", "cpu")
+			gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
+			err = unstruct
```

---

### Incident Patch 2: `78c43861` (2026-08-29)
**Commit Message**: Bump Kubernetes dependencies to v1.36.4 to resolve security concerns

Signed-off-by: Hongcai Ren <qdurenhongcai@gmail.com>

**File**: `go.mod` (modified, +25/-25)
```diff
@@ -27,33 +27,33 @@ require (
 	github.com/vektra/mockery/v3 v3.5.5
 	github.com/yuin/gopher-lua v1.1.1
 	go.uber.org/mock v0.4.0
-	golang.org/x/net v0.55.0
+	golang.org/x/net v0.56.0
 	golang.org/x/oauth2 v0.36.0
-	golang.org/x/term v0.43.0
-	golang.org/x/text v0.37.0
+	golang.org/x/term v0.44.0
+	golang.org/x/text v0.39.0
 	golang.org/x/time v0.15.0
-	golang.org/x/tools v0.45.0
+	golang.org/x/tools v0.47.0
 	gomodules.xyz/jsonpatch/v2 v2.4.0
 	google.golang.org/grpc v1.81.1
 	google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af
-	k8s.io/api v0.36.2
-	k8s.io/apiextensions-apiserver v0.36.2
-	k8s.io/apimachinery v0.36.2
-	k8s.io/apiserver v0.36.2
-	k8s.io/cli-runtime v0.36.2
-	k8s.io/client-go v0.36.2
-	k8s.io/cluster-bootstrap v0.36.2
-	k8s.io/code-generator v0.36.2
-	k8s.io/component-base v0.36.2
-	k8s.io/component-helpers v0.36.2
-	k8s.io/controller-manager v0.36.2
+	k8s.io/api v0.36.4
+	k8s.io/apiextensions-apiserver v0.36.4
+	k8s.io/apimachinery v0.36.4
+	k8s.io/apiserver v0.36.4
+	k8s.io/cli-runtime v0.36.4
+	k8s.io/client-go v0.36.4
+	k8s.io/cluster-bootstrap v0.36.4
+	k8s.io/code-generator v0.36.4
+	k8s.io/component-base v0.36.4
+	k8s.io/component-helpers v0.36.4
+	k8s.io/controller-manager v0.36.4
 	k8s.io/klog/v2 v2.140.0
-	k8s.io/kube-aggregator v0.36.2
+	k8s.io/kube-aggregator v0.36.4
 	k8s.io/kube-openapi v0.0.0-20260520065146-aa012df4f4af
-	k8s.io/kubectl v0.36.2
-	k8s.io/metrics v0.36.2
-	k8s.io/streaming v0.36.2
+	k8s.io/kubectl v0.36.4
+	k8s.io/metrics v0.36.4
+	k8s.io/streaming v0.36.4
 	k8s.io/utils v0.0.0-20260507154919-ff6756f316d2
 	layeh.com/gopher-json v0.0.0-20201124131017-552bb3c4c3bf
 	sigs.k8s.io/cluster-api v1.7.1
@@ -186,12 +186,12 @@ require (
 	go.uber.org/zap v1.28.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/crypto v0.52.0 // indirect
+	golang.org/x/crypto v0.53.0 // indirect
 	golang.org/x/exp v0.0.0-20260529124908-c761662dc8c9 // indirect
-	golang.org/x/mod v0.36.0 // indirect
-	golang.org/x/sync v0.20.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
-	golang.org/x/telemetry v0.0.0-20260508192327-42602be52be6 // indirect
+	golang.org/x/mod v0.37.0 // indirect
+	golang.org/x/sync v0.21.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/telemetry v0.0.0-20260625142307-59b4966ccb57 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
@@ -200,7 +200,7 @@ require (
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 	k8s.io/gengo/v2 v2.0.0-20250922181213-ec3ebc5fd46b // indirect
-	k8s.io/kms v0.36.2 // indirect
+	k8s.io/kms v0.36.4 // indirect
 	sigs.k8s.io/apiserver-network-proxy/konnectivity-client v0.35.0 // indirect
 	sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 // indirect
 	sigs.k8s.io/kustomize/api v0.21.1 // indirect
```

**File**: `go.sum` (modified, +50/-50)
```diff
@@ -686,8 +686,8 @@ golang.org/x/crypto v0.0.0-20190617133340-57b3e21c3d56/go.mod h1:yigFU9vqHzYiE8U
 golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8UmvKecakEJjdnWj3jj499lnFckfCI=
 golang.org/x/crypto v0.0.0-20200220183623-bac4c82f6975/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
-golang.org/x/crypto v0.52.0 h1:RMs7fP2rXdep0CftQlK8Uf+kibLm7qkCcradZWYz988=
-golang.org/x/crypto v0.52.0/go.mod h1:1QgfPxDqh0T2M/elOJtp9RvuR95kVjir0e6/BvEmGbc=
+golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
+golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20260529124908-c761662dc8c9 h1:4d4PbuBNwaxMXkXI8yiIYjydtMU+04RHeuSxJdgKftM=
 golang.org/x/exp v0.0.0-20260529124908-c761662dc8c9/go.mod h1:d2fgXJLVs4dYDHUk5lwMIfzRzSrWCfGZb0ZqeLa/Vcw=
@@ -697,8 +697,8 @@ golang.org/x/lint v0.0.0-20190301231843-5614ed5bae6f/go.mod h1:UVdnD1Gm6xHRNCYTk
 golang.org/x/lint v0.0.0-20190313153728-d0100b6bd8b3/go.mod h1:6SW0HCj/g11FgYtHlgUYUwCkIfeOF89ocIRzGO/8vkc=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
-golang.org/x/mod v0.36.0 h1:JJjpVx6myfUsUdAzZuOSTTmRE0PfZeNWzzvKrP7amb4=
-golang.org/x/mod v0.36.0/go.mod h1:moc6ELqsWcOw5Ef3xVprK5ul/MvtVvkIXLziUOICjUQ=
+golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
+golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
 golang.org/x/net v0.0.0-20170114055629-f2499483f923/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180826012351-8a410e7b638d/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
@@ -721,8 +721,8 @@ golang.org/x/net v0.0.0-20200226121028-0de0cce0169b/go.mod h1:z5CRVTTTmAJ677TzLL
 golang.org/x/net v0.0.0-20200520004742-59133d7f0dd7/go.mod h1:qpuaurCH72eLCgpAm/N6yyVIVM9cpaDIP3A8BGJEC5A=
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
 golang.org/x/net v0.0.0-20211216030914-fe4d6282115f/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -735,8 +735,8 @@ golang.org/x/sync v0.0.0-20190227155943-e225da77a7e6/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20190911185100-cd5d95a43a6e/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.20.0 h1:e0PTpb7pjO8GAtTs2dQ6jYa5BWYlMuX047Dco/pItO4=
-golang.org/x/sync v0.20.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
+golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20170830134202-bb24a47a89ea/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 gola
```

**File**: `vendor/golang.org/x/mod/modfile/read.go` (modified, +3/-5)
```diff
@@ -9,6 +9,7 @@ import (
 	"errors"
 	"fmt"
 	"os"
+	"slices"
 	"strconv"
 	"strings"
 	"unicode"
@@ -105,8 +106,7 @@ func (x *FileSyntax) addLine(hint Expr, tokens ...string) *Line {
 	if hint == nil {
 		// If no hint given, add to the last statement of the given type.
 	Loop:
-		for i := len(x.Stmt) - 1; i >= 0; i-- {
-			stmt := x.Stmt[i]
+		for _, stmt := range slices.Backward(x.Stmt) {
 			switch stmt := stmt.(type) {
 			case *Line:
 				if stmt.Token != nil && stmt.Token[0] == tokens[0] {
@@ -718,9 +718,7 @@ func (in *input) assignComments() {
 	}
 
 	// Assign suffix comments to syntax immediately before.
-	for i := len(in.post) - 1; i >= 0; i-- {
-		x := in.post[i]
-
+	for _, x := range slices.Backward(in.post) {
 		start, end := x.Span()
 		if debug {
 			fmt.Fprintf(os.Stderr, "post %T :%d:%d #%d :%d:%d #%d\n", x, start.Line, start.LineRune, start.Byte, end.Line, end.LineRune, end.Byte)
```

**File**: `vendor/golang.org/x/mod/modfile/rule.go` (modified, +56/-9)
```diff
@@ -327,6 +327,7 @@ func parseToFile(file string, data []byte, fix VersionFixer, strict bool) (parse
 }
 
 var GoVersionRE = lazyregexp.New(`^([1-9][0-9]*)\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))?([a-z]+[0-9]+)?$`)
+
 var laxGoVersionRE = lazyregexp.New(`^v?(([1-9][0-9]*)\.(0|[1-9][0-9]*))([^0-9].*)$`)
 
 // Toolchains must be named beginning with `go1`,
@@ -1272,6 +1273,17 @@ func (f *File) SetRequire(req []*Require) {
 // SetRequireSeparateIndirect will split it into a direct-only and indirect-only
 // block. This aids in the transition to separate blocks.
 func (f *File) SetRequireSeparateIndirect(req []*Require) {
+	f.setRequireSeparateIndirect(req, false)
+}
+
+// SetRequireAtMostTwo is like SetRequireSeparateIndirect but it aggressively
+// consolidates all requirements into at most two blocks (one direct, one indirect).
+// It ignores existing blocks and comments when deciding where to place requirements.
+func (f *File) SetRequireAtMostTwo(req []*Require) {
+	f.setRequireSeparateIndirect(req, true)
+}
+
+func (f *File) setRequireSeparateIndirect(req []*Require, simplify bool) {
 	// hasComments returns whether a line or block has comments
 	// other than "indirect".
 	hasComments := func(c Comments) bool {
@@ -1304,6 +1316,17 @@ func (f *File) SetRequireSeparateIndirect(req []*Require) {
 	}
 
 	// Examine existing require lines and blocks.
+	need := make(map[string]*Require)
+	for _, r := range req {
+		need[r.Mod.Path] = r
+	}
+	lineIndirect := make(map[*Line]bool)
+	for _, r := range f.Require {
+		if n := need[r.Mod.Path]; n != nil {
+			lineIndirect[r.Syntax] = n.Indirect
+		}
+	}
+
 	var (
 		// We may insert new requirements into the last uncommented
 		// direct-only and indirect-only blocks. We may also move requirements
@@ -1321,7 +1344,9 @@ func (f *File) SetRequireSeparateIndirect(req []*Require) {
 
 		// Track the block each requirement belongs to (if any) so we can
 		// move them later.
-		lineToBlock = make(map[*Line]*LineBlock)
+		lineToBlock           = make(map[*Line]*LineBlock)
+		directBlockComments   []Comment
+		indirectBlockComments []Comment
 	)
 	for i, stmt := range f.Syntax.Stmt {
 		switch stmt := stmt.(type) {
@@ -1364,6 +1389,24 @@ func (f *File) SetRequireSeparateIndirect(req []*Require) {
 			if allIndirect {
 				lastIndirectIndex = i
 			}
+			if simplify {
+				anyDirect := false
+				for _, line := range stmt.Line {
+					if ind, ok := lineIndirect[line]; ok && !ind {
+						anyDirect = true
+						break
+					}
+				}
+				target := &directBlockComments
+				if !anyDirect && len(stmt.Line) > 0 {
+					target = &indirectBlockComments
+				}
+				if len(*target) > 0 && len(stmt.Comments.Before) > 0 {
+					*target = append(*target, Comment{Token: "//"})
+				}
+				*target = append(*target, stmt.Comments.Before...)
+				stmt.Comments.Before = nil
+			}
 		}
 	}
 
@@ -1422,6 +1465,15 @@ func (f *File) SetRequireSeparateIndirect(req []*Require) {
 		lastIndirectBlock = ensureBlock(lastIndirectIndex)
 	}
 
+	if simplify {
+		if len(directBlockComments) > 0 {
+			lastDirectBlock.Comments.Before = append(lastDirectBlock.Comments.Before, directBlockComments...)
+		}
+		if len(indirectBlockComments) > 0 {
+			lastIndirectBlock.Comments.Before = append(lastIndirectBlock.Comments.Before, indirectBlockComments...)
+		}
+	}
+
 	// Delete requirements we don't want anymore.
 	// Update versions and indirect comments on requirements we want to keep.
 	// If a requirement is in last{Direct,Indirect}Block with the wrong
@@ -1430,10 +1482,6 @@ func (f *File) SetRequireSeparateIndirect(req []*Require) {
 	// correct block.
 	//
 	// Some blocks may be empty after this. Cleanup will remove them.
-	need := make(map[string]*Require)
-	for _, r := range req {
-		need[r.Mod.Path] = r
-	}
 	have := make(map[string]*Require)
 	for _, r := range f.Require {
 		path := r.Mod.Path
@@ -1446,10 +1494,10 @@ func (f *File) SetRequireSeparateIndirect(req []*Require) {
 		r.setVersion(need[path].Mod.Version)
 		r.setIn
```

**File**: `vendor/golang.org/x/net/html/entity.go` (modified, +2/-3)
```diff
@@ -2156,9 +2156,8 @@ var entity = map[string]rune{
 
 // HTML entities that are two unicode codepoints.
 var entity2 = map[string][2]rune{
-	// TODO(nigeltao): Handle replacements that are wider than their names.
-	// "nLt;":                     {'\u226A', '\u20D2'},
-	// "nGt;":                     {'\u226B', '\u20D2'},
+	"nLt;":                     {'\u226A', '\u20D2'},
+	"nGt;":                     {'\u226B', '\u20D2'},
 	"NotEqualTilde;":           {'\u2242', '\u0338'},
 	"NotGreaterFullEqual;":     {'\u2267', '\u0338'},
 	"NotGreaterGreater;":       {'\u226B', '\u0338'},
```

---

### Incident Patch 3: `61af4b2b` (2026-08-27)
**Commit Message**: Merge pull request #7861 from RainbowMango/pr_fix_operator_e2e_race

Fix flaky karmada-operator readiness check in deploy script

**File**: `hack/deploy-karmada-operator.sh` (modified, +1/-1)
```diff
@@ -70,4 +70,4 @@ kubectl --kubeconfig="${KUBECONFIG}" --context="${CONTEXT_NAME}" apply -f "${REP
 kubectl --kubeconfig="${KUBECONFIG}" --context="${CONTEXT_NAME}" apply -f "${REPO_ROOT}/operator/config/deploy/karmada-operator-deployment.yaml"
 
 # wait karmada-operator ready
-kubectl --kubeconfig="${KUBECONFIG}" --context="${CONTEXT_NAME}" wait --for=condition=Ready --timeout=30s pods -l app.kubernetes.io/name=karmada-operator -n ${KARMADA_SYSTEM_NAMESPACE}
+kubectl --kubeconfig="${KUBECONFIG}" --context="${CONTEXT_NAME}" -n "${KARMADA_SYSTEM_NAMESPACE}" rollout status deployment/karmada-operator --timeout=30s
```

---

### Incident Patch 4: `bdc72ce1` (2026-08-26)
**Commit Message**: Fix flaky karmada-operator readiness check in deploy script

Signed-off-by: Hongcai Ren <qdurenhongcai@gmail.com>

**File**: `hack/deploy-karmada-operator.sh` (modified, +1/-1)
```diff
@@ -70,4 +70,4 @@ kubectl --kubeconfig="${KUBECONFIG}" --context="${CONTEXT_NAME}" apply -f "${REP
 kubectl --kubeconfig="${KUBECONFIG}" --context="${CONTEXT_NAME}" apply -f "${REPO_ROOT}/operator/config/deploy/karmada-operator-deployment.yaml"
 
 # wait karmada-operator ready
-kubectl --kubeconfig="${KUBECONFIG}" --context="${CONTEXT_NAME}" wait --for=condition=Ready --timeout=30s pods -l app.kubernetes.io/name=karmada-operator -n ${KARMADA_SYSTEM_NAMESPACE}
+kubectl --kubeconfig="${KUBECONFIG}" --context="${CONTEXT_NAME}" -n "${KARMADA_SYSTEM_NAMESPACE}" rollout status deployment/karmada-operator --timeout=30s
```

---

### Incident Patch 5: `1d954fcf` (2026-08-13)
**Commit Message**: Merge pull request #7663 from zhuyulicfc49/fix/informer-token-rotation

fix: push-mode informers pick up rotated bearer token without restart

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -28,6 +28,7 @@ require (
 	github.com/yuin/gopher-lua v1.1.1
 	go.uber.org/mock v0.4.0
 	golang.org/x/net v0.55.0
+	golang.org/x/oauth2 v0.36.0
 	golang.org/x/term v0.43.0
 	golang.org/x/text v0.37.0
 	golang.org/x/time v0.15.0
@@ -188,7 +189,6 @@ require (
 	golang.org/x/crypto v0.52.0 // indirect
 	golang.org/x/exp v0.0.0-20260529124908-c761662dc8c9 // indirect
 	golang.org/x/mod v0.36.0 // indirect
-	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.20.0 // indirect
 	golang.org/x/sys v0.45.0 // indirect
 	golang.org/x/telemetry v0.0.0-20260508192327-42602be52be6 // indirect
```

**File**: `pkg/util/membercluster_client.go` (modified, +60/-6)
```diff
@@ -23,12 +23,14 @@ import (
 	"net/url"
 	"time"
 
+	"golang.org/x/oauth2"
 	corev1 "k8s.io/api/core/v1"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/dynamic"
 	kubeclientset "k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/rest"
 	"k8s.io/client-go/scale"
+	"k8s.io/client-go/transport"
 	"k8s.io/client-go/util/flowcontrol"
 	"k8s.io/klog/v2"
 	controllerruntime "sigs.k8s.io/controller-runtime"
@@ -42,6 +44,9 @@ const (
 	defaultTimeout = 32 * time.Second
 )
 
+// tokenRefreshPeriod is how often the cached bearer token is re-read from the Secret.
+var tokenRefreshPeriod = 5 * time.Minute
+
 // ClusterClient stands for a cluster Clientset for the given member cluster
 type ClusterClient struct {
 	KubeClient  *kubeclientset.Clientset
@@ -211,16 +216,15 @@ func BuildClusterConfig(clusterName string,
 		return nil, err
 	}
 
-	token, ok := secret.Data[clusterv1alpha1.SecretTokenKey]
-	if !ok || len(token) == 0 {
-		return nil, fmt.Errorf("the secret for cluster %s is missing a non-empty value for %q", clusterName, clusterv1alpha1.SecretTokenKey)
+	// Validate the token is present; the token source below reads it lazily.
+	if _, err := tokenFromSecret(secret, clusterName); err != nil {
+		return nil, err
 	}
 
 	// Initialize cluster configuration.
 	clusterConfig := &rest.Config{
-		BearerToken: string(token),
-		Host:        apiEndpoint,
-		Timeout:     defaultTimeout,
+		Host:    apiEndpoint,
+		Timeout: defaultTimeout,
 	}
 
 	// Handle TLS configuration.
@@ -248,9 +252,51 @@ func BuildClusterConfig(clusterName string,
 		}
 	}
 
+	// Uses a token source that re-reads the Secret instead of a static token; a 401
+	// clears the cache so a revoked token refreshes immediately.
+	// Wrap after the proxy so the proxy round tripper stays innermost.
+	tokenSource := newSecretTokenSource(clusterName, cluster.Spec.SecretRef.Namespace, cluster.Spec.SecretRef.Name, secretGetter)
+	cachedTokenSource := transport.NewCachedTokenSource(tokenSource)
+	clusterConfig.Wrap(transport.ResettableTokenSourceWrapTransport(cachedTokenSource))
+
 	return clusterConfig, nil
 }
 
+// secretTokenSource reads the bearer token from the cluster's Secret, with a
+// tokenRefreshPeriod expiry so the caching wrapper re-reads it periodically.
+type secretTokenSource struct {
+	clusterName     string
+	secretNamespace string
+	secretName      string
+	secretGetter    func(namespace, name string) (*corev1.Secret, error)
+}
+
+func newSecretTokenSource(clusterName, secretNamespace, secretName string,
+	secretGetter func(string, string) (*corev1.Secret, error)) *secretTokenSource {
+	return &secretTokenSource{
+		clusterName:     clusterName,
+		secretNamespace: secretNamespace,
+		secretName:      secretName,
+		secretGetter:    secretGetter,
+	}
+}
+
+// Token implements oauth2.TokenSource.
+func (s *secretTokenSource) Token() (*oauth2.Token, error) {
+	secret, err := s.secretGetter(s.secretNamespace, s.secretName)
+	if err != nil {
+		return nil, fmt.Errorf("failed to get secret for cluster %s: %v", s.clusterName, err)
+	}
+	token, err := tokenFromSecret(secret, s.clusterName)
+	if err != nil {
+		return nil, err
+	}
+	return &oauth2.Token{
+		AccessToken: string(token),
+		Expiry:      time.Now().Add(tokenRefreshPeriod),
+	}, nil
+}
+
 func clusterGetter(client client.Client) func(string) (*clusterv1alpha1.Cluster, error) {
 	return func(cluster string) (*clusterv1alpha1.Cluster, error) {
 		return GetCluster(client, cluster)
@@ -264,3 +310,11 @@ func secretGetter(client client.Client) func(string, string) (*corev1.Secret, er
 		return secret, err
 	}
 }
+
+func tokenFromSecret(secret *corev1.Secret, clusterName string) ([]byte, error) {
+	token, ok := secret.Data[clusterv1alpha1.SecretTokenKey]
+	if !ok || len(token) == 0 {
+		return nil, fmt.Errorf("the secret for cluster %s is missing a non-empty value for %q", clusterName, clusterv1alpha1.SecretTokenKey)
+	}
+	return token, nil
+}
```

**File**: `pkg/util/membercluster_client_rotation_test.go` (added, +238/-0)
```diff
@@ -0,0 +1,238 @@
+/*
+Copyright 2026 The Karmada Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package util
+
+import (
+	"context"
+	"errors"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/assert"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	fakeclient "sigs.k8s.io/controller-runtime/pkg/client/fake"
+
+	clusterv1alpha1 "github.com/karmada-io/karmada/pkg/apis/cluster/v1alpha1"
+	"github.com/karmada-io/karmada/pkg/util/gclient"
+)
+
+// rotatableTokenServer is a fake member API server that accepts a mutable set of
+// bearer tokens. A request whose token is not currently accepted gets a 401,
+// which lets tests exercise both the periodic-refresh and 401-reset code paths.
+type rotatableTokenServer struct {
+	*httptest.Server
+
+	mu           sync.Mutex
+	accepted     map[string]bool
+	unauthorized atomic.Int32
+	lastAuth     atomic.Value // string
+}
+
+func newRotatableTokenServer(acceptedTokens ...string) *rotatableTokenServer {
+	s := &rotatableTokenServer{accepted: map[string]bool{}}
+	for _, tok := range acceptedTokens {
+		s.accepted[tok] = true
+	}
+	s.lastAuth.Store("")
+	s.Server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		auth := r.Header.Get("Authorization")
+		s.lastAuth.Store(auth)
+
+		token := strings.TrimPrefix(auth, "Bearer ")
+		s.mu.Lock()
+		ok := s.accepted[token]
+		s.mu.Unlock()
+		if !ok {
+			s.unauthorized.Add(1)
+			w.WriteHeader(http.StatusUnauthorized)
+			return
+		}
+		w.Header().Set("Content-Type", "application/json")
+		_, _ = w.Write([]byte(`{"apiVersion":"v1","kind":"Node","metadata":{"name":"foo"}}`))
+	}))
+	return s
+}
+
+// accept replaces the set of tokens the server will accept.
+func (s *rotatableTokenServer) accept(tokens ...string) {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	s.accepted = map[string]bool{}
+	for _, tok := range tokens {
+		s.accepted[tok] = true
+	}
+}
+
+func (s *rotatableTokenServer) seenAuth() string { return s.lastAuth.Load().(string) }
+
+const (
+	tokenRotateTimeout  = 2 * time.Second
+	tokenRotatePollRate = 5 * time.Millisecond
+)
+
+// buildRotationClient builds a long-lived client (as the informers do) pointed at
+// srv, backed by a Secret holding initialToken. It returns the client and the
+// host client so the test can rotate the Secret afterwards.
+func buildRotationClient(t *testing.T, srv *rotatableTokenServer, clusterName, initialToken string) (*ClusterClient, client.Client) {
+	t.Helper()
+	hostClient := fakeclient.NewClientBuilder().WithScheme(gclient.NewSchema()).WithObjects(
+		&clusterv1alpha1.Cluster{
+			ObjectMeta: metav1.ObjectMeta{Name: clusterName},
+			Spec: clusterv1alpha1.ClusterSpec{
+				APIEndpoint: srv.URL,
+				SecretRef:   &clusterv1alpha1.LocalSecretReference{Namespace: "ns1", Name: "secret1"},
+			},
+		},
+		&corev1.Secret{
+			ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Name: "secret1"},
+			Data: map[string][]byte{
+				clusterv1alpha1.SecretTokenKey:  []byte(initialToken),
+				clusterv1alpha1.SecretCADataKey: getCACertFromGTestServer(t, srv.Server),
+			},
+		},
+	).Build()
+
+	clusterClient, err := NewClusterClientSet(clusterName, hostClient, nil)
+	assert.NoError(t, err)
+	return clusterClient, hostClient
+}
+
+// rotateSecretToken updates the token stored in the Karmada Secret.
+func ro
```

---

### Incident Patch 6: `579107d3` (2026-08-09)
**Commit Message**: charts: fix scheduler-estimator component-mode install missing cert secret

Motivation:
The Helm chart's documented "Install component" flow for
karmada-scheduler-estimator is broken. Following the README verbatim
(host install release named "karmada", then a second release
"karmada-scheduler-estimator" with installMode=component) leaves the
scheduler-estimator pod stuck in ContainerCreating with
"MountVolume.SetUp failed ... secret \"karmada-scheduler-estimator-cert\"
not found", exactly as reported.

The volume mount resolves the cert Secret name from
{{ include "karmada.name" . }}-cert, which is Release.Name-cert. Since
the component-mode release is named differently than the host-mode
release that actually created the Secret, the lookup always misses
unless both releases happen to share the same name.

Approach:
Other components already solve this for component-mode installs by
letting the Secret/ConfigMap name be set explicitly instead of derived
from the release name: descheduler.kubeconfig (default
karmada-kubeconfig) and search.certs/search.kubeconfig (default
karmada-cert/karmada-kubeconfig). schedulerEstimator was missing the
equivalent.

Add schedulerEstimator.certs (def

**File**: `charts/karmada/README.md` (modified, +5/-0)
```diff
@@ -253,6 +253,10 @@ schedulerEstimator:
       server: "https://apiserver.member"
 ```
 
+> **Note**: The `karmada-scheduler-estimator` mounts the `karmada-cert` Secret created by the `host` mode
+> installation (default name `karmada-cert`, from the `karmada` release). If your `host` mode release uses a
+> different name, set `schedulerEstimator.certs` to `<host-release-name>-cert` accordingly.
+
 Execute command (switch to the `root` directory of the repo, and sets the `current-context` in a kubeconfig file)
 
 ```console
@@ -438,6 +442,7 @@ helm install karmada-scheduler-estimator -n karmada-system ./charts/karmada
 | `schedulerEstimator.affinity`            | Affinity of the scheduler-estimator                                                                                                                                                                                                           | `{}`                                                                                                                                                                                                                 |
 | `schedulerEstimator.tolerations`         | Tolerations of the scheduler-estimator                                                                                                                                                                                                        | `[]`                                                                                                                                                                                                                 |
 | `schedulerEstimator.featureGates`        | FeatureGates of the scheduler-estimator                                                                                                                                                                                                       | `{"FeatureGateName": "false"}`                                                                                                                                                                                       |
+| `schedulerEstimator.certs`               | Certs of the scheduler-estimator, only used when installMode is not "host"                                                                                                                                                                    | `karmada-cert`                                                                                                                                                                                                       |
 | `search.strategy`                        | Strategy of the scheduler-estimator                                                                                                                                                                                                           | `{"type": "RollingUpdate", "rollingUpdate": {"maxUnavailable": "0", "maxSurge": "50%"} }`                                                                                                                            |
 | `descheduler.labels`                     | Labels of the descheduler deployment                                                                                                                                                                                                          | `karmada-descheduler`                                                                                                                                                                                                |
 | `descheduler.replicaCount`               | Target replicas of the descheduler                                                                                                                                                                                                            | `2`                                                                              
```

**File**: `charts/karmada/templates/_helpers.tpl` (modified, +11/-0)
```diff
@@ -357,6 +357,17 @@ app: {{- include "karmada.name" .}}-search
     secretName: {{ $name }}-cert
 {{- end -}}
 
+{{- define "karmada.schedulerEstimator.cert.volume" -}}
+{{ $name :=  include "karmada.name" . }}
+- name: karmada-certs
+  secret:
+  {{- if eq .Values.installMode "host" }}
+    secretName: {{ $name }}-cert
+  {{- else }}
+    secretName: {{ .Values.schedulerEstimator.certs }}
+  {{- end }}
+{{- end -}}
+
 {{/*
 Common env for POD_IP
 */}}
```

**File**: `charts/karmada/templates/karmada-scheduler-estimator.yaml` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ spec:
           {{- toYaml $.Values.schedulerEstimator.resources | nindent 12 }}
       priorityClassName: {{ $.Values.schedulerEstimator.priorityClassName }}
       volumes:
-      {{- include "karmada.scheduler.cert.volume" $ | nindent 8 }}
+      {{- include "karmada.schedulerEstimator.cert.volume" $ | nindent 8 }}
         - name: member-kubeconfig
           secret:
             secretName: {{ $clusterName }}-kubeconfig
```

**File**: `charts/karmada/values.yaml` (modified, +2/-0)
```diff
@@ -945,6 +945,8 @@ schedulerEstimator:
   featureGates: {}
   ## @param schedulerEstimator.priorityClassName the priority class name for the scheduler-estimator
   priorityClassName: "system-node-critical"
+  ## @param schedulerEstimator.certs certs of the scheduler-estimator, only used when installMode is not "host"
+  certs: karmada-cert
 
 ## descheduler config
 descheduler:
```

---

### Incident Patch 7: `3809f0b1` (2026-08-05)
**Commit Message**: fix: refresh push-mode informer bearer token via client-go transport

Long-lived member cluster informer clients baked the bearer token at construction, so after the member rotated its token the open watch could never re-authenticate on reconnect (healthy but blind, since health checks use fresh per-reconcile clients). Read the token lazily from the Secret via client-go's caching + resettable transport, so it is re-read periodically and immediately after a 401. Replaces the earlier custom token RoundTripper.

Co-authored-by: Hongcai Ren <qdurenhongcai@gmail.com>
Signed-off-by: zhuyulicfc49 <zyliw49@gmail.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -28,6 +28,7 @@ require (
 	github.com/yuin/gopher-lua v1.1.1
 	go.uber.org/mock v0.4.0
 	golang.org/x/net v0.55.0
+	golang.org/x/oauth2 v0.36.0
 	golang.org/x/term v0.43.0
 	golang.org/x/text v0.37.0
 	golang.org/x/time v0.15.0
@@ -188,7 +189,6 @@ require (
 	golang.org/x/crypto v0.52.0 // indirect
 	golang.org/x/exp v0.0.0-20260529124908-c761662dc8c9 // indirect
 	golang.org/x/mod v0.36.0 // indirect
-	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.20.0 // indirect
 	golang.org/x/sys v0.45.0 // indirect
 	golang.org/x/telemetry v0.0.0-20260508192327-42602be52be6 // indirect
```

**File**: `pkg/util/membercluster_client.go` (modified, +58/-12)
```diff
@@ -23,12 +23,14 @@ import (
 	"net/url"
 	"time"
 
+	"golang.org/x/oauth2"
 	corev1 "k8s.io/api/core/v1"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/dynamic"
 	kubeclientset "k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/rest"
 	"k8s.io/client-go/scale"
+	"k8s.io/client-go/transport"
 	"k8s.io/client-go/util/flowcontrol"
 	"k8s.io/klog/v2"
 	controllerruntime "sigs.k8s.io/controller-runtime"
@@ -42,6 +44,9 @@ const (
 	defaultTimeout = 32 * time.Second
 )
 
+// tokenRefreshPeriod is how often the cached bearer token is re-read from the Secret.
+var tokenRefreshPeriod = 5 * time.Minute
+
 // ClusterClient stands for a cluster Clientset for the given member cluster
 type ClusterClient struct {
 	KubeClient  *kubeclientset.Clientset
@@ -211,13 +216,13 @@ func BuildClusterConfig(clusterName string,
 		return nil, err
 	}
 
-	token, ok := secret.Data[clusterv1alpha1.SecretTokenKey]
-	if !ok || len(token) == 0 {
-		return nil, fmt.Errorf("the secret for cluster %s is missing a non-empty value for %q", clusterName, clusterv1alpha1.SecretTokenKey)
+	// Validate the token is present; the token source below reads it lazily.
+	if _, err := tokenFromSecret(secret, clusterName); err != nil {
+		return nil, err
 	}
 
+	// Initialize cluster configuration.
 	clusterConfig := &rest.Config{
-		// BearerToken omitted: injected by the token-refreshing transport below.
 		Host:    apiEndpoint,
 		Timeout: defaultTimeout,
 	}
@@ -247,18 +252,51 @@ func BuildClusterConfig(clusterName string,
 		}
 	}
 
-	// Token-refreshing transport: replaces the built-in bearerAuthRoundTripper
-	// position (outermost) so inner wrappers see auth already set.
-	clusterConfig.Wrap(NewTokenRefreshingRoundTripperWrapperConstructor(
-		secretGetter,
-		cluster.Spec.SecretRef.Namespace,
-		cluster.Spec.SecretRef.Name,
-		string(token),
-	))
+	// Uses a token source that re-reads the Secret instead of a static token; a 401
+	// clears the cache so a revoked token refreshes immediately.
+	// Wrap after the proxy so the proxy round tripper stays innermost.
+	tokenSource := newSecretTokenSource(clusterName, cluster.Spec.SecretRef.Namespace, cluster.Spec.SecretRef.Name, secretGetter)
+	cachedTokenSource := transport.NewCachedTokenSource(tokenSource)
+	clusterConfig.Wrap(transport.ResettableTokenSourceWrapTransport(cachedTokenSource))
 
 	return clusterConfig, nil
 }
 
+// secretTokenSource reads the bearer token from the cluster's Secret, with a
+// tokenRefreshPeriod expiry so the caching wrapper re-reads it periodically.
+type secretTokenSource struct {
+	clusterName     string
+	secretNamespace string
+	secretName      string
+	secretGetter    func(namespace, name string) (*corev1.Secret, error)
+}
+
+func newSecretTokenSource(clusterName, secretNamespace, secretName string,
+	secretGetter func(string, string) (*corev1.Secret, error)) *secretTokenSource {
+	return &secretTokenSource{
+		clusterName:     clusterName,
+		secretNamespace: secretNamespace,
+		secretName:      secretName,
+		secretGetter:    secretGetter,
+	}
+}
+
+// Token implements oauth2.TokenSource.
+func (s *secretTokenSource) Token() (*oauth2.Token, error) {
+	secret, err := s.secretGetter(s.secretNamespace, s.secretName)
+	if err != nil {
+		return nil, fmt.Errorf("failed to get secret for cluster %s: %v", s.clusterName, err)
+	}
+	token, err := tokenFromSecret(secret, s.clusterName)
+	if err != nil {
+		return nil, err
+	}
+	return &oauth2.Token{
+		AccessToken: string(token),
+		Expiry:      time.Now().Add(tokenRefreshPeriod),
+	}, nil
+}
+
 func clusterGetter(client client.Client) func(string) (*clusterv1alpha1.Cluster, error) {
 	return func(cluster string) (*clusterv1alpha1.Cluster, error) {
 		return GetCluster(client, cluster)
@@ -272,3 +310,11 @@ func secretGetter(client client.Client) func(string, string) (*corev1.Secret, er
 		return secret, err
 	}
 }
+
+func tokenFromSecret(secret *corev1.Secret, clusterName string) ([]byte, error) {
+	token, ok := secret.Data[clusterv1alpha1
```

**File**: `pkg/util/membercluster_client_rotation_test.go` (modified, +151/-35)
```diff
@@ -18,8 +18,11 @@ package util
 
 import (
 	"context"
+	"errors"
 	"net/http"
 	"net/http/httptest"
+	"strings"
+	"sync"
 	"sync/atomic"
 	"testing"
 	"time"
@@ -28,26 +31,41 @@ import (
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
+	"sigs.k8s.io/controller-runtime/pkg/client"
 	fakeclient "sigs.k8s.io/controller-runtime/pkg/client/fake"
 
 	clusterv1alpha1 "github.com/karmada-io/karmada/pkg/apis/cluster/v1alpha1"
 	"github.com/karmada-io/karmada/pkg/util/gclient"
 )
 
+// rotatableTokenServer is a fake member API server that accepts a mutable set of
+// bearer tokens. A request whose token is not currently accepted gets a 401,
+// which lets tests exercise both the periodic-refresh and 401-reset code paths.
 type rotatableTokenServer struct {
 	*httptest.Server
-	accepted atomic.Value // string
-	lastAuth atomic.Value // string
+
+	mu           sync.Mutex
+	accepted     map[string]bool
+	unauthorized atomic.Int32
+	lastAuth     atomic.Value // string
 }
 
-func newRotatableTokenServer(initialToken string) *rotatableTokenServer {
-	s := &rotatableTokenServer{}
-	s.accepted.Store(initialToken)
+func newRotatableTokenServer(acceptedTokens ...string) *rotatableTokenServer {
+	s := &rotatableTokenServer{accepted: map[string]bool{}}
+	for _, tok := range acceptedTokens {
+		s.accepted[tok] = true
+	}
 	s.lastAuth.Store("")
 	s.Server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		auth := r.Header.Get("Authorization")
 		s.lastAuth.Store(auth)
-		if auth != "Bearer "+s.accepted.Load().(string) {
+
+		token := strings.TrimPrefix(auth, "Bearer ")
+		s.mu.Lock()
+		ok := s.accepted[token]
+		s.mu.Unlock()
+		if !ok {
+			s.unauthorized.Add(1)
 			w.WriteHeader(http.StatusUnauthorized)
 			return
 		}
@@ -57,30 +75,28 @@ func newRotatableTokenServer(initialToken string) *rotatableTokenServer {
 	return s
 }
 
-func (s *rotatableTokenServer) accept(token string) { s.accepted.Store(token) }
-func (s *rotatableTokenServer) seenAuth() string    { return s.lastAuth.Load().(string) }
+// accept replaces the set of tokens the server will accept.
+func (s *rotatableTokenServer) accept(tokens ...string) {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	s.accepted = map[string]bool{}
+	for _, tok := range tokens {
+		s.accepted[tok] = true
+	}
+}
+
+func (s *rotatableTokenServer) seenAuth() string { return s.lastAuth.Load().(string) }
 
 const (
-	testTokenCacheTTL   = 10 * time.Millisecond
-	tokenRotateTimeout  = 100 * time.Millisecond
+	tokenRotateTimeout  = 2 * time.Second
 	tokenRotatePollRate = 5 * time.Millisecond
 )
 
-// TestBuildClusterConfig_LongLivedClientPicksUpRotatedToken checks that a client built once (as
-// informers are) picks up a rotated token on its own. It:
-//  1. builds the client once,
-//  2. rotates the token in the Secret and the fake API server,
-//  3. asserts the client sends the new token without being rebuilt.
-func TestBuildClusterConfig_LongLivedClientPicksUpRotatedToken(t *testing.T) {
-	origTTL := tokenCacheTTL
-	tokenCacheTTL = testTokenCacheTTL
-	t.Cleanup(func() { tokenCacheTTL = origTTL })
-
-	const clusterName = "member-rotate"
-
-	srv := newRotatableTokenServer("token-A")
-	defer srv.Close()
-
+// buildRotationClient builds a long-lived client (as the informers do) pointed at
+// srv, backed by a Secret holding initialToken. It returns the client and the
+// host client so the test can rotate the Secret afterwards.
+func buildRotationClient(t *testing.T, srv *rotatableTokenServer, clusterName, initialToken string) (*ClusterClient, client.Client) {
+	t.Helper()
 	hostClient := fakeclient.NewClientBuilder().WithScheme(gclient.NewSchema()).WithObjects(
 		&clusterv1alpha1.Cluster{
 			ObjectMeta: metav1.ObjectMeta{Name: clusterName},
@@ -92,31 +108,131 @@ func TestBuildClusterConfig_LongLivedClientPicksUpRotatedToken(t *testing.T) {
 		&corev1.Secret{
 			ObjectMeta: metav1.ObjectMeta{Namespace: "ns1", Na
```

**File**: `pkg/util/round_trippers.go` (modified, +0/-89)
```diff
@@ -20,14 +20,8 @@ import (
 	"net/http"
 	"net/textproto"
 	"strings"
-	"sync"
-	"time"
 
-	corev1 "k8s.io/api/core/v1"
 	"k8s.io/client-go/transport"
-	"k8s.io/klog/v2"
-
-	clusterv1alpha1 "github.com/karmada-io/karmada/pkg/apis/cluster/v1alpha1"
 )
 
 type proxyHeaderRoundTripper struct {
@@ -71,86 +65,3 @@ func parseProxyHeaders(headers map[string]string) http.Header {
 	}
 	return proxyHeaders
 }
-
-// tokenCacheTTL controls how often the token is re-read from the Secret.
-var tokenCacheTTL = 5 * time.Minute
-
-// tokenRefreshingRoundTripper re-reads the member cluster token from the Karmada
-// Secret on a TTL so long-lived informer clients survive token rotation.
-type tokenRefreshingRoundTripper struct {
-	inner        http.RoundTripper
-	secretGetter func(namespace, name string) (*corev1.Secret, error)
-	secretNS     string
-	secretName   string
-
-	mu          sync.RWMutex
-	cachedToken string
-	cacheExpiry time.Time
-}
-
-var _ http.RoundTripper = &tokenRefreshingRoundTripper{}
-
-// WrappedRoundTripper implements utilnet.RoundTripperWrapper.
-func (t *tokenRefreshingRoundTripper) WrappedRoundTripper() http.RoundTripper { return t.inner }
-
-// NewTokenRefreshingRoundTripperWrapperConstructor returns a WrapperFunc that injects a TTL-refreshed bearer token.
-// secretGetter is expected to be informer-backed (in-memory read, not a live API call).
-func NewTokenRefreshingRoundTripperWrapperConstructor(
-	secretGetter func(string, string) (*corev1.Secret, error),
-	secretNS, secretName, initialToken string,
-) transport.WrapperFunc {
-	return func(rt http.RoundTripper) http.RoundTripper {
-		return &tokenRefreshingRoundTripper{
-			inner:        rt,
-			secretGetter: secretGetter,
-			secretNS:     secretNS,
-			secretName:   secretName,
-			cachedToken:  initialToken,
-			cacheExpiry:  time.Now().Add(tokenCacheTTL),
-		}
-	}
-}
-
-// RoundTrip implements the http.RoundTripper interface.
-func (t *tokenRefreshingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
-	req = req.Clone(req.Context())
-	req.Header.Set("Authorization", "Bearer "+t.getToken())
-	return t.inner.RoundTrip(req)
-}
-
-func (t *tokenRefreshingRoundTripper) getToken() string {
-	t.mu.RLock()
-	if time.Now().Before(t.cacheExpiry) {
-		token := t.cachedToken
-		t.mu.RUnlock()
-		return token
-	}
-	t.mu.RUnlock()
-	return t.forceRefresh()
-}
-
-func (t *tokenRefreshingRoundTripper) forceRefresh() string {
-	t.mu.Lock()
-	defer t.mu.Unlock()
-
-	if time.Now().Before(t.cacheExpiry) {
-		return t.cachedToken
-	}
-
-	secret, err := t.secretGetter(t.secretNS, t.secretName)
-	if err != nil {
-		klog.Warningf("tokenRefreshingRoundTripper: failed to refresh token from secret %s/%s, keeping last known token: %v",
-			t.secretNS, t.secretName, err)
-		t.cacheExpiry = time.Now().Add(tokenCacheTTL)
-		return t.cachedToken
-	}
-
-	if token := string(secret.Data[clusterv1alpha1.SecretTokenKey]); token != "" {
-		t.cachedToken = token
-	} else {
-		klog.Warningf("tokenRefreshingRoundTripper: secret %s/%s has empty token key, keeping last known token",
-			t.secretNS, t.secretName)
-	}
-	t.cacheExpiry = time.Now().Add(tokenCacheTTL)
-	return t.cachedToken
-}
```

**File**: `pkg/util/round_trippers_token_test.go` (removed, +0/-164)
```diff
@@ -1,164 +0,0 @@
-/*
-Copyright 2026 The Karmada Authors.
-
-Licensed under the Apache License, Version 2.0 (the "License");
-you may not use this file except in compliance with the License.
-You may obtain a copy of the License at
-
-    http://www.apache.org/licenses/LICENSE-2.0
-
-Unless required by applicable law or agreed to in writing, software
-distributed under the License is distributed on an "AS IS" BASIS,
-WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-See the License for the specific language governing permissions and
-limitations under the License.
-*/
-
-package util
-
-import (
-	"errors"
-	"net/http"
-	"net/http/httptest"
-	"sync"
-	"sync/atomic"
-	"testing"
-	"time"
-
-	"github.com/stretchr/testify/assert"
-	corev1 "k8s.io/api/core/v1"
-
-	clusterv1alpha1 "github.com/karmada-io/karmada/pkg/apis/cluster/v1alpha1"
-)
-
-type recordingRoundTripper struct {
-	mu      sync.Mutex
-	lastReq *http.Request
-}
-
-func (r *recordingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
-	r.mu.Lock()
-	r.lastReq = req
-	r.mu.Unlock()
-	return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody}, nil
-}
-
-func (r *recordingRoundTripper) authHeader() string {
-	r.mu.Lock()
-	defer r.mu.Unlock()
-	return r.lastReq.Header.Get("Authorization")
-}
-
-func tokenSecret(token string) *corev1.Secret {
-	return &corev1.Secret{Data: map[string][]byte{clusterv1alpha1.SecretTokenKey: []byte(token)}}
-}
-
-func newTokenRT(rec http.RoundTripper, getter func(string, string) (*corev1.Secret, error), initialToken string) *tokenRefreshingRoundTripper {
-	return NewTokenRefreshingRoundTripperWrapperConstructor(getter, "ns", "name", initialToken)(rec).(*tokenRefreshingRoundTripper)
-}
-
-func doGet(t *testing.T, rt http.RoundTripper) {
-	t.Helper()
-	req, err := http.NewRequest(http.MethodGet, "https://example.test/api", nil)
-	assert.NoError(t, err)
-	_, err = rt.RoundTrip(req)
-	assert.NoError(t, err)
-}
-
-func TestTokenRefreshingRoundTripper_InjectsToken(t *testing.T) {
-	rec := &recordingRoundTripper{}
-	getter := func(string, string) (*corev1.Secret, error) { return tokenSecret("token-A"), nil }
-	rt := newTokenRT(rec, getter, "token-A")
-
-	req, err := http.NewRequest(http.MethodGet, "https://example.test/api", nil)
-	assert.NoError(t, err)
-	_, err = rt.RoundTrip(req)
-	assert.NoError(t, err)
-
-	assert.Equal(t, "Bearer token-A", rec.authHeader(), "token must be injected into the request sent downstream")
-	assert.Empty(t, req.Header.Get("Authorization"), "the caller's original request must not be mutated")
-}
-
-func TestTokenRefreshingRoundTripper_RefreshesAfterTTL(t *testing.T) {
-	rec := &recordingRoundTripper{}
-	var mu sync.Mutex
-	current := "token-A"
-	getter := func(string, string) (*corev1.Secret, error) {
-		mu.Lock()
-		defer mu.Unlock()
-		return tokenSecret(current), nil
-	}
-	rt := newTokenRT(rec, getter, "token-A")
-
-	mu.Lock()
-	current = "token-B"
-	mu.Unlock()
-	rt.cacheExpiry = time.Now().Add(-time.Minute)
-
-	doGet(t, rt)
-	assert.Equal(t, "Bearer token-B", rec.authHeader(), "rotated token must be picked up after the TTL")
-}
-
-func TestTokenRefreshingRoundTripper_KeepsTokenOnSecretError(t *testing.T) {
-	rec := &recordingRoundTripper{}
-	getter := func(string, string) (*corev1.Secret, error) { return nil, errors.New("temporarily unavailable") }
-	rt := newTokenRT(rec, getter, "token-A")
-	rt.cacheExpiry = time.Now().Add(-time.Minute)
-
-	doGet(t, rt)
-	assert.Equal(t, "Bearer token-A", rec.authHeader(), "on Secret read error the last good token must be retained")
-}
-
-func TestTokenRefreshingRoundTripper_IgnoresEmptyToken(t *testing.T) {
-	rec := &recordingRoundTripper{}
-	getter := func(string, string) (*corev1.Secret, error) { return tokenSecret(""), nil }
-	rt := newTokenRT(rec, getter, "token-A")
-	rt.cacheExpiry = time.Now().Add(-time.Minute)
-
-	doGet(t, rt)
-	assert.Equal(t, "Bearer token-A", rec.authHeader(), "an empty token from the Secret must not ove
```

---

### Incident Patch 8: `6de180f7` (2026-07-31)
**Commit Message**: Merge pull request #5425 from bharathguvvala/rebalancefix

Fixed cluster affinity scheduling evaluation order when scheduling is triggered via WorkloadRebalancer

**File**: `pkg/scheduler/scheduler.go` (modified, +6/-0)
```diff
@@ -631,6 +631,9 @@ func (s *Scheduler) scheduleResourceBindingWithClusterAffinities(rb *workv1alpha
 	)
 
 	affinityIndex := getAffinityIndex(rb.Spec.Placement.ClusterAffinities, rb.Status.SchedulerObservedAffinityName)
+	if util.RescheduleRequired(rb.Spec.RescheduleTriggeredAt, rb.Status.LastScheduledTime) {
+		affinityIndex = 0
+	}
 	updatedStatus := rb.Status.DeepCopy()
 	for affinityIndex < len(rb.Spec.Placement.ClusterAffinities) {
 		klog.V(4).Infof("Schedule ResourceBinding(%s/%s) with clusterAffiliates index(%d)", rb.Namespace, rb.Name, affinityIndex)
@@ -855,6 +858,9 @@ func (s *Scheduler) scheduleClusterResourceBindingWithClusterAffinities(crb *wor
 	)
 
 	affinityIndex := getAffinityIndex(crb.Spec.Placement.ClusterAffinities, crb.Status.SchedulerObservedAffinityName)
+	if util.RescheduleRequired(crb.Spec.RescheduleTriggeredAt, crb.Status.LastScheduledTime) {
+		affinityIndex = 0
+	}
 	updatedStatus := crb.Status.DeepCopy()
 	for affinityIndex < len(crb.Spec.Placement.ClusterAffinities) {
 		klog.V(4).Infof("Schedule ClusterResourceBinding(%s) with clusterAffiliates index(%d)", crb.Name, affinityIndex)
```

---

### Incident Patch 9: `923bf851` (2026-07-31)
**Commit Message**: Potential fix for pull request finding

Signed-off-by: Hongcai Ren <renhongcai@huawei.com>

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `pkg/scheduler/scheduler.go` (modified, +1/-1)
```diff
@@ -858,7 +858,7 @@ func (s *Scheduler) scheduleClusterResourceBindingWithClusterAffinities(crb *wor
 	)
 
 	affinityIndex := getAffinityIndex(crb.Spec.Placement.ClusterAffinities, crb.Status.SchedulerObservedAffinityName)
-	if util.RescheduleRequired(rb.Spec.RescheduleTriggeredAt, rb.Status.LastScheduledTime) {
+	if util.RescheduleRequired(crb.Spec.RescheduleTriggeredAt, crb.Status.LastScheduledTime) {
 		affinityIndex = 0
 	}
 	updatedStatus := crb.Status.DeepCopy()
```

---

### Incident Patch 10: `944e8cf4` (2025-01-14)
**Commit Message**: fixed rebalancer logic

Signed-off-by: Bharath Raghavendra Reddy Guvvala <bharath.raghavendra@gmail.com>

**File**: `pkg/scheduler/scheduler.go` (modified, +6/-0)
```diff
@@ -631,6 +631,9 @@ func (s *Scheduler) scheduleResourceBindingWithClusterAffinities(rb *workv1alpha
 	)
 
 	affinityIndex := getAffinityIndex(rb.Spec.Placement.ClusterAffinities, rb.Status.SchedulerObservedAffinityName)
+	if util.RescheduleRequired(rb.Spec.RescheduleTriggeredAt, rb.Status.LastScheduledTime) {
+		affinityIndex = 0
+	}
 	updatedStatus := rb.Status.DeepCopy()
 	for affinityIndex < len(rb.Spec.Placement.ClusterAffinities) {
 		klog.V(4).Infof("Schedule ResourceBinding(%s/%s) with clusterAffiliates index(%d)", rb.Namespace, rb.Name, affinityIndex)
@@ -855,6 +858,9 @@ func (s *Scheduler) scheduleClusterResourceBindingWithClusterAffinities(crb *wor
 	)
 
 	affinityIndex := getAffinityIndex(crb.Spec.Placement.ClusterAffinities, crb.Status.SchedulerObservedAffinityName)
+	if util.RescheduleRequired(rb.Spec.RescheduleTriggeredAt, rb.Status.LastScheduledTime) {
+		affinityIndex = 0
+	}
 	updatedStatus := crb.Status.DeepCopy()
 	for affinityIndex < len(crb.Spec.Placement.ClusterAffinities) {
 		klog.V(4).Infof("Schedule ClusterResourceBinding(%s) with clusterAffiliates index(%d)", crb.Name, affinityIndex)
```

#### Recent Merged Pull Requests:
- **PR #7908** (2026-09-24): Add release notes for v1.20.0-alpha.1 (@RainbowMango)
- **PR #7904** (2026-09-22): build(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1 (@dependabot[bot])
- **PR #7903** (2026-09-22): build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1 (@dependabot[bot])
- **PR #7902** (2026-09-21): build(deps): bump github/codeql-action/upload-sarif from 4.38.0 to 4.38.1 (@dependabot[bot])
- **PR #7901** (2026-09-21): build(deps): bump docker/setup-qemu-action from 4.3.0 to 4.4.0 (@dependabot[bot])
- **PR #7900** (2026-09-21): build(deps): bump jlumbroso/free-disk-space from 1.3.1 to 2.0.0 (@dependabot[bot])
- **PR #7899** (2026-09-18): docs: remove retired Go Report Card badge from README (@lui01212)
- **PR #7898** (closed): docs: remove retired Go Report Card badge from README (@yunaremaia)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
