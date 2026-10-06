# Forensic Learning Record (Deep Inspection): gocrane/crane

> **Canonical Artifact**: `07_PROJECT_LEARNING/gocrane-crane-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gocrane/crane](https://github.com/gocrane/crane))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:24:01.518Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gocrane/crane`
- **Description**: Crane is a FinOps Platform for Cloud Resource Analytics and Economics in Kubernetes clusters. The goal is not only to help users to manage cloud cost easier but also ensure the quality of applications.  
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2058 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/ensurance/cm/cpumanager/util.go`
```
package cpumanager

import (
	"encoding/json"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/sets"

	topologyapi "github.com/gocrane/api/topology/v1alpha1"
)

var (
	// SupportedPolicy is the valid cpu policy.
	SupportedPolicy = sets.NewString(
		topologyapi.AnnotationPodCPUPolicyNone, topologyapi.AnnotationPodCPUPolicyExclusive,
		topologyapi.AnnotationPodCPUPolicyNUMA, topologyapi.AnnotationPodCPUPolicyImmovable,
	)
)

// GetPodTopologyResult returns the Topology scheduling result of a pod.
func GetPodTopologyResult(pod *corev1.Pod) topologyapi.ZoneList {
	raw, exist := pod.Annotations[topologyapi.AnnotationPodTopologyResultKey]
	if !exist {
		return nil
	}
	var zones topologyapi.ZoneList
	if err := json.Unmarshal([]byte(raw), &zones); err != nil {
		return nil
	}
	return zones
}

// GetPodNUMANodeResult returns the NUMA node scheduling result of a pod.
func GetPodNUMANodeResult(pod *corev1.Pod) topologyapi.ZoneList {
	zones := GetPodTopologyResult(pod)
	var numaZones topologyapi.ZoneList
	for i := range zones {
		if zones[i].Type == topologyapi.ZoneTypeNode {
			numaZones = append(numaZones, zones[i])
		}
	}
	return numaZones
}

// GetPodTargetContainerIndices returns all pod whose cpus could be allocated.
func GetPodTargetContainerIndices(pod *corev1.Pod) []int {
	if policy := GetPodCPUPolicy(pod.Annotations); policy == topologyapi.AnnotationPodCPUPolicyNone {
		return nil
	}
	var idx []int
	for i := range pod.Spec.Containers {
		if GuaranteedCPUs(&pod.Spec.Containers[i]) > 0 {
			idx = append(idx, i)
		}
	}
	return idx
}

// GetPodCPUPolicy returns the cpu policy of pod, only supports none, exclusive, numa and immovable.
func GetPodCPUPolicy(attr map[string]string) string {
	policy, ok := attr[topologyapi.AnnotationPodCPUPolicyKey]
	if ok && SupportedPolicy.Has(policy) {
		return policy
	}
	return ""
}

// GuaranteedCPUs returns CPUs for guaranteed container.
func GuaranteedCPUs(container *corev1.Container) int {
	cpuQuantity := container.Resources.Requests[corev1.ResourceCPU]
	cpuQuantityLimit := container.Resources.Limits[corev1.ResourceCPU]

	// If requests.cpu != limits.cpu or cpu is not an integer, there are no guaranteed cpus.
	if cpuQuantity.Cmp(cpuQuantityLimit) != 0 || cpuQuantity.Value()*1000 != cpuQuantity.MilliValue() {
		return 0
	}
	// Safe downcast to do for all systems with < 2.1 billion CPUs.
	// Per the language spec, `int` is guaranteed to be at least 32 bits wide.
	// https://golang.org/ref/spec#Numeric_types
	return int(cpuQuantity.Value())
}

```

### Core Architecture Module: `pkg/ensurance/util/match_qos.go`
```
package util

import (
	"fmt"
	"reflect"
	"sort"
	"strconv"
	"strings"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/klog/v2"

	ensuranceapi "github.com/gocrane/api/ensurance/v1alpha1"
)

type ObjectIdentity struct {
	Namespace  string
	APIVersion string
	Kind       string
	Name       string
	Labels     map[string]string
}

func labelMatch(labelSelector metav1.LabelSelector, matchLabels map[string]string) bool {
	for k, v := range labelSelector.MatchLabels {
		if matchLabels[k] != v {
			return false
		}
	}

	for _, expr := range labelSelector.MatchExpressions {
		switch expr.Operator {
		case metav1.LabelSelectorOpExists:
			if _, exists := matchLabels[expr.Key]; !exists {
				return false
			}
		case metav1.LabelSelectorOpDoesNotExist:
			if _, exists := matchLabels[expr.Key]; exists {
				return false
			}
		case metav1.LabelSelectorOpIn:
			if v, exists := matchLabels[expr.Key]; !exists {
				return false
			} else {
				var found bool
				for i := range expr.Values {
					if expr.Values[i] == v {
						found = true
						break
					}
				}
				if !found {
					return false
				}
			}
		case metav1.LabelSelectorOpNotIn:
			if v, exists := matchLabels[expr.Key]; exists {
				for i := range expr.Values {
					if expr.Values[i] == v {
						return false
					}
				}
			}
		}
	}

	return true
}

func sortQOSSlice(qosSlice []*ensuranceapi.PodQOS) {
	sort.Slice(qosSlice, func(i, j int) bool {
		if len(qosSlice[i].Spec.LabelSelector.MatchLabels) != len(qosSlice[j].Spec.LabelSelector.MatchLabels) {
			return len(qosSlice[i].Spec.LabelSelector.MatchLabels) > len(qosSlice[j].Spec.LabelSelector.MatchLabels)
		}

		if qosSlice[i].Spec.ScopeSelector == nil && qosSlice[j].Spec.ScopeSelector == nil {
			return true
		}

		if qosSlice[i].Spec.ScopeSelector == nil {
			return false
		}

		if qosSlice[j].Spec.ScopeSelector == nil {
			return true
		}

		return len(qosSlice[i].Spec.ScopeSelector.MatchExpressions) > len(qosSlice[j].Spec.ScopeSelector.MatchExpressions)
	})
}

func MatchPodAndPodQOSSlice(pod *v1.Pod, qosSlice []*ensuranceapi.PodQOS) (res *ensuranceapi.PodQOS) {
	newSlice := make([]*ensuranceapi.PodQOS, len(qosSlice), len(qosSlice))
	copy(newSlice, qosSlice)
	sortQOSSlice(newSlice)
	for _, qos := range newSlice {
		if MatchPodAndPodQOS(pod, qos) {
			return qos
		}
	}
	return nil
}

func MatchPodAndPodQOS(pod *v1.Pod, podQOS *ensuranceapi.PodQOS) bool {

	if podQOS.Spec.ScopeSelector == nil &&
		podQOS.Spec.LabelSelector.MatchLabels == nil &&
		podQOS.Spec.LabelSelector.MatchExpressions == nil {
		return false
	}

	if !reflect.DeepEqual(podQOS.Spec.LabelSelector, metav1.LabelSelector{}) {
		matchLabels := map[string]string{}
		for k, v := range pod.Labels {
			matchLabels[k] = v
		}
		if !labelMatch(podQOS.Spec.LabelSelector, matchLabels) {
			return false
		}
	}

	if podQOS.Spec.ScopeSelector == nil {
		return true
	}

	// AND of the selectors
	var nameSpaceSelectors, prioritySelectors, qosClassSelectors []ensuranceapi.ScopedResourceSelectorRequirement
	for _, ss := range podQOS.Spec.ScopeSelector.MatchExpressions {
		if ss.ScopeName == ensuranceapi.NamespaceSelectors {
			nameSpaceSelectors = append(nameSpaceSelectors, ss)
		}
		if ss.ScopeName == ensuranceapi.PrioritySelectors {
			prioritySelectors = append(prioritySelectors, ss)
		}
		if ss.ScopeName == ensuranceapi.QOSClassSelector {
			qosClassSelectors = append(qosClassSelectors, ss)
		}
	}

	// namespace selector must be satisfied
	for _, nss := range nameSpaceSelectors {
		match, err := podMatchesNameSpaceSelector(pod, nss)
		if err != nil {
			klog.Errorf("Error on matching scope %s: %v", podQOS.Name, err)
			return false
		}
		if !match {
			klog.V(6).Infof("PodQOS %s namespace selector not match pod %s/%s", podQOS.Name, pod.Namespace, pod.Name)
			return false
		}
	}

	var priorityTotalMatch = true
	for _, selector := range prioritySelectors {
		var priorityMatch bool
		switch selector.Operator {
		case v1.ScopeSelectorOpIn:
			for _, vaules := range selector.Values {
				priority := strings.Split(vaules, "-")
				// In format of 1000
				if len(priority) == 1 {
					p, err := strconv.Atoi(priority[0])
					if err == nil && int(*pod.Spec.Priority) == p {
						priorityMatch = true
					}
					if err != nil {
						klog.Errorf("%s can't transfer to int", priority[0])
					}
				}
				//In format of 1000-3000
				if len(priority) == 2 {
					priStart, err1 := strconv.Atoi(priority[0])
					priEnd, err2 := strconv.Atoi(priority[1])
					if err1 == nil && err2 == nil && priEnd >= priStart && (int(*pod.Spec.Priority) <= priEnd) && (int(*pod.Spec.Priority) >= priStart) {
						priorityMatch = true
					}
				}
			}
		case v1.ScopeSelectorOpNotIn:
			for _, vaules := range selector.Values {
				priority := strings.Split(vaules, "-")
				// In format of 1000
				priorityMatch = true
				if len(priority) == 1 {
					p, err := strconv.Atoi(priority[0])
					if err == nil && int(*pod.Spec.Priority) == p {
						priorityMatch = false
					}
					if err != nil {
						klog.Errorf("%s can't transfer to int", priority[0])
					}
				}
				//In format of 1000-3000
				if len(priority) == 2 {
					priStart, err1 := strconv.Atoi(priority[0])
					priEnd, err2 := strconv.Atoi(priority[1])
					if err1 == nil && err2 == nil && priEnd >= priStart && (int(*pod.Spec.Priority) <= priEnd) && (int(*pod.Spec.Priority) >= priStart) {
						priorityMatch = false
					}
				}
			}
		}
		priorityTotalMatch = priorityTotalMatch && priorityMatch
		if priorityMatch == false {
			break
		}
	}
	if !priorityTotalMatch {
		return false
	}

	var qosClassMatch = true
	for _, qos := range qosClassSelectors {
		match, err := podMatchesqosClassSelector(pod, qos)
		if err != nil {
			klog.Errorf("Error on matching scope %s: %v", podQOS.Name, err)
			qosClassMatch = false
		}
		if !match {
			klog.V(6).Infof("PodQOS %s qosclass selector not match pod %s/%s", podQOS.Name, pod.Namespace, pod.Name)
			qosClassMatch = false
		}
	}
	if !qosClassMatch {
		return false
	}

	return true
}
func podMatchesNameSpaceSelector(pod *v1.Pod, selector ensuranceapi.ScopedResourceSelectorRequirement) (bool, error) {
	labelSelector, err := scopedResourceSelectorRequirementsAsSelector(selector)
	if err != nil {
		return false, fmt.Errorf("failed to parse and convert selector: %v", err)
	}
	m := map[string]string{string(selector.ScopeName): pod.Namespace}
	if labelSelector.Matches(labels.Set(m)) {
		return true, nil
	}
	return false, nil
}

// scopedResourceSelectorRequirementsAsSelector converts the ScopedResourceSelectorRequirement api type into a struct that implements
// labels.Selector.
func scopedResourceSelectorRequirementsAsSelector(nss ensuranceapi.ScopedResourceSelectorRequirement) (labels.Selector, error) {
	selector := labels.NewSelector()
	var op selection.Operator
	switch nss.Operator {
	case v1.ScopeSelectorOpIn:
		op = selection.In
	case v1.ScopeSelectorOpNotIn:
		op = selection.NotIn
	default:
		return nil, fmt.Errorf("%q is not a valid scope selector operator", nss.Operator)
	}
	r, err := labels.NewRequirement(string(nss.ScopeName), op, nss.Values)
	if err != nil {
		return nil, err
	}
	selector = selector.Add(*r)
	return selector, nil
}

func podMatchesqosClassSelector(pod *v1.Pod, selector ensuranceapi.ScopedResourceSelectorRequirement) (bool, error) {
	labelSelector, err := scopedResourceSelectorRequirementsAsSelector(selector)
	if err != nil {
		return false, fmt.Errorf("failed to parse and convert selector: %v", err)
	}
	m := map[string]string{string(selector.ScopeName): string(pod.Status.QOSClass)}
	if labelSelector.Matches(labels.Set(m)) {
		return true, nil
	}
	return false, nil
}

```

### Core Architecture Module: `pkg/server/ginwrapper/core.go`
```
package ginwrapper

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	// Message is the detail message of the error
	Error string `json:"error"`
	// Data is the response data
	Data interface{} `json:"data"`
}

