# Forensic Learning Record (Deep Inspection): argoproj/argo-events

> **Canonical Artifact**: `07_PROJECT_LEARNING/argoproj-argo-events-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/argoproj/argo-events](https://github.com/argoproj/argo-events))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:48:16.790Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `argoproj/argo-events`
- **Description**: Event-driven Automation Framework for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2696 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/commands/controller.go`
```
package commands

import (
	"github.com/spf13/cobra"

	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
	controllercmd "github.com/argoproj/argo-events/pkg/reconciler/cmd"
	"github.com/argoproj/argo-events/pkg/shared/logging"
	sharedutil "github.com/argoproj/argo-events/pkg/shared/util"
)

func NewControllerCommand() *cobra.Command {
	var (
		leaderElection   bool
		namespaced       bool
		managedNamespace string
		metricsPort      int32
		healthPort       int32
		klogLevel        int
	)

	command := &cobra.Command{
		Use:   "controller",
		Short: "Start the controller",
		Run: func(cmd *cobra.Command, args []string) {
			logging.SetKlogLevel(klogLevel)
			eventOpts := controllercmd.ArgoEventsControllerOpts{
				LeaderElection:   leaderElection,
				ManagedNamespace: managedNamespace,
				Namespaced:       namespaced,
				MetricsPort:      metricsPort,
				HealthPort:       healthPort,
			}
			controllercmd.Start(eventOpts)
		},
	}
	command.Flags().BoolVar(&namespaced, "namespaced", false, "Whether to run in namespaced scope, defaults to false.")
	command.Flags().StringVar(&managedNamespace, "managed-namespace", sharedutil.LookupEnvStringOr("NAMESPACE", "argo-events"), "The namespace that the controller watches when \"--namespaced\" is \"true\".")
	command.Flags().BoolVar(&leaderElection, "leader-election", true, "Enable leader election")
	command.Flags().Int32Var(&metricsPort, "metrics-port", v1alpha1.ControllerMetricsPort, "Metrics port")
	command.Flags().Int32Var(&healthPort, "health-port", v1alpha1.ControllerHealthPort, "Health port")
	command.Flags().IntVar(&klogLevel, "kloglevel", 0, "klog level")
	return command
}

```

### Core Architecture Module: `cmd/commands/eventsource.go`
```
package commands

import (
	"github.com/spf13/cobra"

	eventsourcecmd "github.com/argoproj/argo-events/pkg/eventsources/cmd"
)

func NewEventSourceCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "eventsource-service",
		Short: "Start an EventSource service",
		Run: func(cmd *cobra.Command, args []string) {
			eventsourcecmd.Start()
		},
	}
	return command
}

```

### Core Architecture Module: `cmd/commands/lint.go`
```
package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/yaml"

	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
	"github.com/argoproj/argo-events/pkg/client/clientset/versioned/scheme"
	eventsourcecontroller "github.com/argoproj/argo-events/pkg/reconciler/eventsource"
	sensorcontroller "github.com/argoproj/argo-events/pkg/reconciler/sensor"
)

func NewLintCommand() *cobra.Command {
	var (
		recursive bool
		strict    bool
	)

	command := &cobra.Command{
		Use:   "lint PATH...",
		Short: "Validate EventSource and Sensor resource files",
		Long: `Lint validates EventSource and Sensor resource files.
It performs the same validation checks that are done during resource creation and updates.

Examples:
  # Validate a single file
  argo-events lint event-source.yaml

  # Validate multiple files
  argo-events lint event-source.yaml sensor.yaml

  # Validate all YAML files in a directory
  argo-events lint examples/event-sources/

  # Validate all YAML files in a directory recursively
  argo-events lint -R examples/

  # Validate with strict mode (no warnings allowed)
  argo-events lint --strict event-source.yaml
`,
		Run: func(cmd *cobra.Command, args []string) {
			if len(args) == 0 {
				fmt.Println("Error: at least one path must be specified")
				os.Exit(1)
			}

			hasErrors := false
			hasWarnings := false

			for _, path := range args {
				if err := lintPath(path, recursive, &hasErrors, &hasWarnings); err != nil {
					fmt.Fprintf(os.Stderr, "Error processing path %s: %v\n", path, err)
					hasErrors = true
				}
			}

			if hasErrors {
				os.Exit(1)
			}
			if strict && hasWarnings {
				os.Exit(1)
			}
		},
	}

	command.Flags().BoolVarP(&recursive, "recursive", "R", false, "Process directories recursively")
	command.Flags().BoolVar(&strict, "strict", false, "Fail on warnings")

	return command
}

func lintPath(path string, recursive bool, hasErrors *bool, hasWarnings *bool) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return lintDirectory(path, recursive, hasErrors, hasWarnings)
	}

	return lintFile(path, hasErrors, hasWarnings)
}

func lintDirectory(dir string, recursive bool, hasErrors *bool, hasWarnings *bool) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		path := filepath.Join(dir, entry.Name())

		if entry.IsDir() {
			if recursive {
				if err := lintDirectory(path, recursive, hasErrors, hasWarnings); err != nil {
					return err
				}
			}
			continue
		}

		// Only process YAML files
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if ext == ".yaml" || ext == ".yml" {
			if err := lintFile(path, hasErrors, hasWarnings); err != nil {
				// Continue processing other files even if one fails
				*hasErrors = true
				fmt.Fprintf(os.Stderr, "Error processing file %s: %v\n", path, err)
			}
		}
	}

	return nil
}

func lintFile(filename string, hasErrors *bool, hasWarnings *bool) error {
	data, err := os.ReadFile(filename)
	if err != nil {
		return err
	}

	// Split the file by "---" to handle multiple YAML documents
	documents := strings.Split(string(data), "\n---\n")

	foundResource := false
	for i, doc := range documents {
		doc = strings.TrimSpace(doc)
		if doc == "" {
			continue
		}

		// Try to decode as unstructured to get the kind
		decoder := yaml.NewYAMLOrJSONDecoder(strings.NewReader(doc), 4096)
		var obj unstructured.Unstructured
		if err := decoder.Decode(&obj); err != nil {
			// Skip non-Kubernetes resources or invalid YAML
			continue
		}

		kind := obj.GetKind()
		if kind != "EventSource" && kind != "Sensor" {
			// Skip resources that are not EventSource or Sensor
			continue
		}

		foundResource = true
		docNum := ""
		if len(documents) > 1 {
			docNum = fmt.Sprintf(" (document %d)", i+1)
		}

		// Decode the document using the scheme
		runtimeObj, _, err := scheme.Codecs.UniversalDeserializer().Decode([]byte(doc), nil, nil)
		if err != nil {
			fmt.Printf("✗ %s%s: Failed to decode\n", filename, docNum)
			fmt.Printf("  Error: %v\n", err)
			*hasErrors = true
			continue
		}

		switch resource := runtimeObj.(type) {
		case *v1alpha1.EventSource:
			if err := lintEventSource(filename+docNum, resource, hasErrors, hasWarnings); err != nil {
				return err
			}
		case *v1alpha1.Sensor:
			if err := lintSensor(filename+docNum, resource, hasErrors, hasWarnings); err != nil {
				return err
			}
		default:
			// This shouldn't happen since we already filtered by kind
			continue
		}
	}

	if !foundResource {
		// Don't print anything for files that don't contain EventSource or Sensor
		return nil
	}

	return nil
}

func lintEventSource(filename string, eventSource *v1alpha1.EventSource, hasErrors *bool, hasWarnings *bool) error {
	if err := eventsourcecontroller.ValidateEventSource(eventSource); err != nil {
		fmt.Printf("✗ %s: EventSource validation failed\n", filename)
		fmt.Printf("  Error: %v\n", err)
		*hasErrors = true
	} else {
		fmt.Printf("✓ %s: EventSource is valid\n", filename)
	}
	return nil
}

func lintSensor(filename string, sensor *v1alpha1.Sensor, hasErrors *bool, hasWarnings *bool) error {
	// For sensor validation, we need an EventBus, but for linting purposes
	// we'll create a dummy one or skip EventBus-specific validation
	// We'll validate as much as we can without an actual EventBus

	// Create a minimal EventBus for validation
	// We use nil EventBus and check if the validation can proceed
	// The ValidateSensor function will report if EventBus is needed
	dummyEventBus := &v1alpha1.EventBus{
		Spec: v1alpha1.EventBusSpec{
			JetStream: &v1alpha1.JetStreamBus{}, // Provide a minimal valid spec
		},
	}

	if err := sensorcontroller.ValidateSensor(sensor, dummyEventBus); err != nil {
		// Check if the error is about EventBus being nil or missing
		errMsg := err.Error()
		if strings.Contains(errMsg, "eventbus") || strings.Contains(errMsg, "EventBus") {
			fmt.Printf("! %s: Sensor validation incomplete (EventBus not available)\n", filename)
			fmt.Printf("  Note: %v\n", err)
			*hasWarnings = true
		} else {
			fmt.Printf("✗ %s: Sensor validation failed\n", filename)
			fmt.Printf("  Error: %v\n", err)
			*hasErrors = true
		}
	} else {
		fmt.Printf("✓ %s: Sensor is valid\n", filename)
	}
	return nil
}

```

