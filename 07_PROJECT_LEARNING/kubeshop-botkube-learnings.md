# Forensic Learning Record (Deep Inspection): kubeshop/botkube

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubeshop-botkube-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubeshop/botkube](https://github.com/kubeshop/botkube))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:17:27.610Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubeshop/botkube`
- **Description**: An app that helps you monitor your Kubernetes cluster, debug critical deployments & gives recommendations for standard practices
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2312 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/source/incoming_webhook.go`
```
package source

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"

	"github.com/kubeshop/botkube/pkg/config"
	"github.com/kubeshop/botkube/pkg/httpx"
	"github.com/kubeshop/botkube/pkg/multierror"
)

const (
	sourceNameVarName         = "sourceName"
	incomingWebhookPathPrefix = "sources/v1"
)

// IncomingWebhookData holds information about incoming webhook.
type IncomingWebhookData struct {
	inClusterBaseURL string
}

func (w IncomingWebhookData) FullURLForSource(sourceName string) string {
	return fmt.Sprintf("%s/%s/%s", w.inClusterBaseURL, incomingWebhookPathPrefix, sourceName)
}

// NewIncomingWebhookServer creates a new HTTP server for incoming webhooks.
func NewIncomingWebhookServer(log logrus.FieldLogger, cfg *config.Config, dispatcher *Dispatcher, startedSources map[string]StartedSources) *httpx.Server {
	addr := fmt.Sprintf(":%d", cfg.Plugins.IncomingWebhook.Port)
	router := incomingWebhookRouter(log, cfg, dispatcher, startedSources)

	log.Infof("Starting server on %q...", addr)
	return httpx.NewServer(log, addr, router)
}

func incomingWebhookRouter(log logrus.FieldLogger, cfg *config.Config, dispatcher *Dispatcher, startedSources map[string]StartedSources) *mux.Router {
	router := mux.NewRouter()
	pathPrefix := fmt.Sprintf("/%s/", incomingWebhookPathPrefix)
	router.PathPrefix(pathPrefix).Methods(http.MethodPost).Handler(
		http.StripPrefix(
			pathPrefix,
			http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				if request == nil || request.URL == nil || request.URL.Path == "" {
					writeJSONError(log, writer, "Source name in path is required", http.StatusBadRequest)
					return
				}

				sourceName := request.URL.Path
				logger := log.WithFields(logrus.Fields{
					"sourceName": sourceName,
				})
				logger.Debugf("Handling incoming webhook request...")

				sourcePlugins, ok := startedSources[sourceName]
				if !ok || len(sourcePlugins) == 0 {
					writeJSONError(log, writer, fmt.Sprintf("source %q not found", sourceName), http.StatusNotFound)
					return
				}

				payload, err := io.ReadAll(request.Body)
				if err != nil {
					writeJSONError(log, writer, fmt.Sprintf("while reading request body: %s", err.Error()), http.StatusInternalServerError)
					return
				}
				defer request.Body.Close()

				multiErr := multierror.New()
				for _, src := range sourcePlugins {
					logger.WithFields(logrus.Fields{
						"pluginName":               src.PluginName,
						"isInteractivitySupported": src.IsInteractivitySupported,
					}).Debug("Dispatching message...")

					err := dispatcher.DispatchExternalRequest(ExternalRequestDispatch{
						PluginDispatch: PluginDispatch{
							ctx:                      context.Background(),
							sourceName:               sourceName,
							sourceDisplayName:        src.SourceDisplayName,
							pluginName:               src.PluginName,
							pluginConfig:             src.PluginConfig,
							isInteractivitySupported: src.IsInteractivitySupported,
							cfg:                      cfg,
							pluginContext:            config.PluginContext{},
							incomingWebhook: IncomingWebhookData{
								inClusterBaseURL: cfg.Plugins.IncomingWebhook.InClusterBaseURL,
							},
						},
						payload: payload,
					})
					if err != nil {
						multiErr = multierror.Append(multiErr, err)
					}
				}

				if multiErr.ErrorOrNil() != nil {
					wrappedErr := fmt.Errorf("while dispatching external request: %w", multiErr)
					writeJSONError(log, writer, wrappedErr.Error(), http.StatusInternalServerError)
					return
				}

				writeJSONSuccess(log, writer)
			}),
		),
	)
	return router
}

func writeJSONError(log logrus.FieldLogger, w http.ResponseWriter, errMsg string, code int) {
	response := struct {
		Error string `json:"error"`
	}{
		Error: errMsg,
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(code)
	err := json.NewEncoder(w).Encode(&response)
	if err != nil {
		log.Errorf("while writing error response: %s", err.Error())
	}
}

func writeJSONSuccess(log logrus.FieldLogger, w http.ResponseWriter) {
	response := struct {
		Success bool `json:"success"`
	}{
		Success: true,
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	err := json.NewEncoder(w).Encode(&response)
	if err != nil {
		log.Errorf("while writing success response: %s", err.Error())
	}
}

```

### Core Architecture Module: `internal/source/kubernetes/filterengine/filterengine.go`
```
package filterengine

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"

	"github.com/kubeshop/botkube/internal/source/kubernetes/event"
	"github.com/kubeshop/botkube/pkg/maputil"
)

// DefaultFilterEngine is a default implementation of the Filter Engine.
type DefaultFilterEngine struct {
	log logrus.FieldLogger

	filters map[string]RegisteredFilter
}

// FilterEngine has methods to register and run filters.
type FilterEngine interface {
	Run(context.Context, event.Event) event.Event
	Register(...RegisteredFilter)
	RegisteredFilters() []RegisteredFilter
	SetFilter(string, bool) error
}

// RegisteredFilter contains details about registered filter.
type RegisteredFilter struct {
	Enabled bool
	Filter
}

// Filter defines an event filter.
type Filter interface {
	Run(context.Context, *event.Event) error
	Name() string
	Describe() string
}

// New creates new DefaultFilterEngine instance..
func New(log logrus.FieldLogger) *DefaultFilterEngine {
	return &DefaultFilterEngine{
		log:     log,
		filters: make(map[string]RegisteredFilter),
	}
}

// Run runs the registered filters always iterating over a slice of filters with sorted keys.
func (f *DefaultFilterEngine) Run(ctx context.Context, event event.Event) event.Event {
	f.log.Debug("Running registered filters")
	filters := f.RegisteredFilters()

	for _, filter := range filters {
		if !filter.Enabled {
			continue
		}

		err := filter.Run(ctx, &event)
		if err != nil {
			f.log.Errorf("while running filter %q: %s", filter.Name(), err.Error())
		}
		f.log.Debugf("ran filter name: %q, event was skipped: %t", filter.Name(), event.Skip)
	}
	return event
}

// Register filter(s) to engine.
func (f *DefaultFilterEngine) Register(filters ...RegisteredFilter) {
	for _, filter := range filters {
		f.log.Debugf("Registering filter %q (enabled: %t)...", filter.Name(), filter.Enabled)
		f.filters[filter.Name()] = filter
	}
}

// RegisteredFilters returns sorted slice of registered filters.
func (f *DefaultFilterEngine) RegisteredFilters() []RegisteredFilter {
	var registeredFilters []RegisteredFilter
	for _, key := range maputil.SortKeys(f.filters) {
		registeredFilters = append(registeredFilters, f.filters[key])
	}

	return registeredFilters
}

// SetFilter sets filter value in FilterMap to enable or disable filter.
func (f *DefaultFilterEngine) SetFilter(name string, flag bool) error {
	// Find filter struct name
	filter, ok := f.filters[name]
	if !ok {
		return fmt.Errorf("couldn't find filter with name %q", name)
	}

	filter.Enabled = flag
	f.filters[name] = filter
	return nil
}

```

### Core Architecture Module: `internal/source/kubernetes/filterengine/filters/node_event_checker.go`
```
package filters

import (
	"context"

	"github.com/sirupsen/logrus"

	"github.com/kubeshop/botkube/internal/source/kubernetes/config"
	"github.com/kubeshop/botkube/internal/source/kubernetes/event"
	"github.com/kubeshop/botkube/internal/source/kubernetes/k8sutil"
)

const (
	// NodeNotReady EventReason when Node is NotReady
	NodeNotReady string = "NodeNotReady"
	// NodeReady EventReason when Node is Ready
	NodeReady string = "NodeReady"
)

// NodeEventsChecker checks job status and adds message in the events structure
type NodeEventsChecker struct {
	log logrus.FieldLogger
}

// NewNodeEventsChecker creates a new NodeEventsChecker instance
func NewNodeEventsChecker(log logrus.FieldLogger) *NodeEventsChecker {
	return &NodeEventsChecker{log: log}
}

// Run filers and modifies event struct
func (f *NodeEventsChecker) Run(_ context.Context, event *event.Event) error {
	// Check for Event object
	if k8sutil.GetObjectTypeMetaData(event.Object).Kind == "Event" {
		return nil
	}

	// Run filter only on Node events
	if event.Kind != "Node" {
		return nil
	}

	// Update event details
	// Promote InfoEvent with critical reason as significant ErrorEvent
	switch event.Reason {
	case NodeNotReady:
		event.Type = config.ErrorEvent
		event.Level = config.Error
	case NodeReady:
		event.Type = config.InfoEvent
		event.Level = config.Info
	default:
		// skip events with least significant reasons
		event.Skip = true
	}

	f.log.Debug("Node Critical Event filter successful!")
	return nil
}

// Name returns the filter's name
func (f *NodeEventsChecker) Name() string {
	return "NodeEventsChecker"
}

// Describe describes the filter
func (f *NodeEventsChecker) Describe() string {
	return "Sends notifications on node level critical events."
}

```

### Core Architecture Module: `internal/source/kubernetes/filterengine/filters/object_annotation_checker.go`
```
package filters

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"
	"k8s.io/apimachinery/pkg/api/meta"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"

	"github.com/kubeshop/botkube/internal/source/kubernetes/event"
	"github.com/kubeshop/botkube/internal/source/kubernetes/k8sutil"
)

const (
	// DisableAnnotation is the object disable annotation.
	DisableAnnotation string = "botkube.io/disable"
)

// ObjectAnnotationChecker forwards events to specific channels based on a special annotation if it is set on a given K8s resource.
type ObjectAnnotationChecker struct {
	log        logrus.FieldLogger
	dynamicCli dynamic.Interface
	mapper     meta.RESTMapper
}

// NewObjectAnnotationChecker creates a new ObjectAnnotationChecker instance.
func NewObjectAnnotationChecker(log logrus.FieldLogger, dynamicCli dynamic.Interface, mapper meta.RESTMapper) *ObjectAnnotationChecker {
	return &ObjectAnnotationChecker{log: log, dynamicCli: dynamicCli, mapper: mapper}
}

// Run filters and modifies event struct.
func (f *ObjectAnnotationChecker) Run(ctx context.Context, event *event.Event) error {
	// get objects metadata
	obj, err := k8sutil.GetObjectMetaData(ctx, f.dynamicCli, f.mapper, event.Object)
	if err != nil {
		return fmt.Errorf("while getting object metadata: %w", err)
	}

	// Check annotations in object
	if f.isObjectNotifDisabled(obj) {
		event.Skip = true
		f.log.Debug("Object Notification Disable through annotations")
	}

	f.log.Debug("Object annotations filter successful!")
	return nil
}

// Name returns the filter's name.
func (f *ObjectAnnotationChecker) Name() string {
	return "ObjectAnnotationChecker"
}

// Describe describes the filter.
func (f *ObjectAnnotationChecker) Describe() string {
	return "Filters or reroutes events based on botkube.io/* Kubernetes resource annotations."
}

// isObjectNotifDisabled checks annotation botkube.io/disable.
// Annotation botkube.io/disable disables the event notifications from objects.
func (f *ObjectAnnotationChecker) isObjectNotifDisabled(obj metaV1.ObjectMeta) bool {
	if obj.Annotations[DisableAnnotation] == "true" {
		f.log.Debug("Skipping Disabled Event Notifications!")
		return true
	}
	return false
}

```

### Core Architecture Module: `internal/source/kubernetes/filterengine/with_all_filters.go`
```
package filterengine

import (
	"github.com/sirupsen/logrus"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/dynamic"

	"github.com/kubeshop/botkube/internal/source/kubernetes/config"
	"github.com/kubeshop/botkube/internal/source/kubernetes/filterengine/filters"
)

const (
	filterLogFieldKey    = "filter"
	componentLogFieldKey = "component"
)

// WithAllFilters returns new DefaultFilterEngine instance with all filters registered.
func WithAllFilters(logger logrus.FieldLogger, dynamicCli dynamic.Interface, mapper meta.RESTMapper, cfg *config.Filters) *DefaultFilterEngine {
	filterEngine := New(logger.WithField(componentLogFieldKey, "Filter Engine"))
	filterEngine.Register([]RegisteredFilter{
		{
			Filter:  filters.NewObjectAnnotationChecker(logger.WithField(filterLogFieldKey, "Object Annotation Checker"), dynamicCli, mapper),
			Enabled: cfg.ObjectAnnotationChecker,
		},
		{
			Filter:  filters.NewNodeEventsChecker(logger.WithField(filterLogFieldKey, "Node Events Checker")),
			Enabled: cfg.NodeEventsChecker,
		},
	}...)

	return filterEngine
}

```

### Core Architecture Module: `internal/source/kubernetes/k8sutil/diff.go`
```
package k8sutil

import (
	"fmt"
	"strings"

	"k8s.io/client-go/util/jsonpath"
	"k8s.io/kubectl/pkg/cmd/get"

	"github.com/kubeshop/botkube/internal/source/kubernetes/config"
	"github.com/kubeshop/botkube/pkg/multierror"
)

// Diff provides differences between two objects.
func Diff(x, y interface{}, updateSetting config.UpdateSetting) (string, error) {
	strBldr := new(strings.Builder)

	errs := multierror.New()
	for _, val := range updateSetting.Fields {
		var d diffReporter
		d.field = val
		diff, err := d.exec(x, y)
		if err != nil {
			errs = multierror.Append(errs, err)
			continue
		}

		strBldr.WriteString(diff)
	}

	if errs.ErrorOrNil() != nil {
		return strBldr.String(), fmt.Errorf("while getting diff: %w", errs.ErrorOrNil())
	}

	return strBldr.String(), nil
}

type diffReporter struct {
	field string
}

func (d diffReporter) exec(x, y interface{}) (string, error) {
	vx, err := parseJsonpath(x, d.field)
	if err != nil {
		return "", fmt.Errorf("while finding value in old obj from jsonpath %q: %w", d.field, err)
	}

	vy, err := parseJsonpath(y, d.field)
	if err != nil {
		return "", fmt.Errorf("while finding value in new obj from jsonpath %q: %w", d.field, err)
	}

	// treat <none> and false as same fields
	if vx == vy || (vx == "<none>" && vy == "false") {
		return "", nil
	}
	return fmt.Sprintf("%s:\n\t-: %+v\n\t+: %+v\n", d.field, vx, vy), nil
}

func parseJsonpath(obj interface{}, jsonpathStr string) (string, error) {
	// Parse and print jsonpath
	fields, err := get.RelaxedJSONPathExpression(jsonpathStr)
	if err != nil {
		return "", err
	}

	j := jsonpath.New("jsonpath")
	j.AllowMissingKeys(true)
	if err := j.Parse(fields); err != nil {
		return "", err
	}

	values, err := j.FindResults(obj)
	if err != nil {
		return "", err
	}

	var valueStrings []string
	if len(values) == 0 || len(values[0]) == 0 {
		valueStrings = append(valueStrings, "<none>")
	}
	for arrIx := range values {
		for valIx := range values[arrIx] {
			valueStrings = append(valueStrings, fmt.Sprintf("%v", values[arrIx][valIx].Interface()))
		}
	}
	return strings.Join(valueStrings, ","), nil
}

```

### Core Architecture Module: `internal/source/kubernetes/k8sutil/resource.go`
```
package k8sutil

import (
	"context"
	"fmt"

	coreV1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/kubeshop/botkube/pkg/k8sx"
)

// GetObjectMetaData returns metadata of the given object
func GetObjectMetaData(ctx context.Context, dynamicCli dynamic.Interface, mapper meta.RESTMapper, obj interface{}) (metaV1.ObjectMeta, error) {
	unstructuredObject, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return metaV1.ObjectMeta{}, fmt.Errorf("cannot convert type %T into *unstructured.Unstructured", obj)
	}
	unstructuredObject = unstructuredObject.DeepCopy()
	objectMeta := metaV1.ObjectMeta{
		Name:                       unstructuredObject.GetName(),
		GenerateName:               unstructuredObject.GetGenerateName(),
		Namespace:                  unstructuredObject.GetNamespace(),
		ResourceVersion:            unstructuredObject.GetResourceVersion(),
		Generation:                 unstructuredObject.GetGeneration(),
		CreationTimestamp:          unstructuredObject.GetCreationTimestamp(),
		DeletionTimestamp:          unstructuredObject.GetDeletionTimestamp(),
		DeletionGracePeriodSeconds: unstructuredObject.GetDeletionGracePeriodSeconds(),
		Labels:                     unstructuredObject.GetLabels(),
		Annotations:                unstructuredObject.GetAnnotations(),
		OwnerReferences:            unstructuredObject.GetOwnerReferences(),
		Finalizers:                 unstructuredObject.GetFinalizers(),
		ManagedFields:              unstructuredObject.GetManagedFields(),
	}
	if GetObjectTypeMetaData(obj).Kind == "Event" {
		var eventObj coreV1.Event
		err := k8sx.TransformIntoTypedObject(obj.(*unstructured.Unstructured), &eventObj)
		if err != nil {
			return metaV1.ObjectMeta{}, fmt.Errorf("while transforming object type: %T into type %T: %w", obj, eventObj, err)
		}

		eventAnnotations, err := extractAnnotationsFromEvent(ctx, dynamicCli, mapper, &eventObj)
		if err != nil {
			return metaV1.ObjectMeta{}, err
		}

		if objectMeta.Annotations == nil {
			objectMeta.Annotations = make(map[string]string)
		}

		for key, value := range eventAnnotations {
			objectMeta.Annotations[key] = value
		}
	}
	return objectMeta, nil
}

// GetObjectTypeMetaData returns typemetadata of the given object
func GetObjectTypeMetaData(obj interface{}) metaV1.TypeMeta {
	k, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return metaV1.TypeMeta{}
	}
	return metaV1.TypeMeta{
		APIVersion: k.GetAPIVersion(),
		Kind:       k.GetKind(),
	}
}

// GetResourceFromKind returns resource name for given Kind
func GetResourceFromKind(mapper meta.RESTMapper, gvk schema.GroupVersionKind) (schema.GroupVersionResource, error) {
	mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("Error while creating REST Mapping for Event Involved Object: %v", err)
	}
	return mapping.Resource, nil
}

// extractAnnotationsFromEvent returns annotations of a related resource for the given event.
func extractAnnotationsFromEvent(ctx context.Context, dynamicCli dynamic.Interface, mapper meta.RESTMapper, obj *coreV1.Event) (map[string]string, error) {
	gvr, err := GetResourceFromKind(mapper, obj.InvolvedObject.GroupVersionKind())
	if err != nil {
		return nil, err
	}
	annotations, err := dynamicCli.Resource(gvr).Namespace(obj.InvolvedObject.Namespace).Get(ctx, obj.InvolvedObject.Name, metaV1.GetOptions{})
	if err != nil {
		// IgnoreNotFound returns nil on NotFound errors.
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return annotations.GetAnnotations(), nil
}

```

### Core Architecture Module: `pkg/bot/discord_renderer.go`
```
package bot

import (
	"time"

	"github.com/bwmarrin/discordgo"

	"github.com/kubeshop/botkube/pkg/api"
	"github.com/kubeshop/botkube/pkg/bot/interactive"
	"github.com/kubeshop/botkube/pkg/formatx"
)

// DiscordRenderer provides functionality to render Discord specific messages from a generic models.
type DiscordRenderer struct {
	mdFormatter interactive.MDFormatter
}

// NewDiscordRenderer returns new DiscordRenderer instance.
func NewDiscordRenderer() *DiscordRenderer {
	return &DiscordRenderer{
		mdFormatter: interactive.DefaultMDFormatter(),
	}
}

// MessageToMarkdown renders message in Markdown format.
func (d *DiscordRenderer) MessageToMarkdown(in interactive.CoreMessage) string {
	return interactive.RenderMessage(d.mdFormatter, in)
}

// NonInteractiveSectionToCard returns MessageEmbed for the given event message.
// Note: It cannot be used for other messages as we take into account only first message section with limited primitives:
// - TextFields
// - BulletLists
// - Timestamp
// It should be removed once we will add support for a proper message renderer.
func (d *DiscordRenderer) NonInteractiveSectionToCard(msg interactive.CoreMessage) (discordgo.MessageEmbed, error) {
	if err := IsValidNonInteractiveSingleSection(msg); err != nil {
		return discordgo.MessageEmbed{}, err
	}

	event := msg.Sections[0]
	messageEmbed := discordgo.MessageEmbed{
		Title:     event.Base.Header,
		Timestamp: d.renderTimestamp(msg.Timestamp),
		Footer: &discordgo.MessageEmbedFooter{
			Text: "Botkube",
		},
	}

	messageEmbed.Fields = append(messageEmbed.Fields, d.renderTextFields(event.TextFields)...)
	messageEmbed.Fields = append(messageEmbed.Fields, d.renderBulletLists(event.BulletLists)...)

	return messageEmbed, nil
}

func (*DiscordRenderer) renderTimestamp(in time.Time) string {
	if in.IsZero() {
		return ""
	}
	return in.UTC().Format("2006-01-02T15:04:05Z")
}

func (d *DiscordRenderer) renderTextFields(fields api.TextFields) []*discordgo.MessageEmbedField {
	var out []*discordgo.MessageEmbedField
	for _, field := range fields {
		if field.IsEmpty() {
			continue
		}
		out = append(out, &discordgo.MessageEmbedField{
			Name:   field.Key,
			Value:  field.Value,
			Inline: true,
		})
	}
	return out
}

func (d *DiscordRenderer) renderBulletLists(lists api.BulletLists) []*discordgo.MessageEmbedField {
	var out []*discordgo.MessageEmbedField
	for _, item := range lists {
		out = append(out, &discordgo.MessageEmbedField{
			Name:   item.Title,
			Value:  formatx.BulletPointListFromMessages(item.Items),
			Inline: false,
		})
	}
	return out
}

```

### Core Architecture Module: `pkg/bot/mattermost_render.go`
```
package bot

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/kubeshop/botkube/pkg/api"
	"github.com/kubeshop/botkube/pkg/bot/interactive"
	"github.com/kubeshop/botkube/pkg/formatx"
)

