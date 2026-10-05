# Forensic Learning Record (Deep Inspection): Kong/kubernetes-ingress-controller

> **Canonical Artifact**: `07_PROJECT_LEARNING/kong-kubernetes-ingress-controller-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kong/kubernetes-ingress-controller](https://github.com/Kong/kubernetes-ingress-controller))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:29:50.290Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kong/kubernetes-ingress-controller`
- **Description**: :gorilla: Kong for Kubernetes: The official Ingress Controller for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2412 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/admission/utils.go`
```
package admission

import (
	"context"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"sigs.k8s.io/controller-runtime/pkg/client"

	configurationv1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1"

	credsvalidation "github.com/kong/kubernetes-ingress-controller/v3/internal/admission/validation/consumers/credentials"
)

// -----------------------------------------------------------------------------
// KongHTTPValidator - Private Functions
// -----------------------------------------------------------------------------

// listManagedConsumersReferencingCredentialsSecret takes a Secret and a list of KongConsumers.
// It returns a list of KongConsumers that reference that Secret as a credential.
func listManagedConsumersReferencingCredentialsSecret(secret corev1.Secret, managedConsumers []*configurationv1.KongConsumer) []*configurationv1.KongConsumer {
	// determine if this credential is being actively referenced by a consumer
	consumersWhichReferenceSecret := make([]*configurationv1.KongConsumer, 0)
	for _, consumer := range managedConsumers {
		// verify that the secret is actually in the same namespace (its possible for
		// there to be name duplication across multiple namespaces).
		if consumer.Namespace == secret.Namespace {
			// verify whether the consumer in this same namespace as the secret
			// actually references it as a credential.
			for _, secretName := range consumer.Credentials {
				if secretName == secret.Name { // this credential is referred to from a consumer
					consumersWhichReferenceSecret = append(consumersWhichReferenceSecret, consumer)
				}
			}
		}
	}
	return consumersWhichReferenceSecret
}

// globalValidationIndexForCredentials builds an index of all consumer credentials
// using a given controller-runtime client. This provides an index based on
// ALL namespaces in the cluster. This can be very expensive with high numbers
// of consumer credentials, particularly if the client you provide is not cached
//
// if the caller is building the index to validate updates for specific secrets
// and those secrets should be excluded from the index because they will be added
// later, a map of the namespace and name of those secrets can be provided to exclude them.
func globalValidationIndexForCredentials(ctx context.Context, managerClient client.Client, consumers []*configurationv1.KongConsumer, ignoredSecrets map[string]map[string]struct{}) (credsvalidation.Index, error) {
	// pull the reference secrets for credentials from each consumer in the list
	index := make(credsvalidation.Index)
	for _, consumer := range consumers {
		for _, secretName := range consumer.Credentials {
			// if its been requested that this secret be specifically ignored
			// (e.g. that secret is being updated and will soon have new values)
			// then don't add it to the index.
			if secrets, namespaceContainsSkippedSecrets := ignoredSecrets[consumer.Namespace]; namespaceContainsSkippedSecrets {
				if _, secretShouldBeSkipped := secrets[secretName]; secretShouldBeSkipped {
					continue
				}
			}

			// grab a copy of the credential secret
			secret := &corev1.Secret{}
			if err := managerClient.Get(ctx, client.ObjectKey{
				Namespace: consumer.Namespace,
				Name:      secretName,
			}, secret); err != nil {
				if apierrors.IsNotFound(err) { // ignore missing secrets
					continue
				}
				return nil, err
			}

			// add the credential secret to the index
			if err := index.ValidateCredentialsForUniqueKeyConstraints(secret); err != nil {
				return nil, err
			}
		}
	}

	return index, nil
}

```

### Core Architecture Module: `internal/controllers/configuration/kongupstreampolicy_utils.go`
```
package configuration

import (
	"context"
	"fmt"
	"reflect"
	"sort"

	"github.com/samber/lo"
	"github.com/samber/mo"
	corev1 "k8s.io/api/core/v1"
	netv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8stypes "k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	configurationv1beta1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1beta1"
	incubatorv1alpha1 "github.com/kong/kubernetes-configuration/v2/api/incubator/v1alpha1"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/controllers"
	gatewaycontroller "github.com/kong/kubernetes-ingress-controller/v3/internal/controllers/gateway"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/controllers/utils"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/gatewayapi"
)

// maxNAncestors is the maximum number of ancestors that can be stored in the KongUpstreamPolicy status.
// This is a limitation of the Gateway API.
const maxNAncestors = 16

// upstreamPolicyAncestorKind represents kind of KongUpstreamPolicy ancestor (Service or KongServiceFacade).
type upstreamPolicyAncestorKind string

const (
	upstreamPolicyAncestorKindService           upstreamPolicyAncestorKind = "Service"
	upstreamPolicyAncestorKindKongServiceFacade upstreamPolicyAncestorKind = "KongServiceFacade"
)

// ancestorStatus represents the status of an ancestor (Service or KongServiceFacade).
// A collection of all ancestors' statuses is used to build the KongUpstreamPolicy status.
type ancestorStatus struct {
	namespacedName      k8stypes.NamespacedName
	ancestorKind        upstreamPolicyAncestorKind
	acceptedCondition   metav1.Condition
	programmedCondition metav1.Condition
	creationTimestamp   metav1.Time
}

// serviceKey is used as a key for indexing Services by "namespace/name".
type serviceKey string

// servicesSet is a set of serviceKeys.
type servicesSet map[serviceKey]struct{}

// enforceKongUpstreamPolicyStatus gets a list of services (ancestors) along with their desired status and enforce them
// in the KongUpstreamPolicy status.
func (r *KongUpstreamPolicyReconciler) enforceKongUpstreamPolicyStatus(
	ctx context.Context,
	oldPolicy *configurationv1beta1.KongUpstreamPolicy,
) (bool, error) {
	policyNN := k8stypes.NamespacedName{
		Namespace: oldPolicy.Namespace,
		Name:      oldPolicy.Name,
	}

	// Get all objects (Services and KongServiceFacades) that reference this KongUpstreamPolicy.
	services, err := r.getServicesReferencingUpstreamPolicy(ctx, policyNN)
	if err != nil {
		return false, err
	}
	serviceFacades, err := r.maybeGetServiceFacadesReferencingUpstreamPolicy(ctx, policyNN)
	if err != nil {
		return false, err
	}

	// Build the status for each ancestor.
	ancestorsStatus, err := r.buildAncestorsStatus(ctx, services, serviceFacades)
	if err != nil {
		return false, err
	}

	// Build the desired KongUpstreamPolicy status.
	newPolicyStatus, err := r.buildPolicyStatus(policyNN, ancestorsStatus)
	if err != nil {
		return false, err
	}

	// If the status is not updated, we don't need to patch the KongUpstreamPolicy.
	if isStatusUpdated := isPolicyStatusUpdated(oldPolicy.Status, newPolicyStatus); !isStatusUpdated {
		newPolicy := oldPolicy.DeepCopy()
		newPolicy.Status = newPolicyStatus
		return true, r.Client.Status().Patch(ctx, newPolicy, client.MergeFrom(oldPolicy))
	}
	return false, nil
}

