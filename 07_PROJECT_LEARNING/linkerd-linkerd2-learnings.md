# Forensic Learning Record (Deep Inspection): linkerd/linkerd2

> **Canonical Artifact**: `07_PROJECT_LEARNING/linkerd-linkerd2-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/linkerd/linkerd2](https://github.com/linkerd/linkerd2))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:56:07.689Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `linkerd/linkerd2`
- **Description**: Ultralight, security-first service mesh for Kubernetes. Main repo for Linkerd 2.x.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: Cargo.toml, go.mod, README.md
- **Stars / Engagement**: 11508 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/cmd/inject_util.go`
```
package cmd

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/linkerd/linkerd2/pkg/inject"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	yamlDecoder "k8s.io/apimachinery/pkg/util/yaml"
	"sigs.k8s.io/yaml"
)

type resourceTransformer interface {
	transform([]byte) ([]byte, []inject.Report, error)
	generateReport([]inject.Report, io.Writer)
}

// Returns the integer representation of os.Exit code; 0 on success and 1 on failure.
func transformInput(inputs []io.Reader, errWriter, outWriter io.Writer, rt resourceTransformer, format string) int {
	postInjectBuf := &bytes.Buffer{}
	reportBuf := &bytes.Buffer{}

	for _, input := range inputs {
		errs := processYAML(input, postInjectBuf, reportBuf, rt, format)
		if len(errs) > 0 {
			fmt.Fprintf(errWriter, "Error transforming resources:\n%v", concatErrors(errs, "\n"))
			return 1
		}

		_, err := io.Copy(outWriter, postInjectBuf)

		// print error report after yaml output, for better visibility
		io.Copy(errWriter, reportBuf)

		if err != nil {
			fmt.Fprintf(errWriter, "Error printing YAML: %v\n", err)
			return 1
		}
	}
	return 0
}

// processYAML takes an input stream of YAML, outputting injected/uninjected YAML to out.
func processYAML(in io.Reader, out io.Writer, report io.Writer, rt resourceTransformer, format string) []error {
	reader := yamlDecoder.NewYAMLReader(bufio.NewReaderSize(in, 4096))

	reports := []inject.Report{}

	errs := []error{}

	// Iterate over all YAML objects in the input
	for {
		// Read a single YAML object
		bytes, err := reader.Read()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return []error{err}
		}

		var result []byte
		var irs []inject.Report

		isList, err := kindIsList(bytes)
		if err != nil {
			return []error{err}
		}
		if isList {
			result, irs, err = processList(bytes, rt)
		} else {
			result, irs, err = rt.transform(bytes)
		}
		if err != nil {
			errs = append(errs, err)
		}
		reports = append(reports, irs...)

		// If the format is set to json, we need to convert the yaml to json
		if format == jsonOutput {
			result, err = yaml.YAMLToJSON(result)
			if err != nil {
				errs = append(errs, err)
			}
		} else if format == yamlOutput {
			// result is already in yaml format: noop.
		} else {
			errs = append(errs, fmt.Errorf("unsupported format %s", format))
		}

		if len(errs) == 0 {
			out.Write(result)
			if format == yamlOutput {
				out.Write([]byte("---\n"))
			}
			if format == jsonOutput {
				out.Write([]byte("\n"))
			}
		}
	}

	rt.generateReport(reports, report)

	return errs
}

func kindIsList(bytes []byte) (bool, error) {
	var meta metav1.TypeMeta
	if err := yaml.Unmarshal(bytes, &meta); err != nil {
		return false, err
	}
	return meta.Kind == "List", nil
}

func processList(bytes []byte, rt resourceTransformer) ([]byte, []inject.Report, error) {
	var sourceList corev1.List
	if err := yaml.Unmarshal(bytes, &sourceList); err != nil {
		return nil, nil, err
	}

	reports := []inject.Report{}
	items := []runtime.RawExtension{}

	for _, item := range sourceList.Items {
		result, irs, err := rt.transform(item.Raw)
		if err != nil {
			return nil, nil, err
		}

		// At this point, we have yaml. The kubernetes internal representation is
		// json. Because we're building a list from RawExtensions, the yaml needs
		// to be converted to json.
		injected, err := yaml.YAMLToJSON(result)
		if err != nil {
			return nil, nil, err
		}

		items = append(items, runtime.RawExtension{Raw: injected})
		reports = append(reports, irs...)
	}

	sourceList.Items = items
	result, err := yaml.Marshal(sourceList)
	if err != nil {
		return nil, nil, err
	}
	return result, reports, nil
}

// Read all the resource files found in path into a slice of readers.
// path can be either a file, directory or stdin.
func read(path string) ([]io.Reader, error) {
	if path == "-" {
		return []io.Reader{os.Stdin}, nil
	}

	if url, ok := toURL(path); ok {
		if strings.ToLower(url.Scheme) != "https" {
			return nil, fmt.Errorf("only HTTPS URLs are allowed")
		}
		resp, err := http.Get(url.String())
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("unable to read URL %q, server reported %s, status code=%d", path, resp.Status, resp.StatusCode)
		}

		// Save to a buffer, so that response can be closed here
		buf := new(bytes.Buffer)
		_, err = buf.ReadFrom(resp.Body)
		if err != nil {
			return nil, err
		}

		return []io.Reader{buf}, nil
	}

	return walk(path)
}

// checks if the given string is a valid URL
func toURL(path string) (*url.URL, bool) {
	u, err := url.ParseRequestURI(path)
	if err == nil && u.Host != "" && u.Scheme != "" {
		return u, true
	}

	return nil, false
}

// walk walks the file tree rooted at path. path may be a file or a directory.
// Creates a reader for each file found.
func walk(path string) ([]io.Reader, error) {
	p := filepath.Clean(path)
	stat, err := os.Stat(p)
	if err != nil {
		return nil, err
	}

	if !stat.IsDir() {
		file, err := os.Open(p)
		if err != nil {
			return nil, err
		}

		return []io.Reader{file}, nil
	}

	var in []io.Reader
	werr := filepath.Walk(p, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		file, err := os.Open(filepath.Clean(path))
		if err != nil {
			return err
		}

		in = append(in, file)
		return nil
	})

	if werr != nil {
		return nil, werr
	}

	return in, nil
}

// a helper function to concatenate the items in a []error
// into a single error
func concatErrors(errs []error, delimiter string) error {
	message, errs := errs[0].Error(), errs[1:] // pop the first element of the errs
	// this is done so that the first error message is not prefixed by the delimiter

	for _, err := range errs {
		message = fmt.Sprintf("%s%s%s", message, delimiter, err.Error())
	}
	return errors.New(message)
}

```

### Core Architecture Module: `cli/cmd/metrics_diagnostics_util.go`
```
package cmd

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"sort"
	"strings"
	"sync/atomic"
	"time"

	"github.com/linkerd/linkerd2/pkg/k8s"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	corev1 "k8s.io/api/core/v1"
)

// shared between metrics and diagnostics command
type metricsResult struct {
	pod       string
	container string
	metrics   []byte
	err       error
}
type byResult []metricsResult

func (s byResult) Len() int {
	return len(s)
}
func (s byResult) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}
func (s byResult) Less(i, j int) bool {
	return s[i].pod < s[j].pod || ((s[i].pod == s[j].pod) && s[i].container < s[j].container)
}

// getAllContainersWithPortSuffix returns all the containers within
// a pod which exposes metrics at a port with the given suffix
func getAllContainersWithPortSuffix(
	pod corev1.Pod,
	portName string,
) ([]corev1.Container, error) {
	if pod.Status.Phase != corev1.PodRunning {
		return nil, fmt.Errorf("pod not running: %s", pod.GetName())
	}
	var containers []corev1.Container

	allContainers := append(pod.Spec.InitContainers, pod.Spec.Containers...)
	for _, c := range allContainers {
		for _, p := range c.Ports {
			if strings.HasSuffix(p.Name, portName) {
				containers = append(containers, c)
			}
		}
	}
	return containers, nil
}

// getMetrics returns the metrics exposed by all the containers of the passed in list of pods
// which exposes their metrics at portName
func getMetrics(
	k8sAPI *k8s.KubernetesAPI,
	pods []corev1.Pod,
	portName string,
	waitingTime time.Duration,
	emitLogs bool,
) []metricsResult {
	var results []metricsResult

	resultChan := make(chan metricsResult)
	var activeRoutines int32
	for _, pod := range pods {
		atomic.AddInt32(&activeRoutines, 1)
		go func(p corev1.Pod) {
			defer atomic.AddInt32(&activeRoutines, -1)
			containers, err := getAllContainersWithPortSuffix(p, portName)
			if err != nil {
				resultChan <- metricsResult{
					pod: p.GetName(),
					err: err,
				}
				return
			}

			for _, c := range containers {
				cname := portName
				for _, cp := range c.Ports {
					if strings.HasSuffix(cp.Name, portName) {
						cname = cp.Name
						break
					}
				}
				bytes, err := k8s.GetContainerMetrics(k8sAPI, p, c, emitLogs, cname)

				resultChan <- metricsResult{
					pod:       p.GetName(),
					container: c.Name,
					metrics:   bytes,
					err:       err,
				}
			}
		}(pod)
	}

	timeout := time.NewTimer(waitingTime)
	defer timeout.Stop()
wait:
	for {
		select {
		case result := <-resultChan:
			results = append(results, result)
		case <-timeout.C:
			break wait // timed out
		}
		if atomic.LoadInt32(&activeRoutines) == 0 {
			break
		}
	}

	sort.Sort(byResult(results))

	return results
}

var obfuscationMap = map[string]struct{}{
	"authority":     {},
	"client_id":     {},
	"server_id":     {},
	"target_addr":   {},
	"dst_service":   {},
	"dst_namespace": {},
}

func obfuscateMetrics(metrics []byte) ([]byte, error) {
	reader := bytes.NewReader(metrics)

	metricsParser := expfmt.NewTextParser(model.LegacyValidation)

	parsedMetrics, err := metricsParser.TextToMetricFamilies(reader)
	if err != nil {
		return nil, err
	}

	var writer bytes.Buffer
	for _, v := range parsedMetrics {
		for _, m := range v.Metric {
			for _, l := range m.Label {
				if _, ok := obfuscationMap[l.GetName()]; ok {
					obfuscatedValue := obfuscate(l.GetValue())
					l.Value = &obfuscatedValue
				}
			}
		}
		// We'll assume MetricFamilyToText errors are insignificant
		//nolint:errcheck
		expfmt.MetricFamilyToText(&writer, v)
	}

	return writer.Bytes(), nil
}

func obfuscate(s string) string {
	hash := sha256.Sum256([]byte(s))
	return fmt.Sprintf("%x", hash[:4])
}

```

### Core Architecture Module: `controller/api/destination/external-workload/controller_util.go`
```
package externalworkload

import (
	"reflect"

	ewv1beta1 "github.com/linkerd/linkerd2/controller/gen/apis/externalworkload/v1beta1"
	discoveryv1 "k8s.io/api/discovery/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/tools/cache"
)

func (ec *EndpointsController) getServicesToUpdateOnExternalWorkloadChange(old, cur interface{}) sets.Set[string] {
	newEw, newEwOk := cur.(*ewv1beta1.ExternalWorkload)
	oldEw, oldEwOk := old.(*ewv1beta1.ExternalWorkload)

	if !oldEwOk {
		ec.log.Errorf("Expected (cur) to be an EndpointSlice in getServicesToUpdateOnExternalWorkloadChange(), got type: %T", cur)
		return sets.Set[string]{}
	}

	if !newEwOk {
		ec.log.Errorf("Expected (old) to be an EndpointSlice in getServicesToUpdateOnExternalWorkloadChange(), got type: %T", old)
		return sets.Set[string]{}
	}

	if newEw.ResourceVersion == oldEw.ResourceVersion {
		// Periodic resync will send update events for all known ExternalWorkloads.
		// Two different versions of the same pod will always have different RVs
		return sets.Set[string]{}
	}

	ewChanged, labelsChanged := ewEndpointsChanged(oldEw, newEw)
	if !ewChanged && !labelsChanged {
		ec.log.Errorf("skipping update; nothing has changed between old rv %s and new rv %s", oldEw.ResourceVersion, newEw.ResourceVersion)
		return sets.Set[string]{}
	}

	services, err := ec.getExternalWorkloadSvcMembership(newEw)
	if err != nil {
		ec.log.Errorf("unable to get pod %s/%s's service memberships: %v", newEw.Namespace, newEw.Name, err)
		return sets.Set[string]{}
	}

	if labelsChanged {
		oldServices, err := ec.getExternalWorkloadSvcMembership(oldEw)
		if err != nil {
			ec.log.Errorf("unable to get pod %s/%s's service memberships: %v", oldEw.Namespace, oldEw.Name, err)
		}
		services = determineNeededServiceUpdates(oldServices, services, ewChanged)
	}

	return services
}

func determineNeededServiceUpdates(oldServices, services sets.Set[string], specChanged bool) sets.Set[string] {
	if specChanged {
		// if the labels and spec changed, all services need to be updated
		services = services.Union(oldServices)
	} else {
		// if only the labels changed, services not common to both the new
		// and old service set (the disjuntive union) need to be updated
		services = services.Difference(oldServices).Union(oldServices.Difference(services))
	}
	return services
}

// getExternalWorkloadSvcMembership accepts a pointer to an external workload
// resource and returns a set of service keys (<namespace>/<name>). The set
// includes all services local to the workload's namespace that match the workload.
func (ec *EndpointsController) getExternalWorkloadSvcMembership(workload *ewv1beta1.ExternalWorkload) (sets.Set[string], error) {
	keys := sets.Set[string]{}
	services, err := ec.k8sAPI.Svc().Lister().Services(workload.Namespace).List(labels.Everything())
	if err != nil {
		return keys, err
	}

	for _, svc := range services {
		if svc.Spec.Selector == nil {
			continue
		}

		// Taken from upstream k8s code, this checks whether a given object has
		// a deleted state before returning a `namespace/name` key. This is
		// important since we do not want to consider a service that has been
		// deleted and is waiting for cache eviction
		key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(svc)
		if err != nil {
			return sets.Set[string]{}, err
		}

		// Check if service selects our ExternalWorkload.
		if labels.ValidatedSetSelector(svc.Spec.Selector).Matches(labels.Set(workload.Labels)) {
			keys.Insert(key)
		}
	}

	return keys, nil
}

// getEndpointSliceFromDeleteAction parses an EndpointSlice from a delete action.
func (ec *EndpointsController) getEndpointSliceFromDeleteAction(obj interface{}) *discoveryv1.EndpointSlice {
	if endpointSlice, ok := obj.(*discoveryv1.EndpointSlice); ok {
		// Enqueue all the services that the pod used to be a member of.
		// This is the same thing we do when we add a pod.
		return endpointSlice
	}
	// If we reached here it means the pod was deleted but its final state is unrecorded.
	tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
	if !ok {
		ec.log.Errorf("Couldn't get object from tombstone")
		return nil
	}
	endpointSlice, ok := tombstone.Obj.(*discoveryv1.EndpointSlice)
	if !ok {
		ec.log.Errorf("Tombstone contained object that is not a EndpointSlice")
		return nil
	}
	return endpointSlice
}

// getExternalWorkloadFromDeleteAction parses an ExternalWorkload from a delete action.
func (ec *EndpointsController) getExternalWorkloadFromDeleteAction(obj interface{}) *ewv1beta1.ExternalWorkload {
	if ew, ok := obj.(*ewv1beta1.ExternalWorkload); ok {
		return ew
	}

	// If we reached here it means the pod was deleted but its final state is unrecorded.
	tombstone, ok := obj.(cache.DeletedFinalStateUnknown)
	if !ok {
		ec.log.Errorf("couldn't get object from tombstone %#v", obj)
		return nil
	}

	ew, ok := tombstone.Obj.(*ewv1beta1.ExternalWorkload)
	if !ok {
		ec.log.Errorf("tombstone contained object that is not a ExternalWorkload: %#v", obj)
		return nil
	}
	return ew
}

// ewEndpointsChanged returns two boolean values. The first is true if the ExternalWorkload has
// changed in a way that may change existing endpoints. The second value is true if the
// ExternalWorkload has changed in a way that may affect which Services it matches.
func ewEndpointsChanged(oldEw, newEw *ewv1beta1.ExternalWorkload) (bool, bool) {
	// Check if the ExternalWorkload labels have changed, indicating a possible
	// change in the service membership
	labelsChanged := false
	if !reflect.DeepEqual(newEw.Labels, oldEw.Labels) {
		labelsChanged = true
	}

	// If the ExternalWorkload's deletion timestamp is set, remove endpoint from ready address.
	if newEw.DeletionTimestamp != oldEw.DeletionTimestamp {
		return true, labelsChanged
	}
	// If the ExternalWorkload's readiness has changed, the associated endpoint address
	// will move from the unready endpoints set to the ready endpoints.
	// So for the purposes of an endpoint, a readiness change on an ExternalWorkload
	// means we have a changed ExternalWorkload.
	if IsEwReady(oldEw) != IsEwReady(newEw) {
		return true, labelsChanged
	}

	// Check if the ExternalWorkload IPs have changed
	if len(oldEw.Spec.WorkloadIPs) != len(newEw.Spec.WorkloadIPs) {
		return true, labelsChanged
	}
	for i := range oldEw.Spec.WorkloadIPs {
		if oldEw.Spec.WorkloadIPs[i].Ip != newEw.Spec.WorkloadIPs[i].Ip {
			return true, labelsChanged
		}
	}

	// Check if the Ports  have changed
	if len(oldEw.Spec.Ports) != len(newEw.Spec.Ports) {
		return true, labelsChanged
	}

	// Determine if the ports have changed between workload resources
	portSet := make(map[int32]ewv1beta1.PortSpec)
	for _, ps := range newEw.Spec.Ports {
		portSet[ps.Port] = ps
	}

	for _, oldPs := range oldEw.Spec.Ports {
		// If the port number is present in the new workload but not the old
		// one, then we have a diff and we return early
		newPs, ok := portSet[oldPs.Port]
		if !ok {
			return true, labelsChanged
		}

		// If the port is present in both workloads, we check to see if any of
		// the port spec's values have changed, e.g. name or protocol
		if newPs.Name != oldPs.Name || newPs.Protocol != oldPs.Protocol {
			return true, labelsChanged
		}
	}

	return false, labelsChanged
}

func managedByController(es *discoveryv1.EndpointSlice) bool {
	esManagedBy := es.Labels[discoveryv1.LabelManagedBy]
	return managedBy == esManagedBy
}

func managedByChanged(endpointSlice1, endpointSlice2 *discoveryv1.EndpointSlice) bool {
	return managedByController(endpointSlice1) != managedByController(endpointSlice2)
}

func IsEwReady(ew *ewv1beta1.ExternalWorkload) bool {
	if len(ew.Status.Conditions) == 0 {
		return false
	}

	// Loop through the conditions and look at each condition in turn starting
	// from the top.
	for i := range ew.Status.Conditions {
		cond := ew.Status.Conditions[i]
		// Stop once we find a 'Ready' condition. We expect a resource to only
		// have one 'Ready' type condition.
		if cond.Type == ewv1beta1.WorkloadReady && cond.Status == ewv1beta1.ConditionTrue {
			return true
		}
	}

	return false
}

```

