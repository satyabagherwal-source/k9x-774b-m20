> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nginx-kubernetes-ingress-learnings.md`  
> **Source**: github ([https://github.com/nginx/kubernetes-ingress](https://github.com/nginx/kubernetes-ingress))  
> **Source Version**: `4a85f985`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T18:42:25.982Z  
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
> **Harvest Timestamp**: 2026-10-19T18:42:25.975Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nginx/kubernetes-ingress`
- **Description**: NGINX and  NGINX Plus Ingress Controllers for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, go.mod, README.md
- **Stars / Engagement**: 5086 stars

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
	applyconfigurationconfigurationv1 "github.com/nginx/kubernetes-ingress/pkg/client/applyconfiguration/configuration/v1"
	dosv1beta1 "github.com/nginx/kubernetes-ingress/pkg/client/applyconfiguration/dos/v1beta1"
	externaldnsv1 "github.com/nginx/kubernetes-ingress/pkg/client/applyconfiguration/externaldns/v1"
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
		return &applyconfigurationconfigurationv1.RateLimitApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("RateLimitCondition"):
		return &applyconfigurationconfigurationv1.RateLimitConditionApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Route"):
		return &applyconfigurationconfigurationv1.RouteApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("SecurityLog"):
		return &applyconfigurationconfigurationv1.SecurityLogApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("SessionCookie"):
		return &applyconfigurationconfigurationv1.SessionCookieApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("SessionParameters"):
		return &applyconfigurationconfigurationv1.SessionParametersApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("Split"):
		return &applyconfigurationconfigurationv1.SplitApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("SuppliedIn"):
		return &applyconfigurationconfigurationv1.SuppliedInApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("TLS"):
		return &applyconfigurationconfigurationv1.TLSApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("TLSRedirect"):
		return &applyconfigurationconfigurationv1.TLSRedirectApplyConfiguration{}
	case configurationv1.SchemeGroupVersion.WithKind("TransportServer"):
		return &applyconfigurationconfigurationv1.TransportServerApplyConfiguration{}
	case configurationv1.SchemeGroupVer
```

### Core Architecture Module: `cmd/nginx-ingress/aws.go`
```
//go:build aws

package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/marketplacemetering"
	"github.com/aws/aws-sdk-go-v2/service/marketplacemetering/types"

	"github.com/golang-jwt/jwt/v5"
)

var (
	productCode   string
	pubKeyVersion int32 = 1
	pubKeyString  string
)

var (
	ErrMissingProductCode = errors.New("token doesn't include the ProductCode")
	ErrMissingNonce       = errors.New("token doesn't include the Nonce")
	ErrMissingKeyVersion  = errors.New("token doesn't include the PublicKeyVersion")
)

func init() {
	startupCheckFn = checkAWSEntitlement
}

func checkAWSEntitlement() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	nonce, err := generateRandomString(255)
	if err != nil {
		return err
	}

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("error loading AWS configuration: %w", err)
	}

	mpm := marketplacemetering.NewFromConfig(cfg)

	out, err := mpm.RegisterUsage(ctx, &marketplacemetering.RegisterUsageInput{ProductCode: &productCode, PublicKeyVersion: &pubKeyVersion, Nonce: &nonce})
	if err != nil {
		if notEnt, ok := errors.AsType[*types.CustomerNotEntitledException](err); ok {
			return fmt.Errorf("user not entitled, code: %v, message: %v, fault: %v", notEnt.ErrorCode(), notEnt.ErrorMessage(), notEnt.ErrorFault().String())
		}
		if invRegion, ok := errors.AsType[*types.InvalidRegionException](err); ok {
			return fmt.Errorf("invalid region, code: %v, message: %v, fault: %v", invRegion.ErrorCode(), invRegion.ErrorMessage(), invRegion.ErrorFault().String())
		}
		if platNotSup, ok := errors.AsType[*types.PlatformNotSupportedException](err); ok {
			return fmt.Errorf("platform not supported, code: %v, message: %v, fault: %v", platNotSup.ErrorCode(), platNotSup.ErrorMessage(), platNotSup.ErrorFault().String())
		}
		return err
	}

	token, err := jwt.ParseWithClaims(*out.Signature, &claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSAPSS); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		pk, err := base64.StdEncoding.DecodeString(pubKeyString)
		if err != nil {
			return nil, fmt.Errorf("error decoding Public Key string: %w", err)
		}
		pubKey, err := jwt.ParseRSAPublicKeyFromPEM(pk)
		if err != nil {
			return nil, fmt.Errorf("error parsing Public Key: %w", err)
		}

		return pubKey, nil
	})

	if claims, ok := token.Claims.(*claims); ok && token.Valid {
		if claims.ProductCode != productCode || claims.PublicKeyVersion != pubKeyVersion || claims.Nonce != nonce {
			return fmt.Errorf("the claims in the JWT token don't match the request")
		}
	} else {
		return fmt.Errorf("something is wrong with the JWT token: %w", err)
	}
	return nil
}

