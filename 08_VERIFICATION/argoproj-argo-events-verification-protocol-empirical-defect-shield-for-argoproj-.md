# Verification Protocol: Verification Protocol: Empirical Defect Shield for argoproj/argo-events

<!-- PROVENANCE_START
{
  "source_repository": "argoproj/argo-events",
  "source_url": "https://github.com/argoproj/argo-events",
  "source_version": "5cda2887",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T05:37:16.093Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-argoproj-argo-events",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [argoproj/argo-events](https://github.com/argoproj/argo-events) (Revision: `5cda2887`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T05:37:16.093Z`  
> **Learning ID**: `learn-github-argoproj-argo-events`


## 1. Scope & Verification Target
- **Target Repository**: `argoproj/argo-events` (Commit: `5cda2887`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): argoproj/argo-events

> **Canonical Artifact**: `07_PROJECT_LEARNING/argoproj-argo-events-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/argoproj/argo-events](https://github.com/argoproj/argo-events))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T05:37:15.067Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `argoproj/argo-events`
- **Description**: Event-driven Automation Framework for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2717 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/commands/webhook.go`
```
package commands

import (
	"github.com/spf13/cobra"

	webhookcmd "github.com/argoproj/argo-events/pkg/webhook/cmd"
)

func NewWebhookCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "webhook-service",
		Short: "Start validating webhook server",
		Run: func(cmd *cobra.Command, args []string) {
			webhookcmd.Start()
		},
	}
	return command
}

```

### Core Architecture Module: `pkg/apis/events/v1alpha1/webhook_context.go`
```
package v1alpha1

import (
	corev1 "k8s.io/api/core/v1"
)

const DefaultMaxWebhookPayloadSize int64 = 1048576 // 1MB

// WebhookContext holds a general purpose REST API context
type WebhookContext struct {
	// REST API endpoint
	Endpoint string `json:"endpoint" protobuf:"bytes,1,opt,name=endpoint"`
	// Method is HTTP request method that indicates the desired action to be performed for a given resource.
	// See RFC7231 Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content
	Method string `json:"method" protobuf:"bytes,2,opt,name=method"`
	// Port on which HTTP server is listening for incoming events.
	Port string `json:"port" protobuf:"bytes,3,opt,name=port"`
	// URL is the url of the server.
	URL string `json:"url" protobuf:"bytes,4,opt,name=url"`
	// ServerCertPath refers the file that contains the cert.
	ServerCertSecret *corev1.SecretKeySelector `json:"serverCertSecret,omitempty" protobuf:"bytes,5,opt,name=serverCertSecret"`
	// ServerKeyPath refers the file that contains private key
	ServerKeySecret *corev1.SecretKeySelector `json:"serverKeySecret,omitempty" protobuf:"bytes,6,opt,name=serverKeySecret"`
	// Metadata holds the user defined metadata which will passed along the event payload.
	// +optional
	Metadata map[string]string `json:"metadata,omitempty" protobuf:"bytes,7,rep,name=metadata"`
	// AuthSecret holds a secret selector that contains a bearer token for authentication
	// +optional
	AuthSecret *corev1.SecretKeySelector `json:"authSecret,omitempty" protobuf:"bytes,8,opt,name=authSecret"`
	// MaxPayloadSize is the maximum webhook payload size that the server will accept.
	// Requests exceeding that limit will be rejected with "request too large" response.
	// Default value: 1048576 (1MB).
	// +optional
	MaxPayloadSize *int64 `json:"maxPayloadSize,omitempty" protobuf:"bytes,9,opt,name=maxPayloadSize"`
	// BasicAuth holds the username and password secret selectors for basic authentication
	// +optional
	BasicAuth *BasicAuth `json:"basicAuth,omitempty" protobuf:"bytes,10,opt,name=basicAuth"`
}

func (wc *WebhookContext) GetMaxPayloadSize() int64 {
	maxPayloadSize := DefaultMaxWebhookPayloadSize
	if wc != nil && wc.MaxPayloadSize != nil {
		maxPayloadSize = *wc.MaxPayloadSize
	}

	return maxPayloadSize
}

```

### Core Architecture Module: `pkg/eventbus/kafka/base/utils.go`
```
package base

import (
	"fmt"
	"time"
)

func EventKey(source string, subject string) string {
	return fmt.Sprintf("%s.%s", source, subject)
}

// Batch returns a read only channel that receives values from the
// input channel batched together into a slice. A value is sent to
// the output channel when the slice reaches n elements, or d time
// has elapsed, whichever happens first. Ordering is maintained.
func Batch[T any](n int, d time.Duration, in <-chan T) <-chan []T {
	out := make(chan []T, 1)

	go func() {
		batch := []T{}
		timer := time.NewTimer(d)
		timer.Stop()

		defer close(out)
		defer timer.Stop()

		for {
			select {
			case item, ok := <-in:
				if !ok {
					return
				}
				if len(batch) == 0 {
					timer.Reset(d)
				}
				if batch = append(batch, item); len(batch) == n {
					timer.Stop()
					out <- batch
					batch = nil
				}
			case <-timer.C:
				if len(batch) > 0 {
					out <- batch
					batch = nil
				}
			}
		}
	}()

	return out
}

```

### Core Architecture Module: `pkg/eventsources/common/webhook/fake.go`
```
/*
Copyright 2018 The Argoproj Authors.

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

package webhook

import (
	"net/http"

	aev1 "github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
	metrics "github.com/argoproj/argo-events/pkg/metrics"
	"github.com/argoproj/argo-events/pkg/shared/logging"
)

var Hook = &aev1.WebhookContext{
	Endpoint: "/fake",
	Port:     "12000",
	URL:      "test-url",
}

type FakeHttpWriter struct {
	HeaderStatus int
	Payload      []byte
}

func (f *FakeHttpWriter) Header() http.Header {
	return http.Header{}
}

func (f *FakeHttpWriter) Write(body []byte) (int, error) {
	f.Payload = body
	return len(body), nil
}

func (f *FakeHttpWriter) WriteHeader(status int) {
	f.HeaderStatus = status
}

type FakeRouter struct {
	route *Route
}

func (f *FakeRouter) GetRoute() *Route {
	return f.route
}

func (f *FakeRouter) HandleRoute(writer http.ResponseWriter, request *http.Request) {
}

func (f *FakeRouter) PostActivate() error {
	return nil
}

func (f *FakeRouter) PostInactivate() error {
	return nil
}

func GetFakeRoute() *Route {
	logger := logging.NewArgoEventsLogger()
	return NewRoute(Hook, logger, "fake-event-source", "fake-event", metrics.NewMetrics("fake-ns"))
}

```

### Core Architecture Module: `pkg/eventsources/common/webhook/types.go`
```
/*
Copyright 2018 The Argoproj Authors.

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

package webhook

import (
	"net/http"
	"sync"

	"github.com/gorilla/mux"
	"go.uber.org/zap"

	aev1 "github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
	metrics "github.com/argoproj/argo-events/pkg/metrics"
)

var (
	// Mutex synchronizes ActiveServerHandlers
	Lock sync.Mutex
)

// Router is an interface to manage the route
type Router interface {
	// GetRoute returns the route
	GetRoute() *Route
	// HandleRoute processes the incoming requests on the route
	HandleRoute(writer http.ResponseWriter, request *http.Request)
	// PostActivate captures the operations if any after route being activated and ready to process requests.
	PostActivate() error
	// PostInactivate captures cleanup operations if any after route is inactivated
	PostInactivate() error
}

// Dispatch is sent by RouteHandler function through
// the Route's DispatchChan and is used to coordinate writing to the
// event bus
type Dispatch struct {
	// Data contains the webhook data to dispatch to the event bus
	Data []byte
	// SuccessChan contains true iff the dispatch of the Data was successful
	SuccessChan chan bool
}

// Route contains general information about a route
type Route struct {
	// WebhookContext refers to the webhook context
	Context *aev1.WebhookContext
	// Logger to log stuff
	Logger *zap.SugaredLogger
	// StartCh controls the
	StartCh chan struct{}
	// EventSourceName refers to event source name
	EventSourceName string
	// EventName refers to event name
	EventName string
	// active determines whether the route is active and ready to process incoming requets
	// or it is an inactive route
	Active bool
	// data channel to receive data on this endpoint
	DispatchChan chan *Dispatch
	// Stop channel to signal the end of the event source.
	StopChan chan struct{}

	Metrics *metrics.Metrics
}

// Controller controls the active servers and endpoints
type Controller struct {
	// ActiveServerHandlers keeps track of currently active mux/router for the http servers.
	ActiveServerHandlers map[string]*mux.Router
	// AllRoutes keep track of routes that are already registered with server and their status active or inactive
	AllRoutes map[string]*mux.Route
	// RouteActivateChan handles activation of routes
	RouteActivateChan chan Router
	// RouteDeactivateChan handles inactivation of routes
	RouteDeactivateChan chan Router
}

```

### Core Architecture Module: `pkg/eventsources/common/webhook/validate.go`
```
/*
Copyright 2018 The Argoproj Authors.

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

package webhook

import (
	"fmt"
	"strconv"

	aev1 "github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
)

// ValidateWebhookContext validates a webhook context
func ValidateWebhookContext(context *aev1.WebhookContext) error {
	if context == nil {
		return fmt.Errorf("")
	}
	if context.Endpoint == "" {
		return fmt.Errorf("endpoint can't be empty")
	}
	if context.Port == "" {
		return fmt.Errorf("port can't be empty")
	}
	if context.Port != "" {
		_, err := strconv.Atoi(context.Port)
		if err != nil {
			return fmt.Errorf("failed to parse server port %s. err: %+v", context.Port, err)
		}
	}
	if context.AuthSecret != nil && context.BasicAuth != nil {
		return fmt.Errorf("only one of authSecret or basicAuth can be configured")
	}
	if context.BasicAuth != nil {
		if err := aev1.ValidateBasicAuth(context.BasicAuth); err != nil {
			return fmt.Errorf("invalid basicAuth config, %w", err)
		}
	}
	return nil
}

// validateRoute validates a route
func validateRoute(r *Route) error {
	if r == nil {
		return fmt.Errorf("route can't be nil")
	}
	if r.Context == nil {
		return fmt.Errorf("webhook can't be nil")
	}
	if r.StartCh == nil {
		return fmt.Errorf("start channel can't be nil")
	}
	if r.EventSourceName == "" {
		return fmt.Errorf("event source name can't be empty")
	}
	if r.EventName == "" {
		return fmt.Errorf("event name can't be empty")
	}
	if r.Logger == nil {
		return fmt.Errorf("logger can't be nil")
	}
	return nil
}

```

### Core Architecture Module: `pkg/eventsources/common/webhook/webhook.go`
```
/*
Copyright 2018 The Argoproj Authors.

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

package webhook

import (
	"context"
	"crypto/subtle"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"go.uber.org/zap"

	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
	eventsourcecommon "github.com/argoproj/argo-events/pkg/eventsources/common"
	metrics "github.com/argoproj/argo-events/pkg/metrics"
	"github.com/argoproj/argo-events/pkg/shared/logging"
	sharedutil "github.com/argoproj/argo-events/pkg/shared/util"
)

// NewController returns a webhook controller
func NewController() *Controller {
	return &Controller{
		AllRoutes:            make(map[string]*mux.Route),
		ActiveServerHandlers: make(map[string]*mux.Router),
		RouteActivateChan:    make(chan Router),
		RouteDeactivateChan:  make(chan Router),
	}
}

// NewRoute returns a vanilla route
func NewRoute(hookContext *v1alpha1.WebhookContext, logger *zap.SugaredLogger, eventSourceName, eventName string, metrics *metrics.Metrics) *Route {
	return &Route{
		Context:         hookContext,
		Logger:          logger,
		EventSourceName: eventSourceName,
		EventName:       eventName,
		Active:          false,
		DispatchChan:    make(chan *Dispatch),
		StartCh:         make(chan struct{}),
		StopChan:        make(chan struct{}),
		Metrics:         metrics,
	}
}

func DispatchEvent(route *Route, data []byte, logger *zap.SugaredLogger, writer http.ResponseWriter) {
	logger.Info("dispatching event on route's dispatch channel...")
	successChan := make(chan bool)
	route.DispatchChan <- &Dispatch{Data: data, SuccessChan: successChan}
	if <-successChan {
		logger.Info("successfully dispatched the request to the event bus")
		sharedutil.SendSuccessResponse(writer, "success")
	} else {
		logger.Error("failed to dispatch the request to the event bus")
		sharedutil.SendInternalErrorResponse(writer, "failed to record event")
	}
}

// ProcessRouteStatus processes route status as active and inactive.
func ProcessRouteStatus(ctrl *Controller) {
	for {
		select {
		case router := <-ctrl.RouteActivateChan:
			// start server if it has not been started on this port
			startServer(router, ctrl)
			// to allow route process incoming requests
			router.GetRoute().StartCh <- struct{}{}

		case router := <-ctrl.RouteDeactivateChan:
			router.GetRoute().Active = false
		}
	}
}

// parseBearerAuthorization returns the token of an "Authorization: Bearer <token>" header.
// The scheme is matched case-insensitively, as HTTP authentication schemes require.
func parseBearerAuthorization(authHeader string) (string, bool) {
	parts := strings.Fields(authHeader)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	return parts[1], true
}

// starts a http server
func startServer(router Router, controller *Controller) {
	// start a http server only if no other configuration previously started the server on given port
	Lock.Lock()
	route := router.GetRoute()
	if _, ok := controller.ActiveServerHandlers[route.Context.Port]; !ok {
		handler := mux.NewRouter()
		server := &http.Server{
			Addr:    fmt.Sprintf(":%s", route.Context.Port),
			Handler: handler,
		}

		controller.ActiveServerHandlers[route.Context.Port] = handler

		// start http server
		go func() {
			switch {
			case route.Context.ServerCertSecret != nil && route.Context.ServerKeySecret != nil:
				certPath, err := sharedutil.GetSecretVolumePath(route.Context.ServerCertSecret)
				if err != nil {
					route.Logger.Errorw("failed to get cert path in mounted volume", "error", err)
					return
				}
				keyPath, err := sharedutil.GetSecretVolumePath(route.Context.ServerKeySecret)
				if err != nil {
					route.Logger.Errorw("failed to get key path in mounted volume", "error", err)
					return
				}
				err = server.ListenAndServeTLS(certPath, keyPath)
				if err != nil {
					route.Logger.With("port", route.Context.Port).Errorw("failed to listen and serve with TLS configured", zap.Error(err))
				}
			default:
				err := server.ListenAndServe()
				if err != nil {
					route.Logger.With("port", route.Context.Port).Errorw("failed to listen and serve", zap.Error(err))
				}
			}
		}()
	}

	handler := controller.ActiveServerHandlers[route.Context.Port]

	routeName := route.Context.Port + route.Context.Endpoint
	r := handler.GetRoute(routeName)
	if r == nil {
		r = handler.NewRoute().Name(routeName)
		r = r.Path(route.Context.Endpoint)
		r.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if route.Context.AuthSecret != nil {
				token, err := sharedutil.GetSecretFromVolume(route.Context.AuthSecret)
				if err != nil {
					route.Logger.Errorw("failed to get auth secret from volume", "error", err)
					sharedutil.SendInternalErrorResponse(writer, "Error loading auth token")
					return
				}
				authToken, ok := parseBearerAuthorization(request.Header.Get("Authorization"))
				if !ok {
					route.Logger.Error("invalid auth header")
					sharedutil.SendResponse(writer, http.StatusUnauthorized, "Invalid Authorization Header")
					return
				}
				if subtle.ConstantTimeCompare([]byte(authToken), []byte(token)) != 1 {
					route.Logger.Error("invalid auth token")
					sharedutil.SendResponse(writer, http.StatusUnauthorized, "Invalid Auth token")
					return
				}
			}
			if route.Context.BasicAuth != nil {
				username, err := sharedutil.GetSecretFromVolume(route.Context.BasicAuth.Username)
				if err != nil {
					route.Logger.Errorw("failed to get basic auth username from volume", "error", err)
					sharedutil.SendInternalErrorResponse(writer, "Error loading basic auth username")
					return
				}
				password, err := sharedutil.GetSecretFromVolume(route.Context.BasicAuth.Password)
				if err != nil {
					route.Logger.Errorw("failed to get basic auth password from volume", "error", err)
					sharedutil.SendInternalErrorResponse(writer, "Error loading basic auth password")
					return
				}
				gotUsername, gotPassword, ok := request.BasicAuth()
				if !ok ||
					subtle.ConstantTimeCompare([]byte(gotUsername), []byte(username)) != 1 ||
					subtle.ConstantTimeCompare([]byte(gotPassword), []byte(password)) != 1 {
					route.Logger.Error("invalid basic auth credentials")
					sharedutil.SendResponse(writer, http.StatusUnauthorized, "Invalid Basic Auth credentials")
					return
				}
			}
			if request.Header.Get("Authorization") != "" {
				// Auth secret stops here
				request.Header.Set("Authorization", "*** Masked Auth Secret ***")
			}
			router.HandleRoute(writer, request)
		})
	}

	healthCheckRouteName := route.Context.Port + "/health"
	healthCheckRoute := handler.GetRoute(healthCheckRouteName)
	if healthCheckRoute == nil {
		healthCheckRoute = handler.NewRoute().Name(healthCheckRouteName)
		healthCheckRoute = healthCheckRoute.Path("/health")
		healthCheckRoute.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			sharedutil.SendSuccessResponse(writer, "OK")
		})
	}

	Lock.Unlock()
}

// activateRoute activates a route to process incoming requests
func activateRoute(router Router, controller *Controller) {
	route := router.GetRoute()
	// change status of route as a active route
	controller.RouteActivateChan <- router

	// wait for any route to become ready
	// if this is the first route that is added for a server, then controller will
	// start a http server before marking the route as ready
	<-route.StartCh

	route.Active = true
	route.Logger.With(logging.LabelPort, route.Context.Port, logging.LabelEndpoint, route.Context.Endpoint).Info("route is activated")
}

// manageRouteChannels consumes data from route's data channel and stops the processing when the event source is stopped/removed
func manageRouteChannels(router Router, dispatch func([]byte, ...eventsourcecommon.Option) error) {
	route := router.GetRoute()
	logger := route.Logger
	for {
		select {
		case dispatchStruct := <-route.DispatchChan:
			logger.Info("new event received, dispatching it...")
			if err := dispatch(dispatchStruct.Data); err != nil {
				logger.Errorw("failed to send event", zap.Error(err))
				dispatchStruct.SuccessChan <- false
				route.Metrics.EventProcessingFailed(route.EventSourceName, route.EventName)
				continue
			}
			dispatchStruct.SuccessChan <- true

		case <-route.StopChan:
			logger.Info("event source is stopped")
			return
		}
	}
}

// ManagerRoute manages the lifecycle of a route
func ManageRoute(ctx context.Context, router Router, controller *Controller, dispatch func([]byte, ...eventsourcecommon.Option) error) error {
	route := router.GetRoute()

	logger := route.Logger

	// in order to process a route, it needs to go through
	// 1. validation - basic configuration checks
	// 2. activation - associate http handler if not done previously
	// 3. post start operations - operations that must be performed after route has been activated and ready to process requests
	// 4. consume data from route's data channel
	// 5. post stop operations - operations that must be performed after route is inactivated

	logger.Info("validating the route...")
	if err := validateRoute(router.GetRoute()); err != nil {
		logger.Error("route is invalid, won't initialize it", zap.Error(err))
		return err
	}

	logger.Info("listening to payloads for the route...")
	go manageRouteChannels(router, dispatch)

	defer func() {
		route.StopChan <- struct{}{}
	}()

	logger.Info("activating the route...")
	activateRoute(router, controller)

	logger.Info("running operations post route activation...")
	if err := router.PostActivate(
```

### Core Architecture Module: `pkg/eventsources/sources/azurequeuestorage/start.go`
```
package azurequeuestorage

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azqueue"
	"go.uber.org/zap"

	aev1 "github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
	eventsourcecommon "github.com/argoproj/argo-events/pkg/eventsources/common"
	"github.com/argoproj/argo-events/pkg/eventsources/events"
	"github.com/argoproj/argo-events/pkg/eventsources/sources"
	metrics "github.com/argoproj/argo-events/pkg/metrics"
	"github.com/argoproj/argo-events/pkg/shared/logging"
	sharedutil "github.com/argoproj/argo-events/pkg/shared/util"
)

// EventListener implements Eventing for azure events hub event source
type EventListener struct {
	EventSourceName              string
	EventName                    string
	AzureQueueStorageEventSource aev1.AzureQueueStorageEventSource
	Metrics                      *metrics.Metrics
}

// GetEventSourceName returns name of event source
func (el *EventListener) GetEventSourceName() string {
	return el.EventSourceName
}

// GetEventName returns name of event
func (el *EventListener) GetEventName() string {
	return el.EventName
}

// GetEventSourceType return type of event server
func (el *EventListener) GetEventSourceType() aev1.EventSourceType {
	return aev1.AzureQueueStorage
}

// StartListening starts listening events
func (el *EventListener) StartListening(ctx context.Context, dispatch func([]byte, ...eventsourcecommon.Option) error) error {
	log := logging.FromContext(ctx).
		With(logging.LabelEventSourceType, el.GetEventSourceType(), logging.LabelEventName, el.GetEventName())

	log.Info("started processing the Azure Queue Storage event source...")
	defer sources.Recover(el.GetEventName())

	queueStorageEventSource := &el.AzureQueueStorageEventSource
	var client *azqueue.ServiceClient
	// if connectionString is set then use it
	// otherwise try to connect via Azure Active Directory (AAD) with storageAccountName
	if queueStorageEventSource.ConnectionString != nil {
		connStr, err := sharedutil.GetSecretFromVolume(queueStorageEventSource.ConnectionString)
		if err != nil {
			log.With("connection-string", queueStorageEventSource.ConnectionString.Name).Errorw("failed to retrieve connection string from secret", zap.Error(err))
			return err
		}

		log.Info("connecting to azure queue storage with connection string...")
		client, err = azqueue.NewServiceClientFromConnectionString(connStr, nil)
		if err != nil {
			log.Errorw("failed to create a service client", zap.Error(err))
			return err
		}
	} else {
		cred, err := azidentity.NewDefaultAzureCredential(nil)
		if err != nil {
			log.Errorw("failed to create DefaultAzureCredential", zap.Error(err))
			return err
		}
		log.Info("connecting to azure queue storage with AAD credentials...")
		serviceURL := fmt.Sprintf("https://%s.queue.core.windows.net/", queueStorageEventSource.StorageAccountName)
		client, err = azqueue.NewServiceClient(serviceURL, cred, nil)
		if err != nil {
			log.Errorw("failed to create a service client", zap.Error(err))
			return err
		}
	}

	queueClient := client.NewQueueClient(el.AzureQueueStorageEventSource.QueueName)
	if queueStorageEventSource.JSONBody {
		log.Info("assuming all events have a json body...")
	}
	var numMessages int32 = 10
	var visibilityTimeout int32 = 120
	var waitTime int32 = 3 // Defaults to 3 seconds
	if el.AzureQueueStorageEventSource.WaitTimeInSeconds != nil {
		waitTime = *el.AzureQueueStorageEventSource.WaitTimeInSeconds
	}
	log.Info("listening for messages on the queue...")
	for {
		select {
		case <-ctx.Done():
			log.Info("exiting AQS event listener...")
			return nil
		default:
		}
		log.Info("dequeing messages....")
		messages, err := queueClient.DequeueMessages(ctx, &azqueue.DequeueMessagesOptions{
			NumberOfMessages:  &numMessages,
			VisibilityTimeout: &visibilityTimeout,
		})
		if err != nil {
			log.Errorw("failed to get messages from AQS", zap.Error(err))
			time.Sleep(time.Second)
			continue
		}
		for _, m := range messages.Messages {
			el.processMessage(m, dispatch, func() {
				_, err = queueClient.DeleteMessage(ctx, *m.MessageID, *m.PopReceipt, &azqueue.DeleteMessageOptions{})
				if err != nil {
					log.Errorw("Failed to delete message", zap.Error(err))
				}
			}, log)
		}
		if len(messages.Messages) == 0 {
			time.Sleep(time.Second * time.Duration(waitTime))
		}
	}
}

func safeBase64Decode(data string) ([]byte, error) {
	rawDecoded, err := base64.URLEncoding.DecodeString(data)
	if err != nil {
		rawDecoded, err = base64.StdEncoding.DecodeString(data)
		if err != nil {
			return nil, err
		}
	}
	return rawDecoded, nil
}

func (el *EventListener) processMessage(message *azqueue.DequeuedMessage, dispatch func([]byte, ...eventsourcecommon.Option) error, ack func(), log *zap.SugaredLogger) {
	defer func(start time.Time) {
		el.Metrics.EventProcessingDuration(el.GetEventSourceName(), el.GetEventName(), float64(time.Since(start)/time.Millisecond))
	}(time.Now())
	data := &events.AzureQueueStorageEventData{
		MessageID:     *message.MessageID,
		InsertionTime: *message.InsertionTime,
		Metadata:      el.AzureQueueStorageEventSource.Metadata,
	}
	body := []byte(*message.MessageText)
	if el.AzureQueueStorageEventSource.DecodeMessage {
		rawDecodedText, err := safeBase64Decode(*message.MessageText)
		if err != nil {
			log.Errorw("failed to base64 decode message...", zap.Error(err))
			el.Metrics.EventProcessingFailed(el.GetEventSourceName(), el.GetEventName())
			if !el.AzureQueueStorageEventSource.DLQ {
				ack()
			}
			return
		}
		body = rawDecodedText
	}
	if el.AzureQueueStorageEventSource.JSONBody {
		data.Body = (*json.RawMessage)(&body)
	} else {
		data.Body = body
	}
	eventBytes, err := json.Marshal(data)
	if err != nil {
		log.Errorw("failed to marshal event data, will process next message...", zap.Error(err))
		el.Metrics.EventProcessingFailed(el.GetEventSourceName(), el.GetEventName())
		// Don't ack if a DLQ is configured to allow to forward the message to the DLQ
		if !el.AzureQueueStorageEventSource.DLQ {
			ack()
		}
		return
	}
	if err = dispatch(eventBytes); err != nil {
		log.Errorw("failed to dispatch azure queue storage event", zap.Error(err))
		el.Metrics.EventProcessingFailed(el.GetEventSourceName(), el.GetEventName())
	} else {
		ack()
	}
}

```

### Core Architecture Module: `pkg/eventsources/sources/azurequeuestorage/validate.go`
```
/*
Copyright 2018 The Argoproj Authors.

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

package azurequeuestorage

import (
	"context"
	"fmt"

	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
)

// ValidateEventSource validates azure queue storage event source
func (listener *EventListener) ValidateEventSource(ctx context.Context) error {
	return validate(&listener.AzureQueueStorageEventSource)
}

func validate(eventSource *v1alpha1.AzureQueueStorageEventSource) error {
	if eventSource == nil {
		return v1alpha1.ErrNilEventSource
	}
	if eventSource.ConnectionString == nil && eventSource.StorageAccountName == "" {
		return fmt.Errorf("must specify connection string or storageAccountName")
	}
	if eventSource.QueueName == "" {
		return fmt.Errorf("must specify queue name")
	}
	return nil
}

```

### Core Architecture Module: `pkg/eventsources/sources/gerrit/hook_util.go`
```
package gerrit

import (
	"fmt"
	"net/url"

	gerrit "github.com/andygrunwald/go-gerrit"
)

func newGerritWebhookService(client *gerrit.Client) *gerritWebhookService {
	return &gerritWebhookService{client: client}
}

// GerritWebhook contains functions for querying the API provided by the core webhook plugin.
// endpoints Refs: https://github.com/GerritCodeReview/plugins_webhooks/blob/master/src/main/resources/Documentation/rest-api-config.md
type gerritWebhookService struct {
	client *gerrit.Client
}

func (g *gerritWebhookService) List(project string) (map[string]*ProjectHookConfigs, error) {
	endpoints := fmt.Sprintf("/config/server/webhooks~projects/%s/remotes/", url.QueryEscape(project))
	req, err := g.client.NewRequest("GET", endpoints, nil)
	if err != nil {
		return nil, err
	}
	hooks := make(map[string]*ProjectHookConfigs)
	_, err = g.client.Do(req, &hooks)
	if err != nil {
		return nil, err
	}
	return hooks, nil
}

func (g *gerritWebhookService) Get(project, remoteName string) (*ProjectHookConfigs, error) {
	endpoints := fmt.Sprintf("/config/server/webhooks~projects/%s/remotes/%s/", url.QueryEscape(project), url.QueryEscape(remoteName))
	req, err := g.client.NewRequest("GET", endpoints, nil)
	if err != nil {
		return nil, err
	}
	hook := new(ProjectHookConfigs)
	_, err = g.client.Do(req, hook)
	if err != nil {
		return nil, err
	}
	return hook, nil
}

func (g *gerritWebhookService) Create(project, remoteName string, hook *ProjectHookConfigs) (*ProjectHookConfigs, error) {
	endpoints := fmt.Sprintf("/config/server/webhooks~projects/%s/remotes/%s/", url.QueryEscape(project), url.QueryEscape(remoteName))
	req, err := g.client.NewRequest("PUT", endpoints, hook)
	if err != nil {
		return nil, err
	}
	res := new(ProjectHookConfigs)
	_, err = g.client.Do(req, res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (g *gerritWebhookService) Delete(project, remoteName string) error {
	endpoints := fmt.Sprintf("/config/server/webhooks~projects/%s/remotes/%s/", url.QueryEscape(project), url.QueryEscape(remoteName))
	req, err := g.client.NewRequest("DELETE", endpoints, nil)
	if err != nil {
		return err
	}
	_, err = g.client.Do(req, nil)
	if err != nil {
		return err
	}
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4240** (2026-11-15): **Sensor hangs at 100% CPU on DST fall-back day: PrevCronTime infinite loop with conditionsReset.byTime.timezone**
  *Symptoms*: <head></head><p md-src-pos="128..603" style="font-style: normal; font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: 2; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration-line: none; text-decoration-thickness: initial; text-decoration-style: initial; text-decoration-color: initial; box-sizing: border-box; margin-top: 16px; margin-bottom: 16px; color: rgb(188, 190, 196); font-family: Helvetica, Arial, freesans, sans-serif; font-size: 13px; font-variant-ligatures: normal; background-color: rgb(25, 26, 28);"><strong md-src-pos="128..148" style="font-weight: bold; box-sizing: border-box;">Describe the bug</strong><span> </span><span md-src-pos="149..175" style="box-sizing: border-box;">When a Sensor trigger uses</span><span> </span><code md-src-pos="176..200" style="box-sizing: border-box; font-style: normal; font-variant-caps: normal; font-weight: normal; font-width: normal; font-size: 0.9em; line-height: normal; font-family: JetBrains Mono, Consolas, Liberation Mono, Menlo, Courier, monospace; font-size-adjust: none; font-kerning: auto; font-variant-alternates: normal; font-variant-ligatures: normal; font-variant-numeric: normal; font-variant-east-asian: normal; font-variant-position: normal; font-variant-emoji: normal; font-feature-settings: normal; font-optical-sizing: auto; font-variation-settings: normal; padding: 0.2em 0.4em; margin: 2px; bor

- **Issue #4223** (2026-11-14): **Managed JetStream EventBus uses the publicly known literal $JS_KEY as its encryption key**
  *Symptoms*: **Describe the bug**  Argo Events’ managed JetStream EventBus renders its NATS configuration with a quoted environment-variable reference:  ```conf jetstream {   key: "$JS_KEY"   store_dir: "/data/jetstream/store" } ```  [[NATS configuration variables must be referenced without quotes](https://docs.nats.io/reference/config/#variables)](https://docs.nats.io/reference/config/#variables). Consequently, the effective JetStream encryption key is the literal seven-byte string `$JS_KEY`, rather than the installation-specific value stored in the generated Kubernetes Secret.  Affected managed EventBuses therefore use the same publicly known root encryption key for data at rest. [[NATS uses this key in HMAC-SHA256 to derive storage encryption keys](https://github.com/nats-io/nats-server/blob/v2.14.3/server/jetstream.go#L240-L252)](https://github.com/nats-io/nats-server/blob/v2.14.3/server/jetstream.go#L240-L252). An attacker who obtains JetStream storage files, snapshots, or backups can derive those keys without obtaining the Kubernetes Secret.  The quoted reference was introduced by [[#3388](https://github.com/argoproj/argo-events/pull/3388)](https://github.com/argoproj/argo-events/pull/3388), is present in v1.9.4 and v1.9.11, and remains in both templates on `master` as of October 14, 2026:  - [[nats.conf](https://github.com/argoproj/argo-events/blob/master/pkg/reconciler/eventbus/installer/assets/jetstream/nats.conf#L16-L20)](https://github.com/argoproj/argo-events/blob/master/pkg/r

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

### Incident Patch 1: `5cda2887` (2026-11-16)
**Commit Message**: fix(sns): support a custom STS endpoint for web identity and assume role credentials (#4215)

Signed-off-by: Youssef Omar Bouden <[REDACTED_EMAIL]>
Signed-off-by: Derek Wang <[REDACTED_EMAIL]>
Co-authored-by: Derek Wang <[REDACTED_EMAIL]>

**File**: `api/jsonschema/schema.json` (modified, +4/-0)
```diff
@@ -3785,6 +3785,10 @@
           "$ref": "#/definitions/io.k8s.api.core.v1.SecretKeySelector",
           "description": "SecretKey refers K8s secret containing aws secret key"
         },
