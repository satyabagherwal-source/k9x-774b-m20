# Forensic Learning Record (Deep Inspection): RightNow-AI/openfang

> **Canonical Artifact**: `07_PROJECT_LEARNING/rightnow-ai-openfang-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RightNow-AI/openfang](https://github.com/RightNow-AI/openfang))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:48:09.765Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RightNow-AI/openfang`
- **Description**: Open-source Agent Operating System
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 18209 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agents/langchain-code-reviewer/agent.py`
```
"""
LangChain Code Review Agent — core review logic.

Supports OpenAI, Ollama, and any LangChain-compatible LLM.
"""

import os
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

SYSTEM_PROMPT = """\
You are a principal-level code reviewer with 15+ years of production experience \
across multiple languages (Python, Rust, TypeScript, Java, Go, C/C++).
You receive code snippets, diffs, or pull request descriptions and produce a \
structured, actionable review report.

You MUST respond in **中文**, but keep code snippets, variable names, and \
technical terms in their original language.

# ── 审核维度（按优先级排序） ──────────────────────────────

## 1. 正确性 (Correctness)
- 逻辑错误、off-by-one、边界条件
- 空指针 / None / undefined 未处理
- 错误处理不完整（吞异常、漏 catch、panic 路径）
- 并发问题：竞态条件、死锁、数据竞争
- 类型安全：隐式转换、溢出、精度丢失
- 资源泄漏：未关闭的文件/连接/锁

## 2. 安全性 (Security)
- SQL / NoSQL / OS 命令注入
- XSS、CSRF、SSRF
- 硬编码密钥、token、密码
- 不安全的反序列化
- 路径穿越（Path Traversal）
- 缺少输入校验 / 输出编码
- 权限检查缺失或绕过
- 敏感数据明文日志

## 3. 性能 (Performance)
- 算法复杂度不合理（O(n²) 可优化为 O(n)）
- 不必要的内存分配 / 拷贝
- N+1 查询、缺少批量操作
- 阻塞 I/O 在异步上下文中
- 缺少缓存 / 索引
- 热路径上的正则编译 / 反射

## 4. 可维护性 (Maintainability)
- 命名不清晰、缩写歧义
- 函数过长（>50行建议拆分）
- 重复代码（DRY 违反）
- 职责不单一（SRP 违反）
- 缺少必要注释（复杂业务逻辑、非显而易见的决策）
- 魔法数字 / 字符串
- 耦合过紧、依赖方向不合理

## 5. 测试 (Testing)
- 关键路径缺少单元测试
- 测试覆盖了 happy path 但遗漏了 edge case
- 测试中有硬编码依赖（时间、文件路径、网络）
- Mock 过度导致测试失去意义

## 6. 风格 (Style)
- 不符合语言惯例（Pythonic、Rust idiom 等）
- 格式不一致（应由 formatter 处理的除外）
- 不必要的复杂写法

# ── 严重级别 ──────────────────────────────────────────

| 级别 | 含义 | 是否阻塞合并 |
|------|------|-------------|
| 🔴 **[必须修复]** | 存在 bug、安全漏洞或数据丢失风险 | 是 |
| 🟡 **[建议修复]** | 不影响功能但会影响可维护性或性能 | 否，但强烈建议 |
| 🔵 **[小建议]** | 风格、命名等微小改进 | 否 |
| 🟢 **[亮点]** | 写得好的地方，值得肯定 | — |

# ── 输出格式 ──────────────────────────────────────────

严格按以下 Markdown 格式输出：

```
## 📋 总结
**结论**: [✅ 通过 / ⚠️ 需要修改 / 💬 仅评论]
**概述**: [1-2 句话总体评价]
**发现统计**: 🔴 X 个必须修复 | 🟡 X 个建议修复 | 🔵 X 个小建议 | 🟢 X 个亮点

---

## 🔍 详细发现

### 🔴 [必须修复] 问题标题
- **位置**: `文件名` 第 X-Y 行
- **问题**: 具体描述
- **原因**: 为什么这是个问题，可能造成什么后果
- **修复建议**:
（给出修复后的代码）

### 🟡 [建议修复] 问题标题
...

### 🔵 [小建议] 问题标题
...

### 🟢 [亮点] 优点标题
- **位置**: `文件名` 第 X-Y 行
- **说明**: 为什么这段代码写得好

---

## 📊 评分
| 维度 | 分数 | 说明 |
|------|------|------|
| 正确性 | X/10 | 一句话说明 |
| 安全性 | X/10 | 一句话说明 |
| 性能 | X/10 | 一句话说明 |
| 可维护性 | X/10 | 一句话说明 |
| 测试 | X/10 | 一句话说明 |
| **综合** | **X/10** | 一句话总结 |
```

# ── 审核原则 ──────────────────────────────────────────

1. **先肯定，再指出问题** — 不要只挑毛病，好的代码也要指出来
2. **解释 WHY，不仅是 WHAT** — 每个问题都要说清楚「为什么不好」和「可能导致什么后果」
3. **给出具体修复代码** — 不要只说"这里有问题"，要给出改好后的写法
4. **区分严重级别** — 不要把小问题标成必须修复，也不要把严重 bug 标成小建议
5. **尊重作者** — 用建设性的语气，避免 "这是错的" 这种措辞，用 "这里可以改进为..."
6. **不纠结格式** — 如果项目有 formatter/linter，格式问题跳过
7. **关注变更本身** — 如果是 diff，只审核变更的部分，不要评论未修改的代码
8. **没有代码时** — 直接要求提交代码，不要编造审核结果"""


def _build_llm():
    """Build the LLM based on environment configuration."""
    use_ollama = os.getenv("USE_OLLAMA", "").lower() in ("1", "true", "yes")

    if use_ollama:
        from langchain_ollama import ChatOllama
        model = os.getenv("OLLAMA_MODEL", "qwen2.5")
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        return ChatOllama(model=model, base_url=base_url, temperature=0.2)

    provider = os.getenv("LLM_PROVIDER", "openai").lower()

    if provider == "deepseek":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
            temperature=0.2,
            max_tokens=4096,
        )

    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0.2,
        max_tokens=4096,
    )


class CodeReviewAgent:
    """LangChain-based code review agent."""

    def __init__(self):
        self.llm = _build_llm()
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("human", "{input}"),
        ])
        self.chain = self.prompt | self.llm | StrOutputParser()

    def review(self, code_or_diff: str) -> str:
        """
        Review the given code or diff.

        Args:
            code_or_diff: Source code, git diff, or PR description to review.

        Returns:
            Structured review report as markdown text.
        """
        if not code_or_diff.strip():
            return "No code provided. Please submit code or a diff to review."

        return self.chain.invoke({"input": code_or_diff})

```

### Core Architecture Module: `agents/langchain-code-reviewer/server.py`
```
"""
LangChain Code Review Agent — A2A-compatible server.

Exposes a code review agent via Google's A2A protocol so that
OpenFang workflows can call it as an external agent.

Start:
    OPENAI_API_KEY=sk-xxx python server.py
    # or with Ollama (no key needed):
    USE_OLLAMA=1 python server.py

Endpoints:
    GET  /.well-known/agent.json   — A2A Agent Card
    POST /a2a                      — JSON-RPC task endpoint
"""

import os
import uuid
import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

from agent import CodeReviewAgent

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "9100"))
BASE_URL = os.getenv("BASE_URL", f"http://127.0.0.1:{PORT}")

app = FastAPI(title="LangChain Code Review Agent")
agent = CodeReviewAgent()

# In-memory task store
tasks: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# A2A Agent Card
# ---------------------------------------------------------------------------

AGENT_CARD = {
    "name": "langchain-code-reviewer",
    "description": (
        "LangChain-powered code review agent. "
        "Analyzes code for bugs, security issues, performance problems, "
        "and style violations. Returns structured review with severity levels."
    ),
    "url": f"{BASE_URL}/a2a",
    "version": "0.1.0",
    "capabilities": {
        "streaming": False,
        "pushNotifications": False,
        "stateTransitionHistory": True,
    },
    "skills": [
        {
            "id": "code-review",
            "name": "Code Review",
            "description": "Review code for correctness, security, performance, and style",
            "tags": ["code", "review", "security", "quality"],
            "examples": [
                "Review this Python function for bugs",
                "Check this Rust code for security issues",
                "Analyze this PR diff for performance problems",
            ],
        },
        {
            "id": "pr-review",
            "name": "Pull Request Review",
            "description": "Review a git diff / pull request",
            "tags": ["pr", "diff", "git"],
            "examples": [
                "Review this PR diff",
                "Analyze these changes",
            ],
        },
    ],
    "defaultInputModes": ["text"],
    "defaultOutputModes": ["text"],
}


@app.get("/.well-known/agent.json")
async def agent_card():
    return JSONResponse(content=AGENT_CARD)


# ---------------------------------------------------------------------------
# A2A JSON-RPC Endpoint
# ---------------------------------------------------------------------------


@app.post("/a2a")
async def a2a_endpoint(request: Request):
    body = await request.json()

    jsonrpc = body.get("jsonrpc", "2.0")
    req_id = body.get("id", 1)
    method = body.get("method", "")
    params = body.get("params", {})

    if method == "tasks/send":
        return await handle_tasks_send(jsonrpc, req_id, params)
    elif method == "tasks/get":
        return handle_tasks_get(jsonrpc, req_id, params)
    elif method == "tasks/cancel":
        return handle_tasks_cancel(jsonrpc, req_id, params)
    else:
        return JSONResponse(content={
            "jsonrpc": jsonrpc,
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        })


async def handle_tasks_send(jsonrpc: str, req_id: int, params: dict):
    message = params.get("message", {})
    session_id = params.get("sessionId")
    task_id = str(uuid.uuid4())

    text_parts = [
        p["text"] for p in message.get("parts", []) if p.get("type") == "text"
    ]
    user_input = "\n".join(text_parts)

    task = {
        "id": task_id,
        "sessionId": session_id,
        "status": {"state": "working", "message": None},
        "messages": [message],
        "artifacts": [],
    }
    tasks[task_id] = task

    try:
        review_result = await asyncio.to_thread(agent.review, user_input)

        agent_message = {
            "role": "agent",
            "parts": [{"type": "text", "text": review_result}],
        }
        task["messages"].append(agent_message)
        task["status"] = {"state": "completed", "message": None}
        task["artifacts"] = [
            {
                "name": "code-review-report",
                "description": "Structured code review report",
                "parts": [{"type": "text", "text": review_result}],
                "index": 0,
                "lastChunk": True,
            }
        ]
    except Exception as e:
        task["status"] = {"state": "failed", "message": str(e)}
        task["messages"].append({
            "role": "agent",
            "parts": [{"type": "text", "text": f"Review failed: {e}"}],
        })

    return JSONResponse(content={
        "jsonrpc": jsonrpc,
        "id": req_id,
        "result": task,
    })


