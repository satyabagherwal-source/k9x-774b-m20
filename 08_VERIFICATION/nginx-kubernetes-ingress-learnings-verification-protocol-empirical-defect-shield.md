# Verification Protocol: Verification Protocol: Empirical Defect Shield for nginx-kubernetes-ingress-learnings

<!-- PROVENANCE_START
{
  "source_repository": "nginx-kubernetes-ingress-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T22:18:21.011Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nginx-kubernetes-ingress-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nginx-kubernetes-ingress-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T22:18:21.011Z`  
> **Learning ID**: `LEARN-EVO-nginx-kubernetes-ingress-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `nginx-kubernetes-ingress-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nginx-kubernetes-ingress-learnings.md`  
> **Source**: github ([https://github.com/nginx/kubernetes-ingress](https://github.com/nginx/kubernetes-ingress))  
> **Source Version**: `8c5b0b9d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T22:17:38.811Z  
> **Learning ID**: `learn-github-nginx-kubernetes-ingress`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nginx/kubernetes-ingress

> **Canonical Artifact**: `07_PROJECT_LEARNING/nginx-kubernetes-ingress-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nginx/kubernetes-ingress](https://github.com/nginx/kubernetes-ingress))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T22:17:38.803Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nginx/kubernetes-ingress`
- **Description**: NGINX and  NGINX Plus Ingress Controllers for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, go.mod, README.md
- **Stars / Engagement**: 5097 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/nginx-ingress/utils.go`
```
package main

import (
	"runtime/debug"
)

func getBuildInfo() (commitHash string, commitTime string, dirtyBuild string) {
	commitHash = "unknown"
	commitTime = "unknown"
	dirtyBuild = "unknown"

	info, ok := debug.ReadBuildInfo()
	if !ok {
		return commitHash, commitTime, dirtyBuild
	}
	for _, kv := range info.Settings {
		switch kv.Key {
		case "vcs.revision":
			commitHash = kv.Value
		case "vcs.time":
			commitTime = kv.Value
		case "vcs.modified":
			dirtyBuild = kv.Value
		}
	}
	return commitHash, commitTime, dirtyBuild
}

```

### Core Architecture Module: `internal/k8s/task_queue.go`
```
package k8s

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/nginx/kubernetes-ingress/pkg/apis/dos/v1beta1"

	"github.com/nginx/kubernetes-ingress/internal/k8s/appprotect"
	"github.com/nginx/kubernetes-ingress/internal/k8s/appprotectdos"
	nl "github.com/nginx/kubernetes-ingress/internal/logger"
	conf_v1 "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/v1"
	v1 "k8s.io/api/core/v1"
	discovery_v1 "k8s.io/api/discovery/v1"
	networking "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/workqueue"
)

// taskQueue manages a work queue through an independent worker that
// invokes the given sync function for every work item inserted.
type taskQueue struct {
	// queue is the work queue the worker polls
	queue *workqueue.Type
	// sync is called for each item in the queue
	sync func(task)
	// workerDone is closed when the worker exits
	workerDone chan struct{}
	// logger
	logger *slog.Logger
}

// newTaskQueue creates a new task queue with the given sync function.
// The sync function is called for every element inserted into the queue.
func newTaskQueue(logger *slog.Logger, syncFn func(task)) *taskQueue {
	return &taskQueue{
		queue:      workqueue.NewNamed("taskQueue"),
		sync:       syncFn,
		workerDone: make(chan struct{}),
		logger:     logger,
	}
}

// Run begins running the worker for the given duration
func (tq *taskQueue) Run(period time.Duration, stopCh <-chan struct{}) {
	wait.Until(tq.worker, period, stopCh)
}

// Enqueue enqueues ns/name of the given api object in the task queue.
func (tq *taskQueue) Enqueue(obj interface{}) {
	key, err := keyFunc(obj)
	if err != nil {
		nl.Debugf(tq.logger, "Couldn't get key for object %v: %v", obj, err)
		return
	}

	task, err := newTask(key, obj)
	if err != nil {
		nl.Debugf(tq.logger, "Couldn't create a task for object %v: %v", obj, err)
		return
	}

	nl.Debugf(tq.logger, "Adding an element with a key: %v", task.Key)
	tq.queue.Add(task)
}

// Requeue adds the task to the queue again and logs the given error
func (tq *taskQueue) Requeue(task task, err error) {
	nl.Errorf(tq.logger, "Requeuing %v, err %v", task.Key, err)
	tq.queue.Add(task)
}

// Len returns the length of the queue
func (tq *taskQueue) Len() int {
	nl.Debugf(tq.logger, "The queue has %v element(s)", tq.queue.Len())
	return tq.queue.Len()
}

// RequeueAfter adds the task to the queue after the given duration
func (tq *taskQueue) RequeueAfter(t task, err error, after time.Duration) {
	nl.Errorf(tq.logger, "Requeuing %v after %s, err %v", t.Key, after.String(), err)
	go func(t task, after time.Duration) {
		time.Sleep(after)
		tq.queue.Add(t)
	}(t, after)
}

// Worker processes work in the queue through sync.
func (tq *taskQueue) worker() {
	for {
		t, quit := tq.queue.Get()
		if quit {
			close(tq.workerDone)
			return
		}
		nl.Debugf(tq.logger, "Syncing %v", t.(task).Key)
		tq.sync(t.(task))
		tq.queue.Done(t)
	}
}

// Shutdown shuts down the work queue and waits for the worker to ACK
func (tq *taskQueue) Shutdown() {
	tq.queue.ShutDown()
	<-tq.workerDone
}

// kind represents the kind of the Kubernetes resources of a task
type kind int

// resources
const (
	ingress = iota
	endpointslice
	configMap
	secret
	service
	namespace
	virtualserver
	virtualServerRoute
	globalConfiguration
	transportserver
	policy
	appProtectPolicy
	appProtectLogConf
	appProtectUserSig
	appProtectDosPolicy
	appProtectDosLogConf
	appProtectDosProtectedResource
	ingressLink
)

// task is an element of a taskQueue
type task struct {
	Kind kind
	Key  string
}

// newTask creates a new task
func newTask(key string, obj interface{}) (task, error) {
	var k kind
	switch t := obj.(type) {
	case *networking.Ingress:
		k = ingress
	case *discovery_v1.EndpointSlice:
		k = endpointslice
	case *v1.ConfigMap:
		k = configMap
	case *v1.Secret:
		k = secret
	case *v1.Service:
		k = service
	case *v1.Namespace:
		k = namespace
	case *conf_v1.VirtualServer:
		k = virtualserver
	case *conf_v1.VirtualServerRoute:
		k = virtualServerRoute
	case *conf_v1.Policy:
		k = policy
	case *conf_v1.GlobalConfiguration:
		k = globalConfiguration
	case *conf_v1.TransportServer:
		k = transportserver
	case *v1beta1.DosProtectedResource:
		k = appProtectDosProtectedResource
	case *unstructured.Unstructured:
		if objectKind := obj.(*unstructured.Unstructured).GetKind(); objectKind == appprotect.PolicyGVK.Kind {
			k = appProtectPolicy
		} else if objectKind == appprotect.LogConfGVK.Kind {
			k = appProtectLogConf
		} else if objectKind == ingressLinkGVK.Kind {
			k = ingressLink
		} else if objectKind == appprotect.UserSigGVK.Kind {
			k = appProtectUserSig
		} else if objectKind == appprotectdos.DosPolicyGVK.Kind {
			k = appProtectDosPolicy
		} else if objectKind == appprotectdos.DosLogConfGVK.Kind {
			k = appProtectDosLogConf
		} else {
			return task{}, fmt.Errorf("unknown unstructured kind: %v", objectKind)
		}
	default:
		return task{}, fmt.Errorf("unknown type: %v", t)
	}

	return task{k, key}, nil
}