type claims struct {
	ProductCode      string `json:"productCode,omitempty"`
	PublicKeyVersion int32  `json:"publicKeyVersion,omitempty"`
	Nonce            string `json:"nonce,omitempty"`
	jwt.RegisteredClaims
}

var _ jwt.ClaimsValidator = (*claims)(nil)

func (c claims) Validate() error {
	if c.Nonce == "" {
		return ErrMissingNonce
	}
	if c.ProductCode == "" {
		return ErrMissingProductCode
	}
	if c.PublicKeyVersion == 0 {
		return ErrMissingKeyVersion
	}
	return nil
}

func generateRandomString(n int) (string, error) {
	const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-"
	ret := make([]byte, n)
	for i := 0; i < n; i++ {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		if err != nil {
			return "", err
		}
		ret[i] = letters[num.Int64()]
	}

	return string(ret), nil
}

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

	"github.com/nginx/kubernetes-ingress/internal/helpers"
	internalValidation "github.com/nginx/kubernetes-ingress/internal/validation"
	api_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation"

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

	nginxStatusAllowCIDRs = flag.String("nginx-status-allow-cidrs", "127.0.0.1,::1", `Add IP/CIDR blocks to the allow list for NGINX stub_status or the NGINX Plus API. Separa
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11146** (2026-10-14): **sync: security hardening and minor bug fixes for release-2026-lts**
  *Symptoms*: This commit applies general security hardening updates and minor stability improvements to the codebase.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/11146?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) Report :x: Patch coverage is `96.33700%` with `10 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 61.23%. Comparing base ([`5c4642c`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/5c4642c73b11c2b7aec28889ee45c076d65967dc?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)) to head ([`316ee12`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/316ee12a0aef69b2a5d4c2cea57afa11fa5660a6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)).  | [Files with missing lines](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/11146?dropdown=coverage&src=pr&el=tree&utm_medium=referr
  > ### Package Report <details> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-plus-ingress:t-a63617fff1da4b2bc5909b01f67f0de8, nginx-plus, 37.0.6-2~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-plus-ingress:t-a63617fff1da4b2bc5909b01f67f0de8, nginx-plus-module-njs, 37.0+1.0.1-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-plus-ingress:t-a63617fff1da4b2bc5909b01f67f0de8, nginx-plus-module-otel, 37.0+0.1.2-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-plus-ingress:t-a63617fff1da4b2bc5909b01f67f0de8, nginx-plus-module-fips-check, 37.0+0.1-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-plus-ingress:t-a63617fff1da4b2bc5909b01f67f0de8, nginx-agent, 3.12.2~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-plus-ingress:t-a63617fff1da4b2bc5909b01f67f0de8, nginx-plus, 37.0.6-2~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-plus-ingress:t-

- **Issue #11145** (2026-10-14): **sync: security hardening and minor bug fixes for release-5.7**
  *Symptoms*: This commit applies general security hardening updates and minor stability improvements to the codebase.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/11145?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) Report :x: Patch coverage is `96.57534%` with `10 lines` in your changes missing coverage. Please review. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`release-5.7@c09e7e3`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx#section-missing-base-commit) about missing BASE report.  | [Files with missing lines](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/11145?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) | Patch % | Lines | |---|---|---| | [internal/configs/parsing\_helpers.go](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/11145?s

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

### Incident Patch 1: `4a85f985` (2026-10-19)
**Commit Message**: Update python dependencies (main) (#11156)

Update python dependencies

| datasource | package        | from   | to     |
| ---------- | -------------- | ------ | ------ |
| pypi       | cachetools     | 7.2.1  | 7.2.2  |
| pypi       | google-auth    | 2.61.0 | 2.62.0 |
| pypi       | more-itertools | 11.1.0 | 11.2.1 |
| pypi       | playwright     | 1.63.0 | 1.64.0 |
| pypi       | pluggy         | 1.6.0  | 1.7.0  |
| pypi       | wrapt          | 2.5.0  | 2.5.1  |

Signed-off-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `.github/scripts/requirements.txt` (modified, +102/-102)
```diff
@@ -565,106 +565,106 @@ urllib3==2.8.0 \
     # via
     #   pygithub
     #   requests
-wrapt==2.5.0 \
-    --hash=sha256:05246a100da68259af521b88788f131ba005465f1c95d358cc3c03ec5e351b52 \
-    --hash=sha256:05b7a271e21598694dcb7a6d6224f04e80ecc24b00a31ec57c658196377b0b29 \
-    --hash=sha256:0810e060e58f7960405172ad21080df8e7335841c9fe97417bd7d3f05af24f90 \
-    --hash=sha256:0a7a369e7fca9fc8c2c50df634382009b09af416853da3d4515e4bb048a5b9ee \
-    --hash=sha256:0cabb9c17ab79b2549d1f23b36f436473ad9253ef53995a817feba26fae69d5b \
-    --hash=sha256:0d245ac03f5ae77f1eea6eb19edd9e778c2f772490c20496c2f1cd3a102ee1b6 \
-    --hash=sha256:0dfc38cb672af51fc29696ba9c6f05d2315f5e62c4af2564e50f07f81198a163 \
-    --hash=sha256:0ea62bc142f4fa8b2e0ab058f50699ccd679ef6199c8fa3cc1c2396c7a659000 \
-    --hash=sha256:107eea1a511e98a3a5033b0c2cb403fbb37f05dee6ac1fb85c0460d311ec278c \
-    --hash=sha256:1122f4f9e363da804ccba05a9f0f39baa3716eb82452c929258bc3f1420c899b \
-    --hash=sha256:148052fc55013930217f531c6978e918ab210a12bd73cc9bd6de661a7adaf620 \
-    --hash=sha256:181a45000506a6382eb337354ca7e8525690702f1ccf2eae4f23a210ff339543 \
-    --hash=sha256:18baaf966bdc22dbdbe6e4323da8c17c0b7e8ea941dccf5426e741ae398953d9 \
-    --hash=sha256:1a3c4035d2026b87ef23dd8d165f1f8d3853ee2bd02791cfd22bd8c6226c41ce \
-    --hash=sha256:1b35ef7379323a149a6398f6261248bf48b61666210bd69e2ab24a9a9afdedc0 \
-    --hash=sha256:1ccd22ef8690ca302425f26d4c3e8b24f1284d4351d20e49ce21f9c0dd58d64d \
-    --hash=sha256:1d4da5f0e9a719471502b0db80d5c97503aeca796b7aeb9ab8f47403b2be76e6 \
-    --hash=sha256:1ebc0d09906057ada57a32158a657364ca40b8f86e604da3e7d979069b601502 \
-    --hash=sha256:1f17c5a3836397bf59fd57b0e5b0dc42969b1daa70d31aa361c6e13cbf138b5a \
-    --hash=sha256:1ffb2823c95dbeb8a47fedfba9636b2afeb0a8ef94b66df97bd081bdfe5a263f \
-    --hash=sha256:21cfe343ef9c2deb865ad0d5c57822266447c88dcf6d8805dd8c363fe367f30c \
-    --hash=sha256:23a9d6cb6413359b76f030d6bbb75340b7669c69da245dde2919a4c93708993b \
-    --hash=sha256:2ac82ef59ee05e259902bc7cf73dee5e6397845e8ccdc376d9d25536b59a877c \
-    --hash=sha256:2e3d110d7f99644946f249927c346d9dba507a78815d1bcebdbf0d94c14c5649 \
-    --hash=sha256:2fd8a61c31220840c7f52621cf51c961af5058bd009a55bcdf4a6732bdb13b35 \
-    --hash=sha256:30cf86d1e35a57e772e4709a137c1731751255439368a41b1a2519561e385f4e \
-    --hash=sha256:36703cafc2ec059e118c2175e6cb7ad7299c2924aecdcb1b7a7ebbf7a3e20c19 \
-    --hash=sha256:3f5dfb867d3f58fde0d850a302f1164bb83f4a922b037882bcc7e0474aa8312f \
-    --hash=sha256:425349a99b8c9540399d36620c376dc26e6aca93071cd6fafa239c2f1b5d53a4 \
-    --hash=sha256:4343880acd72e74233baf092285aaaf4306244e31d7601828bd2600316027df0 \
-    --hash=sha256:439523506fd0d9af4f76d75f2e46aa4979e164fecba6890859326ff06edbaf9c \
-    --hash=sha256:47abb2bb7f15b416e72fbe5e68e49a6f09331dae6af1ca6055f5aa2251d2bd2f \
-    --hash=sha256:513dd1f4a1f91030d5656d9f4b3af8aa490d4db1eb53481e6846b8a5ee7acfcd \
-    --hash=sha256:5375ff1d2159e2ef847449e3dd2329441423d0a3d895d123273a67095fe7ca0c \
-    --hash=sha256:5421acb5c363a9bc959122a8645e3f1f42010c932dc53885b11a5ff5b5a6d730 \
-    --hash=sha256:557ebf4ce5568588368675014a2540405db687c2e4c7ad1eb83aa7e857be1864 \
-    --hash=sha256:57fa1a3fd1279b3ca7655b943ad61d298f2a2464a4cdca7ff298058e408322f9 \
-    --hash=sha256:58b2a87c65cbfb20917ec48ace47f71b1962c1f81dbf18a4052e3037abf72028 \
-    --hash=sha256:5df50c6133a63071fb77a0a091ceae36e78467b728d65e711ded02510edd9855 \
-    --hash=sha256:6058e12e9caa33468f9a36fb88c15a4bb30a479f997b37834b83abdbf062f264 \
-    --hash=sha256:6119e5d5bda268171af1f68ab5e7544c618f02a9bdc7c3929a458b719b88cd03 \
-    --hash=sha256:61253431e5a6f0eaeae71e2a101753fbaf4360b3e4dd8e118177d565ae119d40 \
-    --hash=sha256:6269637d9a54990430b4a769df15833935a46c4d004d9fe8a153bbadf0b9a097 \
-    --hash=sha256:63e58f96849f622ce769dcd705f83c7445cd9829bce1dae00e78bb031aec8096 \
-    --hash=sha256:65f2ee406dc592a5b22a7dc6abac13e8a3e8de4b2ecf5dc3c22937865496e4b6 \
-    --hash=sha256:672dd1bab4256311db1520b1b50e7a10cbaeaae2b0ac6bc5d858cc387ee605a2 \
-    --hash=sha256:6761765cc520ff9616fb035c02a85d1d744f7f70edd4649718fd0d09c589eacf \
-    --hash=sha256:691671ea05684f921ffc2e935fd3f9311c1795a10fbbfa006b46269733668f66 \
-    --hash=sha256:6a31cc61ad1be4091f5b094c91d53d206609928af13b7b24573cb857a3bc07fc \
-    --hash=sha256:6a9ee62a970075738909909bdbef3a7da9f7ae03dfca584db283547a29503b56 \
-    --hash=sha256:7138b0e7990e5555a905c519e8dad17c1da1f20e08b283e202c414229065740f \
-    --hash=sha256:734ea79e4707751fb7cc4f716123b2115cd16ed0c4926e803540aece22e3ba67 \
-    --hash=sha256:76fb341d5a707a4f211631b8c77259b2df149147e9d9c245ae6ba3dd936bfdfb \
-    --hash=sha256:77f0a74ff6f6cf89f5b673a732d5afe1911a6e6b1c017260836fdfdf85518dc1 \
-    --hash=sha256:78b7bdaa8b27b7f7607c66bdb6ab15c1dcbd9e9a1556a253a347dad511f615d1 \
-    --hash=sha256:79e68f0fd7d381b9bbd71776f602a2d5440d4d2077459128e02fd6607465422c \
-    --hash=sha256:7e25e9697f60af41fb86b08697e470b1e7eb6cd6ac0eb25e4b1f519839adc
```

**File**: `tests/requirements.txt` (modified, +21/-21)
```diff
@@ -185,9 +185,9 @@ attrs==26.1.0 \
     --hash=sha256:c647aa4a12dfbad9333ca4e71fe62ddc36f4e63b2d260a37a8b83d2f043ac309 \
     --hash=sha256:d03ceb89cb322a8fd706d4fb91940737b6642aa36998fe130a9bc96c985eff32
     # via -r requirements.in
-cachetools==7.2.1 \
-    --hash=sha256:63aa53dfe7473c10cccdd5a01dedf76ef2c4b73a58840d9396e7d0752cbdac3b \
-    --hash=sha256:b1a7537025c06abf96fcc1443e496af9a3fb95e774e70e1f0af226f73f7f2dcc
+cachetools==7.2.2 \
+    --hash=sha256:39b6c9291adde28c5de6622d25329375fadf3e8a678226e7872e2e72854e4549 \
+    --hash=sha256:d521dc98d501ba9efd8d2b1663bbf88163509c0c0a090eea6dc154b421ec5410
     # via
     #   -r requirements.in
     #   google-auth
@@ -694,9 +694,9 @@ frozenlist==1.8.0 \
     # via
     #   aiohttp
     #   aiosignal
-google-auth==2.61.0 \
-    --hash=sha256:37f0815967322e8c32b12bf422531e8b637cafdaae0acbb9141117cfe6a96f23 \
-    --hash=sha256:ca60266a37475ae68b63bac007272f46094b3d571abe92aded329b6cfb568025
+google-auth==2.62.0 \
+    --hash=sha256:0bef0ce54bdf9ce226c5d66e4264413bd918141c31bbe49fb52eac882f513d69 \
+    --hash=sha256:4ff4319aeb4ad128409759d397a9fcafad126d0031d241cc0dd6b9a00b43e3f3
     # via
     #   -r requirements.in
 gprof2dot==2025.4.14 \
@@ -1095,9 +1095,9 @@ mock==5.2.0 \
     --hash=sha256:4e460e818629b4b173f32d08bf30d3af8123afbb8e04bb5707a1fd4799e503f0 \
     --hash=sha256:7ba87f72ca0e915175596069dbbcc7c75af7b5e9b9bc107ad6349ede0819982f
     # via -r requirements.in
-more-itertools==11.1.0 \
-    --hash=sha256:48e8f4d9e7e5878571ecf6f2b4e57634f93cd474cc8cfbd2376f2d11b396e30d \
-    --hash=sha256:4b65538ae22f6fed0ce4874efd317463a7489796a0939fa66824dd542125a192
+more-itertools==11.2.1 \
+    --hash=sha256:35a7377edd1dd6608dcb2cdf534ded55ea32d49448875ad042cd3f879fb1ded0 \
+    --hash=sha256:cbf08fd0af284dc69718b9b76a8e6203df624d70209ea511e4219d350c856f63
     # via -r requirements.in
 multidict==7.1.0 \
     --hash=sha256:0179698c3c913eb64f32397083747fad20ed0f0a2b7469a08cd1a8a95d14d90e \
@@ -1287,19 +1287,19 @@ packaging==26.3 \
     #   -r requirements.in
     #   forcediphttpsadapter
     #   pytest
-playwright==1.63.0 \
-    --hash=sha256:1e4a3a838ce22fb68ad17193fcd142a19610d9d70fb9966d2239f5dddc0cc05b \
-    --hash=sha256:2f9a707a6c6c91157ed77bff2b8caeb04b3c8d46e70d585fc134298cbe4b5cc6 \
-    --hash=sha256:354e15b29503565fc598b89f16fbe070459343bef9d7498a93e304864000c6a7 \
-    --hash=sha256:660c00c62639e31b16700ba5456b351ddba55bb766b7ce8261223aa34928e482 \
-    --hash=sha256:84c540759e8e7f01e690e197e04060f48899d37cea322299f255843273d3385d \
-    --hash=sha256:ad21bc07516b187965a7521c5cf0df0bd657b17482eaad74335272d35a2b07de \
-    --hash=sha256:c89fc4736502a1f0fac2c8ca5d10c0cbc1c669f1f4774a2d8507a43140e4d53f \
-    --hash=sha256:fd1aa00631d44d55e56e0975bf3f3f285fac4a9fd2813183f0c12a488f1a1b24
+playwright==1.64.0 \
+    --hash=sha256:2c14d105548876b15bea5e7eca77bf0d8ff4ba0c607c1ae931067f3d1b010369 \
+    --hash=sha256:5a59af1b230b234008524a5d42b613b233d4256f73bc1dd25bf3f11db0c81b75 \
+    --hash=sha256:61e4e0801bfd76b30e04635aaec45647df707881ccf14382471fcb0eaeb1d16f \
+    --hash=sha256:727d20be6a0884e946b2471774dd960ec95519ba533e61329038526d9aea9a23 \
+    --hash=sha256:8b9f18dc1c23143ac0a5b3c59015db30e9413cc52e1ddddfc2836a7fbad7165a \
+    --hash=sha256:8de42430e9a7c8b04ec963856d484d36ffd452882318ebad2df3e6fb49a8197a \
+    --hash=sha256:97a5c247f1130f3343f097caf3bb1e79358d6b6cfa3550d97ecd721d1905911a \
+    --hash=sha256:d76a501c9930b5a097b00e2448cda2200122a1e8e4be762ff535c1b076277737
     # via -r requirements.in
-pluggy==1.6.0 \
-    --hash=sha256:7dcc130b76258d33b90f61b658791dede3486c3e6bfb003ee5c9bfb396dd22f3 \
-    --hash=sha256:e920276dd6813095e9377c0bc5566d94c932c33b27a3e3945d8389c374dd4746
+pluggy==1.7.0 \
+    --hash=sha256:7dd7b0d8832ba3cb632c306926ded123429211b83641b35dc5c41ad2d34f9bec \
+    --hash=sha256:d1eaa46ebb595891b860ab086b4d09c8588af65ebd4361b8e8f4bb8920b90ba8
     # via
     #   -r requirements.in
     #   pytest
```

---

### Incident Patch 2: `8de2a0fe` (2026-10-19)
**Commit Message**: Update python:3.15-trixie Docker digest to a07fc5d (main) (#11185)

Update python:3.15-trixie Docker digest to a07fc5d

Signed-off-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `tests/Dockerfile` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # syntax=docker/dockerfile:1.28
-FROM python:3.15-trixie@sha256:7ed0e89cdeceffde3d2d2dcdf332a66e7a35e65561c9d8a95f7dddf84f2e3910
+FROM python:3.15-trixie@sha256:a07fc5df0a3f5f1b5dcb197f442492e8953f5595747e6e761232763167de74c6
 ARG ARCH=amd64
 
 ENV PYTHONUNBUFFERED=1
```

#### Recent Merged Pull Requests:
- **PR #11186** (closed): Update module sigs.k8s.io/structured-merge-diff/v6 to v7 (main) (@renovate[bot])
- **PR #11185** (2026-10-19): Update python:3.15-trixie Docker digest to a07fc5d (main) (@renovate[bot])
- **PR #11183** (2026-10-19): Update module github.com/dlclark/regexp2/v2 to v2.9.1 (release-2026-lts) (@renovate[bot])
- **PR #11182** (2026-10-19): Update dependency golangci/golangci-lint to v2.15.0 (release-2026-lts) (@renovate[bot])
- **PR #11181** (2026-10-19): Update dependency wrapt to v2.5.1 (release-2026-lts) (@renovate[bot])
- **PR #11180** (2026-10-19): Update module github.com/dlclark/regexp2/v2 to v2.9.1 (release-5.7) (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