def handle_tasks_get(jsonrpc: str, req_id: int, params: dict):
    task_id = params.get("id", "")
    task = tasks.get(task_id)

    if task is None:
        return JSONResponse(content={
            "jsonrpc": jsonrpc,
            "id": req_id,
            "error": {"code": -32000, "message": f"Task not found: {task_id}"},
        })

    return JSONResponse(content={
        "jsonrpc": jsonrpc,
        "id": req_id,
        "result": task,
    })


def handle_tasks_cancel(jsonrpc: str, req_id: int, params: dict):
    task_id = params.get("id", "")
    task = tasks.get(task_id)

    if task is None:
        return JSONResponse(content={
            "jsonrpc": jsonrpc,
            "id": req_id,
            "error": {"code": -32000, "message": f"Task not found: {task_id}"},
        })

    task["status"] = {"state": "cancelled", "message": None}
    return JSONResponse(content={
        "jsonrpc": jsonrpc,
        "id": req_id,
        "result": task,
    })


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "agent": "langchain-code-reviewer", "tasks": len(tasks)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Starting LangChain Code Review Agent on {HOST}:{PORT}")
    print(f"Agent Card: {BASE_URL}/.well-known/agent.json")
    print(f"A2A endpoint: {BASE_URL}/a2a")
    uvicorn.run(app, host=HOST, port=PORT)

```

### Core Architecture Module: `crates/openfang-api/src/channel_bridge.rs`
```
//! Channel bridge wiring — connects the OpenFang kernel to channel adapters.
//!
//! Implements `ChannelBridgeHandle` on `OpenFangKernel` and provides the
//! `start_channel_bridge()` entry point called by the daemon.

use openfang_channels::bridge::{BridgeManager, ChannelBridgeHandle};
use openfang_channels::discord::DiscordAdapter;
use openfang_channels::email::EmailAdapter;
use openfang_channels::google_chat::GoogleChatAdapter;
use openfang_channels::irc::IrcAdapter;
use openfang_channels::matrix::MatrixAdapter;
use openfang_channels::mattermost::MattermostAdapter;
use openfang_channels::rocketchat::RocketChatAdapter;
use openfang_channels::router::AgentRouter;
use openfang_channels::signal::SignalAdapter;
use openfang_channels::slack::SlackAdapter;
use openfang_channels::teams::TeamsAdapter;
use openfang_channels::telegram::TelegramAdapter;
use openfang_channels::twitch::TwitchAdapter;
use openfang_channels::types::ChannelAdapter;
use openfang_channels::whatsapp::WhatsAppAdapter;
use openfang_channels::xmpp::XmppAdapter;
use openfang_channels::zulip::ZulipAdapter;
// Wave 3
use openfang_channels::bluesky::BlueskyAdapter;
use openfang_channels::feishu::FeishuAdapter;
use openfang_channels::line::LineAdapter;
use openfang_channels::mastodon::MastodonAdapter;
use openfang_channels::messenger::MessengerAdapter;
use openfang_channels::reddit::RedditAdapter;
use openfang_channels::revolt::RevoltAdapter;
use openfang_channels::viber::ViberAdapter;
use openfang_types::config::FeishuMode;
// Wave 4
use openfang_channels::flock::FlockAdapter;
use openfang_channels::guilded::GuildedAdapter;
use openfang_channels::keybase::KeybaseAdapter;
use openfang_channels::nextcloud::NextcloudAdapter;
use openfang_channels::nostr::NostrAdapter;
use openfang_channels::pumble::PumbleAdapter;
use openfang_channels::threema::ThreemaAdapter;
use openfang_channels::twist::TwistAdapter;
use openfang_channels::webex::WebexAdapter;
// Wave 5
use async_trait::async_trait;
use openfang_channels::dingtalk::DingTalkAdapter;
use openfang_channels::dingtalk_stream::DingTalkStreamAdapter;
use openfang_channels::discourse::DiscourseAdapter;
use openfang_channels::gitter::GitterAdapter;
use openfang_channels::gotify::GotifyAdapter;
use openfang_channels::linkedin::LinkedInAdapter;
use openfang_channels::mqtt::MqttAdapter;
use openfang_channels::mumble::MumbleAdapter;
use openfang_channels::ntfy::NtfyAdapter;
use openfang_channels::webhook::WebhookAdapter;
use openfang_channels::wecom::WeComAdapter;
use openfang_kernel::OpenFangKernel;
use openfang_runtime::kernel_handle::KernelHandle;
use openfang_types::agent::AgentId;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{error, info, warn};

use openfang_runtime::str_utils::safe_truncate_str;

/// Wraps `OpenFangKernel` to implement `ChannelBridgeHandle`.
pub struct KernelBridgeAdapter {
    kernel: Arc<OpenFangKernel>,
    started_at: Instant,
}

#[async_trait]
impl ChannelBridgeHandle for KernelBridgeAdapter {
    async fn send_message(&self, agent_id: AgentId, message: &str) -> Result<String, String> {
        let result = self
            .kernel
            .send_message(agent_id, message)
            .await
            .map_err(|e| format!("{e}"))?;
        // Silent/NO_REPLY responses should not be forwarded to channels
        if result.silent {
            return Ok(String::new());
        }
        Ok(result.response)
    }