### Core Architecture Module: `controller/api/destination/external-workload/queue_metrics.go`
```
package externalworkload

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"k8s.io/client-go/util/workqueue"
)

// Code is functionally the same as usptream metrics provider. The difference is that
// we rely on promauto instead of init() method for metrics registering as the logic
// used to register the metrics in the upstream implementation uses k8s.io/component-base/metrics/legacyregistry
// The latter does not work with our metrics registry and hence these metrics do not
// end up exposed via our admin's server /metrics endpoint.
//
// https://github.com/kubernetes/component-base/blob/68f947b04ec3a353e63bbef2c1f935bb9ce0061d/metrics/prometheus/workqueue/metrics.go

const (
	WorkQueueSubsystem         = "workqueue"
	DepthKey                   = "depth"
	AddsKey                    = "adds_total"
	QueueLatencyKey            = "queue_duration_seconds"
	WorkDurationKey            = "work_duration_seconds"
	UnfinishedWorkKey          = "unfinished_work_seconds"
	LongestRunningProcessorKey = "longest_running_processor_seconds"
	RetriesKey                 = "retries_total"
	DropsTotalKey              = "drops_total"
)

type queueMetricsProvider struct {
	depth                   *prometheus.GaugeVec
	adds                    *prometheus.CounterVec
	latency                 *prometheus.HistogramVec
	workDuration            *prometheus.HistogramVec
	unfinished              *prometheus.GaugeVec
	longestRunningProcessor *prometheus.GaugeVec
	retries                 *prometheus.CounterVec
	drops                   *prometheus.CounterVec
}

func newWorkQueueMetricsProvider() *queueMetricsProvider {
	return &queueMetricsProvider{
		depth: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Subsystem: WorkQueueSubsystem,
			Name:      DepthKey,
			Help:      "Current depth of workqueue",
		}, []string{"name"}),

		adds: promauto.NewCounterVec(prometheus.CounterOpts{
			Subsystem: WorkQueueSubsystem,
			Name:      AddsKey,
			Help:      "Total number of adds handled by workqueue",
		}, []string{"name"}),

		latency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Subsystem: WorkQueueSubsystem,
			Name:      QueueLatencyKey,
			Help:      "How long in seconds an item stays in workqueue before being requested.",
			Buckets:   prometheus.ExponentialBuckets(10e-9, 10, 10),
		}, []string{"name"}),

		workDuration: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Subsystem: WorkQueueSubsystem,
			Name:      WorkDurationKey,
			Help:      "How long in seconds processing an item from workqueue takes.",
			Buckets:   prometheus.ExponentialBuckets(10e-9, 10, 10),
		}, []string{"name"}),

		unfinished: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Subsystem: WorkQueueSubsystem,
			Name:      UnfinishedWorkKey,
			Help: "How many seconds of work has done that " +
				"is in progress and hasn't been observed by work_duration. Large " +
				"values indicate stuck threads. One can deduce the number of stuck " +
				"threads by observing the rate at which this increases.",
		}, []string{"name"}),

		longestRunningProcessor: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Subsystem: WorkQueueSubsystem,
			Name:      LongestRunningProcessorKey,
			Help: "How many seconds has the longest running " +
				"processor for workqueue been running.",
		}, []string{"name"}),

		retries: promauto.NewCounterVec(prometheus.CounterOpts{
			Subsystem: WorkQueueSubsystem,
			Name:      RetriesKey,
			Help:      "Total number of retries handled by workqueue",
		}, []string{"name"}),
		drops: promauto.NewCounterVec(prometheus.CounterOpts{
			Subsystem: WorkQueueSubsystem,
			Name:      DropsTotalKey,
			Help:      "Total number of dropped items from the queue due to exceeding retry threshold",
		}, []string{"name"}),
	}
}

func (p queueMetricsProvider) NewDepthMetric(name string) workqueue.GaugeMetric {
	return p.depth.WithLabelValues(name)
}

func (p queueMetricsProvider) NewAddsMetric(name string) workqueue.CounterMetric {
	return p.adds.WithLabelValues(name)
}

func (p queueMetricsProvider) NewLatencyMetric(name string) workqueue.HistogramMetric {
	return p.latency.WithLabelValues(name)
}

func (p queueMetricsProvider) NewWorkDurationMetric(name string) workqueue.HistogramMetric {
	return p.workDuration.WithLabelValues(name)
}

func (p queueMetricsProvider) NewUnfinishedWorkSecondsMetric(name string) workqueue.SettableGaugeMetric {
	return p.unfinished.WithLabelValues(name)
}

func (p queueMetricsProvider) NewLongestRunningProcessorSecondsMetric(name string) workqueue.SettableGaugeMetric {
	return p.longestRunningProcessor.WithLabelValues(name)
}

func (p queueMetricsProvider) NewRetriesMetric(name string) workqueue.CounterMetric {
	return p.retries.WithLabelValues(name)
}

func (p queueMetricsProvider) NewDropsMetric(name string) workqueue.CounterMetric {
	return p.drops.WithLabelValues(name)
}

type noopCounterMetric struct{}

func (noopCounterMetric) Inc() {}

```

### Core Architecture Module: `controller/proxy-injector/webhook.go`
```
package injector

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/linkerd/linkerd2/controller/k8s"
	"github.com/linkerd/linkerd2/controller/webhook"
	"github.com/linkerd/linkerd2/pkg/config"
	"github.com/linkerd/linkerd2/pkg/inject"
	pkgK8s "github.com/linkerd/linkerd2/pkg/k8s"
	"github.com/linkerd/linkerd2/pkg/version"
	log "github.com/sirupsen/logrus"
	admissionv1beta1 "k8s.io/api/admission/v1beta1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/tools/record"
)

const (
	eventTypeSkipped  = "InjectionSkipped"
	eventTypeInjected = "Injected"
)

// Inject returns the function that produces an AdmissionResponse containing
// the patch, if any, to apply to the pod (proxy sidecar and eventually the
// init container to set it up)
func Inject(linkerdNamespace string, overrider inject.ValueOverrider) webhook.Handler {
	return func(
		ctx context.Context,
		api *k8s.MetadataAPI,
		request *admissionv1beta1.AdmissionRequest,
		recorder record.EventRecorder,
	) (*admissionv1beta1.AdmissionResponse, error) {
		log.Debugf("request object bytes: %s", request.Object.Raw)

		// Build the resource config based off the request metadata and kind of
		// object. This is later used to build the injection report and generated
		// patch.
		valuesConfig, err := config.Values(pkgK8s.MountPathValuesConfig)
		if err != nil {
			return nil, err
		}

		caPEM, err := os.ReadFile(pkgK8s.MountPathTrustRootsPEM)
		if err != nil {
			return nil, err
		}
		valuesConfig.IdentityTrustAnchorsPEM = string(caPEM)

		ns, err := api.Get(k8s.NS, request.Namespace)
		if err != nil {
			return nil, err
		}
		resourceConfig := inject.NewResourceConfig(valuesConfig, inject.OriginWebhook, linkerdNamespace).
			WithOwnerRetriever(ownerRetriever(ctx, api, request.Namespace)).
			WithNsAnnotations(ns.GetAnnotations()).
			WithKind(request.Kind.Kind)

		// Build the injection report.
		report, err := resourceConfig.ParseMetaAndYAML(request.Object.Raw)
		if err != nil {
			return nil, err
		}
		log.Infof("received %s", report.ResName())

		// If the resource has an owner, then it should be retrieved for recording
		// events.
		var parent *metav1.PartialObjectMetadata
		var ownerKind string
		if ownerRef := resourceConfig.GetOwnerRef(); ownerRef != nil {
			res, err := k8s.GetAPIResource(ownerRef.Kind)
			if err != nil {
				log.Tracef("skipping event for parent %s: %s", ownerRef.Kind, err)
			} else {
				objs, err := api.GetByNamespaceFiltered(res, request.Namespace, ownerRef.Name, labels.Everything())
				if err != nil {
					log.Warnf("couldn't retrieve parent object %s-%s-%s; error: %s", request.Namespace, ownerRef.Kind, ownerRef.Name, err)
				} else if len(objs) == 0 {
					log.Warnf("couldn't retrieve parent object %s-%s-%s", request.Namespace, ownerRef.Kind, ownerRef.Name)
				} else {
					parent = objs[0]
				}
				ownerKind = strings.ToLower(ownerRef.Kind)
			}
		}

		configLabels := configToPrometheusLabels(resourceConfig)

		counter, err := proxyInjectionAdmissionRequests.GetMetricWith(admissionRequestLabels(ownerKind, request.Namespace, report.InjectAnnotationAt, configLabels))
		if err != nil {
			log.Errorf("failed to get proxy_inject_admission_requests metric: %q", err)
		} else {
			counter.Inc()
		}

		// If the resource is injectable then admit it after creating a patch that
		// adds the proxy-init and proxy containers.
		injectable, reasons := report.Injectable()
		if injectable {
			resourceConfig.AppendPodAnnotation(pkgK8s.CreatedByAnnotation, fmt.Sprintf("linkerd/proxy-injector %s", version.Version))

			// If namespace has annotations that do not exist on pod then copy them
			// over to pod's template.
			inject.AppendNamespaceAnnotations(resourceConfig.GetOverrideAnnotations(), resourceConfig.GetNsAnnotations(), resourceConfig.GetWorkloadAnnotations())

			// If the pod did not inherit the opaque ports annotation from the
			// namespace, then add the default value from the config values. This
			// ensures that the generated patch always sets the opaque ports
			// annotation.
			if !resourceConfig.HasWorkloadAnnotation(pkgK8s.ProxyOpaquePortsAnnotation) {
				defaultPorts := strings.Split(resourceConfig.GetValues().Proxy.OpaquePorts, ",")
				filteredPorts := resourceConfig.FilterPodOpaquePorts(defaultPorts)
				// Only add the annotation if there are ports that the pod exposes
				// that are in the default opaque ports list.
				if len(filteredPorts) != 0 {
					ports := strings.Join(filteredPorts, ",")
					resourceConfig.AppendPodAnnotation(pkgK8s.ProxyOpaquePortsAnnotation, ports)
				}
			}

			patchJSON, err := resourceConfig.GetPodPatch(true, overrider)
			if err != nil {
				return nil, err
			}

			if parent != nil {
				recorder.Event(parent, v1.EventTypeNormal, eventTypeInjected, "Linkerd sidecar proxy injected")
			}
			log.Infof("injection patch generated for: %s", report.ResName())
			log.Debugf("injection patch: %s", patchJSON)

			counter, err := proxyInjectionAdmissionResponses.GetMetricWith(admissionResponseLabels(ownerKind, request.Namespace, "false", "", report.InjectAnnotationAt, configLabels))
			if err != nil {
				log.Errorf("failed to get proxy_inject_admission_responses metric: %q", err)
			} else {
				counter.Inc()
			}

			patchType := admissionv1beta1.PatchTypeJSONPatch
			return &admissionv1beta1.AdmissionResponse{
				UID:       request.UID,
				Allowed:   true,
				PatchType: &patchType,
				Patch:     patchJSON,
			}, nil
		}

		// Resource could not be injected with the sidecar, format the reason
		// for injection being skipped to emit an event
		readableReasons := make([]string, 0, len(reasons))
		for _, reason := range reasons {
			readableReasons = append(readableReasons, inject.Reasons[reason])
		}
		readableMsg := strings.Join(readableReasons, ", ")

		if parent != nil {
			recorder.Eventf(parent, v1.EventTypeNormal, eventTypeSkipped, "Linkerd sidecar proxy injection skipped: %s", readableMsg)
		}

		// Create a patch which adds the opaque ports annotation if the workload
		// doesn't already have it set.
		patchJSON, err := resourceConfig.CreateOpaquePortsPatch()
		if err != nil {
			return nil, err
		}

		// If resource needs to be patched with annotations (e.g opaque
		// ports), then admit the request with the relevant patch
		if len(patchJSON) != 0 {
			log.Infof("annotation patch generated for: %s", report.ResName())
			log.Debugf("annotation patch: %s", patchJSON)

			counter, err := proxyInjectionAdmissionResponses.GetMetricWith(admissionResponseLabels(ownerKind, request.Namespace, "false", "", report.InjectAnnotationAt, configLabels))
			if err != nil {
				log.Errorf("failed to get proxy_inject_admission_responses metric: %q", err)
			} else {
				counter.Inc()
			}

			patchType := admissionv1beta1.PatchTypeJSONPatch
			return &admissionv1beta1.AdmissionResponse{
				UID:       request.UID,
				Allowed:   true,
				PatchType: &patchType,
				Patch:     patchJSON,
			}, nil
		}

		// If the resource is a pod, and no annotation patch has
		// been generated, record in the metrics (and log) that it has been
		// entirely skipped and admit without any mutations
		if resourceConfig.IsPod() {
			log.Infof("skipped %s: %s", report.ResName(), readableMsg)

			counter, err := proxyInjectionAdmissionResponses.GetMetricWith(admissionResponseLabels(ownerKind, request.Namespace, "true", strings.Join(reasons, ","), report.InjectAnnotationAt, configLabels))
			if err != nil {
				log.Errorf("failed to get proxy_inject_admission_responses metric: %q", err)
			} else {
				counter.Inc()
			}

			return &admissionv1beta1.AdmissionResponse{
				UID:     request.UID,
				Allowed: true,
			}, nil
		}

		return &admissionv1beta1.AdmissionResponse{
			UID:     request.UID,
			Allowed: true,
		}, nil
	}
}

func ownerRetriever(ctx context.Context, api *k8s.MetadataAPI, ns string) inject.OwnerRetrieverFunc {
	return func(p *v1.Pod) (string, string, error) {
		p.SetNamespace(ns)
		return api.GetOwnerKindAndName(ctx, p, true)
	}
}

```

