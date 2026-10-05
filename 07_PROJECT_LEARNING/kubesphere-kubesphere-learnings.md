# Forensic Learning Record (Deep Inspection): kubesphere/kubesphere

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubesphere-kubesphere-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubesphere/kubesphere](https://github.com/kubesphere/kubesphere))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:47:39.438Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubesphere/kubesphere`
- **Description**: The container platform tailored for Kubernetes multi-cloud, datacenter, and edge management ⎈ 🖥 ☁️
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 17060 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `kube/pkg/apis/core/v1/helper/helpers.go`
```
/*
Copyright 2014 The Kubernetes Authors.

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

package helper

import (
	"fmt"
	"strings"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/util/validation"
)

// IsExtendedResourceName returns true if:
// 1. the resource name is not in the default namespace;
// 2. resource name does not have "requests." prefix,
// to avoid confusion with the convention in quota
// 3. it satisfies the rules in IsQualifiedName() after converted into quota resource name
func IsExtendedResourceName(name v1.ResourceName) bool {
	if IsNativeResource(name) || strings.HasPrefix(string(name), v1.DefaultResourceRequestsPrefix) {
		return false
	}
	// Ensure it satisfies the rules in IsQualifiedName() after converted into quota resource name
	nameForQuota := fmt.Sprintf("%s%s", v1.DefaultResourceRequestsPrefix, string(name))
	if errs := validation.IsQualifiedName(string(nameForQuota)); len(errs) != 0 {
		return false
	}
	return true
}

// IsPrefixedNativeResource returns true if the resource name is in the
// *kubernetes.io/ namespace.
func IsPrefixedNativeResource(name v1.ResourceName) bool {
	return strings.Contains(string(name), v1.ResourceDefaultNamespacePrefix)
}

// IsNativeResource returns true if the resource name is in the
// *kubernetes.io/ namespace. Partially-qualified (unprefixed) names are
// implicitly in the kubernetes.io/ namespace.
func IsNativeResource(name v1.ResourceName) bool {
	return !strings.Contains(string(name), "/") ||
		IsPrefixedNativeResource(name)
}

// GetPersistentVolumeClaimClass returns StorageClassName. If no storage class was
// requested, it returns "".
func GetPersistentVolumeClaimClass(claim *v1.PersistentVolumeClaim) string {
	// Use beta annotation first
	if class, found := claim.Annotations[v1.BetaStorageClassAnnotation]; found {
		return class
	}

	if claim.Spec.StorageClassName != nil {
		return *claim.Spec.StorageClassName
	}

	return ""
}

// ScopedResourceSelectorRequirementsAsSelector converts the ScopedResourceSelectorRequirement api type into a struct that implements
// labels.Selector.
func ScopedResourceSelectorRequirementsAsSelector(ssr v1.ScopedResourceSelectorRequirement) (labels.Selector, error) {
	selector := labels.NewSelector()
	var op selection.Operator
	switch ssr.Operator {
	case v1.ScopeSelectorOpIn:
		op = selection.In
	case v1.ScopeSelectorOpNotIn:
		op = selection.NotIn
	case v1.ScopeSelectorOpExists:
		op = selection.Exists
	case v1.ScopeSelectorOpDoesNotExist:
		op = selection.DoesNotExist
	default:
		return nil, fmt.Errorf("%q is not a valid scope selector operator", ssr.Operator)
	}
	r, err := labels.NewRequirement(string(ssr.ScopeName), op, ssr.Values)
	if err != nil {
		return nil, err
	}
	selector = selector.Add(*r)
	return selector, nil
}

```

### Core Architecture Module: `kube/pkg/apis/core/v1/helper/qos/qos.go`
```
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

package qos

import (
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/util/sets"
)

var supportedQoSComputeResources = sets.New(string(corev1.ResourceCPU), string(corev1.ResourceMemory))

func isSupportedQoSComputeResource(name corev1.ResourceName) bool {
	return supportedQoSComputeResources.Has(string(name))
}

// GetPodQOS returns the QoS class of a pod.
// A pod is besteffort if none of its containers have specified any requests or limits.
// A pod is guaranteed only when requests and limits are specified for all the containers and they are equal.
// A pod is burstable if limits and requests do not match across all containers.
func GetPodQOS(pod *corev1.Pod) corev1.PodQOSClass {
	requests := corev1.ResourceList{}
	limits := corev1.ResourceList{}
	zeroQuantity := resource.MustParse("0")
	isGuaranteed := true
	allContainers := []corev1.Container{}
	allContainers = append(allContainers, pod.Spec.Containers...)
	allContainers = append(allContainers, pod.Spec.InitContainers...)
	for _, container := range allContainers {
		// process requests
		for name, quantity := range container.Resources.Requests {
			if !isSupportedQoSComputeResource(name) {
				continue
			}
			if quantity.Cmp(zeroQuantity) == 1 {
				delta := quantity.DeepCopy()
				if _, exists := requests[name]; !exists {
					requests[name] = delta
				} else {
					delta.Add(requests[name])
					requests[name] = delta
				}
			}
		}
		// process limits
		qosLimitsFound := sets.New[string]()
		for name, quantity := range container.Resources.Limits {
			if !isSupportedQoSComputeResource(name) {
				continue
			}
			if quantity.Cmp(zeroQuantity) == 1 {
				qosLimitsFound.Insert(string(name))
				delta := quantity.DeepCopy()
				if _, exists := limits[name]; !exists {
					limits[name] = delta
				} else {
					delta.Add(limits[name])
					limits[name] = delta
				}
			}
		}

		if !qosLimitsFound.HasAll(string(corev1.ResourceMemory), string(corev1.ResourceCPU)) {
			isGuaranteed = false
		}
	}
	if len(requests) == 0 && len(limits) == 0 {
		return corev1.PodQOSBestEffort
	}
	// Check is requests match limits for all resources.
	if isGuaranteed {
		for name, req := range requests {
			if lim, exists := limits[name]; !exists || lim.Cmp(req) != 0 {
				isGuaranteed = false
				break
			}
		}
	}
	if isGuaranteed &&
		len(requests) == len(limits) {
		return corev1.PodQOSGuaranteed
	}
	return corev1.PodQOSBurstable
}

```

### Core Architecture Module: `kube/pkg/quota/v1/evaluator/core/persistentvolumeclaims.go`
```
/*
Copyright 2016 The Kubernetes Authors.

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

package core

import (
	"context"
	"fmt"
	"strings"

	"sigs.k8s.io/controller-runtime/pkg/client"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	utilfeature "k8s.io/apiserver/pkg/util/feature"

	"kubesphere.io/kubesphere/kube/pkg/apis/core/v1/helper"
	k8sfeatures "kubesphere.io/kubesphere/kube/pkg/features"
	"kubesphere.io/kubesphere/kube/pkg/quota/v1"
	"kubesphere.io/kubesphere/kube/pkg/quota/v1/generic"
)

// the name used for object count quota
var pvcObjectCountName = generic.ObjectCountQuotaResourceNameFor(corev1.SchemeGroupVersion.WithResource("persistentvolumeclaims").GroupResource())

// pvcResources are the set of static resources managed by quota associated with pvcs.
// for each resource in this list, it may be refined dynamically based on storage class.
var pvcResources = []corev1.ResourceName{
	corev1.ResourcePersistentVolumeClaims,
	corev1.ResourceRequestsStorage,
}

// storageClassSuffix is the suffix to the qualified portion of storage class resource name.
// For example, if you want to quota storage by storage class, you would have a declaration
// that follows <storage-class>.storageclass.storage.k8s.io/<resource>.
// For example:
// * gold.storageclass.storage.k8s.io/: 500Gi
// * bronze.storageclass.storage.k8s.io/requests.storage: 500Gi
const storageClassSuffix string = ".storageclass.storage.k8s.io/"

// NewPersistentVolumeClaimEvaluator returns an evaluator that can evaluate persistent volume claims
func NewPersistentVolumeClaimEvaluator(cache client.Reader) quota.Evaluator {
	pvcEvaluator := &pvcEvaluator{cache: cache}
	return pvcEvaluator
}

// pvcEvaluator knows how to evaluate quota usage for persistent volume claims
type pvcEvaluator struct {
	// listFuncByNamespace knows how to list pvc claims
	cache client.Reader
}

// Constraints verifies that all required resources are present on the item.
func (p *pvcEvaluator) Constraints(required []corev1.ResourceName, item runtime.Object) error {
	// no-op for persistent volume claims
	return nil
}

// GroupResource that this evaluator tracks
func (p *pvcEvaluator) GroupResource() schema.GroupResource {
	return corev1.SchemeGroupVersion.WithResource("persistentvolumeclaims").GroupResource()
}

// Handles returns true if the evaluator should handle the specified operation.
func (p *pvcEvaluator) Handles(a admission.Attributes) bool {
	op := a.GetOperation()
	if op == admission.Create {
		return true
	}
	if op == admission.Update && utilfeature.DefaultFeatureGate.Enabled(k8sfeatures.ExpandPersistentVolumes) {
		return true
	}
	return false
}

// Matches returns true if the evaluator matches the specified quota with the provided input item
func (p *pvcEvaluator) Matches(resourceQuota *corev1.ResourceQuota, item runtime.Object) (bool, error) {
	return generic.Matches(resourceQuota, item, p.MatchingResources, generic.MatchesNoScopeFunc)
}

// MatchingScopes takes the input specified list of scopes and input object. Returns the set of scopes resource matches.
func (p *pvcEvaluator) MatchingScopes(item runtime.Object, scopes []corev1.ScopedResourceSelectorRequirement) ([]corev1.ScopedResourceSelectorRequirement, error) {
	return []corev1.ScopedResourceSelectorRequirement{}, nil
}

// UncoveredQuotaScopes takes the input matched scopes which are limited by configuration and the matched quota scopes.
// It returns the scopes which are in limited scopes but dont have a corresponding covering quota scope
func (p *pvcEvaluator) UncoveredQuotaScopes(limitedScopes []corev1.ScopedResourceSelectorRequirement, matchedQuotaScopes []corev1.ScopedResourceSelectorRequirement) ([]corev1.ScopedResourceSelectorRequirement, error) {
	return []corev1.ScopedResourceSelectorRequirement{}, nil
}

// MatchingResources takes the input specified list of resources and returns the set of resources it matches.
func (p *pvcEvaluator) MatchingResources(items []corev1.ResourceName) []corev1.ResourceName {
	var result []corev1.ResourceName
	for _, item := range items {
		// match object count quota fields
		if quota.Contains([]corev1.ResourceName{pvcObjectCountName}, item) {
			result = append(result, item)
			continue
		}
		// match pvc resources
		if quota.Contains(pvcResources, item) {
			result = append(result, item)
			continue
		}
		// match pvc resources scoped by storage class (<storage-class-name>.storage-class.kubernetes.io/<resource>)
		for _, resource := range pvcResources {
			byStorageClass := storageClassSuffix + string(resource)
			if strings.HasSuffix(string(item), byStorageClass) {
				result = append(result, item)
				break
			}
		}
	}
	return result
}

// Usage knows how to measure usage associated with item.
func (p *pvcEvaluator) Usage(item runtime.Object) (corev1.ResourceList, error) {
	result := corev1.ResourceList{}
	pvc, err := toExternalPersistentVolumeClaimOrError(item)
	if err != nil {
		return result, err
	}

	// charge for claim
	result[corev1.ResourcePersistentVolumeClaims] = *(resource.NewQuantity(1, resource.DecimalSI))
	result[pvcObjectCountName] = *(resource.NewQuantity(1, resource.DecimalSI))
	storageClassRef := helper.GetPersistentVolumeClaimClass(pvc)
	if len(storageClassRef) > 0 {
		storageClassClaim := corev1.ResourceName(storageClassRef + storageClassSuffix + string(corev1.ResourcePersistentVolumeClaims))
		result[storageClassClaim] = *(resource.NewQuantity(1, resource.DecimalSI))
	}

	// charge for storage
	if request, found := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; found {
		result[corev1.ResourceRequestsStorage] = request
		// charge usage to the storage class (if present)
		if len(storageClassRef) > 0 {
			storageClassStorage := corev1.ResourceName(storageClassRef + storageClassSuffix + string(corev1.ResourceRequestsStorage))
			result[storageClassStorage] = request
		}
	}
	return result, nil
}

func (p *pvcEvaluator) listPVC(namespace string) ([]runtime.Object, error) {
	pvcList := &corev1.PersistentVolumeClaimList{}
	if err := p.cache.List(context.Background(), pvcList, client.InNamespace(namespace)); err != nil {
		return nil, err
	}
	pvcs := make([]runtime.Object, 0)
	for _, pvc := range pvcList.Items {
		pvcs = append(pvcs, &pvc)
	}
	return pvcs, nil
}

// UsageStats calculates aggregate usage for the object.
func (p *pvcEvaluator) UsageStats(options quota.UsageStatsOptions) (quota.UsageStats, error) {
	return generic.CalculateUsageStats(options, p.listPVC, generic.MatchesNoScopeFunc, p.Usage)
}

// ensure we implement required interface
var _ quota.Evaluator = &pvcEvaluator{}

func toExternalPersistentVolumeClaimOrError(obj runtime.Object) (*corev1.PersistentVolumeClaim, error) {
	var pvc *corev1.PersistentVolumeClaim
	switch t := obj.(type) {
	case *corev1.PersistentVolumeClaim:
		pvc = t
	default:
		return nil, fmt.Errorf("expect *v1.PersistentVolumeClaim, got %v", t)
	}
	return pvc, nil
}

```

### Core Architecture Module: `kube/pkg/quota/v1/evaluator/core/pods.go`
```
/*
Copyright 2016 The Kubernetes Authors.

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

package core

import (
	"context"
	"fmt"
	"strings"
	"time"

	"sigs.k8s.io/controller-runtime/pkg/client"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/utils/clock"

	"kubesphere.io/kubesphere/kube/pkg/apis/core/v1/helper"
	"kubesphere.io/kubesphere/kube/pkg/apis/core/v1/helper/qos"
	"kubesphere.io/kubesphere/kube/pkg/quota/v1"
	"kubesphere.io/kubesphere/kube/pkg/quota/v1/generic"
)

// the name used for object count quota
var podObjectCountName = generic.ObjectCountQuotaResourceNameFor(corev1.SchemeGroupVersion.WithResource("pods").GroupResource())

// podResources are the set of resources managed by quota associated with pods.
var podResources = []corev1.ResourceName{
	podObjectCountName,
	corev1.ResourceCPU,
	corev1.ResourceMemory,
	corev1.ResourceEphemeralStorage,
	corev1.ResourceRequestsCPU,
	corev1.ResourceRequestsMemory,
	corev1.ResourceRequestsEphemeralStorage,
	corev1.ResourceLimitsCPU,
	corev1.ResourceLimitsMemory,
	corev1.ResourceLimitsEphemeralStorage,
	corev1.ResourcePods,
}

// podResourcePrefixes are the set of prefixes for resources (Hugepages, and other
// potential extended reources with specific prefix) managed by quota associated with pods.
var podResourcePrefixes = []string{
	corev1.ResourceHugePagesPrefix,
	corev1.ResourceRequestsHugePagesPrefix,
}

// requestedResourcePrefixes are the set of prefixes for resources
// that might be declared in pod's Resources.Requests/Limits
var requestedResourcePrefixes = []string{
	corev1.ResourceHugePagesPrefix,
}

// maskResourceWithPrefix mask resource with certain prefix
// e.g. hugepages-XXX -> requests.hugepages-XXX
func maskResourceWithPrefix(resource corev1.ResourceName, prefix string) corev1.ResourceName {
	return corev1.ResourceName(fmt.Sprintf("%s%s", prefix, string(resource)))
}

// isExtendedResourceNameForQuota returns true if the extended resource name
// has the quota related resource prefix.
func isExtendedResourceNameForQuota(name corev1.ResourceName) bool {
	// As overcommit is not supported by extended resources for now,
	// only quota objects in format of "requests.resourceName" is allowed.
	return !helper.IsNativeResource(name) && strings.HasPrefix(string(name), corev1.DefaultResourceRequestsPrefix)
}

// NOTE: it was a mistake, but if a quota tracks cpu or memory related resources,
// the incoming pod is required to have those values set.  we should not repeat
// this mistake for other future resources (gpus, ephemeral-storage,etc).
// do not add more resources to this list!
var validationSet = sets.New(
	string(corev1.ResourceCPU),
	string(corev1.ResourceMemory),
	string(corev1.ResourceRequestsCPU),
	string(corev1.ResourceRequestsMemory),
	string(corev1.ResourceLimitsCPU),
	string(corev1.ResourceLimitsMemory),
)

// NewPodEvaluator returns an evaluator that can evaluate pods
func NewPodEvaluator(cache client.Reader, clock clock.Clock) quota.Evaluator {
	podEvaluator := &podEvaluator{cache: cache, clock: clock}
	return podEvaluator
}

// podEvaluator knows how to measure usage of pods.
type podEvaluator struct {
	cache client.Reader
	// used to track time
	clock clock.Clock
}

// Constraints verifies that all required resources are present on the pod
// In addition, it validates that the resources are valid (i.e. requests < limits)
func (p *podEvaluator) Constraints(required []corev1.ResourceName, item runtime.Object) error {
	pod, err := toExternalPodOrError(item)
	if err != nil {
		return err
	}

	// BACKWARD COMPATIBILITY REQUIREMENT: if we quota cpu or memory, then each container
	// must make an explicit request for the resource.  this was a mistake.  it coupled
	// validation with resource counting, but we did this before QoS was even defined.
	// let's not make that mistake again with other resources now that QoS is defined.
	requiredSet := quota.ToSet(required).Intersection(validationSet)
	missingSet := sets.New[string]()
	for i := range pod.Spec.Containers {
		enforcePodContainerConstraints(&pod.Spec.Containers[i], requiredSet, missingSet)
	}
	for i := range pod.Spec.InitContainers {
		enforcePodContainerConstraints(&pod.Spec.InitContainers[i], requiredSet, missingSet)
	}
	if len(missingSet) == 0 {
		return nil
	}
	return fmt.Errorf("must specify %s", strings.Join(missingSet.UnsortedList(), ","))
}

// GroupResource that this evaluator tracks
func (p *podEvaluator) GroupResource() schema.GroupResource {
	return corev1.SchemeGroupVersion.WithResource("pods").GroupResource()
}

// Handles returns true if the evaluator should handle the specified attributes.
func (p *podEvaluator) Handles(a admission.Attributes) bool {
	op := a.GetOperation()
	return op == admission.Create
}

// Matches returns true if the evaluator matches the specified quota with the provided input item
func (p *podEvaluator) Matches(resourceQuota *corev1.ResourceQuota, item runtime.Object) (bool, error) {
	return generic.Matches(resourceQuota, item, p.MatchingResources, podMatchesScopeFunc)
}

// MatchingResources takes the input specified list of resources and returns the set of resources it matches.
func (p *podEvaluator) MatchingResources(input []corev1.ResourceName) []corev1.ResourceName {
	result := quota.Intersection(input, podResources)
	for _, resource := range input {
		// for resources with certain prefix, e.g. hugepages
		if quota.ContainsPrefix(podResourcePrefixes, resource) {
			result = append(result, resource)
		}
		// for extended resources
		if isExtendedResourceNameForQuota(resource) {
			result = append(result, resource)
		}
	}

	return result
}

// MatchingScopes takes the input specified list of scopes and pod object. Returns the set of scope selectors pod matches.
func (p *podEvaluator) MatchingScopes(item runtime.Object, scopeSelectors []corev1.ScopedResourceSelectorRequirement) ([]corev1.ScopedResourceSelectorRequirement, error) {
	matchedScopes := []corev1.ScopedResourceSelectorRequirement{}
	for _, selector := range scopeSelectors {
		match, err := podMatchesScopeFunc(selector, item)
		if err != nil {
			return []corev1.ScopedResourceSelectorRequirement{}, fmt.Errorf("error on matching scope %v: %v", selector, err)
		}
		if match {
			matchedScopes = append(matchedScopes, selector)
		}
	}
	return matchedScopes, nil
}

// UncoveredQuotaScopes takes the input matched scopes which are limited by configuration and the matched quota scopes.
// It returns the scopes which are in limited scopes but dont have a corresponding covering quota scope
func (p *podEvaluator) UncoveredQuotaScopes(limitedScopes []corev1.ScopedResourceSelectorRequirement, matchedQuotaScopes []corev1.ScopedResourceSelectorRequirement) ([]corev1.ScopedResourceSelectorRequirement, error) {
	uncoveredScopes := []corev1.ScopedResourceSelectorRequirement{}
	for _, selector := range limitedScopes {
		isCovered := false
		for _, matchedScopeSelector := range matchedQuotaScopes {
			if matchedScopeSelector.ScopeName == selector.ScopeName {
				isCovered = true
				break
			}
		}

		if !isCovered {
			uncoveredScopes = append(uncoveredScopes, selector)
		}
	}
	return uncoveredScopes, nil
}

// Usage knows how to measure usage associated with pods
func (p *podEvaluator) Usage(item runtime.Object) (corev1.ResourceList, error) {
	// delegate to normal usage
	return PodUsageFunc(item, p.clock)
}

// UsageStats calculates aggregate usage for the object.
func (p *podEvaluator) UsageStats(options quota.UsageStatsOptions) (quota.UsageStats, error) {
	return generic.CalculateUsageStats(options, p.listPods, podMatchesScopeFunc, p.Usage)
}

func (p *podEvaluator) listPods(namespace string) ([]runtime.Object, error) {
	podList := &corev1.PodList{}
	if err := p.cache.List(context.Background(), podList, client.InNamespace(namespace)); err != nil {
		return nil, err
	}
	pods := make([]runtime.Object, 0)
	for _, pod := range podList.Items {
		pods = append(pods, &pod)
	}
	return pods, nil
}

// verifies we implement the required interface.
var _ quota.Evaluator = &podEvaluator{}

// enforcePodContainerConstraints checks for required resources that are not set on this container and
// adds them to missingSet.
func enforcePodContainerConstraints(container *corev1.Container, requiredSet, missingSet sets.Set[string]) {
	requests := container.Resources.Requests
	limits := container.Resources.Limits
	containerUsage := podComputeUsageHelper(requests, limits)
	containerSet := quota.ToSet(quota.ResourceNames(containerUsage))
	if !containerSet.Equal(requiredSet) {
		difference := requiredSet.Difference(containerSet)
		missingSet.Insert(difference.UnsortedList()...)
	}
}

// podComputeUsageHelper can summarize the pod compute quota usage based on requests and limits
func podComputeUsageHelper(requests corev1.ResourceList, limits corev1.ResourceList) corev1.ResourceList {
	result := corev1.ResourceList{}
	result[corev1.ResourcePods] = resource.MustParse("1")
	if request, found := requests[corev1.ResourceCPU]; found {
		result[corev1.ResourceCPU] = request
		result[corev1.ResourceRequestsCPU] = request
	}
	if limit, found := limits[corev1.ResourceCPU]; found {
		result[corev1.ResourceLimitsCPU] = limit
	}
	if request, found := requests[corev1.ResourceMemory]; found {
		result[corev1.ResourceMemory] = request
		result[corev1.Resour
```

### Core Architecture Module: `kube/pkg/quota/v1/evaluator/core/registry.go`
```
/*
Copyright 2016 The Kubernetes Authors.

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

package core

import (
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/utils/clock"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"kubesphere.io/kubesphere/kube/pkg/quota/v1"
	"kubesphere.io/kubesphere/kube/pkg/quota/v1/generic"
)

// legacyObjectCountAliases are what we used to do simple object counting quota with mapped to alias
var legacyObjectCountAliases = map[schema.GroupVersionResource]corev1.ResourceName{
	corev1.SchemeGroupVersion.WithResource(string(corev1.ResourceConfigMaps)):             corev1.ResourceConfigMaps,
	corev1.SchemeGroupVersion.WithResource(string(corev1.ResourceQuotas)):                 corev1.ResourceQuotas,
	corev1.SchemeGroupVersion.WithResource(string(corev1.ResourceReplicationControllers)): corev1.ResourceReplicationControllers,
	corev1.SchemeGroupVersion.WithResource(string(corev1.ResourceSecrets)):                corev1.ResourceSecrets,
}

// NewEvaluators returns the list of static evaluators that manage more than counts
func NewEvaluators(client client.Client) []quota.Evaluator {
	// these evaluators have special logic
	result := []quota.Evaluator{
		NewPodEvaluator(client, clock.RealClock{}),
		NewServiceEvaluator(client),
		NewPersistentVolumeClaimEvaluator(client),
	}
	// these evaluators require an alias for backwards compatibility
	for gvk, alias := range legacyObjectCountAliases {
		result = append(result,
			generic.NewObjectCountEvaluator(gvk.GroupVersion().WithResource(string(alias)).GroupResource(), generic.ListResourceUsingCacheFunc(client, gvk), alias))
	}
	return result
}

```

### Core Architecture Module: `kube/pkg/quota/v1/evaluator/core/services.go`
```
/*
Copyright 2016 The Kubernetes Authors.

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

package core

import (
	"context"
	"fmt"

	"sigs.k8s.io/controller-runtime/pkg/client"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	"kubesphere.io/kubesphere/kube/pkg/quota/v1"
	"kubesphere.io/kubesphere/kube/pkg/quota/v1/generic"
)

// the name used for object count quota
var serviceObjectCountName = generic.ObjectCountQuotaResourceNameFor(corev1.SchemeGroupVersion.WithResource("services").GroupResource())

// serviceResources are the set of resources managed by quota associated with services.
var serviceResources = []corev1.ResourceName{
	serviceObjectCountName,
	corev1.ResourceServices,
	corev1.ResourceServicesNodePorts,
	corev1.ResourceServicesLoadBalancers,
}

// NewServiceEvaluator returns an evaluator that can evaluate services.
func NewServiceEvaluator(cache client.Reader) quota.Evaluator {
	serviceEvaluator := &serviceEvaluator{cache: cache}
	return serviceEvaluator
}

// serviceEvaluator knows how to measure usage for services.
type serviceEvaluator struct {
	// knows how to list items by namespace
	cache client.Reader
}

// Constraints verifies that all required resources are present on the item
func (p *serviceEvaluator) Constraints(required []corev1.ResourceName, item runtime.Object) error {
	// this is a no-op for services
	return nil
}

// GroupResource that this evaluator tracks
func (p *serviceEvaluator) GroupResource() schema.GroupResource {
	return corev1.SchemeGroupVersion.WithResource("services").GroupResource()
}

// Handles returns true of the evaluator should handle the specified operation.
func (p *serviceEvaluator) Handles(a admission.Attributes) bool {
	operation := a.GetOperation()
	// We handle create and update because a service type can change.
	return admission.Create == operation || admission.Update == operation
}

// Matches returns true if the evaluator matches the specified quota with the provided input item
func (p *serviceEvaluator) Matches(resourceQuota *corev1.ResourceQuota, item runtime.Object) (bool, error) {
	return generic.Matches(resourceQuota, item, p.MatchingResources, generic.MatchesNoScopeFunc)
}

// MatchingResources takes the input specified list of resources and returns the set of resources it matches.
func (p *serviceEvaluator) MatchingResources(input []corev1.ResourceName) []corev1.ResourceName {
	return quota.Intersection(input, serviceResources)
}

// MatchingScopes takes the input specified list of scopes and input object. Returns the set of scopes resource matches.
func (p *serviceEvaluator) MatchingScopes(item runtime.Object, scopes []corev1.ScopedResourceSelectorRequirement) ([]corev1.ScopedResourceSelectorRequirement, error) {
	return []corev1.ScopedResourceSelectorRequirement{}, nil
}

// UncoveredQuotaScopes takes the input matched scopes which are limited by configuration and the matched quota scopes.
// It returns the scopes which are in limited scopes but dont have a corresponding covering quota scope
func (p *serviceEvaluator) UncoveredQuotaScopes(limitedScopes []corev1.ScopedResourceSelectorRequirement, matchedQuotaScopes []corev1.ScopedResourceSelectorRequirement) ([]corev1.ScopedResourceSelectorRequirement, error) {
	return []corev1.ScopedResourceSelectorRequirement{}, nil
}

// convert the input object to an internal service object or error.
func toExternalServiceOrError(obj runtime.Object) (*corev1.Service, error) {
	var svc *corev1.Service
	switch t := obj.(type) {
	case *corev1.Service:
		svc = t
	default:
		return nil, fmt.Errorf("expect *v1.Service, got %v", t)
	}
	return svc, nil
}

// Usage knows how to measure usage associated with services
func (p *serviceEvaluator) Usage(item runtime.Object) (corev1.ResourceList, error) {
	result := corev1.ResourceList{}
	svc, err := toExternalServiceOrError(item)
	if err != nil {
		return result, err
	}
	ports := len(svc.Spec.Ports)
	// default service usage
	result[serviceObjectCountName] = *(resource.NewQuantity(1, resource.DecimalSI))
	result[corev1.ResourceServices] = *(resource.NewQuantity(1, resource.DecimalSI))
	result[corev1.ResourceServicesLoadBalancers] = resource.Quantity{Format: resource.DecimalSI}
	result[corev1.ResourceServicesNodePorts] = resource.Quantity{Format: resource.DecimalSI}
	switch svc.Spec.Type {
	case corev1.ServiceTypeNodePort:
		// node port services need to count node ports
		value := resource.NewQuantity(int64(ports), resource.DecimalSI)
		result[corev1.ResourceServicesNodePorts] = *value
	case corev1.ServiceTypeLoadBalancer:
		// load balancer services need to count node ports and load balancers
		value := resource.NewQuantity(int64(ports), resource.DecimalSI)
		result[corev1.ResourceServicesNodePorts] = *value
		result[corev1.ResourceServicesLoadBalancers] = *(resource.NewQuantity(1, resource.DecimalSI))
	}
	return result, nil
}

func (p *serviceEvaluator) listServices(namespace string) ([]runtime.Object, error) {
	serviceList := &corev1.ServiceList{}
	if err := p.cache.List(context.Background(), serviceList, client.InNamespace(namespace)); err != nil {
		return nil, err
	}
	services := make([]runtime.Object, 0)
	for _, svc := range serviceList.Items {
		services = append(services, &svc)
	}
	return services, nil
}

// UsageStats calculates aggregate usage for the object.
func (p *serviceEvaluator) UsageStats(options quota.UsageStatsOptions) (quota.UsageStats, error) {
	return generic.CalculateUsageStats(options, p.listServices, generic.MatchesNoScopeFunc, p.Usage)
}

var _ quota.Evaluator = &serviceEvaluator{}

// GetQuotaServiceType returns ServiceType if the service type is eligible to track against a quota, nor return ""
func GetQuotaServiceType(service *corev1.Service) corev1.ServiceType {
	switch service.Spec.Type {
	case corev1.ServiceTypeNodePort:
		return corev1.ServiceTypeNodePort
	case corev1.ServiceTypeLoadBalancer:
		return corev1.ServiceTypeLoadBalancer
	}
	return corev1.ServiceType("")
}

```

### Core Architecture Module: `pkg/api/utils.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package api

import (
	"net/http"
	"runtime"
	"strings"

	"github.com/emicklei/go-restful/v3"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/klog/v2"
)

// Avoid emitting errors that look like valid HTML. Quotes are okay.
var sanitizer = strings.NewReplacer(`&`, "&amp;", `<`, "&lt;", `>`, "&gt;")

func HandleInternalError(response *restful.Response, req *restful.Request, err error) {
	handle(http.StatusInternalServerError, response, req, err)
}

// HandleBadRequest writes http.StatusBadRequest and log error
func HandleBadRequest(response *restful.Response, req *restful.Request, err error) {
	handle(http.StatusBadRequest, response, req, err)
}

func HandleNotFound(response *restful.Response, req *restful.Request, err error) {
	handle(http.StatusNotFound, response, req, err)
}

func HandleForbidden(response *restful.Response, req *restful.Request, err error) {
	handle(http.StatusForbidden, response, req, err)
}

func HandleUnauthorized(response *restful.Response, req *restful.Request, err error) {
	handle(http.StatusUnauthorized, response, req, err)
}

func HandleTooManyRequests(response *restful.Response, req *restful.Request, err error) {
	handle(http.StatusTooManyRequests, response, req, err)
}

func HandleConflict(response *restful.Response, req *restful.Request, err error) {
	handle(http.StatusConflict, response, req, err)
}

func HandleError(response *restful.Response, req *restful.Request, err error) {
	var statusCode int
	switch t := err.(type) {
	case errors.APIStatus:
		statusCode = int(t.Status().Code)
	case restful.ServiceError:
		statusCode = t.Code
	default:
		statusCode = http.StatusInternalServerError
	}
	handle(statusCode, response, req, err)
}

func handle(statusCode int, response *restful.Response, req *restful.Request, err error) {
	_, fn, line, _ := runtime.Caller(2)
	klog.Errorf("%s:%d %v", fn, line, err)
	http.Error(response, sanitizer.Replace(err.Error()), statusCode)
}

```

### Core Architecture Module: `pkg/apiserver/auditing/webhook/backend.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package webhook

import (
	"bytes"
	"context"
	"crypto/tls"
	"net/http"
	"time"

	"k8s.io/klog/v2"

	"kubesphere.io/kubesphere/pkg/apiserver/auditing/internal"
)

const (
	GetSenderTimeout  = time.Second
	SendTimeout       = time.Second * 3
	DefaultSendersNum = 100

	WebhookURL = "https://kube-auditing-webhook-svc.kubesphere-logging-system.svc:6443/audit/webhook/event"
)

type backend struct {
	url              string
	senderCh         chan interface{}
	client           http.Client
	sendTimeout      time.Duration
	getSenderTimeout time.Duration
}

func NewBackend(url string, sendersNum int) internal.Backend {

	b := backend{
		url:              url,
		getSenderTimeout: GetSenderTimeout,
		sendTimeout:      SendTimeout,
	}

	if len(b.url) == 0 {
		b.url = WebhookURL
	}

	num := sendersNum
	if num == 0 {
		num = DefaultSendersNum
	}
	b.senderCh = make(chan interface{}, num)

	b.client = http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
		Timeout: b.sendTimeout,
	}

	return &b
}

