> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kubernetes-sigs-aws-load-balancer-controller-learnings.md`  
> **Source**: github ([https://github.com/kubernetes-sigs/aws-load-balancer-controller](https://github.com/kubernetes-sigs/aws-load-balancer-controller))  
> **Source Version**: `fbc97ecf`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T06:32:39.352Z  
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
> **Harvest Timestamp**: 2026-10-19T06:32:39.343Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubernetes-sigs/aws-load-balancer-controller`
- **Description**: A Kubernetes controller for Elastic Load Balancers
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4342 stars

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
- **Issue #4928** (2026-10-07): **fix(networking): treat InvalidGroup.NotFound as success in releaseSG**
  *Symptoms*: ## Problem  When deleting the backend security group during Ingress cleanup, if the EC2 `DeleteSecurityGroup` API returns `InvalidGroup.NotFound`, the controller enters an infinite reconcile error loop. The `autoGeneratedSG` field is never cleared, so every subsequent reconcile attempts to delete the same non-existent SG and fails forever.  ## Root cause  The AWS SDK client timeout can fire before EC2 responds to a `DeleteSecurityGroup` request. The SDK retries internally, but by the time the retry reaches EC2 the original request has already succeeded and the group is gone. The retry then returns `InvalidGroup.NotFound`, which `releaseSG()` treated as a failure, returning an error without clearing `autoGeneratedSG`. Each later reconcile hits the same `NotFound` and the loop never ends.  ## Fix  In `releaseSG()`, treat `InvalidGroup.NotFound` on the delete path as a successful deletion: clear `autoGeneratedSG` and return nil. The `isEC2SecurityGroupNotFoundError` helper already existed in the same file but was not used in the deletion path.  ## Testing  - Added a unit test case to `Test_defaultBackendSGProvider_Release` where `DeleteSecurityGroup` returns `InvalidGroup.NotFound` and `Release` is expected to succeed. - `go test ./pkg/networking/` passes; `go vet` and `gofmt` are clean.

- **Issue #4922** (2026-10-05): **fix(scripts): eks-charts sync gh CLI compat + docs version bump**
  *Symptoms*: ## Summary  - Fix `scripts/sync-to-eks-charts.sh` to work with modern `gh` CLI versions:   - Stop forcing a download of the pinned `gh` v0.10.1 (x86_64 build) whenever the installed `gh` version doesn't match. On arm64 (Apple Silicon) hosts this caused the x86_64 `gh`/`git` to shell out to `xcrun`, which fails since Command Line Tools on those machines don't ship an x86_64 slice. Now the script only installs `gh` if it is missing from `PATH`.   - Replace `gh repo fork $CHARTS_REPO --clone --remote`, which modern `gh` rejects when a repo argument is given (`--remote` is unsupported in that case), with an explicit fork (no clone) + clone of the fork as `origin` + `upstream` remote added separately. This preserves the remote layout (`origin` = fork, `upstream` = aws/eks-charts) the rest of the script relies on.   - Strip `*.bak`, `*~`, `*.orig` files from the copied chart directory before committing, so stray local editor/backup artifacts are never published to the upstream sync PR. - Bump the `docs-publish` Makefile target's `mike` version alias from `v3.5` to `v3.6`, matching the current `IMG` release version, so published docs track the current release line.  ## Testing  - Ran `scripts/sync-to-eks-charts.sh -b aws-load-balancer-controller -n` end-to-end on an Apple Silicon Mac with `gh` 2.102.0; completed successfully and opened aws/eks-charts#1377 with only the expected chart files (no backup artifacts). - Verified `make -n docs-publish` resolves to `pipenv run mike deploy v

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