// MattermostRenderer provides functionality to render Mattermost specific messages from a generic models.
type MattermostRenderer struct {
	mdFormatter interactive.MDFormatter
}

// NewMattermostRenderer returns new MattermostRenderer instance.
func NewMattermostRenderer() *MattermostRenderer {
	return &MattermostRenderer{
		mdFormatter: interactive.DefaultMDFormatter(),
	}
}

// MessageToMarkdown renders message in Markdown format.
func (d *MattermostRenderer) MessageToMarkdown(in interactive.CoreMessage) string {
	return interactive.RenderMessage(d.mdFormatter, in)
}

// NonInteractiveSectionToCard returns MessageEmbed for the given event message.
// Note: It cannot be used for other messages as we take into account only first message section with limited primitives:
// - TextFields
// - BulletLists
// - Timestamp
// It should be removed once we will add support for a proper message renderer.
func (d *MattermostRenderer) NonInteractiveSectionToCard(msg interactive.CoreMessage) ([]*model.SlackAttachment, error) {
	if err := IsValidNonInteractiveSingleSection(msg); err != nil {
		return nil, err
	}

	event := msg.Sections[0]
	messageAttachment := &model.SlackAttachment{
		Title:     event.Base.Header,
		Timestamp: d.renderTimestamp(msg.Timestamp),
		Footer:    "Botkube",
	}

	messageAttachment.Fields = append(messageAttachment.Fields, d.renderTextFields(event.TextFields)...)
	messageAttachment.Fields = append(messageAttachment.Fields, d.renderBulletLists(event.BulletLists)...)

	return []*model.SlackAttachment{
		messageAttachment,
	}, nil
}

func (*MattermostRenderer) renderTimestamp(in time.Time) json.Number {
	if in.IsZero() {
		return ""
	}
	return json.Number(strconv.FormatInt(in.Unix(), 10))
}

func (d *MattermostRenderer) renderTextFields(fields api.TextFields) []*model.SlackAttachmentField {
	var out []*model.SlackAttachmentField
	for _, field := range fields {
		if field.IsEmpty() {
			continue
		}
		out = append(out, &model.SlackAttachmentField{
			Title: field.Key,
			Value: field.Value,
			Short: true,
		})
	}
	return out
}

func (d *MattermostRenderer) renderBulletLists(lists api.BulletLists) []*model.SlackAttachmentField {
	var out []*model.SlackAttachmentField
	for _, item := range lists {
		out = append(out, &model.SlackAttachmentField{
			Title: item.Title,
			Value: formatx.BulletPointListFromMessages(item.Items),
			Short: false,
		})
	}
	return out
}

```

### Core Architecture Module: `pkg/bot/renderer.go`
```
package bot

import (
	"fmt"

	"github.com/kubeshop/botkube/pkg/api"
	"github.com/kubeshop/botkube/pkg/bot/interactive"
)

func IsValidNonInteractiveSingleSection(msg interactive.CoreMessage) error {
	if len(msg.Sections) != 1 {
		return fmt.Errorf("event message should contains only one section but got %d", len(msg.Sections))
	}
	if msg.Type != api.NonInteractiveSingleSection {
		return fmt.Errorf("this renderer is limited to single section message, cannot be used for type %s", msg.Type)
	}

	return nil
}

```

### Core Architecture Module: `pkg/bot/slack_renderer.go`
```
package bot

import (
	"fmt"
	"strings"
	"time"

	"github.com/slack-go/slack"

	"github.com/kubeshop/botkube/pkg/api"
	"github.com/kubeshop/botkube/pkg/bot/interactive"
	"github.com/kubeshop/botkube/pkg/formatx"
)

const (
	urlButtonActionIDPrefix = "url:"
	cmdButtonActionIDPrefix = "cmd:"
	maxActionIDLen          = 254
)

// SlackRenderer provides functionality to render Slack specific messages from a generic models.
type SlackRenderer struct {
	mdFormatter interactive.MDFormatter
}

// NewSlackRenderer returns new SlackRenderer instance.
func NewSlackRenderer() *SlackRenderer {
	return &SlackRenderer{
		mdFormatter: interactive.NewMDFormatter(interactive.NewlineFormatter, func(msg string) string {
			return fmt.Sprintf("*%s*", msg)
		}),
	}
}

// MessageToMarkdown renders message in Markdown format.
func (b *SlackRenderer) MessageToMarkdown(in interactive.CoreMessage) string {
	return interactive.RenderMessage(b.mdFormatter, in)
}

// RenderModal returns a modal request view based on a given message.
func (b *SlackRenderer) RenderModal(msg interactive.CoreMessage) slack.ModalViewRequest {
	title := msg.Header
	msg.Header = ""
	return slack.ModalViewRequest{
		Type:          "modal",
		Title:         b.plainTextBlock(title),
		Submit:        b.plainTextBlock("Apply"),
		Close:         b.plainTextBlock("Cancel"),
		NotifyOnClose: false,
		Blocks: slack.Blocks{
			BlockSet: b.RenderAsSlackBlocks(msg),
		},
	}
}

// RenderInteractiveMessage returns Slack message based on the input msg.
func (b *SlackRenderer) RenderInteractiveMessage(msg interactive.CoreMessage) slack.MsgOption {
	if msg.HasSections() || msg.HasInputs() {
		blocks := b.RenderAsSlackBlocks(msg)
		return slack.MsgOptionBlocks(blocks...)
	}
	return b.renderAsSimpleTextSection(msg)
}

// RenderAsSlackBlocks returns the Slack message blocks for a given input message.
func (b *SlackRenderer) RenderAsSlackBlocks(msg interactive.CoreMessage) []slack.Block {
	var blocks []slack.Block
	if msg.Header != "" {
		blocks = append(blocks, b.mdTextSection("*%s*", msg.Header))
	}

	if msg.Description != "" {
		blocks = append(blocks, b.mdTextSection(msg.Description))
	}

	if msg.BaseBody.Plaintext != "" {
		blocks = append(blocks, b.mdTextSection(msg.BaseBody.Plaintext))
	}

	if msg.BaseBody.CodeBlock != "" {
		blocks = append(blocks, b.mdTextSection(formatx.AdaptiveCodeBlock(msg.BaseBody.CodeBlock)))
	}

	for idx, s := range msg.Sections {
		if idx > 0 && s.Style.Divider != api.DividerStyleTopNone {
			blocks = append(blocks, slack.NewDividerBlock())
		}
		blocks = append(blocks, b.renderSection(s)...)
	}

	for _, i := range msg.PlaintextInputs {
		blocks = append(blocks, b.renderInput(i))
	}

	if !msg.Timestamp.IsZero() {
		fallbackTimestampText := msg.Timestamp.Format(time.RFC1123)
		timestampText := fmt.Sprintf("<!date^%d^{date_num} {time_secs}|%s>", msg.Timestamp.Unix(), fallbackTimestampText)
		blocks = append(blocks, b.renderContext([]api.ContextItem{{
			Text: timestampText,
		}})...)
	}

	return blocks
}

func (b *SlackRenderer) renderSelects(s api.Selects) *slack.ActionBlock {
	var elems []slack.BlockElement
	for _, s := range s.Items {
		placeholder := slack.NewTextBlockObject(slack.PlainTextType, s.Name, false, false)
		singleSelect := slack.NewOptionsSelectBlockElement(convertToSlackSelectType(s.Type), placeholder, s.Command)

		if singleSelect.Type == slack.OptTypeExternal {
			// override the default 3 characters. In this way, the call to our backend is triggered even if user only
			// opens a given dropdown and not when he types at least 3 characters.
			minLen := 0
			singleSelect.MinQueryLength = &minLen
		}

		for _, group := range s.OptionGroups {
			var slackOptions []*slack.OptionBlockObject
			for _, opt := range group.Options {
				slackOptions = append(slackOptions, slack.NewOptionBlockObject(opt.Value, b.plainTextBlock(opt.Name), nil))
			}
			singleSelect.OptionGroups = append(singleSelect.OptionGroups, slack.NewOptionGroupBlockElement(b.plainTextBlock(group.Name), slackOptions...))
		}

		if opt := s.InitialOption; opt != nil {
			singleSelect.InitialOption = slack.NewOptionBlockObject(opt.Value, b.plainTextBlock(opt.Name), nil)
		}

		elems = append(elems, singleSelect)
	}

	// We use actions as we have only select items that we want to display in a single line.
	// https://api.slack.com/reference/block-kit/blocks#actions
	return slack.NewActionBlock(
		s.ID,
		elems...,
	)
}

func (b *SlackRenderer) renderAsSimpleTextSection(msg interactive.CoreMessage) slack.MsgOption {
	var out strings.Builder
	if msg.Header != "" {
		out.WriteString(msg.Header + "\n")
	}
	if msg.Description != "" {
		out.WriteString(msg.Description + "\n")
	}

	if msg.BaseBody.Plaintext != "" {
		out.WriteString(msg.BaseBody.Plaintext)
	}

	if msg.BaseBody.CodeBlock != "" {
		// we don't use the AdaptiveCodeBlock as we want to have a code block even for single lines
		// to make it more readable in the wide view.
		out.WriteString(formatx.CodeBlock(msg.BaseBody.CodeBlock))
	}

	return slack.MsgOptionText(out.String(), false)
}

func (b *SlackRenderer) renderSection(in api.Section) []slack.Block {
	var out []slack.Block
	if in.Header != "" {
		out = append(out, b.mdTextSection("*%s*", in.Header))
	}

	if in.Description != "" {
		out = append(out, b.mdTextSection(in.Description))
	}

	if len(in.TextFields) > 0 {
		out = append(out, b.renderTextFields(in.TextFields))
	}

	if in.Body.Plaintext != "" {
		out = append(out, b.mdTextSection(in.Body.Plaintext))
	}

	if in.Body.CodeBlock != "" {
		out = append(out, b.mdTextSection(formatx.AdaptiveCodeBlock(in.Body.CodeBlock)))
	}

	for _, item := range in.PlaintextInputs {
		out = append(out, b.renderInput(item))
	}

	if in.BulletLists.AreItemsDefined() {
		out = append(out, b.renderBulletLists(in.BulletLists))
	}

	var selects *slack.ActionBlock
	if in.Selects.AreOptionsDefined() {
		selects = b.renderSelects(in.Selects)
	}
	btns, used := b.renderButtons(in.Buttons, selects)
	out = append(out, btns...)
	if !used && selects != nil {
		out = append(out, selects)
	}

	if in.MultiSelect.AreOptionsDefined() {
		sec := b.renderMultiselectWithDescription(in.MultiSelect)
		out = append(out, sec)
	}

	if len(in.Context) > 0 {
		out = append(out, b.renderContext(in.Context)...)
	}

	return out
}

func (b *SlackRenderer) renderTextFields(in api.TextFields) slack.Block {
	var textBlockObjs []*slack.TextBlockObject
	for _, item := range in {
		if item.IsEmpty() {
			// Skip empty sections
			continue
		}

		field := fmt.Sprintf("*%s:* %s", item.Key, item.Value)
		textBlockObjs = append(textBlockObjs, slack.NewTextBlockObject(slack.MarkdownType, field, false, false))
	}

	return slack.NewSectionBlock(
		nil,
		textBlockObjs,
		nil,
	)
}

func (b *SlackRenderer) renderContext(in []api.ContextItem) []slack.Block {
	var blocks []slack.Block

	for _, item := range in {
		if item.Text == "" {
			// Skip empty sections
			continue
		}

		blocks = append(blocks, slack.NewContextBlock(
			"",
			slack.NewTextBlockObject(slack.MarkdownType, item.Text, false, false),
		))
	}

	return blocks
}

// renderButtons renders button section.
//
//  1. With description, renders one per row. For example:
//     `@Botkube get pods` [Button "Get Pods"]
//     `@Botkube get deploys` [Button "Get Deployments"]
//
//  2. Without description: all in the same row. For example:
//     [Button "Get Pods"] [Button "Get Deployments"]
func (b *SlackRenderer) renderButtons(in api.Buttons, selects *slack.ActionBlock) ([]slack.Block, bool) {
	if len(in) == 0 {
		return nil, false
	}

	var out []slack.Block
	// We use section layout as we also want to add text description
	// https://api.slack.com/reference/block-kit/blocks#section
	out = append(out, b.renderButtonsWithDescription(in.GetButtonsWithDescription())...)

	btnsWithoutDesc := in.GetButtonsWithoutDescription()
	if len(btnsWithoutDesc) == 0 {
		return out, false
	}

	var btns []slack.BlockElement
	for _, btn := range btnsWithoutDesc {
		btns = append(btns, b.renderButton(btn))
	}

	var elements []slack.BlockElement
	blockID := ""
	if selects != nil {
		blockID = selects.BlockID

		if selects.Elements != nil {
			elements = selects.Elements.ElementSet
		}
	}
	elements = append(elements, btns...)

	out = append(out,
		// We use actions layout as we have only buttons that we want to display in a single line.
		// https://api.slack.com/reference/block-kit/blocks#actions
		slack.NewActionBlock(
			blockID,
			elements...,
		))

	return out, true
}

func (b *SlackRenderer) renderButtonsWithDescription(in api.Buttons) []slack.Block {
	var out []slack.Block
	for _, btn := range in {
		desc := btn.Description
		switch btn.DescriptionStyle {
		case api.ButtonDescriptionStyleBold:
			desc = fmt.Sprintf("*%s*", desc)
		case api.ButtonDescriptionStyleItalic:
			desc = fmt.Sprintf("_%s_", desc)
		case api.ButtonDescriptionStyleText:
			// no op, it should be just a simple string
		case api.ButtonDescriptionStyleCode:
			fallthrough
		default:
			// keep backward compatibility
			desc = formatx.AdaptiveCodeBlock(desc)
		}

		out = append(out, slack.NewSectionBlock(
			slack.NewTextBlockObject(slack.MarkdownType, desc, false, false),
			nil,
			slack.NewAccessory(b.renderButton(btn)),
		))
	}
	return out
}