func (b *backend) ProcessEvents(events ...[]byte) {
	go b.sendEvents(events...)
}

func (b *backend) sendEvents(events ...[]byte) {
	ctx, cancel := context.WithTimeout(context.Background(), b.sendTimeout)
	defer cancel()

	stopCh := make(chan struct{})
	skipReturnSender := false

	send := func() {
		ctx, cancel := context.WithTimeout(context.Background(), b.getSenderTimeout)
		defer cancel()

		select {
		case <-ctx.Done():
			klog.Error("Get auditing event sender timeout")
			skipReturnSender = true
			return
		case b.senderCh <- struct{}{}:
		}

		start := time.Now()
		defer func() {
			stopCh <- struct{}{}
			klog.V(8).Infof("send %d auditing events used %d", len(events), time.Since(start).Milliseconds())
		}()

		var body bytes.Buffer
		for _, event := range events {
			if _, err := body.Write(event); err != nil {
				klog.Errorf("send auditing event error %s", err)
				return
			}
		}

		response, err := b.client.Post(b.url, "application/json", &body)
		if err != nil {
			klog.Errorf("send audit events error, %s", err)
			return
		}
		defer response.Body.Close()

		if response.StatusCode != http.StatusOK {
			klog.Errorf("send audit events error[%d]", response.StatusCode)
			return
		}
	}

	go send()

	defer func() {
		if !skipReturnSender {
			<-b.senderCh
		}
	}()

	select {
	case <-ctx.Done():
		klog.Error("send audit events timeout")
	case <-stopCh:
	}
}

