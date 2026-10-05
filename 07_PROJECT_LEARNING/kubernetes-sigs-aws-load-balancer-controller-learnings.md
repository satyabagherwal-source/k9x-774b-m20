# Forensic Learning Record (Deep Inspection): kubernetes-sigs/aws-load-balancer-controller

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubernetes-sigs-aws-load-balancer-controller-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubernetes-sigs/aws-load-balancer-controller](https://github.com/kubernetes-sigs/aws-load-balancer-controller))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:16:30.027Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubernetes-sigs/aws-load-balancer-controller`
- **Description**: A Kubernetes controller for Elastic Load Balancers
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4333 stars

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

### Core Architecture Module: `pkg/gateway/model/utilities.go`
```
package model

import (
	elbv2model "sigs.k8s.io/aws-load-balancer-controller/v3/pkg/model/elbv2"
	"strings"
)

func isIPv6Supported(ipAddressType elbv2model.IPAddressType) bool {
	switch ipAddressType {
	case elbv2model.IPAddressTypeDualStack, elbv2model.IPAddressTypeDualStackWithoutPublicIPV4:
		return true
	default:
		return false
	}
}

// TODO - Refactor?
func isIPv6CIDR(cidr string) bool {
	return strings.Contains(cidr, ":")
}

```

### Core Architecture Module: `pkg/gateway/routeutils/attachment_helper.go`
```
package routeutils

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
)

// doesResourceAttachToGateway checks if a target resource (route, listenerset) wishes to connect to the gateway.
// this is done by following Gateway API conventions on the parent reference found within target resource.
func doesResourceAttachToGateway(parentRef gwv1.ParentReference, resourceNamespace string, gw gwv1.Gateway) bool {
	// Default for kind is Gateway.
	if parentRef.Kind != nil && *parentRef.Kind != gatewayKind {
		return false
	}

	var namespaceToCompare string

	if parentRef.Namespace != nil {
		namespaceToCompare = string(*parentRef.Namespace)
	} else {
		namespaceToCompare = resourceNamespace
	}

	nameCheck := string(parentRef.Name) == gw.Name
	nsCheck := gw.Namespace == namespaceToCompare
	return nameCheck && nsCheck
}

func doesResourceAllowNamespace(ctx context.Context, fromNamespaces gwv1.FromNamespaces, labelSelector *metav1.LabelSelector, nsSelector namespaceSelector, resourceNamespace string, parentNamespace string) (bool, error) {
	switch fromNamespaces {
	case gwv1.NamespacesFromNone:
		return false, nil
	case gwv1.NamespacesFromSame:
		return parentNamespace == resourceNamespace, nil
	case gwv1.NamespacesFromAll:
		return true, nil
	case gwv1.NamespacesFromSelector:
		if labelSelector == nil {
			return false, nil
		}
		// This should be executed off the client-go cache, hence we do not need to perform local caching.
		namespaces, err := nsSelector.getNamespacesFromSelector(ctx, labelSelector)
		if err != nil {
			return false, err
		}

		if !namespaces.Has(resourceNamespace) {
			return false, nil
		}
		return true, nil
	default:
		// Unclear what to do in this case, we'll just filter out this route.
		return false, nil
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4919** (2026-10-03): **fix: ignore unpermitted cross namespace TCPRoutes in gateway target TGC deletion guard**
  *Symptoms*:   ### Issue  The in-use guard for a Gateway-targeted TargetGroupConfiguration lists TCPRoutes cluster-wide and matches on backendRef name plus resolved namespace alone, with no ReferenceGrant check. A TCPRoute in any namespace can therefore pin the TGC's finalizer indefinitely and leave the TGC's namespace stuck in Terminating, without the consent ReferenceGrant exists to require.  ### Description  The route loader already rejects an unpermitted cross namespace Gateway backendRef at attachment time so no target group is provisioned for it and the guard has nothing to protect.  Added similar cross namespace validation  check to ignore TCPRoutes with no valid grant. Same namespace references are unaffected and still block deletion.  ### Checklist - [x] Added tests that cover your change (if possible) - [ ] Added/modified documentation as required (such as the `README.md`, or the `docs` directory) - [x] Manually tested - [x] Made sure the title of the PR is a good description that can go into the release notes  ### BONUS POINTS checklist: complete for good vibes and maybe prizes?! :exploding_head: - [ ] Backfilled missing tests for code in same general area :tada: - [] Refactored something and made the world a better place :star2: 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/pull/4919?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs) Report :x: Patch coverage is `75.00000%` with `2 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 57.71%. Comparing base ([`2fcd20d`](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/commit/2fcd20de477ea1f383050039cae25223f984ced3?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs)) to head ([`ae29477`](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/commit/ae29477fb955b144ff9c714dadbe5ede111788c9?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs)). :warning: Report is 53 commits behind head on main.  |
  > /lgtm
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4919#" title="Author self-approved">shraddhabang</a>*, *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4919#pullrequestreview-5397815252" title="Approved">wweiwei-li</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/OWNERS)~~ [shraddhabang,wweiwei-li]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!--

- **Issue #4916** (2026-09-30): **fix: use '/' separator in Gateway route-loader cache keys to avoid co…**
  *Symptoms*: …llisions  ### Issue  The route loader built its resource cache key by joining kind, name, and namespace with "-". Since "-" is legal in both Kubernetes names and namespaces, the key is non-injective: HTTPRoute "a" in namespace "b-team" and HTTPRoute "a-b" in namespace "team" both produce "HTTPRoute-a-b-team".  ### Description Switch the separator to "/", which is illegal in Kubernetes names and namespaces, so distinct routes can no longer collide. This matches the existing GetRouteIdentifier pattern and the TargetGroupBinding fix in #4864. Extract the resource cache key into a generateResourceCacheKey helper and apply the same fix to generateRouteDataCacheKey (status-update dedup only, no routing impact). With an injective key the cache can only return the descriptor for the route it belongs to, so no allowedRoutes re-check on the cache-hit path is needed.   ### Checklist - [x ] Added tests that cover your change (if possible) - [ ] Added/modified documentation as required (such as the `README.md`, or the `docs` directory) - [ ] Manually tested - [ x] Made sure the title of the PR is a good description that can go into the release notes  ### BONUS POINTS checklist: complete for good vibes and maybe prizes?! :exploding_head: - [ ] Backfilled missing tests for code in same general area :tada: - [ ] Refactored something and made the world a better place :star2: 
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4916#pullrequestreview-5370866861" title="Approved">shraddhabang</a>*, *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4916#" title="Author self-approved">wweiwei-li</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/OWNERS)~~ [shraddhabang,wweiwei-li]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!--
  > ## [Codecov](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/pull/4916?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 57.68%. Comparing base ([`2fcd20d`](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/commit/2fcd20de477ea1f383050039cae25223f984ced3?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs)) to head ([`13fff66`](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/commit/13fff6683c4bf17786cecb7f6c15bdbe04947691?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs)). :warning: Report is 48 commits behind head on main.  <details><summary>Additio

- **Issue #4912** (2026-09-22): **chore: OIDC permission messaging**
  *Symptoms*: Adds some clarification on how OIDC secret permissions work. 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/pull/4912?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 57.48%. Comparing base ([`2fcd20d`](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/commit/2fcd20de477ea1f383050039cae25223f984ced3?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs)) to head ([`747085c`](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/commit/747085c97b924a96a6276226ccc98973257d148d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs)). :warning: Report is 31 commits behind head on main.  <details><summary>Additio
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4912#pullrequestreview-5283955380" title="LGTM">shraddhabang</a>*, *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4912#" title="Author self-approved">zac-nixon</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/OWNERS)~~ [shraddhabang,zac-nixon]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META=

- **Issue #4911** (2026-09-23): **test: default GRPC/UDP images to public ECR to fix the tests**
  *Symptoms*:   ### Description  Default gateway gRPC/UDP e2e images to public ECR; --resolve-image-tags switches to the private mirror + resolver for partitions.  ### Checklist - [ ] Added tests that cover your change (if possible) - [ ] Added/modified documentation as required (such as the `README.md`, or the `docs` directory) - [x] Manually tested - [ ] Made sure the title of the PR is a good description that can go into the release notes  ### BONUS POINTS checklist: complete for good vibes and maybe prizes?! :exploding_head: - [ ] Backfilled missing tests for code in same general area :tada: - [ ] Refactored something and made the world a better place :star2: 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/pull/4911?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 57.48%. Comparing base ([`2fcd20d`](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/commit/2fcd20de477ea1f383050039cae25223f984ced3?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs)) to head ([`07156c4`](https://app.codecov.io/gh/kubernetes-sigs/aws-load-balancer-controller/commit/07156c4efaad78686010c069d03041557077c3ba?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=kubernetes-sigs)). :warning: Report is 32 commits behind head on main.  <details><summary>Additio
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4911#" title="Author self-approved">shraddhabang</a>*, *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4911#pullrequestreview-5284969584" title="Approved">wweiwei-li</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/OWNERS)~~ [shraddhabang,wweiwei-li]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!--
  > /lgtm

- **Issue #4909** (2026-09-24): **Fix TGB networking with empty ports**
  *Symptoms*: ### Issue  Fixes #4907  ### Description  Fixes TargetGroupBinding networking rules with an empty or unspecified `ports` list.  The API defines an empty `ports` list as allowing all TCP ports, but `computeIngressPermissionsForTGBNetworking` accidentally shadows the accumulated `permissions` variable in this path. The computed permission is therefore discarded and no security group rule is returned.  This change:  * avoids shadowing the outer permissions accumulator; * appends the computed all-TCP permission to the result; * adds regression coverage verifying that an empty ports list produces a TCP permission for ports `0-65535`.  The regression test fails on the previous implementation because it returns no permissions for the empty-ports case.  Validation:  * `go test -race ./pkg/networking/... -run Test_defaultNetworkingManager_computeIngressPermissionsForTGBNetworking -count=1 -v` * `go test ./pkg/networking/...` * `go vet ./pkg/networking/...` * `make fast-unit-test` * `git diff --check`  ### Checklist  * [x] Added tests that cover your change (if possible) * [x] Added/modified documentation as required (such as the `README.md`, or the `docs` directory) * [ ] Manually tested * [x] Made sure the title of the PR is a good description that can go into the release notes  ### BONUS POINTS checklist: complete for good vibes and maybe prizes?! :exploding_head:  * [x] Backfilled missing tests for code in same general area :tada: * [ ] Refactored
  **Post-Mortem & Fix Analysis**:
  > Welcome @dlanov! <br><br>It looks like this is your first PR to <a href='https://github.com/kubernetes-sigs/aws-load-balancer-controller'>kubernetes-sigs/aws-load-balancer-controller</a> 🎉. Please refer to our [pull request process documentation](https://www.kubernetes.dev/docs/guide/pull-requests/) to help your PR have a smooth ride to approval. <br><br>You will be prompted by a bot to use commands during the review process. Do not be afraid to follow the prompts! It is okay to experiment. [Here is the bot commands documentation](https://go.k8s.io/bot-commands). <br><br>You can also check if kubernetes-sigs/aws-load-balancer-controller has [its own contribution guidelines](https://github.com/kubernetes-sigs/aws-load-balancer-controller/tree/master/CONTRIBUTING.md). <br><br>You may want to refer to our [testing guide](https://git.k8s.io/community/contributors/devel/sig-testing/testing.md) if you run into trouble with your tests not passing. <br><br>If you are having difficulty getting
  > Hi @dlanov. Thanks for your PR.  I'm waiting for a [kubernetes-sigs](https://github.com/orgs/kubernetes-sigs/people) member to verify that this patch is reasonable to test. If it is, they should reply with `/ok-to-test` on its own line. Until that is done, I will not automatically test new commits in this PR, but the usual testing commands by org members will still work.  >[!TIP] >**We noticed you've done this a few times! Consider [joining the org](https://git.k8s.io/community/community-membership.md#member) to skip this step and gain `/lgtm` and other bot rights.** We recommend asking approvers on your previous PRs to sponsor you.  Once the patch is verified, the new status will be reflected by the `ok-to-test` label.  I understand the commands that are listed [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide
  > Up load API

- **Issue #4908** (2026-09-17): **test/gateway: make e2e suite partition-aware and register ECR tag resolver**
  *Symptoms*:  ### Issue  E2e tests break in non commercial partitions due to test images  <!-- Please link the GitHub issues related to this PR, if available -->  ### Description  <!-- Please explain the changes you made here.  Help your reviewers by guiding them through your key changes, implementation decisions etc. You can even include snippets of output or screenshots.  A good, clear description == a faster review :) --> - Prefix UDP/GRPC pod images with test-image-registry  - Derive TestHostname wildcard from region + partition DNS suffix; expose image   constants as vars so downstream forks can override - Add opt-in --resolve-image-tags flag with an ECR-backed manifest.ImageResolver   that reassigns image vars to newest multi-arch versioned tags (non-ADC ECRs   don't replicate :latest)  Manually ran a few e2e tests - PASS  ``` > kubectl get gateways -A -w NAMESPACE                             NAME          CLASS                    ADDRESS                                                                          nlb-gateway-tcp-udp-quic-e2e-a29213   gateway-e2e   gwclass-e2e-nlb-ae119f   k8s-nlbgatew-gatewaye-cc2a9ff6b9-2a1276ac4e420dff.elb.us-west-2.amazonaws.com   True         4m5s ```  ### Checklist - [ ] Added tests that cover your change (if possible) - [ ] Added/modified documentation as required (such as the `README.md`, or the `docs` directory) - [x] Manually tested - [ ] Made sure the title of the PR is a good description that can go into 
  **Post-Mortem & Fix Analysis**:
  > Hi @jupdec. Thanks for your PR.  I'm waiting for a [kubernetes-sigs](https://github.com/orgs/kubernetes-sigs/people) member to verify that this patch is reasonable to test. If it is, they should reply with `/ok-to-test` on its own line. Until that is done, I will not automatically test new commits in this PR, but the usual testing commands by org members will still work.  >[!TIP] >**We noticed you've done this a few times! Consider [joining the org](https://git.k8s.io/community/community-membership.md#member) to skip this step and gain `/lgtm` and other bot rights.** We recommend asking approvers on your previous PRs to sponsor you.  Once the patch is verified, the new status will be reflected by the `ok-to-test` label.  I understand the commands that are listed [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/guide
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4908#" title="Author self-approved">jupdec</a>*, *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4908#pullrequestreview-5242018437" title="LGTM">shraddhabang</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/OWNERS)~~ [shraddhabang]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":

- **Issue #4907** (2026-09-24): **If len(rule.Ports) == 0, the result of computeIngressPermissionsForTGBNetworking is not used, causing missing SGR**
  *Symptoms*: **Bug Description**  https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/pkg/networking/networking_manager.go#L403  This line shadows `permissions`, unlike in the `range.rulePorts` branch, which has the effect that if no port is set, no rule is created, when the intended behaviour is for a rule to be created with ports 0-65535.     **Steps to Reproduce**  Create a TGB like this, replacing the TG and SG values as required.  ``` apiVersion: elbv2.k8s.aws/v1beta1 kind: TargetGroupBinding metadata:   name: repro   namespace: tgb-repro spec:   targetType: ip   serviceRef: {name: repro, port: 8080}   targetGroupARN: <TG_ARN>   networking:     ingress:       - from:           - securityGroup:               groupID: <SRC_SG>         ports: []                                                        # <----- the relevant line --- apiVersion: v1 kind: Pod metadata:   name: app   namespace: tgb-repro   labels: {app: repro} spec:   containers:     - name: pause       image: registry.k8s.io/pause:3.9 --- apiVersion: v1 kind: Service metadata:   name: repro   namespace: tgb-repro spec:   selector: {app: repro}   ports: [{port: 8080, targetPort: 8080}] ```   **Expected Behavior**  An ingress rule on the pod ENI's security group, 0-65535 TCP from the SG given in the TGB.  **Actual Behavior**  Succesful reconcile, no security group rule created.  **Regression** Was the functionality working correctly in a previous version ? [Yes / No] If yes, specify the last version where
  **Post-Mortem & Fix Analysis**:
  > I'm working on this. I'll add regression coverage for TGB networking rules with an empty ports list and fix the lost ingress permissions.

- **Issue #4904** (2026-09-22): **fix: canonicalize CIDRs for security group inbound rules to avoid reconciliation failures**
  *Symptoms*: ### Issue  https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/4893  ### Description  Convert security group inbound CIDRs to canonicalized form for ingress, service and gateway. This aligns with how EC2 handles CIDRs in [AuthorizeSecurityGroupIngress API](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_AuthorizeSecurityGroupIngress.html).   From docs >AWS [canonicalizes](https://en.wikipedia.org/wiki/Canonicalization) IPv4 and IPv6 CIDRs. For example, if you specify 100.68.0.18/18 for the CIDR block, AWS canonicalizes the CIDR block to 100.68.0.0/18. Any subsequent DescribeSecurityGroups and DescribeSecurityGroupRules calls will return the canonicalized form of the CIDR block. Additionally, if you attempt to add another rule with the non-canonical form of the CIDR (such as 100.68.0.18/18) and there is already a rule for the canonicalized form of the CIDR block (such as 100.68.0.0/18), the API throws an duplicate rule error.  ### Checklist - [x] Added tests that cover your change (if possible) - [x] Added/modified documentation as required (such as the `README.md`, or the `docs` directory) - [x] Manually tested - [x] Made sure the title of the PR is a good description that can go into the release notes  ### BONUS POINTS checklist: complete for good vibes and maybe prizes?! :exploding_head: - [ ] Backfilled missing tests for code in same general area :tada: - [ ] Refactored something and made the world a better place :star2: 
  **Post-Mortem & Fix Analysis**:
  > Hi @bobert-2. Thanks for your PR.  I'm waiting for a [kubernetes-sigs](https://github.com/orgs/kubernetes-sigs/people) member to verify that this patch is reasonable to test. If it is, they should reply with `/ok-to-test` on its own line. Until that is done, I will not automatically test new commits in this PR, but the usual testing commands by org members will still work.  >[!TIP] >**We noticed you've done this a few times! Consider [joining the org](https://git.k8s.io/community/community-membership.md#member) to skip this step and gain `/lgtm` and other bot rights.** We recommend asking approvers on your previous PRs to sponsor you.  Once the patch is verified, the new status will be reflected by the `ok-to-test` label.  I understand the commands that are listed [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  <details>  Instructions for interacting with me using PR comments are available [here](https://git.k8s.io/community/contributors/gui
  > /lgtm /approved
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4904#" title="Author self-approved">bobert-2</a>*, *<a href="https://github.com/kubernetes-sigs/aws-load-balancer-controller/pull/4904#pullrequestreview-5270649981" title="Approved">wweiwei-li</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=kubernetes-sigs%2Faws-load-balancer-controller).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/OWNERS)~~ [wweiwei-li]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers

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

### Incident Patch 1: `ba14bc87` (2026-10-03)
**Commit Message**: Merge pull request #4919 from shraddhabang/fix/tgc-gateway-guard-reference-grant

fix: ignore unpermitted cross namespace TCPRoutes in gateway target TGC deletion guard

**File**: `controllers/gateway/targetgroup_configuration_controller.go` (modified, +14/-0)
```diff
@@ -17,7 +17,9 @@ import (
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/constants"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/gatewayutils"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/referencecounter"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/routeutils"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/k8s"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/shared_utils"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/controller"
@@ -29,6 +31,7 @@ import (
 
 const (
 	targetReferenceKindGateway = "Gateway"
+	gatewayAPIGroup            = "gateway.networking.k8s.io"
 )
 
 // NewTargetGroupConfigurationReconciler constructs a reconciler that responds to targetgroup configuration changes
@@ -214,6 +217,17 @@ func (r *targetgroupConfigurationReconciler) isGatewayTargetTGCInUse(ctx context
 
 	inUseRoutes := make([]string, 0)
 	for _, route := range eventhandlers.GetImpactedTCPRoutes(tcpRouteList, tgConf) {
+		if route.Namespace != tgConf.Namespace {
+			allowed, err := shared_utils.ValidateCrossNamespaceReference(ctx, r.k8sClient, route.Namespace, gatewayAPIGroup, string(routeutils.TCPRouteKind), gatewayAPIGroup, targetReferenceKindGateway, tgConf.Namespace, tgConf.Spec.TargetReference.Name)
+			if err != nil {
+				return "", err
+			}
+			if !allowed {
+				r.logger.V(1).Info("ignoring tcproute with cross namespace reference that no ReferenceGrant permits",
+					"targetgroupconfiguration", k8s.NamespacedName(tgConf), "tcproute", k8s.NamespacedName(route))
+				continue
+			}
+		}
 		inUseRoutes = append(inUseRoutes, k8s.NamespacedName(route).String())
 	}
 
```

**File**: `controllers/gateway/targetgroup_configuration_controller_test.go` (modified, +159/-0)
```diff
@@ -4,11 +4,13 @@ import (
 	"context"
 	"testing"
 
+	awssdk "github.com/aws/aws-sdk-go-v2/aws"
 	"github.com/go-logr/logr"
 	"github.com/golang/mock/gomock"
 	"github.com/stretchr/testify/assert"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	elbv2gw "sigs.k8s.io/aws-load-balancer-controller/v3/apis/gateway/v1"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/routeutils"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/k8s"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/testutils"
 	"sigs.k8s.io/controller-runtime/pkg/client"
@@ -126,3 +128,160 @@ func TestTargetGroupConfigurationReconciler_handleDelete_GatewayTargetNotInUse(t
 	err := r.handleDelete(tgConf)
 	assert.NoError(t, err)
 }
+
+func crossNamespaceGatewayTGCFixtures() (*elbv2gw.TargetGroupConfiguration, *gwv1.TCPRoute) {
+	targetKind := targetReferenceKindGateway
+	tgConf := &elbv2gw.TargetGroupConfiguration{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:       "gateway-tgc",
+			Namespace:  "alb-ns",
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
+	routeKind := gwv1.Kind(targetReferenceKindGateway)
+	backendNamespace := gwv1.Namespace("alb-ns")
+	route := &gwv1.TCPRoute{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "tcp-route",
+			Namespace: "nlb-ns",
+		},
+		Spec: gwv1.TCPRouteSpec{
+			Rules: []gwv1.TCPRouteRule{
+				{
+					BackendRefs: []gwv1.BackendRef{
+						{
+							BackendObjectReference: gwv1.BackendObjectReference{
+								Name:      "chained-gateway",
+								Kind:      &routeKind,
+								Namespace: &backendNamespace,
+							},
+						},
+					},
+				},
+			},
+		},
+	}
+	return tgConf, route
+}
+
+// A TCPRoute in another namespace that no ReferenceGrant permits provisions nothing, so it must not
+// keep the finalizer. Otherwise any namespace could block deletion of this TGC and its namespace.
+func TestTargetGroupConfigurationReconciler_handleDelete_GatewayTargetCrossNamespaceWithoutReferenceGrant(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
+	k8sClient := testutils.GenerateTestClient()
+	finalizerManager := k8s.NewMockFinalizerManager(ctrl)
+
+	tgConf, route := crossNamespaceGatewayTGCFixtures()
+	assert.NoError(t, k8sClient.Create(context.Background(), tgConf))
+	assert.NoError(t, k8sClient.Create(context.Background(), route))
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
+
+// With a permitting ReferenceGrant the reference is effective, so deletion must still be blocked.
+func TestTargetGroupConfigurationReconciler_handleDelete_GatewayTargetCrossNamespaceWithReferenceGrant(t *testing.T) {
+	for _, tt := range []struct {
+		name    string
+		toName  *gwv1.ObjectName
+		blocked bool
+	}{
+		{
+			name:    "grant naming the gateway",
+			toName:  (*gwv1.ObjectName)(awssdk.String("chained-gateway")),
+			blocked: true,
+		},
+		{
+			name:    "grant with no name acts as a wildcard",
+			toName:  nil,
+			blocked: true,
+		},
+		{
+			name:    "grant naming a different gateway does not apply",
+			toName:  (*gwv1.ObjectName)(awssdk.String("other-gateway")),
+			blocked: false,
+		},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			ctrl := gomock.NewController(t)
+			defer ctrl.Finish()
+
+			k8sClient := testutils.GenerateTestClient()
+			finalizerManager := k8s.NewMockFinalizerManager(ctrl)
+
+			tgConf, route := crossNamespaceGatewayTGCFixtures()
+			grant := &gwv1.ReferenceGrant{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:      "allow-nlb-ns",
+					Namespace: "alb-ns",
+				},
+				Spec: gwv1.ReferenceGrantSpec{
+					From: []gwv1.ReferenceGrantFrom{
+						{
+							Group:     gatewayAPIGroup,
+							Kind:      gwv1.Kind(routeutils.TCPRouteKind),
+							Namespace: "nlb-ns",
+						},
+					},
+					To: []gwv1.ReferenceGrantTo{
+						{
+							Group: gatewayAPIGroup,
+							Kind:  targetReferenceKindGateway,
+							Name:  tt.toName,
+						},
+					},
+				},
+			}
+
+			assert.NoError(t, k8sClient.Create(context.Background(), tgConf))
+			assert.NoError(t, k8sClient.Create(context.Background(), route))
+			assert.NoError(t, k8sClient.Create(context.Background(), grant))
+
+			if !tt.blocked {
+				finalizerManager.EXPECT().
+					RemoveFinalizers(context.Background(), tgConf, testTargetGroupConfigurationFinalizer).
+					Return(nil)
+			}
+
+			r := &targetgroupConfigurationRe
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ require (
 	k8s.io/kubectl v0.36.2 // indirect
 	k8s.io/streaming v0.36.2 // indirect
 	moul.io/http2curl/v2 v2.3.0 // indirect
-	oras.land/oras-go/v2 v2.6.1 // indirect
+	oras.land/oras-go/v2 v2.6.2 // indirect
 	sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 // indirect
 	sigs.k8s.io/kustomize/api v0.21.1 // indirect
 	sigs.k8s.io/kustomize/kyaml v0.21.1 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -663,8 +663,8 @@ k8s.io/utils v0.0.0-20260319190234-28399d86e0b5 h1:kBawHLSnx/mYHmRnNUf9d4CpjREbe
 k8s.io/utils v0.0.0-20260319190234-28399d86e0b5/go.mod h1:xDxuJ0whA3d0I4mf/C4ppKHxXynQ+fxnkmQH0vTHnuk=
 moul.io/http2curl/v2 v2.3.0 h1:9r3JfDzWPcbIklMOs2TnIFzDYvfAZvjeavG6EzP7jYs=
 moul.io/http2curl/v2 v2.3.0/go.mod h1:RW4hyBjTWSYDOxapodpNEtX0g5Eb16sxklBqmd2RHcE=
-oras.land/oras-go/v2 v2.6.1 h1:bonOEkjLfp8tt6qXWRRWP6p1F+9octchOf2EqnWB4Zs=
-oras.land/oras-go/v2 v2.6.1/go.mod h1:dhtFrFOuZuDtAVeZ9FUnaa5zfzplG3ZnFX9/uH1J/Yk=
+oras.land/oras-go/v2 v2.6.2 h1:N04RXngAp1LJKTG6ifz3xHPipasEkWr+hFmInja5YKo=
+oras.land/oras-go/v2 v2.6.2/go.mod h1:PlTtg4JTDJkDe8yVHpM2wz7/YDc00GVas+i4jAW2TZ4=
 sigs.k8s.io/controller-runtime v0.24.1 h1:miPEwrmirImAvgME1L9qebGHrOnGJoVmVdtOU9fRfo4=
 sigs.k8s.io/controller-runtime v0.24.1/go.mod h1:vFkfY5fGt5xAC/sKb8IBFKgWPNKG9OUG29dR8Y2wImw=
 sigs.k8s.io/gateway-api v1.6.0 h1:735YBRj5NXFrOGX0GoSjwzUIzbz8kiEOfADsqHFmHgE=
```

---

### Incident Patch 2: `ae29477f` (2026-10-02)
**Commit Message**: fix: ignore unpermitted cross namespace TCPRoutes in gateway target TGC deletion guard

**File**: `controllers/gateway/targetgroup_configuration_controller.go` (modified, +14/-0)
```diff
@@ -17,7 +17,9 @@ import (
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/constants"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/gatewayutils"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/referencecounter"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/routeutils"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/k8s"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/shared_utils"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/controller"
@@ -29,6 +31,7 @@ import (
 
 const (
 	targetReferenceKindGateway = "Gateway"
+	gatewayAPIGroup            = "gateway.networking.k8s.io"
 )
 
 // NewTargetGroupConfigurationReconciler constructs a reconciler that responds to targetgroup configuration changes
@@ -214,6 +217,17 @@ func (r *targetgroupConfigurationReconciler) isGatewayTargetTGCInUse(ctx context
 
 	inUseRoutes := make([]string, 0)
 	for _, route := range eventhandlers.GetImpactedTCPRoutes(tcpRouteList, tgConf) {
+		if route.Namespace != tgConf.Namespace {
+			allowed, err := shared_utils.ValidateCrossNamespaceReference(ctx, r.k8sClient, route.Namespace, gatewayAPIGroup, string(routeutils.TCPRouteKind), gatewayAPIGroup, targetReferenceKindGateway, tgConf.Namespace, tgConf.Spec.TargetReference.Name)
+			if err != nil {
+				return "", err
+			}
+			if !allowed {
+				r.logger.V(1).Info("ignoring tcproute with cross namespace reference that no ReferenceGrant permits",
+					"targetgroupconfiguration", k8s.NamespacedName(tgConf), "tcproute", k8s.NamespacedName(route))
+				continue
+			}
+		}
 		inUseRoutes = append(inUseRoutes, k8s.NamespacedName(route).String())
 	}
 
```

**File**: `controllers/gateway/targetgroup_configuration_controller_test.go` (modified, +159/-0)
```diff
@@ -4,11 +4,13 @@ import (
 	"context"
 	"testing"
 
+	awssdk "github.com/aws/aws-sdk-go-v2/aws"
 	"github.com/go-logr/logr"
 	"github.com/golang/mock/gomock"
 	"github.com/stretchr/testify/assert"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	elbv2gw "sigs.k8s.io/aws-load-balancer-controller/v3/apis/gateway/v1"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/gateway/routeutils"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/k8s"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/testutils"
 	"sigs.k8s.io/controller-runtime/pkg/client"
@@ -126,3 +128,160 @@ func TestTargetGroupConfigurationReconciler_handleDelete_GatewayTargetNotInUse(t
 	err := r.handleDelete(tgConf)
 	assert.NoError(t, err)
 }
+
+func crossNamespaceGatewayTGCFixtures() (*elbv2gw.TargetGroupConfiguration, *gwv1.TCPRoute) {
+	targetKind := targetReferenceKindGateway
+	tgConf := &elbv2gw.TargetGroupConfiguration{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:       "gateway-tgc",
+			Namespace:  "alb-ns",
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
+	routeKind := gwv1.Kind(targetReferenceKindGateway)
+	backendNamespace := gwv1.Namespace("alb-ns")
+	route := &gwv1.TCPRoute{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "tcp-route",
+			Namespace: "nlb-ns",
+		},
+		Spec: gwv1.TCPRouteSpec{
+			Rules: []gwv1.TCPRouteRule{
+				{
+					BackendRefs: []gwv1.BackendRef{
+						{
+							BackendObjectReference: gwv1.BackendObjectReference{
+								Name:      "chained-gateway",
+								Kind:      &routeKind,
+								Namespace: &backendNamespace,
+							},
+						},
+					},
+				},
+			},
+		},
+	}
+	return tgConf, route
+}
+
+// A TCPRoute in another namespace that no ReferenceGrant permits provisions nothing, so it must not
+// keep the finalizer. Otherwise any namespace could block deletion of this TGC and its namespace.
+func TestTargetGroupConfigurationReconciler_handleDelete_GatewayTargetCrossNamespaceWithoutReferenceGrant(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
+	k8sClient := testutils.GenerateTestClient()
+	finalizerManager := k8s.NewMockFinalizerManager(ctrl)
+
+	tgConf, route := crossNamespaceGatewayTGCFixtures()
+	assert.NoError(t, k8sClient.Create(context.Background(), tgConf))
+	assert.NoError(t, k8sClient.Create(context.Background(), route))
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
+
+// With a permitting ReferenceGrant the reference is effective, so deletion must still be blocked.
+func TestTargetGroupConfigurationReconciler_handleDelete_GatewayTargetCrossNamespaceWithReferenceGrant(t *testing.T) {
+	for _, tt := range []struct {
+		name    string
+		toName  *gwv1.ObjectName
+		blocked bool
+	}{
+		{
+			name:    "grant naming the gateway",
+			toName:  (*gwv1.ObjectName)(awssdk.String("chained-gateway")),
+			blocked: true,
+		},
+		{
+			name:    "grant with no name acts as a wildcard",
+			toName:  nil,
+			blocked: true,
+		},
+		{
+			name:    "grant naming a different gateway does not apply",
+			toName:  (*gwv1.ObjectName)(awssdk.String("other-gateway")),
+			blocked: false,
+		},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			ctrl := gomock.NewController(t)
+			defer ctrl.Finish()
+
+			k8sClient := testutils.GenerateTestClient()
+			finalizerManager := k8s.NewMockFinalizerManager(ctrl)
+
+			tgConf, route := crossNamespaceGatewayTGCFixtures()
+			grant := &gwv1.ReferenceGrant{
+				ObjectMeta: metav1.ObjectMeta{
+					Name:      "allow-nlb-ns",
+					Namespace: "alb-ns",
+				},
+				Spec: gwv1.ReferenceGrantSpec{
+					From: []gwv1.ReferenceGrantFrom{
+						{
+							Group:     gatewayAPIGroup,
+							Kind:      gwv1.Kind(routeutils.TCPRouteKind),
+							Namespace: "nlb-ns",
+						},
+					},
+					To: []gwv1.ReferenceGrantTo{
+						{
+							Group: gatewayAPIGroup,
+							Kind:  targetReferenceKindGateway,
+							Name:  tt.toName,
+						},
+					},
+				},
+			}
+
+			assert.NoError(t, k8sClient.Create(context.Background(), tgConf))
+			assert.NoError(t, k8sClient.Create(context.Background(), route))
+			assert.NoError(t, k8sClient.Create(context.Background(), grant))
+
+			if !tt.blocked {
+				finalizerManager.EXPECT().
+					RemoveFinalizers(context.Background(), tgConf, testTargetGroupConfigurationFinalizer).
+					Return(nil)
+			}
+
+			r := &targetgroupConfigurationRe
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ require (
 	k8s.io/kubectl v0.36.2 // indirect
 	k8s.io/streaming v0.36.2 // indirect
 	moul.io/http2curl/v2 v2.3.0 // indirect
-	oras.land/oras-go/v2 v2.6.1 // indirect
+	oras.land/oras-go/v2 v2.6.2 // indirect
 	sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 // indirect
 	sigs.k8s.io/kustomize/api v0.21.1 // indirect
 	sigs.k8s.io/kustomize/kyaml v0.21.1 // indirect
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -663,8 +663,8 @@ k8s.io/utils v0.0.0-20260319190234-28399d86e0b5 h1:kBawHLSnx/mYHmRnNUf9d4CpjREbe
 k8s.io/utils v0.0.0-20260319190234-28399d86e0b5/go.mod h1:xDxuJ0whA3d0I4mf/C4ppKHxXynQ+fxnkmQH0vTHnuk=
 moul.io/http2curl/v2 v2.3.0 h1:9r3JfDzWPcbIklMOs2TnIFzDYvfAZvjeavG6EzP7jYs=
 moul.io/http2curl/v2 v2.3.0/go.mod h1:RW4hyBjTWSYDOxapodpNEtX0g5Eb16sxklBqmd2RHcE=
-oras.land/oras-go/v2 v2.6.1 h1:bonOEkjLfp8tt6qXWRRWP6p1F+9octchOf2EqnWB4Zs=
-oras.land/oras-go/v2 v2.6.1/go.mod h1:dhtFrFOuZuDtAVeZ9FUnaa5zfzplG3ZnFX9/uH1J/Yk=
+oras.land/oras-go/v2 v2.6.2 h1:N04RXngAp1LJKTG6ifz3xHPipasEkWr+hFmInja5YKo=
+oras.land/oras-go/v2 v2.6.2/go.mod h1:PlTtg4JTDJkDe8yVHpM2wz7/YDc00GVas+i4jAW2TZ4=
 sigs.k8s.io/controller-runtime v0.24.1 h1:miPEwrmirImAvgME1L9qebGHrOnGJoVmVdtOU9fRfo4=
 sigs.k8s.io/controller-runtime v0.24.1/go.mod h1:vFkfY5fGt5xAC/sKb8IBFKgWPNKG9OUG29dR8Y2wImw=
 sigs.k8s.io/gateway-api v1.6.0 h1:735YBRj5NXFrOGX0GoSjwzUIzbz8kiEOfADsqHFmHgE=
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

---

### Incident Patch 4: `0658e1f8` (2026-10-01)
**Commit Message**: Merge pull request #4847 from niv1612/acm-fix-upstream

fix: use public Route 53 zone for Amazon-issued ACM DNS validation in split-horizon DNS

**File**: `docs/guide/ingress/certificate_management.md` (modified, +3/-1)
```diff
@@ -35,9 +35,11 @@ This reconciliation might fail if there are no certificates present to autodisco
 ### Certificate Validation
 
 Amazon Issued certificates are currently validated using DNS Method and Route53 records. Validation can take [up to 30 minutes](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html). 
-E-Mail validation is not supported due to significant higher delays between requesting a certificate and it's issuance. 
+E-Mail validation is not supported due to significant higher delays between requesting a certificate and its issuance. 
 When using a PCA, certificates don't have to be validated.
 
+Because ACM validates Amazon-issued certificates over **public** DNS, the controller writes the validation record into the nearest-ancestor **public** Route53 hosted zone. In split-horizon setups (a private zone that is a subdomain of a public zone), the private zone is skipped so the record lands where ACM can resolve it. If no public hosted zone matches the domain (private-only domain, or the public parent lives in an account the controller can't see), the controller fails fast. In that case, pre-create the certificate yourself and reference it with the [`certificate-arn`](annotations.md#certificate-arn) annotation.
+
 ## Ingress Group Behavior
 
 When using certificate management with [IngressGroups](ingress_class.md#specgroup), each ingress in the group gets its own certificate based on its own hostnames. All certificates are attached to the shared ALB's HTTPS listener.
```

**File**: `pkg/aws/services/route53.go` (modified, +30/-5)
```diff
@@ -22,6 +22,7 @@ const (
 type Route53 interface {
 	ChangeRecordsWithContext(ctx context.Context, input *route53.ChangeResourceRecordSetsInput) (*route53.ChangeResourceRecordSetsOutput, error)
 	GetHostedZoneID(ctx context.Context, domain string) (*string, error)
+	GetPublicHostedZoneID(ctx context.Context, domain string) (*string, error)
 }
 
 func NewRoute53(awsClientsProvider provider.AWSClientsProvider) Route53 {
@@ -57,11 +58,39 @@ func (c *route53Client) GetHostedZoneID(ctx context.Context, domain string) (*st
 		return nil, err
 	}
 
+	if bestID := findHostedZoneID(zones, domain, false); bestID != nil {
+		return bestID, nil
+	}
+
+	return nil, fmt.Errorf("no hosted zone found for validation records")
+}
+
+// GetPublicHostedZoneID skips private zones: Amazon-issued ACM certificates are
+// validated over public DNS, so a validation record in a private zone (e.g. the
+// most-specific match in split-horizon Route 53) leaves the cert in PENDING_VALIDATION.
+func (c *route53Client) GetPublicHostedZoneID(ctx context.Context, domain string) (*string, error) {
+	zones, err := c.listHostedZones(ctx)
+	if err != nil {
+		return nil, err
+	}
+
+	if bestID := findHostedZoneID(zones, domain, true); bestID != nil {
+		return bestID, nil
+	}
+
+	return nil, fmt.Errorf("no public Route 53 hosted zone found for %q", domain)
+}
+
+// findHostedZoneID returns the nearest-ancestor hosted zone (longest matching suffix).
+func findHostedZoneID(zones []types.HostedZone, domain string, publicOnly bool) *string {
 	recParts := strings.Split(domain, ".")
 
 	var bestID *string
 	bestLen := -1
 	for _, zone := range zones {
+		if publicOnly && zone.Config != nil && zone.Config.PrivateZone {
+			continue
+		}
 		zoneParts := strings.Split(strings.TrimRight(*zone.Name, "."), ".")
 		if len(zoneParts) > len(recParts) {
 			continue
@@ -72,11 +101,7 @@ func (c *route53Client) GetHostedZoneID(ctx context.Context, domain string) (*st
 		}
 	}
 
-	if bestID != nil {
-		return bestID, nil
-	}
-
-	return nil, fmt.Errorf("no hosted zone found for validation records")
+	return bestID
 }
 
 func (c *route53Client) listHostedZones(ctx context.Context) ([]types.HostedZone, error) {
```

**File**: `pkg/aws/services/route53_mocks.go` (modified, +15/-0)
```diff
@@ -64,3 +64,18 @@ func (mr *MockRoute53MockRecorder) GetHostedZoneID(arg0, arg1 interface{}) *gomo
 	mr.mock.ctrl.T.Helper()
 	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetHostedZoneID", reflect.TypeOf((*MockRoute53)(nil).GetHostedZoneID), arg0, arg1)
 }
+
+// GetPublicHostedZoneID mocks base method.
+func (m *MockRoute53) GetPublicHostedZoneID(arg0 context.Context, arg1 string) (*string, error) {
+	m.ctrl.T.Helper()
+	ret := m.ctrl.Call(m, "GetPublicHostedZoneID", arg0, arg1)
+	ret0, _ := ret[0].(*string)
+	ret1, _ := ret[1].(error)
+	return ret0, ret1
+}
+
+// GetPublicHostedZoneID indicates an expected call of GetPublicHostedZoneID.
+func (mr *MockRoute53MockRecorder) GetPublicHostedZoneID(arg0, arg1 interface{}) *gomock.Call {
+	mr.mock.ctrl.T.Helper()
+	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetPublicHostedZoneID", reflect.TypeOf((*MockRoute53)(nil).GetPublicHostedZoneID), arg0, arg1)
+}
```

**File**: `pkg/aws/services/route53_test.go` (modified, +70/-0)
```diff
@@ -24,6 +24,14 @@ func hostedZone(id, name string) types.HostedZone {
 	return types.HostedZone{Id: awssdk.String(id), Name: awssdk.String(name)}
 }
 
+func privateHostedZone(id, name string) types.HostedZone {
+	return types.HostedZone{
+		Id:     awssdk.String(id),
+		Name:   awssdk.String(name),
+		Config: &types.HostedZoneConfig{PrivateZone: true},
+	}
+}
+
 func TestGetHostedZoneID(t *testing.T) {
 	tests := []struct {
 		name   string
@@ -63,3 +71,65 @@ func TestGetHostedZoneID(t *testing.T) {
 		})
 	}
 }
+
+func TestGetPublicHostedZoneID(t *testing.T) {
+	tests := []struct {
+		name    string
+		domain  string
+		zones   []types.HostedZone
+		want    string
+		wantErr bool
+	}{
+		{
+			name:   "split-horizon: public chosen even though private zone is more specific",
+			domain: "app.sub.example.com",
+			zones: []types.HostedZone{
+				hostedZone("Z_PUBLIC", "example.com."),
+				privateHostedZone("Z_PRIVATE", "sub.example.com."),
+			},
+			want: "Z_PUBLIC",
+		},
+		{
+			name:   "only a private zone matches: fail fast",
+			domain: "app.sub.example.com",
+			zones: []types.HostedZone{
+				privateHostedZone("Z_PRIVATE", "sub.example.com."),
+			},
+			wantErr: true,
+		},
+		{
+			name:   "multiple public zones match: longest suffix wins",
+			domain: "*.app.sub.example.com",
+			zones: []types.HostedZone{
+				hostedZone("Z_PARENT", "example.com."),
+				hostedZone("Z_SUB", "sub.example.com."),
+			},
+			want: "Z_SUB",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			c := newCachedRoute53Client(tt.zones)
+			got, err := c.GetPublicHostedZoneID(context.Background(), tt.domain)
+			if tt.wantErr {
+				assert.Error(t, err)
+				return
+			}
+			assert.NoError(t, err)
+			assert.Equal(t, tt.want, awssdk.ToString(got))
+		})
+	}
+}
+
+// The unfiltered lookup (delete path) must still resolve private zones so legacy
+// records written there can be cleaned up.
+func TestGetHostedZoneID_UnfilteredReturnsPrivate(t *testing.T) {
+	c := newCachedRoute53Client([]types.HostedZone{
+		hostedZone("Z_PUBLIC", "example.com."),
+		privateHostedZone("Z_PRIVATE", "sub.example.com."),
+	})
+	got, err := c.GetHostedZoneID(context.Background(), "app.sub.example.com")
+	assert.NoError(t, err)
+	assert.Equal(t, "Z_PRIVATE", awssdk.ToString(got))
+}
```

**File**: `pkg/deploy/acm/certificate_manager.go` (modified, +45/-27)
```diff
@@ -83,7 +83,7 @@ func (c *defaultCertificateManager) CreateWithValidationRecords(ctx context.Cont
 		if _, checked := hostedZoneByDomain[host]; checked {
 			continue
 		}
-		zoneID, err := c.route53Client.GetHostedZoneID(ctx, host)
+		zoneID, err := c.route53Client.GetPublicHostedZoneID(ctx, host)
 		if err != nil {
 			return nil, fmt.Errorf("pre-check failed for domain %q: %w", host, err)
 		}
@@ -226,6 +226,12 @@ func (c *defaultCertificateManager) DeleteWithValidationRecords(ctx context.Cont
 
 	for _, opts := range desc.Certificate.DomainValidationOptions {
 		if opts.ValidationMethod == acmtypes.ValidationMethodDns {
+			if opts.ResourceRecord == nil {
+				// ACM populates ResourceRecord asynchronously; a certificate deleted right
+				// after creation may not have one yet, so there is no record to clean up.
+				c.logger.Info("no resource record on validation option, skipping validation record cleanup", "domain", awssdk.ToString(opts.DomainName))
+				continue
+			}
 			c.logger.Info("deleting validation records for certificate", "certificateARN", arn)
 			id, err := c.route53Client.GetHostedZoneID(ctx, awssdk.ToString(opts.DomainName))
 			if err != nil {
@@ -237,37 +243,49 @@ func (c *defaultCertificateManager) DeleteWithValidationRecords(ctx context.Cont
 				}
 				return err
 			}
-			input := &route53sdk.ChangeResourceRecordSetsInput{
-				HostedZoneId: id,
-				ChangeBatch: &route53types.ChangeBatch{
-					Changes: []route53types.Change{
-						{
-							Action: "DELETE",
-							ResourceRecordSet: &route53types.ResourceRecordSet{
-								Name: opts.ResourceRecord.Name,
-								Type: route53types.RRType(opts.ResourceRecord.Type),
-								TTL:  awssdk.Int64(validationRecordTTL),
-								ResourceRecords: []route53types.ResourceRecord{
-									{
-										Value: opts.ResourceRecord.Value,
+			// The validation record lives in the nearest public zone (written by current
+			// controllers) or, for certificates created by controller versions that
+			// predate the public-zone selection fix (issue #4840), in the most-specific
+			// zone regardless of visibility. Attempt cleanup in both when they differ;
+			// a delete against the wrong zone fails with "not found", which is
+			// tolerated below.
+			zoneIDs := []*string{id}
+			if publicID, err := c.route53Client.GetPublicHostedZoneID(ctx, awssdk.ToString(opts.DomainName)); err == nil && awssdk.ToString(publicID) != awssdk.ToString(id) {
+				zoneIDs = append(zoneIDs, publicID)
+			}
+			for _, zoneID := range zoneIDs {
+				input := &route53sdk.ChangeResourceRecordSetsInput{
+					HostedZoneId: zoneID,
+					ChangeBatch: &route53types.ChangeBatch{
+						Changes: []route53types.Change{
+							{
+								Action: "DELETE",
+								ResourceRecordSet: &route53types.ResourceRecordSet{
+									Name: opts.ResourceRecord.Name,
+									Type: route53types.RRType(opts.ResourceRecord.Type),
+									TTL:  awssdk.Int64(validationRecordTTL),
+									ResourceRecords: []route53types.ResourceRecord{
+										{
+											Value: opts.ResourceRecord.Value,
+										},
 									},
 								},
 							},
 						},
 					},
-				},
-			}
-			_, err = c.route53Client.ChangeRecordsWithContext(ctx, input)
-			if err != nil && strings.Contains(err.Error(), "not found") {
-				c.logger.Info("validation records no longer found, ignoring", "name", opts.ResourceRecord.Name, "value", opts.ResourceRecord.Value, "type", opts.ResourceRecord.Type)
-				continue
-			}
-			if err != nil && strings.Contains(err.Error(), "do not match the current values") {
-				c.logger.Info("validation records have been reused for another certificate, ignoring", "name", opts.ResourceRecord.Name, "value", opts.ResourceRecord.Value, "type", opts.ResourceRecord.Type)
-				continue
-			}
-			if err != nil {
-				return err
+				}
+				_, err = c.route53Client.ChangeRecordsWithContext(ctx, input)
+				if err != nil && strings.Contains(err.Error(), "not found") {
+					c.logger.Info("validation records no longer found, ignoring", "name", opts.ResourceRecord.Name, "value", opts.ResourceRecord.Value, "type", opts.ResourceRecord.Type)
+					continue
+				}
+				if err != nil && strings.Contains(err.Error(), "do not match the current values") {
+					c.logger.Info("validation records have been reused for another certificate, ignoring", "name", opts.ResourceRecord.Name, "value", opts.ResourceRecord.Value, "type", opts.ResourceRecord.Type)
+					continue
+				}
+				if err != nil {
+					return err
+				}
 			}
 		}
 	}
```

**File**: `pkg/deploy/acm/certificate_manager_test.go` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+package acm
+
+import (
+	"context"
+	"errors"
+	"testing"
+
+	awssdk "github.com/aws/aws-sdk-go-v2/aws"
+	"github.com/aws/aws-sdk-go-v2/service/acm"
+	acmtypes "github.com/aws/aws-sdk-go-v2/service/acm/types"
+	"github.com/aws/aws-sdk-go-v2/service/route53"
+	route53types "github.com/aws/aws-sdk-go-v2/service/route53/types"
+	"github.com/go-logr/logr"
+	"github.com/golang/mock/gomock"
+	"github.com/stretchr/testify/assert"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/aws/services"
+	"sigs.k8s.io/controller-runtime/pkg/log"
+)
+
+// Split-horizon cleanup: the unfiltered lookup resolves the private zone (legacy
+// records) while the public lookup resolves the public zone (records written by
+// current controllers). Delete must attempt cleanup in both zones.
+func TestDeleteWithValidationRecords_SplitHorizonCleansBothZones(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
+	mockACM := services.NewMockACM(ctrl)
+	mockRoute53 := services.NewMockRoute53(ctrl)
+	m := &defaultCertificateManager{
+		acmClient:     mockACM,
+		route53Client: mockRoute53,
+		logger:        logr.New(&log.NullLogSink{}),
+	}
+
+	arn := "arn:aws:acm:us-east-1:123456789012:certificate/test"
+	mockACM.EXPECT().DescribeCertificateWithContext(gomock.Any(), gomock.Eq(&acm.DescribeCertificateInput{
+		CertificateArn: awssdk.String(arn),
+	})).Return(&acm.DescribeCertificateOutput{
+		Certificate: &acmtypes.CertificateDetail{
+			DomainValidationOptions: []acmtypes.DomainValidation{
+				{
+					ValidationMethod: acmtypes.ValidationMethodDns,
+					DomainName:       awssdk.String("app.sub.example.com"),
+					ResourceRecord: &acmtypes.ResourceRecord{
+						Name:  awssdk.String("cname-name"),
+						Value: awssdk.String("cname-value"),
+						Type:  acmtypes.RecordTypeCname,
+					},
+				},
+			},
+		},
+	}, nil)
+
+	mockRoute53.EXPECT().GetHostedZoneID(gomock.Any(), gomock.Eq("app.sub.example.com")).Return(awssdk.String("Z_PRIVATE"), nil)
+	mockRoute53.EXPECT().GetPublicHostedZoneID(gomock.Any(), gomock.Eq("app.sub.example.com")).Return(awssdk.String("Z_PUBLIC"), nil)
+
+	deleteInput := func(zoneID string) *route53.ChangeResourceRecordSetsInput {
+		return &route53.ChangeResourceRecordSetsInput{
+			HostedZoneId: awssdk.String(zoneID),
+			ChangeBatch: &route53types.ChangeBatch{
+				Changes: []route53types.Change{
+					{
+						Action: "DELETE",
+						ResourceRecordSet: &route53types.ResourceRecordSet{
+							Name: awssdk.String("cname-name"),
+							Type: route53types.RRType(acmtypes.RecordTypeCname),
+							TTL:  awssdk.Int64(validationRecordTTL),
+							ResourceRecords: []route53types.ResourceRecord{
+								{Value: awssdk.String("cname-value")},
+							},
+						},
+					},
+				},
+			},
+		}
+	}
+	// record was written to the public zone: private-zone delete fails "not found" (tolerated)
+	mockRoute53.EXPECT().ChangeRecordsWithContext(gomock.Any(), gomock.Eq(deleteInput("Z_PRIVATE"))).
+		Return(nil, errors.New("InvalidChangeBatch: Tried to delete resource record set but it was not found"))
+	mockRoute53.EXPECT().ChangeRecordsWithContext(gomock.Any(), gomock.Eq(deleteInput("Z_PUBLIC"))).
+		Return(&route53.ChangeResourceRecordSetsOutput{}, nil)
+
+	mockACM.EXPECT().DeleteCertificateWithContext(gomock.Any(), gomock.Eq(&acm.DeleteCertificateInput{
+		CertificateArn: awssdk.String(arn),
+	})).Return(&acm.DeleteCertificateOutput{}, nil)
+
+	err := m.DeleteWithValidationRecords(context.Background(), arn)
+	assert.NoError(t, err)
+}
+
+// A DNS validation option may have no ResourceRecord yet (ACM populates it
+// asynchronously); delete must skip record cleanup instead of panicking.
+func TestDeleteWithValidationRecords_NilResourceRecordSkipsCleanup(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	defer ctrl.Finish()
+
+	mockACM := services.NewMockACM(ctrl)
+	mockRoute53 := services.NewMockRoute53(ctrl)
+	m := &defaultCertificateManager{
+		acmClient:     mockACM,
+		route53Client: mockRoute53,
+		logger:        logr.New(&log.NullLogSink{}),
+	}
+
+	arn := "arn:aws:acm:us-east-1:123456789012:certificate/test"
+	mockACM.EXPECT().DescribeCertificateWithContext(gomock.Any(), gomock.Eq(&acm.DescribeCertificateInput{
+		CertificateArn: awssdk.String(arn),
+	})).Return(&acm.DescribeCertificateOutput{
+		Certificate: &acmtypes.CertificateDetail{
+			DomainValidationOptions: []acmtypes.DomainValidation{
+				{
+					ValidationMethod: acmtypes.ValidationMethodDns,
+					DomainName:       awssdk.String("app.sub.example.com"),
+					ResourceRecord:   nil,
+				},
+			},
+		},
+	}, nil)
+
+	mockACM.EXPECT().DeleteCertificateWithContext(gomock.Any(), gomock.Eq(&acm.DeleteCertificateInput{
+		CertificateArn: awssdk.String(arn),
+	})).Return(&acm.DeleteCertificateOutput{}, nil)
+
+	err := m.DeleteWithValidationRecords(context.Background(), arn)
+	assert.NoError(t, err)
+}
```

**File**: `pkg/deploy/acm/certificate_synthesizer_test.go` (modified, +8/-6)
```diff
@@ -83,7 +83,7 @@ func Test_Synthesizer(t *testing.T) {
 					},
 				}, nil)
 
-				mockRoute53.EXPECT().GetHostedZoneID(gomock.Any(), gomock.Eq("example.com")).Return(awssdk.String("Z0382403B3S5MSK4SVXX"), nil)
+				mockRoute53.EXPECT().GetPublicHostedZoneID(gomock.Any(), gomock.Eq("example.com")).Return(awssdk.String("Z0382403B3S5MSK4SVXX"), nil)
 
 				mockRoute53.EXPECT().ChangeRecordsWithContext(gomock.Any(), gomock.Eq(&route53.ChangeResourceRecordSetsInput{
 					HostedZoneId: awssdk.String("Z0382403B3S5MSK4SVXX"),
@@ -242,8 +242,8 @@ func Test_Synthesizer(t *testing.T) {
 					},
 				}, nil)
 
-				mockRoute53.EXPECT().GetHostedZoneID(gomock.Any(), gomock.Eq("example.com")).Return(awssdk.String("Z0382403B3S5MSK4SVXX"), nil)
-				mockRoute53.EXPECT().GetHostedZoneID(gomock.Any(), gomock.Eq("otherexample.com")).Return(awssdk.String("Z0922506B3S0MGK4SALX"), nil)
+				mockRoute53.EXPECT().GetPublicHostedZoneID(gomock.Any(), gomock.Eq("example.com")).Return(awssdk.String("Z0382403B3S5MSK4SVXX"), nil)
+				mockRoute53.EXPECT().GetPublicHostedZoneID(gomock.Any(), gomock.Eq("otherexample.com")).Return(awssdk.String("Z0922506B3S0MGK4SALX"), nil)
 				mockRoute53.EXPECT().ChangeRecordsWithContext(gomock.Any(), gomock.Eq(&route53.ChangeResourceRecordSetsInput{
 					HostedZoneId: awssdk.String("Z0382403B3S5MSK4SVXX"),
 					ChangeBatch: &route53types.ChangeBatch{
@@ -366,6 +366,8 @@ func Test_Synthesizer(t *testing.T) {
 				}, nil)
 
 				mockRoute53.EXPECT().GetHostedZoneID(gomock.Any(), gomock.Eq("example.com")).Return(awssdk.String("Z0382403B3S5MSK4SVXX"), nil)
+				// delete path also checks the public zone; same ID → single DELETE
+				mockRoute53.EXPECT().GetPublicHostedZoneID(gomock.Any(), gomock.Eq("example.com")).Return(awssdk.String("Z0382403B3S5MSK4SVXX"), nil)
 				mockRoute53.EXPECT().ChangeRecordsWithContext(gomock.Any(), gomock.Eq(&route53.ChangeResourceRecordSetsInput{
 					HostedZoneId: awssdk.String("Z0382403B3S5MSK4SVXX"),
 					ChangeBatch: &route53types.ChangeBatch{
@@ -411,7 +413,7 @@ func Test_Synthesizer(t *testing.T) {
 					},
 				}, nil)
 
-				mockRoute53.EXPECT().GetHostedZoneID(gomock.Any(), gomock.Eq("example.com")).Return(awssdk.String("Z0382403B3S5MSK4SVXX"), nil)
+				mockRoute53.EXPECT().GetPublicHostedZoneID(gomock.Any(), gomock.Eq("example.com")).Return(awssdk.String("Z0382403B3S5MSK4SVXX"), nil)
 
 				mockRoute53.EXPECT().ChangeRecordsWithContext(gomock.Any(), gomock.Eq(&route53.ChangeResourceRecordSetsInput{
 					HostedZoneId: awssdk.String("Z0382403B3S5MSK4SVXX"),
@@ -510,8 +512,8 @@ func Test_Synthesizer(t *testing.T) {
 				mockACM.EXPECT().ListCertificatesAsList(gomock.Any(), gomock.Eq(&acm.ListCertificatesInput{})).
 					Return([]acmtypes.CertificateSummary{}, nil)
 
-				// Pre-check: GetHostedZoneID fails — no cert should be requested
-				mockRoute53.EXPECT().GetHostedZoneID(gomock.Any(), gomock.Eq("wrong.nonexistent-domain.com")).
+				// Pre-check: GetPublicHostedZoneID fails — no cert should be requested
+				mockRoute53.EXPECT().GetPublicHostedZoneID(gomock.Any(), gomock.Eq("wrong.nonexistent-domain.com")).
 					Return(nil, fmt.Errorf("no hosted zone found for validation records"))
 
 				// RequestCertificate should NOT be called
```

---

### Incident Patch 5: `08db5bc3` (2026-07-19)
**Commit Message**: Fix typo in certificate management guide

Signed-off-by: niv1612 <[REDACTED_EMAIL]>

**File**: `docs/guide/ingress/certificate_management.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ This reconciliation might fail if there are no certificates present to autodisco
 ### Certificate Validation
 
 Amazon Issued certificates are currently validated using DNS Method and Route53 records. Validation can take [up to 30 minutes](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html). 
-E-Mail validation is not supported due to significant higher delays between requesting a certificate and it's issuance. 
+E-Mail validation is not supported due to significant higher delays between requesting a certificate and its issuance. 
 When using a PCA, certificates don't have to be validated.
 
 Because ACM validates Amazon-issued certificates over **public** DNS, the controller writes the validation record into the nearest-ancestor **public** Route53 hosted zone. In split-horizon setups (a private zone that is a subdomain of a public zone), the private zone is skipped so the record lands where ACM can resolve it. If no public hosted zone matches the domain (private-only domain, or the public parent lives in an account the controller can't see), the controller fails fast. In that case, pre-create the certificate yourself and reference it with the [`certificate-arn`](annotations.md#certificate-arn) annotation.
```

---

### Incident Patch 6: `44621146` (2026-09-30)
**Commit Message**: fix: use '/' separator in Gateway route-loader cache keys to avoid collisions (#4916)

**File**: `pkg/gateway/routeutils/loader.go` (modified, +12/-4)
```diff
@@ -6,6 +6,7 @@ import (
 
 	"github.com/go-logr/logr"
 	"github.com/pkg/errors"
+	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/sets"
 	elbv2gw "sigs.k8s.io/aws-load-balancer-controller/v3/apis/gateway/v1"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/config"
@@ -183,9 +184,7 @@ func (l *loaderImpl) loadChildResources(ctx context.Context, preloadedRoutes map
 
 	for port, preloadedRouteList := range preloadedRoutes {
 		for _, preloadedRoute := range preloadedRouteList {
-			namespacedNameRoute := preloadedRoute.GetRouteNamespacedName()
-			routeKind := preloadedRoute.GetRouteKind()
-			cacheKey := fmt.Sprintf("%s-%s-%s", routeKind, namespacedNameRoute.Name, namespacedNameRoute.Namespace)
+			cacheKey := generateResourceCacheKey(preloadedRoute.GetRouteKind(), preloadedRoute.GetRouteNamespacedName())
 
 			cachedRoute, ok := resourceCache[cacheKey]
 			if ok {
@@ -259,6 +258,13 @@ func (l *loaderImpl) loadChildResources(ctx context.Context, preloadedRoutes map
 	return loadedRouteData, failedRoutes, nil
 }
 
+// generateResourceCacheKey builds the key for the Gateway-scoped route resource cache.
+// It uses "/" as the separator because "/" is illegal in Kubernetes names and namespaces, so the key
+// is unique per route.
+func generateResourceCacheKey(routeKind RouteKind, nn types.NamespacedName) string {
+	return fmt.Sprintf("%s/%s", routeKind, nn.String())
+}
+
 func generateRouteDataCacheKey(rd RouteData) string {
 	port := ""
 
@@ -278,5 +284,7 @@ func generateRouteDataCacheKey(rd RouteData) string {
 	if rd.ParentRef.Namespace != nil {
 		namespace = string(*rd.ParentRef.Namespace)
 	}
-	return fmt.Sprintf("%s-%s-%s-%s-%s-%s-%s-%s", kind, rd.RouteMetadata.RouteName, rd.RouteMetadata.RouteNamespace, rd.RouteMetadata.RouteKind, rd.ParentRef.Name, namespace, port, sectionName)
+	// Dedup key for status updates only (no routing impact). Use "/" not "-": "/" is illegal in k8s
+	// names/namespaces, so distinct routes can't collide and suppress each other's status update.
+	return fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s", kind, rd.RouteMetadata.RouteName, rd.RouteMetadata.RouteNamespace, rd.RouteMetadata.RouteKind, rd.ParentRef.Name, namespace, port, sectionName)
 }
```

**File**: `pkg/gateway/routeutils/loader_test.go` (modified, +107/-57)
```diff
@@ -234,9 +234,9 @@ func Test_LoadRoutesForGateway(t *testing.T) {
 				80: loadedHTTPRoutes,
 			},
 			expectedReconcileQueue: map[string]bool{
-				"Gateway-http1-http1-ns-HTTPRoute-gw-gw-ns--": true,
-				"Gateway-http2-http2-ns-HTTPRoute-gw-gw-ns--": true,
-				"Gateway-http3-http3-ns-HTTPRoute-gw-gw-ns--": true,
+				"Gateway/http1/http1-ns/HTTPRoute/gw/gw-ns//": true,
+				"Gateway/http2/http2-ns/HTTPRoute/gw/gw-ns//": true,
+				"Gateway/http3/http3-ns/HTTPRoute/gw/gw-ns//": true,
 			},
 		},
 		{
@@ -267,9 +267,9 @@ func Test_LoadRoutesForGateway(t *testing.T) {
 				80: loadedHTTPRoutes,
 			},
 			expectedReconcileQueue: map[string]bool{
-				"Gateway-http1-http1-ns-HTTPRoute-gw-gw-ns--sect1": true,
-				"Gateway-http2-http2-ns-HTTPRoute-gw-gw-ns--sect2": true,
-				"Gateway-http3-http3-ns-HTTPRoute-gw-gw-ns--sect3": true,
+				"Gateway/http1/http1-ns/HTTPRoute/gw/gw-ns//sect1": true,
+				"Gateway/http2/http2-ns/HTTPRoute/gw/gw-ns//sect2": true,
+				"Gateway/http3/http3-ns/HTTPRoute/gw/gw-ns//sect3": true,
 			},
 		},
 		{
@@ -300,9 +300,9 @@ func Test_LoadRoutesForGateway(t *testing.T) {
 				80: loadedHTTPRoutes,
 			},
 			expectedReconcileQueue: map[string]bool{
-				"Gateway-http1-http1-ns-HTTPRoute-gw-gw-ns-80-": true,
-				"Gateway-http2-http2-ns-HTTPRoute-gw-gw-ns-80-": true,
-				"Gateway-http3-http3-ns-HTTPRoute-gw-gw-ns-80-": true,
+				"Gateway/http1/http1-ns/HTTPRoute/gw/gw-ns/80/": true,
+				"Gateway/http2/http2-ns/HTTPRoute/gw/gw-ns/80/": true,
+				"Gateway/http3/http3-ns/HTTPRoute/gw/gw-ns/80/": true,
 			},
 		},
 		{
@@ -336,9 +336,9 @@ func Test_LoadRoutesForGateway(t *testing.T) {
 				80: loadedHTTPRoutes,
 			},
 			expectedReconcileQueue: map[string]bool{
-				"Gateway-http1-http1-ns-HTTPRoute-gw-gw-ns-80-sect1": true,
-				"Gateway-http2-http2-ns-HTTPRoute-gw-gw-ns-80-sect2": true,
-				"Gateway-http3-http3-ns-HTTPRoute-gw-gw-ns-80-sect3": true,
+				"Gateway/http1/http1-ns/HTTPRoute/gw/gw-ns/80/sect1": true,
+				"Gateway/http2/http2-ns/HTTPRoute/gw/gw-ns/80/sect2": true,
+				"Gateway/http3/http3-ns/HTTPRoute/gw/gw-ns/80/sect3": true,
 			},
 		},
 		{
@@ -369,9 +369,9 @@ func Test_LoadRoutesForGateway(t *testing.T) {
 				80: loadedHTTPRoutes,
 			},
 			expectedReconcileQueue: map[string]bool{
-				"Gateway-http1-http1-ns-HTTPRoute-gw-gw-ns--": true,
-				"Gateway-http2-http2-ns-HTTPRoute-gw-gw-ns--": true,
-				"Gateway-http3-http3-ns-HTTPRoute-gw-gw-ns--": true,
+				"Gateway/http1/http1-ns/HTTPRoute/gw/gw-ns//": true,
+				"Gateway/http2/http2-ns/HTTPRoute/gw/gw-ns//": true,
+				"Gateway/http3/http3-ns/HTTPRoute/gw/gw-ns//": true,
 			},
 		},
 		{
@@ -402,9 +402,9 @@ func Test_LoadRoutesForGateway(t *testing.T) {
 				80: loadedHTTPRoutes,
 			},
 			expectedReconcileQueue: map[string]bool{
-				"ListenerSet-http1-http1-ns-HTTPRoute-ls-gw-ns--": true,
-				"ListenerSet-http2-http2-ns-HTTPRoute-ls-gw-ns--": true,
-				"ListenerSet-http3-http3-ns-HTTPRoute-ls-gw-ns--": true,
+				"ListenerSet/http1/http1-ns/HTTPRoute/ls/gw-ns//": true,
+				"ListenerSet/http2/http2-ns/HTTPRoute/ls/gw-ns//": true,
+				"ListenerSet/http3/http3-ns/HTTPRoute/ls/gw-ns//": true,
 			},
 		},
 		{
@@ -453,12 +453,12 @@ func Test_LoadRoutesForGateway(t *testing.T) {
 				80: loadedHTTPRoutes,
 			},
 			expectedReconcileQueue: map[string]bool{
-				"ListenerSet-http1-http1-ns-HTTPRoute-ls-gw-ns--": true,
-				"ListenerSet-http2-http2-ns-HTTPRoute-ls-gw-ns--": true,
-				"ListenerSet-http3-http3-ns-HTTPRoute-ls-gw-ns--": true,
-				"Gateway-http1-http1-ns-HTTPRoute-gw-gw-ns--":     true,
-				"Gateway-http2-http2-ns-HTTPRoute-gw-gw-ns--":     true,
-				"Gateway-http3-http3-ns-HTTPRoute-gw-gw-ns--":     true,
+				"ListenerSet/http1/http1-ns/HTTPRoute/ls/gw-ns//": true,
+				"ListenerSet/http2/http2-ns/HTTPRoute/ls/gw-ns//": true,
+				"ListenerSet/http3/http3-ns/HTTPRoute/ls/gw-ns//": true,
+				"Gateway/http1/http1-ns/HTTPRoute/gw/gw-ns//":     true,
+				"Gateway/http2/http2-ns/HTTPRoute/gw/gw-ns//":     true,
+				"Gateway/http3/http3-ns/HTTPRoute/gw/gw-ns//":     true,
 			},
 		},
 		{
@@ -507,12 +507,12 @@ func Test_LoadRoutesForGateway(t *testing.T) {
 				80: loadedHTTPRoutes,
 			},
 			expectedReconcileQueue: map[string]bool{
-				"ListenerSet-http1-http1-ns-HTTPRoute-gw-gw-ns--": true,
-				"ListenerSet-http2-http2-ns-HTTPRoute-gw-gw-ns--": true,
-				"ListenerSet-http3-http3-ns-HTTPRoute-gw-gw-ns--": true,
-				"Gateway-http1-http1-ns-HTTPRoute-gw-gw-ns--":     true,
-				"Gateway-http2-http2-ns-HTTPRoute-gw-gw-ns--":     true,
-				"Gateway-http3-http3-ns-HTTPRoute-gw-gw-ns--":     true,
+				"ListenerSet/http1/http1-ns/HTTPRoute/gw/gw-ns//": true,
+				"ListenerSet/http2/http2-ns/HTTPRoute/gw/gw-ns//": true,
+				"ListenerSet/http3/http3-ns/HTTPRoute/gw/gw-ns//": true,
+				"Gateway/http1/http1-ns/HTTPRoute/gw/gw-ns//":     true,
+				"Gateway/http2/http2-ns/HTTPRoute/gw/gw-ns//":     true,
+				"Gateway/http3/http3-ns/HTTPRoute/gw/gw-ns//":     true,
 			},
 		},
 		{

```

---

### Incident Patch 7: `11f91b24` (2026-09-25)
**Commit Message**: Fixed wrong default for frontend-nlb-eip-allocations in annotation docs (#4871)

**File**: `docs/guide/ingress/annotations.md` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ You can add annotations to kubernetes Ingress and Service objects to customize t
 | [alb.ingress.kubernetes.io/frontend-nlb-healthcheck-unhealthy-threshold-count](#frontend-nlb-healthcheck-unhealthy-threshold-count) | integer                     |3| Ingress | N/A           |
 | [alb.ingress.kubernetes.io/frontend-nlb-healthcheck-success-codes](#frontend-nlb-healthcheck-success-codes) | string                                     |200| Ingress | N/A           |
 | [alb.ingress.kubernetes.io/frontend-nlb-tags](#frontend-nlb-tags) | stringMap | N/A | Ingress | Exclusive |
-| [alb.ingress.kubernetes.io/frontend-nlb-eip-allocations](#frontend-nlb-eip-allocations) | stringList                                     |200| Ingress | N/A           |
+| [alb.ingress.kubernetes.io/frontend-nlb-eip-allocations](#frontend-nlb-eip-allocations) | stringList                                     |N/A| Ingress | N/A           |
 | [alb.ingress.kubernetes.io/target-control-port.${serviceName}.${servicePort}](#target-control-port)                                       | integer                                    |N/A| Ingress | N/A           |
 | [alb.ingress.kubernetes.io/frontend-nlb-attributes](#frontend-nlb-attributes) | stringList                                     |N/A| Ingress | N/A           |
 
```

---

### Incident Patch 8: `73af7ec0` (2026-09-24)
**Commit Message**: Fix TGB networking with empty ports (#4909)

Signed-off-by: Dennis Lanov <[REDACTED_EMAIL]>

**File**: `pkg/networking/networking_manager.go` (modified, +2/-2)
```diff
@@ -400,11 +400,11 @@ func (m *defaultNetworkingManager) computeIngressPermissionsForTGBNetworking(ctx
 					Protocol: &protocolTCP,
 					Port:     nil,
 				}
-				permissions, err := m.computePermissionsForPeerPort(ctx, rulePeer, allTCPPort, pods)
+				permissionsForPeerPort, err := m.computePermissionsForPeerPort(ctx, rulePeer, allTCPPort, pods)
 				if err != nil {
 					return nil, err
 				}
-				permissions = append(permissions, permissions...)
+				permissions = append(permissions, permissionsForPeerPort...)
 			}
 		}
 	}
```

**File**: `pkg/networking/networking_manager_test.go` (modified, +35/-0)
```diff
@@ -73,6 +73,41 @@ func Test_defaultNetworkingManager_computeIngressPermissionsForTGBNetworking(t *
 				},
 			},
 		},
+		{
+			name: "with one rule / one peer / empty ports",
+			args: args{
+				tgbNetworking: elbv2api.TargetGroupBindingNetworking{
+					Ingress: []elbv2api.NetworkingIngressRule{
+						{
+							From: []elbv2api.NetworkingPeer{
+								{
+									SecurityGroup: &elbv2api.SecurityGroup{
+										GroupID: "sg-abcdefg",
+									},
+								},
+							},
+							Ports: []elbv2api.NetworkingPort{},
+						},
+					},
+				},
+			},
+			want: []IPPermissionInfo{
+				{
+					Permission: ec2types.IpPermission{
+						IpProtocol: awssdk.String("tcp"),
+						FromPort:   awssdk.Int32(0),
+						ToPort:     awssdk.Int32(65535),
+						UserIdGroupPairs: []ec2types.UserIdGroupPair{
+							{
+								Description: awssdk.String("elbv2.k8s.aws/targetGroupBinding=shared"),
+								GroupId:     awssdk.String("sg-abcdefg"),
+							},
+						},
+					},
+					Labels: map[string]string{tgbNetworkingIPPermissionLabelKey: tgbNetworkingIPPermissionLabelValue},
+				},
+			},
+		},
 		{
 			name: "with one rule / multiple peer / multiple port",
 			args: args{
```

---

### Incident Patch 9: `88df31ed` (2026-09-23)
**Commit Message**: Merge pull request #4911 from shraddhabang/fix-grpc-udp-public-image-default

test: default GRPC/UDP images to public ECR to fix the tests

**File**: `go.mod` (modified, +5/-5)
```diff
@@ -36,10 +36,10 @@ require (
 	github.com/spf13/pflag v1.0.10
 	github.com/stretchr/testify v1.11.1
 	go.uber.org/zap v1.28.0
-	golang.org/x/net v0.57.0
+	golang.org/x/net v0.58.0
 	golang.org/x/time v0.15.0
 	gomodules.xyz/jsonpatch/v2 v2.4.0
-	google.golang.org/grpc v1.82.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af
 	gopkg.in/yaml.v3 v3.0.1
 	helm.sh/helm/v3 v3.21.3
@@ -169,15 +169,15 @@ require (
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/crypto v0.54.0 // indirect
+	golang.org/x/crypto v0.55.0 // indirect
 	golang.org/x/mod v0.38.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/tools v0.48.0 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260523011958-0a33c5d7ca68 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/apiextensions-apiserver v0.36.2 // indirect
```

**File**: `go.sum` (modified, +22/-22)
```diff
@@ -471,8 +471,8 @@ go.opentelemetry.io/contrib/exporters/autoexport v0.67.0 h1:4fnRcNpc6YFtG3zsFw9a
 go.opentelemetry.io/contrib/exporters/autoexport v0.67.0/go.mod h1:qTvIHMFKoxW7HXg02gm6/Wofhq5p3Ib/A/NNt1EoBSQ=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 h1:CqXxU8VOmDefoh0+ztfGaymYbhdB/tT3zs79QaZTNGY=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0/go.mod h1:BuhAPThV8PBHBvg8ZzZ/Ok3idOdhWIodywz2xEcRbJo=
-go.opentelemetry.io/otel v1.43.0 h1:mYIM03dnh5zfN7HautFE4ieIig9amkNANT+xcVxAj9I=
-go.opentelemetry.io/otel v1.43.0/go.mod h1:JuG+u74mvjvcm8vj8pI5XiHy1zDeoCS2LB1spIq7Ay0=
+go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
+go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
 go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.19.0 h1:Dn8rkudDzY6KV9dr/D/bTUuWgqDf9xe0rr4G2elrn0Y=
 go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.19.0/go.mod h1:gMk9F0xDgyN9M/3Ed5Y1wKcx/9mlU91NXY2SNq7RQuU=
 go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.19.0 h1:HIBTQ3VO5aupLKjC90JgMqpezVXwFuq6Ryjn0/izoag=
@@ -497,16 +497,16 @@ go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.43.0 h1:mS47AX77OtFfKG4
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.43.0/go.mod h1:PJnsC41lAGncJlPUniSwM81gc80GkgWJWr3cu2nKEtU=
 go.opentelemetry.io/otel/log v0.19.0 h1:KUZs/GOsw79TBBMfDWsXS+KZ4g2Ckzksd1ymzsIEbo4=
 go.opentelemetry.io/otel/log v0.19.0/go.mod h1:5DQYeGmxVIr4n0/BcJvF4upsraHjg6vudJJpnkL6Ipk=
-go.opentelemetry.io/otel/metric v1.43.0 h1:d7638QeInOnuwOONPp4JAOGfbCEpYb+K6DVWvdxGzgM=
-go.opentelemetry.io/otel/metric v1.43.0/go.mod h1:RDnPtIxvqlgO8GRW18W6Z/4P462ldprJtfxHxyKd2PY=
-go.opentelemetry.io/otel/sdk v1.43.0 h1:pi5mE86i5rTeLXqoF/hhiBtUNcrAGHLKQdhg4h4V9Dg=
-go.opentelemetry.io/otel/sdk v1.43.0/go.mod h1:P+IkVU3iWukmiit/Yf9AWvpyRDlUeBaRg6Y+C58QHzg=
+go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
+go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
+go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
+go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
 go.opentelemetry.io/otel/sdk/log v0.19.0 h1:scYVLqT22D2gqXItnWiocLUKGH9yvkkeql5dBDiXyko=
 go.opentelemetry.io/otel/sdk/log v0.19.0/go.mod h1:vFBowwXGLlW9AvpuF7bMgnNI95LiW10szrOdvzBHlAg=
-go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfCGLEo89fDkw=
-go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
-go.opentelemetry.io/otel/trace v1.43.0 h1:BkNrHpup+4k4w+ZZ86CZoHHEkohws8AY+WTX09nk+3A=
-go.opentelemetry.io/otel/trace v1.43.0/go.mod h1:/QJhyVBUUswCphDVxq+8mld+AvhXZLhe+8WVFxiFff0=
+go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
+go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
+go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
+go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
 go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
 go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
@@ -524,8 +524,8 @@ golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8U
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
 golang.org/x/crypto v0.0.0-20210513164829-c07d793c2f9a/go.mod h1:P+XmwS30IXTQdn5tA2iutPOUgjI07+tq3H3K9MVA1s8=
 golang.org/x/crypto v0.0.0-20220214200702-86341886e292/go.mod h1:IxCIyHEi3zRg3s0A5j5BB6A9Jmi73HwBIUl50j+osU4=
-golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
-golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.2/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
@@ -541,8 +541,8 @@ golang.org/x/net v0.0.0-20210405180319-a5a99cb37ef4/go.mod h1:p54w0d4576C0XHj96b
 golang.org/x/net v0.0.0-20210510120150-4163338589ed/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20211112202133-69e39bad7dc2/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20220225172249-27dd8689420f/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.
```

**File**: `test/e2e/gateway/test_resources/init.go` (modified, +5/-2)
```diff
@@ -6,17 +6,20 @@ import (
 
 	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework/manifest"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework/utils"
 )
 
-// InitGatewayFramework wraps framework.InitFramework with gateway-specific per-partition wiring.
-// Callers use this in package InitTF; sets TestHostname and, if --resolve-image-tags is on, rewrites image vars.
+// InitGatewayFramework initializes the framework, sets TestHostname, and selects the GRPC/UDP image source.
 func InitGatewayFramework(ctx context.Context) (*framework.Framework, error) {
 	tf, err := framework.InitFramework()
 	if err != nil {
 		return nil, err
 	}
 	SetTestHostnameForRegion(tf.Options.AWSRegion)
+	// Default is public (constants.go); --resolve-image-tags switches to the mirror + resolver.
 	if tf.Options.ResolveImageTags {
+		utils.UDPImage = utils.MirrorUDPImage
+		utils.GRPCImage = utils.MirrorGRPCImage
 		r, err := manifest.NewImageResolver(ctx, tf.Options.TestImageRegistry, tf.Logger)
 		if err != nil {
 			return nil, fmt.Errorf("init image resolver: %w", err)
```

**File**: `test/framework/utils/constants.go` (modified, +10/-2)
```diff
@@ -1,9 +1,17 @@
 package utils
 
+// UDP/GRPC image sources; InitGatewayFramework selects public (default) or mirror per --resolve-image-tags.
+const (
+	PublicUDPImage  = "public.ecr.aws/u6k2n8q7/nixozach/udp-echoserver:latest"
+	PublicGRPCImage = "public.ecr.aws/u6k2n8q7/nixozach/grpc-echoserver:latest"
+	MirrorUDPImage  = "networking-e2e-test-images/udp-echoserver:latest"
+	MirrorGRPCImage = "networking-e2e-test-images/grpc-echoserver:latest"
+)
+
 // Test image paths; vars so downstream can override with resolved (non-`:latest`) tags.
 var (
 	HelloImage       = "networking-e2e-test-images/hello-multi:latest"
 	ColortellerImage = "networking-e2e-test-images/colorteller:latest"
-	UDPImage         = "networking-e2e-test-images/udp-echoserver:latest"
-	GRPCImage        = "networking-e2e-test-images/grpc-echoserver:latest"
+	UDPImage         = PublicUDPImage
+	GRPCImage        = PublicGRPCImage
 )
```

**File**: `test/framework/utils/image.go` (modified, +16/-0)
```diff
@@ -1,5 +1,21 @@
 package utils
 
+import "strings"
+
+// GetDeploymentImage prefixes the registry only for relative refs; fully-qualified refs are returned as-is.
 func GetDeploymentImage(registry string, image string) string {
+	if isRegistryQualified(image) {
+		return image
+	}
 	return registry + "/" + image
 }
+
+// isRegistryQualified reports whether image's first segment is a registry host (contains "." or ":", or is "localhost").
+func isRegistryQualified(image string) bool {
+	i := strings.IndexByte(image, '/')
+	if i < 0 {
+		return false
+	}
+	first := image[:i]
+	return first == "localhost" || strings.ContainsAny(first, ".:")
+}
```

---

### Incident Patch 10: `afdf53b2` (2026-09-22)
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

### Incident Patch 11: `07156c4e` (2026-09-22)
**Commit Message**: build(deps): bump google.golang.org/grpc to v1.83.2

Resolves the vulnerabilities that the Dependency Review workflow flags on
the pinned grpc version:
  - GO-2026-6348 (govulncheck, "called"): fixed in grpc v1.83.1
  - GHSA-2v4p-qf9q-27wj (gRPC xDS server DoS, high): affects >=1.83.0,<1.83.2
    and <1.82.2; fixed in grpc v1.83.2

v1.83.2 clears both. Verified with go1.26.6 (.go-version): the only
remaining govulncheck "called" vuln is GO-2026-5932 (x/crypto openpgp,
already in the ignore list pending Helm v4), and every transitively
upgraded module (x/net 0.58.0, x/crypto 0.55.0, x/text 0.41.0) is above
its advisory fix line.

**File**: `go.mod` (modified, +5/-5)
```diff
@@ -36,10 +36,10 @@ require (
 	github.com/spf13/pflag v1.0.10
 	github.com/stretchr/testify v1.11.1
 	go.uber.org/zap v1.28.0
-	golang.org/x/net v0.57.0
+	golang.org/x/net v0.58.0
 	golang.org/x/time v0.15.0
 	gomodules.xyz/jsonpatch/v2 v2.4.0
-	google.golang.org/grpc v1.82.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af
 	gopkg.in/yaml.v3 v3.0.1
 	helm.sh/helm/v3 v3.21.3
@@ -169,15 +169,15 @@ require (
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/crypto v0.54.0 // indirect
+	golang.org/x/crypto v0.55.0 // indirect
 	golang.org/x/mod v0.38.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/tools v0.48.0 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260523011958-0a33c5d7ca68 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	k8s.io/apiextensions-apiserver v0.36.2 // indirect
```

**File**: `go.sum` (modified, +22/-22)
```diff
@@ -471,8 +471,8 @@ go.opentelemetry.io/contrib/exporters/autoexport v0.67.0 h1:4fnRcNpc6YFtG3zsFw9a
 go.opentelemetry.io/contrib/exporters/autoexport v0.67.0/go.mod h1:qTvIHMFKoxW7HXg02gm6/Wofhq5p3Ib/A/NNt1EoBSQ=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 h1:CqXxU8VOmDefoh0+ztfGaymYbhdB/tT3zs79QaZTNGY=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0/go.mod h1:BuhAPThV8PBHBvg8ZzZ/Ok3idOdhWIodywz2xEcRbJo=
-go.opentelemetry.io/otel v1.43.0 h1:mYIM03dnh5zfN7HautFE4ieIig9amkNANT+xcVxAj9I=
-go.opentelemetry.io/otel v1.43.0/go.mod h1:JuG+u74mvjvcm8vj8pI5XiHy1zDeoCS2LB1spIq7Ay0=
+go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
+go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
 go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.19.0 h1:Dn8rkudDzY6KV9dr/D/bTUuWgqDf9xe0rr4G2elrn0Y=
 go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.19.0/go.mod h1:gMk9F0xDgyN9M/3Ed5Y1wKcx/9mlU91NXY2SNq7RQuU=
 go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.19.0 h1:HIBTQ3VO5aupLKjC90JgMqpezVXwFuq6Ryjn0/izoag=
@@ -497,16 +497,16 @@ go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.43.0 h1:mS47AX77OtFfKG4
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.43.0/go.mod h1:PJnsC41lAGncJlPUniSwM81gc80GkgWJWr3cu2nKEtU=
 go.opentelemetry.io/otel/log v0.19.0 h1:KUZs/GOsw79TBBMfDWsXS+KZ4g2Ckzksd1ymzsIEbo4=
 go.opentelemetry.io/otel/log v0.19.0/go.mod h1:5DQYeGmxVIr4n0/BcJvF4upsraHjg6vudJJpnkL6Ipk=
-go.opentelemetry.io/otel/metric v1.43.0 h1:d7638QeInOnuwOONPp4JAOGfbCEpYb+K6DVWvdxGzgM=
-go.opentelemetry.io/otel/metric v1.43.0/go.mod h1:RDnPtIxvqlgO8GRW18W6Z/4P462ldprJtfxHxyKd2PY=
-go.opentelemetry.io/otel/sdk v1.43.0 h1:pi5mE86i5rTeLXqoF/hhiBtUNcrAGHLKQdhg4h4V9Dg=
-go.opentelemetry.io/otel/sdk v1.43.0/go.mod h1:P+IkVU3iWukmiit/Yf9AWvpyRDlUeBaRg6Y+C58QHzg=
+go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
+go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
+go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
+go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
 go.opentelemetry.io/otel/sdk/log v0.19.0 h1:scYVLqT22D2gqXItnWiocLUKGH9yvkkeql5dBDiXyko=
 go.opentelemetry.io/otel/sdk/log v0.19.0/go.mod h1:vFBowwXGLlW9AvpuF7bMgnNI95LiW10szrOdvzBHlAg=
-go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfCGLEo89fDkw=
-go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
-go.opentelemetry.io/otel/trace v1.43.0 h1:BkNrHpup+4k4w+ZZ86CZoHHEkohws8AY+WTX09nk+3A=
-go.opentelemetry.io/otel/trace v1.43.0/go.mod h1:/QJhyVBUUswCphDVxq+8mld+AvhXZLhe+8WVFxiFff0=
+go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
+go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
+go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
+go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
 go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
 go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
@@ -524,8 +524,8 @@ golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8U
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
 golang.org/x/crypto v0.0.0-20210513164829-c07d793c2f9a/go.mod h1:P+XmwS30IXTQdn5tA2iutPOUgjI07+tq3H3K9MVA1s8=
 golang.org/x/crypto v0.0.0-20220214200702-86341886e292/go.mod h1:IxCIyHEi3zRg3s0A5j5BB6A9Jmi73HwBIUl50j+osU4=
-golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
-golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.2/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
@@ -541,8 +541,8 @@ golang.org/x/net v0.0.0-20210405180319-a5a99cb37ef4/go.mod h1:p54w0d4576C0XHj96b
 golang.org/x/net v0.0.0-20210510120150-4163338589ed/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20211112202133-69e39bad7dc2/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20220225172249-27dd8689420f/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.
```

---

### Incident Patch 12: `0465d72b` (2026-09-17)
**Commit Message**: test/gateway: make e2e suite partition-aware and register ECR tag resolver

**File**: `go.mod` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ require (
 	github.com/aws/aws-sdk-go-v2/service/acm v1.28.4
 	github.com/aws/aws-sdk-go-v2/service/appmesh v1.27.7
 	github.com/aws/aws-sdk-go-v2/service/ec2 v1.173.0
+	github.com/aws/aws-sdk-go-v2/service/ecr v1.30.0
 	github.com/aws/aws-sdk-go-v2/service/elasticloadbalancingv2 v1.54.0
 	github.com/aws/aws-sdk-go-v2/service/globalaccelerator v1.26.3
 	github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi v1.23.3
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -49,6 +49,8 @@ github.com/aws/aws-sdk-go-v2/service/appmesh v1.27.7 h1:q44a6kysAfej9zZwRnraOg9s
 github.com/aws/aws-sdk-go-v2/service/appmesh v1.27.7/go.mod h1:ZYSmrgAMp0rTCHH+SGsoxZo+PPbgsDqBzewTp3tSJ60=
 github.com/aws/aws-sdk-go-v2/service/ec2 v1.173.0 h1:ta62lid9JkIpKZtZZXSj6rP2AqY5x1qYGq53ffxqD9Q=
 github.com/aws/aws-sdk-go-v2/service/ec2 v1.173.0/go.mod h1:o6QDjdVKpP5EF0dp/VlvqckzuSDATr1rLdHt3A5m0YY=
+github.com/aws/aws-sdk-go-v2/service/ecr v1.30.0 h1:WsWG+jupMFNpMCF3g4y1jVWbXKBsG1DyTs2tM48yuJE=
+github.com/aws/aws-sdk-go-v2/service/ecr v1.30.0/go.mod h1:WadVIk+UrTvWuAsCp6BKGX4i2snurpz8mPWhJQnS7Dg=
 github.com/aws/aws-sdk-go-v2/service/elasticloadbalancingv2 v1.54.0 h1:7Aa/utljEengXYcL+29baOrd6eRtP0JoX3UJwYNA83Y=
 github.com/aws/aws-sdk-go-v2/service/elasticloadbalancingv2 v1.54.0/go.mod h1:DpGMmFhQwV/HH9zugLT5Ovf9HMKdQ+6ejfJybqEC9i4=
 github.com/aws/aws-sdk-go-v2/service/globalaccelerator v1.26.3 h1:G8qcrur/MG4c7Wu+LMtpAPUSzmmaOa4ssHgYtefeJoo=
```

**File**: `test/e2e/gateway/alb_tests/alb_test_helper.go` (modified, +3/-3)
```diff
@@ -48,11 +48,11 @@ func (s *ALBTestStack) DeployGRPC(ctx context.Context, f *framework.Framework, g
 	}
 
 	svc := test_resources.BuildGRPCServiceSpec(test_resources.GRPCDefaultName, labels)
-	dp := test_resources.BuildGRPCDeploymentSpec(test_resources.GRPCDefaultName, "Hello World", labels)
+	dp := test_resources.BuildGRPCDeploymentSpec(test_resources.GRPCDefaultName, "Hello World", labels, f.Options.TestImageRegistry)
 	tgc := test_resources.BuildTargetGroupConfig(test_resources.DefaultTgConfigName, tgConfSpec, svc)
 
 	svcOther := test_resources.BuildGRPCServiceSpec(test_resources.GRPCDefaultName+"-other", otherLabels)
-	dpOther := test_resources.BuildGRPCDeploymentSpec(test_resources.GRPCDefaultName+"-other", "Hello World - Other", otherLabels)
+	dpOther := test_resources.BuildGRPCDeploymentSpec(test_resources.GRPCDefaultName+"-other", "Hello World - Other", otherLabels, f.Options.TestImageRegistry)
 	tgcOther := test_resources.BuildTargetGroupConfig(test_resources.DefaultTgConfigName+"-other", tgConfSpec, svcOther)
 
 	return s.deploy(ctx, f, gwListeners, []*gwv1.HTTPRoute{}, grpcrs, []*appsv1.Deployment{dp, dpOther}, []*corev1.Service{svc, svcOther}, lbConfSpec, []*elbv2gw.TargetGroupConfiguration{tgc, tgcOther}, lrConfSpec, nil, readinessGateEnabled)
@@ -70,7 +70,7 @@ func (s *ALBTestStack) DeployHTTPAndGRPC(ctx context.Context, f *framework.Frame
 		"app.kubernetes.io/instance": test_resources.GRPCDefaultName,
 	}
 	grpcSvc := test_resources.BuildGRPCServiceSpec(test_resources.GRPCDefaultName, grpcLabels)
-	grpcDp := test_resources.BuildGRPCDeploymentSpec(test_resources.GRPCDefaultName, "Hello World", grpcLabels)
+	grpcDp := test_resources.BuildGRPCDeploymentSpec(test_resources.GRPCDefaultName, "Hello World", grpcLabels, f.Options.TestImageRegistry)
 	grpcTgc := test_resources.BuildTargetGroupConfig(test_resources.DefaultTgConfigName+"-grpc", tgConfSpec, grpcSvc)
 
 	return s.deploy(ctx, f, gwListeners, httprs, grpcrs,
```

**File**: `test/e2e/gateway/alb_tests/state.go` (modified, +7/-2)
```diff
@@ -1,6 +1,11 @@
 package alb_tests
 
-import "sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
+import (
+	"context"
+
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/test_resources"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
+)
 
 var tf *framework.Framework
 
@@ -12,6 +17,6 @@ func InitTF() error {
 		return nil
 	}
 	var err error
-	tf, err = framework.InitFramework()
+	tf, err = test_resources.InitGatewayFramework(context.Background())
 	return err
 }
```

**File**: `test/e2e/gateway/chained_gateway_tests/state.go` (modified, +7/-2)
```diff
@@ -1,6 +1,11 @@
 package chained_gateway_tests
 
-import "sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
+import (
+	"context"
+
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/test_resources"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
+)
 
 var tf *framework.Framework
 
@@ -12,6 +17,6 @@ func InitTF() error {
 		return nil
 	}
 	var err error
-	tf, err = framework.InitFramework()
+	tf, err = test_resources.InitGatewayFramework(context.Background())
 	return err
 }
```

**File**: `test/e2e/gateway/listenerset_tests/state.go` (modified, +7/-2)
```diff
@@ -1,6 +1,11 @@
 package listenerset_tests
 
-import "sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
+import (
+	"context"
+
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/test_resources"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
+)
 
 var tf *framework.Framework
 
@@ -12,6 +17,6 @@ func InitTF() error {
 		return nil
 	}
 	var err error
-	tf, err = framework.InitFramework()
+	tf, err = test_resources.InitGatewayFramework(context.Background())
 	return err
 }
```

**File**: `test/e2e/gateway/nlb_tests/nlb_test_helper.go` (modified, +4/-4)
```diff
@@ -28,7 +28,7 @@ func (s *NLBTestStack) Deploy(ctx context.Context, f *framework.Framework, auxil
 	dpTCP := test_resources.BuildDeploymentSpec(f.Options.TestImageRegistry)
 	svcTCP := test_resources.BuildServiceSpec(map[string]string{})
 
-	dpUDP := test_resources.BuildUDPDeploymentSpec()
+	dpUDP := test_resources.BuildUDPDeploymentSpec(f.Options.TestImageRegistry)
 	svcUDP := test_resources.BuildUDPServiceSpec()
 	gwc := test_resources.BuildGatewayClassSpec(test_resources.NLBGatewayControllerName)
 
@@ -154,7 +154,7 @@ func (s *NLBTestStack) DeployTCPWeightedStack(ctx context.Context, f *framework.
 }
 
 func (s *NLBTestStack) DeployTCP_UDP(ctx context.Context, f *framework.Framework, lbConfSpec elbv2gw.LoadBalancerConfigurationSpec, tgConfSpec elbv2gw.TargetGroupConfigurationSpec, readinessGateEnabled bool) error {
-	dpUDP := test_resources.BuildUDPDeploymentSpec()
+	dpUDP := test_resources.BuildUDPDeploymentSpec(f.Options.TestImageRegistry)
 	svcUDP := test_resources.BuildUDPServiceSpec()
 	gwc := test_resources.BuildGatewayClassSpec(test_resources.NLBGatewayControllerName)
 
@@ -185,7 +185,7 @@ func (s *NLBTestStack) DeployTCP_UDP(ctx context.Context, f *framework.Framework
 }
 
 func (s *NLBTestStack) DeployQUIC(ctx context.Context, f *framework.Framework, lbConfSpec elbv2gw.LoadBalancerConfigurationSpec, tgConfSpec elbv2gw.TargetGroupConfigurationSpec, namespaceLabels map[string]string) error {
-	dpUDP := test_resources.BuildUDPDeploymentSpec()
+	dpUDP := test_resources.BuildUDPDeploymentSpec(f.Options.TestImageRegistry)
 	svcUDP := test_resources.BuildUDPServiceSpec()
 
 	dpUDP.Spec.Template.Annotations = make(map[string]string)
@@ -212,7 +212,7 @@ func (s *NLBTestStack) DeployQUIC(ctx context.Context, f *framework.Framework, l
 }
 
 func (s *NLBTestStack) DeployTCP_QUIC(ctx context.Context, f *framework.Framework, lbConfSpec elbv2gw.LoadBalancerConfigurationSpec, tgConfSpec elbv2gw.TargetGroupConfigurationSpec, namespaceLabels map[string]string) error {
-	dpUDP := test_resources.BuildUDPDeploymentSpec()
+	dpUDP := test_resources.BuildUDPDeploymentSpec(f.Options.TestImageRegistry)
 	svcUDP := test_resources.BuildUDPServiceSpec()
 
 	dpUDP.Spec.Template.Annotations = make(map[string]string)
```

**File**: `test/e2e/gateway/nlb_tests/state.go` (modified, +7/-2)
```diff
@@ -1,6 +1,11 @@
 package nlb_tests
 
-import "sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
+import (
+	"context"
+
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/test_resources"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
+)
 
 var tf *framework.Framework
 
@@ -12,6 +17,6 @@ func InitTF() error {
 		return nil
 	}
 	var err error
-	tf, err = framework.InitFramework()
+	tf, err = test_resources.InitGatewayFramework(context.Background())
 	return err
 }
```

---

### Incident Patch 13: `84e31c0e` (2026-09-01)
**Commit Message**: e2e: init sibling gateway tf in cross-importing suites

Suites blank-importing alb_tests/nlb_tests transitively register those
packages' Describes into the test binary; without calling their InitTF
the imported BeforeEach nil-derefs on tf.Options.

**File**: `test/e2e/gateway/chained_gateway_tests/chained_gateway_suite_test.go` (modified, +5/-0)
```diff
@@ -5,6 +5,8 @@ import (
 
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/alb_tests"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/nlb_tests"
 )
 
 func TestChainedGateway(t *testing.T) {
@@ -14,4 +16,7 @@ func TestChainedGateway(t *testing.T) {
 
 var _ = BeforeSuite(func() {
 	Expect(InitTF()).To(Succeed())
+	// Init imported packages' tf; their Describes are transitively registered here.
+	Expect(alb_tests.InitTF()).To(Succeed())
+	Expect(nlb_tests.InitTF()).To(Succeed())
 })
```

**File**: `test/e2e/gateway/nlb_tests/nlb_gateway_suite_test.go` (modified, +3/-0)
```diff
@@ -5,6 +5,7 @@ import (
 
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/alb_tests"
 )
 
 func TestNLBGateway(t *testing.T) {
@@ -14,4 +15,6 @@ func TestNLBGateway(t *testing.T) {
 
 var _ = BeforeSuite(func() {
 	Expect(InitTF()).To(Succeed())
+	// Init imported package's tf; its Describes are transitively registered here.
+	Expect(alb_tests.InitTF()).To(Succeed())
 })
```

**File**: `test/e2e/globalaccelerator/globalaccelerator_suite_test.go` (modified, +5/-0)
```diff
@@ -5,6 +5,8 @@ import (
 
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/alb_tests"
+	"sigs.k8s.io/aws-load-balancer-controller/v3/test/e2e/gateway/nlb_tests"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/test/framework/utils"
 )
@@ -24,4 +26,7 @@ var _ = BeforeSuite(func() {
 	if !utils.IsCommercialPartition(tf.Options.AWSRegion) {
 		Skip("GlobalAccelerator is only available in commercial AWS partition")
 	}
+	// Init imported packages' tf; their Describes are transitively registered here.
+	Expect(alb_tests.InitTF()).To(Succeed())
+	Expect(nlb_tests.InitTF()).To(Succeed())
 })
```

---

### Incident Patch 14: `0d277bbf` (2026-08-27)
**Commit Message**: fix(waf): ignore waf acl set to empty string

**File**: `pkg/ingress/model_build_load_balancer_addons.go` (modified, +3/-1)
```diff
@@ -2,6 +2,7 @@ package ingress
 
 import (
 	"context"
+
 	"github.com/pkg/errors"
 	"k8s.io/apimachinery/pkg/util/sets"
 	"sigs.k8s.io/aws-load-balancer-controller/v3/pkg/annotations"
@@ -60,7 +61,8 @@ func (t *defaultModelBuildTask) buildWAFv2WebACLAssociation(ctx context.Context,
 			}
 
 			rawWebACLARN := ""
-			if exists := t.annotationParser.ParseStringAnnotation(annotations.IngressSuffixWAFv2ACLARN, &rawWebACLARN, member.Ing.Annotations); !exists {
+			exists := t.annotationParser.ParseStringAnnotation(annotations.IngressSuffixWAFv2ACLARN, &rawWebACLARN, member.Ing.Annotations)
+			if !exists || rawWebACLARN == "" {
 				continue
 			}
 			explicitWebACLARNs.Insert(rawWebACLARN)
```

**File**: `pkg/ingress/model_build_load_balancer_addons_test.go` (modified, +25/-0)
```diff
@@ -69,6 +69,31 @@ func Test_defaultModelBuildTask_buildWAFv2WebACLAssociation(t *testing.T) {
 			want:    nil,
 			wantErr: assert.NoError,
 		},
+		{
+			name: " wafv2-acl-arn set to empty string",
+			fields: fields{
+				ingGroup: Group{
+					Members: []ClassifiedIngress{
+						{
+							Ing: &networking.Ingress{
+								ObjectMeta: metav1.ObjectMeta{
+									Namespace: "awesome-ns",
+									Name:      "awesome-ing-0",
+									Annotations: map[string]string{
+										"alb.ingress.kubernetes.io/wafv2-acl-arn": "",
+									},
+								},
+							},
+						},
+					},
+				},
+			},
+			args: args{
+				lbARN: core.LiteralStringToken("awesome-lb-arn"),
+			},
+			want:    nil,
+			wantErr: assert.NoError,
+		},
 		{
 			name: "when all ingresses have wafv2-acl-arn annotation set to wafv2-arn-1",
 			fields: fields{
```

---

### Incident Patch 15: `ed2b707b` (2026-08-17)
**Commit Message**: fix: handle DeletedFinalStateUnknown tombstones in TypedInformer's DeleteFunc (#4879)

* fix: handle DeletedFinalStateUnknown tombstones in TypedInformer's DeleteFunc

TypedInformer[T].DeleteFunc asserted the deleted object directly to T. When
the informer misses a delete event (e.g. right after a watch reconnect) and
only notices the deletion on the next relist, client-go delivers a
cache.DeletedFinalStateUnknown tombstone instead of the real object. The
bare type assertion panics on that tombstone, and because apimachinery's
crash handler re-panics after logging, the panic crashes the whole
controller process instead of staying isolated to the informer goroutine.

Only the Pod informer used for TargetGroupBinding readiness gates (added in
#4678) goes through TypedInformer, so this is the only watch affected.

Unwrap the tombstone before asserting, and log-and-skip instead of panicking
if the object still doesn't match.

* fix: ignore Pod delete events instead of asserting them to T

Per review feedback: the TargetGroupBinding controller also watches
EndpointSlices, which already reflect a Pod's removal, so the Pod informer's
Delete event doesn't need to reach the handler at all. 

**File**: `pkg/k8s/typed_informer.go` (modified, +2/-5)
```diff
@@ -42,11 +42,8 @@ func (is *TypedInformer[T]) Start(ctx context.Context, queue workqueue.TypedRate
 				ObjectNew: newObj.(T),
 			}, queue)
 		},
-		DeleteFunc: func(obj any) {
-			is.Handler.Delete(ctx, event.TypedDeleteEvent[T]{
-				Object: obj.(T),
-			}, queue)
-		},
+		// Ignored: EndpointSlice watches already reflect a Pod's removal.
+		DeleteFunc: func(obj any) {},
 	}
 
 	_, err := is.Informer.AddEventHandlerWithOptions(handler, toolscache.HandlerOptions{})
```

#### Recent Merged Pull Requests:
- **PR #4919** (2026-10-03): fix: ignore unpermitted cross namespace TCPRoutes in gateway target TGC deletion guard (@shraddhabang)
- **PR #4916** (2026-09-30): fix: use '/' separator in Gateway route-loader cache keys to avoid co… (@wweiwei-li)
- **PR #4912** (2026-09-22): chore: OIDC permission messaging (@zac-nixon)
- **PR #4911** (2026-09-23): test: default GRPC/UDP images to public ECR to fix the tests (@shraddhabang)
- **PR #4909** (2026-09-24): Fix TGB networking with empty ports (@dlanov)
- **PR #4908** (2026-09-17): test/gateway: make e2e suite partition-aware and register ECR tag resolver (@jupdec)
- **PR #4904** (2026-09-22): fix: canonicalize CIDRs for security group inbound rules to avoid reconciliation failures (@bobert-2)
- **PR #4902** (2026-09-25): docs: warn against manually deleting controller-generated TargetGroupBinding (@shashankvarma499)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
