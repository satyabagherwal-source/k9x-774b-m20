# Forensic Learning Record (Deep Inspection): actions/actions-runner-controller

> **Canonical Artifact**: `07_PROJECT_LEARNING/actions-actions-runner-controller-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/actions/actions-runner-controller](https://github.com/actions/actions-runner-controller))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:12:03.699Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `actions/actions-runner-controller`
- **Description**: Kubernetes controller for GitHub Actions self-hosted runners
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 6544 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apis/actions.summerwind.net/v1alpha1/runner_webhook.go`
```
/*
Copyright 2020 The actions-runner-controller authors.

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

package v1alpha1

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	ctrl "sigs.k8s.io/controller-runtime"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

// log is for logging in this package.
var runnerLog = logf.Log.WithName("runner-resource")

func (r *Runner) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr, r).
		WithDefaulter(&RunnerDefaulter{}).
		WithValidator(&RunnerValidator{}).
		Complete()
}

// +kubebuilder:webhook:path=/mutate-actions-summerwind-dev-v1alpha1-runner,verbs=create;update,mutating=true,failurePolicy=fail,groups=actions.summerwind.dev,resources=runners,versions=v1alpha1,name=mutate.runner.actions.summerwind.dev,sideEffects=None,admissionReviewVersions=v1beta1

var _ admission.Defaulter[*Runner] = &RunnerDefaulter{}

type RunnerDefaulter struct{}

// Default implements [admission.Defaulter].
func (in *RunnerDefaulter) Default(ctx context.Context, obj *Runner) error {
	return nil
}

// +kubebuilder:webhook:path=/validate-actions-summerwind-dev-v1alpha1-runner,verbs=create;update,mutating=false,failurePolicy=fail,groups=actions.summerwind.dev,resources=runners,versions=v1alpha1,name=validate.runner.actions.summerwind.dev,sideEffects=None,admissionReviewVersions=v1beta1

var _ admission.Validator[*Runner] = &RunnerValidator{}

type RunnerValidator struct{}

// ValidateCreate implements webhook.Validator so a webhook will be registered for the type
func (*RunnerValidator) ValidateCreate(ctx context.Context, r *Runner) (admission.Warnings, error) {
	runnerLog.Info("validate resource to be created", "name", r.Name)
	return nil, r.Validate()
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (*RunnerValidator) ValidateUpdate(ctx context.Context, old, r *Runner) (admission.Warnings, error) {
	runnerLog.Info("validate resource to be updated", "name", r.Name)
	return nil, r.Validate()
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (*RunnerValidator) ValidateDelete(ctx context.Context, obj *Runner) (admission.Warnings, error) {
	return nil, nil
}

// Validate validates resource spec.
func (r *Runner) Validate() error {
	errList := r.Spec.Validate(field.NewPath("spec"))

	if len(errList) > 0 {
		return apierrors.NewInvalid(r.GroupVersionKind().GroupKind(), r.Name, errList)
	}

	return nil
}

```

### Core Architecture Module: `apis/actions.summerwind.net/v1alpha1/runnerdeployment_webhook.go`
```
/*
Copyright 2020 The actions-runner-controller authors.

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

package v1alpha1

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	ctrl "sigs.k8s.io/controller-runtime"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

// log is for logging in this package.
var runnerDeploymentLog = logf.Log.WithName("runnerdeployment-resource")

func (r *RunnerDeployment) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr, r).
		WithDefaulter(&RunnerDeploymentDefaulter{}).
		WithValidator(&RunnerDeploymentValidator{}).
		Complete()
}

// +kubebuilder:webhook:path=/mutate-actions-summerwind-dev-v1alpha1-runnerdeployment,verbs=create;update,mutating=true,failurePolicy=fail,groups=actions.summerwind.dev,resources=runnerdeployments,versions=v1alpha1,name=mutate.runnerdeployment.actions.summerwind.dev,sideEffects=None,admissionReviewVersions=v1beta1

var _ admission.Defaulter[*RunnerDeployment] = &RunnerDeploymentDefaulter{}

type RunnerDeploymentDefaulter struct{}

// Default implements webhook.Defaulter so a webhook will be registered for the type
func (*RunnerDeploymentDefaulter) Default(context.Context, *RunnerDeployment) error {
	// Nothing to do.
	return nil
}

// +kubebuilder:webhook:path=/validate-actions-summerwind-dev-v1alpha1-runnerdeployment,verbs=create;update,mutating=false,failurePolicy=fail,groups=actions.summerwind.dev,resources=runnerdeployments,versions=v1alpha1,name=validate.runnerdeployment.actions.summerwind.dev,sideEffects=None,admissionReviewVersions=v1beta1

var _ admission.Validator[*RunnerDeployment] = &RunnerDeploymentValidator{}

type RunnerDeploymentValidator struct{}

// ValidateCreate implements webhook.Validator so a webhook will be registered for the type
func (*RunnerDeploymentValidator) ValidateCreate(ctx context.Context, r *RunnerDeployment) (admission.Warnings, error) {
	runnerDeploymentLog.Info("validate resource to be created", "name", r.Name)
	return nil, r.Validate()
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (*RunnerDeploymentValidator) ValidateUpdate(ctx context.Context, old, r *RunnerDeployment) (admission.Warnings, error) {
	runnerDeploymentLog.Info("validate resource to be updated", "name", r.Name)
	return nil, r.Validate()
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (*RunnerDeploymentValidator) ValidateDelete(context.Context, *RunnerDeployment) (admission.Warnings, error) {
	return nil, nil
}

// Validate validates resource spec.
func (r *RunnerDeployment) Validate() error {
	errList := r.Spec.Template.Spec.Validate(field.NewPath("spec", "template", "spec"))

	if len(errList) > 0 {
		return apierrors.NewInvalid(r.GroupVersionKind().GroupKind(), r.Name, errList)
	}

	return nil
}

```

### Core Architecture Module: `apis/actions.summerwind.net/v1alpha1/runnerreplicaset_webhook.go`
```
/*
Copyright 2020 The actions-runner-controller authors.

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

package v1alpha1

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	ctrl "sigs.k8s.io/controller-runtime"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

// log is for logging in this package.
var runnerReplicaSetLog = logf.Log.WithName("runnerreplicaset-resource")

func (r *RunnerReplicaSet) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr, r).
		WithDefaulter(&RunnerReplicaSetDefaulter{}).
		WithValidator(&RunnerReplicaSetValidator{}).
		Complete()
}

// +kubebuilder:webhook:path=/mutate-actions-summerwind-dev-v1alpha1-runnerreplicaset,verbs=create;update,mutating=true,failurePolicy=fail,groups=actions.summerwind.dev,resources=runnerreplicasets,versions=v1alpha1,name=mutate.runnerreplicaset.actions.summerwind.dev,sideEffects=None,admissionReviewVersions=v1beta1

var _ admission.Defaulter[*RunnerReplicaSet] = &RunnerReplicaSetDefaulter{}

type RunnerReplicaSetDefaulter struct{}

// Default implements webhook.Defaulter so a webhook will be registered for the type
func (*RunnerReplicaSetDefaulter) Default(context.Context, *RunnerReplicaSet) error {
	// Nothing to do.
	return nil
}

// +kubebuilder:webhook:path=/validate-actions-summerwind-dev-v1alpha1-runnerreplicaset,verbs=create;update,mutating=false,failurePolicy=fail,groups=actions.summerwind.dev,resources=runnerreplicasets,versions=v1alpha1,name=validate.runnerreplicaset.actions.summerwind.dev,sideEffects=None,admissionReviewVersions=v1beta1

var _ admission.Validator[*RunnerReplicaSet] = &RunnerReplicaSetValidator{}

type RunnerReplicaSetValidator struct{}

// ValidateCreate implements webhook.Validator so a webhook will be registered for the type
func (*RunnerReplicaSetValidator) ValidateCreate(ctx context.Context, r *RunnerReplicaSet) (admission.Warnings, error) {
	runnerReplicaSetLog.Info("validate resource to be created", "name", r.Name)
	return nil, r.Validate()
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (*RunnerReplicaSetValidator) ValidateUpdate(ctx context.Context, old, r *RunnerReplicaSet) (admission.Warnings, error) {
	runnerReplicaSetLog.Info("validate resource to be updated", "name", r.Name)
	return nil, r.Validate()
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (*RunnerReplicaSetValidator) ValidateDelete(context.Context, *RunnerReplicaSet) (admission.Warnings, error) {
	return nil, nil
}

// Validate validates resource spec.
func (r *RunnerReplicaSet) Validate() error {
	errList := r.Spec.Template.Spec.Validate(field.NewPath("spec", "template", "spec"))

	if len(errList) > 0 {
		return apierrors.NewInvalid(r.GroupVersionKind().GroupKind(), r.Name, errList)
	}

	return nil
}

```

### Core Architecture Module: `cmd/githubwebhookserver/main.go`
```
/*
Copyright 2021 The actions-runner-controller authors.

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
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	actionsv1alpha1 "github.com/actions/actions-runner-controller/apis/actions.summerwind.net/v1alpha1"
	actionssummerwindnet "github.com/actions/actions-runner-controller/controllers/actions.summerwind.net"
	"github.com/actions/actions-runner-controller/github"
	"github.com/actions/actions-runner-controller/logging"

	"github.com/kelseyhightower/envconfig"

	"k8s.io/apimachinery/pkg/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	_ "k8s.io/client-go/plugin/pkg/client/auth/exec"
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
	_ "k8s.io/client-go/plugin/pkg/client/auth/oidc"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/webhook"
	// +kubebuilder:scaffold:imports
)

var (
	scheme = runtime.NewScheme()
)

const (
	webhookSecretTokenEnvName = "GITHUB_WEBHOOK_SECRET_TOKEN"
)

func init() {
	_ = clientgoscheme.AddToScheme(scheme)

	_ = actionsv1alpha1.AddToScheme(scheme)
	// +kubebuilder:scaffold:scheme
}

func main() {
	var (
		err error

		webhookAddr string
		metricsAddr string

		// The secret token of the GitHub Webhook. See https://docs.github.com/en/developers/webhooks-and-events/securing-your-webhooks
		webhookSecretToken    string
		webhookSecretTokenEnv string

		watchNamespace string

		logLevel   string
		queueLimit int
		logFormat  string

		ghClient *github.Client
	)

	var c github.Config
	err = envconfig.Process("github", &c)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: processing environment variables: %v\n", err)
		os.Exit(1)
	}

	webhookSecretTokenEnv = os.Getenv(webhookSecretTokenEnvName)

	flag.StringVar(&webhookAddr, "webhook-addr", ":8000", "The address the metric endpoint binds to.")
	flag.StringVar(&metricsAddr, "metrics-addr", ":8080", "The address the metric endpoint binds to.")
	flag.StringVar(&watchNamespace, "watch-namespace", "", "The namespace to watch for HorizontalRunnerAutoscaler's to scale on Webhook. Set to empty for letting it watch for all namespaces.")
	flag.StringVar(&logLevel, "log-level", logging.LogLevelDebug, `The verbosity of the logging. Valid values are "debug", "info", "warn", "error". Defaults to "debug".`)
	flag.IntVar(&queueLimit, "queue-limit", actionssummerwindnet.DefaultQueueLimit, `The maximum length of the scale operation queue. The scale opration is enqueued per every matching webhook event, and the server returns a 500 HTTP status when the queue was already full on enqueue attempt.`)
	flag.StringVar(&webhookSecretToken, "github-webhook-secret-token", "", "The personal access token of GitHub.")
	flag.StringVar(&c.Token, "github-token", c.Token, "The personal access token of GitHub.")
	flag.Int64Var(&c.AppID, "github-app-id", c.AppID, "The application ID of GitHub App.")
	flag.Int64Var(&c.AppInstallationID, "github-app-installation-id", c.AppInstallationID, "The installation ID of GitHub App.")
	flag.StringVar(&c.AppPrivateKey, "github-app-private-key", c.AppPrivateKey, "The path of a private key file to authenticate as a GitHub App")
	flag.StringVar(&c.URL, "github-url", c.URL, "GitHub URL to be used for GitHub API calls")
	flag.StringVar(&c.UploadURL, "github-upload-url", c.UploadURL, "GitHub Upload URL to be used for GitHub API calls")
	flag.StringVar(&c.BasicauthUsername, "github-basicauth-username", c.BasicauthUsername, "Username for GitHub basic auth to use instead of PAT or GitHub APP in case it's running behind a proxy API")
	flag.StringVar(&c.BasicauthPassword, "github-basicauth-password", c.BasicauthPassword, "Password for GitHub basic auth to use instead of PAT or GitHub APP in case it's running behind a proxy API")
	flag.StringVar(&c.RunnerGitHubURL, "runner-github-url", c.RunnerGitHubURL, "GitHub URL to be used by runners during registration")
	flag.StringVar(&logFormat, "log-format", "text", `The log format. Valid options are "text" and "json". Defaults to "text"`)

	flag.Parse()

	logger, err := logging.NewLogger(logLevel, logFormat)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: creating logger: %v\n", err)
		os.Exit(1)
	}
	logger.WithName("setup")

	if webhookSecretToken == "" && webhookSecretTokenEnv != "" {
		logger.Info(fmt.Sprintf("Using the value from %s for -github-webhook-secret-token", webhookSecretTokenEnvName))
		webhookSecretToken = webhookSecretTokenEnv
	}

	if webhookSecretToken == "" {
		logger.Info(fmt.Sprintf("-github-webhook-secret-token and %s are missing or empty. Create one following https://docs.github.com/en/developers/webhooks-and-events/securing-your-webhooks and specify it via the flag or the envvar", webhookSecretTokenEnvName))
	}

	if watchNamespace == "" {
		logger.Info("-watch-namespace is empty. HorizontalRunnerAutoscalers in all the namespaces are watched, cached, and considered as scale targets.")
	} else {
		logger.Info(fmt.Sprintf("-watch-namespace is %q. Only HorizontalRunnerAutoscalers in %q are watched, cached, and considered as scale targets.", watchNamespace, watchNamespace))
	}

	ctrl.SetLogger(logger)

	// In order to support runner groups with custom visibility (selected repositories), we need to perform some GitHub API calls.
	// Let the user define if they want to opt-in supporting this option by providing the proper GitHub authentication parameters
	// Without an opt-in, runner groups with custom visibility won't be supported to save API calls
	// That is, all runner groups managed by ARC are assumed to be visible to any repositories,
	// which is wrong when you have one or more non-default runner groups in your organization or enterprise.
	if len(c.Token) > 0 || (c.AppID > 0 && c.AppInstallationID > 0 && c.AppPrivateKey != "") || (len(c.BasicauthUsername) > 0 && len(c.BasicauthPassword) > 0) {
		c.Log = &logger

		ghClient, err = c.NewClient()
		if err != nil {
			fmt.Fprintln(os.Stderr, "Error: Client creation failed.", err)
			logger.Error(err, "unable to create controller", "controller", "Runner")
			os.Exit(1)
		}
	} else {
		logger.Info("GitHub client is not initialized. Runner groups with custom visibility are not supported. If needed, please provide GitHub authentication. This will incur in extra GitHub API calls")
	}

	syncPeriod := 10 * time.Minute
	mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
		Scheme: scheme,
		Cache: cache.Options{
			SyncPeriod: &syncPeriod,
			DefaultNamespaces: map[string]cache.Config{
				watchNamespace: {},
			},
		},
		Metrics: metricsserver.Options{
			BindAddress: metricsAddr,
		},
		WebhookServer: webhook.NewServer(webhook.Options{
			Port: 9443,
		}),
	})
	if err != nil {
		logger.Error(err, "unable to start manager")
		os.Exit(1)
	}

	hraGitHubWebhook := &actionssummerwindnet.HorizontalRunnerAutoscalerGitHubWebhook{
		Name:           "webhookbasedautoscaler",
		Client:         mgr.GetClient(),
		Log:            ctrl.Log.WithName("controllers").WithName("webhookbasedautoscaler"),
		Recorder:       nil,
		Scheme:         mgr.GetScheme(),
		SecretKeyBytes: []byte(webhookSecretToken),
		Namespace:      watchNamespace,
		GitHubClient:   ghClient,
		QueueLimit:     queueLimit,
	}

	if err = hraGitHubWebhook.SetupWithManager(mgr); err != nil {
		logger.Error(err, "unable to create controller", "controller", "webhookbasedautoscaler")
		os.Exit(1)
	}

	var wg sync.WaitGroup

	ctx, cancel := context.WithCancel(context.Background())

	wg.Add(1)
	go func() {
		defer cancel()
		defer wg.Done()

		logger.Info("starting webhook server")
		if err := mgr.Start(ctx); err != nil {
			logger.Error(err, "problem running manager")
			os.Exit(1)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/", hraGitHubWebhook.Handle)

	srv := http.Server{
		Addr:    webhookAddr,
		Handler: mux,
	}

	wg.Add(1)
	go func() {
		defer cancel()
		defer wg.Done()

		go func() {
			<-ctx.Done()

			srv.Shutdown(context.Background())
		}()

		if err := srv.ListenAndServe(); err != nil {
			if !errors.Is(err, http.ErrServerClosed) {
				logger.Error(err, "problem running http server")
			}
		}
	}()

	go func() {
		<-ctrl.SetupSignalHandler().Done()
		cancel()
	}()

	wg.Wait()
}

```

### Core Architecture Module: `controllers/actions.summerwind.net/horizontal_runner_autoscaler_webhook.go`
```
/*
Copyright 2020 The actions-runner-controller authors.

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

package actionssummerwindnet

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/tools/events"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	"github.com/go-logr/logr"
	gogithub "github.com/google/go-github/v52/github"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/actions/actions-runner-controller/apis/actions.summerwind.net/v1alpha1"
	"github.com/actions/actions-runner-controller/github"
	"github.com/actions/actions-runner-controller/simulator"
)

const (
	scaleTargetKey = "scaleTarget"

	keyPrefixEnterprise = "enterprises/"
	keyRunnerGroup      = "/group/"

	DefaultQueueLimit = 100
)

// HorizontalRunnerAutoscalerGitHubWebhook autoscales a HorizontalRunnerAutoscaler and the RunnerDeployment on each
// GitHub Webhook received
type HorizontalRunnerAutoscalerGitHubWebhook struct {
	client.Client
	Log      logr.Logger
	Recorder events.EventRecorder
	Scheme   *runtime.Scheme

	// SecretKeyBytes is the byte representation of the Webhook secret token
	// the administrator is generated and specified in GitHub Web UI.
	SecretKeyBytes []byte

	// GitHub Client to discover runner groups assigned to a repository
	GitHubClient *github.Client

	// Namespace is the namespace to watch for HorizontalRunnerAutoscaler's to be
	// scaled on Webhook.
	// Set to empty for letting it watch for all namespaces.
	Namespace string
	Name      string

	// QueueLimit is the maximum length of the bounded queue of scale targets and their associated operations
	// A scale target is enqueued on each retrieval of each eligible webhook event, so that it is processed asynchronously.
	QueueLimit int

	worker     *worker
	workerInit sync.Once
}

func (autoscaler *HorizontalRunnerAutoscalerGitHubWebhook) Reconcile(_ context.Context, request reconcile.Request) (reconcile.Result, error) {
	return ctrl.Result{}, nil
}

// +kubebuilder:rbac:groups=actions.summerwind.dev,resources=horizontalrunnerautoscalers,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=actions.summerwind.dev,resources=horizontalrunnerautoscalers/finalizers,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=actions.summerwind.dev,resources=horizontalrunnerautoscalers/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=core,resources=events,verbs=create;patch

func (autoscaler *HorizontalRunnerAutoscalerGitHubWebhook) Handle(w http.ResponseWriter, r *http.Request) {
	var (
		ok bool

		err error
	)

	defer func() {
		if !ok {
			w.WriteHeader(http.StatusInternalServerError)

			if err != nil {
				msg := err.Error()
				if written, err := w.Write([]byte(msg)); err != nil {
					autoscaler.Log.V(1).Error(err, "failed writing http error response", "msg", msg, "written", written)
				}
			}
		}
	}()

	defer func() {
		if r.Body != nil {
			r.Body.Close()
		}
	}()

	// respond ok to GET / e.g. for health check
	if strings.ToUpper(r.Method) == http.MethodGet {
		ok = true
		fmt.Fprintln(w, "webhook server is running")
		return
	}

	var payload []byte

	if len(autoscaler.SecretKeyBytes) > 0 {
		payload, err = gogithub.ValidatePayload(r, autoscaler.SecretKeyBytes)
		if err != nil {
			autoscaler.Log.Error(err, "error validating request body")

			return
		}
	} else {
		payload, err = io.ReadAll(r.Body)
		if err != nil {
			autoscaler.Log.Error(err, "error reading request body")

			return
		}
	}

	webhookType := gogithub.WebHookType(r)
	event, err := gogithub.ParseWebHook(webhookType, payload)
	if err != nil {
		var s string
		if payload != nil {
			s = string(payload)
		}

		autoscaler.Log.Error(err, "could not parse webhook", "webhookType", webhookType, "payload", s)

		return
	}

	var target *ScaleTarget

	log := autoscaler.Log.WithValues(
		"event", webhookType,
		"hookID", r.Header.Get("X-GitHub-Hook-ID"),
		"delivery", r.Header.Get("X-GitHub-Delivery"),
	)

	var enterpriseEvent struct {
		Enterprise struct {
			Slug string `json:"slug,omitempty"`
		} `json:"enterprise,omitempty"`
	}
	if err := json.Unmarshal(payload, &enterpriseEvent); err != nil {
		var s string
		if payload != nil {
			s = string(payload)
		}
		autoscaler.Log.Error(err, "could not parse webhook payload for extracting enterprise slug", "webhookType", webhookType, "payload", s)
	}
	enterpriseSlug := enterpriseEvent.Enterprise.Slug

	switch e := event.(type) {
	case *gogithub.WorkflowJobEvent:
		if workflowJob := e.GetWorkflowJob(); workflowJob != nil {
			log = log.WithValues(
				"workflowJob.status", workflowJob.GetStatus(),
				"workflowJob.labels", workflowJob.Labels,
				"repository.name", e.Repo.GetName(),
				"repository.owner.login", e.Repo.Owner.GetLogin(),
				"repository.owner.type", e.Repo.Owner.GetType(),
				"enterprise.slug", enterpriseSlug,
				"action", e.GetAction(),
				"workflowJob.runID", e.WorkflowJob.GetRunID(),
				"workflowJob.ID", e.WorkflowJob.GetID(),
			)
		}

		labels := e.WorkflowJob.Labels

		switch action := e.GetAction(); action {
		case "queued", "completed":
			target, err = autoscaler.getJobScaleUpTargetForRepoOrOrg(
				context.TODO(),
				log,
				e.Repo.GetName(),
				e.Repo.Owner.GetLogin(),
				e.Repo.Owner.GetType(),
				enterpriseSlug,
				labels,
			)
			if target == nil {
				break
			}

			if e.GetAction() == "queued" {
				target.Amount = 1
				break
			} else if e.GetAction() == "completed" && e.GetWorkflowJob().GetConclusion() != "skipped" {
				// We want to filter out "completed" events sent by check runs.
				// See https://github.com/actions/actions-runner-controller/issues/2118
				// and https://github.com/actions/actions-runner-controller/pull/2119
				// But canceled events have runner_id == 0 and GetRunnerID() returns 0 when RunnerID == nil,
				// so we need to be more specific in filtering out the check runs.
				// See example check run completion at https://gist.github.com/nathanklick/268fea6496a4d7b14cecb2999747ef84
				if e.GetWorkflowJob().GetConclusion() == "success" && e.GetWorkflowJob().RunnerID == nil {
					log.V(1).Info("Ignoring workflow_job event because it does not relate to a self-hosted runner")
				} else {
					// A negative amount is processed in the tryScale func as a scale-down request,
					// that erases the oldest CapacityReservation with the same amount.
					// If the first CapacityReservation was with Replicas=1, this negative scale target erases that,
					// so that the resulting desired replicas decreases by 1.
					target.Amount = -1
					break
				}
			}
			// If the conclusion is "skipped", we will ignore it and fallthrough to the default case.
			fallthrough
		default:
			ok = true

			w.WriteHeader(http.StatusOK)

			log.V(2).Info("Received and ignored a workflow_job event as it triggers neither scale-up nor scale-down", "action", action)

			return
		}
	case *gogithub.PingEvent:
		ok = true

		w.WriteHeader(http.StatusOK)

		msg := "pong"

		if written, err := w.Write([]byte(msg)); err != nil {
			log.Error(err, "failed writing http response", "msg", msg, "written", written)
		}

		log.Info("received ping event")

		return
	default:
		log.Info("unknown event type", "eventType", webhookType)

		return
	}

	if err != nil {
		log.Error(err, "handling check_run event")

		return
	}

	if target == nil {
		log.V(1).Info(
			"Scale target not found. If this is unexpected, ensure that there is exactly one repository-wide or organizational runner deployment that matches this webhook event. If --watch-namespace is set ensure this is configured correctly.",
		)

		msg := "no horizontalrunnerautoscaler to scale for this github event"

		ok = true

		w.WriteHeader(http.StatusOK)

		if written, err := w.Write([]byte(msg)); err != nil {
			log.Error(err, "failed writing http response", "msg", msg, "written", written)
		}

		return
	}

	autoscaler.workerInit.Do(func() {
		batchScaler := newBatchScaler(context.Background(), autoscaler.Client, autoscaler.Log)

		queueLimit := autoscaler.QueueLimit
		if queueLimit == 0 {
			queueLimit = DefaultQueueLimit
		}
		autoscaler.worker = newWorker(context.Background(), queueLimit, batchScaler.Add)
	})

	target.log = &log
	if ok := autoscaler.worker.Add(target); !ok {
		log.Error(err, "Could not scale up due to queue full")
		return
	}

	ok = true

	w.WriteHeader(http.StatusOK)

	msg := fmt.Sprintf("scaled %s by %d", target.Name, target.Amount)

	log.Info(msg)

	if written, err := w.Write([]byte(msg)); err != nil {
		log.Error(err, "failed writing http response", "msg", msg, "written", written)
	}
}

func (autoscaler *HorizontalRunnerAutoscalerGitHubWebhook) findHRAsByKey(ctx context.Context, value string) ([]v1alpha1.HorizontalRunnerAutoscaler, error) {
	ns := autoscaler.Namespace

	var defaultListOpts []client.ListOption

	if ns != "" {
		defaultListOpts = append(defaultListOpts, client.InNamespace(ns))
	}

	// Get all HRAs since we can't use the index for repository/organization lookup anymore
	var hraList v1alpha1.HorizontalRunnerAutoscalerList
	if err := autoscaler.List(ctx, &hraList, defaultListOpts...); err != nil {
		return nil, err
	}

	var matchingHRAs []v1alpha1.HorizontalRunnerAutoscaler

	if value == "" {
		return matchingHRAs, nil
	}

	// For each HRA, resolve its ScaleTargetRef and check if it matches the requested value
	for _, hra := range hraList.Items {
		if hra.Spec.Scal
```

### Core Architecture Module: `controllers/actions.summerwind.net/horizontal_runner_autoscaler_webhook_worker.go`
```
package actionssummerwindnet

import (
	"context"
)

// worker is a worker that has a non-blocking bounded queue of scale targets, dequeues scale target and executes the scale operation one by one.
type worker struct {
	scaleTargetQueue chan *ScaleTarget
	work             func(*ScaleTarget)
	done             chan struct{}
}

func newWorker(ctx context.Context, queueLimit int, work func(*ScaleTarget)) *worker {
	w := &worker{
		scaleTargetQueue: make(chan *ScaleTarget, queueLimit),
		work:             work,
		done:             make(chan struct{}),
	}

	go func() {
		defer close(w.done)

		for {
			select {
			case <-ctx.Done():
				return
			case t := <-w.scaleTargetQueue:
				work(t)
			}
		}
	}()

	return w
}

// Add the scale target to the bounded queue, returning the result as a bool value. It returns true on successful enqueue, and returns false otherwise.
// When returned false, the queue is already full so the enqueue operation must be retried later.
// If the enqueue was triggered by an external source and there's no intermediate queue that we can use,
// you must instruct the source to resend the original request later.
// In case you're building a webhook server around this worker, this means that you must return a http error to the webhook server,
// so that (hopefully) the sender can resend the webhook event later, or at least the human operator can notice or be notified about the
// webhook develiery failure so that a manual retry can be done later.
func (w *worker) Add(st *ScaleTarget) bool {
	select {
	case w.scaleTargetQueue <- st:
		return true
	default:
		return false
	}
}

func (w *worker) Done() chan struct{} {
	return w.done
}

```

### Core Architecture Module: `controllers/actions.summerwind.net/utils.go`
```
package actionssummerwindnet

func filterLabels(labels map[string]string, filter string) map[string]string {
	filtered := map[string]string{}

	for k, v := range labels {
		if k != filter {
			filtered[k] = v
		}
	}

	return filtered
}

```

