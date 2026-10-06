# Forensic Learning Record (Deep Inspection): Sumanth077/Hands-On-AI-Engineering

> **Canonical Artifact**: `07_PROJECT_LEARNING/sumanth077-hands-on-ai-engineering-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Sumanth077/Hands-On-AI-Engineering](https://github.com/Sumanth077/Hands-On-AI-Engineering))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:13:15.085Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Sumanth077/Hands-On-AI-Engineering`
- **Description**: A curated collection of practical AI projects implementing OCR systems, RAG, AI agents, and other AI use cases.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3910 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ai_agents/deep_research_assistant/frontend/src/app/hooks/useChat.ts`
```
"use client";

import { useCallback } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type Message,
  type Assistant,
  type Checkpoint,
} from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type { TodoItem } from "@/app/types/types";
import { useClient } from "@/providers/ClientProvider";
import { useQueryState } from "nuqs";

export type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: Record<string, string>;
  email?: {
    id?: string;
    subject?: string;
    page_content?: string;
  };
  ui?: any;
};

export function useChat({
  activeAssistant,
  onHistoryRevalidate,
  thread,
}: {
  activeAssistant: Assistant | null;
  onHistoryRevalidate?: () => void;
  thread?: UseStreamThread<StateType>;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const client = useClient();

  const stream = useStream<StateType>({
    assistantId: activeAssistant?.assistant_id || "",
    client: client ?? undefined,
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onThreadId: setThreadId,
    defaultHeaders: { "x-auth-scheme": "langsmith" },
    // Enable fetching state history when switching to existing threads
    fetchStateHistory: true,
    // Revalidate thread list when stream finishes, errors, or creates new thread
    onFinish: onHistoryRevalidate,
    onError: onHistoryRevalidate,
    onCreated: onHistoryRevalidate,
    experimental_thread: thread,
  });

  const sendMessage = useCallback(
    (content: string) => {
      const newMessage: Message = { id: uuidv4(), type: "human", content };
      stream.submit(
        { messages: [newMessage] },
        {
          optimisticValues: (prev) => ({
            messages: [...(prev.messages ?? []), newMessage],
          }),
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 100 },
        }
      );
      // Update thread list immediately when sending a message
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      if (checkpoint) {
        stream.submit(undefined, {
          ...(optimisticMessages
            ? { optimisticValues: { messages: optimisticMessages } }
            : {}),
          config: activeAssistant?.config,
          checkpoint: checkpoint,
          ...(isRerunningSubagent
            ? { interruptAfter: ["tools"] }
            : { interruptBefore: ["tools"] }),
        });
      } else {
        stream.submit(
          { messages },
          { config: activeAssistant?.config, interruptBefore: ["tools"] }
        );
      }
    },
    [stream, activeAssistant?.config]
  );

  const setFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!threadId) return;
      // TODO: missing a way how to revalidate the internal state
      // I think we do want to have the ability to externally manage the state
      await client.threads.updateState(threadId, { values: { files } });
    },
    [client, threadId]
  );

  const continueStream = useCallback(
    (hasTaskToolCall?: boolean) => {
      stream.submit(undefined, {
        config: {
          ...(activeAssistant?.config || {}),
          recursion_limit: 100,
        },
        ...(hasTaskToolCall
          ? { interruptAfter: ["tools"] }
          : { interruptBefore: ["tools"] }),
      });
      // Update thread list when continuing stream
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const markCurrentThreadAsResolved = useCallback(() => {
    stream.submit(null, { command: { goto: "__end__", update: null } });
    // Update thread list when marking thread as resolved
    onHistoryRevalidate?.();
  }, [stream, onHistoryRevalidate]);

  const resumeInterrupt = useCallback(
    (value: any) => {
      stream.submit(null, { command: { resume: value } });
      // Update thread list when resuming from interrupt
      onHistoryRevalidate?.();
    },
    [stream, onHistoryRevalidate]
  );

  const stopStream = useCallback(() => {
    stream.stop();
  }, [stream]);

  return {
    stream,
    todos: stream.values.todos ?? [],
    files: stream.values.files ?? {},
    email: stream.values.email,
    ui: stream.values.ui,
    setFiles,
    messages: stream.messages,
    isLoading: stream.isLoading,
    isThreadLoading: stream.isThreadLoading,
    interrupt: stream.interrupt,
    getMessagesMetadata: stream.getMessagesMetadata,
    sendMessage,
    runSingleStep,
    continueStream,
    stopStream,
    markCurrentThreadAsResolved,
    resumeInterrupt,
  };
}

```

### Core Architecture Module: `ai_agents/deep_research_assistant/frontend/src/app/hooks/useThreads.ts`
```
import useSWRInfinite from "swr/infinite";
import type { Thread } from "@langchain/langgraph-sdk";
import { Client } from "@langchain/langgraph-sdk";
import { getConfig } from "@/lib/config";

export interface ThreadItem {
  id: string;
  updatedAt: Date;
  status: Thread["status"];
  title: string;
  description: string;
  assistantId?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export function useThreads(props: {
  status?: Thread["status"];
  limit?: number;
}) {
  const pageSize = props.limit || DEFAULT_PAGE_SIZE;

  return useSWRInfinite(
    (pageIndex: number, previousPageData: ThreadItem[] | null) => {
      const config = getConfig();
      const apiKey =
        config?.langsmithApiKey ||
        process.env.NEXT_PUBLIC_LANGSMITH_API_KEY ||
        "";

      if (!config) {
        return null;
      }

      // If the previous page returned no items, we've reached the end
      if (previousPageData && previousPageData.length === 0) {
        return null;
      }

      return {
        kind: "threads" as const,
        pageIndex,
        pageSize,
        deploymentUrl: config.deploymentUrl,
        assistantId: config.assistantId,
        apiKey,
        status: props?.status,
      };
    },
    async ({
      deploymentUrl,
      assistantId,
      apiKey,
      status,
      pageIndex,
      pageSize,
    }: {
      kind: "threads";
      pageIndex: number;
      pageSize: number;
      deploymentUrl: string;
      assistantId: string;
      apiKey: string;
      status?: Thread["status"];
    }) => {
      const client = new Client({
        apiUrl: deploymentUrl,
        defaultHeaders: apiKey ? { "X-Api-Key": apiKey } : {},
      });

      // Check if assistantId is a UUID (deployed) or graph name (local)
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          assistantId
        );

      const threads = await client.threads.search({
        limit: pageSize,
        offset: pageIndex * pageSize,
        sortBy: "updated_at" as const,
        sortOrder: "desc" as const,
        status,
        // Only filter by assistant_id metadata for deployed graphs (UUIDs)
        // Local dev graphs don't set this metadata
        ...(isUUID ? { metadata: { assistant_id: assistantId } } : {}),
      });

      return threads.map((thread): ThreadItem => {
        let title = "Untitled Thread";
        let description = "";

        try {
          if (thread.values && typeof thread.values === "object") {
            const values = thread.values as any;
            const firstHumanMessage = values.messages.find(
              (m: any) => m.type === "human"
            );
            if (firstHumanMessage?.content) {
              const content =
                typeof firstHumanMessage.content === "string"
                  ? firstHumanMessage.content
                  : firstHumanMessage.content[0]?.text || "";
              title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
            }
            const firstAiMessage = values.messages.find(
              (m: any) => m.type === "ai"
            );
            if (firstAiMessage?.content) {
              const content =
                typeof firstAiMessage.content === "string"
                  ? firstAiMessage.content
                  : firstAiMessage.content[0]?.text || "";
              description = content.slice(0, 100);
            }
          }
        } catch {
          // Fallback to thread ID
          title = `Thread ${thread.thread_id.slice(0, 8)}`;
        }

        return {
          id: thread.thread_id,
          updatedAt: new Date(thread.updated_at),
          status: thread.status,
          title,
          description,
          assistantId,
        };
      });
    },
    {
      revalidateFirstPage: true,
      revalidateOnFocus: true,
    }
  );
}

```

### Core Architecture Module: `ai_agents/deep_research_assistant/frontend/src/app/utils/utils.ts`
```
import { Message } from "@langchain/langgraph-sdk";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractStringFromMessageContent(message: Message): string {
  return typeof message.content === "string"
    ? message.content
    : Array.isArray(message.content)
    ? message.content
        .filter(
          (c: unknown) =>
            (typeof c === "object" &&
              c !== null &&
              "type" in c &&
              (c as { type: string }).type === "text") ||
            typeof c === "string"
        )
        .map((c: unknown) =>
          typeof c === "string"
            ? c
            : typeof c === "object" && c !== null && "text" in c
            ? (c as { text?: string }).text || ""
            : ""
        )
        .join("")
    : "";
}

export function extractSubAgentContent(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;

    // Try to extract description first
    if (dataObj.description && typeof dataObj.description === "string") {
      return dataObj.description;
    }

    // Then try prompt
    if (dataObj.prompt && typeof dataObj.prompt === "string") {
      return dataObj.prompt;
    }

    // For output objects, try result
    if (dataObj.result && typeof dataObj.result === "string") {
      return dataObj.result;
    }

    // Fallback to JSON stringification
    return JSON.stringify(data, null, 2);
  }

  // Fallback for any other type
  return JSON.stringify(data, null, 2);
}

export function isPreparingToCallTaskTool(messages: Message[]): boolean {
  const lastMessage = messages[messages.length - 1];
  return (
    (lastMessage.type === "ai" &&
      lastMessage.tool_calls?.some(
        (call: { name?: string }) => call.name === "task"
      )) ||
    false
  );
}

export function formatMessageForLLM(message: Message): string {
  let role: string;
  if (message.type === "human") {
    role = "Human";
  } else if (message.type === "ai") {
    role = "Assistant";
  } else if (message.type === "tool") {
    role = `Tool Result`;
  } else {
    role = message.type || "Unknown";
  }

  const timestamp = message.id ? ` (${message.id.slice(0, 8)})` : "";

  let contentText = "";

  // Extract content text
  if (typeof message.content === "string") {
    contentText = message.content;
  } else if (Array.isArray(message.content)) {
    const textParts: string[] = [];

    message.content.forEach((part: any) => {
      if (typeof part === "string") {
        textParts.push(part);
      } else if (part && typeof part === "object" && part.type === "text") {
        textParts.push(part.text || "");
      }
      // Ignore other types like tool_use in content - we handle tool calls separately
    });

    contentText = textParts.join("\n\n").trim();
  }

  // For tool messages, include additional tool metadata
  if (message.type === "tool") {
    const toolName = (message as any).name || "unknown_tool";
    const toolCallId = (message as any).tool_call_id || "";
    role = `Tool Result [${toolName}]`;
    if (toolCallId) {
      role += ` (call_id: ${toolCallId.slice(0, 8)})`;
    }
  }

  // Handle tool calls from .tool_calls property (for AI messages)
  const toolCallsText: string[] = [];
  if (
    message.type === "ai" &&
    message.tool_calls &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  ) {
    message.tool_calls.forEach((call: any) => {
      const toolName = call.name || "unknown_tool";
      const toolArgs = call.args ? JSON.stringify(call.args, null, 2) : "{}";
      toolCallsText.push(`[Tool Call: ${toolName}]\nArguments: ${toolArgs}`);
    });
  }

  // Combine content and tool calls
  const parts: string[] = [];
  if (contentText) {
    parts.push(contentText);
  }
  if (toolCallsText.length > 0) {
    parts.push(...toolCallsText);
  }

  if (parts.length === 0) {
    return `${role}${timestamp}: [Empty message]`;
  }

  if (parts.length === 1) {
    return `${role}${timestamp}: ${parts[0]}`;
  }

  return `${role}${timestamp}:\n${parts.join("\n\n")}`;
}

export function formatConversationForLLM(messages: Message[]): string {
  const formattedMessages = messages.map(formatMessageForLLM);
  return formattedMessages.join("\n\n---\n\n");
}

```

### Core Architecture Module: `ai_agents/deep_research_assistant/frontend/src/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `ai_agents/devable_research_agent/lib/score.py`
```
"""Scoring module for devable-research-agent.

Maps collector relevance scores to devable-research-agent's 1-10 importance scale.
Combines engagement, source reliability, and content relevance.
Adapted from last30days score.py composite scoring approach.
"""

import bisect
import math
from typing import List

from .schema import TrackerItem, SOURCE_X, SOURCE_GITHUB, SOURCE_HUGGINGFACE, SOURCE_ARXIV, SOURCE_WEB, SOURCE_REPO, SOURCE_REDDIT, SOURCE_HACKERNEWS

# Source reliability weights (official sources > community)
SOURCE_RELIABILITY = {
    SOURCE_GITHUB: 0.9,
    SOURCE_REPO: 0.85,
    SOURCE_HUGGINGFACE: 0.85,
    SOURCE_ARXIV: 0.8,
    SOURCE_WEB: 0.7,
    SOURCE_X: 0.65,
    SOURCE_REDDIT: 0.5,
    SOURCE_HACKERNEWS: 0.55,
}

# Scoring component weights — Stage 1 automated scoring dimensions.
# These are computable from collector metadata (not the same as the
# 5-dimension agent evaluation criteria in tracking-list/SKILL.md).
WEIGHT_RELEVANCE = 0.35
WEIGHT_ENGAGEMENT = 0.30
WEIGHT_SOURCE_RELIABILITY = 0.20
WEIGHT_RECENCY = 0.15


def _compute_engagement_score(item: TrackerItem) -> float:
    """Compute normalized engagement score (0-1) based on source type."""
    eng = item.engagement

    if item.source == SOURCE_X:
        raw = (
            0.55 * math.log1p(eng.likes)
            + 0.25 * math.log1p(eng.reposts)
            + 0.15 * math.log1p(eng.replies)
            + 0.05 * math.log1p(eng.quotes)
        )
        return min(1.0, raw / 10.0)

    elif item.source == SOURCE_REDDIT:
        raw = (
            0.55 * math.log1p(eng.score)
            + 0.45 * math.log1p(eng.num_comments)
        )
        return min(1.0, raw / 6.0)

    elif item.source == SOURCE_HACKERNEWS:
        raw = (
            0.55 * math.log1p(eng.points)
            + 0.45 * math.log1p(eng.num_comments)
        )
        return min(1.0, raw / 6.0)

    elif item.source == SOURCE_GITHUB:
        if "Trending" in (item.source_label or ""):
            # Trending repos: star surge IS the story
            raw = (
                0.60 * math.log1p(eng.stars)
                + 0.40 * math.log1p(eng.forks)
            )
            return min(1.0, raw / 7.0)
        else:
            # Tracked-entity releases: repo lifetime stars ≠ release
            # significance.  Use flat moderate engagement so relevance
            # and source reliability drive the score instead.
            return 0.35

    elif item.source == SOURCE_HUGGINGFACE:
        raw = (
            0.50 * math.log1p(eng.views)  # downloads
            + 0.50 * math.log1p(eng.likes)
        )
        return min(1.0, raw / 8.0)

    elif item.source == SOURCE_ARXIV:
        # Variable score based on author count (proxy for lab size/importance)
        author_boost = min(0.2, eng.total * 0.02) if eng.total else 0
        return 0.4 + author_boost

    elif item.source == SOURCE_WEB:
        return 0.4  # web search results have limited engagement info

    elif item.source == SOURCE_REPO:
        raw = (
            0.55 * math.log1p(eng.stars)
            + 0.45 * math.log1p(max(0, eng.total))
        )
        return min(1.0, raw / 7.0)

    return 0.3


def _compute_recency_score(item: TrackerItem) -> float:
    """Score based on date confidence."""
    if item.date_confidence == "high":
        return 1.0
    elif item.date_confidence == "med":
        return 0.7
    return 0.4


def score_item(item: TrackerItem) -> float:
    """Compute importance score for a single item on 1-10 scale.

    Combines:
    - Relevance (from collector): 35%
    - Engagement (platform-specific): 30%
    - Source reliability: 20%
    - Recency confidence: 15%

    Returns:
        Score from 1.0 to 10.0
    """
    relevance = item.relevance
    engagement = _compute_engagement_score(item)
    reliability = SOURCE_RELIABILITY.get(item.source, 0.5)
    recency = _compute_recency_score(item)

    composite = (
        WEIGHT_RELEVANCE * relevance
        + WEIGHT_ENGAGEMENT * engagement
        + WEIGHT_SOURCE_RELIABILITY * reliability
        + WEIGHT_RECENCY * recency
    )

    # Map 0-1 composite to 1-10 scale
    score = max(1.0, min(10.0, composite * 10.0))
    return round(score, 1)


def score_items(items: List[TrackerItem]) -> List[TrackerItem]:
    """Score all items and sort by importance descending.

    Args:
        items: List of TrackerItem to score

    Returns:
        Same items with importance field set, sorted by importance desc
    """
    for item in items:
        item.importance = score_item(item)

    # Rescale scores using percentile mapping for better distribution
    _rescale_scores(items)

    items.sort(key=lambda x: x.importance, reverse=True)
    return items


def _rescale_scores(items: List[TrackerItem]) -> None:
    """Rescale scores to spread across 2.0-9.5 range using percentiles.

    Preserves relative ordering while ensuring scores use the full range
    instead of clustering around 5-7.
    """
    if len(items) < 5:
        return

    scores = sorted(i.importance for i in items)
    n = len(scores)
    for item in items:
        pct = bisect.bisect_left(scores, item.importance) / n
        item.importance = round(2.0 + pct * 7.5, 1)


def apply_verification_bonus(items: List[TrackerItem]) -> List[TrackerItem]:
    """Apply cross-verification bonus per devable-research-agent rules.

    Items with 2+ cross-references get a verification bonus.
    Items scoring 7+ with <2 independent sources get a penalty.

    Args:
        items: Pre-scored items with cross_refs populated

    Returns:
        Items with adjusted importance scores
    """
    for item in items:
        num_refs = len(item.cross_refs)

        if num_refs >= 2:
            item.verified = True
            item.importance = min(10.0, item.importance + 0.5)
        else:
            item.verified = False

    items.sort(key=lambda x: x.importance, reverse=True)
    return items

```

### Core Architecture Module: `ai_agents/devable_research_agent/lib/util.py`
```
import sys
from typing import Optional


def log(tag: str, msg: str, *, tty_only: bool = False) -> None:
    if tty_only and not sys.stderr.isatty():
        return
    sys.stderr.write(f"[{tag}] {msg}\n")
    sys.stderr.flush()


def parse_date(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    if len(date_str) >= 10:
        return date_str[:10]
    return None

```

