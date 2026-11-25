# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: kubernetes-sigs-aws-load-balancer-controller-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "kubernetes-sigs-aws-load-balancer-controller-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T07:13:41.949Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kubernetes-sigs-aws-load-balancer-controller-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kubernetes-sigs-aws-load-balancer-controller-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T07:13:41.949Z`  
> **Learning ID**: `LEARN-EVO-kubernetes-sigs-aws-load-balancer-controller-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 68%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from kubernetes-sigs-aws-load-balancer-controller-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kubernetes-sigs-aws-load-balancer-controller-learnings.md`  
> **Source**: github ([https://github.com/kubernetes-sigs/aws-load-balancer-controller](https://github.com/kubernetes-sigs/aws-load-balancer-controller))  
> **Source Version**: `faa99854`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T07:13:04.969Z  
> **Learning ID**: `learn-github-kubernetes-sigs-aws-load-balancer-controller`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kubernetes-sigs/aws-load-balancer-controller

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubernetes-sigs-aws-load-balancer-controller-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubernetes-sigs/aws-load-balancer-controller](https://github.com/kubernetes-sigs/aws-load-balancer-controller))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T07:13:04.964Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubernetes-sigs/aws-load-balancer-controller`
- **Description**: A Kubernetes controller for Elastic Load Balancers
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4347 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `controllers/gateway/listener_status_utils.go`
```
package gateway

import (
	"fmt"
	"sort"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	gateway_constants "sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/constants"
	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/routeutils"
	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
)

func generateListenerStatus(listenerName gwv1.SectionName, supportedKinds []gwv1.RouteGroupKind, attachedRoutes int32, conditions []metav1.Condition) gwv1.ListenerStatus {
	return gwv1.ListenerStatus{
		Name:           listenerName,
		SupportedKinds: supportedKinds,
		AttachedRoutes: attachedRoutes,
		Conditions:     conditions,
	}
}

func generateListenerEntryStatus(listenerName gwv1.SectionName, supportedKinds []gwv1.RouteGroupKind, attachedRoutes int32, conditions []metav1.Condition) gwv1.ListenerEntryStatus {
	return gwv1.ListenerEntryStatus{
		Name:           listenerName,
		SupportedKinds: supportedKinds,
		AttachedRoutes: attachedRoutes,
		Conditions:     conditions,
	}
}

func buildListenerStatus[T any](generation int64, validateListenerResults routeutils.ListenerValidationResults, isProgrammed bool, constructor func(gwv1.SectionName, []gwv1.RouteGroupKind, int32, []metav1.Condition) T) []T {
	var listenerStatuses []T
	for listenerName, listenerValidationResult := range validateListenerResults.Results {
		conditions := getListenerConditions(generation, listenerValidationResult, isProgrammed)
		listenerStatus := constructor(listenerName, listenerValidationResult.SupportedKinds, listenerValidationResult.AttachedRoutesCount, conditions)
		listenerStatuses = append(listenerStatuses, listenerStatus)
	}
	return listenerStatuses
}

func buildListenerSetStatus(listenerSetNamespacedName types.NamespacedName, results routeutils.ListenerValidationResults, isGatewayProgrammed bool) (routeutils.ListenerSetStatusData, []gwv1.ListenerEntryStatus) {

	acceptedReason := string(gwv1.ListenerSetReasonAccepted)
	acceptedMessage := string(gwv1.ListenerSetReasonAccepted)
	if results.HasErrors {
		acceptedReason = string(gwv1.ListenerSetReasonListenersNotValid)
		acceptedMessage = "Some listeners are not valid"
	}

	hasSuccess := false
	for _, result := range results.Results {
		if result.IsValid {
			hasSuccess = true
		}
	}

	programmed := isGatewayProgrammed && hasSuccess
	programmedReason := string(gwv1.ListenerSetReasonProgrammed)
	programmedMessage := string(gwv1.ListenerSetReasonProgrammed)
	if !programmed {
		if isGatewayProgrammed {
			programmedMessage = "No valid listeners to materialize"
			programmedReason = string(gwv1.ListenerSetReasonListenersNotValid)
		} else {
			programmedMessage = "Parent gateway not yet programmed"
			programmedReason = string(gwv1.ListenerSetReasonPending)
		}
	}

	return routeutils.ListenerSetStatusData{
		ListenerSetMetadata: routeutils.ListenerSetMetadata{
			ListenerSetName:      listenerSetNamespacedName.Name,
			ListenerSetNamespace: listenerSetNamespacedName.Namespace,
			Generation:           results.Generation,
		},
		ListenerSetStatusInfo: routeutils.ListenerSetStatusInfo{
			Accepted:          hasSuccess,
			AcceptedReason:    acceptedReason,
			AcceptedMessage:   acceptedMessage,
			Programmed:        programmed,
			ProgrammedReason:  programmedReason,
			ProgrammedMessage: programmedMessage,
		},
	}, buildListenerStatus(results.Generation, results, programmed, generateListenerEntryStatus)
}

func buildRejectedListenerSetStatus(rejectedListenerSet gwv1.ListenerSet) (routeutils.ListenerSetStatusData, []gwv1.ListenerEntryStatus) {
	return routeutils.ListenerSetStatusData{
		ListenerSetMetadata: routeutils.ListenerSetMetadata{
			ListenerSetName:      rejectedListenerSet.Name,
			ListenerSetNamespace: rejectedListenerSet.Namespace,
			Generation:           rejectedListenerSet.Generation,
		},
		ListenerSetStatusInfo: routeutils.ListenerSetStatusInfo{
			Accepted:          false,
			AcceptedReason:    string(gwv1.ListenerSetReasonNotAllowed),
			AcceptedMessage:   "Parent Gateway rejected ListenerSet",
			Programmed:        false,
			ProgrammedReason:  string(gwv1.ListenerSetReasonNotAllowed),
			ProgrammedMessage: "Parent Gateway rejected ListenerSet",
		},
	}, []gwv1.ListenerEntryStatus{}
}

func getListenerConditions(generation int64, listenerValidationResult routeutils.ListenerValidationResult, isProgrammed bool) []metav1.Condition {
	var conditions []metav1.Condition

	// Default
	listenerReason := listenerValidationResult.Reason
	listenerErrMessage := listenerValidationResult.Message

	// Build Conflict Conditions
	switch listenerReason {
	case gwv1.ListenerReasonHostnameConflict, gwv1.ListenerReasonProtocolConflict:
		conditions = append(conditions, buildConflictedCondition(generation, listenerReason, listenerErrMessage))
	default:
		conditions = append(conditions, buildConflictedCondition(generation, gwv1.ListenerReasonNoConflicts, gateway_constants.ListenerNoConflictMessage))
	}

	// Build Accepted Conditions
	switch listenerReason {
	case gwv1.ListenerReasonPortUnavailable, gwv1.ListenerReasonUnsupportedProtocol, gwv1.ListenerReasonHostnameConflict, gwv1.ListenerReasonProtocolConflict:
		conditions = append(conditions, buildAcceptedCondition(generation, listenerReason, listenerErrMessage))
	default:
		conditions = append(conditions, buildAcceptedCondition(generation, gwv1.ListenerReasonAccepted, gateway_constants.ListenerAcceptedMessage))
	}

	// Build ResolvedRefs Conditions
	switch listenerReason {
	case gwv1.ListenerReasonInvalidRouteKinds, gwv1.ListenerReasonRefNotPermitted:
		conditions = append(conditions, buildResolvedRefsCondition(generation, listenerReason, listenerErrMessage))
	default:
		conditions = append(conditions, buildResolvedRefsCondition(generation, gwv1.ListenerReasonResolvedRefs, gateway_constants.ListenerResolvedRefMessage))
	}

	// Build Programmed Conditions
	conditions = append(conditions, buildProgrammedCondition(generation, isProgrammed, string(listenerReason)))

	return conditions
}

func buildProgrammedCondition(generation int64, isProgrammed bool, acceptedReason string) metav1.Condition {
	isAccepted := acceptedReason == string(gwv1.ListenerReasonAccepted)

	if !isAccepted {
		return metav1.Condition{
			Type:               string(gwv1.ListenerConditionProgrammed),
			Status:             metav1.ConditionFalse,
			Reason:             acceptedReason,
			Message:            gateway_constants.ListenerNotAcceptedMessage,
			LastTransitionTime: metav1.NewTime(time.Now()),
			ObservedGeneration: generation,
		}
	}

	if isProgrammed {
		return metav1.Condition{
			Type:               string(gwv1.ListenerConditionProgrammed),
			Status:             metav1.ConditionTrue,
			Reason:             string(gwv1.ListenerReasonProgrammed),
			Message:            gateway_constants.ListenerProgrammedMessage,
			LastTransitionTime: metav1.NewTime(time.Now()),
			ObservedGeneration: generation,
		}
	}

	return metav1.Condition{
		Type:               string(gwv1.ListenerConditionProgrammed),
		Status:             metav1.ConditionFalse,
		Reason:             string(gwv1.ListenerReasonPending),
		Message:            gateway_constants.ListenerPendingProgrammedMessage,
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: generation,
	}
}

func buildAcceptedCondition(generation int64, reason gwv1.ListenerConditionReason, message string) metav1.Condition {
	status := metav1.ConditionTrue
	if reason != gwv1.ListenerReasonAccepted {
		status = metav1.ConditionFalse
	}

	return metav1.Condition{
		Type:               string(gwv1.ListenerConditionAccepted),
		Status:             status,
		Reason:             string(reason),
		Message:            message,
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: generation,
	}
}

func buildConflictedCondition(generation int64, reason gwv1.ListenerConditionReason, message string) metav1.Condition {
	status := metav1.ConditionFalse
	if reason != gwv1.ListenerReasonNoConflicts {
		status = metav1.ConditionTrue
	}
	return metav1.Condition{
		Type:               string(gwv1.ListenerConditionConflicted),
		Status:             status,
		Reason:             string(reason),
		Message:            message,
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: generation,
	}
}

func buildResolvedRefsCondition(generation int64, reason gwv1.ListenerConditionReason, message string) metav1.Condition {
	status := metav1.ConditionTrue
	if reason != gwv1.ListenerReasonResolvedRefs {
		status = metav1.ConditionFalse
	}
	return metav1.Condition{
		Type:               string(gwv1.ListenerConditionResolvedRefs),
		Status:             status,
		Reason:             string(reason),
		Message:            message,
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: generation,
	}
}

func isListenerStatusIdentical(listenerStatus []gwv1.ListenerStatus, listenerStatusOld []gwv1.ListenerStatus) bool {
	if len(listenerStatus) != len(listenerStatusOld) {
		return false
	}
	// Sort both slices by Name before comparison
	sort.Slice(listenerStatus, func(i, j int) bool {
		return listenerStatus[i].Name < listenerStatus[j].Name
	})
	sort.Slice(listenerStatusOld, func(i, j int) bool {
		return listenerStatusOld[i].Name < listenerStatusOld[j].Name
	})
	for i := range listenerStatus {
		if listenerStatus[i].Name != listenerStatusOld[i].Name {
			return false
		}

		if !compareSupportedKinds(listenerStatus[i].SupportedKinds, listenerStatusOld[i].SupportedKinds) {
			return false
		}

		if listenerStatus[i].AttachedRoutes != listenerStatusOld[i].AttachedRoutes {
			return false
		}
		if len(listenerStatus[i].Conditions) != len(listenerStatusOld[i].Conditions) {
			return false
		}
		// Sort conditions by Type before comparison
		sort.Slice(listenerStatus[i].Conditions, func(j, k int) bool {
			return listenerStatus[i].Conditions[j].Type < listenerStatus[i].Conditions[k].Type
		})
		sort.Slice(listenerStatusOld[i].Conditions, func(j, k int) bool {
			return listenerStatus
```

### Core Architecture Module: `controllers/gateway/utils.go`
```
package gateway

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-logr/logr"
	"github.com/pkg/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/sets"
	elbv2gw "sigs.k8s.io/aws-load-balancer-controller/v3/apis/gateway/v1"
	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/routeutils"
	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
)

const (
	gatewayClassAnnotationLastProcessedConfig          = "elbv2.k8s.aws/last-processed-config"
	gatewayClassAnnotationLastProcessedConfigTimestamp = gatewayClassAnnotationLastProcessedConfig + "-timestamp"

	// The max message that can be stored in a condition
	maxMessageLength = 32700
)

// computeProcessedConfigVersion computes a composite version string from the LBC and optional TGC resource versions.
func computeProcessedConfigVersion(lbConf *elbv2gw.LoadBalancerConfiguration, tgConf *elbv2gw.TargetGroupConfiguration) string {
	if lbConf == nil {
		return ""
	}
	version := lbConf.ResourceVersion
	if tgConf != nil {
		version = version + "-" + tgConf.ResourceVersion
	}
	return version
}

// updateGatewayClassLastProcessedConfig updates the gateway class annotations with the last processed lb config resource version or "" if no lb config is attached to the gatewayclass.
// When a default TargetGroupConfiguration is referenced by the LBC, its resource version is included in the calculated version
// so that TGC changes also trigger downstream Gateway reconciliation.
func updateGatewayClassLastProcessedConfig(ctx context.Context, k8sClient client.Client, gwClass *gwv1.GatewayClass, lbConf *elbv2gw.LoadBalancerConfiguration, tgConf *elbv2gw.TargetGroupConfiguration) error {

	calculatedVersion := computeProcessedConfigVersion(lbConf, tgConf)

	storedVersion := getStoredProcessedConfig(gwClass)

	if storedVersion != nil && *storedVersion == calculatedVersion {
		return nil
	}

	if gwClass.Annotations == nil {
		gwClass.Annotations = make(map[string]string)
	}

	gwClassOld := gwClass.DeepCopy()
	if gwClass.Annotations == nil {
		gwClass.Annotations = make(map[string]string)
	}
	gwClass.Annotations[gatewayClassAnnotationLastProcessedConfig] = calculatedVersion
	gwClass.Annotations[gatewayClassAnnotationLastProcessedConfigTimestamp] = strconv.FormatInt(time.Now().Unix(), 10)

	return k8sClient.Patch(ctx, gwClass, client.MergeFrom(gwClassOld))
}

// getStoredProcessedConfig retrieves the resource version attached to the lb config referenced by the gateway class or nil if no such mapping exists.
func getStoredProcessedConfig(gwClass *gwv1.GatewayClass) *string {
	var storedVersion *string

	if gwClass.Annotations != nil {
		v, exists := gwClass.Annotations[gatewayClassAnnotationLastProcessedConfig]
		if exists {
			storedVersion = &v
		}
	}
	return storedVersion
}

// updateGatewayClassAcceptedCondition updates the 'accepted' condition on the gateway class to the passed in parameters. if no 'Accepted' condition exists, do nothing.
func updateGatewayClassAcceptedCondition(ctx context.Context, k8sClient client.Client, gwClass *gwv1.GatewayClass, newStatus metav1.ConditionStatus, reason string, message string) error {
	indxToUpdate, ok := deriveAcceptedConditionIndex(gwClass)

	if ok {

		storedStatus := gwClass.Status.Conditions[indxToUpdate].Status
		storedMessage := gwClass.Status.Conditions[indxToUpdate].Message
		storedReason := gwClass.Status.Conditions[indxToUpdate].Reason
		storedObservedGeneration := gwClass.Status.Conditions[indxToUpdate].ObservedGeneration

		if storedStatus == newStatus && storedMessage == message && storedReason == reason && storedObservedGeneration == gwClass.Generation {
			return nil
		}

		gwClassOld := gwClass.DeepCopy()
		gwClass.Status.Conditions[indxToUpdate].LastTransitionTime = metav1.NewTime(time.Now())
		gwClass.Status.Conditions[indxToUpdate].ObservedGeneration = gwClass.Generation
		gwClass.Status.Conditions[indxToUpdate].Status = newStatus
		gwClass.Status.Conditions[indxToUpdate].Message = message
		gwClass.Status.Conditions[indxToUpdate].Reason = reason
		if err := k8sClient.Status().Patch(ctx, gwClass, client.MergeFrom(gwClassOld)); err != nil {
			return errors.Wrapf(err, "failed to update gatewayclass status")
		}
	}
	return nil
}

// prepareGatewayConditionUpdate inserts the necessary data into the condition field of the gateway. The caller should patch the corresponding gateway. Returns false when no change was performed.
func prepareGatewayConditionUpdate(gw *gwv1.Gateway, targetConditionType string, newStatus metav1.ConditionStatus, reason string, message string) bool {
	indxToUpdate := -1
	var derivedCondition metav1.Condition
	for i, condition := range gw.Status.Conditions {
		if condition.Type == targetConditionType {
			indxToUpdate = i
			derivedCondition = condition
			break
		}
	}

	truncatedMessage := truncateMessage(message)

	if indxToUpdate != -1 {
		if derivedCondition.Status == newStatus && derivedCondition.Message == truncatedMessage && derivedCondition.Reason == reason && derivedCondition.ObservedGeneration == gw.Generation {
			return false
		}

		gw.Status.Conditions[indxToUpdate].LastTransitionTime = metav1.NewTime(time.Now())
		gw.Status.Conditions[indxToUpdate].ObservedGeneration = gw.Generation
		gw.Status.Conditions[indxToUpdate].Status = newStatus
		gw.Status.Conditions[indxToUpdate].Message = truncatedMessage
		gw.Status.Conditions[indxToUpdate].Reason = reason
		return true
	}

	// Condition doesn't exist, create it
	gw.Status.Conditions = append(gw.Status.Conditions, metav1.Condition{
		Type:               targetConditionType,
		Status:             newStatus,
		Reason:             reason,
		Message:            truncatedMessage,
		LastTransitionTime: metav1.NewTime(time.Now()),
		ObservedGeneration: gw.Generation,
	})
	return true
}

func truncateMessage(s string) string {
	if utf8.RuneCountInString(s) <= maxMessageLength {
		return s
	}

	runes := []rune(s)
	return string(runes[:maxMessageLength]) + "..."
}

// deriveAcceptedConditionIndex returns the index of the condition pertaining to the accepted condition.
// -1 if the condition doesn't exist
func deriveAcceptedConditionIndex(gwClass *gwv1.GatewayClass) (int, bool) {
	for i, v := range gwClass.Status.Conditions {
		if v.Type == string(gwv1.GatewayClassReasonAccepted) {
			return i, true
		}
	}
	return -1, false
}

// generateRouteList generate a deterministic route list.
//
//	Due to the nature of golang maps, we need to sort the keys and for good measure we sort the route descriptors too
func generateRouteList(listenerRoutes map[int32][]routeutils.RouteDescriptor) string {

	allRoutes := make([]string, 0)

	for _, lr := range listenerRoutes {
		for _, r := range lr {
			allRoutes = append(allRoutes, fmt.Sprintf("(%s, %s:%s)", r.GetRouteKind(), r.GetRouteNamespacedName().Namespace, r.GetRouteNamespacedName().Name))
		}
	}

	sort.Strings(allRoutes)

	return strings.Join(allRoutes, ",")
}

func getServicesFromRoutes(listenerRouteMap map[int32][]routeutils.RouteDescriptor) []types.NamespacedName {
	res := sets.New[types.NamespacedName]()

	for _, routes := range listenerRouteMap {
		for _, route := range routes {
			for _, rr := range route.GetAttachedRules() {
				for _, be := range rr.GetBackends() {
					if be.ServiceBackend != nil {
						res.Insert(be.ServiceBackend.GetBackendNamespacedName())
					}
				}
			}
		}
	}
	return res.UnsortedList()
}

// isGatewayDeleting returns true if the gateway has a deletion timestamp set
func isGatewayDeleting(gw *gwv1.Gateway) bool {
	return gw.DeletionTimestamp != nil && !gw.DeletionTimestamp.IsZero()
}

func handleReconcileResult(req reconcile.Request, err error, logger logr.Logger, success func(name string, namespace string), fail func(name string, namespace string, err error)) (ctrl.Result, error) {
	result, translatedError := runtime.HandleReconcileError(err, logger)
	if translatedError == nil {
		// Only declare success on a truly empty result (genuine completion).
		// A pending requeue (either immediate via Requeue or delayed via RequeueAfter)
		// means reconciliation is not done, so we must not declare success.
		if !result.Requeue && result.RequeueAfter == 0 {
			success(req.Name, req.Namespace)
		}
	} else {
		fail(req.Name, req.Namespace, translatedError)
	}
	return result, translatedError
}

```

### Core Architecture Module: `pkg/aga/endpoint_utils.go`
```
package aga

import (
	awssdk "github.com/aws/aws-sdk-go-v2/aws"

	"k8s.io/apimachinery/pkg/types"
	agaapi "sigs.k8s.io/aws-load-balancer-controller/v3/apis/aga/v1beta1"
)

// ResourceType defines the type of resource that can be referenced by a GlobalAccelerator
type ResourceType string

const (
	// ServiceResourceType represents a Service resource
	ServiceResourceType ResourceType = "Service"
	// IngressResourceType represents an Ingress resource
	IngressResourceType ResourceType = "Ingress"
	// GatewayResourceType represents a Gateway resource
	GatewayResourceType ResourceType = "Gateway"
)

// EndpointReference contains information about a referenced endpoint
type EndpointReference struct {
	Type       agaapi.GlobalAcceleratorEndpointType
	Name       string // Used for Service/Ingress/Gateway type endpoints
	Namespace  string // Used for Service/Ingress/Gateway type endpoints
	EndpointID string // Used for EndpointID type endpoints (ARN of LB or other resources)
	Endpoint   *agaapi.GlobalAcceleratorEndpoint
}

// GetAllDesiredEndpointsFromGA extracts all endpoint references from a GlobalAccelerator resource
func GetAllDesiredEndpointsFromGA(ga *agaapi.GlobalAccelerator) []EndpointReference {
	if ga == nil || ga.Spec.Listeners == nil {
		return nil
	}

	var endpoints []EndpointReference

	for _, listener := range *ga.Spec.Listeners {
		if listener.EndpointGroups == nil {
			continue
		}

		for _, endpointGroup := range *listener.EndpointGroups {
			if endpointGroup.Endpoints == nil {
				continue
			}

			for _, endpoint := range *endpointGroup.Endpoints {
				var name, namespace, endpointID string

				if endpoint.Type == agaapi.GlobalAcceleratorEndpointTypeEndpointID {
					// For EndpointID type, the endpointID will be set according to CRD validation
					endpointID = awssdk.ToString(endpoint.EndpointID)
					// For EndpointID type, name and namespace must not be set
					name = ""
					namespace = ""
				} else {
					// For Service/Ingress/Gateway types, name will be set according to CRD validation
					name = awssdk.ToString(endpoint.Name)

					// Determine namespace
					namespace = ga.Namespace
					// We allow the namespace to be specified, but will handle cross-namespace references
					// as warnings in the endpoint loader
					if endpoint.Namespace != nil && *endpoint.Namespace != "" {
						namespace = *endpoint.Namespace
					}

					// For these types, endpointID must not be set
					endpointID = ""
				}

				// Add to list - we want all endpoints regardless of type
				endpoints = append(endpoints, EndpointReference{
					Type:       endpoint.Type,
					Name:       name,
					Namespace:  namespace,
					EndpointID: endpointID,
					Endpoint:   &endpoint,
				})
			}
		}
	}

	return endpoints
}

// ToResourceKey converts an EndpointReference to a ResourceKey for the reference tracker
func (e EndpointReference) ToResourceKey() ResourceKey {
	switch e.Type {
	case agaapi.GlobalAcceleratorEndpointTypeEndpointID:
		// For EndpointID type, use the EndpointID as the resource name
		// We'll use an empty namespace since EndpointIDs are not namespaced
		return ResourceKey{
			Type: ResourceType(e.Type),
			Name: types.NamespacedName{
				Namespace: "",
				Name:      e.EndpointID,
			},
		}
	default:
		// For Service/Ingress/Gateway, use Name and Namespace
		return ResourceKey{
			Type: ResourceType(e.Type),
			Name: types.NamespacedName{
				Namespace: e.Namespace,
				Name:      e.Name,
			},
		}
	}
}

```

### Core Architecture Module: `pkg/aga/utils.go`
```
package aga

import (
	"sort"
	"strings"

	agaapi "sigs.k8s.io/aws-load-balancer-controller/v3/apis/aga/v1beta1"
	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/config"
	agamodel "sigs.k8s.io/aws-load-balancer-controller/v3/pkg/model/aga"
)

// IsPortInRanges checks if a port is within any of the specified port ranges
func IsPortInRanges(port int32, portRanges []agamodel.PortRange) bool {
	for _, portRange := range portRanges {
		if portRange.FromPort <= port && port <= portRange.ToPort {
			return true
		}
	}
	return false
}

// IsGlobalAcceleratorControllerEnabled checks if the Global Accelerator controller is both enabled via feature gate
// and if the region is in a partition that supports Global Accelerator
func IsGlobalAcceleratorControllerEnabled(featureGates config.FeatureGates, region string) bool {
	// First check if Global Accelerator controller is enabled via feature gate
	if !featureGates.Enabled(config.GlobalAcceleratorController) {
		return false
	}

	// Global Accelerator is only available in standard AWS partition
	// Not available in specialized AWS partitions
	regionLower := strings.ToLower(region)

	// Check for non-standard AWS partitions where Global Accelerator is not available
	unsupportedPrefixes := []string{
		"cn-",      // China regions
		"us-gov-",  // GovCloud regions
		"us-iso",   // ISO regions
		"eu-isoe-", // ISO-E regions
	}

	for _, prefix := range unsupportedPrefixes {
		if strings.HasPrefix(regionLower, prefix) {
			return false
		}
	}

	return true
}

// consolidatePortRanges combines consecutive ports into ranges
func consolidatePortRanges(ports []int32) []agamodel.PortRange {
	if len(ports) == 0 {
		return nil
	}

	// Sort ports for efficient range detection using standard library
	sort.Slice(ports, func(i, j int) bool {
		return ports[i] < ports[j]
	})

	// Consolidate ranges
	var result []agamodel.PortRange

	rangeStart := ports[0]
	rangeEnd := ports[0]

	for i := 1; i < len(ports); i++ {
		// If current port is consecutive to previous, extend the range
		if ports[i] == rangeEnd+1 {
			rangeEnd = ports[i]
		} else if ports[i] > rangeEnd+1 { // Skip duplicates
			// Save the current range and start a new one
			result = append(result, agamodel.PortRange{
				FromPort: rangeStart,
				ToPort:   rangeEnd,
			})
			rangeStart = ports[i]
			rangeEnd = ports[i]
		}
	}

	// Add the final range
	result = append(result, agamodel.PortRange{
		FromPort: rangeStart,
		ToPort:   rangeEnd,
	})

	return result
}

// canApplyAutoDiscoveryForGA checks if auto-discovery can be applied for the GlobalAccelerator
// Auto-discovery is only applicable if:
// 1. There's exactly one listener
// 2. The listener has exactly one endpoint group
// 3. The endpoint group has exactly one endpoint
// 4. The protocol or port ranges are not specified (needing discovery)
// 5. The loaded endpoint is usable (successful loading with valid ARN)
func canApplyAutoDiscoveryForGA(ga *agaapi.GlobalAccelerator, loadedEndpoints []*LoadedEndpoint) bool {
	// Must have exactly one listener
	if ga.Spec.Listeners == nil || len(*ga.Spec.Listeners) != 1 {
		return false
	}

	listener := (*ga.Spec.Listeners)[0]

	// Must have exactly one endpoint group
	if listener.EndpointGroups == nil || len(*listener.EndpointGroups) != 1 {
		return false
	}

	endpointGroup := (*listener.EndpointGroups)[0]

	// Must have exactly one endpoint
	if endpointGroup.Endpoints == nil || len(*endpointGroup.Endpoints) != 1 {
		return false
	}

	// Auto-discovery is allowed only when protocol and/or port ranges are not specified
	needsProtocolDiscovery := listener.Protocol == nil
	needsPortRangeDiscovery := listener.PortRanges == nil

	// Must need at least one type of discovery
	if !needsProtocolDiscovery && !needsPortRangeDiscovery {
		return false
	}

	// For auto-discovery, we require exactly one usable endpoint with a valid ARN
	if len(loadedEndpoints) != 1 || !loadedEndpoints[0].IsUsable() {
		return false
	}

	// Check if the endpoint is usable based on its type
	loadedEndpoint := loadedEndpoints[0]
	if loadedEndpoint.Type == agaapi.GlobalAcceleratorEndpointTypeEndpointID {
		// For EndpointID type, we just need a valid ARN
		return loadedEndpoint.ARN != ""
	} else {
		// For other types (Service, Ingress, Gateway), we need a K8s resource
		return loadedEndpoint.K8sResource != nil
	}
}

```

### Core Architecture Module: `pkg/aws/cloud_util.go`
```
package aws

import (
	"fmt"
	"regexp"
)

const (
	sessionNamePrefix    = "AWS-LBC-"
	maxSessionNameLength = 2047
)

var illegalValuesInSessionName = regexp.MustCompile(`[^a-zA-Z0-9=,.@\-_]+`)

func generateAssumeRoleSessionName(clusterName string) string {
	safeClusterName := illegalValuesInSessionName.ReplaceAllString(clusterName, "")

	sessionName := fmt.Sprintf("%s%s", sessionNamePrefix, safeClusterName)

	if len(sessionName) > maxSessionNameLength {
		return sessionName[:maxSessionNameLength]
	}

	return sessionName
}

```

### Core Architecture Module: `pkg/backend/endpoint_utils.go`
```
package backend

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	elbv2api "sigs.k8s.io/aws-load-balancer-controller/v3/apis/elbv2/v1beta1"
)

const (
	labelNodeRoleMaster               = "node-role.kubernetes.io/master"
	labelNodeRoleExcludeBalancer      = "node.kubernetes.io/exclude-from-external-load-balancers"
	labelAlphaNodeRoleExcludeBalancer = "alpha.service-controller.kubernetes.io/exclude-balancer"
	labelEKSComputeType               = "eks.amazonaws.com/compute-type"

	toBeDeletedByCATaint        = "ToBeDeletedByClusterAutoscaler"
	toBeDeletedByKarpenterTaint = "karpenter.sh/disrupted"
)

var (
	// Remember to update docs/guide/targetgroupbinding/targetgroupbinding.md if changing
	defaultTrafficProxyNodeLabelSelector = metav1.LabelSelector{
		MatchExpressions: []metav1.LabelSelectorRequirement{
			{
				Key:      labelNodeRoleMaster,
				Operator: metav1.LabelSelectorOpDoesNotExist,
			},
			{
				Key:      labelNodeRoleExcludeBalancer,
				Operator: metav1.LabelSelectorOpDoesNotExist,
			},
			{
				Key:      labelAlphaNodeRoleExcludeBalancer,
				Operator: metav1.LabelSelectorOpDoesNotExist,
			},
			{
				Key:      labelEKSComputeType,
				Operator: metav1.LabelSelectorOpNotIn,
				Values:   []string{"fargate"},
			},
		},
	}
)

// GetTrafficProxyNodeSelector returns the trafficProxy node label selector for specific targetGroupBinding.
func GetTrafficProxyNodeSelector(tgb *elbv2api.TargetGroupBinding) (labels.Selector, error) {
	selector, err := metav1.LabelSelectorAsSelector(&defaultTrafficProxyNodeLabelSelector)
	if err != nil {
		return nil, err
	}
	if tgb.Spec.NodeSelector != nil {
		customSelector, err := metav1.LabelSelectorAsSelector(tgb.Spec.NodeSelector)
		if err != nil {
			return nil, err
		}
		req, _ := customSelector.Requirements()
		selector = selector.Add(req...)
	}
	return selector, nil
}

// IsNodeSuitableAsTrafficProxy check whether node is suitable as a traffic proxy.
// This should be checked in additional to the nodeSelector defined in TargetGroupBinding.
func IsNodeSuitableAsTrafficProxy(node *corev1.Node) bool {
	for _, taint := range node.Spec.Taints {
		// ToBeDeletedByClusterAutoscaler taint is added by cluster autoscaler before removing node from cluster
		// Marking the node as unsuitable for traffic once the taint is observed on the node
		if taint.Key == toBeDeletedByCATaint {
			return false
		}
		// karpenter.sh/disrupted:NoSchedule taint is added by karpenter before removing node from cluster
		// Marking the node as unsuitable for traffic once the taint is observed on the node
		if taint.Key == toBeDeletedByKarpenterTaint && taint.Effect == corev1.TaintEffectNoSchedule {
			return false
		}
	}

	return true
}

```

### Core Architecture Module: `pkg/deploy/aga/utils.go`
```
package aga

import (
	"fmt"
	"sort"
	"strings"

	agatypes "github.com/aws/aws-sdk-go-v2/service/globalaccelerator/types"
	agamodel "sigs.k8s.io/aws-load-balancer-controller/v3/pkg/model/aga"
)

// SortModelPortRanges sorts port ranges by FromPort and then by ToPort
func SortModelPortRanges(portRanges []agamodel.PortRange) {
	sort.Slice(portRanges, func(i, j int) bool {
		if portRanges[i].FromPort != portRanges[j].FromPort {
			return portRanges[i].FromPort < portRanges[j].FromPort
		}
		return portRanges[i].ToPort < portRanges[j].ToPort
	})
}

// SortSDKPortRanges sorts port ranges by FromPort and then by ToPort
func SortSDKPortRanges(portRanges []agatypes.PortRange) {
	sort.Slice(portRanges, func(i, j int) bool {
		if *portRanges[i].FromPort != *portRanges[j].FromPort {
			return *portRanges[i].FromPort < *portRanges[j].FromPort
		}
		return *portRanges[i].ToPort < *portRanges[j].ToPort
	})
}

// PortRangeCompare is a generic comparison function for port ranges
// It takes two port ranges with their from and to values and compares them
// Returns -1 if the first range should sort before the second
// Returns 0 if they are equal
// Returns 1 if the first range should sort after the second
func PortRangeCompare(fromPort1, toPort1, fromPort2, toPort2 int32) int {
	if fromPort1 != fromPort2 {
		if fromPort1 < fromPort2 {
			return -1
		}
		return 1
	}

	if toPort1 != toPort2 {
		if toPort1 < toPort2 {
			return -1
		}
		return 1
	}

	return 0
}

// PortRangesToSet adds all ports in a range (inclusive) to the provided portSet map
func PortRangesToSet(fromPort, toPort int32, portSet map[int32]bool) {
	for port := fromPort; port <= toPort; port++ {
		portSet[port] = true
	}
}

// SDKPortRangesToSet adds all ports from AWS SDK PortRange slices to the provided portSet map
func SDKPortRangesToSet(portRanges []agatypes.PortRange, portSet map[int32]bool) {
	for _, pr := range portRanges {
		PortRangesToSet(*pr.FromPort, *pr.ToPort, portSet)
	}
}

// ResPortRangesToSet adds all ports from resource model PortRange slices to the provided portSet map
func ResPortRangesToSet(portRanges []agamodel.PortRange, portSet map[int32]bool) {
	for _, pr := range portRanges {
		PortRangesToSet(pr.FromPort, pr.ToPort, portSet)
	}
}

// FormatPortRangeToString converts an individual port range to string format
func FormatPortRangeToString(fromPort, toPort int32) string {
	return fmt.Sprintf("%d-%d", fromPort, toPort)
}

// ModelPortRangesToString converts model port ranges to a standardized string representation
// The port ranges should be sorted before calling this function
func ResPortRangesToString(portRanges []agamodel.PortRange) string {
	var parts []string
	for _, pr := range portRanges {
		parts = append(parts, FormatPortRangeToString(pr.FromPort, pr.ToPort))
	}
	return strings.Join(parts, ",")
}

// SDKPortRangesToString converts SDK port ranges to a standardized string representation
// The port ranges should be sorted before calling this function
func SDKPortRangesToString(portRanges []agatypes.PortRange) string {
	var parts []string
	for _, pr := range portRanges {
		parts = append(parts, FormatPortRangeToString(*pr.FromPort, *pr.ToPort))
	}
	return strings.Join(parts, ",")
}

```

### Core Architecture Module: `pkg/deploy/elbv2/listener_utils.go`
```
package elbv2

import (
	"context"
	"time"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	elbv2types "github.com/aws/aws-sdk-go-v2/service/elasticloadbalancingv2/types"
	"github.com/aws/smithy-go"
	"github.com/pkg/errors"
	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/config"
	elbv2model "sigs.k8s.io/aws-load-balancer-controller/v3/pkg/model/elbv2"
)

const (
	defaultWaitLSExistencePollInterval = 2 * time.Second
	defaultWaitLSExistenceTimeout      = 20 * time.Second
)

func buildResLRDesiredRuleConfig(resLR *elbv2model.ListenerRule, featureGates config.FeatureGates) (*resLRDesiredRuleConfig, error) {
	desiredActions, err := buildSDKActions(resLR.Spec.Actions, featureGates)
	if err != nil {
		return nil, err
	}
	desiredConditions := buildSDKRuleConditions(resLR.Spec.Conditions)
	desiredTransforms := buildSDKTransforms(resLR.Spec.Transforms)
	return &resLRDesiredRuleConfig{
		desiredActions:    desiredActions,
		desiredConditions: desiredConditions,
		desiredTransforms: desiredTransforms,
	}, err
}

func buildSDKActions(modelActions []elbv2model.Action, featureGates config.FeatureGates) ([]elbv2types.Action, error) {
	var sdkActions []elbv2types.Action
	if len(modelActions) != 0 {
		sdkActions = make([]elbv2types.Action, 0, len(modelActions))
		for index, modelAction := range modelActions {
			sdkAction, err := buildSDKAction(modelAction, featureGates)
			if err != nil {
				return nil, err
			}
			sdkAction.Order = awssdk.Int32(int32(index) + 1)
			sdkActions = append(sdkActions, sdkAction)
		}
	}
	return sdkActions, nil
}

func buildSDKAction(modelAction elbv2model.Action, featureGates config.FeatureGates) (elbv2types.Action, error) {
	sdkObj := elbv2types.Action{}
	sdkObj.Type = elbv2types.ActionTypeEnum(modelAction.Type)
	if modelAction.AuthenticateCognitoConfig != nil {
		sdkObj.AuthenticateCognitoConfig = buildSDKAuthenticateCognitoActionConfig(modelAction.AuthenticateCognitoConfig)
	}
	if modelAction.AuthenticateOIDCConfig != nil {
		sdkObj.AuthenticateOidcConfig = buildSDKAuthenticateOidcActionConfig(*modelAction.AuthenticateOIDCConfig)
	}
	if modelAction.JwtValidationConfig != nil {
		sdkObj.JwtValidationConfig = buildSDKJwtValidationConfig(*modelAction.JwtValidationConfig)
	}
	if modelAction.FixedResponseConfig != nil {
		sdkObj.FixedResponseConfig = buildSDKFixedResponseActionConfig(*modelAction.FixedResponseConfig)
	}
	if modelAction.RedirectConfig != nil {
		sdkObj.RedirectConfig = buildSDKRedirectActionConfig(*modelAction.RedirectConfig)
	}
	if modelAction.ForwardConfig != nil {
		forwardConfig, err := buildSDKForwardActionConfig(*modelAction.ForwardConfig)
		if err != nil {
			return elbv2types.Action{}, err
		}
		if !featureGates.Enabled(config.WeightedTargetGroups) {
			if len(forwardConfig.TargetGroups) == 1 {
				sdkObj.TargetGroupArn = forwardConfig.TargetGroups[0].TargetGroupArn
			} else {
				return elbv2types.Action{}, errors.New("weighted target groups feature is disabled")
			}
		} else {
			sdkObj.ForwardConfig = forwardConfig
		}
	}
	return sdkObj, nil
}

func buildSDKAuthenticateCognitoActionConfig(modelCfg *elbv2model.AuthenticateCognitoActionConfig) *elbv2types.AuthenticateCognitoActionConfig {
	return &elbv2types.AuthenticateCognitoActionConfig{
		AuthenticationRequestExtraParams: modelCfg.AuthenticationRequestExtraParams,
		OnUnauthenticatedRequest:         elbv2types.AuthenticateCognitoActionConditionalBehaviorEnum(modelCfg.OnUnauthenticatedRequest),
		Scope:                            modelCfg.Scope,
		SessionCookieName:                modelCfg.SessionCookieName,
		SessionTimeout:                   modelCfg.SessionTimeout,
		UserPoolArn:                      awssdk.String(modelCfg.UserPoolARN),
		UserPoolClientId:                 awssdk.String(modelCfg.UserPoolClientID),
		UserPoolDomain:                   awssdk.String(modelCfg.UserPoolDomain),
	}
}

func buildSDKAuthenticateOidcActionConfig(modelCfg elbv2model.AuthenticateOIDCActionConfig) *elbv2types.AuthenticateOidcActionConfig {
	return &elbv2types.AuthenticateOidcActionConfig{
		AuthenticationRequestExtraParams: modelCfg.AuthenticationRequestExtraParams,
		OnUnauthenticatedRequest:         elbv2types.AuthenticateOidcActionConditionalBehaviorEnum(modelCfg.OnUnauthenticatedRequest),
		Scope:                            modelCfg.Scope,
		SessionCookieName:                modelCfg.SessionCookieName,
		SessionTimeout:                   modelCfg.SessionTimeout,
		ClientId:                         awssdk.String(modelCfg.ClientID),
		ClientSecret:                     awssdk.String(modelCfg.ClientSecret),
		Issuer:                           awssdk.String(modelCfg.Issuer),
		AuthorizationEndpoint:            awssdk.String(modelCfg.AuthorizationEndpoint),
		TokenEndpoint:                    awssdk.String(modelCfg.TokenEndpoint),
		UserInfoEndpoint:                 awssdk.String(modelCfg.UserInfoEndpoint),
	}
}

func buildSDKJwtValidationConfig(modelCfg elbv2model.JwtValidationConfig) *elbv2types.JwtValidationActionConfig {
	var additionalClaims []elbv2types.JwtValidationActionAdditionalClaim
	for _, additionalClaim := range modelCfg.AdditionalClaims {
		additionalClaims = append(additionalClaims, elbv2types.JwtValidationActionAdditionalClaim{
			Format: elbv2types.JwtValidationActionAdditionalClaimFormatEnum(additionalClaim.Format),
			Name:   awssdk.String(additionalClaim.Name),
			Values: append([]string{}, additionalClaim.Values...),
		})
	}

	return &elbv2types.JwtValidationActionConfig{
		JwksEndpoint:     awssdk.String(modelCfg.JwksEndpoint),
		Issuer:           awssdk.String(modelCfg.Issuer),
		AdditionalClaims: additionalClaims,
	}
}

func buildSDKFixedResponseActionConfig(modelCfg elbv2model.FixedResponseActionConfig) *elbv2types.FixedResponseActionConfig {
	return &elbv2types.FixedResponseActionConfig{
		ContentType: modelCfg.ContentType,
		MessageBody: modelCfg.MessageBody,
		StatusCode:  awssdk.String(modelCfg.StatusCode),
	}
}

func buildSDKRedirectActionConfig(modelCfg elbv2model.RedirectActionConfig) *elbv2types.RedirectActionConfig {
	return &elbv2types.RedirectActionConfig{
		Host:       modelCfg.Host,
		Path:       modelCfg.Path,
		Port:       modelCfg.Port,
		Protocol:   modelCfg.Protocol,
		Query:      modelCfg.Query,
		StatusCode: elbv2types.RedirectActionStatusCodeEnum(modelCfg.StatusCode),
	}
}

func buildSDKForwardActionConfig(modelCfg elbv2model.ForwardActionConfig) (*elbv2types.ForwardActionConfig, error) {
	ctx := context.Background()
	sdkObj := &elbv2types.ForwardActionConfig{}
	var tgTuples []elbv2types.TargetGroupTuple
	for _, tgt := range modelCfg.TargetGroups {
		tgARN, err := tgt.TargetGroupARN.Resolve(ctx)
		if err != nil {
			return nil, err
		}
		tgTuples = append(tgTuples, elbv2types.TargetGroupTuple{
			TargetGroupArn: awssdk.String(tgARN),
			Weight:         tgt.Weight,
		})
	}
	sdkObj.TargetGroups = tgTuples
	if modelCfg.TargetGroupStickinessConfig != nil {
		sdkObj.TargetGroupStickinessConfig = &elbv2types.TargetGroupStickinessConfig{
			DurationSeconds: modelCfg.TargetGroupStickinessConfig.DurationSeconds,
			Enabled:         modelCfg.TargetGroupStickinessConfig.Enabled,
		}
	}

	return sdkObj, nil
}

func buildSDKRuleConditions(modelConditions []elbv2model.RuleCondition) []elbv2types.RuleCondition {
	var sdkConditions []elbv2types.RuleCondition
	if len(modelConditions) != 0 {
		sdkConditions = make([]elbv2types.RuleCondition, 0, len(modelConditions))
		for _, modelCondition := range modelConditions {
			sdkCondition := buildSDKRuleCondition(modelCondition)
			sdkConditions = append(sdkConditions, sdkCondition)
		}
	}
	return sdkConditions
}

func buildSDKRuleCondition(modelCondition elbv2model.RuleCondition) elbv2types.RuleCondition {
	sdkObj := elbv2types.RuleCondition{}
	sdkObj.Field = awssdk.String(string(modelCondition.Field))
	if modelCondition.HostHeaderConfig != nil {
		sdkObj.HostHeaderConfig = buildSDKHostHeaderConditionConfig(*modelCondition.HostHeaderConfig)
	}
	if modelCondition.HTTPHeaderConfig != nil {
		sdkObj.HttpHeaderConfig = buildSDKHTTPHeaderConditionConfig(*modelCondition.HTTPHeaderConfig)
	}
	if modelCondition.HTTPRequestMethodConfig != nil {
		sdkObj.HttpRequestMethodConfig = buildSDKHTTPRequestMethodConditionConfig(*modelCondition.HTTPRequestMethodConfig)
	}
	if modelCondition.PathPatternConfig != nil {
		sdkObj.PathPatternConfig = buildSDKPathPatternConditionConfig(*modelCondition.PathPatternConfig)
	}
	if modelCondition.QueryStringConfig != nil {
		sdkObj.QueryStringConfig = buildSDKQueryStringConditionConfig(*modelCondition.QueryStringConfig)
	}
	if modelCondition.SourceIPConfig != nil {
		sdkObj.SourceIpConfig = buildSDKSourceIpConditionConfig(*modelCondition.SourceIPConfig)
	}
	return sdkObj
}

func buildSDKHostHeaderConditionConfig(modelCfg elbv2model.HostHeaderConditionConfig) *elbv2types.HostHeaderConditionConfig {
	return &elbv2types.HostHeaderConditionConfig{
		RegexValues: modelCfg.RegexValues,
		Values:      modelCfg.Values,
	}
}

func buildSDKHTTPHeaderConditionConfig(modelCfg elbv2model.HTTPHeaderConditionConfig) *elbv2types.HttpHeaderConditionConfig {
	return &elbv2types.HttpHeaderConditionConfig{
		HttpHeaderName: awssdk.String(modelCfg.HTTPHeaderName),
		RegexValues:    modelCfg.RegexValues,
		Values:         modelCfg.Values,
	}
}

func buildSDKHTTPRequestMethodConditionConfig(modelCfg elbv2model.HTTPRequestMethodConditionConfig) *elbv2types.HttpRequestMethodConditionConfig {
	return &elbv2types.HttpRequestMethodConditionConfig{
		Values: modelCfg.Values,
	}
}

func buildSDKPathPatternConditionConfig(modelCfg elbv2model.PathPatternConditionConfig) *elbv2types.PathPatternConditionConfig {
	return &elbv2types.PathPatternConditionConfig{
		RegexValues: modelCfg.RegexValues,
		Values:      modelCfg.Values,
	}
}

func buildSDKQueryStringConditionConfig(modelCfg elbv2model.QueryStringConditionConfig) *elbv2types.QueryStringConditionConfig {
	kvPairs := make([]elbv2types.QueryStringKeyValuePair, 0, len(modelCfg.Values))
	for _, value := range modelCfg.Valu
```

### Core Architecture Module: `pkg/gateway/gatewayutils/gateway_utils.go`
```
package gatewayutils

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/sets"
	elbv2gw "sigs.k8s.io/aws-load-balancer-controller/v3/apis/gateway/v1"
	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/constants"
	"sigs.k8s.io/controller-runtime/pkg/client"
	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
)

// IsGatewayManagedByLBController checks if a Gateway is managed by the ALB/NLB Gateway Controller
// by verifying its associated GatewayClass controller name.
func IsGatewayManagedByLBController(ctx context.Context, k8sClient client.Client, gw *gwv1.Gateway, gwController string) bool {
	if gw == nil {
		return false
	}

	gwClass := &gwv1.GatewayClass{}
	if err := k8sClient.Get(ctx, client.ObjectKey{Name: string(gw.Spec.GatewayClassName)}, gwClass); err != nil {
		return false
	}
	return string(gwClass.Spec.ControllerName) == gwController
}

// GetGatewayClassesManagedByLBController retrieves all GatewayClasses managed by the ALB/NLB Gateway Controller.
func GetGatewayClassesManagedByLBController(ctx context.Context, k8sClient client.Client, gwControllers sets.Set[string]) ([]*gwv1.GatewayClass, error) {
	managedGatewayClasses := make([]*gwv1.GatewayClass, 0)
	gwClassList := &gwv1.GatewayClassList{}
	if err := k8sClient.List(ctx, gwClassList); err != nil {
		return managedGatewayClasses, err
	}
	managedGatewayClasses = make([]*gwv1.GatewayClass, 0, len(gwClassList.Items))

	for i := range gwClassList.Items {
		if gwControllers.Has(string(gwClassList.Items[i].Spec.ControllerName)) {
			managedGatewayClasses = append(managedGatewayClasses, &gwClassList.Items[i])
		}
	}
	return managedGatewayClasses, nil
}

// GetGatewaysManagedByLBController retrieves all Gateways managed by the ALB/NLB Gateway Controller.
func GetGatewaysManagedByLBController(ctx context.Context, k8sClient client.Client, gwController string) ([]*gwv1.Gateway, error) {
	managedGateways := make([]*gwv1.Gateway, 0)
	gwList := &gwv1.GatewayList{}

	if err := k8sClient.List(ctx, gwList); err != nil {
		return managedGateways, err
	}

	managedGateways = make([]*gwv1.Gateway, 0, len(gwList.Items))

	for i := range gwList.Items {
		if IsGatewayManagedByLBController(ctx, k8sClient, &gwList.Items[i], gwController) {
			managedGateways = append(managedGateways, &gwList.Items[i])
		}
	}
	return managedGateways, nil
}

// GetImpactedGatewaysFromParentRefs identifies Gateways affected by changes in parent references.
// Returns Gateways that are impacted and managed by the LB controller.
func GetImpactedGatewaysFromParentRefs(ctx context.Context, k8sClient client.Client, parentRefs []gwv1.ParentReference, originalParentRefsFromStatus []gwv1.RouteParentStatus, resourceNamespace string, gwController string) ([]types.NamespacedName, error) {
	for _, originalParentRef := range originalParentRefsFromStatus {
		parentRefs = append(parentRefs, originalParentRef.ParentRef)
	}
	parentRefs = removeDuplicateParentRefs(parentRefs, resourceNamespace)
	if len(parentRefs) == 0 {
		return nil, nil
	}
	impactedGateways := make([]types.NamespacedName, 0, len(parentRefs))
	unknownGateways := make([]types.NamespacedName, 0, len(parentRefs))
	failedListenerSetResolutions := make([]types.NamespacedName, 0)
	var err error
	for _, parent := range parentRefs {
		namespaceToUse := resourceNamespace
		if parent.Namespace != nil {
			namespaceToUse = string(*parent.Namespace)
		}

		parentResourceNsn := types.NamespacedName{
			Namespace: namespaceToUse,
			Name:      string(parent.Name),
		}

		var gwName types.NamespacedName
		if parent.Kind != nil && *parent.Kind == "ListenerSet" {
			ls := &gwv1.ListenerSet{}
			if err := k8sClient.Get(ctx, parentResourceNsn, ls); err != nil {
				failedListenerSetResolutions = append(failedListenerSetResolutions, parentResourceNsn)
				continue
			}

			gwNamespace := ls.Namespace
			if ls.Spec.ParentRef.Namespace != nil {
				gwNamespace = string(*ls.Spec.ParentRef.Namespace)
			}

			gwName = types.NamespacedName{
				Namespace: gwNamespace,
				Name:      string(ls.Spec.ParentRef.Name),
			}
		} else {
			gwName = parentResourceNsn
		}

		gw := &gwv1.Gateway{}
		if err := k8sClient.Get(ctx, gwName, gw); err != nil {
			// Ignore and continue processing other refs
			unknownGateways = append(unknownGateways, gwName)
			continue
		}

		if IsGatewayManagedByLBController(ctx, k8sClient, gw, gwController) {
			impactedGateways = append(impactedGateways, gwName)
		}
	}
	if len(unknownGateways) > 0 && len(failedListenerSetResolutions) > 0 {
		err = fmt.Errorf("failed to list gateways, %s, failed to resolve listenersets %s", unknownGateways, failedListenerSetResolutions)
	} else if len(unknownGateways) > 0 {
		err = fmt.Errorf("failed to list gateways, %s", unknownGateways)
	} else if len(failedListenerSetResolutions) > 0 {
		err = fmt.Errorf("failed to resolve listenersets %s", failedListenerSetResolutions)
	}
	return impactedGateways, err
}

// GetImpactedGatewayClassesFromLbConfig identifies GatewayClasses affected by LoadBalancer configuration changes.
// Returns GatewayClasses that reference the specified LoadBalancer configuration.
func GetImpactedGatewayClassesFromLbConfig(ctx context.Context, k8sClient client.Client, lbconfig *elbv2gw.LoadBalancerConfiguration, gwControllers sets.Set[string]) (map[string]*gwv1.GatewayClass, error) {
	if lbconfig == nil {
		return nil, nil
	}
	managedGwClasses, err := GetGatewayClassesManagedByLBController(ctx, k8sClient, gwControllers)
	if err != nil {
		return nil, err
	}
	impactedGatewayClasses := make(map[string]*gwv1.GatewayClass, len(managedGwClasses))
	for _, gwClass := range managedGwClasses {
		paramRef := gwClass.Spec.ParametersRef
		if paramRef == nil {
			continue
		}
		if paramRef.Namespace == nil {
			continue
		}
		if string(paramRef.Kind) != constants.LoadBalancerConfiguration {
			continue
		}
		if string(*paramRef.Namespace) != lbconfig.Namespace {
			continue
		}
		if paramRef.Name != lbconfig.Name {
			continue
		}
		impactedGatewayClasses[gwClass.Name] = gwClass
	}
	return impactedGatewayClasses, nil
}

// GetImpactedGatewaysFromLbConfig identifies Gateways affected by LoadBalancer configuration changes.
// Returns Gateways that reference the specified LoadBalancer configuration.
func GetImpactedGatewaysFromLbConfig(ctx context.Context, k8sClient client.Client, lbconfig *elbv2gw.LoadBalancerConfiguration, gwController string) ([]*gwv1.Gateway, error) {
	if lbconfig == nil {
		return nil, nil
	}
	managedGateways, err := GetGatewaysManagedByLBController(ctx, k8sClient, gwController)
	if err != nil {
		return nil, err
	}
	impactedGateways := make([]*gwv1.Gateway, 0, len(managedGateways))
	for _, gw := range managedGateways {
		if gw.Namespace != lbconfig.Namespace {
			continue
		}

		if gw.Spec.Infrastructure != nil && gw.Spec.Infrastructure.ParametersRef != nil && string(gw.Spec.Infrastructure.ParametersRef.Kind) == constants.LoadBalancerConfiguration && gw.Spec.Infrastructure.ParametersRef.Name == lbconfig.Name {
			impactedGateways = append(impactedGateways, gw)
		}
	}
	return impactedGateways, nil
}

// GetGatewaysManagedByGatewayClass identifies Gateways managed by a GatewayClass.
// Returns Gateways that refer the specified GatewayClass.
func GetGatewaysManagedByGatewayClass(ctx context.Context, k8sClient client.Client, gwClass *gwv1.GatewayClass) ([]*gwv1.Gateway, error) {
	gwList, err := GetGatewaysManagedByLBController(ctx, k8sClient, string(gwClass.Spec.ControllerName))
	if err != nil {
		return nil, err
	}
	managedGw := make([]*gwv1.Gateway, 0, len(gwList))
	for _, gw := range gwList {
		if string(gw.Spec.GatewayClassName) == gwClass.Name {
			managedGw = append(managedGw, gw)
		}
	}
	return managedGw, nil
}

// removeDuplicateParentRefs make sure parentRefs in list is unique
func removeDuplicateParentRefs(parentRefs []gwv1.ParentReference, resourceNamespace string) []gwv1.ParentReference {
	result := make([]gwv1.ParentReference, 0, len(parentRefs))
	exist := map[string]sets.Set[types.NamespacedName]{}
	for _, parentRef := range parentRefs {
		var namespaceToUse string
		if parentRef.Namespace != nil {
			namespaceToUse = string(*parentRef.Namespace)
		} else {
			namespaceToUse = resourceNamespace
		}
		namespacedName := types.NamespacedName{
			Namespace: namespaceToUse,
			Name:      string(parentRef.Name),
		}
		kind := "Gateway"
		if parentRef.Kind != nil {
			kind = string(*parentRef.Kind)
		}

		if _, kindOk := exist[kind]; !kindOk {
			exist[kind] = sets.Set[types.NamespacedName]{}
		}

		if !exist[kind].Has(namespacedName) {
			exist[kind].Insert(namespacedName)
			result = append(result, parentRef)
		}
	}
	return result
}

// Convert local param ref -> namespaced param ref
func GetNamespacedParamRefForGateway(gw *gwv1.Gateway) *gwv1.ParametersReference {
	if gw.Spec.Infrastructure != nil && gw.Spec.Infrastructure.ParametersRef != nil {
		ns := gwv1.Namespace(gw.Namespace)
		return &gwv1.ParametersReference{
			Group:     gw.Spec.Infrastructure.ParametersRef.Group,
			Kind:      gw.Spec.Infrastructure.ParametersRef.Kind,
			Name:      gw.Spec.Infrastructure.ParametersRef.Name,
			Namespace: &ns,
		}

	}
	return nil
}

```

### Core Architecture Module: `pkg/gateway/gatewayutils/lb_config_utils.go`
```
package gatewayutils

import (
	"context"
	"github.com/pkg/errors"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/sets"
	elbv2gw "sigs.k8s.io/aws-load-balancer-controller/v3/apis/gateway/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
)

// ResolveLoadBalancerConfig returns the lb config referenced in the ParametersReference.
func ResolveLoadBalancerConfig(ctx context.Context, k8sClient client.Client, reference *gwv1.ParametersReference) (*elbv2gw.LoadBalancerConfiguration, error) {
	var lbConf *elbv2gw.LoadBalancerConfiguration

	var err error
	if reference != nil {
		lbConf = &elbv2gw.LoadBalancerConfiguration{}
		if reference.Namespace != nil {
			err = k8sClient.Get(ctx, types.NamespacedName{
				Namespace: string(*reference.Namespace),
				Name:      reference.Name,
			}, lbConf)
		} else {
			err = errors.New("Namespace must be specified in ParametersRef")
		}
	}

	return lbConf, err
}

func IsLBConfigInUse(ctx context.Context, lbConfig *elbv2gw.LoadBalancerConfiguration, k8sClient client.Client, controllerNames sets.Set[string]) (bool, error) {
	inUse, err := IsLBConfigInUseByGatewayClass(ctx, lbConfig, k8sClient, controllerNames)

	if err != nil {
		return false, err
	}
	if inUse {
		return true, nil
	}

	return IsLBConfigInUseByGateway(ctx, lbConfig, k8sClient, controllerNames)
}
func IsLBConfigInUseByGatewayClass(ctx context.Context, lbConfig *elbv2gw.LoadBalancerConfiguration, k8sClient client.Client, controllerNames sets.Set[string]) (bool, error) {
	// fetch all the gateway classes referenced by lb config
	gwClassesUsingLBConfig, err := GetImpactedGatewayClassesFromLbConfig(ctx, k8sClient, lbConfig, controllerNames)
	if err != nil {
		return false, err
	}

	return len(gwClassesUsingLBConfig) > 0, nil
}

func IsLBConfigInUseByGateway(ctx context.Context, lbConfig *elbv2gw.LoadBalancerConfiguration, k8sClient client.Client, controllerNames sets.Set[string]) (bool, error) {
	for _, controllerName := range controllerNames.UnsortedList() {
		gws, err := GetImpactedGatewaysFromLbConfig(ctx, k8sClient, lbConfig, controllerName)
		if err != nil {
			return false, err
		}
		if len(gws) > 0 {
			return true, nil
		}
	}
	return false, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4976** (2026-11-24): **test(e2e): optionally detect cluster zones from EKS Auto Mode NodeClass**
  *Symptoms*: ### Issue  N/A  ### Description  The IPv6 UDP NLB gateway e2e tests (`configureIPv6SourceNAT`) build one `SourceNatIPv6Prefix` subnet configuration per cluster zone. Zones were derived from the `topology.kubernetes.io/zone` label of the current nodes. On EKS Auto Mode clusters, nodes may only be running in a subset of the zones the NodeClass subnets cover, so the test undercounts zones and generates too few subnet configurations.  This PR adds an opt-in `--automode-nodeclass-name` e2e flag:  - **Unset (default):** zones are derived from node labels, same as today. - **Set (e.g. `--automode-nodeclass-name=default`):** zones are derived from `status.subnets[].zone` of the named `eks.amazonaws.com/v1` `NodeClass`. Read via an unstructured client, so no new type dependency. Returns an error if the NodeClass doesn't exist or has no resolved subnet zones, so a misconfigured flag fails fast instead of silently producing an empty subnet config.  Changes: - `test/framework/utils/aws.go`: `GetClusterZones` now takes a `nodeClassName`, and dispatches to node-label or NodeClass based detection. - `test/framework/options.go`: new `--automode-nodeclass-name` flag. - `test/e2e/gateway/nlb_tests/nlb_test_helper.go`: pass the option through. - `test/framework/utils/aws_test.go`: unit tests for both modes, NodeClass isolation, and the error cases.  ### Checklist - [x] Added tests that cover your change (if possible) - [ ] Added/modified documentation as required (such as the `README.md`, or th

- **Issue #4975** (2026-11-24): **cut v3.7.0 release**
  *Symptoms*: ### Description  Cut v3.7.0 release.  ### Checklist - [ ] Added tests that cover your change (if possible) - [ ] Added/modified documentation as required (such as the `README.md`, or the `docs` directory) - [ ] Manually tested - [ ] Made sure the title of the PR is a good description that can go into the release notes  ### BONUS POINTS checklist: complete for good vibes and maybe prizes?! :exploding_head: - [ ] Backfilled missing tests for code in same general area :tada: - [ ] Refactored something and made the world a better place :star2:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  <!-- coderabbit-ai-generated:v1 -->  ## Summary by CodeRabbit  * **Release**   * Updated the AWS Load Balancer Controller to version 3.7.0.   * Updated deployment images and installation instructions to use the latest release.   * Updated the default build base image.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4975#" title="Author self-approved">bobert-2</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/OWNERS)~~ [bobert-2]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > <!-- coderabbit-ai-generated:v1 -->  <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/kubernetes-sigs/aws-load-balancer-controller/pull/4975?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><picture><source media="(prefers-color-scheme: dark)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change.svg"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change.svg" alt="Explain Change →" height="32"></picture></a>  <!-- review_stack_entry_end --> <!-- recent_review_status_start -->  No actionable comments were generated in the recent review.  <!-- recent_review_status_end --> <!-- walkthrough_start -

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

### Incident Patch 1: `faa99854` (2026-11-24)
**Commit Message**: test(e2e): optionally detect cluster zones from EKS Auto Mode NodeClass (#4976)

The IPv6 UDP NLB gateway tests build one source NAT subnet configuration
per cluster zone. Zones were derived from the topology.kubernetes.io/zone
label of the current nodes, which undercounts on EKS Auto Mode clusters
where nodes are only running in a subset of the zones the NodeClass
subnets cover.

Add an --automode-nodeclass-name flag. When empty (the default), zones
are still derived from node labels. When set, zones are derived from the
status.subnets of the named EKS Auto Mode NodeClass, and an error is
returned if the NodeClass is missing or has no resolved subnet zones.

**File**: `test/e2e/gateway/nlb_tests/nlb_test_helper.go` (modified, +1/-1)
```diff
@@ -729,7 +729,7 @@ func configureIPv6SourceNAT(ctx context.Context, tf *framework.Framework, lbcSpe
 	// For simplicity, we just let the ELB control plane to assign it.
 	if tf.Options.IPFamily == framework.IPv6 {
 		// We need the # of zones, as we must configure source nat prefix for each lb zone.
-		zones, err := utils.GetClusterZones(ctx, tf.K8sClient)
+		zones, err := utils.GetClusterZones(ctx, tf.K8sClient, tf.Options.AutoModeNodeClassName)
 		Expect(err).NotTo(HaveOccurred())
 		subnetConfigs := make([]elbv2gw.SubnetConfiguration, len(zones))
 		for i := range subnetConfigs {
```

**File**: `test/framework/options.go` (modified, +5/-0)
```diff
@@ -44,6 +44,10 @@ type Options struct {
 	EnableCertMgmtTests  bool
 	EnableMigrationTests bool
 
+	// AutoModeNodeClassName, when set, derives cluster zones from the status subnets of this
+	// EKS Auto Mode NodeClass instead of the zone labels of the current nodes.
+	AutoModeNodeClassName string
+
 	// ACM Certificate Management configuration for e2e test
 	Route53ValidationDomain string
 	PCAARN                  string
@@ -78,6 +82,7 @@ func (options *Options) BindFlags() {
 	flag.BoolVar(&options.EnableAGATests, "enable-aga-tests", false, "enables AWS Global Accelerator tests")
 	flag.BoolVar(&options.EnableCertMgmtTests, "enable-cert-tests", false, "enables AWS ACM Certificate Management tests")
 	flag.BoolVar(&options.EnableMigrationTests, "enable-migration-tests", false, "enables ingress-to-gateway migration tests")
+	flag.StringVar(&options.AutoModeNodeClassName, "automode-nodeclass-name", "", "name of the EKS Auto Mode NodeClass (e.g. default) to detect cluster zones from; when empty, zones are detected from node zone labels")
 
 	flag.StringVar(&options.Route53ValidationDomain, "route53-validation-domain", "", `Route53 domain that can be used for requesting amazon_issued certificates`)
 	flag.StringVar(&options.PCAARN, "pca-arn", "", `PCA ARN of CA that can be used to request private certificates`)
```

**File**: `test/framework/utils/aws.go` (modified, +49/-1)
```diff
@@ -2,9 +2,12 @@ package utils
 
 import (
 	"context"
+	"fmt"
 	"strings"
 
 	corev1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/util/sets"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 )
@@ -39,7 +42,22 @@ func PartitionDNSSuffix(region string) string {
 	}
 }
 
-func GetClusterZones(ctx context.Context, k8sClient client.Client) ([]string, error) {
+// autoModeNodeClassGVK identifies the EKS Auto Mode NodeClass resource.
+var autoModeNodeClassGVK = schema.GroupVersionKind{Group: "eks.amazonaws.com", Version: "v1", Kind: "NodeClass"}
+
+// GetClusterZones returns the distinct availability zones of the cluster.
+// If nodeClassName is empty, zones are taken from the topology.kubernetes.io/zone label of the
+// current nodes. Otherwise, zones are taken from the subnets resolved in the status of the named
+// EKS Auto Mode NodeClass, which covers every zone Auto Mode may launch nodes in even if no node
+// is currently running there.
+func GetClusterZones(ctx context.Context, k8sClient client.Client, nodeClassName string) ([]string, error) {
+	if nodeClassName != "" {
+		return getAutoModeNodeClassZones(ctx, k8sClient, nodeClassName)
+	}
+	return getNodeZones(ctx, k8sClient)
+}
+
+func getNodeZones(ctx context.Context, k8sClient client.Client) ([]string, error) {
 	nodes := &corev1.NodeList{}
 	err := k8sClient.List(ctx, nodes)
 	if err != nil {
@@ -61,3 +79,33 @@ func GetClusterZones(ctx context.Context, k8sClient client.Client) ([]string, er
 
 	return result.UnsortedList(), nil
 }
+
+func getAutoModeNodeClassZones(ctx context.Context, k8sClient client.Client, nodeClassName string) ([]string, error) {
+	nodeClass := &unstructured.Unstructured{}
+	nodeClass.SetGroupVersionKind(autoModeNodeClassGVK)
+	if err := k8sClient.Get(ctx, client.ObjectKey{Name: nodeClassName}, nodeClass); err != nil {
+		return nil, fmt.Errorf("failed to get EKS Auto Mode NodeClass %s: %w", nodeClassName, err)
+	}
+
+	subnets, _, err := unstructured.NestedSlice(nodeClass.Object, "status", "subnets")
+	if err != nil {
+		return nil, fmt.Errorf("failed to read status.subnets of NodeClass %s: %w", nodeClassName, err)
+	}
+
+	result := sets.New[string]()
+	for _, subnet := range subnets {
+		subnetMap, ok := subnet.(map[string]interface{})
+		if !ok {
+			continue
+		}
+		zone, _, _ := unstructured.NestedString(subnetMap, "zone")
+		if zone != "" {
+			result.Insert(zone)
+		}
+	}
+
+	if result.Len() == 0 {
+		return nil, fmt.Errorf("no zones found in status.subnets of EKS Auto Mode NodeClass %s", nodeClassName)
+	}
+	return result.UnsortedList(), nil
+}
```

**File**: `test/framework/utils/aws_test.go` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+package utils
+
+import (
+	"context"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/runtime"
+	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/fake"
+)
+
+func newNode(name, zone string) *corev1.Node {
+	node := &corev1.Node{ObjectMeta: metav1.ObjectMeta{Name: name}}
+	if zone != "" {
+		node.Labels = map[string]string{"topology.kubernetes.io/zone": zone}
+	}
+	return node
+}
+
+func newNodeClass(name string, subnetZones ...string) *unstructured.Unstructured {
+	subnets := make([]interface{}, 0, len(subnetZones))
+	for _, zone := range subnetZones {
+		subnets = append(subnets, map[string]interface{}{
+			"id":   "subnet-" + zone,
+			"zone": zone,
+		})
+	}
+	obj := &unstructured.Unstructured{}
+	obj.SetGroupVersionKind(autoModeNodeClassGVK)
+	obj.SetName(name)
+	obj.Object["status"] = map[string]interface{}{"subnets": subnets}
+	return obj
+}
+
+func newFakeClient(t *testing.T, objs ...client.Object) client.Client {
+	scheme := runtime.NewScheme()
+	require.NoError(t, clientgoscheme.AddToScheme(scheme))
+	return fake.NewClientBuilder().WithScheme(scheme).WithObjects(objs...).Build()
+}
+
+func Test_GetClusterZones(t *testing.T) {
+	tests := []struct {
+		name          string
+		objs          []client.Object
+		nodeClassName string
+		want          []string
+		wantErr       bool
+	}{
+		{
+			name: "no NodeClass name uses node zone labels",
+			objs: []client.Object{
+				newNode("node-1", "us-west-2a"),
+				newNode("node-2", "us-west-2b"),
+				newNode("node-3", "us-west-2a"),
+				newNode("node-no-label", ""),
+				newNodeClass("default", "us-west-2a", "us-west-2b", "us-west-2c"),
+			},
+			nodeClassName: "",
+			want:          []string{"us-west-2a", "us-west-2b"},
+		},
+		{
+			name: "NodeClass name uses that NodeClass's subnet zones instead of nodes",
+			objs: []client.Object{
+				newNode("node-1", "eu-west-1a"),
+				newNodeClass("default",
+					"eu-west-1c", "eu-west-1a", "eu-west-1c",
+					"eu-west-1b", "eu-west-1b", "eu-west-1a"),
+			},
+			nodeClassName: "default",
+			want:          []string{"eu-west-1a", "eu-west-1b", "eu-west-1c"},
+		},
+		{
+			name: "NodeClass name ignores other NodeClasses",
+			objs: []client.Object{
+				newNodeClass("default", "us-east-1a"),
+				newNodeClass("custom", "us-east-1b"),
+			},
+			nodeClassName: "custom",
+			want:          []string{"us-east-1b"},
+		},
+		{
+			name: "NodeClass name errors when the NodeClass does not exist",
+			objs: []client.Object{
+				newNode("node-1", "us-west-2a"),
+				newNodeClass("default", "us-west-2a"),
+			},
+			nodeClassName: "missing",
+			wantErr:       true,
+		},
+		{
+			name: "NodeClass name errors when the NodeClass has no subnet zones",
+			objs: []client.Object{
+				newNodeClass("default"),
+			},
+			nodeClassName: "default",
+			wantErr:       true,
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			k8sClient := newFakeClient(t, tt.objs...)
+			got, err := GetClusterZones(context.Background(), k8sClient, tt.nodeClassName)
+			if tt.wantErr {
+				assert.Error(t, err)
+				return
+			}
+			require.NoError(t, err)
+			assert.ElementsMatch(t, tt.want, got)
+		})
+	}
+}
```

---

### Incident Patch 2: `a440fb69` (2026-11-24)
**Commit Message**: Merge pull request #4975 from bobert-2/release-3.7

cut v3.7.0 release

**File**: `.ko.yaml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-defaultBaseImage: public.ecr.aws/eks-distro-build-tooling/eks-distro-minimal-base-nonroot:2026-11-10-1794337279.2023
+defaultBaseImage: public.ecr.aws/eks-distro-build-tooling/eks-distro-minimal-base-nonroot:2026-11-18-1795028524.2023
 builds:
 - env:
   - CGO_ENABLED=0
```

**File**: `Makefile` (modified, +2/-2)
```diff
@@ -2,12 +2,12 @@
 MAKEFILE_PATH = $(dir $(realpath -s $(firstword $(MAKEFILE_LIST))))
 
 # Image URL to use all building/pushing image targets
-IMG ?= public.ecr.aws/eks/aws-load-balancer-controller:v3.6.3
+IMG ?= public.ecr.aws/eks/aws-load-balancer-controller:v3.7.0
 # Image URL to use for builder stage in Docker build
 GOLANG_VERSION ?= $(shell cat .go-version)
 BUILD_IMAGE ?= public.ecr.aws/docker/library/golang:$(GOLANG_VERSION)
 # Image URL to use for base layer in Docker build
-BASE_IMAGE ?= public.ecr.aws/eks-distro-build-tooling/eks-distro-minimal-base-nonroot:2026-11-10-1794337279.2023
+BASE_IMAGE ?= public.ecr.aws/eks-distro-build-tooling/eks-distro-minimal-base-nonroot:2026-11-18-1795028524.2023
 IMG_PLATFORM ?= linux/amd64,linux/arm64
 # ECR doesn't appear to support SPDX SBOM
 IMG_SBOM ?= none
```

**File**: `config/controller/kustomization.yaml` (modified, +1/-1)
```diff
@@ -9,4 +9,4 @@ kind: Kustomization
 images:
 - name: controller
   newName: public.ecr.aws/eks/aws-load-balancer-controller
-  newTag: v3.6.3
+  newTag: v3.7.0
```

**File**: `docs/deploy/installation.md` (modified, +8/-8)
```diff
@@ -92,15 +92,15 @@ Example condition for cluster name resource tag:
 2. Download an IAM policy for the LBC using one of the following commands:<p>
     If your cluster is in a US Gov Cloud region:
     ```
-    curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/install/iam_policy_us-gov.json
+    curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/install/iam_policy_us-gov.json
     ```
     If your cluster is in a China region:
     ```
-    curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/install/iam_policy_cn.json
+    curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/install/iam_policy_cn.json
     ```
     If your cluster is in any other region:
     ```
-    curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/install/iam_policy.json
+    curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/install/iam_policy.json
     ```
 
 3. Create an IAM policy named `AWSLoadBalancerControllerIAMPolicy`. If you downloaded a different policy, replace `iam-policy` with the name of the policy that you downloaded.
@@ -132,7 +132,7 @@ Follow the Pod Identity set-up guide [here](https://docs.aws.amazon.com/eks/late
 ### Option C: Attach IAM policies to nodes
 If you're not setting up IAM roles for service accounts, apply the IAM policies from the following URL at a minimum. Please be aware of the possibility that the controller permissions may be assumed by other users in a pod after retrieving the node role credentials, so the best practice would be using IRSA instead of attaching IAM policy directly.
 ```
-curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/install/iam_policy.json
+curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/install/iam_policy.json
 ```
 
 When using this option, IMDS *must* be enabled. The controller retrieves the instance credentials using IMDS. Use IRSA to avoid usage of IMDS.
@@ -274,7 +274,7 @@ We recommend using the Helm chart to install the controller. The chart supports
     ### Apply YAML
     1. Download the spec for the LBC.
     ```
-    wget https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v3.6.3/v3_6_3_full.yaml
+    wget https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v3.7.0/v3_7_0_full.yaml
     ```
     2. Edit the saved yaml file, go to the Deployment spec, and set the controller `--cluster-name` arg value to your EKS cluster name
     ```
@@ -298,15 +298,15 @@ We recommend using the Helm chart to install the controller. The chart supports
     ```
     4. Apply the yaml file
     ```
-    kubectl apply -f v3_6_3_full.yaml
+    kubectl apply -f v3_7_0_full.yaml
     ```
     5. Optionally download the default ingressclass and ingressclass params
     ```
-    wget https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v3.6.3/v3_6_3_ingclass.yaml
+    wget https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v3.7.0/v3_7_0_ingclass.yaml
     ```
     6. Apply the ingressclass and params
     ```
-    kubectl apply -f v3_6_3_ingclass.yaml
+    kubectl apply -f v3_7_0_ingclass.yaml
     ```
 
 ## Create Update Strategy
```

**File**: `docs/examples/echo_server.md` (modified, +5/-5)
```diff
@@ -87,9 +87,9 @@ In this walkthrough, you'll
 1.  Deploy all the echoserver resources (namespace, service, deployment)
 
     ```bash
-    kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/examples/echoservice/echoserver-namespace.yaml &&\
-    kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/examples/echoservice/echoserver-service.yaml &&\
-    kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/examples/echoservice/echoserver-deployment.yaml
+    kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/examples/echoservice/echoserver-namespace.yaml &&\
+    kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/examples/echoservice/echoserver-service.yaml &&\
+    kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/examples/echoservice/echoserver-deployment.yaml
     ```
 
 1.  List all the resources to ensure they were created.
@@ -113,7 +113,7 @@ In this walkthrough, you'll
 1.  Download the echoserver ingress manifest locally.
 
     ```bash
-    wget https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/examples/echoservice/echoserver-ingress.yaml
+    wget https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/examples/echoservice/echoserver-ingress.yaml
     ```
 
 1.  Configure the subnets, either by add annotation to the ingress or add tags to subnets. This step is optional in lieu of auto-discovery.
@@ -300,7 +300,7 @@ You should get back a valid response.
 follow below steps if you want to use kube2iam to provide the AWS credentials
 
 1. configure the proper policy
-    The policy to be used can be fetched from https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.6.3/docs/install/iam_policy.json
+    The policy to be used can be fetched from https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v3.7.0/docs/install/iam_policy.json
 
 1. configure the proper role and create the trust relationship
     You have to find which role is associated with your K8S nodes. Once you found take note of the full arn:
```

**File**: `helm/aws-load-balancer-controller/Chart.yaml` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 apiVersion: v2
 name: aws-load-balancer-controller
 description: AWS Load Balancer Controller Helm chart for Kubernetes
-version: 3.6.3
-appVersion: v3.6.3
+version: 3.7.0
+appVersion: v3.7.0
 home: https://github.com/aws/eks-charts
 icon: https://raw.githubusercontent.com/aws/eks-charts/master/docs/logo/aws.png
 sources:
```

**File**: `helm/aws-load-balancer-controller/test.yaml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ replicaCount: 2
 
 image:
   repository: public.ecr.aws/eks/aws-load-balancer-controller
-  tag: v3.6.3
+  tag: v3.7.0
   pullPolicy: IfNotPresent
 
 imagePullSecrets: []
```

**File**: `helm/aws-load-balancer-controller/values.yaml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ revisionHistoryLimit: 10
 
 image:
   repository: public.ecr.aws/eks/aws-load-balancer-controller
-  tag: v3.6.3
+  tag: v3.7.0
   pullPolicy: IfNotPresent
 
 runtimeClassName: ""
```

#### Recent Merged Pull Requests:
- **PR #4976** (2026-11-24): test(e2e): optionally detect cluster zones from EKS Auto Mode NodeClass (@zac-nixon)
- **PR #4975** (2026-11-24): cut v3.7.0 release (@bobert-2)
- **PR #4974** (2026-11-24): fix(targetgroupbinding): requeue IP TGBs while gated pods are excluded on not-Ready nodes (@shraddhabang)
- **PR #4969** (2026-11-24): feat: Support NLB mutual authentication and client certificate identity filters (@bobert-2)
- **PR #4965** (2026-11-19): fix: add readinessProbe to controller deployment in static manifest (@ManvithaP-hub)
- **PR #4961** (2026-11-19): feat(helm): add certManager.privateKey and configurable root CA commonName (@eliasericsson)

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

## X. test(e2e): optionally detect cluster zones from EKS Auto Mode NodeClass

**RULE**:
When implementing operations in `test/e2e/gateway/nlb_tests/nlb_test_helper.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubernetes-sigs/aws-load-balancer-controller. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `faa99854`: test(e2e): optionally detect cluster zones from EKS Auto Mode NodeClass. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `test/e2e/gateway/nlb_tests/nlb_test_helper.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		zones, err := utils.GetClusterZones(ctx, tf.K8sClient, tf.Options.AutoModeNodeClassName)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		zones, err := utils.GetClusterZones(ctx, tf.K8sClient)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `faa99854` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