// getServicesReferencingUpstreamPolicy fetches services referencing a KongUpstreamPolicy.
func (r *KongUpstreamPolicyReconciler) getServicesReferencingUpstreamPolicy(
	ctx context.Context,
	upstreamPolicyNN k8stypes.NamespacedName,
) ([]corev1.Service, error) {
	services := &corev1.ServiceList{}
	err := r.List(ctx, services,
		client.InNamespace(upstreamPolicyNN.Namespace),
		client.MatchingFields{
			upstreamPolicyIndexKey: upstreamPolicyNN.Name,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed listing Services: %w", err)
	}
	return services.Items, nil
}

// getIngressesReferencingService fetches all Ingresses using a Service as its backend.
func (r *KongUpstreamPolicyReconciler) getIngressesReferencingService(
	ctx context.Context,
	serviceNN k8stypes.NamespacedName,
) ([]netv1.Ingress, error) {
	ingresses := &netv1.IngressList{}
	if err := r.List(ctx, ingresses,
		client.InNamespace(serviceNN.Namespace),
		client.MatchingFields{routeBackendRefServiceNameIndexKey: serviceNN.String()},
	); err != nil {
		return nil, fmt.Errorf("failed listing ingresses: %w", err)
	}
	return ingresses.Items, nil
}

// getHTTPRoutesReferencingService fetches all HTTPRoutes using a service as its backend.
func (r *KongUpstreamPolicyReconciler) getHTTPRoutesReferencingService(
	ctx context.Context,
	serviceNN k8stypes.NamespacedName,
) ([]gatewayapi.HTTPRoute, error) {
	httpRoutes := &gatewayapi.HTTPRouteList{}
	if err := r.List(ctx, httpRoutes,
		client.MatchingFields{routeBackendRefServiceNameIndexKey: serviceNN.String()},
	); err != nil {
		return nil, fmt.Errorf("failed listing HTTPRoutes referencing services: %w", err)
	}
	return httpRoutes.Items, nil
}

// getHTTPRoutesReferencingServiceFacade fetches all HTTPRoutes using a KongServiceFacade as its backend.
func (r *KongUpstreamPolicyReconciler) getHTTPRoutesReferencingServiceFacade(
	ctx context.Context,
	serviceFacadeNN k8stypes.NamespacedName,
) ([]gatewayapi.HTTPRoute, error) {
	httpRoutes := &gatewayapi.HTTPRouteList{}
	if err := r.List(ctx, httpRoutes,
		client.MatchingFields{routeBackendRefServiceFacadeIndexKey: serviceFacadeNN.String()},
	); err != nil {
		return nil, fmt.Errorf("failed listing HTTPRoutes referencing KongServiceFacades: %w", err)
	}
	return httpRoutes.Items, nil
}

// maybeGetServiceFacadesReferencingUpstreamPolicy returns a list of KongServiceFacades that reference the given KongUpstreamPolicy.
// Skips the lookup if KongServiceFacade is not enabled.
func (r *KongUpstreamPolicyReconciler) maybeGetServiceFacadesReferencingUpstreamPolicy(
	ctx context.Context,
	upstreamPolicyNN k8stypes.NamespacedName,
) ([]incubatorv1alpha1.KongServiceFacade, error) {
	if !r.KongServiceFacadeEnabled {
		// KongServiceFacade is not enabled, so we don't need to check for it.
		return nil, nil
	}
	serviceFacades := &incubatorv1alpha1.KongServiceFacadeList{}
	err := r.List(ctx, serviceFacades,
		client.InNamespace(upstreamPolicyNN.Namespace),
		client.MatchingFields{
			upstreamPolicyIndexKey: upstreamPolicyNN.Name,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed listing KongServiceFacades: %w", err)
	}
	return serviceFacades.Items, nil
}

// upstreamPolicyUsedByBackendsOfMatchingClass returns true is the KongUpstreamPolicy is referenced in
// Services or KongServiceFacades that are used in backends of recociled Ingress or HTTPRoute.
// If it returns false, the reconciliation is terminated and the controller will not update its status and put it into storage
// because the KongUpstreamPolicy will not be translated into Kong configuration in such situation.
// This is implemented to prevent races on updating the status of KongUpstreamPolicy.
// Ref: https://github.com/Kong/kubernetes-ingress-controller/issues/6270.
func (r *KongUpstreamPolicyReconciler) upstreamPolicyUsedByBackendsOfMatchingClass(
	ctx context.Context,
	upstreamPolicyNN k8stypes.NamespacedName,
	isDefaultIngressClass bool,
) (bool, error) {
	// Fetch Services and ServiceFacades.
	services, err := r.getServicesReferencingUpstreamPolicy(ctx, upstreamPolicyNN)
	if err != nil {
		return false, err
	}
	serviceFacades, err := r.maybeGetServiceFacadesReferencingUpstreamPolicy(ctx, upstreamPolicyNN)
	if err != nil {
		return false, err
	}
	// Check if Ingresses use services referencing reconciled KongUpstreamPolicy as backend.
	for _, service := range services {
		ingresses, err := r.getIngressesReferencingService(ctx, k8stypes.NamespacedName{Namespace: service.Namespace, Name: service.Name})
		if err != nil {
			return false, err
		}
		for _, ingress := range ingresses {
			if utils.MatchesIngressClass(&ingress, r.IngressClassName, isDefaultIngressClass) {
				return true, nil
			}
		}
	}
	// Check if HTTPRoutes use services/KongServiceFacades referencing reconciled KongUpstreamPolicy as backend.
	if r.HTTPRouteEnabled {
		for _, service := range services {
			httpRoutes, err := r.getHTTPRoutesReferencingService(ctx, k8stypes.NamespacedName{Namespace: service.Namespace, Name: service.Name})
			if err != nil {
				return false, err
			}
			for _, httpRoute := range httpRoutes {
				attached := r.isRouteAttachedToReconciledGateway(&httpRoute) //nolint:contextcheck
				if attached {
					return true, nil
				}
			}
		}
		for _, serviceFacade := range serviceFacades {
			httpRoutes, err := r.getHTTPRoutesReferencingServiceFacade(ctx, k8stypes.NamespacedName{Namespace: serviceFacade.Namespace, Name: serviceFacade.Name})
			if err != nil {
				return false, err
			}
			for _, httpRoute := range httpRoutes {
				attached := r.isRouteAttachedToReconciledGateway(&httpRoute) //nolint:contextcheck
				if attached {
					return true, nil
				}
			}
		}
	}
	// If no Ingress or HTTPRoute satisfied, return false.
	return false, nil
}

// isRouteAttachedToReconciledGateway returns true if HTTPRoute is attached to any reconciled gateway.
func (r *KongUpstreamPolicyReconciler) isRouteAttachedToReconciledGateway(httpRoute *gatewayapi.HTTPRoute) bool {
	return gatewaycontroller.IsRouteAttachedToReconciledGateway[*gatewayapi.HTTPRoute](
		r.Client, r.Log,
		controllers.NewOptionalNamespacedName(mo.Option[k8stypes.NamespacedName]{}),
		httpRoute,
	)
}

// buildAncestorsStatus creates a list of services with their conditions associated.
func (r *KongUpstreamPolicyReconciler) buildAncestorsStatus(
	ctx context.Context,
	services []corev1.Service,
	serviceFacades []incubatorv1alpha1.KongServiceFacade,
) ([]ancestorStatus, error) {
	// Check if any Services have conflicts. We do not verify conflicts for KongServiceFacades as there's
	// no scenario in which they would have one.
	conflictedServices, err :
```

### Core Architecture Module: `internal/controllers/gateway/backendtlspolicy_utils.go`
```
package gateway

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/samber/lo"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8stypes "k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	ctrlref "github.com/kong/kubernetes-ingress-controller/v3/internal/controllers/reference"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/gatewayapi"
)

// getBackendTLSPoliciesByHTTPRoute returns the list of BackendTLSPolicies that targets a service
// used as backend by the given HTTPRoute.
func (r *BackendTLSPolicyReconciler) getBackendTLSPoliciesByHTTPRoute(ctx context.Context, httpRoute gatewayapi.HTTPRoute) ([]gatewayapi.BackendTLSPolicy, error) {
	objects := []gatewayapi.BackendTLSPolicy{}
	for _, rule := range httpRoute.Spec.Rules {
		for _, backend := range rule.BackendRefs {
			// no need to check group and kind nilness, as they have a default value in case not specified
			if *backend.Kind != "Service" || (*backend.Group != "" && *backend.Group != "core") {
				continue
			}

			namespace := httpRoute.Namespace
			if backend.Namespace != nil {
				namespace = string(*backend.Namespace)
			}
			policies := &gatewayapi.BackendTLSPolicyList{}
			if err := r.List(ctx, policies,
				client.InNamespace(namespace),
				client.MatchingFields{backendTLSPolicyTargetRefIndexKey: string(backend.Name)},
			); err != nil {
				return nil, err
			}
			objects = append(objects, policies.Items...)
		}
	}
	return objects, nil
}

// getBackendTLSPolicyAncestors returns the list of Gateways associated to the given BackendTLSPolicy.
// To retrieve such a list, the following steps are performed:
// 1. Get all the the HTTPRoutes that reference the backends targeted by the policy;
// 2. Find all the parents in the HTTPRoute status that have already properly resolved by KIC and have the resolvedRefs condition set to true.
// 3. Return all the successfully resolved Gateways.
func (r *BackendTLSPolicyReconciler) getBackendTLSPolicyAncestors(ctx context.Context, policy gatewayapi.BackendTLSPolicy) ([]gatewayapi.Gateway, error) {
	gateways := []gatewayapi.Gateway{}
	for _, targetRef := range policy.Spec.TargetRefs {
		if (targetRef.Group != "core" && targetRef.Group != "") && targetRef.Kind != "Service" {
			continue
		}

		httpRoutes := gatewayapi.HTTPRouteList{}
		if err := r.List(ctx, &httpRoutes,
			client.MatchingFields{httpRouteBackendRefIndexKey: policy.Namespace + "/" + string(targetRef.Name)},
		); err != nil {
			return nil, err
		}

		for _, httpRoute := range httpRoutes.Items {
			for _, parentRef := range httpRoute.Spec.ParentRefs {
				if *parentRef.Group != gatewayapi.V1Group || *parentRef.Kind != "Gateway" {
					continue
				}

				namespace := httpRoute.Namespace
				if parentRef.Namespace != nil {
					namespace = string(*parentRef.Namespace)
				}

				var resolvedRefsStatus bool
				// Check the resolvedRefs condition is set to true to ensure that all the references are properly resolved
				// and granted by ReferenceGrants.
				for _, parentStatus := range httpRoute.Status.Parents {
					if parentStatus.ControllerName == GetControllerName() &&
						*parentStatus.ParentRef.Group == *parentRef.Group &&
						*parentStatus.ParentRef.Kind == *parentRef.Kind &&
						parentStatus.ParentRef.Name == parentRef.Name &&
						*parentStatus.ParentRef.Namespace == gatewayapi.Namespace(namespace) &&
						r.GatewayNN.MatchesNN(k8stypes.NamespacedName{Namespace: namespace, Name: string(parentRef.Name)}) {
						if _, found := lo.Find(parentStatus.Conditions, func(c metav1.Condition) bool {
							return c.Type == string(gatewayapi.RouteConditionResolvedRefs) && c.Status == metav1.ConditionTrue
						}); found {
							resolvedRefsStatus = true
							break
						}
					}
				}
				if resolvedRefsStatus {
					gateway := &gatewayapi.Gateway{}
					if err := r.Get(ctx, client.ObjectKey{Namespace: namespace, Name: string(parentRef.Name)}, gateway); err != nil {
						// In case the object is not found, we don't want to return an error, but we want to continue.
						if apierrors.IsNotFound(err) {
							continue
						}
						return nil, err
					}
					gateways = append(gateways, *gateway)
				}
			}
		}
	}

	return gateways, nil
}

// setPolicyStatus enforces an ancestorStatus for each Gateway associated to the given policy.
func (r *BackendTLSPolicyReconciler) setPolicyStatus(ctx context.Context, policy gatewayapi.BackendTLSPolicy, gateways []gatewayapi.Gateway, acceptedCondition metav1.Condition) error {
	ancestors := []gatewayapi.PolicyAncestorStatus{}

	var completeAcceptedCondition *metav1.Condition
	// First copy all the ancestorstatuses managed by other controllers.
	kicAncestors := []gatewayapi.PolicyAncestorStatus{}
	for _, ancestor := range policy.Status.Ancestors {
		if ancestor.ControllerName == GetControllerName() {
			kicAncestors = append(kicAncestors, ancestor)
			if completeAcceptedCondition == nil {
				completeAcceptedCondition = getCompleteAcceptedCondition(ancestor, acceptedCondition)
			}
			continue
		}
		ancestors = append(ancestors, ancestor)
	}
	if completeAcceptedCondition == nil {
		completeAcceptedCondition = &acceptedCondition
		completeAcceptedCondition.LastTransitionTime = metav1.Now()
	}

	// Sort the Gateways to be consistent across subsequent reconciliation loops.
	sortGateways(gateways, kicAncestors, policy.Namespace)

	// Then enforces all the ancestorsStatuses for the Gateways managed by this controller.
	for _, gateway := range gateways {
		// The ancestors are limited to 16, as per the Gateway API specification. in case more Gateways are found, we stop.
		if len(ancestors) >= 16 {
			break
		}
		ancestor := gatewayapi.PolicyAncestorStatus{
			AncestorRef: gatewayapi.ParentReference{
				Group:     lo.ToPtr(gatewayapi.V1Group),
				Kind:      lo.ToPtr(gatewayapi.Kind("Gateway")),
				Name:      gatewayapi.ObjectName(gateway.Name),
				Namespace: lo.ToPtr(gatewayapi.Namespace(gateway.Namespace)),
			},
			ControllerName: GetControllerName(),
			Conditions:     []metav1.Condition{*completeAcceptedCondition},
		}

		ancestors = append(ancestors, ancestor)
	}

	newPolicy := policy.DeepCopy()
	newPolicy.Status.Ancestors = ancestors

	return r.Status().Patch(ctx, newPolicy, client.MergeFrom(&policy))
}

func getCompleteAcceptedCondition(ancestors gatewayapi.PolicyAncestorStatus, acceptedCondition metav1.Condition) *metav1.Condition {
	for _, condition := range ancestors.Conditions {
		if condition.Type == acceptedCondition.Type &&
			condition.Status == acceptedCondition.Status &&
			condition.Reason == acceptedCondition.Reason &&
			condition.Message == acceptedCondition.Message {
			acceptedCondition.LastTransitionTime = condition.LastTransitionTime
			return &acceptedCondition
		}
	}
	acceptedCondition.LastTransitionTime = metav1.Now()
	return &acceptedCondition
}

// sortGateways sorts the given slice of Gateway objects by namespace and name.
func sortGateways(gateways []gatewayapi.Gateway, kicAncestors []gatewayapi.PolicyAncestorStatus, policyNamespace string) {
	kicAncestorsMap := lo.SliceToMap(kicAncestors, func(ancestor gatewayapi.PolicyAncestorStatus) (string, gatewayapi.PolicyAncestorStatus) {
		namespace := policyNamespace
		if ancestor.AncestorRef.Namespace != nil {
			namespace = string(*ancestor.AncestorRef.Namespace)
		}
		return namespace + "/" + string(ancestor.AncestorRef.Name), ancestor
	})
	sort.Slice(gateways, func(i, j int) bool {
		_, foundi := kicAncestorsMap[gateways[i].Namespace+"/"+gateways[i].Name]
		_, foundj := kicAncestorsMap[gateways[j].Namespace+"/"+gateways[j].Name]
		switch {
		// the precedence is on Gateways already set in the policy status.
		case foundi && !foundj:
			return true
		case !foundi && foundj:
			return false
		// then we sort by namespace/name.
		case gateways[i].Namespace < gateways[j].Namespace:
			return true
		case gateways[i].Namespace > gateways[j].Namespace:
			return false
		default:
			return gateways[i].Name < gateways[j].Name
		}
	})
}

// validateBackendTLSPolicy validates the given BackendTLSPolicy and returns the accepted Condition related to the policy.
func (r *BackendTLSPolicyReconciler) validateBackendTLSPolicy(ctx context.Context, policy gatewayapi.BackendTLSPolicy) (acceptedCondition *metav1.Condition, err error) {
	acceptedCondition = &metav1.Condition{
		Type:               string(gatewayapi.PolicyConditionAccepted),
		Status:             metav1.ConditionTrue,
		Reason:             string(gatewayapi.PolicyConditionAccepted),
		ObservedGeneration: policy.Generation,
	}

	for _, targetRef := range policy.Spec.TargetRefs {
		if (targetRef.Group != "core" && targetRef.Group != "") || targetRef.Kind != "Service" {
			continue
		}
		policies := &gatewayapi.BackendTLSPolicyList{}
		if err := r.List(ctx, policies,
			client.InNamespace(policy.Namespace),
			client.MatchingFields{backendTLSPolicyTargetRefIndexKey: string(targetRef.Name)},
		); err != nil {
			return nil, err
		}

		if len(policies.Items) > 1 {
			acceptedCondition = &metav1.Condition{
				Type:    string(gatewayapi.PolicyConditionAccepted),
				Status:  metav1.ConditionFalse,
				Reason:  string(gatewayapi.PolicyReasonConflicted),
				Message: "Multiple BackendTLSPolicies target the same service",
			}
			return acceptedCondition, nil
		}
	}

	var invalidMessages []string
	for _, caCert := range policy.Spec.Validation.CACertificateRefs {
		if (caCert.Group != "core" && caCert.Group != "") || (caCert.Kind != ctrlref.KindConfigMap && caCert.Kind != ctrlref.KindSecret) {
			invalidMessages = append(invalidMessages, "CACertificateRefs must reference ConfigMaps or Secrets in the core group")
			break
		}

		var (
			caCertObj   client.Object
			caCertObjNN = k8stypes.NamespacedName{
				Namespace: policy.Namespace,
				Name:      string(caCert.Name),
			}
		)
		// No need for default in this switch as if the Kind is different from Secret or C
```

### Core Architecture Module: `internal/controllers/gateway/gateway_utils.go`
```
package gateway

import (
	"context"
	"encoding/pem"
	"fmt"
	"reflect"
	"sort"
	"time"

	"github.com/go-logr/logr"
	"github.com/samber/lo"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8stypes "k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/annotations"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/gatewayapi"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/util"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/util/builder"
)

// -----------------------------------------------------------------------------
// Gateway Utilities
// -----------------------------------------------------------------------------

const (
	// maxConds is the maximum number of status conditions a Gateway can have at one time.
	maxConds = 8
)

// setGatewayCondition sets the condition with specified type in gateway status
// to expected condition in newCondition.
// if the gateway status does not contain a condition with that type, add one more condition.
// if the gateway status contains condition(s) with the type, then replace with the new condition.
func setGatewayCondition(gateway *gatewayapi.Gateway, newCondition metav1.Condition) {
	newConditions := []metav1.Condition{}
	for _, condition := range gateway.Status.Conditions {
		if condition.Type != newCondition.Type {
			newConditions = append(newConditions, condition)
		}
	}
	newConditions = append(newConditions, newCondition)
	gateway.Status.Conditions = newConditions
}

// isGatewayAccepted returns boolean whether or not the gateway object was accepted
// previously by the gateway controller.
func isGatewayAccepted(gateway *gatewayapi.Gateway) bool {
	return util.CheckCondition(
		gateway.Status.Conditions,
		util.ConditionType(gatewayapi.GatewayConditionAccepted),
		util.ConditionReason(gatewayapi.GatewayReasonAccepted),
		metav1.ConditionTrue,
		gateway.Generation,
	)
}

// isGatewayProgrammed returns boolean whether the Programmed condition exists
// for the given Gateway object and if it matches the currently known generation of that object.
func isGatewayProgrammed(gateway *gatewayapi.Gateway) bool {
	return util.CheckCondition(
		gateway.Status.Conditions,
		util.ConditionType(gatewayapi.GatewayConditionProgrammed),
		util.ConditionReason(gatewayapi.GatewayReasonProgrammed),
		metav1.ConditionTrue,
		gateway.Generation,
	)
}

// Warning: this function is used for both GatewayClasses and Gateways.
// The former uses "true" as the value, whereas the latter uses "namespace/service" CSVs for the proxy services.

// isGatewayClassUnmanaged returns boolean if the object is configured
// for unmanaged mode.
func isGatewayClassUnmanaged(anns map[string]string) bool {
	annotationValue := annotations.ExtractUnmanagedGatewayClassMode(anns)
	return annotationValue != ""
}

// isGatewayClassControlled returns boolean if the GatewayClass
// is controlled by this controller and is configured for unmanaged mode.
func isGatewayClassControlled(gatewayClass *gatewayapi.GatewayClass) bool {
	return gatewayClass.Spec.ControllerName == GetControllerName()
}

// pruneGatewayStatusConds cleans out old status conditions if the Gateway currently has more
// status conditions set than the 8 maximum allowed by the Kubernetes API.
func pruneGatewayStatusConds(gateway *gatewayapi.Gateway) *gatewayapi.Gateway {
	if len(gateway.Status.Conditions) > maxConds {
		gateway.Status.Conditions = gateway.Status.Conditions[len(gateway.Status.Conditions)-maxConds:]
	}
	return gateway
}

// reconcileGatewaysIfClassMatches is a filter function to convert a list of gateways into a list
// of reconciliation requests for those gateways based on which match the given class.
func reconcileGatewaysIfClassMatches(gatewayClass client.Object, gateways []gatewayapi.Gateway) (recs []reconcile.Request) {
	for _, gateway := range gateways {
		if string(gateway.Spec.GatewayClassName) == gatewayClass.GetName() {
			recs = append(recs, reconcile.Request{
				NamespacedName: k8stypes.NamespacedName{
					Namespace: gateway.Namespace,
					Name:      gateway.Name,
				},
			})
		}
	}
	return
}

// list namespaced names of secrets referred by the gateway.
func listSecretNamesReferredByGateway(gateway *gatewayapi.Gateway) map[k8stypes.NamespacedName]struct{} {
	nsNames := make(map[k8stypes.NamespacedName]struct{})

	for _, listener := range gateway.Spec.Listeners {
		if listener.TLS == nil {
			continue
		}

		for _, certRef := range listener.TLS.CertificateRefs {
			if certRef.Group != nil && *certRef.Group != corev1.GroupName {
				continue
			}

			if certRef.Kind != nil && *certRef.Kind != "Secret" {
				continue
			}

			refNamespace := gateway.Namespace
			if certRef.Namespace != nil {
				refNamespace = string(*certRef.Namespace)
			}

			nsNames[k8stypes.NamespacedName{
				Namespace: refNamespace,
				Name:      string(certRef.Name),
			}] = struct{}{}
		}
	}
	return nsNames
}

// extractListenerSpecFromGateway returns the spec of the listener with the given name.
// returns nil if the listener with given name is not found.
func extractListenerSpecFromGateway(gateway *gatewayapi.Gateway, listenerName gatewayapi.SectionName) *gatewayapi.Listener {
	for i, l := range gateway.Spec.Listeners {
		if l.Name == listenerName {
			return &gateway.Spec.Listeners[i]
		}
	}
	return nil
}

type (
	protocolPortMap map[gatewayapi.ProtocolType]map[gatewayapi.PortNumber]bool
	portProtocolMap map[gatewayapi.PortNumber]gatewayapi.ProtocolType
	portHostnameMap map[gatewayapi.PortNumber]map[gatewayapi.Hostname]bool
)

func buildKongPortMap(listens []gatewayapi.Listener) protocolPortMap {
	p := make(map[gatewayapi.ProtocolType]map[gatewayapi.PortNumber]bool, len(listens))
	for _, listen := range listens {
		_, ok := p[listen.Protocol]
		if !ok {
			p[listen.Protocol] = map[gatewayapi.PortNumber]bool{}
		}
		p[listen.Protocol][listen.Port] = true
	}
	return p
}

// initializeListenerMaps takes a Gateway and builds indices used in status updates and conflict detection. It returns
// empty maps from port to protocol to listener name and from port to hostnames, and a populated map from listener name
// to attached route count from their status.
func initializeListenerMaps(gateway *gatewayapi.Gateway) (
	portProtocolMap,
	portHostnameMap,
) {
	portToProtocol := make(portProtocolMap, len(gateway.Status.Listeners))
	portToHostname := make(portHostnameMap, len(gateway.Status.Listeners))

	existingStatuses := make(map[gatewayapi.SectionName]gatewayapi.ListenerStatus,
		len(gateway.Status.Listeners))
	for _, listenerStatus := range gateway.Status.Listeners {
		existingStatuses[listenerStatus.Name] = listenerStatus
	}

	for _, listener := range gateway.Spec.Listeners {
		portToHostname[listener.Port] = make(map[gatewayapi.Hostname]bool)
	}
	return portToProtocol, portToHostname
}

func canSharePort(requested, existing gatewayapi.ProtocolType) bool {
	switch requested {
	// TCP and UDP listeners must always use unique ports
	case gatewayapi.TCPProtocolType, gatewayapi.UDPProtocolType:
		return false
	// HTTPS and TLS Listeners can share ports with others of their type or the other TLS type
	// note that this is not actually possible in Kong: TLS is a stream listen and HTTPS is an http listen
	// however, this section implements the spec ignoring Kong's reality
	case gatewayapi.HTTPSProtocolType:
		if existing == gatewayapi.HTTPSProtocolType ||
			existing == gatewayapi.TLSProtocolType {
			return true
		}
		return false
	case gatewayapi.TLSProtocolType:
		if existing == gatewayapi.HTTPSProtocolType ||
			existing == gatewayapi.TLSProtocolType {
			return true
		}
		return false
	// HTTP Listeners can share ports with others of the same protocol only
	case gatewayapi.HTTPProtocolType:
		if existing == gatewayapi.HTTPProtocolType {
			return true
		}
		return false
	default:
		return false
	}
}

func getListenerStatus(
	ctx context.Context,
	gateway *gatewayapi.Gateway,
	kongListens []gatewayapi.Listener,
	referenceGrants []gatewayapi.ReferenceGrant,
	client client.Client,
) ([]gatewayapi.ListenerStatus, error) {
	statuses := make(map[gatewayapi.SectionName]gatewayapi.ListenerStatus, len(gateway.Spec.Listeners))
	portToProtocol, portToHostname := initializeListenerMaps(gateway)
	kongProtocolsToPort := buildKongPortMap(kongListens)
	conflictedPorts := make(map[gatewayapi.PortNumber]bool, len(gateway.Spec.Listeners))
	conflictedHostnames := make(map[gatewayapi.PortNumber]map[gatewayapi.Hostname]bool, len(gateway.Spec.Listeners))

	// TODO we should check transition time rather than always nowing, which we do throughout the below
	// https://github.com/Kong/kubernetes-ingress-controller/issues/2556
	for listenerIndex, listener := range gateway.Spec.Listeners {
		var hostname gatewayapi.Hostname
		if listener.Hostname != nil {
			hostname = *listener.Hostname
		}
		supportedkinds, ResolvedRefsReason := getListenerSupportedRouteKinds(listener)

		// If the listener uses TLS, we need to ensure that the gateway is granted to reference
		// all the secrets it references
		if listener.TLS != nil {
			tlsResolvedRefReason := string(gatewayapi.ListenerReasonResolvedRefs)
			for _, certRef := range listener.TLS.CertificateRefs {
				// if the certificate is in the same namespace of the gateway, no ReferenceGrant is needed
				if certRef.Namespace != nil && *certRef.Namespace != (gatewayapi.Namespace)(gateway.Namespace) {
					// get the result of the certificate reference. If the returned reason is not successful, the loop
					// must be broken because the secret reference isn't granted
					tlsResolvedRefReason = getReferenceGrantConditionReason(gateway.Namespace, certRef, referenceGrants)
					if tlsResolvedRefReason != string(gate
```

### Core Architecture Module: `internal/controllers/gateway/route_utils.go`
```
package gateway

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/go-logr/logr"
	"github.com/samber/lo"
	"github.com/samber/mo"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/controllers"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/gatewayapi"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/logging"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/util"
)

// -----------------------------------------------------------------------------
// Route Utilities
// -----------------------------------------------------------------------------

const (
	ConditionTypeProgrammed                                            = "Programmed"
	ConditionReasonProgrammedUnknown   gatewayapi.RouteConditionReason = "Unknown"
	ConditionReasonConfiguredInGateway gatewayapi.RouteConditionReason = "ConfiguredInGateway"
	ConditionReasonTranslationError    gatewayapi.RouteConditionReason = "TranslationError"
)

var (
	ErrNoMatchingListenerHostname = fmt.Errorf("no matching hostnames in listener")
	ErrNoSupportedGateway         = fmt.Errorf("no supported gateway found for route")
)

// supportedGatewayWithCondition is a struct that wraps a gateway and some further info
// such as the condition Status condition Accepted of the gateway and the listenerName.
type supportedGatewayWithCondition struct {
	gateway      *gatewayapi.Gateway
	condition    metav1.Condition
	listenerName string
}

func (g supportedGatewayWithCondition) GetName() string {
	return g.gateway.GetName()
}

func (g supportedGatewayWithCondition) GetNamespace() string {
	return g.gateway.GetNamespace()
}

func (g supportedGatewayWithCondition) GetSectionName() mo.Option[string] {
	if g.listenerName != "" {
		return mo.Some(g.listenerName)
	}
	return mo.None[string]()
}

// parentRefsForRoute provides a list of the parentRefs given a Gateway APIs route object
// (e.g. HTTPRoute, TCPRoute, e.t.c.) which refer to the Gateway resource(s) which manage it.
func parentRefsForRoute[T gatewayapi.RouteT](route T) ([]gatewayapi.ParentReference, error) {
	// Note: Ideally we wouldn't have to do this but it's hard to juggle around types
	// and support ParentReference and gatewayapi.ParentReference
	// at the same time so we just copy v1alpha2 refs to a new v1beta1 slice.
	convertV1Alpha2ToV1Beta1ParentReference := func(
		refsAlpha []gatewayapi.ParentReference,
	) []gatewayapi.ParentReference {
		ret := make([]gatewayapi.ParentReference, len(refsAlpha))
		for i, v := range refsAlpha {
			ret[i] = gatewayapi.ParentReference{
				Group:       v.Group,
				Kind:        v.Kind,
				Namespace:   v.Namespace,
				Name:        v.Name,
				SectionName: v.SectionName,
				Port:        v.Port,
			}
		}
		return ret
	}

	var refs []gatewayapi.ParentReference
	switch r := (any)(route).(type) {
	case *gatewayapi.HTTPRoute:
		refs = r.Spec.ParentRefs
	case *gatewayapi.UDPRoute:
		refs = r.Spec.ParentRefs
	case *gatewayapi.TCPRoute:
		refs = r.Spec.ParentRefs
	case *gatewayapi.TLSRoute:
		refs = r.Spec.ParentRefs
	case *gatewayapi.GRPCRoute:
		refs = r.Spec.ParentRefs
	default:
		return nil, fmt.Errorf("can't determine parent Gateway for unsupported route type %s", reflect.TypeOf(route))
	}
	for _, ref := range refs {
		if string(*ref.Group) != gatewayv1.GroupName || string(*ref.Kind) != "Gateway" {
			return nil, fmt.Errorf("unsupported parent kind %s/%s", string(*ref.Group), string(*ref.Kind))
		}
	}

	switch r := (any)(route).(type) {
	case *gatewayapi.HTTPRoute:
		return r.Spec.ParentRefs, nil
	case *gatewayapi.UDPRoute:
		return convertV1Alpha2ToV1Beta1ParentReference(r.Spec.ParentRefs), nil
	case *gatewayapi.TCPRoute:
		return convertV1Alpha2ToV1Beta1ParentReference(r.Spec.ParentRefs), nil
	case *gatewayapi.TLSRoute:
		return convertV1Alpha2ToV1Beta1ParentReference(r.Spec.ParentRefs), nil
	case *gatewayapi.GRPCRoute:
		return convertV1Alpha2ToV1Beta1ParentReference(r.Spec.ParentRefs), nil
	default:
		return nil, fmt.Errorf("can't determine parent Gateway for unsupported route type %s", reflect.TypeOf(route))
	}
}

// getSupportedGatewayForRoute will retrieve the Gateway and GatewayClass object for any
// Gateway APIs route object (e.g. HTTPRoute, TCPRoute, e.t.c.) from the provided cached
// client if they match this controller. If there are no gateways present for this route
// OR the present gateways are references to missing objects, this will return a unsupportedGW error.
//
// There is a parameter `specifiedGW` here, which is used to specific the gateway.
func getSupportedGatewayForRoute[T gatewayapi.RouteT](
	ctx context.Context, logger logr.Logger, mgrc client.Client, route T, specifiedGW controllers.OptionalNamespacedName,
) ([]supportedGatewayWithCondition, error) {
	// gather the parentrefs for this route object
	parentRefs, err := parentRefsForRoute(route)
	if err != nil {
		return nil, err
	}

	// search each parentRef to see if this controller is one of the supported ones
	gateways := make([]supportedGatewayWithCondition, 0)
	for _, parentRef := range parentRefs {
		// gather the namespace/name for the gateway
		namespace := route.GetNamespace()
		if parentRef.Namespace != nil {
			// TODO: need namespace restrictions implementation done before
			// merging this, need to filter out objects with a disallowed NS.
			// https://github.com/Kong/kubernetes-ingress-controller/issues/2080
			namespace = string(*parentRef.Namespace)
		}
		name := string(parentRef.Name)

		// If the flag `--gateway-to-reconcile` is set, KIC will only reconcile the specified gateway.
		// https://github.com/Kong/kubernetes-ingress-controller/issues/5322
		if gatewayToReconcile, ok := specifiedGW.Get(); ok {
			parentNamespace := route.GetNamespace()
			if parentRef.Namespace != nil {
				parentNamespace = string(*parentRef.Namespace)
			}
			if parentNamespace != gatewayToReconcile.Namespace || string(parentRef.Name) != gatewayToReconcile.Name {
				continue
			}
		}

		// pull the Gateway object from the cached client
		gateway := gatewayapi.Gateway{}
		if err := mgrc.Get(ctx, client.ObjectKey{
			Namespace: namespace,
			Name:      name,
		}, &gateway); err != nil {
			if apierrors.IsNotFound(err) {
				// if a configured gateway is not found it's still possible
				// that there's another gateway, so keep searching through the list.
				continue
			}
			return nil, fmt.Errorf("failed to retrieve gateway for route: %w", err)
		}
		gwLogger := logger.WithValues("parentRef.gateway", fmt.Sprintf("%s/%s", gateway.Namespace, gateway.Name))

		// pull the GatewayClass for the Gateway object from the cached client
		gatewayClass := gatewayapi.GatewayClass{}
		if err := mgrc.Get(ctx, client.ObjectKey{
			Name: string(gateway.Spec.GatewayClassName),
		}, &gatewayClass); err != nil {
			if apierrors.IsNotFound(err) {
				// if a configured gatewayClass is not found it's still possible
				// that there's another properly configured gateway in the parentRefs,
				// so keep searching through the list.
				continue
			}
			return nil, fmt.Errorf("failed to retrieve gatewayclass for gateway: %w", err)
		}

		// If the GatewayClass does not match this controller then skip it
		if gatewayClass.Spec.ControllerName != GetControllerName() {
			continue
		}

		// Otherwise we're all set and this controller should reconcile this route.

		var (
			// Set to true if there exists a listener which wasn't filtered by:
			// - AlowedRoutes
			// - listener name matching
			// - listener status checks
			// - listener and route type checks
			matched = false
			// Set to true if ParentRef specified a hostname and it matches route's hostnames.
			matchingHostname *metav1.ConditionStatus
			// Set to true if ParentRef specifies a Port and a listener matches that Port.
			portMatched = false

			allowedByAllowedRoutes  = false
			allowedBySupportedKinds = false
			allowedByListenerName   = false
			listenerReady           = false
		)

		for _, listener := range gateway.Spec.Listeners {
			listenerLogger := gwLogger.WithValues("listener", string(listener.Name))
			// Check if the route matches listener's AllowedRoutes.
			if ok, err := routeMatchesListenerAllowedRoutes(ctx, mgrc, route, listener, gateway.Namespace, parentRef.Namespace); err != nil {
				return nil, fmt.Errorf("failed matching listener %s to a route %s for gateway %s: %w",
					listener.Name, route.GetName(), gateway.Name, err,
				)
			} else if !ok {
				listenerLogger.V(logging.DebugLevel).Info("Route does not match listener's allowed routes")
				continue
			}
			allowedByAllowedRoutes = true

			// Check the listeners statuses:
			// - Check if a listener status exists with a matching type (via SupportedKinds).
			// - Check if it matches the requested listener by name (if specified).
			if err := existsMatchingListenerInStatus(route, listener, gateway.Status.Listeners); err != nil {
				listenerLogger.V(logging.DebugLevel).Info("Listener does not support this route", "reason", err.Error())
				continue
			} else { //nolint:revive
				allowedBySupportedKinds = true
			}

			if err := listenerProgrammedInStatus(listener.Name, gateway.Status.Listeners); err != nil {
				listenerLogger.V(logging.DebugLevel).Info("Listener is not ready", "reason", err.Error())
				continue
			} else { //nolint:revive
				listenerReady = true
			}

			// Check if listener name matches.
			if parentRef.SectionName != nil {
				if *parentRef.SectionName != "" && *parentRef.SectionName != listener.Name {
					listenerLogger.V(logging.DebugLevel).Info(
						"Listener name does not match parentRef.SectionName",
						"parentRef_sectionName", parentRef.SectionName,
					)
					continue
				}
				allowedByListenerName = true
			}

			// Perfo
```

### Core Architecture Module: `internal/controllers/gateway/utils.go`
```
package gateway

import (
	"github.com/go-logr/logr"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/logging"
)

// -----------------------------------------------------------------------------
// Logging Utilities
// -----------------------------------------------------------------------------

// debug is an alias for the longer log.V(util.DebugLevel).Info for convenience.
func debug(log logr.Logger, obj client.Object, msg string, keysAndValues ...any) {
	keysAndValues = append([]any{
		"namespace", obj.GetNamespace(),
		"name", obj.GetName(),
	}, keysAndValues...)
	log.V(logging.DebugLevel).Info(msg, keysAndValues...)
}

// info is an alias for the longer log.V(util.InfoLevel).Info for convenience.
func info(log logr.Logger, obj client.Object, msg string, keysAndValues ...any) { //nolint:unparam
	keysAndValues = append([]any{
		"namespace", obj.GetNamespace(),
		"name", obj.GetName(),
	}, keysAndValues...)
	log.V(logging.InfoLevel).Info(msg, keysAndValues...)
}

```

### Core Architecture Module: `internal/controllers/utils/conditions.go`
```
package utils

import (
	"github.com/samber/lo"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	configurationv1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/util"
	"github.com/kong/kubernetes-ingress-controller/v3/internal/util/kubernetes/object"
)

const (
	// ProgrammedConditionTrueMessage is the message for the programmed condition when it is True.
	ProgrammedConditionTrueMessage = "Object was successfully configured in Kong."

	// ProgrammedConditionFalseInvalidMessage is the message for the programmed condition when it is False with reason Invalid.
	ProgrammedConditionFalseInvalidMessage = "Object failed to be configured in Kong - see its attached Events for more information."

	// ProgrammedConditionFalsePendingMessage is the message for the programmed condition when it is False with reason Pending.
	ProgrammedConditionFalsePendingMessage = "Object is pending configuration in Kong."
)

type ProgrammedConditionOption func(object.ConfigurationStatus, *metav1.Condition)

// WithUnknownMessage sets the message of the desired Programmed condition to the given message if the
// configuration status is Unknown.
func WithUnknownMessage(message string) ProgrammedConditionOption {
	return func(status object.ConfigurationStatus, condition *metav1.Condition) {
		if status == object.ConfigurationStatusUnknown {
			condition.Message = message
		}
	}
}

// EnsureProgrammedCondition ensures that the programmed condition is present in the conditions slice with the
// status reflecting the current configuration status of the object.
// If the condition is already present with the correct status, the conditions slice is returned unmodified and false is
// returned as the second return value. If the condition is not present or has the wrong status, the conditions slice is
// returned with the condition updated and true is returned.
func EnsureProgrammedCondition(
	configurationStatus object.ConfigurationStatus,
	objectGeneration int64,
	conditions []metav1.Condition,
	options ...ProgrammedConditionOption,
) (
	updatedConditions []metav1.Condition,
	updateNeeded bool,
) {
	var (
		status  metav1.ConditionStatus
		reason  configurationv1.ConditionReason
		message string
	)
	switch configurationStatus {
	case object.ConfigurationStatusSucceeded:
		status = metav1.ConditionTrue
		reason = configurationv1.ReasonProgrammed
		message = ProgrammedConditionTrueMessage
	case object.ConfigurationStatusFailed:
		status = metav1.ConditionFalse
		reason = configurationv1.ReasonInvalid
		message = ProgrammedConditionFalseInvalidMessage
	case object.ConfigurationStatusUnknown:
		status = metav1.ConditionFalse
		reason = configurationv1.ReasonPending
		message = ProgrammedConditionFalsePendingMessage
	}

	desiredCondition := metav1.Condition{
		Type:               string(configurationv1.ConditionProgrammed),
		Status:             status,
		ObservedGeneration: objectGeneration,
		LastTransitionTime: metav1.Now(),
		Reason:             string(reason),
		Message:            message,
	}
	for _, opt := range options {
		opt(configurationStatus, &desiredCondition)
	}

	hasMatchingCondition := util.CheckCondition(
		conditions,
		util.ConditionType(desiredCondition.Type),
		util.ConditionReason(desiredCondition.Reason),
		desiredCondition.Status,
		desiredCondition.ObservedGeneration,
	)

	if hasMatchingCondition {
		return conditions, false
	}

	_, idx, ok := lo.FindIndexOf(conditions, func(c metav1.Condition) bool { return c.Type == string(configurationv1.ConditionProgrammed) })
	if !ok {
		conditions = append(conditions, desiredCondition)
	} else {
		// Do not update existing "Programmed" condition to Unknown to prevent races on updating status when new instance starts.
		if configurationStatus == object.ConfigurationStatusUnknown {
			return conditions, false
		}
		conditions[idx] = desiredCondition
	}

	return conditions, true
}

```

### Core Architecture Module: `internal/controllers/utils/control_plane_reference.go`
```
package utils

import (
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/predicate"

	commonv1alpha1 "github.com/kong/kubernetes-configuration/v2/api/common/v1alpha1"
)

// ObjectWithControlPlaneRef is an interface that represents an object that has a control plane reference.
type ObjectWithControlPlaneRef interface {
	GetControlPlaneRef() *commonv1alpha1.ControlPlaneRef
}

// GenerateCPReferenceMatchesPredicate generates a predicate function that filters out objects that have a control plane
// reference set to a value other than 'kic'.
func GenerateCPReferenceMatchesPredicate[T ObjectWithControlPlaneRef]() predicate.Predicate {
	return predicate.NewPredicateFuncs(func(o client.Object) bool {
		c, ok := o.(T)
		if !ok {
			return false
		}
		if cpRef := c.GetControlPlaneRef(); cpRef != nil {
			// If the cpRef is set, reconcile the object only if it is set explicitly to 'kic'.
			return cpRef.Type == commonv1alpha1.ControlPlaneRefKIC
		}
		// If there's no cpRef set, we should reconcile it as by default it's 'kic'.
		return true
	})
}

```

### Core Architecture Module: `internal/controllers/utils/conversion.go`
```
package utils

import (
	"fmt"
	"reflect"

	corev1 "k8s.io/api/core/v1"
	netv1 "k8s.io/api/networking/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	configurationv1beta1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1beta1"
)

// UpdateLoadBalancerIngress updates any supported Ingress object with new []netv1.IngressLoadBalancerIngress
// in a backward-compatible fashion if needed. Update does not happen in case there are no changes detected.
func UpdateLoadBalancerIngress(
	ingress client.Object,
	newAddresses []netv1.IngressLoadBalancerIngress,
) (updateNeeded bool, err error) {
	// Convert to netv1 so that we can compare it with newAddresses.
	oldAddresses, err := ingressToNetV1LoadBalancerIngressStatus(ingress)
	if err != nil {
		return false, fmt.Errorf("failed to convert ingress to netv1.Ingress: %w", err)
	}

	updateNeeded = len(oldAddresses) != len(newAddresses) || !reflect.DeepEqual(oldAddresses, newAddresses)
	if !updateNeeded {
		return false, nil
	}

	switch obj := ingress.(type) {
	case *netv1.Ingress:
		obj.Status.LoadBalancer.Ingress = newAddresses
	case *configurationv1beta1.TCPIngress:
		obj.Status.LoadBalancer.Ingress = netV1ToCoreV1LoadBalancerIngress(newAddresses)
	case *configurationv1beta1.UDPIngress:
		obj.Status.LoadBalancer.Ingress = netV1ToCoreV1LoadBalancerIngress(newAddresses)
	default:
		return false, fmt.Errorf("unsupported ingress type: %T", obj)
	}

	return true, nil
}

func netV1ToCoreV1LoadBalancerIngress(in []netv1.IngressLoadBalancerIngress) []corev1.LoadBalancerIngress {
	out := make([]corev1.LoadBalancerIngress, 0, len(in))
	for _, i := range in {
		out = append(out, corev1.LoadBalancerIngress{
			IP:       i.IP,
			Hostname: i.Hostname,
			// consciously omitting ports as we do not populate them
		})
	}
	return out
}

func ingressToNetV1LoadBalancerIngressStatus(in any) ([]netv1.IngressLoadBalancerIngress, error) {
	switch obj := in.(type) {
	case *netv1.Ingress:
		return obj.Status.LoadBalancer.Ingress, nil
	case *configurationv1beta1.TCPIngress:
		return coreV1ToNetV1LoadBalancerIngress(obj.Status.LoadBalancer.Ingress), nil
	case *configurationv1beta1.UDPIngress:
		return coreV1ToNetV1LoadBalancerIngress(obj.Status.LoadBalancer.Ingress), nil
	default:
		return nil, fmt.Errorf("unsupported ingress type: %T", obj)
	}
}

func coreV1ToNetV1LoadBalancerIngress(in []corev1.LoadBalancerIngress) []netv1.IngressLoadBalancerIngress {
	out := make([]netv1.IngressLoadBalancerIngress, 0, len(in))
	for _, i := range in {
		out = append(out, netv1.IngressLoadBalancerIngress{
			IP:       i.IP,
			Hostname: i.Hostname,
			// consciously omitting ports as we do not populate them
		})
	}
	return out
}

```

### Core Architecture Module: `internal/controllers/utils/ingress_predicates.go`
```
package utils

import (
	netv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/predicate"

	configurationv1alpha1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1alpha1"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/annotations"
)

const defaultIngressClassAnnotation = "ingressclass.kubernetes.io/is-default-class"

// IsDefaultIngressClass returns whether an IngressClass is the default IngressClass.
func IsDefaultIngressClass(obj client.Object) bool {
	if ingressClass, ok := obj.(*netv1.IngressClass); ok {
		return ingressClass.Annotations[defaultIngressClassAnnotation] == "true"
	}
	return false
}

// MatchesIngressClass indicates whether or not an object belongs to a given ingress class.
func MatchesIngressClass(obj client.Object, controllerIngressClass string, isDefault bool) bool {
	objectIngressClass := obj.GetAnnotations()[annotations.IngressClassKey]
	if isDefault && IsIngressClassEmpty(obj) {
		return true
	}
	if ing, isV1Ingress := obj.(*netv1.Ingress); isV1Ingress {
		if ing.Spec.IngressClassName != nil && *ing.Spec.IngressClassName == controllerIngressClass {
			return true
		}
	}
	// For KongCustomEntities, we check whether the `spec.ControllerName` matches.
	if customEntity, isKongCustomEntity := obj.(*configurationv1alpha1.KongCustomEntity); isKongCustomEntity {
		if customEntity.Spec.ControllerName == controllerIngressClass {
			return true
		}
	}
	return objectIngressClass == controllerIngressClass
}

// GeneratePredicateFuncsForIngressClassFilter builds a controller-runtime reconciliation predicate function which filters out objects
// which have their ingress class set to the a value other than the controller class.
func GeneratePredicateFuncsForIngressClassFilter(name string) predicate.Funcs {
	preds := predicate.NewPredicateFuncs(func(obj client.Object) bool {
		// we assume true for isDefault here because the predicates have no client and cannot check if the class is
		// default. classless and are filtered out by Reconcile() if the configured class is not the default class
		return MatchesIngressClass(obj, name, true)
	})
	preds.UpdateFunc = func(e event.UpdateEvent) bool {
		return MatchesIngressClass(e.ObjectOld, name, true) || MatchesIngressClass(e.ObjectNew, name, true)
	}
	return preds
}

// IsIngressClassEmpty returns true if an object has no ingress class information or false otherwise.
func IsIngressClassEmpty(obj client.Object) bool {
	switch obj := obj.(type) {
	case *netv1.Ingress:
		// netv1.Ingress is the only kind with an explicit IngressClassName field. All other resources use annotations
		// the annotation is deprecated for netv1.Ingress, and the older Ingress versions are themselves deprecated
		// our CRDs use the annotation, but should probably transition to a field eventually to align with Ingress
		if _, ok := obj.GetAnnotations()[annotations.IngressClassKey]; !ok {
			return obj.Spec.IngressClassName == nil
		}
		return false
	default:
		if _, ok := obj.GetAnnotations()[annotations.IngressClassKey]; ok {
			return false
		}
		return true
	}
}

// CRDExists returns false if CRD does not exist.
func CRDExists(restMapper meta.RESTMapper, gvr schema.GroupVersionResource) bool {
	_, err := restMapper.KindsFor(gvr)
	return err == nil
}

```

### Core Architecture Module: `internal/dataplane/configfetcher/kongrawstate.go`
```
package configfetcher

import (
	"github.com/kong/go-database-reconciler/pkg/utils"
	"github.com/kong/go-kong/kong"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/dataplane/kongstate"
)

// -----------------------------------------------------------------------------
// KongRawState to KongState conversion functions
// -----------------------------------------------------------------------------

// KongRawStateToKongState converts a Deck kongRawState to a KIC KongState.
func KongRawStateToKongState(rawstate *utils.KongRawState) *kongstate.KongState {
	kongState := &kongstate.KongState{}
	if rawstate == nil {
		return kongState
	}

	routes := make(map[string][]*kong.Route)
	for _, r := range rawstate.Routes {
		if r.Service != nil && r.Service.ID != nil {
			routes[*r.Service.ID] = append(routes[*r.Service.ID], r)
		}
	}

	pluginsByService := make(map[string][]*kong.Plugin)
	pluginsByRoute := make(map[string][]*kong.Plugin)
	for _, p := range rawstate.Plugins {
		if p.Service != nil && p.Service.ID != nil {
			pluginsByService[*p.Service.ID] = append(pluginsByService[*p.Service.ID], p)
		}
		if p.Route != nil && p.Route.ID != nil {
			pluginsByRoute[*p.Route.ID] = append(pluginsByRoute[*p.Route.ID], p)
		}
	}

	for _, cg := range rawstate.ConsumerGroups {
		kongState.ConsumerGroups = append(kongState.ConsumerGroups, kongstate.ConsumerGroup{ConsumerGroup: sanitizeConsumerGroup(*cg.ConsumerGroup)})
	}

	targets := make(map[string][]*kong.Target)
	for _, u := range rawstate.Targets {
		if u.Upstream != nil && u.Upstream.ID != nil {
			targets[*u.Upstream.ID] = append(targets[*u.Upstream.ID], u)
		}
	}

	for i, s := range rawstate.Services {
		kongState.Services = append(kongState.Services, kongstate.Service{
			Service: sanitizeKongService(*s),
			Routes:  []kongstate.Route{},
			Plugins: []kong.Plugin{},
		})
		for j, r := range routes[*s.ID] {
			kongState.Services[i].Routes = append(kongState.Services[i].Routes, kongstate.Route{
				Route:   sanitizeKongRoute(*r),
				Plugins: []kong.Plugin{},
			})
			if r.ID != nil {
				kongState.Services[i].Routes[j].Plugins = rawPluginsToPlugins(pluginsByRoute[*r.ID])
			}
		}
		kongState.Services[i].Plugins = rawPluginsToPlugins(pluginsByService[*s.ID])
	}

	for _, u := range rawstate.Upstreams {
		newUpstream := kongstate.Upstream{
			Upstream: *u,
		}
		if u.ID != nil {
			newUpstream.Targets = rawTargetsToTargets(targets[*u.ID])
		}
		kongState.Upstreams = append(kongState.Upstreams, sanitizeUpstream(newUpstream))
	}

	kongState.Vaults = rawVaultsToVaults(rawstate.Vaults)

	kongState.CACertificates = rawCACertificatesToCACertificates(rawstate.CACertificates)
	kongState.Certificates = rawCertificatesToCertificates(rawstate.Certificates)

	for i, consumer := range rawstate.Consumers {
		kongState.Consumers = append(kongState.Consumers, kongstate.Consumer{
			Consumer: sanitizeConsumer(*consumer),
		})
		for _, keyAuth := range rawstate.KeyAuths {
			if keyAuth.Consumer != nil {
				if *keyAuth.Consumer.ID == *consumer.ID {
					sanitizeAuth(keyAuth)
					kongState.Consumers[i].KeyAuths = append(kongState.Consumers[i].KeyAuths,
						&kongstate.KeyAuth{
							KeyAuth: *keyAuth,
						},
					)
				}
			}
		}
		for _, hmacAuth := range rawstate.HMACAuths {
			if hmacAuth.Consumer != nil {
				if *hmacAuth.Consumer.ID == *consumer.ID {
					sanitizeAuth(hmacAuth)
					kongState.Consumers[i].HMACAuths = append(kongState.Consumers[i].HMACAuths,
						&kongstate.HMACAuth{
							HMACAuth: *hmacAuth,
						},
					)
				}
			}
		}
		for _, jwtAuth := range rawstate.JWTAuths {
			if jwtAuth.Consumer != nil {
				if *jwtAuth.Consumer.ID == *consumer.ID {
					sanitizeAuth(jwtAuth)
					kongState.Consumers[i].JWTAuths = append(kongState.Consumers[i].JWTAuths,
						&kongstate.JWTAuth{
							JWTAuth: *jwtAuth,
						},
					)
				}
			}
		}
		for _, basicAuth := range rawstate.BasicAuths {
			if basicAuth.Consumer != nil {
				if *basicAuth.Consumer.ID == *consumer.ID {
					sanitizeAuth(&basicAuth.BasicAuth)
					kongState.Consumers[i].BasicAuths = append(kongState.Consumers[i].BasicAuths,
						&kongstate.BasicAuth{
							BasicAuth: basicAuth.BasicAuth,
						},
					)
				}
			}
		}
		for _, aclGroup := range rawstate.ACLGroups {
			if aclGroup.Consumer != nil {
				if *aclGroup.Consumer.ID == *consumer.ID {
					sanitizeAuth(aclGroup)
					kongState.Consumers[i].ACLGroups = append(kongState.Consumers[i].ACLGroups,
						&kongstate.ACLGroup{
							ACLGroup: *aclGroup,
						},
					)
				}
			}
		}
		for _, oauth2Cred := range rawstate.Oauth2Creds {
			if oauth2Cred.Consumer != nil {
				if *oauth2Cred.Consumer.ID == *consumer.ID {
					sanitizeAuth(oauth2Cred)
					kongState.Consumers[i].Oauth2Creds = append(kongState.Consumers[i].Oauth2Creds,
						&kongstate.Oauth2Credential{
							Oauth2Credential: *oauth2Cred,
						},
					)
				}
			}
		}
		for _, mTLSAuth := range rawstate.MTLSAuths {
			if mTLSAuth.Consumer != nil {
				if *mTLSAuth.Consumer.ID == *consumer.ID {
					sanitizeAuth(mTLSAuth)
					kongState.Consumers[i].MTLSAuths = append(kongState.Consumers[i].MTLSAuths,
						&kongstate.MTLSAuth{
							MTLSAuth: *mTLSAuth,
						},
					)
				}
			}
		}
	}

	for _, entity := range rawstate.CustomEntities {
		entityType := entity.Type()
		obj := entity.Object()
		ksEntity := kongstate.CustomEntity{
			Object: obj,
		}
		kongState.AddCustomEntity(string(entityType), kongstate.EntitySchema{}, ksEntity)
	}

	return kongState
}

func rawPluginsToPlugins(plugins []*kong.Plugin) []kong.Plugin {
	if len(plugins) == 0 {
		return nil
	}
	ps := []kong.Plugin{}

	for _, p := range plugins {
		ps = append(ps, sanitizePlugin(*p))
	}
	return ps
}

func rawTargetsToTargets(targets []*kong.Target) []kongstate.Target {
	if len(targets) == 0 {
		return nil
	}
	ts := []kongstate.Target{}

	for _, t := range targets {
		ts = append(ts, kongstate.Target{Target: *t})
	}
	return ts
}

func rawCertificatesToCertificates(certificates []*kong.Certificate) []kongstate.Certificate {
	if len(certificates) == 0 {
		return nil
	}
	certs := []kongstate.Certificate{}

	for _, c := range certificates {
		certs = append(certs, kongstate.Certificate{
			Certificate: sanitizeCertificate(*c),
		})
	}
	return certs
}

func rawCACertificatesToCACertificates(caCertificates []*kong.CACertificate) []kong.CACertificate {
	if len(caCertificates) == 0 {
		return nil
	}
	certs := []kong.CACertificate{}

	for _, c := range caCertificates {
		certs = append(certs, sanitizeCACertificate(*c))
	}
	return certs
}

func rawVaultsToVaults(rawVaults []*kong.Vault) []kongstate.Vault {
	if len(rawVaults) == 0 {
		return nil
	}
	vaults := []kongstate.Vault{}

	for _, v := range rawVaults {
		vaults = append(vaults, kongstate.Vault{
			Vault: sanitizeVault(*v),
		})
	}
	return vaults
}

// -----------------------------------------------------------------------------
// Sanitization functions
// -----------------------------------------------------------------------------

func sanitizeKongService(service kong.Service) kong.Service {
	service.ID = nil
	service.CreatedAt = nil
	service.UpdatedAt = nil
	return service
}

func sanitizeKongRoute(route kong.Route) kong.Route {
	route.CreatedAt = nil
	route.ID = nil
	route.UpdatedAt = nil
	route.Service = nil
	return route
}

func sanitizeUpstream(upstream kongstate.Upstream) kongstate.Upstream {
	upstream.CreatedAt = nil
	upstream.ID = nil
	for i := range upstream.Targets {
		upstream.Targets[i].CreatedAt = nil
		upstream.Targets[i].ID = nil
		upstream.Targets[i].Upstream = nil
	}
	return upstream
}

func sanitizePlugin(plugin kong.Plugin) kong.Plugin {
	plugin.ID = nil
	plugin.CreatedAt = nil
	plugin.Service = nil
	plugin.Route = nil
	return plugin
}

func sanitizeCertificate(certificate kong.Certificate) kong.Certificate {
	certificate.ID = nil
	certificate.CreatedAt = nil
	return certificate
}

func sanitizeCACertificate(caCertificate kong.CACertificate) kong.CACertificate {
	caCertificate.ID = nil
	caCertificate.CreatedAt = nil
	return caCertificate
}

func sanitizeVault(v kong.Vault) kong.Vault {
	v.ID = nil
	v.CreatedAt = nil
	return v
}

func sanitizeConsumer(consumer kong.Consumer) kong.Consumer {
	consumer.ID = nil
	consumer.CreatedAt = nil
	return consumer
}

func sanitizeConsumerGroup(consumerGroup kong.ConsumerGroup) kong.ConsumerGroup {
	consumerGroup.ID = nil
	consumerGroup.CreatedAt = nil
	return consumerGroup
}

type authT interface {
	*kong.KeyAuth |
		*kong.HMACAuth |
		*kong.JWTAuth |
		*kong.BasicAuth |
		*kong.ACLGroup |
		*kong.Oauth2Credential |
		*kong.MTLSAuth
}

func sanitizeAuth[t authT](auth t) {
	switch a := (any)(auth).(type) {
	case *kong.KeyAuth:
		a.ID = nil
		a.CreatedAt = nil
		a.Consumer = nil
	case *kong.HMACAuth:
		a.ID = nil
		a.CreatedAt = nil
		a.Consumer = nil
	case *kong.JWTAuth:
		a.ID = nil
		a.CreatedAt = nil
		a.Consumer = nil
	case *kong.BasicAuth:
		a.ID = nil
		a.CreatedAt = nil
		a.Consumer = nil
	case *kong.ACLGroup:
		a.ID = nil
		a.CreatedAt = nil
		a.Consumer = nil
	case *kong.Oauth2Credential:
		a.ID = nil
		a.CreatedAt = nil
		a.Consumer = nil
	case *kong.MTLSAuth:
		a.ID = nil
		a.CreatedAt = nil
		a.Consumer = nil
		if a.CACertificate != nil {
			a.CACertificate.ID = nil
			a.CACertificate.CreatedAt = nil
		}
	}
}

```

### Core Architecture Module: `internal/dataplane/kongstate/consumer.go`
```
package kongstate

import (
	"fmt"

	"github.com/kong/go-kong/kong"
	"github.com/samber/lo"

	configurationv1 "github.com/kong/kubernetes-configuration/v2/api/configuration/v1"

	"github.com/kong/kubernetes-ingress-controller/v3/internal/util"
)

// Consumer holds a Kong consumer and its plugins and credentials.
type Consumer struct {
	kong.Consumer
	Plugins        []kong.Plugin
	ConsumerGroups []kong.ConsumerGroup

	KeyAuths   []*KeyAuth
	HMACAuths  []*HMACAuth
	JWTAuths   []*JWTAuth
	BasicAuths []*BasicAuth
	ACLGroups  []*ACLGroup

	Oauth2Creds []*Oauth2Credential
	MTLSAuths   []*MTLSAuth

	K8sKongConsumer configurationv1.KongConsumer
}

// SanitizedCopy returns a shallow copy with sensitive values redacted best-effort.
func (c *Consumer) SanitizedCopy(uuidGenerator util.UUIDGenerator) Consumer {
	return Consumer{
		Consumer:       c.Consumer,
		Plugins:        c.Plugins,
		ConsumerGroups: c.ConsumerGroups,
		KeyAuths: func() []*KeyAuth {
			if c.KeyAuths == nil {
				return nil
			}
			return lo.Map(c.KeyAuths, func(c *KeyAuth, _ int) *KeyAuth {
				return c.SanitizedCopy(uuidGenerator)
			})
		}(),
		HMACAuths: func() []*HMACAuth {
			if c.HMACAuths == nil {
				return nil
			}
			return lo.Map(c.HMACAuths, func(c *HMACAuth, _ int) *HMACAuth {
				return c.SanitizedCopy()
			})
		}(),
		JWTAuths: func() []*JWTAuth {
			if c.JWTAuths == nil {
				return nil
			}
			return lo.Map(c.JWTAuths, func(c *JWTAuth, _ int) *JWTAuth {
				return c.SanitizedCopy()
			})
		}(),
		BasicAuths: func() []*BasicAuth {
			if c.BasicAuths == nil {
				return nil
			}
			return lo.Map(c.BasicAuths, func(c *BasicAuth, _ int) *BasicAuth {
				return c.SanitizedCopy()
			})
		}(),
		Oauth2Creds: func() []*Oauth2Credential {
			if c.Oauth2Creds == nil {
				return nil
			}
			return lo.Map(c.Oauth2Creds, func(c *Oauth2Credential, _ int) *Oauth2Credential {
				return c.SanitizedCopy()
			})
		}(),
		ACLGroups:       c.ACLGroups,
		MTLSAuths:       c.MTLSAuths,
		K8sKongConsumer: c.K8sKongConsumer,
	}
}

func (c *Consumer) SetCredential(credType string, credConfig any, tags []*string) (any, error) {
	switch credType {
	case "key-auth", "keyauth_credential":
		cred, err := NewKeyAuth(credConfig)
		if err != nil {
			return nil, err
		}
		cred.Tags = tags
		c.KeyAuths = append(c.KeyAuths, cred)
		return cred, nil
	case "basic-auth", "basicauth_credential":
		cred, err := NewBasicAuth(credConfig)
		if err != nil {
			return nil, err
		}
		cred.Tags = tags
		c.BasicAuths = append(c.BasicAuths, cred)
		return cred, nil
	case "hmac-auth", "hmacauth_credential":
		cred, err := NewHMACAuth(credConfig)
		if err != nil {
			return nil, err
		}
		cred.Tags = tags
		c.HMACAuths = append(c.HMACAuths, cred)
		return cred, nil
	case "oauth2":
		cred, err := NewOauth2Credential(credConfig)
		if err != nil {
			return nil, err
		}
		cred.Tags = tags
		c.Oauth2Creds = append(c.Oauth2Creds, cred)
		return cred, nil
	case "jwt", "jwt_secret":
		cred, err := NewJWTAuth(credConfig)
		if err != nil {
			return nil, err
		}
		cred.Tags = tags
		c.JWTAuths = append(c.JWTAuths, cred)
		return cred, nil
	case "acl":
		cred, err := NewACLGroup(credConfig)
		if err != nil {
			return nil, err
		}
		cred.Tags = tags
		c.ACLGroups = append(c.ACLGroups, cred)
		return cred, nil
	case "mtls-auth":
		cred, err := NewMTLSAuth(credConfig)
		if err != nil {
			return nil, err
		}
		cred.Tags = tags
		c.MTLSAuths = append(c.MTLSAuths, cred)
		return cred, nil
	default:
		return nil, fmt.Errorf("invalid credential type: '%v'", credType)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7869** (2026-06-12): **3.4.12 breaks clusters with Kong OSS (3.9)**
  *Symptoms*: Hi, while I can understand you are pivoting business model and [deprecating the Kong OSS & free versions](https://github.com/Kong/kong/discussions/14628), it seems you released a version of KIC breaking all the clusters running Kong v3.9.  However, from the PR in question (#7853), you knew this would happen (cf. https://github.com/Kong/kubernetes-ingress-controller/blob/247aeb9006abd52f92ae6d7ee306842bae098a54/internal/dataplane/testdata/golden/ingress-v1-rule-with-tls-and-consumer-ee/note.txt).  You still proceeded without any care for anyone working in the field, and released your backwards-incompatible version as a **patch** that would auto-update with the default tag in the Helm chart being `3.4`.  This kind of predatory behavior is one you should be ashamed of.  ---  For anyone stumbling into this issue, the fix is to lock the KIC to the `3.4.11` tag, maybe even with the hash to prevent any further breakage from upstream.  Further remediation will be to completely switch away from this software altogether.
  **Post-Mortem & Fix Analysis**:
  > This caused some significant downtime for our test environment yesterday, and it's only by sheer luck that it didn't happen in production. Not only is it insane to release a breaking change in a patch release, but the `kong` chart only pins the minor version in the image tag for the controller! As Helm themselves say [in their docs](https://helm.sh/docs/chart_best_practices/pods#images), the image tag should not be "floating".
  > This broke our production for several hours. 😢
  > The change that caused this (https://github.com/Kong/kubernetes-ingress-controller/pull/7853) has been merged to mitigate an issue (https://github.com/Kong/kubernetes-ingress-controller/issues/7831) which has been inaccurately triaged: it aimed to fix a related issue which only affected 3.9.x versions where an invalid part of the config (e.g. invalid CA) would cause errors for SNIs with certificate backreference. SNI certificate backreferences are optional in 3.10.x (they are not required in db less mode) and later versions of Kong but are required in 3.9 and older (due to a bug which was fixed in 3.10) hence this only breaking 3.9 (or older versions).  We've released [3.4.13](https://github.com/Kong/kubernetes-ingress-controller/releases/tag/v3.4.13) (and will release 3.5.6) reverting aforementioned change to mitigate the issue for 3.9.x users.  I'm going to leave this open for a while to monitor if there are any further reports about this. 

- **Issue #7859** (2026-03-16): **`protocols` field in transalated Kong routes are not set when expression based routes enbled**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  From FTI-7350. In the expression based translator, KIC does not add the `protocols` field but uses the default value. In Kong gateway 3.14+ the default protocols for routes changed to `https` only. So when running with expression based router, the integration/e2e tests fails.  ### Expected Behavior  The integration/e2e tests against Kong 3.14 passes.  ### Steps To Reproduce  ```markdown  Run integration tests/e2e tests with Kong gateway 3.14.x: $ export TEST_KONG_IMAGE="kong/kong-gateway-dev" $ export TEST_KONG_TAG="3.14.0.0-rc.1" $ export TEST_KONG_EFFECTIVE_VERSION="3.14.0" $ make test.integration.dbless   ```  ### Kong Ingress Controller version  ```shell 3.4.x ```  ### Kubernetes version  ```shell  ```  ### Anything else?  _No response_

- **Issue #7855** (2026-03-13): **KIC 3.5.4 — Liveness/Readiness probes failing: dial tcp :10254: connect: connection refused**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  In Kong Ingress Controller 3.5.4, the container repeatedly fails both liveness and readiness probes: Liveness probe failed: dial tcp :10254: connect: connection refused Readiness probe failed: dial tcp :10254: connect: connection refused  This results in the controller going into CrashLoopBackOff. The issue happens immediately after pod start — the controller never opens port 10254, which is the expected health endpoint. i have open the network policy for both pods still same issue and kong-proxy-server is up and running   ### Expected Behavior  _No response_  ### Steps To Reproduce  ```markdown  ```  ### Kong Ingress Controller version  ```shell Environment  KIC Version: 3.5.4 (Confirmed from Docker Hub / release tags) Image: kong/kubernetes-ingress-controller:3.5.4 Kubernetes: eks 1.32 Helm Chart: no , manual deployment  Kong Gateway: 3.9.1 ```  ### Kubernetes version  ```shell 1.32 ```  ### Anything else?  _No response_
  **Post-Mortem & Fix Analysis**:
  > @mullasaddam Could you please provide the manifests to deploy KIC? I think it should be a misconfiugration in the manifests.

- **Issue #7831** (2026-02-11): **KIC 3.4.0+ sets certificate foreign key on nested SNIs causing "value must be null" rejection in DB-less mode**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  When KIC pushes declarative config to Kong Gateway in DB-less mode, all certificate entities with nested SNIs are rejected by the gateway with the error "value must be null" at the entity   level. This causes a full sync failure -- both the primary config push and the fallback recovery fail with HTTP 400, putting the controller in an endless error loop. No Kubernetes Events   are emitted for these errors because the certificate entities lack k8s metadata tags in the error response.    The root cause is PR #6660 (commit 9517268c9, shipped in KIC 3.4.0), which sets an explicit certificate back-reference on nested SNI objects in internal/dataplane/deckgen/deckgen.go:50-64:  ```   if kongCert.ID != nil {       kongSNI.Certificate = &kong.Certificate{           ID: kongCert.ID,       }   } ```    In DB-less/declarative mode, Kong's schema transformation (kong/db/schema/others/declarative_config.lua) enforces eq = null on all foreign key fields in nested entities, because the   parent-child relationship is already implied by the nesting. The explicit certificate.id back-reference on nested SNIs violates this constraint.  ### Expected Behavior  The certificate foreign key field on nested SNIs should be omitted (or set to null) when generating declarative config for DB-less mode. The back-reference is redundant in declarative   config since the SNI is already nested inside its p
  **Post-Mortem & Fix Analysis**:
  > This is still issue in 3.5.4
  > No users of DB-less mode? Kong is useless because of this.
  > https://github.com/Kong/kubernetes-ingress-controller/pull/7853 should fix this.

- **Issue #7825** (2026-03-20): **429 Happens in Reconciliation with Konnect**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  When the configuration is large enough (~100k services), the uploading of configuration to Konnect gets the 429 response and the requests keeps being retried. So the configuration cannot be updated on Konnect in time and Konnect receives a high load of requests.  ### Expected Behavior  Requests are sent to Konnect in a proper rate and does not trigger `429`s.  ### Steps To Reproduce  ```markdown  ```  ### Kong Ingress Controller version  ```shell  ```  ### Kubernetes version  ```shell  ```  ### Anything else?  Possible resolutions: - Reduce the concurrency of KIC uploading config to Konnect - Increase the default interval of uploading config to Konnect ~- Interrupt the retries when new round of uploading starts~

- **Issue #7822** (2026-02-06): **Kong gateway Listeners incorrect on hybrid mode**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  When I have   - 1  Control plane -  4 Dataplane - 1 Ingress Controller  The Ingress Controller tries to retrieve the proxy_listeners & stream_listeners from admin_api,   When I ran the call on the Control Plane it returns me :   ```  "proxy_listeners": {}, "stream_listeners": {}, "stream_proxy_ssl_enabled": false, "admin_gui_ssl_enabled": true ```  This call is made by the API Gateway Controller here :  https://github.com/Kong/kubernetes-ingress-controller/blob/92b4ae93001cfec26df4b5a9a58008d30d568be8/internal/dataplane/kong_client.go#L351C33-L362  This behavior is rejecting all my Gateway since KIC v3.5.2 with this status :   ``` spec:   gatewayClassName: kong-ingress   listeners:     - allowedRoutes:         namespaces:           from: All       name: proxy-ssl       port: 8443       protocol: HTTPS       tls:         certificateRefs:           - group: ''             kind: Secret             name: proxy-certificate         mode: Terminate status:   addresses:     - type: IPAddress       value: 0.0.0.0   conditions:     - lastTransitionTime: '2026-01-19T13:16:50Z'       message: this unmanaged gateway has been picked up by the controller and will be processed       observedGeneration: 1       reason: Accepted       status: 'True'       type: Accepted     - lastTransitionTime: '2026-01-19T13:16:50Z'       message: ''       observedGeneration: 1       reason: Programmed 
  **Post-Mortem & Fix Analysis**:
  > Seems to be linked with the modifications made on Kong Gateway v3.13.0.0 here  kong/conf_loader/init.lua  ```   if conf.role == "control_plane" then     -- control plane does not accept proxy traffic, so we disable those listeners     conf.proxy_listen = {"off"}     conf.stream_listen = {"off"}   end ```  
  > Fixed in v3.13.0.1

- **Issue #7819** (2026-01-10): **configuration.konghq.com/v1 KongIngress is deprecated**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  We are testing an upgrade of Kong API Gateway from: kong: 3.6 kubernetes-ingress-controller: 3.2 to: kong: 3.9 kubernetes-ingress-controller: 3.5 After the upgrade, we see the following warnings in the ingress-controller logs: `2026-01-09T14:12:17Z info controller-runtime.cache Warning: configuration.konghq.com/v1beta1 TCPIngress is deprecated {"v": 0}` ` 2026-01-09T14:13:20Z info controller-runtime.cache Warning: configuration.konghq.com/v1beta1 UDPIngress is deprecated {"v": 0}` ` 2026-01-09T14:14:54Z info controller-runtime.cache Warning: configuration.konghq.com/v1 KongIngress is deprecated {"v": 0}`  We do not use the KongIngress object anymore — we have migrated all its configuration to Ingress annotations. However, if we look at custom-resource-definitions.yaml, we can see that these CRDs are still present:  https://github.com/Kong/charts/blob/kong-3.0.2/charts/kong/crds/custom-resource-definitions.yaml#L1096 https://github.com/Kong/charts/blob/kong-3.0.2/charts/kong/crds/custom-resource-definitions.yaml#L3007 https://github.com/Kong/charts/blob/kong-3.0.2/charts/kong/crds/custom-resource-definitions.yaml#L3222  My understanding is that the ingress-controller checks for the presence of these CRDs and emits deprecation warnings even if the corresponding resources are not actually used. Is it expected behavior? Would it make sense (or be recommended) to remove these
  **Post-Mortem & Fix Analysis**:
  > You can get rid of those deprecation notices via the following values:  ``` controller:   ingressController:     env:       enable_controller_kongingress: "false"       enable_controller_tcpingress: "false"       enable_controller_udpingress: "false" ```  Conventionally, deprecated CRDs are kept because their removal would cause issues for users who keep using them (have objects of their types defined in their clusters).  Removing a CRD causes all the CRs of its type to be removed from the system which is considered a breaking behavior (and 3.5 is not a major release to do so).  Hope this clears things up. Since there's no action to perform I'm going to close this. Let us know if there's still something to clarify.
  > @pmalek  this worked thank you

- **Issue #7813** (2025-12-16): **Kong Ingress Controller Restart Loop - Leader Election Timeouts in Gateway Discovery Mode**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Current Behavior  Our team is using the following versions in gateway discovery mode: - Kong Ingress Controller: 2.12.8 - Kong Proxy: 3.3.1 We're experiencing frequent pod restarts (over 40 times in the past two days) due to leader election timeouts with the following error: ``` E1215 07:20:42.964371 1 leaderelection.go:369] Failed to update lock: Put "https://$api_server:443/apis/coordination.k8s.io/v1/namespaces/kong/leases/api-gateway": context deadline exceeded  I1215 07:20:42.964417 1 leaderelection.go:285] failed to renew lease kong/api-gateway: timed out waiting for the condition ``` Our Kong ingress controller has the following probe settings: ```yaml livenessProbe:   failureThreshold: 5   httpGet:     path: /healthz     port: healthz     scheme: HTTP   initialDelaySeconds: 5   periodSeconds: 30   successThreshold: 1   timeoutSeconds: 5 readinessProbe:   failureThreshold: 5   httpGet:     path: /readyz     port: healthz     scheme: HTTP   initialDelaySeconds: 5   periodSeconds: 30   successThreshold: 1   timeoutSeconds: 5 ```  Root Cause Analysis: -  Missing lease configuration: We need exposed lease configuration options to tune leader election behavior  ### Expected Behavior  The leader election can work as expected; the default setting is too aggressive.  ### Requested Changes  1. Add a toggle to control client-side rate limiting (to accommodate the [v0.21.0 breaking change](ht
  **Post-Mortem & Fix Analysis**:
  > Hi @yang-wang11 👋   Thanks for the issue (and the accompanying PR) 🙇  This does seem like a good idea to include the LE configuration knobs but at this moment we're not planning to include any new features to KIC. Further development is being done in KO now: https://github.com/Kong/kong-operator/.  I'm going to close this one for now. I've already created https://github.com/Kong/kong-operator/issues/2894 to track this in KO. Feel free to drop a comment there.

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

### Incident Patch 1: `b6da030f` (2026-09-20)
**Commit Message**: fix(test): Pass kong-effective-version to e2e in validating Kong image tests and fix GKEtest failures (#8089)

* pass kong-effective-version to e2e

* fix istio workflow

* list only live pods

* Use e2-standard-4 node to fix OOMs

**File**: `.github/workflows/_e2e_tests.yaml` (modified, +1/-0)
```diff
@@ -464,6 +464,7 @@ jobs:
           TEST_KONG_LOAD_IMAGES: ${{ inputs.load-local-image }}
           TEST_KONG_IMAGE: ${{ steps.split.outputs.kong-image }}
           TEST_KONG_TAG: ${{ steps.split.outputs.kong-tag }}
+          TEST_KONG_EFFECTIVE_VERSION: ${{ inputs.kong-effective-version }}
           KONG_LICENSE_DATA: ${{ steps.license.outputs.license }}
           KONG_CLUSTER_VERSION: ${{ matrix.kind }}
           ISTIO_VERSION: ${{ matrix.istio }}
```

**File**: `.github/workflows/validate_kong_image.yaml` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ jobs:
       distroless-image: ${{ fromJSON(github.event.inputs.distroless-image) }}
       kic-image: ${{ format('{0}:{1}', github.event.inputs.e2e-controller-image-repo, github.event.inputs.e2e-controller-image-tag) }}
       kong-image: ${{ format('{0}:{1}', github.event.inputs.kong-image-repo, github.event.inputs.kong-image-tag) }}
+      kong-effective-version: ${{ github.event.inputs.kong-effective-version }}
       load-local-image: false
       run-gke: true
       run-istio: true
```

**File**: `test/e2e/helpers_test.go` (modified, +16/-2)
```diff
@@ -228,6 +228,7 @@ func createGKEBuilder(t *testing.T) (*environments.Builder, error) {
 		WithName(name).
 		WithWaitForTeardown(testenv.WaitForClusterDelete()).
 		WithCreateSubnet(true).
+		WithNodeMachineType("e2-standard-4").
 		WithLabels(gkeTestClusterLabels())
 
 	if v := testenv.ClusterVersion(); v != "" {
@@ -868,7 +869,17 @@ func listPodsByLabels(
 	if err != nil {
 		return nil, err
 	}
-	return podList.Items, nil
+
+	// Exclude pods that are already being terminated: they still match the label
+	// selector until fully removed from the API, but callers only ever want live pods.
+	livePods := make([]corev1.Pod, 0, len(podList.Items))
+	for _, pod := range podList.Items {
+		if pod.DeletionTimestamp != nil {
+			continue
+		}
+		livePods = append(livePods, pod)
+	}
+	return livePods, nil
 }
 
 // scaleDeployment scales the deployment to the given number of replicas and waits for the replicas to be ready.
@@ -893,7 +904,10 @@ func scaleDeployment(ctx context.Context, t *testing.T, env environments.Environ
 		if err != nil {
 			return false
 		}
-		return deployment.Status.ReadyReplicas == replicas
+		// Status.Replicas counts all non-terminated pods matched by the selector, including
+		// ones still Terminating from a previous scale-down. Requiring it to match too ensures
+		// stragglers are fully gone before callers proceed, not just that new pods are ready.
+		return deployment.Status.Replicas == replicas && deployment.Status.ReadyReplicas == replicas
 	}, time.Minute*3, time.Second, "deployment %s did not scale to %d replicas", deployment.Name, replicas)
 }
 
```

---

### Incident Patch 2: `5f2cbbc4` (2026-09-18)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace (#8095)

Bumps [go.opentelemetry.io/otel/exporters/otlp/otlptrace](https://github.com/open-telemetry/opentelemetry-go) from 1.33.0 to 1.45.0.
- [Release notes](https://github.com/open-telemetry/opentelemetry-go/releases)
- [Changelog](https://github.com/open-telemetry/opentelemetry-go/blob/main/CHANGELOG.md)
- [Commits](https://github.com/open-telemetry/opentelemetry-go/compare/v1.33.0...v1.45.0)

---
updated-dependencies:
- dependency-name: go.opentelemetry.io/otel/exporters/otlp/otlptrace
  dependency-version: 1.45.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +11/-11)
```diff
@@ -23,7 +23,7 @@ require (
 	github.com/blang/semver/v4 v4.0.0
 	github.com/cnf/structhash v0.0.0-20250313080605-df4c6cc74a9a
 	github.com/dominikbraun/graph v0.23.0
-	github.com/go-logr/logr v1.4.3
+	github.com/go-logr/logr v1.4.4
 	github.com/go-logr/zapr v1.3.0
 	github.com/goccy/go-json v0.10.5
 	github.com/google/go-cmp v0.7.0
@@ -77,18 +77,18 @@ require (
 	github.com/ettle/strcase v0.2.0 // indirect
 	github.com/fsnotify/fsnotify v1.8.0 // indirect
 	github.com/google/cel-go v0.23.2 // indirect
-	github.com/grpc-ecosystem/grpc-gateway/v2 v2.24.0 // indirect
+	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 // indirect
 	github.com/moby/go-archive v0.1.0 // indirect
 	github.com/moby/sys/atomicwriter v0.1.0 // indirect
 	github.com/shirou/gopsutil/v4 v4.25.1 // indirect
 	github.com/stoewer/go-strcase v1.3.0 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.33.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.33.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.4.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.2 // indirect
-	go.yaml.in/yaml/v3 v3.0.3 // indirect
+	go.yaml.in/yaml/v3 v3.0.4 // indirect
 	k8s.io/apiserver v0.33.3 // indirect
 	k8s.io/component-helpers v0.33.3 // indirect
 	sigs.k8s.io/apiserver-network-proxy/konnectivity-client v0.31.2 // indirect
@@ -215,9 +215,9 @@ require (
 	github.com/yusufpapurcu/wmi v1.2.4 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.61.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 // indirect
-	go.opentelemetry.io/otel v1.44.0 // indirect
-	go.opentelemetry.io/otel/metric v1.44.0 // indirect
-	go.opentelemetry.io/otel/trace v1.44.0 // indirect
+	go.opentelemetry.io/otel v1.45.0 // indirect
+	go.opentelemetry.io/otel/metric v1.45.0 // indirect
+	go.opentelemetry.io/otel/trace v1.45.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go4.org/netipx v0.0.0-20231129151722-fdeea329fbba // indirect
 	golang.org/x/crypto v0.55.0 // indirect
@@ -232,8 +232,8 @@ require (
 	golang.org/x/time v0.15.0 // indirect
 	golang.org/x/tools v0.48.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a // indirect
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.12.0 // indirect
```

**File**: `go.sum` (modified, +24/-24)
```diff
@@ -125,8 +125,8 @@ github.com/gammazero/workerpool v1.1.3/go.mod h1:wPjyBLDbyKnUn2XwwyD3EEwo9dHutia
 github.com/go-errors/errors v1.4.2 h1:J6MZopCL4uSllY1OfXM374weqZFFItUbrImctkmUxIA=
 github.com/go-errors/errors v1.4.2/go.mod h1:sIVyrIiJhuEF+Pj9Ebtd6P/rEYROXFi3BopGUQ5a5Og=
 github.com/go-logr/logr v1.2.2/go.mod h1:jdQByPbusPIv2/zmleS9BjJVeZ6kBagPoEUsqbVz/1A=
-github.com/go-logr/logr v1.4.3 h1:CjnDlHq8ikf6E492q6eKboGOC0T8CDaOvkHCIg8idEI=
-github.com/go-logr/logr v1.4.3/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
+github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
+github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
 github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
 github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
 github.com/go-logr/zapr v1.3.0 h1:XGdV8XW8zdwFiwOA2Dryh1gj2KRQyOOoNmBy4EplIcQ=
@@ -190,8 +190,8 @@ github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674 h1:JeSE6pjso5T
 github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674/go.mod h1:r4w70xmWCQKmi1ONH4KIaBptdivuRPyosB9RmPlGEwA=
 github.com/gregjones/httpcache v0.0.0-20190611155906-901d90724c79 h1:+ngKgrYPPJrOjhax5N+uePQ0Fh1Z7PheYoUI/0nzkPA=
 github.com/gregjones/httpcache v0.0.0-20190611155906-901d90724c79/go.mod h1:FecbI9+v66THATjSRHfNgh1IVFe/9kFxbXtjV0ctIMA=
-github.com/grpc-ecosystem/grpc-gateway/v2 v2.24.0 h1:TmHmbvxPmaegwhDubVz0lICL0J5Ka2vwTzhoePEXsGE=
-github.com/grpc-ecosystem/grpc-gateway/v2 v2.24.0/go.mod h1:qztMSjm835F2bXf+5HKAPIS5qsmQDqZna/PgVt4rWtI=
+github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 h1:5VipnvEpbqr2gA2VbM+nYVbkIF28c5ZQfqCBQ5g2xfk=
+github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0/go.mod h1:Hyl3n6Twe1hvtd9XUXDec4pTvgMSEixRuQKPTMH2bNs=
 github.com/hashicorp/go-cleanhttp v0.5.2 h1:035FKYIWjmULyFRBKPs8TBQoi0x6d9G4xc9neXJWAZQ=
 github.com/hashicorp/go-cleanhttp v0.5.2/go.mod h1:kO/YDlP8L1346E6Sodw+PrpBSV4/SoxCXGY6BqNFT48=
 github.com/hashicorp/go-hclog v1.6.3 h1:Qr2kF+eVWjTiYmU7Y31tYlP1h0q/X3Nl3tPGdaB11/k=
@@ -454,24 +454,24 @@ go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.6
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.61.0/go.mod h1:snMWehoOh2wsEwnvvwtDyFCxVeDAODenXHtn5vzrKjo=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 h1:F7Jx+6hwnZ41NSFTO5q4LYDtJRXBf2PD0rNBkeB/lus=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0/go.mod h1:UHB22Z8QsdRDrnAtX4PntOl36ajSxcdUMt1sF7Y6E7Q=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.33.0 h1:Vh5HayB/0HHfOQA7Ctx69E/Y/DcQSMPpKANYVMQ7fBA=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.33.0/go.mod h1:cpgtDBaqD/6ok/UG0jT15/uKjAY8mRA53diogHBg3UI=
+go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
+go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.33.0 h1:5pojmb1U1AogINhN3SurB+zm/nIcusopeBNp42f45QM=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.33.0/go.mod h1:57gTHJSE5S1tqg+EKsLPlTWhpHMsWlVmer+LA926XiA=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.28.0 h1:j9+03ymgYhPKmeXGk5Zu+cIZOlVzd9Zv7QIiyItjFBU=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.28.0/go.mod h1:Y5+XiUG4Emn1hTfciPzGPJaSI+RpDts6BnCIir0SLqk=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
-go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
-go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
-go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
-go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
-go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
-go.opentelemetry.io/proto/otlp v1.4.0 h1:TA9WRvW6zMwP+Ssb6fLoUIuirti1gGbP28GcKG1jgeg=
-go.opentelemetry.io/proto/otlp v1.4.0/go.mod h1:PPBWZIP98o2ElSqI35IHfu7hIhSwvc5N38Jw8pXuGFY=
+go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
+go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
+go.opentelemetry.io/otel/sdk v1.45.0
```

---

### Incident Patch 3: `0d1f8fb6` (2026-09-16)
**Commit Message**: Fix(translator): split httproute match by path when they have PathPrefixRewrite filter (#8081)

* split httproute match by path when they have PathPrefixRewrite filter

* update changelog

* fix routes for requestRedirect filter

* update changelog

* update changelog

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -144,6 +144,12 @@ Adding a new version? You'll need three changes:
   creation timestamp, then lowest ID to keep the tags stable in merging certificates
   from multiple `Secret`s with the same certificate content.
   [#8085](https://github.com/Kong/kubernetes-ingress-controller/pull/8085)
+- Generate a distinct Kong route for each match when its parent `HTTPRoute` rule
+  contains `ReplacePrefixMatch` typed `URLRewrite` filter or `requestRedirect` filter.
+  NOTE: This would make the generate routes from the affected `HTTPRoute` rules
+  containing the filters to be deleted and re-created, and the names of the routes
+  are changed.
+  [#8081](https://github.com/Kong/kubernetes-ingress-controller/pull/8081)
 
 ## [3.5.13]
 
```

**File**: `internal/dataplane/translator/subtranslator/httproute.go` (modified, +72/-26)
```diff
@@ -318,6 +318,30 @@ func getHTTPRouteHostnamesAsSliceOfStringPointers(httproute *gatewayapi.HTTPRout
 	})
 }
 
+// filtersContainURLRewriteReplacePrefixMatch reports whether filters contains a URLRewrite filter
+// with a ReplacePrefixMatch path modifier. The rewritten path for such a filter depends on which
+// prefix matched, so matches sharing this filter must never be consolidated into a single Kong
+// route/plugin.
+func filtersContainURLRewriteReplacePrefixMatch(filters []gatewayapi.HTTPRouteFilter) bool {
+	return lo.ContainsBy(filters, func(filter gatewayapi.HTTPRouteFilter) bool {
+		return filter.Type == gatewayapi.HTTPRouteFilterURLRewrite &&
+			filter.URLRewrite.Path != nil &&
+			filter.URLRewrite.Path.Type == gatewayapi.PrefixMatchHTTPPathModifier &&
+			filter.URLRewrite.Path.ReplacePrefixMatch != nil
+	})
+}
+
+// filtersContainRequestRedirect reports whether filters contains a RequestRedirect filter. A
+// RequestRedirect's generated plugin (e.g. its Location header, when no path override is set)
+// generally depends on which match fired, so matches sharing this filter must never be
+// consolidated into a single Kong route/plugin either - see getRoutesFromMatches, which already
+// builds one independent route per match for this reason.
+func filtersContainRequestRedirect(filters []gatewayapi.HTTPRouteFilter) bool {
+	return lo.ContainsBy(filters, func(filter gatewayapi.HTTPRouteFilter) bool {
+		return filter.Type == gatewayapi.HTTPRouteFilterRequestRedirect
+	})
+}
+
 // translateHTTPRouteRulesMetaToKongstateRoutes translate the matches and filters under the rules sharing the same backends
 // to list of kongstate.Route.
 func translateHTTPRouteRulesMetaToKongstateRoutes(
@@ -334,9 +358,17 @@ func translateHTTPRouteRulesMetaToKongstateRoutes(
 		filters := rulesWithSameFilter[0].Rule.Filters
 		// Group the matches for each rule. Then aggregate the matches eligible for the consolidation
 		// into a single match group.
+		//
+		// ReplacePrefixMatch's rewritten path, and RequestRedirect's generated plugin, both depend on
+		// which match fired, so when either is present we must never fold matches from different
+		// rules together - keep every match in its own group.
+		keyFn := httpRouteMatchMeta.getKey
+		if filtersContainURLRewriteReplacePrefixMatch(filters) || filtersContainRequestRedirect(filters) {
+			keyFn = httpRouteMatchMeta.getUniqueKey
+		}
 		matchGroups := make(map[string]httpRouteMatchMetaList)
 		for _, ruleMeta := range rulesWithSameFilter {
-			ruleMatchGroups := groupSliceByKeyFn(ruleMeta.matches(), httpRouteMatchMeta.getKey)
+			ruleMatchGroups := groupSliceByKeyFn(ruleMeta.matches(), keyFn)
 			for matchGroupKey, matchGroup := range ruleMatchGroups {
 				matchGroups[matchGroupKey] = append(matchGroups[matchGroupKey], matchGroup...)
 			}
@@ -631,6 +663,13 @@ func (m httpRouteMatchMeta) getKey() string {
 	return mustMarshalJSON(keySource)
 }
 
+// getUniqueKey computes a key that is unique to this particular HTTPRouteMatch, i.e. it never
+// collides with the key of any other httpRouteMatchMeta. It is used in place of getKey() when
+// matches must not be consolidated with any other match, regardless of how similar they are.
+func (m httpRouteMatchMeta) getUniqueKey() string {
+	return fmt.Sprintf("%s/%s.%d.%d", m.parentRoute.Namespace, m.parentRoute.Name, m.RuleNumber, m.MatchNumber)
+}
+
 type httpRouteMatchMetaList []httpRouteMatchMeta
 
 func (l httpRouteMatchMetaList) httpRouteMatches() (
@@ -744,26 +783,22 @@ func GenerateKongRoutesFromHTTPRouteMatches(
 
 	// Check if the route has a RequestRedirect or URLRewrite with non-nil ReplacePrefixMatch - if it does, we need to
 	// generate a route for each match as the path is used to modify routes and generate plugins.
-	hasRedirectFilter := lo.ContainsBy(filters, func(filter gatewayapi.HTTPRouteFilter) bool {
-		return filter.Type == gatewayapi.HTTPRouteFilterRequestRedirect
-	})
+	hasRedirectFilter := filtersContainRequestRedirect(filters)
 
 	routes, err := getRoutesFromMatches(matches, &r, filters, tags, hasRedirectFilter, options.SupportRedirectPlugin)
 	if err != nil {
 		return nil, err
 	}
 
 	var path string
-	if hasURLRewriteWithReplacePrefixMatchFilter := lo.ContainsBy(filters, func(filter gatewayapi.HTTPRouteFilter) bool {
-		return filter.Type == gatewayapi.HTTPRouteFilterURLRewrite &&
-			filter.URLRewrite.Path != nil &&
-			filter.URLRewrite.Path.Type == gatewayapi.PrefixMatchHTTPPathModifier &&
-			filter.URLRewrite.Path.ReplacePrefixMatch != nil
-	}); hasURLRewriteWithReplacePrefixMatchFilter {
-		// In the case of URLRewrite with non-nil ReplacePrefixMatch, we rely on a CEL validation rule that disallows
-		// rules with multiple matches if the URLRewrite filter is present. We can be certain that if the filter is
-		// present, there is at most only one match. Based on that, we can determine the path from the first match.
-		// See: https://github.com/kubernetes-sigs/gateway-api/blob/29e68bf
```

**File**: `internal/dataplane/translator/subtranslator/httproute_test.go` (modified, +367/-0)
```diff
@@ -1782,6 +1782,296 @@ func TestTranslateHTTPRouteRulesMetaToKongstateRoutes(t *testing.T) {
 				},
 			},
 		},
+		{
+			// Reproduces a bug where two rules sharing backendRefs and the exact same
+			// URLRewrite/ReplacePrefixMatch filter, but with different match path prefixes, were
+			// consolidated into a single Kong route/plugin - so only the first rule's path prefix
+			// worked and the second 404'd. ReplacePrefixMatch's rewrite depends on which prefix
+			// matched, so Kong cannot express both prefixes as a single route + single plugin.
+			name: "rules sharing backendRefs and an identical URLRewrite ReplacePrefixMatch filter but different paths are kept separate",
+			rulesMeta: []httpRouteRuleMeta{
+				{
+					Rule: gatewayapi.HTTPRouteRule{
+						BackendRefs: backendRefList,
+						Filters: []gatewayapi.HTTPRouteFilter{
+							{
+								Type: gatewayapi.HTTPRouteFilterURLRewrite,
+								URLRewrite: &gatewayapi.HTTPURLRewriteFilter{
+									Path: &gatewayapi.HTTPPathModifier{
+										Type:               gatewayapi.PrefixMatchHTTPPathModifier,
+										ReplacePrefixMatch: lo.ToPtr("/anything"),
+									},
+								},
+							},
+						},
+						Matches: []gatewayapi.HTTPRouteMatch{
+							{
+								Path: &gatewayapi.HTTPPathMatch{
+									Type:  lo.ToPtr(gatewayapi.PathMatchPathPrefix),
+									Value: lo.ToPtr("/path-1"),
+								},
+							},
+						},
+					},
+					RuleNumber:  0,
+					parentRoute: httpRouteWithoutHost,
+				},
+				{
+					Rule: gatewayapi.HTTPRouteRule{
+						BackendRefs: backendRefList,
+						Filters: []gatewayapi.HTTPRouteFilter{
+							{
+								Type: gatewayapi.HTTPRouteFilterURLRewrite,
+								URLRewrite: &gatewayapi.HTTPURLRewriteFilter{
+									Path: &gatewayapi.HTTPPathModifier{
+										Type:               gatewayapi.PrefixMatchHTTPPathModifier,
+										ReplacePrefixMatch: lo.ToPtr("/anything"),
+									},
+								},
+							},
+						},
+						Matches: []gatewayapi.HTTPRouteMatch{
+							{
+								Path: &gatewayapi.HTTPPathMatch{
+									Type:  lo.ToPtr(gatewayapi.PathMatchPathPrefix),
+									Value: lo.ToPtr("/path-2"),
+								},
+							},
+						},
+					},
+					RuleNumber:  1,
+					parentRoute: httpRouteWithoutHost,
+				},
+			},
+			expectedRoutes: []kongstate.Route{
+				{
+					Route: kong.Route{
+						Name:         kong.String("httproute.default.httproute-1.0.0"),
+						Paths:        kong.StringSlice("~/path-1$", "~/path-1(/.*)"),
+						PreserveHost: kong.Bool(true),
+						StripPath:    kong.Bool(false),
+						Protocols:    nil,
+						Tags: []*string{
+							kong.String("k8s-name:httproute-1"),
+							kong.String("k8s-namespace:default"),
+							kong.String("k8s-kind:HTTPRoute"),
+							kong.String("k8s-group:gateway.networking.k8s.io"),
+							kong.String("k8s-version:v1"),
+						},
+					},
+					Plugins: []kong.Plugin{
+						{
+							Name: kong.String("request-transformer"),
+							Config: kong.Configuration{
+								"replace": TransformerPluginReplaceConfig{
+									URI: "/anything$(uri_captures[1])",
+								},
+							},
+							Tags: []*string{
+								kong.String("k8s-name:httproute-1"),
+								kong.String("k8s-namespace:default"),
+								kong.String("k8s-kind:HTTPRoute"),
+								kong.String("k8s-group:gateway.networking.k8s.io"),
+								kong.String("k8s-version:v1"),
+							},
+						},
+					},
+					Ingress: util.FromK8sObject(httpRouteWithoutHost),
+				},
+				{
+					Route: kong.Route{
+						Name:         kong.String("httproute.default.httproute-1.1.0"),
+						Paths:        kong.StringSlice("~/path-2$", "~/path-2(/.*)"),
+						PreserveHost: kong.Bool(true),
+						StripPath:    kong.Bool(false),
+						Protocols:    nil,
+						Tags: []*string{
+							kong.String("k8s-name:httproute-1"),
+							kong.String("k8s-namespace:default"),
+							kong.String("k8s-kind:HTTPRoute"),
+							kong.String("k8s-group:gateway.networking.k8s.io"),
+							kong.String("k8s-version:v1"),
+						},
+					},
+					Plugins: []kong.Plugin{
+						{
+							Name: kong.String("request-transformer"),
+							Config: kong.Configuration{
+								"replace": TransformerPluginReplaceConfig{
+									URI: "/anything$(uri_captures[1])",
+								},
+							},
+							Tags: []*string{
+								kong.String("k8s-name:httproute-1"),
+								kong.String("k8s-namespace:default"),
+								kong.String("k8s-kind:HTTPRoute"),
+								kong.String("k8s-group:gateway.networking.k8s.io"),
+								kong.String("k8s-version:v1"),
+							},
+						},
+					},
+					Ingress: util.FromK8sObject(httpRouteWithoutHost),
+				},
+			},
+		},
+		{
+			// Reproduces a bug where two rules sharing backendRefs and the exact same
+			// RequestRedirect filter, but with different match path prefixes, were consolidated
+			// into a single Kong route/plugin - a RequestRedirect's Location header (when no path
+			// override is set) depends on which path matched, so Kong cannot express both paths'
+			// redirect
```

---

### Incident Patch 4: `5af2417f` (2026-09-15)
**Commit Message**: fix(translator): set tags to the winning cert in merging certificates (#8085)

* fix: set tags to the winning cert in merging certificates

* add test cases and changelog

* address comments

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -136,6 +136,15 @@ Adding a new version? You'll need three changes:
 - [0.0.5](#005)
 - [0.0.4 and prior](#004-and-prior)
 
+## Unreleased
+
+### Fixed
+
+- Inherit the tags of the translated Kong certificate from the one with earliest
+  creation timestamp, then lowest ID to keep the tags stable in merging certificates
+  from multiple `Secret`s with the same certificate content.
+  [#8085](https://github.com/Kong/kubernetes-ingress-controller/pull/8085)
+
 ## [3.5.13]
 
 > Release date: 2026-08-07
```

**File**: `internal/dataplane/translator/translate_certs.go` (modified, +3/-1)
```diff
@@ -245,14 +245,16 @@ func mergeCerts(logger logr.Logger, certLists ...[]certWrapper) ([]kongstate.Cer
 				current = cw
 			} else {
 				// multiple Secrets that contain identical certificates are collapsed, because we only create one
-				// Kong resource for a given cert+key pair. however, because we reuse the Secret ID and creation time
+				// Kong resource for a given cert+key pair. however, because we reuse the Secret ID, tags and creation time
 				// for the Kong resource equivalents, the selection of those needs to be deterministic to avoid
 				// pointless configuration updates
 				if current.CreationTimestamp.After(cw.CreationTimestamp.Time) {
 					current.cert.ID = cw.cert.ID
+					current.cert.Tags = cw.cert.Tags
 					current.CreationTimestamp = cw.CreationTimestamp
 				} else if current.CreationTimestamp.Time.Equal(cw.CreationTimestamp.Time) && (current.cert.ID == nil || *current.cert.ID > *cw.cert.ID) {
 					current.cert.ID = cw.cert.ID
+					current.cert.Tags = cw.cert.Tags
 					current.CreationTimestamp = cw.CreationTimestamp
 				}
 			}
```

**File**: `internal/dataplane/translator/translate_certs_test.go` (modified, +64/-2)
```diff
@@ -3,6 +3,7 @@ package translator
 import (
 	"sort"
 	"testing"
+	"time"
 
 	"github.com/go-logr/logr"
 	"github.com/kong/go-kong/kong"
@@ -335,6 +336,7 @@ func TestMergeCerts(t *testing.T) {
 		certs        []certWrapper
 		mergedCerts  []kongstate.Certificate
 		idToMergedID certIDToMergedCertID
+		tags         []string
 	}{
 		{
 			name: "single certificate",
@@ -407,23 +409,80 @@ func TestMergeCerts(t *testing.T) {
 			},
 		},
 		{
-			name: "multiple certs with same content should be merged",
+			name: "multiple certs with same content should be merged, and tags should inherit from the cert with the earliest CreationTimestamp",
 			certs: []certWrapper{
 				{
 					identifier: string(crt1) + string(key1),
 					cert: kong.Certificate{
 						ID:   kong.String("certificate-1"),
 						Cert: kong.String(string(crt1)),
 						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag1", "tag2"),
 					},
-					snis: []string{"foo.com"},
+					snis:              []string{"foo.com"},
+					CreationTimestamp: metav1.NewTime(time.Now()),
 				},
 				{
 					identifier: string(crt1) + string(key1),
 					cert: kong.Certificate{
 						ID:   kong.String("certificate-1-1"),
 						Cert: kong.String(string(crt1)),
 						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag3", "tag4"),
+					},
+					snis:              []string{"baz.com"},
+					CreationTimestamp: metav1.NewTime(time.Now().Add(-1 * time.Hour)),
+				},
+			},
+			mergedCerts: []kongstate.Certificate{
+				{
+					Certificate: kong.Certificate{
+						ID:   kong.String("certificate-1-1"),
+						Cert: kong.String(string(crt1)),
+						Key:  kong.String(string(key1)),
+						// SNIs should be sorted
+						SNIs: kong.StringSlice("baz.com", "foo.com"),
+						// tags should inherit from the cert with the earliest CreationTimestamp.
+						Tags: kong.StringSlice("tag3", "tag4"),
+					},
+				},
+			},
+			idToMergedID: certIDToMergedCertID{
+				// the cert with the earliest CreationTimestamp should be the merged cert ID
+				"certificate-1":   "certificate-1-1",
+				"certificate-1-1": "certificate-1-1",
+			},
+		},
+		{
+			name: "multiple certs with same content should be merged, and tags should inherit from the cert with the lowest ID",
+			certs: []certWrapper{
+				{
+					identifier: string(crt1) + string(key1),
+					cert: kong.Certificate{
+						ID:   kong.String("certificate-1-1"),
+						Cert: kong.String(string(crt1)),
+						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag3", "tag4"),
+					},
+					snis: []string{"baz.com"},
+				},
+				{
+					identifier: string(crt1) + string(key1),
+					cert: kong.Certificate{
+						ID:   kong.String("certificate-1"),
+						Cert: kong.String(string(crt1)),
+						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag1", "tag2"),
+					},
+					snis: []string{"foo.com"},
+				},
+				{
+					identifier: string(crt1) + string(key1),
+					cert: kong.Certificate{
+						ID:   kong.String("certificate-1-2"),
+						Cert: kong.String(string(crt1)),
+						Key:  kong.String(string(key1)),
+						Tags: kong.StringSlice("tag5", "tag6"),
 					},
 					snis: []string{"baz.com"},
 				},
@@ -436,12 +495,15 @@ func TestMergeCerts(t *testing.T) {
 						Key:  kong.String(string(key1)),
 						// SNIs should be sorted
 						SNIs: kong.StringSlice("baz.com", "foo.com"),
+						// tags should inherit from the cert with the lowest ID.
+						Tags: kong.StringSlice("tag1", "tag2"),
 					},
 				},
 			},
 			idToMergedID: certIDToMergedCertID{
 				"certificate-1":   "certificate-1",
 				"certificate-1-1": "certificate-1",
+				"certificate-1-2": "certificate-1",
 			},
 		},
 	}
```

---

### Incident Patch 5: `bb6b1b7a` (2026-08-04)
**Commit Message**: fix(ci): use correct OSS nightly Kong version (#8047)

Signed-off-by: Jintao Zhang <[REDACTED_EMAIL]>

**File**: `.github/workflows/e2e_nightly.yaml` (modified, +3/-1)
```diff
@@ -54,7 +54,9 @@ jobs:
     with:
       kong-container-repo: kong/kong-dev
       kong-container-tag: nightly
-      kong-oss-effective-version: "3.15.0"
+      # OSS and Enterprise nightly images report different versions. Keep this
+      # aligned with the version reported by kong/kong-dev:nightly.
+      kong-oss-effective-version: "3.10.0"
       kong-enterprise-container-repo: kong/kong-gateway-dev
       kong-enterprise-container-tag: nightly
       kong-enterprise-effective-version: "3.15.0"
```

---

### Incident Patch 6: `d81ffd3b` (2026-08-02)
**Commit Message**: test: fix Kong version detection for nightly images (#8046)

Signed-off-by: Jintao Zhang <[REDACTED_EMAIL]>

**File**: `.github/workflows/e2e_nightly.yaml` (modified, +3/-3)
```diff
@@ -43,7 +43,7 @@ jobs:
       # it reports the next release to be released as semver in the version field.
       # ref: https://github.com/Kong/kubernetes-ingress-controller/issues/4014
       kong-image: kong/kong-gateway-dev:nightly
-      kong-effective-version: "3.4.1"
+      kong-effective-version: "3.15.0"
       all-supported-k8s-versions: false
       run-gke: false
       run-istio: false
@@ -54,10 +54,10 @@ jobs:
     with:
       kong-container-repo: kong/kong-dev
       kong-container-tag: nightly
-      kong-oss-effective-version: "3.4.1"
+      kong-oss-effective-version: "3.15.0"
       kong-enterprise-container-repo: kong/kong-gateway-dev
       kong-enterprise-container-tag: nightly
-      kong-enterprise-effective-version: "3.4.1"
+      kong-enterprise-effective-version: "3.15.0"
       log-output-file:  /tmp/integration-tests-kic-logs
 
   test-reports:
```

**File**: `.github/workflows/e2e_targeted.yaml` (modified, +1/-0)
```diff
@@ -118,6 +118,7 @@ jobs:
       kic-image: ${{ needs.choose-image.outputs.image }}
       load-local-image: ${{ inputs.controller-image == '' }}
       kong-image: kong/kong-gateway-dev:nightly
+      kong-effective-version: "3.15.0"
       # these do not honor the inputs, as this job is intended to be a minimal
       # test against unreleased kong images, with the main run covering the
       # other test conditions
```

**File**: `test/conformance/suite_test.go` (modified, +6/-1)
```diff
@@ -51,7 +51,12 @@ var (
 )
 
 func TestMain(m *testing.M) {
-	if testenv.IsKongGatewayVersionEnterpriseOnly() && testenv.KongLicenseData() == "" {
+	enterpriseOnly, err := testenv.IsKongGatewayVersionEnterpriseOnly()
+	if err != nil {
+		fmt.Printf("ERROR: failed to determine Kong Gateway version: %v\n", err)
+		os.Exit(1)
+	}
+	if enterpriseOnly && testenv.KongLicenseData() == "" {
 		fmt.Println("ERROR: Kong 3.15+ used and no license provided")
 		os.Exit(1)
 	}
```

**File**: `test/integration/isolated/suite_test.go` (modified, +6/-1)
```diff
@@ -44,7 +44,12 @@ var tenv env.Environment
 // -----------------------------------------------------------------------------
 
 func TestMain(m *testing.M) {
-	if testenv.IsKongGatewayVersionEnterpriseOnly() && testenv.KongLicenseData() == "" {
+	enterpriseOnly, err := testenv.IsKongGatewayVersionEnterpriseOnly()
+	if err != nil {
+		fmt.Printf("ERROR: failed to determine Kong Gateway version: %v\n", err)
+		os.Exit(1)
+	}
+	if enterpriseOnly && testenv.KongLicenseData() == "" {
 		fmt.Println("ERROR: Kong 3.15+ used and no license provided")
 		os.Exit(1)
 	}
```

**File**: `test/integration/suite_test.go` (modified, +6/-1)
```diff
@@ -38,7 +38,12 @@ import (
 var kongGatewayVersion kongversion.Version
 
 func TestMain(m *testing.M) {
-	if testenv.IsKongGatewayVersionEnterpriseOnly() && testenv.KongLicenseData() == "" {
+	enterpriseOnly, err := testenv.IsKongGatewayVersionEnterpriseOnly()
+	if err != nil {
+		fmt.Printf("ERROR: failed to determine Kong Gateway version: %v\n", err)
+		os.Exit(1)
+	}
+	if enterpriseOnly && testenv.KongLicenseData() == "" {
 		fmt.Println("ERROR: Kong 3.15+ used and no license provided")
 		os.Exit(1)
 	}
```

**File**: `test/internal/helpers/ktf.go` (modified, +1/-15)
```diff
@@ -6,7 +6,6 @@ import (
 
 	"github.com/blang/semver/v4"
 	"github.com/kong/kubernetes-testing-framework/pkg/clusters/addons/kong"
-	kongsemver "github.com/kong/semver/v4"
 
 	dpconf "github.com/kong/kubernetes-ingress-controller/v3/internal/dataplane/config"
 	"github.com/kong/kubernetes-ingress-controller/v3/test/consts"
@@ -15,20 +14,7 @@ import (
 
 // GetKongImageVersion returns the Kong version to be used for the KTF addon based on environment variables.
 func GetKongImageVersion() (semver.Version, error) {
-	kongVersion, err := semver.Parse(testenv.KongEffectiveVersion())
-	if err == nil {
-		return kongVersion, nil
-	}
-	// Use kong/semver to parse the version string in the TEST_KONG_TAG in case it is a four-digit version like "3.15.0.0".
-	kongsemverVersion, err := kongsemver.Parse(testenv.KongTag())
-	if err != nil {
-		return semver.Version{}, fmt.Errorf("could not parse Kong version from TEST_KONG_EFFECTIVE_VERSION or TEST_KONG_TAG: %w", err)
-	}
-	return semver.Version{
-		Major: kongsemverVersion.Major,
-		Minor: kongsemverVersion.Minor,
-		Patch: kongsemverVersion.Patch,
-	}, nil
+	return testenv.KongImageVersion()
 }
 
 // GenerateKongBuilder returns a Kong KTF addon builder, a string slice
```

**File**: `test/internal/testenv/testenv.go` (modified, +30/-6)
```diff
@@ -7,7 +7,6 @@ import (
 
 	"github.com/blang/semver/v4"
 	kongsemver "github.com/kong/semver/v4"
-	"github.com/samber/lo"
 	"github.com/tidwall/gjson"
 	"sigs.k8s.io/yaml"
 
@@ -84,13 +83,38 @@ func KongTag() string {
 	return os.Getenv("TEST_KONG_TAG")
 }
 
+// KongImageVersion returns the effective Kong Gateway version configured for tests.
+// The effective version takes precedence because image tags such as "nightly" are not
+// valid semantic versions. If no image override is configured, it returns the zero
+// version: those tests use the version from their checked-in manifest or default chart.
+func KongImageVersion() (semver.Version, error) {
+	version, source := KongEffectiveVersion(), "TEST_KONG_EFFECTIVE_VERSION"
+	if version == "" {
+		version, source = KongTag(), "TEST_KONG_TAG"
+	}
+	if version == "" {
+		return semver.Version{}, nil
+	}
+
+	parsed, err := kongsemver.Parse(version)
+	if err != nil {
+		return semver.Version{}, fmt.Errorf("could not parse Kong version %q from %s: %w", version, source, err)
+	}
+	return semver.Version{
+		Major: parsed.Major,
+		Minor: parsed.Minor,
+		Patch: parsed.Patch,
+	}, nil
+}
+
 // IsKongGatewayVersionEnterpriseOnly indicates if the Kong Gateway
 // version is enterprise only (basically unusable without license).
-func IsKongGatewayVersionEnterpriseOnly() bool {
-	parsed := lo.Must(kongsemver.Parse(KongTag()))
-	v := semver.Version{Major: parsed.Major, Minor: parsed.Minor, Patch: parsed.Patch}
-
-	return v.GTE(versions.KongEnterpriseCutoff)
+func IsKongGatewayVersionEnterpriseOnly() (bool, error) {
+	v, err := KongImageVersion()
+	if err != nil {
+		return false, err
+	}
+	return v.GTE(versions.KongEnterpriseCutoff), nil
 }
 
 // KongImageTag is the combined Kong image and tag if both are set, or empty string if not.
```

**File**: `test/internal/testenv/testenv_test.go` (modified, +75/-7)
```diff
@@ -3,17 +3,80 @@ package testenv_test
 import (
 	"testing"
 
+	"github.com/blang/semver/v4"
 	"github.com/stretchr/testify/require"
 
 	"github.com/kong/kubernetes-ingress-controller/v3/test/internal/testenv"
 )
 
+func TestKongImageVersion(t *testing.T) {
+	tests := []struct {
+		name             string
+		effectiveVersion string
+		kongTag          string
+		expected         semver.Version
+		expectError      bool
+	}{
+		{
+			name:     "no image override",
+			expected: semver.Version{},
+		},
+		{
+			name:             "effective version takes precedence over nightly tag",
+			effectiveVersion: "3.15.0",
+			kongTag:          "nightly",
+			expected:         semver.MustParse("3.15.0"),
+		},
+		{
+			name:     "three-part tag",
+			kongTag:  "3.14.0",
+			expected: semver.MustParse("3.14.0"),
+		},
+		{
+			name:     "four-part tag",
+			kongTag:  "3.15.0.0-rc.6",
+			expected: semver.MustParse("3.15.0"),
+		},
+		{
+			name:             "invalid effective version",
+			effectiveVersion: "invalid",
+			kongTag:          "3.15.0.0",
+			expectError:      true,
+		},
+		{
+			name:        "invalid tag",
+			kongTag:     "nightly",
+			expectError: true,
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Setenv("TEST_KONG_EFFECTIVE_VERSION", tc.effectiveVersion)
+			t.Setenv("TEST_KONG_TAG", tc.kongTag)
+
+			actual, err := testenv.KongImageVersion()
+			if tc.expectError {
+				require.Error(t, err)
+				return
+			}
+			require.NoError(t, err)
+			require.Equal(t, tc.expected, actual)
+		})
+	}
+}
+
 func TestIsKongGatewayEnterpriseOnly(t *testing.T) {
 	tests := []struct {
-		name     string
-		kongTag  string
-		expected bool
+		name             string
+		effectiveVersion string
+		kongTag          string
+		expected         bool
 	}{
+		{
+			name:     "no image override",
+			expected: false,
+		},
 		{
 			name:     "below cutoff - three-part",
 			kongTag:  "3.14.0",
@@ -25,9 +88,10 @@ func TestIsKongGatewayEnterpriseOnly(t *testing.T) {
 			expected: false,
 		},
 		{
-			name:     "at cutoff - four-part",
-			kongTag:  "3.15.0.0",
-			expected: true,
+			name:             "at cutoff - effective version for nightly",
+			effectiveVersion: "3.15.0",
+			kongTag:          "nightly",
+			expected:         true,
 		},
 		{
 			name:     "at cutoff - four-part with rc pre-release",
@@ -48,8 +112,12 @@ func TestIsKongGatewayEnterpriseOnly(t *testing.T) {
 
 	for _, tc := range tests {
 		t.Run(tc.name, func(t *testing.T) {
+			t.Setenv("TEST_KONG_EFFECTIVE_VERSION", tc.effectiveVersion)
 			t.Setenv("TEST_KONG_TAG", tc.kongTag)
-			require.Equal(t, tc.expected, testenv.IsKongGatewayVersionEnterpriseOnly())
+
+			actual, err := testenv.IsKongGatewayVersionEnterpriseOnly()
+			require.NoError(t, err)
+			require.Equal(t, tc.expected, actual)
 		})
 	}
 }
```

---

### Incident Patch 7: `9c3ef379` (2026-06-22)
**Commit Message**: tests: fix TestDiagnosticsServer_Diffs (#8001)

**File**: `internal/diagnostics/server_test.go` (modified, +28/-5)
```diff
@@ -93,8 +93,24 @@ func TestDiagnosticsServer_Diffs(t *testing.T) {
 		last = diff.Hash
 	}
 
-	// request the diff report
+	// Wait for all diffs to be processed by the collector before making HTTP requests.
+	// This prevents race conditions where the HTTP handler might return data before all
+	// diffs have been stored in the collector's diff map.
 	httpClient := &http.Client{}
+	require.EventuallyWithT(t, func(t *assert.CollectT) {
+		resp, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/debug/config/diff-report", port))
+		require.NoError(t, err)
+		defer resp.Body.Close()
+
+		got := DiffResponse{}
+		require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
+
+		// Check that all sent diffs have been processed.
+		require.Len(t, got.Available, configDumpsToWrite, "expected all %d diffs to be available", configDumpsToWrite)
+	}, time.Second*5, time.Millisecond*10, "all diffs should be processed")
+
+	// Request the diff report.
+
 	resp, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/debug/config/diff-report", port))
 	require.NoError(t, err)
 	defer resp.Body.Close()
@@ -125,6 +141,14 @@ func TestDiagnosticsServer_Diffs(t *testing.T) {
 	configDiffs[extra.Hash] = extra
 	diffCh <- extra
 
+	// Wait for the extra diff to be processed before checking the results.
+	require.EventuallyWithT(t, func(t *assert.CollectT) {
+		resp, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/debug/config/diff-report?hash=%s", port, extra.Hash))
+		require.NoError(t, err)
+		defer resp.Body.Close()
+		require.Equal(t, http.StatusOK, resp.StatusCode, "extra diff should be available")
+	}, time.Second*5, time.Millisecond*10, "extra diff should be processed")
+
 	second, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/debug/config/diff-report", port))
 	require.NoError(t, err)
 	defer second.Body.Close()
@@ -193,13 +217,12 @@ func setupTestServer(ctx context.Context, t *testing.T) (Client, int) {
 	t.Log("Started diagnostics collector")
 
 	// Wait for the server to be ready
-	require.Eventually(t, func() bool {
+	require.EventuallyWithT(t, func(c *assert.CollectT) {
 		conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%d", port))
-		if err != nil {
-			return false
+		if !assert.NoError(c, err) {
+			return
 		}
 		conn.Close()
-		return true
 	}, 5*time.Second, 100*time.Millisecond, "Server should be ready")
 
 	return client, port
```

---

### Incident Patch 8: `287127f9` (2026-06-18)
**Commit Message**: fix: fix missing certificate tags (#7991)

* fix: fix missing certificate tags

* Apply suggestion from @programmer04

Co-authored-by: Jakub Warczarek <[REDACTED_EMAIL]>

* Apply suggestion from @programmer04

Co-authored-by: Jakub Warczarek <[REDACTED_EMAIL]>

* chore: fix linter issues

---------

Co-authored-by: Jakub Warczarek <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -134,6 +134,8 @@ Adding a new version? You'll need three changes:
 - Prevent recreating consumer credentials on every Konnect sync when running in
   KIC in Konnect mode.
   [#7978](https://github.com/Kong/kubernetes-ingress-controller/pull/7978)
+- Fix missing certificate tags in generated config.
+  [#7991](https://github.com/Kong/kubernetes-ingress-controller/pull/7991)
 
 ## [3.5.9]
 
```

**File**: `internal/dataplane/deckgen/deckgen.go` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ func GetFCertificateFromKongCert(kongCert kong.Certificate) file.FCertificate {
 	if kongCert.Cert != nil {
 		res.Cert = kong.String(*kongCert.Cert)
 	}
+	res.Tags = kongCert.Tags
 	res.SNIs = getCertsSNIs(kongCert)
 	return res
 }
```

**File**: `internal/dataplane/deckgen/deckgen_test.go` (modified, +58/-0)
```diff
@@ -10,6 +10,64 @@ import (
 	"github.com/kong/kubernetes-ingress-controller/v3/internal/dataplane/deckgen"
 )
 
+func TestGetFCertificateFromKongCert(t *testing.T) {
+	const (
+		certID  = "c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af"
+		certPEM = "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----"
+		keyPEM  = "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----"
+		sniName = "example.com"
+		tag1    = "k8s-name:sooper-secret"
+		tag2    = "k8s-namespace:bar-namespace"
+	)
+
+	testCases := []struct {
+		name     string
+		input    kong.Certificate
+		wantTags []*string
+	}{
+		{
+			name: "copies tags",
+			input: kong.Certificate{
+				ID:   kong.String(certID),
+				Cert: kong.String(certPEM),
+				Key:  kong.String(keyPEM),
+				SNIs: []*string{kong.String(sniName)},
+				Tags: []*string{kong.String(tag1), kong.String(tag2)},
+			},
+			wantTags: []*string{kong.String(tag1), kong.String(tag2)},
+		},
+		{
+			name: "nil tags",
+			input: kong.Certificate{
+				ID:   kong.String(certID),
+				Cert: kong.String(certPEM),
+				Key:  kong.String(keyPEM),
+				SNIs: []*string{kong.String(sniName)},
+				Tags: nil,
+			},
+			wantTags: nil,
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			got := deckgen.GetFCertificateFromKongCert(tc.input)
+
+			require.Equal(t, tc.input.ID, got.ID)
+			require.Equal(t, tc.input.Cert, got.Cert)
+			require.Equal(t, tc.input.Key, got.Key)
+			require.Equal(t, tc.wantTags, got.Tags)
+
+			require.Len(t, got.SNIs, len(tc.input.SNIs))
+			for i, sni := range got.SNIs {
+				require.Equal(t, tc.input.SNIs[i], sni.Name)
+				require.NotNil(t, sni.Certificate)
+				require.Equal(t, tc.input.ID, sni.Certificate.ID)
+			}
+		})
+	}
+}
+
 func TestIsContentEmpty(t *testing.T) {
 	testCases := []struct {
 		name    string
```

**File**: `internal/dataplane/testdata/golden/ingress-v1-rule-with-tls-and-consumer/default_golden.yaml` (modified, +6/-0)
```diff
@@ -37,6 +37,12 @@ certificates:
   - certificate:
       id: c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
     name: 2.example.com
+  tags:
+  - k8s-name:sooper-secret
+  - k8s-namespace:bar-namespace
+  - k8s-kind:Secret
+  - k8s-uid:c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
+  - k8s-version:v1
 consumers:
 - basicauth_credentials:
   - password: consumer-1-password
```

**File**: `internal/dataplane/testdata/golden/ingress-v1-rule-with-tls-and-consumer/expression-routes-on_golden.yaml` (modified, +6/-0)
```diff
@@ -37,6 +37,12 @@ certificates:
   - certificate:
       id: c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
     name: 2.example.com
+  tags:
+  - k8s-name:sooper-secret
+  - k8s-namespace:bar-namespace
+  - k8s-kind:Secret
+  - k8s-uid:c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
+  - k8s-version:v1
 consumers:
 - basicauth_credentials:
   - password: consumer-1-password
```

**File**: `internal/dataplane/testdata/golden/ingress-v1-rule-with-tls/default_golden.yaml` (modified, +12/-0)
```diff
@@ -37,6 +37,12 @@ certificates:
   - certificate:
       id: 8aade13c-1470-46bd-9849-9a74e349214f
     name: 4.example.com
+  tags:
+  - k8s-name:sooper-secret2
+  - k8s-namespace:bar-namespace
+  - k8s-kind:Secret
+  - k8s-uid:8aade13c-1470-46bd-9849-9a74e349214f
+  - k8s-version:v1
 - cert: |-
     -----BEGIN CERTIFICATE-----
     MIIBoTCCAQoCCQC/V5OfTXu7xDANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDApr
@@ -74,6 +80,12 @@ certificates:
   - certificate:
       id: c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
     name: 2.example.com
+  tags:
+  - k8s-name:sooper-secret
+  - k8s-namespace:bar-namespace
+  - k8s-kind:Secret
+  - k8s-uid:c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
+  - k8s-version:v1
 services:
 - connect_timeout: 60000
   host: foo-svc.bar-namespace.80.svc
```

**File**: `internal/dataplane/testdata/golden/ingress-v1-rule-with-tls/expression-routes-on_golden.yaml` (modified, +12/-0)
```diff
@@ -37,6 +37,12 @@ certificates:
   - certificate:
       id: 8aade13c-1470-46bd-9849-9a74e349214f
     name: 4.example.com
+  tags:
+  - k8s-name:sooper-secret2
+  - k8s-namespace:bar-namespace
+  - k8s-kind:Secret
+  - k8s-uid:8aade13c-1470-46bd-9849-9a74e349214f
+  - k8s-version:v1
 - cert: |-
     -----BEGIN CERTIFICATE-----
     MIIBoTCCAQoCCQC/V5OfTXu7xDANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDApr
@@ -74,6 +80,12 @@ certificates:
   - certificate:
       id: c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
     name: 2.example.com
+  tags:
+  - k8s-name:sooper-secret
+  - k8s-namespace:bar-namespace
+  - k8s-kind:Secret
+  - k8s-uid:c6ac927c-4f5a-4e88-8b5d-c7b01d0f43af
+  - k8s-version:v1
 services:
 - connect_timeout: 60000
   host: foo-svc.bar-namespace.80.svc
```

---

### Incident Patch 9: `e1f58a00` (2026-06-17)
**Commit Message**: fix data race by using Eventually (#7979)

**File**: `internal/clients/manager_test.go` (modified, +7/-5)
```diff
@@ -519,11 +519,13 @@ func TestAdminAPIClientsManager_PeriodicReadinessReconciliation(t *testing.T) {
 	// Trigger a next readiness check which will make testURL2 ready.
 	readinessChecker.LetChecksReturn(clients.ReadinessCheckResult{ClientsTurnedReady: intoTurnedReady(testURL2)})
 	readinessTicker.Add(managercfg.DefaultDataPlanesReadinessReconciliationInterval)
-	readinessCheckCallEventuallyMatches(readinessCheckCall{
-		AlreadyCreatedURLs: []string{testURL1},
-		PendingURLs:        []string{testURL2},
-	})
-	require.Equal(t, 3, readinessChecker.CallsCount())
+	// Wait for CallsCount to reach 3 instead of relying on readinessCheckCallEventuallyMatches:
+	// the readiness check arguments here are identical to the previous step's (CheckReadiness is
+	// called with the pre-transition lists, so testURL2 is still pending), so LastCall already
+	// matches and would not synchronize with the tick-triggered check made by the manager goroutine.
+	require.Eventually(t, func() bool {
+		return readinessChecker.CallsCount() == 3
+	}, time.Second, time.Millisecond, "expected a third readiness check after the periodic tick")
 	require.True(t, lo.ContainsBy(m.GatewayClients(), func(c *adminapi.Client) bool {
 		return c.BaseRootURL() == testURL2
 	}), "expected to find the new client in the manager's clients list after it became ready")
```

---

### Incident Patch 10: `2af62b1b` (2026-06-16)
**Commit Message**: fix: fix credential recreation on every Konnect sync (#7978)

* fix: fix credential recreation on every Konnect sync

* Update CHANGELOG.md

Co-authored-by: Jintao Zhang <[REDACTED_EMAIL]>

* chore: rename credentialOps fields

* chore: comment for credential interface

---------

Co-authored-by: Jintao Zhang <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +19/-1)
```diff
@@ -125,24 +125,42 @@ Adding a new version? You'll need three changes:
 - [0.0.5](#005)
 - [0.0.4 and prior](#004-and-prior)
 
-## [3.5]
+## [3.5.10]
 
 > Release date: TBD
 
 ### Fixed
 
+- Prevent recreating consumer credentials on every Konnect sync when running in
+  KIC in Konnect mode.
+  [#7978](https://github.com/Kong/kubernetes-ingress-controller/pull/7978)
+
+## [3.5.9]
+
+> Release date: 2026-06-04
+
+### Fixed
+
 - Preserve the Admin API client's TLS server name (SNI) when a client turns pending and is
   recreated (e.g. after a gateway Pod restart). Previously the SNI was dropped on recreation,
   which, when gateway service discovery is combined with a mTLS-secured Admin API, caused
   permanent TLS verification failures against the recreated client.
   [#7950](https://github.com/Kong/kubernetes-ingress-controller/pull/7950)
+
+## [3.5.8]
+
+> Release date: 2026-06-01
+
+### Fixed
+
 - Revert plugin config sanitization `--dump-sensitive-config` isn't set.
   Due to plugin configuration being dependent on plugin type controller is not
   able to make an informed decision whether a field is sensitive or not and more
   importantly whether it has a constrained set of allowed values like e.g. HTTP methods.
   Users are suggested to block network access to debug endpoints (which are disabled
   by default) if plugin configuration can contain sensitive information.
   [#7937](https://github.com/Kong/kubernetes-ingress-controller/pull/7937)
+  [#7939](https://github.com/Kong/kubernetes-ingress-controller/pull/7939)
 
 ## [3.5.7]
 
```

**File**: `internal/dataplane/kongstate/consumer_test.go` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ func TestConsumer_SanitizedCopy(t *testing.T) {
 				Plugins: []kong.Plugin{{ID: kong.String("1")}},
 				KeyAuths: []*KeyAuth{
 					{
-						KeyAuth: kong.KeyAuth{ID: kong.String("1"), Key: kong.String("{vault://52fdfc07-2182-454f-963f-5f0f9a621d72}")},
+						KeyAuth: kong.KeyAuth{ID: kong.String("1"), Key: deterministicRedactedString("secret")},
 					},
 				},
 				HMACAuths: []*HMACAuth{
```

**File**: `internal/dataplane/kongstate/credentials.go` (modified, +21/-1)
```diff
@@ -1,6 +1,7 @@
 package kongstate
 
 import (
+	"crypto/sha256"
 	"fmt"
 
 	"github.com/kong/go-kong/kong"
@@ -21,6 +22,15 @@ func randRedactedString(uuidGenerator util.UUIDGenerator) *string {
 	return &s
 }
 
+// deterministicRedactedString returns a stable vault-URI redaction derived from seed.
+// It produces the same output for the same seed (no churn on unchanged credentials) while
+// remaining distinct for different seeds. The real secret value is not recoverable from the output.
+func deterministicRedactedString(seed string) *string {
+	sum := sha256.Sum256([]byte(seed))
+	s := fmt.Sprintf("{vault://%x}", sum[:16])
+	return &s
+}
+
 // KeyAuth represents a key-auth credential.
 type KeyAuth struct {
 	kong.KeyAuth
@@ -161,13 +171,23 @@ func NewMTLSAuth(config any) (*MTLSAuth, error) {
 }
 
 // SanitizedCopy returns a shallow copy with sensitive values redacted best-effort.
+// The Key field is replaced with a deterministic vault-URI derived from the real key so that
+// repeated syncs without a key change produce the same redacted value (preventing spurious
+// delete+create churn in go-database-reconciler). When the real key is unavailable the
+// redaction falls back to a random vault-URI.
 func (c *KeyAuth) SanitizedCopy(uuidGenerator util.UUIDGenerator) *KeyAuth {
+	var redactedKey *string
+	if c.Key != nil {
+		redactedKey = deterministicRedactedString(*c.Key)
+	} else {
+		redactedKey = randRedactedString(uuidGenerator)
+	}
 	return &KeyAuth{
 		KeyAuth: kong.KeyAuth{
 			// Consumer field omitted
 			CreatedAt: c.CreatedAt,
 			ID:        c.ID,
-			Key:       randRedactedString(uuidGenerator),
+			Key:       redactedKey,
 			Tags:      c.Tags,
 		},
 	}
```

**File**: `internal/dataplane/kongstate/credentials_test.go` (modified, +32/-2)
```diff
@@ -14,7 +14,7 @@ func TestKeyAuth_SanitizedCopy(t *testing.T) {
 		want KeyAuth
 	}{
 		{
-			name: "fills all fields but Consumer and sanitizes key",
+			name: "fills all fields but Consumer and sanitizes key deterministically",
 			in: KeyAuth{
 				KeyAuth: kong.KeyAuth{
 					Consumer:  &kong.Consumer{Username: kong.String("foo")},
@@ -28,17 +28,47 @@ func TestKeyAuth_SanitizedCopy(t *testing.T) {
 				KeyAuth: kong.KeyAuth{
 					CreatedAt: kong.Int(1),
 					ID:        kong.String("2"),
-					Key:       kong.String("{vault://52fdfc07-2182-454f-963f-5f0f9a621d72}"),
+					Key:       deterministicRedactedString("3"),
 					Tags:      []*string{kong.String("4.1"), kong.String("4.2")},
 				},
 			},
 		},
+		{
+			name: "sanitizes key to random vault-URI when key is nil",
+			in: KeyAuth{
+				KeyAuth: kong.KeyAuth{
+					ID:  kong.String("2"),
+					Key: nil,
+				},
+			},
+			want: KeyAuth{
+				KeyAuth: kong.KeyAuth{
+					ID:  kong.String("2"),
+					Key: kong.String("{vault://52fdfc07-2182-454f-963f-5f0f9a621d72}"),
+				},
+			},
+		},
 	} {
 		t.Run(tt.name, func(t *testing.T) {
 			got := *tt.in.SanitizedCopy(StaticUUIDGenerator{UUID: "52fdfc07-2182-454f-963f-5f0f9a621d72"})
 			assert.Equal(t, tt.want, got)
 		})
 	}
+
+	t.Run("deterministic: same key produces same redacted value across calls", func(t *testing.T) {
+		ka := KeyAuth{KeyAuth: kong.KeyAuth{Key: kong.String("mykey")}}
+		got1 := ka.SanitizedCopy(StaticUUIDGenerator{UUID: "x"})
+		got2 := ka.SanitizedCopy(StaticUUIDGenerator{UUID: "y"})
+		assert.Equal(t, got1.Key, got2.Key, "same real key must produce same redacted key regardless of uuidGenerator")
+	})
+
+	t.Run("different keys produce different redacted values", func(t *testing.T) {
+		ka1 := KeyAuth{KeyAuth: kong.KeyAuth{Key: kong.String("keyA")}}
+		ka2 := KeyAuth{KeyAuth: kong.KeyAuth{Key: kong.String("keyB")}}
+		got1 := ka1.SanitizedCopy(StaticUUIDGenerator{UUID: "x"})
+		got2 := ka2.SanitizedCopy(StaticUUIDGenerator{UUID: "x"})
+		assert.NotEqual(t, got1.Key, got2.Key, "different real keys must produce different redacted keys")
+	})
 }
 
 func TestHMACAuth_SanitizedCopy(t *testing.T) {
```

**File**: `internal/dataplane/kongstate/kongstate_test.go` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ func TestKongState_SanitizedCopy(t *testing.T) {
 					{
 						KeyAuths: []*KeyAuth{
 							{
-								KeyAuth: kong.KeyAuth{ID: kong.String("1"), Key: kong.String("{vault://52fdfc07-2182-454f-963f-5f0f9a621d72}")},
+								KeyAuth: kong.KeyAuth{ID: kong.String("1"), Key: deterministicRedactedString("secret")},
 							},
 						},
 					},
```

**File**: `internal/dataplane/sendconfig/dbmode.go` (modified, +258/-0)
```diff
@@ -5,6 +5,8 @@ import (
 	"errors"
 	"fmt"
 	"reflect"
+	"sort"
+	"strings"
 	"sync"
 	"time"
 
@@ -96,6 +98,12 @@ func (s *UpdateStrategyDBMode) Update(ctx context.Context, targetContent Content
 		return mo.None[int](), err
 	}
 
+	if s.isKonnect {
+		if err := refillCredentialIDs(cs, ts, s.logger); err != nil {
+			return mo.None[int](), err
+		}
+	}
+
 	syncer, err := diff.NewSyncer(diff.SyncerOpts{
 		CurrentState:        cs,
 		TargetState:         ts,
@@ -272,6 +280,256 @@ func (s *UpdateStrategyDBMode) targetState(
 	return state.Get(rawState)
 }
 
+// credentialMatchKey returns a string that uniquely identifies a credential within the KongState
+// across syncs. It combines the consumer's ID and a sorted, canonical form of the credential's tags.
+// KIC always tags credentials with GenerateTagsForObject(secret), which encodes the k8s Secret's
+// namespace/name/uid — this is deterministic and survives SanitizedCopy. The consumer ID is stable
+// because FillIDs covers consumers. Using these two fields (rather than the credential value such as
+// Key or Username) avoids the sanitization-induced churn where SanitizedCopy randomizes key-auth Key.
+func credentialMatchKey(consumerID string, tags []*string) string {
+	tagStrs := make([]string, 0, len(tags))
+	for _, t := range tags {
+		if t != nil {
+			tagStrs = append(tagStrs, *t)
+		}
+	}
+	sort.Strings(tagStrs)
+	return consumerID + "|" + strings.Join(tagStrs, ",")
+}
+
+// refillCredentialIDs reconciles credential IDs from the current state into the target state.
+// When KIC builds target content, credentials carry no IDs (go-kong has no FillID for credential
+// types). On the Konnect sync path, SanitizedCopy further randomizes key-auth Key values, so
+// go-database-reconciler's value-based ID recovery always misses, causing delete+create churn.
+// This function matches current-state credentials to target-state credentials by consumer ID + tags
+// and copies the existing ID, turning churn into a stable in-place update (or no event with Fix A).
+func refillCredentialIDs(currentState *state.KongState, targetState *state.KongState, logger logr.Logger) error {
+	if err := refillKeyAuthIDs(currentState, targetState, logger); err != nil {
+		return err
+	}
+	if err := refillBasicAuthIDs(currentState, targetState, logger); err != nil {
+		return err
+	}
+	if err := refillHMACAuthIDs(currentState, targetState, logger); err != nil {
+		return err
+	}
+	if err := refillJWTAuthIDs(currentState, targetState, logger); err != nil {
+		return err
+	}
+	if err := refillACLGroupIDs(currentState, targetState, logger); err != nil {
+		return err
+	}
+	if err := refillOauth2CredIDs(currentState, targetState, logger); err != nil {
+		return err
+	}
+	return refillMTLSAuthIDs(currentState, targetState, logger)
+}
+
+// credential is a union of all credential types.
+// This is primarily used as a type constraint for credentialOps and refillCredTypeIDs.
+type credential interface {
+	state.KeyAuth |
+		state.BasicAuth |
+		state.HMACAuth |
+		state.JWTAuth |
+		state.ACLGroup |
+		state.Oauth2Credential |
+		state.MTLSAuth
+}
+
+// credentialOps holds type-specific operations for one credential collection, used by refillCredTypeIDs.
+type credentialOps[T credential] struct {
+	kind            string
+	getCurrentItems func() ([]*T, error)
+	getTargetItems  func() ([]*T, error)
+	consumerID      func(*T) string
+	id              func(*T) *string
+	tags            func(*T) []*string
+	setID           func(*T, *string)
+	delete          func(string) error
+	add             func(T) error
+}
+
+// refillCredTypeIDs is the shared implementation for all per-type refill functions.
+// It builds an index of current-state IDs keyed by credentialMatchKey(consumerID, tags) and
+// copies each matching ID into the target state (delete old entry + re-add with existing ID).
+func refillCredTypeIDs[T credential](ops credentialOps[T], logger logr.Logger) error {
+	current, err := ops.getCurrentItems()
+	if err != nil {
+		return fmt.Errorf("failed getting current %s: %w", ops.kind, err)
+	}
+
+	currentIndex := make(map[string]*string, len(current))
+	for _, c := range current {
+		id := ops.id(c)
+		if id == nil {
+			continue
+		}
+		k := credentialMatchKey(ops.consumerID(c), ops.tags(c))
+		currentIndex[k] = id
+	}
+
+	targets, err := ops.getTargetItems()
+	if err != nil {
+		return fmt.Errorf("failed getting target %s: %w", ops.kind, err)
+	}
+	for _, t := range targets {
+		k := credentialMatchKey(ops.consumerID(t), ops.tags(t))
+		existingID, ok := currentIndex[k]
+		if !ok || existingID == nil {
+			continue
+		}
+		currentID := ops.id(t)
+		if currentID != nil && *currentID == *existingID {
+			continue
+		}
+		logger.V(logging.DebugLevel).Info("keeping ID of existing "+ops.kind, "new_id", currentID, "old_id", existingID)
+		if currentID != nil {
+			if err := ops.delete(*currentID); err != nil && !errors.Is(err, state.ErrNotFound) {
+				return fmt.Errorf("failed deleting 
```

**File**: `internal/dataplane/sendconfig/dbmode_test.go` (modified, +104/-0)
```diff
@@ -276,6 +276,110 @@ func TestRefillPluginIDs(t *testing.T) {
 	}
 }
 
+func TestRefillCredentialIDs(t *testing.T) {
+	consumerID := "consumer-1"
+	consumer := &kong.Consumer{
+		Username: kong.String("consumer-1"),
+		ID:       kong.String(consumerID),
+	}
+	credTag := kong.String("k8s-name/default/my-secret/abc-uid")
+
+	testCases := []struct {
+		name              string
+		currentState      *state.KongState
+		targetState       *state.KongState
+		expectedKeyAuthID string
+	}{
+		{
+			name: "key-auth ID from current state is copied to target when tags and consumer match",
+			currentState: mustNewKongStateFromRawState(t, &deckutils.KongRawState{
+				Consumers: []*kong.Consumer{consumer},
+				KeyAuths: []*kong.KeyAuth{
+					{
+						ID:       kong.String("existing-ka-id"),
+						Key:      kong.String("{vault://aaa}"),
+						Consumer: &kong.Consumer{ID: kong.String(consumerID)},
+						Tags:     []*string{credTag},
+					},
+				},
+			}),
+			targetState: mustNewKongStateFromRawState(t, &deckutils.KongRawState{
+				Consumers: []*kong.Consumer{consumer},
+				KeyAuths: []*kong.KeyAuth{
+					{
+						ID:       kong.String("new-ka-id"),
+						Key:      kong.String("{vault://bbb}"),
+						Consumer: &kong.Consumer{ID: kong.String(consumerID)},
+						Tags:     []*string{credTag},
+					},
+				},
+			}),
+			expectedKeyAuthID: "existing-ka-id",
+		},
+		{
+			name: "key-auth ID is NOT copied when tags differ (different credential)",
+			currentState: mustNewKongStateFromRawState(t, &deckutils.KongRawState{
+				Consumers: []*kong.Consumer{consumer},
+				KeyAuths: []*kong.KeyAuth{
+					{
+						ID:       kong.String("existing-ka-id"),
+						Key:      kong.String("{vault://aaa}"),
+						Consumer: &kong.Consumer{ID: kong.String(consumerID)},
+						Tags:     []*string{kong.String("k8s-name/default/secret-A/uid-A")},
+					},
+				},
+			}),
+			targetState: mustNewKongStateFromRawState(t, &deckutils.KongRawState{
+				Consumers: []*kong.Consumer{consumer},
+				KeyAuths: []*kong.KeyAuth{
+					{
+						ID:       kong.String("new-ka-id"),
+						Key:      kong.String("{vault://bbb}"),
+						Consumer: &kong.Consumer{ID: kong.String(consumerID)},
+						Tags:     []*string{kong.String("k8s-name/default/secret-B/uid-B")},
+					},
+				},
+			}),
+			expectedKeyAuthID: "new-ka-id",
+		},
+		{
+			name: "key-auth ID is unchanged when IDs already match",
+			currentState: mustNewKongStateFromRawState(t, &deckutils.KongRawState{
+				Consumers: []*kong.Consumer{consumer},
+				KeyAuths: []*kong.KeyAuth{
+					{
+						ID:       kong.String("same-id"),
+						Key:      kong.String("{vault://aaa}"),
+						Consumer: &kong.Consumer{ID: kong.String(consumerID)},
+						Tags:     []*string{credTag},
+					},
+				},
+			}),
+			targetState: mustNewKongStateFromRawState(t, &deckutils.KongRawState{
+				Consumers: []*kong.Consumer{consumer},
+				KeyAuths: []*kong.KeyAuth{
+					{
+						ID:       kong.String("same-id"),
+						Key:      kong.String("{vault://bbb}"),
+						Consumer: &kong.Consumer{ID: kong.String(consumerID)},
+						Tags:     []*string{credTag},
+					},
+				},
+			}),
+			expectedKeyAuthID: "same-id",
+		},
+	}
+
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			err := refillCredentialIDs(tc.currentState, tc.targetState, logr.Discard())
+			require.NoError(t, err)
+			_, err = tc.targetState.KeyAuths.Get(tc.expectedKeyAuthID)
+			require.NoError(t, err, "key-auth with expected ID %q not found in target state", tc.expectedKeyAuthID)
+		})
+	}
+}
+
 func mustNewKongStateFromRawState(t *testing.T, rawState *deckutils.KongRawState) *state.KongState {
 	t.Helper()
 
```

---

### Incident Patch 11: `3f4d839a` (2026-06-09)
**Commit Message**: ci: fix codecov (#7961)

**File**: `.github/workflows/_test_reports.yaml` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ jobs:
           merge-multiple: true
 
       - name: Upload coverage to Codecov
-        uses: codecov/codecov-action@18283e04ce6e62d37312384ff67231eb8fd56d24 # v5.4.3
+        uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v7.0.0
         with:
           name: combined-coverage
           token: ${{ secrets.CODECOV_TOKEN }}
```

---

### Incident Patch 12: `e0d7b00a` (2026-06-04)
**Commit Message**: fix(adminapi): preserve TLSServerName on admin client recreation (#7950)

* fix(adminapi): preserve TLSServerName on admin client recreation

* test(clients): cover TLSServerName preservation on readiness recovery

* docs(changelog): note admin API SNI fix on proxy restart

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -131,6 +131,11 @@ Adding a new version? You'll need three changes:
 
 ### Fixed
 
+- Preserve the Admin API client's TLS server name (SNI) when a client turns pending and is
+  recreated (e.g. after a gateway Pod restart). Previously the SNI was dropped on recreation,
+  which, when gateway service discovery is combined with a mTLS-secured Admin API, caused
+  permanent TLS verification failures against the recreated client.
+  [#7950](https://github.com/Kong/kubernetes-ingress-controller/pull/7950)
 - Revert plugin config sanitization `--dump-sensitive-config` isn't set.
   Due to plugin configuration being dependent on plugin type controller is not
   able to make an informed decision whether a field is sensitive or not and more
```

**File**: `internal/adminapi/client.go` (modified, +16/-0)
```diff
@@ -36,6 +36,9 @@ type Client struct {
 	lastConfigSHA     []byte
 	// podRef (optional) describes the Pod that the Client communicates with.
 	podRef *k8stypes.NamespacedName
+	// tlsServerName (optional) is the SNI used for TLS verification against the Admin API.
+	// It's retained so the client can be recreated with the same SNI when it turns pending.
+	tlsServerName string
 }
 
 // NewClient creates an Admin API client that is to be used with a regular Admin API exposed by Kong Gateways.
@@ -206,6 +209,18 @@ func (c *Client) PodReference() (k8stypes.NamespacedName, bool) {
 	return k8stypes.NamespacedName{}, false
 }
 
+// AttachTLSServerName allows attaching the SNI used for TLS verification against the Admin API.
+// Should be used in case gateway service discovery is used so the SNI can be preserved when the
+// client is recreated (e.g. after the gateway Pod restarts).
+func (c *Client) AttachTLSServerName(name string) {
+	c.tlsServerName = name
+}
+
+// TLSServerName returns the SNI used for TLS verification against the Admin API, if any.
+func (c *Client) TLSServerName() string {
+	return c.tlsServerName
+}
+
 type ClientFactory struct {
 	logger     logr.Logger
 	workspace  string
@@ -241,5 +256,6 @@ func (cf ClientFactory) CreateAdminAPIClient(ctx context.Context, discoveredAdmi
 	}
 
 	cl.AttachPodReference(discoveredAdminAPI.PodRef)
+	cl.AttachTLSServerName(discoveredAdminAPI.TLSServerName)
 	return cl, nil
 }
```

**File**: `internal/adminapi/client_test.go` (modified, +19/-0)
```diff
@@ -37,3 +37,22 @@ func TestClientFactory_CreateAdminAPIClientAttachesPodReference(t *testing.T) {
 		Name:      "name",
 	}, ref)
 }
+
+func TestClientFactory_CreateAdminAPIClientAttachesTLSServerName(t *testing.T) {
+	factory := adminapi.NewClientFactoryForWorkspace(logr.Discard(), "workspace", managercfg.AdminAPIClientConfig{}, "")
+
+	adminAPIHandler := mocks.NewAdminAPIHandler(t)
+	adminAPIServer := httptest.NewServer(adminAPIHandler)
+	t.Cleanup(func() { adminAPIServer.Close() })
+
+	const tlsServerName = "pod.dataplane-admin-kong.default.svc"
+	client, err := factory.CreateAdminAPIClient(t.Context(), adminapi.DiscoveredAdminAPI{
+		Address:       adminAPIServer.URL,
+		TLSServerName: tlsServerName,
+	})
+	require.NoError(t, err)
+	require.NotNil(t, client)
+
+	require.Equal(t, tlsServerName, client.TLSServerName(),
+		"expected TLSServerName to be attached to the client")
+}
```

**File**: `internal/clients/readiness.go` (modified, +4/-2)
```diff
@@ -47,6 +47,7 @@ type AlreadyCreatedClient interface {
 	IsReady(context.Context) error
 	PodReference() (k8stypes.NamespacedName, bool)
 	BaseRootURL() string
+	TLSServerName() string
 }
 
 type DefaultReadinessChecker struct {
@@ -178,8 +179,9 @@ func (c DefaultReadinessChecker) checkAlreadyExistingClients(ctx context.Context
 				select {
 				case <-ctx.Done():
 				case pendingChan <- adminapi.DiscoveredAdminAPI{
-					Address: client.BaseRootURL(),
-					PodRef:  podRef,
+					Address:       client.BaseRootURL(),
+					TLSServerName: client.TLSServerName(),
+					PodRef:        podRef,
 				}:
 				}
 			}
```

**File**: `internal/clients/readiness_test.go` (modified, +38/-3)
```diff
@@ -57,9 +57,10 @@ func (cf *mockClientFactory) CallsForAddress(address string) int {
 }
 
 type mockAlreadyCreatedClient struct {
-	url     string
-	isReady bool
-	podRef  k8stypes.NamespacedName
+	url           string
+	isReady       bool
+	podRef        k8stypes.NamespacedName
+	tlsServerName string
 }
 
 func (m mockAlreadyCreatedClient) IsReady(context.Context) error {
@@ -77,6 +78,10 @@ func (m mockAlreadyCreatedClient) BaseRootURL() string {
 	return m.url
 }
 
+func (m mockAlreadyCreatedClient) TLSServerName() string {
+	return m.tlsServerName
+}
+
 func TestDefaultReadinessChecker(t *testing.T) {
 	const (
 		testURL1 = "http://localhost:8001"
@@ -276,3 +281,33 @@ func TestDefaultReadinessChecker(t *testing.T) {
 		})
 	}
 }
+
+// TestDefaultReadinessChecker_PreservesTLSServerName ensures that when an already created client
+// turns pending (e.g. after a gateway Pod restart), the TLSServerName (SNI) is carried over to the
+// resulting DiscoveredAdminAPI so the client can be recreated with a valid SNI for TLS verification.
+func TestDefaultReadinessChecker_PreservesTLSServerName(t *testing.T) {
+	const (
+		testURL           = "http://localhost:8001"
+		testTLSServerName = "pod.dataplane-admin-kong.default.svc"
+	)
+	testPodRef := k8stypes.NamespacedName{Namespace: "default", Name: "mock"}
+
+	factory := newMockClientFactory(t, nil)
+	checker := clients.NewDefaultReadinessChecker(factory, managercfg.DefaultDataPlanesReadinessCheckTimeout, logr.Discard())
+
+	result := checker.CheckReadiness(t.Context(),
+		[]clients.AlreadyCreatedClient{
+			mockAlreadyCreatedClient{
+				podRef:        testPodRef,
+				url:           testURL,
+				isReady:       false, // Turns pending.
+				tlsServerName: testTLSServerName,
+			},
+		},
+		nil,
+	)
+
+	require.Len(t, result.ClientsTurnedPending, 1)
+	require.Equal(t, testTLSServerName, result.ClientsTurnedPending[0].TLSServerName,
+		"TLSServerName must be preserved when a client turns pending")
+}
```

---

### Incident Patch 13: `1f2a41b0` (2026-05-28)
**Commit Message**: Revert "fix: fix unsanitized KongPlugin being included in sanitzed config dump (#7912)" (#7937)

This reverts commit 38415bdb02014ac69417cf1027c6278ef88bf233.

**File**: `CHANGELOG.md` (modified, +16/-2)
```diff
@@ -8,6 +8,7 @@ Adding a new version? You'll need three changes:
   This is all the way at the bottom. It's the thing we always forget.
 --->
 
+- [3.5.7](#357)
 - [3.5.7](#357)
 - [3.5.6](#356)
 - [3.5.5](#355)
@@ -124,6 +125,20 @@ Adding a new version? You'll need three changes:
 - [0.0.5](#005)
 - [0.0.4 and prior](#004-and-prior)
 
+## [3.5]
+
+> Release date: TBD
+
+### Fixed
+
+- Revert plugin config sanitization `--dump-sensitive-config` isn't set.
+  Due to plugin configuration being dependent on plugin type controller is not
+  able to make an informed decision whether a field is sensitive or not and more
+  importantly whether it has a constrained set of allowed values like e.g. HTTP methods.
+  Users are suggested to block network access to debug endpoints (which are disabled
+  by default) if plugin configuration can contain sensitive information.
+  [#7937](https://github.com/Kong/kubernetes-ingress-controller/pull/7937)
+
 ## [3.5.7]
 
 > Release date: 2026-05-11
@@ -4398,6 +4413,7 @@ Please read the changelog and test in your environment.
 - The initial versions were rapildy iterated to deliver
   a working ingress controller.
 
+[3.5.8]: https://github.com/kong/kubernetes-ingress-controller/compare/v3.5.7...v3.5.8
 [3.5.7]: https://github.com/kong/kubernetes-ingress-controller/compare/v3.5.6...v3.5.7
 [3.5.6]: https://github.com/kong/kubernetes-ingress-controller/compare/v3.5.5...v3.5.6
 [3.5.5]: https://github.com/kong/kubernetes-ingress-controller/compare/v3.5.4...v3.5.5
@@ -4511,5 +4527,3 @@ Please read the changelog and test in your environment.
 [0.1.1]: https://github.com/kong/kubernetes-ingress-controller/compare/0.1.0...0.1.1
 [0.2.0]: https://github.com/kong/kubernetes-ingress-controller/compare/0.1.0...0.2.0
 [0.1.0]: https://github.com/kong/kubernetes-ingress-controller/compare/v0.0.5...0.1.0
-[v0.0.5]: https://github.com/kong/kubernetes-ingress-controller/compare/v0.0.4...v0.0.5
-[v0.0.4]: https://github.com/kong/kubernetes-ingress-controller/compare/7866a27f268c32c5618fba546da2c73ba74d4a46...v0.0.4
```

**File**: `internal/dataplane/kongstate/kongstate.go` (modified, +1/-8)
```diff
@@ -64,14 +64,7 @@ func (ks *KongState) SanitizedCopy(uuidGenerator util.UUIDGenerator) *KongState
 			})
 		}(),
 		CACertificates: ks.CACertificates,
-		Plugins: func() []Plugin {
-			if ks.Plugins == nil {
-				return nil
-			}
-			return lo.Map(ks.Plugins, func(p Plugin, _ int) Plugin {
-				return p.SanitizedCopy()
-			})
-		}(),
+		Plugins:        ks.Plugins,
 		Consumers: func() []Consumer {
 			if ks.Consumers == nil {
 				return nil
```

**File**: `internal/dataplane/kongstate/kongstate_test.go` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ func TestKongState_SanitizedCopy(t *testing.T) {
 				Upstreams:      []Upstream{{Upstream: kong.Upstream{ID: kong.String("1")}}},
 				Certificates:   []Certificate{{Certificate: kong.Certificate{ID: kong.String("1"), Key: redactedString}}},
 				CACertificates: []kong.CACertificate{{ID: kong.String("1")}},
-				Plugins:        []Plugin{{Plugin: kong.Plugin{ID: kong.String("1"), Config: map[string]any{"key": "{REDACTED}"}}}},
+				Plugins:        []Plugin{{Plugin: kong.Plugin{ID: kong.String("1"), Config: map[string]any{"key": "secret"}}}}, // We don't redact plugins' config.
 				Consumers: []Consumer{
 					{
 						KeyAuths: []*KeyAuth{
```

**File**: `internal/dataplane/kongstate/plugin.go` (modified, +0/-9)
```diff
@@ -354,12 +354,3 @@ type PluginRelatedEntitiesRefs struct {
 	RelatedEntities      map[string]RelatedEntitiesRef
 	RouteAttachedService map[string]*Service
 }
-
-func (p *Plugin) SanitizedCopy() Plugin {
-	sanitized := p.DeepCopy()
-	// Replace all config values with a redaction marker.
-	for k := range sanitized.Config {
-		sanitized.Config[k] = "{REDACTED}"
-	}
-	return sanitized
-}
```

**File**: `internal/dataplane/kongstate/plugin_test.go` (modified, +0/-155)
```diff
@@ -765,158 +765,3 @@ func TestKongPluginFromK8SPlugin(t *testing.T) {
 		})
 	}
 }
-
-func TestPluginSanitizedCopy(t *testing.T) {
-	parent := &configurationv1.KongPlugin{
-		ObjectMeta: metav1.ObjectMeta{
-			Name:      "plugin-parent",
-			Namespace: "default",
-		},
-	}
-
-	tests := []struct {
-		name      string
-		in        Plugin
-		want      Plugin
-		postCheck func(t *testing.T, in Plugin, got Plugin)
-	}{
-		{
-			name: "redacts all top level config values and preserves other fields",
-			in: Plugin{
-				Plugin: kong.Plugin{
-					ID:           kong.String("plugin-id"),
-					Name:         kong.String("rate-limiting"),
-					InstanceName: kong.String("instance-name"),
-					RunOn:        kong.String("first"),
-					Enabled:      kong.Bool(false),
-					Protocols:    kong.StringSlice("http", "https"),
-					Tags:         []*string{kong.String("tag-1"), kong.String("tag-2")},
-					Ordering: &kong.PluginOrdering{
-						Before: map[string][]string{
-							"access": {"key-auth"},
-						},
-					},
-					Config: kong.Configuration{
-						"string":  "secret",
-						"number":  123,
-						"boolean": true,
-						"object": map[string]any{
-							"nested": "secret",
-						},
-						"array": []any{"first", "second"},
-						"null":  nil,
-					},
-				},
-				K8sParent: parent,
-			},
-			want: Plugin{
-				Plugin: kong.Plugin{
-					ID:           kong.String("plugin-id"),
-					Name:         kong.String("rate-limiting"),
-					InstanceName: kong.String("instance-name"),
-					RunOn:        kong.String("first"),
-					Enabled:      kong.Bool(false),
-					Protocols:    kong.StringSlice("http", "https"),
-					Tags:         []*string{kong.String("tag-1"), kong.String("tag-2")},
-					Ordering: &kong.PluginOrdering{
-						Before: map[string][]string{
-							"access": {"key-auth"},
-						},
-					},
-					Config: kong.Configuration{
-						"string":  "{REDACTED}",
-						"number":  "{REDACTED}",
-						"boolean": "{REDACTED}",
-						"object":  "{REDACTED}",
-						"array":   "{REDACTED}",
-						"null":    "{REDACTED}",
-					},
-				},
-				K8sParent: parent,
-			},
-			postCheck: func(t *testing.T, in Plugin, got Plugin) {
-				assert.Equal(t, "secret", in.Config["string"])
-				assert.Equal(t, 123, in.Config["number"])
-				assert.Equal(t, true, in.Config["boolean"])
-				assert.Equal(t, map[string]any{"nested": "secret"}, in.Config["object"])
-				assert.Equal(t, []any{"first", "second"}, in.Config["array"])
-				assert.Nil(t, in.Config["null"])
-				assert.Same(t, in.K8sParent, got.K8sParent)
-			},
-		},
-		{
-			name: "keeps nil config nil",
-			in: Plugin{
-				Plugin: kong.Plugin{
-					Name: kong.String("key-auth"),
-				},
-			},
-			want: Plugin{
-				Plugin: kong.Plugin{
-					Name: kong.String("key-auth"),
-				},
-			},
-			postCheck: func(t *testing.T, in Plugin, got Plugin) {
-				assert.Nil(t, in.Config)
-				assert.Nil(t, got.Config)
-			},
-		},
-		{
-			name: "returns an isolated config map copy",
-			in: Plugin{
-				Plugin: kong.Plugin{
-					Name: kong.String("request-transformer"),
-					Config: kong.Configuration{
-						"add": "sensitive",
-					},
-				},
-			},
-			want: Plugin{
-				Plugin: kong.Plugin{
-					Name: kong.String("request-transformer"),
-					Config: kong.Configuration{
-						"add": "{REDACTED}",
-					},
-				},
-			},
-			postCheck: func(t *testing.T, in Plugin, got Plugin) {
-				got.Config["add"] = "changed"
-				got.Config["new"] = "new-value"
-				assert.Equal(t, "sensitive", in.Config["add"])
-				_, exists := in.Config["new"]
-				assert.False(t, exists)
-			},
-		},
-		{
-			name: "keeps empty config empty",
-			in: Plugin{
-				Plugin: kong.Plugin{
-					Name:   kong.String("cors"),
-					Config: kong.Configuration{},
-				},
-			},
-			want: Plugin{
-				Plugin: kong.Plugin{
-					Name:   kong.String("cors"),
-					Config: kong.Configuration{},
-				},
-			},
-			postCheck: func(t *testing.T, in Plugin, got Plugin) {
-				assert.Empty(t, in.Config)
-				assert.Empty(t, got.Config)
-			},
-		},
-	}
-
-	for _, tt := range tests {
-		t.Run(tt.name, func(t *testing.T) {
-			got := tt.in.SanitizedCopy()
-
-			assert.Equal(t, tt.want, got)
-
-			if tt.postCheck != nil {
-				tt.postCheck(t, tt.in, got)
-			}
-		})
-	}
-}
```

---

### Incident Patch 14: `84fa1189` (2026-05-07)
**Commit Message**: fix: implement ReferenceGrant checks for cross-namespace certificate references (#7920)

* fix: implement ReferenceGrant checks for cross-namespace certificate references

* chore(changelog): update changelog for ReferenceGrant checks on cross-namespace certificate references

* test: improve readiness check assertions in manager tests

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -139,6 +139,8 @@ Adding a new version? You'll need three changes:
     [#7901](https://github.com/Kong/kubernetes-ingress-controller/pull/7901)
 - More robust validation for `HTTPRoute`, when an unsupported feature is used, and the route refers to existing and non-existing `Gateway`, it will be rejected.
   [#7913](https://github.com/Kong/kubernetes-ingress-controller/pull/7913)
+- implement `ReferenceGrant` checks for cross-namespace certificate references (managed and unmanaged gateways)
+  [#7920](https://github.com/Kong/kubernetes-ingress-controller/pull/7920)
 
 ## [3.5.6]
 
```

**File**: `internal/clients/manager_test.go` (modified, +6/-2)
```diff
@@ -418,8 +418,10 @@ func TestAdminAPIClientsManager_GatewayClientsChanges(t *testing.T) {
 
 	// Notify the first set of clients and make sure that the subscriber doesn't get notified as it was initial state.
 	m.Notify(ctx, firstClientsSet)
+	// Use Eventually because notificationsCountEventuallyEquals(0) returns immediately (count is already 0),
+	// so the manager goroutine may not have finished calling CheckReadiness yet.
+	require.Eventually(t, func() bool { return readinessChecker.CallsCount() == 1 }, time.Second, time.Millisecond, "expected readiness check on non-empty set of clients")
 	notificationsCountEventuallyEquals(0)
-	require.Equal(t, 1, readinessChecker.CallsCount(), "expected readiness check on non-empty set of clients")
 	requireLastReadinessCheckCall(readinessCheckCall{
 		AlreadyCreatedURLs: []string{testURL1},
 		PendingURLs:        []string{},
@@ -437,12 +439,14 @@ func TestAdminAPIClientsManager_GatewayClientsChanges(t *testing.T) {
 
 	// Notify the second set of clients without making the new one ready and make sure that the subscriber gets no notification.
 	m.Notify(ctx, secondClientsSet)
+	// Use Eventually because notificationsCountEventuallyEquals(1) returns immediately (count is already 1),
+	// so the manager goroutine may not have finished calling CheckReadiness yet.
+	require.Eventually(t, func() bool { return readinessChecker.CallsCount() == 2 }, time.Second, time.Millisecond, "expected readiness check on non-empty set of clients")
 	notificationsCountEventuallyEquals(1)
 	requireLastReadinessCheckCall(readinessCheckCall{
 		AlreadyCreatedURLs: []string{},
 		PendingURLs:        []string{testURL2},
 	})
-	require.Equal(t, 2, readinessChecker.CallsCount(), "expected readiness check on non-empty set of clients")
 
 	// Notify the second set of clients and make sure that the subscriber gets notified after the new one becomes ready.
 	readinessChecker.LetChecksReturn(clients.ReadinessCheckResult{ClientsTurnedReady: intoTurnedReady(testURL2)})
```

**File**: `internal/dataplane/translator/translate_certs.go` (modified, +37/-0)
```diff
@@ -115,6 +115,43 @@ func (t *Translator) getGatewayCerts() []certWrapper {
 						namespace = string(*ref.Namespace)
 					}
 
+					// check reference grant before translating certificate
+					// if the certificate is in the same namespace of the gateway, no ReferenceGrant is needed
+					// the check about if listener is marked as programmed happens only for "unmanaged" gateways, see above
+					// https://github.com/Kong/kubernetes-ingress-controller/pull/7666
+					if ref.Namespace != nil && string(*ref.Namespace) != gateway.Namespace {
+						referenceGrants, err := s.ListReferenceGrants()
+						if err != nil {
+							logger.Error(err, "Failed to list ReferenceGrants, skipping cross-namespace certificateRef",
+								"gateway", gateway.Name,
+								"listener", listener.Name,
+								"secret_namespace", string(*ref.Namespace),
+								"secret_name", string(ref.Name),
+							)
+							continue
+						}
+
+						allowedRefs := gatewayapi.GetPermittedForReferenceGrantFrom(
+							logger,
+							gatewayapi.ReferenceGrantFrom{
+								Group:     gatewayapi.V1Group,
+								Kind:      "Gateway",
+								Namespace: gatewayapi.Namespace(gateway.Namespace),
+							},
+							referenceGrants,
+						)
+
+						if !gatewayapi.NewRefCheckerForRoute(logger, gateway, ref).IsRefAllowedByGrant(allowedRefs) {
+							logger.Error(nil, "Cross-namespace certificateRef not permitted by ReferenceGrant, skipping",
+								"gateway", gateway.Name,
+								"listener", listener.Name,
+								"secret_namespace", string(*ref.Namespace),
+								"secret_name", string(ref.Name),
+							)
+							continue
+						}
+					}
+
 					// retrieve the Secret and extract the PEM strings
 					secret, err := s.GetSecret(namespace, string(ref.Name))
 					if err != nil {
```

**File**: `internal/dataplane/translator/translate_certs_test.go` (modified, +315/-0)
```diff
@@ -6,12 +6,327 @@ import (
 
 	"github.com/go-logr/logr"
 	"github.com/kong/go-kong/kong"
+	"github.com/samber/lo"
 	"github.com/stretchr/testify/require"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	k8stypes "k8s.io/apimachinery/pkg/types"
 
+	"github.com/kong/kubernetes-ingress-controller/v3/internal/annotations"
 	"github.com/kong/kubernetes-ingress-controller/v3/internal/dataplane/kongstate"
+	"github.com/kong/kubernetes-ingress-controller/v3/internal/gatewayapi"
+	"github.com/kong/kubernetes-ingress-controller/v3/internal/store"
 	"github.com/kong/kubernetes-ingress-controller/v3/test/helpers/certificate"
 )
 
+func TestGetGatewayCerts(t *testing.T) {
+	crt, key := certificate.MustGenerateCertPEMFormat(certificate.WithCommonName("example.com"))
+
+	const (
+		gwNS        = "gateway-ns"
+		secretNS    = "secret-ns"
+		secretName  = "prod-tls"
+		gwClassName = "kong"
+		listener    = "https"
+		secretUID   = "7428fb98-180b-4702-a91f-61351a33c6e4"
+	)
+
+	makeSecret := func(ns, name string) *corev1.Secret {
+		return &corev1.Secret{
+			ObjectMeta: metav1.ObjectMeta{
+				UID:       k8stypes.UID(secretUID),
+				Name:      name,
+				Namespace: ns,
+			},
+			Data: map[string][]byte{
+				corev1.TLSCertKey:       crt,
+				corev1.TLSPrivateKeyKey: key,
+			},
+		}
+	}
+
+	programmedConditions := func(programmed bool) []metav1.Condition {
+		if programmed {
+			return []metav1.Condition{{
+				Type:               string(gatewayapi.ListenerConditionProgrammed),
+				Status:             metav1.ConditionTrue,
+				Reason:             string(gatewayapi.ListenerReasonProgrammed),
+				ObservedGeneration: 0,
+			}}
+		}
+		return []metav1.Condition{{
+			Type:               string(gatewayapi.ListenerConditionProgrammed),
+			Status:             metav1.ConditionFalse,
+			Reason:             string(gatewayapi.ListenerReasonInvalid),
+			ObservedGeneration: 0,
+		}}
+	}
+
+	makeGWC := func(unmanaged bool) *gatewayapi.GatewayClass {
+		gwc := &gatewayapi.GatewayClass{
+			ObjectMeta: metav1.ObjectMeta{Name: gwClassName},
+			Spec:       gatewayapi.GatewayClassSpec{ControllerName: ""},
+		}
+		if unmanaged {
+			gwc.Annotations = map[string]string{
+				annotations.GatewayClassUnmanagedAnnotation: annotations.GatewayClassUnmanagedAnnotationValuePlaceholder,
+			}
+		}
+		return gwc
+	}
+
+	// makeGateway builds a Gateway with a single TLS listener.
+	// certNS nil means same-namespace (no cross-namespace ref).
+	makeGateway := func(ns string, certNS *string, programmed bool) *gatewayapi.Gateway {
+		var refNS *gatewayapi.Namespace
+		if certNS != nil {
+			n := gatewayapi.Namespace(*certNS)
+			refNS = &n
+		}
+		return &gatewayapi.Gateway{
+			ObjectMeta: metav1.ObjectMeta{Name: "gw", Namespace: ns},
+			Spec: gatewayapi.GatewaySpec{
+				GatewayClassName: gatewayapi.ObjectName(gwClassName),
+				Listeners: []gatewayapi.Listener{{
+					Name:     gatewayapi.SectionName(listener),
+					Port:     443,
+					Protocol: gatewayapi.HTTPSProtocolType,
+					TLS: &gatewayapi.GatewayTLSConfig{
+						CertificateRefs: []gatewayapi.SecretObjectReference{{
+							Group:     lo.ToPtr(gatewayapi.Group("")),
+							Kind:      lo.ToPtr(gatewayapi.Kind("Secret")),
+							Name:      gatewayapi.ObjectName(secretName),
+							Namespace: refNS,
+						}},
+					},
+				}},
+			},
+			Status: gatewayapi.GatewayStatus{
+				Listeners: []gatewayapi.ListenerStatus{{
+					Name:       gatewayapi.SectionName(listener),
+					Conditions: programmedConditions(programmed),
+				}},
+			},
+		}
+	}
+
+	makeReferenceGrant := func(targetNS, fromNS string, grantedSecretName *string) *gatewayapi.ReferenceGrant {
+		to := gatewayapi.ReferenceGrantTo{
+			Group: gatewayapi.Group(""),
+			Kind:  gatewayapi.Kind("Secret"),
+		}
+		if grantedSecretName != nil {
+			n := gatewayapi.ObjectName(*grantedSecretName)
+			to.Name = &n
+		}
+		return &gatewayapi.ReferenceGrant{
+			ObjectMeta: metav1.ObjectMeta{Name: "grant", Namespace: targetNS},
+			Spec: gatewayapi.ReferenceGrantSpec{
+				From: []gatewayapi.ReferenceGrantFrom{{
+					Group:     gatewayapi.V1Group,
+					Kind:      "Gateway",
+					Namespace: gatewayapi.Namespace(fromNS),
+				}},
+				To: []gatewayapi.ReferenceGrantTo{to},
+			},
+		}
+	}
+
+	testCases := []struct {
+		name          string
+		objects       store.FakeObjects
+		wantCertCount int
+	}{
+		{
+			name: "same-namespace cert, managed mode",
+			objects: store.FakeObjects{
+				GatewayClasses: []*gatewayapi.GatewayClass{makeGWC(false)},
+				Gateways:       []*gatewayapi.Gateway{makeGateway(gwNS, nil, true)},
+				Secrets:        []*corev1.Secret{makeSecret(gwNS, secretName)},
+			},
+			wantCertCount: 1,
+		},
+		{
+			name: "cross-namespace cert, valid ReferenceGrant without name restriction",
+			objects: store.FakeObjects{
+				GatewayClasses:  []*gatewayapi.GatewayClass{makeGWC(false)},
+				Gateways:        []*gatewayapi.Gateway{makeGateway(gwNS, lo.ToPtr(secretNS), true)},
+				Secrets
```

**File**: `internal/store/fake_store.go` (modified, +7/-0)
```diff
@@ -124,6 +124,12 @@ func NewFakeStore(
 			return nil, err
 		}
 	}
+	gatewayClassStore := cache.NewStore(clusterWideKeyFunc)
+	for _, gwc := range objects.GatewayClasses {
+		if err := gatewayClassStore.Add(gwc); err != nil {
+			return nil, err
+		}
+	}
 	gatewayStore := cache.NewStore(namespacedKeyFunc)
 	for _, gw := range objects.Gateways {
 		if err := gatewayStore.Add(gw); err != nil {
@@ -250,6 +256,7 @@ func NewFakeStore(
 			GRPCRoute:                      grpcrouteStore,
 			ReferenceGrant:                 referencegrantStore,
 			Gateway:                        gatewayStore,
+			GatewayClass:                   gatewayClassStore,
 			BackendTLSPolicy:               backendTLSPolicyStore,
 			TCPIngress:                     tcpIngressStore,
 			UDPIngress:                     udpIngressStore,
```

---

### Incident Patch 15: `451dd707` (2026-05-07)
**Commit Message**: tests(conformance): Skip partial conformance tests related to `GRPCRoute` for bumping grpc package and use separate vars in update to reduce data race (#7916)

* chore(deps): bump google.golang.org/grpc from 1.73.0 to 1.79.3

Bumps [google.golang.org/grpc](https://github.com/grpc/grpc-go) from 1.73.0 to 1.79.3.
- [Release notes](https://github.com/grpc/grpc-go/releases)
- [Commits](https://github.com/grpc/grpc-go/compare/v1.73.0...v1.79.3)

---
updated-dependencies:
- dependency-name: google.golang.org/grpc
  dependency-version: 1.79.3
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* skip grpcroute related tests

* fix data race by deepcopy

* define new var for updating HTTPRoute in tests

* add comments

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +21/-21)
```diff
@@ -46,7 +46,7 @@ require (
 	github.com/sethvargo/go-password v0.3.1
 	github.com/spf13/cobra v1.9.1
 	github.com/spf13/pflag v1.0.7
-	github.com/stretchr/testify v1.10.0
+	github.com/stretchr/testify v1.11.1
 	github.com/testcontainers/testcontainers-go v0.37.0
 	github.com/testcontainers/testcontainers-go/modules/postgres v0.37.0
 	github.com/tonglil/buflogr v1.1.1
@@ -67,7 +67,7 @@ require (
 )
 
 require (
-	cel.dev/expr v0.23.0 // indirect
+	cel.dev/expr v0.25.1 // indirect
 	github.com/antlr4-go/antlr/v4 v4.13.0 // indirect
 	github.com/carapace-sh/carapace-shlex v1.0.1 // indirect
 	github.com/containerd/errdefs v1.0.0 // indirect
@@ -81,10 +81,10 @@ require (
 	github.com/moby/sys/atomicwriter v0.1.0 // indirect
 	github.com/shirou/gopsutil/v4 v4.25.1 // indirect
 	github.com/stoewer/go-strcase v1.3.0 // indirect
-	go.opentelemetry.io/auto/sdk v1.1.0 // indirect
+	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.33.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.33.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.36.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.39.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.4.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.2 // indirect
 	go.yaml.in/yaml/v3 v3.0.3 // indirect
@@ -97,7 +97,7 @@ require (
 require (
 	cloud.google.com/go/auth v0.16.3 // indirect
 	cloud.google.com/go/auth/oauth2adapt v0.2.8 // indirect
-	cloud.google.com/go/compute/metadata v0.7.0 // indirect
+	cloud.google.com/go/compute/metadata v0.9.0 // indirect
 	dario.cat/mergo v1.0.2
 	github.com/Azure/go-ansiterm v0.0.0-20230124172434-306776ec8161 // indirect
 	github.com/Kong/go-diff v1.2.2 // indirect
@@ -214,27 +214,27 @@ require (
 	github.com/yusufpapurcu/wmi v1.2.4 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.61.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 // indirect
-	go.opentelemetry.io/otel v1.36.0 // indirect
-	go.opentelemetry.io/otel/metric v1.36.0 // indirect
-	go.opentelemetry.io/otel/trace v1.36.0 // indirect
+	go.opentelemetry.io/otel v1.39.0 // indirect
+	go.opentelemetry.io/otel/metric v1.39.0 // indirect
+	go.opentelemetry.io/otel/trace v1.39.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go4.org/netipx v0.0.0-20231129151722-fdeea329fbba // indirect
-	golang.org/x/crypto v0.45.0 // indirect
+	golang.org/x/crypto v0.46.0 // indirect
 	golang.org/x/exp v0.0.0-20240719175910-8a7402abbf56 // indirect
-	golang.org/x/mod v0.29.0
-	golang.org/x/net v0.47.0 // indirect
-	golang.org/x/oauth2 v0.30.0 // indirect
-	golang.org/x/sync v0.18.0
-	golang.org/x/sys v0.38.0 // indirect
-	golang.org/x/term v0.37.0 // indirect
-	golang.org/x/text v0.31.0 // indirect
+	golang.org/x/mod v0.30.0
+	golang.org/x/net v0.48.0 // indirect
+	golang.org/x/oauth2 v0.34.0 // indirect
+	golang.org/x/sync v0.19.0
+	golang.org/x/sys v0.39.0 // indirect
+	golang.org/x/term v0.38.0 // indirect
+	golang.org/x/text v0.32.0 // indirect
 	golang.org/x/time v0.12.0 // indirect
-	golang.org/x/tools v0.38.0 // indirect
+	golang.org/x/tools v0.39.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20250603155806-513f23925822 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20250715232539-7130f93afb79 // indirect
-	google.golang.org/grpc v1.73.0
-	google.golang.org/protobuf v1.36.6 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20251202230838-ff82c1b0f217 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20251202230838-ff82c1b0f217 // indirect
+	google.golang.org/grpc v1.79.3
+	google.golang.org/protobuf v1.36.10 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.12.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
```

**File**: `go.sum` (modified, +57/-46)
```diff
@@ -1,13 +1,13 @@
-cel.dev/expr v0.23.0 h1:wUb94w6OYQS4uXraxo9U+wUAs9jT47Xvl4iPgAwM2ss=
-cel.dev/expr v0.23.0/go.mod h1:hLPLo1W4QUmuYdA72RBX06QTs6MXw941piREPl3Yfiw=
+cel.dev/expr v0.25.1 h1:1KrZg61W6TWSxuNZ37Xy49ps13NUovb66QLprthtwi4=
+cel.dev/expr v0.25.1/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
 cloud.google.com/go v0.121.3 h1:84RD+hQXNdY5Sw/MWVAx5O9Aui/rd5VQ9HEcdN19afo=
 cloud.google.com/go v0.121.3/go.mod h1:6vWF3nJWRrEUv26mMB3FEIU/o1MQNVPG1iHdisa2SJc=
 cloud.google.com/go/auth v0.16.3 h1:kabzoQ9/bobUmnseYnBO6qQG7q4a/CffFRlJSxv2wCc=
 cloud.google.com/go/auth v0.16.3/go.mod h1:NucRGjaXfzP1ltpcQ7On/VTZ0H4kWB5Jy+Y9Dnm76fA=
 cloud.google.com/go/auth/oauth2adapt v0.2.8 h1:keo8NaayQZ6wimpNSmW5OPc283g65QNIiLpZnkHRbnc=
 cloud.google.com/go/auth/oauth2adapt v0.2.8/go.mod h1:XQ9y31RkqZCcwJWNSx2Xvric3RrU88hAYYbjDWYDL+c=
-cloud.google.com/go/compute/metadata v0.7.0 h1:PBWF+iiAerVNe8UCHxdOt6eHLVc3ydFeOCw78U8ytSU=
-cloud.google.com/go/compute/metadata v0.7.0/go.mod h1:j5MvL9PprKL39t166CoB1uVHfQMs4tFQZZcKwksXUjo=
+cloud.google.com/go/compute/metadata v0.9.0 h1:pDUj4QMoPejqq20dK0Pg2N4yG9zIkYGdBtwLoEkH9Zs=
+cloud.google.com/go/compute/metadata v0.9.0/go.mod h1:E0bWwX5wTnLPedCKqk3pJmVgCBSM6qQI1yTBdEb3C10=
 cloud.google.com/go/container v1.44.0 h1:JEHeW535svvNwJrjrlQ/cdjd15LCWrPKnHsulrufd3A=
 cloud.google.com/go/container v1.44.0/go.mod h1:tVK2o4UZUTkg9WpBcgj4qRzwGA1dSFdWA3mil3YkLIQ=
 dario.cat/mergo v1.0.2 h1:85+piFYR1tMbRrLcDwR18y4UKJ3aH1Tbzi24VRW1TK8=
@@ -54,6 +54,8 @@ github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UF
 github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
 github.com/chai2010/gettext-go v1.0.2 h1:1Lwwip6Q2QGsAdl/ZKPCwTe9fe0CjlUbqj5bFNSjIRk=
 github.com/chai2010/gettext-go v1.0.2/go.mod h1:y+wnP2cHYaVj19NZhYKAwEMH2CI1gNHeQQ+5AjwawxA=
+github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5 h1:6xNmx7iTtyBRev0+D/Tv1FZd4SCg8axKApyNyRsAt/w=
+github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5/go.mod h1:KdCmV+x/BuvyMxRnYBlmVaq4OLiKW6iRQfvC62cvdkI=
 github.com/cnf/structhash v0.0.0-20250313080605-df4c6cc74a9a h1:Ohw57yVY2dBTt+gsC6aZdteyxwlxfbtgkFEMTEkwgSw=
 github.com/cnf/structhash v0.0.0-20250313080605-df4c6cc74a9a/go.mod h1:pCxVEbcm3AMg7ejXyorUXi6HQCzOIBf7zEDVPtw0/U4=
 github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
@@ -87,6 +89,11 @@ github.com/ebitengine/purego v0.8.2 h1:jPPGWs2sZ1UgOSgD2bClL0MJIqu58nOmIcBuXr62z
 github.com/ebitengine/purego v0.8.2/go.mod h1:iIjxzd6CiRiOG0UyXP+V1+jWqUXVjPKLAI0mRfJZTmQ=
 github.com/emicklei/go-restful/v3 v3.12.0 h1:y2DdzBAURM29NFF94q6RaY4vjIH1rtwDapwQtU84iWk=
 github.com/emicklei/go-restful/v3 v3.12.0/go.mod h1:6n3XBCmQQb25CM2LCACGz8ukIrRry+4bhvbpWn3mrbc=
+github.com/envoyproxy/go-control-plane v0.14.0 h1:hbG2kr4RuFj222B6+7T83thSPqLjwBIfQawTkC++2HA=
+github.com/envoyproxy/go-control-plane/envoy v1.36.0 h1:yg/JjO5E7ubRyKX3m07GF3reDNEnfOboJ0QySbH736g=
+github.com/envoyproxy/go-control-plane/envoy v1.36.0/go.mod h1:ty89S1YCCVruQAm9OtKeEkQLTb+Lkz0k8v9W0Oxsv98=
+github.com/envoyproxy/protoc-gen-validate v1.3.0 h1:TvGH1wof4H33rezVKWSpqKz5NXWg5VPuZ0uONDT6eb4=
+github.com/envoyproxy/protoc-gen-validate v1.3.0/go.mod h1:HvYl7zwPa5mffgyeTUHA9zHIH36nmrm7oCbo4YKoSWA=
 github.com/ericlagergren/decimal v0.0.0-20240411145413-00de7ca16731 h1:R/ZjJpjQKsZ6L/+Gf9WHbt31GG8NMVcpRqUE+1mMIyo=
 github.com/ericlagergren/decimal v0.0.0-20240411145413-00de7ca16731/go.mod h1:M9R1FoZ3y//hwwnJtO51ypFGwm8ZfpxPT/ZLtO1mcgQ=
 github.com/evanphx/json-patch v0.5.2 h1:xVCHIVMUu1wtM/VkR9jVZ45N3FhZfYMMYGorLCR8P3k=
@@ -332,6 +339,8 @@ github.com/phayes/freeport v0.0.0-20220201140144-74d24b5ae9f5 h1:Ii+DKncOVM8Cu1H
 github.com/phayes/freeport v0.0.0-20220201140144-74d24b5ae9f5/go.mod h1:iIss55rKnNBTvrwdmkUpLnDpZoAHvWaiq5+iMmen4AE=
 github.com/pkg/errors v0.9.1 h1:FEBLx1zS214owpjy7qsBeixbURkuhQAwrK5UwLGTwt4=
 github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINEl0=
+github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 h1:GFCKgmp0tecUJ0sJuv4pzYCqS9+RGSn52M3FUwPs+uo=
+github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10/go.mod h1:t/avpk3KcrXxUnYOhZhMXJlSEyie6gQbtLq5NM3loB8=
 github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
 github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 h1:Jamvg5psRIccs7FGNTlIRMkT8wgtp5eCXdBlqhYGL6U=
 github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
@@ -347,8 +356,8 @@ github.com/prometheus/procfs v0.15.1 h1:YagwOFzUgYfKKHX6Dr+sHT7km/hxC76UB0leargg
 github.com/prometheus/procfs v0.15.1/go.mod h1:fB45yRUv8NstnjriLhBQLuOUt+WW4BsoGhij/e3PBqk=
 github.com/puzpuzpuz/xsync/v2 v2.5.1 h1:mVGYAvzDSu52+zaGyNjC+24Xw2bQi3kTr4QJ6N9pIIU=
 github.com/puzpuzpuz/xsync/v2 v2.5.1/go.mod h1:gD2H2krq/w52MfPLE+Uy64TzJDVY7lP2znR9qmR35kU=
-github.com/rogpeppe/go-internal v1.13.1 h1:KvO1DLK/DRN07sQ1LQKS
```

**File**: `internal/controllers/license/konglicense_controller.go` (modified, +2/-0)
```diff
@@ -404,6 +404,8 @@ func (r *KongV1Alpha1KongLicenseReconciler) ensureControllerStatusConditions(
 	reason string, message string,
 ) error {
 	// Get the latest status of target KongLicense.
+	// Deep copy is required here since the license object from cache is shared by multiple goroutines and the status update will modify the license object.
+	license = license.DeepCopy()
 	if err := r.Get(ctx, k8stypes.NamespacedName{Name: license.Name}, license); err != nil {
 		return fmt.Errorf("failed to get latest version of KongLicense %s: %w", license.Name, err)
 	}
```

**File**: `test/conformance/gateway_conformance_test.go` (modified, +16/-5)
```diff
@@ -21,6 +21,15 @@ import (
 	"github.com/kong/kubernetes-ingress-controller/v3/test/internal/testenv"
 )
 
+var commonSkippedTests = []string{
+	// Temporarily skipped due to update of GRPC client package
+	// causing failures in gRPC conformance tests.
+	// TODO: Re-enable these tests https://github.com/Kong/kubernetes-ingress-controller/issues/7919
+	tests.GRPCRouteHeaderMatching.ShortName,
+	tests.GRPCExactMethodMatching.ShortName,
+	tests.GRPCRouteListenerHostnameMatching.ShortName,
+}
+
 var skippedTestsForTraditionalRoutes = []string{
 	// core conformance
 	tests.HTTPRouteHeaderMatching.ShortName,
@@ -30,15 +39,15 @@ var skippedTestsForTraditionalRoutes = []string{
 	// it is necessary to create separate catch-all routes for them.
 	// However, Kong does not define priority behavior in this situation unless priorities are manually added.
 	// ref: https://github.com/Kong/kubernetes-ingress-controller/issues/6144
-	tests.GRPCRouteHeaderMatching.ShortName,
-	tests.GRPCExactMethodMatching.ShortName,
+	// tests.GRPCRouteHeaderMatching.ShortName,
+	// tests.GRPCExactMethodMatching.ShortName,
 }
 
 var skippedTestsForExpressionRoutes = []string{
 	// When processing this scenario, the Kong's expressions router requires `priority`
 	// to be specified for routes.
 	// We cannot provide that for routes that are part of the conformance suite.
-	tests.GRPCRouteListenerHostnameMatching.ShortName,
+	// tests.GRPCRouteListenerHostnameMatching.ShortName,
 }
 
 var traditionalRoutesSupportedFeatures = []features.FeatureName{
@@ -81,13 +90,15 @@ func TestGatewayConformance(t *testing.T) {
 		supportedFeatures []features.FeatureName
 		mode              string
 	)
+	skippedTests = append(skippedTests, commonSkippedTests...)
 	switch rf := testenv.KongRouterFlavor(); rf {
 	case dpconf.RouterFlavorTraditionalCompatible:
-		skippedTests = skippedTestsForTraditionalRoutes
+		skippedTests = append(skippedTests, skippedTestsForTraditionalRoutes...)
 		supportedFeatures = traditionalRoutesSupportedFeatures
 		mode = string(dpconf.RouterFlavorTraditionalCompatible)
 	case dpconf.RouterFlavorExpressions:
-		skippedTests = skippedTestsForExpressionRoutes
+
+		skippedTests = append(skippedTests, skippedTestsForExpressionRoutes...)
 		supportedFeatures = expressionRoutesSupportedFeatures
 		mode = string(dpconf.RouterFlavorExpressions)
 	default:
```

**File**: `test/integration/httproute_test.go` (modified, +8/-8)
```diff
@@ -630,15 +630,15 @@ func TestHTTPRouteFilterHosts(t *testing.T) {
 
 	t.Logf("update hostnames in httproute to wildcard")
 	require.EventuallyWithT(t, func(c *assert.CollectT) {
-		httpRoute, err = hClient.Get(ctx, httpRoute.Name, metav1.GetOptions{})
+		httpRouteForUpdate, err := hClient.Get(ctx, httpRoute.Name, metav1.GetOptions{})
 		if !assert.NoErrorf(c, err, "failed getting the HTTPRoute %s", httpRoute.Name) {
 			return
 		}
-		httpRoute.Spec.Hostnames = []gatewayapi.Hostname{
+		httpRouteForUpdate.Spec.Hostnames = []gatewayapi.Hostname{
 			gatewayapi.Hostname("*.specific.io"),
 		}
-		httpRoute, err = hClient.Update(ctx, httpRoute, metav1.UpdateOptions{})
-		assert.NoErrorf(c, err, "failed updating the HTTPRoute %s", httpRoute.Name)
+		httpRouteForUpdate, err = hClient.Update(ctx, httpRouteForUpdate, metav1.UpdateOptions{})
+		assert.NoErrorf(c, err, "failed updating the HTTPRoute %s", httpRouteForUpdate.Name)
 	}, test.RequestTimeout, 100*time.Millisecond)
 	t.Logf("test host matched hostname in listeners")
 	require.EventuallyWithT(t, func(c *assert.CollectT) {
@@ -649,15 +649,15 @@ func TestHTTPRouteFilterHosts(t *testing.T) {
 
 	t.Logf("update hostname in httproute to an unmatched host")
 	require.EventuallyWithT(t, func(c *assert.CollectT) {
-		httpRoute, err = hClient.Get(ctx, httpRoute.Name, metav1.GetOptions{})
+		httpRouteForUpdate, err := hClient.Get(ctx, httpRoute.Name, metav1.GetOptions{})
 		if !assert.NoErrorf(t, err, "failed getting the HTTPRoute %s", httpRoute.Name) {
 			return
 		}
-		httpRoute.Spec.Hostnames = []gatewayapi.Hostname{
+		httpRouteForUpdate.Spec.Hostnames = []gatewayapi.Hostname{
 			gatewayapi.Hostname("another.specific.io"),
 		}
-		httpRoute, err = hClient.Update(ctx, httpRoute, metav1.UpdateOptions{})
-		assert.NoErrorf(c, err, "failed updating the HTTPRoute %s", httpRoute.Name)
+		httpRouteForUpdate, err = hClient.Update(ctx, httpRouteForUpdate, metav1.UpdateOptions{})
+		assert.NoErrorf(c, err, "failed updating the HTTPRoute %s", httpRouteForUpdate.Name)
 	}, test.RequestTimeout, 100*time.Millisecond)
 
 	t.Logf("status of httproute should contain an 'Accepted' condition with 'False' status")
```

#### Recent Merged Pull Requests:
- **PR #8096** (closed): chore(deps): bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.45.0 (@dependabot[bot])
- **PR #8095** (2026-09-18): chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace from 1.33.0 to 1.45.0 (@dependabot[bot])
- **PR #8093** (2026-09-20): [Backport release/3.4.x] Backport of #8081 and #8085 (@randmonkey)
- **PR #8092** (2026-09-20): [Backport release/3.5.x] Combined backport of #8081 and #8085 (@randmonkey)
- **PR #8091** (2026-09-17): chore(deps): bump google.golang.org/grpc from 1.83.1 to 1.83.2 (@dependabot[bot])
- **PR #8090** (2026-09-17): chore(deps): Bump grpc to 1.83.1 (@randmonkey)
- **PR #8089** (2026-09-20): fix(test): Pass kong-effective-version to e2e in validating Kong image tests and fix GKEtest failures (@randmonkey)
- **PR #8087** (2026-09-11): bump GKE to 1.37.0 (@randmonkey)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