### Core Architecture Module: `cmd/commands/root.go`
```
package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "argo-events",
	Short: "Argo Events CLI",
	Run: func(cmd *cobra.Command, args []string) {
		cmd.HelpFunc()(cmd, args)
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(NewControllerCommand())
	rootCmd.AddCommand(NewEventSourceCommand())
	rootCmd.AddCommand(NewSensorCommand())
	rootCmd.AddCommand(NewWebhookCommand())
	rootCmd.AddCommand(NewLintCommand())
}

```

### Core Architecture Module: `cmd/commands/sensor.go`
```
package commands

import (
	"github.com/spf13/cobra"

	sensorcmd "github.com/argoproj/argo-events/pkg/sensors/cmd"
)

func NewSensorCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "sensor-service",
		Short: "Start a Sensor service",
		Run: func(cmd *cobra.Command, args []string) {
			sensorcmd.Start()
		},
	}
	return command
}

```

### Core Architecture Module: `cmd/commands/webhook.go`
```
package commands

import (
	"github.com/spf13/cobra"

	webhookcmd "github.com/argoproj/argo-events/pkg/webhook/cmd"
)

func NewWebhookCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "webhook-service",
		Short: "Start validating webhook server",
		Run: func(cmd *cobra.Command, args []string) {
			webhookcmd.Start()
		},
	}
	return command
}

```

### Core Architecture Module: `cmd/main.go`
```
package main

import (
	"github.com/argoproj/argo-events/cmd/commands"
)

func main() {
	commands.Execute()
}

```

### Core Architecture Module: `hack/crds.go`
```
package main

import (
	"os"

	"sigs.k8s.io/yaml"
)

type obj = map[string]interface{}

func cleanCRD(filename string) {
	data, err := os.ReadFile(filename)
	if err != nil {
		panic(err)
	}
	crd := make(map[string]interface{})
	err = yaml.Unmarshal(data, &crd)
	if err != nil {
		panic(err)
	}
	delete(crd, "status")
	metadata := crd["metadata"].(obj)
	if metadata["name"] == "eventbuses.argoproj.io" {
		metadata["name"] = "eventbus.argoproj.io"
	}
	delete(metadata, "annotations")
	delete(metadata, "creationTimestamp")
	spec := crd["spec"].(obj)
	delete(spec, "validation")
	names := spec["names"].(obj)
	if names["plural"] == "eventbuses" {
		names["plural"] = "eventbus"
	}
	versions := spec["versions"].([]interface{})
	version := versions[0].(obj)
	properties := version["schema"].(obj)["openAPIV3Schema"].(obj)["properties"].(obj)
	for k := range properties {
		if k == "spec" || k == "status" {
			properties[k] = obj{"type": "object", "x-kubernetes-preserve-unknown-fields": true}
		}
	}
	data, err = yaml.Marshal(crd)
	if err != nil {
		panic(err)
	}
	err = os.WriteFile(filename, data, 0666)
	if err != nil {
		panic(err)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4178** (2026-09-20): **AMQP eventsource never ACKs messages when `consume.autoAck` is `false`**
  *Symptoms*: **Describe the bug** The AMQP eventsource does not acknowledge (ACK) messages when `consume.autoAck` is set to `false`. Messages are successfully consumed and dispatched to the eventbus, and downstream sensors trigger workflows as expected, but the messages remain permanently in `Unacked` state in RabbitMQ.  Inspecting [`pkg/eventsources/sources/amqp/start.go`](https://github.com/argoproj/argo-events/blob/main/pkg/eventsources/sources/amqp/start.go), the `handleOne` method receives the `amqplib.Delivery`, marshals the event data, calls `dispatch()`, and returns. There is no call to `msg.Ack()` anywhere in the file. The only references to "Ack" are the `AutoAck` configuration field itself (used when calling `ch.Consume()`).  When the `consume` block is omitted, `setDefaults` sets `AutoAck` to `true`, so the broker auto-acknowledges on delivery and the problem is hidden. But as soon as `autoAck: false` is explicitly configured for manual acknowledgment, no ACK is ever sent.  Setting `autoAck: true` is not an acceptable workaround because it acknowledges messages before they are dispatched to the eventbus, risking silent message loss if the dispatch fails.  **To Reproduce** 1. Deploy an AMQP eventsource with `consume.autoAck: false`:     ```yaml     apiVersion: argoproj.io/v1alpha1     kind: EventSource     metadata:       name: amqp-eventsource     spec:       amqp:         example:           url: amqp://user:pass@rabbitmq-host:5672/           exchangeName: test           excha

- **Issue #4176** (2026-09-20): **naivewatcher test does not compile on Windows (syscall.Stat_t), go test ./... reports build failed**
  *Symptoms*: **Describe the bug**  `pkg/eventsources/common/naivewatcher/watcher_test.go` builds a test file ID from `fi.Sys().(*syscall.Stat_t)`, which only exists on Unix. On Windows the test file does not compile, so `go test ./...` reports the package as `[build failed]` even though the package itself builds fine there.  **To Reproduce**  On `master` on a Windows machine:  ``` go test -count=1 ./pkg/eventsources/common/naivewatcher/ ```  ``` # github.com/argoproj/argo-events/pkg/eventsources/common/naivewatcher [github.com/argoproj/argo-events/pkg/eventsources/common/naivewatcher.test] pkg\eventsources\common\naivewatcher\watcher_test.go:28:29: undefined: syscall.Stat_t FAIL    github.com/argoproj/argo-events/pkg/eventsources/common/naivewatcher [build failed] ```  **Expected behavior**  `go test ./...` should build on Windows. The test relies on Unix inode/device fields, so it should be constrained to non-Windows platforms (`//go:build !windows`) rather than fail to compile; CI on Linux keeps running it.  **Screenshots**  <img width="1865" height="840" alt="Image" src="https://github.com/user-attachments/assets/85f68f79-0cbb-451f-b527-d052a60ec0aa" />  **Environment (please complete the following information):**  - Kubernetes: n/a (unit test)  - Argo: n/a  - Argo Events: master at f2ca952  - Go: go1.27.0 windows/amd64  **Additional context**  Related to #4173 (the other package that does not pass on Windows). Happy to open a PR.  --- <!-- Issue Author: Don't delete this message to en

