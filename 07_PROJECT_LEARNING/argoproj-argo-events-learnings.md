# Forensic Learning Record (Deep Inspection): argoproj/argo-events

> **Canonical Artifact**: `07_PROJECT_LEARNING/argoproj-argo-events-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/argoproj/argo-events](https://github.com/argoproj/argo-events))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:10:42.834Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `argoproj/argo-events`
- **Description**: Event-driven Automation Framework for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2698 stars

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
				authHeader := request.Header.Get("Authorization")
				if !strings.HasPrefix(authHeader, "Bearer ") {
					route.Logger.Error("invalid auth header")
					sharedutil.SendResponse(writer, http.StatusUnauthorized, "Invalid Authorization Header")
					return
				}
				if strings.TrimPrefix(authHeader, "Bearer ") != token {
					route.Logger.Error("invalid auth token")
					sharedutil.SendResponse(writer, http.StatusUnauthorized, "Invalid Auth token")
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
	if err := router.PostActivate(); err != nil {
		logger.Errorw("error occurred while performing post route activation operations", zap.Error(err))
		return err
	}

	<-ctx.Done()
	logger.Info("connection is closed by client")

	logger.Info("marking route as inactive")
	controller.RouteDeactivateChan <- router

	logger.Info("running operations post route inactivation...")
	if err := router.PostInactivate(); err != nil {
		logger.Errorw("error occurred while running operations post route inactivation", zap.Error(err))
	}

	return nil
}

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

### Core Architecture Module: `pkg/eventsources/sources/github/hook_util.go`
```
package github

import (
	gh "github.com/google/go-github/v50/github"

	sharedutil "github.com/argoproj/argo-events/pkg/shared/util"
)

// compareHook returns true if the hook matches the url and event.
func compareHook(hook *gh.Hook, url string, events []string) bool {
	if hook == nil {
		return false
	}

	if hook.Config["url"] != url {
		return false
	}

	// Webhook events are equal if both old events slice and new events slice
	// contain the same events, or if both have "*" event.
	return sharedutil.ElementsMatch(hook.Events, events) ||
		(sharedutil.SliceContains(hook.Events, "*") && sharedutil.SliceContains(events, "*"))
}

// getHook returns the hook that matches the url and event, or nil if not found.
func getHook(hooks []*gh.Hook, url string, event []string) *gh.Hook {
	for _, hook := range hooks {
		if compareHook(hook, url, event) {
			return hook
		}
	}

	return nil
}

```

### Core Architecture Module: `pkg/eventsources/sources/gitlab/hook_util.go`
```
package gitlab

import (
	gitlab "gitlab.com/gitlab-org/api/client-go"
)

func getProjectHook(hooks []*gitlab.ProjectHook, url string) *gitlab.ProjectHook {
	for _, h := range hooks {
		if h.URL != url {
			continue
		}
		return h
	}
	return nil
}