// WriteResponse write an error or the response data into http response body.
// The Response.Error is empty if the err is null, or the Response.Error is the error message.
func WriteResponse(c *gin.Context, err error, data interface{}) {
	if err != nil {
		c.JSON(http.StatusOK, Response{
			Error: err.Error(),
			Data:  data,
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Data: data,
	})
}

```

### Core Architecture Module: `pkg/utils/cgroup.go`
```
package utils

import (
	"fmt"
	"path"
	"strings"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
)

func (cgroupName CgroupName) ToCgroupfs() string {
	return "/" + path.Join(cgroupName...)
}

func GetCgroupPath(p *v1.Pod, cgroupDriver string) string {
	cgroupName := GetCgroupName(p)
	switch cgroupDriver {
	case "systemd":
		return cgroupName.ToSystemd()
	case "cgroupfs":
		return cgroupName.ToCgroupfs()
	default:
		return ""
	}
}

var RootCgroupName = CgroupName([]string{})

func GetCgroupName(p *v1.Pod) CgroupName {
	switch p.Status.QOSClass {
	case v1.PodQOSGuaranteed:
		return NewCgroupName(RootCgroupName, CgroupKubePods, GetPodCgroupNameSuffix(p.UID))
	case v1.PodQOSBurstable:
		return NewCgroupName(RootCgroupName, CgroupKubePods, strings.ToLower(string(v1.PodQOSBurstable)), GetPodCgroupNameSuffix(p.UID))
	case v1.PodQOSBestEffort:
		return NewCgroupName(RootCgroupName, CgroupKubePods, strings.ToLower(string(v1.PodQOSBestEffort)), GetPodCgroupNameSuffix(p.UID))
	default:
		return RootCgroupName
	}
}

const (
	podCgroupNamePrefix = "pod"
)

func GetPodCgroupNameSuffix(podUID types.UID) string {
	return podCgroupNamePrefix + string(podUID)
}

type CgroupName []string

func NewCgroupName(base CgroupName, components ...string) CgroupName {
	return append(append([]string{}, base...), components...)
}

// systemdSuffix is the cgroup name suffix for systemd
const systemdSuffix string = ".slice"

func (cgroupName CgroupName) ToSystemd() string {
	if len(cgroupName) == 0 || (len(cgroupName) == 1 && cgroupName[0] == "") {
		return "/"
	}
	newparts := []string{}
	for _, part := range cgroupName {
		part = escapeSystemdCgroupName(part)
		newparts = append(newparts, part)
	}

	result, err := ExpandSlice(strings.Join(newparts, "-") + systemdSuffix)
	if err != nil {
		// Should never happen...
		panic(fmt.Errorf("error converting cgroup name [%v] to systemd format: %v", cgroupName, err))
	}
	return result
}

func escapeSystemdCgroupName(part string) string {
	return strings.Replace(part, "-", "_", -1)
}

func ExpandSlice(slice string) (string, error) {
	suffix := ".slice"
	// Name has to end with ".slice", but can't be just ".slice".
	if len(slice) < len(suffix) || !strings.HasSuffix(slice, suffix) {
		return "", fmt.Errorf("invalid slice name: %s", slice)
	}

	// Path-separators are not allowed.
	if strings.Contains(slice, "/") {
		return "", fmt.Errorf("invalid slice name: %s", slice)
	}

	var path, prefix string
	sliceName := strings.TrimSuffix(slice, suffix)
	// if input was -.slice, we should just return root now
	if sliceName == "-" {
		return "/", nil
	}
	for _, component := range strings.Split(sliceName, "-") {
		// test--a.slice isn't permitted, nor is -test.slice.
		if component == "" {
			return "", fmt.Errorf("invalid slice name: %s", slice)
		}

		// Append the component to the path and to the prefix.
		path += "/" + prefix + component + suffix
		prefix += component + "-"
	}
	return path, nil
}

```

### Core Architecture Module: `pkg/utils/cpuset.go`
```
package utils

import (
	topologyapi "github.com/gocrane/api/topology/v1alpha1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/kubernetes/pkg/kubelet/cm/cpuset"
)

// GetReservedCPUs ...
func GetReservedCPUs(cpus string) (cpuset.CPUSet, error) {
	emptyCPUSet := cpuset.NewCPUSet()
	if cpus == "" {
		return emptyCPUSet, nil
	}
	return cpuset.Parse(cpus)
}

// PodExcludeReservedCPUs ...
func PodExcludeReservedCPUs(pod *corev1.Pod) bool {
	if pod == nil {
		return false
	}
	return pod.Annotations[topologyapi.AnnotationPodExcludeReservedCPUs] == "true"
}

```

### Core Architecture Module: `pkg/utils/dialer.go`
```
// This file is copied from
// k8s.io/kubernetes/pkg/kubelet/util/util_unix.go

//go:build freebsd || linux || darwin
// +build freebsd linux darwin

package utils

import (
	"context"
	"fmt"
	"net"
	"net/url"
)

const (
	// unixProtocol is the network protocol of unix socket.
	unixProtocol = "unix"
)

// GetAddressAndDialer returns the address parsed from the given endpoint and a context dialer.
func GetAddressAndDialer(endpoint string) (string, func(ctx context.Context, addr string) (net.Conn, error), error) {
	protocol, addr, err := parseEndpointWithFallbackProtocol(endpoint, unixProtocol)
	if err != nil {
		return "", nil, err
	}
	if protocol != unixProtocol {
		return "", nil, fmt.Errorf("only support unix socket endpoint")
	}

	return addr, dial, nil
}

func dial(ctx context.Context, addr string) (net.Conn, error) {
	return (&net.Dialer{}).DialContext(ctx, unixProtocol, addr)
}

func parseEndpointWithFallbackProtocol(endpoint string, fallbackProtocol string) (protocol string, addr string, err error) {
	if protocol, addr, err = parseEndpoint(endpoint); err != nil && protocol == "" {
		fallbackEndpoint := fallbackProtocol + "://" + endpoint
		protocol, addr, err = parseEndpoint(fallbackEndpoint)
	}
	return
}

func parseEndpoint(endpoint string) (string, string, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", "", err
	}

	switch u.Scheme {
	case "tcp":
		return "tcp", u.Host, nil

	case "unix":
		return "unix", u.Path, nil

	case "":
		return "", "", fmt.Errorf("using %q as endpoint is deprecated, please consider using full url format", endpoint)

	default:
		return u.Scheme, "", fmt.Errorf("protocol %q not supported", u.Scheme)
	}
}

```

### Core Architecture Module: `pkg/utils/ehpa.go`
```
package utils

import (
	"fmt"
	"regexp"
	"strings"

	autoscalingapi "github.com/gocrane/api/autoscaling/v1alpha1"
	"github.com/gocrane/crane/pkg/known"
	autoscalingv2 "k8s.io/api/autoscaling/v2beta2"
)

func IsEHPAPredictionEnabled(ehpa *autoscalingapi.EffectiveHorizontalPodAutoscaler) bool {
	return ehpa.Spec.Prediction != nil && ehpa.Spec.Prediction.PredictionWindowSeconds != nil && ehpa.Spec.Prediction.PredictionAlgorithm != nil
}

func IsEHPAHasPredictionMetric(ehpa *autoscalingapi.EffectiveHorizontalPodAutoscaler) bool {
	for _, metric := range ehpa.Spec.Metrics {
		metricName := GetPredictionMetricName(metric.Type)
		if len(metricName) == 0 {
			continue
		}
		return true
	}

	for key := range ehpa.Annotations {
		if strings.HasPrefix(key, known.EffectiveHorizontalPodAutoscalerExternalMetricsAnnotationPrefix) {
			return true
		}
	}
	return false
}

func IsEHPACronEnabled(ehpa *autoscalingapi.EffectiveHorizontalPodAutoscaler) bool {
	return len(ehpa.Spec.Crons) > 0
}

// GetPredictionMetricName return metric name used by prediction
func GetPredictionMetricName(sourceType autoscalingv2.MetricSourceType) (metricName string) {
	switch sourceType {
	case autoscalingv2.ResourceMetricSourceType, autoscalingv2.ContainerResourceMetricSourceType, autoscalingv2.PodsMetricSourceType, autoscalingv2.ExternalMetricSourceType:
		metricName = known.MetricNamePrediction
	}

	return metricName
}

// GetCronMetricName return metric name used by cron
func GetCronMetricName() string {
	return known.MetricNameCron
}

func GetMetricName(metric autoscalingv2.MetricSpec) string {
	switch metric.Type {
	case autoscalingv2.PodsMetricSourceType:
		return metric.Pods.Metric.Name
	case autoscalingv2.ResourceMetricSourceType:
		return metric.Resource.Name.String()
	case autoscalingv2.ContainerResourceMetricSourceType:
		return metric.ContainerResource.Name.String()
	case autoscalingv2.ExternalMetricSourceType:
		return metric.External.Metric.Name
	default:
		return ""
	}
}

// GetPredictionMetricIdentifier return metric name used by prediction
func GetPredictionMetricIdentifier(metric autoscalingv2.MetricSpec) string {
	var prefix string
	switch metric.Type {
	case autoscalingv2.PodsMetricSourceType:
		prefix = "pods"
	case autoscalingv2.ResourceMetricSourceType:
		prefix = "resource"
	case autoscalingv2.ContainerResourceMetricSourceType:
		prefix = "container-resource"
	case autoscalingv2.ExternalMetricSourceType:
		prefix = "external"
	}

	return fmt.Sprintf("%s.%s", prefix, GetMetricName(metric))
}

// GetExpressionQueryAnnotation return metric query from annotation by metricName
func GetExpressionQueryAnnotation(metricIdentifier string, annotations map[string]string) string {
	for k, v := range annotations {
		if strings.HasPrefix(k, known.EffectiveHorizontalPodAutoscalerExternalMetricsAnnotationPrefix) {
			compileRegex := regexp.MustCompile(fmt.Sprintf("%s(.*)", known.EffectiveHorizontalPodAutoscalerExternalMetricsAnnotationPrefix))
			matchArr := compileRegex.FindStringSubmatch(k)
			if len(matchArr) == 2 && matchArr[1][1:] == metricIdentifier {
				return v
			}
		}
	}

	return ""
}

func IsExpressionQueryAnnotationEnabled(metricIdentifier string, annotations map[string]string) bool {
	for k := range annotations {
		if strings.HasPrefix(k, known.EffectiveHorizontalPodAutoscalerExternalMetricsAnnotationPrefix) {
			compileRegex := regexp.MustCompile(fmt.Sprintf("%s(.*)", known.EffectiveHorizontalPodAutoscalerExternalMetricsAnnotationPrefix))
			matchArr := compileRegex.FindStringSubmatch(k)
			if len(matchArr) == 2 && matchArr[1][1:] == metricIdentifier {
				return true
			}
		}
	}

	return false
}

// GetExpressionQueryDefault return default metric query
func GetExpressionQueryDefault(metric autoscalingv2.MetricSpec, namespace string, name string, kind string) string {
	var expressionQuery string
	switch metric.Type {
	case autoscalingv2.ResourceMetricSourceType:
		switch metric.Resource.Name {
		case "cpu":
			expressionQuery = GetWorkloadCpuUsageExpression(namespace, name, kind)
		case "memory":
			expressionQuery = GetWorkloadMemUsageExpression(namespace, name, kind)
		}
	case autoscalingv2.ContainerResourceMetricSourceType:
		switch metric.ContainerResource.Name {
		case "cpu":
			expressionQuery = GetContainerCpuUsageExpression(namespace, name, kind, metric.ContainerResource.Container)
		case "memory":
			expressionQuery = GetContainerMemUsageExpression(namespace, name, kind, metric.ContainerResource.Container)
		}
	case autoscalingv2.PodsMetricSourceType:
		var labels []string
		if metric.Pods.Metric.Selector != nil {
			for k, v := range metric.Pods.Metric.Selector.MatchLabels {
				labels = append(labels, k+"="+`"`+v+`"`)
			}
		}
		expressionQuery = GetCustomerExpression(metric.Pods.Metric.Name, strings.Join(labels, ","))
	case autoscalingv2.ExternalMetricSourceType:
		var labels []string
		if metric.External.Metric.Selector != nil {
			for k, v := range metric.External.Metric.Selector.MatchLabels {
				labels = append(labels, k+"="+`"`+v+`"`)
			}
		}
		expressionQuery = GetCustomerExpression(metric.External.Metric.Name, strings.Join(labels, ","))
	}

	return expressionQuery
}

```

### Core Architecture Module: `pkg/utils/expression_prom_default.go`
```
package utils

import (
	"fmt"
	"strings"
)

// todo: later we change these templates to configurable like prometheus-adapter
const (
	ExtensionLabelsHolder = `EXTENSION_LABELS_HOLDER`
	// WorkloadCpuUsageExprTemplate is used to query workload cpu usage by promql,  param is namespace,workload-name,duration str
	WorkloadCpuUsageExprTemplate = `sum(irate(container_cpu_usage_seconds_total{namespace="%s",pod=~"%s",container!=""EXTENSION_LABELS_HOLDER}[%s]))`
	// WorkloadMemUsageExprTemplate is used to query workload mem usage by promql, param is namespace, workload-name
	WorkloadMemUsageExprTemplate = `sum(container_memory_working_set_bytes{namespace="%s",pod=~"%s",container!=""EXTENSION_LABELS_HOLDER})`

	// following is node exporter metric for node cpu/memory usage
	// NodeCpuUsageExprTemplate is used to query node cpu usage by promql,  param is node name which prometheus scrape, duration str
	NodeCpuUsageExprTemplate = `sum(count(node_cpu_seconds_total{mode="idle",instance=~"(%s)(:\\d+)?"EXTENSION_LABELS_HOLDER}) by (mode, cpu)) - sum(irate(node_cpu_seconds_total{mode="idle",instance=~"(%s)(:\\d+)?"EXTENSION_LABELS_HOLDER}[%s]))`
	// NodeMemUsageExprTemplate is used to query node memory usage by promql,  param is node name, node name which prometheus scrape
	NodeMemUsageExprTemplate = `sum(node_memory_MemTotal_bytes{instance=~"(%s)(:\\d+)?EXTENSION_LABELS_HOLDER"} - node_memory_MemAvailable_bytes{instance=~"(%s)(:\\d+)?"EXTENSION_LABELS_HOLDER})`

	// NodeCpuRequestUtilizationExprTemplate is used to query node cpu request utilization by promql, param is node name, node name which prometheus scrape
	NodeCpuRequestUtilizationExprTemplate = `sum(kube_pod_container_resource_requests{node="%s", resource="cpu", unit="core"EXTENSION_LABELS_HOLDER} * on (node) group_left() max(kube_node_labels{label_beta_kubernetes_io_instance_type!~"eklet", label_node_kubernetes_io_instance_type!~"eklet"EXTENSION_LABELS_HOLDER}) by (node)) by (node) / sum(kube_node_status_capacity{node="%s", resource="cpu", unit="core"EXTENSION_LABELS_HOLDER} * on (node) group_left() max(kube_node_labels{label_beta_kubernetes_io_instance_type!~"eklet", label_node_kubernetes_io_instance_type!~"eklet"EXTENSION_LABELS_HOLDER}) by (node)) by (node) `
	// NodeMemRequestUtilizationExprTemplate is used to query node memory request utilization by promql, param is node name, node name which prometheus scrape
	NodeMemRequestUtilizationExprTemplate = `sum(kube_pod_container_resource_requests{node="%s", resource="memory", unit="byte", namespace!=""EXTENSION_LABELS_HOLDER} * on (node) group_left() max(kube_node_labels{label_beta_kubernetes_io_instance_type!~"eklet", label_node_kubernetes_io_instance_type!~"eklet"EXTENSION_LABELS_HOLDER}) by (node)) by (node) / sum(kube_node_status_capacity{node="%s", resource="memory", unit="byte"EXTENSION_LABELS_HOLDER} * on (node) group_left() max(kube_node_labels{label_beta_kubernetes_io_instance_type!~"eklet", label_node_kubernetes_io_instance_type!~"eklet"EXTENSION_LABELS_HOLDER}) by (node)) by (node) `
	// NodeCpuUsageUtilizationExprTemplate is used to query node memory usage utilization by promql, param is node name, node name which prometheus scrape
	NodeCpuUsageUtilizationExprTemplate = `sum(label_replace(irate(container_cpu_usage_seconds_total{instance="%s", container!="POD", container!="",image!=""EXTENSION_LABELS_HOLDER}[1h]), "node", "$1", "instance",  "(^[^:]+)") * on (node) group_left() max(kube_node_labels{label_beta_kubernetes_io_instance_type!~"eklet", label_node_kubernetes_io_instance_type!~"eklet"EXTENSION_LABELS_HOLDER}) by (node)) by (node) / sum(kube_node_status_capacity{node="%s", resource="cpu", unit="core"EXTENSION_LABELS_HOLDER} * on (node) group_left() max(kube_node_labels{label_beta_kubernetes_io_instance_type!~"eklet", label_node_kubernetes_io_instance_type!~"eklet"EXTENSION_LABELS_HOLDER}) by (node)) by (node) `
	// NodeMemUsageUtilizationExprTemplate is used to query node memory usage utilization by promql, param is node name, node name which prometheus scrape
	NodeMemUsageUtilizationExprTemplate = `sum(label_replace(container_memory_usage_bytes{instance="%s", namespace!="",container!="POD", container!="",image!=""EXTENSION_LABELS_HOLDER}, "node", "$1", "instance", "(^[^:]+)") * on (node) group_left() max(kube_node_labels{label_beta_kubernetes_io_instance_type!~"eklet", label_node_kubernetes_io_instance_type!~"eklet"EXTENSION_LABELS_HOLDER}) by (node)) by (node) / sum(kube_node_status_capacity{node="%s", resource="memory", unit="byte"EXTENSION_LABELS_HOLDER} * on (node) group_left() max(kube_node_labels{label_beta_kubernetes_io_instance_type!~"eklet", label_node_kubernetes_io_instance_type!~"eklet"EXTENSION_LABELS_HOLDER}) by (node)) by (node) `

	// PodCpuUsageExprTemplate is used to query pod cpu usage by promql,  param is namespace,pod, duration str
	PodCpuUsageExprTemplate = `sum(irate(container_cpu_usage_seconds_total{container!="POD",namespace="%s",pod="%s"EXTENSION_LABELS_HOLDER}[%s]))`
	// PodMemUsageExprTemplate is used to query pod cpu usage by promql,  param is namespace,pod
	PodMemUsageExprTemplate = `sum(container_memory_working_set_bytes{container!="POD",namespace="%s",pod="%s"EXTENSION_LABELS_HOLDER})`

	// ContainerCpuUsageExprTemplate is used to query container cpu usage by promql,  param is namespace,pod,container duration str
	ContainerCpuUsageExprTemplate = `irate(container_cpu_usage_seconds_total{container!="POD",namespace="%s",pod=~"%s",container="%s"EXTENSION_LABELS_HOLDER}[%s])`
	// ContainerMemUsageExprTemplate is used to query container cpu usage by promql,  param is namespace,pod,container
	ContainerMemUsageExprTemplate = `container_memory_working_set_bytes{container!="POD",namespace="%s",pod=~"%s",container="%s"EXTENSION_LABELS_HOLDER}`

	CustomerExprTemplate = `sum(%s{%sEXTENSION_LABELS_HOLDER})`

	// Container network cumulative count of bytes received
	queryFmtNetReceiveBytes = `sum(rate(container_network_receive_bytes_total{namespace="%s",pod=~"%s",container!=""EXTENSION_LABELS_HOLDER}[3m]))`
	// Container network cumulative count of bytes transmitted
	queryFmtNetTransferBytes = `sum(rate(container_network_transmit_bytes_total{namespace="%s",pod=~"%s",container!=""EXTENSION_LABELS_HOLDER}[3m]))`
)