### Core Architecture Module: `ai_agents/email_auto_responder/email_utils.py`
```
import email
import imaplib
import os
from email.header import decode_header
from typing import Any

from dotenv import load_dotenv

load_dotenv()


def decode_mime_header(value: str | None) -> str:
    """Decode a MIME-encoded email header into plain text."""
    if not value:
        return ""

    decoded_parts = decode_header(value)
    result_parts: list[str] = []

    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            result_parts.append(part.decode(encoding or "utf-8", errors="replace"))
        else:
            result_parts.append(part)

    return " ".join(result_parts).strip()


def parse_email_body(message: email.message.Message) -> str:
    """Extract plain text or HTML body content from an email message."""
    if message.is_multipart():
        text_parts: list[str] = []
        html_parts: list[str] = []

        for part in message.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in content_disposition:
                continue

            payload = part.get_payload(decode=True)
            if payload is None:
                continue

            charset = part.get_content_charset() or "utf-8"
            decoded_text = payload.decode(charset, errors="replace")

            if content_type == "text/plain":
                text_parts.append(decoded_text)
            elif content_type == "text/html" and not text_parts:
                html_parts.append(decoded_text)

        if text_parts:
            return "\n".join(text_parts).strip()

        if html_parts:
            return html_parts[0].strip()

        return ""

    payload = message.get_payload(decode=True)
    if payload is None:
        return ""

    charset = message.get_content_charset() or "utf-8"
    return payload.decode(charset, errors="replace").strip()


def parse_email_message(raw_email: bytes) -> dict[str, str]:
    """Parse raw RFC822 bytes into sender, subject, and body fields."""
    message = email.message_from_bytes(raw_email)

    sender = decode_mime_header(message.get("From"))
    subject = decode_mime_header(message.get("Subject"))
    body = parse_email_body(message)

    return {
        "sender": sender,
        "subject": subject or "(No subject)",
        "body": body or "(No body content)",
    }


def fetch_unread_emails(
    email_address: str | None = None,
    app_password: str | None = None,
    max_emails: int = 5,
) -> list[dict[str, Any]]:
    """Fetch unread inbox messages from Gmail over IMAP."""
    email_address = email_address or os.getenv("EMAIL_ADDRESS")
    app_password = app_password or os.getenv("APP_PASSWORD")

    if not email_address or not app_password:
        raise ValueError(
            "EMAIL_ADDRESS and APP_PASSWORD must be set in the environment or passed as arguments."
        )

    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(email_address, app_password)
    mail.select("inbox")

    try:
        _, message_numbers = mail.search(None, "UNSEEN")
        unread_ids = message_numbers[0].split()

        if not unread_ids:
            return []

        selected_ids = unread_ids[-max_emails:]
        emails: list[dict[str, Any]] = []

        for message_id in selected_ids:
            _, message_data = mail.fetch(message_id, "(RFC822)")
            if not message_data or not message_data[0]:
                continue

            raw_email = message_data[0][1]
            if not isinstance(raw_email, bytes):
                continue

            parsed = parse_email_message(raw_email)
            parsed["message_id"] = message_id.decode()
            emails.append(parsed)

        return emails
    finally:
        mail.logout()


def get_email_credentials() -> tuple[str, str]:
    """Load Gmail address and app password from environment variables."""
    email_address = os.getenv("EMAIL_ADDRESS")
    app_password = os.getenv("APP_PASSWORD")

    if not email_address or not app_password:
        raise ValueError(
            "Missing email credentials. Set EMAIL_ADDRESS and APP_PASSWORD in your .env file."
        )

    return email_address, app_password

```

### Core Architecture Module: `ai_agents/nl_data_analyst_agent/agent/hooks/capture_question.ts`
```
import { defineHook } from "eve/hooks";
import { currentQuestion, parseAnalystMessage } from "../lib/question_context";

export default defineHook({
  events: {
    "message.received"(event) {
      if (event.data.kind === "execution.background_task") return;
      const binding = parseAnalystMessage(event.data.message, event.data.turnId);
      currentQuestion.update(() => binding);
    },
  },
});

```

### Core Architecture Module: `ai_agents/offline_troubleshooting_agent/agent/state.py`
```
from pydantic import BaseModel, Field


class InvestigationState(BaseModel):
    investigation_id: str
    objective: str

    current_readings: dict = Field(default_factory=dict)
    findings: list[str] = Field(default_factory=list)

    retrieved_incidents: list[dict] = Field(default_factory=list)
    retrieved_manual_chunks: list[dict] = Field(default_factory=list)

    tool_calls: list[dict] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)

    final_result: dict | None = None


class InvestigationResult(BaseModel):
    likely_cause: str
    confidence: float
    recommendation: str
    supporting_evidence: list[str]
    retrieved_incident_ids: list[str]
    manual_sources: list[str]

```

### Core Architecture Module: `ai_agents/offline_troubleshooting_agent/util/network_status.py`
```
import socket

NETWORK_CHECK_HOST = "1.1.1.1"
NETWORK_CHECK_PORT = 53


def is_online(timeout: float = 1.0) -> bool:
    """Best-effort check for internet connectivity.

    Attempts a short-timeout TCP connection to a public address. Returns
    True if it succeeds (online), False if it fails or times out (offline).
    """
    try:
        with socket.create_connection((NETWORK_CHECK_HOST, NETWORK_CHECK_PORT), timeout=timeout):
            return True
    except OSError:
        return False

```

### Core Architecture Module: `ai_agents/self_driving_data_analyst/agent/loop_detector.py`
```
"""
Flags when the agent looks stuck: repeating near-identical SQL queries
without making progress. This does not stop the investigation, it injects
a message telling the model to reassess, and lets the model decide what to
do next.
"""

from __future__ import annotations

import re

from agent.state import InvestigationState


def _normalize(query: str) -> str:
    return re.sub(r"\s+", " ", query.strip().lower())


def is_looping(state: InvestigationState, window: int = 4, min_repeats: int = 3) -> bool:
    recent = state.recent_sql_queries(n=window)
    if len(recent) < min_repeats:
        return False
    normalized = [_normalize(q) for q in recent]
    most_common = max(set(normalized), key=normalized.count)
    return normalized.count(most_common) >= min_repeats

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #135** (2026-10-01): **update data analyst demo showing Jev review layer**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * SQL review results now use the selected verdict and can obtain confidence from the matching choice when it isn’t provided directly.   * Reviews with missing confidence are marked as low confidence; verdict mismatches are actionable only when confidence meets the configured threshold.   * Event reviews handle missing fields with defaults while preserving supplied confidence.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/135?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `910bc700-3eaf-46af-aa21-078a2eec55c7` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files th

- **Issue #134** (2026-10-01): **feat: add Jev review gates to natural language data analyst**
  *Symptoms*: ## Summary - add Jev question-clarity review before Gradio sends a question to Eve - add authoritative turn-bound SQL relevance review inside run_sql before SQLite execution - add answer-grounding review before Eve explanations are presented - keep Jev failures visible and fail-open without weakening SQL validation, read-only access, row limits, or human approval - associate proposed SQL, results, and approvals by Eve callId/requestId and instruct Eve to issue one run_sql call at a time  ## Verification - uv run --frozen --extra dev python -m pytest -q (17 passed) - pnpm test (7 passed) - pnpm run build (passed)  All Jev tests use mocked responses. No paid Jev/model request was made. Live Jev behavior remains unverified because the configured account previously returned 403 no_providers_available and currently has no TypeSafe credits.  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Added AI review of data questions, SQL relevance, and answer grounding. Clear issues can prompt clarification, block an unsuitable query, or label a draft answer as unverified.   * SQL results and approvals are now matched to the corresponding query, with earlier completed results restored when a later query is rejected.   * Added configurable review settings.  * **Bug Fixes**   * SQL reviews are tied to the question asked for the current database and turn, reducing the risk of evaluating a query against the wrong context
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/134?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The analyst agent now uses Jev to review question clarity, SQL relevance, and answer grounding. SQL calls use a question bound to the database and session turn. Event projection associates SQL, results, and approvals by call ID.  ### Changes  **NL analyst Jev review flow**  |Layer / File(s)|Summary| |---|---| |**Bind questions and review SQL** <br> `ai_agents/nl_data_analyst_agent/a

- **Issue #133** (2026-09-29): **Update README.md**
  *Symptoms*: Removed the "$25 in signup credits" line  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Updated the cost estimate to omit the comparison with signup credits and the estimate of how many booking calls those credits cover.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/133"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `6671b3e2-309c-4fda-82cc-302aa50b7ea8`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 598bb1f168a401de92d91100cfe193a0fd831490 and 95ff00

- **Issue #132** (2026-09-24): **Build local Ollama-powered data analyst with Gradio**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/132"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `ebd6e22a-dc4b-4f77-8c21-b17a4d23c456` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that changed from the base 

- **Issue #131** (2026-09-24): **feat: add Offline Troubleshooting Agent - local AI agent for industrial equipment diagnosis with zero internet dependency**
  *Symptoms*: An AI troubleshooting agent for industrial equipment that investigates faults using only local tools, local memory, and a local LLM. No internet connection is required at any point, proven by an actual disconnected test run, not just claimed.  Key Features: - Simulated machine with three realistic fault scenarios (bearing, cooling, pressure), each with a distinct sensor signature and error code - Agent investigates using a defined tool surface: current readings, recent history, equipment manual search, and past incident search, before proposing a diagnosis - Persistent local memory (Actian VectorAI DB) of past incidents and manual content, retrieved by semantic similarity, survives container restarts - Human confirmation gate: the model's own diagnosis and the human's confirmed cause are stored as separate fields, nothing is written to permanent memory until a technician explicitly confirms or corrects it - Live Gradio UI showing the investigation happening step by step, plus a live online/offline status indicator - Full offline test suite (scripts/offline_test.py) with a network guard that refuses to run if it detects a live connection, so the offline claim is verifiable, not assumed - A completed, logged offline run is included at docs/OFFLINE_TEST_LOG_20260923T092644.md as evidence  Tech Stack: - LLM: qwen3:4b-instruct (local via Ollama) - Embeddings: nomic-embed-text (local via Ollama) - Vector memory: Actian VectorAI DB - UI: Gradio - Data handling: Panda
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/131"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  This pull request adds an offline troubleshooting application. It simulates machine faults, uses local Ollama models and Actian VectorAI memory during investigations, and presents results for human review in a Gradio interface. It also adds setup, maintenance, and verification tools.  ### Changes  **Offline Troubleshooting Agent**  |Layer / File(s)|Summary| |---|---| |**Machine simulator and fault scenarios
  > Really strong build and use case, @Tiioluwani . However, the architecture PNG shouldn't be the demo. You can put the architecture PNG in a "How it works" section and create a separate demo GIF for this project. Do that so I can merge the PR.

- **Issue #130** (2026-09-19): **feat(audio): switch voice agent and follow-up to GLM-5.3-Flash on Tel…**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/130#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/130#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**:

- **Issue #129** (2026-09-18): **feat(audio): add AI appointment booking voice agent (Telnyx Voice AI)**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Added an AI-powered voice agent for checking availability and booking appointments by phone.   * Added configurable business hours, services, scheduling rules, and booking horizons.   * Added calendar invite generation and appointment tracking.   * Added optional post-call follow-up messages via SMS.   * Added a demo page and dashboard for viewing appointments and call summaries.   * Added health, business information, availability, booking, and summary integrations.  * **Documentation**   * Added setup, configuration, customization, and demo instructions for the voice agent.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/129#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/129#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  ### Changes  The pull request adds a complete Telnyx Voice AI appointment-booking agent. It includes environment configuration, SQLite CRM storage, slot scheduling, calendar invites, webhook tools, call summaries, optional SMS follow

- **Issue #128** (2026-09-18): **feat: add Voice GitHub Agent - voice-controlled agent for GitHub repo triage**
  *Symptoms*: - Speak an instruction in the browser; AssemblyAI's Sync API transcribes it in one HTTP call, no polling - A tool-calling agent (qwen3-next-80b-a3b via AssemblyAI's LLM Gateway) reads the transcript and decides which GitHub actions to take, rather than following a fixed script - Real GitHub actions: reads recent commits and diffs, lists open issues, and can open new issues or add comments through the GitHub REST API - Activity feed and final summary render live in the browser, with model output parsed as markdown (escaped first, to avoid any injected HTML from model output executing) - Verified end to end against a real repo, including an actual create_issue write confirmed directly on GitHub, not just in the app's own summary  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **New Features**   - Added a voice-driven GitHub assistant that records spoken requests, transcribes them, and performs GitHub actions.   - Supports reviewing recent commits, inspecting diffs, listing open issues, creating issues, and adding comments.   - Displays transcripts, activity, and concise Markdown summaries in a responsive interface.   - Added safeguards for invalid requests, missing configuration, failed actions, and empty transcripts.  - **Documentation**   - Added setup instructions, configuration guidance, usage details, prerequisites, and workflow documentation.  <!-- end of auto-generated comment: release notes by coderabbit.ai --
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/128#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/128#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The pull request adds a voice-driven GitHub agent. A browser records audio and sends WAV data to Flask. AssemblyAI transcribes the audio. The agent calls GitHub tools and returns activity and a summary for display.  ### Changes  **Vo

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

### Incident Patch 1: `e14ff569` (2026-10-01)
**Commit Message**: fix: tolerate missing Jev confidence from eve evaluate

**File**: `ai_agents/nl_data_analyst_agent/agent/lib/jev.ts` (modified, +13/-4)
```diff
@@ -53,10 +53,19 @@ export async function reviewSqlRelevance(
         },
       },
     });
-    const verdict = result.answers.verdict.choice as "relevant" | "mismatch";
-    const confidence = result.answers.verdict.confidence;
+    const verdictAnswer = result.answers.verdict as {
+      choice: string;
+      confidence?: number;
+      probabilities?: Record<string, number>;
+    };
+    const verdict = verdictAnswer.choice as "relevant" | "mismatch";
+    // eve/ai evaluate exposes the choice; confidence may be a scalar, live in the
+    // probability distribution, or be absent. Fall back safely to null.
+    const confidence =
+      verdictAnswer.confidence ?? verdictAnswer.probabilities?.[verdictAnswer.choice] ?? null;
     const issueKey = result.answers.issue.choice;
     const threshold = Number(process.env.JEV_MIN_CONFIDENCE ?? JEV_MIN_CONFIDENCE);
+    const confident = confidence !== null && confidence >= threshold;
     const inconsistent = (verdict === "mismatch") === (issueKey === "none");
     const issue = inconsistent
       ? verdict === "mismatch"
@@ -68,8 +77,8 @@ export async function reviewSqlRelevance(
       verdict,
       confidence,
       issue,
-      actionable: verdict === "mismatch" && confidence >= threshold && !inconsistent,
-      status: inconsistent ? "inconsistent" : confidence >= threshold ? "ok" : "low_confidence",
+      actionable: verdict === "mismatch" && confident && !inconsistent,
+      status: inconsistent ? "inconsistent" : confident ? "ok" : "low_confidence",
     };
   } catch (error) {
     return {
```

**File**: `ai_agents/nl_data_analyst_agent/main.py` (modified, +8/-1)
```diff
@@ -126,7 +126,14 @@ def project_eve_events(
                         completed_order.append(call_id)
                 review = output.get("review")
                 if isinstance(review, dict) and (review.get("actionable") or review.get("status") != "ok"):
-                    sql_reviews.append(Review(**review))
+                    sql_reviews.append(Review(
+                        check=review.get("check", "SQL relevance"),
+                        verdict=review.get("verdict", "unavailable"),
+                        confidence=review.get("confidence"),
+                        issue=review.get("issue", ""),
+                        actionable=bool(review.get("actionable", False)),
+                        status=review.get("status", "ok"),
+                    ))
         elif kind == "input.requested":
             for request in data.get("requests") or []:
                 action = request.get("action") or {}
```

---

### Incident Patch 2: `a2f5cc1c` (2026-09-24)
**Commit Message**: Build local Ollama-powered data analyst with Gradio

**File**: `ai_agents/nl_data_analyst_agent/.env.example` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+AI_GATEWAY_API_KEY=
+EVE_URL=http://127.0.0.1:3000
+DATABASE_PATH=
+GRADIO_SERVER_NAME=127.0.0.1
+GRADIO_SERVER_PORT=7860
```

**File**: `ai_agents/nl_data_analyst_agent/.gitignore` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+.env
+.venv/
+.uv-cache/
+venv/
+__pycache__/
+*.pyc
+*.pyo
+*.egg-info/
+dist/
+.DS_Store
+.pytest_cache/
+data/*.sqlite
+data/connections.json
+node_modules/
+.eve/
+.output/
```