### Core Architecture Module: `controller/sp-validator/webhook.go`
```
package validator

import (
	"context"

	"github.com/linkerd/linkerd2/controller/k8s"
	"github.com/linkerd/linkerd2/pkg/profiles"
	admissionv1beta1 "k8s.io/api/admission/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/record"
)

// AdmitSP verifies that the received Admission Request contains a valid
// Service Profile definition
func AdmitSP(
	_ context.Context, _ *k8s.MetadataAPI, request *admissionv1beta1.AdmissionRequest, _ record.EventRecorder,
) (*admissionv1beta1.AdmissionResponse, error) {
	admissionResponse := &admissionv1beta1.AdmissionResponse{
		UID:     request.UID,
		Allowed: true,
	}
	if err := profiles.Validate(request.Object.Raw); err != nil {
		admissionResponse.Allowed = false
		admissionResponse.Result = &metav1.Status{Message: err.Error(), Code: 400}
	}
	return admissionResponse, nil
}

```

### Core Architecture Module: `controller/webhook/launcher.go`
```
package webhook

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/linkerd/linkerd2/controller/k8s"
	"github.com/linkerd/linkerd2/pkg/admin"
	pkgk8s "github.com/linkerd/linkerd2/pkg/k8s"
	log "github.com/sirupsen/logrus"
)

// Launch sets up and starts the webhook and metrics servers
func Launch(
	ctx context.Context,
	apiresources []k8s.APIResource,
	handler Handler,
	component,
	metricsAddr string,
	addr string,
	kubeconfig string,
	enablePprof bool,
) {
	ready := false
	adminServer := admin.NewServer(metricsAddr, enablePprof, &ready)

	go func() {
		log.Infof("starting admin server on %s", metricsAddr)
		if err := adminServer.ListenAndServe(); err != nil {
			log.Errorf("failed to start webhook admin server: %s", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	defer close(stop)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	config, err := pkgk8s.GetConfig(kubeconfig, "")
	if err != nil {
		//nolint:gocritic
		log.Fatalf("error building Kubernetes API config: %s", err)
	}

	k8sAPI, err := pkgk8s.NewAPIForConfig(config, "", []string{}, 0, 0, 0)
	if err != nil {
		//nolint:gocritic
		log.Fatalf("error configuring Kubernetes API client: %s", err)
	}

	metadataAPI, err := k8s.InitializeMetadataAPI(kubeconfig, "local", apiresources...)
	if err != nil {
		//nolint:gocritic
		log.Fatalf("failed to initialize Kubernetes API: %s", err)
	}

	s, err := NewServer(ctx, k8sAPI, metadataAPI, addr, pkgk8s.MountPathTLSBase, handler, component)
	if err != nil {
		//nolint:gocritic
		log.Fatalf("failed to initialize the webhook server: %s", err)
	}

	go s.Start()

	metadataAPI.Sync(nil)

	ready = true

	<-stop
	log.Info("shutting down webhook server")
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := s.Shutdown(ctx); err != nil {
		log.Error(err)
	}

	adminServer.Shutdown(ctx)
}

```

### Core Architecture Module: `controller/webhook/server.go`
```
package webhook

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/linkerd/linkerd2/controller/k8s"
	pkgk8s "github.com/linkerd/linkerd2/pkg/k8s"
	pkgTls "github.com/linkerd/linkerd2/pkg/tls"
	"github.com/linkerd/linkerd2/pkg/util"
	log "github.com/sirupsen/logrus"
	admissionv1beta1 "k8s.io/api/admission/v1beta1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	typedcorev1 "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/tools/record"
	"sigs.k8s.io/yaml"
)

// Handler is the signature for the functions that ultimately deal with
// the admission request
type Handler func(
	context.Context,
	*k8s.MetadataAPI,
	*admissionv1beta1.AdmissionRequest,
	record.EventRecorder,
) (*admissionv1beta1.AdmissionResponse, error)

// Server describes the https server implementing the webhook
type Server struct {
	*http.Server
	metadataAPI *k8s.MetadataAPI
	handler     Handler
	certValue   *atomic.Value
	recorder    record.EventRecorder
}

// NewServer returns a new instance of Server
func NewServer(
	ctx context.Context,
	api *pkgk8s.KubernetesAPI,
	metadataAPI *k8s.MetadataAPI,
	addr, certPath string,
	handler Handler,
	component string,
) (*Server, error) {
	updateEvent := make(chan struct{})
	errEvent := make(chan error)
	watcher := pkgTls.NewFsCredsWatcher(certPath, updateEvent, errEvent).
		WithFilePaths(pkgk8s.MountPathTLSCrtPEM, pkgk8s.MountPathTLSKeyPEM)
	go func() {
		if err := watcher.StartWatching(ctx); err != nil {
			log.Fatalf("Failed to start creds watcher: %s", err)
		}
	}()

	server := &http.Server{
		Addr:              addr,
		ReadHeaderTimeout: 15 * time.Second,
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS13,
		},
	}

	eventBroadcaster := record.NewBroadcaster()
	eventBroadcaster.StartRecordingToSink(&typedcorev1.EventSinkImpl{
		// In order to send events to all namespaces, we need to use an empty string here
		// re: client-go's event_expansion.go CreateWithEventNamespace()
		Interface: api.CoreV1().Events(""),
	})
	recorder := eventBroadcaster.NewRecorder(scheme.Scheme, v1.EventSource{Component: component})

	s := getConfiguredServer(server, metadataAPI, handler, recorder)
	if err := watcher.UpdateCert(s.certValue); err != nil {
		log.Fatalf("Failed to initialized certificate: %s", err)
	}

	log := log.WithFields(log.Fields{
		"component": "proxy-injector",
		"addr":      addr,
	})

	go watcher.ProcessEvents(log, s.certValue, updateEvent, errEvent)

	return s, nil
}

func getConfiguredServer(
	httpServer *http.Server,
	metadataAPI *k8s.MetadataAPI,
	handler Handler,
	recorder record.EventRecorder,
) *Server {
	var emptyCert atomic.Value
	s := &Server{httpServer, metadataAPI, handler, &emptyCert, recorder}
	s.Handler = http.HandlerFunc(s.serve)
	httpServer.TLSConfig.GetCertificate = s.getCertificate
	return s
}

// Start starts the https server
func (s *Server) Start() {
	log.Infof("listening at %s", s.Server.Addr)
	if err := s.ListenAndServeTLS("", ""); err != nil {
		if errors.Is(err, http.ErrServerClosed) {
			return
		}
		log.Fatal(err)
	}
}

// getCertificate provides the TLS server with the current cert
func (s *Server) getCertificate(_ *tls.ClientHelloInfo) (*tls.Certificate, error) {
	return s.certValue.Load().(*tls.Certificate), nil
}

func (s *Server) serve(res http.ResponseWriter, req *http.Request) {
	var (
		data []byte
		err  error
	)
	if req.Body != nil {
		data, err = util.ReadAllLimit(req.Body, 10*util.MB)
		if err != nil {
			http.Error(res, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if len(data) == 0 {
		log.Warn("received empty payload")
		return
	}

	response, err := s.processReq(req.Context(), data)
	if err != nil {
		http.Error(res, err.Error(), http.StatusBadRequest)
		return
	}

	responseJSON, err := json.Marshal(response)
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}

	if _, err := res.Write(responseJSON); err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (s *Server) processReq(ctx context.Context, data []byte) (*admissionv1beta1.AdmissionReview, error) {
	admissionReview, err := decode(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode admission review request: %w", err)
	}
	if admissionReview.Request == nil || admissionReview.Request.UID == "" {
		return nil, fmt.Errorf("invalid admission review request")
	}
	log.Infof("received admission review request %q", admissionReview.Request.UID)
	log.Debugf("admission request: %+v", admissionReview.Request)

	admissionResponse, err := s.handler(ctx, s.metadataAPI, admissionReview.Request, s.recorder)
	if err != nil {
		log.Error("failed to run webhook handler. Reason: ", err)
		admissionReview.Response = &admissionv1beta1.AdmissionResponse{
			UID:     admissionReview.Request.UID,
			Allowed: false,
			Result: &metav1.Status{
				Message: err.Error(),
			},
		}
		return admissionReview, nil
	}
	admissionReview.Response = admissionResponse

	return admissionReview, nil
}

// Shutdown initiates a graceful shutdown of the underlying HTTP server.
func (s *Server) Shutdown(ctx context.Context) error {
	return s.Server.Shutdown(ctx)
}

func decode(data []byte) (*admissionv1beta1.AdmissionReview, error) {
	var admissionReview admissionv1beta1.AdmissionReview
	err := yaml.Unmarshal(data, &admissionReview)
	return &admissionReview, err
}

```

### Core Architecture Module: `controller/webhook/util.go`
```
package webhook

import (
	"fmt"

	labels "github.com/linkerd/linkerd2/pkg/k8s"
	corev1 "k8s.io/api/core/v1"
)

// GetProxyContainerPath gets the proxy container jsonpath of a pod relative to spec;
// this path is required in webhooks because of how patches are created.
func GetProxyContainerPath(spec corev1.PodSpec) string {
	for i, c := range spec.Containers {
		if c.Name == labels.ProxyContainerName {
			return fmt.Sprintf("containers/%d", i)
		}
	}
	for i, c := range spec.InitContainers {
		if c.Name == labels.ProxyContainerName {
			return fmt.Sprintf("initContainers/%d", i)
		}
	}
	return ""
}

```

### Core Architecture Module: `multicluster/service-mirror/probe_worker.go`
```
package servicemirror

import (
	"fmt"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/linkerd/linkerd2/controller/gen/apis/link/v1alpha3"
	"github.com/prometheus/client_golang/prometheus"
	logging "github.com/sirupsen/logrus"
)

// ProbeWorker is responsible for monitoring gateways using a probe specification
type ProbeWorker struct {
	localGatewayName string
	alive            bool
	Liveness         chan bool
	*sync.RWMutex
	probeSpec *v1alpha3.ProbeSpec
	stopCh    chan struct{}
	metrics   *ProbeMetrics
	log       *logging.Entry
}

// NewProbeWorker creates a new probe worker associated with a particular gateway
func NewProbeWorker(localGatewayName string, spec *v1alpha3.ProbeSpec, metrics *ProbeMetrics, probekey string) *ProbeWorker {
	metrics.gatewayEnabled.Set(1)
	return &ProbeWorker{
		localGatewayName: localGatewayName,
		Liveness:         make(chan bool, 10),
		RWMutex:          &sync.RWMutex{},
		probeSpec:        spec,
		stopCh:           make(chan struct{}),
		metrics:          metrics,
		log: logging.WithFields(logging.Fields{
			"probe-key": probekey,
		}),
	}
}

// UpdateProbeSpec is used to update the probe specification when something about the gateway changes
func (pw *ProbeWorker) UpdateProbeSpec(spec *v1alpha3.ProbeSpec) {
	pw.Lock()
	pw.probeSpec = spec
	pw.Unlock()
}

// Stop this probe worker
func (pw *ProbeWorker) Stop() {
	pw.metrics.unregister()
	pw.log.Infof("Stopping probe worker")
	close(pw.stopCh)
}

// Start this probe worker
func (pw *ProbeWorker) Start() {

	pw.log.Infof("Starting probe worker")
	go pw.run()
}

func (pw *ProbeWorker) run() {
	successLabel := prometheus.Labels{probeSuccessfulLabel: "true"}
	notSuccessLabel := prometheus.Labels{probeSuccessfulLabel: "false"}

	if pw.probeSpec == nil {
		pw.log.Error("Probe spec is nil")
		return
	}
	probeTickerPeriod, err := time.ParseDuration(pw.probeSpec.Period)
	if err != nil {
		pw.log.Errorf("could not parse probe period: %s", err)
		return
	}
	maxJitter := probeTickerPeriod / 10 // max jitter is 10% of period
	probeTicker := NewTicker(probeTickerPeriod, maxJitter)
	defer probeTicker.Stop()

	failureThreshold, err := strconv.ParseUint(pw.probeSpec.FailureThreshold, 10, 32)
	if err != nil {
		pw.log.Errorf("could not parse failure threshold: %s", err)
		return
	}
	var failures uint64 = 0

probeLoop:
	for {
		select {
		case <-pw.stopCh:
			break probeLoop
		case <-probeTicker.C:
			start := time.Now()
			if err := pw.doProbe(); err != nil {
				pw.log.Warn(err)
				failures++
				if failures < failureThreshold {
					continue probeLoop
				}

				pw.log.Warnf("Failure threshold (%s) reached - Marking as unhealthy", pw.probeSpec.FailureThreshold)
				pw.metrics.alive.Set(0)

				counter, err := pw.metrics.probes.GetMetricWith(notSuccessLabel)
				if err != nil {
					pw.log.Errorf("failed to get probe metric: %q", err)
				} else {
					counter.Inc()
				}
				if pw.alive {
					pw.alive = false
					pw.Liveness <- false
				}
			} else {
				end := time.Since(start)
				failures = 0

				pw.log.Debug("Gateway is healthy")
				pw.metrics.alive.Set(1)
				pw.metrics.latency.Set(float64(end.Milliseconds()))
				pw.metrics.latencies.Observe(float64(end.Milliseconds()))
				counter, err := pw.metrics.probes.GetMetricWith(successLabel)
				if err != nil {
					pw.log.Errorf("failed to get probe metric: %q", err)
				} else {
					counter.Inc()
				}
				if !pw.alive {
					pw.alive = true
					pw.Liveness <- true
				}
			}
		}
	}
}

func (pw *ProbeWorker) doProbe() error {
	pw.RLock()
	defer pw.RUnlock()

	timeout, err := time.ParseDuration(pw.probeSpec.Timeout)
	if err != nil {
		return fmt.Errorf("could not parse timeout: %w", err)
	}
	client := http.Client{
		Timeout: timeout,
	}

	urlAddress := net.JoinHostPort(pw.localGatewayName, pw.probeSpec.Port)
	req, err := http.NewRequest("GET", fmt.Sprintf("http://%s%s", urlAddress, pw.probeSpec.Path), nil)
	if err != nil {
		return fmt.Errorf("could not create a GET request to gateway: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("problem connecting with gateway: %w", err)
	}
	if resp.StatusCode != 200 {
		return fmt.Errorf("gateway returned unexpected status %d", resp.StatusCode)
	}

	if err := resp.Body.Close(); err != nil {
		pw.log.Warnf("Failed to close response body %s", err)
	}

	return nil
}

```