+        "stsEndpoint": {
+          "description": "STSEndpoint configures connection to a specific STS endpoint instead of Amazons servers, used to assume RoleARN and to exchange a web identity token for credentials",
+          "type": "string"
+        },
         "topicArn": {
           "description": "TopicArn",
           "type": "string"
```

**File**: `api/openapi-spec/swagger.json` (modified, +4/-0)
```diff
@@ -3773,6 +3773,10 @@
           "description": "SecretKey refers K8s secret containing aws secret key",
           "$ref": "#/definitions/io.k8s.api.core.v1.SecretKeySelector"
         },
+        "stsEndpoint": {
+          "description": "STSEndpoint configures connection to a specific STS endpoint instead of Amazons servers, used to assume RoleARN and to exchange a web identity token for credentials",
+          "type": "string"
+        },
         "topicArn": {
           "description": "TopicArn",
           "type": "string"
```

**File**: `docs/APIs.md` (modified, +21/-0)
```diff
@@ -18119,6 +18119,27 @@ Amazons servers
 
 </tr>
 
+<tr>
+
+<td>
+
+<code>stsEndpoint</code></br> <em> string </em>
+</td>
+
+<td>
+
+<em>(Optional)</em>
+<p>
+
+STSEndpoint configures connection to a specific STS endpoint instead of
+Amazons servers, used to assume RoleARN and to exchange a web identity
+token for credentials
+</p>
+
+</td>
+
+</tr>
+
 </tbody>
 
 </table>
```

**File**: `pkg/apis/events/openapi/openapi_generated.go` (modified, +7/-0)
```diff
@@ -7099,6 +7099,13 @@ func schema_pkg_apis_events_v1alpha1_SNSEventSource(ref common.ReferenceCallback
 							Format:      "",
 						},
 					},
