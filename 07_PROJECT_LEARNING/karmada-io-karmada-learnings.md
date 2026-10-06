# Forensic Learning Record (Deep Inspection): karmada-io/karmada

> **Canonical Artifact**: `07_PROJECT_LEARNING/karmada-io-karmada-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/karmada-io/karmada](https://github.com/karmada-io/karmada))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:35:27.878Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `karmada-io/karmada`
- **Description**: Open, Multi-Cloud, Multi-Cluster Kubernetes Orchestration
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5714 stars

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

### Core Architecture Module: `examples/customresourceinterpreter/webhook/main.go`
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
	_ "k8s.io/component-base/logs/json/register" // for JSON log format registration
	"k8s.io/klog/v2"
	controllerruntime "sigs.k8s.io/controller-runtime"

	"github.com/karmada-io/karmada/examples/customresourceinterpreter/webhook/app"
)

func main() {
	ctx := controllerruntime.SetupSignalHandler()
	// Starting from version 0.15.0, controller-runtime expects its consumers to set a logger through log.SetLogger.
	// If SetLogger is not called within the first 30 seconds of a binaries lifetime, it will get
	// set to a NullLogSink and report an error. Here's to silence the "log.SetLogger(...) was never called; logs will not be displayed" error
	// by setting a logger through log.SetLogger.
	// More info refer to: https://github.com/karmada-io/karmada/pull/4885.
	controllerruntime.SetLogger(klog.Background())
	cmd := app.NewWebhookCommand(ctx)
	code := cli.Run(cmd)
	os.Exit(code)
}

```

### Core Architecture Module: `hack/tools/swagger/lib/render.go`
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

package lib

import (
	"encoding/json"
	"fmt"
	"maps"
	"net"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/openapi"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	genericoptions "k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/util/compatibility"
	"k8s.io/apiserver/pkg/util/feature"
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/builder"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/common/restfuladapter"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// ResourceWithNamespaceScoped contain gvr and NamespaceScoped of a resource.
type ResourceWithNamespaceScoped struct {
	GVR             schema.GroupVersionResource
	NamespaceScoped bool
}

// Config is used to configure swagger information.
type Config struct {
	Scheme             *runtime.Scheme
	Codecs             serializer.CodecFactory
	Info               spec.InfoProps
	OpenAPIDefinitions []common.GetOpenAPIDefinitions
	Resources          []ResourceWithNamespaceScoped
	Mapper             *meta.DefaultRESTMapper
}

// GetOpenAPIDefinitions get openapi definitions.
func (c *Config) GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	out := map[string]common.OpenAPIDefinition{}
	for _, def := range c.OpenAPIDefinitions {
		maps.Copy(out, def(ref))
	}
	return out
}

// RenderOpenAPISpec create openapi spec of swagger.
func RenderOpenAPISpec(cfg Config) (string, error) {
	options := genericoptions.NewRecommendedOptions("/registry/karmada.io", cfg.Codecs.LegacyCodec())
	options.SecureServing.ServerCert.CertDirectory = "/tmp/karmada-swagger"
	options.SecureServing.BindPort = 6445
	options.Etcd = nil
	options.Authentication = nil
	options.Authorization = nil
	options.CoreAPI = nil
	options.Admission = nil

	if err := options.SecureServing.MaybeDefaultWithSelfSignedCerts("localhost", nil, []net.IP{net.ParseIP("127.0.0.1")}); err != nil {
		klog.Fatal(fmt.Errorf("error creating self-signed certificates: %v", err))
	}

	serverConfig := genericapiserver.NewRecommendedConfig(cfg.Codecs)
	if err := options.SecureServing.ApplyTo(&serverConfig.Config.SecureServing, &serverConfig.Config.LoopbackClientConfig); err != nil {
		klog.Fatal(err)
		return "", err
	}
	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(cfg.GetOpenAPIDefinitions, openapi.NewDefinitionNamer(cfg.Scheme))
	serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(cfg.GetOpenAPIDefinitions, openapi.NewDefinitionNamer(cfg.Scheme))
	serverConfig.OpenAPIConfig.Info.InfoProps = cfg.Info
	serverConfig.EffectiveVersion = compatibility.DefaultBuildEffectiveVersion()
	serverConfig.FeatureGate = feature.DefaultMutableFeatureGate

	genericServer, err := serverConfig.Complete().New("karmada-openapi-server", genericapiserver.NewEmptyDelegate())
	if err != nil {
		klog.Fatal(err)
		return "", err
	}

	table, err := createRouterTable(&cfg)
	if err != nil {
		klog.Fatal(err)
		return "", err
	}

	for g, resmap := range table {
		apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(g, cfg.Scheme, metav1.ParameterCodec, cfg.Codecs)
		storage := map[string]map[string]rest.Storage{}
		for r, info := range resmap {
			if storage[info.gvk.Version] == nil {
				storage[info.gvk.Version] = map[string]rest.Storage{}
			}
			storage[info.gvk.Version][r.Resource] = &StandardREST{info}
			// Add status router for all resources.
			storage[info.gvk.Version][r.Resource+"/status"] = &StatusREST{StatusInfo{
				gvk: info.gvk,
				obj: info.obj,
			}}

			// To define additional endpoints for CRD resources, we need to
			// implement our own REST interface and add it to our custom path.
			if r.Resource == "clusters" {
				storage[info.gvk.Version][r.Resource+"/proxy"] = &ProxyREST{}
			}
		}

		maps.Copy(apiGroupInfo.VersionedResourcesStorageMap, storage)

		// Install api to apiserver.
		if err := genericServer.InstallAPIGroup(&apiGroupInfo); err != nil {
			klog.Fatal(err)
			return "", err
		}
	}

	// Create Swagger Spec.
	spec, err := builder.BuildOpenAPISpecFromRoutes(restfuladapter.AdaptWebServices(genericServer.Handler.GoRestfulContainer.RegisteredWebServices()), serverConfig.OpenAPIConfig)
	if err != nil {
		klog.Fatal(err)
		return "", err
	}
	data, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		klog.Fatal(err)
		return "", err
	}
	return string(data), nil
}

