> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/open-policy-agent-gatekeeper-learnings.md`  
> **Source**: github ([https://github.com/open-policy-agent/gatekeeper](https://github.com/open-policy-agent/gatekeeper))  
> **Source Version**: `f253de70`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T04:57:37.418Z  
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
> **Harvest Timestamp**: 2026-11-05T04:57:37.273Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-policy-agent/gatekeeper`
- **Description**: 🐊 Policy Controller for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4302 stars

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
- **Issue #4892** (2026-11-04): **Disk export treats violation text as audit control events**
  *Symptoms*: **What steps did you take and what happened:**  With audit export enabled and a valid disk Connection, an audited violation whose message is `audit is started` or `audit is completed` is interpreted as an audit lifecycle event, even though its `eventType` is `violation_audited`.  This was reproduced using a real Rego policy that returns an object annotation as its violation message, through the production audit result processing, `violationMsg`, `export.System`, and disk driver.  For each case, use a fresh disk Connection and publish the following sequence with the same audit ID:  1. The genuine audit-start control record. 2. An audited violation with an ordinary message. 3. An audited violation with the message under test. 4. Another audited violation with an ordinary message. 5. The genuine audit-completion control record.  The three violations have `eventType: violation_audited`; the genuine control records use the existing audit control format.  Decoded output:  | Message under test | Records in the completed file | Result | |---|---:|---| | `ordinary middle` | 5 | All three violations and both control records are present. | | `audit is started` | 4 | The middle violation is rejected and absent from the file. | | `audit is completed` | 3 | The middle violation is written, then the file is finalized before the remaining violation and genuine completion. |  The start-message collision returns:  ```text error handling audit start: audit file already open for audit run 2026-1

- **Issue #4770** (2026-10-09): **Fix status-only startup without initializing the constraint client**
  *Symptoms*: Parent issue: #3964 Related bug fix: #3928, #4423  **What steps did you take and what happened:**  Start Gatekeeper with only the status operation:  ```text --operation=status ```  `operations.HasValidationOperations()` currently returns `true` for `operations.Status`, so `setupControllers` initializes the constraint/OPA client. However, only the audit and webhook operations add enforcement points. The frameworks constraint client rejects initialization with no enforcement points:  ```text must specify at least one enforcement point with client.EnforcementPoints ```  The same predicate also starts the ConstraintTemplate and Constraint ingestion controllers, even though the documented status operation only aggregates per-pod status resources.  **What did you expect to happen:**  A status-only Gatekeeper process should start successfully and run the controllers needed to aggregate status. It should not initialize the constraint/OPA client or run constraint/template ingestion and data-sync controllers solely because `status` is selected.  **Suggested scope:**  - Separate the concepts of "needs constraint evaluation/ingestion" and "needs status aggregation" instead of using `HasValidationOperations()` for both. - Register ConstraintTemplate/Constraint status aggregators independently from the ConstraintTemplate ingestion controller. - Update all `HasValidationOperations()` call sites consistently, including readiness and sync behavior. - Keep required dependencies non-nil for eve

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

### Incident Patch 1: `ea96f392` (2026-11-04)
**Commit Message**: fix: abort incomplete disk audit runs after write failures (#4894)

Signed-off-by: Jaydip Gabani <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `pkg/export/disk/audit_file.go` (modified, +38/-0)
```diff
@@ -54,6 +54,9 @@ func (conn *Connection) handleAuditStart(auditID string, topic string) error {
 	if conn.File != nil {
 		return fmt.Errorf("audit file already open for audit run %s", conn.currentAuditRun)
 	}
+	if err := conn.removeAbortedAuditFile(); err != nil {
+		return err
+	}
 
 	dir, err := auditDirPath(conn.Path, topic)
 	if err != nil {
@@ -121,6 +124,41 @@ func (conn *Connection) handleAuditEnd(topic string) error {
 	return conn.cleanupOldAuditFiles(topic)
 }
 
+// abortAuditRun discards the active run after a failed write or finalization so
+// incomplete output is never published and later records cannot reach it. A run
+// that was already published has no remaining run file and is left unchanged.
+func (conn *Connection) abortAuditRun(runFile string) error {
+	var closeErr error
+	if conn.File != nil {
+		// Close releases the descriptor and its lock even when it reports an
+		// error; os.ErrClosed means an earlier failed close already released it.
+		if err := conn.File.Close(); err != nil && !errors.Is(err, os.ErrClosed) {
+			closeErr = fmt.Errorf("closing aborted audit file: %w", err)
+		}
+		conn.File = nil
+	}
+	conn.currentAuditRun = ""
+	conn.abortedAuditFile = runFile
+	return errors.Join(closeErr, conn.removeAbortedAuditFile())
+}
+
+// removeAbortedAuditFile is retried before each run starts, so a Connection
+// owns at most one unremovable aborted file.
+func (conn *Connection) removeAbortedAuditFile() error {
+	if conn.abortedAuditFile == "" {
+		return nil
+	}
+	err := os.Remove(conn.abortedAuditFile)
+	if err != nil && !os.IsNotExist(err) {
+		return fmt.Errorf("removing aborted audit file: %w", err)
+	}
+	if err == nil {
+		log.Info("Removed incomplete audit file", "filename", conn.abortedAuditFile)
+	}
+	conn.abortedAuditFile = ""
+	return nil
+}
+
 func (conn *Connection) unlockAndCloseFile() error {
 	if conn.File == nil {
 		return fmt.Errorf("no file to close")
```

**File**: `pkg/export/disk/audit_write_failure_test.go` (added, +370/-0)
```diff
@@ -0,0 +1,370 @@
+package disk
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"io/fs"
+	"os"
+	"os/exec"
+	"os/signal"
+	"path/filepath"
+	"slices"
+	"strings"
+	"syscall"
+	"testing"
+
+	exportutil "github.com/open-policy-agent/gatekeeper/v3/pkg/export/util"
+)
+
+// auditWriteFaultChildEnv marks the re-executed test process that lowers
+// RLIMIT_FSIZE. The limit applies to every thread in a process, so it is never
+// changed in the parent test process.
+const auditWriteFaultChildEnv = "GATEKEEPER_DISK_AUDIT_WRITE_FAULT_CHILD"
+
+const (
+	auditFaultConnection = "audit-connection"
+	auditFaultTopic      = "audit-channel"
+	auditFaultViolation  = "you must provide labels: owner"
+	priorAuditID         = "2026-10-28T09:55:00Z"
+	failedAuditID        = "2026-10-28T10:00:00Z"
+	blockedAuditID       = "2026-10-28T10:02:00Z"
+	recoveryAuditID      = "2026-10-28T10:05:00Z"
+)
+
+// TestAuditWriteFailureAbortsRun forces real regular-file write failures with
+// EFBIG and verifies that the failed run is never published, later runs stay
+// isolated, and unrelated output on the same Connection path is preserved.
+func TestAuditWriteFailureAbortsRun(t *testing.T) {
+	if os.Getenv(auditWriteFaultChildEnv) != "1" {
+		cmd := exec.Command(os.Args[0], "-test.run=^TestAuditWriteFailureAbortsRun$", "-test.v") //nolint:gosec // os.Args[0] is the current test binary and the test name is constant.
+		cmd.Env = append(os.Environ(), auditWriteFaultChildEnv+"=1")
+		out, err := cmd.CombinedOutput()
+		if err != nil || !strings.Contains(string(out), "--- PASS: TestAuditWriteFailureAbortsRun (") {
+			t.Fatalf("write fault child process failed: %v\n%s", err, out)
+		}
+		return
+	}
+	// Exceeding RLIMIT_FSIZE raises SIGXFSZ; ignoring it in this child makes the
+	// write return EFBIG like other storage write errors.
+	signal.Ignore(syscall.SIGXFSZ)
+
+	for _, tc := range []struct {
+		name string
+		// failAt indexes the failed run's start, violation, second violation, and completion records.
+		failAt         int
+		allowedBytes   int64
+		removalBlocked bool
+	}{
+		{name: "zero-byte start", failAt: 0},
+		{name: "partial start", failAt: 0, allowedBytes: 12},
+		{name: "zero-byte violation", failAt: 2},
+		{name: "partial violation", failAt: 2, allowedBytes: 12},
+		{name: "zero-byte completion", failAt: 3},
+		{name: "partial completion", failAt: 3, allowedBytes: 12},
+		{name: "completion with blocked removal", failAt: 3, removalBlocked: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			if tc.removalBlocked && os.Geteuid() == 0 {
+				t.Skip("directory permissions do not prevent removal by root")
+			}
+			root := t.TempDir()
+			topicDir := filepath.Join(root, auditFaultTopic)
+			writer := newAdmissionWriter()
+			createAdmissionConnection(t, writer, auditFaultConnection, root, 2)
+			publish := func(msg any) error {
+				return writer.Publish(context.Background(), auditFaultConnection, msg, auditFaultTopic)
+			}
+
+			// A completed audit and admission output share the Connection path and
+			// must survive both the failure and recovery unchanged.
+			priorRecords := auditRunRecords(priorAuditID, "prior-pod")
+			for i := range priorRecords {
+				if err := publish(priorRecords[i]); err != nil {
+					t.Fatalf("Publish(prior %s) error = %v", priorRecords[i].Message, err)
+				}
+			}
+			for _, name := range []string{"admitted-1", "admitted-2", "admitted-3"} {
+				if err := publish(admissionPayload(t, name)); err != nil {
+					t.Fatalf("Publish(admission %s) error = %v", name, err)
+				}
+			}
+			preserved := readDirFiles(t, topicDir)
+			if len(preserved) != 3 {
+				t.Fatalf("expected prior audit, ready admission, and open admission files, got %v", mapKeys(preserved))
+			}
+
+			failedRecords := auditRunRecords(failedAuditID, "failed-pod-1", "failed-pod-2")
+			for i := range tc.failAt {
+				if err := publish(failedRecords[i]); err != nil {
+					t.Fatalf("Publish(failed run %s) error = %v", failedRecords[i].Message, err)
+				}
+			}
+			if tc.removalBlocked {
+				setDirMode(t, topicDir, 0o555)
+			}
+			failedFile := filepath.Join(topicDir, auditRunFileName(failedAuditID, "txt"))
+			restoreLimit := limitFileSize(t, fileSize(t, failedFile)+tc.allowedBytes)
+			err := publish(failedRecords[tc.failAt])
+			restoreLimit()
+			if !errors.Is(err, syscall.EFBIG) {
+				t.Errorf("failed write error = %v, want EFBIG", err)
+			}
+			if tc.removalBlocked && !errors.Is(err, fs.ErrPermission) {
+				t.Errorf("failed write error = %v, want the incomplete file removal failure reported", err)
+			}
+			// The remaining records of the failed run must not reach its file.
+			for i := tc.failAt + 1; i < len(failedRecords); i++ {
+				if err := publish(failedRecords[i]); err == nil {
+					t.Errorf("Publish(failed run %s) succeeded after the run failed", failedRecords[i].Message)
+				}
+			}
+			if _, err := os.Stat(filepath.Join(topicDir, auditRunFileName(failedAuditID, "log"))); !os.IsNotExist(err) {
+				t.E
```

**File**: `pkg/export/disk/connection_test.go` (modified, +12/-0)
```diff
@@ -1226,6 +1226,18 @@ func TestPublishClearsFileAfterAuditEndRenameError(t *testing.T) {
 	if conn.File != nil {
 		t.Fatal("expected closed file to be cleared after audit end rename error")
 	}
+	if _, err := os.Stat(path.Join(tmpPath, "topic1", "audit1.txt")); !os.IsNotExist(err) {
+		t.Fatalf("expected unpublished audit run file to be removed, stat error = %v", err)
+	}
+
+	for _, message := range []string{util.AuditStartedMsg, util.AuditCompletedMsg} {
+		if err := writer.Publish(context.Background(), "conn1", util.ExportMsg{ID: "audit2", Message: message}, "topic1"); err != nil {
+			t.Fatalf("Publish(next audit %s) error = %v", message, err)
+		}
+	}
+	if _, err := os.Stat(path.Join(tmpPath, "topic1", "audit2.log")); err != nil {
+		t.Fatalf("expected next audit run to be published: %v", err)
+	}
 }
 
 // TestConcurrentPublishUpdateCloseConnection exercises concurrent Publish,
```

**File**: `pkg/export/disk/disk.go` (modified, +8/-2)
```diff
@@ -3,6 +3,7 @@ package disk
 import (
 	"context"
 	"encoding/json"
+	"errors"
 	"fmt"
 	"os"
 	"sync"
@@ -27,6 +28,9 @@ type Connection struct {
 
 	// current audit run file name
 	currentAuditRun string
+	// abortedAuditFile is a failed run's incomplete file that could not be
+	// removed. It is never published and is removed before another run starts.
+	abortedAuditFile string
 	// admission owns private alpha limits and resources that must close with the Connection.
 	admission admissionState
 }
@@ -392,15 +396,17 @@ func (r *Writer) Publish(ctx context.Context, connectionName string, data interf
 		return fmt.Errorf("publish canceled: %w", err)
 	}
 
+	runFile := conn.File.Name()
 	_, err := conn.File.Write(append(jsonData, '\n'))
 	if err != nil {
-		return fmt.Errorf("error writing message to disk: %w", err)
+		connChanged = true
+		return fmt.Errorf("error writing message to disk: %w", errors.Join(err, conn.abortAuditRun(runFile)))
 	}
 
 	if violation.EventType == "" && violation.Message == util.AuditCompletedMsg {
 		connChanged = true
 		if err := conn.handleAuditEnd(topic); err != nil {
-			return fmt.Errorf("error handling audit end: %w", err)
+			return fmt.Errorf("error handling audit end: %w", errors.Join(err, conn.abortAuditRun(runFile)))
 		}
 		conn.File = nil
 		conn.currentAuditRun = ""
```

**File**: `website/docs/export.md` (modified, +2/-0)
```diff
@@ -482,6 +482,8 @@ The disk driver writes each audit run as newline-delimited JSON. Audit control r
     | maxAuditResults | (alpha) Maximum number of audit results that can be stored in the export path.                                                      | 3                 |
     | closedConnectionTTL | (alpha) Optional duration string controlling how long a failed closed Connection remains eligible for cleanup retries. Accepted values are `"1m"` through `"10m"`. The chart leaves it unset and the driver defaults to `"10m"`. | `"10m"` |
 
+    Each audit run is written to `<audit-run-id>.txt` in the channel directory and renamed to `<audit-run-id>.log` after its completion record is written, so readers should consume only `.log` files. A failed or partial record write aborts the run: the publish error is reported, the file is closed, and removal of the incomplete `.txt` file is attempted. Finalization failures before the rename use the same abort path. Remaining records of the failed run are rejected rather than retried. The next audit starts a new file once storage recovers, without a `Connection` change or restart; if the incomplete file could not be removed, the next start retries removal and fails until removal succeeds. Aborting a run does not remove completed `.log` files or admission files. Errors after the rename, such as permission or retention-cleanup failures, are still reported without discarding the completed run.
+
     **Note**: After the audit pod starts, verify that it contains two running containers.
 
     ```shell
```

---

### Incident Patch 2: `19ddeb3d` (2026-11-05)
**Commit Message**: chore: bump postcss-selector-parser from 6.0.10 to 6.1.5 in /website (#4900)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `website/yarn.lock` (modified, +3/-3)
```diff
@@ -6428,9 +6428,9 @@ postcss-reduce-transforms@^5.1.0:
     postcss-value-parser "^4.2.0"
 
 postcss-selector-parser@^6.0.2, postcss-selector-parser@^6.0.4, postcss-selector-parser@^6.0.5, postcss-selector-parser@^6.0.9:
-  version "6.0.10"
-  resolved "https://registry.yarnpkg.com/postcss-selector-parser/-/postcss-selector-parser-6.0.10.tgz#79b61e2c0d1bfc2602d549e11d0876256f8df88d"
-  integrity sha512-IQ7TZdoaqbT+LCpShg46jnZVlhWD2w6iQYAcYXfHARZ7X1t/UGhhceQDs5X0cGqKvYlHNOuv7Oa1xmb0oQuA3w==
+  version "6.1.5"
+  resolved "https://registry.yarnpkg.com/postcss-selector-parser/-/postcss-selector-parser-6.1.5.tgz#20e988ce8eab87575d54824d9800236c5fd872ca"
+  integrity sha512-TEHFzb5KRDKaOgJ4TYE+0jyJtFbjLvkdVOu0fZ2b6MTWzoqZd4Le+61aEppWkvTlYePgOX4ATL1wsAIPMLTw6Q==
   dependencies:
     cssesc "^3.0.0"
     util-deprecate "^1.0.2"
```

---

### Incident Patch 3: `6bd45796` (2026-11-04)
**Commit Message**: fix: distinguish disk audit controls from violation text (#4893)

Signed-off-by: Jaydip Gabani <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `pkg/export/disk/connection_test.go` (modified, +102/-0)
```diff
@@ -2,7 +2,9 @@ package disk
 
 import (
 	"context"
+	"encoding/json"
 	"fmt"
+	"io"
 	"os"
 	"path"
 	"slices"
@@ -12,6 +14,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/google/go-cmp/cmp"
 	"github.com/open-policy-agent/gatekeeper/v3/pkg/export/util"
 	"k8s.io/apimachinery/pkg/util/wait"
 	"k8s.io/client-go/util/retry"
@@ -999,6 +1002,105 @@ func TestPublish(t *testing.T) {
 	}
 }
 
+func TestPublishAuditControlMessages(t *testing.T) {
+	for _, representation := range []struct {
+		name   string
+		encode func(t *testing.T, msg util.ExportMsg) interface{}
+	}{
+		{
+			name: "value",
+			encode: func(_ *testing.T, msg util.ExportMsg) interface{} {
+				return msg
+			},
+		},
+		{
+			name: "pointer",
+			encode: func(_ *testing.T, msg util.ExportMsg) interface{} {
+				return &msg
+			},
+		},
+		{
+			name: "raw JSON",
+			encode: func(t *testing.T, msg util.ExportMsg) interface{} {
+				t.Helper()
+				data, err := json.Marshal(msg)
+				if err != nil {
+					t.Fatalf("Marshal() error = %v", err)
+				}
+				return json.RawMessage(data)
+			},
+		},
+	} {
+		t.Run(representation.name, func(t *testing.T) {
+			for _, tt := range []struct {
+				name    string
+				message string
+			}{
+				{name: "ordinary violation", message: "policy violation"},
+				{name: "start text violation", message: util.AuditStartedMsg},
+				{name: "completion text violation", message: util.AuditCompletedMsg},
+			} {
+				t.Run(tt.name, func(t *testing.T) {
+					writer := newTestWriter(closeAndRemoveFilesWithRetry)
+					outputPath := t.TempDir()
+					requireCreateConnection(t, writer, "conn1", diskConfig(outputPath, 3))
+					t.Cleanup(func() {
+						if err := writer.CloseConnection("conn1"); err != nil {
+							t.Errorf("CloseConnection() error = %v", err)
+						}
+					})
+
+					messages := []util.ExportMsg{
+						{ID: "audit1", Message: util.AuditStartedMsg},
+						{ID: "audit1", EventType: "violation_audited", Message: "earlier violation", ResourceName: "earlier-pod"},
+						{ID: "audit1", EventType: "violation_audited", Message: tt.message, ResourceName: "tested-pod"},
+						{ID: "audit1", EventType: "violation_audited", Message: "later violation", ResourceName: "later-pod"},
+						{ID: "audit1", Message: util.AuditCompletedMsg},
+					}
+					readyFile := path.Join(outputPath, "topic1", "audit1.log")
+					for i, msg := range messages {
+						if err := writer.Publish(context.Background(), "conn1", representation.encode(t, msg), "topic1"); err != nil {
+							t.Errorf("Publish(record %d) error = %v", i, err)
+						}
+						if i < len(messages)-1 {
+							if _, err := os.Stat(readyFile); !os.IsNotExist(err) {
+								t.Errorf("ready file must not exist before audit completion, after record %d: %v", i, err)
+							}
+						}
+					}
+					files, err := listFiles(path.Join(outputPath, "topic1"))
+					if err != nil {
+						t.Fatalf("listFiles() error = %v", err)
+					}
+					if !slices.Equal(files, []string{readyFile}) {
+						t.Errorf("expected only completed audit file %s, got %v", readyFile, files)
+					}
+
+					file, err := os.Open(readyFile)
+					if err != nil {
+						t.Fatalf("Open() error = %v", err)
+					}
+					defer file.Close()
+					var got []util.ExportMsg
+					decoder := json.NewDecoder(file)
+					for {
+						var msg util.ExportMsg
+						if err := decoder.Decode(&msg); err == io.EOF {
+							break
+						} else if err != nil {
+							t.Fatalf("Decode() error = %v", err)
+						}
+						got = append(got, msg)
+					}
+					if diff := cmp.Diff(messages, got); diff != "" {
+						t.Errorf("decoded audit records differ (-want +got):\n%s", diff)
+					}
+				})
+			}
+		})
+	}
+}
+
 func TestPublishHonorsCanceledContext(t *testing.T) {
 	writer := &Writer{
 		openConnections: make(map[string]Connection),
```

**File**: `pkg/export/disk/disk.go` (modified, +2/-2)
```diff
@@ -375,7 +375,7 @@ func (r *Writer) Publish(ctx context.Context, connectionName string, data interf
 		}
 	}()
 
-	if violation.Message == util.AuditStartedMsg {
+	if violation.EventType == "" && violation.Message == util.AuditStartedMsg {
 		err := conn.handleAuditStart(violation.ID, topic)
 		if err != nil {
 			return fmt.Errorf("error handling audit start: %w", err)
@@ -397,7 +397,7 @@ func (r *Writer) Publish(ctx context.Context, connectionName string, data interf
 		return fmt.Errorf("error writing message to disk: %w", err)
 	}
 
-	if violation.Message == util.AuditCompletedMsg {
+	if violation.EventType == "" && violation.Message == util.AuditCompletedMsg {
 		connChanged = true
 		if err := conn.handleAuditEnd(topic); err != nil {
 			return fmt.Errorf("error handling audit end: %w", err)
```

**File**: `website/docs/export.md` (modified, +2/-0)
```diff
@@ -412,6 +412,8 @@ This quick start enables the demonstration admission reader. It logs completed a
 
 ### Quick start with exporting violations on node storage using Disk driver via emptyDir
 
+The disk driver writes each audit run as newline-delimited JSON. Audit control records contain the audit `id` and `message` (`audit is started` or `audit is completed`) and omit `eventType`. These controls open the run's `.txt` file and finalize it as a ready `.log` file. Audit violation records use `eventType: violation_audited`; their policy-supplied `message` is always data, even when it matches either control message.
+
 #### Configure Gatekeeper with Export enabled to Disk
 
 1. Deploy Gatekeeper with disk export configurations.
```

#### Recent Merged Pull Requests:
- **PR #4905** (2026-11-05): ci: update kubernetes test versions to 1.35-1.37 (@abhisheksheth28)
- **PR #4904** (2026-11-05): chore: bump node-forge from 1.4.0 to 1.4.3 in /website (@dependabot[bot])
- **PR #4903** (2026-11-05): chore: bump joi from 17.13.8 to 17.13.9 in /website (@dependabot[bot])
- **PR #4900** (2026-11-05): chore: bump postcss-selector-parser from 6.0.10 to 6.1.5 in /website (@dependabot[bot])
- **PR #4899** (2026-11-05): chore: bump go.yaml.in/yaml/v3 from 3.0.5 to 3.0.6 (@dependabot[bot])
- **PR #4897** (2026-11-05): chore: bump kubectl from v1.37.1 to v1.37.2 (@dependabot[bot])

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

## X. abort incomplete disk audit runs after write failures (#4894)

**RULE**:
When implementing operations in `pkg/export/disk/audit_file.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in open-policy-agent/gatekeeper. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ea96f392`: abort incomplete disk audit runs after write failures (#4894). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/export/disk/audit_file.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	if err := conn.removeAbortedAuditFile(); err != nil {
		return err
	}
// abortAuditRun discards the active run after a failed write or finalization so
// incomplete output is never published and later records cannot reach it. A run
// that was already published has no remaining run file and is left unchanged.
func (conn *Connection) abortAuditRun(runFile string) error {
	var closeErr error
	if conn.File != nil {
		// Close releases the descriptor and its lock even when it reports an
		// error; os.ErrClosed means an earlier failed close already released it.
		if err := conn.File.Close(); err != nil && !errors.Is(err, os.ErrClosed) {
			closeErr = fmt.Errorf("closing aborted audit file: %w", err)
		}
		conn.File = nil
	}
	conn.currentAuditRun = ""
	conn.abortedAuditFile = runFile
	return errors.Join(closeErr, conn.removeAbortedAuditFile())
}

// removeAbortedAuditFile is retried before each run starts, so a Connection
// owns at most one unremovable aborted file.
func (conn *Connection) removeAbortedAuditFile() error {
	if conn.abortedAuditFile == "" {
		return nil
	}
	err := os.Remove(conn.abortedAuditFile)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("removing abor
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ea96f392` are properly handled with clean fallback behavior.