    async fn send_message_with_blocks(
        &self,
        agent_id: AgentId,
        blocks: Vec<openfang_types::message::ContentBlock>,
    ) -> Result<String, String> {
        // Extract text for the message parameter (used for memory recall / logging)
        let text: String = blocks
            .iter()
            .filter_map(|b| match b {
                openfang_types::message::ContentBlock::Text { text, .. } => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n");
        let text = if text.is_empty() {
            "[Image]".to_string()
        } else {
            text
        };
        let result = self
            .kernel
            .send_message_with_blocks(agent_id, &text, blocks)
            .await
            .map_err(|e| format!("{e}"))?;
        Ok(result.response)
    }

    async fn find_agent_by_name(&self, name: &str) -> Result<Option<AgentId>, String> {
        Ok(self.kernel.registry.find_by_name(name).map(|e| e.id))
    }

    async fn list_agents(&self) -> Result<Vec<(AgentId, String)>, String> {
        Ok(self
            .kernel
            .registry
            .list()
            .iter()
            .map(|e| (e.id, e.name.clone()))
            .collect())
    }

    async fn spawn_agent_by_name(&self, manifest_name: &str) -> Result<AgentId, String> {
        // Look for manifest at ~/.openfang/agents/{name}/agent.toml
        let manifest_path = self
            .kernel
            .config
            .home_dir
            .join("agents")
            .join(manifest_name)
            .join("agent.toml");

        if !manifest_path.exists() {
            return Err(format!("Manifest not found: {}", manifest_path.display()));
        }

        let contents = std::fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest: {e}"))?;

        let manifest: openfang_types::agent::AgentManifest =
            toml::from_str(&contents).map_err(|e| format!("Invalid manifest TOML: {e}"))?;

        let agent_id = self
            .kernel
            .spawn_agent(manifest)
            .map_err(|e| format!("Failed to spawn agent: {e}"))?;

        Ok(agent_id)
    }

    async fn uptime_info(&self) -> String {
        let uptime = self.started_at.elapsed();
        let agents = self.list_agents().await.unwrap_or_default();
        let secs = uptime.as_secs();
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        if hours > 0 {
            format!(
                "OpenFang status: {}h {}m uptime, {} agent(s)",
                hours,
                mins,
                agents.len()
            )
        } else {
            format!(
                "OpenFang status: {}m uptime, {} agent(s)",
                mins,
                agents.len()
            )
        }
    }

    async fn list_models_text(&self) -> String {
        let catalog = self
            .kernel
            .model_catalog
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let available = catalog.available_models();
        if available.is_empty() {
            return "No models available. Configure API keys to enable providers.".to_string();
        }
        let mut msg = format!("Available models ({}):\n", available.len());
        // Group by provider
        let mut by_provider: std::collections::HashMap<
            &str,
            Vec<&openfang_types::model_catalog::ModelCatalogEntry>,
        > = std::collections::HashMap::new();
        for m in &available {
            by_provider.entry(m.provider.as_str()).or_default().push(m);
        }
        let mut providers: Vec<&&str> = by_provider.keys().collect();
        providers.sort();
        for provider in providers {
            let provider_name = catalog
                .get_provider(provider)
                .map(|p| p.display_name.as_str())
                .unwrap_or(provider);
            msg.push_str(&format!("\n{}:\n", provider_name));
            for m in &by_provider[provider] {
                let cost = if m.input_cost_per_m > 0.0 {
                    format!(
                        " (${:.2}/${:.2} per M)",
                        m.input_cost_per_m, m.output_cost_per_m
                    )
                } else {
                    " (free/local)".to_string()
                };
                msg.push_str(&format!("  {} — {}{}\n", m.id, m.display_name, cost));
            }
        }
        msg
    }

    async fn list_providers_text(&self) -> String {
       
```

### Core Architecture Module: `crates/openfang-api/src/lib.rs`
```
//! HTTP/WebSocket API server for the OpenFang Agent OS daemon.
//!
//! Exposes agent management, status, and chat via JSON REST endpoints.
//! The kernel runs in-process; the CLI connects over HTTP.

/// Decode percent-encoded strings (e.g. `%2B` → `+`).
/// Used to normalise `?token=` values that browsers encode with `encodeURIComponent`.
pub(crate) fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                out.push(hi << 4 | lo);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| input.to_string())
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

pub mod channel_bridge;
pub mod middleware;
pub mod openai_compat;
pub mod rate_limiter;
pub mod routes;
pub mod server;
pub mod session_auth;
pub mod stream_chunker;
pub mod stream_dedup;
pub mod types;
pub mod webchat;
pub mod ws;

```

### Core Architecture Module: `crates/openfang-api/src/middleware.rs`
```
//! Production middleware for the OpenFang API server.
//!
//! Provides:
//! - Request ID generation and propagation
//! - Per-endpoint structured request logging
//! - In-memory rate limiting (per IP)

use axum::body::Body;
use axum::http::{Request, Response, StatusCode};
use axum::middleware::Next;
use std::time::Instant;
use tracing::info;

/// Request ID header name (standard).
pub const REQUEST_ID_HEADER: &str = "x-request-id";

/// Middleware: inject a unique request ID and log the request/response.
pub async fn request_logging(request: Request<Body>, next: Next) -> Response<Body> {
    let request_id = uuid::Uuid::new_v4().to_string();
    let method = request.method().clone();
    let uri = request.uri().path().to_string();
    let start = Instant::now();

    let mut response = next.run(request).await;

    let elapsed = start.elapsed();
    let status = response.status().as_u16();

    info!(
        request_id = %request_id,
        method = %method,
        path = %uri,
        status = status,
        latency_ms = elapsed.as_millis() as u64,
        "API request"
    );

    // Inject the request ID into the response
    if let Ok(header_val) = request_id.parse() {
        response.headers_mut().insert(REQUEST_ID_HEADER, header_val);
    }

    response
}

/// Authentication state passed to the auth middleware.
#[derive(Clone)]
pub struct AuthState {
    pub api_key: String,
    pub auth_enabled: bool,
    pub session_secret: String,
    /// Set from `OPENFANG_ALLOW_NO_AUTH=1` to permit running without an api_key
    /// on a non-loopback bind. Off by default so empty keys fail closed.
    pub allow_no_auth: bool,
}

/// Bearer token authentication middleware.
///
/// When `api_key` is non-empty (after trimming), requests to non-public
/// endpoints must include `Authorization: Bearer <api_key>`.
///
/// When `api_key` is empty (no key configured) the server defaults to
/// fail-closed for any request that does NOT originate from loopback.
/// Loopback traffic (127.0.0.1 / ::1) is always allowed through with no
/// key so single-user local setups keep zero-config UX. To explicitly
/// run a no-auth server on a LAN/WAN address, set
/// `OPENFANG_ALLOW_NO_AUTH=1`; this opts out of fail-closed and is
/// reported loudly at startup.
///
/// When dashboard auth is enabled, session cookies are also accepted.
pub async fn auth(
    axum::extract::State(auth_state): axum::extract::State<AuthState>,
    request: Request<Body>,
    next: Next,
) -> Response<Body> {
    // SECURITY: Capture method early for method-aware public endpoint checks.
    let method = request.method().clone();

    let is_loopback = request
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip().is_loopback())
        .unwrap_or(false); // SECURITY: default-deny; unknown origin is NOT loopback

    // Shutdown is loopback-only (CLI on same machine). Skip token auth only
    // when the request is from loopback.
    let path = request.uri().path();
    if path == "/api/shutdown" && is_loopback {
        return next.run(request).await;
    }

    // Public endpoints that don't require auth (dashboard needs these).
    // SECURITY: /api/agents is GET-only (listing). POST (spawn) requires auth.
    // SECURITY: Public endpoints are GET-only unless explicitly noted.
    // POST/PUT/DELETE to any endpoint ALWAYS requires auth to prevent
    // unauthenticated writes (cron job creation, skill install, etc.).
    let is_get = method == axum::http::Method::GET;
    let is_public = path == "/"
        || path == "/logo.png"
        || path == "/favicon.ico"
        || (path == "/.well-known/agent.json" && is_get)
        || (path.starts_with("/a2a/") && is_get)
        || path == "/api/health"
        || path == "/api/health/detail"
        || path == "/api/status"
        || path == "/api/version"
        || (path == "/api/agents" && is_get)
        || (path == "/api/profiles" && is_get)
        || (path == "/api/config" && is_get)
        || (path == "/api/config/schema" && is_get)
        || (path.starts_with("/api/uploads/") && is_get)
        // Dashboard read endpoints — allow unauthenticated so the SPA can
        // render before the user enters their API key.
        || (path == "/api/models" && is_get)
        || (path == "/api/models/aliases" && is_get)
        || (path == "/api/providers" && is_get)
        || (path == "/api/budget" && is_get)
        || (path == "/api/budget/agents" && is_get)
        || (path.starts_with("/api/budget/agents/") && is_get)
        || (path == "/api/network/status" && is_get)
        || (path == "/api/a2a/agents" && is_get)
        || (path == "/api/approvals" && is_get)
        || (path.starts_with("/api/approvals/") && is_get)
        || (path == "/api/channels" && is_get)
        || (path == "/api/hands" && is_get)
        || (path == "/api/hands/active" && is_get)
        || (path.starts_with("/api/hands/") && is_get)
        || (path == "/api/skills" && is_get)
        || (path.starts_with("/api/skills/") && path.ends_with("/config") && is_get)
        || (path == "/api/sessions" && is_get)
        || (path == "/api/integrations" && is_get)
        || (path == "/api/integrations/available" && is_get)
        || (path == "/api/integrations/health" && is_get)
        || (path == "/api/workflows" && is_get)
        || path == "/api/logs/stream"  // SSE stream, read-only
        || (path.starts_with("/api/cron/") && is_get)
        || path.starts_with("/api/providers/github-copilot/oauth/")
        || path == "/api/auth/login"
        || path == "/api/auth/logout"
        || (path == "/api/auth/check" && is_get);

    if is_public {
        return next.run(request).await;
    }

    // If no API key configured and no dashboard login is active, fail closed
    // for anything that did not come from loopback. Opting out of this
    // behavior requires setting `OPENFANG_ALLOW_NO_AUTH=1`, which is logged
    // loudly at startup.
    //
    // See issue #1034 (B1/B2): empty api_key previously bypassed auth for
    // all origins, exposing agent config, channel tokens, and LLM keys on
    // any LAN-reachable bind.
    let api_key_trimmed = auth_state.api_key.trim().to_string();
    if api_key_trimmed.is_empty() && !auth_state.auth_enabled {
        if is_loopback || auth_state.allow_no_auth {
            return next.run(request).await;
        }
        return Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header("www-authenticate", "Bearer")
            .body(Body::from(
                serde_json::json!({
                    "error": "API key required for non-loopback requests. Set OPENFANG_API_KEY or bind to 127.0.0.1."
                })
                .to_string(),
            ))
            .unwrap_or_default();
    }
    let api_key = api_key_trimmed.as_str();

    // Check Authorization: Bearer <token> header, then fallback to X-API-Key
    let bearer_token = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    let api_token = bearer_token.or_else(|| {
        request
            .headers()
            .get("x-api-key")
            .and_then(|v| v.to_str().ok())
    });

    // SECURITY: Use constant-time comparison to prevent timing attacks.
    let header_auth = api_token.map(|token| {
        use subtle::ConstantTimeEq;
        if token.len() != api_key.len() {
            return false;
        }
        token.as_bytes().ct_eq(api_key.as_bytes()).into()
    });

    // Also check ?token= query parameter (for EventSource/SSE clients that
    // cannot set custom headers, same approach as WebSocket auth).
    let query_token_decoded = request
        .uri()
        .query()
        .and_then(|q| q.split('&').find_map(|pair| pair.strip_prefix("token=")))
        .map(crate::percent_decode);

    // SECURITY: Use constant-time comparison to pr
```

### Core Architecture Module: `crates/openfang-api/src/openai_compat.rs`
```
//! OpenAI-compatible `/v1/chat/completions` API endpoint.
//!
//! Allows any OpenAI-compatible client library to talk to OpenFang agents.
//! The `model` field resolves to an agent (by name, UUID, or `openfang:<name>`),
//! and the messages are forwarded to the agent's LLM loop.
//!
//! Supports both streaming (SSE) and non-streaming responses.

use crate::routes::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::sse::{Event as SseEvent, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::Json;
use openfang_runtime::kernel_handle::KernelHandle;
use openfang_runtime::llm_driver::StreamEvent;
use openfang_types::agent::AgentId;
use openfang_types::message::{ContentBlock, Message, MessageContent, Role, StopReason};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use tracing::warn;

// ── Request types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<OaiMessage>,
    #[serde(default)]
    pub stream: bool,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct OaiMessage {
    pub role: String,
    #[serde(default)]
    pub content: OaiContent,
}

#[derive(Debug, Deserialize, Default)]
#[serde(untagged)]
pub enum OaiContent {
    Text(String),
    Parts(Vec<OaiContentPart>),
    #[default]
    Null,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum OaiContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image_url")]
    ImageUrl { image_url: OaiImageUrlRef },
}

#[derive(Debug, Deserialize)]
pub struct OaiImageUrlRef {
    pub url: String,
}

// ── Response types ──────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ChatCompletionResponse {
    id: String,
    object: &'static str,
    created: u64,
    model: String,
    choices: Vec<Choice>,
    usage: UsageInfo,
}

#[derive(Serialize)]
struct Choice {
    index: u32,
    message: ChoiceMessage,
    finish_reason: &'static str,
}

#[derive(Serialize)]
struct ChoiceMessage {
    role: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OaiToolCall>>,
}

#[derive(Serialize)]
struct UsageInfo {
    prompt_tokens: u64,
    completion_tokens: u64,
    total_tokens: u64,
}

#[derive(Serialize)]
struct ChatCompletionChunk {
    id: String,
    object: &'static str,
    created: u64,
    model: String,
    choices: Vec<ChunkChoice>,
}

#[derive(Serialize)]
struct ChunkChoice {
    index: u32,
    delta: ChunkDelta,
    finish_reason: Option<&'static str>,
}

#[derive(Serialize)]
struct ChunkDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OaiToolCall>>,
}

#[derive(Serialize, Clone)]
struct OaiToolCall {
    index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "type")]
    call_type: Option<&'static str>,
    function: OaiToolCallFunction,
}

#[derive(Serialize, Clone)]
struct OaiToolCallFunction {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    arguments: Option<String>,
}

#[derive(Serialize)]
struct ModelObject {
    id: String,
    object: &'static str,
    created: u64,
    owned_by: String,
}

#[derive(Serialize)]
struct ModelListResponse {
    object: &'static str,
    data: Vec<ModelObject>,
}

// ── Agent resolution ────────────────────────────────────────────────────────

fn resolve_agent(state: &AppState, model: &str) -> Option<(AgentId, String)> {
    // 1. "openfang:<name>" → find agent by name
    if let Some(name) = model.strip_prefix("openfang:") {
        if let Some(entry) = state.kernel.registry.find_by_name(name) {
            return Some((entry.id, entry.name.clone()));
        }
    }

    // 2. Valid UUID → find agent by ID
    if let Ok(id) = model.parse::<AgentId>() {
        if let Some(entry) = state.kernel.registry.get(id) {
            return Some((entry.id, entry.name.clone()));
        }
    }

    // 3. Plain string → try as agent name
    if let Some(entry) = state.kernel.registry.find_by_name(model) {
        return Some((entry.id, entry.name.clone()));
    }

    // No match — return None so the caller returns a proper 404
    None
}

// ── Message conversion ──────────────────────────────────────────────────────

fn convert_messages(oai_messages: &[OaiMessage]) -> Vec<Message> {
    oai_messages
        .iter()
        .filter_map(|m| {
            let role = match m.role.as_str() {
                "user" => Role::User,
                "assistant" => Role::Assistant,
                "system" => Role::System,
                _ => Role::User,
            };

            let content = match &m.content {
                OaiContent::Text(text) => MessageContent::Text(text.clone()),
                OaiContent::Parts(parts) => {
                    let blocks: Vec<ContentBlock> = parts
                        .iter()
                        .filter_map(|part| match part {
                            OaiContentPart::Text { text } => Some(ContentBlock::Text {
                                text: text.clone(),
                                provider_metadata: None,
                            }),
                            OaiContentPart::ImageUrl { image_url } => {
                                // Parse data URI: data:{media_type};base64,{data}
                                if let Some(rest) = image_url.url.strip_prefix("data:") {
                                    let parts: Vec<&str> = rest.splitn(2, ',').collect();
                                    if parts.len() == 2 {
                                        let media_type = parts[0]
                                            .strip_suffix(";base64")
                                            .unwrap_or(parts[0])
                                            .to_string();
                                        let data = parts[1].to_string();
                                        Some(ContentBlock::Image { media_type, data })
                                    } else {
                                        None
                                    }
                                } else {
                                    // URL-based images not supported (would require fetching)
                                    None
                                }
                            }
                        })
                        .collect();
                    if blocks.is_empty() {
                        return None;
                    }
                    MessageContent::Blocks(blocks)
                }
                OaiContent::Null => return None,
            };

            Some(Message {
                msg_id: uuid::Uuid::new_v4().to_string(),
                provider_msg_id: None,
                role,
                content,
            })
        })
        .collect()
}