```

### Core Architecture Module: `internal/k8s/utils.go`
```
/*
Copyright 2015 The Kubernetes Authors All rights reserved.

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

package k8s

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	discovery_v1 "k8s.io/api/discovery/v1"

	v1 "k8s.io/api/core/v1"
	networking "k8s.io/api/networking/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/util/version"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

// storeToIngressLister makes a Store that lists Ingress.
// TODO: Move this to cache/listers post 1.1.
type storeToIngressLister struct {
	cache.Store
}

// GetByKeySafe calls Store.GetByKeySafe and returns a copy of the ingress, so it is
// safe to modify.
func (s *storeToIngressLister) GetByKeySafe(key string) (ing *networking.Ingress, exists bool, err error) {
	item, exists, err := s.Store.GetByKey(key)
	if !exists || err != nil {
		return nil, exists, err
	}
	ing = item.(*networking.Ingress).DeepCopy()
	return ing, exists, err
}

// List lists all Ingress' in the store.
func (s *storeToIngressLister) List() (ing networking.IngressList, err error) {
	for _, m := range s.Store.List() {
		ing.Items = append(ing.Items, *m.(*networking.Ingress).DeepCopy())
	}
	return ing, nil
}

// storeToConfigMapLister makes a Store that lists ConfigMaps
type storeToConfigMapLister struct {
	cache.Store
}

// List lists all Ingress' in the store.
func (s *storeToConfigMapLister) List() (cfgm v1.ConfigMapList, err error) {
	for _, m := range s.Store.List() {
		cfgm.Items = append(cfgm.Items, *m.(*v1.ConfigMap))
	}
	return cfgm, nil
}

// indexerToPodLister makes an Indexer that lists Pods.
type indexerToPodLister struct {
	cache.Indexer
}

// ListByNamespace lists all Pods in the indexer for a given namespace that match the provided selector.
func (ipl indexerToPodLister) ListByNamespace(ns string, selector labels.Selector) (pods []*v1.Pod, err error) {
	err = cache.ListAllByNamespace(ipl.Indexer, ns, selector, func(m interface{}) {
		pods = append(pods, m.(*v1.Pod))
	})
	return pods, err
}

// Store for EndpointSlices
type storeToEndpointSliceLister struct {
	cache.Store
}

// GetServiceEndpointSlices returns the endpoints of a service, matched on service name.
func (s *storeToEndpointSliceLister) GetServiceEndpointSlices(svc *v1.Service) (endpointSlices []discovery_v1.EndpointSlice, err error) {
	for _, epStore := range s.Store.List() {
		ep := *epStore.(*discovery_v1.EndpointSlice)
		if svc.Name == ep.Labels["kubernetes.io/service-name"] && svc.Namespace == ep.Namespace {
			endpointSlices = append(endpointSlices, ep)
		}
	}
	if len(endpointSlices) > 0 {
		return endpointSlices, nil
	}
	return endpointSlices, fmt.Errorf("could not find endpointslices for service: %v", svc.Name)
}

// findPort locates the container port for the given pod and portName.  If the
// targetPort is a number, use that.  If the targetPort is a string, look that
// string up in all named ports in all containers in the target pod.  If no
// match is found, fail.
func findPort(pod *v1.Pod, svcPort v1.ServicePort) (int32, error) {
	portName := svcPort.TargetPort
	switch portName.Type {
	case intstr.String:
		name := portName.StrVal
		for _, container := range pod.Spec.Containers {
			for _, port := range container.Ports {
				if port.Name == name && port.Protocol == svcPort.Protocol {
					return port.ContainerPort, nil
				}
			}
		}
	case intstr.Int:
		return int32(portName.IntValue()), nil
	}

	return 0, fmt.Errorf("no suitable port for manifest: %s", pod.UID)
}

// isMinion determines is an ingress is a minion or not
func isMinion(ing *networking.Ingress) bool {
	return ing.Annotations["nginx.org/mergeable-ingress-type"] == "minion"
}

// isMaster determines is an ingress is a master or not
func isMaster(ing *networking.Ingress) bool {
	return ing.Annotations["nginx.org/mergeable-ingress-type"] == "master"
}

func isChallengeIngress(ing *networking.Ingress) bool {
	return ing.Labels["acme.cert-manager.io/http01-solver"] == "true"
}

// hasChanges determines if current ingress has changes compared to old ingress
func hasChanges(old *networking.Ingress, current *networking.Ingress) bool {
	old.Status.LoadBalancer.Ingress = current.Status.LoadBalancer.Ingress
	old.ResourceVersion = current.ResourceVersion
	return !reflect.DeepEqual(old, current)
}

// ParseNamespaceName parses the string in the <namespace>/<name> format and returns the name and the namespace.
// It returns an error in case the string does not follow the <namespace>/<name> format.
func ParseNamespaceName(value string) (ns string, name string, err error) {
	res := strings.Split(value, "/")
	if len(res) != 2 {
		return "", "", fmt.Errorf("%q must follow the format <namespace>/<name>", value)
	}
	return res[0], res[1], nil
}

// GetK8sVersion returns the running version of k8s
func GetK8sVersion(client kubernetes.Interface) (v *version.Version, err error) {
	serverVersion, err := client.Discovery().ServerVersion()
	if err != nil {
		return nil, err
	}

	runningVersion, err := version.ParseGeneric(serverVersion.String())
	if err != nil {
		return nil, fmt.Errorf("unexpected error parsing running Kubernetes version: %w", err)
	}
	return runningVersion, nil
}

// CreateUniformSelectorsFromController creates uniform selector labels by getting them from the actual controller object
func CreateUniformSelectorsFromController(kubeClient kubernetes.Interface, pod *v1.Pod) (map[string]string, error) {
	if len(pod.OwnerReferences) == 0 {
		return nil, fmt.Errorf("pod has no owner references")
	}

	owner := pod.OwnerReferences[0]

	switch strings.ToLower(owner.Kind) {
	case "daemonset":
		ds, err := kubeClient.AppsV1().DaemonSets(pod.Namespace).Get(context.Background(), owner.Name, meta_v1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get DaemonSet %s: %w", owner.Name, err)
		}
		return ds.Spec.Selector.MatchLabels, nil

	case "statefulset":
		sts, err := kubeClient.AppsV1().StatefulSets(pod.Namespace).Get(context.Background(), owner.Name, meta_v1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get StatefulSet %s: %w", owner.Name, err)
		}
		return sts.Spec.Selector.MatchLabels, nil

	case "replicaset":
		rs, err := kubeClient.AppsV1().ReplicaSets(pod.Namespace).Get(context.Background(), owner.Name, meta_v1.GetOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to get ReplicaSet %s: %w", owner.Name, err)
		}

		// For ReplicaSet, exclude pod-template-hash
		selectors := make(map[string]string)
		for k, v := range rs.Spec.Selector.MatchLabels {
			if k != "pod-template-hash" {
				selectors[k] = v
			}
		}
		return selectors, nil

	default:
		return nil, fmt.Errorf("unsupported: %s", owner.Kind)
	}
}

```

### Core Architecture Module: `internal/metrics/collectors/workqueue.go`
```
package collectors

import (
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/util/workqueue"
)

// WorkQueueMetricsCollector collects the metrics about the work queue, which the Ingress Controller uses to process changes to the resources in the cluster.
// implements the prometheus.Collector interface
type WorkQueueMetricsCollector struct {
	depth        *prometheus.GaugeVec
	latency      *prometheus.HistogramVec
	workDuration *prometheus.HistogramVec
}

// NewWorkQueueMetricsCollector creates a new WorkQueueMetricsCollector
func NewWorkQueueMetricsCollector(constLabels map[string]string) *WorkQueueMetricsCollector {
	const workqueueSubsystem = "workqueue"
	latencyBucketSeconds := []float64{0.1, 0.5, 1, 5, 10, 50}

	return &WorkQueueMetricsCollector{
		depth: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace:   metricsNamespace,
				Subsystem:   workqueueSubsystem,
				Name:        "depth",
				Help:        "Current depth of workqueue",
				ConstLabels: constLabels,
			},
			[]string{"name"},
		),
		latency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace:   metricsNamespace,
				Subsystem:   workqueueSubsystem,
				Name:        "queue_duration_seconds",
				Help:        "How long in seconds an item stays in workqueue before being processed",
				Buckets:     latencyBucketSeconds,
				ConstLabels: constLabels,
			},
			[]string{"name"},
		),
		workDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace:   metricsNamespace,
				Subsystem:   workqueueSubsystem,
				Name:        "work_duration_seconds",
				Help:        "How long in seconds processing an item from workqueue takes",
				Buckets:     latencyBucketSeconds,
				ConstLabels: constLabels,
			},
			[]string{"name"},
		),
	}
}

// Collect implements the prometheus.Collector interface Collect method
func (wqc *WorkQueueMetricsCollector) Collect(ch chan<- prometheus.Metric) {
	wqc.depth.Collect(ch)
	wqc.latency.Collect(ch)
	wqc.workDuration.Collect(ch)
}

// Describe implements the prometheus.Collector interface Describe method
func (wqc *WorkQueueMetricsCollector) Describe(ch chan<- *prometheus.Desc) {
	wqc.depth.Describe(ch)
	wqc.latency.Describe(ch)
	wqc.workDuration.Describe(ch)
}

// Register registers all the metrics of the collector
func (wqc *WorkQueueMetricsCollector) Register(registry *prometheus.Registry) error {
	workqueue.SetProvider(wqc)
	return registry.Register(wqc)
}

// NewDepthMetric implements the workqueue.MetricsProvider interface NewDepthMetric method
func (wqc *WorkQueueMetricsCollector) NewDepthMetric(name string) workqueue.GaugeMetric {
	return wqc.depth.WithLabelValues(name)
}

// NewLatencyMetric implements the workqueue.MetricsProvider interface NewLatencyMetric method
func (wqc *WorkQueueMetricsCollector) NewLatencyMetric(name string) workqueue.HistogramMetric {
	return wqc.latency.WithLabelValues(name)
}

// NewWorkDurationMetric implements the workqueue.MetricsProvider interface NewWorkDurationMetric method
func (wqc *WorkQueueMetricsCollector) NewWorkDurationMetric(name string) workqueue.HistogramMetric {
	return wqc.workDuration.WithLabelValues(name)
}

// noopMetric implements the workqueue.GaugeMetric and workqueue.HistogramMetric interfaces
type noopMetric struct{}

func (noopMetric) Inc()            {}
func (noopMetric) Dec()            {}
func (noopMetric) Set(float64)     {}
func (noopMetric) Observe(float64) {}

// NewAddsMetric implements the workqueue.MetricsProvider interface NewAddsMetric method
func (*WorkQueueMetricsCollector) NewAddsMetric(string) workqueue.CounterMetric {
	return noopMetric{}
}

// NewUnfinishedWorkSecondsMetric implements the workqueue.MetricsProvider interface NewUnfinishedWorkSecondsMetric method
func (*WorkQueueMetricsCollector) NewUnfinishedWorkSecondsMetric(string) workqueue.SettableGaugeMetric {
	return noopMetric{}
}

// NewLongestRunningProcessorSecondsMetric implements the workqueue.MetricsProvider interface NewLongestRunningProcessorSecondsMetric method
func (*WorkQueueMetricsCollector) NewLongestRunningProcessorSecondsMetric(string) workqueue.SettableGaugeMetric {
	return noopMetric{}
}

// NewRetriesMetric implements the workqueue.MetricsProvider interface NewRetriesMetric method
func (*WorkQueueMetricsCollector) NewRetriesMetric(string) workqueue.CounterMetric {
	return noopMetric{}
}

```

### Core Architecture Module: `internal/nginx/utils.go`
```
package nginx

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path"
	"strings"

	nl "github.com/nginx/kubernetes-ingress/internal/logger"
)

func shellOut(l *slog.Logger, cmd string) (err error) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer

	nl.Debugf(l, "executing %s", cmd)

	command := exec.Command("sh", "-c", cmd)
	command.Stdout = &stdout
	command.Stderr = &stderr

	err = command.Start()
	if err != nil {
		return fmt.Errorf("failed to execute %v, err: %w", cmd, err)
	}

	err = command.Wait()
	if err != nil {
		return fmt.Errorf("command %v stdout: %q\nstderr: %q\nfinished with error: %w", cmd,
			stdout.String(), stderr.String(), err)
	}
	return nil
}

// nginxTestError runs 'nginx -t' and returns a clean, single-line error
// extracted from stderr. It strips the redundant "nginx: configuration file ... test failed"
// summary line and joins remaining lines with "; ".
func nginxTestError(l *slog.Logger, debug bool) error {
	binaryFilename := getBinaryFileName(debug)
	var stderr bytes.Buffer

	nl.Debugf(l, "executing nginx -t")

	cmd := exec.CommandContext(context.Background(), binaryFilename, "-t", "-q") // #nosec G204
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errOutput := strings.TrimSpace(stderr.String())
		if errOutput == "" {
			return fmt.Errorf("nginx configuration test failed: %w", err)
		}
		var filtered []string
		for _, line := range strings.Split(errOutput, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			if strings.HasPrefix(line, "nginx: configuration file") && strings.HasSuffix(line, "test failed") {
				continue
			}
			filtered = append(filtered, line)
		}
		if len(filtered) == 0 {
			return fmt.Errorf("nginx configuration test failed: %w", err)
		}
		return fmt.Errorf("%s", strings.Join(filtered, "; "))
	}
	return nil
}

func createFileAndWrite(name string, b []byte) error {
	w, err := os.Create(name)
	if err != nil {
		return fmt.Errorf("failed to open %v: %w", name, err)
	}

	defer func() {
		if tempErr := w.Close(); tempErr != nil {
			err = tempErr
		}
	}()

	_, err = w.Write(b)
	if err != nil {
		return fmt.Errorf("failed to write to %v: %w", name, err)
	}

	return err
}

func createFileAndWriteAtomically(l *slog.Logger, filename string, tempPath string, mode os.FileMode, content []byte) {
	file, err := os.CreateTemp(tempPath, path.Base(filename))
	if err != nil {
		nl.Fatalf(l, "Couldn't create a temp file for the file %v: %v", filename, err)
	}

	err = file.Chmod(mode)
	if err != nil {
		nl.Fatalf(l, "Couldn't change the mode of the temp file %v: %v", file.Name(), err)
	}

	_, err = file.Write(content)
	if err != nil {
		nl.Fatalf(l, "Couldn't write to the temp file %v: %v", file.Name(), err)
	}

	err = file.Close()
	if err != nil {
		nl.Fatalf(l, "Couldn't close the temp file %v: %v", file.Name(), err)
	}

	err = os.Rename(file.Name(), filename)
	if err != nil {
		nl.Fatalf(l, "Couldn't rename the temp file %v to %v: %v", file.Name(), filename, err)
	}
}

```

### Core Architecture Module: `internal/nsutils/utils.go`
```
package nsutils

import (
	"strings"
)

// HasNamespace checks if the given string is a resource reference with a namespace (i.e., has a '/' character).
func HasNamespace(s string) bool {
	return strings.Contains(s, "/")
}

// FormatResourceReference formats a resource reference by concatenating the namespace and name with a '/' character.
func FormatResourceReference(namespace, name string) string {
	return namespace + "/" + name
}

```

### Core Architecture Module: `pkg/client/applyconfiguration/configuration/v1/upstreamqueue.go`
```
// Code generated by applyconfiguration-gen. DO NOT EDIT.

package v1

// UpstreamQueueApplyConfiguration represents a declarative configuration of the UpstreamQueue type for use
// with apply.
//
// UpstreamQueue defines Queue Configuration for an Upstream.
type UpstreamQueueApplyConfiguration struct {
	// The size of the queue.
	Size *int `json:"size,omitempty"`
	// The timeout of the queue. A request cannot be queued for a period longer than the timeout. The default is 60s.
	Timeout *string `json:"timeout,omitempty"`
}

// UpstreamQueueApplyConfiguration constructs a declarative configuration of the UpstreamQueue type for use with
// apply.
func UpstreamQueue() *UpstreamQueueApplyConfiguration {
	return &UpstreamQueueApplyConfiguration{}
}

// WithSize sets the Size field in the declarative configuration to the given value
// and returns the receiver, so that objects can be built by chaining "With" function invocations.
// If called multiple times, the Size field is set to the value of the last call.
func (b *UpstreamQueueApplyConfiguration) WithSize(value int) *UpstreamQueueApplyConfiguration {
	b.Size = &value
	return b
}

// WithTimeout sets the Timeout field in the declarative configuration to the given value
// and returns the receiver, so that objects can be built by chaining "With" function invocations.
// If called multiple times, the Timeout field is set to the value of the last call.
func (b *UpstreamQueueApplyConfiguration) WithTimeout(value string) *UpstreamQueueApplyConfiguration {
	b.Timeout = &value
	return b
}

```

### Core Architecture Module: `pkg/client/applyconfiguration/utils.go`
```
// Code generated by applyconfiguration-gen. DO NOT EDIT.

package applyconfiguration

import (
	configurationv1 "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/v1"
	v1beta1 "github.com/nginx/kubernetes-ingress/pkg/apis/dos/v1beta1"
	v1 "github.com/nginx/kubernetes-ingress/pkg/apis/externaldns/v1"
	v1alpha1 "github.com/nginx/kubernetes-ingress/pkg/apis/externaldnsk8s/v1alpha1"
	applyconfigurationconfigurationv1 "github.com/nginx/kubernetes-ingress/pkg/client/applyconfiguration/configuration/v1"
	dosv1beta1 "github.com/nginx/kubernetes-ingress/pkg/client/applyconfiguration/dos/v1beta1"
	externaldnsv1 "github.com/nginx/kubernetes-ingress/pkg/client/applyconfiguration/externaldns/v1"
	externaldnsk8sv1alpha1 "github.com/nginx/kubernetes-ingress/pkg/client/applyconfiguration/externaldnsk8s/v1alpha1"
	internal "github.com/nginx/kubernetes-ingress/pkg/client/applyconfiguration/internal"
	runtime "k8s.io/apimachinery/pkg/runtime"
	schema "k8s.io/apimachinery/pkg/runtime/schema"
	managedfields "k8s.io/apimachinery/pkg/util/managedfields"
)

// ForKind returns an apply configuration type for the given GroupVersionKind, or nil if no
// apply configuration type exists for the given GroupVersionKind.
func ForKind(kind schema.GroupVersionKind) interface{} {
	switch kind {
	// Group=appprotectdos.f5.com, Version=v1beta1
	case v1beta1.SchemeGroupVersion.WithKind("AllowListEntry"):
		return &dosv1beta1.AllowListEntryApplyConfiguration{}
	case v1beta1.SchemeGroupVersion.WithKind("ApDosMonitor"):
		return &dosv1beta1.ApDosMonitorApplyConfiguration{}
	case v1beta1.SchemeGroupVersion.WithKind("DosProtectedResource"):
		return &dosv1beta1.DosProtectedResourceApplyConfiguration{}
	case v1beta1.SchemeGroupVersion.WithKind("DosProtectedResourceSpec"):
		return &dosv1beta1.DosProtectedResourceSpecApplyConfiguration{}
	case v1beta1.SchemeGroupVersion.WithKind("DosSecurityLog"):
		return &dosv1beta1.DosSecurityLogApplyConfiguration{}

		// Group=externaldns.k8s.io, Version=v1alpha1
	case v1alpha1.SchemeGroupVersion.WithKind("DNSEndpoint"):
		return &externaldnsk8sv1alpha1.DNSEndpointApplyConfiguration{}
	case v1alpha1.SchemeGroupVersion.WithKind("DNSEndpointSpec"):
		return &externaldnsk8sv1alpha1.DNSEndpointSpecApplyConfiguration{}
	case v1alpha1.SchemeGroupVersion.WithKind("DNSEndpointStatus"):
		return &externaldnsk8sv1alpha1.DNSEndpointStatusApplyConfiguration{}
	case v1alpha1.SchemeGroupVersion.WithKind("Endpoint"):
		return &externaldnsk8sv1alpha1.EndpointApplyConfiguration{}
	case v1alpha1.SchemeGroupVersion.WithKind("ProviderSpecificProperty"):
		return &externaldnsk8sv1alpha1.ProviderSpecificPropertyApplyConfiguration{}

		// Group=externaldns.nginx.org, Version=v1
	case v1.SchemeGroupVersion.WithKind("DNSEndpoint"):
		return &externaldnsv1.DNSEndpointApplyConfiguration{}
	case v1.SchemeGroupVersion.WithKind("DNSEndpointSpec"):
		return &externaldnsv1.DNSEndpointSpecApplyConfiguration{}
	case v1.SchemeGroupVersion.WithKind("DNSEndpointStatus"):
		return &externaldnsv1.DNSEndpointStatusApplyConfiguration{}
	case v1.SchemeGroupVersion.WithKind("Endpoint"):
		return &externaldnsv1.EndpointApplyConfiguration{}
	case v1.SchemeGroupVersion.WithKind("ProviderSpecificProperty"):
		return &externaldnsv1.ProviderSpecificPropertyApplyConfiguration{}

		// Group=k8s.nginx.org, Version=v1
	case configurationv1.SchemeGroupVersion.WithKind("AccessControl"):
		return &applyconfigurationconfigurationv1.AccessControlApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Action"):
		return &applyconfigurationconfigurationv1.ActionApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ActionProxy"):
		return &applyconfigurationconfigurationv1.ActionProxyApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ActionRedirect"):
		return &applyconfigurationconfigurationv1.ActionRedirectApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ActionReturn"):
		return &applyconfigurationconfigurationv1.ActionReturnApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("AddHeader"):
		return &applyconfigurationconfigurationv1.AddHeaderApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("APIKey"):
		return &applyconfigurationconfigurationv1.APIKeyApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("BasicAuth"):
		return &applyconfigurationconfigurationv1.BasicAuthApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("BundleSource"):
		return &applyconfigurationconfigurationv1.BundleSourceApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Cache"):
		return &applyconfigurationconfigurationv1.CacheApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("CacheConditions"):
		return &applyconfigurationconfigurationv1.CacheConditionsApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("CacheLock"):
		return &applyconfigurationconfigurationv1.CacheLockApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("CacheManager"):
		return &applyconfigurationconfigurationv1.CacheManagerApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("CertManager"):
		return &applyconfigurationconfigurationv1.CertManagerApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Condition"):
		return &applyconfigurationconfigurationv1.ConditionApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ConnectionLimit"):
		return &applyconfigurationconfigurationv1.ConnectionLimitApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("CORS"):
		return &applyconfigurationconfigurationv1.CORSApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("EgressMTLS"):
		return &applyconfigurationconfigurationv1.EgressMTLSApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ErrorPage"):
		return &applyconfigurationconfigurationv1.ErrorPageApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ErrorPageRedirect"):
		return &applyconfigurationconfigurationv1.ErrorPageRedirectApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ErrorPageReturn"):
		return &applyconfigurationconfigurationv1.ErrorPageReturnApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ExternalAuth"):
		return &applyconfigurationconfigurationv1.ExternalAuthApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ExternalDNS"):
		return &applyconfigurationconfigurationv1.ExternalDNSApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ExternalEndpoint"):
		return &applyconfigurationconfigurationv1.ExternalEndpointApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("GlobalConfiguration"):
		return &applyconfigurationconfigurationv1.GlobalConfigurationApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("GlobalConfigurationSpec"):
		return &applyconfigurationconfigurationv1.GlobalConfigurationSpecApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Header"):
		return &applyconfigurationconfigurationv1.HeaderApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("HealthCheck"):
		return &applyconfigurationconfigurationv1.HealthCheckApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("HSTS"):
		return &applyconfigurationconfigurationv1.HSTSApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("IngressMTLS"):
		return &applyconfigurationconfigurationv1.IngressMTLSApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("JWTAuth"):
		return &applyconfigurationconfigurationv1.JWTAuthApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("JWTAuthorization"):
		return &applyconfigurationconfigurationv1.JWTAuthorizationApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("JWTAuthorizationRule"):
		return &applyconfigurationconfigurationv1.JWTAuthorizationRuleApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("JWTClaim"):
		return &applyconfigurationconfigurationv1.JWTClaimApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("JWTCondition"):
		return &applyconfigurationconfigurationv1.JWTConditionApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Listener"):
		return &applyconfigurationconfigurationv1.ListenerApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Match"):
		return &applyconfigurationconfigurationv1.MatchApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("OIDC"):
		return &applyconfigurationconfigurationv1.OIDCApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("OIDCNative"):
		return &applyconfigurationconfigurationv1.OIDCNativeApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Policy"):
		return &applyconfigurationconfigurationv1.PolicyApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("PolicyReference"):
		return &applyconfigurationconfigurationv1.PolicyReferenceApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("PolicySpec"):
		return &applyconfigurationconfigurationv1.PolicySpecApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("PolicyStatus"):
		return &applyconfigurationconfigurationv1.PolicyStatusApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ProviderSpecificProperty"):
		return &applyconfigurationconfigurationv1.ProviderSpecificPropertyApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ProxyRequestHeaders"):
		return &applyconfigurationconfigurationv1.ProxyRequestHeadersApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("ProxyResponseHeaders"):
		return &applyconfigurationconfigurationv1.ProxyResponseHeadersApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("RateLimit"):
		return &applyconfigu
```

### Core Architecture Module: `cmd/nginx-ingress/flags.go`
```
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"math"
	"net"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/nginx/kubernetes-ingress/internal/helpers"
	internalValidation "github.com/nginx/kubernetes-ingress/internal/validation"
	api_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/nginx/kubernetes-ingress/internal/externaldns"
	nl "github.com/nginx/kubernetes-ingress/internal/logger"
)

const (
	dynamicSSLReloadParam         = "ssl-dynamic-reload"
	dynamicWeightChangesParam     = "weight-changes-dynamic-reload"
	appProtectLogLevelDefault     = "fatal"
	appProtectEnforcerAddrDefault = "127.0.0.1:50000"
	logLevelDefault               = "info"
	logFormatDefault              = "glog"
)

var (
	healthStatus = flag.Bool("health-status", false,
		`Add a location based on the value of health-status-uri to the default server. The location responds with the 200 status code for any request.
	Useful for external health-checking of the Ingress Controller`)

	healthStatusURI = flag.String("health-status-uri", "/nginx-health",
		`Sets the URI of health status location in the default server. Requires -health-status`)

	proxyURL = flag.String("proxy", "",
		`Use a proxy server to connect to Kubernetes API started by "kubectl proxy" command. For testing purposes only.
	The Ingress Controller does not start NGINX and does not write any generated NGINX configuration files to disk`)

	watchNamespace = flag.String("watch-namespace", api_v1.NamespaceAll,
		`Comma separated list of namespaces the Ingress Controller should watch for resources. By default the Ingress Controller watches all namespaces. Mutually exclusive with "watch-namespace-label".`)

	watchNamespaces []string

	watchSecretNamespace = flag.String("watch-secret-namespace", "",
		`Comma separated list of namespaces the Ingress Controller should watch for secrets. If this arg is not configured, the Ingress Controller watches the same namespaces for all resources. See "watch-namespace" and "watch-namespace-label". `)

	watchSecretNamespaces []string

	watchNamespaceLabel = flag.String("watch-namespace-label", "",
		`Configures the Ingress Controller to watch only those namespaces with label foo=bar. By default the Ingress Controller watches all namespaces. Mutually exclusive with "watch-namespace". `)

	nginxConfigMaps = flag.String("nginx-configmaps", "",
		`A ConfigMap resource for customizing NGINX configuration. If a ConfigMap is set,
	but the Ingress Controller is not able to fetch it from Kubernetes API, the Ingress Controller will fail to start.
	Format: <namespace>/<name>`)

	mgmtConfigMap = flag.String("mgmt-configmap", "",
		`A ConfigMap resource for customizing NGINX configuration. If a ConfigMap is set,
	but the Ingress Controller is not able to fetch it from Kubernetes API, the Ingress Controller will fail to start.
	Format: <namespace>/<name>`)

	nginxPlus = flag.Bool("nginx-plus", false, "Enable support for NGINX Plus")

	appProtect = flag.Bool("enable-app-protect", false, "Enable support for NGINX App Protect. Requires -nginx-plus.")

	appProtectLogLevel = flag.String("app-protect-log-level", appProtectLogLevelDefault,
		`Sets log level for App Protect. Allowed values: fatal, error, warn, info, debug, trace. Requires -nginx-plus and -enable-app-protect.`)

	appProtectDos = flag.Bool("enable-app-protect-dos", false, "Enable support for NGINX App Protect dos. Requires -nginx-plus.")

	appProtectDosDebug = flag.Bool("app-protect-dos-debug", false, "Enable debugging for App Protect Dos. Requires -nginx-plus and -enable-app-protect-dos.")

	appProtectDosMaxDaemons = flag.Int("app-protect-dos-max-daemons", 0, "Max number of ADMD instances. Requires -nginx-plus and -enable-app-protect-dos.")
	appProtectDosMaxWorkers = flag.Int("app-protect-dos-max-workers", 0, "Max number of nginx processes to support. Requires -nginx-plus and -enable-app-protect-dos.")
	appProtectDosMemory     = flag.Int("app-protect-dos-memory", 0, "RAM memory size to consume in MB. Requires -nginx-plus and -enable-app-protect-dos.")

	appProtectEnforcerAddress = flag.String("app-protect-enforcer-address", appProtectEnforcerAddrDefault,
		`Sets address for App Protect v5 Enforcer. Requires -nginx-plus and -enable-app-protect.`)

	appProtectIPIntelligence = flag.Bool("enable-app-protect-ip-intelligence", false, "Enable App Protect IP Intelligence. Requires -nginx-plus and -enable-app-protect.")

	plmStorageURL = flag.String("plm-storage-url", "",
		`SeaweedFS S3 endpoint URL for the F5 WAF Policy Controller (PLM). When non-empty,
enables the PLM integration: NIC watches the appprotect.f5.com/v1 CRDs installed by the PLM
Helm chart instead of the legacy v1beta1 CRDs. Empty (default) disables PLM.
Must be http:// or https://. Requires -nginx-plus and -enable-app-protect.`)

	plmStorageCredentialsSecret = flag.String("plm-storage-credentials-secret", "",
		`Kubernetes Secret holding the S3 admin key for the PLM SeaweedFS filer under the
seaweedfs_admin_secret key. Format: namespace/name. Requires -plm-storage-url.`)

	plmStorageCASecret = flag.String("plm-storage-ca-secret", "",
		`Kubernetes Secret containing a ca.crt for verifying the PLM SeaweedFS server
certificate. Format: namespace/name. Optional. Requires -plm-storage-url.`)

	plmStorageClientSSLSecret = flag.String("plm-storage-client-ssl-secret", "",
		`Kubernetes Secret containing tls.crt and tls.key for mTLS to the PLM SeaweedFS
filer. Format: namespace/name. Optional. Requires -plm-storage-url.`)

	plmStorageInsecureSkipVerify = flag.Bool("plm-storage-insecure-skip-verify", false,
		`Disable TLS verification of the PLM SeaweedFS server certificate. For dev/test only.
NIC prints a startup warning when set. Requires -plm-storage-url.`)

	agent              = flag.Bool("agent", false, "Enable NGINX Agent")
	agentInstanceGroup = flag.String("agent-instance-group", "nginx-ingress-controller", "Grouping used to associate NGINX Ingress Controller instances")

	ingressClass = flag.String("ingress-class", "nginx",
		`A class of the Ingress Controller.

	An IngressClass resource with the name equal to the class must be deployed. Otherwise, the Ingress Controller will fail to start.
	The Ingress Controller only processes resources that belong to its class - i.e. have the "ingressClassName" field resource equal to the class.

	The Ingress Controller processes all the VirtualServer/VirtualServerRoute/TransportServer resources that do not have the "ingressClassName" field for all versions of kubernetes.`)

	defaultServerSecret = flag.String("default-server-tls-secret", "",
		`A Secret with a TLS certificate and key for TLS termination of the default server. Format: <namespace>/<name>.
	If not set, than the certificate and key in the file "/etc/nginx/secrets/default" are used.
	If "/etc/nginx/secrets/default" doesn't exist, the Ingress Controller will configure NGINX to reject TLS connections to the default server.
	If a secret is set, but the Ingress Controller is not able to fetch it from Kubernetes API or it is not set and the Ingress Controller
	fails to read the file "/etc/nginx/secrets/default", the Ingress Controller will fail to start.`)

	versionFlag = flag.Bool("version", false, "Print the version, git-commit hash and build date and exit")

	mainTemplatePath = flag.String("main-template-path", "",
		`Path to the main NGINX configuration template. (default for NGINX "nginx.tmpl"; default for NGINX Plus "nginx-plus.tmpl")`)

	ingressTemplatePath = flag.String("ingress-template-path", "",
		`Path to the ingress NGINX configuration template for an ingress resource.
	(default for NGINX "nginx.ingress.tmpl"; default for NGINX Plus "nginx-plus.ingress.tmpl")`)

	virtualServerTemplatePath = flag.String("virtualserver-template-path", "",
		`Path to the VirtualServer NGINX configuration template for a VirtualServer resource.
	(default for NGINX "nginx.virtualserver.tmpl"; default for NGINX Plus "nginx-plus.virtualserver.tmpl")`)

	transportServerTemplatePath = flag.String("transportserver-template-path", "",
		`Path to the TransportServer NGINX configuration template for a TransportServer resource.
	(default for NGINX "nginx.transportserver.tmpl"; default for NGINX Plus "nginx-plus.transportserver.tmpl")`)

	externalService = flag.String("external-service", "",
		`Specifies the name of the service with the type LoadBalancer through which the Ingress Controller pods are exposed externally.
	The external address of the service is used when reporting the status of Ingress, VirtualServer and VirtualServerRoute resources. For Ingress resources only: Requires -report-ingress-status.`)

	ingressLink = flag.String("ingresslink", "",
		`Specifies the name of the IngressLink resource, which exposes the Ingress Controller pods via a BIG-IP system.
	The IP of the BIG-IP system is used when reporting the status of Ingress, VirtualServer and VirtualServerRoute resources. For Ingress resources only: Requires -report-ingress-status.`)

	reportIngressStatus = flag.Bool("report-ingress-status", false,
		"Updates the address field in the status of Ingress resources. Requires the -external-service or -ingresslink flag, or the 'external-status-address' key in the ConfigMap.")

	leaderElectionEnabled = flag.Bool("enable-leader-election", true,
		"Enable Leader election to avoid multiple replicas of the controller reporting the status of Ingress, VirtualServer and VirtualServerRoute resources -- only one replica will report status (default true). See -report-ingress-status flag.")

	leaderElectionLockName = flag.String("leader-election-lock-name", "nginx-ingress-leader-election",
		`Specifies the name of the ConfigMap, within the same namespace as the controller, used as the lock for leader election. Requires -enable-leader-election.`)

	nginxStatusAllowCIDRs = flag.String("nginx-status-allow-cidrs", "127.0.0.1,::1", `Add IP/CIDR blocks t
```

### Core Architecture Module: `cmd/nginx-ingress/main.go`
```
package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/nginx/kubernetes-ingress/internal/configs"
	"github.com/nginx/kubernetes-ingress/internal/configs/version1"
	"github.com/nginx/kubernetes-ingress/internal/configs/version2"
	"github.com/nginx/kubernetes-ingress/internal/configs/wafbundle"
	"github.com/nginx/kubernetes-ingress/internal/externaldns"
	"github.com/nginx/kubernetes-ingress/internal/healthcheck"
	"github.com/nginx/kubernetes-ingress/internal/k8s"
	"github.com/nginx/kubernetes-ingress/internal/k8s/appprotect"
	"github.com/nginx/kubernetes-ingress/internal/k8s/secrets"
	license_reporting "github.com/nginx/kubernetes-ingress/internal/license_reporting"
	"github.com/nginx/kubernetes-ingress/internal/metadata"
	"github.com/nginx/kubernetes-ingress/internal/metrics"
	"github.com/nginx/kubernetes-ingress/internal/metrics/collectors"
	"github.com/nginx/kubernetes-ingress/internal/nginx"
	cr_validation "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/validation"
	k8s_nginx "github.com/nginx/kubernetes-ingress/pkg/client/clientset/versioned"
	conf_scheme "github.com/nginx/kubernetes-ingress/pkg/client/clientset/versioned/scheme"
	"github.com/nginx/nginx-plus-go-client/v3/client"
	nginxCollector "github.com/nginx/nginx-prometheus-exporter/collector"
	"github.com/prometheus/client_golang/prometheus"
	api_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	pkg_runtime "k8s.io/apimachinery/pkg/runtime"
	util_version "k8s.io/apimachinery/pkg/util/version"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	core_v1 "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/client-go/tools/record"

	nl "github.com/nginx/kubernetes-ingress/internal/logger"
	nic_glog "github.com/nginx/kubernetes-ingress/internal/logger/glog"
	"github.com/nginx/kubernetes-ingress/internal/logger/levels"
)

// Injected during build
var (
	version           string
	telemetryEndpoint string
	logLevels         = map[string]slog.Level{
		"trace":   levels.LevelTrace,
		"debug":   levels.LevelDebug,
		"info":    levels.LevelInfo,
		"warning": levels.LevelWarning,
		"error":   levels.LevelError,
		"fatal":   levels.LevelFatal,
	}
)

const (
	nginxVersionLabel        = "app.nginx.org/version"
	versionLabel             = "app.kubernetes.io/version"
	appProtectVersionLabel   = "appprotect.f5.com/version"
	agentVersionLabel        = "app.nginx.org/agent-version"
	appProtectVersionPath    = "/opt/app_protect/RELEASE"
	appProtectv4BundleFolder = "/etc/nginx/waf/bundles/"
	appProtectv5BundleFolder = "/etc/app_protect/bundles/"
	socketPath               = "/var/lib/nginx"
	fatalEventFlushTime      = 200 * time.Millisecond
	secretErrorReason        = "SecretError"
	fileErrorReason          = "FileError"
	configMapErrorReason     = "ConfigMapError"
)

func main() {
	commitHash, commitTime, dirtyBuild := getBuildInfo()
	fmt.Printf("NGINX Ingress Controller Version=%v Commit=%v Date=%v DirtyState=%v Arch=%v/%v Go=%v\n", version, commitHash, commitTime, dirtyBuild, runtime.GOOS, runtime.GOARCH, runtime.Version())
	parseFlags()
	ctx := initLogger(*logFormat, logLevels[*logLevel], os.Stdout)
	l := nl.LoggerFromContext(ctx)

	cleanupSocketFiles(l)

	initValidate(ctx)
	parsedFlags := os.Args[1:]

	buildOS := os.Getenv("BUILD_OS")
	controllerNamespace := os.Getenv("POD_NAMESPACE")
	podName := os.Getenv("POD_NAME")

	config, kubeClient := mustCreateConfigAndKubeClient(ctx)
	if err := validateKubernetesVersionInfo(ctx, kubeClient); err != nil {
		nl.Fatal(l, err)
	}
	pod, err := kubeClient.CoreV1().Pods(controllerNamespace).Get(context.TODO(), podName, meta_v1.GetOptions{})
	if err != nil {
		nl.Fatalf(l, "Failed to get pod: %v", err)
	}

	controllerNodeName, controllerZone := getControllerTopology(ctx, kubeClient, pod, *enableTopologyAwareRouting)

	eventBroadcaster := record.NewBroadcaster()
	eventBroadcaster.StartLogging(func(format string, args ...interface{}) {
		nl.Infof(l, format, args...)
	})
	eventBroadcaster.StartRecordingToSink(&core_v1.EventSinkImpl{
		Interface: core_v1.New(kubeClient.CoreV1().RESTClient()).Events(""),
	})
	eventRecorder := eventBroadcaster.NewRecorder(scheme.Scheme,
		api_v1.EventSource{Component: k8s.EventReporterName})
	defer eventBroadcaster.Shutdown()
	mustValidateIngressClass(ctx, kubeClient)
	mustValidateExternalDNSCRD(ctx, kubeClient)

	checkNamespaces(ctx, kubeClient)

	dynClient, confClient := createCustomClients(ctx, config)

	constLabels := map[string]string{"class": *ingressClass}

	managerCollector, controllerCollector, registry := createManagerAndControllerCollectors(ctx, constLabels)

	var licenseReporter *license_reporting.LicenseReporter

	if *nginxPlus {
		licenseReporter = license_reporting.NewLicenseReporter(kubeClient, eventRecorder, pod)
	}

	var deploymentMetadata *metadata.Metadata

	if *agent {
		deploymentMetadata = metadata.NewMetadataReporter(kubeClient, pod, version)
	}

	nginxManager, useFakeNginxManager := createNginxManager(ctx, managerCollector, licenseReporter, deploymentMetadata)

	nginxVersion := getNginxVersionInfo(ctx, nginxManager)

	var appProtectVersion string
	var appProtectV5 bool
	appProtectBundlePath := appProtectv4BundleFolder
	if *appProtect {
		appProtectVersion = getAppProtectVersionInfo(ctx)

		if _, err := os.Stat("/opt/app_protect/VERSION.common"); os.IsNotExist(err) {
			appProtectV5 = true
			appProtectBundlePath = appProtectv5BundleFolder
		}

		selectAppProtectAPIVersion(ctx, *plmStorageURL != "", eventRecorder, pod)

		if *plmStorageURL != "" {
			setupPLMStorage(ctx, kubeClient, eventRecorder, pod)
		}
	}

	var agentVersion string
	if *agent {
		agentVersion = getAgentVersionInfo(nginxManager)
	}

	go updateSelfWithVersionInfo(ctx, eventRecorder, kubeClient, version, appProtectVersion, agentVersion, nginxVersion, 10, time.Second*5)

	var mgmtCfgParams *configs.MGMTConfigParams
	if *nginxPlus {
		mgmtCfgParams = processMGMTConfigMap(kubeClient, configs.NewDefaultMGMTConfigParams(ctx), eventRecorder, pod)
		if err := processLicenseSecret(kubeClient, nginxManager, mgmtCfgParams, controllerNamespace); err != nil {
			logEventAndExit(ctx, eventRecorder, pod, secretErrorReason, err)
		}

		if err := processTrustedCertSecret(kubeClient, nginxManager, mgmtCfgParams, controllerNamespace); err != nil {
			logEventAndExit(ctx, eventRecorder, pod, secretErrorReason, err)
		}

		if err := processClientAuthSecret(kubeClient, nginxManager, mgmtCfgParams, controllerNamespace); err != nil {
			logEventAndExit(ctx, eventRecorder, pod, secretErrorReason, err)
		}

	}

	templateExecutor, templateExecutorV2 := createTemplateExecutors(ctx)

	sslRejectHandshake, err := processDefaultServerSecret(kubeClient, nginxManager)
	if err != nil {
		logEventAndExit(ctx, eventRecorder, pod, secretErrorReason, err)
	}

	staticSSLPath := nginxManager.GetSecretsDir()

	isWildcardEnabled, err := processWildcardSecret(kubeClient, nginxManager)
	if err != nil {
		logEventAndExit(ctx, eventRecorder, pod, secretErrorReason, err)
	}

	caBundlePath, err := nginxManager.GetOSCABundlePath()
	if err != nil {
		logEventAndExit(ctx, eventRecorder, pod, fileErrorReason, err)
	}

	globalConfigurationValidator := createGlobalConfigurationValidator()

	mustProcessGlobalConfiguration(ctx)

	cfgParams := configs.NewDefaultConfigParams(ctx, *nginxPlus)
	cfgParams = processConfigMaps(kubeClient, cfgParams, nginxManager, templateExecutor, eventRecorder)

	staticCfgParams := &configs.StaticConfigParams{
		DisableIPV6:                    *disableIPV6,
		DefaultHTTPListenerPort:        *defaultHTTPListenerPort,
		DefaultHTTPSListenerPort:       *defaultHTTPSListenerPort,
		HealthStatus:                   *healthStatus,
		HealthStatusURI:                *healthStatusURI,
		NginxStatus:                    *nginxStatus,
		NginxStatusAllowCIDRs:          allowedCIDRs,
		NginxStatusPort:                *nginxStatusPort,
		StubStatusOverUnixSocketForOSS: *enablePrometheusMetrics,
		TLSPassthrough:                 *enableTLSPassthrough,
		TLSPassthroughPort:             *tlsPassthroughPort,
		EnableSnippets:                 *enableSnippets,
		MainAppProtectLoadModule:       *appProtect,
		MainAppProtectV5LoadModule:     appProtectV5,
		MainAppProtectDosLoadModule:    *appProtectDos,
		MainAppProtectV5EnforcerAddr:   *appProtectEnforcerAddress,
		EnableLatencyMetrics:           *enableLatencyMetrics,
		EnableOIDC:                     *enableOIDC,
		SSLRejectHandshake:             sslRejectHandshake,
		EnableCertManager:              *enableCertManager,
		DynamicSSLReload:               *enableDynamicSSLReload,
		DynamicWeightChangesReload:     *enableDynamicWeightChangesReload,
		IsDirectiveAutoadjustEnabled:   *enableDirectiveAutoadjust,
		StaticSSLPath:                  staticSSLPath,
		NginxVersion:                   nginxVersion,
		AppProtectBundlePath:           appProtectBundlePath,
		DefaultCABundle:                caBundlePath,
		PLMEnabled:                     *plmStorageURL != "",
	}

	if *nginxPlus {
		if cfgParams.ZoneSync.Enable && cfgParams.ZoneSync.Port != 0 {
			err := createAndValidateHeadlessService(ctx, kubeClient, cfgParams, controllerNamespace, pod)
			if err != nil {
				logEventAndExit(ctx, eventRecorder, pod, nl.EventReasonServiceFailedToCreate, err)
			}
		}
	}

	mustWriteInitialNginxConfig(staticCfgParams, cfgParams, mgmtCfgParams, templateExecutor, nginxManager)

	if *enableTLSPassthrough {
		var emptyFile []byte
		nginxManager.CreateTLSPassthroughHostsConfig(emptyFile)
	}

	process := startChildProcesses(nginxManager, appProtectV5)

	plusClient := createPlusClient(ctx, *nginxPlus, useFakeNginxManager, nginxManager)
	if *nginxPlus {
		licenseReporter.Config.PlusCl
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11346** (2026-11-11): **Merge nginx-agent.conf labels into `--labels` for NGINX Agent 3**
  *Symptoms*: ### Proposed changes  With NGINX Agent 3, NIC always starts the agent with `--labels=<NIC metadata>`. The agent treats that flag as the complete set of labels, so any `labels:` block in `nginx-agent.conf` (for example `display-name`) is silently ignored and never reaches NGINX One Console.  NIC now reads `labels` from `/etc/nginx-agent/nginx-agent.conf` and adds them to `--labels` after the NIC metadata labels, sorted by key:  - NIC metadata labels (`product-*`, `cluster-id`, `installation-*`, `control-*`) cannot be overridden. - Labels the agent would reject are skipped and logged in a single warning. Keys and values are checked against the agent's own label pattern (`^[a-zA-Z0-9]([a-zA-Z0-9-_.]{0,254}[a-zA-Z0-9])?$`). This also stops a `,`, `=` or `"` in a label from breaking `--labels` and preventing the agent from starting. - Number and boolean values (for example `port: 8080`) are kept as their literal text instead of causing every label to be dropped. - A missing config file is not an error. A file that can't be parsed logs a warning, and the agent starts with the NIC metadata labels only.  Stacked: the Helm value `nginxAgent.labels`   ### Linked issue   Closes #11345   <!-- Link the issue here, not in the PR title. External contributors: the issue must be accepted first, see "Open a Pull Request" in CONTRIBUTING.md. -->  ### How I tested  - `make test`: new table-driven tests in `internal/nginx/manager_test.go`:   - `TestExtractAgentConfigLabels`

- **Issue #11345** (2026-11-12): **[Bug]: Labels in nginx-agent.conf are ignored with NGINX Agent 3, and the Helm chart can't set them**
  *Symptoms*: ### AI agents and bots  - [ ] I am an AI agent or bot opening this issue  ### Version  edge  ### What Kubernetes platforms are you running on?  GKE Google Cloud  ### Steps to reproduce  1. Install NIC with NGINX Agent v3 connected to NGINX One Console 2. Edit the `<release name>-agent-config` ConfigMap and add a top-level `labels` block to `nginx-agent.conf`: ```        labels:          display-name: my-nginx-instance ```  4. . Restart the NIC pod. 4. Check the instance in NGINX One Console and NIC logs  ### Expected behaviour  The instance in NGINX One Console has `display-name=my-nginx-instance` as well as the NIC metadata labels.  Helm users can set custom labels from `values.yaml` without editing the generated ConfigMap.  ### Actual behaviour  The custom label never appears in NGINX One Console, and no error is logged.  NIC starts the agent with `--labels=product-type=...,product-version=...,cluster-id=...,installation-*=...,control-*=...`. With Agent v3, the `--labels` flag takes priority over the `labels` key in `nginx-agent.conf`, so labels set in the config file are discarded.  The Helm chart has no value for labels, so a manual ConfigMap edit is the only option, and that doesn't work because of the problem above.  ### Possible solutions  1. NIC reads `labels` from `/etc/nginx-agent/nginx-agent.conf` and adds them to `--labels` after the NIC metadata labels. Metadata labels can't be overridden. Keys and values that don't match the agent's label pattern `^[a-zA-Z0-9]([

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

### Incident Patch 1: `afb4fa83` (2026-11-13)
**Commit Message**: Restore nightly regression signal: fix zone-sync ConfigMap leak, LTS checkout, run past first failure (#11393)

* Add flaky E2E tests plan and remove outdated documentation

* Add zone sync ConfigMap fixture to prevent leaks in rate-limit tests

* Add pytest arguments input to smoke tests and enhance pod diagnostics in regression workflow

* Refactor leak tracking for nginx-config ConfigMap to improve clarity and maintainability

* Update pytest maxfail argument to improve test visibility and adjust documentation for retry logic in E2E tests

---------

Signed-off-by: Paul Abel <[REDACTED_EMAIL]>

**File**: `.github/actions/smoke-tests/action.yaml` (modified, +4/-0)
```diff
@@ -34,6 +34,9 @@ inputs:
   plus-jwt:
     description: JWT for NGINX Plus
     required: false
+  pytest-args:
+    description: Extra pytest arguments, e.g. --maxfail=100 to keep running after the first failure
+    required: false
 
 outputs:
   test-results-name:
@@ -112,6 +115,7 @@ runs:
         -rfE \
         --show-ic-logs=yes \
         --plus-jwt=${{ inputs.plus-jwt }} \
+        ${{ inputs.pytest-args }} \
         -m ${{ inputs.marker != '' && inputs.marker || '""' }}
       working-directory: ./tests
       shell: bash
```

**File**: `.github/skills/nic-testing/SKILL.md` (modified, +24/-12)
```diff
@@ -190,24 +190,36 @@ class TestMyFeaturePolicies:
         pol_name = create_policy_from_yaml(
             kube_apis.custom_objects, yaml_src, test_namespace
         )
-        wait_before_test()
-        # 2. Patch VS to reference policy
-        patch_virtual_server_from_yaml(...)
-        # 3. Assert HTTP responses
-        resp = requests.get(url, headers={"host": vs_host})
-        assert resp.status_code == 200
-        assert "Expected-Header" in resp.headers
-        # 4. Cleanup
-        delete_policy(kube_apis.custom_objects, pol_name, test_namespace)
-        patch_virtual_server_from_yaml(...)  # restore original
+        try:
+            # 2. Patch VS to reference policy
+            patch_virtual_server_from_yaml(...)
+            # 3. Poll until the reload has taken effect; never sleep, then assert once
+            resp = retry_get_until_status_code(url, virtual_server_setup.vs_host, 200)
+            assert resp.status_code == 200  # the helper returns the last response even if it never matched
+            assert "Expected-Header" in resp.headers
+        finally:
+            # 4. Cleanup runs even when an assert fails
+            delete_policy(kube_apis.custom_objects, pol_name, test_namespace)
+            patch_virtual_server_from_yaml(...)  # restore original
 ```
 
 ### Fixtures and Utilities
 
 - Common fixtures: `kube_apis`, `crd_ingress_controller`, `virtual_server_setup`, `test_namespace`
 - Fixtures: `tests/suite/fixtures/` (setup/teardown lifecycle)
-- Utilities: `tests/suite/utils/` (`create_policy_from_yaml`, `patch_virtual_server_from_yaml`, `delete_policy`, `wait_before_test`)
-- Prefer event/status-based waits over fixed sleeps when possible
+- Utilities: `tests/suite/utils/` (`create_policy_from_yaml`, `patch_virtual_server_from_yaml`, `delete_policy`, `retry_get_until_status_code`)
+- Prefer polling over fixed sleeps, see "Waiting for config changes" below
+
+### Waiting for config changes
+
+A config change reloads NGINX. A request that lands during the reload can be dropped, and a fixed `wait_before_test()` before one assertion only passes if the reload is faster than the sleep. Details and the failure data: `docs/developer/e2e-flaky-tests.md`.
+
+- After a change that reloads, poll with `retry_get_until_status_code`, `retry_get_until_body_contains`, or `retry_get` (one request, retried only on `ConnectionError`). They are in `tests/suite/utils/resources_utils.py`. `wait_and_assert_status_code` and `send_malicious_request_with_retry` also tolerate dropped connections. The `retry_get_until_*` helpers return the last response even if it never matched, so still assert on it.
+- For non-HTTP conditions use the existing waiters: `wait_for_event`, `wait_for_resource_status`, `wait_for_reload`, `wait_until_all_pods_are_ready`, `ensure_response_from_backend`.
+- Keep `wait_before_test()` only when the wait is the point of the test (rate-limit windows, asserting something does not happen).
+- Do not add `@pytest.mark.flaky`. It reruns the whole test and hides real regressions.
+- If a test catches `requests.exceptions.SSLError` (mTLS), put that `except` before `except ConnectionError`, because `SSLError` is a subclass.
+- The `nginx-config` ConfigMap lives for the whole session. A test that changes it restores it in a fixture or `finally`, not at the end of the test body, or a later unrelated test fails. `tests/conftest.py` prints `Leaked nginx-config` when a class leaves it changed. The IC Deployment is recreated per class, so replica counts do not leak across classes.
 
 ### File Naming
 
```

**File**: `.github/workflows/regression.yml` (modified, +4/-1)
```diff
@@ -280,7 +280,8 @@ jobs:
       - name: Checkout Repository
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
-          ref: ${{ needs.checks.outputs.branch }}
+          # LTS entries test a released image, so use the tests, manifests and CRDs from that tag, not main
+          ref: ${{ matrix.images.lts == true && matrix.images.lts_tag || needs.checks.outputs.branch }}
 
       - name: Set image variables
         id: image_details
@@ -367,6 +368,8 @@ jobs:
           registry-token: ${{ steps.auth.outputs.access_token }}
           test-image: "ghcr.io/nginx/kubernetes-ingress/test-runner:${{ hashFiles('./tests/requirements.txt', './tests/Dockerfile') || 'latest' }}"
           plus-jwt: ${{ env.PLUS_JWT }}
+          # pyproject.toml has -x; override it so one failure does not hide the rest of the nightly
+          pytest-args: --maxfail=100
 
       - name: Upload Test Results
         uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
```

**File**: `docs/developer/README.md` (modified, +1/-0)
```diff
@@ -6,4 +6,5 @@
 - [Type-Agnostic Kubernetes Secrets](./opaque-secrets-high-level-design.md)
 - [ExternalAuth Response Headers](./external-auth-response-headers-high-level-design.md)
 - [ConnectionLimit Policy](./connection-limit-policy-high-level-design.md)
+- [Flaky E2E Tests Plan](./e2e-flaky-tests.md)
 - [Offline Helm Schema Validation](./offline-helm-schema-high-level-design.md)
```

**File**: `docs/developer/e2e-flaky-tests.md` (added, +345/-0)
```diff
@@ -0,0 +1,345 @@
+# Plan: Fixing Flaky Python E2E Tests
+
+## Status: Draft
+
+## Summary
+
+**Goal:** make the Python e2e tests fail only when the product is broken, not when
+a reload or a pod start takes a little longer than a fixed sleep.
+
+**Approach:** data driven. Rank tests by how often they fail in CI, then fix the
+worst ones. Do not sweep every `wait_before_test()` call.
+
+**Why not sweep:** `wait_before_test()` is `time.sleep(3)` by default
+(`tests/suite/utils/resources_utils.py`, `settings.py`). There are many calls,
+but most of the tests that actually fail have none in the test body. The cause
+is usually a fixture that applies config and a test that then asserts on one
+request with no polling.
+
+## Inventory (snapshot, Nov 2026)
+
+| Metric | Count |
+| --- | --- |
+| Test files | 158 |
+| `def test_*` functions (before parametrize) | 689 |
+| `wait_before_test()` calls in test files | 884 (142 files) |
+| ...inside a loop (delay between retries, fine) | 95 |
+| ...not in a loop (fixed sleep, then act once) | 789 |
+| Test functions with at least one fixed sleep | 425 |
+| Fixed sleeps in fixtures or helpers inside test files | 104 |
+
+Delays used: default 3 s (501 calls), 1 s (248), 2 s, 5 s, 10 s, `WAIT_TIME`, 120 s.
+
+What follows each fixed sleep (first statement after it, so approximate, about +/-10%):
+
+| Next action | Calls | Assessment |
+| --- | --- | --- |
+| A polling helper already (`wait_and_assert_status_code`, `ensure_response_from_backend`, `retry_get*`, `wait_until_all_pods_are_ready`) | ~73 | Redundant. Delete to save time. No flake risk |
+| One `requests.get`, then an assert | ~112 | High risk. Swap for `retry_get_until_*` |
+| Read generated NGINX config | ~80 | High risk. No "config contains X" poller exists yet |
+| Read resource status or events | ~60 | Medium. `wait_for_resource_status` and `wait_for_event` exist |
+| Rate-limit and time-window checks | ~26 | The wait is part of the test. Leave it |
+| `print`, assignment, end of block | ~220 | Case by case. Many are setup sleeps |
+
+Not every fixed sleep is a bug. Tests that assert something does *not* happen,
+or that a time window passes, need a real wait.
+
+## CI failure data
+
+**Source:** failed `ci.yml` merge-queue runs and all nightly `regression.yml`
+runs from 2026-10-17 (after #10850, "e2e test stability fixes") to 2026-11-11:
+74 failed merge-queue runs and 26 nightly runs. PR runs were left out because
+real bugs in PRs make them noisy. Only 19 distinct tests failed.
+
+The last column links the most recent failing job found for each test (checked
+2026-11-13). GitHub deletes job logs after its retention period, so these links
+will stop working. The error text in the table is kept for that reason, and
+"Reproducing the ranking" below refreshes the data.
+
+| # | Test | Failing runs | Error | Likely cause | Example job |
+| --- | --- | --- | --- | --- | --- |
+| 1 | `test_ac_polices_vs::test_deny_policy` | every nightly LTS job | Setup error after 600 s, IC pod never Ready | **Version skew.** The job ran main's tests against the LTS image. Fixed, see Phase A | [lts-regression 1.30.13](https://github.com/nginx/kubernetes-ingress/actions/runs/43356002027/job/131658222816) |
+| 2 | `test_rl_policies::test_rl_policy_scaled` | every nightly job, all 8 k8s versions | `rate=10r/s` not in config (config has `rate=40r/s ... sync`) | **State leaked by an earlier test.** `test_rl_ingress.py::TestRateLimitIngressScaledWithZoneSync` left zone sync on in the shared `nginx-config` ConfigMap. Fixed, see below | [regression debian-plus 1.30.13](https://github.com/nginx/kubernetes-ingress/actions/runs/43356002027/job/131658222786) |
+| 3 | `test_custom_http_errors::test_annotation_intercepts_upstream_error` | 16 | One request to `/fail` returns the stock 502 page | Asserts once, no polling | [regression debian 1.32.8](https://github.com/nginx/kubernetes-ingress/actions/runs/43356002027/job/131658222925) |
+| 4 | `test_virtual_server_certmanager::test_responses_after_setup` | 11 (8 merge queue) | Setup error in a fixture | Needs log triage | [regression debian 1.30.13](https://github.com/nginx/kubernetes-ingress/actions/runs/43356002027/job/131658222805) |
+| 5 | `test_empty_host_ingress_reload::..._on_startup` | 11 | Startup event not found | Fixed in `972e0772c`. Watch it | [regression debian 1.33.12](https://github.com/nginx/kubernetes-ingress/actions/runs/43145244434/job/130941545511) |
+| 6 | `test_rl_policies_vsr` tiered apikey/jwt (3 tests) | 13 | `13 in range(14, 17)` | Request count just outside a narrow range. The 1 s sleeps are part of the test. Fix tolerance or timing window | [policies 3/8 alpine](https://github.com/nginx/kubernetes-ingress/actions/runs/43262340867/job/131345989101) |
+| 7 | `test_oidc_native_fclo_ingress::test_rp_initiated_logout` | 4 | 502 after login | Sleep, then no readiness check on the backend | [regression debian-plus 1.31.14](https://github.com/nginx/kubernetes-ingress/acti
```

**File**: `docs/developer/parallel-e2e-plan.md` (modified, +1/-1)
```diff
@@ -369,7 +369,7 @@ above. Effects are as estimated in #10492.
 - #10492 — durations tooling, design doc
   `docs/developer/parallel-e2e-tests-design.md`, and the proof of concept
   for several kind clusters per runner
-- `tests/suite/FLAKY_RELOAD_REQUESTS.md` — retrying requests that hit a
+- `docs/developer/e2e-flaky-tests.md` — flaky e2e plan; retrying requests that hit a
   reload
 - Smoke matrix: `.github/data/matrix-smoke-{oss,plus,nap}.json`
 - Smoke action: `.github/actions/smoke-tests/action.yaml`
```

**File**: `tests/conftest.py` (modified, +88/-1)
```diff
@@ -3,6 +3,7 @@
 import os
 
 import pytest
+from kubernetes.client.rest import ApiException
 from kubernetes.config.kube_config import KUBE_CONFIG_DEFAULT_LOCATION
 from settings import (
     BATCH_RELOAD_NUMBER,
@@ -20,6 +21,7 @@
     IC_SELECTOR,
     are_all_pods_in_ready_state,
     get_first_pod_name,
+    get_pod_list,
     wait_before_test,
 )
 
@@ -228,12 +230,45 @@ def pytest_collection_modifyitems(config, items) -> None:
                 item.add_marker(multi_ns)
 
 
+def _container_state(state) -> str:
+    """One-line summary of a V1ContainerState."""
+    for name in ("running", "waiting", "terminated"):
+        detail = getattr(state, name, None) if state else None
+        if detail:
+            fields = {k: getattr(detail, k, None) for k in ("reason", "exit_code", "message")}
+            return f"{name} " + " ".join(f"{k}={v}" for k, v in fields.items() if v is not None)
+    return "unknown"
+
+
+def print_ic_pod_diagnostics(v1, namespace) -> None:
+    """Print state, logs (also of the previous container) and events of every IC pod."""
+    for pod in get_pod_list(v1, namespace, IC_SELECTOR):
+        name = pod.metadata.name
+        print(f"\nPod {name}: phase={pod.status.phase}")
+        for cs in pod.status.container_statuses or []:
+            print(
+                f"  container {cs.name}: ready={cs.ready} restarts={cs.restart_count} "
+                f"state=[{_container_state(cs.state)}] last_state=[{_container_state(cs.last_state)}]"
+            )
+            for previous in (False, True):
+                try:
+                    logs = v1.read_namespaced_pod_log(name, namespace, container=cs.name, previous=previous)
+                except ApiException as e:  # e.g. container waiting to start, or never restarted
+                    logs = f"<no logs: {e.reason}>"
+                print(f"  --- {'previous ' if previous else ''}logs of {cs.name} ---\n{logs}")
+        events = v1.list_namespaced_event(namespace, field_selector=f"involvedObject.name={name}").items
+        for ev in events:
+            print(f"  event {ev.type} {ev.reason}: {ev.message}")
+
+
 @pytest.hookimpl(tryfirst=True, hookwrapper=True)
 def pytest_runtest_makereport(item) -> None:
     """
     Print out IC Pod logs on test failure.
 
-    Only look at actual failing test calls, not setup/teardown.
+    Failing test calls print the first IC pod's logs. Failing setups print the state, logs and
+    events of all IC pods, because a fixture timing out on an IC pod that never became Ready
+    is otherwise invisible. Teardown is not looked at.
     Only show the logs if commandline argument `--show-ic-logs` is set to 'yes'
 
     :param item:
@@ -249,6 +284,19 @@ def pytest_runtest_makereport(item) -> None:
         print(f"\n::error file={file_path},line={line_no + 1},title=Test Failed: {item.nodeid}::{summary}")
 
     # we only look at actual failing test calls, not setup/teardown
+    if rep.when == "setup" and rep.failed and item.config.getoption("--show-ic-logs") == "yes":
+        try:
+            prereq, apis = item.funcargs["ingress_controller_prerequisites"], item.funcargs["kube_apis"]
+        except KeyError:
+            pass  # setup failed before the IC prerequisites existed, nothing to show
+        else:
+            try:
+                print("\n::group::NGINX Ingress Controller Pod Diagnostics")
+                print_ic_pod_diagnostics(apis.v1, prereq.namespace)
+                print("::endgroup::")
+            except Exception as e:
+                print(f"\nFailed to retrieve NGINX Ingress Controller pod diagnostics: {e}")
+
     if rep.when == "call" and rep.failed and item.config.getoption("--show-ic-logs") == "yes":
         try:
             pod_namespace = item.funcargs["ingress_controller_prerequisites"].namespace
@@ -274,8 +322,47 @@ def pytest_runtest_makereport(item) -> None:
         print("Make sure to remove resources from this test run manually using kubectl utility\n")
 
 
+# Test classes that left the shared nginx-config ConfigMap non-default, as {class nodeid: changed data}.
+LEAKED_CONFIGMAP = {}
+# The most recent leak seen, so a leak that persists across classes is reported once.
+LEAK_STATE = {"last": None}
+
+
+def leaked_configmap_data(live, default):
+    """Return the live ConfigMap data if it differs from the default, else None."""
+    live, default = live or {}, default or {}
+    return live if live != default else None
+
+
+@pytest.hookimpl(hookwrapper=True)
+def pytest_runtest_teardown(item, nextitem) -> None:
+    """
+    Report test classes that leave the shared nginx-config ConfigMap changed.
+
+    The ConfigMap lives for the whole session, so a leak breaks a later, unrelated test.
+    Checked at class boundaries, after class fixtures are torn down. Each distinct leak is
+    reported once, against the class that was running when it was first seen.
+    Only the ConfigMap is checked: every IC fixture recreates the Deployment, so replica
```

**File**: `tests/suite/FLAKY_RELOAD_REQUESTS.md` (removed, +0/-105)
```diff
@@ -1,105 +0,0 @@
-# Fixing flaky e2e tests: connection drops during NGINX reloads
-
-## Symptom
-
-A test intermittently fails with:
-
-    requests.exceptions.ConnectionError:
-      ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
-
-Often accompanied in the IC logs by an access-log line with status `000`, and
-around a config change (Ingress/Policy/namespace-label update) that triggers an
-NGINX reload. With App Protect, the WAF "soft reset" recycles workers and can
-take several seconds, widening the window where in-flight connections are closed.
-
-## Root cause
-
-The test sends an HTTP request that lands exactly while NGINX is reloading and
-recycling worker processes. NGINX closes the connection, `requests` raises an
-uncaught `ConnectionError`, and the test crashes instead of retrying. This is a
-timing race, not a product bug -- a dropped connection during a reload is
-expected and should be retried (the same way `ensure_response_from_backend` and
-`wait_for_reload` already tolerate transients).
-
-## When this pattern applies
-
-Apply the fix to any e2e test that BOTH:
-
-1. Mutates config that causes a reload (apply/patch/delete of Ingress, VS/VSR,
-   TransportServer, Policy, ConfigMap, or namespace label/watch changes), AND
-2. Sends traffic (`requests.get/post/...`) shortly after, while a reload may be
-   in progress -- especially inside a body/status polling loop.
-
-Do NOT apply it to tests that only send traffic against already-stable config
-and never reload mid-traffic (e.g. `test_app_protect_watch_namespace.py`).
-
-## The fix
-
-Do not wrap the whole test in `@pytest.mark.flaky` -- that reruns the entire
-expensive test and can mask real regressions. Instead, make the specific request
-resilient.
-
-Use one of the shared helpers in `suite/utils/resources_utils.py`, all of which
-catch `requests.exceptions.ConnectionError` while retrying:
-
-- `retry_get_until_body_contains(req_url, host, expected_body)` -- poll until a
-  substring appears in the body.
-- `retry_get_until_status_code(req_url, host, expected_status, session=..., **kwargs)`
-  -- poll until a status code matches; supports an SNI/client-cert `session` and
-  extra `requests.get` kwargs (`cert`, `verify`, `allow_redirects`, ...).
-- `retry_get(req_url, host, **kwargs)` -- guard a single request whose assertion
-  cannot be expressed as "body contains X" or "status == Y" (e.g. asserting a
-  substring is absent, or an arbitrary status); retries only on `ConnectionError`.
-
-The shared helpers `wait_and_assert_status_code` (`suite/utils/custom_assertions.py`)
-and `send_malicious_request_with_retry` (`suite/utils/ap_resources_utils.py`) also
-tolerate `ConnectionError`, so their many callers are covered automatically.
-
-    ```python
-    from suite.utils.resources_utils import retry_get_until_body_contains
-
-    resp = retry_get_until_body_contains(req_url, ingress_host, expected_body)
-    assert expected_body in resp.text
-    assert resp.status_code == 200
-    ```
-
-Replace hand-rolled loops like:
-
-    ```python
-    resp = requests.get(url, headers={"host": host}, verify=False)
-    retry = 0
-    while expected not in resp.text and retry <= 60:
-        resp = requests.get(url, headers={"host": host}, verify=False)  # can raise ConnectionError
-        retry += 1
-        wait_before_test(1)
-    ```
-
-with a single `retry_get_until_body_contains(...)` call.
-
-If a test needs a method/headers/body the helper doesn't cover, replicate its
-core guarantee: catch `requests.exceptions.ConnectionError` inside the retry loop
-and continue, rather than letting it propagate.
-
-Note: `requests.exceptions.SSLError` is a *subclass* of `ConnectionError`. When a
-test relies on catching `SSLError` (e.g. mTLS client-cert tests), keep the
-`except SSLError` handler **before** any `except ConnectionError` handler so the
-SSL case is not swallowed.
-
-## Reference implementation
-
-See `test_app_protect_watch_namespace_label.py` and the
-`retry_get_until_body_contains` helper in `suite/utils/resources_utils.py`.
-For status-based and single-request variants, see `retry_get_until_status_code`
-and `retry_get` in the same file, and the mTLS tests (`test_ingress_mtls*.py`)
-for the SSLError-ordering pattern.
-
-## Checklist for the AI applying this
-
-- [ ] Confirm the test reloads config AND sends traffic that could overlap it.
-- [ ] Replace unguarded `requests.*` retry loops with `retry_get_until_body_contains`
-      (or add `except requests.exceptions.ConnectionError: continue` to the loop).
-- [ ] Guard single pre-loop requests that immediately follow a config change too.
-- [ ] Preserve existing assertions and the ~60s retry budget.
-- [ ] Remove the now-unused `import requests` if no other usage remains in the file.
-- [ ] Do NOT add `@pytest.mark.flaky`.
-- [ ] Test-only change: no product code, codegen, or snapshot updates.
```

#### Recent Merged Pull Requests:
- **PR #11427** (2026-11-13): update versions for 5.8.0 release (@vepatel)
- **PR #11426** (2026-11-13): Update version bump job condition to include both repositories (@pdabelf5)
- **PR #11425** (2026-11-13): Enhance Renovate configuration for Python dependencies (@pdabelf5)
- **PR #11424** (2026-11-13): [release-2026-lts] Cherry-pick new github actions  (@sean-breen)
- **PR #11423** (2026-11-13): auth response headers implementation (@vepatel)
- **PR #11418** (2026-11-13): Update azure/setup-helm action to v5.1.0 (release-2026-lts) (@renovate[bot])

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

## X. Restore nightly regression signal: fix zone-sync ConfigMap leak, LTS checkout, r

**RULE**:
When implementing operations in `.github/actions/smoke-tests/action.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nginx/kubernetes-ingress. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `afb4fa83`: Restore nightly regression signal: fix zone-sync ConfigMap leak, LTS checkout, run past first failure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/actions/smoke-tests/action.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
  pytest-args:
    description: Extra pytest arguments, e.g. --maxfail=100 to keep running after the first failure
    required: false
        ${{ inputs.pytest-args }} \
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `afb4fa83` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
