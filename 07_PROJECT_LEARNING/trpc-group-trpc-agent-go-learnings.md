# Forensic Learning Record (Deep Inspection): trpc-group/trpc-agent-go

> **Canonical Artifact**: `07_PROJECT_LEARNING/trpc-group-trpc-agent-go-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:24:58.354Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trpc-group/trpc-agent-go`
- **Description**: A Go framework for building production agent systems with graph workflows, tools, memory, A2A, AG-UI, MCP, evaluation, and observability.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 1835 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/a2aagent/a2a_agent.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

// Package a2aagent provides an agent that can communicate with remote A2A agents.
package a2aagent

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/trace"

	"trpc.group/trpc-go/trpc-a2a-go/client"
	"trpc.group/trpc-go/trpc-a2a-go/protocol"
	"trpc.group/trpc-go/trpc-a2a-go/server"
	"trpc.group/trpc-go/trpc-agent-go/agent"
	"trpc.group/trpc-go/trpc-agent-go/event"
	ia2a "trpc.group/trpc-go/trpc-agent-go/internal/a2a"
	"trpc.group/trpc-go/trpc-agent-go/internal/session/privatestate"
	itelemetry "trpc.group/trpc-go/trpc-agent-go/internal/telemetry"
	itrace "trpc.group/trpc-go/trpc-agent-go/internal/trace"
	"trpc.group/trpc-go/trpc-agent-go/log"
	"trpc.group/trpc-go/trpc-agent-go/model"
	"trpc.group/trpc-go/trpc-agent-go/session"
	semconvtrace "trpc.group/trpc-go/trpc-agent-go/telemetry/semconv/trace"
	"trpc.group/trpc-go/trpc-agent-go/tool"
)

const (
	defaultStreamingChannelSize          = 1024
	defaultNonStreamingChannelSize       = 10
	defaultUserIDHeader                  = "X-User-ID"
	anonymousUserIDCookieName            = "trpc_agent_a2a_anon"
	anonymousUserIDPrefix                = "A2A_ANONYMOUS_"
	anonymousUserIDScopeSeparator        = "_"
	anonymousUserIDCookieStateKeyPrefix  = "trpc.agent.a2a.anonymous_user_id_cookie."
	anonymousUserIDCookieSecureKeySuffix = ".secure"
	anonymousUserIDCookiePathKeySuffix   = ".path"
	anonymousUserIDCookieDomainKeySuffix = ".domain"
	anonymousUserIDCookieExpiryKeySuffix = ".expires"
	anonymousUserIDCookieEncodedBytes    = 16
)

// A2AAgent is an agent that communicates with a remote A2A agent via A2A protocol.
type A2AAgent struct {
	// options
	name                 string
	description          string
	agentCard            *server.AgentCard      // Agent card and resolution state
	agentURL             string                 // URL of the remote A2A agent
	eventConverter       A2AEventConverter      // Custom A2A event converters
	dataPartMappers      []A2ADataPartMapper    // Lightweight inbound DataPart mappers for default converter
	a2aMessageConverter  InvocationA2AConverter // Custom A2A message converters for requests
	extraA2AOptions      []client.Option        // Additional A2A client options
	streamingBufSize     int                    // Buffer size for streaming responses
	streamingRespHandler StreamingRespHandler   // Handler for streaming responses
	transferStateKey     []string               // Keys in session state to transfer to the A2A agent message by metadata
	buildMessageHook     BuildMessageHook       // Hook called after A2A message is built but before it is sent
	userIDHeader         string                 // HTTP header name to send UserID to A2A server
	enableStreaming      *bool                  // Explicitly set streaming mode; nil means use agent card capability

	requireAnonymousIdentityCoordination bool

	a2aClient    *client.A2AClient
	a2aClientURL string

	// anonymousCookieInitLocks serializes first anonymous-cookie acquisition
	// within this A2AAgent instance. Session services that implement
	// session.StateInitializationService additionally coordinate separate agent
	// instances or processes that share the same backing store.
	anonymousCookieInitMu       sync.Mutex
	anonymousCookieInitLocks    map[anonymousCookieInitScope]*anonymousCookieInitLock
	anonymousCookieInitWaitHook func(anonymousCookieInitScope)
}

type invocationA2AClient struct {
	client          *client.A2AClient
	anonymousCookie *anonymousCookieState
}

type anonymousCookieInitScope struct {
	persistentSession session.Key
	transientSession  *session.Session
	cookieStateKey    string
}

type anonymousCookieInitLock struct {
	gate chan struct{}
	refs int
}

// New creates a new A2AAgent.
func New(opts ...Option) (*A2AAgent, error) {
	agent := &A2AAgent{
		eventConverter:      &defaultA2AEventConverter{},
		a2aMessageConverter: &defaultEventA2AConverter{},
		streamingBufSize:    defaultStreamingChannelSize,
	}

	for _, opt := range opts {
		opt(agent)
	}

	if len(agent.dataPartMappers) > 0 {
		if converter, ok := agent.eventConverter.(*defaultA2AEventConverter); ok {
			for _, mapper := range agent.dataPartMappers {
				if mapper == nil {
					continue
				}
				converter.dataPartMappers = append(converter.dataPartMappers, mapper)
			}
		} else {
			log.Warn(
				"WithA2ADataPartMapper is ignored because WithCustomEventConverter provided a custom converter",
			)
		}
	}

	var agentURL string
	if agent.agentCard != nil {
		agentURL = agent.agentCard.URL
	} else if agent.agentURL != "" {
		agentURL = agent.agentURL
	} else {
		log.Info("agent card or agent card url not set")
	}

	// Normalize the URL to ensure it has a proper scheme
	agentURL = ia2a.NormalizeURL(agentURL)

	// Create A2A client first
	a2aClient, err := agent.newConfiguredA2AClient(agentURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create A2A client for %s: %w", agentURL, err)
	}
	agent.a2aClient = a2aClient
	agent.a2aClientURL = agentURL

	// If agent card is not set, fetch it using A2A client's GetAgentCard method
	if agent.agentCard == nil {
		agentCard, err := a2aClient.GetAgentCard(context.Background(), "")
		if err != nil {
			return nil, fmt.Errorf("failed to fetch agent card from %s: %w", agentURL, err)
		}

		// Set name and description from agent card if not already set
		if agent.name == "" {
			agent.name = agentCard.Name
		}
		if agent.description == "" {
			agent.description = agentCard.Description
		}

		if agentCard.URL == "" {
			agentCard.URL = agentURL
		} else {
			// Normalize the agent card URL to ensure it has a proper scheme
			agentCard.URL = ia2a.NormalizeURL(agentCard.URL)
		}

		// Rebuild a2a client if URL changed
		if agentCard.URL != agentURL {
			a2aClient, err := agent.newConfiguredA2AClient(agentCard.URL)
			if err != nil {
				return nil, fmt.Errorf("failed to create A2A client for %s: %w", agentCard.URL, err)
			}
			agent.a2aClient = a2aClient
			agent.a2aClientURL = agentCard.URL
		}

		agent.agentCard = agentCard
	}

	return agent, nil
}

func (r *A2AAgent) clientForInvocation(
	invocation *agent.Invocation,
) (*invocationA2AClient, error) {
	if !needsAnonymousClient(invocation) || r.a2aClientURL == "" {
		return &invocationA2AClient{client: r.a2aClient}, nil
	}
	invocationSession, persistentSession := isolateCoordinatedAnonymousCookieSessions(
		anonymousSessionFromInvocation(invocation),
		anonymousPersistentSessionFromInvocation(invocation),
		anonymousSessionServiceFromInvocation(invocation),
	)
	anonymousCookie := newAnonymousCookieState(
		invocationSession,
		persistentSession,
		anonymousSessionServiceFromInvocation(invocation),
		anonymousCookieStateKey(r.a2aClientURL),
		anonymousCookieURLScopeFromAgentURL(r.a2aClientURL),
	)
	return &invocationA2AClient{
		client:          r.a2aClient,
		anonymousCookie: anonymousCookie,
	}, nil
}