func (b *SlackRenderer) renderInput(s api.LabelInput) slack.Block {
	var placeholder *slack.TextBlockObject
	if s.Placeholder != "" {
		placeholder = slack.NewTextBlockObject(slack.PlainTextType, s.Placeholder, false, false)
	}

	// label is required
	var label = slack.NewTextBlockObject(slack.PlainTextType, "Input", false, false)
	if s.Text != "" {
		label = slack.NewTextBlockObject(slack.PlainTextType, s.Text, false, false)
	}

	input := slack.NewPlainTextInputBlockElement(placeholder, s.Command)
	block := slack.NewInputBlock(s.Command, label, nil, input)

	if s.DispatchedAction != "" {
		input.DispatchActionConfig = &slack.DispatchActionConfig{
			TriggerActionsOn: []string{string(s.DispatchedAction)},
		}
		block.Dispat
```

### Core Architecture Module: `pkg/bot/teams_renderer.go`
```
package bot

import (
	"fmt"
	"strings"
	"time"

	cards "github.com/DanielTitkov/go-adaptive-cards"

	"github.com/kubeshop/botkube/pkg/api"
	"github.com/kubeshop/botkube/pkg/bot/interactive"
)

// TeamsRenderer provides functionality to render MS Teams specific messages from a generic models.
type TeamsRenderer struct {
	mdFormatter interactive.MDFormatter
}

// NewTeamsRenderer return a new TeamsRenderer instance.
func NewTeamsRenderer() *TeamsRenderer {
	return &TeamsRenderer{
		mdFormatter: interactive.NewMDFormatter(msNewLineFormatter, interactive.MdHeaderFormatter),
	}
}

// MessageToMarkdown renders message in Markdown format.
func (r *TeamsRenderer) MessageToMarkdown(in interactive.CoreMessage) string {
	return interactive.RenderMessage(r.mdFormatter, in)
}

// NonInteractiveSectionToCard returns AdaptiveCard for the given message.
// Note: It cannot be used for other messages as we take into account only first message section with limited primitives:
// - TextFields
// - BulletLists
// - Timestamp
// It should be removed once we will add support for a proper message renderer.
func (r *TeamsRenderer) NonInteractiveSectionToCard(msg interactive.CoreMessage) (*cards.Card, error) {
	if err := IsValidNonInteractiveSingleSection(msg); err != nil {
		return nil, err
	}

	event := msg.Sections[0]
	var nodes []cards.Node

	if event.Base.Header != "" {
		nodes = append(nodes, &cards.TextBlock{
			Size: "Large",
			Text: replaceEmojiTagsWithActualOne(event.Base.Header),
		})
	}

	nodes = r.appendIfNotNil(nodes, r.renderTextFields(event.TextFields))
	nodes = r.appendIfNotNil(nodes, r.renderBulletLists(event.BulletLists)...)
	nodes = r.appendIfNotNil(nodes, r.renderTimestamp(msg.Timestamp))

	card := cards.New(nodes, []cards.Node{}).
		WithSchema(cards.DefaultSchema).
		WithVersion(cards.Version12)

	if err := card.Prepare(); err != nil {
		return nil, fmt.Errorf("while preparing event card message: %w", err)
	}

	return card, nil
}

// the cards.Prepare() method panics on nil items, so we need to filter them out.
func (r *TeamsRenderer) appendIfNotNil(slice []cards.Node, elems ...cards.Node) []cards.Node {
	for _, elem := range elems {
		if elem == nil {
			continue
		}
		slice = append(slice, elem)
	}
	return slice
}

func (r *TeamsRenderer) renderTextFields(item api.TextFields) cards.Node {
	var facts []*cards.Fact
	for _, field := range item {
		if field.IsEmpty() {
			continue
		}
		facts = append(facts, &cards.Fact{
			Title: replaceEmojiTagsWithActualOne(field.Key),
			Value: replaceEmojiTagsWithActualOne(field.Value),
		})
	}
	if len(facts) == 0 {
		return nil
	}
	return &cards.FactSet{
		Facts: facts,
	}
}

func (r *TeamsRenderer) renderBulletLists(in api.BulletLists) []cards.Node {
	var out []cards.Node
	for _, list := range in {
		out = append(out, r.renderSingleBulletList(list)...)
	}
	return out
}

func (r *TeamsRenderer) renderSingleBulletList(item api.BulletList) []cards.Node {
	return []cards.Node{
		&cards.TextBlock{
			Text: fmt.Sprintf("**%s**", replaceEmojiTagsWithActualOne(item.Title)),
		},
		&cards.TextBlock{
			Text: r.bulletList(item.Items),
			Wrap: cards.TruePtr(),
		},
	}
}

// https://learn.microsoft.com/en-us/adaptive-cards/authoring-cards/text-features#datetime-function-rules
func (r *TeamsRenderer) renderTimestamp(in time.Time) cards.Node {
	if in.IsZero() {
		return nil
	}
	timestamp := in.UTC().Format("2006-01-02T15:04:05Z")
	return &cards.TextBlock{
		Text: fmt.Sprintf("_{{DATE(%s, SHORT)}} at {{TIME(%s)}}_", timestamp, timestamp),
	}
}

// https://learn.microsoft.com/en-us/adaptive-cards/authoring-cards/text-features#markdown-commonmark-subset
func (r *TeamsRenderer) bulletList(msgs []string) string {
	for idx, item := range msgs {
		// We need to change the new line encoding, otherwise it will be printed in a single line. Example use-case:
		//
		// spec.template.spec.containers[*].image:
		//  -: ghcr.io/kubeshop/botkube:v9.99.9-dev
		//  +: ghcr.io/kubeshop/botkube:v1.0.0
		msgs[idx] = strings.ReplaceAll(item, "\n", "\n\n\t\t")
	}
	return replaceEmojiTagsWithActualOne(fmt.Sprintf("- %s", strings.Join(msgs, "\r- ")))
}

func msNewLineFormatter(msg string) string {
	// e.g. `:rocket:` is not supported by MS Teams, so we need to replace it with actual emoji
	msg = replaceEmojiTagsWithActualOne(msg)
	return fmt.Sprintf("%s\n\n", msg)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1483** (2024-11-15): **Remove latest plugin upload to GCS**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - Remove latest plugin upload to GCS  GCS bucket is no longer available. 

- **Issue #1481** (2024-11-11): **Fix panic on missing root event type for k8s source**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - Fix panic on missing root event type for k8s source    ## Related issue(s)  Fix https://github.com/kubeshop/botkube/issues/1474 

- **Issue #1475** (2024-11-05): **Panic: Send on Closed Channel in Slack SocketMode Client**
  *Symptoms*:  # Bug Report: Panic - Send on Closed Channel in Slack SocketMode Client   ## Description  The Botkube application encounters a panic with the message `send on closed channel` when running the Slack SocketMode client. This issue appears to occur in the `receiveMessagesInto` method within `slack-go/slack` version `v0.12.2`. The issue happens intermittently during the message reception process, causing Botkube to restart unexpectedly. This behavior was observed on Botkube version `v1.8.0`, deployed via Helm.  ## Expected behavior  The Slack SocketMode client should handle messages without triggering a panic, even if channels are closed.  ## Actual behavior  Botkube panics with a `send on closed channel` error, disrupting the Slack integration and triggering an automatic restart. This seems to happen during the message reception phase, as indicated in the logs.  ## Steps to reproduce  1. Set up Botkube version `v1.8.0` with Slack integration using SocketMode, deployed via Helm. 2. Start Botkube and allow it to receive messages for an extended period. 3. Observe intermittent panics with the message `send on closed channel`, followed by a restart of the Botkube process.  ## Logs  ``` panic: send on closed channel  goroutine 112834 [running]: github.com/slack-go/slack/socketmode.(*Client).receiveMessagesInto(0xc00097ee10, {0x2dc2430, 0xc0000baaf0}, 0xc000b2c180?, 0xc000bb0120)     /home/runner/go/pkg/mod/github.com/slack-go/slack@v0.12.2/socketmode/sock
  **Post-Mortem & Fix Analysis**:
  > Hi @maks3201, please try to use the latest version (1.13) as I believe we fixed the issue in one of the newer releases 👍   If you can still encounter, then please reply in the issue. Cheers!

- **Issue #1474** (2024-11-11): **Segmentation Fault in botkube/kubernetes Plugin with autoscaling/v2 HPA Events Monitoring**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the issue: 1. Search open and closed issues for duplicates. 2. Read the contributing guidelines (CONTRIBUTING.md file on root of the repository). -->  ## Description  The botkube/kubernetes plugin encounters repeated memory access errors, specifically segmentation faults and nil pointer dereference issues, when configured with certain sources such as k8s-hpa-events. The issue consistently arises when attempting to monitor the autoscaling/v2 API group for horizontalpodautoscalers events related to HPA scaling. This results in the plugin crashing, and although the Plugin Health Monitor attempts to restart it several times, the plugin ultimately becomes deactivated.  I’m using BotKube v1.13.0, and the issue seems to occur during the plugin’s interaction with the Kubernetes API for these particular resources.  ## Expected behavior  With the k8s-hpa-events source enabled, BotKube should monitor horizontalpodautoscalers resources and successfully capture SuccessfulRescale events without crashing. These events should then be forwarded as notifications to Slack.  ## Actual behavior  When the k8s-hpa-events source is enabled, the following issues occur:  	1.	The kubernetes plugin crashes with a plugin process exited error. 	2.	The Plugin Health Monitor retries the plugin multiple times, but after several failures, it deactivates the plugin. 	3.	Repeated segmentation faults and memory access errors such as inv
  **Post-Mortem & Fix Analysis**:
  > Hi @washswat-west,  Thanks a lot for reporting this issue! I've already created a PR to address that bug.  **However, you can already apply a workaround with version v1.13.0, which you are currently using.** You just need to define the top-level event type: ```yaml sources:   'k8s-hpa-events':     displayName: "HPA Scaling Events"     botkube/kubernetes:       context: &default-plugin-context         rbac:           group:             type: Static             prefix: ""             static:               values: ["botkube-plugins-default"]       enabled: true       config:         namespaces:           include:             - ".*"         event:           types:   # <------ in v1.13.0 this is required and will cause a panic if not set             - create             - delete             - update             - error          resources:           - type: autoscaling/v2/horizontalpodautoscalers             event:               types:                 - crea

- **Issue #1462** (2024-06-19): **Add missing UI URL for prod tests**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - Add missing UI URL for prod tests

- **Issue #1448** (2024-05-24): **Update links in Helm chart values file**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - Update links in Helm chart values file  

- **Issue #1441** (2024-05-09): **fix: close temporary kubeconfig file**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the pull request: 1. Follow contributing guidelines, templates, the recommended Git workflow, and any related documentation. 2. Test your changes and attach their results to the pull request. 3. Update the relevant documentation. -->  ## Description  Changes proposed in this pull request:  - ...  ## Testing  <!-- Describe necessary steps to test the changes. You can refer to the existing documentation if some steps are already described. -->  ## Related issue(s)  <!-- If you refer to a particular issue, provide its number. To close the issue after the pull request merge, use `Resolves #123` or `Fixes #123`. Otherwise, use `See also #123` or just `#123`. --> 

- **Issue #1437** (2024-11-19): **Forced to Delete Plugins in Web GUI before updating Botkube Version**
  *Symptoms*: <!-- Thank you for your contribution. Before you submit the issue: 1. Search open and closed issues for duplicates. 2. Read the contributing guidelines (CONTRIBUTING.md file on root of the repository). -->  ## Description When I go to update versions (last time it was 1.6->1.8. This time it was 1.8->1.10) it forces me to delete all the plugins that I have installed in the web GUI before it lets me update.  Maybe it is just my setup (Docker>Minikube on a Mac M1 Air) but it has happened twice now. I recorded it happening here. The volume is low, but I have voice on the videos, I promise!  Failing to Upgrade Botkube Version Video: https://drive.google.com/file/d/1l1D7rDrpZbxRsTgOSYL5g90c-kykQ5bT/view?usp=drive_link  Botkube Upgrade working after deleting all plugins: https://drive.google.com/file/d/1jHafkUVPlExU-Taz3hCHaOuHx4CG4GU7/view?usp=sharing   <!-- Provide a clear and concise description of the problem. Describe where it appears, when it occurred, and what it affects. Provide all relevant technical details such as the Botkube version. -->  ## Expected behavior Running the update command will upgrade Botkube from 1.8 to 1.10 while keeping my plugins. <!-- Describe what you expect to happen. -->  ## Actual behavior Botkube fails before the update can finish unless I go into app.botkube.io and delete all plugins first and then run the command <!-- Describe what happens instead. -->  ## Steps to reproduce 1. Run Upgrade command with Kubernetes, Prom
  **Post-Mortem & Fix Analysis**:
  > Reposting original answer from https://kubeshop.slack.com/archives/C03MRCX7UE9/p1714978750726999?thread_ts=1714662799.959579&cid=C03MRCX7UE9:   > Thanks Evan for the report! > Based on the first recording it looks like Botkube restarted itself because of timeout on kubectl download. It might be related to internet connectivity, or [dl.k8s.io](http://dl.k8s.io/) had some issues 🤔 At later stage we should mirror all of the dependencies to fetch them from GCS. > So if CLI says "upgrade failed", the actual upgrade was executed successfully but Botkube restarted with an error. However, with such networking issue, probably a single restart or two should resolve this. >  > You could try to adjust the time when Kubernetes restarts Botkube pod with the livenessProbe configuration (https://github.com/kubeshop/botkube/blob/main/helm/botkube/values.yaml#L742C5-L749C24): >  >  e.g. > ``` > --set deployment.livenessProbe.initialDelaySeconds=30 > ``` >  > Next time if you'll have such 

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

### Incident Patch 1: `2b275b44` (2024-11-11)
**Commit Message**: Fix panic on missing root event type for k8s source (#1481)

**File**: `internal/source/kubernetes/router.go` (modified, +14/-10)
```diff
@@ -2,6 +2,7 @@ package kubernetes
 
 import (
 	"context"
+	"strings"
 
 	"github.com/sirupsen/logrus"
 	"k8s.io/apimachinery/pkg/api/meta"
@@ -156,7 +157,7 @@ func mergeResourceEvents(cfgs map[string]SourceConfig) mergedEvents {
 			if _, ok := out[resource.Type]; !ok {
 				out[resource.Type] = make(map[config.EventType]struct{})
 			}
-			for _, e := range flattenEventTypes(cfg.Event.Types, resource.Event.Types) {
+			for _, e := range flattenEventTypes(cfg.Event, resource.Event) {
 				out[resource.Type][e] = struct{}{}
 			}
 		}
@@ -178,7 +179,7 @@ func (r *Router) mergeEventRoutes(resource string, cfgs map[string]SourceConfig)
 		cfg := srcCfg.cfg
 		for idx := range cfg.Resources {
 			r := cfg.Resources[idx] // make sure that we work on a copy
-			for _, e := range flattenEventTypes(cfg.Event.Types, r.Event.Types) {
+			for _, e := range flattenEventTypes(cfg.Event, r.Event) {
 				if resource != r.Type {
 					continue
 				}
@@ -188,7 +189,7 @@ func (r *Router) mergeEventRoutes(resource string, cfgs map[string]SourceConfig)
 					Annotations:  resourceStringMap(cfg.Annotations, r.Annotations),
 					Labels:       resourceStringMap(cfg.Labels, r.Labels),
 					ResourceName: r.Name,
-					Event:        resourceEvent(*cfg.Event, r.Event),
+					Event:        resourceEvent(cfg.Event, r.Event),
 				}
 				if e == config.UpdateEvent {
 					route.UpdateSetting = &config.UpdateSetting{
@@ -248,7 +249,7 @@ func (r *Router) setEventRouteForRecommendationsIfShould(routeMap *map[config.Ev
 func eventRoutes(routeTable map[string][]entry, targetResource string, targetEvent config.EventType) []route {
 	var out []route
 	for _, routedEvent := range routeTable[targetResource] {
-		if routedEvent.Event == targetEvent {
+		if strings.EqualFold(string(routedEvent.Event), string(targetEvent)) {
 			out = append(out, routedEvent.Routes...)
 		}
 	}
@@ -287,10 +288,13 @@ func (r *Router) mappedInformer(event config.EventType) (registration, bool) {
 	return registration{}, false
 }
 
-func flattenEventTypes(globalEvents []config.EventType, resourceEvents config.KubernetesResourceEventTypes) []config.EventType {
-	checkEvents := globalEvents
-	if len(resourceEvents) > 0 {
-		checkEvents = resourceEvents
+func flattenEventTypes(globalEvents *config.KubernetesEvent, resourceEvents config.KubernetesEvent) []config.EventType {
+	var checkEvents []config.EventType
+	if globalEvents != nil {
+		checkEvents = globalEvents.Types
+	}
+	if len(resourceEvents.Types) > 0 {
+		checkEvents = resourceEvents.Types
 	}
 
 	var out []config.EventType
@@ -321,10 +325,10 @@ func resourceStringMap(sourceMap *map[string]string, resourceMap map[string]stri
 	return sourceMap
 }
 
-func resourceEvent(sourceEvent, resourceEvent config.KubernetesEvent) *config.KubernetesEvent {
+func resourceEvent(sourceEvent *config.KubernetesEvent, resourceEvent config.KubernetesEvent) *config.KubernetesEvent {
 	if resourceEvent.AreConstraintsDefined() {
 		return &resourceEvent
 	}
 
-	return &sourceEvent
+	return sourceEvent
 }
```

**File**: `internal/source/kubernetes/router_test.go` (modified, +34/-0)
```diff
@@ -74,6 +74,40 @@ func TestRouter_BuildTable_CreatesRoutesWithProperEventsList(t *testing.T) {
 	}
 }
 
+func TestRouter_BuildTable_WithoutRootTypes(t *testing.T) {
+	const resourceType = "autoscaling/v2/horizontalpodautoscalers"
+
+	givenCfg := map[string]SourceConfig{
+		"k8s-events": {
+			name: "k8s-events",
+			cfg: config.Config{
+				Resources: []config.Resource{
+					{
+						Type: resourceType,
+						Event: config.KubernetesEvent{
+							Reason: config.RegexConstraints{
+								Include: []string{
+									"SuccessfulRescale",
+								},
+							},
+							Types: config.KubernetesResourceEventTypes{
+								"Normal",
+							},
+						},
+					},
+				},
+				Namespaces: &config.RegexConstraints{
+					Include: []string{
+						".*",
+					},
+				},
+			},
+		},
+	}
+	router := NewRouter(nil, nil, loggerx.NewNoop()).BuildTable(givenCfg)
+	assert.Len(t, router.getSourceRoutes(resourceType, config.NormalEvent), 1)
+}
+
 func TestRouterListMergingNestedFields(t *testing.T) {
 	// given
 	router := NewRouter(nil, nil, loggerx.NewNoop())
```

---

### Incident Patch 2: `3f04c2aa` (2024-06-20)
**Commit Message**: Fix and enable instance details page UI tests (#1461)

**File**: `test/cloud-slack-dev-e2e/botkube_page_helpers_test.go` (modified, +15/-6)
```diff
@@ -174,6 +174,7 @@ func (p *BotkubeCloudPage) FinishWizard(t *testing.T) {
 	t.Log("Navigating to plugin selection")
 	p.page.Screenshot("before-first-next")
 
+	time.Sleep(3 * time.Second)
 	p.page.MustElementR("button", "/^Next$/i").
 		MustWaitEnabled().
 		// We need to wait, otherwise, we click the same 'Next' button twice before the query is executed, and we are not really
@@ -183,6 +184,7 @@ func (p *BotkubeCloudPage) FinishWizard(t *testing.T) {
 	p.page.Screenshot("after-first-next")
 
 	t.Log("Using pre-selected plugins. Navigating to wizard summary")
+	time.Sleep(3 * time.Second)
 	p.page.MustElementR("button", "/^Next$/i").
 		MustWaitEnabled().
 		// We need to wait, otherwise, we click the same 'Next' button twice before the query is executed, and we are not really
@@ -191,26 +193,31 @@ func (p *BotkubeCloudPage) FinishWizard(t *testing.T) {
 	p.page.Screenshot("after-second-next")
 
 	t.Log("Submitting changes")
+	time.Sleep(3 * time.Second)
 	p.page.MustElementR("button", "/^Deploy changes$/i").
 		MustWaitEnabled().
 		MustClick()
 	p.page.Screenshot("after-deploy-changes")
 
-	// wait till gql mutation passes, and navigates to install details, otherwise, we could navigate to instance details with state 'draft'
+	// wait till gql mutation passes, and navigates to instance details, otherwise, we could navigate to instance details with state 'draft'
 	p.page.MustWaitNavigation()
 	p.page.Screenshot("after-deploy-changes-navigation")
 }
 
 func (p *BotkubeCloudPage) UpdateKubectlNamespace(t *testing.T) {
 	t.Log("Updating 'kubectl' namespace property")
-	
+
 	p.openKubectlUpdateForm()
-	
+
 	p.page.MustElementR("input#root_defaultNamespace", "default").MustSelectAllText().MustInput("kube-system")
 	p.page.Screenshot("after-changing-namespace-property")
 	p.page.MustElementR("button", "/^Update$/i").MustClick()
 	p.page.Screenshot("after-clicking-plugin-update")
 
+	t.Log("Moving to top left corner of the page")
+	p.page.Mouse.MustMoveTo(0, 0)
+	p.page.Screenshot("after-moving-to-top-left")
+
 	t.Log("Submitting changes")
 	p.page.MustWaitStable()
 	p.page.MustElementR("button", "/Deploy changes/i").MustClick()
@@ -230,10 +237,12 @@ func (p *BotkubeCloudPage) openKubectlUpdateForm() {
 
 	p.page.MustWaitStable()
 	p.page.Screenshot("after-selecting-plugins-tab")
-	
-	p.page.MustElement(`button[id^="botkube/kubectl_"]`).MustClick()
+
+	p.page.MustElement(`button[id^="botkube/kubectl_"]`).
+		MustWaitEnabled(). // needed as we have an "Outdated version detected" glitch
+		MustClick()
 	p.page.Screenshot("after-opening-kubectl-cfg")
-	
+
 	p.page.MustElement(`div[data-node-key="ui-form"]`).MustClick()
 	p.page.Screenshot("after-selecting-kubectl-cfg-form")
 }
```

**File**: `test/cloud-slack-dev-e2e/cloud_slack_dev_e2e_test.go` (modified, +6/-9)
```diff
@@ -42,7 +42,7 @@ type E2ESlackConfig struct {
 	Slack        SlackConfig
 	BotkubeCloud BotkubeCloudConfig
 
-	PageTimeout    time.Duration `envconfig:"default=5m"`
+	PageTimeout    time.Duration `envconfig:"default=10m"`
 	ScreenshotsDir string        `envconfig:"optional"`
 	DebugMode      bool          `envconfig:"default=false"`
 
@@ -152,20 +152,17 @@ func TestCloudSlackE2E(t *testing.T) {
 		botkubeCloudPage.InstallAgentInCluster(t, cfg.BotkubeCliBinaryPath)
 		botkubeCloudPage.OpenSlackAppIntegrationPage(t)
 
-		slackPage.ConnectWorkspace(t, isHeadless, browser)
+		slackPage.ConnectWorkspace(t, browser)
 
 		botkubeCloudPage.ReAddSlackPlatformIfShould(t, isHeadless)
 		botkubeCloudPage.SetupSlackWorkspace(t, channel.Name())
 		botkubeCloudPage.FinishWizard(t)
 		botkubeCloudPage.VerifyDeploymentStatus(t, "Connected")
 
-		if !isHeadless { // it is flaky on CI, more investigation needed
-			botkubeCloudPage.UpdateKubectlNamespace(t)
-			botkubeCloudPage.VerifyDeploymentStatus(t, "Updating")
-			botkubeCloudPage.VerifyDeploymentStatus(t, "Connected")
-			botkubeCloudPage.VerifyUpdatedKubectlNamespace(t)
-		}
-
+		botkubeCloudPage.UpdateKubectlNamespace(t)
+		botkubeCloudPage.VerifyDeploymentStatus(t, "Updating")
+		botkubeCloudPage.VerifyDeploymentStatus(t, "Connected")
+		botkubeCloudPage.VerifyUpdatedKubectlNamespace(t)
 	})
 
 	t.Run("Run E2E tests with deployment", func(t *testing.T) {
```

**File**: `test/cloud-slack-dev-e2e/slack_page_helpers_test.go` (modified, +46/-25)
```diff
@@ -3,71 +3,92 @@
 package cloud_slack_dev_e2e
 
 import (
+	"context"
+	"errors"
+	"github.com/stretchr/testify/assert"
 	"testing"
 	"time"
 
 	"github.com/go-rod/rod"
 )
 
-const slackBaseURL = "slack.com"
+const (
+	slackBaseURL          = "slack.com"
+	waitTime              = 10 * time.Second
+	contextTimeout        = 30 * time.Second
+	shorterContextTimeout = 10 * time.Second
+)
 
 type SlackPage struct {
 	page *Page
-	cfg  SlackConfig
+	cfg  E2ESlackConfig
 }
 
 func NewSlackPage(t *testing.T, cfg E2ESlackConfig) *SlackPage {
 	return &SlackPage{
 		page: &Page{t: t, cfg: cfg},
-		cfg:  cfg.Slack,
+		cfg:  cfg,
 	}
 }
 
-func (p *SlackPage) ConnectWorkspace(t *testing.T, headless bool, browser *rod.Browser) {
+func (p *SlackPage) ConnectWorkspace(t *testing.T, browser *rod.Browser) {
 	p.page.Page = browser.MustPages().MustFindByURL(slackBaseURL)
+	p.page.MustWaitStable()
 
-	p.page.MustElement("input#domain").MustInput(p.cfg.WorkspaceName)
-
+	defer func(page *Page) {
+		err := page.Close()
+		if err != nil {
+			if errors.Is(err, context.Canceled) {
+				return
+			}
+			t.Fatalf("Failed to close page: %s", err.Error())
+		}
+	}(p.page)
+
+	p.page.MustElement("input#domain").MustInput(p.cfg.Slack.WorkspaceName)
 	p.page.MustElementR("button", "Continue").MustClick()
-	p.page.Screenshot()
-
-	// here we get reloaded, so we need to type it again (looks like bug on Slack side)
-	if !headless {
-		p.page.MustElement("input#domain").MustInput(p.cfg.WorkspaceName)
-		p.page.MustElementR("button", "Continue").MustClick()
-	}
+	p.page.Screenshot("after-continue")
 
 	p.page.MustWaitStable()
 	p.page.MustElementR("a", "sign in with a password instead").MustClick()
-	p.page.Screenshot()
-	p.page.MustElement("input#email").MustInput(p.cfg.Email)
-	p.page.MustElement("input#password").MustInput(p.cfg.Password)
+	p.page.Screenshot("after-sign-in-with-password")
+	p.page.MustElement("input#email").MustInput(p.cfg.Slack.Email)
+	p.page.MustElement("input#password").MustInput(p.cfg.Slack.Password)
 	p.page.Screenshot()
 
 	t.Log("Hide Slack cookie banner that collides with 'Sign in' button")
-	cookie, err := p.page.Timeout(5 * time.Second).Element("button#onetrust-accept-btn-handler")
+	pageWithTimeout := p.page.Timeout(shorterContextTimeout)
+	t.Cleanup(func() {
+		_ = pageWithTimeout.Close()
+	})
+
+	cookieElem, err := pageWithTimeout.Element("button#onetrust-accept-btn-handler")
 	if err != nil {
 		t.Logf("Failed to obtain cookie element: %s. Skipping...", err.Error())
 	} else {
-		cookie.MustClick()
+		cookieElem.MustClick()
 	}
 
 	p.page.MustElementR("button", "/^Sign in$/i").MustClick()
-	p.page.Screenshot()
+	p.page.Screenshot("after-sign-in")
 
+	time.Sleep(waitTime) // ensure the screenshots shows a page after "Sign in" click
+	p.page.Screenshot("after-sign-in-page")
 	p.page.MustElementR("button.c-button:not(.c-button--disabled)", "Allow").MustClick()
 
 	t.Log("Finalizing Slack workspace connection...")
-	if p.cfg.WorkspaceAlreadyConnected {
+	if p.cfg.Slack.WorkspaceAlreadyConnected {
 		t.Log("Expecting already connected message...")
 		p.page.MustElementR("div.ant-result-title", "Organization Already Connected!")
 	} else {
 		t.Log("Finalizing connection...")
-		p.page.Screenshot()
-		p.page.MustElement("button#slack-workspace-connect").MustClick().
-			MustWaitEnabled() // when it's re-enabled, then it means the query was finished 
-		p.page.Screenshot()
+		time.Sleep(waitTime)
+		p.page.Screenshot("before-workspace-connect")
+		p.page.MustElement("button#slack-workspace-connect").MustClick()
+		p.page.Screenshot("after-workspace-connect")
 	}
 
-	_ = p.page.Close() // the page should be closed automatically anyway
+	t.Log("Waiting for page auto-close...")
+	err = p.page.WaitIdle(waitTime) // wait for auto-close
+	assert.NoError(t, err)
 }
```

---

### Incident Patch 3: `690ea5da` (2024-06-19)
**Commit Message**: Add missing UI URL for prod tests (#1462)

**File**: `.github/actions/cloud-slack-e2e/action.yaml` (modified, +4/-1)
```diff
@@ -28,6 +28,9 @@ inputs:
   botkube_cloud_api_base_url:
     description: 'BotKube Cloud API Base URL'
     required: true
+  botkube_cloud_ui_base_url:
+    description: 'BotKube Cloud UI Base URL'
+    required: true
   botkube_cloud_email:
     description: 'BotKube Cloud Email'
     required: true
@@ -88,7 +91,7 @@ runs:
         SLACK_TESTER_BOT_NAME: ${{ inputs.slack_tester_bot_name }}
         SLACK_TESTER_MESSAGE_WAIT_TIMEOUT: 180s
         
-        
+        BOTKUBE_CLOUD_UI_BASE_URL: ${{ inputs.botkube_cloud_ui_base_url }}
         BOTKUBE_CLOUD_API_BASE_URL: ${{ inputs.botkube_cloud_api_base_url }}
         BOTKUBE_CLOUD_EMAIL: ${{ inputs.botkube_cloud_email }}
         BOTKUBE_CLOUD_PASSWORD: ${{ inputs.botkube_cloud_password }}
```

**File**: `.github/workflows/branch-build.yml` (modified, +3/-2)
```diff
@@ -33,7 +33,7 @@ jobs:
           echo "versions={\"image-version\":[\"v9.99.9-dev\",\"0.0.0-${IMAGE_VERSION}\"]}" >> $GITHUB_OUTPUT
   build:
     if: github.event_name != 'repository_dispatch' # skip if triggered by repository_dispatch
-    needs: [extract-metadata]
+    needs: [ extract-metadata ]
     strategy:
       matrix: ${{ fromJson(needs.extract-metadata.outputs.versions) }}
     runs-on: ubuntu-latest
@@ -299,7 +299,7 @@ jobs:
     steps:
       - name: Checkout
         uses: actions/checkout@v4
-      - name: Run e2e tests 
+      - name: Run e2e tests
         uses: ./.github/actions/cloud-slack-e2e
         with:
           access_token: ${{ secrets.E2E_TEST_GH_DEV_ACCOUNT_PAT }}
@@ -311,6 +311,7 @@ jobs:
           slack_tester_bot_token: ${{ secrets.E2E_DEV_SLACK_TESTER_BOT_TOKEN }}
           slack_tester_bot_name: "botkubedev"
 
+          botkube_cloud_ui_base_url: "https://app-dev.botkube.io"
           botkube_cloud_api_base_url: "https://api-dev.botkube.io"
           botkube_cloud_email: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_EMAIL }}
           botkube_cloud_password: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_PASSWORD }}
```

**File**: `.github/workflows/prod-e2e-test.yml` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ jobs:
           slack_tester_bot_name: "botkube3"
           
           botkube_cloud_api_base_url: "https://api.botkube.io"
+          botkube_cloud_ui_base_url: "https://app.botkube.io"
           botkube_cloud_email: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_EMAIL }}
           botkube_cloud_password: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_PASSWORD }}
           botkube_cloud_team_organization_id: ${{ secrets.E2E_PROD_BOTKUBE_CLOUD_TEAM_ORGANIZATION_ID }}
```

---

### Incident Patch 4: `6b4e1b00` (2024-06-19)
**Commit Message**: Add setting up an Instance via the UI instead of GraphQL (#1458)

**File**: `.github/actions/cloud-slack-e2e/action.yaml` (modified, +12/-14)
```diff
@@ -37,12 +37,6 @@ inputs:
   botkube_cloud_team_organization_id:
     description: 'BotKube Cloud Team Organization ID'
     required: true
-  botkube_cloud_free_organization_id:
-    description: 'BotKube Cloud Free Organization ID'
-    required: true
-  botkube_cloud_plugin_repo_url:
-    description: 'BotKube Cloud Plugin Repo URL'
-    required: true
 
   slack_alerts_webhook:
     description: 'Slack Alerts Webhook'
@@ -55,11 +49,6 @@ inputs:
 runs:
   using: "composite"
   steps:
-    - name: Install Helm
-      uses: azure/setup-helm@v3
-      with:
-        version: ${{ env.HELM_VERSION }}
-
     - name: Download k3d
       shell: bash
       run: "wget -q -O - https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | TAG=${K3D_VERSION} bash"
@@ -69,6 +58,17 @@ runs:
       shell: bash
       run: "k3d cluster create cloud-slack-e2e-cluster --wait --timeout=5m"
 
+    - name: Download Botkube CLI
+      shell: bash
+      run: |
+        curl -Lo botkube https://github.com/kubeshop/botkube/releases/download/v1.12.0/botkube-linux-amd64
+        chmod +x botkube
+
+    - name: Add Botkube CLI to env
+      shell: bash
+      run: |
+        echo BOTKUBE_CLI_BINARY_PATH="$PWD/botkube" >> $GITHUB_ENV
+
     - name: Setup Go modules
       id: modules
       uses: ./.github/actions/setup-go-mod-private
@@ -86,15 +86,13 @@ runs:
         SLACK_TESTER_TESTER_BOT_TOKEN: ${{ inputs.slack_tester_bot_token }}
         SLACK_BOT_DISPLAY_NAME: ${{ inputs.slack_bot_display_name }}
         SLACK_TESTER_BOT_NAME: ${{ inputs.slack_tester_bot_name }}
-        SLACK_TESTER_MESSAGE_WAIT_TIMEOUT: 90s
+        SLACK_TESTER_MESSAGE_WAIT_TIMEOUT: 180s
         
         
         BOTKUBE_CLOUD_API_BASE_URL: ${{ inputs.botkube_cloud_api_base_url }}
         BOTKUBE_CLOUD_EMAIL: ${{ inputs.botkube_cloud_email }}
         BOTKUBE_CLOUD_PASSWORD: ${{ inputs.botkube_cloud_password }}
         BOTKUBE_CLOUD_TEAM_ORGANIZATION_ID: ${{ inputs.botkube_cloud_team_organization_id }}
-        BOTKUBE_CLOUD_FREE_ORGANIZATION_ID: ${{ inputs.botkube_cloud_free_organization_id }}
-        BOTKUBE_CLOUD_PLUGIN_REPO_URL: ${{ inputs.botkube_cloud_plugin_repo_url }}
         SCREENSHOTS_DIR: ${{ runner.temp }}/screenshots
         DEBUG_MODE: "true"
       run: |
```

**File**: `.github/workflows/branch-build.yml` (modified, +0/-3)
```diff
@@ -290,7 +290,6 @@ jobs:
   cloud-slack-dev-e2e:
     name: Botkube Cloud Slack Dev E2E
     runs-on: ubuntu-latest
-    needs: [ build ]
     permissions:
       contents: read
       packages: read
@@ -316,8 +315,6 @@ jobs:
           botkube_cloud_email: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_EMAIL }}
           botkube_cloud_password: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_PASSWORD }}
           botkube_cloud_team_organization_id: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_TEAM_ORGANIZATION_ID }}
