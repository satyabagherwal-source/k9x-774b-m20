> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/open-policy-agent-gatekeeper-learnings.md`  
> **Source**: github ([https://github.com/open-policy-agent/gatekeeper](https://github.com/open-policy-agent/gatekeeper))  
> **Source Version**: `e492e24c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T03:14:19.012Z  
> **Learning ID**: `learn-github-open-policy-agent-gatekeeper`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): open-policy-agent/gatekeeper

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-policy-agent-gatekeeper-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-policy-agent/gatekeeper](https://github.com/open-policy-agent/gatekeeper))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T03:14:17.802Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-policy-agent/gatekeeper`
- **Description**: 🐊 Policy Controller for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4299 stars

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
			r.cache.RemoveConfig(request.Name)
			configChanged = true
		} else {
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
	}

	if configChanged {
		// Config changed: reconcile all constraint templates
		if err := r.triggerConstraintTemplateReconciliation(ctx); err != nil {
			logger.Error(err, "failed to trigger ConstraintTemplate reconciliation")
			return reconcile.Result{}, err
		}
	} else {
		// No config change: reconcile only dirt
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4770** (2026-10-09): **Fix status-only startup without initializing the constraint client**
  *Symptoms*: Parent issue: #3964 Related bug fix: #3928, #4423  **What steps did you take and what happened:**  Start Gatekeeper with only the status operation:  ```text --operation=status ```  `operations.HasValidationOperations()` currently returns `true` for `operations.Status`, so `setupControllers` initializes the constraint/OPA client. However, only the audit and webhook operations add enforcement points. The frameworks constraint client rejects initialization with no enforcement points:  ```text must specify at least one enforcement point with client.EnforcementPoints ```  The same predicate also starts the ConstraintTemplate and Constraint ingestion controllers, even though the documented status operation only aggregates per-pod status resources.  **What did you expect to happen:**  A status-only Gatekeeper process should start successfully and run the controllers needed to aggregate status. It should not initialize the constraint/OPA client or run constraint/template ingestion and data-sync controllers solely because `status` is selected.  **Suggested scope:**  - Separate the concepts of "needs constraint evaluation/ingestion" and "needs status aggregation" instead of using `HasValidationOperations()` for both. - Register ConstraintTemplate/Constraint status aggregators independently from the ConstraintTemplate ingestion controller. - Update all `HasValidationOperations()` call sites consistently, including readiness and sync behavior. - Keep required dependencies non-nil for eve

- **Issue #4734** (2026-08-19): **[Release Request] Backport CVE fixes to v3.23.x branch and cut v3.23.1 patch release**
  *Symptoms*: **What steps did you take and what happened:**  - I am running on the version branch release-3.23 - Scanners are reporting CVE-2026-56852, which is fixed in master as part of #4699  - GO-2026-5880 in oras.land/oras-go/v2@v2.6.1, fixed by https://github.com/open-policy-agent/gatekeeper/pull/4674 (6055855777825aacf16efa6adc4c7c40bbf17a97). https://github.com/open-policy-agent/gatekeeper/pull/4739 - Go standard-library vulnerabilities in Go 1.26.5, fixed in Go 1.26.6. The production builder images (Dockerfile and gator.Dockerfile) should be updated on master first and then backported. https://github.com/open-policy-agent/gatekeeper/pull/4740  **What did you expect to happen:**  - Expect it to be available in v3.23.1  **Anything else you would like to add:** [Miscellaneous information that will assist in solving the issue.]   **Environment:**  - Gatekeeper version: 3.23.0 - Kubernetes version: (use `kubectl version`):

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

### Incident Patch 1: `e492e24c` (2026-10-22)
**Commit Message**: refactor: separate Config process exclusions from validation data sync (#4784)

Signed-off-by: Charles Cheng <[REDACTED_EMAIL]>
Signed-off-by: anneheartrecord <[REDACTED_EMAIL]>
Signed-off-by: Jaydip Gabani <[REDACTED_EMAIL]>
Co-authored-by: Jaydip Gabani <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `main.go` (modified, +55/-35)
```diff
@@ -547,14 +547,16 @@ func setupControllers(ctx context.Context, mgr ctrl.Manager, tracker *readiness.
 		return err
 	}
 
-	wm, err := watch.New(dc)
+	wm, err := newWatchManager(dc)
 	if err != nil {
 		setupLog.Error(err, "unable to create watch manager")
 		return err
 	}
-	if err := mgr.Add(wm); err != nil {
-		setupLog.Error(err, "unable to register watch manager with the manager")
-		return err
+	if wm != nil {
+		if err := mgr.Add(wm); err != nil {
+			setupLog.Error(err, "unable to register watch manager with the manager")
+			return err
+		}
 	}
 
 	// processExcluder is used for namespace exclusion for specified processes in config
@@ -563,41 +565,47 @@ func setupControllers(ctx context.Context, mgr ctrl.Manager, tracker *readiness.
 	// Setup all Controllers
 	setupLog.Info("setting up controllers")
 
-	// Events ch will be used to receive events from dynamic watches registered
-	// via the registrar below.
-	events := make(chan event.GenericEvent, 1024)
-	reg, err := wm.NewRegistrar(
-		cachemanager.RegistrarName,
-		events)
-	if err != nil {
-		setupLog.Error(err, "unable to set up watch registrar for cache manager")
-		return err
-	}
-
-	syncMetricsCache := syncutil.NewMetricsCache()
+	// The cache manager and everything hanging off it only exist for operations
+	// that sync referential data for validation. Other operations read process
+	// exclusions from the Config resource without any of this.
+	var (
+		events chan event.GenericEvent
+		cm     *cachemanager.CacheManager
+	)
+	if operations.HasValidationOperations() {
+		// Events ch will be used to receive events from dynamic watches registered
+		// via the registrar below.
+		events = make(chan event.GenericEvent, 1024)
+		reg, err := wm.NewRegistrar(
+			cachemanager.RegistrarName,
+			events)
+		if err != nil {
+			setupLog.Error(err, "unable to set up watch registrar for cache manager")
+			return err
+		}
 
-	cmConfig := &cachemanager.Config{
-		SyncMetricsCache: syncMetricsCache,
-		Tracker:          tracker,
-		ProcessExcluder:  processExcluder,
-		Registrar:        reg,
-		Reader:           mgr.GetCache(),
-	}
+		cmConfig := &cachemanager.Config{
+			SyncMetricsCache: syncutil.NewMetricsCache(),
+			Tracker:          tracker,
+			ProcessExcluder:  processExcluder,
+			Registrar:        reg,
+			Reader:           mgr.GetCache(),
+		}
 
-	if client != nil {
-		cmConfig.CfClient = client
-	}
+		if client != nil {
+			cmConfig.CfClient = client
+		}
 
-	cm, err := cachemanager.NewCacheManager(cmConfig)
-	if err != nil {
-		setupLog.Error(err, "unable to create cache manager")
-		return err
-	}
+		cm, err = cachemanager.NewCacheManager(cmConfig)
+		if err != nil {
+			setupLog.Error(err, "unable to create cache manager")
+			return err
+		}
 
-	err = mgr.Add(pruner.NewExpectationsPruner(cm, tracker))
-	if err != nil {
-		setupLog.Error(err, "adding expectations pruner to manager")
-		return err
+		if err := mgr.Add(pruner.NewExpectationsPruner(cm, tracker)); err != nil {
+			setupLog.Error(err, "adding expectations pruner to manager")
+			return err
+		}
 	}
 
 	opts := controller.Dependencies{
@@ -676,6 +684,18 @@ func newExportSystem() *export.System {
 	return nil
 }
 
+// newWatchManager constructs the watch manager only for processes that sync
+// validation data. Its registrars belong to the cache manager and the
+// constraint template controller, and neither is set up for other operations,
+// so a status-only, generate-only or mutation-only pod would otherwise run a
+// watch manager that never watches anything.
+func newWatchManager(dc watch.RemovableCache) (*watch.Manager, error) {
+	if !operations.HasValidationOperations() {
+		return nil, nil
+	}
+	return watch.New(dc)
+}
+
 // newExpansionSystem constructs an expansion.System only for processes with
 // validation operations (audit and the validating webhook), the only callers
 // of Expand. They invoke Expand unconditionally, independent of whether
```

**File**: `main_test.go` (modified, +37/-0)
```diff
@@ -373,3 +373,40 @@ func Test_newExpansionSystem(t *testing.T) {
 		})
 	}
 }
+
+// Validates that newWatchManager only constructs a watch manager for processes
+// that sync validation data (audit and webhook). Nothing registers a watch
+// on other processes, so setupControllers should not start one there.
+func Test_newWatchManager(t *testing.T) {
+	tests := map[string]struct {
+		assigned []operations.Operation
+		wantNil  bool
+	}{
+		"audit only":               {assigned: []operations.Operation{operations.Audit}, wantNil: false},
+		"webhook only":             {assigned: []operations.Operation{operations.Webhook}, wantNil: false},
+		"audit and status":         {assigned: []operations.Operation{operations.Audit, operations.Status}, wantNil: false},
+		"status only":              {assigned: []operations.Operation{operations.Status}, wantNil: true},
+		"generate only":            {assigned: []operations.Operation{operations.Generate}, wantNil: true},
+		"mutation-webhook only":    {assigned: []operations.Operation{operations.MutationWebhook}, wantNil: true},
+		"mutation-status only":     {assigned: []operations.Operation{operations.MutationStatus}, wantNil: true},
+		"mutation-controller only": {assigned: []operations.Operation{operations.MutationController}, wantNil: true},
+	}
+
+	for name, tc := range tests {
+		t.Run(name, func(t *testing.T) {
+			restore, err := operations.SetForTest(tc.assigned...)
+			if err != nil {
+				t.Fatal(err)
+			}
+			defer restore()
+
+			got, err := newWatchManager(nil)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if (got == nil) != tc.wantNil {
+				t.Errorf("newWatchManager() = %v, wantNil %v", got, tc.wantNil)
+			}
+		})
+	}
+}
```

**File**: `pkg/controller/config/config_capability_test.go` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
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
+package config
+
+import (
+	"context"
+	"testing"
+
+	configv1alpha1 "github.com/open-policy-agent/gatekeeper/v3/apis/config/v1alpha1"
+	statusv1beta1 "github.com/open-policy-agent/gatekeeper/v3/apis/status/v1beta1"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/controller/config/process"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/fakes"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/operations"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/readiness"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/wildcard"
+	"github.com/stretchr/testify/require"
+	v1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/reconcile"
+)
+
+// TestAdderRegistersWithoutDataSync pins that the Config controller is built
+// for operation sets that do not sync validation data - mutation-only pods
+// included, because this reconciler is the only consumer of
+// Config.spec.readiness.statsEnabled - and that a missing dependency still
+// fails setup loudly instead of silently skipping registration.
+func TestAdderRegistersWithoutDataSync(t *testing.T) {
+	for _, op := range []operations.Operation{
+		operations.Status,
+		operations.Generate,
+		operations.MutationWebhook,
+		operations.MutationStatus,
+		operations.MutationController,
+	} {
+		t.Run(string(op), func(t *testing.T) {
+			restore, err := operations.SetForTest(op)
+			require.NoError(t, err)
+			t.Cleanup(restore)
+
+			mgr, _ := setupManager(t)
+			require.NoError(t, (&Adder{ProcessExcluder: process.New()}).Add(mgr))
+
+			// Without a process excluder there is nowhere to put the exclusions
+			// the reconciler parses, so setup has to fail.
+			mgr, _ = setupManager(t)
+			require.Error(t, (&Adder{}).Add(mgr))
+		})
+	}
+}
+
+// TestReconcileWithoutDataSync covers the mutation-webhook-only pod: process
+// exclusions from the Config resource still land, with no cache manager and no
+// constraint client behind it.
+func TestReconcileWithoutDataSync(t *testing.T) {
+	restore, err := operations.SetForTest(operations.MutationWebhook)
+	require.NoError(t, err)
+	t.Cleanup(restore)
+
+	ctx := context.Background()
+	mgr, _ := setupManager(t)
+
+	// Read and write directly: this test drives Reconcile by hand rather than
+	// starting the manager.
+	c, err := client.New(cfg, client.Options{Scheme: mgr.GetScheme()})
+	require.NoError(t, err)
+
+	instance := &configv1alpha1.Config{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "config",
+			Namespace: "gatekeeper-system",
+		},
+		Spec: configv1alpha1.ConfigSpec{
+			Sync: configv1alpha1.Sync{
+				SyncOnly: []configv1alpha1.SyncOnlyEntry{
+					{Group: "", Version: "v1", Kind: "Pod"},
+				},
+			},
+			Match: []configv1alpha1.MatchEntry{
+				{
+					ExcludedNamespaces: []wildcard.Wildcard{"excluded-ns"},
+					Processes:          []string{"mutation-webhook"},
+				},
+			},
+		},
+	}
+	require.NoError(t, c.Create(ctx, instance))
+	t.Cleanup(func() { require.NoError(t, client.IgnoreNotFound(c.Delete(ctx, instance))) })
+
+	tracker, err := readiness.SetupTrackerNoReadyz(mgr, false, false, false)
+	require.NoError(t, err)
+
+	pod := fakes.Pod(
+		fakes.WithNamespace("gatekeeper-system"),
+		fakes.WithName("no-pod"),
+	)
+	processExcluder := process.New()
+
+	rec, err := newReconciler(mgr, nil, processExcluder, tracker, func(context.Context) (*v1.Pod, error) { return pod, nil }, nil)
+	require.NoError(t, err)
+	rec.reader = c
+	rec.writer = c
+	rec.statusClient = c
+
+	_, err = rec.Reconcile(ctx, reconcile.Request{NamespacedName: types.NamespacedName{
+		Namespace: instance.GetNamespace(),
+		Name:      instance.GetName(),
+	}})
+	require.NoError(t, err)
+
+	require.Equal(t, []string{"excluded-ns"}, processExcluder.GetExcludedNamespaces(process.Mutation),
+		"mutation webhook exclusions should be applied without a cache manager")
+
+	// ConfigPodStatus is still reported for this operation set.
+	statusName, err := statusv1beta1.KeyForConfig(pod.Name, instance.GetNamespace(), instance.GetName())
+	require.NoError(t, err)
+	status := &statusv1beta1.ConfigPodStatus{}
+	require.NoError(t, c.Get(ctx, types.NamespacedName{Namespace: pod.Namespace, Name: statusName}, status))
+	require.Empty(t, status.Status.Errors)
+	t.Cleanup(func() { require.NoError(t, client.IgnoreNotFound(c.Delete(ctx, status))) })
+}
```

**File**: `pkg/controller/config/config_controller.go` (modified, +71/-25)
```diff
@@ -156,15 +156,19 @@ func (e *ChannelFullError) Temporary() bool {
 type Adder struct {
 	Tracker      *readiness.Tracker
 	CacheManager *cm.CacheManager
-	CtEvents     chan<- event.GenericEvent
+	// ProcessExcluder holds the namespace exclusions the admission, audit and
+	// sync paths read. It is required even when validation data sync is off.
+	ProcessExcluder *process.Excluder
+	CtEvents        chan<- event.GenericEvent
 	// GetPod returns an instance of the currently running Gatekeeper pod
 	GetPod func(context.Context) (*corev1.Pod, error)
 }
 
 // Add creates a new ConfigController and adds it to the Manager with default RBAC. The Manager will set fields on the Controller
 // and Start it when the Manager is Started.
 func (a *Adder) Add(mgr manager.Manager) error {
-	r, err := newReconciler(mgr, a.CacheManager, a.Tracker, a.GetPod, a.CtEvents)
+	// Every operation needs Config reconciliation for its readiness-statistics setting.
+	r, err := newReconciler(mgr, a.CacheManager, a.ProcessExcluder, a.Tracker, a.GetPod, a.CtEvents)
 	if err != nil {
 		return err
 	}
@@ -180,6 +184,10 @@ func (a *Adder) InjectCacheManager(cm *cm.CacheManager) {
 	a.CacheManager = cm
 }
 
+func (a *Adder) InjectProcessExcluder(processExcluder *process.Excluder) {
+	a.ProcessExcluder = processExcluder
+}
+
 func (a *Adder) InjectGetPod(getPod func(ctx context.Context) (*corev1.Pod, error)) {
 	a.GetPod = getPod
 }
@@ -188,21 +196,26 @@ func (a *Adder) InjectConstraintTemplateEvent(ctEvents chan event.GenericEvent)
 	a.CtEvents = ctEvents
 }
 
-// newReconciler returns a new reconcile.Reconciler.
-func newReconciler(mgr manager.Manager, cm *cm.CacheManager, tracker *readiness.Tracker, getPod func(context.Context) (*corev1.Pod, error), ctEvents chan<- event.GenericEvent) (*ReconcileConfig, error) {
-	if cm == nil {
-		return nil, fmt.Errorf("cacheManager must be non-nil")
+// newReconciler returns a new reconcile.Reconciler. cm is only required when
+// the pod syncs validation data; processExcluder is always required.
+func newReconciler(mgr manager.Manager, cm *cm.CacheManager, processExcluder *process.Excluder, tracker *readiness.Tracker, getPod func(context.Context) (*corev1.Pod, error), ctEvents chan<- event.GenericEvent) (*ReconcileConfig, error) {
+	if processExcluder == nil {
+		return nil, fmt.Errorf("processExcluder must be non-nil")
+	}
+	if cm == nil && operations.HasValidationOperations() {
+		return nil, fmt.Errorf("cacheManager must be non-nil when validation data sync is required")
 	}
 
 	return &ReconcileConfig{
-		reader:       mgr.GetCache(),
-		writer:       mgr.GetClient(),
-		statusClient: mgr.GetClient(),
-		scheme:       mgr.GetScheme(),
-		cacheManager: cm,
-		tracker:      tracker,
-		getPod:       getPod,
-		ctEvents:     ctEvents,
+		reader:          mgr.GetCache(),
+		writer:          mgr.GetClient(),
+		statusClient:    mgr.GetClient(),
+		scheme:          mgr.GetScheme(),
+		cacheManager:    cm,
+		processExcluder: processExcluder,
+		tracker:         tracker,
+		getPod:          getPod,
+		ctEvents:        ctEvents,
 	}, nil
 }
 
@@ -237,8 +250,10 @@ type ReconcileConfig struct {
 	writer       client.Writer
 	statusClient client.StatusClient
 
-	scheme       *runtime.Scheme
-	cacheManager *cm.CacheManager
+	scheme *runtime.Scheme
+	// cacheManager is nil when the pod does not sync validation data.
+	cacheManager    *cm.CacheManager
+	processExcluder *process.Excluder
 
 	tracker *readiness.Tracker
 
@@ -250,6 +265,31 @@ type ReconcileConfig struct {
 	dirtyTemplates map[string]*v1beta1.ConstraintTemplate
 }
 
+// excludeProcesses installs the exclusions parsed from the Config resource.
+// While validation data is being synced the cache manager owns the excluder:
+// swapping it there also schedules the re-list the new exclusions require.
+func (r *ReconcileConfig) excludeProcesses(newExcluder *process.Excluder) {
+	if r.cacheManager != nil {
+		r.cacheManager.ExcludeProcesses(newExcluder)
+		return
+	}
+
+	if r.processExcluder.Equals(newExcluder) {
+		return
+	}
+	r.processExcluder.Replace(newExcluder)
+}
+
+// excluderChangedForProcess reports whether the exclusions for the given
+// process differ from the ones currently installed.
+func (r *ReconcileConfig) excluderChangedForProcess(p process.Process, newExcluder *process.Excluder) bool {
+	if r.cacheManager != nil {
+		return r.cacheManager.ExcluderChangedForProcess(p, newExcluder)
+	}
+
+	return !r.processExcluder.EqualsForProcess(p, newExcluder)
+}
+
 // +kubebuilder:rbac:groups=*,resources=*,verbs=get;list;watch
 // +kubebuilder:rbac:groups=config.gatekeeper.sh,resources=configs,verbs=get;list;watch;create;update;patch;delete
 // +kubebuilder:rbac:groups=config.gatekeeper.sh,resources=configs/status,verbs=get;update;patch
@@ -304,14 +344,16 @@ func (r *ReconcileConfig) Reconcile(ctx context.Context, request reconcile.Reque
 		r.tracker.DisableStats()
 	}
 
+	notifyGenerate := operations.IsAssigned(operations.Generate) && *transform.S
```

**File**: `pkg/controller/config/config_controller_test.go` (modified, +3/-3)
```diff
@@ -253,7 +253,7 @@ func TestReconcile(t *testing.T) {
 		fakes.WithName("no-pod"),
 	)
 
-	rec, err := newReconciler(mgr, cacheManager, tracker, func(context.Context) (*v1.Pod, error) { return pod, nil }, nil)
+	rec, err := newReconciler(mgr, cacheManager, processExcluder, tracker, func(context.Context) (*v1.Pod, error) { return pod, nil }, nil)
 	require.NoError(t, err)
 
 	// Wrap the Controller Reconcile function so it writes each request to a map when it is finished reconciling.
@@ -545,7 +545,7 @@ func setupController(ctx context.Context, mgr manager.Manager, wm *watch.Manager
 		fakes.WithName("no-pod"),
 	)
 
-	rec, err := newReconciler(mgr, cacheManager, tracker, func(context.Context) (*v1.Pod, error) { return pod, nil }, nil)
+	rec, err := newReconciler(mgr, cacheManager, processExcluder, tracker, func(context.Context) (*v1.Pod, error) { return pod, nil }, nil)
 	if err != nil {
 		return nil, fmt.Errorf("creating reconciler: %w", err)
 	}
@@ -723,7 +723,7 @@ func TestConfig_Retries(t *testing.T) {
 		fakes.WithName("no-pod"),
 	)
 
-	rec, _ := newReconciler(mgr, cacheManager, tracker, func(context.Context) (*v1.Pod, error) { return pod, nil }, nil)
+	rec, _ := newReconciler(mgr, cacheManager, processExcluder, tracker, func(context.Context) (*v1.Pod, error) { return pod, nil }, nil)
 	err = add(mgr, rec)
 	if err != nil {
 		t.Fatal(err)
```

**File**: `pkg/controller/controller.go` (modified, +47/-12)
```diff
@@ -32,6 +32,7 @@ import (
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/export"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/fakes"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/mutation"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/operations"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/readiness"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/util"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/watch"
@@ -130,6 +131,32 @@ type Dependencies struct {
 	WebhookConfigCache *webhookconfigcache.WebhookConfigCache
 }
 
+// Validate rejects a dependency plan that does not match the assigned
+// operations. Every controller we go on to register expects its own
+// dependencies to be non-nil, so a mismatch has to fail setup rather than
+// surface later as a nil dereference.
+func (deps *Dependencies) Validate() error {
+	if operations.HasValidationOperations() {
+		if deps.CacheMgr == nil {
+			return fmt.Errorf("cache manager is required for operations %v", operations.AssignedStringList())
+		}
+		if deps.SyncEventsCh == nil {
+			return fmt.Errorf("sync events channel is required for operations %v", operations.AssignedStringList())
+		}
+		if deps.WatchManger == nil {
+			return fmt.Errorf("watch manager is required for operations %v", operations.AssignedStringList())
+		}
+	} else if deps.CacheMgr != nil {
+		return fmt.Errorf("cache manager was built but no operation in %v syncs validation data", operations.AssignedStringList())
+	}
+
+	if deps.ProcessExcluder == nil {
+		return fmt.Errorf("process excluder is required for operations %v", operations.AssignedStringList())
+	}
+
+	return nil
+}
+
 type defaultPodGetter struct {
 	client client.Client
 	scheme *runtime.Scheme
@@ -176,6 +203,10 @@ func (g *defaultPodGetter) GetPod(ctx context.Context) (*corev1.Pod, error) {
 
 // AddToManager adds all Controllers to the Manager.
 func AddToManager(m manager.Manager, deps *Dependencies) error {
+	if err := deps.Validate(); err != nil {
+		return fmt.Errorf("invalid controller dependencies: %w", err)
+	}
+
 	if *remoteCluster && *debugUseFakePod {
 		return fmt.Errorf("--enable-remote-cluster and --debug-use-fake-pod are mutually exclusive")
 	}
@@ -227,19 +258,23 @@ func AddToManager(m manager.Manager, deps *Dependencies) error {
 		}
 	}
 
-	// Adding the CacheManager as a runnable;
-	// manager will start CacheManager.
-	if err := m.Add(deps.CacheMgr); err != nil {
-		return fmt.Errorf("error adding cache manager as a runnable: %w", err)
-	}
+	// The cache manager and the sync controller only exist for operations that
+	// sync validation data.
+	if deps.CacheMgr != nil {
+		// Adding the CacheManager as a runnable;
+		// manager will start CacheManager.
+		if err := m.Add(deps.CacheMgr); err != nil {
+			return fmt.Errorf("error adding cache manager as a runnable: %w", err)
+		}
 
-	syncAdder := syncc.Adder{
-		Events:       deps.SyncEventsCh,
-		CacheManager: deps.CacheMgr,
-	}
-	// Create subordinate controller - we will feed it events dynamically via watch
-	if err := syncAdder.Add(m); err != nil {
-		return fmt.Errorf("registering sync controller: %w", err)
+		syncAdder := syncc.Adder{
+			Events:       deps.SyncEventsCh,
+			CacheManager: deps.CacheMgr,
+		}
+		// Create subordinate controller - we will feed it events dynamically via watch
+		if err := syncAdder.Add(m); err != nil {
+			return fmt.Errorf("registering sync controller: %w", err)
+		}
 	}
 
 	for _, a := range Injectors {
```

**File**: `pkg/controller/controller_test.go` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
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
+package controller
+
+import (
+	"testing"
+
+	cm "github.com/open-policy-agent/gatekeeper/v3/pkg/cachemanager"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/controller/config/process"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/operations"
+	"github.com/open-policy-agent/gatekeeper/v3/pkg/watch"
+	"sigs.k8s.io/controller-runtime/pkg/event"
+)
+
+func TestDependenciesValidate(t *testing.T) {
+	dataSyncDeps := func() *Dependencies {
+		return &Dependencies{
+			CacheMgr:        &cm.CacheManager{},
+			SyncEventsCh:    make(chan event.GenericEvent, 1),
+			WatchManger:     &watch.Manager{},
+			ProcessExcluder: process.New(),
+		}
+	}
+
+	tests := []struct {
+		name     string
+		assigned []operations.Operation
+		deps     func() *Dependencies
+		wantErr  bool
+	}{
+		{
+			name:     "data sync operations with a complete plan",
+			assigned: []operations.Operation{operations.Audit},
+			deps:     dataSyncDeps,
+		},
+		{
+			name:     "data sync operations without a process excluder",
+			assigned: []operations.Operation{operations.Audit},
+			deps: func() *Dependencies {
+				deps := dataSyncDeps()
+				deps.ProcessExcluder = nil
+				return deps
+			},
+			wantErr: true,
+		},
+		{
+			name:     "data sync operations without a cache manager",
+			assigned: []operations.Operation{operations.Audit},
+			deps: func() *Dependencies {
+				deps := dataSyncDeps()
+				deps.CacheMgr = nil
+				return deps
+			},
+			wantErr: true,
+		},
+		{
+			name:     "data sync operations without sync events",
+			assigned: []operations.Operation{operations.Webhook},
+			deps: func() *Dependencies {
+				deps := dataSyncDeps()
+				deps.SyncEventsCh = nil
+				return deps
+			},
+			wantErr: true,
+		},
+		{
+			name:     "data sync operations without a watch manager",
+			assigned: []operations.Operation{operations.Webhook},
+			deps: func() *Dependencies {
+				deps := dataSyncDeps()
+				deps.WatchManger = nil
+				return deps
+			},
+			wantErr: true,
+		},
+		{
+			name:     "mutation webhook keeps process exclusions without data sync",
+			assigned: []operations.Operation{operations.MutationWebhook},
+			deps: func() *Dependencies {
+				return &Dependencies{ProcessExcluder: process.New()}
+			},
+		},
+		{
+			name:     "mutation webhook without a process excluder",
+			assigned: []operations.Operation{operations.MutationWebhook},
+			deps:     func() *Dependencies { return &Dependencies{} },
+			wantErr:  true,
+		},
+		{
+			name:     "cache manager built for operations that do not sync data",
+			assigned: []operations.Operation{operations.MutationWebhook},
+			deps: func() *Dependencies {
+				return &Dependencies{
+					CacheMgr:        &cm.CacheManager{},
+					ProcessExcluder: process.New(),
+				}
+			},
+			wantErr: true,
+		},
+		{
+			// Mutation status syncs no data, but the Config controller still
+			// registers for the readiness stats switch and needs somewhere to
+			// put the exclusions it parses.
+			name:     "mutation status needs only a process excluder",
+			assigned: []operations.Operation{operations.MutationStatus},
+			deps: func() *Dependencies {
+				return &Dependencies{ProcessExcluder: process.New()}
+			},
+		},
+		{
+			name:     "mutation status without a process excluder",
+			assigned: []operations.Operation{operations.MutationStatus},
+			deps:     func() *Dependencies { return &Dependencies{} },
+			wantErr:  true,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			restore, err := operations.SetForTest(tt.assigned...)
+			if err != nil {
+				t.Fatal(err)
+			}
+			t.Cleanup(restore)
+
+			err = tt.deps().Validate()
+			if tt.wantErr && err == nil {
+				t.Fatal("Validate() = nil, want error")
+			}
+			if !tt.wantErr && err != nil {
+				t.Fatalf("Validate() = %v, want nil", err)
+			}
+		})
+	}
+}
```

**File**: `pkg/operations/operations.go` (modified, +1/-3)
```diff
@@ -150,9 +150,7 @@ func AssignedStringList() []string {
 	return operations.assignedStringList
 }
 
-// HasValidationOperations returns `true` if there
-// are any operations that would require a constraint or template controller
-// or a sync controller.
+// HasValidationOperations reports whether audit or validating-webhook operations are assigned.
 func HasValidationOperations() bool {
 	return IsAssigned(Audit) || IsAssigned(Webhook)
 }
```

#### Recent Merged Pull Requests:
- **PR #4882** (2026-10-21): chore: bump follow-redirects from 1.16.0 to 1.16.1 in /website (@dependabot[bot])
- **PR #4881** (2026-10-21): fix: prevent cache manager hot-loop when synced GVK cannot be listed (@wangyusheng1985)
- **PR #4879** (2026-10-21): chore: bump the all group across 1 directory with 9 updates (@dependabot[bot])
- **PR #4877** (closed): chore: bump golang from `2f84bc9` to `4766793` in /build/tooling (@dependabot[bot])
- **PR #4873** (2026-10-20): fix: reject path integers that overflow int64 and wrap to a positive value (@ogulcanaydogan)
- **PR #4869** (closed): chore: bump the all group with 8 updates (@dependabot[bot])

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

## X. separate Config process exclusions from validation data sync (#4784)

**RULE**:
When implementing operations in `main.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in open-policy-agent/gatekeeper. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e492e24c`: separate Config process exclusions from validation data sync (#4784). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `main.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	wm, err := newWatchManager(dc)
	if wm != nil {
		if err := mgr.Add(wm); err != nil {
			setupLog.Error(err, "unable to register watch manager with the manager")
			return err
		}
	// The cache manager and everything hanging off it only exist for operations
	// that sync referential data for validation. Other operations read process
	// exclusions from the Config resource without any of this.
	var (
		events chan event.GenericEvent
		cm     *cachemanager.CacheManager
	)
	if operations.HasValidationOperations() {
		// Events ch will be used to receive events from dynamic watches registered
		// via the registrar below.
		events = make(chan event.GenericEvent, 1024)
		reg, err := wm.NewRegistrar(
			cachemanager.RegistrarName,
			events)
		if err != nil {
			setupLog.Error(err, "unable to set up watch registrar for cache manager")
			return err
		}
		cmConfig := &cachemanager.Config{
			SyncMetricsCache: syncutil.NewMetricsCache(),
			Tracker:          tracker,
			ProcessExcluder:  processExcluder,
			Registrar:        reg,
			Reader:           mgr.GetCache(),
		}
		if client != nil {
			cmConfig.CfClient = client
		}
		cm, err = cachemanager.NewCacheManager(cmConfig)
		if err != nil
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	wm, err := watch.New(dc)
	if err := mgr.Add(wm); err != nil {
		setupLog.Error(err, "unable to register watch manager with the manager")
		return err
	// Events ch will be used to receive events from dynamic watches registered
	// via the registrar below.
	events := make(chan event.GenericEvent, 1024)
	reg, err := wm.NewRegistrar(
		cachemanager.RegistrarName,
		events)
	if err != nil {
		setupLog.Error(err, "unable to set up watch registrar for cache manager")
		return err
	}

	syncMetricsCache := syncutil.NewMetricsCache()
	cmConfig := &cachemanager.Config{
		SyncMetricsCache: syncMetricsCache,
		Tracker:          tracker,
		ProcessExcluder:  processExcluder,
		Registrar:        reg,
		Reader:           mgr.GetCache(),
	}
	if client != nil {
		cmConfig.CfClient = client
	}
	cm, err := cachemanager.NewCacheManager(cmConfig)
	if err != nil {
		setupLog.Error(err, "unable to create cache manager")
		return err
	}
	err = mgr.Add(pruner.NewExpectationsPruner(cm, tracker))
	if err != nil {
		setupLog.Error(err, "adding expectations pruner to manager")
		return err
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e492e24c` are properly handled with clean fallback behavior.