func getGroupHook(hooks []*gitlab.GroupHook, url string) *gitlab.GroupHook {
	for _, h := range hooks {
		if h.URL != url {
			continue
		}
		return h
	}
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4178** (2026-09-20): **AMQP eventsource never ACKs messages when `consume.autoAck` is `false`**
  *Symptoms*: **Describe the bug** The AMQP eventsource does not acknowledge (ACK) messages when `consume.autoAck` is set to `false`. Messages are successfully consumed and dispatched to the eventbus, and downstream sensors trigger workflows as expected, but the messages remain permanently in `Unacked` state in RabbitMQ.  Inspecting [`pkg/eventsources/sources/amqp/start.go`](https://github.com/argoproj/argo-events/blob/main/pkg/eventsources/sources/amqp/start.go), the `handleOne` method receives the `amqplib.Delivery`, marshals the event data, calls `dispatch()`, and returns. There is no call to `msg.Ack()` anywhere in the file. The only references to "Ack" are the `AutoAck` configuration field itself (used when calling `ch.Consume()`).  When the `consume` block is omitted, `setDefaults` sets `AutoAck` to `true`, so the broker auto-acknowledges on delivery and the problem is hidden. But as soon as `autoAck: false` is explicitly configured for manual acknowledgment, no ACK is ever sent.  Setting `autoAck: true` is not an acceptable workaround because it acknowledges messages before they are dispatched to the eventbus, risking silent message loss if the dispatch fails.  **To Reproduce** 1. Deploy an AMQP eventsource with `consume.autoAck: false`:     ```yaml     apiVersion: argoproj.io/v1alpha1     kind: EventSource     metadata:       name: amqp-eventsource     spec:       amqp:         example:           url: amqp://user:pass@rabbitmq-host:5672/           exchangeName: test           excha

- **Issue #4176** (2026-09-20): **naivewatcher test does not compile on Windows (syscall.Stat_t), go test ./... reports build failed**
  *Symptoms*: **Describe the bug**  `pkg/eventsources/common/naivewatcher/watcher_test.go` builds a test file ID from `fi.Sys().(*syscall.Stat_t)`, which only exists on Unix. On Windows the test file does not compile, so `go test ./...` reports the package as `[build failed]` even though the package itself builds fine there.  **To Reproduce**  On `master` on a Windows machine:  ``` go test -count=1 ./pkg/eventsources/common/naivewatcher/ ```  ``` # github.com/argoproj/argo-events/pkg/eventsources/common/naivewatcher [github.com/argoproj/argo-events/pkg/eventsources/common/naivewatcher.test] pkg\eventsources\common\naivewatcher\watcher_test.go:28:29: undefined: syscall.Stat_t FAIL    github.com/argoproj/argo-events/pkg/eventsources/common/naivewatcher [build failed] ```  **Expected behavior**  `go test ./...` should build on Windows. The test relies on Unix inode/device fields, so it should be constrained to non-Windows platforms (`//go:build !windows`) rather than fail to compile; CI on Linux keeps running it.  **Screenshots**  <img width="1865" height="840" alt="Image" src="https://github.com/user-attachments/assets/85f68f79-0cbb-451f-b527-d052a60ec0aa" />  **Environment (please complete the following information):**  - Kubernetes: n/a (unit test)  - Argo: n/a  - Argo Events: master at f2ca952  - Go: go1.27.0 windows/amd64  **Additional context**  Related to #4173 (the other package that does not pass on Windows). Happy to open a PR.  --- <!-- Issue Author: Don't delete this message to en

- **Issue #4173** (2026-09-20): **Log trigger uses a strict time comparison: interval 0 can skip events, and TestLogTrigger fails on Windows**
  *Symptoms*: **Describe the bug**  The log trigger decides whether to log with a strict comparison:  ```go func (t *LogTrigger) shouldLog(log *v1alpha1.LogTrigger) bool { 	return time.Now().After(t.LastLogTime.Add(log.GetInterval())) } ```  https://github.com/argoproj/argo-events/blob/f2ca952/pkg/sensors/triggers/log/log.go#L56-L58  With `intervalSeconds` unset (0, which the docs describe as "log every event"), `shouldLog` returns `false` whenever `time.Now()` has not moved past `LastLogTime`, so the event is dropped without any log line. The same off-by-one applies when exactly `intervalSeconds` have elapsed: the interval is treated as not yet over.  How often that happens depends on the resolution of Go's monotonic clock. On Linux it is nanoseconds, so two consecutive reads are almost never equal and the bug stays hidden. On Windows the monotonic clock advances in coarse ticks, so two consecutive `time.Now()` calls are routinely equal and the existing `TestLogTrigger` fails deterministically at `log_test.go:23`.  **To Reproduce**  1. Check out `master` on a Windows machine and run the package tests (screenshot 1):     ```    go test -count=1 -run TestLogTrigger ./pkg/sensors/triggers/log/    ```     ```    --- FAIL: TestLogTrigger (1.00s)        log_test.go:23:            Error Trace:    pkg/sensors/triggers/log/log_test.go:23            Error:          Should be true    FAIL    ```     Line 23 is `assert.True(t, l.shouldLog(&sv1.LogTrigger{}))`, i.e. interval 0 right after `Execute` se

- **Issue #4112** (2026-08-07): **Kafka EventSource with 1 Replica performs Leader Election and Crashloops**
  *Symptoms*: **Describe the bug** When running an EventSource (e.g., using a Kafka EventBus) configured with a single replica (replicas: 1 or defaulted), the pod still executes Kubernetes leader election. Because the leader election timeouts in the codebase are extremely aggressive (5-second lease, 2-second renew deadline), any minor API server latency causes the leader election to fail. Because there is only 1 replica, the failure to renew the lease results in immediate pod crashes and continuous restart loops (CrashLoopBackOff), even though High Availability (HA) was never intended or configured. In our understanding this contradicts the official documentation: "HA can be achieved by setting spec.replicas to a number greater than 1... If following EventSource types have spec.replicas > 1, Active-Passive strategy is used..." [Argo Events HA Docs](https://argoproj.github.io/argo-events/eventsources/ha)  **Expected behavior** For an EventSource with Replicas = 1 we would expect the leader election to be turned off.  **Environment (please complete the following information):**  - Kubernetes: 1.29  - Argo Events: v1.9.7  **Additional context** In the "newElector" method the "clusterSize" variable is used for every other elector but the kubernetes elector: https://github.com/argoproj/argo-events/blob/master/pkg/shared/leaderelection/leaderelection.go#L40C96-L40C96  It could also be possible to not call the newElector method if the number of replicas 1 one here: https://github.com/argoproj/arg

- **Issue #4109** (2026-08-31): **Embedded JetStream EventBus crashes under OpenSSL FIPS because generated encryption key is too short**
  *Symptoms*: **Describe the bug**  An embedded JetStream EventBus fails to start when the NATS server uses an OpenSSL FIPS provider that enforces the minimum HMAC key strength.  Argo Events [generates the JetStream encryption key using](https://github.com/argoproj/argo-events/blob/db2215e0db7b082e704c3fe58f3fa4a0ac92689a/pkg/reconciler/eventbus/installer/jetstream.go#L542):  ```go encryptionKey := sharedutil.RandomString(12) ```  Because the generated value is ASCII, this produces a 12-byte HMAC key. OpenSSL's FIPS provider requires an HMAC key of at least 112 bits. When NATS derives its JetStream encryption keys using HMAC-SHA256, the FIPS provider rejects the generated key and the server panics with `hmac_setkey:invalid key length`.  This prevents the Argo Events-managed JetStream EventBus from running with a FIPS-enabled NATS build.  **To Reproduce**  1. Deploy Argo Events v1.9.11. 2. Configure an embedded JetStream EventBus version using a NATS build backed by an OpenSSL FIPS provider. The configuration used here was:     ```yaml    configs:      jetstream:        versions:          - version: 2.14.3            natsImage: cgr.dev/nats-fips:2.14.3            metricsExporterImage: cgr.dev/prometheus-nats-exporter-fips:0.20.1            configReloaderImage: cgr.dev/nats-server-config-reloader-fips:0.23.0            startCommand: /nats-server    ```  3. Create an embedded JetStream EventBus:     ```yaml    apiVersion: argoproj.io/v1alpha1    kind: EventBus    metadata:      name: default 

- **Issue #4050** (2026-07-22): **spec.template.container.imagePullPolicy is ignored by Sensor controller**
  *Symptoms*: **Describe the bug** The imagePullPolicy specified under spec.template.container in a Sensor resource is ignored.  **To Reproduce** Sensor YAML: ``` apiVersion: argoproj.io/v1alpha1 kind: Sensor metadata:   name: router-reboot-sensor   namespace: argo spec:   eventBusName: default   template:     serviceAccountName: argo-events-sa     container:       imagePullPolicy: IfNotPresent ``` the generated Sensor Pod is always created with: ``` apiVersion: v1 kind: Pod metadata:   labels:     controller: sensor-controller spec:   containers:   - name: main     image: quay.io/argoproj/argo-events:v1.9.10     imagePullPolicy: Always   restartPolicy: Always ``` **Expected behavior** The generated Pod should honor the imagePullPolicy defined in the Sensor template:  **Screenshots** If applicable, add screenshots to help explain your problem.  **Environment (please complete the following information):**  - Kubernetes: [1.35.4]  - Argo Events: [2.4.21] 
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had any activity in the last 60 days. It will be closed if no further activity  occurs. Thank you for your contributions.

- **Issue #4030** (2026-07-06): **Argo Events: SSRF via Sensor HTTP Trigger**
  *Symptoms*: Hi, I'm a security student researching Kubernetes app vulnerabilities.  ## Summary  An event engineer (namespace-scoped, no direct Pod create permission) can create a `Sensor` CR with an HTTP trigger targeting any internal URL. When an event arrives from the linked EventSource, the Sensor Pod makes an **HTTP POST** to the attacker-specified URL with **user-controlled headers and event-derived body content**. There is zero URL validation — the validation only checks the URL is non-empty.  **Vulnerability Class**: CWE-918 (Server-Side Request Forgery) **Attack Prerequisites**: `create` permission on Sensor + EventSource CRs in a namespace (standard event engineer privilege) **Affected Version**: Argo Events v1.9.10 (latest stable, 2026-01-21) **Tested on**: Argo Events v1.9.10, Kind v0.31.0, Kubernetes v1.35.0 **Attack complexity**: Low — two `kubectl apply` (EventSource + Sensor), then trigger one event  ---  ## Root Cause  `pkg/sensors/triggers/http/http.go:143` — HTTP request to user-controlled URL:  ```go request, err := http.NewRequest(trigger.Method, trigger.URL, bytes.NewReader(payload)) ```  Validation at `pkg/reconciler/sensor/validate.go:236-265` only checks URL is non-empty and method is valid:  ```go func validateHTTPTrigger(trigger *v1alpha1.HTTPTrigger) error {     if trigger.URL == "" {         return fmt.Errorf("server URL is not specified")     }     // Only validates method and parameter format — NO URL validation } ```  User controls: - **URL**: fully control
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had any activity in the last 60 days. It will be closed if no further activity  occurs. Thank you for your contributions.

- **Issue #3989** (2026-04-20): **Bitbucket Server event source logs garbled error message due to incorrect `%w` verb in `Logger.Errorf`**
  *Symptoms*: **Describe the bug** In `pkg/eventsources/sources/bitbucketserver/start.go`, the `manageBitbucketServerWebhooks` goroutine uses `%w` as a format verb inside `Logger.Errorf`, which is incorrect.  `%w` is only meaningful in `fmt.Errorf` for error wrapping. `Logger.Errorf` is backed by `zap.SugaredLogger`, which uses `fmt.Sprintf` formatting internally. Passing `%w` to it produces a garbled log line like `%!w(*errors.errorString=&{...})` instead of the actual error message, making it impossible to debug webhook re-application failures in production.  Relevant code (`pkg/eventsources/sources/bitbucketserver/start.go`):  ```go err = router.applyBitbucketServerWebhooks(bitbucketServerEventSource) if err != nil {     router.route.Logger.Errorf("re-applying bitbucketserver webhooks failed: %w", err) } ```  **To Reproduce** 1. Configure a Bitbucket Server event source with webhook management enabled. 2. Trigger a webhook re-application failure (e.g. by making the Bitbucket Server temporarily unreachable after the initial connection). 3. Observe the log output — the error message will appear as `%!w(*errors.errorString=&{...})` instead of a human-readable string.  To confirm the behaviour locally:  ```go logger.Errorf("failed: %w", fmt.Errorf("some error")) // output: failed: %!w(*errors.errorString=&{some error}) ``` **Expected behavior**  `%w` should be replaced with `%v` so the error message is readable in logs.  ```go router.route.Logger.Errorf("re-applying bitbucketserver webhooks

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

### Incident Patch 1: `52ed4610` (2026-09-20)
**Commit Message**: fix(eventsources): ack/nack AMQP messages when consume.autoAck is false (#4179)

Signed-off-by: Pujitha Paladugu <[REDACTED_EMAIL]>
Co-authored-by: Pujitha Paladugu <[REDACTED_EMAIL]>

**File**: `pkg/eventsources/sources/amqp/start.go` (modified, +20/-0)
```diff
@@ -185,16 +185,36 @@ func (el *EventListener) handleOne(amqpEventSource *aev1.AMQPEventSource, msg am
 
 	bodyBytes, err := json.Marshal(body)
 	if err != nil {
+		el.nack(amqpEventSource, msg, log)
 		return fmt.Errorf("failed to marshal the message, message-id: %s, %w", msg.MessageId, err)
 	}
 
 	log.Info("dispatching event ...")
 	if err = dispatch(bodyBytes); err != nil {
+		el.nack(amqpEventSource, msg, log)
 		return fmt.Errorf("failed to dispatch AMQP event, %w", err)
 	}
+
+	if !amqpEventSource.Consume.AutoAck {
+		if err := msg.Ack(false); err != nil {
+			log.Errorw("failed to ack the message", zap.Any("message-id", msg.MessageId), zap.Error(err))
+		}
+	}
 	return nil
 }
 
+// nack negatively acknowledges and requeues a message that failed processing.
+// It is a no-op when the channel was set up with AutoAck, since the broker
+// already acknowledged the message on delivery in that case.
+func (el *EventListener) nack(amqpEventSource *aev1.AMQPEventSource, msg amqplib.Delivery, log *zap.SugaredLogger) {
+	if amqpEventSource.Consume.AutoAck {
+		return
+	}
+	if err := msg.Nack(false, true); err != nil {
+		log.Errorw("failed to nack the message", zap.Any("message-id", msg.MessageId), zap.Error(err))
+	}
+}
+
 // setDefaults sets the default values in case the user hasn't defined them
 // helps also to keep retro-compatibility with current dpeloyments
 func setDefaults(eventSource *aev1.AMQPEventSource) {
```

**File**: `pkg/eventsources/sources/amqp/start_test.go` (modified, +83/-0)
```diff
@@ -17,11 +17,94 @@ limitations under the License.
 package amqp
 
 import (
+	"errors"
 	"testing"
 
+	amqplib "github.com/rabbitmq/amqp091-go"
 	"github.com/stretchr/testify/assert"
+	"go.uber.org/zap/zaptest"
+
+	aev1 "github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
+	eventsourcecommon "github.com/argoproj/argo-events/pkg/eventsources/common"
+	metrics "github.com/argoproj/argo-events/pkg/metrics"
 )
 
+// mockAcknowledger records the Ack/Nack calls made against a Delivery so
+// tests can assert on manual acknowledgement behavior.
+type mockAcknowledger struct {
+	acked   bool
+	nacked  bool
+	requeue bool
+}
+
+func (m *mockAcknowledger) Ack(tag uint64, multiple bool) error {
+	m.acked = true
+	return nil
+}
+
+func (m *mockAcknowledger) Nack(tag uint64, multiple, requeue bool) error {
+	m.nacked = true
+	m.requeue = requeue
+	return nil
+}
+
+func (m *mockAcknowledger) Reject(tag uint64, requeue bool) error {
+	return nil
+}
+
+func newEventListener() *EventListener {
+	return &EventListener{
+		EventSourceName: "esName",
+		EventName:       "eName",
+		Metrics:         metrics.NewMetrics("ns"),
+	}
+}
+
+func TestHandleOne_ManualAck(t *testing.T) {
+	el := newEventListener()
+	amqpEventSource := &aev1.AMQPEventSource{
+		Consume: &aev1.AMQPConsumeConfig{AutoAck: false},
+	}
+	ack := &mockAcknowledger{}
+	msg := amqplib.Delivery{Acknowledger: ack, Body: []byte(`{"a":"b"}`)}
+
+	dispatch := func(b []byte, opts ...eventsourcecommon.Option) error { return nil }
+	err := el.handleOne(amqpEventSource, msg, dispatch, zaptest.NewLogger(t).Sugar())
+	assert.NoError(t, err)
+	assert.True(t, ack.acked, "expected the message to be acked after a successful dispatch")
+	assert.False(t, ack.nacked)
+}
+
+func TestHandleOne_ManualNackOnDispatchFailure(t *testing.T) {
+	el := newEventListener()
+	amqpEventSource := &aev1.AMQPEventSource{
+		Consume: &aev1.AMQPConsumeConfig{AutoAck: false},
+	}
+	ack := &mockAcknowledger{}
+	msg := amqplib.Delivery{Acknowledger: ack, Body: []byte(`{"a":"b"}`)}
+
+	dispatch := func(b []byte, opts ...eventsourcecommon.Option) error { return errors.New("dispatch failed") }
+	err := el.handleOne(amqpEventSource, msg, dispatch, zaptest.NewLogger(t).Sugar())
+	assert.Error(t, err)
+	assert.True(t, ack.nacked, "expected the message to be nacked and requeued after a failed dispatch")
+	assert.True(t, ack.requeue)
+	assert.False(t, ack.acked)
+}
+
+func TestHandleOne_AutoAckSkipsManualAck(t *testing.T) {
+	el := newEventListener()
+	amqpEventSource := &aev1.AMQPEventSource{
+		Consume: &aev1.AMQPConsumeConfig{AutoAck: true},
+	}
+	// No Acknowledger set: manual Ack/Nack would return
+	// amqplib.ErrDeliveryNotInitialized if mistakenly called.
+	msg := amqplib.Delivery{Body: []byte(`{"a":"b"}`)}
+
+	dispatch := func(b []byte, opts ...eventsourcecommon.Option) error { return nil }
+	err := el.handleOne(amqpEventSource, msg, dispatch, zaptest.NewLogger(t).Sugar())
+	assert.NoError(t, err)
+}
+
 func TestParseYamlTable(t *testing.T) {
 	table, err := parseYamlTable("")
 	assert.Nil(t, err)
```

---

### Incident Patch 2: `5fb314e5` (2026-09-20)
**Commit Message**: fix(sensors): treat an exactly elapsed interval as loggable in the log trigger (#4174)

Signed-off-by: Peter Ong <[REDACTED_EMAIL]>

**File**: `pkg/sensors/triggers/log/log.go` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ func (t *LogTrigger) Execute(ctx context.Context, events map[string]*v1alpha1.Ev
 }
 
 func (t *LogTrigger) shouldLog(log *v1alpha1.LogTrigger) bool {
-	return time.Now().After(t.LastLogTime.Add(log.GetInterval()))
+	return !time.Now().Before(t.LastLogTime.Add(log.GetInterval()))
 }
 
 func (t *LogTrigger) ApplyPolicy(context.Context, interface{}) error {
```

**File**: `pkg/sensors/triggers/log/log_test.go` (modified, +11/-0)
```diff
@@ -28,3 +28,14 @@ func TestLogTrigger(t *testing.T) {
 	assert.True(t, l.shouldLog(&sv1.LogTrigger{}))
 	assert.True(t, l.shouldLog(&sv1.LogTrigger{IntervalSeconds: 1}))
 }
+
+func TestShouldLogSameInstant(t *testing.T) {
+	now := time.Now()
+	l := &LogTrigger{LastLogTime: now}
+
+	assert.True(t, l.shouldLog(&sv1.LogTrigger{}))
+	assert.False(t, l.shouldLog(&sv1.LogTrigger{IntervalSeconds: 1}))
+
+	l.LastLogTime = now.Add(-1 * time.Second)
+	assert.True(t, l.shouldLog(&sv1.LogTrigger{IntervalSeconds: 1}))
+}
```

---

### Incident Patch 3: `7a220348` (2026-08-31)
**Commit Message**: fix(eventbus): close NATS connection when trigger connection init fails (#4158)

Signed-off-by: Gabriel Harnagea <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +5/-1)
```diff
@@ -63,6 +63,7 @@ require (
 	github.com/mitchellh/hashstructure/v2 v2.0.2
 	github.com/mitchellh/mapstructure v1.5.0
 	github.com/nats-io/graft v0.0.0-20220215174245-93d18541496f
+	github.com/nats-io/nats-server/v2 v2.11.15
 	github.com/nats-io/nats.go v1.53.1
 	github.com/nats-io/stan.go v0.10.4
 	github.com/nsqio/go-nsq v1.1.0
@@ -142,6 +143,7 @@ require (
 	github.com/alibabacloud-go/tea v1.2.2 // indirect
 	github.com/aliyun/credentials-go v1.3.10 // indirect
 	github.com/andybalholm/brotli v1.1.0 // indirect
+	github.com/antithesishq/antithesis-sdk-go v0.6.0-default-no-op // indirect
 	github.com/ardielle/ardielle-go v1.5.2 // indirect
 	github.com/awalterschulze/gographviz v0.0.0-20200901124122-0eecad45bd71 // indirect
 	github.com/aws/aws-sdk-go-v2 v1.36.3 // indirect
@@ -225,6 +227,7 @@ require (
 	github.com/google/go-github/v69 v69.2.0 // indirect
 	github.com/google/go-github/v84 v84.0.0 // indirect
 	github.com/google/go-querystring v1.2.0 // indirect
+	github.com/google/go-tpm v0.9.8 // indirect
 	github.com/google/gofuzz v1.2.0 // indirect
 	github.com/google/s2a-go v0.1.9 // indirect
 	github.com/googleapis/enterprise-certificate-proxy v0.3.20 // indirect
@@ -267,6 +270,7 @@ require (
 	github.com/mattn/go-colorable v0.1.15 // indirect
 	github.com/mattn/go-isatty v0.0.24 // indirect
 	github.com/minio/crc64nvme v1.1.1 // indirect
+	github.com/minio/highwayhash v1.0.4-0.20251030100505-070ab1a87a76 // indirect
 	github.com/minio/md5-simd v1.1.2 // indirect
 	github.com/mitchellh/copystructure v1.2.0 // indirect
 	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
@@ -277,7 +281,7 @@ require (
 	github.com/mtibben/percent v0.2.1 // indirect
 	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
 	github.com/mxk/go-flowrate v0.0.0-20140419014527-cca7078d478f // indirect
-	github.com/nats-io/nats-server/v2 v2.11.15 // indirect
+	github.com/nats-io/jwt/v2 v2.8.1 // indirect
 	github.com/nats-io/nats-streaming-server v0.24.6 // indirect
 	github.com/nats-io/nkeys v0.4.15 // indirect
 	github.com/nats-io/nuid v1.0.1 // indirect
```

**File**: `go.sum` (modified, +1/-0)
```diff
@@ -1097,6 +1097,7 @@ golang.org/x/sys v0.4.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.5.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.8.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.16.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
+golang.org/x/sys v0.21.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
 golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
 golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/telemetry v0.0.0-20260811182544-a038080d80e5 h1:ZUSxONxc981v7AW7QUg+I9WwZzSTTJ019ENBYr5pV/Q=
```

**File**: `pkg/eventbus/jetstream/sensor/sensor_jetstream.go` (modified, +6/-1)
```diff
@@ -77,7 +77,12 @@ func (stream *SensorJetstream) Connect(ctx context.Context, triggerName string,
 		return nil, err
 	}
 
-	return NewJetstreamTriggerConn(conn, stream.sensorName, triggerName, dependencyExpression, deps)
+	triggerConn, err := NewJetstreamTriggerConn(conn, stream.sensorName, triggerName, dependencyExpression, deps)
+	if err != nil {
+		_ = conn.Close()
+		return nil, err
+	}
+	return triggerConn, nil
 }
 
 // Update the K/V store to reflect the current Spec:
```

**File**: `pkg/eventbus/jetstream/sensor/sensor_jetstream_test.go` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+package sensor
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/nats-io/nats-server/v2/server"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+
+	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
+	eventbuscommon "github.com/argoproj/argo-events/pkg/eventbus/common"
+)
+
+func TestSensorJetstreamConnectClosesConnectionOnTriggerConnectionError(t *testing.T) {
+	natsServer, err := server.NewServer(&server.Options{
+		JetStream: true,
+		StoreDir:  t.TempDir(),
+		Host:      "127.0.0.1",
+		Port:      -1,
+	})
+	require.NoError(t, err)
+	natsServer.Start()
+	t.Cleanup(func() {
+		natsServer.Shutdown()
+		natsServer.WaitForShutdown()
+	})
+	require.True(t, natsServer.ReadyForConnections(10*time.Second))
+
+	sensorSpec := &v1alpha1.Sensor{ObjectMeta: metav1.ObjectMeta{Name: "missing-kv-bucket"}}
+	stream, err := NewSensorJetstream(
+		natsServer.ClientURL(),
+		sensorSpec,
+		"",
+		&eventbuscommon.Auth{Strategy: v1alpha1.AuthStrategyNone},
+		zap.NewNop().Sugar(),
+		nil,
+	)
+	require.NoError(t, err)
+	baseline := natsServer.NumClients()
+
+	triggerConn, err := stream.Connect(context.Background(), "trigger", "dependency", nil, false)
+	require.Error(t, err)
+	require.Nil(t, triggerConn)
+	require.ErrorContains(t, err, "failed to get K/V store")
+	require.Eventually(t, func() bool {
+		return natsServer.NumClients() == baseline
+	}, 5*time.Second, 10*time.Millisecond)
+}
```

---

### Incident Patch 4: `4ef49aeb` (2026-08-17)
**Commit Message**: fix: return from ConsumeClaim when the Kafka batch channel closes (#4148)

Signed-off-by: Thomas Timmers <[REDACTED_EMAIL]>

**File**: `pkg/eventbus/kafka/sensor/kafka_handler.go` (modified, +6/-1)
```diff
@@ -145,7 +145,12 @@ func (h *KafkaHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim s
 
 	for {
 		select {
-		case msgs := <-batch:
+		case msgs, ok := <-batch:
+			if !ok {
+				// the claim's message channel closed, so sarama can rebalance
+				h.Logger.Info("Kafka batch channel closed, returning from ConsumeClaim")
+				return nil
+			}
 			if len(msgs) == 0 {
 				h.Logger.Warn("Kafka batch contains no messages")
 				continue
```

**File**: `pkg/eventbus/kafka/sensor/kafka_handler_test.go` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+package kafka
+
+import (
+	"context"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/IBM/sarama"
+	"github.com/stretchr/testify/assert"
+	"go.uber.org/zap"
+)
+
+// fakeConsumerGroupSession is a minimal sarama.ConsumerGroupSession whose
+// Context() stays live for the lifetime of the test, mirroring a session
+// that has not been rebalanced away.
+type fakeConsumerGroupSession struct {
+	ctx context.Context
+}
+
+func (f *fakeConsumerGroupSession) Claims() map[string][]int32                  { return nil }
+func (f *fakeConsumerGroupSession) MemberID() string                            { return "fake-member" }
+func (f *fakeConsumerGroupSession) GenerationID() int32                         { return 1 }
+func (f *fakeConsumerGroupSession) MarkOffset(string, int32, int64, string)     {}
+func (f *fakeConsumerGroupSession) Commit()                                     {}
+func (f *fakeConsumerGroupSession) ResetOffset(string, int32, int64, string)    {}
+func (f *fakeConsumerGroupSession) MarkMessage(*sarama.ConsumerMessage, string) {}
+func (f *fakeConsumerGroupSession) Context() context.Context                    { return f.ctx }
+
+// fakeConsumerGroupClaim exposes a message channel the test controls
+// directly, so it can be closed to simulate a sarama rebalance.
+type fakeConsumerGroupClaim struct {
+	topic     string
+	partition int32
+	messages  chan *sarama.ConsumerMessage
+}
+
+func (f *fakeConsumerGroupClaim) Topic() string                            { return f.topic }
+func (f *fakeConsumerGroupClaim) Partition() int32                         { return f.partition }
+func (f *fakeConsumerGroupClaim) InitialOffset() int64                     { return 0 }
+func (f *fakeConsumerGroupClaim) HighWaterMarkOffset() int64               { return 0 }
+func (f *fakeConsumerGroupClaim) Messages() <-chan *sarama.ConsumerMessage { return f.messages }
+
+// TestConsumeClaim_ReturnsOnClosedChannel reproduces the DEV-209308 hang: a
+// Kafka broker restart closes the claim's message channel while the
+// session's context is still alive. ConsumeClaim must return so sarama can
+// rebalance, instead of looping forever on the nil slice a closed channel
+// produces.
+func TestConsumeClaim_ReturnsOnClosedChannel(t *testing.T) {
+	const topic = "test-topic"
+	const partition = int32(0)
+
+	claim := &fakeConsumerGroupClaim{
+		topic:     topic,
+		partition: partition,
+		messages:  make(chan *sarama.ConsumerMessage),
+	}
+	session := &fakeConsumerGroupSession{ctx: context.Background()}
+
+	h := &KafkaHandler{
+		Mutex:  &sync.Mutex{},
+		Logger: zap.NewNop().Sugar(),
+		Handlers: map[string]func(*sarama.ConsumerMessage) ([]*sarama.ProducerMessage, int64, func()){
+			topic: func(*sarama.ConsumerMessage) ([]*sarama.ProducerMessage, int64, func()) {
+				return nil, 0, nil
+			},
+		},
+		checkpoints: Checkpoints{
+			topic: {
+				partition: &Checkpoint{Logger: zap.NewNop().Sugar()},
+			},
+		},
+	}
+
+	// Close the claim's channel to simulate the broker-restart rebalance,
+	// while the session context stays alive (its Done() never fires).
+	close(claim.messages)
+
+	done := make(chan error, 1)
+	go func() {
+		done <- h.ConsumeClaim(session, claim)
+	}()
+
+	select {
+	case err := <-done:
+		assert.NoError(t, err)
+	case <-time.After(5 * time.Second):
+		t.Fatal("ConsumeClaim did not return after its message channel closed; it is stuck in the hot-loop from DEV-209308")
+	}
+}
```

---

### Incident Patch 5: `a6ec87e1` (2026-08-17)
**Commit Message**: fix: make JetStream TLS optional when unset (#4114)

Signed-off-by: amarkdotdev <[REDACTED_EMAIL]>
Co-authored-by: amarkdotdev <[REDACTED_EMAIL]>

**File**: `pkg/eventbus/jetstream/base/jetstream.go` (modified, +3/-4)
```diff
@@ -2,7 +2,6 @@ package base
 
 import (
 	"bytes"
-	"crypto/tls"
 	"fmt"
 
 	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
@@ -77,9 +76,9 @@ func (stream *Jetstream) MakeConnection() (*JetstreamConnection, error) {
 		opts = append(opts, nats.Secure(tlsConfig))
 		log.Info("Client-side TLS configuration enabled on the NATS connection")
 	} else {
-		opts = append(opts, nats.Secure(&tls.Config{
-			InsecureSkipVerify: true,
-		}))
+		// No TLS config means a plain TCP connection. Callers that need TLS
+		// (including insecureSkipVerify) should set JetStreamConfig.TLS.
+		log.Info("Connecting to NATS without client-side TLS")
 	}
 
 	switch stream.auth.Strategy {
```

**File**: `pkg/eventbus/jetstream/base/jetstream_test.go` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+package base
+
+import (
+	"testing"
+
+	"github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
+	eventbuscommon "github.com/argoproj/argo-events/pkg/eventbus/common"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap"
+)
+
+func TestMakeConnectionTLSOptional(t *testing.T) {
+	logger := zap.NewNop().Sugar()
+
+	t.Run("nil TLS does not require secure connection option before dial", func(t *testing.T) {
+		js, err := NewJetstream("nats://127.0.0.1:1", "", &eventbuscommon.Auth{
+			Strategy: v1alpha1.AuthStrategyNone,
+		}, logger, nil)
+		require.NoError(t, err)
+
+		// Dial will fail because nothing is listening, but the important
+		// part is we get a connection failure rather than a TLS handshake
+		// error against a plain TCP endpoint.
+		_, err = js.MakeConnection()
+		require.Error(t, err)
+		assert.NotContains(t, err.Error(), "tls:")
+		assert.NotContains(t, err.Error(), "TLS")
+	})
+
+	t.Run("configured TLS is still applied", func(t *testing.T) {
+		js, err := NewJetstream("nats://127.0.0.1:1", "", &eventbuscommon.Auth{
+			Strategy: v1alpha1.AuthStrategyNone,
+		}, logger, &v1alpha1.TLSConfig{InsecureSkipVerify: true})
+		require.NoError(t, err)
+
+		_, err = js.MakeConnection()
+		require.Error(t, err)
+	})
+}
```

**File**: `pkg/reconciler/eventbus/installer/exotic_jetstream_test.go` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ func TestInstallationJSExotic(t *testing.T) {
 		assert.NoError(t, err)
 		assert.NotNil(t, conf.JetStream)
 		assert.Equal(t, conf.JetStream.URL, testJSExoticURL)
+		// Exotic config without tls is passed through unset so clients use plain TCP.
+		assert.Nil(t, conf.JetStream.TLS)
 	})
 }
 
```

**File**: `pkg/reconciler/eventbus/installer/installer_test.go` (modified, +4/-0)
```diff
@@ -194,5 +194,9 @@ func TestInstall(t *testing.T) {
 		assert.NotNil(t, testObj.Status.Config.JetStream)
 		assert.NotEmpty(t, testObj.Status.Config.JetStream.URL)
 		assert.NotNil(t, testObj.Status.Config.JetStream.AccessSecret)
+		// Native/managed JetStream always serves TLS with a self-signed cert;
+		// BusConfig must advertise insecureSkipVerify so clients keep using TLS.
+		assert.NotNil(t, testObj.Status.Config.JetStream.TLS)
+		assert.True(t, testObj.Status.Config.JetStream.TLS.InsecureSkipVerify)
 	})
 }
```

**File**: `pkg/reconciler/eventbus/installer/jetstream.go` (modified, +6/-0)
```diff
@@ -115,6 +115,9 @@ func (r *jetStreamInstaller) Install(ctx context.Context) (*v1alpha1.BusConfig,
 		return nil, err
 	}
 	r.eventBus.Status.MarkDeployed("Succeeded", "JetStream is deployed")
+	// Managed JetStream always serves TLS with a self-signed cert. Advertise
+	// insecureSkipVerify so clients opt into TLS explicitly; exotic/plain TCP
+	// buses leave TLS unset and connect without nats.Secure.
 	return &v1alpha1.BusConfig{
 		JetStream: &v1alpha1.JetStreamConfig{
 			URL: fmt.Sprintf("nats://%s.%s.svc:%s", generateJetStreamServiceName(r.eventBus), r.eventBus.Namespace, strconv.Itoa(int(jsClientPort))),
@@ -125,6 +128,9 @@ func (r *jetStreamInstaller) Install(ctx context.Context) (*v1alpha1.BusConfig,
 				Key: v1alpha1.JetStreamClientAuthSecretKey,
 			},
 			StreamConfig: string(b),
+			TLS: &v1alpha1.TLSConfig{
+				InsecureSkipVerify: true,
+			},
 		},
 	}, nil
 }
```

---

### Incident Patch 6: `d15ee4b7` (2026-08-07)
**Commit Message**: fix: skip leader election for single-replica recreate-strategy event sources (#4121)

Signed-off-by: Pujitha Paladugu <[REDACTED_EMAIL]>
Co-authored-by: Pujitha Paladugu <[REDACTED_EMAIL]>

**File**: `pkg/eventsources/eventing.go` (modified, +13/-2)
```diff
@@ -411,6 +411,16 @@ func NewEventSourceAdaptor(eventSource *aev1.EventSource, eventBusConfig *aev1.B
 	}
 }
 
+// needsLeaderElection returns true when leader election is required to
+// coordinate multiple replicas of a "recreate" strategy event source. With
+// a single replica there is no other instance to contend with for
+// leadership, so electing is unnecessary and only adds a risk of
+// crash-looping on transient API server latency.
+// See https://github.com/argoproj/argo-events/issues/4112.
+func needsLeaderElection(isRecreateType bool, replicas int) bool {
+	return isRecreateType && replicas > 1
+}
+
 // Start function
 func (e *EventSourceAdaptor) Start(ctx context.Context) error {
 	log := logging.FromContext(ctx)
@@ -430,12 +440,13 @@ func (e *EventSourceAdaptor) Start(ctx context.Context) error {
 		break
 	}
 
-	if !isRecreateType {
+	replicas := int(e.eventSource.Spec.GetReplicas())
+
+	if !needsLeaderElection(isRecreateType, replicas) {
 		return e.run(ctx, servers, filters)
 	}
 
 	clusterName := fmt.Sprintf("%s-eventsource-%s", e.eventSource.Namespace, e.eventSource.Name)
-	replicas := int(e.eventSource.Spec.GetReplicas())
 	leasename := fmt.Sprintf("eventsource-%s", e.eventSource.Name)
 
 	elector, err := leaderelection.NewElector(ctx, *e.eventBusConfig, clusterName, replicas, e.eventSource.Namespace, leasename, e.hostname)
```

**File**: `pkg/eventsources/eventing_test.go` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+package eventsources
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+func TestNeedsLeaderElection(t *testing.T) {
+	tests := []struct {
+		name           string
+		isRecreateType bool
+		replicas       int
+		want           bool
+	}{
+		{"non-recreate type, single replica", false, 1, false},
+		{"non-recreate type, multiple replicas", false, 3, false},
+		{"recreate type, single replica", true, 1, false},
+		{"recreate type, zero replicas", true, 0, false},
+		{"recreate type, multiple replicas", true, 3, true},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.want, needsLeaderElection(tt.isRecreateType, tt.replicas))
+		})
+	}
+}
```

---

### Incident Patch 7: `2ee37c02` (2026-08-07)
**Commit Message**: fix: upgrade NATS JetStream from 2.10.29 to 2.14.4 (#4134)

Signed-off-by: suryaval <[REDACTED_EMAIL]>

**File**: `manifests/base/controller-manager/controller-config.yaml` (modified, +8/-3)
```diff
@@ -32,9 +32,9 @@ data:
           discard: 0
         versions:
         - version: latest
-          natsImage: nats:2.10.29
-          metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
-          configReloaderImage: natsio/nats-server-config-reloader:0.14.0
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
           startCommand: /nats-server
         - version: 2.8.1
           natsImage: nats:2.8.1
@@ -76,3 +76,8 @@ data:
           metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
           configReloaderImage: natsio/nats-server-config-reloader:0.14.0
           startCommand: /nats-server
+        - version: 2.14.4
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
+          startCommand: /nats-server
```

**File**: `manifests/install.yaml` (modified, +8/-3)
```diff
@@ -336,9 +336,9 @@ data:
           discard: 0
         versions:
         - version: latest
-          natsImage: nats:2.10.29
-          metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
-          configReloaderImage: natsio/nats-server-config-reloader:0.14.0
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
           startCommand: /nats-server
         - version: 2.8.1
           natsImage: nats:2.8.1
@@ -380,6 +380,11 @@ data:
           metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
           configReloaderImage: natsio/nats-server-config-reloader:0.14.0
           startCommand: /nats-server
+        - version: 2.14.4
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
+          startCommand: /nats-server
 kind: ConfigMap
 metadata:
   name: argo-events-controller-config
```

**File**: `manifests/namespace-install.yaml` (modified, +8/-3)
```diff
@@ -256,9 +256,9 @@ data:
           discard: 0
         versions:
         - version: latest
-          natsImage: nats:2.10.29
-          metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
-          configReloaderImage: natsio/nats-server-config-reloader:0.14.0
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
           startCommand: /nats-server
         - version: 2.8.1
           natsImage: nats:2.8.1
@@ -300,6 +300,11 @@ data:
           metricsExporterImage: natsio/prometheus-nats-exporter:0.14.0
           configReloaderImage: natsio/nats-server-config-reloader:0.14.0
           startCommand: /nats-server
+        - version: 2.14.4
+          natsImage: nats:2.14.4
+          metricsExporterImage: natsio/prometheus-nats-exporter:0.20.1
+          configReloaderImage: natsio/nats-server-config-reloader:0.23.0
+          startCommand: /nats-server
 kind: ConfigMap
 metadata:
   name: argo-events-controller-config
```

---

### Incident Patch 8: `db2215e0` (2026-07-14)
**Commit Message**: chore: fix intermittent ci issue (#4108)

Signed-off-by: Derek Wang <[REDACTED_EMAIL]>

**File**: `Dockerfile` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ ARG ARCH=$TARGETARCH
 ####################################################################################################
 # base
 ####################################################################################################
-FROM alpine:3.16.2 as base
+FROM alpine:3.23 AS base
 ARG ARCH
 RUN apk update && apk upgrade && \
     apk add ca-certificates && \
@@ -20,7 +20,7 @@ RUN chmod +x /bin/argo-events
 ####################################################################################################
 # argo-events
 ####################################################################################################
-FROM scratch as argo-events
+FROM scratch AS argo-events
 ARG ARCH
 COPY --from=base /usr/share/zoneinfo /usr/share/zoneinfo
 COPY --from=base /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
```

**File**: `Makefile` (modified, +2/-2)
```diff
@@ -175,8 +175,8 @@ docs/assets/diagram.png: go-diagrams/diagram.dot
 start: image
 	kubectl apply -f test/manifests/argo-events-ns.yaml
 	kubectl kustomize test/manifests | sed 's@quay.io/argoproj/@$(IMAGE_NAMESPACE)/@' | sed 's/argo-events:$(BASE_VERSION)/argo-events:$(VERSION)/' | kubectl -n argo-events apply -l app.kubernetes.io/part-of=argo-events --prune=false --force -f -
-	kubectl -n argo-events rollout status deploy -lapp=controller-manager --timeout=60s
-	kubectl -n argo-events wait --for=condition=Ready --timeout 60s pod --all
+	kubectl -n argo-events rollout status deploy -lapp.kubernetes.io/part-of=argo-events --timeout=60s
+	kubectl -n argo-events wait -lapp.kubernetes.io/part-of=argo-events --for=condition=Ready --timeout 60s pod --all
 
 $(GOPATH)/bin/golangci-lint:
 	curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b `go env GOPATH`/bin v2.9.0
```

---

### Incident Patch 9: `e07c3f29` (2026-05-21)
**Commit Message**: fix: avoid duplicate slashes in formatted webhook URLs (#4056)

**File**: `pkg/shared/util/util.go` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ func FormatEndpoint(endpoint string) string {
 
 // FormattedURL returns a formatted url
 func FormattedURL(url, endpoint string) string {
-	return fmt.Sprintf("%s%s", url, FormatEndpoint(endpoint))
+	return fmt.Sprintf("%s%s", strings.TrimRight(url, "/"), FormatEndpoint(endpoint))
 }
 
 func ErrEventSourceTypeMismatch(eventSourceType string) string {
```

**File**: `pkg/shared/util/util_test.go` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ func TestFormatEndpoint(t *testing.T) {
 
 func TestFormattedURL(t *testing.T) {
 	assert.Equal(t, "test-url/fake", FormattedURL("test-url", "fake"))
+	assert.Equal(t, "test-url/fake", FormattedURL("test-url/", "/fake"))
 }
 
 type statusVal int
```

---

### Incident Patch 10: `e51c16de` (2026-05-01)
**Commit Message**: feat: make Kubernetes leader election timeouts configurable via env vars (#4029)

Signed-off-by: Najafov007 <[REDACTED_EMAIL]>

**File**: `pkg/apis/events/v1alpha1/const.go` (modified, +6/-0)
```diff
@@ -111,6 +111,12 @@ const (
 	EnvVarPodName = "POD_NAME"
 	// ENVVarLeaderElection sets the leader election mode
 	EnvVarLeaderElection = "LEADER_ELECTION"
+	// EnvVarLeaderElectionLeaseDuration sets the leader election lease duration (e.g. "15s")
+	EnvVarLeaderElectionLeaseDuration = "LEADER_ELECTION_LEASE_DURATION"
+	// EnvVarLeaderElectionRenewDeadline sets the leader election renew deadline (e.g. "10s")
+	EnvVarLeaderElectionRenewDeadline = "LEADER_ELECTION_RENEW_DEADLINE"
+	// EnvVarLeaderElectionRetryPeriod sets the leader election retry period (e.g. "2s")
+	EnvVarLeaderElectionRetryPeriod = "LEADER_ELECTION_RETRY_PERIOD"
 	// EnvImagePullPolicy is the env var to set container's ImagePullPolicy
 	EnvImagePullPolicy = "IMAGE_PULL_POLICY"
 )
```

**File**: `pkg/shared/leaderelection/leaderelection.go` (modified, +16/-3)
```diff
@@ -217,6 +217,19 @@ func newKubernetesElector(namespace string, leasename string, hostname string) (
 	}, nil
 }
 
+func durationFromEnv(envVar string, defaultDuration time.Duration) time.Duration {
+	variable, exists := os.LookupEnv(envVar)
+	if !exists {
+		return defaultDuration
+	}
+	d, err := time.ParseDuration(variable)
+	if err != nil {
+		fmt.Fprintf(os.Stderr, "invalid value for %s, using default\n", envVar)
+		return defaultDuration
+	}
+	return d
+}
+
 func (e *kubernetesElector) RunOrDie(ctx context.Context, callbacks LeaderCallbacks) {
 	logger := logging.FromContext(ctx)
 
@@ -250,9 +263,9 @@ func (e *kubernetesElector) RunOrDie(ctx context.Context, callbacks LeaderCallba
 			leaderelection.RunOrDie(ctx, leaderelection.LeaderElectionConfig{
 				Lock:            lock,
 				ReleaseOnCancel: true,
-				LeaseDuration:   5 * time.Second,
-				RenewDeadline:   2 * time.Second,
-				RetryPeriod:     1 * time.Second,
+				LeaseDuration:   durationFromEnv(aev1.EnvVarLeaderElectionLeaseDuration, 5*time.Second),
+				RenewDeadline:   durationFromEnv(aev1.EnvVarLeaderElectionRenewDeadline, 2*time.Second),
+				RetryPeriod:     durationFromEnv(aev1.EnvVarLeaderElectionRetryPeriod, 1*time.Second),
 				Callbacks: leaderelection.LeaderCallbacks{
 					OnStartedLeading: callbacks.OnStartedLeading,
 					OnStoppedLeading: callbacks.OnStoppedLeading,
```

**File**: `pkg/shared/leaderelection/leaderelection_test.go` (modified, +14/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"os"
 	"testing"
+	"time"
 
 	aev1 "github.com/argoproj/argo-events/pkg/apis/events/v1alpha1"
 	"github.com/stretchr/testify/assert"
@@ -50,3 +51,16 @@ func TestLeaderElectionWithKubernetesElector(t *testing.T) {
 		assert.True(t, ok)
 	}
 }
+
+func TestDurationFromEnv(t *testing.T) {
+	d := durationFromEnv("SOME_VAR", 5*time.Second)
+	assert.Equal(t, 5*time.Second, d)
+
+	t.Setenv("SOME_VAR", "10s")
+	d = durationFromEnv("SOME_VAR", 5*time.Second)
+	assert.Equal(t, 10*time.Second, d)
+
+	t.Setenv("SOME_VAR", "abc")
+	d = durationFromEnv("SOME_VAR", 5*time.Second)
+	assert.Equal(t, 5*time.Second, d)
+}
```

#### Recent Merged Pull Requests:
- **PR #4212** (2026-10-03): chore(deps): bump github.com/grpc-ecosystem/grpc-gateway/v2 from 2.30.0 to 2.31.0 (@dependabot[bot])
- **PR #4211** (2026-10-03): chore(deps): bump cloud.google.com/go/compute/metadata from 0.9.1 to 0.10.0 (@dependabot[bot])
- **PR #4209** (2026-10-03): chore(deps): bump cloud.google.com/go/iam from 1.13.0 to 1.14.0 (@dependabot[bot])
- **PR #4198** (2026-09-26): chore(deps): bump cloud.google.com/go/compute/metadata from 0.9.0 to 0.9.1 (@dependabot[bot])
- **PR #4197** (2026-09-26): chore(deps): bump google.golang.org/api from 0.298.0 to 0.299.0 (@dependabot[bot])
- **PR #4196** (2026-09-26): chore(deps): bump github.com/nats-io/nats-server/v2 from 2.14.7 to 2.15.0 (@dependabot[bot])
- **PR #4195** (closed): chore(deps): bump github.com/IBM/sarama from 1.43.0 to 1.61.0 (@dependabot[bot])
- **PR #4194** (2026-09-26): chore(deps): bump github.com/nats-io/nats.go from 1.53.1 to 1.54.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
