# Forensic Learning Record (Deep Inspection): open-policy-agent/gatekeeper

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-policy-agent-gatekeeper-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-policy-agent/gatekeeper](https://github.com/open-policy-agent/gatekeeper))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:18:39.000Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-policy-agent/gatekeeper`
- **Description**: 🐊 Policy Controller for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4292 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apis/status/v1beta1/util.go`
```
package v1beta1

import (
	"fmt"
	"strings"
)

// dashExtractor unpacks the status resource name, unescaping `-`.
func dashExtractor(val string) []string {
	b := strings.Builder{}
	var tokens []string
	var prevDash bool
	for _, chr := range val {
		if prevDash && chr != '-' {
			tokens = append(tokens, b.String())
			b.Reset()
			prevDash = false
		}
		if chr == '-' {
			if prevDash {
				b.WriteRune(chr)
				prevDash = false
				continue
			}
			prevDash = true
			continue
		}
		b.WriteRune(chr)
	}
	tokens = append(tokens, b.String())
	return tokens
}

// DashPacker puts a list of strings into a dash-separated format. Note that
// it cannot handle empty strings, as that makes the dash separator for the empty
// string reduce to an escaped dash. This is fine because none of the packed strings
// are allowed to be empty. If this changes in the future, we could create a placeholder
// for the empty string, say `b`, and replace all instances of `b` in the input
// stream with `bb`, which could then be unfolded. If we need that, we are already
// changing the schema of the status resource, and therefore don't need to deal with
// it now. It also doesn't handle the case where a value begins or ends with a dash,
// which is also disallowed by the schema (and would require an additional placeholder
// character to fix). Finally, note that it is impossible to distinguish between
// a nil list of strings and a list of one empty string.
func DashPacker(vals ...string) (string, error) {
	if len(vals) == 0 {
		return "", fmt.Errorf("DashPacker cannot pack an empty list of strings")
	}
	b := strings.Builder{}
	for i, val := range vals {
		if strings.HasPrefix(val, "-") || strings.HasSuffix(val, "-") {
			return "", fmt.Errorf("DashPacker cannot pack strings that begin or end with a dash: %+v", vals)
		}
		if len(val) == 0 {
			return "", fmt.Errorf("DashPacker cannot pack empty strings: %v", vals)
		}
		if i != 0 {
			b.WriteString("-")
		}
		b.WriteString(strings.ReplaceAll(val, "-", "--"))
	}
	return b.String(), nil
}

```

### Core Architecture Module: `cmd/gator/util/util.go`
```
package util

import (
	"fmt"
	"os"
)

func ErrFatalf(format string, a ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", a...)
	os.Exit(1)
}

func WriteToFile(s string, path string) {
	file, err := os.Create(path)
	if err != nil {
		ErrFatalf("error creating file at path %s: %v", path, err)
	}

	if _, err = fmt.Fprint(file, s); err != nil {
		ErrFatalf("error writing to file at path %s: %s", path, err)
	}
}

```

### Core Architecture Module: `pkg/controller/add_webhookconfig.go`
```
/*

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

package controller

import (
	"github.com/open-policy-agent/gatekeeper/v3/pkg/controller/webhookconfig"
)

func init() {
	// AddToManagerFuncs is a list of functions to create controllers and add them to a manager.
	Injectors = append(Injectors, &webhookconfig.Adder{})
}

```

### Core Architecture Module: `pkg/controller/mutators/core/adder.go`
```
package core

import (
	"context"
	"fmt"
	"strings"

	statusv1beta1 "github.com/open-policy-agent/gatekeeper/v3/apis/status/v1beta1"
	ctrlmutators "github.com/open-policy-agent/gatekeeper/v3/pkg/controller/mutators"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/controller/mutatorstatus"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/types"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/readiness"
	corev1 "k8s.io/api/core/v1"
	apitypes "k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"
)

type Adder struct {
	// MutationSystem holds a reference to the mutation system to which
	// mutators will be registered/deregistered
	MutationSystem *mutation.System
	// Tracker accepts a handle for the readiness tracker
	Tracker *readiness.Tracker
	// GetPod returns an instance of the currently running Gatekeeper pod
	GetPod func(context.Context) (*corev1.Pod, error)
	// Kind for the mutation object that is being reconciled
	Kind string
	// NewMutationObj creates a new instance of a mutation struct that can
	// be fed to the API server client for Get/Delete/Update requests
	NewMutationObj func() client.Object
	// MutatorFor takes the object returned by NewMutationObject and
	// turns it into a mutator. The contents of the mutation object
	// are set by the API server.
	MutatorFor func(client.Object) (types.Mutator, error)
	// Events enables queueing other Mutators for updates.
	Events chan event.GenericEvent
	// EventsSource is this controller's inbound watch source for generic update
	// events related to other mutators. Callers may derive it from Events via
	// per-controller routing or fan-out, but Events itself may be shared across
	// controllers while each controller receives its own EventsSource.
	EventsSource source.Source
	Reporter     ctrlmutators.StatsReporter
}

// Add creates a new Controller and adds it to the Manager. The Manager will set fields on the Controller
// and Start it when the Manager is Started.
func (a *Adder) Add(mgr manager.Manager) error {
	r := newReconciler(mgr, a.MutationSystem, a.Tracker, a.GetPod, a.Kind, a.NewMutationObj, a.MutatorFor, a.Events, a.Reporter)
	return a.add(mgr, r)
}

// add adds a new Controller to mgr with r as the reconcile.Reconciler.
func (a *Adder) add(mgr manager.Manager, r *Reconciler) error {
	if !mutation.Enabled() {
		return nil
	}

	// Create a new controller
	c, err := controller.New(fmt.Sprintf("%s-controller", strings.ToLower(r.gvk.Kind)), mgr, controller.Options{Reconciler: r})
	if err != nil {
		return err
	}

	// Watch for changes to Mutators.
	err = c.Watch(
		source.Kind(mgr.GetCache(), r.newMutationObj(),
			&handler.EnqueueRequestForObject{}))
	if err != nil {
		return err
	}

	// Watch for changes to MutatorPodStatuses.
	err = c.Watch(
		source.Kind(mgr.GetCache(), &statusv1beta1.MutatorPodStatus{},
			handler.TypedEnqueueRequestsFromMapFunc(mutatorstatus.PodStatusToMutatorMapper(true, r.gvk.Kind, func(_ context.Context, obj client.Object) []reconcile.Request {
				return []reconcile.Request{{
					NamespacedName: apitypes.NamespacedName{
						Namespace: obj.GetNamespace(),
						Name:      obj.GetName(),
					},
				}}
			})),
		))
	if err != nil {
		return err
	}

	if a.EventsSource != nil {
		err = c.Watch(a.EventsSource)
	}

	return err
}

```

### Core Architecture Module: `pkg/controller/mutators/core/reconciler.go`
```
/*


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

	"github.com/go-logr/logr"
	mutationsv1 "github.com/open-policy-agent/gatekeeper/v3/apis/mutations/v1"
	statusv1beta1 "github.com/open-policy-agent/gatekeeper/v3/apis/status/v1beta1"
	ctrlmutators "github.com/open-policy-agent/gatekeeper/v3/pkg/controller/mutators"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/logging"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation"
	mutationschema "github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/schema"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/types"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/readiness"
	corev1 "k8s.io/api/core/v1"
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	apiTypes "k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/event"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

// newReconciler returns a new reconcile.Reconciler.
func newReconciler(
	mgr manager.Manager,
	mutationSystem *mutation.System,
	tracker *readiness.Tracker,
	getPod func(context.Context) (*corev1.Pod, error),
	kind string,
	newMutationObj func() client.Object,
	mutatorFor func(client.Object) (types.Mutator, error),
	events chan event.GenericEvent,
	reporter ctrlmutators.StatsReporter,
) *Reconciler {
	cache := ctrlmutators.NewMutationCache()
	if reporter != nil {
		reporter.RegisterTally(cache.TallyStatus, cache.TallyConflict)
	}
	r := &Reconciler{
		system:         mutationSystem,
		Client:         mgr.GetClient(),
		tracker:        tracker,
		getPod:         getPod,
		scheme:         mgr.GetScheme(),
		reporter:       reporter,
		cache:          cache,
		gvk:            mutationsv1.GroupVersion.WithKind(kind),
		newMutationObj: newMutationObj,
		mutatorFor:     mutatorFor,
		log:            logf.Log.WithName("controller").WithValues(logging.Process, fmt.Sprintf("%s_controller", strings.ToLower(kind))),
		events:         events,
	}
	if getPod == nil {
		r.getPod = r.defaultGetPod
	}
	return r
}

// Reconciler reconciles mutator objects.
type Reconciler struct {
	client.Client
	gvk            schema.GroupVersionKind
	newMutationObj func() client.Object
	mutatorFor     func(client.Object) (types.Mutator, error)

	system   *mutation.System
	tracker  *readiness.Tracker
	getPod   func(context.Context) (*corev1.Pod, error)
	scheme   *runtime.Scheme
	reporter ctrlmutators.StatsReporter
	cache    *ctrlmutators.Cache
	log      logr.Logger

	events chan event.GenericEvent
}

// +kubebuilder:rbac:groups=mutations.gatekeeper.sh,resources=*,verbs=get;list;watch;create;update;patch;delete

// Reconcile reads that state of the cluster for a mutator object and syncs it with the mutation system.
func (r *Reconciler) Reconcile(ctx context.Context, request reconcile.Request) (reconcile.Result, error) {
	r.log.Info("Reconcile", "request", request)
	startTime := time.Now()

	mutationObj, deleted, err := r.getOrDefault(ctx, request.NamespacedName)
	if err != nil {
		return reconcile.Result{}, err
	}

	// default ingestion status to error, only change it if we successfully
	// reconcile without conflicts
	ingestionStatus := ctrlmutators.MutatorStatusError

	// default conflict to false, only set to true if we find a conflict
	conflict := false

	// Encasing this call in a function prevents the arguments from being evaluated early.
	id := types.MakeID(mutationObj)
	defer func() {
		if !deleted {
			r.cache.Upsert(id, ingestionStatus, conflict)
		}
		r.reportMutator(id, ingestionStatus, startTime, deleted)
	}()

	// previousConflicts records the conflicts this Mutator has with other mutators
	// before making any changes.
	previousConflicts := r.system.GetConflicts(id)

	if deleted {
		// Either the mutator was deleted before we were able to process this request, or it has been marked for
		// deletion.
		r.getTracker().CancelExpect(mutationObj)
		err = r.reconcileDeleted(ctx, id)
	} else {
		err = r.reconcileUpsert(ctx, id, mutationObj)
	}

	if err != nil {
		return reconcile.Result{}, err
	}

	newConflicts := r.system.GetConflicts(id)

	// diff is the set of mutators which either:
	// 1) previously conflicted with mutationObj but do not after this change, or
	// 2) now conflict with mutationObj but did not before this change.
	diff := symmetricDifference(previousConflicts, newConflicts)
	delete(diff, id)

	// Now that we've made changes to the recorded Mutator schemas, we can re-check
	// for conflicts.
	r.queueConflicts(diff)

	// Any mutator that's in conflict with another should be in the "error" state.
	if len(newConflicts) == 0 {
		ingestionStatus = ctrlmutators.MutatorStatusActive
	} else {
		conflict = true
	}

	return reconcile.Result{}, nil
}

func (r *Reconciler) reconcileUpsert(ctx context.Context, id types.ID, obj client.Object) error {
	mutator, err := r.mutatorFor(obj)
	if err != nil {
		r.log.Error(err, "Creating mutator for resource failed", "resource",
			client.ObjectKeyFromObject(obj))
		r.getTracker().TryCancelExpect(obj)

		return r.updateStatusWithError(ctx, obj, err)
	}

	if errToUpsert := r.system.Upsert(mutator); errToUpsert != nil {
		r.log.Error(err, "Insert failed", "resource",
			client.ObjectKeyFromObject(obj))
		r.getTracker().TryCancelExpect(obj)

		// Since we got an error upserting obj, update its PodStatus first.
		return r.updateStatusWithError(ctx, obj, errToUpsert)
	}

	r.getTracker().Observe(obj)

	return r.updateStatus(ctx, id,
		setID(obj.GetUID()), setGeneration(obj.GetGeneration()),
		setEnforced(true), setErrors(nil))
}

func (r *Reconciler) getOrCreatePodStatus(ctx context.Context, mutatorID types.ID) (*statusv1beta1.MutatorPodStatus, *corev1.Pod, error) {
	pod, err := r.getPod(ctx)
	if err != nil {
		return nil, nil, err
	}

	statusObj := &statusv1beta1.MutatorPodStatus{}
	sName, err := statusv1beta1.KeyForMutatorID(pod.Name, mutatorID)
	if err != nil {
		return nil, nil, err
	}

	key := apiTypes.NamespacedName{Name: sName, Namespace: pod.Namespace}
	if err := r.Get(ctx, key, statusObj); err != nil {
		if !apierrors.IsNotFound(err) {
			return nil, nil, err
		}
	} else {
		return statusObj, pod, nil
	}

	statusObj, err = statusv1beta1.NewMutatorStatusForPod(pod, mutatorID, r.scheme)
	if err != nil {
		return nil, nil, err
	}
	if err := r.Create(ctx, statusObj); err != nil {
		return nil, nil, err
	}
	return statusObj, pod, nil
}

func (r *Reconciler) defaultGetPod(_ context.Context) (*corev1.Pod, error) {
	// require injection of GetPod in order to control what client we use to
	// guarantee we don't inadvertently create a watch
	panic("GetPod must be injected to Reconciler")
}

func (r *Reconciler) reportMutator(_ types.ID, ingestionStatus ctrlmutators.MutatorIngestionStatus, startTime time.Time, deleted bool) {
	if r.reporter == nil {
		return
	}

	if !deleted {
		if err := r.reporter.ReportMutatorIngestionRequest(ingestionStatus, time.Since(startTime)); err != nil {
			r.log.Error(err, "failed to report mutator ingestion request")
		}
	}
}

// getOrDefault attempts to get the Mutator from the cluster, or returns a default-instantiated Mutator if one does not
// exist.
func (r *Reconciler) getOrDefault(ctx context.Context, namespacedName apiTypes.NamespacedName) (client.Object, bool, error) {
	obj := r.newMutationObj()
	err := r.Get(ctx, namespacedName, obj)
	switch {
	case err == nil:
		// Treat objects with a DeletionTimestamp as if they are deleted.
		deleted := !obj.GetDeletionTimestamp().IsZero()
		return obj, deleted, nil
	case apierrors.IsNotFound(err):
		obj = r.newMutationObj()
		obj.SetName(namespacedName.Name)
		obj.SetNamespace(namespacedName.Namespace)
		obj.GetObjectKind().SetGroupVersionKind(r.gvk)
		return obj, true, nil
	default:
		return nil, false, err
	}
}

func (r *Reconciler) getTracker() readiness.Expectations {
	return r.tracker.For(r.gvk)
}

// reconcileDeleted removes the Mutator from the controller and deletes the corresponding PodStatus.
func (r *Reconciler) reconcileDeleted(ctx context.Context, id types.ID) error {
	r.cache.Remove(id)

	if err := r.system.Remove(id); err != nil {
		r.log.Error(err, "Remove failed", "resource",
			apiTypes.NamespacedName{Name: id.Name, Namespace: id.Namespace})
		return err
	}

	pod, err := r.getPod(ctx)
	if err != nil {
		return err
	}

	sName, err := statusv1beta1.KeyForMutatorID(pod.Name, id)
	if err != nil {
		return err
	}

	status := &statusv1beta1.MutatorPodStatus{}
	status.SetName(sName)
	status.SetNamespace(pod.Namespace)
	if err = r.Delete(ctx, status); err != nil && !apierrors.IsNotFound(err) {
		return err
	}

	return nil
}

// queueConflicts queues updates for Mutators in ids.
// We send events to the handler's event queue rather than attempting the update
// ourselves to delegate handling failures to the existing controller logic.
func (r *Reconciler) queueConflicts(ids mutationschema.IDSet) {
	if r.events == nil {
		return
	}

	for id := range ids {
		u := &unstructured.Unstructured{}
		u.SetGroupVersionKind(schema.GroupVersionKind{Group: r.gvk.Group, Kind: id.Kind})
		u.SetNamespace(id.Namespace)
		u.SetName(id.Name)

		r.events <- event.GenericEvent{Object: u
```

### Core Architecture Module: `pkg/controller/mutators/core/status.go`
```
package core

import (
	"errors"

	statusv1beta1 "github.com/open-policy-agent/gatekeeper/v3/apis/status/v1beta1"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/schema"
	apiTypes "k8s.io/apimachinery/pkg/types"
)

type statusUpdate func(status *statusv1beta1.MutatorPodStatus)

func setID(id apiTypes.UID) statusUpdate {
	return func(status *statusv1beta1.MutatorPodStatus) {
		status.Status.MutatorUID = id
	}
}

func setGeneration(generation int64) statusUpdate {
	return func(status *statusv1beta1.MutatorPodStatus) {
		status.Status.ObservedGeneration = generation
	}
}

func setErrors(err error) statusUpdate {
	return func(status *statusv1beta1.MutatorPodStatus) {
		// Replaces any existing errors, if there was one.
		if err == nil {
			status.Status.Errors = nil
			return
		}
		if errors.As(err, &schema.ErrConflictingSchema{}) {
			status.Status.Errors = []statusv1beta1.MutatorError{{
				Type:    schema.ErrConflictingSchemaType,
				Message: err.Error(),
			}}
		} else {
			status.Status.Errors = []statusv1beta1.MutatorError{{Message: err.Error()}}
		}
	}
}

func setEnforced(isEnforced bool) statusUpdate {
	return func(status *statusv1beta1.MutatorPodStatus) {
		status.Status.Enforced = isEnforced
	}
}

```

### Core Architecture Module: `pkg/controller/webhookconfig/webhookconfig_controller.go`
```
package webhookconfig

import (
	"context"
	"errors"
	"sync"

	"github.com/open-policy-agent/frameworks/constraint/pkg/apis/templates/v1beta1"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/controller/constrainttemplate"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/controller/webhookconfig/webhookconfigcache"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/drivers/k8scel/transform"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/logging"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/operations"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/readiness"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/webhook"
	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/util/retry"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"
)

const (
	ctrlName = "webhookconfig-controller"
)

// vwhNameMu protects access to webhook.VwhName for concurrent reads/writes.
var vwhNameMu sync.RWMutex

// getVwhName safely reads webhook.VwhName with synchronization.
func getVwhName() string {
	vwhNameMu.RLock()
	defer vwhNameMu.RUnlock()
	if webhook.VwhName == nil {
		return ""
	}
	return *webhook.VwhName
}

// setVwhName safely writes to webhook.VwhName with synchronization.
// This is primarily for testing purposes.
func setVwhName(name string) {
	vwhNameMu.Lock()
	defer vwhNameMu.Unlock()
	webhook.VwhName = &name
}

var logger = log.Log.V(logging.DebugLevel).WithName("controller").WithValues("kind", "ValidatingWebhookConfiguration", logging.Process, "webhook_config_controller")

// markDirtyTemplate marks a specific constraint template for reconciliation.
func (r *ReconcileWebhookConfig) markDirtyTemplate(template *v1beta1.ConstraintTemplate) {
	r.dirtyMu.Lock()
	defer r.dirtyMu.Unlock()
	if r.dirtyTemplates == nil {
		r.dirtyTemplates = make(map[string]*v1beta1.ConstraintTemplate)
	}
	r.dirtyTemplates[template.Name] = template
	logger.V(1).Info("marked constraint template as dirty", "template", template.Name)
}

// getDirtyTemplatesAndClear returns dirty templates and clears the dirty state.
func (r *ReconcileWebhookConfig) getDirtyTemplatesAndClear() []*v1beta1.ConstraintTemplate {
	r.dirtyMu.Lock()
	defer r.dirtyMu.Unlock()
	if len(r.dirtyTemplates) == 0 {
		return nil
	}
	templates := make([]*v1beta1.ConstraintTemplate, 0, len(r.dirtyTemplates))
	for _, template := range r.dirtyTemplates {
		templates = append(templates, template)
	}
	r.dirtyTemplates = make(map[string]*v1beta1.ConstraintTemplate)
	return templates
}

// triggerConstraintTemplateReconciliation sends events to trigger CT reconciliation for all templates.
func (r *ReconcileWebhookConfig) triggerConstraintTemplateReconciliation(ctx context.Context) error {
	logger.Info("Triggering ConstraintTemplate reconciliation due to webhook matching field changes")

	templateList := &v1beta1.ConstraintTemplateList{}
	if err := r.List(ctx, templateList); err != nil {
		logger.Error(err, "failed to list ConstraintTemplates for webhook reconciliation")
		return err
	}

	var errs []error
	for i := range templateList.Items {
		generateVap, err := constrainttemplate.ShouldGenerateVAPForVersionedCT(&templateList.Items[i], r.scheme)
		if err != nil || !generateVap {
			logger.Info("skipping reconcile for template", "template", templateList.Items[i].GetName())
			continue
		}

		if err := r.sendEventWithRetry(ctx, &templateList.Items[i]); err != nil {
			errs = append(errs, err)
			r.markDirtyTemplate(&templateList.Items[i])
		}
	}
	return errors.Join(errs...)
}

// triggerDirtyTemplateReconciliation sends events only for dirty constraint templates.
func (r *ReconcileWebhookConfig) triggerDirtyTemplateReconciliation(ctx context.Context) error {
	dirtyTemplates := r.getDirtyTemplatesAndClear()
	if len(dirtyTemplates) == 0 {
		return nil
	}

	logger.Info("Triggering reconciliation for dirty ConstraintTemplates", "count", len(dirtyTemplates))

	var errs []error
	for _, template := range dirtyTemplates {
		if err := r.sendEventWithRetry(ctx, template); err != nil {
			errs = append(errs, err)
			r.markDirtyTemplate(template)
		}
	}
	return errors.Join(errs...)
}

func (r *ReconcileWebhookConfig) sendEventWithRetry(ctx context.Context, template *v1beta1.ConstraintTemplate) error {
	return retry.OnError(retry.DefaultBackoff, func(err error) bool {
		return err != nil
	}, func() error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case r.ctEvents <- event.GenericEvent{Object: template}:
			logger.V(1).Info("event sent successfully", "template", template.Name)
			return nil
		default:
			logger.V(1).Info("channel full, will retry with backoff", "template", template.Name)
			return &ChannelFullError{}
		}
	})
}

type ChannelFullError struct{}

func (e *ChannelFullError) Error() string {
	return "channel is full"
}

func (e *ChannelFullError) Temporary() bool {
	return true
}

type Adder struct {
	Cache    *webhookconfigcache.WebhookConfigCache
	ctEvents chan<- event.GenericEvent // channel to send CT reconciliation events
}

func (a *Adder) InjectTracker(_ *readiness.Tracker) {}

func (a *Adder) InjectWebhookConfigCache(webhookConfigCache *webhookconfigcache.WebhookConfigCache) {
	a.Cache = webhookConfigCache
}

func (a *Adder) InjectConstraintTemplateEvent(ctEvents chan event.GenericEvent) {
	a.ctEvents = ctEvents
}

// Add creates a new webhook config controller and adds it to the Manager.
func (a *Adder) Add(mgr manager.Manager) error {
	if !operations.IsAssigned(operations.Generate) || !*transform.SyncVAPScope {
		return nil
	}
	r := &ReconcileWebhookConfig{
		Client:   mgr.GetClient(),
		scheme:   mgr.GetScheme(),
		cache:    a.Cache,
		ctEvents: a.ctEvents,
	}

	return add(mgr, r)
}

// add adds a new Controller to mgr with r as the reconcile.Reconciler.
func add(mgr manager.Manager, r reconcile.Reconciler) error {
	// Create a new controller
	c, err := controller.New(ctrlName, mgr, controller.Options{Reconciler: r})
	if err != nil {
		return err
	}

	// Watch for changes to ValidatingWebhookConfiguration with predicate for Gatekeeper webhook only
	err = c.Watch(
		source.Kind(mgr.GetCache(), &admissionregistrationv1.ValidatingWebhookConfiguration{},
			&handler.TypedEnqueueRequestForObject[*admissionregistrationv1.ValidatingWebhookConfiguration]{},
			predicate.TypedFuncs[*admissionregistrationv1.ValidatingWebhookConfiguration]{
				CreateFunc: func(e event.TypedCreateEvent[*admissionregistrationv1.ValidatingWebhookConfiguration]) bool {
					return isGatekeeperValidatingWebhook(e.Object.GetName())
				},
				UpdateFunc: func(e event.TypedUpdateEvent[*admissionregistrationv1.ValidatingWebhookConfiguration]) bool {
					return isGatekeeperValidatingWebhook(e.ObjectNew.GetName())
				},
				DeleteFunc: func(e event.TypedDeleteEvent[*admissionregistrationv1.ValidatingWebhookConfiguration]) bool {
					return isGatekeeperValidatingWebhook(e.Object.GetName())
				},
			}))
	if err != nil {
		return err
	}

	return nil
}

// ReconcileWebhookConfig reconciles ValidatingWebhookConfiguration changes.
type ReconcileWebhookConfig struct {
	client.Client
	scheme   *runtime.Scheme
	cache    *webhookconfigcache.WebhookConfigCache
	ctEvents chan<- event.GenericEvent

	// dirtyMu protects access to dirtyTemplates
	dirtyMu        sync.Mutex
	dirtyTemplates map[string]*v1beta1.ConstraintTemplate
} // +kubebuilder:rbac:groups=admissionregistration.k8s.io,resources=validatingwebhookconfigurations,verbs=get;list;watch
// +kubebuilder:rbac:groups=templates.gatekeeper.sh,resources=constrainttemplates,verbs=get;list;watch

// Reconcile processes ValidatingWebhookConfiguration changes.
func (r *ReconcileWebhookConfig) Reconcile(ctx context.Context, request reconcile.Request) (reconcile.Result, error) {
	var configChanged bool

	// Fetch the ValidatingWebhookConfiguration
	webhookConfig := &admissionregistrationv1.ValidatingWebhookConfiguration{}
	err := r.Get(ctx, request.NamespacedName, webhookConfig)
	if err != nil {
		if apierrors.IsNotFound(err) {
			// Webhook was deleted, remove from cache and trigger reconciliation for all templates
			logger.Info("ValidatingWebhookConfiguration deleted, triggering reconciliation for all ConstraintTemplates")
			r.cache.RemoveConfig(request.Name)
			configChanged = true
		} else {
			return reconcile.Result{}, err
		}
	} else {
		var gatekeeperWebhook *admissionregistrationv1.ValidatingWebhook
		for i := range webhookConfig.Webhooks {
			if webhookConfig.Webhooks[i].Name == webhook.ValidatingWebhookName {
				gatekeeperWebhook = &webhookConfig.Webhooks[i]
				break
			}
		}

		if gatekeeperWebhook == nil {
			logger.Info("webhook not found", "name", webhook.ValidatingWebhookName)
			return reconcile.Result{}, nil
		}

		newConfig := webhookconfigcache.WebhookMatchingConfig{
			NamespaceSelector: gatekeeperWebhook.NamespaceSelector,
			ObjectSelector:    gatekeeperWebhook.ObjectSelector,
			Rules:             gatekeeperWebhook.Rules,
			MatchPolicy:       gatekeeperWebhook.MatchPolicy,
			MatchConditions:   gatekeeperWebhook.MatchConditions,
		}

		if r.cache.UpsertConfig(request.Name, newConfig) {
			logger.Info("ValidatingWebhookConfiguration matching fields changed", "storedKey", request.Name)
			configChanged = true
		}
	}

	if configChanged {
		// Config changed: reconcile all constraint templates
		if err := r.triggerConstraintTemplateReconciliation(ctx); err != nil {
			logger.Error(err, "failed to trigger ConstraintTemplate reconciliation")
			return reconcile.Result{}, err
		}
	} else {
		// No config change: reconcile only dirty templates
		if err := r.triggerDirtyTemplateRec
```

### Core Architecture Module: `pkg/controller/webhookconfig/webhookconfigcache/webhookconfigcache.go`
```
package webhookconfigcache

import (
	"reflect"
	"sync"

	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

var logger = log.Log.WithName("webhook-config-cache")

// WebhookMatchingConfig represents the fields that affect resource matching in a webhook.
type WebhookMatchingConfig struct {
	NamespaceSelector *metav1.LabelSelector                        `json:"namespaceSelector,omitempty"`
	ObjectSelector    *metav1.LabelSelector                        `json:"objectSelector,omitempty"`
	Rules             []admissionregistrationv1.RuleWithOperations `json:"rules,omitempty"`
	MatchPolicy       *admissionregistrationv1.MatchPolicyType     `json:"matchPolicy,omitempty"`
	MatchConditions   []admissionregistrationv1.MatchCondition     `json:"matchConditions,omitempty"`
}

// WebhookConfigCache maintains the current state of webhook configurations.
type WebhookConfigCache struct {
	mu      sync.RWMutex
	configs map[string]WebhookMatchingConfig // webhook name -> config
}

// NewWebhookConfigCache creates a new webhook config cache.
func NewWebhookConfigCache() *WebhookConfigCache {
	return &WebhookConfigCache{
		configs: make(map[string]WebhookMatchingConfig),
	}
}

// UpsertConfig updates the cached config and returns whether it changed.
func (w *WebhookConfigCache) UpsertConfig(webhookName string, newConfig WebhookMatchingConfig) bool {
	w.mu.Lock()
	defer w.mu.Unlock()

	oldConfig, exists := w.configs[webhookName]
	if !exists || !reflect.DeepEqual(oldConfig, newConfig) {
		w.configs[webhookName] = newConfig
		logger.Info("webhook config stored/updated in cache", "key", webhookName, "cacheSize", len(w.configs))
		return true
	}
	return false
}

// RemoveConfig removes a webhook config from cache.
func (w *WebhookConfigCache) RemoveConfig(webhookName string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	delete(w.configs, webhookName)
}

// GetConfig retrieves the current webhook configuration from cache.
func (w *WebhookConfigCache) GetConfig(webhookName string) (WebhookMatchingConfig, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	config, exists := w.configs[webhookName]
	logger.Info("webhook config lookup result", "key", webhookName, "exists", exists)
	return config, exists
}

```

### Core Architecture Module: `pkg/drivers/k8scel/transform/vap_util.go`
```
package transform

import (
	"sync"

	"github.com/go-logr/logr"
	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
	admissionregistrationv1beta1 "k8s.io/api/admissionregistration/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client/config"
)

var vapMux sync.RWMutex

var VapAPIEnabled *bool

var GroupVersion *schema.GroupVersion

// SetVapAPIEnabled sets the VapAPIEnabled flag in a thread-safe manner.
// Use this instead of directly assigning transform.VapAPIEnabled when the
// value may be read concurrently (e.g., by a running controller).
func SetVapAPIEnabled(enabled *bool) {
	vapMux.Lock()
	defer vapMux.Unlock()
	VapAPIEnabled = enabled
}

// SetGroupVersion sets the GroupVersion in a thread-safe manner.
// Use this instead of directly assigning transform.GroupVersion when the
// value may be read concurrently (e.g., by a running controller).
func SetGroupVersion(gv *schema.GroupVersion) {
	vapMux.Lock()
	defer vapMux.Unlock()
	GroupVersion = gv
}

func IsVapAPIEnabled(log *logr.Logger) (bool, *schema.GroupVersion) {
	vapMux.RLock()
	if VapAPIEnabled != nil {
		apiEnabled, gvk := *VapAPIEnabled, GroupVersion
		vapMux.RUnlock()
		return apiEnabled, gvk
	}

	vapMux.RUnlock()
	vapMux.Lock()
	defer vapMux.Unlock()

	if VapAPIEnabled != nil {
		return *VapAPIEnabled, GroupVersion
	}
	cfg, err := config.GetConfig()
	if err != nil {
		log.Info("IsVapAPIEnabled GetConfig", "error", err)
		// Do not cache failure — allow retry on next reconcile
		return false, nil
	}
	clientset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		log.Info("IsVapAPIEnabled NewForConfig", "error", err)
		// Do not cache failure — allow retry on next reconcile
		return false, nil
	}

	checkGroupVersion := func(gv schema.GroupVersion) (bool, *schema.GroupVersion, error) {
		resList, err := clientset.Discovery().ServerResourcesForGroupVersion(gv.String())
		if err != nil {
			if apierrors.IsNotFound(err) {
				return false, nil, nil
			}
			return false, nil, err
		}
		for i := 0; i < len(resList.APIResources); i++ {
			if resList.APIResources[i].Name == "validatingadmissionpolicies" {
				VapAPIEnabled = new(bool)
				*VapAPIEnabled = true
				GroupVersion = &gv
				return true, GroupVersion, nil
			}
		}
		return false, nil, nil
	}

	var discoveryErr error
	if ok, gvk, err := checkGroupVersion(admissionregistrationv1.SchemeGroupVersion); ok {
		return true, gvk
	} else if err != nil {
		discoveryErr = err
	}

	if ok, gvk, err := checkGroupVersion(admissionregistrationv1beta1.SchemeGroupVersion); ok {
		return true, gvk
	} else if err != nil {
		discoveryErr = err
	}

	if discoveryErr != nil {
		log.Error(discoveryErr, "error checking VAP API availability, will retry")
		// Discovery failed — do not cache, allow retry on next reconcile
		return false, nil
	}

	log.Info("ValidatingAdmissionPolicy API not found in cluster")
	VapAPIEnabled = new(bool)
	*VapAPIEnabled = false
	return false, nil
}

```

### Core Architecture Module: `pkg/export/util/util.go`
```
package util

import (
	"errors"
	"flag"
	"strings"
)

const (
	defaultConnection = "audit-connection"
	defaultChannel    = "audit-channel"
)

const (
	// MaxConnectionStatusErrors is the maximum number of errors stored in one status field.
	MaxConnectionStatusErrors = 500
	// AdditionalPublishErrorsOmittedMessage marks a saturated publish error set.
	AdditionalPublishErrorsOmittedMessage = "additional publish error classes omitted"
)

var errAdditionalPublishErrorsOmitted = errors.New(AdditionalPublishErrorsOmittedMessage)

var (
	ExportEnabled          = flag.Bool("enable-violation-export", false, "(alpha) Enable exporting audit violations to external systems")
	AuditConnection        = flag.String("audit-connection", defaultConnection, "(alpha) Connection name for exporting audit violation messages. Defaults to audit-connection")
	AuditChannel           = flag.String("audit-channel", defaultChannel, "(alpha) Channel name for exporting audit violation messages. Defaults to audit-channel")
	AdmissionExportEnabled = flag.Bool("enable-admission-violation-export", false, "(alpha) Enable exporting admission violations to external systems")
)

// AdmissionConnectionName returns the Connection shared with audit export.
func AdmissionConnectionName() string {
	return *AuditConnection
}

// AdmissionChannelName returns the channel shared with audit export.
func AdmissionChannelName() string {
	return *AuditChannel
}

// AddPublishError records one error per stable class and bounds the returned
// map so repeated status-write failures cannot grow memory without limit.
func AddPublishError(errorsByClass map[string]error, err error) map[string]error {
	if errorsByClass == nil {
		errorsByClass = make(map[string]error)
	}
	if err == nil {
		return errorsByClass
	}
	key := PublishErrorKey(err)
	if _, exists := errorsByClass[key]; exists {
		errorsByClass[key] = err
		return errorsByClass
	}
	if len(errorsByClass) < MaxConnectionStatusErrors-1 {
		errorsByClass[key] = err
		return errorsByClass
	}
	errorsByClass[AdditionalPublishErrorsOmittedMessage] = errAdditionalPublishErrorsOmitted
	return errorsByClass
}

// PublishErrorKey returns the stable prefix used to coalesce backend errors.
func PublishErrorKey(err error) string {
	key := strings.SplitN(err.Error(), ":", 2)[0]
	if key == "" {
		return err.Error()
	}
	return key
}

// ExportMsg represents export message for each violation.
type ExportMsg struct {
	ID                    string            `json:"id,omitempty"`
	Details               interface{}       `json:"details,omitempty"`
	EventType             string            `json:"eventType,omitempty"`
	Group                 string            `json:"group,omitempty"`
	Version               string            `json:"version,omitempty"`
	Kind                  string            `json:"kind,omitempty"`
	Name                  string            `json:"name,omitempty"`
	Namespace             string            `json:"namespace,omitempty"`
	Message               string            `json:"message,omitempty"`
	EnforcementAction     string            `json:"enforcementAction,omitempty"`
	EnforcementActions    []string          `json:"enforcementActions,omitempty"`
	ConstraintAnnotations map[string]string `json:"constraintAnnotations,omitempty"`
	ResourceGroup         string            `json:"resourceGroup,omitempty"`
	ResourceAPIVersion    string            `json:"resourceAPIVersion,omitempty"`
	ResourceKind          string            `json:"resourceKind,omitempty"`
	ResourceNamespace     string            `json:"resourceNamespace,omitempty"`
	ResourceName          string            `json:"resourceName,omitempty"`
	ResourceLabels        map[string]string `json:"resourceLabels,omitempty"`
	// The remaining fields describe the admission request and are omitted from
	// audit violation records.
	Timestamp          string   `json:"timestamp,omitempty"`
	Operation          string   `json:"operation,omitempty"`
	RequestResource    string   `json:"requestResource,omitempty"`
	RequestSubresource string   `json:"requestSubresource,omitempty"`
	RequestUsername    string   `json:"requestUsername,omitempty"`
	RequestUserUID     string   `json:"requestUserUID,omitempty"`
	RequestUserGroups  []string `json:"requestUserGroups,omitempty"`
	// DryRun is a pointer so admission records emit false while audit records omit it.
	DryRun *bool `json:"dryRun,omitempty"`
}

type ExportErr struct {
	Code    ExportError `json:"code"`
	Message string      `json:"message"`
}

func (e ExportErr) Error() string {
	return e.Message
}

type ExportError string

const (
	ErrConnectionNotFound ExportError = "connection_not_found"
	ErrInvalidDataType    ExportError = "invalid_data_type"
	ErrCreatingFile       ExportError = "error_creating_file"
	ErrFileDoesNotExist   ExportError = "file_does_not_exist"
	ErrMarshalingData     ExportError = "error_marshaling_data"
	ErrWritingMessage     ExportError = "error_writing_message"
	ErrCleaningUpAudit    ExportError = "error_cleaning_up_audit"
)

const (
	AuditStartedMsg             = "audit is started"
	AuditCompletedMsg           = "audit is completed"
	AdmissionViolationEventType = "violation_admission"
)

```

### Core Architecture Module: `pkg/mutation/mutators/core/errors.go`
```
package core

import "errors"

// ErrNonKeyedSetter occurs when a setter that doesn't understand keyed lists
// is called against a keyed list.
var (
	ErrNonKeyedSetter = errors.New("mutator does not understand keyed lists")
	ErrNameLength     = errors.New("maximum name length is 63 characters")
)

```

### Core Architecture Module: `pkg/mutation/mutators/core/mutation_function.go`
```
package core

import (
	"errors"
	"fmt"

	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/path/parser"
	path "github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/path/tester"
	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation/types"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var _ types.MetadataGetter = &metadata{}

type metadata client.ObjectKey

func (m *metadata) GetName() string {
	return m.Name
}

func (m *metadata) GetNamespace() string {
	return m.Namespace
}

func Mutate(
	path parser.Path,
	tester *path.Tester,
	setter Setter,
	obj *unstructured.Unstructured,
) (bool, error) {
	if setter == nil {
		return false, errors.New("setter must not be nil")
	}
	s := &mutatorState{
		path:     path,
		tester:   tester,
		setter:   setter,
		metadata: &metadata{Name: obj.GetName(), Namespace: obj.GetNamespace()},
	}
	if len(path.Nodes) == 0 {
		return false, errors.New("attempting to mutate an empty target location")
	}
	if obj == nil {
		return false, errors.New("attempting to mutate a nil object")
	}
	mutated, _, err := s.mutateInternal(obj.Object, 0)
	return mutated, err
}

type mutatorState struct {
	path     parser.Path
	tester   *path.Tester
	setter   Setter
	metadata *metadata
}

// mutateInternal mutates the resource recursively. It returns false if there has been no change
// to any downstream objects in the tree, indicating that the mutation should not be persisted.
func (s *mutatorState) mutateInternal(current interface{}, depth int) (bool, interface{}, error) {
	pathEntry := s.path.Nodes[depth]
	switch castPathEntry := pathEntry.(type) {
	case *parser.Object:
		currentAsObject, ok := current.(map[string]interface{})
		if !ok { // Path entry type does not match current object
			return false, nil, fmt.Errorf("mismatch between path entry (type: object) and received object (type: %T). Path: %+v", current, castPathEntry)
		}
		next, exists := currentAsObject[castPathEntry.Reference]
		if exists {
			if !s.tester.ExistsOkay(depth) {
				return false, nil, nil
			}
		} else {
			if !s.tester.MissingOkay(depth) {
				return false, nil, nil
			}
		}
		// we have hit the end of our path, this is the base case
		if len(s.path.Nodes)-1 == depth {
			if err := s.setter.SetValue(currentAsObject, castPathEntry.Reference); err != nil {
				return false, nil, err
			}
			return true, currentAsObject, nil
		}
		if !exists { // Next element is missing and needs to be added
			var err error
			next, err = s.createMissingElement(depth)
			if err != nil {
				return false, nil, err
			}
		}
		mutated, next, err := s.mutateInternal(next, depth+1)
		if err != nil {
			return false, nil, err
		}
		if mutated {
			currentAsObject[castPathEntry.Reference] = next
		}
		return mutated, currentAsObject, nil
	case *parser.List:
		elementFound := false
		currentAsList, ok := current.([]interface{})
		if !ok { // Path entry type does not match current object
			return false, nil, fmt.Errorf("mismatch between path entry (type: List) and received object (type: %T). Path: %+v", current, castPathEntry)
		}
		shallowCopy := make([]interface{}, len(currentAsList))
		copy(shallowCopy, currentAsList)
		// base case
		if len(s.path.Nodes)-1 == depth {
			if !s.setter.KeyedListOkay() {
				return false, nil, ErrNonKeyedSetter
			}
			return s.setListElementToValue(shallowCopy, castPathEntry, depth)
		}

		glob := castPathEntry.Glob
		key := castPathEntry.KeyField
		// if someone says "MustNotExist" for a glob, that condition can never be satisfied
		if glob && !s.tester.ExistsOkay(depth) {
			return false, nil, nil
		}
		mutated := false
		for _, listElement := range shallowCopy {
			if glob {
				m, _, err := s.mutateInternal(listElement, depth+1)
				if err != nil {
					return false, nil, err
				}
				mutated = mutated || m
				elementFound = true
			} else if listElementAsObject, ok := listElement.(map[string]interface{}); ok {
				if elementValue, ok := listElementAsObject[key]; ok {
					if castPathEntry.KeyValue == elementValue {
						if !s.tester.ExistsOkay(depth) {
							return false, nil, nil
						}
						m, _, err := s.mutateInternal(listElement, depth+1)
						if err != nil {
							return false, nil, err
						}
						mutated = mutated || m
						elementFound = true
					}
				}
			}
		}
		// If no matching element in the array was found in non Globbed list, create a new element
		if !castPathEntry.Glob && !elementFound {
			if !s.tester.MissingOkay(depth) {
				return false, nil, nil
			}
			next, err := s.createMissingElement(depth)
			if err != nil {
				return false, nil, err
			}
			shallowCopy = append(shallowCopy, next)
			m, _, err := s.mutateInternal(next, depth+1)
			if err != nil {
				return false, nil, err
			}
			mutated = mutated || m
		}
		return mutated, shallowCopy, nil
	default:
		return false, nil, fmt.Errorf("invalid type pathEntry type: %T", pathEntry)
	}
}

func (s *mutatorState) setListElementToValue(currentAsList []interface{}, listPathEntry *parser.List, depth int) (bool, []interface{}, error) {
	if listPathEntry.Glob {
		return false, nil, fmt.Errorf("last path entry can not be globbed")
	}

	newValueAsObject, err := s.setter.KeyedListValue()
	if err != nil {
		return false, nil, err
	}

	key := listPathEntry.KeyField
	if listPathEntry.KeyValue == nil {
		return false, nil, errors.New("encountered nil key value when setting a new list element")
	}
	keyValue := listPathEntry.KeyValue

	for i, listElement := range currentAsList {
		if elementValue, found, err := nestedFieldNoCopy(listElement, key); err != nil {
			return false, nil, err
		} else if found && keyValue == elementValue {
			newKeyValue, ok := newValueAsObject[key]
			if !ok || newKeyValue != keyValue {
				return false, nil, fmt.Errorf("key value of replaced object must not change")
			}
			if !s.tester.ExistsOkay(depth) {
				return false, nil, nil
			}
			currentAsList[i] = newValueAsObject
			return true, currentAsList, nil
		}
	}
	if !s.tester.MissingOkay(depth) {
		return false, nil, nil
	}
	return true, append(currentAsList, newValueAsObject), nil
}

func (s *mutatorState) createMissingElement(depth int) (interface{}, error) {
	var next interface{}
	pathEntry := s.path.Nodes[depth]
	nextPathEntry := s.path.Nodes[depth+1]

	// Create new element of type
	switch nextPathEntry.(type) {
	case *parser.Object:
		next = make(map[string]interface{})
	case *parser.List:
		next = make([]interface{}, 0)
	}

	// Set new keyfield
	if castPathEntry, ok := pathEntry.(*parser.List); ok {
		nextAsObject, ok := next.(map[string]interface{})
		if !ok { // Path entry type does not match current object
			return nil, fmt.Errorf("two consecutive list path entries not allowed: %+v %+v", castPathEntry, nextPathEntry)
		}
		if castPathEntry.KeyValue == nil {
			return nil, fmt.Errorf("list entry has no key value")
		}
		nextAsObject[castPathEntry.KeyField] = castPathEntry.KeyValue
	}
	return next, nil
}

func nestedFieldNoCopy(current interface{}, key string) (interface{}, bool, error) {
	currentAsMap, ok := current.(map[string]interface{})
	if !ok {
		return "", false, fmt.Errorf("cast error, unable to case %T to map[string]interface{}", current)
	}
	return unstructured.NestedFieldNoCopy(currentAsMap, key)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4734** (2026-08-19): **[Release Request] Backport CVE fixes to v3.23.x branch and cut v3.23.1 patch release**
  *Symptoms*: **What steps did you take and what happened:**  - I am running on the version branch release-3.23 - Scanners are reporting CVE-2026-56852, which is fixed in master as part of #4699  - GO-2026-5880 in oras.land/oras-go/v2@v2.6.1, fixed by https://github.com/open-policy-agent/gatekeeper/pull/4674 (6055855777825aacf16efa6adc4c7c40bbf17a97). https://github.com/open-policy-agent/gatekeeper/pull/4739 - Go standard-library vulnerabilities in Go 1.26.5, fixed in Go 1.26.6. The production builder images (Dockerfile and gator.Dockerfile) should be updated on master first and then backported. https://github.com/open-policy-agent/gatekeeper/pull/4740  **What did you expect to happen:**  - Expect it to be available in v3.23.1  **Anything else you would like to add:** [Miscellaneous information that will assist in solving the issue.]   **Environment:**  - Gatekeeper version: 3.23.0 - Kubernetes version: (use `kubectl version`):
  **Post-Mortem & Fix Analysis**:
  > includes: https://github.com/open-policy-agent/gatekeeper/pull/4739

- **Issue #4607** (2026-08-07): **Missing gatekeeper_provider_error_count metric**
  *Symptoms*: I have Gatekeeper running with a Ratify provider, and the gatekeeper_provider_error_count metric described in the docs isn't being emitted at all.  (I checked directly on the metrics port.)  gatekeeper_providers is there, though.  **Environment:**  - Gatekeeper version: 3.22.2 - Kubernetes version: (use `kubectl version`): 1.33

- **Issue #4598** (2026-06-10): **Gatekeeper v3.21.0 --operation=generate causes continuous ConstraintPodStatus update loop and high API audit volume**
  *Symptoms*: **What steps did you take and what happened:**  After upgrading Gatekeeper to `v3.21.0`, we observed a significant increase in Kubernetes / Amazon EKS API audit logs.  The noisy audit events were generated by the Gatekeeper service account:  ```text username = system:serviceaccount:kube-system:gatekeeper-admin verb     = update resource = constraintpodstatuses ```  The issue was traced to a `ConstraintPodStatus` object linked to a `K8sRequiredLabels` constraint:  ```text ConstraintPodStatus/gatekeeper--audit--<pod-id>-k8srequiredlabels-psa--at--creation ```  The object was continuously updated even though its visible content was not changing.  The `gatekeeper-audit` deployment initially had the following operations enabled:  ```text --operation=generate --operation=audit --operation=status --operation=mutation-status ```  The impacted constraint was:  ```text Kind: K8sRequiredLabels Name: psa-at-creation ```  The related `ConstraintTemplate` contains both engines:  ```yaml - engine: K8sNativeValidation - engine: Rego ```  The cluster had a very small Gatekeeper policy footprint:  ```text ConstraintTemplates: 2 Constraints: 2 ConstraintPodStatuses: 8 ```  We also verified that no Gatekeeper generate / expansion / mutation resources were deployed:  ```bash kubectl get expansiontemplate -A kubectl get expansiontemplatepodstatuses -A kubectl get assign -A kubectl get assignmetadata -A kubectl get assignimage -A kubectl get modifyset -A ```  All commands returned:  ```text No reso

- **Issue #4539** (2026-04-28): **v3.22.1 missing from helm repo**
  *Symptoms*: Hi, it seems that the release v3.22.1 is missing from the https://open-policy-agent.github.io/gatekeeper/charts repo, only v3.22.0 is available. `Error: chart "gatekeeper" matching 3.22.1 not found in gatekeeper index. (try 'helm repo update'): no chart version found for gatekeeper-3.22.1` 
  **Post-Mortem & Fix Analysis**:
  > @frossi-git thanks for raising this issue, @abhisheksheth28 is working on fixing the release. As soon as that is fixed we will release 3.22.2
  > This is now fixed in v3.22.2. Please upgrade as the helm chart should be available.
  > Just upgraded to v3.22.2, working fine. Thanks.

- **Issue #4476** (2026-03-31): **Grype CVE-2026-33186: google.golang.org/grpc**
  *Symptoms*: **What steps did you take and what happened:** [A clear and concise description of what the bug is.] ```  docker pull openpolicyagent/gatekeeper:v3.23.0-beta.0   docker run --rm \   -v /var/run/docker.sock:/var/run/docker.sock \   -e GRYPE_DB_CACHE_DIR=/grype-cache \   -v "$HOME/Library/Caches/grype:/grype-cache" \   anchore/grype:latest \   openpolicyagent/gatekeeper:v3.23.0-beta.0   ```  ``` docker.io/openpolicyagent/gatekeeper:v3.23.0-beta.0 NAME                    INSTALLED  FIXED IN  TYPE       VULNERABILITY        SEVERITY  EPSS          RISK    google.golang.org/grpc  v1.78.0    1.79.3    go-module  GHSA-p77j-4mvh-x3m3  Critical  < 0.1% (2nd)  < 0.1 ```  **What did you expect to happen:** no cves CVEs  **Anything else you would like to add:** [Miscellaneous information that will assist in solving the issue.]   **Environment:**  - Gatekeeper version: - Kubernetes version: (use `kubectl version`):
  **Post-Mortem & Fix Analysis**:
  > This has already been addressed in #4450, which bumped `google.golang.org/grpc` from v1.78.0 to v1.79.3. The fix is on `master` and will be included in the next release.  Closing as resolved.
  > Reopen if you want a new beta release or let me know.

- **Issue #4452** (2026-04-01): **gatekeeper_mutators metric appears to include only AssignMetadata**
  *Symptoms*: **What steps did you take and what happened:** We have a graph of the gatekeeper_mutators metric on our clusters, and I just discovered that it's 1 everywhere even though we have 1 AssignMetadata, 4 Assign, and 2 ModifySet mutators on every cluster.  **What did you expect to happen:** The metric should be 7.  **Environment:**  - Gatekeeper version: 3.18.2 - Kubernetes version: 1.32, 33, 34, 35

- **Issue #4451** (2026-05-14): **Gatekeeper doesn't clean up constrainttemplatepodstatuses and constraintpodstatuses**
  *Symptoms*: **What steps did you take and what happened:** We are running gatekeeper with 8 controller instances on a huge EKS cluster. Gatekeeper itself runs on fargate, the rest is EC2. When a gatekeeper pod or the node is deleted it doesn't delete remaining constrainttemplatepodstatuses and constraintpodstatuses, it just add new ones with new names (name of the pod + prefixes). Currently we have about 35000 statuses in gatekeeper-system namespace, which isn't really nice for etcd.  **What did you expect to happen:** Gatekeeper deletes not used resources.  **Anything else you would like to add:** The resources names can be very long and we see errors like `resource cannot have metadata.name longer than 63 char` probably due to https://github.com/open-policy-agent/gatekeeper/blob/c51b78eab16e0006b0ae3cf3f995de2a3a69a54a/pkg/webhook/policy.go#L366-L368   **Environment:**  - Gatekeeper version: v3.20.1 - Kubernetes version: (use `kubectl version`): v1.33.8-eks-3a10415
  **Post-Mortem & Fix Analysis**:
  > In v3.20.1, pod statuses always set the Gatekeeper pod as `ownerReference`, so Kubernetes GC should clean them up automatically when the pod is deleted.  Could you share one of the orphaned status resources so we can check?  ```bash # grab one orphaned status kubectl get constrainttemplatepodstatuses -n gatekeeper-system -o yaml | head -80  # check if any are missing ownerReferences kubectl get constrainttemplatepodstatuses -n gatekeeper-system -o json | jq '.items[] | select(.metadata.ownerReferences == null or (.metadata.ownerReferences | length == 0)) | .metadata.name' | head -20 ```  Also, any custom flags on the Gatekeeper deployment?
  > ```kubectl get constrainttemplatepodstatuses -n gatekeeper-system -o json | jq '.items[] | select(.metadata.ownerReferences == null or (.metadata.ownerReferences | length == 0)) | .metadata.name' | head -20``` has no results. All Constrainttemplatepodstatuses have ownerReferences set:  ``` - apiVersion: status.gatekeeper.sh/v1beta1   kind: ConstraintTemplatePodStatus   metadata:     creationTimestamp: "2026-03-04T20:00:43Z"     generation: 2     labels:       internal.gatekeeper.sh/constrainttemplate-name: enabledeletionprotectionannotation       internal.gatekeeper.sh/pod: gatekeeper-audit-54468d64b-lj29w     name: gatekeeper--audit--54468d64b--lj29w-enabledeletionprotectionannotation     namespace: gatekeeper-system     ownerReferences:     - apiVersion: v1       kind: Pod       name: gatekeeper-audit-54468d64b-lj29w       uid: ccb8a5ac-1281-428c-a924-7f0676536aeb     resourceVersion: "1609814760"     uid: f5e036c5-4113-4b3e-b763-9f08d717b164   status:     id: gatekeeper-audit-54468d
  > Is there any garbage collection of those resources? I can't find any in the code. There is a deletion process as soon as the constraint gets deleted, but this is not our use case here.

- **Issue #4441** (2026-04-11): **VAPB lifecycle not reconciled on constraint enforcement point changes**
  *Symptoms*: **What steps did you take and what happened:** Step 1: Created a constraint template with the K8sNativeValidation CEL engine and deployed a constraint using vap.k8s.io as an enforcement point: Gatekeeper auto-generated a ValidatingAdmissionPolicyBinding (VAPB) with validationActions: [Deny] as expected. Step 2: Updated the constraint to remove vap.k8s.io and switch enforcement to Gatekeeper's webhook (simulating a fallback scenario):  **What did you expect to happen:** When vap.k8s.io is removed from scopedEnforcementActions: Gatekeeper's controller should delete the auto-generated VAPB, since the constraint no longer intends for VAP to participate in enforcement.  **Anything else you would like to add:** This issue makes it risky to adopt the VAP integration for production workloads where a reliable fallback to Gatekeeper is a requirement. Specifically:  Individual policy fallback (switching one policy from VAP back to Gatekeeper webhook) leaves a stale VAPB that continues enforcing via VAP, causing double evaluation and potential conflicts. Full rollback (switching all policies back to Gatekeeper) requires manual cleanup of all generated VAPBs across clusters, which is error-prone at scale.   **Environment:**  - Gatekeeper version: 3.18.2 - Kubernetes version: (use `kubectl version`): v1.33.7
  **Post-Mortem & Fix Analysis**:
  > @JaydipGabani Please take a look.
  > @dhruv695-sketch Can you verify if this behavior exists in latest two versions of Gatekeeper? we have made few changes since 3.18 so this could already be fixed as I do not recall anyone else encountering this recently.
  > Hey @JaydipGabani , even though you identified the issue, I upgraded to the latest version and verified that the issue still persists.

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

### Incident Patch 1: `292805f4` (2026-09-28)
**Commit Message**: chore: bump golang from `9baa6b4` to `433790e` in /build/tooling (#4850)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build/tooling/Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.27-trixie@sha256:9baa6b4187bbb98d240372a8a235ac0bb6b5ddd52bba1431dc2f7c0705862728
+FROM golang:1.27-trixie@sha256:433790e515d27dc6003e847e644cc0af956985cf315c1c58a3b73ee2dd305183
 
 RUN GO111MODULE=on go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.21.0
 RUN GO111MODULE=on go install k8s.io/code-generator/cmd/conversion-gen@v0.29.3
```

---

### Incident Patch 2: `77b9d337` (2026-09-21)
**Commit Message**: chore: bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc from 1.44.0 to 1.45.0 (#4837)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -126,7 +126,7 @@ require (
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.65.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 // indirect
 	go.opentelemetry.io/otel/trace v1.45.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
@@ -139,8 +139,8 @@ require (
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
 	google.golang.org/api v0.264.0 // indirect
 	google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
```

**File**: `go.sum` (modified, +6/-6)
```diff
@@ -283,8 +283,8 @@ go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 h1:Ruy
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0/go.mod h1:qZF+/lBs71APw8mlnEZcqZHMzqrYrsFiJOv83lX1OGo=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 h1:qazEJlUOQzhCpzQpFETGby7EdqjI1wsd0W+6Gg1SCTU=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0/go.mod h1:fOD2Yefuxixkx3ahVNf0O/PERb6r4OlbxfATVnYvzCo=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0 h1:fG5MCxGz8+2VtrN/WgqSpJFctVz24gpxj8CxkKmc8Ww=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.45.0/go.mod h1:BmAYTn+3ysbRe+IU2msxmf5Rx3g6DHvex+tWI3LdhYI=
 go.opentelemetry.io/otel/exporters/prometheus v0.63.0 h1:OLo1FNb0pBZykLqbKRZolKtGZd0Waqlr240YdMEnhhg=
 go.opentelemetry.io/otel/exporters/prometheus v0.63.0/go.mod h1:8yeQAdhrK5xsWuFehO13Dk/Xb9FuhZoVpJfpoNCfJnw=
 go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
@@ -342,10 +342,10 @@ google.golang.org/api v0.264.0 h1:+Fo3DQXBK8gLdf8rFZ3uLu39JpOnhvzJrLMQSoSYZJM=
 google.golang.org/api v0.264.0/go.mod h1:fAU1xtNNisHgOF5JooAs8rRaTkl2rT3uaoNGo9NS3R8=
 google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 h1:VQZ/yAbAtjkHgH80teYd2em3xtIkkHd7ZhqfH2N9CsM=
 google.golang.org/genproto v0.0.0-20260128011058-8636f8732409/go.mod h1:rxKD3IEILWEu3P44seeNOAwZN4SaoKaQ/2eTg4mM6EM=
-google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a h1:97PfJ4tCxY5C7NzzgGqQEMZmXbISdvSArNNEOoUGKBg=
-google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a/go.mod h1:1brfde68Npq6+WA75c1EHWPijZEG1kMus61ygPZfn4A=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a h1:qI/YMH1ep2qQtqcp00gMQyoU7mjvbhg88GJKCvfoLj0=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d h1:FarXi840EJWSHYTN3ERkADbPWjl307+FGrA22KAVjjc=
+google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d/go.mod h1:K/+WGbmBY7aNW1HDw1fJnKYo10i0DkAX6pows00dLig=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d h1:IL4hdHzcUv2l/gcg98/Rj3FbtE6axwqslOW8SW0C+S0=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
 google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
 google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
 google.golang.org/protobuf v1.36.12 h1:pJOKDDOyeXErUroCihFAd5LQuwXBSpVnKGrj5o/fwxc=
```

---

### Incident Patch 3: `08630945` (2026-09-21)
**Commit Message**: chore: bump go.opentelemetry.io/otel/exporters/otlp/otlptrace from 1.44.0 to 1.45.0 (#4835)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +9/-9)
```diff
@@ -23,12 +23,12 @@ require (
 	github.com/stretchr/testify v1.11.1
 	go.opentelemetry.io/contrib/detectors/aws/ec2 v1.21.1
 	go.opentelemetry.io/contrib/detectors/gcp v1.44.0
-	go.opentelemetry.io/otel v1.44.0
+	go.opentelemetry.io/otel v1.45.0
 	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0
 	go.opentelemetry.io/otel/exporters/prometheus v0.63.0
-	go.opentelemetry.io/otel/metric v1.44.0
-	go.opentelemetry.io/otel/sdk v1.44.0
-	go.opentelemetry.io/otel/sdk/metric v1.44.0
+	go.opentelemetry.io/otel/metric v1.45.0
+	go.opentelemetry.io/otel/sdk v1.45.0
+	go.opentelemetry.io/otel/sdk/metric v1.45.0
 	go.uber.org/zap v1.27.1
 	go.yaml.in/yaml/v2 v2.4.4
 	go.yaml.in/yaml/v3 v3.0.5
@@ -125,10 +125,10 @@ require (
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.65.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 // indirect
-	go.opentelemetry.io/otel/trace v1.44.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
+	go.opentelemetry.io/otel/trace v1.45.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	golang.org/x/crypto v0.55.0 // indirect
@@ -139,8 +139,8 @@ require (
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
 	google.golang.org/api v0.264.0 // indirect
 	google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260720211330-0afa2a65878a // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260720211330-0afa2a65878a // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/yaml.v2 v2.4.0 // indirect
```

**File**: `go.sum` (modified, +20/-20)
```diff
@@ -277,28 +277,28 @@ go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.6
 go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.65.0/go.mod h1:KDgtbWKTQs4bM+VPUr6WlL9m/WXcmkCcBlIzqxPGzmI=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 h1:CqXxU8VOmDefoh0+ztfGaymYbhdB/tT3zs79QaZTNGY=
 go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0/go.mod h1:BuhAPThV8PBHBvg8ZzZ/Ok3idOdhWIodywz2xEcRbJo=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
+go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
+go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0 h1:RuynHbfU8JUEw7DyONgkVYg2SVtsoF28y0LGIr69jgA=
 go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.44.0/go.mod h1:qZF+/lBs71APw8mlnEZcqZHMzqrYrsFiJOv83lX1OGo=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 h1:4YsVu3B8+3qtWYYrsUYgn0OG78pN0rnNPRGX4SbokQI=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0/go.mod h1:+wnlSn0mD1ADVMe3v9Z/WIaiz6q6gL2J/ejaAmdmv80=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 h1:qazEJlUOQzhCpzQpFETGby7EdqjI1wsd0W+6Gg1SCTU=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0/go.mod h1:fOD2Yefuxixkx3ahVNf0O/PERb6r4OlbxfATVnYvzCo=
 go.opentelemetry.io/otel/exporters/prometheus v0.63.0 h1:OLo1FNb0pBZykLqbKRZolKtGZd0Waqlr240YdMEnhhg=
 go.opentelemetry.io/otel/exporters/prometheus v0.63.0/go.mod h1:8yeQAdhrK5xsWuFehO13Dk/Xb9FuhZoVpJfpoNCfJnw=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
-go.opentelemetry.io/otel/metric/x v0.66.0 h1:YkCrx1zLOChi9ZcZ6euupOcsgzbVlec7D/xoEU1+cTA=
-go.opentelemetry.io/otel/metric/x v0.66.0/go.mod h1:d1+BDj9t96do0/1LoU1ayfCv79ZgNE41qbhBvnMOBZk=
-go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
-go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
-go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
-go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
-go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
-go.opentelemetry.io/proto/otlp v1.10.0 h1:IQRWgT5srOCYfiWnpqUYz9CVmbO8bFmKcwYxpuCSL2g=
-go.opentelemetry.io/proto/otlp v1.10.0/go.mod h1:/CV4QoCR/S9yaPj8utp3lvQPoqMtxXdzn7ozvvozVqk=
+go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
+go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
+go.opentelemetry.io/otel/metric/x v0.67.0 h1:PcicCNZFkZ4bXfSooXdo3WN7RBOVOtjVdo1wD358Uns=
+go.opentelemetry.io/otel/metric/x v0.67.0/go.mod h1:FBjCWZe6wgcqxcMtjdGiClDKXb2YxxXii0CXftE4QtI=
+go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
+go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
+go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJjNEYILuiE3o=
+go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
+go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
+go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
+go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
+go.opentelemetry.io/proto/otlp v1.11.0/go.mod h1:SmVizdCOAm3XBtG1g1NnOdhW6jtddT72hLMhv8VwA8E=
 go.uber.org/atomic v1.11.0 h1:ZvwS0R+56ePWxUNi+Atn9dWONBPp/AUETXlHW0DxSjE=
 go.uber.org/atomic v1.11.0/go.mod h1:LUxbIzbOniOlMKjJjyPfpl4v+PKK2cNJn91OQbhoJI0=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
@@ -342,10 +342,10 @@ google.golang.org/api v0.264.0 h1:+Fo3DQXBK8gLdf8rFZ3uLu39JpOnhvzJrLMQSoSYZJM=
 google.golang.org/api v0.264.0/go.mod h1:fAU1xtNNisHgOF5JooAs8rRaTkl2rT3uaoNGo9NS3R8=
 google.golang.org/genproto v0.0.0-20260128011058-8636f8732409 h1:VQZ/yAbAtjkHgH80teYd2em3xtIkkHd7ZhqfH2N9CsM=
 google.golang.org/genproto v0.0.0-20260128011058-8636f8732409/go.mod h1:rxKD3IEILWEu3P44seeNOAwZN4SaoKaQ/2eTg4mM6EM=
-google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
-google.gola
```

---

### Incident Patch 4: `73b952cd` (2026-09-14)
**Commit Message**: fix: construct export system only when violation export is enabled (#4779)

Signed-off-by: Pujitha Paladugu <[REDACTED_EMAIL]>
Co-authored-by: Pujitha Paladugu <[REDACTED_EMAIL]>

**File**: `Makefile` (modified, +2/-2)
```diff
@@ -196,14 +196,14 @@ all: lint test manager
 native-test: envtest
 	KUBEBUILDER_ASSETS="$(shell $(ENVTEST) use $(KUBERNETES_VERSION) --bin-dir $(LOCALBIN) -p path)" \
 	GO111MODULE=on \
-	go test ./pkg/... ./apis/... ./cmd/gator/... -coverprofile cover.out
+	go test . ./pkg/... ./apis/... ./cmd/gator/... -coverprofile cover.out
 
 # Run tests with race detector
 .PHONY: native-race-test
 native-race-test: envtest
 	KUBEBUILDER_ASSETS="$(shell $(ENVTEST) use $(KUBERNETES_VERSION) --bin-dir $(LOCALBIN) -p path)" \
 	GO111MODULE=on \
-	go test ./pkg/... ./apis/... ./cmd/gator/... -race -timeout 20m
+	go test . ./pkg/... ./apis/... ./cmd/gator/... -race -timeout 20m
 
 # Run benchmarks only (no unit tests)
 .PHONY: native-bench-test
```

**File**: `main.go` (modified, +13/-1)
```diff
@@ -53,6 +53,7 @@ import (
 	celSchema "github.com/open-policy-agent/gatekeeper/v3/pkg/drivers/k8scel/schema"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/expansion"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/export"
+	exportutil "github.com/open-policy-agent/gatekeeper/v3/pkg/export/util"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/externaldata"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/metrics"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation"
@@ -513,7 +514,7 @@ func setupControllers(ctx context.Context, mgr ctrl.Manager, tracker *readiness.
 
 	mutationSystem := mutation.NewSystem(mutationOpts)
 	expansionSystem := expansion.NewSystem(mutationSystem)
-	exportSystem := export.NewSystem()
+	exportSystem := newExportSystem()
 
 	c := mgr.GetCache()
 	dc, ok := c.(watch.RemovableCache)
@@ -647,6 +648,17 @@ func setupControllers(ctx context.Context, mgr ctrl.Manager, tracker *readiness.
 	return nil
 }
 
+// newExportSystem constructs an export.System only when audit or admission
+// violation export has been requested, since either flag requires a
+// constructed export.System. It returns nil when both are disabled so that
+// the default configuration carries no unused export dependency.
+func newExportSystem() *export.System {
+	if *exportutil.ExportEnabled || *exportutil.AdmissionExportEnabled {
+		return export.NewSystem()
+	}
+	return nil
+}
+
 func setLoggerForProduction(encoder zapcore.LevelEncoder, dest io.Writer) {
 	sink := zapcore.AddSync(os.Stderr)
 	if dest != nil {
```

**File**: `main_test.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+/*
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package main
+
+import (
+	"testing"
+
+	exportutil "github.com/open-policy-agent/gatekeeper/v3/pkg/export/util"
+)
+
+func TestNewExportSystem(t *testing.T) {
+	origExport := *exportutil.ExportEnabled
+	origAdmission := *exportutil.AdmissionExportEnabled
+	defer func() {
+		*exportutil.ExportEnabled = origExport
+		*exportutil.AdmissionExportEnabled = origAdmission
+	}()
+
+	tests := []struct {
+		name             string
+		exportEnabled    bool
+		admissionEnabled bool
+		wantNil          bool
+	}{
+		{"both disabled", false, false, true},
+		{"audit export enabled", true, false, false},
+		{"admission export enabled", false, true, false},
+		{"both enabled", true, true, false},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			*exportutil.ExportEnabled = tc.exportEnabled
+			*exportutil.AdmissionExportEnabled = tc.admissionEnabled
+
+			got := newExportSystem()
+			if gotNil := got == nil; gotNil != tc.wantNil {
+				t.Errorf("newExportSystem() = %v, want nil: %v", got, tc.wantNil)
+			}
+		})
+	}
+}
```

**File**: `pkg/audit/manager.go` (modified, +3/-0)
```diff
@@ -228,6 +228,9 @@ func (c *nsCache) Get(ctx context.Context, client client.Client, namespace strin
 
 // New creates a new manager for audit.
 func New(mgr manager.Manager, deps *Dependencies) (*Manager, error) {
+	if *exportutil.ExportEnabled && deps.ExportSystem == nil {
+		return nil, errors.New("audit violation export requires an export system")
+	}
 	reporter, err := newStatsReporter()
 	if err != nil {
 		log.Error(err, "StatsReporter could not start")
```

**File**: `pkg/audit/manager_test.go` (modified, +9/-0)
```diff
@@ -1181,3 +1181,12 @@ func TestAuditExportPublishingStateBoundsErrors(t *testing.T) {
 	require.Len(t, state.Errors, exportutil.MaxConnectionStatusErrors)
 	require.Contains(t, state.Errors, exportutil.AdditionalPublishErrorsOmittedMessage)
 }
+
+func TestNewRejectsMissingExportSystemWhenExportEnabled(t *testing.T) {
+	origExport := *exportutil.ExportEnabled
+	defer func() { *exportutil.ExportEnabled = origExport }()
+	*exportutil.ExportEnabled = true
+
+	_, err := New(nil, &Dependencies{ExportSystem: nil})
+	require.Error(t, err)
+}
```

**File**: `pkg/controller/export/export_connection_controller.go` (modified, +22/-2)
```diff
@@ -42,14 +42,34 @@ type Adder struct {
 }
 
 func (a *Adder) Add(mgr manager.Manager) error {
-	r := newReconciler(mgr, a.ExportSystem, *exportutil.AuditConnection, a.GetPod)
-	if r == nil {
+	if !*exportutil.ExportEnabled && !*exportutil.AdmissionExportEnabled {
 		log.Info("Export functionality is disabled, skipping export connection controller setup")
 		return nil
 	}
+	if isNilExporter(a.ExportSystem) {
+		return fmt.Errorf("export connection controller requires an export system")
+	}
+	r := newReconciler(mgr, a.ExportSystem, *exportutil.AuditConnection, a.GetPod)
 	return add(mgr, r)
 }
 
+// isNilExporter reports whether system is nil, including the case where it is
+// a non-nil interface wrapping a nil pointer (e.g. a typed-nil *export.System).
+// It only consults reflection for kinds that support IsNil, since calling
+// IsNil on a value-typed Exporter implementation (e.g. a struct) would panic.
+func isNilExporter(system export.Exporter) bool {
+	if system == nil {
+		return true
+	}
+	v := reflect.ValueOf(system)
+	switch v.Kind() {
+	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Ptr, reflect.Slice, reflect.UnsafePointer:
+		return v.IsNil()
+	default:
+		return false
+	}
+}
+
 func (a *Adder) InjectTracker(_ *readiness.Tracker) {}
 
 func (a *Adder) InjectExportSystem(exportSystem export.Exporter) {
```

**File**: `pkg/controller/export/export_connection_controller_test.go` (modified, +52/-0)
```diff
@@ -55,6 +55,58 @@ func (c *countingClient) Update(ctx context.Context, obj client.Object, opts ...
 	return c.Client.Update(ctx, obj, opts...)
 }
 
+func TestAdderAddRejectsMissingExportSystemWhenExportEnabled(t *testing.T) {
+	origExport := *exportutil.ExportEnabled
+	defer func() { *exportutil.ExportEnabled = origExport }()
+	*exportutil.ExportEnabled = true
+
+	a := &Adder{ExportSystem: nil}
+	require.Error(t, a.Add(nil))
+}
+
+// TestAdderAddRejectsTypedNilExportSystemWhenExportEnabled guards against the
+// typed-nil interface footgun: main.go injects ExportSystem as a concrete
+// *export.System, so a nil *export.System wrapped in the export.Exporter
+// interface must still be rejected, not just a literal nil interface.
+func TestAdderAddRejectsTypedNilExportSystemWhenExportEnabled(t *testing.T) {
+	origExport := *exportutil.ExportEnabled
+	defer func() { *exportutil.ExportEnabled = origExport }()
+	*exportutil.ExportEnabled = true
+
+	var typedNilSystem *export.System
+	a := &Adder{ExportSystem: typedNilSystem}
+	require.Error(t, a.Add(nil))
+}
+
+// TestIsNilExporterDoesNotPanicOnValueTypeExportSystem guards against a
+// reflect.Value.IsNil panic: value-type Exporter implementations (e.g. a
+// struct, as opposed to a pointer) are not nilable, so the nil check must not
+// call IsNil on them.
+func TestIsNilExporterDoesNotPanicOnValueTypeExportSystem(t *testing.T) {
+	var got bool
+	require.NotPanics(t, func() {
+		got = isNilExporter(valueExportSystem{})
+	})
+	require.False(t, got)
+}
+
+// valueExportSystem is a value-type (non-pointer) implementation of
+// export.Exporter, used to exercise the case where reflect.Value.IsNil
+// cannot be called since the underlying kind is not nilable.
+type valueExportSystem struct{}
+
+func (valueExportSystem) Publish(_ context.Context, _ string, _ string, _ interface{}) error {
+	return nil
+}
+
+func (valueExportSystem) UpsertConnection(_ context.Context, _ interface{}, _ string, _ string) error {
+	return nil
+}
+
+func (valueExportSystem) CloseConnection(_ string) error {
+	return nil
+}
+
 func TestUpdateOrCreateConnectionPodStatusSkipsStableSecondUpdate(t *testing.T) {
 	ctx := context.Background()
 	pod := fakes.Pod(fakes.WithNamespace(util.GetNamespace()), fakes.WithName("status-pod"), fakes.WithUID("status-pod-uid"))
```

---

### Incident Patch 5: `16b4c2ec` (2026-09-08)
**Commit Message**: chore: bump golang from `df98008` to `9baa6b4` in /build/tooling (#4819)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build/tooling/Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.27-trixie@sha256:df98008ecd2b0ecc9f0a94d1b07e3564a9c92b555369b33d9b5f60d0765b2db7
+FROM golang:1.27-trixie@sha256:9baa6b4187bbb98d240372a8a235ac0bb6b5ddd52bba1431dc2f7c0705862728
 
 RUN GO111MODULE=on go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.21.0
 RUN GO111MODULE=on go install k8s.io/code-generator/cmd/conversion-gen@v0.29.3
```

---

### Incident Patch 6: `3416bb5b` (2026-08-31)
**Commit Message**: fix: register current admission webhook subresources (#4785)

Signed-off-by: Jaydip Gabani <[REDACTED_EMAIL]>

**File**: `cmd/build/helmify/replacements.go` (modified, +4/-2)
```diff
@@ -291,8 +291,10 @@ var replacements = map[string]string{
     {{- end }}
     resources:
     - '*'
-    # Explicitly list all known subresources except "status" (to avoid destabilizing the cluster and increasing load on gatekeeper).
-    # You can find a rough list of subresources by doing a case-sensitive search in the Kubernetes codebase for 'Subresource("'
+    # Explicitly list known subresources except "status" and "namespaces/finalize".
+    # Status updates increase load, and intercepting namespace finalization can prevent namespace deletion.
+    # Include "services/status" for constraints that mitigate CVE-2020-8554.
+    # You can find the current list of subresources in the Kubernetes API discovery data.
     {{- range .Values.validatingWebhookSubResources }}
     - {{ . }}
     {{- end }}
```

**File**: `cmd/build/helmify/static/README.md` (modified, +2/-2)
```diff
@@ -145,7 +145,7 @@ information._
 | validatingWebhookCheckIgnoreFailurePolicy                  | The failurePolicy for the check-ignore-label validating webhook                                                                                                                                                                                                                                | `Fail`                                                                                                                                                                |
 | validatingWebhookExemptNamespacesLabels                    | Additional namespace labels that will be exempt from the validating webhook. Please note that anyone in the cluster capable to manage namespaces will be able to skip all Gatekeeper validation by setting one of these labels for their namespace.                                            | `{}`                                                                                                                                                                  |
 | validatingWebhookCustomRules                               | Custom rules for selecting which API resources trigger the webhook. Mutually exclusive with `enableDeleteOperations`. NOTE: If you change this, ensure all your constraints are still being enforced.                                                                                          | `{}`                                                                                                                                                                  |
-| validatingWebhookSubResources                                        | Rule for selecting which API subresources trigger the webhook.                                                                                                                                                                                             | `['pods/ephemeralcontainers', 'pods/exec', 'pods/log', 'pods/eviction', 'pods/portforward', 'pods/proxy', 'pods/attach', 'pods/binding', 'pods/resize', 'deployments/scale', 'replicasets/scale', 'statefulsets/scale', 'replicationcontrollers/scale', 'services/proxy', 'nodes/proxy', 'services/status']`                                                                                                                           |
+| validatingWebhookSubResources                                        | Rule for selecting which API subresources trigger the webhook.                                                                                                                                                                                             | `['pods/ephemeralcontainers', 'pods/exec', 'pods/log', 'pods/eviction', 'pods/portforward', 'pods/proxy', 'pods/attach', 'pods/binding', 'pods/resize', 'deployments/scale', 'replicasets/scale', 'statefulsets/scale', 'replicationcontrollers/scale', 'serviceaccounts/token', 'services/proxy', 'nodes/proxy', 'certificatesigningrequests/approval', 'services/status']`                                                                                                                           |
 | validatingWebhookURL                                       | Custom URL for Kubernetes API server to use to reach the validating webhook pod. If not set, the default of connecting via the kubernetes service endpoint is used.                                                                                                                            | `null`                                                                                                                                                                |
 | validatingWebhookScope                                     | The scope for the validating webhook. Does not work with `validatingWebhookCustomRules`                                                                                                                                                                                                        | `*`                                                                                                                                                                   |
 | additionalValidatingWebhookConfigsToRotateCerts                                      | The name of additional `ValidatingWebhookConfiguration`s that the gatekeeper cert rotator should manage certs for                                                                                                                                                                                                                                               | `[]`                                                                                                                         |
@@ -169,7 +169,7 @@ information._
 | mutatingWebhookMatchConditions                             | The match conditions written in CEL to further refine which resources will be selected by the webhook. All match conditions 
```

**File**: `cmd/build/helmify/static/values.yaml` (modified, +5/-0)
```diff
@@ -32,8 +32,10 @@ validatingWebhookSubResources:
     "replicasets/scale",
     "statefulsets/scale",
     "replicationcontrollers/scale",
+    "serviceaccounts/token",
     "services/proxy",
     "nodes/proxy",
+    "certificatesigningrequests/approval",
     "services/status",
   ]
 validatingWebhookURL: null
@@ -63,12 +65,15 @@ mutatingWebhookSubResources:
     "pods/proxy",
     "pods/attach",
     "pods/binding",
+    "pods/resize",
     "deployments/scale",
     "replicasets/scale",
     "statefulsets/scale",
     "replicationcontrollers/scale",
+    "serviceaccounts/token",
     "services/proxy",
     "nodes/proxy",
+    "certificatesigningrequests/approval",
     "services/status",
   ]
 mutatingWebhookURL: null
```

**File**: `config/webhook/manifests.yaml` (modified, +20/-0)
```diff
@@ -25,6 +25,24 @@ webhooks:
     - UPDATE
     resources:
     - '*'
+    - pods/ephemeralcontainers
+    - pods/exec
+    - pods/log
+    - pods/eviction
+    - pods/portforward
+    - pods/proxy
+    - pods/attach
+    - pods/binding
+    - pods/resize
+    - deployments/scale
+    - replicasets/scale
+    - statefulsets/scale
+    - replicationcontrollers/scale
+    - serviceaccounts/token
+    - services/proxy
+    - nodes/proxy
+    - certificatesigningrequests/approval
+    - services/status
   sideEffects: None
 ---
 apiVersion: admissionregistration.k8s.io/v1
@@ -88,7 +106,9 @@ webhooks:
     - replicasets/scale
     - statefulsets/scale
     - replicationcontrollers/scale
+    - serviceaccounts/token
     - services/proxy
     - nodes/proxy
+    - certificatesigningrequests/approval
     - services/status
   sideEffects: None
```

**File**: `manifest_staging/charts/gatekeeper/README.md` (modified, +2/-2)
```diff
@@ -145,7 +145,7 @@ information._
 | validatingWebhookCheckIgnoreFailurePolicy                  | The failurePolicy for the check-ignore-label validating webhook                                                                                                                                                                                                                                | `Fail`                                                                                                                                                                |
 | validatingWebhookExemptNamespacesLabels                    | Additional namespace labels that will be exempt from the validating webhook. Please note that anyone in the cluster capable to manage namespaces will be able to skip all Gatekeeper validation by setting one of these labels for their namespace.                                            | `{}`                                                                                                                                                                  |
 | validatingWebhookCustomRules                               | Custom rules for selecting which API resources trigger the webhook. Mutually exclusive with `enableDeleteOperations`. NOTE: If you change this, ensure all your constraints are still being enforced.                                                                                          | `{}`                                                                                                                                                                  |
-| validatingWebhookSubResources                                        | Rule for selecting which API subresources trigger the webhook.                                                                                                                                                                                             | `['pods/ephemeralcontainers', 'pods/exec', 'pods/log', 'pods/eviction', 'pods/portforward', 'pods/proxy', 'pods/attach', 'pods/binding', 'pods/resize', 'deployments/scale', 'replicasets/scale', 'statefulsets/scale', 'replicationcontrollers/scale', 'services/proxy', 'nodes/proxy', 'services/status']`                                                                                                                           |
+| validatingWebhookSubResources                                        | Rule for selecting which API subresources trigger the webhook.                                                                                                                                                                                             | `['pods/ephemeralcontainers', 'pods/exec', 'pods/log', 'pods/eviction', 'pods/portforward', 'pods/proxy', 'pods/attach', 'pods/binding', 'pods/resize', 'deployments/scale', 'replicasets/scale', 'statefulsets/scale', 'replicationcontrollers/scale', 'serviceaccounts/token', 'services/proxy', 'nodes/proxy', 'certificatesigningrequests/approval', 'services/status']`                                                                                                                           |
 | validatingWebhookURL                                       | Custom URL for Kubernetes API server to use to reach the validating webhook pod. If not set, the default of connecting via the kubernetes service endpoint is used.                                                                                                                            | `null`                                                                                                                                                                |
 | validatingWebhookScope                                     | The scope for the validating webhook. Does not work with `validatingWebhookCustomRules`                                                                                                                                                                                                        | `*`                                                                                                                                                                   |
 | additionalValidatingWebhookConfigsToRotateCerts                                      | The name of additional `ValidatingWebhookConfiguration`s that the gatekeeper cert rotator should manage certs for                                                                                                                                                                                                                                               | `[]`                                                                                                                         |
@@ -169,7 +169,7 @@ information._
 | mutatingWebhookMatchConditions                             | The match conditions written in CEL to further refine which resources will be selected by the webhook. All match conditions 
```

**File**: `manifest_staging/charts/gatekeeper/templates/gatekeeper-validating-webhook-configuration-validatingwebhookconfiguration.yaml` (modified, +4/-2)
```diff
@@ -75,8 +75,10 @@ webhooks:
     {{- end }}
     resources:
     - '*'
-    # Explicitly list all known subresources except "status" (to avoid destabilizing the cluster and increasing load on gatekeeper).
-    # You can find a rough list of subresources by doing a case-sensitive search in the Kubernetes codebase for 'Subresource("'
+    # Explicitly list known subresources except "status" and "namespaces/finalize".
+    # Status updates increase load, and intercepting namespace finalization can prevent namespace deletion.
+    # Include "services/status" for constraints that mitigate CVE-2020-8554.
+    # You can find the current list of subresources in the Kubernetes API discovery data.
     {{- range .Values.validatingWebhookSubResources }}
     - {{ . }}
     {{- end }}
```

**File**: `manifest_staging/charts/gatekeeper/values.yaml` (modified, +5/-0)
```diff
@@ -32,8 +32,10 @@ validatingWebhookSubResources:
     "replicasets/scale",
     "statefulsets/scale",
     "replicationcontrollers/scale",
+    "serviceaccounts/token",
     "services/proxy",
     "nodes/proxy",
+    "certificatesigningrequests/approval",
     "services/status",
   ]
 validatingWebhookURL: null
@@ -63,12 +65,15 @@ mutatingWebhookSubResources:
     "pods/proxy",
     "pods/attach",
     "pods/binding",
+    "pods/resize",
     "deployments/scale",
     "replicasets/scale",
     "statefulsets/scale",
     "replicationcontrollers/scale",
+    "serviceaccounts/token",
     "services/proxy",
     "nodes/proxy",
+    "certificatesigningrequests/approval",
     "services/status",
   ]
 mutatingWebhookURL: null
```

**File**: `manifest_staging/deploy/gatekeeper.yaml` (modified, +20/-0)
```diff
@@ -6118,6 +6118,24 @@ webhooks:
     - UPDATE
     resources:
     - '*'
+    - pods/ephemeralcontainers
+    - pods/exec
+    - pods/log
+    - pods/eviction
+    - pods/portforward
+    - pods/proxy
+    - pods/attach
+    - pods/binding
+    - pods/resize
+    - deployments/scale
+    - replicasets/scale
+    - statefulsets/scale
+    - replicationcontrollers/scale
+    - serviceaccounts/token
+    - services/proxy
+    - nodes/proxy
+    - certificatesigningrequests/approval
+    - services/status
   sideEffects: None
   timeoutSeconds: 1
 ---
@@ -6170,8 +6188,10 @@ webhooks:
     - replicasets/scale
     - statefulsets/scale
     - replicationcontrollers/scale
+    - serviceaccounts/token
     - services/proxy
     - nodes/proxy
+    - certificatesigningrequests/approval
     - services/status
   sideEffects: None
   timeoutSeconds: 3
```

---

### Incident Patch 7: `ae899213` (2026-08-31)
**Commit Message**: chore: bump golang from `6212da3` to `df98008` in /build/tooling (#4801)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build/tooling/Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.27-trixie@sha256:6212da3924947f4b6a939df02ea627c13f338f1a41d6c3fcb0dd9d076eef46c4
+FROM golang:1.27-trixie@sha256:df98008ecd2b0ecc9f0a94d1b07e3564a9c92b555369b33d9b5f60d0765b2db7
 
 RUN GO111MODULE=on go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.21.0
 RUN GO111MODULE=on go install k8s.io/code-generator/cmd/conversion-gen@v0.29.3
```

---

### Incident Patch 8: `80050b0a` (2026-08-27)
**Commit Message**: fix: prevent generated VAP update churn from defaulted scope (#4793)

Signed-off-by: Anlan Du <[REDACTED_EMAIL]>

**File**: `pkg/controller/constrainttemplate/constrainttemplate_controller.go` (modified, +1/-0)
```diff
@@ -828,6 +828,7 @@ func v1beta1ToV1(v1beta1Obj *admissionregistrationv1beta1.ValidatingAdmissionPol
 						APIGroups:   rule.APIGroups,
 						APIVersions: rule.APIVersions,
 						Resources:   rule.Resources,
+						Scope:       rule.Scope,
 					},
 				},
 			}
```

**File**: `pkg/controller/constrainttemplate/constrainttemplate_controller_test.go` (modified, +37/-0)
```diff
@@ -2292,6 +2292,43 @@ func TestManageVAP_VAPAPIDisabledPreservesRetry(t *testing.T) {
 	}
 }
 
+func TestV1beta1ToV1PreservesResourceRuleScope(t *testing.T) {
+	scope := admissionregistrationv1beta1.AllScopes
+	failurePolicy := admissionregistrationv1beta1.Fail
+	v1beta1VAP := &admissionregistrationv1beta1.ValidatingAdmissionPolicy{
+		Spec: admissionregistrationv1beta1.ValidatingAdmissionPolicySpec{
+			ParamKind: &admissionregistrationv1beta1.ParamKind{
+				APIVersion: "constraints.gatekeeper.sh/v1beta1",
+				Kind:       "TestConstraint",
+			},
+			MatchConstraints: &admissionregistrationv1beta1.MatchResources{
+				ResourceRules: []admissionregistrationv1beta1.NamedRuleWithOperations{
+					{
+						RuleWithOperations: admissionregistrationv1beta1.RuleWithOperations{
+							Operations: []admissionregistrationv1beta1.OperationType{
+								admissionregistrationv1beta1.Create,
+							},
+							Rule: admissionregistrationv1beta1.Rule{
+								APIGroups:   []string{"*"},
+								APIVersions: []string{"*"},
+								Resources:   []string{"*"},
+								Scope:       &scope,
+							},
+						},
+					},
+				},
+			},
+			FailurePolicy: &failurePolicy,
+		},
+	}
+
+	v1VAP, err := v1beta1ToV1(v1beta1VAP)
+	require.NoError(t, err)
+	require.NotNil(t, v1VAP.Spec.MatchConstraints)
+	require.Len(t, v1VAP.Spec.MatchConstraints.ResourceRules, 1)
+	require.Equal(t, &scope, v1VAP.Spec.MatchConstraints.ResourceRules[0].Scope)
+}
+
 func TestReconcile_VAPV1Beta1RecreatedWhenDeleted(t *testing.T) {
 	ctx, c := setupVersionPinnedReconcileTest(t, &admissionregistrationv1beta1.SchemeGroupVersion)
 	suffix := "VapV1Beta1ShouldBeRecreated"
```

**File**: `pkg/drivers/k8scel/transform/make_vap_objects.go` (modified, +1/-0)
```diff
@@ -166,6 +166,7 @@ func buildDefaultMatchConstraints() *admissionregistrationv1beta1.MatchResources
 						APIGroups:   []string{"*"},
 						APIVersions: []string{"*"},
 						Resources:   []string{"*"},
+						Scope:       ptr.To(admissionregistrationv1beta1.AllScopes),
 					},
 				},
 			},
```

**File**: `pkg/drivers/k8scel/transform/make_vap_objects_test.go` (modified, +9/-1)
```diff
@@ -67,7 +67,12 @@ func TestTemplateToPolicyDefinition(t *testing.T) {
 							{
 								RuleWithOperations: admissionregistrationv1beta1.RuleWithOperations{
 									Operations: []admissionregistrationv1beta1.OperationType{admissionregistrationv1beta1.Create, admissionregistrationv1beta1.Update},
-									Rule:       admissionregistrationv1beta1.Rule{APIGroups: []string{"*"}, APIVersions: []string{"*"}, Resources: []string{"*"}},
+									Rule: admissionregistrationv1beta1.Rule{
+										APIGroups:   []string{"*"},
+										APIVersions: []string{"*"},
+										Resources:   []string{"*"},
+										Scope:       ptr.To(admissionregistrationv1beta1.AllScopes),
+									},
 								},
 							},
 						},
@@ -1698,6 +1703,9 @@ func TestBuildDefaultMatchConstraints(t *testing.T) {
 	if len(rule.Resources) != 1 || rule.Resources[0] != "*" {
 		t.Errorf("expected wildcard Resources, got %v", rule.Resources)
 	}
+	if rule.Scope == nil || *rule.Scope != admissionregistrationv1beta1.AllScopes {
+		t.Errorf("expected all scopes, got %v", rule.Scope)
+	}
 }
 
 func TestAppendWebhookMatchConditions(t *testing.T) {
```

---

### Incident Patch 9: `a997c60f` (2026-08-26)
**Commit Message**: docs: add guide for managing rego at scale with helm (#4736)

Signed-off-by: Mallikarjunadevops <[REDACTED_EMAIL]>
Co-authored-by: Jaydip Gabani <[REDACTED_EMAIL]>

**File**: `website/docs/constrainttemplates.md` (modified, +36/-0)
```diff
@@ -259,3 +259,39 @@ spec:
 ConstraintTemplates support multiple ways to define policy code with the following precedence rules: (1) The legacy `spec.targets[].rego` field takes precedence over any Rego engine defined in `spec.targets[].code[]`. (2) When multiple engines are defined in the `code` array, only one engine is evaluated—the `K8sNativeValidation` (CEL) engine has higher priority than the `Rego` engine with no fallback mechanism. **Best practice:** Use the `code` array exclusively and define policy logic in only one engine (either Rego for complex policies with referential constraints and external data, or CEL for simpler validations) to avoid confusion about which policy will be evaluated.
 
 For more information on CEL integration and engine precedence, see the [Integration with Kubernetes Validating Admission Policy](validating-admission-policy.md) documentation.
+
+## Managing Rego at Scale with Helm
+
+When managing many policies or writing complex policies, it is often desirable to keep the Rego logic in separate `.rego` files. This allows you to leverage tools like `opa fmt` and `opa test` for unit testing, and maintain better code readability.
+
+Instead of manually copying and pasting your Rego code into the `ConstraintTemplate` YAML, you can use Helm to compile the template. 
+
+By utilizing the `Files.Get` function in Helm, you can inject the contents of an external Rego file directly into your `ConstraintTemplate` at deployment time.
+
+For example, your Helm template (`templates/constrainttemplate.yaml`) might look like this:
+
+```yaml
+apiVersion: templates.gatekeeper.sh/v1
+kind: ConstraintTemplate
+metadata:
+  name: k8srequiredlabels
+spec:
+  crd:
+    spec:
+      names:
+        kind: K8sRequiredLabels
+      validation:
+        openAPIV3Schema:
+          type: object
+          properties:
+            labels:
+              type: array
+              items:
+                type: string
+  targets:
+    - target: admission.k8s.gatekeeper.sh
+      rego: |
+        {{ .Files.Get "policies/requiredlabels.rego" | indent 8 }}
+```
+
+With this approach, you can maintain `policies/requiredlabels.rego` alongside your unit tests in the same repository, and Helm will seamlessly inline it when you install or upgrade the chart.
```

---

### Incident Patch 10: `02fdd4d4` (2026-08-24)
**Commit Message**: chore: bump golang from 1.26-trixie to 1.27-trixie in /build/tooling (#4762)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build/tooling/Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.26-trixie@sha256:b75d466dd608587fd66cca705a307ba65b889827d06ad61d6a75f0482b51b7c7
+FROM golang:1.27-trixie@sha256:6212da3924947f4b6a939df02ea627c13f338f1a41d6c3fcb0dd9d076eef46c4
 
 RUN GO111MODULE=on go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.21.0
 RUN GO111MODULE=on go install k8s.io/code-generator/cmd/conversion-gen@v0.29.3
```

---

### Incident Patch 11: `16028ec0` (2026-08-19)
**Commit Message**: build: bump golang builder image to Go 1.26.6 (#4740)

Signed-off-by: Sumit Asok <[REDACTED_EMAIL]>
Co-authored-by: Jaydip Gabani <[REDACTED_EMAIL]>

**File**: `test/image/Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.26-trixie@sha256:87ffdb09b6a2e29ff910748b745395e8a0299aa80b7c0551cdca9b55e3fd2b3e AS builder
+FROM golang:1.26-trixie@sha256:b75d466dd608587fd66cca705a307ba65b889827d06ad61d6a75f0482b51b7c7 AS builder
 
 ARG BATS_VERSION
 ARG ORAS_VERSION
```

---

### Incident Patch 12: `3e1553e1` (2026-08-17)
**Commit Message**: chore: bump golang from `87ffdb0` to `b75d466` in /build/tooling (#4741)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build/tooling/Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.26-trixie@sha256:87ffdb09b6a2e29ff910748b745395e8a0299aa80b7c0551cdca9b55e3fd2b3e
+FROM golang:1.26-trixie@sha256:b75d466dd608587fd66cca705a307ba65b889827d06ad61d6a75f0482b51b7c7
 
 RUN GO111MODULE=on go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.21.0
 RUN GO111MODULE=on go install k8s.io/code-generator/cmd/conversion-gen@v0.29.3
```

---

### Incident Patch 13: `994dd086` (2026-08-10)
**Commit Message**: chore: bump golang from `4ee9ffa` to `87ffdb0` in /build/tooling (#4729)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `build/tooling/Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.26-trixie@sha256:4ee9ffa999b4583ce281939cdff828763083610292f252279a0cee77473bd9a7
+FROM golang:1.26-trixie@sha256:87ffdb09b6a2e29ff910748b745395e8a0299aa80b7c0551cdca9b55e3fd2b3e
 
 RUN GO111MODULE=on go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.21.0
 RUN GO111MODULE=on go install k8s.io/code-generator/cmd/conversion-gen@v0.29.3
```

---

### Incident Patch 14: `b2120974` (2026-08-07)
**Commit Message**: fix: always emit gatekeeper_provider_error_count metric (#4694)

Signed-off-by: Dean Chen <[REDACTED_EMAIL]>

**File**: `pkg/controller/externaldata/stats_reporter.go` (modified, +21/-11)
```diff
@@ -3,6 +3,7 @@ package externaldata
 import (
 	"context"
 	"sync"
+	"sync/atomic"
 
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/metrics"
 	"go.opentelemetry.io/otel"
@@ -20,8 +21,6 @@ const (
 	providerErrorDesc = "Incremental counter for all provider errors occurring over time"
 )
 
-var providerErrorCountM metric.Int64Counter
-
 func (r *reporter) observeProviderMetric(_ context.Context, o metric.Int64Observer) error {
 	r.mu.RLock()
 	defer r.mu.RUnlock()
@@ -31,6 +30,14 @@ func (r *reporter) observeProviderMetric(_ context.Context, o metric.Int64Observ
 	return nil
 }
 
+func (r *reporter) observeProviderErrorCount(_ context.Context, o metric.Int64Observer) error {
+	// Always observe so the metric is exported even when no errors have occurred yet.
+	// A plain Int64Counter is only exported after the first Add(), which made
+	// gatekeeper_provider_error_count appear missing on healthy clusters.
+	o.Observe(r.providerErrorTotal.Load())
+	return nil
+}
+
 // newStatsReporter creates a reporter for external data provider metrics.
 func newStatsReporter() *reporter {
 	var err error
@@ -49,10 +56,12 @@ func newStatsReporter() *reporter {
 		panic(err)
 	}
 
-	// Register the gatekeeper_provider_error_count counter metric
-	providerErrorCountM, err = meter.Int64Counter(
+	// Register the gatekeeper_provider_error_count counter metric as an
+	// observable counter so it is always present on the metrics endpoint.
+	_, err = meter.Int64ObservableCounter(
 		providerErrorCountName,
 		metric.WithDescription(providerErrorDesc),
+		metric.WithInt64Callback(r.observeProviderErrorCount),
 	)
 	if err != nil {
 		panic(err)
@@ -61,16 +70,17 @@ func newStatsReporter() *reporter {
 	return r
 }
 
-// reportProviderError increments the provider error counter with the specific error type.
-func (r *reporter) reportProviderError(ctx context.Context) {
-	providerErrorCountM.Add(ctx, 1)
+// reportProviderError increments the provider error counter.
+func (r *reporter) reportProviderError(_ context.Context) {
+	r.providerErrorTotal.Add(1)
 }
 
 type reporter struct {
-	mu           sync.RWMutex
-	cache        map[types.NamespacedName]metrics.Status
-	dirty        bool
-	statusReport map[metrics.Status]int64
+	mu                sync.RWMutex
+	cache             map[types.NamespacedName]metrics.Status
+	dirty             bool
+	statusReport      map[metrics.Status]int64
+	providerErrorTotal atomic.Int64
 }
 
 func (r *reporter) add(key types.NamespacedName, status metrics.Status) {
```

**File**: `pkg/controller/externaldata/stats_reporter_test.go` (modified, +37/-3)
```diff
@@ -7,6 +7,7 @@ import (
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/metrics"
 	testmetric "github.com/open-policy-agent/gatekeeper/v3/test/metrics"
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
 	"go.opentelemetry.io/otel/attribute"
 	"go.opentelemetry.io/otel/metric"
 	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
@@ -147,8 +148,7 @@ func initializeTestInstruments(t *testing.T) (rdr *sdkmetric.PeriodicReader, r *
 	_, err = meter.Int64ObservableGauge(providerMetricName, metric.WithInt64Callback(r.observeProviderMetric))
 	assert.NoError(t, err)
 
-	// Also initialize the error counter metric that reportProviderError uses
-	providerErrorCountM, err = meter.Int64Counter(providerErrorCountName)
+	_, err = meter.Int64ObservableCounter(providerErrorCountName, metric.WithInt64Callback(r.observeProviderErrorCount))
 	assert.NoError(t, err)
 
 	return rdr, r
@@ -174,5 +174,39 @@ func TestReportProviderErrors(t *testing.T) {
 	rm := &metricdata.ResourceMetrics{}
 	assert.NoError(t, rdr.Collect(ctx, rm))
 
-	metricdatatest.AssertEqual(t, want, rm.ScopeMetrics[0].Metrics[0], metricdatatest.IgnoreTimestamp())
+	// Find the error counter among collected metrics (gauge may also be present).
+	var got metricdata.Metrics
+	found := false
+	for _, m := range rm.ScopeMetrics[0].Metrics {
+		if m.Name == providerErrorCountName {
+			got = m
+			found = true
+			break
+		}
+	}
+	require.True(t, found, "expected %s to be present in collected metrics", providerErrorCountName)
+	metricdatatest.AssertEqual(t, want, got, metricdatatest.IgnoreTimestamp())
+}
+
+func TestProviderErrorCountAlwaysEmitted(t *testing.T) {
+	// Even with zero errors recorded, the observable counter should still be exported as 0.
+	ctx := context.Background()
+	rdr, r := initializeTestInstruments(t)
+	_ = r
+
+	rm := &metricdata.ResourceMetrics{}
+	assert.NoError(t, rdr.Collect(ctx, rm))
+
+	found := false
+	for _, m := range rm.ScopeMetrics[0].Metrics {
+		if m.Name == providerErrorCountName {
+			found = true
+			sum, ok := m.Data.(metricdata.Sum[int64])
+			require.True(t, ok, "expected Sum data for counter")
+			require.NotEmpty(t, sum.DataPoints)
+			assert.Equal(t, int64(0), sum.DataPoints[0].Value)
+			break
+		}
+	}
+	assert.True(t, found, "gatekeeper_provider_error_count should be emitted even when no errors occurred")
 }
```

**File**: `pkg/mutation/system_external_data.go` (modified, +2/-2)
```diff
@@ -104,11 +104,11 @@ func (s *System) sendRequests(ctx context.Context, providerKeys map[string]sets.
 			defer mutex.Unlock()
 
 			if err != nil {
-				errors[provider.Name] = fmt.Errorf("failed to send external data request to provider %s: %w", provider.Name, err)
+					errors[provider.Name] = fmt.Errorf("failed to send external data request to provider %s: %w", provider.Name, err)
 				return
 			}
 			if err := validateExternalDataResponse(resp); err != nil {
-				errors[provider.Name] = fmt.Errorf("failed to validate external data response from provider %s: %w", provider.Name, err)
+					errors[provider.Name] = fmt.Errorf("failed to validate external data response from provider %s: %w", provider.Name, err)
 				return
 			}
 
```

---

### Incident Patch 15: `206fadb4` (2026-08-05)
**Commit Message**: fix: make ConstraintTemplate status.created monotonic (#4713)

Signed-off-by: Pujitha Paladugu <[REDACTED_EMAIL]>
Co-authored-by: Pujitha Paladugu <[REDACTED_EMAIL]>
Co-authored-by: Jaydip Gabani <[REDACTED_EMAIL]>

**File**: `pkg/controller/constrainttemplatestatus/constrainttemplatestatus_controller.go` (modified, +10/-3)
```diff
@@ -164,10 +164,17 @@ func (r *ReconcileConstraintStatus) Reconcile(ctx context.Context, request recon
 	copy(statusObjs, sObjs.Items)
 	sort.Sort(statusObjs)
 
-	var s []interface{}
-	// created is true if at least one Pod hasn't reported any errors
-	var created bool
+	// created is true if at least one Pod hasn't reported any errors. Once
+	// true, it must never revert to false: the constraint CRD is never
+	// garbage collected unless the ConstraintTemplate itself is deleted, so
+	// a later round of errors (e.g. all pods failing to recompile after an
+	// update) does not mean the CRD stopped existing.
+	created, _, err := unstructured.NestedBool(template.Object, "status", "created")
+	if err != nil {
+		return reconcile.Result{}, err
+	}
 
+	var s []interface{}
 	for i := range statusObjs {
 		// Don't report status if it's not for the correct object. This can happen
 		// if a watch gets interrupted, causing the constraint status to be deleted
```

**File**: `pkg/controller/constrainttemplatestatus/constrainttemplatestatus_controller_unit_test.go` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+/*
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package constrainttemplatestatus
+
+import (
+	"context"
+	"testing"
+
+	templatesv1beta1 "github.com/open-policy-agent/frameworks/constraint/pkg/apis/templates/v1beta1"
+	statusv1beta1 "github.com/open-policy-agent/gatekeeper/v3/apis/status/v1beta1"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/util"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/types"
+	clientfake "sigs.k8s.io/controller-runtime/pkg/client/fake"
+	"sigs.k8s.io/controller-runtime/pkg/reconcile"
+)
+
+const unitTestTemplateName = "unit-test-template"
+
+func newStatusUnitReconciler(t *testing.T, ct *templatesv1beta1.ConstraintTemplate, podStatuses ...*statusv1beta1.ConstraintTemplatePodStatus) *ReconcileConstraintStatus {
+	t.Helper()
+
+	scheme := runtime.NewScheme()
+	if err := templatesv1beta1.AddToScheme(scheme); err != nil {
+		t.Fatal(err)
+	}
+	if err := statusv1beta1.AddToScheme(scheme); err != nil {
+		t.Fatal(err)
+	}
+
+	objs := []runtime.Object{ct}
+	for _, s := range podStatuses {
+		objs = append(objs, s)
+	}
+	fakeClient := clientfake.NewClientBuilder().
+		WithScheme(scheme).
+		WithStatusSubresource(&templatesv1beta1.ConstraintTemplate{}).
+		WithRuntimeObjects(objs...).
+		Build()
+
+	return &ReconcileConstraintStatus{
+		reader:       fakeClient,
+		writer:       fakeClient,
+		statusClient: fakeClient,
+		scheme:       scheme,
+		log:          log,
+	}
+}
+
+// TestReconcile_CreatedIsMonotonic verifies that status.created never regresses from true to
+// false when every current pod status reports errors: it stays true if it was already true
+// (the CRD backing the ConstraintTemplate is never garbage collected unless the
+// ConstraintTemplate itself is deleted), and it stays false if it was never true, so a
+// genuine failure is not masked.
+func TestReconcile_CreatedIsMonotonic(t *testing.T) {
+	tests := []struct {
+		name         string
+		priorCreated bool
+		wantCreated  bool
+	}{
+		{
+			name:         "previously created stays true when all pod statuses have errors",
+			priorCreated: true,
+			wantCreated:  true,
+		},
+		{
+			name:         "never created stays false when all pod statuses have errors",
+			priorCreated: false,
+			wantCreated:  false,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			uid := types.UID("test-uid")
+			ct := &templatesv1beta1.ConstraintTemplate{
+				ObjectMeta: metav1.ObjectMeta{
+					Name: unitTestTemplateName,
+					UID:  uid,
+				},
+				Status: templatesv1beta1.ConstraintTemplateStatus{
+					Created: tt.priorCreated,
+				},
+			}
+
+			erroredStatus := newErroredPodStatus(t, "pod1", uid)
+
+			r := newStatusUnitReconciler(t, ct, erroredStatus)
+
+			if _, err := r.Reconcile(context.Background(), reconcile.Request{NamespacedName: types.NamespacedName{Name: unitTestTemplateName}}); err != nil {
+				t.Fatalf("Reconcile() error = %v", err)
+			}
+
+			got := &templatesv1beta1.ConstraintTemplate{}
+			if err := r.reader.Get(context.Background(), types.NamespacedName{Name: unitTestTemplateName}, got); err != nil {
+				t.Fatal(err)
+			}
+			if got.Status.Created != tt.wantCreated {
+				t.Errorf("status.created = %t, want %t", got.Status.Created, tt.wantCreated)
+			}
+		})
+	}
+}
+
+func newErroredPodStatus(t *testing.T, podName string, templateUID types.UID) *statusv1beta1.ConstraintTemplatePodStatus {
+	t.Helper()
+
+	name, err := statusv1beta1.KeyForConstraintTemplate(podName, unitTestTemplateName)
+	if err != nil {
+		t.Fatal(err)
+	}
+	return &statusv1beta1.ConstraintTemplatePodStatus{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      name,
+			Namespace: util.GetNamespace(),
+			Labels: map[string]string{
+				statusv1beta1.ConstraintTemplateNameLabel: unitTestTemplateName,
+				statusv1beta1.PodLabel:                    podName,
+			},
+		},
+		Status: statusv1beta1.ConstraintTemplatePodStatusStatus{
+			ID:          podName,
+			TemplateUID: templateUID,
+			Errors: []*templatesv1beta1.CreateCRDError{{
+				Code:    "create_error",
+				Message: "could not create CRD",
+			}},
+		},
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #4854** (2026-09-29): chore: bump the all group across 1 directory with 6 updates (@dependabot[bot])
- **PR #4853** (2026-09-29): chore: bump the k8s group across 1 directory with 5 updates (@dependabot[bot])
- **PR #4852** (2026-09-29): chore: bump golang from `9baa6b4` to `433790e` in /test/export/fake-subscriber (@dependabot[bot])
- **PR #4851** (2026-09-28): chore: bump golang from `9baa6b4` to `433790e` in /test/export/fake-reader (@dependabot[bot])
- **PR #4850** (2026-09-28): chore: bump golang from `9baa6b4` to `433790e` in /build/tooling (@dependabot[bot])
- **PR #4849** (2026-09-29): chore: bump golang from `9baa6b4` to `433790e` in /test/externaldata/dummy-provider (@dependabot[bot])
- **PR #4848** (2026-09-29): chore: bump golang from `9baa6b4` to `433790e` in /test/image (@dependabot[bot])
- **PR #4847** (2026-09-28): chore: bump kubectl from v1.37.0 to v1.37.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