- **Issue #4173** (2026-09-20): **Log trigger uses a strict time comparison: interval 0 can skip events, and TestLogTrigger fails on Windows**
  *Symptoms*: **Describe the bug**  The log trigger decides whether to log with a strict comparison:  ```go func (t *LogTrigger) shouldLog(log *v1alpha1.LogTrigger) bool { 	return time.Now().After(t.LastLogTime.Add(log.GetInterval())) } ```  https://github.com/argoproj/argo-events/blob/f2ca952/pkg/sensors/triggers/log/log.go#L56-L58  With `intervalSeconds` unset (0, which the docs describe as "log every event"), `shouldLog` returns `false` whenever `time.Now()` has not moved past `LastLogTime`, so the event is dropped without any log line. The same off-by-one applies when exactly `intervalSeconds` have elapsed: the interval is treated as not yet over.  How often that happens depends on the resolution of Go's monotonic clock. On Linux it is nanoseconds, so two consecutive reads are almost never equal and the bug stays hidden. On Windows the monotonic clock advances in coarse ticks, so two consecutive `time.Now()` calls are routinely equal and the existing `TestLogTrigger` fails deterministically at `log_test.go:23`.  **To Reproduce**  1. Check out `master` on a Windows machine and run the package tests (screenshot 1):     ```    go test -count=1 -run TestLogTrigger ./pkg/sensors/triggers/log/    ```     ```    --- FAIL: TestLogTrigger (1.00s)        log_test.go:23:            Error Trace:    pkg/sensors/triggers/log/log_test.go:23            Error:          Should be true    FAIL    ```     Line 23 is `assert.True(t, l.shouldLog(&sv1.LogTrigger{}))`, i.e. interval 0 right after `Execute` se