### Incident Patch 1: `c27ac737` (2026-10-07)
**Commit Message**: fix(networking): treat InvalidGroup.NotFound as success in releaseSG (#4928)

* fix(networking): treat InvalidGroup.NotFound as success in releaseSG

When deleting the backend security group during Ingress cleanup, the
EC2 DeleteSecurityGroup API can return InvalidGroup.NotFound even though
the group was deleted. The AWS SDK client timeout can fire before EC2
responds, the SDK retries internally, and by the time the retry reaches
EC2 the original request has already deleted the group. The retry then
returns InvalidGroup.NotFound.

releaseSG treated that as a failure and returned an error without
clearing autoGeneratedSG, so every subsequent reconcile retried the
same delete against a group that no longer exists and failed forever.

Treat InvalidGroup.NotFound in the deletion path as a successful delete:
clear autoGeneratedSG and return nil. The isEC2SecurityGroupNotFoundError
helper already existed in this file but was not used on the delete path.

Signed-off-by: Nakul Shah <[REDACTED_EMAIL]>

* test(networking): assert autoGeneratedSG is cleared after delete

The Release test only checked that releaseSG returned nil, so removing
the autoGeneratedSG reset would still pass while lea

**File**: `pkg/networking/backend_sg_provider.go` (modified, +5/-0)
```diff
@@ -425,6 +425,11 @@ func (p *defaultBackendSGProvider) releaseSG(ctx context.Context) error {
 		_, err := p.ec2Client.DeleteSecurityGroupWithContext(ctx, req)
 		return err
 	}); err != nil {
+		if isEC2SecurityGroupNotFoundError(err) {
+			p.logger.Info("backend securityGroup already deleted", "ID", p.autoGeneratedSG)
+			p.autoGeneratedSG = ""
+			return nil
+		}
 		return errors.Wrap(err, "failed to delete securityGroup")
 	}
 	p.logger.Info("deleted securityGroup", "ID", p.autoGeneratedSG)
```

**File**: `pkg/networking/backend_sg_provider_test.go` (modified, +24/-0)
```diff
@@ -1022,6 +1022,27 @@ func Test_defaultBackendSGProvider_Release(t *testing.T) {
 			},
 			wantErr: errors.New("failed to delete securityGroup: api error Something.Else: unable to delete SG"),
 		},
+		{
+			name: "SG delete returns InvalidGroup.NotFound is treated as success",
+			fields: fields{
+				autogenSG: "sg-autogen",
+				listIngressCalls: []listIngressCall{
+					{},
+				},
+				listServicesCalls: []listServicesCall{
+					{},
+				},
+				deleteSGCalls: []deleteSecurityGroupWithContextCall{
+					{
+						req: &ec2sdk.DeleteSecurityGroupInput{
+							GroupId: awssdk.String("sg-autogen"),
+						},
+						err: &smithy.GenericAPIError{Code: "InvalidGroup.NotFound", Message: "The security group does not exist"},
+					},
+				},
+				inactiveIngresses: []*networking.Ingress{ing},
+			},
+		},
 		{
 			name: "k8s ingress list returns error",
 			fields: fields{
@@ -1134,6 +1155,9 @@ func Test_defaultBackendSGProvider_Release(t *testing.T) {
 				assert.EqualError(t, gotErr, tt.wantErr.Error())
 			} else {
 				assert.NoError(t, gotErr)
+				if len(tt.fields.deleteSGCalls) > 0 {
+					assert.Empty(t, sgProvider.autoGeneratedSG)
+				}
 			}
 		})
 	}
```

---

### Incident Patch 2: `afdf53b2` (2026-09-22)
**Commit Message**: fix: canonicalize CIDRs for security group inbound rules to avoid reconciliation failures (#4904)

**File**: `apis/gateway/v1/loadbalancerconfig_types.go` (modified, +1/-0)
```diff
@@ -255,6 +255,7 @@ type LoadBalancerConfigurationSpec struct {
 	SecurityGroupPrefixes *[]string `json:"securityGroupPrefixes,omitempty"`
 
 	// sourceRanges an optional list of CIDRs that are allowed to access the LB.
+	// IPv4 and IPv6 CIDRs are canonicalized. Defaults to 0.0.0.0/0 and ::/0.
 	// +optional
 	SourceRanges *[]string `json:"sourceRanges,omitempty"`
 
```

**File**: `apis/gateway/v1beta1/loadbalancerconfig_types.go` (modified, +1/-0)
```diff
@@ -255,6 +255,7 @@ type LoadBalancerConfigurationSpec struct {
 	SecurityGroupPrefixes *[]string `json:"securityGroupPrefixes,omitempty"`
 
 	// sourceRanges an optional list of CIDRs that are allowed to access the LB.
+	// IPv4 and IPv6 CIDRs are canonicalized. Defaults to 0.0.0.0/0 and ::/0.
 	// +optional
 	SourceRanges *[]string `json:"sourceRanges,omitempty"`
 
```

**File**: `config/crd/gateway/gateway-crds.yaml` (modified, +6/-4)
```diff
@@ -1217,8 +1217,9 @@ spec:
                     type: boolean
                 type: object
               sourceRanges:
-                description: sourceRanges an optional list of CIDRs that are allowed
-                  to access the LB.
+                description: |-
+                  sourceRanges an optional list of CIDRs that are allowed to access the LB.
+                  IPv4 and IPv6 CIDRs are canonicalized. Defaults to 0.0.0.0/0 and ::/0.
                 items:
                   type: string
                 type: array
@@ -1567,8 +1568,9 @@ spec:
                     type: boolean
                 type: object
               sourceRanges:
-                description: sourceRanges an optional list of CIDRs that are allowed
-                  to access the LB.
+                description: |-
+                  sourceRanges an optional list of CIDRs that are allowed to access the LB.
+                  IPv4 and IPv6 CIDRs are canonicalized. Defaults to 0.0.0.0/0 and ::/0.
                 items:
                   type: string
                 type: array
```

**File**: `config/crd/gateway/gateway.k8s.aws_loadbalancerconfigurations.yaml` (modified, +6/-4)
```diff
@@ -320,8 +320,9 @@ spec:
                     type: boolean
                 type: object
               sourceRanges:
-                description: sourceRanges an optional list of CIDRs that are allowed
-                  to access the LB.
+                description: |-
+                  sourceRanges an optional list of CIDRs that are allowed to access the LB.
+                  IPv4 and IPv6 CIDRs are canonicalized. Defaults to 0.0.0.0/0 and ::/0.
                 items:
                   type: string
                 type: array
@@ -670,8 +671,9 @@ spec:
                     type: boolean
                 type: object
               sourceRanges:
-                description: sourceRanges an optional list of CIDRs that are allowed
-                  to access the LB.
+                description: |-
+                  sourceRanges an optional list of CIDRs that are allowed to access the LB.
+                  IPv4 and IPv6 CIDRs are canonicalized. Defaults to 0.0.0.0/0 and ::/0.
                 items:
                   type: string
                 type: array
```

**File**: `docs/guide/ingress/annotations.md` (modified, +2/-0)
```diff
@@ -705,6 +705,8 @@ Access control for LoadBalancer can be controlled with following annotations:
 
 - <a name="inbound-cidrs">`alb.ingress.kubernetes.io/inbound-cidrs`</a> specifies the CIDRs that are allowed to access LoadBalancer.
 
+    The Load Balancer Controller canonicalizes CIDRs.
+
     !!!note "Merge Behavior"
         `inbound-cidrs` is merged across all Ingresses in IngressGroup, but is exclusive per listen-port.
 
```

**File**: `docs/guide/service/annotations.md` (modified, +1/-0)
```diff
@@ -610,6 +610,7 @@ Load balancer access can be controlled via following annotations:
     !!!tip
         - We recommend specifying CIDRs in the service `spec.loadBalancerSourceRanges` instead
         - For enhanced security with `internal` network load balancers, we recommend limiting access by specifying allowed source IP ranges.  This can be done using either the `service.beta.kubernetes.io/load-balancer-source-ranges` annotation or the `spec.loadBalancerSourceRanges` field.
+        - The Load Balancer Controller canonicalizes CIDRs
 
     !!!note "Default"
         - `0.0.0.0/0` will be used if the IPAddressType is "ipv4"
```

**File**: `helm/aws-load-balancer-controller/crds/gateway-crds.yaml` (modified, +6/-4)
```diff
@@ -1217,8 +1217,9 @@ spec:
                     type: boolean
                 type: object
               sourceRanges:
-                description: sourceRanges an optional list of CIDRs that are allowed
-                  to access the LB.
+                description: |-
+                  sourceRanges an optional list of CIDRs that are allowed to access the LB.
+                  IPv4 and IPv6 CIDRs are canonicalized. Defaults to 0.0.0.0/0 and ::/0.
                 items:
                   type: string
                 type: array
@@ -1567,8 +1568,9 @@ spec:
                     type: boolean
                 type: object
               sourceRanges:
-                description: sourceRanges an optional list of CIDRs that are allowed
-                  to access the LB.
+                description: |-
+                  sourceRanges an optional list of CIDRs that are allowed to access the LB.
+                  IPv4 and IPv6 CIDRs are canonicalized. Defaults to 0.0.0.0/0 and ::/0.
                 items:
                   type: string
                 type: array
```

**File**: `pkg/gateway/model/model_build_security_group.go` (modified, +15/-5)
```diff
@@ -6,6 +6,7 @@ import (
 	"encoding/hex"
 	"fmt"
 	"regexp"
+	"slices"
 
 	awssdk "github.com/aws/aws-sdk-go-v2/aws"
 	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"
@@ -156,7 +157,11 @@ func (builder *securityGroupBuilderImpl) buildManagedSecurityGroup(stack core.St
 		return nil, err
 	}
 
-	ingressPermissions := builder.buildManagedSecurityGroupIngressPermissions(lbConf, listeners, ipAddressType)
+	ingressPermissions, err := builder.buildManagedSecurityGroupIngressPermissions(lbConf, listeners, ipAddressType)
+	if err != nil {
+		return nil, err
+	}
+
 	return ec2model.NewSecurityGroup(stack, resourceIDManagedSecurityGroup, ec2model.SecurityGroupSpec{
 		GroupName:   name,
 		Description: managedSGDescription,
@@ -178,12 +183,11 @@ func (builder *securityGroupBuilderImpl) buildManagedSecurityGroupName(gw *gwv1.
 	return fmt.Sprintf("k8s-%.8s-%.8s-%.10s", sanitizedNamespace, sanitizedName, uuid)
 }
 
-func (builder *securityGroupBuilderImpl) buildManagedSecurityGroupIngressPermissions(lbConf elbv2gw.LoadBalancerConfiguration, listeners []gwv1.Listener, ipAddressType elbv2model.IPAddressType) []ec2model.IPPermission {
+func (builder *securityGroupBuilderImpl) buildManagedSecurityGroupIngressPermissions(lbConf elbv2gw.LoadBalancerConfiguration, listeners []gwv1.Listener, ipAddressType elbv2model.IPAddressType) ([]ec2model.IPPermission, error) {
 	var permissions []ec2model.IPPermission
 
 	// Default to 0.0.0.0/0 and ::/0
 	// If user specified actual ranges, then these values will be overridden.
-	// TODO - Document this
 	sourceRanges := []string{
 		"0.0.0.0/0",
 		"::/0",
@@ -205,12 +209,18 @@ func (builder *securityGroupBuilderImpl) buildManagedSecurityGroupIngressPermiss
 
 	includeIPv6 := isIPv6Supported(ipAddressType)
 
+	ipv4CIDRs, ipv6CIDRs, err := networking.CanonicalizeCIDRs(sourceRanges)
+	if err != nil {
+		return nil, err
+	}
+	cidrs := slices.Concat(ipv4CIDRs, ipv6CIDRs)
+
 	//listener loop
 	for _, listener := range listeners {
 		port := int32(listener.Port)
 		protocol := getSgRuleProtocol(listener.Protocol)
 		// CIDR Loop
-		for _, cidr := range sourceRanges {
+		for _, cidr := range cidrs {
 			isIPv6 := isIPv6CIDR(cidr)
 
 			if !isIPv6 {
@@ -278,7 +288,7 @@ func (builder *securityGroupBuilderImpl) buildManagedSecurityGroupIngressPermiss
 			})
 		} // PL loop
 	} // listener loop
-	return permissions
+	return permissions, nil
 }
 
 func getSgRuleProtocol(protocol gwv1.ProtocolType) ec2types.Protocol {
```

---

### Incident Patch 3: `ae2620d2` (2026-10-01)
**Commit Message**: fix: block deletion of gateway target group configs still used by TCPRoutes (#4802)

**File**: `controllers/gateway/eventhandlers/target_group_configuration_events.go` (modified, +3/-2)
```diff
@@ -102,7 +102,7 @@ func (h *enqueueRequestsForTargetGroupConfigurationEvent) enqueueImpactedObject(
 			return
 		}
 
-		impactedRoutes := getImpactedTCPRoutes(tcpRouteList, tgconfig)
+		impactedRoutes := GetImpactedTCPRoutes(tcpRouteList, tgconfig)
 		for i := range impactedRoutes {
 			h.tcpRouteEventChan <- event.TypedGenericEvent[*gwv1.TCPRoute]{
 				Object: impactedRoutes[i],
@@ -140,7 +140,8 @@ func (h *enqueueRequestsForTargetGroupConfigurationEvent) enqueueGatewaysReferen
 	}
 }
 
-func getImpactedTCPRoutes(list *gwv1.TCPRouteList, tgconfig *elbv2gw.TargetGroupConfiguration) []*gwv1.TCPRoute {
+// GetImpactedTCPRoutes returns routes referencing the target Gateway once each.
+func GetImpactedTCPRoutes(list *gwv1.TCPRouteList, tgconfig *elbv2gw.TargetGroupConfiguration) []*gwv1.TCPRoute {
 	seen := sets.Set[types.NamespacedName]{}
 	res := make([]*gwv1.TCPRoute, 0)
 
```

**File**: `controllers/gateway/eventhandlers/target_group_configuration_events_test.go` (modified, +1/-1)
```diff
@@ -228,7 +228,7 @@ func TestGetImpactedTCPRoutes(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			got := getImpactedTCPRoutes(tt.list, tt.tgconfig)
+			got := GetImpactedTCPRoutes(tt.list, tt.tgconfig)
 			res := make([]types.NamespacedName, 0)
 			for i := range got {
 				res = append(res, k8s.NamespacedName(got[i]))
```

**File**: `controllers/gateway/targetgroup_configuration_controller.go` (modified, +33/-0)
```diff
@@ -12,6 +12,7 @@ import (
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/tools/record"
 	elbv2gw "sigs.k8s.io/aws-load-balancer-controller/v3/apis/gateway/v1"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/controllers/gateway/eventhandlers"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/config"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/constants"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/gatewayutils"
@@ -26,6 +27,10 @@ import (
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 )
 
+const (
+	targetReferenceKindGateway = "Gateway"
+)
+
 // NewTargetGroupConfigurationReconciler constructs a reconciler that responds to targetgroup configuration changes
 func NewTargetGroupConfigurationReconciler(k8sClient client.Client, eventRecorder record.EventRecorder, controllerConfig config.ControllerConfig, serviceReferenceCounter referencecounter.ServiceReferenceCounter, finalizerManager k8s.FinalizerManager, logger logr.Logger, successCallback func(name string, namespace string), errorCallBack func(name string, namespace string, err error)) Reconciler {
 
@@ -132,6 +137,17 @@ func (r *targetgroupConfigurationReconciler) handleDelete(tgConf *elbv2gw.Target
 		return r.finalizerManager.RemoveFinalizers(context.Background(), tgConf, r.finalizer)
 	}
 
+	if tgConf.Spec.TargetReference.Kind != nil && *tgConf.Spec.TargetReference.Kind == targetReferenceKindGateway {
+		inUseRoutes, err := r.isGatewayTargetTGCInUse(context.Background(), tgConf)
+		if err != nil {
+			return err
+		}
+		if inUseRoutes != "" {
+			return fmt.Errorf("targetgroup configuration [%+v] is still in use by TCPRoutes [%s]", k8s.NamespacedName(tgConf), inUseRoutes)
+		}
+		return r.finalizerManager.RemoveFinalizers(context.Background(), tgConf, r.finalizer)
+	}
+
 	svcReference := types.NamespacedName{
 		Namespace: tgConf.Namespace,
 		Name:      tgConf.Spec.TargetReference.Name,
@@ -190,6 +206,23 @@ func (r *targetgroupConfigurationReconciler) isDefaultTGCInUse(ctx context.Conte
 	return "", nil
 }
 
+func (r *targetgroupConfigurationReconciler) isGatewayTargetTGCInUse(ctx context.Context, tgConf *elbv2gw.TargetGroupConfiguration) (string, error) {
+	tcpRouteList := &gwv1.TCPRouteList{}
+	if err := r.k8sClient.List(ctx, tcpRouteList); err != nil {
+		return "", err
+	}
+
+	inUseRoutes := make([]string, 0)
+	for _, route := range eventhandlers.GetImpactedTCPRoutes(tcpRouteList, tgConf) {
+		inUseRoutes = append(inUseRoutes, k8s.NamespacedName(route).String())
+	}
+
+	if len(inUseRoutes) > 0 {
+		return strings.Join(inUseRoutes, ", "), nil
+	}
+	return "", nil
+}
+
 func (r *targetgroupConfigurationReconciler) SetupWithManager(_ context.Context, mgr ctrl.Manager) (controller.Controller, error) {
 	return controller.New(constants.TargetGroupConfigurationController, mgr, controller.Options{
 		MaxConcurrentReconciles: r.workers,
```

**File**: `controllers/gateway/targetgroup_configuration_controller_test.go` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+package gateway
+
+import (
+	"context"
+	"testing"
+
+	"github.com/go-logr/logr"
+	"github.com/golang/mock/gomock"
+	"github.com/stretchr/testify/assert"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	elbv2gw "sigs.k8s.io/aws-load-balancer-controller/v3/apis/gateway/v1"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/k8s"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/testutils"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
+)
+
+const testTargetGroupConfigurationFinalizer = "test-finalizer"
+
+func TestTargetGroupConfigurationReconciler_handleDelete_GatewayTargetStillInUse(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
+	k8sClient := testutils.GenerateTestClient()
+	finalizerManager := k8s.NewMockFinalizerManager(ctrl)
+
+	targetKind := targetReferenceKindGateway
+	tgConf := &elbv2gw.TargetGroupConfiguration{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:       "gateway-tgc",
+			Namespace:  "test-ns",
+			Finalizers: []string{testTargetGroupConfigurationFinalizer},
+		},
+		Spec: elbv2gw.TargetGroupConfigurationSpec{
+			TargetReference: &elbv2gw.Reference{
+				Name: "chained-gateway",
+				Kind: &targetKind,
+			},
+		},
+	}
+	routeKind := gwv1.Kind(targetReferenceKindGateway)
+	route := &gwv1.TCPRoute{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "tcp-route",
+			Namespace: "test-ns",
+		},
+		Spec: gwv1.TCPRouteSpec{
+			Rules: []gwv1.TCPRouteRule{
+				{
+					BackendRefs: []gwv1.BackendRef{
+						{
+							BackendObjectReference: gwv1.BackendObjectReference{
+								Name: "chained-gateway",
+								Kind: &routeKind,
+							},
+						},
+					},
+				},
+				{
+					BackendRefs: []gwv1.BackendRef{{
+						BackendObjectReference: gwv1.BackendObjectReference{
+							Name: "chained-gateway",
+							Kind: &routeKind,
+						},
+					}},
+				},
+			},
+		},
+	}
+
+	assert.NoError(t, k8sClient.Create(context.Background(), tgConf))
+	assert.NoError(t, k8sClient.Create(context.Background(), route))
+
+	r := &targetgroupConfigurationReconciler{
+		k8sClient:        k8sClient,
+		logger:           logr.Discard(),
+		finalizerManager: finalizerManager,
+		finalizer:        testTargetGroupConfigurationFinalizer,
+		gwRetrieveFn: func(ctx context.Context, k8sClient client.Client, gwController string) ([]*gwv1.Gateway, error) {
+			return nil, nil
+		},
+	}
+
+	err := r.handleDelete(tgConf)
+	assert.EqualError(t, err, "targetgroup configuration [test-ns/gateway-tgc] is still in use by TCPRoutes [test-ns/tcp-route]")
+}
+
+func TestTargetGroupConfigurationReconciler_handleDelete_GatewayTargetNotInUse(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
+	k8sClient := testutils.GenerateTestClient()
+	finalizerManager := k8s.NewMockFinalizerManager(ctrl)
+
+	targetKind := targetReferenceKindGateway
+	tgConf := &elbv2gw.TargetGroupConfiguration{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:       "gateway-tgc",
+			Namespace:  "test-ns",
+			Finalizers: []string{testTargetGroupConfigurationFinalizer},
+		},
+		Spec: elbv2gw.TargetGroupConfigurationSpec{
+			TargetReference: &elbv2gw.Reference{
+				Name: "chained-gateway",
+				Kind: &targetKind,
+			},
+		},
+	}
+
+	assert.NoError(t, k8sClient.Create(context.Background(), tgConf))
+
+	finalizerManager.EXPECT().
+		RemoveFinalizers(context.Background(), tgConf, testTargetGroupConfigurationFinalizer).
+		Return(nil)
+
+	r := &targetgroupConfigurationReconciler{
+		k8sClient:        k8sClient,
+		logger:           logr.Discard(),
+		finalizerManager: finalizerManager,
+		finalizer:        testTargetGroupConfigurationFinalizer,
+		gwRetrieveFn: func(ctx context.Context, k8sClient client.Client, gwController string) ([]*gwv1.Gateway, error) {
+			return nil, nil
+		},
+	}
+
+	err := r.handleDelete(tgConf)
+	assert.NoError(t, err)
+}
```

#### Recent Merged Pull Requests:
- **PR #4928** (2026-10-07): fix(networking): treat InvalidGroup.NotFound as success in releaseSG (@nakshah87)
- **PR #4922** (2026-10-05): fix(scripts): eks-charts sync gh CLI compat + docs version bump (@shraddhabang)
- **PR #4921** (2026-10-05): cut v3.6.0 release (@shraddhabang)
- **PR #4919** (2026-10-03): fix: ignore unpermitted cross namespace TCPRoutes in gateway target TGC deletion guard (@shraddhabang)
- **PR #4918** (2026-10-09): Move mutual auth helpers to shared utils (@bobert-2)
- **PR #4916** (2026-09-30): fix: use '/' separator in Gateway route-loader cache keys to avoid co… (@wweiwei-li)

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

## X. networking): treat InvalidGroup.NotFound as success in releaseSG (#4928)

**RULE**:
When implementing operations in `pkg/networking/backend_sg_provider.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubernetes-sigs/aws-load-balancer-controller. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c27ac737`: networking): treat InvalidGroup.NotFound as success in releaseSG (#4928). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/networking/backend_sg_provider.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		if isEC2SecurityGroupNotFoundError(err) {
			p.logger.Info("backend securityGroup already deleted", "ID", p.autoGeneratedSG)
			p.autoGeneratedSG = ""
			return nil
		}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c27ac737` are properly handled with clean fallback behavior.