// ── Handlers ────────────────────────────────────────────────────────────────

/// POST /v1/chat/completions
pub async fn chat_completions(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChatCompletionRequest>,
) -> impl IntoResponse {
    let (agent_id, agent_name) = match resolve_agent(&state, &req.model) {
        Some(pair) => pair,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": {
                        "message": format!("No agent foun
```

### Core Architecture Module: `crates/openfang-api/src/rate_limiter.rs`
```
//! Cost-aware rate limiting using GCRA (Generic Cell Rate Algorithm).
//!
//! Each API operation has a token cost (e.g., health=1, spawn=50, message=30).
//! The GCRA algorithm allows 500 tokens per minute per IP address.

use axum::body::Body;
use axum::http::{Request, Response, StatusCode};
use axum::middleware::Next;
use governor::{clock::DefaultClock, state::keyed::DashMapStateStore, Quota, RateLimiter};
use std::net::{IpAddr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::Arc;

pub fn operation_cost(method: &str, path: &str) -> NonZeroU32 {
    match (method, path) {
        (_, "/api/health") => NonZeroU32::new(1).unwrap(),
        ("GET", "/api/status") => NonZeroU32::new(1).unwrap(),
        ("GET", "/api/version") => NonZeroU32::new(1).unwrap(),
        ("GET", "/api/tools") => NonZeroU32::new(1).unwrap(),
        ("GET", "/api/agents") => NonZeroU32::new(2).unwrap(),
        ("GET", "/api/skills") => NonZeroU32::new(2).unwrap(),
        ("GET", "/api/peers") => NonZeroU32::new(2).unwrap(),
        ("GET", "/api/config") => NonZeroU32::new(2).unwrap(),
        ("GET", "/api/usage") => NonZeroU32::new(3).unwrap(),
        ("GET", p) if p.starts_with("/api/audit") => NonZeroU32::new(5).unwrap(),
        ("GET", p) if p.starts_with("/api/marketplace") => NonZeroU32::new(10).unwrap(),
        ("POST", "/api/agents") => NonZeroU32::new(50).unwrap(),
        ("POST", p) if p.contains("/message") => NonZeroU32::new(30).unwrap(),
        ("POST", p) if p.contains("/run") => NonZeroU32::new(100).unwrap(),
        ("POST", "/api/skills/install") => NonZeroU32::new(50).unwrap(),
        ("POST", "/api/skills/uninstall") => NonZeroU32::new(10).unwrap(),
        ("POST", "/api/skills/reload") => NonZeroU32::new(5).unwrap(),
        ("GET", p) if p.starts_with("/api/skills/") && p.ends_with("/config") => {
            NonZeroU32::new(3).unwrap()
        }
        ("PUT", p) if p.starts_with("/api/skills/") && p.ends_with("/config") => {
            NonZeroU32::new(10).unwrap()
        }
        ("DELETE", p) if p.starts_with("/api/skills/") && p.contains("/config/") => {
            NonZeroU32::new(10).unwrap()
        }
        ("POST", "/api/migrate") => NonZeroU32::new(100).unwrap(),
        ("PUT", p) if p.contains("/update") => NonZeroU32::new(10).unwrap(),
        _ => NonZeroU32::new(5).unwrap(),
    }
}

pub type KeyedRateLimiter = RateLimiter<IpAddr, DashMapStateStore<IpAddr>, DefaultClock>;

/// 500 tokens per minute per IP.
pub fn create_rate_limiter() -> Arc<KeyedRateLimiter> {
    Arc::new(RateLimiter::keyed(Quota::per_minute(
        NonZeroU32::new(500).unwrap(),
    )))
}

/// GCRA rate limiting middleware.
///
/// Extracts the client IP from `ConnectInfo`, computes the cost for the
/// requested operation, and checks the GCRA limiter. Returns 429 if the
/// client has exhausted its token budget.
pub async fn gcra_rate_limit(
    axum::extract::State(limiter): axum::extract::State<Arc<KeyedRateLimiter>>,
    request: Request<Body>,
    next: Next,
) -> Response<Body> {
    let ip = request
        .extensions()
        .get::<axum::extract::ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip())
        .unwrap_or(IpAddr::from([127, 0, 0, 1]));

    let method = request.method().as_str().to_string();
    let path = request.uri().path().to_string();
    let cost = operation_cost(&method, &path);

    if limiter.check_key_n(&ip, cost).is_err() {
        tracing::warn!(ip = %ip, cost = cost.get(), path = %path, "GCRA rate limit exceeded");
        return Response::builder()
            .status(StatusCode::TOO_MANY_REQUESTS)
            .header("content-type", "application/json")
            .header("retry-after", "60")
            .body(Body::from(
                serde_json::json!({"error": "Rate limit exceeded"}).to_string(),
            ))
            .unwrap_or_default();
    }

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_costs() {
        assert_eq!(operation_cost("GET", "/api/health").get(), 1);
        assert_eq!(operation_cost("GET", "/api/tools").get(), 1);
        assert_eq!(operation_cost("POST", "/api/agents/1/message").get(), 30);
        assert_eq!(operation_cost("POST", "/api/agents").get(), 50);
        assert_eq!(operation_cost("POST", "/api/workflows/1/run").get(), 100);
        assert_eq!(operation_cost("GET", "/api/agents/1/session").get(), 5);
        assert_eq!(operation_cost("GET", "/api/skills").get(), 2);
        assert_eq!(operation_cost("GET", "/api/peers").get(), 2);
        assert_eq!(operation_cost("GET", "/api/audit/recent").get(), 5);
        assert_eq!(operation_cost("POST", "/api/skills/install").get(), 50);
        assert_eq!(operation_cost("POST", "/api/migrate").get(), 100);
    }
}

```

### Core Architecture Module: `crates/openfang-api/src/routes.rs`
```
//! Route handlers for the OpenFang API.

use crate::types::*;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use dashmap::DashMap;
use openfang_kernel::triggers::{TriggerId, TriggerPattern};
use openfang_kernel::workflow::{
    ErrorMode, StepAgent, StepMode, Workflow, WorkflowId, WorkflowStep,
};
use openfang_kernel::OpenFangKernel;
use openfang_runtime::kernel_handle::KernelHandle;
use openfang_runtime::tool_runner::builtin_tool_definitions;
use openfang_types::agent::{AgentId, AgentIdentity, AgentManifest};
use std::collections::HashMap;
use std::sync::{Arc, LazyLock};
use std::time::Instant;

/// Shared application state.
///
/// The kernel is wrapped in Arc so it can serve as both the main kernel
/// and the KernelHandle for inter-agent tool access.
pub struct AppState {
    pub kernel: Arc<OpenFangKernel>,
    pub started_at: Instant,
    /// Optional peer registry for OFP mesh networking status.
    pub peer_registry: Option<Arc<openfang_wire::registry::PeerRegistry>>,
    /// Channel bridge manager — held behind a Mutex so it can be swapped on hot-reload.
    pub bridge_manager: tokio::sync::Mutex<Option<openfang_channels::bridge::BridgeManager>>,
    /// Live channel config — updated on every hot-reload so list_channels() reflects reality.
    pub channels_config: tokio::sync::RwLock<openfang_types::config::ChannelsConfig>,
    /// Notify handle to trigger graceful HTTP server shutdown from the API.
    pub shutdown_notify: Arc<tokio::sync::Notify>,
    /// ClawHub response cache — prevents 429 rate limiting on rapid dashboard refreshes.
    /// Maps cache key → (fetched_at, response_json) with 120s TTL.
    pub clawhub_cache: DashMap<String, (Instant, serde_json::Value)>,
    /// Probe cache for local provider health checks (ollama/vllm/lmstudio).
    /// Avoids blocking the `/api/providers` endpoint on TCP timeouts to
    /// unreachable local services. 60-second TTL.
    pub provider_probe_cache: openfang_runtime::provider_health::ProbeCache,
    /// Thread-safe mutable budget config. Updated via PUT /api/budget.
    /// Initialized from `kernel.config.budget` at startup.
    pub budget_config: Arc<tokio::sync::RwLock<openfang_types::config::BudgetConfig>>,
}

/// POST /api/agents — Spawn a new agent.
pub async fn spawn_agent(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SpawnRequest>,
) -> impl IntoResponse {
    // Resolve template name → manifest_toml if template is provided and manifest_toml is empty
    let manifest_toml = if req.manifest_toml.trim().is_empty() {
        if let Some(ref tmpl_name) = req.template {
            // Sanitize template name to prevent path traversal
            let safe_name = tmpl_name
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
                .collect::<String>();
            if safe_name.is_empty() || safe_name != *tmpl_name {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({"error": "Invalid template name"})),
                );
            }
            let tmpl_path = state
                .kernel
                .config
                .home_dir
                .join("agents")
                .join(&safe_name)
                .join("agent.toml");
            match std::fs::read_to_string(&tmpl_path) {
                Ok(content) => content,
                Err(_) => {
                    return (
                        StatusCode::NOT_FOUND,
                        Json(
                            serde_json::json!({"error": format!("Template '{}' not found", safe_name)}),
                        ),
                    );
                }
            }
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(
                    serde_json::json!({"error": "Either 'manifest_toml' or 'template' is required"}),
                ),
            );
        }
    } else {
        req.manifest_toml.clone()
    };

    // SECURITY: Reject oversized manifests to prevent parser memory exhaustion.
    const MAX_MANIFEST_SIZE: usize = 1024 * 1024; // 1MB
    if manifest_toml.len() > MAX_MANIFEST_SIZE {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(serde_json::json!({"error": "Manifest too large (max 1MB)"})),
        );
    }

    // SECURITY: Verify Ed25519 signature when a signed manifest is provided
    if let Some(ref signed_json) = req.signed_manifest {
        match state.kernel.verify_signed_manifest(signed_json) {
            Ok(verified_toml) => {
                // Ensure the signed manifest matches the provided manifest_toml
                if verified_toml.trim() != manifest_toml.trim() {
                    tracing::warn!("Signed manifest content does not match manifest_toml");
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(
                            serde_json::json!({"error": "Signed manifest content does not match manifest_toml"}),
                        ),
                    );
                }
            }
            Err(e) => {
                tracing::warn!("Manifest signature verification failed: {e}");
                state.kernel.audit_log.record(
                    "system",
                    openfang_runtime::audit::AuditAction::AuthAttempt,
                    "manifest signature verification failed",
                    format!("error: {e}"),
                );
                return (
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({"error": "Manifest signature verification failed"})),
                );
            }
        }
    }

    let manifest: AgentManifest = match toml::from_str(&manifest_toml) {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!("Invalid manifest TOML: {e}");
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid manifest format"})),
            );
        }
    };

    let name = manifest.name.clone();
    match state.kernel.spawn_agent(manifest) {
        Ok(id) => {
            // Register in channel router so binding resolution finds the new agent
            if let Some(ref mgr) = *state.bridge_manager.lock().await {
                mgr.router().register_agent(name.clone(), id);
            }
            (
                StatusCode::CREATED,
                Json(serde_json::json!(SpawnResponse {
                    agent_id: id.to_string(),
                    name,
                })),
            )
        }
        Err(e) => {
            tracing::warn!("Spawn failed: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Agent spawn failed"})),
            )
        }
    }
}