- **Issue #4112** (2026-08-07): **Kafka EventSource with 1 Replica performs Leader Election and Crashloops**
  *Symptoms*: **Describe the bug** When running an EventSource (e.g., using a Kafka EventBus) configured with a single replica (replicas: 1 or defaulted), the pod still executes Kubernetes leader election. Because the leader election timeouts in the codebase are extremely aggressive (5-second lease, 2-second renew deadline), any minor API server latency causes the leader election to fail. Because there is only 1 replica, the failure to renew the lease results in immediate pod crashes and continuous restart loops (CrashLoopBackOff), even though High Availability (HA) was never intended or configured. In our understanding this contradicts the official documentation: "HA can be achieved by setting spec.replicas to a number greater than 1... If following EventSource types have spec.replicas > 1, Active-Passive strategy is used..." [Argo Events HA Docs](https://argoproj.github.io/argo-events/eventsources/ha)  **Expected behavior** For an EventSource with Replicas = 1 we would expect the leader election to be turned off.  **Environment (please complete the following information):**  - Kubernetes: 1.29  - Argo Events: v1.9.7  **Additional context** In the "newElector" method the "clusterSize" variable is used for every other elector but the kubernetes elector: https://github.com/argoproj/argo-events/blob/master/pkg/shared/leaderelection/leaderelection.go#L40C96-L40C96  It could also be possible to not call the newElector method if the number of replicas 1 one here: https://github.com/argoproj/arg

- **Issue #4109** (2026-08-31): **Embedded JetStream EventBus crashes under OpenSSL FIPS because generated encryption key is too short**
  *Symptoms*: **Describe the bug**  An embedded JetStream EventBus fails to start when the NATS server uses an OpenSSL FIPS provider that enforces the minimum HMAC key strength.  Argo Events [generates the JetStream encryption key using](https://github.com/argoproj/argo-events/blob/db2215e0db7b082e704c3fe58f3fa4a0ac92689a/pkg/reconciler/eventbus/installer/jetstream.go#L542):  ```go encryptionKey := sharedutil.RandomString(12) ```  Because the generated value is ASCII, this produces a 12-byte HMAC key. OpenSSL's FIPS provider requires an HMAC key of at least 112 bits. When NATS derives its JetStream encryption keys using HMAC-SHA256, the FIPS provider rejects the generated key and the server panics with `hmac_setkey:invalid key length`.  This prevents the Argo Events-managed JetStream EventBus from running with a FIPS-enabled NATS build.  **To Reproduce**  1. Deploy Argo Events v1.9.11. 2. Configure an embedded JetStream EventBus version using a NATS build backed by an OpenSSL FIPS provider. The configuration used here was:     ```yaml    configs:      jetstream:        versions:          - version: 2.14.3            natsImage: cgr.dev/nats-fips:2.14.3            metricsExporterImage: cgr.dev/prometheus-nats-exporter-fips:0.20.1            configReloaderImage: cgr.dev/nats-server-config-reloader-fips:0.23.0            startCommand: /nats-server    ```  3. Create an embedded JetStream EventBus:     ```yaml    apiVersion: argoproj.io/v1alpha1    kind: EventBus    metadata:      name: default 

- **Issue #4050** (2026-07-22): **spec.template.container.imagePullPolicy is ignored by Sensor controller**
  *Symptoms*: **Describe the bug** The imagePullPolicy specified under spec.template.container in a Sensor resource is ignored.  **To Reproduce** Sensor YAML: ``` apiVersion: argoproj.io/v1alpha1 kind: Sensor metadata:   name: router-reboot-sensor   namespace: argo spec:   eventBusName: default   template:     serviceAccountName: argo-events-sa     container:       imagePullPolicy: IfNotPresent ``` the generated Sensor Pod is always created with: ``` apiVersion: v1 kind: Pod metadata:   labels:     controller: sensor-controller spec:   containers:   - name: main     image: quay.io/argoproj/argo-events:v1.9.10     imagePullPolicy: Always   restartPolicy: Always ``` **Expected behavior** The generated Pod should honor the imagePullPolicy defined in the Sensor template:  **Screenshots** If applicable, add screenshots to help explain your problem.  **Environment (please complete the following information):**  - Kubernetes: [1.35.4]  - Argo Events: [2.4.21] 
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had any activity in the last 60 days. It will be closed if no further activity  occurs. Thank you for your contributions.

- **Issue #4030** (2026-07-06): **Argo Events: SSRF via Sensor HTTP Trigger**
  *Symptoms*: Hi, I'm a security student researching Kubernetes app vulnerabilities.  ## Summary  An event engineer (namespace-scoped, no direct Pod create permission) can create a `Sensor` CR with an HTTP trigger targeting any internal URL. When an event arrives from the linked EventSource, the Sensor Pod makes an **HTTP POST** to the attacker-specified URL with **user-controlled headers and event-derived body content**. There is zero URL validation — the validation only checks the URL is non-empty.  **Vulnerability Class**: CWE-918 (Server-Side Request Forgery) **Attack Prerequisites**: `create` permission on Sensor + EventSource CRs in a namespace (standard event engineer privilege) **Affected Version**: Argo Events v1.9.10 (latest stable, 2026-01-21) **Tested on**: Argo Events v1.9.10, Kind v0.31.0, Kubernetes v1.35.0 **Attack complexity**: Low — two `kubectl apply` (EventSource + Sensor), then trigger one event  ---  ## Root Cause  `pkg/sensors/triggers/http/http.go:143` — HTTP request to user-controlled URL:  ```go request, err := http.NewRequest(trigger.Method, trigger.URL, bytes.NewReader(payload)) ```  Validation at `pkg/reconciler/sensor/validate.go:236-265` only checks URL is non-empty and method is valid:  ```go func validateHTTPTrigger(trigger *v1alpha1.HTTPTrigger) error {     if trigger.URL == "" {         return fmt.Errorf("server URL is not specified")     }     // Only validates method and parameter format — NO URL validation } ```  User controls: - **URL**: fully control
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had any activity in the last 60 days. It will be closed if no further activity  occurs. Thank you for your contributions.

- **Issue #3989** (2026-04-20): **Bitbucket Server event source logs garbled error message due to incorrect `%w` verb in `Logger.Errorf`**
  *Symptoms*: **Describe the bug** In `pkg/eventsources/sources/bitbucketserver/start.go`, the `manageBitbucketServerWebhooks` goroutine uses `%w` as a format verb inside `Logger.Errorf`, which is incorrect.  `%w` is only meaningful in `fmt.Errorf` for error wrapping. `Logger.Errorf` is backed by `zap.SugaredLogger`, which uses `fmt.Sprintf` formatting internally. Passing `%w` to it produces a garbled log line like `%!w(*errors.errorString=&{...})` instead of the actual error message, making it impossible to debug webhook re-application failures in production.  Relevant code (`pkg/eventsources/sources/bitbucketserver/start.go`):  ```go err = router.applyBitbucketServerWebhooks(bitbucketServerEventSource) if err != nil {     router.route.Logger.Errorf("re-applying bitbucketserver webhooks failed: %w", err) } ```  **To Reproduce** 1. Configure a Bitbucket Server event source with webhook management enabled. 2. Trigger a webhook re-application failure (e.g. by making the Bitbucket Server temporarily unreachable after the initial connection). 3. Observe the log output — the error message will appear as `%!w(*errors.errorString=&{...})` instead of a human-readable string.  To confirm the behaviour locally:  ```go logger.Errorf("failed: %w", fmt.Errorf("some error")) // output: failed: %!w(*errors.errorString=&{some error}) ``` **Expected behavior**  `%w` should be replaced with `%v` so the error message is readable in logs.  ```go router.route.Logger.Errorf("re-applying bitbucketserver webhooks

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

### Incident Patch 1: `52ed4610` (2026-09-20)
**Commit Message**: fix(eventsources): ack/nack AMQP messages when consume.autoAck is false (#4179)

Signed-off-by: Pujitha Paladugu <10557236+pujitha24@users.noreply.github.com>
Co-authored-by: Pujitha Paladugu <10557236+pujitha24@users.noreply.github.com>

**File**: `pkg/eventsources/sources/amqp/start.go` (modified, +20/-0)
```diff
@@ -185,16 +185,36 @@ func (el *EventListener) handleOne(amqpEventSource *aev1.AMQPEventSource, msg am
 
 	bodyBytes, err := json.Marshal(body)
 	if err != nil {
+		el.nack(amqpEventSource, msg, log)
 		return fmt.Errorf("failed to marshal the message, message-id: %s, %w", msg.MessageId, err)
 	}
 
 	log.Info("dispatching event ...")
 	if err = dispatch(bodyBytes); err != nil {
+		el.nack(amqpEventSource, msg, log)
 		return fmt.Errorf("failed to dispatch AMQP event, %w", err)
 	}
+
+	if !amqpEventSource.Consume.AutoAck {
+		if err := msg.Ack(false); err != nil {
+			log.Errorw("failed to ack the message", zap.Any("message-id", msg.MessageId), zap.Error(err))
+		}
+	}
 	return nil
 }
 
+// nack negatively acknowledges and requeues a message that failed processing.
+// It is a no-op when the channel was set up with AutoAck, since the broker
+// already acknowledged the message on delivery in that case.
+func (el *EventListener) nack(amqpEventSource *aev1.AMQPEventSource, msg amqplib.Delivery, log *zap.SugaredLogger) {
+	if amqpEventSource.Consume.AutoAck {
+		return
+	}
+	if err := msg.Nack(false, true); err != nil {
+		log.Errorw("failed to nack the message", zap.Any("message-id", msg.MessageId), zap.Error(err))
+	}
+}
+
 // setDefaults sets the default values in case the user hasn't defined them
 // helps also to keep retro-compatibility with current dpeloyments
 func setDefaults(eventSource *aev1.AMQPEventSource) {
```

**File**: `pkg/eventsources/sources/amqp/start_test.go` (modified, +83/-0)
```diff
@@ -17,11 +17,94 @@ limitations under the License.
 package amqp
 
 import (
+	"errors"
 	"testing"
 
+	amqplib "github.com/rabbitmq/amqp091-go"
 	"github.com/stretchr/testify/assert"
+	"go.uber.org/zap/zaptest"
+
+	aev1 "github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
+	eventsourcecommon "github.com/argoproj/argo-events/pkg/eventsources/common"
+	metrics "github.com/argoproj/argo-events/pkg/metrics"
 )
 
+// mockAcknowledger records the Ack/Nack calls made against a Delivery so
+// tests can assert on manual acknowledgement behavior.
+type mockAcknowledger struct {
+	acked   bool
+	nacked  bool
+	requeue bool
+}
+
+func (m *mockAcknowledger) Ack(tag uint64, multiple bool) error {
+	m.acked = true
+	return nil
+}
+
+func (m *mockAcknowledger) Nack(tag uint64, multiple, requeue bool) error {
+	m.nacked = true
+	m.requeue = requeue
+	return nil
+}
+
+func (m *mockAcknowledger) Reject(tag uint64, requeue bool) error {
+	return nil
+}
+
+func newEventListener() *EventListener {
+	return &EventListener{
+		EventSourceName: "esName",
+		EventName:       "eName",
+		Metrics:         metrics.NewMetrics("ns"),
+	}
+}
+
+func TestHandleOne_ManualAck(t *testing.T) {
+	el := newEventListener()
+	amqpEventSource := &aev1.AMQPEventSource{
+		Consume: &aev1.AMQPConsumeConfig{AutoAck: false},
+	}
+	ack := &mockAcknowledger{}
+	msg := amqplib.Delivery{Acknowledger: ack, Body: []byte(`{"a":"b"}`)}
+
+	dispatch := func(b []byte, opts ...eventsourcecommon.Option) error { return nil }
+	err := el.handleOne(amqpEventSource, msg, dispatch, zaptest.NewLogger(t).Sugar())
+	assert.NoError(t, err)
+	assert.True(t, ack.acked, "expected the message to be acked after a successful dispatch")
+	assert.False(t, ack.nacked)
+}
+
+func TestHandleOne_ManualNackOnDispatchFailure(t *testing.T) {
+	el := newEventListener()
+	amqpEventSource := &aev1.AMQPEventSource{
+		Consume: &aev1.AMQPConsumeConfig{AutoAck: false},
+	}
+	ack := &mockAcknowledger{}
+	msg := amqplib.Delivery{Acknowledger: ack, Body: []byte(`{"a":"b"}`)}
+
+	dispatch := func(b []byte, opts ...eventsourcecommon.Option) error { return errors.New("dispatch failed") }
+	err := el.handleOne(amqpEventSource, msg, dispatch, zaptest.NewLogger(t).Sugar())
+	assert.Error(t, err)
+	assert.True(t, ack.nacked, "expected the message to be nacked and requeued after a failed dispatch")
+	assert.True(t, ack.requeue)
+	assert.False(t, ack.acked)
+}
+
+func TestHandleOne_AutoAckSkipsManualAck(t *testing.T) {
+	el := newEventListener()
+	amqpEventSource := &aev1.AMQPEventSource{
+		Consume: &aev1.AMQPConsumeConfig{AutoAck: true},
+	}
+	// No Acknowledger set: manual Ack/Nack would return
+	// amqplib.ErrDeliveryNotInitialized if mistakenly called.
+	msg := amqplib.Delivery{Body: []byte(`{"a":"b"}`)}
+
+	dispatch := func(b []byte, opts ...eventsourcecommon.Option) error { return nil }
+	err := el.handleOne(amqpEventSource, msg, dispatch, zaptest.NewLogger(t).Sugar())
+	assert.NoError(t, err)
+}
+
 func TestParseYamlTable(t *testing.T) {
 	table, err := parseYamlTable("")
 	assert.Nil(t, err)
```

---

### Incident Patch 2: `5fb314e5` (2026-09-20)
**Commit Message**: fix(sensors): treat an exactly elapsed interval as loggable in the log trigger (#4174)

Signed-off-by: Peter Ong <peterong.gp@gmail.com>

**File**: `pkg/sensors/triggers/log/log.go` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ func (t *LogTrigger) Execute(ctx context.Context, events map[string]*v1alpha1.Ev
 }
 
 func (t *LogTrigger) shouldLog(log *v1alpha1.LogTrigger) bool {
-	return time.Now().After(t.LastLogTime.Add(log.GetInterval()))
+	return !time.Now().Before(t.LastLogTime.Add(log.GetInterval()))
 }
 
 func (t *LogTrigger) ApplyPolicy(context.Context, interface{}) error {
```

**File**: `pkg/sensors/triggers/log/log_test.go` (modified, +11/-0)
```diff
@@ -28,3 +28,14 @@ func TestLogTrigger(t *testing.T) {
 	assert.True(t, l.shouldLog(&sv1.LogTrigger{}))
 	assert.True(t, l.shouldLog(&sv1.LogTrigger{IntervalSeconds: 1}))
 }
+
+func TestShouldLogSameInstant(t *testing.T) {
+	now := time.Now()
+	l := &LogTrigger{LastLogTime: now}
+
+	assert.True(t, l.shouldLog(&sv1.LogTrigger{}))
+	assert.False(t, l.shouldLog(&sv1.LogTrigger{IntervalSeconds: 1}))
+
+	l.LastLogTime = now.Add(-1 * time.Second)
+	assert.True(t, l.shouldLog(&sv1.LogTrigger{IntervalSeconds: 1}))
+}
```

---

### Incident Patch 3: `7a220348` (2026-08-31)
**Commit Message**: fix(eventbus): close NATS connection when trigger connection init fails (#4158)

Signed-off-by: Gabriel Harnagea <gabriel.harnagea06@gmail.com>

**File**: `go.mod` (modified, +5/-1)
```diff
@@ -63,6 +63,7 @@ require (
 	github.com/mitchellh/hashstructure/v2 v2.0.2
 	github.com/mitchellh/mapstructure v1.5.0
 	github.com/nats-io/graft v0.0.0-20220215174245-93d18541496f
+	github.com/nats-io/nats-server/v2 v2.11.15
 	github.com/nats-io/nats.go v1.53.1
 	github.com/nats-io/stan.go v0.10.4
 	github.com/nsqio/go-nsq v1.1.0
@@ -142,6 +143,7 @@ require (
 	github.com/alibabacloud-go/tea v1.2.2 // indirect
 	github.com/aliyun/credentials-go v1.3.10 // indirect
 	github.com/andybalholm/brotli v1.1.0 // indirect
+	github.com/antithesishq/antithesis-sdk-go v0.6.0-default-no-op // indirect
 	github.com/ardielle/ardielle-go v1.5.2 // indirect
 	github.com/awalterschulze/gographviz v0.0.0-20200901124122-0eecad45bd71 // indirect
 	github.com/aws/aws-sdk-go-v2 v1.36.3 // indirect
@@ -225,6 +227,7 @@ require (
 	github.com/google/go-github/v69 v69.2.0 // indirect
 	github.com/google/go-github/v84 v84.0.0 // indirect
 	github.com/google/go-querystring v1.2.0 // indirect
+	github.com/google/go-tpm v0.9.8 // indirect
 	github.com/google/gofuzz v1.2.0 // indirect
 	github.com/google/s2a-go v0.1.9 // indirect
 	github.com/googleapis/enterprise-certificate-proxy v0.3.20 // indirect
@@ -267,6 +270,7 @@ require (
 	github.com/mattn/go-colorable v0.1.15 // indirect
 	github.com/mattn/go-isatty v0.0.24 // indirect
 	github.com/minio/crc64nvme v1.1.1 // indirect
+	github.com/minio/highwayhash v1.0.4-0.20251030100505-070ab1a87a76 // indirect
 	github.com/minio/md5-simd v1.1.2 // indirect
 	github.com/mitchellh/copystructure v1.2.0 // indirect
 	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
@@ -277,7 +281,7 @@ require (
 	github.com/mtibben/percent v0.2.1 // indirect
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
 	github.com/mxk/go-flowrate v0.0.0-20140419014527-cca7078d478f // indirect
-	github.com/nats-io/nats-server/v2 v2.11.15 // indirect
+	github.com/nats-io/jwt/v2 v2.8.1 // indirect
 	github.com/nats-io/nats-streaming-server v0.24.6 // indirect
 	github.com/nats-io/nkeys v0.4.15 // indirect
 	github.com/nats-io/nuid v1.0.1 // indirect
```

**File**: `go.sum` (modified, +1/-0)
```diff
@@ -1097,6 +1097,7 @@ golang.org/x/sys v0.4.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.5.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.8.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.16.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
+golang.org/x/sys v0.21.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
 golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
 golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/telemetry v0.0.0-20260811182544-a038080d80e5 h1:ZUSxONxc981v7AW7QUg+I9WwZzSTTJ019ENBYr5pV/Q=
```

**File**: `pkg/eventbus/jetstream/sensor/sensor_jetstream.go` (modified, +6/-1)
```diff
@@ -77,7 +77,12 @@ func (stream *SensorJetstream) Connect(ctx context.Context, triggerName string,
 		return nil, err
 	}
 
-	return NewJetstreamTriggerConn(conn, stream.sensorName, triggerName, dependencyExpression, deps)
+	triggerConn, err := NewJetstreamTriggerConn(conn, stream.sensorName, triggerName, dependencyExpression, deps)
+	if err != nil {
+		_ = conn.Close()
+		return nil, err
+	}
+	return triggerConn, nil
 }
 
 // Update the K/V store to reflect the current Spec:
```

**File**: `pkg/eventbus/jetstream/sensor/sensor_jetstream_test.go` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+package sensor
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/nats-io/nats-server/v2/server"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+
+	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
+	eventbuscommon "github.com/argoproj/argo-events/pkg/eventbus/common"
+)
+
+func TestSensorJetstreamConnectClosesConnectionOnTriggerConnectionError(t *testing.T) {
+	natsServer, err := server.NewServer(&server.Options{
+		JetStream: true,
+		StoreDir:  t.TempDir(),
+		Host:      "127.0.0.1",
+		Port:      -1,
+	})
+	require.NoError(t, err)
+	natsServer.Start()
+	t.Cleanup(func() {
+		natsServer.Shutdown()
+		natsServer.WaitForShutdown()
+	})
+	require.True(t, natsServer.ReadyForConnections(10*time.Second))
+
+	sensorSpec := &v1alpha1.Sensor{ObjectMeta: metav1.ObjectMeta{Name: "missing-kv-bucket"}}
+	stream, err := NewSensorJetstream(
+		natsServer.ClientURL(),
+		sensorSpec,
+		"",
+		&eventbuscommon.Auth{Strategy: v1alpha1.AuthStrategyNone},
+		zap.NewNop().Sugar(),
+		nil,
+	)
+	require.NoError(t, err)
+	baseline := natsServer.NumClients()
+
+	triggerConn, err := stream.Connect(context.Background(), "trigger", "dependency", nil, false)
+	require.Error(t, err)
+	require.Nil(t, triggerConn)
+	require.ErrorContains(t, err, "failed to get K/V store")
+	require.Eventually(t, func() bool {
+		return natsServer.NumClients() == baseline
+	}, 5*time.Second, 10*time.Millisecond)
+}
```

---

### Incident Patch 4: `4ef49aeb` (2026-08-17)
**Commit Message**: fix: return from ConsumeClaim when the Kafka batch channel closes (#4148)

Signed-off-by: Thomas Timmers <thomas.timmers@collibra.com>

**File**: `pkg/eventbus/kafka/sensor/kafka_handler.go` (modified, +6/-1)
```diff
@@ -145,7 +145,12 @@ func (h *KafkaHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim s
 
 	for {
 		select {
-		case msgs := <-batch:
+		case msgs, ok := <-batch:
+			if !ok {
+				// the claim's message channel closed, so sarama can rebalance
+				h.Logger.Info("Kafka batch channel closed, returning from ConsumeClaim")
+				return nil
+			}
 			if len(msgs) == 0 {
 				h.Logger.Warn("Kafka batch contains no messages")
 				continue
```

**File**: `pkg/eventbus/kafka/sensor/kafka_handler_test.go` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+package kafka
+
+import (
+	"context"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/IBM/sarama"
+	"github.com/stretchr/testify/assert"
+	"go.uber.org/zap"
+)
+
+// fakeConsumerGroupSession is a minimal sarama.ConsumerGroupSession whose
+// Context() stays live for the lifetime of the test, mirroring a session
+// that has not been rebalanced away.
+type fakeConsumerGroupSession struct {
+	ctx context.Context
+}
+
+func (f *fakeConsumerGroupSession) Claims() map[string][]int32                  { return nil }
+func (f *fakeConsumerGroupSession) MemberID() string                            { return "fake-member" }
+func (f *fakeConsumerGroupSession) GenerationID() int32                         { return 1 }
+func (f *fakeConsumerGroupSession) MarkOffset(string, int32, int64, string)     {}
+func (f *fakeConsumerGroupSession) Commit()                                     {}
+func (f *fakeConsumerGroupSession) ResetOffset(string, int32, int64, string)    {}
+func (f *fakeConsumerGroupSession) MarkMessage(*sarama.ConsumerMessage, string) {}
+func (f *fakeConsumerGroupSession) Context() context.Context                    { return f.ctx }
+
+// fakeConsumerGroupClaim exposes a message channel the test controls
+// directly, so it can be closed to simulate a sarama rebalance.
+type fakeConsumerGroupClaim struct {
+	topic     string
+	partition int32
+	messages  chan *sarama.ConsumerMessage
+}
+
+func (f *fakeConsumerGroupClaim) Topic() string                            { return f.topic }
+func (f *fakeConsumerGroupClaim) Partition() int32                         { return f.partition }
+func (f *fakeConsumerGroupClaim) InitialOffset() int64                     { return 0 }
+func (f *fakeConsumerGroupClaim) HighWaterMarkOffset() int64               { return 0 }
+func (f *fakeConsumerGroupClaim) Messages() <-chan *sarama.ConsumerMessage { return f.messages }
+
+// TestConsumeClaim_ReturnsOnClosedChannel reproduces the DEV-209308 hang: a
+// Kafka broker restart closes the claim's message channel while the
+// session's context is still alive. ConsumeClaim must return so sarama can
+// rebalance, instead of looping forever on the nil slice a closed channel
+// produces.
+func TestConsumeClaim_ReturnsOnClosedChannel(t *testing.T) {
+	const topic = "test-topic"
+	const partition = int32(0)
+
+	claim := &fakeConsumerGroupClaim{
+		topic:     topic,
+		partition: partition,
+		messages:  make(chan *sarama.ConsumerMessage),
+	}
+	session := &fakeConsumerGroupSession{ctx: context.Background()}
+
+	h := &KafkaHandler{
+		Mutex:  &sync.Mutex{},
+		Logger: zap.NewNop().Sugar(),
+		Handlers: map[string]func(*sarama.ConsumerMessage) ([]*sarama.ProducerMessage, int64, func()){
+			topic: func(*sarama.ConsumerMessage) ([]*sarama.ProducerMessage, int64, func()) {
+				return nil, 0, nil
+			},
+		},
+		checkpoints: Checkpoints{
+			topic: {
+				partition: &Checkpoint{Logger: zap.NewNop().Sugar()},
+			},
+		},
+	}
+
+	// Close the claim's channel to simulate the broker-restart rebalance,
+	// while the session context stays alive (its Done() never fires).
+	close(claim.messages)
+
+	done := make(chan error, 1)
+	go func() {
+		done <- h.ConsumeClaim(session, claim)
+	}()
+
+	select {
+	case err := <-done:
+		assert.NoError(t, err)
+	case <-time.After(5 * time.Second):
+		t.Fatal("ConsumeClaim did not return after its message channel closed; it is stuck in the hot-loop from DEV-209308")
+	}
+}
```

---

### Incident Patch 5: `a6ec87e1` (2026-08-17)
**Commit Message**: fix: make JetStream TLS optional when unset (#4114)

Signed-off-by: amarkdotdev <amarkdotdev@users.noreply.github.com>
Co-authored-by: amarkdotdev <amarkdotdev@users.noreply.github.com>

**File**: `pkg/eventbus/jetstream/base/jetstream.go` (modified, +3/-4)
```diff
@@ -2,7 +2,6 @@ package base
 
 import (
 	"bytes"
-	"crypto/tls"
 	"fmt"
 
 	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
@@ -77,9 +76,9 @@ func (stream *Jetstream) MakeConnection() (*JetstreamConnection, error) {
 		opts = append(opts, nats.Secure(tlsConfig))
 		log.Info("Client-side TLS configuration enabled on the NATS connection")
 	} else {
-		opts = append(opts, nats.Secure(&tls.Config{
-			InsecureSkipVerify: true,
-		}))
+		// No TLS config means a plain TCP connection. Callers that need TLS
+		// (including insecureSkipVerify) should set JetStreamConfig.TLS.
+		log.Info("Connecting to NATS without client-side TLS")
 	}
 
 	switch stream.auth.Strategy {
```

**File**: `pkg/eventbus/jetstream/base/jetstream_test.go` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+package base
+
+import (
+	"testing"
+
+	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
+	eventbuscommon "github.com/argoproj/argo-events/pkg/eventbus/common"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap"
+)
+
+func TestMakeConnectionTLSOptional(t *testing.T) {
+	logger := zap.NewNop().Sugar()
+
+	t.Run("nil TLS does not require secure connection option before dial", func(t *testing.T) {
+		js, err := NewJetstream("nats://127.0.0.1:1", "", &eventbuscommon.Auth{
+			Strategy: v1alpha1.AuthStrategyNone,
+		}, logger, nil)
+		require.NoError(t, err)
+
+		// Dial will fail because nothing is listening, but the important
+		// part is we get a connection failure rather than a TLS handshake
+		// error against a plain TCP endpoint.
+		_, err = js.MakeConnection()
+		require.Error(t, err)
+		assert.NotContains(t, err.Error(), "tls:")
+		assert.NotContains(t, err.Error(), "TLS")
+	})
+
+	t.Run("configured TLS is still applied", func(t *testing.T) {
+		js, err := NewJetstream("nats://127.0.0.1:1", "", &eventbuscommon.Auth{
+			Strategy: v1alpha1.AuthStrategyNone,
+		}, logger, &v1alpha1.TLSConfig{InsecureSkipVerify: true})
+		require.NoError(t, err)
+
+		_, err = js.MakeConnection()
+		require.Error(t, err)
+	})
+}
```

**File**: `pkg/reconciler/eventbus/installer/exotic_jetstream_test.go` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ func TestInstallationJSExotic(t *testing.T) {
 		assert.NoError(t, err)
 		assert.NotNil(t, conf.JetStream)
 		assert.Equal(t, conf.JetStream.URL, testJSExoticURL)
+		// Exotic config without tls is passed through unset so clients use plain TCP.
+		assert.Nil(t, conf.JetStream.TLS)
 	})
 }
 
```

**File**: `pkg/reconciler/eventbus/installer/installer_test.go` (modified, +4/-0)
```diff
@@ -194,5 +194,9 @@ func TestInstall(t *testing.T) {
 		assert.NotNil(t, testObj.Status.Config.JetStream)
 		assert.NotEmpty(t, testObj.Status.Config.JetStream.URL)
 		assert.NotNil(t, testObj.Status.Config.JetStream.AccessSecret)
+		// Native/managed JetStream always serves TLS with a self-signed cert;
+		// BusConfig must advertise insecureSkipVerify so clients keep using TLS.
+		assert.NotNil(t, testObj.Status.Config.JetStream.TLS)
+		assert.True(t, testObj.Status.Config.JetStream.TLS.InsecureSkipVerify)
 	})
 }
```

**File**: `pkg/reconciler/eventbus/installer/jetstream.go` (modified, +6/-0)
```diff
@@ -115,6 +115,9 @@ func (r *jetStreamInstaller) Install(ctx context.Context) (*v1alpha1.BusConfig,
 		return nil, err
 	}
 	r.eventBus.Status.MarkDeployed("Succeeded", "JetStream is deployed")
+	// Managed JetStream always serves TLS with a self-signed cert. Advertise
+	// insecureSkipVerify so clients opt into TLS explicitly; exotic/plain TCP
+	// buses leave TLS unset and connect without nats.Secure.
 	return &v1alpha1.BusConfig{
 		JetStream: &v1alpha1.JetStreamConfig{
 			URL: fmt.Sprintf("nats://%s.%s.svc:%s", generateJetStreamServiceName(r.eventBus), r.eventBus.Namespace, strconv.Itoa(int(jsClientPort))),
@@ -125,6 +128,9 @@ func (r *jetStreamInstaller) Install(ctx context.Context) (*v1alpha1.BusConfig,
 				Key: v1alpha1.JetStreamClientAuthSecretKey,
 			},
 			StreamConfig: string(b),
+			TLS: &v1alpha1.TLSConfig{
+				InsecureSkipVerify: true,
+			},
 		},
 	}, nil
 }
```

---

### Incident Patch 6: `d15ee4b7` (2026-08-07)
**Commit Message**: fix: skip leader election for single-replica recreate-strategy event sources (#4121)

Signed-off-by: Pujitha Paladugu <10557236+pujitha24@users.noreply.github.com>
Co-authored-by: Pujitha Paladugu <10557236+pujitha24@users.noreply.github.com>

**File**: `pkg/eventsources/eventing.go` (modified, +13/-2)
```diff
@@ -411,6 +411,16 @@ func NewEventSourceAdaptor(eventSource *aev1.EventSource, eventBusConfig *aev1.B
 	}
 }
 
+// needsLeaderElection returns true when leader election is required to
+// coordinate multiple replicas of a "recreate" strategy event source. With
+// a single replica there is no other instance to contend with for
+// leadership, so electing is unnecessary and only adds a risk of
+// crash-looping on transient API server latency.
+// See https://github.com/argoproj/argo-events/issues/4112.
+func needsLeaderElection(isRecreateType bool, replicas int) bool {
+	return isRecreateType && replicas > 1
+}
+
 // Start function
 func (e *EventSourceAdaptor) Start(ctx context.Context) error {
 	log := logging.FromContext(ctx)
@@ -430,12 +440,13 @@ func (e *EventSourceAdaptor) Start(ctx context.Context) error {
 		break
 	}
 
-	if !isRecreateType {
+	replicas := int(e.eventSource.Spec.GetReplicas())
+
+	if !needsLeaderElection(isRecreateType, replicas) {
 		return e.run(ctx, servers, filters)
 	}
 
 	clusterName := fmt.Sprintf("%s-eventsource-%s", e.eventSource.Namespace, e.eventSource.Name)
-	replicas := int(e.eventSource.Spec.GetReplicas())
 	leasename := fmt.Sprintf("eventsource-%s", e.eventSource.Name)
 
 	elector, err := leaderelection.NewElector(ctx, *e.eventBusConfig, clusterName, replicas, e.eventSource.Namespace, leasename, e.hostname)
```

**File**: `pkg/eventsources/eventing_test.go` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+package eventsources
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+func TestNeedsLeaderElection(t *testing.T) {
+	tests := []struct {
+		name           string
+		isRecreateType bool
+		replicas       int
+		want           bool
+	}{
+		{"non-recreate type, single replica", false, 1, false},
+		{"non-recreate type, multiple replicas", false, 3, false},
+		{"recreate type, single replica", true, 1, false},
+		{"recreate type, zero replicas", true, 0, false},
+		{"recreate type, multiple replicas", true, 3, true},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.want, needsLeaderElection(tt.isRecreateType, tt.replicas))
+		})
+	}
+}
```

---

### Incident Patch 7: `2ee37c02` (2026-08-07)
**Commit Message**: fix: upgrade NATS JetStream from 2.10.29 to 2.14.4 (#4134)

Signed-off-by: suryaval <surya.vallabhaneni2@gmail.com>

**File**: `manifests/base/controller-manager/controller-config.yaml` (modified, +8/-3)
```diff
@@ -32,9 +32,9 @@ data:
           discard: 0
         versions:
         - version: latest
-          natsImage: nats:2.10.29
-          metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
-          configReloaderImage: natsio/nats-server-config-reloader:0.14.0
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
           startCommand: /nats-server
         - version: 2.8.1
           natsImage: nats:2.8.1
@@ -76,3 +76,8 @@ data:
           metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
           configReloaderImage: natsio/nats-server-config-reloader:0.14.0
           startCommand: /nats-server
+        - version: 2.14.4
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
+          startCommand: /nats-server
```

**File**: `manifests/install.yaml` (modified, +8/-3)
```diff
@@ -336,9 +336,9 @@ data:
           discard: 0
         versions:
         - version: latest
-          natsImage: nats:2.10.29
-          metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
-          configReloaderImage: natsio/nats-server-config-reloader:0.14.0
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
           startCommand: /nats-server
         - version: 2.8.1
           natsImage: nats:2.8.1
@@ -380,6 +380,11 @@ data:
           metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
           configReloaderImage: natsio/nats-server-config-reloader:0.14.0
           startCommand: /nats-server
+        - version: 2.14.4
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
+          startCommand: /nats-server
 kind: ConfigMap
 metadata:
   name: argo-events-controller-config
```

**File**: `manifests/namespace-install.yaml` (modified, +8/-3)
```diff
@@ -256,9 +256,9 @@ data:
           discard: 0
         versions:
         - version: latest
-          natsImage: nats:2.10.29
-          metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
-          configReloaderImage: natsio/nats-server-config-reloader:0.14.0
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
           startCommand: /nats-server
         - version: 2.8.1
           natsImage: nats:2.8.1
@@ -300,6 +300,11 @@ data:
           metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
           configReloaderImage: natsio/nats-server-config-reloader:0.14.0
           startCommand: /nats-server
+        - version: 2.14.4
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
+          startCommand: /nats-server
 kind: ConfigMap
 metadata:
   name: argo-events-controller-config
```

---

### Incident Patch 8: `db2215e0` (2026-07-14)
**Commit Message**: chore: fix intermittent ci issue (#4108)

Signed-off-by: Derek Wang <whynowy@gmail.com>

**File**: `Dockerfile` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ ARG ARCH=$TARGETARCH
 ####################################################################################################
 # base
 ####################################################################################################
-FROM alpine:3.16.2 as base
+FROM alpine:3.23 AS base
 ARG ARCH
 RUN apk update && apk upgrade && \
     apk add ca-certificates && \
@@ -20,7 +20,7 @@ RUN chmod +x /bin/argo-events
 ####################################################################################################
 # argo-events
 ####################################################################################################
-FROM scratch as argo-events
+FROM scratch AS argo-events
 ARG ARCH
 COPY --from=base /usr/share/zoneinfo /usr/share/zoneinfo
 COPY --from=base /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
```

**File**: `Makefile` (modified, +2/-2)
```diff
@@ -175,8 +175,8 @@ docs/assets/diagram.png: go-diagrams/diagram.dot
 start: image
 	kubectl apply -f test/manifests/argo-events-ns.yaml
 	kubectl kustomize test/manifests | sed 's@quay.io/argoproj/@$(IMAGE_NAMESPACE)/@' | sed 's/argo-events:$(BASE_VERSION)/argo-events:$(VERSION)/' | kubectl -n argo-events apply -l app.kubernetes.io/part-of=argo-events --prune=false --force -f -
-	kubectl -n argo-events rollout status deploy -lapp=controller-manager --timeout=60s
-	kubectl -n argo-events wait --for=condition=Ready --timeout 60s pod --all
+	kubectl -n argo-events rollout status deploy -lapp.kubernetes.io/part-of=argo-events --timeout=60s
+	kubectl -n argo-events wait -lapp.kubernetes.io/part-of=argo-events --for=condition=Ready --timeout 60s pod --all
 
 $(GOPATH)/bin/golangci-lint:
 	curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b `go env GOPATH`/bin v2.9.0
```

---

### Incident Patch 9: `e07c3f29` (2026-05-21)
**Commit Message**: fix: avoid duplicate slashes in formatted webhook URLs (#4056)

**File**: `pkg/shared/util/util.go` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ func FormatEndpoint(endpoint string) string {
 
 // FormattedURL returns a formatted url
 func FormattedURL(url, endpoint string) string {
-	return fmt.Sprintf("%s%s", url, FormatEndpoint(endpoint))
+	return fmt.Sprintf("%s%s", strings.TrimRight(url, "/"), FormatEndpoint(endpoint))
 }
 
 func ErrEventSourceTypeMismatch(eventSourceType string) string {
```

**File**: `pkg/shared/util/util_test.go` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ func TestFormatEndpoint(t *testing.T) {
 
 func TestFormattedURL(t *testing.T) {
 	assert.Equal(t, "test-url/fake", FormattedURL("test-url", "fake"))
+	assert.Equal(t, "test-url/fake", FormattedURL("test-url/", "/fake"))
 }
 
 type statusVal int
```

---

### Incident Patch 10: `0880ab13` (2026-05-01)
**Commit Message**: fix(sensor): bump action_retries_failed_total on async trigger failures (#4002)

Signed-off-by: Ali <alliasgher123@gmail.com>

**File**: `pkg/sensors/listener.go` (modified, +7/-0)
```diff
@@ -377,6 +377,13 @@ func (sensorCtx *SensorContext) triggerActions(ctx context.Context, sensor *v1al
 		go func() {
 			err := sensorCtx.triggerWithRateLimit(ctx, sensor, trigger, eventsMapping, depNames, eventIDs)
 			if err != nil {
+				// Fire-and-forget triggers (AtLeastOnce=false) do not go
+				// through the caller's DoWithRetry loop, so the caller
+				// cannot observe this failure and bump
+				// action_retries_failed_total. Record it here instead to
+				// keep the metric consistent with the AtLeastOnce=true
+				// path. See argoproj/argo-events#3947.
+				sensorCtx.metrics.ActionRetriesFailed(sensor.Name, trigger.Template.Name)
 				// Log the error, and let it continue
 				logger := logging.FromContext(ctx)
 				logger.Errorw("Failed to execute a trigger", zap.Error(err), zap.String(logging.LabelTriggerName, trigger.Template.Name))
```

#### Recent Merged Pull Requests:
- **PR #4198** (2026-09-26): chore(deps): bump cloud.google.com/go/compute/metadata from 0.9.0 to 0.9.1 (@dependabot[bot])
- **PR #4197** (2026-09-26): chore(deps): bump google.golang.org/api from 0.298.0 to 0.299.0 (@dependabot[bot])
- **PR #4196** (2026-09-26): chore(deps): bump github.com/nats-io/nats-server/v2 from 2.14.7 to 2.15.0 (@dependabot[bot])
- **PR #4194** (2026-09-26): chore(deps): bump github.com/nats-io/nats.go from 1.53.1 to 1.54.0 (@dependabot[bot])
- **PR #4193** (2026-09-26): chore(deps): bump github.com/emitter-io/go/v2 from 2.0.9 to 2.1.0 (@dependabot[bot])
- **PR #4192** (2026-09-26): chore(deps): bump github.com/go-openapi/inflect from 1.0.0 to 1.0.1 (@dependabot[bot])
- **PR #4191** (2026-09-26): chore(deps): bump google.golang.org/grpc from 1.83.2 to 1.84.0 (@dependabot[bot])
- **PR #4188** (2026-09-19): chore(deps): bump github.com/go-swagger/go-swagger from 0.36.5 to 0.36.6 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
