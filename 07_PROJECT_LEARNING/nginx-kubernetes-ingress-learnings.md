# Forensic Learning Record (Deep Inspection): nginx/kubernetes-ingress

> **Canonical Artifact**: `07_PROJECT_LEARNING/nginx-kubernetes-ingress-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nginx/kubernetes-ingress](https://github.com/nginx/kubernetes-ingress))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:14:19.201Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nginx/kubernetes-ingress`
- **Description**: NGINX and  NGINX Plus Ingress Controllers for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, go.mod, README.md
- **Stars / Engagement**: 5082 stars

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
		licenseReporter.Config.PlusClient = plusClient
	}

	plusCollector, syslogListener, latencyCollector := createPlusAndLatencyCollectors(ctx, registry, constLabels, kubeClient, plusClient)
	cnf := configs.NewConfigurator(configs.ConfiguratorParams{
		NginxManager:                     
```

### Core Architecture Module: `hack/secrets-gen/apikey-gen.go`
```
package main

import (
	"fmt"
	"log/slog"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

const apiKeyType string = "nginx.org/apikey" //gosec:disable G101 -- constant as this is a descriptor a kubernetes secret type, not a hard coded secret

type apiKeysSecret struct {
	SecretName string            `json:"secretName"`
	Namespace  string            `json:"namespace,omitempty"`
	FileName   string            `json:"filename"`
	Symlinks   []string          `json:"symlinks,omitempty"`
	UsedIn     []string          `json:"usedIn,omitempty"`
	Entries    map[string]string `json:"entries"`
	SecretType v1.SecretType     `json:"secretType,omitempty"`
}

func generateAPIKeyFile(logger *slog.Logger, secret apiKeysSecret) error {
	convertedEntries := make(map[string][]byte)

	// secret.Entries is a map[string]string, but the yaml
	// needs a map[string][]byte
	for key, value := range secret.Entries {
		convertedEntries[key] = []byte(value)
	}

	fileContents, err := createKubeAPIKeySecretYaml(secret, convertedEntries)
	if err != nil {
		return fmt.Errorf("writing valid file for %s: %w", secret.FileName, err)
	}

	err = writeFiles(logger, fileContents, secret.FileName, secret.Symlinks)
	if err != nil {
		return fmt.Errorf("writing file for %s: %w", secret.FileName, err)
	}

	return nil
}

func createKubeAPIKeySecretYaml(secret apiKeysSecret, hashedEntries map[string][]byte) ([]byte, error) {
	s := v1.Secret{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Secret",
			APIVersion: "v1",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: secret.SecretName,
		},
		Data: hashedEntries,
		Type: v1.SecretType(apiKeyType),
	}

	if secret.SecretType != "" {
		s.Type = secret.SecretType
	}

	if secret.Namespace != "" {
		s.Namespace = secret.Namespace
	}

	return yaml.Marshal(s)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10999** (2026-10-01): **Stop dropping NGINX Plus endpoint updates and bound batch-reload staleness**
  *Symptoms*: ### Proposed changes  Two related bugs in `LoadBalancerController.sync()`'s batch-reload path, both rooted in the same design issue: `Configurator.isReloadsEnabled` was a single flag overloaded to mean two different things, and the batch only ever ended when the work queue fully drained.  **NGINX Plus reloads on every endpoint churn event (#7778), and why fixing it isn't as simple as skipping the batch-end reload (#7779)**  `isReloadsEnabled` gated both `Reload()` *and* the NGINX Plus API upstream writes (`updateServersInPlus` / `updateStreamServersInPlus`). `sync()` disables it when entering batch mode, so on Plus the batch-end reload was the *only* thing that ever applied endpoint changes to the running config during a batch — which is why Plus reloads on every endpointslice-only batch (#7778). Removing that reload for endpointslice-only batches (as #7779 proposes) without separating the two gates would leave Plus with neither the API write nor the reload during a batch — endpoints go stale until an unrelated event kicks the queue.  Fix: split the flag into `isReloadsEnabled` (gates `Reload`) and `isPlusAPIEnabled` (gates the Plus API writes). `DisableReloads()` now only clears the former — NGINX is already running a valid config by the time batch mode starts, so the Plus API can keep applying endpoint changes live during the batch. The batch-end reload decision is also no longer inferred from the triggering task's `Kind`: `Configurator.Reload` now records whether i
  **Post-Mortem & Fix Analysis**:
  > ### Promptless documentation updates  - [Describe the NIC batch reload time limit](https://app.gopromptless.ai/suggestions/3d0a866f-f213-468c-bbea-aa18ec4cd460) updates the NGINX Ingress Controller design page so batched reloads end after at most 2 seconds and NGINX Plus applies endpoint changes through its API during a batch. [Docs PR](https://github.com/nginx/documentation/pull/2360)
  > ## [Codecov](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10999?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) Report :x: Patch coverage is `90.90909%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 67.91%. Comparing base ([`4cf5162`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/4cf5162098faaa06e2ad0b2046db74876ecd669b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)) to head ([`2521221`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/25212216bb1187b18d270f8bf1bd4323afe63ca9?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)).  | [Files with missing lines](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10999?dropdown=coverage&src=pr&el=tree&utm_medium=referral
  > ### Package Report  Registry `gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev` &middot; Tag `t-f29dafb00b0ed5c6c004c522dc46e6e5` &middot; 25 images &middot; 234 checks &middot; **all matched** &#9989;  <sub>Full reference is <code>gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/&lt;image&gt;:t-f29dafb00b0ed5c6c004c522dc46e6e5&lt;variant&gt;</code>.</sub>  | Image | Variant | Base | Arch | NGINX | Agent | WAF | DoS |  | | --- | --- | --- | --- | --- | --- | --- | --- | :-: | | `nginx-ic/nginx-ingress` | &ndash; | debian | amd64, arm64 | 1.31.6-1~trixie | 3.12.0~trixie | &ndash; | &ndash; | &#9989; | | `nginx-ic/nginx-plus-ingress` | &ndash; | debian | amd64, arm64 | 37.1.1-2~trixie | 3.12.0~trixie | &ndash; | &ndash; | &#9989; | | `nginx-ic-nap/nginx-plus-ingress` | &ndash; | debian | amd64 | 37.1.1-2~trixie | 2.46.9~trixie | 37.1+5.715.0-1~trixie | &ndash; | &#9989; | | `nginx-ic-nap-v5/nginx-plus-ingress` | &ndash; | debian | amd64 | 37.1.1-2~trixie | 2.46.9~trixie | 37.1+5.715.0-1~trixie | &ndash; | &

- **Issue #10998** (2026-10-02): **Omit empty nodePort from controller Service**
  *Symptoms*: ### Proposed changes  With `controller.service.type` set to `LoadBalancer` or `NodePort` and no nodePort configured (the default), the controller Service rendered an empty `nodePort:` for the HTTP and HTTPS ports. Kubernetes allocates a port for that null value, so GitOps tools such as Argo CD report a permanent diff against the live Service.  `nodePort` is now rendered only when a value is set, for both ports. An explicit `0` is also omitted; Kubernetes treats it as "allocate one" anyway.  Fixes #9054. Supersedes #10340.  Thanks @josemaia for the initial PR.  Tests: - New Helm unit case `nodePort` (`charts/tests/testdata/service-nodeport.yaml`) renders explicit nodePorts for both ports. - New Helm unit case `nodePortZero` (`charts/tests/testdata/service-nodeport-zero.yaml`) with both nodePorts set to `0`, neither `nodePort` field is rendered. - Regenerated `charts/tests/__snapshots__/helmunit_test.snap`: the only changes are the empty `nodePort:` lines removed from the 40 existing renders.  ### Checklist  Before creating a PR, run through this checklist and mark each as complete.  - [x] I have read the [CONTRIBUTING](https://github.com/nginx/kubernetes-ingress/blob/main/CONTRIBUTING.md) doc - [x] I have added tests that prove my fix is effective or that my feature works - [x] I have checked that all unit tests pass after adding my changes - [ ] I have updated necessary documentation - [x] I have rebased my branch onto main - [ ] I will ensure my PR is
  **Post-Mortem & Fix Analysis**:
  > ### Promptless documentation updates  - [Correct NIC Helm nodePort parameter descriptions](https://app.gopromptless.ai/suggestions/747e7e50-f964-4a2f-9c5e-b5d42e287b0c) fixes the `controller.service.httpPort.nodePort` and `controller.service.httpsPort.nodePort` rows on the Helm chart parameters page. They now say these settings apply when `controller.service.type` is `NodePort` or `LoadBalancer`, and that Kubernetes assigns a port when you don't set one. [Docs PR](https://github.com/nginx/documentation/pull/2358) 
  > ## [Codecov](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10998?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 67.74%. Comparing base ([`9c7a0c7`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/9c7a0c727dce66aa6d596d9d97b02b0cf436aad5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)) to head ([`17513ac`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/17513ac21a91c8cdaa8dc75694d4ed8c8a450805?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main   #10998      +/-   ## ===
  > ### Package Report  Registry `gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev` &middot; Tag `t-918e87365ec4b606d6d5edfc3f6ff940` &middot; 25 images &middot; 234 checks &middot; **all matched** &#9989;  <sub>Full reference is <code>gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/&lt;image&gt;:t-918e87365ec4b606d6d5edfc3f6ff940&lt;variant&gt;</code>.</sub>  | Image | Variant | Base | Arch | NGINX | Agent | WAF | DoS |  | | --- | --- | --- | --- | --- | --- | --- | --- | :-: | | `nginx-ic/nginx-ingress` | &ndash; | debian | amd64, arm64 | 1.31.6-1~trixie | 3.12.0~trixie | &ndash; | &ndash; | &#9989; | | `nginx-ic/nginx-plus-ingress` | &ndash; | debian | amd64, arm64 | 37.1.1-2~trixie | 3.12.0~trixie | &ndash; | &ndash; | &#9989; | | `nginx-ic-nap/nginx-plus-ingress` | &ndash; | debian | amd64 | 37.1.1-2~trixie | 2.46.9~trixie | 37.1+5.715.0-1~trixie | &ndash; | &#9989; | | `nginx-ic-nap-v5/nginx-plus-ingress` | &ndash; | debian | amd64 | 37.1.1-2~trixie | 2.46.9~trixie | 37.1+5.715.0-1~trixie | &ndash; | &

- **Issue #10992** (2026-10-01): **Remove redundant optional marker**
  *Symptoms*: ### Proposed changes  Remove redundant optional marker.  ### Checklist  Before creating a PR, run through this checklist and mark each as complete.  - [x] I have read the [CONTRIBUTING](https://github.com/nginx/kubernetes-ingress/blob/main/CONTRIBUTING.md) doc - [x] I have added tests that prove my fix is effective or that my feature works - [x] I have checked that all unit tests pass after adding my changes - [x] I have updated necessary documentation - [x] I have rebased my branch onto main - [x] I will ensure my PR is targeting the main branch and pulling from my branch from my own fork 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10992?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 67.62%. Comparing base ([`9af2105`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/9af210541eea44262437160ae7c00956b76446ab?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)) to head ([`e1fcdcc`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/e1fcdcc21562ebee767b21e567bba7cc050550fa?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             main   #10992      +/-   ## ===
  > ### Package Report <details> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-8dd4e15424e74908a882cc7017fb3ac4, nginx, 1.31.6-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-8dd4e15424e74908a882cc7017fb3ac4, nginx-module-njs, 1.31.6+1.0.1-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-8dd4e15424e74908a882cc7017fb3ac4, nginx-module-otel, 1.31.6+0.1.2-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-8dd4e15424e74908a882cc7017fb3ac4, nginx-agent, 3.12.0~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-8dd4e15424e74908a882cc7017fb3ac4, nginx, 1.31.6-1~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-8dd4e15424e74908a882cc7017fb3ac4, nginx-module-njs, 1.31.6+1.0.1-1~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-8dd4e15424e74908a882cc7017fb3ac4, nginx-module-otel, 1.31.6

- **Issue #10956** (2026-09-30): **fix: synchronize namespaced informer registries**
  *Symptoms*: ### Proposed changes  The namespaced informer maps in internal/k8s, internal/externaldns and internal/certmanager were reachable from more than one goroutine without synchronization. In internal/k8s the map was shared by reference rather than copied, so LoadBalancerController and statusUpdater operated on the same map: the sync queue worker updates it as watched namespaces change, while the background status flush pool and the leader election callbacks read it.  Add internal/nsregistry, a single concurrency-safe registry generic over the informer group type, and use it from all three packages. Each package declares its own group type, and the registry never looks inside one, so a type parameter is enough. This replaces three copies of the same map that had already started to drift.  Holding a group against removal is part of the registry API rather than left to the caller. Readers that run off the sync queue goroutine use WithInformer or ForEach, which hold the read lock for the duration of the callback, and Remove takes the write lock and returns the group it unregistered. Remove therefore cannot return while a reader is still inside one, and the caller cannot stop a group it has not already unregistered. Previously a status flush worker could still be reading a group that had been stopped, which could produce a status update from an informer that was no longer being kept up to date. The lister reads in statusUpdater, the external-dns worker and the cert-manager worke
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10956?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) Report :x: Patch coverage is `80.09479%` with `42 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 67.60%. Comparing base ([`c452534`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/c452534dde552310e9744f0bd76131ac830c4ebe?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)) to head ([`4bb5ffe`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/4bb5ffe8b36a5abc827e39b5ccb2eddf7461ebe8?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)). :warning: Report is 9 commits behind head on main.  | [Files with missing lines](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10956
  > ### Package Report <details> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-fb0fc9d1bc051529eefbf51d8deaec6c, nginx, 1.31.6-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-fb0fc9d1bc051529eefbf51d8deaec6c, nginx-module-njs, 1.31.6+1.0.1-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-fb0fc9d1bc051529eefbf51d8deaec6c, nginx-module-otel, 1.31.6+0.1.2-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-fb0fc9d1bc051529eefbf51d8deaec6c, nginx-agent, 3.12.0~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-fb0fc9d1bc051529eefbf51d8deaec6c, nginx, 1.31.6-1~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-fb0fc9d1bc051529eefbf51d8deaec6c, nginx-module-njs, 1.31.6+1.0.1-1~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-fb0fc9d1bc051529eefbf51d8deaec6c, nginx-module-otel, 1.31.6

- **Issue #10929** (2026-10-01): **fix(external auth): carrying the response code from the /oauth2/signin subrequest breaks oauth2 flow- #10879**
  *Symptoms*: ### Proposed changes  Fixed source branch version of 10879  Fixes https://github.com/nginx/kubernetes-ingress/issues/10870 while keeping the fixes from https://github.com/nginx/kubernetes-ingress/pull/10594  ### Checklist  Before creating a PR, run through this checklist and mark each as complete.  - [x] I have read the [CONTRIBUTING](https://github.com/nginx/kubernetes-ingress/blob/main/CONTRIBUTING.md) doc - [x] I have added tests that prove my fix is effective or that my feature works - [x] I have checked that all unit tests pass after adding my changes - [ ] I have updated necessary documentation - [x] I have rebased my branch onto main - [x] I will ensure my PR is targeting the main branch and pulling from my branch from my own fork 
  **Post-Mortem & Fix Analysis**:
  > ### Package Report <details> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-76241fc0ff3febf7b11614e25e4eb439, nginx, 1.31.6-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-76241fc0ff3febf7b11614e25e4eb439, nginx-module-njs, 1.31.6+1.0.1-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-76241fc0ff3febf7b11614e25e4eb439, nginx-module-otel, 1.31.6+0.1.2-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-76241fc0ff3febf7b11614e25e4eb439, nginx-agent, 3.12.0~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-76241fc0ff3febf7b11614e25e4eb439, nginx, 1.31.6-1~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-76241fc0ff3febf7b11614e25e4eb439, nginx-module-njs, 1.31.6+1.0.1-1~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-76241fc0ff3febf7b11614e25e4eb439, nginx-module-otel, 1.31.6
  > ## [Codecov](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10929?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) Report :x: Patch coverage is `95.45455%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 67.62%. Comparing base ([`9af2105`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/9af210541eea44262437160ae7c00956b76446ab?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)) to head ([`6c29a62`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/6c29a624e59f4c5e14e1dcb3be8be87dc523eff6?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)).  | [Files with missing lines](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10929?dropdown=coverage&src=pr&el=tree&utm_medium=referral

- **Issue #10900** (2026-10-05): **[Bug]: VirtualServer warnings are computed and then discarded when the rendered configuration is unchanged**
  *Symptoms*: ### Version  edge  ### What Kubernetes platforms are you running on?  Kind  ### Steps to reproduce  ## Summary  The Ingress Controller computes a warning for a VirtualServer, stores it in `VirtualServerConfiguration.Warnings`, and then **throws it away without reporting it**, because change detection concludes the VirtualServer did not change.  The practical result: whether a VirtualServer reports a conflict depends on the **order the resources were applied in**, not on the resources themselves. The same manifests give `Valid` or `Warning` depending on apply order, and the state flips after an unrelated controller restart.  Reproduced below on `main` with two VirtualServerRoutes claiming the same subroute path. The conflict is detected, the loser is dropped, and the warning is generated — but if the loser arrived *last*, nothing is reported.  ## Reproduction  No backends needed — the subroutes use `action.return`.  <details> <summary><code>vs.yaml</code></summary>  ```yaml apiVersion: k8s.nginx.org/v1 kind: VirtualServer metadata:   name: cafe spec:   host: cafe.example.com   routes:   - path: /coffee     routeSelector:       matchLabels:         route-group: cafe ```  </details>  <details> <summary><code>vsr-a.yaml</code> (winner) and <code>vsr-b.yaml</code> (loser)</summary>  ```yaml apiVersion: k8s.nginx.org/v1 kind: VirtualServerRoute metadata:   name: coffee-a   labels:     route-group: cafe spec:   host: cafe.example.com   subroutes:   - path: /coffee     action:       
  **Post-Mortem & Fix Analysis**:
  > Hi @pdabelf5 thanks for reporting!    Be sure to check out the [docs](https://docs.nginx.com/nginx-ingress-controller) and the [Contributing Guidelines](https://github.com/nginx/kubernetes-ingress/blob/main/CONTRIBUTING.md) while you wait for a human to take a look at this :slightly_smiling_face:   If your issue concerns any of the enterprise features please open a ticket with F5 directly (For NGINX Plus customers NGINX Ingress Controller (when used with NGINX Plus) is covered by the support contract.)    Cheers!
  > Taking this — will stop discarding VirtualServer warnings when the rendered configuration is unchanged.

- **Issue #10899** (2026-10-05): **[Bug]: A VirtualServer attached via `routeSelector` silently loses routes and stays `Valid`**
  *Symptoms*: ### Version  edge  ### What Kubernetes platforms are you running on?  Kind  ### Steps to reproduce  ## Summary  When a VirtualServerRoute leaves the Ingress Controller's internal store, every VirtualServer that attached it loses the corresponding routes. A VirtualServer that attached it **by name** (`route: default/coffee`) reports a warning and goes to `State: Warning`. A VirtualServer that attached it **by `routeSelector`** reports **nothing** and stays `State: Valid`, while serving no locations for the affected paths.  In the worst cases (VirtualServerRoute deleted, or its `ingressClassName` changed to another controller) there is no signal anywhere: not on the VirtualServer, and not on the VirtualServerRoute either, because NIC writes no status for an object that is gone or not owned by it.  ## Reproduction  Reproduces on `main`. No backends needed — the subroutes use `action.return`.  <details> <summary><code>vs.yaml</code> — one VirtualServer, one route attached by name, one by selector</summary>  ```yaml apiVersion: k8s.nginx.org/v1 kind: VirtualServer metadata:   name: cafe spec:   host: cafe.example.com   routes:   # attached BY NAME -> route loss is reported   - path: /coffee     route: default/coffee-named   # attached BY SELECTOR -> route loss is silent   - path: /tea     routeSelector:       matchLabels:         route-group: cafe ```  </details>  <details> <summary><code>vsr-named.yaml</code> and <code>vsr-selected.yaml</code></summary>  ```yaml apiVersion: k8s.n
  **Post-Mortem & Fix Analysis**:
  > Hi @pdabelf5 thanks for reporting!    Be sure to check out the [docs](https://docs.nginx.com/nginx-ingress-controller) and the [Contributing Guidelines](https://github.com/nginx/kubernetes-ingress/blob/main/CONTRIBUTING.md) while you wait for a human to take a look at this :slightly_smiling_face:   If your issue concerns any of the enterprise features please open a ticket with F5 directly (For NGINX Plus customers NGINX Ingress Controller (when used with NGINX Plus) is covered by the support contract.)    Cheers!
  > Taking this — working on a fix.

- **Issue #10897** (2026-09-22): **Cors origin port validation redo 9861**
  *Symptoms*: ### Proposed changes  Fixes https://github.com/nginx/kubernetes-ingress/issues/9860  Internal rework of #9861 to address feedback.  ### Checklist  Before creating a PR, run through this checklist and mark each as complete.  - [x] I have read the [CONTRIBUTING](https://github.com/nginx/kubernetes-ingress/blob/main/CONTRIBUTING.md) doc - [x] I have added tests that prove my fix is effective or that my feature works - [x] I have checked that all unit tests pass after adding my changes - [ ] I have updated necessary documentation - [x] I have rebased my branch onto main - [x] I will ensure my PR is targeting the main branch and pulling from my branch from my own fork 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10897?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx) Report :x: Patch coverage is `84.61538%` with `2 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 64.75%. Comparing base ([`53fa0b7`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/53fa0b7d0c3faa00163d1c5b43742c5a20a3e4eb?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)) to head ([`772c764`](https://app.codecov.io/gh/nginx/kubernetes-ingress/commit/772c76414ee1a8ebb588d306eba33b51f452ac62?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=nginx)).  | [Files with missing lines](https://app.codecov.io/gh/nginx/kubernetes-ingress/pull/10897?dropdown=coverage&src=pr&el=tree&utm_medium=referra
  > ### Promptless documentation updates  - [Document CORS allowOrigin port validation in the NIC Policy reference](https://app.gopromptless.ai/suggestions/f9ce3c33-9386-4daf-8eeb-c9663d7cdca4) adds a note to the Policy CORS `allowOrigin` field reference stating that an origin's port must be a valid TCP port (1–65535), or the Policy is rejected at admission.
  > ### Package Report <details> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-cffccf593a3f6cd66054a12bf05f46f2, nginx, 1.31.6-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-cffccf593a3f6cd66054a12bf05f46f2, nginx-module-njs, 1.31.6+1.0.1-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-cffccf593a3f6cd66054a12bf05f46f2, nginx-module-otel, 1.31.6+0.1.2-1~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-cffccf593a3f6cd66054a12bf05f46f2, nginx-agent, 3.12.0~trixie, amd64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-cffccf593a3f6cd66054a12bf05f46f2, nginx, 1.31.6-1~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-cffccf593a3f6cd66054a12bf05f46f2, nginx-module-njs, 1.31.6+1.0.1-1~trixie, arm64<br> gcr.io/f5-gcs-7899-ptg-ingrss-ctlr/dev/nginx-ic/nginx-ingress:t-cffccf593a3f6cd66054a12bf05f46f2, nginx-module-otel, 1.31.6

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

### Incident Patch 1: `27926faf` (2026-10-05)
**Commit Message**: fix(helm): emit default listener ports when custom resources are disabled (#10874)

default-http-listener-port and default-https-listener-port apply to the
NGINX default_server, not VirtualServer CRDs, but the chart only emitted
them inside enableCustomResources. Move those flags out of the CR block
and add a helm unit case that asserts custom ports with CRs disabled.

Co-authored-by: Ciara Stacke <[REDACTED_EMAIL]>

**File**: `charts/nginx-ingress/templates/_helpers.tpl` (modified, +2/-2)
```diff
@@ -424,14 +424,14 @@ Build the args for the service binary.
 - -enable-cert-manager={{ .Values.controller.enableCertManager }}
 - -enable-oidc={{ .Values.controller.enableOIDC }}
 - -enable-external-dns={{ .Values.controller.enableExternalDNS }}
-- -default-http-listener-port={{ .Values.controller.defaultHTTPListenerPort}}
-- -default-https-listener-port={{ .Values.controller.defaultHTTPSListenerPort}}
 {{- if and .Values.controller.globalConfiguration.create (not .Values.controller.globalConfiguration.customName) }}
 - -global-configuration=$(POD_NAMESPACE)/{{ include "nginx-ingress.controller.fullname" . }}
 {{- else if .Values.controller.globalConfiguration.customName }}
 - -global-configuration={{ .Values.controller.globalConfiguration.customName }}
 {{- end }}
 {{- end }}
+- -default-http-listener-port={{ .Values.controller.defaultHTTPListenerPort}}
+- -default-https-listener-port={{ .Values.controller.defaultHTTPSListenerPort}}
 - -allow-empty-ingress-host={{ .Values.controller.allowEmptyIngressHost }}
 - -ready-status={{ .Values.controller.readyStatus.enable }}
 - -ready-status-port={{ .Values.controller.readyStatus.port }}
```

**File**: `charts/tests/__snapshots__/helmunit_test.snap` (modified, +422/-2)
```diff
@@ -819,6 +819,8 @@ spec:
           - -enable-custom-resources=false
           - -enable-snippets=false
           - -disable-ipv6=false
+          - -default-http-listener-port=80
+          - -default-https-listener-port=443
           - -allow-empty-ingress-host=true
           - -ready-status=true
           - -ready-status-port=8081
@@ -6468,6 +6470,8 @@ spec:
           - -enable-custom-resources=false
           - -enable-snippets=false
           - -disable-ipv6=false
+          - -default-http-listener-port=80
+          - -default-https-listener-port=443
           - -allow-empty-ingress-host=false
           - -ready-status=true
           - -ready-status-port=8081
@@ -7424,6 +7428,422 @@ metadata:
     app.kubernetes.io/managed-by: Helm
 ---
 
+[TestHelmNICTemplate/defaultListenerPortsWithoutCRs - 1]
+/-/-/-/
+# Source: nginx-ingress/templates/controller-serviceaccount.yaml
+apiVersion: v1
+kind: ServiceAccount
+metadata:
+  name: default-listener-ports-no-crs-nginx-ingress
+  namespace: default
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: default-listener-ports-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+/-/-/-/
+# Source: nginx-ingress/templates/controller-configmap.yaml
+apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: default-listener-ports-no-crs-nginx-ingress
+  namespace: default
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: default-listener-ports-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+data:
+  {}
+/-/-/-/
+# Source: nginx-ingress/templates/controller-leader-election-configmap.yaml
+apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: default-listener-ports-no-crs-nginx-ingress-leader-election
+  namespace: default
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: default-listener-ports-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+/-/-/-/
+# Source: nginx-ingress/templates/clusterrole.yaml
+kind: ClusterRole
+apiVersion: rbac.authorization.k8s.io/v1
+metadata:
+  name: default-listener-ports-no-crs-nginx-ingress
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: default-listener-ports-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+rules:
+- apiGroups:
+  - ""
+  resources:
+  - configmaps
+  - namespaces
+  - pods
+  - secrets
+  verbs:
+  - get
+  - list
+  - watch
+- apiGroups:
+  - ""
+  resources:
+  - events
+  verbs:
+  - create
+  - patch
+  - list
+- apiGroups:
+  - ""
+  resources:
+  - services
+  verbs:
+  - get
+  - list
+  - watch
+  - create
+  - update
+  - patch
+  - delete
+- apiGroups:
+  - coordination.k8s.io
+  resources:
+  - leases
+  verbs:
+  - list
+  - watch
+- apiGroups:
+  - discovery.k8s.io
+  resources:
+  - endpointslices
+  verbs:
+  - get
+  - list
+  - watch
+- apiGroups:
+  - networking.k8s.io
+  resources:
+  - ingresses
+  verbs:
+  - get
+  - list
+  - watch
+- apiGroups:
+  - ""
+  resources:
+  - nodes
+  verbs:
+  - list
+- apiGroups:
+  - "apps"
+  resources:
+  - replicasets
+  - daemonsets
+  - statefulsets
+  verbs:
+  - get
+- apiGroups:
+  - networking.k8s.io
+  resources:
+  - ingressclasses
+  verbs:
+  - get
+  - list
+- apiGroups:
+  - networking.k8s.io
+  resources:
+  - ingresses/status
+  verbs:
+  - update
+/-/-/-/
+# Source: nginx-ingress/templates/clusterrolebinding.yaml
+kind: ClusterRoleBinding
+apiVersion: rbac.authorization.k8s.io/v1
+metadata:
+  name: default-listener-ports-no-crs-nginx-ingress
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: default-listener-ports-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+subjects:
+- kind: ServiceAccount
+  name: default-listener-ports-no-crs-nginx-ingress
+  namespace: default
+roleRef:
+  kind: ClusterRole
+  name: default-listener-ports-no-crs-nginx-ingress
+  apiGroup: rbac.authorization.k8s.io
+/-/-/-/
+# Source: nginx-ingress/templates/controller-role.yaml
+kind: Role
+apiVersion: rbac.authorization.k8s.io/v1
+metadata:
+  name: default-listener-ports-no-crs-nginx-ingress
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: default-listener-ports-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+  namespace: default
+rules:
+- apiGroups:
+  - ""
+  resources:
+  - configmaps
+  - pods
+  - secrets
+  - services
+  verbs:
+  - get
+  - list
+  - watch
+- apiGroups:
+    - ""
+  resources:
+    - namespaces
+  verbs:
+    - get
+- apiGroups:
+  - ""
+  resources:
+  - 
```

**File**: `charts/tests/helmunit_test.go` (modified, +5/-0)
```diff
@@ -245,6 +245,11 @@ func TestHelmNICTemplate(t *testing.T) {
 			releaseName: "allow-empty-ingress-host-no-crs",
 			namespace:   "default",
 		},
+		"defaultListenerPortsWithoutCRs": {
+			valuesFile:  "testdata/default-listener-ports-no-crs.yaml",
+			releaseName: "default-listener-ports-no-crs",
+			namespace:   "default",
+		},
 		"commonLabels": {
 			valuesFile:  "testdata/common-labels.yaml",
 			releaseName: "common-labels",
```

**File**: `charts/tests/testdata/default-listener-ports-no-crs.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+controller:
+  enableCustomResources: false
+  defaultHTTPListenerPort: 8080
+  defaultHTTPSListenerPort: 8443
```

---

### Incident Patch 2: `44cbd631` (2026-10-05)
**Commit Message**: fix(k8s): report VirtualServer warnings when config is unchanged (#10912)

* Preserve VirtualServer warnings when config is unchanged

Report VirtualServer warning-set changes via a status-only update so
rejected VirtualServerRoutes are visible even when IsEqual skips a
reload. Keep IsEqual as the reload predicate.

Fixes nginx/kubernetes-ingress#10900

* fix(k8s): address review feedback on VirtualServer status-only updates

Sort the per-route warnings from validateVSRSelectors so map iteration
order cannot make the warning set look changed and trigger an UpdateStatus
on every sync.

Handle UpdateStatus explicitly in processRejectedVSChanges instead of
sending every non-AddOrUpdate op to processDelete, which could remove the
NGINX config of an unrelated VirtualServer. Delete is now the only op that
tears config down.

Keep the warnings the configurator produced on the last render when
processing a status-only update, so a missing Service or TLS secret does
not get reset to Valid. Status-only updates now report the VirtualServer
only and no longer emit events for attached VirtualServerRoutes.

In processChangesFromGlobalConfiguration, report UpdateStatus resources
separately so a b

**File**: `internal/configs/configurator.go` (modified, +13/-0)
```diff
@@ -140,6 +140,7 @@ type Configurator struct {
 	minions                      map[string]map[string]bool
 	mergeableIngresses           map[string]*MergeableIngresses
 	virtualServers               map[string]*VirtualServerEx
+	virtualServerWarnings        map[string]Warnings
 	transportServers             map[string]*TransportServerEx
 	tlsPassthroughPairs          map[string]tlsPassthroughPair
 	isWildcardEnabled            bool
@@ -196,6 +197,7 @@ func NewConfigurator(p ConfiguratorParams) *Configurator {
 		MgmtCfgParams:             p.MGMTCfgParams,
 		ingresses:                 make(map[string]*IngressEx),
 		virtualServers:            make(map[string]*VirtualServerEx),
+		virtualServerWarnings:     make(map[string]Warnings),
 		transportServers:          make(map[string]*TransportServerEx),
 		templateExecutor:          p.TemplateExecutor,
 		templateExecutorV2:        p.TemplateExecutorV2,
@@ -697,6 +699,15 @@ func (cnf *Configurator) deleteVirtualServerMetricsLabels(key string) {
 	delete(cnf.metricLabelsIndex.virtualServerUpstreamPeers, key)
 }
 
+// GetVirtualServerWarnings returns the warnings produced when the VirtualServer
+// with the given namespace/name key was last rendered, or nil if it has not been
+// rendered. It lets status-only updates keep reporting warnings that come from
+// config generation (for example a missing Service or TLS secret) without
+// regenerating the config.
+func (cnf *Configurator) GetVirtualServerWarnings(key string) Warnings {
+	return cnf.virtualServerWarnings[getFileNameForVirtualServerFromKey(key)]
+}
+
 // AddOrUpdateVirtualServer adds or updates NGINX configuration for the VirtualServer resource.
 func (cnf *Configurator) AddOrUpdateVirtualServer(virtualServerEx *VirtualServerEx) (Warnings, error) {
 	_, warnings, weightUpdates, err := cnf.addOrUpdateVirtualServer(virtualServerEx)
@@ -765,6 +776,7 @@ func (cnf *Configurator) addOrUpdateVirtualServer(virtualServerEx *VirtualServer
 		changed = true
 	}
 	cnf.virtualServers[name] = virtualServerEx
+	cnf.virtualServerWarnings[name] = warnings
 
 	if (cnf.isPlus && cnf.isPrometheusEnabled) || cnf.isLatencyMetricsEnabled {
 		cnf.updateVirtualServerMetricsLabels(virtualServerEx, vsCfg.Upstreams)
@@ -1181,6 +1193,7 @@ func (cnf *Configurator) DeleteVirtualServer(key string, skipReload bool) error
 	}
 
 	delete(cnf.virtualServers, name)
+	delete(cnf.virtualServerWarnings, name)
 	if (cnf.isPlus && cnf.isPrometheusEnabled) || cnf.isLatencyMetricsEnabled {
 		cnf.deleteVirtualServerMetricsLabels(key)
 	}
```

**File**: `internal/k8s/configuration.go` (modified, +67/-2)
```diff
@@ -48,6 +48,9 @@ const (
 	Delete Operation = iota
 	// AddOrUpdate the config of the resource
 	AddOrUpdate
+	// UpdateStatus updates resource status and events without regenerating NGINX config.
+	// Used when a VirtualServer warning set changes but the rendered configuration does not.
+	UpdateStatus
 )
 
 // Resource represents a configuration resource.
@@ -1248,6 +1251,11 @@ func (c *Configuration) rebuildHosts() ([]ResourceChange, []ConfigurationProblem
 
 	c.vsrsWithChangedRefs = detectChangesInVSRReferences(c.vsrToVSConfigs, newVSRToVSConfigs, c.virtualServerRoutes)
 
+	// Retain the previous hosts so warning-only diffs can be detected after
+	// listener warnings are attached to newResources.
+	oldHosts := c.hosts
+
+	// safe to update hosts
 	c.hosts = newHosts
 	c.vsrToVSConfigs = newVSRToVSConfigs
 
@@ -1269,6 +1277,11 @@ func (c *Configuration) rebuildHosts() ([]ResourceChange, []ConfigurationProblem
 	c.addProblemsForOrphanOrIgnoredVsrs(newProblems)
 	c.addWarningsForVirtualServersWithMissConfiguredListeners(newResources)
 
+	// Report VirtualServer warning-set changes even when IsEqual skipped a reload.
+	// IsEqual is the reload predicate and intentionally ignores Warnings; reporting
+	// must not depend on that predicate or rejected resources stay silently Valid.
+	changes = append(changes, createVirtualServerWarningChanges(oldHosts, newHosts, changes)...)
+
 	newOrUpdatedProblems := detectChangesInProblems(newProblems, c.hostProblems)
 
 	// safe to update problems
@@ -1396,8 +1409,11 @@ func (c *Configuration) addProblemsForResourcesWithoutActiveHost(resources map[s
 }
 
 func (c *Configuration) addWarningsForVirtualServersWithMissConfiguredListeners(resources map[string]Resource) {
-	for _, r := range resources {
-		vsc, ok := r.(*VirtualServerConfiguration)
+	// Sorted so that VirtualServers sharing a host append their warnings in a
+	// stable order; otherwise slices.Equal on the warnings would flap between
+	// rebuilds and emit spurious UpdateStatus changes.
+	for _, key := range getSortedResourceKeys(resources) {
+		vsc, ok := resources[key].(*VirtualServerConfiguration)
 		if !ok {
 			continue
 		}
@@ -1591,6 +1607,49 @@ func createResourceChangesForHosts(removedHosts []string, updatedHosts []string,
 	return append(deleteChanges, changes...)
 }
 
+// createVirtualServerWarningChanges emits UpdateStatus changes for VirtualServers
+// whose warning set changed while IsEqual still considers the resource unchanged.
+// Resources already present in existing changes are skipped so a reload (or
+// delete) remains the single reporting path for that object.
+func createVirtualServerWarningChanges(oldHosts map[string]Resource, newHosts map[string]Resource, existing []ResourceChange) []ResourceChange {
+	alreadyChanged := make(map[string]struct{}, len(existing))
+	for _, c := range existing {
+		alreadyChanged[c.Resource.GetKeyWithKind()] = struct{}{}
+	}
+
+	var changes []ResourceChange
+
+	for _, h := range getSortedResourceKeys(newHosts) {
+		newVSC, ok := newHosts[h].(*VirtualServerConfiguration)
+		if !ok {
+			continue
+		}
+
+		key := newVSC.GetKeyWithKind()
+		if _, skip := alreadyChanged[key]; skip {
+			continue
+		}
+
+		oldR, exists := oldHosts[h]
+		if !exists {
+			continue
+		}
+		oldVSC, ok := oldR.(*VirtualServerConfiguration)
+		if !ok {
+			continue
+		}
+
+		if !slices.Equal(oldVSC.Warnings, newVSC.Warnings) {
+			changes = append(changes, ResourceChange{
+				Op:       UpdateStatus,
+				Resource: newVSC,
+			})
+		}
+	}
+
+	return changes
+}
+
 func createResourceChangesForListeners(
 	removedListeners []listenerHostKey,
 	updatedListeners []listenerHostKey,
@@ -1979,6 +2038,12 @@ func (c *Configuration) validateVSRSelectors(r *conf_v1.Route, vsHost string) ([
 		}
 	}
 
+	// The loop above ranges over a map, so the per-route "is invalid" warnings
+	// arrive in a random order. Warnings are compared with slices.Equal when
+	// deciding whether to emit an UpdateStatus, so a reorder alone would look
+	// like a change and flood the status with differently ordered messages.
+	sort.Strings(warnings)
+
 	// Sort before building the output slices.  The vsrs slice ends up as
 	// VirtualServerConfiguration.VirtualServerRoutes, which
 	// GenerateVirtualServerConfig walks in order to assign split_clients
```

**File**: `internal/k8s/configuration_test.go` (modified, +264/-0)
```diff
@@ -5285,6 +5285,12 @@ func TestIsEqualForVirtualServers(t *testing.T) {
 			expected:  false,
 			msg:       "virtual servers with virtual server routes with different generation",
 		},
+		{
+			vsConfig1: NewVirtualServerConfiguration(vs, []*conf_v1.VirtualServerRoute{vsr}, nil, []string{}),
+			vsConfig2: NewVirtualServerConfiguration(vs, []*conf_v1.VirtualServerRoute{vsr}, nil, []string{"path /coffee has conflicting subroutes"}),
+			expected:  true,
+			msg:       "virtual servers with different warnings remain equal for reload detection",
+		},
 	}
 
 	for _, test := range tests {
@@ -5865,6 +5871,12 @@ func TestIsEqualForVirtualServersVSR(t *testing.T) {
 			expected:  false,
 			msg:       "virtual servers with virtual server routes with different generation",
 		},
+		{
+			vsConfig1: NewVirtualServerConfiguration(vs, []*conf_v1.VirtualServerRoute{vsr}, nil, []string{}),
+			vsConfig2: NewVirtualServerConfiguration(vs, []*conf_v1.VirtualServerRoute{vsr}, nil, []string{"VirtualServerRoute default/x is invalid"}),
+			expected:  true,
+			msg:       "virtual servers with different warnings remain equal for reload detection",
+		},
 	}
 
 	for _, test := range tests {
@@ -5875,6 +5887,258 @@ func TestIsEqualForVirtualServersVSR(t *testing.T) {
 	}
 }
 
+func cafeRouteSelectorLabels() map[string]string {
+	return map[string]string{"route-group": "cafe"}
+}
+
+func createCafeVirtualServer() *conf_v1.VirtualServer {
+	return createTestVirtualServerWithRoutes("cafe", "cafe.example.com", []conf_v1.Route{{
+		Path: "/coffee",
+		RouteSelector: &metav1.LabelSelector{
+			MatchLabels: cafeRouteSelectorLabels(),
+		},
+	}})
+}
+
+func createCafeVirtualServerRoute(name string, paths ...string) *conf_v1.VirtualServerRoute {
+	subroutes := make([]conf_v1.Route, 0, len(paths))
+	for _, path := range paths {
+		subroutes = append(subroutes, conf_v1.Route{
+			Path: path,
+			Action: &conf_v1.Action{
+				Return: &conf_v1.ActionReturn{Body: name},
+			},
+		})
+	}
+	return &conf_v1.VirtualServerRoute{
+		ObjectMeta: metav1.ObjectMeta{
+			Namespace: "default",
+			Name:      name,
+			Labels:    cafeRouteSelectorLabels(),
+		},
+		Spec: conf_v1.VirtualServerRouteSpec{
+			IngressClass: "nginx",
+			Host:         "cafe.example.com",
+			Subroutes:    subroutes,
+		},
+	}
+}
+
+func requireVirtualServerStatusUpdate(t *testing.T, changes []ResourceChange) *VirtualServerConfiguration {
+	t.Helper()
+	if len(changes) != 1 {
+		t.Fatalf("expected 1 change, got %d: %+v", len(changes), changes)
+	}
+	if changes[0].Op != UpdateStatus {
+		t.Fatalf("expected UpdateStatus, got %v", changes[0].Op)
+	}
+	vsc, ok := changes[0].Resource.(*VirtualServerConfiguration)
+	if !ok {
+		t.Fatalf("expected VirtualServerConfiguration, got %T", changes[0].Resource)
+	}
+	return vsc
+}
+
+func TestVirtualServerWarningReportedWhenLosingVSRDoesNotChangeConfig(t *testing.T) {
+	t.Parallel()
+
+	vs := createCafeVirtualServer()
+	winner := createCafeVirtualServerRoute("coffee-a", "/coffee")
+	loser := createCafeVirtualServerRoute("coffee-b", "/coffee", "/coffee/decaf")
+
+	c := createTestConfiguration()
+	c.AddOrUpdateVirtualServer(vs)
+	c.AddOrUpdateVirtualServerRoute(winner)
+
+	changes, _ := c.AddOrUpdateVirtualServerRoute(loser)
+	vsc := requireVirtualServerStatusUpdate(t, changes)
+	if !strings.Contains(strings.Join(vsc.Warnings, "\n"), "conflicting subroutes") {
+		t.Fatalf("expected conflicting subroutes warning, got %v", vsc.Warnings)
+	}
+
+	changes, _ = c.AddOrUpdateVirtualServerRoute(loser)
+	if len(changes) != 0 {
+		t.Fatalf("expected no change when warning set is unchanged, got %+v", changes)
+	}
+
+	changes, _ = c.DeleteVirtualServerRoute("default/coffee-b")
+	vsc = requireVirtualServerStatusUpdate(t, changes)
+	if len(vsc.Warnings) != 0 {
+		t.Fatalf("expected warnings to be cleared, got %v", vsc.Warnings)
+	}
+}
+
+func TestVirtualServerWarningReportedWhenRejectedVSRDoesNotChangeConfig(t *testing.T) {
+	t.Parallel()
+
+	vs := createCafeVirtualServer()
+	winner := createCafeVirtualServerRoute("coffee-a", "/coffee")
+	invalid := createCafeVirtualServerRoute("tea", "/coffee")
+	invalid.Spec.Host = "wrong.example.com"
+
+	c := createTestConfiguration()
+	c.AddOrUpdateVirtualServer(vs)
+	c.AddOrUpdateVirtualServerRoute(winner)
+
+	changes, _ := c.AddOrUpdateVirtualServerRoute(invalid)
+	vsc := requireVirtualServerStatusUpdate(t, changes)
+	if !strings.Contains(strings.Join(vsc.Warnings, "\n"), "must be equal to 'cafe.example.com'") {
+		t.Fatalf("expected host mismatch warning, got %v", vsc.Warnings)
+	}
+}
+
+func TestVirtualServerWarningWithAcceptedSetChangeStillReloads(t *testing.T) {
+	t.Parallel()
+
+	vs := createCafeVirtualServer()
+	winner := createCafeVirtualServerRoute("coffee-a", "/coffee")
+	loser := createCafeVirtualServerRoute("coffee-b", "/coffee", "/coffee/decaf")
+
+	c := createTestConfiguration()
+	c.AddOrUpdateVirtualServer(vs)
+	c.AddOrUpdateVirtualServerRoute(loser)
+
+	changes, _ := c.AddOrUpdateVirtualServerRout
```

**File**: `internal/k8s/controller.go` (modified, +95/-14)
```diff
@@ -1681,8 +1681,9 @@ func vsSelfRejected(changes []ResourceChange, vs *conf_v1.VirtualServer) bool {
 // rejected VirtualServer update, with the same semantics the pre-fast-lane
 // haltIfVSConfigInvalid had: a VirtualServer Delete is torn down and
 // reported via processDelete (which duplicates none of the logic here), a
-// VirtualServer AddOrUpdate only gets a status/event update, and any
-// non-VirtualServer change is left untouched.
+// VirtualServer AddOrUpdate or UpdateStatus only gets a status/event update,
+// and any non-VirtualServer change is left untouched. Only an explicit Delete
+// removes config; unknown operations do nothing.
 //
 // AddOrUpdate deliberately does not render here. That means a VirtualServer
 // taking over the host just freed by the rejected one is left unserved until
@@ -1697,11 +1698,16 @@ func (lbc *LoadBalancerController) processRejectedVSChanges(changes []ResourceCh
 		if !ok {
 			continue
 		}
-		if c.Op == AddOrUpdate {
+		switch c.Op {
+		case AddOrUpdate:
 			lbc.updateVirtualServerStatusAndEvents(impl, configs.Warnings{}, nil)
-			continue
+		case UpdateStatus:
+			// Status only. This must never fall through to processDelete,
+			// which would remove the NGINX config of an unrelated VirtualServer.
+			lbc.processStatusUpdate(c)
+		case Delete:
+			lbc.processDelete(c)
 		}
-		lbc.processDelete(c)
 	}
 }
 
@@ -1724,16 +1730,31 @@ func (lbc *LoadBalancerController) refreshStaleVSRReferences() {
 // and emits the usual status and events, skipping template regeneration and
 // the reload.
 //
-// It returns false, without side effects, unless changes is exactly a single
-// AddOrUpdate of the VirtualServer identified by key. Any other shape -- a
-// Delete, a cascade to another resource, or a rejected spec -- means the
-// caller must fall back to processChanges, which is correct for all of them.
+// UpdateStatus changes only report status and events for other, unchanged
+// resources and never touch NGINX, so they do not disqualify the fast lane.
+// They are set aside before the shape check and processed once the weight
+// update has been applied.
+//
+// It returns false, without side effects, unless the remaining changes are
+// exactly a single AddOrUpdate of the VirtualServer identified by key. Any
+// other shape -- a Delete, a cascade to another resource, or a rejected spec --
+// means the caller must fall back to processChanges, which dispatches each
+// operation explicitly and is correct for all of them.
 func (lbc *LoadBalancerController) applyWeightOnlyVSChanges(key string, changes []ResourceChange, weightUpdates []configs.WeightUpdate) bool {
-	if len(changes) != 1 || changes[0].Op != AddOrUpdate {
+	var statusUpdates, others []ResourceChange
+	for _, c := range changes {
+		if c.Op == UpdateStatus {
+			statusUpdates = append(statusUpdates, c)
+			continue
+		}
+		others = append(others, c)
+	}
+
+	if len(others) != 1 || others[0].Op != AddOrUpdate {
 		return false
 	}
 
-	impl, ok := changes[0].Resource.(*VirtualServerConfiguration)
+	impl, ok := others[0].Resource.(*VirtualServerConfiguration)
 	if !ok || getResourceKey(&impl.VirtualServer.ObjectMeta) != key {
 		return false
 	}
@@ -1743,6 +1764,10 @@ func (lbc *LoadBalancerController) applyWeightOnlyVSChanges(key string, changes
 		lbc.configurator.UpsertSplitClientsKeyVal(w.Zone, w.Key, w.Value)
 	}
 
+	for _, c := range statusUpdates {
+		lbc.processStatusUpdate(c)
+	}
+
 	return true
 }
 
@@ -1801,12 +1826,49 @@ func (lbc *LoadBalancerController) processChanges(changes []ResourceChange) {
 	lbc.refreshStaleVSRReferences()
 
 	for _, c := range changes {
-		if c.Op == AddOrUpdate {
+		switch c.Op {
+		case AddOrUpdate:
 			lbc.processAddOrUpdate(c)
-		} else if c.Op == Delete {
+		case Delete:
 			lbc.processDelete(c)
+		case UpdateStatus:
+			lbc.processStatusUpdate(c)
+		}
+	}
+}
+
+// processStatusUpdate reports status and events for a change that does not
+// need NGINX to be reconfigured. It never touches NGINX config.
+//
+// The warnings the configurator produced when the VirtualServer was last
+// rendered (a missing Service or TLS secret, for example) still apply, so they
+// are carried over instead of being reset to an empty set. Only the
+// VirtualServer itself is reported: a status-only change does not alter any
+// attached VirtualServerRoute, so no events are emitted for them.
+func (lbc *LoadBalancerController) processStatusUpdate(c ResourceChange) {
+	switch impl := c.Resource.(type) {
+	case *VirtualServerConfiguration:
+		lbc.updateVirtualServerOwnStatusAndEvents(impl, lbc.lastRenderedVirtualServerWarnings(impl), nil, true)
+	}
+}
+
+// lastRenderedVirtualServerWarnings returns the configurator warnings recorded
+// the last time the VirtualServer in vsConfig was rendered, re-keyed to the
+// VirtualServer object vsConfig holds (the rendered copy may be an older object
+// than the one in the change, so warnings are matched by namespace and name).
+func (lbc *LoadBalan
```

**File**: `internal/k8s/controller_test.go` (modified, +38/-0)
```diff
@@ -2821,6 +2821,44 @@ func TestProcessChangesDispatchesDelete(t *testing.T) {
 	})
 }
 
+func TestProcessChangesDispatchesUpdateStatusWithoutReload(t *testing.T) {
+	t.Parallel()
+
+	manager := newTestNginxManager()
+	lbc := createIngressProcessChangesController(t, manager)
+	// Skip status API writes; this test only asserts events and that NGINX is not reloaded.
+	lbc.isLeaderElectionEnabled = true
+
+	vs := createTestVirtualServer("cafe", "cafe.example.com")
+	vsConfig := NewVirtualServerConfiguration(vs, nil, nil, []string{
+		"path /coffee has conflicting subroutes on default/coffee-b and default/coffee-a",
+	})
+
+	lbc.processChanges([]ResourceChange{
+		{Op: UpdateStatus, Resource: vsConfig},
+	})
+
+	if manager.CreateCalls != 0 {
+		t.Fatalf("UpdateStatus must not write NGINX config, got %d CreateConfig call(s)", manager.CreateCalls)
+	}
+
+	recorder, ok := lbc.recorder.(*record.FakeRecorder)
+	if !ok {
+		t.Fatal("expected FakeRecorder")
+	}
+	select {
+	case e := <-recorder.Events:
+		if !strings.Contains(e, nl.EventReasonAddedOrUpdatedWithWarning) {
+			t.Errorf("expected warning event, got %q", e)
+		}
+		if !strings.Contains(e, "conflicting subroutes") {
+			t.Errorf("expected conflict warning in event, got %q", e)
+		}
+	default:
+		t.Fatal("expected a VirtualServer warning event")
+	}
+}
+
 // The following tests guard against a nil pointer dereference panic (see
 // getNamespacedInformer) when a resource for a namespace that is no longer watched
 // (e.g. its watch-namespace-label was removed) is processed.
```

**File**: `internal/k8s/global_configuration.go` (modified, +9/-0)
```diff
@@ -120,6 +120,9 @@ func (lbc *LoadBalancerController) processChangesFromGlobalConfiguration(changes
 	var deletedVSKeys []string
 
 	var updatedResources []Resource
+	// Resources that only need their status refreshed. They are not part of the
+	// NGINX update, so a batch error must not be attributed to them.
+	var statusOnlyChanges []ResourceChange
 
 	for _, c := range changes {
 		switch impl := c.Resource.(type) {
@@ -133,6 +136,8 @@ func (lbc *LoadBalancerController) processChangesFromGlobalConfiguration(changes
 				key := getResourceKey(&impl.VirtualServer.ObjectMeta)
 
 				deletedVSKeys = append(deletedVSKeys, key)
+			} else if c.Op == UpdateStatus {
+				statusOnlyChanges = append(statusOnlyChanges, c)
 			}
 		case *TransportServerConfiguration:
 			if c.Op == AddOrUpdate {
@@ -168,5 +173,9 @@ func (lbc *LoadBalancerController) processChangesFromGlobalConfiguration(changes
 
 	lbc.updateResourcesStatusAndEvents(updatedResources, configs.Warnings{}, updateErr)
 
+	for _, c := range statusOnlyChanges {
+		lbc.processStatusUpdate(c)
+	}
+
 	return updateErr
 }
```

**File**: `internal/k8s/weight_fast_lane_test.go` (modified, +308/-0)
```diff
@@ -2,6 +2,7 @@ package k8s
 
 import (
 	"context"
+	"errors"
 	"path/filepath"
 	"strings"
 	"sync"
@@ -13,6 +14,7 @@ import (
 	"github.com/nginx/kubernetes-ingress/internal/configs"
 	"github.com/nginx/kubernetes-ingress/internal/configs/version1"
 	"github.com/nginx/kubernetes-ingress/internal/configs/version2"
+	"github.com/nginx/kubernetes-ingress/internal/k8s/secrets"
 	nl "github.com/nginx/kubernetes-ingress/internal/logger"
 	"github.com/nginx/kubernetes-ingress/internal/nginx"
 	conf_v1 "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/v1"
@@ -36,8 +38,11 @@ type recordingWeightManager struct {
 	mu      sync.Mutex
 	keyvals []configs.WeightUpdate
 
+	deleted []string
+
 	configWrites atomic.Int32
 	reloads      atomic.Int32
+	failReload   atomic.Bool
 }
 
 func newRecordingWeightManager() *recordingWeightManager {
@@ -65,13 +70,31 @@ func (m *recordingWeightManager) keyvalsSince(n int) []configs.WeightUpdate {
 	return append([]configs.WeightUpdate(nil), m.keyvals[n:]...)
 }
 
+// DeleteConfig records the name so tests can assert a change did not remove
+// NGINX config.
+func (m *recordingWeightManager) DeleteConfig(name string) {
+	m.mu.Lock()
+	m.deleted = append(m.deleted, name)
+	m.mu.Unlock()
+	m.FakeManager.DeleteConfig(name)
+}
+
+func (m *recordingWeightManager) deletedConfigs() []string {
+	m.mu.Lock()
+	defer m.mu.Unlock()
+	return append([]string(nil), m.deleted...)
+}
+
 func (m *recordingWeightManager) CreateConfig(name string, content []byte) (bool, error) {
 	m.configWrites.Add(1)
 	return m.FakeManager.CreateConfig(name, content)
 }
 
 func (m *recordingWeightManager) Reload(isEndpointsUpdate bool) error {
 	m.reloads.Add(1)
+	if m.failReload.Load() {
+		return errors.New("injected reload failure")
+	}
 	return m.FakeManager.Reload(isEndpointsUpdate)
 }
 
@@ -978,6 +1001,24 @@ func TestApplyWeightOnlyVSChanges_RejectsUnexpectedChangeShapes(t *testing.T) {
 			name:    "delete instead of add-or-update",
 			changes: []ResourceChange{{Op: Delete, Resource: vsc}},
 		},
+		{
+			name:    "update-status instead of add-or-update",
+			changes: []ResourceChange{{Op: UpdateStatus, Resource: vsc}},
+		},
+		{
+			name: "update-status alongside a different VirtualServer's add-or-update",
+			changes: []ResourceChange{
+				{Op: UpdateStatus, Resource: vsc},
+				{Op: AddOrUpdate, Resource: otherVSC},
+			},
+		},
+		{
+			name: "update-status alongside a delete",
+			changes: []ResourceChange{
+				{Op: UpdateStatus, Resource: otherVSC},
+				{Op: Delete, Resource: vsc},
+			},
+		},
 		{
 			name: "cascade to a second resource",
 			changes: []ResourceChange{
@@ -1012,6 +1053,84 @@ func TestApplyWeightOnlyVSChanges_RejectsUnexpectedChangeShapes(t *testing.T) {
 	}
 }
 
+// TestApplyWeightOnlyVSChanges_KeepsFastLaneWithUnrelatedStatusUpdate pins that
+// a warning-only UpdateStatus for another VirtualServer, which rebuildHosts can
+// report in the same batch, does not push a weight-only update off the fast
+// lane. The weight update is still applied in place and the status update is
+// still reported, without touching NGINX config.
+func TestApplyWeightOnlyVSChanges_KeepsFastLaneWithUnrelatedStatusUpdate(t *testing.T) {
+	t.Parallel()
+
+	lbc, mgr := newWeightTestLBC(t, true)
+
+	cafe := weightTestVS("cafe", 1, []conf_v1.Route{twoWayRoute("/tea", 50, 50)})
+	seedVS(t, lbc, cafe)
+	other := weightTestVS("other", 1, []conf_v1.Route{twoWayRoute("/tea", 50, 50)})
+	seedVS(t, lbc, other)
+	drainEvents(t, lbc)
+
+	cafeVSC, ok := lbc.configuration.hosts[cafe.Spec.Host].(*VirtualServerConfiguration)
+	if !ok {
+		t.Fatalf("host %s is not a VirtualServerConfiguration", cafe.Spec.Host)
+	}
+	otherVSC, ok := lbc.configuration.hosts[other.Spec.Host].(*VirtualServerConfiguration)
+	if !ok {
+		t.Fatalf("host %s is not a VirtualServerConfiguration", other.Spec.Host)
+	}
+
+	writes := mgr.configWrites.Load()
+	keyvals := len(mgr.recordedKeyvals())
+	updates := []configs.WeightUpdate{{Zone: "z", Key: "k", Value: "v"}}
+
+	changes := []ResourceChange{
+		{Op: UpdateStatus, Resource: otherVSC},
+		{Op: AddOrUpdate, Resource: cafeVSC},
+	}
+	if !lbc.applyWeightOnlyVSChanges("default/cafe", changes, updates) {
+		t.Fatal("applyWeightOnlyVSChanges() = false, want true: an unrelated UpdateStatus must not disable the fast lane")
+	}
+
+	if got := len(mgr.recordedKeyvals()) - keyvals; got != 1 {
+		t.Errorf("fast lane wrote %d keyvals, want 1", got)
+	}
+	if got := mgr.configWrites.Load() - writes; got != 0 {
+		t.Errorf("fast lane wrote %d NGINX configs, want 0", got)
+	}
+
+	var cafeEvents, otherEvents int
+	for _, e := range drainEvents(t, lbc) {
+		switch {
+		case strings.Contains(e, "default/cafe"):
+			cafeEvents++
+		case strings.Contains(e, "default/other"):
+			otherEvents++
+			if !strings.Contains(e, "is unchanged, status updated") {
+				t.Errorf("status-only event for default/other has an inaccurate message: %q", e)
+			}
+		}
+	}
+	if cafeEvents != 1 || otherEvents != 1 {
+		t.Errorf
```

**File**: `tests/suite/test_virtual_server_custom_listeners.py` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ class TestVirtualServerCustomListeners:
                 "http_listener_in_config": False,
                 "https_listener_in_config": False,
                 "expected_response_codes": [404, 404, 0, 0],
-                "expected_vs_error_msg": "Listeners defined, but no GlobalConfiguration is deployed",
+                "expected_vs_error_msg": "Listener http-8085 is not defined in GlobalConfiguration",
                 "expected_gc_error_msg": "",
             },
             {
```

---

### Incident Patch 3: `f35fda10` (2026-10-01)
**Commit Message**: Revert batch reload changes (#11000)

* Revert "Address PR feedback"

This reverts commit f0b2622fd18020f8cfd74afcb4727ae6418bcf56.

* Revert "fix(batch-reload): stop dropping Plus endpoint updates and bound batch staleness"

This reverts commit d640d478328ce56b511bb70c5eefb34615e0177d.

* Revert "docs: document weight-update batch-mode cancellation known issue"

This reverts commit ca2831e8900b465289f0ed4f695cb3ba38429128.

* Revert "Add batch reload tests to validate endpoint updates under churn conditions"

This reverts commit 6f6031946e38856dbc527ef22405a02a54bc526f.

**File**: `docs/developer/README.md` (modified, +0/-1)
```diff
@@ -3,4 +3,3 @@
 - [Architecture](./architecture.md)
 - [Debugging](./debugging.md)
 - [Type-Agnostic Kubernetes Secrets](./opaque-secrets-high-level-design.md)
-- [Known Issues](./known-issues.md)
```

**File**: `docs/developer/known-issues.md` (removed, +0/-46)
```diff
@@ -1,46 +0,0 @@
-# Known Issues
-
-Bugs and quirks that are understood but intentionally not fixed yet, tracked here until
-they're promoted to a GitHub issue and fixed properly.
-
-## Weight-update VirtualServers silently cancel batch mode
-
-**Where:** `internal/configs/configurator.go`, `Configurator.AddOrUpdateVirtualServer`
-
-```go
-if len(weightUpdates) > 0 {
-    cnf.EnableReloads()
-}
-```
-
-**What happens:** `sync()` (`internal/k8s/controller.go`) enters batch mode by calling
-`Configurator.DisableReloads()` when the work queue has more than one item, deferring
-reloads until the batch drains (NGINX Plus API writes stay enabled throughout batch
-mode — see `Configurator.isPlusAPIEnabled` — so they are not affected by this issue).
-`AddOrUpdateVirtualServer` is one of the sync paths that can run mid-batch (e.g. a
-VirtualServer with traffic-splitting weights is updated while other events are queued).
-If that VirtualServer has pending `weightUpdates`, this line calls `EnableReloads()`
-unconditionally — re-enabling reloads for the rest of the process, not just for this
-call.
-
-The controller's `batchSyncEnabled` bookkeeping in `sync()` is untouched, so the
-controller still believes it's batching and will later call `EnableReloads()` again and
-run its own batch-end reload logic. The visible effect is just that batching is
-defeated early for whatever mid-batch work follows this call — reloads start happening
-immediately instead of being deferred to the batch end. It doesn't corrupt state, but
-it undermines the point of batching (coalescing reloads under churn) for the remainder
-of that batch.
-
-**Why it hasn't been fixed:** Low impact (reload storms are cosmetic/perf, not
-correctness) and it's adjacent to, but distinct from, the batch-reload staleness work
-(nginx/kubernetes-ingress#7778, #7779, #10397). Flagged here instead of folded into
-that fix to keep that change's diff focused.
-
-**Suggested fix:** Don't call the package-wide `EnableReloads()`/`DisableReloads()`
-toggle from inside a single resource's update path. Either gate the weight-update reload
-on whether the caller is already in batch mode (skip `EnableReloads()` if
-`!cnf.isReloadsEnabled` was already true going in, perform a one-off reload instead of
-flipping the global flag), or have the controller re-assert `DisableReloads()` after
-`AddOrUpdateVirtualServer` returns when still inside a batch.
-
-**Action:** Open a GitHub issue before fixing; this note is not itself a fix.
```

**File**: `internal/configs/batch_reload_test.go` (removed, +0/-635)
```diff
@@ -1,635 +0,0 @@
-package configs
-
-import (
-	"bytes"
-	"context"
-	"fmt"
-	"os"
-	"sync/atomic"
-	"testing"
-
-	"github.com/nginx/kubernetes-ingress/internal/configs/version1"
-	"github.com/nginx/kubernetes-ingress/internal/configs/version2"
-	"github.com/nginx/kubernetes-ingress/internal/nginx"
-	conf_v1 "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/v1"
-	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-)
-
-// osReadFile / osWriteFile / osMkdirAll / bytesEqual are aliases so the
-// diskManager helper reads cleanly without importing os/bytes in every
-// caller. They're plain wrappers, no test-only behavior.
-var (
-	osReadFile  = os.ReadFile
-	osWriteFile = os.WriteFile
-	osMkdirAll  = os.MkdirAll
-	bytesEqual  = bytes.Equal
-)
-
-// recordingBatchManager wraps FakeManager and records calls to the reload
-// path (Configurator.Reload, gated by isReloadsEnabled) and the NGINX Plus
-// API upstream writes (gated by isPlusAPIEnabled). Referenced by the
-// batch/reload regression tests for
-// https://github.com/nginx/kubernetes-ingress/issues/7778 and
-// https://github.com/nginx/kubernetes-ingress/issues/10397.
-type recordingBatchManager struct {
-	*nginx.FakeManager
-	reloads             atomic.Int32
-	updateServersInPlus atomic.Int32
-	updateStreamServers atomic.Int32
-}
-
-func newRecordingBatchManager() *recordingBatchManager {
-	return &recordingBatchManager{FakeManager: nginx.NewFakeManager("/etc/nginx")}
-}
-
-func (m *recordingBatchManager) Reload(isEndpointsUpdate bool) error {
-	m.reloads.Add(1)
-	return m.FakeManager.Reload(isEndpointsUpdate)
-}
-
-func (m *recordingBatchManager) UpdateServersInPlus(upstream string, servers []string, cfg nginx.ServerConfig) error {
-	m.updateServersInPlus.Add(1)
-	return m.FakeManager.UpdateServersInPlus(upstream, servers, cfg)
-}
-
-func (m *recordingBatchManager) UpdateStreamServersInPlus(upstream string, servers []string) error {
-	m.updateStreamServers.Add(1)
-	return m.FakeManager.UpdateStreamServersInPlus(upstream, servers)
-}
-
-// failingPlusAPIManager wraps recordingBatchManager and makes every
-// UpdateServersInPlus call fail, simulating an NGINX Plus API error (e.g.
-// the upstream doesn't exist yet in the running config because it was
-// created earlier in the same batch). Reload calls are still counted via
-// the embedded recordingBatchManager.
-type failingPlusAPIManager struct {
-	*recordingBatchManager
-}
-
-func (m *failingPlusAPIManager) UpdateServersInPlus(upstream string, _ []string, _ nginx.ServerConfig) error {
-	m.updateServersInPlus.Add(1)
-	return fmt.Errorf("simulated Plus API failure for upstream %s", upstream)
-}
-
-// TestBatchModeDropsPlusEndpointUpdates pins the fix for issue #7778
-// (https://github.com/nginx/kubernetes-ingress/issues/7778): NGINX Plus
-// reloading on every endpoint churn event.
-//
-// Originally, DisableReloads() (called by sync() at batch start) flipped a
-// single isReloadsEnabled flag that gated both Configurator.Reload and the
-// Plus API upstream writes (updateServersInPlus / updateStreamServersInPlus).
-// That forced a choice: either the Plus API write was suppressed during a
-// batch (stale endpoints until the batch-end reload, or until #7779-style
-// changes remove that reload entirely — see
-// https://github.com/nginx/kubernetes-ingress/pull/7779), or reloads were
-// re-enabled mid-batch (defeating the point of batching, #7778's reload
-// storm).
-//
-// Configurator now has two independent flags: isReloadsEnabled (gates
-// Reload) and isPlusAPIEnabled (gates the Plus API writes). DisableReloads
-// only clears the former, so the Plus API upstream write continues to apply
-// endpoint changes live during a batch while reloads stay deferred — closing
-// #7778 without reintroducing the staleness #7779 would have caused.
-func TestBatchModeDropsPlusEndpointUpdates(t *testing.T) {
-	t.Parallel()
-
-	mgr := newRecordingBatchManager()
-	cnf := createTestConfiguratorWithManager(t, mgr)
-	cnf.isPlus = true
-
-	vsEx := cafeVSExWithEndpoints("10.0.0.1:80")
-
-	if err := cnf.updatePlusEndpointsForVirtualServer(vsEx); err != nil {
-		t.Fatalf("baseline updatePlusEndpointsForVirtualServer: %v", err)
-	}
-	if got := mgr.updateServersInPlus.Load(); got != 1 {
-		t.Fatalf("baseline UpdateServersInPlus calls = %d, want 1", got)
-	}
-
-	// sync() enters batch mode when the work queue has more than one item.
-	cnf.DisableReloads()
-
-	// Endpointslice update during the batch: fresh pod IP arrives.
-	vsEx.Endpoints["default/tea-svc:80"] = []string{"10.0.0.2:80"}
-	if err := cnf.updatePlusEndpointsForVirtualServer(vsEx); err != nil {
-		t.Fatalf("in-batch updatePlusEndpointsForVirtualServer: %v", err)
-	}
-
-	if got := mgr.updateServersInPlus.Load(); got != 2 {
-		t.Fatalf("Plus API upstream write suppressed during batch: UpdateServersInPlus calls = %d, want 2 "+
-			"(isPlusAPIEnabled should stay true across DisableReloads so endpoints keep propagating "+
-			"to the running NGINX Plus du
```

**File**: `internal/configs/configurator.go` (modified, +25/-77)
```diff
@@ -130,47 +130,26 @@ type metricLabelsIndex struct {
 // This allows the Ingress Controller to incrementally build the NGINX configuration during the IC start and
 // then apply it at the end of the start.
 type Configurator struct {
-	nginxManager            nginx.Manager
-	staticCfgParams         *StaticConfigParams
-	CfgParams               *ConfigParams
-	MgmtCfgParams           *MGMTConfigParams
-	templateExecutor        *version1.TemplateExecutor
-	templateExecutorV2      *version2.TemplateExecutor
-	ingresses               map[string]*IngressEx
-	minions                 map[string]map[string]bool
-	mergeableIngresses      map[string]*MergeableIngresses
-	virtualServers          map[string]*VirtualServerEx
-	transportServers        map[string]*TransportServerEx
-	tlsPassthroughPairs     map[string]tlsPassthroughPair
-	isWildcardEnabled       bool
-	isPlus                  bool
-	labelUpdater            collector.LabelUpdater
-	metricLabelsIndex       *metricLabelsIndex
-	isPrometheusEnabled     bool
-	latencyCollector        latCollector.LatencyCollector
-	isLatencyMetricsEnabled bool
-	isReloadsEnabled        bool
-	// isPlusAPIEnabled gates NGINX Plus API upstream writes
-	// (updateServersInPlus / updateStreamServersInPlus) independently of
-	// isReloadsEnabled. Both start disabled during startup build-up (the
-	// running NGINX has no config for these upstreams yet, so an API write
-	// would fail). EnableReloads() enables both. DisableReloads() —
-	// called when the controller enters batch mode — only disables
-	// isReloadsEnabled: nginx is already running a valid config at that
-	// point, so Plus API writes may safely continue even while reloads are
-	// deferred for the rest of the batch. See
-	// https://github.com/nginx/kubernetes-ingress/issues/7778.
-	isPlusAPIEnabled bool
-	// reloadDeferred is set by Reload() whenever it no-ops because
-	// isReloadsEnabled is false, and by deferReload() when an UpdateEndpoints*
-	// call aborts after an earlier resource in the same call already wrote
-	// its config (see deferReload). It is cleared only once Reload() calls
-	// through to nginxManager.Reload and that call succeeds — a failed
-	// reload leaves it set so the retry isn't lost. ReloadForBatchUpdates
-	// consults it at batch end so a reload that was skipped or failed
-	// mid-batch is not silently dropped just because the triggering task's
-	// Kind didn't otherwise call for one.
-	reloadDeferred               bool
+	nginxManager                 nginx.Manager
+	staticCfgParams              *StaticConfigParams
+	CfgParams                    *ConfigParams
+	MgmtCfgParams                *MGMTConfigParams
+	templateExecutor             *version1.TemplateExecutor
+	templateExecutorV2           *version2.TemplateExecutor
+	ingresses                    map[string]*IngressEx
+	minions                      map[string]map[string]bool
+	mergeableIngresses           map[string]*MergeableIngresses
+	virtualServers               map[string]*VirtualServerEx
+	transportServers             map[string]*TransportServerEx
+	tlsPassthroughPairs          map[string]tlsPassthroughPair
+	isWildcardEnabled            bool
+	isPlus                       bool
+	labelUpdater                 collector.LabelUpdater
+	metricLabelsIndex            *metricLabelsIndex
+	isPrometheusEnabled          bool
+	latencyCollector             latCollector.LatencyCollector
+	isLatencyMetricsEnabled      bool
+	isReloadsEnabled             bool
 	isDynamicSSLReloadEnabled    bool
 	ingressControllerReplicas    int
 	effectiveBatchExclusionCount int
@@ -1258,7 +1237,6 @@ func (cnf *Configurator) UpdateEndpoints(ingExes []*IngressEx) (Warnings, error)
 	for _, ingEx := range ingExes {
 		_, warnings, err := cnf.addOrUpdateIngress(ingEx)
 		if err != nil {
-			cnf.deferReload()
 			return allWarnings, fmt.Errorf("error adding or updating ingress %v/%v: %w", ingEx.Ingress.Namespace, ingEx.Ingress.Name, err)
 		}
 		allWarnings.Add(warnings)
@@ -1294,7 +1272,6 @@ func (cnf *Configurator) UpdateEndpointsMergeableIngress(mergeableIngresses []*M
 		mergeableIng := mergeableIngresses[i]
 		_, warnings, err := cnf.addOrUpdateMergeableIngress(mergeableIngresses[i])
 		if err != nil {
-			cnf.deferReload()
 			return allWarnings, fmt.Errorf("error adding or updating mergeableIngress %v/%v: %w", mergeableIngresses[i].Master.Ingress.Namespace, mergeableIngresses[i].Master.Ingress.Name, err)
 		}
 		allWarnings.Add(warnings)
@@ -1338,7 +1315,6 @@ func (cnf *Configurator) UpdateEndpointsForVirtualServers(virtualServerExes []*V
 	for _, vs := range virtualServerExes {
 		_, warnings, _, err := cnf.addOrUpdateVirtualServer(vs)
 		if err != nil {
-			cnf.deferReload()
 			return allWarnings, fmt.Errorf("error adding or updating VirtualServer %v/%v: %w", vs.VirtualServer.Namespace, vs.VirtualServer.Name, err)
 		}
 		allWarnings.Add(warnings)
@@ -1426,7 +1402,6 @@ func (cnf *Configurator) UpdateEndpointsForTransportServers(transportServerExes
 		// 
```

**File**: `internal/configs/configurator_bench_test.go` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ func createTestConfiguratorBench() (*Configurator, error) {
 		IsLatencyMetricsEnabled: false,
 		NginxVersion:            nginx.NewVersion("nginx version: nginx/1.25.3 (nginx-plus-r31)"),
 	})
-	cnf.EnableReloads()
+	cnf.isReloadsEnabled = true
 	return cnf, nil
 }
 
```

**File**: `internal/configs/configurator_test.go` (modified, +3/-3)
```diff
@@ -70,7 +70,7 @@ func createTestConfiguratorWithManager(t *testing.T, manager nginx.Manager) *Con
 		IsLatencyMetricsEnabled: false,
 		NginxVersion:            nginx.NewVersion("nginx version: nginx/1.25.3 (nginx-plus-r31)"),
 	})
-	cnf.EnableReloads()
+	cnf.isReloadsEnabled = true
 	return cnf
 }
 
@@ -110,7 +110,7 @@ func createTestConfiguratorInvalidIngressTemplate(t *testing.T) *Configurator {
 		IsPrometheusEnabled:     false,
 		IsLatencyMetricsEnabled: false,
 	})
-	cnf.EnableReloads()
+	cnf.isReloadsEnabled = true
 	return cnf
 }
 
@@ -579,7 +579,7 @@ func TestUpdatePlusExternalAuthEndpoints(t *testing.T) {
 				updatedUpstreams: make(map[string][]string),
 			}
 			cnf := createTestConfiguratorWithManager(t, mgr)
-			cnf.EnableReloads()
+			cnf.isReloadsEnabled = true
 
 			err := cnf.updatePlusExternalAuthEndpoints(
 				tt.policies, tt.endpoints, tt.parentIngress, nginx.ServerConfig{},
```

**File**: `internal/k8s/batch_sync_test.go` (modified, +0/-220)
```diff
@@ -6,7 +6,6 @@ import (
 	"path/filepath"
 	"sync/atomic"
 	"testing"
-	"time"
 
 	"github.com/nginx/kubernetes-ingress/internal/configs"
 	"github.com/nginx/kubernetes-ingress/internal/configs/version1"
@@ -202,222 +201,3 @@ func TestBatchModeResetsUpdateAllConfigsFlag(t *testing.T) {
 		t.Fatal("batch 2: batchSyncEnabled still true after drain")
 	}
 }
-
-// TestOSSBatchNeverDrainsUnderEndpointsliceChurn drives sync() with a real
-// syncQueue and demonstrates issue #10397
-// (https://github.com/nginx/kubernetes-ingress/issues/10397): without a
-// bounded batch window, the deferred reload for a real config change is not
-// fired while endpointslice churn keeps syncQueue.Len() > 0.
-//
-// Scenario:
-//   - Batch mode is entered on the first sync (queue.Len() > 1).
-//   - One non-endpointslice task early in the batch sets enableBatchReload=true
-//     (models an Ingress/VS change that would need a reload).
-//   - All other tasks are endpointslice events targeting a namespace whose
-//     endpointSliceLister is empty — syncEndpointSlices returns false without
-//     touching config, matching "endpointslice churn for services this
-//     controller does not track".
-//   - batchReloadWindow is left at its zero value (disabled), so this test
-//     pins the pre-fix, unbounded-drain semantics: no reload fires while
-//     queue.Len() > 0, and the batch-end reload fires exactly once when the
-//     queue finally drains. All 51 syncs run synchronously in well under the
-//     production batchReloadWindowDefault, so this is unaffected by the fix
-//     in TestBatchEndsOnWindowUnderContinuousChurn below.
-func TestOSSBatchNeverDrainsUnderEndpointsliceChurn(t *testing.T) {
-	t.Parallel()
-
-	mgr := newRecordingBatchManager()
-	lbc := newBatchTestLBC(t, mgr)
-
-	const churnCount = 50
-
-	// One config-relevant task (any Kind that != endpointslice). We use a
-	// value outside the switch cases so dispatch is a no-op, but the top-of-
-	// sync branch still sets enableBatchReload=true because the Kind is not
-	// endpointslice.
-	const configRelevant = 999
-	lbc.syncQueue.queue.Add(task{Kind: configRelevant, Key: "default/dummy-ingress"})
-
-	// Sustained endpointslice churn from unrelated services. Each task must
-	// carry a distinct Key because workqueue.Add deduplicates on the item
-	// value; identical tasks would collapse into a single queue entry.
-	for i := 0; i < churnCount; i++ {
-		lbc.syncQueue.queue.Add(task{Kind: endpointslice, Key: fmt.Sprintf("default/churn-svc-%d", i)})
-	}
-
-	for lbc.syncQueue.queue.Len() > 0 {
-		obj, quit := lbc.syncQueue.queue.Get()
-		if quit {
-			t.Fatal("queue shut down mid-test")
-		}
-		lbc.sync(obj.(task))
-		lbc.syncQueue.queue.Done(obj)
-
-		if lbc.syncQueue.queue.Len() > 0 {
-			if got := mgr.reloads.Load(); got != 0 {
-				t.Fatalf("reload fired while queue.Len() = %d: reloads = %d, want 0",
-					lbc.syncQueue.queue.Len(), got)
-			}
-		}
-	}
-
-	if got := mgr.reloads.Load(); got != 1 {
-		t.Fatalf("post-drain reload count = %d, want 1 (batch-end reload should fire exactly once)", got)
-	}
-}
-
-// TestBatchEndsOnWindowUnderContinuousChurn is the fix-side counterpart to
-// TestOSSBatchNeverDrainsUnderEndpointsliceChurn: it drives the same
-// continuous-arrivals-outpacing-drain scenario from issue #10397
-// (https://github.com/nginx/kubernetes-ingress/issues/10397) — a single
-// "real" config change (dummy Ingress) enqueued alongside endpointslice
-// churn, with a *new* endpointslice task enqueued for every task processed
-// so arrivals outpace drain and syncQueue.Len() never reaches 0 — but with
-// batchReloadWindow set to a tiny positive duration (matching what
-// NewLoadBalancerController wires up in production via
-// batchReloadWindowDefault). It asserts the fix actually closes the gap:
-// the pending reload fires well before the churn itself stops, instead of
-// being deferred for the full duration of a rolling deployment.
-func TestBatchEndsOnWindowUnderContinuousChurn(t *testing.T) {
-	t.Parallel()
-
-	mgr := newRecordingBatchManager()
-	lbc := newBatchTestLBC(t, mgr)
-	lbc.batchReloadWindow = time.Microsecond
-
-	// Enter batch mode: at least two items so queue.Len() > 1 on first sync.
-	const configRelevant = 999
-	lbc.syncQueue.queue.Add(task{Kind: configRelevant, Key: "default/user-ingress"})
-	for i := 0; i < 5; i++ {
-		lbc.syncQueue.queue.Add(task{Kind: endpointslice, Key: fmt.Sprintf("default/es-init-%d", i)})
-	}
-
-	const maxProcessed = 200
-	processed := 0
-	for lbc.syncQueue.queue.Len() > 0 && processed < maxProcessed {
-		obj, quit := lbc.syncQueue.queue.Get()
-		if quit {
-			t.Fatal("queue shut down mid-test")
-		}
-		lbc.sync(obj.(task))
-		lbc.syncQueue.queue.Done(obj)
-
-		// New endpointslice event arrives — models arrivals outpacing drain.
-		lbc.syncQueue.queue.Add(task{Kind: endpointslice, Key: fmt.Sprintf("default/es-churn-%d", processed)})
-		processed++
-
-		if mgr.reloads.Load() > 0 {
-			break
-		}
-	}
-
-	if l
```

**File**: `internal/k8s/controller.go` (modified, +6/-39)
```diff
@@ -254,8 +254,6 @@ type LoadBalancerController struct {
 	batchSyncEnabled              bool
 	updateAllConfigsOnBatch       bool
 	enableBatchReload             bool
-	batchStart                    time.Time
-	batchReloadWindow             time.Duration
 	isIPV6Disabled                bool
 	namespaceWatcherController    cache.Controller
 	telemetryCollector            *telemetry.Collector
@@ -401,7 +399,6 @@ func NewLoadBalancerController(input NewLoadBalancerControllerInput) *LoadBalanc
 		wafBundlePath:                input.WAFBundlePath,
 		plmEnabled:                   input.PLMStorageSpec.Endpoint != "",
 		plmStorageSecrets:            plmStorageSecretKeys(input.PLMStorageSpec),
-		batchReloadWindow:            batchReloadWindowDefault,
 	}
 
 	if input.AppProtectEnabled && input.WAFBundlePath != "" {
@@ -1286,22 +1283,10 @@ func (lbc *LoadBalancerController) preSyncSecrets() {
 		len(objects))
 }
 
-// batchReloadWindowDefault bounds how long batch mode can defer a pending
-// reload. Without a bound, sustained EndpointSlice churn (e.g. a rolling
-// deployment) keeps syncQueue.Len() > 0 indefinitely, so a real config
-// change queued during the batch never gets its reload — the running NGINX
-// config can show already-terminated pod IPs for as long as the churn lasts
-// (see https://github.com/nginx/kubernetes-ingress/issues/10397). Once the
-// window elapses the batch ends and reloads like normal, then a new batch
-// starts on the next sync if the queue is still non-empty — capping both
-// the staleness window and the reload rate at one per window.
-const batchReloadWindowDefault = 2 * time.Second
-
 func (lbc *LoadBalancerController) sync(task task) {
 	if lbc.isNginxReady && lbc.syncQueue.Len() > 1 && !lbc.batchSyncEnabled {
 		lbc.configurator.DisableReloads()
 		lbc.batchSyncEnabled = true
-		lbc.batchStart = time.Now()
 
 		nl.Debugf(lbc.Logger, "Batch processing %v items", lbc.syncQueue.Len())
 	}
@@ -1321,21 +1306,11 @@ func (lbc *LoadBalancerController) sync(task task) {
 		}
 		lbc.syncConfigMap(task)
 	case endpointslice:
-		// Batch-end reload is no longer forced here for endpointslice tasks.
-		// On NGINX Plus, UpdateEndpoints*/updatePlusEndpoints* apply the
-		// change via the Plus API during the batch (see
-		// Configurator.isPlusAPIEnabled) and only fall back to Reload() on
-		// API failure. On OSS, those same functions always call Reload().
-		// Either way, Configurator marks the batch dirty itself whenever that
-		// matters: Reload() sets reloadDeferred when it no-ops, and the
-		// UpdateEndpoints* functions also call it directly if they abort
-		// after an earlier resource in the same call already wrote its
-		// config (see Configurator.deferReload). ReloadForBatchUpdates
-		// honors reloadDeferred at batch end — so this path no longer needs
-		// to infer "was a reload needed" from the task Kind or from
-		// syncEndpointSlices's return value. See
-		// https://github.com/nginx/kubernetes-ingress/issues/7778.
-		lbc.syncEndpointSlices(task)
+		resourcesFound := lbc.syncEndpointSlices(task)
+		if lbc.batchSyncEnabled && resourcesFound {
+			nl.Debugf(lbc.Logger, "Endpointslice %v is referenced - enabling batch reload", task.Key)
+			lbc.enableBatchReload = true
+		}
 	case secret:
 		lbc.syncSecret(task)
 	case service:
@@ -1463,15 +1438,7 @@ func (lbc *LoadBalancerController) sync(task task) {
 		lbc.refreshStaleVSRReferences()
 	}
 
-	// The batch also ends once batchReloadWindow has elapsed since it started,
-	// even if the queue hasn't drained. Without this, sustained EndpointSlice
-	// churn (e.g. a rolling deployment) can keep syncQueue.Len() > 0
-	// indefinitely, deferring a real config change's reload for as long as
-	// the churn lasts (https://github.com/nginx/kubernetes-ingress/issues/10397).
-	// A zero batchReloadWindow disables the bound (used by tests that assert
-	// the pre-existing drain-to-zero behavior).
-	batchWindowElapsed := lbc.batchReloadWindow > 0 && time.Since(lbc.batchStart) >= lbc.batchReloadWindow
-	if lbc.batchSyncEnabled && (lbc.syncQueue.Len() == 0 || batchWindowElapsed) {
+	if lbc.batchSyncEnabled && lbc.syncQueue.Len() == 0 {
 		lbc.batchSyncEnabled = false
 		lbc.configurator.EnableReloads()
 		if lbc.updateAllConfigsOnBatch {
```

---

### Incident Patch 4: `d640d478` (2026-10-01)
**Commit Message**: fix(batch-reload): stop dropping Plus endpoint updates and bound batch staleness

Two related bugs in the sync() batch-reload path:

1. #7778 / #7779 regression risk: Configurator.isReloadsEnabled gated both
   Reload() and the NGINX Plus API upstream writes (updateServersInPlus /
   updateStreamServersInPlus). DisableReloads(), called when sync() enters
   batch mode, suppressed both — so the only thing that ever applied
   endpoint changes to a running NGINX Plus during a batch was the
   batch-end reload. That reload firing on every endpointslice-only batch
   is the reload storm reported in #7778. Removing that reload (as PR
   #7779 proposes) without separating the two gates would have left Plus
   with neither the API write nor the reload during a batch - endpoints go
   stale until an unrelated event kicks the queue.

   Fix: split the single flag into isReloadsEnabled (gates Reload) and
   isPlusAPIEnabled (gates the Plus API writes). EnableReloads() sets
   both; DisableReloads() only clears isReloadsEnabled, since NGINX is
   already running a valid config by the time batch mode starts. The Plus
   API can keep applying endpoint changes live during a batch.

   The batch-

**File**: `internal/configs/batch_reload_test.go` (modified, +170/-55)
```diff
@@ -26,9 +26,10 @@ var (
 )
 
 // recordingBatchManager wraps FakeManager and records calls to the reload
-// paths gated by Configurator.isReloadsEnabled — Reload and the Plus API
-// upstream writes. Referenced by the batch/reload regression tests for
-// https://github.com/nginx/kubernetes-ingress/pull/7779 and
+// path (Configurator.Reload, gated by isReloadsEnabled) and the NGINX Plus
+// API upstream writes (gated by isPlusAPIEnabled). Referenced by the
+// batch/reload regression tests for
+// https://github.com/nginx/kubernetes-ingress/issues/7778 and
 // https://github.com/nginx/kubernetes-ingress/issues/10397.
 type recordingBatchManager struct {
 	*nginx.FakeManager
@@ -56,47 +57,47 @@ func (m *recordingBatchManager) UpdateStreamServersInPlus(upstream string, serve
 	return m.FakeManager.UpdateStreamServersInPlus(upstream, servers)
 }
 
-// TestBatchModeDropsPlusEndpointUpdates highlights the regression that
-// PR #7779 (https://github.com/nginx/kubernetes-ingress/pull/7779) introduces
-// on top of the pre-existing behavior flagged in issue #7778.
+// failingPlusAPIManager wraps recordingBatchManager and makes every
+// UpdateServersInPlus call fail, simulating an NGINX Plus API error (e.g.
+// the upstream doesn't exist yet in the running config because it was
+// created earlier in the same batch). Reload calls are still counted via
+// the embedded recordingBatchManager.
+type failingPlusAPIManager struct {
+	*recordingBatchManager
+}
+
+func (m *failingPlusAPIManager) UpdateServersInPlus(upstream string, _ []string, _ nginx.ServerConfig) error {
+	m.updateServersInPlus.Add(1)
+	return fmt.Errorf("simulated Plus API failure for upstream %s", upstream)
+}
+
+// TestBatchModeDropsPlusEndpointUpdates pins the fix for issue #7778
+// (https://github.com/nginx/kubernetes-ingress/issues/7778): NGINX Plus
+// reloading on every endpoint churn event.
 //
-// During batch sync, sync() calls Configurator.DisableReloads() at batch start.
-// The same isReloadsEnabled flag also gates updateServersInPlus /
-// updateStreamServersInPlus (see Configurator.updateServersInPlus), which
-// silently return nil when reloads are disabled. Before PR #7779, the safety
-// net was ReloadForBatchUpdates(true) at queue drain: it picked up the freshly
-// rewritten config with the new endpoints. PR #7779 removes that reload for
-// endpointslice-only batches on Plus without lifting the API gate, so during
-// a batch neither path applies endpoint changes to the running NGINX Plus.
+// Originally, DisableReloads() (called by sync() at batch start) flipped a
+// single isReloadsEnabled flag that gated both Configurator.Reload and the
+// Plus API upstream writes (updateServersInPlus / updateStreamServersInPlus).
+// That forced a choice: either the Plus API write was suppressed during a
+// batch (stale endpoints until the batch-end reload, or until #7779-style
+// changes remove that reload entirely — see
+// https://github.com/nginx/kubernetes-ingress/pull/7779), or reloads were
+// re-enabled mid-batch (defeating the point of batching, #7778's reload
+// storm).
 //
-// The test asserts the *correct* behavior (the Plus API upstream write should
-// still fire during a batch). It therefore FAILS on current main and will
-// only pass once updateServersInPlus is ungated during batch, or an explicit
-// Plus API flush runs at batch end.
+// Configurator now has two independent flags: isReloadsEnabled (gates
+// Reload) and isPlusAPIEnabled (gates the Plus API writes). DisableReloads
+// only clears the former, so the Plus API upstream write continues to apply
+// endpoint changes live during a batch while reloads stay deferred — closing
+// #7778 without reintroducing the staleness #7779 would have caused.
 func TestBatchModeDropsPlusEndpointUpdates(t *testing.T) {
 	t.Parallel()
 
 	mgr := newRecordingBatchManager()
 	cnf := createTestConfiguratorWithManager(t, mgr)
 	cnf.isPlus = true
 
-	vsEx := &VirtualServerEx{
-		VirtualServer: &conf_v1.VirtualServer{
-			ObjectMeta: meta_v1.ObjectMeta{Name: "cafe", Namespace: "default"},
-			Spec: conf_v1.VirtualServerSpec{
-				Host: "cafe.example.com",
-				Upstreams: []conf_v1.Upstream{
-					{Name: "tea", Service: "tea-svc", Port: 80},
-				},
-				Routes: []conf_v1.Route{
-					{Path: "/tea", Action: &conf_v1.Action{Pass: "tea"}},
-				},
-			},
-		},
-		Endpoints: map[string][]string{
-			"default/tea-svc:80": {"10.0.0.1:80"},
-		},
-	}
+	vsEx := cafeVSExWithEndpoints("10.0.0.1:80")
 
 	if err := cnf.updatePlusEndpointsForVirtualServer(vsEx); err != nil {
 		t.Fatalf("baseline updatePlusEndpointsForVirtualServer: %v", err)
@@ -116,36 +117,35 @@ func TestBatchModeDropsPlusEndpointUpdates(t *testing.T) {
 
 	if got := mgr.updateServersInPlus.Load(); got != 2 {
 		t.Fatalf("Plus API upstream write suppressed during batch: UpdateServersInPlus calls = %d, want 2 "+
-			"(PR #7779 relies on the Plus API to propagate endpoints while it skips the reload; "+
-			"the same isReloadsE
```

**File**: `internal/configs/configurator.go` (modified, +57/-24)
```diff
@@ -130,26 +130,44 @@ type metricLabelsIndex struct {
 // This allows the Ingress Controller to incrementally build the NGINX configuration during the IC start and
 // then apply it at the end of the start.
 type Configurator struct {
-	nginxManager                 nginx.Manager
-	staticCfgParams              *StaticConfigParams
-	CfgParams                    *ConfigParams
-	MgmtCfgParams                *MGMTConfigParams
-	templateExecutor             *version1.TemplateExecutor
-	templateExecutorV2           *version2.TemplateExecutor
-	ingresses                    map[string]*IngressEx
-	minions                      map[string]map[string]bool
-	mergeableIngresses           map[string]*MergeableIngresses
-	virtualServers               map[string]*VirtualServerEx
-	transportServers             map[string]*TransportServerEx
-	tlsPassthroughPairs          map[string]tlsPassthroughPair
-	isWildcardEnabled            bool
-	isPlus                       bool
-	labelUpdater                 collector.LabelUpdater
-	metricLabelsIndex            *metricLabelsIndex
-	isPrometheusEnabled          bool
-	latencyCollector             latCollector.LatencyCollector
-	isLatencyMetricsEnabled      bool
-	isReloadsEnabled             bool
+	nginxManager            nginx.Manager
+	staticCfgParams         *StaticConfigParams
+	CfgParams               *ConfigParams
+	MgmtCfgParams           *MGMTConfigParams
+	templateExecutor        *version1.TemplateExecutor
+	templateExecutorV2      *version2.TemplateExecutor
+	ingresses               map[string]*IngressEx
+	minions                 map[string]map[string]bool
+	mergeableIngresses      map[string]*MergeableIngresses
+	virtualServers          map[string]*VirtualServerEx
+	transportServers        map[string]*TransportServerEx
+	tlsPassthroughPairs     map[string]tlsPassthroughPair
+	isWildcardEnabled       bool
+	isPlus                  bool
+	labelUpdater            collector.LabelUpdater
+	metricLabelsIndex       *metricLabelsIndex
+	isPrometheusEnabled     bool
+	latencyCollector        latCollector.LatencyCollector
+	isLatencyMetricsEnabled bool
+	isReloadsEnabled        bool
+	// isPlusAPIEnabled gates NGINX Plus API upstream writes
+	// (updateServersInPlus / updateStreamServersInPlus) independently of
+	// isReloadsEnabled. Both start disabled during startup build-up (the
+	// running NGINX has no config for these upstreams yet, so an API write
+	// would fail). EnableReloads() enables both. DisableReloads() —
+	// called when the controller enters batch mode — only disables
+	// isReloadsEnabled: nginx is already running a valid config at that
+	// point, so Plus API writes may safely continue even while reloads are
+	// deferred for the rest of the batch. See
+	// https://github.com/nginx/kubernetes-ingress/issues/7778.
+	isPlusAPIEnabled bool
+	// reloadDeferred is set by Reload() whenever it no-ops because
+	// isReloadsEnabled is false, and cleared whenever a reload actually
+	// runs. ReloadForBatchUpdates consults it at batch end so a reload that
+	// was skipped mid-batch (e.g. a Plus API upstream write failed and
+	// fell back to requesting a reload) is not silently dropped just
+	// because the triggering task's Kind didn't otherwise call for one.
+	reloadDeferred               bool
 	isDynamicSSLReloadEnabled    bool
 	ingressControllerReplicas    int
 	effectiveBatchExclusionCount int
@@ -1518,11 +1536,16 @@ func (cnf *Configurator) updatePlusExternalAuthEndpoints(policies map[string]*co
 }
 
 // EnableReloads enables NGINX reloads meaning that configuration changes will be followed by a reload.
+// It also (re-)enables NGINX Plus API upstream writes; see isPlusAPIEnabled.
 func (cnf *Configurator) EnableReloads() {
 	cnf.isReloadsEnabled = true
+	cnf.isPlusAPIEnabled = true
 }
 
 // DisableReloads disables NGINX reloads meaning that configuration changes will not be followed by a reload.
+// NGINX Plus API upstream writes are intentionally left enabled: DisableReloads is called when
+// entering batch mode, at which point NGINX is already running a valid config, so applying
+// endpoint changes via the Plus API during the batch is safe. See isPlusAPIEnabled.
 func (cnf *Configurator) DisableReloads() {
 	cnf.isReloadsEnabled = false
 }
@@ -1580,25 +1603,29 @@ func (cnf *Configurator) EffectiveBatchExclusionCount() int {
 	return cnf.effectiveBatchExclusionCount
 }
 
-// Reload reloads nginx if reloads is enabled
+// Reload reloads nginx if reloads is enabled. If reloads are disabled (e.g. batch mode),
+// the reload is skipped and recorded via reloadDeferred so ReloadForBatchUpdates can
+// catch up on it at batch end instead of silently dropping it.
 func (cnf *Configurator) Reload(isEndpointsUpdate bool) error {
 	if !cnf.isReloadsEnabled {
+		cnf.reloadDeferred = true
 		return nil
 	}
 
+	cnf.reloadDeferred = false
 	return cnf.nginxManager.Reload(isEndpointsUpdate)
 }
 
 func (cnf *Configurator) updateServersInPlus(upstream string, servers []string, conf
```

**File**: `internal/k8s/batch_sync_test.go` (modified, +93/-27)
```diff
@@ -6,6 +6,7 @@ import (
 	"path/filepath"
 	"sync/atomic"
 	"testing"
+	"time"
 
 	"github.com/nginx/kubernetes-ingress/internal/configs"
 	"github.com/nginx/kubernetes-ingress/internal/configs/version1"
@@ -204,9 +205,9 @@ func TestBatchModeResetsUpdateAllConfigsFlag(t *testing.T) {
 
 // TestOSSBatchNeverDrainsUnderEndpointsliceChurn drives sync() with a real
 // syncQueue and demonstrates issue #10397
-// (https://github.com/nginx/kubernetes-ingress/issues/10397): the deferred
-// reload for a real config change is not fired while endpointslice churn
-// keeps syncQueue.Len() > 0.
+// (https://github.com/nginx/kubernetes-ingress/issues/10397): without a
+// bounded batch window, the deferred reload for a real config change is not
+// fired while endpointslice churn keeps syncQueue.Len() > 0.
 //
 // Scenario:
 //   - Batch mode is entered on the first sync (queue.Len() > 1).
@@ -216,12 +217,12 @@ func TestBatchModeResetsUpdateAllConfigsFlag(t *testing.T) {
 //     endpointSliceLister is empty — syncEndpointSlices returns false without
 //     touching config, matching "endpointslice churn for services this
 //     controller does not track".
-//   - The test asserts no reload fires while queue.Len() > 0, then confirms
-//     that ReloadForBatchUpdates(true) is called exactly once when the queue
-//     finally drains.
-//
-// Fix criterion: the batch should finalize on a bounded time / item budget
-// rather than exclusively on queue.Len() == 0.
+//   - batchReloadWindow is left at its zero value (disabled), so this test
+//     pins the pre-fix, unbounded-drain semantics: no reload fires while
+//     queue.Len() > 0, and the batch-end reload fires exactly once when the
+//     queue finally drains. All 51 syncs run synchronously in well under the
+//     production batchReloadWindowDefault, so this is unaffected by the fix
+//     in TestBatchEndsOnWindowUnderContinuousChurn below.
 func TestOSSBatchNeverDrainsUnderEndpointsliceChurn(t *testing.T) {
 	t.Parallel()
 
@@ -265,24 +266,24 @@ func TestOSSBatchNeverDrainsUnderEndpointsliceChurn(t *testing.T) {
 	}
 }
 
-// TestOSSBatchReloadStarvedByContinuousChurn is the direct counterpart to
-// TestOSSBatchNeverDrainsUnderEndpointsliceChurn: while
-// TestOSSBatchNeverDrains... proves the batch-end reload fires *once* the
-// queue drains, this test proves that reload never fires while churn keeps
-// syncQueue.Len() > 0 — matching the reporter's symptom in
-// https://github.com/nginx/kubernetes-ingress/issues/10397 of "several
-// minutes of stale IPs" during a rolling deployment.
-//
-// A single "real" config change (dummy Ingress) is enqueued alongside
-// endpointslice churn, then for each task processed a *new* endpointslice
-// task is enqueued — modeling arrivals outpacing drain. After processing
-// a large number of tasks, no reload has fired despite enableBatchReload
-// being set on the first sync.
-func TestOSSBatchReloadStarvedByContinuousChurn(t *testing.T) {
+// TestBatchEndsOnWindowUnderContinuousChurn is the fix-side counterpart to
+// TestOSSBatchNeverDrainsUnderEndpointsliceChurn: it drives the same
+// continuous-arrivals-outpacing-drain scenario from issue #10397
+// (https://github.com/nginx/kubernetes-ingress/issues/10397) — a single
+// "real" config change (dummy Ingress) enqueued alongside endpointslice
+// churn, with a *new* endpointslice task enqueued for every task processed
+// so arrivals outpace drain and syncQueue.Len() never reaches 0 — but with
+// batchReloadWindow set to a tiny positive duration (matching what
+// NewLoadBalancerController wires up in production via
+// batchReloadWindowDefault). It asserts the fix actually closes the gap:
+// the pending reload fires well before the churn itself stops, instead of
+// being deferred for the full duration of a rolling deployment.
+func TestBatchEndsOnWindowUnderContinuousChurn(t *testing.T) {
 	t.Parallel()
 
 	mgr := newRecordingBatchManager()
 	lbc := newBatchTestLBC(t, mgr)
+	lbc.batchReloadWindow = time.Microsecond
 
 	// Enter batch mode: at least two items so queue.Len() > 1 on first sync.
 	const configRelevant = 999
@@ -304,15 +305,80 @@ func TestOSSBatchReloadStarvedByContinuousChurn(t *testing.T) {
 		// New endpointslice event arrives — models arrivals outpacing drain.
 		lbc.syncQueue.queue.Add(task{Kind: endpointslice, Key: fmt.Sprintf("default/es-churn-%d", processed)})
 		processed++
+
+		if mgr.reloads.Load() > 0 {
+			break
+		}
 	}
 
 	if lbc.syncQueue.queue.Len() == 0 {
 		t.Fatal("test setup error: queue drained; churn injection failed")
 	}
-	if got := mgr.reloads.Load(); got != 0 {
-		t.Fatalf("issue #10397: after %d syncs with continuous churn, reload count = %d, want 0 "+
-			"(the reload for the ingress change should have been deferred by the batch-drain condition; "+
-			"under sustained churn this deferral is unbounded)", processed, got)
+	if got := mgr.reloads.Load(); got != 1 {
+		t.Fatalf("issue #10397 fix: after %d syncs with continuo
```

**File**: `internal/k8s/controller.go` (modified, +35/-6)
```diff
@@ -254,6 +254,8 @@ type LoadBalancerController struct {
 	batchSyncEnabled              bool
 	updateAllConfigsOnBatch       bool
 	enableBatchReload             bool
+	batchStart                    time.Time
+	batchReloadWindow             time.Duration
 	isIPV6Disabled                bool
 	namespaceWatcherController    cache.Controller
 	telemetryCollector            *telemetry.Collector
@@ -399,6 +401,7 @@ func NewLoadBalancerController(input NewLoadBalancerControllerInput) *LoadBalanc
 		wafBundlePath:                input.WAFBundlePath,
 		plmEnabled:                   input.PLMStorageSpec.Endpoint != "",
 		plmStorageSecrets:            plmStorageSecretKeys(input.PLMStorageSpec),
+		batchReloadWindow:            batchReloadWindowDefault,
 	}
 
 	if input.AppProtectEnabled && input.WAFBundlePath != "" {
@@ -1283,10 +1286,22 @@ func (lbc *LoadBalancerController) preSyncSecrets() {
 		len(objects))
 }
 
+// batchReloadWindowDefault bounds how long batch mode can defer a pending
+// reload. Without a bound, sustained EndpointSlice churn (e.g. a rolling
+// deployment) keeps syncQueue.Len() > 0 indefinitely, so a real config
+// change queued during the batch never gets its reload — the running NGINX
+// config can show already-terminated pod IPs for as long as the churn lasts
+// (see https://github.com/nginx/kubernetes-ingress/issues/10397). Once the
+// window elapses the batch ends and reloads like normal, then a new batch
+// starts on the next sync if the queue is still non-empty — capping both
+// the staleness window and the reload rate at one per window.
+const batchReloadWindowDefault = 2 * time.Second
+
 func (lbc *LoadBalancerController) sync(task task) {
 	if lbc.isNginxReady && lbc.syncQueue.Len() > 1 && !lbc.batchSyncEnabled {
 		lbc.configurator.DisableReloads()
 		lbc.batchSyncEnabled = true
+		lbc.batchStart = time.Now()
 
 		nl.Debugf(lbc.Logger, "Batch processing %v items", lbc.syncQueue.Len())
 	}
@@ -1306,11 +1321,17 @@ func (lbc *LoadBalancerController) sync(task task) {
 		}
 		lbc.syncConfigMap(task)
 	case endpointslice:
-		resourcesFound := lbc.syncEndpointSlices(task)
-		if lbc.batchSyncEnabled && resourcesFound {
-			nl.Debugf(lbc.Logger, "Endpointslice %v is referenced - enabling batch reload", task.Key)
-			lbc.enableBatchReload = true
-		}
+		// Batch-end reload is no longer forced here for endpointslice tasks.
+		// On NGINX Plus, UpdateEndpoints*/updatePlusEndpoints* apply the
+		// change via the Plus API during the batch (see
+		// Configurator.isPlusAPIEnabled) and only fall back to Reload() on
+		// API failure. On OSS, those same functions always call Reload().
+		// Either way, Configurator tracks whether a Reload() call was
+		// deferred (reloadDeferred) and ReloadForBatchUpdates honors that at
+		// batch end — so this path no longer needs to infer "was a reload
+		// needed" from the task Kind. See
+		// https://github.com/nginx/kubernetes-ingress/issues/7778.
+		lbc.syncEndpointSlices(task)
 	case secret:
 		lbc.syncSecret(task)
 	case service:
@@ -1438,7 +1459,15 @@ func (lbc *LoadBalancerController) sync(task task) {
 		lbc.refreshStaleVSRReferences()
 	}
 
-	if lbc.batchSyncEnabled && lbc.syncQueue.Len() == 0 {
+	// The batch also ends once batchReloadWindow has elapsed since it started,
+	// even if the queue hasn't drained. Without this, sustained EndpointSlice
+	// churn (e.g. a rolling deployment) can keep syncQueue.Len() > 0
+	// indefinitely, deferring a real config change's reload for as long as
+	// the churn lasts (https://github.com/nginx/kubernetes-ingress/issues/10397).
+	// A zero batchReloadWindow disables the bound (used by tests that assert
+	// the pre-existing drain-to-zero behavior).
+	batchWindowElapsed := lbc.batchReloadWindow > 0 && time.Since(lbc.batchStart) >= lbc.batchReloadWindow
+	if lbc.batchSyncEnabled && (lbc.syncQueue.Len() == 0 || batchWindowElapsed) {
 		lbc.batchSyncEnabled = false
 		lbc.configurator.EnableReloads()
 		if lbc.updateAllConfigsOnBatch {
```

---

### Incident Patch 5: `1006aa4f` (2026-10-01)
**Commit Message**: fix(external auth): carrying the response code from the /oauth2/signin subrequest breaks oauth2 flow- #10879 (#10929)

* test(external-auth): cover signin redirects

Add an ExternalAuth backend endpoint that returns a signin page and assert that unauthenticated Ingress and VirtualServer requests redirect to it.\n\nThe assertions intentionally fail before the corresponding controller fix: the current configuration returns the signin endpoint's 200 response for the protected request.

Assisted-by: OpenCode <[REDACTED_EMAIL]>

* fix(external-auth): redirect clients to signin URI

Handle ExternalAuth 401 responses through a named location that returns a client-visible redirect to authSigninURI. This prevents a signin endpoint's 200 response from becoming a successful response for the protected request while preserving redirects returned by endpoints such as /oauth2/start.\n\nRemove the v2 error-page status inheritance path and cover the rendered named handler in OSS and Plus snapshots.

Assisted-by: OpenCode <[REDACTED_EMAIL]>

* test(external-auth): accept absolute signin redirects

NGINX normalizes relative return targets into absolute Location headers by default. Assert the redirect

**File**: `internal/configs/ingress.go` (modified, +2/-0)
```diff
@@ -1001,6 +1001,7 @@ func generateIngressExternalAuthLocation(externalAuth *version2.ExternalAuth, up
 		Upstream:                 upstream,
 		DisableWAF:               true,
 		ProxyPass:                fmt.Sprintf("%s://%s%s", generateProxyPassProtocol(externalAuth.SSLEnabled), upstream.Name, externalAuth.URI.Path),
+		AuthRequestOff:           true,
 		ProxySetHeaders:          []version2.Header{{Name: "Content-Length", Value: "0"}, {Name: "X-Scheme", Value: "$scheme"}},
 		ProxyConnectTimeout:      generateTimeWithDefault(cfg.ProxyConnectTimeout, cfg.ProxyConnectTimeout),
 		ProxyReadTimeout:         generateTimeWithDefault(cfg.ProxyReadTimeout, cfg.ProxyReadTimeout),
@@ -1009,6 +1010,7 @@ func generateIngressExternalAuthLocation(externalAuth *version2.ExternalAuth, up
 		ClientMaxBodySize:        "0",
 		ProxyNextUpstream:        "error timeout",
 		ProxyNextUpstreamTimeout: generateTimeWithDefault(cfg.ProxyNextUpstreamTimeout, "0s"),
+		SkipCustomHTTPErrors:     true,
 		LocationSnippets:         splitSnippets(externalAuth.Snippets),
 		ServiceName:              svcName,
 	}
```

**File**: `internal/configs/ingress_test.go` (modified, +2/-0)
```diff
@@ -5376,6 +5376,7 @@ func TestGenerateIngressExternalAuthLocation(t *testing.T) {
 		Internal:                 true,
 		DisableWAF:               true,
 		Upstream:                 upstream,
+		AuthRequestOff:           true,
 		ProxyPass:                "http://ext_auth_default_my-auth/auth",
 		ProxySetHeaders:          []version2.Header{{Name: "Content-Length", Value: "0"}, {Name: "X-Scheme", Value: "$scheme"}},
 		ProxyConnectTimeout:      "10s",
@@ -5385,6 +5386,7 @@ func TestGenerateIngressExternalAuthLocation(t *testing.T) {
 		ClientMaxBodySize:        "0",
 		ProxyNextUpstream:        "error timeout",
 		ProxyNextUpstreamTimeout: "5s",
+		SkipCustomHTTPErrors:     true,
 		LocationSnippets:         []string{"proxy_set_header X-Custom \"value\""},
 		ServiceName:              "auth-svc",
 	}
```

**File**: `internal/configs/version1/__snapshots__/template_test.snap` (modified, +74/-4)
```diff
@@ -6350,7 +6350,8 @@ server {
         status_zone "";
         auth_request "/_external_auth/oauth2/auth";
         proxy_intercept_errors on;
-        error_page 401 = "/oauth2/start?rd=$scheme://$host$request_uri";
+        set $external_auth_signin_uri "/oauth2/start?rd=$scheme://$host$request_uri";
+        error_page 401 = @external_auth_signin;
 
         proxy_connect_timeout ;
         proxy_read_timeout ;
@@ -6367,6 +6368,10 @@ server {
         
     }
     
+    location @external_auth_signin {
+        auth_request off;
+        return 302 $external_auth_signin_uri;
+    }
 }
 
 ---
@@ -6398,6 +6403,7 @@ server {
         set $service "";
         status_zone "";
         auth_request "/_external_auth/oauth2/auth";
+        error_page 401 = @external_auth_unauthorized;
 
         proxy_connect_timeout ;
         proxy_read_timeout ;
@@ -6414,6 +6420,10 @@ server {
         
     }
     
+    location @external_auth_unauthorized {
+        auth_request off;
+        return 401;
+    }
 }
 
 ---
@@ -6441,7 +6451,8 @@ server {
     
     auth_request "/_external_auth/oauth2/auth";
     proxy_intercept_errors on;
-    error_page 401 = "/oauth2/start?rd=$scheme://$host$request_uri";
+    set $external_auth_signin_uri "/oauth2/start?rd=$scheme://$host$request_uri";
+    error_page 401 = @external_auth_signin;
 
     
     location "/tea" {
@@ -6463,6 +6474,10 @@ server {
         
     }
     
+    location @external_auth_signin {
+        auth_request off;
+        return 302 $external_auth_signin_uri;
+    }
 }
 
 ---
@@ -6489,7 +6504,8 @@ server {
         set $service "";
         auth_request "/_external_auth/oauth2/auth";
         proxy_intercept_errors on;
-        error_page 401 = "/oauth2/start?rd=$scheme://$host$request_uri";
+        set $external_auth_signin_uri "/oauth2/start?rd=$scheme://$host$request_uri";
+        error_page 401 = @external_auth_signin;
         proxy_connect_timeout ;
         proxy_read_timeout ;
         proxy_send_timeout ;
@@ -6505,6 +6521,55 @@ server {
         
     }
     
+    location @external_auth_signin {
+        auth_request off;
+        return 302 $external_auth_signin_uri;
+    }
+}
+
+---
+
+[TestExecuteTemplate_ForIngressWithExternalAuthSigninURL/nginx/location/no-signin - 1]
+# configuration for default/cafe-ingress
+upstream test {
+    zone test 256k;
+    server 127.0.0.1:8181 max_fails=0 fail_timeout=1s max_conns=0;
+}
+
+
+
+server {
+
+    server_tokens off;
+
+    server_name cafe.example.com;
+    set $resource_type "ingress";
+    set $resource_name "cafe-ingress";
+    set $resource_namespace "default";
+    set $service "-";
+    location "/tea" {
+        set $service "";
+        auth_request "/_external_auth/oauth2/auth";
+        error_page 401 = @external_auth_unauthorized;
+        proxy_connect_timeout ;
+        proxy_read_timeout ;
+        proxy_send_timeout ;
+        client_max_body_size ;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Host $host;
+        proxy_set_header X-Forwarded-Port $server_port;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_buffering off;
+        proxy_pass http://test;
+        
+    }
+    
+    location @external_auth_unauthorized {
+        auth_request off;
+        return 401;
+    }
 }
 
 ---
@@ -6529,7 +6594,8 @@ server {
     set $service "-";
     auth_request "/_external_auth/oauth2/auth";
     proxy_intercept_errors on;
-    error_page 401 = "/oauth2/start?rd=$scheme://$host$request_uri";
+    set $external_auth_signin_uri "/oauth2/start?rd=$scheme://$host$request_uri";
+    error_page 401 = @external_auth_signin;
     location "/tea" {
         set $service "";
         proxy_connect_timeout ;
@@ -6547,6 +6613,10 @@ server {
         
     }
     
+    location @external_auth_signin {
+        auth_request off;
+        return 302 $external_auth_signin_uri;
+    }
 }
 
 ---
```

**File**: `internal/configs/version1/nginx-plus.ingress.tmpl` (modified, +18/-4)
```diff
@@ -310,8 +310,8 @@ server {
 	auth_request {{ printf "%q" $server.ExternalAuth.URI.InternalPath }};
 	{{- if $server.ExternalAuth.SigninURL }}
 	proxy_intercept_errors on;
-	{{- /* `=` returns the signin URI status code (e.g. 302) instead of forwarding the original 401 to the client. */}}
-	error_page 401 = {{ printf "%q" $server.ExternalAuth.SigninURL }};
+	set $external_auth_signin_uri {{ printf "%q" $server.ExternalAuth.SigninURL }};
+	error_page 401 = @external_auth_signin;
 	{{- end }}
 	{{- end }}
 
@@ -449,8 +449,10 @@ server {
 		auth_request {{ printf "%q" $location.ExternalAuth.URI.InternalPath }};
 		{{- if $location.ExternalAuth.SigninURL }}
 		proxy_intercept_errors on;
-		{{- /* `=` returns the signin URI status code (e.g. 302) instead of forwarding the original 401 to the client. */}}
-		error_page 401 = {{ printf "%q" $location.ExternalAuth.SigninURL }};
+		set $external_auth_signin_uri {{ printf "%q" $location.ExternalAuth.SigninURL }};
+		error_page 401 = @external_auth_signin;
+		{{- else}}
+		error_page 401 = @external_auth_unauthorized;
 		{{- end }}
 		{{- end }}
 
@@ -699,6 +701,18 @@ server {
 		{{end}}
 	}
 	{{end -}}
+	{{- if hasExternalAuthSignin $server}}
+	location @external_auth_signin {
+		auth_request off;
+		return 302 $external_auth_signin_uri;
+	}
+	{{- end}}
+	{{- if hasExternalAuthNoSignin $server}}
+	location @external_auth_unauthorized {
+		auth_request off;
+		return 401;
+	}
+	{{- end}}
 	{{- if $server.CustomHTTPErrorBackend}}
 	location @custom_default_backend {
 		internal;
```

**File**: `internal/configs/version1/nginx.ingress.tmpl` (modified, +18/-4)
```diff
@@ -192,8 +192,8 @@ server {
 	auth_request {{ printf "%q" $server.ExternalAuth.URI.InternalPath }};
 	{{- if $server.ExternalAuth.SigninURL }}
 	proxy_intercept_errors on;
-	{{- /* `=` returns the signin URI status code (e.g. 302) instead of forwarding the original 401 to the client. */}}
-	error_page 401 = {{ printf "%q" $server.ExternalAuth.SigninURL }};
+	set $external_auth_signin_uri {{ printf "%q" $server.ExternalAuth.SigninURL }};
+	error_page 401 = @external_auth_signin;
 	{{- end }}
 	{{- end }}
 
@@ -255,8 +255,10 @@ server {
 		auth_request {{ printf "%q" $location.ExternalAuth.URI.InternalPath }};
 		{{- if $location.ExternalAuth.SigninURL }}
 		proxy_intercept_errors on;
-		{{- /* `=` returns the signin URI status code (e.g. 302) instead of forwarding the original 401 to the client. */}}
-		error_page 401 = {{ printf "%q" $location.ExternalAuth.SigninURL }};
+		set $external_auth_signin_uri {{ printf "%q" $location.ExternalAuth.SigninURL }};
+		error_page 401 = @external_auth_signin;
+		{{- else}}
+		error_page 401 = @external_auth_unauthorized;
 		{{- end }}
 		{{- end }}
 
@@ -467,6 +469,18 @@ server {
 		{{end}}
 	}
 	{{end -}}
+	{{- if hasExternalAuthSignin $server}}
+	location @external_auth_signin {
+		auth_request off;
+		return 302 $external_auth_signin_uri;
+	}
+	{{- end}}
+	{{- if hasExternalAuthNoSignin $server}}
+	location @external_auth_unauthorized {
+		auth_request off;
+		return 401;
+	}
+	{{- end}}
 	{{- if $server.CustomHTTPErrorBackend}}
 	location @custom_default_backend {
 		internal;
```

**File**: `internal/configs/version1/template_helper.go` (modified, +39/-14)
```diff
@@ -162,19 +162,44 @@ func extractOriginalPath(processedPath string) string {
 	return processedPath
 }
 
+// hasExternalAuthSignin reports whether the server needs the shared signin redirect location.
+func hasExternalAuthSignin(s Server) bool {
+	if s.ExternalAuth != nil && s.ExternalAuth.SigninURL != "" {
+		return true
+	}
+	for _, location := range s.Locations {
+		if location.ExternalAuth != nil && location.ExternalAuth.SigninURL != "" {
+			return true
+		}
+	}
+	return false
+}
+
+// hasExternalAuthNoSignin reports whether a location needs an explicit 401 handler.
+func hasExternalAuthNoSignin(s Server) bool {
+	for _, location := range s.Locations {
+		if location.ExternalAuth != nil && location.ExternalAuth.SigninURL == "" {
+			return true
+		}
+	}
+	return false
+}
+
 var helperFunctions = template.FuncMap{
-	"split":              split,
-	"trim":               trim,
-	"contains":           strings.Contains,
-	"hasPrefix":          strings.HasPrefix,
-	"hasSuffix":          strings.HasSuffix,
-	"toLower":            strings.ToLower,
-	"toUpper":            strings.ToUpper,
-	"replaceAll":         strings.ReplaceAll,
-	"makeLocationPath":   makeLocationPath,
-	"makeRewritePattern": makeRewritePattern,
-	"makeSecretPath":     commonhelpers.MakeSecretPath,
-	"makeOnOffFromBool":  commonhelpers.MakeOnOffFromBool,
-	"boolToPointerBool":  commonhelpers.BoolToPointerBool,
-	"makeResolver":       makeResolver,
+	"split":                   split,
+	"trim":                    trim,
+	"contains":                strings.Contains,
+	"hasPrefix":               strings.HasPrefix,
+	"hasSuffix":               strings.HasSuffix,
+	"toLower":                 strings.ToLower,
+	"toUpper":                 strings.ToUpper,
+	"replaceAll":              strings.ReplaceAll,
+	"makeLocationPath":        makeLocationPath,
+	"makeRewritePattern":      makeRewritePattern,
+	"makeSecretPath":          commonhelpers.MakeSecretPath,
+	"makeOnOffFromBool":       commonhelpers.MakeOnOffFromBool,
+	"boolToPointerBool":       commonhelpers.BoolToPointerBool,
+	"makeResolver":            makeResolver,
+	"hasExternalAuthSignin":   hasExternalAuthSignin,
+	"hasExternalAuthNoSignin": hasExternalAuthNoSignin,
 }
```

**File**: `internal/configs/version1/template_test.go` (modified, +33/-13)
```diff
@@ -8221,30 +8221,44 @@ func TestExecuteTemplate_ForIngressWithExternalAuthSigninURL(t *testing.T) {
 	t.Parallel()
 
 	const signinURL = "/oauth2/start?rd=$scheme://$host$request_uri"
-	want := fmt.Sprintf(`error_page 401 = "%s";`, signinURL)
+	wants := []string{
+		fmt.Sprintf(`set $external_auth_signin_uri "%s";`, signinURL),
+		`error_page 401 = @external_auth_signin;`,
+		`location @external_auth_signin {`,
+		`return 302 $external_auth_signin_uri;`,
+	}
 
 	cases := []struct {
-		name    string
-		scope   string
-		signin  string
-		wantHit bool
-		newTmpl func(*testing.T) *template.Template
+		name             string
+		scope            string
+		signin           string
+		wantHit          bool
+		wantUnauthorized bool
+		newTmpl          func(*testing.T) *template.Template
 	}{
 		{name: "nginx/server", scope: "server", signin: signinURL, wantHit: true, newTmpl: newNGINXIngressTmpl},
 		{name: "nginx/location", scope: "location", signin: signinURL, wantHit: true, newTmpl: newNGINXIngressTmpl},
 		{name: "nginx-plus/server", scope: "server", signin: signinURL, wantHit: true, newTmpl: newNGINXPlusIngressTmpl},
 		{name: "nginx-plus/location", scope: "location", signin: signinURL, wantHit: true, newTmpl: newNGINXPlusIngressTmpl},
 		// Guards that ExternalAuth without SigninURL still emits `auth_request` but no `error_page 401`.
 		{name: "nginx/server/no-signin", scope: "server", signin: "", wantHit: false, newTmpl: newNGINXIngressTmpl},
-		{name: "nginx-plus/location/no-signin", scope: "location", signin: "", wantHit: false, newTmpl: newNGINXPlusIngressTmpl},
+		{name: "nginx/location/no-signin", scope: "location", signin: "", wantHit: false, wantUnauthorized: true, newTmpl: newNGINXIngressTmpl},
+		{name: "nginx-plus/location/no-signin", scope: "location", signin: "", wantHit: false, wantUnauthorized: true, newTmpl: newNGINXPlusIngressTmpl},
 	}
 
 	for _, tc := range cases {
 		t.Run(tc.name, func(t *testing.T) {
 			t.Parallel()
 			tmpl := tc.newTmpl(t)
 			buf := &bytes.Buffer{}
-			if err := tmpl.Execute(buf, newIngressConfigWithExternalAuth(tc.scope, tc.signin)); err != nil {
+			cfg := newIngressConfigWithExternalAuth(tc.scope, tc.signin)
+			if got := hasExternalAuthSignin(cfg.Servers[0]); got != tc.wantHit {
+				t.Errorf("hasExternalAuthSignin() = %v, want %v", got, tc.wantHit)
+			}
+			if got := hasExternalAuthNoSignin(cfg.Servers[0]); got != tc.wantUnauthorized {
+				t.Errorf("hasExternalAuthNoSignin() = %v, want %v", got, tc.wantUnauthorized)
+			}
+			if err := tmpl.Execute(buf, cfg); err != nil {
 				t.Fatal(err)
 			}
 			got := buf.String()
@@ -8253,12 +8267,18 @@ func TestExecuteTemplate_ForIngressWithExternalAuthSigninURL(t *testing.T) {
 				t.Errorf("want auth_request directive in rendered config\n---\n%s", got)
 			}
 
-			hasErrorPage := strings.Contains(got, want)
+			hasSigninRedirect := true
+			for _, want := range wants {
+				hasSigninRedirect = hasSigninRedirect && strings.Contains(got, want)
+			}
 			switch {
-			case tc.wantHit && !hasErrorPage:
-				t.Errorf("want %q in rendered config\n---\n%s", want, got)
-			case !tc.wantHit && strings.Contains(got, "error_page 401"):
-				t.Errorf("did not want error_page 401 when SigninURL is empty\n---\n%s", got)
+			case tc.wantHit && !hasSigninRedirect:
+				t.Errorf("want ExternalAuth signin redirect in rendered config\n---\n%s", got)
+			case !tc.wantHit && strings.Contains(got, "@external_auth_signin"):
+				t.Errorf("did not want ExternalAuth signin redirect when SigninURL is empty\n---\n%s", got)
+			}
+			if gotUnauthorized := strings.Contains(got, "error_page 401 = @external_auth_unauthorized;"); gotUnauthorized != tc.wantUnauthorized {
+				t.Errorf("external auth unauthorized handler present = %v, want %v\n---\n%s", gotUnauthorized, tc.wantUnauthorized, got)
 			}
 
 			snaps.MatchSnapshot(t, got)
```

**File**: `internal/configs/version2/__snapshots__/templates_test.snap` (modified, +102/-4)
```diff
@@ -5209,7 +5209,8 @@ server {
 
     server_tokens "";
     auth_request "/_external_auth/oauth2/auth";
-    error_page 401 = "/oauth2/start?rd=$scheme://$host$request_uri";
+    set $external_auth_signin_uri "/oauth2/start?rd=$scheme://$host$request_uri";
+    error_page 401 = @external_auth_signin;
 
     
 
@@ -5218,9 +5219,10 @@ server {
         set $service "tea-svc";
         status_zone "tea-svc";
         auth_request "/_external_auth/oauth2/auth";
+        set $external_auth_signin_uri "/oauth2/start?rd=$scheme://$host$request_uri";
+        error_page 401 = @external_auth_signin;
 
         
-        error_page 401 = "/oauth2/start?rd=$scheme://$host$request_uri";
         proxy_intercept_errors on;
         set $default_connection_header close;
         proxy_connect_timeout ;
@@ -5242,6 +5244,10 @@ server {
         proxy_next_upstream_timeout ;
         proxy_next_upstream_tries 0;
     }
+    location @external_auth_signin {
+        auth_request off;
+        return 302 $external_auth_signin_uri;
+    }
 }
 
 ---
@@ -5893,17 +5899,19 @@ server {
 
     server_tokens "";
     auth_request "/_external_auth/oauth2/auth";
-    error_page 401 = "/oauth2/start?rd=$scheme://$host$request_uri";
+    set $external_auth_signin_uri "/oauth2/start?rd=$scheme://$host$request_uri";
+    error_page 401 = @external_auth_signin;
 
     
 
     
     location "/tea" {
         set $service "tea-svc";
         auth_request "/_external_auth/oauth2/auth";
+        set $external_auth_signin_uri "/oauth2/start?rd=$scheme://$host$request_uri";
+        error_page 401 = @external_auth_signin;
 
         
-        error_page 401 = "/oauth2/start?rd=$scheme://$host$request_uri";
         proxy_intercept_errors on;
         set $default_connection_header close;
         proxy_connect_timeout ;
@@ -5925,6 +5933,10 @@ server {
         proxy_next_upstream_timeout ;
         proxy_next_upstream_tries 0;
     }
+    location @external_auth_signin {
+        auth_request off;
+        return 302 $external_auth_signin_uri;
+    }
 }
 
 ---
@@ -6298,3 +6310,89 @@ server {
 }
 
 ---
+
+[TestVirtualServerLocationExternalAuthWithoutSigninURL/nginx - 1]
+
+server {
+    listen 80;
+    listen [::]:80;
+
+
+    server_name cafe.example.com;
+
+    set $resource_type "virtualserver";
+    set $resource_name "";
+    set $resource_namespace "";
+    set $service "-";
+
+    server_tokens "";
+    auth_request "/_external_auth/server";
+    set $external_auth_signin_uri "/oauth2/start";
+    error_page 401 = @external_auth_signin;
+
+    
+
+    
+    location "/tea" {
+        set $service "";
+        auth_request "/_external_auth/location";
+        error_page 401 = @external_auth_unauthorized;
+
+        
+        set $default_connection_header close;
+    }
+    location @external_auth_signin {
+        auth_request off;
+        return 302 $external_auth_signin_uri;
+    }
+    location @external_auth_unauthorized {
+        auth_request off;
+        return 401;
+    }
+}
+
+---
+
+[TestVirtualServerLocationExternalAuthWithoutSigninURL/nginx-plus - 1]
+
+
+server {
+    listen 80;
+    listen [::]:80;
+
+
+    server_name cafe.example.com;
+    status_zone "";
+    set $resource_type "virtualserver";
+    set $resource_name "";
+    set $resource_namespace "";
+    set $service "-";
+
+    server_tokens "";
+    auth_request "/_external_auth/server";
+    set $external_auth_signin_uri "/oauth2/start";
+    error_page 401 = @external_auth_signin;
+
+    
+
+    
+    location "/tea" {
+        set $service "";
+        status_zone "";
+        auth_request "/_external_auth/location";
+        error_page 401 = @external_auth_unauthorized;
+
+        
+        set $default_connection_header close;
+    }
+    location @external_auth_signin {
+        auth_request off;
+        return 302 $external_auth_signin_uri;
+    }
+    location @external_auth_unauthorized {
+        auth_request off;
+        return 401;
+    }
+}
+
+---
```

---

### Incident Patch 6: `9af21054` (2026-09-30)
**Commit Message**: fix(api): make JWT/OIDC trustedCertSecret omit-empty so zero value is dropped (#9751)

JWTAuth.TrustedCertSecret and OIDC.TrustedCertSecret were declared as

    TrustedCertSecret string `json:"trustedCertSecret"`

with a kubebuilder pattern of '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'.

When a Go consumer (e.g. an operator using this module) builds a
Policy without setting the field, encoding/json marshals the zero
value as 'trustedCertSecret: ""'. The Kubernetes API server then
rejects the resource with:

    spec.oidc.trustedCertSecret: Invalid value: "":
      spec.oidc.trustedCertSecret in body should match
      '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'

even though the field is genuinely optional and is not listed in the
schema's required array.

Match the convention already used by ExternalAuth.TrustedCertSecret in
the same file (L1311–L1314): annotate the two affected fields with
'+kubebuilder:validation:Optional' and add ',omitempty' to the JSON
tag. With omitempty, the empty string is no longer serialized at all,
so the API server never validates the absent field against the
pattern.

Closes #9690.

Signed-off-by: SAY-5 <[REDACTED_EMAIL]>
Co-authored-by: Ciara Stacke <[REDACTED_EMAIL]>

**File**: `pkg/apis/configuration/v1/types.go` (modified, +4/-2)
```diff
@@ -928,8 +928,9 @@ type JWTAuth struct {
 	// +kubebuilder:default:=false
 	SSLVerify bool `json:"sslVerify"`
 	// The name of the Kubernetes secret that stores the CA certificate for JWKS server verification. It must be in the same namespace as the Policy resource. A secret of the type Opaque is recommended. The secret is resolved with the CA role and must store the certificate under the ca.crt key.
+	// +kubebuilder:validation:Optional
 	// +kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
-	TrustedCertSecret string `json:"trustedCertSecret"`
+	TrustedCertSecret string `json:"trustedCertSecret,omitempty"`
 	// Sets the verification depth in the JWKS server certificates chain. The default is 1.
 	// +kubebuilder:validation:Minimum=0
 	// +kubebuilder:default:=1
@@ -1010,8 +1011,9 @@ type OIDC struct {
 	// +kubebuilder:default:=false
 	SSLVerify bool `json:"sslVerify"`
 	// The name of the Kubernetes secret that stores the CA certificate for IDP server verification. It must be in the same namespace as the Policy resource. A secret of the type Opaque is recommended. The secret is resolved with the CA role and must store the certificate under the ca.crt key.
+	// +kubebuilder:validation:Optional
 	// +kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
-	TrustedCertSecret string `json:"trustedCertSecret"`
+	TrustedCertSecret string `json:"trustedCertSecret,omitempty"`
 	// Sets the verification depth in the IDP server certificates chain. The default is 1.
 	// +kubebuilder:validation:Minimum=0
 	// +kubebuilder:default:=1
```

---

### Incident Patch 7: `9f28d22e` (2026-09-30)
**Commit Message**: fix(helm): emit allow-empty-ingress-host when custom resources are disabled (#10832)

* Emit -allow-empty-ingress-host when CRs are disabled

Helm previously nested -allow-empty-ingress-host and the default
listener-port flags behind enableCustomResources. Those CLI flags
apply to Ingress and the default_server, not VirtualServer CRDs, so
allowEmptyIngressHost: true was silently ignored when CRs were off.

Move the three flags out of the CR block and add a helm unit
regression with enableCustomResources: false.

Fixes nginx/kubernetes-ingress#10831

* Update helm snapshots for empty-host flags without CRs

Record the new allowEmptyIngressHostWithoutCRs fixture and the
existing custom-resources / globalConfiguration renders after moving
-allow-empty-ingress-host and the default listener-port flags out of
the enableCustomResources block.

* fix(helm): keep listener ports gated on custom resources

Split follow-up: leave default HTTP/HTTPS listener-port flags inside the
enableCustomResources block so this PR only emits allow-empty-ingress-host
when CRs are disabled. Refresh the no-crs helm snapshot accordingly.

---------

Co-authored-by: Haywood Shannon <[REDACTED_EMAIL]>
Co-authored

**File**: `charts/nginx-ingress/templates/_helpers.tpl` (modified, +1/-1)
```diff
@@ -385,13 +385,13 @@ Build the args for the service binary.
 - -enable-external-dns={{ .Values.controller.enableExternalDNS }}
 - -default-http-listener-port={{ .Values.controller.defaultHTTPListenerPort}}
 - -default-https-listener-port={{ .Values.controller.defaultHTTPSListenerPort}}
-- -allow-empty-ingress-host={{ .Values.controller.allowEmptyIngressHost }}
 {{- if and .Values.controller.globalConfiguration.create (not .Values.controller.globalConfiguration.customName) }}
 - -global-configuration=$(POD_NAMESPACE)/{{ include "nginx-ingress.controller.fullname" . }}
 {{- else if .Values.controller.globalConfiguration.customName }}
 - -global-configuration={{ .Values.controller.globalConfiguration.customName }}
 {{- end }}
 {{- end }}
+- -allow-empty-ingress-host={{ .Values.controller.allowEmptyIngressHost }}
 - -ready-status={{ .Values.controller.readyStatus.enable }}
 - -ready-status-port={{ .Values.controller.readyStatus.port }}
 - -enable-latency-metrics={{ .Values.controller.enableLatencyMetrics }}
```

**File**: `charts/tests/__snapshots__/helmunit_test.snap` (modified, +423/-2)
```diff
@@ -448,6 +448,426 @@ metadata:
     app.kubernetes.io/managed-by: Helm
 ---
 
+[TestHelmNICTemplate/allowEmptyIngressHostWithoutCRs - 1]
+/-/-/-/
+# Source: nginx-ingress/templates/controller-serviceaccount.yaml
+apiVersion: v1
+kind: ServiceAccount
+metadata:
+  name: allow-empty-ingress-host-no-crs-nginx-ingress
+  namespace: default
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: allow-empty-ingress-host-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+/-/-/-/
+# Source: nginx-ingress/templates/controller-configmap.yaml
+apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: allow-empty-ingress-host-no-crs-nginx-ingress
+  namespace: default
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: allow-empty-ingress-host-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+data:
+  {}
+/-/-/-/
+# Source: nginx-ingress/templates/controller-leader-election-configmap.yaml
+apiVersion: v1
+kind: ConfigMap
+metadata:
+  name: allow-empty-ingress-host-no-crs-nginx-ingress-leader-election
+  namespace: default
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: allow-empty-ingress-host-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+/-/-/-/
+# Source: nginx-ingress/templates/clusterrole.yaml
+kind: ClusterRole
+apiVersion: rbac.authorization.k8s.io/v1
+metadata:
+  name: allow-empty-ingress-host-no-crs-nginx-ingress
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: allow-empty-ingress-host-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+rules:
+- apiGroups:
+  - ""
+  resources:
+  - configmaps
+  - namespaces
+  - pods
+  - secrets
+  verbs:
+  - get
+  - list
+  - watch
+- apiGroups:
+  - ""
+  resources:
+  - events
+  verbs:
+  - create
+  - patch
+  - list
+- apiGroups:
+  - ""
+  resources:
+  - services
+  verbs:
+  - get
+  - list
+  - watch
+  - create
+  - update
+  - patch
+  - delete
+- apiGroups:
+  - coordination.k8s.io
+  resources:
+  - leases
+  verbs:
+  - list
+  - watch
+- apiGroups:
+  - discovery.k8s.io
+  resources:
+  - endpointslices
+  verbs:
+  - get
+  - list
+  - watch
+- apiGroups:
+  - networking.k8s.io
+  resources:
+  - ingresses
+  verbs:
+  - get
+  - list
+  - watch
+- apiGroups:
+  - ""
+  resources:
+  - nodes
+  verbs:
+  - list
+- apiGroups:
+  - "apps"
+  resources:
+  - replicasets
+  - daemonsets
+  - statefulsets
+  verbs:
+  - get
+- apiGroups:
+  - networking.k8s.io
+  resources:
+  - ingressclasses
+  verbs:
+  - get
+  - list
+- apiGroups:
+  - networking.k8s.io
+  resources:
+  - ingresses/status
+  verbs:
+  - update
+/-/-/-/
+# Source: nginx-ingress/templates/clusterrolebinding.yaml
+kind: ClusterRoleBinding
+apiVersion: rbac.authorization.k8s.io/v1
+metadata:
+  name: allow-empty-ingress-host-no-crs-nginx-ingress
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: allow-empty-ingress-host-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+subjects:
+- kind: ServiceAccount
+  name: allow-empty-ingress-host-no-crs-nginx-ingress
+  namespace: default
+roleRef:
+  kind: ClusterRole
+  name: allow-empty-ingress-host-no-crs-nginx-ingress
+  apiGroup: rbac.authorization.k8s.io
+/-/-/-/
+# Source: nginx-ingress/templates/controller-role.yaml
+kind: Role
+apiVersion: rbac.authorization.k8s.io/v1
+metadata:
+  name: allow-empty-ingress-host-no-crs-nginx-ingress
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/name: nginx-ingress
+    app.kubernetes.io/instance: allow-empty-ingress-host-no-crs
+    app.kubernetes.io/version: "5.7.0"
+    app.kubernetes.io/managed-by: Helm
+  namespace: default
+rules:
+- apiGroups:
+  - ""
+  resources:
+  - configmaps
+  - pods
+  - secrets
+  - services
+  verbs:
+  - get
+  - list
+  - watch
+- apiGroups:
+    - ""
+  resources:
+    - namespaces
+  verbs:
+    - get
+- apiGroups:
+  - ""
+  resources:
+  - pods
+  verbs:
+  - update
+- apiGroups:
+  - ""
+  resources:
+  - events
+  verbs:
+  - create
+  - patch
+  - list
+- apiGroups:
+  - coordination.k8s.io
+  resources:
+  - leases
+  resourceNames:
+  - allow-empty-ingress-host-no-crs-nginx-ingress-leader-election
+  verbs:
+  - get
+  - update
+- apiGroups:
+  - coordination.k8s.io
+  resources:
+  - leases
+  verbs:
+  - create
+/-/-/-/
+# Source: nginx-ingress/templates/controller-rolebinding.yaml
+kind: RoleBinding
+apiVersion: rbac.authorization.k8s.io/v1
+metadata:
+  name: allow-empty-ingress-host-no-crs-nginx-ingress
+  labels:
+    helm.sh/chart: nginx-ingress-2.8.0
+    app.kubernetes.io/n
```

**File**: `charts/tests/helmunit_test.go` (modified, +5/-0)
```diff
@@ -224,6 +224,11 @@ func TestHelmNICTemplate(t *testing.T) {
 			releaseName: "allow-empty-ingress-host",
 			namespace:   "default",
 		},
+		"allowEmptyIngressHostWithoutCRs": {
+			valuesFile:  "testdata/allow-empty-ingress-host-no-crs.yaml",
+			releaseName: "allow-empty-ingress-host-no-crs",
+			namespace:   "default",
+		},
 	}
 
 	// Path to the helm chart we will test
```

**File**: `charts/tests/testdata/allow-empty-ingress-host-no-crs.yaml` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+controller:
+  enableCustomResources: false
+  allowEmptyIngressHost: true
```

---

### Incident Patch 8: `bfb7355d` (2026-09-30)
**Commit Message**: fix: prevent F5 WAF interfering with subrequests (#10588)

* fix: prevent F5 WAF interfering with subrequests

* Correct cli flags

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>
Signed-off-by: Paul Abel <[REDACTED_EMAIL]>

* handle native oidc and split-match location

* update snap

* add generator test

* Update ingress.go

Signed-off-by: Paul Abel <[REDACTED_EMAIL]>

---------

Signed-off-by: Paul Abel <[REDACTED_EMAIL]>
Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>
Co-authored-by: Venktesh Shivam Patel <[REDACTED_EMAIL]>

**File**: `internal/configs/ingress.go` (modified, +3/-0)
```diff
@@ -857,6 +857,7 @@ func generateNginxCfg(ncp NginxCfgParams) (version1.IngressNginxConfig, Warnings
 		StaticSSLPath:           ncp.staticParams.StaticSSLPath,
 		LimitReqZones:           limitReqZones,
 		Maps:                    removeDuplicateMaps(maps),
+		AppProtectLoadModule:    ncp.staticParams.MainAppProtectLoadModule,
 	}, allWarnings
 }
 
@@ -998,6 +999,7 @@ func generateIngressExternalAuthLocation(externalAuth *version2.ExternalAuth, up
 		Path:                     externalAuth.URI.InternalPath,
 		Internal:                 true,
 		Upstream:                 upstream,
+		DisableWAF:               true,
 		ProxyPass:                fmt.Sprintf("%s://%s%s", generateProxyPassProtocol(externalAuth.SSLEnabled), upstream.Name, externalAuth.URI.Path),
 		ProxySetHeaders:          []version2.Header{{Name: "Content-Length", Value: "0"}, {Name: "X-Scheme", Value: "$scheme"}},
 		ProxyConnectTimeout:      generateTimeWithDefault(cfg.ProxyConnectTimeout, cfg.ProxyConnectTimeout),
@@ -1594,6 +1596,7 @@ func generateNginxCfgForMergeableIngresses(ncp NginxCfgParams) (version1.Ingress
 		StaticSSLPath:           ncp.staticParams.StaticSSLPath,
 		LimitReqZones:           limitReqZones,
 		Maps:                    removeDuplicateMaps(maps),
+		AppProtectLoadModule:    ncp.staticParams.MainAppProtectLoadModule,
 	}, warnings
 }
 
```

**File**: `internal/configs/ingress_test.go` (modified, +3/-0)
```diff
@@ -4905,6 +4905,7 @@ func TestGenerateNginxCfgForAppProtect(t *testing.T) {
 	expected.Servers[0].AppProtectLogConfs = []string{"/etc/nginx/waf/nac-logconfs/default_logconf syslog:server=127.0.0.1:514"}
 	expected.Servers[0].AppProtectLogEnable = "on"
 	expected.Ingress.Annotations = cafeIngressEx.Ingress.Annotations
+	expected.AppProtectLoadModule = true
 
 	result, warnings := generateNginxCfg(NginxCfgParams{
 		staticParams:         staticCfgParams,
@@ -4968,6 +4969,7 @@ func TestGenerateNginxCfgForMergeableIngressesForAppProtect(t *testing.T) {
 	expected.Servers[0].AppProtectLogConfs = []string{"/etc/nginx/waf/nac-logconfs/default_logconf syslog:server=127.0.0.1:514"}
 	expected.Servers[0].AppProtectLogEnable = "on"
 	expected.Ingress.Annotations = mergeableIngresses.Master.Ingress.Annotations
+	expected.AppProtectLoadModule = true
 
 	result, warnings := generateNginxCfgForMergeableIngresses(NginxCfgParams{
 		mergeableIngs:        mergeableIngresses,
@@ -5372,6 +5374,7 @@ func TestGenerateIngressExternalAuthLocation(t *testing.T) {
 	expected := version1.Location{
 		Path:                     "/_ext_auth_default_my-auth",
 		Internal:                 true,
+		DisableWAF:               true,
 		Upstream:                 upstream,
 		ProxyPass:                "http://ext_auth_default_my-auth/auth",
 		ProxySetHeaders:          []version2.Header{{Name: "Content-Length", Value: "0"}, {Name: "X-Scheme", Value: "$scheme"}},
```

**File**: `internal/configs/version1/__snapshots__/template_test.snap` (modified, +66/-0)
```diff
@@ -3760,6 +3760,72 @@ server {
 
 ---
 
+[TestExecuteTemplate_ForIngressForNGINXPlus_DisablesWAFOnInternalLocations/module_loaded_disables_WAF_on_internal_locations - 1]
+# configuration for default/ing
+upstream test-upstream {
+    zone test-upstream 256k;
+    server 10.0.0.20:8001 max_fails=0 fail_timeout= max_conns=0;
+}
+
+
+server {
+
+    server_tokens "off";
+
+    server_name example.com;
+
+    status_zone "example.com";
+    set $resource_type "ingress";
+    set $resource_name "ing";
+    set $resource_namespace "default";
+    set $service "-";
+
+    
+
+    
+    location "/" {
+        set $service "svc";
+        status_zone "svc";
+
+        proxy_connect_timeout ;
+        proxy_read_timeout ;
+        proxy_send_timeout ;
+        client_max_body_size ;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Host $host;
+        proxy_set_header X-Forwarded-Port $server_port;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_buffering off;
+        proxy_pass ;
+        
+    }
+    
+    location "/_external_auth/authsvc" {
+        set $service "authsvc";
+        internal;
+        app_protect_enable off;
+
+        proxy_connect_timeout ;
+        proxy_read_timeout ;
+        proxy_send_timeout ;
+        client_max_body_size ;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Host $host;
+        proxy_set_header X-Forwarded-Port $server_port;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_buffering off;
+        proxy_pass http://ext-auth-authsvc/verify;
+        
+    }
+    
+}
+
+---
+
 [TestExecuteTemplate_ForIngressForNGINXRewriteTarget/case_insensitive_regex_rewrite - 1]
 # configuration for default/cafe-ingress
 
```

**File**: `internal/configs/version1/config.go` (modified, +6/-0)
```diff
@@ -25,6 +25,10 @@ type IngressNginxConfig struct {
 	StaticSSLPath           string
 	LimitReqZones           []LimitReqZone
 	KeyValZones             []version2.KeyValZone
+	// AppProtectLoadModule mirrors the controller's -enable-app-protect flag so
+	// templates can safely emit app_protect_enable off; in internal sub-request
+	// locations only when the WAF module is actually loaded.
+	AppProtectLoadModule bool
 }
 
 // Ingress holds information about an Ingress resource.
@@ -238,6 +242,8 @@ type Location struct {
 
 	AuthRequestOff bool
 	Internal       bool
+	// DisableWAF marks subrequest targets such as the ExternalAuth location.
+	DisableWAF bool
 
 	MinionIngress *Ingress
 
```

**File**: `internal/configs/version1/nginx-plus.ingress.tmpl` (modified, +6/-0)
```diff
@@ -396,6 +396,9 @@ server {
     location = {{ $p.ProxyLocation }} {
         internal;
         auth_oidc off;
+        {{- if $.AppProtectLoadModule }}
+        app_protect_enable off;
+        {{- end }}
         client_max_body_size 0;
         proxy_pass $oidc_idp_request_uri;
         proxy_ssl_server_name on;
@@ -427,6 +430,9 @@ server {
 		{{- if $location.Internal}}
 		internal;
 		{{- end}}
+		{{- if and $.AppProtectLoadModule $location.DisableWAF}}
+		app_protect_enable off;
+		{{- end}}
 		{{- with $location.MinionIngress}}
 		# location for minion {{$location.MinionIngress.Namespace}}/{{$location.MinionIngress.Name}}
 		set $resource_name "{{$location.MinionIngress.Name}}";
```

**File**: `internal/configs/version1/template_test.go` (modified, +113/-0)
```diff
@@ -151,6 +151,119 @@ func TestExecuteTemplate_ForIngressForNGINXPlus(t *testing.T) {
 	snaps.MatchSnapshot(t, buf.String())
 }
 
+func TestExecuteTemplate_ForIngressForNGINXPlus_DisablesWAFOnInternalLocations(t *testing.T) {
+	t.Parallel()
+
+	baseCfg := IngressNginxConfig{
+		Upstreams: []Upstream{
+			{Name: "test-upstream", UpstreamServers: []UpstreamServer{{Address: "10.0.0.20:8001"}}, UpstreamZoneSize: "256k"},
+		},
+		Servers: []Server{
+			{
+				Name:         "example.com",
+				StatusZone:   "example.com",
+				ServerTokens: "off",
+				Locations: []Location{
+					{Path: "/", Upstream: Upstream{Name: "test-upstream"}, ServiceName: "svc"},
+					{
+						Path:        "/_external_auth/authsvc",
+						Internal:    true,
+						DisableWAF:  true,
+						ProxyPass:   "http://ext-auth-authsvc/verify",
+						ServiceName: "authsvc",
+					},
+				},
+			},
+		},
+		Ingress: Ingress{Name: "ing", Namespace: "default"},
+	}
+
+	t.Run("module not loaded emits no override", func(t *testing.T) {
+		t.Parallel()
+		tmpl := newNGINXPlusIngressTmpl(t)
+		buf := &bytes.Buffer{}
+		cfg := baseCfg
+		if err := tmpl.Execute(buf, cfg); err != nil {
+			t.Fatal(err)
+		}
+		if bytes.Contains(buf.Bytes(), []byte("app_protect_enable off;")) {
+			t.Errorf("expected no app_protect_enable off; when AppProtectLoadModule is false, got:\n%s", buf.String())
+		}
+	})
+
+	t.Run("module loaded disables WAF on internal locations", func(t *testing.T) {
+		t.Parallel()
+		tmpl := newNGINXPlusIngressTmpl(t)
+		buf := &bytes.Buffer{}
+		cfg := baseCfg
+		cfg.AppProtectLoadModule = true
+		if err := tmpl.Execute(buf, cfg); err != nil {
+			t.Fatal(err)
+		}
+		out := buf.Bytes()
+		marker := []byte(`location "/_external_auth/authsvc"`)
+		idx := bytes.Index(out, marker)
+		if idx < 0 {
+			t.Fatalf("marker %q missing from rendered template", marker)
+		}
+		end := idx + 400
+		if end > len(out) {
+			end = len(out)
+		}
+		if !bytes.Contains(out[idx:end], []byte("app_protect_enable off;")) {
+			t.Errorf("missing app_protect_enable off; inside external auth location\nrendered slice:\n%s", out[idx:end])
+		}
+		snaps.MatchSnapshot(t, buf.String())
+	})
+
+	t.Run("module loaded disables WAF on OIDC native proxy location", func(t *testing.T) {
+		t.Parallel()
+		tmpl := newNGINXPlusIngressTmpl(t)
+		buf := &bytes.Buffer{}
+		cfg := baseCfg
+		cfg.AppProtectLoadModule = true
+		cfg.OIDCProviders = []version2.OIDCProvider{{
+			Name:            "default_oidc",
+			Issuer:          "https://idp.example.com",
+			ClientID:        "nic",
+			ClientSecret:    "secret",
+			ProxyLocation:   "/_oidc_idp_default_oidc",
+			ProxyBufferSize: "32k",
+		}}
+		if err := tmpl.Execute(buf, cfg); err != nil {
+			t.Fatal(err)
+		}
+		out := buf.Bytes()
+		idx := bytes.Index(out, []byte("location = /_oidc_idp_default_oidc"))
+		if idx < 0 {
+			t.Fatalf("OIDC native proxy location missing:\n%s", out)
+		}
+		body := out[idx:]
+		if end := bytes.Index(body, []byte("}")); end >= 0 {
+			body = body[:end]
+		}
+		if !bytes.Contains(body, []byte("app_protect_enable off;")) {
+			t.Errorf("missing app_protect_enable off; inside OIDC native proxy location:\n%s", body)
+		}
+	})
+
+	t.Run("internal location without DisableWAF keeps WAF", func(t *testing.T) {
+		t.Parallel()
+		tmpl := newNGINXPlusIngressTmpl(t)
+		buf := &bytes.Buffer{}
+		cfg := baseCfg
+		cfg.AppProtectLoadModule = true
+		cfg.Servers = []Server{baseCfg.Servers[0]}
+		cfg.Servers[0].Locations = []Location{{Path: "/_internal", Internal: true, ServiceName: "svc", Upstream: Upstream{Name: "test-upstream"}}}
+		if err := tmpl.Execute(buf, cfg); err != nil {
+			t.Fatal(err)
+		}
+		if bytes.Contains(buf.Bytes(), []byte("app_protect_enable off;")) {
+			t.Errorf("app_protect_enable off; must only be emitted for DisableWAF locations:\n%s", buf.String())
+		}
+	})
+}
+
 func TestExecuteTemplate_ForIngressForNGINX(t *testing.T) {
 	t.Parallel()
 
```

**File**: `internal/configs/version2/__snapshots__/templates_test.snap` (modified, +228/-0)
```diff
@@ -1,4 +1,127 @@
 
+[TestExecuteOIDCTemplate_DisablesWAFOnInternalLocationsWhenAppProtectLoaded/module_loaded_disables_WAF_on_every_internal_OIDC_location - 1]
+    # Advanced configuration START
+    set $internal_error_message "NGINX / OpenID Connect login failure\n";
+    set $pkce_id "";
+    set $idp_sid "";
+    # resolver 8.8.8.8; # For DNS lookup of IdP endpoints;
+    subrequest_output_buffer_size 32k; # To fit a complete tokenset response
+    gunzip on; # Decompress IdP responses if necessary
+    # Advanced configuration END
+
+    location = /_jwks_uri {
+        internal;
+        app_protect_enable off;
+        client_max_body_size 0;                       # Subrequest inherits parent Content-Length
+        proxy_cache jwk;                              # Cache the JWK Set received from IdP
+        proxy_cache_valid 200 12h;                    # How long to consider keys "fresh"
+        proxy_cache_use_stale error timeout updating; # Use old JWK Set if cannot reach IdP
+        proxy_ssl_server_name on;                     # Send SNI to IdP host
+
+        proxy_method GET;                             # In case client request was non-GET
+        proxy_set_header Content-Length "";           # ''
+        proxy_pass $oidc_jwt_keyfile;                 # Expecting to find a URI here
+        proxy_ignore_headers Cache-Control Expires Set-Cookie; # Does not influence caching
+    }
+
+    location @do_oidc_flow {
+        status_zone "OIDC start";
+        js_content oidc.auth;
+        default_type text/plain; # In case we throw an error
+    }
+
+    set $redir_location "/_codexch";
+    location = "/_codexch" {
+        # This location is called by the IdP after successful authentication
+        status_zone "OIDC code exchange";
+        js_content oidc.codeExchange;
+        error_page 500 502 504 @oidc_error;
+    }
+
+    location = /_token {
+        # This location is called by oidcCodeExchange(). We use the proxy_ directives
+        # to construct the OpenID Connect token request, as per:
+        #  http://openid.net/specs/openid-connect-core-1_0.html#TokenRequest
+        internal;
+        app_protect_enable off;
+        client_max_body_size 0;                       # Subrequest inherits parent Content-Length
+
+        # Exclude client headers to avoid CORS errors with certain IdPs (e.g., Microsoft Entra ID)
+        proxy_pass_request_headers off;
+        proxy_ssl_server_name on;    # Send SNI to IdP host
+
+        proxy_set_header      Content-Type "application/x-www-form-urlencoded";
+        proxy_set_header      Authorization $arg_secret_basic;
+        proxy_pass            $oidc_token_endpoint;
+    }
+
+    location = /_refresh {
+        # This location is called by oidcAuth() when performing a token refresh. We
+        # use the proxy_ directives to construct the OpenID Connect token request, as per:
+        #  https://openid.net/specs/openid-connect-core-1_0.html#RefreshingAccessToken
+        internal;
+        app_protect_enable off;
+        client_max_body_size 0;                       # Subrequest inherits parent Content-Length
+
+        # Exclude client headers to avoid CORS errors with certain IdPs (e.g., Microsoft Entra ID)
+        proxy_pass_request_headers off;
+        proxy_ssl_server_name on;                    # Send SNI to IdP host
+
+        proxy_set_header      Content-Type "application/x-www-form-urlencoded";
+        proxy_set_header      Authorization $arg_secret_basic;
+        proxy_pass            $oidc_token_endpoint;
+    }
+
+    location = /_token_validation {
+        # Internal location to verify any JWT (e.g., id_token, logout_token)
+        # using the auth_jwt module. Extracts the claims and returns them as JSON.
+        internal;
+        app_protect_enable off;
+        client_max_body_size 0;                       # Subrequest inherits parent Content-Length
+        auth_jwt "" token=$arg_token;
+        js_content oidc.extractTokenClaims;
+        error_page 500 502 504 @oidc_error;
+    }
+
+    location = /logout {
+        status_zone "OIDC logout";
+        add_header Set-Cookie "auth_token=; $oidc_cookie_flags";
+        add_header Set-Cookie "auth_nonce=; $oidc_cookie_flags";
+        add_header Set-Cookie "auth_redir=; $oidc_cookie_flags";
+        js_content oidc.logout;
+    }
+
+    location = /front_channel_logout {
+        status_zone "OIDC logout";
+        add_header Cache-Control "no-store";
+        default_type text/plain;
+        js_content oidc.handleFrontChannelLogout;
+    }
+
+    location = /_logout {
+        # This location is the default value of $oidc_logout_redirect (in case it wasn't configured)
+        default_type text/plain;
+        return 200 "Logged out\n";
+    }
+
+    location @oidc_error {
+        # This location is called when oidcAuth() or oidcCodeExchange() returns an error
+        status_zone "OIDC error";
+        default_type text/plain;
+        return 500 $internal_err
```

**File**: `internal/configs/version2/http.go` (modified, +12/-2)
```diff
@@ -30,6 +30,10 @@ type VirtualServerConfig struct {
 	Upstreams               []Upstream
 	DynamicSSLReloadEnabled bool
 	StaticSSLPath           string
+	// AppProtectLoadModule mirrors the controller's -enable-app-protect flag so
+	// templates can safely emit app_protect_enable off; in internal sub-request
+	// locations only when the WAF module is actually loaded.
+	AppProtectLoadModule bool
 }
 
 // AuthJWTClaimSet defines the values for the `auth_jwt_claim_set` directive
@@ -165,6 +169,10 @@ type OIDC struct {
 	VerifyDepth           int
 	CAFile                string
 	PolicyName            string
+	// AppProtectLoadModule mirrors the controller's --enable-app-protect flag so
+	// oidc.tmpl can emit app_protect_enable off; on its internal sub-request
+	// locations only when the WAF module is actually loaded.
+	AppProtectLoadModule bool
 }
 
 // APIKey holds API key configuration.
@@ -199,8 +207,10 @@ type Dos struct {
 
 // Location defines a location.
 type Location struct {
-	Path                       string
-	Internal                   bool
+	Path     string
+	Internal bool
+	// DisableWAF marks subrequest targets; splits/matches internal locations carry client traffic and must keep WAF.
+	DisableWAF                 bool
 	Snippets                   []string
 	ProxyConnectTimeout        string
 	ProxyReadTimeout           string
```

---

### Incident Patch 9: `15f56f70` (2026-09-30)
**Commit Message**: fix: synchronize namespaced informer registries (#10956)

* fix: synchronize namespaced informer registries

The namespaced informer maps in internal/k8s, internal/externaldns and
internal/certmanager were reachable from more than one goroutine without
synchronization. In internal/k8s the map was shared by reference rather
than copied, so LoadBalancerController and statusUpdater operated on the
same map: the sync queue worker updates it as watched namespaces change,
while the background status flush pool and the leader election callbacks
read it.

Add internal/nsregistry, a single concurrency-safe registry generic over
the informer group type, and use it from all three packages. Each package
declares its own group type, and the registry never looks inside one, so a
type parameter is enough. This replaces three copies of the same map that
had already started to drift.

Holding a group against removal is part of the registry API rather than
left to the caller. Readers that run off the sync queue goroutine use
WithInformer or ForEach, which hold the read lock for the duration of the
callback, and Remove takes the write lock and returns the group it
unregistered. Remove therefore canno

**File**: `internal/certmanager/cm_controller.go` (modified, +33/-21)
```diff
@@ -37,6 +37,7 @@ import (
 	"k8s.io/client-go/util/workqueue"
 
 	nl "github.com/nginx/kubernetes-ingress/internal/logger"
+	"github.com/nginx/kubernetes-ingress/internal/nsregistry"
 	conf_v1 "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/v1"
 	k8s_nginx "github.com/nginx/kubernetes-ingress/pkg/client/clientset/versioned"
 	vsinformers "github.com/nginx/kubernetes-ingress/pkg/client/informers/externalversions"
@@ -62,7 +63,7 @@ type CmController struct {
 	sync          SyncFn
 	ctx           context.Context
 	queue         workqueue.TypedRateLimitingInterface[types.NamespacedName]
-	informerGroup map[string]*namespacedInformer
+	informerGroup *nsregistry.Registry[namespacedInformer]
 	recorder      record.EventRecorder
 	cmClient      *cm_clientset.Clientset
 	kubeClient    kubernetes.Interface
@@ -88,7 +89,7 @@ type namespacedInformer struct {
 	vsLister                  listers_v1.VirtualServerLister
 	cmLister                  cmlisters.CertificateLister
 	stopCh                    chan struct{}
-	lock                      sync.RWMutex
+	stopOnce                  sync.Once
 }
 
 func (c *CmController) register() workqueue.TypedRateLimitingInterface[types.NamespacedName] {
@@ -120,7 +121,7 @@ func (c *CmController) newNamespacedInformer(ns string) (*namespacedInformer, er
 		return nil, fmt.Errorf("failed to add event handlers for namespace %s: %w", ns, err)
 	}
 
-	c.informerGroup[ns] = nsi
+	c.informerGroup.Set(ns, nsi)
 	return nsi, nil
 }
 
@@ -145,10 +146,17 @@ func (c *CmController) processItem(ctx context.Context, key types.NamespacedName
 	namespace := key.Namespace
 	name := key.Name
 
-	nsi := getNamespacedInformer(namespace, c.informerGroup)
-
 	var vs *conf_v1.VirtualServer
-	vs, err := nsi.vsLister.VirtualServers(namespace).Get(name)
+	var err error
+	watched := c.informerGroup.WithInformer(namespace, func(nsi *namespacedInformer) {
+		vs, err = nsi.vsLister.VirtualServers(namespace).Get(name)
+	})
+	if !watched {
+		// the namespace stopped being watched between the item being queued
+		// and it being processed, so there is nothing left to reconcile
+		nl.Debugf(l, "Skipping VirtualServer %s/%s: namespace %s is not watched", namespace, name, namespace)
+		return nil
+	}
 
 	// VS has been deleted
 	if apierrors.IsNotFound(err) {
@@ -207,7 +215,7 @@ func NewCmController(opts *CmOpts) (*CmController, error) {
 		return nil, fmt.Errorf("failed to create cert-manager client: %w", err)
 	}
 
-	ig := make(map[string]*namespacedInformer)
+	ig := nsregistry.New[namespacedInformer]()
 
 	cm := &CmController{
 		ctx:           opts.context,
@@ -246,10 +254,10 @@ func (c *CmController) Run(stopCh <-chan struct{}) {
 	nl.Info(l, "Starting cert-manager control loop")
 
 	var mustSync []cache.InformerSynced
-	for _, ig := range c.informerGroup {
+	c.informerGroup.ForEach(func(ig *namespacedInformer) {
 		ig.start()
 		mustSync = append(mustSync, ig.mustSync...)
-	}
+	})
 	// wait for all the informer caches we depend on are synced
 
 	nl.Debugf(l, "Waiting for %d caches to sync", len(mustSync))
@@ -263,9 +271,9 @@ func (c *CmController) Run(stopCh <-chan struct{}) {
 
 	<-stopCh
 	nl.Debugf(l, "shutting down queue as workqueue signaled shutdown")
-	for _, ig := range c.informerGroup {
+	c.informerGroup.ForEach(func(ig *namespacedInformer) {
 		ig.stop()
-	}
+	})
 	c.queue.ShutDown()
 }
 
@@ -275,8 +283,12 @@ func (nsi *namespacedInformer) start() {
 	go nsi.kubeSharedInformerFactory.Start(nsi.stopCh)
 }
 
+// stop closes the group's stop channel. It is idempotent: the shutdown sweep in
+// Run and RemoveNamespacedInformer can both reach the same group.
 func (nsi *namespacedInformer) stop() {
-	close(nsi.stopCh)
+	nsi.stopOnce.Do(func() {
+		close(nsi.stopCh)
+	})
 }
 
 // runWorker is a long-running function that will continually call the
@@ -308,10 +320,10 @@ func (c *CmController) runWorker(ctx context.Context) {
 }
 
 // AddNewNamespacedInformer adds watchers for a new namespace
-func (c *CmController) AddNewNamespacedInformer(ns string) {
+func (c *CmController) AddNewNamespacedInformer(ctx context.Context, ns string) {
 	l := nl.LoggerFromContext(c.ctx)
 	nl.Debugf(l, "Adding or Updating cert-manager Watchers for Namespace: %v", ns)
-	nsi := getNamespacedInformer(ns, c.informerGroup)
+	nsi := c.informerGroup.Get(ns)
 	if nsi == nil {
 		var err error
 		nsi, err = c.newNamespacedInformer(ns)
@@ -321,7 +333,11 @@ func (c *CmController) AddNewNamespacedInformer(ns string) {
 		}
 		nsi.start()
 	}
-	if !cache.WaitForCacheSync(nsi.stopCh, nsi.mustSync...) {
+	// ctx is the caller's run context. This is called from the main
+	// controller's queue worker, and its shutdown waits for that worker, so
+	// the wait must also end when ctx is canceled rather than only when this
+	// group's stopCh closes.
+	if !nsregistry.WaitForCacheSync(ctx, nsi.stopCh, nsi.mustSync...) {
 		return
 	}
 }
@@ -330,12 +346,8 @@ func (c *CmController) AddNewNamespacedInformer(ns string) {
 func (c *CmControlle
```

**File**: `internal/certmanager/cm_controller_test.go` (modified, +4/-2)
```diff
@@ -22,6 +22,8 @@ import (
 	"testing"
 	"time"
 
+	"github.com/nginx/kubernetes-ingress/internal/nsregistry"
+
 	cmapi "github.com/cert-manager/cert-manager/pkg/apis/certmanager/v1"
 	cmclient "github.com/cert-manager/cert-manager/pkg/client/clientset/versioned"
 	controllerpkg "github.com/cert-manager/cert-manager/pkg/controller"
@@ -137,15 +139,15 @@ func Test_controller_Register(t *testing.T) {
 			// Certificate event is received then HasSynced has not been setup
 			// properly.
 
-			ig := make(map[string]*namespacedInformer)
+			ig := nsregistry.New[namespacedInformer]()
 
 			nsi := &namespacedInformer{
 				cmSharedInformerFactory:   b.Context.SharedInformerFactory,
 				kubeSharedInformerFactory: b.Context.KubeSharedInformerFactory,
 				vsSharedInformerFactory:   b.VsSharedInformerFactory,
 			}
 
-			ig[""] = nsi
+			ig.Set("", nsi)
 
 			cm := &CmController{
 				ctx:           b.RootContext,
```

**File**: `internal/certmanager/helper.go` (modified, +0/-18)
```diff
@@ -129,21 +129,3 @@ func translateVsSpec(crt *cmapi.Certificate, vsCmSpec *vsapi.CertManager) error
 	}
 	return nil
 }
-
-func getNamespacedInformer(ns string, ig map[string]*namespacedInformer) *namespacedInformer {
-	var nsi *namespacedInformer
-	var isGlobalNs bool
-	var exists bool
-
-	nsi, isGlobalNs = ig[""]
-
-	if !isGlobalNs {
-		// get the correct namespaced informers
-		nsi, exists = ig[ns]
-		if !exists {
-			// we are not watching this namespace
-			return nil
-		}
-	}
-	return nsi
-}
```

**File**: `internal/certmanager/namespaced_informer_registry_test.go` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+package certmanager
+
+import (
+	"context"
+	"testing"
+
+	"github.com/nginx/kubernetes-ingress/internal/nsregistry"
+	vsapi "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/v1"
+	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/client-go/tools/record"
+)
+
+// The registry itself is covered by internal/nsregistry. These cover how this
+// controller uses it.
+
+// TestSyncFnSkipsUnwatchedNamespace covers a VirtualServer whose namespace
+// stopped being watched between the item being queued and it being processed.
+// The lookup reports the namespace unwatched, and nothing is dereferenced.
+func TestSyncFnSkipsUnwatchedNamespace(t *testing.T) {
+	t.Parallel()
+
+	vs := &vsapi.VirtualServer{
+		ObjectMeta: v1.ObjectMeta{Namespace: "not-watched", Name: "test-vs"},
+		Spec: vsapi.VirtualServerSpec{
+			TLS: &vsapi.TLS{
+				Secret:      "test-secret",
+				CertManager: &vsapi.CertManager{Issuer: "test-issuer"},
+			},
+		},
+	}
+
+	sync := SyncFnFor(&record.FakeRecorder{}, nil, nsregistry.New[namespacedInformer]())
+
+	if err := sync(context.Background(), vs); err != nil {
+		t.Errorf("sync for an unwatched namespace returned %v, want nil", err)
+	}
+}
+
+// TestProcessItemSkipsUnwatchedNamespace covers the same case on the queue
+// worker's own lookup.
+func TestProcessItemSkipsUnwatchedNamespace(t *testing.T) {
+	t.Parallel()
+
+	c := &CmController{
+		ctx:           context.Background(),
+		informerGroup: nsregistry.New[namespacedInformer](),
+	}
+
+	key := types.NamespacedName{Namespace: "not-watched", Name: "test-vs"}
+	if err := c.processItem(context.Background(), key); err != nil {
+		t.Errorf("processItem for an unwatched namespace returned %v, want nil", err)
+	}
+}
+
+// TestRemoveNamespacedInformerUnregistersAndStops checks that removal both
+// unregisters the group and stops it. The ordering between the two is enforced
+// by the API rather than by this test: Remove returns the group, so there is
+// nothing to stop until it has already been unregistered.
+func TestRemoveNamespacedInformerUnregistersAndStops(t *testing.T) {
+	t.Parallel()
+
+	nsi := &namespacedInformer{stopCh: make(chan struct{})}
+	c := &CmController{
+		ctx:           context.Background(),
+		informerGroup: nsregistry.New[namespacedInformer](),
+	}
+	c.informerGroup.Set("doomed", nsi)
+
+	c.RemoveNamespacedInformer("doomed")
+
+	if got := c.informerGroup.Get("doomed"); got != nil {
+		t.Errorf("Get after RemoveNamespacedInformer = %v, want nil", got)
+	}
+	select {
+	case <-nsi.stopCh:
+		// stopped, as expected
+	default:
+		t.Error("informer was unregistered but never stopped")
+	}
+}
+
+// TestNamespacedInformerStopIsIdempotent covers shutdown: Run's sweep stops every
+// registered group while RemoveNamespacedInformer may be stopping one of them, so
+// both can reach the same group. A second close of stopCh would panic.
+func TestNamespacedInformerStopIsIdempotent(t *testing.T) {
+	t.Parallel()
+
+	nsi := &namespacedInformer{stopCh: make(chan struct{})}
+
+	nsi.stop()
+	nsi.stop()
+
+	select {
+	case <-nsi.stopCh:
+	default:
+		t.Error("stopCh was not closed")
+	}
+}
```

**File**: `internal/certmanager/sync.go` (modified, +20/-5)
```diff
@@ -37,6 +37,7 @@ import (
 	"k8s.io/client-go/tools/record"
 
 	nl "github.com/nginx/kubernetes-ingress/internal/logger"
+	"github.com/nginx/kubernetes-ingress/internal/nsregistry"
 	vsapi "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/v1"
 )
 
@@ -53,7 +54,7 @@ type SyncFn func(context.Context, *vsapi.VirtualServer) error
 func SyncFnFor(
 	rec record.EventRecorder,
 	cmClient clientset.Interface,
-	ig map[string]*namespacedInformer,
+	ig *nsregistry.Registry[namespacedInformer],
 ) SyncFn {
 	return func(ctx context.Context, vs *vsapi.VirtualServer) error {
 		var err error
@@ -69,9 +70,16 @@ func SyncFnFor(
 			return err
 		}
 
-		nsi := getNamespacedInformer(vs.GetNamespace(), ig)
-
-		newCrts, updateCrts, err := buildCertificates(ctx, nsi.cmLister, vs, issuerName, issuerKind, issuerGroup)
+		var newCrts, updateCrts []*cmapi.Certificate
+		watched := ig.WithInformer(vs.GetNamespace(), func(nsi *namespacedInformer) {
+			newCrts, updateCrts, err = buildCertificates(ctx, nsi.cmLister, vs, issuerName, issuerKind, issuerGroup)
+		})
+		if !watched {
+			// the namespace stopped being watched between the item being
+			// queued and it being processed
+			nl.Debugf(l, "Skipping VirtualServer %s/%s: namespace %s is not watched", vs.GetNamespace(), vs.GetName(), vs.GetNamespace())
+			return nil
+		}
 		if err != nil {
 			nl.Errorf(l, "Incorrect cert-manager configuration for VirtualServer resource: %v", err)
 			rec.Eventf(vs, corev1.EventTypeWarning, nl.EventReasonBadConfig, "Incorrect cert-manager configuration for VirtualServer resource: %s",
@@ -102,7 +110,14 @@ func SyncFnFor(
 		}
 		var certs []*cmapi.Certificate
 
-		certs, err = nsi.cmLister.Certificates(vs.GetNamespace()).List(labels.Everything())
+		stillWatched := ig.WithInformer(vs.GetNamespace(), func(nsi *namespacedInformer) {
+			certs, err = nsi.cmLister.Certificates(vs.GetNamespace()).List(labels.Everything())
+		})
+		if !stillWatched {
+			// the namespace stopped being watched while this item was being
+			// reconciled, so there is nothing left to clean up
+			return nil
+		}
 		if err != nil {
 			return err
 		}
```

**File**: `internal/certmanager/sync_test.go` (modified, +4/-2)
```diff
@@ -21,6 +21,8 @@ import (
 	"errors"
 	"testing"
 
+	"github.com/nginx/kubernetes-ingress/internal/nsregistry"
+
 	cmapi "github.com/cert-manager/cert-manager/pkg/apis/certmanager/v1"
 	cmmeta "github.com/cert-manager/cert-manager/pkg/apis/meta/v1"
 	"github.com/cert-manager/cert-manager/test/unit/gen"
@@ -494,7 +496,7 @@ func TestSync(t *testing.T) {
 			b.Init()
 			defer b.Stop()
 
-			ig := make(map[string]*namespacedInformer)
+			ig := nsregistry.New[namespacedInformer]()
 
 			nsi := &namespacedInformer{
 				cmSharedInformerFactory:   b.FakeCMInformerFactory(),
@@ -503,7 +505,7 @@ func TestSync(t *testing.T) {
 				cmLister:                  b.SharedInformerFactory.Certmanager().V1().Certificates().Lister(),
 			}
 
-			ig[""] = nsi
+			ig.Set("", nsi)
 
 			sync := SyncFnFor(b.Recorder, b.CMClient, ig)
 			b.Start()
```

**File**: `internal/externaldns/controller.go` (modified, +33/-38)
```diff
@@ -7,6 +7,7 @@ import (
 	"time"
 
 	nl "github.com/nginx/kubernetes-ingress/internal/logger"
+	"github.com/nginx/kubernetes-ingress/internal/nsregistry"
 	conf_v1 "github.com/nginx/kubernetes-ingress/pkg/apis/configuration/v1"
 	extdns_v1 "github.com/nginx/kubernetes-ingress/pkg/apis/externaldns/v1"
 	k8s_nginx "github.com/nginx/kubernetes-ingress/pkg/client/clientset/versioned"
@@ -35,7 +36,7 @@ type ExtDNSController struct {
 	queue         workqueue.TypedRateLimitingInterface[types.NamespacedName]
 	recorder      record.EventRecorder
 	client        k8s_nginx.Interface
-	informerGroup map[string]*namespacedInformer
+	informerGroup *nsregistry.Registry[namespacedInformer]
 	resync        time.Duration
 }
 
@@ -45,7 +46,7 @@ type namespacedInformer struct {
 	extdnslister          extdnslisters.DNSEndpointLister
 	mustSync              []cache.InformerSynced
 	stopCh                chan struct{}
-	lock                  sync.RWMutex
+	stopOnce              sync.Once
 }
 
 // ExtDNSOpts represents config required for building the External DNS Controller.
@@ -60,7 +61,7 @@ type ExtDNSOpts struct {
 
 // NewController takes external dns config and return a new External DNS Controller.
 func NewController(opts *ExtDNSOpts) (*ExtDNSController, error) {
-	ig := make(map[string]*namespacedInformer)
+	ig := nsregistry.New[namespacedInformer]()
 
 	rateLimiter := workqueue.DefaultTypedControllerRateLimiter[types.NamespacedName]()
 
@@ -114,7 +115,7 @@ func (c *ExtDNSController) newNamespacedInformer(ns string) (*namespacedInformer
 		nsi.sharedInformerFactory.K8s().V1().VirtualServers().Informer().HasSynced,
 		nsi.sharedInformerFactory.Externaldns().V1().DNSEndpoints().Informer().HasSynced,
 	)
-	c.informerGroup[ns] = nsi
+	c.informerGroup.Set(ns, nsi)
 	return nsi, nil
 }
 
@@ -131,10 +132,10 @@ func (c *ExtDNSController) Run(stopCh <-chan struct{}) {
 	nl.Info(l, "Starting external-dns control loop")
 
 	var mustSync []cache.InformerSynced
-	for _, ig := range c.informerGroup {
+	c.informerGroup.ForEach(func(ig *namespacedInformer) {
 		ig.start()
 		mustSync = append(mustSync, ig.mustSync...)
-	}
+	})
 
 	// wait for all informer caches to be synced
 	nl.Debugf(l, "Waiting for %d caches to sync", len(mustSync))
@@ -148,18 +149,22 @@ func (c *ExtDNSController) Run(stopCh <-chan struct{}) {
 
 	<-stopCh
 	nl.Debugf(l, "shutting down queue as workqueue signaled shutdown")
-	for _, ig := range c.informerGroup {
+	c.informerGroup.ForEach(func(ig *namespacedInformer) {
 		ig.stop()
-	}
+	})
 	c.queue.ShutDown()
 }
 
 func (nsi *namespacedInformer) start() {
 	go nsi.sharedInformerFactory.Start(nsi.stopCh)
 }
 
+// stop closes the group's stop channel. It is idempotent: the shutdown sweep in
+// Run and RemoveNamespacedInformer can both reach the same group.
 func (nsi *namespacedInformer) stop() {
-	close(nsi.stopCh)
+	nsi.stopOnce.Do(func() {
+		close(nsi.stopCh)
+	})
 }
 
 // runWorker is a long-running function that will continually call the processItem
@@ -191,8 +196,16 @@ func (c *ExtDNSController) processItem(ctx context.Context, key types.Namespaced
 	name := key.Name
 	l := nl.LoggerFromContext(ctx)
 	var vs *conf_v1.VirtualServer
-	nsi := getNamespacedInformer(namespace, c.informerGroup)
-	vs, err := nsi.vsLister.VirtualServers(namespace).Get(name)
+	var err error
+	watched := c.informerGroup.WithInformer(namespace, func(nsi *namespacedInformer) {
+		vs, err = nsi.vsLister.VirtualServers(namespace).Get(name)
+	})
+	if !watched {
+		// the namespace stopped being watched between the item being queued
+		// and it being processed, so there is nothing left to reconcile
+		nl.Debugf(l, "Skipping VirtualServer %s/%s: namespace %s is not watched", namespace, name, namespace)
+		return nil
+	}
 
 	// VS has been deleted
 	if apierrors.IsNotFound(err) {
@@ -245,29 +258,11 @@ func BuildOpts(ctx context.Context, ns []string, rdr record.EventRecorder, clien
 	}
 }
 
-func getNamespacedInformer(ns string, ig map[string]*namespacedInformer) *namespacedInformer {
-	var nsi *namespacedInformer
-	var isGlobalNs bool
-	var exists bool
-
-	nsi, isGlobalNs = ig[""]
-
-	if !isGlobalNs {
-		// get the correct namespaced informers
-		nsi, exists = ig[ns]
-		if !exists {
-			// we are not watching this namespace
-			return nil
-		}
-	}
-	return nsi
-}
-
 // AddNewNamespacedInformer adds watchers for a new namespace
-func (c *ExtDNSController) AddNewNamespacedInformer(ns string) {
+func (c *ExtDNSController) AddNewNamespacedInformer(ctx context.Context, ns string) {
 	l := nl.LoggerFromContext(c.ctx)
 	nl.Debugf(l, "Adding or Updating external-dns Watchers for Namespace: %v", ns)
-	nsi := getNamespacedInformer(ns, c.informerGroup)
+	nsi := c.informerGroup.Get(ns)
 	if nsi == nil {
 		var err error
 		nsi, err = c.newNamespacedInformer(ns)
@@ -277,7 +272,11 @@ func (c *ExtDNSController) AddNewNamespacedInformer(ns string) {
 		}
 		nsi.start()
 	}
-	if !cache.WaitForCacheSync(nsi.stopCh, nsi.mustSync...) {
+	// ctx is the caller's 
```

**File**: `internal/externaldns/controller_test.go` (modified, +3/-3)
```diff
@@ -35,8 +35,8 @@ func TestNewController_DynamicNsSkipsEmptyNamespace(t *testing.T) {
 	if c == nil {
 		t.Fatal("expected non-nil controller")
 	}
-	if len(c.informerGroup) != 0 {
-		t.Errorf("expected empty informerGroup when namespace skipped, got %d entries", len(c.informerGroup))
+	if c.informerGroup.Len() != 0 {
+		t.Errorf("expected empty informerGroup when namespace skipped, got %d entries", c.informerGroup.Len())
 	}
 }
 
@@ -51,7 +51,7 @@ func TestNewController_WithNamespace(t *testing.T) {
 	if c == nil {
 		t.Fatal("expected non-nil controller")
 	}
-	if _, ok := c.informerGroup["default"]; !ok {
+	if c.informerGroup.Get("default") == nil {
 		t.Error("expected informerGroup to contain entry for 'default' namespace")
 	}
 }
```

---

### Incident Patch 10: `d114b82a` (2026-09-30)
**Commit Message**: fix external PR workflow to update existing DO NOT MERGE PRs (#10503)

allow workflow approval command to update existing DO NOT MERGE branches

**File**: `.github/workflows/external-pr.yml` (modified, +6/-13)
```diff
@@ -20,9 +20,9 @@ jobs:
         is_fork: ${{ steps.pr-info.outputs.is_fork }}
         fork_owner: ${{ steps.pr-info.outputs.fork_owner }}
         fork_repo: ${{ steps.pr-info.outputs.fork_repo }}
-        branch: ${{ steps.pr-info.outputs.branch }}
         sha: ${{ steps.pr-info.outputs.sha }}
         base_branch: ${{ steps.pr-info.outputs.base_branch }}
+        pr_number: ${{ steps.pr-info.outputs.pr_number }}
         title: ${{ steps.pr-info.outputs.title }}
         body: ${{ steps.pr-info.outputs.body }}
     steps:
@@ -40,9 +40,9 @@ jobs:
             core.setOutput('is_fork', pr.data.head.repo.fork.toString());
             core.setOutput('fork_owner', pr.data.head.repo.owner.login);
             core.setOutput('fork_repo', pr.data.head.repo.name);
-            core.setOutput('branch', pr.data.head.ref);
             core.setOutput('sha', pr.data.head.sha);
             core.setOutput('base_branch', pr.data.base.ref);
+            core.setOutput('pr_number', context.issue.number.toString());
             core.setOutput('title', pr.data.title);
             const body = pr.data.body ?? '';
             core.setOutput('body', body);
@@ -126,8 +126,7 @@ jobs:
       - name: Create and push branch
         id: branch
         env:
-          PR_BRANCH: ${{ needs.pr-details.outputs.branch }}
-          SHA: ${{ needs.pr-details.outputs.sha }}
+          PR_NUMBER: ${{ needs.pr-details.outputs.pr_number }}
           APP_TOKEN: ${{ steps.app_token.outputs.token }}
         run: |
           git config --global credential.helper store
@@ -136,12 +135,10 @@ jobs:
           git remote add upstream https://github.com/${{ github.repository }}.git
           git fetch upstream
 
-          BRANCH_NAME="$PR_BRANCH"
-          SHORT_SHA="${SHA:0:8}"
-          INTERNAL_BRANCH="chore/${BRANCH_NAME}-${SHORT_SHA}-do-not-merge"
+          INTERNAL_BRANCH="chore/pr-${PR_NUMBER}-do-not-merge"
 
           git checkout -b "${INTERNAL_BRANCH}"
-          git push upstream "${INTERNAL_BRANCH}"
+          git push --force upstream "${INTERNAL_BRANCH}"
           echo "Branch updated: ${INTERNAL_BRANCH}"
 
           rm ~/.git-credentials
@@ -166,11 +163,7 @@ jobs:
             });
 
             if (existingPRs.length > 0) {
-              core.setFailed(
-                `PR already exists: #${existingPRs[0].number}\n` +
-                `URL: ${existingPRs[0].html_url}\n` +
-                `Close existing PR before creating a new one.`
-              );
+              console.log(`Existing PR updated: ${existingPRs[0].html_url}`);
               return;
             }
 
```

---

### Incident Patch 11: `bf82fbb3` (2026-09-30)
**Commit Message**: Fix keepalive annotation in master/minion Ingress (#9836)

* Refactor keepalive handling in NGINX configuration templates and related tests

* Address feedback

* Use testUpstreamWithKeepalive in appropriate test cases

* resolve rebase issues

* Update keepalive for externalAuth upstreams

* Add template tests to cover multiple upstreams with different keepalive values

---------

Co-authored-by: Haywood Shannon <[REDACTED_EMAIL]>

**File**: `internal/configs/configurator_test.go` (modified, +2/-2)
```diff
@@ -2759,7 +2759,7 @@ upstream {{$upstream.Name}} {
 	{{- end}}
 	{{- range $server := $upstream.UpstreamServers}}
 	server {{$server.Address}} max_fails={{$server.MaxFails}} fail_timeout={{$server.FailTimeout}} max_conns={{$server.MaxConns}};{{end}}
-	{{- if $.Keepalive}}keepalive {{$.Keepalive}};{{end}}
+	{{- if $upstream.Keepalive}}keepalive {{$upstream.Keepalive}};{{end}}
 }
 {{end -}}
 
@@ -2920,7 +2920,7 @@ server {
 		proxy_set_header Upgrade $http_upgrade;
 		proxy_set_header Connection $connection_upgrade;
 		{{- else}}
-		{{- if $.Keepalive}}
+		{{- if $location.Upstream.Keepalive}}
 		proxy_set_header Connection "";{{end}}
 		{{- end}}
 		{{- end}}
```

**File**: `internal/configs/ingress.go` (modified, +19/-22)
```diff
@@ -842,15 +842,9 @@ func generateNginxCfg(ncp NginxCfgParams) (version1.IngressNginxConfig, Warnings
 		}
 	}
 
-	var keepalive string
-	if cfgParams.Keepalive > 0 {
-		keepalive = fmt.Sprint(cfgParams.Keepalive)
-	}
-
 	return version1.IngressNginxConfig{
 		Upstreams:     upstreamMapToSlice(upstreams),
 		Servers:       servers,
-		Keepalive:     keepalive,
 		CORSHeaders:   policyCfg.CORSHeaders,
 		OIDCProviders: dedupedOIDCProviders,
 		KeyValZones:   keyValZones,
@@ -933,7 +927,7 @@ func generateBasicAuthConfig(owner runtime.Object, namespace string, secretRefs
 
 // createExternalAuthUpstream creates a version1.Upstream for the external auth service
 // from the resolved endpoints.
-func createExternalAuthUpstream(name string, endpoints []string) (version1.Upstream, string) {
+func createExternalAuthUpstream(name string, endpoints []string, cfgParams *ConfigParams) (version1.Upstream, string) {
 	if len(endpoints) == 0 {
 		return version1.NewUpstreamWithDefaultServer(name), fmt.Sprintf("No endpoints found for external auth upstream %v", name)
 	}
@@ -949,11 +943,15 @@ func createExternalAuthUpstream(name string, endpoints []string) (version1.Upstr
 	sort.Slice(upsServers, func(i, j int) bool {
 		return upsServers[i].Address < upsServers[j].Address
 	})
-	return version1.Upstream{
+	ups := version1.Upstream{
 		Name:             name,
 		UpstreamServers:  upsServers,
 		UpstreamZoneSize: "256k",
-	}, ""
+	}
+	if cfgParams.Keepalive > 0 {
+		ups.Keepalive = fmt.Sprint(cfgParams.Keepalive)
+	}
+	return ups, ""
 }
 
 // resolveExternalAuth resolves the external auth upstream and generates the
@@ -974,7 +972,7 @@ func resolveExternalAuth(
 
 	ns, svcName := ParseServiceReference(exAuth.URI.Service, ingress.Namespace)
 	endpointKey := fmt.Sprintf("%s/%s:%d", ns, svcName, port)
-	authUps, upsWarning := createExternalAuthUpstream(upsName, endpoints[endpointKey])
+	authUps, upsWarning := createExternalAuthUpstream(upsName, endpoints[endpointKey], cfgParams)
 	if upsWarning != "" {
 		if warning != "" {
 			warning = fmt.Sprintf("%s. %s", warning, upsWarning)
@@ -983,23 +981,24 @@ func resolveExternalAuth(
 		}
 	}
 	var locs []version1.Location
-	locs = append(locs, generateIngressExternalAuthLocation(exAuth, upsName, cfgParams))
+	locs = append(locs, generateIngressExternalAuthLocation(exAuth, authUps, cfgParams))
 	if exAuth.SigninURL != "" {
-		locs = append(locs, generateIngressExternalAuthOAuth2Location(exAuth, upsName, cfgParams))
+		locs = append(locs, generateIngressExternalAuthOAuth2Location(exAuth, authUps, cfgParams))
 	}
 
 	return authUps, locs, warning
 }
 
 // generateIngressExternalAuthLocation builds a version1.Location for the
 // internal NGINX location that proxies auth subrequests to the external auth service.
-func generateIngressExternalAuthLocation(externalAuth *version2.ExternalAuth, upstreamName string, cfg *ConfigParams) version1.Location {
+func generateIngressExternalAuthLocation(externalAuth *version2.ExternalAuth, upstream version1.Upstream, cfg *ConfigParams) version1.Location {
 	var svcName string
 	_, svcName = ParseServiceReference(externalAuth.URI.Service, "")
 	loc := version1.Location{
 		Path:                     externalAuth.URI.InternalPath,
 		Internal:                 true,
-		ProxyPass:                fmt.Sprintf("%s://%s%s", generateProxyPassProtocol(externalAuth.SSLEnabled), upstreamName, externalAuth.URI.Path),
+		Upstream:                 upstream,
+		ProxyPass:                fmt.Sprintf("%s://%s%s", generateProxyPassProtocol(externalAuth.SSLEnabled), upstream.Name, externalAuth.URI.Path),
 		ProxySetHeaders:          []version2.Header{{Name: "Content-Length", Value: "0"}, {Name: "X-Scheme", Value: "$scheme"}},
 		ProxyConnectTimeout:      generateTimeWithDefault(cfg.ProxyConnectTimeout, cfg.ProxyConnectTimeout),
 		ProxyReadTimeout:         generateTimeWithDefault(cfg.ProxyReadTimeout, cfg.ProxyReadTimeout),
@@ -1022,13 +1021,14 @@ func generateIngressExternalAuthLocation(externalAuth *version2.ExternalAuth, up
 
 // generateIngressExternalAuthOAuth2Location builds a version1.Location
 // for the NGINX location that handles OAuth2 signin redirects.
-func generateIngressExternalAuthOAuth2Location(externalAuth *version2.ExternalAuth, upstreamName string, cfg *ConfigParams) version1.Location {
+func generateIngressExternalAuthOAuth2Location(externalAuth *version2.ExternalAuth, upstream version1.Upstream, cfg *ConfigParams) version1.Location {
 	var svcName string
 	_, svcName = ParseServiceReference(externalAuth.URI.Service, "")
 	loc := version1.Location{
 		Path:                     externalAuth.SigninRedirectBasePath,
 		AuthRequestOff:           true,
-		ProxyPass:                fmt.Sprintf("%s://%s", generateProxyPassProtocol(externalAuth.SSLEnabled), upstreamName),
+		Upstream:                 upstream,
+		ProxyPass:                fmt.Sprintf("%s://%s", generateProxyPassProtocol(externalAuth.SSLEnabled), upstream.Name),
 		ProxySetHeaders:          []
```

**File**: `internal/configs/ingress_test.go` (modified, +147/-3)
```diff
@@ -5264,27 +5264,31 @@ func TestCreateExternalAuthUpstream(t *testing.T) {
 		name      string
 		upsName   string
 		endpoints []string
+		cfgParams *ConfigParams
 		expected  version1.Upstream
 		warning   bool
 	}{
 		{
 			name:      "no endpoints returns default server",
 			upsName:   "ext_auth_default_my-auth",
 			endpoints: nil,
+			cfgParams: &ConfigParams{},
 			expected:  version1.NewUpstreamWithDefaultServer("ext_auth_default_my-auth"),
 			warning:   true,
 		},
 		{
 			name:      "empty endpoints returns default server",
 			upsName:   "ext_auth_default_my-auth",
 			endpoints: []string{},
+			cfgParams: &ConfigParams{},
 			expected:  version1.NewUpstreamWithDefaultServer("ext_auth_default_my-auth"),
 			warning:   true,
 		},
 		{
 			name:      "single endpoint",
 			upsName:   "ext_auth_default_my-auth",
 			endpoints: []string{"10.0.0.1:8080"},
+			cfgParams: &ConfigParams{},
 			expected: version1.Upstream{
 				Name:             "ext_auth_default_my-auth",
 				UpstreamZoneSize: "256k",
@@ -5298,6 +5302,7 @@ func TestCreateExternalAuthUpstream(t *testing.T) {
 			name:      "multiple endpoints sorted",
 			upsName:   "ext_auth_default_my-auth",
 			endpoints: []string{"10.0.0.3:8080", "10.0.0.1:8080", "10.0.0.2:8080"},
+			cfgParams: &ConfigParams{},
 			expected: version1.Upstream{
 				Name:             "ext_auth_default_my-auth",
 				UpstreamZoneSize: "256k",
@@ -5309,12 +5314,27 @@ func TestCreateExternalAuthUpstream(t *testing.T) {
 			},
 			warning: false,
 		},
+		{
+			name:      "keepalive from cfgParams is applied",
+			upsName:   "ext_auth_default_my-auth",
+			endpoints: []string{"10.0.0.1:8080"},
+			cfgParams: &ConfigParams{Keepalive: 32},
+			expected: version1.Upstream{
+				Name:             "ext_auth_default_my-auth",
+				UpstreamZoneSize: "256k",
+				Keepalive:        "32",
+				UpstreamServers: []version1.UpstreamServer{
+					{Address: "10.0.0.1:8080", MaxFails: 1, MaxConns: 0, FailTimeout: "10s"},
+				},
+			},
+			warning: false,
+		},
 	}
 
 	for _, test := range tests {
 		t.Run(test.name, func(t *testing.T) {
 			t.Parallel()
-			result, warning := createExternalAuthUpstream(test.upsName, test.endpoints)
+			result, warning := createExternalAuthUpstream(test.upsName, test.endpoints, test.cfgParams)
 			if diff := cmp.Diff(test.expected, result); diff != "" {
 				t.Errorf("createExternalAuthUpstream() mismatch (-want +got):\n%s", diff)
 			}
@@ -5346,11 +5366,13 @@ func TestGenerateIngressExternalAuthLocation(t *testing.T) {
 		ProxyNextUpstreamTimeout: "5s",
 	}
 
-	result := generateIngressExternalAuthLocation(externalAuth, "ext_auth_default_my-auth", cfg)
+	upstream := version1.Upstream{Name: "ext_auth_default_my-auth", Keepalive: "32"}
+	result := generateIngressExternalAuthLocation(externalAuth, upstream, cfg)
 
 	expected := version1.Location{
 		Path:                     "/_ext_auth_default_my-auth",
 		Internal:                 true,
+		Upstream:                 upstream,
 		ProxyPass:                "http://ext_auth_default_my-auth/auth",
 		ProxySetHeaders:          []version2.Header{{Name: "Content-Length", Value: "0"}, {Name: "X-Scheme", Value: "$scheme"}},
 		ProxyConnectTimeout:      "10s",
@@ -5392,11 +5414,13 @@ func TestGenerateIngressExternalAuthOAuth2Location(t *testing.T) {
 		ProxyNextUpstreamTimeout: "5s",
 	}
 
-	result := generateIngressExternalAuthOAuth2Location(externalAuth, "ext_auth_default_my-auth", cfg)
+	upstream := version1.Upstream{Name: "ext_auth_default_my-auth", Keepalive: "32"}
+	result := generateIngressExternalAuthOAuth2Location(externalAuth, upstream, cfg)
 
 	expected := version1.Location{
 		Path:                     "/oauth2",
 		AuthRequestOff:           true,
+		Upstream:                 upstream,
 		ProxyPass:                "http://ext_auth_default_my-auth",
 		ProxySetHeaders:          []version2.Header{{Name: "X-Auth-Request-Redirect", Value: "$request_uri"}, {Name: "X-Scheme", Value: "$scheme"}},
 		ProxyConnectTimeout:      "10s",
@@ -6872,3 +6896,123 @@ func TestGenerateNginxCfgForMergeableIngressesProxyHTTPVersion(t *testing.T) {
 		})
 	}
 }
+
+// TestGenerateNginxCfgKeepalivePerUpstream verifies that nginx.org/keepalive is
+// applied per-upstream (not as a global config-level value), and that in a
+// mergeable master/minion setup:
+//  1. A keepalive annotation on the master is inherited by minions that don't
+//     set their own.
+//  2. A minion's own keepalive annotation overrides the inherited master value.
+//  3. A minion explicitly setting keepalive "0" disables it even when the master
+//     enables it.
+func TestGenerateNginxCfgKeepalivePerUpstream(t *testing.T) {
+	t.Parallel()
+
+	const (
+		coffeeUpstreamName = "default-cafe-ingress-coffee-minion-cafe.example.com-coffee-svc-80"
+		teaUpstreamName    = "default-cafe-ingress-tea-minion-cafe.example.com-tea-svc-80"
+	)
+
+	tests := []struct {
+		name            string
+		masterKeepalive string
+		coffeeKeepalive string // empty = not se
```

**File**: `internal/configs/version1/__snapshots__/template_test.snap` (modified, +133/-0)
```diff
@@ -11653,3 +11653,136 @@ server {
 }
 
 ---
+
+[TestExecuteTemplate_ForIngressForNGINXPlusWithMixedKeepaliveUpstreams - 1]
+# configuration for default/cafe-ingress
+upstream test-no-keepalive {
+    zone test-no-keepalive 256k;
+    server 127.0.0.1:8181 max_fails=0 fail_timeout=1s max_conns=0;
+}
+upstream test-keepalive {
+    zone test-keepalive 256k;
+    server 127.0.0.1:8181 max_fails=0 fail_timeout=1s max_conns=0;keepalive 16;
+}
+
+
+server {
+
+    server_tokens "off";
+
+    server_name test.example.com;
+
+    status_zone "test.example.com";
+    set $resource_type "ingress";
+    set $resource_name "cafe-ingress";
+    set $resource_namespace "default";
+    set $service "-";
+
+    
+
+    
+    location "/no-keepalive" {
+        set $service "";
+        status_zone "";
+
+        proxy_connect_timeout 10s;
+        proxy_read_timeout 10s;
+        proxy_send_timeout 10s;
+        client_max_body_size 2m;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Host $host;
+        proxy_set_header X-Forwarded-Port $server_port;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_buffering off;
+        proxy_pass http://test-no-keepalive;
+        
+    }
+    
+    location "/keepalive" {
+        set $service "";
+        status_zone "";
+        proxy_set_header Connection "";
+
+        proxy_connect_timeout 10s;
+        proxy_read_timeout 10s;
+        proxy_send_timeout 10s;
+        client_max_body_size 2m;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Host $host;
+        proxy_set_header X-Forwarded-Port $server_port;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_buffering off;
+        proxy_pass http://test-keepalive;
+        
+    }
+    
+}
+
+---
+
+[TestExecuteTemplate_ForIngressForNGINXWithMixedKeepaliveUpstreams - 1]
+# configuration for default/cafe-ingress
+upstream test-no-keepalive {
+    zone test-no-keepalive 256k;
+    server 127.0.0.1:8181 max_fails=0 fail_timeout=1s max_conns=0;
+}
+
+upstream test-keepalive {
+    zone test-keepalive 256k;
+    server 127.0.0.1:8181 max_fails=0 fail_timeout=1s max_conns=0;
+    keepalive 16;
+}
+
+
+
+server {
+
+    server_tokens off;
+
+    server_name test.example.com;
+    set $resource_type "ingress";
+    set $resource_name "cafe-ingress";
+    set $resource_namespace "default";
+    set $service "-";
+    location "/no-keepalive" {
+        set $service "";
+        proxy_connect_timeout 10s;
+        proxy_read_timeout 10s;
+        proxy_send_timeout 10s;
+        client_max_body_size 2m;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Host $host;
+        proxy_set_header X-Forwarded-Port $server_port;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_buffering off;
+        proxy_pass http://test-no-keepalive;
+        
+    }
+    
+    location "/keepalive" {
+        set $service "";
+        proxy_set_header Connection "";
+        proxy_connect_timeout 10s;
+        proxy_read_timeout 10s;
+        proxy_send_timeout 10s;
+        client_max_body_size 2m;
+        proxy_set_header Host $host;
+        proxy_set_header X-Real-IP $remote_addr;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Host $host;
+        proxy_set_header X-Forwarded-Port $server_port;
+        proxy_set_header X-Forwarded-Proto $scheme;
+        proxy_buffering off;
+        proxy_pass http://test-keepalive;
+        
+    }
+    
+}
+
+---
```

**File**: `internal/configs/version1/config.go` (modified, +1/-1)
```diff
@@ -17,7 +17,6 @@ type UpstreamLabels struct {
 type IngressNginxConfig struct {
 	Upstreams               []Upstream
 	Servers                 []Server
-	Keepalive               string
 	Maps                    []version2.Map
 	CORSHeaders             []version2.AddHeader
 	OIDCProviders           []version2.OIDCProvider
@@ -45,6 +44,7 @@ type Upstream struct {
 	QueueTimeout     int64
 	UpstreamZoneSize string
 	UpstreamLabels   UpstreamLabels
+	Keepalive        string
 }
 
 // UpstreamServer describes a server in an NGINX upstream.
```

**File**: `internal/configs/version1/nginx-plus.ingress.tmpl` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@ upstream {{$upstream.Name}} {
 	{{- if $upstream.StickyCookie}}
 	sticky cookie {{$upstream.StickyCookie}};
 	{{- end}}
-	{{- if $.Keepalive}}keepalive {{$.Keepalive}};{{end}}
+	{{- if $upstream.Keepalive}}keepalive {{$upstream.Keepalive}};{{end}}
 	{{- if $upstream.UpstreamServers -}}
 	{{- if $upstream.Queue}}
 	queue {{$upstream.Queue}} timeout={{$upstream.QueueTimeout}}s;
@@ -571,7 +571,7 @@ server {
 		proxy_set_header Upgrade $http_upgrade;
 		proxy_set_header Connection $connection_upgrade;
 		{{- else}}
-		{{- if $.Keepalive}}
+		{{- if $location.Upstream.Keepalive}}
 		proxy_set_header Connection "";{{end}}
 		{{- end}}
 		{{- end}}
```

**File**: `internal/configs/version1/nginx.ingress.tmpl` (modified, +3/-3)
```diff
@@ -11,8 +11,8 @@ upstream {{$upstream.Name}} {
 	{{- range $server := $upstream.UpstreamServers}}
 	server {{$server.Address}} max_fails={{$server.MaxFails}} fail_timeout={{$server.FailTimeout}} max_conns={{$server.MaxConns}};
 	{{- end}}
-	{{- if $.Keepalive}}
-	keepalive {{$.Keepalive}};
+	{{- if $upstream.Keepalive}}
+	keepalive {{$upstream.Keepalive}};
 	{{- end}}
 	{{- if $upstream.StickyCookie}}
 	sticky cookie {{$upstream.StickyCookie}};
@@ -357,7 +357,7 @@ server {
 		proxy_set_header Upgrade $http_upgrade;
 		proxy_set_header Connection $connection_upgrade;
 		{{- else}}
-		{{- if $.Keepalive}}
+		{{- if $location.Upstream.Keepalive}}
 		proxy_set_header Connection "";{{end}}
 		{{- end}}
 		{{- end}}
```

**File**: `internal/configs/version1/template_executor_test.go` (modified, +2/-2)
```diff
@@ -479,7 +479,7 @@ upstream {{$upstream.Name}} {
 	{{- if $upstream.StickyCookie}}
 	sticky cookie {{$upstream.StickyCookie}};
 	{{- end}}
-	{{- if $.Keepalive}}keepalive {{$.Keepalive}};{{end}}
+	{{- if $upstream.Keepalive}}keepalive {{$upstream.Keepalive}};{{end}}
 	{{- if $upstream.UpstreamServers -}}
 	{{- if $upstream.Queue}}
 	queue {{$upstream.Queue}} timeout={{$upstream.QueueTimeout}}s;
@@ -843,7 +843,7 @@ server {
 		proxy_set_header Upgrade $http_upgrade;
 		proxy_set_header Connection $connection_upgrade;
 		{{- else}}
-		{{- if $.Keepalive}}
+		{{- if $location.Upstream.Keepalive}}
 		proxy_set_header Connection "";{{end}}
 		{{- end}}
 		{{- end}}
```

---

### Incident Patch 12: `141b1beb` (2026-09-29)
**Commit Message**: Adjust permissions structure in build-test-image workflow (#10977)

**File**: `.github/workflows/build-test-image.yml` (modified, +4/-2)
```diff
@@ -20,14 +20,16 @@ concurrency:
 
 permissions:
   contents: read
-  id-token: write
-  packages: write
 
 jobs:
   build:
     name: Build test image
     if: github.repository == 'nginx/kubernetes-ingress'
     runs-on: ubuntu-24.04
+    permissions:
+      contents: read
+      id-token: write
+      packages: write
     steps:
       - name: Checkout Repository
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

---

### Incident Patch 13: `15b54241` (2026-09-25)
**Commit Message**: Fix nil pointer panic when namespace is no longer watched (#10791)

* Fix nil pointer panic when namespace is no longer watched

# Conflicts:
#	internal/k8s/controller.go
#	internal/k8s/transport_server_test.go

* fix: resolve mangled test from rebase and update error message for namespace not watched

* Fix lint error in appprotect dos test

**File**: `internal/k8s/appprotect_dos.go` (modified, +15/-3)
```diff
@@ -134,7 +134,11 @@ func (lbc *LoadBalancerController) syncAppProtectDosPolicy(task task) {
 	var polExists bool
 	var err error
 
-	obj, polExists, err = lbc.getNamespacedInformer(ns).appProtectDosPolicyLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	obj, polExists, err = nsi.appProtectDosPolicyLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
@@ -164,7 +168,11 @@ func (lbc *LoadBalancerController) syncAppProtectDosLogConf(task task) {
 	var confExists bool
 	var err error
 
-	obj, confExists, err = lbc.getNamespacedInformer(ns).appProtectDosLogConfLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	obj, confExists, err = nsi.appProtectDosLogConfLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
@@ -194,7 +202,11 @@ func (lbc *LoadBalancerController) syncDosProtectedResource(task task) {
 	var confExists bool
 	var err error
 
-	obj, confExists, err = lbc.getNamespacedInformer(ns).appProtectDosProtectedLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	obj, confExists, err = nsi.appProtectDosProtectedLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
```

**File**: `internal/k8s/appprotect_dos_test.go` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+package k8s
+
+import (
+	"context"
+	"testing"
+
+	nl "github.com/nginx/kubernetes-ingress/internal/logger"
+)
+
+// TestAppProtectDosSyncNamespaceNotWatched guards against a nil pointer dereference
+// panic (see getNamespacedInformer) when an AppProtectDos-related task for a namespace
+// that is no longer watched (e.g. its watch-namespace-label was removed) is processed.
+func TestAppProtectDosSyncNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name string
+		sync func(lbc *LoadBalancerController, key string)
+	}{
+		{
+			name: "AppProtectDosPolicy",
+			sync: func(lbc *LoadBalancerController, key string) {
+				lbc.syncAppProtectDosPolicy(task{Kind: appProtectDosPolicy, Key: key})
+			},
+		},
+		{
+			name: "AppProtectDosLogConf",
+			sync: func(lbc *LoadBalancerController, key string) {
+				lbc.syncAppProtectDosLogConf(task{Kind: appProtectDosLogConf, Key: key})
+			},
+		},
+		{
+			name: "DosProtectedResource",
+			sync: func(lbc *LoadBalancerController, key string) {
+				lbc.syncDosProtectedResource(task{Kind: appProtectDosProtectedResource, Key: key})
+			},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(_ *testing.T) {
+			lbc := &LoadBalancerController{
+				namespacedInformers: map[string]*namespacedInformer{},
+				Logger:              nl.LoggerFromContext(context.Background()),
+			}
+			tc.sync(lbc, "not-watched/some-resource")
+		})
+	}
+}
```

**File**: `internal/k8s/appprotect_waf.go` (modified, +15/-3)
```diff
@@ -160,7 +160,11 @@ func (lbc *LoadBalancerController) syncAppProtectPolicy(task task) {
 
 	ns, n, _ := cache.SplitMetaNamespaceKey(key)
 	logger := lbc.Logger.With(logNamespaceKey, ns, logKindKey, appProtectKind, logNameKey, n)
-	obj, polExists, err = lbc.getNamespacedInformer(ns).appProtectPolicyLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	obj, polExists, err = nsi.appProtectPolicyLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
@@ -197,7 +201,11 @@ func (lbc *LoadBalancerController) syncAppProtectLogConf(task task) {
 
 	ns, n, _ := cache.SplitMetaNamespaceKey(key)
 	logger := lbc.Logger.With(logNamespaceKey, ns, logKindKey, appProtectLogConfKind, logNameKey, n)
-	obj, confExists, err = lbc.getNamespacedInformer(ns).appProtectLogConfLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	obj, confExists, err = nsi.appProtectLogConfLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
@@ -234,7 +242,11 @@ func (lbc *LoadBalancerController) syncAppProtectUserSig(task task) {
 
 	ns, n, _ := cache.SplitMetaNamespaceKey(key)
 	logger := lbc.Logger.With(logNamespaceKey, ns, logKindKey, appProtectUserSigKind, logNameKey, n)
-	obj, sigExists, err = lbc.getNamespacedInformer(ns).appProtectUserSigLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	obj, sigExists, err = nsi.appProtectUserSigLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
```

**File**: `internal/k8s/appprotect_waf_test.go` (modified, +41/-0)
```diff
@@ -16,6 +16,47 @@ import (
 	"k8s.io/client-go/tools/cache"
 )
 
+// TestAppProtectSyncNamespaceNotWatched guards against a nil pointer dereference
+// panic (see getNamespacedInformer) when an AppProtect-related task for a namespace
+// that is no longer watched (e.g. its watch-namespace-label was removed) is processed.
+func TestAppProtectSyncNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name string
+		sync func(lbc *LoadBalancerController, key string)
+	}{
+		{
+			name: "AppProtectPolicy",
+			sync: func(lbc *LoadBalancerController, key string) {
+				lbc.syncAppProtectPolicy(task{Kind: appProtectPolicy, Key: key})
+			},
+		},
+		{
+			name: "AppProtectLogConf",
+			sync: func(lbc *LoadBalancerController, key string) {
+				lbc.syncAppProtectLogConf(task{Kind: appProtectLogConf, Key: key})
+			},
+		},
+		{
+			name: "AppProtectUserSig",
+			sync: func(lbc *LoadBalancerController, key string) {
+				lbc.syncAppProtectUserSig(task{Kind: appProtectUserSig, Key: key})
+			},
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(_ *testing.T) {
+			lbc := &LoadBalancerController{
+				namespacedInformers: map[string]*namespacedInformer{},
+				Logger:              nl.LoggerFromContext(context.Background()),
+			}
+			tc.sync(lbc, "not-watched/some-resource")
+		})
+	}
+}
+
 func TestAddWAFPolicyRefs(t *testing.T) {
 	t.Parallel()
 	apPol := &unstructured.Unstructured{
```

**File**: `internal/k8s/controller.go` (modified, +57/-18)
```diff
@@ -1532,7 +1532,11 @@ func (lbc *LoadBalancerController) syncVirtualServer(task task) {
 
 	ns, n, _ := cache.SplitMetaNamespaceKey(key)
 	l := lbc.Logger.With(logNamespaceKey, ns, logKindKey, virtualServerKind, logNameKey, n)
-	obj, vsExists, err = lbc.getNamespacedInformer(ns).virtualServerLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	obj, vsExists, err = nsi.virtualServerLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
@@ -1793,9 +1797,11 @@ func (lbc *LoadBalancerController) processDelete(c ResourceChange) {
 		var vsExists bool
 		var err error
 
-		_, vsExists, err = lbc.getNamespacedInformer(ns).virtualServerLister.GetByKey(key)
-		if err != nil {
-			nl.Errorf(l, "Error when getting VirtualServer for %v: %v", key, err)
+		if nsi := lbc.getNamespacedInformer(ns); nsi != nil {
+			_, vsExists, err = nsi.virtualServerLister.GetByKey(key)
+			if err != nil {
+				nl.Errorf(l, "Error when getting VirtualServer for %v: %v", key, err)
+			}
 		}
 
 		if vsExists {
@@ -1816,9 +1822,11 @@ func (lbc *LoadBalancerController) processDelete(c ResourceChange) {
 		var ingExists bool
 		var err error
 
-		_, ingExists, err = lbc.getNamespacedInformer(ns).ingressLister.GetByKeySafe(key)
-		if err != nil {
-			nl.Errorf(l, "Error when getting Ingress for %v: %v", key, err)
+		if nsi := lbc.getNamespacedInformer(ns); nsi != nil {
+			_, ingExists, err = nsi.ingressLister.GetByKeySafe(key)
+			if err != nil {
+				nl.Errorf(l, "Error when getting Ingress for %v: %v", key, err)
+			}
 		}
 
 		if ingExists {
@@ -1838,9 +1846,11 @@ func (lbc *LoadBalancerController) processDelete(c ResourceChange) {
 		var tsExists bool
 		var err error
 
-		_, tsExists, err = lbc.getNamespacedInformer(ns).transportServerLister.GetByKey(key)
-		if err != nil {
-			nl.Errorf(l, "Error when getting TransportServer for %v: %v", key, err)
+		if nsi := lbc.getNamespacedInformer(ns); nsi != nil {
+			_, tsExists, err = nsi.transportServerLister.GetByKey(key)
+			if err != nil {
+				nl.Errorf(l, "Error when getting TransportServer for %v: %v", key, err)
+			}
 		}
 		if tsExists {
 			lbc.updateTransportServerStatusAndEventsOnDelete(impl, c.Error, deleteErr)
@@ -2173,7 +2183,11 @@ func (lbc *LoadBalancerController) syncVirtualServerRoute(task task) {
 
 	ns, n, _ := cache.SplitMetaNamespaceKey(key)
 	l := lbc.Logger.With(logNamespaceKey, ns, logKindKey, virtualServerRouteKind, logNameKey, n)
-	obj, exists, err = lbc.getNamespacedInformer(ns).virtualServerRouteLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	obj, exists, err = nsi.virtualServerRouteLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
@@ -2345,7 +2359,11 @@ func (lbc *LoadBalancerController) syncIngress(task task) {
 
 	ns, n, _ := cache.SplitMetaNamespaceKey(key)
 	l := lbc.Logger.With(logNamespaceKey, ns, logKindKey, ingressKind, logNameKey, n)
-	ing, ingExists, err = lbc.getNamespacedInformer(ns).ingressLister.GetByKeySafe(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return
+	}
+	ing, ingExists, err = nsi.ingressLister.GetByKeySafe(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
@@ -2602,7 +2620,11 @@ func (lbc *LoadBalancerController) syncSecret(task task) {
 		return
 	}
 	l := lbc.Logger.With(logNamespaceKey, namespace, logKindKey, secretKind, logNameKey, name)
-	obj, secretWatched, err = lbc.getNamespacedInformer(namespace).secretLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(namespace)
+	if nsi == nil {
+		return
+	}
+	obj, secretWatched, err = nsi.secretLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return
@@ -4483,7 +4505,12 @@ func (lbc *LoadBalancerController) getExternalEndpointsForIngressBackend(backend
 
 func (lbc *LoadBalancerController) getEndpointsForIngressBackend(backend *networking.IngressBackend, svc *api_v1.Service) (result []podEndpoint, isExternal bool, err error) {
 	var endpointSlices []discovery_v1.EndpointSlice
-	endpointSlices, err = lbc.getNamespacedInformer(svc.Namespace).endpointSliceLister.GetServiceEndpointSlices(svc)
+	nsi := lbc.getNamespacedInformer(svc.Namespace)
+	if nsi == nil {
+		err = fmt.Errorf("namespace %s is not watched", svc.Namespace)
+	} else {
+		endpointSlices, err = nsi.endpointSliceLister.GetServiceEndpointSlices(svc)
+	}
 	if err != nil {
 		if svc.Spec.Type == api_v1.ServiceTypeExternalName {
 			if !lbc.isNginxPlus {
@@ -4555,7 +4582,11 @@ func (lbc *LoadBalancerController) getPodOwnerTypeAndNameFromAddress(ns, name st
 	var exists bool
 	var err error
 
-	obj, exists, err = lbc.getNamespacedInformer(ns).podLister.GetByKey(fmt.Sprintf("%s/%s", ns, name))
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return "", ""
+	}
+	obj, exists, err = nsi.podLister.GetByKey(fmt.Sprintf("%s/%s", ns, name))
 	if err != nil {
 		nl.Warnf(lbc.Logger, "could not get pod by key %s/%s: %v
```

**File**: `internal/k8s/controller_test.go` (modified, +173/-0)
```diff
@@ -2777,6 +2777,179 @@ func TestProcessChangesDispatchesDelete(t *testing.T) {
 	})
 }
 
+// The following tests guard against a nil pointer dereference panic (see
+// getNamespacedInformer) when a resource for a namespace that is no longer watched
+// (e.g. its watch-namespace-label was removed) is processed.
+
+func TestProcessDeleteNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	newLBC := func(t *testing.T) *LoadBalancerController {
+		t.Helper()
+		manager := nginx.NewFakeManager("/etc/nginx")
+		return &LoadBalancerController{
+			configurator:        createTestPolicySyncConfigurator(t, manager),
+			recorder:            record.NewFakeRecorder(100),
+			secretStore:         secrets.NewEmptyFakeSecretsStore(),
+			namespacedInformers: map[string]*namespacedInformer{},
+			Logger:              nl.LoggerFromContext(context.Background()),
+		}
+	}
+
+	t.Run("Ingress", func(t *testing.T) {
+		t.Parallel()
+		lbc := newLBC(t)
+		ing := createTestIngress("not-watched-ingress", "example.com")
+		lbc.processDelete(ResourceChange{Op: Delete, Resource: NewRegularIngressConfiguration(ing)})
+	})
+
+	t.Run("VirtualServer", func(t *testing.T) {
+		t.Parallel()
+		lbc := newLBC(t)
+		vs := createTestVirtualServer("not-watched-vs", "example.com")
+		lbc.processDelete(ResourceChange{
+			Op: Delete,
+			Resource: &VirtualServerConfiguration{
+				VirtualServer:               vs,
+				VirtualServerRouteSelectors: map[string][]string{},
+			},
+		})
+	})
+
+	t.Run("TransportServer", func(t *testing.T) {
+		t.Parallel()
+		lbc := newLBC(t)
+		ts := createTestTLSPassthroughTransportServer("not-watched-ts", "example.com")
+		lbc.processDelete(ResourceChange{
+			Op:       Delete,
+			Resource: &TransportServerConfiguration{TransportServer: ts},
+		})
+	})
+}
+
+func TestSyncVirtualServerNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	lbc := &LoadBalancerController{
+		namespacedInformers: map[string]*namespacedInformer{},
+		Logger:              nl.LoggerFromContext(context.Background()),
+	}
+	lbc.syncVirtualServer(task{Kind: virtualserver, Key: "not-watched/some-vs"})
+}
+
+func TestSyncVirtualServerRouteNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	lbc := &LoadBalancerController{
+		namespacedInformers: map[string]*namespacedInformer{},
+		Logger:              nl.LoggerFromContext(context.Background()),
+	}
+	lbc.syncVirtualServerRoute(task{Kind: virtualServerRoute, Key: "not-watched/some-vsr"})
+}
+
+func TestSyncIngressNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	lbc := &LoadBalancerController{
+		namespacedInformers: map[string]*namespacedInformer{},
+		Logger:              nl.LoggerFromContext(context.Background()),
+	}
+	lbc.syncIngress(task{Kind: ingress, Key: "not-watched/some-ingress"})
+}
+
+func TestSyncSecretNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	lbc := &LoadBalancerController{
+		namespacedInformers: map[string]*namespacedInformer{},
+		Logger:              nl.LoggerFromContext(context.Background()),
+	}
+	lbc.syncSecret(task{Kind: secret, Key: "not-watched/some-secret"})
+}
+
+func TestGetServiceForIngressBackendNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	lbc := &LoadBalancerController{
+		namespacedInformers: map[string]*namespacedInformer{},
+		Logger:              nl.LoggerFromContext(context.Background()),
+	}
+
+	backend := &networking.IngressBackend{
+		Service: &networking.IngressServiceBackend{Name: "some-service"},
+	}
+	svc, err := lbc.getServiceForIngressBackend(backend, "not-watched")
+	if svc != nil {
+		t.Errorf("getServiceForIngressBackend() returned %v, expected nil", svc)
+	}
+	if err == nil {
+		t.Error("getServiceForIngressBackend() returned nil error, expected an error for an unwatched namespace")
+	}
+}
+
+func TestGetEndpointsForIngressBackendNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	lbc := &LoadBalancerController{
+		namespacedInformers: map[string]*namespacedInformer{},
+		Logger:              nl.LoggerFromContext(context.Background()),
+	}
+
+	backend := &networking.IngressBackend{
+		Service: &networking.IngressServiceBackend{Name: "some-service"},
+	}
+	svc := &api_v1.Service{
+		ObjectMeta: meta_v1.ObjectMeta{Name: "some-service", Namespace: "not-watched"},
+	}
+	result, isExternal, err := lbc.getEndpointsForIngressBackend(backend, svc)
+	if result != nil {
+		t.Errorf("getEndpointsForIngressBackend() returned %v, expected nil", result)
+	}
+	if isExternal {
+		t.Error("getEndpointsForIngressBackend() returned isExternal=true, expected false for an unwatched namespace")
+	}
+	if err == nil {
+		t.Error("getEndpointsForIngressBackend() returned nil error, expected an error for an unwatched namespace")
+	}
+}
+
+func TestGetTargetPortNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	lbc := &LoadBalancerController{
+		namespacedInformers: map[string]*namespacedInformer{},
+		Logger:              nl.LoggerFromContext(context.Background()),
+	}
+
+	svcPort := api_v1.ServicePort{
+		TargetPort: intstr.FromStr
```

**File**: `internal/k8s/endpoint_slice.go` (modified, +5/-1)
```diff
@@ -67,7 +67,11 @@ func (lbc *LoadBalancerController) syncEndpointSlices(task task) bool {
 	var resourcesFound bool
 
 	ns, n, _ := cache.SplitMetaNamespaceKey(key)
-	obj, endpointSliceExists, err = lbc.getNamespacedInformer(ns).endpointSliceLister.GetByKey(key)
+	nsi := lbc.getNamespacedInformer(ns)
+	if nsi == nil {
+		return false
+	}
+	obj, endpointSliceExists, err = nsi.endpointSliceLister.GetByKey(key)
 	if err != nil {
 		lbc.syncQueue.Requeue(task, err)
 		return false
```

**File**: `internal/k8s/endpoint_slice_test.go` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+package k8s
+
+import (
+	"context"
+	"testing"
+
+	nl "github.com/nginx/kubernetes-ingress/internal/logger"
+)
+
+// TestSyncEndpointSlicesNamespaceNotWatched guards against a nil pointer dereference
+// panic (see getNamespacedInformer) when an EndpointSlice task for a namespace that is
+// no longer watched (e.g. its watch-namespace-label was removed) is processed.
+func TestSyncEndpointSlicesNamespaceNotWatched(t *testing.T) {
+	t.Parallel()
+
+	lbc := &LoadBalancerController{
+		namespacedInformers: map[string]*namespacedInformer{},
+		Logger:              nl.LoggerFromContext(context.Background()),
+	}
+
+	result := lbc.syncEndpointSlices(task{Kind: endpointslice, Key: "not-watched/some-endpointslice"})
+	if result {
+		t.Errorf("syncEndpointSlices() = %v, expected false for an unwatched namespace", result)
+	}
+}
```

---

### Incident Patch 14: `cfa8fb9f` (2026-09-22)
**Commit Message**: Fix/cors origin port validation redo 9861 (#10897)

* fix: validate CORS origin port ranges

* Reuse validation.IsValidPortNum

* Add cors origin cel validation

* Revert "Add cors origin cel validation"

This reverts commit 6973abf1b9fe7234a4cfe34c70c892eed28a72e8.

---------

Co-authored-by: immanuwell <[REDACTED_EMAIL]>

**File**: `pkg/apis/configuration/validation/policy.go` (modified, +24/-3)
```diff
@@ -1673,6 +1673,10 @@ func validateOriginFormat(origin string) error {
 		return validateWildcardOriginHost(origin, host)
 	}
 
+	if err := validateOriginPort(parsedOrigin.Port(), origin); err != nil {
+		return err
+	}
+
 	return validateExactOriginHost(host)
 }
 
@@ -1720,9 +1724,8 @@ func validateWildcardOriginHost(origin, host string) error {
 		if port == "" {
 			return fmt.Errorf("port cannot be empty when colon is present (invalid: %s)", origin)
 		}
-		// Validate port is numeric and in valid range
-		if _, err := strconv.Atoi(port); err != nil {
-			return fmt.Errorf("port must be numeric (invalid: %s)", origin)
+		if err := validateOriginPort(port, origin); err != nil {
+			return err
 		}
 	}
 
@@ -1734,6 +1737,24 @@ func validateWildcardOriginHost(origin, host string) error {
 	return nil
 }
 
+func validateOriginPort(port, origin string) error {
+	if port == "" {
+		return nil
+	}
+
+	portNum, err := strconv.Atoi(port)
+	if err != nil {
+		return fmt.Errorf("port must be numeric (invalid: %s)", origin)
+	}
+
+	errs := validation.IsValidPortNum(portNum)
+	if len(errs) > 0 {
+		return fmt.Errorf("port number out of range: %s", errs[0])
+	}
+
+	return nil
+}
+
 func validateExactOriginHost(host string) error {
 	// For exact origins, basic validation that host is not empty
 	if host == "" {
```

**File**: `pkg/apis/configuration/validation/policy_test.go` (modified, +16/-0)
```diff
@@ -4043,6 +4043,22 @@ func TestValidateCORS(t *testing.T) {
 			expectErr: true,
 			errMsg:    "origin must not include @",
 		},
+		{
+			name: "Invalid exact origin - out-of-range port",
+			cors: &v1.CORS{
+				AllowOrigin: []string{"https://example.com:99999"},
+			},
+			expectErr: true,
+			errMsg:    "port number out of range: must be between 1 and 65535, inclusive",
+		},
+		{
+			name: "Invalid wildcard origin - out-of-range port",
+			cors: &v1.CORS{
+				AllowOrigin: []string{"https://*.example.com:99999"},
+			},
+			expectErr: true,
+			errMsg:    "port number out of range: must be between 1 and 65535, inclusive",
+		},
 		{
 			name: "Invalid header name - non-RFC compliant",
 			cors: &v1.CORS{
```

---

### Incident Patch 15: `e0ca90d6` (2026-09-22)
**Commit Message**: implement setting otel_trace_context NGINX directive via configmap (#10843)

* feat: add support for configuring otel-trace-context via ConfigMap

Signed-off-by: Adrian Berger <[REDACTED_EMAIL]>

* fix: correct OTel load_module expectation and extend template tests to OSS

Signed-off-by: Adrian Berger <[REDACTED_EMAIL]>

* Remove unreachable test configuration

Otel can't be configured to:

- load module true
- endpoint empty

* Remove snaps for removed tests

* Fix a test case to test the context setting

* Make otel-trace-context dependent on endpoint

* Clear set value if no endpoint exists

* Add propagate positive test

* Add configparams -> mainconfig handoff test

* remove extra unneeded line break

Co-authored-by: Haywood Shannon <[REDACTED_EMAIL]>
Signed-off-by: Gabor Javorszky <[REDACTED_EMAIL]>

* Update snap tests

* Add otel_trace_context to pytests

---------

Signed-off-by: Adrian Berger <[REDACTED_EMAIL]>
Signed-off-by: Gabor Javorszky <[REDACTED_EMAIL]>
Co-authored-by: Adrian Berger <[REDACTED_EMAIL]>
Co-authored-by: Adrian Berger <[REDACTED_EMAIL]>
Co-authored-by: Haywood Shannon <[REDACTED_EMAIL]>

**File**: `examples/shared-examples/otel/nginx-config.yaml` (modified, +1/-0)
```diff
@@ -9,3 +9,4 @@ data:
   otel-exporter-header-name: "x-otel-header"
   otel-exporter-header-value: "otel-header-value"
   # otel-trace-in-http: "true" # Uncomment to enable tracing at the HTTP level
+  # otel-trace-context: "propagate" # Uncomment to control W3C trace-context header propagation (extract|inject|propagate|ignore)
```

**File**: `internal/configs/config_params.go` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ type ConfigParams struct {
 	MainOtelExporterHeaderName             string
 	MainOtelExporterHeaderValue            string
 	MainOtelServiceName                    string
+	MainOtelTraceContext                   string
 	MainServerNamesHashBucketSize          string
 	MainServerNamesHashMaxSize             string
 	MainStreamLogFormat                    []string
```

**File**: `internal/configs/configmaps.go` (modified, +20/-0)
```diff
@@ -994,6 +994,23 @@ func parseConfigMapOpenTelemetry(l *slog.Logger, cfgm *v1.ConfigMap, cfgParams *
 		cfgParams.MainOtelTraceInHTTP = otelTraceInHTTP
 	}
 
+	if otelTraceContext, exists := cfgm.Data["otel-trace-context"]; exists {
+		otelTraceContext = strings.TrimSpace(otelTraceContext)
+		switch otelTraceContext {
+		case "extract", "inject", "propagate", "ignore":
+			cfgParams.MainOtelTraceContext = otelTraceContext
+		case "":
+		default:
+			errorText := fmt.Sprintf(
+				"ConfigMap %s/%s: invalid value for 'otel-trace-context': %q, must be one of 'extract', 'inject', 'propagate', 'ignore'",
+				cfgm.GetNamespace(), cfgm.GetName(), otelTraceContext,
+			)
+			nl.Error(l, errorText)
+			eventLog.Event(cfgm, v1.EventTypeWarning, nl.EventReasonInvalidValue, errorText)
+			otelValid = false
+		}
+	}
+
 	if (cfgParams.MainOtelExporterHeaderName != "" && cfgParams.MainOtelExporterHeaderValue == "") ||
 		(cfgParams.MainOtelExporterHeaderName == "" && cfgParams.MainOtelExporterHeaderValue != "") {
 		cfgParams.MainOtelExporterHeaderName = ""
@@ -1012,13 +1029,15 @@ func parseConfigMapOpenTelemetry(l *slog.Logger, cfgm *v1.ConfigMap, cfgParams *
 		(cfgParams.MainOtelExporterHeaderName != "" ||
 			cfgParams.MainOtelExporterHeaderValue != "" ||
 			cfgParams.MainOtelServiceName != "" ||
+			cfgParams.MainOtelTraceContext != "" ||
 			cfgParams.MainOtelTraceInHTTP) {
 		errorText := "ConfigMap key 'otel-exporter-endpoint' is required when other otel fields are set"
 		nl.Error(l, errorText)
 		eventLog.Event(cfgm, v1.EventTypeWarning, nl.EventReasonInvalidValue, errorText)
 		otelValid = false
 		cfgParams.MainOtelTraceInHTTP = false
 		cfgParams.MainOtelExporterHeaderName = ""
+		cfgParams.MainOtelTraceContext = ""
 		cfgParams.MainOtelExporterHeaderValue = ""
 		cfgParams.MainOtelServiceName = ""
 	}
@@ -1238,6 +1257,7 @@ func GenerateNginxMainConfig(staticCfgParams *StaticConfigParams, config *Config
 		MainOtelExporterHeaderName:         config.MainOtelExporterHeaderName,
 		MainOtelExporterHeaderValue:        config.MainOtelExporterHeaderValue,
 		MainOtelServiceName:                config.MainOtelServiceName,
+		MainOtelTraceContext:               config.MainOtelTraceContext,
 		ProxyProtocol:                      config.ProxyProtocol,
 		ResolverAddresses:                  config.ResolverAddresses,
 		ResolverIPV6:                       config.ResolverIPV6,
```

**File**: `internal/configs/configmaps_test.go` (modified, +94/-0)
```diff
@@ -1948,6 +1948,7 @@ func TestOpenTelemetryConfigurationSuccess(t *testing.T) {
 		expectedExporterHeaderValue string
 		expectedServiceName         string
 		expectedTraceInHTTP         bool
+		expectedTraceContext        string
 		msg                         string
 	}{
 		{
@@ -2023,6 +2024,55 @@ func TestOpenTelemetryConfigurationSuccess(t *testing.T) {
 			expectedTraceInHTTP:         false,
 			msg:                         "no config",
 		},
+
+		{
+			configMap: &v1.ConfigMap{
+				Data: map[string]string{
+					"otel-exporter-endpoint": "https://otel-collector:4317",
+					"otel-trace-context":     "extract",
+				},
+			},
+			expectedLoadModule:       true,
+			expectedExporterEndpoint: "https://otel-collector:4317",
+			expectedTraceContext:     "extract",
+			msg:                      "endpoint set with trace context extract",
+		},
+		{
+			configMap: &v1.ConfigMap{
+				Data: map[string]string{
+					"otel-trace-context":     "inject",
+					"otel-exporter-endpoint": "https://otel-collector:4317",
+				},
+			},
+			expectedLoadModule:       true,
+			expectedExporterEndpoint: "https://otel-collector:4317",
+			expectedTraceContext:     "inject",
+			msg:                      "trace context inject",
+		},
+		{
+			configMap: &v1.ConfigMap{
+				Data: map[string]string{
+					"otel-trace-context":     "ignore",
+					"otel-exporter-endpoint": "https://otel-collector:4317",
+				},
+			},
+			expectedLoadModule:       true,
+			expectedExporterEndpoint: "https://otel-collector:4317",
+			expectedTraceContext:     "ignore",
+			msg:                      "trace context ignore",
+		},
+		{
+			configMap: &v1.ConfigMap{
+				Data: map[string]string{
+					"otel-trace-context":     "propagate",
+					"otel-exporter-endpoint": "https://otel-collector:4317",
+				},
+			},
+			expectedLoadModule:       true,
+			expectedExporterEndpoint: "https://otel-collector:4317",
+			expectedTraceContext:     "propagate",
+			msg:                      "trace context propagate",
+		},
 	}
 
 	isPlus := true
@@ -2057,10 +2107,27 @@ func TestOpenTelemetryConfigurationSuccess(t *testing.T) {
 			if result.MainOtelTraceInHTTP != test.expectedTraceInHTTP {
 				t.Errorf("MainOtelTraceInHTTP: want %v, got %v", test.expectedTraceInHTTP, result.MainOtelTraceInHTTP)
 			}
+			if result.MainOtelTraceContext != test.expectedTraceContext {
+				t.Errorf("MainOtelTraceContext: want %q, got %q", test.expectedTraceContext, result.MainOtelTraceContext)
+			}
 		})
 	}
 }
 
+func TestGenerateNginxMainConfigWithOtelTraceContext(t *testing.T) {
+	t.Parallel()
+
+	mainCfg := GenerateNginxMainConfig(
+		&StaticConfigParams{},
+		&ConfigParams{MainOtelTraceContext: "propagate"},
+		nil,
+	)
+
+	if mainCfg.MainOtelTraceContext != "propagate" {
+		t.Errorf("MainOtelTraceContext: want %q, got %q", "propagate", mainCfg.MainOtelTraceContext)
+	}
+}
+
 func TestOpenTelemetryConfigurationInvalid(t *testing.T) {
 	t.Parallel()
 	tests := []struct {
@@ -2071,6 +2138,7 @@ func TestOpenTelemetryConfigurationInvalid(t *testing.T) {
 		expectedExporterHeaderValue string
 		expectedServiceName         string
 		expectedTraceInHTTP         bool
+		expectedTraceContext        string
 		msg                         string
 	}{
 		{
@@ -2255,6 +2323,29 @@ func TestOpenTelemetryConfigurationInvalid(t *testing.T) {
 			expectedTraceInHTTP:         false,
 			msg:                         "invalid, subdomain is more than 63 characters long",
 		},
+		{
+			configMap: &v1.ConfigMap{
+				Data: map[string]string{
+					"otel-trace-context": "propagate",
+				},
+			},
+			expectedLoadModule:       false,
+			expectedExporterEndpoint: "",
+			expectedTraceContext:     "",
+			msg:                      "trace context set without an exporter endpoint",
+		},
+		{
+			configMap: &v1.ConfigMap{
+				Data: map[string]string{
+					"otel-exporter-endpoint": "https://otel-collector:4317",
+					"otel-trace-context":     "not-a-real-value",
+				},
+			},
+			expectedExporterEndpoint: "https://otel-collector:4317",
+			expectedLoadModule:       true,
+			expectedTraceContext:     "",
+			msg:                      "partially invalid, trace context value not recognized",
+		},
 	}
 
 	isPlus := false
@@ -2289,6 +2380,9 @@ func TestOpenTelemetryConfigurationInvalid(t *testing.T) {
 			if result.MainOtelTraceInHTTP != test.expectedTraceInHTTP {
 				t.Errorf("MainOtelTraceInHTTP: want %v, got %v", test.expectedTraceInHTTP, result.MainOtelTraceInHTTP)
 			}
+			if result.MainOtelTraceContext != test.expectedTraceContext {
+				t.Errorf("MainOtelTraceContext: want %q, got %q", test.expectedTraceContext, result.MainOtelTraceContext)
+			}
 		})
 	}
 }
```

**File**: `internal/configs/version1/__snapshots__/template_test.snap` (modified, +382/-28)
```diff
@@ -7356,6 +7356,279 @@ stream {
     
     
 
+    map_hash_max_size ;
+    
+    include /etc/nginx/stream-conf.d/*.conf;
+}
+
+mgmt {
+    license_token /license.jwt;
+    enforce_initial_report off;
+    deployment_context /etc/nginx/reporting/tracking.info;
+}
+
+---
+
+[TestExecuteTemplate_ForMainForNGINXPlusWithOtel - 1]
+worker_processes  ;
+
+daemon off;
+
+error_log  stderr ;
+pid        /var/lib/nginx/nginx.pid;
+load_module modules/ngx_otel_module.so;
+load_module modules/ngx_fips_check_module.so;
+
+load_module modules/ngx_http_js_module.so;
+
+events {
+    worker_connections  ;
+}
+
+http {
+    include       /etc/nginx/mime.types;
+    default_type  application/octet-stream;
+    map_hash_max_size ;
+    map_hash_bucket_size ;
+
+    js_import /etc/nginx/njs/apikey_auth.js;
+    js_set $apikey_auth_hash apikey_auth.hash;
+
+    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
+                      '$status $body_bytes_sent "$http_referer" '
+                      '"$http_user_agent" "$http_x_forwarded_for"';
+
+    map $upstream_trailer_grpc_status $grpc_status {
+        default $upstream_trailer_grpc_status;
+        '' $sent_http_grpc_status;
+    }
+
+    access_log ;
+
+    sendfile        on;
+    #tcp_nopush     on;
+
+    keepalive_timeout ;
+    keepalive_requests 0;
+
+    #gzip  on;
+
+    server_names_hash_max_size ;
+    
+
+    variables_hash_bucket_size 0;
+    variables_hash_max_size 0;
+
+    map $request_uri $request_uri_no_args {
+        "~^(?P<path>[^?]*)(\?.*)?$" $path;
+    }
+
+    map $http_upgrade $connection_upgrade {
+        default upgrade;
+        ''      close;
+    }
+    map $http_upgrade $default_connection_header {
+        default "";
+    }
+    map $http_host $resource_type {
+        default "";
+    }
+    map $http_host $resource_name {
+        default "";
+    }
+    map $http_host $resource_namespace {
+        default "";
+    }
+    map $http_host $service {
+        default "";
+    }
+    map $http_upgrade $vs_connection_header {
+        default upgrade;
+        ''      $default_connection_header;
+    }
+    otel_exporter {
+        endpoint https://otel-collector:4317;
+        header X-Custom-Header "custom-value";
+    }
+
+    
+    otel_service_name nginx-ingress-controller:nginx;
+    
+    otel_trace on;
+    otel_trace_context inject;
+
+    
+    
+
+    # NGINX Plus API over unix socket
+    server {
+        listen unix:/var/lib/nginx/nginx-plus-api.sock;
+        access_log off;
+
+        # $config_version_mismatch is defined in /etc/nginx/config-version.conf
+        location /configVersionCheck {
+            if ($config_version_mismatch) {
+                return 503;
+            }
+            return 200;
+        }
+
+        location /api {
+            api write=on;
+        }
+    }
+
+    include /etc/nginx/config-version.conf;
+    include /etc/nginx/conf.d/*.conf;
+
+    server {
+        listen unix:/var/lib/nginx/nginx-418-server.sock;
+        access_log off;
+
+        return 418;
+    }
+}
+
+stream {
+    log_format  stream-main  '$remote_addr [$time_local] '
+                      '$protocol $status $bytes_sent $bytes_received '
+                      '$session_time "$ssl_preread_server_name"';
+
+    access_log  /dev/stdout  stream-main;
+    
+    
+
+    map_hash_max_size ;
+    
+    include /etc/nginx/stream-conf.d/*.conf;
+}
+
+mgmt {
+    license_token /license.jwt;
+    enforce_initial_report off;
+    deployment_context /etc/nginx/reporting/tracking.info;
+}
+
+---
+
+[TestExecuteTemplate_ForMainForNGINXPlusWithOtelTraceContextModuleDisabled - 1]
+worker_processes  ;
+
+daemon off;
+
+error_log  stderr ;
+pid        /var/lib/nginx/nginx.pid;
+load_module modules/ngx_fips_check_module.so;
+
+load_module modules/ngx_http_js_module.so;
+
+events {
+    worker_connections  ;
+}
+
+http {
+    include       /etc/nginx/mime.types;
+    default_type  application/octet-stream;
+    map_hash_max_size ;
+    map_hash_bucket_size ;
+
+    js_import /etc/nginx/njs/apikey_auth.js;
+    js_set $apikey_auth_hash apikey_auth.hash;
+
+    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
+                      '$status $body_bytes_sent "$http_referer" '
+                      '"$http_user_agent" "$http_x_forwarded_for"';
+
+    map $upstream_trailer_grpc_status $grpc_status {
+        default $upstream_trailer_grpc_status;
+        '' $sent_http_grpc_status;
+    }
+
+    access_log ;
+
+    sendfile        on;
+    #tcp_nopush     on;
+
+    keepalive_timeout ;
+    keepalive_requests 0;
+
+    #gzip  on;
+
+    server_names_hash_max_size ;
+    
+
+    variables_hash_bucket_size 0;
+    variables_hash_max_size 0;
+
+    map $request_uri $request_uri_no_args {
+        "~^(?P<path>[^?]*)(\?.*)?$" $path;
+    }
+
+    map $http_upgrade $connection_upgrade {
+        default upgrade;
+        ''      close;
+    }
+    map $http_upgrade $default_connection_header {
+ 
```

**File**: `internal/configs/version1/config.go` (modified, +1/-0)
```diff
@@ -336,6 +336,7 @@ type MainConfig struct {
 	MainOtelExporterHeaderName         string
 	MainOtelExporterHeaderValue        string
 	MainOtelServiceName                string
+	MainOtelTraceContext               string
 	ProxyProtocol                      bool
 	ResolverAddresses                  []string
 	ResolverIPV6                       bool
```

**File**: `internal/configs/version1/nginx-plus.tmpl` (modified, +3/-0)
```diff
@@ -183,6 +183,9 @@ http {
     {{ if .MainOtelGlobalTraceEnabled }}
     otel_trace on;
     {{- end}}
+    {{- if .MainOtelTraceContext}}
+    otel_trace_context {{ .MainOtelTraceContext }};
+    {{- end}}
     {{- end}}
 
     {{ $resolverIPV6HTTPBool := boolToPointerBool .ResolverIPV6 -}}
```

**File**: `internal/configs/version1/nginx.tmpl` (modified, +3/-0)
```diff
@@ -144,6 +144,9 @@ http {
     {{- if .MainOtelGlobalTraceEnabled }}
     otel_trace on;
     {{- end}}
+    {{- if .MainOtelTraceContext}}
+    otel_trace_context {{ .MainOtelTraceContext }};
+    {{- end}}
     {{- end}}
     {{- if .NginxStatus}}
     # stub_status
```

#### Recent Merged Pull Requests:
- **PR #11041** (closed): DO NOT MERGE feat: add additional controller Services to the Helm chart (@nic-create-pr[bot])
- **PR #11038** (closed): DO NOT MERGE Warn when routeSelector matches no VirtualServerRoutes (@nic-create-pr[bot])
- **PR #11037** (closed): DO NOT MERGE fix(helm): emit default listener ports when custom resources are disabled (@nic-create-pr[bot])
- **PR #11035** (2026-10-05): Update python:3.14-trixie Docker digest to d0ef532 (main) (@renovate[bot])
- **PR #11034** (2026-10-05): Update github actions (release-2026-lts) (@renovate[bot])
- **PR #11033** (2026-10-05): Update python dependencies (release-2026-lts) (@renovate[bot])
- **PR #11032** (2026-10-05): Update github actions (release-5.6) (@renovate[bot])
- **PR #11031** (2026-10-05): Update python dependencies (release-5.6) (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