const (
	PostRegMatchesPodDeployment  = `[a-z0-9]+-[a-z0-9]{5}$`
	PostRegMatchesPodReplicaset  = `[a-z0-9]+$`
	PostRegMatchesPodDaemonSet   = `[a-z0-9]{5}$`
	PostRegMatchesPodStatefulset = `[0-9]+$`
)

var ExtensionLabelArray []string
var extensionLabelsString string

func SetExtensionLabels(extensionLabels string) {
	if extensionLabels != "" {
		for _, label := range strings.Split(extensionLabels, ",") {
			ExtensionLabelArray = append(ExtensionLabelArray, label)
		}

		extensionLabelsString = ","
		for index, label := range ExtensionLabelArray {
			labelArr := strings.Split(label, "=")
			if len(labelArr) != 2 {
				// skip the invalid kv
				continue
			}

			extensionLabelsString += fmt.Sprintf("%s=\"%s\"", labelArr[0], labelArr[1])
			if index != len(ExtensionLabelArray)-1 {
				extensionLabelsString += ","
			}
		}
	}
}

func GetPodNameReg(resourceName string, resourceType string) string {
	switch resourceType {
	case "DaemonSet":
		return fmt.Sprintf("^%s-%s", resourceName, PostRegMatchesPodDaemonSet)
	case "ReplicaSet":
		return fmt.Sprintf("^%s-%s", resourceName, PostRegMatchesPodReplicaset)
	case "Deployment":
		return fmt.Sprintf("^%s-%s", resourceName, PostRegMatchesPodDeployment)
	case "StatefulSet":
		return fmt.Sprintf("^%s-%s", resourceName, PostRegMatchesPodStatefulset)
	}
	return fmt.Sprintf("^%s-%s", resourceName, `.*`)
}

func GetCustomerExpression(metricName string, labels string) string {
	return fmtSprintfInternal(CustomerExprTemplate, metricName, labels)
}

func GetWorkloadCpuUsageExpression(namespace string, name string, kind string) string {
	return fmtSprintfInternal(WorkloadCpuUsageExprTemplate, namespace, GetPodNameReg(name, kind), "3m")
}

func GetWorkloadMemUsageExpression(namespace string, name string, kind string) string {
	return fmtSprintfInternal(WorkloadMemUsageExprTemplate, namespace, GetPodNameReg(name, kind))
}

func GetContainerCpuUsageExpression(namespace string, workloadName string, kind string, containerName string) string {
	return fmtSprintfInternal(ContainerCpuUsageExprTemplate, namespace, GetPodNameReg(workloadName, kind), containerName, "3m")
}

func GetContainerMemUsageExpression(namespace string, workloadName string, kind string, containerName string) string {
	return fmtSprintfInternal(ContainerMemUsageExprTemplate, namespace, GetPodNameReg(workloadName, kind), containerName)
}

func GetPodCpuUsageExpression(namespace string, name string) string {
	return fmtSprintfInternal(PodCpuUsageExprTemplate, namespace, name, "3m")
}

func GetPodMemUsageExpression(namespace string, name string) string {
	return fmtSprintfInternal(PodMemUsageExprTemplate, namespace, name)
}

func GetNodeCpuUsageExpression(nodeName string) string {
	return fmtSprintfInternal(NodeCpuUsageExprTemplate, nodeName, nodeName, "3m")
}

func GetNodeMemUsageExpression(nodeName string) string {
	return fmtSprintfInternal(NodeMemUsageExprTemplate, nodeName, nodeName)
}

func GetNodeCpuRequestUtilizationExpression(nodeName string) string {
	return fmtSprintfInternal(NodeCpuRequestUtilizationExprTemplate, nodeName, nodeName)
}

func GetNodeMemRequestUtilizationExpression(nodeName string) string {
	return fmtSprintfInternal(NodeMemRequestUtilizationExprTemplate, nodeName, nodeName)
}

func GetNodeCpuUsageUtilizationExpression(nodeName string) string {
	return fmtSprintfInternal(NodeCpuUsageUtilizationExprTemplate, nodeName, nodeName)
}

func GetNodeMemUsageUtilizationExpression(nodeName string) string {
	return fmtSprintfInternal(NodeMemUsageUtilizationExprTemplate, nodeName, nodeName)
}