### Core Architecture Module: `pkg/actionsmetrics/webhookserver.go`
```
package actionsmetrics

/*
Copyright 2022 The actions-runner-controller authors.

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

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	"github.com/go-logr/logr"
	gogithub "github.com/google/go-github/v52/github"
	ctrl "sigs.k8s.io/controller-runtime"

	"github.com/actions/actions-runner-controller/github"
)

type EventHook func(interface{})

// WebhookServer is a HTTP server that handles workflow_job events sent from GitHub Actions
type WebhookServer struct {
	Log logr.Logger

	// SecretKeyBytes is the byte representation of the Webhook secret token
	// the administrator is generated and specified in GitHub Web UI.
	SecretKeyBytes []byte

	// GitHub Client to discover runner groups assigned to a repository
	GitHubClient *github.Client

	// When HorizontalRunnerAutoscalerGitHubWebhook handles a request, each EventHook is sent the webhook event
	EventHooks []EventHook
}

func (autoscaler *WebhookServer) Reconcile(_ context.Context, request reconcile.Request) (reconcile.Result, error) {
	return ctrl.Result{}, nil
}

func (autoscaler *WebhookServer) Handle(w http.ResponseWriter, r *http.Request) {
	var (
		ok bool

		err error
	)

	defer func() {
		if !ok {
			w.WriteHeader(http.StatusInternalServerError)

			if err != nil {
				msg := err.Error()
				if written, err := w.Write([]byte(msg)); err != nil {
					autoscaler.Log.V(1).Error(err, "failed writing http error response", "msg", msg, "written", written)
				}
			}
		}
	}()

	defer func() {
		if r.Body != nil {
			r.Body.Close()
		}
	}()

	// respond ok to GET / e.g. for health check
	if r.Method == http.MethodGet {
		ok = true
		fmt.Fprintln(w, "actions-metrics-server is running")
		return
	}

	var payload []byte

	if len(autoscaler.SecretKeyBytes) > 0 {
		payload, err = gogithub.ValidatePayload(r, autoscaler.SecretKeyBytes)
		if err != nil {
			autoscaler.Log.Error(err, "error validating request body")

			return
		}
	} else {
		payload, err = io.ReadAll(r.Body)
		if err != nil {
			autoscaler.Log.Error(err, "error reading request body")

			return
		}
	}

	webhookType := gogithub.WebHookType(r)
	event, err := gogithub.ParseWebHook(webhookType, payload)
	if err != nil {
		var s string
		if payload != nil {
			s = string(payload)
		}

		autoscaler.Log.Error(err, "could not parse webhook", "webhookType", webhookType, "payload", s)

		return
	}

	log := autoscaler.Log.WithValues(
		"event", webhookType,
		"hookID", r.Header.Get("X-GitHub-Hook-ID"),
		"delivery", r.Header.Get("X-GitHub-Delivery"),
	)

	switch event.(type) {
	case *gogithub.PingEvent:
		ok = true

		w.WriteHeader(http.StatusOK)

		msg := "pong"

		if written, err := w.Write([]byte(msg)); err != nil {
			log.Error(err, "failed writing http response", "msg", msg, "written", written)
		}

		log.Info("handled ping event")

		return
	}

	for _, eventHook := range autoscaler.EventHooks {
		eventHook(event)
	}

	ok = true

	w.WriteHeader(http.StatusOK)

	msg := "ok"

	log.Info(msg)

	if written, err := w.Write([]byte(msg)); err != nil {
		log.Error(err, "failed writing http response", "msg", msg, "written", written)
	}
}

```

### Core Architecture Module: `pkg/githubwebhookdeliveryforwarder/cmd/main.go`
```
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/actions/actions-runner-controller/github"
	"github.com/actions/actions-runner-controller/pkg/githubwebhookdeliveryforwarder"
	"github.com/kelseyhightower/envconfig"
)

func main() {
	var (
		metricsAddr string
		target      string
		repo        string
	)

	var c github.Config

	if err := envconfig.Process("github", &c); err != nil {
		fmt.Fprintln(os.Stderr, "Error: Environment variable read failed.")
	}

	flag.StringVar(&metricsAddr, "metrics-addr", ":8000", "The address the metric endpoint binds to.")
	flag.StringVar(&repo, "repo", "", "The owner/name of the repository that has the target hook. If specified, the forwarder will use the first hook configured on the repository as the source.")
	flag.StringVar(&target, "target", "", "The URL of the forwarding target that receives all the forwarded webhooks.")
	flag.StringVar(&c.Token, "github-token", c.Token, "The personal access token of GitHub.")
	flag.Int64Var(&c.AppID, "github-app-id", c.AppID, "The application ID of GitHub App.")
	flag.Int64Var(&c.AppInstallationID, "github-app-installation-id", c.AppInstallationID, "The installation ID of GitHub App.")
	flag.StringVar(&c.AppPrivateKey, "github-app-private-key", c.AppPrivateKey, "The path of a private key file to authenticate as a GitHub App")
	flag.Parse()

	ghClient, err := c.NewClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error: Client creation failed.", err)
		os.Exit(1)
	}

	var wg sync.WaitGroup

	ctx, cancel := context.WithCancel(context.Background())

	fwd := githubwebhookdeliveryforwarder.New(ghClient, target)
	fwd.Repo = repo

	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", fwd.HandleReadyz)

	srv := http.Server{
		Addr:    metricsAddr,
		Handler: mux,
	}

	wg.Add(1)
	go func() {
		defer cancel()
		defer wg.Done()

		if err := fwd.Run(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "problem running forwarder: %v\n", err)
		}
	}()

	wg.Add(1)
	go func() {
		defer cancel()
		defer wg.Done()

		go func() {
			<-ctx.Done()

			srv.Shutdown(context.Background())
		}()

		if err := srv.ListenAndServe(); err != nil {
			if !errors.Is(err, http.ErrServerClosed) {
				fmt.Fprintf(os.Stderr, "problem running http server: %v\n", err)
			}
		}
	}()

	go func() {
		<-SetupSignalHandler().Done()
		cancel()
	}()

	wg.Wait()
}

/*
Copyright 2017 The Kubernetes Authors.

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

var onlyOneSignalHandler = make(chan struct{})

var shutdownSignals = []os.Signal{os.Interrupt, syscall.SIGTERM}

// SetupSignalHandler registers for SIGTERM and SIGINT. A stop channel is returned
// which is closed on one of these signals. If a second signal is caught, the program
// is terminated with exit code 1.
func SetupSignalHandler() context.Context {
	close(onlyOneSignalHandler) // panics when called twice

	ctx, cancel := context.WithCancel(context.Background())

	c := make(chan os.Signal, 2)
	signal.Notify(c, shutdownSignals...)
	go func() {
		<-c
		cancel()
		<-c
		os.Exit(1) // second signal. Exit directly.
	}()

	return ctx
}

```

### Core Architecture Module: `pkg/githubwebhookdeliveryforwarder/githubwebhookdelivery.go`
```
package githubwebhookdeliveryforwarder

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/actions/actions-runner-controller/github"
	gogithub "github.com/google/go-github/v52/github"
)

type server struct {
	target string
	Repo   string
	client *github.Client
}

func New(client *github.Client, target string) *server {
	var srv server

	srv.target = target
	srv.client = client

	return &srv
}

func (s *server) Run(ctx context.Context) error {
	segments := strings.Split(s.Repo, "/")

	if len(segments) != 2 {
		return fmt.Errorf("repository must be in a form of OWNER/REPO: got %q", s.Repo)
	}

	owner, repo := segments[0], segments[1]

	hooks, _, err := s.client.Repositories.ListHooks(ctx, owner, repo, nil)
	if err != nil {
		s.Errorf("Failed listing hooks: %v", err)

		return err
	}

	var hook *gogithub.Hook

	for i := range hooks {
		hook = hooks[i]
		break
	}

	cur := &cursor{}

	cur.deliveredAt = time.Now()

	for {
		var (
			err      error
			payloads [][]byte
		)

		payloads, cur, err = s.getUnprocessedDeliveries(ctx, owner, repo, hook.GetID(), *cur)
		if err != nil {
			s.Errorf("failed getting unprocessed deliveries: %v", err)
		}

		for _, p := range payloads {
			if _, err := http.Post(s.target, "application/json", bytes.NewReader(p)); err != nil {
				s.Errorf("failed forwarding delivery: %v", err)
			}
		}

		time.Sleep(10 * time.Second)
	}
}

type cursor struct {
	deliveredAt time.Time
	id          int64
}

func (s *server) getUnprocessedDeliveries(ctx context.Context, owner, repo string, hookID int64, pos cursor) ([][]byte, *cursor, error) {
	var (
		opts gogithub.ListCursorOptions
	)

	opts.PerPage = 2

	var deliveries []*gogithub.HookDelivery

OUTER:
	for {
		ds, resp, err := s.client.Repositories.ListHookDeliveries(ctx, owner, repo, hookID, &opts)
		if err != nil {
			return nil, nil, err
		}

		opts.Cursor = resp.Cursor

		for _, d := range ds {
			d, _, err := s.client.Repositories.GetHookDelivery(ctx, owner, repo, hookID, d.GetID())
			if err != nil {
				return nil, nil, err
			}

			payload, err := d.ParseRequestPayload()
			if err != nil {
				return nil, nil, err
			}

			id := d.GetID()
			deliveredAt := d.GetDeliveredAt()

			if !pos.deliveredAt.IsZero() && deliveredAt.Before(pos.deliveredAt) {
				s.Logf("%s is before %s so skipping all the remaining deliveries", deliveredAt, pos.deliveredAt)
				break OUTER
			}

			if pos.id != 0 && id <= pos.id {
				break OUTER
			}

			s.Logf("Received %T at %s: %v", payload, deliveredAt, payload)

			if deliveredAt.After(pos.deliveredAt) {
				pos.deliveredAt = deliveredAt.Time
			}

			if id > pos.id {
				pos.id = id
			}
		}

		if opts.Cursor == "" {
			break
		}

		time.Sleep(1 * time.Second)
	}

	sort.Slice(deliveries, func(a, b int) bool {
		return deliveries[b].GetDeliveredAt().After(deliveries[a].GetDeliveredAt().Time)
	})

	var payloads [][]byte

	for _, d := range deliveries {
		payloads = append(payloads, *d.Request.RawPayload)
	}

	return payloads, &pos, nil
}

func (s *server) HandleReadyz(w http.ResponseWriter, r *http.Request) {
	var (
		ok bool

		err error
	)

	defer func() {
		if !ok {
			w.WriteHeader(http.StatusInternalServerError)

			if err != nil {
				msg := err.Error()
				if _, err := w.Write([]byte(msg)); err != nil {
					s.Errorf("failed writing http error response: %v", err)
				}
			}
		}
	}()

	defer func() {
		if r.Body != nil {
			r.Body.Close()
		}
	}()

	// respond ok to GET / e.g. for health check
	if r.Method == http.MethodGet {
		fmt.Fprintln(w, "webhook server is running")
		return
	}

	w.WriteHeader(http.StatusOK)

	if _, err := w.Write([]byte("ok")); err != nil {
		s.Errorf("failed writing http response: %v", err)
	}
}

func (s *server) Logf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stdout, format+"\n", args...)
}

func (s *server) Errorf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}

```

### Core Architecture Module: `pkg/hookdeliveryforwarder/checkpointer.go`
```
package hookdeliveryforwarder

import "time"

type Checkpointer interface {
	GetOrCreate(hookID int64) (*State, error)
	Update(hookID int64, pos *State) error
}

type InMemoryCheckpointer struct {
	t  time.Time
	id int64
}

func (p *InMemoryCheckpointer) GetOrCreate(hookID int64) (*State, error) {
	return &State{DeliveredAt: p.t}, nil
}

func (p *InMemoryCheckpointer) Update(hookID int64, pos *State) error {
	p.t = pos.DeliveredAt
	p.id = pos.ID

	return nil
}

func NewInMemoryLogPositionProvider() Checkpointer {
	return &InMemoryCheckpointer{
		t: time.Now(),
	}
}

```