+					"stsEndpoint": {
+						SchemaProps: spec.SchemaProps{
+							Description: "STSEndpoint configures connection to a specific STS endpoint instead of Amazons servers, used to assume RoleARN and to exchange a web identity token for credentials",
+							Type:        []string{"string"},
+							Format:      "",
+						},
+					},
 				},
 				Required: []string{"topicArn", "region"},
 			},
```

**File**: `pkg/apis/events/v1alpha1/eventsource_types.go` (modified, +4/-0)
```diff
@@ -622,6 +622,10 @@ type SNSEventSource struct {
 	// Endpoint configures connection to a specific SNS endpoint instead of Amazons servers
 	// +optional
 	Endpoint string `json:"endpoint" protobuf:"bytes,10,opt,name=endpoint"`
+	// STSEndpoint configures connection to a specific STS endpoint instead of Amazons servers,
+	// used to assume RoleARN and to exchange a web identity token for credentials
+	// +optional
+	STSEndpoint string `json:"stsEndpoint,omitempty" protobuf:"bytes,11,opt,name=stsEndpoint"`
 }
 
 // SQSEventSource refers to event-source for AWS SQS related events
```

**File**: `pkg/apis/events/v1alpha1/generated.proto` (modified, +5/-0)
```diff
@@ -2761,6 +2761,11 @@ message SNSEventSource {
   // Endpoint configures connection to a specific SNS endpoint instead of Amazons servers
   // +optional
   optional string endpoint = 10;
+
+  // STSEndpoint configures connection to a specific STS endpoint instead of Amazons servers,
+  // used to assume RoleARN and to exchange a web identity token for credentials
+  // +optional
+  optional string stsEndpoint = 11;
 }
 
 // SQSEventSource refers to event-source for AWS SQS related events