func GetWorkloadNetReceiveBytesExpression(namespace string, name string, kind string) string {
	return fmtSprintfInternal(queryFmtNetReceiveBytes, namespace, GetPodNameReg(name, 
```

### Core Architecture Module: `pkg/utils/hpa.go`
```
package utils

import (
	"context"
	"fmt"

	autoscalingv2 "k8s.io/api/autoscaling/v2beta2"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"

	autoscalingapi "github.com/gocrane/api/autoscaling/v1alpha1"
	"github.com/gocrane/crane/pkg/known"
)

func GetHPAFromScaleTarget(context context.Context, kubeClient client.Client, namespace string, objRef corev1.ObjectReference) (*autoscalingv2.HorizontalPodAutoscaler, error) {
	hpaList := &autoscalingv2.HorizontalPodAutoscalerList{}
	opts := []client.ListOption{
		client.InNamespace(namespace),
	}
	err := kubeClient.List(context, hpaList, opts...)
	if err != nil {
		return nil, err
	}

	for _, hpa := range hpaList.Items {
		// bypass hpa that controller by ehpa
		if hpa.Labels != nil && hpa.Labels["app.kubernetes.io/managed-by"] == known.EffectiveHorizontalPodAutoscalerManagedBy {
			continue
		}

		if hpa.Spec.ScaleTargetRef.Name == objRef.Name &&
			hpa.Spec.ScaleTargetRef.Kind == objRef.Kind &&
			hpa.Spec.ScaleTargetRef.APIVersion == objRef.APIVersion {
			return &hpa, nil
		}
	}

	return nil, fmt.Errorf("HPA not found")
}

func GetEHPAFromScaleTarget(context context.Context, kubeClient client.Client, namespace string, objRef corev1.ObjectReference) (*autoscalingapi.EffectiveHorizontalPodAutoscaler, error) {
	ehpaList := &autoscalingapi.EffectiveHorizontalPodAutoscalerList{}
	opts := []client.ListOption{
		client.InNamespace(namespace),
	}
	err := kubeClient.List(context, ehpaList, opts...)
	if err != nil {
		return nil, err
	}

	for _, ehpa := range ehpaList.Items {
		if ehpa.Spec.ScaleTargetRef.Name == objRef.Name &&
			ehpa.Spec.ScaleTargetRef.Kind == objRef.Kind &&
			ehpa.Spec.ScaleTargetRef.APIVersion == objRef.APIVersion {
			return &ehpa, nil
		}
	}

	return nil, nil
}

func IsHPAControlledByEHPA(hpa *autoscalingv2.HorizontalPodAutoscaler) bool {
	for _, ownerReference := range hpa.OwnerReferences {
		gv, err := schema.ParseGroupVersion(ownerReference.APIVersion)
		if err != nil {
			return false
		}
		if gv.Group == autoscalingapi.GroupName && ownerReference.Kind == "EffectiveHorizontalPodAutoscaler" {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `pkg/utils/labels.go`
```
package utils

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

func LabelSelectorMatched(maps map[string]string, selector *metav1.LabelSelector) (bool, error) {
	if selector == nil {
		return true, nil
	}

	ls, err := metav1.LabelSelectorAsSelector(selector)
	if err != nil {
		return false, err
	}

	return ls.Matches(labels.Set(maps)), nil
}

// ContainMaps to judge the maps b is contained by maps a
func ContainMaps(a map[string]string, b map[string]string) bool {
	for k, v := range b {
		if vv, ok := a[k]; !ok {
			return false
		} else {
			if vv != v {
				return false
			}
		}
	}
	return true
}

```

### Core Architecture Module: `pkg/utils/node.go`
```
package utils

import (
	"encoding/json"
	"fmt"
	"strconv"

	"golang.org/x/net/context"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientset "k8s.io/client-go/kubernetes"
	kubeclient "k8s.io/client-go/kubernetes"
	corelisters "k8s.io/client-go/listers/core/v1"
	"k8s.io/klog/v2"
	kubeletconfigv1beta1 "k8s.io/kubelet/config/v1beta1"
	kubeletconfiginternal "k8s.io/kubernetes/pkg/kubelet/apis/config"
	kubeletscheme "k8s.io/kubernetes/pkg/kubelet/apis/config/scheme"

	topologyapi "github.com/gocrane/api/topology/v1alpha1"
)

const defaultRetryTimes = 3

// UpdateNodeConditionsStatues be used to update node condition with check whether it needs to update
func UpdateNodeConditionsStatues(client clientset.Interface, nodeLister corelisters.NodeLister, nodeName string, condition v1.NodeCondition, retry *uint64) (*v1.Node, error) {

	for i := uint64(0); i < GetUint64withDefault(retry, defaultRetryTimes); i++ {
		node, err := nodeLister.Get(nodeName)
		if err != nil {
			return nil, err
		}

		updateNode, needUpdate := updateNodeConditions(node, condition)
		if needUpdate {
			klog.Warningf("Updating node condition %v", condition)
			if updateNode, err = client.CoreV1().Nodes().UpdateStatus(context.Background(), updateNode, metav1.UpdateOptions{}); err != nil {
				if errors.IsConflict(err) {
					continue
				} else {
					return nil, err
				}
			}
		}

		return updateNode, nil
	}

	return nil, fmt.Errorf("update node failed, conflict too more times")
}

func updateNodeConditions(node *v1.Node, condition v1.NodeCondition) (*v1.Node, bool) {
	updatedNode := node.DeepCopy()

	// loop and found the condition type
	for i, cond := range updatedNode.Status.Conditions {
		if cond.Type == condition.Type {
			if cond.Status == condition.Status {
				return updatedNode, false
			} else {
				updatedNode.Status.Conditions[i] = condition
				return updatedNode, true
			}
		}
	}

	// not found the condition, to add the condition to the end
	updatedNode.Status.Conditions = append(updatedNode.Status.Conditions, condition)

	return updatedNode, true
}

// UpdateNodeTaints be used to update node taints with check whether it needs to update
func UpdateNodeTaints(client clientset.Interface, nodeLister corelisters.NodeLister, nodeName string, taint v1.Taint, retry *uint64) (*v1.Node, error) {

	for i := uint64(0); i < GetUint64withDefault(retry, defaultRetryTimes); i++ {
		node, err := nodeLister.Get(nodeName)
		if err != nil {
			return nil, err
		}

		updateNode, needUpdate := updateNodeTaints(node, taint)
		if needUpdate {
			if updateNode, err = client.CoreV1().Nodes().Update(context.Background(), updateNode, metav1.UpdateOptions{}); err != nil {
				if errors.IsConflict(err) {
					continue
				} else {
					return nil, err
				}
			}
		}

		return updateNode, nil
	}

	return nil, fmt.Errorf("failed to update node taints after %d retries", GetUint64withDefault(retry, defaultRetryTimes))
}

func updateNodeTaints(node *v1.Node, taint v1.Taint) (*v1.Node, bool) {
	updatedNode := node.DeepCopy()

	for i, t := range updatedNode.Spec.Taints {
		if t.Key == taint.Key {
			if (t.Value == taint.Value) && (t.Effect == taint.Effect) {
				return updatedNode, false
			} else {
				updatedNode.Spec.Taints[i] = taint
				return updatedNode, true
			}
		}
	}

	// not found the taint, to add the taint
	updatedNode.Spec.Taints = append(updatedNode.Spec.Taints, taint)
	return updatedNode, true
}

func RemoveNodeTaints(client clientset.Interface, nodeLister corelisters.NodeLister, nodeName string, taint v1.Taint, retry *uint64) (*v1.Node, error) {
	for i := uint64(0); i < GetUint64withDefault(retry, defaultRetryTimes); i++ {
		node, err := nodeLister.Get(nodeName)
		if err != nil {
			return nil, err
		}

		updateNode, needUpdate := removeNodeTaints(node, taint)
		if needUpdate {
			klog.V(4).Infof("Removing node taint %v", taint)
			if updateNode, err = client.CoreV1().Nodes().Update(context.Background(), updateNode, metav1.UpdateOptions{}); err != nil {
				if errors.IsConflict(err) {
					continue
				} else {
					return nil, err
				}
			}
		}

		return updateNode, nil
	}

	return nil, fmt.Errorf("update node failed, conflict too more times")
}

func removeNodeTaints(node *v1.Node, taint v1.Taint) (*v1.Node, bool) {

	updatedNode := node.DeepCopy()

	var foundTaint = false
	var taints []v1.Taint

	for _, t := range updatedNode.Spec.Taints {
		if t.Key == taint.Key && t.Effect == taint.Effect {
			foundTaint = true
		} else {
			taints = append(taints, t)
		}
	}

	// found the taint, remove it
	if foundTaint {
		updatedNode.Spec.Taints = taints
		return updatedNode, true
	}

	return updatedNode, false
}

// IsNodeAwareOfTopology returns default topology awareness policy.
func IsNodeAwareOfTopology(attr map[string]string) *bool {
	if val, exist := attr[topologyapi.LabelNodeTopologyAwarenessKey]; exist {
		if awareness, err := strconv.ParseBool(val); err == nil {
			return &awareness
		}
	}
	return nil
}

// BuildZoneName returns the canonical name of a NUMA zone from its ID.
func BuildZoneName(nodeID int) string {
	return fmt.Sprintf("node%d", nodeID)
}

func GetKubeletConfig(ctx context.Context, c kubeclient.Interface, hostname string) (*kubeletconfiginternal.KubeletConfiguration, error) {
	result, err := c.CoreV1().RESTClient().Get().
		Resource("nodes").
		SubResource("proxy").
		Name(hostname).
		Suffix("configz").
		Do(ctx).
		Raw()
	if err != nil {
		return nil, err
	}

	// This hack because /configz reports the following structure:
	// {"kubeletconfig": {the JSON representation of kubeletconfigv1beta1.KubeletConfiguration}}
	type configzWrapper struct {
		ComponentConfig kubeletconfigv1beta1.KubeletConfiguration `json:"kubeletconfig"`
	}
	configz := configzWrapper{}

	if err = json.Unmarshal(result, &configz); err != nil {
		return nil, fmt.Errorf("failed to unmarshal json for kubelet config: %v", err)
	}

	scheme, _, err := kubeletscheme.NewSchemeAndCodecs()
	if err != nil {
		return nil, err
	}
	cfg := kubeletconfiginternal.KubeletConfiguration{}
	if err = scheme.Convert(&configz.ComponentConfig, &cfg, nil); err != nil {
		return nil, err
	}

	return &cfg, nil
}

```

### Core Architecture Module: `pkg/utils/pod.go`
```
package utils

import (
	"context"
	"fmt"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"
	policyv1beta1 "k8s.io/api/policy/v1beta1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientset "k8s.io/client-go/kubernetes"
	"k8s.io/klog/v2"
	kubelettypes "k8s.io/kubernetes/pkg/kubelet/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/gocrane/crane/pkg/known"
)

const (
	ExtResourcePrefixFormat = "gocrane.io/%s"
)

// GetAvailablePods return a set with pod names that paas IsPodAvailable check
func GetAvailablePods(pods []v1.Pod) []v1.Pod {
	var availablePods []v1.Pod
	timeNow := metav1.Now()

	for _, pod := range pods {
		if IsPodAvailable(&pod, 30, timeNow) {
			availablePods = append(availablePods, pod)
		}
	}
	return availablePods
}

// IsPodAvailable returns true if a pod is available; false otherwise.
// copied from k8s.io/kubernetes/pkg/api/v1/pod.go
func IsPodAvailable(pod *v1.Pod, minReadySeconds int32, now metav1.Time) bool {
	if !IsPodReady(pod) {
		return false
	}

	c := GetPodReadyCondition(pod.Status)
	minReadySecondsDuration := time.Duration(minReadySeconds) * time.Second
	if minReadySeconds == 0 || (!c.LastTransitionTime.IsZero() && c.LastTransitionTime.Add(minReadySecondsDuration).Before(now.Time)) {
		return true
	}
	return false
}

// IsPodReady returns true if a pod is ready; false otherwise.
// copied from k8s.io/kubernetes/pkg/api/v1/pod.go and modified
func IsPodReady(pod *v1.Pod) bool {
	if pod.DeletionTimestamp != nil || pod.Status.Phase != v1.PodRunning {
		return false
	}
	condition := GetPodReadyCondition(pod.Status)
	return condition != nil && condition.Status == v1.ConditionTrue
}

// GetPodReadyCondition extracts the pod ready condition from the given status and returns that.
// Returns nil if the condition is not present.
// copied from k8s.io/kubernetes/pkg/api/v1/pod.go
func GetPodReadyCondition(status v1.PodStatus) *v1.PodCondition {
	_, condition := GetPodCondition(&status, v1.PodReady)
	return condition
}

// GetPodCondition extracts the provided condition from the given status and returns that.
// Returns nil and -1 if the condition is not present, and the index of the located condition.
// copied from k8s.io/kubernetes/pkg/api/v1/pod.go
func GetPodCondition(status *v1.PodStatus, conditionType v1.PodConditionType) (int, *v1.PodCondition) {
	if status == nil {
		return -1, nil
	}
	if status.Conditions == nil {
		return -1, nil
	}
	for i := range status.Conditions {
		if status.Conditions[i].Type == conditionType {
			return i, &status.Conditions[i]
		}
	}
	return -1, nil
}

// EvictPodWithGracePeriod evict pod with grace period
func EvictPodWithGracePeriod(client clientset.Interface, pod *v1.Pod, gracePeriodSeconds *int32) error {
	if kubelettypes.IsCriticalPod(pod) {
		return fmt.Errorf("eviction manager: cannot evict a critical pod(%s)", klog.KObj(pod))
	}

	var grace = GetInt64withDefault(pod.Spec.TerminationGracePeriodSeconds, known.DefaultDeletionGracePeriodSeconds)
	if gracePeriodSeconds != nil {
		grace = int64(*gracePeriodSeconds)
	}

	e := &policyv1beta1.Eviction{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pod.Name,
			Namespace: pod.Namespace,
		},
		DeleteOptions: metav1.NewDeleteOptions(grace),
	}

	return client.CoreV1().Pods(pod.Namespace).EvictV1beta1(context.Background(), e)
}

// CalculatePodRequests sum request total from pods. If the containerName is specified, the total amount of requests for that container will be calculated.
func CalculatePodRequests(pods []v1.Pod, resource v1.ResourceName, containerName string) (int64, error) {
	var requests int64
	for _, pod := range pods {
		for _, c := range pod.Spec.Containers {
			if containerName != "" && c.Name != containerName {
				continue
			}
			if containerRequest, ok := c.Resources.Requests[resource]; ok {
				requests += containerRequest.MilliValue()
			} else {
				return 0, fmt.Errorf("missing request for %s", resource)
			}
		}
	}
	return requests, nil
}

// GetPodContainerByName get container info by container name
func GetPodContainerByName(pod *v1.Pod, containerName string) (v1.Container, error) {
	for _, v := range pod.Spec.Containers {
		if v.Name == containerName {
			return v, nil
		}
	}

	return v1.Container{}, fmt.Errorf("container not found")
}

// CalculatePodTemplateRequests sum request total from podTemplate
func CalculatePodTemplateRequests(podTemplate *v1.PodTemplateSpec, resource v1.ResourceName) (int64, error) {
	var requests int64
	for _, c := range podTemplate.Spec.Containers {
		if containerRequest, ok := c.Resources.Requests[resource]; ok {
			requests += containerRequest.MilliValue()
		} else {
			return 0, fmt.Errorf("missing request for %s", resource)
		}
	}

	return requests, nil
}

// GetExtCpuRes get container's gocrane.io/cpu usage
func GetExtCpuRes(container v1.Container) (resource.Quantity, bool) {
	for res, val := range container.Resources.Limits {
		if strings.HasPrefix(res.String(), fmt.Sprintf(ExtResourcePrefixFormat, v1.ResourceCPU)) && val.Value() != 0 {
			return val, true
		}
	}

	for res, val := range container.Resources.Requests {
		if strings.HasPrefix(res.String(), fmt.Sprintf(ExtResourcePrefixFormat, v1.ResourceCPU)) && val.Value() != 0 {
			return val, true
		}
	}

	return resource.Quantity{}, false
}

// GetExtMemRes get container's gocrane.io/memory usage
func GetExtMemRes(container v1.Container) (resource.Quantity, bool) {
	for res, val := range container.Resources.Limits {
		if strings.HasPrefix(res.String(), fmt.Sprintf(ExtResourcePrefixFormat, v1.ResourceMemory)) && val.Value() != 0 {
			return val, true
		}
	}

	for res, val := range container.Resources.Requests {
		if strings.HasPrefix(res.String(), fmt.Sprintf(ExtResourcePrefixFormat, v1.ResourceMemory)) && val.Value() != 0 {
			return val, true
		}
	}

	return resource.Quantity{}, false
}

func GetContainerNameFromPod(pod *v1.Pod, containerId string) string {
	if containerId == "" {
		return ""
	}

	// for docker
	for _, v := range pod.Status.ContainerStatuses {
		strList := strings.Split(v.ContainerID, "//")
		if len(strList) > 0 {
			if strList[len(strList)-1] == containerId {
				return v.Name
			}
		}
	}

	// for containerd
	for _, v := range pod.Status.ContainerStatuses {
		strList := strings.Split(v.ContainerID, "//")
		if len(strList) > 0 {
			klog.V(6).Infof("cri-containerd is %s ", "cri-containerd-"+strList[len(strList)-1]+".scope")
			klog.V(6).Infof("containerid is %s", containerId)
			containerIdFromPod := fmt.Sprintf("cri-containerd-%s.scope", strList[len(strList)-1])
			if containerIdFromPod == containerId {
				return v.Name
			}
		}
	}
	return ""
}

func GetContainerFromPod(pod *v1.Pod, containerName string) *v1.Container {
	if containerName == "" {
		return nil
	}
	for _, v := range pod.Spec.Containers {
		if v.Name == containerName {
			return &v
		}
	}
	return nil
}

// GetContainerExtCpuResFromPod get container's gocrane.io/cpu usage
func GetContainerExtCpuResFromPod(pod *v1.Pod, containerName string) (resource.Quantity, bool) {
	c := GetContainerFromPod(pod, containerName)
	if c == nil {
		return resource.Quantity{}, false
	}
	return GetExtCpuRes(*c)
}

// GetContainerExtMemResFromPod get container's gocrane.io/memory usage
func GetContainerExtMemResFromPod(pod *v1.Pod, containerName string) (resource.Quantity, bool) {
	c := GetContainerFromPod(pod, containerName)
	if c == nil {
		return resource.Quantity{}, false
	}
	return GetExtMemRes(*c)
}

func GetContainerStatus(pod *v1.Pod, container v1.Container) v1.ContainerState {
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.Name == container.Name {
			return cs.State
		}
	}
	return v1.ContainerState{}
}

func GetContainerIdFromPod(pod *v1.Pod, containerName string) string {
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.Name == containerName {
			return GetContainerIdFromKey(cs.ContainerID)
		}
	}
	return ""
}

// GetElasticResourceLimit sum all containers resources limit for gocrane.io/resource
// As extended resource is not over committable resource, so request = limit
func GetElasticResourceLimit(pod *v1.Pod, resName v1.ResourceName) (amount int64) {
	resPrefix := fmt.Sprintf(ExtResourcePrefixFormat, resName)
	for i := range pod.Spec.Containers {
		container := pod.Spec.Containers[i]
		for res, val := range container.Resources.Limits {
			if strings.HasPrefix(res.String(), resPrefix) {
				amount += val.MilliValue()
			}
		}
	}
	return
}

func GetDaemonSetPods(kubeClient client.Client, namespace string, name string) ([]corev1.Pod, error) {
	ds := appsv1.DaemonSet{}
	err := kubeClient.Get(context.TODO(), client.ObjectKey{Namespace: namespace, Name: name}, &ds)
	if err != nil {
		return nil, err
	}

	opts := []client.ListOption{
		client.InNamespace(namespace),
		client.MatchingLabels(ds.Spec.Selector.MatchLabels),
	}

	podList := &corev1.PodList{}
	err = kubeClient.List(context.TODO(), podList, opts...)
	if err != nil {
		return nil, err
	}

	return podList.Items, nil
}

func GetNodePods(kubeClient client.Client, nodeName string) ([]corev1.Pod, error) {
	opts := []client.ListOption{
		client.MatchingFields{"spec.nodeName": nodeName},
	}

	podList := &corev1.PodList{}
	err := kubeClient.List(context.TODO(), podList, opts...)
	if err != nil {
		return nil, err
	}

	return podList.Items, nil
}

func GetNamespacePods(kubeClient client.Client, namespace string) ([]corev1.Pod, error) {
	// Get a list of pods for a specified namespace
	opts := []client.ListOption{
		client.InNamespace(namespace),
	}
	pods := &corev1.PodList{}
	if err := kubeClient.List(context.Background(), pods, opts...); err != nil {
		return nil, err
	}
	return pods.Items, nil
}

func GetServicePods(kubeClient client.Client, svc *corev1.Service) ([]corev1.Pod, error) {
	opts := []client.ListOption{
		client.InNamespace(svc.Namespace),
		client.MatchingLabels(svc.Spec.Selector),
	}

	podList := &corev1.PodList{}
	err := kubeClient.Li
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #933** (2026-09-17): **oom-record ConfigMap exceeds 1MB limit, causing craned busy-loop and OOMKilled/CrashLoopBackOff**
  *Symptoms*: E0727 19:30:17.587574       1 recorder.go:144] Update oomRecord failed: ConfigMap "oom-record" is invalid: []: Too long: must have at most 1048576 bytes  When the `oom-record` ConfigMap in `crane-system` grows to the Kubernetes 1MB object size limit (1048576 bytes), `PodOOMRecorder` can no longer update it and enters an unbounded, no-backoff retry loop. This floods the log, drives CPU/memory usage up, and eventually gets the `craned` container OOMKilled, leading to CrashLoopBackOff. After restart the ConfigMap is still oversized, so it never self-heals.  

- **Issue #932** (2026-07-05): **feat: add carbon grid api, add automatic apply and make UI changes**
  *Symptoms*: 

- **Issue #931** (2026-09-17): **Private channel for reporting a security issue**
  *Symptoms*: Hello maintainers,  I found potential security issues affecting GitHub Actions workflows in this repository.  I do not want to disclose technical details publicly before maintainers have reviewed them. Could you please enable GitHub private vulnerability reporting or provide an alternative private security contact email?  I can provide a detailed report including:  - affected workflow paths; - current affected commit; - vulnerability mechanism; - required attacker permissions and preconditions; - security impact assessment; - non-destructive validation steps; - suggested remediation.  Thank you.

- **Issue #928** (2026-01-10): **Update main.go**
  *Symptoms*: <!--  Thanks for sending a pull request!  -->  #### What type of PR is this?   #### What this PR does / why we need it:  #### Which issue(s) this PR fixes: <!-- *Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. --> Fixes #  #### Special notes for your reviewer:  

- **Issue #927** (2026-09-17): **目前支持华为云cce吗？**
  *Symptoms*: ## Describe the feature 目前支持华为云cce吗？

- **Issue #926** (2026-09-17): **我看官网有提到支持内存超分，但实测发现无效，是我使用方式不对吗**
  *Symptoms*: **环境**： k8s版本为1.19，且组件已安装好  <img width="507" height="107" alt="Image" src="https://github.com/user-attachments/assets/a9397541-a6dc-439e-8743-3e453508ec8a" />   **A机器内存情况**： k8s可分配-k8s已分配=大约20G，  <img width="383" height="212" alt="Image" src="https://github.com/user-attachments/assets/b2a7b05a-72d7-425d-83a9-37fbb443aca4" />  但机器的实际可用内存大于20G  <img width="689" height="39" alt="Image" src="https://github.com/user-attachments/assets/e92856ec-7a84-4c06-aff5-0052aba8c1b0" />  **现象**： 创建pod并指定调度到A机器，内存使用的配置是gocrane.io/memory: 25Gi  <img width="274" height="112" alt="Image" src="https://github.com/user-attachments/assets/a651c33f-777d-4d72-bfae-3cdd0fedde5b" />  提示pod还是由于节点内存不足而无法调度  **疑问**： https://gocrane.io/zh-cn/docs/tutorials/colocation-with-enhanced-qos/qos-dynamic-resource-oversold-and-limit.zh/ 提到可以使用配置gocrane.io/<$ResourceName>：<$value>来实现超分，是我理解或者用得不对吗

- **Issue #924** (2026-09-17): **Crane Container Image for s390x**
  *Symptoms*: ## Describe the feature  You are providing container images for arm and x856 until now. Other open source projects are using your container images as a foundation for building their own projects. Kubernetes-based projects have got new hybrid cloud features and that makes it possible to combine x86 and arm together with the mainframe architecture s390x.  I have seen, that you are building your container images with docker buildx, what is the best opportunity for multi-arch container images. Based on that, you can build for following architectures:  linux/amd64, linux/amd64/v2, linux/amd64/v3, linux/arm64, linux/riscv64, linux/ppc64, linux/ppc64le, linux/s390x, linux/386, linux/mips64le, linux/mips64, linux/loong64, linux/arm/v7, linux/arm/v6  I want to add the s390x architecture to your build pipelines. Your code is buildable on this architecture (verified via openSUSE). Is that ok for you?

- **Issue #922** (2026-09-17): **[Security Issue] metric-adapter ClusterRole grants full cluster-wide privileges**
  *Symptoms*: ## 🔐 [Security Issue] `metric-adapter` ClusterRole grants full cluster-wide privileges  The current configuration of the `metric-adapter` component defines an overly permissive ClusterRole and applies it directly to a running pod through a ServiceAccount and ClusterRoleBinding. This creates a **critical security risk** where compromising a single pod could lead to **complete cluster takeover**.  ---  ### 🔍 Misconfigured RBAC Flow with Source Links  ---  #### 1️⃣ Overprivileged `ClusterRole` definition   📄 [`rbac.yaml` lines 1–8](https://github.com/gocrane/crane/blob/2b0ddae8ebbca49788d77ece632d73b252533ef9/deploy/metric-adapter/rbac.yaml#L1-L8)  ```yaml apiVersion: rbac.authorization.k8s.io/v1 kind: ClusterRole metadata:   name: metric-adapter  # <-- (A) overly permissive role rules:   - apiGroups: [ "*" ]     resources: [ "*" ]     verbs: [ "*" ] ```  > This ClusterRole grants **full access to all API groups, resources, and actions**, including reading secrets, modifying configurations, deleting deployments, and more.  ---  #### 2️⃣ Binding the ClusterRole to a ServiceAccount   📄 [`rbac.yaml` lines 100–111](https://github.com/gocrane/crane/blob/2b0ddae8ebbca49788d77ece632d73b252533ef9/deploy/metric-adapter/rbac.yaml#L100-L111)  ```yaml apiVersion: rbac.authorization.k8s.io/v1 kind: ClusterRoleBinding metadata:   name: metric-adapter roleRef:   kind: ClusterRole   name: metric-adapter  # <-- (A) reference to the powerful role subjects:   - kind: ServiceAccount     name: m
  **Post-Mortem & Fix Analysis**:
  > ### You may look for issues: 1. 54% #920  <sub>🤖 By [issues-similarity-analysis](https://github.com/actions-cool/issues-similarity-analysis)</sub>  <!-- Created by actions-cool/issues-similarity-analysis. Do not remove. --> 

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

### Incident Patch 1: `2b0ddae8` (2024-12-20)
**Commit Message**: Merge pull request #915 from Cloudzp/fix_recommendation_trigger_err

fix the issue that trigger recommendation by run number abormal

**File**: `pkg/controller/recommendation/recommendation_trigger_controller.go` (modified, +1/-2)
```diff
@@ -101,12 +101,11 @@ func (c *RecommendationTriggerController) Reconcile(ctx context.Context, req ctr
 		}
 	}
 
+	executeIdentity(context.TODO(), nil, c.RecommenderMgr, c.Provider, c.PredictorMgr, recommendationRule, id, c.Client, c.ScaleClient, c.OOMRecorder, metav1.Now(), newStatus.RunNumber)
 	if currentMissionIndex == -1 {
 		klog.Warningf("cannot found recommendation mission %s", recommendationRuleRef.Name)
 		return ctrl.Result{}, nil
 	}
-
-	executeIdentity(context.TODO(), nil, c.RecommenderMgr, c.Provider, c.PredictorMgr, recommendationRule, id, c.Client, c.ScaleClient, c.OOMRecorder, metav1.Now(), newStatus.RunNumber)
 	if newStatus.Recommendations[currentMissionIndex].Message != "Success" {
 		err = c.Client.Delete(context.TODO(), recommendation)
 		if err != nil {
```

---

### Incident Patch 2: `7acac494` (2024-12-04)
**Commit Message**: fix the issue that trigger recommendation by run number abormal

**File**: `pkg/controller/recommendation/recommendation_trigger_controller.go` (modified, +1/-2)
```diff
@@ -101,12 +101,11 @@ func (c *RecommendationTriggerController) Reconcile(ctx context.Context, req ctr
 		}
 	}
 
+	executeIdentity(context.TODO(), nil, c.RecommenderMgr, c.Provider, c.PredictorMgr, recommendationRule, id, c.Client, c.ScaleClient, c.OOMRecorder, metav1.Now(), newStatus.RunNumber)
 	if currentMissionIndex == -1 {
 		klog.Warningf("cannot found recommendation mission %s", recommendationRuleRef.Name)
 		return ctrl.Result{}, nil
 	}
-
-	executeIdentity(context.TODO(), nil, c.RecommenderMgr, c.Provider, c.PredictorMgr, recommendationRule, id, c.Client, c.ScaleClient, c.OOMRecorder, metav1.Now(), newStatus.RunNumber)
 	if newStatus.Recommendations[currentMissionIndex].Message != "Success" {
 		err = c.Client.Delete(context.TODO(), recommendation)
 		if err != nil {
```

---

### Incident Patch 3: `d5e108b9` (2024-05-12)
**Commit Message**: fix: close SeedFile

**File**: `pkg/providers/mock/mock.go` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ func NewProvider(config *providers.MockConfig) (providers.Interface, error) {
 		klog.ErrorS(err, "Failed to open seed file", "seedFile", config.SeedFile)
 		return nil, err
 	}
+	defer r.Close()
 	buf, err := ioutil.ReadAll(r)
 	if err != nil {
 		klog.ErrorS(err, "Failed to read seed file", "seedFile", config.SeedFile)
```

---

### Incident Patch 4: `4f4e3cdb` (2024-04-17)
**Commit Message**: Merge pull request #900 from Cloudzp/bugfix

 fix issues #898

**File**: `go.mod` (modified, +6/-1)
```diff
@@ -9,6 +9,9 @@ require (
 	github.com/google/cadvisor v0.41.0
 	github.com/jaypipes/ghw v0.9.0
 	github.com/mjibson/go-dsp v0.0.0-20180508042940-11479a337f12
+	github.com/onsi/ginkgo v1.16.5
+	github.com/onsi/gomega v1.15.0
+	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.11.0
 	github.com/prometheus/common v0.26.0
 	github.com/shirou/gopsutil v3.21.10+incompatible
@@ -78,6 +81,7 @@ require (
 	github.com/ghodss/yaml v1.0.0 // indirect
 	github.com/gin-contrib/sse v0.1.0 // indirect
 	github.com/go-logr/logr v0.4.0 // indirect
+	github.com/go-logr/zapr v0.4.0 // indirect
 	github.com/go-ole/go-ole v1.2.6 // indirect
 	github.com/go-openapi/jsonpointer v0.19.5 // indirect
 	github.com/go-openapi/jsonreference v0.19.5 // indirect
@@ -113,12 +117,12 @@ require (
 	github.com/modern-go/reflect2 v1.0.2 // indirect
 	github.com/mrunalp/fileutils v0.5.0 // indirect
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
+	github.com/nxadm/tail v1.4.8 // indirect
 	github.com/opencontainers/go-digest v1.0.0 // indirect
 	github.com/opencontainers/image-spec v1.0.1 // indirect
 	github.com/opencontainers/runc v1.0.2 // indirect
 	github.com/opencontainers/runtime-spec v1.0.3-0.20210326190908-1c3f411f0417 // indirect
 	github.com/opencontainers/selinux v1.8.2 // indirect
-	github.com/pkg/errors v0.9.1 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
 	github.com/prometheus/client_model v0.2.0 // indirect
 	github.com/prometheus/procfs v0.6.0 // indirect
@@ -155,6 +159,7 @@ require (
 	google.golang.org/appengine v1.6.7 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.0.0 // indirect
+	gopkg.in/tomb.v1 v1.0.0-20141024135613-dd632973f1e7 // indirect
 	gopkg.in/warnings.v0 v0.1.2 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
 	gopkg.in/yaml.v3 v3.0.0-20210107192922-496545a6307b // indirect
```

**File**: `pkg/controller/recommendation/recommendation_checker.go` (modified, +1/-1)
```diff
@@ -60,6 +60,6 @@ func (r Checker) runChecker() {
 			"owner_name":    recommend.Spec.TargetRef.Name,
 			"update_status": updateStatus,
 			"result_status": resultStatus,
-		}).Set(1)
+		}).Set(time.Now().Sub(recommend.Status.LastUpdateTime.Time).Seconds())
 	}
 }
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller.go` (modified, +117/-6)
```diff
@@ -15,12 +15,16 @@ import (
 	"k8s.io/apimachinery/pkg/api/meta"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	unstructuredv1 "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/labels"
 	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/discovery"
 	"k8s.io/client-go/dynamic"
+	"k8s.io/client-go/dynamic/dynamicinformer"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/scale"
+	"k8s.io/client-go/tools/cache"
 	"k8s.io/client-go/tools/record"
 	"k8s.io/client-go/util/retry"
 	"k8s.io/klog/v2"
@@ -30,7 +34,6 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/predicate"
 
 	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
-
 	"github.com/gocrane/crane/pkg/known"
 	"github.com/gocrane/crane/pkg/metrics"
 	"github.com/gocrane/crane/pkg/oom"
@@ -54,6 +57,7 @@ type RecommendationRuleController struct {
 	dynamicClient   dynamic.Interface
 	discoveryClient discovery.DiscoveryInterface
 	Provider        providers.History
+	dynamicLister   DynamicLister
 }
 
 func (c *RecommendationRuleController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
@@ -147,9 +151,10 @@ func (c *RecommendationRuleController) doReconcile(ctx context.Context, recommen
 		keys = append(keys, k)
 	}
 	sort.Strings(keys) // sort key to get a certain order
+	recommendationIndex := NewRecommendationIndex(currRecommendations)
 	for _, key := range keys {
 		id := identities[key]
-		id.Recommendation = GetRecommendationFromIdentity(identities[key], currRecommendations)
+		id.Recommendation = recommendationIndex.GetRecommendation(id)
 		identitiesArray = append(identitiesArray, id)
 	}
 
@@ -243,6 +248,8 @@ func (c *RecommendationRuleController) SetupWithManager(mgr ctrl.Manager) error
 	c.kubeClient = kubernetes.NewForConfigOrDie(mgr.GetConfig())
 	c.discoveryClient = discovery.NewDiscoveryClientForConfigOrDie(mgr.GetConfig())
 	c.dynamicClient = dynamic.NewForConfigOrDie(mgr.GetConfig())
+	dynamicInformerFactory := dynamicinformer.NewDynamicSharedInformerFactory(c.dynamicClient, 0)
+	c.dynamicLister = NewDynamicInformerLister(dynamicInformerFactory)
 
 	return ctrl.NewControllerManagedBy(mgr).
 		For(&analysisv1alph1.RecommendationRule{}, builder.WithPredicates(predicate.GenerationChangedPredicate{})).
@@ -264,19 +271,19 @@ func (c *RecommendationRuleController) getIdentities(ctx context.Context, recomm
 
 		var unstructureds []unstructuredv1.Unstructured
 		if recommendationRule.Spec.NamespaceSelector.Any {
-			unstructuredList, err := c.dynamicClient.Resource(*gvr).List(ctx, metav1.ListOptions{})
+			unstructuredList, err := c.dynamicLister.List(ctx, *gvr, "")
 			if err != nil {
 				return nil, err
 			}
-			unstructureds = append(unstructureds, unstructuredList.Items...)
+			unstructureds = append(unstructureds, unstructuredList...)
 		} else {
 			for _, namespace := range recommendationRule.Spec.NamespaceSelector.MatchNames {
-				unstructuredList, err := c.dynamicClient.Resource(*gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
+				unstructuredList, err := c.dynamicLister.List(ctx, *gvr, namespace)
 				if err != nil {
 					return nil, err
 				}
 
-				unstructureds = append(unstructureds, unstructuredList.Items...)
+				unstructureds = append(unstructureds, unstructuredList...)
 			}
 		}
 
@@ -453,6 +460,7 @@ func executeIdentity(ctx context.Context, wg *sync.WaitGroup, recommenderMgr rec
 	defer func() {
 		if wg != nil {
 			wg.Done()
+			metrics.RecommendationExecutionCounter.WithLabelValues(id.APIVersion, id.Kind, id.Namespace, id.Name, id.Recommender).Inc()
 		}
 	}()
 	var message string
@@ -528,3 +536,106 @@ func IsConvertFromAnalytics(recommendationRule *analysisv1alph1.RecommendationRu
 
 	return false, ""
 }
+
+// DynamicLister is a lister for dynamic resources.
+type DynamicLister interface {
+	// List returns a list of resources matching the given groupVersionResource.
+	List(ctx context.Context, gvk schema.GroupVersionResource, namespace string) ([]unstructuredv1.Unstructured, error)
+}
+
+type dynamicInformerLister struct {
+	dynamicLister          map[schema.GroupVersionResource]cache.GenericLister
+	dynamicInformerFactory dynamicinformer.DynamicSharedInformerFactory
+	stopCh                 <-chan struct{}
+}
+
+func NewDynamicInformerLister(dynamicInformerFactory dynamicinformer.DynamicSharedInformerFactory) DynamicLister {
+	return &dynamicInformerLister{
+		dynamicLister:          map[schema.GroupVersionResource]cache.GenericLister{},
+		dynamicInformerFactory: dynamicInformerFactory,
+		stopCh:                 make(chan struct{}),
+	}
+}
+
+func (d *dynamicInformerLister) List(ctx context.Context, gvr schema.GroupVersionResource, namespace string) ([]unstructuredv1.Unstructured, error) {
+	var (
+		objects []runtime.Object
+		err     error
+	)
+
+	lister, exists := d.dynamicLister[gvr]
+	if !exists {
+		lister = d.dynamicInformerFactory.ForResource(gvr).Liste
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller_test.go` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+package recommendation
+
+import (
+	"reflect"
+	"testing"
+
+	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
+	corev1 "k8s.io/api/core/v1"
+	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+)
+
+func TestRecommendationIndex_GetRecommendation(t *testing.T) {
+	type fields struct {
+		recommendationList analysisv1alph1.RecommendationList
+	}
+	type args struct {
+		id ObjectIdentity
+	}
+
+	tests := []struct {
+		name   string
+		fields fields
+		args   args
+		want   *analysisv1alph1.Recommendation
+	}{
+		{
+			name: "TestRecommendationIndex_GetRecommendation good case",
+			fields: fields{
+				recommendationList: analysisv1alph1.RecommendationList{
+					Items: []analysisv1alph1.Recommendation{
+						{
+							ObjectMeta: v1.ObjectMeta{
+								Name:      "test-recommendation-rule",
+								Namespace: "test-namespace",
+							},
+							Spec: analysisv1alph1.RecommendationSpec{
+								TargetRef: corev1.ObjectReference{
+									Namespace:  "test-namespace",
+									Kind:       "Deployment",
+									Name:       "test-deployment-bar",
+									APIVersion: "app/v1",
+								},
+								Type: analysisv1alph1.AnalysisTypeResource,
+							},
+						},
+						{
+							ObjectMeta: v1.ObjectMeta{
+								Name:      "test-recommendation-rule",
+								Namespace: "test-namespace",
+							},
+							Spec: analysisv1alph1.RecommendationSpec{
+								TargetRef: corev1.ObjectReference{
+									Namespace:  "test-namespace",
+									Kind:       "Deployment",
+									Name:       "test-deployment-foo",
+									APIVersion: "app/v1",
+								},
+								Type: analysisv1alph1.AnalysisTypeResource,
+							},
+						},
+					},
+				},
+			},
+			want: &analysisv1alph1.Recommendation{
+				ObjectMeta: v1.ObjectMeta{
+					Name:      "test-recommendation-rule",
+					Namespace: "test-namespace",
+				},
+				Spec: analysisv1alph1.RecommendationSpec{
+					TargetRef: corev1.ObjectReference{
+						Namespace:  "test-namespace",
+						Kind:       "Deployment",
+						Name:       "test-deployment-bar",
+						APIVersion: "app/v1",
+					},
+					Type: analysisv1alph1.AnalysisTypeResource,
+				},
+			},
+			args: args{
+				id: ObjectIdentity{
+					Name:        "test-deployment-bar",
+					Namespace:   "test-namespace",
+					APIVersion:  "app/v1",
+					Kind:        "Deployment",
+					Recommender: "Resource",
+				},
+			},
+		},
+		{
+			name: "TestRecommendationIndex_GetRecommendation empty case",
+			fields: fields{
+				recommendationList: analysisv1alph1.RecommendationList{
+					Items: []analysisv1alph1.Recommendation{},
+				},
+			},
+			args: args{
+				id: ObjectIdentity{
+					Name:        "test-deployment-name",
+					Namespace:   "test-namespace",
+					APIVersion:  "app/v1",
+					Kind:        "Deployment",
+					Recommender: "Resources",
+				},
+			},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			idx := NewRecommendationIndex(tt.fields.recommendationList)
+			if got := idx.GetRecommendation(tt.args.id); !reflect.DeepEqual(got, tt.want) {
+				t.Errorf("GetRecommendation() = %v, want %v", got, tt.want)
+			}
+		})
+	}
+}
```

**File**: `pkg/metrics/analysis.go` (modified, +11/-1)
```diff
@@ -6,6 +6,16 @@ import (
 )
 
 var (
+	RecommendationExecutionCounter = prometheus.NewCounterVec(
+		prometheus.CounterOpts{
+			Namespace: "crane",
+			Subsystem: "analysis",
+			Name:      "recommendation_execution_total",
+			Help:      "The number of times Recommendation has been executed",
+		},
+		[]string{"apiversion", "owner_kind", "namespace", "owner_name", "type"},
+	)
+
 	ResourceRecommendation = prometheus.NewGaugeVec(
 		prometheus.GaugeOpts{
 			Namespace: "crane",
@@ -48,5 +58,5 @@ var (
 )
 
 func init() {
-	metrics.Registry.MustRegister(ResourceRecommendation, ReplicasRecommendation, SelectTargets, RecommendationsStatus)
+	metrics.Registry.MustRegister(RecommendationExecutionCounter, ResourceRecommendation, ReplicasRecommendation, SelectTargets, RecommendationsStatus)
 }
```

---

### Incident Patch 5: `d8d5dd20` (2024-04-17)
**Commit Message**: fix ut and fmt  error

**File**: `pkg/controller/recommendation/recommendation_rule_controller.go` (modified, +4/-5)
```diff
@@ -3,10 +3,6 @@ package recommendation
 import (
 	"context"
 	"fmt"
-	"k8s.io/apimachinery/pkg/labels"
-	"k8s.io/apimachinery/pkg/runtime/schema"
-	"k8s.io/client-go/dynamic/dynamicinformer"
-	"k8s.io/client-go/tools/cache"
 	"sort"
 	"strconv"
 	"strings"
@@ -19,12 +15,16 @@ import (
 	"k8s.io/apimachinery/pkg/api/meta"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	unstructuredv1 "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/labels"
 	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/client-go/discovery"
 	"k8s.io/client-go/dynamic"
+	"k8s.io/client-go/dynamic/dynamicinformer"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/scale"
+	"k8s.io/client-go/tools/cache"
 	"k8s.io/client-go/tools/record"
 	"k8s.io/client-go/util/retry"
 	"k8s.io/klog/v2"
@@ -34,7 +34,6 @@ import (
 	"sigs.k8s.io/controller-runtime/pkg/predicate"
 
 	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
-
 	"github.com/gocrane/crane/pkg/known"
 	"github.com/gocrane/crane/pkg/metrics"
 	"github.com/gocrane/crane/pkg/oom"
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller_test.go` (modified, +6/-4)
```diff
@@ -1,11 +1,12 @@
 package recommendation
 
 import (
+	"reflect"
+	"testing"
+
 	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
 	corev1 "k8s.io/api/core/v1"
 	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	"reflect"
-	"testing"
 )
 
 func TestRecommendationIndex_GetRecommendation(t *testing.T) {
@@ -69,14 +70,15 @@ func TestRecommendationIndex_GetRecommendation(t *testing.T) {
 					TargetRef: corev1.ObjectReference{
 						Namespace:  "test-namespace",
 						Kind:       "Deployment",
-						Name:       "test-deployment-name",
+						Name:       "test-deployment-bar",
 						APIVersion: "app/v1",
 					},
+					Type: analysisv1alph1.AnalysisTypeResource,
 				},
 			},
 			args: args{
 				id: ObjectIdentity{
-					Name:        "test-deployment-name",
+					Name:        "test-deployment-bar",
 					Namespace:   "test-namespace",
 					APIVersion:  "app/v1",
 					Kind:        "Deployment",
```

---

### Incident Patch 6: `c48a90b0` (2024-04-07)
**Commit Message**: fix issues #898

**File**: `go.mod` (modified, +6/-1)
```diff
@@ -9,6 +9,9 @@ require (
 	github.com/google/cadvisor v0.41.0
 	github.com/jaypipes/ghw v0.9.0
 	github.com/mjibson/go-dsp v0.0.0-20180508042940-11479a337f12
+	github.com/onsi/ginkgo v1.16.5
+	github.com/onsi/gomega v1.15.0
+	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.11.0
 	github.com/prometheus/common v0.26.0
 	github.com/shirou/gopsutil v3.21.10+incompatible
@@ -78,6 +81,7 @@ require (
 	github.com/ghodss/yaml v1.0.0 // indirect
 	github.com/gin-contrib/sse v0.1.0 // indirect
 	github.com/go-logr/logr v0.4.0 // indirect
+	github.com/go-logr/zapr v0.4.0 // indirect
 	github.com/go-ole/go-ole v1.2.6 // indirect
 	github.com/go-openapi/jsonpointer v0.19.5 // indirect
 	github.com/go-openapi/jsonreference v0.19.5 // indirect
@@ -113,12 +117,12 @@ require (
 	github.com/modern-go/reflect2 v1.0.2 // indirect
 	github.com/mrunalp/fileutils v0.5.0 // indirect
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
+	github.com/nxadm/tail v1.4.8 // indirect
 	github.com/opencontainers/go-digest v1.0.0 // indirect
 	github.com/opencontainers/image-spec v1.0.1 // indirect
 	github.com/opencontainers/runc v1.0.2 // indirect
 	github.com/opencontainers/runtime-spec v1.0.3-0.20210326190908-1c3f411f0417 // indirect
 	github.com/opencontainers/selinux v1.8.2 // indirect
-	github.com/pkg/errors v0.9.1 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
 	github.com/prometheus/client_model v0.2.0 // indirect
 	github.com/prometheus/procfs v0.6.0 // indirect
@@ -155,6 +159,7 @@ require (
 	google.golang.org/appengine v1.6.7 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.0.0 // indirect
+	gopkg.in/tomb.v1 v1.0.0-20141024135613-dd632973f1e7 // indirect
 	gopkg.in/warnings.v0 v0.1.2 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
 	gopkg.in/yaml.v3 v3.0.0-20210107192922-496545a6307b // indirect
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller.go` (modified, +116/-5)
```diff
@@ -3,6 +3,10 @@ package recommendation
 import (
 	"context"
 	"fmt"
+	"k8s.io/apimachinery/pkg/labels"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/dynamic/dynamicinformer"
+	"k8s.io/client-go/tools/cache"
 	"sort"
 	"strconv"
 	"strings"
@@ -54,6 +58,7 @@ type RecommendationRuleController struct {
 	dynamicClient   dynamic.Interface
 	discoveryClient discovery.DiscoveryInterface
 	Provider        providers.History
+	dynamicLister   DynamicLister
 }
 
 func (c *RecommendationRuleController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
@@ -147,9 +152,10 @@ func (c *RecommendationRuleController) doReconcile(ctx context.Context, recommen
 		keys = append(keys, k)
 	}
 	sort.Strings(keys) // sort key to get a certain order
+	recommendationIndex := NewRecommendationIndex(currRecommendations)
 	for _, key := range keys {
 		id := identities[key]
-		id.Recommendation = GetRecommendationFromIdentity(identities[key], currRecommendations)
+		id.Recommendation = recommendationIndex.GetRecommendation(id)
 		identitiesArray = append(identitiesArray, id)
 	}
 
@@ -243,6 +249,8 @@ func (c *RecommendationRuleController) SetupWithManager(mgr ctrl.Manager) error
 	c.kubeClient = kubernetes.NewForConfigOrDie(mgr.GetConfig())
 	c.discoveryClient = discovery.NewDiscoveryClientForConfigOrDie(mgr.GetConfig())
 	c.dynamicClient = dynamic.NewForConfigOrDie(mgr.GetConfig())
+	dynamicInformerFactory := dynamicinformer.NewDynamicSharedInformerFactory(c.dynamicClient, 0)
+	c.dynamicLister = NewDynamicInformerLister(dynamicInformerFactory)
 
 	return ctrl.NewControllerManagedBy(mgr).
 		For(&analysisv1alph1.RecommendationRule{}, builder.WithPredicates(predicate.GenerationChangedPredicate{})).
@@ -264,19 +272,19 @@ func (c *RecommendationRuleController) getIdentities(ctx context.Context, recomm
 
 		var unstructureds []unstructuredv1.Unstructured
 		if recommendationRule.Spec.NamespaceSelector.Any {
-			unstructuredList, err := c.dynamicClient.Resource(*gvr).List(ctx, metav1.ListOptions{})
+			unstructuredList, err := c.dynamicLister.List(ctx, *gvr, "")
 			if err != nil {
 				return nil, err
 			}
-			unstructureds = append(unstructureds, unstructuredList.Items...)
+			unstructureds = append(unstructureds, unstructuredList...)
 		} else {
 			for _, namespace := range recommendationRule.Spec.NamespaceSelector.MatchNames {
-				unstructuredList, err := c.dynamicClient.Resource(*gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
+				unstructuredList, err := c.dynamicLister.List(ctx, *gvr, namespace)
 				if err != nil {
 					return nil, err
 				}
 
-				unstructureds = append(unstructureds, unstructuredList.Items...)
+				unstructureds = append(unstructureds, unstructuredList...)
 			}
 		}
 
@@ -528,3 +536,106 @@ func IsConvertFromAnalytics(recommendationRule *analysisv1alph1.RecommendationRu
 
 	return false, ""
 }
+
+// DynamicLister is a lister for dynamic resources.
+type DynamicLister interface {
+	// List returns a list of resources matching the given groupVersionResource.
+	List(ctx context.Context, gvk schema.GroupVersionResource, namespace string) ([]unstructuredv1.Unstructured, error)
+}
+
+type dynamicInformerLister struct {
+	dynamicLister          map[schema.GroupVersionResource]cache.GenericLister
+	dynamicInformerFactory dynamicinformer.DynamicSharedInformerFactory
+	stopCh                 <-chan struct{}
+}
+
+func NewDynamicInformerLister(dynamicInformerFactory dynamicinformer.DynamicSharedInformerFactory) DynamicLister {
+	return &dynamicInformerLister{
+		dynamicLister:          map[schema.GroupVersionResource]cache.GenericLister{},
+		dynamicInformerFactory: dynamicInformerFactory,
+		stopCh:                 make(chan struct{}),
+	}
+}
+
+func (d *dynamicInformerLister) List(ctx context.Context, gvr schema.GroupVersionResource, namespace string) ([]unstructuredv1.Unstructured, error) {
+	var (
+		objects []runtime.Object
+		err     error
+	)
+
+	lister, exists := d.dynamicLister[gvr]
+	if !exists {
+		lister = d.dynamicInformerFactory.ForResource(gvr).Lister()
+		d.dynamicLister[gvr] = lister
+		d.dynamicInformerFactory.Start(d.stopCh)
+		if !d.dynamicInformerFactory.WaitForCacheSync(d.stopCh)[gvr] {
+			return nil, fmt.Errorf("failed to sync informer for %s", gvr)
+		}
+	}
+	if namespace != "" {
+		objects, err = lister.ByNamespace(namespace).List(labels.Everything())
+	} else {
+		objects, err = lister.List(labels.Everything())
+	}
+	if err != nil {
+		return nil, err
+	}
+
+	var unstructuredObjects []unstructuredv1.Unstructured
+	for _, obj := range objects {
+		unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
+		if err != nil {
+			return nil, err
+		}
+		unstructuredObjects = append(unstructuredObjects, unstructuredv1.Unstructured{Object: unstructuredObj})
+	}
+	return unstructuredObjects, nil
+}
+
+type IndexKey struct {
+	Namespace   string
+	APIVersion  string
+	Kind        string
+	Name        string
+	Recommender string
```

**File**: `pkg/controller/recommendation/recommendation_rule_controller_test.go` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+package recommendation
+
+import (
+	analysisv1alph1 "github.com/gocrane/api/analysis/v1alpha1"
+	corev1 "k8s.io/api/core/v1"
+	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"reflect"
+	"testing"
+)
+
+func TestRecommendationIndex_GetRecommendation(t *testing.T) {
+	type fields struct {
+		recommendationList analysisv1alph1.RecommendationList
+	}
+	type args struct {
+		id ObjectIdentity
+	}
+
+	tests := []struct {
+		name   string
+		fields fields
+		args   args
+		want   *analysisv1alph1.Recommendation
+	}{
+		{
+			name: "TestRecommendationIndex_GetRecommendation good case",
+			fields: fields{
+				recommendationList: analysisv1alph1.RecommendationList{
+					Items: []analysisv1alph1.Recommendation{
+						{
+							ObjectMeta: v1.ObjectMeta{
+								Name:      "test-recommendation-rule",
+								Namespace: "test-namespace",
+							},
+							Spec: analysisv1alph1.RecommendationSpec{
+								TargetRef: corev1.ObjectReference{
+									Namespace:  "test-namespace",
+									Kind:       "Deployment",
+									Name:       "test-deployment-bar",
+									APIVersion: "app/v1",
+								},
+								Type: analysisv1alph1.AnalysisTypeResource,
+							},
+						},
+						{
+							ObjectMeta: v1.ObjectMeta{
+								Name:      "test-recommendation-rule",
+								Namespace: "test-namespace",
+							},
+							Spec: analysisv1alph1.RecommendationSpec{
+								TargetRef: corev1.ObjectReference{
+									Namespace:  "test-namespace",
+									Kind:       "Deployment",
+									Name:       "test-deployment-foo",
+									APIVersion: "app/v1",
+								},
+								Type: analysisv1alph1.AnalysisTypeResource,
+							},
+						},
+					},
+				},
+			},
+			want: &analysisv1alph1.Recommendation{
+				ObjectMeta: v1.ObjectMeta{
+					Name:      "test-recommendation-rule",
+					Namespace: "test-namespace",
+				},
+				Spec: analysisv1alph1.RecommendationSpec{
+					TargetRef: corev1.ObjectReference{
+						Namespace:  "test-namespace",
+						Kind:       "Deployment",
+						Name:       "test-deployment-name",
+						APIVersion: "app/v1",
+					},
+				},
+			},
+			args: args{
+				id: ObjectIdentity{
+					Name:        "test-deployment-name",
+					Namespace:   "test-namespace",
+					APIVersion:  "app/v1",
+					Kind:        "Deployment",
+					Recommender: "Resource",
+				},
+			},
+		},
+		{
+			name: "TestRecommendationIndex_GetRecommendation empty case",
+			fields: fields{
+				recommendationList: analysisv1alph1.RecommendationList{
+					Items: []analysisv1alph1.Recommendation{},
+				},
+			},
+			args: args{
+				id: ObjectIdentity{
+					Name:        "test-deployment-name",
+					Namespace:   "test-namespace",
+					APIVersion:  "app/v1",
+					Kind:        "Deployment",
+					Recommender: "Resources",
+				},
+			},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			idx := NewRecommendationIndex(tt.fields.recommendationList)
+			if got := idx.GetRecommendation(tt.args.id); !reflect.DeepEqual(got, tt.want) {
+				t.Errorf("GetRecommendation() = %v, want %v", got, tt.want)
+			}
+		})
+	}
+}
```

---

### Incident Patch 7: `ed43bd2a` (2024-01-22)
**Commit Message**: Merge pull request #891 from payall4u/bugfix/avoid-panic-with-ext-memory

Fix crane agent panic when handling ext memory pods.

**File**: `pkg/ensurance/collector/cadvisor/cadvisor_linux.go` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ func (c *CadvisorCollector) Collect() (map[string][]common.TimeSeries, error) {
 				continue
 			}
 
-			if hasExtMemRes {
+			if hasExtMemRes && v.Stats[0].Memory != nil {
 				extResMemUse += float64(v.Stats[0].Memory.WorkingSet)
 			}
 
```

---

### Incident Patch 8: `ea200862` (2024-01-20)
**Commit Message**: Fix crane agent panic when pod use ext memory

Signed-off-by: payall4u <[REDACTED_EMAIL]>

**File**: `pkg/ensurance/collector/cadvisor/cadvisor_linux.go` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ func (c *CadvisorCollector) Collect() (map[string][]common.TimeSeries, error) {
 				continue
 			}
 
-			if hasExtMemRes {
+			if hasExtMemRes && v.Stats[0].Memory != nil {
 				extResMemUse += float64(v.Stats[0].Memory.WorkingSet)
 			}
 
```

---

### Incident Patch 9: `5c180262` (2024-01-18)
**Commit Message**: Merge pull request #888 from pmsl/bugfix/craned-rbac

change update workload to update workload status

**File**: `deploy/craned/rbac.yaml` (modified, +10/-1)
```diff
@@ -72,7 +72,16 @@ rules:
   - get
   - list
   - watch
-  - update
+- apiGroups:
+    - apps
+  resources:
+    - daemonsets/status
+    - deployments/status
+    - deployments/scale
+    - statefulsets/status
+    - statefulsets/scale
+  verbs:
+    - update
 - apiGroups:
   - autoscaling
   resources:
```

**File**: `pkg/controller/recommendation/updater.go` (modified, +2/-1)
```diff
@@ -99,7 +99,8 @@ func (c *RecommendationController) UpdateRecommendation(ctx context.Context, rec
 
 		if needUpdate {
 			unstructed.SetAnnotations(annotation)
-			err = c.Client.Update(ctx, unstructed)
+			//Convergence craned permissions
+			err = c.Client.Status().Update(ctx, unstructed)
 			if err != nil {
 				return false, fmt.Errorf("update target annotation failed: %v. ", err)
 			}
```

---

### Incident Patch 10: `832e1bc4` (2024-01-01)
**Commit Message**: fix oom record sort

**File**: `pkg/oom/recorder.go` (modified, +1/-1)
```diff
@@ -159,7 +159,7 @@ func (r *PodOOMRecorder) cleanOOMRecords(oomRecords []OOMRecord) []OOMRecord {
 			return records[i].OOMAt.Before(records[j].OOMAt)
 		})
 
-		records = records[0:r.OOMRecordMaxNumber]
+		records = records[len(oomRecords)-r.OOMRecordMaxNumber : len(oomRecords)]
 		oomRecords = records
 	}
 
```

---

### Incident Patch 11: `083ee9bf` (2023-12-28)
**Commit Message**: fix katex for tsp doc

**File**: `site/content/en/blog/_index.md` (modified, +0/-1)
```diff
@@ -1,6 +1,5 @@
 ---
 title: "Crane Blog"
-linkTitle: "Blog"
 menu:
   main:
     weight: 30
```

**File**: `site/content/en/docs/Core Concept/timeseries-forecasting-by-dsp.md` (renamed, +22/-21)
```diff
@@ -2,6 +2,7 @@
 title: "Time Series Forecast Algorithm-DSP"
 description: "Introduction for DSP Algorithm"
 weight: 16
+math: true
 ---
 
 Time series forecasting refers to using historical time series data to predict future values. Time series data typically consists of time and corresponding values, such as resource usage, stock prices, or temperature. DSP (Digital Signal Processing) is a digital signal processing technique that can be used for analyzing and processing time series data.
@@ -22,7 +23,7 @@ This article will introduce the implementation process and parameter settings of
 
 It is common for monitoring data to be missing at certain time points, and Crane will fill in the missing sampling points based on the surrounding data. The method is as follows:
 
-Assume that the sampling data between the m-th and n-th sampling points are missing (m+1<n). Let the sampling values at points m-th and n-th be $v_m$ and $v_n$. Then, let $$\Delta = {v_n - v_m \over n-m}$$, the missing data between m-th and n-th are $v_m+\Delta , v_m+2\Delta , ...$
+Assume that the sampling data between the m-th and n-th sampling points are missing (m+1<n). Let the sampling values at points m-th and n-th be \\(v_m\\) and \\(v_n\\). Then, let $$\Delta = {v_n - v_m \over n-m}$$, the missing data between m-th and n-th are $$v_m+\Delta , v_m+2\Delta , ...$$
 
 ![](/images/algorithm/dsp/missing_data_fill.png)
 
@@ -36,28 +37,28 @@ Occasionally, there may be some extreme outlier data points in the monitoring da
 
 These extreme outlier points will interfere with the periodic judgment of the signal and need to be removed. try as follows:
 
-Select the $P99.9$ and $P0.1$ of all sampling points in the actual sequence as the upper and lower threshold values, respectively. If a sampling value is lower than the lower limit or higher than the upper limit, set the value of the sampling point to the previous sampling value.
+Select the \\(P99.9\\) and \\(P0.1\\) of all sampling points in the actual sequence as the upper and lower threshold values, respectively. If a sampling value is lower than the lower limit or higher than the upper limit, set the value of the sampling point to the previous sampling value.
 
 ![](/images/algorithm/dsp/remove_outliers.png)
 
 #### Discrete Fourier Transform
 
-Performing a fast discrete Fourier transform (FFT) on the monitored time series (assuming a length of $N$) generates a spectrogram that intuitively displays the signal's frequency spectrum as "impulses" at various discrete points $k$.
-The vertical height of each impulse represents the "amplitude" of the periodic component corresponding to $k$, where $k$ takes values in the range $\(0,1,2, ... N-1\)$.
+Performing a fast discrete Fourier transform (FFT) on the monitored time series (assuming a length of \\(N\\)) generates a spectrogram that intuitively displays the signal's frequency spectrum as "impulses" at various discrete points \\(k\\).
+The vertical height of each impulse represents the "amplitude" of the periodic component corresponding to \\(k\\), where \\(k\\) takes values in the range \\(\(0,1,2, ... N-1\)\\).
 
-$k = 0$ corresponds to the "DC component" of the signal, which has no effect on the signal's periodicity and can be ignored.
+\\(k = 0\\) corresponds to the "DC component" of the signal, which has no effect on the signal's periodicity and can be ignored.
 
-Due to the conjugate symmetry of the first half and second half of the frequency spectrum sequence after the discrete Fourier transform, the graph is symmetric about the axis and only the first half $N/2$ needs to be considered.
+Due to the conjugate symmetry of the first half and second half of the frequency spectrum sequence after the discrete Fourier transform, the graph is symmetric about the axis and only the first half \\(N/2\\) needs to be considered.
 
-The period corresponding to $k$ is $$T = {N \over k} \bullet SampleInterval$$
+The period corresponding to \\(k\\) is $$T = {N \over k} \bullet SampleInterval$$
 
-To determine whether a signal has a period $T$, it is necessary to observe at least double of length $T$. Therefore, the maximum period that can be identified through a sequence of length $N$ is $N/2$. Thus, $k = 1$ can be ignored.
+To determine whether a signal has a period \\(T\\), it is necessary to observe at least double of length \\(T\\). Therefore, the maximum period that can be identified through a sequence of length \\(N\\) is \\(N/2\\). Thus, \\(k = 1\\) can be ignored.
 
-Therefore, the range of values for $k$ is $(2, 3, ... , N/2)$, corresponding to periods of $N/2, N/3, ...$ This is the "resolution" of period information that FFT can provide. If a signal's period does not fall on $N/k$, it will be spread over the entire frequency domain, leading to "frequency leakage."
+Therefore, the range of values for \\(k\\) is \\((2, 3, ... , N/2)\\), corresponding to periods of \\(N/2, N/3, ...\\) This is the "resolution" of period information that FFT can prov
```

**File**: `site/content/zh/blog/_index.md` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ---
-title: "Crane Blog"
-linkTitle: "Blog"
+title: "博客"
 menu:
   main:
     weight: 30
 ---
+ 
\ No newline at end of file
```

**File**: `site/content/zh/docs/Core Concept/timeseries-forecasting-by-dsp.md` (renamed, +20/-19)
```diff
@@ -2,6 +2,7 @@
 title: "时间序列预测算法-DSP"
 description: "Introduction for DSP Algorithm"
 weight: 16
+math: true
 ---
 
 时间序列预测是指使用过去的时间序列数据来预测未来的值。时间序列数据通常包括时间和相应的数值，例如资源用量、股票价格或气温。时间序列预测算法 DSP（Digital Signal Processing）是一种数字信号处理技术，可以用于分析和处理时间序列数据。
@@ -19,7 +20,7 @@ Crane使用在数字信号处理（Digital Signal Processing）领域中常用
 #### 填充缺失数据
 监控数据在某些时间点上缺失是很常见的现象，Crane会根据前后的数据对缺失的采样点进行填充。做法如下：
 
-假设第$m$个与第$n$个采样点之间采样数据缺失（$m+1 < n$）,设在$m$和$n$点的采样值分别为$v_m$和$v_n$，令$$\Delta = {v_n-v_m \over n-m}$$，则$m$和$n$之间的填充数据依次为$v_m+\Delta , v_m+2\Delta , ...$
+假设第\\(m\\)个与第\\(n\\)个采样点之间采样数据缺失（\\(m+1 < n\\)）,设在\\(m\\)和\\(n\\)点的采样值分别为\\(v_m\\)和\\(v_n\\)，令$$\Delta = {v_n-v_m \over n-m}$$，则\\(m\\)和\\(n\\)之间的填充数据依次为$$v_m+\Delta , v_m+2\Delta , ...$$
 
 ![](/images/algorithm/dsp/missing_data_fill.png)
 #### 去除异常点
@@ -30,26 +31,26 @@ Crane使用在数字信号处理（Digital Signal Processing）领域中常用
 
 这些极端的异常点对于信号的周期判断会造成干扰，需要进行去除。做法如下：
 
-选取实际序列中所有采样点的$P99.9$和$P0.1$，分别作为上、下限阈值，如果某个采样值低于下限或者高于上限，将采样点的值设置为前一个采样值。
+选取实际序列中所有采样点的\\(P99.9\\)和\\(P0.1\\)，分别作为上、下限阈值，如果某个采样值低于下限或者高于上限，将采样点的值设置为前一个采样值。
 
 ![](/images/algorithm/dsp/remove_outliers.png)
 
 #### 离散傅里叶变换
-对监控的时间序列（设长度为$N$）做快速离散傅里叶变换（FFT），得到信号的频谱图（spectrogram），频谱图直观地表现为在各个离散点$k$处的「冲击」。
-冲击的高度为$k$对应周期分量的「幅度」，$k$的取值范围$\(0,1,2, ... N-1\)$。
+对监控的时间序列（设长度为\\(N\\)）做快速离散傅里叶变换（FFT），得到信号的频谱图（spectrogram），频谱图直观地表现为在各个离散点\\(k\\)处的「冲击」。
+冲击的高度为\\(k\\)对应周期分量的「幅度」，\\(k\\)的取值范围\\(\(0,1,2, ... N-1\)\\)。
 
-$k = 0$对应信号的「直流分量」，对于周期没有影响，因此忽略。
+\\(k = 0\\)对应信号的「直流分量」，对于周期没有影响，因此忽略。
 
-由于离散傅里叶变换后的频谱序列前一半和后一半是共轭对称的，反映到频谱图上就是关于轴对称，因此只看前一半$N/2$即可。
+由于离散傅里叶变换后的频谱序列前一半和后一半是共轭对称的，反映到频谱图上就是关于轴对称，因此只看前一半\\(N/2\\)即可。
 
-$k$所对应的周期$$T = {N \over k} \bullet SampleInterval$$
+\\(k\\)所对应的周期$$T = {N \over k} \bullet SampleInterval$$
 
-要观察一个信号是不是以$T$为周期，至少需要观察两倍的$T$的长度，因此通过长度为$N$的序列能够识别出的最长周期为$N/2$。所以可以忽略$k = 1$。
+要观察一个信号是不是以\\(T\\)为周期，至少需要观察两倍的\\(T\\\)的长度，因此通过长度为\\(N\\)的序列能够识别出的最长周期为\\(N/2\\)。所以可以忽略\\(k = 1\\)。
 
-至此，$k$的取值范围为$(2, 3, ... , N/2)$，对应的周期为$N/2, N/3, ...$，这也就是FFT能够提供的周期信息的「分辨率」。如果一个信号的周期没有落到$N/k$上，它会散布到整个频域，导致「频率泄漏」。
+至此，\\(k\\)的取值范围为\\((2, 3, ... , N/2)\\)，对应的周期为\\(N/2, N/3, ...\\)，这也就是FFT能够提供的周期信息的「分辨率」。如果一个信号的周期没有落到\\(N/k\\)上，它会散布到整个频域，导致「频率泄漏」。
 好在在实际生产环境中，我们通常遇到的应用（尤其是在线业务），如果有规律，都是以「天」为周期的，某些业务可能会有所谓的「周末」效应，即周末和工作日不太一样，如果扩大到「周」的粒度去观察，它们同样具有良好的周期性。
 
-Crane没有尝试发现任意长度的周期，而是指定几个固定的周期长度（$1d、7d$）去判断。并通过截取、填充的方式，保证序列的长度$N$为待检测周期$T$的整倍数，例如：$T=1d，N=3d；T=7d，N=14d$。
+Crane没有尝试发现任意长度的周期，而是指定几个固定的周期长度（\\(1d、7d\\)）去判断。并通过截取、填充的方式，保证序列的长度\\(N\\)为待检测周期\\(T\\)的整倍数，例如：$$T=1d，N=3d；T=7d，N=14d$$。
 
 我们从生产环境中抓取了一些应用的监控指标，保存为csv格式，放到`pkg/prediction/dsp/test_data`目录下。
 例如，`input0.csv`文件包括了一个应用连续8天的CPU监控数据，对应的时间序列如下图：
@@ -66,24 +67,24 @@ Crane没有尝试发现任意长度的周期，而是指定几个固定的周期
 
 上面是我们通过直觉判断的，Crane是如何挑选「候选周期」的呢？
 
-1. 对原始序列$\vec x(n)$进行一个随机排列后得到序列$\vec x'(n)$，再对$\vec x'(n)$做FFT得到$\vec X'(k)$，令$P_{max} = argmax\|\vec X'(k)\|$。
+1. 对原始序列\\(\vec x(n)\\)进行一个随机排列后得到序列\\(\vec x'(n)\\)，再对\\(\vec x'(n)\\)做FFT得到\\(\vec X'(k)\\)，令\\(P_{max} = argmax\|\vec X'(k)\|\\)。
 
-2. 重复100次上述操作，得到100个$P_{max}$，取$P99$作为阈值$P_{threshold}$。
+2. 重复100次上述操作，得到100个\\(P_{max}\\)，取\\(P99\\)作为阈值\\(P_{threshold}\\)。
 
-3. 对原始序列$\vec x(n)$做FFT得到$\vec X(f)$，遍历$k = 2, 3, ...$，如果$P_k = \|X(k)\| > P_{threshold}$，则将$k$加入候选周期。
+3. 对原始序列\\(\vec x(n)\\)做FFT得到\\(\vec X(f)\\)，遍历\\(k = 2, 3, ...\\)，如果\\(P_k = \|X(k)\| > P_{threshold}\\)，则将\\(k\\)加入候选周期。
 
 #### 循环自相关函数
 自相关函数（Auto Correlation Function，ACF）是一个信号于其自身在不同时间点的互相关。通俗的讲，它就是两次观察之间的相似度对它们之间的时间差的函数。
 
-Crane使用循环自相关函数（Circular ACF），先对长度为$N$的时间序列以$N$为周期做扩展，也就是在$..., [-N, -1], [N, 2N-1], ...$区间上复制$\vec x(n)$，得到一个新的序列$\vec x'(n)$。
-再依次计算将$\vec x'(n)$依次平移$k=1,2,3,...N/2$后的$\vec x'(n+k)$与$\vec x'(n)$的相关系数
+Crane使用循环自相关函数（Circular ACF），先对长度为\\(N\\)的时间序列以\\(N\\)为周期做扩展，也就是在\\(..., [-N, -1], [N, 2N-1], ...\\)区间上复制\\(\vec x(n)\\)，得到一个新的序列\\(\vec x'(n)\\)。
+再依次计算将\\(\vec x'(n)\\)依次平移\\(k=1,2,3,...N/2\\)后的\\(\vec x'(n+k)\\)与\\(\vec x'(n)\\)的相关系数
 
 $$r_k={\displaystyle\sum_{i=-k}^{N-k-1} (x_i-\mu)(x_{i+k}-\mu) \over \displaystyle\sum_{i=0}^{N-1} (x_i-\mu)^2}\ \ \ \mu: mean$$
 
-Crane没有直接使用上面的定义去计算ACF，而是根据下面的公式，通过两次$(I)FFT$，从而能够在$O(nlogn)$的时间内完成ACF的计算。
+Crane没有直接使用上面的定义去计算ACF，而是根据下面的公式，通过两次\\((I)FFT\\)，从而能够在\\(O(nlogn)\\)的时间内完成ACF的计算。
 $$\vec r = IFFT(|FFT({\vec x - \mu \over \sigma})|^2)\ \ \ \mu: mean,\ \sigma: standard\ deviation$$
 
-ACF的图像如下所示，横轴代表信号平移的时间长度$k$；纵轴代表自相关系数$r_k$，反应了平移信号与原始信号的「相似」程度。
+ACF的图像如下所示，横轴代表信号平移的时间长度\\(k\\)；纵轴代表自相关系数\\(r_k\\)，反应了平移信号与原始信号的「相似」程度。
 
 ![](/images/algorithm/dsp/acf.png)
 
@@ -99,7 +100,7 @@ Crane在两侧个各选取一段曲线，分别做线性回归，当回归后左
 根据上一步得到的主周期，Crane提供了两种方式去拟合（预测）下一个周期的时序数据
 **maxValue**
 
-选取过去几个周期中相同时刻$t$（例如：下午6:00）中的最大值，作为下一个周期$t$时刻的预测值。
+选取过去几个周期中相同时刻\\(t\\)（例如：下午6:00）中的最大值，作为下一个周期\\(t\\)时刻的预测值。
 
 ![](/images/algorithm/dsp/max_value.png)
 **fft**
@@ -161,7 +162,7 @@ spec:
 
 简单来说，保留频率分量的数量越少、频率上限越低、频谱幅度下限越高，预测出来的曲线越光滑，但会丢失一些细节；反之，曲线毛刺越多，保留更多细节。
 
-下面是对同一时段预测的两条曲线，蓝色、绿色的`highFrequencyThreshold`分别为$0.01$和$0.001$，蓝色曲线过滤掉了更多的高频分量，因此更为平滑。
+下面是对同一时段预测的两条曲线，蓝色、绿色的`highFrequencyThreshold`分别为\\(0.01\\)和\\(0.001\\)，蓝色曲线过滤掉了更多的高频分量，因此更为平滑。

```

**File**: `site/layouts/partials/footer.html` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{{ if .Params.math }}{{ partial "helpers/katex.html" . }}{{ end }}
\ No newline at end of file
```

**File**: `site/layouts/partials/helpers/katex.html` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous">
+
+<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" integrity="sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8" crossorigin="anonymous"></script>
+
+<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous" onload="renderMathInElement(document.body);"></script>
\ No newline at end of file
```

---

### Incident Patch 12: `3e8bbbec` (2023-11-29)
**Commit Message**: Fix log level.

**File**: `pkg/webhooks/pod/mutating.go` (modified, +7/-7)
```diff
@@ -40,7 +40,7 @@ func (m *MutatingAdmission) Default(ctx context.Context, obj runtime.Object) err
 		return fmt.Errorf("expected a Pod but got a %T", obj)
 	}
 
-	klog.Infof("mutating started for pod %s/%s", pod.Namespace, pod.Name)
+	klog.V(2).Infof("Mutating started for pod %s/%s", pod.Namespace, pod.Name)
 
 	if _, exist := SystemNamespaces[pod.Namespace]; exist {
 		return nil
@@ -60,7 +60,7 @@ func (m *MutatingAdmission) Default(ctx context.Context, obj runtime.Object) err
 	}
 
 	if !ls.Matches(labels.Set(pod.Labels)) {
-		klog.Infof("injection skipped: webhook is not interested in the pod")
+		klog.V(2).Infof("Injection skipped: webhook is not interested in the pod")
 		return nil
 	}
 
@@ -74,26 +74,26 @@ func (m *MutatingAdmission) Default(ctx context.Context, obj runtime.Object) err
 	 ****************************************************************/
 	qos := util.MatchPodAndPodQOSSlice(pod, qosSlice)
 	if qos == nil {
-		klog.Infof("injection skipped: no podqos matched")
+		klog.V(2).Infof("Injection skipped: no podqos matched")
 		return nil
 	}
 
 	if qos.Spec.ResourceQOS.CPUQOS == nil ||
 		qos.Spec.ResourceQOS.CPUQOS.CPUPriority == nil ||
 		*qos.Spec.ResourceQOS.CPUQOS.CPUPriority == 0 {
-		klog.Infof("injection skipped: not a low CPUPriority pod, qos %s", qos.Name)
+		klog.V(2).Infof("Injection skipped: not a low CPUPriority pod, qos %s", qos.Name)
 		return nil
 	}
 	for _, container := range pod.Spec.InitContainers {
 		if container.Name == m.Config.QOSInitializer.InitContainerTemplate.Name {
-			klog.Infof("injection skipped: pod has initializerContainer already")
+			klog.V(2).Infof("Injection skipped: pod has initializerContainer already")
 			return nil
 		}
 	}
 
 	for _, volume := range pod.Spec.Volumes {
 		if volume.Name == m.Config.QOSInitializer.VolumeTemplate.Name {
-			klog.Infof("injection skipped: pod has initializerVolume already")
+			klog.V(2).Infof("Injection skipped: pod has initializerVolume already")
 			return nil
 		}
 	}
@@ -106,7 +106,7 @@ func (m *MutatingAdmission) Default(ctx context.Context, obj runtime.Object) err
 		pod.Spec.Volumes = append(pod.Spec.Volumes, *m.Config.QOSInitializer.VolumeTemplate)
 	}
 
-	klog.Infof("mutating completed for pod %s/%s", pod.Namespace, pod.Name)
+	klog.V(2).Infof("Mutating completed for pod %s/%s", pod.Namespace, pod.Name)
 
 	return nil
 }
```

**File**: `tools/initializer/resource.yaml` (modified, +3/-3)
```diff
@@ -104,7 +104,7 @@ data:
         matchLabels:
           app: nginx
       initContainerTemplate:
-        name: qos-initializer-container
+        name: crane-qos-initializer
         image: docker.io/gocrane/qos-init:v0.1.6
         imagePullPolicy: IfNotPresent
         args:
@@ -120,10 +120,10 @@ data:
             cpu: 10m
             memory: 10Mi
         volumeMounts:
-          - name: qos-initializer-volume
+          - name: crane-qos-initializer-volume
             mountPath: /etc/podinfo
       volumeTemplate:
-        name: qos-initializer-volume
+        name: crane-qos-initializer-volume
         downwardAPI:
           items:
           - path: "annotations"
```

---

### Incident Patch 13: `e29f4d62` (2023-10-24)
**Commit Message**: Merge pull request #872 from qmhu/fix-rr-npe

fix rr controller npe

**File**: `pkg/controller/recommendation/recommendation_rule_controller.go` (modified, +5/-3)
```diff
@@ -215,9 +215,11 @@ func (c *RecommendationRuleController) doReconcile(ctx context.Context, recommen
 		for _, recommendation := range currRecommendations.Items {
 			exist := false
 			for _, id := range identitiesArray {
-				if recommendation.UID == id.Recommendation.UID {
-					exist = true
-					break
+				if id.Recommendation != nil {
+					if recommendation.UID == id.Recommendation.UID {
+						exist = true
+						break
+					}
 				}
 			}
 
```

---

### Incident Patch 14: `bb5c1e49` (2023-10-24)
**Commit Message**: fix rr controller npe

**File**: `pkg/controller/recommendation/recommendation_rule_controller.go` (modified, +5/-3)
```diff
@@ -215,9 +215,11 @@ func (c *RecommendationRuleController) doReconcile(ctx context.Context, recommen
 		for _, recommendation := range currRecommendations.Items {
 			exist := false
 			for _, id := range identitiesArray {
-				if recommendation.UID == id.Recommendation.UID {
-					exist = true
-					break
+				if id.Recommendation != nil {
+					if recommendation.UID == id.Recommendation.UID {
+						exist = true
+						break
+					}
 				}
 			}
 
```

---

### Incident Patch 15: `956f894a` (2023-10-20)
**Commit Message**: Merge pull request #870 from michaelcheungdk/fix-typo

fix tutorials typo

**File**: `site/content/zh/docs/Tutorials/Recommendation/recommendation-framework.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ weight: 10
 ## 推荐概览
 
 Crane 的推荐模块定期的检测发现集群资源配置的问题，并给出优化建议。智能推荐提供了多种 Recommender 来实现面向不同资源的优化推荐。
-如何你想了解 Crane 如何做智能推荐的，或者你想要尝试实现一个自定义的 Recommender，或者修改一个已有的 Recommender 的推荐规则，这篇文章将帮助你了解智能推荐。
+如果你想了解 Crane 如何做智能推荐的，或者你想要尝试实现一个自定义的 Recommender，或者修改一个已有的 Recommender 的推荐规则，这篇文章将帮助你了解智能推荐。
 
 ## 用例
 
```

#### Recent Merged Pull Requests:
- **PR #932** (closed): feat: add carbon grid api, add automatic apply and make UI changes (@ekaterina-despotova)
- **PR #928** (closed): Update main.go (@barakhari25outlook)
- **PR #915** (2024-12-20): fix the issue that trigger recommendation by run number abormal (@Cloudzp)
- **PR #911** (closed): Update .golangci.yaml (@Cloudzp)
- **PR #909** (closed): Cherrypick to support v1.26+ (@Cloudzp)
- **PR #908** (closed): Cherrypick to k8s 1.26 (@Cloudzp)
- **PR #902** (2024-06-04): fix: close SeedFile (@testwill)
- **PR #900** (2024-04-17):  fix issues #898  (@Cloudzp)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