/// GET /api/agents — List all agents.
pub async fn list_agents(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // Snapshot catalog once for enrichment
    let catalog = state.kernel.model_catalog.read().ok();
    let dm = &state.kernel.config.default_model;

    let agents: Vec<serde_json::Value> = state
        .kernel
        .registry
        .list()
        .into_iter()
        .map(|e| {
            // Resolve "default" provider/model to actual kernel defaults
            let provider =
                if e.manifest.model.provider.is_empty() || e.manifest.model.provider == "default" {
                    dm.provider.as_str()
                } else {
                    e.manifest.model.provider.as_str()
                };
            let model = if e.manifest.model.model.is_empty() || e.manifest.model.model == "default"
            {
                dm.model.as_str()
            } else {
                e.manifest.model.model.as_str()
            };

            // Enrich from catalog
            let (tier, a
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1169** (2026-05-12): **shell_exec only receives HOME/PATH/PWD in Docker despite env vars present in PID 1 and passthrough allowlists**
  *Symptoms*: ### Description  ## Summary  In Docker on v0.6.4, `shell_exec` subprocesses only see a minimal environment (`HOME`, `PATH`, `PWD`) even though the full environment is present in the running `openfang` process and config passthrough/allowlists are set.  This looks related to the subprocess env-clearing behavior and may be similar in class to #660.  ## Version  - OpenFang: v0.6.4 - Deployment: Docker Compose - Restart method: always `docker compose down && docker compose up -d`    ## Actual  When the agent runs:  ```sh printenv ```  the complete output is only:  ```sh HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/linuxbrew/.linuxbrew/bin PWD=/data/workspaces/assistant ```  So `shell_exec` is getting only a minimal environment.  ## Proof the env vars are in the OpenFang process  Running this through the agent:  ```sh cat /proc/1/environ ```  shows PID 1 has the expected variables, including:  ```sh PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/linuxbrew/.linuxbrew/bin GOG_KEYRING_BACKEND=file GOG_CONFIG_DIR=/root/.config/gogcli OPENFANG_ALLOW_NO_AUTH=1 OPENFANG_HOME=/data GOG_ACCOUNT=<REDACTED> GEMINI_API_KEY=<REDACTED> OPENAI_API_KEY=<REDACTED> GOG_KEYRING_PASSWORD=<REDACTED> TZ=America/Chicago HOME=/root ```  So the environment is definitely present in the `openfang` service process, but not in the subprocess used by `shell_exec`.  ## Docker Compose environment resolution is correct  `docker compose config` resolve
  **Post-Mortem & Fix Analysis**:
  > Fixed in 5cc865e.  Root cause: subprocess_sandbox::sandbox_command calls env_clear() and only re-adds SAFE_ENV_VARS (PATH, HOME, TMPDIR, LANG, etc.). The exec_policy.env_passthrough and tools.shell_exec.env_allowlist keys you set were silently dropped because no such fields existed on ExecPolicy. Only hand-granted vars were ever forwarded.  Fix: added shell_env_passthrough: Vec<String> on ExecPolicy with serde aliases env_passthrough and env_allowlist for backwards compat with what you tried. Each entry is an env var name forwarded into the shell_exec subprocess. "*" forwards everything from the parent process.  Usage:  [exec_policy] mode = "full" shell_env_passthrough = ["TZ", "GOG_ACCOUNT", "GOG_CONFIG_DIR", "GOG_KEYRING_BACKEND", "GOG_KEYRING_PASSWORD"]  Or all-in:  [exec_policy] mode = "full" shell_env_passthrough = ["*"]  Wildcard is unsafe in shared environments since it leaks API keys present in PID 1. Prefer the explicit list.  Ships in the next release.

- **Issue #1167** (2026-05-12): **LaTeX/Mathematical Equations Not Rendering in Chat in Openfang Web**
  *Symptoms*: ### Description  When markdown files containing LaTeX equations (enclosed in `$...$` or `$$...$$`) are viewed in OpenFang's web dashboard or embedded views, the mathematical notation does not render. The raw LaTeX code is displayed as plain text instead.  ### Example  Expected: Properly formatted mathematical equation  Actual: Raw text `$$T = 2\pi \sqrt{\frac{I}{mgh}}$$` displayed  ### Cause  OpenFang's markdown viewer does not include a LaTeX rendering library (KaTeX or MathJax). When .md files containing math expressions are displayed in the dashboard or embedded views, the raw LaTeX source is shown as plain text instead of rendered equations.  ### Request  Consider one of the following solutions:  1. **Use images** — Replace inline math with pre-rendered images of equations 2. **Use Unicode math** — Replace LaTeX with Unicode symbols (e.g., √, π, α, β) 3. **Add client-side rendering** — Embed KaTeX/MathJax via GitHub Pages or browser extension 4. **Document limitation** — Add a note to contribution guidelines that equations must be submitted as images or Unicode   ### Expected Behavior  The latex math should have been rendered correctly.  ### Steps to Reproduce  Ask the following question from openfang  "to determine the acceleration due to gravity using a bar pendulum"  ### OpenFang Version  0.6.4  ### Operating System  Linux (x86_64)
  **Post-Mortem & Fix Analysis**:
  > ## CSP Blocking KaTeX CDN  The original issue (LaTeX not rendering) was caused by **Content Security Policy (CSP)** blocking the jsdelivr CDN from which KaTeX was being loaded dynamically.  ### Root Cause The dashboard's CSP only allowed scripts from `'self'` and `'unsafe-eval'`. When `katex.js` tried to load KaTeX from `https://cdn.jsdelivr.net`, the browser blocked it due to CSP.  ### Fix Updated the CSP in `webchat.rs` to allow loading from `cdn.jsdelivr.net` for scripts, styles, fonts, and network requests:  ```rust script-src 'self' 'nonce-{nonce}' 'unsafe-eval' https://cdn.jsdelivr.net; \ connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* https://cdn.jsdelivr.net; \ style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net; \ font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; \ ```  Additionally, added a **MutationObserver** in `chat.js` to automatically detect and render

- **Issue #1161** (2026-05-12): **Website is down / DNS or domain expired**
  *Symptoms*: ### Description  The official website is down and DNS cannot resolve an IP  ### Expected Behavior  Website to load  ### Steps to Reproduce  open https://openfang.sh/  ### OpenFang Version  0.3  ### Operating System  Other  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Domain has been restored. Closing as resolved.

- **Issue #1160** (2026-05-12): **MacOS custom certificate**
  *Symptoms*: ### Description  I added a custom openai compatible provider that uses a self signed certificate. The CA is trusted by the keychain in MacOS but openfang fails. The connection is immediately destroyed after it tried to initiate TLS.  ### Expected Behavior  Use the native TLS store of MacOS and just work.  ### Steps to Reproduce  - custom provider with self signed certificate - have ca trusted by system - try to test with any agent  ### OpenFang Version  0.6.4  ### Operating System  macOS (Apple Silicon)  ### Logs / Screenshots  ``` 202X-XX-XXTXX:XX:XX.XXXXXXZ DEBUG rustls::client::hs: No cached session for DnsName("[SERVICE_HOST]") 202X-XX-XXTXX:XX:XX.XXXXXXZ DEBUG rustls::client::hs: Not resuming any session 202X-XX-XXTXX:XX:XX.XXXXXXZ TRACE rustls::client::hs: Sending ClientHello Message {     version: TLSv1_0,     payload: Handshake {         parsed: HandshakeMessagePayload(             ClientHello(                 ClientHelloPayload {                     client_version: TLSv1_2,                     random: <omitted>,                     session_id: <omitted>,                     cipher_suites: [                         TLS13_AES_256_GCM_SHA384,                         TLS13_AES_128_GCM_SHA256,                         TLS13_CHACHA20_POLY1305_SHA256,                         TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,                         TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,                         TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,                         TL
  **Post-Mortem & Fix Analysis**:
  > Similar problem, adding "native-tls" to the list of features for reqwest should fix the problem, I assume.
  > Tracked alongside PR #1166 which adds the native-tls feature flag to reqwest. That PR is in changes-requested while we wait for the requesting use case description and the runtime ClientBuilder selection. Once #1166 lands with a runtime switch, macOS custom CAs through Keychain become usable. Closing here as a duplicate of #1166's outcome; please re-file if you have a specific scenario the workaround in #1166's discussion does not cover.

- **Issue #1157** (2026-05-12): **OpenAI-compat driver uses deprecated reasoning_content field — broken against vLLM ≥ 0.19.0**
  *Symptoms*: ### Description  Follow-up to #1098. OpenFang's OpenAI-compat driver re-emits persisted thinking as reasoning_content on assistant messages. vLLM deprecated and removed this field in v0.19.0 (PR #33402), renaming it to reasoning per OpenAI's GPT-OSS Responses-API convention.  Effect: for any reasoning model served by vLLM ≥ 0.19.0 (MiniMax M2, DeepSeek-R1, Qwen-thinking, GLM-thinking, GPT-OSS, …), persisted thinking is silently stripped by vLLM and never reaches the model — including for intra-turn agentic tool loops where it matters most.  Reproduction (direct vLLM /tokenize endpoint, vllm 0.19.2): sending an assistant message with reasoning_content: "MARKER-..." produces a rendered prompt with no <think> block; sending the same message with reasoning: "MARKER-..." produces <think>\nMARKER-...\n</think> in the prompt as expected.  Suggested fix: rename the outbound field from reasoning_content to reasoning in the OpenAI-compat driver. For backwards compatibility with older vLLM and other servers (some forks may still accept the old name), emit both fields.  Refs: vLLM RFC #27755, PR #33402.  ### Expected Behavior  Persisted assistant thinking (per the #1098 fix) should reach the model on subsequent turns when running against vLLM-served reasoning models — i.e. inside an agentic tool loop, the model's earlier reasoning blocks should appear as <think>...</think> content in the prompt sent to the model, so the model can build on its own prior thinking across tool-calling iterat
  **Post-Mortem & Fix Analysis**:
  > Fixed in efbefa1. OaiResponseMessage now accepts both reasoning_content (legacy) and reasoning (vLLM ≥ 0.19, PR #33402) on ingress via a new reasoning_text() helper that prefers the new field. OaiMessage emits BOTH fields on outbound so persisted thinking reaches the model regardless of server version. Streaming path already handled both names. Added 5 new tests covering vLLM 0.19+ shape, dual-field round-trip, preference order, Moonshot legacy behavior, and non-reasoning model regression guard.

- **Issue #1155** (2026-05-12): **Not possible for this to be bound to 0.0.0.0**
  *Symptoms*: ### Description  I have tried to change the bind address multiple times, the init command will reset the file everytime (daemon.json). This does not   trying to change the config to find to the address does not work either.   ### Expected Behavior  it would stay the same when i put it in the file allow for binding to external address.   ### Steps to Reproduce  any works, as long as you try openganf dashboard, init or start nothing helps  ### OpenFang Version  any  ### Operating System  Linux (x86_64)  ### Logs / Screenshots this should not exist 2026-05-03T08:09:50.510891Z  INFO openfang_api::server: WebSocket endpoint: ws://127.0.0.1:50051/api/agents/{id}/ws  i have changed this  _No response_
  **Post-Mortem & Fix Analysis**:
  > Also, in addition the init command will completely erease all changes I make to the config.toml file.
  > So i am finding the main issue is that the binding does work however, took me about 30 mintues to find the way to get it working in the right order, the issue of doing the commands always shows what looks to be a hardcoded value of localhost everytime. which leads to misleading information. 
  > If there are errors of anykind in the config file it will automatically start on locahost port and do 50051. Which is not what the config nor the daemon from previous launch even says this causes it to refer to a host address that is not only incorrect but making it required to physically get into the system ssh, terminal, or container terminal to change it reboot and restart the machine ..... this then requires erasing the daemon file to allow it to unbreak itself. 

- **Issue #1152** (2026-05-12): **How does one update openfang?**
  *Symptoms*: ### Description  Cant find any documentation or way to update   ### Expected Behavior  should update  ### Steps to Reproduce  .  ### OpenFang Version  any  ### Operating System  Linux (x86_64)  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > `curl -fsSL https://openfang.sh/update | sh`
  > Use `curl -fsSL https://openfang.sh/update | sh` on Linux/macOS or `irm https://openfang.sh/update.ps1 | iex` on Windows. The script preserves your config and just swaps the binary.

- **Issue #1141** (2026-05-12): **Add Shift+Enter to insert new line in chat input**
  *Symptoms*: ### Description  Currently, pressing Shift + Enter in the chat input sends the message immediately. There is no way to insert a line break without sending the message.  ### Expected Behavior  Support Shift + Enter to create a new line (line break) while Enter alone still sends the message.  ### Steps to Reproduce  1. Open any conversation in the Chat tab. 2. Type a line of text (e.g., "First line"). 3. Press Shift + Enter.  ### OpenFang Version  0.6.2  ### Operating System  Linux (x86_64)  ### Logs / Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > ## Fix Applied in PR #1176  ### Root Cause  Two issues were causing Shift+Enter not to work properly for multi-line input:  1. **Blocking default behavior unconditionally**: The textarea's `@keydown.enter.prevent` handler was calling `.preventDefault()` on every Enter keypress, even when Shift was held. This blocked the browser's default behavior of inserting a newline.  2. **Newlines not rendered in user messages**: The `escapeHtml()` function was not converting `\n` to `<br>`, so even when newlines were present in the text, they wouldn't display as line breaks in the chat bubble.  ### Changes Made  **File: `crates/openfang-api/static/index_body.html` (line 742)** - Changed `@keydown.enter.prevent` to `@keydown.enter` with conditional `$event.preventDefault()`  - Now `preventDefault()` is only called when `!$event.shiftKey`, allowing Shift+Enter to insert newlines naturally  **File: `crates/openfang-api/static/js/app.js` (line 21)** - Added `.replace(/\n/g, '<br>')` to `escapeHtml()` 

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

### Incident Patch 1: `4583157b` (2026-05-12)
**Commit Message**: audit fixes

**File**: `Cargo.lock` (modified, +76/-76)
```diff
@@ -139,7 +139,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -150,7 +150,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -893,7 +893,7 @@ version = "3.1.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "faf9468729b8cbcea668e36183cb69d317348c2e08e994829fb56ebfdfbaac34"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -1029,37 +1029,37 @@ dependencies = [
 
 [[package]]
 name = "cranelift-assembler-x64"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "046d4b584c3bb9b5eb500c8f29549bec36be11000f1ba2a927cef3d1a9875691"
+checksum = "adc822414b18d1f5b1b33ce1441534e311e62fef86ebb5b9d382af857d0272c9"
 dependencies = [
  "cranelift-assembler-x64-meta",
 ]
 
 [[package]]
 name = "cranelift-assembler-x64-meta"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b9b194a7870becb1490366fc0ae392ccd188065ff35f8391e77ac659db6fb977"
+checksum = "8c646808b06f4532478d8d6057d74f15c3322f10d995d9486e7dcea405bf521a"
 dependencies = [
  "cranelift-srcgen",
 ]
 
 [[package]]
 name = "cranelift-bforest"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bb6a4ab44c6b371e661846b97dab687387a60ac4e2f864e2d4257284aad9e889"
+checksum = "7b5996f01a686b2349cdb379083ec5ad3e8cb8767fb2d495d3a4f2ee4163a18d"
 dependencies = [
  "cranelift-entity",
  "wasmtime-internal-core",
 ]
 
 [[package]]
 name = "cranelift-bitset"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b8b7a44150c2f471a94023482bda1902710746e4bed9f9973d60c5a94319b06d"
+checksum = "523fea83273f6a985520f57788809a4de2165794d9ab00fb1254fceb4f5aa00c"
 dependencies = [
  "serde",
  "serde_derive",
@@ -1068,9 +1068,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "01b06598133b1dd76758b8b95f8d6747c124124aade50cea96a3d88b962da9fa"
+checksum = "d73d1e372730b5f64ed1a2bd9f01fe4686c8ec14a28034e3084e530c8d951878"
 dependencies = [
  "bumpalo",
  "cranelift-assembler-x64",
@@ -1096,9 +1096,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen-meta"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6190e2e7bcf0a678da2f715363d34ed530fedf7a2f0ab75edaefef72a70465ff"
+checksum = "b0319c18165e93dc1ebf78946a8da0b1c341c95b4a39729a69574671639bdb5f"
 dependencies = [
  "cranelift-assembler-x64-meta",
  "cranelift-codegen-shared",
@@ -1109,24 +1109,24 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen-shared"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f583cf203d1aa8b79560e3b01f929bdacf9070b015eec4ea9c46e22a3f83e4a0"
+checksum = "9195cd8aeecb55e401aa96b2eaa55921636e8246c127ed7908f7ef7e0d40f270"
 
 [[package]]
 name = "cranelift-control"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "803159df35cc398ae54473c150b16d6c77e92ab2948be638488de126a3328fbc"
+checksum = "8976c2154b74136322befc74222ab5c7249edd7e2604f8cbef2b94975541ffb9"
 dependencies = [
  "arbitrary",
 ]
 
 [[package]]
 name = "cranelift-entity"
-version = "0.130.1"
+version = "0.130.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3109e417257082d88087f5bcce6775
```

---

### Incident Patch 2: `4c496be0` (2026-05-12)
**Commit Message**: integration fixes

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ members = [
 ]
 
 [workspace.package]
-version = "0.6.7"
+version = "0.6.8"
 edition = "2021"
 license = "Apache-2.0 OR MIT"
 repository = "https://github.com/RightNow-AI/openfang"
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -19,8 +19,8 @@
 <p align="center">
   <img src="https://img.shields.io/badge/language-Rust-orange?style=flat-square" alt="Rust" />
   <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT" />
-  <img src="https://img.shields.io/badge/version-0.6.7-green?style=flat-square" alt="v0.6.7" />
-  <img src="https://img.shields.io/badge/tests-2,657%2B%20passing-brightgreen?style=flat-square" alt="Tests" />
+  <img src="https://img.shields.io/badge/version-0.6.8-green?style=flat-square" alt="v0.6.8" />
+  <img src="https://img.shields.io/badge/tests-2,669%2B%20passing-brightgreen?style=flat-square" alt="Tests" />
   <img src="https://img.shields.io/badge/clippy-0%20warnings-brightgreen?style=flat-square" alt="Clippy" />
   <a href="https://www.buymeacoffee.com/openfang" target="_blank"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" /></a>
 </p>
```

**File**: `crates/openfang-channels/src/discord.rs` (modified, +9/-9)
```diff
@@ -1457,7 +1457,7 @@ mod tests {
     async fn test_parse_image_only_no_caption() {
         let bot_id = Arc::new(RwLock::new(Some("bot123".to_string())));
         let d = payload_with("", vec![att("photo.png", Some("image/png"), 100_000)]);
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1480,7 +1480,7 @@ mod tests {
             "look at this",
             vec![att("photo.jpg", Some("image/jpeg"), 50_000)],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1512,7 +1512,7 @@ mod tests {
                 att("b.png", Some("image/png"), 20_000),
             ],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1536,7 +1536,7 @@ mod tests {
                 att("b.png", Some("image/png"), 20_000),
             ],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1555,7 +1555,7 @@ mod tests {
     async fn test_parse_heic_falls_to_file() {
         let bot_id = Arc::new(RwLock::new(Some("bot123".to_string())));
         let d = payload_with("", vec![att("photo.heic", Some("image/heic"), 100_000)]);
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1575,7 +1575,7 @@ mod tests {
             "",
             vec![att("huge.png", Some("image/png"), 6 * 1024 * 1024)],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1600,7 +1600,7 @@ mod tests {
             "see attached",
             vec![att("doc.pdf", Some("application/pdf"), 200_000)],
         );
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         match msg.content {
@@ -1619,7 +1619,7 @@ mod tests {
         // we should fall back to the filename extension.
         let bot_id = Arc::new(RwLock::new(Some("bot123".to_string())));
         let d = payload_with("", vec![att("pic.png", None, 50_000)]);
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true)
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads())
             .await
             .unwrap();
         assert!(matches!(msg.content, ChannelContent::Image { .. }));
@@ -1629,7 +1629,7 @@ mod tests {
     async fn test_parse_empty_message_with_no_attachments_returns_none() {
         let bot_id = Arc::new(RwLock::new(Some("bot123".to_string())));
         let d = payload_with("", vec![]);
-        let msg = parse_discord_message(&d, &bot_id, &[], &[], true).await;
+        let msg = parse_discord_message(&d, &bot_id, &[], &[], true, &empty_threads()).await;
         assert!(msg.is_none());
     }
 }
```

**File**: `crates/openfang-desktop/tauri.conf.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "$schema": "https://schema.tauri.app/config/2",
   "productName": "OpenFang",
-  "version": "0.6.7",
+  "version": "0.6.8",
   "identifier": "ai.openfang.desktop",
   "build": {},
   "app": {
```

**File**: `crates/openfang-kernel/src/kernel.rs` (modified, +22/-10)
```diff
@@ -5249,12 +5249,20 @@ impl OpenFangKernel {
                 .iter()
                 .map(|p| p.id.clone())
                 .collect();
-            let env_map: std::collections::HashMap<String, String> = catalog
-                .list_providers()
-                .iter()
-                .filter(|p| !p.api_key_env.is_empty())
-                .map(|p| (p.api_key_env.to_ascii_uppercase(), p.id.clone()))
-                .collect();
+            // Multi-valued: several providers may share the same api_key_env
+            // (e.g. both `openai` and `codex` use OPENAI_API_KEY). Using a
+            // plain HashMap silently dropped earlier providers — broke #1188.
+            let mut env_map: std::collections::HashMap<String, Vec<String>> =
+                std::collections::HashMap::new();
+            for p in catalog.list_providers() {
+                if p.api_key_env.is_empty() {
+                    continue;
+                }
+                env_map
+                    .entry(p.api_key_env.to_ascii_uppercase())
+                    .or_default()
+                    .push(p.id.clone());
+            }
             (ids, env_map)
         };
 
@@ -5407,10 +5415,12 @@ impl OpenFangKernel {
             }
             for var in skill.manifest.config.values() {
                 if let Some(env_name) = var.env.as_deref() {
-                    if let Some(provider) =
+                    if let Some(providers) =
                         env_to_provider.get(&env_name.to_ascii_uppercase())
                     {
-                        set.insert(provider.clone());
+                        for provider in providers {
+                            set.insert(provider.clone());
+                        }
                     }
                 }
             }
@@ -5422,10 +5432,12 @@ impl OpenFangKernel {
         // wired that provider into their MCP server.
         for server in &self.config.mcp_servers {
             for env_name in &server.env {
-                if let Some(provider) =
+                if let Some(providers) =
                     env_to_provider.get(&env_name.to_ascii_uppercase())
                 {
-                    set.insert(provider.clone());
+                    for provider in providers {
+                        set.insert(provider.clone());
+                    }
                 }
             }
         }
```

---

### Incident Patch 3: `e683acc5` (2026-05-12)
**Commit Message**: Merge pull request #1045 from dongtran16092006/fix-mcp-system-prompt

fix: system prompt and identity handling, and config form hydration

**File**: `crates/openfang-api/src/routes.rs` (modified, +4/-0)
```diff
@@ -1509,11 +1509,15 @@ pub async fn get_agent(
                 "network": entry.manifest.capabilities.network,
             },
             "description": entry.manifest.description,
+            "system_prompt": entry.manifest.model.system_prompt,
             "tags": entry.manifest.tags,
             "identity": {
                 "emoji": entry.identity.emoji,
                 "avatar_url": entry.identity.avatar_url,
                 "color": entry.identity.color,
+                "archetype": entry.identity.archetype,
+                "vibe": entry.identity.vibe,
+                "greeting_style": entry.identity.greeting_style,
             },
             "skills": entry.manifest.skills,
             "skills_mode": if entry.manifest.skills.is_empty() { "all" } else { "allowlist" },
```

**File**: `crates/openfang-api/static/js/pages/agents.js` (modified, +23/-14)
```diff
@@ -337,29 +337,38 @@ function agentsPage() {
       OpenFangAPI.wsDisconnect();
     },
 
+    buildConfigForm(agent) {
+      var identity = (agent && agent.identity) || {};
+      return {
+        name: (agent && agent.name) || '',
+        system_prompt: (agent && agent.system_prompt) || '',
+        emoji: identity.emoji || '',
+        color: identity.color || '#FF5C00',
+        archetype: identity.archetype || '',
+        vibe: identity.vibe || ''
+      };
+    },
+
     async showDetail(agent) {
-      this.detailAgent = agent;
-      this.detailAgent._fallbacks = [];
       this.detailTab = 'info';
       this.agentFiles = [];
       this.editingFile = null;
       this.fileContent = '';
       this.editingFallback = false;
       this.newFallbackValue = '';
-      this.configForm = {
-        name: agent.name || '',
-        system_prompt: agent.system_prompt || '',
-        emoji: (agent.identity && agent.identity.emoji) || '',
-        color: (agent.identity && agent.identity.color) || '#FF5C00',
-        archetype: (agent.identity && agent.identity.archetype) || '',
-        vibe: (agent.identity && agent.identity.vibe) || ''
-      };
-      this.showDetailModal = true;
-      // Fetch full agent detail to get fallback_models
+      // Load the full detail payload before opening the modal so editable
+      // fields such as system_prompt and identity metadata are hydrated.
+      var detail = agent;
       try {
         var full = await OpenFangAPI.get('/api/agents/' + agent.id);
-        this.detailAgent._fallbacks = full.fallback_models || [];
-      } catch(e) { /* ignore */ }
+        detail = Object.assign({}, agent, full, {
+          identity: Object.assign({}, (agent && agent.identity) || {}, (full && full.identity) || {})
+        });
+      } catch(e) { /* fall back to list payload */ }
+      this.detailAgent = detail;
+      this.detailAgent._fallbacks = detail.fallback_models || [];
+      this.configForm = this.buildConfigForm(detail);
+      this.showDetailModal = true;
     },
 
     killAgent(agent) {
```

---

### Incident Patch 4: `838836b2` (2026-05-12)
**Commit Message**: integration fixes

**File**: `crates/openfang-memory/src/session.rs` (modified, +1/-1)
```diff
@@ -496,7 +496,7 @@ impl SessionStore {
             .conn
             .lock()
             .map_err(|e| OpenFangError::Internal(e.to_string()))?;
-        let messages_blob = rmp_serde::to_vec(&canonical.messages)
+        let messages_blob = rmp_serde::to_vec_named(&canonical.messages)
             .map_err(|e| OpenFangError::Serialization(e.to_string()))?;
         conn.execute(
             "INSERT INTO canonical_sessions (agent_id, messages, compaction_cursor, compacted_summary, updated_at)
```

**File**: `crates/openfang-runtime/src/drivers/claude_code.rs` (modified, +3/-0)
```diff
@@ -186,6 +186,7 @@ impl ClaudeCodeDriver {
                     ContentBlock::ToolUse { .. }
                     | ContentBlock::ToolResult { .. }
                     | ContentBlock::Thinking { .. }
+                    | ContentBlock::RedactedThinking { .. }
                     | ContentBlock::Unknown => None,
                 })
                 .collect::<Vec<_>>()
@@ -792,6 +793,7 @@ mod tests {
                         data: fake_b64,
                     },
                 ]),
+                ..Default::default()
             }],
             tools: vec![],
             max_tokens: 1024,
@@ -824,6 +826,7 @@ mod tests {
                     media_type: "image/jpeg".to_string(),
                     data: "Zm9v".to_string(),
                 }]),
+                ..Default::default()
             }],
             tools: vec![],
             max_tokens: 1024,
```

**File**: `crates/openfang-runtime/src/drivers/openai.rs` (modified, +2/-1)
```diff
@@ -776,6 +776,7 @@ impl LlmDriver for OpenAIDriver {
                 }
             }
 
+            let already_has_reasoning = choice.message.reasoning_text().is_some();
             if let Some(text) = choice.message.content {
                 if !text.is_empty() {
                     // Extract <think>...</think> blocks that some local models
@@ -785,7 +786,7 @@ impl LlmDriver for OpenAIDriver {
                         // Only add if we didn't already get a reasoning field
                         // (either legacy `reasoning_content` or new vLLM 0.19+
                         // `reasoning`). Issue #1157.
-                        if choice.message.reasoning_text().is_none() {
+                        if !already_has_reasoning {
                             // Mark the format so we re-emit as inline `<think>`
                             // tags on the next turn (MiniMax/M2.5 style).
                             content.push(ContentBlock::Thinking {
```

**File**: `crates/openfang-runtime/src/tool_runner.rs` (modified, +8/-6)
```diff
@@ -1399,16 +1399,18 @@ fn resolve_directory_path_for_create(
     // Walk up to find the nearest existing ancestor, canonicalize it, then
     // re-append the missing tail.
     let mut existing: PathBuf = candidate.clone();
-    let mut tail: Vec<&std::ffi::OsStr> = Vec::new();
+    let mut tail: Vec<std::ffi::OsString> = Vec::new();
     while !existing.exists() {
-        let Some(parent) = existing.parent() else {
-            return Err("Invalid path: no existing ancestor".to_string());
+        let parent = match existing.parent() {
+            Some(p) => p.to_path_buf(),
+            None => return Err("Invalid path: no existing ancestor".to_string()),
         };
-        let Some(name) = existing.file_name() else {
-            return Err("Invalid path: no filename component".to_string());
+        let name = match existing.file_name() {
+            Some(n) => n.to_os_string(),
+            None => return Err("Invalid path: no filename component".to_string()),
         };
         tail.push(name);
-        existing = parent.to_path_buf();
+        existing = parent;
     }
 
     let canon_existing = existing
```

---

### Incident Patch 5: `25516c7f` (2026-05-12)
**Commit Message**: Merge pull request #1168 from nimitbhardwaj/fix/latex-rendering

fix: render LaTeX math in chat messages

**File**: `crates/openfang-api/src/webchat.rs` (modified, +5/-4)
```diff
@@ -90,11 +90,11 @@ pub async fn webchat_page() -> impl IntoResponse {
     let html = WEBCHAT_HTML.replace(NONCE_PLACEHOLDER, &nonce);
     let csp = format!(
         "default-src 'self'; \
-         script-src 'self' 'nonce-{nonce}' 'unsafe-eval'; \
-         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; \
+         script-src 'self' 'nonce-{nonce}' 'unsafe-eval' https://cdn.jsdelivr.net; \
+         style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net; \
          img-src 'self' data: blob:; \
-         connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*; \
-         font-src 'self' https://fonts.gstatic.com; \
+         connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* https://cdn.jsdelivr.net; \
+         font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; \
          media-src 'self' blob:; \
          frame-src 'self' blob:; \
          object-src 'none'; \
@@ -120,6 +120,7 @@ pub async fn webchat_page() -> impl IntoResponse {
 /// All vendor libraries (Alpine.js, marked.js, highlight.js) are bundled
 /// locally — no CDN dependency. Alpine.js is included LAST because it
 /// immediately processes x-data directives and fires alpine:init on load.
+/// KaTeX is loaded dynamically from jsdelivr CDN when needed for LaTeX rendering.
 const WEBCHAT_HTML: &str = concat!(
     include_str!("../static/index_head.html"),
     "<style>\n",
```

**File**: `crates/openfang-api/static/js/pages/chat.js` (modified, +23/-0)
```diff
@@ -143,6 +143,29 @@ function chatPage() {
       // Fetch dynamic commands from server
       this.fetchCommands();
 
+      // Observe DOM for new messages and render LaTeX
+      this._latexObserver = new MutationObserver(function(mutations) {
+        mutations.forEach(function(mutation) {
+          mutation.addedNodes.forEach(function(node) {
+            if (node.nodeType === Node.ELEMENT_NODE) {
+              var bubbles = node.querySelector ? node.querySelectorAll('.message-bubble') : [];
+              if (node.classList && node.classList.contains('message-bubble')) {
+                bubbles = [node];
+              }
+              bubbles.forEach(function(bubble) {
+                if (bubble.textContent && hasLatexDelimiters(bubble.textContent)) {
+                  renderLatex(bubble);
+                }
+              });
+            }
+          });
+        });
+      });
+      this._latexObserver.observe(document.getElementById('messages') || document.body, {
+        childList: true,
+        subtree: true
+      });
+
       // Ctrl+/ keyboard shortcut
       document.addEventListener('keydown', function(e) {
         if ((e.ctrlKey || e.metaKey) && e.key === '/') {
```

---

### Incident Patch 6: `ae2706bd` (2026-05-12)
**Commit Message**: Merge pull request #1176 from nimitbhardwaj/fix/new-line-chat

fix(chat): support Shift+Enter for multi-line input and proper newline display

**File**: `crates/openfang-api/static/index_body.html` (modified, +1/-1)
```diff
@@ -739,7 +739,7 @@ <h3 style="margin:0 0 8px;font-size:16px;font-weight:600">Select an agent to sta
                   <span class="text-xs" style="color:var(--danger)" x-text="formatRecordingTime()"></span>
                 </div>
                 <textarea id="msg-input" rows="1" :placeholder="recording ? 'Recording... release to send' : 'Message OpenFang... (/ for commands)'"
-                          @keydown.enter.prevent="if(!$event.isComposing && $event.keyCode !== 229 && !$event.shiftKey){if(showModelPicker && filteredModelPicker.length){pickModel(filteredModelPicker[modelPickerIdx].id)}else if(showSlashMenu && filteredSlashCommands.length){executeSlashCommand(filteredSlashCommands[slashIdx].cmd)}else{sendMessage()}}"
+                          @keydown.enter="if(!$event.isComposing && $event.keyCode !== 229 && !$event.shiftKey){$event.preventDefault();if(showModelPicker && filteredModelPicker.length){pickModel(filteredModelPicker[modelPickerIdx].id)}else if(showSlashMenu && filteredSlashCommands.length){executeSlashCommand(filteredSlashCommands[slashIdx].cmd)}else{sendMessage()}}"
                           @keydown.escape="showSlashMenu = false; showModelPicker = false"
                           @keydown.arrow-up.prevent="if(showModelPicker){modelPickerIdx = Math.max(0, modelPickerIdx - 1)}else if(showSlashMenu){slashIdx = Math.max(0, slashIdx - 1)}"
                           @keydown.arrow-down.prevent="if(showModelPicker){modelPickerIdx = Math.min(filteredModelPicker.length - 1, modelPickerIdx + 1)}else if(showSlashMenu){slashIdx = Math.min(filteredSlashCommands.length - 1, slashIdx + 1)}"
```

**File**: `crates/openfang-api/static/js/app.js` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ if (typeof marked !== 'undefined') {
 function escapeHtml(text) {
   var div = document.createElement('div');
   div.textContent = text || '';
-  return div.innerHTML;
+  return div.innerHTML.replace(/\n/g, '<br>');
 }
 
 function renderMarkdown(text) {
```

---

### Incident Patch 7: `6b03cb2e` (2026-05-12)
**Commit Message**: test fix

**File**: `crates/openfang-runtime/src/drivers/gemini.rs` (modified, +1/-0)
```diff
@@ -1635,6 +1635,7 @@ mod tests {
                         "thought_signature": "text_sig_abc"
                     })),
                 }]),
+                ..Default::default()
             },
         ];
 
```

---

### Incident Patch 8: `90d16e52` (2026-05-12)
**Commit Message**: Merge pull request #1175 from aqilaziz/docs-fix-getting-started-links

Fix getting started documentation links

**File**: `docs/getting-started.md` (modified, +5/-5)
```diff
@@ -326,11 +326,11 @@ The embedded WebChat UI allows you to:
 Now that you have OpenFang running:
 
 - **Explore agent templates**: Browse the `agents/` directory for 30 pre-built agents (coder, researcher, writer, ops, analyst, security-auditor, and more).
-- **Create custom agents**: Write your own `agent.toml` manifests. See the [Architecture guide](architecture) for details on capabilities and scheduling.
-- **Set up channels**: Connect any of 40 messaging platforms (Telegram, Discord, Slack, WhatsApp, LINE, Mastodon, and 34 more). See [Channel Adapters](channel-adapters).
-- **Use bundled skills**: 60 expert knowledge skills are pre-installed (GitHub, Docker, Kubernetes, security audit, prompt engineering, etc.). See [Skill Development](skill-development).
-- **Build custom skills**: Extend agents with Python, WASM, or prompt-only skills. See [Skill Development](skill-development).
-- **Use the API**: 76 REST/WS/SSE endpoints, including an OpenAI-compatible `/v1/chat/completions`. See [API Reference](api-reference).
+- **Create custom agents**: Write your own `agent.toml` manifests. See the [Architecture guide](architecture.md) for details on capabilities and scheduling.
+- **Set up channels**: Connect any of 40 messaging platforms (Telegram, Discord, Slack, WhatsApp, LINE, Mastodon, and 34 more). See [Channel Adapters](channel-adapters.md).
+- **Use bundled skills**: 60 expert knowledge skills are pre-installed (GitHub, Docker, Kubernetes, security audit, prompt engineering, etc.). See [Skill Development](skill-development.md).
+- **Build custom skills**: Extend agents with Python, WASM, or prompt-only skills. See [Skill Development](skill-development.md).
+- **Use the API**: 76 REST/WS/SSE endpoints, including an OpenAI-compatible `/v1/chat/completions`. See [API Reference](api-reference.md).
 - **Switch LLM providers**: 20 providers supported (Anthropic, OpenAI, Gemini, Groq, DeepSeek, xAI, Ollama, and more). Per-agent model overrides.
 - **Set up workflows**: Chain multiple agents together. Use `openfang workflow create` with a TOML workflow definition.
 - **Use MCP**: Connect to external tools via Model Context Protocol. Configure in `config.toml` under `[[mcp_servers]]`.
```

---

### Incident Patch 9: `538e943d` (2026-05-12)
**Commit Message**: clippy fix

**File**: `crates/openfang-runtime/src/agent_loop.rs` (modified, +9/-4)
```diff
@@ -87,6 +87,7 @@ const MAX_CONTINUATIONS: u32 = 5;
 
 /// Default maximum message history size before auto-trimming to prevent context overflow.
 /// Per-agent overrides come from `AgentManifest::max_history_messages` (issue #871).
+#[allow(dead_code)]
 const MAX_HISTORY_MESSAGES: usize = openfang_types::agent::DEFAULT_MAX_HISTORY_MESSAGES;
 
 /// Detect when the LLM claims to have performed an action (sent, posted, emailed)
@@ -3497,8 +3498,10 @@ mod tests {
     /// Issue #871: an agent with a manifest override uses that value.
     #[test]
     fn test_effective_max_history_uses_manifest_override() {
-        let mut manifest = openfang_types::agent::AgentManifest::default();
-        manifest.max_history_messages = Some(40);
+        let mut manifest = openfang_types::agent::AgentManifest {
+            max_history_messages: Some(40),
+            ..Default::default()
+        };
         assert_eq!(manifest.effective_max_history_messages(), 40);
 
         manifest.max_history_messages = Some(6);
@@ -3510,8 +3513,10 @@ mod tests {
     /// accidentally disabling history entirely.
     #[test]
     fn test_effective_max_history_falls_back_to_default() {
-        let mut manifest = openfang_types::agent::AgentManifest::default();
-        manifest.max_history_messages = None;
+        let mut manifest = openfang_types::agent::AgentManifest {
+            max_history_messages: None,
+            ..Default::default()
+        };
         assert_eq!(
             manifest.effective_max_history_messages(),
             MAX_HISTORY_MESSAGES
```

---

### Incident Patch 10: `5e228336` (2026-05-08)
**Commit Message**: fix(chat): support Shift+Enter for multi-line input and proper newline display

**File**: `crates/openfang-api/static/index_body.html` (modified, +1/-1)
```diff
@@ -739,7 +739,7 @@ <h3 style="margin:0 0 8px;font-size:16px;font-weight:600">Select an agent to sta
                   <span class="text-xs" style="color:var(--danger)" x-text="formatRecordingTime()"></span>
                 </div>
                 <textarea id="msg-input" rows="1" :placeholder="recording ? 'Recording... release to send' : 'Message OpenFang... (/ for commands)'"
-                          @keydown.enter.prevent="if(!$event.isComposing && $event.keyCode !== 229 && !$event.shiftKey){if(showModelPicker && filteredModelPicker.length){pickModel(filteredModelPicker[modelPickerIdx].id)}else if(showSlashMenu && filteredSlashCommands.length){executeSlashCommand(filteredSlashCommands[slashIdx].cmd)}else{sendMessage()}}"
+                          @keydown.enter="if(!$event.isComposing && $event.keyCode !== 229 && !$event.shiftKey){$event.preventDefault();if(showModelPicker && filteredModelPicker.length){pickModel(filteredModelPicker[modelPickerIdx].id)}else if(showSlashMenu && filteredSlashCommands.length){executeSlashCommand(filteredSlashCommands[slashIdx].cmd)}else{sendMessage()}}"
                           @keydown.escape="showSlashMenu = false; showModelPicker = false"
                           @keydown.arrow-up.prevent="if(showModelPicker){modelPickerIdx = Math.max(0, modelPickerIdx - 1)}else if(showSlashMenu){slashIdx = Math.max(0, slashIdx - 1)}"
                           @keydown.arrow-down.prevent="if(showModelPicker){modelPickerIdx = Math.min(filteredModelPicker.length - 1, modelPickerIdx + 1)}else if(showSlashMenu){slashIdx = Math.min(filteredSlashCommands.length - 1, slashIdx + 1)}"
```

**File**: `crates/openfang-api/static/js/app.js` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ if (typeof marked !== 'undefined') {
 function escapeHtml(text) {
   var div = document.createElement('div');
   div.textContent = text || '';
-  return div.innerHTML;
+  return div.innerHTML.replace(/\n/g, '<br>');
 }
 
 function renderMarkdown(text) {
```

#### Recent Merged Pull Requests:
- **PR #1285** (closed): fix(clawhub): forward ownerHandle on install to resolve ambiguous slugs (#1284) (@andyst-dev)
- **PR #1278** (closed): fix(runtime): cancel WASM watchdog on early exit (@andyst-dev)
- **PR #1277** (closed): fix(kernel): scope collect step to preceding fan-out outputs (@andyst-dev)
- **PR #1276** (closed): fix(cli): cron create by agent name, correct create/list response par… (@89rat)
- **PR #1274** (closed): fix(clawhub): forward owner handle on installs (@andyst-dev)
- **PR #1268** (closed): Deploy/kamd1 manifests (@Nideesh1)
- **PR #1266** (closed): Add MiniMax M3 to model catalog (@octo-patch)
- **PR #1265** (closed): Portable USB launcher, landing page, and docs polish (@FreecoDAO)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