func isolateCoordinatedAnonymousCookieSessions(
	invocationSession *session.Session,
	persistentSession *session.Session,
	service session.Service,
) (*session.Session, *session.Session) {
	if _, ok := service.(session.StateInitializationService); !ok ||
		!hasPersistentSessionKey(persistentSession) {
		// Without a stable persistent key, coordination cannot be used and the
		// existing fallback must keep sharing transient session state.
		return invocationSession, persistentSession
	}
	// HTTP callbacks may outlive runner reads of the invocation session. Keep
	// cookie mutations in request-owned snapshots; persistence goes through the
	// coordinated service.

```

### Core Architecture Module: `agent/a2aagent/a2a_agent_option.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

package a2aagent

import (
	"encoding/json"
	"strings"

	"trpc.group/trpc-go/trpc-a2a-go/client"
	"trpc.group/trpc-go/trpc-a2a-go/protocol"
	"trpc.group/trpc-go/trpc-a2a-go/server"
	"trpc.group/trpc-go/trpc-agent-go/agent"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

// StreamingRespHandler handles the streaming response content
// return the content will be added to the final aggregated content
type StreamingRespHandler func(resp *model.Response) (string, error)

// ConvertToA2AMessageFunc is the function signature for converting an invocation to an A2A protocol message.
type ConvertToA2AMessageFunc func(isStream bool, agentName string, invocation *agent.Invocation) (*protocol.Message, error)

// BuildMessageHook wraps the A2A message conversion with additional functionality.
// The hook receives the next converter function and returns a new converter function.
// Users can modify the invocation before calling next, modify the message after calling next,
// or completely replace the conversion logic by not calling next.
//
// This follows the same middleware pattern as server-side ProcessMessageHook.
type BuildMessageHook func(next ConvertToA2AMessageFunc) ConvertToA2AMessageFunc

// A2ADataPartToolResponse is a public tool response payload used by custom
// DataPart mappers.
type A2ADataPartToolResponse struct {
	ID      string
	Name    string
	Content string
}

// A2ADataPartMappingResult is the mapper-visible result holder used to enrich
// conversion output without depending on the converter's internal parseResult.
//
// Mappers receive a snapshot initialized from the current parse state. Changes
// are applied only when the mapper returns matched=true.
type A2ADataPartMappingResult struct {
	textContent            string
	reasoningContent       string
	toolCalls              []model.ToolCall
	toolResponses          []A2ADataPartToolResponse
	codeExecution          string
	codeExecutionResult    string
	eventExtensions        map[string]json.RawMessage
	textContentSet         bool
	reasoningContentSet    bool
	codeExecutionSet       bool
	codeExecutionResultSet bool
}

// GetTextContent returns the current text content snapshot.
func (r *A2ADataPartMappingResult) GetTextContent() string {
	if r == nil {
		return ""
	}
	return r.textContent
}

// SetTextContent overwrites text content when the mapper matches.
func (r *A2ADataPartMappingResult) SetTextContent(text string) {
	if r == nil {
		return
	}
	r.textContent = text
	r.textContentSet = true
}

// GetReasoningContent returns the current reasoning content snapshot.
func (r *A2ADataPartMappingResult) GetReasoningContent() string {
	if r == nil {
		return ""
	}
	return r.reasoningContent
}

// SetReasoningContent overwrites reasoning content when the mapper matches.
func (r *A2ADataPartMappingResult) SetReasoningContent(text string) {
	if r == nil {
		return
	}
	r.reasoningContent = text
	r.reasoningContentSet = true
}

// AppendToolCall appends a tool call when the mapper matches.
func (r *A2ADataPartMappingResult) AppendToolCall(call model.ToolCall) {
	if r == nil {
		return
	}
	r.toolCalls = append(r.toolCalls, call)
}

// AppendToolResponse appends a tool response when the mapper matches.
func (r *A2ADataPartMappingResult) AppendToolResponse(resp A2ADataPartToolResponse) {
	if r == nil {
		return
	}
	r.toolResponses = append(r.toolResponses, resp)
}

// GetCodeExecution returns the current executable code snapshot.
func (r *A2ADataPartMappingResult) GetCodeExecution() string {
	if r == nil {
		return ""
	}
	return r.codeExecution
}

// SetCodeExecution overwrites executable code when the mapper matches.
func (r *A2ADataPartMappingResult) SetCodeExecution(code string) {
	if r == nil {
		return
	}
	r.codeExecution = code
	r.codeExecutionSet = true
}

// GetCodeExecutionResult returns the current code execution result snapshot.
func (r *A2ADataPartMappingResult) GetCodeExecutionResult() string {
	if r == nil {
		return ""
	}
	return r.codeExecutionResult
}

// SetCodeExecutionResult overwrites code execution result when the mapper matches.
func (r *A2ADataPartMappingResult) SetCodeExecutionResult(result string) {
	if r == nil {
		return
	}
	r.codeExecutionResult = result
	r.codeExecutionResultSet = true
}

// SetEventExtension stores one serialized event extension when the mapper matches.
//
// This is useful for preserving custom A2A DataPart payloads through graph and
// server pipelines without forcing them into Message.Content.
func (r *A2ADataPartMappingResult) SetEventExtension(key string, value any) error {
	if r == nil || key == "" {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if r.eventExtensions == nil {
		r.eventExtensions = make(map[string]json.RawMessage)
	}
	r.eventExtensions[key] = cloneA2AExtensionRawMessage(raw)
	return nil
}

func cloneA2AExtensionRawMessage(raw json.RawMessage) json.RawMessage {
	if raw == nil {
		return nil
	}
	cloned := make([]byte, len(raw))
	copy(cloned, raw)
	return json.RawMessage(cloned)
}

func cloneA2AExtensions(
	extensions map[string]json.RawMessage,
) map[string]json.RawMessage {
	if len(extensions) == 0 {
		return nil
	}
	cloned := make(map[string]json.RawMessage, len(extensions))
	for key, raw := range extensions {
		cloned[key] = cloneA2AExtensionRawMessage(raw)
	}
	return cloned
}

// A2ADataPartMapper maps an inbound A2A DataPart into the default parser result.
//
// Built-in DataPart handling (function call/response, code execution) runs
// first. Mappers are invoked only when the DataPart is not consumed by the
// built-ins. Returning matched=true means this mapper consumed the part.
// Returning matched=false leaves the part ignored by the default converter.
type A2ADataPartMapper func(part *protocol.DataPart, result *A2ADataPartMappingResult) (
	matched bool,
	err error,
)

// Option configures the A2AAgent
type Option func(*A2AAgent)

// WithName sets the name of agent
func WithName(name string) Option {
	return func(a *A2AAgent) {
		a.name = name
	}
}

// WithDescription sets the agent description
func WithDescription(description string) Option {
	return func(a *A2AAgent) {
		a.description = description
	}
}

// WithAgentCardURL set the agent card URL
func WithAgentCardURL(url string) Option {
	return func(a *A2AAgent) {
		a.agentURL = strings.TrimSpace(url)
	}
}

// WithAgentCard set the agent card
func WithAgentCard(agentCard *server.AgentCard) Option {
	return func(a *A2AAgent) {
		a.agentCard = agentCard
	}
}

// WithCustomEventConverter adds a custom A2A event converter to the A2AAgent.
func WithCustomEventConverter(converter A2AEventConverter) Option {
	return func(a *A2AAgent) {
		a.eventConverter = converter
	}
}

// WithA2ADataPartMapper registers a lightweight inbound DataPart mapper on the
// default A2A event converter.
//
// If WithCustomEventConverter provides a custom converter, this mapper is
// ignored.
func WithA2ADataPartMapper(mapper A2ADataPartMapper) Option {
	return func(a *A2AAgent) {
		if mapper == nil {
			return
		}
		a.dataPartMappers = append(a.dataPartMappers, mapper)
	}
}

// WithCustomA2AConverter adds a custom A2A message converter to the A2AAgent.
// This converter will be used to convert invocations to A2A protocol messages.
func WithCustomA2AConverter(converter InvocationA2AConverter) Option {
	return func(a *A2AAgent) {
		a.a2aMessageConverter = converter
	}
}

// WithA2AClientExtraOptions adds extra options to the A2A client.
//
// For anonymous invocations, A2AAgent places its anonymous-cookie middleware
// outside the handler selected by these options. Custom HTTP clients,
// transports, timeouts, non-anonymous cookies, and caller handlers are
// therefore retained. These options are applied once while the shared base
// client is 
```

### Core Architecture Module: `agent/a2aagent/a2a_converter.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

package a2aagent

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"trpc.group/trpc-go/trpc-a2a-go/protocol"

	"trpc.group/trpc-go/trpc-agent-go/agent"
	"trpc.group/trpc-go/trpc-agent-go/event"
	"trpc.group/trpc-go/trpc-agent-go/graph"
	ia2a "trpc.group/trpc-go/trpc-agent-go/internal/a2a"
	"trpc.group/trpc-go/trpc-agent-go/log"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

// A2AEventConverter defines an interface for converting A2A protocol types to Event.
type A2AEventConverter interface {
	// ConvertToEvents converts an A2A protocol type to multiple Events.
	// In non-streaming mode, A2A server returns a Task with history containing
	// intermediate messages (tool calls, tool responses, etc.) and artifacts for final response.
	ConvertToEvents(result protocol.MessageResult, agentName string, invocation *agent.Invocation) ([]*event.Event, error)

	// ConvertStreamingToEvents converts a streaming A2A protocol type to Events.
	ConvertStreamingToEvents(result protocol.StreamingMessageEvent, agentName string, invocation *agent.Invocation) ([]*event.Event, error)
}

// InvocationA2AConverter defines an interface for converting invocations to A2A protocol messages.
type InvocationA2AConverter interface {
	// ConvertToA2AMessage converts an invocation to an A2A protocol Message.
	ConvertToA2AMessage(isStream bool, agentName string, invocation *agent.Invocation) (*protocol.Message, error)
}

type defaultA2AEventConverter struct {
	dataPartMappers []A2ADataPartMapper
}

func (d *defaultA2AEventConverter) ConvertToEvents(
	result protocol.MessageResult,
	agentName string,
	invocation *agent.Invocation,
) ([]*event.Event, error) {
	if result.Result == nil {
		return []*event.Event{event.NewResponseEvent(
			invocation.InvocationID,
			agentName,
			&model.Response{Choices: []model.Choice{{Message: model.Message{Role: model.RoleAssistant, Content: ""}}}},
		)}, nil
	}

	var events []*event.Event

	switch v := result.Result.(type) {
	case *protocol.Message:
		// Single message: build event from its parts
		if evt := d.buildRespEvent(false, v, agentName, invocation); evt != nil {
			events = append(events, evt)
		}
	case *protocol.Task:
		// Task with history: convert history messages first, then artifacts
		// History contains intermediate messages (tool calls, tool responses, etc.)
		for i := range v.History {
			if evt := d.buildRespEvent(false, &v.History[i], agentName, invocation); evt != nil {
				events = append(events, evt)
			}
		}
		if isTaskFailureState(v.Status.State) {
			statusMsg := convertTaskStatusToMessage(&protocol.TaskStatusUpdateEvent{
				TaskID:    v.ID,
				ContextID: v.ContextID,
				Metadata:  v.Metadata,
				Status:    v.Status,
			})
			if evt := d.buildRespEvent(
				false,
				statusMsg,
				agentName,
				invocation,
			); evt != nil {
				events = append(events, evt)
			}
			break
		}
		// Artifacts contain the final response
		for i := range v.Artifacts {
			artifactMsg := &protocol.Message{
				Role:      protocol.MessageRoleAgent,
				MessageID: v.Artifacts[i].ArtifactID,
				Parts:     v.Artifacts[i].Parts,
				Metadata:  v.Artifacts[i].Metadata,
			}
			if evt := d.buildRespEvent(false, artifactMsg, agentName, invocation); evt != nil {
				events = append(events, evt)
			}
		}
	default:
		// Handle unknown response types
		responseMsg := &protocol.Message{
			Role:  protocol.MessageRoleAgent,
			Parts: []protocol.Part{protocol.NewTextPart("Received unknown response type")},
		}
		if evt := d.buildRespEvent(false, responseMsg, agentName, invocation); evt != nil {
			events = append(events, evt)
		}
	}

	if len(events) > 0 {
		// Mark the last event as done
		events[len(events)-1].Done = true
		events[len(events)-1].IsPartial = false
	}
	return events, nil
}

func (d *defaultA2AEventConverter) ConvertStreamingToEvents(
	result protocol.StreamingMessageEvent,
	agentName string,
	invocation *agent.Invocation,
) ([]*event.Event, error) {
	if result.Result == nil {
		return []*event.Event{event.NewResponseEvent(
			invocation.InvocationID,
			agentName,
			&model.Response{Choices: []model.Choice{{Message: model.Message{Role: model.RoleAssistant, Content: ""}}}},
		)}, nil
	}

	var events []*event.Event
	var responseMsg *protocol.Message
	switch v := result.Result.(type) {
	case *protocol.Message:
		responseMsg = v
	case *protocol.Task:
		responseMsg = convertTaskToMessage(v)
	case *protocol.TaskStatusUpdateEvent:
		if !isTaskFailureState(v.Status.State) && !hasStructuredErrorMetadata(v.Metadata) {
			// submitted/completed updates without structured errors are control signals.
			return nil, nil
		}
		responseMsg = convertTaskStatusToMessage(v)
	case *protocol.TaskArtifactUpdateEvent:
		if v.IsFinal() && !hasStructuredErrorMetadata(v.Metadata) {
			// Final artifact chunk is either an aggregated result or a termination signal,
			// not incremental content for the user.
			return nil, nil
		}
		responseMsg = convertTaskArtifactToMessage(v)
	default:
		log.Infof("unexpected event type: %T", result.Result)
		return nil, nil
	}

	if evt := d.buildRespEvent(true, responseMsg, agentName, invocation); evt != nil {
		markTerminalStructuredErrorEvent(evt, result.Result)
		events = append(events, evt)
	}
	return events, nil
}

type defaultEventA2AConverter struct {
}

// ConvertToA2AMessage converts an event to an A2A protocol Message.
func (d *defaultEventA2AConverter) ConvertToA2AMessage(
	isStream bool,
	agentName string,
	invocation *agent.Invocation,
) (*protocol.Message, error) {
	parts := d.buildA2AParts(invocation)

	if len(parts) == 0 {
		parts = append(parts, protocol.NewTextPart(""))
	}
	message := protocol.NewMessage(protocol.MessageRoleUser, parts)
	sess := invocation.Session
	if sess != nil {
		message.ContextID = &sess.ID
	}

	message.Metadata = make(map[string]any)
	if invocation.InvocationID != "" {
		message.Metadata["invocation_id"] = invocation.InvocationID
	}
	if sess != nil && sess.UserID != "" {
		message.Metadata["user_id"] = sess.UserID
	}
	message.Metadata[ia2a.MessageMetadataInteractionSpecVersionKey] = ia2a.InteractionVersion

	return &message, nil
}

// buildA2AParts converts invocation message content and content parts to A2A protocol parts.
func (d *defaultEventA2AConverter) buildA2AParts(invocation *agent.Invocation) []protocol.Part {
	var parts []protocol.Part

	if invocation.Message.Content != "" {
		parts = append(parts, protocol.NewTextPart(invocation.Message.Content))
	}

	for _, contentPart := range invocation.Message.ContentParts {
		parts = appendContentPart(parts, contentPart)
	}

	return parts
}

// appendContentPart converts a single model.ContentPart and appends it to parts.
func appendContentPart(parts []protocol.Part, cp model.ContentPart) []protocol.Part {
	switch cp.Type {
	case model.ContentTypeText:
		return appendTextPart(parts, cp)
	case model.ContentTypeImage:
		return appendImagePart(parts, cp)
	case model.ContentTypeAudio:
		return appendAudioPart(parts, cp)
	case model.ContentTypeFile:
		return appendFilePart(parts, cp)
	default:
		return parts
	}
}

func appendTextPart(parts []protocol.Part, cp model.ContentPart) []protocol.Part {
	if cp.Text == nil {
		return parts
	}
	return append(parts, protocol.NewTextPart(*cp.Text))
}

func appendImagePart(parts []protocol.Part, cp model.ContentPart) []protocol.Part {
	if cp.Image == nil {
		return parts
	}
	if len(cp.Image.Data) > 0 {
		fp := protocol.NewFilePartWithBytes(
			"image",
			cp.Image.Format,
			base64.StdEncoding.EncodeToString(cp.Image.Data),
		)
		fp.Metadata = map[string]any{
			ia2a.FilePartMetadataContentTypeKey: ia2a.FilePartMetadataContentTypeImage,
		}
		return append(parts, &fp)
	}
	if cp.Image.URL != "" {
		fp := protocol.NewFilePartWithURI(
			"image",
			cp.Image.Format,
			cp.
```

### Core Architecture Module: `agent/a2aagent/anonymous_client.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

package a2aagent

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"sync"

	"trpc.group/trpc-go/trpc-a2a-go/client"
)

// NewAnonymousA2AClient creates an A2A client for anonymous cookie-based
// sessions.
//
// The client installs a cookie jar when the configured HTTP client does not
// have one and serializes requests that race before anonymous cookie
// initialization is confirmed. The serialization guarantee is limited to this
// client instance. Callers using multiple clients or processes must coordinate
// those clients separately.
//
// Initialization is confirmed only after the client observes a valid anonymous
// cookie from a response or custom handler and the configured jar accepts the
// same value for the agent URL. A preloaded cookie is sent but does not by
// itself release the gate; custom servers must return an accepted anonymous
// cookie with Set-Cookie. The built-in A2A server already does this.
func NewAnonymousA2AClient(agentURL string, opts ...client.Option) (*client.A2AClient, error) {
	clientOpts := make([]client.Option, 0, len(opts)+1)
	// Register the gate first so it remains the outermost middleware even when
	// callers add their own middleware through opts.
	clientOpts = append(clientOpts, client.WithMiddleware(newAnonymousA2AClientInitMiddleware()))
	clientOpts = append(clientOpts, opts...)
	return client.NewA2AClient(agentURL, clientOpts...)
}

type anonymousA2AClientInitMiddleware struct {
	gate                   chan struct{}
	jarMu                  sync.Mutex
	jar                    http.CookieJar
	initializedCookieValue string
	waitHook               func()
}

func newAnonymousA2AClientInitMiddleware() *anonymousA2AClientInitMiddleware {
	return &anonymousA2AClientInitMiddleware{
		gate: make(chan struct{}, 1),
	}
}

func (m *anonymousA2AClientInitMiddleware) Wrap(next client.HTTPReqHandler) client.HTTPReqHandler {
	return &anonymousA2AClientInitHandler{
		middleware: m,
		next:       next,
	}
}

type anonymousA2AClientInitHandler struct {
	middleware *anonymousA2AClientInitMiddleware
	next       client.HTTPReqHandler
}

func (h *anonymousA2AClientInitHandler) Handle(
	ctx context.Context,
	httpClient *http.Client,
	req *http.Request,
) (*http.Response, error) {
	if h == nil || h.middleware == nil {
		return nil, errors.New("anonymous A2A client: initialization middleware is nil")
	}
	if h.next == nil {
		return nil, errors.New("anonymous A2A client: next HTTP request handler is nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if httpClient == nil || req == nil {
		return h.next.Handle(ctx, httpClient, req)
	}
	if err := h.middleware.ensureCookieJar(httpClient.Jar); err != nil {
		return nil, err
	}
	var (
		release func()
		err     error
	)
	if h.middleware.needsInitialization(req) {
		release, err = h.middleware.acquire(ctx)
		if err != nil {
			return nil, err
		}
		if h.middleware.needsInitialization(req) {
			defer release()
		} else {
			release()
		}
	}

	// The first request owns the gate until the downstream handler has
	// processed its response and this middleware has stored Set-Cookie in the
	// jar. A waiter can then send through the same jar and continue under the
	// principal established by the winner.
	requestClient, err := h.middleware.clientWithCookieJar(httpClient)
	if err != nil {
		return nil, err
	}
	requestJar := newAnonymousA2AClientRequestCookieJar(requestClient.Jar)
	requestClient.Jar = requestJar
	request := req.Clone(ctx)
	resp, handleErr := h.next.Handle(ctx, requestClient, request)
	h.middleware.captureResponseCookies(req.URL, resp, requestJar)
	return resp, handleErr
}

func (m *anonymousA2AClientInitMiddleware) needsInitialization(
	req *http.Request,
) bool {
	if req == nil || req.URL == nil {
		return false
	}
	m.jarMu.Lock()
	initializedCookieValue := m.initializedCookieValue
	jar := m.jar
	m.jarMu.Unlock()
	if initializedCookieValue == "" || jar == nil {
		return true
	}
	for _, cookie := range jar.Cookies(req.URL) {
		if cookie != nil && cookie.Name == anonymousUserIDCookieName &&
			cookie.Value == initializedCookieValue {
			return false
		}
	}
	// A request outside the cookie's URL scope must not invalidate the
	// client-wide confirmation. Requests in scope still recheck the jar above.
	return true
}

func (m *anonymousA2AClientInitMiddleware) ensureCookieJar(configured http.CookieJar) error {
	m.jarMu.Lock()
	defer m.jarMu.Unlock()
	if m.jar != nil {
		return nil
	}
	if configured != nil {
		m.jar = configured
		return nil
	}
	jar, err := cookiejar.New(nil)
	if err != nil {
		return fmt.Errorf("anonymous A2A client: create cookie jar: %w", err)
	}
	m.jar = jar
	return nil
}

func (m *anonymousA2AClientInitMiddleware) clientWithCookieJar(
	httpClient *http.Client,
) (*http.Client, error) {
	if httpClient == nil {
		return nil, nil
	}
	if err := m.ensureCookieJar(httpClient.Jar); err != nil {
		return nil, err
	}
	m.jarMu.Lock()
	jar := m.jar
	m.jarMu.Unlock()
	requestClient := *httpClient
	requestClient.Jar = jar
	return &requestClient, nil
}

func (m *anonymousA2AClientInitMiddleware) captureResponseCookies(
	requestURL *url.URL,
	resp *http.Response,
	requestJar *anonymousA2AClientRequestCookieJar,
) {
	if requestURL == nil || requestJar == nil {
		return
	}
	if resp != nil {
		responseURL := requestURL
		if resp.Request != nil && resp.Request.URL != nil {
			responseURL = resp.Request.URL
		}
		responseCookies := resp.Cookies()
		if responseURL != nil && len(responseCookies) > 0 &&
			!requestJar.storedResponseCookies(responseURL, responseCookies) {
			requestJar.SetCookies(responseURL, responseCookies)
		}
	}
	m.markInitialized(requestURL, requestJar)
}

func (m *anonymousA2AClientInitMiddleware) markInitialized(
	requestURL *url.URL,
	requestJar *anonymousA2AClientRequestCookieJar,
) {
	initializedCookieValue := requestJar.acceptedAnonymousCookieValue(requestURL)
	if initializedCookieValue == "" {
		return
	}
	m.jarMu.Lock()
	m.initializedCookieValue = initializedCookieValue
	m.jarMu.Unlock()
}

func (m *anonymousA2AClientInitMiddleware) acquire(ctx context.Context) (func(), error) {
	select {
	case m.gate <- struct{}{}:
		return func() { <-m.gate }, nil
	default:
		if m.waitHook != nil {
			m.waitHook()
		}
	}
	select {
	case m.gate <- struct{}{}:
		return func() { <-m.gate }, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// anonymousA2AClientRequestCookieJar delegates to the configured jar and
// records cookies presented through SetCookies during one request.
type anonymousA2AClientRequestCookieJar struct {
	base          http.CookieJar
	observedJar   http.CookieJar
	mu            sync.Mutex
	storedCookies map[string]map[string]struct{}
}

func newAnonymousA2AClientRequestCookieJar(
	base http.CookieJar,
) *anonymousA2AClientRequestCookieJar {
	observedJar, err := cookiejar.New(nil)
	if err != nil {
		observedJar = nil
	}
	return &anonymousA2AClientRequestCookieJar{
		base:          base,
		observedJar:   observedJar,
		storedCookies: make(map[string]map[string]struct{}),
	}
}

func (j *anonymousA2AClientRequestCookieJar) Cookies(u *url.URL) []*http.Cookie {
	if j == nil || j.base == nil || u == nil {
		return nil
	}
	return j.base.Cookies(u)
}

func (j *anonymousA2AClientRequestCookieJar) SetCookies(u *url.URL, cookies []*http.Cookie) {
	if j == nil || j.base == nil || u == nil {
		return
	}
	j.base.SetCookies(u, cookies)
	if len(cookies) == 0 {
		return
	}
	if j.observedJar != nil {
		j.observedJar.SetCookies(u, cookies)
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	key := cookieJarURLKey(u)
	stored := j.storedCookies[key]
	if stored == nil {
		stored = make(map[string]struct{}, len(cookies))
		j.storedCookies[key] = stored
	}
	for _, cookie := range cookies {
		if cookie == nil {
			continue

```

### Core Architecture Module: `agent/a2aagent/anonymous_coordination.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//

package a2aagent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"trpc.group/trpc-go/trpc-agent-go/session"
)

const (
	anonymousCookieRecordVersion        = 1
	anonymousCookieRecordStateKeySuffix = ".record.v1"
)

var errAnonymousCookieNotCaptured = errors.New(
	"anonymous A2A response did not establish a valid identity cookie",
)

type anonymousCookieRecordEnvelope struct {
	Version   int        `json:"version"`
	Value     string     `json:"value,omitempty"`
	Secure    bool       `json:"secure,omitempty"`
	Path      string     `json:"path,omitempty"`
	Domain    string     `json:"domain,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Deleted   bool       `json:"deleted,omitempty"`
}

func encodeAnonymousCookieRecord(record anonymousCookieRecord) ([]byte, error) {
	envelope := anonymousCookieRecordEnvelope{
		Version: anonymousCookieRecordVersion,
		Value:   strings.TrimSpace(record.value),
		Secure:  record.secure,
		Path:    strings.TrimSpace(record.path),
		Domain:  normalizeAnonymousCookieDomain(record.domain),
	}
	if !record.expires.IsZero() {
		expires := record.expires.UTC()
		envelope.ExpiresAt = &expires
	}
	return json.Marshal(envelope)
}

func decodeAnonymousCookieRecord(
	value []byte,
	scope anonymousCookieURLScope,
) (anonymousCookieRecord, bool) {
	var envelope anonymousCookieRecordEnvelope
	if len(value) == 0 || json.Unmarshal(value, &envelope) != nil ||
		envelope.Version != anonymousCookieRecordVersion || envelope.Deleted {
		return anonymousCookieRecord{}, false
	}
	record := anonymousCookieRecord{
		value:  strings.TrimSpace(envelope.Value),
		secure: envelope.Secure,
		path:   strings.TrimSpace(envelope.Path),
		domain: normalizeAnonymousCookieDomain(envelope.Domain),
	}
	if !isAnonymousUserIDCookieValue(record.value) {
		return anonymousCookieRecord{}, false
	}
	if record.path != "" && !strings.HasPrefix(record.path, "/") {
		return anonymousCookieRecord{}, false
	}
	if !anonymousCookiePathIntersectsScope(record.path, scope.path) {
		return anonymousCookieRecord{}, false
	}
	if record.domain != "" && scope.hostname != "" {
		host := strings.ToLower(strings.TrimSuffix(scope.hostname, "."))
		if host != record.domain && !strings.HasSuffix(host, "."+record.domain) {
			return anonymousCookieRecord{}, false
		}
	}
	if envelope.ExpiresAt != nil {
		record.expires = envelope.ExpiresAt.UTC()
		if !record.expires.After(time.Now()) {
			return anonymousCookieRecord{}, false
		}
	}
	return record, true
}

func anonymousCookiePathIntersectsScope(cookiePath, scopePath string) bool {
	if scopePath == "" {
		scopePath = "/"
	}
	if cookiePath == "" {
		cookiePath = "/"
	}
	return anonymousCookiePathMatches(scopePath, cookiePath) ||
		anonymousCookiePathMatches(cookiePath, scopePath)
}

func anonymousCookieTombstoneValue() []byte {
	// The envelope contains only fields supported by encoding/json.
	value, _ := json.Marshal(anonymousCookieRecordEnvelope{
		Version: anonymousCookieRecordVersion,
		Deleted: true,
	})
	return value
}

func (s *anonymousCookieState) canonicalStateKey() string {
	if s == nil || s.key == "" {
		return ""
	}
	return s.key + anonymousCookieRecordStateKeySuffix
}

func (s *anonymousCookieState) loadCanonicalRecord() (
	anonymousCookieRecord,
	bool,
	bool,
) {
	if s == nil || s.canonicalStateKey() == "" {
		return anonymousCookieRecord{}, false, false
	}
	seen := make(map[*session.Session]struct{}, 2)
	for _, sess := range []*session.Session{s.persistSession, s.session} {
		if sess == nil {
			continue
		}
		if _, ok := seen[sess]; ok {
			continue
		}
		seen[sess] = struct{}{}
		value, present := sess.GetState(s.canonicalStateKey())
		if !present {
			continue
		}
		record, ok := decodeAnonymousCookieRecord(value, s.scope)
		return record, ok, true
	}
	return anonymousCookieRecord{}, false, false
}

func (s *anonymousCookieState) stateInitializer() (
	session.StateInitializationService,
	session.Key,
	bool,
) {
	if s == nil || s.sessionService == nil {
		return nil, session.Key{}, false
	}
	initializer, ok := s.sessionService.(session.StateInitializationService)
	if !ok {
		return nil, session.Key{}, false
	}
	key, ok := s.persistentSessionKey()
	if !ok {
		return nil, session.Key{}, false
	}
	return initializer, key, true
}

func (s *anonymousCookieState) usesCanonicalRecord() bool {
	if _, _, present := s.loadCanonicalRecord(); present {
		return true
	}
	_, _, ok := s.stateInitializer()
	return ok
}

func (s *anonymousCookieState) legacyRecordForMigration() (
	anonymousCookieRecord,
	bool,
) {
	if _, _, present := s.loadCanonicalRecord(); present {
		return anonymousCookieRecord{}, false
	}
	return s.loadLegacyRecord()
}

func (s *anonymousCookieState) storeCanonicalValue(value []byte) error {
	if s == nil {
		return errors.New("store anonymous A2A cookie record: state is nil")
	}
	record, ok := decodeAnonymousCookieRecord(value, s.scope)
	if !ok {
		return errors.New("store anonymous A2A cookie record: value is invalid")
	}
	for _, sess := range uniqueAnonymousCookieSessions(s.session, s.persistSession) {
		sess.SetState(s.canonicalStateKey(), value)
		storeAnonymousCookieRecord(sess, s.key, record)
	}
	return nil
}

func (s *anonymousCookieState) legacyStateProjection(
	value []byte,
) (session.StateMap, error) {
	if s == nil || s.key == "" {
		return nil, errors.New("project anonymous A2A cookie record: state is unavailable")
	}
	var envelope anonymousCookieRecordEnvelope
	if len(value) == 0 || json.Unmarshal(value, &envelope) != nil ||
		envelope.Version != anonymousCookieRecordVersion {
		return nil, errors.New("project anonymous A2A cookie record: value is invalid")
	}
	if envelope.Deleted {
		return anonymousCookieClearedStateMap(s.key), nil
	}
	record, ok := decodeAnonymousCookieRecord(value, s.scope)
	if !ok {
		return nil, errors.New("project anonymous A2A cookie record: value is invalid")
	}
	return anonymousCookieRecordStateMap(s.key, record), nil
}

func (s *anonymousCookieState) legacyStateProjections() []session.StateInitializationProjection {
	keys := []string{
		s.key,
		s.key + anonymousUserIDCookieSecureKeySuffix,
		s.key + anonymousUserIDCookiePathKeySuffix,
		s.key + anonymousUserIDCookieDomainKeySuffix,
		s.key + anonymousUserIDCookieExpiryKeySuffix,
	}
	projections := make([]session.StateInitializationProjection, 0, len(keys))
	for _, stateKey := range keys {
		stateKey := stateKey
		projections = append(projections, session.StateInitializationProjection{
			StateKey: stateKey,
			Project: func(value []byte) ([]byte, error) {
				state, err := s.legacyStateProjection(value)
				if err != nil {
					return nil, err
				}
				return state[stateKey], nil
			},
		})
	}
	return projections
}

func (s *anonymousCookieState) storeRecordLocally(record anonymousCookieRecord) {
	if s == nil {
		return
	}
	canonical := s.usesCanonicalRecord()
	var encoded []byte
	if canonical {
		encoded, _ = encodeAnonymousCookieRecord(record)
	}
	for _, sess := range uniqueAnonymousCookieSessions(s.session, s.persistSession) {
		if encoded != nil {
			sess.SetState(s.canonicalStateKey(), encoded)
		}
		storeAnonymousCookieRecord(sess, s.key, record)
	}
}

func (s *anonymousCookieState) storeCanonicalTombstoneLocally() {
	if s == nil {
		return
	}
	for _, sess := range uniqueAnonymousCookieSessions(s.session, s.persistSession) {
		sess.SetState(s.canonicalStateKey(), anonymousCookieTombstoneValue())
	}
}

func (s *anonymousCookieState) syncFromPersistedSession(
	persisted *session.Session,
) {
	if s == nil || persisted == nil {
		return
	}
	canonicalValue, canonicalPresent := persisted.GetState(s.canonicalStateKey())
	if canonicalPresent {
		for _, sess := range uniqueAnonymousCookieSessions(s.session, s.persistSession) {
			sess.SetState(s.c
```

### Core Architecture Module: `agent/a2aagent/v1/a2a_agent.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

// Package a2aagent adapts a remote A2A Protocol v1.0 agent to the agent.Agent
// interface.
//
// An A2AAgent discovers the remote endpoint from an Agent Card, selects
// blocking or streaming message delivery, and converts A2A messages, task
// updates, artifacts, and tool calls to trpc-agent-go events. When it is used
// with a Runner, the Runner's session service remains responsible for local
// conversation history.
//
// This package handles message delivery only. Use trpc-a2a-go/v2/client
// directly for the retained task control plane, including lookup, listing,
// cancellation, resubscription, and push configuration.
//
// The /v1 import-path suffix identifies the A2A Protocol v1.0 integration; it
// does not require a v1 module tag for trpc-agent-go. The trpc-a2a-go/v2 module
// version is independent of the A2A protocol version.
package a2aagent

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/trace"

	"trpc.group/trpc-go/trpc-a2a-go/v2/client"
	"trpc.group/trpc-go/trpc-a2a-go/v2/protocol"
	"trpc.group/trpc-go/trpc-a2a-go/v2/server"
	"trpc.group/trpc-go/trpc-agent-go/agent"
	"trpc.group/trpc-go/trpc-agent-go/event"
	ia2a "trpc.group/trpc-go/trpc-agent-go/internal/a2a"
	itelemetry "trpc.group/trpc-go/trpc-agent-go/internal/telemetry"
	itrace "trpc.group/trpc-go/trpc-agent-go/internal/trace"
	"trpc.group/trpc-go/trpc-agent-go/log"
	"trpc.group/trpc-go/trpc-agent-go/model"
	semconvtrace "trpc.group/trpc-go/trpc-agent-go/telemetry/semconv/trace"
	"trpc.group/trpc-go/trpc-agent-go/tool"
)

const (
	defaultStreamingChannelSize    = 1024
	defaultNonStreamingChannelSize = 10
	defaultUserIDHeader            = "X-User-ID"
)

// A2AAgent is an agent that communicates with a remote A2A agent via A2A
// protocol. It adapts blocking and streaming message calls to agent Events; use
// trpc-a2a-go/v2/client directly for the task control plane (lookup,
// cancellation, resubscription, listing, or push configuration).
type A2AAgent struct {
	// options
	name                string
	description         string
	agentCard           *server.AgentCard      // Agent card and resolution state
	agentURL            string                 // Base URL used to discover the remote agent card
	eventConverter      A2AEventConverter      // Custom A2A event converters
	dataPartMappers     []A2ADataPartMapper    // Lightweight inbound DataPart mappers for default converter
	a2aMessageConverter InvocationA2AConverter // Custom A2A message converters for requests
	extraA2AOptions     []client.Option        // Additional A2A client options
	streamingBufSize    int                    // Buffer size for streaming responses
	transferStateKey    []string               // Keys in session state to transfer to the A2A agent message by metadata
	buildMessageHook    BuildMessageHook       // Hook called after A2A message is built but before it is sent
	userIDHeader        string                 // HTTP header name to send UserID to A2A server
	enableStreaming     *bool                  // Explicitly set streaming mode; nil means use agent card capability

	a2aClient *client.A2AClient
}

// New creates a new A2AAgent.
func New(opts ...Option) (*A2AAgent, error) {
	agent := &A2AAgent{
		eventConverter:      &defaultA2AEventConverter{},
		a2aMessageConverter: &defaultEventA2AConverter{},
		streamingBufSize:    defaultStreamingChannelSize,
	}

	for _, opt := range opts {
		opt(agent)
	}

	if len(agent.dataPartMappers) > 0 {
		if converter, ok := agent.eventConverter.(*defaultA2AEventConverter); ok {
			for _, mapper := range agent.dataPartMappers {
				if mapper == nil {
					continue
				}
				converter.dataPartMappers = append(converter.dataPartMappers, mapper)
			}
		} else {
			log.Warn(
				"WithA2ADataPartMapper is ignored because WithCustomEventConverter provided a custom converter",
			)
		}
	}

	var agentURL string
	if agent.agentCard != nil {
		// v1.0 cards advertise endpoints via supportedInterfaces; the top-level
		// URL is deprecated. PrimaryURL prefers the former and falls back.
		agentURL = agent.agentCard.PrimaryURL()
	} else if agent.agentURL != "" {
		agentURL = agent.agentURL
	} else {
		log.Info("agent card or agent card url not set")
	}

	// Normalize the URL to ensure it has a proper scheme
	agentURL = ia2a.NormalizeURL(agentURL)

	// If agent card is not set, fetch it using A2A client's GetAgentCard method
	if agent.agentCard == nil {
		discoveryClient, err := client.NewA2AClient(agentURL, agent.extraA2AOptions...)
		if err != nil {
			return nil, fmt.Errorf("failed to create A2A client for %s: %w", agentURL, err)
		}
		agentCard, err := discoveryClient.GetAgentCard(context.Background(), "")
		if err != nil {
			return nil, fmt.Errorf("failed to fetch agent card from %s: %w", agentURL, err)
		}

		agent.agentCard = agentCard
	}
	card := *agent.agentCard
	card.SupportedInterfaces = slices.Clone(card.SupportedInterfaces)
	agent.agentCard = &card

	selectionCard := agent.agentCard
	if len(agent.agentCard.Signatures) > 0 {
		normalizedCard := *agent.agentCard
		normalizedCard.SupportedInterfaces = slices.Clone(normalizedCard.SupportedInterfaces)
		normalizedCard.AdditionalInterfaces = slices.Clone(normalizedCard.AdditionalInterfaces)
		normalizedCard.SecurityRequirements = slices.Clone(normalizedCard.SecurityRequirements)
		normalizedCard.Security = slices.Clone(normalizedCard.Security)
		selectionCard = &normalizedCard
	}
	selectionCard.NormalizeInterfaces()

	if agent.name == "" {
		agent.name = agent.agentCard.Name
	}
	if agent.description == "" {
		agent.description = agent.agentCard.Description
	}
	resolvedURL, clientOptions, err := resolveClientConfig(
		selectionCard,
		agentURL,
		agent.extraA2AOptions,
	)
	if err != nil {
		return nil, err
	}
	if len(agent.agentCard.Signatures) == 0 {
		agent.agentCard.URL = resolvedURL
	}
	a2aClient, err := client.NewA2AClient(resolvedURL, clientOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create A2A client for %s: %w", resolvedURL, err)
	}
	agent.a2aClient = a2aClient

	return agent, nil
}

func resolveClientConfig(
	card *server.AgentCard,
	fallbackURL string,
	explicitOptions []client.Option,
) (string, []client.Option, error) {
	selectedInterface := firstSupportedInterface(card.SupportedInterfaces)
	resolvedURL := card.PrimaryURL()
	if selectedInterface != nil {
		resolvedURL = selectedInterface.URL
	} else if len(card.SupportedInterfaces) > 0 {
		selectedInterface = firstCompatibleVersionInterface(card.SupportedInterfaces)
		if selectedInterface == nil {
			return "", nil, fmt.Errorf(
				"agent card has no interface compatible with A2A protocol %s",
				protocol.ProtocolVersionV1,
			)
		}
		resolvedURL = selectedInterface.URL
	}
	if resolvedURL == "" {
		resolvedURL = fallbackURL
	}

	clientOptions := make([]client.Option, 0, len(explicitOptions)+2)
	if selectedInterface != nil {
		if selectedInterface.ProtocolBinding != "" {
			clientOptions = append(clientOptions, client.WithProtocolBinding(selectedInterface.ProtocolBinding))
		}
		if selectedInterface.Tenant != "" {
			clientOptions = append(clientOptions, client.WithTenant(selectedInterface.Tenant))
		}
	}
	// Explicit client options take precedence over values discovered from the
	// Agent Card.
	clientOptions = append(clientOptions, explicitOptions...)
	return ia2a.NormalizeURL(resolvedURL), clientOptions, nil
}

func firstSupportedInterface(interfaces []protocol.AgentInterface) *protocol.AgentInterface {
	var legacy *protocol.AgentInterface
	for i := range interfaces {
		binding := interfaces[i].ProtocolBinding
		
```

### Core Architecture Module: `agent/a2aagent/v1/a2a_agent_option.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

package a2aagent

import (
	"encoding/json"
	"strings"

	"trpc.group/trpc-go/trpc-a2a-go/v2/client"
	"trpc.group/trpc-go/trpc-a2a-go/v2/protocol"
	"trpc.group/trpc-go/trpc-a2a-go/v2/server"
	"trpc.group/trpc-go/trpc-agent-go/agent"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

// ConvertToA2AMessageFunc is the function signature for converting an invocation to an A2A protocol message.
type ConvertToA2AMessageFunc func(agentName string, invocation *agent.Invocation) (*protocol.Message, error)

// BuildMessageHook wraps the A2A message conversion with additional functionality.
// The hook receives the next converter function and returns a new converter function.
// Users can modify the invocation before calling next, modify the message after calling next,
// or completely replace the conversion logic by not calling next.
//
// This follows the same middleware pattern as server-side ProcessMessageHook.
type BuildMessageHook func(next ConvertToA2AMessageFunc) ConvertToA2AMessageFunc

// A2ADataPartToolResponse is a public tool response payload used by custom
// DataPart mappers.
type A2ADataPartToolResponse struct {
	ID      string
	Name    string
	Content string
}

// A2ADataPartMappingResult is the mapper-visible result holder used to enrich
// conversion output without depending on the converter's internal parseResult.
//
// Mappers receive a snapshot initialized from the current parse state. Changes
// are applied only when the mapper returns matched=true.
type A2ADataPartMappingResult struct {
	textContent            string
	reasoningContent       string
	toolCalls              []model.ToolCall
	toolResponses          []A2ADataPartToolResponse
	codeExecution          string
	codeExecutionResult    string
	eventExtensions        map[string]json.RawMessage
	textContentSet         bool
	reasoningContentSet    bool
	codeExecutionSet       bool
	codeExecutionResultSet bool
}

// GetTextContent returns the current text content snapshot.
func (r *A2ADataPartMappingResult) GetTextContent() string {
	if r == nil {
		return ""
	}
	return r.textContent
}

// SetTextContent overwrites text content when the mapper matches.
func (r *A2ADataPartMappingResult) SetTextContent(text string) {
	if r == nil {
		return
	}
	r.textContent = text
	r.textContentSet = true
}

// GetReasoningContent returns the current reasoning content snapshot.
func (r *A2ADataPartMappingResult) GetReasoningContent() string {
	if r == nil {
		return ""
	}
	return r.reasoningContent
}

// SetReasoningContent overwrites reasoning content when the mapper matches.
func (r *A2ADataPartMappingResult) SetReasoningContent(text string) {
	if r == nil {
		return
	}
	r.reasoningContent = text
	r.reasoningContentSet = true
}

// AppendToolCall appends a tool call when the mapper matches.
func (r *A2ADataPartMappingResult) AppendToolCall(call model.ToolCall) {
	if r == nil {
		return
	}
	r.toolCalls = append(r.toolCalls, call)
}

// AppendToolResponse appends a tool response when the mapper matches.
func (r *A2ADataPartMappingResult) AppendToolResponse(resp A2ADataPartToolResponse) {
	if r == nil {
		return
	}
	r.toolResponses = append(r.toolResponses, resp)
}

// GetCodeExecution returns the current executable code snapshot.
func (r *A2ADataPartMappingResult) GetCodeExecution() string {
	if r == nil {
		return ""
	}
	return r.codeExecution
}

// SetCodeExecution overwrites executable code when the mapper matches.
func (r *A2ADataPartMappingResult) SetCodeExecution(code string) {
	if r == nil {
		return
	}
	r.codeExecution = code
	r.codeExecutionSet = true
}

// GetCodeExecutionResult returns the current code execution result snapshot.
func (r *A2ADataPartMappingResult) GetCodeExecutionResult() string {
	if r == nil {
		return ""
	}
	return r.codeExecutionResult
}

// SetCodeExecutionResult overwrites code execution result when the mapper matches.
func (r *A2ADataPartMappingResult) SetCodeExecutionResult(result string) {
	if r == nil {
		return
	}
	r.codeExecutionResult = result
	r.codeExecutionResultSet = true
}

// SetEventExtension stores one serialized event extension when the mapper matches.
//
// This is useful for preserving custom A2A DataPart payloads through graph and
// server pipelines without forcing them into Message.Content.
func (r *A2ADataPartMappingResult) SetEventExtension(key string, value any) error {
	if r == nil || key == "" {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if r.eventExtensions == nil {
		r.eventExtensions = make(map[string]json.RawMessage)
	}
	r.eventExtensions[key] = cloneA2AExtensionRawMessage(raw)
	return nil
}

func cloneA2AExtensionRawMessage(raw json.RawMessage) json.RawMessage {
	if raw == nil {
		return nil
	}
	cloned := make([]byte, len(raw))
	copy(cloned, raw)
	return json.RawMessage(cloned)
}

func cloneA2AExtensions(
	extensions map[string]json.RawMessage,
) map[string]json.RawMessage {
	if len(extensions) == 0 {
		return nil
	}
	cloned := make(map[string]json.RawMessage, len(extensions))
	for key, raw := range extensions {
		cloned[key] = cloneA2AExtensionRawMessage(raw)
	}
	return cloned
}

// A2ADataPartMapper maps an inbound A2A DataPart into the default parser result.
//
// Built-in DataPart handling (function call/response, code execution) runs
// first. Mappers are invoked only when the DataPart is not consumed by the
// built-ins. Returning matched=true means this mapper consumed the part.
// Returning matched=false leaves the part ignored by the default converter.
// Returning an error aborts response conversion.
type A2ADataPartMapper func(part *protocol.Part, result *A2ADataPartMappingResult) (
	matched bool,
	err error,
)

// Option configures the A2AAgent
type Option func(*A2AAgent)

// WithName sets the name of agent
func WithName(name string) Option {
	return func(a *A2AAgent) {
		a.name = name
	}
}

// WithDescription sets the agent description
func WithDescription(description string) Option {
	return func(a *A2AAgent) {
		a.description = description
	}
}

// WithAgentCardURL sets the base URL used to discover the agent card from the
// standard well-known paths.
func WithAgentCardURL(url string) Option {
	return func(a *A2AAgent) {
		a.agentURL = strings.TrimSpace(url)
	}
}

// WithAgentCard set the agent card
func WithAgentCard(agentCard *server.AgentCard) Option {
	return func(a *A2AAgent) {
		a.agentCard = agentCard
	}
}

// WithCustomEventConverter adds a custom A2A event converter to the A2AAgent.
func WithCustomEventConverter(converter A2AEventConverter) Option {
	return func(a *A2AAgent) {
		a.eventConverter = converter
	}
}

// WithA2ADataPartMapper registers a lightweight inbound DataPart mapper on the
// default A2A event converter.
//
// If WithCustomEventConverter provides a custom converter, this mapper is
// ignored.
func WithA2ADataPartMapper(mapper A2ADataPartMapper) Option {
	return func(a *A2AAgent) {
		if mapper == nil {
			return
		}
		a.dataPartMappers = append(a.dataPartMappers, mapper)
	}
}

// WithCustomA2AConverter adds a custom A2A message converter to the A2AAgent.
// This converter will be used to convert invocations to A2A protocol messages.
func WithCustomA2AConverter(converter InvocationA2AConverter) Option {
	return func(a *A2AAgent) {
		a.a2aMessageConverter = converter
	}
}

// WithA2AClientExtraOptions adds extra options to the A2A client.
func WithA2AClientExtraOptions(opts ...client.Option) Option {
	return func(a *A2AAgent) {
		a.extraA2AOptions = append(a.extraA2AOptions, opts...)
	}
}

// WithStreamingChannelBufSize set the buf size of streaming protocol
func WithStreamingChannelBufSize(size int) Option {
	return func(a *A2AAgent) {
		if size < 0 {
			size = defaultStreamingChannelSize
		}
		a.streamingBufSize = size
	}
}

// WithTrans
```

### Core Architecture Module: `agent/a2aagent/v1/a2a_converter.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

package a2aagent

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"trpc.group/trpc-go/trpc-a2a-go/v2/protocol"

	"trpc.group/trpc-go/trpc-agent-go/agent"
	"trpc.group/trpc-go/trpc-agent-go/event"
	"trpc.group/trpc-go/trpc-agent-go/graph"
	ia2a "trpc.group/trpc-go/trpc-agent-go/internal/a2a"
	"trpc.group/trpc-go/trpc-agent-go/log"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

// A2AEventConverter defines an interface for converting A2A protocol types to Event.
type A2AEventConverter interface {
	// ConvertToEvents converts an A2A protocol type to multiple Events.
	// In non-streaming mode, A2A server returns a Task with history containing
	// intermediate messages (tool calls, tool responses, etc.) and artifacts for final response.
	ConvertToEvents(result protocol.SendMessageResponse, agentName string, invocation *agent.Invocation) ([]*event.Event, error)

	// ConvertStreamingToEvents converts a streaming A2A protocol type to Events.
	ConvertStreamingToEvents(result protocol.StreamResponse, agentName string, invocation *agent.Invocation) ([]*event.Event, error)
}

// InvocationA2AConverter defines an interface for converting invocations to A2A protocol messages.
type InvocationA2AConverter interface {
	// ConvertToA2AMessage converts an invocation to an A2A protocol Message.
	ConvertToA2AMessage(agentName string, invocation *agent.Invocation) (*protocol.Message, error)
}

type defaultA2AEventConverter struct {
	dataPartMappers []A2ADataPartMapper
}

func (d *defaultA2AEventConverter) ConvertToEvents(
	result protocol.SendMessageResponse,
	agentName string,
	invocation *agent.Invocation,
) ([]*event.Event, error) {
	if result.Result == nil {
		return []*event.Event{event.NewResponseEvent(
			invocation.InvocationID,
			agentName,
			&model.Response{Choices: []model.Choice{{Message: model.Message{Role: model.RoleAssistant, Content: ""}}}},
		)}, nil
	}

	var events []*event.Event
	appendMessage := func(msg *protocol.Message) error {
		evt, err := d.buildRespEvent(false, msg, agentName, invocation)
		if err != nil {
			return err
		}
		if evt != nil {
			events = append(events, evt)
		}
		return nil
	}

	switch v := result.Result.(type) {
	case *protocol.Message:
		// Single message: build event from its parts
		if err := appendMessage(v); err != nil {
			return nil, err
		}
	case *protocol.Task:
		// Task with history: convert history messages first, then artifacts
		// History contains intermediate messages (tool calls, tool responses, etc.)
		for i := range v.History {
			if err := appendMessage(&v.History[i]); err != nil {
				return nil, err
			}
		}
		if isTaskFailureState(v.Status.State) {
			statusMsg := convertTaskStatusToMessage(&protocol.TaskStatusUpdateEvent{
				TaskID:    v.ID,
				ContextID: v.ContextID,
				Metadata:  v.Metadata,
				Status:    v.Status,
			})
			if err := appendMessage(statusMsg); err != nil {
				return nil, err
			}
			break
		}
		// Message output mode stores the completed response in Status.Message
		// instead of Artifacts. Avoid adding it when artifacts are also present,
		// where Status.Message is status text rather than the task output.
		if len(v.Artifacts) == 0 && v.Status.Message != nil {
			statusMsg := convertTaskStatusToMessage(&protocol.TaskStatusUpdateEvent{
				TaskID:    v.ID,
				ContextID: v.ContextID,
				Metadata:  v.Metadata,
				Status:    v.Status,
			})
			if err := appendMessage(statusMsg); err != nil {
				return nil, err
			}
		}
		// Artifacts contain the final response
		for i := range v.Artifacts {
			artifactMsg := &protocol.Message{
				Role:      protocol.MessageRoleAgent,
				MessageID: v.Artifacts[i].ArtifactID,
				Parts:     v.Artifacts[i].Parts,
				Metadata: mergeTaskMetadata(
					v.Status.State,
					v.Artifacts[i].Metadata,
					v.Metadata,
				),
			}
			if err := appendMessage(artifactMsg); err != nil {
				return nil, err
			}
		}
	default:
		// Handle unknown response types
		responseMsg := &protocol.Message{
			Role:  protocol.MessageRoleAgent,
			Parts: []*protocol.Part{protocol.NewTextPart("Received unknown response type")},
		}
		if err := appendMessage(responseMsg); err != nil {
			return nil, err
		}
	}

	if len(events) > 0 {
		// Mark the last event as done
		events[len(events)-1].Done = true
		events[len(events)-1].IsPartial = false
	}
	return events, nil
}

func (d *defaultA2AEventConverter) ConvertStreamingToEvents(
	result protocol.StreamResponse,
	agentName string,
	invocation *agent.Invocation,
) ([]*event.Event, error) {
	if result.Result == nil {
		return []*event.Event{event.NewResponseEvent(
			invocation.InvocationID,
			agentName,
			&model.Response{Choices: []model.Choice{{Message: model.Message{Role: model.RoleAssistant, Content: ""}}}},
		)}, nil
	}

	var events []*event.Event
	var responseMsg *protocol.Message
	switch v := result.Result.(type) {
	case *protocol.Message:
		responseMsg = v
	case *protocol.Task:
		responseMsg = convertTaskToMessage(v)
	case *protocol.TaskStatusUpdateEvent:
		responseMsg = convertTaskStatusToMessage(v)
		if !isTaskFailureState(v.Status.State) &&
			!hasStructuredErrorMetadata(responseMsg.Metadata) {
			// A status message can carry the actual agent response (for example
			// input-required or a completed message-only result). Preserve it.
			// Empty lifecycle frames remain control signals; only response
			// metadata needs to cross the adapter boundary.
			if len(responseMsg.Parts) == 0 && !hasResponseMetadata(responseMsg.Metadata) {
				return nil, nil
			}
		}
	case *protocol.TaskArtifactUpdateEvent:
		responseMsg = convertTaskArtifactToMessage(v)
		if len(responseMsg.Parts) == 0 &&
			!hasResponseMetadata(responseMsg.Metadata) &&
			!hasStructuredErrorMetadata(responseMsg.Metadata) {
			return nil, nil
		}
	default:
		log.Infof("unexpected event type: %T", result.Result)
		return nil, nil
	}

	evt, err := d.buildRespEvent(true, responseMsg, agentName, invocation)
	if err != nil {
		return nil, err
	}
	if evt != nil {
		markTerminalStructuredErrorEvent(evt, result.Result)
		events = append(events, evt)
	}
	return events, nil
}

type defaultEventA2AConverter struct {
}

// ConvertToA2AMessage converts an event to an A2A protocol Message.
func (d *defaultEventA2AConverter) ConvertToA2AMessage(
	agentName string,
	invocation *agent.Invocation,
) (*protocol.Message, error) {
	parts := d.buildA2AParts(invocation)

	if len(parts) == 0 {
		parts = append(parts, protocol.NewTextPart(""))
	}
	message := protocol.NewMessage(protocol.MessageRoleUser, parts)
	sess := invocation.Session
	if sess != nil {
		message.ContextID = &sess.ID
	}

	message.Metadata = make(map[string]any)
	if invocation.InvocationID != "" {
		message.Metadata["invocation_id"] = invocation.InvocationID
	}
	if sess != nil && sess.UserID != "" {
		message.Metadata["user_id"] = sess.UserID
	}
	message.Metadata[ia2a.MessageMetadataInteractionSpecVersionKey] = ia2a.InteractionVersion

	return &message, nil
}

// buildA2AParts converts invocation message content and content parts to A2A protocol parts.
func (d *defaultEventA2AConverter) buildA2AParts(invocation *agent.Invocation) []*protocol.Part {
	var parts []*protocol.Part

	if invocation.Message.Content != "" {
		parts = append(parts, protocol.NewTextPart(invocation.Message.Content))
	}

	for _, contentPart := range invocation.Message.ContentParts {
		parts = appendContentPart(parts, contentPart)
	}

	return parts
}

// appendContentPart converts a single model.ContentPart and appends it to parts.
func appendContentPart(parts []*protocol.Part, cp model.ContentPart) []*protocol.Part {
	switch cp.Type {
	case model.ContentTypeText:
		return appendTextPart(parts, cp)
	case model.ContentTypeImage:
		return appendImagePart(parts, cp)
	case model.ContentTypeAudio:
		return appendAu
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2282** (2026-07-21): **telemetry/langfuse: avoid double-counting cached input tokens**
  *Symptoms*: ## What changed  Langfuse generation observations now report mutually exclusive input usage buckets. Cached input is no longer counted twice in displayed usage, totals, or inferred cost, while no-cache behavior and existing usage key names remain unchanged.  ## Why  Langfuse treats each flat `usage_details` key as a non-overlapping bucket and sums keys containing `input`. OpenAI-compatible and Gemini responses report cached tokens as a subset of their inclusive input count, so forwarding both values unchanged inflated input usage. Anthropic and Bedrock expose cache reads and cache creation separately; their compatibility cache alias must not be emitted as an additional bucket.  Fixes #2281  ## Testing  - `go test ./telemetry/langfuse -count=1` - `go test ./...` - `go build ./...` - Verified a synthetic Go exporter observation with input 100, cached input 30, and output 50 is stored as input 70 + cached 30 and aggregates to input 100, total 150. - Compared the result with Langfuse Python SDK flat-exclusive and OpenAI-schema observations. - Ran the Agent + Runner prompt-cache example against an OpenAI-compatible provider: all 6 turns completed, calculator and time tool calls succeeded, and 5 turns reported cache hits. A real sample with prompt 2495, cached 2304, and output 291 was stored as input 191 + cached 2304 and aggregated to input 2495, total 2786. Agent observations contributed no duplicate token usage.  ## Notes for reviewers  This intentionally changes externally obse
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/trpc-group/trpc-agent-go/pull/2282?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Path: .coderabbit.yaml  **Review profile**: CHILL  **Plan**: Pro  **Run ID**: `af70a789-0b2f-4b4c-8b9c-8c2c0af90e6d`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 2f05cf99a24b490d5fa6bc20481a5e14adc35a90 and 9c7a4bb082b49166f7380d9f2c913b7bfe6c9e46.  </details>  <details> <summary>📒 Files selected for processing (4)</summary>  * 
  > ## [Codecov](https://app.codecov.io/gh/trpc-group/trpc-agent-go/pull/2282?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 89.86090%. Comparing base ([`2f05cf9`](https://app.codecov.io/gh/trpc-group/trpc-agent-go/commit/2f05cf99a24b490d5fa6bc20481a5e14adc35a90?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group)) to head ([`9c7a4bb`](https://app.codecov.io/gh/trpc-group/trpc-agent-go/commit/9c7a4bb082b49166f7380d9f2c913b7bfe6c9e46?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group)). :warning: Report is 2 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@                 Co

- **Issue #2281** (2026-07-21): **telemetry/langfuse: avoid double-counting cached input tokens**
  *Symptoms*: **Describe the bug** The Langfuse exporter converts inclusive `gen_ai.usage.input_tokens` and its cached-token detail into flat `usage_details` without making the buckets mutually exclusive. Langfuse sums all usage keys containing `input`, so cached input is counted twice in the displayed usage and inferred cost.  **To Reproduce** 1. Export an LLM span with input tokens `100`, cached input tokens `30`, and output tokens `50`. 2. Inspect the generation observation in Langfuse. 3. The exporter stores `input=100`, `input_cached=30`, and `output=50`. 4. Langfuse reports input usage `130` and total usage `180`.  **Expected behavior** The flat usage buckets should be mutually exclusive: `input=70`, `input_cached=30`, and `output=50`. Langfuse should report input usage `100` and total usage `150`. Provider-specific cache-read/cache-creation buckets must also remain non-overlapping.  **Environment (please complete the following information):** - OS: Linux amd64 - Version: kernel 6.6 - Go version: go1.24.11 - tRPC-Agent-Go version: main at 0c777418  **Additional context** Langfuse documents that flat `usage_details` keys are mutually exclusive buckets: https://langfuse.com/docs/observability/features/token-and-cost-tracking
  **Post-Mortem & Fix Analysis**:
  >  用户反馈 langfuse 页面 token 的显示不合理，当前显示 input usage = input + input_cached， 但是实际的 input usage 应该为 input，其中 input_cache 应该是 input 的一部分。  <img width="635" height="394" alt="Image" src="https://github.com/user-attachments/assets/6f3b8be5-2ef1-46ca-b9ce-31cb16c06c56" />

- **Issue #993** (2026-01-05): **server/agui: respect the earlier of the request deadline and WithTimeout**
  *Symptoms*: Ensure AG-UI runs continue executing after the client request is canceled (for example, when the SSE connection is closed) while still respecting time limits by computing the execution deadline as the earlier of the request context deadline and the configured server-side timeout via agui.WithTimeout.  AG-UI runs now respect the earlier of the request deadline and agui.WithTimeout, while remaining resilient to SSE disconnects.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/trpc-group/trpc-agent-go/pull/993?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 90.25272%. Comparing base ([`6cc5903`](https://app.codecov.io/gh/trpc-group/trpc-agent-go/commit/6cc590389dac61131cfd06b737fd11780a260e66?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group)) to head ([`cf76976`](https://app.codecov.io/gh/trpc-group/trpc-agent-go/commit/cf76976cedd94dd086f62e401712193ea539114a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group)). :warning: Report is 4 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@                 Cov
  > https://github.com/trpc-group/trpc-agent-go/pull/980#discussion_r2659479122 <img width="822" height="316" alt="image" src="https://github.com/user-attachments/assets/fca2e82b-232b-47de-a8ec-d9a41e87435b" />  --- 确实存在语义变更，但感觉是合理变更，原因如下： 1. 本PR之前，若用户关闭浏览器页面，则本次agent run将会被终止。由于被终止时，session中的事件可能还未完整（例如以toolcall事件结尾，但没有对应的toolresponse事件），这会导致下一轮 agent run请求 llm 时报错 400 bad request，感觉这种行为是不合理的。 2. 根据用户反馈以及gpt web体验，关闭浏览器页面后，后端服务确实应该继续运行，不应该受到前端断连影响  关于原有的 timeout 进行了额外处理，最新实现只忽略前端主动cancel，真实超时时间=min(前端超时时间，后端超时时间)

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

### Incident Patch 1: `40ea803f` (2026-09-16)
**Commit Message**: session/inmemory: preserve initialization errors during shutdown (#2611)

## What changed

In-memory session-state initialization now distinguishes service
shutdown from caller cancellation and deadlines consistently. A
successful initializer no longer intermittently turns service shutdown
into `context.Canceled`. Cancellation that becomes visible while waiting
for either commit lock aborts before writing the primary value or its
projections.

## Why

The initializer context is canceled by both the caller and shutdown.
Previously, the post-initializer check classified shutdown separately,
but the commit path returned the child context's error directly. It also
checked cancellation only before acquiring the coordination and storage
locks, allowing a call canceled during lock contention to commit
successfully.

The commit path now checks the original caller context separately from
the close notification, rechecks cancellation after acquiring the
coordination lock, and checks again before the state batch is written
under the storage lock.

These windows have existed since 760a6184 (#2406, related to #2260). The
shutdown error mismatch surfaced in [the CI run for
#2609](https://github.

**File**: `session/inmemory/state_initialization.go` (modified, +23/-8)
```diff
@@ -44,7 +44,14 @@ func (g *stateInitializationGate) release() {
 	g.once.Do(func() { close(g.done) })
 }
 
-// LoadOrInitializeSessionState implements session.StateInitializationService.
+// LoadOrInitializeSessionState returns a valid persisted value for stateKey.
+// If the current value is absent or invalid, it coordinates initialization and
+// commits the replacement with its projections to the same session generation.
+// See session.StateInitializationService for the complete callback contract.
+//
+// Close cancels in-flight initializers and prevents further initialization
+// commits. After a successful initializer, lifecycle checks give an already
+// canceled caller context precedence over service closure.
 func (s *SessionService) LoadOrInitializeSessionState(
 	ctx context.Context,
 	key session.Key,
@@ -234,14 +241,14 @@ func (s *SessionService) initializeSessionState(
 		}
 		return nil, false, callbackErr
 	}
-	if err := initializeCtx.Err(); err != nil {
-		select {
-		case <-s.stateInitializationClosed:
-			return nil, false, errStateInitializationClosed
-		default:
-		}
+	if err := ctx.Err(); err != nil {
 		return nil, false, err
 	}
+	select {
+	case <-s.stateInitializationClosed:
+		return nil, false, errStateInitializationClosed
+	default:
+	}
 	value = cloneStateInitializationValue(value)
 	if !validate(cloneStateInitializationValue(value)) {
 		return nil, false, errors.New("initialize session state: callback returned an invalid value")
@@ -251,7 +258,7 @@ func (s *SessionService) initializeSessionState(
 		return nil, false, err
 	}
 	if err := s.commitInitializedSessionState(
-		initializeCtx,
+		ctx,
 		key,
 		generation,
 		state,
@@ -352,11 +359,16 @@ func (s *SessionService) commitInitializedSessionState(
 	generation *sessionWithTTL,
 	state session.StateMap,
 ) error {
+	// Use the caller context here; service closure is checked separately under
+	// the commit lock so its cancellation of the initializer cannot mask it.
 	if err := ctx.Err(); err != nil {
 		return err
 	}
 	s.stateInitializationMu.Lock()
 	defer s.stateInitializationMu.Unlock()
+	if err := ctx.Err(); err != nil {
+		return err
+	}
 	select {
 	case <-s.stateInitializationClosed:
 		return errStateInitializationClosed
@@ -382,6 +394,9 @@ func (s *SessionService) commitInitializedSessionState(
 			"memory session service initialize session state failed: session generation changed",
 		)
 	}
+	if err := ctx.Err(); err != nil {
+		return err
+	}
 	for stateKey, value := range state {
 		stored.session.SetState(stateKey, value)
 	}
```

**File**: `session/inmemory/state_initialization_test.go` (modified, +281/-1)
```diff
@@ -11,6 +11,7 @@ package inmemory
 import (
 	"context"
 	"errors"
+	"runtime"
 	"sync"
 	"sync/atomic"
 	"testing"
@@ -534,7 +535,286 @@ func TestLoadOrInitializeSessionStateCloseCancelsOwner(t *testing.T) {
 	<-ownerStarted
 
 	require.NoError(t, service.Close())
-	require.ErrorIs(t, <-ownerDone, context.Canceled)
+	err = <-ownerDone
+	require.ErrorIs(t, err, context.Canceled)
+	require.ErrorIs(t, err, errStateInitializationClosed)
+}
+
+func TestLoadOrInitializeSessionStateLifecycleBeforeCommit(t *testing.T) {
+	for _, phase := range []string{"initializer", "projection"} {
+		t.Run(phase, func(t *testing.T) {
+			for _, test := range []struct {
+				name       string
+				callerErr  error
+				closeFirst bool
+				closeLast  bool
+			}{
+				{name: "service close", closeFirst: true},
+				{name: "caller cancellation", callerErr: context.Canceled},
+				{name: "caller deadline", callerErr: context.DeadlineExceeded},
+				{name: "caller cancellation then close", callerErr: context.Canceled, closeLast: true},
+				{name: "caller deadline then close", callerErr: context.DeadlineExceeded, closeLast: true},
+				{name: "close then caller cancellation", callerErr: context.Canceled, closeFirst: true},
+				{name: "close then caller deadline", callerErr: context.DeadlineExceeded, closeFirst: true},
+			} {
+				t.Run(test.name, func(t *testing.T) {
+					ctx := context.Background()
+					key := session.Key{AppName: "app", UserID: "user", SessionID: "session"}
+					service := NewSessionService()
+					t.Cleanup(func() { require.NoError(t, service.Close()) })
+					_, err := service.CreateSession(ctx, key, nil)
+					require.NoError(t, err)
+
+					var callCtx context.Context
+					var cancel context.CancelFunc
+					if test.callerErr == context.DeadlineExceeded {
+						callCtx, cancel = context.WithTimeout(ctx, time.Second)
+					} else {
+						callCtx, cancel = context.WithCancel(ctx)
+					}
+					t.Cleanup(cancel)
+
+					wait := func(done <-chan struct{}) {
+						t.Helper()
+						select {
+						case <-done:
+						case <-time.After(5 * time.Second):
+							t.Fatal("state initialization lifecycle did not complete")
+						}
+					}
+					reached := make(chan context.Context, 1)
+					release := make(chan struct{})
+					var releaseOnce sync.Once
+					unblock := func() { releaseOnce.Do(func() { close(release) }) }
+					type result struct {
+						value       []byte
+						initialized bool
+						err         error
+					}
+					results := make(chan result, 1)
+					ownerDone := make(chan struct{})
+					t.Cleanup(func() {
+						cancel()
+						unblock()
+						wait(ownerDone)
+					})
+					go func() {
+						defer close(ownerDone)
+						var initializeCtx context.Context
+						value, initialized, err := service.LoadOrInitializeSessionState(
+							callCtx, key, "canonical",
+							func(value []byte) bool { return string(value) == "value" },
+							func(ctx context.Context) ([]byte, error) {
+								initializeCtx = ctx
+								if phase == "initializer" {
+									reached <- ctx
+									<-release
+								}
+								return []byte("value"), nil
+							},
+							session.StateInitializationProjection{
+								StateKey: "projected",
+								Project: func([]byte) ([]byte, error) {
+									// Hold the public call between its context check and commit.
+									if phase == "projection" {
+										reached <- initializeCtx
+										<-release
+									}
+									return []byte("projection"), nil
+								},
+							},
+						)
+						results <- result{value: value, initialized: initialized, err: err}
+					}()
+
+					var initializeCtx context.Context
+					select {
+					case initializeCtx = <-reached:
+					case <-time.After(5 * time.Second):
+						t.Fatal("state initialization did not reach the barrier")
+					}
+					if test.closeFirst {
+						require.NoError(t, service.Close())
+						wait(initializeCtx.Done())
+					}
+					if test.callerErr != nil {
+						if test.callerErr == context.Canceled {
+							
```

---

### Incident Patch 2: `44921489` (2026-09-09)
**Commit Message**: docs: add Memory blog (#2589)

Add memory.md into docs

**File**: `docs/mkdocs.yml` (modified, +2/-0)
```diff
@@ -110,6 +110,7 @@ nav:
   - Ecosystem: ecosystem.md
   - Blog:
       - "A Go Agent Framework for Building Intelligent AI Applications": blog/trpcagentgo.md
+      - "tRPC-Agent-Go Memory: How Agent Memory Is Formed, Retrieved, and Connected to External Platforms": blog/memory.md
       - "Context Management Design and Evaluation for Long-Running Agents": blog/summary.md
       - "tRPC-Agent-Go Evolution: Online Learning, Offline Optimization, and Evaluation for Self-Improving Agents": blog/evolution.md
       - "Seeing the Agent Runtime: Observability Design in tRPC-Agent-Go": blog/observability.md
@@ -242,6 +243,7 @@ plugins:
             - 生态: ecosystem.md
             - 博客:
                 - "构建智能 AI 应用的 Go 语言 Agent 框架": blog/trpcagentgo.md
+                - "tRPC-Agent-Go Memory：Agent 记忆的形成、取回与外部记忆平台接入": blog/memory.md
                 - "长任务 Agent 上下文管理的设计与评测": blog/summary.md
                 - "tRPC-Agent-Go Evolution：Agent 自进化的在线学习、离线优化与评测": blog/evolution.md
                 - "看见 Agent 运行时：tRPC-Agent-Go 可观测的设计与取舍": blog/observability.md
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-preload-budget-en.svg` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">preload Selects a Memory Read Path from Its Budget</title>
+  <desc id="desc">A zero preload disables reading, a negative value reads all Entries, and a positive value reads N+1 Entries before searching for the most relevant N when the budget is exceeded. The model call continues if reading fails.</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+    <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#21A179"/>
+    </marker>
+    <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#8EA6BA"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="Inter, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">preload Chooses a Memory Read Path from Its Budget</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">A positive N is this turn's Memory budget; N+1 only decides whether search is needed</text>
+
+    <!-- Root -->
+    <circle cx="132" cy="444" r="62" fill="#3478F6"/>
+    <text x="132" y="452" fill="#FFFFFF" font-size="24" font-weight="500" text-anchor="middle">preload</text>
+
+    <!-- Three mode branches -->
+    <path d="M194 420C245 420 244 250 320 250" fill="none" stroke="#8EA6BA" stroke-width="4" marker-end="url(#arrow-gray)"/>
+    <path d="M194 444H320" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <path d="M194 468C245 468 244 646 320 646" fill="none" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+
+    <circle cx="348" cy="250" r="28" fill="#E8EEF5"/>
+    <text x="348" y="258" fill="#425D73" font-size="23" font-weight="500" text-anchor="middle">0</text>
+    <text x="397" y="245" fill="#425D73" font-size="22" font-weight="500">Disable preload</text>
+    <text x="397" y="276" fill="#71879B" font-size="17">Do not access Memory</text>
+
+    <circle cx="348" cy="444" r="28" fill="#DCEBFF"/>
+    <text x="348" y="452" fill="#174A7C" font-size="21" font-weight="500" text-anchor="middle">&lt;0</text>
+    <rect x="397" y="400" width="254" height="88" rx="18" fill="#EAF2FF" stroke="#8FB4E8" stroke-width="2"/>
+    <text x="524" y="438" fill="#174A7C" font-size="20" font-weight="500" text-anchor="middle">Read(limit=0)</text>
+    <text x="524" y="468" fill="#597188" font-size="17" text-anchor="middle">Read all Entries</text>
+
+    <circle cx="348" cy="646" r="28" fill="#DFF5EC"/>
+    <text x="348" y="654" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">&gt;0</text>
+    <rect x="397" y="602" width="220" height="88" rx="18" fill="#E4F6F0" stroke="#70BEA0" stroke-width="2"/>
+    <text x="507" y="640" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">Read N+1 first</text>
+    <text x="507" y="670" fill="#527969" font-size="17" text-anchor="middle">Detect budget overflow</text>
+
+    <!-- Positive N decision -->
+    <path d="M617 646H686" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+    <path d="M754 586 822 646 754 706 686 646Z" fill="#FFFFFF" stroke="#21A179" stroke-width="3"/>
+    <text x="754" y="640" fill="#176A50" font-size="18" font-weight="500" text-anchor="middle">Count</text>
+    <text x="754" y="665" fill="#176A50" font-size="18" font-weight="500" text-
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-preload-budget.svg` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">preload 根据预算选择记忆读取路径</title>
+  <desc id="desc">preload 为零时不读取，小于零时读取全部，大于零时先读取 N 加一条，并在超过预算时搜索最相关的 N 条；读取失败时模型调用继续。</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+    <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#21A179"/>
+    </marker>
+    <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#8EA6BA"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">preload 先看预算，再决定怎样读取 Memory</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">正数 N 是本轮的记忆预算，N+1 只用于判断是否需要搜索</text>
+
+    <!-- Root -->
+    <circle cx="132" cy="444" r="62" fill="#3478F6"/>
+    <text x="132" y="452" fill="#FFFFFF" font-size="24" font-weight="500" text-anchor="middle">preload</text>
+
+    <!-- Three mode branches -->
+    <path d="M194 420C245 420 244 250 320 250" fill="none" stroke="#8EA6BA" stroke-width="4" marker-end="url(#arrow-gray)"/>
+    <path d="M194 444H320" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <path d="M194 468C245 468 244 646 320 646" fill="none" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+
+    <circle cx="348" cy="250" r="28" fill="#E8EEF5"/>
+    <text x="348" y="258" fill="#425D73" font-size="23" font-weight="500" text-anchor="middle">0</text>
+    <text x="397" y="245" fill="#425D73" font-size="22" font-weight="500">关闭预加载</text>
+    <text x="397" y="276" fill="#71879B" font-size="17">不访问 Memory</text>
+
+    <circle cx="348" cy="444" r="28" fill="#DCEBFF"/>
+    <text x="348" y="452" fill="#174A7C" font-size="21" font-weight="500" text-anchor="middle">&lt;0</text>
+    <rect x="397" y="400" width="254" height="88" rx="18" fill="#EAF2FF" stroke="#8FB4E8" stroke-width="2"/>
+    <text x="524" y="438" fill="#174A7C" font-size="20" font-weight="500" text-anchor="middle">Read(limit=0)</text>
+    <text x="524" y="468" fill="#597188" font-size="17" text-anchor="middle">读取全部 Entry</text>
+
+    <circle cx="348" cy="646" r="28" fill="#DFF5EC"/>
+    <text x="348" y="654" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">&gt;0</text>
+    <rect x="397" y="602" width="220" height="88" rx="18" fill="#E4F6F0" stroke="#70BEA0" stroke-width="2"/>
+    <text x="507" y="640" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">先读 N+1 条</text>
+    <text x="507" y="670" fill="#527969" font-size="17" text-anchor="middle">探测是否超出预算</text>
+
+    <!-- Positive N decision -->
+    <path d="M617 646H686" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+    <path d="M754 586 822 646 754 706 686 646Z" fill="#FFFFFF" stroke="#21A179" stroke-width="3"/>
+    <text x="754" y="640" fill="#176A50" font-size="18" font-weight="500" text-anchor="middle">数量</text>
+    <text x="754" y="665" fill="#176A50" font-size="18" font-weight="500" text-anchor="middle">超过 N？</text>
+
+    <!-- No overflow -->
+    <path d="M754 586V530H925" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <text x="786" y="555" fill="#2F68C4" font-size="17">没有</text>
+    <rect x="937" y="493" width="
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-recall-checkpoints-en.svg` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">Memory Passes Four Gates Before Reaching an Answer</title>
+  <desc id="desc">The same rule passes through a Session Event, Memory Entry, Reader, model request, and final answer. Formation, retrieval, injection, or use can fail independently.</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="Inter, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">An Agent Can Forget at Four Different Gates</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">Trace the same information forward to find where the path broke</text>
+
+    <!-- One information token travels through the whole path -->
+    <rect x="610" y="164" width="380" height="62" rx="14" fill="#FFF2D9" stroke="#E7B65A" stroke-width="2"/>
+    <path d="M642 181h23l9 9v20h-32Z" fill="#FFFFFF" stroke="#D49B32" stroke-width="2"/>
+    <path d="M665 181v9h9" fill="none" stroke="#D49B32" stroke-width="2"/>
+    <text x="830" y="204" fill="#714C13" font-size="17" font-weight="500" text-anchor="middle">Rule moves through each stage</text>
+
+    <path d="M180 420H1392" fill="none" stroke="#BCD0E3" stroke-width="12" stroke-linecap="round"/>
+
+    <!-- Connectors -->
+    <g fill="none" stroke="#3478F6" stroke-width="5" marker-end="url(#arrow)">
+      <line x1="256" y1="420" x2="396" y2="420"/>
+      <line x1="546" y1="420" x2="686" y2="420"/>
+      <line x1="836" y1="420" x2="976" y2="420"/>
+      <line x1="1126" y1="420" x2="1266" y2="420"/>
+    </g>
+
+    <!-- Stage 1: Session Event -->
+    <g transform="translate(118 346)">
+      <path d="M20 0H104Q124 0 124 20V82Q124 102 104 102H58L30 126V102H20Q0 102 0 82V20Q0 0 20 0Z" fill="#EAF2FF" stroke="#76A7F5" stroke-width="3"/>
+      <path d="M27 31h70M27 52h56M27 73h64" stroke="#3478F6" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="180" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Session Event</text>
+    <text x="180" y="582" fill="#657D92" font-size="18" text-anchor="middle">Original wording saved</text>
+
+    <!-- Stage 2: Memory Entry -->
+    <g transform="translate(418 355)">
+      <ellipse cx="53" cy="17" rx="53" ry="17" fill="#CFEEDF" stroke="#45A982" stroke-width="3"/>
+      <path d="M0 17v78c0 10 24 18 53 18s53-8 53-18V17" fill="#DFF5EC" stroke="#45A982" stroke-width="3"/>
+      <path d="M0 55c0 10 24 18 53 18s53-8 53-18" fill="none" stroke="#45A982" stroke-width="3"/>
+    </g>
+    <text x="470" y="550" fill="#176A50" font-size="23" font-weight="500" text-anchor="middle">Memory Entry</text>
+    <text x="470" y="582" fill="#657D92" font-size="18" text-anchor="middle">Long-term information formed</text>
+
+    <!-- Stage 3: Reader hit -->
+    <g transform="translate(704 352)">
+      <circle cx="49" cy="49" r="38" fill="#EAF2FF" stroke="#3478F6" stroke-width="4"/>
+      <line x1="77" y1="77" x2="108" y2="108" stroke="#3478F6" stroke-width="8" stroke-linecap="round"/>
+      <path d="M31 48h36M31 63h25" stroke="#3478F6" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="760" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Reader hit</text>
+    <text x="760" y="582" fill="#657D92" font-size="18" text-anchor="middle">Retrieved this turn</text>
+
+    <!-- Stage 4: request -->
+    <g transform="translate(1001 342)">
+      <path d="M0 0h82l3
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-recall-checkpoints.svg` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">记忆从会话进入回答要经过四个关口</title>
+  <desc id="desc">同一条规则依次经过 Session Event、Memory Entry、Reader、模型请求和最终回答。形成、取回、注入和采用中的任何一步都可能中断。</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">Agent 说「忘了」，信息可能停在四个关口</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">沿着同一条信息向后检查，才能知道问题发生在哪一步</text>
+
+    <!-- One information token travels through the whole path -->
+    <rect x="610" y="164" width="380" height="62" rx="14" fill="#FFF2D9" stroke="#E7B65A" stroke-width="2"/>
+    <path d="M642 181h23l9 9v20h-32Z" fill="#FFFFFF" stroke="#D49B32" stroke-width="2"/>
+    <path d="M665 181v9h9" fill="none" stroke="#D49B32" stroke-width="2"/>
+    <text x="696" y="204" fill="#714C13" font-size="20" font-weight="500">同一条规则沿链路向右传递</text>
+
+    <path d="M180 420H1392" fill="none" stroke="#BCD0E3" stroke-width="12" stroke-linecap="round"/>
+
+    <!-- Connectors -->
+    <g fill="none" stroke="#3478F6" stroke-width="5" marker-end="url(#arrow)">
+      <line x1="256" y1="420" x2="396" y2="420"/>
+      <line x1="546" y1="420" x2="686" y2="420"/>
+      <line x1="836" y1="420" x2="976" y2="420"/>
+      <line x1="1126" y1="420" x2="1266" y2="420"/>
+    </g>
+
+    <!-- Stage 1: Session Event -->
+    <g transform="translate(118 346)">
+      <path d="M20 0H104Q124 0 124 20V82Q124 102 104 102H58L30 126V102H20Q0 102 0 82V20Q0 0 20 0Z" fill="#EAF2FF" stroke="#76A7F5" stroke-width="3"/>
+      <path d="M27 31h70M27 52h56M27 73h64" stroke="#3478F6" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="180" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Session Event</text>
+    <text x="180" y="582" fill="#657D92" font-size="18" text-anchor="middle">原话已经保存</text>
+
+    <!-- Stage 2: Memory Entry -->
+    <g transform="translate(418 355)">
+      <ellipse cx="53" cy="17" rx="53" ry="17" fill="#CFEEDF" stroke="#45A982" stroke-width="3"/>
+      <path d="M0 17v78c0 10 24 18 53 18s53-8 53-18V17" fill="#DFF5EC" stroke="#45A982" stroke-width="3"/>
+      <path d="M0 55c0 10 24 18 53 18s53-8 53-18" fill="none" stroke="#45A982" stroke-width="3"/>
+    </g>
+    <text x="470" y="550" fill="#176A50" font-size="23" font-weight="500" text-anchor="middle">Memory Entry</text>
+    <text x="470" y="582" fill="#657D92" font-size="18" text-anchor="middle">长期信息已形成</text>
+
+    <!-- Stage 3: Reader hit -->
+    <g transform="translate(704 352)">
+      <circle cx="49" cy="49" r="38" fill="#EAF2FF" stroke="#3478F6" stroke-width="4"/>
+      <line x1="77" y1="77" x2="108" y2="108" stroke="#3478F6" stroke-width="8" stroke-linecap="round"/>
+      <path d="M31 48h36M31 63h25" stroke="#3478F6" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="760" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Reader 命中</text>
+    <text x="760" y="582" fill="#657D92" font-size="18" text-anchor="middle">本轮已经取回</text>
+
+    <!-- Stage 4: request -->
+    <g transform="translate(1001 342)">
+      <path d="M0 0h82l30 30v110H0Z" fill="#FFFFFF" stroke="#7DA9E7" stroke-width="3"/>
+      <path d="M82 0v30h30" fill="#DCEBFF" stroke="#7DA9E7" stroke-width="3"/>
+      <rect x="18" y="51" width="75" height="18" rx="5" fill="#FFF2D9"/>
+      <rec
```

---

### Incident Patch 3: `e737f583` (2026-09-03)
**Commit Message**: docs: fix A2A interaction guide links (#2575)

## What changed

Updated the A2A documentation links in the Chinese legacy and v1 guides
to use the published interaction guide URL, so the links remain
accessible after the source Markdown is synchronized to iWiki.

## Why

The relative links work within the MkDocs source tree but cannot be
resolved from the synchronized iWiki pages because the standalone
interaction guide is not published as a corresponding iWiki page.

## Testing

- `mkdocs build --strict -f docs/mkdocs.yml`
- Verified that the published A2A interaction guide URL returns HTTP
200.
- Verified that the built legacy and v1 pages contain the published
guide URL.

## Notes for reviewers

Documentation-only change; no public API or runtime behavior changes.

**File**: `docs/mkdocs/zh/a2a.md` (modified, +1/-1)
```diff
@@ -916,7 +916,7 @@ subAgent, _ := a2aagent.New(
 
 关于 A2A 协议中工具调用、代码执行、思考内容等事件的传递规范，以及 Metadata 字段定义、ADK 兼容模式、分布式追踪等详细说明，请参考独立文档：
 
-**[A2A 协议交互规范](a2a-interaction.md)**
+**[A2A 协议交互规范](https://trpc-group.github.io/trpc-agent-go/zh/a2a-interaction/)**
 
 该文档定义了 trpc-agent-go 在 A2A 协议之上的扩展规范，是 Client 和 Server 实现的标准参考。
 
```

**File**: `docs/mkdocs/zh/a2a_v1.md` (modified, +1/-1)
```diff
@@ -572,7 +572,7 @@ W3C trace context 会自动通过 HTTP header 传播。生产环境仍应通过
 
 旧版包还保留 `WithProcessorBuilder`、`WithTaskManagerBuilder`、`WithStreamingEventType`、`WithStreamingRespHandler` 和 `WithStructuredTaskErrors` 等兼容扩展点。它们用于维持既有 v0 应用行为，不代表 v1 的推荐设计；新代码应优先使用 v1 的统一 MessageProcessor、TaskManager 和 converter 扩展边界。
 
-工具调用、代码执行、reasoning 和 `state_delta` 使用的共享 metadata extension 见 [A2A 协议交互规范](a2a-interaction.md)。其中的 metadata key 与交互规范版本同时适用于旧版和 v1 包；`TextPart`、`DataPart`、小写 method 和流式 envelope 示例描述的是 v0.2.x wire model，v1 则通过统一 Part、Message、Artifact 和 Task update event 承载这些共享 metadata。
+工具调用、代码执行、reasoning 和 `state_delta` 使用的共享 metadata extension 见 [A2A 协议交互规范](https://trpc-group.github.io/trpc-agent-go/zh/a2a-interaction/)。其中的 metadata key 与交互规范版本同时适用于旧版和 v1 包；`TextPart`、`DataPart`、小写 method 和流式 envelope 示例描述的是 v0.2.x wire model，v1 则通过统一 Part、Message、Artifact 和 Task update event 承载这些共享 metadata。
 
 ### v0 Task 管理边界
 
```

---

### Incident Patch 4: `396360ce` (2026-08-31)
**Commit Message**: agent/llmagent: skip hidden child trace entries (#2498)

This keeps LLM execution trace reporting aligned with the exported
static structure by only creating child invocation trace steps and
applied surface IDs when the invocation maps to a static child node,
while preserving static child and team member traces.

**File**: `agent/llmagent/llm_agent.go` (modified, +16/-15)
```diff
@@ -1535,21 +1535,22 @@ func (a *LLMAgent) Run(ctx context.Context, invocation *agent.Invocation) (e <-c
 	a.setupInvocation(invocation)
 	var traceLease tracecapture.StepLease
 	if invocation.RunOptions.ExecutionTraceEnabled {
-		traceNodeID := agent.InvocationTraceNodeID(invocation)
-		traceCtx := agent.NewInvocationContext(ctx, invocation)
-		traceLease = tracecapture.EnsureInvocationStep(
-			traceCtx,
-			func() string {
-				return agent.StartExecutionTraceStep(
-					invocation,
-					traceNodeID,
-					llmAgentTraceInputSnapshot(invocation),
-					nil,
-				)
-			},
-		)
-		if traceLease.Owns {
-			tracecapture.SetStepNodeType(traceCtx, traceLease.StepID, "agent")
+		if traceNodeID := executionTraceStepNodeID(invocation); traceNodeID != "" {
+			traceCtx := agent.NewInvocationContext(ctx, invocation)
+			traceLease = tracecapture.EnsureInvocationStep(
+				traceCtx,
+				func() string {
+					return agent.StartExecutionTraceStep(
+						invocation,
+						traceNodeID,
+						llmAgentTraceInputSnapshot(invocation),
+						nil,
+					)
+				},
+			)
+			if traceLease.Owns {
+				tracecapture.SetStepNodeType(traceCtx, traceLease.StepID, "agent")
+			}
 		}
 	}
 	ctx = a.withWorkspace(ctx, invocation)
```

**File**: `agent/llmagent/surface_runtime.go` (modified, +58/-1)
```diff
@@ -10,6 +10,7 @@ package llmagent
 
 import (
 	"context"
+	"strings"
 
 	"trpc.group/trpc-go/trpc-agent-go/agent"
 	astructure "trpc.group/trpc-go/trpc-agent-go/agent/structure"
@@ -221,8 +222,9 @@ func (a *LLMAgent) skillToolFlagsForInvocation(
 }
 
 // ExecutionTraceAppliedSurfaceIDs reports the effective surfaces that affected one invocation step.
+// It returns nil when a shared-trace child invocation does not map to a static child node.
 func (a *LLMAgent) ExecutionTraceAppliedSurfaceIDs(inv *agent.Invocation) []string {
-	nodeID := agent.InvocationSurfaceRootNodeID(inv)
+	nodeID := executionTraceSurfaceNodeID(inv)
 	if nodeID == "" {
 		return nil
 	}
@@ -271,6 +273,61 @@ func (a *LLMAgent) ExecutionTraceAppliedSurfaceIDs(inv *agent.Invocation) []stri
 	return appliedSurfaceIDs
 }
 
+// executionTraceSurfaceNodeID returns the node id that can safely publish applied surfaces.
+func executionTraceSurfaceNodeID(inv *agent.Invocation) string {
+	if inv == nil {
+		return ""
+	}
+	nodeID := agent.InvocationSurfaceRootNodeID(inv)
+	if nodeID == "" {
+		return ""
+	}
+	if executionTraceUsesParentCapture(inv) && !executionTraceNodeIsUnderParent(inv) {
+		return ""
+	}
+	return nodeID
+}
+
+// executionTraceStepNodeID returns the static trace node id for an LLM step.
+func executionTraceStepNodeID(inv *agent.Invocation) string {
+	if inv == nil {
+		return ""
+	}
+	nodeID := agent.InvocationTraceNodeID(inv)
+	if nodeID == "" {
+		return ""
+	}
+	if executionTraceUsesParentCapture(inv) && !executionTraceNodeIsUnderParent(inv) {
+		return ""
+	}
+	return nodeID
+}
+
+// executionTraceUsesParentCapture reports whether an invocation participates in its parent's trace.
+func executionTraceUsesParentCapture(inv *agent.Invocation) bool {
+	parent := inv.GetParentInvocation()
+	return parent != nil &&
+		inv.RunOptions.ExecutionTraceEnabled &&
+		parent.RunOptions.ExecutionTraceEnabled
+}
+
+// executionTraceNodeIsUnderParent reports whether the invocation maps to a static child node.
+func executionTraceNodeIsUnderParent(inv *agent.Invocation) bool {
+	parent := inv.GetParentInvocation()
+	if parent == nil {
+		return false
+	}
+	parentNodeID := agent.InvocationTraceNodeID(parent)
+	nodeID := agent.InvocationTraceNodeID(inv)
+	if parentNodeID == "" || nodeID == "" || nodeID == parentNodeID {
+		return false
+	}
+	if rootNodeID := agent.InvocationTeamMemberTraceRoot(inv); rootNodeID != "" {
+		return nodeID == rootNodeID || strings.HasPrefix(nodeID, rootNodeID+"/")
+	}
+	return strings.HasPrefix(nodeID, parentNodeID+"/")
+}
+
 // InvocationToolSurface returns the invocation-scoped tool surface and user tool names.
 func (a *LLMAgent) InvocationToolSurface(
 	ctx context.Context,
```

**File**: `agent/llmagent/surface_runtime_test.go` (modified, +204/-0)
```diff
@@ -151,6 +151,210 @@ func TestLLMAgent_ExecutionTraceAppliedSurfaceIDs(t *testing.T) {
 	)
 }
 
+func TestLLMAgent_ExecutionTraceAppliedSurfaceIDs_SkipsNonStaticChildInvocation(t *testing.T) {
+	agt := New(
+		"router_intent_parser",
+		WithModel(newDummyModel()),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+	)
+	agent.SetInvocationSurfaceRootNodeID(parent, "workflow/classify")
+	child := parent.Clone()
+	agt.setupInvocation(child)
+	require.Equal(t, "workflow/classify", agent.InvocationSurfaceRootNodeID(child))
+	require.Nil(t, agt.ExecutionTraceAppliedSurfaceIDs(child))
+}
+
+func TestLLMAgent_Run_NonStaticChildInvocationDoesNotCreateTraceStep(t *testing.T) {
+	m := &captureModel{}
+	agt := New(
+		"router_intent_parser",
+		WithModel(m),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationMessage(model.NewUserMessage("hello")),
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+	)
+	child := parent.Clone(
+		agent.WithInvocationMessage(model.NewUserMessage("route")),
+	)
+	ch, err := agt.Run(context.Background(), child)
+	require.NoError(t, err)
+	for range ch {
+	}
+	require.NotNil(t, m.got)
+	trace := agent.BuildExecutionTrace(parent, atrace.TraceStatusCompleted)
+	require.NotNil(t, trace)
+	require.Empty(t, trace.Steps)
+}
+
+func TestLLMAgent_Run_ChildWithOwnTraceCaptureReportsTraceStep(t *testing.T) {
+	m := &captureModel{}
+	agt := New(
+		"router_intent_parser",
+		WithModel(m),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationMessage(model.NewUserMessage("hello")),
+	)
+	child := parent.Clone(
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+		agent.WithInvocationMessage(model.NewUserMessage("route")),
+	)
+	ch, err := agt.Run(context.Background(), child)
+	require.NoError(t, err)
+	for range ch {
+	}
+	require.NotNil(t, m.got)
+	require.Nil(t, agent.BuildExecutionTrace(parent, atrace.TraceStatusCompleted))
+	trace := agent.BuildExecutionTrace(child, atrace.TraceStatusCompleted)
+	require.NotNil(t, trace)
+	require.Len(t, trace.Steps, 1)
+	require.Equal(t, "router_intent_parser", trace.Steps[0].NodeID)
+	require.Contains(t, trace.Steps[0].AppliedSurfaceIDs, "router_intent_parser#instruction")
+}
+
+func TestLLMAgent_Run_StaticChildInvocationReportsTraceStep(t *testing.T) {
+	m := &captureModel{}
+	agt := New(
+		"router_intent_parser",
+		WithModel(m),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationMessage(model.NewUserMessage("hello")),
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+	)
+	child := parent.Clone(
+		agent.WithInvocationTraceNodeID("workflow/classify/router"),
+		agent.WithInvocationMessage(model.NewUserMessage("route")),
+	)
+	ch, err := agt.Run(context.Background(), child)
+	require.NoError(t, err)
+	for range ch {
+	}
+	require.NotNil(t, m.got)
+	trace := agent.BuildExecutionTrace(parent, atrace.TraceStatusCompleted)
+	require.NotNil(t, trace)
+	require.Len(t, trace.Steps, 1)
+	require.Equal(t, "workflow/classify/router", trace.Steps[0].NodeID)
+	require.Contains(t, trace.Steps[0].AppliedSurfaceIDs, "workflow/classify/router#instruction")
+}
+
+func TestLLMAgent_ExecutionTraceAppliedSurfaceIDs_UsesStaticChildInvocation(t *testing.T) {
+	agt := New(
+		"router_intent_parser",
+		WithModel(newDummyModel()),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		ag
```

**File**: `internal/teamtrace/teamtrace.go` (modified, +94/-5)
```diff
@@ -10,12 +10,73 @@
 package teamtrace
 
 import (
+	"context"
+
 	"trpc.group/trpc-go/trpc-agent-go/agent"
 	istructure "trpc.group/trpc-go/trpc-agent-go/internal/structure"
 )
 
 const memberTraceRootConfigsKey = "__trpc_agent_internal_team_member_trace_root__"
 
+const memberSurfaceRootStateKey = "__trpc_agent_internal_team_member_surface_root_state__"
+
+type memberMountContextKey struct{}
+
+// CoordinatorLayout describes static coordinator-team node ids under one root.
+type CoordinatorLayout struct {
+	CoordinatorNodeID string
+	MemberNodeIDs     []string
+}
+
+// MemberMount carries the concrete node ids for one mounted Team member call.
+type MemberMount struct {
+	TraceNodeID       string
+	SurfaceRootNodeID string
+}
+
+// NewCoordinatorLayout allocates coordinator and member node ids like static export.
+func NewCoordinatorLayout(rootNodeID string, members []agent.Agent) CoordinatorLayout {
+	allocator := istructure.NewPathAllocator(rootNodeID)
+	layout := CoordinatorLayout{
+		CoordinatorNodeID: allocator.Next("coordinator"),
+	}
+	if len(members) == 0 {
+		return layout
+	}
+	layout.MemberNodeIDs = make([]string, 0, len(members))
+	for _, member := range members {
+		memberName := ""
+		if member != nil {
+			memberName = member.Info().Name
+		}
+		layout.MemberNodeIDs = append(layout.MemberNodeIDs, allocator.Next(memberName))
+	}
+	return layout
+}
+
+// ContextWithMemberMount stores one mounted Team member path in ctx.
+func ContextWithMemberMount(ctx context.Context, mount MemberMount) context.Context {
+	if ctx == nil {
+		ctx = context.Background()
+	}
+	if mount.TraceNodeID == "" || mount.SurfaceRootNodeID == "" {
+		return ctx
+	}
+	return context.WithValue(ctx, memberMountContextKey{}, mount)
+}
+
+// MemberMountFromContext returns one mounted Team member path from ctx.
+func MemberMountFromContext(ctx context.Context) (MemberMount, bool) {
+	if ctx == nil {
+		return MemberMount{}, false
+	}
+	mount, ok := ctx.Value(memberMountContextKey{}).(MemberMount)
+	if !ok || mount.TraceNodeID == "" || mount.SurfaceRootNodeID == "" {
+		return MemberMount{}, false
+	}
+	return mount, true
+}
+
 // RootNodeID returns the mounted surface lookup root node id for one team invocation.
 func RootNodeID(inv *agent.Invocation, teamName string) string {
 	if inv != nil {
@@ -46,7 +107,7 @@ func MemberNodeID(rootNodeID string, memberName string) string {
 	return istructure.JoinNodeID(rootNodeID, memberName)
 }
 
-// WithMemberTraceRoot stores the mounted team root in custom configs.
+// WithMemberTraceRoot stores the mounted execution-trace root in custom configs.
 func WithMemberTraceRoot(cfgs map[string]any, rootNodeID string) map[string]any {
 	if rootNodeID == "" {
 		return cfgs
@@ -56,7 +117,7 @@ func WithMemberTraceRoot(cfgs map[string]any, rootNodeID string) map[string]any
 	return out
 }
 
-// MemberTraceRoot returns the mounted team root from custom configs.
+// MemberTraceRoot returns the mounted execution-trace root from custom configs.
 func MemberTraceRoot(cfgs map[string]any) string {
 	if cfgs == nil {
 		return ""
@@ -69,20 +130,48 @@ func MemberTraceRoot(cfgs map[string]any) string {
 	return rootNodeID
 }
 
-// SetMemberTraceRootForInvocation stores the mounted team root on one invocation.
+// SetMemberTraceRootForInvocation stores the mounted execution-trace root.
 func SetMemberTraceRootForInvocation(
 	inv *agent.Invocation,
 	rootNodeID string,
 ) {
 	agent.SetInvocationTeamMemberTraceRoot(inv, rootNodeID)
 }
 
-// ClearMemberTraceRootForInvocation removes the mounted team root from one invocation.
+// ClearMemberTraceRootForInvocation removes the mounted execution-trace root.
 func ClearMemberTraceRootForInvocation(inv *agent.Invocation) {
 	agent.ClearInvocationTeamMemberTraceRoot(inv)
 }
 
-// MemberTraceRootForInvocation returns the mounted team root for one invocation.
+// SetMemberSurfaceRootForInvocation stores the mounted Team member surface root.
+func SetMemberSurfaceRootForInvocation(
+	in
```

**File**: `internal/teamtrace/teamtrace_test.go` (modified, +99/-0)
```diff
@@ -9,13 +9,97 @@
 package teamtrace
 
 import (
+	"context"
 	"testing"
 
 	"github.com/stretchr/testify/require"
 	"trpc.group/trpc-go/trpc-agent-go/agent"
+	"trpc.group/trpc-go/trpc-agent-go/event"
 	"trpc.group/trpc-go/trpc-agent-go/internal/surfacepatch"
+	"trpc.group/trpc-go/trpc-agent-go/tool"
 )
 
+type layoutAgent string
+
+func (a layoutAgent) Run(
+	context.Context,
+	*agent.Invocation,
+) (<-chan *event.Event, error) {
+	ch := make(chan *event.Event)
+	close(ch)
+	return ch, nil
+}
+
+func (a layoutAgent) Tools() []tool.Tool { return nil }
+
+func (a layoutAgent) Info() agent.Info { return agent.Info{Name: string(a)} }
+
+func (a layoutAgent) SubAgents() []agent.Agent { return nil }
+
+func (a layoutAgent) FindSubAgent(string) agent.Agent { return nil }
+
+func TestNewCoordinatorLayout_UsesStaticExportOrder(t *testing.T) {
+	layout := NewCoordinatorLayout(
+		"workflow/team",
+		[]agent.Agent{
+			layoutAgent("member/one"),
+			layoutAgent("member~two"),
+		},
+	)
+	require.Equal(t, "workflow/team/coordinator", layout.CoordinatorNodeID)
+	require.Equal(t, []string{
+		"workflow/team/member~1one",
+		"workflow/team/member~0two",
+	}, layout.MemberNodeIDs)
+}
+
+func TestNewCoordinatorLayout_HandlesEmptyAndNilMembers(t *testing.T) {
+	empty := NewCoordinatorLayout("workflow/team", nil)
+	require.Equal(t, "workflow/team/coordinator", empty.CoordinatorNodeID)
+	require.Empty(t, empty.MemberNodeIDs)
+	layout := NewCoordinatorLayout(
+		"workflow/team",
+		[]agent.Agent{
+			nil,
+			layoutAgent(""),
+		},
+	)
+	require.Equal(t, []string{
+		"workflow/team/_",
+		"workflow/team/_~2",
+	}, layout.MemberNodeIDs)
+}
+
+func TestMemberMountContextHelpers(t *testing.T) {
+	mount := MemberMount{
+		TraceNodeID:       "trace/team/member",
+		SurfaceRootNodeID: "surface/team/member",
+	}
+	ctx := ContextWithMemberMount(context.Background(), mount)
+	got, ok := MemberMountFromContext(ctx)
+	require.True(t, ok)
+	require.Equal(t, mount, got)
+	ctx = ContextWithMemberMount(nil, mount)
+	got, ok = MemberMountFromContext(ctx)
+	require.True(t, ok)
+	require.Equal(t, mount, got)
+	ctx = ContextWithMemberMount(context.Background(), MemberMount{
+		TraceNodeID: "trace/team/member",
+	})
+	_, ok = MemberMountFromContext(ctx)
+	require.False(t, ok)
+	_, ok = MemberMountFromContext(context.WithValue(
+		context.Background(),
+		memberMountContextKey{},
+		MemberMount{TraceNodeID: "trace/team/member"},
+	))
+	require.False(t, ok)
+	_, ok = MemberMountFromContext(context.Background())
+	require.False(t, ok)
+	_, ok = MemberMountFromContext(nil)
+	require.False(t, ok)
+}
+
 func TestRootNodeID_PrefersMountedSurfaceRoot(t *testing.T) {
 	inv := agent.NewInvocation(
 		agent.WithInvocationTraceNodeID("trace/team"),
@@ -82,6 +166,21 @@ func TestMemberTraceRootForInvocation_PrefersInvocationStateAndFallsBackToConfig
 	require.Equal(t, "workflow/team/config", MemberTraceRootForInvocation(inv))
 }
 
+func TestMemberSurfaceRootForInvocation_StateHelpers(t *testing.T) {
+	var nilInv *agent.Invocation
+	SetMemberSurfaceRootForInvocation(nilInv, "workflow/team")
+	ClearMemberSurfaceRootForInvocation(nilInv)
+	require.Empty(t, MemberSurfaceRootForInvocation(nilInv))
+	inv := agent.NewInvocation()
+	require.Empty(t, MemberSurfaceRootForInvocation(inv))
+	SetMemberSurfaceRootForInvocation(inv, "workflow/team")
+	require.Equal(t, "workflow/team", MemberSurfaceRootForInvocation(inv))
+	SetMemberSurfaceRootForInvocation(inv, "")
+	require.Equal(t, "workflow/team", MemberSurfaceRootForInvocation(inv))
+	ClearMemberSurfaceRootForInvocation(inv)
+	require.Empty(t, MemberSurfaceRootForInvocation(inv))
+}
+
 func TestMemberTraceRootForInvocation_NilAndEmptyInput(t *testing.T) {
 	var nilInv *agent.Invocation
 	SetMemberTraceRootForInvocation(nilInv, "workflow/team")
```

---

### Incident Patch 5: `0292ce84` (2026-08-28)
**Commit Message**: {runner, docs}: add runner execution trace default (#2553)

## Summary

- add a Runner-local `WithExecutionTraceEnabled` default;
- preserve per-run `agent.WithExecutionTraceEnabled` overrides;
- cover direct Runner and AgentFactory construction paths;
- document the explicit opt-in behavior in English and Chinese.

This change is intentionally separate from the process-wide global
AfterRun Hook API.

## Tests

- `go test ./runner -run
'TestRunnerExecutionTraceDefault(AndPerRunOverride|AppliesToAgentFactory)$'`
- `go test -race ./runner -run
'TestRunnerExecutionTraceDefault(AndPerRunOverride|AppliesToAgentFactory)$'`

**File**: `docs/mkdocs/en/runner.md` (modified, +25/-0)
```diff
@@ -2027,6 +2027,31 @@ if err != nil {
 
 The default path is `/trpc-agent/v1/apps/{appName}`. `Describe` requests the remote structure, and `Run` requests the remote runs endpoint and restores the response into the framework-standard `event.Event` stream. For complete code, see `examples/trpcagent`.
 
+## Execution Trace Default (opt-in)
+
+Execution trace recording is disabled by default. A service that wants every
+run on a specific Runner to produce an execution trace can enable it once when
+constructing that Runner:
+
+```go
+r := runner.NewRunner("my-app", myAgent,
+    runner.WithExecutionTraceEnabled(true),
+)
+```
+
+This is a Runner-local default; it does not affect other Runners or telemetry
+integrations in the process. A single run can override the default:
+
+```go
+eventChan, err := r.Run(
+    ctx,
+    userID,
+    sessionID,
+    message,
+    agent.WithExecutionTraceEnabled(false),
+)
+```
+
 ## 📝 Summary
 
 The Runner component is a core part of the tRPC-Agent-Go framework, providing complete conversation management and Agent orchestration capabilities. By properly using session management, tool integration, and event handling, you can build powerful intelligent conversational applications.
```

**File**: `docs/mkdocs/zh/runner.md` (modified, +24/-0)
```diff
@@ -1947,6 +1947,30 @@ if err != nil {
 
 默认路径为 `/trpc-agent/v1/apps/{appName}`。`Describe` 请求远端 structure，`Run` 请求远端 runs 接口并恢复为框架标准 `event.Event` 流。更多完整代码可参考 `examples/trpcagent`。
 
+## ExecutionTrace 默认策略（显式开启）
+
+ExecutionTrace 默认关闭。如果一个服务希望某个 Runner 的每次运行都生成
+ExecutionTrace，可以在构造该 Runner 时统一开启：
+
+```go
+r := runner.NewRunner("my-app", myAgent,
+    runner.WithExecutionTraceEnabled(true),
+)
+```
+
+这是 Runner 局部默认值，不会影响进程中的其他 Runner 或 telemetry 集成。单次
+运行仍可覆盖该默认值：
+
+```go
+eventChan, err := r.Run(
+    ctx,
+    userID,
+    sessionID,
+    message,
+    agent.WithExecutionTraceEnabled(false),
+)
+```
+
 ## 📝 总结
 
 Runner 组件是 tRPC-Agent-Go 框架的核心，提供了完整的对话管理和 Agent 编排能力。通过合理使用会话管理、工具集成和事件处理，可以构建强大的智能对话应用。
```

**File**: `runner/runner.go` (modified, +17/-1)
```diff
@@ -188,6 +188,15 @@ func WithAwaitUserReplyRouting(enabled bool) Option {
 	}
 }
 
+// WithExecutionTraceEnabled sets whether execution tracing is enabled by
+// default for every run on the Runner. The default is false. A single run can
+// override this default with agent.WithExecutionTraceEnabled.
+func WithExecutionTraceEnabled(enabled bool) Option {
+	return func(opts *Options) {
+		opts.executionTraceEnabledDefault = enabled
+	}
+}
+
 // WithPersistInterruptedAssistant sets the runner default for whether a
 // cancelled streaming run persists already-emitted assistant text as a final
 // assistant message.
@@ -332,6 +341,7 @@ type runner struct {
 	candidateSelector                  CandidateSelector
 	candidateSelectOptions             candidateSelectOptions
 	awaitUserReplyRouting              bool
+	executionTraceEnabledDefault       bool
 	persistInterruptedAssistantDefault bool
 
 	// Resource management fields.
@@ -364,6 +374,7 @@ type Options struct {
 	candidateSelector                  CandidateSelector
 	candidateSelectOptions             candidateSelectOptions
 	awaitUserReplyRouting              bool
+	executionTraceEnabledDefault       bool
 	persistInterruptedAssistantDefault bool
 }
 
@@ -421,6 +432,7 @@ func NewRunner(appName string, ag agent.Agent, opts ...Option) Runner {
 		candidateSelector:                  options.candidateSelector,
 		candidateSelectOptions:             options.candidateSelectOptions,
 		awaitUserReplyRouting:              options.awaitUserReplyRouting,
+		executionTraceEnabledDefault:       options.executionTraceEnabledDefault,
 		persistInterruptedAssistantDefault: options.persistInterruptedAssistantDefault,
 		ownedSessionService:                ownedSessionService,
 	}
@@ -477,6 +489,7 @@ func NewRunnerWithAgentFactory(
 		candidateSelector:                  options.candidateSelector,
 		candidateSelectOptions:             options.candidateSelectOptions,
 		awaitUserReplyRouting:              options.awaitUserReplyRouting,
+		executionTraceEnabledDefault:       options.executionTraceEnabledDefault,
 		persistInterruptedAssistantDefault: options.persistInterruptedAssistantDefault,
 		ownedSessionService:                ownedSessionService,
 	}
@@ -544,7 +557,10 @@ func (r *runner) Run(
 		message.Role = model.RoleUser
 	}
 
-	ro := agent.RunOptions{RequestID: uuid.NewString()}
+	ro := agent.RunOptions{
+		RequestID:             uuid.NewString(),
+		ExecutionTraceEnabled: r.executionTraceEnabledDefault,
+	}
 	for _, opt := range runOpts {
 		opt(&ro)
 	}
```

**File**: `runner/runner_test.go` (modified, +109/-1)
```diff
@@ -58,6 +58,19 @@ type mockAgent struct {
 	name string
 }
 
+type executionTraceCapturingAgent struct {
+	*mockAgent
+	executionTraceEnabled bool
+}
+
+func (a *executionTraceCapturingAgent) Run(
+	ctx context.Context,
+	invocation *agent.Invocation,
+) (<-chan *event.Event, error) {
+	a.executionTraceEnabled = invocation.RunOptions.ExecutionTraceEnabled
+	return a.mockAgent.Run(ctx, invocation)
+}
+
 type repositoryOnlyAgent struct {
 	*mockAgent
 }
@@ -85,6 +98,93 @@ func TestRunnerRejectsSkillLoadsForUnsupportedAgent(t *testing.T) {
 	require.True(t, errors.Is(err, agent.ErrSkillLoadingUnsupported))
 }
 
+func TestRunnerExecutionTraceDefaultAndPerRunOverride(t *testing.T) {
+	tests := []struct {
+		name          string
+		runnerOptions []Option
+		runOptions    []agent.RunOption
+		wantEnabled   bool
+	}{
+		{
+			name:        "default disabled",
+			wantEnabled: false,
+		},
+		{
+			name:          "runner default enabled",
+			runnerOptions: []Option{WithExecutionTraceEnabled(true)},
+			wantEnabled:   true,
+		},
+		{
+			name:          "single run disables runner default",
+			runnerOptions: []Option{WithExecutionTraceEnabled(true)},
+			runOptions:    []agent.RunOption{agent.WithExecutionTraceEnabled(false)},
+			wantEnabled:   false,
+		},
+		{
+			name:          "single run enables disabled runner",
+			runnerOptions: []Option{WithExecutionTraceEnabled(false)},
+			runOptions:    []agent.RunOption{agent.WithExecutionTraceEnabled(true)},
+			wantEnabled:   true,
+		},
+	}
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			ag := &executionTraceCapturingAgent{
+				mockAgent: &mockAgent{name: "trace-capture"},
+			}
+			r := NewRunner("app", ag, test.runnerOptions...)
+			t.Cleanup(func() { require.NoError(t, r.Close()) })
+
+			events, err := r.Run(
+				context.Background(),
+				"user",
+				"session",
+				model.NewUserMessage("hello"),
+				test.runOptions...,
+			)
+			require.NoError(t, err)
+			var completion *event.Event
+			for evt := range events {
+				if evt != nil && evt.IsRunnerCompletion() {
+					completion = evt
+				}
+			}
+			assert.Equal(t, test.wantEnabled, ag.executionTraceEnabled)
+			require.NotNil(t, completion)
+			if test.wantEnabled {
+				assert.NotNil(t, completion.ExecutionTrace)
+			} else {
+				assert.Nil(t, completion.ExecutionTrace)
+			}
+		})
+	}
+}
+
+func TestRunnerExecutionTraceDefaultAppliesToAgentFactory(t *testing.T) {
+	var got agent.RunOptions
+	r := NewRunnerWithAgentFactory(
+		"app",
+		"factory-agent",
+		func(_ context.Context, runOptions agent.RunOptions) (agent.Agent, error) {
+			got = runOptions
+			return &mockAgent{name: "factory-agent"}, nil
+		},
+		WithExecutionTraceEnabled(true),
+	)
+	t.Cleanup(func() { require.NoError(t, r.Close()) })
+
+	events, err := r.Run(
+		context.Background(),
+		"user",
+		"session",
+		model.NewUserMessage("hello"),
+	)
+	require.NoError(t, err)
+	for range events {
+	}
+	assert.True(t, got.ExecutionTraceEnabled)
+}
+
 func TestRunnerRejectsRepositoryProviderWithoutSkillLoadSupport(t *testing.T) {
 	ag := &repositoryOnlyAgent{mockAgent: &mockAgent{name: "repository-only"}}
 	r := NewRunner("app", ag)
@@ -9688,7 +9788,15 @@ func TestProcessAgentEvents_EmitEventErrorBranch_Direct(t *testing.T) {
 
 	agentCh := make(chan *event.Event)
 	flushCh := make(chan *flush.FlushRequest)
-	processed := rr.processAgentEvents(ctx, sess, inv, agentCh, flushCh, nil, nil)
+	processed := rr.processAgentEvents(
+		ctx,
+		sess,
+		inv,
+		agentCh,
+		flushCh,
+		nil,
+		nil,
+	)
 	// Send one event, then close agentCh
 	go func() {
 		agentCh <- &event.Event{Response: &model.Response{Done: true, Choices: []model.Choice{{Index: 0, Message: model.NewAssistantMessage("x")}}}}
```

---

### Incident Patch 6: `eafe9949` (2026-08-27)
**Commit Message**: memory/redis: enforce memory limit atomically (#2535)

## What changed

`AddMemory` now enforces the per-user memory limit atomically during
concurrent writes.

Concurrent additions of different memory IDs cannot exceed the
configured limit. Overwriting an existing memory ID remains idempotent
and does not require additional capacity. The unlimited-memory path
remains unchanged.

## Why

The previous implementation performed `HLEN` and `HSET` as separate
Redis commands. Concurrent callers could observe the same available
capacity, pass the limit check, and then write different entries,
causing the final memory count to exceed the configured limit.

The capacity check and write are now performed in a single Lua script
using `HEXISTS`, `HLEN`, and `HSET`.

## Testing

- `go test ./...`
- `go test -race ./...`
- `go vet ./...`
- Added a concurrent regression test with eight callers and a limit of
one, verifying that only one new memory is stored.
- Verified that an existing memory ID can still be overwritten when the
limit is full.
- Covered script execution errors and unexpected script results.

## Notes for reviewers

- No exported API, Redis key format, or serialized data format ch

**File**: `docs/mkdocs/en/memory/redis.md` (modified, +15/-6)
```diff
@@ -28,12 +28,21 @@ if err != nil {
 
 **Note**: `WithRedisClientURL` takes priority over `WithRedisInstance`
 
-**Redis ACL requirement**: `UpdateMemory` uses a server-side Lua script to
-atomically validate and rotate memory IDs. ACL users must be allowed to run
-`EVALSHA` and `EVAL` (`EVAL` is required when the script is not yet cached), in
-addition to `HGET` and the script's `HEXISTS`, `HSET`, and `HDEL` commands and access to
-the configured memory-key pattern. Do not remove `EVAL` after warm-up because
-the Redis script cache can be cleared by a restart or `SCRIPT FLUSH`.
+**Redis ACL requirement**: The default per-user memory limit is `1000`. When the
+configured limit is positive, `AddMemory` uses a server-side Lua script to
+atomically check the capacity and write the memory. This script calls
+`HEXISTS`, `HLEN`, and `HSET`. `UpdateMemory` always uses a Lua script to
+atomically validate and rotate memory IDs; its update path uses `HGET`, and its
+script calls `HEXISTS`, `HSET`, and `HDEL`.
+
+ACL users must be allowed to run `EVALSHA` and `EVAL` (`EVAL` is required when
+a script is not yet cached), the commands used by both scripts, and access the
+configured memory-key pattern. Do not remove `EVAL` after warm-up because the
+Redis script cache can be cleared by a restart or `SCRIPT FLUSH`. Redis-compatible
+backends must support server-side Lua for these scripted paths.
+
+`WithMemoryLimit(0)` keeps `AddMemory` on the direct `HSET` path without a
+scripting dependency. `UpdateMemory` still uses Lua.
 
 **Key prefix example**:
 
```

**File**: `docs/mkdocs/zh/memory/redis.md` (modified, +13/-5)
```diff
@@ -27,11 +27,19 @@ if err != nil {
 
 **注意**：`WithRedisClientURL` 优先级高于 `WithRedisInstance`
 
-**Redis ACL 要求**：`UpdateMemory` 使用服务端 Lua 脚本，以原子方式校验并
-轮换记忆 ID。除 `HGET`、脚本使用的 `HEXISTS`、`HSET`、`HDEL` 命令和对应记忆 key
-访问权限外，ACL 用户还必须具有 `EVALSHA` 和 `EVAL` 权限；脚本尚未缓存时
-需要 `EVAL`。Redis 重启或执行 `SCRIPT FLUSH` 后脚本缓存可能被清除，因此
-不能只在预热阶段临时授予 `EVAL`。
+**Redis ACL 要求**：默认的每用户记忆上限为 `1000`。配置的上限为正数时，
+`AddMemory` 使用服务端 Lua 脚本，以原子方式检查容量并写入记忆；该脚本使用
+`HEXISTS`、`HLEN` 和 `HSET`。`UpdateMemory` 始终使用 Lua 脚本，以原子方式
+校验并轮换记忆 ID；其更新路径使用 `HGET`，脚本使用 `HEXISTS`、`HSET` 和
+`HDEL`。
+
+ACL 用户必须具有 `EVALSHA` 和 `EVAL` 权限（脚本尚未缓存时需要 `EVAL`）、
+两份脚本所用命令的权限，以及对应记忆 key 的访问权限。Redis 重启或执行
+`SCRIPT FLUSH` 后脚本缓存可能被清除，因此不能只在预热阶段临时授予 `EVAL`。
+在这些脚本路径下使用 Redis 兼容后端时，必须确认后端支持服务端 Lua。
+
+`WithMemoryLimit(0)` 会让 `AddMemory` 保持直接执行 `HSET` 的路径，不依赖
+Lua 脚本；`UpdateMemory` 仍然使用 Lua。
 
 **Key 前缀示例**：
 
```

**File**: `memory/redis/service.go` (modified, +44/-11)
```diff
@@ -31,13 +31,35 @@ const (
 	// defaultConnectionTimeout is the default timeout for Redis connection test.
 	defaultConnectionTimeout = 5 * time.Second
 
+	addMemoryResultSuccess = 0
+
 	updateMemoryResultNotFound = 0
 	updateMemoryResultSuccess  = 1
 	updateMemoryResultConflict = 2
 )
 
 var _ memory.Service = (*Service)(nil)
 
+// luaAddMemory atomically enforces the per-user limit for new memory IDs while
+// allowing an existing ID to be overwritten idempotently. A positive result is
+// the current memory count when the limit has been reached.
+var luaAddMemory = redis.NewScript(`
+local key = KEYS[1]
+local memoryID = ARGV[1]
+local entryJSON = ARGV[2]
+local memoryLimit = tonumber(ARGV[3])
+
+if redis.call('HEXISTS', key, memoryID) == 0 then
+    local count = redis.call('HLEN', key)
+    if count >= memoryLimit then
+        return count
+    end
+end
+
+redis.call('HSET', key, memoryID, entryJSON)
+return 0
+`)
+
 // luaUpdateMemory atomically updates a memory hash field and, when its
 // canonical ID changes, rejects an existing target before rotating the field.
 var luaUpdateMemory = redis.NewScript(`
@@ -156,17 +178,6 @@ func (s *Service) AddMemory(ctx context.Context, userKey memory.UserKey, memoryS
 	}
 	key := s.getUserMemKey(userKey)
 
-	if s.opts.memoryLimit > 0 {
-		count, err := s.redisClient.HLen(ctx, key).Result()
-		if err != nil && err != redis.Nil {
-			return fmt.Errorf("redis memory service check memory count failed: %w", err)
-		}
-		if int(count) >= s.opts.memoryLimit {
-			return fmt.Errorf("memory limit exceeded for user %s, limit: %d, current: %d",
-				userKey.UserID, s.opts.memoryLimit, count)
-		}
-	}
-
 	now := time.Now()
 	mem := &memory.Memory{
 		Memory:      memoryStr,
@@ -187,6 +198,28 @@ func (s *Service) AddMemory(ctx context.Context, userKey memory.UserKey, memoryS
 	if err != nil {
 		return fmt.Errorf("marshal memory entry failed: %w", err)
 	}
+	if s.opts.memoryLimit > 0 {
+		scriptResult, err := luaAddMemory.Run(
+			ctx,
+			s.redisClient,
+			[]string{key},
+			entry.ID,
+			string(bytes),
+			s.opts.memoryLimit,
+		).Int()
+		if err != nil {
+			return fmt.Errorf("store memory entry failed: %w", err)
+		}
+		switch {
+		case scriptResult == addMemoryResultSuccess:
+			return nil
+		case scriptResult > addMemoryResultSuccess:
+			return fmt.Errorf("memory limit exceeded for user %s, limit: %d, current: %d",
+				userKey.UserID, s.opts.memoryLimit, scriptResult)
+		default:
+			return fmt.Errorf("add memory entry returned unexpected result %d", scriptResult)
+		}
+	}
 	if err := s.redisClient.HSet(ctx, key, entry.ID, bytes).Err(); err != nil {
 		return fmt.Errorf("store memory entry failed: %w", err)
 	}
```

**File**: `memory/redis/service_test.go` (modified, +138/-7)
```diff
@@ -32,16 +32,60 @@ import (
 	"trpc.group/trpc-go/trpc-agent-go/tool"
 )
 
+// memoryLimitRaceHook makes legacy top-level HLEN calls observe the same
+// pre-write count. The atomic Lua path does not issue top-level HLEN commands.
+type memoryLimitRaceHook struct {
+	expected int
+	mu       sync.Mutex
+	seen     int
+	ready    chan struct{}
+}
+
 type rotationRaceHook struct {
 	once   sync.Once
 	inject func()
 }
 
-type updateMemoryScriptHook struct {
+type memoryScriptHook struct {
 	result int64
 	err    error
 }
 
+func (h *memoryLimitRaceHook) DialHook(next goredis.DialHook) goredis.DialHook {
+	return func(ctx context.Context, network, addr string) (net.Conn, error) {
+		return next(ctx, network, addr)
+	}
+}
+
+func (h *memoryLimitRaceHook) ProcessHook(next goredis.ProcessHook) goredis.ProcessHook {
+	return func(ctx context.Context, cmd goredis.Cmder) error {
+		err := next(ctx, cmd)
+		if err != nil || cmd.Name() != "hlen" {
+			return err
+		}
+
+		h.mu.Lock()
+		h.seen++
+		if h.seen == h.expected {
+			close(h.ready)
+		}
+		h.mu.Unlock()
+
+		select {
+		case <-h.ready:
+			return nil
+		case <-ctx.Done():
+			return ctx.Err()
+		}
+	}
+}
+
+func (h *memoryLimitRaceHook) ProcessPipelineHook(
+	next goredis.ProcessPipelineHook,
+) goredis.ProcessPipelineHook {
+	return next
+}
+
 func (h *rotationRaceHook) DialHook(next goredis.DialHook) goredis.DialHook {
 	return func(ctx context.Context, network, addr string) (net.Conn, error) {
 		return next(ctx, network, addr)
@@ -73,13 +117,13 @@ func (h *rotationRaceHook) ProcessPipelineHook(next goredis.ProcessPipelineHook)
 	}
 }
 
-func (h *updateMemoryScriptHook) DialHook(next goredis.DialHook) goredis.DialHook {
+func (h *memoryScriptHook) DialHook(next goredis.DialHook) goredis.DialHook {
 	return func(ctx context.Context, network, addr string) (net.Conn, error) {
 		return next(ctx, network, addr)
 	}
 }
 
-func (h *updateMemoryScriptHook) ProcessHook(next goredis.ProcessHook) goredis.ProcessHook {
+func (h *memoryScriptHook) ProcessHook(next goredis.ProcessHook) goredis.ProcessHook {
 	return func(ctx context.Context, cmd goredis.Cmder) error {
 		switch cmd.Name() {
 		case "eval", "evalsha":
@@ -98,7 +142,7 @@ func (h *updateMemoryScriptHook) ProcessHook(next goredis.ProcessHook) goredis.P
 	}
 }
 
-func (h *updateMemoryScriptHook) ProcessPipelineHook(
+func (h *memoryScriptHook) ProcessPipelineHook(
 	next goredis.ProcessPipelineHook,
 ) goredis.ProcessPipelineHook {
 	return next
@@ -630,7 +674,7 @@ func TestService_UpdateMemory_ScriptFailureLeavesResultUntouched(t *testing.T) {
 	require.NoError(t, err)
 	require.Len(t, entries, 1)
 
-	svc.redisClient.AddHook(&updateMemoryScriptHook{
+	svc.redisClient.AddHook(&memoryScriptHook{
 		err: fmt.Errorf("script failed"),
 	})
 	result := &memory.UpdateResult{MemoryID: "unchanged"}
@@ -698,7 +742,7 @@ func TestService_UpdateMemory_UnexpectedScriptResult(t *testing.T) {
 	require.NoError(t, err)
 	require.Len(t, entries, 1)
 
-	svc.redisClient.AddHook(&updateMemoryScriptHook{result: 99})
+	svc.redisClient.AddHook(&memoryScriptHook{result: 99})
 	result := &memory.UpdateResult{MemoryID: "unchanged"}
 	err = svc.UpdateMemory(
 		ctx,
@@ -779,12 +823,99 @@ func TestService_MemoryLimit(t *testing.T) {
 	ctx := context.Background()
 	userKey := memory.UserKey{AppName: "test-app", UserID: "u1"}
 
-	require.NoError(t, svc.AddMemory(ctx, userKey, "first", nil))
+	require.NoError(t, svc.AddMemory(ctx, userKey, "first", []string{"original"}))
+	require.NoError(t, svc.AddMemory(ctx, userKey, "first", []string{"updated"}))
+	entries, err := svc.ReadMemories(ctx, userKey, 10)
+	require.NoError(t, err)
+	require.Len(t, entries, 1)
+	assert.Equal(t, []string{"updated"}, entries[0].Memory.Topics)
+
 	err = svc.AddMemory(ctx, userKey, "second", nil)
 	require.Error(t, err)
 	assert.Contains(t, err.Error(), "memory limit exceeded")
 }
 
+func TestService_MemoryLimitConcurrentAddIsAtomic(t *testing.T) {
+	const concurrentAdds = 8
+
+	ur
```

---

### Incident Patch 7: `81b0f615` (2026-08-26)
**Commit Message**: tool: fix misleading mergeArrays doc comment and typo (#2536)

The mergeArrays doc comment claimed the function concatenates array
values into a new array, but the implementation returns only the first
element. Correct the comment to describe the actual behavior and fix the
'Plsease' typo.

<!-- markdownlint-disable MD041 -->

<!--
Write the pull request title and description in English.

The title must identify the primary affected package or repository area.

Preferred form:
  package: lowercase summary

For multiple equally affected packages:
  {package/a, package/b}: lowercase summary

For a coherent cross-cutting change spanning many packages with no
primary
package:
  lsc: lowercase summary
-->

## What changed

Summarize the outcome and its user or developer impact. Do not restate
the
implementation or enumerate changed files.

## Why

Explain the problem and any non-obvious design rationale.

## Testing

List the automated and manual validation that was actually performed. If
a
check is not applicable, explain why.

## Notes for reviewers

Optionally call out risks or design decisions that are not obvious from
the
diff, such as public API, compatibility, concurrency, persis

**File**: `tool/merge.go` (modified, +6/-2)
```diff
@@ -185,14 +185,18 @@ func mergeSlices[T any](ts []T) T {
 	return result.Interface().(T)
 }
 
-// mergeArrays concatenates array values into a new array
+// mergeArrays returns the first array in ts when ts is non-empty, or the zero
+// value of T otherwise. Arrays have a fixed length, so multiple arrays cannot
+// be concatenated into a single array of the same type without changing the
+// result's length; the remaining input arrays are therefore intentionally
+// discarded. Use slices instead when a variable-length result is required.
 func mergeArrays[T any](ts []T) T {
 	if len(ts) == 0 {
 		var zero T
 		return zero
 	}
 	// Note: Arrays are fixed size, so we assume all arrays in ts are of the same type and size.
-	// Plsease use slices if you need dynamic size.
+	// Please use slices if you need dynamic size.
 	return ts[0]
 }
 
```

---

### Incident Patch 8: `4ffda6cf` (2026-08-26)
**Commit Message**: session/mysql: fix async persistence log formatting (#2533)

## Fixes #2531 
## What changed

Summarize the outcome and its user or developer impact. Do not restate
the
implementation or enumerate changed files.

## Why

Explain the problem and any non-obvious design rationale.

## Testing

List the automated and manual validation that was actually performed. If
a
check is not applicable, explain why.

## Notes for reviewers

Optionally call out risks or design decisions that are not obvious from
the
diff, such as public API, compatibility, concurrency, persistence,
protocol, or
security concerns.

**File**: `session/mysql/service.go` (modified, +2/-2)
```diff
@@ -862,7 +862,7 @@ func (s *Service) startAsyncPersistWorker() {
 				if err := s.addEvent(ctx, eventPair.key, eventPair.event); err != nil {
 					log.ErrorfContext(
 						ctx,
-						"async persist event failed: %w",
+						"async persist event failed: %v",
 						err,
 					)
 				}
@@ -894,7 +894,7 @@ func (s *Service) startAsyncPersistWorker() {
 				if err := s.addTrackEvent(ctx, trackEventPair.key, trackEventPair.event); err != nil {
 					log.ErrorfContext(
 						ctx,
-						"async persist event failed: %w",
+						"async persist event failed: %v",
 						err,
 					)
 				}
```

---

### Incident Patch 9: `0e352fdd` (2026-08-21)
**Commit Message**: {examples/memory/tencentdb, memory/tencentdb, docs}: support tencentdb v3 data plane (#2491)

## What changed

This change adds opt-in support for the identity-scoped TencentDB Agent
Memory V3 data plane.

Existing callers continue to use `NewService(opts...)` for the Legacy
gateway API. New cloud and self-hosted V3 integrations create an opaque
`ServiceIdentity` with `NewServiceIdentity(serviceID, teamID, agentID)`
and pass it to `NewServiceWithIdentity(identity, opts...)`. The existing
session ingestor, preload recall, memory search tool, and conversation
search tool then use the corresponding V3 conversation, atomic memory,
scenario memory, and core memory endpoints.

V3 recall reads atomic, scenario, and core memory concurrently. It
propagates caller cancellation or deadline expiry after the concurrent
reads finish, returns available memory when only some levels otherwise
fail, and returns an error when all three reads fail. The adapter also
accepts both string and integer version fields returned by different
TencentDB Agent Memory deployments.

The TencentDB example and its English and Chinese documentation now
cover V3 configuration, cloud and self-hosted authentication, the 

**File**: `docs/mkdocs/en/memory/tencentdb.md` (modified, +108/-43)
```diff
@@ -1,48 +1,55 @@
 # TencentDB Agent Memory Integration (`memory/tencentdb`)
 
 `memory/tencentdb` integrates
-[TencentDB Agent Memory](https://github.com/Tencent/TencentDB-Agent-Memory)
-through its standalone gateway sidecar. It is suitable when you want the
-TencentDB Agent Memory SDK to own the L0-L3 memory pipeline while
-tRPC-Agent-Go keeps the Runner, session, plugin, and tool lifecycle in Go.
+[TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory)
+through its gateway. It is suitable when you want the TencentDB Agent Memory
+SDK to own the L0-L3 memory pipeline while tRPC-Agent-Go keeps the Runner,
+session, plugin, and tool lifecycle in Go.
 
 The boundary is intentionally different from built-in backends:
 
 - The TencentDB Agent Memory gateway performs capture, extraction, storage,
   recall, and search.
 - The Go adapter sends completed session turns through `session.Ingestor`.
-- A Runner plugin calls `/recall` before each model request and injects the
-  returned context (opt-in via `WithRecallEnabled(true)`).
+- A Runner plugin performs recall before each model request and injects the
+  returned context (opt-in via `WithRecallEnabled(true)`). Legacy mode calls
+  `/recall`; V3 composes L1 atomic search, L2 scene navigation, and L3 core
+  reads.
 - Native tools expose read-oriented search through `tdai_conversation_search`
   (session-scoped, on by default) and `tdai_memory_search` (opt-in via
-  `WithMemorySearchTool(true)`).
+  `WithMemorySearchTool(true)`). V3 integrations also expose
+  `tdai_read_scenario` to read bounded L2 content selected from scene
+  navigation.
 - An optional short-term context offload plugin delegates tool-result
   externalization, L1/L1.5/L2/L3 processing, drill-down, and persistence to
   TencentDB Agent Memory gateway hook APIs. The Go adapter does not write local
   offload files. It is separate from recall and is off by default.
 
-> **Multi-tenant note:** automatic recall and `tdai_memory_search` read from the
-> gateway's shared long-term store, which does not currently enforce
-> user/session scoping. They are therefore disabled by default; enable them only
-> when the gateway guarantees per-tenant isolation. Only session-scoped capture
-> and `tdai_conversation_search` are on by default.
+> **Multi-tenant note:** Legacy automatic recall and `tdai_memory_search` can
+> read a shared long-term store without user/session scoping. V3 scopes L0/L1
+> by service, team, agent, and user, while L2/L3 remain shared across users and
+> sessions of the same service, team, and agent. Recall and memory search remain
+> disabled by default to preserve existing behavior. `AppName` and
+> `WithSessionKeyFunc` are not V3 isolation fields; deployments that must keep
+> applications separate should assign distinct service, team, or agent
+> identities.
 
 Even when the SDK uses local SQLite storage, the gateway is still required
 because it hosts the memory engine. Direct VectorDB or SQLite access only talks
 to storage and does not run the SDK's extraction and recall pipeline.
 
-**Use case**: Sidecar memory engine, local or self-managed storage, automatic
+**Use case**: Gateway memory engine, cloud or self-managed storage, automatic
 recall before model calls, and external SDK-owned memory extraction.
 
 ## Start the TencentDB Agent Memory Gateway
 
-The [upstream package](https://github.com/Tencent/TencentDB-Agent-Memory/blob/main/package.json)
+The [upstream package](https://github.com/TencentCloud/TencentDB-Agent-Memory/blob/feat/server_team/MemoryCore/package.json)
 requires Node.js 22.16.0 or later. Clone the SDK repository and start the
 standalone gateway:
 
 ```bash
-git clone https://github.com/Tencent/TencentDB-Agent-Memory.git
-cd TencentDB-Agent-Memory
+git clone --branch feat/server_team --single-branch https://github.com/TencentCloud/TencentDB-Agent-Memory.git
+cd TencentDB-Agent-Memory/MemoryCore
 npm install
 
 export TDAI_LLM_API_KEY="your-openai-c
```

**File**: `docs/mkdocs/zh/memory/tencentdb.md` (modified, +90/-28)
```diff
@@ -1,39 +1,46 @@
 # TencentDB Agent Memory 集成（`memory/tencentdb`）
 
-`memory/tencentdb` 通过独立 gateway sidecar 接入
-[TencentDB Agent Memory](https://github.com/Tencent/TencentDB-Agent-Memory)。
+`memory/tencentdb` 通过 gateway 接入
+[TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory)。
 它适合把 L0-L3 记忆流水线交给 TencentDB Agent Memory SDK，而
 tRPC-Agent-Go 侧继续负责 Runner、Session、Plugin 和 Tool 生命周期的场景。
 
 这个集成与内置后端的边界不同：
 
 - TencentDB Agent Memory gateway 负责 capture、提取、存储、recall 和 search。
 - Go adapter 通过 `session.Ingestor` 把每轮完成后的会话内容发送给 gateway。
-- Runner plugin 在每次模型调用前请求 `/recall`，并把返回的上下文注入模型请求（需通过 `WithRecallEnabled(true)` 显式开启）。
-- 通过 `tdai_conversation_search`（按 session 作用域，默认开启）和 `tdai_memory_search`（需 `WithMemorySearchTool(true)` 显式开启）暴露只读检索工具。
+- Runner plugin 在每次模型调用前执行 recall，并把返回的上下文注入模型请求（需
+  通过 `WithRecallEnabled(true)` 显式开启）。Legacy 模式请求 `/recall`；
+  V3 会组合 L1 atomic search、L2 scene navigation 和 L3 core read。
+- 通过 `tdai_conversation_search`（按 session 作用域，默认开启）和
+  `tdai_memory_search`（需 `WithMemorySearchTool(true)` 显式开启）暴露只读检索工具。
+  V3 接入还会提供 `tdai_read_scenario`，按 scene navigation 返回的路径读取有界的
+  L2 内容。
 - 可选的短期上下文卸载 plugin 会把工具结果外置化、L1/L1.5/L2/L3、
   drill-down 和持久化委托给 TencentDB Agent Memory gateway hook API。
   Go adapter 不写本地 offload 文件。它与 recall 相互独立，默认关闭。
 
-> **多租户提示**：自动 recall 和 `tdai_memory_search` 会读取 gateway 的共享长期
-> 存储，而当前 gateway 并不会在这些路径上强制按 user/session 隔离，因此它们默认
-> 关闭，只有在 gateway 能保证按租户隔离时才应开启。默认只开启按 session 作用域的
-> capture 和 `tdai_conversation_search`。
+> **多租户提示**：Legacy 自动 recall 和 `tdai_memory_search` 可能读取未按
+> user/session 隔离的共享长期存储。V3 的 L0/L1 按 Service、Team、Agent、User
+> 隔离，L2/L3 则在相同 Service、Team、Agent 下跨 User 和 Session 共享。Recall
+> 和 memory search 仍默认关闭，以保持现有默认行为。`AppName` 和
+> `WithSessionKeyFunc` 不是 V3 隔离字段；需要隔离不同应用时，应为其分配不同的
+> Service、Team 或 Agent identity。
 
 即使 SDK 配置为本地 SQLite 存储，gateway 仍然是必需的，因为记忆引擎运行在
 gateway/SDK 侧。直接访问 VectorDB 或 SQLite 只能访问存储层，不会执行 SDK 的
 提取与召回流水线。
 
-**适用场景**：sidecar 记忆引擎、本地或自托管存储、模型调用前自动召回，以及由外部 SDK 托管的记忆提取。
+**适用场景**：gateway 记忆引擎、云端或自托管存储、模型调用前自动召回，以及由外部 SDK 托管的记忆提取。
 
 ## 启动 TencentDB Agent Memory Gateway
 
-[上游 package](https://github.com/Tencent/TencentDB-Agent-Memory/blob/main/package.json)
+[上游 package](https://github.com/TencentCloud/TencentDB-Agent-Memory/blob/feat/server_team/MemoryCore/package.json)
 要求 Node.js 22.16.0 或更高版本。先克隆 SDK 仓库并启动 standalone gateway：
 
 ```bash
-git clone https://github.com/Tencent/TencentDB-Agent-Memory.git
-cd TencentDB-Agent-Memory
+git clone --branch feat/server_team --single-branch https://github.com/TencentCloud/TencentDB-Agent-Memory.git
+cd TencentDB-Agent-Memory/MemoryCore
 npm install
 
 export TDAI_LLM_API_KEY="your-openai-compatible-api-key"
@@ -65,17 +72,26 @@ if gatewayURL == "" {
     gatewayURL = "http://127.0.0.1:8420"
 }
 
-memSvc, err := memorytencentdb.NewService(
+identity := memorytencentdb.NewServiceIdentity(
+    os.Getenv("TDAI_SERVICE_ID"),
+    os.Getenv("TDAI_TEAM_ID"),
+    os.Getenv("TDAI_AGENT_ID"),
+)
+memSvc, err := memorytencentdb.NewServiceWithIdentity(
+    identity,
     memorytencentdb.WithGatewayURL(gatewayURL),
-    // 跨 session/user 的读取属于 opt-in，仅在 gateway 可信/隔离时开启。
+    // 新接入的云端版和自建版都推荐启用身份隔离数据面；三个 ID 必填。
+    // 只有 gateway 启用共享密钥鉴权时才需要 API key；未配置时，adapter
+    // 会自动发送自建 gateway 解析器要求的非敏感 Bearer 占位值。
+    // memorytencentdb.WithAPIKey(os.Getenv("TDAI_GATEWAY_API_KEY")),
+    // Recall/search 保持 opt-in。
     memorytencentdb.WithRecallEnabled(true),
     memorytencentdb.WithMemorySearchTool(true),
     // 可选短期上下文卸载，通过 gateway v2 API 完成。
     // memorytencentdb.WithContextOffload(memorytencentdb.ContextOffloadConfig{
     //     Enabled:   true,
-    //     ServiceID: os.Getenv("TDAI_SERVICE_ID"),
+    //     ServiceID: os.Getenv("TDAI_OFFLOAD_SERVICE_ID"),
     // }),
-    // memorytencentdb.WithAPIKey(os.Getenv("TDAI_GATEWAY_API_KEY")),
 )
 if err != nil {
     panic(err)
@@ -105,8 +121,11 @@ defer r.Close()
 **接入要点**：
 
 - 通过 `llmagent.WithTools(memSvc.Tools())` 注册
```

**File**: `examples/memory/tencentdb/README.md` (modified, +108/-45)
```diff
@@ -13,22 +13,24 @@ The integration works in three parts:
 1. **Session ingestion** — After each conversation turn the Runner sends the
    new session transcript to the gateway via `runner.WithSessionIngestor(...)`.
 2. **Automatic recall** — Before each model call, `runner.WithPlugins(...)`
-   invokes the TencentDB recall endpoint and injects the returned context into
-   the model request. Recall is opt-in (`WithRecallEnabled(true)`).
+   performs TencentDB recall and injects the returned context into the model
+   request. Legacy calls `/recall`; V3 composes L1/L2/L3 reads. Recall is opt-in
+   (`WithRecallEnabled(true)`).
 3. **Read-only tools** — The agent can explicitly search memory through
    `tdai_memory_search` (opt-in via `WithMemorySearchTool(true)`) and
-   conversation history through `tdai_conversation_search`.
+   conversation history through `tdai_conversation_search`. V3 integrations
+   also expose `tdai_read_scenario` to read bounded L2 content selected from
+   scene navigation.
 4. **Context offload v2 (optional)** — Tool results are sent to
    `/v2/offload/ingest`; model context is compacted through
    `/v2/offload/compact`; and the agent can recover archived details with
    `tdai_read_offload_ref`, backed by `/v2/offload/read-ref`.
 
-> **Multi-tenant note:** automatic recall and `tdai_memory_search` read from the
-> gateway's shared long-term store, which does not currently enforce
-> user/session scoping. They are therefore disabled by default. Only the
-> session-scoped capture and `tdai_conversation_search` surfaces are on by
-> default. This demo enables recall and memory search explicitly because it runs
-> a single trusted local sidecar.
+> **Multi-tenant note:** automatic recall and `tdai_memory_search` remain
+> disabled by default for compatibility with legacy gateways. New cloud and
+> self-hosted integrations should use `NewServiceWithIdentity`; the current data
+> plane then scopes L0/L1 by service, team, agent, and user. L2/L3 are
+> intentionally shared at the team-and-agent level.
 
 ### Architecture
 
@@ -44,22 +46,28 @@ User message
       ▼
    Agent ──► LLM ──► Response
       │        │
-      │   (may call tdai_memory_search
-      │    or tdai_conversation_search)
+      │   (may call tdai_memory_search,
+      │    tdai_conversation_search, or
+      │    tdai_read_scenario)
       │
       ▼  (after turn completes)
- session.Ingestor ──► /capture
+ session.Ingestor ──► Legacy /capture or V3 /v3/conversation/add
 ```
 
 ### What This Example Does
 
 The program starts an interactive chat loop:
 
-1. Send a few messages that contain stable facts or preferences.
-2. Use `/new` to flush the current session and start a fresh session for the
-   same user.
-3. Ask related questions in the new session. The recall plugin and native
-   search tools can retrieve memories extracted by the gateway.
+1. Start the walkthrough with `-turn-wait` and send a message that contains
+   stable facts or preferences.
+2. Wait until the configured post-turn delay finishes and the next prompt
+   appears. This gives the gateway time for asynchronous extraction but is not
+   a readiness guarantee.
+3. Use `/new` to finish pending local capture work and start a fresh session for
+   the same user. Legacy gateways also receive `/session/end`; V3 has no remote
+   session-end or extraction-barrier endpoint.
+4. Ask related questions in the new session. V3 cross-session recall succeeds
+   after the gateway has extracted the previous turn into long-term memory.
 
 ## Prerequisites
 
@@ -78,8 +86,8 @@ pipeline.
 Clone the TencentDB Agent Memory repository and start the standalone gateway:
 
 ```bash
-git clone https://github.com/Tencent/TencentDB-Agent-Memory.git
-cd TencentDB-Agent-Memory
+git clone --branch feat/server_team --single-branch https://github.com/TencentCloud/TencentDB-Agent-Memory.git
+cd TencentDB-Agent-Memory/MemoryCore
 npm install
 
 export TDAI_LLM_API_KEY="your-openai-compatible-a
```

**File**: `examples/memory/tencentdb/main.go` (modified, +79/-17)
```diff
@@ -64,22 +64,37 @@ var (
 	gatewayAPIKey = flag.String(
 		"gateway-api-key",
 		os.Getenv("TDAI_GATEWAY_API_KEY"),
-		"Gateway API key sent as Authorization: Bearer; context offload v2 requires a non-empty value",
+		"Optional gateway API key sent as Authorization: Bearer; context offload v2 requires a non-empty value",
+	)
+	serviceID = flag.String(
+		"service-id",
+		os.Getenv("TDAI_SERVICE_ID"),
+		"TencentDB Agent Memory service ID; setting any identity ID enables the identity-scoped data plane",
+	)
+	teamID = flag.String(
+		"team-id",
+		os.Getenv("TDAI_TEAM_ID"),
+		"TencentDB Agent Memory team ID; setting any identity ID enables the identity-scoped data plane",
+	)
+	agentID = flag.String(
+		"agent-id",
+		os.Getenv("TDAI_AGENT_ID"),
+		"TencentDB Agent Memory agent ID; setting any identity ID enables the identity-scoped data plane",
 	)
 	offloadServiceID = flag.String(
 		"offload-service-id",
-		os.Getenv("TDAI_SERVICE_ID"),
+		os.Getenv("TDAI_OFFLOAD_SERVICE_ID"),
 		"TencentDB Agent Memory service ID; enables context offload v2 when a gateway API key is also configured",
 	)
-	waitBeforeRecall = flag.Duration(
+	turnWait = flag.Duration(
 		"turn-wait",
 		0,
-		"Delay after each user turn to wait for gateway capture/extraction",
+		"Fixed delay after each completed turn to allow asynchronous gateway extraction before cross-session recall",
 	)
 	endSession = flag.Bool(
 		"end-session",
 		false,
-		"Call TencentDB Agent Memory /session/end before exit",
+		"End the current session before exit; V3 waits for capture and Legacy calls /session/end",
 	)
 )
 
@@ -97,10 +112,19 @@ func main() {
 	if offloadEnabled && strings.TrimSpace(*gatewayAPIKey) == "" {
 		log.Fatal("-gateway-api-key is required when -offload-service-id enables context offload v2")
 	}
+	identityEnabled := strings.TrimSpace(*serviceID) != "" ||
+		strings.TrimSpace(*teamID) != "" ||
+		strings.TrimSpace(*agentID) != ""
+	if identityEnabled && (strings.TrimSpace(*serviceID) == "" ||
+		strings.TrimSpace(*teamID) == "" ||
+		strings.TrimSpace(*agentID) == "") {
+		log.Fatal("-service-id, -team-id, and -agent-id are all required for the identity-scoped data plane; if TDAI_SERVICE_ID was previously used only for context offload, move it to TDAI_OFFLOAD_SERVICE_ID")
+	}
 
-	// Recall and the long-term memory_search tool are opt-in because the gateway
-	// does not enforce per-user/session scoping on those paths; enable them here
-	// for the demo, which runs a single trusted local sidecar.
+	// Recall and the long-term memory_search tool remain opt-in. The current
+	// identity-scoped data plane scopes L0/L1 by service/team/agent/user and
+	// L2/L3 by service/team/agent; legacy gateways should still be treated as
+	// trusted sidecars.
 	memoryOptions := []memorytencentdb.Option{
 		memorytencentdb.WithGatewayURL(*gatewayURL),
 		memorytencentdb.WithTimeout(*gatewayTimeout),
@@ -121,7 +145,23 @@ func main() {
 			),
 		)
 	}
-	memSvc, err := memorytencentdb.NewService(memoryOptions...)
+	var (
+		memSvc *memorytencentdb.Service
+		err    error
+	)
+	if identityEnabled {
+		identity := memorytencentdb.NewServiceIdentity(
+			*serviceID,
+			*teamID,
+			*agentID,
+		)
+		memSvc, err = memorytencentdb.NewServiceWithIdentity(
+			identity,
+			memoryOptions...,
+		)
+	} else {
+		memSvc, err = memorytencentdb.NewService(memoryOptions...)
+	}
 	if err != nil {
 		log.Fatalf("create TencentDB Agent Memory service: %v", err)
 	}
@@ -158,6 +198,14 @@ func main() {
 	if offloadEnabled {
 		fmt.Printf("Context offload: enabled (service=%s)\n", *offloadServiceID)
 	}
+	if identityEnabled {
+		fmt.Printf("Identity-scoped data plane: enabled (service=%s team=%s agent=%s)\n", *serviceID, *teamID, *agentID)
+		if *turnWait > 0 {
+			fmt.Printf("Post-turn extraction delay: %s\n", *turnWait)
+		} else {
+			fmt.Println("Post-turn extraction delay: disabled; V3 cross-session recall may not be ready immediately")
+		}
+	}
 	fmt.Printf("App: %s\nUser: %s\nSession:
```

**File**: `memory/tencentdb/client.go` (modified, +478/-12)
```diff
@@ -20,7 +20,10 @@ import (
 	"net/http"
 	"net/url"
 	"strings"
+	"sync"
 	"time"
+
+	"trpc.group/trpc-go/trpc-agent-go/log"
 )
 
 const (
@@ -30,21 +33,32 @@ const (
 	httpHeaderServiceID     = "X-TDAI-Service-Id"
 	httpContentTypeJSON     = "application/json"
 	httpAuthBearerPrefix    = "Bearer "
+	v3LocalBearerToken      = "local"
 
 	httpMethodGet  = "GET"
 	httpMethodPost = "POST"
 
-	pathCapture             = "/capture"
-	pathRecall              = "/recall"
-	pathSearchMemories      = "/search/memories"
-	pathSearchConversations = "/search/conversations"
-	pathEndSession          = "/session/end"
-	pathHealth              = "/health"
-	pathOffloadIngest       = "/v2/offload/ingest"
-	pathOffloadCompact      = "/v2/offload/compact"
-	pathOffloadReadRef      = "/v2/offload/read-ref"
-
-	maxErrorBodyPreview = 512
+	pathCapture              = "/capture"
+	pathRecall               = "/recall"
+	pathSearchMemories       = "/search/memories"
+	pathSearchConversations  = "/search/conversations"
+	pathEndSession           = "/session/end"
+	pathHealth               = "/health"
+	pathOffloadIngest        = "/v2/offload/ingest"
+	pathOffloadCompact       = "/v2/offload/compact"
+	pathOffloadReadRef       = "/v2/offload/read-ref"
+	pathV3ConversationAdd    = "/v3/conversation/add"
+	pathV3ConversationSearch = "/v3/conversation/search"
+	pathV3AtomicSearch       = "/v3/atomic/search"
+	pathV3ScenarioList       = "/v3/scenario/ls"
+	pathV3ScenarioRead       = "/v3/scenario/read"
+	pathV3CoreRead           = "/v3/core/read"
+
+	maxErrorBodyPreview           = 512
+	maxV3ConversationBatchSize    = 100
+	maxV3MessageContentUTF16Units = 8192
+	maxV3SearchQueryUTF16Units    = 2048
+	v3TruncationMarker            = "\n...[truncated]"
 )
 
 // APIError describes a non-2xx response returned by the gateway.
@@ -57,12 +71,21 @@ func (e *APIError) Error() string {
 	return fmt.Sprintf("tencentdb memory gateway request failed: status=%d body=%s", e.StatusCode, e.Body)
 }
 
+type apiMode uint8
+
+const (
+	apiModeLegacy apiMode = iota
+	apiModeV3
+)
+
 type gatewayClient struct {
 	baseURL      string
 	hc           *http.Client
 	timeout      time.Duration
 	maxBodyBytes int64
 	apiKey       string
+	mode         apiMode
+	identity     *serviceIdentity
 }
 
 type offloadGatewayClient struct {
@@ -71,6 +94,14 @@ type offloadGatewayClient struct {
 }
 
 func newGatewayClient(opts Options) (*gatewayClient, error) {
+	return newGatewayClientWithMode(opts, apiModeLegacy, nil)
+}
+
+func newGatewayClientWithMode(
+	opts Options,
+	mode apiMode,
+	identity *serviceIdentity,
+) (*gatewayClient, error) {
 	baseURL := strings.TrimRight(strings.TrimSpace(opts.GatewayURL), "/")
 	if baseURL == "" {
 		return nil, errors.New("tencentdb memory: gateway url is required")
@@ -90,12 +121,27 @@ func newGatewayClient(opts Options) (*gatewayClient, error) {
 	if maxBodyBytes <= 0 {
 		maxBodyBytes = defaultMaxBodyBytes
 	}
+	apiKey := strings.TrimSpace(opts.APIKey)
+	switch mode {
+	case apiModeLegacy:
+		if identity != nil {
+			return nil, errors.New("tencentdb memory: legacy API does not accept service identity")
+		}
+	case apiModeV3:
+		if err := validateServiceIdentity(identity); err != nil {
+			return nil, err
+		}
+	default:
+		return nil, fmt.Errorf("tencentdb memory: unsupported API mode: %d", mode)
+	}
 	return &gatewayClient{
 		baseURL:      baseURL,
 		hc:           hc,
 		timeout:      opts.Timeout,
 		maxBodyBytes: maxBodyBytes,
-		apiKey:       strings.TrimSpace(opts.APIKey),
+		apiKey:       apiKey,
+		mode:         mode,
+		identity:     identity,
 	}, nil
 }
 
@@ -134,6 +180,9 @@ func validCompactionRatio(ratio float64) bool {
 }
 
 func (c *gatewayClient) capture(ctx context.Context, req captureRequest) (*captureResponse, error) {
+	if c.usesV3API() {
+		return c.captureV3(ctx, req)
+	}
 	var rsp captureResponse
 	if err := c.doJSON(ctx, httpMethodPost, pathCapture, req, &rsp); err != nil {
 		return nil, err
@@ -142,6 +191,9 @@ func (c *gatew
```

---

### Incident Patch 10: `fc236c54` (2026-08-17)
**Commit Message**: agent: add execution trace step node type setter (#2478)

Expose a public execution trace helper for recording step node types,
allowing external agent implementations to populate NodeType without
importing internal trace capture packages while preserving existing
no-op behavior for nil, empty, disabled, or missing trace inputs.

**File**: `agent/execution_trace.go` (modified, +15/-0)
```diff
@@ -188,6 +188,21 @@ func SetExecutionTraceStepAppliedSurfaceIDs(inv *Invocation, stepID string) {
 	capture.SetStepAppliedSurfaceIDs(stepID, reporter.ExecutionTraceAppliedSurfaceIDs(inv))
 }
 
+// SetExecutionTraceStepNodeType records the semantic node type for one execution trace step.
+// It has no error return and silently does nothing when inv is nil, tracing is disabled or
+// unavailable, inputs are empty, or stepID is unknown.
+func SetExecutionTraceStepNodeType(inv *Invocation, stepID string, nodeType string) {
+	if inv == nil || stepID == "" || nodeType == "" {
+		return
+	}
+	inv.initializeExecutionTrace()
+	capture := inv.executionTraceCapture()
+	if capture == nil {
+		return
+	}
+	capture.SetStepNodeType(stepID, nodeType)
+}
+
 // SetExecutionTraceStepUsage records token usage for one execution trace step.
 func SetExecutionTraceStepUsage(inv *Invocation, stepID string, usage *model.Usage) {
 	if inv == nil || stepID == "" || usage == nil {
```

**File**: `agent/execution_trace_test.go` (modified, +26/-0)
```diff
@@ -217,6 +217,7 @@ func TestExecutionTraceHelpers_HandleNilAndDisabledInvocation(t *testing.T) {
 	assert.Empty(t, StartExecutionTraceStep(nilInv, "assistant", nil, nil))
 	FinishExecutionTraceStep(nilInv, "step-1", nil, nil)
 	SetExecutionTraceStepAppliedSurfaceIDs(nilInv, "step-1")
+	SetExecutionTraceStepNodeType(nilInv, "step-1", "agent")
 	SetExecutionTraceStepUsage(nilInv, "step-1", &model.Usage{TotalTokens: 1})
 	assert.Nil(t, NextExecutionTracePredecessors(nilInv))
 	assert.Nil(t, BuildExecutionTrace(nilInv, atrace.TraceStatusCompleted))
@@ -231,6 +232,9 @@ func TestExecutionTraceHelpers_HandleNilAndDisabledInvocation(t *testing.T) {
 	FinishExecutionTraceStep(disabled, "step-1", nil, nil)
 	FinishExecutionTraceStep(disabled, "", nil, nil)
 	SetExecutionTraceStepAppliedSurfaceIDs(disabled, "step-1")
+	SetExecutionTraceStepNodeType(disabled, "step-1", "agent")
+	SetExecutionTraceStepNodeType(disabled, "", "agent")
+	SetExecutionTraceStepNodeType(disabled, "step-1", "")
 	SetExecutionTraceStepUsage(disabled, "step-1", &model.Usage{TotalTokens: 1})
 	SetExecutionTraceStepUsage(disabled, "", &model.Usage{TotalTokens: 1})
 	SetExecutionTraceStepUsage(disabled, "step-1", nil)
@@ -281,6 +285,28 @@ func TestExecutionTraceHelpers_RecordAppliedSurfaceIDs(t *testing.T) {
 	assert.Equal(t, []string{"assistant#instruction", "assistant#model"}, executionTrace.Steps[0].AppliedSurfaceIDs)
 }
 
+func TestExecutionTraceHelpers_RecordStepNodeType(t *testing.T) {
+	inv := NewInvocation(
+		WithInvocationAgent(&mockAgent{name: "assistant"}),
+		WithInvocationRunOptions(RunOptions{ExecutionTraceEnabled: true}),
+		WithInvocationMessage(model.NewUserMessage("hello")),
+	)
+	stepID := StartExecutionTraceStep(
+		inv,
+		InvocationTraceNodeID(inv),
+		&atrace.Snapshot{Text: "input"},
+		nil,
+	)
+	require.NotEmpty(t, stepID)
+	SetExecutionTraceStepNodeType(inv, stepID, "agent")
+	SetExecutionTraceStepNodeType(inv, "missing-step", "tool")
+	FinishExecutionTraceStep(inv, stepID, &atrace.Snapshot{Text: "output"}, nil)
+	executionTrace := BuildExecutionTrace(inv, atrace.TraceStatusCompleted)
+	require.NotNil(t, executionTrace)
+	require.Len(t, executionTrace.Steps, 1)
+	assert.Equal(t, "agent", executionTrace.Steps[0].NodeType)
+}
+
 func TestExecutionTraceHelpers_RecordStepUsage(t *testing.T) {
 	inv := NewInvocation(
 		WithInvocationAgent(&mockAgent{name: "assistant"}),
```

**File**: `internal/tracecapture/capture.go` (modified, +4/-2)
```diff
@@ -185,8 +185,10 @@ func (c *Capture) setStepInput(stepID string, input *trace.Snapshot) {
 	c.steps[idx].Input = cloneSnapshot(input)
 }
 
-// setStepNodeType updates the semantic node type of one recorded step.
-func (c *Capture) setStepNodeType(stepID string, nodeType string) {
+// SetStepNodeType updates the semantic node type of one recorded step.
+// It has no error return and silently does nothing for nil receivers, empty inputs,
+// or unknown step IDs.
+func (c *Capture) SetStepNodeType(stepID string, nodeType string) {
 	if c == nil || stepID == "" || nodeType == "" {
 		return
 	}
```

**File**: `internal/tracecapture/invocation_step.go` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ func SetStepNodeType(ctx context.Context, stepID string, nodeType string) {
 	if !ok || runtime.capture == nil || stepID == "" || nodeType == "" {
 		return
 	}
-	runtime.capture.setStepNodeType(stepID, nodeType)
+	runtime.capture.SetStepNodeType(stepID, nodeType)
 }
 
 // MergeInvocationStepAppliedSurfaceIDs merges applied surface IDs into the
```

#### Recent Merged Pull Requests:
- **PR #2634** (2026-09-24): model/openai: make streaming accumulation linear (@mikemikimike)
- **PR #2629** (2026-09-23): {session/summary, internal/flow/llmflow}: honor configured summary token counters (@liuzengh)
- **PR #2626** (2026-09-21): session/summary: support explicit request input token budgets (@liuzengh)
- **PR #2623** (closed): fix(codeexecutor/local): collect workspace files on Windows (@vleij)
- **PR #2622** (2026-09-20): {session/summary, docs}: add context-aware skip recent callback (@Flash-LHR)
- **PR #2621** (2026-09-18): model/openai: prevent panics on negative streaming tool indices (@liuzengh)
- **PR #2620** (2026-09-18): session/mysql: avoid sorting event JSON during summary restore (@liuzengh)
- **PR #2618** (2026-09-18): tool/openapi: preserve options and isolate spec loader state (@gosomea)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
