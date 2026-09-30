# Forensic Learning Record (Deep Inspection): Nasiko-Labs/nasiko

> **Canonical Artifact**: `07_PROJECT_LEARNING/nasiko-labs-nasiko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Nasiko-Labs/nasiko](https://github.com/Nasiko-Labs/nasiko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:35:46.239Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Nasiko-Labs/nasiko`
- **Description**: The Open Runtime for AI Agents
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9296 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent-proxy/src/lib.rs`
```
use sqlx::PgPool;
use uuid::Uuid;

/// A `host:port` snapshot parsed from `agents.url`.
#[derive(Debug, Clone)]
pub struct AgentEndpoint {
    pub host: String,
    pub port: u16,
}

/// A running agent resolved from the catalog.
#[derive(Debug, Clone)]
pub struct ResolvedAgent {
    pub name: String,
    /// `None` when `agents.url` is empty: the row exists and the agent is
    /// running, but no endpoint snapshot has been persisted yet (a fresh
    /// Kubernetes deploy returns before the pod is Ready, so deploy-time
    /// persistence can race the workload). Callers should prefer a live
    /// runtime lookup and treat a missing snapshot as fatal only when that
    /// lookup fails too.
    pub endpoint: Option<AgentEndpoint>,
    /// The agent's A2A mount path (`agents.transport_path`, from its card) —
    /// e.g. `/a2a` for the a2a-go agents, `/` for the a2a-server-lf agents.
    /// `None`/empty/`/` mean root. The proxy must honor this: the A2A spec
    /// fixes no path, so POSTing a message to `/` 404s agents mounted elsewhere.
    pub transport_path: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ResolveError {
    #[error("agent not found")]
    NotFound,
    #[error("agent not running (status: {0})")]
    NotRunning(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

/// Resolve an agent ID to its catalog record (name + stored endpoint
/// snapshot) from the database.
pub async fn resolve(db: &PgPool, agent_id: Uuid) -> Result<ResolvedAgent, ResolveError> {
    let agent = sqlx::query_as::<_, AgentRow>(
        "SELECT name, status, url, transport_path FROM agents WHERE id = $1",
    )
    .bind(agent_id)
    .fetch_optional(db)
    .await?
    .ok_or(ResolveError::NotFound)?;

    if agent.status != "running" {
        return Err(ResolveError::NotRunning(agent.status));
    }

    let endpoint = match agent.url {
        Some(ref url) if !url.is_empty() => {
            let (host, port) = parse_host_port(url);
            Some(AgentEndpoint { host, port })
        }
        _ => None,
    };
    Ok(ResolvedAgent {
        name: agent.name,
        endpoint,
        transport_path: agent.transport_path,
    })
}

fn parse_host_port(url: &str) -> (String, u16) {
    let stripped = url
        .trim_start_matches("http://")
        .trim_start_matches("https://");
    let host_port = stripped.split('/').next().unwrap_or(stripped);
    if let Some((h, p)) = host_port.rsplit_once(':') {
        (h.to_string(), p.parse::<u16>().unwrap_or(8000))
    } else {
        (host_port.to_string(), 8000)
    }
}

#[derive(sqlx::FromRow)]
struct AgentRow {
    name: String,
    status: String,
    url: Option<String>,
    transport_path: Option<String>,
}

```

### Core Architecture Module: `agents/assistant-agent/main.py`
```
"""Assistant agent — discovers agents via A2A registry and delegates tasks."""
import json
import logging
import os
import uuid
from collections.abc import AsyncIterator

import click
import httpx
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Instrumentation must initialize before a2a-sdk (and anything it imports,
# e.g. Starlette) is imported below: OTel's Starlette instrumentor patches by
# rebinding `starlette.applications.Starlette` to an instrumented subclass, so
# any module that already did `from starlette.applications import Starlette`
# keeps its original, un-instrumented reference forever — no incoming
# traceparent gets extracted, and every request starts an orphan root trace
# instead of joining the platform's session trace.
try:  # OTel bootstrap — telemetry.py must ship alongside main.py
    from telemetry import init_telemetry

    init_telemetry()
except ImportError:
    logger.warning("telemetry.py not found — OTel telemetry disabled")

from a2a.helpers import (
    new_task_from_user_message,
    new_text_artifact_update_event,
    new_text_status_update_event,
)
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentInterface,
    AgentSkill,
    TaskState,
)
from openai import AsyncOpenAI
from starlette.applications import Starlette

DISCOVERY_URL = os.environ.get("A2A_DISCOVERY_URL", "")


class AssistantExecutor(AgentExecutor):
    def __init__(self, llm: AsyncOpenAI, model: str):
        self.llm = llm
        self.model = model

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        query = context.get_user_input()

        task = context.current_task or new_task_from_user_message(context.message)
        await event_queue.enqueue_event(task)

        await event_queue.enqueue_event(
            new_text_status_update_event(
                task_id=task.id,
                context_id=task.context_id,
                state=TaskState.TASK_STATE_WORKING,
                text="Discovering agents...",
            )
        )

        try:
            if DISCOVERY_URL:
                agents = await self._discover_agents()
                plan = await self._plan(query, agents)
                results = await self._delegate(plan, query)
            else:
                agents = []
                results = []

            full_response = ""
            async for chunk in self._synthesize(query, results):
                full_response += chunk

            await event_queue.enqueue_event(
                new_text_artifact_update_event(
                    task_id=task.id,
                    context_id=task.context_id,
                    name="assistant-response",
                    text=full_response,
                )
            )

        except Exception as e:
            logger.error(f"Orchestration error: {e}")
            await event_queue.enqueue_event(
                new_text_status_update_event(
                    task_id=task.id,
                    context_id=task.context_id,
                    state=TaskState.TASK_STATE_FAILED,
                    text=f"Error: {e}",
                )
            )
            return

        await event_queue.enqueue_event(
            new_text_status_update_event(
                task_id=task.id,
                context_id=task.context_id,
                state=TaskState.TASK_STATE_COMPLETED,
                text=full_response,
            )
        )

    async def _discover_agents(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{DISCOVERY_URL.rstrip('/')}/a2a/v1",
                json={
                    "jsonrpc": "2.0",
                    "id": str(uuid.uuid4()),
                    "method": "message/send",
                    "params": {
                        "message": {
                            "messageId": str(uuid.uuid4()),
                            "role": "user",
                            "parts": [{"kind": "text", "text": ""}],
                        }
                    },
                },
            )
            data = resp.json()
            result = data.get("result", {})
            agents = []
            for artifact in result.get("artifacts", []):
                for part in artifact.get("parts", []):
                    if part.get("kind") == "data":
                        agents = part.get("data", {}).get("agents", [])

            for agent in agents:
                url = agent.get("url", "")
                if "localhost" in url:
                    agent["url"] = url.replace("localhost", "host.docker.internal")

            return [a for a in agents if a.get("name") != "assistant-agent"]

    async def _plan(self, query: str, agents: list[dict]) -> list[dict]:
        if not agents:
            return []

        agent_list = "\n".join(
            f"- name: {a.get('name')}, description: {a.get('description', 'none')}, url: {a.get('url', '')}"
            for a in agents
        )

        resp = await self.llm.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": f"""You are a routing agent. Given a user query and available agents, decide which to call.

Available agents:
{agent_list}

Respond ONLY with a JSON array: [{{"name": "...", "url": "...", "sub_query": "..."}}]
If no agent fits, respond with []. Do NOT delegate to yourself (Assistant)."""},
                {"role": "user", "content": query},
            ],
        )

        text = resp.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"Bad plan JSON: {text}")
            return []

    async def _delegate(self, plan: list[dict], original_query: str) -> list[dict]:
        results = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for item in plan:
                url = item.get("url", "").rstrip("/")
                sub_query = item.get("sub_query", original_query)
                name = item.get("name", "unknown")

                if not url:
                    continue

                try:
                    # Platform agents speak A2A 1.0: method SendMessage, the
                    # A2A-Version header, ROLE_USER, and bare {"text": ...}
                    # parts (0.3's message/send gets -32601 Method not found).
                    resp = await client.post(
                        f"{url}/",
                        headers={"A2A-Version": "1.0"},
                        json={
                            "jsonrpc": "2.0",
                            "id": str(uuid.uuid4()),
                            "method": "SendMessage",
                            "params": {
                                "message": {
                                    "messageId": str(uuid.uuid4()),
                                    "role": "ROLE_USER",
                                    "parts": [{"text": sub_query}],
                                }
                            },
                        },
                    )
                    text = self._extract_text(resp.json())
                    results.append({"agent": name, "response": text or "No response"})
                except Exception as e:
                    logger.warning(f"Delegation to {name} failed: {e}")
                    results.append({"agent": name, "response": f"Error: {e}"})

        return results

    def _extract_t
```

### Core Architecture Module: `agents/assistant-agent/telemetry.py`
```
"""Nasiko Agent OTel telemetry bootstrap.

Import and call `init_telemetry()` at agent startup to auto-instrument:
- HTTP calls (httpx, requests, urllib3)
- LLM calls (openai, anthropic — via GenAI semantic conventions)
- A2A server spans (incoming requests)

Propagation (traceparent header) is ALWAYS enabled — required for CP flow tracking.
Export to a collector is optional (OTEL_EXPORTER_OTLP_ENDPOINT).
"""

import os
import logging

logger = logging.getLogger(__name__)

_initialized = False


def init_telemetry(service_name: str | None = None) -> None:
    """Initialize OpenTelemetry tracing + propagation. Safe to call multiple times."""
    global _initialized
    if _initialized:
        return
    _initialized = True

    try:
        from opentelemetry import trace, metrics
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.propagate import set_global_textmap
        from opentelemetry.propagators.composite import CompositePropagator
        from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
    except ImportError:
        logger.warning("opentelemetry SDK not installed — telemetry disabled")
        return

    name = service_name or os.environ.get("OTEL_SERVICE_NAME", "nasiko-agent")
    resource = Resource.create({"service.name": name})

    # Propagation — ALWAYS enabled (required for flow tracking via traceparent)
    set_global_textmap(CompositePropagator([TraceContextTextMapPropagator()]))

    # TracerProvider — always set so instrumented HTTP clients propagate context
    tracer_provider = TracerProvider(resource=resource)

    # Export — only if endpoint configured
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
        from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

        tracer_provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=True))
        )

        metric_reader = PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=endpoint, insecure=True),
            export_interval_millis=10000,
        )
        metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[metric_reader]))

    trace.set_tracer_provider(tracer_provider)

    # Auto-instrument HTTP clients (propagates traceparent on all outbound calls)
    _auto_instrument()

    logger.info(f"OTel telemetry initialized (export={'enabled → ' + endpoint if endpoint else 'disabled'})")


def _auto_instrument():
    """Best-effort auto-instrumentation for common libraries."""
    _try_instrument("opentelemetry.instrumentation.httpx", "HTTPXClientInstrumentor")
    _try_instrument("opentelemetry.instrumentation.requests", "RequestsInstrumentor")
    _try_instrument("opentelemetry.instrumentation.logging", "LoggingInstrumentor")
    _try_instrument("opentelemetry.instrumentation.starlette", "StarletteInstrumentor")
    # LLM clients — GenAI semconv spans (gen_ai.usage.*, gen_ai.request.model,
    # and gen_ai.input/output.messages when content capture is enabled).
    # opentelemetry.instrumentation.openai_v2 is the official OTel package;
    # the un-suffixed openai module is Traceloop's, kept as a fallback.
    _try_instrument("opentelemetry.instrumentation.openai_v2", "OpenAIInstrumentor")
    _try_instrument("opentelemetry.instrumentation.openai", "OpenAIInstrumentor")
    _try_instrument("opentelemetry.instrumentation.anthropic", "AnthropicInstrumentor")


def _try_instrument(module_path: str, class_name: str):
    """Try to instrument a library; skip silently if not installed."""
    try:
        import importlib
        mod = importlib.import_module(module_path)
        instrumentor = getattr(mod, class_name)()
        if not instrumentor.is_instrumented_by_opentelemetry:
            instrumentor.instrument()
    except (ImportError, Exception):
        pass

```

### Core Architecture Module: `agents/books/llm.go`
```
package main

// llm.go — a minimal OpenAI-compatible tool-calling loop.
//
// This is the reference pattern for Go agents on the platform:
//   - The LLM base URL + API key come from the environment. When deployed through the
//     control plane, OPENAI_BASE_URL points at the platform's LLM gateway and
//     OPENAI_API_KEY is the agent-identity token minted at deploy — so calls are
//     metered and attributed. Locally, set them to any OpenAI-compatible endpoint.
//   - The inbound `traceparent` (from the A2A request) is forwarded on the LLM call so
//     the gateway can attribute tokens to the originating user. a2a-go's handler copies
//     HTTP headers into ExecutorContext.ServiceParams; we extract it in main.go and
//     thread it here. (When built with the loongsuite `otel go build` in the Dockerfile,
//     net/http is auto-instrumented and propagation needs no manual work — this manual
//     header is the no-instrumentation fallback and is harmless when both are present.)

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// ── OpenAI wire types (chat.completions) ─────────────────────────────────────

type chatMessage struct {
	Role       string     `json:"role"`
	Content    string     `json:"content,omitempty"`
	ToolCalls  []toolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}

type toolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"` // JSON-encoded
	} `json:"function"`
}

type toolDef struct {
	Type     string `json:"type"`
	Function struct {
		Name        string         `json:"name"`
		Description string         `json:"description"`
		Parameters  map[string]any `json:"parameters"`
	} `json:"function"`
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
	Tools    []toolDef     `json:"tools,omitempty"`
	// DeepSeek's thinking mode rejects tool_choice; the platform agents disable it.
	ExtraBody map[string]any `json:"-"`
}

type chatResponse struct {
	Choices []struct {
		Message      chatMessage `json:"message"`
		FinishReason string      `json:"finish_reason"`
	} `json:"choices"`
}

// ── Client ───────────────────────────────────────────────────────────────────

type llmClient struct {
	baseURL string
	apiKey  string
	model   string
	http    *http.Client
}

func newLLMClient() *llmClient {
	base := os.Getenv("OPENAI_BASE_URL")
	if base == "" {
		base = "https://api.openai.com/v1"
	}
	model := os.Getenv("OPENAI_MODEL")
	if model == "" {
		model = os.Getenv("MODEL")
	}
	if model == "" {
		model = "gpt-4o-mini"
	}
	return &llmClient{
		baseURL: base,
		apiKey:  os.Getenv("OPENAI_API_KEY"),
		model:   model,
		http:    &http.Client{},
	}
}

// chat sends one round to the LLM. traceparent is the inbound W3C trace context
// header value (may be empty); forwarding it lets the gateway attribute the call.
func (c *llmClient) chat(ctx context.Context, messages []chatMessage, tools []toolDef, traceparent string) (*chatMessage, error) {
	reqBody := chatRequest{Model: c.model, Messages: messages, Tools: tools}
	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	if traceparent != "" {
		req.Header.Set("traceparent", traceparent)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LLM API %d: %s", resp.StatusCode, string(body))
	}

	var out chatResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("LLM response parse: %w", err)
	}
	if len(out.Choices) == 0 {
		return nil, fmt.Errorf("LLM returned no choices")
	}
	return &out.Choices[0].Message, nil
}

// runAgentLoop is the ReAct loop: the model decides which tool to call, we
// execute it, feed the result back, and repeat until the model answers with
// content instead of a tool call.
func (c *llmClient) runAgentLoop(ctx context.Context, query, traceparent string) (string, error) {
	messages := []chatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: query},
	}

	for range maxToolRounds {
		msg, err := c.chat(ctx, messages, booksTools, traceparent)
		if err != nil {
			return "", err
		}

		// No tool calls → the model produced the final answer.
		if len(msg.ToolCalls) == 0 {
			if msg.Content == "" {
				return "", fmt.Errorf("model returned an empty reply")
			}
			return msg.Content, nil
		}

		// Record the assistant turn (with its tool calls), then run each tool.
		messages = append(messages, *msg)
		for _, tc := range msg.ToolCalls {
			result := dispatchTool(ctx, tc.Function.Name, tc.Function.Arguments)
			messages = append(messages, chatMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Name:       tc.Function.Name,
				Content:    result,
			})
		}
	}
	return "", fmt.Errorf("exceeded %d tool rounds", maxToolRounds)
}

```

### Core Architecture Module: `agents/books/main.go`
```
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"iter"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/a2aproject/a2a-go/v2/a2a"
	"github.com/a2aproject/a2a-go/v2/a2asrv"
	// [nasiko:imports]
)

type booksExecutor struct {
	llm *llmClient
}

var _ a2asrv.AgentExecutor = (*booksExecutor)(nil)

func (b *booksExecutor) Execute(ctx context.Context, execCtx *a2asrv.ExecutorContext) iter.Seq2[a2a.Event, error] {
	// The inbound W3C trace context, forwarded on the LLM call for attribution.
	traceparent := firstParam(execCtx, "traceparent")
	return func(yield func(a2a.Event, error) bool) {
		userText := extractText(execCtx.Message)
		// Run the LLM tool-calling loop: the model forms the search query, we
		// execute it against Open Library, then the model synthesizes the answer.
		result, err := b.llm.runAgentLoop(ctx, userText, traceparent)
		if err != nil {
			yield(nil, err)
			return
		}
		yield(a2a.NewMessage(a2a.MessageRoleAgent, a2a.NewTextPart(result)), nil)
	}
}

// firstParam reads a single-valued service param (the a2a-go handler copies the
// inbound HTTP headers into ExecutorContext.ServiceParams, lowercased).
func firstParam(execCtx *a2asrv.ExecutorContext, name string) string {
	if execCtx == nil || execCtx.ServiceParams == nil {
		return ""
	}
	vals, ok := execCtx.ServiceParams.Get(name)
	if !ok || len(vals) == 0 {
		return ""
	}
	return vals[0]
}

func (*booksExecutor) Cancel(ctx context.Context, execCtx *a2asrv.ExecutorContext) iter.Seq2[a2a.Event, error] {
	return func(yield func(a2a.Event, error) bool) {}
}

func searchBooks(ctx context.Context, query string) (string, error) {
	apiURL := fmt.Sprintf("https://openlibrary.org/search.json?q=%s&limit=5&fields=title,author_name,first_publish_year,subject,isbn,number_of_pages_median,ratings_average", url.QueryEscape(query))

	resp, err := httpGet(ctx, apiURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var data struct {
		NumFound int `json:"numFound"`
		Docs     []struct {
			Title            string   `json:"title"`
			AuthorName       []string `json:"author_name"`
			FirstPublishYear int      `json:"first_publish_year"`
			Subject          []string `json:"subject"`
			ISBN             []string `json:"isbn"`
			Pages            int      `json:"number_of_pages_median"`
			Rating           float64  `json:"ratings_average"`
		} `json:"docs"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	if data.NumFound == 0 {
		return fmt.Sprintf("No books found for %q. Try a different search term.", query), nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Found %d books for %q (showing top %d):\n\n", data.NumFound, query, len(data.Docs)))

	for i, doc := range data.Docs {
		authors := "Unknown"
		if len(doc.AuthorName) > 0 {
			authors = strings.Join(doc.AuthorName, ", ")
		}
		sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, doc.Title))
		sb.WriteString(fmt.Sprintf("   Author(s): %s\n", authors))
		if doc.FirstPublishYear > 0 {
			sb.WriteString(fmt.Sprintf("   First published: %d\n", doc.FirstPublishYear))
		}
		if doc.Pages > 0 {
			sb.WriteString(fmt.Sprintf("   Pages: %d\n", doc.Pages))
		}
		if doc.Rating > 0 {
			sb.WriteString(fmt.Sprintf("   Rating: %.1f/5\n", doc.Rating))
		}
		if len(doc.Subject) > 0 {
			subjects := doc.Subject
			if len(subjects) > 3 {
				subjects = subjects[:3]
			}
			sb.WriteString(fmt.Sprintf("   Subjects: %s\n", strings.Join(subjects, ", ")))
		}
		sb.WriteString("\n")
	}
	return sb.String(), nil
}

// httpGet issues a GET with the request context attached, so the
// loongsuite-instrumented transport (see Dockerfile) propagates the trace and
// the call shows up as a span.
func httpGet(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	return http.DefaultClient.Do(req)
}

func extractText(msg *a2a.Message) string {
	if msg == nil {
		return ""
	}
	var parts []string
	for _, p := range msg.Parts {
		if t := p.Text(); t != "" {
			parts = append(parts, t)
		}
	}
	return strings.Join(parts, " ")
}

var port = flag.Int("port", 5002, "Port to listen on")

func main() {
	flag.Parse()
	addr := fmt.Sprintf("0.0.0.0:%d", *port)

	agentCard := &a2a.AgentCard{
		Name:        "Books Agent",
		Description: "An LLM-powered book assistant that searches Open Library for real book data — authors, publish dates, ratings, and subjects — and recommends or answers from the results (no API key required)",
		SupportedInterfaces: []*a2a.AgentInterface{
			a2a.NewAgentInterface(fmt.Sprintf("http://0.0.0.0:%d/a2a", *port), a2a.TransportProtocolJSONRPC),
		},
		DefaultInputModes:  []string{"text"},
		DefaultOutputModes: []string{"text"},
		Capabilities:       a2a.AgentCapabilities{Streaming: false},
		Skills: []a2a.AgentSkill{
			{
				ID:          "search_books",
				Name:        "Search Books",
				Description: "Search Open Library by title, author, or topic and get real book details: authors, first publish year, page count, rating, and subjects",
				Tags:        []string{"books", "search", "library", "reading"},
				Examples:    []string{"Search for books about machine learning", "Find books by Isaac Asimov", "Books about the history of Rome"},
			},
			{
				ID:          "recommend_books",
				Name:        "Recommend Books",
				Description: "Recommend books for a topic, genre, or mood, backed by real Open Library search results",
				Tags:        []string{"books", "recommendation", "reading"},
				Examples:    []string{"Recommend some sci-fi novels for beginners", "What are good highly-rated books on Stoicism?", "Suggest a short classic novel"},
			},
		},
	}

	handler := a2asrv.NewHandler(&booksExecutor{llm: newLLMClient()})

	mux := http.NewServeMux()
	mux.Handle("/a2a", a2asrv.NewJSONRPCHandler(handler))
	mux.Handle(a2asrv.WellKnownAgentCardPath, a2asrv.NewStaticAgentCardHandler(agentCard))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}
	log.Printf("Books Agent listening on %s", addr)
	log.Fatal(http.Serve(listener, mux))
}

```

### Core Architecture Module: `agents/books/tools.go`
```
package main

// tools.go — the agent's tools, exposed to the LLM as OpenAI function definitions.
//
// Each tool is a plain Go function; `dispatchTool` routes the model's tool_call
// (name + JSON arguments) to it. The Open Library HTTP calls go through the
// package's shared client so the loongsuite-instrumented transport propagates
// trace context (and they show up as spans).

import (
	"context"
	"encoding/json"
	"fmt"
)

const maxToolRounds = 6

const systemPrompt = `You are a book assistant. Use your tools — never invent titles, authors, or ratings.
For any book question (recommendations, "books by X", "books about Y"), call
search_books with a focused query to fetch real data from Open Library, then
recommend and answer from the actual results it returns. If a search comes back
empty or off-target, refine the query and try again before giving up.`

// booksTools is the tool schema advertised to the model.
var booksTools = []toolDef{
	{
		Type: "function",
		Function: struct {
			Name        string         `json:"name"`
			Description string         `json:"description"`
			Parameters  map[string]any `json:"parameters"`
		}{
			Name:        "search_books",
			Description: "Search Open Library for books by title, author, subject, or free-text query. Returns top matches with authors, first publish year, page count, rating, and subjects.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]any{"type": "string", "description": "Search query, e.g. 'Isaac Asimov', 'history of Rome', or 'machine learning'"},
				},
				"required": []string{"query"},
			},
		},
	},
}

// dispatchTool runs one model-requested tool and returns its text result.
// Tool errors are returned as content (not Go errors) so the model can recover.
func dispatchTool(ctx context.Context, name, argsJSON string) string {
	switch name {
	case "search_books":
		var args struct {
			Query string `json:"query"`
		}
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return fmt.Sprintf("bad arguments: %v", err)
		}
		result, err := searchBooks(ctx, args.Query)
		if err != nil {
			return fmt.Sprintf("search_books failed: %v", err)
		}
		return result

	default:
		return fmt.Sprintf("unknown tool: %s", name)
	}
}

```

### Core Architecture Module: `agents/claude-sdk/src/__main__.py`
```
import logging
import os

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)

# Instrumentation must initialize before a2a-sdk (and anything it imports,
# e.g. Starlette) is imported below: OTel's Starlette instrumentor patches by
# rebinding `starlette.applications.Starlette` to an instrumented subclass, so
# any module that already did `from starlette.applications import Starlette`
# keeps its original, un-instrumented reference forever — no incoming
# traceparent gets extracted, and every request starts an orphan root trace
# instead of joining the platform's session trace.
from telemetry import init_telemetry

init_telemetry()

import click
import uvicorn
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill
from starlette.middleware.cors import CORSMiddleware

from agent import SynthesizerAgent
from agent_executor import SynthesizerAgentExecutor

logger = logging.getLogger(__name__)


@click.command()
@click.option("--host", default="localhost")
@click.option("--port", default=8000)
def main(host, port):
    """Starts the Synthesizer Agent server."""
    capabilities = AgentCapabilities(streaming=True)
    skill = AgentSkill(
        id="synthesize",
        name="Synthesize & Report",
        description="Takes research data from multiple sources and produces polished, well-structured reports.",
        tags=["synthesis", "writing", "reports", "analysis"],
        examples=[
            "Synthesize these research findings into a report",
            "Write an executive summary from this data",
        ],
    )
    agent_url = os.getenv("HOST_OVERRIDE", f"http://{host}:{port}/")
    agent_card = AgentCard(
        name="Synthesizer Agent",
        description="Takes raw research and data from other agents, produces clear structured reports with summaries, key findings, and conclusions.",
        url=agent_url,
        version="1.0.0",
        default_input_modes=SynthesizerAgent.SUPPORTED_CONTENT_TYPES,
        default_output_modes=SynthesizerAgent.SUPPORTED_CONTENT_TYPES,
        capabilities=capabilities,
        skills=[skill],
    )
    request_handler = DefaultRequestHandler(
        agent_executor=SynthesizerAgentExecutor(),
        task_store=InMemoryTaskStore(),
    )
    server = A2AStarletteApplication(agent_card=agent_card, http_handler=request_handler)
    app = server.build()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #206** (2026-09-30): **docs: add community health files**
  *Symptoms*: Fixes #4  ## Summary - Added Contributor Covenant code of conduct - Added security reporting guidance - Added bug and feature issue forms - Added pull request template - Added good-first-issue contributor guide  ## Validation - Validated issue-form YAML syntax - Verified required fields and redaction guidance - No source-code changes - `just check` could not be run because `just` is not installed 

- **Issue #199** (2026-09-28): **Updates to the README**
  *Symptoms*: This makes some cleanup changes, such as removing em dashes, and updates the copy to align with our new GTM positioning.

- **Issue #182** (2026-09-24): **feat(llm-router): add /v1/route tier cascade, providers, and Smart LLM Router**
  *Symptoms*: ## Summary - Adds DronaHQ-shaped `POST /v1/route` with contract tier cascades (`cheap` / `balanced` / `premium`) across Groq, Mistral, OpenAI, Azure, Ollama, and NVIDIA NIM, plus optional `NASIKO_ROUTE_STUB` for local shape checks. - Adds agent-level **Smart tier cascade** toggle in the console LLM config: **on** = platform agnostic cascade; **off** = stick to the agent’s selected BYOK provider (e.g. NVIDIA). - Ships the **Smart LLM Router** example agent (`agents/smart-llm-router`): classify → tier → `/v1/route` → savings, with a chat-only A2A console path and an analytics dashboard on `/ui` (SSE + remote ingest).  ## Test plan - [ ] `cargo check -p nasiko-llm-router -p nasiko-server` - [ ] Apply migrations `0022`–`0024`; confirm `agents.tier_cascade` defaults to `true` - [ ] With a valid `OPENAI_API_KEY` and stub off: `POST /v1/route` with `x-nasiko-tier: cheap` returns a live model reply - [ ] Console: open agent LLM config → toggle **Smart tier cascade** off/on; with cascade off + agent JWT, `/v1/route` uses the agent’s configured provider - [ ] `cd agents/smart-llm-router && python src/eval_demo.py` against local Nasiko - [ ] Upload/run Smart LLM Router; console chat stays clean; `http://127.0.0.1:8000/ui/` receives turns

- **Issue #176** (2026-09-20): **fix(cli): accept A2A 1.0 AgentCards in validate**
  *Symptoms*: ## The problem  `nasiko validate` rejects an AgentCard produced by a current A2A SDK.  A2A 1.0 moved three fields out of the card root and into `supportedInterfaces[]`, renaming the transport on the way:  | 0.2.x, at the card root | 1.0, on a `supportedInterfaces[]` entry | |---|---| | `url` | `url` | | `protocolVersion` | `protocolVersion` | | `preferredTransport` | `protocolBinding` |  `cli/src/commands/validate.rs` only looked at the root, so a spec-correct 1.0 card fails with a message naming three fields that are all present:  ```   ✗ AgentCard.json — missing fields: url, protocolVersion, preferredTransport ```  This is not hypothetical. Serialising `a2a.AgentCard` from a2a-go v2.5.0, or the equivalent type in the Python and JS SDKs, produces exactly this shape. Today the only way past `validate` is to hand-write a card in the older shape, which then reads as incomplete to any 1.0 consumer.  It also makes `validate` the strictest step in the chain, though not because `deploy` handles the relocation correctly. `deploy` does not read `supportedInterfaces` either:  ```rust // cli/src/commands/deploy.rs:276 "url": card.get("url").and_then(|u| u.as_str()).unwrap_or(""), ```  So a 1.0 card is not rejected there, it is registered with an empty URL. `validate` is the loud half of one blindness and `deploy` the silent half. This PR fixes the loud half only; the silent one belongs in its own change against `deploy`, which I am happy to open separately if you want it.  ## The chang

- **Issue #173** (2026-09-20): **fix(observability): implement the test mock's status()**
  *Symptoms*: Closes **Issue 10 — Implement the observability test mock's `status()`**.  ## Problem  `RecordingRuntime::status()` in `observability/src/runtime_ext.rs` was `unimplemented!()`, so any test exercising a status path panicked rather than returning fixture data.  The sharper consequence is what that made *untestable*. `status()` is the one `ContainerRuntime` method whose **failure** path carries meaning to callers — "no such container" and "the backend is down" are different conditions that code branches on. With a panic in the mock, neither branch was reachable from a test, so `InstrumentedRuntime`'s forwarding of those errors was never covered.  ## Approach  Model the outcome as **data** rather than a fixed `Ok`:  ```rust #[derive(Clone)] enum StatusBehavior {     /// Succeed, reporting this lifecycle state for the queried container.     State(RuntimeState),     /// Fail as if no container exists for the queried id.     NotFound,     /// Fail with a backend-internal error carrying this message.     Internal(String), } ```  A test picks the outcome it needs; `status()` matches on it. No mocking framework, no trait-object indirection, and the failure paths become as easy to reach as the success one.  `StatusBehavior::default()` is a healthy `Running` agent, and `RecordingRuntime` derives `Default`. That keeps the blast radius small: the four existing construction sites gain only `..Default::default()`, and tests that don't care about status never mention it.  `replicas_live` is 

- **Issue #161** (2026-09-08): **ci: auto-deploy the OSS end-user demo (oss.nasiko.dev) on push to main**
  *Symptoms*: ## Summary - Adds `.github/workflows/deploy-oss-demo.yml`: on every push to `main`, SSHes into the demo VM, resets its checkout to `origin/main`, and rebuilds just the `server` service from source via `docker compose up -d --build server` — same build-from-source approach as the standard Quick Start, not a pre-built image. - The demo is already live at https://oss.nasiko.dev (admin login shared separately) — this just automates keeping it current with `main`.  ## Required setup (repo admin) Needs two repo secrets before it can run: - `DEMO_SSH_PRIVATE_KEY` - `DEMO_HOST`  ## Test plan - [ ] Add the two secrets - [ ] Push a trivial commit to `main` (or use workflow_dispatch) and confirm the workflow SSHes in, rebuilds, and the smoke test against `https://oss.nasiko.dev/health` passes  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #160** (2026-09-07): **ci: publish nasiko-server to Docker Hub, pull the image by default**
  *Symptoms*: ## Summary - Adds `.github/workflows/docker-publish.yml`: builds `server/Dockerfile` multi-arch (amd64+arm64) and pushes `skmallick/nasiko-oss-server` to Docker Hub on every version tag (`v*`), tagging both the version and `latest`. - Switches `docker-compose.yml`'s `server` service to `image:` (pulls by default) instead of always building from source — the Quick Start becomes a real `docker compose up -d` with no local Rust/compile step. The `build:` section stays, so `docker compose build server` still works for anyone testing an unreleased change. - Updates the README's Quick Start wording and the logs/rebuild cheat-sheet to match (pull vs. build-from-source).  A manually-built image is already live at `skmallick/nasiko-oss-server:latest` (and `:20260907`) so the new Quick Start works today; future pushes will be automated by this workflow on release tags.  ## Required setup (repo admin) This workflow needs two repo secrets before it can run: - `DOCKERHUB_USERNAME` - `DOCKERHUB_TOKEN` (a Docker Hub access token, not the account password)  ## Test plan - [x] Add `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets - [x] `docker compose up -d` on a clean checkout pulls the image and starts successfully - [x] Push a test tag (e.g. `v0.0.1-test`) and confirm the workflow builds + pushes both `linux/amd64` and `linux/arm64` manifests

- **Issue #157** (2026-08-30): **Optional Tool Outcome Attestation (TOA) verify gate for MCP CI / promote / register**
  *Symptoms*: ### Summary  [Tool Outcome Attestation](https://github.com/Carmel-Labs-Inc/toa) (`toa/0.1`) is an Apache-2.0 signed JSON evidence format for MCP tool delivery (reach, invoke, functional, shape, and related layers). It is not a wire protocol. It is not meant to run on every live `tools/call`.  Typical use: a CI step or promote/register gate verifies a recent attestation with offline `toa-verify` and a pinned emitter public key. Any party can emit if they sign the schema. AgentStatus is one optional emitter. No AgentStatus account is required to verify.  ### Why it might fit this project  The MCP gateway correctly enforces permissions and forwards tool results. TOA is off-path evidence. A fit is optional policy: require a recent verified TOA before promoting or enabling a connector, not signing every tools/call.  ### Proposed contribution (optional, off by default)  1. Docs and/or example: run `toa-verify` after existing checks, or before promote/register. 2. Config: path to attestation JSON, required layers (for example `functional=pass`), pinned public key, max age. 3. No hard dependency on any commercial emit API.  If this direction is welcome, we can open a small PR shaped to your plugin or policy model. If not, closing this is fine.  ### Links  - Spec and verify: https://github.com/Carmel-Labs-Inc/toa - Pre-prod complementarity note: https://github.com/Carmel-Labs-Inc/toa/blob/main/docs/complementarity-preprod.md  ### Out of scope  - Replacing Inspector, OAuth, protocol co
  **Post-Mortem & Fix Analysis**:
  > Closing this issue.  It was filed from the wrong GitHub account by mistake. Sorry for the noise. We may open a replacement later from the correct account if the topic is still useful.

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

### Incident Patch 1: `9db3fd8b` (2026-09-29)
**Commit Message**: Merge pull request #504 from Nasiko-Labs/fix/ee-refs

fix: clear ee/ refs from the oss part, remove Flutter
[synced-from-private]



---

### Incident Patch 2: `59880150` (2026-09-29)
**Commit Message**: fix: clear ee/ refs from the oss part, remove Flutter
[synced-from-private]

**File**: `.gitignore` (modified, +0/-5)
```diff
@@ -6,11 +6,6 @@ __pycache__/
 .env.*
 *.env.toml
 !.env.example
-# The Flutter app bundles its release dotenv file as a browser-served asset
-# (public URLs/tuning only — the import script scans it for credentials).
-# Deliberately NOT negating .env.* : the import script prunes non-release
-# flavors, and this makes an accidental re-import of one fail its ignore-check.
-!ui/ee/app/assets/.env
 .venv/
 node_modules/
 *.egg-info/
```

**File**: `bench-support/src/config.rs` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 //! Builds a `nasiko_config::Config` for the bench harness, pointed at the
 //! in-process mock LLM and carrying a dummy (non-empty) `openai_api_key` —
-//! `ee/server::build_ee_app` panics at startup without one (the MAF worker
+//! the enterprise server's `build_ee_app` panics at startup without one (the MAF worker
 //! requires it), even though the worker itself sits idle unless flows are
 //! explicitly queued.
 
```

**File**: `bench-support/src/lib.rs` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 //! LLM cost.
 //!
 //! Two consumers:
-//! - `cargo bench` targets (`oss/server/benches`, `ee/server/benches`) use
+//! - `cargo bench` targets (`oss/server/benches` and the enterprise equivalent) use
 //!   every module in-process: sim agent + mock LLM + `SimulatedRuntime` +
 //!   the real server, all inside one criterion binary.
 //! - The Goose load generator (`oss/bench`) runs against a separately
```

**File**: `bench-support/src/mock_llm.rs` (modified, +2/-2)
```diff
@@ -20,7 +20,7 @@
 //! control-plane overhead (DB queries, tool/preamble construction, one LLM
 //! round trip), not multi-turn tool-calling latency.
 //!
-//! `ee/orchestrator`'s `LlmClient` (MAF background worker, idle unless flows
+//! the enterprise orchestrator's `LlmClient` (MAF background worker, idle unless flows
 //! are queued) also posts to `{base_url}/chat/completions` — the flat JSON
 //! branch here satisfies it too. `/v1/embeddings` is served for robustness
 //! though the bench harness keeps the seeded agent count under
@@ -90,7 +90,7 @@ fn streaming_completion() -> Response {
 
 /// Matches `rig::providers::openai::completion::CompletionResponse` (id,
 /// object, created, model, choices[].index/message{role,content}/finish_reason,
-/// usage{prompt_tokens,total_tokens}) — also satisfies `ee/orchestrator`'s
+/// usage{prompt_tokens,total_tokens}) — also satisfies the enterprise orchestrator's
 /// simpler `LlmClient`, which only reads `choices[0].message.content` and
 /// `usage.total_tokens`.
 fn flat_completion() -> Value {
```

**File**: `bench-support/src/server.rs` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ where
         let _ = axum::serve(listener, app).await;
     });
 
-    // Defensive — mirrors `ee/server/tests/common::TestServer::start` — the
+    // Defensive — mirrors the enterprise server's `TestServer::start` — the
     // accept loop needs a tick to actually start polling the listener.
     tokio::time::sleep(std::time::Duration::from_millis(50)).await;
 
```

---

### Incident Patch 3: `09e97794` (2026-09-29)
**Commit Message**: Merge pull request #500 from Nasiko-Labs/fix/seed-pricing

Fix/seed pricing
[synced-from-private]



---

### Incident Patch 4: `11c8948d` (2026-09-29)
**Commit Message**: fix: correct the seed rates in the migration files
[synced-from-private]

**File**: `migrations/0046_correct_claude_5_seed_rates.sql` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+-- Correct the Claude 5 seed rates written by migration 0020, which carried the
+-- Claude 4 Opus/Sonnet rates forward as placeholders ("verify") and were never
+-- verified. Opus 5 was being billed at 3x its true rate, Sonnet 5 at 1.5x.
+--
+-- Verified 2026-09-29 against two independent sources that agree exactly —
+-- Anthropic's published list prices and the Portkey price book that the pricing
+-- sync itself reads (configs.portkey.ai/pricing/anthropic.json):
+--
+--                    input   output   cache write   cache read   1h cache write
+--   claude-opus-5     5.00    25.00          6.25         0.50            10.00
+--   claude-sonnet-5   2.00    10.00          2.50         0.20             4.00
+--
+-- The 1h cache-write rate was NULL on the old rows, so Anthropic 1h writes fell
+-- back to the `input * 2` inference in nasiko-pricing's context pricing. That
+-- inference is right for every Anthropic model checked, but it marks the call
+-- `estimated`; setting the column makes it a looked-up rate instead.
+--
+-- Closed and reopened rather than updated in place. `model_pricing` carries real
+-- price history and `DbPriceBook` resolves a call against the row that was
+-- effective when the call happened, so every cost already quoted stays exactly as
+-- quoted — only calls from here on pick up the corrected rate.
+
+-- Only the two placeholder rows are closed. A row the pricing sync has since
+-- written is already correct and is left untouched, along with any operator rate.
+UPDATE model_pricing
+   SET effective_until = now()
+ WHERE provider = 'anthropic'
+   AND effective_until IS NULL
+   AND notes IN (
+       'Claude Opus 5 - rate carried forward from Opus 4, verify',
+       'Claude Sonnet 5 - rate carried forward from Sonnet 4, verify'
+   );
+
+-- Gap-filling, like the boot seed: if an active row survived the close above, it
+-- came from the sync or an operator and must keep winning. Inserting regardless
+-- would shadow it, since a lookup takes the newest effective row.
+INSERT INTO model_pricing
+    (provider, model, input_price_per_1m, output_price_per_1m,
+     cache_creation_price_per_1m, cache_read_price_per_1m,
+     cache_creation_1h_price_per_1m, notes)
+SELECT v.provider, v.model, v.input, v.output, v.cache_write, v.cache_read,
+       v.cache_write_1h, v.notes
+  FROM (
+      VALUES
+          ('anthropic', 'claude-opus-5',
+           5.00::DECIMAL(10,4), 25.00::DECIMAL(10,4), 6.25::DECIMAL(10,4),
+           0.50::DECIMAL(10,4), 10.00::DECIMAL(10,4),
+           'seed: Claude Opus 5 list price, verified 2026-09-29'),
+          ('anthropic', 'claude-sonnet-5',
+           2.00::DECIMAL(10,4), 10.00::DECIMAL(10,4), 2.50::DECIMAL(10,4),
+           0.20::DECIMAL(10,4), 4.00::DECIMAL(10,4),
+           'seed: Claude Sonnet 5 list price, verified 2026-09-29')
+  ) AS v (provider, model, input, output, cache_write, cache_read,
+          cache_write_1h, notes)
+ WHERE NOT EXISTS (
+     SELECT 1 FROM model_pricing m
+      WHERE m.provider = v.provider
+        AND m.model = v.model
+        AND m.effective_until IS NULL
+ );
```

**File**: `migrations/0047_correct_and_unfreeze_seed_rates.sql` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+-- Two fixes to the pricing seed, both found by auditing every seeded row in
+-- `model_pricing` against the upstream price books on 2026-09-29.
+--
+-- Part 1 corrects seven rates that disagree with upstream. Part 2 is the reason
+-- they were able to drift for so long, and matters more.
+--
+-- Migration 0006 gave its rows human-readable notes ('o3', 'GPT-4o standard',
+-- 'DeepSeek R1', ...). `sync_managed_note` in the pricing sync recognizes only
+-- rows it wrote itself, so it read every one of these as an operator-set rate —
+-- a negotiated price no public book carries — and deliberately skipped them,
+-- logging "preserving operator price row". The result: 27 rows frozen at their
+-- authoring-day values forever, which is why `openai` had 174 correctly synced
+-- rows sitting beside 13 stale ones. The 174 had no seed row to "protect".
+--
+-- Rows are matched on the exact (provider, model, notes) triples that 0006 and
+-- 0020 wrote, never on a pattern: a genuine operator rate must not be swept up
+-- and handed to the sync.
+
+-- ---------------------------------------------------------------------------
+-- Part 1: correct the seven rates that disagree with upstream.
+--
+-- Closed and reopened, not updated in place, so costs already quoted against
+-- the old rate stay as quoted and only new calls see the correction.
+--
+--   openai/o3                  10.00/40.00 -> 2.00/8.00      (OpenAI's ~80% cut)
+--   openai/o1-mini              3.00/12.00 -> 1.10/4.40
+--   deepseek/deepseek-reasoner  0.55/2.19  -> 0.14/0.28      (unified V4 pricing)
+--   deepseek/deepseek-v4-pro    0.55/2.19  -> 0.435/0.87
+--   deepseek/deepseek-chat      cache reads 0.014 -> 0.0028, writes free
+--   gemini|google/gemini-2.5-flash  0.15/0.60 -> 0.30/2.50
+--
+-- Cache writes of 0 are a real price, not a missing one: OpenAI and DeepSeek do
+-- not charge for them. Gemini's book lists a cache read but no write, so the
+-- write stays NULL — a listed read price does not establish that writes are free.
+-- deepseek-v4-pro's upstream cache read is 0.003625, stored as 0.0036 because the
+-- column is numeric(10,4); that is what the sync itself would write.
+UPDATE model_pricing m
+   SET effective_until = now()
+  FROM (VALUES
+      ('openai',   'o3',                 'o3'),
+      ('openai',   'o1-mini',            'o1 mini'),
+      ('deepseek', 'deepseek-chat',      'DeepSeek Chat'),
+      ('deepseek', 'deepseek-reasoner',  'DeepSeek R1'),
+      ('deepseek', 'deepseek-v4-pro',    'boot seed (static list)'),
+      ('gemini',   'gemini-2.5-flash',   'boot seed (static list)'),
+      ('google',   'gemini-2.5-flash',   'Gemini 2.5 Flash')
+  ) AS s (provider, model, notes)
+ WHERE m.provider = s.provider
+   AND m.model = s.model
+   AND m.notes = s.notes
+   AND m.effective_until IS NULL;
+
+INSERT INTO model_pricing
+    (provider, model, input_price_per_1m, output_price_per_1m,
+     cache_creation_price_per_1m, cache_read_price_per_1m, notes)
+SELECT v.provider, v.model, v.input, v.output, v.cache_write, v.cache_read, v.notes
+  FROM (
+      VALUES
+          ('openai', 'o3',
+           2.0000::NUMERIC(10,4), 8.0000::NUMERIC(10,4),
+           0.0000::NUMERIC(10,4), 0.5000::NUMERIC(10,4),
+           'seed: OpenAI o3 list price, verified 2026-09-29'),
+          ('openai', 'o1-mini',
+           1.1000::NUMERIC(10,4), 4.4000::NUMERIC(10,4),
+           0.0000::NUMERIC(10,4), 0.5500::NUMERIC(10,4),
+           'seed: OpenAI o1-mini list price, verified 2026-09-29'),
+          ('deepseek', 'deepseek-chat',
+           0.1400::NUMERIC(10,4), 0.2800::NUMERIC(10,4),
+           0.0000::NUMERIC(10,4), 0.0028::NUMERIC(10,4),
+           'seed: DeepSeek Chat list price, verified 2026-09-29'),
+          ('deepseek', 'deepseek-reasoner',
+           0.1400::NUMERIC(10,4), 0.2800::NUMERIC(10,4),
+           0.0000::NUMERIC(10,4), 0.0028::NUMERIC(10,4),
+           'seed: DeepSeek Reasoner list price, verified 2026-09-29'),
+
```

---

### Incident Patch 5: `17e9c248` (2026-09-29)
**Commit Message**: fix(pricing): correct seeded model rates and ungate the Anthropic price book
[synced-from-private]

**File**: `llm-router/src/routing/pricing_sync.rs` (modified, +14/-6)
```diff
@@ -332,10 +332,17 @@ async fn current_prices(
         .collect())
 }
 
+/// Whether a row was written by us (and may be replaced by a newer book) or by an
+/// operator (and must be preserved — a negotiated rate no public book carries).
+///
+/// `seed:` is the prefix every migration-seeded row carries, so correcting a seed
+/// rate needs no new literal here. The two bare sentences below predate it and
+/// still exist in deployed databases.
 fn sync_managed_note(note: Option<&str>) -> bool {
     note.is_some_and(|note| {
         note.starts_with("portkey pricing sync")
             || note.starts_with("openrouter pricing sync")
+            || note.starts_with("seed:")
             || note == "boot seed (static list)"
             || matches!(
                 note,
@@ -486,12 +493,13 @@ pub async fn sync_once(db: &PgPool, http: &reqwest::Client, cfg: &GatewayConfig)
     // price book gets real prices; most have none, which is expected and harmless.
     let custom = super::catalog::load_custom_providers(db).await;
     let mut providers = super::catalog::priceable_providers(cfg, &custom);
-    // Public price books need no inference key. Claude integrations need the
-    // Anthropic reference book even when actual hosting is unknown per call.
-    let has_claude: bool = sqlx::query_scalar(
-        "SELECT EXISTS(SELECT 1 FROM agents WHERE coding_agent_integration_id = 'claude' AND deleted_at IS NULL)",
-    ).fetch_one(db).await.unwrap_or(false);
-    if has_claude && !providers.iter().any(|(label, _)| label == "anthropic") {
+    // Public price books need no inference key, so coverage must not be gated on
+    // one. This was conditional on a Claude coding-agent row existing, which made
+    // the Anthropic book's coverage depend on *when* the integration was installed
+    // relative to a pass: install it a minute after boot and every Claude call was
+    // priced from the offline seed until the next tick, 24h later. Unconditional
+    // matches how OpenRouter's book is already fetched below.
+    if !providers.iter().any(|(label, _)| label == "anthropic") {
         providers.push(("anthropic".into(), "https://api.anthropic.com".into()));
     }
     for (label, api_base) in providers {
```

**File**: `observability/src/pricing.rs` (modified, +22/-6)
```diff
@@ -182,6 +182,12 @@ macro_rules! seed {
 /// rows from the Portkey price book once provider keys are configured. VERIFY
 /// against current provider pricing before relying on cost figures.
 ///
+/// The Anthropic, OpenAI and DeepSeek rows were audited against the upstream
+/// book on 2026-09-29 (migration 0047 carries the same corrections for databases
+/// already seeded). The Gemini and Groq rows were not: Portkey keys Google by
+/// context tier (`gemini-2.5-pro-lte-128k`), so a bare name matches nothing
+/// there and these stay hand-maintained until the sync normalizes names.
+///
 /// Deliberately code, not a migration: price updates ship with the binary
 /// instead of requiring a new migration per price change.
 pub const SEED_PRICING: &[SeedPrice] = &[
@@ -193,14 +199,24 @@ pub const SEED_PRICING: &[SeedPrice] = &[
     seed!("openai", "gpt-4-turbo", 10.00, 30.00),
     seed!("openai", "gpt-3.5-turbo", 0.50, 1.50),
     seed!("openai", "o1-preview", 15.00, 60.00),
-    seed!("openai", "o1-mini", 3.00, 12.00),
-    seed!("openai", "o3", 10.00, 40.00),
+    seed!("openai", "o1-mini", 1.10, 4.40, 0.00, 0.55),
+    seed!("openai", "o3", 2.00, 8.00, 0.00, 0.50),
     seed!("openai", "o3-mini", 1.10, 4.40),
     seed!("openai", "text-embedding-3-small", 0.02, 0.00),
     seed!("openai", "text-embedding-3-large", 0.13, 0.00),
     seed!("anthropic", "claude-opus-4", 15.00, 75.00, 18.75, 1.50),
     seed!("anthropic", "claude-sonnet-4", 3.00, 15.00, 3.75, 0.30),
     seed!("anthropic", "claude-haiku-4", 0.80, 4.00, 1.00, 0.08),
+    // Anthropic re-priced mid-family, so the three rows above are not safe
+    // family fallbacks for every point release: `claude-opus-4-8` reduces to
+    // `claude-opus-4` and would price at 15/75 instead of 5/25, and
+    // `claude-haiku-4-5` at 0.80/4.00 instead of 1.00/5.00. Seeding the point
+    // releases keeps the family probe from ever being reached for them.
+    seed!("anthropic", "claude-opus-4-5", 5.00, 25.00, 6.25, 0.50),
+    seed!("anthropic", "claude-opus-4-6", 5.00, 25.00, 6.25, 0.50),
+    seed!("anthropic", "claude-opus-4-7", 5.00, 25.00, 6.25, 0.50),
+    seed!("anthropic", "claude-opus-4-8", 5.00, 25.00, 6.25, 0.50),
+    seed!("anthropic", "claude-haiku-4-5", 1.00, 5.00, 1.25, 0.10),
     seed!("anthropic", "claude-3-5-sonnet", 3.00, 15.00),
     seed!("anthropic", "claude-3-5-haiku", 0.80, 4.00),
     seed!(
@@ -223,16 +239,16 @@ pub const SEED_PRICING: &[SeedPrice] = &[
     // `token_usage.provider`, and `calculate_token_cost` matches (provider, model)
     // exactly, so a `google`-labelled row can never price a Gemini call.
     seed!("gemini", "gemini-2.5-pro", 1.25, 10.00),
-    seed!("gemini", "gemini-2.5-flash", 0.15, 0.60),
+    seed!("gemini", "gemini-2.5-flash", 0.30, 2.50),
     seed!("gemini", "gemini-1.5-pro", 1.25, 5.00),
     seed!("gemini", "gemini-1.5-flash", 0.075, 0.30),
     seed!("gemini", "gemini-2.0-flash", 0.10, 0.40),
     seed!("groq", "llama-3.3-70b-versatile", 0.59, 0.79),
     seed!("groq", "llama-3.1-8b-instant", 0.05, 0.08),
-    seed!("deepseek", "deepseek-chat", 0.14, 0.28, 0.014, 0.014),
-    seed!("deepseek", "deepseek-reasoner", 0.55, 2.19),
+    seed!("deepseek", "deepseek-chat", 0.14, 0.28, 0.00, 0.0028),
+    seed!("deepseek", "deepseek-reasoner", 0.14, 0.28, 0.00, 0.0028),
     seed!("deepseek", "deepseek-v4-flash", 0.14, 0.28),
-    seed!("deepseek", "deepseek-v4-pro", 0.55, 2.19),
+    seed!("deepseek", "deepseek-v4-pro", 0.435, 0.87, 0.00, 0.0036),
 ];
 
 /// Seed `model_pricing` from [`SEED_PRICING`] at server boot.
```

**File**: `pricing/src/book.rs` (modified, +65/-10)
```diff
@@ -95,14 +95,23 @@ fn static_row(model: &str) -> Option<PriceRow> {
         ("gpt-4", 30.00, 60.00, None, None),
         ("gpt-3.5", 0.50, 1.50, None, None),
         ("o3-mini", 1.10, 4.40, None, None),
-        ("o3", 10.00, 40.00, None, None),
-        ("o1-mini", 3.00, 12.00, None, None),
+        ("o3", 2.00, 8.00, Some(0.0), Some(0.50)),
+        ("o1-mini", 1.10, 4.40, Some(0.0), Some(0.55)),
         ("o1", 15.00, 60.00, None, None),
-        // Anthropic. Claude 5 rates are carried forward from the equivalent
-        // Claude 4 tier and are unverified — see oss/migrations/0006. They must
-        // stay above the generic `claude` entry, which would price Opus as Sonnet.
-        ("claude-opus-5", 15.00, 75.00, Some(18.75), Some(1.50)),
-        ("claude-sonnet-5", 3.00, 15.00, Some(3.75), Some(0.30)),
+        // Anthropic. Verified 2026-09-29 against Anthropic's published list
+        // prices and the Portkey book the pricing sync reads; the two agree.
+        // Order is load-bearing twice here. Anthropic re-priced mid-family at
+        // Opus 4.5 and Haiku 4.5, so those entries must precede the bare
+        // `claude-opus-4`/`claude-haiku-4` families they are substrings of —
+        // otherwise an Opus 4.8 call prices at 3x its true rate. And all of them
+        // must stay above the generic `claude` entry, which prices Opus as Sonnet.
+        ("claude-opus-5", 5.00, 25.00, Some(6.25), Some(0.50)),
+        ("claude-sonnet-5", 2.00, 10.00, Some(2.50), Some(0.20)),
+        ("claude-opus-4-5", 5.00, 25.00, Some(6.25), Some(0.50)),
+        ("claude-opus-4-6", 5.00, 25.00, Some(6.25), Some(0.50)),
+        ("claude-opus-4-7", 5.00, 25.00, Some(6.25), Some(0.50)),
+        ("claude-opus-4-8", 5.00, 25.00, Some(6.25), Some(0.50)),
+        ("claude-haiku-4-5", 1.00, 5.00, Some(1.25), Some(0.10)),
         ("claude-opus-4", 15.00, 75.00, Some(18.75), Some(1.50)),
         ("claude-4-opus", 15.00, 75.00, Some(18.75), Some(1.50)),
         ("claude-sonnet-4", 3.00, 15.00, Some(3.75), Some(0.30)),
@@ -118,14 +127,16 @@ fn static_row(model: &str) -> Option<PriceRow> {
         ("claude", 3.00, 15.00, Some(3.75), Some(0.30)),
         // Google
         ("gemini-2.5-pro", 1.25, 10.00, None, None),
-        ("gemini-2.5-flash", 0.15, 0.60, None, None),
+        // Read price listed, write price not — a listed read does not establish
+        // that writes are free, so the write stays unknown.
+        ("gemini-2.5-flash", 0.30, 2.50, None, Some(0.03)),
         ("gemini-2.0", 0.10, 0.40, None, None),
         ("gemini-1.5-pro", 1.25, 5.00, None, None),
         ("gemini-1.5-flash", 0.075, 0.30, None, None),
         ("gemini", 0.50, 1.50, None, None),
         // DeepSeek
-        ("deepseek-chat", 0.14, 0.28, Some(0.014), Some(0.014)),
-        ("deepseek-reasoner", 0.55, 2.19, None, None),
+        ("deepseek-chat", 0.14, 0.28, Some(0.0), Some(0.0028)),
+        ("deepseek-reasoner", 0.14, 0.28, Some(0.0), Some(0.0028)),
         ("deepseek", 0.14, 0.28, None, None),
         // Open-weight hosted
         ("llama-3.3-70b", 0.59, 0.79, None, None),
@@ -170,6 +181,50 @@ mod tests {
         assert_eq!(generic.input_per_1m, 3.00);
     }
 
+    #[test]
+    fn a_point_release_priced_apart_from_its_family_wins_over_the_family() {
+        // Anthropic re-priced mid-family: Opus 4.5 onward is $5/$25, not the
+        // $15/$75 the bare `claude-opus-4` entry carries. Substring matching
+        // takes the first hit, so these only stay correct while they precede it.
+        for model in [
+            "claude-opus-4-5",
+            "claude-opus-4-6",
+            "claude-opus-4-7",
+            "claude-opus-4-8",
+        ] {
+            let row = static_row(model).expect("priced");
+            assert_eq!(row.input_per_1m, 5.00, "{model} fell through to Opus 4");
+            assert_eq!(row.output_per_1m, 25.00, "{model} fell through to Opus 4");
+        }
+        let haiku = static_row("claude-haiku-4
```

**File**: `server/tests/pricing_sync.rs` (modified, +73/-0)
```diff
@@ -97,3 +97,76 @@ async fn sync_is_provider_scoped_duration_aware_and_idempotent() {
     mock.assert_async().await;
     server.cleanup().await;
 }
+
+/// A full pass must fetch the Anthropic book whatever the agent table holds.
+///
+/// Coverage used to be conditional on a `coding_agent_integration_id = 'claude'`
+/// row existing at the instant a pass ran. A pass runs at boot + 10s and then
+/// once a day, so installing the integration a minute after boot left every
+/// Claude call priced from the offline seed for the next 24 hours — which is how
+/// Opus 5 was billed at the Opus 4 rate. The book is public and needs no key, so
+/// nothing about it should depend on what is deployed.
+#[tokio::test]
+#[serial]
+async fn anthropic_book_is_fetched_with_no_claude_agent_and_no_keys() {
+    let server = common::TestServer::start().await;
+    let claude_agents: i64 = sqlx::query_scalar(
+        "SELECT count(*) FROM agents WHERE coding_agent_integration_id = 'claude' AND deleted_at IS NULL",
+    )
+    .fetch_one(&server.db)
+    .await
+    .unwrap();
+    assert_eq!(claude_agents, 0, "precondition: no Claude integration");
+
+    let mut upstream = mockito::Server::new_async().await;
+    let anthropic = upstream
+        .mock("GET", "/pricing/anthropic.json")
+        .with_status(200)
+        // Deliberately not the real rate: the seeded row is already correct, so
+        // only a value no seed carries proves the sync is what wrote the row.
+        .with_body(
+            json!({"claude-opus-5": {"pricing_config": {"pay_as_you_go": {
+                "request_token": {"price": 0.0007}, "response_token": {"price": 0.0031}
+            }}}})
+            .to_string(),
+        )
+        .expect_at_least(1)
+        .create_async()
+        .await;
+    // A pass also refreshes OpenRouter; keep the test off the public internet.
+    let _openrouter = upstream
+        .mock("GET", "/openrouter/models")
+        .with_status(200)
+        .with_body(json!({"data": []}).to_string())
+        .create_async()
+        .await;
+
+    let url = upstream.url();
+    // SAFETY: the pricing-sync tests are `#[serial]`, so no other thread in this
+    // process is reading the environment while these are set.
+    unsafe {
+        std::env::set_var("PORTKEY_PRICING_BASE_URL", &url);
+        std::env::set_var("OPENROUTER_MODELS_URL", format!("{url}/openrouter/models"));
+    }
+    nasiko_llm_router::routing::pricing_sync::sync_once(
+        &server.db,
+        &server.client,
+        &nasiko_llm_router::GatewayConfig::default(),
+    )
+    .await;
+    unsafe {
+        std::env::remove_var("PORTKEY_PRICING_BASE_URL");
+        std::env::remove_var("OPENROUTER_MODELS_URL");
+    }
+
+    anthropic.assert_async().await;
+    let input: f64 = sqlx::query_scalar(
+        "SELECT input_price_per_1m::float8 FROM model_pricing \
+         WHERE provider = 'anthropic' AND model = 'claude-opus-5' AND effective_until IS NULL",
+    )
+    .fetch_one(&server.db)
+    .await
+    .unwrap();
+    assert_eq!(input, 7.0, "the synced book must replace the seeded rate");
+    server.cleanup().await;
+}
```

---

### Incident Patch 6: `3e564038` (2026-09-29)
**Commit Message**: fix(oss/coding-policy): generalize minimal code addendum
[synced-from-private]

**File**: `coding-policy/src/lib.rs` (modified, +132/-12)
```diff
@@ -51,6 +51,45 @@ pub fn self_review_enabled() -> bool {
         .unwrap_or(true)
 }
 
+/// Whole words that mark a piece of an agent card as code work.
+///
+/// Matched as word *prefixes* against whole words, never as substrings. That distinction is
+/// the entire fix: the previous `ILIKE '%code%'` (and the settings page's mirrored
+/// `/code/i`) matched `encode`, `decode` and `barcode` while **missing `coding`**, which
+/// contains no "code" at all — c-o-d-i-n-g. Any uploaded agent whose card said "coding
+/// assistant" was therefore classified as not-a-coding-agent, so the settings toggle never
+/// rendered and the ladder never injected, with no error anywhere.
+///
+/// Deliberately absent: `develop` and `engineer`. They would match "business development"
+/// and "prompt engineering", and an agent that does software work almost always also says
+/// "software", which is matched.
+const CODING_TERMS: [&str; 8] = [
+    "cod",      // code, codes, coding, coder, codebase, codegen
+    "program",  // program, programming, programmer
+    "software", // software engineering, software development
+    "refactor", "debug", "bug", // bug fixing, bugfix
+    "lint", "compil", // compile, compiler, compilation
+];
+
+/// Whether one piece of an agent card — a skill id, name or tag — reads as code work.
+///
+/// Recall is favoured over precision on purpose, because the two errors are not symmetric:
+/// a false negative silently withholds a feature an operator explicitly switched on, while a
+/// false positive only offers a toggle that is off by default. Callers test each field they
+/// have; this function deliberately knows nothing about the shape of an agent card, which is
+/// what keeps this crate dependency-free and lets the dispatch path, the catalog API and the
+/// settings page share one answer instead of three implementations that drift.
+pub fn mentions_coding(text: &str) -> bool {
+    text.split(|c: char| !c.is_ascii_alphanumeric())
+        .filter(|word| !word.is_empty())
+        .any(|word| {
+            CODING_TERMS.iter().any(|term| {
+                word.get(..term.len())
+                    .is_some_and(|head| head.eq_ignore_ascii_case(term))
+            })
+        })
+}
+
 /// Continuing, early: this session has a few prior turns. Framed as a
 /// judgment call, not a mandatory first step — a CP-side heuristic trying to
 /// pre-classify every possible phrasing of "this needs a search" vs. "this
@@ -64,17 +103,18 @@ pub fn self_review_enabled() -> bool {
 /// names doesn't need a search; a request that plausibly overlaps with
 /// existing functionality does.
 const MINIMAL_CODE_ADDENDUM_CONTINUING: &str = "\n\
-- Only search this workspace first (search_code / list_directory / read_file) when it's \
-plausible something equivalent already exists that you haven't already seen this session. A \
+- Only search this workspace first (using whatever file-reading or search tools you have) when \
+it's plausible something equivalent already exists that you haven't already seen this session. A \
 rename, a removal, or a fix to something the request already names — or something you've \
 already located earlier in this session — doesn't need a fresh search; use your judgment on \
 which this is, rather than treating search as a mandatory first step for every request.
 - Once you know there's nothing to reuse, prefer the language's standard library or an \
 already-installed dependency over writing something from scratch.
 - If the request is for example or reference code (\"give me code for X\", \"write a function \
 that does Y\") rather than an explicit ask to add or change something in this workspace, just \
-write the code directly in your response. Do not create a file, set up a Cargo project, or run \
-tests for a standalone example — the person asking has no access to your sandbox and wants \
+write the code directly in your response. Do not create a file, set up a project scaffold, or \
+run a b
```

**File**: `server/src/catalog/models.rs` (modified, +22/-0)
```diff
@@ -61,6 +61,28 @@ pub struct Skill {
     pub examples: Vec<serde_json::Value>,
 }
 
+/// Whether an agent's card reads as code work, and so should be offered minimal-code mode.
+///
+/// The single implementation behind all three consumers: the A2A dispatch path (which decides
+/// whether to inject the ladder), the agent detail response (which decides whether the
+/// settings page renders the toggle), and through that response, the settings page itself.
+/// They previously each derived this for themselves — a Postgres `ILIKE '%code%'` and a
+/// mirrored JavaScript `/code/i` — and both were wrong in the same two ways, because a
+/// substring match on "code" misses `coding` entirely while matching `encode`.
+///
+/// `description` is deliberately not searched: it is prose, and matching it would classify a
+/// documentation agent that merely mentions code as a coding agent.
+pub fn has_coding_skills(skills: &[Skill]) -> bool {
+    skills.iter().any(|skill| {
+        nasiko_coding_policy::mentions_coding(&skill.id)
+            || nasiko_coding_policy::mentions_coding(&skill.name)
+            || skill
+                .tags
+                .iter()
+                .any(|tag| nasiko_coding_policy::mentions_coding(tag))
+    })
+}
+
 /// Lightweight projection returned by the by-skill discovery endpoint.
 #[derive(Debug, Serialize, ToSchema, sqlx::FromRow)]
 pub struct AgentSummary {
```

**File**: `server/src/catalog/routes.rs` (modified, +8/-0)
```diff
@@ -641,6 +641,13 @@ pub(crate) struct AgentDetailResponse {
     /// it here and the Settings toggle shows off regardless of the real value.
     #[serde(rename = "minimal_code_enabled")]
     minimal_code_enabled: bool,
+    /// Whether this agent's card reads as code work, and so should be offered minimal-code
+    /// mode at all. Served rather than re-derived in the browser: the settings page used to
+    /// run its own `/code/i` over the skills, mirroring a Postgres `ILIKE '%code%'` in the
+    /// dispatch path, and the two could disagree — which is exactly what happened, since both
+    /// missed `coding` (no "code" in it) while matching `encode`.
+    #[serde(rename = "has_coding_skills")]
+    has_coding_skills: bool,
     /// Owner-writable bag, and the home of `features.*` — the flags
     /// `AppState::agent_env` turns into `NASIKO_<KEY>` on the container.
     ///
@@ -774,6 +781,7 @@ pub(crate) async fn get_one(
         coding_agent_integration_id,
         compress_enabled: agent.compress_enabled,
         minimal_code_enabled: agent.minimal_code_enabled,
+        has_coding_skills: super::models::has_coding_skills(&agent.skills),
         metadata: agent.metadata.0.clone(),
         status: agent.status.clone(),
         version: agent.version.clone(),
```

**File**: `server/src/router/a2a_dispatch.rs` (modified, +17/-28)
```diff
@@ -1136,16 +1136,7 @@ async fn resolve_agent(state: &AppState, target: &str) -> Result<AgentRow, A2aDi
     // never here, or the superuser-ACL-bypass would leak it into ordinary chat
     // history/usage tracking.
     sqlx::query_as::<_, AgentRow>(
-        "SELECT id, name, status, minimal_code_enabled, \
-                EXISTS ( \
-                  SELECT 1 FROM jsonb_array_elements(skills) s \
-                  WHERE s->>'id' ILIKE '%code%' \
-                     OR s->>'name' ILIKE '%code%' \
-                     OR EXISTS ( \
-                          SELECT 1 FROM jsonb_array_elements_text(COALESCE(s->'tags', '[]'::jsonb)) t \
-                          WHERE t ILIKE '%code%' \
-                        ) \
-                ) AS is_coding_agent_example \
+        "SELECT id, name, status, minimal_code_enabled, skills \
          FROM agents \
          WHERE (id::text = $1 OR name = $1) AND status = 'running' AND NOT is_internal",
     )
@@ -1282,18 +1273,19 @@ async fn agent_stream(
     // server-injected context (enterprise supplemental knowledge), and it is what the agent is
     // meant to receive. Building from `query` here silently dropped that injection — the
     // context was resolved on every dispatch and then thrown away.
-    let effective_query = if agent.is_coding_agent_example && agent.minimal_code_enabled {
-        let addendum = nasiko_coding_policy::minimal_code_addendum(prior_turn_count);
-        tracing::info!(
-            agent_id = %agent.id,
-            %context_id,
-            prior_turn_count,
-            "a2a_dispatch: injecting minimal-code ladder"
-        );
-        format!("{outbound_query}\n{addendum}")
-    } else {
-        outbound_query.to_string()
-    };
+    let effective_query =
+        if agent.minimal_code_enabled && crate::catalog::models::has_coding_skills(&agent.skills) {
+            let addendum = nasiko_coding_policy::minimal_code_addendum(prior_turn_count);
+            tracing::info!(
+                agent_id = %agent.id,
+                %context_id,
+                prior_turn_count,
+                "a2a_dispatch: injecting minimal-code ladder"
+            );
+            format!("{outbound_query}\n{addendum}")
+        } else {
+            outbound_query.to_string()
+        };
 
     // Streaming first (`message/stream`): agents that stream (all the Rust
     // seed agents, and python a2a-sdk servers) deliver live tokens and tool
@@ -2334,12 +2326,9 @@ struct AgentRow {
     /// dispatch so the minimal-code ladder injection below applies
     /// immediately when toggled, with no agent restart needed.
     minimal_code_enabled: bool,
-    /// Broad "does this look like a coding agent" signal (skill id/name/tags
-    /// containing "code") — matches the UI's own toggle-visibility check
-    /// (`#isCodingAgentExample`, ui/common/pages/agent-card-page.js), kept
-    /// permissive on purpose: this has to work for third-party agents we've
-    /// never seen, not just our own two examples' exact skill ids.
-    is_coding_agent_example: bool,
+    /// The agent card's skills, classified here rather than in SQL so the dispatch path and
+    /// the settings page share one answer — see [`catalog::models::has_coding_skills`].
+    skills: sqlx::types::Json<Vec<crate::catalog::models::Skill>>,
 }
 
 #[derive(Debug)]
```

**File**: `ui/common/pages/agent-card-page.js` (modified, +16/-15)
```diff
@@ -1481,20 +1481,21 @@ class AgentCardPage extends HTMLElement {
 
   /* ── Settings tab ──────────────────────────────────────────────────────── */
 
-  // Broad "does this look like a coding agent" signal — skill id/name/tags
-  // containing "code" — not `is_coding_agent` (that flag means something
-  // unrelated: an external CLI tool — Claude Code, Codex, Cursor — linked
-  // for LLM-router billing, never this container). Matches the server's own
-  // check at A2A dispatch time (oss/server/src/router/a2a_dispatch.rs,
-  // resolve_agent's is_coding_agent_example) — kept in sync deliberately:
-  // this only controls whether the toggle *shows up*, but it should show up
-  // for exactly the agents the server would actually apply it to. Broad on
-  // purpose — has to work for a third-party agent we've never seen, not
-  // just our own two examples' exact skill ids.
-  #isCodingAgentExample(a) {
-    const looksLikeCode = (s) =>
-      /code/i.test(s.id || '') || /code/i.test(s.name || '') || (s.tags || []).some((t) => /code/i.test(t));
-    return (a.skills || []).some(looksLikeCode);
+  // Whether to offer minimal-code mode at all — served by the agent detail response, not
+  // re-derived here. This used to be a local `/code/i` over the skills, mirroring a Postgres
+  // `ILIKE '%code%'` in the dispatch path; two copies of one rule, and both missed `coding`
+  // (which contains no "code") while matching `encode`. So the switch was hidden for exactly
+  // the agents that wanted it. The server now answers once — see
+  // `catalog::models::has_coding_skills`.
+  //
+  // Not `is_coding_agent`, which means something unrelated: an external CLI tool (Claude
+  // Code, Codex, Cursor) linked for LLM-router billing, never this container.
+  //
+  // `|| minimal_code_enabled` so an agent whose flag was set some other way (the API, or a
+  // card that has since been edited) can still be seen and switched off. A toggle that is on
+  // must never be invisible.
+  #offersMinimalCode(a) {
+    return a.has_coding_skills === true || a.minimal_code_enabled === true;
   }
 
   // Self-review is still a write-only secret (unlike minimal-code, it stays
@@ -1562,7 +1563,7 @@ class AgentCardPage extends HTMLElement {
               label="Token optimization"
               hint="Off by default. Your own messages are never changed."></app-switch>
           </section>
-          ${this.#isCodingAgentExample(a) ? `
+          ${this.#offersMinimalCode(a) ? `
           <section class="acp-section">
             <h2 class="acp-section-title">Coding agent behavior</h2>
             <app-switch id="acp-minimal-code" layout="settings"
```

---

### Incident Patch 7: `69c9a8ff` (2026-09-28)
**Commit Message**: Merge pull request #496 from Nasiko-Labs/fix/pricing

Fix/pricing
[synced-from-private]

**File**: `cli/src/commands/integration/agents/claude.rs` (modified, +151/-25)
```diff
@@ -237,7 +237,7 @@ fn turns_from_lines(content: &str) -> Vec<Turn> {
     let mut turns: Vec<Turn> = Vec::new();
     let mut owners: HashMap<String, usize> = HashMap::new();
     let mut seen: HashSet<String> = HashSet::new();
-    let mut calls: HashMap<String, (usize, usize)> = HashMap::new();
+    let mut calls: HashMap<String, (usize, usize, bool, DateTime<Utc>)> = HashMap::new();
     let mut tools: HashMap<String, (usize, usize)> = HashMap::new();
     let mut fallback_turns: HashSet<usize> = HashSet::new();
     let mut previous_at: Option<DateTime<Utc>> = None;
@@ -435,7 +435,7 @@ struct PendingAssistant {
 
 struct AssistantIndexes<'a> {
     owners: &'a mut HashMap<String, usize>,
-    calls: &'a mut HashMap<String, (usize, usize)>,
+    calls: &'a mut HashMap<String, (usize, usize, bool, DateTime<Utc>)>,
     tools: &'a mut HashMap<String, (usize, usize)>,
     fallback_turns: &'a mut HashSet<usize>,
 }
@@ -477,26 +477,56 @@ fn attach_assistant(
     }
     if let Some(call) = entry.llm_call(started_at, ended_at) {
         let call_id = call.uuid.clone();
-        let call_owner = if let Some(&(old_owner, call_index)) = calls.get(&call_id) {
-            turns[old_owner].calls[call_index] = call;
-            turns[old_owner].ended_at = turns[old_owner].ended_at.max(ended_at);
-            if entry.is_completed_response() {
-                turns[old_owner].response = entry.assistant_text();
-            }
-            old_owner
-        } else {
-            let turn = &mut turns[owner];
-            if turn.started_at == DateTime::<Utc>::UNIX_EPOCH {
-                turn.started_at = started_at;
-            }
-            turn.ended_at = turn.ended_at.max(ended_at);
-            if entry.is_completed_response() {
-                turn.response = entry.assistant_text();
-            }
-            calls.insert(call_id.clone(), (owner, turn.calls.len()));
-            turn.calls.push(call);
-            owner
-        };
+        let final_observation = entry
+            .message
+            .as_ref()
+            .and_then(|m| m.stop_reason.as_ref())
+            .is_some();
+        let call_owner =
+            if let Some(&(old_owner, call_index, old_final, observed_at)) = calls.get(&call_id) {
+                let existing = &mut turns[old_owner].calls[call_index];
+                let first_at = existing.started_at.min(call.started_at);
+                let last_at = existing.ended_at.max(call.ended_at);
+                let conflicting = existing
+                    .accounting
+                    .as_ref()
+                    .is_some_and(|a| a.conflicting_observations)
+                    || (old_final
+                        && final_observation
+                        && usage_signature(existing) != usage_signature(&call));
+                if (final_observation, ended_at) >= (old_final, observed_at) {
+                    *existing = call;
+                    calls.insert(
+                        call_id.clone(),
+                        (old_owner, call_index, final_observation, ended_at),
+                    );
+                }
+                if let Some(accounting) = &mut existing.accounting {
+                    accounting.conflicting_observations = conflicting;
+                }
+                existing.started_at = first_at;
+                existing.ended_at = last_at;
+                turns[old_owner].ended_at = turns[old_owner].ended_at.max(ended_at);
+                if entry.is_completed_response() {
+                    turns[old_owner].response = entry.assistant_text();
+                }
+                old_owner
+            } else {
+                let turn = &mut turns[owner];
+                if turn.started_at == DateTime::<Utc>::UNIX_EPOCH {
+                    turn.started_at = started_at;
+                }
+                turn.ended_at = turn.ended_at.max(ended_at);
+                if entry.is_completed_response() {
+                    turn.response = e
```

**File**: `cli/src/commands/integration/agents/codex.rs` (modified, +1/-0)
```diff
@@ -452,6 +452,7 @@ fn apply_event(
                 output_tokens: usage.output,
                 cache_read_tokens: usage.cache_read,
                 cache_creation_tokens: 0,
+                accounting: None,
                 started_at,
                 ended_at,
             }],
```

**File**: `cli/src/commands/integration/agents/cursor.rs` (modified, +1/-0)
```diff
@@ -381,6 +381,7 @@ fn complete_turn(pending: &mut PendingTurn, payload: &HookPayload) -> Option<Tur
             output_tokens: pending.output_tokens.unwrap_or(0),
             cache_read_tokens: pending.cache_read_tokens.unwrap_or(0),
             cache_creation_tokens: pending.cache_write_tokens.unwrap_or(0),
+            accounting: None,
             started_at,
             ended_at,
         }],
```

**File**: `cli/src/commands/integration/agents/opencode.rs` (modified, +1/-0)
```diff
@@ -254,6 +254,7 @@ fn turns_from_messages(messages: &[Message]) -> Vec<Turn> {
                         .saturating_add(token(info.tokens.reasoning)),
                     cache_read_tokens: token(info.tokens.cache.read),
                     cache_creation_tokens: token(info.tokens.cache.write),
+                    accounting: None,
                     started_at,
                     ended_at,
                 });
```

**File**: `cli/src/commands/integration/model.rs` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ pub struct LlmCall {
     pub output_tokens: u64,
     pub cache_read_tokens: u64,
     pub cache_creation_tokens: u64,
+    pub accounting: Option<nasiko_types::CodingAgentCallAccounting>,
     pub started_at: DateTime<Utc>,
     pub ended_at: DateTime<Utc>,
 }
```

---

### Incident Patch 8: `f7d8c975` (2026-09-28)
**Commit Message**: Merge pull request #495 from Nasiko-Labs/fix/local-agents

Fix/local agents
[synced-from-private]

**File**: `cli/src/commands/integration/agents/claude.rs` (modified, +25/-151)
```diff
@@ -237,7 +237,7 @@ fn turns_from_lines(content: &str) -> Vec<Turn> {
     let mut turns: Vec<Turn> = Vec::new();
     let mut owners: HashMap<String, usize> = HashMap::new();
     let mut seen: HashSet<String> = HashSet::new();
-    let mut calls: HashMap<String, (usize, usize, bool, DateTime<Utc>)> = HashMap::new();
+    let mut calls: HashMap<String, (usize, usize)> = HashMap::new();
     let mut tools: HashMap<String, (usize, usize)> = HashMap::new();
     let mut fallback_turns: HashSet<usize> = HashSet::new();
     let mut previous_at: Option<DateTime<Utc>> = None;
@@ -435,7 +435,7 @@ struct PendingAssistant {
 
 struct AssistantIndexes<'a> {
     owners: &'a mut HashMap<String, usize>,
-    calls: &'a mut HashMap<String, (usize, usize, bool, DateTime<Utc>)>,
+    calls: &'a mut HashMap<String, (usize, usize)>,
     tools: &'a mut HashMap<String, (usize, usize)>,
     fallback_turns: &'a mut HashSet<usize>,
 }
@@ -477,56 +477,26 @@ fn attach_assistant(
     }
     if let Some(call) = entry.llm_call(started_at, ended_at) {
         let call_id = call.uuid.clone();
-        let final_observation = entry
-            .message
-            .as_ref()
-            .and_then(|m| m.stop_reason.as_ref())
-            .is_some();
-        let call_owner =
-            if let Some(&(old_owner, call_index, old_final, observed_at)) = calls.get(&call_id) {
-                let existing = &mut turns[old_owner].calls[call_index];
-                let first_at = existing.started_at.min(call.started_at);
-                let last_at = existing.ended_at.max(call.ended_at);
-                let conflicting = existing
-                    .accounting
-                    .as_ref()
-                    .is_some_and(|a| a.conflicting_observations)
-                    || (old_final
-                        && final_observation
-                        && usage_signature(existing) != usage_signature(&call));
-                if (final_observation, ended_at) >= (old_final, observed_at) {
-                    *existing = call;
-                    calls.insert(
-                        call_id.clone(),
-                        (old_owner, call_index, final_observation, ended_at),
-                    );
-                }
-                if let Some(accounting) = &mut existing.accounting {
-                    accounting.conflicting_observations = conflicting;
-                }
-                existing.started_at = first_at;
-                existing.ended_at = last_at;
-                turns[old_owner].ended_at = turns[old_owner].ended_at.max(ended_at);
-                if entry.is_completed_response() {
-                    turns[old_owner].response = entry.assistant_text();
-                }
-                old_owner
-            } else {
-                let turn = &mut turns[owner];
-                if turn.started_at == DateTime::<Utc>::UNIX_EPOCH {
-                    turn.started_at = started_at;
-                }
-                turn.ended_at = turn.ended_at.max(ended_at);
-                if entry.is_completed_response() {
-                    turn.response = entry.assistant_text();
-                }
-                calls.insert(
-                    call_id.clone(),
-                    (owner, turn.calls.len(), final_observation, ended_at),
-                );
-                turn.calls.push(call);
-                owner
-            };
+        let call_owner = if let Some(&(old_owner, call_index)) = calls.get(&call_id) {
+            turns[old_owner].calls[call_index] = call;
+            turns[old_owner].ended_at = turns[old_owner].ended_at.max(ended_at);
+            if entry.is_completed_response() {
+                turns[old_owner].response = entry.assistant_text();
+            }
+            old_owner
+        } else {
+            let turn = &mut turns[owner];
+            if turn.started_at == DateTime::<Utc>::UNIX_EPOCH {
+                turn.started_at = started_at;
+            }
+            turn.ended_at = 
```

**File**: `cli/src/commands/integration/agents/codex.rs` (modified, +0/-1)
```diff
@@ -452,7 +452,6 @@ fn apply_event(
                 output_tokens: usage.output,
                 cache_read_tokens: usage.cache_read,
                 cache_creation_tokens: 0,
-                accounting: None,
                 started_at,
                 ended_at,
             }],
```

**File**: `cli/src/commands/integration/agents/cursor.rs` (modified, +0/-1)
```diff
@@ -381,7 +381,6 @@ fn complete_turn(pending: &mut PendingTurn, payload: &HookPayload) -> Option<Tur
             output_tokens: pending.output_tokens.unwrap_or(0),
             cache_read_tokens: pending.cache_read_tokens.unwrap_or(0),
             cache_creation_tokens: pending.cache_write_tokens.unwrap_or(0),
-            accounting: None,
             started_at,
             ended_at,
         }],
```

**File**: `cli/src/commands/integration/agents/opencode.rs` (modified, +0/-1)
```diff
@@ -254,7 +254,6 @@ fn turns_from_messages(messages: &[Message]) -> Vec<Turn> {
                         .saturating_add(token(info.tokens.reasoning)),
                     cache_read_tokens: token(info.tokens.cache.read),
                     cache_creation_tokens: token(info.tokens.cache.write),
-                    accounting: None,
                     started_at,
                     ended_at,
                 });
```

**File**: `cli/src/commands/integration/model.rs` (modified, +0/-1)
```diff
@@ -15,7 +15,6 @@ pub struct LlmCall {
     pub output_tokens: u64,
     pub cache_read_tokens: u64,
     pub cache_creation_tokens: u64,
-    pub accounting: Option<nasiko_types::CodingAgentCallAccounting>,
     pub started_at: DateTime<Utc>,
     pub ended_at: DateTime<Utc>,
 }
```

---

### Incident Patch 9: `024009c7` (2026-09-28)
**Commit Message**: fix: pricing and token count for local coding agents
[synced-from-private]

**File**: `Cargo.toml` (modified, +2/-4)
```diff
@@ -3,17 +3,16 @@ resolver = "3"
 members = [
     # ─── OSS crates ─────────────────────────────────────────────────────────
     "auth",
-    "compress",
     "config",
     "secrets",
     "observability",
+    "pricing",
     "runtime",
     "react-agent",
     "orchestrator",
     "types",
     "utils",
     "server",
-    "coding-policy",
     "oci",
     "flow",
     "hitl",
@@ -33,8 +32,8 @@ version = "0.1.0"
 [workspace.dependencies]
 # ─── Internal OSS crates ────────────────────────────────────────────────────
 nasiko-auth = { path = "auth" }
-nasiko-compress = { path = "compress" }
 nasiko-config = { path = "config" }
+nasiko-pricing = { path = "pricing" }
 nasiko-flow = { path = "flow" }
 nasiko-hitl = { path = "hitl" }
 nasiko-agent-proxy = { path = "agent-proxy" }
@@ -48,7 +47,6 @@ nasiko-orchestrator = { path = "orchestrator" }
 nasiko-types = { path = "types" }
 nasiko-utils = { path = "utils" }
 nasiko-server = { path = "server" }
-nasiko-coding-policy = { path = "coding-policy" }
 nasiko-oci = { path = "oci" }
 nasiko-llm-router = { path = "llm-router" }
 nasiko-bench-support = { path = "bench-support" }
```

**File**: `cli/src/commands/integration/agents/claude.rs` (modified, +151/-25)
```diff
@@ -237,7 +237,7 @@ fn turns_from_lines(content: &str) -> Vec<Turn> {
     let mut turns: Vec<Turn> = Vec::new();
     let mut owners: HashMap<String, usize> = HashMap::new();
     let mut seen: HashSet<String> = HashSet::new();
-    let mut calls: HashMap<String, (usize, usize)> = HashMap::new();
+    let mut calls: HashMap<String, (usize, usize, bool, DateTime<Utc>)> = HashMap::new();
     let mut tools: HashMap<String, (usize, usize)> = HashMap::new();
     let mut fallback_turns: HashSet<usize> = HashSet::new();
     let mut previous_at: Option<DateTime<Utc>> = None;
@@ -435,7 +435,7 @@ struct PendingAssistant {
 
 struct AssistantIndexes<'a> {
     owners: &'a mut HashMap<String, usize>,
-    calls: &'a mut HashMap<String, (usize, usize)>,
+    calls: &'a mut HashMap<String, (usize, usize, bool, DateTime<Utc>)>,
     tools: &'a mut HashMap<String, (usize, usize)>,
     fallback_turns: &'a mut HashSet<usize>,
 }
@@ -477,26 +477,56 @@ fn attach_assistant(
     }
     if let Some(call) = entry.llm_call(started_at, ended_at) {
         let call_id = call.uuid.clone();
-        let call_owner = if let Some(&(old_owner, call_index)) = calls.get(&call_id) {
-            turns[old_owner].calls[call_index] = call;
-            turns[old_owner].ended_at = turns[old_owner].ended_at.max(ended_at);
-            if entry.is_completed_response() {
-                turns[old_owner].response = entry.assistant_text();
-            }
-            old_owner
-        } else {
-            let turn = &mut turns[owner];
-            if turn.started_at == DateTime::<Utc>::UNIX_EPOCH {
-                turn.started_at = started_at;
-            }
-            turn.ended_at = turn.ended_at.max(ended_at);
-            if entry.is_completed_response() {
-                turn.response = entry.assistant_text();
-            }
-            calls.insert(call_id.clone(), (owner, turn.calls.len()));
-            turn.calls.push(call);
-            owner
-        };
+        let final_observation = entry
+            .message
+            .as_ref()
+            .and_then(|m| m.stop_reason.as_ref())
+            .is_some();
+        let call_owner =
+            if let Some(&(old_owner, call_index, old_final, observed_at)) = calls.get(&call_id) {
+                let existing = &mut turns[old_owner].calls[call_index];
+                let first_at = existing.started_at.min(call.started_at);
+                let last_at = existing.ended_at.max(call.ended_at);
+                let conflicting = existing
+                    .accounting
+                    .as_ref()
+                    .is_some_and(|a| a.conflicting_observations)
+                    || (old_final
+                        && final_observation
+                        && usage_signature(existing) != usage_signature(&call));
+                if (final_observation, ended_at) >= (old_final, observed_at) {
+                    *existing = call;
+                    calls.insert(
+                        call_id.clone(),
+                        (old_owner, call_index, final_observation, ended_at),
+                    );
+                }
+                if let Some(accounting) = &mut existing.accounting {
+                    accounting.conflicting_observations = conflicting;
+                }
+                existing.started_at = first_at;
+                existing.ended_at = last_at;
+                turns[old_owner].ended_at = turns[old_owner].ended_at.max(ended_at);
+                if entry.is_completed_response() {
+                    turns[old_owner].response = entry.assistant_text();
+                }
+                old_owner
+            } else {
+                let turn = &mut turns[owner];
+                if turn.started_at == DateTime::<Utc>::UNIX_EPOCH {
+                    turn.started_at = started_at;
+                }
+                turn.ended_at = turn.ended_at.max(ended_at);
+                if entry.is_completed_response() {
+                    turn.response = e
```

**File**: `cli/src/commands/integration/agents/codex.rs` (modified, +1/-0)
```diff
@@ -452,6 +452,7 @@ fn apply_event(
                 output_tokens: usage.output,
                 cache_read_tokens: usage.cache_read,
                 cache_creation_tokens: 0,
+                accounting: None,
                 started_at,
                 ended_at,
             }],
```

**File**: `cli/src/commands/integration/agents/cursor.rs` (modified, +1/-0)
```diff
@@ -381,6 +381,7 @@ fn complete_turn(pending: &mut PendingTurn, payload: &HookPayload) -> Option<Tur
             output_tokens: pending.output_tokens.unwrap_or(0),
             cache_read_tokens: pending.cache_read_tokens.unwrap_or(0),
             cache_creation_tokens: pending.cache_write_tokens.unwrap_or(0),
+            accounting: None,
             started_at,
             ended_at,
         }],
```

**File**: `cli/src/commands/integration/agents/opencode.rs` (modified, +1/-0)
```diff
@@ -254,6 +254,7 @@ fn turns_from_messages(messages: &[Message]) -> Vec<Turn> {
                         .saturating_add(token(info.tokens.reasoning)),
                     cache_read_tokens: token(info.tokens.cache.read),
                     cache_creation_tokens: token(info.tokens.cache.write),
+                    accounting: None,
                     started_at,
                     ended_at,
                 });
```

---

### Incident Patch 10: `faeafb8f` (2026-09-28)
**Commit Message**: weave: make the server's scope decision effective, and fix what the validation pass found

The `tokenops` section now maps to `tokenops_rows`, matching the inventory
deployed generators were already using while they ignored the forwarded
scope. A client `scope` is still never read and unknown sections are still
refused. Scope, inventory identity and generation settings now survive the
A2A-to-SSE translation, so a recorded surface says which inventory produced
it.

Defence in depth on the browser side: generated DSL may call only the
approved nine-source historical TokenOps read inventory
(ui/common/surface/source-policy.js), not any function in the app-wide
registry, which also holds writes. Manifest loading fails closed, and
generated-surface Mutation execution is disabled even if the boundary filter
is bypassed. Backend authentication still governs the data itself.

Component and runtime defects, each fixed in its owner:
- charts rebuild after an AppCard slot relocation instead of drawing into a
  detached canvas; long categorical labels stay upright and truncate, with the
  full label kept in the tooltip and the accessible table
- grid tracks use zero minimums and stack below 60

**File**: `ui/common/design-system/app-chart/app-chart.js` (modified, +12/-2)
```diff
@@ -547,8 +547,10 @@ export class AppChart extends HTMLElement {
       // Delegated and bound once, before the first render: the button lives
       // inside markup render() replaces wholesale.
       bindRetry(this, 'chart-retry');
-      this.render();
     }
+    // Cards relocate their slot nodes. Disconnect destroys the canvas chart,
+    // so reconnect must recreate it even when listeners were already bound.
+    this.render();
     // Subscribed here rather than in the one-time block: teardown runs on every
     // disconnect, so an element that is moved must re-subscribe or it silently
     // stops following the theme.
@@ -974,7 +976,15 @@ export class AppChart extends HTMLElement {
         // Segmented plots carry a dense categorical axis (24 hours): thin the
         // ticks rather than rotate them — slanted labels read slower than a
         // sparser run of upright ones.
-        ticks: { color: pal.tick, ...(segmented ? { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } : {}) },
+        ticks: {
+          color: pal.tick, maxRotation: 0, autoSkip: true, autoSkipPadding: 12,
+          // Full category names stay in the tooltip and accessible table.
+          // Long agent names must not consume most of a narrow plot's height.
+          callback: function (value) {
+            const label = String(this.getLabelForValue(value));
+            return label.length > 18 ? `${label.slice(0, 17)}…` : label;
+          },
+        },
       },
       y: {
         stacked,
```

**File**: `ui/common/design-system/app-grid/app-grid.css` (modified, +5/-1)
```diff
@@ -1,9 +1,13 @@
 @scope (app-grid) {
     :scope {
       display: grid;
-      grid-template-columns: var(--grid-columns, repeat(auto-fill, minmax(var(--grid-min-width, 300px), 1fr)));
+      align-items: start;
+      grid-template-columns: var(--grid-columns, repeat(auto-fill, minmax(min(100%, var(--grid-min-width, 300px)), 1fr)));
       gap: var(--grid-gap, var(--s-16));
       padding: var(--grid-padding, 0);
       width: 100%;
+      min-width: 0;
     }
+    :scope[data-narrow] { grid-template-columns: minmax(0, 1fr); }
+    :scope > * { min-width: 0; }
   }
```

**File**: `ui/common/design-system/app-grid/app-grid.js` (modified, +14/-2)
```diff
@@ -2,7 +2,7 @@
  * CSS grid layout wrapper with configurable columns, gap, and padding.
  *
  * @element app-grid
- * @attr {string|number} columns - Column count (integer) or CSS grid-template value (e.g. `auto-fit`)
+ * @attr {string|number} columns - Column count or grid template. Fractional tracks shrink without overflowing and collapse below 600px of available width.
  * @attr {string} min-width - Minimum column width for auto-fit layouts (e.g. `280px`)
  * @attr {string} gap - Gap between cells: `xs` | `sm` | `md` (default) | `lg` | `xl`
  * @attr {string} padding - Inner padding token: `xs` | `sm` | `md` | `lg` | `xl`
@@ -15,13 +15,25 @@ import { BaseLayout } from '../../core/base-layout.js';
 document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
 
 export class AppGrid extends BaseLayout {
+  #resize = new ResizeObserver(([entry]) => {
+    this.toggleAttribute('data-narrow', entry.contentRect.width < 600);
+  });
   static get observedAttributes() { return ['columns', 'min-width', 'gap', 'padding']; }
   constructor() { super('grid'); }
 
+  connectedCallback() {
+    super.connectedCallback();
+    this.#resize.observe(this);
+  }
+
+  disconnectedCallback() { this.#resize.disconnect(); }
+
   updateProperty(name, value) {
     if (name === 'columns') {
       const n = Number(value);
-      const val = (Number.isInteger(n) && n > 0) ? `repeat(${n}, 1fr)` : value;
+      const val = (Number.isInteger(n) && n > 0) ? `repeat(${n}, minmax(0, 1fr))`
+        : /^\d+(?:\.\d+)?fr(?:\s+\d+(?:\.\d+)?fr)*$/.test(value)
+          ? value.split(/\s+/).map(track => `minmax(0, ${track})`).join(' ') : value;
       this.style.setProperty('--grid-columns', val);
     } else {
       super.updateProperty(name, value);
```

**File**: `ui/common/design-system/app-row/app-row.css` (modified, +1/-0)
```diff
@@ -8,5 +8,6 @@
     padding: var(--row-padding, 0);
     flex-wrap: var(--row-wrap, nowrap);
     width: 100%;
+    min-width: 0;
   }
 }
```

**File**: `ui/common/design-system/app-row/app-row.js` (modified, +7/-0)
```diff
@@ -19,5 +19,12 @@ document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
 export class AppRow extends BaseLayout {
   static get observedAttributes() { return ['gap', 'align', 'justify', 'padding', 'wrap']; }
   constructor() { super('row'); }
+
+  updateProperty(name, value) {
+    // Boolean attributes arrive as an empty string. Mirroring that into a CSS
+    // variable produced invalid flex-wrap and silently kept the row nowrap.
+    if (name === 'wrap') this.style.setProperty('--row-wrap', 'wrap');
+    else super.updateProperty(name, value);
+  }
 }
 customElements.define('app-row', AppRow);
```

#### Recent Merged Pull Requests:
- **PR #206** (closed): docs: add community health files (@AbhiramMandala)
- **PR #199** (2026-09-28): Updates to the README (@elof)
- **PR #182** (closed): feat(llm-router): add /v1/route tier cascade, providers, and Smart LLM Router (@Surajsm60720)
- **PR #176** (closed): fix(cli): accept A2A 1.0 AgentCards in validate (@ShubTvaram)
- **PR #173** (closed): fix(observability): implement the test mock's status() (@Munazir151)
- **PR #161** (2026-09-08): ci: auto-deploy the OSS end-user demo (oss.nasiko.dev) on push to main (@sumit-nasiko)
- **PR #160** (2026-09-07): ci: publish nasiko-server to Docker Hub, pull the image by default (@sumit-nasiko)
- **PR #152** (2026-08-27): fix: resolve compile errors blocking docker compose up -d and restore  dropped deploy optimization (@nasiko-chamansinghal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
