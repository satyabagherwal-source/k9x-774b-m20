> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/karmada-io-karmada-learnings.md`  
> **Source**: github ([https://github.com/karmada-io/karmada](https://github.com/karmada-io/karmada))  
> **Source Version**: `d72e8d00`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T15:37:09.854Z  
> **Learning ID**: `learn-github-karmada-io-karmada`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): karmada-io/karmada

> **Canonical Artifact**: `07_PROJECT_LEARNING/karmada-io-karmada-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/karmada-io/karmada](https://github.com/karmada-io/karmada))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-30T15:37:08.962Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `karmada-io/karmada`
- **Description**: Open, Multi-Cloud, Multi-Cluster Kubernetes Orchestration
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5743 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/service-name-resolution-detector-example/app/coredns.go`
```
/*
Copyright 2024 The Karmada Authors.

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

	"github.com/karmada-io/karmada/pkg/servicenameresolutiondetector/coredns"
)

func startCorednsDetector(ctx context.Context, detectorContext detectorContext) (bool, error) {
	detector, err := coredns.NewCorednsDetector(
		detectorContext.memberClient,
		detectorContext.controlPlaneClient,
		detectorContext.sharedInformers,
		detectorContext.lec,
		detectorContext.corednsConfig,
		detectorContext.hostName,
		detectorContext.clusterName,
	)
	if err != nil {
		return false, err
	}
	go detector.Run(ctx)
	return true, nil
}

```

### Core Architecture Module: `cmd/service-name-resolution-detector-example/app/options/coredns.go`
```
/*
Copyright 2024 The Karmada Authors.

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
	"time"

	"github.com/spf13/pflag"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

// CorednsOptions contains options for coredns detector.
type CorednsOptions struct {
	Period           time.Duration
	SuccessThreshold time.Duration
	FailureThreshold time.Duration
	StaleThreshold   time.Duration
}

// NewCorednsOptions return default options for coredns detector.
func NewCorednsOptions() *CorednsOptions {
	return &CorednsOptions{}
}

// AddFlags adds flags of coredns detector to the specified FlagSet.
func (o *CorednsOptions) AddFlags(fs *pflag.FlagSet) {
	fs.DurationVar(&o.Period, "coredns-detect-period", 5*time.Second,
		"Specifies how often detector detects coredns health status.")
	fs.DurationVar(&o.SuccessThreshold, "coredns-success-threshold", 30*time.Second,
		"The duration of successes for the coredns to be considered healthy after recovery.")
	fs.DurationVar(&o.FailureThreshold, "coredns-failure-threshold", 30*time.Second,
		"The duration of failure for the coredns to be considered unhealthy.")
	fs.DurationVar(&o.StaleThreshold, "coredns-stale-threshold", time.Minute,
		"If the node condition of coredns has not been updated for coredns-stale-threshold, it should be considered unknown.")
}

// Complete fills in fields required to have valid data.
func (o *CorednsOptions) Complete() error {
	return nil
}

// Validate checks options and return a slice of found errs.
func (o *CorednsOptions) Validate() field.ErrorList {
	return field.ErrorList{}
}

```

### Core Architecture Module: `cmd/webhook/app/options/options.go`
```
/*
Copyright 2020 The Karmada Authors.

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
	"github.com/spf13/pflag"

	"github.com/karmada-io/karmada/pkg/features"
	"github.com/karmada-io/karmada/pkg/sharedcli/profileflag"
)

const (
	defaultBindAddress   = "0.0.0.0"
	defaultPort          = 8443
	defaultCertDir       = "/tmp/k8s-webhook-server/serving-certs"
	defaultTLSMinVersion = "1.3"
)

// Options contains everything necessary to create and run webhook server.
type Options struct {
	// BindAddress is the IP address on which to listen for the --secure-port port.
	// Default is "0.0.0.0".
	BindAddress string
	// SecurePort is the port that the webhook server serves at.
	// Default is 8443.
	SecurePort int
	// CertDir is the directory that contains the server key and certificate.
	// if not set, webhook server would look up the server key and certificate in {TempDir}/k8s-webhook-server/serving-certs.
	CertDir string
	// CertName is the server certificate name. Defaults to tls.crt.
	CertName string
	// KeyName is the server key name. Defaults to tls.key.
	KeyName string
	// TLSMinVersion is the minimum version of TLS supported. Possible values: 1.0, 1.1, 1.2, 1.3.
	// Some environments have automated security scans that trigger on TLS versions or insecure cipher suites, and
	// setting TLS to 1.3 would solve both problems.
	// Defaults to 1.3.
	TLSMinVersion string
	// KubeAPIQPS is the QPS to use while talking with karmada-apiserver.
	KubeAPIQPS float32
	// KubeAPIBurst is the burst to allow while talking with karmada-apiserver.
	KubeAPIBurst int
	// MetricsBindAddress is the TCP address that the controller should bind to
	// for serving prometheus metrics.
	// It can be set to "0" to disable the metrics serving.
	// Defaults to ":8080".
	MetricsBindAddress string
	// HealthProbeBindAddress is the TCP address that the controller should bind to
	// for serving health probes
	// Defaults to ":8000".
	HealthProbeBindAddress string
	// AllowNoExecuteTaintPolicy indicates that allows configuring taints with NoExecute effect in ClusterTaintPolicy.
	// Given the impact of NoExecute, applying such a taint to a cluster may trigger the eviction of workloads
	// that do not explicitly tolerate it, potentially causing unexpected service disruptions.
	AllowNoExecuteTaintPolicy bool

	ProfileOpts profileflag.Options
}

// NewOptions builds an empty options.
func NewOptions() *Options {
	return &Options{}
}

// AddFlags adds flags to the specified FlagSet.
func (o *Options) AddFlags(flags *pflag.FlagSet) {
	flags.Lookup("kubeconfig").Usage = "Path to karmada control plane kubeconfig file."

	flags.StringVar(&o.BindAddress, "bind-address", defaultBindAddress,
		"The IP address on which to listen for the --secure-port port.")
	flags.IntVar(&o.SecurePort, "secure-port", defaultPort,
		"The secure port on which to serve HTTPS.")
	flags.StringVar(&o.CertDir, "cert-dir", defaultCertDir,
		"The directory that contains the server key and certificate.")
	flags.StringVar(&o.CertName, "tls-cert-file-name", "tls.crt", "The name of server certificate.")
	flags.StringVar(&o.KeyName, "tls-private-key-file-name", "tls.key", "The name of server key.")
	flags.StringVar(&o.TLSMinVersion, "tls-min-version", defaultTLSMinVersion, "Minimum TLS version supported. Possible values: 1.0, 1.1, 1.2, 1.3.")
	flags.Float32Var(&o.KubeAPIQPS, "kube-api-qps", 40.0, "QPS to use while talking with karmada-apiserver.")
	flags.IntVar(&o.KubeAPIBurst, "kube-api-burst", 60, "Burst to use while talking with karmada-apiserver.")
	flags.StringVar(&o.MetricsBindAddress, "metrics-bind-address", ":8080", "The TCP address that the controller should bind to for serving prometheus metrics(e.g. 127.0.0.1:8080, :8080). It can be set to \"0\" to disable the metrics serving.")
	flags.StringVar(&o.HealthProbeBindAddress, "health-probe-bind-address", ":8000", "The TCP address that the controller should bind to for serving health probes(e.g. 127.0.0.1:8000, :8000)")
	flags.BoolVar(&o.AllowNoExecuteTaintPolicy, "allow-no-execute-taint-policy", false, "Allows configuring taints with NoExecute effect in ClusterTaintPolicy. Given the impact of NoExecute, applying such a taint to a cluster may trigger the eviction of workloads that do not explicitly tolerate it, potentially causing unexpected service disruptions. \nThis parameter is designed to remain disabled by default and requires careful evaluation by administrators before being enabled.")

	features.FeatureGate.AddFlag(flags)
	o.ProfileOpts.AddFlags(flags)
}

```

### Core Architecture Module: `cmd/webhook/app/options/validation.go`
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
	"net"

	"k8s.io/apimachinery/pkg/util/validation/field"
)

// Validate checks Options and return a slice of found errs.
func (o *Options) Validate() field.ErrorList {
	errs := field.ErrorList{}

	newPath := field.NewPath("Options")
	if net.ParseIP(o.BindAddress) == nil {
		errs = append(errs, field.Invalid(newPath.Child("BindAddress"), o.BindAddress, "not a valid textual representation of an IP address"))
	}

	if o.SecurePort < 0 || o.SecurePort > 65535 {
		errs = append(errs, field.Invalid(newPath.Child("SecurePort"), o.SecurePort, "must be a valid port between 0 and 65535 inclusive"))
	}

	return errs
}

```

### Core Architecture Module: `cmd/webhook/app/webhook.go`
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
	"crypto/tls"
	"flag"
	"fmt"
	"net/http"

	"github.com/spf13/cobra"
	"k8s.io/client-go/util/flowcontrol"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/component-base/logs"
	logsv1 "k8s.io/component-base/logs/api/v1"
	"k8s.io/component-base/term"
	"k8s.io/klog/v2"
	controllerruntime "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	ctrlmetrics "sigs.k8s.io/controller-runtime/pkg/metrics"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/webhook"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
	"sigs.k8s.io/controller-runtime/pkg/webhook/conversion"

	"github.com/karmada-io/karmada/cmd/webhook/app/options"
	"github.com/karmada-io/karmada/pkg/features"
	versionmetrics "github.com/karmada-io/karmada/pkg/metrics"
	"github.com/karmada-io/karmada/pkg/sharedcli"
	"github.com/karmada-io/karmada/pkg/sharedcli/klogflag"
	"github.com/karmada-io/karmada/pkg/sharedcli/profileflag"
	"github.com/karmada-io/karmada/pkg/util/gclient"
	"github.com/karmada-io/karmada/pkg/util/names"
	"github.com/karmada-io/karmada/pkg/version"
	"github.com/karmada-io/karmada/pkg/version/sharedcommand"
	"github.com/karmada-io/karmada/pkg/webhook/clusteroverridepolicy"
	"github.com/karmada-io/karmada/pkg/webhook/clusterpropagationpolicy"
	"github.com/karmada-io/karmada/pkg/webhook/clusterresourcebinding"
	"github.com/karmada-io/karmada/pkg/webhook/clustertaintpolicy"
	"github.com/karmada-io/karmada/pkg/webhook/configuration"
	"github.com/karmada-io/karmada/pkg/webhook/cronfederatedhpa"
	"github.com/karmada-io/karmada/pkg/webhook/federatedhpa"
	"github.com/karmada-io/karmada/pkg/webhook/federatedresourcequota"
	"github.com/karmada-io/karmada/pkg/webhook/multiclusteringress"
	"github.com/karmada-io/karmada/pkg/webhook/multiclusterservice"
	"github.com/karmada-io/karmada/pkg/webhook/overridepolicy"
	"github.com/karmada-io/karmada/pkg/webhook/propagationpolicy"
	"github.com/karmada-io/karmada/pkg/webhook/resourcebinding"
	"github.com/karmada-io/karmada/pkg/webhook/resourcedeletionprotection"
	"github.com/karmada-io/karmada/pkg/webhook/resourceinterpretercustomization"
	"github.com/karmada-io/karmada/pkg/webhook/work"
)

// NewWebhookCommand creates a *cobra.Command object with default parameters
func NewWebhookCommand(ctx context.Context) *cobra.Command {
	logConfig := logsv1.NewLoggingConfiguration()
	fss := cliflag.NamedFlagSets{}

	logsFlagSet := fss.FlagSet("logs")
	logs.AddFlags(logsFlagSet, logs.SkipLoggingConfigurationFlags())
	logsv1.AddFlags(logConfig, logsFlagSet)
	klogflag.Add(logsFlagSet)

	genericFlagSet := fss.FlagSet("generic")
	opts := options.NewOptions()
	genericFlagSet.AddGoFlagSet(flag.CommandLine)
	opts.AddFlags(genericFlagSet)

	cmd := &cobra.Command{
		Use: names.KarmadaWebhookComponentName,
		Long: `The karmada-webhook starts a webhook server and manages policies about how to mutate and validate
Karmada resources including 'PropagationPolicy', 'OverridePolicy' and so on.`,
		PersistentPreRunE: func(_ *cobra.Command, _ []string) error {
			if err := logsv1.ValidateAndApply(logConfig, features.FeatureGate); err != nil {
				return err
			}
			logs.InitLogs()

			// Starting from version 0.15.0, controller-runtime expects its consumers to set a logger through log.SetLogger.
			// If SetLogger is not called within the first 30 seconds of a binaries lifetime, it will get
			// set to a NullLogSink and report an error. Here's to silence the "log.SetLogger(...) was never called; logs will not be displayed" error
			// by setting a logger through log.SetLogger.
			// More info refer to: https://github.com/karmada-io/karmada/pull/4885.
			controllerruntime.SetLogger(klog.Background())
			return nil
		},
		RunE: func(_ *cobra.Command, _ []string) error {
			// validate options
			if errs := opts.Validate(); len(errs) != 0 {
				return errs.ToAggregate()
			}
			if err := Run(ctx, opts); err != nil {
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

	cmd.AddCommand(sharedcommand.NewCmdVersion(names.KarmadaWebhookComponentName))
	cmd.Flags().AddFlagSet(genericFlagSet)
	cmd.Flags().AddFlagSet(logsFlagSet)

	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	sharedcli.SetUsageAndHelpFunc(cmd, fss, cols)
	return cmd
}

// Run runs the webhook server with options. This should never exit.
func Run(ctx context.Context, opts *options.Options) error {
	klog.Infof("karmada-webhook version: %s", version.Get())

	profileflag.ListenAndServe(opts.ProfileOpts)

	config, err := controllerruntime.GetConfig()
	if err != nil {
		panic(err)
	}
	config.RateLimiter = flowcontrol.NewTokenBucketRateLimiter(opts.KubeAPIQPS, opts.KubeAPIBurst)

	hookManager, err := controllerruntime.NewManager(config, controllerruntime.Options{
		Logger: klog.Background(),
		Scheme: gclient.NewSchema(),
		WebhookServer: webhook.NewServer(webhook.Options{
			Host:     opts.BindAddress,
			Port:     opts.SecurePort,
			CertDir:  opts.CertDir,
			CertName: opts.CertName,
			KeyName:  opts.KeyName,
			TLSOpts: []func(*tls.Config){
				func(config *tls.Config) {
					// Just transform the valid options as opts.TLSMinVersion
					// can only accept "1.0", "1.1", "1.2", "1.3" and has default
					// value,
					switch opts.TLSMinVersion {
					case "1.0":
						config.MinVersion = tls.VersionTLS10
					case "1.1":
						config.MinVersion = tls.VersionTLS11
					case "1.2":
						config.MinVersion = tls.VersionTLS12
					case "1.3":
						config.MinVersion = tls.VersionTLS13
					}
				},
			},
		}),
		LeaderElection:         false,
		Metrics:                metricsserver.Options{BindAddress: opts.MetricsBindAddress},
		HealthProbeBindAddress: opts.HealthProbeBindAddress,
	})
	if err != nil {
		klog.Errorf("Failed to build webhook server: %v", err)
		return err
	}

	decoder := admission.NewDecoder(hookManager.GetScheme())

	klog.Info("Registering webhooks to the webhook server")
	hookServer := hookManager.GetWebhookServer()

	// autoscaling group
	// CronFederatedHPA
	hookServer.Register("/validate-cronfederatedhpa", &webhook.Admission{Handler: &cronfederatedhpa.ValidatingAdmission{Decoder: decoder}})
	// FederatedHPA
	hookServer.Register("/mutate-federatedhpa", &webhook.Admission{Handler: &federatedhpa.MutatingAdmission{Decoder: decoder}})
	hookServer.Register("/validate-federatedhpa", &webhook.Admission{Handler: &federatedhpa.ValidatingAdmission{Decoder: decoder}})

	// config group
	// ResourceInterpreterCustomization
	hookServer.Register("/validate-resourceinterpretercustomization", &webhook.Admission{Handler: &resourceinterpretercustomization.ValidatingAdmission{Client: hookManager.GetClient(), Decoder: decoder}})
	// ResourceInterpreterWebhookConfiguration
	hookServer.Register("/validate-resourceinterpreterwebhookconfiguration", &webhook.Admission{Handler: &configuration.ValidatingAdmission{Decoder: decoder}})

	// networking group
	// MultiClusterIngress
	hookServer.Register("/validate-multiclusteringress", &webhook.Admission{Handler: &multiclusteringress.ValidatingAdmission{Decoder: decoder}})
	// MultiClusterService
	hookServer.Register("/mutate-multiclusterservice", &webhook.Admission{Handler: &multiclusterservice.MutatingAdmission{Decoder: decoder}})
	hookServer.Register("/validate-multiclusterservice", &webhook.Admission{Handler: &multiclusterservice.ValidatingAdmission{Decoder: decoder}})

	// policy group
	// ClusterOverridePolicy
	hookServer.Register("/validate-clusteroverridepolicy", &webhook.Admission{Handler: &clusteroverridepolicy.ValidatingAdmission{Decoder: decoder}})
	// ClusterPropagationPolicy
	hookServer.Register("/mutate-clusterpropagationpolicy", &webhook.Admission{Handler: clusterpropagationpolicy.NewMutatingHandler(decoder)})
	hookServer.Register("/validate-clusterpropagationpolicy", &webhook.Admission{Handler: &clusterpropagationpolicy.ValidatingAdmission{Decoder: decoder}})
	// ClusterTaintPolicy
	hookServer.Register("/validate-clustertaintpolicy", &webhook.Admission{Handler: &clustertaintpolicy.ValidatingAdmission{Decoder: decoder, AllowNoExecuteTaintPolicy: opts.AllowNoExecuteTaintPolicy}})
	// FederatedResourceQuota
	hookServer.Register("/validate-federatedresourcequota", &webhook.Admission{Handler: &federatedresourcequota.ValidatingAdmission{Decoder: decoder}})
	// OverridePolicy
	hookServer.Register("/mutate-overridepolicy", &webhook.Admission{Handler: &overridepolicy.MutatingAdmission{Decoder: decoder}})
	hookServer.Register("/validate-overridepolicy", &webhook.Admission{Handler: &overridepolicy.ValidatingAdmission{Decoder: decoder}})
	// PropagationPolicy
	hookServer.Register("/mutate-propagationpolicy", &webhook.Admission{Handler: propagationpolicy.NewMutatingHandler(decoder)})
	hookServer.Register("/validate-propagationpolicy", &webhook.Admission{Handler: &propagationpolicy.ValidatingAdmission{Decoder: decoder}})

	// work group
	// ClusterResourceBinding
	hookServer.Register("/mutate-clusterresourcebinding", &webhook.Admission{Handler: &clusterresourcebinding.MutatingAdmission{Decoder: decoder}})
	// ResourceBinding
	hookServer.Register("/validate-resourcebinding", &webhook.Admission{Handler: &resourcebinding.ValidatingAdmission{Client: hookManag
```

### Core Architecture Module: `cmd/webhook/main.go`
```
/*
Copyright 2020 The Karmada Authors.

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
	controllerruntime "sigs.k8s.io/controller-runtime"

	"github.com/karmada-io/karmada/cmd/webhook/app"
)

func main() {
	ctx := controllerruntime.SetupSignalHandler()
	cmd := app.NewWebhookCommand(ctx)
	exitCode := cli.Run(cmd)
	// Ensure any buffered log entries are flushed
	logs.FlushLogs()
	os.Exit(exitCode)
}

```

### Core Architecture Module: `examples/customresourceinterpreter/webhook/app/options/options.go`
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
	"github.com/spf13/pflag"
)

const (
	defaultBindAddress = "0.0.0.0"
	defaultPort        = 8445
	defaultCertDir     = "/tmp/k8s-webhook-server/serving-certs"
)

// Options contains everything necessary to create and run webhook server.
type Options struct {
	BindAddress string
	SecurePort  int
	CertDir     string
}

// NewOptions builds an empty options.
func NewOptions() *Options {
	return &Options{}
}

// AddFlags adds flags to the specified FlagSet.
func (o *Options) AddFlags(flags *pflag.FlagSet) {
	flags.StringVar(&o.BindAddress, "bind-address", defaultBindAddress, "The IP address on which to listen for the --secure-port port.")
	flags.IntVar(&o.SecurePort, "secure-port", defaultPort, "The secure port on which to serve HTTPS.")
	flags.StringVar(&o.CertDir, "cert-dir", defaultCertDir, "The directory that contains the server key(named tls.key) and certificate(named tls.crt).")
}

```

### Core Architecture Module: `examples/customresourceinterpreter/webhook/app/options/validation.go`
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
	"net"

	"k8s.io/apimachinery/pkg/util/validation/field"
)

// Validate checks Options and return a slice of found errs.
func (o *Options) Validate() field.ErrorList {
	errs := field.ErrorList{}
	rootPath := field.NewPath("Options")

	if net.ParseIP(o.BindAddress) == nil {
		errs = append(errs, field.Invalid(rootPath.Child("BindAddress"), o.BindAddress, "not a valid textual representation of an IP address"))
	}

	if o.SecurePort < 0 || o.SecurePort > 65535 {
		errs = append(errs, field.Invalid(rootPath.Child("SecurePort"), o.SecurePort, "must be a valid port between 0 and 65535 inclusive"))
	}

	return errs
}

```

### Core Architecture Module: `examples/customresourceinterpreter/webhook/app/webhook.go`
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
	"net/http"
	"os"

	"github.com/spf13/cobra"
	cliflag "k8s.io/component-base/cli/flag"
	"k8s.io/component-base/term"
	"k8s.io/klog/v2"
	controllerruntime "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	"github.com/karmada-io/karmada/examples/customresourceinterpreter/webhook/app/options"
	"github.com/karmada-io/karmada/pkg/sharedcli"
	"github.com/karmada-io/karmada/pkg/sharedcli/klogflag"
	"github.com/karmada-io/karmada/pkg/util/gclient"
	"github.com/karmada-io/karmada/pkg/version/sharedcommand"
	"github.com/karmada-io/karmada/pkg/webhook/interpreter"
)

// NewWebhookCommand creates a *cobra.Command object with default parameters
func NewWebhookCommand(ctx context.Context) *cobra.Command {
	opts := options.NewOptions()

	cmd := &cobra.Command{
		Use: "karmada-interpreter-webhook-example",
		Run: func(_ *cobra.Command, _ []string) {
			// validate options
			if errs := opts.Validate(); len(errs) != 0 {
				fmt.Fprintf(os.Stderr, "configuration is not valid: %v\n", errs.ToAggregate())
				os.Exit(1)
			}

			if err := Run(ctx, opts); err != nil {
				fmt.Fprintf(os.Stderr, "%v\n", err)
				os.Exit(1)
			}
		},
	}

	fss := cliflag.NamedFlagSets{}

	genericFlagSet := fss.FlagSet("generic")
	genericFlagSet.AddGoFlagSet(flag.CommandLine)
	opts.AddFlags(genericFlagSet)

	// Set klog flags
	logsFlagSet := fss.FlagSet("logs")
	klogflag.Add(logsFlagSet)

	cmd.AddCommand(sharedcommand.NewCmdVersion("karmada-interpreter-webhook-example"))
	cmd.Flags().AddFlagSet(genericFlagSet)
	cmd.Flags().AddFlagSet(logsFlagSet)

	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	sharedcli.SetUsageAndHelpFunc(cmd, fss, cols)
	return cmd
}

// Run runs the webhook server with options. This should never exit.
func Run(ctx context.Context, opts *options.Options) error {
	config, err := controllerruntime.GetConfig()
	if err != nil {
		panic(err)
	}

	hookManager, err := controllerruntime.NewManager(config, controllerruntime.Options{
		Logger: klog.Background(),
		WebhookServer: webhook.NewServer(webhook.Options{
			Host:    opts.BindAddress,
			Port:    opts.SecurePort,
			CertDir: opts.CertDir,
		}),
		LeaderElection: false,
	})
	if err != nil {
		klog.Errorf("Failed to build webhook server: %v", err)
		return err
	}

	klog.Info("Registering webhooks to the webhook server")
	hookServer := hookManager.GetWebhookServer()
	hookServer.Register("/interpreter-workload", interpreter.NewWebhook(&workloadInterpreter{}, interpreter.NewDecoder(gclient.NewSchema())))
	hookServer.WebhookMux().Handle("/readyz/", http.StripPrefix("/readyz/", &healthz.Handler{}))

	// blocks until the context is done.
	if err := hookManager.Start(ctx); err != nil {
		klog.Errorf("Webhook server exits unexpectedly: %v", err)
		return err
	}

	// never reach here
	return nil
}

```

### Core Architecture Module: `examples/customresourceinterpreter/webhook/app/workloadwebhook.go`
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
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/klog/v2"

	workloadv1alpha1 "github.com/karmada-io/karmada/examples/customresourceinterpreter/apis/workload/v1alpha1"
	configv1alpha1 "github.com/karmada-io/karmada/pkg/apis/config/v1alpha1"
	workv1alpha2 "github.com/karmada-io/karmada/pkg/apis/work/v1alpha2"
	"github.com/karmada-io/karmada/pkg/webhook/interpreter"
)

// Check if our workloadInterpreter implements necessary interface
var _ interpreter.Handler = &workloadInterpreter{}
var _ interpreter.DecoderInjector = &workloadInterpreter{}

// workloadInterpreter explore resource with request operation.
type workloadInterpreter struct {
	decoder *interpreter.Decoder
}

// Handle implements interpreter.Handler interface.
// It yields a response to an ExploreRequest.
func (e *workloadInterpreter) Handle(_ context.Context, req interpreter.Request) interpreter.Response {
	workload := &workloadv1alpha1.Workload{}
	err := e.decoder.Decode(req, workload)
	if err != nil {
		return interpreter.Errored(http.StatusBadRequest, err)
	}
	klog.Infof("Explore workload(%s/%s) for request: %s", workload.GetNamespace(), workload.GetName(), req.Operation)

	switch req.Operation {
	case configv1alpha1.InterpreterOperationInterpretReplica:
		return e.responseWithExploreReplica(workload)
	case configv1alpha1.InterpreterOperationInterpretComponent:
		return e.responseWithExploreComponent(workload)
	case configv1alpha1.InterpreterOperationReviseReplica:
		return e.responseWithExploreReviseReplica(workload, req)
	case configv1alpha1.InterpreterOperationRetain:
		return e.responseWithExploreRetaining(workload, req)
	case configv1alpha1.InterpreterOperationAggregateStatus:
		return e.responseWithExploreAggregateStatus(workload, req)
	case configv1alpha1.InterpreterOperationInterpretHealth:
		return e.responseWithExploreInterpretHealth(workload)
	case configv1alpha1.InterpreterOperationInterpretStatus:
		return e.responseWithExploreInterpretStatus(workload)
	case configv1alpha1.InterpreterOperationInterpretDependency:
		return e.responseWithExploreDependency(workload)
	default:
		return interpreter.Errored(http.StatusBadRequest, fmt.Errorf("wrong request operation type: %s", req.Operation))
	}
}

// InjectDecoder implements interpreter.DecoderInjector interface.
func (e *workloadInterpreter) InjectDecoder(d *interpreter.Decoder) {
	e.decoder = d
}

func (e *workloadInterpreter) responseWithExploreReplica(workload *workloadv1alpha1.Workload) interpreter.Response {
	res := interpreter.Succeeded("")
	replicas := new(int32(1))
	if workload.Spec.Replicas != nil {
		replicas = workload.Spec.Replicas
	}
	res.Replicas = replicas
	return res
}

func (e *workloadInterpreter) responseWithExploreComponent(workload *workloadv1alpha1.Workload) interpreter.Response {
	res := interpreter.Succeeded("")
	replicas := int32(1)
	if workload.Spec.Replicas != nil {
		replicas = *workload.Spec.Replicas
	}
	res.Components = []workv1alpha2.Component{
		{
			Name:     "main",
			Replicas: replicas,
		},
	}
	return res
}

func (e *workloadInterpreter) responseWithExploreDependency(workload *workloadv1alpha1.Workload) interpreter.Response {
	res := interpreter.Succeeded("")
	res.Dependencies = []configv1alpha1.DependentObjectReference{{APIVersion: "v1", Kind: "ConfigMap",
		Namespace: workload.Namespace, Name: workload.Spec.Template.Spec.Containers[0].EnvFrom[0].ConfigMapRef.Name}}
	return res
}

func (e *workloadInterpreter) responseWithExploreReviseReplica(workload *workloadv1alpha1.Workload, req interpreter.Request) interpreter.Response {
	wantedWorkload := workload.DeepCopy()
	wantedWorkload.Spec.Replicas = req.DesiredReplicas
	marshaledBytes, err := json.Marshal(wantedWorkload)
	if err != nil {
		return interpreter.Errored(http.StatusInternalServerError, err)
	}
	return interpreter.PatchResponseFromRaw(req.Object.Raw, marshaledBytes)
}

func (e *workloadInterpreter) responseWithExploreRetaining(desiredWorkload *workloadv1alpha1.Workload, req interpreter.Request) interpreter.Response {
	if req.ObservedObject == nil {
		err := fmt.Errorf("nil observedObject in exploreReview with operation type: %s", req.Operation)
		return interpreter.Errored(http.StatusBadRequest, err)
	}
	observerWorkload := &workloadv1alpha1.Workload{}
	err := e.decoder.DecodeRaw(*req.ObservedObject, observerWorkload)
	if err != nil {
		return interpreter.Errored(http.StatusBadRequest, err)
	}

	// Suppose we want to retain the `.spec.paused` field of the actual observed workload object in member cluster,
	// and prevent from being overwritten by karmada controller-plane.
	wantedWorkload := desiredWorkload.DeepCopy()
	wantedWorkload.Spec.Paused = observerWorkload.Spec.Paused
	marshaledBytes, err := json.Marshal(wantedWorkload)
	if err != nil {
		return interpreter.Errored(http.StatusInternalServerError, err)
	}
	return interpreter.PatchResponseFromRaw(req.Object.Raw, marshaledBytes)
}

func (e *workloadInterpreter) responseWithExploreAggregateStatus(workload *workloadv1alpha1.Workload, req interpreter.Request) interpreter.Response {
	wantedWorkload := workload.DeepCopy()
	var readyReplicas int32
	for _, item := range req.AggregatedStatus {
		if item.Status == nil {
			continue
		}
		status := &workloadv1alpha1.WorkloadStatus{}
		if err := json.Unmarshal(item.Status.Raw, status); err != nil {
			return interpreter.Errored(http.StatusInternalServerError, err)
		}
		readyReplicas += status.ReadyReplicas
	}
	wantedWorkload.Status.ReadyReplicas = readyReplicas
	marshaledBytes, err := json.Marshal(wantedWorkload)
	if err != nil {
		return interpreter.Errored(http.StatusInternalServerError, err)
	}
	return interpreter.PatchResponseFromRaw(req.Object.Raw, marshaledBytes)
}

func (e *workloadInterpreter) responseWithExploreInterpretHealth(workload *workloadv1alpha1.Workload) interpreter.Response {
	healthy := new(false)
	if workload.Status.ReadyReplicas == *workload.Spec.Replicas {
		healthy = new(true)
	}

	res := interpreter.Succeeded("")
	res.Healthy = healthy
	return res
}

func (e *workloadInterpreter) responseWithExploreInterpretStatus(workload *workloadv1alpha1.Workload) interpreter.Response {
	status := workloadv1alpha1.WorkloadStatus{
		ReadyReplicas: workload.Status.ReadyReplicas,
	}

	marshaledBytes, err := json.Marshal(status)
	if err != nil {
		return interpreter.Errored(http.StatusInternalServerError, err)
	}

	res := interpreter.Succeeded("")
	res.RawStatus = &runtime.RawExtension{
		Raw: marshaledBytes,
	}

	return res
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7997** (2026-10-30): **chore(operator): bump default Kubernetes and etcd versions**
  *Symptoms*: **What type of PR is this?**  /kind cleanup  **What this PR does / why we need it:**  - Updates the default Kubernetes component image versions to `v1.37.1` for kube-apiserver and kube-controller-manager. - Updates the default etcd image version to `3.7.0-0`.  **Which issue(s) this PR fixes:**  Part of #7975  **Special notes for your reviewer:**  **Does this PR introduce a user-facing change?**  ```text `karmada-operator`: Updated the default `kube-apiserver` and `kube-controller-manager` images from v1.36.2 to v1.37.1, and the default `etcd` image from 3.6.8-0 to 3.7.0-0. ```

- **Issue #7995** (2026-10-30): **fix(e2e): retry karmadactl top checks on transient metrics failures**
  *Symptoms*: **What type of PR is this?** /kind flake <!-- Add one of the following kinds: /kind bug /kind feature /kind documentation /kind cleanup  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression  -->  **What this PR does / why we need it**: E2E link: https://github.com/karmada-io/karmada/actions/runs/40663180013/job/122735137115?pr=7992  The `Karmadactl top existing pod` E2E test has been failing intermittently because metrics-server returns no Pod metrics even after the metrics readiness check has succeeded.  A successful readiness check only confirms that metrics are available at that moment; it does not guarantee their continued availability. This PR therefore removes the separate metrics readiness check and uses bounded polling around the actual `karmadactl top` invocations instead.   The underlying cause remains unconfirmed because the CI artifacts do not include `metrics-server` logs from the affected member cluster. AI-assisted analysis suggested several possible explanations:  - A failed kubelet scrape could temporarily remove previously available metrics from metrics-server’s refreshed sample storage. - Incomplete container samples could prevent metrics-server from returning metrics for the entire Pod. - Container or metrics-server restarts could invalidate the sample history needed to calculate CPU usage.  These are hypotheses, not verified causes of this failure.   **Which iss

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

### Incident Patch 1: `5b78ee0e` (2026-10-29)
**Commit Message**: fix(e2e): retry karmadactl top checks on transient metrics failures

Signed-off-by: zhzhuang-zju <[REDACTED_EMAIL]>

**File**: `test/e2e/framework/constant.go` (modified, +0/-2)
```diff
@@ -27,8 +27,6 @@ const (
 	PollInterval = 5 * time.Second
 	// PollTimeout defines the time after which the poll operation times out.
 	PollTimeout = 420 * time.Second
-	// metricsCreationDelay defines the maximum time metrics not yet available for pod.
-	metricsCreationDelay = 2 * time.Minute
 )
 
 const (
```

**File**: `test/e2e/framework/pod.go` (modified, +0/-31)
```diff
@@ -29,11 +29,6 @@ import (
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/klog/v2"
-	metricsclientset "k8s.io/metrics/pkg/client/clientset/versioned"
-
-	clusterv1alpha1 "github.com/karmada-io/karmada/pkg/apis/cluster/v1alpha1"
-	karmada "github.com/karmada-io/karmada/pkg/generated/clientset/versioned"
-	"github.com/karmada-io/karmada/pkg/util"
 )
 
 // CreatePod create Pod.
@@ -68,32 +63,6 @@ func WaitPodPresentOnClusterFitWith(cluster, namespace, name string, fit func(po
 	}, PollTimeout, PollInterval).Should(gomega.Equal(true))
 }
 
-// WaitPodMetricsReady wait podMetrics to be ready.
-func WaitPodMetricsReady(kubeClient kubernetes.Interface, karmadaClient karmada.Interface, cluster, namespace, name string) {
-	clusterGetter := func(cluster string) (*clusterv1alpha1.Cluster, error) {
-		return karmadaClient.ClusterV1alpha1().Clusters().Get(context.Background(), cluster, metav1.GetOptions{})
-	}
-	secretGetter := func(namespace string, name string) (*corev1.Secret, error) {
-		return kubeClient.CoreV1().Secrets(namespace).Get(context.Background(), name, metav1.GetOptions{})
-	}
-	config, err := util.BuildClusterConfig(cluster, clusterGetter, secretGetter)
-	gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
-	metricsClient, err := metricsclientset.NewForConfig(config)
-	gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
-	gomega.Eventually(func() bool {
-		_, err = metricsClient.MetricsV1beta1().PodMetricses(namespace).Get(context.TODO(), name, metav1.GetOptions{})
-		if err != nil {
-			if apierrors.IsNotFound(err) {
-				klog.Infof("Metrics not yet available for pod %s/%s", namespace, name)
-				return false
-			}
-			klog.Errorf("Metrics not available for pod %s/%s", namespace, name)
-			return false
-		}
-		return true
-	}, metricsCreationDelay, PollInterval).Should(gomega.Equal(true))
-}
-
 // WaitPodPresentOnClustersFitWith wait pod present on cluster sync with fit func.
 func WaitPodPresentOnClustersFitWith(clusters []string, namespace, name string, fit func(pod *corev1.Pod) bool) {
 	ginkgo.By(fmt.Sprintf("Waiting for pod(%s/%s) synced on member clusters", namespace, name), func() {
```

**File**: `test/e2e/suites/base/karmadactl_test.go` (modified, +41/-19)
```diff
@@ -58,6 +58,8 @@ import (
 const (
 	karmadactlTimeout        = time.Second * 10
 	PropagationPolicyPattern = `propagationpolicy\.policy\.karmada\.io\/([a-zA-Z0-9\-]+)`
+	// metricsCreationDelay defines the maximum time metrics not yet available for pod.
+	metricsCreationDelay = 2 * time.Minute
 )
 
 var _ = ginkgo.Describe("Karmadactl promote testing", func() {
@@ -605,40 +607,60 @@ var _ = ginkgo.Describe("Karmadactl top testing", func() {
 				framework.RemovePod(kubeClient, pod.Namespace, pod.Name)
 			})
 
-			// wait for pod and metrics ready
+			// wait for pod ready
 			framework.WaitPodPresentOnClustersFitWith(framework.ClusterNames(), pod.Namespace, pod.Name,
 				func(pod *corev1.Pod) bool {
 					return khelper.IsPodReady(pod)
 				})
-			for _, cluster := range framework.ClusterNames() {
-				framework.WaitPodMetricsReady(kubeClient, karmadaClient, cluster, pod.Namespace, pod.Name)
-			}
 		})
 
 		ginkgo.It("Karmadactl top existing pod", func() {
 			ginkgo.By("Karmadactl top existing pod", func() {
-				for _, clusterName := range framework.ClusterNames() {
-					cmd := framework.NewKarmadactlCommand(kubeconfig, karmadaContext, karmadactlPath, pod.Namespace, karmadactlTimeout, "top", "pod", pod.Name, "-n", pod.Namespace, "-C", clusterName)
-					_, err := cmd.ExecOrDie()
-					gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
-				}
+				gomega.Eventually(func() error {
+					for _, clusterName := range framework.ClusterNames() {
+						cmd := framework.NewKarmadactlCommand(kubeconfig, karmadaContext, karmadactlPath, pod.Namespace, karmadactlTimeout, "top", "pod", pod.Name, "-n", pod.Namespace, "-C", clusterName)
+						_, err := cmd.ExecOrDie()
+						if err != nil {
+							klog.Infof("Karmadactl top pod(%s/%s) on cluster(%s) failed: %v", pod.Namespace, pod.Name, clusterName, err)
+							return err
+						}
+					}
+					return nil
+				}, metricsCreationDelay, pollInterval).Should(gomega.Succeed())
 			})
 
 			ginkgo.By("Karmadactl top existing pod without setting cluster flag", func() {
-				cmd := framework.NewKarmadactlCommand(kubeconfig, karmadaContext, karmadactlPath, pod.Namespace, karmadactlTimeout, "top", "pod", pod.Name, "-n", pod.Namespace)
-				_, err := cmd.ExecOrDie()
-				gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
+				gomega.Eventually(func() error {
+					cmd := framework.NewKarmadactlCommand(kubeconfig, karmadaContext, karmadactlPath, pod.Namespace, karmadactlTimeout, "top", "pod", pod.Name, "-n", pod.Namespace)
+					_, err := cmd.ExecOrDie()
+					if err != nil {
+						klog.Infof("Karmadactl top pod(%s/%s) across all clusters failed: %v", pod.Namespace, pod.Name, err)
+					}
+					return err
+				}, metricsCreationDelay, pollInterval).Should(gomega.Succeed())
 			})
 
 			ginkgo.By("Karmadactl top pod without specific podName", func() {
-				cmd := framework.NewKarmadactlCommand(kubeconfig, karmadaContext, karmadactlPath, pod.Namespace, karmadactlTimeout, "top", "pod", "-A")
-				_, err := cmd.ExecOrDie()
-				gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
-				for _, clusterName := range framework.ClusterNames() {
-					cmd := framework.NewKarmadactlCommand(kubeconfig, karmadaContext, karmadactlPath, pod.Namespace, karmadactlTimeout, "top", "pod", "-A", "-C", clusterName)
+				gomega.Eventually(func() error {
+					cmd := framework.NewKarmadactlCommand(kubeconfig, karmadaContext, karmadactlPath, pod.Namespace, karmadactlTimeout, "top", "pod", "-A")
 					_, err := cmd.ExecOrDie()
-					gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
-				}
+					if err != nil {
+						klog.Infof("Karmadactl top pod -A across all clusters failed: %v", err)
+					}
+					return err
+				}, metricsCreationDelay, pollInterval).Should(gomega.Succeed())
+
+				gomega.Eventually(func() error {
+					for _, clusterName := range framework.ClusterNames() {
+						cmd := framework.NewKarmadactlCommand(kubeconfig, karmadaContext, karmadactlPath, pod.Namespace, karmadactlTimeout, "top", "pod", "-A", "-C", clusterName)
+						_, err := cmd.ExecOrDie()
+						if err != nil {
+							klog.Infof("Karmadactl top pod -A on cluster(%s) failed: %v", clusterName, err)
+							return err
+						}
+					}
+					return nil
+				}, metricsCreationDelay, pollInterval).Should(gomega.Succeed())
 			})
 		})
 	})
```

---

### Incident Patch 2: `2d60db77` (2026-10-29)
**Commit Message**: Merge pull request #7994 from vshalpnjabi/fix-verify-diff-order

hack: swap verify-*.sh diff args to show committed as -

**File**: `hack/verify-codegen.sh` (modified, +3/-3)
```diff
@@ -47,7 +47,7 @@ cp -a "${DIFFOPERATOR}"/* "${TMP_DIFFOPERATOR}"
 bash "${SCRIPT_ROOT}/hack/update-codegen.sh"
 echo "diffing ${DIFFROOT} against freshly generated codegen"
 ret=0
-diff -Naupr "${DIFFROOT}" "${TMP_DIFFROOT}" || ret=$?
+diff -Naupr "${TMP_DIFFROOT}" "${DIFFROOT}" || ret=$?
 cp -a "${TMP_DIFFROOT}"/* "${DIFFROOT}"
 if [[ $ret -eq 0 ]]
 then
@@ -59,7 +59,7 @@ fi
 
 echo "diffing ${DIFFEXAMPLES} against freshly generated codegen"
 ret=0
-diff -Naupr "${DIFFEXAMPLES}" "${TMP_DIFFEXAMPLES}" || ret=$?
+diff -Naupr "${TMP_DIFFEXAMPLES}" "${DIFFEXAMPLES}" || ret=$?
 cp -a "${TMP_DIFFEXAMPLES}"/* "${DIFFEXAMPLES}"
 if [[ $ret -eq 0 ]]
 then
@@ -71,7 +71,7 @@ fi
 
 echo "diffing ${DIFFOPERATOR} against freshly generated codegen"
 ret=0
-diff -Naupr "${DIFFOPERATOR}" "${TMP_DIFFOPERATOR}" || ret=$?
+diff -Naupr "${TMP_DIFFOPERATOR}" "${DIFFOPERATOR}" || ret=$?
 cp -a "${TMP_DIFFOPERATOR}"/* "${DIFFOPERATOR}"
 if [[ $ret -eq 0 ]]
 then
```

**File**: `hack/verify-crdgen.sh` (modified, +3/-3)
```diff
@@ -49,7 +49,7 @@ echo "diffing ${DIFFROOT} against freshly generated files"
 
 ret=0
 
-diff -Naupr "${DIFFROOT}" "${TMP_DIFFROOT}" || ret=$?
+diff -Naupr "${TMP_DIFFROOT}" "${DIFFROOT}" || ret=$?
 cp -a "${TMP_DIFFROOT}"/* "${DIFFROOT}"
 if [[ $ret -eq 0 ]]
 then
@@ -63,7 +63,7 @@ echo "diffing ${DIFFEXAMPLES} against freshly generated files"
 
 ret=0
 
-diff -Naupr "${DIFFEXAMPLES}" "${TMP_DIFFEXAMPLES}" || ret=$?
+diff -Naupr "${TMP_DIFFEXAMPLES}" "${DIFFEXAMPLES}" || ret=$?
 cp -a "${TMP_DIFFEXAMPLES}"/* "${DIFFEXAMPLES}"
 if [[ $ret -eq 0 ]]
 then
@@ -73,7 +73,7 @@ else
   exit 1
 fi
 
-diff -Naupr "${DIFFOPERATOR}" "${TMP_DIFFOPERATOR}" || ret=$?
+diff -Naupr "${TMP_DIFFOPERATOR}" "${DIFFOPERATOR}" || ret=$?
 cp -a "${TMP_DIFFOPERATOR}" "${DIFFOPERATOR}"
 if [[ $ret -eq 0 ]]
 then
```

**File**: `hack/verify-estimator-protobuf.sh` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ source "$KARMADA_ROOT/hack/update-estimator-protobuf.sh"
 
 echo "diffing ${ESTIMATORPB} against freshly generated estimator protobuf"
 ret=0
-diff -Naupr "${KARMADA_ROOT}/${ESTIMATORPB}" "${_tmp}/${ESTIMATORPB}" || ret=$?
+diff -Naupr "${_tmp}/${ESTIMATORPB}" "${KARMADA_ROOT}/${ESTIMATORPB}" || ret=$?
 cp -a "${_tmp}/${ESTIMATORPB}"/* "${KARMADA_ROOT}/${ESTIMATORPB}/"
 if [[ $ret -eq 0 ]]; then
   echo "${ESTIMATORPB} is up to date."
```

**File**: `hack/verify-lifted.sh` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ echo "diffing ${DIFFFILE} against freshly generated files"
 
 ret=0
 
-diff -Naupr "${DIFFFILE}" "${TMP_DIFFFILE}" || ret=$?
+diff -Naupr "${TMP_DIFFFILE}" "${DIFFFILE}" || ret=$?
 cp "${TMP_DIFFFILE}" "${DIFFFILE}"
 if [[ $ret -eq 0 ]]
 then
```

**File**: `hack/verify-mocks.sh` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ cp -a "${DIFFROOT}"/* "${TMP_DIFFROOT}"
 bash "${SCRIPT_ROOT}/hack/update-mocks.sh"
 echo "diffing ${DIFFROOT} against freshly mock codegen"
 ret=0
-diff -Naupr "${DIFFROOT}" "${TMP_DIFFROOT}" || ret=$?
+diff -Naupr "${TMP_DIFFROOT}" "${DIFFROOT}" || ret=$?
 cp -a "${TMP_DIFFROOT}"/* "${DIFFROOT}"
 if [[ $ret -eq 0 ]]
 then
```

**File**: `hack/verify-swagger-docs.sh` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ echo "diffing ${DIFFROOT} against freshly generated files"
 
 ret=0
 
-diff -Naupr "${DIFFROOT}" "${TMP_DIFFROOT}" || ret=$?
+diff -Naupr "${TMP_DIFFROOT}" "${DIFFROOT}" || ret=$?
 cp -a "${TMP_DIFFROOT}"/* "${DIFFROOT}"
 if [[ $ret -eq 0 ]]
 then
```

**File**: `hack/verify-vendor.sh` (modified, +3/-3)
```diff
@@ -40,11 +40,11 @@ bash "${SCRIPT_ROOT}/hack/update-vendor.sh"
 echo "diffing ${DIFFROOT} against freshly generated files"
 
 govendor=0
-diff -Naupr "${DIFFROOT}" "${TMP_DIFFROOT}" || govendor=$?
+diff -Naupr "${TMP_DIFFROOT}" "${DIFFROOT}" || govendor=$?
 gomod=0
-diff -Naupr "${SCRIPT_ROOT}"/go.mod "${_tmp}"/go.mod || gomod=$?
+diff -Naupr "${_tmp}"/go.mod "${SCRIPT_ROOT}"/go.mod || gomod=$?
 gosum=0
-diff -Naupr "${SCRIPT_ROOT}"/go.sum "${_tmp}"/go.sum || gosum=$?
+diff -Naupr "${_tmp}"/go.sum "${SCRIPT_ROOT}"/go.sum || gosum=$?
 
 cp -a "${TMP_DIFFROOT}"/* "${DIFFROOT}"
 cp "${_tmp}"/go.mod "${SCRIPT_ROOT}"/go.mod
```

---

### Incident Patch 3: `742a97df` (2026-10-29)
**Commit Message**: Merge pull request #7991 from RainbowMango/pr_bump_metricsserver_9

Bump metrics-server to the version which requires Kubernetes v1.37

**File**: `go.mod` (modified, +9/-9)
```diff
@@ -14,11 +14,11 @@ require (
 	github.com/kr/pretty v0.3.1
 	github.com/mxk/go-flowrate v0.0.0-20140419014527-cca7078d478f
 	github.com/olekukonko/tablewriter v0.0.5
-	github.com/onsi/ginkgo/v2 v2.32.0
-	github.com/onsi/gomega v1.42.0
+	github.com/onsi/ginkgo/v2 v2.32.2
+	github.com/onsi/gomega v1.43.0
 	github.com/opensearch-project/opensearch-go v1.1.0
-	github.com/prometheus/client_golang v1.24.0
-	github.com/prometheus/common v0.70.0
+	github.com/prometheus/client_golang v1.24.1
+	github.com/prometheus/common v0.71.0
 	github.com/spf13/cobra v1.10.2
 	github.com/spf13/pflag v1.0.10
 	github.com/stretchr/testify v1.12.1
@@ -36,7 +36,7 @@ require (
 	gomodules.xyz/jsonpatch/v2 v2.4.0
 	google.golang.org/grpc v1.83.2
 	google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.5.1
-	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af
+	google.golang.org/protobuf v1.36.12
 	k8s.io/api v0.37.1
 	k8s.io/apiextensions-apiserver v0.37.1
 	k8s.io/apimachinery v0.37.1
@@ -61,7 +61,7 @@ require (
 	sigs.k8s.io/custom-metrics-apiserver v1.37.0
 	sigs.k8s.io/kind v0.33.0
 	sigs.k8s.io/mcs-api v0.1.0
-	sigs.k8s.io/metrics-server v0.8.1-0.20260616071526-90cba4cbcf82
+	sigs.k8s.io/metrics-server v0.9.1-0.20260921122620-6a4c08964ec6
 	sigs.k8s.io/structured-merge-diff/v6 v6.4.2
 	sigs.k8s.io/yaml v1.6.0
 )
@@ -89,7 +89,7 @@ require (
 	github.com/exponent-io/jsonpath v0.0.0-20210407135951-1de76d718b3f // indirect
 	github.com/fatih/camelcase v1.0.0 // indirect
 	github.com/fatih/structs v1.1.0 // indirect
-	github.com/felixge/httpsnoop v1.0.4 // indirect
+	github.com/felixge/httpsnoop v1.1.0 // indirect
 	github.com/fsnotify/fsnotify v1.10.1 // indirect
 	github.com/fxamacker/cbor/v2 v2.9.2 // indirect
 	github.com/go-errors/errors v1.4.2 // indirect
@@ -115,7 +115,7 @@ require (
 	github.com/google/btree v1.1.3 // indirect
 	github.com/google/cel-go v0.29.2 // indirect
 	github.com/google/gnostic-models v0.7.1 // indirect
-	github.com/google/pprof v0.0.0-20260507013755-92041b743c96 // indirect
+	github.com/google/pprof v0.0.0-20260709232956-b9395ee17fa0 // indirect
 	github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674 // indirect
 	github.com/grpc-ecosystem/go-grpc-middleware/providers/prometheus v1.1.0 // indirect
 	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.3.3 // indirect
@@ -186,7 +186,7 @@ require (
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	golang.org/x/crypto v0.55.0 // indirect
-	golang.org/x/exp v0.0.0-20260529124908-c761662dc8c9 // indirect
+	golang.org/x/exp v0.0.0-20260709172345-9ea1abe57597 // indirect
 	golang.org/x/mod v0.38.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
```

**File**: `go.sum` (modified, +20/-20)
```diff
@@ -130,8 +130,8 @@ github.com/fatih/camelcase v1.0.0/go.mod h1:yN2Sb0lFhZJUdVvtELVWefmrXpuZESvPmqwo
 github.com/fatih/color v1.7.0/go.mod h1:Zm6kSWBoL9eyXnKyktHP6abPY2pDugNf5KwzbycvMj4=
 github.com/fatih/structs v1.1.0 h1:Q7juDM0QtcnhCpeyLGQKyg4TOIghuNXrkL32pHAUMxo=
 github.com/fatih/structs v1.1.0/go.mod h1:9NiDSp5zOcgEDl+j00MP/WkGVPOlPRLejGD8Ga6PJ7M=
-github.com/felixge/httpsnoop v1.0.4 h1:NFTV2Zj1bL4mc9sqWACXbQFVBBg2W3GPvqp8/ESS2Wg=
-github.com/felixge/httpsnoop v1.0.4/go.mod h1:m8KPJKqk1gH5J9DgRY2ASl2lWCfGKXixSwevea8zH2U=
+github.com/felixge/httpsnoop v1.1.0 h1:3YtUj32ZZkqZtt3sZZsClsymw/QDuVfpNhoA31zeORc=
+github.com/felixge/httpsnoop v1.1.0/go.mod h1:Zqxgdd+1Rkcz8euOqdr7lqgCRJztwr5hp9vDSi5UZCE=
 github.com/fsnotify/fsnotify v1.4.7/go.mod h1:jwhsz4b93w/PPRr/qN1Yymfu8t87LnFCMoQvtojpjFo=
 github.com/fsnotify/fsnotify v1.4.9/go.mod h1:znqG4EE+3YCdAaPaxE2ZRY/06pZUdp0tY4IgpuI1SZQ=
 github.com/fsnotify/fsnotify v1.10.1 h1:b0/UzAf9yR5rhf3RPm9gf3ehBPpf0oZKIjtpKrx59Ho=
@@ -292,8 +292,8 @@ github.com/google/gofuzz v1.2.0 h1:xRy4A+RhZaiKjJ1bPfwQ8sedCA+YS2YcCHW6ec7JMi0=
 github.com/google/gofuzz v1.2.0/go.mod h1:dBl0BpW6vV/+mYPU4Po3pmUjxk6FQPldtuIdl/M65Eg=
 github.com/google/martian v2.1.0+incompatible/go.mod h1:9I4somxYTbIHy5NJKHRl3wXiIaQGbYVAs8BPL6v8lEs=
 github.com/google/pprof v0.0.0-20181206194817-3ea8567a2e57/go.mod h1:zfwlbNMJ+OItoe0UupaVj+oy1omPYYDuagoSzA8v9mc=
-github.com/google/pprof v0.0.0-20260507013755-92041b743c96 h1:YDDnaZ9afWajDboPMt9Vikqca/yWAX7KAxVzb4lJU1M=
-github.com/google/pprof v0.0.0-20260507013755-92041b743c96/go.mod h1:MxpfABSjhmINe3F1It9d+8exIHFvUqtLIRCdOGNXqiI=
+github.com/google/pprof v0.0.0-20260709232956-b9395ee17fa0 h1:du0WGc8xSKq/++e0cglxhS/mXVqsR7+c7jLEi5Vqduw=
+github.com/google/pprof v0.0.0-20260709232956-b9395ee17fa0/go.mod h1:MxpfABSjhmINe3F1It9d+8exIHFvUqtLIRCdOGNXqiI=
 github.com/google/shlex v0.0.0-20191202100458-e7afc7fbc510 h1:El6M4kTTCOh6aBiKaUGG7oYTSPP8MxqL4YI3kZKwcP4=
 github.com/google/shlex v0.0.0-20191202100458-e7afc7fbc510/go.mod h1:pupxD2MaaD3pAXIBCelhxNneeOaAeabZDe5s4K6zSpQ=
 github.com/google/uuid v1.0.0/go.mod h1:TIyPZe4MgqvfeYDBFedMoGGpEw/LqOeaOT+nhxU+yHo=
@@ -354,8 +354,8 @@ github.com/julienschmidt/httprouter v1.2.0/go.mod h1:SYymIcj16QtmaHHD7aYtjjsJG7V
 github.com/kisielk/errcheck v1.1.0/go.mod h1:EZBBE59ingxPouuu3KfxchcWSUPOHkagtvWXihfKN4Q=
 github.com/kisielk/errcheck v1.2.0/go.mod h1:/BMXB+zMLi60iA8Vv6Ksmxu/1UDYcXs4uQLJ+jE2L00=
 github.com/kisielk/gotool v1.0.0/go.mod h1:XhKaO+MFFWcvkIS/tQcRk01m1F5IRFswLeQ+oQHNcck=
-github.com/klauspost/compress v1.19.0 h1:sXLILfc9jV2QYWkzFOPWStmcUVH2RHEB1JCdY2oVvCQ=
-github.com/klauspost/compress v1.19.0/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
+github.com/klauspost/compress v1.19.1 h1:VsB4HPswih7mmZ8WleSFQ75c/Ui1M4trX5oAsJnhSlk=
+github.com/klauspost/compress v1.19.1/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/knadh/koanf/maps v0.1.2 h1:RBfmAW5CnZT+PJ1CVc1QSJKf4Xu9kxfQgYVQSu8hpbo=
 github.com/knadh/koanf/maps v0.1.2/go.mod h1:npD/QZY3V6ghQDdcQzl1W4ICNVTkohC8E73eI2xW4yI=
 github.com/knadh/koanf/parsers/yaml v0.1.0 h1:ZZ8/iGfRLvKSaMEECEBPM1HQslrZADk8fP1XFUxVI5w=
@@ -454,15 +454,15 @@ github.com/onsi/ginkgo v1.6.0/go.mod h1:lLunBs/Ym6LB5Z9jYTR76FiuTmxDTDusOGeTQH+W
 github.com/onsi/ginkgo v1.11.0/go.mod h1:lLunBs/Ym6LB5Z9jYTR76FiuTmxDTDusOGeTQH+WWjE=
 github.com/onsi/ginkgo v1.12.1/go.mod h1:zj2OWP4+oCPe1qIXoGWkgMRwljMUYCdkwsT2108oapk=
 github.com/onsi/ginkgo v1.14.0/go.mod h1:iSB4RoI2tjJc9BBv4NKIKWKya62Rps+oPG/Lv9klQyY=
-github.com/onsi/ginkgo/v2 v2.32.0 h1:Hw7s2pVrQo/8Yz5N77qdnpHaoc+c6cC9WIV1Jce+J6E=
-github.com/onsi/ginkgo/v2 v2.32.0/go.mod h1:+aXOY+vzZ5mu2iI2HpTZUPmM//oQfsNFX6gU9kNcA44=
+github.com/onsi/ginkgo/v2 v2.32.2 h1:2o6vyFvR6snrJWgRVztC+OwuqqPEMI1UzYl2s2iU7Cg=
+github.com/onsi/ginkgo/v2 v2.32.2/go.mod h1:+aXOY+vzZ5mu2iI2HpTZUPmM//oQfsNFX6gU9kNcA44=
 github.com/onsi/gomega v0.0.0-20170829124025-dcabb60a477c/go.mod h1:C1qb7wdrVGGVU+Z6iS04AVkA3Q65CEZX59MT0QO5uiA=
 github.com/onsi/gomega v1.7.0/go.mod h1:ex+gbHU/CVuBBDIJjb2X0qEXbFg53c61hWP/1CpauHY=
 github.com/onsi/gomega v1.7.1/go.mod h1:XdKZgCCFLUoM/7CFJVPcG8C1xQ1AJ0vpAezJrB7JYyY=
 github.com/onsi/gomega v1.8.1/go.mod h1:Ho0h+IUsWyvy1OpqCwxlQ/21gkhVunqlU8fDGcoTdcA=
 github.com/onsi/gomega v1.10.1/go.mod h1:iN09h71vgCQne3DLsj+A5owkum+a2tYe+TOCB1ybHNo=
-github.com/onsi/gomega v1.42.0 h1:CJby8u36xb7v34W78F8WKvqTQP7PCMIPB78IVDB73l4=
-github.com/onsi/gomega v1.42.0/go.mod h1:M/Uqpu/8qTjtzCLUA2zJHX9Iilrau25x1PdoSRbWh5A=
+github.com/onsi/gomega v1.43.0 h1:VlG/1FxqNxhSO+lq/OHBNaaqwiBK/mO8JbVkX9Y+FeU=
+github.com/onsi/gomega v1.43.0/go.mod h1:REff/hsDsodHoKlWsP2mAPhu1+5/6hVYNf9rIEBpeSg=
 github.com/opencontainers/go-digest v1.0.0 h1:apOUWs51W5PlhuyGyz9FCeeBIOUDA/6nW8Oi/yOhh5U=
 github.com/opencontainers/go-digest v1.0.0/go.mod h1:0JzlMkj0TRzQZfJkVvzbP0HBR3IKzErnv2BNG4W4MAM=
 github.com/opensearch-project/opensearch-go v1.1.0 h1:eG5sh3843bbU1itPRjA9QXbxcg8LaZ+DjEzQH9aLN3M=
@@ -486,8 +486,8 @@ github.com/pquerna/cachecontrol v0.0.0-201710
```

**File**: `pkg/estimator/pb/estimator.pb.go` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
 
 // Code generated by protoc-gen-go. DO NOT EDIT.
 // versions:
-// 	protoc-gen-go v1.36.11-devel
+// 	protoc-gen-go v1.36.12
 // 	protoc        v4.23.4
 // source: pkg/estimator/pb/estimator.proto
 
```

**File**: `pkg/estimator/service/service.pb.go` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
 
 // Code generated by protoc-gen-go. DO NOT EDIT.
 // versions:
-// 	protoc-gen-go v1.36.11-devel
+// 	protoc-gen-go v1.36.12
 // 	protoc        v4.23.4
 // source: service.proto
 
```

**File**: `vendor/github.com/felixge/httpsnoop/capture_metrics.go` (modified, +36/-1)
```diff
@@ -69,6 +69,16 @@ func (m *Metrics) CaptureMetrics(w http.ResponseWriter, fn func(http.ResponseWri
 				}
 			},
 
+			WriteString: func(next WriteStringFunc) WriteStringFunc {
+				return func(s string) (int, error) {
+					n, err := next(s)
+
+					m.Written += int64(n)
+					headerWritten = true
+					return n, err
+				}
+			},
+
 			ReadFrom: func(next ReadFromFunc) ReadFromFunc {
 				return func(src io.Reader) (int64, error) {
 					n, err := next(src)
@@ -81,6 +91,31 @@ func (m *Metrics) CaptureMetrics(w http.ResponseWriter, fn func(http.ResponseWri
 		}
 	)
 
+	// defer to ensure duration is updated even if the handler panics
+	defer func() {
+		m.Duration += time.Since(start)
+	}()
 	fn(Wrap(w, hooks))
-	m.Duration += time.Since(start)
+}
+
+// deadliner defines two methods introduced in go 1.20. The standard library
+// seems not to provide an interface we can import, hence its definition here.
+type deadliner interface {
+	SetReadDeadline(deadline time.Time) error
+	SetWriteDeadline(deadline time.Time) error
+}
+
+// fullDuplexEnabler defines a method introduced in go 1.21. The standard
+// library seems not to provide an interface we can import, hence its definition
+// here.
+type fullDuplexEnabler interface {
+	EnableFullDuplex() error
+}
+
+// httpFlushError defines a method introduced in go 1.20. The standard
+// library seems not to provide an interface we can import, hence its definition
+// here.
+// See https://github.com/golang/go/blob/go1.20/src/net/http/responsecontroller.go#L50
+type httpFlushError interface {
+	FlushError() error
 }
```

**File**: `vendor/github.com/felixge/httpsnoop/wrap_generated_gteq_1.8.go` (removed, +0/-436)
```diff
@@ -1,436 +0,0 @@
-// +build go1.8
-// Code generated by "httpsnoop/codegen"; DO NOT EDIT.
-
-package httpsnoop
-
-import (
-	"bufio"
-	"io"
-	"net"
-	"net/http"
-)
-
-// HeaderFunc is part of the http.ResponseWriter interface.
-type HeaderFunc func() http.Header
-
-// WriteHeaderFunc is part of the http.ResponseWriter interface.
-type WriteHeaderFunc func(code int)
-
-// WriteFunc is part of the http.ResponseWriter interface.
-type WriteFunc func(b []byte) (int, error)
-
-// FlushFunc is part of the http.Flusher interface.
-type FlushFunc func()
-
-// CloseNotifyFunc is part of the http.CloseNotifier interface.
-type CloseNotifyFunc func() <-chan bool
-
-// HijackFunc is part of the http.Hijacker interface.
-type HijackFunc func() (net.Conn, *bufio.ReadWriter, error)
-
-// ReadFromFunc is part of the io.ReaderFrom interface.
-type ReadFromFunc func(src io.Reader) (int64, error)
-
-// PushFunc is part of the http.Pusher interface.
-type PushFunc func(target string, opts *http.PushOptions) error
-
-// Hooks defines a set of method interceptors for methods included in
-// http.ResponseWriter as well as some others. You can think of them as
-// middleware for the function calls they target. See Wrap for more details.
-type Hooks struct {
-	Header      func(HeaderFunc) HeaderFunc
-	WriteHeader func(WriteHeaderFunc) WriteHeaderFunc
-	Write       func(WriteFunc) WriteFunc
-	Flush       func(FlushFunc) FlushFunc
-	CloseNotify func(CloseNotifyFunc) CloseNotifyFunc
-	Hijack      func(HijackFunc) HijackFunc
-	ReadFrom    func(ReadFromFunc) ReadFromFunc
-	Push        func(PushFunc) PushFunc
-}
-
-// Wrap returns a wrapped version of w that provides the exact same interface
-// as w. Specifically if w implements any combination of:
-//
-// - http.Flusher
-// - http.CloseNotifier
-// - http.Hijacker
-// - io.ReaderFrom
-// - http.Pusher
-//
-// The wrapped version will implement the exact same combination. If no hooks
-// are set, the wrapped version also behaves exactly as w. Hooks targeting
-// methods not supported by w are ignored. Any other hooks will intercept the
-// method they target and may modify the call's arguments and/or return values.
-// The CaptureMetrics implementation serves as a working example for how the
-// hooks can be used.
-func Wrap(w http.ResponseWriter, hooks Hooks) http.ResponseWriter {
-	rw := &rw{w: w, h: hooks}
-	_, i0 := w.(http.Flusher)
-	_, i1 := w.(http.CloseNotifier)
-	_, i2 := w.(http.Hijacker)
-	_, i3 := w.(io.ReaderFrom)
-	_, i4 := w.(http.Pusher)
-	switch {
-	// combination 1/32
-	case !i0 && !i1 && !i2 && !i3 && !i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-		}{rw, rw}
-	// combination 2/32
-	case !i0 && !i1 && !i2 && !i3 && i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Pusher
-		}{rw, rw, rw}
-	// combination 3/32
-	case !i0 && !i1 && !i2 && i3 && !i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			io.ReaderFrom
-		}{rw, rw, rw}
-	// combination 4/32
-	case !i0 && !i1 && !i2 && i3 && i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			io.ReaderFrom
-			http.Pusher
-		}{rw, rw, rw, rw}
-	// combination 5/32
-	case !i0 && !i1 && i2 && !i3 && !i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Hijacker
-		}{rw, rw, rw}
-	// combination 6/32
-	case !i0 && !i1 && i2 && !i3 && i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Hijacker
-			http.Pusher
-		}{rw, rw, rw, rw}
-	// combination 7/32
-	case !i0 && !i1 && i2 && i3 && !i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Hijacker
-			io.ReaderFrom
-		}{rw, rw, rw, rw}
-	// combination 8/32
-	case !i0 && !i1 && i2 && i3 && i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Hijacker
-			io.ReaderFrom
-			http.Pusher
-		}{rw, rw, rw, rw, rw}
-	// combination 9/32
-	case !i0 && i1 && !i2 && !i3 && !i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-		}{rw, rw, rw}
-	// combination 10/32
-	case !i0 && i1 && !i2 && !i3 && i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-			http.Pusher
-		}{rw, rw, rw, rw}
-	// combination 11/32
-	case !i0 && i1 && !i2 && i3 && !i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-			io.ReaderFrom
-		}{rw, rw, rw, rw}
-	// combination 12/32
-	case !i0 && i1 && !i2 && i3 && i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-			io.ReaderFrom
-			http.Pusher
-		}{rw, rw, rw, rw, rw}
-	// combination 13/32
-	case !i0 && i1 && i2 && !i3 && !i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-			http.Hijacker
-		}{rw, rw, rw, rw}
-	// combination 14/32
-	case !i0 && i1 && i2 && !i3 && i4:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-			http.Hijacker
-			http.Pusher
-		}{rw, rw, rw, rw, rw}
-	// combination 15/32
-	case !i0 && i1 && i2 && i3 && !i4:
-		return struc
```

**File**: `vendor/github.com/felixge/httpsnoop/wrap_generated_lt_1.8.go` (removed, +0/-278)
```diff
@@ -1,278 +0,0 @@
-// +build !go1.8
-// Code generated by "httpsnoop/codegen"; DO NOT EDIT.
-
-package httpsnoop
-
-import (
-	"bufio"
-	"io"
-	"net"
-	"net/http"
-)
-
-// HeaderFunc is part of the http.ResponseWriter interface.
-type HeaderFunc func() http.Header
-
-// WriteHeaderFunc is part of the http.ResponseWriter interface.
-type WriteHeaderFunc func(code int)
-
-// WriteFunc is part of the http.ResponseWriter interface.
-type WriteFunc func(b []byte) (int, error)
-
-// FlushFunc is part of the http.Flusher interface.
-type FlushFunc func()
-
-// CloseNotifyFunc is part of the http.CloseNotifier interface.
-type CloseNotifyFunc func() <-chan bool
-
-// HijackFunc is part of the http.Hijacker interface.
-type HijackFunc func() (net.Conn, *bufio.ReadWriter, error)
-
-// ReadFromFunc is part of the io.ReaderFrom interface.
-type ReadFromFunc func(src io.Reader) (int64, error)
-
-// Hooks defines a set of method interceptors for methods included in
-// http.ResponseWriter as well as some others. You can think of them as
-// middleware for the function calls they target. See Wrap for more details.
-type Hooks struct {
-	Header      func(HeaderFunc) HeaderFunc
-	WriteHeader func(WriteHeaderFunc) WriteHeaderFunc
-	Write       func(WriteFunc) WriteFunc
-	Flush       func(FlushFunc) FlushFunc
-	CloseNotify func(CloseNotifyFunc) CloseNotifyFunc
-	Hijack      func(HijackFunc) HijackFunc
-	ReadFrom    func(ReadFromFunc) ReadFromFunc
-}
-
-// Wrap returns a wrapped version of w that provides the exact same interface
-// as w. Specifically if w implements any combination of:
-//
-// - http.Flusher
-// - http.CloseNotifier
-// - http.Hijacker
-// - io.ReaderFrom
-//
-// The wrapped version will implement the exact same combination. If no hooks
-// are set, the wrapped version also behaves exactly as w. Hooks targeting
-// methods not supported by w are ignored. Any other hooks will intercept the
-// method they target and may modify the call's arguments and/or return values.
-// The CaptureMetrics implementation serves as a working example for how the
-// hooks can be used.
-func Wrap(w http.ResponseWriter, hooks Hooks) http.ResponseWriter {
-	rw := &rw{w: w, h: hooks}
-	_, i0 := w.(http.Flusher)
-	_, i1 := w.(http.CloseNotifier)
-	_, i2 := w.(http.Hijacker)
-	_, i3 := w.(io.ReaderFrom)
-	switch {
-	// combination 1/16
-	case !i0 && !i1 && !i2 && !i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-		}{rw, rw}
-	// combination 2/16
-	case !i0 && !i1 && !i2 && i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			io.ReaderFrom
-		}{rw, rw, rw}
-	// combination 3/16
-	case !i0 && !i1 && i2 && !i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Hijacker
-		}{rw, rw, rw}
-	// combination 4/16
-	case !i0 && !i1 && i2 && i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Hijacker
-			io.ReaderFrom
-		}{rw, rw, rw, rw}
-	// combination 5/16
-	case !i0 && i1 && !i2 && !i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-		}{rw, rw, rw}
-	// combination 6/16
-	case !i0 && i1 && !i2 && i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-			io.ReaderFrom
-		}{rw, rw, rw, rw}
-	// combination 7/16
-	case !i0 && i1 && i2 && !i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-			http.Hijacker
-		}{rw, rw, rw, rw}
-	// combination 8/16
-	case !i0 && i1 && i2 && i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.CloseNotifier
-			http.Hijacker
-			io.ReaderFrom
-		}{rw, rw, rw, rw, rw}
-	// combination 9/16
-	case i0 && !i1 && !i2 && !i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Flusher
-		}{rw, rw, rw}
-	// combination 10/16
-	case i0 && !i1 && !i2 && i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Flusher
-			io.ReaderFrom
-		}{rw, rw, rw, rw}
-	// combination 11/16
-	case i0 && !i1 && i2 && !i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Flusher
-			http.Hijacker
-		}{rw, rw, rw, rw}
-	// combination 12/16
-	case i0 && !i1 && i2 && i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Flusher
-			http.Hijacker
-			io.ReaderFrom
-		}{rw, rw, rw, rw, rw}
-	// combination 13/16
-	case i0 && i1 && !i2 && !i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Flusher
-			http.CloseNotifier
-		}{rw, rw, rw, rw}
-	// combination 14/16
-	case i0 && i1 && !i2 && i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Flusher
-			http.CloseNotifier
-			io.ReaderFrom
-		}{rw, rw, rw, rw, rw}
-	// combination 15/16
-	case i0 && i1 && i2 && !i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Flusher
-			http.CloseNotifier
-			http.Hijacker
-		}{rw, rw, rw, rw, rw}
-	// combination 16/16
-	case i0 && i1 && i2 && i3:
-		return struct {
-			Unwrapper
-			http.ResponseWriter
-			http.Flusher
-			http.CloseNotifier
-			http.Hijacker
-			i
```

**File**: `vendor/github.com/onsi/ginkgo/v2/CHANGELOG.md` (modified, +10/-0)
```diff
@@ -1,3 +1,13 @@
+## 2.32.2
+
+### Fixes
+- fix bug where ginkgo -race -p was taking extra long to exit [c6792b0]
+
+## 2.32.1
+
+### Fixes
+- Defer AfterAll until repeated spec completes [e647b3b]
+
 ## 2.32.0
 
 `-fd` generate RSpec-style documentation output.  Thank @woodie !
```

#### Recent Merged Pull Requests:
- **PR #7997** (2026-10-30): chore(operator): bump default Kubernetes and etcd versions (@Arbaaz123676)
- **PR #7995** (2026-10-30): fix(e2e): retry karmadactl top checks on transient metrics failures (@zhzhuang-zju)
- **PR #7994** (2026-10-29): hack: swap verify-*.sh diff args to show committed as - (@vshalpnjabi)
- **PR #7992** (2026-10-29): Bump kind to v0.33.0 (@Arbaaz123676)
- **PR #7991** (2026-10-29): Bump metrics-server to the version which requires Kubernetes v1.37 (@RainbowMango)
- **PR #7988** (2026-10-28): Bump controller-runtime to v0.25.2 (@RainbowMango)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
