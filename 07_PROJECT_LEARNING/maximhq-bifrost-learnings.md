# Forensic Learning Record (Deep Inspection): maximhq/bifrost

> **Canonical Artifact**: `07_PROJECT_LEARNING/maximhq-bifrost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/maximhq/bifrost](https://github.com/maximhq/bifrost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:22:27.888Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maximhq/bifrost`
- **Description**: Fastest enterprise AI gateway (50x faster than LiteLLM) with adaptive load balancer, cluster mode, guardrails, 1000+ models support & <100 µs overhead at 5k RPS.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8565 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/bifrost.go`
```
// Package bifrost provides the core implementation of the Bifrost system.
// Bifrost is a unified interface for interacting with various AI model providers,
// managing concurrent requests, and handling provider-specific configurations.
package bifrost

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"

	"github.com/maximhq/bifrost/core/keyselectors"
	"github.com/maximhq/bifrost/core/mcp"
	"github.com/maximhq/bifrost/core/mcp/codemode/starlark"
	"github.com/maximhq/bifrost/core/mcp/credstore"
	"github.com/maximhq/bifrost/core/providers/anthropic"
	"github.com/maximhq/bifrost/core/providers/azure"
	"github.com/maximhq/bifrost/core/providers/bedrock"
	"github.com/maximhq/bifrost/core/providers/bedrockmantle"
	"github.com/maximhq/bifrost/core/providers/cerebras"
	"github.com/maximhq/bifrost/core/providers/cohere"
	"github.com/maximhq/bifrost/core/providers/databricks"
	"github.com/maximhq/bifrost/core/providers/deepseek"
	"github.com/maximhq/bifrost/core/providers/elevenlabs"
	"github.com/maximhq/bifrost/core/providers/fireworks"
	"github.com/maximhq/bifrost/core/providers/gemini"
	"github.com/maximhq/bifrost/core/providers/githubcopilot"
	"github.com/maximhq/bifrost/core/providers/groq"
	"github.com/maximhq/bifrost/core/providers/huggingface"
	"github.com/maximhq/bifrost/core/providers/mistral"
	"github.com/maximhq/bifrost/core/providers/nebius"
	"github.com/maximhq/bifrost/core/providers/ollama"
	"github.com/maximhq/bifrost/core/providers/openai"
	"github.com/maximhq/bifrost/core/providers/opencode"
	"github.com/maximhq/bifrost/core/providers/openrouter"
	"github.com/maximhq/bifrost/core/providers/parasail"
	"github.com/maximhq/bifrost/core/providers/perplexity"
	"github.com/maximhq/bifrost/core/providers/replicate"
	"github.com/maximhq/bifrost/core/providers/runware"
	"github.com/maximhq/bifrost/core/providers/runway"
	"github.com/maximhq/bifrost/core/providers/sarvam"
	"github.com/maximhq/bifrost/core/providers/sgl"
	"github.com/maximhq/bifrost/core/providers/typesafe"
	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	"github.com/maximhq/bifrost/core/providers/vertex"
	"github.com/maximhq/bifrost/core/providers/vllm"
	"github.com/maximhq/bifrost/core/providers/wafer"
	"github.com/maximhq/bifrost/core/providers/xai"
	schemas "github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
)

// ChannelMessage represents a message passed through the request channel.
// It contains the request, response and error channels, and the request type.
type ChannelMessage struct {
	schemas.BifrostRequest
	Context        *schemas.BifrostContext
	Response       chan *schemas.BifrostResponse
	ResponseStream chan chan *schemas.BifrostStreamChunk
	Err            chan schemas.BifrostError
	queueSpan      schemas.SpanHandle // "queue-wait" span opened at enqueue, closed when a worker dequeues (or on release if the send never landed)
	sentAt         time.Time          // set by the worker immediately before sending the result/error, so tryRequest can measure the worker->caller goroutine-hop latency ("worker-handoff")
	// firstTokenTimeout is this stream attempt's TTFT deadline, or 0 for none.
	// handleStreamRequest decides it per attempt (never on the last one), so it
	// travels on the message rather than on the context the attempts share.
	firstTokenTimeout time.Duration
	// handoff arbitrates who owns the terminal value of a NON-streaming request.
	// Response/Err are cap-1 channels drained on acquire, so the worker's send is
	// always ready; once the caller's context ends, ctx.Done() is ready too and a
	// select picks between them uniformly at random (#6972). The claim makes it
	// deterministic: the worker claims before it sends and the caller then must
	// receive, or the caller abandons first and the worker bills and releases.
	handoff atomic.Int32
}

const (
	handoffOpen      int32 = iota // neither side has committed
	handoffClaimed                // worker will send; tryRequest must receive
	handoffAbandoned              // tryRequest left on ctx.Done; worker owns the value and the message
)

// claimDelivery is called by the worker before it sends a terminal value. False
// means tryRequest already abandoned the message: nobody will read the channel,
// so the worker bills the value itself and releases the message.
func (m *ChannelMessage) claimDelivery() bool {
	return m.handoff.CompareAndSwap(handoffOpen, handoffClaimed)
}

// abandonDelivery is called by tryRequest when its context ends before a value
// arrived. False means the worker already claimed delivery: the value is in (or
// about to enter) the buffer and the caller must receive it, since no one else
// will. After a successful abandon the caller must not touch the message again.
func (m *ChannelMessage) abandonDelivery() bool {
	if !m.handoff.CompareAndSwap(handoffOpen, handoffAbandoned) {
		return false
	}
	// The worker still writes response attributes and plugin logs, so the transport
	// must not flush the trace yet. Set on the CAS so every abandonment marks it.
	if m.Context != nil {
		if tracer, traceID, err := GetTracerFromContext(m.Context); err == nil {
			tracer.DeferTraceCompletion(traceID)
		}
	}
	return true
}

// Bifrost manages providers and maintains specified open channels for concurrent processing.
// It handles request routing, provider management, and response processing.
type Bifrost struct {
	ctx                 *schemas.BifrostContext
	cancel              context.CancelFunc
	account             schemas.Account                     // account interface
	llmPlugins          atomic.Pointer[[]schemas.LLMPlugin] // list of llm plugins
	mcpPlugins          atomic.Pointer[[]schemas.MCPPlugin] // list of mcp plugins
	providers           atomic.Pointer[[]schemas.Provider]  // list of providers
	requestQueues       sync.Map                            // provider request queues (thread-safe), stores *ProviderQueue
	waitGroups          sync.Map                            // wait groups for each provider (thread-safe)
	oldWorkerCleanups   sync.WaitGroup                      // tracks async cleanup of old workers after provider updates
	retiredWorkerWaits  sync.Map                            // provider old-worker cleanup wait groups (thread-safe), stores *sync.WaitGroup
	providerLifecycleMu sync.RWMutex                        // prevents provider updates from racing with shutdown cleanup waits
	providerMutexes     sync.Map                            // mutexes for each provider to prevent concurrent updates (thread-safe)
	channelMessagePool  sync.Pool                           // Pool for ChannelMessage objects, initial pool size is set in Init
	responseChannelPool sync.Pool                           // Pool for response channels, initial pool size is set in Init
	errorChannelPool    sync.Pool                           // Pool for error channels, initial pool size is set in Init
	responseStreamPool  sync.Pool                           // Pool for response stream channels, initial pool size is set in Init
	pluginPipelinePool  sync.Pool                           // Pool for PluginPipeline objects
	bifrostRequestPool  sync.Pool                           // Pool for BifrostRequest objects
	logger              schemas.Logger                      // logger instance, default logger is used if not provided
	tracer              atomic.Value                        // tracer for distributed tracing (stores schemas.Tracer, NoOpTracer if not configured)
	modelCatalog        schemas.ModelInfoProvider           // model pricing/capability catalog exposed to plugins via ctx.GetModelInfo (nil if not configured); set once from BifrostConfig at Init
	MCPManager          mcp.MCPManagerInterface             // MCP integration manager (nil if MCP not configured)
	mcpCredStore        schemas.MCPCredentialStore          // Per-call credential resolver for MCP tool execution (wraps oauth2Provider for OAuth-flavored auth types)
	mcpInitOnce         sync.Once                           // Ensures MCP manager is initialized only once
	dropExcessRequests  atomic.Bool                         // If true, in cases where the queue is full, requests will not wait for the queue to be empty and will be dropped instead.
	keySelector         schemas.KeySelector                 // Custom key selector function
	keyPoolFilter       schemas.KeyPoolFilter               // optional hook to veto keys before selection (nil = all eligible)
	kvStore             schemas.KVStore                     // optional KV store for session stickiness (nil = disabled)
	sessionAffinity     schemas.SessionAffinity             // decides which key a session stays on; never nil after Init
}

// ProviderQueue wraps a provider's request channel with lifecycle management
// to prevent "send on closed channel" panics during provider removal/update.
// Producers must check the closing flag or select on the done channel before sending.
//
// Why pq.queue is NEVER closed:
//
// Closing a channel in Go causes any concurrent send to that channel to panic
// ("send on closed channel"). There is always a TOCTOU window between a
// producer's isClosing() check and its select { case pq.queue <- msg: ... }:
// the producer could pass isClosing() while the queue is open, get preempted,
// and resume only after the queue is closed. Go's selectgo evaluates select
// cases in a random order, so even having case <-pq.done: in the same select
// does not protect against this — if selectgo evaluates the send case first on
// a closed channel it panics immediately via goto sclose, before reaching done.
//
// To close pq.queue safely you would need a sender-side WaitGroup so that
// signalClosing could wait for every in-flight producer to finish. That adds
// non-trivial overhead on the hot request path.
//
// Instead, pq.done is the sole shutdown signal. Receiving from a closed channel
// is always safe (returns the zero value im
```

### Core Architecture Module: `core/billingheader.go`
```
package bifrost

import "github.com/maximhq/bifrost/core/schemas"

// restoreResponsesBillingHeader runs after alias resolution so each attempt uses
// the actual destination family. Ingress already removed the metadata before
// sharing Input: non-Anthropic attempts need neither a scan nor a slice copy.
func restoreResponsesBillingHeader(ctx *schemas.BifrostContext, provider schemas.ModelProvider, r *schemas.BifrostResponsesRequest) *schemas.BifrostResponsesRequest {
	if r == nil {
		return r
	}
	if ctx != nil && ctx.Value(schemas.BifrostContextKeyUseRawRequestBody) == true && len(r.RawRequestBody) > 0 {
		return r // Native passthrough already carries the original billing block.
	}
	family := schemas.ResolveFamily(ctx, r.Model)
	if family == schemas.ModelFamilyAnthropic || (family == "" && schemas.ResolveBaseProvider(ctx, provider) == schemas.Anthropic) {
		return r.WithAnthropicBillingHeader()
	}
	return r
}

```

### Core Architecture Module: `core/decisionemulation.go`
```
package bifrost

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/bytedance/sonic"
	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	schemas "github.com/maximhq/bifrost/core/schemas"
)

// errDecisionNoContent is returned when an emulating response carries neither the
// emit_decision function call nor a JSON-object message body.
var errDecisionNoContent = errors.New("model returned no decision function call or structured output")

// isUnsupportedOperation reports whether an error is a provider's
// "operation not supported" signal (set by NewUnsupportedOperationError).
func isUnsupportedOperation(err *schemas.BifrostError) bool {
	return err != nil && err.Error != nil && err.Error.Code != nil && *err.Error.Code == "unsupported_operation"
}

// decisionSystemPrompt frames the judgment task for an emulating LLM.
const decisionSystemPrompt = "You are a judgment engine. Read the given state and answer every question by " +
	"calling the provided function exactly once. For each question emit the requested value and your " +
	"confidence from 0 to 1. For every choice and score question also report the full probability " +
	"distribution over its options or levels; the probabilities must sum to 1. For choice, select an option " +
	"with the highest probability. Base every answer only on the state; do not invent facts."

// emulateDecisionViaResponses answers a decision request through a general model
// when the provider has no native decision support. It runs against the provider's
// own Responses API - the richest interface every provider implements (natively on
// openai/anthropic/gemini, via chat translation elsewhere) - encoding the questions
// as a forced function tool and mapping the function-call arguments back to the
// neutral DecisionResponse shape. Used for both the primary path (an LLM named as
// the decision model) and fallbacks (an LLM after the native provider fails) - both
// flow through the same dispatch case.
func (bifrost *Bifrost) emulateDecisionViaResponses(
	ctx *schemas.BifrostContext,
	provider schemas.Provider,
	key schemas.Key,
	req *schemas.BifrostDecisionRequest,
) (*schemas.BifrostDecisionResponse, *schemas.BifrostError) {
	if req == nil || len(req.Questions) == 0 {
		return nil, providerUtils.NewBifrostBadRequestError("decision request requires at least one question")
	}
	// Extensions the caller asked to reach the wire (e.g. images) have no
	// meaning to an emulating chat model; refusing beats a silent text-only
	// answer.
	if len(req.ExtraParams) > 0 && ctx != nil {
		if passthrough, _ := ctx.Value(schemas.BifrostContextKeyPassthroughExtraParams).(bool); passthrough {
			keys := make([]string, 0, len(req.ExtraParams))
			for key := range req.ExtraParams {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			return nil, providerUtils.NewBifrostBadRequestError("decision emulation cannot honor native request extensions (" + strings.Join(keys, ", ") + "); route the request to a provider that serves them natively")
		}
	}

	tool, err := providerUtils.BuildDecisionResponsesTool(req.Questions)
	if err != nil {
		return nil, providerUtils.NewBifrostBadRequestError(err.Error())
	}

	// State as the user message: string verbatim, structured as sorted JSON.
	stateText, marshalErr := decisionStateText(req.State)
	if marshalErr != nil {
		return nil, providerUtils.NewBifrostBadRequestError("decision state could not be serialized: " + marshalErr.Error())
	}

	instructions := decisionSystemPrompt
	userRole := schemas.ResponsesInputMessageRoleUser
	toolChoice := decisionToolChoice(ctx, req.Provider, req.Model)
	responsesReq := &schemas.BifrostResponsesRequest{
		Provider: req.Provider,
		Model:    req.Model,
		Input: []schemas.ResponsesMessage{
			{
				Role:    &userRole,
				Content: &schemas.ResponsesMessageContent{ContentStr: &stateText},
			},
		},
		Params: &schemas.ResponsesParameters{
			Instructions: &instructions,
			Tools:        []schemas.ResponsesTool{*tool},
			ToolChoice:   &schemas.ResponsesToolChoice{ResponsesToolChoiceStr: &toolChoice},
		},
	}

	resp, respErr := provider.Responses(ctx, key, responsesReq)
	if respErr != nil {
		return nil, respErr
	}

	argsJSON, extractErr := extractDecisionToolArguments(resp)
	if extractErr != nil {
		return nil, providerUtils.NewBifrostOperationError(extractErr.Error(), nil)
	}

	answers, parseErr := providerUtils.ParseDecisionAnswers([]byte(argsJSON), req.Questions)
	if parseErr != nil {
		return nil, providerUtils.NewBifrostOperationError(parseErr.Error(), nil)
	}

	decision := &schemas.BifrostDecisionResponse{
		Model:   modelForDecisionResponse(resp, req),
		Answers: answers,
	}
	// Carry the underlying response's id and resolved-model/latency metadata so
	// downstream pricing and integrations see the model that actually handled the
	// turn, not just the requested one. RequestType is deliberately not copied -
	// post-hooks run before final normalization.
	if resp != nil {
		if resp.ID != nil {
			decision.ID = *resp.ID
		}
		decision.ExtraFields.ResolvedModelUsed = resp.Model
		decision.ExtraFields.Latency = resp.ExtraFields.Latency
		if resp.Usage != nil {
			decision.Usage = resp.Usage.ToBifrostLLMUsage()
		}
	}
	// Provider/Model on ExtraFields drive downstream cost calculation.
	decision.ExtraFields.Provider = req.Provider
	decision.ExtraFields.OriginalModelRequested = req.Model
	return decision, nil
}

// decisionToolChoice picks the tool_choice that forces the emit_decision call.
// It prefers the "required" mode over a named-function choice: emit_decision is
// the only tool, so "required" obliges the model to call it, and the string mode
// is accepted by OpenAI, Anthropic, and OpenAI-compatible providers like
// Perplexity that reject the named-function object. Bedrock Mantle's
// OpenAI-compatible surface is the exception: it accepts only "auto" for gpt-oss
// ("Supported options: [auto]"), so the call there rests on the system prompt,
// and extraction already accepts a lone call or a JSON text body.
func decisionToolChoice(ctx *schemas.BifrostContext, provider schemas.ModelProvider, model string) string {
	if provider == schemas.BedrockMantle && !schemas.IsAnthropicModelFamily(ctx, model) {
		return string(schemas.ResponsesToolChoiceTypeAuto)
	}
	return string(schemas.ResponsesToolChoiceTypeRequired)
}

// decisionStateText renders the state into a message body.
func decisionStateText(state interface{}) (string, error) {
	if s, ok := state.(string); ok {
		return s, nil
	}
	raw, err := providerUtils.MarshalSorted(state)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

// modelForDecisionResponse prefers the model the response reported (the resolved
// model after any provider-side handoff), falling back to the request.
func modelForDecisionResponse(resp *schemas.BifrostResponsesResponse, req *schemas.BifrostDecisionRequest) string {
	if resp != nil && resp.Model != "" {
		return resp.Model
	}
	return req.Model
}

// extractDecisionToolArguments pulls the emit_decision function-call arguments from
// the Responses output items. Falls back to a lone function call, then to a plain
// output-text message for models that answered via native structured output.
func extractDecisionToolArguments(resp *schemas.BifrostResponsesResponse) (string, error) {
	if resp == nil || len(resp.Output) == 0 {
		return "", errDecisionNoContent
	}

	// Collect every function call, counting emit_decision calls separately, before
	// returning: a duplicate or ambiguous set must be rejected rather than silently
	// taking the first. Providers may drop MaxToolCalls/ParallelToolCalls on the
	// Responses-to-Chat fallback, so extraction cannot assume a single call.
	var namedCalls []string
	var allCalls []string
	for i := range resp.Output {
		item := resp.Output[i]
		if item.Type == nil || *item.Type != schemas.ResponsesMessageTypeFunctionCall {
			continue
		}
		if item.ResponsesToolMessage == nil || item.ResponsesToolMessage.Arguments == nil {
			continue
		}
		allCalls = append(allCalls, *item.ResponsesToolMessage.Arguments)
		if item.ResponsesToolMessage.Name != nil && *item.ResponsesToolMessage.Name == providerUtils.DecisionToolName {
			namedCalls = append(namedCalls, *item.ResponsesToolMessage.Arguments)
		}
	}
	switch {
	case len(namedCalls) > 1:
		return "", fmt.Errorf("model returned %d %s calls; expected exactly one", len(namedCalls), providerUtils.DecisionToolName)
	case len(namedCalls) == 1:
		return namedCalls[0], nil
	case len(allCalls) > 1:
		// No call round-tripped the name, and there is more than one - ambiguous.
		return "", fmt.Errorf("model returned %d tool calls with no unambiguous %s call", len(allCalls), providerUtils.DecisionToolName)
	case len(allCalls) == 1:
		// A single function call is acceptable even if the name did not round-trip.
		return allCalls[0], nil
	}

	// Native structured-output path: the JSON object arrives as output text.
	for i := range resp.Output {
		item := resp.Output[i]
		if item.Type != nil && *item.Type != schemas.ResponsesMessageTypeMessage {
			continue
		}
		if item.Content == nil {
			continue
		}
		if item.Content.ContentStr != nil && isJSONObject(*item.Content.ContentStr) {
			return *item.Content.ContentStr, nil
		}
		for _, block := range item.Content.ContentBlocks {
			if block.Text != nil && isJSONObject(*block.Text) {
				return *block.Text, nil
			}
		}
	}
	return "", errDecisionNoContent
}

// isJSONObject reports whether s parses as a JSON object.
func isJSONObject(s string) bool {
	var obj map[string]interface{}
	return sonic.Unmarshal([]byte(s), &obj) == nil
}

```

### Core Architecture Module: `core/encryptedreasoning.go`
```
package bifrost

import (
	"bytes"
	"strings"

	providerUtils "github.com/maximhq/bifrost/core/providers/utils"
	schemas "github.com/maximhq/bifrost/core/schemas"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// encryptedContentErrorCode is the error code OpenAI returns when a replayed
// reasoning item's encrypted_content cannot be verified for the request's upstream
// identity. The accompanying reason varies ("Encrypted content could not be
// decrypted or parsed", "Encrypted content item_id did not match the target item
// id"), so the code is the stable signal.
const encryptedContentErrorCode = "invalid_encrypted_content"

// encryptedReasoningFieldMarkers name the wire fields Bifrost's egress converters
// write a replayed reasoning item's encrypted_content into. One Responses payload
// reaches each provider as a different field, so each provider refuses it in its own
// vocabulary -- an OpenAI-only detector heals the OpenAI route and hands every other
// provider the raw 400:
//
//   - encrypted_content: OpenAI and Azure, forwarded verbatim.
//   - redacted_thinking: Anthropic on every platform it is served from (direct,
//     Vertex, Bedrock), via convertBifrostReasoningToAnthropicThinking, which maps
//     encrypted_content onto a redacted_thinking block's `data` field.
//   - thought_signature: Gemini and Vertex Gemini, via thoughtSignatureFromEncryptedContent.
//   - reasoningContent: Bedrock Converse, via reasoningSignatureForBedrock, which
//     carries the payload as the reasoning block's signature.
//
// Cohere is absent deliberately: it has no encrypted-reasoning field, so the payload
// travels as a marked thinking block that the upstream never validates. There is no
// refusal to catch.
//
// "encrypted content" (spaced) is the same field named in prose rather than by key.
// Bedrock Mantle's OpenAI-compatible /v1/responses surface refuses a foreign payload
// that way -- it mints its own `rsn_`/`smry_`-prefixed tokens and checks the prefix
// before it ever attempts to decrypt, so its 400 quotes neither the JSON key nor an
// item id. That is the exact refusal a fallback from Azure to Bedrock Mantle earns on
// the next turn, both hosting the same OpenAI-family model.
//
// The match is on the field name rather than on the sentence around it because the
// field names are Bifrost's own output -- they change only when a converter changes,
// and a converter change breaks these same tests. Upstream prose can be reworded at
// any time, and only OpenAI and Anthropic document theirs at all.
var encryptedReasoningFieldMarkers = []string{
	"encrypted_content",
	"encrypted content",
	"redacted_thinking",
	"thought_signature",
	"thoughtsignature",
	"reasoningcontent",
}

// unverifiablePayloadMarkers are the ways an upstream says the payload itself is
// unusable, as opposed to absent, too large, or in the wrong place.
//
// The prefix entries cover upstreams that reject on shape before attempting to
// decrypt. Bedrock Mantle stamps its own tokens (`rsn_` for the reasoning body,
// `smry_` for the summary) and refuses anything else with "missing recognized
// prefix", never reaching the vocabulary of decryption or verification. The verdict
// is the same as an outright decrypt failure -- this identity did not mint the
// payload -- so it earns the same fail-soft strip.
var unverifiablePayloadMarkers = []string{
	"invalid",
	"could not be verified",
	"cannot be verified",
	"could not be decrypted",
	"failed to verify",
	"malformed",
	"missing recognized prefix",
	"unrecognized prefix",
}

// unsupportedFieldMarkers are the ways an upstream says it does not accept the field at
// all, as opposed to accepting it and failing to verify what arrived in it. Bedrock
// Converse answers a replayed reasoning signature on a non-Anthropic model this way:
// "This model doesn't support the reasoningContent.reasoningText.signature field. Remove
// reasoningContent.reasoningText.signature and try again." That is what a mid-conversation
// model switch earns -- a Claude-minted signature replayed onto Kimi, GLM or DeepSeek --
// and the verdict matches an unverifiable payload: this model will never take the token,
// so it earns the same fail-soft strip.
var unsupportedFieldMarkers = []string{
	"does not support",
	"doesn't support",
}

// namesEncryptedReasoningField reports whether a lowercased error message points at
// the field this request's encrypted reasoning was written into.
func namesEncryptedReasoningField(message string) bool {
	for _, marker := range encryptedReasoningFieldMarkers {
		if strings.Contains(message, marker) {
			return true
		}
	}
	// Bedrock Converse names the field in prose rather than by key, and AWS does not
	// document the sentence, so a bare "signature" is accepted only alongside a
	// reasoning word. On its own it is far more likely to be a request-signing
	// failure -- SigV4 mismatch reads "the request signature we calculated does not
	// match" -- which stripping reasoning cannot fix.
	if !strings.Contains(message, "signature") {
		return false
	}
	return strings.Contains(message, "reasoning") ||
		strings.Contains(message, "thinking") ||
		strings.Contains(message, "thought")
}

func containsAnyMarker(message string, markers []string) bool {
	for _, marker := range markers {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

// reasoningTokenWords are the family names every upstream uses when it refuses a
// replayed reasoning token, whatever else the sentence says. OpenAI, Azure, xAI and
// Bedrock's OpenAI-compatible surfaces say "encrypted content" or "encrypted
// reasoning"; Bedrock Converse says "reasoningContent"; Anthropic says "thinking" and
// "redacted_thinking"; Gemini and Vertex say "thought signature". These are the names
// of the field, not the provider's verdict on it, which is why they hold still while
// the verdict wording ("invalid", "corrupted", "not valid", "could not decrypt",
// "different region") keeps changing.
var reasoningTokenWords = []string{"encrypted", "reasoning", "thinking", "thought"}

// reasoningConfigParams are request parameters that configure reasoning rather than
// replay it. A 400 naming one is a configuration error -- an effort level or summary
// mode the model does not take, a thinking budget outside Anthropic's documented
// bounds, or a thinking mode the model has retired -- and the strip never touches
// these parameters, so the retry would only earn the same 400.
var reasoningConfigParams = []string{
	"reasoning.effort",
	"reasoning_effort",
	"reasoning.summary",
	"reasoning_summary",
	"budget_tokens",
	"thinking.type",
	"thinking_budget",
	"thinkingbudget",
	"thinking_level",
	"thinkinglevel",
	"include_thoughts",
	"includethoughts",
}

// shouldStripReasoningAfterClientError reports whether a failed attempt earns one more
// try with the request's replayed reasoning tokens removed.
//
// The gate is a 400 whose message names a reasoning token, by family word alone. It
// deliberately does not require the upstream's verdict wording: only Anthropic
// documents its refusal text, and every mid-conversation provider or model switch
// (bedrock to bedrock_mantle, Azure to Mantle, a per-turn router) produced a new
// sentence per surface that the older verdict-based matcher missed, each time handing a
// healable 400 straight to the client. Requiring the family word keeps an unrelated
// 400 (context length, an unsupported parameter) from spending an upstream call that
// would only return the same error.
//
// A 400 is the only class where the payload is the plausible cause: 401/403 are
// identity, 404 is routing, 429 and 5xx are transient, and the ordinary retry classes
// already own those. The caller pairs this with stripUnverifiableReasoning, which
// returns false when the request carries no token, so the extra attempt is spent only
// on requests that replay one. A 400 that names the family for another reason (a
// missing thought_signature) costs one cheap call that is rejected before inference
// and returns the same error; a successful response is never touched, because the
// strip runs only after a refusal.
//
// Two exclusions are certain to earn the same 400 again. Anthropic's documented
// "`thinking` or `redacted_thinking` blocks in the latest assistant message cannot be
// modified": the strip drops those blocks. And a 400 that names a reasoning
// configuration parameter (see reasoningConfigParams) but no replayed-token field:
// the strip leaves the parameter in place.
func shouldStripReasoningAfterClientError(err *schemas.BifrostError) bool {
	if err == nil || err.Error == nil || err.StatusCode == nil || *err.StatusCode != 400 {
		return false
	}
	message := strings.ToLower(err.Error.Message)
	if strings.Contains(message, "cannot be modified") {
		return false
	}
	if containsAnyMarker(message, reasoningConfigParams) && !namesEncryptedReasoningField(message) {
		return false
	}
	return containsAnyMarker(message, reasoningTokenWords)
}

// isEncryptedReasoningRejection reports whether err is an upstream refusal to accept
// replayed encrypted reasoning content, as far as the known phrasings go.
//
// It no longer gates the fail-soft retry; shouldStripReasoningAfterClientError does,
// on status alone. This classifier labels the retry in logs and metrics, so an
// operator can tell a recognised token refusal from a speculative strip after an
// unrelated 400. A miss here costs a less specific log line, not a failed turn.
//
// encrypted_content is bound to the identity that minted it: the item id it was
// issued with, the API key's organization, and the serving endpoint. A gateway
// legitimately changes any of those between turns of one conversation -- key
// rotation across a multi-key pool, a fallback that served an earlier turn from a
// different provider, or a client whose traffic starts (or stops) being routed
// through Bifrost mid-session. The ciphertext 
```

### Core Architecture Module: `core/failureclass.go`
```
package bifrost

import (
	"slices"
	"strings"

	"github.com/maximhq/bifrost/core/schemas"
)

// Everything the retry loop knows about provider errors lives in this file: the status
// codes it trusts on their own, the codes, types and exception names providers expose,
// and the message phrases used where a provider exposes nothing else. Exact-match lists
// are checked with slices.Contains, phrase lists against the lower-cased message with
// containsAny. The phrase lists are deliberately specific: a phrase that also appears in
// an unrelated error would rotate or exclude a key for the wrong reason.

// transientServerStatusCodes are upstream-side failures unrelated to the credential,
// retried with the *same* key (a different credential gains nothing against a flaky
// server). 529 is Anthropic's overloaded_error ("The API is temporarily overloaded",
// docs.claude.com/en/api/errors), also surfaced by Bedrock Mantle's Claude endpoint. It
// reflects capacity across all callers rather than anything about this credential, so it
// retries on the same key instead of rotating: rotating would burn every key on a
// condition none of them can avoid.
var transientServerStatusCodes = []int{500, 502, 503, 504, 529}

// rateLimitPatterns are the phrases a rate limit is reported with by providers that do
// not always answer 429 (case-insensitive substrings).
var rateLimitPatterns = []string{
	"rate limit",
	"rate_limit",
	"ratelimit",
	"too many requests",
	"quota exceeded",
	"quota_exceeded",
	"request limit",
	"throttled",
	"throttling",
	"rate exceeded",
	"limit exceeded",
	"requests per",
	"rpm exceeded",
	"tpm exceeded",
	"tokens per minute",
	"requests per minute",
	"requests per second",
	"api rate limit",
	"usage limit",
	"concurrent requests limit",
	"burst_rate",
	"rate increased",
}

// quotaMarkers say the account behind the key is out of money or over a spend cap, which
// providers report under a 400 (Anthropic), a 403 (OpenRouter, Vertex) or a 429 (Anthropic,
// Gemini, OpenAI) that would otherwise read as a rate limit.
var quotaMarkers = []string{
	"credit balance",
	"spend limit",
	"api usage limits",
	"prepayment credits",
	"credits are depleted",
	"spending cap",
	"requires billing to be enabled",
	"key limit exceeded",
	"account is not active",
}

// quotaCodes name an exhausted balance or a spend block outright: OpenAI's
// insufficient_quota (a type as well as a code) and Groq's blocked_api_access.
var quotaCodes = []string{"insufficient_quota", "blocked_api_access"}

// regionMarkers say the provider refuses the request's location: Gemini's
// FAILED_PRECONDITION and Anthropic-on-Bedrock's ValidationException wording. Both checks
// also read the key's project or account (Gemini's tier, Bedrock's billing address), so the
// class rotates; see schemas.FailureClassRegionBlocked.
var regionMarkers = []string{
	"unsupported countries",
	"location is not supported",
	"not available in your country",
}

// credentialTypes are the error types that name a rejected key outright: Anthropic's and
// Bedrock Mantle's authentication_error, Google's UNAUTHENTICATED, and the AWS exception
// names for an unknown access key id, a signature that does not match the secret, or an
// expired session token (Bedrock never answers 401; these arrive as 403).
var credentialTypes = []string{
	"authentication_error",
	"UNAUTHENTICATED",
	"UnrecognizedClientException",
	"InvalidSignatureException",
	"ExpiredTokenException",
	"IncompleteSignatureException",
}

// credentialCodes are the codes that name a rejected key: OpenAI-shaped invalid_api_key,
// and Groq's code for an organisation that has been cut off.
var credentialCodes = []string{
	"invalid_api_key",
	"organization_restricted",
}

// credentialSharedTypes are the types providers use both for a rejected key and for a
// model the key cannot reach (Google's INVALID_ARGUMENT, Bedrock's AccessDeniedException,
// Bedrock Mantle's permission_error); credentialMarkers in the message decide.
var credentialSharedTypes = []string{
	"INVALID_ARGUMENT",
	"AccessDeniedException",
	"permission_error",
}

// credentialMarkers are the phrases those shared types carry when it was the key that was
// rejected: Gemini's "API key not valid" / "API key expired", Bedrock's "API Key is valid"
// and "security token", Bedrock Mantle's "Invalid API Key".
var credentialMarkers = []string{
	"api key not valid",
	"api_key_invalid",
	"api key expired",
	"api key is valid",
	"invalid api key",
	"security token",
}

// modelAccessCodes are the codes OpenAI-shaped providers use when this key cannot reach
// the model: OpenAI's and Groq's model_not_found (a 404, or a 403 when a project lacks
// access), Azure's DeploymentNotFound, Mistral's unknown_model, Groq's terms gate.
var modelAccessCodes = []string{
	"model_not_found",
	"DeploymentNotFound",
	"unknown_model",
	"model_terms_required",
}

// modelAccessTypes are the types that name the model as the thing the provider could not
// serve without needing the message: Mistral's model_not_found and invalid_model,
// Anthropic's permission_error (a workspace can restrict models) and Bedrock's
// AccessDeniedException. Bedrock's ResourceNotFoundException also reports a batch job or
// a guardrail that does not exist, so it counts only when its message names a model.
var modelAccessTypes = []string{
	"model_not_found",
	"invalid_model",
	"permission_error",
	"AccessDeniedException",
}

// googleModelTypes need the message to name a model resource (models/... or "publisher
// model"), since the same types also report project and permission problems.
var googleModelTypes = []string{"NOT_FOUND", "PERMISSION_DENIED", "FAILED_PRECONDITION"}

// googleModelMarkers are how a Gemini or Vertex message names a model resource: the
// models/ path segment of a resource name, or "Publisher Model".
var googleModelMarkers = []string{"models/", "publisher model"}

// anthropicModelMarkers pick the not_found_error responses that are about a model.
var anthropicModelMarkers = []string{"model:", "is not available"}

// bedrockModelMarkers are the phrases in a Bedrock ValidationException that make it about
// the model id or the way this key may call it, rather than about the request body: an
// invalid model identifier, or an on-demand call to a model that needs an inference
// profile. A ValidationException about a field the model does not support, or about the
// input being too long, must not match.
var bedrockModelMarkers = []string{
	"model id",
	"on-demand throughput",
	"inference profile",
}

// openRouterModelMarkers are OpenRouter's 404 wordings for a model with no endpoint.
var openRouterModelMarkers = []string{"no endpoints found", "no allowed providers"}

// retiredModelCodes name a withdrawn model outright: Groq's and Azure's.
var retiredModelCodes = []string{"model_decommissioned", "ServiceModelDeprecating"}

// retiredModelMarkers are the phrases providers use when a model has been withdrawn, as
// opposed to never having existed or not being reachable with this key.
var retiredModelMarkers = []string{
	"deprecated",
	"deprecation",
	"decommissioned",
	"retired",
	"end of its life",
	"end-of-life",
	"no longer available",
	"was removed",
	"has been removed",
}

// perKeyStatusCodes are the statuses that on their own say the failure is bound to the key
// or the account rather than the request. They are what a same-key retry has always been
// earned by when no other key exists to move to.
var perKeyStatusCodes = []int{401, 402, 403, 429}

// callerFaultStatusCodes are the statuses that, with a provider error body, say the
// request itself was refused.
var callerFaultStatusCodes = []int{400, 409, 413, 415, 422}

// IsRateLimitErrorMessage checks if an error message indicates a rate limit issue.
func IsRateLimitErrorMessage(errorMessage string) bool {
	if errorMessage == "" {
		return false
	}
	return containsAny(strings.ToLower(errorMessage), rateLimitPatterns)
}

// ClassifyFailure says what a failed attempt tells Bifrost about the key and the route it
// used: whether the same key can be retried, another key should be tried, or nothing will
// help. executeRequestWithRetries stamps the result on the attempt trail and drives key
// rotation from it. A nil error has no class and yields "".
//
// The rules read the provider's own error code, type or exception name wherever the
// provider exposes one, then its message where it exposes nothing else, and fall back to
// the status only for the facts a status can carry on its own (401, 402, 403, 429 and the
// transient 5xx set). Providers disagree on which status carries which fact: Gemini
// rejects a bad key with a 400, Bedrock reports a retired model as a 400 or a 404 under
// the same exception name, Anthropic reports an empty credit balance as a 400
// invalid_request_error, OpenAI and Gemini report one as a 429. A failure the rules do
// not recognise is FailureClassUnknown, which keeps the existing behaviour: no retry, no
// rotation.
func ClassifyFailure(err *schemas.BifrostError) schemas.FailureClass {
	if err == nil {
		return ""
	}
	if err.IsBifrostError {
		return schemas.FailureClassUnknown
	}
	status := 0
	if err.StatusCode != nil {
		status = *err.StatusCode
	}
	var message, errType, code string
	hasParam := false
	if err.Error != nil {
		message = err.Error.Message
		if err.Error.Type != nil {
			errType = *err.Error.Type
		}
		if err.Error.Code != nil {
			code = *err.Error.Code
		}
		if s, ok := err.Error.Param.(string); ok {
			hasParam = s != ""
		} else {
			hasParam = err.Error.Param != nil
		}
	}
	if errType == "" && err.Type != nil {
		errType = *err.Type
	}
	lower := strings.ToLower(message)
	body := hasBody(message)
	transient := slices.Contains(transientServerStatusCodes, status)

	// Transport failures: the key played no part.
	if message == schemas.ErrProviderDoRequest || message == schemas.ErrProviderNetworkError {
		return schemas.FailureClassTransient
	}

	// Quota befor
```

### Core Architecture Module: `core/internal/schemaorder/schemaorder.go`
```
// Package schemaorder provides shared fixtures and assertions for the
// response_format / JSON Schema key-order tests.
//
// OpenAI Structured Outputs generates fields in the order the schema declares
// them ("outputs will be produced in the same order as the ordering of keys in
// the schema" - https://developers.openai.com/api/docs/guides/structured-outputs),
// so a gateway that re-sorts a user's schema silently changes model behavior.
// Every provider that forwards or rewrites a JSON Schema must preserve the
// declared key order; these helpers are how each provider package asserts it.
package schemaorder

import (
	"strings"
	"testing"
)

// ChatBody is a chat/completions body whose JSON Schema is deliberately written
// in non-alphabetical order: `reasoning` before `assigned_group_id` (so the
// model explains before it decides), and schema keys as type/title/description/
// properties/required/additionalProperties.
const ChatBody = `{
  "model": "gpt-5.4-nano",
  "messages": [{"role": "user", "content": "assign it"}],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "AssignmentResult",
      "description": "Assignment result for a single activity.",
      "schema": {
        "type": "object",
        "title": "AssignmentResult",
        "description": "Assignment result for a single activity.",
        "properties": {
          "reasoning": {
            "type": "string",
            "title": "Reasoning",
            "description": "Brief explanation of the assignment decision"
          },
          "assigned_group_id": {
            "anyOf": [{"type": "integer"}, {"type": "null"}],
            "title": "Assigned Group ID",
            "description": "The group ID to assign the activity to, or null if no good match"
          }
        },
        "required": ["assigned_group_id", "reasoning"],
        "additionalProperties": false
      },
      "strict": true
    }
  }
}`

// ResponsesBody is the Responses API equivalent of ChatBody, carrying the same
// schema under text.format.
const ResponsesBody = `{
  "model": "gpt-5.4-nano",
  "input": [{"role": "user", "content": "assign it"}],
  "text": {
    "format": {
      "type": "json_schema",
      "name": "AssignmentResult",
      "schema": {
        "type": "object",
        "title": "AssignmentResult",
        "description": "Assignment result for a single activity.",
        "properties": {
          "reasoning": {
            "type": "string",
            "title": "Reasoning",
            "description": "Brief explanation of the assignment decision"
          },
          "assigned_group_id": {
            "anyOf": [{"type": "integer"}, {"type": "null"}],
            "title": "Assigned Group ID",
            "description": "The group ID to assign the activity to, or null if no good match"
          }
        },
        "required": ["assigned_group_id", "reasoning"],
        "additionalProperties": false
      },
      "strict": true
    }
  }
}`

// ByteExactSchema is a JSON Schema that no provider needs to rewrite: it has no
// union type arrays, so every normalizer is an identity transform on it. It
// therefore must reach the wire byte for byte, which pins two things a
// parse-and-re-encode gateway cannot deliver:
//
//   - 9007199254740993 exceeds float64's exact integer range and comes back as
//     ...992 once it round-trips through a Go number.
//   - 1.0 re-encodes as 1.
//
// Written compact and with deliberately non-alphabetical keys so a byte
// comparison against the outgoing payload is meaningful.
const ByteExactSchema = `{"type":"object","title":"AssignmentResult","description":"Assignment result for a single activity.","properties":{"reasoning":{"type":"string","title":"Reasoning"},"assigned_group_id":{"type":"integer","title":"Assigned Group ID","enum":[9007199254740993,7],"multipleOf":1.0}},"required":["assigned_group_id","reasoning"],"additionalProperties":false}`

// ByteExactChatBody is a chat/completions body carrying ByteExactSchema.
const ByteExactChatBody = `{"model":"gpt-5.4-nano","messages":[{"role":"user","content":"assign it"}],"response_format":{"type":"json_schema","json_schema":{"name":"AssignmentResult","schema":` + ByteExactSchema + `,"strict":true}}}`

// AssertSchemaBytes fails the test unless the schema under key in wire is
// byte-identical to ByteExactSchema. key names the field holding the schema on
// this provider's wire.
func AssertSchemaBytes(t *testing.T, wire string, key string) {
	t.Helper()
	got := ObjectAfterKey(t, wire, key)
	if got != ByteExactSchema {
		t.Errorf("schema was rewritten on the way out\n want: %s\n  got: %s", ByteExactSchema, got)
	}
}

// PropertyOrder is the order in which ChatBody declares its schema properties.
var PropertyOrder = []string{"reasoning", "assigned_group_id"}

// SchemaKeyOrder is the order in which ChatBody declares the schema object's own keys.
var SchemaKeyOrder = []string{"type", "title", "description", "properties", "required", "additionalProperties"}

// AssertKeyOrder fails the test unless the given JSON keys appear in wire in the
// given relative order. It matches on the first occurrence of `"key"`, which is
// sufficient for these fixtures because every asserted key is unique within the
// schema blob.
func AssertKeyOrder(t *testing.T, wire string, keys ...string) {
	t.Helper()
	prev, prevKey := -1, ""
	for _, k := range keys {
		idx := strings.Index(wire, `"`+k+`"`)
		if idx == -1 {
			t.Fatalf("key %q missing from payload: %s", k, wire)
		}
		if idx <= prev {
			t.Errorf("key %q must be serialized after %q, but came before it\npayload: %s", k, prevKey, wire)
		}
		prev, prevKey = idx, k
	}
}

// AssertPropertyOrder asserts the schema properties reached the wire in declared order.
func AssertPropertyOrder(t *testing.T, wire string) {
	t.Helper()
	AssertKeyOrder(t, wire, PropertyOrder...)
}

// AssertSchemaKeyOrder asserts the schema object's own keys reached the wire in
// declared order. key names the field holding the schema on this provider's wire
// ("schema" for OpenAI-shaped payloads, "responseJsonSchema" for Gemini,
// "inputSchema"/"json" for Bedrock tools, and so on), because the same key names
// also appear at outer levels of the payload.
func AssertSchemaKeyOrder(t *testing.T, wire string, key string) {
	t.Helper()
	AssertKeyOrder(t, ObjectAfterKey(t, wire, key), SchemaKeyOrder...)
}

// ObjectAfterKey returns the balanced JSON object that follows the first
// occurrence of "key" in wire. It fails the test if no object follows.
func ObjectAfterKey(t *testing.T, wire string, key string) string {
	t.Helper()
	at := strings.Index(wire, `"`+key+`"`)
	if at == -1 {
		t.Fatalf("key %q missing from payload: %s", key, wire)
	}
	start := strings.Index(wire[at:], "{")
	if start == -1 {
		t.Fatalf("no object follows key %q in payload: %s", key, wire)
	}
	start += at

	depth, inString, escaped := 0, false, false
	for i := start; i < len(wire); i++ {
		c := wire[i]
		switch {
		case escaped:
			escaped = false
		case c == '\\' && inString:
			escaped = true
		case c == '"':
			inString = !inString
		case inString:
			// literal content, nothing to balance
		case c == '{':
			depth++
		case c == '}':
			depth--
			if depth == 0 {
				return wire[start : i+1]
			}
		}
	}
	t.Fatalf("unbalanced object after key %q in payload: %s", key, wire)
	return ""
}

```

### Core Architecture Module: `core/keyselectors/weightedrandom.go`
```
package keyselectors

import (
	"math/rand"

	"github.com/maximhq/bifrost/core/schemas"
)

func WeightedRandom(ctx *schemas.BifrostContext, keys []schemas.Key, providerKey schemas.ModelProvider, model string) (schemas.Key, error) {
	// Use a weighted random selection based on key weights
	totalWeight := 0
	for _, key := range keys {
		totalWeight += int(key.Weight * 100) // Convert float to int for better performance
	}

	// If all keys have zero weight, fall back to uniform random selection
	if totalWeight == 0 {
		return keys[rand.Intn(len(keys))], nil
	}

	// Use global thread-safe random (Go 1.20+) - no allocation, no syscall
	randomValue := rand.Intn(totalWeight)

	// Select key based on weight
	currentWeight := 0
	for _, key := range keys {
		currentWeight += int(key.Weight * 100)
		if randomValue < currentWeight {
			return key, nil
		}
	}

	// Fallback to first key if something goes wrong
	return keys[0], nil
}

```

### Core Architecture Module: `core/logger.go`
```
// Package bifrost provides the core implementation of the Bifrost system.
package bifrost

import (
	"os"
	"sync"
	"time"

	schemas "github.com/maximhq/bifrost/core/schemas"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var zerologOnce sync.Once

// DefaultLogger implements the Logger interface with stdout/stderr printing.
// It provides a simple logging implementation that writes to standard output
// and error streams with formatted timestamps and log levels.
// It is used as the default logger if no logger is provided in the BifrostConfig.
type DefaultLogger struct {
	stderrLogger zerolog.Logger
	stdoutLogger zerolog.Logger
}

// toZerologLevel converts a Bifrost log level to a Zerolog level.
func toZerologLevel(l schemas.LogLevel) zerolog.Level {
	switch l {
	case schemas.LogLevelDebug:
		return zerolog.DebugLevel
	case schemas.LogLevelInfo:
		return zerolog.InfoLevel
	case schemas.LogLevelWarn:
		return zerolog.WarnLevel
	case schemas.LogLevelError:
		return zerolog.ErrorLevel
	default:
		return zerolog.InfoLevel
	}
}

// NewDefaultLogger creates a new DefaultLogger instance with the specified log level.
// The log level determines which messages will be output based on their severity.
func NewDefaultLogger(level schemas.LogLevel) *DefaultLogger {
	zerolog.SetGlobalLevel(toZerologLevel(level))
	zerologOnce.Do(func() {
		zerolog.DisableSampling(true)
		zerolog.TimeFieldFormat = time.RFC3339
		log.Logger = zerolog.New(os.Stdout).With().Timestamp().Logger()
	})
	return &DefaultLogger{
		stderrLogger: zerolog.New(os.Stderr).With().Timestamp().Logger(),
		stdoutLogger: zerolog.New(os.Stdout).With().Timestamp().Logger(),
	}
}

// Debug logs a debug level message to stdout.
// Messages are only output if the logger's level is set to LogLevelDebug.
func (logger *DefaultLogger) Debug(msg string, args ...any) {
	logger.stdoutLogger.Debug().Msgf(msg, args...)
}

// Info logs an info level message to stdout.
// Messages are output if the logger's level is LogLevelDebug or LogLevelInfo.
func (logger *DefaultLogger) Info(msg string, args ...any) {
	logger.stdoutLogger.Info().Msgf(msg, args...)
}

// Warn logs a warning level message to stdout.
// Messages are output if the logger's level is LogLevelDebug, LogLevelInfo, or LogLevelWarn.
func (logger *DefaultLogger) Warn(msg string, args ...any) {
	logger.stdoutLogger.Warn().Msgf(msg, args...)
}

// Error logs an error level message to stderr.
// Error messages are always output regardless of the logger's level.
func (logger *DefaultLogger) Error(msg string, args ...any) {
	logger.stderrLogger.Error().Msgf(msg, args...)
}

// Fatal logs a fatal-level message to stderr.
// Fatal messages are always output regardless of the logger's level.
func (logger *DefaultLogger) Fatal(msg string, args ...any) {
	// Check if any of the args is an error and exit with non-zero code if found
	var errToPass error
	for i, arg := range args {
		if err, ok := arg.(error); ok && err != nil {
			errToPass = err
			// remove from args
			args = append(args[:i], args[i+1:]...)
		}
	}
	if errToPass != nil {
		logger.stderrLogger.Fatal().Msgf(msg, errToPass)
	} else {
		logger.stderrLogger.Fatal().Msgf(msg, args...)
	}
}

// SetLevel sets the logging level for the logger.
// This determines which messages will be output based on their severity.
func (logger *DefaultLogger) SetLevel(level schemas.LogLevel) {
	zerolog.SetGlobalLevel(toZerologLevel(level))
}

// SetOutputType sets the output type for the logger.
// This determines the format of the log output.
// If the output type is unknown, it defaults to JSON
func (logger *DefaultLogger) SetOutputType(outputType schemas.LoggerOutputType) {
	switch outputType {
	case schemas.LoggerOutputTypePretty:
		logger.stdoutLogger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout}).With().Timestamp().Logger()
		logger.stderrLogger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr}).With().Timestamp().Logger()
	case schemas.LoggerOutputTypeJSON:
		logger.stdoutLogger = zerolog.New(os.Stdout).With().Timestamp().Logger()
		logger.stderrLogger = zerolog.New(os.Stderr).With().Timestamp().Logger()
	default:
		logger.stderrLogger.Warn().
			Str("outputType", string(outputType)).
			Msg("unknown logger output type; defaulting to JSON")
		logger.stdoutLogger = zerolog.New(os.Stdout).With().Timestamp().Logger()
	}
}

// NoOpLogger is a no-op implementation of schemas.Logger.
type NoOpLogger struct{}

// NewNoOpLogger creates a new NoOpLogger instance.
func NewNoOpLogger() schemas.Logger {
	return &NoOpLogger{}
}

func (l *NoOpLogger) Debug(string, ...any)                   {}
func (l *NoOpLogger) Info(string, ...any)                    {}
func (l *NoOpLogger) Warn(string, ...any)                    {}
func (l *NoOpLogger) Error(string, ...any)                   {}
func (l *NoOpLogger) Fatal(string, ...any)                   {}
func (l *NoOpLogger) SetLevel(schemas.LogLevel)              {}
func (l *NoOpLogger) SetOutputType(schemas.LoggerOutputType) {}
func (l *NoOpLogger) LogHTTPRequest(schemas.LogLevel, string) schemas.LogEventBuilder {
	return schemas.NoopLogEvent
}

// zerologEventBuilder wraps a zerolog.Event to implement schemas.LogEventBuilder.
type zerologEventBuilder struct {
	event *zerolog.Event
	msg   string
}

func (b *zerologEventBuilder) Str(key, val string) schemas.LogEventBuilder {
	b.event = b.event.Str(key, val)
	return b
}

func (b *zerologEventBuilder) Int(key string, val int) schemas.LogEventBuilder {
	b.event = b.event.Int(key, val)
	return b
}

func (b *zerologEventBuilder) Int64(key string, val int64) schemas.LogEventBuilder {
	b.event = b.event.Int64(key, val)
	return b
}

func (b *zerologEventBuilder) Send() {
	b.event.Msg(b.msg)
}

// LogHTTPRequest returns a LogEventBuilder for structured HTTP access logging.
// We are exposing the zerolog loggers directly to allow for more flexibility in logging and also to reduce the number of allocations we do in the logger.
func (logger *DefaultLogger) LogHTTPRequest(level schemas.LogLevel, msg string) schemas.LogEventBuilder {
	l := logger.stdoutLogger
	if level == schemas.LogLevelError {
		l = logger.stderrLogger
	}
	var event *zerolog.Event
	switch level {
	case schemas.LogLevelDebug:
		event = l.Debug()
	case schemas.LogLevelWarn:
		event = l.Warn()
	case schemas.LogLevelError:
		event = l.Error()
	default:
		event = l.Info()
	}
	return &zerologEventBuilder{event: event, msg: msg}
}

```

### Core Architecture Module: `core/mcp/agent.go`
```
package mcp

import (
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/bytedance/sonic"
	"github.com/google/uuid"
	"github.com/maximhq/bifrost/core/schemas"
)

type AgentModeExecutor struct {
	logger schemas.Logger
}

// ExecuteAgentForChatRequest handles the agent mode execution loop for Chat API.
// It orchestrates iterative tool execution up to the maximum depth, handling
// auto-executable and non-auto-executable tools appropriately.
//
// Parameters:
//   - ctx: Context for agent execution
//   - maxAgentDepth: Maximum number of agent iterations allowed
//   - originalReq: The original chat request
//   - initialResponse: The initial chat response containing tool calls
//   - makeReq: Function to make subsequent chat requests during agent execution
//   - fetchNewRequestIDFunc: Optional function to generate unique request IDs for each iteration
//   - executeToolFunc: Function to execute individual tool calls using unified MCP request/response
//   - clientManager: Client manager for accessing MCP clients and tools
//
// Returns:
//   - *schemas.BifrostChatResponse: The final response after agent execution
//   - *schemas.BifrostError: Any error that occurred during agent execution
func (a *AgentModeExecutor) ExecuteAgentForChatRequest(
	ctx *schemas.BifrostContext,
	maxAgentDepth int,
	originalReq *schemas.BifrostChatRequest,
	initialResponse *schemas.BifrostChatResponse,
	makeReq func(ctx *schemas.BifrostContext, req *schemas.BifrostChatRequest) (*schemas.BifrostChatResponse, *schemas.BifrostError),
	fetchNewRequestIDFunc func(ctx *schemas.BifrostContext) string,
	executeToolFunc MCPToolExecutor,
	clientManager ClientManager,
) (*schemas.BifrostChatResponse, *schemas.BifrostError) {
	// Create adapter for Chat API
	adapter := &chatAPIAdapter{
		originalReq:     originalReq,
		initialResponse: initialResponse,
		makeReq:         makeReq,
	}

	result, err := a.executeAgent(ctx, maxAgentDepth, adapter, fetchNewRequestIDFunc, executeToolFunc, clientManager)
	if err != nil {
		return nil, err
	}

	chatResponse, ok := result.(*schemas.BifrostChatResponse)
	// Should never happen, but just in case
	if !ok {
		return nil, &schemas.BifrostError{
			IsBifrostError: false,
			Error: &schemas.ErrorField{
				Message: "Failed to convert result to schemas.BifrostChatResponse",
			},
		}
	}

	return chatResponse, nil
}

// ExecuteAgentForResponsesRequest handles the agent mode execution loop for Responses API.
// It orchestrates iterative tool execution up to the maximum depth, handling
// auto-executable and non-auto-executable tools appropriately.
//
// Parameters:
//   - ctx: Context for agent execution
//   - maxAgentDepth: Maximum number of agent iterations allowed
//   - originalReq: The original responses request
//   - initialResponse: The initial responses response containing tool calls
//   - makeReq: Function to make subsequent responses requests during agent execution
//   - fetchNewRequestIDFunc: Optional function to generate unique request IDs for each iteration
//   - executeToolFunc: Function to execute individual tool calls using unified MCP request/response
//   - clientManager: Client manager for accessing MCP clients and tools
//
// Returns:
//   - *schemas.BifrostResponsesResponse: The final response after agent execution
//   - *schemas.BifrostError: Any error that occurred during agent execution
func (a *AgentModeExecutor) ExecuteAgentForResponsesRequest(
	ctx *schemas.BifrostContext,
	maxAgentDepth int,
	originalReq *schemas.BifrostResponsesRequest,
	initialResponse *schemas.BifrostResponsesResponse,
	makeReq func(ctx *schemas.BifrostContext, req *schemas.BifrostResponsesRequest) (*schemas.BifrostResponsesResponse, *schemas.BifrostError),
	fetchNewRequestIDFunc func(ctx *schemas.BifrostContext) string,
	executeToolFunc MCPToolExecutor,
	clientManager ClientManager,
) (*schemas.BifrostResponsesResponse, *schemas.BifrostError) {
	// Create adapter for Responses API
	adapter := &responsesAPIAdapter{
		originalReq:     originalReq,
		initialResponse: initialResponse,
		makeReq:         makeReq,
	}

	result, err := a.executeAgent(ctx, maxAgentDepth, adapter, fetchNewRequestIDFunc, executeToolFunc, clientManager)
	if err != nil {
		return nil, err
	}

	responsesResponse, ok := result.(*schemas.BifrostResponsesResponse)
	// Should never happen, but just in case
	if !ok {
		return nil, &schemas.BifrostError{
			IsBifrostError: false,
			Error: &schemas.ErrorField{
				Message: "Failed to convert result to schemas.BifrostResponsesResponse",
			},
		}
	}

	return responsesResponse, nil
}

// executeAgent handles the generic agent mode execution loop using an API adapter pattern.
// It iteratively executes tools, separates auto-executable from non-auto-executable tools,
// executes auto-executable tools in parallel, and continues the loop until no more tool
// calls are present or the maximum depth is reached.
//
// Parameters:
//   - ctx: Context for agent execution (may be modified to add request IDs)
//   - maxAgentDepth: Maximum number of agent iterations allowed
//   - adapter: API adapter that abstracts differences between Chat and Responses APIs
//   - fetchNewRequestIDFunc: Optional function to generate unique request IDs for each iteration
//   - executeToolFunc: Function to execute individual tool calls using unified MCP request/response
//   - clientManager: Client manager for accessing MCP clients and tools
//
// Returns:
//   - interface{}: The final response after agent execution (type depends on adapter)
//   - *schemas.BifrostError: Any error that occurred during agent execution
func (a *AgentModeExecutor) executeAgent(
	ctx *schemas.BifrostContext,
	maxAgentDepth int,
	adapter agentAPIAdapter,
	fetchNewRequestIDFunc func(ctx *schemas.BifrostContext) string,
	executeToolFunc MCPToolExecutor,
	clientManager ClientManager,
) (interface{}, *schemas.BifrostError) {
	// Get initial response from adapter
	currentResponse := adapter.getInitialResponse()

	// Create conversation history starting with original messages
	conversationHistory := adapter.getConversationHistory()

	depth := 0

	// Track all executed tool results and tool calls across all iterations
	allExecutedToolResults := make([]*schemas.ChatMessage, 0)
	allExecutedToolCalls := make([]schemas.ChatAssistantMessageToolCall, 0)

	// Accumulate token usage across all LLM calls in the agent loop
	accumulatedUsage := adapter.extractUsage(currentResponse)

	originalRequestID, ok := ctx.Value(schemas.BifrostContextKeyRequestID).(string)
	if ok {
		ctx.SetValue(schemas.BifrostMCPAgentOriginalRequestID, originalRequestID)
	}

	for depth < maxAgentDepth {
		depth++
		toolCalls := adapter.extractToolCalls(currentResponse)
		if len(toolCalls) == 0 {
			break
		}

		// Separate tools into auto-executable and non-auto-executable groups
		var autoExecutableTools []schemas.ChatAssistantMessageToolCall
		var nonAutoExecutableTools []schemas.ChatAssistantMessageToolCall

		for _, toolCall := range toolCalls {
			if toolCall.Function.Name == nil {
				// Skip tools without names
				nonAutoExecutableTools = append(nonAutoExecutableTools, toolCall)
				continue
			}

			toolName := *toolCall.Function.Name
			client := clientManager.GetClientForTool(toolName)
			if client == nil {
				// Allow code mode list, read, and docs tools (all read-only operations)
				if toolName == ToolTypeListToolFiles || toolName == ToolTypeReadToolFile || toolName == ToolTypeGetToolDocs {
					autoExecutableTools = append(autoExecutableTools, toolCall)
					a.logger.Debug("Tool %s can be auto-executed", toolName)
					continue
				} else if toolName == ToolTypeExecuteToolCode {
					// Build allowed auto-execution tools map for code mode validation
					allClientNames, allowedAutoExecutionTools := buildAllowedAutoExecutionTools(ctx, clientManager)

					// Parse tool arguments
					var arguments map[string]interface{}
					if err := sonic.Unmarshal([]byte(toolCall.Function.Arguments), &arguments); err != nil {
						a.logger.Debug("%s Failed to parse tool arguments: %v", CodeModeLogPrefix, err)
						nonAutoExecutableTools = append(nonAutoExecutableTools, toolCall)
						continue
					}

					code, ok := arguments["code"].(string)
					if !ok || code == "" {
						a.logger.Debug("%s Code parameter missing or empty", CodeModeLogPrefix)
						nonAutoExecutableTools = append(nonAutoExecutableTools, toolCall)
						continue
					}

					// Step 1: Extract tool calls from the original source code during validation
					extractedToolCalls, err := extractToolCallsFromCode(code)
					if err != nil {
						a.logger.Debug("%s Failed to parse code for tool calls: %v", CodeModeLogPrefix, err)
						nonAutoExecutableTools = append(nonAutoExecutableTools, toolCall)
						continue
					}

					a.logger.Debug("%s Extracted %d tool call(s) from code", CodeModeLogPrefix, len(extractedToolCalls))

					// Step 3: Validate all tool calls against allowedAutoExecutionTools
					canAutoExecute := true
					if len(extractedToolCalls) > 0 {
						// If there are tool calls, we need allowedAutoExecutionTools to validate them
						if len(allowedAutoExecutionTools) == 0 {
							a.logger.Debug("%s Validation failed: no allowed auto-execution tools configured", CodeModeLogPrefix)
							canAutoExecute = false
						} else {
							a.logger.Debug("%s Validating %d tool call(s) against %d allowed server(s)", CodeModeLogPrefix, len(extractedToolCalls), len(allowedAutoExecutionTools))

							// Validate each tool call
							for _, extractedToolCall := range extractedToolCalls {
								isAllowed := isToolCallAllowedForCodeMode(extractedToolCall.serverName, extractedToolCall.toolName, allClientNames, allowedAutoExecutionTools)
								if !isAllowed {
									a.logger.Debug("%s Validation failed: tool call %s.%s not in auto-execute list", CodeModeLogPrefix, extractedToolCall.serverName, extractedToolCall.toolName)
									canAutoExecute = false
									break
								}
							}
							if canAutoExecute 
```

### Core Architecture Module: `core/mcp/agentadaptors.go`
```
package mcp

import (
	"fmt"

	"github.com/maximhq/bifrost/core/schemas"
)

// agentAPIAdapter defines the interface for API-specific operations in agent mode.
// This adapter pattern allows the agent execution logic to work with both Chat Completions
// and Responses APIs without requiring API-specific code in the agent loop.
//
// The adapter handles format conversions at the boundaries:
//   - Responses API requests/responses are converted to/from Chat API format
//   - Tool calls are extracted in Chat format for uniform processing
//   - Results are converted back to the original API format for the response
//
// This design ensures that:
//  1. Tool execution logic is format-agnostic
//  2. Both APIs have feature parity
//  3. Conversions are localized to adapters
//  4. The agent loop remains API-neutral
type agentAPIAdapter interface {
	// Extract conversation history from the original request
	getConversationHistory() []interface{}

	// Get original request
	getOriginalRequest() interface{}

	// Get initial response
	getInitialResponse() interface{}

	// Check if response has tool calls
	hasToolCalls(response interface{}) bool

	// Extract tool calls from response.
	// For Chat API: Returns tool calls directly from the response.
	// For Responses API: Converts ResponsesMessage tool calls to ChatAssistantMessageToolCall for processing.
	extractToolCalls(response interface{}) []schemas.ChatAssistantMessageToolCall

	// Add assistant message with tool calls to conversation
	addAssistantMessage(conversation []interface{}, response interface{}) []interface{}

	// Add tool results to conversation.
	// For Chat API: Adds ChatMessage results directly.
	// For Responses API: Converts ChatMessage results to ResponsesMessage via ToResponsesToolMessage().
	addToolResults(conversation []interface{}, toolResults []*schemas.ChatMessage) []interface{}

	// Create new request with updated conversation
	createNewRequest(conversation []interface{}) interface{}

	// Make LLM call
	makeLLMCall(ctx *schemas.BifrostContext, request interface{}) (interface{}, *schemas.BifrostError)

	// Create response with executed tools and non-auto-executable calls
	createResponseWithExecutedTools(
		response interface{},
		executedToolResults []*schemas.ChatMessage,
		executedToolCalls []schemas.ChatAssistantMessageToolCall,
		nonAutoExecutableToolCalls []schemas.ChatAssistantMessageToolCall,
	) interface{}

	// extractUsage returns the token usage from a response as BifrostLLMUsage.
	extractUsage(response interface{}) *schemas.BifrostLLMUsage

	// applyUsage sets accumulated usage on the response in place.
	applyUsage(response interface{}, usage *schemas.BifrostLLMUsage)
}

// chatAPIAdapter implements agentAPIAdapter for Chat API
type chatAPIAdapter struct {
	originalReq     *schemas.BifrostChatRequest
	initialResponse *schemas.BifrostChatResponse
	makeReq         func(ctx *schemas.BifrostContext, req *schemas.BifrostChatRequest) (*schemas.BifrostChatResponse, *schemas.BifrostError)
}

// responsesAPIAdapter implements agentAPIAdapter for Responses API.
// It enables the agent mode execution loop to work with Responses API requests and responses
// by handling format conversions transparently.
//
// Key conversions performed:
//   - extractToolCalls(): Converts ResponsesMessage tool calls to ChatAssistantMessageToolCall
//     via BifrostResponsesResponse.ToBifrostChatResponse() and existing extraction logic
//   - addToolResults(): Converts ChatMessage tool results back to ResponsesMessage
//     via ChatMessage.ToResponsesMessages() and ToResponsesToolMessage()
//   - createNewRequest(): Builds a new BifrostResponsesRequest from converted conversation
//   - createResponseWithExecutedTools(): Creates a Responses response with results and pending tools
//
// This adapter enables full feature parity between Chat Completions and Responses APIs
// for tool execution in agent mode.
type responsesAPIAdapter struct {
	originalReq     *schemas.BifrostResponsesRequest
	initialResponse *schemas.BifrostResponsesResponse
	makeReq         func(ctx *schemas.BifrostContext, req *schemas.BifrostResponsesRequest) (*schemas.BifrostResponsesResponse, *schemas.BifrostError)
}

// Chat API adapter implementations
func (c *chatAPIAdapter) getConversationHistory() []interface{} {
	history := make([]interface{}, 0)
	if c.originalReq.Input != nil {
		for _, msg := range c.originalReq.Input {
			history = append(history, msg)
		}
	}
	return history
}

func (c *chatAPIAdapter) getOriginalRequest() interface{} {
	return c.originalReq
}

func (c *chatAPIAdapter) getInitialResponse() interface{} {
	return c.initialResponse
}

func (c *chatAPIAdapter) hasToolCalls(response interface{}) bool {
	chatResponse := response.(*schemas.BifrostChatResponse)
	return hasToolCallsForChatResponse(chatResponse)
}

func (c *chatAPIAdapter) extractToolCalls(response interface{}) []schemas.ChatAssistantMessageToolCall {
	chatResponse := response.(*schemas.BifrostChatResponse)
	return extractToolCalls(chatResponse)
}

func (c *chatAPIAdapter) addAssistantMessage(conversation []interface{}, response interface{}) []interface{} {
	chatResponse := response.(*schemas.BifrostChatResponse)
	for _, choice := range chatResponse.Choices {
		if choice.ChatNonStreamResponseChoice != nil && choice.ChatNonStreamResponseChoice.Message != nil {
			conversation = append(conversation, *choice.ChatNonStreamResponseChoice.Message)
		}
	}
	return conversation
}

func (c *chatAPIAdapter) addToolResults(conversation []interface{}, toolResults []*schemas.ChatMessage) []interface{} {
	for _, toolResult := range toolResults {
		conversation = append(conversation, *toolResult)
	}
	return conversation
}

func (c *chatAPIAdapter) createNewRequest(conversation []interface{}) interface{} {
	// Convert conversation back to ChatMessage slice
	chatMessages := make([]schemas.ChatMessage, 0, len(conversation))
	for _, msg := range conversation {
		if msg == nil {
			continue
		}
		if chatMessage, ok := msg.(schemas.ChatMessage); ok {
			chatMessages = append(chatMessages, chatMessage)
		}
	}

	return &schemas.BifrostChatRequest{
		Provider:  c.originalReq.Provider,
		Model:     c.originalReq.Model,
		Fallbacks: c.originalReq.Fallbacks,
		Params:    c.originalReq.Params,
		Input:     chatMessages,
	}
}

func (c *chatAPIAdapter) makeLLMCall(ctx *schemas.BifrostContext, request interface{}) (interface{}, *schemas.BifrostError) {
	chatRequest := request.(*schemas.BifrostChatRequest)
	return c.makeReq(ctx, chatRequest)
}

func (c *chatAPIAdapter) createResponseWithExecutedTools(
	response interface{},
	executedToolResults []*schemas.ChatMessage,
	executedToolCalls []schemas.ChatAssistantMessageToolCall,
	nonAutoExecutableToolCalls []schemas.ChatAssistantMessageToolCall,
) interface{} {
	chatResponse := response.(*schemas.BifrostChatResponse)
	return createChatResponseWithExecutedToolsAndNonAutoExecutableCalls(
		chatResponse,
		executedToolResults,
		executedToolCalls,
		nonAutoExecutableToolCalls,
	)
}

func (c *chatAPIAdapter) extractUsage(response interface{}) *schemas.BifrostLLMUsage {
	return response.(*schemas.BifrostChatResponse).Usage
}

func (c *chatAPIAdapter) applyUsage(response interface{}, usage *schemas.BifrostLLMUsage) {
	response.(*schemas.BifrostChatResponse).Usage = usage
}

// createChatResponseWithExecutedToolsAndNonAutoExecutableCalls creates a chat response
// that includes executed tool results and non-auto-executable tool calls. The response
// contains a formatted text summary of executed tool results and includes the non-auto-executable
// tool calls for the caller to handle. The finish reason is set to "stop" to prevent
// further agent loop iterations.
//
// Parameters:
//   - originalResponse: The original chat response to copy metadata from
//   - executedToolResults: List of tool execution results from auto-executable tools
//   - executedToolCalls: List of tool calls that were executed
//   - nonAutoExecutableToolCalls: List of tool calls that require manual execution
//
// Returns:
//   - *schemas.BifrostChatResponse: A new chat response with executed results and pending tool calls
func createChatResponseWithExecutedToolsAndNonAutoExecutableCalls(
	originalResponse *schemas.BifrostChatResponse,
	executedToolResults []*schemas.ChatMessage,
	executedToolCalls []schemas.ChatAssistantMessageToolCall,
	nonAutoExecutableToolCalls []schemas.ChatAssistantMessageToolCall,
) *schemas.BifrostChatResponse {
	// Start with a copy of the original response metadata
	response := &schemas.BifrostChatResponse{
		ID:                originalResponse.ID,
		Object:            originalResponse.Object,
		Created:           originalResponse.Created,
		Model:             originalResponse.Model,
		Choices:           make([]schemas.BifrostResponseChoice, 0),
		ServiceTier:       originalResponse.ServiceTier,
		SystemFingerprint: originalResponse.SystemFingerprint,
		Usage:             originalResponse.Usage,
		ExtraFields:       originalResponse.ExtraFields,
		SearchResults:     originalResponse.SearchResults,
		Videos:            originalResponse.Videos,
		Citations:         originalResponse.Citations,
	}

	// Build a map from tool call ID to tool name for easy lookup
	toolCallIDToName := make(map[string]string)
	for _, toolCall := range executedToolCalls {
		if toolCall.ID != nil && toolCall.Function.Name != nil {
			toolCallIDToName[*toolCall.ID] = *toolCall.Function.Name
		}
	}

	// Build content text showing executed tool results
	var contentText string
	if len(executedToolResults) > 0 {
		// Format tool results as JSON-like structure
		toolResultsMap := make(map[string]interface{})
		for _, toolResult := range executedToolResults {
			// Get tool name from tool call ID mapping
			var toolName string
			if toolResult.ChatToolMessage != nil && toolResult.ChatToolMessage.ToolCallID != nil {
				toolCallID := *toolResult.ChatToolMessage.ToolCallID
				if name, ok := toolCallIDToName[toolCallID]; ok {
					toolName 
```

### Core Architecture Module: `core/mcp/clientmanager.go`
```
package mcp

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"maps"
	"net"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/maximhq/bifrost/core/mcp/utils"
	"github.com/maximhq/bifrost/core/network"
	"github.com/maximhq/bifrost/core/schemas"
)

// mcpDialTimeout bounds each dial attempted by the SSRF-safe HTTP client MCP
// client connections use, matching the timeout convention used by the other
// SSRF-guarded outbound clients in this codebase (image/document fetch, skill
// URL sources).
const mcpDialTimeout = 10 * time.Second

// AcquireClientConn returns a live upstream MCP client connection for the
// given client state, along with a release function the caller must invoke
// (typically via defer).
//
// For shared-connection auth types (none, headers, server_oauth) the
// connection is the persistent state.Conn and the release is a no-op — the
// caller MUST NOT close it.
//
// For per-user auth types (per_user_oauth, …) a fresh ephemeral connection
// is opened per call. The opening is wrapped in the connect-plugin gate
// (runConnectWithPluginPipeline) just like AddClient/Reconnect does for
// shared connections — PreConnectionHook plugins observe the admin-configured
// static headers and may mutate them; credstore-resolved auth headers are
// layered on top AFTER the plugin gate, so the bearer token is never
// observable by plugins. Credential-resolution errors (including
// *MCPUserOAuthRequiredError) surface from this method without opening any
// connection.
func (m *MCPManager) AcquireClientConn(ctx *schemas.BifrostContext, state *schemas.MCPClientState) (*client.Client, func(), error) {
	if state == nil || state.ExecutionConfig == nil {
		return nil, nil, fmt.Errorf("client state is required")
	}
	config := state.ExecutionConfig

	if !m.credStore.RequiresPerCallConnection(config) {
		if state.Conn == nil {
			return nil, nil, fmt.Errorf("MCP client %s has no active connection", config.Name)
		}
		return state.Conn, func() {}, nil
	}

	// Per-user: open an ephemeral transport per call, wrapped in the
	// connect-plugin gate for parity with shared-connection setup.
	if config.ConnectionString == nil || config.ConnectionString.GetValue() == "" {
		return nil, nil, fmt.Errorf("connection URL is required for ephemeral MCP execution")
	}
	url := config.ConnectionString.GetValue()

	connectReq := &schemas.BifrostMCPConnectRequest{
		ClientName:       config.Name,
		ConnectionType:   config.ConnectionType,
		AuthType:         config.AuthType,
		ConnectionString: &url,
		Headers:          utils.FlattenHeaders(utils.StaticConfigHeaders(config)),
	}

	// Closure-captured outputs from the op so the caller can CallTool on the
	// live client after the gate returns.
	var tempClient *client.Client
	// MCPAuthRequiredError is wrapped into a generic BifrostError by the
	// pipeline before PostConnectionHook runs, so capture it out-of-band to
	// preserve the typed-error info for the envelope path. Same capture
	// covers both per-user-OAuth (Kind=oauth) and per-user-headers
	// (Kind=headers) surfaces.
	var authRequiredErr *schemas.MCPAuthRequiredError
	start := time.Now()

	_, gateErr := m.runConnectWithPluginPipeline(ctx, connectReq, func(preReq *schemas.BifrostMCPConnectRequest) (*schemas.BifrostMCPConnectResponse, error) {
		// Resolve auth headers AFTER PreConnectionHook ran. Plugins never see
		// the Authorization header — it lives only on the wire transport.
		authHeaders, credErr := m.credStore.ConnectionHeaders(ctx, config)
		if credErr != nil {
			errors.As(credErr, &authRequiredErr)
			return nil, credErr
		}

		// Compose final transport headers: plugin-mutated static base + auth on top.
		finalHeaders := make(map[string]string, len(preReq.Headers)+len(authHeaders))
		maps.Copy(finalHeaders, preReq.Headers)
		for k, vals := range authHeaders {
			if len(vals) > 0 {
				finalHeaders[k] = vals[0]
			}
		}

		targetURL := url
		if preReq.ConnectionString != nil && *preReq.ConnectionString != "" {
			targetURL = *preReq.ConnectionString
		}

		// finalHeaders (statics + per-user auth) are baked on; allowlisted per-request
		// extras are injected via headerFunc so they reach tools/call now that the
		// CallToolRequest.Header path has been centralized onto the transport.
		perUserOpts := []transport.StreamableHTTPCOption{
			transport.WithHTTPHeaders(finalHeaders),
			transport.WithHTTPHeaderFunc(func(reqCtx context.Context) map[string]string {
				return utils.FlattenHeaders(utils.ExtractFilteredExtras(reqCtx, config))
			}),
		}
		perUserTLSClient, tlsErr := m.buildTLSHTTPClient(config)
		if tlsErr != nil {
			return nil, fmt.Errorf("failed to build TLS HTTP client: %w", tlsErr)
		}
		if perUserTLSClient != nil {
			perUserOpts = append(perUserOpts, transport.WithHTTPBasicClient(perUserTLSClient))
		}
		initRequest := mcp.InitializeRequest{
			Params: mcp.InitializeParams{
				ProtocolVersion: mcp.LATEST_PROTOCOL_VERSION,
				Capabilities:    mcp.ClientCapabilities{},
				ClientInfo: mcp.Implementation{
					Name:    fmt.Sprintf("Bifrost-%s-user", config.Name),
					Version: "1.0.0",
				},
			},
		}
		// Build, start, and initialize with a single retry loop covering the
		// whole connect handshake — same recreate-fresh-per-attempt shape as
		// connectToMCPClient's shared-connect path (each attempt closes the
		// previous attempt's client and builds a new one) but with
		// PerCallConnectRetryConfig, not ConnectRetryConfig: unlike the shared
		// dial, this runs synchronously in front of a live tool call with no
		// separate budget wrapper around it, so it can't afford the shared
		// path's full backoff schedule. Previously Start ran once with no
		// retry at all — a transient blip failed the whole tool call outright.
		//
		// Start and Initialize share one retry budget (not two separate
		// ones) deliberately: a failed Initialize can leave the transport
		// broken — mcp-go marks initialization state before validating the
		// response — so a retry needs a fresh client from Start onward
		// regardless of which of the two failed, and one combined attempt
		// achieves that without extra bookkeeping to track which stage a
		// given retry is rebuilding for.
		var initResult *mcp.InitializeResult
		if err := ExecuteWithRetry(
			ctx,
			func() error {
				if tempClient != nil {
					if closeErr := tempClient.Close(); closeErr != nil {
						m.logger.Warn("%s Failed to close ephemeral client during retry: %v", MCPLogPrefix, closeErr)
					}
				}
				httpTransport, err := transport.NewStreamableHTTP(targetURL, perUserOpts...)
				if err != nil {
					return fmt.Errorf("failed to create HTTP transport: %w", err)
				}
				tempClient = client.NewClient(httpTransport)
				if err := tempClient.Start(ctx); err != nil {
					return err
				}

				// Bound the MCP `initialize` handshake — a stalled upstream (TCP
				// open succeeds but JSON-RPC initialize never returns) would
				// otherwise block the entire tool call until the parent request
				// ctx fires. Mirrors the bound used for shared-connection
				// Initialize in connectToMCPClient. Fresh per attempt, not
				// deferred to the end of the retry loop.
				initCtx, initCancel := context.WithTimeout(ctx, MCPClientConnectionEstablishTimeout)
				defer initCancel()
				initResult, err = tempClient.Initialize(initCtx, initRequest)
				return err
			},
			PerCallConnectRetryConfig,
			m.logger,
		); err != nil {
			if tempClient != nil {
				_ = tempClient.Close()
				tempClient = nil
			}
			return nil, fmt.Errorf("failed to establish ephemeral MCP connection: %w", err)
		}

		// Build the gate response from the captured initialize result so
		// PostConnectionHook plugins observe what the upstream advertised.
		resp := &schemas.BifrostMCPConnectResponse{
			ConnectionInfo: &schemas.MCPClientConnectionInfo{
				Type:          config.ConnectionType,
				ConnectionURL: &targetURL,
			},
			ExtraFields: schemas.BifrostMCPResponseExtraFields{
				Latency: time.Since(start).Milliseconds(),
			},
		}
		if initResult != nil {
			resp.ProtocolVersion = initResult.ProtocolVersion
			resp.Instructions = initResult.Instructions
			resp.ServerInfo = &schemas.MCPServerInfo{
				Name:    initResult.ServerInfo.Name,
				Version: initResult.ServerInfo.Version,
			}
			resp.ServerCapabilities = &schemas.MCPServerCapabilities{
				Tools:     initResult.Capabilities.Tools != nil,
				Resources: initResult.Capabilities.Resources != nil,
				Prompts:   initResult.Capabilities.Prompts != nil,
				Logging:   initResult.Capabilities.Logging != nil,
			}
		}
		return resp, nil
	})

	if gateErr != nil {
		if tempClient != nil {
			_ = tempClient.Close()
		}
		if authRequiredErr != nil {
			return nil, nil, authRequiredErr
		}
		if gateErr.Error != nil {
			return nil, nil, fmt.Errorf("%s", gateErr.Error.Message)
		}
		return nil, nil, fmt.Errorf("ephemeral connection setup failed for %s", config.Name)
	}

	if tempClient == nil {
		// Plugin short-circuited connect with a synthetic success response and
		// no live transport — we have nothing to execute against.
		return nil, nil, fmt.Errorf("ephemeral MCP connection was short-circuited by plugin for %s", config.Name)
	}

	release := func() {
		if err := tempClient.Close(); err != nil {
			m.logger.Warn("%s Failed to close ephemeral client for %s: %v", MCPLogPrefix, config.Name, err)
		}
	}
	return tempClient, release, nil
}

// GetClients returns all MCP clients managed by the manager.
//
// Returns:
//   - []*schemas.MCPClientState: List of all MCP clients
func (m *MCPManager) GetClients() []schemas.MCPClientState {
	m.mu.RLock()
	defer m.mu.RUnlock()

	clients := make([]schemas.MCPClientState, 0, len(m.clientMap))
	for _, client := range m.clientMap {
		// A struct copy: ToolMap is cloned below because callers may ran
```

### Core Architecture Module: `core/mcp/codemode.go`
```
//go:build !tinygo && !wasm

package mcp

import (
	"sync"
	"time"

	"github.com/maximhq/bifrost/core/schemas"
)

// CodeMode tool type constants
const (
	ToolTypeListToolFiles   string = "listToolFiles"
	ToolTypeReadToolFile    string = "readToolFile"
	ToolTypeGetToolDocs     string = "getToolDocs"
	ToolTypeExecuteToolCode string = "executeToolCode"
)

// CodeModeLogPrefix is the log prefix for code mode operations
const CodeModeLogPrefix = "[CODE MODE]"

// CodeMode defines the interface for code execution environments.
// Implementations can provide different interpreters (Starlark, Lua, JavaScript, etc.)
// while maintaining the same tool interface for the ToolsManager.
type CodeMode interface {
	// GetTools returns the code mode meta-tools (listToolFiles, readToolFile, getToolDocs, executeToolCode)
	// These tools are added to the available tools when a code mode client is connected.
	GetTools() []schemas.ChatTool

	// ExecuteTool handles a code mode tool call by name.
	// Returns the response message and any error that occurred.
	ExecuteTool(ctx *schemas.BifrostContext, toolCall schemas.ChatAssistantMessageToolCall) (*schemas.ChatMessage, error)

	// IsCodeModeTool returns true if the given tool name is a code mode tool.
	IsCodeModeTool(toolName string) bool

	// GetBindingLevel returns the current code mode binding level (server or tool).
	GetBindingLevel() schemas.CodeModeBindingLevel

	// UpdateConfig updates the code mode configuration atomically.
	UpdateConfig(config *CodeModeConfig)

	// SetDependencies sets the dependencies required for code execution.
	// This is called by MCPManager after construction to inject the dependencies
	// (ClientManager, plugin pipeline, etc.) that weren't available at CodeMode creation time.
	SetDependencies(deps *CodeModeDependencies)
}

// CodeModeConfig holds the configuration for a CodeMode implementation.
type CodeModeConfig struct {
	// BindingLevel controls how tools are exposed in the VFS: "server" or "tool"
	BindingLevel schemas.CodeModeBindingLevel

	// ToolExecutionTimeout is the maximum time allowed for tool execution
	ToolExecutionTimeout time.Duration

	// Limits bounds each execution; nil keeps the current limits
	Limits *schemas.MCPCodeModeLimits
}

// CodeModeDependencies holds the dependencies required by CodeMode implementations.
type CodeModeDependencies struct {
	// ClientManager provides access to MCP clients and their tools
	ClientManager ClientManager

	// FetchNewRequestIDFunc generates unique request IDs for nested tool calls
	FetchNewRequestIDFunc func(ctx *schemas.BifrostContext) string

	// LogMutex protects concurrent access to logs during code execution
	LogMutex *sync.Mutex

	// CredentialStore resolves per-call credentials (Bearer tokens, headers)
	// and signals whether a client requires an ephemeral upstream connection.
	CredentialStore schemas.MCPCredentialStore
}

// DefaultCodeModeConfig returns the default configuration for CodeMode.
func DefaultCodeModeConfig() *CodeModeConfig {
	return &CodeModeConfig{
		BindingLevel:         schemas.CodeModeBindingLevelServer,
		ToolExecutionTimeout: schemas.DefaultToolExecutionTimeout,
	}
}

// codeModeToolNames is a set of all code mode tool names for fast lookup
var codeModeToolNames = map[string]bool{
	ToolTypeListToolFiles:   true,
	ToolTypeReadToolFile:    true,
	ToolTypeGetToolDocs:     true,
	ToolTypeExecuteToolCode: true,
}

// IsCodeModeTool returns true if the given tool name is a code mode tool.
// This is a package-level helper function.
func IsCodeModeTool(toolName string) bool {
	return codeModeToolNames[toolName]
}

// toolCallInfo represents a tool call extracted from code.
// Used for validating tool calls before auto-execution in agent mode.
type toolCallInfo struct {
	serverName string
	toolName   string
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7926** (2026-10-04): **[Bug]: Gemini/Vertex drop function tools without input_schema and mis-pair parallel tool results**
  *Symptoms*:  ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  Two related bugs in the Anthropic-compatible / Responses API -> Gemini/Vertex request translation:  1. **Function tools declared without `input_schema` are silently dropped.** The Anthropic -> Bifrost converter leaves `ResponsesToolFunction` nil when a tool has neither `input_schema` nor `strict`, and the Gemini converter only emits a `FunctionDeclaration` when `ResponsesToolFunction != nil`. The request reaches Gemini with no tools, so the model answers as if it had none (or says it cannot call the tool).  2. **Parallel tool results are paired by position, not by `tool_use_id`, on Vertex.** The tool_use_id is carried into `FunctionCall.ID` / `FunctionResponse.ID`, but `stripVertexGeminiUnsupportedFields` blanks both ids for Vertex (Vertex rejects them). Vertex then pairs responses with calls by position, and nothing reorders the function responses to follow the preceding function calls. When a client returns the `tool_result` blocks in a different order than the `tool_use` blocks (common with parallel calls of the same tool), the results are attached to the wrong calls.  We reproduced both with Anthropic Messages requests routed to Gemini models on Vertex.  ### Steps to reproduce  Bug 1 (any Gemini or Vertex Gemini model):  ```sh curl -s http://localhost:8080/anthropic/v1/messages \   -H 'con

- **Issue #7920** (2026-10-05): **[Bug]: Anthropic /v1/messages never reports stop_reason "stop_sequence" or the matched stop_sequence**
  *Symptoms*:  ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  When a Claude request sets `stop_sequences` and generation stops on one of them, the Anthropic-compatible endpoint returns `"stop_reason": "end_turn"` and `"stop_sequence": null`. The upstream Anthropic API returns `"stop_reason": "stop_sequence"` and `"stop_sequence": "<matched string>"`. This affects both streaming and non-streaming responses, for Claude on the Anthropic provider and on Vertex, because the response is converted Anthropic -> Bifrost Responses -> Anthropic and the matched sequence is lost on the way.  Clients that branch on `stop_reason == "stop_sequence"` (for example, to know which delimiter ended the turn) can't tell a stop-sequence stop apart from a natural end of turn. We reproduced this against Claude on Vertex with a prompt that deterministically hits a requested stop sequence.  ### Steps to reproduce  1. Configure an Anthropic (or Vertex) provider with a Claude model. 2. Send:  ```bash curl -s http://localhost:8080/anthropic/v1/messages \   -H 'content-type: application/json' \   -H 'anthropic-version: 2023-06-01' \   -d '{     "model": "anthropic/claude-sonnet-4-5",     "max_tokens": 100,     "stop_sequences": ["5"],     "messages": [{"role": "user", "content": "Count from 1 to 10 separated by spaces."}]   }' | jq '{stop_reason, stop_sequence}' ```  3. Repeat with `"s

- **Issue #7915** (2026-10-04): **[Bug]: Anthropic-compatible /anthropic/v1/messages returns wrong or non-standard error.type**
  *Symptoms*:  ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  The error envelope returned on the Anthropic-compatible routes (`/anthropic/v1/messages`, `/anthropic/v1/messages/count_tokens`, ...) does not always carry one of Anthropic's documented `error.type` values, and the type often disagrees with the HTTP status of the response:  1. Any error whose `BifrostError.Error.Type` is empty is reported as `api_error`, regardless of status. A 400 validation error (e.g. a request body that fails to decode, or a request type the provider does not support) comes back as HTTP 400 with `"type": "api_error"`. 2. Any non-empty `Error.Type` is passed through verbatim. Gemini and Vertex errors set `Error.Type` to the google.rpc status name, so Anthropic clients receive values like `"INVALID_ARGUMENT"` or `"RESOURCE_EXHAUSTED"`, which are not Anthropic error types.  Clients and SDKs that branch on `error.type` (retry logic, user-facing error handling) misclassify these errors. For example, a 400 labelled `api_error` reads as a retryable server fault.  ### Steps to reproduce  1. Send a request with a body that fails to decode (wrong field type):  ```sh curl -s http://localhost:8080/anthropic/v1/messages \   -H 'content-type: application/json' \   -H 'anthropic-version: 2023-06-01' \   -d '{"model":"anthropic/claude-sonnet-4-5","max_tokens":"64","messages":[{"role":"use

- **Issue #7843** (2026-10-03): **[Bug]: Postgres log store batch inserts exceed the 65,535 bind-parameter limit, so full batches fall back to row-by-row inserts**
  *Symptoms*: ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  With the Postgres logs store, the logging plugin's writer sends each batch to `RDBLogStore.BatchCreateIfNotExists`, which inserts the whole slice as one `INSERT ... ON CONFLICT (id) DO NOTHING` statement (`framework/logstore/rdb.go:575-588`, `.Create(&entries)`). `logs` has 117 persisted columns, and `inc_number` is omitted on Postgres, so each row binds 116 parameters. Any batch above `floor(65535 / 116) = 564` rows therefore exceeds Postgres's extended-protocol limit, and pgx rejects the statement:  ``` batch insert failed for 999 entries, falling back to individual inserts: extended protocol limited to 65535 parameters ```  The default `max_batch_size` is 1000 (`framework/logstore/config.go:25`). So whenever the writer is behind, every full batch fails. `processBatch` (`plugins/logging/writer.go:164-178`) then retries each row as its own `INSERT`. That is far slower, so the backlog grows instead of draining, and the next batch is full again.  Nothing in `framework/logstore` uses `CreateInBatches` or `CreateBatchSize`, at `transports/v2.2.4` or on `main` (`f691b5a1b`).  The MCP tool log path (`writer.go:183-185`) uses the same pattern with 43 columns. It stays under the limit at the default batch size, but fails once `max_batch_size` goes above 1524.  ### Steps to reproduce  1. Run Bifrost wi
  **Post-Mortem & Fix Analysis**:
  > checking this 

- **Issue #7819** (2026-10-03): **[Bug]: Transcription cost ignores provider-reported usage.cost and per-second pricing is unreachable when input_tokens > 0**
  *Symptoms*: ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  For transcription requests, Bifrost ignores the cost reported by the provider and computes its own cost. For providers that report both a small, fixed number of `input_tokens` and the billed `seconds`, the computed cost is wrong no matter which pricing fields are configured.  Example: OpenRouter, `mistralai/voxtral-mini-transcribe-2602`, called through a custom provider with base provider type `openai`. The upstream response contains:  ```json "usage": {"seconds": 31, "total_tokens": 202, "input_tokens": 6, "output_tokens": 196, "cost": 0.001705} ```  `cost` is exactly `seconds × $0.000055`, the per-second price. `input_tokens` is only the text prompt. It is 4 without `language` and 6 with `language`, and it is constant regardless of audio length: we got 6 tokens for both 10.4 s and 31.3 s of audio.  Two things in `framework/modelcatalog/datasheet/cost.go` combine here:  1. **The provider-reported cost is dropped for transcription.** `calculateBaseCost` uses the provider cost when it is present (`// If provider already computed cost, use it`, `input.usage.Cost.TotalCost > 0`). `extractTranscriptionUsage` builds a fresh `BifrostLLMUsage` from `TranscriptionUsage`, but it never copies `u.Cost`, so this shortcut can't trigger for transcription. `TranscriptionUsage.Cost` itself is parsed correctly:
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this. The plan is the minimal fix from the first point: copy `TranscriptionUsage.Cost` in `extractTranscriptionUsage`, so a provider-reported transcription cost is used the same way as for chat, with a test built from the `usage` in this issue. I'd leave the second point (per-second price versus prompt tokens in `computeAudioInputCost`) for a maintainer to decide, since it changes the price of every transcription model that has both rates. 

- **Issue #7812** (2026-10-03): **[Bug]: Gemini embeddings: `taskType`/`title` applied only to the first input of a batched `/v1/embeddings` request**
  *Symptoms*: ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  A `/v1/embeddings` request to a Gemini embedding model with several inputs and `taskType` in extra params applies `taskType` only to the first input. Every later input is embedded with Gemini's default task type, `RETRIEVAL_QUERY`. Nothing errors, so callers get vectors from the wrong embedding space without knowing it. `title` is affected the same way.  <details> <summary>Cause according to Claude</summary>  In `core/providers/gemini/embedding.go` (`ToGeminiEmbeddingRequest`):  ```go batchRequest.ExtraParams = bifrostReq.Params.ExtraParams   // shares the map, does not copy it  for i, text := range texts {     ...     if taskType, ok := schemas.SafeExtractStringPointer(bifrostReq.Params.ExtraParams["taskType"]); ok {         delete(batchRequest.ExtraParams, "taskType")         // deletes from the shared map         embeddingReq.TaskType = taskType     }     // same for "title" ```  Both names point at the same map, so the first pass deletes taskType and title, and every later pass finds nothing.  #### Suggested fix  Read taskType and title once, before the loop. Assign them to every embeddingReq, then delete them from batchRequest.ExtraParams once, after the loop. Alternatively, give the batch its own copy of the map with maps.Clone. A unit test with two or more inputs that asserts TaskType on
  **Post-Mortem & Fix Analysis**:
  > checking this

- **Issue #7701** (2026-09-30): **[Bug]: Bedrock: GPT-6 Sol/Luna reject temperature/top_p at every reasoning effort (including "none"), and Bifrost does not strip them**
  *Symptoms*:  ### Prerequisites - [x] I have searched existing issues and discussions to avoid duplicates. The nearest is #5323, which strips on the OpenAI/Azure paths only. - [x] I am using the latest version (or have tested against main/nightly). I reproduced on `transports/v2.2.3` and checked the code on `dev` @ `bf515003d`.  ### Description Requests to OpenAI GPT-6 Sol or Luna on the **Bedrock** provider fail with HTTP 400 whenever the caller sends `temperature` or `top_p`. This happens at every `reasoning_effort`, including `"none"`. Bifrost already strips these fields for the same models on the OpenAI/Azure paths, using `samplingParamUnsupported`. The Bedrock Converse builders copy them through unconditionally.  This is stricter than OpenAI first-party, which only asks callers to drop `temperature`/`top_p` "when reasoning effort is not `none`". On Bedrock, both fields are rejected even with `reasoning.effort: "none"`.  Many SDKs and eval tools send `temperature` by default, so these models are unusable through Bifrost from those clients unless every caller changes its code.  ### Steps to reproduce Configure a Bedrock provider key with access to the `global.openai.gpt-6-luna` cross-region profile. Then:  ```sh # 400 curl -s http://localhost:8080/v1/chat/completions -H "Content-Type: application/json" \   -d '{"model":"bedrock/global.openai.gpt-6-luna","max_tokens":32,"temperature":0.2,"reasoning_effort":"none",        "messages":[{"role":"user","content":"Reply OK."}]}'  # 200 (same 
  **Post-Mortem & Fix Analysis**:
  > @DudiPeretz-Orca updated the datasheet, can you force once (Models > Model Settings > Force Sync Now).

- **Issue #7694** (2026-09-30): **[Bug]: Gemini rejects tool results that contain `$ref` — JSON-object tool output is forwarded as structured function_response.response**
  *Symptoms*: ### Prerequisites  - [x] I have searched existing issues and discussions to avoid duplicates - [x] I am using the latest version (or have tested against main/nightly)  ### Description  When a `role: "tool"` message is sent to a Gemini model through `/v1/chat/completions`, and its content is a valid JSON object, Bifrost sends that object as-is as Gemini's `function_response.response`. The code is in `core/providers/gemini/utils.go`, under "Try to use raw JSON if it's a valid JSON object".  Gemini's multimodal function responses treat any `{"$ref": "<name>"}` inside `function_response.response` as a pointer to a `display_name` in `function_response.parts`. Tool output often contains `$ref` for ordinary reasons, such as an OpenAPI spec or a JSON Schema. Gemini then rejects the whole request with a 400.  A text tool result that happens to be JSON gets a different meaning at the provider. When the content is not valid JSON, Bifrost wraps it as `{"content": "<string>"}`, and the request succeeds.  ### Steps to reproduce  1. Send this request to `/v1/chat/completions` with `model: "gemini/gemini-flash-latest"`:  ```json {   "model": "gemini/gemini-flash-latest",   "max_tokens": 20,   "messages": [     { "role": "user", "content": "Fetch the spec, then reply ok." },     { "role": "assistant", "content": null, "tool_calls": [       { "id": "c1", "type": "function", "function": { "name": "bash", "arguments": "{\"command\":\"cat spec.json\"}" } }     ] },     { "role": "tool", "tool_cal
  **Post-Mortem & Fix Analysis**:
  > This was already fixed I guess - checking if this is a regression 

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

### Incident Patch 1: `21dded89` (2026-10-05)
**Commit Message**: fix: gpt live sessions handling (#7723)

## Summary

Adds a GPT Live primary WebSocket handler (`WSLiveHandler`) that proxies OpenAI GPT Live sessions and bills them incrementally as they run. Voice time is billed in rolling 30-second windows; backend Responses calls are billed once per terminal event. Governance is checked at each window boundary so a session that exhausts its budget is ended gracefully rather than silently continuing.

## Changes

- **`WSLiveHandler` and `liveRelay`** (`wslive.go`): Accepts WebSocket upgrades at `/v1/live/sessions` and the OpenAI integration paths. Reads `session.start` before opening an upstream connection, resolves a key, admits the session through governance, then relays frames bidirectionally. Intercepts `session.usage.updated`, `response.event`, `session.closed`, and `session.update` events to drive billing and enforce model access without decoding audio frames.

- **`liveMeter`** (`livemeter.go`): Tracks one GPT Live session's billing state. Maintains a voice lane billed in configurable windows (default 30 s) from cumulative OpenAI snapshots, and per-model backend lanes billed once per terminal Responses event. Each window opens a new gover

**File**: `core/bifrost.go` (modified, +26/-13)
```diff
@@ -4952,11 +4952,7 @@ func (bifrost *Bifrost) SelectKeyForProviderRequestType(ctx *schemas.BifrostCont
 	if ctx == nil {
 		ctx = bifrost.ctx
 	}
-	baseProvider := providerKey
-	if config, err := bifrost.account.GetConfigForProvider(providerKey); err == nil && config != nil &&
-		config.CustomProviderConfig != nil && config.CustomProviderConfig.BaseProviderType != "" {
-		baseProvider = config.CustomProviderConfig.BaseProviderType
-	}
+	baseProvider := bifrost.baseProviderType(providerKey)
 	supportedKeys, _, err := bifrost.selectKeyFromProviderForModelWithPool(ctx, requestType, providerKey, model, baseProvider)
 	if err != nil {
 		return schemas.Key{}, err
@@ -4984,6 +4980,21 @@ func (bifrost *Bifrost) SelectKeyForProviderRequestType(ctx *schemas.BifrostCont
 	return bifrost.keySelector(ctx, supportedKeys, providerKey, model)
 }
 
+// KeySupportsModel reports whether key may serve model under the same rules key selection applies.
+// Used to re-check a session's pinned key when the session switches models mid-flight.
+func (bifrost *Bifrost) KeySupportsModel(providerKey schemas.ModelProvider, key schemas.Key, model string) bool {
+	return keySupportsModel(bifrost.baseProviderType(providerKey), &key, model)
+}
+
+// baseProviderType returns the provider type a custom provider is built on, or providerKey itself.
+func (bifrost *Bifrost) baseProviderType(providerKey schemas.ModelProvider) schemas.ModelProvider {
+	if config, err := bifrost.account.GetConfigForProvider(providerKey); err == nil && config != nil &&
+		config.CustomProviderConfig != nil && config.CustomProviderConfig.BaseProviderType != "" {
+		return config.CustomProviderConfig.BaseProviderType
+	}
+	return providerKey
+}
+
 // ComputeRawStorageForProvider determines whether raw request/response payloads should be
 // captured and stored in log records for the given provider. This is the same computation
 // performed inside executeRequest (lines 5675-5713), exported for callers that bypass
@@ -5188,7 +5199,8 @@ func (bifrost *Bifrost) RunStreamPreHooks(ctx *schemas.BifrostContext, req *sche
 }
 
 // RunRealtimeTurnPreHooks acquires a plugin pipeline and runs LLM pre-hooks for
-// a single realtime turn. Unlike generic stream hooks, realtime turns do not
+// a single turn of a long-lived session: a realtime turn, or a GPT Live billing
+// unit. The request type comes from req. Unlike generic stream hooks, turns do not
 // support short-circuit responses in v1 because the transports cannot yet emit a
 // fully synthetic assistant turn without an upstream generation.
 func (bifrost *Bifrost) RunRealtimeTurnPreHooks(ctx *schemas.BifrostContext, req *schemas.BifrostRequest) (*RealtimeTurnHooks, *schemas.BifrostError) {
@@ -5218,6 +5230,7 @@ func (bifrost *Bifrost) RunRealtimeTurnPreHooks(ctx *schemas.BifrostContext, req
 		}
 	}
 
+	requestType := req.RequestType
 	pipeline := bifrost.getPluginPipeline()
 	cleanup := func() {
 		if traceID, ok := ctx.Value(schemas.BifrostContextKeyTraceID).(string); ok && traceID != "" {
@@ -5230,7 +5243,7 @@ func (bifrost *Bifrost) RunRealtimeTurnPreHooks(ctx *schemas.BifrostContext, req
 	preReq, shortCircuit, preCount := pipeline.RunLLMPreHooks(ctx, req)
 	if preReq == nil && shortCircuit == nil {
 		bifrostErr := newBifrostErrorFromMsg("bifrost request after plugin hooks cannot be nil")
-		bifrostErr.PopulateExtraFields(schemas.RealtimeRequest, provider, model, model)
+		bifrostErr.PopulateExtraFields(requestType, provider, model, model)
 		_, bifrostErr = pipeline.RunPostLLMHooks(ctx, nil, bifrostErr, preCount)
 		drainAndAttachPluginLogs(ctx)
 		if traceID, ok := ctx.Value(schemas.BifrostContextKeyTraceID).(string); ok && strings.TrimSpace(traceID) != "" {
@@ -5241,7 +5254,7 @@ func (bifrost *Bifrost) RunRealtimeTurnPreHooks(ctx *schemas.BifrostContext, req
 	}
 	if shortCircuit != nil {
 		if shortCircuit.Error != nil {
-			shortCircuit.Error.PopulateExtraFields(schemas.RealtimeRequest, provider, model, model)
+			shortCircuit.Error.PopulateExtraFields(requestType, provider, model, model)
 			_, bifrostErr := pipeline.RunPostLLMHooks(ctx, nil, shortCircuit.Error, preCount)
 			drainAndAttachPluginLogs(ctx)
 			if traceID, ok := ctx.Value(schemas.BifrostContextKeyTraceID).(string); ok && strings.TrimSpace(traceID) != "" {
@@ -5257,7 +5270,7 @@ func (bifrost *Bifrost) RunRealtimeTurnPreHooks(ctx *schemas.BifrostContext, req
 			// Short-circuit responses are not supported for realtime turns (v1).
 			// Treat this like an error turn so plugins can close pending state cleanly.
 			bifrostErr := newBifrostErrorFromMsg("realtime turn short-circuit responses are not supported")
-			bifrostErr.PopulateExtraFields(schemas.RealtimeRequest, provider, model, model)
+			bifrostErr.PopulateExtraFields(requestType, provider, model, model)
 			_, bifrostErr = pipeline.RunPostLLMHooks(ctx, nil, bifrostErr, preCount)
 			drainAndAttachPluginLogs(ctx)
 			if traceID, ok := ctx.Value(schemas.BifrostContextKeyTraceID).(string)
```

**File**: `core/bifrost_test.go` (modified, +12/-0)
```diff
@@ -1599,6 +1599,18 @@ func TestSelectKeyForProviderRequestType_AdditionalModels(t *testing.T) {
 		}
 	})
 
+	t.Run("KeySupportsModel applies the same rules to a pinned session key", func(t *testing.T) {
+		if !bifrost.KeySupportsModel(schemas.OpenAI, both, "gpt-5.6-luna") {
+			t.Fatal("key listing the model should support it")
+		}
+		if bifrost.KeySupportsModel(schemas.OpenAI, voiceOnly, "gpt-5.6-luna") {
+			t.Fatal("key not listing the model should not support it")
+		}
+		if bifrost.KeySupportsModel(schemas.OpenAI, wildcardBlocked, "gpt-5.6-luna") {
+			t.Fatal("deny list must win over a wildcard allow list")
+		}
+	})
+
 	t.Run("direct key bypasses model lists", func(t *testing.T) {
 		account.SetKeysForProvider(schemas.OpenAI, []schemas.Key{voiceOnly})
 		ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
```

**File**: `core/schemas/bifrost.go` (modified, +1/-0)
```diff
@@ -328,6 +328,7 @@ const (
 	BifrostContextKeyUserAgent                           BifrostContextKey = "bifrost-user-agent"                               // string (set by bifrost)
 	BifrostContextKeyApp                                 BifrostContextKey = "app"                                              // string (canonical app key such as claude-code; set by plugins)
 	BifrostContextKeySkipBudgetAndRateLimits             BifrostContextKey = "bifrost-skip-budget-and-rate-limits"              // bool (set by bifrost for read-only requests like list models that don't consume quota)
+	BifrostContextKeySessionContinuation                 BifrostContextKey = "bifrost-session-continuation"                     // bool (a billing unit of an already-admitted session, e.g. a GPT Live window; not checked or counted as a request)
 	BifrostContextKeySkipProviderCheck                   BifrostContextKey = "bifrost-skip-provider-check"                      // bool (set by the transport for requests that are evaluated but never routed, such as /inspect, where the provider is the intercepted upstream rather than an operator choice; skips the virtual key and access profile provider allowlists)
 	BifrostContextKeySkipModelCheck                      BifrostContextKey = "bifrost-skip-model-check"                         // bool (set by the transport for requests that are evaluated but never routed, such as /inspect, where the model is the intercepted upstream model rather than an operator grant; skips the virtual key and access profile model allowlists)
 	BifrostContextKeySkipVirtualKeyUsageTracking         BifrostContextKey = "bifrost-skip-virtual-key-usage-tracking"          // bool (set by governance callers to skip VK usage while preserving VK auth/attribution)
```

**File**: `plugins/governance/accounting_test.go` (modified, +33/-26)
```diff
@@ -641,30 +641,37 @@ func TestAccounting_SkipRequestCountChargesCostOnly(t *testing.T) {
 	assert.Equal(t, int64(10), f.tokens())
 }
 
-// TestPostHookWorker_LiveRequestDoesNotCountRequest pins the wiring: the live request
-// type is what marks an update as not counting toward request limits.
-func TestPostHookWorker_LiveRequestDoesNotCountRequest(t *testing.T) {
-	for _, tc := range []struct {
-		requestType  schemas.RequestType
-		wantRequests int64
-	}{
-		{schemas.LiveRequest, 0},
-		{schemas.ResponsesRequest, 1},
-	} {
-		t.Run(string(tc.requestType), func(t *testing.T) {
-			f := newAccountingFixture(t)
-			plugin := &GovernancePlugin{ctx: context.Background(), tracker: f.tracker}
-			result := &schemas.BifrostResponse{ResponsesResponse: &schemas.BifrostResponsesResponse{
-				Usage: &schemas.ResponsesResponseUsage{InputTokens: 7, OutputTokens: 3, TotalTokens: 10},
-			}}
-
-			settled := settleLimits(f.store, "sk-bf-acct", schemas.OpenAI, "gpt-live-1", &UsageUpdate{})
-			plugin.postHookWorker(result, nil, schemas.OpenAI, "gpt-live-1", tc.requestType, "req-"+string(tc.requestType), "", false, 0, nil, settled.Budgets, settled.RateLimits, nil)
-
-			assert.EventuallyWithT(t, func(c *assert.CollectT) {
-				assert.Equal(c, int64(10), f.tokens())
-			}, time.Second, 10*time.Millisecond)
-			assert.Equal(t, tc.wantRequests, f.requests())
-		})
-	}
+// TestAccounting_SessionContinuationSkipsRequestLimits: a billing unit of an admitted session
+// (a GPT Live window) is neither refused by nor counted against request limits, while its tokens
+// still are. The session's admission unit, without the flag, is refused once the limit is spent.
+func TestAccounting_SessionContinuationSkipsRequestLimits(t *testing.T) {
+	logger := NewMockLogger()
+	rateLimit := buildRateLimitWithUsage("rl-vk", 1_000_000, 0, 1, 1) // request limit already spent
+	vk := buildVirtualKeyWithRateLimit("vk1", "sk-bf-live", "Live VK", rateLimit)
+	store, err := NewLocalGovernanceStore(context.Background(), logger, nil, &configstore.GovernanceConfig{
+		VirtualKeys: []configstoreTables.TableVirtualKey{*vk},
+		RateLimits:  []configstoreTables.TableRateLimit{*rateLimit},
+	}, nil, nil)
+	require.NoError(t, err)
+	plugin, err := InitFromStore(context.Background(), &Config{IsVkMandatory: boolPtr(false)}, logger, store, nil, nil, nil, nil)
+	require.NoError(t, err)
+
+	admission := resolverCtx(store, "sk-bf-live")
+	_, shortCircuit, err := plugin.PreLLMHook(admission, newChatRequest())
+	require.NoError(t, err)
+	require.NotNil(t, shortCircuit, "a new request is refused once the request limit is spent")
+
+	continuation := resolverCtx(store, "sk-bf-live")
+	continuation.SetValue(schemas.BifrostContextKeySessionContinuation, true)
+	_, shortCircuit, err = plugin.PreLLMHook(continuation, newChatRequest())
+	require.NoError(t, err)
+	require.Nil(t, shortCircuit, "a continuation of an admitted session is not refused by the request limit")
+
+	_, _, err = plugin.PostLLMHook(continuation, countableResponse(), nil)
+	require.NoError(t, err)
+	settleAccounting(t, plugin)
+
+	updated := store.GetGovernanceData(context.Background()).RateLimits["rl-vk"]
+	assert.Equal(t, int64(1), updated.RequestCurrentUsage, "the continuation is not counted as a request")
+	assert.Equal(t, int64(1000), updated.TokenCurrentUsage, "the continuation's tokens are still charged")
 }
```

**File**: `plugins/governance/main.go` (modified, +6/-3)
```diff
@@ -1323,6 +1323,8 @@ func (p *GovernancePlugin) PostLLMHook(ctx *schemas.BifrostContext, result *sche
 		// Set by core on every retry iteration.
 		attemptNumber := bifrost.GetIntFromContext(ctx, schemas.BifrostContextKeyNumberOfRetries)
 		routingMetadata, _ := schemas.InitialAttemptRoutingMetadataFromContext(ctx)
+		// A session continuation bills its usage but was already counted as a request at admission.
+		sessionContinuation := bifrost.GetBoolFromContext(ctx, schemas.BifrostContextKeySessionContinuation)
 
 		p.wg.Add(1)
 		go func() {
@@ -1335,7 +1337,7 @@ func (p *GovernancePlugin) PostLLMHook(ctx *schemas.BifrostContext, result *sche
 				}
 			}()
 			// Use the requested model for usage tracking
-			p.postHookWorker(result, err, provider, requestedModel, requestType, requestID, billingNonce, isFinalChunk, attemptNumber, pricingScopes, accountedBudgets, accountedRateLimits, routingMetadata)
+			p.postHookWorker(result, err, provider, requestedModel, requestType, requestID, billingNonce, isFinalChunk, attemptNumber, sessionContinuation, pricingScopes, accountedBudgets, accountedRateLimits, routingMetadata)
 		}()
 	}
 
@@ -1630,8 +1632,9 @@ func (p *GovernancePlugin) Cleanup() error {
 //   - isCacheRead: Whether the request is a cache read
 //   - isBatch: Whether the request is a batch request
 //   - isFinalChunk: Whether the request is the final chunk
+//   - skipRequestCount: Whether this is a session continuation that must not count as a request
 //   - pricingScopes: Prebuilt pricing lookup scopes using governance VK ID (nil if not applicable)
-func (p *GovernancePlugin) postHookWorker(result *schemas.BifrostResponse, bifrostErr *schemas.BifrostError, provider schemas.ModelProvider, model string, requestType schemas.RequestType, requestID string, billingNonce string, isFinalChunk bool, attemptNumber int, pricingScopes *modelcatalog.PricingLookupScopes, budgets, rateLimits []schemas.Limit, routingMetadata *schemas.BifrostRoutingMetadata) {
+func (p *GovernancePlugin) postHookWorker(result *schemas.BifrostResponse, bifrostErr *schemas.BifrostError, provider schemas.ModelProvider, model string, requestType schemas.RequestType, requestID string, billingNonce string, isFinalChunk bool, attemptNumber int, skipRequestCount bool, pricingScopes *modelcatalog.PricingLookupScopes, budgets, rateLimits []schemas.Limit, routingMetadata *schemas.BifrostRoutingMetadata) {
 	// Determine if request was successful
 	success := (result != nil)
 	billedReason := "success"
@@ -1705,7 +1708,7 @@ func (p *GovernancePlugin) postHookWorker(result *schemas.BifrostResponse, bifro
 			Cost:             cost,
 			RequestID:        requestID,
 			BillingNonce:     billingNonce,
-			SkipRequestCount: requestType == schemas.LiveRequest, // a voice billing window is not a request
+			SkipRequestCount: skipRequestCount,
 			IsStreaming:      isStreaming,
 			IsFinalChunk:     isFinalChunk,
 			HasUsageData:     tokensUsed > 0 || cost > 0,
```

**File**: `plugins/governance/routingembedcost_test.go` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ func TestPostHookWorkerAddsRoutingCostToProviderUsageOnError(t *testing.T) {
 	}
 
 	settled := settleLimits(fixture.store, "sk-bf-acct", schemas.OpenAI, "gpt-4o", &UsageUpdate{})
-	plugin.postHookWorker(nil, bifrostErr, schemas.OpenAI, "gpt-4o", schemas.ChatCompletionRequest, "routing-error", "", false, 0, nil, settled.Budgets, settled.RateLimits, routingMetadata)
+	plugin.postHookWorker(nil, bifrostErr, schemas.OpenAI, "gpt-4o", schemas.ChatCompletionRequest, "routing-error", "", false, 0, false, nil, settled.Budgets, settled.RateLimits, routingMetadata)
 
 	// gpt-4o testdata: 2.5e-6 input, 1e-5 output. Routing embedding:
 	// text-embedding-3-small at 2e-8/input token. Both calls are billable.
```

**File**: `plugins/governance/store.go` (modified, +3/-1)
```diff
@@ -2064,6 +2064,8 @@ func (gs *LocalGovernanceStore) deleteVirtualKeyAlias(value string, vkID string)
 
 // CheckRateLimit checks rate limits for tokens and requests across categories
 func (gs *LocalGovernanceStore) CheckRateLimit(ctx context.Context, entityWiseRateLimits EntityWiseRateLimits, tokensBaselines map[string]int64, requestsBaselines map[string]int64) (Decision, error) {
+	// A session continuation was already counted as one request when the session was admitted.
+	sessionContinuation, _ := ctx.Value(schemas.BifrostContextKeySessionContinuation).(bool)
 	for entity, rateLimits := range entityWiseRateLimits {
 		for _, rateLimit := range rateLimits {
 			var violations []string
@@ -2110,7 +2112,7 @@ func (gs *LocalGovernanceStore) CheckRateLimit(ctx context.Context, entityWiseRa
 
 			// Request limits - check if total usage (local + remote baseline) exceeds limit
 			// Skip this check if request limit has expired
-			if !requestLimitExpired && rateLimit.RequestMaxLimit != nil && rateLimit.RequestCurrentUsage+requestsBaseline >= *rateLimit.RequestMaxLimit {
+			if !sessionContinuation && !requestLimitExpired && rateLimit.RequestMaxLimit != nil && rateLimit.RequestCurrentUsage+requestsBaseline >= *rateLimit.RequestMaxLimit {
 				duration := "unknown"
 				if rateLimit.RequestResetDuration != nil {
 					duration = *rateLimit.RequestResetDuration
```

**File**: `transports/bifrost-http/handlers/livemeter.go` (added, +418/-0)
```diff
@@ -0,0 +1,418 @@
+package handlers
+
+import (
+	"context"
+	"strings"
+	"sync"
+	"time"
+
+	"github.com/google/uuid"
+	bifrost "github.com/maximhq/bifrost/core"
+	"github.com/maximhq/bifrost/core/schemas"
+)
+
+// liveBillingWindowSeconds is how much voice time accrues before it is billed and the
+// session's budget is checked again.
+const liveBillingWindowSeconds = 30.0
+
+// liveUnitRunner is the slice of *bifrost.Bifrost the meter needs; tests substitute it.
+type liveUnitRunner interface {
+	RunRealtimeTurnPreHooks(ctx *schemas.BifrostContext, req *schemas.BifrostRequest) (*bifrost.RealtimeTurnHooks, *schemas.BifrostError)
+}
+
+// liveBillingUnit is one admitted pass through the plugin pipeline: pre-hooks already ran and
+// admitted it, and the post-hooks that close it bill whatever usage accrued under it.
+type liveBillingUnit struct {
+	hooks     *bifrost.RealtimeTurnHooks
+	requestID string
+	traceID   string
+	startedAt time.Time
+	preValues map[any]any
+}
+
+// liveLane is the rolling billing unit for one model. The next unit is admitted before the
+// current one closes, so usage always lands in a unit governance already admitted: when the
+// next unit is refused, usage keeps accruing on the current one until the session ends.
+type liveLane struct {
+	model   string
+	backend bool // backend Responses tokens rather than voice seconds
+	current *liveBillingUnit
+
+	seconds     float64                         // voice: accrued, unbilled seconds
+	usage       *schemas.ResponsesResponseUsage // backend: accrued, unbilled tokens
+	serviceTier *schemas.BifrostServiceTier
+}
+
+// liveMeter bills one GPT Live session: voice seconds in windows, and each backend Responses
+// call once. It lives for the session, keyed by nothing but the session itself, and holds only
+// counters, so no stream-sized data is kept on any context.
+type liveMeter struct {
+	runner   liveUnitRunner
+	baseCtx  *schemas.BifrostContext
+	provider schemas.ModelProvider
+	key      schemas.Key
+	window   float64
+
+	sessionID string // Bifrost's id: every unit groups under it, from admission on
+
+	mu                sync.Mutex
+	providerSessionID string // OpenAI's id, known from session.started
+	voice             *liveLane
+	backends          map[string]*liveLane
+	activeBackend     string
+	reportedSeconds   float64 // latest cumulative seconds OpenAI reported
+	lastUsageAt       time.Time
+	billedResponses   map[string]struct{}
+	refusal           *schemas.BifrostError // set once the session may not continue
+	finished          bool
+}
+
+func newLiveMeter(runner liveUnitRunner, baseCtx *schemas.BifrostContext, provider schemas.ModelProvider, key schemas.Key, sessionID string) *liveMeter {
+	return &liveMeter{
+		runner:          runner,
+		baseCtx:         baseCtx,
+		provider:        provider,
+		key:             key,
+		window:          liveBillingWindowSeconds,
+		sessionID:       sessionID,
+		backends:        make(map[string]*liveLane),
+		billedResponses: make(map[string]struct{}),
+		lastUsageAt:     time.Now(),
+	}
+}
+
+// admit opens the session's first units. The voice unit is the session's one request; the
+// backend unit is admitted as a continuation, which also checks the backend model is allowed.
+func (m *liveMeter) admit(voiceModel, backendModel string) *schemas.BifrostError {
+	m.mu.Lock()
+	defer m.mu.Unlock()
+	unit, bifrostErr := m.openUnit(voiceModel, false)
+	if bifrostErr != nil {
+		return bifrostErr
+	}
+	m.voice = &liveLane{model: voiceModel, current: unit}
+	if backendModel == "" {
+		return nil
+	}
+	if bifrostErr := m.openBackendLane(backendModel); bifrostErr != nil {
+		m.closeUnitWithError(m.voice.current, voiceModel, bifrostErr)
+		m.voice = nil
+		m.finished = true
+		return bifrostErr
+	}
+	m.activeBackend = backendModel
+	return nil
+}
+
+// setProviderSessionID records OpenAI's session id once session.started names it.
+func (m *liveMeter) setProviderSessionID(id string) {
+	if id = strings.TrimSpace(id); id == "" {
+		return
+	}
+	m.mu.Lock()
+	m.providerSessionID = id
+	m.mu.Unlock()
+}
+
+// onUsage records a cumulative session.usage.updated snapshot and bills a full window.
+// It returns the refusal that ends the session, if the next window was not admitted.
+func (m *liveMeter) onUsage(cumulativeSeconds float64) *schemas.BifrostError {
+	m.mu.Lock()
+	defer m.mu.Unlock()
+	m.lastUsageAt = time.Now()
+	m.accrueSecondsLocked(cumulativeSeconds)
+	if m.voice == nil || m.voice.seconds < m.window {
+		return m.refusal
+	}
+	m.rotateLocked(m.voice)
+	return m.refusal
+}
+
+// checkStale re-admits the voice lane when OpenAI has sent no usage for two windows, so an idle
+// session still meets the budget check. Nothing is billed that OpenAI did not report.
+func (m *liveMeter) checkStale(now time.Time) *schemas.BifrostError {
+	m.mu.Lock()
+	defer m.mu.Unlock()
+	if m.voice == nil || m.finished || m.refusal != nil || now.Sub(m.lastUsageAt) < 2*time.Duration(m.window*float64(time.Secon
```

---

### Incident Patch 2: `e6afe1e7` (2026-10-05)
**Commit Message**: fix: cost changes for gpt-live and key selection (#7722)

## Summary

Adds first-class billing support for GPT Live voice sessions. A Live session uses one API key for both the voice model and a backend Responses model, so key selection, cost computation, and request accounting all need to understand that a Live billing window is not an ordinary request.

## Changes

- **Key selection**: `SelectKeyForProviderRequestType` now accepts variadic `additionalModels`. When provided, the candidate key pool is narrowed to keys whose allow/deny lists admit every model in the session (primary + additional). Direct keys bypass this check. A new `keySupportsModel` helper centralises the allow-list, deny-list, and vLLM `ModelName` check that was previously inlined in `selectKeyFromProviderForModelWithPool`.

- **Cost computation**: `computeLiveCost` bills voice duration as `seconds × input_cost_per_second` and folds the result into `InputCostDetails.AudioCost`. The flat `CostPerRequest` fee is explicitly skipped for `LiveRequest` because a billing window is not a request. `normalizeRequestType` maps `LiveRequest` → `"live"` so the pricing store can look up a `live`-mode pricing row.

- **Account

**File**: `core/bifrost.go` (modified, +30/-9)
```diff
@@ -4946,7 +4946,9 @@ func (bifrost *Bifrost) GetProviderByKey(providerKey schemas.ModelProvider) sche
 // SelectKeyForProviderRequestType selects an API key for the given provider, request type, and model.
 // Used by WebSocket handlers that need a key for upstream connections while honoring request-specific
 // AllowedRequests gates such as realtime-only support.
-func (bifrost *Bifrost) SelectKeyForProviderRequestType(ctx *schemas.BifrostContext, requestType schemas.RequestType, providerKey schemas.ModelProvider, model string) (schemas.Key, error) {
+// additionalModels narrows the pool to keys that also serve those models, for sessions where the
+// provider calls several models on one key (GPT Live's voice model and its Responses backend).
+func (bifrost *Bifrost) SelectKeyForProviderRequestType(ctx *schemas.BifrostContext, requestType schemas.RequestType, providerKey schemas.ModelProvider, model string, additionalModels ...string) (schemas.Key, error) {
 	if ctx == nil {
 		ctx = bifrost.ctx
 	}
@@ -4959,6 +4961,20 @@ func (bifrost *Bifrost) SelectKeyForProviderRequestType(ctx *schemas.BifrostCont
 	if err != nil {
 		return schemas.Key{}, err
 	}
+	// A caller-supplied direct key has no model lists to check.
+	if _, isDirectKey := ctx.Value(schemas.BifrostContextKeyDirectKey).(schemas.Key); !isDirectKey && len(supportedKeys) > 0 {
+		for _, additionalModel := range additionalModels {
+			if additionalModel == "" {
+				continue
+			}
+			supportedKeys = slices.DeleteFunc(supportedKeys, func(key schemas.Key) bool {
+				return !keySupportsModel(baseProvider, &key, additionalModel)
+			})
+			if len(supportedKeys) == 0 {
+				return schemas.Key{}, fmt.Errorf("no keys found for provider %s that support both model %s and model %s", providerKey, model, additionalModel)
+			}
+		}
+	}
 	if len(supportedKeys) == 0 {
 		return schemas.Key{}, nil
 	}
@@ -9908,14 +9924,8 @@ func (bifrost *Bifrost) selectKeyFromProviderForModelWithPool(ctx *schemas.Bifro
 			// NOTE: Model filtering uses the original requested model (which may be an alias).
 			// key.Models and key.BlacklistedModels must therefore be expressed in alias keys.
 			// The provider-specific identifier is resolved later in the handler closure via key.Aliases.Resolve(model).
-			// vLLM also resolves a per-key copy below because ModelName contains the identifier served by that key.
-			modelSupported := hasValue && key.Models.IsAllowed(model) && !key.BlacklistedModels.IsBlocked(model)
-			if baseProviderType == schemas.VLLM && key.VLLMKeyConfig != nil {
-				if key.VLLMKeyConfig.ModelName != "" {
-					modelSupported = modelSupported && (key.VLLMKeyConfig.ModelName == key.Aliases.Resolve(model))
-				}
-			}
-			if modelSupported {
+			// keySupportsModel also resolves a per-key copy for vLLM because ModelName contains the identifier served by that key.
+			if hasValue && keySupportsModel(baseProviderType, &key, model) {
 				supportedKeys = append(supportedKeys, key)
 			}
 		}
@@ -9972,6 +9982,17 @@ func (bifrost *Bifrost) selectKeyFromProviderForModelWithPool(ctx *schemas.Bifro
 	return supportedKeys, true, nil
 }
 
+// keySupportsModel reports whether a key's allow list, deny list and vLLM served model admit model.
+func keySupportsModel(baseProviderType schemas.ModelProvider, key *schemas.Key, model string) bool {
+	if !key.Models.IsAllowed(model) || key.BlacklistedModels.IsBlocked(model) {
+		return false
+	}
+	if baseProviderType == schemas.VLLM && key.VLLMKeyConfig != nil && key.VLLMKeyConfig.ModelName != "" {
+		return key.VLLMKeyConfig.ModelName == key.Aliases.Resolve(model)
+	}
+	return true
+}
+
 // Shutdown gracefully stops all workers when triggered.
 // It closes all request channels and waits for workers to exit.
 func (bifrost *Bifrost) Shutdown() {
```

**File**: `core/bifrost_test.go` (modified, +70/-0)
```diff
@@ -16,6 +16,7 @@ import (
 	"time"
 
 	"github.com/maximhq/bifrost/core/internal/memtest"
+	"github.com/maximhq/bifrost/core/keyselectors"
 	mistralprovider "github.com/maximhq/bifrost/core/providers/mistral"
 	schemas "github.com/maximhq/bifrost/core/schemas"
 	"golang.org/x/text/cases"
@@ -1540,6 +1541,75 @@ func TestSelectKeyFromProviderForModel_VLLMAliasResolution(t *testing.T) {
 	})
 }
 
+func TestSelectKeyForProviderRequestType_AdditionalModels(t *testing.T) {
+	account := NewMockAccount()
+	bifrost := &Bifrost{account: account, logger: NewDefaultLogger(schemas.LogLevelError), keySelector: keyselectors.WeightedRandom}
+	newKey := func(id string, models schemas.WhiteList, blacklisted schemas.BlackList) schemas.Key {
+		return schemas.Key{ID: id, Name: id, Value: *schemas.NewSecretVar("sk-" + id), Weight: 1, Models: models, BlacklistedModels: blacklisted}
+	}
+	voiceOnly := newKey("voice-only", schemas.WhiteList{"gpt-live-1"}, nil)
+	both := newKey("both", schemas.WhiteList{"gpt-live-1", "gpt-5.6-luna"}, nil)
+	backendOnly := newKey("backend-only", schemas.WhiteList{"gpt-5.6-luna"}, nil)
+	wildcardBlocked := newKey("wildcard-blocked", schemas.WhiteList{"*"}, schemas.BlackList{"gpt-5.6-luna"})
+
+	t.Run("selects only keys that serve every model", func(t *testing.T) {
+		account.SetKeysForProvider(schemas.OpenAI, []schemas.Key{voiceOnly, both, backendOnly, wildcardBlocked})
+		ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
+		for range 20 {
+			key, err := bifrost.SelectKeyForProviderRequestType(ctx, schemas.LiveRequest, schemas.OpenAI, "gpt-live-1", "gpt-5.6-luna")
+			if err != nil {
+				t.Fatalf("SelectKeyForProviderRequestType: %v", err)
+			}
+			if key.ID != "both" {
+				t.Fatalf("selected %q, want both", key.ID)
+			}
+		}
+	})
+
+	t.Run("errors when no key serves every model", func(t *testing.T) {
+		account.SetKeysForProvider(schemas.OpenAI, []schemas.Key{voiceOnly, backendOnly, wildcardBlocked})
+		ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
+		_, err := bifrost.SelectKeyForProviderRequestType(ctx, schemas.LiveRequest, schemas.OpenAI, "gpt-live-1", "gpt-5.6-luna")
+		if err == nil || !strings.Contains(err.Error(), "gpt-live-1") || !strings.Contains(err.Error(), "gpt-5.6-luna") {
+			t.Fatalf("err = %v, want an error naming both models", err)
+		}
+	})
+
+	t.Run("pinned key must serve every model", func(t *testing.T) {
+		account.SetKeysForProvider(schemas.OpenAI, []schemas.Key{voiceOnly, both})
+		ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
+		ctx.SetValue(schemas.BifrostContextKeyAPIKeyName, "both")
+		if key, err := bifrost.SelectKeyForProviderRequestType(ctx, schemas.LiveRequest, schemas.OpenAI, "gpt-live-1", "gpt-5.6-luna"); err != nil || key.ID != "both" {
+			t.Fatalf("pinned both: key=%q err=%v", key.ID, err)
+		}
+		ctx.SetValue(schemas.BifrostContextKeyAPIKeyName, "voice-only")
+		if key, err := bifrost.SelectKeyForProviderRequestType(ctx, schemas.LiveRequest, schemas.OpenAI, "gpt-live-1", "gpt-5.6-luna"); err == nil {
+			t.Fatalf("pinned voice-only: selected %q, want error", key.ID)
+		}
+	})
+
+	t.Run("empty additional model and no additional models keep single-model selection", func(t *testing.T) {
+		account.SetKeysForProvider(schemas.OpenAI, []schemas.Key{voiceOnly})
+		ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
+		for _, extra := range [][]string{nil, {""}} {
+			key, err := bifrost.SelectKeyForProviderRequestType(ctx, schemas.LiveRequest, schemas.OpenAI, "gpt-live-1", extra...)
+			if err != nil || key.ID != "voice-only" {
+				t.Fatalf("additional=%v: key=%q err=%v", extra, key.ID, err)
+			}
+		}
+	})
+
+	t.Run("direct key bypasses model lists", func(t *testing.T) {
+		account.SetKeysForProvider(schemas.OpenAI, []schemas.Key{voiceOnly})
+		ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
+		ctx.SetValue(schemas.BifrostContextKeyDirectKey, schemas.Key{ID: "direct", Value: *schemas.NewSecretVar("sk-direct")})
+		key, err := bifrost.SelectKeyForProviderRequestType(ctx, schemas.LiveRequest, schemas.OpenAI, "gpt-live-1", "gpt-5.6-luna")
+		if err != nil || key.ID != "direct" {
+			t.Fatalf("key=%q err=%v, want direct", key.ID, err)
+		}
+	})
+}
+
 // Test key rotation in executeRequestWithRetries on rate-limit errors
 func TestExecuteRequestWithRetries_KeyRotation(t *testing.T) {
 	config := createTestConfig(3, 0, 0)
```

**File**: `framework/modelcatalog/datasheet/cost.go` (modified, +14/-2)
```diff
@@ -649,6 +649,8 @@ func (s *Store) computeCostFromInput(input costInput, routingInfo schemas.Routin
 		cost = computeOCRCost(pricing, input.ocrProcessedPages, input.ocrIsAnnotated)
 	case schemas.ContainerCreateRequest:
 		cost = computeContainerCreationCost(pricing)
+	case schemas.LiveRequest:
+		cost = computeLiveCost(pricing, input.audioSeconds)
 	default:
 		return nil
 	}
@@ -666,8 +668,8 @@ func (s *Store) computeCostFromInput(input costInput, routingInfo schemas.Routin
 	// the resolved pricing row carries one. It maps to no token category, so it
 	// folds into the input side (InputCostDetails.RequestCost) and the total.
 	// Deliberately added after the off-peak scaling: a flat per-request fee is
-	// not a usage charge and is not discounted.
-	if pricing.CostPerRequest != nil {
+	// not a usage charge and is not discounted. A live billing window is not a request.
+	if pricing.CostPerRequest != nil && requestType != schemas.LiveRequest {
 		if cost == nil {
 			cost = &schemas.BifrostCost{}
 		}
@@ -1709,6 +1711,16 @@ func videoResolutionBand(size string) int {
 	return min(width, height)
 }
 
+// computeLiveCost bills GPT Live voice duration: session seconds × input_cost_per_second.
+// Backend model tokens are priced separately as Responses usage.
+func computeLiveCost(pricing *configstoreTables.TableModelPricing, seconds *float64) *schemas.BifrostCost {
+	if seconds == nil || *seconds <= 0 || pricing.InputCostPerSecond == nil {
+		return nil
+	}
+	cost := *seconds * *pricing.InputCostPerSecond
+	return newInputOutputCostWithDetails(cost, 0, &schemas.InputCostDetails{AudioCost: cost}, nil)
+}
+
 // computeOCRCost handles OCR requests, billing per page processed.
 // ocr_cost_per_page covers base processing; annotation_cost_per_page is added when set.
 func computeOCRCost(pricing *configstoreTables.TableModelPricing, ocrProcessedPages *int, ocrIsAnnotated *bool) *schemas.BifrostCost {
```

**File**: `framework/modelcatalog/datasheet/cost_test.go` (modified, +74/-0)
```diff
@@ -189,6 +189,80 @@ func TestCalculateCost_RealtimeTranscriptionMissingPricingIsNonFatal(t *testing.
 	assert.Nil(t, s.CalculateCostBreakdown(resp, nil))
 }
 
+// liveVoiceWindow is the synthetic response the Live handler bills per voice window.
+func liveVoiceWindow(model string, seconds float64) *schemas.BifrostResponse {
+	return &schemas.BifrostResponse{
+		ResponsesResponse: &schemas.BifrostResponsesResponse{
+			Usage: &schemas.ResponsesResponseUsage{AudioSeconds: &seconds},
+			ExtraFields: schemas.BifrostResponseExtraFields{
+				RequestType: schemas.LiveRequest,
+				RoutingInfo: routingInfoFor(schemas.OpenAI, model),
+			},
+		},
+	}
+}
+
+func TestCalculateCost_LiveVoiceDuration(t *testing.T) {
+	pricing := configstoreTables.TableModelPricing{
+		Model:              "gpt-live-1",
+		Provider:           "openai",
+		Mode:               "live",
+		InputCostPerSecond: new(0.05 / 60),
+		CostPerRequest:     new(0.01),
+	}
+	s := testStoreWithPricing(map[string]configstoreTables.TableModelPricing{
+		makeKey(pricing.Model, pricing.Provider, pricing.Mode): pricing,
+	})
+
+	// 37s is the final usage of a recorded live session: 37 × $0.05/min.
+	breakdown := s.CalculateCostBreakdown(liveVoiceWindow("gpt-live-1", 37), nil)
+	require.NotNil(t, breakdown)
+	assert.InDelta(t, 0.0308333333, breakdown.TotalCost, 1e-9)
+	require.NotNil(t, breakdown.InputCostDetails)
+	assert.InDelta(t, breakdown.TotalCost, breakdown.InputCostDetails.AudioCost, 1e-12)
+	// A billing window is not a request, so the flat per-request fee is not added.
+	assert.Zero(t, breakdown.InputCostDetails.RequestCost)
+	assert.Zero(t, breakdown.OutputCost)
+}
+
+func TestCalculateCost_LiveDoesNotFallBackToTokenPricing(t *testing.T) {
+	s := testStoreWithPricing(map[string]configstoreTables.TableModelPricing{
+		makeKey("gpt-live-1", "openai", "responses"): {
+			Model: "gpt-live-1", Provider: "openai", Mode: "responses",
+			InputCostPerToken:  new(0.000005),
+			InputCostPerSecond: new(1.0),
+		},
+	})
+
+	assert.Nil(t, s.CalculateCostBreakdown(liveVoiceWindow("gpt-live-1", 30), nil))
+}
+
+func TestCalculateCost_LiveMissingPricingIsZero(t *testing.T) {
+	s := testStoreWithPricing(nil)
+	assert.Nil(t, s.CalculateCostBreakdown(liveVoiceWindow("gpt-live-1", 30), nil))
+
+	noRate := testStoreWithPricing(map[string]configstoreTables.TableModelPricing{
+		makeKey("gpt-live-1", "openai", "live"): {Model: "gpt-live-1", Provider: "openai", Mode: "live"},
+	})
+	assert.Nil(t, noRate.CalculateCostBreakdown(liveVoiceWindow("gpt-live-1", 30), nil))
+}
+
+func TestCalculateCost_LiveOverrideOnlyPricing(t *testing.T) {
+	s := testStoreWithPricing(nil)
+	require.NoError(t, s.SetOverrides([]configstoreTables.TablePricingOverride{
+		{
+			ID:               "live-override",
+			ScopeKind:        string(ScopeKindGlobal),
+			MatchType:        string(MatchTypeExact),
+			Pattern:          "gpt-live-1",
+			RequestTypes:     []schemas.RequestType{schemas.LiveRequest},
+			PricingPatchJSON: `{"input_cost_per_second":0.001}`,
+		},
+	}))
+
+	assert.InDelta(t, 0.03, s.CalculateCost(liveVoiceWindow("gpt-live-1", 30), nil), 1e-12)
+}
+
 // chatPricing returns a TableModelPricing with the given per-token rates.
 func chatPricing(input, output float64) configstoreTables.TableModelPricing {
 	return configstoreTables.TableModelPricing{
```

**File**: `framework/modelcatalog/datasheet/types.go` (modified, +2/-0)
```diff
@@ -473,6 +473,8 @@ func normalizeRequestType(reqType schemas.RequestType) string {
 		return "ocr"
 	case schemas.ContainerCreateRequest:
 		return "container_create"
+	case schemas.LiveRequest:
+		return "live"
 	}
 	return "unknown"
 }
```

**File**: `plugins/governance/accounting_test.go` (modified, +42/-0)
```diff
@@ -626,3 +626,45 @@ func TestAccounting_RequestsThatSpendNothingAreNotCharged(t *testing.T) {
 		})
 	}
 }
+
+// TestAccounting_SkipRequestCountChargesCostOnly: a GPT Live voice window bills its
+// cost and tokens but is not a request, so it must not consume request allowance.
+func TestAccounting_SkipRequestCountChargesCostOnly(t *testing.T) {
+	f := newAccountingFixture(t)
+
+	window := acctUpdate("live-window-1", 0, true, 0.025, 0)
+	window.SkipRequestCount = true
+	f.apply(window, acctUpdate("req-1", 0, true, 1.0, 10))
+
+	assert.InDelta(t, 1.025, f.cost(), 1e-9)
+	assert.Equal(t, int64(1), f.requests(), "only the ordinary request counts")
+	assert.Equal(t, int64(10), f.tokens())
+}
+
+// TestPostHookWorker_LiveRequestDoesNotCountRequest pins the wiring: the live request
+// type is what marks an update as not counting toward request limits.
+func TestPostHookWorker_LiveRequestDoesNotCountRequest(t *testing.T) {
+	for _, tc := range []struct {
+		requestType  schemas.RequestType
+		wantRequests int64
+	}{
+		{schemas.LiveRequest, 0},
+		{schemas.ResponsesRequest, 1},
+	} {
+		t.Run(string(tc.requestType), func(t *testing.T) {
+			f := newAccountingFixture(t)
+			plugin := &GovernancePlugin{ctx: context.Background(), tracker: f.tracker}
+			result := &schemas.BifrostResponse{ResponsesResponse: &schemas.BifrostResponsesResponse{
+				Usage: &schemas.ResponsesResponseUsage{InputTokens: 7, OutputTokens: 3, TotalTokens: 10},
+			}}
+
+			settled := settleLimits(f.store, "sk-bf-acct", schemas.OpenAI, "gpt-live-1", &UsageUpdate{})
+			plugin.postHookWorker(result, nil, schemas.OpenAI, "gpt-live-1", tc.requestType, "req-"+string(tc.requestType), "", false, 0, nil, settled.Budgets, settled.RateLimits, nil)
+
+			assert.EventuallyWithT(t, func(c *assert.CollectT) {
+				assert.Equal(c, int64(10), f.tokens())
+			}, time.Second, 10*time.Millisecond)
+			assert.Equal(t, tc.wantRequests, f.requests())
+		})
+	}
+}
```

**File**: `plugins/governance/main.go` (modified, +13/-12)
```diff
@@ -1700,18 +1700,19 @@ func (p *GovernancePlugin) postHookWorker(result *schemas.BifrostResponse, bifro
 
 		// Create usage update for tracker (business logic)
 		usageUpdate := &UsageUpdate{
-			Success:       success,
-			TokensUsed:    int64(tokensUsed),
-			Cost:          cost,
-			RequestID:     requestID,
-			BillingNonce:  billingNonce,
-			IsStreaming:   isStreaming,
-			IsFinalChunk:  isFinalChunk,
-			HasUsageData:  tokensUsed > 0 || cost > 0,
-			AttemptNumber: attemptNumber,
-			BilledReason:  billedReason,
-			Budgets:       budgets,
-			RateLimits:    rateLimits,
+			Success:          success,
+			TokensUsed:       int64(tokensUsed),
+			Cost:             cost,
+			RequestID:        requestID,
+			BillingNonce:     billingNonce,
+			SkipRequestCount: requestType == schemas.LiveRequest, // a voice billing window is not a request
+			IsStreaming:      isStreaming,
+			IsFinalChunk:     isFinalChunk,
+			HasUsageData:     tokensUsed > 0 || cost > 0,
+			AttemptNumber:    attemptNumber,
+			BilledReason:     billedReason,
+			Budgets:          budgets,
+			RateLimits:       rateLimits,
 		}
 
 		// Queue usage update asynchronously using tracker
```

**File**: `plugins/governance/tracker.go` (modified, +4/-1)
```diff
@@ -35,6 +35,9 @@ type UsageUpdate struct {
 	Budgets    []schemas.Limit `json:"-"`
 	RateLimits []schemas.Limit `json:"-"`
 
+	// SkipRequestCount charges cost and tokens without counting a request (GPT Live billing windows).
+	SkipRequestCount bool `json:"skip_request_count,omitempty"`
+
 	// Streaming optimization fields
 	IsStreaming  bool `json:"is_streaming"`   // Whether this is a streaming response
 	IsFinalChunk bool `json:"is_final_chunk"` // Whether this is the final chunk
@@ -146,7 +149,7 @@ func (t *UsageTracker) UpdateUsage(ctx context.Context, update *UsageUpdate) {
 	// request adds cost+tokens but must not inflate success/rate-limit request
 	// counts.
 	shouldUpdateTokens := !update.IsStreaming || (update.IsStreaming && update.HasUsageData)
-	shouldUpdateRequests := update.Success && (!update.IsStreaming || (update.IsStreaming && update.IsFinalChunk))
+	shouldUpdateRequests := update.Success && !update.SkipRequestCount && (!update.IsStreaming || (update.IsStreaming && update.IsFinalChunk))
 	shouldUpdateBudget := !update.IsStreaming || (update.IsStreaming && update.HasUsageData)
 
 	// Everything this request answers to was resolved when its provider and model were settled, and
```

---

### Incident Patch 3: `cea41c5b` (2026-10-05)
**Commit Message**: fix: race condition when LLM span is dropped in telemetry (#7731)

## Summary

When a caller disconnects mid-flight (HTTP 499), the worker that won the handoff continues writing response attributes — cost, model, token counts — onto the trace span. Previously, the HTTP transport flushed and recycled the trace at handler return, before the worker finished, causing every abandoned request to export an incomplete trace missing those attributes. In the worst case, a concurrent `ReleaseTrace` could nil out `span.LLM` while `PopulateLLMResponseAttributes` was still dereferencing it, causing a segfault.

## Changes

- **`abandonDelivery` now calls `DeferTraceCompletion`** on the CAS success path, marking the trace as still owned by a worker so the transport skips flushing it.
- **`billAbandonedTerminal` calls `completeAbandonedTrace`** after all writers finish, ending the root span with a "client disconnected" status, clearing the deferral marker, and flushing to all connectors.
- **The HTTP tracing middleware checks `IsTraceCompletionDeferred`** before flushing, so a deferred trace is never exported at handler return regardless of how the deferral was set.
- **`Tracer` gains `DeferTraceC

**File**: `core/abandonedstream_test.go` (modified, +28/-3)
```diff
@@ -139,7 +139,7 @@ func (c *terminalHookCounter) PostLLMHook(_ *schemas.BifrostContext, resp *schem
 // both a ready send (cap-1 channel, drained on acquire) and a ready ctx.Done(); Go
 // picks uniformly among ready cases, so n iterations expose that with probability
 // 1 - 2^-n.
-func runAbandonedRequests(t *testing.T, n int, fail bool) *terminalHookCounter {
+func runAbandonedRequests(t *testing.T, n int, fail bool, tracerOverride ...schemas.Tracer) *terminalHookCounter {
 	t.Helper()
 
 	counter := &terminalHookCounter{}
@@ -181,7 +181,13 @@ func runAbandonedRequests(t *testing.T, n int, fail bool) *terminalHookCounter {
 	for i := 0; i < n; i++ {
 		ctx, cancel := schemas.NewBifrostContextWithCancel(context.Background())
 		// tryRequest stamps the tracer before enqueue; the retry loop refuses a context without one.
-		ctx.SetValue(schemas.BifrostContextKeyTracer, client.getTracer())
+		tracer := client.getTracer()
+		if len(tracerOverride) > 0 && tracerOverride[0] != nil {
+			tracer = tracerOverride[0]
+		}
+		ctx.SetValue(schemas.BifrostContextKeyTracer, tracer)
+		// A real request always carries one, and trace completion needs it.
+		ctx.SetValue(schemas.BifrostContextKeyTraceID, tracer.CreateTrace(""))
 		msg := client.getChannelMessage(schemas.BifrostRequest{
 			RequestType: schemas.ChatCompletionRequest,
 			ChatRequest: &schemas.BifrostChatRequest{
@@ -381,7 +387,7 @@ func runClaimedDeliveriesWithDeadCaller(t *testing.T, n int, fail bool) {
 		case <-time.After(5 * time.Second):
 			t.Fatalf("iteration %d: worker never reached the provider", i)
 		}
-		cancel()                      // the caller's context ends...
+		cancel()                       // the caller's context ends...
 		upstream.release <- struct{}{} // ...and the upstream completes at that same instant
 
 		// The caller has NOT abandoned: this models tryRequest losing the CAS race.
@@ -538,3 +544,22 @@ func TestRequestWorkerBillsAbandonedKeySelectionError(t *testing.T) {
 		}
 	}
 }
+
+// A caller that disconnects leaves its worker still writing the response attributes and
+// plugin logs, so the transport defers completion and the worker must complete the trace
+// itself. Without this every abandoned request exports a trace missing its cost and model.
+func TestRequestWorkerCompletesEveryAbandonedTrace(t *testing.T) {
+	const n = 64
+	tracer := newRecordingTracer()
+	runAbandonedRequests(t, n, false, tracer)
+
+	if got := tracer.deferred.Load(); got != n {
+		t.Errorf("completion deferred for %d of %d abandoned requests; the transport would flush an incomplete trace for the rest", got, n)
+	}
+	if got := tracer.completed.Load(); got != n {
+		t.Errorf("worker completed %d of %d abandoned traces; the rest are never exported", got, n)
+	}
+	if got := tracer.cleared.Load(); got != n {
+		t.Errorf("deferral marker cleared %d of %d times; leftovers would strand later traces", got, n)
+	}
+}
```

**File**: `core/bifrost.go` (modified, +29/-1)
```diff
@@ -98,7 +98,17 @@ func (m *ChannelMessage) claimDelivery() bool {
 // about to enter) the buffer and the caller must receive it, since no one else
 // will. After a successful abandon the caller must not touch the message again.
 func (m *ChannelMessage) abandonDelivery() bool {
-	return m.handoff.CompareAndSwap(handoffOpen, handoffAbandoned)
+	if !m.handoff.CompareAndSwap(handoffOpen, handoffAbandoned) {
+		return false
+	}
+	// The worker still writes response attributes and plugin logs, so the transport
+	// must not flush the trace yet. Set on the CAS so every abandonment marks it.
+	if m.Context != nil {
+		if tracer, traceID, err := GetTracerFromContext(m.Context); err == nil {
+			tracer.DeferTraceCompletion(traceID)
+		}
+	}
+	return true
 }
 
 // Bifrost manages providers and maintains specified open channels for concurrent processing.
@@ -7966,6 +7976,24 @@ func (bifrost *Bifrost) billAbandonedTerminal(req *ChannelMessage, result *schem
 		_, _ = pipeline.RunPostLLMHooks(req.Context, result, nil, pluginCount)
 	}
 	drainAndAttachPluginLogs(req.Context)
+	// Every writer has finished, so complete the trace here: one snapshot, all connectors.
+	bifrost.completeAbandonedTrace(req.Context)
+}
+
+// Ends the root span and flushes a trace whose completion the transport skipped,
+// mirroring the streaming trace completer.
+func (bifrost *Bifrost) completeAbandonedTrace(ctx *schemas.BifrostContext) {
+	tracer, traceID, err := GetTracerFromContext(ctx)
+	if err != nil || tracer == nil {
+		return
+	}
+	// Completing before the transport attaches its plugin logs would drop them.
+	tracer.AwaitTransportHandoff(traceID)
+	if rootHandle := tracer.GetSpanHandleByID(traceID, nil); rootHandle != nil {
+		tracer.EndSpan(rootHandle, schemas.SpanStatusError, "client disconnected before response")
+	}
+	tracer.ClearTraceCompletionDeferral(traceID)
+	tracer.CompleteAndFlushTrace(traceID)
 }
 
 // drainAbandonedStream consumes a stream that will never reach the caller, so
```

**File**: `core/listallmodels_test.go` (modified, +4/-0)
```diff
@@ -160,6 +160,10 @@ func (c *staticListerCatalog) CalculateRequestCost(ctx *schemas.BifrostContext,
 	return 0
 }
 
+func (c *staticListerCatalog) CalculateRequestCostBreakdown(ctx *schemas.BifrostContext, resp *schemas.BifrostResponse) *schemas.BifrostCost {
+	return nil
+}
+
 func (c *staticListerCatalog) GetModelsForProvider(provider schemas.ModelProvider) []string {
 	return c.modelsByProvider[provider]
 }
```

**File**: `core/overhead_e2e_test.go` (modified, +10/-0)
```diff
@@ -6,6 +6,7 @@ import (
 	"net/http"
 	"net/http/httptest"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
@@ -28,6 +29,11 @@ type recordingTracer struct {
 	*schemas.NoOpTracer
 	mu    sync.Mutex
 	attrs map[string]any
+
+	// Trace-lifecycle counters, used by the abandoned-request tests.
+	deferred  atomic.Int64
+	cleared   atomic.Int64
+	completed atomic.Int64
 }
 
 func newRecordingTracer() *recordingTracer {
@@ -44,6 +50,10 @@ func (r *recordingTracer) GetSpanHandleByID(_ string, _ *string) schemas.SpanHan
 	return "root-span"
 }
 
+func (r *recordingTracer) DeferTraceCompletion(_ string)         { r.deferred.Add(1) }
+func (r *recordingTracer) ClearTraceCompletionDeferral(_ string) { r.cleared.Add(1) }
+func (r *recordingTracer) CompleteAndFlushTrace(_ string)        { r.completed.Add(1) }
+
 func (r *recordingTracer) SetAttribute(_ schemas.SpanHandle, key string, value any) {
 	r.mu.Lock()
 	defer r.mu.Unlock()
```

**File**: `core/schemas/spanenrichment.go` (modified, +3/-0)
```diff
@@ -109,6 +109,9 @@ func (s *Span) EnsureEnrichment() *SpanEnrichment {
 	if s == nil {
 		return nil
 	}
+	// Under the lock: Reset nils Enrichment on pool release, which races this.
+	s.mu.Lock()
+	defer s.mu.Unlock()
 	if s.Enrichment == nil {
 		s.Enrichment = &SpanEnrichment{}
 	}
```

**File**: `core/schemas/trace.go` (modified, +36/-0)
```diff
@@ -738,6 +738,23 @@ func (s *Span) End(status SpanStatus, statusMsg string) {
 // check and the caller falls back to the by-ID store lookup instead of mutating a
 // recycled span. The check rides inside the lock End already takes, so it adds no
 // extra locking.
+// EndIfOpen ends a span only if it has not ended, leaving finished spans untouched.
+// Used when a trace expires: an open span would otherwise export with a zero EndTime.
+func (s *Span) EndIfOpen(at time.Time, status SpanStatus, statusMsg string) bool {
+	if s == nil {
+		return false
+	}
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	if !s.EndTime.IsZero() {
+		return false
+	}
+	s.EndTime = at
+	s.Status = status
+	s.StatusMsg = statusMsg
+	return true
+}
+
 func (s *Span) EndIfMatch(id string, status SpanStatus, statusMsg string) bool {
 	if s == nil {
 		return false
@@ -772,6 +789,25 @@ func (s *Span) SetAttributeIfMatch(id, key string, value any) bool {
 	return true
 }
 
+// EnsureLLMIfMatch returns the span's LLM payload, creating it when absent, but only
+// while the SpanID still equals id. Returns nil once the span has been recycled.
+// Callers must hold the returned pointer rather than re-reading span.LLM: Reset nils
+// the field, so a later deref would panic.
+func (s *Span) EnsureLLMIfMatch(id string) *LLMSpanData {
+	if s == nil {
+		return nil
+	}
+	s.mu.Lock()
+	defer s.mu.Unlock()
+	if s.SpanID != id {
+		return nil
+	}
+	if s.LLM == nil {
+		s.LLM = &LLMSpanData{}
+	}
+	return s.LLM
+}
+
 // MatchesID reports whether the span's SpanID still equals id, read under the span
 // lock so it does not race a concurrent Reset. Used by the tracer to decide whether
 // a cached span pointer is still the one the handle refers to before returning it.
```

**File**: `core/schemas/tracer.go` (modified, +17/-0)
```diff
@@ -93,6 +93,14 @@ type Tracer interface {
 	// This includes output messages, tokens, usage stats, and error information if present.
 	PopulateLLMResponseAttributes(ctx *BifrostContext, handle SpanHandle, resp *BifrostResponse, err *BifrostError)
 
+	// DeferTraceCompletion marks a trace as still being written by a worker, so the
+	// transport skips completing it.
+	DeferTraceCompletion(traceID string)
+	// ClearTraceCompletionDeferral drops the marker once the worker has completed it.
+	ClearTraceCompletionDeferral(traceID string)
+	// AwaitTransportHandoff blocks until the transport has attached its own logs.
+	AwaitTransportHandoff(traceID string)
+
 	// StoreDeferredSpan stores a span handle for later completion (used for streaming requests).
 	// The span handle is stored keyed by trace ID so it can be retrieved when the stream completes.
 	StoreDeferredSpan(traceID string, handle SpanHandle)
@@ -244,6 +252,15 @@ func (n *NoOpTracer) PopulateLLMResponseAttributes(_ *BifrostContext, _ SpanHand
 // StoreDeferredSpan does nothing.
 func (n *NoOpTracer) StoreDeferredSpan(_ string, _ SpanHandle) {}
 
+// DeferTraceCompletion is a no-op.
+func (n *NoOpTracer) DeferTraceCompletion(_ string) {}
+
+// ClearTraceCompletionDeferral is a no-op.
+func (n *NoOpTracer) ClearTraceCompletionDeferral(_ string) {}
+
+// AwaitTransportHandoff is a no-op.
+func (n *NoOpTracer) AwaitTransportHandoff(_ string) {}
+
 // GetDeferredSpanHandle returns nil.
 func (n *NoOpTracer) GetDeferredSpanHandle(_ string) SpanHandle { return nil }
 
```

**File**: `framework/tracing/spanhandle_recycle_test.go` (modified, +54/-0)
```diff
@@ -2,6 +2,7 @@ package tracing
 
 import (
 	"context"
+	"sync"
 	"testing"
 	"time"
 
@@ -121,3 +122,56 @@ func TestSpanHandle_UseAfterTTLCleanupIsSafe(t *testing.T) {
 		t.Error("handle to a swept trace should resolve to nil")
 	}
 }
+
+// A late response racing ReleaseTrace used to segfault: PopulateLLMResponseAttributes
+// nil-guarded span.LLM on entry but dereferenced it again ~40 lines later, while
+// Span.Reset nils it on pool release. Regression test for that crash.
+// Run without -race: the trace-level recycling races (Trace.RootSpan, GetSpan vs
+// Span.Reset) predate this and are still open.
+func TestPopulateLLMResponseAttributes_RacesReleaseTrace(t *testing.T) {
+	for i := 0; i < 200; i++ {
+		store := NewTraceStore(time.Hour, nil)
+		tracer := NewTracer(store, nil, nil)
+
+		traceID, ctx := newHandleTestCtx(tracer)
+		bfCtx := schemas.NewBifrostContext(ctx, time.Now())
+		_, handle := tracer.StartSpanID(ctx, "llm", schemas.SpanKindLLMCall)
+		if span := tracer.SpanFromHandle(handle); span != nil {
+			span.LLM = &schemas.LLMSpanData{RequestType: schemas.ChatCompletionRequest}
+		}
+
+		var wg sync.WaitGroup
+		wg.Add(2)
+		go func() {
+			defer wg.Done()
+			tracer.PopulateLLMResponseAttributes(bfCtx, handle, nil, nil)
+		}()
+		go func() {
+			defer wg.Done()
+			if tr := store.CompleteTrace(traceID); tr != nil {
+				tracer.ReleaseTrace(tr)
+			}
+		}()
+		wg.Wait()
+	}
+}
+
+// EnsureLLMIfMatch must refuse a recycled span rather than hand back a payload that
+// belongs to whichever trace reused it.
+func TestEnsureLLMIfMatchRejectsRecycledSpan(t *testing.T) {
+	s := &schemas.Span{SpanID: "abc"}
+	if llm := s.EnsureLLMIfMatch("abc"); llm == nil {
+		t.Fatal("EnsureLLMIfMatch should create the payload for the current owner")
+	}
+	s.Reset() // pool release
+	if llm := s.EnsureLLMIfMatch("abc"); llm != nil {
+		t.Error("stale handle got a payload from a reset span")
+	}
+	s.SpanID = "xyz" // reused by another trace
+	if llm := s.EnsureLLMIfMatch("abc"); llm != nil {
+		t.Error("stale handle got a payload from a reused span")
+	}
+	if llm := s.EnsureLLMIfMatch("xyz"); llm == nil {
+		t.Error("current owner was refused")
+	}
+}
```

---

### Incident Patch 4: `75877726` (2026-10-05)
**Commit Message**: fix: output tokens on fallback and adaptive thinking (#7732)

## Summary

When a routing rule or fallback retargets a request sized for a large model (e.g. Claude Opus with 128K `max_tokens` and `adaptive` thinking) onto a smaller one (e.g. Haiku 4.5), Anthropic returns a 400 for two reasons: `max_tokens` exceeds the target model's output ceiling, and `adaptive` thinking is not supported on pre-adaptive models. This PR fixes both failure modes so retargeted requests reach the model cleanly.

## Changes

- **`max_tokens` clamping**: Added `clampToModelOutputCeiling` which lowers `max_tokens` to the model's datasheet ceiling when one is present, unless the `output-300k` beta header is active. Applied on both the typed (`ToAnthropicChatRequest`, `ToAnthropicResponsesRequest`) and raw-body (`BuildAnthropicChatRequestBody`, `BuildAnthropicResponsesRequestBody`) builder paths.

- **Adaptive → extended thinking rewrite for pre-adaptive models**: Haiku 4.5, Sonnet 4.5, and Opus 4.5 predate adaptive thinking and reject it with a 400. Both `stripUnsupportedAnthropicFields` (typed) and `StripUnsupportedFieldsFromRawBody` (raw) now detect this case and rewrite `thinking.type:"adaptive"` to `ty

**File**: `core/providers/anthropic/adaptivethinkingstrip_test.go` (modified, +244/-4)
```diff
@@ -179,12 +179,12 @@ func TestAdaptiveOnlyThinkingStrip(t *testing.T) {
 		}
 	})
 
-	// Legacy models are untouched: on Opus 4.5 / Haiku 4.5 / Sonnet 4.5 "adaptive"
-	// itself is rejected, and on Opus 4.6 / Sonnet 4.6 both modes are accepted and
-	// budget_tokens still works. Either way the sanitizer must not rewrite them.
+	// Legacy models keep the caller's budget: on Opus 4.6 / Sonnet 4.6 both modes
+	// are accepted and budget_tokens still works, and on Opus 4.5 / Haiku 4.5 /
+	// Sonnet 4.5 the adaptive -> enabled rewrite keeps it as the thinking budget.
 	t.Run("raw_body_preserves_budget_tokens_on_legacy_models", func(t *testing.T) {
 		for _, model := range legacyOK {
-			body := []byte(`{"model":"` + model + `","max_tokens":4096,"thinking":{"type":"adaptive","budget_tokens":10000}}`)
+			body := []byte(`{"model":"` + model + `","max_tokens":16000,"thinking":{"type":"adaptive","budget_tokens":10000}}`)
 
 			result, err := StripUnsupportedFieldsFromRawBody(body, schemas.Anthropic, model)
 			if err != nil {
@@ -199,6 +199,246 @@ func TestAdaptiveOnlyThinkingStrip(t *testing.T) {
 	})
 }
 
+// Haiku 4.5, Sonnet 4.5 and Opus 4.5 predate adaptive thinking and reject it with
+// "adaptive thinking is not supported on this model". A Claude Code body sized for
+// an adaptive model reaches them when a routing rule or fallback retargets it, so
+// the sanitizers turn it into extended thinking: the caller's budget_tokens if
+// sent, else a budget from output_config.effort (default "high", as the converted
+// path) over max_tokens. Budgets must be >= 1024 and < max_tokens, so a max_tokens
+// with no room for one drops thinking instead.
+func TestAdaptiveThinkingOnPreAdaptiveModels(t *testing.T) {
+	preAdaptive := []string{
+		"claude-haiku-4-5",
+		"claude-haiku-4-5-20251001",
+		"claude-sonnet-4-5",
+		"claude-opus-4-5",
+	}
+	adaptiveCapable := []string{
+		"claude-opus-4-6",
+		"claude-sonnet-4-6",
+		"claude-opus-4-7",
+	}
+	// Budgets over max_tokens 64000: 1024 + int(ratio * 62976).
+	const highBudget, lowBudget = 51404, 10470
+
+	t.Run("raw_body_rewrites_adaptive_to_budget", func(t *testing.T) {
+		for _, model := range preAdaptive {
+			body := []byte(`{"model":"` + model + `","max_tokens":64000,"thinking":{"type":"adaptive","display":"summarized"}}`)
+			result, err := StripUnsupportedFieldsFromRawBody(body, schemas.Anthropic, model)
+			if err != nil {
+				t.Fatalf("%s: unexpected error: %v", model, err)
+			}
+			if got := providerUtils.GetJSONField(result, "thinking.type").String(); got != "enabled" {
+				t.Errorf("%s: thinking.type = %q, want \"enabled\"; body: %s", model, got, result)
+			}
+			if got := providerUtils.GetJSONField(result, "thinking.budget_tokens").Int(); got != highBudget {
+				t.Errorf("%s: budget_tokens = %d, want %d; body: %s", model, got, highBudget, result)
+			}
+			if got := providerUtils.GetJSONField(result, "thinking.display").String(); got != "summarized" {
+				t.Errorf("%s: thinking.display = %q, want \"summarized\" kept; body: %s", model, got, result)
+			}
+		}
+	})
+
+	t.Run("raw_body_budget_follows_effort", func(t *testing.T) {
+		// Opus 4.5 takes effort alongside a budget; Haiku 4.5 has no effort parameter.
+		for model, keepsEffort := range map[string]bool{"claude-opus-4-5": true, "claude-haiku-4-5": false} {
+			body := []byte(`{"model":"` + model + `","max_tokens":64000,"thinking":{"type":"adaptive"},"output_config":{"effort":"low"}}`)
+			result, err := StripUnsupportedFieldsFromRawBody(body, schemas.Anthropic, model)
+			if err != nil {
+				t.Fatalf("%s: unexpected error: %v", model, err)
+			}
+			if got := providerUtils.GetJSONField(result, "thinking.budget_tokens").Int(); got != lowBudget {
+				t.Errorf("%s: budget_tokens = %d, want %d; body: %s", model, got, lowBudget, result)
+			}
+			if got := providerUtils.JSONFieldExists(result, "output_config.effort"); got != keepsEffort {
+				t.Errorf("%s: output_config.effort present = %v, want %v; body: %s", model, got, keepsEffort, result)
+			}
+		}
+	})
+
+	t.Run("raw_body_keeps_caller_budget", func(t *testing.T) {
+		body := []byte(`{"model":"claude-haiku-4-5","max_tokens":64000,"thinking":{"type":"adaptive","budget_tokens":10000}}`)
+		result, err := StripUnsupportedFieldsFromRawBody(body, schemas.Anthropic, "claude-haiku-4-5")
+		if err != nil {
+			t.Fatalf("unexpected error: %v", err)
+		}
+		if got := providerUtils.GetJSONField(result, "thinking.type").String(); got != "enabled" {
+			t.Errorf("thinking.type = %q, want \"enabled\"; body: %s", got, result)
+		}
+		if got := providerUtils.GetJSONField(result, "thinking.budget_tokens").Int(); got != 10000 {
+			t.Errorf("budget_tokens = %d, want 10000; body: %s", got, result)
+		}
+	})
+
+	// A caller budget outside [1024, max_tokens) would 400 once enabled - e.g. one
+	// sized for 128K output on a request clamped to 64K - so it falls back to effort.
+	t.Run("raw_body_replaces_caller_budget_that_does_not_fit", func(t *testing.T) {
+		for _,
```

**File**: `core/providers/anthropic/chat.go` (modified, +7/-1)
```diff
@@ -419,7 +419,7 @@ func ToAnthropicChatRequest(ctx *schemas.BifrostContext, bifrostReq *schemas.Bif
 		}
 
 		if bifrostReq.Params.MaxCompletionTokens != nil {
-			anthropicReq.MaxTokens = *bifrostReq.Params.MaxCompletionTokens
+			anthropicReq.MaxTokens = clampToModelOutputCeiling(caps, *bifrostReq.Params.MaxCompletionTokens)
 		}
 
 		// Opus 4.7+ and the Fable/Mythos family reject temperature, top_p, and
@@ -774,6 +774,12 @@ func ToAnthropicChatRequest(ctx *schemas.BifrostContext, bifrostReq *schemas.Bif
 					if budgetTokens < MinimumReasoningMaxTokens {
 						return nil, fmt.Errorf("reasoning.max_tokens must be >= %d for anthropic: %w", MinimumReasoningMaxTokens, ErrReasoningMaxTokensTooLow)
 					}
+					// The output clamp can leave the caller's budget at or above max_tokens; refit it below.
+					if requested := bifrostReq.Params.MaxCompletionTokens; requested != nil && *requested > anthropicReq.MaxTokens {
+						if fitted, ok := fitThinkingBudget(&budgetTokens, reasoningParams.Effort, anthropicReq.MaxTokens); ok {
+							budgetTokens = fitted
+						}
+					}
 					anthropicReq.Thinking = &AnthropicThinking{
 						Type:         "enabled",
 						BudgetTokens: schemas.Ptr(budgetTokens),
```

**File**: `core/providers/anthropic/requestbuilder.go` (modified, +24/-0)
```diff
@@ -259,6 +259,18 @@ func BuildAnthropicResponsesRequestBody(ctx *schemas.BifrostContext, request *sc
 					return nil, newErr(schemas.ErrProviderRequestMarshal, err, jsonBody)
 				}
 			}
+			if maxTokens := providerUtils.GetJSONField(jsonBody, "max_tokens"); maxTokens.Exists() {
+				if clamped := clampToModelOutputCeiling(schemas.ResolveModelCaps(cfg.Provider, capModel), int(maxTokens.Int())); int64(clamped) != maxTokens.Int() {
+					jsonBody, err = providerUtils.SetJSONField(jsonBody, "max_tokens", clamped)
+					if err != nil {
+						return nil, newErr(schemas.ErrProviderRequestMarshal, err, jsonBody)
+					}
+					jsonBody, err = fitRawThinkingBudget(jsonBody, clamped)
+					if err != nil {
+						return nil, newErr(schemas.ErrProviderRequestMarshal, err, jsonBody)
+					}
+				}
+			}
 
 		}
 
@@ -584,6 +596,18 @@ func BuildAnthropicChatRequestBody(ctx *schemas.BifrostContext, request *schemas
 				return nil, newErr(schemas.ErrProviderRequestMarshal, err, jsonBody)
 			}
 		}
+		if maxTokens := providerUtils.GetJSONField(jsonBody, "max_tokens"); maxTokens.Exists() {
+			if clamped := clampToModelOutputCeiling(schemas.ResolveModelCaps(cfg.Provider, capModel), int(maxTokens.Int())); int64(clamped) != maxTokens.Int() {
+				jsonBody, err = providerUtils.SetJSONField(jsonBody, "max_tokens", clamped)
+				if err != nil {
+					return nil, newErr(schemas.ErrProviderRequestMarshal, err, jsonBody)
+				}
+				jsonBody, err = fitRawThinkingBudget(jsonBody, clamped)
+				if err != nil {
+					return nil, newErr(schemas.ErrProviderRequestMarshal, err, jsonBody)
+				}
+			}
+		}
 
 		if cfg.IsStreaming {
 			jsonBody, err = providerUtils.SetJSONField(jsonBody, "stream", true)
```

**File**: `core/providers/anthropic/requestbuilder_test.go` (modified, +189/-0)
```diff
@@ -1230,3 +1230,192 @@ func TestBuildAnthropicResponsesRequestBody_IncludeFields(t *testing.T) {
 		}
 	})
 }
+
+// installMaxOutputRow answers every provider's lookup for model with a datasheet
+// row capping output at ceiling, mirroring the live claude-haiku-4-5 rows.
+func installMaxOutputRow(t *testing.T, model string, ceiling int) {
+	t.Helper()
+	providerUtils.SetCapabilityResolver(func(_ schemas.ModelProvider, m string) *schemas.ModelCapabilities {
+		if m == model {
+			return &schemas.ModelCapabilities{MaxOutputTokens: new(ceiling)}
+		}
+		return nil
+	})
+	t.Cleanup(func() { providerUtils.SetCapabilityResolver(nil) })
+}
+
+// A routing rule or fallback can retarget a request sized for a 128K model onto a
+// smaller one; upstream rejects max_tokens above the target's ceiling with a 400
+// ("max_tokens: 128000 > 64000, which is the maximum allowed number of output
+// tokens for claude-haiku-4-5-20251001"), so every builder path clamps to the row.
+func TestMaxTokensClampedToModelCeiling(t *testing.T) {
+	const haiku = "claude-haiku-4-5-20251001"
+	installMaxOutputRow(t, haiku, 64000)
+
+	build := func(t *testing.T, ctx *schemas.BifrostContext, provider schemas.ModelProvider, model string, chat bool, maxTokens int) int64 {
+		t.Helper()
+		body := fmt.Appendf(nil, `{"model":%q,"max_tokens":%d,"messages":[{"role":"user","content":"hi"}]}`, model, maxTokens)
+		cfg := AnthropicRequestBuildConfig{Provider: provider, Model: model}
+		var out []byte
+		var err *schemas.BifrostError
+		if chat {
+			out, err = BuildAnthropicChatRequestBody(ctx, &schemas.BifrostChatRequest{Provider: provider, Model: model, RawRequestBody: body, Input: []schemas.ChatMessage{{Role: schemas.ChatMessageRoleUser, Content: &schemas.ChatMessageContent{ContentStr: new("hi")}}}, Params: &schemas.ChatParameters{MaxCompletionTokens: new(maxTokens)}}, cfg)
+		} else {
+			out, err = BuildAnthropicResponsesRequestBody(ctx, &schemas.BifrostResponsesRequest{Provider: provider, Model: model, RawRequestBody: body, Input: makeSimpleInput("hi"), Params: &schemas.ResponsesParameters{MaxOutputTokens: new(maxTokens)}}, cfg)
+		}
+		if err != nil {
+			t.Fatalf("build: %v", err)
+		}
+		return providerUtils.GetJSONField(out, "max_tokens").Int()
+	}
+
+	for _, provider := range []schemas.ModelProvider{schemas.Anthropic, schemas.Vertex} {
+		for _, raw := range []bool{false, true} {
+			for _, chat := range []bool{false, true} {
+				newCtx := func() *schemas.BifrostContext {
+					ctx := schemas.NewBifrostContext(context.Background(), time.Time{})
+					ctx.SetValue(schemas.BifrostContextKeyUseRawRequestBody, raw)
+					return ctx
+				}
+				name := fmt.Sprintf("%s/raw=%v/chat=%v", provider, raw, chat)
+				t.Run(name+"/above_ceiling_clamped", func(t *testing.T) {
+					if got := build(t, newCtx(), provider, haiku, chat, 128000); got != 64000 {
+						t.Errorf("max_tokens = %d, want 64000", got)
+					}
+				})
+				t.Run(name+"/below_ceiling_kept", func(t *testing.T) {
+					if got := build(t, newCtx(), provider, haiku, chat, 32000); got != 32000 {
+						t.Errorf("max_tokens = %d, want 32000", got)
+					}
+				})
+				t.Run(name+"/no_known_ceiling_kept", func(t *testing.T) {
+					if got := build(t, newCtx(), provider, "claude-unknown-9", chat, 128000); got != 128000 {
+						t.Errorf("max_tokens = %d, want 128000", got)
+					}
+				})
+				// No datasheet row: the static Claude table still knows Haiku 4.5 caps at 64K.
+				t.Run(name+"/no_row_uses_claude_table", func(t *testing.T) {
+					if got := build(t, newCtx(), provider, "claude-haiku-4-5", chat, 128000); got != 64000 {
+						t.Errorf("max_tokens = %d, want 64000", got)
+					}
+				})
+				// output-300k is Message Batches only, and these builders serve synchronous Messages.
+				t.Run(name+"/output_300k_beta_still_clamped", func(t *testing.T) {
+					ctx := newCtx()
+					ctx.SetValue(schemas.BifrostContextKeyExtraHeaders, map[string][]string{AnthropicBetaHeader: {"output-300k-2026-03-24"}})
+					if got := build(t, ctx, provider, haiku, chat, 128000); got != 64000 {
+						t.Errorf("max_tokens = %d, want 64000", got)
+					}
+				})
+			}
+		}
+	}
+}
+
+// The body a Claude Code session sized for an Opus model, forwarded verbatim after
+// a routing rule retargeted it to Haiku 4.5. Haiku caps output at 64K and has no
+// adaptive thinking ("adaptive thinking is not supported on this model"), so the
+// raw path must clamp max_tokens and turn adaptive into a budget the model takes.
+func TestClaudeCodeBodyRetargetedToHaiku(t *testing.T) {
+	const haiku = "claude-haiku-4-5-20251001"
+	installMaxOutputRow(t, haiku, 64000)
+
+	ctx := schemas.NewBifrostContext(context.Background(), time.Time{})
+	ctx.SetValue(schemas.BifrostContextKeyUseRawRequestBody, true)
+	out, err := BuildAnthropicResponsesRequestBody(ctx, &schemas.BifrostResponsesRequest{
+		Provider:       schemas.Anthropic,
+		Model:          haiku,
+		RawRequestBody: []byte(`{"model":"claude-opus-4-6","max_tokens":128000
```

**File**: `core/providers/anthropic/responses.go` (modified, +7/-1)
```diff
@@ -4344,7 +4344,7 @@ func ToAnthropicResponsesRequest(ctx *schemas.BifrostContext, bifrostReq *schema
 	// Convert basic parameters
 	if bifrostReq.Params != nil {
 		if bifrostReq.Params.MaxOutputTokens != nil {
-			anthropicReq.MaxTokens = *bifrostReq.Params.MaxOutputTokens
+			anthropicReq.MaxTokens = clampToModelOutputCeiling(caps, *bifrostReq.Params.MaxOutputTokens)
 		}
 		// Opus 4.7+ and the Fable/Mythos family reject temperature, top_p, and
 		// top_k with a 400 error.
@@ -4449,6 +4449,12 @@ func ToAnthropicResponsesRequest(ctx *schemas.BifrostContext, bifrostReq *schema
 					if budgetTokens < MinimumReasoningMaxTokens {
 						return nil, fmt.Errorf("reasoning.max_tokens must be >= %d for anthropic: %w", MinimumReasoningMaxTokens, ErrReasoningMaxTokensTooLow)
 					}
+					// The output clamp can leave the caller's budget at or above max_tokens; refit it below.
+					if requested := bifrostReq.Params.MaxOutputTokens; requested != nil && *requested > anthropicReq.MaxTokens {
+						if fitted, ok := fitThinkingBudget(&budgetTokens, bifrostReq.Params.Reasoning.Effort, anthropicReq.MaxTokens); ok {
+							budgetTokens = fitted
+						}
+					}
 					anthropicReq.Thinking = &AnthropicThinking{
 						Type:         "enabled",
 						BudgetTokens: schemas.Ptr(budgetTokens),
```

**File**: `core/providers/anthropic/utils.go` (modified, +118/-0)
```diff
@@ -256,6 +256,21 @@ func stripUnsupportedAnthropicFields(req *AnthropicMessageRequest, provider sche
 			req.OutputConfig = nil
 		}
 	}
+	// Pre-adaptive Claude (Haiku 4.5, Sonnet 4.5, Opus 4.5) 400s on adaptive thinking; rewrite to extended thinking.
+	// Runs before the effort strip below, which removes the effort the budget is derived from.
+	if req.Thinking != nil && req.Thinking.Type == "adaptive" && schemas.IsAnthropicModel(caps.Model()) &&
+		!caps.SupportsAdaptiveThinking(DefaultSupportsAdaptiveThinking(caps.Model())) {
+		var effort *string
+		if req.OutputConfig != nil {
+			effort = req.OutputConfig.Effort
+		}
+		if budget, ok := fitThinkingBudget(req.Thinking.BudgetTokens, effort, req.MaxTokens); ok {
+			req.Thinking.Type = "enabled"
+			req.Thinking.BudgetTokens = &budget
+		} else {
+			req.Thinking = nil
+		}
+	}
 	// output_config.effort — model-gated per
 	// https://platform.claude.com/docs/en/build-with-claude/effort. Models
 	// outside the supported set return: "This model does not support the
@@ -266,6 +281,10 @@ func stripUnsupportedAnthropicFields(req *AnthropicMessageRequest, provider sche
 			req.OutputConfig = nil
 		}
 	}
+	// A kept effort snaps onto the model's ladder (xhigh/max on Opus 4.5, xhigh on 4.6 400 otherwise).
+	if req.OutputConfig != nil && req.OutputConfig.Effort != nil && schemas.IsAnthropicModel(caps.Model()) {
+		req.OutputConfig.Effort = new(caps.NormalizeReasoningEffort(*req.OutputConfig.Effort, DefaultEffortControl(caps.Model())))
+	}
 	// thinking.type — model-gated. Adaptive-only models (Opus 4.7+, Sonnet 5+,
 	// Fable/Mythos) removed extended thinking and reject the legacy shape with:
 	//
@@ -659,6 +678,38 @@ func StripUnsupportedFieldsFromRawBody(jsonBody []byte, provider schemas.ModelPr
 		}
 	}
 
+	// thinking.type:"adaptive" on pre-adaptive Claude — mirrors the typed path, before the effort strip below.
+	if providerUtils.GetJSONField(jsonBody, "thinking.type").String() == "adaptive" && schemas.IsAnthropicModel(caps.Model()) &&
+		!caps.SupportsAdaptiveThinking(DefaultSupportsAdaptiveThinking(caps.Model())) {
+		var budget *int
+		if b := providerUtils.GetJSONField(jsonBody, "thinking.budget_tokens"); b.Exists() {
+			budget = new(int(b.Int()))
+		}
+		var effort *string
+		if e := providerUtils.GetJSONField(jsonBody, "output_config.effort"); e.Exists() {
+			effort = new(e.String())
+		}
+		maxTokens := providerUtils.GetMaxOutputTokensOrDefault(provider, caps.Model(), AnthropicDefaultMaxTokens)
+		if m := providerUtils.GetJSONField(jsonBody, "max_tokens"); m.Exists() {
+			maxTokens = int(m.Int())
+		}
+		if b, ok := fitThinkingBudget(budget, effort, maxTokens); ok {
+			jsonBody, err = providerUtils.SetJSONField(jsonBody, "thinking.type", "enabled")
+			if err != nil {
+				return nil, fmt.Errorf("rewrite raw thinking.type to enabled: %w", err)
+			}
+			jsonBody, err = providerUtils.SetJSONField(jsonBody, "thinking.budget_tokens", b)
+			if err != nil {
+				return nil, fmt.Errorf("set raw thinking.budget_tokens: %w", err)
+			}
+		} else {
+			jsonBody, err = providerUtils.DeleteJSONField(jsonBody, "thinking")
+			if err != nil {
+				return nil, fmt.Errorf("strip raw thinking: %w", err)
+			}
+		}
+	}
+
 	// output_config.effort — model-gated per
 	// https://platform.claude.com/docs/en/build-with-claude/effort.
 	// Mirrors the typed path; same cleanup of an empty parent.
@@ -675,6 +726,15 @@ func StripUnsupportedFieldsFromRawBody(jsonBody []byte, provider schemas.ModelPr
 			}
 		}
 	}
+	// A kept effort snaps onto the model's ladder — mirrors the typed path.
+	if e := providerUtils.GetJSONField(jsonBody, "output_config.effort"); e.Exists() && schemas.IsAnthropicModel(caps.Model()) {
+		if normalized := caps.NormalizeReasoningEffort(e.String(), DefaultEffortControl(caps.Model())); normalized != e.String() {
+			jsonBody, err = providerUtils.SetJSONField(jsonBody, "output_config.effort", normalized)
+			if err != nil {
+				return nil, fmt.Errorf("normalize raw output_config.effort: %w", err)
+			}
+		}
+	}
 
 	// thinking.type — model-gated. Mirrors the typed path in
 	// stripUnsupportedAnthropicFields; see there for why the legacy
@@ -1122,6 +1182,56 @@ func DefaultSupportsAdaptiveThinking(model string) bool {
 	return strings.Contains(m, "opus") || strings.Contains(m, "sonnet")
 }
 
+// DefaultEffortControl: the output_config.effort ladder per family, for rows that publish none.
+// Opus 4.5 takes low/medium/high, Opus/Sonnet 4.6 add max, Opus 4.7+/Sonnet 5+/Fable add xhigh.
+func DefaultEffortControl(model string) *schemas.EffortControl {
+	levels := []string{schemas.ReasoningEffortLow, schemas.ReasoningEffortMedium, schemas.ReasoningEffortHigh}
+	switch {
+	case IsOpus47Plus(model) || IsSonnet5Plus(model) || IsFableFamily(model):
+		levels = append(levels, schemas.ReasoningEffortXHigh, schemas.ReasoningEffortMax)
+	case DefaultSupportsAdaptiveThinking(model):
+		levels = append(levels, schemas.ReasoningEffortMax)
+	}
+	return &schemas.
```

**File**: `core/providers/anthropic/utils_test.go` (modified, +49/-0)
```diff
@@ -3164,6 +3164,55 @@ func TestStripUnsupportedFieldsFromRawBody_EffortGating(t *testing.T) {
 	}
 }
 
+// A kept output_config.effort snaps onto the model's ladder: Opus 4.5 takes
+// low/medium/high, Opus/Sonnet 4.6 add max, Opus 4.7+ add xhigh. Claude Code
+// defaults to xhigh, which a retargeted request carries onto older models.
+func TestStripUnsupportedFields_EffortLevelClamp(t *testing.T) {
+	tests := []struct {
+		model, effort, want string
+	}{
+		{"claude-opus-4-5", "xhigh", "high"},
+		{"claude-opus-4-5", "max", "high"},
+		{"claude-opus-4-5-20251101", "medium", "medium"},
+		{"claude-opus-4-6", "xhigh", "max"},
+		{"claude-sonnet-4-6", "max", "max"},
+		{"claude-opus-4-7", "xhigh", "xhigh"},
+		{"claude-opus-5-5", "max", "max"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.model+"/"+tt.effort+"/raw", func(t *testing.T) {
+			body := []byte(`{"model":"` + tt.model + `","output_config":{"effort":"` + tt.effort + `"}}`)
+			out, err := StripUnsupportedFieldsFromRawBody(body, schemas.Anthropic, tt.model)
+			if err != nil {
+				t.Fatalf("StripUnsupportedFieldsFromRawBody: %v", err)
+			}
+			if got := providerUtils.GetJSONField(out, "output_config.effort").String(); got != tt.want {
+				t.Errorf("output_config.effort = %q, want %q; body=%s", got, tt.want, out)
+			}
+		})
+		t.Run(tt.model+"/"+tt.effort+"/typed", func(t *testing.T) {
+			req := &AnthropicMessageRequest{Model: tt.model, OutputConfig: &AnthropicOutputConfig{Effort: new(tt.effort)}}
+			stripUnsupportedAnthropicFields(req, schemas.Anthropic, tt.model)
+			if req.OutputConfig == nil || req.OutputConfig.Effort == nil || *req.OutputConfig.Effort != tt.want {
+				t.Errorf("OutputConfig = %+v, want effort %q", req.OutputConfig, tt.want)
+			}
+		})
+	}
+
+	t.Run("datasheet_ladder_wins", func(t *testing.T) {
+		model := "claude-opus-4-5-ladder-override"
+		setOverride(t, model, schemas.ModelCapabilities{ReasoningEffortLevels: []string{"low", "medium", "high", "xhigh"}})
+		body := []byte(`{"model":"` + model + `","output_config":{"effort":"xhigh"}}`)
+		out, err := StripUnsupportedFieldsFromRawBody(body, schemas.Anthropic, model)
+		if err != nil {
+			t.Fatalf("StripUnsupportedFieldsFromRawBody: %v", err)
+		}
+		if got := providerUtils.GetJSONField(out, "output_config.effort").String(); got != "xhigh" {
+			t.Errorf("output_config.effort = %q, want \"xhigh\" from the row's ladder; body=%s", got, out)
+		}
+	})
+}
+
 func TestAddMissingBetaHeadersToContext_TaskBudgets(t *testing.T) {
 	tests := []struct {
 		name            string
```

**File**: `core/providers/utils/modelcapabilities.go` (modified, +11/-5)
```diff
@@ -16,7 +16,7 @@ var knownAnthropicMaxOutputTokens = map[string]int{
 	"claude-opus-4-7":   128000,
 	"claude-opus-4-6":   128000,
 	"claude-sonnet-5":   128000,
-	"claude-sonnet-4-6": 64000,
+	"claude-sonnet-4-6": 128000,
 	"claude-haiku-4-5":  64000,
 	"claude-sonnet-4-5": 64000,
 	"claude-opus-4-5":   64000,
@@ -54,14 +54,20 @@ func GetMaxOutputTokensOrDefault(provider schemas.ModelProvider, model string, d
 	if caps := CapabilitiesFor(provider, model); caps != nil && caps.MaxOutputTokens != nil {
 		return *caps.MaxOutputTokens
 	}
-	if strings.Contains(model, "claude") {
-		if m, ok := knownAnthropicMaxOutputTokens[normalizeClaudeModelName(model)]; ok {
-			return m
-		}
+	if m := KnownClaudeMaxOutputTokens(model); m > 0 {
+		return m
 	}
 	return defaultValue
 }
 
+// KnownClaudeMaxOutputTokens returns the static max_output_tokens for a Claude model, or 0 when the table has none.
+func KnownClaudeMaxOutputTokens(model string) int {
+	if !strings.Contains(model, "claude") {
+		return 0
+	}
+	return knownAnthropicMaxOutputTokens[normalizeClaudeModelName(model)]
+}
+
 // IsVertexMultiRegionOnlyModel reports whether the given model is flagged in the
 // datasheet as only available on Google Vertex multi-region pool endpoints
 // (aiplatform.{region}.rep.googleapis.com). Returns false when the flag is not set.
```

---

### Incident Patch 5: `a1706805` (2026-10-05)
**Commit Message**: fixes single target ttf field ui capture (#7996)

## Summary

The "Time to first token cutoff (ms)" field on the routing rule sheet never saved. The UI showed "Routing rule updated successfully", but the value was lost, and the field always reopened as "Off".

The UI and the API disagreed on where `ttft_timeout_ms` lives:

- The API, the DB table and `config.schema.json` store it per target (`routing_target.ttft_timeout_ms`). The routing engine reads it from the selected target.
- The UI sent it at the top level of the rule. The request structs have no such field, so Go dropped it with no error. The UI also read a top-level field the API never returns.

## Changes

- `routingRuleSheet.tsx`: send `ttft_timeout_ms` on every target instead of on the rule. An empty field sends `0`, which clears a stored deadline. When editing, the field is filled from the targets.
- `routingRuleInfoSheet.tsx`: show the deadline derived from the targets.
- `types/routingRules.ts`: move `ttft_timeout_ms` from the rule types to `RoutingTarget`, to match the API.
- `utils/routingRules.ts`: add `summarizeTargetsTTFT` and `formatTargetsTTFT`.
- `utils/routingRules.test.ts`: unit tests for both helpers.

Desi

**File**: `cli/go.mod` (modified, +1/-3)
```diff
@@ -42,11 +42,9 @@ require (
 	github.com/muesli/ansi v0.0.0-20230316100256-276c6243b2f6 // indirect
 	github.com/muesli/cancelreader v0.2.2 // indirect
 	github.com/muesli/termenv v0.16.0 // indirect
-	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/rivo/uniseg v0.4.7 // indirect
 	github.com/rogpeppe/go-internal v1.14.1 // indirect
-	github.com/stretchr/objx v0.5.3 // indirect
-	github.com/stretchr/testify v1.11.1 // indirect
+	github.com/stretchr/testify v1.12.1 // indirect
 	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
 	github.com/xo/terminfo v0.0.0-20220910002029-abceb7e1c41e // indirect
 	golang.org/x/arch v0.23.0 // indirect
```

**File**: `cli/go.sum` (modified, +2/-4)
```diff
@@ -70,8 +70,6 @@ github.com/muesli/termenv v0.16.0 h1:S5AlUN9dENB57rsbnkPyfdGuWIlkmzJjbFf0Tf5FWUc
 github.com/muesli/termenv v0.16.0/go.mod h1:ZRfOIKPFDYQoDFF4Olj7/QJbW60Ol/kL1pU3VfY/Cnk=
 github.com/pkg/diff v0.0.0-20210226163009-20ebb0f2a09e/go.mod h1:pJLUxLENpZxwdsKMEsNbx1VGcRFpLqf3715MtcvvzbA=
 github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
-github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 h1:Jamvg5psRIccs7FGNTlIRMkT8wgtp5eCXdBlqhYGL6U=
-github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
 github.com/rivo/uniseg v0.4.7 h1:WUdvkW8uEhrYfLC4ZzdpI2ztxP1I582+49Oc5Mq64VQ=
 github.com/rivo/uniseg v0.4.7/go.mod h1:FN3SvrM+Zdj16jyLfmOkMNblXMcoc8DfTHruCPUcx88=
 github.com/rogpeppe/go-internal v1.9.0/go.mod h1:WtVeX8xhTBvf0smdhujwtBcq4Qrzq/fJaraNFVN+nFs=
@@ -86,14 +84,14 @@ github.com/stretchr/testify v1.7.1/go.mod h1:6Fq8oRcR53rry900zMqJjRRixrwX3KX962/
 github.com/stretchr/testify v1.8.0/go.mod h1:yNjHg4UonilssWZ8iaSj1OCr/vHnekPRkoO+kdMU+MU=
 github.com/stretchr/testify v1.8.4/go.mod h1:sz/lmYIOXD/1dqDmKjjqLyZ2RngseejIcXlSw2iwfAo=
 github.com/stretchr/testify v1.10.0/go.mod h1:r2ic/lqez/lEtzL7wO/rwa5dbSLXVDPFyf8C91i36aY=
-github.com/stretchr/testify v1.11.1 h1:7s2iGBzp5EwR7/aIZr8ao5+dra3wiQyKjjFuvgVKu7U=
-github.com/stretchr/testify v1.11.1/go.mod h1:wZwfW3scLgRK+23gO65QZefKpKQRnfz6sD981Nm4B6U=
+github.com/stretchr/testify v1.12.1 h1:EuwCh5fleGS7H32xRwO3wRGT7DxrDhLAT6FF8MpWDWE=
 github.com/twitchyliquid64/golang-asm v0.15.1 h1:SU5vSMR7hnwNxj24w34ZyCi/FmDZTkS4MhqMhdFk5YI=
 github.com/twitchyliquid64/golang-asm v0.15.1/go.mod h1:a1lVb/DtPvCB8fslRZhAngC2+aY1QWCk3Cedj/Gdt08=
 github.com/xo/terminfo v0.0.0-20220910002029-abceb7e1c41e h1:JVG44RsyaB9T2KIHavMF/ppJZNG9ZpyihvCd0w101no=
 github.com/xo/terminfo v0.0.0-20220910002029-abceb7e1c41e/go.mod h1:RbqR21r5mrJuqunuUZ/Dhy/avygyECGrLceyNeo4LiM=
 github.com/zalando/go-keyring v0.2.6 h1:r7Yc3+H+Ux0+M72zacZoItR3UDxeWfKTcabvkI8ua9s=
 github.com/zalando/go-keyring v0.2.6/go.mod h1:2TCrxYrbUNYfNS/Kgy/LSrkSQzZ5UPVH85RwfczwvcI=
+go.yaml.in/yaml/v3 v3.0.5 h1:N6y/pJk8buWs9NY5ERU2HSMfm+IuD/OtfdAnq6kESPw=
 golang.org/x/arch v0.23.0 h1:lKF64A2jF6Zd8L0knGltUnegD62JMFBiCPBmQpToHhg=
 golang.org/x/arch v0.23.0/go.mod h1:dNHoOeKiyja7GTvF9NJS1l3Z2yntpQNzgrjh1cU103A=
 golang.org/x/exp v0.0.0-20260410095643-746e56fc9e2f h1:W3F4c+6OLc6H2lb//N1q4WpJkhzJCK5J6kUi1NTVXfM=
```

**File**: `core/go.mod` (modified, +0/-1)
```diff
@@ -21,7 +21,6 @@ require (
 	github.com/fasthttp/websocket v1.5.12
 	github.com/golang-jwt/jwt/v5 v5.3.1
 	github.com/google/uuid v1.6.0
-	github.com/hajimehoshi/go-mp3 v0.3.4
 	github.com/klauspost/compress v1.20.0
 	github.com/mark3labs/mcp-go v0.43.2
 	github.com/rs/zerolog v1.34.0
```

**File**: `core/go.sum` (modified, +0/-53)
```diff
@@ -17,62 +17,39 @@ github.com/AzureAD/microsoft-authentication-library-for-go v1.6.0/go.mod h1:HKpQ
 github.com/andybalholm/brotli v1.2.2 h1:HzTuoo2ErYQqf5qvcJInB8uvqSVxRttzkFexPWtnceM=
 github.com/andybalholm/brotli v1.2.2/go.mod h1:rzTDkvFWvIrjDXZHkuS16NPggd91W3kUSvPlQ1pLaKY=
 github.com/aws/aws-sdk-go-v2 v1.42.0 h1:XvXMJTkFQtpBKIWZnmr9ZEOc2InWM2yldjXEJ/bymhA=
-github.com/aws/aws-sdk-go-v2 v1.42.0/go.mod h1:27+ACypSLljLAEKsCYOmrjKh83vuTRkuAe9Uv/3A4bg=
 github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.10 h1:gx1AwW1Iyk9Z9dD9F4akX5gnN3QZwUB20GGKH/I+Rho=
-github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.10/go.mod h1:qqY157uZoqm5OXq/amuaBJyC9hgBCBQnsaWnPe905GY=
 github.com/aws/aws-sdk-go-v2/config v1.32.14 h1:opVIRo/ZbbI8OIqSOKmpFaY7IwfFUOCCXBsUpJOwDdI=
-github.com/aws/aws-sdk-go-v2/config v1.32.14/go.mod h1:U4/V0uKxh0Tl5sxmCBZ3AecYny4UNlVmObYjKuuaiOo=
 github.com/aws/aws-sdk-go-v2/credentials v1.19.14 h1:n+UcGWAIZHkXzYt87uMFBv/l8THYELoX6gVcUvgl6fI=
-github.com/aws/aws-sdk-go-v2/credentials v1.19.14/go.mod h1:cJKuyWB59Mqi0jM3nFYQRmnHVQIcgoxjEMAbLkpr62w=
 github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.21 h1:NUS3K4BTDArQqNu2ih7yeDLaS3bmHD0YndtA6UP884g=
-github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.21/go.mod h1:YWNWJQNjKigKY1RHVJCuupeWDrrHjRqHm0N9rdrWzYI=
 github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.29 h1:f3vKqSo13fhTYb+JEcXwXefZQE26I1FB5eTSniU67ko=
-github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.29/go.mod h1:MzoLFUArKGpGD+ukmPiTPG1X5x4o6M2kq4v2dr1FiEc=
 github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.29 h1:RdwIf/CuUsvJX3RgJagbOyotl/cxoLY4xviKuE7p2GY=
-github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.29/go.mod h1:71wt8W2EgswdZy9Mf9KNnzxZ3TiZlv4caKghPktDOkA=
 github.com/aws/aws-sdk-go-v2/internal/ini v1.8.6 h1:qYQ4pzQ2Oz6WpQ8T3HvGHnZydA72MnLuFK9tJwmrbHw=
-github.com/aws/aws-sdk-go-v2/internal/ini v1.8.6/go.mod h1:O3h0IK87yXci+kg6flUKzJnWeziQUKciKrLjcatSNcY=
 github.com/aws/aws-sdk-go-v2/internal/v4a v1.4.22 h1:rWyie/PxDRIdhNf4DzRk0lvjVOqFJuNnO8WwaIRVxzQ=
-github.com/aws/aws-sdk-go-v2/internal/v4a v1.4.22/go.mod h1:zd/JsJ4P7oGfUhXn1VyLqaRZwPmZwg44Jf2dS84Dm3Y=
 github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.7 h1:5EniKhLZe4xzL7a+fU3C2tfUN4nWIqlLesfrjkuPFTY=
-github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.7/go.mod h1:x0nZssQ3qZSnIcePWLvcoFisRXJzcTVvYpAAdYX8+GI=
 github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.9.13 h1:JRaIgADQS/U6uXDqlPiefP32yXTda7Kqfx+LgspooZM=
-github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.9.13/go.mod h1:CEuVn5WqOMilYl+tbccq8+N2ieCy0gVn3OtRb0vBNNM=
 github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.21 h1:c31//R3xgIJMSC8S6hEVq+38DcvUlgFY0FM6mSI5oto=
-github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.21/go.mod h1:r6+pf23ouCB718FUxaqzZdbpYFyDtehyZcmP5KL9FkA=
 github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.19.21 h1:ZlvrNcHSFFWURB8avufQq9gFsheUgjVD9536obIknfM=
-github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.19.21/go.mod h1:cv3TNhVrssKR0O/xxLJVRfd2oazSnZnkUeTf6ctUwfQ=
 github.com/aws/aws-sdk-go-v2/service/s3 v1.99.0 h1:hlSuz394kV0vhv9drL5lhuEFbEOEP1VyQpy15qWh1Pk=
-github.com/aws/aws-sdk-go-v2/service/s3 v1.99.0/go.mod h1:uoA43SdFwacedBfSgfFSjjCvYe8aYBS7EnU5GZ/YKMM=
 github.com/aws/aws-sdk-go-v2/service/signin v1.0.9 h1:QKZH0S178gCmFEgst8hN0mCX1KxLgHBKKY/CLqwP8lg=
-github.com/aws/aws-sdk-go-v2/service/signin v1.0.9/go.mod h1:7yuQJoT+OoH8aqIxw9vwF+8KpvLZ8AWmvmUWHsGQZvI=
 github.com/aws/aws-sdk-go-v2/service/sso v1.30.15 h1:lFd1+ZSEYJZYvv9d6kXzhkZu07si3f+GQ1AaYwa2LUM=
-github.com/aws/aws-sdk-go-v2/service/sso v1.30.15/go.mod h1:WSvS1NLr7JaPunCXqpJnWk1Bjo7IxzZXrZi1QQCkuqM=
 github.com/aws/aws-sdk-go-v2/service/ssooidc v1.35.19 h1:dzztQ1YmfPrxdrOiuZRMF6fuOwWlWpD2StNLTceKpys=
-github.com/aws/aws-sdk-go-v2/service/ssooidc v1.35.19/go.mod h1:YO8TrYtFdl5w/4vmjL8zaBSsiNp3w0L1FfKVKenZT7w=
 github.com/aws/aws-sdk-go-v2/service/sts v1.41.10 h1:p8ogvvLugcR/zLBXTXrTkj0RYBUdErbMnAFFp12Lm/U=
-github.com/aws/aws-sdk-go-v2/service/sts v1.41.10/go.mod h1:60dv0eZJfeVXfbT1tFJinbHrDfSJ2GZl4Q//OSSNAVw=
 github.com/aws/smithy-go v1.27.1 h1:4T340VFndXtADGF52gYa1POyL7s9E4Z1OeZ1hCscIw8=
 github.com/aws/smithy-go v1.27.1/go.mod h1:YE2RhdIuDbA5E5bTdciG9KrW3+TiEONeUWCqxX9i1Fc=
 github.com/bahlo/generic-list-go v0.2.0 h1:5sz/EEAK+ls5wF+NeqDpk5+iNdMDXrh3z3nPnH1Wvgk=
 github.com/bahlo/generic-list-go v0.2.0/go.mod h1:2KvAjgMlE5NNynlg/5iLrrCCZ2+5xWbdbCW3pNTGyYg=
 github.com/buger/jsonparser v1.2.0 h1:4EFcvK1kD4jyj6YqNK6skK6w+y7FHHBR+XBCtxwu/6g=
-github.com/buger/jsonparser v1.2.0/go.mod h1:6RYKKt7H4d4+iWqouImQ9R2FZql3VbhNgx27UK13J/0=
 github.com/bytedance/gopkg v0.1.3 h1:TPBSwH8RsouGCBcMBktLt1AymVo2TVsBVCY4b6TnZ/M=
 github.com/bytedance/gopkg v0.1.3/go.mod h1:576VvJ+eJgyCzdjS+c4+77QF3p7ubbtiKARP3TxducM=
 github.com/bytedance/sonic v1.15.3-0.20260730064818-2a36d6da63e2 h1:XTVMfgtmKUmmdvQux2e0MjKVqbaJ7Yw8ngYXw5S6zYY=
 github.com/bytedance/sonic v1.15.3-0.20
```

**File**: `framework/go.mod` (modified, +0/-22)
```diff
@@ -12,7 +12,6 @@ require (
 	github.com/bytedance/sonic v1.15.3-0.20260730064818-2a36d6da63e2
 	github.com/google/uuid v1.6.0
 	github.com/jackc/pgx/v5 v5.9.2
-	github.com/maximhq/bifrost/core v1.11.1
 	github.com/philippgille/chromem-go v0.7.0
 	github.com/pinecone-io/go-pinecone/v5 v5.3.0
 	github.com/qdrant/go-client v1.16.2
@@ -42,10 +41,6 @@ require (
 	cloud.google.com/go/compute/metadata v0.9.0 // indirect
 	cloud.google.com/go/iam v1.7.0 // indirect
 	cloud.google.com/go/monitoring v1.24.3 // indirect
-	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.20.0 // indirect
-	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.13.1 // indirect
-	github.com/Azure/azure-sdk-for-go/sdk/internal v1.11.2 // indirect
-	github.com/AzureAD/microsoft-authentication-library-for-go v1.6.0 // indirect
 	github.com/ClickHouse/ch-go v0.65.0 // indirect
 	github.com/ClickHouse/clickhouse-go/v2 v2.32.0 // indirect
 	github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.33.0 // indirect
@@ -67,8 +62,6 @@ require (
 	github.com/aws/aws-sdk-go-v2/service/sso v1.30.15 // indirect
 	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.35.19 // indirect
 	github.com/aws/smithy-go v1.27.1 // indirect
-	github.com/bahlo/generic-list-go v0.2.0 // indirect
-	github.com/buger/jsonparser v1.2.0 // indirect
 	github.com/bytedance/gopkg v0.1.3 // indirect
 	github.com/bytedance/sonic/loader v0.5.2 // indirect
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
@@ -77,7 +70,6 @@ require (
 	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
 	github.com/envoyproxy/go-control-plane/envoy v1.37.0 // indirect
 	github.com/envoyproxy/protoc-gen-validate v1.3.3 // indirect
-	github.com/fasthttp/websocket v1.5.12 // indirect
 	github.com/felixge/httpsnoop v1.0.4 // indirect
 	github.com/go-faster/city v1.0.1 // indirect
 	github.com/go-faster/errors v0.7.1 // indirect
@@ -106,46 +98,33 @@ require (
 	github.com/go-openapi/swag/yamlutils v0.25.4 // indirect
 	github.com/go-openapi/validate v0.25.1 // indirect
 	github.com/go-viper/mapstructure/v2 v2.5.0 // indirect
-	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
 	github.com/google/s2a-go v0.1.9 // indirect
 	github.com/googleapis/enterprise-certificate-proxy v0.3.16 // indirect
 	github.com/googleapis/gax-go/v2 v2.22.0 // indirect
 	github.com/hashicorp/go-version v1.8.0 // indirect
-	github.com/invopop/jsonschema v0.13.0 // indirect
 	github.com/jackc/pgpassfile v1.0.0 // indirect
 	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
 	github.com/jackc/puddle/v2 v2.2.2 // indirect
 	github.com/jinzhu/inflection v1.0.0 // indirect
 	github.com/jinzhu/now v1.1.5 // indirect
 	github.com/klauspost/compress v1.20.0 // indirect
 	github.com/klauspost/cpuid/v2 v2.3.0 // indirect
-	github.com/kylelemons/godebug v1.1.0 // indirect
-	github.com/mailru/easyjson v0.9.1 // indirect
-	github.com/mark3labs/mcp-go v0.43.2 // indirect
-	github.com/mattn/go-colorable v0.1.14 // indirect
-	github.com/mattn/go-isatty v0.0.24 // indirect
 	github.com/mattn/go-sqlite3 v1.14.32 // indirect
 	github.com/molecule-man/go-brrr v1.0.1 // indirect
 	github.com/oapi-codegen/runtime v1.1.1 // indirect
 	github.com/oklog/ulid v1.3.1 // indirect
 	github.com/paulmach/orb v0.11.1 // indirect
 	github.com/pierrec/lz4/v4 v4.1.22 // indirect
-	github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c // indirect
 	github.com/pkg/errors v0.9.1 // indirect
 	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
-	github.com/rs/zerolog v1.34.0 // indirect
-	github.com/savsgio/gotils v0.0.0-20250408102913-196191ec6287 // indirect
 	github.com/segmentio/asm v1.2.0 // indirect
 	github.com/shopspring/decimal v1.4.0 // indirect
-	github.com/spf13/cast v1.10.0 // indirect
 	github.com/spiffe/go-spiffe/v2 v2.7.0 // indirect
 	github.com/stretchr/objx v0.5.3 // indirect
 	github.com/tidwall/match v1.1.1 // indirect
 	github.com/tidwall/pretty v1.2.1 // indirect
 	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
 	github.com/valyala/bytebufferpool v1.0.0 // indirect
-	github.com/wk8/go-ordered-map/v2 v2.1.8 // indirect
-	github.com/yosida95/uritemplate/v3 v3.0.2 // indirect
 	go.mongodb.org/mongo-driver v1.17.7 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/contrib/detectors/gcp v1.44.0 // indirect
@@ -156,7 +135,6 @@ require (
 	go.opentelemetry.io/otel/sdk v1.45.0 // indirect
 	go.opentelemetry.io/otel/sdk/metric v1.45.0 // indirect
 	go.opentelemetry.io/otel/trace v1.45.0 // indirect
-	go.starlark.net v0.0.0-20260102030733-3fee463870c9 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	golang.org/x/arch v0.23.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
```

**File**: `framework/go.sum` (modified, +0/-284)
```diff
@@ -1,471 +1,187 @@
 cel.dev/expr v0.25.2 h1:K6j46C81hXtZQfuX60cVWQFBJahKSE2gfRbNuvr5bFs=
-cel.dev/expr v0.25.2/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
 cloud.google.com/go v0.123.0 h1:2NAUJwPR47q+E35uaJeYoNhuNEM9kM8SjgRgdeOJUSE=
 cloud.google.com/go v0.123.0/go.mod h1:xBoMV08QcqUGuPW65Qfm1o9Y4zKZBpGS+7bImXLTAZU=
 cloud.google.com/go/auth v0.20.0 h1:kXTssoVb4azsVDoUiF8KvxAqrsQcQtB53DcSgta74CA=
-cloud.google.com/go/auth v0.20.0/go.mod h1:942/yi/itH1SsmpyrbnTMDgGfdy2BUqIKyd0cyYLc5Q=
 cloud.google.com/go/auth/oauth2adapt v0.2.8 h1:keo8NaayQZ6wimpNSmW5OPc283g65QNIiLpZnkHRbnc=
-cloud.google.com/go/auth/oauth2adapt v0.2.8/go.mod h1:XQ9y31RkqZCcwJWNSx2Xvric3RrU88hAYYbjDWYDL+c=
 cloud.google.com/go/compute/metadata v0.9.0 h1:pDUj4QMoPejqq20dK0Pg2N4yG9zIkYGdBtwLoEkH9Zs=
 cloud.google.com/go/compute/metadata v0.9.0/go.mod h1:E0bWwX5wTnLPedCKqk3pJmVgCBSM6qQI1yTBdEb3C10=
 cloud.google.com/go/iam v1.7.0 h1:JD3zh0C6LHl16aCn5Akff0+GELdp1+4hmh6ndoFLl8U=
-cloud.google.com/go/iam v1.7.0/go.mod h1:tetWZW1PD/m6vcuY2Zj/aU0eCHNPuxedbnbRTyKXvdY=
 cloud.google.com/go/logging v1.13.2 h1:qqlHCBvieJT9Cdq4QqYx1KPadCQ2noD4FK02eNqHAjA=
-cloud.google.com/go/logging v1.13.2/go.mod h1:zaybliM3yun1J8mU2dVQ1/qDzjbOqEijZCn6hSBtKak=
 cloud.google.com/go/longrunning v0.9.0 h1:0EzbDEGsAvOZNbqXopgniY0w0a1phvu5IdUFq8grmqY=
-cloud.google.com/go/longrunning v0.9.0/go.mod h1:pkTz846W7bF4o2SzdWJ40Hu0Re+UoNT6Q5t+igIcb8E=
 cloud.google.com/go/monitoring v1.24.3 h1:dde+gMNc0UhPZD1Azu6at2e79bfdztVDS5lvhOdsgaE=
-cloud.google.com/go/monitoring v1.24.3/go.mod h1:nYP6W0tm3N9H/bOw8am7t62YTzZY+zUeQ+Bi6+2eonI=
 cloud.google.com/go/storage v1.62.1 h1:Os0G3XbUbjZumkpDUf2Y0rLoXJTCF1kU2kWUujKYXD8=
 cloud.google.com/go/storage v1.62.1/go.mod h1:cpYz/kRVZ+UQAF1uHeea10/9ewcRbxGoGNKsS9daSXA=
 cloud.google.com/go/trace v1.11.7 h1:kDNDX8JkaAG3R2nq1lIdkb7FCSi1rCmsEtKVsty7p+U=
-cloud.google.com/go/trace v1.11.7/go.mod h1:TNn9d5V3fQVf6s4SCveVMIBS2LJUqo73GACmq/Tky0s=
-github.com/Azure/azure-sdk-for-go/sdk/azcore v1.20.0 h1:JXg2dwJUmPB9JmtVmdEB16APJ7jurfbY5jnfXpJoRMc=
-github.com/Azure/azure-sdk-for-go/sdk/azcore v1.20.0/go.mod h1:YD5h/ldMsG0XiIw7PdyNhLxaM317eFh5yNLccNfGdyw=
-github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.13.1 h1:Hk5QBxZQC1jb2Fwj6mpzme37xbCDdNTxU7O9eb5+LB4=
-github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.13.1/go.mod h1:IYus9qsFobWIc2YVwe/WPjcnyCkPKtnHAqUYeebc8z0=
-github.com/Azure/azure-sdk-for-go/sdk/azidentity/cache v0.3.2 h1:yz1bePFlP5Vws5+8ez6T3HWXPmwOK7Yvq8QxDBD3SKY=
-github.com/Azure/azure-sdk-for-go/sdk/azidentity/cache v0.3.2/go.mod h1:Pa9ZNPuoNu/GztvBSKk9J1cDJW6vk/n0zLtV4mgd8N8=
-github.com/Azure/azure-sdk-for-go/sdk/internal v1.11.2 h1:9iefClla7iYpfYWdzPCRDozdmndjTm8DXdpCzPajMgA=
-github.com/Azure/azure-sdk-for-go/sdk/internal v1.11.2/go.mod h1:XtLgD3ZD34DAaVIIAyG3objl5DynM3CQ/vMcbBNJZGI=
-github.com/AzureAD/microsoft-authentication-extensions-for-go/cache v0.1.1 h1:WJTmL004Abzc5wDB5VtZG2PJk5ndYDgVacGqfirKxjM=
-github.com/AzureAD/microsoft-authentication-extensions-for-go/cache v0.1.1/go.mod h1:tCcJZ0uHAmvjsVYzEFivsRTN00oz5BEsRgQHu5JZ9WE=
-github.com/AzureAD/microsoft-authentication-library-for-go v1.6.0 h1:XRzhVemXdgvJqCH0sFfrBUTnUJSBrBf7++ypk+twtRs=
-github.com/AzureAD/microsoft-authentication-library-for-go v1.6.0/go.mod h1:HKpQxkWaGLJ+D/5H8QRpyQXA1eKjxkFlOMwck5+33Jk=
 github.com/ClickHouse/ch-go v0.65.0 h1:vZAXfTQliuNNefqkPDewX3kgRxN6Q4vUENnnY+ynTRY=
-github.com/ClickHouse/ch-go v0.65.0/go.mod h1:tCM0XEH5oWngoi9Iu/8+tjPBo04I/FxNIffpdjtwx3k=
 github.com/ClickHouse/clickhouse-go/v2 v2.32.0 h1:zVWJUmUGdtCApM/vRfQhruGXIm1M643bk68B3IYbR1I=
-github.com/ClickHouse/clickhouse-go/v2 v2.32.0/go.mod h1:rGFIgeNbJVggBp2C+0FXOdfjsMlpsKx7FUYnHHyy2KE=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.33.0 h1:l7+6kwRMJNwdCvYdDl7Eax+wzEYHSnNY7zrrfbhDdTA=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.33.0/go.mod h1:pJTkW8hEUIIi3Pf65lPZOnn4Y81yCllX6IWk2jNXdkM=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.55.0 h1:UnDZ/zFfG1JhH/DqxIZYU/1CUAlTUScoXD/LcM2Ykk8=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.55.0/go.mod h1:IA1C1U7jO/ENqm/vhi7V9YYpBsp+IMyqNrEN94N7tVc=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/cloudmock v0.55.0 h1:7t/qx5Ost0s0wbA/VDrByOooURhp+ikYwv20i9Y07TQ=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/cloudmock v0.55.0/go.mod h1:vB2GH9GAYYJTO3mEn8oYwzEdhlayZIdQz6zdzgUIRvA=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.55.0 h1:0s6TxfCu2KHkkZPnBfsQ2y5qia0jl3MMrmBhu3nCOYk=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.55.0/go.mod h1:Mf6O40IAyB9zR/1J8nGDDPirZQQPbYJni8Yisy7NTMc=
-github.com/RaveNoX/go-jsoncommentstrip v1.0.0/go.mod h1:78ihd09MekBnJnxpICcwzCMzGrKSKYe4AqU6PDYYpjk=
 github.com/andybalholm/brotli v1.2.2 h1:HzTuoo2ErYQqf5qvcJInB8uvqSVxRttzkFexPWtnceM=
-github.com/andybal
```

**File**: `plugins/compat/go.sum` (modified, +0/-14)
```diff
@@ -5,21 +5,17 @@ cloud.google.com/go v0.123.0/go.mod h1:xBoMV08QcqUGuPW65Qfm1o9Y4zKZBpGS+7bImXLTA
 cloud.google.com/go/auth v0.20.0 h1:kXTssoVb4azsVDoUiF8KvxAqrsQcQtB53DcSgta74CA=
 cloud.google.com/go/auth v0.20.0/go.mod h1:942/yi/itH1SsmpyrbnTMDgGfdy2BUqIKyd0cyYLc5Q=
 cloud.google.com/go/auth/oauth2adapt v0.2.8 h1:keo8NaayQZ6wimpNSmW5OPc283g65QNIiLpZnkHRbnc=
-cloud.google.com/go/auth/oauth2adapt v0.2.8/go.mod h1:XQ9y31RkqZCcwJWNSx2Xvric3RrU88hAYYbjDWYDL+c=
 cloud.google.com/go/compute/metadata v0.9.0 h1:pDUj4QMoPejqq20dK0Pg2N4yG9zIkYGdBtwLoEkH9Zs=
 cloud.google.com/go/compute/metadata v0.9.0/go.mod h1:E0bWwX5wTnLPedCKqk3pJmVgCBSM6qQI1yTBdEb3C10=
 cloud.google.com/go/iam v1.7.0 h1:JD3zh0C6LHl16aCn5Akff0+GELdp1+4hmh6ndoFLl8U=
 cloud.google.com/go/iam v1.7.0/go.mod h1:tetWZW1PD/m6vcuY2Zj/aU0eCHNPuxedbnbRTyKXvdY=
 cloud.google.com/go/logging v1.13.2 h1:qqlHCBvieJT9Cdq4QqYx1KPadCQ2noD4FK02eNqHAjA=
-cloud.google.com/go/logging v1.13.2/go.mod h1:zaybliM3yun1J8mU2dVQ1/qDzjbOqEijZCn6hSBtKak=
 cloud.google.com/go/longrunning v0.9.0 h1:0EzbDEGsAvOZNbqXopgniY0w0a1phvu5IdUFq8grmqY=
 cloud.google.com/go/longrunning v0.9.0/go.mod h1:pkTz846W7bF4o2SzdWJ40Hu0Re+UoNT6Q5t+igIcb8E=
 cloud.google.com/go/monitoring v1.24.3 h1:dde+gMNc0UhPZD1Azu6at2e79bfdztVDS5lvhOdsgaE=
-cloud.google.com/go/monitoring v1.24.3/go.mod h1:nYP6W0tm3N9H/bOw8am7t62YTzZY+zUeQ+Bi6+2eonI=
 cloud.google.com/go/storage v1.62.1 h1:Os0G3XbUbjZumkpDUf2Y0rLoXJTCF1kU2kWUujKYXD8=
 cloud.google.com/go/storage v1.62.1/go.mod h1:cpYz/kRVZ+UQAF1uHeea10/9ewcRbxGoGNKsS9daSXA=
 cloud.google.com/go/trace v1.11.7 h1:kDNDX8JkaAG3R2nq1lIdkb7FCSi1rCmsEtKVsty7p+U=
-cloud.google.com/go/trace v1.11.7/go.mod h1:TNn9d5V3fQVf6s4SCveVMIBS2LJUqo73GACmq/Tky0s=
 github.com/Azure/azure-sdk-for-go/sdk/azcore v1.20.0 h1:JXg2dwJUmPB9JmtVmdEB16APJ7jurfbY5jnfXpJoRMc=
 github.com/Azure/azure-sdk-for-go/sdk/azcore v1.20.0/go.mod h1:YD5h/ldMsG0XiIw7PdyNhLxaM317eFh5yNLccNfGdyw=
 github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.13.1 h1:Hk5QBxZQC1jb2Fwj6mpzme37xbCDdNTxU7O9eb5+LB4=
@@ -39,11 +35,8 @@ github.com/ClickHouse/clickhouse-go/v2 v2.32.0/go.mod h1:rGFIgeNbJVggBp2C+0FXOdf
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.33.0 h1:l7+6kwRMJNwdCvYdDl7Eax+wzEYHSnNY7zrrfbhDdTA=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.33.0/go.mod h1:pJTkW8hEUIIi3Pf65lPZOnn4Y81yCllX6IWk2jNXdkM=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.55.0 h1:UnDZ/zFfG1JhH/DqxIZYU/1CUAlTUScoXD/LcM2Ykk8=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.55.0/go.mod h1:IA1C1U7jO/ENqm/vhi7V9YYpBsp+IMyqNrEN94N7tVc=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/cloudmock v0.55.0 h1:7t/qx5Ost0s0wbA/VDrByOooURhp+ikYwv20i9Y07TQ=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/cloudmock v0.55.0/go.mod h1:vB2GH9GAYYJTO3mEn8oYwzEdhlayZIdQz6zdzgUIRvA=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.55.0 h1:0s6TxfCu2KHkkZPnBfsQ2y5qia0jl3MMrmBhu3nCOYk=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.55.0/go.mod h1:Mf6O40IAyB9zR/1J8nGDDPirZQQPbYJni8Yisy7NTMc=
 github.com/RaveNoX/go-jsoncommentstrip v1.0.0/go.mod h1:78ihd09MekBnJnxpICcwzCMzGrKSKYe4AqU6PDYYpjk=
 github.com/andybalholm/brotli v1.2.2 h1:HzTuoo2ErYQqf5qvcJInB8uvqSVxRttzkFexPWtnceM=
 github.com/andybalholm/brotli v1.2.2/go.mod h1:rzTDkvFWvIrjDXZHkuS16NPggd91W3kUSvPlQ1pLaKY=
@@ -147,7 +140,6 @@ github.com/go-openapi/errors v0.22.5/go.mod h1:z9S8ASTUqx7+CP1Q8dD8ewGH/1JWFFLX/
 github.com/go-openapi/jsonpointer v0.22.4 h1:dZtK82WlNpVLDW2jlA1YCiVJFVqkED1MegOUy9kR5T4=
 github.com/go-openapi/jsonpointer v0.22.4/go.mod h1:elX9+UgznpFhgBuaMQ7iu4lvvX1nvNsesQ3oxmYTw80=
 github.com/go-openapi/jsonreference v0.21.4 h1:24qaE2y9bx/q3uRK/qN+TDwbok1NhbSmGjjySRCHtC8=
-github.com/go-openapi/jsonreference v0.21.4/go.mod h1:rIENPTjDbLpzQmQWCj5kKj3ZlmEh+EFVbz3RTUh30/4=
 github.com/go-openapi/loads v0.23.2 h1:rJXAcP7g1+lWyBHC7iTY+WAF0rprtM+pm8Jxv1uQJp4=
 github.com/go-openapi/loads v0.23.2/go.mod h1:IEVw1GfRt/P2Pplkelxzj9BYFajiWOtY2nHZNj4UnWY=
 github.com/go-openapi/runtime v0.29.2 h1:UmwSGWNmWQqKm1c2MGgXVpC2FTGwPDQeUsBMufc5Yj0=
@@ -201,7 +193,6 @@ github.com/golang/snappy v0.0.1/go.mod h1:/XxbfmMg8lxefKM7IXC3fBNl/7bRcc72aCRzEW
 github.com/google/go-cmp v0.5.2/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/gNBxE=
 github.com/google/go-cmp v0.5.5/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/gNBxE=
 github.com/google/go-cmp v0.7.0 h1:wk8382ETsv4JYUZwIsn6YpYiWiBsYLSJiTsyBybVuN8=
-github.com/google/go-cmp v0.7.0/go.mod h1:pXiqmnSA92OHEEa9HXL2W4E7lf9JzCmGVUdgjX3N/iU=
 github.com/google/martian/v3 v3.3.3 h1:DIhPTQrbPkgs2yJYdXU/eNACCG5DVQjySNRNlflZ9Fc=
 github.com/google/martian/v3 v3.3.3/go.mod h1:iEPrYcgCF7jA9OtScMFQyAlZZ4YXTKEtJ1E6RWzmBA0=
 github.com/google/s2a-go v0.1.9 h1:LGD7gtMgezd8a/Xak7mEWL0PjoTQFvpRudN895yqKW0=
@@ -225,7 +216,6 @@ github.com/
```

**File**: `plugins/governance/go.sum` (modified, +0/-209)
```diff
@@ -1,145 +1,85 @@
 cel.dev/expr v0.25.2 h1:K6j46C81hXtZQfuX60cVWQFBJahKSE2gfRbNuvr5bFs=
-cel.dev/expr v0.25.2/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
 cloud.google.com/go v0.123.0 h1:2NAUJwPR47q+E35uaJeYoNhuNEM9kM8SjgRgdeOJUSE=
 cloud.google.com/go v0.123.0/go.mod h1:xBoMV08QcqUGuPW65Qfm1o9Y4zKZBpGS+7bImXLTAZU=
 cloud.google.com/go/auth v0.20.0 h1:kXTssoVb4azsVDoUiF8KvxAqrsQcQtB53DcSgta74CA=
-cloud.google.com/go/auth v0.20.0/go.mod h1:942/yi/itH1SsmpyrbnTMDgGfdy2BUqIKyd0cyYLc5Q=
 cloud.google.com/go/auth/oauth2adapt v0.2.8 h1:keo8NaayQZ6wimpNSmW5OPc283g65QNIiLpZnkHRbnc=
-cloud.google.com/go/auth/oauth2adapt v0.2.8/go.mod h1:XQ9y31RkqZCcwJWNSx2Xvric3RrU88hAYYbjDWYDL+c=
 cloud.google.com/go/compute/metadata v0.9.0 h1:pDUj4QMoPejqq20dK0Pg2N4yG9zIkYGdBtwLoEkH9Zs=
 cloud.google.com/go/compute/metadata v0.9.0/go.mod h1:E0bWwX5wTnLPedCKqk3pJmVgCBSM6qQI1yTBdEb3C10=
 cloud.google.com/go/iam v1.7.0 h1:JD3zh0C6LHl16aCn5Akff0+GELdp1+4hmh6ndoFLl8U=
-cloud.google.com/go/iam v1.7.0/go.mod h1:tetWZW1PD/m6vcuY2Zj/aU0eCHNPuxedbnbRTyKXvdY=
 cloud.google.com/go/logging v1.13.2 h1:qqlHCBvieJT9Cdq4QqYx1KPadCQ2noD4FK02eNqHAjA=
-cloud.google.com/go/logging v1.13.2/go.mod h1:zaybliM3yun1J8mU2dVQ1/qDzjbOqEijZCn6hSBtKak=
 cloud.google.com/go/longrunning v0.9.0 h1:0EzbDEGsAvOZNbqXopgniY0w0a1phvu5IdUFq8grmqY=
-cloud.google.com/go/longrunning v0.9.0/go.mod h1:pkTz846W7bF4o2SzdWJ40Hu0Re+UoNT6Q5t+igIcb8E=
 cloud.google.com/go/monitoring v1.24.3 h1:dde+gMNc0UhPZD1Azu6at2e79bfdztVDS5lvhOdsgaE=
-cloud.google.com/go/monitoring v1.24.3/go.mod h1:nYP6W0tm3N9H/bOw8am7t62YTzZY+zUeQ+Bi6+2eonI=
 cloud.google.com/go/storage v1.62.1 h1:Os0G3XbUbjZumkpDUf2Y0rLoXJTCF1kU2kWUujKYXD8=
 cloud.google.com/go/storage v1.62.1/go.mod h1:cpYz/kRVZ+UQAF1uHeea10/9ewcRbxGoGNKsS9daSXA=
 cloud.google.com/go/trace v1.11.7 h1:kDNDX8JkaAG3R2nq1lIdkb7FCSi1rCmsEtKVsty7p+U=
-cloud.google.com/go/trace v1.11.7/go.mod h1:TNn9d5V3fQVf6s4SCveVMIBS2LJUqo73GACmq/Tky0s=
 github.com/Azure/azure-sdk-for-go/sdk/azcore v1.20.0 h1:JXg2dwJUmPB9JmtVmdEB16APJ7jurfbY5jnfXpJoRMc=
-github.com/Azure/azure-sdk-for-go/sdk/azcore v1.20.0/go.mod h1:YD5h/ldMsG0XiIw7PdyNhLxaM317eFh5yNLccNfGdyw=
 github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.13.1 h1:Hk5QBxZQC1jb2Fwj6mpzme37xbCDdNTxU7O9eb5+LB4=
-github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.13.1/go.mod h1:IYus9qsFobWIc2YVwe/WPjcnyCkPKtnHAqUYeebc8z0=
 github.com/Azure/azure-sdk-for-go/sdk/azidentity/cache v0.3.2 h1:yz1bePFlP5Vws5+8ez6T3HWXPmwOK7Yvq8QxDBD3SKY=
-github.com/Azure/azure-sdk-for-go/sdk/azidentity/cache v0.3.2/go.mod h1:Pa9ZNPuoNu/GztvBSKk9J1cDJW6vk/n0zLtV4mgd8N8=
 github.com/Azure/azure-sdk-for-go/sdk/internal v1.11.2 h1:9iefClla7iYpfYWdzPCRDozdmndjTm8DXdpCzPajMgA=
-github.com/Azure/azure-sdk-for-go/sdk/internal v1.11.2/go.mod h1:XtLgD3ZD34DAaVIIAyG3objl5DynM3CQ/vMcbBNJZGI=
 github.com/AzureAD/microsoft-authentication-extensions-for-go/cache v0.1.1 h1:WJTmL004Abzc5wDB5VtZG2PJk5ndYDgVacGqfirKxjM=
-github.com/AzureAD/microsoft-authentication-extensions-for-go/cache v0.1.1/go.mod h1:tCcJZ0uHAmvjsVYzEFivsRTN00oz5BEsRgQHu5JZ9WE=
 github.com/AzureAD/microsoft-authentication-library-for-go v1.6.0 h1:XRzhVemXdgvJqCH0sFfrBUTnUJSBrBf7++ypk+twtRs=
-github.com/AzureAD/microsoft-authentication-library-for-go v1.6.0/go.mod h1:HKpQxkWaGLJ+D/5H8QRpyQXA1eKjxkFlOMwck5+33Jk=
 github.com/ClickHouse/ch-go v0.65.0 h1:vZAXfTQliuNNefqkPDewX3kgRxN6Q4vUENnnY+ynTRY=
-github.com/ClickHouse/ch-go v0.65.0/go.mod h1:tCM0XEH5oWngoi9Iu/8+tjPBo04I/FxNIffpdjtwx3k=
 github.com/ClickHouse/clickhouse-go/v2 v2.32.0 h1:zVWJUmUGdtCApM/vRfQhruGXIm1M643bk68B3IYbR1I=
-github.com/ClickHouse/clickhouse-go/v2 v2.32.0/go.mod h1:rGFIgeNbJVggBp2C+0FXOdfjsMlpsKx7FUYnHHyy2KE=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.33.0 h1:l7+6kwRMJNwdCvYdDl7Eax+wzEYHSnNY7zrrfbhDdTA=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.33.0/go.mod h1:pJTkW8hEUIIi3Pf65lPZOnn4Y81yCllX6IWk2jNXdkM=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.55.0 h1:UnDZ/zFfG1JhH/DqxIZYU/1CUAlTUScoXD/LcM2Ykk8=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.55.0/go.mod h1:IA1C1U7jO/ENqm/vhi7V9YYpBsp+IMyqNrEN94N7tVc=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/cloudmock v0.55.0 h1:7t/qx5Ost0s0wbA/VDrByOooURhp+ikYwv20i9Y07TQ=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/cloudmock v0.55.0/go.mod h1:vB2GH9GAYYJTO3mEn8oYwzEdhlayZIdQz6zdzgUIRvA=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.55.0 h1:0s6TxfCu2KHkkZPnBfsQ2y5qia0jl3MMrmBhu3nCOYk=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.55.0/go.mod h1:Mf6O40IAyB9zR/1J8nGDDPirZQQPbYJni8Yisy7NTMc=
 github.com/RaveNoX/go-jsoncommentstrip v1.0.0/go.mod h1:78ihd09MekBnJnxpICcwzCMzGrKSKYe4AqU6PDYYpjk=
 github.com/andybalholm/brotli v1.2.2 h1:HzTuoo2ErYQqf5qvcJInB8uvqSVxRttzkFexPWtnceM=
-github.com/andybalh
```

---

### Incident Patch 6: `70287e50` (2026-10-05)
**Commit Message**: fix(framework): run only pending migration steps on startup (#7994)

When one migration ID was pending, `runMigrationSteps` called every step in the list. Each applied step still ran `AutoMigrate` on the `migrations` table, the metadata backfill and a `count`, so startup cost scaled with total migrations and took minutes against a remote Postgres. The logs also printed a starting/finished pair for every step, which looked like a full replay.

The runner now reads the pending IDs once and skips steps whose IDs are all recorded, in configstore and logstore. If the pending read fails, it logs a warning and runs every step as before.

Migration tests in both packages pass. Not yet run against a real Postgres.

**File**: `framework/configstore/migrations.go` (modified, +27/-1)
```diff
@@ -260,16 +260,42 @@ func pendingMigrationStepIDs(ctx context.Context, db *gorm.DB, steps []migration
 	return migrator.PendingIDs(ctx, db, migrator.DefaultOptions, migrationStepIDs(steps))
 }
 
-// runMigrationSteps runs migration steps in their declared order.
+// runMigrationSteps runs migration steps in their declared order. It reads the
+// pending IDs once and skips steps whose IDs are all recorded, so a deploy with
+// one new migration does not pay a round trip per already-applied step. If the
+// preflight read fails, every step runs and each one checks its own row.
 func runMigrationSteps(ctx context.Context, db *gorm.DB, logger schemas.Logger, steps []migrationStep) error {
+	pending, err := pendingMigrationStepIDs(ctx, db, steps)
+	var pendingSet map[string]struct{}
+	if err != nil {
+		logger.Warn("[configstore] migration preflight failed; running every step: %v", err)
+	} else {
+		pendingSet = make(map[string]struct{}, len(pending))
+		for _, id := range pending {
+			pendingSet[id] = struct{}{}
+		}
+	}
 	for _, step := range steps {
+		if pendingSet != nil && !stepHasPendingID(step, pendingSet) {
+			continue
+		}
 		if err := step.run(ctx, db, logger); err != nil {
 			return err
 		}
 	}
 	return nil
 }
 
+// stepHasPendingID reports whether any ID the step writes is still pending.
+func stepHasPendingID(step migrationStep, pending map[string]struct{}) bool {
+	for _, id := range step.IDs {
+		if _, ok := pending[id]; ok {
+			return true
+		}
+	}
+	return false
+}
+
 // configstoreMigrationSteps is the ordered source of truth for configstore
 // migration execution and preflight checks.
 var configstoreMigrationSteps = []migrationStep{
```

**File**: `framework/configstore/runmigrationsteps_test.go` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+package configstore
+
+import (
+	"context"
+	"path/filepath"
+	"testing"
+
+	"github.com/maximhq/bifrost/core/schemas"
+	"github.com/maximhq/bifrost/framework/migrator"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+	"gorm.io/gorm/logger"
+)
+
+// newRunStepsTestDB opens a file-backed SQLite database so every pooled connection sees the same migrations table.
+func newRunStepsTestDB(t *testing.T) *gorm.DB {
+	t.Helper()
+	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "steps.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
+	require.NoError(t, err)
+	return db
+}
+
+// countingStep returns a step that records one gormigrate row per ID and bumps calls[id] each time it is invoked.
+func countingStep(calls map[string]int, ids ...string) migrationStep {
+	return migrationStep{
+		IDs: ids,
+		run: func(ctx context.Context, db *gorm.DB, _ schemas.Logger) error {
+			for _, id := range ids {
+				calls[id]++
+				m := migrator.New(db, migrator.DefaultOptions, []*migrator.Migration{{
+					ID:      id,
+					Migrate: func(*gorm.DB) error { return nil },
+				}})
+				if err := m.Migrate(); err != nil {
+					return err
+				}
+			}
+			return nil
+		},
+	}
+}
+
+// TestRunMigrationSteps_FreshDBRunsEveryStep verifies an empty migrations table makes every step run.
+func TestRunMigrationSteps_FreshDBRunsEveryStep(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	calls := map[string]int{}
+	steps := []migrationStep{countingStep(calls, "a"), countingStep(calls, "b"), countingStep(calls, "c")}
+
+	require.NoError(t, runMigrationSteps(context.Background(), db, newMockLogger(), steps))
+
+	assert.Equal(t, map[string]int{"a": 1, "b": 1, "c": 1}, calls)
+}
+
+// TestRunMigrationSteps_SkipsAppliedStepsAndRunsPending verifies applied steps are not invoked when a new step is added.
+func TestRunMigrationSteps_SkipsAppliedStepsAndRunsPending(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	calls := map[string]int{}
+	steps := []migrationStep{countingStep(calls, "a"), countingStep(calls, "b"), countingStep(calls, "c")}
+	require.NoError(t, runMigrationSteps(context.Background(), db, newMockLogger(), steps))
+
+	steps = append(steps, countingStep(calls, "d"))
+	require.NoError(t, runMigrationSteps(context.Background(), db, newMockLogger(), steps))
+
+	assert.Equal(t, map[string]int{"a": 1, "b": 1, "c": 1, "d": 1}, calls)
+}
+
+// TestRunMigrationSteps_AllAppliedRunsNothing verifies a fully applied list invokes no step.
+func TestRunMigrationSteps_AllAppliedRunsNothing(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	calls := map[string]int{}
+	steps := []migrationStep{countingStep(calls, "a"), countingStep(calls, "b")}
+	require.NoError(t, runMigrationSteps(context.Background(), db, newMockLogger(), steps))
+	require.NoError(t, runMigrationSteps(context.Background(), db, newMockLogger(), steps))
+
+	assert.Equal(t, map[string]int{"a": 1, "b": 1}, calls)
+}
+
+// TestRunMigrationSteps_GroupedStepRunsWhenOneIDPending verifies a multi-ID step runs if any of its IDs is missing.
+func TestRunMigrationSteps_GroupedStepRunsWhenOneIDPending(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	calls := map[string]int{}
+	require.NoError(t, runMigrationSteps(context.Background(), db, newMockLogger(), []migrationStep{countingStep(calls, "g1")}))
+	calls["g1"] = 0
+
+	grouped := countingStep(calls, "g1", "g2")
+	require.NoError(t, runMigrationSteps(context.Background(), db, newMockLogger(), []migrationStep{grouped}))
+
+	assert.Equal(t, 1, calls["g2"])
+	pending, err := pendingMigrationStepIDs(context.Background(), db, []migrationStep{grouped})
+	require.NoError(t, err)
+	assert.Empty(t, pending)
+}
+
+// TestRunMigrationSteps_PreflightErrorRunsEveryStep verifies a failing pending read falls back to running all steps.
+func TestRunMigrationSteps_PreflightErrorRunsEveryStep(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	// A migrations table without the id column passes the column checks in PendingIDs, then fails the read.
+	require.NoError(t, db.Exec("CREATE TABLE migrations (sequence INTEGER, applied_at DATETIME, status TEXT)").Error)
+	calls := map[string]int{}
+	steps := []migrationStep{countingStep(calls, "a"), countingStep(calls, "b")}
+
+	_, err := pendingMigrationStepIDs(context.Background(), db, steps)
+	require.Error(t, err)
+
+	// The steps themselves cannot use this broken table, so they only record that they were called.
+	stub := func(id string) migrationStep {
+		return migrationStep{IDs: []string{id}, run: func(context.Context, *gorm.DB, schemas.Logger) error {
+			calls[id]++
+			return nil
+		}}
+	}
+	calls = map[string]int{}
+	require.NoError(t, runMigrationSteps(context.Background(), db, newMockLogger(), []migrationStep{stub("a"), stub("b")}))
+
+	assert.Equal(t, map[string]int{"a": 1, "b": 1}, calls)
+}
```

**File**: `framework/logstore/migrations.go` (modified, +27/-1)
```diff
@@ -219,16 +219,42 @@ func pendingMigrationStepIDs(ctx context.Context, db *gorm.DB, steps []migration
 	return migrator.PendingIDs(ctx, db, migrator.DefaultOptions, migrationStepIDs(steps))
 }
 
-// runMigrationSteps runs migration steps in their declared order.
+// runMigrationSteps runs migration steps in their declared order. It reads the
+// pending IDs once and skips steps whose IDs are all recorded, so a deploy with
+// one new migration does not pay a round trip per already-applied step. If the
+// preflight read fails, every step runs and each one checks its own row.
 func runMigrationSteps(ctx context.Context, db *gorm.DB, logger schemas.Logger, steps []migrationStep) error {
+	pending, err := pendingMigrationStepIDs(ctx, db, steps)
+	var pendingSet map[string]struct{}
+	if err != nil {
+		logger.Warn("[logstore] migration preflight failed; running every step: %v", err)
+	} else {
+		pendingSet = make(map[string]struct{}, len(pending))
+		for _, id := range pending {
+			pendingSet[id] = struct{}{}
+		}
+	}
 	for _, step := range steps {
+		if pendingSet != nil && !stepHasPendingID(step, pendingSet) {
+			continue
+		}
 		if err := step.run(ctx, db, logger); err != nil {
 			return err
 		}
 	}
 	return nil
 }
 
+// stepHasPendingID reports whether any ID the step writes is still pending.
+func stepHasPendingID(step migrationStep, pending map[string]struct{}) bool {
+	for _, id := range step.IDs {
+		if _, ok := pending[id]; ok {
+			return true
+		}
+	}
+	return false
+}
+
 // logstoreMigrationSteps is the ordered source of truth for logstore migration
 // execution and preflight checks.
 var logstoreMigrationSteps = []migrationStep{
```

**File**: `framework/logstore/runmigrationsteps_test.go` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+package logstore
+
+import (
+	"context"
+	"path/filepath"
+	"testing"
+
+	"github.com/maximhq/bifrost/core/schemas"
+	"github.com/maximhq/bifrost/framework/migrator"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"gorm.io/driver/sqlite"
+	"gorm.io/gorm"
+	"gorm.io/gorm/logger"
+)
+
+// newRunStepsTestDB opens a file-backed SQLite database so every pooled connection sees the same migrations table.
+func newRunStepsTestDB(t *testing.T) *gorm.DB {
+	t.Helper()
+	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "steps.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
+	require.NoError(t, err)
+	return db
+}
+
+// countingStep returns a step that records one gormigrate row per ID and bumps calls[id] each time it is invoked.
+func countingStep(calls map[string]int, ids ...string) migrationStep {
+	return migrationStep{
+		IDs: ids,
+		run: func(ctx context.Context, db *gorm.DB, _ schemas.Logger) error {
+			for _, id := range ids {
+				calls[id]++
+				m := migrator.New(db, migrator.DefaultOptions, []*migrator.Migration{{
+					ID:      id,
+					Migrate: func(*gorm.DB) error { return nil },
+				}})
+				if err := m.Migrate(); err != nil {
+					return err
+				}
+			}
+			return nil
+		},
+	}
+}
+
+// TestRunMigrationSteps_FreshDBRunsEveryStep verifies an empty migrations table makes every step run.
+func TestRunMigrationSteps_FreshDBRunsEveryStep(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	calls := map[string]int{}
+	steps := []migrationStep{countingStep(calls, "a"), countingStep(calls, "b"), countingStep(calls, "c")}
+
+	require.NoError(t, runMigrationSteps(context.Background(), db, testLogger{}, steps))
+
+	assert.Equal(t, map[string]int{"a": 1, "b": 1, "c": 1}, calls)
+}
+
+// TestRunMigrationSteps_SkipsAppliedStepsAndRunsPending verifies applied steps are not invoked when a new step is added.
+func TestRunMigrationSteps_SkipsAppliedStepsAndRunsPending(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	calls := map[string]int{}
+	steps := []migrationStep{countingStep(calls, "a"), countingStep(calls, "b"), countingStep(calls, "c")}
+	require.NoError(t, runMigrationSteps(context.Background(), db, testLogger{}, steps))
+
+	steps = append(steps, countingStep(calls, "d"))
+	require.NoError(t, runMigrationSteps(context.Background(), db, testLogger{}, steps))
+
+	assert.Equal(t, map[string]int{"a": 1, "b": 1, "c": 1, "d": 1}, calls)
+}
+
+// TestRunMigrationSteps_AllAppliedRunsNothing verifies a fully applied list invokes no step.
+func TestRunMigrationSteps_AllAppliedRunsNothing(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	calls := map[string]int{}
+	steps := []migrationStep{countingStep(calls, "a"), countingStep(calls, "b")}
+	require.NoError(t, runMigrationSteps(context.Background(), db, testLogger{}, steps))
+	require.NoError(t, runMigrationSteps(context.Background(), db, testLogger{}, steps))
+
+	assert.Equal(t, map[string]int{"a": 1, "b": 1}, calls)
+}
+
+// TestRunMigrationSteps_GroupedStepRunsWhenOneIDPending verifies a multi-ID step runs if any of its IDs is missing.
+func TestRunMigrationSteps_GroupedStepRunsWhenOneIDPending(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	calls := map[string]int{}
+	require.NoError(t, runMigrationSteps(context.Background(), db, testLogger{}, []migrationStep{countingStep(calls, "g1")}))
+	calls["g1"] = 0
+
+	grouped := countingStep(calls, "g1", "g2")
+	require.NoError(t, runMigrationSteps(context.Background(), db, testLogger{}, []migrationStep{grouped}))
+
+	assert.Equal(t, 1, calls["g2"])
+	pending, err := pendingMigrationStepIDs(context.Background(), db, []migrationStep{grouped})
+	require.NoError(t, err)
+	assert.Empty(t, pending)
+}
+
+// TestRunMigrationSteps_PreflightErrorRunsEveryStep verifies a failing pending read falls back to running all steps.
+func TestRunMigrationSteps_PreflightErrorRunsEveryStep(t *testing.T) {
+	db := newRunStepsTestDB(t)
+	// A migrations table without the id column passes the column checks in PendingIDs, then fails the read.
+	require.NoError(t, db.Exec("CREATE TABLE migrations (sequence INTEGER, applied_at DATETIME, status TEXT)").Error)
+	calls := map[string]int{}
+	steps := []migrationStep{countingStep(calls, "a"), countingStep(calls, "b")}
+
+	_, err := pendingMigrationStepIDs(context.Background(), db, steps)
+	require.Error(t, err)
+
+	// The steps themselves cannot use this broken table, so they only record that they were called.
+	stub := func(id string) migrationStep {
+		return migrationStep{IDs: []string{id}, run: func(context.Context, *gorm.DB, schemas.Logger) error {
+			calls[id]++
+			return nil
+		}}
+	}
+	calls = map[string]int{}
+	require.NoError(t, runMigrationSteps(context.Background(), db, testLogger{}, []migrationStep{stub("a"), stub("b")}))
+
+	assert.Equal(t, map[string]int{"a": 1, "b": 1}, calls)
+}
```

---

### Incident Patch 7: `cded1935` (2026-10-05)
**Commit Message**: feat(helm): add `proxy_config`, `access_profile` on entities, `business-unit-data`/`customer-data` DAC, and `ttft_timeout_ms` (#7791)

## Summary

Briefly explain the purpose of this PR and the problem it solves.

## Changes

- What was changed and why
- Any notable design decisions or trade-offs

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Documentation
- [ ] Chore/CI

## Affected areas

- [ ] Core (Go)
- [ ] Transports (HTTP)
- [ ] Providers/Integrations
- [ ] Plugins
- [ ] UI (React)
- [ ] Docs

## How to test

Describe the steps to validate this change. Include commands and expected outcomes.

```sh
# Core/Transports
go version
go test ./...

# UI
cd ui
pnpm i || npm i
pnpm test || npm test
pnpm build || npm run build
```

If adding new configs or environment variables, document them here.

## Screenshots/Recordings

If UI changes, add before/after screenshots or short clips.

## Breaking changes

- [ ] Yes
- [ ] No

If yes, describe impact and migration instructions.

## Related issues

Link related issues and discussions. Example: Closes #123

## Security considerations

Note any security implications (auth, secrets, PII, sandboxing, etc.).

## Checkli

**File**: `helm-charts/bifrost/README.md` (modified, +4/-0)
```diff
@@ -12,6 +12,10 @@ Official Helm charts for deploying [Bifrost](https://github.com/maximhq/bifrost)
 
 - Added `bifrost.governance.complexityAnalyzerConfig.jev.criteria` (renders into `complexity_analyzer_config.jev.criteria`): per-tier overrides of the Typesafe Jev `definition`, `signals`, and `examples`, keyed by `SIMPLE`, `MEDIUM`, or `COMPLEX` (exact case). Any tier or field left out sends the shipped default; a definition is at most 500 characters, and each list at most 12 items of 300 characters.
 - Added `bifrost.mcp.toolManagerConfig.maxInstructionsPerClient` and `.maxInstructionsTotal` (`max_instructions_per_client` / `max_instructions_total`) to bound forwarded MCP server instructions in bytes; 0 keeps the built-in defaults.
+- Added `access_profile` to `bifrost.governance.customers[]`, `.teams[]`, and `.businessUnits[]` (renders into `governance.{customers,teams,business_units}[].access_profile`), the enterprise access profile the entity holds in place of its own budgets and rate limit.
+- `bifrost.governance.roles[].dac` and `.entity_dac` now accept `business-unit-data` and `customer-data` (`governance.roles[].dac` / `entity_dac`).
+- Documented `ttft_timeout_ms` on `bifrost.governance.routingRules[].targets[]` (`governance.routing_rules[].targets[].ttft_timeout_ms`) in the values schema.
+- Added `bifrost.proxyConfig` (renders into the top-level `proxy_config`): the global outbound proxy from the dashboard's proxy settings page, including `enableForScim` (`enable_for_scim`), `enableForInference` and `enableForApi`; reconciled with the same config hash as the other sections.
 - Added `bifrost.scim.config.attributeProjectMappings` (`{ attribute, value, project }`, every SSO provider) — renders into `scim_config.config.attributeProjectMappings`. Every matching rule adds the user to that project by name (projects are never auto-created); memberships a rule added are removed when it stops matching, while members added from the dashboard are kept.
 - Added `bifrost.scim.config.bulkSyncInterval` (default `24h`, every SSO provider) — renders into `scim_config.config.bulkSyncInterval`. How often the directory reconcile deprovisions users the IdP no longer returns: whole days or h/m/s pairs (`12h`, `1h30m`, `7d`), between 1h and 30d. Inert when SCIM is enabled or the provider has no directory API access.
 - Added `bifrost.mcp.toolManagerConfig.codeModeLimits` (`maxSourceBytes`, `maxSteps`, `maxMemoryBytes`, `maxLogBytes`, `maxToolCalls`, `maxValueBytes`, `maxNestingDepth`) to tune the limits on each code mode execution; an omitted or 0 field keeps the built-in default. Renders into `mcp.tool_manager_config.code_mode_limits`. Code mode no longer limits concurrent executions.
```

**File**: `helm-charts/bifrost/templates/_helpers.tpl` (modified, +15/-0)
```diff
@@ -271,6 +271,20 @@ false
 {{- if .Values.bifrost.setupToken }}
 {{- $_ := set $config "setup_token" .Values.bifrost.setupToken }}
 {{- end }}
+{{- with .Values.bifrost.proxyConfig }}
+{{- $proxy := dict "enabled" (.enabled | default false) }}
+{{- if .type }}{{- $_ := set $proxy "type" .type }}{{- end }}
+{{- if .url }}{{- $_ := set $proxy "url" .url }}{{- end }}
+{{- if .username }}{{- $_ := set $proxy "username" .username }}{{- end }}
+{{- if .password }}{{- $_ := set $proxy "password" .password }}{{- end }}
+{{- if .noProxy }}{{- $_ := set $proxy "no_proxy" .noProxy }}{{- end }}
+{{- if hasKey . "timeout" }}{{- $_ := set $proxy "timeout" (.timeout | int) }}{{- end }}
+{{- if hasKey . "skipTlsVerify" }}{{- $_ := set $proxy "skip_tls_verify" .skipTlsVerify }}{{- end }}
+{{- if hasKey . "enableForScim" }}{{- $_ := set $proxy "enable_for_scim" .enableForScim }}{{- end }}
+{{- if hasKey . "enableForInference" }}{{- $_ := set $proxy "enable_for_inference" .enableForInference }}{{- end }}
+{{- if hasKey . "enableForApi" }}{{- $_ := set $proxy "enable_for_api" .enableForApi }}{{- end }}
+{{- $_ := set $config "proxy_config" $proxy }}
+{{- end }}
 {{- if .Values.bifrost.client }}
 {{- $client := dict }}
 {{- if hasKey .Values.bifrost.client "dropExcessRequests" }}
@@ -584,6 +598,7 @@ false
 {{- if .profile }}{{- $_ := set $bu "profile" .profile }}{{- end }}
 {{- if .config }}{{- $_ := set $bu "config" .config }}{{- end }}
 {{- if .claims }}{{- $_ := set $bu "claims" .claims }}{{- end }}
+{{- if .access_profile }}{{- $_ := set $bu "access_profile" .access_profile }}{{- end }}
 {{- if .teamIds }}{{- $_ := set $bu "team_ids" .teamIds }}{{- end }}
 {{- $businessUnits = append $businessUnits $bu }}
 {{- end }}
```

**File**: `helm-charts/bifrost/values.schema.json` (modified, +79/-2)
```diff
@@ -318,6 +318,65 @@
           "default": "split",
           "description": "Controls how config.json is reconciled with the database on startup. \"split\" (default) preserves existing merge behavior. \"config.json\" makes explicitly-present sections in the file authoritative — database-only rows for those sections are pruned on startup."
         },
+        "proxyConfig": {
+          "type": "object",
+          "description": "Global outbound proxy (the dashboard's proxy settings page) and which components use it. Renders into config.json's top-level proxy_config.",
+          "properties": {
+            "enabled": {
+              "type": "boolean",
+              "default": false,
+              "description": "Turn the proxy on"
+            },
+            "type": {
+              "type": "string",
+              "enum": ["http"],
+              "default": "http",
+              "description": "Proxy type. Only http is supported."
+            },
+            "url": {
+              "type": "string",
+              "description": "Proxy URL (supports env.VAR_NAME). Required when enabled."
+            },
+            "username": {
+              "type": "string",
+              "description": "Username for proxy authentication (supports env.VAR_NAME)"
+            },
+            "password": {
+              "type": "string",
+              "description": "Password for proxy authentication (supports env.VAR_NAME)"
+            },
+            "noProxy": {
+              "type": "string",
+              "description": "Comma-separated hosts that bypass the proxy"
+            },
+            "timeout": {
+              "type": "integer",
+              "minimum": 0,
+              "description": "Connection timeout in seconds"
+            },
+            "skipTlsVerify": {
+              "type": "boolean",
+              "default": false,
+              "description": "Skip TLS certificate verification for the proxy"
+            },
+            "enableForScim": {
+              "type": "boolean",
+              "default": false,
+              "description": "Enterprise: route SCIM directory sync and identity-provider requests through the proxy"
+            },
+            "enableForInference": {
+              "type": "boolean",
+              "default": false,
+              "description": "Route inference requests through the proxy"
+            },
+            "enableForApi": {
+              "type": "boolean",
+              "default": false,
+              "description": "Route API requests through the proxy"
+            }
+          },
+          "additionalProperties": false
+        },
         "encryptionKey": {
           "type": "string",
           "description": "Encryption key for sensitive data. If not set, encryption is disabled and data is stored in plaintext."
@@ -1894,6 +1953,10 @@
                   },
                   "rate_limit_id": {
                     "type": "string"
+                  },
+                  "access_profile": {
+                    "type": "string",
+                    "description": "Enterprise: name of the access profile (declared under accessProfiles) this customer holds, in place of budgets and a rate limit of its own. Under source_of_truth split it applies when new or changed and dashboard changes are kept otherwise; under config.json it is enforced on every startup and an entry without it has its profile removed."
                   }
                 },
                 "required": ["id", "name"]
@@ -1922,6 +1985,10 @@
                   "business_unit_id": {
                     "type": "string"
                   },
+                  "access_profile": {
+                    "type": "string",
+                    "description": "Enterprise: name of the access profile (declared under accessProfiles) this team holds, in place of budgets and a rate limit of its own. Under source_of_truth split it applies when new or changed and dashboard changes are kept otherwise; under config.json it is enforced on every startup and an entry without it has its profile removed."
+                  },
                   "profile": {
                     "type": "object"
                   },
@@ -1961,6 +2028,10 @@
                   "claims": {
                     "type": "object"
                   },
+                  "access_profile": {
+                    "type": "string",
+                    "description": "Enterprise: name of the access profile (declared under accessProfiles) this business unit holds, in place of budgets and a rate limit of its own. Under source_of_truth split it applies when new or changed and dashboard changes are kept otherwise; under config.json it is enforced on every startup and an entry without it has its profile removed."
+                  },
                   "teamIds": {
                     "type": "array",
                     "items": {
@@ -1984,15 +2055,15 @@
                   },
                   "dac": {
      
```

**File**: `helm-charts/bifrost/values.yaml` (modified, +31/-1)
```diff
@@ -252,6 +252,23 @@ bifrost:
   #       enabled: "env.BIFROST_AUDIT_VERBOSE"
   featureFlags: {}
 
+  # Global outbound proxy (the dashboard's proxy settings page) and which components use it.
+  # Renders into config.json's top-level proxy_config. Under sourceOfTruth "split" it is applied
+  # when new or changed and dashboard edits are kept otherwise; under "config.json" it is applied
+  # on every startup. Leave unset to manage the proxy from the dashboard.
+  # proxyConfig:
+  #   enabled: true
+  #   type: "http"                       # only http is supported
+  #   url: "http://proxy.example.com:8080"
+  #   username: "env.PROXY_USERNAME"     # optional; env.VAR_NAME supported
+  #   password: "env.PROXY_PASSWORD"     # optional; env.VAR_NAME supported
+  #   noProxy: "localhost,.internal.example.com"
+  #   timeout: 30                        # seconds
+  #   skipTlsVerify: false
+  #   enableForScim: true                # Enterprise: SCIM directory sync and identity-provider requests
+  #   enableForInference: false
+  #   enableForApi: false
+
   # Client configuration
   client:
     dropExcessRequests: false
@@ -919,6 +936,9 @@ bifrost:
       #       reset_duration: "1Y"
       #   # Option B: single budget reference (pre-declared in governance.budgets)
       #   budget_id: "budget-1"
+      #   # Enterprise: hold an access profile (declared under accessProfiles) instead of
+      #   # budgets and a rate limit of its own; the two cannot be combined.
+      #   access_profile: "customer-profile"
     teams: []
       # - id: "team-1"
       #   name: "Team Name"
@@ -928,16 +948,25 @@ bifrost:
       #   profile: {}              # Team profile data
       #   config: {}               # Team configuration data
       #   claims: {}               # Team claims data
+      #   access_profile: "team-profile"  # Enterprise: access profile the team holds, instead of budget_id / rate_limit_id
+    # Enterprise: business unit definitions. Membership is managed by the IdP or the dashboard.
+    # businessUnits:
+    #   - id: "bu-emea"
+    #     name: "EMEA"
+    #     access_profile: "bu-profile"  # Access profile the business unit holds
+    #   # source_of_truth "split": access_profile applies when new or changed, dashboard changes kept otherwise.
+    #   # source_of_truth "config.json": enforced every startup; an entry without it has its profile removed.
     roles: []
       # - name: "dataAnalyst"
       #   description: "Read-only access for data analysts"
-      #   dac: "team-data"           # own-data | team-data | all-data (default: all-data)
+      #   dac: "team-data"           # own-data | team-data | business-unit-data | customer-data | all-data (default: all-data)
       #   # Optional per-entity overrides of the role's global dac. Resources supported as of
       #   # this chart release: Logs, MCPLogs, AuditLogs, VirtualKeys, Users, Teams, Customers,
       #   # BusinessUnits, RBAC, APIKeys, AccessProfiles, PromptRepository, RoutingRules,
       #   # GuardrailsConfig, MCPGateway, VirtualMCPs, Projects.
       #   entity_dac:
       #     VirtualKeys: "own-data"  # team-data everywhere else, but only their own keys
+      #     Logs: "customer-data"    # every log under the customers their teams or business units reach
       #   access_profiles:                    # Optional: names of all access profiles to grant
       #     - "analyst-profile"              # Takes precedence over deprecated access_profile
       #   permissions:
@@ -1035,6 +1064,7 @@ bifrost:
       #       model: ""              # Empty means use original model
       #       provider_key_name: ""  # Optional provider key name (resolved to internal key_id at load time)
       #       weight: 1.0
+      #       ttft_timeout_ms: 5000  # Optional: cut off a streaming attempt with no first token in 5s and run the next fallback
       #   fallbacks: ["openai"]
       #   scope: "global"           # Options: global, team, customer, virtual_key
       #   scope_id: ""              # Required for non-global scopes
```

**File**: `transports/config.schema.json` (modified, +81/-1)
```diff
@@ -913,6 +913,10 @@
                 "type": "string",
                 "description": "Associated rate limit ID"
               },
+              "access_profile": {
+                "type": "string",
+                "description": "Name of the access profile (defined in access_profiles) this customer holds. The profile governs everything under the customer and replaces its own budgets and rate limit, so it cannot be combined with them. Under source_of_truth \"split\" the declaration is applied when it is new or changed and dashboard changes are kept otherwise; under \"config.json\" it is enforced on every startup and an entry without access_profile has its profile removed."
+              },
               "calendar_aligned": {
                 "type": "boolean",
                 "description": "Snap the customer's budget and rate-limit reset windows to clean calendar boundaries (day, week, month, year)",
@@ -984,6 +988,10 @@
                 "type": "object",
                 "description": "Team claims data"
               },
+              "access_profile": {
+                "type": "string",
+                "description": "Name of the access profile (defined in access_profiles) this team holds. The profile governs everything under the team and replaces its own budgets and rate limit, so it cannot be combined with them. Under source_of_truth \"split\" the declaration is applied when it is new or changed and dashboard changes are kept otherwise; under \"config.json\" it is enforced on every startup and an entry without access_profile has its profile removed."
+              },
               "calendar_aligned": {
                 "type": "boolean",
                 "description": "Snap the team's budget and rate-limit reset windows to clean calendar boundaries (day, week, month, year)",
@@ -1037,6 +1045,10 @@
                 "type": "object",
                 "description": "Business unit claims data"
               },
+              "access_profile": {
+                "type": "string",
+                "description": "Name of the access profile (defined in access_profiles) this business unit holds. The profile governs everything under the business unit and replaces its own budgets and rate limit, so it cannot be combined with them. Under source_of_truth \"split\" the declaration is applied when it is new or changed and dashboard changes are kept otherwise; under \"config.json\" it is enforced on every startup and an entry without access_profile has its profile removed."
+              },
               "team_ids": {
                 "type": "array",
                 "description": "Team IDs to assign to this business unit",
@@ -1068,10 +1080,12 @@
               },
               "dac": {
                 "type": "string",
-                "description": "Data Access Control scope: own-data (user's own records), team-data (user's team records), all-data (unrestricted). Defaults to all-data.",
+                "description": "Data Access Control scope: own-data (user's own records), team-data (plus records of the user's teams), business-unit-data (plus records of the user's business units), customer-data (everything under the customers the user reaches through their teams or business units), all-data (unrestricted). Defaults to all-data.",
                 "enum": [
                   "own-data",
                   "team-data",
+                  "business-unit-data",
+                  "customer-data",
                   "all-data"
                 ],
                 "default": "all-data"
@@ -1084,6 +1098,8 @@
                   "enum": [
                     "own-data",
                     "team-data",
+                    "business-unit-data",
+                    "customer-data",
                     "all-data"
                   ]
                 }
@@ -4854,10 +4870,74 @@
     },
     "circuit_breaker_config": {
       "$ref": "#/$defs/circuit_breaker_config"
+    },
+    "proxy_config": {
+      "$ref": "#/$defs/global_proxy_config"
     }
   },
   "additionalProperties": false,
   "$defs": {
+    "global_proxy_config": {
+      "type": "object",
+      "description": "Global outbound proxy (the dashboard's proxy settings page) and which components use it. Under source_of_truth \"split\" it is applied when new or changed and dashboard edits are kept otherwise; under \"config.json\" it is applied on every startup. Omit to manage the proxy from the dashboard. Not the same as a provider's own proxy_config.",
+      "properties": {
+        "enabled": {
+          "type": "boolean",
+          "description": "Turn the proxy on",
+          "default": false
+        },
+        "type": {
+          "type": "string",
+          "enum": [
+            "http"
+          ],
+          "default": "http",
+          "description": "Proxy type. Only http is supported."
+        },
+        "url": {
+          "type": "string",
+          "description": "Proxy URL, e.g. http://proxy.example.com:8080 (
```

---

### Incident Patch 8: `4a3afea5` (2026-10-05)
**Commit Message**: fix(config): skip a governed team's or customer's limits at startup, not only after it (#7794)

## Summary

Briefly explain the purpose of this PR and the problem it solves.

## Changes

- What was changed and why
- Any notable design decisions or trade-offs

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Documentation
- [ ] Chore/CI

## Affected areas

- [ ] Core (Go)
- [ ] Transports (HTTP)
- [ ] Providers/Integrations
- [ ] Plugins
- [ ] UI (React)
- [ ] Docs

## How to test

Describe the steps to validate this change. Include commands and expected outcomes.

```sh
# Core/Transports
go version
go test ./...

# UI
cd ui
pnpm i || npm i
pnpm test || npm test
pnpm build || npm run build
```

If adding new configs or environment variables, document them here.

## Screenshots/Recordings

If UI changes, add before/after screenshots or short clips.

## Breaking changes

- [ ] Yes
- [ ] No

If yes, describe impact and migration instructions.

## Related issues

Link related issues and discussions. Example: Closes #123

## Security considerations

Note any security implications (auth, secrets, PII, sandboxing, etc.).

## Checklist

- [ ] I read `docs/contributing/REA

**File**: `transports/bifrost-http/lib/config.go` (modified, +126/-30)
```diff
@@ -1111,6 +1111,7 @@ func initStores(ctx context.Context, config *Config, configData *ConfigData, con
 		logger.Info("config store initialized (default SQLite)")
 	}
 	// else: ConfigStoreConfig is present but Enabled == false — leave ConfigStore nil
+	runConfigStoreReadyHook(ctx, config.ConfigStore)
 
 	// Clear restart required flag on server startup
 	if config.ConfigStore != nil {
@@ -3645,7 +3646,8 @@ func mergeGovernanceConfig(ctx context.Context, config *Config, configData *Conf
 			pricingOverridesToAdd, pricingOverridesToUpdate,
 			modelConfigsToAdd, modelConfigsToUpdate,
 			providersToAdd, providersToUpdate,
-			complexityAnalyzerConfigToUpdate)
+			complexityAnalyzerConfigToUpdate,
+			forceFileSync)
 		if err != nil {
 			logger.Fatal("failed to sync governance config: %v", err)
 		}
@@ -3766,6 +3768,37 @@ func RegisterVirtualKeyPruneGuard(fn VirtualKeyPruneGuard) {
 	virtualKeyPruneGuardMu.Unlock()
 }
 
+// ConfigStoreReadyHook runs once LoadConfig has opened the config store, before anything from
+// config.json is written to it. Enterprise registers one to install the governance plugin's legacy
+// limit guard against this store, so the governance reconcile below can already tell which teams and
+// customers an access profile governs; the enterprise store wrapper does not exist yet at this point.
+// Nil in OSS.
+type ConfigStoreReadyHook func(ctx context.Context, store configstore.ConfigStore)
+
+var (
+	configStoreReadyHookMu sync.RWMutex
+	configStoreReadyHook   ConfigStoreReadyHook
+)
+
+// RegisterConfigStoreReadyHook installs the hook LoadConfig calls once its config store is open.
+// Must be called before LoadConfig. Passing nil clears it.
+func RegisterConfigStoreReadyHook(fn ConfigStoreReadyHook) {
+	configStoreReadyHookMu.Lock()
+	configStoreReadyHook = fn
+	configStoreReadyHookMu.Unlock()
+}
+
+// runConfigStoreReadyHook calls the registered hook with the store LoadConfig just opened.
+func runConfigStoreReadyHook(ctx context.Context, store configstore.ConfigStore) {
+	configStoreReadyHookMu.RLock()
+	hook := configStoreReadyHook
+	configStoreReadyHookMu.RUnlock()
+	if hook == nil || store == nil {
+		return
+	}
+	hook(ctx, store)
+}
+
 // resolveProtectedVirtualKeys asks the registered guard which of the virtual keys
 // missing from config.json must be kept. Resolved before the prune transaction
 // opens, since the guard reads through the store's own connection. A guard error
@@ -4042,6 +4075,7 @@ func updateGovernanceConfigInStore(
 	providersToAdd []configstoreTables.TableProvider,
 	providersToUpdate []configstoreTables.TableProvider,
 	complexityAnalyzerConfigToUpdate *configstore.ComplexityAnalyzerConfig,
+	fileDecides bool,
 ) error {
 	logger.Debug("updating governance config in store with merged items")
 	err := config.ConfigStore.ExecuteTransaction(ctx, func(tx *gorm.DB) error {
@@ -4108,7 +4142,7 @@ func updateGovernanceConfigInStore(
 		// Which teams and customers an access profile governs, settled before the first limit is
 		// written: the rate-limit rows below are shared by id, so a governed entity's row has to be
 		// known before the file's version of it is applied.
-		governed, err := governedEntitiesInConfig(ctx, config, tx, rateLimitsToAdd, rateLimitsToUpdate, customersToAdd, customersToUpdate, teamsToAdd, teamsToUpdate)
+		governed, err := governedEntitiesInConfig(ctx, config, tx, fileDecides, rateLimitsToAdd, rateLimitsToUpdate, customersToAdd, customersToUpdate, teamsToAdd, teamsToUpdate)
 		if err != nil {
 			return err
 		}
@@ -4142,6 +4176,9 @@ func updateGovernanceConfigInStore(
 			if governed.customers[customer.ID] {
 				customer.RateLimitID = governed.rateLimitOfCustomer[customer.ID]
 				customer.RateLimit = nil
+				if governed.limitsUnknown["customer:"+customer.ID] {
+					customer.ConfigHash = ""
+				}
 				// Nothing the file says about this customer's budgets is applied: not the ones declared
 				// inline, and not the link named by budget_id, which the loops below leave alone.
 				customer.Budgets = nil
@@ -4163,6 +4200,9 @@ func updateGovernanceConfigInStore(
 			if governed.customers[customer.ID] {
 				customer.RateLimitID = governed.rateLimitOfCustomer[customer.ID]
 				customer.RateLimit = nil
+				if governed.limitsUnknown["customer:"+customer.ID] {
+					customer.ConfigHash = ""
+				}
 				// Emptied before the reconcile below reads it, so a governed customer's stored budgets are
 				// neither rewritten nor deleted as stale: the file's list is not the desired state while a
 				// profile governs the customer, so nothing may be compared against it.
@@ -4243,6 +4283,9 @@ func updateGovernanceConfigInStore(
 			if governed.teams[team.ID] {
 				team.RateLimitID = governed.rateLimitOfTeam[team.ID]
 				team.RateLimit = nil
+				if governed.limitsUnknown["team:"+team.ID] {
+					team.ConfigHash = ""
+				}
 			}
 			if err := config.ConfigStore.CreateTeam(ctx, &team, tx); err != nil {
 				return fmt.Errorf("failed to create
```

**File**: `transports/bifrost-http/lib/config_test.go` (modified, +275/-0)
```diff
@@ -13314,6 +13314,280 @@ func TestSQLite_Customer_GovernedByProfileKeepsItsStoredRateLimit(t *testing.T)
 		"config.json's rate limit was written onto the row a governed customer links")
 }
 
+// migratedTeamGuard answers the way the enterprise build does once team-1 has been migrated onto an
+// access profile, and nothing else is governed.
+func migratedTeamGuard(_ context.Context, holderKind, holderID string) (string, error) {
+	if holderKind == governance.LegacyLimitHolderTeam && holderID == "team-1" {
+		return "Engineering Baseline", nil
+	}
+	return "", nil
+}
+
+// teamBudgetConfig declares team-1 funded by a budget in governance.budgets, the shape a migration
+// leaves behind in a file nobody edited.
+func teamBudgetConfig(tempDir string, maxLimit float64) *ConfigData {
+	configData := makeConfigDataWithProvidersAndDir(nil, tempDir)
+	configData.Governance = &configstore.GovernanceConfig{
+		Teams: []tables.TableTeam{{ID: "team-1", Name: "Team One"}},
+		Budgets: []tables.TableBudget{
+			{ID: "team-1-budget", MaxLimit: maxLimit, ResetDuration: "1M", TeamID: stringPtr("team-1")},
+		},
+	}
+	return configData
+}
+
+// countBudget reports whether a budget row exists, and its limit when it does.
+func countBudget(t *testing.T, config *Config, id string) (bool, float64) {
+	t.Helper()
+	var budget tables.TableBudget
+	err := config.ConfigStore.DB().Where("id = ?", id).Limit(1).Find(&budget).Error
+	require.NoError(t, err)
+	return budget.ID != "", budget.MaxLimit
+}
+
+// TestConfigStoreReadyHook_RunsBeforeGovernanceIsWritten: the hook gets the store LoadConfig opened,
+// before any governance row from the file exists, which is what lets a guard it installs govern the
+// reconcile that follows.
+func TestConfigStoreReadyHook_RunsBeforeGovernanceIsWritten(t *testing.T) {
+	initTestLogger()
+	tempDir := createTempDir(t)
+	createConfigFile(t, tempDir, teamBudgetConfig(tempDir, 100))
+
+	calls := 0
+	teamsAtHook := int64(-1)
+	RegisterConfigStoreReadyHook(func(ctx context.Context, store configstore.ConfigStore) {
+		calls++
+		require.NoError(t, store.DB().Model(&tables.TableTeam{}).Count(&teamsAtHook).Error)
+	})
+	defer RegisterConfigStoreReadyHook(nil)
+
+	ctx := context.Background()
+	config, err := LoadConfig(ctx, tempDir)
+	require.NoError(t, err)
+	defer config.Close(ctx)
+
+	assert.Equal(t, 1, calls)
+	assert.Zero(t, teamsAtHook, "the hook ran after the file's teams were written")
+}
+
+// TestSQLite_Team_MigratedToProfile_SplitDoesNotRecreateItsBudget: a migration deletes the team's
+// budget; a split-mode restart on the unchanged file must not bring it back on top of the profile.
+func TestSQLite_Team_MigratedToProfile_SplitDoesNotRecreateItsBudget(t *testing.T) {
+	initTestLogger()
+	tempDir := createTempDir(t)
+	createConfigFile(t, tempDir, teamBudgetConfig(tempDir, 100))
+
+	ctx := context.Background()
+	config1, err := LoadConfig(ctx, tempDir)
+	require.NoError(t, err)
+	exists, _ := countBudget(t, config1, "team-1-budget")
+	require.True(t, exists)
+	// What the enterprise migration does to the legacy budget.
+	require.NoError(t, config1.ConfigStore.DB().Where("id = ?", "team-1-budget").Delete(&tables.TableBudget{}).Error)
+	config1.Close(ctx)
+
+	RegisterConfigStoreReadyHook(func(context.Context, configstore.ConfigStore) {
+		governance.RegisterLegacyLimitGuard(migratedTeamGuard)
+	})
+	defer RegisterConfigStoreReadyHook(nil)
+	defer governance.RegisterLegacyLimitGuard(nil)
+
+	config2, err := LoadConfig(ctx, tempDir)
+	require.NoError(t, err)
+	defer config2.Close(ctx)
+	exists, _ = countBudget(t, config2, "team-1-budget")
+	assert.False(t, exists, "the budget the migration replaced came back alongside the profile")
+}
+
+// TestSQLite_Team_MigratedToProfile_SplitSkipsAnEditedBudget: editing the old budget in the file does
+// not apply it to a team a profile governs.
+func TestSQLite_Team_MigratedToProfile_SplitSkipsAnEditedBudget(t *testing.T) {
+	initTestLogger()
+	tempDir := createTempDir(t)
+	createConfigFile(t, tempDir, teamBudgetConfig(tempDir, 100))
+
+	ctx := context.Background()
+	config1, err := LoadConfig(ctx, tempDir)
+	require.NoError(t, err)
+	config1.Close(ctx)
+
+	governance.RegisterLegacyLimitGuard(migratedTeamGuard)
+	defer governance.RegisterLegacyLimitGuard(nil)
+	createConfigFile(t, tempDir, teamBudgetConfig(tempDir, 999))
+
+	config2, err := LoadConfig(ctx, tempDir)
+	require.NoError(t, err)
+	defer config2.Close(ctx)
+	_, limit := countBudget(t, config2, "team-1-budget")
+	assert.EqualValues(t, 100, limit, "the edited budget was applied to a team an access profile governs")
+}
+
+// TestSQLite_Team_GuardLookupFails_SkipsItsLimitsAndBoots: a lookup that fails does not stop the
+// load. The team's limits are skipped this boot, as if a profile governed it, and the rest applies.
+func TestSQLite_Team_GuardLookupFails_SkipsItsLimitsAndBoots(t *testing.T) {
+	initTestLogger()
+	tempDir := createTempDir(t)
+	createConfigFile(t, tempDir, teamBudgetConfig(tempDir, 100
```

---

### Incident Patch 9: `e35900b0` (2026-10-05)
**Commit Message**: global css fix (#7985)

## Summary

Tailwind's source scanner does not follow symlinks when walking `../app`, so the `app/enterprise` symlink was previously invisible to it. This adds an explicit `@source "./enterprise/**/*.tsx"` entry rooted at the symlink itself, which resolves correctly regardless of which checkout or worktree the link points to. The existing `../../../bifrost-enterprise/enterprise-ui/**/*.tsx` entry is retained as a fallback for setups where the symlink is absent.

## Changes

- Replaced the old comment-only workaround with a concrete `@source "./enterprise/**/*.tsx"` directive so Tailwind picks up classes from the enterprise UI symlink
- Expanded the comment to clarify why both source entries are needed and how each one covers a different setup scenario

## Type of change

- [x] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Documentation
- [ ] Chore/CI

## Affected areas

- [ ] Core (Go)
- [ ] Transports (HTTP)
- [ ] Providers/Integrations
- [ ] Plugins
- [x] UI (React)
- [ ] Docs

## How to test

```sh
cd ui
pnpm i || npm i
pnpm build || npm run build
```

Verify that Tailwind classes defined only in `app/enterprise/**/*.tsx` files are present in the compiled CS

**File**: `ui/app/globals.css` (modified, +4/-1)
```diff
@@ -4,7 +4,10 @@
 @source "../app/**/*.tsx";
 @source "../node_modules/streamdown/dist/*.js";
 @source "../../../bifrost-enterprise/ui/**/*.tsx";
-/* app/enterprise is a symlink the scanner won't follow — point at the real path */
+/* app/enterprise is a symlink the scanner won't follow while walking ../app, so name it as its own
+   source: rooted at the link, it resolves to whichever checkout (or worktree) the link points at.
+   The fixed path covers setups without the link. */
+@source "./enterprise/**/*.tsx";
 @source "../../../bifrost-enterprise/enterprise-ui/**/*.tsx";
 
 @custom-variant dark (&:is(.dark *));
```

---

### Incident Patch 10: `f4792e61` (2026-10-05)
**Commit Message**: [fix]: Anthropic - preserve stop_sequence stop reason and matched sequence (#7921)

* [fix]: Anthropic - preserve stop_sequence stop reason and matched sequence

Anthropic's stop_reason "stop_sequence" was folded into Bifrost "stop" and
the matched sequence had nowhere to travel, so Anthropic-compatible egress
always reported stop_reason "end_turn" and stop_sequence null, including
for Claude on Vertex which round-trips through the Responses schema.

Carry the matched sequence on an optional BifrostResponsesResponse
StopSequence field (non-stream and stream state) and restore
"stop_sequence" on egress only when a matched sequence is present, so
OpenAI-style "stop" finishes still map to end_turn. The chat-completions
egress uses the existing StopString the same way.

Affected packages:
- core

* [docs]: Anthropic - add doc comments to functions touched by this PR

Affected packages:
- core

* [test]: Anthropic provider - move stop_sequence tests into existing test files

Moves the Responses round-trip tests from stopsequence_test.go into
responses_test.go and the chat egress test into chat_test.go, per the
AGENTS.md rule to add tests to existing test files. Test content is unchanged

**File**: `core/changelog.md` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+- [fix]: Anthropic-compatible responses report stop_reason "stop_sequence" with the matched stop_sequence instead of end_turn/null when Claude (Anthropic or Vertex) stops on a requested stop sequence, in both streaming and non-streaming responses. The matched sequence now survives the Bifrost Responses round trip via an optional stop_sequence field; OpenAI-style "stop" finishes still map to end_turn [@jimseiwert](https://github.com/jimseiwert)
 - [feat]: Typesafe can back a custom provider (base_provider_type "typesafe"). The Typesafe provider now answers to the custom name for lookup, key selection and reporting, honours allowed_requests for decisions and list models, applies request_path_overrides, supports keyless listing, and the native model listing strips the custom provider prefix [@akshaydeo](https://github.com/akshaydeo)
 - [fix]: chat streams converted from a Responses upstream send the assistant role exactly once, on the first chunk. Turns with only reasoning and function_call items sent no role at all, so clients such as LangChain.js dropped the tool calls (#7693) [@hmdsefi](https://github.com/hmdsefi)
 - [fix]: preserve Mistral streaming text arrays and reject unsupported content blocks [@xujiantop-crypto](https://github.com/xujiantop-crypto)
```

**File**: `core/providers/anthropic/chat.go` (modified, +5/-4)
```diff
@@ -1518,11 +1518,12 @@ func ToAnthropicChatResponse(bifrostResp *schemas.BifrostChatResponse) *Anthropi
 	if len(bifrostResp.Choices) > 0 {
 		choice := bifrostResp.Choices[0] // Anthropic typically returns one choice
 
-		if choice.FinishReason != nil {
-			anthropicResp.StopReason = ConvertBifrostFinishReasonToAnthropic(*choice.FinishReason)
+		var stopString *string
+		if choice.ChatNonStreamResponseChoice != nil {
+			stopString = choice.StopString
 		}
-		if choice.ChatNonStreamResponseChoice != nil && choice.StopString != nil {
-			anthropicResp.StopSequence = choice.StopString
+		if choice.FinishReason != nil {
+			anthropicResp.StopReason, anthropicResp.StopSequence = anthropicStopReasonWithSequence(ConvertBifrostFinishReasonToAnthropic(*choice.FinishReason), stopString)
 		}
 
 		// Add reasoning content
```

**File**: `core/providers/anthropic/chat_test.go` (modified, +35/-0)
```diff
@@ -2618,3 +2618,38 @@ func TestToAnthropicChatRequest_AllowedToolsNoneNameableStillMeansNone(t *testin
 	assert.Equal(t, 0, countFunctionTools(filtered), "no function tool was allowed, so the choice must be none")
 	assert.Len(t, filtered, 2, "both server tools are still there")
 }
+
+// TestStopSequence_ChatResponseEgress verifies that a chat response's StopString becomes
+// stop_reason "stop_sequence" with the matched string, while a plain stop maps to end_turn.
+func TestStopSequence_ChatResponseEgress(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name       string
+		stopString *string
+		wantReason AnthropicStopReason
+		wantSeq    *string
+	}{
+		{"matched sequence", schemas.Ptr("###"), AnthropicStopReasonStopSequence, schemas.Ptr("###")},
+		{"plain stop", nil, AnthropicStopReasonEndTurn, nil},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			result := ToAnthropicChatResponse(&schemas.BifrostChatResponse{
+				Model: "claude-sonnet-4-5",
+				Choices: []schemas.BifrostResponseChoice{{
+					FinishReason: schemas.Ptr(string(schemas.BifrostFinishReasonStop)),
+					ChatNonStreamResponseChoice: &schemas.ChatNonStreamResponseChoice{
+						Message: &schemas.ChatMessage{
+							Role:    schemas.ChatMessageRoleAssistant,
+							Content: &schemas.ChatMessageContent{ContentStr: schemas.Ptr("1 2 3")},
+						},
+						StopString: tt.stopString,
+					},
+				}},
+			})
+			assertStopFields(t, result.StopReason, result.StopSequence, tt.wantReason, tt.wantSeq)
+		})
+	}
+}
```

**File**: `core/providers/anthropic/responses.go` (modified, +21/-4)
```diff
@@ -79,6 +79,7 @@ type AnthropicResponsesStreamState struct {
 	Model                     *string                           // Model name from message_start
 	StopReason                *string                           // Stop reason for the message
 	StopDetails               *schemas.ResponsesStopDetails     // Refusal stop_details (server-side fallback), carried to the final message_delta
+	StopSequence              *string                           // Matched custom stop sequence when stop_reason is stop_sequence
 	CreatedAt                 int                               // Timestamp for created_at consistency
 	HasEmittedCreated         bool                              // Whether we've emitted response.created
 	HasEmittedInProgress      bool                              // Whether we've emitted response.in_progress
@@ -753,6 +754,7 @@ func AcquireAnthropicResponsesStreamState() *AnthropicResponsesStreamState {
 	state.MessageID = nil
 	state.StopReason = nil
 	state.StopDetails = nil
+	state.StopSequence = nil
 	state.Model = nil
 	state.CreatedAt = int(time.Now().Unix())
 	state.HasEmittedCreated = false
@@ -817,6 +819,7 @@ func (state *AnthropicResponsesStreamState) flush() {
 	state.MessageID = nil
 	state.StopReason = nil
 	state.StopDetails = nil
+	state.StopSequence = nil
 	state.Model = nil
 	state.CreatedAt = int(time.Now().Unix())
 	state.HasEmittedCreated = false
@@ -2739,6 +2742,9 @@ func (chunk *AnthropicStreamEvent) ToBifrostResponsesStream(ctx context.Context,
 				mapped = string(schemas.BifrostFinishReasonStop)
 			}
 			state.StopReason = &mapped
+			if *chunk.Delta.StopReason == AnthropicStopReasonStopSequence {
+				state.StopSequence = chunk.Delta.StopSequence
+			}
 		}
 		if chunk.Delta.StopDetails != nil {
 			state.StopDetails = stopDetailsToBifrost(chunk.Delta.StopDetails)
@@ -2768,6 +2774,7 @@ func (chunk *AnthropicStreamEvent) ToBifrostResponsesStream(ctx context.Context,
 				response.StopReason = stopReason
 			}
 			response.StopDetails = state.StopDetails
+			response.StopSequence = state.StopSequence
 			if bifrostUsage != nil {
 				response.Usage = bifrostUsage
 				response.Speed = chunk.Usage.Speed
@@ -2812,6 +2819,7 @@ func (chunk *AnthropicStreamEvent) ToBifrostResponsesStream(ctx context.Context,
 			response.StopReason = state.StopReason
 		}
 		response.StopDetails = state.StopDetails
+		response.StopSequence = state.StopSequence
 
 		// Fold the sandbox container (delivered on the final message_delta) onto
 		// every code_interpreter_call so response.completed carries it (mirrors the
@@ -2967,6 +2975,9 @@ func enforceStreamBlockTypes(state *anthropicToResponsesStreamState, events []*A
 	return kept
 }
 
+// toAnthropicResponsesStreamEvents maps a single Bifrost Responses stream chunk to the
+// raw Anthropic stream events it represents, including the stop_reason/stop_sequence
+// carried on message_delta. ToAnthropicResponsesStreamResponse post-processes the result.
 func toAnthropicResponsesStreamEvents(ctx *schemas.BifrostContext, bifrostResp *schemas.BifrostResponsesStreamResponse) []*AnthropicStreamEvent {
 	if bifrostResp == nil {
 		return nil
@@ -3896,9 +3907,10 @@ func toAnthropicResponsesStreamEvents(ctx *schemas.BifrostContext, bifrostResp *
 		if bifrostResp.Response != nil {
 			anthropicContentDeltaEvent.Usage = ConvertBifrostUsageToAnthropicUsage(bifrostResp.Response.Usage)
 			if bifrostResp.Response.StopReason != nil {
+				reason, stopSequence := anthropicStopReasonWithSequence(ConvertBifrostFinishReasonToAnthropic(*bifrostResp.Response.StopReason), bifrostResp.Response.StopSequence)
 				anthropicContentDeltaEvent.Delta = &AnthropicStreamDelta{
-					StopReason:   schemas.Ptr(ConvertBifrostFinishReasonToAnthropic(*bifrostResp.Response.StopReason)),
-					StopSequence: nil,
+					StopReason:   schemas.Ptr(reason),
+					StopSequence: stopSequence,
 				}
 			} else if reason := anthropicStopReasonFromIncompleteDetails(bifrostResp.Response.IncompleteDetails); reason != "" {
 				// A truncated turn carrying only incomplete_details must not report end_turn.
@@ -3972,8 +3984,10 @@ func toAnthropicResponsesStreamEvents(ctx *schemas.BifrostContext, bifrostResp *
 
 			// Convert stop reason from Bifrost format to Anthropic format
 			if bifrostResp.Response != nil && bifrostResp.Response.StopReason != nil {
+				reason, stopSequence := anthropicStopReasonWithSequence(ConvertBifrostFinishReasonToAnthropic(*bifrostResp.Response.StopReason), bifrostResp.Response.StopSequence)
 				streamResp.Delta = &AnthropicStreamDelta{
-					StopReason: schemas.Ptr(ConvertBifrostFinishReasonToAnthropic(*bifrostResp.Response.StopReason)),
+					StopReason:   schemas.Ptr(reason),
+					StopSequence: stopSequence,
 				}
 			} else if bifrostResp.Delta != nil {
 				// Handle text delta if present
@@ -5024,6 +5038,9 @@ func (response *AnthropicMessageResponse) ToBifrostResponsesResponse(ctx *schema
 			}
 		}
 		bifrostResp.StopReason = &mapped
+		if response.Sto
```

**File**: `core/providers/anthropic/responses_test.go` (modified, +132/-0)
```diff
@@ -1168,3 +1168,135 @@ func TestToAnthropicResponsesRequest_LeadingEffortOnlyKeepsSystemPromptHoisted(t
 	}
 	assertEffortOnlySystemMessage(t, msgs[0], "low", wire)
 }
+
+// A turn that ended on a requested stop sequence must reach Anthropic-compatible
+// clients as stop_reason "stop_sequence" with the matched string, not end_turn/null,
+// after the Anthropic -> Bifrost Responses -> Anthropic round trip.
+
+// assertStopFields checks that a converted stop_reason and stop_sequence match the
+// expected pair, treating a nil wantSeq as requiring a null stop_sequence.
+func assertStopFields(t *testing.T, gotReason AnthropicStopReason, gotSeq *string, wantReason AnthropicStopReason, wantSeq *string) {
+	t.Helper()
+	if gotReason != wantReason {
+		t.Errorf("stop_reason = %q, want %q", gotReason, wantReason)
+	}
+	switch {
+	case wantSeq == nil && gotSeq != nil:
+		t.Errorf("stop_sequence = %q, want null", *gotSeq)
+	case wantSeq != nil && (gotSeq == nil || *gotSeq != *wantSeq):
+		t.Errorf("stop_sequence = %v, want %q", gotSeq, *wantSeq)
+	}
+}
+
+// TestStopSequence_NonStreamingRoundTrip verifies that a non-streaming Anthropic message
+// keeps its stop_reason and matched stop_sequence through the Responses round trip, and
+// that a stray sequence on a non-stop_sequence reason is dropped.
+func TestStopSequence_NonStreamingRoundTrip(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name       string
+		reason     AnthropicStopReason
+		sequence   *string
+		wantReason AnthropicStopReason
+		wantSeq    *string
+	}{
+		{"stop_sequence keeps reason and match", AnthropicStopReasonStopSequence, schemas.Ptr("###"), AnthropicStopReasonStopSequence, schemas.Ptr("###")},
+		{"end_turn stays end_turn", AnthropicStopReasonEndTurn, nil, AnthropicStopReasonEndTurn, nil},
+		{"stray sequence on end_turn is dropped", AnthropicStopReasonEndTurn, schemas.Ptr("###"), AnthropicStopReasonEndTurn, nil},
+		{"max_tokens unaffected", AnthropicStopReasonMaxTokens, nil, AnthropicStopReasonMaxTokens, nil},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			ctx, cancel := schemas.NewBifrostContextWithCancel(context.Background())
+			defer cancel()
+
+			anthropicResp := &AnthropicMessageResponse{
+				ID:           "msg_stopseq",
+				Type:         "message",
+				Role:         "assistant",
+				Model:        "claude-sonnet-4-5",
+				StopReason:   tt.reason,
+				StopSequence: tt.sequence,
+				Content:      []AnthropicContentBlock{{Type: AnthropicContentBlockTypeText, Text: schemas.Ptr("1 2 3")}},
+			}
+			result := ToAnthropicResponsesResponse(ctx, anthropicResp.ToBifrostResponsesResponse(ctx))
+			assertStopFields(t, result.StopReason, result.StopSequence, tt.wantReason, tt.wantSeq)
+		})
+	}
+}
+
+// TestStopSequence_BifrostStopWithoutSequenceIsEndTurn verifies that the ambiguous "stop"
+// OpenAI-style providers report with no matched sequence keeps mapping to end_turn
+// rather than guessing stop_sequence.
+func TestStopSequence_BifrostStopWithoutSequenceIsEndTurn(t *testing.T) {
+	t.Parallel()
+	ctx, cancel := schemas.NewBifrostContextWithCancel(context.Background())
+	defer cancel()
+
+	result := ToAnthropicResponsesResponse(ctx, &schemas.BifrostResponsesResponse{
+		Model:      "gpt-5.1",
+		StopReason: schemas.Ptr(string(schemas.BifrostFinishReasonStop)),
+	})
+	assertStopFields(t, result.StopReason, result.StopSequence, AnthropicStopReasonEndTurn, nil)
+}
+
+// TestStopSequence_StreamingRoundTrip verifies that stop_reason and stop_sequence survive
+// streaming conversion, both on the relayed message_delta and on the message_delta
+// synthesized from response.completed.
+func TestStopSequence_StreamingRoundTrip(t *testing.T) {
+	t.Parallel()
+
+	tests := []struct {
+		name       string
+		reason     AnthropicStopReason
+		sequence   *string
+		wantReason AnthropicStopReason
+		wantSeq    *string
+	}{
+		{"stop_sequence", AnthropicStopReasonStopSequence, schemas.Ptr("END"), AnthropicStopReasonStopSequence, schemas.Ptr("END")},
+		{"end_turn", AnthropicStopReasonEndTurn, nil, AnthropicStopReasonEndTurn, nil},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Parallel()
+			ingressCtx := context.WithValue(context.Background(), schemas.BifrostContextKeyIntegrationType, "anthropic")
+			state := newFallbackStreamState()
+
+			delta := &AnthropicStreamEvent{
+				Type:  AnthropicStreamEventTypeMessageDelta,
+				Delta: &AnthropicStreamDelta{StopReason: schemas.Ptr(tt.reason), StopSequence: tt.sequence},
+				Usage: &AnthropicUsage{OutputTokens: 3},
+			}
+			deltaResps, bErr, _ := delta.ToBifrostResponsesStream(ingressCtx, 1, state)
+			if bErr != nil || len(deltaResps) != 1 || deltaResps[0].Response == nil {
+				t.Fatalf("unexpected message_delta conversion: %v %+v", bErr, deltaResps)
+			}
+			stop := &AnthropicStreamEvent{Type: AnthropicStreamEventTypeMessageStop}
+			stopResps, bErr, _ := stop.ToBifrostResponsesStream(ingressCtx, 2, state)
+	
```

**File**: `core/providers/anthropic/utils.go` (modified, +10/-0)
```diff
@@ -3214,6 +3214,16 @@ func ConvertBifrostFinishReasonToAnthropic(bifrostReason string) AnthropicStopRe
 	return AnthropicStopReason(bifrostReason)
 }
 
+// anthropicStopReasonWithSequence restores Anthropic's stop_sequence stop reason, which
+// Bifrost folds into "stop". Only a matched sequence reported by an Anthropic upstream
+// upgrades end_turn; without one (e.g. an OpenAI-style "stop") end_turn is kept.
+func anthropicStopReasonWithSequence(reason AnthropicStopReason, stopSequence *string) (AnthropicStopReason, *string) {
+	if reason == AnthropicStopReasonEndTurn && stopSequence != nil {
+		return AnthropicStopReasonStopSequence, stopSequence
+	}
+	return reason, nil
+}
+
 // anthropicResponsesStatus derives the Responses status and incomplete_details from a
 // stop reason already converted by ConvertAnthropicFinishReasonToBifrost. refusal is a
 // content-filter stop and model_context_window_exceeded a truncation; reasons with no
```

**File**: `core/schemas/responses.go` (modified, +3/-2)
```diff
@@ -260,8 +260,9 @@ type BifrostResponsesResponse struct {
 	Container            *ResponsesResponseContainer         `json:"container,omitempty"`         // Code-execution sandbox container (Anthropic surfaces it on the response / final streaming message_delta). The neutral per-call id also lives on ResponsesCodeInterpreterToolCall.ContainerID.
 	Status               *string                             `json:"status,omitempty"`            // completed, failed, in_progress, cancelled, queued, or incomplete
 	StreamOptions        *ResponsesStreamOptions             `json:"stream_options,omitempty"`
-	StopReason           *string                             `json:"stop_reason,omitempty"`  // Not in OpenAI's spec, but sent by other providers
-	StopDetails          *ResponsesStopDetails               `json:"stop_details,omitempty"` // Anthropic refusal detail; null unless stop_reason is "refusal"
+	StopReason           *string                             `json:"stop_reason,omitempty"`   // Not in OpenAI's spec, but sent by other providers
+	StopDetails          *ResponsesStopDetails               `json:"stop_details,omitempty"`  // Anthropic refusal detail; null unless stop_reason is "refusal"
+	StopSequence         *string                             `json:"stop_sequence,omitempty"` // Anthropic: the custom stop sequence that ended generation (StopReason is "stop")
 	Store                *bool                               `json:"store,omitempty"`
 	Temperature          *float64                            `json:"temperature,omitempty"`
 	Text                 *ResponsesTextConfig                `json:"text,omitempty"`
```

**File**: `tests/e2e/api/collections/provider-harness.json` (modified, +232/-0)
```diff
@@ -198977,6 +198977,238 @@
           }
         }
       ]
+    },
+    {
+      "name": "170. Anthropic egress preserves stop_reason stop_sequence and the matched sequence (#7920 / PR #7921) (anthropic-stop-sequence)",
+      "description": "Pins that when Claude (Anthropic provider or Vertex) stops on a requested stop sequence, /anthropic/v1/messages reports stop_reason \"stop_sequence\" and the matched string in stop_sequence, in the non-streaming body and in the streaming terminal message_delta.\n\nBug (#7920): the response is converted Anthropic -> Bifrost Responses -> Anthropic. Anthropic's stop_sequence reason is folded into Bifrost \"stop\" and the matched string had no field on BifrostResponsesResponse, so the egress reported stop_reason end_turn with stop_sequence null. Clients that branch on stop_reason == \"stop_sequence\" could not tell a delimiter stop from a natural end of turn.\n\nFix: BifrostResponsesResponse gains an optional stop_sequence carrier, the Anthropic ingress (ToBifrostResponsesResponse and the streaming message_delta handling in core/providers/anthropic/responses.go) records it when the upstream reason is stop_sequence, and the egress restores stop_reason stop_sequence via anthropicStopReasonWithSequence (core/providers/anthropic/utils.go). An OpenAI-style \"stop\" with no matched sequence still maps to end_turn.\n\nCases use the issue repro (stop_sequences [\"5\"]) with the output pinned as far as a live model allows: temperature 0, a system prompt demanding the exact characters, the user turn \"Output exactly this line and nothing else: 1 2 3 4 5 6 7 8 9 10\", and max_tokens 30, so the upstream stops right after \"4\". The text-ends-on-4 check runs first and reports a model that ignored the prompt as a precondition failure, separate from the stop_reason/stop_sequence assertions under test; the conversion itself is pinned with fixed upstream payloads by the unit tests in core/providers/anthropic. Anthropic non-streaming and streaming, Vertex Claude non-streaming and streaming. Red before the fix (end_turn / null), green after.",
+      "item": [
+        {
+          "name": "anthropic/claude-haiku-4-5 /anthropic/v1/messages non-streaming stop_sequences hit reports stop_reason stop_sequence with the matched sequence - #7920",
+          "event": [
+            {
+              "listen": "test",
+              "script": {
+                "type": "text/javascript",
+                "exec": [
+                  "pm.test('anthropic claude: non-streaming stop on a requested stop sequence reports stop_reason stop_sequence and stop_sequence 5 - #7920', function () {",
+                  "  var raw = pm.response.text() || '';",
+                  "  pm.expect(pm.response.code, 'failed: ' + raw.slice(0, 400)).to.equal(200);",
+                  "  var j; try { j = pm.response.json(); } catch (e) {",
+                  "    pm.expect.fail('response was not JSON: ' + raw.slice(0, 300)); return; }",
+                  "  var text = (j.content || []).filter(function (b) { return b && b.type === 'text'; }).map(function (b) { return b.text || ''; }).join('');",
+                  "  // Model-dependent precondition, reported apart from the #7920 conversion: the request pins the output to '1 2 3 4 5 ...' at temperature 0, so the upstream stops right after '4'. Other text means the model ignored the prompt, not that stop_sequence was dropped.",
+                  "  pm.expect(text, 'precondition (model output, not the #7920 conversion): expected the text to end on the digit 4 just before the stop sequence 5, got ' + JSON.stringify(text) + ' with stop_reason ' + j.stop_reason).to.match(/(^|\\D)4\\D*$/);",
+                  "  pm.expect(j.stop_reason, 'a turn that stopped on the requested stop sequence must report stop_reason stop_sequence, not end_turn: ' + raw.slice(0, 400)).to.equal('stop_sequence');",
+                  "  pm.expect(j.stop_sequence, 'stop_sequence must carry the matched sequence, not null: ' + raw.slice(0, 400)).to.equal('5');",
+                  "});"
+                ]
+              }
+            }
+          ],
+          "request": {
+            "method": "POST",
+            "header": [
+              {
+                "key": "Content-Type",
+                "value": "application/json"
+              },
+              {
+                "key": "anthropic-version",
+                "value": "2023-06-01"
+              }
+            ],
+            "body": {
+              "mode": "raw",
+              "raw": "{\"model\":\"anthropic/claude-haiku-4-5\",\"max_tokens\":30,\"temperature\":0,\"system\":\"Reply with exactly the requested characters and nothing else.\",\"stop_sequences\":[\"5\"],\"messages\":[{\"role\":\"user\",\"content\":\"Output exactly this line and nothing else: 1 2 3 4 5 6 7 8 9 10\"}]}"
+            },
+            "url": {
+              "raw": "{{baseUrl}}/anthropic/v1/messages",
+              "host": [
+                "{{baseUrl}}"
+        
```

---

### Incident Patch 11: `728a4c94` (2026-10-05)
**Commit Message**: fix: bound code execution resources (#7962)

Keep code execution in-process with a pinned Canonical Starlark runtime. Enforce computation and allocation budgets, cancellation, bounded concurrency, and bounded source, logs, tool calls, and value conversion. Reject cyclic or excessively expanded results before serialization, preserve nested MCP authorization, and truncate automatic tool-response log previews. Remove child processes, IPC, and Linux-only resource limits.

Validation: package tests and race checks, local STDIO code-mode regressions including large responses and nested authorization, go vet, and structurally validated wire regression cases. Live provider harness remains for reviewer execution. Final microbenchmarks: evaluator scalar 5.8 us and mocked tool call 13.3 us versus roughly 5 ms with subprocesses. Full execution path scalar 8.4 us versus roughly 6 us originally; 100-item transformation 125 us versus roughly 20 us originally. Allocation accounting is cooperative, not an OS-enforced RSS limit; parsing is source-size bounded and MCP tools retain their own transport/resource responsibilities.

**File**: `core/bifrost.go` (modified, +25/-0)
```diff
@@ -383,6 +383,7 @@ func Init(ctx context.Context, config schemas.BifrostConfig) (*Bifrost, error) {
 				codeModeConfig = &mcp.CodeModeConfig{
 					BindingLevel:         mcpConfig.ToolManagerConfig.CodeModeBindingLevel,
 					ToolExecutionTimeout: time.Duration(mcpConfig.ToolManagerConfig.ToolExecutionTimeout),
+					Limits:               mcpConfig.ToolManagerConfig.CodeModeLimits,
 				}
 			}
 			codeMode := starlark.NewStarlarkCodeMode(codeModeConfig, bifrost.logger)
@@ -4700,6 +4701,30 @@ func (bifrost *Bifrost) UpdateToolManagerConfig(maxAgentDepth int, toolExecution
 	return nil
 }
 
+// UpdateCodeModeLimits hot-reloads the per-execution code mode limits. Zero fields
+// use their defaults and nil restores all defaults; invalid limits are rejected by
+// the code mode, which keeps its current limits.
+func (bifrost *Bifrost) UpdateCodeModeLimits(limits *schemas.MCPCodeModeLimits) error {
+	if bifrost.MCPManager == nil {
+		return fmt.Errorf("mcp is not configured in this bifrost instance")
+	}
+	if limits == nil {
+		limits = &schemas.MCPCodeModeLimits{}
+	}
+	if err := limits.Validate(); err != nil {
+		return err
+	}
+	// An optional interface keeps MCPManagerInterface implementations source compatible.
+	updater, ok := bifrost.MCPManager.(interface {
+		UpdateCodeModeLimits(*schemas.MCPCodeModeLimits)
+	})
+	if !ok {
+		return fmt.Errorf("mcp manager does not support code mode limits")
+	}
+	updater.UpdateCodeModeLimits(limits)
+	return nil
+}
+
 // UpdateMCPToolSyncInterval hot-reloads the global MCP tool sync interval and
 // re-times the periodic checkers of every client that follows the global
 // setting. Pass a non-positive interval to fall back to the built-in default.
```

**File**: `core/go.mod` (modified, +1/-1)
```diff
@@ -16,6 +16,7 @@ require (
 	github.com/aws/aws-sdk-go-v2/service/sts v1.41.10
 	github.com/aws/smithy-go v1.27.1
 	github.com/bytedance/sonic v1.15.3-0.20260730064818-2a36d6da63e2
+	github.com/canonical/starlark v0.0.0-20260428155828-9a81051fac39
 	github.com/cespare/xxhash/v2 v2.3.0
 	github.com/fasthttp/websocket v1.5.12
 	github.com/golang-jwt/jwt/v5 v5.3.1
@@ -28,7 +29,6 @@ require (
 	github.com/tidwall/gjson v1.18.0
 	github.com/tidwall/sjson v1.2.5
 	github.com/valyala/fasthttp v1.74.0
-	go.starlark.net v0.0.0-20260102030733-3fee463870c9
 	golang.org/x/net v0.58.0
 	golang.org/x/oauth2 v0.36.0
 	golang.org/x/text v0.41.0
```

**File**: `core/go.sum` (modified, +2/-2)
```diff
@@ -64,6 +64,8 @@ github.com/bytedance/sonic v1.15.3-0.20260730064818-2a36d6da63e2 h1:XTVMfgtmKUmm
 github.com/bytedance/sonic v1.15.3-0.20260730064818-2a36d6da63e2/go.mod h1:8e51yTPdY8M6t+vvGL1c2Y1xL9i+frEeIAQAEl75NUc=
 github.com/bytedance/sonic/loader v0.5.2 h1:0QtP1gevc1OZ6/H8Lb9BRZiCXd1Ftjd3OKuj1T1lBIo=
 github.com/bytedance/sonic/loader v0.5.2/go.mod h1:AR4NYCk5DdzZizZ5djGqQ92eEhCCcdf5x77udYiSJRo=
+github.com/canonical/starlark v0.0.0-20260428155828-9a81051fac39 h1:w+h16FZeT8sn7ASXZX4BtutzUF6keiuBYb/CEKwWfOQ=
+github.com/canonical/starlark v0.0.0-20260428155828-9a81051fac39/go.mod h1:fbhY9i7ZAcza52PfUCd9PDIBFJJMYsAj22/3Q3sU6IY=
 github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UFvs=
 github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
 github.com/cloudwego/base64x v0.1.6 h1:t11wG9AECkCDk5fMSoxmufanudBtJ+/HemLstXDLI2M=
@@ -159,8 +161,6 @@ github.com/xyproto/randomstring v1.0.5 h1:YtlWPoRdgMu3NZtP45drfy1GKoojuR7hmRcnhZ
 github.com/xyproto/randomstring v1.0.5/go.mod h1:rgmS5DeNXLivK7YprL0pY+lTuhNQW3iGxZ18UQApw/E=
 github.com/yosida95/uritemplate/v3 v3.0.2 h1:Ed3Oyj9yrmi9087+NczuL5BwkIc4wvTb5zIM+UJPGz4=
 github.com/yosida95/uritemplate/v3 v3.0.2/go.mod h1:ILOh0sOhIJR3+L/8afwt/kE++YT040gmv5BQTMR2HP4=
-go.starlark.net v0.0.0-20260102030733-3fee463870c9 h1:nV1OyvU+0CYrp5eKfQ3rD03TpFYYhH08z31NK1HmtTk=
-go.starlark.net v0.0.0-20260102030733-3fee463870c9/go.mod h1:YKMCv9b1WrfWmeqdV5MAuEHWsu5iC+fe6kYl2sQjdI8=
 go.yaml.in/yaml/v3 v3.0.5 h1:N6y/pJk8buWs9NY5ERU2HSMfm+IuD/OtfdAnq6kESPw=
 go.yaml.in/yaml/v3 v3.0.5/go.mod h1:HVTZu1O7/Vkt2N+BFy8Zza+lnLsABggaTM2ZpNIGuKg=
 golang.org/x/arch v0.23.0 h1:lKF64A2jF6Zd8L0knGltUnegD62JMFBiCPBmQpToHhg=
```

**File**: `core/internal/mcptests/codemode_basic_test.go` (modified, +46/-0)
```diff
@@ -1,10 +1,13 @@
 package mcptests
 
 import (
+	"context"
 	"encoding/json"
 	"fmt"
 	"testing"
 
+	bifrost "github.com/maximhq/bifrost/core"
+
 	"github.com/maximhq/bifrost/core/schemas"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
@@ -599,3 +602,46 @@ func mustJSONString(s string) string {
 	}
 	return string(b)
 }
+
+// TestCodeMode_LimitsFromConfig pins that code mode limits set in the MCP config
+// reach executions at startup, and that a hot reload replaces them.
+func TestCodeMode_LimitsFromConfig(t *testing.T) {
+	t.Parallel()
+
+	b, err := bifrost.Init(context.Background(), schemas.BifrostConfig{
+		Account: &testAccount{},
+		Logger:  bifrost.NewDefaultLogger(schemas.LogLevelError),
+		MCPConfig: &schemas.MCPConfig{
+			ToolManagerConfig: &schemas.MCPToolManagerConfig{CodeModeLimits: &schemas.MCPCodeModeLimits{MaxSourceBytes: 16}},
+		},
+	})
+	require.NoError(t, err)
+	t.Cleanup(b.Shutdown)
+
+	execute := func() string {
+		call := CreateExecuteToolCodeCall("call-1", "result = 1 + 2 + 3 + 4")
+		msg, bifrostErr := b.ExecuteChatMCPTool(createTestContext(), &call)
+		require.Nil(t, bifrostErr)
+		require.NotNil(t, msg)
+		require.NotNil(t, msg.Content)
+		require.NotNil(t, msg.Content.ContentStr)
+		return *msg.Content.ContentStr
+	}
+
+	assert.Contains(t, execute(), "source limit", "startup limits must apply")
+
+	require.NoError(t, b.UpdateCodeModeLimits(&schemas.MCPCodeModeLimits{MaxSourceBytes: 64}))
+	assert.NotContains(t, execute(), "source limit", "a hot reload must replace the limits")
+
+	require.NoError(t, b.UpdateCodeModeLimits(&schemas.MCPCodeModeLimits{MaxSourceBytes: 8}))
+	assert.Contains(t, execute(), "source limit", "a hot reload must tighten the limits")
+
+	require.NoError(t, b.UpdateToolManagerConfig(schemas.DefaultMaxAgentDepth, 30, string(schemas.CodeModeBindingLevelServer), false, 0, 0))
+	assert.Contains(t, execute(), "source limit", "a tool manager update must not reset the limits")
+
+	require.Error(t, b.UpdateCodeModeLimits(&schemas.MCPCodeModeLimits{MaxSteps: -1}))
+	assert.Contains(t, execute(), "source limit", "rejected limits must leave the current limits in place")
+
+	require.NoError(t, b.UpdateCodeModeLimits(nil))
+	assert.NotContains(t, execute(), "source limit", "nil must restore the defaults")
+}
```

**File**: `core/mcp/codemode.go` (modified, +3/-0)
```diff
@@ -54,6 +54,9 @@ type CodeModeConfig struct {
 
 	// ToolExecutionTimeout is the maximum time allowed for tool execution
 	ToolExecutionTimeout time.Duration
+
+	// Limits bounds each execution; nil keeps the current limits
+	Limits *schemas.MCPCodeModeLimits
 }
 
 // CodeModeDependencies holds the dependencies required by CodeMode implementations.
```

**File**: `core/mcp/codemode/starlark/executecode.go` (modified, +55/-183)
```diff
@@ -9,13 +9,11 @@ import (
 	"time"
 
 	"github.com/bytedance/sonic"
+	"github.com/canonical/starlark/starlark"
 	"github.com/mark3labs/mcp-go/mcp"
 
 	codemcp "github.com/maximhq/bifrost/core/mcp"
 	"github.com/maximhq/bifrost/core/schemas"
-	"go.starlark.net/starlark"
-	"go.starlark.net/starlarkstruct"
-	"go.starlark.net/syntax"
 )
 
 // ExecutionResult represents the result of code execution
@@ -207,195 +205,31 @@ func (s *StarlarkCodeMode) handleExecuteToolCode(ctx *schemas.BifrostContext, to
 
 // executeCode executes Python (Starlark) code in a sandboxed interpreter with MCP tool bindings.
 func (s *StarlarkCodeMode) executeCode(ctx *schemas.BifrostContext, code string) ExecutionResult {
-	logs := []string{}
-
-	s.logger.Debug("%s Starting Starlark code execution", codemcp.CodeModeLogPrefix)
-
-	// Step 1: Handle empty code
-	trimmedCode := strings.TrimSpace(code)
-	if trimmedCode == "" {
-		return ExecutionResult{
-			Result: nil,
-			Logs:   logs,
-			Errors: nil,
-			Environment: ExecutionEnvironment{
-				ServerKeys: []string{},
-			},
-		}
+	limits := s.getLimits()
+	if len(code) > limits.MaxSourceBytes {
+		return sandboxFailure("code exceeds source limit")
 	}
-
-	// Step 2: Build tool bindings for all connected servers
-	availableToolsPerClient := s.clientManager.GetToolPerClient(ctx)
-	serverKeys := make([]string, 0, len(availableToolsPerClient))
-	predeclared := starlark.StringDict{}
-
-	// Thread-safe log appender
-	appendLog := func(msg string) {
-		s.logMu.Lock()
-		defer s.logMu.Unlock()
-		logs = append(logs, msg)
+	code = strings.TrimSpace(code)
+	if code == "" {
+		return ExecutionResult{Logs: []string{}, Environment: ExecutionEnvironment{ServerKeys: []string{}}}
 	}
-
-	s.logger.Debug("%s GetToolPerClient returned %d clients", codemcp.CodeModeLogPrefix, len(availableToolsPerClient))
-
-	for clientName, tools := range availableToolsPerClient {
+	bindings := map[string][]string{}
+	for clientName, tools := range s.clientManager.GetToolPerClient(ctx) {
 		client := s.clientManager.GetClientByName(clientName)
-		if client == nil {
-			s.logger.Warn("%s Client %s not found, skipping", codemcp.CodeModeLogPrefix, clientName)
-			continue
-		}
-		s.logger.Debug("%s [%s] Client found. IsCodeModeClient: %v, ToolCount: %d", codemcp.CodeModeLogPrefix, clientName, client.ExecutionConfig.IsCodeModeClient, len(tools))
-		if !client.ExecutionConfig.IsCodeModeClient || len(tools) == 0 {
-			s.logger.Debug("%s [%s] Skipped: IsCodeModeClient=%v, HasTools=%v", codemcp.CodeModeLogPrefix, clientName, client.ExecutionConfig.IsCodeModeClient, len(tools) > 0)
+		if client == nil || !client.ExecutionConfig.IsCodeModeClient {
 			continue
 		}
-		serverKeys = append(serverKeys, clientName)
-
-		// Build struct with tool methods
-		structMembers := starlark.StringDict{}
-
 		for _, tool := range tools {
-			if tool.Function == nil || tool.Function.Name == "" {
-				continue
-			}
-
-			originalToolName := tool.Function.Name
-			parsedToolName := getCanonicalToolName(clientName, originalToolName)
-			compatibilityAlias := getCompatibilityToolAlias(clientName, originalToolName)
-
-			s.logger.Debug("%s [%s] Binding tool: %s -> %s", codemcp.CodeModeLogPrefix, clientName, originalToolName, parsedToolName)
-
-			// Capture variables for closure
-			capturedToolName := originalToolName
-			capturedClientName := clientName
-
-			// Create a Starlark builtin function for this tool
-			toolFunc := starlark.NewBuiltin(parsedToolName, func(thread *starlark.Thread, fn *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
-				// Convert kwargs to Go map
-				goArgs := make(map[string]interface{})
-				for _, kwarg := range kwargs {
-					if len(kwarg) == 2 {
-						key := string(kwarg[0].(starlark.String))
-						value := starlarkToGo(kwarg[1])
-						goArgs[key] = value
-					}
-				}
-
-				// Also handle positional args if there's exactly one dict argument
-				if len(args) == 1 && len(kwargs) == 0 {
-					if dict, ok := args[0].(*starlark.Dict); ok {
-						for _, item := range dict.Items() {
-							if keyStr, ok := item[0].(starlark.String); ok {
-								goArgs[string(keyStr)] = starlarkToGo(item[1])
-							}
-						}
-					}
-				}
-
-				// Call the MCP tool
-				result, err := s.callMCPTool(ctx, capturedClientName, capturedToolName, goArgs, appendLog)
-				if err != nil {
-					return starlark.None, fmt.Errorf("tool call failed: %v", err)
-				}
-
-				// Convert result back to Starlark
-				return goToStarlark(result), nil
-			})
-
-			structMembers[parsedToolName] = toolFunc
-
-			if compatibilityAlias != parsedToolName && isValidStarlarkIdentifier(compatibilityAlias) {
-				if _, exists := structMembers[compatibilityAlias]; !exists {
-					structMembers[compatibilityAlias] = toolFunc
-					s.logger.Debug("%s [%s] Added compatibility alias: %s -> %s", codemcp.CodeModeLogPrefix, clientName, compatibilityAlias, parsedToolName)
-				}
+			if tool.Function != nil && tool.Functi
```

**File**: `core/mcp/codemode/starlark/sandbox.go` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+//go:build !tinygo && !wasm
+
+package starlark
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"sort"
+	"strings"
+
+	"github.com/canonical/starlark/starlark"
+	"github.com/canonical/starlark/starlarkstruct"
+	"github.com/canonical/starlark/syntax"
+	"github.com/maximhq/bifrost/core/schemas"
+)
+
+// sandboxLimitsKey holds an execution's resolved limits as a thread local, so
+// conversions and tool-result checks deep in a call use the same budget.
+const sandboxLimitsKey = "bifrost.codemode.limits"
+
+// sandboxLimits returns the limits of the execution running on thread, or the
+// defaults for a thread that was not started by runSandbox.
+func sandboxLimits(thread *starlark.Thread) schemas.MCPCodeModeLimits {
+	if thread != nil {
+		if limits, ok := thread.Local(sandboxLimitsKey).(schemas.MCPCodeModeLimits); ok {
+			return limits
+		}
+	}
+	return schemas.MCPCodeModeLimits{}.WithDefaults()
+}
+
+// contextSandboxLimits returns the limits of the execution that owns ctx.
+func contextSandboxLimits(ctx context.Context) schemas.MCPCodeModeLimits {
+	return sandboxLimits(starlark.ContextThread(ctx))
+}
+
+func sandboxFailure(message string) ExecutionResult {
+	return ExecutionResult{Logs: []string{}, Errors: &ExecutionError{Kind: ExecutionErrorTypeRuntime, Message: message}}
+}
+
+type sandboxToolCaller func(context.Context, string, string, map[string]interface{}, func(string)) (interface{}, error)
+
+func newSandboxThread(ctx context.Context, limits schemas.MCPCodeModeLimits) *starlark.Thread {
+	thread := &starlark.Thread{Name: "codemode"}
+	thread.SetParentContext(ctx)
+	thread.SetLocal(sandboxLimitsKey, limits)
+	thread.SetMaxSteps(int64(limits.MaxSteps))
+	thread.SetMaxAllocs(int64(limits.MaxMemoryBytes))
+	thread.RequireSafety(starlark.CPUSafe | starlark.MemSafe | starlark.TimeSafe)
+	return thread
+}
+
+// runSandbox evaluates in-process under limits, which must already have defaults applied. Interpreter operations and Go conversions at
+// tool boundaries share a budget. This is cooperative accounting, not an
+// OS-enforced process memory limit.
+func runSandbox(ctx context.Context, limits schemas.MCPCodeModeLimits, code string, bindings map[string][]string, call sandboxToolCaller) ExecutionResult {
+	if len(code) > limits.MaxSourceBytes {
+		return sandboxFailure("code exceeds source limit")
+	}
+	if err := ctx.Err(); err != nil {
+		return sandboxFailure("code mode execution cancelled: " + err.Error())
+	}
+	thread := newSandboxThread(ctx, limits)
+	defer thread.Cancel("execution completed")
+	logs := []string{}
+	logBytes := 0
+	appendLog := func(line string) {
+		// Charge newlines too: empty print calls must consume the budget.
+		if len(line) >= limits.MaxLogBytes-logBytes {
+			thread.Cancel("code mode log limit exceeded")
+			return
+		}
+		if err := thread.AddAllocs(starlark.SafeInt(len(line) + 32)); err != nil {
+			return
+		}
+		logBytes += len(line) + 1
+		logs = append(logs, line)
+	}
+	thread.Print = func(_ *starlark.Thread, line string) { appendLog(line) }
+	// Tool diagnostics are best effort: a line that no longer fits is dropped,
+	// once noted, instead of cancelling an execution whose tools already ran.
+	toolLogOmitted := false
+	appendToolLog := func(line string) {
+		if len(line) < limits.MaxLogBytes-logBytes {
+			appendLog(line)
+			return
+		}
+		const marker = "[TOOL] further tool logs omitted"
+		if !toolLogOmitted && len(marker) < limits.MaxLogBytes-logBytes {
+			toolLogOmitted = true
+			appendLog(marker)
+		}
+	}
+	predeclared := starlark.StringDict{}
+	servers := make([]string, 0, len(bindings))
+	calls := 0
+	for client, tools := range bindings {
+		members := starlark.StringDict{}
+		for _, tool := range tools {
+			if err := thread.AddAllocs(starlark.SafeInt(512 + len(client) + 3*len(tool))); err != nil {
+				return sandboxFailure(err.Error())
+			}
+			name := getCanonicalToolName(client, tool)
+			fn := starlark.NewBuiltinWithSafety(name, starlark.CPUSafe|starlark.MemSafe|starlark.TimeSafe,
+				func(thread *starlark.Thread, _ *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
+					calls++
+					if calls > limits.MaxToolCalls {
+						return nil, fmt.Errorf("code mode tool call limit exceeded")
+					}
+					converter := newValueConversion(thread)
+					values := map[string]interface{}{}
+					for _, kw := range kwargs {
+						key := string(kw[0].(starlark.String))
+						if err := converter.stringSize(key); err != nil {
+							return nil, err
+						}
+						value, err := converter.toGo(kw[1], 0)
+						if err != nil {
+							return nil, err
+						}
+						values[key] = value
+					}
+					if len(args) == 1 && len(kwargs) == 0 {
+						if dict, ok := args[0].(*starlark.Dict); ok {
+							value, err := converter.toGo(dict, 0)
+							if err != nil {
+								return nil, err
+							}
+							values = value.(map[string]interface{})
+						}
+					}
+					if err := thread.AddSteps(starlark.SafeInt(1)
```

**File**: `core/mcp/codemode/starlark/starlark.go` (modified, +32/-0)
```diff
@@ -21,6 +21,7 @@ type StarlarkCodeMode struct {
 	// Configuration (atomic for thread-safe updates)
 	bindingLevel         atomic.Value // schemas.CodeModeBindingLevel
 	toolExecutionTimeout atomic.Value // time.Duration
+	limits               atomic.Pointer[schemas.MCPCodeModeLimits]
 
 	// Dependencies
 	clientManager         mcp.ClientManager
@@ -69,6 +70,7 @@ func NewStarlarkCodeMode(config *mcp.CodeModeConfig, logger schemas.Logger) *Sta
 	// Initialize atomic values
 	s.bindingLevel.Store(config.BindingLevel)
 	s.toolExecutionTimeout.Store(config.ToolExecutionTimeout)
+	s.storeLimits(config.Limits)
 
 	s.logger.Info("%s Starlark code mode initialized with binding level: %s, timeout: %v",
 		mcp.CodeModeLogPrefix, config.BindingLevel, config.ToolExecutionTimeout)
@@ -157,10 +159,40 @@ func (s *StarlarkCodeMode) UpdateConfig(config *mcp.CodeModeConfig) {
 		s.toolExecutionTimeout.Store(config.ToolExecutionTimeout)
 	}
 
+	if config.Limits != nil {
+		s.storeLimits(config.Limits)
+	}
+
 	s.logger.Info("%s Starlark code mode configuration updated: binding level=%s, timeout=%v",
 		mcp.CodeModeLogPrefix, config.BindingLevel, config.ToolExecutionTimeout)
 }
 
+// storeLimits publishes limits with defaults applied; nil means all defaults.
+// Invalid limits are rejected and the current limits (or the defaults) stay.
+func (s *StarlarkCodeMode) storeLimits(limits *schemas.MCPCodeModeLimits) {
+	resolved := schemas.MCPCodeModeLimits{}
+	if limits != nil {
+		if err := limits.Validate(); err != nil {
+			s.logger.Warn("%s ignoring invalid code mode limits: %v", mcp.CodeModeLogPrefix, err)
+			if s.limits.Load() != nil {
+				return
+			}
+		} else {
+			resolved = *limits
+		}
+	}
+	resolved = resolved.WithDefaults()
+	s.limits.Store(&resolved)
+}
+
+// getLimits returns the per-execution limits with defaults applied.
+func (s *StarlarkCodeMode) getLimits() schemas.MCPCodeModeLimits {
+	if limits := s.limits.Load(); limits != nil {
+		return *limits
+	}
+	return schemas.MCPCodeModeLimits{}.WithDefaults()
+}
+
 // getToolExecutionTimeout returns the current tool execution timeout.
 func (s *StarlarkCodeMode) getToolExecutionTimeout() time.Duration {
 	val := s.toolExecutionTimeout.Load()
```

---

### Incident Patch 12: `24c04a63` (2026-10-05)
**Commit Message**: feat: build the HTTP client factory in OSS and route webhooks, skills and plugin downloads through it (#7574)

## Summary

Webhooks, skill fetches, and plugin downloads previously built their own `http.Transport` instances with no proxy awareness, so on deployments where egress is only available through the global proxy, all of these outbound calls failed even when the API proxy toggle was enabled. This PR routes all three through a shared `HTTPClientFactory` that honours the global proxy for API traffic while preserving each caller's SSRF policy.

## Changes

- **`SSRFHTTPClient` replaced by `PolicyTransport`**: The factory no longer returns a fully configured `http.Client` for SSRF-protected callers. Instead, `PolicyTransport` returns an `http.RoundTripper` so callers own their own `http.Client` (and therefore their own redirect rules and timeouts). The `DialPolicy` type encapsulates the two halves of SSRF enforcement — a safe dialer for direct connections and a target-check function for proxied hops — and is constructed once per caller via `SSRFPolicy`, `SSRFPolicyWithDialTimeout`, or `NewDialPolicy`.

- **`targetCheckingTransport` decoupled from DNS logic**: The inline DNS reso

**File**: `core/network/http.go` (modified, +89/-41)
```diff
@@ -79,7 +79,7 @@ type GlobalProxyConfig struct {
 // proxy enablement (SCIM, Inference, API).
 //
 // Clients handed out are live: GetFasthttpClient, GetHTTPClient, HTTPClientWithTLS
-// and SSRFHTTPClient return the same object for the life of the factory, and every
+// and PolicyTransport return the same object for the life of the factory, and every
 // request made through it runs on an inner client built for the proxy config current
 // at that moment. UpdateProxyConfig therefore reaches every caller, including ones
 // that stored the client when they were created, without anyone rebuilding anything.
@@ -220,8 +220,7 @@ func shouldBypassProxy(host, pattern string) bool {
 type httpClientKey struct {
 	purpose ClientPurpose
 	tls     *tls.Config // HTTPClientWithTLS: the caller's TLS settings
-	ssrf    bool        // SSRFHTTPClient
-	allow   *Allowlist  // SSRFHTTPClient: hosts permitted past the SSRF check
+	policy  *DialPolicy // PolicyTransport: which targets may be reached
 }
 
 // GetFasthttpClient returns the live fasthttp client for purpose. The same client is
@@ -299,16 +298,44 @@ func (f *HTTPClientFactory) HTTPClientWithTLS(purpose ClientPurpose, tlsConfig *
 	return f.liveHTTPClient(httpClientKey{purpose: purpose, tls: tlsConfig})
 }
 
-// SSRFHTTPClient returns a live net/http client for fetching user-controlled URLs
-// (webhooks, skills, plugin downloads) that honours the global proxy for purpose
-// without weakening the SSRF check. Direct connections go through
-// SSRFSafeDialContextWithAllowlist. Proxied requests dial only the proxy's own
-// address unchecked, and the target of every hop, redirects included, is refused
-// unless it resolves to public addresses or is permitted by allow (see
-// NewTargetCheckingTransport for the DNS caveat). Redirects are limited to http and
-// https, at most 10. allow may be nil.
-func (f *HTTPClientFactory) SSRFHTTPClient(purpose ClientPurpose, allow *Allowlist) *http.Client {
-	return f.liveHTTPClient(httpClientKey{purpose: purpose, ssrf: true, allow: allow})
+// DialPolicy decides which targets a client may reach, for callers that fetch
+// user-controlled URLs (webhooks, skills, plugin downloads). Build one with SSRFPolicy
+// or NewDialPolicy, once per caller: the factory keeps one transport per policy pointer.
+type DialPolicy struct {
+	dial          func(ctx context.Context, netw, addr string) (net.Conn, error)
+	resolveTarget func(ctx context.Context, host string) ([]net.IP, error)
+}
+
+// NewDialPolicy returns a policy that connects directly with dial, and judges the
+// target host of every proxied hop with resolveTarget, which returns the addresses
+// it checked or an error to refuse the target.
+func NewDialPolicy(dial func(ctx context.Context, netw, addr string) (net.Conn, error), resolveTarget func(ctx context.Context, host string) ([]net.IP, error)) *DialPolicy {
+	return &DialPolicy{dial: dial, resolveTarget: resolveTarget}
+}
+
+// SSRFPolicy is the standard policy for user-controlled URLs: public targets only,
+// plus the hosts in allow (nil permits none). Direct connections go through
+// SSRFSafeDialContextWithAllowlist, which checks every resolved address at dial time;
+// dial time is bounded by the request context.
+func SSRFPolicy(allow *Allowlist) *DialPolicy {
+	return SSRFPolicyWithDialTimeout(0, allow)
+}
+
+// SSRFPolicyWithDialTimeout is SSRFPolicy with each direct dial also bounded by
+// dialTimeout (0 leaves it to the request context).
+func SSRFPolicyWithDialTimeout(dialTimeout time.Duration, allow *Allowlist) *DialPolicy {
+	return NewDialPolicy(SSRFSafeDialContextWithAllowlist(dialTimeout, allow), publicTargetCheck(net.DefaultResolver, allow))
+}
+
+// PolicyTransport returns a live RoundTripper that honours the global proxy for purpose
+// while enforcing policy. Direct connections, including no_proxy matches, use the
+// policy's dialer. A proxied connection is a tunnel opened to an address the policy
+// checked (see policyProxyDial), so the proxy never resolves the target itself. Each
+// redirect hop dials again and is judged the same way. The caller keeps its own
+// http.Client for timeouts and redirect rules: the transport adds no timeout of its
+// own and requires TLS 1.2 or later.
+func (f *HTTPClientFactory) PolicyTransport(purpose ClientPurpose, policy *DialPolicy) http.RoundTripper {
+	return f.liveHTTPClient(httpClientKey{purpose: purpose, policy: policy}).Transport
 }
 
 // liveHTTPClient returns the live client for key, creating it on first use.
@@ -326,17 +353,6 @@ func (f *HTTPClientFactory) liveHTTPClient(key httpClientKey) *http.Client {
 		return client
 	}
 	client = &http.Client{Transport: &liveHTTPTransport{factory: f, key: key}}
-	if key.ssrf {
-		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
-			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
-				return fmt.Errorf("blocked redirect to unsupported scheme %q", req.URL.Scheme)
-			}
-			if len(
```

**File**: `core/network/http_test.go` (modified, +53/-1)
```diff
@@ -736,7 +736,7 @@ func sendFactoryMatrixRequest(t *testing.T, factory *HTTPClientFactory, purpose
 		case "tls":
 			client = factory.HTTPClientWithTLS(purpose, factoryMatrixTLS)
 		case "ssrf":
-			client = factory.SSRFHTTPClient(purpose, nil)
+			client = &http.Client{Transport: factory.PolicyTransport(purpose, factoryMatrixSSRFPolicy)}
 		}
 		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
 		resp, err := client.Do(req)
@@ -749,6 +749,9 @@ func sendFactoryMatrixRequest(t *testing.T, factory *HTTPClientFactory, purpose
 	return nil
 }
 
+// factoryMatrixSSRFPolicy is the policy the "ssrf" client kind enforces.
+var factoryMatrixSSRFPolicy = SSRFPolicy(nil)
+
 // factoryMatrixTLS stands in for a caller's own TLS settings (HTTPClientWithTLS).
 var factoryMatrixTLS = &tls.Config{MinVersion: tls.VersionTLS12, ServerName: "custom.example"}
 
@@ -944,3 +947,52 @@ func (noopTestLogger) SetOutputType(schemas.LoggerOutputType) {}
 func (noopTestLogger) LogHTTPRequest(schemas.LogLevel, string) schemas.LogEventBuilder {
 	return schemas.NoopLogEvent
 }
+
+// TestPolicyTransport_ProxiedTunnelIsBoundToTheCheckedAddress pins that a proxied
+// request from a policy transport reaches the proxy as a tunnel to the address the
+// policy checked, never as the hostname. The proxy would otherwise resolve the name
+// again, and a DNS answer that changed after the check (rebinding) would let a target
+// that passed as public reach an internal one. Plain http:// targets are tunneled too,
+// so no request leaves bound only to a name.
+func TestPolicyTransport_ProxiedTunnelIsBoundToTheCheckedAddress(t *testing.T) {
+	set := proxytest.NewSet(t)
+	factory := NewHTTPClientFactory(&GlobalProxyConfig{
+		Enabled:      true,
+		Type:         GlobalProxyTypeHTTP,
+		URL:          "http://127.0.0.1:" + set.Config.Port(),
+		EnableForAPI: true,
+	}, noopTestLogger{})
+	resolver := hostResolver{
+		"rebind.example":   {net.ParseIP("203.0.113.10")},
+		"internal.example": {net.ParseIP("10.0.0.5")},
+	}
+	policy := NewDialPolicy(SSRFSafeDialContext(0), publicTargetCheck(resolver, nil))
+	client := &http.Client{Transport: factory.PolicyTransport(ClientPurposeAPI, policy)}
+
+	for _, tc := range []struct {
+		url, want string
+	}{
+		{"https://rebind.example/hook", "203.0.113.10:443"},
+		{"http://rebind.example/hook", "203.0.113.10:80"},
+	} {
+		t.Run(tc.url, func(t *testing.T) {
+			set.Reset()
+			ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
+			defer cancel()
+			req, _ := http.NewRequestWithContext(ctx, http.MethodGet, tc.url, nil)
+			if resp, err := client.Do(req); err == nil {
+				resp.Body.Close()
+			}
+			proxytest.AssertRoute(t, set, proxytest.Route{Proxy: "config"}, tc.want, nil)
+		})
+	}
+
+	t.Run("a target resolving to a private address never reaches the proxy", func(t *testing.T) {
+		set.Reset()
+		_, err := client.Get("https://internal.example/hook")
+		if err == nil || !strings.Contains(err.Error(), "non-public address") {
+			t.Fatalf("expected the policy to refuse the target, got %v", err)
+		}
+		proxytest.AssertRoute(t, set, proxytest.Direct, "", nil)
+	})
+}
```

**File**: `core/network/ssrf.go` (modified, +23/-43)
```diff
@@ -204,52 +204,32 @@ func ssrfSafeDialContext(resolver ipLookuper, dial func(ctx context.Context, net
 	}
 }
 
-// NewTargetCheckingTransport wraps next so a request whose target host resolves to
-// any non-public address is refused before it is sent. It is for fetching
-// user-controlled URLs through a proxy: once the dial goes to the proxy rather than
-// the target, SSRFSafeDialContext can no longer see the target, so the check moves
-// here. http.Client calls RoundTrip once per redirect hop, so redirects are judged
-// the same way as the original request.
-//
-// The proxy resolves the target again on its own, so a DNS answer that changes
-// between this check and the proxy's lookup is not caught. Past that point the
-// proxy's egress policy governs, as for any other traffic routed through it. The
-// check also needs the target to resolve locally: on a host with no external DNS,
-// proxied fetches are refused rather than sent unchecked.
-func NewTargetCheckingTransport(next http.RoundTripper) http.RoundTripper {
-	return &targetCheckingTransport{resolver: net.DefaultResolver, next: next}
-}
-
-// targetCheckingTransport is the RoundTripper behind NewTargetCheckingTransport,
-// with an injectable resolver for tests.
-type targetCheckingTransport struct {
-	resolver ipLookuper
-	allow    *Allowlist // hosts permitted past the check; nil permits none
-	next     http.RoundTripper
+// ResolvePublicTarget resolves host and returns its addresses when every one is public,
+// or an error naming the first that is not. It is the check for a user-controlled URL
+// fetched through a proxy: the caller tunnels to one of the returned addresses, so the
+// proxy never resolves the name again. It needs the target to resolve locally: on a
+// host with no external DNS, proxied fetches are refused rather than sent unchecked.
+func ResolvePublicTarget(ctx context.Context, host string) ([]net.IP, error) {
+	return publicTargetCheck(net.DefaultResolver, nil)(ctx, host)
 }
 
-func (t *targetCheckingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
-	host := req.URL.Hostname()
-	ips, err := t.resolver.LookupIP(req.Context(), "ip", host)
-	if err != nil {
-		return nil, fmt.Errorf("DNS lookup failed for %s: %w", host, err)
-	}
-	if len(ips) == 0 {
-		return nil, fmt.Errorf("DNS lookup for %s returned no addresses", host)
-	}
-	for _, ip := range ips {
-		if !IsPublicIP(ip) && !t.allow.Permits(host, ip) {
-			return nil, fmt.Errorf("blocked connection to non-public address %s (host %s)", ip, host)
+// publicTargetCheck resolves host and refuses it unless every address is public or
+// permitted by allow (nil permits none). It returns the checked addresses.
+func publicTargetCheck(resolver ipLookuper, allow *Allowlist) func(ctx context.Context, host string) ([]net.IP, error) {
+	return func(ctx context.Context, host string) ([]net.IP, error) {
+		ips, err := resolver.LookupIP(ctx, "ip", host)
+		if err != nil {
+			return nil, fmt.Errorf("DNS lookup failed for %s: %w", host, err)
 		}
-	}
-	return t.next.RoundTrip(req)
-}
-
-// CloseIdleConnections lets http.Client.CloseIdleConnections reach the wrapped
-// transport's pool.
-func (t *targetCheckingTransport) CloseIdleConnections() {
-	if closer, ok := t.next.(interface{ CloseIdleConnections() }); ok {
-		closer.CloseIdleConnections()
+		if len(ips) == 0 {
+			return nil, fmt.Errorf("DNS lookup for %s returned no addresses", host)
+		}
+		for _, ip := range ips {
+			if !IsPublicIP(ip) && !allow.Permits(host, ip) {
+				return nil, fmt.Errorf("blocked connection to non-public address %s (host %s)", ip, host)
+			}
+		}
+		return ips, nil
 	}
 }
 
```

**File**: `core/network/ssrf_test.go` (modified, +18/-44)
```diff
@@ -9,7 +9,6 @@ import (
 	"net/http/httptest"
 	"net/url"
 	"strings"
-	"sync/atomic"
 	"testing"
 	"time"
 )
@@ -879,62 +878,37 @@ func (h hostResolver) LookupIP(_ context.Context, _, host string) ([]net.IP, err
 	return nil, errors.New("no such host")
 }
 
-// roundTripFunc adapts a function to http.RoundTripper.
-type roundTripFunc func(*http.Request) (*http.Response, error)
-
-func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }
-
-func TestTargetCheckingTransport_PublicTargetReachesNext(t *testing.T) {
-	var called atomic.Int32
-	rt := &targetCheckingTransport{
-		resolver: hostResolver{"files.example": {net.ParseIP("203.0.113.10")}},
-		next: roundTripFunc(func(req *http.Request) (*http.Response, error) {
-			called.Add(1)
-			return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody, Request: req}, nil
-		}),
-	}
-	resp, err := (&http.Client{Transport: rt}).Get("http://files.example/doc.pdf")
+func TestPublicTargetCheck_PublicTargetReturnsItsAddresses(t *testing.T) {
+	ips, err := publicTargetCheck(hostResolver{"files.example": {net.ParseIP("203.0.113.10")}}, nil)(context.Background(), "files.example")
 	if err != nil {
 		t.Fatalf("public target refused: %v", err)
 	}
-	resp.Body.Close()
-	if called.Load() != 1 {
-		t.Fatalf("next transport called %d times, want 1", called.Load())
+	if len(ips) != 1 || !ips[0].Equal(net.ParseIP("203.0.113.10")) {
+		t.Fatalf("checked addresses = %v, want [203.0.113.10]: the caller tunnels to these", ips)
 	}
 }
 
-func TestTargetCheckingTransport_RefusesNonPublicTargets(t *testing.T) {
+func TestPublicTargetCheck_RefusesNonPublicTargets(t *testing.T) {
 	tests := map[string]hostResolver{
 		// One public and one private record: the private one blocks, as on the direct path.
-		"http://internal.example/": {"internal.example": {net.ParseIP("203.0.113.10"), net.ParseIP("10.0.0.5")}},
-		"http://127.0.0.1:8080/":   {},
-		"http://169.254.169.254/":  {},
-		"http://[fd00:ec2::254]/":  {},
-	}
-	for target, resolver := range tests {
-		rt := &targetCheckingTransport{
-			resolver: resolver,
-			next: roundTripFunc(func(*http.Request) (*http.Response, error) {
-				t.Errorf("%s: a refused target must never reach the next transport", target)
-				return nil, errors.New("unreachable")
-			}),
-		}
-		_, err := (&http.Client{Transport: rt}).Get(target)
+		"internal.example": {"internal.example": {net.ParseIP("203.0.113.10"), net.ParseIP("10.0.0.5")}},
+		"127.0.0.1":        {},
+		"169.254.169.254":  {},
+		"fd00:ec2::254":    {},
+	}
+	for host, resolver := range tests {
+		ips, err := publicTargetCheck(resolver, nil)(context.Background(), host)
 		if err == nil || !strings.Contains(err.Error(), "blocked connection to non-public address") {
-			t.Errorf("%s: expected a non-public address error, got %v", target, err)
+			t.Errorf("%s: expected a non-public address error, got %v", host, err)
+		}
+		if ips != nil {
+			t.Errorf("%s: a refused target must return no addresses to dial, got %v", host, ips)
 		}
 	}
 }
 
-func TestTargetCheckingTransport_UnresolvableTargetIsRefused(t *testing.T) {
-	rt := &targetCheckingTransport{
-		resolver: hostResolver{},
-		next: roundTripFunc(func(*http.Request) (*http.Response, error) {
-			t.Error("an unresolvable target must not be sent unchecked")
-			return nil, errors.New("unreachable")
-		}),
-	}
-	_, err := (&http.Client{Transport: rt}).Get("http://only-the-proxy-knows.example/")
+func TestPublicTargetCheck_UnresolvableTargetIsRefused(t *testing.T) {
+	_, err := publicTargetCheck(hostResolver{}, nil)(context.Background(), "only-the-proxy-knows.example")
 	if err == nil || !strings.Contains(err.Error(), "DNS lookup failed") {
 		t.Fatalf("expected a DNS failure, got %v", err)
 	}
```

**File**: `core/providers/utils/fetch.go` (modified, +68/-15)
```diff
@@ -17,6 +17,7 @@ import (
 	"github.com/maximhq/bifrost/core/network"
 	"github.com/maximhq/bifrost/core/schemas"
 	"github.com/valyala/fasthttp"
+	"golang.org/x/net/http/httpproxy"
 )
 
 // RedactURLForError reduces a resource URL to the part that is safe to echo back in an
@@ -73,10 +74,9 @@ func sanitizeFetchError(err error, redacted string) error {
 // Proxy: when ctx carries the serving provider's proxy config
 // (schemas.BifrostContextKeyProviderProxyConfig, set by bifrost on every attempt),
 // the fetch leaves through that proxy, the same egress as the provider's inference
-// traffic. The target host is still refused if it resolves to a non-public address;
-// see newFetchClient and network.NewTargetCheckingTransport for how the check works
-// once the dial goes to a proxy. With no proxy configured the fetch connects
-// directly, as before.
+// traffic. The target host is still refused if it resolves to a non-public address,
+// and the tunnel is opened to the checked address rather than the hostname; see
+// newFetchClient. With no proxy configured the fetch connects directly, as before.
 func FetchAndEncodeURL(ctx context.Context, resourceURL string) (mediaType string, encoded string, err error) {
 	const maxBytes = maxFetchBytes
 
@@ -161,9 +161,42 @@ func fetchClientFor(ctx context.Context) (*http.Client, error) {
 // Direct connections, including targets the proxy is told to skip (errBypassProxy),
 // go through network.SSRFSafeDialContext, which checks the resolved target on every
 // dial. Once a request is proxied the dial goes to the proxy, which is operator
-// configuration and may well be on a private address, so it is not checked; the
-// target is judged instead by network.NewTargetCheckingTransport before every hop.
-// See NewTargetCheckingTransport for the DNS caveat that leaves.
+// configuration and may well be on a private address, so it is not checked. The
+// target is resolved and checked first (fetchResolveTarget), and the proxy is asked
+// for a tunnel to one of the checked addresses, never the hostname: the proxy cannot
+// resolve the name to somewhere else after the check. Redirect hops dial again and
+// are checked the same way. The bypass decision (no_proxy, NO_PROXY) is still made on
+// the hostname, before the address is pinned.
+// proxyBypassFunc reports whether a fetch to host:port skips proxyConfig's proxy, the
+// way ConfigureProxy's dialer decides it: a no_proxy match, or for the environment
+// proxy, NO_PROXY or no variable set for the port's scheme (443 is https, anything else
+// http, as envProxyDialFunc chooses).
+func proxyBypassFunc(proxyConfig *schemas.ProxyConfig) func(host, port string) bool {
+	noProxy := proxyConfig.NoProxy
+	var envProxy func(*url.URL) (*url.URL, error)
+	if proxyConfig.Type == schemas.EnvProxy {
+		envProxy = httpproxy.FromEnvironment().ProxyFunc()
+	}
+	return func(host, port string) bool {
+		if noProxy != "" && network.MatchesNoProxy(host, noProxy) {
+			return true
+		}
+		if envProxy == nil {
+			return false
+		}
+		scheme := "http"
+		if port == "443" {
+			scheme = "https"
+		}
+		proxyURL, err := envProxy(&url.URL{Scheme: scheme, Host: net.JoinHostPort(host, port)})
+		return err == nil && proxyURL == nil
+	}
+}
+
+// fetchResolveTarget resolves and checks a proxied fetch target. A variable so tests
+// can stand in for DNS.
+var fetchResolveTarget = network.ResolvePublicTarget
+
 func newFetchClient(proxyConfig *schemas.ProxyConfig) *http.Client {
 	ssrfDial := network.SSRFSafeDialContext(10 * time.Second)
 	direct := func(addr string) (net.Conn, error) {
@@ -181,12 +214,36 @@ func newFetchClient(proxyConfig *schemas.ProxyConfig) *http.Client {
 		client = ConfigureProxy(client, proxyConfig, getLogger())
 		if proxyDial := client.Dial; proxyDial != nil {
 			proxied = true
+			bypass := proxyBypassFunc(proxyConfig)
 			client.Dial = func(addr string) (net.Conn, error) {
-				conn, err := proxyDial(addr)
-				if errors.Is(err, errBypassProxy) {
+				host, port, err := net.SplitHostPort(addr)
+				if err != nil {
+					return nil, err
+				}
+				if bypass(host, port) {
 					return direct(addr)
 				}
-				return conn, err
+				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
+				defer cancel()
+				ips, err := fetchResolveTarget(ctx, host)
+				if err != nil {
+					return nil, err
+				}
+				var lastErr error
+				for _, ip := range ips {
+					pinned := net.JoinHostPort(ip.String(), port)
+					conn, err := proxyDial(pinned)
+					if errors.Is(err, errBypassProxy) {
+						// no_proxy names the address (a CIDR entry): connect directly,
+						// still through the SSRF dialer.
+						conn, err = direct(pinned)
+					}
+					if err == nil {
+						return conn, nil
+					}
+					lastErr = err
+				}
+				return nil, lastErr
 			}
 		}
 	}
@@ -195,13 +252,9 @@ func newFetchClient(proxyConfig *schemas.ProxyConfig) *http.Client {
 	}
 	client.Transport = NewContextTransport()
 
-	var transp
```

**File**: `core/providers/utils/fetch_test.go` (modified, +43/-0)
```diff
@@ -4,9 +4,12 @@ import (
 	"context"
 	"encoding/base64"
 	"errors"
+	"fmt"
+	"net"
 	"net/http"
 	"net/url"
 	"strings"
+	"sync"
 	"sync/atomic"
 	"testing"
 	"time"
@@ -311,3 +314,43 @@ func TestFetchAndEncodeURL_ProxiedHostnameTargetNeedsLocalDNS(t *testing.T) {
 		t.Fatalf("an unchecked target reached the proxy %d times", hits.Load())
 	}
 }
+
+// TestFetchAndEncodeURL_ProxiedTunnelIsBoundToTheCheckedAddress pins that a proxied
+// fetch opens its tunnel to the address the SSRF check approved, not to the hostname.
+// The proxy would otherwise resolve the name itself, so a DNS answer that changed after
+// the check could send the fetch to an internal address.
+func TestFetchAndEncodeURL_ProxiedTunnelIsBoundToTheCheckedAddress(t *testing.T) {
+	prev := fetchResolveTarget
+	fetchResolveTarget = func(_ context.Context, host string) ([]net.IP, error) {
+		if host == "pinned.example" {
+			return []net.IP{net.ParseIP("203.0.113.10")}, nil
+		}
+		return nil, fmt.Errorf("DNS lookup failed for %s", host)
+	}
+	t.Cleanup(func() { fetchResolveTarget = prev })
+
+	var targets []string
+	var mu sync.Mutex
+	proxy := proxytest.ForwardProxy(t, func(w http.ResponseWriter, r *http.Request) {
+		mu.Lock()
+		targets = append(targets, r.URL.Host)
+		mu.Unlock()
+		w.Header().Set("Content-Type", "image/png")
+		_, _ = w.Write([]byte("PNGDATA"))
+	})
+	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
+	defer cancel()
+	ctx = context.WithValue(ctx, schemas.BifrostContextKeyProviderProxyConfig, &schemas.ProxyConfig{
+		Type: schemas.HTTPProxy,
+		URL:  schemas.NewSecretVar(proxy.URL),
+	})
+
+	if _, _, err := FetchAndEncodeURL(ctx, "http://pinned.example/img.png"); err != nil {
+		t.Fatalf("fetch through proxy failed: %v", err)
+	}
+	mu.Lock()
+	defer mu.Unlock()
+	if len(targets) != 1 || targets[0] != "203.0.113.10" {
+		t.Fatalf("proxy was asked for %v, want exactly the checked address [203.0.113.10]", targets)
+	}
+}
```

**File**: `framework/configstore/tables/config.go` (modified, +21/-0)
```diff
@@ -92,6 +92,27 @@ type GlobalProxyConfig struct {
 	EnableForAPI       bool `json:"enable_for_api"`       // Enable proxy for API requests
 }
 
+// ToNetwork converts the stored global proxy config into the form the HTTP client
+// factory takes. nil stays nil.
+func (c *GlobalProxyConfig) ToNetwork() *network.GlobalProxyConfig {
+	if c == nil {
+		return nil
+	}
+	return &network.GlobalProxyConfig{
+		Enabled:            c.Enabled,
+		Type:               c.Type,
+		URL:                c.URL,
+		Username:           c.Username,
+		Password:           c.Password,
+		NoProxy:            c.NoProxy,
+		Timeout:            c.Timeout,
+		SkipTLSVerify:      c.SkipTLSVerify,
+		EnableForSCIM:      c.EnableForSCIM,
+		EnableForInference: c.EnableForInference,
+		EnableForAPI:       c.EnableForAPI,
+	}
+}
+
 // GlobalHeaderFilterConfig represents global header filtering configuration
 // for headers forwarded to LLM providers via the x-bf-eh-* prefix.
 // Filter logic:
```

**File**: `framework/configstore/tables/config_test.go` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+package tables
+
+import (
+	"reflect"
+	"testing"
+
+	"github.com/maximhq/bifrost/core/network"
+)
+
+// TestGlobalProxyConfigToNetwork pins that every stored field reaches the HTTP client
+// factory. A field added to one struct and not the other would silently drop a setting.
+func TestGlobalProxyConfigToNetwork(t *testing.T) {
+	if (*GlobalProxyConfig)(nil).ToNetwork() != nil {
+		t.Error("nil must convert to nil")
+	}
+	stored := GlobalProxyConfig{
+		Enabled:            true,
+		Type:               network.GlobalProxyTypeSOCKS5,
+		URL:                "socks5://10.0.0.9:1080",
+		Username:           "svc",
+		Password:           "s3cret",
+		NoProxy:            ".internal",
+		Timeout:            7,
+		SkipTLSVerify:      true,
+		EnableForSCIM:      true,
+		EnableForInference: true,
+		EnableForAPI:       true,
+	}
+	got := stored.ToNetwork()
+	want := &network.GlobalProxyConfig{
+		Enabled:            true,
+		Type:               network.GlobalProxyTypeSOCKS5,
+		URL:                "socks5://10.0.0.9:1080",
+		Username:           "svc",
+		Password:           "s3cret",
+		NoProxy:            ".internal",
+		Timeout:            7,
+		SkipTLSVerify:      true,
+		EnableForSCIM:      true,
+		EnableForInference: true,
+		EnableForAPI:       true,
+	}
+	if !reflect.DeepEqual(got, want) {
+		t.Errorf("ToNetwork() = %+v, want %+v", got, want)
+	}
+	if n, m := reflect.TypeOf(GlobalProxyConfig{}).NumField(), reflect.TypeOf(network.GlobalProxyConfig{}).NumField(); n != m {
+		t.Errorf("GlobalProxyConfig has %d fields, network.GlobalProxyConfig has %d: update ToNetwork", n, m)
+	}
+}
```

---

### Incident Patch 13: `7e343d87` (2026-10-05)
**Commit Message**: fix(core): dial proxies dual-stack so IPv6 proxies work (#7569)

## Summary

Proxy dialers in the fasthttp layer were using the non-dual-stack variants of the `fasthttpproxy` constructors, which dial the proxy over `tcp4` only. This caused connections to fail with "couldn't find dns entries" when a proxy was specified as an IPv6 literal address or a hostname that resolves only to AAAA records. This PR switches all fasthttp proxy dialers to their dual-stack equivalents so that IPv6 proxy addresses work correctly across all proxy types and client factories.

## Changes

- Replaced `fasthttpproxy.FasthttpHTTPDialer` with `fasthttpproxy.FasthttpHTTPDialerDualStack` in both `core/network/http.go` and `core/providers/utils/utils.go`.
- Replaced `fasthttpproxy.FasthttpSocksDialer` with `fasthttpproxy.FasthttpSocksDialerDualStack` in both files.
- Replaced `fasthttpproxy.FasthttpProxyHTTPDialer()` with a new `envProxyDialFunc()` helper that constructs a `fasthttpproxy.Dialer` with `DialDualStack: true`, preserving the existing behaviour of reading proxy environment variables at client build time.
- Added a test in `core/network/http_test.go` that binds a proxy to the IPv6 loopback, dials t

**File**: `core/network/http.go` (modified, +2/-2)
```diff
@@ -358,9 +358,9 @@ func (f *HTTPClientFactory) configureFasthttpProxy(client *fasthttp.Client) {
 
 	switch f.proxyConfig.Type {
 	case GlobalProxyTypeHTTP:
-		dialFunc = fasthttpproxy.FasthttpHTTPDialer(proxyURL)
+		dialFunc = fasthttpproxy.FasthttpHTTPDialerDualStack(proxyURL)
 	case GlobalProxyTypeSOCKS5:
-		dialFunc = fasthttpproxy.FasthttpSocksDialer(proxyURL)
+		dialFunc = fasthttpproxy.FasthttpSocksDialerDualStack(proxyURL)
 	}
 
 	proxyCfg := f.proxyConfig
```

**File**: `core/network/http_test.go` (modified, +52/-0)
```diff
@@ -574,3 +574,55 @@ func TestCreateFasthttpClientPoolSettings(t *testing.T) {
 		t.Errorf("MaxConnsPerHost = %d, want %d", client.MaxConnsPerHost, DefaultClientConfig.MaxConnsPerHost)
 	}
 }
+
+// TestFactoryFasthttpProxyReachesIPv6ProxyAndHonoursNoProxyList pins two things on the
+// factory's fasthttp proxy dialer (SCIM, guardrails and other API clients):
+//   - a proxy given as an IPv6 literal is reachable. The non-DualStack fasthttpproxy
+//     constructors dial the proxy over tcp4 only and fail with "couldn't find dns entries".
+//   - every entry of a comma-separated no_proxy list is honoured, not just a
+//     single-entry list.
+func TestFactoryFasthttpProxyReachesIPv6ProxyAndHonoursNoProxyList(t *testing.T) {
+	listener, err := net.Listen("tcp6", "[::1]:0")
+	if err != nil {
+		t.Fatalf("listen on IPv6 loopback: %v", err)
+	}
+	var mu sync.Mutex
+	var targets []string
+	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		mu.Lock()
+		targets = append(targets, r.Host)
+		mu.Unlock()
+		if conn, _, err := w.(http.Hijacker).Hijack(); err == nil {
+			_, _ = conn.Write([]byte("HTTP/1.1 200 Connection established\r\n\r\n"))
+			conn.Close()
+		}
+	})}
+	go func() { _ = server.Serve(listener) }()
+	defer server.Close()
+	_, port, _ := net.SplitHostPort(listener.Addr().String())
+
+	factory := NewHTTPClientFactory(&GlobalProxyConfig{
+		Enabled:      true,
+		Type:         GlobalProxyTypeHTTP,
+		URL:          "http://[::1]:" + port,
+		NoProxy:      "other.test, bypass.bifrost.test",
+		EnableForAPI: true,
+	}, nil)
+	client := factory.GetFasthttpClient(ClientPurposeAPI)
+
+	conn, err := client.Dial("api.bifrost.test:443")
+	if err != nil {
+		t.Fatalf("dial through the IPv6 proxy failed: %v", err)
+	}
+	conn.Close()
+
+	// The second no_proxy entry must bypass the proxy. The direct dial to a .test
+	// name has nowhere to go, so only the proxy's log tells the two apart.
+	_, _ = client.Dial("bypass.bifrost.test:443")
+
+	mu.Lock()
+	defer mu.Unlock()
+	if len(targets) != 1 || targets[0] != "api.bifrost.test:443" {
+		t.Fatalf("proxy saw %v, want exactly [api.bifrost.test:443]", targets)
+	}
+}
```

**File**: `core/providers/utils/proxy_test.go` (modified, +27/-12)
```diff
@@ -544,21 +544,25 @@ func readSOCKS5Connect(conn net.Conn) (string, bool) {
 
 // proxyMatrixProxies are the recording proxies one matrix run routes through.
 type proxyMatrixProxies struct {
-	config   *recordingProxy // named by proxy_config (http, IP or hostname URL)
-	socks    *recordingProxy // named by proxy_config (socks5)
-	envHTTPS *recordingProxy // HTTPS_PROXY / https_proxy
-	envHTTP  *recordingProxy // HTTP_PROXY / http_proxy
-	all      []*recordingProxy
+	config    *recordingProxy // named by proxy_config (http, IP or hostname URL)
+	config6   *recordingProxy // named by proxy_config (http, IPv6 literal URL)
+	socks     *recordingProxy // named by proxy_config (socks5)
+	envHTTPS  *recordingProxy // HTTPS_PROXY / https_proxy
+	envHTTPS6 *recordingProxy // HTTPS_PROXY as an IPv6 literal
+	envHTTP   *recordingProxy // HTTP_PROXY / http_proxy
+	all       []*recordingProxy
 }
 
 func newProxyMatrixProxies(t *testing.T) *proxyMatrixProxies {
 	p := &proxyMatrixProxies{
-		config:   newRecordingHTTPProxy(t, "config", "tcp4"),
-		socks:    newRecordingSOCKS5Proxy(t, "socks"),
-		envHTTPS: newRecordingHTTPProxy(t, "env-https", "tcp4"),
-		envHTTP:  newRecordingHTTPProxy(t, "env-http", "tcp4"),
-	}
-	p.all = []*recordingProxy{p.config, p.socks, p.envHTTPS, p.envHTTP}
+		config:    newRecordingHTTPProxy(t, "config", "tcp4"),
+		config6:   newRecordingHTTPProxy(t, "config6", "tcp6"),
+		socks:     newRecordingSOCKS5Proxy(t, "socks"),
+		envHTTPS:  newRecordingHTTPProxy(t, "env-https", "tcp4"),
+		envHTTPS6: newRecordingHTTPProxy(t, "env-https6", "tcp6"),
+		envHTTP:   newRecordingHTTPProxy(t, "env-http", "tcp4"),
+	}
+	p.all = []*recordingProxy{p.config, p.config6, p.socks, p.envHTTPS, p.envHTTPS6, p.envHTTP}
 	return p
 }
 
@@ -588,6 +592,9 @@ var proxyMatrixSources = []proxyMatrixSource{
 	{name: "http-hostname", config: func(p *proxyMatrixProxies, _ proxyMatrixTarget) *schemas.ProxyConfig {
 		return &schemas.ProxyConfig{Type: schemas.HTTPProxy, URL: schemas.NewSecretVar("http://localhost:" + p.config.port())}
 	}},
+	{name: "http-ipv6", config: func(p *proxyMatrixProxies, _ proxyMatrixTarget) *schemas.ProxyConfig {
+		return &schemas.ProxyConfig{Type: schemas.HTTPProxy, URL: schemas.NewSecretVar("http://[::1]:" + p.config6.port())}
+	}},
 	{name: "socks5", config: func(p *proxyMatrixProxies, _ proxyMatrixTarget) *schemas.ProxyConfig {
 		return &schemas.ProxyConfig{Type: schemas.Socks5Proxy, URL: schemas.NewSecretVar("socks5://127.0.0.1:" + p.socks.port())}
 	}},
@@ -616,6 +623,7 @@ var proxyMatrixEnvs = []proxyMatrixEnv{
 	{name: "no-env", vars: map[string]string{}},
 	{name: "HTTPS_PROXY", vars: map[string]string{"HTTPS_PROXY": "env-https"}},
 	{name: "HTTP_PROXY", vars: map[string]string{"HTTP_PROXY": "env-http"}},
+	{name: "HTTPS_PROXY-ipv6", vars: map[string]string{"HTTPS_PROXY": "env-https6"}},
 	{name: "both", vars: map[string]string{"HTTPS_PROXY": "env-https", "HTTP_PROXY": "env-http"}},
 	{name: "both+NO_PROXY", vars: map[string]string{"HTTPS_PROXY": "env-https", "HTTP_PROXY": "env-http", "NO_PROXY": "target"}},
 	{name: "https_proxy-lowercase", vars: map[string]string{"https_proxy": "env-https"}},
@@ -661,6 +669,8 @@ func proxyMatrixExpect(stack string, source proxyMatrixSource, env proxyMatrixEn
 		return ""
 	case "http-ip", "http-hostname":
 		return "config"
+	case "http-ipv6":
+		return "config6"
 	case "http-ip+no_proxy":
 		return ""
 	case "socks5":
@@ -712,7 +722,12 @@ func setProxyMatrixEnv(t *testing.T, p *proxyMatrixProxies, env proxyMatrixEnv,
 			t.Setenv(name, targetHost)
 			continue
 		}
-		t.Setenv(name, "http://127.0.0.1:"+p.byName(value).port())
+		proxy := p.byName(value)
+		host := "127.0.0.1"
+		if proxy == p.config6 || proxy == p.envHTTPS6 {
+			host = "[::1]"
+		}
+		t.Setenv(name, "http://"+host+":"+proxy.port())
 	}
 }
 
```

**File**: `core/providers/utils/utils.go` (modified, +18/-4)
```diff
@@ -734,7 +734,7 @@ func ConfigureProxy(client *fasthttp.Client, proxyConfig *schemas.ProxyConfig, l
 			parsedURL.User = url.UserPassword(proxyUsername, proxyPassword)
 			proxyURL = parsedURL.String()
 		}
-		dialFunc = fasthttpproxy.FasthttpHTTPDialer(proxyURL)
+		dialFunc = fasthttpproxy.FasthttpHTTPDialerDualStack(proxyURL)
 	case schemas.Socks5Proxy:
 		if proxyConfig.URL != nil && proxyConfig.URL.IsFromSecret() && proxyConfig.URL.GetValue() == "" {
 			errMsg := fmt.Sprintf("invalid proxy configuration: %s references %q but it resolved to an empty value", "proxy.url", proxyConfig.URL.GetRawRef())
@@ -761,10 +761,10 @@ func ConfigureProxy(client *fasthttp.Client, proxyConfig *schemas.ProxyConfig, l
 			parsedURL.User = url.UserPassword(proxyUsername, proxyPassword)
 			proxyURL = parsedURL.String()
 		}
-		dialFunc = fasthttpproxy.FasthttpSocksDialer(proxyURL)
+		dialFunc = fasthttpproxy.FasthttpSocksDialerDualStack(proxyURL)
 	case schemas.EnvProxy:
 		// Use environment variables for proxy configuration
-		dialFunc = fasthttpproxy.FasthttpProxyHTTPDialer()
+		dialFunc = envProxyDialFunc()
 	default:
 		getLogger().Warn("Invalid proxy configuration: unsupported proxy type: %s", proxyConfig.Type)
 		return client
@@ -878,7 +878,7 @@ func NetHTTPProxy(proxyConfig *schemas.ProxyConfig) (func(*http.Request) (*url.U
 // NO_PROXY (upper- or lower-case), read when EnvProxyFunc is called.
 //
 // http.ProxyFromEnvironment reads the environment once per process and caches it,
-// while fasthttp's env dialer (fasthttpproxy.FasthttpProxyHTTPDialer, used by
+// while fasthttp's env dialer (envProxyDialFunc, used by
 // ConfigureProxy for type "environment") reads it each time a client is built.
 // Reading at client build here keeps a provider's net/http and fasthttp stacks on
 // the same values across provider rebuilds.
@@ -1071,6 +1071,20 @@ func networkTLSConfig(base *tls.Config, networkConfig schemas.NetworkConfig, log
 	return tlsConfig, nil
 }
 
+// envProxyDialFunc is fasthttpproxy.FasthttpProxyHTTPDialer with dual-stack
+// dialing. The fasthttpproxy constructors without "DualStack" dial the proxy over
+// tcp4 only, so a proxy given as an IPv6 literal, or a hostname with only AAAA
+// records, fails with "couldn't find dns entries" while the net/http stacks reach
+// it. The environment is read when the client is built, as before.
+func envProxyDialFunc() fasthttp.DialFunc {
+	dialer := fasthttpproxy.Dialer{DialDualStack: true}
+	dialFunc, err := dialer.GetDialFunc(true)
+	if err != nil {
+		return dialErrorFunc(fmt.Sprintf("invalid proxy configuration: %v", err))
+	}
+	return dialFunc
+}
+
 // errBypassProxy is returned by the proxy dialer ConfigureProxy installs when the
 // target matches the proxy's no_proxy list. ConfigureDialer, which every client
 // applies right after ConfigureProxy, catches it and dials directly.
```

---

### Incident Patch 14: `76d6de31` (2026-10-05)
**Commit Message**: fix: validate OAuth callback registration and consent (#7960)

## Summary

This PR introduces two independent security improvements: a process-isolated sandbox for Starlark code mode execution, and an administrator-controlled allowlist for OAuth2 redirect URIs. Together they harden the two main extensibility surfaces of the gateway against resource exhaustion and open-redirect attacks.

## Changes

- **Starlark sandbox**: Starlark code execution now runs in a disposable child process (re-execing the gateway binary with a sentinel argument) rather than in-process. The worker receives only framed code and tool bindings over stdin/stdout; it has no access to gateway configuration, credentials, or inherited handles. On Linux, `RLIMIT_AS`, `RLIMIT_DATA`, `RLIMIT_CORE`, and `RLIMIT_CPU` are applied before reading user code. A step budget (`SetMaxExecutionSteps`) is enforced inside the worker to interrupt infinite loops. A concurrency slot semaphore (capacity 2) limits simultaneous executions gateway-wide. The `executeCode` method is reduced to wiring: it builds a `bindings` map and delegates to `runSandbox`, which manages the child process lifecycle, framed message protocol, log accumula

**File**: `docs/mcp/gateway-auth.mdx` (modified, +5/-0)
```diff
@@ -151,6 +151,7 @@ curl -X PUT http://localhost:8080/api/config \
 |-------|------|----------|-------------|
 | `mcp_server_auth_mode` | string | No | `headers` (default), `both`, or `oauth`. |
 | `oauth2_server_config.issuer_url` | string | Yes, when mode is `both` or `oauth` | Stable public URL advertised as the issuer in discovery docs and the JWT `iss` claim. Supports `env.MY_VAR` syntax. |
+| `oauth2_server_config.allowed_redirect_uris` | string[] | No | Exact approved remote callback URIs. Remote callbacks are denied unless listed. Loopback callbacks and `cursor://anysphere.cursor-mcp` remain available without entries. API changes require dashboard authentication. |
 | `oauth2_server_config.auth_code_ttl` | integer | No | Authorization code lifetime in seconds (default `300`, max `900` = 15 minutes). |
 | `oauth2_server_config.access_token_ttl` | integer | No | Issued JWT lifetime in seconds (default `600`). |
 | `oauth2_server_config.disable_vk_identity` | boolean | No | Require identity-provider login: removes the virtual-key option from consent and cuts off existing vk-mode grants (see [Token Lifetime & Revocation](#token-lifetime--revocation)). Only honored when an identity provider is configured, and only valid when `mcp_server_auth_mode` is `oauth` (400 otherwise). |
@@ -290,3 +291,7 @@ Client registration bounds its free-text fields: `client_name` up to 2048 bytes,
 - **[Bifrost as an MCP Gateway](./gateway)** — Expose aggregated tools to external MCP clients.
 - **[MCP Sessions](./sessions)** — Inspect and manage per-user credentials for upstream servers.
 - **[Virtual Keys](../features/governance/virtual-keys)** — Govern budgets, rate limits, and tool scope for the identities behind grants.
+
+### Callback destinations
+
+Remote OAuth clients must have their exact callback URI configured in `client.oauth2_server_config.allowed_redirect_uris` before registration or authorization. For example, add `"https://app.example.com/oauth/callback"`; wildcards are not supported. Existing registrations and pending flows are checked against the current list. URI credentials, fragments, missing hosts, and unsafe schemes are rejected. The consent page shows the client name and exact callback destination before you grant access. Only approve applications and destinations you recognize.
```

**File**: `docs/openapi/schemas/management/config.yaml` (modified, +6/-0)
```diff
@@ -189,6 +189,12 @@ ClientConfig:
           minimum: 1
           default: 600
           description: Lifetime of the issued JWT Bearer token in seconds (default 600).
+        allowed_redirect_uris:
+          type: array
+          items:
+            type: string
+            format: uri
+          description: Exact administrator-approved remote callback URIs; remote callbacks are denied unless listed.
         disable_vk_identity:
           type: boolean
           default: false
```

**File**: `framework/configstore/tables/mcpoauth2server.go` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ const (
 // MCPServerAuthMode is MCPServerAuthModeBoth or MCPServerAuthModeOAuth.
 // Not a table of its own.
 type OAuth2ServerConfig struct {
+	AllowedRedirectURIs []string `json:"allowed_redirect_uris,omitempty"` // Exact administrator-approved remote callbacks.
 	// IssuerURL is Bifrost's OAuth authorization-server identity — it appears
 	// as the `issuer` in discovery documents and as the `iss` claim in every
 	// issued JWT. Supports env var syntax ("env.MY_VAR"). Required whenever MCP
```

**File**: `tests/e2e/api/collections/provider-harness.json` (modified, +147/-0)
```diff
@@ -198019,6 +198019,153 @@
           }
         }
       ]
+    },
+    {
+      "name": "OAuth callback registration policy (oauth-redirect-policy)",
+      "description": "Default profile rejects unapproved remote destinations and malformed callbacks before registration. No provider spend.",
+      "item": [
+        {
+          "name": "[EXPECT-400] openai oauth-redirect-policy remote callback rejected",
+          "protocolProfileBehavior": {
+            "followRedirects": false,
+            "disableCookies": true
+          },
+          "event": [
+            {
+              "listen": "test",
+              "script": {
+                "type": "text/javascript",
+                "exec": [
+                  "pm.test('oauth-redirect-policy remote callback rejected', function () {",
+                  "  pm.expect(pm.response.code, pm.response.text()).to.equal(400);",
+                  "  pm.expect(pm.response.text()).to.include(\"invalid_redirect_uri\");",
+                  "});"
+                ]
+              }
+            }
+          ],
+          "request": {
+            "auth": {
+              "type": "noauth"
+            },
+            "method": "POST",
+            "header": [
+              {
+                "key": "Content-Type",
+                "value": "application/json"
+              }
+            ],
+            "url": {
+              "raw": "{{baseUrl}}/oauth2/register",
+              "host": [
+                "{{baseUrl}}"
+              ],
+              "path": [
+                "oauth2",
+                "register"
+              ]
+            },
+            "body": {
+              "mode": "raw",
+              "raw": "{\n  \"client_name\": \"Redirect check\",\n  \"redirect_uris\": [\n    \"https://unlisted.example/callback\"\n  ]\n}"
+            }
+          }
+        },
+        {
+          "name": "[EXPECT-400] openai oauth-redirect-policy fragment callback rejected",
+          "protocolProfileBehavior": {
+            "followRedirects": false,
+            "disableCookies": true
+          },
+          "event": [
+            {
+              "listen": "test",
+              "script": {
+                "type": "text/javascript",
+                "exec": [
+                  "pm.test('oauth-redirect-policy fragment callback rejected', function () {",
+                  "  pm.expect(pm.response.code, pm.response.text()).to.equal(400);",
+                  "  pm.expect(pm.response.text()).to.include(\"invalid_redirect_uri\");",
+                  "});"
+                ]
+              }
+            }
+          ],
+          "request": {
+            "auth": {
+              "type": "noauth"
+            },
+            "method": "POST",
+            "header": [
+              {
+                "key": "Content-Type",
+                "value": "application/json"
+              }
+            ],
+            "url": {
+              "raw": "{{baseUrl}}/oauth2/register",
+              "host": [
+                "{{baseUrl}}"
+              ],
+              "path": [
+                "oauth2",
+                "register"
+              ]
+            },
+            "body": {
+              "mode": "raw",
+              "raw": "{\n  \"client_name\": \"Redirect check\",\n  \"redirect_uris\": [\n    \"http://127.0.0.1/callback#tail\"\n  ]\n}"
+            }
+          }
+        },
+        {
+          "name": "[EXPECT-400] openai oauth-redirect-policy hostless callback rejected",
+          "protocolProfileBehavior": {
+            "followRedirects": false,
+            "disableCookies": true
+          },
+          "event": [
+            {
+              "listen": "test",
+              "script": {
+                "type": "text/javascript",
+                "exec": [
+                  "pm.test('oauth-redirect-policy hostless callback rejected', function () {",
+                  "  pm.expect(pm.response.code, pm.response.text()).to.equal(400);",
+                  "  pm.expect(pm.response.text()).to.include(\"invalid_redirect_uri\");",
+                  "});"
+                ]
+              }
+            }
+          ],
+          "request": {
+            "auth": {
+              "type": "noauth"
+            },
+            "method": "POST",
+            "header": [
+              {
+                "key": "Content-Type",
+                "value": "application/json"
+              }
+            ],
+            "url": {
+              "raw": "{{baseUrl}}/oauth2/register",
+              "host": [
+                "{{baseUrl}}"
+              ],
+              "path": [
+                "oauth2",
+                "register"
+              ]
+            },
+            "body": {
+              "mode": "raw",
+              "raw": "{\n  \"client_name\": \"Redirect check\",\n  \"redirect_uris\": [\n    \"https:///callback\"\n  ]\n}"
+            }
+          }
+        }
+      ]
     }
   ]
 }
```

**File**: `tests/e2e/features/mcp-auth-config/oauth-consent.spec.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { expect, test } from '../../core/fixtures/base.fixture'
+
+test.use({ skipAutoLogin: true })
+
+test('OAuth consent shows the exact callback before granting access', async ({ page }) => {
+  await page.route('**/api/**', async route => {
+    if (route.request().url().includes('/oauth2/consent/flows/review-flow')) {
+      await route.fulfill({ json: {
+        client_name: 'Review client', redirect_uri: 'https://approved.example/callback?tenant=team-a',
+        available_modes: ['vk'], expires_at: '2099-01-01T00:00:00Z',
+      } })
+    } else {
+      await route.fulfill({ json: { is_auth_enabled: false, has_valid_token: false } })
+    }
+  })
+  await page.goto('/oauth/consent?flow=review-flow')
+  await expect(page.getByTestId('oauth-consent-redirect-uri')).toHaveText('https://approved.example/callback?tenant=team-a')
+  await expect(page.getByRole('heading', { name: 'Review client wants to connect' })).toBeVisible()
+  await expect(page.getByText('Continue only if you recognize this application and its callback destination:')).toBeVisible()
+})
```

**File**: `transports/bifrost-http/handlers/config.go` (modified, +24/-1)
```diff
@@ -10,6 +10,7 @@ import (
 	"net/url"
 	"slices"
 	"strings"
+	"sync"
 	"time"
 
 	"github.com/fasthttp/router"
@@ -107,6 +108,7 @@ type ConfigManager interface {
 type ConfigHandler struct {
 	store         *lib.Config
 	configManager ConfigManager
+	saveMu        sync.Mutex // Serializes updateConfig from snapshot through publication
 }
 
 // NewConfigHandler creates a new handler for configuration management.
@@ -304,6 +306,10 @@ func (h *ConfigHandler) updateConfig(ctx *fasthttp.RequestCtx) {
 		SendError(ctx, fasthttp.StatusInternalServerError, "Config store not initialized")
 		return
 	}
+	// Overlapping saves would each snapshot the same live config and race its
+	// publication, so a later save could undo an earlier one.
+	h.saveMu.Lock()
+	defer h.saveMu.Unlock()
 
 	payload := struct {
 		ClientConfig    configstore.ClientConfig               `json:"client_config"`
@@ -464,6 +470,20 @@ func (h *ConfigHandler) updateConfig(ctx *fasthttp.RequestCtx) {
 	effectiveOAuth2Config := currentConfig.OAuth2ServerConfig
 	if payload.ClientConfig.OAuth2ServerConfig != nil {
 		effectiveOAuth2Config = payload.ClientConfig.OAuth2ServerConfig
+		var previousRedirects []string
+		if currentConfig.OAuth2ServerConfig != nil {
+			previousRedirects = currentConfig.OAuth2ServerConfig.AllowedRedirectURIs
+		}
+		if isAuthBypassed(ctx) && !slices.Equal(previousRedirects, effectiveOAuth2Config.AllowedRedirectURIs) {
+			SendError(ctx, fasthttp.StatusForbidden, "changing allowed_redirect_uris requires an authenticated admin session")
+			return
+		}
+		for _, uri := range effectiveOAuth2Config.AllowedRedirectURIs {
+			if !isAllowedRedirectScheme(uri) {
+				SendError(ctx, fasthttp.StatusBadRequest, "allowed_redirect_uris contains an invalid callback URI")
+				return
+			}
+		}
 	}
 
 	// disable_vk_identity only makes sense in oauth mode: in both mode virtual
@@ -810,8 +830,11 @@ func (h *ConfigHandler) updateConfig(ctx *fasthttp.RequestCtx) {
 
 	// Apply the in-memory change only after persistence succeeds, copying
 	// into the live struct (the same way ReloadClientConfigFromConfigStore
-	// publishes) so every holder of the pointer observes it.
+	// publishes) so every holder of the pointer observes it. Mu orders the
+	// copy with readers such as the OAuth redirect policy check.
+	h.store.Mu.Lock()
 	*h.store.ClientConfig = *updatedConfig
+	h.store.Mu.Unlock()
 	// Reloading client config from config store
 	if err := h.configManager.ReloadClientConfigFromConfigStore(ctx); err != nil {
 		logger.Warn("failed to reload client config from config store: %v", err)
```

**File**: `transports/bifrost-http/handlers/mcpoauth2consent.go` (modified, +6/-0)
```diff
@@ -78,6 +78,7 @@ func (h *OAuth2ConsentHandler) RegisterRoutes(r *router.Router, middlewares ...s
 
 // consentFlowDetailResponse is the wire shape for GET /api/oauth2/consent/flows/{id}.
 type consentFlowDetailResponse struct {
+	RedirectURI    string            `json:"redirect_uri"`
 	ClientName     string            `json:"client_name"`
 	AvailableModes []consentFlowMode `json:"available_modes"`
 	LoggedInUser   *loggedInUser     `json:"logged_in_user,omitempty"` // non-nil when a valid session is present
@@ -117,6 +118,7 @@ func (h *OAuth2ConsentHandler) flowDetail(ctx *fasthttp.RequestCtx) {
 	}
 
 	resp := consentFlowDetailResponse{
+		RedirectURI:    req.RedirectURI,
 		ClientName:     client.ClientName,
 		AvailableModes: h.availableModes(ctx),
 		ExpiresAt:      req.ExpiresAt.UTC().Format(time.RFC3339),
@@ -273,6 +275,10 @@ func (h *OAuth2ConsentHandler) loadPendingFlow(ctx *fasthttp.RequestCtx, flowID
 		SendError(ctx, fasthttp.StatusGone, "authorization flow has expired")
 		return nil
 	}
+	if !oauth2RedirectAllowed(h.store, req.RedirectURI) {
+		SendError(ctx, fasthttp.StatusBadRequest, "redirect_uri is no longer approved")
+		return nil
+	}
 	return req
 }
 
```

**File**: `transports/bifrost-http/handlers/mcpoauth2consent_test.go` (modified, +21/-0)
```diff
@@ -80,6 +80,9 @@ func TestConsentFlowDetail(t *testing.T) {
 		ctx := consentCtx("flow-1", "")
 		h.flowDetail(ctx)
 		require.Equal(t, fasthttp.StatusOK, ctx.Response.StatusCode())
+		var destination map[string]any
+		require.NoError(t, json.Unmarshal(ctx.Response.Body(), &destination))
+		require.Equal(t, "http://127.0.0.1/cb", destination["redirect_uri"])
 
 		var resp consentFlowDetailResponse
 		require.NoError(t, json.Unmarshal(ctx.Response.Body(), &resp))
@@ -420,3 +423,21 @@ func TestConsentSessionModeRequiresIdentity(t *testing.T) {
 		assert.Equal(t, "session", store.authReqs["flow-1"].BfMode)
 	})
 }
+
+func TestConsentRechecksCallbackPolicy(t *testing.T) {
+	store := newConsentStore()
+	seedPendingFlow(store, "flow-1", time.Now().Add(time.Minute))
+	store.authReqs["flow-1"].RedirectURI = "https://removed.example/cb"
+	h := newConsentHandler(store, nil, false)
+	for _, submit := range []bool{false, true} {
+		ctx := consentCtx("flow-1", `{"mode":"vk","value":"sk-bf-unused"}`)
+		if submit {
+			h.flowSubmit(ctx)
+		} else {
+			h.flowDetail(ctx)
+		}
+		require.Equal(t, 400, ctx.Response.StatusCode(), string(ctx.Response.Body()))
+		require.Contains(t, string(ctx.Response.Body()), "no longer approved")
+	}
+	require.Equal(t, configtables.OAuth2AuthorizeRequestStatusPending, store.authReqs["flow-1"].Status)
+}
```

---

### Incident Patch 15: `5d3997df` (2026-10-05)
**Commit Message**: fix(transports): apply the global proxy to providers without their own (#7568)

## Summary

Providers that inherit the global proxy were not routing traffic through it for inference, because the `EnableForInference` flag was stored but never read. Additionally, when a proxy had a `no_proxy` list, the fasthttp dial path passed the entire comma-separated string as a single pattern, so no host ever matched. This PR wires the global proxy into per-provider config at request time and fixes `no_proxy` matching for both fasthttp and `net/http` proxy paths.

## Changes

- **`no_proxy` list parsing**: Introduced `MatchesNoProxy(host, list string) bool` that splits the comma-separated list and applies `shouldBypassProxy` per entry. Previously the whole string was handed to `shouldBypassProxy` as one pattern, breaking multi-entry lists entirely.
- **`DialAddrHost` exported**: Renamed `dialAddrHost` → `DialAddrHost` so it can be shared between the `network` package and `utils`.
- **fasthttp `no_proxy` bypass via sentinel error**: `ConfigureProxy` now wraps the proxy dialer to return `errBypassProxy` when the target matches `no_proxy`. `ConfigureDialer`, which runs after `ConfigureProxy`, catch

**File**: `core/network/dialaddrhost_test.go` (modified, +26/-4)
```diff
@@ -15,18 +15,40 @@ func TestDialAddrHost(t *testing.T) {
 		{"[::1]", "::1"},               // bracketed, no port
 	}
 	for _, tt := range tests {
-		if got := dialAddrHost(tt.addr); got != tt.want {
-			t.Errorf("dialAddrHost(%q) = %q, want %q", tt.addr, got, tt.want)
+		if got := DialAddrHost(tt.addr); got != tt.want {
+			t.Errorf("DialAddrHost(%q) = %q, want %q", tt.addr, got, tt.want)
 		}
 	}
 }
 
 func TestNoProxyBypassIPv6(t *testing.T) {
 	// An IPv6 literal listed in no_proxy must match after host extraction
-	if !shouldBypassProxy(dialAddrHost("[::1]:8080"), "::1") {
+	if !shouldBypassProxy(DialAddrHost("[::1]:8080"), "::1") {
 		t.Error("[::1]:8080 should bypass proxy when no_proxy contains ::1")
 	}
-	if shouldBypassProxy(dialAddrHost("[2001:db8::1]:443"), "::1") {
+	if shouldBypassProxy(DialAddrHost("[2001:db8::1]:443"), "::1") {
 		t.Error("non-listed IPv6 target must not bypass proxy")
 	}
 }
+
+// TestMatchesNoProxyList pins that every entry of a comma-separated no_proxy list is
+// honoured. The fasthttp factory path used to hand the whole list to shouldBypassProxy
+// as one pattern, so "a.example,b.example" bypassed neither host.
+func TestMatchesNoProxyList(t *testing.T) {
+	list := "bedrock-runtime.us-east-1.amazonaws.com, .vpce.amazonaws.com,*.internal.corp"
+	tests := map[string]bool{
+		"bedrock-runtime.us-east-1.amazonaws.com":                true,
+		"vpce-0abc.bedrock-runtime.us-east-1.vpce.amazonaws.com": true,
+		"svc.internal.corp":                     true,
+		"internal.corp":                         false,
+		"us-central1-aiplatform.googleapis.com": false,
+	}
+	for host, want := range tests {
+		if got := MatchesNoProxy(host, list); got != want {
+			t.Errorf("MatchesNoProxy(%q) = %v, want %v", host, got, want)
+		}
+	}
+	if MatchesNoProxy("anything.example", "") {
+		t.Error("an empty list must match nothing")
+	}
+}
```

**File**: `core/network/http.go` (modified, +19/-6)
```diff
@@ -366,20 +366,33 @@ func (f *HTTPClientFactory) configureFasthttpProxy(client *fasthttp.Client) {
 	proxyCfg := f.proxyConfig
 	if dialFunc != nil {
 		client.Dial = func(addr string) (net.Conn, error) {
-			if proxyCfg.NoProxy != "" {
-				if shouldBypassProxy(dialAddrHost(addr), proxyCfg.NoProxy) {
-					return net.Dial("tcp", addr)
-				}
+			if MatchesNoProxy(DialAddrHost(addr), proxyCfg.NoProxy) {
+				return net.Dial("tcp", addr)
 			}
 			return dialFunc(addr)
 		}
 	}
 }
 
-// dialAddrHost extracts the host from a dial target for no_proxy matching.
+// MatchesNoProxy reports whether host matches any entry of a comma-separated
+// no_proxy list, using shouldBypassProxy's pattern rules per entry. An empty list
+// matches nothing.
+func MatchesNoProxy(host, noProxy string) bool {
+	if strings.TrimSpace(noProxy) == "" {
+		return false
+	}
+	for _, pattern := range strings.Split(noProxy, ",") {
+		if strings.TrimSpace(pattern) != "" && shouldBypassProxy(host, pattern) {
+			return true
+		}
+	}
+	return false
+}
+
+// DialAddrHost extracts the host from a dial target for no_proxy matching.
 // SplitHostPort unwraps IPv6 brackets ("[::1]:8080" -> "::1"); naive splitting
 // on ":" would mangle IPv6 literals.
-func dialAddrHost(addr string) string {
+func DialAddrHost(addr string) string {
 	host, _, err := net.SplitHostPort(addr)
 	if err != nil || host == "" {
 		host = strings.Trim(addr, "[]")
```

**File**: `core/providers/utils/dialer_test.go` (modified, +28/-0)
```diff
@@ -356,6 +356,34 @@ func TestConfigureDialer_SSRFProxyBypass(t *testing.T) {
 	}
 }
 
+// TestConfigureDialer_ProxyBypassSkipsDialTimeoutCallback pins that a no_proxy bypass
+// (errBypassProxy from the proxy dialer) connects through the checked direct-dial path,
+// even when the client also has a DialTimeout callback. The callback carries no IP
+// checks, so taking it would let a bypassed target reach private, link-local or
+// unspecified addresses.
+func TestConfigureDialer_ProxyBypassSkipsDialTimeoutCallback(t *testing.T) {
+	for _, addr := range []string{"10.0.0.1:80", "169.254.169.254:80", "0.0.0.0:80"} {
+		t.Run(addr, func(t *testing.T) {
+			var timeoutCalls atomic.Int32
+			client := &fasthttp.Client{ReadTimeout: time.Second}
+			client.Dial = func(string) (net.Conn, error) { return nil, errBypassProxy }
+			client.DialTimeout = func(addr string, _ time.Duration) (net.Conn, error) {
+				timeoutCalls.Add(1)
+				return nil, fmt.Errorf("unchecked dial to %s", addr)
+			}
+			ConfigureDialer(client, false)
+
+			_, err := client.Dial(addr)
+			if err == nil || !strings.Contains(err.Error(), "is not allowed") {
+				t.Fatalf("expected the bypassed target to be refused by the IP checks, got %v", err)
+			}
+			if n := timeoutCalls.Load(); n != 0 {
+				t.Fatalf("the DialTimeout callback was used %d times for a bypassed target", n)
+			}
+		})
+	}
+}
+
 // TestConfigureDialer_SSRFZeroTimeout verifies that SSRF protection is active
 // even when ReadTimeout is 0 (context.Background() is used instead of WithTimeout).
 func TestConfigureDialer_SSRFZeroTimeout(t *testing.T) {
```

**File**: `core/providers/utils/fetch.go` (modified, +2/-0)
```diff
@@ -174,6 +174,7 @@ type fetchClientKey struct {
 	username  string
 	password  string
 	caCertPEM string
+	noProxy   string
 	// env holds the proxy variables for type "environment": EnvProxyFunc reads them
 	// when the client is built, so the values it read are part of which client this is.
 	env string
@@ -189,6 +190,7 @@ func fetchClientKeyFor(proxyConfig *schemas.ProxyConfig) fetchClientKey {
 		username:  proxyConfig.Username.GetValue(),
 		password:  proxyConfig.Password.GetValue(),
 		caCertPEM: proxyConfig.CACertPEM.GetValue(),
+		noProxy:   proxyConfig.NoProxy,
 	}
 	if proxyConfig.Type == schemas.EnvProxy {
 		var env strings.Builder
```

**File**: `core/providers/utils/proxy_test.go` (modified, +58/-0)
```diff
@@ -594,6 +594,15 @@ var proxyMatrixSources = []proxyMatrixSource{
 	{name: "environment", config: func(*proxyMatrixProxies, proxyMatrixTarget) *schemas.ProxyConfig {
 		return &schemas.ProxyConfig{Type: schemas.EnvProxy}
 	}},
+	// The shape an inherited global proxy takes: a proxy plus the global no_proxy
+	// list, here naming the target, so every stack must connect directly.
+	{name: "http-ip+no_proxy", config: func(p *proxyMatrixProxies, _ proxyMatrixTarget) *schemas.ProxyConfig {
+		return &schemas.ProxyConfig{
+			Type:    schemas.HTTPProxy,
+			URL:     schemas.NewSecretVar("http://127.0.0.1:" + p.config.port()),
+			NoProxy: "api.bifrost.test,203.0.113.10",
+		}
+	}},
 }
 
 // proxyMatrixEnv is one state of the proxy environment variables. Values name a
@@ -652,6 +661,8 @@ func proxyMatrixExpect(stack string, source proxyMatrixSource, env proxyMatrixEn
 		return ""
 	case "http-ip", "http-hostname":
 		return "config"
+	case "http-ip+no_proxy":
+		return ""
 	case "socks5":
 		return "socks"
 	case "environment":
@@ -787,3 +798,50 @@ func TestProxyRoutingMatrix(t *testing.T) {
 		}
 	}
 }
+
+// TestConfigureProxy_NoProxyDialsDirectlyThroughConfigureDialer pins that a host on the
+// proxy's no_proxy list connects directly, through ConfigureDialer's own checked dial,
+// while every other host still goes to the proxy. An inherited global proxy relies on
+// this to keep, say, a Bedrock VPC endpoint off the corporate proxy.
+func TestConfigureProxy_NoProxyDialsDirectlyThroughConfigureDialer(t *testing.T) {
+	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
+	defer target.Close()
+
+	client := &fasthttp.Client{}
+	ConfigureProxy(client, &schemas.ProxyConfig{
+		Type:    schemas.HTTPProxy,
+		URL:     schemas.NewSecretVar("http://127.0.0.1:1"),
+		NoProxy: "127.0.0.1, .vpce.amazonaws.com",
+	}, testLogger{})
+	ConfigureDialer(client, false)
+
+	conn, err := client.Dial(strings.TrimPrefix(target.URL, "http://"))
+	if err != nil {
+		t.Fatalf("no_proxy host must dial directly, got %v", err)
+	}
+	conn.Close()
+
+	_, err = client.Dial("example.com:80")
+	if err == nil || !strings.Contains(err.Error(), "127.0.0.1:1") {
+		t.Fatalf("a host off the no_proxy list must go to the proxy, got %v", err)
+	}
+}
+
+func TestNetHTTPProxy_NoProxyConnectsDirectly(t *testing.T) {
+	proxy, _, err := NetHTTPProxy(&schemas.ProxyConfig{
+		Type:    schemas.HTTPProxy,
+		URL:     schemas.NewSecretVar("http://10.0.0.9:3128"),
+		NoProxy: ".vpce.amazonaws.com",
+	})
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	bypassed, _ := http.NewRequest(http.MethodPost, "https://vpce-0abc.bedrock-runtime.us-east-1.vpce.amazonaws.com/model/x/converse", nil)
+	if got, _ := proxy(bypassed); got != nil {
+		t.Errorf("no_proxy host: proxy = %v, want direct", got)
+	}
+	proxied, _ := http.NewRequest(http.MethodPost, "https://us-central1-aiplatform.googleapis.com/v1/x", nil)
+	if got, _ := proxy(proxied); got == nil || got.Host != "10.0.0.9:3128" {
+		t.Errorf("other host: proxy = %v, want 10.0.0.9:3128", got)
+	}
+}
```

**File**: `core/providers/utils/utils.go` (modified, +41/-3)
```diff
@@ -613,11 +613,24 @@ func ConfigureDialer(client *fasthttp.Client, allowPrivateNetwork bool) *fasthtt
 		var conn net.Conn
 		var err error
 
-		switch {
-		case existingDial != nil:
+		viaExistingDial := existingDial != nil
+		bypassed := false
+		if viaExistingDial {
 			// Proxy or custom dial function is set — use it, then enable keepalive
 			conn, err = existingDial(addr)
-		case existingDialTimeout != nil:
+			// A no_proxy match on the proxy dialer: connect directly instead,
+			// through the same checked path as a client with no proxy at all.
+			if errors.Is(err, errBypassProxy) {
+				viaExistingDial = false
+				bypassed = true
+				conn, err = nil, nil
+			}
+		}
+
+		switch {
+		case viaExistingDial:
+		case existingDialTimeout != nil && !bypassed:
+			// A bypassed target never takes this callback: it has no IP checks.
 			// Preserve dial-timeout behavior
 			conn, err = existingDialTimeout(addr, client.ReadTimeout)
 		default:
@@ -758,6 +771,17 @@ func ConfigureProxy(client *fasthttp.Client, proxyConfig *schemas.ProxyConfig, l
 	}
 
 	if dialFunc != nil {
+		if noProxy := proxyConfig.NoProxy; noProxy != "" {
+			proxyDial := dialFunc
+			dialFunc = func(addr string) (net.Conn, error) {
+				if network.MatchesNoProxy(network.DialAddrHost(addr), noProxy) {
+					// ConfigureDialer turns this into its own direct dial, so a
+					// bypassed host still gets the private-network checks.
+					return nil, errBypassProxy
+				}
+				return proxyDial(addr)
+			}
+		}
 		client.Dial = dialFunc
 	}
 
@@ -825,6 +849,15 @@ func NetHTTPProxy(proxyConfig *schemas.ProxyConfig) (func(*http.Request) (*url.U
 	default:
 		return nil, nil, fmt.Errorf("invalid proxy configuration: unsupported proxy type: %s", proxyConfig.Type)
 	}
+	if noProxy := proxyConfig.NoProxy; noProxy != "" {
+		configured := proxy
+		proxy = func(req *http.Request) (*url.URL, error) {
+			if network.MatchesNoProxy(req.URL.Hostname(), noProxy) {
+				return nil, nil
+			}
+			return configured(req)
+		}
+	}
 
 	if proxyConfig.CACertPEM != nil && proxyConfig.CACertPEM.IsFromSecret() && proxyConfig.CACertPEM.GetValue() == "" {
 		return nil, nil, fmt.Errorf("invalid proxy configuration: %s references %q but it resolved to an empty value", "proxy.ca_cert_pem", proxyConfig.CACertPEM.GetRawRef())
@@ -1038,6 +1071,11 @@ func networkTLSConfig(base *tls.Config, networkConfig schemas.NetworkConfig, log
 	return tlsConfig, nil
 }
 
+// errBypassProxy is returned by the proxy dialer ConfigureProxy installs when the
+// target matches the proxy's no_proxy list. ConfigureDialer, which every client
+// applies right after ConfigureProxy, catches it and dials directly.
+var errBypassProxy = errors.New("target matches no_proxy: dial directly")
+
 func dialErrorFunc(message string) fasthttp.DialFunc {
 	return func(_ string) (net.Conn, error) {
 		return nil, fmt.Errorf("%s", message)
```

**File**: `core/schemas/provider.go` (modified, +7/-0)
```diff
@@ -279,6 +279,13 @@ type ProxyConfig struct {
 	Username  *SecretVar `json:"username"`    // Username for proxy authentication (supports env.*)
 	Password  *SecretVar `json:"password"`    // Password for proxy authentication (supports env.*)
 	CACertPEM *SecretVar `json:"ca_cert_pem"` // PEM-encoded CA certificate to trust for TLS connections through the proxy (supports env.*)
+
+	// NoProxy is a comma-separated list of hosts that connect directly instead of
+	// through the proxy (".example.com" for a domain and its subdomains, "*.example.com"
+	// for subdomains only, "*" for everything). Runtime-only: it is filled in when a
+	// provider inherits the global proxy, whose no_proxy list it carries, and is never
+	// serialized with the provider's own config.
+	NoProxy string `json:"-"`
 }
 
 // MarshalForStorage serializes proxy settings for persistence (e.g. proxy_config_json).
```

**File**: `transports/bifrost-http/lib/account.go` (modified, +67/-0)
```diff
@@ -5,8 +5,11 @@ package lib
 import (
 	"context"
 	"fmt"
+	"strings"
 
+	"github.com/maximhq/bifrost/core/network"
 	"github.com/maximhq/bifrost/core/schemas"
+	configstoreTables "github.com/maximhq/bifrost/framework/configstore/tables"
 )
 
 // BaseAccount implements the Account interface for Bifrost.
@@ -87,6 +90,13 @@ func (baseAccount *BaseAccount) GetConfigForProvider(providerKey schemas.ModelPr
 	} else {
 		providerConfig.NetworkConfig = schemas.DefaultNetworkConfig
 	}
+	if inherited, ok := inheritGlobalProxy(providerConfig.ProxyConfig, baseAccount.store.GetGlobalProxyConfig()); ok {
+		providerConfig.ProxyConfig = inherited.proxy
+		if inherited.skipTLSVerify {
+			// NetworkConfig is a copy here, so this never touches the stored config.
+			providerConfig.NetworkConfig.InsecureSkipVerify = true
+		}
+	}
 	if config.ConcurrencyAndBufferSize != nil {
 		providerConfig.ConcurrencyAndBufferSize = *config.ConcurrencyAndBufferSize
 	} else {
@@ -106,3 +116,60 @@ func (baseAccount *BaseAccount) GetConfigForProvider(providerKey schemas.ModelPr
 	}
 	return providerConfig, nil
 }
+
+// hasOwnProxy reports whether a provider's proxy_config names a proxy of its own.
+// The UI saves type "none" when the proxy form is left untouched, so "none" and an
+// empty type mean "not configured", the same as nil.
+func hasOwnProxy(proxyConfig *schemas.ProxyConfig) bool {
+	return proxyConfig != nil && proxyConfig.Type != "" && proxyConfig.Type != schemas.NoProxy
+}
+
+// inheritedProxy is the global proxy translated for one provider.
+type inheritedProxy struct {
+	proxy         *schemas.ProxyConfig
+	skipTLSVerify bool
+}
+
+// inheritGlobalProxy returns the global proxy for a provider that has none of its
+// own, when the global proxy is enabled for inference. A provider's own proxy always
+// wins. ok is false when nothing should be inherited.
+//
+// no_proxy carries over, so hosts such as a VPC endpoint stay direct. skip_tls_verify
+// carries over as the provider's insecure_skip_verify, since that is what the global
+// setting means for traffic tunnelled through a TLS-inspecting proxy. The global
+// timeout does not: each provider keeps its own network_config timeouts.
+func inheritGlobalProxy(own *schemas.ProxyConfig, global *configstoreTables.GlobalProxyConfig) (inheritedProxy, bool) {
+	if hasOwnProxy(own) || global == nil || !global.Enabled || !global.EnableForInference || strings.TrimSpace(global.URL) == "" {
+		return inheritedProxy{}, false
+	}
+	var proxyType schemas.ProxyType
+	switch global.Type {
+	case network.GlobalProxyTypeHTTP, "":
+		proxyType = schemas.HTTPProxy
+	case network.GlobalProxyTypeSOCKS5:
+		proxyType = schemas.Socks5Proxy
+	default:
+		// "tcp" has no provider-level equivalent (the UI does not offer it).
+		return inheritedProxy{}, false
+	}
+	return inheritedProxy{
+		proxy: &schemas.ProxyConfig{
+			Type:     proxyType,
+			URL:      plainSecret(global.URL),
+			Username: plainSecret(global.Username),
+			Password: plainSecret(global.Password),
+			NoProxy:  global.NoProxy,
+		},
+		skipTLSVerify: global.SkipTLSVerify,
+	}, true
+}
+
+// plainSecret wraps a literal value. The global proxy stores plain strings, so a
+// password that happens to start with "env." must not be read as an env reference,
+// which NewSecretVar would do.
+func plainSecret(value string) *schemas.SecretVar {
+	if value == "" {
+		return nil
+	}
+	return &schemas.SecretVar{Val: value, SecretType: schemas.SecretTypePlainText}
+}
```

#### Recent Merged Pull Requests:
- **PR #8035** (2026-10-05): concurrency test for streaming (@akshaydeo)
- **PR #8034** (2026-10-05): token fix for e2e api fixes (@akshaydeo)
- **PR #8020** (2026-10-05): race fix for skill provider (@akshaydeo)
- **PR #8019** (2026-10-05): test case fixes to cover the setup token (@akshaydeo)
- **PR #8018** (2026-10-05): message level output config support (@akshaydeo)
- **PR #8016** (2026-10-05): test fixes regarding thinking token drop (@akshaydeo)
- **PR #8015** (2026-10-05): convert params flow for compat plugin (@akshaydeo)
- **PR #8014** (2026-10-05): 2.2.6 changelogs (@akshaydeo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