### Core Architecture Module: `pkg/servicemirror/util.go`
```
package servicemirror

import (
	"fmt"

	consts "github.com/linkerd/linkerd2/pkg/k8s"
	corev1 "k8s.io/api/core/v1"
)

// ParseRemoteClusterSecret extracts the credentials used to access the remote cluster
func ParseRemoteClusterSecret(secret *corev1.Secret) ([]byte, error) {
	config, hasConfig := secret.Data[consts.ConfigKeyName]

	if !hasConfig {
		return nil, fmt.Errorf("secret should contain target cluster name as annotation %s", consts.RemoteClusterNameLabel)
	}

	return config, nil
}

```

### Core Architecture Module: `pkg/util/http.go`
```
package util

import (
	"fmt"
	"io"
	"strings"

	httpPb "github.com/linkerd/linkerd2-proxy-api/go/http_types"
)

// KB = Kilobyte
const KB = 1024

// MB = Megabyte
const MB = KB * 1024

// ParseScheme converts a scheme string to protobuf
// TODO: validate scheme
func ParseScheme(scheme string) *httpPb.Scheme {
	value, ok := httpPb.Scheme_Registered_value[strings.ToUpper(scheme)]
	if ok {
		return &httpPb.Scheme{
			Type: &httpPb.Scheme_Registered_{
				Registered: httpPb.Scheme_Registered(value),
			},
		}
	}
	return &httpPb.Scheme{
		Type: &httpPb.Scheme_Unregistered{
			Unregistered: strings.ToUpper(scheme),
		},
	}
}

// ParseMethod converts a method string to protobuf
// TODO: validate method
func ParseMethod(method string) *httpPb.HttpMethod {
	value, ok := httpPb.HttpMethod_Registered_value[strings.ToUpper(method)]
	if ok {
		return &httpPb.HttpMethod{
			Type: &httpPb.HttpMethod_Registered_{
				Registered: httpPb.HttpMethod_Registered(value),
			},
		}
	}
	return &httpPb.HttpMethod{
		Type: &httpPb.HttpMethod_Unregistered{
			Unregistered: strings.ToUpper(method),
		},
	}
}

// ReadAllLimit reads from r until EOF or until limit bytes are read. If EOF is
// reached, the full bytes are returned. If the limit is reached, an error is
// returned.
func ReadAllLimit(r io.Reader, limit int) ([]byte, error) {
	bytes, err := io.ReadAll(io.LimitReader(r, int64(limit)+1))
	if err != nil {
		return nil, err
	}
	if len(bytes) > limit {
		return nil, fmt.Errorf("limit reached while reading: %d", limit)
	}
	return bytes, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15664** (2026-09-26): **version-2.20 tag was moved at some point**
  *Symptoms*: ### What is the issue?  https://github.com/Homebrew/homebrew-core/pull/299023  Hello, this is a homebrew maintainer and I have noticed that the tag was moved at some point. There was a PR to fix this but we haven't check it is intended or not.   Can you check the moved commit for tag v2.2.0 is valid and fine to use? Then I will open a new PR to fix this.  Thanks,  ### How can it be reproduced?  ``` brew install linkerd --build-from-source ```  ### Logs, error output, etc  ``` ==> Fetching downloads for: linkerd ✘ Formula linkerd (2.20) Error: version-2.20 tag should be 7977d505fc3d9ae7dddddd11779a82f813e405ac but is actually eadc1acf79ad2e766afbdceadb77f1594296fd77 ```  ### output of `linkerd check -o short`  none  ### Environment  MacOS 26  ### Possible solution  Just check wheth  ### Additional context  _No response_  ### Would you like to work on fixing this bug?  None
  **Post-Mortem & Fix Analysis**:
  > Formula is now deprecated. - https://github.com/Homebrew/homebrew-core/pull/312030
  > @daeho-ro Thanks for raising this! I had written a response to this last week and apparently never hit RETURN. 🙁   `version-2.20` actually wasn't moved: it was never the same as its associated edge release although it should've been, so the `eadc1acf` commit is actually correct. Can I just PR that into `homebrew-core`, or is there some other process here?  Thanks!

- **Issue #15551** (2026-08-21): **linkerd-destination panics with a nil pointer dereference when an ExternalWorkload is deleted**
  *Symptoms*: ### What is the issue?  `linkerd-destination` panics with a nil pointer dereference when an `ExternalWorkload` is deleted, if any proxy currently holds a discovery subscription for that workload's IP:port.  ### How can it be reproduced?  1. Mesh an external workload so an `ExternalWorkload` exists with `spec.ports` and `spec.workloadIPs`. 2. Send traffic to it, so a proxy holds an active discovery subscription for that IP:port. 3. Delete the `ExternalWorkload`.  ### Logs, error output, etc  Raw logs: ~~~~ panic: runtime error: invalid memory address or nil pointer dereference [signal SIGSEGV: segmentation violation code=0x1 addr=0x20 pc=0x1eb6c35]  goroutine 98438 [running]: watcher.(*workloadPublisher).updateExternalWorkload(0xc0022db0e0, 0x0) 	controller/api/destination/watcher/workload_watcher.go:774 +0x175 watcher.(*WorkloadWatcher).submitExternalWorkloadUpdate(0xc000666a80, 0xc000a11380, 0xd0?) 	controller/api/destination/watcher/workload_watcher.go:314 +0x1e5 created by watcher.(*WorkloadWatcher).deleteExternalWorkload in goroutine 211 	controller/api/destination/watcher/workload_watcher.go:239 +0x168 ~~~~  ### output of `linkerd check -o short`  ``` linkerd-identity ---------------- ‼ issuer cert is valid for at least 60 days     issuer certificate will expire on [REDACTED]  linkerd-version --------------- ‼ cli is up-to-date     is running version 2.20.0 but the latest enterprise version is 2.20.1  control-plane-version --------------------- ‼ control plane is up-to-d

- **Issue #15548** (2026-08-21): **Deleting a MeshTLSAuthentication referenced by an AuthorizationPolicy does not revoke access**
  *Symptoms*: ### What is the issue?  When an `AuthorizationPolicy` references a `MeshTLSAuthentication` and that `MeshTLSAuthentication` is deleted, traffic from the formerly-authorized client continues to be accepted, even though the `Server` has `accessPolicy: deny` and the referenced authentication resource no longer exists.  Restarting the protected workload's pod does not change the behaviour. After restarting `linkerd-destination`, the requests are denied as expected.  Expected: deleting a `MeshTLSAuthentication` referenced by an `AuthorizationPolicy` revokes the authorization, and the affected server falls back to its default deny access policy without any restart. This is security-relevant, since revoking a client's access has no effect at the time of revocation.  ### How can it be reproduced?  1. Apply the manifests below. 2. Verify the client can reach the server (HTTP 200):    ```bash    kubectl exec -n demo deploy/client -c client -- \      curl -sS -o /dev/null -w '%{http_code}\n' http://server:8080/    ``` 3. Delete the authentication resource:    ```bash    kubectl delete meshtlsauthentication -n demo client-auth    ``` 4. Repeat the request from step 2 -> still 200 (expected: 403). 5. `kubectl rollout restart deploy/server -n demo`, wait for rollout, repeat the request -> still 200. 6. `kubectl rollout restart deploy/linkerd-destination -n linkerd`, wait for rollout, repeat the request -> 403, as expected.  [Manifests for reproduction](https://gist.github.com/bkittinger/0e
  **Post-Mortem & Fix Analysis**:
  > Just realized that this apparently has already been fixed in #15326 and included in 26.6.2. We'll test with a newer version of linkerd and verify that this behavior does not occur anymore.
  > Tested with 26.6.3 - in that release the problem no longer occurs.

- **Issue #15506** (2026-08-04): **policy-controller leader election panic**
  *Symptoms*: ### What is the issue?  The status controller task inside the policy container of linkerd-destination entered a crash loop on 2026-07-21, cycling through all linkerd-destination replicas with 7,591 lease transitions before going silent. Because the panic occurs inside a Tokio-spawned task (not the main process thread), the container process never exits, Kubernetes never restarts it, and the failure is invisible: restarts=0, ready=true. After the loop stopped, no status controller held the lease. New policy resources (Server, HTTPRoute, AuthorizationPolicy) deployed after the crash are never reconciled — proxies don't receive route policies and silently fall back to the server's accessPolicy default.  ### How can it be reproduced?  Not really sure how to re-pro it, but this is described in [an old PR #10584](https://github.com/linkerd/linkerd2/pull/10584). The only thing I can think of is to reproduce a kube-api failure (of getting/checking the lease) by just deleting the lease itself.  ### Logs, error output, etc  very pod that won the policy-controller-write leader election immediately panicked:  {"message":"Status controller leadership change","leader":"true",...} thread 'tokio-rt-worker' panicked at /build/policy-controller/k8s/status/src/index.rs:267:25: Claims watch must not be dropped: RecvError(()) thread 'tokio-rt-worker' panicked at /build/policy-controller/k8s/status/src/index.rs:407:25: Claims watch must not be dropped: RecvError(())  The Kubernetes policy-controll

- **Issue #15414** (2026-08-26): **http/retry: PeekTrailersBody reports exact DATA size when trailers are buffered, causing  intermittent gRPC-Web missing trailers**
  *Symptoms*: ### What is the issue?  # http/retry: PeekTrailersBody reports exact DATA size when trailers are buffered, causing intermittent gRPC-Web missing trailers  ## Summary  We are seeing intermittent gRPC-Web responses where the client receives HTTP 200 and the DATA frame, but the gRPC-Web trailer frame is missing.  The failing response looks like:  ```text http_status=200 http_content_length=-1 http_transfer_encoding=chunked body_bytes=5 data_frames=1 has_trailer=false trailer_bytes=0 grpc_web_code=unknown ```  The 5-byte body is the empty gRPC-Web DATA frame:  ```text 00 00 00 00 00 ```  The expected successful response is 26 bytes:  ```text 5-byte DATA frame + gRPC-Web trailer frame containing grpc-status: 0 ```  So the response is being terminated after DATA, before the trailer frame is delivered.  ## Impact  gRPC-Web clients fail with errors equivalent to:  ```text missing trailer ```  or receive a 200 response that cannot be interpreted as a valid gRPC-Web response because `grpc-status` is absent.  ## Observed environment  Observed with Linkerd proxy:  ```text edge-26.5.1 ```  Topology:  ```text HTTP/1.1 gRPC-Web client   -> meshed Traefik   -> meshed API service   -> meshed downstream gRPC service ```  The downstream service returns OK. The API service also logs successful egress.  ## Regression finding  We added a deterministic unit test for `PeekTrailersBody`:  ```text DATA("hello") + immediate TRAILERS -> trailers are peeked -> size_hint.lower() == 5 -> size_hint.exact() 
  **Post-Mortem & Fix Analysis**:
  > This is specific enough for a focused regression test around http/retry: PeekTrailersBody reports exact DATA size when trailers are buffered, causing interm.... The test should set up the failing path, assert the intended behavior, and include the current error or bad output so the fix is not only verified manually. `grpc-status` is a useful concrete anchor because it is named directly in the report. 

- **Issue #15223** (2026-05-08): **Linkerd SetToServerProtocol() cross-namespace bug**
  *Symptoms*: ### What is the issue?   ## Title  `SetToServerProtocol()` matches Server resources across namespaces, causing cluster-wide protocol hint poisoning  ## Bug Report  ### What is the issue?  `SetToServerProtocol()` in `controller/api/destination/watcher/endpoints_watcher.go` lists all Server resources cluster-wide without filtering by namespace. When a Server with `proxyProtocol: opaque` exists in any namespace, it marks pods in **every** namespace as opaque if their labels match the Server's `podSelector`.  This contradicts the Server CRD being namespace-scoped and can cause cluster-wide outages.  ### Affected code  https://github.com/linkerd/linkerd2/blob/main/controller/api/destination/watcher/endpoints_watcher.go  ```go func SetToServerProtocol(k8sAPI *k8s.API, address *Address, log *logging.Entry) error {     servers, err := k8sAPI.Srv().Lister().Servers("").List(labels.Everything())     // ^^^ Lists ALL Servers across ALL namespaces — no namespace filter      for _, server := range servers {         if server.Spec.ProxyProtocol == opaqueProtocol &&            selector.Matches(labels.Set(address.Pod.Labels)) {             if portMatch {                 address.OpaqueProtocol = true             }         }     } } ```  Note: `updateServer()` in the same file correctly filters by namespace:  ```go func (ew *EndpointsWatcher) updateServer(...) {     for id, sp := range ew.publishers {         if id.Namespace == namespace {  // ← Correct: namespace-scoped             sp.updateS