### Core Architecture Module: `pkg/hookdeliveryforwarder/cmd/main.go`
```
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/actions/actions-runner-controller/pkg/hookdeliveryforwarder"
	"github.com/actions/actions-runner-controller/pkg/hookdeliveryforwarder/configmap"
	"github.com/go-logr/logr"
	zaplib "go.uber.org/zap"

	"k8s.io/apimachinery/pkg/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"

	"sigs.k8s.io/controller-runtime/pkg/log/zap"
)

const (
	logLevelDebug = "debug"
	logLevelInfo  = "info"
	logLevelWarn  = "warn"
	logLevelError = "error"
)

var (
	scheme = runtime.NewScheme()
)

func init() {
	_ = clientgoscheme.AddToScheme(scheme)
}

func main() {
	var (
		logLevel string

		checkpointerConfig configmap.Config
	)

	flag.StringVar(&logLevel, "log-level", logLevelDebug, `The verbosity of the logging. Valid values are "debug", "info", "warn", "error". Defaults to "debug".`)

	checkpointerConfig.InitFlags(flag.CommandLine)

	config := &hookdeliveryforwarder.Config{}

	config.InitFlags((flag.CommandLine))

	flag.Parse()

	logger := newZapLogger(logLevel)

	checkpointerConfig.Scheme = scheme
	checkpointerConfig.Logger = logger

	p, mgr, err := configmap.New(&checkpointerConfig)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}

	// TODO: Set to something that is backed by a CRD so that
	// restarting the forwarder doesn't result in missing deliveries.
	config.Checkpointer = p

	ctx := hookdeliveryforwarder.SetupSignalHandler()

	go func() {
		if err := mgr.Start(ctx); err != nil {
			fmt.Fprintf(os.Stderr, "problem running manager: %v\n", err)
			os.Exit(1)
		}
	}()

	hookdeliveryforwarder.Run(ctx, config)
}

func newZapLogger(logLevel string) logr.Logger {
	return zap.New(func(o *zap.Options) {
		switch logLevel {
		case logLevelDebug:
			o.Development = true
		case logLevelInfo:
			lvl := zaplib.NewAtomicLevelAt(zaplib.InfoLevel)
			o.Level = &lvl
		case logLevelWarn:
			lvl := zaplib.NewAtomicLevelAt(zaplib.WarnLevel)
			o.Level = &lvl
		case logLevelError:
			lvl := zaplib.NewAtomicLevelAt(zaplib.ErrorLevel)
			o.Level = &lvl
		}
	})
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4653** (2026-09-12): **Cleanup stalls forever when an EphemeralRunner can never register (RemoveRunner called with RunnerID 0)**
  *Symptoms*: Split out of a review comment on #4638. The behaviour described here is **pre-existing on `master`** and is not introduced by that PR — it is filed separately so it is not lost.  ## What happens  When an `EphemeralRunnerSet`'s runner spec changes, `EphemeralRunnerSetReconciler.cleanUpEphemeralRunners` sends every pending runner through `deleteEphemeralRunnerWithActionsClient`, which calls:  ```go if err := actionsClient.RemoveRunner(ctx, int64(ephemeralRunner.Status.RunnerID)); err != nil { ```  `Status.RunnerID == 0` is the controller's explicit "not registered yet" value, and the real client does not treat it specially — it builds `DELETE /<runnerEndpoint>/0` and returns an error for any response other than 204:  ```go path := fmt.Sprintf("/%s/%d", runnerEndpoint, runnerID) ... if resp.StatusCode != http.StatusNoContent {     return newRequestResponseError(req, resp, fmt.Errorf("unexpected status code: %d", resp.StatusCode)) } ```  So the removal fails, the Kubernetes object is never deleted, and the cleanup returns early without completing.  ## Why it usually does not matter, and when it does  Normally this is self-healing. A `RunnerID` of 0 almost always means the status patch is merely late: the reconcile errors, backs off, and once the EphemeralRunner controller patches `Status.RunnerID` the removal succeeds.  The case that genuinely bites is a runner that can **never** register — bad image, wrong proxy, unreachable or wrong config URL. Then `RemoveRunner(0)` fails on e
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for filing an issue.  The maintainers will triage your issue shortly.  In the meantime, please take a look at the [troubleshooting guide](https://github.com/actions/actions-runner-controller/blob/master/TROUBLESHOOTING.md) for bug reports.  If this is a feature request, please review our [contribution guidelines](https://github.com/actions/actions-runner-controller/blob/master/CONTRIBUTING.md).
  > Agreeing with the prerequisite framing above, and extending it: **the prerequisite is twice as large as stated, and stopping at `RemoveRunner` would leave the fix half-unobservable.**  The suggested direction is to resolve the ID with `GetRunnerByName` when it is unknown. But that fake method ignores its argument in exactly the same way:  ```go func (c *Client) GetRunnerByName(ctx context.Context, runnerName string) (*scaleset.RunnerReference, error) { 	return c.getRunnerByNameResult.RunnerReference, c.getRunnerByNameResult.err } ```  So the fake is blind on **both** sides of the change. `RemoveRunner` cannot distinguish `0` from a valid ID, which hides the bug; `GetRunnerByName` cannot distinguish the right name from any other, which hides whether the remedy actually resolves the runner it claims to. A test could assert "cleanup completed" and be green against an implementation that looked up the wrong runner entirely, or looked nothing up at all and returned the canned reference.  Co
  > Refining my previous comment, because I checked the whole fake rather than the two methods in question and the picture is more favourable than I implied.  It is **not** true that the fake is uniformly canned. Four of its thirteen methods already accept an argument-aware hook and call it with the real arguments:  ```go func (c *Client) GetRunnerGroupByName(ctx context.Context, runnerGroup string) (*scaleset.RunnerGroup, error) { 	if c.getRunnerGroupByNameFunc != nil { 		return c.getRunnerGroupByNameFunc(ctx, runnerGroup) 	} 	return c.getRunnerGroupByNameResult.RunnerGroup, c.getRunnerGroupByNameResult.err } ```  The same shape exists for `GetRunnerScaleSetByID`, `CreateRunnerScaleSet` and `UpdateRunnerScaleSet`. So the fake already has an established, in-file idiom for exactly the problem here: a canned result by default, with an opt-in hook when a test needs to observe or vary on arguments. `RemoveRunner` and `GetRunnerByName` simply never had one added, because until now nothing neede

- **Issue #4650** (2026-09-11): **Confirm patched ARC release for golang.org/x/crypto CVEs**
  *Symptoms*: ### Checks  - [x] I've already read https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/troubleshooting-actions-runner-controller-errors and I'm sure my issue is not covered in the troubleshooting guide. - [x] I am using charts that are officially provided  ### Controller Version  0.14.2  ### Deployment Method  ArgoCD  ### Checks  - [x] This isn't a question or user support case (For Q&A and community support, go to [Discussions](https://github.com/actions/actions-runner-controller/discussions)). - [x] I've read the [Changelog](https://github.com/actions/actions-runner-controller/blob/master/docs/gha-runner-scale-set-controller/README.md#changelog) before submitting this issue and I'm sure it's not due to any recently-introduced backward-incompatible changes  ### To Reproduce  ```markdown Our vulnerability scanner reports seven published CVEs affecting golang.org/x/crypto in the ARC image we use.  The linked GitHub advisories identify `v0.52.0` as the first patched version for all seven findings.  | Advisory | Description | |---|---| | [CVE-2026-46595](https://github.com/advisories/GHSA-x527-x647-q7gg) | SSH permissions/source-address enforcement bypass | | [CVE-2026-39830](https://github.com/advisories/GHSA-vgwf-h737-ff37) | SSH connection deadlock and resource leak | | [CVE-2026-39831](https://github.com/advisories/GHSA-89gr-r52h-f8rx) | FIDO/U2F user-presence check bypass | | [CVE-2026-39832](https://githu
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for filing an issue.  The maintainers will triage your issue shortly.  In the meantime, please take a look at the [troubleshooting guide](https://github.com/actions/actions-runner-controller/blob/master/TROUBLESHOOTING.md) for bug reports.  If this is a feature request, please review our [contribution guidelines](https://github.com/actions/actions-runner-controller/blob/master/CONTRIBUTING.md).
  > @nikola-jokic Is there a new release we can use that addresses those CVEs?

- **Issue #4632** (2026-09-17): **gha-runner-scale-set-controller couples pod cleanup to runner-service deregistration, causing avoidable delays under burst load**
  *Symptoms*: ### Checks  - [x] I've already read https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/troubleshooting-actions-runner-controller-errors and I'm sure my issue is not covered in the troubleshooting guide. - [x] I am using charts that are officially provided  ### Controller Version  0.14.2  ### Deployment Method  ArgoCD  ### Checks  - [x] This isn't a question or user support case (For Q&A and community support, go to [Discussions](https://github.com/actions/actions-runner-controller/discussions)). - [x] I've read the [Changelog](https://github.com/actions/actions-runner-controller/blob/master/docs/gha-runner-scale-set-controller/README.md#changelog) before submitting this issue and I'm sure it's not due to any recently-introduced backward-incompatible changes  ### To Reproduce  ```markdown 1. Deploy gha-runner-scale-set-controller v0.14.2 (Helm, official chart) with --workqueue-rate-limiter=typed_rate_limiter, --runner-max-concurrent-reconciles=1000, --k8s-client-rate-limiter-qps=2000, --k8s-client-rate-limiter-burst=4000. 2. Deploy a single AutoscalingRunnerSet. 3. Dispatch a sustained burst of ephemeral-runner jobs against it (we ran ~400 jobs/min, 4,480 total jobs, no pod crashes/evictions). 4. Poll `kubectl get pods -n <ns> --field-selector=status.phase=Succeeded` every 30s during and after the burst. ```  ### Describe the bug  The count of completed-but-uncleaned (Succeeded phase) runner pods grew monoton
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for filing an issue.  The maintainers will triage your issue shortly.  In the meantime, please take a look at the [troubleshooting guide](https://github.com/actions/actions-runner-controller/blob/master/TROUBLESHOOTING.md) for bug reports.  If this is a feature request, please review our [contribution guidelines](https://github.com/actions/actions-runner-controller/blob/master/CONTRIBUTING.md).

- **Issue #4564** (2026-07-14): **Bug Report**
  *Symptoms*: [###](url) Checks  - [x] I've already read https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/troubleshooting-actions-runner-controller-errors and I'm sure my issue is not covered in the troubleshooting guide. - [x] I am using charts that are officially provided  ### Controller Version  0.6.1  ### Deployment Method  Helm  ### Checks  - [x] This isn't a question or user support case (For Q&A and community support, go to [Discussions](https://github.com/actions/actions-runner-controller/discussions)). - [x] I've read the [Changelog](https://github.com/actions/actions-runner-controller/blob/master/docs/gha-runner-scale-set-controller/README.md#changelog) before submitting this issue and I'm sure it's not due to any recently-introduced backward-incompatible changes  ### To Reproduce  ```markdown . ```  ### Describe the bug  .  ### Describe the expected behavior  .  ### Additional Context  ```yaml . ```  ### Controller Logs  ```shell . ```  ### Runner Pod Logs  ```shell . ```
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for filing an issue.  The maintainers will triage your issue shortly.  In the meantime, please take a look at the [troubleshooting guide](https://github.com/actions/actions-runner-controller/blob/master/TROUBLESHOOTING.md) for bug reports.  If this is a feature request, please review our [contribution guidelines](https://github.com/actions/actions-runner-controller/blob/master/CONTRIBUTING.md).
  > nee

- **Issue #4560** (2026-08-04): **HA fails when using `runnerGroup`**
  *Symptoms*: ### Checks  - [x] I've already read https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/troubleshooting-actions-runner-controller-errors and I'm sure my issue is not covered in the troubleshooting guide. - [x] I am using charts that are officially provided  ### Controller Version  0.14.1  ### Deployment Method  Helm  ### Checks  - [x] This isn't a question or user support case (For Q&A and community support, go to [Discussions](https://github.com/actions/actions-runner-controller/discussions)). - [x] I've read the [Changelog](https://github.com/actions/actions-runner-controller/blob/master/docs/gha-runner-scale-set-controller/README.md#changelog) before submitting this issue and I'm sure it's not due to any recently-introduced backward-incompatible changes  ### To Reproduce  ```markdown note: this is in a github enterprise 3.17.15 environment, I already raised a ticket to github support in case it's anissue on the GHE side, and not the runners.    1. Have a working ARC install (chart 0.14.1) with no `runnerGroup:` set —    scale set lands in the Default enterprise runner group. Works fine,    picks up jobs, has been running in production for us for ~2 months.  2. On a second independent cluster, install ARC per the [official HA docs](https://docs.github.com/en/enterprise-server@3.17/actions/how-tos/manage-runners/use-actions-runner-controller/deploy-runner-scale-sets#high-availability-and-automatic-failover):
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for filing an issue.  The maintainers will triage your issue shortly.  In the meantime, please take a look at the [troubleshooting guide](https://github.com/actions/actions-runner-controller/blob/master/TROUBLESHOOTING.md) for bug reports.  If this is a feature request, please review our [contribution guidelines](https://github.com/actions/actions-runner-controller/blob/master/CONTRIBUTING.md).
  > I opened a github enterprise support ticket, this seems to be a bug/issue in github enterprise, rather than an ARC problem. thanks.

- **Issue #4554** (2026-09-08): **Listener Kubernetes Client throttling at 5 QPS**
  *Symptoms*: ### Checks  - [x] I've already read https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/troubleshooting-actions-runner-controller-errors and I'm sure my issue is not covered in the troubleshooting guide. - [x] I am using charts that are officially provided  ### Controller Version  0.14.2  ### Deployment Method  Helm  ### Checks  - [x] This isn't a question or user support case (For Q&A and community support, go to [Discussions](https://github.com/actions/actions-runner-controller/discussions)). - [x] I've read the [Changelog](https://github.com/actions/actions-runner-controller/blob/master/docs/gha-runner-scale-set-controller/README.md#changelog) before submitting this issue and I'm sure it's not due to any recently-introduced backward-incompatible changes  ### To Reproduce  ```markdown Request >5 jobs/second on the same scaleset for at least a brief duration ```  ### Describe the bug  The listener is effectively capped at being able to process 5 JobStarted messages per second once the burst bucket (10) is exhausted. The controller exposes configuration for the k8s client via `k8sClientRateLimiterQPS` but this isn't available for the listener. 5 QPS is the [default](https://github.com/kubernetes/client-go/blob/1478a6809c5727c3b7bd224b25da2d73488b68bf/rest/config.go#L48) in the go k8s client when none is provided. The kubernetes client in `scaler.go` doesn't pass in any configuration for the QPS or Burst.  ###
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for filing an issue.  The maintainers will triage your issue shortly.  In the meantime, please take a look at the [troubleshooting guide](https://github.com/actions/actions-runner-controller/blob/master/TROUBLESHOOTING.md) for bug reports.  If this is a feature request, please review our [contribution guidelines](https://github.com/actions/actions-runner-controller/blob/master/CONTRIBUTING.md).
  > Any updates on this?
  > #4558 would solve the issue so long as it's merged before 0.15.0 is released

- **Issue #4546** (2026-06-29): **Runner keeps being deleted?**
  *Symptoms*:  ### Describe the bug  The runner settings in github keeps being deleted. I have to keep setting up the self hosted runner over and over again , this is very annoying. Stop automatically deleting my self hosted runner settings, this isnt security its just annoying.   ### Describe the expected behavior  Dont delete my self hosted github runner setup ever ,  period. Let me set that for myslef.   
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for filing an issue.  The maintainers will triage your issue shortly.  In the meantime, please take a look at the [troubleshooting guide](https://github.com/actions/actions-runner-controller/blob/master/TROUBLESHOOTING.md) for bug reports.  If this is a feature request, please review our [contribution guidelines](https://github.com/actions/actions-runner-controller/blob/master/CONTRIBUTING.md).
  > Hey @decyphertek-io,  Please follow the issue template. Otherwise, we cannot reproduce what you are seeing and we cannot debug the issue. What do you mean by not deletig self hosted runners? ARC runners are ephemeral, and the controller handles the scaling.
  > The workflow actions self hosted runner just gets deleted after a few weeks of not being used.  " Self-hosted runners in GitHub Actions are automatically removed if they have not connected to GitHub for more than 14 days for non-ephemeral runners and more than one day for ephemeral runners. "   Looks like this issue has been around for a while. https://github.blog/changelog/2022-08-02-github-actions-remove-offline-self-hosted-runners/   Stop deleted my self hosted runner. It takes a while to setup again. Why not have a setting to adjust this , why is it just automatically deleted?   

- **Issue #4527** (2026-06-12): **v2.334.0-ubuntu-22.04 image release fail**
  *Symptoms*: ### Checks  - [x] I've already read https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/troubleshooting-actions-runner-controller-errors and I'm sure my issue is not covered in the troubleshooting guide. - [x] I am using charts that are officially provided  ### Controller Version  0.14.2  ### Deployment Method  Helm  ### Checks  - [x] This isn't a question or user support case (For Q&A and community support, go to [Discussions](https://github.com/actions/actions-runner-controller/discussions)). - [x] I've read the [Changelog](https://github.com/actions/actions-runner-controller/blob/master/docs/gha-runner-scale-set-controller/README.md#changelog) before submitting this issue and I'm sure it's not due to any recently-introduced backward-incompatible changes  ### To Reproduce  ```markdown Check this link: https://github.com/actions-runner-controller/releases/actions/runs/24787009359/job/72533719124#step:6:2443 ```  ### Describe the bug  Because of the Github Actions error in your repository v2.334.0-ubuntu-22.04 image did not released.   ### Describe the expected behavior  Ubuntu 22 supported till April 2027. It is good to have this version.   ### Additional Context  ```yaml Not necessary. ```  ### Controller Logs  ```shell Not necessary. ```  ### Runner Pod Logs  ```shell Not necessary. ```
  **Post-Mortem & Fix Analysis**:
  > Hello! Thank you for filing an issue.  The maintainers will triage your issue shortly.  In the meantime, please take a look at the [troubleshooting guide](https://github.com/actions/actions-runner-controller/blob/master/TROUBLESHOOTING.md) for bug reports.  If this is a feature request, please review our [contribution guidelines](https://github.com/actions/actions-runner-controller/blob/master/CONTRIBUTING.md).

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

### Incident Patch 1: `5aed393a` (2026-10-02)
**Commit Message**: Read the e2e Go version from go.mod and apply the safe go fix modernizers (#4677)

**File**: `charts/gha-runner-scale-set-controller/tests/metrics_test.go` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ func TestControllerMetricsAddress(t *testing.T) {
 
 func indentMetricsValues(values string) string {
 	result := ""
-	for _, line := range strings.Split(strings.TrimSuffix(values, "\n"), "\n") {
+	for line := range strings.SplitSeq(strings.TrimSuffix(values, "\n"), "\n") {
 		result += "  " + line + "\n"
 	}
 	return result
```

**File**: `charts/gha-runner-scale-set/tests/template_test.go` (modified, +5/-12)
```diff
@@ -2,6 +2,7 @@ package tests
 
 import (
 	"fmt"
+	"maps"
 	"path/filepath"
 	"strings"
 	"testing"
@@ -210,12 +211,8 @@ func TestTemplateListenerScalerValidation(t *testing.T) {
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
 			setValues := make(map[string]string, len(baseValues)+len(tt.setValues))
-			for key, value := range baseValues {
-				setValues[key] = value
-			}
-			for key, value := range tt.setValues {
-				setValues[key] = value
-			}
+			maps.Copy(setValues, baseValues)
+			maps.Copy(setValues, tt.setValues)
 
 			options := &helm.Options{
 				Logger:         logger.Discard,
@@ -276,12 +273,8 @@ func TestTemplateListenerScalerConfig(t *testing.T) {
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
 			setValues := make(map[string]string, len(baseValues)+len(tt.setValues))
-			for key, value := range baseValues {
-				setValues[key] = value
-			}
-			for key, value := range tt.setValues {
-				setValues[key] = value
-			}
+			maps.Copy(setValues, baseValues)
+			maps.Copy(setValues, tt.setValues)
 
 			options := &helm.Options{
 				Logger:         logger.Discard,
```

**File**: `controllers/actions.github.com/ephemeralrunnerset_controller_test.go` (modified, +1/-1)
```diff
@@ -1454,7 +1454,7 @@ var _ = Describe("Test EphemeralRunnerSet controller", func() {
 			).Should(BeEquivalentTo(3), "3 EphemeralRunner should be created")
 
 			idleRunnerNames := map[string]struct{}{}
-			for i := 0; i < 2; i++ {
+			for i := range 2 {
 				idleRunner := runnerList.Items[i].DeepCopy()
 				idleRunner.Status.Phase = v1alpha1.EphemeralRunnerPhaseRunning
 				idleRunner.Status.RunnerID = i + 101
```

**File**: `controllers/actions.github.com/predicates_test.go` (modified, +2/-2)
```diff
@@ -470,8 +470,8 @@ func TestPredicateProjectionsCoverEveryStatusField(t *testing.T) {
 	fieldNames := func(v any) []string {
 		typ := reflect.TypeOf(v)
 		names := make([]string, 0, typ.NumField())
-		for i := 0; i < typ.NumField(); i++ {
-			names = append(names, typ.Field(i).Name)
+		for field := range typ.Fields() {
+			names = append(names, field.Name)
 		}
 		sort.Strings(names)
 		return names
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -28,6 +28,7 @@ require (
 	github.com/teambition/rrule-go v1.8.2
 	go.uber.org/multierr v1.11.0
 	go.uber.org/zap v1.28.0
+	golang.org/x/mod v0.41.0
 	golang.org/x/net v0.59.0
 	golang.org/x/oauth2 v0.37.0
 	golang.org/x/sync v0.23.0
@@ -211,7 +212,6 @@ require (
 	go.yaml.in/yaml/v4 v4.0.0-rc.6 // indirect
 	golang.org/x/crypto v0.57.0 // indirect
 	golang.org/x/exp v0.0.0-20260908205506-85c1c2202aba // indirect
-	golang.org/x/mod v0.41.0 // indirect
 	golang.org/x/sys v0.48.0 // indirect
 	golang.org/x/term v0.46.0 // indirect
 	golang.org/x/text v0.42.0 // indirect
```

**File**: `hash/fnv.go` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import (
 	"k8s.io/apimachinery/pkg/util/rand"
 )
 
-func FNVHashStringObjects(objs ...interface{}) string {
+func FNVHashStringObjects(objs ...any) string {
 	hash := fnv.New32a()
 
 	for _, obj := range objs {
```

**File**: `hash/hash.go` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ import (
 // DeepHashObject writes specified object to hash using the spew library
 // which follows pointers and prints actual values of the nested objects
 // ensuring the hash does not change when a pointer changes.
-func DeepHashObject(hasher hash.Hash, objectToWrite interface{}) {
+func DeepHashObject(hasher hash.Hash, objectToWrite any) {
 	hasher.Reset()
 	printer := spew.ConfigState{
 		Indent:         " ",
@@ -34,7 +34,7 @@ func DeepHashObject(hasher hash.Hash, objectToWrite interface{}) {
 //
 // Proudly modified and adopted from k8s.io/kubernetes/pkg/util/hash.DeepHashObject and
 // k8s.io/kubernetes/pkg/controller.ComputeHash.
-func ComputeTemplateHash(template interface{}) string {
+func ComputeTemplateHash(template any) string {
 	hasher := fnv.New32a()
 
 	hasher.Reset()
```

**File**: `logging/logger.go` (modified, +2/-6)
```diff
@@ -4,6 +4,7 @@ import (
 	"errors"
 	"fmt"
 	"os"
+	"slices"
 	"strconv"
 	"time"
 
@@ -78,10 +79,5 @@ func NewLogger(logLevel string, logFormat string) (logr.Logger, error) {
 
 func validLogFormat(logFormat string) bool {
 	validFormat := []string{"text", "json"}
-	for _, v := range validFormat {
-		if v == logFormat {
-			return true
-		}
-	}
-	return false
+	return slices.Contains(validFormat, logFormat)
 }
```

---

### Incident Patch 2: `6a04f3c6` (2026-09-29)
**Commit Message**: Fix empty collection drift across scale-set resources (#4695)

**File**: `controllers/actions.github.com/autoscalinglistener_controller.go` (modified, +4/-3)
```diff
@@ -17,13 +17,14 @@ limitations under the License.
 package actionsgithubcom
 
 import (
+	"bytes"
 	"context"
 	"fmt"
 	"maps"
-	"reflect"
 	"time"
 
 	"github.com/go-logr/logr"
+	apiequality "k8s.io/apimachinery/pkg/api/equality"
 	kerrors "k8s.io/apimachinery/pkg/api/errors"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/types"
@@ -242,7 +243,7 @@ func (r *AutoscalingListenerReconciler) Reconcile(ctx context.Context, req ctrl.
 		labelsModified := !maps.Equal(listenerRole.Labels, desiredLabels)
 		desiredAnnotations := r.mergeAnnotations(listenerRole.Annotations, desiredRole.Annotations)
 		annotationsModified := !maps.Equal(listenerRole.Annotations, desiredAnnotations)
-		rulesModified := !reflect.DeepEqual(listenerRole.Rules, desiredRole.Rules)
+		rulesModified := !apiequality.Semantic.DeepEqual(listenerRole.Rules, desiredRole.Rules)
 		if labelsModified || annotationsModified || rulesModified {
 			updatedRole := listenerRole.DeepCopy()
 			if labelsModified {
@@ -433,7 +434,7 @@ func (r *AutoscalingListenerReconciler) Reconcile(ctx context.Context, req ctrl.
 		labelsModified := !maps.Equal(listenerConfigSecret.Labels, desiredLabels)
 		desiredAnnotations := r.mergeAnnotations(listenerConfigSecret.Annotations, desiredSecret.Annotations)
 		annotationsModified := !maps.Equal(listenerConfigSecret.Annotations, desiredAnnotations)
-		dataModified := !reflect.DeepEqual(listenerConfigSecret.Data, desiredSecret.Data)
+		dataModified := !maps.EqualFunc(listenerConfigSecret.Data, desiredSecret.Data, bytes.Equal)
 
 		if labelsModified || annotationsModified || dataModified {
 			updatedSecret := listenerConfigSecret.DeepCopy()
```

**File**: `controllers/actions.github.com/autoscalingrunnerset_controller.go` (modified, +3/-4)
```diff
@@ -29,7 +29,6 @@ import (
 	"github.com/actions/actions-runner-controller/build"
 	"github.com/actions/scaleset"
 	"github.com/go-logr/logr"
-	"github.com/google/go-cmp/cmp"
 	corev1 "k8s.io/api/core/v1"
 	rbacv1 "k8s.io/api/rbac/v1"
 	apiequality "k8s.io/apimachinery/pkg/api/equality"
@@ -300,7 +299,7 @@ func (r *AutoscalingRunnerSetReconciler) Reconcile(ctx context.Context, req ctrl
 		desiredLabels := r.filterAndMergeLabels(ephemeralRunnerSet.Labels, desired.Labels)
 		desiredAnnotations := r.mergeAnnotations(ephemeralRunnerSet.Annotations, desired.Annotations)
 
-		ephemeralRunnerMetadataModified := !cmp.Equal(ephemeralRunnerSet.Spec.EphemeralRunnerMetadata, desired.Spec.EphemeralRunnerMetadata)
+		ephemeralRunnerMetadataModified := !apiequality.Semantic.DeepEqual(ephemeralRunnerSet.Spec.EphemeralRunnerMetadata, desired.Spec.EphemeralRunnerMetadata)
 		ephemeralRunnerLabelsModified := !maps.Equal(ephemeralRunnerSet.Labels, desiredLabels)
 		ephemeralRunnerAnnotationsModified := !maps.Equal(ephemeralRunnerSet.Annotations, desiredAnnotations)
 
@@ -380,8 +379,8 @@ func (r *AutoscalingRunnerSetReconciler) Reconcile(ctx context.Context, req ctrl
 		// instead re-creates the listener with the phase unset, which means
 		// running, so it comes back correct in one step.
 		if listenerSpecChanged(&listener, desired) ||
-			!cmp.Equal(listener.Labels, desired.Labels) ||
-			!cmp.Equal(listener.Annotations, desired.Annotations) {
+			!maps.Equal(listener.Labels, desired.Labels) ||
+			!maps.Equal(listener.Annotations, desired.Annotations) {
 			// The listener is about to be torn down and rebuilt, which is what
 			// the pending phase means. Report it here rather than relying on the
 			// generation check above: the desired listener is derived from the
```

**File**: `controllers/actions.github.com/autoscalingrunnerset_metadata_test.go` (added, +282/-0)
```diff
@@ -0,0 +1,282 @@
+package actionsgithubcom
+
+import (
+	"context"
+	"fmt"
+	"time"
+
+	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
+	"github.com/actions/actions-runner-controller/build"
+	scalefake "github.com/actions/actions-runner-controller/controllers/actions.github.com/multiclient/fake"
+	"github.com/actions/actions-runner-controller/controllers/actions.github.com/secretresolver"
+	"github.com/actions/scaleset"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	corev1 "k8s.io/api/core/v1"
+	rbacv1 "k8s.io/api/rbac/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	logf "sigs.k8s.io/controller-runtime/pkg/log"
+)
+
+type metadataPatchRecorder struct {
+	client.Client
+	patches []string
+}
+
+func (c *metadataPatchRecorder) Patch(ctx context.Context, obj client.Object, patch client.Patch, opts ...client.PatchOption) error {
+	c.patches = append(c.patches, fmt.Sprintf("%T/%s", obj, obj.GetName()))
+	return c.Client.Patch(ctx, obj, patch, opts...)
+}
+
+var _ = Describe("Resource metadata empty collection convergence", func() {
+	fields := []string{
+		"autoscalingListener",
+		"listenerServiceAccountMetadata",
+		"listenerRoleMetadata",
+		"listenerRoleBindingMetadata",
+		"listenerConfigSecretMetadata",
+		"ephemeralRunnerSetMetadata",
+		"ephemeralRunnerMetadata",
+		"ephemeralRunnerConfigSecretMetadata",
+	}
+	for _, field := range append(fields, "all") {
+		for _, keys := range [][]string{{"labels"}, {"annotations"}, {"labels", "annotations"}} {
+			It(fmt.Sprintf("%s with empty %v", field, keys), func() {
+				ctx, cancel := context.WithTimeout(context.Background(), autoscalingRunnerSetTestTimeout)
+				defer cancel()
+				ns, mgr := createNamespace(GinkgoT(), k8sClient)
+				secret := createDefaultSecret(GinkgoT(), k8sClient, ns.Name)
+				const name = "empty-metadata"
+				scaleSet := &scaleset.RunnerScaleSet{ID: 1, Name: name, RunnerGroupID: 1, RunnerGroupName: "Default"}
+				cache := newTestResourceCache()
+				builder := ResourceBuilder{
+					Scheme: mgr.GetScheme(), ResourceCache: cache,
+					SecretResolver: secretresolver.New(k8sClient, scalefake.NewMultiClient(scalefake.WithClient(
+						scalefake.NewClient(
+							scalefake.WithCreateRunnerScaleSet(scaleSet, nil),
+							scalefake.WithGetRunnerScaleSetByID(scaleSet, nil),
+							scalefake.WithGenerateJitRunnerConfig(&scaleset.RunnerScaleSetJitRunnerConfig{
+								Runner:           &scaleset.RunnerReference{ID: 1, Name: "test-runner", RunnerScaleSetID: 1},
+								EncodedJITConfig: "fake-jit-config",
+							}, nil),
+						),
+					))),
+				}
+				cachedClient := &metadataPatchRecorder{Client: mgr.GetClient()}
+				directClient := &metadataPatchRecorder{Client: k8sClient}
+				arsController := &AutoscalingRunnerSetReconciler{
+					Client: cachedClient, Scheme: mgr.GetScheme(), Log: logf.Log,
+					ControllerNamespace: ns.Name, DefaultRunnerScaleSetListenerImage: "listener:latest",
+					ResourceBuilder: builder,
+				}
+				listenerController := &AutoscalingListenerReconciler{
+					Client: directClient, Scheme: mgr.GetScheme(), Log: logf.Log,
+					ListenerMetricsAddr: "0", ResourceBuilder: builder,
+				}
+				ersController := &EphemeralRunnerSetReconciler{
+					Client: cachedClient, APIReader: k8sClient, Scheme: mgr.GetScheme(), Log: logf.Log,
+					ResourceBuilder: builder,
+				}
+				runnerController := &EphemeralRunnerReconciler{
+					Client: directClient, APIReader: k8sClient, Scheme: mgr.GetScheme(), Log: logf.Log,
+					ResourceBuilder: builder,
+				}
+				startManagers(GinkgoT(), mgr)
+
+				spec := map[string]any{
+					"githubConfigUrl": "https://github.com/owner/repo", "githubConfigSecret": secret.Name,
+					"template": map[string]any{"spec": map[string]any{
+						"containers": []any{map[string]any{"name": "runner", "image": "runner:latest"}},
+					}},
+				}
+				selected := []string{field}
+				if field == "all" {
+					selected = fields
+				}
+				for _, resource := range selected {
+					metadata := map[string]any{}
+					for _, key := range keys {
+						metadata[key] = map[string]any{}
+					}
+					spec[resource] = metadata
+				}
+				if field == "all" {
+					Expect(unstructured.SetNestedMap(spec, spec["autoscalingListener"].(map[string]any), "template", "metadata")).To(Succeed())
+					Expect(unstructured.SetNestedMap(spec, spec["autoscalingListener"].(map[string]any), "listenerTemplate", "metadata")).To(Succeed())
+					Expect(unstructured.SetNestedSlice(spec, []any{map[string]any{"name": "listener"}}, "listenerTemplate", "spec", "containers")).To(Succeed())
+					spec["proxy"] = map[string]any{
+						"http": map[string]any{"url": "http://proxy.example.com:8080", "credentialSecretRef": "proxy-auth"},
+					}
+					Expect(k8sClie
```

**File**: `controllers/actions.github.com/helpers_drift_test.go` (modified, +54/-0)
```diff
@@ -147,6 +147,60 @@ func TestEphemeralRunnerSetActionableSpecChanged_RealChangeStillDetected(t *test
 	})
 }
 
+func TestEphemeralRunnerSetDesiredSpecChanged_Metadata(t *testing.T) {
+	for _, tc := range []struct {
+		name    string
+		current *v1alpha1.ResourceMeta
+		desired *v1alpha1.ResourceMeta
+		changed bool
+	}{
+		{name: "both omitted"},
+		{
+			name: "empty labels", current: &v1alpha1.ResourceMeta{},
+			desired: &v1alpha1.ResourceMeta{Labels: map[string]string{}},
+		},
+		{
+			name: "empty annotations", current: &v1alpha1.ResourceMeta{},
+			desired: &v1alpha1.ResourceMeta{Annotations: map[string]string{}},
+		},
+		{
+			name: "empty maps", current: &v1alpha1.ResourceMeta{},
+			desired: &v1alpha1.ResourceMeta{Labels: map[string]string{}, Annotations: map[string]string{}},
+		},
+		{
+			name: "metadata object added", desired: &v1alpha1.ResourceMeta{}, changed: true,
+		},
+		{
+			name: "label added", current: &v1alpha1.ResourceMeta{},
+			desired: &v1alpha1.ResourceMeta{Labels: map[string]string{"team": "arc"}}, changed: true,
+		},
+		{
+			name:    "label changed",
+			current: &v1alpha1.ResourceMeta{Labels: map[string]string{"team": "old"}},
+			desired: &v1alpha1.ResourceMeta{Labels: map[string]string{"team": "arc"}}, changed: true,
+		},
+		{
+			name: "annotation added", current: &v1alpha1.ResourceMeta{},
+			desired: &v1alpha1.ResourceMeta{Annotations: map[string]string{"team": "arc"}}, changed: true,
+		},
+		{
+			name:    "annotation changed",
+			current: &v1alpha1.ResourceMeta{Annotations: map[string]string{"team": "old"}},
+			desired: &v1alpha1.ResourceMeta{Annotations: map[string]string{"team": "arc"}}, changed: true,
+		},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			current := &v1alpha1.EphemeralRunnerSet{Spec: v1alpha1.EphemeralRunnerSetSpec{EphemeralRunnerMetadata: tc.current}}
+			desired := &v1alpha1.EphemeralRunnerSet{Spec: v1alpha1.EphemeralRunnerSetSpec{EphemeralRunnerMetadata: tc.desired}}
+			currentBefore, desiredBefore := current.DeepCopy(), desired.DeepCopy()
+			assert.Equal(t, tc.changed, ephemeralRunnerSetDesiredSpecChanged(current, desired))
+			assert.Equal(t, tc.changed, ephemeralRunnerSetDesiredSpecChanged(desired, current), "removals must also be detected")
+			assert.Equal(t, currentBefore, current)
+			assert.Equal(t, desiredBefore, desired)
+		})
+	}
+}
+
 type listenerEmptyCollectionTestCase struct {
 	name          string
 	runnerSetSpec string
```

**File**: `controllers/actions.github.com/helpers_listener_test.go` (modified, +1/-1)
```diff
@@ -309,7 +309,7 @@ func TestListenerPodSpecRequiresRecreation_Containers(t *testing.T) {
 // rather than asserts away, the removals DeepDerivative cannot see. These are
 // all sourced from the user-facing listener template, so they are handled
 // upstream: the AutoscalingRunnerSet controller compares the whole
-// AutoscalingListener spec with cmp.Equal and deletes the listener, which
+// AutoscalingListener spec with Semantic.DeepEqual and deletes the listener, which
 // deletes the pod. If that upstream behaviour ever changes to a derivative
 // comparison, these become real bugs.
 func TestListenerPodSpecRequiresRecreation_KnownDeepDerivativeLimits(t *testing.T) {
```

**File**: `controllers/actions.github.com/resourcebuilder_legacy_annotation_test.go` (modified, +4/-4)
```diff
@@ -1,10 +1,10 @@
 package actionsgithubcom
 
 import (
+	"maps"
 	"testing"
 
 	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
-	"github.com/google/go-cmp/cmp"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	corev1 "k8s.io/api/core/v1"
@@ -43,7 +43,7 @@ func newLegacyAnnotationTestAutoscalingRunnerSet() *v1alpha1.AutoscalingRunnerSe
 // upgrade consequence of no longer stamping the integrity hash.
 //
 // AutoscalingRunnerSetReconciler compares the live listener's annotations
-// against the desired ones with cmp.Equal and deletes the listener when they
+// against the desired ones with maps.Equal and deletes the listener when they
 // differ. A listener created by an older controller carries the legacy
 // annotation, the desired listener no longer does, so the first reconcile after
 // an upgrade recreates it.
@@ -72,7 +72,7 @@ func TestLegacyIntegrityHashAnnotationCausesOneTimeListenerRecreation(t *testing
 
 	assert.False(
 		t,
-		cmp.Equal(live.Annotations, desired.Annotations),
+		maps.Equal(live.Annotations, desired.Annotations),
 		"a listener carrying the legacy annotation must not compare equal to the desired listener, otherwise it would never be replaced",
 	)
 
@@ -83,7 +83,7 @@ func TestLegacyIntegrityHashAnnotationCausesOneTimeListenerRecreation(t *testing
 	assert.NotContains(t, replacement.Annotations, legacyIntegrityHashAnnotation)
 	assert.True(
 		t,
-		cmp.Equal(replacement.Annotations, desired.Annotations),
+		maps.Equal(replacement.Annotations, desired.Annotations),
 		"the recreated listener must match the desired one, otherwise the controller would rebuild it forever",
 	)
 }
```

---

### Incident Patch 3: `ce0c6b74` (2026-09-29)
**Commit Message**: Fix custom runner mode volume injection (#4693)

**File**: `charts/gha-runner-scale-set-experimental/templates/autoscalingrunnserset.yaml` (modified, +3/-1)
```diff
@@ -341,8 +341,10 @@ spec:
       volumes:
         {{- if eq $runnerMode "kubernetes" }}
         {{- include "runner-mode-kubernetes.pod-volumes" . | nindent 8 }}
-        {{- else }}
+        {{- else if eq $runnerMode "dind" }}
         {{- include "runner-mode-dind.pod-volumes" . | nindent 8 }}
+        {{- else }}
+        {{- include "githubServerTLS.podVolumeItem" . | nindent 8 }}
         {{- end }}
         {{- if $extraVolumes }}
           {{- range $extraVolumes }}
```

**File**: `charts/gha-runner-scale-set-experimental/tests/autoscaling_runner_set_github_server_tls_runner_injection_test.yaml` (modified, +59/-6)
```diff
@@ -41,15 +41,68 @@ tests:
             name: github-server-tls-cert
             mountPath: "/usr/local/share/ca-certificates/"
             readOnly: true
-      - contains:
+      - equal:
           path: spec.template.spec.volumes
+          value:
+            - name: github-server-tls-cert
+              configMap:
+                name: "my-ca-config"
+                items:
+                  - key: "ca.crt"
+                    path: "ca.crt"
+
+  - it: should preserve custom volumes alongside the TLS volume in mode-empty
+    set:
+      scaleset.name: "test"
+      auth.url: "https://github.com/org"
+      auth.githubToken: "gh_token12345"
+      controllerServiceAccount.name: "arc"
+      controllerServiceAccount.namespace: "arc-system"
+      githubServerTLS:
+        runnerMountPath: "/usr/local/share/ca-certificates/"
+        certificateFrom:
+          configMapKeyRef:
+            name: "my-ca-config"
+            key: "ca.crt"
+      runner:
+        mode: ""
+        container:
+          volumeMounts:
+            - name: work
+              mountPath: /home/runner/_work
+        pod:
+          spec:
+            volumes:
+              - name: work
+                persistentVolumeClaim:
+                  claimName: runner-work
+    release:
+      name: "test-name"
+      namespace: "test-namespace"
+    asserts:
+      - equal:
+          path: spec.template.spec.volumes
+          value:
+            - name: github-server-tls-cert
+              configMap:
+                name: "my-ca-config"
+                items:
+                  - key: "ca.crt"
+                    path: "ca.crt"
+            - name: work
+              persistentVolumeClaim:
+                claimName: runner-work
+      - contains:
+          path: spec.template.spec.containers[0].volumeMounts
+          content:
+            name: work
+            mountPath: /home/runner/_work
+      - contains:
+          path: spec.template.spec.containers[0].volumeMounts
           content:
             name: github-server-tls-cert
-            configMap:
-              name: "my-ca-config"
-              items:
-                - key: "ca.crt"
-                  path: "ca.crt"
+            mountPath: "/usr/local/share/ca-certificates/"
+            readOnly: true
 
   - it: should not override user-provided CA env + volumeMount in mode-empty
     set:
```

**File**: `charts/gha-runner-scale-set-experimental/tests/autoscaling_runner_set_mode_empty_runner_container_test.yaml` (modified, +41/-0)
```diff
@@ -74,6 +74,47 @@ tests:
       - notExists:
           path: spec.template.spec.volumes
 
+  - it: should preserve custom work volumes without adding dind volumes in mode-empty
+    set:
+      scaleset.name: "test"
+      auth.url: "https://github.com/org"
+      auth.githubToken: "gh_token12345"
+      controllerServiceAccount.name: "arc"
+      controllerServiceAccount.namespace: "arc-system"
+      runner:
+        mode: ""
+        container:
+          volumeMounts:
+            - name: work
+              mountPath: /home/runner/_work
+        pod:
+          spec:
+            volumes:
+              - name: work
+                persistentVolumeClaim:
+                  claimName: runner-work
+              - name: cache
+                emptyDir: {}
+    release:
+      name: "test-name"
+      namespace: "test-namespace"
+    asserts:
+      - equal:
+          path: spec.template.spec.volumes
+          value:
+            - name: work
+              persistentVolumeClaim:
+                claimName: runner-work
+            - name: cache
+              emptyDir: {}
+      - equal:
+          path: spec.template.spec.containers[0].volumeMounts
+          value:
+            - name: work
+              mountPath: /home/runner/_work
+      - notExists:
+          path: spec.template.spec.initContainers
+
   - it: should not allow overriding runner container name
     set:
       scaleset.name: "test"
```

**File**: `charts/gha-runner-scale-set-experimental/values.yaml` (modified, +2/-0)
```diff
@@ -230,6 +230,8 @@ runner:
     # - spec.containers: appended after the generated "runner" container (name "runner" is reserved)
     # - spec.initContainers: appended after any generated initContainers (e.g. dind mode)
     # - spec.volumes: appended after generated volumes
+    #   In empty mode, only user-supplied volumes and the optional GitHub server TLS
+    #   volume are included.
     # - spec.restartPolicy: defaults to Never; an explicit Kubernetes restart policy is preserved
     #
     # Note: serviceAccountName is managed by the chart and cannot be overridden via runner.pod.spec.
```

---

### Incident Patch 4: `1a200e42` (2026-09-29)
**Commit Message**: Fix annotation merging for labels-only resource metadata (#4689)

**File**: `charts/gha-runner-scale-set-experimental/values.yaml` (modified, +1/-0)
```diff
@@ -100,6 +100,7 @@ secretResolution:
 #   runnerMountPath: /usr/local/share/ca-certificates/
 
 ## Resource object allows modifying resources created by the chart itself
+## Labels and annotations are independently optional for each resource.
 resource:
   # Specifies metadata that will be applied to all resources managed by ARC
   all:
```

**File**: `charts/gha-runner-scale-set/values.yaml` (modified, +1/-0)
```diff
@@ -481,6 +481,7 @@ namespaceOverride: ""
 
 ## If you want more fine-grained control over annotations applied to particular resource created by this chart,
 ## you can use `resourceMeta`.
+## Labels and annotations are independently optional for each resource.
 ## Order of applying labels and annotations is:
 ## 1. Apply labels/annotations globally, using `annotations` and `labels` field
 ## 2. Apply `resourceMeta` labels/annotations
```

**File**: `controllers/actions.github.com/autoscalinglistener_metadata_test.go` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+package actionsgithubcom
+
+import (
+	"testing"
+
+	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
+	scalefake "github.com/actions/actions-runner-controller/controllers/actions.github.com/multiclient/fake"
+	"github.com/actions/actions-runner-controller/controllers/actions.github.com/secretresolver"
+	"github.com/go-logr/logr"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	corev1 "k8s.io/api/core/v1"
+	rbacv1 "k8s.io/api/rbac/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+)
+
+func TestListenerRestoresMissingAnnotations(t *testing.T) {
+	for _, tt := range []struct {
+		name   string
+		object client.Object
+	}{
+		{name: "service account", object: &corev1.ServiceAccount{}},
+		{name: "role", object: &rbacv1.Role{}},
+		{name: "role binding", object: &rbacv1.RoleBinding{}},
+		{name: "config secret", object: &corev1.Secret{}},
+		{name: "pod", object: &corev1.Pod{}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			scheme := runtime.NewScheme()
+			require.NoError(t, corev1.AddToScheme(scheme))
+			require.NoError(t, rbacv1.AddToScheme(scheme))
+			require.NoError(t, v1alpha1.AddToScheme(scheme))
+			metadata := &v1alpha1.ResourceMeta{Annotations: map[string]string{"example.com/required": "value"}}
+			listener := &v1alpha1.AutoscalingListener{
+				ObjectMeta: metav1.ObjectMeta{Name: "test-listener", Namespace: "test-ns"},
+				Spec: v1alpha1.AutoscalingListenerSpec{
+					GitHubConfigURL:               "https://github.com/org/repo",
+					GitHubConfigSecret:            "auth",
+					RunnerScaleSetID:              1,
+					AutoscalingRunnerSetName:      "test-set",
+					AutoscalingRunnerSetNamespace: "test-ns",
+					EphemeralRunnerSetName:        "test-set",
+					Image:                         "listener:latest",
+					ServiceAccountMetadata:        metadata.DeepCopy(),
+					RoleMetadata:                  metadata.DeepCopy(),
+					RoleBindingMetadata:           metadata.DeepCopy(),
+					ConfigSecretMetadata:          metadata.DeepCopy(),
+					Template: &corev1.PodTemplateSpec{
+						ObjectMeta: metav1.ObjectMeta{Annotations: metadata.DeepCopy().Annotations},
+					},
+				},
+			}
+			c := fake.NewClientBuilder().WithScheme(scheme).WithObjects(
+				listener,
+				&v1alpha1.AutoscalingRunnerSet{
+					ObjectMeta: metav1.ObjectMeta{Name: "test-set", Namespace: listener.Namespace},
+					Spec: v1alpha1.AutoscalingRunnerSetSpec{
+						GitHubConfigUrl: listener.Spec.GitHubConfigURL, GitHubConfigSecret: "auth",
+					},
+				},
+				&corev1.Secret{
+					ObjectMeta: metav1.ObjectMeta{Name: "auth", Namespace: listener.Namespace},
+					Data:       map[string][]byte{"github_token": []byte("test-token")},
+				},
+			).Build()
+			r := &AutoscalingListenerReconciler{
+				Client: c, Scheme: scheme, Log: logr.Discard(), ListenerMetricsAddr: "0",
+				ResourceBuilder: ResourceBuilder{
+					Scheme: scheme, ResourceCache: newTestResourceCache(),
+					SecretResolver: secretresolver.New(c, scalefake.NewMultiClient()),
+				},
+			}
+			req := ctrl.Request{NamespacedName: client.ObjectKeyFromObject(listener)}
+			for range 6 {
+				_, err := r.Reconcile(t.Context(), req)
+				require.NoError(t, err)
+			}
+			key := req.NamespacedName
+			if _, ok := tt.object.(*corev1.Secret); ok {
+				key.Name = scaleSetListenerConfigName(listener)
+			}
+			require.NoError(t, c.Get(t.Context(), key, tt.object))
+			require.Equal(t, "value", tt.object.GetAnnotations()["example.com/required"])
+			tt.object.SetAnnotations(nil)
+			require.NoError(t, c.Update(t.Context(), tt.object))
+
+			// Removing the pod's config-version annotation requires replacement;
+			// the other resources restore their annotations with a patch.
+			for range 6 {
+				require.NotPanics(t, func() {
+					_, err := r.Reconcile(t.Context(), req)
+					require.NoError(t, err)
+				})
+			}
+			require.NoError(t, c.Get(t.Context(), key, tt.object))
+			assert.Equal(t, "value", tt.object.GetAnnotations()["example.com/required"])
+		})
+	}
+}
```

**File**: `controllers/actions.github.com/ephemeralrunnerset_metadata_test.go` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+package actionsgithubcom
+
+import (
+	"testing"
+
+	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
+	"github.com/go-logr/logr"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+)
+
+func TestScaleUpWithOptionalRunnerMetadata(t *testing.T) {
+	for _, tt := range []struct {
+		name     string
+		metadata *v1alpha1.ResourceMeta
+	}{
+		{name: "omitted"},
+		{name: "empty", metadata: &v1alpha1.ResourceMeta{}},
+		{name: "labels only", metadata: &v1alpha1.ResourceMeta{Labels: map[string]string{"example.com/custom": "label"}}},
+		{name: "annotations only", metadata: &v1alpha1.ResourceMeta{Annotations: map[string]string{"example.com/custom": "annotation"}}},
+		{name: "both", metadata: &v1alpha1.ResourceMeta{
+			Labels:      map[string]string{"example.com/custom": "label"},
+			Annotations: map[string]string{"example.com/custom": "annotation", AnnotationKeyPatchID: "999"},
+		}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			scheme := runtime.NewScheme()
+			require.NoError(t, corev1.AddToScheme(scheme))
+			require.NoError(t, v1alpha1.AddToScheme(scheme))
+			set := &v1alpha1.EphemeralRunnerSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: "test-set", Namespace: "test-ns", UID: "test-set",
+					Finalizers: []string{EphemeralRunnerSetFinalizerName},
+				},
+				Spec: v1alpha1.EphemeralRunnerSetSpec{
+					Replicas: 3, PatchID: 1,
+					EphemeralRunnerMetadata: tt.metadata,
+					EphemeralRunnerSpec: v1alpha1.EphemeralRunnerSpec{
+						GitHubConfigURL: "https://github.com/org/repo",
+						PodTemplateSpec: corev1.PodTemplateSpec{Spec: corev1.PodSpec{
+							Containers: []corev1.Container{{Name: "runner", Image: "runner:latest"}},
+						}},
+					},
+				},
+			}
+			original := set.DeepCopy()
+			c := fake.NewClientBuilder().WithScheme(scheme).WithObjects(set).
+				WithStatusSubresource(&v1alpha1.EphemeralRunnerSet{}).
+				WithIndex(&v1alpha1.EphemeralRunner{}, resourceOwnerKey, newGroupVersionOwnerKindIndexer("EphemeralRunnerSet")).
+				Build()
+			r := &EphemeralRunnerSetReconciler{
+				Client: c, APIReader: c, Log: logr.Discard(), Scheme: scheme,
+				ResourceBuilder: ResourceBuilder{Scheme: scheme, ResourceCache: newTestResourceCache()},
+			}
+
+			// Reconcile exercises the errgroup workers, whose panics cannot be
+			// caught by controller-runtime's recovery around Reconcile itself.
+			_, err := r.Reconcile(t.Context(), ctrl.Request{NamespacedName: client.ObjectKeyFromObject(set)})
+			require.NoError(t, err)
+			var runners v1alpha1.EphemeralRunnerList
+			require.NoError(t, c.List(t.Context(), &runners))
+			require.Len(t, runners.Items, set.Spec.Replicas)
+			for _, runner := range runners.Items {
+				assert.Equal(t, "1", runner.Annotations[AnnotationKeyPatchID])
+				assert.Equal(t, "0", runner.Annotations[AnnotationKeyActionableRevision])
+				require.NotNil(t, metav1.GetControllerOf(&runner))
+				assert.Equal(t, set.UID, metav1.GetControllerOf(&runner).UID)
+				if tt.metadata != nil {
+					for key, value := range tt.metadata.Labels {
+						assert.Equal(t, value, runner.Labels[key])
+					}
+					assert.Equal(t, tt.metadata.Annotations["example.com/custom"], runner.Annotations["example.com/custom"])
+				}
+			}
+			assert.Equal(t, original.Spec, set.Spec)
+			assert.Equal(t, original.Labels, set.Labels)
+			assert.Equal(t, original.Annotations, set.Annotations)
+		})
+	}
+}
```

**File**: `controllers/actions.github.com/resourcebuilder.go` (modified, +4/-3)
```diff
@@ -1110,7 +1110,8 @@ func (b *ResourceBuilder) mergeAnnotations(base, overwrite map[string]string) ma
 	if base == nil && overwrite == nil {
 		return nil
 	}
-	base = maps.Clone(base)
-	maps.Copy(base, overwrite)
-	return base
+	mergedAnnotations := make(map[string]string, len(base)+len(overwrite))
+	maps.Copy(mergedAnnotations, base)
+	maps.Copy(mergedAnnotations, overwrite)
+	return mergedAnnotations
 }
```

**File**: `controllers/actions.github.com/resourcebuilder_metadata_test.go` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+package actionsgithubcom
+
+import (
+	"maps"
+	"testing"
+
+	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
+	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1/appconfig"
+	"github.com/actions/scaleset"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+func TestMergeAnnotations(t *testing.T) {
+	tests := []struct {
+		name      string
+		base      map[string]string
+		overwrite map[string]string
+		want      map[string]string
+	}{
+		{name: "both nil"},
+		{name: "nil base and empty overwrite", overwrite: map[string]string{}, want: map[string]string{}},
+		{name: "empty base and nil overwrite", base: map[string]string{}, want: map[string]string{}},
+		{name: "both empty", base: map[string]string{}, overwrite: map[string]string{}, want: map[string]string{}},
+		{
+			name: "nil base", overwrite: map[string]string{"generated": "value"},
+			want: map[string]string{"generated": "value"},
+		},
+		{
+			name: "empty base", base: map[string]string{}, overwrite: map[string]string{"generated": "value"},
+			want: map[string]string{"generated": "value"},
+		},
+		{
+			name: "nil overwrite", base: map[string]string{"custom": "value"},
+			want: map[string]string{"custom": "value"},
+		},
+		{
+			name: "empty overwrite", base: map[string]string{"custom": "value"}, overwrite: map[string]string{},
+			want: map[string]string{"custom": "value"},
+		},
+		{
+			name:      "overwrite takes precedence",
+			base:      map[string]string{"custom": "value", "reserved": "user"},
+			overwrite: map[string]string{"generated": "value", "reserved": "controller"},
+			want:      map[string]string{"custom": "value", "generated": "value", "reserved": "controller"},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			base, overwrite := maps.Clone(tt.base), maps.Clone(tt.overwrite)
+			var b ResourceBuilder
+			var merged map[string]string
+			require.NotPanics(t, func() { merged = b.mergeAnnotations(tt.base, tt.overwrite) })
+			require.Equal(t, tt.want, merged)
+			assert.Equal(t, base, tt.base)
+			assert.Equal(t, overwrite, tt.overwrite)
+
+			for key := range merged {
+				merged[key] = "changed"
+			}
+			if merged != nil {
+				merged["new"] = "value"
+			}
+			assert.Equal(t, base, tt.base, "the result must not alias the base")
+			assert.Equal(t, overwrite, tt.overwrite, "the result must not alias the overwrite")
+		})
+	}
+}
+
+func TestMetadataPropagationWithoutAnnotations(t *testing.T) {
+	for _, tt := range []struct {
+		name        string
+		annotations map[string]string
+	}{
+		{name: "omitted annotations"},
+		{name: "empty annotations", annotations: map[string]string{}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			metadata := &v1alpha1.ResourceMeta{
+				Labels:      map[string]string{"example.com/custom": "value"},
+				Annotations: tt.annotations,
+			}
+			ars := &v1alpha1.AutoscalingRunnerSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: "test-set", Namespace: "test-ns", Generation: 7,
+					Annotations: map[string]string{
+						runnerScaleSetIDAnnotationKey:         "1",
+						AnnotationKeyGitHubRunnerGroupName:    "test-group",
+						AnnotationKeyGitHubRunnerScaleSetName: "test-set",
+					},
+				},
+				Spec: v1alpha1.AutoscalingRunnerSetSpec{
+					GitHubConfigUrl:                     "https://github.com/org/repo",
+					AutoscalingListenerMetadata:         metadata.DeepCopy(),
+					ListenerServiceAccountMetadata:      metadata.DeepCopy(),
+					ListenerRoleMetadata:                metadata.DeepCopy(),
+					ListenerRoleBindingMetadata:         metadata.DeepCopy(),
+					ListenerConfigSecretMetadata:        metadata.DeepCopy(),
+					EphemeralRunnerSetMetadata:          metadata.DeepCopy(),
+					EphemeralRunnerMetadata:             metadata.DeepCopy(),
+					EphemeralRunnerConfigSecretMetadata: metadata.DeepCopy(),
+					Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{
+						Containers: []corev1.Container{{Name: "runner", Image: "runner:latest"}},
+					}},
+				},
+			}
+			original := ars.DeepCopy()
+			b := ResourceBuilder{ResourceCache: newTestResourceCache()}
+			var ers *v1alpha1.EphemeralRunnerSet
+			require.NotPanics(t, func() {
+				var err error
+				ers, err = b.newEphemeralRunnerSet(ars)
+				require.NoError(t, err)
+			})
+			listener, err := b.newAutoscalingListener(ars, ers, ars.Namespace, "listener:latest", nil)
+			require.NoError(t, err)
+			sa, err := b.newScaleSetListenerServiceAccount(listener)
+			require.NoError(t, err)
+			role := b.newScaleSetListenerRole(listener)
+			binding := b.newScaleSetListenerRoleBinding(listener, role, sa)
+			config, err := b.newScaleSetListenerConfig(listener, &appconfig.AppConfig{Token: "test-token"}, nil, "")
+			require.NoError(t, err)
+			listenerPod, err := b.newSc
```

---

### Incident Patch 5: `230e163c` (2026-09-28)
**Commit Message**: Fix experimental charts and upgrade Helm tooling (#4687)

**File**: `.github/workflows/gha-publish-chart.yaml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ on:
         default: false
 
 env:
-  HELM_VERSION: v3.8.0
+  HELM_VERSION: v4.2.2
 
 permissions:
   packages: write
```

**File**: `.github/workflows/gha-validate-chart.yaml` (modified, +16/-2)
```diff
@@ -18,7 +18,8 @@ on:
   workflow_dispatch:
 env:
   KUBE_SCORE_VERSION: 1.16.1
-  HELM_VERSION: v3.19.4
+  HELM_VERSION: v4.2.2
+  HELM_UNITTEST_VERSION: 1.1.2
 
 permissions:
   contents: read
@@ -105,7 +106,17 @@ jobs:
 
       - name: Install helm-unittest
         run: |
-          helm plugin install https://github.com/helm-unittest/helm-unittest.git
+          # Pin the upstream signing key independently of the release download.
+          curl --fail --silent --show-error --location \
+            https://raw.githubusercontent.com/helm-unittest/helm-unittest/33c48cac798e465deda9a66c8e6c07c0973cf53d/public-key.asc \
+            --output "${RUNNER_TEMP}/helm-unittest-key.asc"
+          gpg --batch --yes --dearmor \
+            --output "${RUNNER_TEMP}/helm-unittest-keyring.gpg" \
+            "${RUNNER_TEMP}/helm-unittest-key.asc"
+          helm plugin install \
+            "https://github.com/helm-unittest/helm-unittest/releases/download/v${HELM_UNITTEST_VERSION}/unittest-${HELM_UNITTEST_VERSION}.tgz" \
+            --verify \
+            --keyring "${RUNNER_TEMP}/helm-unittest-keyring.gpg"
 
       - name: Run helm-unittest (gha-runner-scale-set-controller-experimental)
         run: |
@@ -125,3 +136,6 @@ jobs:
 
       - name: Test gha-runner-scale-set-controller
         run: go test ./charts/gha-runner-scale-set-controller/...
+
+      - name: Test gha-runner-scale-set-experimental
+        run: go test ./charts/gha-runner-scale-set-experimental/...
```

**File**: `.github/workflows/go.yaml` (modified, +9/-0)
```diff
@@ -5,16 +5,21 @@ on:
       - master
     paths:
       - ".github/workflows/go.yaml"
+      - "charts/gha-runner-scale-set*/**"
       - "**.go"
       - "go.mod"
       - "go.sum"
   pull_request:
     paths:
       - ".github/workflows/go.yaml"
+      - "charts/gha-runner-scale-set*/**"
       - "**.go"
       - "go.mod"
       - "go.sum"
 
+env:
+  HELM_VERSION: v4.2.2
+
 permissions:
   contents: read
 
@@ -86,6 +91,10 @@ jobs:
       - uses: actions/setup-go@v7
         with:
           go-version-file: "go.mod"
+      - name: Set up Helm
+        uses: azure/setup-helm@9bc31f4ebc9c6b171d7bfbaa5d006ae7abdb4310
+        with:
+          version: ${{ env.HELM_VERSION }}
       - run: make manifests
       - name: Check diff
         run: git diff --exit-code
```

**File**: `CONTRIBUTING.md` (modified, +12/-0)
```diff
@@ -101,6 +101,11 @@ NAME=$DOCKER_USER/actions-runner make \
 A set of example pipelines (./acceptance/pipelines) are provided in this repository which you can use to validate your runners are working as expected.
 When raising a PR please run the relevant suites to prove your change hasn't broken anything.
 
+Go chart tests and controller chart-contract tests require the `helm` CLI on `PATH`.
+Install the version listed under [Helm Version Changes](#helm-version-changes)
+before running `go test ./...` or `make test`. The make targets provision envtest,
+not Helm; the helm-unittest plugin is not required for Go tests.
+
 #### Running Ginkgo Tests
 You can run the integration test suite that is written in Ginkgo with:
 
@@ -201,6 +206,13 @@ Send PR, add issue number to description
 In general we ask you not to bump the version in your PR.
 The maintainers will manage releases and publishing new charts.
 
+The Go test job and scale-set chart validation and publishing workflows use
+Helm CLI v4.2.2.
+Keep their `HELM_VERSION` pins aligned when updating the CLI. Validation uses
+helm-unittest v1.1.2 from its signed release archive; the workflow verifies it
+with the pinned upstream signing key. Legacy ARC workflows retain their separate
+Helm version. These CLI pins do not change chart versions or require Helm 4 for users.
+
 ## Testing Controller Built from a Pull Request
 
 We always appreciate your help in testing open pull requests by deploying custom builds of actions-runner-controller onto your own environment, so that we are extra sure we didn't break anything.
```

**File**: `charts/gha-runner-scale-set-controller-experimental/templates/_controller_template.tpl` (modified, +4/-1)
```diff
@@ -97,9 +97,12 @@ args:
 {{- end }}
 {{- $ports := list -}}
 {{- if .Values.controller.metrics }}
-{{- $metricsPort := dict "containerPort" ((regexReplaceAll ":([0-9]+)" .Values.controller.metrics.controllerManagerAddr "${1}") | int) "protocol" "TCP" "name" "metrics" -}}
+{{- $port := include "gha-controller.metrics-port" .Values.controller.metrics.controllerManagerAddr -}}
+{{- if $port }}
+{{- $metricsPort := dict "containerPort" (int $port) "protocol" "TCP" "name" "metrics" -}}
 {{- $ports = append $ports $metricsPort -}}
 {{- end }}
+{{- end }}
 {{- with .Values.controller.manager.container.extraPorts }}
 {{- if kindIs "slice" . }}
 {{- $ports = concat $ports . -}}
```

**File**: `charts/gha-runner-scale-set-controller-experimental/templates/_metrics.tpl` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+{{/*
+The bind address must retain its host in --metrics-addr, but containerPort only
+accepts a numeric port. "0" disables the server and must not create a port.
+*/}}
+{{- define "gha-controller.metrics-port" -}}
+{{- $address := . -}}
+{{- $error := "controller.metrics.controllerManagerAddr must be \"0\" or a host:port address with a numeric port between 1 and 65535 (IPv6 hosts must be bracketed)" -}}
+{{- if ne (toString $address) "0" -}}
+  {{- if not (kindIs "string" $address) -}}
+    {{- fail $error -}}
+  {{- end -}}
+  {{- if not (regexMatch `^(\[[^]]+\]|[^:]*):[0-9]+$` $address) -}}
+    {{- fail $error -}}
+  {{- end -}}
+  {{- $portString := regexFind "[0-9]+$" $address -}}
+  {{- $port := atoi $portString -}}
+  {{- if or (lt $port 1) (gt $port 65535) -}}
+    {{- fail $error -}}
+  {{- end -}}
+  {{- $host := trimSuffix (printf ":%s" $portString) $address -}}
+  {{- if hasPrefix "[" $host -}}
+    {{- $ip := trimSuffix "]" (trimPrefix "[" $host) -}}
+    {{- $zone := splitList "%" $ip -}}
+    {{- if gt (len $zone) 2 -}}
+      {{- fail $error -}}
+    {{- end -}}
+    {{- if eq (len $zone) 2 -}}
+      {{- if not (regexMatch "^[A-Za-z0-9_.-]+$" (index $zone 1)) -}}
+        {{- fail $error -}}
+      {{- end -}}
+    {{- end -}}
+    {{- $ip = index $zone 0 -}}
+    {{- if contains "." $ip -}}
+      {{- $ipv4 := last (splitList ":" $ip) -}}
+      {{- include "gha-controller.validate-ipv4" (dict "ip" $ipv4 "error" $error) -}}
+      {{- $ip = printf "%s0:0" (trimSuffix $ipv4 $ip) -}}
+    {{- end -}}
+    {{- if or (not (regexMatch "^[0-9A-Fa-f:]+$" $ip)) (contains ":::" $ip) (and (hasPrefix ":" $ip) (not (hasPrefix "::" $ip))) (and (hasSuffix ":" $ip) (not (hasSuffix "::" $ip))) -}}
+      {{- fail $error -}}
+    {{- end -}}
+    {{- $halves := splitList "::" $ip -}}
+    {{- $groups := splitList ":" $ip -}}
+    {{- $count := 0 -}}
+    {{- range $groups -}}
+      {{- if ne . "" -}}
+        {{- if not (regexMatch "^[0-9A-Fa-f]{1,4}$" .) -}}
+          {{- fail $error -}}
+        {{- end -}}
+        {{- $count = add1 $count -}}
+      {{- end -}}
+    {{- end -}}
+    {{- if eq (len $halves) 1 -}}
+      {{- if or (ne $count 8) (hasPrefix ":" $ip) (hasSuffix ":" $ip) -}}
+        {{- fail $error -}}
+      {{- end -}}
+    {{- else if or (ne (len $halves) 2) (ge $count 8) -}}
+      {{- fail $error -}}
+    {{- end -}}
+  {{- else if ne $host "" -}}
+    {{- if or (gt (len $host) 253) (not (regexMatch `^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*\.?$` $host)) -}}
+      {{- fail $error -}}
+    {{- end -}}
+    {{- range splitList "." $host -}}
+      {{- if gt (len .) 63 -}}
+        {{- fail $error -}}
+      {{- end -}}
+    {{- end -}}
+    {{- if regexMatch `^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$` $host -}}
+      {{- include "gha-controller.validate-ipv4" (dict "ip" $host "error" $error) -}}
+    {{- end -}}
+  {{- end -}}
+  {{- $port -}}
+{{- end -}}
+{{- end -}}
+
+{{- define "gha-controller.validate-ipv4" -}}
+{{- $error := .error -}}
+{{- $parts := splitList "." .ip -}}
+{{- if ne (len $parts) 4 -}}
+  {{- fail $error -}}
+{{- end -}}
+{{- range $parts -}}
+  {{- if or (not (regexMatch "^(0|[1-9][0-9]{0,2})$" .)) (gt (int .) 255) -}}
+    {{- fail $error -}}
+  {{- end -}}
+{{- end -}}
+{{- end -}}
```

**File**: `charts/gha-runner-scale-set-controller-experimental/tests/controller_metrics_address_test.yaml` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+suite: Controller metrics addresses
+templates:
+  - deployment.yaml
+set:
+  controller.metrics.listenerAddr: ":9090"
+  controller.metrics.listenerEndpoint: /metrics
+tests:
+  - it: extracts the IPv4 bind port without changing the address
+    set:
+      controller.metrics.controllerManagerAddr: "127.0.0.1:8080"
+    asserts:
+      - contains:
+          path: spec.template.spec.containers[0].args
+          content: "--metrics-addr=127.0.0.1:8080"
+      - equal:
+          path: spec.template.spec.containers[0].ports
+          value: [{name: metrics, containerPort: 8080, protocol: TCP}]
+  - it: extracts the bracketed IPv6 bind port
+    set:
+      controller.metrics.controllerManagerAddr: "[::]:8080"
+    asserts:
+      - contains:
+          path: spec.template.spec.containers[0].args
+          content: "--metrics-addr=[::]:8080"
+      - equal:
+          path: spec.template.spec.containers[0].ports
+          value: [{name: metrics, containerPort: 8080, protocol: TCP}]
+  - it: disables only controller metrics and retains extra ports
+    set:
+      controller.metrics.controllerManagerAddr: "0"
+      controller.manager.container.extraPorts:
+        - {name: custom, containerPort: 9000, protocol: TCP}
+    asserts:
+      - contains:
+          path: spec.template.spec.containers[0].args
+          content: "--metrics-addr=0"
+      - contains:
+          path: spec.template.spec.containers[0].args
+          content: "--listener-metrics-addr=:9090"
+      - equal:
+          path: spec.template.spec.containers[0].ports
+          value: [{name: custom, containerPort: 9000, protocol: TCP}]
+  - it: rejects a non-numeric port explicitly
+    set:
+      controller.metrics.controllerManagerAddr: "localhost:http"
+    asserts:
+      - failedTemplate:
+          errorMessage: 'controller.metrics.controllerManagerAddr must be "0" or a host:port address with a numeric port between 1 and 65535 (IPv6 hosts must be bracketed)'
```

**File**: `charts/gha-runner-scale-set-controller-experimental/values.yaml` (modified, +3/-1)
```diff
@@ -126,8 +126,10 @@ controller:
     volumeMounts: []
 
   # Metrics configuration. If omitted, metrics are disabled.
+  # controllerManagerAddr accepts host:port (e.g. ":8080", "127.0.0.1:8080",
+  # "[::]:8080", or "localhost:8080"), with a numeric port from 1 to 65535.
+  # Set it to "0" to disable controller metrics independently of listener metrics.
   # metrics:
   #   controllerManagerAddr: ":8080"
   #   listenerAddr: ":8080"
   #   listenerEndpoint: "/metrics"
-
```

---

### Incident Patch 6: `5256d95d` (2026-09-28)
**Commit Message**: Fix patch permissions in generated controller RBAC (#4686)

**File**: `config/rbac/role.yaml` (modified, +3/-12)
```diff
@@ -17,6 +17,8 @@ rules:
   - persistentvolumeclaims
   - pods
   - pods/finalizers
+  - secrets
+  - serviceaccounts
   verbs:
   - create
   - delete
@@ -42,18 +44,6 @@ rules:
   - pods/status
   verbs:
   - get
-- apiGroups:
-  - ""
-  resources:
-  - secrets
-  - serviceaccounts
-  verbs:
-  - create
-  - delete
-  - get
-  - list
-  - update
-  - watch
 - apiGroups:
   - actions.github.com
   resources:
@@ -167,5 +157,6 @@ rules:
   - delete
   - get
   - list
+  - patch
   - update
   - watch
```

**File**: `config/rbac/role_test.go` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+/*
+Copyright 2026 The actions-runner-controller authors.
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
+package rbac_test
+
+import (
+	"os"
+	"slices"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	rbacv1 "k8s.io/api/rbac/v1"
+	"sigs.k8s.io/yaml"
+)
+
+func TestManagerRolePermissions(t *testing.T) {
+	t.Parallel()
+
+	data, err := os.ReadFile("role.yaml")
+	require.NoError(t, err)
+
+	var role rbacv1.ClusterRole
+	require.NoError(t, yaml.UnmarshalStrict(data, &role))
+
+	for _, tc := range []struct {
+		apiGroup string
+		resource string
+	}{
+		{apiGroup: "", resource: "secrets"},
+		{apiGroup: "", resource: "serviceaccounts"},
+		{apiGroup: rbacv1.GroupName, resource: "roles"},
+		{apiGroup: rbacv1.GroupName, resource: "rolebindings"},
+	} {
+		t.Run(tc.resource, func(t *testing.T) {
+			t.Parallel()
+
+			var verbs []string
+			for _, rule := range role.Rules {
+				if slices.Contains(rule.APIGroups, tc.apiGroup) &&
+					slices.Contains(rule.Resources, tc.resource) &&
+					len(rule.ResourceNames) == 0 {
+					verbs = append(verbs, rule.Verbs...)
+				}
+			}
+
+			assert.Subset(t, verbs, []string{"create", "delete", "get", "list", "patch", "update", "watch"},
+				"manager role must allow both initial creation and reconciliation of %s", tc.resource)
+		})
+	}
+}
```

**File**: `controllers/actions.github.com/autoscalinglistener_controller.go` (modified, +4/-4)
```diff
@@ -68,10 +68,10 @@ type AutoscalingListenerReconciler struct {
 
 // +kubebuilder:rbac:groups=core,resources=pods,verbs=get;list;watch;create;update;patch;delete
 // +kubebuilder:rbac:groups=core,resources=pods/status,verbs=get
-// +kubebuilder:rbac:groups=core,resources=secrets,verbs=get;list;watch;create;update
-// +kubebuilder:rbac:groups=core,resources=serviceaccounts,verbs=get;list;watch;create;update
-// +kubebuilder:rbac:groups=rbac.authorization.k8s.io,resources=roles,verbs=create;delete;get;list;watch;update
-// +kubebuilder:rbac:groups=rbac.authorization.k8s.io,resources=rolebindings,verbs=create;delete;get;list;watch;update
+// +kubebuilder:rbac:groups=core,resources=secrets,verbs=get;list;watch;create;update;patch
+// +kubebuilder:rbac:groups=core,resources=serviceaccounts,verbs=get;list;watch;create;update;patch
+// +kubebuilder:rbac:groups=rbac.authorization.k8s.io,resources=roles,verbs=create;delete;get;list;watch;update;patch
+// +kubebuilder:rbac:groups=rbac.authorization.k8s.io,resources=rolebindings,verbs=create;delete;get;list;watch;update;patch
 // +kubebuilder:rbac:groups=actions.github.com,resources=autoscalinglisteners,verbs=get;list;watch;create;update;patch;delete
 // +kubebuilder:rbac:groups=actions.github.com,resources=autoscalinglisteners/status,verbs=get;update;patch
 // +kubebuilder:rbac:groups=actions.github.com,resources=autoscalinglisteners/finalizers,verbs=update
```

---

### Incident Patch 7: `2fb29e06` (2026-09-24)
**Commit Message**: Fix listener replacement loop for empty collections (#4682)

**File**: `controllers/actions.github.com/autoscalingrunnerset_controller.go` (modified, +6/-1)
```diff
@@ -32,6 +32,7 @@ import (
 	"github.com/google/go-cmp/cmp"
 	corev1 "k8s.io/api/core/v1"
 	rbacv1 "k8s.io/api/rbac/v1"
+	apiequality "k8s.io/apimachinery/pkg/api/equality"
 	kerrors "k8s.io/apimachinery/pkg/api/errors"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/types"
@@ -500,6 +501,10 @@ func (r *AutoscalingRunnerSetReconciler) runnerSpecChanged(autoscalingRunnerSet
 // comparing it would make a stopped listener look like drift and delete the very
 // object the stop is meant to preserve. Starting and stopping is handled by
 // patching the phase instead.
+//
+// Semantic equality treats nil and empty collections alike: omitempty drops
+// explicit empty input when the derived listener is persisted. Comparing those
+// representations strictly would replace an unchanged listener on every reconcile.
 func listenerSpecChanged(current, desired *v1alpha1.AutoscalingListener) bool {
 	if current == nil || desired == nil {
 		return current != desired
@@ -510,7 +515,7 @@ func listenerSpecChanged(current, desired *v1alpha1.AutoscalingListener) bool {
 	currentSpec.Phase = ""
 	desiredSpec.Phase = ""
 
-	return !cmp.Equal(currentSpec, desiredSpec)
+	return !apiequality.Semantic.DeepEqual(currentSpec, desiredSpec)
 }
 
 // stopListener switches the listener off without deleting it.
```

**File**: `controllers/actions.github.com/autoscalingrunnerset_listener_drift_test.go` (added, +215/-0)
```diff
@@ -0,0 +1,215 @@
+package actionsgithubcom
+
+import (
+	"context"
+	"encoding/json"
+	"time"
+
+	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
+	"github.com/actions/actions-runner-controller/build"
+	scalefake "github.com/actions/actions-runner-controller/controllers/actions.github.com/multiclient/fake"
+	"github.com/actions/actions-runner-controller/controllers/actions.github.com/secretresolver"
+	"github.com/actions/scaleset"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	corev1 "k8s.io/api/core/v1"
+	rbacv1 "k8s.io/api/rbac/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	logf "sigs.k8s.io/controller-runtime/pkg/log"
+)
+
+var _ = Describe("AutoscalingListener empty collection convergence", func() {
+	for _, tc := range listenerEmptyCollectionTestCases() {
+		It(tc.name, func() {
+			ctx, cancel := context.WithTimeout(context.Background(), autoscalingRunnerSetTestTimeout)
+			defer cancel()
+			ns, mgr := createNamespace(GinkgoT(), k8sClient)
+			secret := createDefaultSecret(GinkgoT(), k8sClient, ns.Name)
+			const name = "empty-listener"
+			scaleSet := &scaleset.RunnerScaleSet{ID: 1, Name: name, RunnerGroupID: 1, RunnerGroupName: "Default"}
+			builder := ResourceBuilder{
+				Scheme:        mgr.GetScheme(),
+				ResourceCache: newTestResourceCache(),
+				SecretResolver: secretresolver.New(k8sClient, scalefake.NewMultiClient(scalefake.WithClient(
+					scalefake.NewClient(
+						scalefake.WithCreateRunnerScaleSet(scaleSet, nil),
+						scalefake.WithGetRunnerScaleSetByID(scaleSet, nil),
+					),
+				))),
+			}
+			runnerController := &AutoscalingRunnerSetReconciler{
+				Client:                             mgr.GetClient(),
+				Scheme:                             mgr.GetScheme(),
+				Log:                                logf.Log,
+				ControllerNamespace:                ns.Name,
+				DefaultRunnerScaleSetListenerImage: "ghcr.io/actions/arc:latest",
+				ResourceBuilder:                    builder,
+			}
+			listenerController := &AutoscalingListenerReconciler{
+				Client:              k8sClient,
+				Scheme:              mgr.GetScheme(),
+				Log:                 logf.Log,
+				ListenerMetricsAddr: "0",
+				ResourceBuilder:     builder,
+			}
+			// Run the indexed cache, but drive reconciles explicitly so UID
+			// stability is checked after known reconciles, not a timed quiet period.
+			startManagers(GinkgoT(), mgr)
+
+			var spec map[string]any
+			Expect(json.Unmarshal([]byte(tc.runnerSetSpec), &spec)).To(Succeed())
+			spec["githubConfigUrl"] = "https://github.com/owner/repo"
+			spec["githubConfigSecret"] = secret.Name
+			spec["maxRunners"] = int64(5)
+			spec["template"] = map[string]any{
+				"spec": map[string]any{
+					"containers": []any{map[string]any{"name": "runner", "image": "ghcr.io/actions/runner:latest"}},
+				},
+			}
+			raw := &unstructured.Unstructured{Object: map[string]any{
+				"apiVersion": v1alpha1.GroupVersion.String(),
+				"kind":       "AutoscalingRunnerSet",
+				"metadata": map[string]any{
+					"name": name, "namespace": ns.Name,
+					"labels": map[string]any{LabelKeyKubernetesVersion: build.Version},
+				},
+				"spec": spec,
+			}}
+			// A typed Create would erase the empty input before it reached the API.
+			Expect(k8sClient.Create(ctx, raw)).To(Succeed())
+			runnerSet := new(v1alpha1.AutoscalingRunnerSet)
+			runnerKey := client.ObjectKeyFromObject(raw)
+			Expect(k8sClient.Get(ctx, runnerKey, runnerSet)).To(Succeed())
+			listenerKey := client.ObjectKey{Namespace: ns.Name, Name: scaleSetListenerName(runnerSet)}
+
+			waitForCache := func(key client.ObjectKey, obj client.Object) {
+				err := k8sClient.Get(ctx, key, obj)
+				if kerrors.IsNotFound(err) {
+					Eventually(func() bool {
+						return kerrors.IsNotFound(mgr.GetClient().Get(ctx, key, obj))
+					}, autoscalingRunnerSetTestTimeout, 10*time.Millisecond).Should(BeTrue())
+					return
+				}
+				Expect(err).NotTo(HaveOccurred())
+				version := obj.GetResourceVersion()
+				Eventually(func(g Gomega) {
+					g.Expect(mgr.GetClient().Get(ctx, key, obj)).To(Succeed())
+					g.Expect(obj.GetResourceVersion()).To(Equal(version))
+				}, autoscalingRunnerSetTestTimeout, 10*time.Millisecond).Should(Succeed())
+			}
+			reconcileRunnerSet := func() {
+				waitForCache(runnerKey, new(v1alpha1.AutoscalingRunnerSet))
+				waitForCache(runnerKey, new(v1alpha1.EphemeralRunnerSet))
+				waitForCache(listenerKey, new(v1alpha1.AutoscalingListener))
+				_, err := runnerController.Reconcile(ctx, ctrl.Request{NamespacedName: runnerKey})
+				Expect(err).NotTo(HaveOccurred())
+			}
+			reconcileListener := func() {
+				_, err := listenerController.Reconcile(ctx, ctrl.Request{NamespacedName: listenerKey})
+				Expect(err).NotTo(HaveOccurred())
+			}
+			listener := new(v1alpha1.Auto
```

**File**: `controllers/actions.github.com/helpers.go` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ func ephemeralRunnerSetOutdatedForAppliedRevision(ephemeralRunnerSet *v1alpha1.E
 // The cost of DeepDerivative is that it ignores empty values on the desired side,
 // so a field being *removed* is invisible to it. For everything sourced from the
 // user-facing template that is harmless: the AutoscalingRunnerSet controller
-// compares the whole AutoscalingListener spec with cmp.Equal and deletes the
+// compares the AutoscalingListener spec with Semantic.DeepEqual and deletes the
 // listener outright, which takes the pod with it. Container ports are the
 // exception, because they come from the --listener-metrics-addr controller flag
 // rather than from any resource, so disabling metrics would otherwise leave the
```

**File**: `controllers/actions.github.com/helpers_drift_test.go` (modified, +203/-0)
```diff
@@ -8,6 +8,7 @@ import (
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 )
 
 // roundTripThroughAPIServer simulates what happens when the controller writes an
@@ -145,3 +146,205 @@ func TestEphemeralRunnerSetActionableSpecChanged_RealChangeStillDetected(t *test
 		assert.True(t, ephemeralRunnerSetActionableSpecChanged(base(), nil))
 	})
 }
+
+type listenerEmptyCollectionTestCase struct {
+	name          string
+	runnerSetSpec string
+	collections   func(v1alpha1.AutoscalingListenerSpec) []any
+}
+
+func listenerEmptyCollectionTestCases() []listenerEmptyCollectionTestCase {
+	return []listenerEmptyCollectionTestCase{
+		{
+			name:          "baseline",
+			runnerSetSpec: `{}`,
+			collections:   func(v1alpha1.AutoscalingListenerSpec) []any { return nil },
+		},
+		{
+			name:          "metrics maps",
+			runnerSetSpec: `{"listenerMetrics":{"counters":{},"gauges":{},"histograms":{}}}`,
+			collections: func(s v1alpha1.AutoscalingListenerSpec) []any {
+				return []any{s.Metrics.Counters, s.Metrics.Gauges, s.Metrics.Histograms}
+			},
+		},
+		{
+			name:          "template collections",
+			runnerSetSpec: `{"listenerTemplate":{"spec":{"containers":[{"name":"listener","env":[]}],"nodeSelector":{},"tolerations":[]}}}`,
+			collections: func(s v1alpha1.AutoscalingListenerSpec) []any {
+				return []any{s.Template.Spec.Containers[0].Env, s.Template.Spec.NodeSelector, s.Template.Spec.Tolerations}
+			},
+		},
+		{
+			name:          "service account metadata",
+			runnerSetSpec: `{"listenerServiceAccountMetadata":{"labels":{},"annotations":{}}}`,
+			collections: func(s v1alpha1.AutoscalingListenerSpec) []any {
+				return []any{s.ServiceAccountMetadata.Labels, s.ServiceAccountMetadata.Annotations}
+			},
+		},
+		{
+			name:          "role metadata",
+			runnerSetSpec: `{"listenerRoleMetadata":{"labels":{},"annotations":{}}}`,
+			collections: func(s v1alpha1.AutoscalingListenerSpec) []any {
+				return []any{s.RoleMetadata.Labels, s.RoleMetadata.Annotations}
+			},
+		},
+		{
+			name:          "role binding metadata",
+			runnerSetSpec: `{"listenerRoleBindingMetadata":{"labels":{},"annotations":{}}}`,
+			collections: func(s v1alpha1.AutoscalingListenerSpec) []any {
+				return []any{s.RoleBindingMetadata.Labels, s.RoleBindingMetadata.Annotations}
+			},
+		},
+		{
+			name:          "config secret metadata",
+			runnerSetSpec: `{"listenerConfigSecretMetadata":{"labels":{},"annotations":{}}}`,
+			collections: func(s v1alpha1.AutoscalingListenerSpec) []any {
+				return []any{s.ConfigSecretMetadata.Labels, s.ConfigSecretMetadata.Annotations}
+			},
+		},
+	}
+}
+
+func TestListenerSpecChanged_EmptyCollectionsRoundTrip(t *testing.T) {
+	for _, tc := range listenerEmptyCollectionTestCases() {
+		t.Run(tc.name, func(t *testing.T) {
+			runnerSet := &v1alpha1.AutoscalingRunnerSet{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:        "runners",
+					Namespace:   "runners",
+					Annotations: map[string]string{runnerScaleSetIDAnnotationKey: "1"},
+				},
+			}
+			require.NoError(t, json.Unmarshal([]byte(tc.runnerSetSpec), &runnerSet.Spec))
+			runnerSet.Spec.GitHubConfigUrl = "https://github.com/owner/repo"
+			builder := ResourceBuilder{ResourceCache: newTestResourceCache()}
+			desired, err := builder.newAutoscalingListener(
+				runnerSet, &v1alpha1.EphemeralRunnerSet{}, "controller", "listener:latest", nil,
+			)
+			require.NoError(t, err)
+
+			raw, err := json.Marshal(desired)
+			require.NoError(t, err)
+			current := new(v1alpha1.AutoscalingListener)
+			require.NoError(t, json.Unmarshal(raw, current))
+
+			persistedCollections := tc.collections(current.Spec)
+			for i, collection := range tc.collections(desired.Spec) {
+				require.NotNil(t, collection, "the desired fixture must retain the explicit empty collection")
+				require.Empty(t, collection)
+				require.Nil(t, persistedCollections[i], "omitempty must drop the persisted collection")
+			}
+
+			currentBefore, desiredBefore := current.DeepCopy(), desired.DeepCopy()
+			assert.False(t, listenerSpecChanged(current, desired),
+				"serialization of empty collections must not cause continuous listener replacement")
+			assert.False(t, listenerSpecChanged(desired, current), "comparison must be symmetric")
+			assert.Equal(t, currentBefore, current, "comparison must not mutate the current listener")
+			assert.Equal(t, desiredBefore, desired, "comparison must not mutate the desired listener")
+		})
+	}
+}
+
+func TestListenerSpecChanged_RealChangeStillDetected(t *testing.T) {
+	base := &v1alpha1.AutoscalingListener{
+		Spec: v1alpha1.AutoscalingListenerSpec{
+			Image:      "listener:latest",
+			MaxRunners: 10,
+			Metrics: &v1alpha1.MetricsConfig{
+				Counters: map[string]*v1alpha1.CounterMetric{
+					"jobs_started": {Labels: []string{"repository"}},
+				},
+			},
+			Template: &corev1.PodTemplateSpec{
+				Spec: corev1.PodSpec{
+					C
```

---

### Incident Patch 8: `0528d1c4` (2026-09-24)
**Commit Message**: Fix listener pod patch recovery (#4680)

**File**: `charts/gha-runner-scale-set-controller-experimental/templates/manager_listener_role.yaml` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ rules:
   - create
   - delete
   - get
+  - patch
 - apiGroups:
   - ""
   resources:
```

**File**: `charts/gha-runner-scale-set-controller-experimental/tests/controller_rbac_listener_role_test.yaml` (modified, +8/-0)
```diff
@@ -24,6 +24,14 @@ tests:
           path: rules[0].resources[0]
           value: "pods"
         template: manager_listener_role.yaml
+      - equal:
+          path: rules[0].verbs
+          value:
+            - create
+            - delete
+            - get
+            - patch
+        template: manager_listener_role.yaml
       - equal:
           path: rules[1].resources[0]
           value: "pods/status"
```

**File**: `charts/gha-runner-scale-set-controller/templates/manager_listener_role.yaml` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ rules:
   - create
   - delete
   - get
+  - patch
 - apiGroups:
   - ""
   resources:
```

**File**: `charts/gha-runner-scale-set-controller/tests/template_test.go` (modified, +1/-0)
```diff
@@ -248,6 +248,7 @@ func TestTemplate_CreateManagerListenerRole(t *testing.T) {
 	assert.Equal(t, "test-arc-gha-rs-controller-listener", managerListenerRole.Name)
 	assert.Equal(t, 4, len(managerListenerRole.Rules))
 	assert.Equal(t, "pods", managerListenerRole.Rules[0].Resources[0])
+	assert.ElementsMatch(t, []string{"create", "delete", "get", "patch"}, managerListenerRole.Rules[0].Verbs)
 	assert.Equal(t, "pods/status", managerListenerRole.Rules[1].Resources[0])
 	assert.Equal(t, "secrets", managerListenerRole.Rules[2].Resources[0])
 	assert.Equal(t, "serviceaccounts", managerListenerRole.Rules[3].Resources[0])
```

**File**: `controllers/actions.github.com/autoscalinglistener_controller.go` (modified, +39/-21)
```diff
@@ -524,6 +524,15 @@ func (r *AutoscalingListenerReconciler) Reconcile(ctx context.Context, req ctrl.
 			return ctrl.Result{}, nil
 		}
 
+		if listenerPodIsDead(&listenerPod) {
+			logDeadListenerPod(&listenerPod, log)
+			return ctrl.Result{}, r.deleteListenerPod(ctx, &autoscalingListener, &listenerPod, log)
+		}
+
+		if !listenerPod.DeletionTimestamp.IsZero() {
+			return ctrl.Result{}, nil
+		}
+
 		desiredLabels := r.filterAndMergeLabels(listenerPod.Labels, desiredPod.Labels)
 		labelsModified := !maps.Equal(listenerPod.Labels, desiredLabels)
 		desiredAnnotations := r.mergeAnnotations(listenerPod.Annotations, desiredPod.Annotations)
@@ -577,30 +586,9 @@ func (r *AutoscalingListenerReconciler) Reconcile(ctx context.Context, req ctrl.
 
 	cs := listenerContainerStatus(&listenerPod)
 	switch {
-	case listenerPod.Status.Reason == "Evicted":
-		log.Info(
-			"Listener pod is evicted",
-			"phase", listenerPod.Status.Phase,
-			"reason", listenerPod.Status.Reason,
-			"message", listenerPod.Status.Message,
-		)
-
-		return ctrl.Result{}, r.deleteListenerPod(ctx, &autoscalingListener, &listenerPod, log)
-
 	case cs == nil:
 		log.Info("Listener pod is not ready", "namespace", listenerPod.Namespace, "name", listenerPod.Name)
 		return ctrl.Result{}, nil
-	case cs.State.Terminated != nil:
-		log.Info(
-			"Listener pod is terminated",
-			"namespace", listenerPod.Namespace,
-			"name", listenerPod.Name,
-			"reason", cs.State.Terminated.Reason,
-			"message", cs.State.Terminated.Message,
-		)
-
-		return ctrl.Result{}, r.deleteListenerPod(ctx, &autoscalingListener, &listenerPod, log)
-
 	case cs.State.Running != nil:
 		if err := r.publishRunningListener(&autoscalingListener, true); err != nil {
 			log.Error(err, "Unable to publish running listener", "namespace", listenerPod.Namespace, "name", listenerPod.Name)
@@ -986,3 +974,33 @@ func listenerContainerStatus(pod *corev1.Pod) *corev1.ContainerStatus {
 	}
 	return nil
 }
+
+func listenerPodIsDead(pod *corev1.Pod) bool {
+	if pod.Status.Reason == "Evicted" {
+		return true
+	}
+
+	cs := listenerContainerStatus(pod)
+	return cs != nil && cs.State.Terminated != nil
+}
+
+func logDeadListenerPod(pod *corev1.Pod, log logr.Logger) {
+	if pod.Status.Reason == "Evicted" {
+		log.Info(
+			"Listener pod is evicted",
+			"phase", pod.Status.Phase,
+			"reason", pod.Status.Reason,
+			"message", pod.Status.Message,
+		)
+		return
+	}
+
+	cs := listenerContainerStatus(pod)
+	log.Info(
+		"Listener pod is terminated",
+		"namespace", pod.Namespace,
+		"name", pod.Name,
+		"reason", cs.State.Terminated.Reason,
+		"message", cs.State.Terminated.Message,
+	)
+}
```

**File**: `controllers/actions.github.com/autoscalinglistener_controller_test.go` (modified, +200/-0)
```diff
@@ -6,12 +6,14 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+	"sync/atomic"
 	"time"
 
 	corev1 "k8s.io/api/core/v1"
 	rbacv1 "k8s.io/api/rbac/v1"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/interceptor"
 	logf "sigs.k8s.io/controller-runtime/pkg/log"
 
 	ghalistenerconfig "github.com/actions/actions-runner-controller/cmd/ghalistener/config"
@@ -21,6 +23,7 @@ import (
 	. "github.com/onsi/gomega"
 	kerrors "k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 
 	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
@@ -1039,6 +1042,203 @@ var _ = Describe("Test AutoScalingListener customization", func() {
 	})
 })
 
+var _ = Describe("AutoscalingListener dead pod recovery", func() {
+	var (
+		ctx                   context.Context
+		mgr                   ctrl.Manager
+		autoscalingNS         *corev1.Namespace
+		autoscalingRunnerSet  *v1alpha1.AutoscalingRunnerSet
+		autoscalingListener   *v1alpha1.AutoscalingListener
+		configSecret          *corev1.Secret
+		reconcileRequest      ctrl.Request
+		newListenerReconciler func(client.Client) *AutoscalingListenerReconciler
+	)
+
+	BeforeEach(func() {
+		ctx = context.Background()
+		autoscalingNS, mgr = createNamespace(GinkgoT(), k8sClient)
+		configSecret = createDefaultSecret(GinkgoT(), k8sClient, autoscalingNS.Name)
+
+		min := 1
+		max := 10
+		autoscalingRunnerSet = &v1alpha1.AutoscalingRunnerSet{
+			ObjectMeta: metav1.ObjectMeta{
+				Name:      "test-asrs",
+				Namespace: autoscalingNS.Name,
+			},
+			Spec: v1alpha1.AutoscalingRunnerSetSpec{
+				GitHubConfigUrl:    "https://github.com/owner/repo",
+				GitHubConfigSecret: configSecret.Name,
+				MaxRunners:         &max,
+				MinRunners:         &min,
+				Template: corev1.PodTemplateSpec{
+					Spec: corev1.PodSpec{
+						Containers: []corev1.Container{
+							{
+								Name:  "runner",
+								Image: "ghcr.io/actions/runner",
+							},
+						},
+					},
+				},
+			},
+		}
+		Expect(k8sClient.Create(ctx, autoscalingRunnerSet)).To(Succeed())
+
+		autoscalingListener = &v1alpha1.AutoscalingListener{
+			ObjectMeta: metav1.ObjectMeta{
+				Name:      "test-asl",
+				Namespace: autoscalingNS.Name,
+				Labels: map[string]string{
+					"arc.test/listener-label": "desired",
+				},
+			},
+			Spec: v1alpha1.AutoscalingListenerSpec{
+				GitHubConfigURL:               "https://github.com/owner/repo",
+				GitHubConfigSecret:            configSecret.Name,
+				RunnerScaleSetID:              1,
+				AutoscalingRunnerSetNamespace: autoscalingRunnerSet.Namespace,
+				AutoscalingRunnerSetName:      autoscalingRunnerSet.Name,
+				EphemeralRunnerSetName:        "test-ers",
+				MaxRunners:                    10,
+				MinRunners:                    1,
+				Image:                         "ghcr.io/owner/repo",
+			},
+		}
+		Expect(k8sClient.Create(ctx, autoscalingListener)).To(Succeed())
+
+		reconcileRequest = ctrl.Request{NamespacedName: client.ObjectKeyFromObject(autoscalingListener)}
+		newListenerReconciler = func(c client.Client) *AutoscalingListenerReconciler {
+			return &AutoscalingListenerReconciler{
+				Client: c,
+				Scheme: mgr.GetScheme(),
+				Log:    logf.Log,
+				ResourceBuilder: ResourceBuilder{
+					ResourceCache:  newTestResourceCache(),
+					SecretResolver: secretresolver.New(c, scalefake.NewMultiClient()),
+					Scheme:         mgr.GetScheme(),
+				},
+			}
+		}
+	})
+
+	waitForListenerPod := func(reconciler *AutoscalingListenerReconciler) *corev1.Pod {
+		Eventually(
+			func() error {
+				_, err := reconciler.Reconcile(ctx, reconcileRequest)
+				if err != nil {
+					return err
+				}
+
+				return k8sClient.Get(ctx, reconcileRequest.NamespacedName, new(corev1.Pod))
+			},
+			autoscalingListenerTestTimeout,
+			autoscalingListenerTestInterval,
+		).Should(Succeed())
+
+		pod := new(corev1.Pod)
+		Expect(k8sClient.Get(ctx, reconcileRequest.NamespacedName, pod)).To(Succeed())
+		return pod
+	}
+
+	markPodDeadWithMetadataDrift := func(pod *corev1.Pod, evicted bool) {
+		original := pod.DeepCopy()
+		pod.Labels["arc.test/listener-label"] = "stale"
+		pod.Annotations[AnnotationKeyListenerConfigResourceVersion] = "stale"
+		Expect(k8sClient.Patch(ctx, pod, client.MergeFrom(original))).To(Succeed())
+
+		Expect(k8sClient.Get(ctx, reconcileRequest.NamespacedName, pod)).To(Succeed())
+		if evicted {
+			pod.Status.Reason = "Evicted"
+		} else {
+			pod.Status.ContainerStatuses = []corev1.ContainerStatus{
+				{
+					Name: autoscalingListenerContainerName,
+					State: corev1.ContainerState{
+						Terminated: &corev1.ContainerStateTerminated{ExitCode: 1},
+					},
+				},
+			}
+		}
+		Expect(k8sClient.Status().Update(ctx, pod)).To(Succeed())
+	}
+
+	recoverDeadPod := func(evicted, forbidPodPatch bool) {
+		bootstrapReconciler := newListenerReconciler(k8sClient)
```

---

### Incident Patch 9: `6df0e09f` (2026-09-18)
**Commit Message**: Revert "Remove legacy e2e tests and promote v2 tests (#4658)" (#4667)

**File**: `.github/workflows/gha-e2e-tests.yaml` (modified, +210/-2)
```diff
@@ -43,12 +43,36 @@ jobs:
           application_id: ${{ secrets.E2E_TESTS_ACCESS_APP_ID }}
           application_private_key: ${{ secrets.E2E_TESTS_ACCESS_PK }}
           organization: ${{ env.TARGET_ORG }}
+
       - name: Run default setup test
         run: hack/e2e-test.sh default-setup
         env:
           GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
         shell: bash
 
+  default-setup-v2:
+    runs-on: ubuntu-latest
+    timeout-minutes: 20
+    if: github.event_name != 'pull_request' ||
+      github.event.pull_request.head.repo.id == github.repository_id
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          ref: ${{github.head_ref}}
+
+      - name: Get configure token
+        id: config-token
+        uses: peter-murray/workflow-application-token-action@dad2b81e50ce3edeb5f3b7ffbd79f731368bd668
+        with:
+          application_id: ${{ secrets.E2E_TESTS_ACCESS_APP_ID }}
+          application_private_key: ${{ secrets.E2E_TESTS_ACCESS_PK }}
+          organization: ${{ env.TARGET_ORG }}
+      - name: Run default setup test
+        run: hack/e2e-test.sh default-setup-v2
+        env:
+          GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
+        shell: bash
+
   single-namespace-setup:
     runs-on: ubuntu-latest
     timeout-minutes: 20
@@ -72,6 +96,29 @@ jobs:
           GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
         shell: bash
 
+  single-namespace-setup-v2:
+    runs-on: ubuntu-latest
+    timeout-minutes: 20
+    if: github.event_name != 'pull_request' ||
+      github.event.pull_request.head.repo.id == github.repository_id
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          ref: ${{github.head_ref}}
+
+      - name: Get configure token
+        id: config-token
+        uses: peter-murray/workflow-application-token-action@dad2b81e50ce3edeb5f3b7ffbd79f731368bd668
+        with:
+          application_id: ${{ secrets.E2E_TESTS_ACCESS_APP_ID }}
+          application_private_key: ${{ secrets.E2E_TESTS_ACCESS_PK }}
+          organization: ${{ env.TARGET_ORG }}
+      - name: Run single namespace setup test
+        run: hack/e2e-test.sh single-namespace-setup-v2
+        env:
+          GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
+        shell: bash
+
   dind-mode-setup:
     runs-on: ubuntu-latest
     timeout-minutes: 20
@@ -95,6 +142,29 @@ jobs:
           GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
         shell: bash
 
+  dind-mode-setup-v2:
+    runs-on: ubuntu-latest
+    timeout-minutes: 20
+    if: github.event_name != 'pull_request' ||
+      github.event.pull_request.head.repo.id == github.repository_id
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          ref: ${{github.head_ref}}
+
+      - name: Get configure token
+        id: config-token
+        uses: peter-murray/workflow-application-token-action@dad2b81e50ce3edeb5f3b7ffbd79f731368bd668
+        with:
+          application_id: ${{ secrets.E2E_TESTS_ACCESS_APP_ID }}
+          application_private_key: ${{ secrets.E2E_TESTS_ACCESS_PK }}
+          organization: ${{ env.TARGET_ORG }}
+      - name: Run dind mode setup test
+        run: hack/e2e-test.sh dind-mode-setup-v2
+        env:
+          GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
+        shell: bash
+
   kubernetes-mode-setup:
     runs-on: ubuntu-latest
     timeout-minutes: 20
@@ -118,6 +188,29 @@ jobs:
           GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
         shell: bash
 
+  kubernetes-mode-setup-v2:
+    runs-on: ubuntu-latest
+    timeout-minutes: 20
+    if: github.event_name != 'pull_request' ||
+      github.event.pull_request.head.repo.id == github.repository_id
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          ref: ${{github.head_ref}}
+
+      - name: Get configure token
+        id: config-token
+        uses: peter-murray/workflow-application-token-action@dad2b81e50ce3edeb5f3b7ffbd79f731368bd668
+        with:
+          application_id: ${{ secrets.E2E_TESTS_ACCESS_APP_ID }}
+          application_private_key: ${{ secrets.E2E_TESTS_ACCESS_PK }}
+          organization: ${{ env.TARGET_ORG }}
+      - name: Run kubernetes mode setup test
+        run: hack/e2e-test.sh kubernetes-mode-setup-v2
+        env:
+          GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
+        shell: bash
+
   auth-proxy-setup:
     runs-on: ubuntu-latest
     timeout-minutes: 20
@@ -135,8 +228,31 @@ jobs:
           application_id: ${{ secrets.E2E_TESTS_ACCESS_APP_ID }}
           application_private_key: ${{ secrets.E2E_TESTS_ACCESS_PK }}
           organization: ${{ env.TARGET_ORG }}
-      - name: Run auth proxy setup test
-        run: hack/e2e-test.sh auth-proxy-setup
+      - name: Run single namespace setup test
+        run: hack/e2e-test.sh single-namespace-setup
+        env:
+          GITHUB_TOKEN: "${{steps.config-token.outputs.token}}"
+        shell: bash
+
+  auth-proxy-setup
```

**File**: `test/actions.github.com/anonymous-proxy-setup-v2.test.sh` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+#!/bin/bash
+
+set -euo pipefail
+
+DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")")"
+
+ROOT_DIR="$(realpath "${DIR}/../..")"
+
+source "${DIR}/helper.sh"
+
+export VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental/Chart.yaml")"
+
+SCALE_SET_NAME="anonymous-proxy-$(date +'%M%S')$(((RANDOM + 100) % 100 + 1))"
+SCALE_SET_NAMESPACE="arc-runners"
+WORKFLOW_FILE="arc-test-workflow.yaml"
+ARC_NAME="arc"
+ARC_NAMESPACE="arc-systems"
+
+function install_arc() {
+    echo "Installing ARC"
+    helm install "${ARC_NAME}" \
+        --namespace "${ARC_NAMESPACE}" \
+        --create-namespace \
+        --set controller.manager.container.image="${IMAGE_NAME}:${IMAGE_TAG}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental" \
+        --debug
+
+    if ! NAME="${ARC_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_arc; then
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        return 1
+    fi
+}
+
+function install_squid() {
+    echo "Starting squid-proxy"
+    kubectl apply -f "${DIR}/anonymous-proxy-setup.squid.yaml"
+}
+
+function install_scale_set() {
+    echo "Installing scale set ${SCALE_SET_NAMESPACE}/${SCALE_SET_NAME}"
+
+    helm install "${SCALE_SET_NAME}" \
+        --namespace "${SCALE_SET_NAMESPACE}" \
+        --create-namespace \
+        --set controllerServiceAccount.name="${ARC_NAME}-gha-rs-controller" \
+        --set controllerServiceAccount.namespace="${ARC_NAMESPACE}" \
+        --set auth.url="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
+        --set auth.githubToken="${GITHUB_TOKEN}" \
+        --set proxy.https.url="http://squid.default.svc.cluster.local:3128" \
+        --set "proxy.noProxy[0]=10.96.0.1:443" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-experimental"
+
+    if ! NAME="${SCALE_SET_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_scale_set; then
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        return 1
+    fi
+}
+
+function main() {
+    local failed=()
+
+    build_image
+    create_cluster
+
+    install_arc
+    install_squid
+
+    install_scale_set || {
+        echo "Scale set installation failed"
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        delete_cluster
+        exit 1
+    }
+
+    WORKFLOW_FILE="${WORKFLOW_FILE}" SCALE_SET_NAME="${SCALE_SET_NAME}" run_workflow || failed+=("run_workflow")
+
+    INSTALLATION_NAME="${SCALE_SET_NAME}" NAMESPACE="${SCALE_SET_NAMESPACE}" cleanup_scale_set || failed+=("cleanup_scale_set")
+
+    NAMESPACE="${ARC_NAMESPACE}" log_arc || failed+=("log_arc")
+
+    delete_cluster
+
+    print_results "${failed[@]}"
+}
+
+main
```

**File**: `test/actions.github.com/anonymous-proxy-setup.test.sh` (modified, +8/-8)
```diff
@@ -8,7 +8,7 @@ ROOT_DIR="$(realpath "${DIR}/../..")"
 
 source "${DIR}/helper.sh"
 
-export VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental/Chart.yaml")"
+export VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller/Chart.yaml")"
 
 SCALE_SET_NAME="anonymous-proxy-$(date +'%M%S')$(((RANDOM + 100) % 100 + 1))"
 SCALE_SET_NAMESPACE="arc-runners"
@@ -21,8 +21,9 @@ function install_arc() {
     helm install "${ARC_NAME}" \
         --namespace "${ARC_NAMESPACE}" \
         --create-namespace \
-        --set controller.manager.container.image="${IMAGE_NAME}:${IMAGE_TAG}" \
-        "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental" \
+        --set image.repository="${IMAGE_NAME}" \
+        --set image.tag="${IMAGE_TAG}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-controller" \
         --debug
 
     if ! NAME="${ARC_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_arc; then
@@ -42,13 +43,12 @@ function install_scale_set() {
     helm install "${SCALE_SET_NAME}" \
         --namespace "${SCALE_SET_NAMESPACE}" \
         --create-namespace \
-        --set controllerServiceAccount.name="${ARC_NAME}-gha-rs-controller" \
-        --set controllerServiceAccount.namespace="${ARC_NAMESPACE}" \
-        --set auth.url="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
-        --set auth.githubToken="${GITHUB_TOKEN}" \
+        --set githubConfigUrl="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
+        --set githubConfigSecret.github_token="${GITHUB_TOKEN}" \
         --set proxy.https.url="http://squid.default.svc.cluster.local:3128" \
         --set "proxy.noProxy[0]=10.96.0.1:443" \
-        "${ROOT_DIR}/charts/gha-runner-scale-set-experimental"
+        "${ROOT_DIR}/charts/gha-runner-scale-set" \
+        --debug
 
     if ! NAME="${SCALE_SET_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_scale_set; then
         NAMESPACE="${ARC_NAMESPACE}" log_arc
```

**File**: `test/actions.github.com/auth-proxy-setup-v2.test.sh` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+#!/bin/bash
+
+set -euo pipefail
+
+DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")")"
+
+ROOT_DIR="$(realpath "${DIR}/../..")"
+
+source "${DIR}/helper.sh"
+
+export VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental/Chart.yaml")"
+
+SCALE_SET_NAME="default-$(date +'%M%S')$(((RANDOM + 100) % 100 + 1))"
+SCALE_SET_NAMESPACE="arc-runners"
+WORKFLOW_FILE="arc-test-workflow.yaml"
+ARC_NAME="arc"
+ARC_NAMESPACE="arc-systems"
+
+function install_arc() {
+    install_openebs || {
+        echo "OpenEBS installation failed"
+        return 1
+    }
+
+    echo "Installing ARC"
+    helm install "${ARC_NAME}" \
+        --namespace "${ARC_NAMESPACE}" \
+        --create-namespace \
+        --set controller.manager.container.image="${IMAGE_NAME}:${IMAGE_TAG}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental" \
+        --debug
+
+    if ! NAME="${ARC_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_arc; then
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        return 1
+    fi
+}
+
+function install_squid() {
+    echo "Starting squid-proxy"
+    kubectl apply -f "${DIR}/auth-proxy-setup.squid.yaml"
+
+    echo "Creating scale set namespace"
+    kubectl create namespace "${SCALE_SET_NAMESPACE}" || true
+
+    echo "Creating squid proxy secret"
+    kubectl create secret generic proxy-auth \
+        --namespace=arc-runners \
+        --from-literal=username=github \
+        --from-literal=password='actions'
+}
+
+function install_scale_set() {
+    echo "Installing scale set ${SCALE_SET_NAMESPACE}/${SCALE_SET_NAME}"
+    helm install "${SCALE_SET_NAME}" \
+        --namespace "${SCALE_SET_NAMESPACE}" \
+        --create-namespace \
+        --set controllerServiceAccount.name="${ARC_NAME}-gha-rs-controller" \
+        --set controllerServiceAccount.namespace="${ARC_NAMESPACE}" \
+        --set auth.url="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
+        --set auth.githubToken="${GITHUB_TOKEN}" \
+        --set proxy.https.url="http://squid.default.svc.cluster.local:3128" \
+        --set proxy.https.credentialSecretRef="proxy-auth" \
+        --set "proxy.noProxy[0]=10.96.0.1:443" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-experimental" \
+        --version="${VERSION}"
+
+    if ! NAME="${SCALE_SET_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_scale_set; then
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        return 1
+    fi
+}
+
+function main() {
+    local failed=()
+
+    build_image
+    create_cluster
+
+    install_arc
+    install_squid
+
+    install_scale_set || {
+        echo "Scale set installation failed"
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        delete_cluster
+        exit 1
+    }
+
+    WORKFLOW_FILE="${WORKFLOW_FILE}" SCALE_SET_NAME="${SCALE_SET_NAME}" run_workflow || failed+=("run_workflow")
+
+    INSTALLATION_NAME="${SCALE_SET_NAME}" NAMESPACE="${SCALE_SET_NAMESPACE}" cleanup_scale_set || failed+=("cleanup_scale_set")
+
+    NAMESPACE="${ARC_NAMESPACE}" log_arc || failed+=("log_arc")
+
+    delete_cluster
+
+    print_results "${failed[@]}"
+}
+
+main
```

**File**: `test/actions.github.com/auth-proxy-setup.test.sh` (modified, +9/-9)
```diff
@@ -8,7 +8,7 @@ ROOT_DIR="$(realpath "${DIR}/../..")"
 
 source "${DIR}/helper.sh"
 
-export VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental/Chart.yaml")"
+export VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller/Chart.yaml")"
 
 SCALE_SET_NAME="default-$(date +'%M%S')$(((RANDOM + 100) % 100 + 1))"
 SCALE_SET_NAMESPACE="arc-runners"
@@ -26,8 +26,9 @@ function install_arc() {
     helm install "${ARC_NAME}" \
         --namespace "${ARC_NAMESPACE}" \
         --create-namespace \
-        --set controller.manager.container.image="${IMAGE_NAME}:${IMAGE_TAG}" \
-        "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental" \
+        --set image.repository="${IMAGE_NAME}" \
+        --set image.tag="${IMAGE_TAG}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-controller" \
         --debug
 
     if ! NAME="${ARC_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_arc; then
@@ -55,15 +56,14 @@ function install_scale_set() {
     helm install "${SCALE_SET_NAME}" \
         --namespace "${SCALE_SET_NAMESPACE}" \
         --create-namespace \
-        --set controllerServiceAccount.name="${ARC_NAME}-gha-rs-controller" \
-        --set controllerServiceAccount.namespace="${ARC_NAMESPACE}" \
-        --set auth.url="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
-        --set auth.githubToken="${GITHUB_TOKEN}" \
+        --set githubConfigUrl="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
+        --set githubConfigSecret.github_token="${GITHUB_TOKEN}" \
         --set proxy.https.url="http://squid.default.svc.cluster.local:3128" \
         --set proxy.https.credentialSecretRef="proxy-auth" \
         --set "proxy.noProxy[0]=10.96.0.1:443" \
-        "${ROOT_DIR}/charts/gha-runner-scale-set-experimental" \
-        --version="${VERSION}"
+        "${ROOT_DIR}/charts/gha-runner-scale-set" \
+        --version="${VERSION}" \
+        --debug
 
     if ! NAME="${SCALE_SET_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_scale_set; then
         NAMESPACE="${ARC_NAMESPACE}" log_arc
```

**File**: `test/actions.github.com/custom-label-setup-v2.test.sh` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+#!/bin/bash
+
+set -euo pipefail
+
+DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")")"
+
+ROOT_DIR="$(realpath "${DIR}/../..")"
+
+source "${DIR}/helper.sh"
+
+VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental/Chart.yaml")" || exit 1
+export VERSION
+
+SCALE_SET_NAME="custom-label-$(date +'%M%S')$(((RANDOM + 100) % 100 + 1))"
+SCALE_SET_NAMESPACE="arc-runners"
+SCALE_SET_LABEL="custom-$(date +'%s')${RANDOM}"
+WORKFLOW_FILE="arc-custom-label.yaml"
+ARC_NAME="arc"
+ARC_NAMESPACE="arc-systems"
+
+function install_arc() {
+    echo "Installing ARC"
+    helm install "${ARC_NAME}" \
+        --namespace "${ARC_NAMESPACE}" \
+        --create-namespace \
+        --set controller.manager.container.image="${IMAGE_NAME}:${IMAGE_TAG}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental" \
+        --debug
+
+    if ! NAME="${ARC_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_arc; then
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        return 1
+    fi
+}
+
+function install_scale_set() {
+    echo "Installing scale set ${SCALE_SET_NAMESPACE}/${SCALE_SET_NAME} with label ${SCALE_SET_LABEL}"
+    helm install "${SCALE_SET_NAME}" \
+        --namespace "${SCALE_SET_NAMESPACE}" \
+        --create-namespace \
+        --set controllerServiceAccount.name="${ARC_NAME}-gha-rs-controller" \
+        --set controllerServiceAccount.namespace="${ARC_NAMESPACE}" \
+        --set auth.url="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
+        --set auth.githubToken="${GITHUB_TOKEN}" \
+        --set scaleset.labels[0]="${SCALE_SET_LABEL}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-experimental" \
+        --version="${VERSION}"
+
+    if ! NAME="${SCALE_SET_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_scale_set; then
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        return 1
+    fi
+}
+
+function verify_scale_set_label() {
+    local actual_label
+    actual_label="$(kubectl get autoscalingrunnersets.actions.github.com -n "${SCALE_SET_NAMESPACE}" -l app.kubernetes.io/instance="${SCALE_SET_NAME}" -o jsonpath='{.items[0].spec.runnerScaleSetLabels[0]}')"
+    if [[ "${actual_label}" != "${SCALE_SET_LABEL}" ]]; then
+        echo "Expected scale set label '${SCALE_SET_LABEL}', got '${actual_label}'" >&2
+        return 1
+    fi
+}
+
+function run_custom_label_workflow() {
+    local repo="${TARGET_ORG}/${TARGET_REPO}"
+    local queue_time
+    queue_time="$(date -u +%FT%TZ)"
+
+    gh workflow run -R "${repo}" "${WORKFLOW_FILE}" \
+        -f scaleset-label="${SCALE_SET_LABEL}" || return 1
+
+    local count=0
+    local run_id=
+    while true; do
+        if [[ "${count}" -ge 12 ]]; then
+            echo "Timeout waiting for custom label workflow to start" >&2
+            return 1
+        fi
+
+        run_id="$(gh run list -R "${repo}" --workflow "${WORKFLOW_FILE}" --created ">${queue_time}" --json databaseId --jq '.[0].databaseId' | head -n1)"
+        if [[ -n "${run_id}" ]]; then
+            break
+        fi
+
+        sleep 5
+        count=$((count + 1))
+    done
+
+    gh run watch "${run_id}" -R "${repo}" --exit-status
+}
+
+function main() {
+    local failed=()
+
+    build_image
+    create_cluster
+
+    install_arc
+    install_scale_set
+    verify_scale_set_label || failed+=("verify_scale_set_label")
+
+    run_custom_label_workflow || failed+=("run_custom_label_workflow")
+
+    INSTALLATION_NAME="${SCALE_SET_NAME}" NAMESPACE="${SCALE_SET_NAMESPACE}" cleanup_scale_set || failed+=("cleanup_scale_set")
+
+    NAMESPACE="${ARC_NAMESPACE}" log_arc || failed+=("log_arc")
+
+    delete_cluster
+
+    print_results "${failed[@]}"
+}
+
+main
```

**File**: `test/actions.github.com/custom-label-setup.test.sh` (modified, +10/-11)
```diff
@@ -8,8 +8,7 @@ ROOT_DIR="$(realpath "${DIR}/../..")"
 
 source "${DIR}/helper.sh"
 
-VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental/Chart.yaml")" || exit 1
-export VERSION
+export VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller/Chart.yaml")"
 
 SCALE_SET_NAME="custom-label-$(date +'%M%S')$(((RANDOM + 100) % 100 + 1))"
 SCALE_SET_NAMESPACE="arc-runners"
@@ -23,8 +22,9 @@ function install_arc() {
     helm install "${ARC_NAME}" \
         --namespace "${ARC_NAMESPACE}" \
         --create-namespace \
-        --set controller.manager.container.image="${IMAGE_NAME}:${IMAGE_TAG}" \
-        "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental" \
+        --set image.repository="${IMAGE_NAME}" \
+        --set image.tag="${IMAGE_TAG}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-controller" \
         --debug
 
     if ! NAME="${ARC_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_arc; then
@@ -38,13 +38,12 @@ function install_scale_set() {
     helm install "${SCALE_SET_NAME}" \
         --namespace "${SCALE_SET_NAMESPACE}" \
         --create-namespace \
-        --set controllerServiceAccount.name="${ARC_NAME}-gha-rs-controller" \
-        --set controllerServiceAccount.namespace="${ARC_NAMESPACE}" \
-        --set auth.url="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
-        --set auth.githubToken="${GITHUB_TOKEN}" \
-        --set scaleset.labels[0]="${SCALE_SET_LABEL}" \
-        "${ROOT_DIR}/charts/gha-runner-scale-set-experimental" \
-        --version="${VERSION}"
+        --set githubConfigUrl="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
+        --set githubConfigSecret.github_token="${GITHUB_TOKEN}" \
+        --set scaleSetLabels[0]="${SCALE_SET_LABEL}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set" \
+        --version="${VERSION}" \
+        --debug
 
     if ! NAME="${SCALE_SET_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_scale_set; then
         NAMESPACE="${ARC_NAMESPACE}" log_arc
```

**File**: `test/actions.github.com/default-setup-v2.test.sh` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+#!/bin/bash
+
+set -euo pipefail
+
+DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")")"
+
+ROOT_DIR="$(realpath "${DIR}/../..")"
+
+source "${DIR}/helper.sh"
+
+VERSION="$(chart_version "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental/Chart.yaml")" || exit 1
+export VERSION
+
+SCALE_SET_NAME="default-$(date +'%M%S')$(((RANDOM + 100) % 100 + 1))"
+SCALE_SET_NAMESPACE="arc-runners"
+WORKFLOW_FILE="arc-test-workflow.yaml"
+ARC_NAME="arc"
+ARC_NAMESPACE="arc-systems"
+
+function install_arc() {
+    echo "Installing ARC"
+    helm install "${ARC_NAME}" \
+        --namespace "${ARC_NAMESPACE}" \
+        --create-namespace \
+        --set controller.manager.container.image="${IMAGE_NAME}:${IMAGE_TAG}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-controller-experimental" \
+        --debug
+
+    if ! NAME="${ARC_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_arc; then
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        return 1
+    fi
+}
+
+function install_scale_set() {
+    echo "Installing scale set ${SCALE_SET_NAMESPACE}/${SCALE_SET_NAME}"
+    helm install "${SCALE_SET_NAME}" \
+        --namespace "${SCALE_SET_NAMESPACE}" \
+        --create-namespace \
+        --set controllerServiceAccount.name="${ARC_NAME}-gha-rs-controller" \
+        --set controllerServiceAccount.namespace="${ARC_NAMESPACE}" \
+        --set auth.url="https://github.com/${TARGET_ORG}/${TARGET_REPO}" \
+        --set auth.githubToken="${GITHUB_TOKEN}" \
+        "${ROOT_DIR}/charts/gha-runner-scale-set-experimental" \
+        --version="${VERSION}"
+
+    if ! NAME="${SCALE_SET_NAME}" NAMESPACE="${ARC_NAMESPACE}" wait_for_scale_set; then
+        NAMESPACE="${ARC_NAMESPACE}" log_arc
+        return 1
+    fi
+}
+
+function main() {
+    local failed=()
+
+    build_image
+    create_cluster
+
+    install_arc
+    install_scale_set
+
+    WORKFLOW_FILE="${WORKFLOW_FILE}" SCALE_SET_NAME="${SCALE_SET_NAME}" run_workflow || failed+=("run_workflow")
+
+    INSTALLATION_NAME="${SCALE_SET_NAME}" NAMESPACE="${SCALE_SET_NAMESPACE}" cleanup_scale_set || failed+=("cleanup_scale_set")
+
+    NAMESPACE="${ARC_NAMESPACE}" log_arc || failed+=("log_arc")
+
+    delete_cluster
+
+    print_results "${failed[@]}"
+}
+
+main
```

---

### Incident Patch 10: `b9eaf560` (2026-09-15)
**Commit Message**: Switch the scale set off instead of rebuilding it when runners are outdated (#4652)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `controllers/actions.github.com/autoscalingrunnerset_controller.go` (modified, +101/-80)
```diff
@@ -163,56 +163,8 @@ func (r *AutoscalingRunnerSetReconciler) Reconcile(ctx context.Context, req ctrl
 		}
 	}
 
-	outdated := autoscalingRunnerSet.Status.Phase == v1alpha1.AutoscalingRunnerSetPhaseOutdated
-	if outdated {
-		log.Info("Autoscaling runner set is in outdated phase, removing the listener")
-		done, err := r.cleanupListener(ctx, &autoscalingRunnerSet, log)
-		if err != nil {
-			log.Error(err, "Failed to clean up listener")
-			return ctrl.Result{}, err
-		}
-		if !done {
-			log.Info("Waiting for listener to be cleaned up for the outdated runner set")
-			return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
-		}
-
-		var ephemeralRunnerSet v1alpha1.EphemeralRunnerSet
-		err = r.Get(
-			ctx,
-			types.NamespacedName{
-				Namespace: autoscalingRunnerSet.Namespace,
-				Name:      autoscalingRunnerSet.Name,
-			},
-			&ephemeralRunnerSet,
-		)
-		switch {
-		case kerrors.IsNotFound(err):
-			// If the ephemeral runner set is not found, something removed the ephemeral runner set. The ephemeral runner set should
-			// not be removed by the controller once it is outdated. However, if the ephemeral runner set is removed, it means no ephemeral
-			// runners should be running (or at least no ephemeral runners associated with the ephemeral runner set).
-			// Therefore, this state is acceptable, because the update to the autoscaling runner set will trigger the loop
-			// that will eventually create a new ephemeral runner set.
-			log.Info("Ephemeral runner set is not found. Ignoring the state until the autoscaling runner set is updated")
-			return ctrl.Result{}, nil
-		case err != nil:
-			log.Error(err, "Failed to get ephemeral runner set for the outdated runner set")
-			return ctrl.Result{}, err
-		default:
-			if !ephemeralRunnerSet.DeletionTimestamp.IsZero() {
-				// Same as NotFound case, ignore.
-				return ctrl.Result{}, nil
-			}
-
-			original := ephemeralRunnerSet.DeepCopy()
-			ephemeralRunnerSet.Spec.Replicas = 0
-			ephemeralRunnerSet.Spec.PatchID = 0
-			if err := r.Patch(ctx, &ephemeralRunnerSet, client.MergeFrom(original)); err != nil {
-				log.Error(err, "Failed to patch ephemeral runner set with 0 replicas and reset patch ID for the outdated runner set")
-				return ctrl.Result{}, err
-			}
-
-			return ctrl.Result{}, nil
-		}
+	if autoscalingRunnerSet.Status.Phase == v1alpha1.AutoscalingRunnerSetPhaseOutdated {
+		return r.reconcileOutdated(ctx, &autoscalingRunnerSet, log)
 	}
 
 	if shouldCreateScaleSet(&autoscalingRunnerSet) {
@@ -250,38 +202,28 @@ func (r *AutoscalingRunnerSetReconciler) Reconcile(ctx context.Context, req ctrl
 	case err != nil:
 		log.Error(err, "Failed to get ephemeral runner")
 		return ctrl.Result{}, err
-	case ephemeralRunnerSetOutdatedForAppliedRevision(&ephemeralRunnerSet) && autoscalingRunnerSet.Status.Phase == v1alpha1.AutoscalingRunnerSetPhaseRunning:
-		// Runners are outdated. We need to stop the listener so it stops getting new jobs.
-		log.Info("Ephemeral runner set is outdated. Cleaning up resources for the outdated runner set")
-		done, err := r.cleanupListener(ctx, &autoscalingRunnerSet, log)
-		if err != nil {
-			log.Error(err, "Failed to clean up listener for outdated ephemeral runner set")
-			return ctrl.Result{}, err
-		}
-		if !done {
-			log.Info("Waiting for listener to be cleaned up for the outdated ephemeral runner set")
-			return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
-		}
-
-		// Then, we need to remove the ephemeral runner set to force scale-down. The ephemeral runner set
-		// will eventually remove all runners as soon as possible.
-		//
-		// The scale set should not be removed yet, since user did not explicitly remove the scale set (or the autoscaling runner set)
-		// Therefore, the autoscaling runner set should stay in outdated state until the spec is updated,
-		// or until the autoscaling runner set is removed.
-		done, err = r.cleanupEphemeralRunnerSet(ctx, &autoscalingRunnerSet, log)
-		if err != nil {
-			log.Error(err, "Failed to clean up ephemeral runner set for outdated runner set")
+	case ephemeralRunnerSetOutdatedForAppliedRevision(&ephemeralRunnerSet) &&
+		!ephemeralRunnerSetNeedsOutdatedRecovery(&ephemeralRunnerSet, &autoscalingRunnerSet):
+		// The runners rejected the spec they were given, so the scale set has to
+		// stop acquiring jobs it cannot run. Record that in the phase first: it is
+		// what keeps the listener switched off across reconciles, and what stops
+		// the branches below from rebuilding it. This also covers Pending during a
+		// metadata-only listener rebuild; only an unobserved spec generation is a
+		// recovery signal. The observed generation is carried over unchanged, so a
+		// spec update still registers as new work.
+		log.Info("Ephemeral runner set is outdated. Moving the autoscaling runner set to the outdated phase")
+		if err := r.updateStatus(
+			ctx,
+			&autoscalingRunnerSet,
+			v1alpha1.AutoscalingRunnerSetPhaseOutdated,
+			autoscalingRunnerSet.Status.Obser
```

**File**: `controllers/actions.github.com/autoscalingrunnerset_controller_test.go` (modified, +323/-0)
```diff
@@ -25,6 +25,7 @@ import (
 	"k8s.io/apimachinery/pkg/api/errors"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/apimachinery/pkg/watch"
 
 	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
 	"github.com/actions/actions-runner-controller/build"
@@ -2854,3 +2855,325 @@ func unblockDeletion(listener *v1alpha1.AutoscalingListener) {
 	}
 	Expect(k8sClient.Patch(context.Background(), current, client.MergeFrom(original))).To(Succeed(), "failed to remove the test finalizer from the listener")
 }
+
+var _ = Describe("Test AutoscalingRunnerSet outdated lifecycle", Ordered, func() {
+	var originalBuildVersion string
+	buildVersion := "0.1.0"
+
+	BeforeAll(func() {
+		originalBuildVersion = build.Version
+		build.Version = buildVersion
+	})
+
+	AfterAll(func() {
+		build.Version = originalBuildVersion
+	})
+
+	Context("When the runners reject the runner spec they were given", func() {
+		var ctx context.Context
+		var mgr ctrl.Manager
+		var autoscalingNS *corev1.Namespace
+		var autoscalingRunnerSet *v1alpha1.AutoscalingRunnerSet
+
+		ephemeralRunnerSetKey := func() client.ObjectKey {
+			return client.ObjectKey{Name: autoscalingRunnerSet.Name, Namespace: autoscalingRunnerSet.Namespace}
+		}
+
+		listenerKey := func() client.ObjectKey {
+			return client.ObjectKey{Name: scaleSetListenerName(autoscalingRunnerSet), Namespace: autoscalingRunnerSet.Namespace}
+		}
+
+		getEphemeralRunnerSet := func() *v1alpha1.EphemeralRunnerSet {
+			GinkgoHelper()
+
+			runnerSet := new(v1alpha1.EphemeralRunnerSet)
+			Expect(k8sClient.Get(ctx, ephemeralRunnerSetKey(), runnerSet)).To(Succeed(), "failed to get the ephemeral runner set")
+			return runnerSet
+		}
+
+		autoscalingRunnerSetPhase := func() (v1alpha1.AutoscalingRunnerSetPhase, error) {
+			updated := new(v1alpha1.AutoscalingRunnerSet)
+			if err := k8sClient.Get(ctx, client.ObjectKeyFromObject(autoscalingRunnerSet), updated); err != nil {
+				return "", err
+			}
+			return v1alpha1.AutoscalingRunnerSetPhase(updated.Status.Phase), nil
+		}
+
+		// markRunnersOutdated stands in for the EphemeralRunnerSet controller
+		// reporting that the runners it created rejected the runner spec. The
+		// applied revision is moved up to the spec revision because that is the
+		// state the report is only meaningful in: the set is running the spec it
+		// is complaining about.
+		markRunnersOutdated := func() {
+			GinkgoHelper()
+
+			runnerSet := getEphemeralRunnerSet()
+			original := runnerSet.DeepCopy()
+			runnerSet.Spec.Replicas = 3
+			runnerSet.Spec.PatchID = 7
+			Expect(k8sClient.Patch(ctx, runnerSet, client.MergeFrom(original))).To(Succeed(), "failed to seed a nonzero ephemeral runner set")
+
+			runnerSet = getEphemeralRunnerSet()
+			original = runnerSet.DeepCopy()
+			runnerSet.Status.Phase = v1alpha1.EphemeralRunnerSetPhaseOutdated
+			runnerSet.Status.AppliedActionableRevision = runnerSet.Spec.ActionableRevision
+			Expect(k8sClient.Status().Patch(ctx, runnerSet, client.MergeFrom(original))).To(Succeed(), "failed to mark the ephemeral runner set outdated")
+		}
+
+		expectSwitchedOff := func() int64 {
+			GinkgoHelper()
+
+			Eventually(autoscalingRunnerSetPhase, autoscalingRunnerSetTestTimeout, autoscalingRunnerSetTestInterval).
+				Should(BeEquivalentTo(v1alpha1.AutoscalingRunnerSetPhaseOutdated), "the autoscaling runner set should report the outdated phase")
+
+			Eventually(
+				func() bool {
+					return errors.IsNotFound(k8sClient.Get(ctx, listenerKey(), new(v1alpha1.AutoscalingListener)))
+				},
+				autoscalingRunnerSetTestTimeout,
+				autoscalingRunnerSetTestInterval,
+			).Should(BeTrue(), "the listener should be removed so no further jobs are acquired")
+
+			// The set is kept, not deleted: deleting it would make the controller
+			// rebuild it from the same rejected spec on the very next reconcile.
+			var runnerSet *v1alpha1.EphemeralRunnerSet
+			Eventually(
+				func() (bool, error) {
+					runnerSet = new(v1alpha1.EphemeralRunnerSet)
+					if err := k8sClient.Get(ctx, ephemeralRunnerSetKey(), runnerSet); err != nil {
+						return false, err
+					}
+					return runnerSet.Spec.Replicas == 0 && runnerSet.Spec.PatchID == 0, nil
+				},
+				autoscalingRunnerSetTestTimeout,
+				autoscalingRunnerSetTestInterval,
+			).Should(BeTrue(), "the ephemeral runner set should be held at zero replicas")
+
+			Consistently(
+				func() error {
+					return k8sClient.Get(ctx, ephemeralRunnerSetKey(), new(v1alpha1.EphemeralRunnerSet))
+				},
+				2*time.Second,
+				autoscalingRunnerSetTestInterval,
+			).Should(Succeed(), "the ephemeral runner set should not be deleted while the scale set is outdated")
+
+			return runnerSet.Spec.ActionableRevision
+		}
+
+		expectRecovered := func(outdatedRevision int64) {
+			GinkgoHelper()
+
+			Eventually(
+				func() (int64, error) {
+					runnerSet := new(v1alpha1.EphemeralRunnerSet)
+					if err := k8sClient.Get(ctx, ephemeralRunnerSetKey(), runn
```

**File**: `controllers/actions.github.com/autoscalingrunnerset_outdated_recovery_test.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+/*
+Copyright 2026 The actions-runner-controller authors.
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
+package actionsgithubcom
+
+import (
+	"context"
+	"strconv"
+	"testing"
+
+	"github.com/go-logr/logr"
+	"github.com/stretchr/testify/require"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	ctrl "sigs.k8s.io/controller-runtime"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+
+	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
+	"github.com/actions/actions-runner-controller/build"
+)
+
+func TestAutoscalingRunnerSetParksFirstRejectionOfPublishedGeneration(t *testing.T) {
+	scheme := runtime.NewScheme()
+	require.NoError(t, corev1.AddToScheme(scheme))
+	require.NoError(t, v1alpha1.AddToScheme(scheme))
+
+	const (
+		name       = "test"
+		namespace  = "test"
+		generation = int64(2)
+		revision   = int64(1)
+	)
+	template := corev1.PodTemplateSpec{
+		Spec: corev1.PodSpec{
+			Containers: []corev1.Container{{Name: "runner", Image: "runner:new"}},
+		},
+	}
+	autoscalingRunnerSet := &v1alpha1.AutoscalingRunnerSet{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:       name,
+			Namespace:  namespace,
+			Generation: generation,
+			Finalizers: []string{autoscalingRunnerSetFinalizerName},
+			Labels:     map[string]string{LabelKeyKubernetesVersion: build.Version},
+			Annotations: map[string]string{
+				runnerScaleSetIDAnnotationKey:         "1",
+				AnnotationKeyGitHubRunnerGroupName:    "group",
+				AnnotationKeyGitHubRunnerScaleSetName: name,
+			},
+		},
+		Spec: v1alpha1.AutoscalingRunnerSetSpec{
+			GitHubConfigUrl: "https://github.com/owner/repo",
+			Template:        template,
+		},
+		Status: v1alpha1.AutoscalingRunnerSetStatus{
+			Phase:              v1alpha1.AutoscalingRunnerSetPhasePending,
+			ObservedGeneration: generation - 1,
+		},
+	}
+	ephemeralRunnerSet := &v1alpha1.EphemeralRunnerSet{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      name,
+			Namespace: namespace,
+			Annotations: map[string]string{
+				AnnotationKeyAutoscalingRunnerSetGeneration: strconv.FormatInt(generation, 10),
+			},
+		},
+		Spec: v1alpha1.EphemeralRunnerSetSpec{
+			Replicas:           3,
+			PatchID:            7,
+			ActionableRevision: revision,
+			EphemeralRunnerSpec: v1alpha1.EphemeralRunnerSpec{
+				RunnerScaleSetID: 1,
+				GitHubConfigURL:  autoscalingRunnerSet.Spec.GitHubConfigUrl,
+				PodTemplateSpec:  template,
+			},
+		},
+		Status: v1alpha1.EphemeralRunnerSetStatus{
+			Phase:                     v1alpha1.EphemeralRunnerSetPhaseOutdated,
+			AppliedActionableRevision: revision,
+		},
+	}
+
+	c := fake.NewClientBuilder().
+		WithScheme(scheme).
+		WithStatusSubresource(autoscalingRunnerSet, ephemeralRunnerSet).
+		WithObjects(autoscalingRunnerSet, ephemeralRunnerSet).
+		Build()
+	resourceCache := NewResourceCache()
+	reconciler := &AutoscalingRunnerSetReconciler{
+		Client:              c,
+		Scheme:              scheme,
+		Log:                 logr.Discard(),
+		ControllerNamespace: namespace,
+		ResourceBuilder: ResourceBuilder{
+			ResourceCache: &resourceCache,
+			Scheme:        scheme,
+		},
+	}
+
+	_, err := reconciler.Reconcile(context.Background(), ctrl.Request{
+		NamespacedName: types.NamespacedName{Name: name, Namespace: namespace},
+	})
+	require.NoError(t, err)
+
+	gotARS := new(v1alpha1.AutoscalingRunnerSet)
+	require.NoError(t, c.Get(context.Background(), types.NamespacedName{Name: name, Namespace: namespace}, gotARS))
+	require.Equal(t, v1alpha1.AutoscalingRunnerSetPhaseOutdated, gotARS.Status.Phase)
+
+	gotERS := new(v1alpha1.EphemeralRunnerSet)
+	require.NoError(t, c.Get(context.Background(), types.NamespacedName{Name: name, Namespace: namespace}, gotERS))
+	require.Equal(t, revision, gotERS.Spec.ActionableRevision)
+	require.Zero(t, gotERS.Spec.Replicas)
+	require.Zero(t, gotERS.Spec.PatchID)
+}
```

**File**: `controllers/actions.github.com/constants.go` (modified, +5/-0)
```diff
@@ -50,6 +50,11 @@ const (
 	AnnotationKeyGitHubRunnerGroupName    = "actions.github.com/runner-group-name"
 	AnnotationKeyGitHubRunnerScaleSetName = "actions.github.com/runner-scale-set-name"
 	AnnotationKeyPatchID                  = "actions.github.com/patch-id"
+	// AnnotationKeyAutoscalingRunnerSetGeneration records the AutoscalingRunnerSet
+	// generation that published the current EphemeralRunnerSet actionable
+	// revision. It prevents a rejected revision from being retried more than once
+	// for the same AutoscalingRunnerSet spec update.
+	AnnotationKeyAutoscalingRunnerSetGeneration = "actions.github.com/autoscaling-runner-set-generation"
 	// AnnotationKeyActionableRevision records the EphemeralRunnerSet
 	// Spec.ActionableRevision that was in effect when the runner was created. It
 	// lets the set tell apart a runner that reported Outdated against the current
```

**File**: `controllers/actions.github.com/helpers.go` (modified, +20/-0)
```diff
@@ -1,11 +1,31 @@
 package actionsgithubcom
 
 import (
+	"strconv"
+
 	"github.com/actions/actions-runner-controller/apis/actions.github.com/v1alpha1"
 	corev1 "k8s.io/api/core/v1"
 	apiequality "k8s.io/apimachinery/pkg/api/equality"
 )
 
+func ephemeralRunnerSetNeedsOutdatedRecovery(ephemeralRunnerSet *v1alpha1.EphemeralRunnerSet, autoscalingRunnerSet *v1alpha1.AutoscalingRunnerSet) bool {
+	if ephemeralRunnerSet == nil || autoscalingRunnerSet == nil ||
+		autoscalingRunnerSet.Generation <= autoscalingRunnerSet.Status.ObservedGeneration {
+		return false
+	}
+
+	publishedGeneration, err := strconv.ParseInt(
+		ephemeralRunnerSet.Annotations[AnnotationKeyAutoscalingRunnerSetGeneration],
+		10,
+		64,
+	)
+	if err != nil {
+		return true
+	}
+
+	return publishedGeneration < autoscalingRunnerSet.Generation
+}
+
 // ephemeralRunnerSetActionableSpecChanged reports whether the runner spec the
 // EphemeralRunnerSet is running differs from the one derived from the
 // AutoscalingRunnerSet, in a way that requires re-applying it to the runners.
```

**File**: `controllers/actions.github.com/resourcebuilder.go` (modified, +3/-2)
```diff
@@ -770,8 +770,9 @@ func (b *ResourceBuilder) newEphemeralRunnerSet(autoscalingRunnerSet *v1alpha1.A
 	}
 
 	annotations := map[string]string{
-		AnnotationKeyGitHubRunnerGroupName:    autoscalingRunnerSet.Annotations[AnnotationKeyGitHubRunnerGroupName],
-		AnnotationKeyGitHubRunnerScaleSetName: autoscalingRunnerSet.Annotations[AnnotationKeyGitHubRunnerScaleSetName],
+		AnnotationKeyGitHubRunnerGroupName:          autoscalingRunnerSet.Annotations[AnnotationKeyGitHubRunnerGroupName],
+		AnnotationKeyGitHubRunnerScaleSetName:       autoscalingRunnerSet.Annotations[AnnotationKeyGitHubRunnerScaleSetName],
+		AnnotationKeyAutoscalingRunnerSetGeneration: strconv.FormatInt(autoscalingRunnerSet.Generation, 10),
 	}
 
 	if autoscalingRunnerSet.Spec.EphemeralRunnerSetMetadata != nil {
```

**File**: `controllers/actions.github.com/resourcebuilder_test.go` (modified, +4/-2)
```diff
@@ -16,8 +16,9 @@ import (
 func TestMetadataPropagation(t *testing.T) {
 	autoscalingRunnerSet := v1alpha1.AutoscalingRunnerSet{
 		ObjectMeta: metav1.ObjectMeta{
-			Name:      "test-scale-set",
-			Namespace: "test-ns",
+			Name:       "test-scale-set",
+			Namespace:  "test-ns",
+			Generation: 7,
 			Labels: map[string]string{
 				LabelKeyKubernetesPartOf:          labelValueKubernetesPartOf,
 				LabelKeyKubernetesVersion:         "0.2.0",
@@ -123,6 +124,7 @@ func TestMetadataPropagation(t *testing.T) {
 	assert.Equal(t, "repo", ephemeralRunnerSet.Labels[LabelKeyGitHubRepository])
 	assert.Equal(t, autoscalingRunnerSet.Annotations[AnnotationKeyGitHubRunnerGroupName], ephemeralRunnerSet.Annotations[AnnotationKeyGitHubRunnerGroupName])
 	assert.Equal(t, autoscalingRunnerSet.Annotations[AnnotationKeyGitHubRunnerScaleSetName], ephemeralRunnerSet.Annotations[AnnotationKeyGitHubRunnerScaleSetName])
+	assert.Equal(t, "7", ephemeralRunnerSet.Annotations[AnnotationKeyAutoscalingRunnerSetGeneration])
 	assert.Equal(t, autoscalingRunnerSet.Labels["arbitrary-label"], ephemeralRunnerSet.Labels["arbitrary-label"])
 	assert.Equal(t, "ephemeral-runner-set-label", ephemeralRunnerSet.Labels["test.com/ephemeral-runner-set-label"])
 	assert.Equal(t, "ephemeral-runner-set-annotation", ephemeralRunnerSet.Annotations["test.com/ephemeral-runner-set-annotation"])
```

---

### Incident Patch 11: `c475023e` (2026-09-10)
**Commit Message**: Fix EphemeralRunnerSet metadata drift check comparing against the wrong value (#4634)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>
Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `controllers/actions.github.com/autoscalingrunnerset_controller.go` (modified, +10/-4)
```diff
@@ -310,14 +310,20 @@ func (r *AutoscalingRunnerSetReconciler) Reconcile(ctx context.Context, req ctrl
 			return ctrl.Result{}, nil
 		}
 
+		// Merge rather than overwrite so annotations/labels applied by other
+		// controllers or users are preserved. Compare against the merge result so
+		// foreign keys do not make this permanently report "modified".
+		desiredLabels := r.filterAndMergeLabels(ephemeralRunnerSet.Labels, desired.Labels)
+		desiredAnnotations := r.mergeAnnotations(ephemeralRunnerSet.Annotations, desired.Annotations)
+
 		ephemeralRunnerMetadataModified := !cmp.Equal(ephemeralRunnerSet.Spec.EphemeralRunnerMetadata, desired.Spec.EphemeralRunnerMetadata)
-		ephemeralRunnerLabelsModified := !maps.Equal(ephemeralRunnerSet.Labels, desired.Labels)
-		ephemeralRunnerAnnotationsModified := !maps.Equal(ephemeralRunnerSet.Annotations, desired.Annotations)
+		ephemeralRunnerLabelsModified := !maps.Equal(ephemeralRunnerSet.Labels, desiredLabels)
+		ephemeralRunnerAnnotationsModified := !maps.Equal(ephemeralRunnerSet.Annotations, desiredAnnotations)
 
 		if ephemeralRunnerLabelsModified || ephemeralRunnerAnnotationsModified || ephemeralRunnerMetadataModified {
 			original := ephemeralRunnerSet.DeepCopy()
-			ephemeralRunnerSet.Labels = r.filterAndMergeLabels(ephemeralRunnerSet.Labels, desired.Labels)
-			ephemeralRunnerSet.Annotations = r.mergeAnnotations(ephemeralRunnerSet.Annotations, desired.Annotations)
+			ephemeralRunnerSet.Labels = desiredLabels
+			ephemeralRunnerSet.Annotations = desiredAnnotations
 			ephemeralRunnerSet.Spec.EphemeralRunnerMetadata = desired.Spec.EphemeralRunnerMetadata
 			log.Info("Updating ephemeral runner set metadata to match desired labels and annotations")
 			if err := r.Patch(ctx, &ephemeralRunnerSet, client.MergeFrom(original)); err != nil {
```

**File**: `controllers/actions.github.com/autoscalingrunnerset_controller_test.go` (modified, +69/-0)
```diff
@@ -665,6 +665,75 @@ var _ = Describe("Test AutoScalingRunnerSet controller", Ordered, func() {
 			).Should(Succeed(), "EphemeralRunnerSet should be patched with annotation-only metadata drift")
 		})
 
+		It("preserves foreign annotations and labels on the EphemeralRunnerSet", func() {
+			runnerSet := new(v1alpha1.EphemeralRunnerSet)
+			Eventually(
+				func() (string, error) {
+					err := k8sClient.Get(ctx, client.ObjectKey{Name: autoscalingRunnerSet.Name, Namespace: autoscalingRunnerSet.Namespace}, runnerSet)
+					if err != nil {
+						return "", err
+					}
+					return runnerSet.Annotations["arc.test/metadata-annotation"], nil
+				},
+				autoscalingRunnerSetTestTimeout,
+				autoscalingRunnerSetTestInterval,
+			).Should(Equal("initial"), "EphemeralRunnerSet should start with the predefined annotation")
+
+			// Simulate a third party (admission webhook, another controller, a user)
+			// adding metadata the AutoscalingRunnerSet knows nothing about.
+			foreign := runnerSet.DeepCopy()
+			foreign.Annotations["thirdparty.example.com/injected"] = "keep-me"
+			foreign.Labels["thirdparty.example.com/injected"] = "keep-me"
+			err := k8sClient.Patch(ctx, foreign, client.MergeFrom(runnerSet))
+			Expect(err).NotTo(HaveOccurred(), "failed to inject foreign metadata on EphemeralRunnerSet")
+
+			// Force the controller through the metadata reconciliation path.
+			patched := autoscalingRunnerSet.DeepCopy()
+			patched.Spec.EphemeralRunnerSetMetadata.Annotations["arc.test/metadata-annotation"] = "updated"
+			err = k8sClient.Patch(ctx, patched, client.MergeFrom(autoscalingRunnerSet))
+			Expect(err).NotTo(HaveOccurred(), "failed to patch AutoScalingRunnerSet EphemeralRunnerSet metadata")
+
+			Eventually(
+				func(g Gomega) {
+					current := new(v1alpha1.EphemeralRunnerSet)
+					err := k8sClient.Get(ctx, client.ObjectKey{Name: autoscalingRunnerSet.Name, Namespace: autoscalingRunnerSet.Namespace}, current)
+					g.Expect(err).NotTo(HaveOccurred(), "failed to get EphemeralRunnerSet")
+					g.Expect(current.Annotations["arc.test/metadata-annotation"]).To(Equal("updated"))
+				},
+				autoscalingRunnerSetTestTimeout,
+				autoscalingRunnerSetTestInterval,
+			).Should(Succeed(), "desired annotation should still propagate")
+
+			// The foreign keys must survive, and the controller must be able to get
+			// past the metadata block. Before the fix the comparison was made
+			// against the unmerged desired metadata, so a foreign key made the
+			// block report "modified" on every reconcile and return early, which
+			// meant nothing after it — including listener reconciliation — ever
+			// ran again. Deleting the listener makes that stall observable.
+			listener := new(v1alpha1.AutoscalingListener)
+			Eventually(
+				func() error {
+					return k8sClient.Get(ctx, client.ObjectKey{Name: scaleSetListenerName(autoscalingRunnerSet), Namespace: autoscalingRunnerSet.Namespace}, listener)
+				},
+				autoscalingRunnerSetTestTimeout,
+				autoscalingRunnerSetTestInterval,
+			).Should(Succeed(), "listener should exist before deletion")
+			Expect(k8sClient.Delete(ctx, listener)).To(Succeed())
+			Eventually(
+				func(g Gomega) {
+					recreated := new(v1alpha1.AutoscalingListener)
+					g.Expect(k8sClient.Get(ctx, client.ObjectKey{Name: scaleSetListenerName(autoscalingRunnerSet), Namespace: autoscalingRunnerSet.Namespace}, recreated)).To(Succeed())
+
+					current := new(v1alpha1.EphemeralRunnerSet)
+					g.Expect(k8sClient.Get(ctx, client.ObjectKey{Name: autoscalingRunnerSet.Name, Namespace: autoscalingRunnerSet.Namespace}, current)).To(Succeed())
+					g.Expect(current.Annotations).To(HaveKeyWithValue("thirdparty.example.com/injected", "keep-me"), "foreign annotation must not be stripped")
+					g.Expect(current.Labels).To(HaveKeyWithValue("thirdparty.example.com/injected", "keep-me"), "foreign label must not be stripped")
+				},
+				autoscalingRunnerSetTestTimeout,
+				autoscalingRunnerSetTestInterval,
+			).Should(Succeed(), "reconciliation must converge past the metadata block instead of looping on it")
+		})
+
 		It("updates EphemeralRunnerSet runner metadata when only EphemeralRunner metadata changes", func() {
 			runnerSet := new(v1alpha1.EphemeralRunnerSet)
 			Eventually(
```

---

### Incident Patch 12: `22046a27` (2026-09-10)
**Commit Message**: Validate and coerce listener metadata at render time (#4640)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `charts/gha-runner-scale-set-experimental/templates/_helpers.tpl` (modified, +7/-0)
```diff
@@ -125,6 +125,13 @@ Validate every label and annotation map the chart can render onto resources it m
 {{- $runnerPod := index (.Values.runner | default dict) "pod" -}}
 {{- include "assert-map" (dict "value" $runnerPod "path" ".Values.runner.pod") -}}
 {{- include "validate-metadata" (dict "metadata" (index ($runnerPod | default dict) "metadata") "path" ".Values.runner.pod.metadata") -}}
+{{- $listener := .Values.listener | default dict -}}
+{{- if kindIs "map" $listener -}}
+{{- $listenerPod := index $listener "podTemplate" -}}
+{{- if kindIs "map" ($listenerPod | default dict) -}}
+{{- include "validate-metadata" (dict "metadata" (index ($listenerPod | default dict) "metadata") "path" ".Values.listener.podTemplate.metadata") -}}
+{{- end -}}
+{{- end -}}
 {{- end }}
 
 {{/*
```

**File**: `charts/gha-runner-scale-set-experimental/templates/_listener_template.tpl` (modified, +9/-2)
```diff
@@ -5,9 +5,16 @@
   {{- fail ".Values.listener.podTemplate must have at least metadata or spec defined" -}}
 {{- end -}}
 {{- with $metadata -}}
+{{- $out := omit . "labels" "annotations" -}}
+{{- with .labels -}}
+{{- $_ := set $out "labels" (fromYaml (include "string-map" .)) -}}
+{{- end -}}
+{{- with .annotations -}}
+{{- $_ := set $out "annotations" (fromYaml (include "string-map" .)) -}}
+{{- end -}}
 metadata:
-  {{- toYaml . | nindent 2 }}
-{{- end }}
+  {{- toYaml $out | nindent 2 }}
+{{ end }}
 {{- with $spec -}}
 spec:
   {{- $containers := (index . "containers" | default (list)) -}}
```

**File**: `charts/gha-runner-scale-set-experimental/tests/autoscaling_runner_set_metadata_validation_test.yaml` (modified, +52/-0)
```diff
@@ -162,6 +162,25 @@ tests:
       - failedTemplate:
           errorMessage: '.Values.resource.ephemeralRunner: must be a mapping, got string'
 
+  - it: should fail when a listener pod label value is invalid
+    set:
+      scaleset.name: "test"
+      auth.url: "https://github.com/org"
+      auth.githubToken: "gh_token12345"
+      controllerServiceAccount.name: "arc"
+      controllerServiceAccount.namespace: "arc-system"
+      listener:
+        podTemplate:
+          metadata:
+            labels:
+              purpose: "“true”"
+    release:
+      name: "test-name"
+      namespace: "test-namespace"
+    asserts:
+      - failedTemplate:
+          errorMessage: '.Values.listener.podTemplate.metadata.labels: invalid value "“true”" for label "purpose": a valid label value must be an empty string or consist of alphanumeric characters, ''-'', ''_'' or ''.'', and must start and end with an alphanumeric character'
+
   - it: should fail when a metadata value is a mapping instead of a scalar
     set:
       scaleset.name: "test"
@@ -202,3 +221,36 @@ tests:
       - equal:
           path: spec.template.metadata.labels["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.example.com/purpose"]
           value: "yes"
+
+  # A listener pod template carrying both metadata and spec used to render "true" and the
+  # following "spec:" key onto the same line, producing invalid YAML.
+  - it: should render listener metadata and spec together, coercing scalar values to strings
+    set:
+      scaleset.name: "test"
+      auth.url: "https://github.com/org"
+      auth.githubToken: "gh_token12345"
+      controllerServiceAccount.name: "arc"
+      controllerServiceAccount.namespace: "arc-system"
+      listener:
+        podTemplate:
+          metadata:
+            labels:
+              listener-bool: true
+            annotations:
+              listener-int: 11
+          spec:
+            containers:
+              - name: listener
+    release:
+      name: "test-name"
+      namespace: "test-namespace"
+    asserts:
+      - equal:
+          path: spec.listenerTemplate.metadata.labels.listener-bool
+          value: "true"
+      - equal:
+          path: spec.listenerTemplate.metadata.annotations.listener-int
+          value: "11"
+      - equal:
+          path: spec.listenerTemplate.spec.containers[0].name
+          value: "listener"
```

**File**: `charts/gha-runner-scale-set/templates/_helpers.tpl` (modified, +6/-0)
```diff
@@ -183,6 +183,12 @@ Validate every label and annotation map the chart can render onto resources it m
 {{- $templateMetadata = $templateMetadata | default dict -}}
 {{- include "gha-runner-scale-set.validateLabels" (dict "labels" (index $templateMetadata "labels") "path" ".Values.template.metadata.labels") -}}
 {{- include "gha-runner-scale-set.validateAnnotations" (dict "annotations" (index $templateMetadata "annotations") "path" ".Values.template.metadata.annotations") -}}
+{{- include "gha-runner-scale-set.assertMap" (dict "value" .Values.listenerTemplate "path" ".Values.listenerTemplate") -}}
+{{- $listenerMetadata := index (.Values.listenerTemplate | default dict) "metadata" -}}
+{{- include "gha-runner-scale-set.assertMap" (dict "value" $listenerMetadata "path" ".Values.listenerTemplate.metadata") -}}
+{{- $listenerMetadata = $listenerMetadata | default dict -}}
+{{- include "gha-runner-scale-set.validateLabels" (dict "labels" (index $listenerMetadata "labels") "path" ".Values.listenerTemplate.metadata.labels") -}}
+{{- include "gha-runner-scale-set.validateAnnotations" (dict "annotations" (index $listenerMetadata "annotations") "path" ".Values.listenerTemplate.metadata.annotations") -}}
 {{- include "gha-runner-scale-set.assertMap" (dict "value" .Values.resourceMeta "path" ".Values.resourceMeta") -}}
 {{- range $resource, $meta := (.Values.resourceMeta | default dict) }}
 {{- include "gha-runner-scale-set.assertMap" (dict "value" $meta "path" (printf ".Values.resourceMeta.%s" $resource)) -}}
```

**File**: `charts/gha-runner-scale-set/templates/autoscalingrunnerset.yaml` (modified, +16/-0)
```diff
@@ -161,7 +161,23 @@ spec:
 
   {{- with .Values.listenerTemplate }}
   listenerTemplate:
+    {{- with .metadata }}
+    metadata:
+      {{- with .labels }}
+      labels:
+        {{- include "gha-runner-scale-set.stringMap" . | nindent 8 }}
+      {{- end }}
+      {{- with .annotations }}
+      annotations:
+        {{- include "gha-runner-scale-set.stringMap" . | nindent 8 }}
+      {{- end }}
+      {{- with omit . "labels" "annotations" }}
+      {{- toYaml . | nindent 6 }}
+      {{- end }}
+    {{- end }}
+    {{- with omit . "metadata" }}
     {{- toYaml . | nindent 4}}
+    {{- end }}
   {{- end }}
 
   {{- with .Values.listenerMetrics }}
```

**File**: `charts/gha-runner-scale-set/tests/template_test.go` (modified, +92/-51)
```diff
@@ -3153,57 +3153,6 @@ func TestAutoscalingRunnerSetCustomAnnotationsAndLabelsApplied(t *testing.T) {
 	assert.NotEqual(t, "not-propagated", autoscalingRunnerSet.Labels["app.kubernetes.io/component"])
 }
 
-func TestTemplateRenderedAutoScalingRunnerSet_ScalarMetadataValuesAreRenderedAsStrings(t *testing.T) {
-	t.Parallel()
-
-	helmChartPath, err := filepath.Abs("../../gha-runner-scale-set")
-	require.NoError(t, err)
-
-	testValuesPath, err := filepath.Abs("../tests/values_scalar_metadata.yaml")
-	require.NoError(t, err)
-
-	releaseName := "test-runners"
-	namespaceName := "test-" + strings.ToLower(random.UniqueID())
-
-	options := &helm.Options{
-		Logger:         logger.Discard,
-		ValuesFiles:    []string{testValuesPath},
-		KubectlOptions: k8s.NewKubectlOptions("", "", namespaceName),
-	}
-
-	// UnmarshalK8SYaml fails outright if a value decodes as a bool or number rather than a
-	// string, so a successful decode is itself part of the assertion.
-	output := helm.RenderTemplateContext(t, t.Context(), options, helmChartPath, releaseName, []string{"templates/autoscalingrunnerset.yaml"})
-
-	var autoscalingRunnerSet v1alpha1.AutoscalingRunnerSet
-	helm.UnmarshalK8SYaml(t, output, &autoscalingRunnerSet)
-
-	assert.Equal(t, "true", autoscalingRunnerSet.Labels["chart-bool"])
-	assert.Equal(t, "1", autoscalingRunnerSet.Labels["chart-int"])
-	assert.Equal(t, "false", autoscalingRunnerSet.Annotations["chart-bool-annotation"])
-	assert.Equal(t, "1.5", autoscalingRunnerSet.Annotations["chart-float-annotation"])
-	assert.Equal(t, "12345678901234", autoscalingRunnerSet.Annotations["chart-big-int-annotation"])
-
-	assert.Equal(t, "true", autoscalingRunnerSet.Spec.Template.Labels["pod-bool"])
-	assert.Equal(t, "42", autoscalingRunnerSet.Spec.Template.Labels["pod-int"])
-	assert.Equal(t, "true", autoscalingRunnerSet.Spec.Template.Annotations["pod-bool-annotation"])
-	assert.Equal(t, "7", autoscalingRunnerSet.Spec.Template.Annotations["pod-int-annotation"])
-
-	require.NotNil(t, autoscalingRunnerSet.Spec.EphemeralRunnerMetadata)
-	assert.Equal(t, "false", autoscalingRunnerSet.Spec.EphemeralRunnerMetadata.Labels["runner-bool"])
-	assert.Equal(t, "3", autoscalingRunnerSet.Spec.EphemeralRunnerMetadata.Labels["runner-int"])
-	assert.Equal(t, "9", autoscalingRunnerSet.Spec.EphemeralRunnerMetadata.Annotations["runner-int-annotation"])
-
-	output = helm.RenderTemplateContext(t, t.Context(), options, helmChartPath, releaseName, []string{"templates/githubsecret.yaml"})
-
-	var githubSecret corev1.Secret
-	helm.UnmarshalK8SYaml(t, output, &githubSecret)
-
-	assert.Equal(t, "5", githubSecret.Labels["secret-int"])
-	assert.Equal(t, "true", githubSecret.Labels["chart-bool"])
-	assert.Equal(t, "1.5", githubSecret.Annotations["chart-float-annotation"])
-}
-
 func TestTemplateRenderedAutoScalingRunnerSet_InvalidMetadataValidationError(t *testing.T) {
 	t.Parallel()
 
@@ -3308,6 +3257,66 @@ func TestTemplateRenderedAutoScalingRunnerSet_ValidMetadataIsAccepted(t *testing
 	assert.Equal(t, "any value is allowed: ✅", autoscalingRunnerSet.Spec.Template.Annotations["example.com/an"])
 }
 
+// Kubernetes only accepts string label and annotation values. Values supplied as unquoted
+// YAML scalars parse as bools/numbers, so the chart has to coerce them when rendering.
+// SetValues always yields strings, so this has to come from a values file to be meaningful.
+func TestTemplateRenderedAutoScalingRunnerSet_ScalarMetadataValuesAreRenderedAsStrings(t *testing.T) {
+	t.Parallel()
+
+	helmChartPath, err := filepath.Abs("../../gha-runner-scale-set")
+	require.NoError(t, err)
+
+	testValuesPath, err := filepath.Abs("../tests/values_scalar_metadata.yaml")
+	require.NoError(t, err)
+
+	releaseName := "test-runners"
+	namespaceName := "test-" + strings.ToLower(random.UniqueID())
+
+	options := &helm.Options{
+		Logger:         logger.Discard,
+		ValuesFiles:    []string{testValuesPath},
+		KubectlOptions: k8s.NewKubectlOptions("", "", namespaceName),
+	}
+
+	// UnmarshalK8SYaml fails outright if a value decodes as a bool or number rather than a
+	// string, so a successful decode is itself part of the assertion.
+	output := helm.RenderTemplateContext(t, t.Context(), options, helmChartPath, releaseName, []string{"templates/autoscalingrunnerset.yaml"})
+
+	var autoscalingRunnerSet v1alpha1.AutoscalingRunnerSet
+	helm.UnmarshalK8SYaml(t, output, &autoscalingRunnerSet)
+
+	assert.Equal(t, "true", autoscalingRunnerSet.Labels["chart-bool"])
+	assert.Equal(t, "1", autoscalingRunnerSet.Labels["chart-int"])
+	assert.Equal(t, "false", autoscalingRunnerSet.Annotations["chart-bool-annotation"])
+	assert.Equal(t, "1.5", autoscalingRunnerSet.Annotations["chart-float-annotation"])
+	assert.Equal(t, "12345678901234", autoscalingRunnerSet.Annotations["chart-big-int-annotation"])
+
+	assert.Equal(t, "true", autoscalingRunnerSet.Spec.Template.Labels["pod-bool"])
+	assert.Equal(t, "42", autoscalingRunnerSet.Spec.Template.Labels["pod-int"])
+	assert.Equal(t, "true", autosca
```

**File**: `charts/gha-runner-scale-set/tests/values_scalar_metadata.yaml` (modified, +10/-0)
```diff
@@ -37,3 +37,13 @@ resourceMeta:
   githubConfigSecret:
     labels:
       secret-int: 5
+
+listenerTemplate:
+  metadata:
+    labels:
+      listener-bool: true
+    annotations:
+      listener-int-annotation: 11
+  spec:
+    containers:
+      - name: listener
```

---

### Incident Patch 13: `adf7d002` (2026-09-10)
**Commit Message**: Validate label and annotation metadata at chart render time (#4639)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `charts/gha-runner-scale-set-experimental/templates/_helpers.tpl` (modified, +100/-0)
```diff
@@ -27,6 +27,106 @@ rendered as YAML booleans or numbers.
 {{- toYaml $out -}}
 {{- end }}
 
+{{/*
+Fail unless a value is absent or a mapping. Used to turn mis-typed metadata values into an
+error that names the values path, instead of an opaque "range can't iterate over" further
+down the render.
+Expects a dict with "value" and "path".
+*/}}
+{{- define "assert-map" -}}
+{{- $value := .value -}}
+{{- if and (not (kindIs "invalid" $value)) (not (kindIs "map" $value)) -}}
+{{- fail (printf "%s: must be a mapping, got %s" .path (kindOf $value)) -}}
+{{- end -}}
+{{- end }}
+
+{{/*
+Fail unless a metadata value is a scalar. A map or list would otherwise be flattened by the
+string coercion into Go's own formatting (`map[a:b]`), which is a syntactically valid but
+meaningless label or annotation, and a null would become "<nil>".
+Expects a dict with "value", "key", "kind" and "path".
+*/}}
+{{- define "assert-scalar" -}}
+{{- $value := .value -}}
+{{- if or (kindIs "map" $value) (kindIs "slice" $value) (kindIs "invalid" $value) -}}
+{{- fail (printf "%s: invalid value for %s %q: must be a scalar, got %s. Quote the value if it is meant to be a string" .path .kind .key (kindOf $value)) -}}
+{{- end -}}
+{{- end }}
+
+{{/*
+Validate a label or annotation key against the Kubernetes qualified name rules.
+Expects a dict with "key", "kind" (label|annotation) and "path" (the values path used in the error message).
+*/}}
+{{- define "validate-metadata-key" -}}
+{{- $key := .key -}}
+{{- $kind := .kind -}}
+{{- $path := .path -}}
+{{- $parts := splitList "/" $key -}}
+{{- $name := $key -}}
+{{- if gt (len $parts) 2 -}}
+{{- fail (printf "%s: invalid %s key %q: a qualified name must consist of an optional DNS subdomain prefix followed by a single '/'" $path $kind $key) -}}
+{{- end -}}
+{{- if eq (len $parts) 2 -}}
+{{- $prefix := index $parts 0 -}}
+{{- $name = index $parts 1 -}}
+{{- if gt (len $prefix) 253 -}}
+{{- fail (printf "%s: invalid %s key %q: the prefix %q must be a DNS subdomain of no more than 253 characters" $path $kind $key $prefix) -}}
+{{- end -}}
+{{- if not (regexMatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?([.][a-z0-9]([-a-z0-9]*[a-z0-9])?)*$" $prefix) -}}
+{{- fail (printf "%s: invalid %s key %q: the prefix %q must be a DNS subdomain, so it must consist of dot-separated segments of lowercase alphanumeric characters or '-', each starting and ending with an alphanumeric character" $path $kind $key $prefix) -}}
+{{- end -}}
+{{- end -}}
+{{- if or (eq $name "") (gt (len $name) 63) (not (regexMatch "^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$" $name)) -}}
+{{- fail (printf "%s: invalid %s key %q: the name part must be no more than 63 characters, consist of alphanumeric characters, '-', '_' or '.', and must start and end with an alphanumeric character" $path $kind $key) -}}
+{{- end -}}
+{{- end }}
+
+{{/*
+Validate a metadata block (dict with optional "labels" and "annotations").
+Invalid runner pod labels are only rejected once the controller creates the runner pod,
+which leaves the scale set without runners, so fail at render time instead.
+Expects a dict with "metadata" and "path".
+*/}}
+{{- define "validate-metadata" -}}
+{{- $path := .path -}}
+{{- include "assert-map" (dict "value" .metadata "path" $path) -}}
+{{- $metadata := .metadata | default dict -}}
+{{- $labels := index $metadata "labels" -}}
+{{- include "assert-map" (dict "value" $labels "path" (printf "%s.labels" $path)) -}}
+{{- range $key, $value := ($labels | default dict) -}}
+{{- include "validate-metadata-key" (dict "key" $key "kind" "label" "path" (printf "%s.labels" $path)) -}}
+{{- include "assert-scalar" (dict "value" $value "key" $key "kind" "label" "path" (printf "%s.labels" $path)) -}}
+{{- $rendered := include "metadata-value" $value -}}
+{{- if gt (len $rendered) 63 -}}
+{{- fail (printf "%s.labels: invalid value %q for label %q: a label value must be no more than 63 characters" $path $rendered $key) -}}
+{{- end -}}
+{{- if not (regexMatch "^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$" $rendered) -}}
+{{- fail (printf "%s.labels: invalid value %q for label %q: a valid label value must be an empty string or consist of alphanumeric characters, '-', '_' or '.', and must start and end with an alphanumeric character" $path $rendered $key) -}}
+{{- end -}}
+{{- end -}}
+{{- $annotations := index $metadata "annotations" -}}
+{{- include "assert-map" (dict "value" $annotations "path" (printf "%s.annotations" $path)) -}}
+{{- range $key, $value := ($annotations | default dict) -}}
+{{- include "validate-metadata-key" (dict "key" $key "kind" "annotation" "path" (printf "%s.annotations" $path)) -}}
+{{- include "assert-scalar" (dict "value" $value "key" $key "kind" "annotation" "path" (printf "%s.annotations" $path)) -}}
+{{- end -}}
+{{- end }}
+
+{{/*
+Validate every label and annotation map the chart can render onto resources it manages.
+*/}}
+{{- define "validate-all-metadata" -}}
+{{- include "assert-map" (dict "value" .Values.res
```

**File**: `charts/gha-runner-scale-set-experimental/templates/autoscalingrunnserset.yaml` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 {{- $runner := (.Values.runner | default dict) }}
+{{- include "validate-all-metadata" . }}
 {{- $runnerMode := (index $runner "mode" | default "") }}
 {{- $kubeMode := (index $runner "kubernetesMode" | default dict) }}
 {{- $dind := (index $runner "dind" | default dict) }}
```

**File**: `charts/gha-runner-scale-set-experimental/templates/githubsecret.yaml` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+{{- include "validate-all-metadata" . }}
 {{- $usesKubernetesSecrets := or (not .Values.secretResolution) (eq .Values.secretResolution.type "kubernetes") -}}
 
 {{- if and (not $usesKubernetesSecrets) (empty .Values.auth.secretName) -}}
```

**File**: `charts/gha-runner-scale-set-experimental/templates/hook_extension.yaml` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+{{- include "validate-all-metadata" . }}
 {{- $runner := (.Values.runner | default dict) -}}
 {{- $runnerMode := (index $runner "mode" | default "") -}}
 {{- $kubeMode := (index $runner "kubernetesMode" | default dict) -}}
```

**File**: `charts/gha-runner-scale-set-experimental/templates/kube_mode_role.yaml` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+{{- include "validate-all-metadata" . }}
 {{- $runner := (.Values.runner | default dict) -}}
 {{- $runnerMode := (index $runner "mode" | default "") -}}
 {{- $kubeMode := (index $runner "kubernetesMode" | default dict) -}}
```

**File**: `charts/gha-runner-scale-set-experimental/templates/kube_mode_role_binding.yaml` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+{{- include "validate-all-metadata" . }}
 {{- $runner := (.Values.runner | default dict) -}}
 {{- $runnerMode := (index $runner "mode" | default "") -}}
 {{- $kubeMode := (index $runner "kubernetesMode" | default dict) -}}
```

**File**: `charts/gha-runner-scale-set-experimental/templates/kube_mode_serviceaccount.yaml` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+{{- include "validate-all-metadata" . }}
 {{- $runner := (.Values.runner | default dict) -}}
 {{- $runnerMode := (index $runner "mode" | default "") -}}
 {{- $kubeMode := (index $runner "kubernetesMode" | default dict) -}}
```

**File**: `charts/gha-runner-scale-set-experimental/templates/manager_role.yaml` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+{{- include "validate-all-metadata" . }}
 apiVersion: rbac.authorization.k8s.io/v1
 kind: Role
 metadata:
```

---

### Incident Patch 14: `b0e69a37` (2026-09-10)
**Commit Message**: Render label and annotation values as strings (#4637)

Co-authored-by: Copilot App <[REDACTED_EMAIL]>
Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `charts/gha-runner-scale-set-experimental/templates/_autoscalingrunnerset.tpl` (modified, +2/-2)
```diff
@@ -32,11 +32,11 @@ Render a ResourceMeta block for AutoscalingRunnerSet spec fields.
 {{- define "autoscaling-runner-set.spec-resource-metadata" -}}
 {{- with .labels }}
 labels:
-  {{- toYaml . | nindent 2 }}
+  {{- include "string-map" . | nindent 2 }}
 {{- end }}
 {{- with .annotations }}
 annotations:
-  {{- toYaml . | nindent 2 }}
+  {{- include "string-map" . | nindent 2 }}
 {{- end }}
 {{- end }}
 
```

**File**: `charts/gha-runner-scale-set-experimental/templates/_helpers.tpl` (modified, +33/-2)
```diff
@@ -1,3 +1,32 @@
+{{/*
+Render a single label or annotation value as a string.
+Values from a values file arrive as float64, so "%v" would turn large integers into
+scientific notation (12345678901234 -> 1.2345678901234e+13) and silently write a value the
+user never asked for. Integral floats are therefore formatted without an exponent.
+*/}}
+{{- define "metadata-value" -}}
+{{- if eq . nil -}}
+{{- "" -}}
+{{- else if and (kindIs "float64" .) (eq . (floor .)) -}}
+{{- printf "%.0f" . -}}
+{{- else -}}
+{{- printf "%v" . -}}
+{{- end -}}
+{{- end }}
+
+{{/*
+Render a labels or annotations map with all values coerced to strings.
+Kubernetes only accepts string values, so scalars such as `true` or `1` must not be
+rendered as YAML booleans or numbers.
+*/}}
+{{- define "string-map" -}}
+{{- $out := dict -}}
+{{- range $k, $v := . -}}
+{{- $_ := set $out $k (include "metadata-value" $v) -}}
+{{- end -}}
+{{- toYaml $out -}}
+{{- end }}
+
 {{/*
 Create the labels for the GitHub auth secret.
 */}}
@@ -53,14 +82,16 @@ Reserved annotations are excluded from both levels.
 
 
 {{/*
-Takes a map of user labels and removes the ones with "actions.github.com/" prefix
+Takes a map of user labels and removes the ones with "actions.github.com/" prefix.
+Values are rendered as strings so that scalars such as `true` or `1.0` do not become
+non-string YAML values, which Kubernetes rejects for labels and annotations.
 */}}
 {{- define "apply-non-reserved-gha-labels-and-annotations" -}}
 {{- $userLabels := . -}}
 {{- $processed := dict -}}
 {{- range $key, $value := $userLabels -}}
   {{- if not (hasPrefix "actions.github.com/" $key) -}}
-    {{- $_ := set $processed $key $value -}}
+    {{- $_ := set $processed $key (include "metadata-value" $value) -}}
   {{- end -}}
 {{- end -}}
 {{- if not (empty $processed) -}}
```

**File**: `charts/gha-runner-scale-set/templates/_helpers.tpl` (modified, +31/-2)
```diff
@@ -54,17 +54,46 @@ app.kubernetes.io/name: {{ include "gha-runner-scale-set.scale-set-name" . }}
 app.kubernetes.io/instance: {{ include "gha-runner-scale-set.scale-set-name" . }}
 {{- end }}
 
+{{/*
+Render a single label or annotation value as a string.
+Values from a values file arrive as float64, so "%v" would turn large integers into
+scientific notation (12345678901234 -> 1.2345678901234e+13) and silently write a value the
+user never asked for. Integral floats are therefore formatted without an exponent.
+*/}}
+{{- define "gha-runner-scale-set.metadataValue" -}}
+{{- if eq . nil -}}
+{{- "" -}}
+{{- else if and (kindIs "float64" .) (eq . (floor .)) -}}
+{{- printf "%.0f" . -}}
+{{- else -}}
+{{- printf "%v" . -}}
+{{- end -}}
+{{- end }}
+
+{{/*
+Render a labels or annotations map with all values coerced to strings.
+Kubernetes only accepts string values, so scalars such as `true` or `1` must not be
+rendered as YAML booleans or numbers.
+*/}}
+{{- define "gha-runner-scale-set.stringMap" -}}
+{{- $out := dict -}}
+{{- range $k, $v := . -}}
+{{- $_ := set $out $k (include "gha-runner-scale-set.metadataValue" $v) -}}
+{{- end -}}
+{{- toYaml $out -}}
+{{- end }}
+
 {{/*
 Render a ResourceMeta block for AutoscalingRunnerSet spec fields.
 */}}
 {{- define "gha-runner-scale-set.resourceMetaSpec" -}}
 {{- with .labels }}
 labels:
-  {{- toYaml . | nindent 2 }}
+  {{- include "gha-runner-scale-set.stringMap" . | nindent 2 }}
 {{- end }}
 {{- with .annotations }}
 annotations:
-  {{- toYaml . | nindent 2 }}
+  {{- include "gha-runner-scale-set.stringMap" . | nindent 2 }}
 {{- end }}
 {{- end }}
 
```

**File**: `charts/gha-runner-scale-set/templates/autoscalingrunnerset.yaml` (modified, +6/-6)
```diff
@@ -19,15 +19,15 @@ metadata:
     {{- with .Values.labels }}
     {{- range $k, $v := . }}
     {{- if not (or (hasKey $reserved $k) (hasPrefix "actions.github.com/" $k)) }}
-    {{ $k }}: {{ $v | quote }}
+    {{ $k }}: {{ include "gha-runner-scale-set.metadataValue" $v | quote }}
     {{- end }}
     {{- end }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.autoscalingRunnerSet.labels }}
     {{- range $k, $v := . }}
     {{- if not (or (hasKey $reserved $k) (hasPrefix "actions.github.com/" $k)) }}
-    {{ $k }}: {{ $v | quote }}
+    {{ $k }}: {{ include "gha-runner-scale-set.metadataValue" $v | quote }}
     {{- end }}
     {{- end }}
     {{- end }}
@@ -38,15 +38,15 @@ metadata:
     {{- with .Values.annotations }}
     {{- range $k, $v := . }}
     {{- if not (or (hasPrefix "actions.github.com/cleanup-" $k) (eq $k "actions.github.com/values-hash")) }}
-    {{ $k }}: {{ $v | quote }}
+    {{ $k }}: {{ include "gha-runner-scale-set.metadataValue" $v | quote }}
     {{- end }}
     {{- end }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.autoscalingRunnerSet.annotations }}
     {{- range $k, $v := . }}
     {{- if not (or (hasPrefix "actions.github.com/cleanup-" $k) (eq $k "actions.github.com/values-hash")) }}
-    {{ $k }}: {{ $v | quote }}
+    {{ $k }}: {{ include "gha-runner-scale-set.metadataValue" $v | quote }}
     {{- end }}
     {{- end }}
     {{- end }}
@@ -218,11 +218,11 @@ spec:
     metadata:
       {{- with .labels }}
       labels:
-        {{- toYaml . | nindent 8 }}
+        {{- include "gha-runner-scale-set.stringMap" . | nindent 8 }}
       {{- end }}
       {{- with .annotations }}
       annotations:
-        {{- toYaml . | nindent 8 }}
+        {{- include "gha-runner-scale-set.stringMap" . | nindent 8 }}
       {{- end }}
     {{- end }}
     spec:
```

**File**: `charts/gha-runner-scale-set/templates/githubsecret.yaml` (modified, +4/-4)
```diff
@@ -12,23 +12,23 @@ metadata:
     {{- with .Values.labels }}
     {{- range $k, $v := . }}
     {{- if not (or (hasKey $reserved $k) (hasPrefix "actions.github.com/" $k)) }}
-    {{ $k }}: {{ $v | quote }}
+    {{ $k }}: {{ include "gha-runner-scale-set.metadataValue" $v | quote }}
     {{- end }}
     {{- end }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.githubConfigSecret.labels }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- end }}
     {{- include "gha-runner-scale-set.labels" . | nindent 4 }}
   annotations:
     {{- with .Values.annotations }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.githubConfigSecret.annotations }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- end }}
   finalizers:
```

**File**: `charts/gha-runner-scale-set/templates/kube_mode_role.yaml` (modified, +4/-4)
```diff
@@ -14,23 +14,23 @@ metadata:
     {{- with .Values.labels }}
     {{- range $k, $v := . }}
     {{- if not (or (hasKey $reserved $k) (hasPrefix "actions.github.com/" $k)) }}
-    {{ $k }}: {{ $v | quote }}
+    {{ $k }}: {{ include "gha-runner-scale-set.metadataValue" $v | quote }}
     {{- end }}
     {{- end }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.kubernetesModeRole.labels }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- end }}
     {{- include "gha-runner-scale-set.labels" . | nindent 4 }}
   annotations:
     {{- with .Values.annotations }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.kubernetesModeRole.annotations }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- end }}
   finalizers:
```

**File**: `charts/gha-runner-scale-set/templates/kube_mode_role_binding.yaml` (modified, +4/-4)
```diff
@@ -13,24 +13,24 @@ metadata:
     {{- with .Values.labels }}
     {{- range $k, $v := . }}
     {{- if not (or (hasKey $reserved $k) (hasPrefix "actions.github.com/" $k)) }}
-    {{ $k }}: {{ $v | quote }}
+    {{ $k }}: {{ include "gha-runner-scale-set.metadataValue" $v | quote }}
     {{- end }}
     {{- end }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.kubernetesModeRoleBinding.labels }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- end }}
     {{- include "gha-runner-scale-set.labels" . | nindent 4 }}
 
   annotations:
     {{- with .Values.annotations }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.kubernetesModeRoleBinding.annotations }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- end }}
   finalizers:
```

**File**: `charts/gha-runner-scale-set/templates/kube_mode_serviceaccount.yaml` (modified, +4/-4)
```diff
@@ -9,11 +9,11 @@ metadata:
   {{- if or .Values.annotations $hasCustomResourceMeta }}
   annotations:
     {{- with .Values.annotations }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.kubernetesModeServiceAccount.annotations }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- end }}
   {{- end }}
@@ -24,13 +24,13 @@ metadata:
     {{- with .Values.labels }}
     {{- range $k, $v := . }}
     {{- if not (or (hasKey $reserved $k) (hasPrefix "actions.github.com/" $k)) }}
-    {{ $k }}: {{ $v | quote }}
+    {{ $k }}: {{ include "gha-runner-scale-set.metadataValue" $v | quote }}
     {{- end }}
     {{- end }}
     {{- end }}
     {{- if $hasCustomResourceMeta }}
     {{- with .Values.resourceMeta.kubernetesModeServiceAccount.labels }}
-    {{- toYaml . | nindent 4 }}
+    {{- include "gha-runner-scale-set.stringMap" . | nindent 4 }}
     {{- end }}
     {{- end }}
     {{- include "gha-runner-scale-set.labels" . | nindent 4 }}
```

---

### Incident Patch 15: `c3dfb396` (2026-09-08)
**Commit Message**: Fix nil ResourceCache panic in stale scale set tests (#4628)

**File**: `controllers/actions.github.com/autoscalingrunnerset_controller_test.go` (modified, +3/-0)
```diff
@@ -2196,6 +2196,7 @@ var _ = Describe("Test AutoscalingRunnerSet with a stale runner scale set", Orde
 				ControllerNamespace:                autoscalingNS.Name,
 				DefaultRunnerScaleSetListenerImage: "ghcr.io/actions/arc",
 				ResourceBuilder: ResourceBuilder{
+					ResourceCache: newTestResourceCache(),
 					SecretResolver: secretresolver.New(mgr.GetClient(), scalefake.NewMultiClient(
 						scalefake.WithClient(
 							scalefake.NewClient(
@@ -2268,6 +2269,7 @@ var _ = Describe("Test AutoscalingRunnerSet with a stale runner scale set", Orde
 				ControllerNamespace:                autoscalingNS.Name,
 				DefaultRunnerScaleSetListenerImage: "ghcr.io/actions/arc",
 				ResourceBuilder: ResourceBuilder{
+					ResourceCache: newTestResourceCache(),
 					SecretResolver: secretresolver.New(mgr.GetClient(), scalefake.NewMultiClient(
 						scalefake.WithClient(
 							scalefake.NewClient(
@@ -2328,6 +2330,7 @@ var _ = Describe("Test AutoscalingRunnerSet with a stale runner scale set", Orde
 				ControllerNamespace:                autoscalingNS.Name,
 				DefaultRunnerScaleSetListenerImage: "ghcr.io/actions/arc",
 				ResourceBuilder: ResourceBuilder{
+					ResourceCache: newTestResourceCache(),
 					SecretResolver: secretresolver.New(mgr.GetClient(), scalefake.NewMultiClient(
 						scalefake.WithClient(
 							scalefake.NewClient(
```

#### Recent Merged Pull Requests:
- **PR #4701** (closed): Delay recreation of a listener pod that exited with a failure (@cnd-codeflow)
- **PR #4700** (closed): Requeue instead of erroring when the recreated AutoscalingListener already exists (@cnd-codeflow)
- **PR #4697** (2026-10-01): Prepare 0.15.0 release (@nikola-jokic)
- **PR #4696** (2026-09-30): Scale down runners whose pod never reports the runner container (@nikola-jokic)
- **PR #4695** (2026-09-29): Fix empty collection drift across scale-set resources (@nikola-jokic)
- **PR #4693** (2026-09-29): Fix custom runner mode volume injection (@nikola-jokic)
- **PR #4692** (2026-09-29): Reduce ephemeral runner status contention (@nikola-jokic)
- **PR #4691** (2026-09-29): Bump the gomod group with 4 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