```

### Core Architecture Module: `pkg/controller/application/apprelease_webhook.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package application

import (
	"context"
	"fmt"
	"strings"

	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"

	kscontroller "kubesphere.io/kubesphere/pkg/controller"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	appv2 "kubesphere.io/api/application/v2"
	clusterv1alpha1 "kubesphere.io/api/cluster/v1alpha1"

	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

var _ admission.CustomValidator = &ReleaseWebhook{}
var _ kscontroller.ClusterSelector = &ReleaseWebhook{}
var _ kscontroller.Controller = &ReleaseWebhook{}

type ReleaseWebhook struct {
	cache.Cache
}

func (a *ReleaseWebhook) Name() string {
	return "applicationrelease-webhook"
}

func (a *ReleaseWebhook) SetupWithManager(mgr *kscontroller.Manager) error {
	a.Cache = mgr.GetCache()
	return ctrl.NewWebhookManagedBy(mgr).WithValidator(a).For(&appv2.ApplicationRelease{}).Complete()

}

func (a *ReleaseWebhook) Enabled(clusterRole string) bool {
	return strings.EqualFold(clusterRole, string(clusterv1alpha1.ClusterRoleHost))
}

func (a *ReleaseWebhook) ValidateCreate(ctx context.Context, obj runtime.Object) (warnings admission.Warnings, err error) {
	return a.validateAppVersionState(ctx, obj.(*appv2.ApplicationRelease))
}

func (a *ReleaseWebhook) ValidateUpdate(ctx context.Context, oldObj, newObj runtime.Object) (warnings admission.Warnings, err error) {
	return a.validateAppVersionState(ctx, newObj.(*appv2.ApplicationRelease))
}

func (a *ReleaseWebhook) ValidateDelete(ctx context.Context, obj runtime.Object) (warnings admission.Warnings, err error) {
	return nil, nil
}

func (a *ReleaseWebhook) validateAppVersionState(ctx context.Context, release *appv2.ApplicationRelease) (warnings admission.Warnings, err error) {
	versionID := release.Spec.AppVersionID
	appVersion := &appv2.ApplicationVersion{}
	err = a.Get(ctx, types.NamespacedName{Name: versionID}, appVersion)
	if err != nil {
		return nil, err
	}
	if appVersion.Status.State != appv2.ReviewStatusActive && release.Status.State != appv2.ReviewStatusPassed {

		return nil, fmt.Errorf("invalid application version: %s, state: %s, for release: %s",
			versionID, appVersion.Status.State, release.Name)
	}
	return nil, nil
}

```

### Core Architecture Module: `pkg/controller/cluster/cluster_webhook.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package cluster

import (
	"context"
	"errors"
	"fmt"
	"strings"

	kscontroller "kubesphere.io/kubesphere/pkg/controller"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"

	clusterv1alpha1 "kubesphere.io/api/cluster/v1alpha1"
)

const webhookName = "cluster-webhook"

func (v *Webhook) Name() string {
	return webhookName
}

func (v *Webhook) Enabled(clusterRole string) bool {
	return strings.EqualFold(clusterRole, string(clusterv1alpha1.ClusterRoleHost))
}

var _ kscontroller.Controller = &Webhook{}
var _ admission.CustomValidator = &Webhook{}

type Webhook struct {
}

func (v *Webhook) SetupWithManager(mgr *kscontroller.Manager) error {
	return builder.WebhookManagedBy(mgr).
		For(&clusterv1alpha1.Cluster{}).
		WithValidator(v).
		Complete()
}

func (v *Webhook) ValidateCreate(ctx context.Context, obj runtime.Object) (admission.Warnings, error) {
	return nil, nil
}

func (v *Webhook) ValidateUpdate(ctx context.Context, oldObj, newObj runtime.Object) (admission.Warnings, error) {
	oldCluster, ok := oldObj.(*clusterv1alpha1.Cluster)
	if !ok {
		return nil, fmt.Errorf("expected a Cluster but got a %T", oldObj)
	}
	newCluster, ok := newObj.(*clusterv1alpha1.Cluster)
	if !ok {
		return nil, fmt.Errorf("expected a Cluster but got a %T", newObj)
	}

	// The cluster created for the first time has no status information
	if oldCluster.Status.UID == "" {
		return nil, nil
	}

	clusterConfig, err := clientcmd.RESTConfigFromKubeConfig(newCluster.Spec.Connection.KubeConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to load cluster config for %s: %s", newCluster.Name, err)
	}
	clusterClient, err := kubernetes.NewForConfig(clusterConfig)
	if err != nil {
		return nil, err
	}
	kubeSystem, err := clusterClient.CoreV1().Namespaces().Get(ctx, metav1.NamespaceSystem, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	if oldCluster.Status.UID != kubeSystem.UID {
		return nil, errors.New("this kubeconfig corresponds to a different cluster than the previous one, you need to make sure that kubeconfig is not from another cluster")
	}
	return nil, nil
}

func (v *Webhook) ValidateDelete(ctx context.Context, obj runtime.Object) (admission.Warnings, error) {
	return nil, nil
}

```

### Core Architecture Module: `pkg/controller/cluster/utils/utils.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package utils

import (
	"os"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"

	clusterv1alpha1 "kubesphere.io/api/cluster/v1alpha1"
)

func IsClusterReady(cluster *clusterv1alpha1.Cluster) bool {
	for _, condition := range cluster.Status.Conditions {
		if condition.Type == clusterv1alpha1.ClusterReady && condition.Status == corev1.ConditionTrue {
			return true
		}
	}
	return false
}

func IsClusterSchedulable(cluster *clusterv1alpha1.Cluster) bool {
	if !cluster.DeletionTimestamp.IsZero() {
		return false
	}

	if !IsClusterReady(cluster) {
		return false
	}

	for _, condition := range cluster.Status.Conditions {
		if condition.Type == clusterv1alpha1.ClusterSchedulable && condition.Status == corev1.ConditionFalse {
			return false
		}
	}
	return true
}

func IsHostCluster(cluster *clusterv1alpha1.Cluster) bool {
	if _, ok := cluster.Labels[clusterv1alpha1.HostCluster]; ok {
		return true
	}
	return false
}

func BuildKubeconfigFromRestConfig(config *rest.Config) ([]byte, error) {
	apiConfig := api.NewConfig()

	apiCluster := &api.Cluster{
		Server:                   config.Host,
		CertificateAuthorityData: config.CAData,
	}

	// generated kubeconfig will be used by cluster federation, CAFile is not
	// accepted by kubefed, so we need read CAFile
	if len(apiCluster.CertificateAuthorityData) == 0 && len(config.CAFile) != 0 {
		caData, err := os.ReadFile(config.CAFile)
		if err != nil {
			return nil, err
		}
		apiCluster.CertificateAuthorityData = caData
	}

	apiConfig.Clusters["kubernetes"] = apiCluster

	apiConfig.AuthInfos["kubernetes-admin"] = &api.AuthInfo{
		ClientCertificateData: config.CertData,
		ClientKeyData:         config.KeyData,
		Token:                 config.BearerToken,
	}

	if config.BearerTokenFile != "" {
		newToken, _ := os.ReadFile(config.BearerTokenFile)
		if len(newToken) > 0 {
			apiConfig.AuthInfos["kubernetes-admin"].Token = string(newToken)
		}
	}

	apiConfig.Contexts["kubernetes-admin@kubernetes"] = &api.Context{
		Cluster:  "kubernetes",
		AuthInfo: "kubernetes-admin",
	}

	apiConfig.CurrentContext = "kubernetes-admin@kubernetes"

	return clientcmd.Write(*apiConfig)
}

```

### Core Architecture Module: `pkg/controller/config/config_webhook.go`
```
/*
 * Copyright 2024 the KubeSphere Authors.
 * Please refer to the LICENSE file in the root directory of the project.
 * https://github.com/kubesphere/kubesphere/blob/master/LICENSE
 */

package config

import (
	"context"

	kscontroller "kubesphere.io/kubesphere/pkg/controller"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"

	"kubesphere.io/kubesphere/pkg/constants"
	"kubesphere.io/kubesphere/pkg/controller/config/identityprovider"
	"kubesphere.io/kubesphere/pkg/controller/config/oauthclient"
)

func (w *Webhook) ValidateCreate(ctx context.Context, obj runtime.Object) (warnings admission.Warnings, err error) {
	secret := obj.(*v1.Secret)
	validator := w.factory.GetValidator(secret.Type)
	if validator != nil {
		return validator.ValidateCreate(ctx, secret)
	}
	return nil, nil
}

func (w *Webhook) ValidateUpdate(ctx context.Context, oldObj, newObj runtime.Object) (warnings admission.Warnings, err error) {
	newSecret := newObj.(*v1.Secret)
	oldSecret := oldObj.(*v1.Secret)
	if validator := w.factory.GetValidator(newSecret.Type); validator != nil {
		return validator.ValidateUpdate(ctx, oldSecret, newSecret)
	}
	return nil, nil
}

func (w *Webhook) ValidateDelete(ctx context.Context, obj runtime.Object) (warnings admission.Warnings, err error) {
	secret := obj.(*v1.Secret)
	validator := w.factory.GetValidator(secret.Type)
	if validator != nil {
		return validator.ValidateDelete(ctx, secret)
	}
	return nil, nil
}

func (w *Webhook) Default(ctx context.Context, obj runtime.Object) error {
	secret := obj.(*v1.Secret)
	if secret.Namespace != constants.KubeSphereNamespace {
		return nil
	}

	defaulter := w.factory.GetDefaulter(secret.Type)
	if defaulter != nil {
		return defaulter.Default(ctx, secret)
	}

	return nil
}

var _ admission.CustomDefaulter = &Webhook{}
var _ admission.CustomValidator = &Webhook{}
var _ kscontroller.Controller = &Webhook{}

const webhookName = "kubesphere-config-webhook"

func (w *Webhook) Name() string {
	return webhookName
}

type Webhook struct {
	client.Client
	factory *WebhookFactory
}

func (w *Webhook) SetupWithManager(mgr *kscontroller.Manager) error {
	factory := NewWebhookFactory()
	oauthWebhookHandler := &oauthclient.WebhookHandler{Client: mgr.GetClient()}
	factory.RegisterValidator(oauthWebhookHandler)
	factory.RegisterDefaulter(oauthWebhookHandler)
	identityProviderWebhookHandler := &identityprovider.WebhookHandler{Client: mgr.GetClient()}
	factory.RegisterValidator(identityProviderWebhookHandler)
	factory.RegisterDefaulter(identityProviderWebhookHandler)

	w.Client = mgr.GetClient()
	w.factory = factory

	return ctrl.NewWebhookManagedBy(mgr).
		WithValidator(w).
		WithDefaulter(w).
		For(&v1.Secret{}).
		Complete()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6657** (2026-09-30): **fix: retry member cluster KS Core install after a failed attempt**
  *Symptoms*: <!-- Thanks for sending a pull request! Here are some tips for you:  1. If you want **faster** PR reviews, read how: https://github.com/kubesphere/community/blob/master/developer-guide/development/the-pr-author-guide-to-getting-through-code-review.md 2. In case you want to know how your PR got reviewed, read: https://github.com/kubesphere/community/blob/master/developer-guide/development/code-review-guide.md 3. Here are some coding convetions followed by KubeSphere community: https://github.com/kubesphere/community/blob/master/developer-guide/development/coding-conventions.md -->  ### What type of PR is this? <!--  Add one of the following kinds: /kind bug /kind cleanup /kind documentation /kind feature /kind design  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression --> /kind bug  ### What this PR does / why we need it: When adding a member cluster with a custom/private image registry configured, a failed first attempt to install/upgrade the KS Core Helm release in that member cluster permanently stops the host cluster's `cluster` controller from ever retrying, so the member cluster is silently stuck (e.g. still pulling from the default registry) with no future correction.  Root cause: in `reconcileMemberCluster`, `setConfigHash(cluster)` was called unconditionally after every install/upgrade attempt, even when it failed (`status == corev1.ConditionFalse`). `configChanged()` only
  **Post-Mortem & Fix Analysis**:
  > /assign @zheng1  This has been green and waiting a few days — happy to adjust anything that would help review.
  > Closing this to keep my open PR queue manageable - it has been open a while without review, and I would rather not leave stale PRs sitting in your queue. The change itself still applies; happy to reopen and rebase if it is useful to you.

- **Issue #6654** (2026-09-30): **Block SSRF and cross-namespace secret exfiltration in git credential verify**
  *Symptoms*: <!-- Thanks for sending a pull request! Here are some tips for you:  1. If you want **faster** PR reviews, read how: https://github.com/kubesphere/community/blob/master/developer-guide/development/the-pr-author-guide-to-getting-through-code-review.md 2. In case you want to know how your PR got reviewed, read: https://github.com/kubesphere/community/blob/master/developer-guide/development/code-review-guide.md 3. Here are some coding convetions followed by KubeSphere community: https://github.com/kubesphere/community/blob/master/developer-guide/development/coding-conventions.md -->  ### What type of PR is this? <!--  Add one of the following kinds: /kind bug /kind cleanup /kind documentation /kind feature /kind design  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression --> /kind bug  ### What this PR does / why we need it:  `POST /kapis/resources.kubesphere.io/v1alpha2/git/verify` is reachable by any authenticated user (the built-in `authenticated` GlobalRole grants `create` on `resources.kubesphere.io/git` cluster-wide). The handler passed the caller-supplied `remoteUrl` straight to go-git's `origin.List()`, which makes an outbound HTTP request using ks-apiserver's own network identity and reflected the upstream response body back to the caller in the JSON error message — a server-side request forgery primitive against loopback, link-local (including the `169.254.169.254` cloud met
  **Post-Mortem & Fix Analysis**:
  > /assign @shaowenchen  This has been open a week and is green on CI — would appreciate a look when you have time, since it touches pkg/models/git which you own.
  > Closing this to keep my open PR queue manageable - it has been open a while without review, and I would rather not leave stale PRs sitting in your queue. The change itself still applies; happy to reopen and rebase if it is useful to you.

- **Issue #6652** (2026-08-27): **fix: remove invalid status.lastSyncTime null from extensions-museum Repository manifest**
  *Symptoms*: /kind bug  What this PR does / why we need it:  Motivation: Installing or upgrading ks-core fails with:    Error: UPGRADE FAILED: failed to create resource: Repository.kubesphere.io   "extensions-museum" is invalid: status.lastSyncTime: Invalid value: "null":   status.lastSyncTime in body must be of type string: "null"  This is caused by config/ks-core/templates/extension-museum.yaml rendering the extensions-museum Repository custom resource with an explicit `status: {lastSyncTime: null}` block (added in #6463). The Repository CRD (config/ks-core/charts/ks-crds/crds/kubesphere.io_repositories.yaml) defines `lastSyncTime` as `type: string, format: date-time` without `nullable: true`, and does not declare a status subresource, so the whole object (spec+status) is validated together on create. An explicit YAML/JSON `null` for a non-nullable string field fails Kubernetes' OpenAPI validation, blocking every fresh install and upgrade that renders this template.  Approach: Remove the two lines that hardcode `status.lastSyncTime: null` on the extensions-museum Repository manifest. The field is optional (`LastSyncTime *metav1.Time` with `omitempty` in staging/src/kubesphere.io/api/core/v1alpha1/types.go), and the repository controller already treats a nil/absent LastSyncTime as "never synced yet" (pkg/controller/core/repository_controller.go), populating it itself on first reconcile. Every other place in the codebase that constructs a Repository object (pkg/kapis/package/v1alpha1/hand
  **Post-Mortem & Fix Analysis**:
  > Closing this to keep my open PR queue manageable - it has been open a while without review, and I would rather not leave stale PRs sitting in your queue. The change itself still applies; happy to reopen and rebase if it is useful to you.

- **Issue #6650** (2026-08-12): **Add token-count badge to README**
  *Symptoms*: Hi! This PR adds one line to the README: a badge showing an estimate of how many LLM tokens this repo weighs. Since this project is the kind of thing people load into an LLM's context window, the number seemed genuinely useful to surface.  Preview: ![tokens](https://img.shields.io/endpoint?url=https://gittokens.rsamf.com/badge/kubesphere/kubesphere)  Full disclosure: I built the free, open-source service behind the badge (https://github.com/rsamf/gittokens), and I'm proposing it to a small, hand-picked set of repos where it seems like a good fit. If it isn't a fit here, please just close this, and I won't resubmit.

- **Issue #6647** (2026-07-15): **add kubesphere-gateway and kubesphere-gateway-api skills**
  *Symptoms*: <!-- Thanks for sending a pull request! Here are some tips for you:  1. If you want **faster** PR reviews, read how: https://github.com/kubesphere/community/blob/master/developer-guide/development/the-pr-author-guide-to-getting-through-code-review.md 2. In case you want to know how your PR got reviewed, read: https://github.com/kubesphere/community/blob/master/developer-guide/development/code-review-guide.md 3. Here are some coding convetions followed by KubeSphere community: https://github.com/kubesphere/community/blob/master/developer-guide/development/coding-conventions.md -->  ### What type of PR is this? <!--  Add one of the following kinds: /kind bug /kind cleanup /kind documentation /kind feature /kind design  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression -->   ### What this PR does / why we need it:  ### Which issue(s) this PR fixes: <!-- Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. _If PR is about `failing-tests or flakes`, please post the related issues/tests in a comment and do not use `Fixes`_* --> Fixes #  ### Special notes for reviewers: ``` ```  ### Does this PR introduced a user-facing change? <!-- If no, just write "None" in the release-note block below. If yes, a release note is required: Enter your extended release note in the block below. If the PR requires additional action from users switchin
  **Post-Mortem & Fix Analysis**:
  > /lgtm

- **Issue #6646** (2026-06-25): **feat: add kubeeye skills**
  *Symptoms*: <!-- Thanks for sending a pull request! Here are some tips for you:  1. If you want **faster** PR reviews, read how: https://github.com/kubesphere/community/blob/master/developer-guide/development/the-pr-author-guide-to-getting-through-code-review.md 2. In case you want to know how your PR got reviewed, read: https://github.com/kubesphere/community/blob/master/developer-guide/development/code-review-guide.md 3. Here are some coding convetions followed by KubeSphere community: https://github.com/kubesphere/community/blob/master/developer-guide/development/coding-conventions.md -->  ### What type of PR is this? <!--  Add one of the following kinds: /kind bug /kind cleanup /kind documentation /kind feature /kind design  Optionally add one or more of the following kinds if applicable: /kind api-change /kind deprecation /kind failing-test /kind flake /kind regression --> /kind feature  ### What this PR does / why we need it:  ### Which issue(s) this PR fixes: <!-- Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. _If PR is about `failing-tests or flakes`, please post the related issues/tests in a comment and do not use `Fixes`_* --> Fixes #  ### Special notes for reviewers: ``` ```  ### Does this PR introduced a user-facing change? <!-- If no, just write "None" in the release-note block below. If yes, a release note is required: Enter your extended release note in the block below. If the PR requires additional action from u
  **Post-Mortem & Fix Analysis**:
  > /lgtm

- **Issue #6644** (2026-06-04): **Add openpitrix skill**
  *Symptoms*: ## Summary - Add an OpenPitrix skill covering KubeSphere application management APIs and troubleshooting workflows - Include KSE application.kubesphere.io/v2 examples, legacy OpenPitrix API notes, and eval scenarios  ## Testing - Validated evals.json parses as JSON - Tested skill activation locally via Codex skill symlink before cleanup
  **Post-Mortem & Fix Analysis**:
  > /lgtm

- **Issue #6642** (2026-06-02): **[skills] Merge pull request #60 from kubesphere-extensions/dev**
  *Symptoms*: Source PR: https://github.com/kubesphere-extensions/kube-frontend-forge-controller/pull/60
  **Post-Mortem & Fix Analysis**:
  > /lgtm

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

### Incident Patch 1: `00d94f40` (2026-05-06)
**Commit Message**: Merge pull request #6636 from xiaolai/fix/nlpm-duplicate-section

fix(devops-overview): remove duplicate Project Components ASCII diagram



---

### Incident Patch 2: `8150e6c4` (2026-05-06)
**Commit Message**: Merge pull request #6635 from xiaolai/fix/nlpm-broken-markdown

fix(devops-pipeline): close unclosed bold marker in 'Step 3b' heading



---

### Incident Patch 3: `bdc50fcf` (2026-05-06)
**Commit Message**: Merge pull request #6634 from xiaolai/fix/nlpm-wrong-step-reference

fix(whizard-logging): correct 'From Step 3' placeholder to 'From Step 2'



---

### Incident Patch 4: `b47ecd38` (2026-05-06)
**Commit Message**: Merge pull request #6633 from xiaolai/fix/nlpm-yaml-syntax-error

fix(fluid): close unclosed double-quote in Dataset tieredstore YAML template



---

### Incident Patch 5: `2ae4fc43` (2026-05-06)
**Commit Message**: Merge pull request #6632 from xiaolai/fix/nlpm-wrong-credential-type

fix(devops-credentials): use correct Secret type in credential API examples



---

### Incident Patch 6: `e08088d6` (2026-05-06)
**Commit Message**: Merge pull request #6630 from xiaolai/fix/nlpm-overview-duplicate

fix: remove duplicate Project Components diagram in devops-overview

**File**: `skills/kubesphere-devops-overview/SKILL.md` (modified, +0/-17)
```diff
@@ -107,23 +107,6 @@ EOF
 └──────────────┘ └───────────┘ └─────────────┘
 ```
 
-```
-┌──────────────────────────────────────────────────────────────┐
-│                     DevOps Project                            │
-│  (Namespace with devops.kubesphere.io/managed=true label)    │
-└──────────────────────┬───────────────────────────────────────┘
-                       │
-        ┌──────────────┼──────────────┐
-        │              │              │
-┌───────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
-│  Pipelines   │ │Credentials│ │   Webhooks  │
-│              │ │           │ │             │
-│ - Graphical  │ │ - SSH     │ │ - GitHub    │
-│ - Jenkinsfile│ │ - Basic   │ │ - GitLab    │
-│ - Multi-branch│ │ - Token  │ │ - Generic   │
-└──────────────┘ └───────────┘ └─────────────┘
-```
-
 ## Installation
 
 ### Using InstallPlan (Recommended for Production)
```

---

### Incident Patch 7: `e320666a` (2026-05-06)
**Commit Message**: Merge pull request #6629 from xiaolai/fix/nlpm-pipeline-markdown

fix: close unclosed bold marker in devops-pipeline SKILL.md

**File**: `skills/kubesphere-devops-pipeline/SKILL.md` (modified, +1/-1)
```diff
@@ -320,7 +320,7 @@ spec:
     script_path: go/Jenkinsfile  # Path to Jenkinsfile in repo
 ```
 
-**Step 3b: For Private Repository (with credential):
+**Step 3b: For Private Repository (with credential):**
 ```yaml
 apiVersion: devops.kubesphere.io/v1alpha3
 kind: Pipeline
```

---

### Incident Patch 8: `40fe02a1` (2026-05-06)
**Commit Message**: Merge pull request #6628 from xiaolai/fix/nlpm-logging-step-ref

fix: correct step references in whizard-logging installation guide

**File**: `skills/whizard-logging/SKILL.md` (modified, +2/-2)
```diff
@@ -101,7 +101,7 @@ spec:
 ```
 
 **Replace placeholders:**
-- `<VERSION>`: From Step 3 (e.g., `1.4.0`)
+- `<VERSION>`: From Step 2 (e.g., `1.4.0`)
 - `<TARGET_CLUSTERS>`: User-confirmed cluster names
 
 **Note:** OpenSearch sink configuration (endpoints, auth) is provided by the **vector** extension. Make sure vector is installed and configured with OpenSearch before installing logging.
@@ -118,7 +118,7 @@ metadata:
 spec:
   extension:
     name: whizard-logging
-    version: <VERSION>  # From Step 3
+    version: <VERSION>  # From Step 2
   enabled: true
   upgradeStrategy: Manual
   config: |
```

---

### Incident Patch 9: `4906bf6b` (2026-05-06)
**Commit Message**: Merge pull request #6627 from xiaolai/fix/nlpm-fluid-yaml-syntax

fix: close missing double-quote in fluid Dataset YAML template

**File**: `skills/kubesphere-fluid/SKILL.md` (modified, +1/-1)
```diff
@@ -407,7 +407,7 @@ spec:
         path: {{path}}
         quota: {{quota}}
         high: "{{high}}"
-        low: "{{low}}
+        low: "{{low}}"
 ```
 
 **When user explicitly asks for "Dataset with Runtime", generate both:**
```

---

### Incident Patch 10: `b1b888de` (2026-05-06)
**Commit Message**: Merge pull request #6626 from xiaolai/fix/nlpm-credential-type

fix: correct Secret type in DevOps credential API examples

**File**: `skills/kubesphere-devops-credentials/SKILL.md` (modified, +4/-4)
```diff
@@ -107,7 +107,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
       "username": "git",
       "privatekey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/ssh-auth"
   }'
 ```
 
@@ -130,7 +130,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
       "username": "docker-user",
       "password": "docker-password"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/basic-auth"
   }'
 ```
 
@@ -191,7 +191,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
     "stringData": {
       "secret": "my-api-token-value"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/secret-text"
   }'
 ```
 
@@ -465,7 +465,7 @@ curl -s -X POST "${KUBESPHERE_API}/kapis/devops.kubesphere.io/v1alpha3/namespace
       "username": "git",
       "password": "'${GITHUB_TOKEN}'"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/basic-auth"
   }' | jq -r '.metadata.name'
 
 # 2. Create GitRepository
```

---

### Incident Patch 11: `cef3188a` (2026-04-27)
**Commit Message**: fix(devops-overview): remove duplicate Project Components ASCII diagram

The 'Project Components' ASCII architecture diagram appeared twice in
succession. The second copy (immediately following the first, before the
Installation section) is removed, eliminating redundant content and
restoring the intended single-diagram layout.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `skills/kubesphere-devops-overview/SKILL.md` (modified, +0/-17)
```diff
@@ -107,23 +107,6 @@ EOF
 └──────────────┘ └───────────┘ └─────────────┘
 ```
 
-```
-┌──────────────────────────────────────────────────────────────┐
-│                     DevOps Project                            │
-│  (Namespace with devops.kubesphere.io/managed=true label)    │
-└──────────────────────┬───────────────────────────────────────┘
-                       │
-        ┌──────────────┼──────────────┐
-        │              │              │
-┌───────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
-│  Pipelines   │ │Credentials│ │   Webhooks  │
-│              │ │           │ │             │
-│ - Graphical  │ │ - SSH     │ │ - GitHub    │
-│ - Jenkinsfile│ │ - Basic   │ │ - GitLab    │
-│ - Multi-branch│ │ - Token  │ │ - Generic   │
-└──────────────┘ └───────────┘ └─────────────┘
-```
-
 ## Installation
 
 ### Using InstallPlan (Recommended for Production)
```

---

### Incident Patch 12: `d9746ffb` (2026-04-27)
**Commit Message**: fix(devops-pipeline): close unclosed bold marker in Step 3b heading

The 'Step 3b: For Private Repository (with credential):' heading was
missing its closing '**', leaving the bold formatting unclosed. This
causes incorrect rendering in Markdown and can confuse section boundary
parsing in automated tools.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `skills/kubesphere-devops-pipeline/SKILL.md` (modified, +1/-1)
```diff
@@ -320,7 +320,7 @@ spec:
     script_path: go/Jenkinsfile  # Path to Jenkinsfile in repo
 ```
 
-**Step 3b: For Private Repository (with credential):
+**Step 3b: For Private Repository (with credential):**
 ```yaml
 apiVersion: devops.kubesphere.io/v1alpha3
 kind: Pipeline
```

---

### Incident Patch 13: `6b34abb4` (2026-04-27)
**Commit Message**: fix(whizard-logging): correct step reference from 'Step 3' to 'Step 2'

The installation template placeholder comment referenced 'From Step 3'
but the installation section only defines Step 1 and Step 2. The version
value comes from Step 2 ('Get Latest Version'), so the comment is corrected
to 'From Step 2'.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `skills/whizard-logging/SKILL.md` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ spec:
 ```
 
 **Replace placeholders:**
-- `<VERSION>`: From Step 3 (e.g., `1.4.0`)
+- `<VERSION>`: From Step 2 (e.g., `1.4.0`)
 - `<TARGET_CLUSTERS>`: User-confirmed cluster names
 
 **Note:** OpenSearch sink configuration (endpoints, auth) is provided by the **vector** extension. Make sure vector is installed and configured with OpenSearch before installing logging.
```

---

### Incident Patch 14: `a87097c6` (2026-04-27)
**Commit Message**: fix(fluid): close unclosed double-quote in YAML template

The `low` field in the Dataset tieredstore template was missing its
closing double-quote: `low: "{{low}}` → `low: "{{low}}"`.
The unclosed string literal produces invalid YAML that fails to parse
when applied as an InstallPlan.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `skills/kubesphere-fluid/SKILL.md` (modified, +1/-1)
```diff
@@ -407,7 +407,7 @@ spec:
         path: {{path}}
         quota: {{quota}}
         high: "{{high}}"
-        low: "{{low}}
+        low: "{{low}}"
 ```
 
 **When user explicitly asks for "Dataset with Runtime", generate both:**
```

---

### Incident Patch 15: `9d17bcae` (2026-04-27)
**Commit Message**: fix(devops-credentials): use correct credential type instead of Opaque

Replace `"type": "Opaque"` with the correct `credential.devops.kubesphere.io/*`
types in all API curl examples. The credential controller only syncs secrets
whose type starts with `credential.devops.kubesphere.io/`; Opaque secrets are
silently ignored, causing Jenkins to fail with "CredentialId could not be found".

- SSH example:         Opaque → credential.devops.kubesphere.io/ssh-auth
- Basic-auth examples: Opaque → credential.devops.kubesphere.io/basic-auth (×2)
- Secret-text example: Opaque → credential.devops.kubesphere.io/secret-text

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `skills/kubesphere-devops-credentials/SKILL.md` (modified, +4/-4)
```diff
@@ -107,7 +107,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
       "username": "git",
       "privatekey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/ssh-auth"
   }'
 ```
 
@@ -130,7 +130,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
       "username": "docker-user",
       "password": "docker-password"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/basic-auth"
   }'
 ```
 
@@ -191,7 +191,7 @@ curl -X POST "https://kubesphere-api/kapis/devops.kubesphere.io/v1alpha3/namespa
     "stringData": {
       "secret": "my-api-token-value"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/secret-text"
   }'
 ```
 
@@ -465,7 +465,7 @@ curl -s -X POST "${KUBESPHERE_API}/kapis/devops.kubesphere.io/v1alpha3/namespace
       "username": "git",
       "password": "'${GITHUB_TOKEN}'"
     },
-    "type": "Opaque"
+    "type": "credential.devops.kubesphere.io/basic-auth"
   }' | jq -r '.metadata.name'
 
 # 2. Create GitRepository
```

#### Recent Merged Pull Requests:
- **PR #6657** (closed): fix: retry member cluster KS Core install after a failed attempt (@pujitha24)
- **PR #6654** (closed): Block SSRF and cross-namespace secret exfiltration in git credential verify (@pujitha24)
- **PR #6652** (closed): fix: remove invalid status.lastSyncTime null from extensions-museum Repository manifest (@pujitha24)
- **PR #6650** (closed): Add token-count badge to README (@rsamf)
- **PR #6647** (2026-07-15): add kubesphere-gateway and kubesphere-gateway-api skills (@junotx)
- **PR #6646** (2026-06-25): feat: add kubeeye skills (@redscholar)
- **PR #6644** (2026-06-04): Add openpitrix skill (@smartcat999)
- **PR #6642** (2026-06-02): [skills] Merge pull request #60 from kubesphere-extensions/dev (@ks-ci-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