// createRouterTable create router map for every resource.
func createRouterTable(cfg *Config) (map[string]map[schema.GroupVersionResource]ResourceInfo, error) {
	table := map[string]map[schema.GroupVersionResource]ResourceInfo{}
	// Create router map for every resource
	for _, ti := range cfg.Resources {
		var resmap map[schema.GroupVersionResource]ResourceInfo
		if m, found := table[ti.GVR.Group]; found {
			resmap = m
		} else {
			resmap = map[schema.GroupVersionResource]ResourceInfo{}
			table[ti.GVR.Group] = resmap
		}

		gvk, err := cfg.Mapper.KindFor(ti.GVR)
		if err != nil {
			klog.Fatal(err)
			return nil, err
		}
		obj, err := cfg.Scheme.New(gvk)

		if err != nil {
			klog.Fatal(err)
			return nil, err
		}

		list, err := cfg.Scheme.New(gvk.GroupVersion().WithKind(gvk.Kind + "List"))
		if err != nil {
			klog.Fatal(err)
			return nil, err
		}

		resmap[ti.GVR] = ResourceInfo{
			gvk:             gvk,
			obj:             obj,
			list:            list,
			namespaceScoped: ti.NamespaceScoped,
		}
	}

	return table, nil
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

### Incident Patch 1: `aad17e17` (2026-09-22)
**Commit Message**: Merge pull request #7904 from karmada-io/dependabot/github_actions/docker/setup-buildx-action-4.4.1

build(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1

**File**: `.github/workflows/dockerhub-latest-image.yml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ jobs:
       - name: install QEMU
         uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
       - name: install Buildx
-        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+        uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - name: login to DockerHub
         uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
         with:
```

**File**: `.github/workflows/dockerhub-released-image.yml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ jobs:
       - name: install QEMU
         uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
       - name: install Buildx
-        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+        uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - name: login to DockerHub
         uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
         with:
```

---

### Incident Patch 2: `5fad2317` (2026-09-21)
**Commit Message**: build(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.1

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.3.0 to 4.4.1.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/37fe631027851001ddb9b187196cc803df7f5f0e...f87e5991a6d7451dcb8d9637bfbc97413f497069)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.4.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/dockerhub-latest-image.yml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ jobs:
       - name: install QEMU
         uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
       - name: install Buildx
-        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+        uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - name: login to DockerHub
         uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
         with:
```

**File**: `.github/workflows/dockerhub-released-image.yml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ jobs:
       - name: install QEMU
         uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
       - name: install Buildx
-        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
+        uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - name: login to DockerHub
         uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
         with:
```

---

### Incident Patch 3: `d1963a41` (2026-09-21)
**Commit Message**: build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.1

Bumps [codecov/codecov-action](https://github.com/codecov/codecov-action) from 7.0.0 to 7.1.1.
- [Release notes](https://github.com/codecov/codecov-action/releases)
- [Changelog](https://github.com/codecov/codecov-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/codecov/codecov-action/compare/fb8b3582c8e4def4969c97caa2f19720cb33a72f...303a32d7a59b442fa8d48b6a1cc6825c09c847a5)

---
updated-dependencies:
- dependency-name: codecov/codecov-action
  dependency-version: 7.1.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ jobs:
         # Prevent running from the forked repository that doesn't need to upload coverage.
         # In addition, running on the forked repository would fail as missing the necessary secret.
         if: ${{ github.repository == 'karmada-io/karmada' }}
-        uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v7.0.0
+        uses: codecov/codecov-action@303a32d7a59b442fa8d48b6a1cc6825c09c847a5 # v7.1.1
         with:
           # Even though token upload token is not required for public repos,
           # but adding a token might increase successful uploads as per:
```

---

### Incident Patch 4: `f7810427` (2026-09-21)
**Commit Message**: build(deps): bump github/codeql-action/upload-sarif

Bumps [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) from 4.38.0 to 4.38.1.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/b96794f015dfd88f77b49b1c93e0fa7110f94c63...1c5b675653bb5c22dbe9b12b556ec555138e09fd)

---
updated-dependencies:
- dependency-name: github/codeql-action/upload-sarif
  dependency-version: 4.38.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-image-scanning-on-schedule.yml` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ jobs:
           cache: false
           vuln-type: 'os,library'
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/upload-sarif@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           sarif_file: '${{ matrix.target }}:${{ matrix.karmada-version }}.trivy-results.sarif'
           ref: ${{steps.gen_git_info.outputs.ref}}
```

**File**: `.github/workflows/ci-image-scanning.yaml` (modified, +1/-1)
```diff
@@ -68,6 +68,6 @@ jobs:
           vuln-type: 'os,library'
           cache: false
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/upload-sarif@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           sarif_file: 'trivy-results.sarif'          
```

---

### Incident Patch 5: `aee1618f` (2026-09-21)
**Commit Message**: build(deps): bump docker/setup-qemu-action from 4.3.0 to 4.4.0

Bumps [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) from 4.3.0 to 4.4.0.
- [Release notes](https://github.com/docker/setup-qemu-action/releases)
- [Commits](https://github.com/docker/setup-qemu-action/compare/1f40c72289eff860ee54a304f1438e3cff362e0a...99012661954931238ded8c8b007157a8430204e1)

---
updated-dependencies:
- dependency-name: docker/setup-qemu-action
  dependency-version: 4.4.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/dockerhub-latest-image.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ jobs:
         with:
           cosign-release: 'v2.2.3'
       - name: install QEMU
-        uses: docker/setup-qemu-action@1f40c72289eff860ee54a304f1438e3cff362e0a # v4.3.0
+        uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
       - name: install Buildx
         uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
       - name: login to DockerHub
```

**File**: `.github/workflows/dockerhub-released-image.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ jobs:
         with:
           cosign-release: 'v2.2.3'
       - name: install QEMU
-        uses: docker/setup-qemu-action@1f40c72289eff860ee54a304f1438e3cff362e0a # v4.3.0
+        uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
       - name: install Buildx
         uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
       - name: login to DockerHub
```

---

### Incident Patch 6: `e3307f1d` (2026-09-21)
**Commit Message**: build(deps): bump jlumbroso/free-disk-space from 1.3.1 to 2.0.0

Bumps [jlumbroso/free-disk-space](https://github.com/jlumbroso/free-disk-space) from 1.3.1 to 2.0.0.
- [Release notes](https://github.com/jlumbroso/free-disk-space/releases)
- [Commits](https://github.com/jlumbroso/free-disk-space/compare/54081f138730dfa15788a46383842cd2f914a1be...ceedf095f4ec1a097402bc6bd80831f2e1a6fde6)

---
updated-dependencies:
- dependency-name: jlumbroso/free-disk-space
  dependency-version: 2.0.0
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-performance-compare.yaml` (modified, +2/-2)
```diff
@@ -26,7 +26,7 @@ jobs:
     steps:
       # Free up disk space on Ubuntu
       - name: Free Disk Space (Ubuntu)
-        uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be # v1.3.1
+        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
         with:
           # this might remove tools that are actually needed, if set to "true" but frees about 6 GB
           tool-cache: false
@@ -86,7 +86,7 @@ jobs:
 
       # Free up disk space on Ubuntu
       - name: Free Disk Space (Ubuntu)
-        uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be # v1.3.1
+        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
         with:
           # this might remove tools that are actually needed, if set to "true" but frees about 6 GB
           tool-cache: false
```

**File**: `.github/workflows/ci-schedule-compatibility.yaml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
     steps:
       # Free up disk space on Ubuntu
       - name: Free Disk Space (Ubuntu)
-        uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be # v1.3.1
+        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
         with:
           # this might remove tools that are actually needed, if set to "true" but frees about 6 GB
           tool-cache: false
```

**File**: `.github/workflows/ci-schedule.yml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
     steps:
       # Free up disk space on Ubuntu
       - name: Free Disk Space (Ubuntu)
-        uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be # v1.3.1
+        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
         with:
           # this might remove tools that are actually needed, if set to "true" but frees about 6 GB
           tool-cache: false
```

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -115,7 +115,7 @@ jobs:
     steps:
       # Free up disk space on Ubuntu
       - name: Free Disk Space (Ubuntu)
-        uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be # v1.3.1
+        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
         with:
           # this might remove tools that are actually needed, if set to "true" but frees about 6 GB
           tool-cache: false
```

**File**: `.github/workflows/installation-chart.yaml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ jobs:
     steps:
       # Free up disk space on Ubuntu
       - name: Free Disk Space (Ubuntu)
-        uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be # v1.3.1
+        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
         with:
           # this might remove tools that are actually needed, if set to "true" but frees about 6 GB
           tool-cache: false
```

**File**: `.github/workflows/installation-cli.yaml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ jobs:
     steps:
       # Free up disk space on Ubuntu
       - name: Free Disk Space (Ubuntu)
-        uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be # v1.3.1
+        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
         with:
           # this might remove tools that are actually needed, if set to "true" but frees about 6 GB
           tool-cache: false
```

**File**: `.github/workflows/installation-operator.yaml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ jobs:
     steps:
       # Free up disk space on Ubuntu
       - name: Free Disk Space (Ubuntu)
-        uses: jlumbroso/free-disk-space@54081f138730dfa15788a46383842cd2f914a1be # v1.3.1
+        uses: jlumbroso/free-disk-space@ceedf095f4ec1a097402bc6bd80831f2e1a6fde6 # v2.0.0
         with:
           # this might remove tools that are actually needed, if set to "true" but frees about 6 GB
           tool-cache: false
```

---

### Incident Patch 7: `eea7f211` (2026-09-18)
**Commit Message**: Merge pull request #7899 from lui01212/docs/remove-retired-goreportcard-badge

docs: remove retired Go Report Card badge from README

**File**: `README.md` (modified, +0/-1)
```diff
@@ -9,7 +9,6 @@
 [![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/5301/badge)](https://bestpractices.coreinfrastructure.org/projects/5301)
 [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/karmada-io/karmada/badge)](https://securityscorecards.dev/viewer/?uri=github.com/karmada-io/karmada)
 ![build](https://github.com/karmada-io/karmada/actions/workflows/ci.yml/badge.svg)
-[![Go Report Card](https://goreportcard.com/badge/github.com/karmada-io/karmada)](https://goreportcard.com/report/github.com/karmada-io/karmada)
 [![codecov](https://codecov.io/gh/karmada-io/karmada/branch/master/graph/badge.svg?token=ROM8CMPXZ6)](https://codecov.io/gh/karmada-io/karmada)
 [![FOSSA Status](https://app.fossa.com/api/projects/custom%2B28176%2Fgithub.com%2Fkarmada-io%2Fkarmada.svg?type=shield)](https://app.fossa.com/projects/custom%2B28176%2Fgithub.com%2Fkarmada-io%2Fkarmada?ref=badge_shield)
 [![Artifact HUB](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/karmada)](https://artifacthub.io/packages/krew/krew-index/karmada)
```

---

### Incident Patch 8: `e6f7f5fb` (2026-09-15)
**Commit Message**: build: bump Go to v1.26.8

Signed-off-by: yinfengyuan <[REDACTED_EMAIL]>

**File**: `.go-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.26.7
+1.26.8
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 module github.com/karmada-io/karmada
 
-go 1.26.7 // keep in sync with .go-version
+go 1.26.8 // keep in sync with .go-version
 
 require (
 	github.com/adhocore/gronx v1.6.3
```

---

### Incident Patch 9: `09be566a` (2026-09-14)
**Commit Message**: build(deps): bump github/codeql-action/upload-sarif

Bumps [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) from 4.37.9 to 4.38.0.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/cdf488f595d80d6e07e03d4674febd5ab45fa938...b96794f015dfd88f77b49b1c93e0fa7110f94c63)

---
updated-dependencies:
- dependency-name: github/codeql-action/upload-sarif
  dependency-version: 4.38.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-image-scanning-on-schedule.yml` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ jobs:
           cache: false
           vuln-type: 'os,library'
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+        uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
         with:
           sarif_file: '${{ matrix.target }}:${{ matrix.karmada-version }}.trivy-results.sarif'
           ref: ${{steps.gen_git_info.outputs.ref}}
```

**File**: `.github/workflows/ci-image-scanning.yaml` (modified, +1/-1)
```diff
@@ -68,6 +68,6 @@ jobs:
           vuln-type: 'os,library'
           cache: false
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
+        uses: github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
         with:
           sarif_file: 'trivy-results.sarif'          
```

---

### Incident Patch 10: `b522b7df` (2026-09-07)
**Commit Message**: build(deps): bump docker/setup-qemu-action from 4.2.0 to 4.3.0

Bumps [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) from 4.2.0 to 4.3.0.
- [Release notes](https://github.com/docker/setup-qemu-action/releases)
- [Commits](https://github.com/docker/setup-qemu-action/compare/96fe6ef7f33517b61c61be40b68a1882f3264fb8...1f40c72289eff860ee54a304f1438e3cff362e0a)

---
updated-dependencies:
- dependency-name: docker/setup-qemu-action
  dependency-version: 4.3.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/dockerhub-latest-image.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ jobs:
         with:
           cosign-release: 'v2.2.3'
       - name: install QEMU
-        uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4.2.0
+        uses: docker/setup-qemu-action@1f40c72289eff860ee54a304f1438e3cff362e0a # v4.3.0
       - name: install Buildx
         uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
       - name: login to DockerHub
```

**File**: `.github/workflows/dockerhub-released-image.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ jobs:
         with:
           cosign-release: 'v2.2.3'
       - name: install QEMU
-        uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4.2.0
+        uses: docker/setup-qemu-action@1f40c72289eff860ee54a304f1438e3cff362e0a # v4.3.0
       - name: install Buildx
         uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
       - name: login to DockerHub
```

---

### Incident Patch 11: `bdbfae8d` (2026-09-01)
**Commit Message**: build(deps): bump softprops/action-gh-release from 3.0.2 to 3.0.3

Bumps [softprops/action-gh-release](https://github.com/softprops/action-gh-release) from 3.0.2 to 3.0.3.
- [Release notes](https://github.com/softprops/action-gh-release/releases)
- [Changelog](https://github.com/softprops/action-gh-release/blob/master/CHANGELOG.md)
- [Commits](https://github.com/softprops/action-gh-release/compare/3d0d9888cb7fd7b750713d6e236d1fcb99157228...efb35369e0ad2afab669f228072c1b0d510eae64)

---
updated-dependencies:
- dependency-name: softprops/action-gh-release
  dependency-version: 3.0.3
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +4/-4)
```diff
@@ -40,7 +40,7 @@ jobs:
         path: _output/release/${{ matrix.target }}-${{ matrix.os }}-${{ matrix.arch }}.tgz
     - name: Uploading assets...
       if: ${{ !env.ACT }}
-      uses: softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228 # v3.0.2
+      uses: softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64 # v3.0.3
       with:
         files: |
           _output/release/${{ matrix.target }}-${{ matrix.os }}-${{ matrix.arch }}.tgz
@@ -97,7 +97,7 @@ jobs:
         # base64 -w0 encodes to base64 and outputs on a single line.
         echo "hashes=$(sha256sum crds.tar.gz | base64 -w0)" >> "$GITHUB_OUTPUT"
     - name: Uploading crd assets...
-      uses: softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228 # v3.0.2
+      uses: softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64 # v3.0.3
       with:
         files: |
           crds.tar.gz
@@ -128,7 +128,7 @@ jobs:
       run: make package-chart
     - name: Uploading assets...
       if: ${{ !env.ACT }}
-      uses: softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228 # v3.0.2
+      uses: softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64 # v3.0.3
       with:
         files: |
           _output/charts/karmada-chart-${{ github.ref_name }}.tgz
@@ -179,7 +179,7 @@ jobs:
         # base64 -w0 encodes to base64 and outputs on a single line.
         echo "hashes=$(sha256sum sbom.tar.gz | base64 -w0)" >> "$GITHUB_OUTPUT"
     - name: Uploading sbom assets...
-      uses: softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228 # v3.0.2
+      uses: softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64 # v3.0.3
       with:
         files: |
           sbom.tar.gz
```

---

### Incident Patch 12: `960e69b0` (2026-08-31)
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
+			err = unstructured.SetNestedField(flinkObj.Object, componentCPU, "spec", "taskManager", "resource", "cpu")
 			gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
-			err = unstructured.SetNestedField(flinkObj.Object, float64(componentCPU), "spec", "taskManager", "resource", "cpu")
+			err = unstructured.SetNestedStringMap(flinkObj.Object, targetNodeSelector, "spec", "podTemplate", "spec", "nodeSelector")
 			gomega.Expect(err).ShouldNot(gomega.HaveOccurred())
 			_, err = dynamicClient.Resource(flinkDeploymentGVR).Namespace(testNamespace).
 				Create(ctx, flinkObj, metav1.CreateOptions{})
@@ -488,6 +503,7 @@ var _ = framework.SerialDescribe("[EstimatorAssumption] NodeResource plugin assu
 
 		ginkgo.By(fmt.Sprintf("creating FlinkDeployments one by one (up to %d) until assumption exhausts cluster resources", maxFlinkCount), func() {
 			assumptionExhausted := false
+			scheduledCount := 0
 			for range maxFlinkCount {
 				bindingName := createFlinkDeployment()
 				// Wait for a definitive schedul
```

---

### Incident Patch 13: `7f85149f` (2026-08-31)
**Commit Message**: build(deps): bump github/codeql-action/upload-sarif

Bumps [github/codeql-action/upload-sarif](https://github.com/github/codeql-action) from 4.37.8 to 4.37.9.
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28...cdf488f595d80d6e07e03d4674febd5ab45fa938)

---
updated-dependencies:
- dependency-name: github/codeql-action/upload-sarif
  dependency-version: 4.37.9
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci-image-scanning-on-schedule.yml` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ jobs:
           cache: false
           vuln-type: 'os,library'
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28 # v4.37.8
+        uses: github/codeql-action/upload-sarif@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
         with:
           sarif_file: '${{ matrix.target }}:${{ matrix.karmada-version }}.trivy-results.sarif'
           ref: ${{steps.gen_git_info.outputs.ref}}
```

**File**: `.github/workflows/ci-image-scanning.yaml` (modified, +1/-1)
```diff
@@ -68,6 +68,6 @@ jobs:
           vuln-type: 'os,library'
           cache: false
       - name: Upload Trivy scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28 # v4.37.8
+        uses: github/codeql-action/upload-sarif@cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
         with:
           sarif_file: 'trivy-results.sarif'          
```

---

### Incident Patch 14: `78c43861` (2026-08-29)
**Commit Message**: Bump Kubernetes dependencies to v1.36.4 to resolve security concerns

Signed-off-by: Hongcai Ren <[REDACTED_EMAIL]>

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
 golang.org/x/sys v0.0.0-20180830151530-49385e6e1522/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180905080454-ebe1bf3edb33/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
@@ -767,21 +767,21 @@ golang.org/x/sys v0.0.0-20210616094352-59db8d763f22/go.mod h1:oPkhp1MJrh7nUepCBc
 golang.org/x/sys v0.0.0-20220811171246-fbc7d0a398ab/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.12.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/telemetry v0.0.0-20260508192327-42602be52be6 h1:HjU6IWBiAgRIdAJ9/y1rwCn+UELEmwV+VsTLzj/W4sE=
-golang.org/x/telemetry v0.0.0-20260508192327-42602be52be6/go.mod h1:Eqhaxk/wZsWEH8CRxLwj6xzEJbz7k1EFGqx7nyCoabE=
+golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DB
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
 		r.setIndirect(need[path].Indirect)
 		if need[path].Indirect &&
-			(oneFlatUncommentedBlock || lineToBlock[r.Syntax] == lastDirectBlock) {
+			(simplify || oneFlatUncommentedBlock || lineToBlock[r.Syntax] == lastDirectBlock) {
 			moveReq(r, lastIndirectBlock)
 		} else if !need[path].Indirect &&
-			(oneFlatUncommentedBlock || lineToBlock[r.Syntax] == lastIndirectBlock) {
+			(simplify || oneFlatUncommentedBlock || lineToBlock[r.Syntax] == lastIndirectBlock) {
 			moveReq(r, lastDirectBlock)
 		}
 	}
@@ -1736,8 +1784,7 @@ func removeDups(syntax *FileSyntax, exclude *[]*Exclude, replace *[]*Replace, to
 	// Remove duplicate replacements.
 	// Later replacements take priority over earlier ones.
 	haveReplace := make(map[module.Version]bool)
-	for i := len(*replace) - 1; i >= 0; i-- {
-		x := (*replace)[i]
+	for _, x := range slices.Backward(*replace) {
 		if haveReplace[x.Old] {
 			kill[x.Syntax] = true
 			continue
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

**File**: `vendor/golang.org/x/net/html/escape.go` (modified, +90/-50)
```diff
@@ -6,6 +6,7 @@ package html
 
 import (
 	"bytes"
+	"slices"
 	"strings"
 	"unicode/utf8"
 )
@@ -50,25 +51,24 @@ var replacementTable = [...]rune{
 	// 0x0D->'\u000D' is a no-op.
 }
 
-// unescapeEntity reads an entity like "&lt;" from b[src:] and writes the
-// corresponding "<" to b[dst:], returning the incremented dst and src cursors.
-// Precondition: b[src] == '&' && dst <= src.
-// attribute should be true if parsing an attribute value.
-func unescapeEntity(b []byte, dst, src int, attribute bool) (dst1, src1 int) {
+// unescapeEntity attempts to consume a character reference from s[src:],
+// returning the rune, potential second rune, and number of bytes consumed
+// (which indicates the length of the character reference). It is assumed that
+// the first byte of s is '&'. attribute should be true if parsing an attribute
+// value.
+func unescapeEntity(s []byte, attribute bool) (rune, rune, int) {
 	// https://html.spec.whatwg.org/multipage/syntax.html#consume-a-character-reference
 
 	// i starts at 1 because we already know that s[0] == '&'.
-	i, s := 1, b[src:]
+	i := 1
 
 	if len(s) <= 1 {
-		b[dst] = b[src]
-		return dst + 1, src + 1
+		return '&', 0, 1
 	}
 
 	if s[i] == '#' {
-		if len(s) <= 3 { // We need to have at least "&#.".
-			b[dst] = b[src]
-			return dst + 1, src + 1
+		if len(s) <= 2 { // We need to have at least "&#".
+			return '&', 0, 1
 		}
 		i++
 		c := s[i]
@@ -78,34 +78,43 @@ func unescapeEntity(b []byte, dst, src int, attribute bool) (dst1, src1 int) {
 			i++
 		}
 
+		i0 := i
 		x := '\x00'
 		for i < len(s) {
 			c = s[i]
-			i++
+			var d rune
+			var mult rune
 			if hex {
+				mult = 16
 				if '0' <= c && c <= '9' {
-					x = 16*x + rune(c) - '0'
-					continue
+					d = rune(c) - '0'
 				} else if 'a' <= c && c <= 'f' {
-					x = 16*x + rune(c) - 'a' + 10
-					continue
+					d = rune(c) - 'a' + 10
 				} else if 'A' <= c && c <= 'F' {
-					x = 16*x + rune(c) - 'A' + 10
-					continue
+					d = rune(c) - 'A' + 10
+				} else {
+					break
+				}
+			} else {
+				mult = 10
+				if '0' <= c && c <= '9' {
+					d = rune(c) - '0'
+				} else {
+					break
 				}
-			} else if '0' <= c && c <= '9' {
-				x = 10*x + rune(c) - '0'
-				continue
 			}
-			if c != ';' {
-				i--
+			if x <= 0x10FFFF {
+				x = mult*x + d
 			}
-			break
+			i++
+		}
+
+		if i == i0 { // No characters matched.
+			return '&', 0, 1
 		}
 
-		if i <= 3 { // No characters matched.
-			b[dst] = b[src]
-			return dst + 1, src + 1
+		if i < len(s) && s[i] == ';' {
+			i++
 		}
 
 		if 0x80 <= x && x <= 0x9F {
@@ -116,7 +125,7 @@ func unescapeEntity(b []byte, dst, src int, attribute bool) (dst1, src1 int) {
 			x = '\uFFFD'
 		}
 
-		return dst + utf8.EncodeRune(b[dst:], x), src + i
+		return x, 0, i
 	}
 
 	// Consume the maximum number of characters possible, with the
@@ -141,46 +150,77 @@ func unescapeEntity(b []byte, dst, src int, attribute bool) (dst1, src1 int) {
 	} else if attribute && entityName[len(entityName)-1] != ';' && len(s) > i && s[i] == '=' {
 		// No-op.
 	} else if x := entity[entityName]; x != 0 {
-		return dst + utf8.EncodeRune(b[dst:], x), src + i
+		return x, 0, i
 	} else if x := entity2[entityName]; x[0] != 0 {
-		dst1 := dst + utf8.EncodeRune(b[dst:], x[0])
-		return dst1 + utf8.EncodeRune(b[dst1:], x[1]), src + i
+		return x[0], x[1], i
 	} else if !attribute {
 		maxLen := len(entityName) - 1
 		if maxLen > longestEntityWithoutSemicolon {
 			maxLen = longestEntityWithoutSemicolon
 		}
 		for j := maxLen; j > 1; j-- {
 			if x := entity[entityName[:j]]; x != 0 {
-				return dst + utf8.EncodeRune(b[dst:], x), src + j + 1
+				return x, 0, j + 1
 			}
 		}
 	}
 
-	dst1, src1 = dst+i, src+i
-	copy(b[dst:dst1], b[src:src1])
-	return dst1, src1
+	return '&', 0, 1
 }
 
-// unescape unescapes b's entities in-place, so that "a&lt;b" becomes "a<b".
-// attribute should be true if parsing an attribute value.
+// unescape unescapes b's entites, so that "a&lt;b" becomes "a<b". It attempts
+// to do so in place, but if the unescaped value is longer than the input it
+// allocates a new slice. attribute should be true if parsing an attribute
+// value.
 func unescape(b []byte, attribute bool) []byte {
-	for i, c := range b {
-		if c == '&' {
-			dst, src := unescapeEntity(b, i, i, attribute)
-			for src < len(b) {
-				c := b[src]
-				if c == '&' {
-					dst, src = unescapeEntity(b, dst, src, attribute)
-				} else {
-					b[dst] = c
-					dst, src = dst+1, src+1
-				}
+	firstAmp := slices.Index(b, '&')
+	if firstAmp == -1 {
+		return b
+	}
+
+	out := b[:firstAmp]
+	src := firstAmp
+	reusingB := true
+	for src < len(b) {
+		if b[src] != '&' {
+			out = append(out, b[src])
+			src++
+			continue
+		}
+
+		r1, r2, entityNameLen := unescapeEntity(b[src:], attribute)
+		if entityNameLen == 1 && r1 == '&' {
+			// Not an entity
+			out = append(out, '&')
+			src++
+			continue
+		}
+
+		// Compute replacement length
+		replLen := utf8.RuneLen(r1)
+		if r2 != 0 {
+			replLen += utf8.Ru
```

**File**: `vendor/golang.org/x/net/html/foreign.go` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ func adjustForeignAttributes(aa []Attribute) {
 		}
 		switch a.Key {
 		case "xlink:actuate", "xlink:arcrole", "xlink:href", "xlink:role", "xlink:show",
-			"xlink:title", "xlink:type", "xml:base", "xml:lang", "xml:space", "xmlns:xlink":
+			"xlink:title", "xlink:type", "xml:lang", "xml:space", "xmlns:xlink":
 			j := strings.Index(a.Key, ":")
 			aa[i].Namespace = a.Key[:j]
 			aa[i].Key = a.Key[j+1:]
```

**File**: `vendor/golang.org/x/net/html/parse.go` (modified, +67/-182)
```diff
@@ -63,7 +63,7 @@ func (p *parser) top() *Node {
 // Stop tags for use in popUntil. These come from section 12.2.4.2.
 var (
 	defaultScopeStopTags = map[string][]a.Atom{
-		"":     {a.Applet, a.Caption, a.Html, a.Table, a.Td, a.Th, a.Marquee, a.Object, a.Template},
+		"":     {a.Applet, a.Caption, a.Html, a.Table, a.Td, a.Th, a.Marquee, a.Object, a.Template, a.Select},
 		"math": {a.AnnotationXml, a.Mi, a.Mn, a.Mo, a.Ms, a.Mtext},
 		"svg":  {a.Desc, a.ForeignObject, a.Title},
 	}
@@ -78,7 +78,6 @@ const (
 	tableScope
 	tableRowScope
 	tableBodyScope
-	selectScope
 )
 
 // popUntil pops the stack of open elements at the highest element whose tag
@@ -133,10 +132,6 @@ func (p *parser) indexOfElementInScope(s scope, matchTags ...a.Atom) int {
 				if tagAtom == a.Html || tagAtom == a.Table || tagAtom == a.Template {
 					return -1
 				}
-			case selectScope:
-				if tagAtom != a.Optgroup && tagAtom != a.Option {
-					return -1
-				}
 			default:
 				panic(fmt.Sprintf("html: internal error: indexOfElementInScope unknown scope: %d", s))
 			}
@@ -460,21 +455,6 @@ func (p *parser) resetInsertionMode() {
 		}
 
 		switch n.DataAtom {
-		case a.Select:
-			if !last {
-				for ancestor, first := n, p.oe[0]; ancestor != first; {
-					ancestor = p.oe[p.oe.index(ancestor)-1]
-					switch ancestor.DataAtom {
-					case a.Template:
-						p.im = inSelectIM
-						return
-					case a.Table:
-						p.im = inSelectInTableIM
-						return
-					}
-				}
-			}
-			p.im = inSelectIM
 		case a.Td, a.Th:
 			// TODO: remove this divergence from the HTML5 spec.
 			//
@@ -1002,7 +982,10 @@ func inBodyIM(p *parser) bool {
 			p.popUntil(buttonScope, a.P)
 			p.addElement()
 		case a.Button:
-			p.popUntil(defaultScope, a.Button)
+			if p.elementInScope(defaultScope, a.Button) {
+				p.generateImpliedEndTags()
+				p.popUntil(defaultScope, a.Button)
+			}
 			p.reconstructActiveFormattingElements()
 			p.addElement()
 			p.framesetOK = false
@@ -1040,7 +1023,18 @@ func inBodyIM(p *parser) bool {
 			p.framesetOK = false
 			p.im = inTableIM
 			return true
-		case a.Area, a.Br, a.Embed, a.Img, a.Input, a.Keygen, a.Wbr:
+		case a.Area, a.Br, a.Embed, a.Img, a.Keygen, a.Wbr:
+			p.reconstructActiveFormattingElements()
+			p.addElement()
+			p.oe.pop()
+			p.acknowledgeSelfClosingTag()
+			p.framesetOK = false
+		case a.Input:
+			if p.fragment && p.context.DataAtom == a.Select {
+				// Ignore the token.
+				return true
+			}
+			p.popUntil(defaultScope, a.Select)
 			p.reconstructActiveFormattingElements()
 			p.addElement()
 			p.oe.pop()
@@ -1061,7 +1055,13 @@ func inBodyIM(p *parser) bool {
 			p.oe.pop()
 			p.acknowledgeSelfClosingTag()
 		case a.Hr:
-			p.popUntil(buttonScope, a.P)
+			if p.elementInScope(buttonScope, a.P) {
+				p.generateImpliedEndTags("p")
+				p.popUntil(defaultScope, a.P)
+			}
+			if p.elementInScope(defaultScope, a.Select) {
+				p.generateImpliedEndTags()
+			}
 			p.addElement()
 			p.oe.pop()
 			p.acknowledgeSelfClosingTag()
@@ -1095,13 +1095,30 @@ func inBodyIM(p *parser) bool {
 			// Don't let the tokenizer go into raw text mode when scripting is disabled.
 			p.tokenizer.NextIsNotRawText()
 		case a.Select:
+			if p.fragment && p.context.DataAtom == a.Select {
+				// Ignore the token.
+				return true
+			} else if p.popUntil(defaultScope, a.Select) {
+				return true
+			}
 			p.reconstructActiveFormattingElements()
 			p.addElement()
 			p.framesetOK = false
-			p.im = inSelectIM
 			return true
-		case a.Optgroup, a.Option:
-			if p.top().DataAtom == a.Option {
+		case a.Option:
+			if p.elementInScope(defaultScope, a.Select) {
+				p.generateImpliedEndTags("optgroup")
+				// If oe has option element in scope, parse error?
+			} else if p.top().DataAtom == a.Option {
+				p.oe.pop()
+			}
+			p.reconstructActiveFormattingElements()
+			p.addElement()
+		case a.Optgroup:
+			if p.elementInScope(defaultScope, a.Select) {
+				p.generateImpliedEndTags()
+				// If oe has option or optgroup element in scope, parse error?
+			} else if p.top().DataAtom == a.Option {
 				p.oe.pop()
 			}
 			p.reconstructActiveFormattingElements()
@@ -1149,7 +1166,12 @@ func inBodyIM(p *parser) bool {
 				return false
 			}
 			return true
-		case a.Address, a.Article, a.Aside, a.Blockquote, a.Button, a.Center, a.Details, a.Dialog, a.Dir, a.Div, a.Dl, a.Fieldset, a.Figcaption, a.Figure, a.Footer, a.Header, a.Hgroup, a.Listing, a.Main, a.Menu, a.Nav, a.Ol, a.Pre, a.Search, a.Section, a.Summary, a.Ul:
+		case a.Address, a.Article, a.Aside, a.Blockquote, a.Button, a.Center, a.Details, a.Dialog, a.Dir, a.Div, a.Dl, a.Fieldset, a.Figcaption, a.Figure, a.Footer, a.Header, a.Hgroup, a.Listing, a.Main, a.Menu, a.Nav, a.Ol, a.Pre, a.Search, a.Section, a.Select, a.Summary, a.Ul:
+			if !p.elementInScope(defaultScope, p.tok.DataAtom) {
+				// Ignore the token.
+				return true
+			}
+			p.generateImpliedEndTags()
 			p.popUntil(defaultScope, p.tok.DataAtom)
 		case a.Form:
 			if p.oe.contains(a.Template) {
@@ -
```

---

### Incident Patch 15: `61af4b2b` (2026-08-27)
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