- **Issue #15200** (2026-04-29): **Service mirror cleanup logic does not respect namespaces**
  *Symptoms*: ### What is the issue?  We have two headless multi-cluster services with the same name (and thus the same `mirror.linkerd.io/headless-mirror-svc-name` label on all endpoint mirror services) in two different namespaces. These services front a StatefulSet with differing numbers of replicas. On reconcile, the service mirror controller seems to be deleting the endpoint mirror services for pods that are healthy in the remote cluster. I'd expect the service mirror to leave the endpoint mirror services for the healthy pods alone.  I also posted about this issue in the Slack channel [here](https://linkerd.slack.com/archives/C89RTCWJF/p1776779919651119).  ### How can it be reproduced?  1.  Create two headless services and StatefulSets with the same name in two separate namespaces in the remote cluster. 2. Set the number of replicas to 1 and 2 for the first and second STS, respectively. 3. On reconcile, check that there is only 1 endpoint mirror service in the local cluster for the namespace with 2 replicas. The endpoint mirror service for the second replica will be missing or created and then quickly deleted.  This pattern doesn't happen on every reconcile but you should notice a lot of churn for the 2nd replica's endpoint mirror service.  ### Logs, error output, etc  Controller logs: ``` time="2026-04-21T13:49:36Z" level=info msg="Creating a new endpoint mirror service gf-lw-production-usa-t2j9zb/c4t2a-xl-gpt-1-2-gke-us-central1-prod for exported headless service gf-lw-production-usa

- **Issue #15199** (2026-08-24): **linkerd-proxy mangles error code / message / trailer forwarding for sufficiently large messages**
  *Symptoms*: ### What is the issue?  In some release _after_ edge-25.2.1, linkerd-proxy began failing to forward gRPC status codes, error messages and trailers in cases where the total gRPC response trailer size was at or over roughly 12 kilobytes. The error message generated by the server is replaced by code 13, the message is replaced by `stream terminated by RST_STREAM with error code: INTERNAL_ERROR`, and no trailer information is forwarded.  This is tested on server version edge-26.4.2.  ### How can it be reproduced?  I have put together a full demonstration of this effect as a client-server combo and a helm chart:  https://github.com/odenio/echoerror  To install on your cluster, run:  ``` helm upgrade --install echoerror ./chart/echoerror ```  To vary the amount of requested data in the trailers, add `--set client.padMessageKb=<int>`.  This is a toy server implementation that implements a single gRPC API, `EchoError`, which takes an `EchoRequest` message that lets the client specify the kind of result it wants:  ``` message EchoRequest {   int32 code = 1;   string message = 2;   int32 pad_message_kb = 3; } ```  The client code continuously sends messages to the server, iterating over codes `0` through `16`, generating a random `message` per request, and setting a configured padding size. The response from the server is then compared to the request and any mismatch is logged.  On our cluster, if pad_message_kb is set to `11` or below, no mismatch errors are noted. But if it is set to
  **Post-Mortem & Fix Analysis**:
  > thank you very much for filing this, and for including a reproduction @n-oden. i am going to start working on fixing this issue this week.
  > @cratelyn you're quite welcome; please let me know if I can provide any more details/telemetry
  > ## Update: Fix Available in linkerd2-proxy  This issue is caused by a bug in the linkerd2-proxy's HTTP/2 trailer handling. The fix has been implemented in the proxy repository:  **Proxy Fix PR:** https://github.com/wahajahmed010/linkerd2-proxy/pull/1  ### Root Cause The regression was introduced when linkerd2-proxy upgraded from `h2 0.3.26` to `h2 0.4.x` between proxy v2.277.0 (working) and v2.290.0+ (broken). When gRPC trailers exceed ~12KB (the HTTP/2 MAX_FRAME_SIZE limit), the h2 0.4.x series had bugs in how HEADERS frames were sent on reset streams, causing trailers to be dropped and RST_STREAM(INTERNAL_ERROR) to be sent instead.  ### Fix Bumping `h2` from `0.4.13` to `0.4.14` in linkerd2-proxy resolves the issue. The h2 0.4.14 release includes: - Fix sending HEADERS on a reset stream before the RST_STREAM frame - Fix leaking connection flow control of padded DATA frames - Optimizations for header value decoding  Once linkerd2-proxy is updated, the `.proxy-version` in this repo wil

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