**File**: `ai_agents/nl_data_analyst_agent/README.md` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+# Natural Language Data Analyst Agent
+
+An analyst built with [Vercel Eve](https://github.com/vercel/eve) that lets you ask questions about a SQLite database in plain English. You describe the analysis you need instead of writing SQL yourself. The agent writes read-only SQL, shows the results, and asks for approval before broad queries run.
+
+![Natural Language Data Analyst Agent demo](assets/demo.gif)
+
+## What We Are Building
+
+Connect a SQLite file in Gradio by uploading it, entering its local path, or loading the included sales example. Ask a question, and the Eve agent inspects the database schema, writes a SQL query, runs it through a read-only tool, and explains the returned rows. The model is `alibaba/qwen3.8-omni-flash` through Vercel AI Gateway. Gradio keeps the conversation, SQL, and result table together so you can inspect how the answer was produced.
+
+The included sales example contains fictional customers, products, and orders from 2025. In this dataset, revenue is `quantity * unit_price` for completed orders. When you connect your own database, the agent uses its schema without assuming the same revenue definition.
+
+Eve's SQL tool pauses for approval when a query has no `WHERE` clause. You can review the proposed SQL in Gradio, then approve or reject it before the query runs.
+
+
+## Tech Stack
+
+| Component | Choice |
+| --- | --- |
+| Agent runtime and approval | Vercel Eve `0.63.0` |
+| Model gateway | Vercel AI Gateway |
+| Exact model | `alibaba/qwen3.8-omni-flash` |
+| Agent tools | TypeScript, Zod, Node SQLite |
+| Interface | Gradio |
+| Data | SQLite |
+| Python packages | uv |
+| Node packages | pnpm |
+
+## Prerequisites
+
+- Node.js 24 or newer, because this Eve release requires Node 24.
+- pnpm, Python 3.10 or newer, and [uv](https://docs.astral.sh/uv/getting-started/installation/).
+- A [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key with access to `alibaba/qwen3.8-omni-flash`. Gateway model requests incur usage charges.
+- Internet for package installation, Eve model metadata at build time, and model requests.
+
+On Windows, run the commands below in a VS Code PowerShell terminal opened in this project folder. From the repository root:
+
+```powershell
+cd ai_agents/nl_data_analyst_agent
+```
+
+If needed, install uv and pnpm first, then open a new terminal:
+
+```powershell
+winget install --id=astral-sh.uv -e
+npm install -g pnpm
+```
+
+## Setup
+
+```powershell
+Copy-Item .env.example .env
+pnpm install
+uv sync
+```
+
+Edit `.env` and set `AI_GATEWAY_API_KEY` to your own key. Never commit this file. `EVE_URL` defaults to `http://127.0.0.1:3000`. You can optionally set `DATABASE_PATH` to prefill the path control in Gradio. Leave `GRADIO_SERVER_NAME=127.0.0.1` for local use.
+
+The demo button seeds the example database automatically. To seed it in advance:
+
+```powershell
+uv run python seed_data.py
+```
+
+## Run
+
+Use two PowerShell terminals in this folder. In terminal 1, start Eve:
+
+```powershell
+pnpm run dev
+```
+
+The local launcher builds Eve, then starts it on loopback port 3000 with Eve's local-development authentication enabled. Wait for it to report that it is listening. In terminal 2, start Gradio:
+
+```powershell
+uv run python main.py
+```
+
+Open [http://127.0.0.1:7860](http://127.0.0.1:7860). Click **Use demo database**, or upload your own SQLite file and click **Connect database**. Ask one of the suggested questions. The answer appears beside the SQL and result rows. For a query without a `WHERE` clause, review the SQL and use **Approve query** or **Reject query** to continue.
+
+Try these demo questions:
+
+- Which region had the most completed-order revenue in 2025?
+- What were monthly completed-order revenues in 2025?
+- Show the first 20 orders with customer and product names.
+
+The last question demonstrates the approval controls. You can also say “Hi” to start the conversation.
+
+## Safety and Scope
+
+The SQL tool accepts one `SELECT`, opens SQLite read-only, and enables query-only mode. Queries returning more than 200 rows are rejected with a prompt to add aggregation or `LIMIT`. Eve requests approval before executing queries without a `WHERE` clause. This rule catches broad queries but does not estimate their cost.
+
+This project runs locally with SQLite files. To deploy it for other users or connect a production database, add authentication, access controls, and stronger query limits. Database paths are stored in the ignored `data/connections.json` file. Keep database files containing sensitive data and `.env` out of Git.
+
+## Developer Checks
+
+The commands below are optional checks, not steps required to open the UI:
+
+```powershell
+pnpm run build
+uv run --extra dev python -m pytest -q
+```
+
+The GIF above shows the working Gradio application.
+
+## Project Structure
+
+```text
+nl_data_analyst_agent/
+├── agent/
+│   ├── agent.ts             # Eve model configuration
+│   ├── instruct
```

**File**: `ai_agents/nl_data_analyst_agent/agent/agent.ts` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+import { defineAgent } from "eve";
+
+export default defineAgent({
+  model: "alibaba/qwen3.8-omni-flash",
+  defaultTools: false,
+});
```

**File**: `ai_agents/nl_data_analyst_agent/agent/instructions.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+You are a careful SQLite data analyst. Each user message from the Gradio app contains a database ID and a question. Use only that database ID for tools; never substitute another ID or infer a file path.
+
+For a data question, call inspect_schema first. Then compose one SQLite SELECT using only columns in that schema and call run_sql. Explain the actual returned rows, show the metric definition and limitations, and never invent values, units, currencies, or causal explanations. For the demo database only, completed-order revenue is quantity * unit_price for orders with status = 'completed'. Other databases have no assumed revenue rule.
+
+Use LIMIT for detail queries. Aggregates are allowed without LIMIT. If the query requires approval, wait for the user. If approval is denied, explain that no query was run and do not retry or substitute another query. Do not call tools for a greeting or a question unrelated to the selected database. You cannot access external data or execute Python.
```

**File**: `ai_agents/nl_data_analyst_agent/agent/lib/database.ts` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import { DatabaseSync } from "node:sqlite";
+import { readFileSync } from "node:fs";
+import { join, resolve } from "node:path";
+
+const root = resolve(process.cwd());
+const registryPath = join(root, "data", "connections.json");
+const idPattern = /^(demo|[0-9a-f]{32})$/;
+
+export function openDatabase(databaseId: string): DatabaseSync {
+  if (!idPattern.test(databaseId)) throw new Error("Invalid database ID.");
+  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Record<string, string>;
+  const path = registry[databaseId];
+  if (!path) throw new Error("Database is not connected.");
+  const db = new DatabaseSync(path, { readOnly: true });
+  db.exec("PRAGMA query_only = ON");
+  return db;
+}
+
+export function validateSql(sql: string): string {
+  const cleaned = sql.trim().replace(/;\s*$/, "");
+  if (!/^select\b/i.test(cleaned) || cleaned.includes(";")) {
+    throw new Error("Exactly one SELECT statement is allowed.");
+  }
+  if (/\b(attach|detach|pragma|load_extension|readfile|writefile|insert|update|delete|drop|create|alter|replace|vacuum)\b/i.test(cleaned)) {
+    throw new Error("Only read-only SELECT queries are allowed.");
+  }
+  return cleaned;
+}
+
+export function needsApproval(sql: string): boolean {
+  const safe = validateSql(sql);
+  return /\bfrom\b/i.test(safe) && !/\bwhere\b/i.test(safe);
+}
```

**File**: `ai_agents/nl_data_analyst_agent/agent/tools/inspect_schema.ts` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { defineTool } from "eve/tools";
+import { z } from "zod";
+import { openDatabase } from "../lib/database";
+
+export default defineTool({
+  description: "Read table names and columns of the currently selected SQLite database.",
+  inputSchema: z.object({ databaseId: z.string() }),
+  execute({ databaseId }) {
+    const db = openDatabase(databaseId);
+    try {
+      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
+      return tables.map(({ name }) => {
+        const quoted = `"${name.replaceAll('"', '""')}"`;
+        const columns = db.prepare(`PRAGMA table_info(${quoted})`).all() as { name: string; type: string }[];
+        return { table: name, columns: columns.map(({ name, type }) => ({ name, type })) };
+      });
+    } finally {
+      db.close();
+    }
+  },
+});
```

**File**: `ai_agents/nl_data_analyst_agent/agent/tools/run_sql.ts` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { defineTool } from "eve/tools";
+import { z } from "zod";
+import { needsApproval, openDatabase, validateSql } from "../lib/database";
+
+export default defineTool({
+  description: "Execute one read-only SQLite SELECT on the selected database. Broad queries without a WHERE filter require the engineer's approval before execution.",
+  inputSchema: z.object({ databaseId: z.string(), sql: z.string().min(1).max(10000) }),
+  approval: ({ toolInput }) => needsApproval(toolInput?.sql ?? "") ? "user-approval" : "not-applicable",
+  execute({ databaseId, sql }) {
+    const safe = validateSql(sql);
+    const db = openDatabase(databaseId);
+    try {
+      const statement = db.prepare(safe);
+      const rows = db.prepare(`SELECT * FROM (${safe}) LIMIT 201`).all() as Record<string, unknown>[];
+      if (rows.length > 200) throw new Error("Query returned more than 200 rows. Add aggregation or LIMIT.");
+      return { sql: safe, columns: rows.length ? Object.keys(rows[0]) : statement.columns().map(column => column.name), rows };
+    } finally {
+      db.close();
+    }
+  },
+});
```

---

### Incident Patch 3: `03f1a22f` (2026-09-17)
**Commit Message**: docs: fix stale path and back-to-top anchor in voice agent README

**File**: `audio/customer_support_voice_agent/README.md` (modified, +2/-2)
```diff
@@ -169,7 +169,7 @@ In your assistant settings, look for the **Dynamic Variables** section:
 
 ```bash
 git clone https://github.com/Sumanth077/Hands-On-AI-Engineering.git
-cd Hands-On-AI-Engineering/voice_apps/saas_customer_support_voice_agent
+cd Hands-On-AI-Engineering/audio/customer_support_voice_agent
 ```
 
 ### 2. Create virtual environment
@@ -281,4 +281,4 @@ This is the right approach for demos and small-to-medium support playbooks (unde
 - [Available models](https://developers.telnyx.com/docs/inference/models) -- `moonshotai/Kimi-K2.5` is the recommended balance of intelligence and cost
 - [Telnyx Portal](https://portal.telnyx.com)
 
-[Back to Top](#saas-customer-support-voice-agent-telnyx-ai-assistant-builder)
+[Back to Top](#customer-support-voice-agent-telnyx-ai-assistant-builder)
```

---

### Incident Patch 4: `c1a90671` (2026-08-25)
**Commit Message**: feat: add self-evolving code review agent with persistent feedback memory

**File**: `ai_agents/self_evolving_code_review_agent/.env.example` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+# Actian VectorAI DB gRPC endpoint
+ACTIAN_VECTORAI_URL=localhost:6574
+
+# Optional only when authentication is enabled in VectorAI DB
+# ACTIAN_VECTORAI_ACCESS_TOKEN=replace-with-your-token
+
+# Local Ollama server and model
+OLLAMA_HOST=http://localhost:11434
+OLLAMA_MODEL=qwen3:4b-instruct
+
+# Local embedding model
+EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
+
+# Retrieval controls
+INSIGHT_TOP_K=6
+TRAJECTORY_TOP_K=3
+MIN_RELEVANCE_SCORE=0.30
+
```

**File**: `ai_agents/self_evolving_code_review_agent/.gitignore` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+.env
+__pycache__/
+*.pyc
+*.pyo
+.venv/
+venv/
+*.egg-info/
+dist/
+.DS_Store
+vectorai_data/
+.streamlit/secrets.toml
+
```

**File**: `ai_agents/self_evolving_code_review_agent/.streamlit/config.toml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+[theme]
+primaryColor = "#4F46E5"
+backgroundColor = "#FFFFFF"
+secondaryBackgroundColor = "#EEF2FF"
+textColor = "#1E293B"
+
+[server]
+fileWatcherType = "none"
+
```

**File**: `ai_agents/self_evolving_code_review_agent/README.md` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+# Self-Evolving Code Review Agent
+
+![Demo](assets/demo.gif)
+
+A code reviewer that learns team conventions from engineer feedback without retraining the model.
+
+## Overview
+
+Most automated code reviewers start from the same generic prompt on every run. This project adds persistent experiential memory. Before reviewing a change, the agent retrieves relevant team rules and similar past review trajectories from [Actian VectorAI DB](https://www.actian.com/databases/vectorai-db/). After generating comments, it pauses until the engineer accepts, rejects, or edits every comment. The feedback is distilled into reusable natural-language insights and stored with the full review trajectory.
+
+The term self-evolving refers to non-parametric adaptation. The Qwen3 model weights and base prompts do not change. What evolves is the external memory supplied to later reviews. Accepted feedback reinforces useful rules, rejected feedback creates lessons about what not to flag, and edited feedback refines the team's preferred wording or convention.
+
+ExpeL extracts natural-language insights from agent experience and retrieves both insights and past trajectories at inference. This project applies that pattern to code review and uses engineer decisions as the outcome signal.
+
+## How It Works
+
+![How It Works](assets/how_it_works.png)
+
+LangGraph runs an explicit retrieve, review, feedback, reflect, and persist workflow. The graph uses an interrupt after comment generation, so the review pauses safely while the Streamlit interface collects one decision per comment. Resuming with the same thread ID sends those decisions into reflection. Only then are new insights and the trajectory written to Actian.
+
+Actian uses two collections. `review_insights` stores distilled rules with polarity, scope, confidence, and source review metadata. `review_trajectories` stores the reviewed change, generated comments, engineer decisions, reflection summary, and rejection metrics. Both collections use BGE embeddings for semantic recall.
+
+## Tech Stack
+
+| Component | Choice | Purpose |
+|---|---|---|
+| Agent workflow | LangGraph | Explicit retrieve, review, human feedback, reflect, and persist graph |
+| Human feedback | LangGraph interrupt and Streamlit controls | Pauses the graph and captures accept, reject, or edit decisions |
+| Memory database | Actian VectorAI DB | Persists learned insights and similar review trajectories |
+| Embeddings | `BAAI/bge-small-en-v1.5` via sentence-transformers | Embeds diffs, rules, and trajectories locally |
+| Language model | `qwen3:4b-instruct` via Ollama | Generates structured review comments and distilled insights locally |
+| Interface | Streamlit | Accepts code or diffs, collects feedback, and displays learning trends |
+
+## Prerequisites
+
+| Component | Requirement |
+|---|---|
+| Python | 3.10 through 3.13 |
+| RAM | 16 GB recommended for VectorAI DB, embeddings, and the local LLM together |
+| Disk space | At least 10 GB free, with additional space for Docker and model caches |
+| Docker | Docker Desktop or Docker Engine running locally |
+| Ollama | Installed and running locally |
+| uv | Installed as the Python environment and package manager |
+| Internet | Required on first setup to download dependencies, Docker images, and models |
+
+VectorAI DB's official Docker guide lists 8 GB RAM and 10 GB disk space as minimums, with 16 GB or more RAM recommended. This project recommends 16 GB because VectorAI DB, sentence-transformers, Ollama, and Streamlit run on the same machine.
+
+## Setup Steps
+
+### 1. Install uv
+
+On Windows PowerShell:
+
+```powershell
+winget install --id=astral-sh.uv -e
+```
+
+On macOS or Linux:
+
+```bash
+curl -LsSf https://astral.sh/uv/install.sh | sh
+```
+
+Restart the terminal after installation and run `uv --version` to confirm it is available.
+
+### 2. Clone the repository
+
+```bash
+git clone https://github.com/Sumanth077/Hands-On-AI-Engineering.git
+cd Hands-On-AI-Engineering/ai_agents/self_evolving_code_review_agent
+```
+
+### 3. Create the environment file
+
+```bash
+cp .env.example .env
+```
+
+The default values connect to local services and require no API key. `ACTIAN_VECTORAI_ACCESS_TOKEN` is only needed if authentication was enabled in your VectorAI DB deployment.
+
+### 4. Start Actian VectorAI DB
+
+```bash
+docker compose up -d
+```
+
+The Docker Compose file accepts the VectorAI DB EULA and exposes the REST API on port 6573, gRPC on port 6574, and the local database UI on port 6575.
+
+### 5. Pull the local language model
+
+```bash
+ollama pull qwen3:4b-instruct
+```
+
+The exact Ollama tag is `qwen3:4b-instruct`. Ollama lists it as a 4.02 billion parameter Q4_K_M model with a download size of approximately 2.5 GB and a 256K context window.
+
+## Installation
+
+Create and activate the virtual environment, then install the project in editable mode with uv.
+
+```bash
+uv venv
+```
+
+On Windows PowerShell:
+
+```powe
```

**File**: `ai_agents/self_evolving_code_review_agent/demo.html` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+<!doctype html>
+<html lang="en">
+<head>
+  <meta charset="utf-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+  <title>Self-Evolving Code Review Agent</title>
+  <style>
+    :root {
+      color-scheme: dark;
+      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
+      --panel: rgba(15, 23, 42, 0.72);
+      --border: rgba(129, 140, 248, 0.3);
+      --muted: #a5b4fc;
+      --text: #f8fafc;
+      --green: #34d399;
+      --red: #fb7185;
+      --amber: #fbbf24;
+    }
+    * { box-sizing: border-box; }
+    body {
+      margin: 0;
+      min-height: 100vh;
+      color: var(--text);
+      background: linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%);
+    }
+    .shell { width: min(1180px, 94vw); margin: 0 auto; padding: 38px 0 24px; }
+    .hero { text-align: center; margin-bottom: 28px; }
+    h1 { margin: 0; font-size: clamp(32px, 5vw, 54px); }
+    .grid { display: grid; grid-template-columns: 1.35fr 0.65fr; gap: 20px; }
+    .panel {
+      border: 1px solid var(--border);
+      border-radius: 20px;
+      padding: 22px;
+      background: var(--panel);
+      box-shadow: 0 20px 60px rgba(2, 6, 23, 0.34);
+      backdrop-filter: blur(16px);
+    }
+    h2 { margin: 0 0 16px; font-size: 20px; }
+    .code {
+      margin: 0 0 18px;
+      padding: 17px;
+      border-radius: 14px;
+      overflow-x: auto;
+      color: #cbd5e1;
+      background: #020617;
+      font: 13px/1.6 "Cascadia Code", Consolas, monospace;
+      white-space: pre;
+    }
+    .comment {
+      padding: 16px;
+      margin-top: 12px;
+      border: 1px solid rgba(148, 163, 184, 0.2);
+      border-radius: 14px;
+      background: rgba(30, 41, 59, 0.68);
+    }
+    .meta { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
+    .severity { color: #fecdd3; font-size: 12px; font-weight: 700; }
+    .location { color: #94a3b8; font-size: 12px; }
+    .comment p { margin: 7px 0 12px; color: #e2e8f0; line-height: 1.55; }
+    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
+    button {
+      border: 1px solid rgba(148, 163, 184, 0.32);
+      border-radius: 9px;
+      padding: 8px 12px;
+      color: #e2e8f0;
+      background: rgba(15, 23, 42, 0.8);
+      cursor: pointer;
+      font-weight: 650;
+    }
+    button:hover, button.active { border-color: #818cf8; background: rgba(79, 70, 229, 0.34); }
+    .edit-box { display: none; width: 100%; margin-top: 10px; }
+    .edit-box.visible { display: block; }
+    textarea {
+      width: 100%; min-height: 76px; resize: vertical; border: 1px solid #475569;
+      border-radius: 10px; padding: 10px; color: #f8fafc; background: #0f172a;
+    }
+    .learn {
+      width: 100%; margin-top: 18px; padding: 12px; border-color: #6366f1;
+      background: linear-gradient(90deg, #4f46e5, #7c3aed);
+    }
+    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
+    .metric { padding: 15px; border-radius: 14px; background: rgba(30, 41, 59, 0.7); }
+    .metric strong { display: block; font-size: 25px; margin-top: 6px; }
+    .metric span { color: #a5b4fc; font-size: 12px; }
+    .rule { margin-top: 11px; padding: 13px; border-left: 3px solid #818cf8; background: rgba(49, 46, 129, 0.25); }
+    .rule small { display: block; color: #a5b4fc; margin-top: 5px; }
+    .toast { display: none; margin-top: 14px; color: #a7f3d0; text-align: center; }
+    footer { margin-top: 26px; text-align: center; color: #94a3b8; font-size: 13px; }
+    @media (max-width: 850px) { .grid { grid-template-columns: 1fr; } }
+  </style>
+</head>
+<body>
+  <main class="shell">
+    <div class="hero"><h1>Self-Evolving Code Review Agent</h1></div>
+    <div class="grid">
+      <section class="panel">
+        <h2>Review comments</h2>
+        <pre class="code">+ def delete_order(order_id, user_id):
++    return db.execute("DELETE FROM orders WHERE id = ?", (order_id,))</pre>
+        <article class="comment" data-comment="1">
+          <div class="meta"><span class="severity">HIGH</span><span class="location">delete_order</span></div>
+          <p>This delete path does not verify that the order belongs to the requesting user. Add an ownership condition before deleting.</p>
+          <div class="actions">
+            <button onclick="choose(this, 'accept')">Accept</button>
+            <button onclick="choose(this, 'reject')">Reject</button>
+            <button onclick="choose(this, 'edit')">Edit</button>
+          </div>
+          <div class="edit-box"><textarea>Require both order_id and user_id in the DELETE predicate so one user cannot delete another user's order.</textarea></div>
+        </article>
+        <article class="comment" data-comment="2">
+          <div class="meta"><span class="severity">LOW</span><span class="location">get_order</span></div>
+          <p>Consider renaming order to result for consistency with generic database helpers.</p>
+   
```

**File**: `ai_agents/self_evolving_code_review_agent/docker-compose.yml` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+services:
+  vectorai:
+    image: actian/vectorai:latest
+    container_name: self-evolving-review-vectorai
+    ports:
+      - "6573:6573"
+      - "6574:6574"
+      - "6575:6575"
+    volumes:
+      - ./vectorai_data:/var/lib/actian-vectorai
+    environment:
+      - ACTIAN_VECTORAI_ACCEPT_EULA=YES
+    restart: unless-stopped
+
```

**File**: `ai_agents/self_evolving_code_review_agent/main.py` (added, +379/-0)
```diff
@@ -0,0 +1,379 @@
+"""Streamlit interface for the self-evolving code review agent."""
+
+from __future__ import annotations
+
+from typing import Any
+
+import pandas as pd
+import streamlit as st
+
+from self_evolving_agent.config import load_settings
+from self_evolving_agent.embedder import Embedder
+from self_evolving_agent.graph import build_graph, resume_review, start_review
+from self_evolving_agent.llm import LocalLLM
+from self_evolving_agent.memory import ReviewMemory, connect_client
+from self_evolving_agent.llm import LocalLLM
+
+
+SAMPLE_DIFF = """diff --git a/orders.py b/orders.py
+index 4c720ab..89bd4cd 100644
+--- a/orders.py
++++ b/orders.py
+@@ -18,8 +18,13 @@ def get_order(order_id: str, user_id: str):
+-    query = f"SELECT * FROM orders WHERE id = '{order_id}'"
+-    return db.execute(query).fetchone()
++    order = db.execute(
++        "SELECT * FROM orders WHERE id = ?", (order_id,)
++    ).fetchone()
++    if order is None:
++        return None
++    return order
+
+ def delete_order(order_id: str, user_id: str):
+-    return db.execute("DELETE FROM orders WHERE id = ?", (order_id,))
++    return db.execute("DELETE FROM orders WHERE id = ?", (order_id,))
+"""
+
+
+st.set_page_config(
+    page_title="Self-Evolving Code Review Agent",
+    page_icon=":material/model_training:",
+    layout="wide",
+)
+
+
+@st.cache_resource(show_spinner="Loading local embedding model...")
+def load_resources() -> tuple[Any, ReviewMemory, LocalLLM, Any]:
+    settings = load_settings()
+    embedder = Embedder(settings.embedding_model)
+    client = connect_client(settings.actian_url, settings.actian_access_token)
+    memory = ReviewMemory(
+        client=client,
+        embedder=embedder,
+        insight_top_k=settings.insight_top_k,
+        trajectory_top_k=settings.trajectory_top_k,
+        min_score=settings.min_relevance_score,
+    )
+    memory.setup()
+    llm = LocalLLM(settings.ollama_host, settings.ollama_model)
+    graph = build_graph(memory, llm)
+    return settings, memory, llm, graph
+
+
+def initialize_state() -> None:
+    st.session_state.setdefault("pending_review", None)
+    st.session_state.setdefault("completed_review", None)
+    st.session_state.setdefault("diff_input", "")
+
+
+def load_sample() -> None:
+    st.session_state.diff_input = SAMPLE_DIFF
+    st.session_state.pending_review = None
+    st.session_state.completed_review = None
+
+
+def clear_workspace() -> None:
+    st.session_state.diff_input = ""
+    st.session_state.pending_review = None
+    st.session_state.completed_review = None
+
+
+def uploaded_text(uploaded_file: Any) -> str:
+    return uploaded_file.getvalue().decode("utf-8", errors="replace")
+
+
+def severity_color(severity: str) -> str:
+    return {
+        "critical": "red",
+        "high": "red",
+        "medium": "orange",
+        "low": "blue",
+    }.get(severity, "gray")
+
+
+initialize_state()
+
+st.title("Self-Evolving Code Review Agent")
+st.caption(
+    "Reviews code with remembered team conventions, then learns from every accept, reject, and edit."
+)
+
+try:
+    settings, memory, llm, graph = load_resources()
+except Exception as exc:
+    st.error(f"Startup failed: {exc}", icon=":material/error:")
+    st.info(
+        "Copy `.env.example` to `.env`, start VectorAI DB, and make sure Ollama is running."
+    )
+    st.stop()
+
+with st.sidebar:
+    st.subheader("Local stack")
+    ok, model_message = llm.check()
+    (st.success if ok else st.warning)(model_message)
+    st.caption(f"Actian: {settings.actian_url}")
+    st.caption(f"Embeddings: {settings.embedding_model.split('/')[-1]}")
+
+    counts = memory.counts()
+    st.subheader("Learning memory")
+    st.metric("Learned insights", counts["insights"], border=True)
+    st.metric("Review trajectories", counts["trajectories"], border=True)
+
+    if st.button("Clear current review", icon=":material/refresh:", width="stretch"):
+        clear_workspace()
+        st.rerun()
+
+review_tab, insights_tab, progress_tab, trajectories_tab = st.tabs(
+    [
+        ":material/rate_review: Review",
+        ":material/psychology: Insights",
+        ":material/trending_down: Progress",
+        ":material/history: Trajectories",
+    ]
+)
+
+with review_tab:
+    st.subheader("Review a change")
+    st.caption("Paste code or a unified diff. You can also upload a local source or patch file.")
+
+    with st.container(horizontal=True, vertical_alignment="bottom"):
+        uploaded = st.file_uploader(
+            "Upload code or diff",
+            type=["diff", "patch", "txt", "py", "js", "jsx", "ts", "tsx", "java", "go", "rs"],
+            label_visibility="collapsed",
+        )
+        st.button("Load sample diff", icon=":material/science:", on_click=load_sample)
+
+    if uploaded is not None and st.session_state.diff_input != uploaded_text(uploaded):
+        st.session_state.diff_input = uploaded_text(uploaded)
+
+    with st.form("review_form"):
+        langua
```

**File**: `ai_agents/self_evolving_code_review_agent/pyproject.toml` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+[project]
+name = "self-evolving-code-review-agent"
+version = "1.0.0"
+description = "An ExpeL-inspired code review agent that learns team conventions from human feedback."
+readme = "README.md"
+requires-python = ">=3.10,<3.14"
+dependencies = [
+    "actian-vectorai-client>=1.0.2",
+    "langgraph>=1.1.0",
+    "ollama>=0.6.2",
+    "pandas>=2.2.0",
+    "python-dotenv>=1.0.0",
+    "sentence-transformers>=3.0.0",
+    "streamlit>=1.57.0",
+]
+
+[tool.setuptools.packages.find]
+include = ["self_evolving_agent*"]
+
```

---

### Incident Patch 5: `6281dcd4` (2026-07-21)
**Commit Message**: feat: add Multi-Agent Research Assistant with Memory - Planner, Research, Writer, and Critic agents over Actian VectorAI DB with a Critic-gated revision loop, persistent memory, and self-evaluation. Fully local via Ollama (Gemma 4 E2B) and BGE embeddings.

**File**: `README.md` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ A curated collection of practical, production-ready AI projects across multiple
 
 Intelligent ai agents for various automation tasks.
 
+- [**Multi-Agent Research Assistant with Memory**](./ai_agents/research_assistant_with_memory) — Planner, Research, Writer, and Critic agents collaborate over a shared [Actian VectorAI DB](https://www.actian.com/databases/vectorai-db/) memory layer. Retrieves cited answers from PDFs, papers, manuals, and transcripts, self-grades them with a Critic feedback loop, and persists findings across sessions. Fully local via Ollama and BGE embeddings.
 - [**Multi-Agent Financial Analyst**](./ai_agents/multi_agent_financial_analyst) — Team of specialized agents for comprehensive financial analysis.
 - [**FinAgent**](./ai_agents/finagent) — Financial assistant agent for stock market analysis and insights.
 - [**Daily AI News Digest**](./ai_agents/daily-news-digest) — Automated daily digest from 92 Karpathy-curated tech blogs delivered to Telegram every morning. MiniMax M2.7 scores articles from the last 24 hours and surfaces the 3 most significant stories.
```

**File**: `ai_agents/research_assistant_with_memory/.env.example` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# VectorAI DB connection (defaults work when running via docker-compose)
+ACTIAN_VECTORAI_URL=localhost:6574
+
+# Optional: access token if you've configured VectorAI DB auth
+# ACTIAN_VECTORAI_ACCESS_TOKEN=your-token-here
+
+# Embeddings (BGE via sentence-transformers, downloaded and cached on first run)
+EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
+EMBEDDING_DIM=384
+
+# Local inference via Ollama
+OLLAMA_HOST=http://localhost:11434
+OLLAMA_MODEL=gemma4:e2b
+
+# Critic / revision loop
+CRITIC_PASS_THRESHOLD=3.5
+MAX_REVISIONS=2
```

**File**: `ai_agents/research_assistant_with_memory/.gitignore` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# VectorAI DB local data volume
+vectorai_data/
+
+# Python
+__pycache__/
+*.py[cod]
+*.egg-info/
+.venv/
+
+# Environment variables (never commit secrets)
+.env
+
+# macOS
+.DS_Store
+
+# HuggingFace model cache (large, re-downloaded on first run)
+~/.cache/huggingface/
```

**File**: `ai_agents/research_assistant_with_memory/.streamlit/config.toml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+[server]
+# Disable the file watcher entirely. "poll" still walks every submodule of
+# large packages like transformers to build its watch list, which triggers
+# harmless but noisy ModuleNotFoundError output for optional deps (e.g.
+# torchvision) at every startup. "none" skips that walk; just rerun manually
+# (r) after editing source instead of relying on hot-reload.
+fileWatcherType = "none"
```

**File**: `ai_agents/research_assistant_with_memory/README.md` (added, +347/-0)
```diff
@@ -0,0 +1,347 @@
+# Multi-Agent Research Assistant with Memory & Self-Evaluation
+
+> A team of four local agents (Planner, Research, Writer, and Critic) that read, cite, and grade their own answers over a shared [Actian VectorAI DB](https://www.actian.com/databases/vectorai-db/) memory layer.
+
+## Demo
+
+![Demo](assets/demo.gif)
+
+## Overview
+
+**Scope: this is a research assistant over your own document collection, not a web-search agent.**
+It answers questions about whatever you've ingested (papers, manuals, transcripts, notes), never
+the web, and never the LLM's own training knowledge. That restriction is deliberate: it's what
+lets the Critic guarantee every claim traces back to a specific retrieved passage instead of a
+plausible-sounding guess. If you want an agent that goes and researches open-ended topics with web
+search, see [research_team](../research_team) in this repo instead.
+
+There is more to read than anyone can keep up with: papers, manuals, and long transcripts. A
+normal chatbot answers off a single prompt, guesses when it isn't sure, and never checks its own
+work. This project is closer to a small research team working over your document library: one
+agent plans the research, one gathers evidence from your documents, one writes the answer, and one
+grades it before it reaches you.
+
+The repo ships with a handful of sample documents already ingested (see [Sample data](#sample-data)
+below) so the demo works the moment you run it, but the library isn't static: add your own PDFs,
+notes, or transcripts anytime from the **Library** tab or the CLI ingestion script, and the next
+question can draw on them immediately.
+
+An ingestion pipeline chunks and embeds every source (PDFs, papers, manuals, video transcripts)
+into one shared Actian VectorAI DB collection, tagged with document and section metadata. A
+LangGraph state machine then runs a question through four agents: the Planner decomposes it into
+search queries, the Research agent retrieves evidence through tools (it never reads a document
+directly), the Writer composes a cited answer, and the Critic scores it on correctness,
+completeness, and clarity. A rejected answer loops back to Research with the Critic's specific
+complaint attached, instead of blindly retrying. Answers that pass are written into a second
+long-term memory collection, so a later session in the same document library builds on prior
+findings instead of starting from zero. Everything runs locally: embeddings via BGE
+(sentence-transformers), generation via Ollama, no external API calls.
+
+## Features
+
+- **Four specialist agents over a shared collection**: Planner, Research, Writer, and Critic, each a plain function over LangGraph state, sharing one Actian VectorAI DB context layer instead of passing documents around directly
+- **Tool-mediated retrieval only**: the Research agent never touches a document; it calls `doc_search`, `get_section`, and `memory_search`, so every fact in a final answer traces back to a logged tool call
+- **Critic-gated revision loop**: a rejected answer (average score below threshold, or ungrounded) routes back to Research with the Critic's specific complaint, capped at `MAX_REVISIONS` passes so a stubborn Critic can't spin forever
+- **Persistent long-term memory**: findings that clear the Critic are embedded and written back to a `research_memory` collection; later questions in the same or later sessions retrieve them alongside raw source chunks
+- **Session memory with context compression**: recent turns are kept verbatim, older ones are folded into a running summary between questions so prompts stay small without losing the thread
+- **Multi-source ingestion**: PDFs, `.txt`/`.md` notes and papers, and `.vtt`/`.srt` video transcripts are sectioned (by heading or page), chunked, and tagged with `doc_id`, `section`, and `source_type` so citations point at a specific document and section
+- **Built-in evaluation suite**: runs a fixed set of questions through the full graph in fresh, memory-isolated sessions and reports mean scores, pass rate, groundedness rate, and mean revisions, so a prompt change can be judged instead of guessed at
+- **Full observability**: every agent step and tool call is logged with duration and metadata and rendered as a table in the UI, turning the pipeline from a black box into something you can debug
+- **Fully local and offline after first run**: VectorAI DB runs in Docker, the LLM runs via Ollama, embeddings run via sentence-transformers; nothing leaves the machine
+
+## Architecture
+
+![Architecture diagram](assets/architecture.svg)
+
+The Planner and Research agents run once per pass; a Critic rejection sends control back to
+Research with `revision_request` attached, so the second pass retrieves against the specific gap
+the Critic flagged rather than repeating the first attempt verbatim. Every agent reaches the shared
+Actian VectorAI DB collections only through tools, never directly.
+

```

**File**: `ai_agents/research_assistant_with_memory/app.py` (added, +444/-0)
```diff
@@ -0,0 +1,444 @@
+"""
+Streamlit interface.
+
+Four tabs:
+  Ask        run a question through the graph and see the answer, the Critic's
+             scores, the evidence it used, and the full event log
+  Library    what is indexed, and upload more sources
+  Evaluate   run the eval suite and see scores in a table
+  Memory     inspect and reset long-term memory
+
+Run with:  streamlit run app.py
+"""
+
+from __future__ import annotations
+
+import tempfile
+from pathlib import Path
+
+import streamlit as st
+
+from research_assistant.config import (
+    DOCUMENTS_COLLECTION,
+    EMBEDDING_MODEL,
+    MEMORY_COLLECTION,
+    OLLAMA_MODEL,
+    VECTORAI_URL,
+)
+from research_assistant.embedder import Embedder
+from research_assistant.evaluation import DEFAULT_QUESTIONS, run_evaluation
+from research_assistant.graph import build_graph, run_query
+from research_assistant.ingest import SUPPORTED_SUFFIXES, ingest_path
+from research_assistant.llm import LLM
+from research_assistant.memory import SessionState
+from research_assistant.observability import RunLogger
+from research_assistant.tools import ResearchTools
+from research_assistant.vectorstore import (
+    get_client,
+    get_collection_counts,
+    list_documents,
+    reset_memory,
+    setup_collections,
+)
+
+st.set_page_config(page_title="Research Assistant", page_icon="🔬", layout="wide")
+
+
+# ---------------------------------------------------------------------------
+# Cached resources
+# ---------------------------------------------------------------------------
+
+@st.cache_resource(show_spinner="Loading embedding model...")
+def load_embedder() -> Embedder:
+    return Embedder()
+
+
+@st.cache_resource(show_spinner="Connecting to VectorAI DB...")
+def load_client(dim: int):
+    client = get_client()
+    setup_collections(client, dim=dim)
+    return client
+
+
+@st.cache_resource(show_spinner="Connecting to Ollama...")
+def load_llm() -> LLM:
+    return LLM()
+
+
+@st.cache_resource(show_spinner="Compiling agent graph...")
+def load_graph():
+    return build_graph()
+
+
+def get_session() -> SessionState:
+    if "session" not in st.session_state:
+        st.session_state.session = SessionState()
+    return st.session_state.session
+
+
+def clear_chat() -> None:
+    """Reset both the agent session and the chat transcript shown in the UI."""
+    session.reset()
+    st.session_state.chat_results = []
+
+
+def build_suggestions(documents: list[dict]) -> dict[str, str]:
+    """Turn what's actually indexed into a few clickable example questions."""
+    if not documents:
+        return {}
+
+    titles = [d["doc_title"] for d in documents]
+    suggestions: dict[str, str] = {
+        f":material/lightbulb: Main contribution of \"{titles[0]}\"": (
+            f'What is the main contribution of "{titles[0]}"?'
+        ),
+    }
+    if len(titles) >= 2:
+        suggestions[f":material/compare_arrows: Compare \"{titles[0]}\" and \"{titles[1]}\""] = (
+            f'Compare "{titles[0]}" and "{titles[1]}" on their approach and limitations.'
+        )
+    suggestions[":material/warning: Limitations across all sources"] = (
+        "What are the main limitations across these documents?"
+    )
+    return suggestions
+
+
+def render_turn(result: dict, log_rows: list[dict], log_ms: int) -> None:
+    """Render one assistant turn: answer, Critic scores, and detail expanders."""
+    critique = result["critique"]
+    plan = result["plan"]
+
+    st.markdown(result["answer"] or "_No answer produced._")
+
+    if plan.get("intent") == "chitchat":
+        # No retrieval happened, so there is nothing for the Critic to grade
+        # against, showing a scorecard here would just be misleading.
+        with st.expander(f"Event log  ·  {log_ms} ms total"):
+            st.dataframe(log_rows, width="stretch", hide_index=True)
+        return
+
+    c1, c2, c3, c4 = st.columns(4)
+    c1.metric("Correctness", f"{critique.get('correctness', 0):.1f}/5")
+    c2.metric("Completeness", f"{critique.get('completeness', 0):.1f}/5")
+    c3.metric("Clarity", f"{critique.get('clarity', 0):.1f}/5")
+    c4.metric("Overall", f"{critique.get('average', 0):.2f}/5")
+
+    status_cols = st.columns(3)
+    status_cols[0].write(
+        "**Verdict:** " + ("passed" if critique.get("passed") else "did not pass")
+    )
+    status_cols[1].write(
+        "**Grounded:** " + ("yes" if critique.get("grounded") else "no")
+    )
+    status_cols[2].write(f"**Revisions:** {result['revisions']}")
+
+    if critique.get("comments"):
+        st.info(critique["comments"])
+
+    with st.expander(f"Plan  ·  intent: {plan.get('intent', 'n/a')}"):
+        st.write(plan.get("reasoning", ""))
+        for sub_query in plan.get("sub_queries", []):
+            st.markdown(f"- `{sub_query}`")
+        st.caption(f"Used long-term memory: {plan.get('use_memory', False)}")
+
+    evidence = result["evidence"]
+    with st.expander(f"Evidence  ·  {len(evidence)} passa
```

**File**: `ai_agents/research_assistant_with_memory/data/paper_dense_passage_retrieval.md` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+# Dense Retrieval for Open-Domain Question Answering
+
+## Abstract
+
+Open-domain question answering systems must locate the small number of passages relevant to a
+question inside a large document collection before an answer can be generated. Classical systems
+rely on sparse lexical matching such as TF-IDF or BM25, which score passages by term overlap
+with the query. This paper studies a purely dense retrieval approach in which questions and
+passages are each encoded into a shared vector space by a bi-encoder, and relevant passages are
+retrieved by nearest-neighbor search over passage embeddings. We show that a bi-encoder trained
+with in-batch negatives on a modest number of question-passage pairs outperforms BM25 on passage
+retrieval accuracy across several open-domain QA benchmarks, and that gains in retrieval quality
+translate directly into gains in downstream answer accuracy when the retrieved passages are fed
+to a reader model.
+
+## Introduction
+
+Retrieval is the first and most consequential step in an open-domain question answering pipeline.
+If the retriever fails to surface a passage containing the answer, no downstream reader, however
+capable, can recover. Sparse retrieval methods have been the default choice for decades because
+they require no training, generalize across domains, and are fast at scale. Their weakness is
+also well known: they cannot bridge a vocabulary gap between how a question is phrased and how
+the answer passage is written. A question asking "who is the bad guy in the movie" will not match
+a passage that only ever uses the word "antagonist."
+
+Dense retrieval addresses this by learning a semantic representation of text rather than relying
+on exact term overlap. The central design question is how to train the encoders so that questions
+and their relevant passages land close together in vector space while irrelevant passages are
+pushed apart, using only the supervision that is realistically available: pairs of questions and
+one or a few gold passages, without hard negative labels for every passage in the collection.
+
+## Method
+
+We use two independent BERT-based encoders, one for questions and one for passages, and represent
+each text as the vector of its [CLS] token. Training uses a contrastive objective: for each
+question in a training batch, its gold passage is treated as the positive example, and every other
+passage's gold passage in the same batch is treated as a negative example. This in-batch negative
+sampling scheme is what makes training tractable, since it avoids having to define hard negatives
+by hand while still exposing the model to a large number of negatives per step as batch size grows.
+
+At inference time, every passage in the collection is encoded once and stored in an index that
+supports approximate nearest-neighbor search. A question is encoded at query time and the index
+returns the passages whose vectors are closest under inner product similarity. No further
+re-ranking is applied in the base configuration, isolating the contribution of the dense encoders
+themselves.
+
+## Results
+
+Across five open-domain QA datasets, dense retrieval improves top-20 passage retrieval accuracy by
+9 to 19 points over a BM25 baseline, with the largest gains on datasets where questions are phrased
+conversationally rather than as keyword-style queries. When the same retrieved passages are passed
+to an extractive reader, end-to-end answer exact-match accuracy improves by a comparable margin,
+confirming that retrieval quality is the binding constraint on system accuracy in this setting.
+Combining dense and sparse scores with a simple linear combination yields a further small
+improvement over either method alone, suggesting the two approaches make partially independent
+errors.
+
+## Limitations
+
+The approach depends on having question-passage training pairs; without in-domain supervision,
+transfer to a new domain with substantially different vocabulary or document structure is weaker
+than the in-domain numbers suggest. The bi-encoder architecture also cannot model fine-grained
+token-level interactions between the question and passage at scoring time, since the two are
+encoded independently before comparison; a cross-encoder re-ranker recovers some of this
+interaction but at a large increase in inference cost, since it must be run separately for every
+candidate passage rather than once per query. Finally, the index must be fully rebuilt whenever
+the passage collection changes, which is expensive for corpora that update frequently.
```

**File**: `ai_agents/research_assistant_with_memory/data/paper_hybrid_retrieval_augmented_generation.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# Hybrid Sparse-Dense Retrieval for Grounded Generation
+
+## Abstract
+
+Retrieval-augmented generation systems condition a language model's output on passages retrieved
+from an external corpus, which reduces hallucination and allows knowledge to be updated without
+retraining the model. Most deployed systems choose either a sparse lexical retriever or a dense
+neural retriever, but each has failure modes the other does not share: sparse retrieval misses
+paraphrases and synonyms, while dense retrieval can miss rare entities, numbers, and exact-match
+terms that were underrepresented during encoder training. We propose a hybrid retriever that fuses
+sparse and dense rankings with reciprocal rank fusion, and a generator that is explicitly trained
+to attribute claims to specific retrieved passages. We evaluate on long-form question answering and
+multi-document summarization and find that the hybrid retriever improves both retrieval recall and
+the factual grounding of generated text compared to either retriever used alone.
+
+## Introduction
+
+A generation model that answers questions purely from its parameters cannot cite a source, cannot
+be corrected by updating a document store, and will confidently state facts that are wrong or
+outdated. Retrieval-augmented generation is attractive precisely because it decouples what the
+model knows from what it was trained on: the retriever supplies current, verifiable evidence, and
+the generator's job narrows to synthesizing that evidence into fluent, grounded prose.
+
+The retrieval step still determines the ceiling on system quality. Dense retrievers trained on
+general question-answering data are strong at matching paraphrased intent but are known to
+underperform on queries containing rare proper nouns, product codes, or numeric identifiers,
+because these tokens are sparsely represented in the training distribution of the encoder. Sparse
+retrievers handle exact-match terms well by construction but cannot bridge a vocabulary gap. This
+motivates combining both signals rather than picking one.
+
+## Method
+
+Our retriever runs a sparse BM25 search and a dense bi-encoder search independently over the same
+corpus and merges the two ranked lists with reciprocal rank fusion, which scores each passage by
+the sum of the inverse of its rank in each list. This avoids the need to calibrate sparse and dense
+similarity scores onto a common scale, which is a persistent difficulty with weighted score
+combination.
+
+Retrieved passages are passed to the generator with an explicit instruction to cite the passage
+each claim is drawn from using inline bracketed markers. We additionally fine-tune the generator on
+a small set of examples where every sentence in the target output is paired with its supporting
+passage, so the model learns the citation behavior rather than being asked to produce it purely
+through prompting.
+
+## Results
+
+The hybrid retriever improves passage recall at the top 10 results by 6 to 12 points over the
+stronger of the two individual retrievers, with the largest gains concentrated on queries containing
+named entities or numeric values that the dense retriever alone tends to miss. Human evaluators
+judged hybrid-retrieval outputs as more fully grounded, with fewer unsupported claims, than outputs
+generated from dense-only retrieval, even when both conditions were given the same number of
+retrieved passages. Citation accuracy, meaning whether a cited passage actually supports the
+sentence it is attached to, was also higher for the fine-tuned citation-aware generator than for a
+generator prompted to cite without fine-tuning.
+
+## Limitations
+
+Reciprocal rank fusion has no learned parameters, which makes it robust but also unable to adapt
+its balance of sparse and dense signal to a particular domain or query type; a learned fusion model
+might do better but requires labeled relevance data to train. The citation-aware generator still
+occasionally attaches a citation to a sentence that only partially follows from the cited passage,
+particularly for sentences that combine information from two passages into one claim. Latency is
+also higher than either retriever alone, since two full retrieval passes must complete before
+fusion and generation can begin, which matters for applications with tight response-time budgets.
```

---

### Incident Patch 6: `014292df` (2026-07-01)
**Commit Message**: Add customer support voice agent tutorial (Telnyx AI Assistant Builder)

**File**: `voice_apps/customer_support_voice_agent/.env.example` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+# Telnyx API credentials
+# Get from portal.telnyx.com > API Keys
+TELNYX_API_KEY=your_telnyx_api_key_here
+TELNYX_PUBLIC_KEY=your_ed25519_public_key_here
+
+# Server config
+HOST=127.0.0.1
+PORT=8000
```

**File**: `voice_apps/customer_support_voice_agent/.gitignore` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+.env
+__pycache__/
+*.pyc
+*.pyo
+.venv/
+venv/
+*.egg-info/
+dist/
+.DS_Store
```

**File**: `voice_apps/customer_support_voice_agent/README.md` (added, +284/-0)
```diff
@@ -0,0 +1,284 @@
+# Customer Support Voice Agent (Telnyx AI Assistant Builder)
+
+![Demo](assets/demo.gif)
+
+A voice AI agent that answers phone calls and handles customer support conversations. Configured in the Telnyx portal (no-code) with a FastAPI webhook that injects real-time context into every call.
+
+## Overview
+
+This project uses the **Telnyx AI Assistant Builder** to configure the agent, model, voice, system prompt and phone number entirely in the Telnyx portal. Our FastAPI server contributes a **Dynamic Variables webhook**: Telnyx calls it at the start of every call, and we return live data (system status, queue wait time, business hours) that gets injected into the agent's system prompt as `{{variable}}` placeholders.
+
+**What Telnyx portal handles:** STT, LLM inference, TTS, phone number routing, conversation history, embeddable browser widget.
+
+**What our code handles:** real-time context injection via Dynamic Variables webhook.
+
+## How It Works
+
+![How It Works](assets/how_it_works.png)
+
+## Tech Stack
+
+| Layer | Tool |
+|---|---|
+| Agent configuration | Telnyx AI Assistant Builder (no-code portal) |
+| LLM | `moonshotai/Kimi-K2.5` via Telnyx (no external API key) |
+| STT | Telnyx native |
+| TTS | Telnyx native |
+| Context webhook | FastAPI + Uvicorn |
+| Browser demo | Telnyx embeddable widget (from portal Widget tab) |
+| Package manager | uv |
+
+## Prerequisites
+
+- Python 3.10 or higher
+- [uv](https://docs.astral.sh/uv/) (`pip install uv`)
+- [ngrok](https://ngrok.com) to expose your webhook during development
+- A [Telnyx account](https://portal.telnyx.com/sign-up) with a funded balance
+
+## Telnyx Portal Setup
+
+All of this is done at [portal.telnyx.com](https://portal.telnyx.com).
+
+### Step 1: Get your API credentials
+
+- Copy your **API Key** (starts with `KEY...`)
+- Click the **Public Key** tab on the same page and copy your **Ed25519 Public Key**
+
+### Step 2: Buy a phone number
+
+- Search for a US number and purchase it
+
+### Step 3: Create your AI Assistant
+
+- Left sidebar → **AI** section → **AI Assistants** → **Create New**
+- Choose **Blank Template**
+- Fill in the **Instructions** field (paste the system prompt below):
+
+```
+You are a customer support agent for a full-service retail bank serving personal
+and business customers.
+
+Keep all responses under 2 sentences -- callers are listening, not reading.
+Speak calmly and professionally. If a question is not covered in the knowledge
+base below, acknowledge it warmly and offer to transfer the caller to a specialist.
+
+System status: {{system_status}}
+Active incidents: {{todays_incidents}}
+Queue wait: {{current_queue_wait}}
+Business hours: {{business_hours}}
+Support email: {{support_email}}
+
+--- KNOWLEDGE BASE ---
+
+ACCOUNTS
+We offer three personal account tiers. The Everyday Checking account carries no
+minimum balance, includes a free debit card and online bill pay, and reimburses up
+to $10 in ATM fees each month. The Premier Checking account charges a $12 monthly
+fee that is waived when the customer maintains a $2,500 minimum daily balance or
+receives a recurring direct deposit of at least $1,000 per month; it also earns
+0.05% APY. The Savings account currently earns 4.25% APY with no minimum balance
+required; customers may make up to 6 withdrawals per month before a $5 excess
+withdrawal fee applies.
+
+DEBIT AND CREDIT CARDS
+Customers who lose a card or believe it has been stolen should report it immediately
+by calling the 24-hour card hotline at 1-800-555-0199 or by freezing the card
+instantly through Card Controls in the mobile app. A replacement card arrives within
+5 to 7 business days. Transaction disputes must be filed within 60 days of the
+statement date and are typically resolved within 10 business days. Temporary card
+freezes and unfreezes are available at any time in the mobile app -- no call required.
+
+TRANSFERS AND PAYMENTS
+Outgoing domestic wire transfers submitted before 3:00 PM EST on a business day are
+processed the same day; transfers submitted after the cut-off are processed the
+following business day. The fee is $25 for outgoing and $15 for incoming domestic
+wires. Zelle transfers between enrolled customers typically arrive within minutes.
+ACH transfers to external accounts take 1 to 3 business days. Customers can link up
+to 5 external accounts under Transfers in Online Banking.
+
+LOANS
+Personal loans are available from $2,000 to $50,000 with fixed APRs between 7.99%
+and 24.99% based on credit profile and term length. Auto loans for new and used
+vehicles start at 5.49% APR for 60-month terms. Mortgage pre-qualification is
+available online and takes approximately 2 business days. All loan applications can
+be started on our website or at any branch.
+
+ONLINE BANKING AND MOBILE APP
+Customers who forget their Online Banking password can reset it on our website by
+selecting Forgot Password; a verification code is sent to the registered e
```

**File**: `voice_apps/customer_support_voice_agent/demo.html` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8" />
+  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+  <title>Customer Support Voice Agent</title>
+  <style>
+    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
+
+    body {
+      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
+      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
+      min-height: 100vh;
+      display: flex;
+      flex-direction: column;
+      align-items: center;
+      justify-content: center;
+      padding: 40px 24px;
+    }
+
+    .hero {
+      text-align: center;
+      max-width: 480px;
+      margin-bottom: 40px;
+    }
+
+    .badge {
+      display: inline-block;
+      background: rgba(99, 102, 241, 0.15);
+      color: #a5b4fc;
+      font-size: 12px;
+      font-weight: 600;
+      padding: 4px 12px;
+      border-radius: 999px;
+      margin-bottom: 16px;
+      letter-spacing: 0.3px;
+      border: 1px solid rgba(99, 102, 241, 0.25);
+    }
+
+    h1 {
+      font-size: 28px;
+      font-weight: 700;
+      color: #f1f5f9;
+      line-height: 1.3;
+    }
+
+    .widget-wrap {
+      display: flex;
+      justify-content: center;
+    }
+
+    .footer {
+      margin-top: 32px;
+      font-size: 12px;
+      color: #475569;
+      text-align: center;
+    }
+  </style>
+</head>
+<body>
+
+  <div class="hero">
+    <div class="badge">Live Demo</div>
+    <h1>Customer Support Voice Agent</h1>
+  </div>
+
+  <div class="widget-wrap">
+    <telnyx-ai-agent
+      agent-id="assistant-82094bd1-1a27-42b0-9dbb-52c56d2fbe62"
+      environment="production">
+    </telnyx-ai-agent>
+    <script async src="https://unpkg.com/@telnyx/ai-agent-widget@next"></script>
+  </div>
+
+  <p class="footer">
+    Built with Telnyx AI Assistant Builder &middot; FastAPI Dynamic Variables Webhook &middot; Kimi K2.5
+  </p>
+
+</body>
+</html>
```

**File**: `voice_apps/customer_support_voice_agent/main.py` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+#!/usr/bin/env python3
+"""SaaS Customer Support Voice Agent -- Dynamic Variables Webhook.
+
+Telnyx AI Assistant Builder calls this webhook at the start of each call.
+We return real-time context that gets injected into the assistant's system
+prompt as {{variable}} placeholders -- no static hardcoded values needed.
+
+In production, replace the stub values with real database/API lookups.
+"""
+
+import os
+import time
+
+import telnyx
+from dotenv import load_dotenv
+from fastapi import FastAPI, HTTPException, Request
+from fastapi.responses import JSONResponse
+
+load_dotenv()
+
+# ---------------------------------------------------------------------------
+# Config
+# ---------------------------------------------------------------------------
+
+TELNYX_API_KEY: str = os.getenv("TELNYX_API_KEY", "")
+TELNYX_PUBLIC_KEY: str = os.getenv("TELNYX_PUBLIC_KEY", "")
+
+telnyx_client = telnyx.Telnyx(api_key=TELNYX_API_KEY, public_key=TELNYX_PUBLIC_KEY)
+
+# ---------------------------------------------------------------------------
+# App
+# ---------------------------------------------------------------------------
+
+app = FastAPI(
+    title="SaaS Customer Support -- Dynamic Variables Webhook",
+    description="Injects real-time SaaS context into a Telnyx AI Assistant at call start.",
+    version="1.0.0",
+)
+
+# ---------------------------------------------------------------------------
+# Dynamic Variables webhook
+# ---------------------------------------------------------------------------
+
+
+def get_live_context() -> dict:
+    """Return real-time context for the AI assistant system prompt.
+
+    These values replace {{variable}} placeholders in the assistant's
+    Instructions field (configured in the Telnyx portal).
+
+    In production, replace these stubs with real lookups:
+      - system_status    -> query your status page API
+      - current_queue_wait -> query your support queue
+      - todays_incidents -> query PagerDuty, OpsGenie, etc.
+    """
+    return {
+        "system_status": "All systems operational",
+        "current_queue_wait": "Under 2 minutes",
+        "business_hours": "Monday to Friday, 9AM to 5PM EST; Saturday, 9AM to 1PM EST",
+        "todays_incidents": "None",
+        "support_email": "support@bank.com",
+    }
+
+
+@app.post("/webhooks/dynamic-variables")
+async def dynamic_variables(request: Request) -> JSONResponse:
+    """Telnyx calls this endpoint at the start of each call.
+
+    Telnyx sends a POST with call metadata. We respond with a dict of
+    key/value pairs that are injected into the assistant's system prompt
+    via {{variable}} placeholders.
+
+    Docs: https://developers.telnyx.com/docs/inference/ai-assistants/dynamic-variables
+    """
+    # Verify Ed25519 signature before trusting the request
+    raw_body = await request.body()
+    try:
+        telnyx_client.webhooks.unwrap(raw_body.decode("utf-8"), dict(request.headers))
+    except Exception:
+        raise HTTPException(status_code=401, detail="Invalid webhook signature")
+
+    # Return live context -- Telnyx injects these as {{variable}} in the prompt
+    return JSONResponse(get_live_context())
+
+
+# ---------------------------------------------------------------------------
+# Health check
+# ---------------------------------------------------------------------------
+
+
+@app.get("/health")
+async def health() -> JSONResponse:
+    return JSONResponse({"status": "ok", "timestamp": int(time.time())})
+
+
+# ---------------------------------------------------------------------------
+# Entry point
+# ---------------------------------------------------------------------------
+
+if __name__ == "__main__":
+    import uvicorn
+
+    uvicorn.run(
+        "main:app",
+        host=os.getenv("HOST", "127.0.0.1"),
+        port=int(os.getenv("PORT", "8000")),
+        reload=False,
+    )
```

**File**: `voice_apps/customer_support_voice_agent/pyproject.toml` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+[project]
+name = "saas-customer-support-voice-agent"
+version = "1.0.0"
+description = "SaaS Customer Support Voice Agent -- Dynamic Variables webhook for Telnyx AI Assistant Builder"
+requires-python = ">=3.10"
+dependencies = [
+    "fastapi>=0.115.0",
+    "uvicorn[standard]>=0.32.0",
+    "python-dotenv>=1.0.0",
+    "telnyx>=4.0.0",
+]
```

---

### Incident Patch 7: `4db05f3a` (2026-06-20)
**Commit Message**: audit: fix multi_agent_research_assistant_ag2 - swap to Mistral via native AG2 integration, fix UI layout, add docstrings, rewrite em dashes

**File**: `ai_agents/multi_agent_research_assistant_ag2/.env.example` (modified, +4/-3)
```diff
@@ -1,3 +1,4 @@
-OPENAI_API_KEY=your_openai_api_key_here
-OPENAI_BASE_URL=https://api.openai.com/v1   # override for SambaNova, Azure, etc.
-LLM_MODEL=gpt-4o-mini
+# Mistral API key used by the researcher, analyst, and writer agents (Mistral Small 4).
+# Get one at https://console.mistral.ai/api-keys
+MISTRAL_API_KEY=your_mistral_api_key_here
+LLM_MODEL=mistral-small-latest
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/README.md` (modified, +22/-11)
```diff
@@ -1,25 +1,31 @@
+<a id="top"></a>
+
 # Multi-Agent Research Assistant with AG2
 
 A production-grade multi-agent research pipeline using [AG2](https://github.com/ag2ai/ag2)
-(formerly AutoGen). Three specialists collaborate under GroupChat with LLM-driven speaker
-selection to research any topic and produce a structured Markdown report.
+(formerly AutoGen). Three specialists collaborate under GroupChat to research any topic
+and produce a structured Markdown report, powered by Mistral Small 4
+(`mistral-small-latest`) via AG2's native Mistral integration.
 
 ## Features
 - Multi-agent collaboration (researcher, analyst, writer) under GroupChat
-- LLM-driven dynamic speaker selection — no hardcoded turn order
 - AG2's `register_function(caller=, executor=)` tool registration pattern
-- OpenAI-compatible endpoint (works with SambaNova, Azure OpenAI, local models via Ollama)
+- Native Mistral support via AG2's `api_type: "mistral"` config entry
 - Download report as Markdown
 
+## Demo
+
+![Demo](assets/demo.gif)
+
 ## Prerequisites
 - Python 3.10+
-- OpenAI API key (or compatible endpoint)
+- Mistral API key from [console.mistral.ai](https://console.mistral.ai/api-keys)
 
 ## Installation
 ```bash
 cd multi_agent_research_assistant_ag2
 pip install -r requirements.txt
-cp .env.example .env  # add your API key
+cp .env.example .env  # add your Mistral API key
 ```
 
 ## Usage
@@ -32,20 +38,21 @@ streamlit run research_assistant.py
 1. **Researcher** searches the web using DuckDuckGo API and summarises findings
 2. **Analyst** critically reviews the research and identifies gaps
 3. **Writer** synthesises all inputs into a structured Markdown report
-4. **GroupChatManager** uses LLM-based speaker selection to orchestrate the conversation
+4. **GroupChatManager** orchestrates the analyst and writer in round-robin order
 
 ## AG2 Concepts Demonstrated
-- `GroupChat` with `speaker_selection_method="auto"`
-- `register_function(caller=, executor=)` — separates tool description from execution
-- `UserProxyAgent` with `code_execution_config` — built-in code execution sandbox
+- `GroupChat` with `speaker_selection_method="round_robin"`
+- `register_function(caller=, executor=)`, which separates tool description from execution
+- `UserProxyAgent` with `code_execution_config`, providing a built-in code execution sandbox
+- Native Mistral integration via `{"api_type": "mistral", "model": "mistral-small-latest", ...}` in `LLMConfig`, instead of pointing an OpenAI-compatible `base_url` at Mistral's endpoint
 
 > **Security note:** `use_docker=False` in `code_execution_config` means any agent-generated
 > code runs directly in your process. For production use, set `use_docker=True` or run in
 > an isolated environment.
 
 ## Running Tests
 
-Tests are fully mocked — no API keys or network access required.
+Tests are fully mocked and require no API keys or network access.
 
 ```bash
 pip install pytest
@@ -66,3 +73,7 @@ multi_agent_research_assistant_ag2/
 ├── requirements.txt
 └── .env.example
 ```
+
+---
+
+[Back to top](#top)
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/requirements.txt` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
 ag2>=0.11.0
+mistralai>=2.0.0
 streamlit>=1.31.0
 python-dotenv>=1.0.0
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/research_assistant.py` (modified, +80/-30)
```diff
@@ -1,4 +1,5 @@
-# research_assistant.py
+"""Multi-agent research pipeline using AG2 (AutoGen): researcher, analyst, and writer
+agents collaborate under GroupChat, powered by Mistral Small 4, with a Streamlit UI."""
 import os
 import streamlit as st
 from datetime import datetime
@@ -9,32 +10,69 @@
 
 load_dotenv()
 
-# ── AG2 (formerly AutoGen) requires ag2>=0.11 ──────────────────────────────────
+# ── Patch: normalize Mistral citation chunks before AG2's message parser sees them ──
+# Mistral's grounding/web-search feature returns AssistantMessage.content as
+# list[TextChunk | ReferenceChunk] instead of a plain str. AG2's ChatCompletionMessage
+# expects str | dict | list[dict] | None, so passing Pydantic objects causes validation
+# errors. We replace the ChatCompletionMessage name in autogen.oai.mistral's module
+# namespace with a factory that flattens the list to a string first.
+import autogen.oai.mistral as _mistral_module
+from autogen.oai.oai_models import ChatCompletionMessage as _RealCCM
+from mistralai.client.models import TextChunk as _TextChunk
+
+
+def _normalize_mistral_content(content):
+    if not isinstance(content, list):
+        return content
+    return "".join(
+        chunk.text if isinstance(chunk, _TextChunk) else
+        (chunk.text if hasattr(chunk, "text") else "")
+        for chunk in content
+    )
+
+
+def _CCMFactory(**kwargs):
+    content = kwargs.get("content")
+    if isinstance(content, list):
+        kwargs["content"] = _normalize_mistral_content(content)
+    return _RealCCM(**kwargs)
+
+
+_mistral_module.ChatCompletionMessage = _CCMFactory
+# ── End patch ──────────────────────────────────────────────────────────────────
+
 
 def build_llm_config() -> LLMConfig:
-    api_key = os.getenv("OPENAI_API_KEY", "")
+    """Builds the AG2 LLMConfig for Mistral Small 4 using AG2's native Mistral client."""
+    api_key = os.getenv("MISTRAL_API_KEY", "")
     if not api_key:
-        raise ValueError("OPENAI_API_KEY is not set. Add it to .env or the sidebar.")
+        raise ValueError("MISTRAL_API_KEY is not set. Add it to .env or the sidebar.")
     return LLMConfig(
-        {"model": os.getenv("LLM_MODEL", "gpt-4o-mini"),
-         "api_key": api_key,
-         "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")},
+        {"api_type": "mistral",
+         "model": os.getenv("LLM_MODEL", "mistral-small-latest"),
+         "api_key": api_key},
         temperature=0.3,
         cache_seed=None,  # always fetch fresh data
     )
 
 
 def run_research(topic: str) -> str:
+    """Runs the researcher, analyst, and writer agents and returns the final report.
+
+    Tool calls are confined to an isolated researcher/executor exchange, separate from
+    the analyst/writer GroupChat. Mistral's API rejects message histories where the
+    number of function calls and responses don't match, which happens when GroupChat's
+    "auto" speaker selection asks the LLM who should speak next while a tool call from
+    researcher is still awaiting its response from executor.
+    """
     llm_config = build_llm_config()
 
     # ── Agents ─────────────────────────────────────────────────────────────────
 
     researcher = AssistantAgent(
         name="researcher",
-        system_message="""You are a research specialist. Your job is to gather
-comprehensive information about the given topic using web_search and fetch_page_content.
-Perform at least 3 searches and fetch content from 2+ pages.
-Summarise all findings clearly. End with: RESEARCH COMPLETE.""",
+        system_message="""You are a research specialist. Search for information about the given topic using web_search.
+Perform exactly 2 searches, then summarise the findings clearly. End with: RESEARCH COMPLETE.""",
         llm_config=llm_config,
     )
 
@@ -63,7 +101,9 @@ def run_research(topic: str) -> str:
         name="executor",
         human_input_mode="NEVER",
         code_execution_config={"work_dir": "workspace", "use_docker": False},
-        is_termination_msg=lambda msg: "REPORT COMPLETE" in (msg.get("content") or ""),
+        is_termination_msg=lambda msg: any(
+            phrase in (msg.get("content") or "") for phrase in ("RESEARCH COMPLETE", "REPORT COMPLETE")
+        ),
         default_auto_reply="",
     )
 
@@ -81,18 +121,37 @@ def run_research(topic: str) -> str:
             description=(fn.__doc__ or "").strip().split("\n")[0],
         )
 
-    # ── GroupChat orchestration ────────────────────────────────────────────────
+    # ── Phase 1: isolated researcher/executor exchange ─────────────────────────
+    # A plain two-agent chat always pairs a tool call with its response in the
+    # same turn, so there is never an orphaned tool call in the history.
+
+    executor.initiate_chat(
+        researcher,
+        message=f"Research the following topic thoroughly: {topic}",
+        clear_history=True,
+    )
+    research_notes = researcher.last_message(executor)["content"
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/tests/test_agent_setup.py` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import os
 import pytest
-os.environ.setdefault("OPENAI_API_KEY", "test-key-no-llm-calls")
+os.environ.setdefault("MISTRAL_API_KEY", "test-key-no-llm-calls")
 
 def test_agents_instantiate():
     """Verify agent setup does not raise — no LLM calls made."""
@@ -34,7 +34,7 @@ def test_tool_registration():
     from tools.research_tools import web_search, fetch_page_content
     from autogen import AssistantAgent, UserProxyAgent, LLMConfig, register_function
 
-    llm = LLMConfig({"model": "gpt-4o-mini", "api_key": "test"})
+    llm = LLMConfig({"api_type": "mistral", "model": "mistral-small-latest", "api_key": "test"})
     researcher = AssistantAgent(name="r", system_message="test", llm_config=llm)
     executor = UserProxyAgent(name="e", human_input_mode="NEVER", code_execution_config=False)
     for fn in (web_search, fetch_page_content):
```

---

### Incident Patch 8: `f4b5b370` (2026-06-20)
**Commit Message**: audit: fix multi_agent_research_assistant_ag2 - swap to Mistral via native AG2 integration, fix UI layout, add docstrings, rewrite em dashes

**File**: `ai_agents/multi_agent_research_assistant_ag2/.env.example` (modified, +4/-3)
```diff
@@ -1,3 +1,4 @@
-OPENAI_API_KEY=your_openai_api_key_here
-OPENAI_BASE_URL=https://api.openai.com/v1   # override for SambaNova, Azure, etc.
-LLM_MODEL=gpt-4o-mini
+# Mistral API key used by the researcher, analyst, and writer agents (Mistral Small 4).
+# Get one at https://console.mistral.ai/api-keys
+MISTRAL_API_KEY=your_mistral_api_key_here
+LLM_MODEL=mistral-small-latest
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/README.md` (modified, +22/-11)
```diff
@@ -1,25 +1,31 @@
+<a id="top"></a>
+
 # Multi-Agent Research Assistant with AG2
 
 A production-grade multi-agent research pipeline using [AG2](https://github.com/ag2ai/ag2)
-(formerly AutoGen). Three specialists collaborate under GroupChat with LLM-driven speaker
-selection to research any topic and produce a structured Markdown report.
+(formerly AutoGen). Three specialists collaborate under GroupChat to research any topic
+and produce a structured Markdown report, powered by Mistral Small 4
+(`mistral-small-latest`) via AG2's native Mistral integration.
 
 ## Features
 - Multi-agent collaboration (researcher, analyst, writer) under GroupChat
-- LLM-driven dynamic speaker selection — no hardcoded turn order
 - AG2's `register_function(caller=, executor=)` tool registration pattern
-- OpenAI-compatible endpoint (works with SambaNova, Azure OpenAI, local models via Ollama)
+- Native Mistral support via AG2's `api_type: "mistral"` config entry
 - Download report as Markdown
 
+## Demo
+
+![Demo](assets/demo.gif)
+
 ## Prerequisites
 - Python 3.10+
-- OpenAI API key (or compatible endpoint)
+- Mistral API key from [console.mistral.ai](https://console.mistral.ai/api-keys)
 
 ## Installation
 ```bash
 cd multi_agent_research_assistant_ag2
 pip install -r requirements.txt
-cp .env.example .env  # add your API key
+cp .env.example .env  # add your Mistral API key
 ```
 
 ## Usage
@@ -32,20 +38,21 @@ streamlit run research_assistant.py
 1. **Researcher** searches the web using DuckDuckGo API and summarises findings
 2. **Analyst** critically reviews the research and identifies gaps
 3. **Writer** synthesises all inputs into a structured Markdown report
-4. **GroupChatManager** uses LLM-based speaker selection to orchestrate the conversation
+4. **GroupChatManager** orchestrates the analyst and writer in round-robin order
 
 ## AG2 Concepts Demonstrated
-- `GroupChat` with `speaker_selection_method="auto"`
-- `register_function(caller=, executor=)` — separates tool description from execution
-- `UserProxyAgent` with `code_execution_config` — built-in code execution sandbox
+- `GroupChat` with `speaker_selection_method="round_robin"`
+- `register_function(caller=, executor=)`, which separates tool description from execution
+- `UserProxyAgent` with `code_execution_config`, providing a built-in code execution sandbox
+- Native Mistral integration via `{"api_type": "mistral", "model": "mistral-small-latest", ...}` in `LLMConfig`, instead of pointing an OpenAI-compatible `base_url` at Mistral's endpoint
 
 > **Security note:** `use_docker=False` in `code_execution_config` means any agent-generated
 > code runs directly in your process. For production use, set `use_docker=True` or run in
 > an isolated environment.
 
 ## Running Tests
 
-Tests are fully mocked — no API keys or network access required.
+Tests are fully mocked and require no API keys or network access.
 
 ```bash
 pip install pytest
@@ -66,3 +73,7 @@ multi_agent_research_assistant_ag2/
 ├── requirements.txt
 └── .env.example
 ```
+
+---
+
+[Back to top](#top)
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/requirements.txt` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
 ag2>=0.11.0
+mistralai>=2.0.0
 streamlit>=1.31.0
 python-dotenv>=1.0.0
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/research_assistant.py` (modified, +80/-30)
```diff
@@ -1,4 +1,5 @@
-# research_assistant.py
+"""Multi-agent research pipeline using AG2 (AutoGen): researcher, analyst, and writer
+agents collaborate under GroupChat, powered by Mistral Small 4, with a Streamlit UI."""
 import os
 import streamlit as st
 from datetime import datetime
@@ -9,32 +10,69 @@
 
 load_dotenv()
 
-# ── AG2 (formerly AutoGen) requires ag2>=0.11 ──────────────────────────────────
+# ── Patch: normalize Mistral citation chunks before AG2's message parser sees them ──
+# Mistral's grounding/web-search feature returns AssistantMessage.content as
+# list[TextChunk | ReferenceChunk] instead of a plain str. AG2's ChatCompletionMessage
+# expects str | dict | list[dict] | None, so passing Pydantic objects causes validation
+# errors. We replace the ChatCompletionMessage name in autogen.oai.mistral's module
+# namespace with a factory that flattens the list to a string first.
+import autogen.oai.mistral as _mistral_module
+from autogen.oai.oai_models import ChatCompletionMessage as _RealCCM
+from mistralai.client.models import TextChunk as _TextChunk
+
+
+def _normalize_mistral_content(content):
+    if not isinstance(content, list):
+        return content
+    return "".join(
+        chunk.text if isinstance(chunk, _TextChunk) else
+        (chunk.text if hasattr(chunk, "text") else "")
+        for chunk in content
+    )
+
+
+def _CCMFactory(**kwargs):
+    content = kwargs.get("content")
+    if isinstance(content, list):
+        kwargs["content"] = _normalize_mistral_content(content)
+    return _RealCCM(**kwargs)
+
+
+_mistral_module.ChatCompletionMessage = _CCMFactory
+# ── End patch ──────────────────────────────────────────────────────────────────
+
 
 def build_llm_config() -> LLMConfig:
-    api_key = os.getenv("OPENAI_API_KEY", "")
+    """Builds the AG2 LLMConfig for Mistral Small 4 using AG2's native Mistral client."""
+    api_key = os.getenv("MISTRAL_API_KEY", "")
     if not api_key:
-        raise ValueError("OPENAI_API_KEY is not set. Add it to .env or the sidebar.")
+        raise ValueError("MISTRAL_API_KEY is not set. Add it to .env or the sidebar.")
     return LLMConfig(
-        {"model": os.getenv("LLM_MODEL", "gpt-4o-mini"),
-         "api_key": api_key,
-         "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")},
+        {"api_type": "mistral",
+         "model": os.getenv("LLM_MODEL", "mistral-small-latest"),
+         "api_key": api_key},
         temperature=0.3,
         cache_seed=None,  # always fetch fresh data
     )
 
 
 def run_research(topic: str) -> str:
+    """Runs the researcher, analyst, and writer agents and returns the final report.
+
+    Tool calls are confined to an isolated researcher/executor exchange, separate from
+    the analyst/writer GroupChat. Mistral's API rejects message histories where the
+    number of function calls and responses don't match, which happens when GroupChat's
+    "auto" speaker selection asks the LLM who should speak next while a tool call from
+    researcher is still awaiting its response from executor.
+    """
     llm_config = build_llm_config()
 
     # ── Agents ─────────────────────────────────────────────────────────────────
 
     researcher = AssistantAgent(
         name="researcher",
-        system_message="""You are a research specialist. Your job is to gather
-comprehensive information about the given topic using web_search and fetch_page_content.
-Perform at least 3 searches and fetch content from 2+ pages.
-Summarise all findings clearly. End with: RESEARCH COMPLETE.""",
+        system_message="""You are a research specialist. Search for information about the given topic using web_search.
+Perform exactly 2 searches, then summarise the findings clearly. End with: RESEARCH COMPLETE.""",
         llm_config=llm_config,
     )
 
@@ -63,7 +101,9 @@ def run_research(topic: str) -> str:
         name="executor",
         human_input_mode="NEVER",
         code_execution_config={"work_dir": "workspace", "use_docker": False},
-        is_termination_msg=lambda msg: "REPORT COMPLETE" in (msg.get("content") or ""),
+        is_termination_msg=lambda msg: any(
+            phrase in (msg.get("content") or "") for phrase in ("RESEARCH COMPLETE", "REPORT COMPLETE")
+        ),
         default_auto_reply="",
     )
 
@@ -81,18 +121,37 @@ def run_research(topic: str) -> str:
             description=(fn.__doc__ or "").strip().split("\n")[0],
         )
 
-    # ── GroupChat orchestration ────────────────────────────────────────────────
+    # ── Phase 1: isolated researcher/executor exchange ─────────────────────────
+    # A plain two-agent chat always pairs a tool call with its response in the
+    # same turn, so there is never an orphaned tool call in the history.
+
+    executor.initiate_chat(
+        researcher,
+        message=f"Research the following topic thoroughly: {topic}",
+        clear_history=True,
+    )
+    research_notes = researcher.last_message(executor)["content"
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/tests/test_agent_setup.py` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import os
 import pytest
-os.environ.setdefault("OPENAI_API_KEY", "test-key-no-llm-calls")
+os.environ.setdefault("MISTRAL_API_KEY", "test-key-no-llm-calls")
 
 def test_agents_instantiate():
     """Verify agent setup does not raise — no LLM calls made."""
@@ -34,7 +34,7 @@ def test_tool_registration():
     from tools.research_tools import web_search, fetch_page_content
     from autogen import AssistantAgent, UserProxyAgent, LLMConfig, register_function
 
-    llm = LLMConfig({"model": "gpt-4o-mini", "api_key": "test"})
+    llm = LLMConfig({"api_type": "mistral", "model": "mistral-small-latest", "api_key": "test"})
     researcher = AssistantAgent(name="r", system_message="test", llm_config=llm)
     executor = UserProxyAgent(name="e", human_input_mode="NEVER", code_execution_config=False)
     for fn in (web_search, fetch_page_content):
```

---

### Incident Patch 9: `196c7d90` (2026-06-19)
**Commit Message**: audit: fix eagle_eye - add Prerequisites section with credential links, add Demo section, add back-to-top link

**File**: `ai_agents/eagle_eye/README.md` (modified, +20/-0)
```diff
@@ -1,9 +1,25 @@
+<a id="top"></a>
+
 # 🦅 Eagle Eye
 
 AI-powered GitHub PR review agent using [OpenClaw](https://openclaw.dev), MiniMax M2.7, and GitHub MCP. Triggered via Telegram.
 
 ---
 
+## ✅ Prerequisites
+
+- [OpenClaw](https://openclaw.dev) installed
+- A Telegram bot, created via [@BotFather](https://t.me/BotFather)
+- A GitHub Personal Access Token with repo and pull request scopes, created at [GitHub's token settings page](https://github.com/settings/tokens)
+
+---
+
+## 📸 Demo
+
+![Eagle Eye demo](assets/demo.png)
+
+---
+
 ## 📽️ Project Overview
 
 **Eagle Eye** is a Telegram-triggered code review assistant that analyzes GitHub pull requests and delivers structured feedback directly to your chat. 
@@ -97,3 +113,7 @@ The agent will respond with the review and a prompt:
 - **Scope**: Does not see CI/CD logs or test results unless pasted into the chat.
 - **Large PRs**: For very large changes, the agent prioritizes security and correctness.
 - **Stateless**: Each Telegram session starts fresh; previous review context is not retained unless manually provided.
+
+---
+
+[Back to top](#top)
```

---

### Incident Patch 10: `2a68537c` (2026-06-19)
**Commit Message**: audit: fix daily-news-digest - add env comments, rewrite em dashes throughout README and skill.py, add architecture diagram reference

**File**: `ai_agents/daily-news-digest/.env.example` (modified, +7/-0)
```diff
@@ -1,3 +1,10 @@
+# MiniMax API key used to score and rank articles by significance.
+# Get one at https://platform.minimax.io
 MINIMAX_API_KEY=your_minimax_api_key_here
+
+# Telegram bot token used to send the daily digest message.
+# Create a bot and get a token from @BotFather on Telegram: https://t.me/BotFather
 TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
+
+# ID of the Telegram chat or channel the digest should be delivered to.
 TELEGRAM_CHAT_ID=your_telegram_chat_id_here
```

**File**: `ai_agents/daily-news-digest/README.md` (modified, +24/-16)
```diff
@@ -2,6 +2,14 @@
 
 Automated daily digest from 92 Karpathy-curated tech blogs, delivered to Telegram at 8 AM every morning. MiniMax M2.7 scores every article fetched in the last 24 hours and picks the 3 most significant stories.
 
+## Architecture
+
+![Architecture diagram](docs/architecture.svg)
+
+## Demo
+
+![Daily AI Digest demo](assets/demo.png)
+
 ## How it works
 
 ```text
@@ -10,7 +18,7 @@ Automated daily digest from 92 Karpathy-curated tech blogs, delivered to Telegra
 
 1. `scripts/fetch_rss.py` fetches all feeds in parallel and keeps only articles published in the last 24 hours
 2. `skill.py` sends the article list to MiniMax M2.7, which scores each one and returns the top 3 as structured JSON
-3. Articles are grouped into categories — **Breaking**, **Important**, or **Notable** — and formatted as a Telegram message
+3. Articles are grouped into categories (**Breaking**, **Important**, or **Notable**) and formatted as a Telegram message
 4. Empty categories are omitted automatically
 
 
@@ -23,13 +31,13 @@ Automated daily digest from 92 Karpathy-curated tech blogs, delivered to Telegra
 
 ## Tech Stack
 **Models & Frameworks:**
-- MiniMax M2.7 — article scoring and ranking
-- OpenClaw — skill orchestration and cron scheduling
+- MiniMax M2.7: article scoring and ranking
+- OpenClaw: skill orchestration and cron scheduling
 
 **Libraries:**
-- `feedparser` — RSS feed parsing
-- `python-dotenv` — environment variable management
-- `requests` — HTTP requests for RSS feed fetching
+- `feedparser`: RSS feed parsing
+- `python-dotenv`: environment variable management
+- `requests`: HTTP requests for RSS feed fetching
 
 
 ## Prerequisites
@@ -101,7 +109,7 @@ cp -r . ~/.openclaw/skills/daily-ai-news-digest
 openclaw cron add "0 8 * * *" skill.py
 ```
 
-This schedules the digest to run every day at **08:00 UTC**. Adjust the cron expression to change the time — for example `"0 7 * * 1-5"` for weekdays at 07:00 UTC.
+This schedules the digest to run every day at **08:00 UTC**. Adjust the cron expression to change the time. For example, `"0 7 * * 1-5"` schedules it for weekdays at 07:00 UTC.
 
 ## Running manually
 
@@ -112,26 +120,26 @@ python skill.py
 ## Output format
 
 ```text
-🗞️ Daily AI Digest — April 1, 2026
+🗞️ Daily AI Digest: April 1, 2026
 
 🔴 BREAKING
-🔴 Article Title — Summary sentence one. Sentence two.
+🔴 Article Title: Summary sentence one. Sentence two.
 Source: Blog Name | [Read more](https://...)
 
 🟡 IMPORTANT
-🟡 Article Title — Summary sentence one. Sentence two.
+🟡 Article Title: Summary sentence one. Sentence two.
 Source: Blog Name | [Read more](https://...)
 
 🔵 NOTABLE
-🔵 Article Title — Summary sentence one. Sentence two.
+🔵 Article Title: Summary sentence one. Sentence two.
 Source: Blog Name | [Read more](https://...)
 ```
 
 ## Project structure
 
 ```text
 daily-ai-news-digest/
-├── skill.py              # Main pipeline — fetch, score, format, send
+├── skill.py              # Main pipeline: fetch, score, format, send
 ├── scripts/
 │   └── fetch_rss.py      # Parallel RSS fetcher with 24h date filter
 ├── sources.json          # 92 Karpathy-curated RSS feed sources
@@ -143,10 +151,10 @@ daily-ai-news-digest/
 
 ## Customisation
 
-**Change the number of top articles** — edit the system prompt in `skill.py` and update the instruction from "top 3" to your preferred number.
+**Change the number of top articles**: edit the system prompt in `skill.py` and update the instruction from "top 3" to your preferred number.
 
-**Change the lookback window** — the `--hours` argument in `fetch_articles()` defaults to 24. Pass a different value to cast a wider or narrower net.
+**Change the lookback window**: the `--hours` argument in `fetch_articles()` defaults to 24. Pass a different value to cast a wider or narrower net.
 
-**Add or remove sources** — edit `sources.json`. Each entry needs a `name`, `xmlUrl` (the feed URL), and `htmlUrl` (the site URL).
+**Add or remove sources**: edit `sources.json`. Each entry needs a `name`, `xmlUrl` (the feed URL), and `htmlUrl` (the site URL).
 
-**Change the schedule** — update the cron expression in the `trigger` field of `SKILL.md` and re-register with `openclaw cron add`.
+**Change the schedule**: update the cron expression in the `trigger` field of `SKILL.md` and re-register with `openclaw cron add`.
```

**File**: `ai_agents/daily-news-digest/skill.py` (modified, +2/-2)
```diff
@@ -175,7 +175,7 @@ def escape_md(text: str) -> str:
     cat = article.get("category", "Notable")
     grouped.setdefault(cat, []).append(article)
 
-message_parts = [f"🗞️ *Daily AI Digest — {today}*"]
+message_parts = [f"🗞️ *Daily AI Digest: {today}*"]
 
 for cat in CATEGORY_ORDER:
     if cat not in grouped:
@@ -189,7 +189,7 @@ def escape_md(text: str) -> str:
         source = art["source"]
         url = art["url"]
         message_parts.append(
-            f"{emoji} *{title}* — {summary}\n"
+            f"{emoji} *{title}*: {summary}\n"
             f"Source: {source} | [Read more]({url})"
         )
 
```

---

### Incident Patch 11: `7fa8d17b` (2026-06-19)
**Commit Message**: audit: fix finagent - swap Gemini for Mistral Small 4, fix load_dotenv bug, add docstrings, fix broken README example

**File**: `ai_agents/finagent/.env.example` (modified, +7/-1)
```diff
@@ -1 +1,7 @@
-OPENAI_API_KEY=your_openai_api_key_here
+# Mistral API key for the Mistral Small 4 (mistral-small-latest) model used by the financial analysis agents.
+# Get one at https://console.mistral.ai/api-keys
+MISTRAL_API_KEY=your_mistral_api_key_here
+
+# Optional: Firecrawl API key used for enhanced news scraping features.
+# Get one at https://firecrawl.dev
+FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

**File**: `ai_agents/finagent/README.md` (modified, +16/-17)
```diff
@@ -1,6 +1,10 @@
 # Finagent - AI-Powered Financial Analysis Tool
 
-A sophisticated financial analysis system that leverages Google's Gemini AI and real-time market data to provide comprehensive stock analysis, automated code generation, and investment insights.
+A sophisticated financial analysis system that leverages Mistral Small 4 (mistral-small-latest) and real-time market data to provide comprehensive stock analysis, automated code generation, and investment insights.
+
+## Demo
+
+![Finagent demo](assets/demo.gif)
 
 ## Features
 
@@ -9,13 +13,12 @@ A sophisticated financial analysis system that leverages Google's Gemini AI and
 - **Automated Code Generation**: Creates executable Python code for financial analysis
 - **News Integration**: Incorporates latest market news into analysis
 - **MCP Server**: Modern Model Context Protocol server for Claude Desktop integration
-- **Professional Visualizations**: Generates matplotlib charts and technical analysis plots
 - **Risk Assessment**: Provides balanced investment recommendations with proper disclaimers
 
 ## Prerequisites
 
 - Python 3.8+
-- Google Gemini API key
+- Mistral API key (for the Mistral Small 4 / mistral-small-latest model)
 - Claude Desktop (for MCP integration)
 - Firecrawl API key (optional, for enhanced news features)
 
@@ -44,22 +47,22 @@ cd finagent
 2. **Install required packages**:
 
 ```bash
-pip install google-generativeai yfinance pandas matplotlib numpy mcp python-dotenv
+pip install -r requirements.txt
 ```
 
 3. **Set up environment variables**:
    Create a `.env` file in the project root:
 
 ```env
-GEMINI_API_KEY=your_gemini_api_key_here
+MISTRAL_API_KEY=your_mistral_api_key_here
 FIRECRAWL_API_KEY=your_firecrawl_api_key_here  # Optional
 ```
 
 ## API Keys Setup
 
-### Gemini API Key (Required)
+### Mistral API Key (Required)
 
-1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
+1. Visit [Mistral Console](https://console.mistral.ai/api-keys)
 2. Create a new API key
 3. Add it to your `.env` file
 
@@ -96,7 +99,7 @@ FIRECRAWL_API_KEY=your_firecrawl_api_key_here  # Optional
          "command": "python",
          "args": ["/absolute/path/to/finagent/main.py"],
          "env": {
-           "GEMINI_API_KEY": "your_gemini_api_key_here",
+           "MISTRAL_API_KEY": "your_mistral_api_key_here",
            "FIRECRAWL_API_KEY": "your_firecrawl_api_key_here"
          }
        }
@@ -167,15 +170,12 @@ python main.py
 from financial_agents import FinancialAnalysisTeam
 
 team = FinancialAnalysisTeam(
-    gemini_api_key="your_gemini_key",
-    firecrawl_api_key="your_firecrawl_key"
+    mistral_api_key="your_mistral_key"
 )
 
 result = team.analyze("Analyze Apple stock over the last 6 months")
 
-print(f"Insights: {result.insights}")
-print(f"Recommendations: {result.recommendations}")
-print(f"Generated Code:\n{result.code}")
+print(result)
 ```
 
 ## Example Queries
@@ -193,7 +193,7 @@ The system understands natural language queries:
 ### Core Components
 
 1. **FinancialAnalysisTeam**: Main orchestrator class
-2. **GeminiAgent**: Base agent class using Gemini AI
+2. **MistralAgent**: Base agent class using Mistral Small 4 (mistral-small-latest)
 3. **FinancialTools**: Data acquisition utilities
 4. **MCP Server**: Model Context Protocol server for Claude Desktop
 
@@ -208,7 +208,6 @@ The system understands natural language queries:
 - **Technical Indicators**: RSI, MACD, Moving averages, Bollinger bands
 - **Price Analysis**: Trend analysis, support/resistance levels
 - **Risk Metrics**: Volatility calculations, drawdown analysis
-- **Visualizations**: Professional charts with technical overlays
 - **News Integration**: Latest market sentiment and news impact
 - **Investment Recommendations**: Buy/Hold/Sell with rationale
 
@@ -233,7 +232,7 @@ The system understands natural language queries:
 2. **Import Errors**:
 
 ```bash
-pip install google-generativeai yfinance pandas mcp python-dotenv
+pip install -r requirements.txt
 ```
 
 3. **API Key Issues**:
@@ -291,4 +290,4 @@ For questions and support:
 
 ---
 
-**Made with Google Gemini AI & Claude Desktop**
+**Made with Mistral Small 4 & Claude Desktop**
```

**File**: `ai_agents/finagent/financial_agents.py` (modified, +62/-17)
```diff
@@ -1,10 +1,16 @@
+"""Multi-agent financial analysis pipeline built on Mistral Small 4 and Yahoo Finance market data."""
+
 import os
 import re
 import json
 import yfinance as yf
-import google.generativeai as genai
+from dotenv import load_dotenv
+from mistralai.client import Mistral
+
+load_dotenv()
 
 def _normalize_period(period: str) -> str:
+    """Normalizes a user-supplied time period string into a yfinance-compatible period code."""
     if not period:
         return '6mo'
     p = str(period).strip().lower()
@@ -17,45 +23,78 @@ def _normalize_period(period: str) -> str:
     return p
 
 
-class GeminiAgent:
+def _summarize_stock_data(stock_data) -> str:
+    """Builds a compact text summary of real OHLCV price data to ground the analysis prompt."""
+    first = stock_data.iloc[0]
+    latest = stock_data.iloc[-1]
+    start_price = float(first['Close'])
+    end_price = float(latest['Close'])
+    pct_change = ((end_price - start_price) / start_price) * 100 if start_price else 0.0
+    period_high = float(stock_data['High'].max())
+    period_low = float(stock_data['Low'].min())
+    first_date = stock_data.index[0].strftime('%Y-%m-%d')
+    latest_date = stock_data.index[-1].strftime('%Y-%m-%d')
+
+    return (
+        f"Data range: {first_date} to {latest_date}\n"
+        f"Starting close: {start_price:.2f}\n"
+        f"Latest close: {end_price:.2f}\n"
+        f"Change over period: {pct_change:.2f}%\n"
+        f"Period high: {period_high:.2f}\n"
+        f"Period low: {period_low:.2f}\n"
+        f"Latest volume: {int(latest['Volume'])}"
+    )
+
+
+class MistralAgent:
+    """Wraps a single Mistral Small 4 chat role with its own system prompt."""
+
     def __init__(self, api_key: str, role: str, system_prompt: str):
-        genai.configure(api_key=api_key)
-        self.model = genai.GenerativeModel('gemini-2.5-flash')
+        self.client = Mistral(api_key=api_key)
+        self.model = 'mistral-small-latest'
         self.role = role
         self.system_prompt = system_prompt
 
     def generate(self, prompt: str) -> str:
         full_prompt = f"{self.system_prompt}\n\nUser Request: {prompt}"
-        response = self.model.generate_content(full_prompt)
-        return response.text
+        response = self.client.chat.complete(
+            model=self.model,
+            messages=[{"role": "user", "content": full_prompt}],
+        )
+        return response.choices[0].message.content
 
 
 class FinancialTools:
+    """Provides access to the market data needed by the analysis agents."""
+
     def get_stock_data(self, symbol: str, period: str = "6mo"):
         ticker = yf.Ticker(symbol)
         return ticker.history(period=period)
 
 
 class FinancialAnalysisTeam:
-    def __init__(self, gemini_api_key: str):
+    """Coordinates the query parser and market analyst agents to produce a stock analysis."""
+
+    def __init__(self, mistral_api_key: str):
         self.tools = FinancialTools()
-        self.query_parser = GeminiAgent(
-            gemini_api_key,
+        self.query_parser = MistralAgent(
+            mistral_api_key,
             "Query Parser",
             """You are a financial query parser. Extract from the user query:
 - Stock symbol (ticker)
 - Analysis type (technical, fundamental, comprehensive)
 - Time period (like 1d, 1mo, 6mo, 1y)
 Return a JSON object with keys: symbol, analysis_type, time_period."""
         )
-        self.market_analyst = GeminiAgent(
-            gemini_api_key,
+        self.market_analyst = MistralAgent(
+            mistral_api_key,
             "Market Analyst",
             """You are a senior financial analyst. Provide a clear, professional, and actionable analysis for the stock.
 Include market trends, price action, risk assessment and investment recommendations."""
         )
 
     def parse_query(self, query: str):
+        """Parses a natural language query into a symbol, analysis type, and time period."""
         response = self.query_parser.generate(query)
         try:
             json_match = re.search(r"\{.*\}", response, re.DOTALL)
@@ -74,14 +113,19 @@ def parse_query(self, query: str):
         return data
 
     def analyze_market(self, query_info, stock_data) -> str:
+        """Asks the market analyst agent for a written analysis grounded in the fetched stock data."""
+        data_summary = _summarize_stock_data(stock_data)
         prompt = (
             f"Analyze the stock symbol {query_info['symbol']} for the period "
-            f"{query_info.get('time_period', '6mo')}. Use recent price data and technical indicators "
-            f"to provide market trends, risk factors, and recommendations."
+            f"{query_info.get('time_period', '6mo')} using the following real market data:\n\n"
+            f"{data_summary}\n\n"
+            f"Base your trends, risk factors, and recommendations only on this data. "
+            f"Do not assume any other price information."
         )
         return self.marke
```

**File**: `ai_agents/finagent/main.py` (modified, +4/-0)
```diff
@@ -1,6 +1,10 @@
+"""MCP server exposing the financial stock analysis tools backed by Mistral Small 4."""
+
+from dotenv import load_dotenv
 from mcp.server.fastmcp import FastMCP
 from financial_agents import run_financial_analysis
 
+load_dotenv()
 
 # Create FastMCP instance
 mcp = FastMCP("financial-analyst")
```

**File**: `ai_agents/finagent/requirements.txt` (modified, +1/-4)
```diff
@@ -1,7 +1,4 @@
-google-generativeai>=0.3.0
+mistralai>=1.0.0
 mcp>=0.1.0
 yfinance>=0.2.18
-pandas>=1.5.0
-numpy>=1.21.0
-matplotlib>=3.5.0
 python-dotenv>=0.19.0
\ No newline at end of file
```

---

### Incident Patch 12: `47e6aaa8` (2026-06-19)
**Commit Message**: audit: fix ai_travel_planning_agent - add env comments, rewrite em dashes, add docstring, fix retry/cleanup bug, switch to GA model, add demo

**File**: `ai_agents/ai_travel_planning_agent/.env.example` (modified, +5/-0)
```diff
@@ -1,2 +1,7 @@
+# Google AI Studio API key used to authenticate Gemini requests for all agents.
+# Get one at https://aistudio.google.com/app/apikey
 GOOGLE_API_KEY=your_google_api_key_here
+
+# Tavily API key used for real-time web search by the flight, hotel, and itinerary agents.
+# Get one at https://app.tavily.com
 TAVILY_API_KEY=your_tavily_api_key_here
```

**File**: `ai_agents/ai_travel_planning_agent/README.md` (modified, +13/-4)
```diff
@@ -1,25 +1,30 @@
+<a id="top"></a>
 # AI Travel Planning Agent
 
 > Multi-agent travel planner that turns a single natural language request into a complete trip plan with flights, hotels, and a day-by-day itinerary.
 
+## Demo
+
+![Demo](assets/demo.png)
+
 ## Overview
 
-The AI Travel Planning Agent uses a root Google ADK agent to coordinate three specialist sub-agents — Flight Agent, Hotel Agent, and Itinerary Agent. Each sub-agent independently searches the web in real time, and the root agent combines their results into one cohesive travel plan. Users interact through a Streamlit chat interface and can ask follow-up questions within the same conversational session.
+The AI Travel Planning Agent uses a root Google ADK agent to coordinate three specialist sub-agents: a Flight Agent, a Hotel Agent, and an Itinerary Agent. Each sub-agent independently searches the web in real time, and the root agent combines their results into one cohesive travel plan. Users interact through a Streamlit chat interface and can ask follow-up questions within the same conversational session.
 
 ## Features
 
 - Natural language trip planning in a conversational chat UI
 - Parallel specialist agents for flights, hotels, and itineraries
 - Real-time web search via Tavily on every query
 - Nearby place discovery using OpenStreetMap/Nominatim (no extra API key)
-- Multi-turn conversation — ask follow-ups after the initial plan
+- Multi-turn conversation, so you can ask follow-ups after the initial plan
 
 ## Tech Stack
 
 | Layer | Technology |
 |---|---|
 | Agent framework | Google ADK (`google-adk`) |
-| LLM | Gemini 3 Flash (`gemini-3-flash-preview`) |
+| LLM | Gemini 3.5 Flash (`gemini-3.5-flash`) |
 | Web search | Tavily Search API |
 | Location data | geopy + Nominatim (OpenStreetMap) |
 | UI | Streamlit |
@@ -112,5 +117,9 @@ ai-travel-planning-agent/
 ├── tools.py            # Tavily search and Nominatim location tools
 ├── requirements.txt    # Python dependencies
 ├── .env.example        # Environment variable template
-└── .env                # Your local API keys (git-ignored)
+├── .env                # Your local API keys (git-ignored)
+└── assets/
+    └── demo.png         # Demo screenshot
 ```
+
+[Back to top](#top)
```

**File**: `ai_agents/ai_travel_planning_agent/agents.py` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 from google.adk.tools.agent_tool import AgentTool
 from tools import tavily_search, find_nearby_places
 
-MODEL = "gemini-3-flash-preview"
+MODEL = "gemini-3.5-flash"
 
 # ---------------------------------------------------------------------------
 # Specialist sub-agents
```

**File**: `ai_agents/ai_travel_planning_agent/app.py` (modified, +79/-10)
```diff
@@ -1,18 +1,30 @@
+"""Streamlit chat app that coordinates flight, hotel, and itinerary agents into one travel plan."""
 import os
 import asyncio
+import logging
 import uuid
 
 # Load .env before any ADK/Google imports so API keys are available
 from dotenv import load_dotenv
 load_dotenv()
 
+# ADK logs the full traceback for every transient model error (even ones it
+# or our own retry logic recovers from). We surface failures via the UI
+# instead, so quiet this logger to keep the terminal readable.
+logging.getLogger("google_adk").setLevel(logging.CRITICAL)
+
+_TRANSIENT_ERROR_MARKERS = ("503", "UNAVAILABLE", "high demand")
+_QUOTA_ERROR_MARKERS = ("429", "RESOURCE_EXHAUSTED")
+_QUOTA_RETRY_DELAY_SECONDS = 8
+
 import nest_asyncio
 nest_asyncio.apply()  # Allow asyncio.run() inside Streamlit's existing event loop
 
 import streamlit as st
 from google.adk.runners import Runner
 from google.adk.sessions import InMemorySessionService
 from google.genai import types
+from google.genai.errors import ServerError
 
 from agents import root_agent
 
@@ -96,23 +108,76 @@
 # Agent runner helper
 # ---------------------------------------------------------------------------
 
+def _is_transient_error(message: str) -> bool:
+    """Check whether an error message looks like a temporary model-overload error."""
+    return any(marker in message for marker in _TRANSIENT_ERROR_MARKERS)
+
+
+def _is_quota_error(message: str) -> bool:
+    """Check whether an error message looks like a 429 quota/rate-limit error."""
+    return any(marker in message for marker in _QUOTA_ERROR_MARKERS)
+
+
 async def _stream_response(runner: Runner, session_id: str, user_id: str, content: types.Content) -> str:
     """Collect the final response text from a single runner.run_async() call."""
     final_text = ""
-    async for event in runner.run_async(
+    agen = runner.run_async(
         session_id=session_id,
         user_id=user_id,
         new_message=content,
-    ):
-        if event.is_final_response():
-            if event.content and event.content.parts:
-                final_text = "\n".join(
-                    part.text for part in event.content.parts if hasattr(part, "text")
-                )
-            break
+    )
+    try:
+        async for event in agen:
+            # Some failures surface as an error event on the stream rather than
+            # a raised exception, so check for that before looking for the final response.
+            if getattr(event, "error_code", None):
+                raise RuntimeError(event.error_message or event.error_code)
+            if event.is_final_response():
+                if event.content and event.content.parts:
+                    final_text = "\n".join(
+                        part.text for part in event.content.parts if hasattr(part, "text")
+                    )
+                break
+    finally:
+        # Close the generator here, in the same task/context it was opened in,
+        # so a retry doesn't start a new one while this one is still mid-teardown
+        # (that's what was producing the GeneratorExit / OpenTelemetry cleanup errors).
+        await agen.aclose()
     return final_text
 
 
+async def _stream_response_with_retry(
+    runner: Runner,
+    session_id: str,
+    user_id: str,
+    content: types.Content,
+    max_attempts: int = 2,
+) -> str:
+    """Call _stream_response, retrying on transient model errors.
+
+    503/UNAVAILABLE overload errors use the existing short exponential backoff.
+    429/RESOURCE_EXHAUSTED quota errors get exactly one retry after a longer delay,
+    since retrying quota errors quickly just makes the exhaustion worse.
+    """
+    quota_retried = False
+    for attempt in range(1, max_attempts + 1):
+        try:
+            return await _stream_response(runner, session_id, user_id, content)
+        except (ServerError, RuntimeError) as e:
+            message = str(e)
+            if _is_quota_error(message):
+                if attempt == max_attempts or quota_retried:
+                    raise
+                quota_retried = True
+                await asyncio.sleep(_QUOTA_RETRY_DELAY_SECONDS)
+            elif _is_transient_error(message):
+                if attempt == max_attempts:
+                    raise
+                await asyncio.sleep(2 ** attempt)
+            else:
+                raise
+
+
 async def _run_agent_async(runner: Runner, session_id: str, user_id: str, message: str) -> str:
     """Run the ADK agent and collect the final response text."""
     content = types.Content(
@@ -138,7 +203,7 @@ async def _run_agent_async(runner: Runner, session_id: str, user_id: str, messag
         )
 
     try:
-        final_text = await _stream_response(runner, session_id, user_id, content)
+        final_text = await _stream_response_with_retry(runner, session_id, user_id, content)
     except Exception as e:
         if "Session not found" in str(e):
             new_session_id = str(uuid.uuid4(
```

---

### Incident Patch 13: `af176efc` (2026-06-18)
**Commit Message**: audit: fix competitive_intelligence_agent - fix load_dotenv bug, ANSI codes, clean reasoning log, collapse reasoning panel, add demo, fix pyproject description, fix README checkboxes

**File**: `ai_agents/competitive_intelligence_agent/.env.example` (modified, +2/-0)
```diff
@@ -1,2 +1,4 @@
+# Google AI Studio API key used to access Gemma 4 via the Gemini API. Get yours free at https://aistudio.google.com
 GEMINI_API_KEY=your_gemini_api_key_here
+# Tavily Search API key used for real-time web research by the CrewAI agents. Get yours free at https://tavily.com
 TAVILY_API_KEY=tvly-your_tavily_key_here
\ No newline at end of file
```

**File**: `ai_agents/competitive_intelligence_agent/README.md` (modified, +11/-3)
```diff
@@ -1,12 +1,18 @@
 # Competitive Intelligence Agent
 
+> Generate strategic sales battlecards by analyzing competitors through the unique lens of your own business context.
+
 A multi-agent AI system that generates strategic sales battlecards by analyzing competitors through the unique lens of your own business context.
 
+## Demo
+
+![Demo](assets/demo.png)
+
 ## Overview
 
 The **Competitive Intelligence Agent** solves the "generic research" problem by moving away from broad, impersonal reports. Instead of searching the web for everything about a competitor, this system uses specialized AI agents to analyze a competitor specifically in relation to *your* company's value proposition, your customers' specific pain points, and your strategic sales goals.
 
-It uses **CrewAI** to orchestrate specialized agents—a Market Scout, a Product Strategist, and a Battlecard Author—to research, compare, and synthesize actionable sales intelligence.
+It uses **CrewAI** to orchestrate three specialized agents that research, compare, and synthesize actionable sales intelligence: a Market Scout, a Product Strategist, and a Battlecard Author.
 
 This tool is designed for:
 - **Sales Teams:** Who need immediate, punchy arguments to win against specific competitors.
@@ -40,8 +46,8 @@ Before you begin, ensure you have:
 - Python 3.12 or higher
 - [uv](https://github.com/astral-sh/uv) (Recommended for dependency management)
 - API keys for:
-  - [ ] Google AI Studio (for Gemini/Gemma)
-  - [ ] Tavily Search API
+  - [Google AI Studio](https://aistudio.google.com) for Gemini/Gemma (free tier available)
+  - [Tavily Search API](https://tavily.com) (free tier available)
 
 ## Installation
 
@@ -95,6 +101,8 @@ competitive_intelligence_agent/
 ├── .env.example           # Template for API keys
 ├── pyproject.toml         # uv project configuration
 ├── uv.lock                # Locked dependencies for consistency
+├── assets/
+│   └── demo.png           # Demo screenshot
 └── .venv/                 # Virtual environment (auto-generated)
 ```
 
```

**File**: `ai_agents/competitive_intelligence_agent/agents_logic.py` (modified, +5/-0)
```diff
@@ -1,14 +1,19 @@
+"""CrewAI agent and task definitions for the Competitive Intelligence Agent."""
 import os
+from dotenv import load_dotenv
 from crewai import Agent, Task, Crew, Process, LLM
 from crewai_tools import TavilySearchTool
 
+load_dotenv()
+
 # Gemma 4 via LiteLLM/Gemini API
 gemma_llm = LLM(
     model="gemini/gemma-4-26b-a4b-it",
     api_key=os.getenv("GEMINI_API_KEY")
 )
 
 def get_research_crew(my_company, competitor, pain_point, goal):
+    """Build and return a sequential CrewAI crew configured for the given company context and competitor."""
     # Specialized Tools
     search_tool = TavilySearchTool(api_key=os.getenv("TAVILY_API_KEY"), max_results=3)
 
```

**File**: `ai_agents/competitive_intelligence_agent/main.py` (modified, +26/-6)
```diff
@@ -1,25 +1,44 @@
+"""Gradio UI for the Competitive Intelligence Agent, which generates AI-powered sales battlecards using a CrewAI multi-agent pipeline."""
+import re
 import gradio as gr
 import io
 from contextlib import redirect_stdout
 from agents_logic import get_research_crew
 
+
+def strip_ansi(text: str) -> str:
+    """Remove ANSI color and formatting escape sequences from a string."""
+    return re.sub(r'\x1b\[[0-9;]*m', '', text)
+
+
+def clean_log(raw: str) -> str:
+    """Remove blank lines and decorative separator lines from captured CrewAI stdout."""
+    kept = []
+    for line in raw.splitlines():
+        stripped = line.strip()
+        if stripped and re.search(r'[A-Za-z0-9]', stripped):
+            kept.append(stripped)
+    return '\n'.join(kept)
+
+
 def run_analysis(my_company, competitor, pain_point, goal):
+    """Run the three-agent CrewAI pipeline and return the reasoning log and final battlecard."""
     # Progress logging
     f = io.StringIO()
     with redirect_stdout(f):
         try:
             crew = get_research_crew(my_company, competitor, pain_point, goal)
             result = crew.kickoff(inputs={
-                "my_company": my_company, 
-                "competitor": competitor, 
-                "pain_point": pain_point, 
+                "my_company": my_company,
+                "competitor": competitor,
+                "pain_point": pain_point,
                 "goal": goal
             })
             final_output = result.raw
         except Exception as e:
             final_output = f"Error: {str(e)}"
-            
-    return f.getvalue(), final_output
+
+    return clean_log(strip_ansi(f.getvalue())), final_output
 
 with gr.Blocks(title="Strategic Intel System") as demo:
     gr.Markdown("# ⚔️ Competitive Intelligence Engine")
@@ -34,7 +53,8 @@ def run_analysis(my_company, competitor, pain_point, goal):
             submit_btn = gr.Button("Generate Battlecard", variant="primary")
             
         with gr.Column():
-            logs = gr.Textbox(label="Agent Reasoning Process", lines=10)
+            with gr.Accordion("Agent Reasoning Process", open=False):
+                logs = gr.Textbox(label="Agent Reasoning Process", lines=10)
             output = gr.Markdown(label="Final Battlecard")
 
     submit_btn.click(
```

**File**: `ai_agents/competitive_intelligence_agent/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "competitive-intelligence-agent"
 version = "0.1.0"
-description = "Add your description here"
+description = "Multi-agent CrewAI system that generates strategic sales battlecards by analyzing competitors against your own business context"
 readme = "README.md"
 requires-python = ">=3.12"
 dependencies = [
```

---

### Incident Patch 14: `fc97f44e` (2026-06-18)
**Commit Message**: audit: fix clinical_rag_with_ade - add env comments, add tagline, add docstrings, replace print with logging

**File**: `rag_apps/clinical_rag_with_ade/.env.example` (modified, +5/-0)
```diff
@@ -1,2 +1,7 @@
+# LandingAI API key used for Agentic Document Extraction (ADE) parsing.
+# Get one at https://va.landing.ai/my/settings/api-key
 VISION_AGENT_API_KEY=your_landingai_key_here
+
+# Mistral AI API key used for embeddings (mistral-embed) and reasoning (mistral-large-latest).
+# Get one at https://console.mistral.ai/
 MISTRAL_API_KEY=your_mistral_key_here
\ No newline at end of file
```

**File**: `rag_apps/clinical_rag_with_ade/README.md` (modified, +3/-0)
```diff
@@ -1,4 +1,7 @@
 # 🏥 Clinical RAG with ADE
+
+> Query dense clinical PDFs and get answers grounded in the document's exact visual layout.
+
 ![Clinical RAG Architecture](assets/clinical_rag.png)
 
 ## Overview
```

**File**: `rag_apps/clinical_rag_with_ade/app.py` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+"""Streamlit dashboard for uploading clinical PDFs and querying them with visually grounded RAG."""
 import streamlit as st
 import os
 from processor import ClinicalRAGProcessor
```

**File**: `rag_apps/clinical_rag_with_ade/main.py` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
+"""Placeholder entry point generated by the uv project scaffold; the app runs via app.py."""
+
+
 def main():
     print("Hello from clinical-rag-with-ade!")
 
```

**File**: `rag_apps/clinical_rag_with_ade/processor.py` (modified, +5/-2)
```diff
@@ -1,3 +1,4 @@
+import logging
 import os
 import shutil
 from pathlib import Path
@@ -14,6 +15,8 @@
 
 load_dotenv()
 
+logger = logging.getLogger(__name__)
+
 class ClinicalRAGProcessor:
     def __init__(self, db_path="./chroma_db"):
         """
@@ -33,7 +36,7 @@ def ingest_document(self, file_path: str) -> int:
         Parses a PDF using ADE and indexes structured chunks into ChromaDB.
         Returns the number of chunks indexed.
         """
-        print(f"--- ADE Parsing Started: {file_path} ---")
+        logger.info("ADE parsing started: %s", file_path)
         
         # ADE expects a pathlib.Path object for local file parsing
         response = self.ade_client.parse(
@@ -120,4 +123,4 @@ def clear_database(self):
         if os.path.exists(self.db_path):
             shutil.rmtree(self.db_path)
         self.vector_store = None
-        print(f"Database at {self.db_path} has been wiped.")
\ No newline at end of file
+        logger.info("Database at %s has been wiped.", self.db_path)
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #135** (2026-10-01): update data analyst demo showing Jev review layer (@cyberholics)
- **PR #134** (2026-10-01): feat: add Jev review gates to natural language data analyst (@Tiioluwani)
- **PR #133** (2026-09-29): Update README.md (@Tiioluwani)
- **PR #132** (2026-09-24): Build local Ollama-powered data analyst with Gradio (@cyberholics)
- **PR #131** (2026-09-24): feat: add Offline Troubleshooting Agent - local AI agent for industrial equipment diagnosis with zero internet dependency (@Tiioluwani)
- **PR #130** (2026-09-19): feat(audio): switch voice agent and follow-up to GLM-5.3-Flash on Tel… (@cyberholics)
- **PR #129** (2026-09-18): feat(audio): add AI appointment booking voice agent (Telnyx Voice AI) (@cyberholics)
- **PR #128** (2026-09-18): feat: add Voice GitHub Agent - voice-controlled agent for GitHub repo triage (@Tiioluwani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