-          botkube_cloud_free_organization_id: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_FREE_ORGANIZATION_ID }}
-          botkube_cloud_plugin_repo_url: "https://storage.googleapis.com/botkube-plugins-latest/plugins-dev-index.yaml"
 
           slack_alerts_webhook: ${{ secrets.SLACK_CI_ALERTS_WEBHOOK }}
 
```

**File**: `.github/workflows/prod-e2e-test.yml` (modified, +0/-2)
```diff
@@ -42,8 +42,6 @@ jobs:
           botkube_cloud_email: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_EMAIL }}
           botkube_cloud_password: ${{ secrets.E2E_DEV_BOTKUBE_CLOUD_PASSWORD }}
           botkube_cloud_team_organization_id: ${{ secrets.E2E_PROD_BOTKUBE_CLOUD_TEAM_ORGANIZATION_ID }}
-          botkube_cloud_free_organization_id: ${{ secrets.E2E_PROD_BOTKUBE_CLOUD_FREE_ORGANIZATION_ID }}
-          botkube_cloud_plugin_repo_url: "https://storage.googleapis.com/botkube-plugins-latest/plugins-index.yaml"
 
           slack_alerts_webhook: ${{ secrets.SLACK_CI_ALERTS_WEBHOOK }}
 
```

**File**: `test/cloud-slack-dev-e2e/botkube_page_helpers_test.go` (added, +249/-0)
```diff
@@ -0,0 +1,249 @@
+//go:build cloud_slack_dev_e2e
+
+package cloud_slack_dev_e2e
+
+import (
+	"fmt"
+	"net/http"
+	"net/url"
+	"os/exec"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/go-rod/rod"
+	"github.com/go-rod/rod/lib/input"
+	"github.com/go-rod/rod/lib/proto"
+	"github.com/mattn/go-shellwords"
+	"github.com/stretchr/testify/require"
+
+	gqlModel "github.com/kubeshop/botkube-cloud/botkube-cloud-backend/pkg/graphql"
+)
+
+const (
+	authHeaderName            = "Authorization"
+	awaitInstanceStatusChange = 2 * time.Minute
+	orgQueryParam             = "organizationId"
+)
+
+type BotkubeCloudPage struct {
+	cfg  E2ESlackConfig
+	page *Page
+
+	AuthHeaderValue string
+	GQLEndpoint     string
+	ConnectedDeploy *gqlModel.Deployment
+}
+
+func NewBotkubeCloudPage(t *testing.T, cfg E2ESlackConfig) *BotkubeCloudPage {
+	return &BotkubeCloudPage{
+		page:        &Page{t: t, cfg: cfg},
+		cfg:         cfg,
+		GQLEndpoint: fmt.Sprintf("%s/%s", cfg.BotkubeCloud.APIBaseURL, cfg.BotkubeCloud.APIGraphQLEndpoint),
+	}
+}
+
+func (p *BotkubeCloudPage) NavigateAndLogin(t *testing.T, page *rod.Page) {
+	t.Log("Log into Botkube Cloud Dashboard")
+
+	p.page.Page = page
+
+	p.page.MustNavigate(appendOrgIDQueryParam(t, p.cfg.BotkubeCloud.UIBaseURL, p.cfg.BotkubeCloud.TeamOrganizationID))
+	p.page.MustWaitNavigation()
+
+	p.page.MustElement(`input[name="username"]`).MustInput(p.cfg.BotkubeCloud.Email)
+	p.page.MustElement(`input[name="password"]`).MustInput(p.cfg.BotkubeCloud.Password)
+	p.page.MustElementR("button", "^Continue$").MustClick()
+	p.page.Screenshot()
+}
+
+func (p *BotkubeCloudPage) HideCookieBanner(t *testing.T) {
+	t.Log("Hide Botkube cookie banner")
+	p.page.MustElementR("button", "^Decline$").MustClick()
+	p.page.Screenshot()
+}
+
+func (p *BotkubeCloudPage) CaptureBearerToken(t *testing.T, browser *rod.Browser) func() {
+	t.Logf("Starting hijacking requests to %q to get the bearer token...", p.GQLEndpoint)
+
+	router := browser.HijackRequests()
+	router.MustAdd(p.GQLEndpoint, func(ctx *rod.Hijack) {
+		if p.AuthHeaderValue != "" {
+			ctx.ContinueRequest(&proto.FetchContinueRequest{})
+			return
+		}
+
+		if ctx.Request != nil && ctx.Request.Method() != http.MethodPost {
+			ctx.ContinueRequest(&proto.FetchContinueRequest{})
+			return
+		}
+
+		require.NotNil(t, ctx.Request)
+		p.AuthHeaderValue = ctx.Request.Header(authHeaderName)
+		ctx.ContinueRequest(&proto.FetchContinueRequest{})
+	})
+	go router.Run()
+	return router.MustStop
+}
+
+func (p *BotkubeCloudPage) CreateNewInstance(t *testing.T, name string) {
+	t.Log("Create new Botkube Instance")
+
+	p.page.MustElement("h6#create-instance").MustClick()
+	p.page.MustElement(`input[name="name"]`).MustSelectAllText().MustInput(name)
+	p.page.Screenshot()
+
+	// persist connected deploy info
+	_, id, _ := strings.Cut(p.page.MustInfo().URL, "add/")
+	p.ConnectedDeploy = &gqlModel.Deployment{
+		Name: name,
+		ID:   id,
+	}
+}
+
+func (p *BotkubeCloudPage) InstallAgentInCluster(t *testing.T, botkubeBinary string) {
+	t.Log("Getting Botkube install command")
+	installCmd := p.page.MustElement("div#install-upgrade-cmd > kbd").MustText()
+
+	t.Log("Installing Botkube using Botkube CLI")
+	args, err := shellwords.Parse(installCmd)
+	args = append(args, "--auto-approve")
+	require.NoError(t, err)
+
+	cmd := exec.Command(botkubeBinary, args[1:]...)
+	installOutput, err := cmd.CombinedOutput()
+	t.Log(string(installOutput))
+	require.NoError(t, err)
+
+	p.page.MustElement("button#cluster-connected").MustClick()
+}
+
+func (p *BotkubeCloudPage) OpenSlackAppIntegrationPage(t *testing.T) {
+	t.Log("Opening Slack App Integration Page")
+	p.page.MustElement(`button[aria-label="Add tab"]`).MustClick()
+	p.page.MustWaitStable()
+	p.page.MustElementR("button", "^Slack$").MustClick()
+	p.page.MustWaitStable()
+	p.page.Screenshot()
+
+	p.page.MustElementR("a", "Add to Slack").MustClick()
+}
+
+// ReAddSlackPlatformIfShould add the slack platform again as the page was often not refreshed with a newly connected Slack Workspace.
+// It only occurs with headless mode.
+func (p *BotkubeCloudPage) ReAddSlackPlatformIfShould(t *testing.T, isHeadless bool) {
+	if !isHeadless {
+		return
+	}
+
+	t.Log("Re-adding Slack platform")
+
+	p.page.MustActivate()
+	p.page.MustElement(`button[aria-label="remove"]`).MustClick()
+	p.page.MustElement(`button[aria-label="Add tab"]`).MustClick()
+	p.page.MustElementR("button", "^Slack$").MustClick()
+	p.page.Screenshot()
+}
+
+func (p *BotkubeCloudPage) VerifyDeploymentStatus(t *testing.T, status string) {
+	t.Logf("Waiting for status '%s'", status)
+	p.page.Timeout(awaitInstanceStatusChange).MustElementR("div#deployment-status", status)
+}
+
+func (p *BotkubeCloudPage) SetupSlackWorkspace(t *testing.T, channel string) {
+	t.Logf("Selecting newly connected %q Slack Workspace", p.cfg.Slack.WorkspaceName)
+
+	p.page.MustElement(`input[type="search"]`).
+		MustInput(p.cfg.Slack.WorkspaceName).
+		MustType(input.Enter)
+	p.page.Screenshot()
+
+	// fil
```

**File**: `test/cloud-slack-dev-e2e/cloud_slack_dev_e2e_test.go` (modified, +129/-367)
```diff
@@ -4,25 +4,22 @@ package cloud_slack_dev_e2e
 
 import (
 	"context"
-	"errors"
 	"fmt"
-	"github.com/avast/retry-go/v4"
-	"net/http"
-	"net/url"
 	"os"
 	"path/filepath"
 	"strings"
 	"sync/atomic"
 	"testing"
 	"time"
 
+	"botkube.io/botube/test/botkubex"
 	"botkube.io/botube/test/cloud_graphql"
 	"botkube.io/botube/test/commplatform"
 	"botkube.io/botube/test/diff"
-	"botkube.io/botube/test/helmx"
+	"github.com/avast/retry-go/v4"
 	"github.com/go-rod/rod"
 	"github.com/go-rod/rod/lib/launcher"
-	"github.com/go-rod/rod/lib/proto"
+	"github.com/go-rod/rod/lib/launcher/flags"
 	"github.com/hasura/go-graphql-client"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
@@ -39,49 +36,39 @@ import (
 	"github.com/kubeshop/botkube/pkg/formatx"
 )
 
-const (
-	// Chromium is not supported by Slack web app for some reason
-	chromeUserAgent      = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
-	authHeaderName       = "Authorization"
-	cleanupRetryAttempts = 5
-)
+const cleanupRetryAttempts = 5
 
 type E2ESlackConfig struct {
 	Slack        SlackConfig
 	BotkubeCloud BotkubeCloudConfig
 
-	PageTimeout    time.Duration `envconfig:"default=1m"`
+	PageTimeout    time.Duration `envconfig:"default=5m"`
 	ScreenshotsDir string        `envconfig:"optional"`
 	DebugMode      bool          `envconfig:"default=false"`
 
-	ClusterNamespace string        `envconfig:"default=default"`
-	Kubeconfig       string        `envconfig:"optional"`
-	DefaultWaitTime  time.Duration `envconfig:"default=10s"`
+	ClusterNamespace     string `envconfig:"default=default"`
+	Kubeconfig           string `envconfig:"optional"`
+	BotkubeCliBinaryPath string
 }
 
 type SlackConfig struct {
 	WorkspaceName                 string
 	Email                         string
 	Password                      string
-	BotDisplayName                string `envconfig:"default=BotkubeDev"`
-	ConversationWithBotURL        string `envconfig:"default=https://app.slack.com/client/"`
-	WorkspaceAlreadyConnected     bool   `envconfig:"default=false"`
-	DisconnectWorkspaceAfterTests bool   `envconfig:"default=true"`
+	WorkspaceAlreadyConnected     bool `envconfig:"default=false"`
+	DisconnectWorkspaceAfterTests bool `envconfig:"default=true"`
 
 	Tester commplatform.SlackConfig
 }
 
 type BotkubeCloudConfig struct {
-	APIBaseURL                             string `envconfig:"default=https://api-dev.botkube.io"`
-	APIGraphQLEndpoint                     string `envconfig:"default=graphql"`
-	APISlackAppInstallationBaseURLOverride string `envconfig:"optional"`
-	APISlackAppInstallationEndpoint        string `envconfig:"default=routers/slack/v1/install"`
-	Email                                  string
-	Password                               string
+	APIBaseURL         string `envconfig:"default=https://api-dev.botkube.io"`
+	UIBaseURL          string `envconfig:"default=https://app-dev.botkube.io"`
+	APIGraphQLEndpoint string `envconfig:"default=graphql"`
+	Email              string
+	Password           string
 
 	TeamOrganizationID string
-	FreeOrganizationID string
-	PluginRepoURL      string `envconfig:"default=https://storage.googleapis.com/botkube-plugins-latest/plugins-dev-index.yaml"`
 }
 
 func TestCloudSlackE2E(t *testing.T) {
@@ -90,13 +77,25 @@ func TestCloudSlackE2E(t *testing.T) {
 	err := envconfig.Init(&cfg)
 	require.NoError(t, err)
 
-	cfg.Slack.Tester.CloudBasedTestEnabled = false // override property used only in the Cloud Slack E2E tests
-	cfg.Slack.Tester.RecentMessagesLimit = 4       // this is used effectively only for the Botkube restarts. There are two of them in a short time window, so it shouldn't be higher than 5.
+	cfg.Slack.Tester.CloudBasedTestEnabled = false        // override property used only in the Cloud Slack E2E tests
+	cfg.Slack.Tester.RecentMessagesLimit = 3              // this is used effectively only for the Botkube restarts. There are two of them in a short time window, so it shouldn't be higher than 5.
+	cfg.Slack.Tester.MessageWaitTimeout = 3 * time.Minute // downloading plugins on restarted Agents, sometimes takes a while on GitHub runners.
 
-	authHeaderValue := ""
 	var botkubeDeploymentUninstalled atomic.Bool
 	botkubeDeploymentUninstalled.Store(true) // not yet installed
-	gqlEndpoint := fmt.Sprintf("%s/%s", cfg.BotkubeCloud.APIBaseURL, cfg.BotkubeCloud.APIGraphQLEndpoint)
+	t.Cleanup(func() {
+		if t.Failed() {
+			t.Log("Tests failed, keeping the Botkube instance installed for debugging purposes.")
+			return
+		}
+		if botkubeDeploymentUninstalled.Load() {
+			return
+		}
+		t.Log("Uninstalling Botkube...")
+		botkubex.Uninstall(t, cfg.BotkubeCliBinaryPath)
+
+		botkubeDeploymentUninstalled.Store(true)
+	})
 
 	if cfg.ScreenshotsDir != "" {
 		t.Logf("Screenshots enabled. They will be saved to %s", cfg.ScreenshotsDir)
@@ -106,10 +105,28 @@ func TestCloudSlackE2E(t *testing.T) {
 		t.Log("Screenshots disabled.")
 	}
 
-	t.
```

**File**: `test/cloud-slack-dev-e2e/gql.go` (modified, +28/-14)
```diff
@@ -3,6 +3,8 @@
 package cloud_slack_dev_e2e
 
 import (
+	"strings"
+
 	gqlModel "github.com/kubeshop/botkube-cloud/botkube-cloud-backend/pkg/graphql"
 )
 
@@ -34,22 +36,34 @@ type AuditEventPage struct {
 }
 
 // CreateActionUpdateInput returns action create update input.
-func CreateActionUpdateInput() []*gqlModel.ActionCreateUpdateInput {
-	var actions []*gqlModel.ActionCreateUpdateInput
-	source1 := "kubernetes_config"
-	executor1 := "kubectl_config"
-	actions = append(actions, &gqlModel.ActionCreateUpdateInput{
-		Name:        "action_xxx22",
-		DisplayName: "Action Name",
-		Enabled:     true,
-		Command:     "kc get pods",
-		Bindings: &gqlModel.ActionCreateUpdateInputBindings{
-			Sources:   []string{source1},
-			Executors: []string{executor1},
+func CreateActionUpdateInput(deploy *gqlModel.Deployment) []*gqlModel.ActionCreateUpdateInput {
+	source, executor := DeploymentSourceAndExecutor(deploy)
+	return []*gqlModel.ActionCreateUpdateInput{
+		{
+			Name:        "action_xxx22",
+			DisplayName: "Action Name",
+			Enabled:     true,
+			Command:     "kc get pods",
+			Bindings: &gqlModel.ActionCreateUpdateInputBindings{
+				Sources:   []string{source},
+				Executors: []string{executor},
+			},
 		},
-	})
+	}
+}
+
+// DeploymentSourceAndExecutor returns last 'kubernetes' source and 'kubectl' executor plugin found under plugins.
+func DeploymentSourceAndExecutor(deploy *gqlModel.Deployment) (source string, executor string) {
+	for _, plugin := range deploy.Plugins {
+		if plugin.Type == gqlModel.PluginTypeSource && strings.Contains(plugin.Name, "kubernetes"){
+			source = plugin.ConfigurationName
+		}
+		if plugin.Type == gqlModel.PluginTypeExecutor && strings.Contains(plugin.Name, "kubectl"){
+			executor = plugin.ConfigurationName
+		}
+	}
 
-	return actions
+	return source, executor
 }
 
 // ExpectedCommandExecutedEvents returns expected command executed events.
```

**File**: `test/cloud-slack-dev-e2e/page_helpers_test.go` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+//go:build cloud_slack_dev_e2e
+
+package cloud_slack_dev_e2e
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/go-rod/rod"
+	"github.com/go-rod/rod/lib/proto"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+const (
+	// Chromium is not supported by Slack web app for some reason
+	// Currently, we get:
+	//   This browser won’t be supported starting September 1st, 2024. Update your browser to keep using Slack. Learn more:
+	//   https://slack.com/intl/en-gb/help/articles/1500001836081-Slack-support-life-cycle-for-operating-systems-app-versions-and-browsers
+	chromeUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
+)
+
+type Page struct {
+	*rod.Page
+	t   *testing.T
+	cfg E2ESlackConfig
+}
+
+func (p Page) Screenshot(suffix ...string) {
+	p.t.Helper()
+	if p.cfg.ScreenshotsDir == "" {
+		return
+	}
+
+	pathParts := strings.Split(p.cfg.ScreenshotsDir, "/")
+	pathParts = append(pathParts)
+
+	filePath := filepath.Join(p.cfg.ScreenshotsDir, fmt.Sprintf("%d%s.png", time.Now().UnixNano(), screenshotSuffix(suffix)))
+
+	logMsg := fmt.Sprintf("Saving screenshot to %q", filePath)
+	if p.cfg.DebugMode {
+		info, err := p.Info()
+		assert.NoError(p.t, err)
+
+		if info != nil {
+			logMsg += fmt.Sprintf(" for URL %q", info.URL)
+		}
+	}
+	p.t.Log(logMsg)
+	data, err := p.Page.Screenshot(false, nil)
+	assert.NoError(p.t, err)
+	if err != nil {
+		return
+	}
+
+	err = os.WriteFile(filePath, data, 0o644)
+	assert.NoError(p.t, err)
+}
+
+func screenshotSuffix(suffix []string) string {
+	if len(suffix) == 0 {
+		return ""
+	}
+	return "-" + strings.Join(suffix, "-")
+}
+
+func closePage(t *testing.T, name string, page *rod.Page) {
+	t.Helper()
+	err := page.Close()
+	if err != nil {
+		if errors.Is(err, context.Canceled) {
+			return
+		}
+
+		t.Logf("Failed to close page %q: %v", name, err)
+	}
+}
+
+func newBrowserPage(t *testing.T, browser *rod.Browser, cfg E2ESlackConfig) *rod.Page {
+	t.Helper()
+
+	page, err := browser.Page(proto.TargetCreateTarget{URL: ""})
+	require.NoError(t, err)
+	page.MustSetUserAgent(&proto.NetworkSetUserAgentOverride{
+		UserAgent: chromeUserAgent,
+	})
+	page = page.Timeout(cfg.PageTimeout)
+	page.MustSetViewport(1200, 1080, 1, false)
+	return page
+}
```

**File**: `test/cloud-slack-dev-e2e/slack_page_helpers_test.go` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+//go:build cloud_slack_dev_e2e
+
+package cloud_slack_dev_e2e
+
+import (
+	"testing"
+	"time"
+
+	"github.com/go-rod/rod"
+)
+
+const slackBaseURL = "slack.com"
+
+type SlackPage struct {
+	page *Page
+	cfg  SlackConfig
+}
+
+func NewSlackPage(t *testing.T, cfg E2ESlackConfig) *SlackPage {
+	return &SlackPage{
+		page: &Page{t: t, cfg: cfg},
+		cfg:  cfg.Slack,
+	}
+}
+
+func (p *SlackPage) ConnectWorkspace(t *testing.T, headless bool, browser *rod.Browser) {
+	p.page.Page = browser.MustPages().MustFindByURL(slackBaseURL)
+
+	p.page.MustElement("input#domain").MustInput(p.cfg.WorkspaceName)
+
+	p.page.MustElementR("button", "Continue").MustClick()
+	p.page.Screenshot()
+
+	// here we get reloaded, so we need to type it again (looks like bug on Slack side)
+	if !headless {
+		p.page.MustElement("input#domain").MustInput(p.cfg.WorkspaceName)
+		p.page.MustElementR("button", "Continue").MustClick()
+	}
+
+	p.page.MustWaitStable()
+	p.page.MustElementR("a", "sign in with a password instead").MustClick()
+	p.page.Screenshot()
+	p.page.MustElement("input#email").MustInput(p.cfg.Email)
+	p.page.MustElement("input#password").MustInput(p.cfg.Password)
+	p.page.Screenshot()
+
+	t.Log("Hide Slack cookie banner that collides with 'Sign in' button")
+	cookie, err := p.page.Timeout(5 * time.Second).Element("button#onetrust-accept-btn-handler")
+	if err != nil {
+		t.Logf("Failed to obtain cookie element: %s. Skipping...", err.Error())
+	} else {
+		cookie.MustClick()
+	}
+
+	p.page.MustElementR("button", "/^Sign in$/i").MustClick()
+	p.page.Screenshot()
+
+	p.page.MustElementR("button.c-button:not(.c-button--disabled)", "Allow").MustClick()
+
+	t.Log("Finalizing Slack workspace connection...")
+	if p.cfg.WorkspaceAlreadyConnected {
+		t.Log("Expecting already connected message...")
+		p.page.MustElementR("div.ant-result-title", "Organization Already Connected!")
+	} else {
+		t.Log("Finalizing connection...")
+		p.page.Screenshot()
+		p.page.MustElement("button#slack-workspace-connect").MustClick().
+			MustWaitEnabled() // when it's re-enabled, then it means the query was finished 
+		p.page.Screenshot()
+	}
+
+	_ = p.page.Close() // the page should be closed automatically anyway
+}
```

---

### Incident Patch 5: `a3f727e2` (2024-05-27)
**Commit Message**: Introduce italic description for Button Builder API (#1450)

Add new style API for ButtonBuilder

**File**: `pkg/api/message.go` (modified, +12/-0)
```diff
@@ -316,6 +316,9 @@ type ButtonDescriptionStyle string
 const (
 	// ButtonDescriptionStyleBold defines the bold style for the button description.
 	ButtonDescriptionStyleBold ButtonDescriptionStyle = "bold"
+
+	// ButtonDescriptionStyleItalic defines the bold style for the button description.
+	ButtonDescriptionStyleItalic ButtonDescriptionStyle = "italic"
 	// ButtonDescriptionStyleText defines the plaintext style for the button description.
 	ButtonDescriptionStyleText ButtonDescriptionStyle = "text"
 	// ButtonDescriptionStyleCode defines the code style for the button description.
@@ -351,6 +354,15 @@ func (b *ButtonBuilder) ForCommandWithDescCmd(name, cmd string, style ...ButtonS
 	return b.commandWithCmdDesc(name, cmd, cmd, bt)
 }
 
+// ForCommandWithItalicDesc returns button command where description and command are different and the description is italic.
+func (b *ButtonBuilder) ForCommandWithItalicDesc(name, desc, cmd string, style ...ButtonStyle) Button {
+	bt := ButtonStyleDefault
+	if len(style) > 0 {
+		bt = style[0]
+	}
+	return b.commandWithDesc(name, cmd, desc, bt, ButtonDescriptionStyleItalic)
+}
+
 // ForCommandWithBoldDesc returns button command where description and command are different.
 func (b *ButtonBuilder) ForCommandWithBoldDesc(name, desc, cmd string, style ...ButtonStyle) Button {
 	bt := ButtonStyleDefault
```

**File**: `pkg/bot/slack_renderer.go` (modified, +2/-0)
```diff
@@ -307,6 +307,8 @@ func (b *SlackRenderer) renderButtonsWithDescription(in api.Buttons) []slack.Blo
 		switch btn.DescriptionStyle {
 		case api.ButtonDescriptionStyleBold:
 			desc = fmt.Sprintf("*%s*", desc)
+		case api.ButtonDescriptionStyleItalic:
+			desc = fmt.Sprintf("_%s_", desc)
 		case api.ButtonDescriptionStyleText:
 			// no op, it should be just a simple string
 		case api.ButtonDescriptionStyleCode:
```

---

### Incident Patch 6: `9d1c8972` (2024-05-24)
**Commit Message**: Update Helm chart Readme links rendering (#1449)

Update Helm chart Readme rendering for new docs page

**File**: `helm/botkube/README.md` (modified, +3/-4)
```diff
@@ -4,17 +4,16 @@
 
 A virtual SRE, powered by AI.
 
-**Homepage:** <https://botkube.io>
+**Homepage:** [https://botkube.io](https://botkube.io)
 
 ## Maintainers
 
 | Name | Email  |
 | ---- | ------ |
-| Botkube Dev Team | <dev-team@botkube.io> |
+| Botkube Dev Team | [dev-team@botkube.io](mailto:dev-team@botkube.io) |
 
 ## Source Code
-
-* <https://github.com/kubeshop/botkube>
+[https://github.com/kubeshop/botkube](https://github.com/kubeshop/botkube)
 
 ## Parameters
 
```

**File**: `helm/botkube/README.tpl.md` (modified, +10/-3)
```diff
@@ -4,19 +4,26 @@
 
 {{ template "chart.description" . }}
 
-{{ template "chart.homepageLine" . }}
+{{ if .Home }}**Homepage:** [{{ .Home }}]({{ .Home }}){{ end }}
 
 {{ define "chart.maintainersTable" }}
 | Name | Email  |
 | ---- | ------ |
 {{- range .Maintainers }}
-| {{ .Name }} | {{ if .Email }}<{{ .Email }}>{{ end }} |
+| {{ .Name }} | {{ if .Email }}[{{ .Email }}](mailto:{{ .Email }}){{ end }} |
 {{- end }}
 {{ end }}
 
 {{ template "chart.maintainersSection" . }}
 
-{{ template "chart.sourcesSection" . }}
+
+{{ if .Sources }}
+## Source Code
+
+{{- range .Sources }}
+[{{ . }}]({{ . }})
+{{- end }}
+{{ end }}
 
 {{ template "chart.requirementsSection" . }}
 
```

---

### Incident Patch 7: `1eb65e78` (2024-05-09)
**Commit Message**: fix: close temporary kubeconfig file (#1441)

**File**: `pkg/plugin/kubeconfig.go` (modified, +1/-0)
```diff
@@ -123,6 +123,7 @@ func PersistKubeConfig(_ context.Context, kc []byte) (string, func(context.Conte
 	if err != nil {
 		return "", nil, errors.Wrap(err, "while writing kube config to file")
 	}
+	defer file.Close()
 
 	abs, err := filepath.Abs(file.Name())
 	if err != nil {
```

---

### Incident Patch 8: `a3695165` (2024-05-09)
**Commit Message**: Update go.mod in test pkg to latest cloud version to fix Teams assertion (#1440)

**File**: `test/go.mod` (modified, +2/-2)
```diff
@@ -14,8 +14,8 @@ require (
 	github.com/google/uuid v1.6.0
 	github.com/hasura/go-graphql-client v0.10.2
 	github.com/infracloudio/msbotbuilder-go v0.2.6-0.20231130085215-84d2040b3577
-	github.com/kubeshop/botkube v0.13.1-0.20240422102108-216a2f38b7dd
-	github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a
+	github.com/kubeshop/botkube v0.13.1-0.20240508144003-3487564b83a1
+	github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240508145541-6aa7480265af
 	github.com/markbates/errx v1.1.0
 	github.com/microsoftgraph/msgraph-sdk-go v1.31.0
 	github.com/nsf/jsondiff v0.0.0-20230430225905-43f6cf3098c1
```

**File**: `test/go.sum` (modified, +2/-2)
```diff
@@ -852,8 +852,8 @@ github.com/kr/pty v1.1.5/go.mod h1:9r2w37qlBe7rQ6e1fg1S/9xpWHSnaqNdHD3WcMdbPDA=
 github.com/kr/text v0.1.0/go.mod h1:4Jbv+DJW3UT/LiOwJeYQe1efqtUx/iVham/4vfdArNI=
 github.com/kr/text v0.2.0 h1:5Nx0Ya0ZqY2ygV366QzturHI13Jq95ApcVaJBhpS+AY=
 github.com/kr/text v0.2.0/go.mod h1:eLer722TekiGuMkidMxC/pM04lWEeraHUUmBw8l2grE=
-github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a h1:Y15ERlsgBYD/XlFEwfVFYOPeEUAooPpns7CO0cxhcz0=
-github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a/go.mod h1:Ggbu2gvDwQxQWHRKcV6JUeqvo+rsZ0k+ww6PV1LSNoo=
+github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240508145541-6aa7480265af h1:ewFR7Y1fGCcG1YzQwpxL36tOUIJmDJK7aR/DMoFrPCQ=
+github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240508145541-6aa7480265af/go.mod h1:qVsXQutuaUP+4eoSs4SCpVWvfZLWxs9yB459JclAAuk=
 github.com/kubeshop/go-adaptive-cards v0.0.0-20231114223529-d6d8b980f0c8 h1:uTChAaS5OdD9gGXnafXMUhMo1gyyX2loCjoCyQr5mlg=
 github.com/kubeshop/go-adaptive-cards v0.0.0-20231114223529-d6d8b980f0c8/go.mod h1:RtCzt65p/zEos6+zhiCFQmiaHmro6M63l9NP7xXx/Lg=
 github.com/kylelemons/godebug v1.1.0 h1:RPNrshWIDI6G2gRW9EHilWtl7Z6Sb1BR0xunSBf0SNc=
```

---

### Incident Patch 9: `d4a164f5` (2024-04-23)
**Commit Message**: Fix integration and E2E tests after Cloud Dev update (#1435)

**File**: `test/cloud-slack-dev-e2e/cloud_slack_dev_e2e_test.go` (modified, +4/-3)
```diff
@@ -646,10 +646,11 @@ func removeSourcesAndAddActions(t *testing.T, gql *graphql.Client, existingDeplo
 	platforms := gqlModel.PlatformsUpdateInput{}
 
 	for _, slack := range existingDeployment.Platforms.CloudSlacks {
-		var channelUpdateInputs []*gqlModel.ChannelBindingsByNameUpdateInput
+		var channelUpdateInputs []*gqlModel.ChannelBindingsByNameAndIDUpdateInput
 		for _, channel := range slack.Channels {
-			channelUpdateInputs = append(channelUpdateInputs, &gqlModel.ChannelBindingsByNameUpdateInput{
-				Name: channel.Name,
+			channelUpdateInputs = append(channelUpdateInputs, &gqlModel.ChannelBindingsByNameAndIDUpdateInput{
+				ChannelID: "", // this is used for UI only so we don't need to provide it
+				Name:      channel.Name,
 				Bindings: &gqlModel.BotBindingsUpdateInput{
 					Sources:   nil,
 					Executors: []*string{&channel.Bindings.Executors[0]},
```

**File**: `test/cloud_graphql/graphql_client.go` (modified, +3/-2)
```diff
@@ -215,9 +215,10 @@ func (c *Client) CreateBasicDeploymentWithCloudSlack(t *testing.T, clusterName,
 					{
 						Name:   "Cloud Slack",
 						TeamID: slackTeamID,
-						Channels: []*gqlModel.ChannelBindingsByNameCreateInput{
+						Channels: []*gqlModel.ChannelBindingsByNameAndIDCreateInput{
 							{
-								Name: channelName,
+								ChannelID: "", // this is used for UI only so we don't need to provide it
+								Name:      channelName,
 								Bindings: &gqlModel.BotBindingsCreateInput{
 									Sources:   []*string{ptr.FromType("kubernetes_config")},
 									Executors: []*string{ptr.FromType("kubectl_config")},
```

**File**: `test/commplatform/slack_tester.go` (modified, +8/-8)
```diff
@@ -596,16 +596,16 @@ func (s *SlackTester) restoreMsgTsIfNeeded() {
 }
 
 var emojiSlackMapping = map[string]string{
-	"🟢": ":large_green_circle:",
-	"💡": ":bulb:",
-	"❗": ":exclamation:",
-	"🚀": ":rocket:",
-	"🏁": ":checkered_flag:",
+	"🟢":  ":large_green_circle:",
+	"💡":  ":bulb:",
+	"❗":  ":exclamation:",
+	"🚀":  ":rocket:",
+	"🏁":  ":checkered_flag:",
 	"🛠️": ":hammer_and_wrench:",
-	"📣": ":mega:",
+	"📣":  ":mega:",
 	"☁️": ":cloud:",
-	"🤖": ":robot_face:",
-	"🔮": ":crystal_ball:",
+	"🤖":  ":robot_face:",
+	"🔮":  ":crystal_ball:",
 }
 
 func replaceEmojiWithTags(content string) string {
```

**File**: `test/e2e/bots_test.go` (modified, +2/-1)
```diff
@@ -6,7 +6,6 @@ import (
 	"bytes"
 	"context"
 	"fmt"
-	"github.com/avast/retry-go/v4"
 	"net/http"
 	"os"
 	"regexp"
@@ -17,6 +16,8 @@ import (
 	"time"
 	"unicode"
 
+	"github.com/avast/retry-go/v4"
+
 	"botkube.io/botube/test/helmx"
 
 	"botkube.io/botube/test/botkubex"
```

**File**: `test/e2e/gql_client.go` (modified, +7/-4)
```diff
@@ -372,25 +372,28 @@ func (c *Client) CreateBasicDeploymentWithCloudSlack(t *testing.T, clusterName,
 					{
 						Name:   "Cloud Slack",
 						TeamID: slackTeamID,
-						Channels: []*gqlModel.ChannelBindingsByNameCreateInput{
+						Channels: []*gqlModel.ChannelBindingsByNameAndIDCreateInput{
 							{
-								Name: firstChannel,
+								ChannelID: "", // this is used for UI only so we don't need to provide it
+								Name:      firstChannel,
 								Bindings: &gqlModel.BotBindingsCreateInput{
 									Sources:   []*string{ptr.FromType("k8s-events"), ptr.FromType("k8s-annotated-cm-delete"), ptr.FromType("k8s-pod-create-events"), ptr.FromType("other-plugins")},
 									Executors: []*string{ptr.FromType("kubectl-first-channel-cmd"), ptr.FromType("other-plugins"), ptr.FromType("helm")},
 								},
 								NotificationsDisabled: ptr.FromType[bool](false),
 							},
 							{
-								Name: secondChannel,
+								ChannelID: "", // this is used for UI only so we don't need to provide it
+								Name:      secondChannel,
 								Bindings: &gqlModel.BotBindingsCreateInput{
 									Sources:   []*string{ptr.FromType("k8s-updates")},
 									Executors: []*string{ptr.FromType("k8s-default-tools")},
 								},
 								NotificationsDisabled: ptr.FromType[bool](true),
 							},
 							{
-								Name: thirdChannel,
+								ChannelID: "", // this is used for UI only so we don't need to provide it
+								Name:      thirdChannel,
 								Bindings: &gqlModel.BotBindingsCreateInput{
 									Sources:   []*string{ptr.FromType("rbac-with-static-mapping"), ptr.FromType("rbac-with-default-configuration")},
 									Executors: []*string{ptr.FromType("rbac-with-channel-mapping"), ptr.FromType("rbac-with-no-configuration")},
```

**File**: `test/go.mod` (modified, +7/-6)
```diff
@@ -14,8 +14,8 @@ require (
 	github.com/google/uuid v1.6.0
 	github.com/hasura/go-graphql-client v0.10.2
 	github.com/infracloudio/msbotbuilder-go v0.2.6-0.20231130085215-84d2040b3577
-	github.com/kubeshop/botkube v0.13.1-0.20240220144850-148a9ed00054
-	github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240314132733-e8a2a9257fb4
+	github.com/kubeshop/botkube v0.13.1-0.20240422102108-216a2f38b7dd
+	github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a
 	github.com/markbates/errx v1.1.0
 	github.com/microsoftgraph/msgraph-sdk-go v1.31.0
 	github.com/nsf/jsondiff v0.0.0-20230430225905-43f6cf3098c1
@@ -45,19 +45,19 @@ require (
 	cloud.google.com/go/compute/metadata v0.2.3 // indirect
 	cloud.google.com/go/iam v1.1.5 // indirect
 	cloud.google.com/go/storage v1.36.0 // indirect
-	github.com/99designs/gqlgen v0.17.31 // indirect
+	github.com/99designs/gqlgen v0.17.45 // indirect
 	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.9.1 // indirect
 	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.5.1 // indirect
 	github.com/Azure/azure-sdk-for-go/sdk/internal v1.5.1 // indirect
 	github.com/Azure/go-ansiterm v0.0.0-20210617225240-d185dfc1b5a1 // indirect
 	github.com/AzureAD/microsoft-authentication-library-for-go v1.2.1 // indirect
 	github.com/DanielTitkov/go-adaptive-cards v0.2.2 // indirect
 	github.com/Masterminds/semver/v3 v3.2.1 // indirect
-	github.com/PuerkitoBio/goquery v1.8.1 // indirect
+	github.com/PuerkitoBio/goquery v1.9.1 // indirect
 	github.com/agnivade/levenshtein v1.1.1 // indirect
 	github.com/alexflint/go-arg v1.4.3 // indirect
 	github.com/alexflint/go-scalar v1.1.0 // indirect
-	github.com/andybalholm/cascadia v1.3.1 // indirect
+	github.com/andybalholm/cascadia v1.3.2 // indirect
 	github.com/auth0/go-jwt-middleware/v2 v2.1.0 // indirect
 	github.com/aws/aws-sdk-go v1.44.122 // indirect
 	github.com/bgentry/go-netrc v0.0.0-20140422174119-9fd32a8b3d3d // indirect
@@ -175,6 +175,7 @@ require (
 	github.com/segmentio/analytics-go v3.1.0+incompatible // indirect
 	github.com/segmentio/backo-go v0.0.0-20200129164019-23eae7c10bd3 // indirect
 	github.com/sirupsen/logrus v1.9.3 // indirect
+	github.com/sosodev/duration v1.2.0 // indirect
 	github.com/sourcegraph/conc v0.3.0 // indirect
 	github.com/spf13/cobra v1.8.0 // indirect
 	github.com/spf13/pflag v1.0.5 // indirect
@@ -183,7 +184,7 @@ require (
 	github.com/stripe/stripe-go/v74 v74.14.0 // indirect
 	github.com/tinylib/msgp v1.1.8 // indirect
 	github.com/ulikunitz/xz v0.5.10 // indirect
-	github.com/vektah/gqlparser/v2 v2.5.1 // indirect
+	github.com/vektah/gqlparser/v2 v2.5.11 // indirect
 	github.com/vmihailenco/msgpack/v5 v5.3.5 // indirect
 	github.com/vmihailenco/tagparser/v2 v2.0.0 // indirect
 	github.com/wiggin77/merror v1.0.5 // indirect
```

**File**: `test/go.sum` (modified, +19/-13)
```diff
@@ -197,8 +197,8 @@ dmitri.shuralyov.com/html/belt v0.0.0-20180602232347-f7d459c86be0/go.mod h1:JLBr
 dmitri.shuralyov.com/service/change v0.0.0-20181023043359-a85b471d5412/go.mod h1:a1inKt/atXimZ4Mv927x+r7UpyzRUf4emIoiiSC2TN4=
 dmitri.shuralyov.com/state v0.0.0-20180228185332-28bcc343414c/go.mod h1:0PRwlb0D6DFvNNtx+9ybjezNCa8XF0xaYcETyp6rHWU=
 git.apache.org/thrift.git v0.0.0-20180902110319-2566ecd5d999/go.mod h1:fPE2ZNJGynbRyZ4dJvy6G277gSllfV2HJqblrnkyeyg=
-github.com/99designs/gqlgen v0.17.31 h1:VncSQ82VxieHkea8tz11p7h/zSbvHSxSDZfywqWt158=
-github.com/99designs/gqlgen v0.17.31/go.mod h1:i4rEatMrzzu6RXaHydq1nmEPZkb3bKQsnxNRHS4DQB4=
+github.com/99designs/gqlgen v0.17.45 h1:bH0AH67vIJo8JKNKPJP+pOPpQhZeuVRQLf53dKIpDik=
+github.com/99designs/gqlgen v0.17.45/go.mod h1:Bas0XQ+Jiu/Xm5E33jC8sES3G+iC2esHBMXcq0fUPs0=
 github.com/AndreasBriese/bbloom v0.0.0-20190306092124-e2d15f34fcf9/go.mod h1:bOvUY6CB00SOBii9/FifXqc0awNKxLFCL/+pkDPuyl8=
 github.com/Azure/azure-sdk-for-go/sdk/azcore v1.9.1 h1:lGlwhPtrX6EVml1hO0ivjkUxsSyl4dsiw9qcA1k/3IQ=
 github.com/Azure/azure-sdk-for-go/sdk/azcore v1.9.1/go.mod h1:RKUqNu35KJYcVG/fqTRqmuXJZYNhYkBrnC/hX7yGbTA=
@@ -235,8 +235,9 @@ github.com/Microsoft/go-winio v0.6.1 h1:9/kr64B9VUZrLm5YYwbGtUJnMgqWVOdUAXu6Migc
 github.com/Microsoft/go-winio v0.6.1/go.mod h1:LRdKpFKfdobln8UmuiYcKPot9D2v6svN5+sAH+4kjUM=
 github.com/NYTimes/gziphandler v0.0.0-20170623195520-56545f4a5d46/go.mod h1:3wb06e3pkSAbeQ52E9H9iFoQsEEwGN64994WTCIhntQ=
 github.com/OneOfOne/xxhash v1.2.2/go.mod h1:HSdplMjZKSmBqAxg5vPj2TmRDmfkzw+cTzAElWljhcU=
-github.com/PuerkitoBio/goquery v1.8.1 h1:uQxhNlArOIdbrH1tr0UXwdVFgDcZDrZVdcpygAcwmWM=
 github.com/PuerkitoBio/goquery v1.8.1/go.mod h1:Q8ICL1kNUJ2sXGoAhPGUdYDJvgQgHzJsnnd3H7Ho5jQ=
+github.com/PuerkitoBio/goquery v1.9.1 h1:mTL6XjbJTZdpfL+Gwl5U2h1l9yEkJjhmlTeV9VPW7UI=
+github.com/PuerkitoBio/goquery v1.9.1/go.mod h1:cW1n6TmIMDoORQU5IU/P1T3tGFunOeXEpGP2WHRwkbY=
 github.com/PuerkitoBio/purell v1.1.0/go.mod h1:c11w/QuzBsJSee3cPx9rAFu61PvFxuPbtSwDGJws/X0=
 github.com/PuerkitoBio/purell v1.1.1/go.mod h1:c11w/QuzBsJSee3cPx9rAFu61PvFxuPbtSwDGJws/X0=
 github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578/go.mod h1:uGdkoq3SwY9Y+13GIhn11/XLaGBb4BfwItxLd5jeuXE=
@@ -256,8 +257,9 @@ github.com/alexflint/go-scalar v1.1.0 h1:aaAouLLzI9TChcPXotr6gUhq+Scr8rl0P9P4Pnl
 github.com/alexflint/go-scalar v1.1.0/go.mod h1:LoFvNMqS1CPrMVltza4LvnGKhaSpc3oyLEBUZVhhS2o=
 github.com/andreyvit/diff v0.0.0-20170406064948-c7f18ee00883 h1:bvNMNQO63//z+xNgfBlViaCIJKLlCJ6/fmUseuG0wVQ=
 github.com/andreyvit/diff v0.0.0-20170406064948-c7f18ee00883/go.mod h1:rCTlJbsFo29Kk6CurOXKm700vrz8f0KW0JNfpkRJY/8=
-github.com/andybalholm/cascadia v1.3.1 h1:nhxRkql1kdYCc8Snf7D5/D3spOX+dBgjA6u8x004T2c=
 github.com/andybalholm/cascadia v1.3.1/go.mod h1:R4bJ1UQfqADjvDa4P6HZHLh/3OxWWEqc0Sk8XGwHqvA=
+github.com/andybalholm/cascadia v1.3.2 h1:3Xi6Dw5lHF15JtdcmAHD3i1+T8plmv7BQ/nsViSLyss=
+github.com/andybalholm/cascadia v1.3.2/go.mod h1:7gtRlve5FxPPgIgX36uWBX58OdBsSS6lUvCFb+h7KvU=
 github.com/anmitsu/go-shlex v0.0.0-20161002113705-648efa622239/go.mod h1:2FmKhYUyUczH0OGQWaF5ceTx0UBShxjsH6f8oGKYe2c=
 github.com/anthhub/forwarder v1.1.0 h1:3X3lI+aRbbj/zg8x6Ff2l1TnICp37vj7i4TXFHehT5w=
 github.com/anthhub/forwarder v1.1.0/go.mod h1:Hg59z12Sy45xWE5/5vgMh5KkfOVkPBeMEh1nSjXBXMc=
@@ -850,8 +852,8 @@ github.com/kr/pty v1.1.5/go.mod h1:9r2w37qlBe7rQ6e1fg1S/9xpWHSnaqNdHD3WcMdbPDA=
 github.com/kr/text v0.1.0/go.mod h1:4Jbv+DJW3UT/LiOwJeYQe1efqtUx/iVham/4vfdArNI=
 github.com/kr/text v0.2.0 h1:5Nx0Ya0ZqY2ygV366QzturHI13Jq95ApcVaJBhpS+AY=
 github.com/kr/text v0.2.0/go.mod h1:eLer722TekiGuMkidMxC/pM04lWEeraHUUmBw8l2grE=
-github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240314132733-e8a2a9257fb4 h1:csOJ4r9fmVmTuOAsW1USgoSakUnuo5VXkCxlGKhad90=
-github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240314132733-e8a2a9257fb4/go.mod h1:3ukyC8ABSglDIYr4OM9x0U0H6JPYlRZH6F2qewtZqeQ=
+github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a h1:Y15ERlsgBYD/XlFEwfVFYOPeEUAooPpns7CO0cxhcz0=
+github.com/kubeshop/botkube-cloud/botkube-cloud-backend v0.0.0-20240422155202-e9ac9407823a/go.mod h1:Ggbu2gvDwQxQWHRKcV6JUeqvo+rsZ0k+ww6PV1LSNoo=
 github.com/kubeshop/go-adaptive-cards v0.0.0-20231114223529-d6d8b980f0c8 h1:uTChAaS5OdD9gGXnafXMUhMo1gyyX2loCjoCyQr5mlg=
 github.com/kubeshop/go-adaptive-cards v0.0.0-20231114223529-d6d8b980f0c8/go.mod h1:RtCzt65p/zEos6+zhiCFQmiaHmro6M63l9NP7xXx/Lg=
 github.com/kylelemons/godebug v1.1.0 h1:RPNrshWIDI6G2gRW9EHilWtl7Z6Sb1BR0xunSBf0SNc=
@@ -1164,6 +1166,8 @@ github.com/slack-go/slack v0.12.3/go.mod h1:hlGi5oXA+Gt+yWTPP0plCdRKmjsDxecdHxYQ
 github.com/smartystreets/assertions v0.0.0-20180927180507-b2de0cb4f26d/go.mod h1:OnSkiWE9lh6wB0YB77sQom3nweQdgAjqCqsofrRNTgc=
 github.com/smartystreets/goconvey v1.6.4/go.mod h1:syvi0/a8iFYH4r/RixwvyeAJjdLS9QV7WQ/tjFTllLA=
 github.com/soheilhy/cmux v0.1.4/go.mod h1:IM3LyeVVIOuxMH7sFAkER9+bJ4dT7Ms6E4xg4kGIyLM=
+github.com/sosodev/dur
```

**File**: `test/msg-layouts/help_test.go` (modified, +12/-10)
```diff
@@ -2,6 +2,10 @@ package msg_layouts
 
 import (
 	"encoding/json"
+	"os"
+	"path/filepath"
+	"testing"
+
 	"github.com/kubeshop/botkube-cloud/botkube-cloud-backend/pkg/teamsx"
 	"github.com/kubeshop/botkube/pkg/bot"
 	"github.com/kubeshop/botkube/pkg/bot/interactive"
@@ -10,21 +14,19 @@ import (
 	"github.com/slack-go/slack"
 	"github.com/stretchr/testify/require"
 	"gotest.tools/v3/golden"
-	"os"
-	"path/filepath"
-	"testing"
 )
 
 // TestNewHelpMessage generates help message directly in Teams and Slack format.
 // It's defined here as it requires the Cloud Teams renderer.
 // The output is stored in 'testdata/TestNewHelpMessage/' folder. You can just copy-paste it into dedicated editors to see the message layout:
-//  - Slack: https://app.slack.com/block-kit-builder/
-//  - Teams: https://adaptivecards.io/designer/
-//  - Discord: it's only markdown, just post as a normal message in discord channel 
-//  - Mattermost: it's only markdown, just post as a normal message in discord channel 
-//  
-// To update the golden files: 
-//   go test -v -run TestNewHelpMessage -update
+//   - Slack: https://app.slack.com/block-kit-builder/
+//   - Teams: https://adaptivecards.io/designer/
+//   - Discord: it's only markdown, just post as a normal message in discord channel
+//   - Mattermost: it's only markdown, just post as a normal message in discord channel
+//
+// To update the golden files:
+//
+//	go test -v -run TestNewHelpMessage -update
 func TestNewHelpMessage(t *testing.T) {
 	// Cloud options
 	platform := config.CloudSlackCommPlatformIntegration
```

---

### Incident Patch 10: `9bd883c2` (2024-04-09)
**Commit Message**: Fix Teams integration tests assertions (#1429)

Fix Teams e2e tests assertions

**File**: `test/commplatform/teams_tester.go` (modified, +5/-2)
```diff
@@ -256,8 +256,7 @@ func (s *TeamsTester) WaitForMessagePosted(userID, channelID string, limitMessag
 }
 
 func (s *TeamsTester) WaitForMessagePostedRecentlyEqual(userID, channelID, expectedMsg string) error {
-	msg := api.NewPlaintextMessage(expectedMsg, false)
-	return s.waitForAdaptiveCardMessage(userID, channelID, s.cfg.RecentMessagesLimit, interactive.CoreMessage{Message: msg})
+	return s.WaitForInteractiveMessagePosted(userID, channelID, s.cfg.RecentMessagesLimit, s.AssertEquals(expectedMsg))
 }
 
 func (s *TeamsTester) WaitForInteractiveMessagePosted(userID, channelID string, limitMessages int, assertFn MessageAssertion) error {
@@ -378,6 +377,10 @@ func (s *TeamsTester) AssertEquals(expectedMsg string) MessageAssertion {
 	return func(gotMsg string) (bool, int, string) {
 		gotMsg, expectedMsg = NormalizeTeamsWhitespacesInMessages(gotMsg, expectedMsg)
 		expectedMsg = teamsx.ReplaceEmojiTagsWithActualOne(expectedMsg)
+		// For teams the '*' means the underscore, so we need to replace it with '_'
+		// That's the reason why the 'expectedMsg' should become the api.Message in the future
+		// as we can't use the Markdown formatting directly in our test assertions.
+		expectedMsg = strings.ReplaceAll(expectedMsg, "*", "_")
 		if !strings.EqualFold(expectedMsg, gotMsg) {
 			count := diff.CountMatchBlock(expectedMsg, gotMsg)
 			msgDiff := diff.Diff(expectedMsg, gotMsg)
```

**File**: `test/e2e/bots_test.go` (modified, +17/-33)
```diff
@@ -265,7 +265,7 @@ func runBotTest(t *testing.T,
 			gqlCli.MustCreateAlias(t, alias[0], alias[1], alias[2], deployment.ID)
 		}
 		// Setting env is needed to instrument help msg with cloud sections, and proper links
-		os.Setenv("CONFIG_PROVIDER_IDENTIFIER", deployment.ID) 
+		os.Setenv("CONFIG_PROVIDER_IDENTIFIER", deployment.ID)
 		t.Cleanup(func() {
 			err := helmx.WaitForUninstallation(context.Background(), t, &botkubeDeploymentUninstalled)
 			assert.NoError(t, err)
@@ -382,8 +382,13 @@ func runBotTest(t *testing.T,
 			botDriver.PostMessageToBot(t, botDriver.FirstChannel().Identifier(), command)
 
 			expectedBody := ".... empty response _*<cricket sounds>*_ :cricket: :cricket: :cricket:"
-			if botDriver.Type() == commplatform.SlackBot {
+			switch botDriver.Type() {
+			case commplatform.SlackBot:
 				expectedBody = ".... empty response _*&lt;cricket sounds&gt;*_ :cricket: :cricket: :cricket:"
+			case commplatform.TeamsBot:
+				// the MS Teams treats the '_*<cricket sounds>*_' as the HTML tag and renders it into '<em><em></em></em>'
+				// which is later dropped by the markdown converter
+				expectedBody = ".... empty response  :cricket: :cricket: :cricket:"
 			}
 
 			err = waitForLastPlaintextMessageWithHeaderEqual(appCfg, botDriver, command, expectedBody)
@@ -506,7 +511,7 @@ func runBotTest(t *testing.T,
 			t.Log("Expecting bot message channel...")
 			expectedMsg := fmt.Sprintf("Plugin cm-watcher detected `ADDED` event on `%s/%s`", cfgMap.Namespace, cfgMap.Name)
 
-			err = waitForLastPlaintextMessageEqual(botDriver, botDriver.FirstChannel().ID(), expectedMsg)
+			err = botDriver.OnChannel().WaitForLastMessageEqual(botDriver.BotUserID(), botDriver.FirstChannel().ID(), expectedMsg)
 			assert.NoError(t, err)
 		})
 
@@ -538,7 +543,7 @@ func runBotTest(t *testing.T,
 			t.Log("Expecting bot message channel...")
 			expectedMsg := fmt.Sprintf("*Incoming webhook event:* %s", message)
 
-			err = waitForLastPlaintextMessageEqual(botDriver, botDriver.FirstChannel().ID(), expectedMsg)
+			err = botDriver.OnChannel().WaitForLastMessageEqual(botDriver.BotUserID(), botDriver.FirstChannel().ID(), expectedMsg)
 			assert.NoError(t, err)
 		})
 	})
@@ -1372,7 +1377,7 @@ func runBotTest(t *testing.T,
 			t.Log("Expecting bot message in third channel...")
 			expectedMsg := fmt.Sprintf("Plugin cm-watcher detected `DELETED` event on `%s/%s`", cfgMap.Namespace, cfgMap.Name)
 
-			err = waitForLastPlaintextMessageEqual(botDriver, botDriver.ThirdChannel().ID(), expectedMsg)
+			err = botDriver.OnChannel().WaitForLastMessageEqual(botDriver.BotUserID(), botDriver.ThirdChannel().ID(), expectedMsg)
 			require.NoError(t, err)
 
 			t.Cleanup(func() { cleanupCreatedCfgMapIfShould(t, cfgMapCli, cfgMap.Name, &cfgMapAlreadyDeleted) })
@@ -1736,31 +1741,16 @@ func trimRightWhitespace(input string) string {
 	return strings.Join(lines, "\n")
 }
 
-func waitForLastPlaintextMessageEqual(driver commplatform.BotDriver, channelID, expectedMsg string) error {
-	switch driver.Type() {
-	case commplatform.TeamsBot:
-		// in this case of a plain text message, Teams renderer uses Adaptive Cards format
-		return driver.WaitForLastInteractiveMessagePostedEqual(driver.BotUserID(), channelID, interactive.CoreMessage{
-			Message: api.Message{
-				BaseBody: api.Body{
-					Plaintext: expectedMsg,
-				},
-			},
-		})
-	default:
-		return driver.OnChannel().WaitForLastMessageEqual(driver.BotUserID(), channelID, expectedMsg)
+func waitForLastPlaintextMessageWithHeaderEqual(cfg Config, driver commplatform.BotDriver, cmd, expectedBody string) error {
+	cmdHeader := func(command string) string {
+		return fmt.Sprintf("`%s` on `%s`", command, cfg.ClusterName)
 	}
-}
 
-func waitForLastPlaintextMessageWithHeaderEqual(cfg Config, driver commplatform.BotDriver, cmd, expectedBody string) error {
-	return waitForLastMessageWithHeaderEqual(cfg, driver, cmd, expectedBody, false)
+	expectedMessage := fmt.Sprintf("%s\n%s", cmdHeader(cmd), expectedBody)
+	return driver.WaitForLastMessageEqual(driver.BotUserID(), driver.FirstChannel().ID(), expectedMessage)
 }
 
 func waitForLastCodeBlockMessageWithHeaderEqual(cfg Config, driver commplatform.BotDriver, cmd, expectedBody string) error {
-	return waitForLastMessageWithHeaderEqual(cfg, driver, cmd, expectedBody, true)
-}
-
-func waitForLastMessageWithHeaderEqual(cfg Config, driver commplatform.BotDriver, cmd, expectedBody string, asCodeBlock bool) error {
 	cmdHeader := func(command string) string {
 		return fmt.Sprintf("`%s` on `%s`", command, cfg.ClusterName)
 	}
@@ -1772,17 +1762,11 @@ func waitForLastMessageWithHeaderEqual(cfg Config, driver commplatform.BotDriver
 			Description: cmdHeader(cmd),
 			Message:     api.Message{},
 		}
-		if asCodeBlock {
-			msg.Message.BaseBody.CodeBlock = expectedBody
-		} else {
-			msg.Message.BaseBody.Plaintext = expectedBody
-		}
+		msg.Message.BaseBody.CodeBlock = expectedBody
 
 		return driver.WaitForLastInteractiveMessagePostedEqual(driver.BotUserID(
```

---

### Incident Patch 11: `2cb5eacc` (2024-04-03)
**Commit Message**: Reduce memory consumption for Kubernetes source configuration (#1425)

**File**: `cmd/botkube-agent/main.go` (modified, +1/-1)
```diff
@@ -396,7 +396,7 @@ func run(ctx context.Context) (err error) {
 	scheduler := source.NewScheduler(ctx, logger, conf, sourcePluginDispatcher, schedulerChan)
 	err = scheduler.Start(ctx)
 	if err != nil {
-		return reportFatalError("while starting source plugin event dispatcher: %w", err)
+		return reportFatalError("while starting source plugin event dispatcher", err)
 	}
 
 	if conf.Plugins.IncomingWebhook.Enabled {
```

**File**: `internal/source/dispatcher.go` (modified, +0/-2)
```diff
@@ -88,8 +88,6 @@ func NewDispatcher(log logrus.FieldLogger, clusterName string, notifiers map[str
 }
 
 // Dispatch starts a given plugin, watches for incoming events and calling all notifiers to dispatch received event.
-// Once we will have the gRPC contract established with proper Cloud Event schema, we should move also this logic here:
-// https://github.com/kubeshop/botkube/blob/525c737956ff820a09321879284037da8bf5d647/pkg/controller/controller.go#L200-L253
 func (d *Dispatcher) Dispatch(dispatch PluginDispatch) error {
 	log := d.log.WithFields(logrus.Fields{
 		"pluginName": dispatch.pluginName,
```

**File**: `internal/source/kubernetes/bg_processor.go` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+package kubernetes
+
+import (
+	"context"
+	"sync"
+	"time"
+
+	"github.com/sirupsen/logrus"
+	"golang.org/x/sync/errgroup"
+)
+
+// backgroundProcessor is responsible for running background processes.
+type backgroundProcessor struct {
+	mu          sync.RWMutex
+	cancelCtxFn func()
+	startTime   time.Time
+
+	errGroup *errgroup.Group
+}
+
+// newBackgroundProcessor creates new background processor.
+func newBackgroundProcessor() *backgroundProcessor {
+	return &backgroundProcessor{}
+}
+
+// StartTime returns the start time of the background processor.
+func (b *backgroundProcessor) StartTime() time.Time {
+	b.mu.RLock()
+	defer b.mu.RUnlock()
+	return b.startTime
+}
+
+// Run starts the background processes.
+func (b *backgroundProcessor) Run(parentCtx context.Context, fns []func(ctx context.Context)) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+
+	b.startTime = time.Now()
+	ctx, cancelFn := context.WithCancel(parentCtx)
+	b.cancelCtxFn = cancelFn
+
+	errGroup, errGroupCtx := errgroup.WithContext(ctx)
+	b.errGroup = errGroup
+
+	for _, fn := range fns {
+		fn := fn
+		errGroup.Go(func() error {
+			fn(errGroupCtx)
+			return nil
+		})
+	}
+}
+
+// StopAndWait stops the background processes and waits for them to finish.
+func (b *backgroundProcessor) StopAndWait(log logrus.FieldLogger) error {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+
+	if b.cancelCtxFn != nil {
+		log.Debug("Cancelling context of the background processor...")
+		b.cancelCtxFn()
+	}
+
+	if b.errGroup == nil {
+		return nil
+	}
+
+	log.Debug("Waiting for background processor to finish...")
+	return b.errGroup.Wait()
+}
```

**File**: `internal/source/kubernetes/configuration_store.go` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package kubernetes
+
+import (
+	"fmt"
+	"sync"
+
+	"github.com/kubeshop/botkube/pkg/maputil"
+)
+
+// configurationStore stores all source configurations in a thread-safe way.
+type configurationStore struct {
+	store             map[string]SourceConfig
+	storeByKubeconfig map[string]map[string]struct{}
+
+	lock sync.RWMutex
+}
+
+// newConfigurations creates new empty configurationStore instance.
+func newConfigurations() *configurationStore {
+	return &configurationStore{
+		store:             make(map[string]SourceConfig),
+		storeByKubeconfig: make(map[string]map[string]struct{}),
+	}
+}
+
+// Store stores SourceConfig in a thread-safe way.
+func (c *configurationStore) Store(sourceName string, cfg SourceConfig) {
+	c.lock.Lock()
+	defer c.lock.Unlock()
+
+	key := c.keyForStore(sourceName, cfg.isInteractivitySupported)
+
+	c.store[key] = cfg
+
+	kubeConfigKey := string(cfg.kubeConfig)
+	if _, ok := c.storeByKubeconfig[kubeConfigKey]; !ok {
+		c.storeByKubeconfig[kubeConfigKey] = make(map[string]struct{})
+	}
+	c.storeByKubeconfig[kubeConfigKey][key] = struct{}{}
+}
+
+// Get returns SourceConfig by a key.
+func (c *configurationStore) Get(sourceKey string) (SourceConfig, bool) {
+	c.lock.RLock()
+	defer c.lock.RUnlock()
+	val, ok := c.store[sourceKey]
+	return val, ok
+}
+
+// GetSystemConfig returns system Source Config.
+// The system config is used for getting system (plugin-wide) logger and informer resync period.
+func (c *configurationStore) GetSystemConfig() (SourceConfig, bool) {
+	c.lock.RLock()
+	defer c.lock.RUnlock()
+
+	sortedKeys := maputil.SortKeys(c.store)
+	if len(sortedKeys) == 0 {
+		return SourceConfig{}, false
+	}
+
+	return c.store[sortedKeys[0]], true
+}
+
+// Len returns number of stored SourceConfigs.
+func (c *configurationStore) Len() int {
+	c.lock.RLock()
+	defer c.lock.RUnlock()
+	return len(c.store)
+}
+
+// CloneByKubeconfig returns a copy of the underlying map of source configurations grouped by kubeconfigs.
+func (c *configurationStore) CloneByKubeconfig() map[string]map[string]SourceConfig {
+	c.lock.RLock()
+	defer c.lock.RUnlock()
+
+	var out = make(map[string]map[string]SourceConfig)
+	for kubeConfig, srcIndex := range c.storeByKubeconfig {
+		if out[kubeConfig] == nil {
+			out[kubeConfig] = make(map[string]SourceConfig)
+		}
+
+		for srcKey := range srcIndex {
+			out[kubeConfig][srcKey] = c.store[srcKey]
+		}
+	}
+
+	return out
+}
+
+// keyForStore returns a key for storing configuration in the store.
+func (c *configurationStore) keyForStore(sourceName string, isInteractivitySupported bool) string {
+	return fmt.Sprintf("%s/%t", sourceName, isInteractivitySupported)
+}
```

**File**: `internal/source/kubernetes/filterengine/filterengine.go` (modified, +1/-2)
```diff
@@ -50,7 +50,6 @@ func New(log logrus.FieldLogger) *DefaultFilterEngine {
 func (f *DefaultFilterEngine) Run(ctx context.Context, event event.Event) event.Event {
 	f.log.Debug("Running registered filters")
 	filters := f.RegisteredFilters()
-	f.log.Debugf("registered filters: %+v", filters)
 
 	for _, filter := range filters {
 		if !filter.Enabled {
@@ -59,7 +58,7 @@ func (f *DefaultFilterEngine) Run(ctx context.Context, event event.Event) event.
 
 		err := filter.Run(ctx, &event)
 		if err != nil {
-			f.log.Errorf("while running filter %q: %w", filter.Name(), err)
+			f.log.Errorf("while running filter %q: %s", filter.Name(), err.Error())
 		}
 		f.log.Debugf("ran filter name: %q, event was skipped: %t", filter.Name(), event.Skip)
 	}
```

**File**: `internal/source/kubernetes/registration.go` (modified, +59/-52)
```diff
@@ -31,7 +31,7 @@ type registration struct {
 	mappedEvent     config.EventType
 }
 
-func (r registration) handleEvent(ctx context.Context, s Source, resource string, eventType config.EventType, routes []route, fn eventHandler) {
+func (r registration) handleEvent(ctx context.Context, resource string, eventType config.EventType, routes []route, fn eventHandler) {
 	handleFunc := func(oldObj, newObj interface{}) {
 		logger := r.log.WithFields(logrus.Fields{
 			"eventHandler": eventType,
@@ -45,15 +45,15 @@ func (r registration) handleEvent(ctx context.Context, s Source, resource string
 			return
 		}
 
-		ok, diffs, err := r.qualifyEvent(event, newObj, oldObj, routes)
+		sources, diffs, err := r.qualifyEvent(event, newObj, oldObj, routes)
 		if err != nil {
 			logger.Errorf("while getting sources for event: %s", err.Error())
 			// continue anyway, there could be still some sources to handle
 		}
-		if !ok {
+		if len(sources) == 0 {
 			return
 		}
-		fn(ctx, s, event, diffs)
+		fn(ctx, event, sources, diffs)
 	}
 
 	var resourceEventHandlerFuncs cache.ResourceEventHandlerFuncs
@@ -69,7 +69,7 @@ func (r registration) handleEvent(ctx context.Context, s Source, resource string
 	_, _ = r.informer.AddEventHandler(resourceEventHandlerFuncs)
 }
 
-func (r registration) handleMapped(ctx context.Context, s Source, eventType config.EventType, routeTable map[string][]entry, fn eventHandler) {
+func (r registration) handleMapped(ctx context.Context, eventType config.EventType, routeTable map[string][]entry, fn eventHandler) {
 	_, _ = r.informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
 		AddFunc: func(obj interface{}) {
 			var eventObj coreV1.Event
@@ -107,15 +107,15 @@ func (r registration) handleMapped(ctx context.Context, s Source, eventType conf
 			}
 
 			routes := eventRoutes(routeTable, gvrString, eventType)
-			ok, err := r.matchEvent(routes, event)
+			sources, err := r.matchEvent(routes, event)
 			if err != nil {
 				r.log.Errorf("cannot calculate event for observed mapped resource event: %q in Add event handler: %s", eventType, err.Error())
 				// continue anyway, there could be still some sources to handle
 			}
-			if !ok {
+			if len(sources) == 0 {
 				return
 			}
-			fn(ctx, s, event, nil)
+			fn(ctx, event, sources, nil)
 		},
 	})
 }
@@ -138,18 +138,21 @@ func (r registration) includesSrcResource(resource string) bool {
 	return false
 }
 
-func (r registration) matchEvent(routes []route, event event.Event) (bool, error) {
+func (r registration) matchEvent(routes []route, event event.Event) ([]string, error) {
+	var out []string
+
 	errs := multierror.New()
 	for _, rt := range routes {
 		// event reason
 		if rt.Event != nil && rt.Event.Reason.AreConstraintsDefined() {
 			match, err := rt.Event.Reason.IsAllowed(event.Reason)
 			if err != nil {
-				return false, err
+				errs = multierror.Append(errs, err)
+				continue
 			}
 			if !match {
 				r.log.Debugf("Ignoring as reason %q doesn't match constraints %+v", event.Reason, rt.Event.Reason)
-				return false, nil
+				continue
 			}
 		}
 
@@ -166,7 +169,8 @@ func (r registration) matchEvent(routes []route, event event.Event) (bool, error
 			for _, msg := range eventMsgs {
 				match, err := rt.Event.Message.IsAllowed(msg)
 				if err != nil {
-					return false, err
+					errs = multierror.Append(errs, err)
+					continue
 				}
 				if match {
 					anyMsgMatches = true
@@ -175,31 +179,33 @@ func (r registration) matchEvent(routes []route, event event.Event) (bool, error
 			}
 			if !anyMsgMatches {
 				r.log.Debugf("Ignoring as any event message from %q doesn't match constraints %+v", strings.Join(event.Messages, ";"), rt.Event.Message)
-				return false, nil
+				continue
 			}
 		}
 
 		// resource name
 		if rt.ResourceName.AreConstraintsDefined() {
 			allowed, err := rt.ResourceName.IsAllowed(event.Name)
 			if err != nil {
-				return false, err
+				errs = multierror.Append(errs, err)
+				continue
 			}
 			if !allowed {
 				r.log.Debugf("Ignoring as resource name %q doesn't match constraints %+v", event.Name, rt.ResourceName)
-				return false, nil
+				continue
 			}
 		}
 
 		// namespace
 		if rt.Namespaces != nil && rt.Namespaces.AreConstraintsDefined() {
 			match, err := rt.Namespaces.IsAllowed(event.Namespace)
 			if err != nil {
-				return false, err
+				errs = multierror.Append(errs, err)
+				continue
 			}
 			if !match {
 				r.log.Debugf("Ignoring as namespace %q doesn't match constraints %+v", event.Namespace, rt.Namespaces)
-				return false, nil
+				continue
 			}
 		}
 
@@ -212,10 +218,11 @@ func (r registration) matchEvent(routes []route, event event.Event) (bool, error
 		if !kvsSatisfiedForMap(rt.Labels, event.ObjectMeta.Labels) {
 			continue
 		}
-		return true, nil
+
+		out = append(out, rt.Source)
 	}
 
-	return false, errs.ErrorOrNil()
+	return out, errs.ErrorOrNil()
 }
 
 func kvsSatisfiedForMap(expectedKV *map[string]string, obj map[string]string) bool {
@@ -259,26 +266,24 @@ 
```

**File**: `internal/source/kubernetes/router.go` (modified, +61/-48)
```diff
@@ -11,15 +11,18 @@ import (
 	"github.com/kubeshop/botkube/internal/source/kubernetes/config"
 	"github.com/kubeshop/botkube/internal/source/kubernetes/event"
 	"github.com/kubeshop/botkube/internal/source/kubernetes/recommendation"
+	"github.com/kubeshop/botkube/pkg/formatx"
 )
 
 const eventsResource = "v1/events"
 
 type mergedEvents map[string]map[config.EventType]struct{}
 type registrationHandler func(resource string) (cache.SharedIndexInformer, error)
-type eventHandler func(ctx context.Context, source Source, event event.Event, updateDiffs []string)
+type eventHandler func(ctx context.Context, event event.Event, sources []string, updateDiffs []string)
 
 type route struct {
+	Source string
+
 	ResourceName  config.RegexConstraints
 	Labels        *map[string]string
 	Annotations   *map[string]string
@@ -60,16 +63,15 @@ func NewRouter(mapper meta.RESTMapper, dynamicCli dynamic.Interface, log logrus.
 
 // BuildTable builds the routers routing table marking it ready
 // to register, map and handle informer events.
-func (r *Router) BuildTable(cfg *config.Config) *Router {
-	mergedEvents := mergeResourceEvents(cfg)
-
+func (r *Router) BuildTable(cfgs map[string]SourceConfig) *Router {
+	mergedEvents := mergeResourceEvents(cfgs)
 	for resource, resourceEvents := range mergedEvents {
-		eventRoutes := r.mergeEventRoutes(resource, cfg)
+		eventRoutes := r.mergeEventRoutes(resource, cfgs)
 		for evt := range resourceEvents {
 			r.table[resource] = append(r.table[resource], entry{Event: evt, Routes: eventRoutes[evt]})
 		}
 	}
-	r.log.Debugf("routing table: %+v", r.table)
+	r.log.Debug("routing table:", formatx.StructDumper().Sdump(r.table))
 	return r
 }
 
@@ -123,21 +125,21 @@ func (r *Router) MapWithEventsInformer(srcEvent config.EventType, dstEvent confi
 
 // RegisterEventHandler allows router clients to create handlers that are
 // triggered for a target event.
-func (r *Router) RegisterEventHandler(ctx context.Context, s Source, eventType config.EventType, handlerFn func(ctx context.Context, s Source, e event.Event, updateDiffs []string)) {
+func (r *Router) RegisterEventHandler(ctx context.Context, eventType config.EventType, handlerFn eventHandler) {
 	for resource, reg := range r.registrations {
 		if !reg.canHandleEvent(eventType.String()) {
 			continue
 		}
 		sourceRoutes := r.getSourceRoutes(resource, eventType)
-		reg.handleEvent(ctx, s, resource, eventType, sourceRoutes, handlerFn)
+		reg.handleEvent(ctx, resource, eventType, sourceRoutes, handlerFn)
 	}
 }
 
 // HandleMappedEvent allows router clients to create handlers that are
 // triggered for a target mapped event.
-func (r *Router) HandleMappedEvent(ctx context.Context, s Source, targetEvent config.EventType, handlerFn eventHandler) {
+func (r *Router) HandleMappedEvent(ctx context.Context, targetEvent config.EventType, handlerFn eventHandler) {
 	if informer, ok := r.mappedInformer(targetEvent); ok {
-		informer.handleMapped(ctx, s, targetEvent, r.table, handlerFn)
+		informer.handleMapped(ctx, targetEvent, r.table, handlerFn)
 	}
 }
 
@@ -146,61 +148,67 @@ func (r *Router) getSourceRoutes(resource string, targetEvent config.EventType)
 	return eventRoutes(r.table, resource, targetEvent)
 }
 
-func mergeResourceEvents(cfg *config.Config) mergedEvents {
+func mergeResourceEvents(cfgs map[string]SourceConfig) mergedEvents {
 	out := map[string]map[config.EventType]struct{}{}
-	for _, resource := range cfg.Resources {
-		if _, ok := out[resource.Type]; !ok {
-			out[resource.Type] = make(map[config.EventType]struct{})
-		}
-		for _, e := range flattenEventTypes(cfg.Event.Types, resource.Event.Types) {
-			out[resource.Type][e] = struct{}{}
+	for _, srcGroupCfg := range cfgs {
+		cfg := srcGroupCfg.cfg
+		for _, resource := range cfg.Resources {
+			if _, ok := out[resource.Type]; !ok {
+				out[resource.Type] = make(map[config.EventType]struct{})
+			}
+			for _, e := range flattenEventTypes(cfg.Event.Types, resource.Event.Types) {
+				out[resource.Type][e] = struct{}{}
+			}
 		}
-	}
 
-	resForRecomms := recommendation.ResourceEventsForConfig(cfg.Recommendations)
-	for resourceType, eventType := range resForRecomms {
-		if _, ok := out[resourceType]; !ok {
-			out[resourceType] = make(map[config.EventType]struct{})
+		resForRecomms := recommendation.ResourceEventsForConfig(cfg.Recommendations)
+		for resourceType, eventType := range resForRecomms {
+			if _, ok := out[resourceType]; !ok {
+				out[resourceType] = make(map[config.EventType]struct{})
+			}
+			out[resourceType][eventType] = struct{}{}
 		}
-		out[resourceType][eventType] = struct{}{}
 	}
 	return out
 }
 
-func (r *Router) mergeEventRoutes(resource string, cfg *config.Config) map[config.EventType][]route {
+func (r *Router) mergeEventRoutes(resource string, cfgs map[string]SourceConfig) map[config.EventType][]route {
 	out := make(map[config.EventType][]route)
-	for idx := range cfg.Resources {
-		r := cfg.Resources[idx] // make sure that we work on a copy
-		for _, e
```

**File**: `internal/source/kubernetes/router_test.go` (modified, +34/-23)
```diff
@@ -21,35 +21,39 @@ func TestRouter_BuildTable_CreatesRoutesWithProperEventsList(t *testing.T) {
 
 	tests := []struct {
 		name     string
-		givenCfg config.Config
+		givenCfg map[string]SourceConfig
 	}{
 		{
 			name: "Events defined on top-level but override by resource once",
-			givenCfg: config.Config{
-
-				Event: &config.KubernetesEvent{
-					Types: []config.EventType{
-						config.CreateEvent,
-						config.ErrorEvent,
-					},
-				},
-				Resources: []config.Resource{
-					{
-						Type: hasRoutes,
-						Namespaces: config.RegexConstraints{
-							Include: []string{"default"},
-						},
-						Event: config.KubernetesEvent{
+			givenCfg: map[string]SourceConfig{
+				"k8s-events": {
+					name: "k8s-events",
+					cfg: config.Config{
+						Event: &config.KubernetesEvent{
 							Types: []config.EventType{
 								config.CreateEvent,
-								config.DeleteEvent,
-								config.UpdateEvent,
 								config.ErrorEvent,
 							},
 						},
-						UpdateSetting: config.UpdateSetting{
-							Fields:      []string{"status.availableReplicas"},
-							IncludeDiff: true,
+						Resources: []config.Resource{
+							{
+								Type: hasRoutes,
+								Namespaces: config.RegexConstraints{
+									Include: []string{"default"},
+								},
+								Event: config.KubernetesEvent{
+									Types: []config.EventType{
+										config.CreateEvent,
+										config.DeleteEvent,
+										config.UpdateEvent,
+										config.ErrorEvent,
+									},
+								},
+								UpdateSetting: config.UpdateSetting{
+									Fields:      []string{"status.availableReplicas"},
+									IncludeDiff: true,
+								},
+							},
 						},
 					},
 				},
@@ -61,7 +65,7 @@ func TestRouter_BuildTable_CreatesRoutesWithProperEventsList(t *testing.T) {
 		t.Run(tc.name, func(t *testing.T) {
 			router := NewRouter(nil, nil, loggerx.NewNoop())
 
-			router = router.BuildTable(&tc.givenCfg)
+			router = router.BuildTable(tc.givenCfg)
 			assert.Len(t, router.getSourceRoutes(hasRoutes, config.CreateEvent), 1)
 			assert.Len(t, router.getSourceRoutes(hasRoutes, config.UpdateEvent), 1)
 			assert.Len(t, router.getSourceRoutes(hasRoutes, config.DeleteEvent), 1)
@@ -81,8 +85,15 @@ func TestRouterListMergingNestedFields(t *testing.T) {
 	err = yaml.Unmarshal(fixConfig, &cfg)
 	require.NoError(t, err)
 
+	srcCfgs := map[string]SourceConfig{
+		"test": {
+			name: "test",
+			cfg:  cfg,
+		},
+	}
+
 	// when
-	router = router.BuildTable(&cfg)
+	router = router.BuildTable(srcCfgs)
 
 	// then
 	for key := range router.table {
```

---

### Incident Patch 12: `97f6bf84` (2024-03-11)
**Commit Message**: Fix sending file messages in Cloud Slack (#1412)

**File**: `pkg/bot/slack_cloud.go` (modified, +24/-11)
```diff
@@ -417,9 +417,8 @@ func (b *CloudSlack) SendMessage(ctx context.Context, msg interactive.CoreMessag
 	errs := multierror.New()
 	for _, channelName := range b.getChannelsToNotify(sourceBindings) {
 		msgMetadata := slackMessage{
-			Channel:         channelName,
-			ThreadTimeStamp: "",
-			BlockID:         uuid.New().String(),
+			Channel: channelName,
+			BlockID: uuid.New().String(),
 		}
 		err := b.send(ctx, msgMetadata, msg)
 		if err != nil {
@@ -540,11 +539,15 @@ func (b *CloudSlack) handleMessage(ctx context.Context, event slackMessage) erro
 func (b *CloudSlack) send(ctx context.Context, event slackMessage, resp interactive.CoreMessage) error {
 	b.log.Debugf("Sending message to channel %q: %+v", event.Channel, resp)
 
+	if resp.IsEmpty() { // don't send empty messages
+		return nil
+	}
+
 	resp.ReplaceBotNamePlaceholder(b.BotName(), api.BotNameWithClusterName(b.clusterName))
 	markdown := b.renderer.MessageToMarkdown(resp)
 
 	if len(markdown) == 0 {
-		return errors.New("while reading Slack response: empty response")
+		return errors.New("got empty message while converting executor response to Markdown")
 	}
 
 	// Upload message as a file if too long
@@ -555,6 +558,11 @@ func (b *CloudSlack) send(ctx context.Context, event slackMessage, resp interact
 		if err != nil {
 			return err
 		}
+		// the main message body was sent as a file, the only think that left is the filter input (if any)
+		if len(resp.PlaintextInputs) == 0 {
+			return nil
+		}
+
 		resp = interactive.CoreMessage{
 			Message: api.Message{
 				PlaintextInputs: resp.PlaintextInputs,
@@ -608,7 +616,7 @@ func (b *CloudSlack) uploadFileToSlack(ctx context.Context, event slackMessage,
 		InitialComment:  resp.Description,
 		Content:         interactive.MessageToPlaintext(resp, interactive.NewlineFormatter),
 		Channels:        []string{event.Channel},
-		ThreadTimestamp: event.GetTimestamp(),
+		ThreadTimestamp: b.resolveMessageTimestamp(resp, event),
 	}
 
 	file, err := b.client.UploadFileContext(ctx, params)
@@ -646,18 +654,23 @@ func (b *CloudSlack) getThreadOptionIfNeeded(resp interactive.CoreMessage, event
 			}
 		}
 	}
-
-	if resp.ParentActivityID != "" {
-		return slack.MsgOptionTS(resp.Message.ParentActivityID)
-	}
-
-	if ts := event.GetTimestamp(); ts != "" {
+	if ts := b.resolveMessageTimestamp(resp, event); ts != "" {
 		return slack.MsgOptionTS(ts)
 	}
 
 	return nil
 }
 
+func (b *CloudSlack) resolveMessageTimestamp(resp interactive.CoreMessage, event slackMessage) string {
+	// If the message is coming e.g. from source, it may already belong to a given thread
+	if resp.ParentActivityID != "" {
+		return resp.Message.ParentActivityID
+	}
+
+	// otherwise, we use the event timestamp to respond in the thread to the message that triggered our response
+	return event.GetTimestamp()
+}
+
 // NotificationsEnabled returns current notification status for a given channel name.
 func (b *CloudSlack) NotificationsEnabled(channelName string) bool {
 	channel, exists := b.getChannels()[channelName]
```

---

### Incident Patch 13: `027883f1` (2024-03-07)
**Commit Message**: Fix Helm chart upgrade when `lookup` is not supported (#1408)

**File**: `helm/botkube/templates/persistent-config.yaml` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 {{- if not (include "botkube.remoteConfigEnabled" $) }}
 {{- $runtimeStateCfgMap := .Values.settings.persistentConfig.runtime.configMap.name -}}
-{{- $communications := .Values.communications }}
+{{- $communications := .Values.communications | default dict }}
 {{- if .Values.existingCommunicationsSecretName }}
   {{- $secret := lookup "v1" "Secret" .Release.Namespace .Values.existingCommunicationsSecretName | default dict  }}
   {{- $secretData := $secret.data | default dict -}}
   {{- $data := b64dec (index $secretData "comm_config.yaml" | default "") -}}
-  {{- $dataYaml := $data | fromYaml -}}
-  {{- $communications =  $dataYaml.communications }}
+  {{- $dataYaml := $data | fromYaml | default dict -}}
+  {{- $communications =  $dataYaml.communications | default dict }}
 {{- end }}
 apiVersion: v1
 kind: ConfigMap
@@ -24,7 +24,7 @@ metadata:
     botkube.io/config-watch: "true"
 data:
   {{- $prevRuntimeCfgMap := lookup "v1" "ConfigMap" .Release.Namespace $runtimeStateCfgMap | default dict }}
-  {{- $prevRuntimeFile := index ( $prevRuntimeCfgMap.data | default dict ) .Values.settings.persistentConfig.runtime.fileName | default "" | fromYaml -}}
+  {{- $prevRuntimeFile := index ( $prevRuntimeCfgMap.data | default dict ) .Values.settings.persistentConfig.runtime.fileName | default "" | fromYaml | default dict -}}
   {{- $mergedRuntimeCommunications := mustMergeOverwrite (mustDeepCopy (default (dict) $prevRuntimeFile.communications )) (mustDeepCopy $communications) }}
   {{- $mergedRuntimeAction := mustMergeOverwrite (mustDeepCopy (default (dict) $prevRuntimeFile.actions )) (mustDeepCopy .Values.actions) }}
   # This file has a special prefix to load it as the last config file during Botkube startup.
@@ -75,7 +75,7 @@ metadata:
     botkube.io/config-watch: "false" # Explicitly don't watch this ConfigMap
 data:
   {{- $prevStartupCfgMap := lookup "v1" "ConfigMap" .Release.Namespace $startupStateCfgMap | default dict }}
-  {{- $prevStartupFile := index ( $prevStartupCfgMap.data | default dict ) .Values.settings.persistentConfig.startup.fileName | default "" | fromYaml -}}
+  {{- $prevStartupFile := index ( $prevStartupCfgMap.data | default dict ) .Values.settings.persistentConfig.startup.fileName | default "" | fromYaml | default dict -}}
   {{- $mergedStartupCommunications := mustMergeOverwrite (mustDeepCopy (default (dict) $prevStartupFile.communications )) (mustDeepCopy .Values.communications) }}
   # This file has a special prefix to load it as the last config file during Botkube startup.
   {{ .Values.settings.persistentConfig.startup.fileName }}: |
```

---

### Incident Patch 14: `ced876da` (2024-02-27)
**Commit Message**: Fix overwriting custom RBAC config and Kubernetes plugin JSON schema (#1401)

- Fix overwriting custom RBAC config
- Fix Kubernetes extraButtons schema
- Remove unused properties

**File**: `helm/botkube/README.md` (modified, +60/-61)
```diff
@@ -162,67 +162,66 @@ Controller for the Botkube Slack app which helps you monitor your Kubernetes clu
 | [communications.default-group.webhook.enabled](./values.yaml#L660) | bool | `false` | If true, enables Webhook. |
 | [communications.default-group.webhook.url](./values.yaml#L662) | string | `"WEBHOOK_URL"` | The Webhook URL, e.g.: https://example.com:80 |
 | [communications.default-group.webhook.bindings.sources](./values.yaml#L665) | list | `["k8s-err-events","k8s-recommendation-events"]` | Notification sources configuration for the webhook. |
-| [communications.default-group.slack](./values.yaml#L675) | object | See the `values.yaml` file for full object. | Settings for deprecated Slack integration. **DEPRECATED:** Legacy Slack integration has been deprecated and removed from the Slack App Directory. Use `socketSlack` instead. Read more here: https://docs.botkube.io/installation/slack/   |
-| [settings.clusterName](./values.yaml#L693) | string | `"not-configured"` | Cluster name to differentiate incoming messages. |
-| [settings.healthPort](./values.yaml#L696) | int | `2114` | Health check port. |
-| [settings.upgradeNotifier](./values.yaml#L698) | bool | `true` | If true, notifies about new Botkube releases. |
-| [settings.log.level](./values.yaml#L702) | string | `"info"` | Sets one of the log levels. Allowed values: `info`, `warn`, `debug`, `error`, `fatal`, `panic`. |
-| [settings.log.disableColors](./values.yaml#L704) | bool | `false` | If true, disable ANSI colors in logging. Ignored when `json` formatter is used. |
-| [settings.log.formatter](./values.yaml#L706) | string | `"json"` | Configures log format. Allowed values: `text`, `json`. |
-| [settings.systemConfigMap](./values.yaml#L709) | object | `{"name":"botkube-system"}` | Botkube's system ConfigMap where internal data is stored. |
-| [settings.persistentConfig](./values.yaml#L714) | object | `{"runtime":{"configMap":{"annotations":{},"name":"botkube-runtime-config"},"fileName":"_runtime_state.yaml"},"startup":{"configMap":{"annotations":{},"name":"botkube-startup-config"},"fileName":"_startup_state.yaml"}}` | Persistent config contains ConfigMap where persisted configuration is stored. The persistent configuration is evaluated from both chart upgrade and Botkube commands used in runtime. |
-| [ssl.enabled](./values.yaml#L729) | bool | `false` | If true, specify cert path in `config.ssl.cert` property or K8s Secret in `config.ssl.existingSecretName`. |
-| [ssl.existingSecretName](./values.yaml#L735) | string | `""` | Using existing SSL Secret. It MUST be in `botkube` Namespace.  |
-| [ssl.cert](./values.yaml#L738) | string | `""` | SSL Certificate file e.g certs/my-cert.crt. |
-| [service](./values.yaml#L741) | object | `{"name":"metrics","port":2112,"targetPort":2112}` | Configures Service settings for ServiceMonitor CR. |
-| [serviceMonitor](./values.yaml#L748) | object | `{"enabled":false,"interval":"10s","labels":{},"path":"/metrics","port":"metrics"}` | Configures ServiceMonitor settings. [Ref doc](https://github.com/coreos/prometheus-operator/blob/master/Documentation/api.md#servicemonitor). |
-| [deployment.annotations](./values.yaml#L758) | object | `{}` | Extra annotations to pass to the Botkube Deployment. |
-| [deployment.livenessProbe](./values.yaml#L760) | object | `{"failureThreshold":35,"initialDelaySeconds":1,"periodSeconds":2,"successThreshold":1,"timeoutSeconds":1}` | Liveness probe. |
-| [deployment.livenessProbe.initialDelaySeconds](./values.yaml#L762) | int | `1` | The liveness probe initial delay seconds. |
-| [deployment.livenessProbe.periodSeconds](./values.yaml#L764) | int | `2` | The liveness probe period seconds. |
-| [deployment.livenessProbe.timeoutSeconds](./values.yaml#L766) | int | `1` | The liveness probe timeout seconds. |
-| [deployment.livenessProbe.failureThreshold](./values.yaml#L768) | int | `35` | The liveness probe failure threshold. |
-| [deployment.livenessProbe.successThreshold](./values.yaml#L770) | int | `1` | The liveness probe success threshold. |
-| [deployment.readinessProbe](./values.yaml#L773) | object | `{"failureThreshold":35,"initialDelaySeconds":1,"periodSeconds":2,"successThreshold":1,"timeoutSeconds":1}` | Readiness probe. |
-| [deployment.readinessProbe.initialDelaySeconds](./values.yaml#L775) | int | `1` | The readiness probe initial delay seconds. |
-| [deployment.readinessProbe.periodSeconds](./values.yaml#L777) | int | `2` | The readiness probe period seconds. |
-| [deployment.readinessProbe.timeoutSeconds](./values.yaml#L779) | int | `1` | The readiness probe timeout seconds. |
-| [deployment.readinessProbe.failureThreshold](./values.yaml#L781) | int | `35` | The readiness probe failure threshold. |
-| [deployment.readinessProbe.successThreshold](./values.yaml#L783) | int | `1` | The readiness probe success threshold. |
-| [extraAnnotations](./values.yaml#L790) | object | `{}` | Extra annotations to pass to the Botkube Pod. |
-| [extraLabels](./values.yaml#L792) | object | `
```

**File**: `helm/botkube/values.yaml` (modified, +0/-21)
```diff
@@ -666,27 +666,6 @@ communications:
           - k8s-err-events
           - k8s-recommendation-events
 
-    # -- Settings for deprecated Slack integration.
-    # **DEPRECATED:** Legacy Slack integration has been deprecated and removed from the Slack App Directory.
-    # Use `socketSlack` instead. Read more here: https://docs.botkube.io/installation/slack/
-    #
-    # @default -- See the `values.yaml` file for full object.
-    ## This object will be removed as a part of https://github.com/kubeshop/botkube/issues/865.
-    slack:
-      enabled: false
-      channels:
-        'default':
-          name: 'SLACK_CHANNEL'
-          notification:
-            disabled: false
-          bindings:
-            executors:
-              - k8s-default-tools
-            sources:
-              - k8s-err-events
-              - k8s-recommendation-events
-      token: ''
-
 ## Global Botkube configuration.
 settings:
   # -- Cluster name to differentiate incoming messages.
```

**File**: `internal/analytics/segment_reporter.go` (modified, +19/-7)
```diff
@@ -382,14 +382,26 @@ func (r *SegmentReporter) getAnonymizedRBAC(rbac *config.PolicyRule) *config.Pol
 		return nil
 	}
 
-	rbac.Group.Prefix = r.anonymizedValue(rbac.Group.Prefix)
-	for key, name := range rbac.Group.Static.Values {
-		rbac.Group.Static.Values[key] = r.anonymizedValue(name)
+	var anonymizedGroupValues []string
+	for _, name := range rbac.Group.Static.Values {
+		anonymizedGroupValues = append(anonymizedGroupValues, r.anonymizedValue(name))
+	}
+	return &config.PolicyRule{
+		User: config.UserPolicySubject{
+			Type: rbac.User.Type,
+			Static: config.UserStaticSubject{
+				Value: r.anonymizedValue(rbac.User.Static.Value),
+			},
+			Prefix: r.anonymizedValue(rbac.User.Prefix),
+		},
+		Group: config.GroupPolicySubject{
+			Type: rbac.Group.Type,
+			Static: config.GroupStaticSubject{
+				Values: anonymizedGroupValues,
+			},
+			Prefix: r.anonymizedValue(rbac.Group.Prefix),
+		},
 	}
-
-	rbac.User.Prefix = r.anonymizedValue(rbac.User.Prefix)
-	rbac.User.Static.Value = r.anonymizedValue(rbac.User.Static.Value)
-	return rbac
 }
 
 func (r *SegmentReporter) anonymizedValue(value string) string {
```

**File**: `internal/analytics/segment_reporter_test.go` (modified, +34/-7)
```diff
@@ -153,11 +153,7 @@ func TestSegmentReporter_ReportBotEnabled(t *testing.T) {
 
 func TestSegmentReporter_ReportPluginsEnabled(t *testing.T) {
 	// given
-	identity := fixIdentity()
-	segmentReporter, segmentCli := fakeSegmentReporterWithIdentity(identity)
-
-	// when
-	err := segmentReporter.ReportPluginsEnabled(map[string]config.Executors{
+	executors := map[string]config.Executors{
 		"botkube/helm_11yy1": {
 			DisplayName: "helm",
 			Plugins: map[string]config.Plugin{
@@ -227,7 +223,8 @@ func TestSegmentReporter_ReportPluginsEnabled(t *testing.T) {
 				},
 			},
 		},
-	}, map[string]config.Sources{
+	}
+	sources := map[string]config.Sources{
 		"botkube/kubernetes_22yy2": {
 			DisplayName: "k8s",
 			Plugins: map[string]config.Plugin{
@@ -294,11 +291,27 @@ func TestSegmentReporter_ReportPluginsEnabled(t *testing.T) {
 				},
 			},
 		},
-	})
+	}
+
+	executors2, err := deepClone[map[string]config.Executors](executors)
+	require.NoError(t, err)
+
+	sources2, err := deepClone[map[string]config.Sources](sources)
+	require.NoError(t, err)
+
+	identity := fixIdentity()
+	segmentReporter, segmentCli := fakeSegmentReporterWithIdentity(identity)
+
+	// when
+	err = segmentReporter.ReportPluginsEnabled(executors, sources)
 	require.NoError(t, err)
 
 	// then
 	compareMessagesAgainstGoldenFile(t, segmentCli.messages)
+
+	// ensure the report doesn't modify the original maps
+	assert.Equal(t, executors2, executors)
+	assert.Equal(t, sources2, sources)
 }
 
 func TestSegmentReporter_ReportSinkEnabled(t *testing.T) {
@@ -458,3 +471,17 @@ func fixIdentity() *analytics.Identity {
 		ControlPlaneNodeCount: 0,
 	}
 }
+
+func deepClone[T any](in any) (any, error) {
+	origJSON, err := json.Marshal(in)
+	if err != nil {
+		return nil, err
+	}
+
+	var out T
+	if err = json.Unmarshal(origJSON, &out); err != nil {
+		return nil, err
+	}
+
+	return out, nil
+}
```

**File**: `internal/analytics/testdata/TestSegmentReporter_ReportPluginsEnabled.json` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
 					"Group": {
 						"Type": "ChannelName",
 						"Static": {
-							"Values": []
+							"Values": null
 						},
 						"Prefix": "***"
 					}
```

**File**: `internal/executor/kubectl/executor.go` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ func NewExecutor(ver string, kcRunner kcRunner) *Executor {
 	}
 }
 
-// Metadata returns details about Helm plugin.
+// Metadata returns details about Kubectl plugin.
 func (e *Executor) Metadata(context.Context) (api.MetadataOutput, error) {
 	return api.MetadataOutput{
 		Version:          e.pluginVersion,
```

**File**: `internal/source/kubernetes/config_schema.json` (modified, +40/-38)
```diff
@@ -703,46 +703,48 @@
     "extraButtons": {
       "title": "Extra Buttons",
       "description": "Extra buttons for actionable items.",
-      "type": "object",
-      "properties": {
-        "enabled": {
-          "type": "boolean",
-          "default": false,
-          "description": "If enabled, renders extra button.",
-          "title": "Enable extra button"
-        },
-        "trigger": {
-          "title": "Trigger",
-          "description": "Define log level for the plugin. Ensure that Botkube has plugin logging enabled for standard output.",
-          "type": "object",
-          "additionalProperties": false,
-          "properties": {
-            "type": {
-              "title": "Event types",
-              "description": "Event types which will trigger this action",
-              "type": "array",
-              "items": {
-                "type": "string",
-                "title": "Event type"
+      "type": "array",
+      "items": {
+        "properties": {
+          "enabled": {
+            "type": "boolean",
+            "default": false,
+            "description": "If enabled, renders extra button.",
+            "title": "Enable extra button"
+          },
+          "trigger": {
+            "title": "Trigger",
+            "description": "Define log level for the plugin. Ensure that Botkube has plugin logging enabled for standard output.",
+            "type": "object",
+            "additionalProperties": false,
+            "properties": {
+              "type": {
+                "title": "Event types",
+                "description": "Event types which will trigger this action",
+                "type": "array",
+                "items": {
+                  "type": "string",
+                  "title": "Event type"
+                }
               }
             }
-          }
-        },
-        "button": {
-          "title": "Button",
-          "description": "Button settings for showing after each matched events.",
-          "type": "object",
-          "additionalProperties": false,
-          "properties": {
-            "commandTpl": {
-              "title": "Command template",
-              "description": "Command template that can be used to generate actual command.",
-              "type": "string"
-            },
-            "displayName": {
-              "title": "Display name",
-              "description": "Display name of this command.",
-              "type": "string"
+          },
+          "button": {
+            "title": "Button",
+            "description": "Button settings for showing after each matched events.",
+            "type": "object",
+            "additionalProperties": false,
+            "properties": {
+              "commandTpl": {
+                "title": "Command template",
+                "description": "Command template that can be used to generate actual command.",
+                "type": "string"
+              },
+              "displayName": {
+                "title": "Display name",
+                "description": "Display name of this command.",
+                "type": "string"
+              }
             }
           }
         }
```

---

### Incident Patch 15: `a744a14f` (2024-02-23)
**Commit Message**: Fix executor assertion for integration tests (#1397)

Fix executor assertion

**File**: `test/e2e/bots_test.go` (modified, +4/-4)
```diff
@@ -1256,10 +1256,10 @@ func runBotTest(t *testing.T,
 		command := "list executors"
 
 		expectedBody := codeBlock(heredoc.Doc(`
-			EXECUTOR                   ENABLED ALIASES RESTARTS STATUS  LAST_RESTART
-			botkube/echo@v0.0.0-latest true    e       0/1      Running 
-			botkube/kubectl            true    k, kc   0/1      Running 
-			botkubeCloud/helm          true            0/1      Running`))
+			EXECUTOR          ENABLED ALIASES RESTARTS STATUS  LAST_RESTART
+			botkube/echo      true    e       0/1      Running 
+			botkube/kubectl   true    k, kc   0/1      Running 
+			botkubeCloud/helm true            0/1      Running`))
 
 		if botDriver.Type() == commplatform.DiscordBot {
 			// Cloud plugins are not tested on Discord
```

#### Recent Merged Pull Requests:
- **PR #1507** (closed): Implement Prometheus metrics for Botkube (@vijit-vishnoi)
- **PR #1499** (closed): security testing, do not merge (@flo405)
- **PR #1498** (closed): security testing, do not merge (@flo405)
- **PR #1496** (closed): chore: Remove CNAME (@jackylamhk)
- **PR #1484** (2024-11-15): Remove cloud dev e2e testing (@mszostok)
- **PR #1483** (2024-11-15): Remove latest plugin upload to GCS (@pkosiec)
- **PR #1481** (2024-11-11): Fix panic on missing root event type for k8s source (@mszostok)
- **PR #1480** (2024-11-11): Update Socket Slack app upload API (@mszostok)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