### Incident Patch 1: `e7c15f3a` (2026-10-01)
**Commit Message**: build(deps): bump clap_lex from 1.1.0 to 1.1.1 in the clap group (#15686)

Bumps the clap group with 1 update: [clap_lex](https://github.com/clap-rs/clap).


Updates `clap_lex` from 1.1.0 to 1.1.1
- [Release notes](https://github.com/clap-rs/clap/releases)
- [Changelog](https://github.com/clap-rs/clap/blob/main/CHANGELOG.md)
- [Commits](https://github.com/clap-rs/clap/compare/clap_lex-v1.1.0...clap_lex-v1.1.1)

---
updated-dependencies:
- dependency-name: clap_lex
  dependency-version: 1.1.1
  dependency-type: indirect
  update-type: version-update:semver-patch
  dependency-group: clap
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -278,9 +278,9 @@ dependencies = [
 
 [[package]]
 name = "clap_lex"
-version = "1.1.0"
+version = "1.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
+checksum = "1c133bc6a41be0d194c306b5506d15e6feeea7b1d6604bd3f8310dfb2ca96486"
 
 [[package]]
 name = "cmake"
```

---

### Incident Patch 2: `7065a67b` (2026-10-01)
**Commit Message**: build(deps-dev): bump webpack from 5.110.3 to 5.111.1 in /web/app (#15677)

Bumps [webpack](https://github.com/webpack/webpack) from 5.110.3 to 5.111.1.
- [Release notes](https://github.com/webpack/webpack/releases)
- [Changelog](https://github.com/webpack/webpack/blob/main/CHANGELOG.md)
- [Commits](https://github.com/webpack/webpack/compare/v5.110.3...v5.111.1)

---
updated-dependencies:
- dependency-name: webpack
  dependency-version: 5.111.0
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `web/app/package.json` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@
     "sinon-stub-promise": "4.0.0",
     "style-loader": "^4.0.0",
     "url-loader": "^4.1.1",
-    "webpack": "^5.110.3",
+    "webpack": "^5.111.1",
     "webpack-bundle-analyzer": "5.4.0",
     "webpack-cli": "7.2.3",
     "webpack-dev-server": "5.2.5"
```

**File**: `web/app/yarn.lock` (modified, +39/-31)
```diff
@@ -2516,7 +2516,7 @@
     "@types/tough-cookie" "*"
     parse5 "^7.0.0"
 
-"@types/json-schema@*", "@types/json-schema@^7.0.15", "@types/json-schema@^7.0.8", "@types/json-schema@^7.0.9":
+"@types/json-schema@*", "@types/json-schema@^7.0.15", "@types/json-schema@^7.0.8":
   version "7.0.15"
   resolved "https://registry.yarnpkg.com/@types/json-schema/-/json-schema-7.0.15.tgz#596a1747233694d50f6ad8a7869fcb6f56cf5841"
   integrity sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==
@@ -2950,7 +2950,7 @@ acorn-walk@^8.0.0:
   resolved "https://registry.yarnpkg.com/acorn-walk/-/acorn-walk-8.2.0.tgz#741210f2e2426454508853a2f44d0ab83b7f69c1"
   integrity sha512-k+iyHEuPgSw6SbuDpGQM+06HQUa04DZ3o+F6CSzXMvvI5KMvnaEqXe+YVe555R9nn6GPt404fos4wcgpw12SDA==
 
-acorn@^8.0.4, acorn@^8.15.0, acorn@^8.16.0, acorn@^8.5.0, acorn@^8.9.0:
+acorn@^8.0.4, acorn@^8.15.0, acorn@^8.5.0, acorn@^8.9.0:
   version "8.18.0"
   resolved "https://registry.yarnpkg.com/acorn/-/acorn-8.18.0.tgz#4faf01b2d6d326bfeed97aea1f52220b5f4c1940"
   integrity sha512-lGq+9yr1/GuAWaVYIHRjvvySG5/4VfKIvC8EWxStPdcDh/Ka7FG3twP6v4d5BkravUilhIAsG4Qj83t02LWUPQ==
@@ -2975,10 +2975,10 @@ airbnb-prop-types@^2.16.0:
     prop-types-exact "^1.2.0"
     react-is "^16.13.1"
 
-ajv-formats@^2.1.1:
-  version "2.1.1"
-  resolved "https://registry.yarnpkg.com/ajv-formats/-/ajv-formats-2.1.1.tgz#6e669400659eb74973bbf2e33327180a0996b520"
-  integrity sha512-Wx0Kx52hxE7C18hkMEggYlEifqWZtYaRgouJor+WMdPnQyEK13vgEWyVNup7SoeeoLMsr4kf5h6dOW11I15MUA==
+ajv-formats@^3.0.1:
+  version "3.0.1"
+  resolved "https://registry.yarnpkg.com/ajv-formats/-/ajv-formats-3.0.1.tgz#3d5dc762bca17679c3c2ea7e90ad6b7532309578"
+  integrity sha512-8iUql50EUR+uUcdRQ3HDqa6EVyo3docL8g5WJ3FNcWmu62IbkGUue/pEyLBW8VGKKucTPgqeks4fIU1DA4yowQ==
   dependencies:
     ajv "^8.0.0"
 
@@ -3004,7 +3004,7 @@ ajv@^6.12.4, ajv@^6.12.5:
     json-schema-traverse "^0.4.1"
     uri-js "^4.2.2"
 
-ajv@^8.0.0, ajv@^8.9.0:
+ajv@^8.0.0:
   version "8.12.0"
   resolved "https://registry.yarnpkg.com/ajv/-/ajv-8.12.0.tgz#d1a0527323e22f53562c567c00991577dfbe19d1"
   integrity sha512-sRu1kpcO9yLtYxBKvqfTeh9KzZEwO3STyX1HT+4CaDzC6HpTGYhIhPIzj9XuKU7KYDwnaeh5hcOwjy1QuJzBPA==
@@ -3014,6 +3014,16 @@ ajv@^8.0.0, ajv@^8.9.0:
     require-from-string "^2.0.2"
     uri-js "^4.2.2"
 
+ajv@^8.20.0:
+  version "8.20.0"
+  resolved "https://registry.yarnpkg.com/ajv/-/ajv-8.20.0.tgz#304b3636add88ba7d936760dd50ece006dea95f9"
+  integrity sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA==
+  dependencies:
+    fast-deep-equal "^3.1.3"
+    fast-uri "^3.0.1"
+    json-schema-traverse "^1.0.0"
+    require-from-string "^2.0.2"
+
 ansi-escapes@^4.2.1, ansi-escapes@^4.3.2:
   version "4.3.2"
   resolved "https://registry.yarnpkg.com/ansi-escapes/-/ansi-escapes-4.3.2.tgz#6b2291d1db7d98b6521d5f1efa42d0f3a9feb65e"
@@ -4553,10 +4563,10 @@ encodeurl@~2.0.0:
   resolved "https://registry.yarnpkg.com/encodeurl/-/encodeurl-2.0.0.tgz#7b8ea898077d7e409d3ac45474ea38eaf0857a58"
   integrity sha512-Q0n9HRi4m6JuGIV1eFlmvJB7ZEVxu93IrMyiMsGC0lrMJMWzRgx6WGquyfQgZVb31vhGgXnfmPNNXmxnOkRBrg==
 
-enhanced-resolve@^5.24.4:
-  version "5.24.5"
-  resolved "https://registry.yarnpkg.com/enhanced-resolve/-/enhanced-resolve-5.24.5.tgz#b4dad3255b7545f07ba5535189868e9f85f47573"
-  integrity sha512-L1l8TNvomm6UVW5B253AGxQagSQr+vGwhMlrrfRS2qmhx46AMpMVJKQYLvWYbysTMY8VoicOvzHzoHMbyzB+4A==
+enhanced-resolve@^5.25.0:
+  version "5.26.0"
+  resolved "https://registry.yarnpkg.com/enhanced-resolve/-/enhanced-resolve-5.26.0.tgz#9dfb47d050ed6c87f2c6d43b4d7e30f8c0a91ed7"
+  integrity sha512-9vhedylFonb2YGogzUKX6+Ja72gOJbN1QHAqdrvqLwhdl/QWbKopzoUC9EbQNVsAns/bx/4uyqalrQAoy1IByw==
   dependencies:
     graceful-fs "^4.2.4"
     tapable "^2.3.3"
@@ -5449,6 +5459,11 @@ fast-levenshtein@^2.0.6:
   resolved "https://registry.yarnpkg.com/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz#3d8a5c66883a16a30ca8643e851f19baa7797917"
   integrity sha1-PYpcZog6FqMMqGQ+hR8Zuqd5eRc=
 
+fast-uri@^3.0.1:
+  version "3.1.8"
+  resolved "https://registry.yarnpkg.com/fast-uri/-/fast-uri-3.1.8.tgz#f7db8d942e20eead3cfe93b0beeb4eb0169e938b"
+  integrity sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==
+
 fastq@^1.6.0:
   version "1.13.0"
   resolved "https://registry.yarnpkg.com/fastq/-/fastq-1.13.0.tgz#616760f88a7526bdfc596b7cab8c18938c36b98c"
@@ -7943,11 +7958,6 @@ negotiator@~0.6.4:
   resolved "https://registry.yarnpkg.com/negotiator/-/negotiator-0.6.4.tgz#777948e2452651c570b712dd01c23e262713fff7"
   integrity sha512-myRT3DiWPHqho5PrJaIRyaMv2kgYf0mUVgBNOYMuCH5Ki1yEiQaf/ZJuQ62nvpc44wL5WDbTX7yGJi1Neevw8w==
 
-neo-async@^2.6.2:
-  version "2.6.2"
-  resolved "https://registry.yarnpkg.com/neo-async/-/neo-async-2.6.2.tgz#b4aafb93e3aeb2d8174ca53cf163ab7d7308305f"
-  integrity sha512-Yd3UES5mWCSqR+qNT93S3UoYUkqAZ9lLg8a7g9rimsWmYGK8cVToA4/sF3RrshdyV3sAGMXVUmpMYOw+dLpOuw==
-
 no-case@^3.0.4
```

---

### Incident Patch 3: `66d17ce4` (2026-10-01)
**Commit Message**: build(deps): bump the kube group across 1 directory with 7 updates (#15683)

Bumps the kube group with 7 updates in the / directory:

| Package | From | To |
| --- | --- | --- |
| [k8s.io/api](https://github.com/kubernetes/api) | `0.37.0` | `0.37.1` |
| [k8s.io/apiextensions-apiserver](https://github.com/kubernetes/apiextensions-apiserver) | `0.37.0` | `0.37.1` |
| [k8s.io/apimachinery](https://github.com/kubernetes/apimachinery) | `0.37.0` | `0.37.1` |
| [k8s.io/client-go](https://github.com/kubernetes/client-go) | `0.37.0` | `0.37.1` |
| [k8s.io/code-generator](https://github.com/kubernetes/code-generator) | `0.37.0` | `0.37.1` |
| [k8s.io/endpointslice](https://github.com/kubernetes/endpointslice) | `0.37.0` | `0.37.1` |
| [k8s.io/kube-aggregator](https://github.com/kubernetes/kube-aggregator) | `0.37.0` | `0.37.1` |



Updates `k8s.io/api` from 0.37.0 to 0.37.1
- [Commits](https://github.com/kubernetes/api/compare/v0.37.0...v0.37.1)

Updates `k8s.io/apiextensions-apiserver` from 0.37.0 to 0.37.1
- [Release notes](https://github.com/kubernetes/apiextensions-apiserver/releases)
- [Commits](https://github.com/kubernetes/apiextensions-apiserver/compare/v0.37.0...v0.37.1)

Updates `

**File**: `go.mod` (modified, +9/-9)
```diff
@@ -41,14 +41,14 @@ require (
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v2 v2.4.0
 	helm.sh/helm/v3 v3.22.0
-	k8s.io/api v0.37.0
-	k8s.io/apiextensions-apiserver v0.37.0
-	k8s.io/apimachinery v0.37.0
-	k8s.io/client-go v0.37.0
-	k8s.io/code-generator v0.37.0
-	k8s.io/endpointslice v0.37.0
+	k8s.io/api v0.37.1
+	k8s.io/apiextensions-apiserver v0.37.1
+	k8s.io/apimachinery v0.37.1
+	k8s.io/client-go v0.37.1
+	k8s.io/code-generator v0.37.1
+	k8s.io/endpointslice v0.37.1
 	k8s.io/klog/v2 v2.140.0
-	k8s.io/kube-aggregator v0.37.0
+	k8s.io/kube-aggregator v0.37.1
 	k8s.io/utils v0.0.0-20260626114624-be93311217bd
 	sigs.k8s.io/gateway-api v0.8.1
 	sigs.k8s.io/yaml v1.6.0
@@ -62,7 +62,7 @@ require (
 	github.com/go-openapi/swag/pools v0.29.1 // indirect
 	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
 	golang.org/x/net v0.59.0 // indirect
-	k8s.io/streaming v0.37.0 // indirect
+	k8s.io/streaming v0.37.1 // indirect
 )
 
 require (
@@ -152,7 +152,7 @@ require (
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/cli-runtime v0.37.0 // indirect
-	k8s.io/component-base v0.37.0 // indirect
+	k8s.io/component-base v0.37.1 // indirect
 	k8s.io/gengo/v2 v2.0.0-20260408192533-25e2208e0dc3 // indirect
 	k8s.io/kube-openapi v0.0.0-20260721132016-d427ff9ee9ad // indirect
 	k8s.io/kubectl v0.37.0 // indirect
```

**File**: `go.sum` (modified, +18/-18)
```diff
@@ -711,34 +711,34 @@ honnef.co/go/tools v0.0.0-20190418001031-e561f6794a2a/go.mod h1:rf3lG4BRIbNafJWh
 honnef.co/go/tools v0.0.0-20190523083050-ea95bdfd59fc/go.mod h1:rf3lG4BRIbNafJWhAfAdb/ePZxsR/4RtNHQocxwk9r4=
 honnef.co/go/tools v0.0.1-2019.2.3/go.mod h1:a3bituU0lyd329TUQxRnasdCoJDkEUEAqEt0JzvZhAg=
 honnef.co/go/tools v0.0.1-2020.1.3/go.mod h1:X/FiERA/W4tHapMX5mGpAtMSVEeEUOyHaw9vFzvIQ3k=
-k8s.io/api v0.37.0 h1:Z//Vj9N7RA/yS2sDmxyeo7h+RR4zbUrd2vrd3Z0TbB4=
-k8s.io/api v0.37.0/go.mod h1:LKXgcJWMc+f4OLbP5SFR8rulEg07zZhpi/zMULiBImk=
-k8s.io/apiextensions-apiserver v0.37.0 h1:zRMQ3+/LIE5oZ0tVvXwYHC+dIkSP5cjNWju7AZU1LOI=
-k8s.io/apiextensions-apiserver v0.37.0/go.mod h1:HU0PfSBwchHL5iDau6jjt9zU6ryWkDDlaVUiq91NK80=
-k8s.io/apimachinery v0.37.0 h1:Np2AbDtf8x6RDHiD8T9LbKJ9gaegeVNa8yNm5FuGKm0=
-k8s.io/apimachinery v0.37.0/go.mod h1:RN3nhprFSCxOi5Selxd7oMTXOe/c+ZbcE7Im+TS2zkE=
+k8s.io/api v0.37.1 h1:l6N77U7tjwB5L056bgrBTJIEdevac/naBZ3iSvDNfpM=
+k8s.io/api v0.37.1/go.mod h1:zSlbB1YpJ1YQlFVQy20UYll81UJSJJUMLhkhvg6Z78M=
+k8s.io/apiextensions-apiserver v0.37.1 h1:7fIQG8eThDSTVYBWg/DOpI8v5wYfKCo0N8/TDMjj+zY=
+k8s.io/apiextensions-apiserver v0.37.1/go.mod h1:1Q3ujWwHgnhBoGsdmGORflwK1sDFmuaqH1OsMDWk2Gs=
+k8s.io/apimachinery v0.37.1 h1:hGCYyvKHCwtwMitj2vU4vYx0Z16N9GyZk9BBnz0wDAE=
+k8s.io/apimachinery v0.37.1/go.mod h1:jF84AyUi/IRIXRot5f+lm6MpxoWI+F1XgjaMmwCdTFw=
 k8s.io/cli-runtime v0.37.0 h1:U3XakUeirBQJMz5688r04z74SIHSE7V5SIZ6Ho5JyBM=
 k8s.io/cli-runtime v0.37.0/go.mod h1:qiQMFkKwFFuPH6zy953On+nc3qfpEHAIDrJmAuRz5Vg=
-k8s.io/client-go v0.37.0 h1:nsN31fy8wBySuZ+QRnKmrjRSQLOG2rvoGN0tKd12zhQ=
-k8s.io/client-go v0.37.0/go.mod h1:FcGqw+Ll/gNQiq+nPGY1Oyt9y7SgDh1d3MW3RFDEbn0=
-k8s.io/code-generator v0.37.0 h1:AC915wukzlVHHODAQYxvQ25WKibPh95faJ2kxf8dzuo=
-k8s.io/code-generator v0.37.0/go.mod h1:qg7E/uDlyvevVRL1V8+h2z9UWmi/8gxaRka/lVXUBdk=
-k8s.io/component-base v0.37.0 h1:3SdSa4+itMdFTDFTeR8CxKGmSTSMXFlKL4ky8OqjguM=
-k8s.io/component-base v0.37.0/go.mod h1:LjOebp4R9y6LODWZQv102ZQxGheLcDO2ZJLAw6bbh4I=
-k8s.io/endpointslice v0.37.0 h1:rMBfGPa/p95uEQsTiL4chTOelJFR+XPl8aWcor4ng6Y=
-k8s.io/endpointslice v0.37.0/go.mod h1:PbotyEtd2DIpPHPp9ZgJsJHCBJuAEh2Oz21V5MyAYX4=
+k8s.io/client-go v0.37.1 h1:QTv/5ha4jAHtW9qxxVBkQVFBRDb4jHfFopQqqMdc+wM=
+k8s.io/client-go v0.37.1/go.mod h1:dnAPtTnCNY38Ho04D2KdY1F4IKausa9UbqaAZKl60SY=
+k8s.io/code-generator v0.37.1 h1:tvxxAiGc2kMxoGx8HtUacs4cBdl0X5R+auBD2He974U=
+k8s.io/code-generator v0.37.1/go.mod h1:RJepz1uW2WnHEwPDoCGzI3p4V23C7WuUdtqjueDl1uU=
+k8s.io/component-base v0.37.1 h1:93DMmlENnK7gNLkL4pMqLO5M/HVf3p3sM4q/GasLveY=
+k8s.io/component-base v0.37.1/go.mod h1:bBrdziT4dreQG5lzTaPVxBwsZe1oxphG+ZVdD56dQWQ=
+k8s.io/endpointslice v0.37.1 h1:gfVt44yK6K0ySUNoroZkKaXs/V8gp8RLkHv9nKdyChs=
+k8s.io/endpointslice v0.37.1/go.mod h1:l6dsigwL1Dl6tH7qfEA0RGbZ1Pwciiq0xUvdpDnZL9A=
 k8s.io/gengo/v2 v2.0.0-20260408192533-25e2208e0dc3 h1:3L6PNkMLXkU/pz3jWzaaIUz0Rs2V9h+5O51AeRC7poc=
 k8s.io/gengo/v2 v2.0.0-20260408192533-25e2208e0dc3/go.mod h1:yvyl3l9E+UxlqOMUULdKTAYB0rEhsmjr7+2Vb/1pCSo=
 k8s.io/klog/v2 v2.140.0 h1:Tf+J3AH7xnUzZyVVXhTgGhEKnFqye14aadWv7bzXdzc=
 k8s.io/klog/v2 v2.140.0/go.mod h1:o+/RWfJ6PwpnFn7OyAG3QnO47BFsymfEfrz6XyYSSp0=
-k8s.io/kube-aggregator v0.37.0 h1:XCCpIDBzwM1s+FdQEiTuyFcPtByVLfJ7NyVrj8YDbTw=
-k8s.io/kube-aggregator v0.37.0/go.mod h1:Uy1F5FUItTfFfsx1T+cP+7uqKvV3J8/jjBxVzc/ICYU=
+k8s.io/kube-aggregator v0.37.1 h1:P5ksohEbY6xbSyHgZcd+ofhCekMN9zqeCeSylrLHnCY=
+k8s.io/kube-aggregator v0.37.1/go.mod h1:7rWjY2B0eVUqzXwPkdI/RCeyyTt25F6jvz/6hjPfGIg=
 k8s.io/kube-openapi v0.0.0-20260721132016-d427ff9ee9ad h1:oXImqH8mQNk7PmvzKhmN3ddJoY6OnyM225MXwGHPm0A=
 k8s.io/kube-openapi v0.0.0-20260721132016-d427ff9ee9ad/go.mod h1:0/mqHCVhlumdJ3BhCfnjSZQE037nAhNodh1/hK0T8/I=
 k8s.io/kubectl v0.37.0 h1:cici6hiofx93ASldmprDmZF55SfhVt4o3HniltVLjTc=
 k8s.io/kubectl v0.37.0/go.mod h1:RSeEl8e/yqDx6srG8Azr0uAtVPNIZljA0PNh9HCBcdg=
-k8s.io/streaming v0.37.0 h1:iPBUZLZiKt5bV+lxJurASMOV07VuBhNpiwJt2//AWrM=
-k8s.io/streaming v0.37.0/go.mod h1:APlJR26ZWRcVy5bIEj0QRrKUXROtBHPcxl2NT7EAzPU=
+k8s.io/streaming v0.37.1 h1:TpzVfQeFuVndn2g9mFqxy1UcUYPwDzqjUmwR/IzJCWc=
+k8s.io/streaming v0.37.1/go.mod h1:APlJR26ZWRcVy5bIEj0QRrKUXROtBHPcxl2NT7EAzPU=
 k8s.io/utils v0.0.0-20260626114624-be93311217bd h1:Ea7fgQ5we8Y9T0OX5o0dAHzQOBRI07D/dEYRaB9ZZEs=
 k8s.io/utils v0.0.0-20260626114624-be93311217bd/go.mod h1:xDxuJ0whA3d0I4mf/C4ppKHxXynQ+fxnkmQH0vTHnuk=
 oras.land/oras-go/v2 v2.6.2 h1:N04RXngAp1LJKTG6ifz3xHPipasEkWr+hFmInja5YKo=
```

---

### Incident Patch 4: `8f398ed9` (2026-09-30)
**Commit Message**: build(deps): bump docker/setup-buildx-action (#15674)

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.3.0 to 4.4.1.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/37fe631027851001ddb9b187196cc803df7f5f0e...f87e5991a6d7451dcb8d9637bfbc97413f497069)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.4.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/actions/docker-build/action.yml` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ runs:
     # populate ACTIONS_CACHE_URL and ACTIONS_RUNTIME_TOKEN
     - uses: crazy-max/ghaction-github-runtime@04d248b84655b509d8c44dc1d6f990c879747487
     - uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1
-    - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
+    - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069
       with:
         driver-opts: network=host
     - env:
```

---

### Incident Patch 5: `aa8cbca0` (2026-09-30)
**Commit Message**: build(deps): bump google.golang.org/grpc from 1.83.2 to 1.84.0 (#15680)

Bumps [google.golang.org/grpc](https://github.com/grpc/grpc-go) from 1.83.2 to 1.84.0.
- [Release notes](https://github.com/grpc/grpc-go/releases)
- [Commits](https://github.com/grpc/grpc-go/compare/v1.83.2...v1.84.0)

---
updated-dependencies:
- dependency-name: google.golang.org/grpc
  dependency-version: 1.84.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +4/-4)
```diff
@@ -36,7 +36,7 @@ require (
 	github.com/spf13/pflag v1.0.10
 	go.opencensus.io v0.24.0
 	golang.org/x/tools v0.50.0
-	google.golang.org/grpc v1.83.2
+	google.golang.org/grpc v1.84.0
 	google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.6.2
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v2 v2.4.0
@@ -146,9 +146,9 @@ require (
 	golang.org/x/text v0.42.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
 	golang.org/x/tools/godoc v0.1.0-deprecated // indirect
-	google.golang.org/api v0.143.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/api v0.278.0 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260706201446-f0a921348800 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/cli-runtime v0.37.0 // indirect
```

**File**: `go.sum` (modified, +10/-10)
```diff
@@ -112,8 +112,8 @@ github.com/exponent-io/jsonpath v0.0.0-20210407135951-1de76d718b3f h1:Wl78ApPPB2
 github.com/exponent-io/jsonpath v0.0.0-20210407135951-1de76d718b3f/go.mod h1:OSYXu++VVOHnXeitef/D8n/6y4QV8uLHSFXX4NeXMGc=
 github.com/fatih/color v1.19.0 h1:Zp3PiM21/9Ld6FzSKyL5c/BULoe/ONr9KlbYVOfG8+w=
 github.com/fatih/color v1.19.0/go.mod h1:zNk67I0ZUT1bEGsSGyCZYZNrHuTkJJB+r6Q9VuMi0LE=
-github.com/felixge/httpsnoop v1.0.4 h1:NFTV2Zj1bL4mc9sqWACXbQFVBBg2W3GPvqp8/ESS2Wg=
-github.com/felixge/httpsnoop v1.0.4/go.mod h1:m8KPJKqk1gH5J9DgRY2ASl2lWCfGKXixSwevea8zH2U=
+github.com/felixge/httpsnoop v1.1.0 h1:3YtUj32ZZkqZtt3sZZsClsymw/QDuVfpNhoA31zeORc=
+github.com/felixge/httpsnoop v1.1.0/go.mod h1:Zqxgdd+1Rkcz8euOqdr7lqgCRJztwr5hp9vDSi5UZCE=
 github.com/foxcpp/go-mockdns v1.2.0 h1:omK3OrHRD1IWJz1FuFBCFquhXslXoF17OvBS6JPzZF0=
 github.com/foxcpp/go-mockdns v1.2.0/go.mod h1:IhLeSFGed3mJIAXPH2aiRQB+kqz7oqu8ld2qVbOu7Wk=
 github.com/frankban/quicktest v1.14.6 h1:7Xjx+VpznH+oBnejlPUj8oUpdxnVs4f8XU8WnHkI4W8=
@@ -628,8 +628,8 @@ google.golang.org/api v0.17.0/go.mod h1:BwFmGc8tA3vsd7r/7kR8DY7iEEGSU04BFxCo5jP/
 google.golang.org/api v0.18.0/go.mod h1:BwFmGc8tA3vsd7r/7kR8DY7iEEGSU04BFxCo5jP/sfE=
 google.golang.org/api v0.20.0/go.mod h1:BwFmGc8tA3vsd7r/7kR8DY7iEEGSU04BFxCo5jP/sfE=
 google.golang.org/api v0.25.0/go.mod h1:lIXQywCXRcnZPGlsd8NbLnOjtAoL6em04bJ9+z0MncE=
-google.golang.org/api v0.143.0 h1:o8cekTkqhywkbZT6p1UHJPZ9+9uuCAJs/KYomxZB8fA=
-google.golang.org/api v0.143.0/go.mod h1:FoX9DO9hT7DLNn97OuoZAGSDuNAXdJRuGK98rSUgurk=
+google.golang.org/api v0.278.0 h1:W7jiRvRi53VYFfZ/HoZjQBtJk7gOFbHD8ot1RzVZU6E=
+google.golang.org/api v0.278.0/go.mod h1:B9TqLBwJqVjp1mtt7WeoQwWRwvu/400y5lETOql+giQ=
 google.golang.org/appengine v1.1.0/go.mod h1:EbEs0AVv82hx2wNQdGPgUI5lhzA/G0D9YwlJXL52JkM=
 google.golang.org/appengine v1.4.0/go.mod h1:xpcJRLb0r/rnEns0DIKYYv+WjYCduHsrkT7/EB5XEv4=
 google.golang.org/appengine v1.5.0/go.mod h1:xpcJRLb0r/rnEns0DIKYYv+WjYCduHsrkT7/EB5XEv4=
@@ -656,10 +656,10 @@ google.golang.org/genproto v0.0.0-20200331122359-1ee6d9798940/go.mod h1:55QSHmfG
 google.golang.org/genproto v0.0.0-20200513103714-09dca8ec2884/go.mod h1:55QSHmfGQM9UVYDPBsyGGes0y52j32PQ3BqQfXhyH3c=
 google.golang.org/genproto v0.0.0-20200526211855-cb27e3aa2013/go.mod h1:NbSheEEYHJ7i3ixzK3sjbqSGDJWnxyFXZblF3eUsNvo=
 google.golang.org/genproto v0.0.0-20200527145253-8367513e4ece/go.mod h1:jDfRM7FcilCzHH/e9qn6dsT145K34l5v+OpcnNgKAAA=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260706201446-f0a921348800 h1:admdQBe8jR3VWhBsUrAOaF2Qw6K/+p5pSm1GN8+6Fw4=
+google.golang.org/genproto/googleapis/api v0.0.0-20260706201446-f0a921348800/go.mod h1:FPk7EXUKMtImne7AmknoYjT4QXqKIzzRbeQIXzLk6fQ=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800 h1:qEHAMpSaUhtD0p3NbEEI83HwNGFxEwaSJ1G9PLnCBZE=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
 google.golang.org/grpc v1.19.0/go.mod h1:mqu4LbDTu4XGKhr4mRzUsmM4RtVoemTSY81AxZiDr8c=
 google.golang.org/grpc v1.20.1/go.mod h1:10oTOabMzJvdu6/UiuZezV6QK5dSlG84ov/aaiqXj38=
 google.golang.org/grpc v1.21.1/go.mod h1:oYelfM1adQP15Ek0mdvEgi9Df8B9CZIaU1084ijfRaM=
@@ -671,8 +671,8 @@ google.golang.org/grpc v1.27.1/go.mod h1:qbnxyOmOxrQa7FizSgH+ReBfzJrCY1pSN7KXBS8
 google.golang.org/grpc v1.28.0/go.mod h1:rpkK4SK4GF4Ach/+MFLZUBavHOvF2JJB5uozKKal+60=
 google.golang.org/grpc v1.29.1/go.mod h1:itym6AZVZYACWQqET3MqgPpjcuV5QH3BxFS3IjizoKk=
 google.golang.org/grpc v1.33.2/go.mod h1:JMHMWHQWaTccqQQlmk3MJZS+GWXOdAesneDmEnv2fbc=
-google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
-google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
+google.golang.org/grpc v1.84.0 h1:soMyaPJ8pAak5PIQ0DGBUir0XRo2fRoMqhNWMLlLxO0=
+google.golang.org/grpc v1.84.0/go.mod h1:ljCht0DrxQrXBDRTZp52Qxh3Ffk8CdYm2sj4O2QN2C0=
 google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.6.2 h1:rgSNvqscFZ1JgV/4wH5GOsZFSFkR2Eua9As3KIr2LlM=
 google.golang.org/grpc/cmd/protoc-gen-go-grpc v1.6.2/go.mod h1:iMEtFwDlAhjDU9L5mY6U1XLwlIId/G3h+QcBHDIvrJ8=
 google.golang.org/protobuf v0.0.0-20200109180630-ec00e32a8dfd/go.mod h1:DFci5gLYBciE7Vtevhsrf46CRTquxDuWsQurQQe4oz8=
```

---

### Incident Patch 6: `5c11d2d4` (2026-09-30)
**Commit Message**: build(deps): bump webpack-dev-middleware from 7.4.2 to 7.4.6 in /web/app (#15685)

Bumps [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware) from 7.4.2 to 7.4.6.
- [Release notes](https://github.com/webpack/webpack-dev-middleware/releases)
- [Changelog](https://github.com/webpack/webpack-dev-middleware/blob/v7.4.6/CHANGELOG.md)
- [Commits](https://github.com/webpack/webpack-dev-middleware/compare/v7.4.2...v7.4.6)

---
updated-dependencies:
- dependency-name: webpack-dev-middleware
  dependency-version: 7.4.6
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `web/app/yarn.lock` (modified, +212/-11)
```diff
@@ -1708,6 +1708,167 @@
     "@jridgewell/resolve-uri" "^3.1.0"
     "@jridgewell/sourcemap-codec" "^1.4.14"
 
+"@jsonjoy.com/base64@17.67.0":
+  version "17.67.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/base64/-/base64-17.67.0.tgz#7eeda3cb41138d77a90408fd2e42b2aba10576d7"
+  integrity sha512-5SEsJGsm15aP8TQGkDfJvz9axgPwAEm98S5DxOuYe8e1EbfajcDmgeXXzccEjh+mLnjqEKrkBdjHWS5vFNwDdw==
+
+"@jsonjoy.com/base64@^1.1.2":
+  version "1.1.2"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/base64/-/base64-1.1.2.tgz#cf8ea9dcb849b81c95f14fc0aaa151c6b54d2578"
+  integrity sha512-q6XAnWQDIMA3+FTiOYajoYqySkO+JSat0ytXGSuRdq9uXE7o92gzuQwQM14xaCRlBLGq3v5miDGC4vkVTn54xA==
+
+"@jsonjoy.com/buffers@17.67.0", "@jsonjoy.com/buffers@^17.65.0":
+  version "17.67.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/buffers/-/buffers-17.67.0.tgz#5c58dbcdeea8824ce296bd1cfce006c2eb167b3d"
+  integrity sha512-tfExRpYxBvi32vPs9ZHaTjSP4fHAfzSmcahOfNxtvGHcyJel+aibkPlGeBB+7AoC6hL7lXIE++8okecBxx7lcw==
+
+"@jsonjoy.com/buffers@^1.0.0", "@jsonjoy.com/buffers@^1.2.0":
+  version "1.2.1"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/buffers/-/buffers-1.2.1.tgz#8d99c7f67eaf724d3428dfd9826c6455266a5c83"
+  integrity sha512-12cdlDwX4RUM3QxmUbVJWqZ/mrK6dFQH4Zxq6+r1YXKXYBNgZXndx2qbCJwh3+WWkCSn67IjnlG3XYTvmvYtgA==
+
+"@jsonjoy.com/codegen@17.67.0":
+  version "17.67.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/codegen/-/codegen-17.67.0.tgz#3635fd8769d77e19b75dc5574bc9756019b2e591"
+  integrity sha512-idnkUplROpdBOV0HMcwhsCUS5TRUi9poagdGs70A6S4ux9+/aPuKbh8+UYRTLYQHtXvAdNfQWXDqZEx5k4Dj2Q==
+
+"@jsonjoy.com/codegen@^1.0.0":
+  version "1.0.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/codegen/-/codegen-1.0.0.tgz#5c23f796c47675f166d23b948cdb889184b93207"
+  integrity sha512-E8Oy+08cmCf0EK/NMxpaJZmOxPqM+6iSe2S4nlSBrPZOORoDJILxtbSUEDKQyTamm/BVAhIGllOBNU79/dwf0g==
+
+"@jsonjoy.com/fs-core@4.80.0":
+  version "4.80.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/fs-core/-/fs-core-4.80.0.tgz#6dc91c945dcc25657b9a9839580ac243a4405fef"
+  integrity sha512-qMKWshnyjbyhm+NbzqGE3w5y1mckFFEMj0aDPU2/JBNh1BzIjVy9esq9lBmRnNVmhMEkxwDzLZ8Gqh5G1P5Dag==
+  dependencies:
+    "@jsonjoy.com/fs-node-builtins" "4.80.0"
+    "@jsonjoy.com/fs-node-utils" "4.80.0"
+    thingies "^2.5.0"
+
+"@jsonjoy.com/fs-fsa@4.80.0":
+  version "4.80.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/fs-fsa/-/fs-fsa-4.80.0.tgz#f22b948d3fd2fb199b2fd4b9c22c60fd7f9b0fe4"
+  integrity sha512-ZBEKl7J6dbkRCfmrFV48Re211A/FHqniTUhsWCsaRteNSOqMgkX3qF1UreVgwB9oSPm81JLAwhIi6Lb/NH/PoA==
+  dependencies:
+    "@jsonjoy.com/fs-core" "4.80.0"
+    "@jsonjoy.com/fs-node-builtins" "4.80.0"
+    "@jsonjoy.com/fs-node-utils" "4.80.0"
+    thingies "^2.5.0"
+
+"@jsonjoy.com/fs-node-builtins@4.80.0":
+  version "4.80.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/fs-node-builtins/-/fs-node-builtins-4.80.0.tgz#cfcffaae4acae2c1219b42bf222b2f1876141d1b"
+  integrity sha512-OIOIhqaWiwUySFMny4epIAoviXsyMaQQ63PTc3zH+5HEOvarl5hpUmZIhp2m5+OfyKAh5ylxXnQIgew1OgJDVw==
+
+"@jsonjoy.com/fs-node-to-fsa@4.80.0":
+  version "4.80.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/fs-node-to-fsa/-/fs-node-to-fsa-4.80.0.tgz#4c8278a06de7e3c4f1fe626ef351474a6e3cd142"
+  integrity sha512-ljeaR5xwtX1EyRmB0wvXANUMQZ3mjKcm7z8s2N8D8SLQ04CcAGtUhHFRZQXFb9mhgFyEVMydQGQtSOFS7pcrFQ==
+  dependencies:
+    "@jsonjoy.com/fs-fsa" "4.80.0"
+    "@jsonjoy.com/fs-node-builtins" "4.80.0"
+    "@jsonjoy.com/fs-node-utils" "4.80.0"
+
+"@jsonjoy.com/fs-node-utils@4.80.0":
+  version "4.80.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/fs-node-utils/-/fs-node-utils-4.80.0.tgz#4e9d978a172227201ed06723444c9c1658c1df34"
+  integrity sha512-xwHeVVi3f+Khg/Fmb8i5qoYVmQ08QznE5TWhQokUmIZjz4KBPzU+zt/+bahBI6G1ghtqajt27lWuAciIxApuzA==
+  dependencies:
+    "@jsonjoy.com/fs-node-builtins" "4.80.0"
+    glob-to-regex.js "^1.3.1"
+
+"@jsonjoy.com/fs-node@4.80.0":
+  version "4.80.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/fs-node/-/fs-node-4.80.0.tgz#916f29ce9377d1bf2c7ac5a0747f704ab117dbf7"
+  integrity sha512-yiBlUfkMMRFFGy8CD/h2zd5rPnrM6bjlF+nx2LRAxNV6hOSiuObQIUEE7m7y2VTMisjxCRtzINH94bFGySWL7g==
+  dependencies:
+    "@jsonjoy.com/fs-core" "4.80.0"
+    "@jsonjoy.com/fs-node-builtins" "4.80.0"
+    "@jsonjoy.com/fs-node-utils" "4.80.0"
+    "@jsonjoy.com/fs-print" "4.80.0"
+    "@jsonjoy.com/fs-snapshot" "4.80.0"
+    glob-to-regex.js "^1.3.1"
+    thingies "^2.5.0"
+
+"@jsonjoy.com/fs-print@4.80.0":
+  version "4.80.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/fs-print/-/fs-print-4.80.0.tgz#5668fa62a84a0c9383b3d3adcd0379702725ef79"
+  integrity sha512-1ocZLJw/m/xlq0moaIHO7HV9nHRVBUvdc2zMzhsJGkFOrqfwWvexfCv5cYCPPLRhP+9p3yunoi4Ep5YhRORC9Q==
+  dependencies:
+    "@jsonjoy.com/fs-node-utils" "4.80.0"
+    tree-dump "^1.1.0"
+
+"@jsonjoy.com/fs-snapshot@4.80.0":
+  version "4.80.0"
+  resolved "https://registry.yarnpkg.com/@jsonjoy.com/fs-
```

---

### Incident Patch 7: `93c2a7f0` (2026-09-30)
**Commit Message**: build(deps): bump the pest group across 1 directory with 4 updates (#15658)

Bumps the pest group with 4 updates in the / directory: [pest](https://github.com/pest-parser/pest), [pest_derive](https://github.com/pest-parser/pest), [pest_generator](https://github.com/pest-parser/pest) and [pest_meta](https://github.com/pest-parser/pest).


Updates `pest` from 2.9.0 to 2.9.2
- [Release notes](https://github.com/pest-parser/pest/releases)
- [Commits](https://github.com/pest-parser/pest/compare/v2.9.0...v2.9.2)

Updates `pest_derive` from 2.9.0 to 2.9.2
- [Release notes](https://github.com/pest-parser/pest/releases)
- [Commits](https://github.com/pest-parser/pest/compare/v2.9.0...v2.9.2)

Updates `pest_generator` from 2.9.0 to 2.9.2
- [Release notes](https://github.com/pest-parser/pest/releases)
- [Commits](https://github.com/pest-parser/pest/compare/v2.9.0...v2.9.2)

Updates `pest_meta` from 2.9.0 to 2.9.2
- [Release notes](https://github.com/pest-parser/pest/releases)
- [Commits](https://github.com/pest-parser/pest/compare/v2.9.0...v2.9.2)

---
updated-dependencies:
- dependency-name: pest
  dependency-version: 2.9.1
  dependency-type: indirect
  update-type: version-update:semver-pat

**File**: `Cargo.lock` (modified, +8/-8)
```diff
@@ -1668,29 +1668,29 @@ checksum = "9b4f627cb1b25917193a259e49bdad08f671f8d9708acfd5fe0a8c1455d87220"
 
 [[package]]
 name = "pest"
-version = "2.9.0"
+version = "2.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5a07a60cc7a4d00c91f95c685609d1d2f79050e6804b70ebedd7650f0b839bcf"
+checksum = "45d3aca230fad2e6f6317ca0a72724338c4960cb97168a85cdee66df4a9a21a8"
 dependencies = [
  "memchr",
  "ucd-trie",
 ]
 
 [[package]]
 name = "pest_derive"
-version = "2.9.0"
+version = "2.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b3a83744a5c8455b8b3e0dc5031362780a347c878bdd11584d1a8984228cc88d"
+checksum = "284b60557f2c4a2e72ad3f2d34d42685a2fa4a6a61d0d2a10c0ae2a5e916c2cf"
 dependencies = [
  "pest",
  "pest_generator",
 ]
 
 [[package]]
 name = "pest_generator"
-version = "2.9.0"
+version = "2.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e0cd3451aa3de60d4b9a1e736885e4dea6b31617598026f12256ad566d63304a"
+checksum = "1d9d1f08a115309ee99268cf85e5228e0e56aa9caf8841ec12866b6be07c3109"
 dependencies = [
  "pest",
  "pest_meta",
@@ -1701,9 +1701,9 @@ dependencies = [
 
 [[package]]
 name = "pest_meta"
-version = "2.9.0"
+version = "2.9.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e04d3a0849e241d7dfce834c83b1c5edc8622009e8dd51a12ba1927c32f05496"
+checksum = "ed93ba1a9ffcca32130a5188701c81c0c49cf00d4b7c5007d5148951d743adcb"
 dependencies = [
  "pest",
 ]
```

---

### Incident Patch 8: `aa81b408` (2026-09-30)
**Commit Message**: build(deps-dev): bump @babel/runtime from 8.0.0 to 8.0.5 in /web/app (#15679)

Bumps [@babel/runtime](https://github.com/babel/babel/tree/HEAD/packages/babel-runtime) from 8.0.0 to 8.0.5.
- [Release notes](https://github.com/babel/babel/releases)
- [Changelog](https://github.com/babel/babel/blob/main/CHANGELOG.md)
- [Commits](https://github.com/babel/babel/commits/v8.0.5/packages/babel-runtime)

---
updated-dependencies:
- dependency-name: "@babel/runtime"
  dependency-version: 8.0.5
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `web/app/package.json` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@
     "@babel/plugin-proposal-class-properties": "^7.17.12",
     "@babel/preset-env": "^7.29.7",
     "@babel/preset-react": "^7.29.7",
-    "@babel/runtime": "^8.0.0",
+    "@babel/runtime": "^8.0.5",
     "@lingui/cli": "3.17.2",
     "babel-core": "^7.0.0-bridge.0",
     "babel-jest": "^30.5.1",
```

**File**: `web/app/yarn.lock` (modified, +4/-4)
```diff
@@ -1059,10 +1059,10 @@
   resolved "https://registry.yarnpkg.com/@babel/runtime/-/runtime-7.29.7.tgz#12022450c45a4da6d8d8287b18a4ff2ddb23f768"
   integrity sha512-Nq8OhGWiZIZGV6hLHoyAKLLcJihP/xFeBMGJoUrxTX2psI8dCifzLhZISFb+VWS3wFMRDmCGw5R+dOySCqPLhw==
 
-"@babel/runtime@^8.0.0":
-  version "8.0.0"
-  resolved "https://registry.yarnpkg.com/@babel/runtime/-/runtime-8.0.0.tgz#d7bd513e6843662346552c2798ab895716cf97f2"
-  integrity sha512-sL6cvO2IfkSu/iU+zs2S/w01B7A8V7suXSIKEN4hPFFdZoiPGxrj5pAG0lCaqLWiEIrjKzdznIWuaLcxPR53qw==
+"@babel/runtime@^8.0.5":
+  version "8.0.5"
+  resolved "https://registry.yarnpkg.com/@babel/runtime/-/runtime-8.0.5.tgz#7b9cdb3ecdd4d9f5975f9a8a64c391a8ce04c436"
+  integrity sha512-7NK+Lz3spQ52XsUGTxIEVU4jYN2/dIaX8sTxRFAUtYmttYZnVh3aehiihv+/Gb7+duMNHl2OrFcBQRyOHScxpg==
 
 "@babel/template@^7.18.6", "@babel/template@^7.29.7":
   version "7.29.7"
```

---

### Incident Patch 9: `15ffb6c9` (2026-09-30)
**Commit Message**: build(deps-dev): bump webpack-bundle-analyzer in /web/app (#15678)

Bumps [webpack-bundle-analyzer](https://github.com/webpack/webpack-bundle-analyzer) from 5.3.2 to 5.4.0.
- [Release notes](https://github.com/webpack/webpack-bundle-analyzer/releases)
- [Changelog](https://github.com/webpack/webpack-bundle-analyzer/blob/main/CHANGELOG.md)
- [Commits](https://github.com/webpack/webpack-bundle-analyzer/compare/v5.3.2...v5.4.0)

---
updated-dependencies:
- dependency-name: webpack-bundle-analyzer
  dependency-version: 5.4.0
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `web/app/package.json` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@
     "style-loader": "^4.0.0",
     "url-loader": "^4.1.1",
     "webpack": "^5.110.3",
-    "webpack-bundle-analyzer": "5.3.2",
+    "webpack-bundle-analyzer": "5.4.0",
     "webpack-cli": "7.2.3",
     "webpack-dev-server": "5.2.5"
   },
```

**File**: `web/app/yarn.lock` (modified, +4/-4)
```diff
@@ -10197,10 +10197,10 @@ webidl-conversions@^7.0.0:
   resolved "https://registry.yarnpkg.com/webidl-conversions/-/webidl-conversions-7.0.0.tgz#256b4e1882be7debbf01d05f0aa2039778ea080a"
   integrity sha512-VwddBukDzu71offAQR975unBIGqfKZpM+8ZX6ySk8nYhVoo5CYaZyzt3YBvYtRtO+aoGlqxPg/B87NGVZ/fu6g==
 
-webpack-bundle-analyzer@5.3.2:
-  version "5.3.2"
-  resolved "https://registry.yarnpkg.com/webpack-bundle-analyzer/-/webpack-bundle-analyzer-5.3.2.tgz#f8ed8ff2efa89034d1e216d2b8581f0a5d5ac424"
-  integrity sha512-IagCa/GrdxSz+ba9OMgK7UCfQp97HtXbgjXu7ObcqmRo9PTp0d+24rgY+mIFOx7JPQ9bo6FGsqZhA55rYRZrrQ==
+webpack-bundle-analyzer@5.4.0:
+  version "5.4.0"
+  resolved "https://registry.yarnpkg.com/webpack-bundle-analyzer/-/webpack-bundle-analyzer-5.4.0.tgz#cccc3cac73a71d0ed41fc454abbd80ca02c69609"
+  integrity sha512-6OjsEFQIwcRT1nId/O7OyHjDvrE0JSFAef/XCwGarrf9MF5/CaD0lhDvoySbus57dYEdJ3vrRVj5F3i30c4ozw==
   dependencies:
     "@discoveryjs/json-ext" "^0.6.3"
     acorn "^8.0.4"
```

---

### Incident Patch 10: `2929f990` (2026-09-30)
**Commit Message**: build(deps): bump docker/setup-qemu-action (#15675)

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
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/actions/docker-build/action.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ runs:
   steps:
     # populate ACTIONS_CACHE_URL and ACTIONS_RUNTIME_TOKEN
     - uses: crazy-max/ghaction-github-runtime@04d248b84655b509d8c44dc1d6f990c879747487
-    - uses: docker/setup-qemu-action@1f40c72289eff860ee54a304f1438e3cff362e0a
+    - uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1
     - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
       with:
         driver-opts: network=host
```

---

### Incident Patch 11: `883a07fb` (2026-09-30)
**Commit Message**: build(deps): bump docker/build-push-action from 7.3.0 to 7.4.0 (#15673)

Bumps [docker/build-push-action](https://github.com/docker/build-push-action) from 7.3.0 to 7.4.0.
- [Release notes](https://github.com/docker/build-push-action/releases)
- [Commits](https://github.com/docker/build-push-action/compare/53b7df96c91f9c12dcc8a07bcb9ccacbed38856a...c3c9e263c25d99ce0380d002d59b67737d91b0dc)

---
updated-dependencies:
- dependency-name: docker/build-push-action
  dependency-version: 7.4.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/cli-build.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
       - uses: docker/setup-buildx-action@594f3bf4285d9ea8dc53c9a0c9c4092420091003
-      - uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a
+      - uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc
         id: build
         with:
           build-args: |
```

---

### Incident Patch 12: `e9469098` (2026-09-30)
**Commit Message**: build(deps): bump docker/setup-buildx-action from 4.3.0 to 4.4.0 (#15672)

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 4.3.0 to 4.4.0.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/37fe631027851001ddb9b187196cc803df7f5f0e...594f3bf4285d9ea8dc53c9a0c9c4092420091003)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.4.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/cli-build.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
     timeout-minutes: 20
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
-      - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e
+      - uses: docker/setup-buildx-action@594f3bf4285d9ea8dc53c9a0c9c4092420091003
       - uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a
         id: build
         with:
```

---

### Incident Patch 13: `573ec727` (2026-09-30)
**Commit Message**: build(deps): bump codecov/codecov-action from 7.0.0 to 7.1.0 (#15669)

Bumps [codecov/codecov-action](https://github.com/codecov/codecov-action) from 7.0.0 to 7.1.0.
- [Release notes](https://github.com/codecov/codecov-action/releases)
- [Changelog](https://github.com/codecov/codecov-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/codecov/codecov-action/compare/fb8b3582c8e4def4969c97caa2f19720cb33a72f...0b35c9ecc4f0529d0eb674914510c22f85b196b4)

---
updated-dependencies:
- dependency-name: codecov/codecov-action
  dependency-version: 7.1.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/codecov.yml` (modified, +3/-3)
```diff
@@ -19,7 +19,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
       - run: go install gotest.tools/gotestsum@v0.4.2
       - run: gotestsum -- -cover -coverprofile=coverage.out -v -mod=readonly ./...
-      - uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f
+      - uses: codecov/codecov-action@0b35c9ecc4f0529d0eb674914510c22f85b196b4
         with:
           files: ./coverage.out
           flags: unittests,golang
@@ -41,7 +41,7 @@ jobs:
           export NODE_ENV=test
           bin/web --frozen-lockfile
           bin/web test --reporters="jest-progress-bar-reporter" --reporters="./gh_ann_reporter.js" --coverage
-      - uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f
+      - uses: codecov/codecov-action@0b35c9ecc4f0529d0eb674914510c22f85b196b4
         with:
           directory: ./web/app/coverage
           flags: unittests,javascript
@@ -58,6 +58,6 @@ jobs:
       - shell: bash
         run: mkdir -p target && cd target && bin/scurl -v https://github.com/xd009642/tarpaulin/releases/download/0.27.3/cargo-tarpaulin-x86_64-unknown-linux-musl.tar.gz | tar zxvf - && chmod 755 cargo-tarpaulin
       - run: target/cargo-tarpaulin tarpaulin --workspace --out Xml
-      - uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f
+      - uses: codecov/codecov-action@0b35c9ecc4f0529d0eb674914510c22f85b196b4
         with:
           flags: unittests,rust
```

---

### Incident Patch 14: `a4ced677` (2026-09-30)
**Commit Message**: build(deps): bump zerocopy from 0.8.56 to 0.8.59 (#15659)

Bumps [zerocopy](https://github.com/google/zerocopy) from 0.8.56 to 0.8.59.
- [Release notes](https://github.com/google/zerocopy/releases)
- [Commits](https://github.com/google/zerocopy/compare/v0.8.56...v0.8.59)

---
updated-dependencies:
- dependency-name: zerocopy
  dependency-version: 0.8.57
  dependency-type: indirect
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -2869,18 +2869,18 @@ checksum = "1ebf944e87a7c253233ad6766e082e3cd714b5d03812acc24c318f549614536e"
 
 [[package]]
 name = "zerocopy"
-version = "0.8.56"
+version = "0.8.59"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "556764e583adb45a9f8d413c2a147fa7e8d821e48e12b14fd560b607998b75eb"
+checksum = "6df92bf3d9227be3d53173901ddbffac2babc27ae50f397776ffd6dc33f800cb"
 dependencies = [
  "zerocopy-derive",
 ]
 
 [[package]]
 name = "zerocopy-derive"
-version = "0.8.56"
+version = "0.8.59"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f2ab42fc20575779bd240faa45f94a74256f755c0fa9e89f0ede20d91d0cdfc1"
+checksum = "ac4f328cf2f05d084e496c3e9c3f33ed0a183656a16e1fcec4d464d8373aec82"
 dependencies = [
  "proc-macro2",
  "quote",
```

---

### Incident Patch 15: `e54aa71e` (2026-09-30)
**Commit Message**: build(deps): bump smallvec from 1.15.2 to 1.16.2 (#15661)

Bumps [smallvec](https://github.com/servo/rust-smallvec) from 1.15.2 to 1.16.2.
- [Release notes](https://github.com/servo/rust-smallvec/releases)
- [Commits](https://github.com/servo/rust-smallvec/compare/v1.15.2...v1.16.2)

---
updated-dependencies:
- dependency-name: smallvec
  dependency-version: 1.16.0
  dependency-type: indirect
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2270,9 +2270,9 @@ checksum = "0c790de23124f9ab44544d7ac05d60440adc586479ce501c1d6d7da3cd8c9cf5"
 
 [[package]]
 name = "smallvec"
-version = "1.15.2"
+version = "1.16.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8ed6a63f02c8539c91a8685a86f4099661ba3da017932f6ebbea6de3f0fa7c90"
+checksum = "f9395f0f0eee849a9b707b2f06bb92a6a422090e2123bb2ef8e87a0e61892a8e"
 
 [[package]]
 name = "socket2"
```

#### Recent Merged Pull Requests:
- **PR #15696** (2026-10-02): Update PR template to point to discussions (@kflynn)
- **PR #15686** (2026-10-01): build(deps): bump clap_lex from 1.1.0 to 1.1.1 in the clap group (@dependabot[bot])
- **PR #15685** (2026-09-30): build(deps): bump webpack-dev-middleware from 7.4.2 to 7.4.6 in /web/app (@dependabot[bot])
- **PR #15683** (2026-10-01): build(deps): bump the kube group across 1 directory with 7 updates (@dependabot[bot])
- **PR #15681** (2026-10-05): proxy: v2.370.0 (@l5d-bot)
- **PR #15680** (2026-09-30): build(deps): bump google.golang.org/grpc from 1.83.2 to 1.84.0 (@dependabot[bot])
- **PR #15679** (2026-09-30): build(deps-dev): bump @babel/runtime from 8.0.0 to 8.0.5 in /web/app (@dependabot[bot])
- **PR #15678** (2026-09-30): build(deps-dev): bump webpack-bundle-analyzer from 5.3.2 to 5.4.0 in /web/app (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