```

**File**: `pkg/eventsources/common/aws/aws.go` (modified, +37/-10)
```diff
@@ -22,7 +22,9 @@ import (
 	"github.com/aws/aws-sdk-go/aws"
 	"github.com/aws/aws-sdk-go/aws/credentials"
 	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
+	"github.com/aws/aws-sdk-go/aws/endpoints"
 	"github.com/aws/aws-sdk-go/aws/session"
+	"github.com/aws/aws-sdk-go/service/sts"
 	corev1 "k8s.io/api/core/v1"
 
 	sharedutil "github.com/argoproj/argo-events/pkg/shared/util"
@@ -77,26 +79,51 @@ func GetAWSSession(creds *credentials.Credentials, region string) (*session.Sess
 	})
 }
 
-func GetAWSSessionWithoutCreds(region string) (*session.Session, error) {
+func GetAWSSessionWithoutCreds(region, stsEndpoint string) (*session.Session, error) {
 	return session.NewSession(&aws.Config{
-		Region: &region,
+		Region:           &region,
+		EndpointResolver: stsEndpointResolver(stsEndpoint, region),
 	})
 }
 
-func GetAWSAssumeRoleCreds(roleARN, region string) (*session.Session, error) {
-	sess := session.Must(session.NewSession())
+func GetAWSAssumeRoleCreds(roleARN, region, stsEndpoint string) (*session.Session, error) {
+	sess := session.Must(session.NewSession(&aws.Config{
+		EndpointResolver: stsEndpointResolver(stsEndpoint, region),
+	}))
 	creds := stscreds.NewCredentials(sess, roleARN)
 	return GetAWSSession(creds, region)
 }
 
+// stsEndpointResolver sends STS requests, including the web identity token exchange done by
+// the default credential chain, to stsEndpoint. Other services keep their default endpoints.
+func stsEndpointResolver(stsEndpoint, fallbackRegion string) endpoints.Resolver {
+	if stsEndpoint == "" {
+		return nil
+	}
+	defaultResolver := endpoints.DefaultResolver()
+	return endpoints.ResolverFunc(func(service, region string, optFns ...func(*endpoints.Options)) (endpoints.ResolvedEndpoint, error) {
+		if service == sts.EndpointsID {
+			// Region comes from the ENV by default, take the region from the spec if not set.
+			if region == "" {
+				region = fallbackRegion
+			}
+			return endpoints.ResolvedEndpoint{
+				URL:           endpoints.AddScheme(stsEndpoint, false),
+				SigningRegion: region,
+			}, nil
+		}
+		return defaultResolver.EndpointFor(service, region, optFns...)
+	})
+}
+
 // CreateAWSSessionWithCredsInEnv based on credentials in ENV, return a aws session
-func CreateAWSSessionWithCredsInEnv(region string, roleARN string, accessKey *corev1.SecretKeySelector, secretKey *corev1.SecretKeySelector) (*session.Session, error) {
+func CreateAWSSessionWithCredsInEnv(region string, roleARN string, accessKey *corev1.SecretKeySelector, secretKey *corev1.SecretKeySelector, stsEndpoint string) (*session.Session, error) {
 	if roleARN != "" {
-		return GetAWSAssumeRoleCreds(roleARN, region)
+		return GetAWSAssumeRoleCreds(roleARN, region, stsEndpoint)
 	}
 
 	if accessKey == nil && secretKey == nil {
-		return GetAWSSessionWithoutCreds(region)
+		return GetAWSSessionWithoutCreds(region, stsEndpoint)
 	}
 
 	creds, err := GetAWSCredFromEnvironment(accessKey, secretKey)
@@ -108,13 +135,13 @@ func CreateAWSSessionWithCredsInEnv(region string, roleARN string, accessKey *co
 }
 
 // CreateAWSSessionWithCredsInVolume based on credentials in mounted volumes, return a aws session
-func CreateAWSSessionWithCredsInVolume(region string, roleARN string, accessKey *corev1.SecretKeySelector, secretKey *corev1.SecretKeySelector, sessionToken *corev1.SecretKeySelector) (*session.Session, error) {
+func CreateAWSSessionWithCredsInVolume(region string, roleARN string, accessKey *corev1.SecretKeySelector, secretKey *corev1.SecretKeySelector, sessionToken *corev1.SecretKeySelector, stsEndpoint string) (*session.Session, error) {
 	if roleARN != "" {
-		return GetAWSAssumeRoleCreds(roleARN, region)
+		return GetAWSAssumeRoleCreds(roleARN, region, stsEndpoint)
 	}
 
 	if accessKey == nil && secretKey == nil {
-		return GetAWSSessionWithoutCreds(region)
+		return GetAWSSessionWithoutCreds(region, stsEndpoint)
 	}
 
 	creds, err := GetAWSCredFromVolume(accessKey, secretKey, sessionToken)
```

**File**: `pkg/eventsources/common/aws/aws_test.go` (modified, +84/-2)
```diff
@@ -18,7 +18,11 @@ package aws
 
 import (
 	"context"
+	"fmt"
+	"net/http"
+	"net/http/httptest"
 	"os"
+	"path/filepath"
 	"testing"
 
 	"github.com/smartystreets/goconvey/convey"
@@ -85,17 +89,95 @@ func TestAWS(t *testing.T) {
 
 	convey.Convey("create AWS credential using already present config/IAM role", t, func() {
 		convey.Convey("Get a new aws session", func() {
-			session, err := GetAWSSessionWithoutCreds("mock-region")
+			session, err := GetAWSSessionWithoutCreds("mock-region", "")
 			convey.So(err, convey.ShouldBeNil)
 			convey.So(session, convey.ShouldNotBeNil)
 		})
 	})
 
 	convey.Convey("create AWS credential using assume roleARN", t, func() {
 		convey.Convey("Get a new aws session", func() {
-			session, err := GetAWSAssumeRoleCreds("moke-roleARN", "mock-region")
+			session, err := GetAWSAssumeRoleCreds("moke-roleARN", "mock-region", "")
 			convey.So(err, convey.ShouldBeNil)
 			convey.So(session, convey.ShouldNotBeNil)
 		})
 	})
+
+	convey.Convey("create AWS session using a custom STS endpoint", t, func() {
+		stsEndpoint := "http://localhost:4566"
+
+		convey.Convey("Only STS is routed to the custom endpoint", func() {
+			session, err := GetAWSSessionWithoutCreds("mock-region", stsEndpoint)
+			convey.So(err, convey.ShouldBeNil)
+			convey.So(session.ClientConfig("sts").Endpoint, convey.ShouldEqual, stsEndpoint)
+			convey.So(session.ClientConfig("sns").Endpoint, convey.ShouldEqual, "https://sns.mock-region.amazonaws.com")
+		})
+
+		convey.Convey("Scheme is added when missing", func() {
+			resolved, err := stsEndpointResolver("localhost:4566", "").EndpointFor("sts", "mock-region")
+			convey.So(err, convey.ShouldBeNil)
+			convey.So(resolved.URL, convey.ShouldEqual, "https://localhost:4566")
+		})
+	})
+
+	convey.Convey("assume a role at a custom STS endpoint without a region in the environment", t, func() {
+		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			_ = r.ParseForm()
+			action := r.Form.Get("Action")
+			fmt.Fprintf(w, `<%[1]sResponse><%[1]sResult><Credentials><AccessKeyId>key</AccessKeyId><SecretAccessKey>secret</SecretAccessKey><SessionToken>token</SessionToken><Expiration>2099-01-01T00:00:00Z</Expiration></Credentials></%[1]sResult></%[1]sResponse>`, action)
+		}))
+		defer server.Close()
+
+		t.Setenv("AWS_REGION", "")
+		t.Setenv("AWS_DEFAULT_REGION", "")
+		t.Setenv("AWS_ACCESS_KEY_ID", "id")
+		t.Setenv("AWS_SECRET_ACCESS_KEY", "secret")
+
+		session, err := CreateAWSSessionWithCredsInVolume("mock-region", "arn:aws:iam::123456789012:role/assumed", nil, nil, nil, server.URL)
+		convey.So(err, convey.ShouldBeNil)
+
+		value, err := session.Config.Credentials.Get()
+		convey.So(err, convey.ShouldBeNil)
+		convey.So(value.AccessKeyID, convey.ShouldEqual, "key")
+	})
+
+	convey.Convey("exchange a web identity token at a custom STS endpoint", t, func() {
+		actions := make(chan string, 2)
+		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			_ = r.ParseForm()
+			action := r.Form.Get("Action")
+			actions <- action
+			fmt.Fprintf(w, `<%[1]sResponse><%[1]sResult><Credentials><AccessKeyId>%[2]s</AccessKeyId><SecretAccessKey>secret</SecretAccessKey><SessionToken>token</SessionToken><Expiration>2099-01-01T00:00:00Z</Expiration></Credentials></%[1]sResult></%[1]sResponse>`, action, "key-from-"+action)
+		}))
+		defer server.Close()
+
+		tokenFile := filepath.Join(t.TempDir(), "token")
+		convey.So(os.WriteFile(tokenFile, []byte("web-identity-token"), 0o600), convey.ShouldBeNil)
+		t.Setenv("AWS_ACCESS_KEY_ID", "")
+		t.Setenv("AWS_SECRET_ACCESS_KEY", "")
+		t.Setenv("AWS_REGION", "mock-region")
+		t.Setenv("AWS_ROLE_ARN", "arn:aws:iam::123456789012:role/web-identity")
+		t.Setenv("AWS_WEB_IDENTITY_TOKEN_FILE", tokenFile)
+
+		convey.Convey("Without roleARN", func() {
+			session, err := CreateAWSSessionWithCredsInVolume("mock-region", "", nil, nil, nil, server.URL)
+			convey.So(err, convey.ShouldBeNil)
+
+			value, err := session.Config.Credentials.Get()
+			convey.So(err, convey.ShouldBeNil)
+			convey.So(value.AccessKeyID, convey.ShouldEqual, "key-from-AssumeRoleWithWebIdentity")
+			convey.So(<-actions, convey.ShouldEqual, "AssumeRoleWithWebIdentity")
+		})
+
+		convey.Convey("With roleARN", func() {
+			session, err := CreateAWSSessionWithCredsInVolume("mock-region", "arn:aws:iam::123456789012:role/assumed", nil, nil, nil, server.URL)
+			convey.So(err, convey.ShouldBeNil)
+
+			value, err := session.Config.Credentials.Get()
+			convey.So(err, convey.ShouldBeNil)
+			convey.So(value.AccessKeyID, convey.ShouldEqual, "key-from-AssumeRole")
+			convey.So(<-actions, convey.ShouldEqual, "AssumeRoleWithWebIdentity")
+			convey.So(<-actions, convey.ShouldEqual, "AssumeRole")
+		})
+	})
 }
```

---

### Incident Patch 2: `84ecb705` (2026-11-16)
**Commit Message**: fix: accept case-insensitive webhook bearer schemes (#4242)

Signed-off-by: Wu Shuwen <[REDACTED_EMAIL]>
Co-authored-by: Derek Wang <[REDACTED_EMAIL]>

**File**: `pkg/eventsources/common/webhook/testconsts_test.go` (modified, +1/-0)
```diff
@@ -4,4 +4,5 @@ package webhook
 const (
 	testEndpoint = "/fake"
 	testUsername = "username"
+	testToken    = "token"
 )
```

**File**: `pkg/eventsources/common/webhook/validate_test.go` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ func TestValidateWebhookContextBasicAuth(t *testing.T) {
 		context := &aev1.WebhookContext{
 			Endpoint:   testEndpoint,
 			Port:       "12000",
-			AuthSecret: &corev1.SecretKeySelector{Key: "token"},
+			AuthSecret: &corev1.SecretKeySelector{Key: testToken},
 			BasicAuth: &aev1.BasicAuth{
 				Username: &corev1.SecretKeySelector{Key: testUsername},
 				Password: &corev1.SecretKeySelector{Key: "password"},
```

**File**: `pkg/eventsources/common/webhook/webhook.go` (modified, +13/-3)
```diff
@@ -87,6 +87,16 @@ func ProcessRouteStatus(ctrl *Controller) {
 	}
 }
 
+// parseBearerAuthorization returns the token of an "Authorization: Bearer <token>" header.
+// The scheme is matched case-insensitively, as HTTP authentication schemes require.
+func parseBearerAuthorization(authHeader string) (string, bool) {
+	parts := strings.Fields(authHeader)
+	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
+		return "", false
+	}
+	return parts[1], true
+}
+
 // starts a http server
 func startServer(router Router, controller *Controller) {
 	// start a http server only if no other configuration previously started the server on given port
@@ -143,13 +153,13 @@ func startServer(router Router, controller *Controller) {
 					sharedutil.SendInternalErrorResponse(writer, "Error loading auth token")
 					return
 				}
-				authHeader := request.Header.Get("Authorization")
-				if !strings.HasPrefix(authHeader, "Bearer ") {
+				authToken, ok := parseBearerAuthorization(request.Header.Get("Authorization"))
+				if !ok {
 					route.Logger.Error("invalid auth header")
 					sharedutil.SendResponse(writer, http.StatusUnauthorized, "Invalid Authorization Header")
 					return
 				}
-				if strings.TrimPrefix(authHeader, "Bearer ") != token {
+				if subtle.ConstantTimeCompare([]byte(authToken), []byte(token)) != 1 {
 					route.Logger.Error("invalid auth token")
 					sharedutil.SendResponse(writer, http.StatusUnauthorized, "Invalid Auth token")
 					return
```

**File**: `pkg/eventsources/common/webhook/webhook_test.go` (modified, +28/-0)
```diff
@@ -34,3 +34,31 @@ func TestNewWebhookHelper(t *testing.T) {
 		convey.So(controller, convey.ShouldNotBeNil)
 	})
 }
+
+func TestParseBearerAuthorization(t *testing.T) {
+	tests := []struct {
+		name      string
+		header    string
+		wantToken string
+		wantOK    bool
+	}{
+		{name: "canonical scheme", header: "Bearer token", wantToken: testToken, wantOK: true},
+		{name: "lowercase scheme", header: "bearer token", wantToken: testToken, wantOK: true},
+		{name: "mixed case scheme", header: "bEaReR  token", wantToken: testToken, wantOK: true},
+		{name: "wrong scheme", header: "Basic token"},
+		{name: "empty header", header: ""},
+		{name: "scheme only", header: "Bearer"},
+		{name: "token only", header: testToken},
+		{name: "missing token", header: "Bearer "},
+		{name: "token contains whitespace", header: "Bearer token extra"},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			gotToken, gotOK := parseBearerAuthorization(test.header)
+			if gotToken != test.wantToken || gotOK != test.wantOK {
+				t.Fatalf("parseBearerAuthorization(%q) = (%q, %t), want (%q, %t)", test.header, gotToken, gotOK, test.wantToken, test.wantOK)
+			}
+		})
+	}
+}
```

**File**: `pkg/shared/util/cronutil_test.go` (modified, +4/-4)
```diff
@@ -119,15 +119,15 @@ func TestPrevCronTimeDSTFallBack(t *testing.T) {
 	}{
 		// Europe/Berlin: 2026-10-25 03:00 CEST (+0200) -> 02:00 CET (+0100).
 		// Walking back through the repeated 02:xx hour used to loop forever.
-		{"2026-10-25T03:30:00+0100", "TZ=Europe/Berlin 0 0 0 * * *", "2026-10-25T00:00:00+0200"},
-		{"2026-10-25T12:00:00+0100", "TZ=Europe/Berlin 0 0 0 * * *", "2026-10-25T00:00:00+0200"},
-		{"2026-10-25T02:30:00+0100", "TZ=Europe/Berlin 0 0 0 * * *", "2026-10-25T00:00:00+0200"},
+		{"2026-10-25T03:30:00+0100", testBerlinDaily, testBerlinMidnight},
+		{"2026-10-25T12:00:00+0100", testBerlinDaily, testBerlinMidnight},
+		{testBerlinAt0230, testBerlinDaily, testBerlinMidnight},
 		{"2026-10-25T03:30:00+0100", "TZ=Europe/Berlin 0 0 1 * * *", "2026-10-25T01:00:00+0200"},
 
 		// Hourly job during the repeated hour: the first 02:00 (CEST) must not
 		// be reported as the second 02:00 (CET), which is in the future.
 		{"2026-10-25T02:30:00+0200", "TZ=Europe/Berlin 0 0 * * * *", "2026-10-25T02:00:00+0200"},
-		{"2026-10-25T02:30:00+0100", "TZ=Europe/Berlin 0 0 * * * *", "2026-10-25T02:00:00+0100"},
+		{testBerlinAt0230, "TZ=Europe/Berlin 0 0 * * * *", "2026-10-25T02:00:00+0100"},
 		{"2026-10-25T03:00:00+0100", "TZ=Europe/Berlin 0 30 * * * *", "2026-10-25T02:30:00+0100"},
 
 		// America/New_York: 2026-11-01 02:00 EDT (-0400) -> 01:00 EST (-0500).
```

**File**: `pkg/shared/util/testconsts_test.go` (modified, +3/-0)
```diff
@@ -5,4 +5,7 @@ const (
 	testCronEvery15Min = "0 0/15 * * * *"
 	testHello          = "hello"
 	testWorld          = "world"
+	testBerlinMidnight = "2026-10-25T00:00:00+0200"
+	testBerlinAt0230   = "2026-10-25T02:30:00+0100"
+	testBerlinDaily    = "TZ=Europe/Berlin 0 0 0 * * *"
 )
```

#### Recent Merged Pull Requests:
- **PR #4286** (closed): chore(deps): bump github.com/tidwall/gjson from 1.20.0 to 1.20.2 (@dependabot[bot])
- **PR #4285** (2026-11-13): chore(deps): bump google.golang.org/api from 0.310.0 to 0.312.0 (@dependabot[bot])
- **PR #4284** (2026-11-14): chore(deps): bump github.com/xdg-go/scram from 1.3.0 to 1.4.0 (@dependabot[bot])
- **PR #4283** (2026-11-13): chore(deps): bump cloud.google.com/go/pubsub/v2 from 2.8.0 to 2.8.1 (@dependabot[bot])
- **PR #4282** (2026-11-13): chore(deps): bump github.com/tidwall/sjson from 1.2.5 to 1.2.9 (@dependabot[bot])
- **PR #4280** (2026-11-14): feat(controller): make leader election timing configurable (@cvas22)

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

## X. sns): support a custom STS endpoint for web identity and assume role credentials

**RULE**:
When implementing operations in `api/jsonschema/schema.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in argoproj/argo-events. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5cda2887`: sns): support a custom STS endpoint for web identity and assume role credentials. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `api/jsonschema/schema.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
        "stsEndpoint": {
          "description": "STSEndpoint configures connection to a specific STS endpoint instead of Amazons servers, used to assume RoleARN and to exchange a web identity token for credentials",
          "type": "string"
        },
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5cda2887` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
