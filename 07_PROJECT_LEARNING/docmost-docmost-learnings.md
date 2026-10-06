# Forensic Learning Record (Deep Inspection): docmost/docmost

> **Canonical Artifact**: `07_PROJECT_LEARNING/docmost-docmost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/docmost/docmost](https://github.com/docmost/docmost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:57:26.625Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `docmost/docmost`
- **Description**: Docmost is an open-source collaborative wiki and documentation software. It is an open-source alternative to Confluence and Notion.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 21876 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/client/src/components/layouts/global/hooks/atoms/sidebar-atom.ts`
```
import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { atom } from "jotai";

export const mobileSidebarAtom = atom<boolean>(false);

export const desktopSidebarAtom = atomWithWebStorage<boolean>(
  "showSidebar",
  true,
);

export const desktopAsideAtom = atom<boolean>(false);

// Valid `tab` values: "" | "comments" | "toc" | "chat" | "details"
type AsideStateType = {
  tab: string;
  isAsideOpen: boolean;
};

export const asideStateAtom = atom<AsideStateType>({
  tab: "",
  isAsideOpen: false,
});

export const sidebarWidthAtom = atomWithWebStorage<number>('sidebarWidth', 300);
```

### Core Architecture Module: `apps/client/src/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts`
```
import { useAtom } from "jotai";

export function useToggleSidebar(sidebarAtom: any) {
  const [sidebarState, setSidebarState] = useAtom(sidebarAtom);
  return () => {
    setSidebarState(!sidebarState);
  }
}

```

### Core Architecture Module: `apps/client/src/components/ui/empty-state.tsx`
```
import { Stack, Text } from "@mantine/core";
import { type TablerIcon } from "@tabler/icons-react";
import { ReactNode } from "react";
import classes from "./empty-state.module.css";

type EmptyStateProps = {
  icon: TablerIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={classes.root}>
      <Stack align="center" gap="xs">
        <Icon size={40} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text size="lg" fw={500}>
          {title}
        </Text>
        {description && (
          <Text size="sm" c="dimmed" maw={350}>
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </div>
  );
}

```

### Core Architecture Module: `apps/client/src/ee/ai-chat/components/chat-empty-state.tsx`
```
import {
  IconSparkles,
  IconSearch,
  IconFilePlus,
  IconEdit,
  IconFileText,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useRef } from "react";
import ChatInput, { ChatInputHandle } from "./chat-input";
import type { ChatAttachment, PageMention } from "../types/ai-chat.types";
import classes from "../styles/ai-chat.module.css";

type Suggestion = {
  icon: React.ReactNode;
  text: string;
  prompt: string;
  write?: boolean;
};

const SUGGESTIONS: Suggestion[] = [
  {
    icon: <IconSearch size={16} />,
    text: "Search across all pages",
    prompt: "Search for pages about ",
  },
  {
    icon: <IconFilePlus size={16} />,
    text: "Create a new page",
    prompt: "Create a new page titled ",
    write: true,
  },
  {
    icon: <IconFileText size={16} />,
    text: "Summarize a page",
    prompt: "Summarize the page @",
  },
  {
    icon: <IconEdit size={16} />,
    text: "Update page content",
    prompt: "Update the page @",
    write: true,
  },
];

type Props = {
  isStreaming: boolean;
  onSend: (content: string, mentions: PageMention[], attachments: ChatAttachment[]) => void;
  onStop: () => void;
};

export default function ChatEmptyState({ isStreaming, onSend, onStop }: Props) {
  const { t } = useTranslation();
  const workspace = useAtomValue(workspaceAtom);
  const writesDisabled = workspace?.settings?.ai?.chatReadOnly === true;

  const inputRef = useRef<ChatInputHandle>(null);

  const handleSuggestionClick = (prompt: string) => {
    inputRef.current?.prefill(prompt);
  };

  return (
    <div className={classes.emptyState}>
      <IconSparkles size={48} stroke={1.5} className={classes.emptyStateIcon} />
      <div className={classes.emptyStateBrand}>{t("Docmost AI")}</div>
      <h1 className={classes.emptyStateTitle}>
        {t("What can I help you with?")}
      </h1>

      <div className={classes.emptyStateInput}>
        <ChatInput
          ref={inputRef}
          isStreaming={isStreaming}
          onSend={onSend}
          onStop={onStop}
          placeholder={t("Ask anything... Use @ to mention pages")}
          autofocus
        />
      </div>

      <div className={classes.suggestionsSection}>
        <h2 className={classes.suggestionsLabel}>{t("Get started")}</h2>
        <div className={classes.suggestionsGrid}>
          {SUGGESTIONS.filter((s) => !writesDisabled || !s.write).map((s) => (
            <button
              key={s.text}
              type="button"
              className={classes.suggestionCard}
              onClick={() => handleSuggestionClick(s.prompt)}
            >
              <span className={classes.suggestionIcon}>{s.icon}</span>
              <span className={classes.suggestionText}>{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

```

### Core Architecture Module: `apps/client/src/ee/ai-chat/hooks/use-chat-stream.ts`
```
import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sendChatMessage } from "../services/ai-chat-service";
import type {
  AiChatMessage,
  AiChatStreamEvent,
  AiChatToolCall,
  ChatAttachment,
  PageMention,
} from "../types/ai-chat.types";

type ChatStreamOptions = {
  onChatCreated?: (chatId: string) => void;
};

export function useChatStream(
  chatId: string | undefined,
  options?: ChatStreamOptions,
) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<AiChatToolCall[]>(
    [],
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isRetryable, setIsRetryable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentChatIdRef = useRef(chatId);
  currentChatIdRef.current = chatId;
  // Tracks which chatId the local `messages` state currently represents.
  // Set when we seed from a server fetch AND when we optimistically own a
  // freshly-created chat after `chat_created`. This is the single authority
  // marker that keeps server-state effects from clobbering in-flight streams.
  const hydratedChatIdRef = useRef<string | undefined>(undefined);

  // Reset local state when the consumer switches to a different chat.
  // Skip the reset if the new chatId is one the hook itself already claimed
  // during a new-chat flow — in that case our optimistic state is the truth.
  useEffect(() => {
    if (chatId && chatId === hydratedChatIdRef.current) return;
    hydratedChatIdRef.current = undefined;
    setMessages([]);
    setError(null);
    setErrorCode(null);
    setIsRetryable(false);
  }, [chatId]);

  const hydrateFromServer = useCallback((msgs: AiChatMessage[]) => {
    const forId = currentChatIdRef.current;
    if (!forId) return;
    if (hydratedChatIdRef.current === forId) return;
    hydratedChatIdRef.current = forId;
    setMessages(msgs);
  }, []);

  const sendMessage = useCallback(
    (content: string, mentions: PageMention[] = [], attachments: ChatAttachment[] = [], contextPageId?: string) => {
      if (isStreaming || (!content.trim() && attachments.length === 0)) return;

      setError(null);
      setErrorCode(null);
      setIsRetryable(false);
      setIsStreaming(true);
      setStreamingContent("");
      setStreamingToolCalls([]);

      const metadata: Record<string, unknown> = {};
      if (mentions.length) {
        metadata.mentionedPageIds = mentions.map((m) => m.id);
      }
      if (attachments.length) {
        metadata.attachments = attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileExt: a.fileExt,
        }));
      }

      const userMessage: AiChatMessage = {
        id: `temp-${Date.now()}`,
        chatId: currentChatIdRef.current || "",
        role: "user",
        content,
        toolCalls: null,
        metadata: Object.keys(metadata).length ? metadata : null,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      const attachmentIds = attachments.map((a) => a.id);

      const abortController = sendChatMessage(
        {
          chatId: currentChatIdRef.current,
          content,
          mentionedPageIds: mentions.map((m) => m.id),
          ...(contextPageId && { contextPageId }),
          ...(attachmentIds.length && { attachmentIds }),
        },
        (event: AiChatStreamEvent) => {
          switch (event.type) {
            case "chat_created":
              currentChatIdRef.current = event.chatId;
              // Claim authority over this new chatId so when the consumer's
              // prop catches up via navigation/onChatCreated, the reset effect
              // sees a match and preserves our optimistic messages.
              hydratedChatIdRef.current = event.chatId;
              if (options?.onChatCreated) {
                options.onChatCreated(event.chatId);
              } else {
                navigate(`/ai/chat/${event.chatId}`, { replace: true });
              }
              queryClient.invalidateQueries({ queryKey: ["ai-chats"] });
              break;
            case "content":
              setStreamingContent((prev) => prev + event.text);
              break;
            case "tool_call":
              setStreamingToolCalls((prev) => [
                ...prev,
                {
                  id: event.id,
                  name: event.name,
                  args: event.args,
                },
              ]);
              break;
            case "tool_result":
              setStreamingToolCalls((prev) =>
                prev.map((tc) =>
                  tc.id === event.id ? { ...tc, result: event.result } : tc,
                ),
              );
              break;
            case "done": {
              setStreamingContent((currentContent) => {
                setStreamingToolCalls((currentToolCalls) => {
                  const assistantMessage: AiChatMessage = {
                    id: event.messageId,
                    chatId: currentChatIdRef.current || "",
                    role: "assistant",
                    content: currentContent || null,
                    toolCalls: currentToolCalls.length
                      ? currentToolCalls
                      : null,
                    metadata: event.usage ? { tokenUsage: event.usage } : null,
                    createdAt: new Date().toISOString(),
                  };

                  setMessages((prev) => [...prev, assistantMessage]);
                  return [];
                });
                return "";
              });
              setIsStreaming(false);
              queryClient.invalidateQueries({
                queryKey: ["ai-chat", currentChatIdRef.current],
              });
              break;
            }
            case "error":
              setError(event.message);
              setErrorCode(event.code || null);
              setIsRetryable(event.retryable || false);
              setIsStreaming(false);
              break;
          }
        },
        (errorMsg) => {
          setError(errorMsg);
          setIsStreaming(false);
        },
        () => {
          setIsStreaming(false);
        },
      );

      abortRef.current = abortController;
    },
    [isStreaming, navigate, queryClient],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    setStreamingContent((currentContent) => {
      setStreamingToolCalls((currentToolCalls) => {
        if (currentContent || currentToolCalls.length > 0) {
          const partialMessage: AiChatMessage = {
            id: `stopped-${Date.now()}`,
            chatId: currentChatIdRef.current || "",
            role: "assistant",
            content: currentContent || null,
            toolCalls: currentToolCalls.length ? currentToolCalls : null,
            metadata: null,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, partialMessage]);
        }
        return [];
      });
      return "";
    });

    setIsStreaming(false);
  }, []);

  return {
    messages,
    streamingContent,
    streamingToolCalls,
    isStreaming,
    error,
    errorCode,
    isRetryable,
    sendMessage,
    stopGeneration,
    hydrateFromServer,
  };
}

```

### Core Architecture Module: `apps/client/src/ee/ai-chat/utils/group-chats-by-age.ts`
```
import type { AiChat } from "../types/ai-chat.types";

export type ChatGroup = { key: string; label: string; chats: AiChat[] };

export function groupChatsByAge(
  chats: AiChat[],
  t: (key: string) => string,
): ChatGroup[] {
  if (chats.length === 0) return [];

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfLast7 = startOfToday - 7 * 24 * 60 * 60 * 1000;
  const startOfLast30 = startOfToday - 30 * 24 * 60 * 60 * 1000;

  const buckets: Record<string, ChatGroup> = {
    today: { key: "today", label: t("Today"), chats: [] },
    yesterday: { key: "yesterday", label: t("Yesterday"), chats: [] },
    last7: { key: "last7", label: t("Previous 7 days"), chats: [] },
    last30: { key: "last30", label: t("Previous 30 days"), chats: [] },
    older: { key: "older", label: t("Older"), chats: [] },
  };

  for (const chat of chats) {
    const ts = new Date(chat.updatedAt).getTime();
    if (ts >= startOfToday) buckets.today.chats.push(chat);
    else if (ts >= startOfYesterday) buckets.yesterday.chats.push(chat);
    else if (ts >= startOfLast7) buckets.last7.chats.push(chat);
    else if (ts >= startOfLast30) buckets.last30.chats.push(chat);
    else buckets.older.chats.push(chat);
  }

  return [
    buckets.today,
    buckets.yesterday,
    buckets.last7,
    buckets.last30,
    buckets.older,
  ].filter((b) => b.chats.length > 0);
}

```

### Core Architecture Module: `apps/client/src/ee/ai/hooks/use-ai-search.ts`
```
import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { aiAnswers, IAiSearchResponse } from "@/ee/ai/services/ai-search-service.ts";
import { IPageSearchParams } from "@/features/search/types/search.types.ts";

// @ts-ignore
interface UseAiSearchResult extends UseMutationResult<IAiSearchResponse, Error, IPageSearchParams> {
  streamingAnswer: string;
  streamingSources: any[];
  clearStreaming: () => void;
}

export function useAiSearch(): UseAiSearchResult {
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [streamingSources, setStreamingSources] = useState<any[]>([]);

  const clearStreaming = useCallback(() => {
    setStreamingAnswer("");
    setStreamingSources([]);
  }, []);

  const mutation = useMutation({
    mutationFn: async (params: IPageSearchParams & { contentType?: string }) => {
      setStreamingAnswer("");
      setStreamingSources([]);

      const { contentType, ...apiParams } = params;

      return await aiAnswers(apiParams, (chunk) => {
        if (chunk.content) {
          setStreamingAnswer((prev) => prev + chunk.content);
        }
        if (chunk.sources) {
          setStreamingSources(chunk.sources);
        }
      });
    },
  });

  return {
    ...mutation,
    streamingAnswer,
    streamingSources,
    clearStreaming,
  };
}

```

### Core Architecture Module: `apps/client/src/ee/ai/hooks/use-ai.ts`
```
import { useState, useCallback, useRef } from "react";
import { useAiGenerateStreamMutation } from "@/ee/ai/queries/ai-query.ts";
import { AiGenerateDto } from "@/ee/ai/types/ai.types.ts";

export function useAiStream() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mutation = useAiGenerateStreamMutation();

  const startStream = useCallback(
    async (data: AiGenerateDto) => {
      setContent("");
      setIsStreaming(true);

      try {
        const controller = await mutation.mutateAsync({
          ...data,
          onChunk: (chunk) => {
            setContent((prev) => prev + chunk.content);
          },
          onError: (error) => {
            console.error("AI stream error:", error);
            setIsStreaming(false);
          },
          onComplete: () => {
            setIsStreaming(false);
          },
        });

        abortControllerRef.current = controller;
      } catch (error) {
        console.error("Failed to start stream:", error);
        setIsStreaming(false);
      }
    },
    [mutation]
  );

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const resetContent = useCallback(() => {
    setContent("");
  }, []);

  return {
    content,
    isStreaming,
    startStream,
    stopStream,
    resetContent,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
```

### Core Architecture Module: `apps/client/src/ee/base/components/kanban/kanban-empty-state.tsx`
```
import { useCallback } from "react";
import { Stack, Text, Select, Button } from "@mantine/core";
import { generateBaseChoiceId } from "@/ee/base/utils/generate-base-id";
import { useTranslation } from "react-i18next";
import { IBase, IBaseView } from "@/ee/base/types/base.types";
import { useUpdateViewMutation } from "@/ee/base/queries/base-view-query";
import { useCreatePropertyMutation } from "@/ee/base/queries/base-property-query";

type KanbanEmptyStateProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
  editable: boolean;
};

export function KanbanEmptyState({ base, view, pageId, editable }: KanbanEmptyStateProps) {
  const { t } = useTranslation();
  const updateView = useUpdateViewMutation();
  const createProperty = useCreatePropertyMutation();

  const groupableProperties = base.properties.filter(
    (p) => p.type === "select" || p.type === "status",
  );

  const selectData = groupableProperties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const handleSelect = useCallback(
    (value: string | null) => {
      if (!value) return;
      updateView.mutate({ viewId: view.id, pageId, config: { groupByPropertyId: value } });
    },
    [updateView, view.id, pageId],
  );

  const handleCreateStatus = useCallback(() => {
    const todoId = generateBaseChoiceId();
    const inProgressId = generateBaseChoiceId();
    const completeId = generateBaseChoiceId();
    createProperty.mutate(
      {
        pageId,
        name: t("Status"),
        type: "status",
        typeOptions: {
          choices: [
            { id: todoId, name: t("Not started"), color: "gray", category: "todo" },
            { id: inProgressId, name: t("In progress"), color: "blue", category: "inProgress" },
            { id: completeId, name: t("Done"), color: "green", category: "complete" },
          ],
          choiceOrder: [todoId, inProgressId, completeId],
        },
      },
      {
        onSuccess: (newProperty) => {
          updateView.mutate({
            viewId: view.id,
            pageId,
            config: { groupByPropertyId: newProperty.id },
          });
        },
      },
    );
  }, [createProperty, updateView, view.id, pageId, t]);

  if (!editable) {
    return (
      <Stack align="center" gap="md" style={{ flex: 1, paddingTop: "15vh" }}>
        <Text fw={500}>{t("This board has no grouping property yet.")}</Text>
      </Stack>
    );
  }

  return (
    <Stack align="center" gap="md" style={{ flex: 1, paddingTop: "15vh" }}>
      <Text fw={500}>{t("Group this board by a select or status property.")}</Text>
      {groupableProperties.length > 0 ? (
        <Select
          placeholder={t("Choose a property")}
          data={selectData}
          value={view.config?.groupByPropertyId ?? null}
          onChange={handleSelect}
          w={240}
        />
      ) : (
        <Button
          variant="light"
          size="sm"
          onClick={handleCreateStatus}
          loading={createProperty.isPending}
        >
          {t("Create a status property")}
        </Button>
      )}
    </Stack>
  );
}

```

### Core Architecture Module: `apps/client/src/ee/base/components/views/view-renderer.tsx`
```
import { Table } from "@tanstack/react-table";
import {
  IBase,
  IBaseRow,
  IBaseView,
  FilterGroup,
} from "@/ee/base/types/base.types";
import { BaseTable } from "@/ee/base/components/base-table";
import { BaseKanban } from "@/ee/base/components/kanban/base-kanban";

type ViewRendererProps = {
  base: IBase;
  rows: IBaseRow[];
  effectiveView: IBaseView | undefined;
  table: Table<IBaseRow>;
  pageId: string;
  embedded?: boolean;
  editable: boolean;
  isFiltered: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  onAddRow: (afterRowId?: string, focusPropertyId?: string) => void;
  onColumnReorder: (columnId: string, finishIndex: number) => void;
  onResizeEnd: () => void;
  onRowReorder: (
    rowId: string,
    targetRowId: string,
    dropPosition: "above" | "below",
  ) => void;
  persistViewConfig: () => void;
  scrollportRef: React.RefObject<HTMLDivElement>;
  aboveBand?: React.ReactNode;
  kanbanFilter?: FilterGroup | undefined;
};

export function ViewRenderer(props: ViewRendererProps) {
  const viewType = props.effectiveView?.type ?? "table";

  if (viewType === "kanban") {
    return (
      <BaseKanban
        base={props.base}
        view={props.effectiveView!}
        pageId={props.pageId}
        embedded={props.embedded}
        editable={props.editable}
        viewFilter={props.kanbanFilter}
      />
    );
  }

  if (viewType === "table") {
    return <BaseTable {...props} />;
  }

  return <BaseTable {...props} />;
}

```

### Core Architecture Module: `apps/client/src/ee/base/hooks/use-base-socket.ts`
```
import { useEffect } from "react";
import { useAtomValue, getDefaultStore } from "jotai";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import {
  IBase,
  IBaseProperty,
  IBaseRow,
  IBaseView,
} from "@/ee/base/types/base.types";
import { selectedRowIdsAtomFamily } from "@/ee/base/atoms/base-atoms";
import { formulaRecomputeAtom } from "@/ee/base/atoms/formula-recompute-atom";
import { IPagination } from "@/lib/types";
import { invalidateBaseRows } from "@/ee/base/queries/base-row-query";

type BaseRowCreated = {
  operation: "base:row:created";
  pageId: string;
  row: IBaseRow;
  requestId?: string | null;
};

type BaseRowUpdated = {
  operation: "base:row:updated";
  pageId: string;
  rowId: string;
  updatedCells: Record<string, unknown>;
  requestId?: string | null;
};

type BaseRowDeleted = {
  operation: "base:row:deleted";
  pageId: string;
  rowId: string;
  requestId?: string | null;
};

type BaseRowsDeleted = {
  operation: "base:rows:deleted";
  pageId: string;
  rowIds: string[];
  requestId?: string | null;
};

type BaseRowReordered = {
  operation: "base:row:reordered";
  pageId: string;
  rowId: string;
  position: string;
  requestId?: string | null;
};

type BasePropertyEvent = {
  operation:
    | "base:property:created"
    | "base:property:updated"
    | "base:property:deleted"
    | "base:property:reordered";
  pageId: string;
  property?: IBaseProperty;
  propertyId?: string;
  requestId?: string | null;
};

type BaseViewEvent = {
  operation:
    | "base:view:created"
    | "base:view:updated"
    | "base:view:deleted";
  pageId: string;
  view?: IBaseView;
  viewId?: string;
};

type BaseRowsUpdated = {
  operation: "base:rows:updated";
  pageId: string;
  rowIds: string[];
  propertyIds: string[];
  requestId?: string | null;
};

type BaseFormulaRecomputeStarted = {
  operation: "base:formula:recompute:started";
  pageId: string;
  propertyIds: string[];
  jobId: string;
};

type BaseFormulaRecomputeCompleted = {
  operation: "base:formula:recompute:completed";
  pageId: string;
  propertyIds: string[];
  jobId: string;
  processed: number;
  errored: number;
};

type BaseSchemaBumped = {
  operation: "base:schema:bumped";
  pageId: string;
  schemaVersion: number;
};

type BaseSubscribed = {
  operation: "base:subscribed";
  pageId: string;
  schemaVersion: number;
};

type BaseInboundEvent =
  | BaseRowCreated
  | BaseRowUpdated
  | BaseRowDeleted
  | BaseRowsDeleted
  | BaseRowReordered
  | BaseRowsUpdated
  | BaseFormulaRecomputeStarted
  | BaseFormulaRecomputeCompleted
  | BaseSchemaBumped
  | BaseSubscribed
  | BasePropertyEvent
  | BaseViewEvent
  | { operation: string; pageId: string };

// Module-level set of requestIds we've just sent. When the socket echoes back
// a mutation with a matching requestId we drop it, as the local mutation
// already updated the cache. Bounded to prevent unbounded growth on long tabs.
const outboundRequestIds = new Set<string>();
const OUTBOUND_MAX = 256;

export function markRequestIdOutbound(requestId: string): void {
  outboundRequestIds.add(requestId);
  if (outboundRequestIds.size > OUTBOUND_MAX) {
    const oldest = outboundRequestIds.values().next().value;
    if (oldest) outboundRequestIds.delete(oldest);
  }
}

// Realtime bridge for a single base. Joins the base-{pageId} room on mount,
// leaves on unmount, and reconciles React Query caches on inbound events.
export function useBaseSocket(pageId: string | undefined): void {
  const socket = useAtomValue(socketAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !pageId) return;

    socket.emit("message", { operation: "base:subscribe", pageId });

    const handler = (raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const event = raw as BaseInboundEvent;
      if (event.pageId !== pageId) return;

      const requestId = (event as any).requestId as string | undefined;
      if (requestId && outboundRequestIds.has(requestId)) {
        outboundRequestIds.delete(requestId);
        return;
      }

      switch (event.operation) {
        case "base:row:created": {
          const e = event as BaseRowCreated;
          const baseForCreate = queryClient.getQueryData<IBase>(["bases", pageId]);
          const hasKanbanForCreate = (baseForCreate?.views ?? []).some((v) => v.type === "kanban");
          if (hasKanbanForCreate) {
            invalidateBaseRows(pageId);
          } else {
            queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
              { queryKey: ["base-rows", pageId] },
              (old) => {
                if (!old) return old;
                const lastPageIndex = old.pages.length - 1;
                return {
                  ...old,
                  pages: old.pages.map((page, index) =>
                    index === lastPageIndex
                      ? { ...page, items: [...page.items, e.row] }
                      : page,
                  ),
                };
              },
            );
          }
          break;
        }
        case "base:row:updated": {
          const e = event as BaseRowUpdated;
          const baseForUpdate = queryClient.getQueryData<IBase>(["bases", pageId]);
          const hasKanbanForUpdate = (baseForUpdate?.views ?? []).some((v) => v.type === "kanban");
          if (hasKanbanForUpdate) {
            invalidateBaseRows(pageId);
          } else {
            queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
              { queryKey: ["base-rows", pageId] },
              (old) =>
                !old
                  ? old
                  : {
                      ...old,
                      pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.map((row) =>
                          row.id === e.rowId
                            ? {
                                ...row,
                                cells: { ...row.cells, ...e.updatedCells },
                              }
                            : row,
                        ),
                      })),
                    },
            );
          }
          break;
        }
        case "base:row:deleted": {
          const e = event as BaseRowDeleted;
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", pageId] },
            (old) =>
              !old
                ? old
                : {
                    ...old,
                    pages: old.pages.map((page) => ({
                      ...page,
                      items: page.items.filter((row) => row.id !== e.rowId),
                    })),
                  },
          );
          const store = getDefaultStore();
          const selectedIdsAtom = selectedRowIdsAtomFamily(pageId);
          const current = store.get(selectedIdsAtom);
          if (current.has(e.rowId)) {
            const next = new Set(current);
            next.delete(e.rowId);
            store.set(selectedIdsAtom, next);
          }
          break;
        }
        case "base:rows:deleted": {
          const e = event as BaseRowsDeleted;
          const removeSet = new Set(e.rowIds);
          queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
            { queryKey: ["base-rows", pageId] },
            (old) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((row) => !removeSet.has(row.id)),
                })),
              };
            },
          );
          const store = getDefaultStore();
          const selectedIdsAtom = selectedRowIdsAtomFamily(pageId);
          const current = store.get(selectedIdsAtom);
          if (current.size > 0) {
            let changed = false;
            const next = new Set(current);
            for (const id of e.rowIds) {
              if (next.delete(id)) changed = true;
            }
            if (changed) store.set(selectedIdsAtom, next);
          }
          break;
        }
        case "base:row:reordered": {
          const e = event as BaseRowReordered;
          const baseForReorder = queryClient.getQueryData<IBase>(["bases", pageId]);
          const hasKanbanForReorder = (baseForReorder?.views ?? []).some((v) => v.type === "kanban");
          if (hasKanbanForReorder) {
            invalidateBaseRows(pageId);
          } else {
            queryClient.setQueriesData<InfiniteData<IPagination<IBaseRow>>>(
              { queryKey: ["base-rows", pageId] },
              (old) =>
                !old
                  ? old
                  : {
                      ...old,
                      pages: old.pages.map((page) => ({
                        ...page,
                        items: page.items.map((row) =>
                          row.id === e.rowId
                            ? { ...row, position: e.position }
                            : row,
                        ),
                      })),
                    },
            );
          }
          break;
        }
        case "base:rows:updated": {
          const e = event as BaseRowsUpdated;
          // Only refetch if the batch touches rows currently in cache; formula
          // backfills emit one event per 500 rows so this avoids redundant fetches.
          const updatedIds = new Set(e.rowIds);
          const caches = queryClient.getQueriesData<
            InfiniteData<IPagination<IBaseRow>>
          >({ queryKey: ["base-rows", pageId] });
          let touchesCache = false;
          outer: for (const [, data] of caches) {
            if (!data) continue;
            for (const page of data.pages) {
              for (const row of page.items) {
                if (updatedIds.has(row.id)) {
           
```

### Core Architecture Module: `apps/client/src/ee/base/hooks/use-base-table.ts`
```
import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  ColumnDef,
  SortingState,
  ColumnSizingState,
  VisibilityState,
  ColumnOrderState,
  ColumnPinningState,
  Table,
} from "@tanstack/react-table";
import {
  IBase,
  IBaseProperty,
  IBaseRow,
  IBaseView,
  ViewConfig,
  ViewConfigPatch,
} from "@/ee/base/types/base.types";
import { useUpdateViewMutation } from "@/ee/base/queries/base-view-query";
import { systemAccessorFor } from "@/ee/base/property-types/property-type.registry";

const DEFAULT_COLUMN_WIDTH = 180;
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 600;
const ROW_NUMBER_COLUMN_WIDTH = 64;

const columnHelper = createColumnHelper<IBaseRow>();

function buildColumns(properties: IBaseProperty[]): ColumnDef<IBaseRow, unknown>[] {
  const rowNumberColumn = columnHelper.display({
    id: "__row_number",
    header: "#",
    size: ROW_NUMBER_COLUMN_WIDTH,
    minSize: ROW_NUMBER_COLUMN_WIDTH,
    maxSize: ROW_NUMBER_COLUMN_WIDTH,
    enableResizing: false,
    enableSorting: false,
    enableHiding: false,
  });

  const propertyColumns = properties.map((property) => {
    const sysAccessor = systemAccessorFor(property.type);
    if (sysAccessor) {
      return columnHelper.accessor(sysAccessor, {
        id: property.id,
        header: property.name,
        size: DEFAULT_COLUMN_WIDTH,
        minSize: MIN_COLUMN_WIDTH,
        maxSize: MAX_COLUMN_WIDTH,
        enableResizing: true,
        enableSorting: false,
        enableHiding: !property.isPrimary,
        meta: { property },
      });
    }

    return columnHelper.accessor((row) => row.cells[property.id], {
      id: property.id,
      header: property.name,
      size: DEFAULT_COLUMN_WIDTH,
      minSize: MIN_COLUMN_WIDTH,
      maxSize: MAX_COLUMN_WIDTH,
      enableResizing: true,
      enableSorting: true,
      enableHiding: !property.isPrimary,
      meta: { property },
    });
  });

  return [rowNumberColumn, ...propertyColumns];
}

function buildSortingState(config: ViewConfig | undefined): SortingState {
  if (!config?.sorts?.length) return [];
  return config.sorts.map((sort) => ({
    id: sort.propertyId,
    desc: sort.direction === "desc",
  }));
}

function buildColumnSizing(
  config: ViewConfig | undefined,
): ColumnSizingState {
  const sizing: ColumnSizingState = {
    __row_number: ROW_NUMBER_COLUMN_WIDTH,
  };
  if (config?.propertyWidths) {
    Object.entries(config.propertyWidths).forEach(([id, width]) => {
      sizing[id] = width;
    });
  }
  return sizing;
}

function buildColumnVisibility(
  config: ViewConfig | undefined,
  properties: IBaseProperty[],
): VisibilityState {
  const visibility: VisibilityState = { __row_number: true };

  if (config?.hiddenPropertyIds) {
    const hiddenSet = new Set(config.hiddenPropertyIds);
    properties.forEach((p) => {
      visibility[p.id] = !hiddenSet.has(p.id);
    });
    return visibility;
  }

  if (config?.visiblePropertyIds?.length) {
    const visibleSet = new Set(config.visiblePropertyIds);
    properties.forEach((p) => {
      visibility[p.id] = visibleSet.has(p.id);
    });
    return visibility;
  }

  properties.forEach((p) => {
    visibility[p.id] = true;
  });
  return visibility;
}

function buildColumnOrder(
  config: ViewConfig | undefined,
  properties: IBaseProperty[],
): ColumnOrderState {
  if (config?.propertyOrder?.length) {
    const orderSet = new Set(config.propertyOrder);
    const missing = properties
      .filter((p) => !orderSet.has(p.id))
      .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
      .map((p) => p.id);
    return ["__row_number", ...config.propertyOrder, ...missing];
  }
  const sorted = [...properties].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
  });
  return ["__row_number", ...sorted.map((p) => p.id)];
}

function buildColumnPinning(
  properties: IBaseProperty[],
  pinPrimary: boolean,
): ColumnPinningState {
  const primary = pinPrimary ? properties.find((p) => p.isPrimary) : undefined;
  return {
    left: primary ? ["__row_number", primary.id] : ["__row_number"],
    right: [],
  };
}

export function buildLayoutConfigPatch(table: Table<IBaseRow>): ViewConfigPatch {
  const state = table.getState();

  const propertyWidths: Record<string, number> = {};
  Object.entries(state.columnSizing).forEach(([id, width]) => {
    if (id !== "__row_number") {
      // Resize state can hold the raw drag value below minSize; rendering
      // clamps via getSize(), so persist the clamped value too.
      propertyWidths[id] = Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, width),
      );
    }
  });

  const propertyOrder = state.columnOrder.filter((id) => id !== "__row_number");

  const hiddenPropertyIds = Object.entries(state.columnVisibility)
    .filter(([id, visible]) => id !== "__row_number" && !visible)
    .map(([id]) => id);

  return {
    propertyWidths,
    propertyOrder,
    hiddenPropertyIds,
    visiblePropertyIds: null,
  };
}

export type UseBaseTableResult = {
  table: Table<IBaseRow>;
  persistViewConfig: () => void;
};

export function useBaseTable(
  base: IBase | undefined,
  rows: IBaseRow[],
  activeView: IBaseView | undefined,
): UseBaseTableResult {
  const updateViewMutation = useUpdateViewMutation();
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // While a local edit is pending the reconcile effect preserves local state
  // to avoid stomping in-flight toggles. When idle it adopts server state so
  // remote updates from other clients (e.g. hiding a column) show up here.
  const [hasPendingEdit, setHasPendingEdit] = useState(false);

  const properties = useMemo(() => base?.properties ?? [], [base?.properties]);
  const viewConfig = activeView?.config;

  const columns = useMemo(
    () => buildColumns(properties),
    [properties],
  );

  const initialSorting = useMemo(
    () => buildSortingState(viewConfig),
    [viewConfig],
  );

  const derivedColumnSizing = useMemo(
    () => buildColumnSizing(viewConfig),
    [viewConfig],
  );

  const derivedColumnOrder = useMemo(
    () => buildColumnOrder(viewConfig, properties),
    [viewConfig, properties],
  );

  const derivedColumnVisibility = useMemo(
    () => buildColumnVisibility(viewConfig, properties),
    [viewConfig, properties],
  );

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(derivedColumnOrder);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(derivedColumnVisibility);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(derivedColumnSizing);

  // Re-seed from the server only on view switch. Within the same view local
  // state is the source of truth. Without this guard, any ws-driven
  // invalidateQueries would land a new derivedColumnVisibility reference and
  // overwrite a pending toggle before persistViewConfig flushes it.
  const lastSyncedViewIdRef = useRef<string | undefined>(activeView?.id);
  useEffect(() => {
    const currentViewId = activeView?.id;

    if (currentViewId !== lastSyncedViewIdRef.current) {
      lastSyncedViewIdRef.current = currentViewId;
      setColumnOrder(derivedColumnOrder);
      setColumnVisibility(derivedColumnVisibility);
      setColumnSizing(derivedColumnSizing);
      return;
    }

    // Same view: if a local edit is pending, reconcile only the id set so
    // new/deleted columns appear without stomping the user's toggle.
    // If no edit is pending, adopt server state so remote updates show up.
    const validIds = new Set<string>(["__row_number"]);
    for (const p of properties) validIds.add(p.id);

    if (hasPendingEdit) {
      setColumnOrder((prev) => {
        const prevSet = new Set(prev);
        const kept = prev.filter((id) => validIds.has(id));
        const appended = derivedColumnOrder.filter(
          (id) => !prevSet.has(id) && validIds.has(id),
        );
        if (appended.length === 0 && kept.length === prev.length) return prev;
        return [...kept, ...appended];
      });

      setColumnVisibility((prev) => {
        let changed = false;
        const next: VisibilityState = {};
        for (const [id, visible] of Object.entries(prev)) {
          if (validIds.has(id)) {
            next[id] = visible;
          } else {
            changed = true;
          }
        }
        for (const id of derivedColumnOrder) {
          if (!(id in next)) {
            next[id] = derivedColumnVisibility[id] ?? true;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      setColumnSizing((prev) => {
        let changed = false;
        const next: ColumnSizingState = {};
        for (const [id, width] of Object.entries(prev)) {
          if (validIds.has(id)) {
            next[id] = width;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } else {
      setColumnOrder(derivedColumnOrder);
      setColumnVisibility(derivedColumnVisibility);
      setColumnSizing(derivedColumnSizing);
    }
  }, [
    activeView?.id,
    derivedColumnOrder,
    derivedColumnVisibility,
    derivedColumnSizing,
    properties,
    hasPendingEdit,
  ]);

  const isMobile = useMediaQuery("(max-width: 48em)", false, {
    getInitialValueInEffect: false,
  });
  const columnPinning = useMemo(
    () => buildColumnPinning(properties, !isMobile),
    [properties, isMobile],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      columnPinning,
      columnOrder,
      columnVisibility,
      columnSizing,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisib
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2414** (2026-08-23): **Bug: filter for unchecked checkboxes in base**
  *Symptoms*: ### Describe the bug  When I create a filter in a base table on a field of type checkbox. The filter should filter all rows where the checkbox is unset.  It simply does not work: all rows with an unset checkbox get nevertheless removed by the filter.  ### Steps to reproduce the behaviour  * a table with a field "Done" of type checkbox * create a new filter ... * select field "Done" * select comparison type "Is" * select value "false" * ISSUE: result is empty although a number of datasets with an unchecked Done field exist * OK filter by "true" results in the expected   ### Expected behaviour  Allow a filter for unset checkboxes.  ### Screenshots / screencast  https://github.com/user-attachments/assets/ddc113a8-e147-419b-a6af-ea6031340d7b  ### Context * DocMost Version: v0.95.0 * Browser: firefox 154  

- **Issue #2407** (2026-08-25): **Multi-select behaviour in filters (usability)**
  *Symptoms*: If I create a new filter based on a select-field and I chose either “Is any of“ or “Is none of“, I cannot select multiple values, but it seems that I have to add multiple filter lines of the same type (which needs a quite complicated interaction, because you have to save the filter in between every time).  ### Proposed change  Allow multi-select within the same filter-rule (checkbox, CTRL-select, comma-separated …)

- **Issue #2401** (2026-08-25): **Subpages list shows "No subpages" on first load in public share view**
  *Symptoms*: When opening a publicly shared page (/share/{shareId}/p/{pageSlug}) that has  subpages, the "Subpages" block within the page body incorrectly shows  "No subpages" on initial load — even though the subpages exist and are  correctly listed in the sidebar tree at the same time.  A manual page refresh immediately fixes the display, showing the correct  list of subpages with their icons and titles.  Steps to reproduce: 1. Create a page with at least one subpage 2. Enable public sharing for the parent page 3. Open the share URL fresh (new tab / first load) 4. Observe: the sidebar tree shows subpages correctly, but the in-body     "Subpages" block shows "No subpages" 5. Refresh the page — the subpages block now displays correctly  Environment: - Reproduced on Docmost v0.90.1 and v0.95.0 - Reproduced on Firefox and Safari (rules out browser-specific cache/cookie    issues)  Expected behavior: The in-body subpages block should reflect the same data as the sidebar on  first load, without requiring a manual refresh.

- **Issue #2399** (2026-08-26): **Escaped brackets \[ before adjacent inline Markdown links get corrupted after HTML export → import round-trip**
  *Symptoms*: ## Description  When a Docmost page contains a sequence of short adjacent Markdown links wrapped in escaped literal brackets — a common pattern for citation-style references, e.g. generated by an AI assistant — the content renders correctly after initial paste, but becomes corrupted after an HTML export → import round-trip (into a different space, and/or a different Docmost instance).  ## Exact source Markdown that reproduces the issue  (extracted via Docmost's own Markdown export of the *original*, still-correct page):  ```markdown ... et qu'**Authentik** agit comme une suite d'identité complète et avancée\. \[[1](https://www.reddit.com/r/selfhosted/comments/1lxodhq/authentik_vs_pocketid_your_opinion_and_experience/?tl=fr), [2](https://www.youtube.com/watch?v=nMHK_rCqDJs&t=31), [3](https://www.youtube.com/watch?v=nm3Oe1TOsaM), [4](https://www.cerbos.dev/blog/authelia-vs-authentik-2026-idp)\] ```  Note the structure: a literal escaped opening bracket `\[`, immediately followed by several `[n](url)` links separated by `, `, closed by a literal escaped `\]`. This pattern repeats multiple times in the same document (once per paragraph/bullet), each with its own set of 1–5 links.  ## Steps to reproduce  1. Paste the above Markdown snippet into a Docmost page (paste-as-Markdown). 2. Confirm it renders correctly: literal `[` then clickable `1`, `2`, `3`, `4` (each linking to its respective URL), separated by commas, then literal `]`. 3. Export the page (or its parent space) as **HT

- **Issue #2340** (2026-08-03): **Users can give themselves edit permission**
  *Symptoms*: Hello,  I have restricted the edit permissions of a page to only myself, and given view permission to a group of users. The users with view permission on that page can still grant themselves edit permission, if they have general edit permissions in that space. And they can even remove my own edit permission on the page. I think this is a security concern, and should be changed, so that the granular page permission is valued higher than space permissions.  Hope I could make the issue clear. If not I can provide screenshots. 

- **Issue #1552** (2026-07-03): **Export: Filenames containing a slash create unintended subdirectories**
  *Symptoms*: **Description:** When a note is titled **Foo 12/2020**, the exported file is saved as **Foo 12/2020.md**. Because / is interpreted as a directory separator by the filesystem, this results in a subfolder **Foo 12/** containing a file named **2020.md** instead of a single file.  **Expected behavior:** Invalid or reserved characters in filenames (e.g. /) should be sanitized and replaced with safe alternatives (e.g. - or _). In this case, the exported file should be named **Foo 12-2020.md** or even **Foo_12-2020.md**, if the space is also sanitized.
  **Post-Mortem & Fix Analysis**:
  > Should be fixed in the latest release.

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

### Incident Patch 1: `d3a0c9bf` (2026-10-05)
**Commit Message**: fix(base): export CSV with the active view's filter (#2541)

The export button only sent the page id, so filtered views still
downloaded every row. Send the view's current (including unsaved draft)
filter, and bump the ee submodule for server-side support.

**File**: `apps/client/src/ee/base/components/base-toolbar.tsx` (modified, +5/-2)
```diff
@@ -20,6 +20,7 @@ import {
   FilterGroup,
 } from "@/ee/base/types/base.types";
 import { exportBaseToCsv } from "@/ee/base/services/base-service";
+import { normalizeFilter } from "@/ee/base/queries/base-row-query";
 import { getApiErrorMessage } from "@/lib/api-error";
 import { ViewTabs } from "@/ee/base/components/views/view-tabs";
 import { ViewSortConfigPopover } from "@/ee/base/components/views/view-sort-config";
@@ -69,11 +70,13 @@ export function BaseToolbar({
 
   const isKanban = activeView?.type === "kanban";
 
+  const viewFilter = activeView?.config?.filter;
+
   const handleExport = useCallback(async () => {
     if (exporting) return;
     setExporting(true);
     try {
-      await exportBaseToCsv(base.id);
+      await exportBaseToCsv(base.id, normalizeFilter(viewFilter));
     } catch (err) {
       notifications.show({
         color: "red",
@@ -82,7 +85,7 @@ export function BaseToolbar({
     } finally {
       setExporting(false);
     }
-  }, [base.id, exporting, t]);
+  }, [base.id, exporting, t, viewFilter]);
 
   const openToolbar = useCallback((panel: "sort" | "filter" | "properties") => {
     setSortOpened(panel === "sort" ? (v) => !v : false);
```

**File**: `apps/client/src/ee/base/services/base-service.ts` (modified, +5/-2)
```diff
@@ -57,10 +57,13 @@ export async function convertPageToBase(
   return req.data;
 }
 
-export async function exportBaseToCsv(pageId: string): Promise<void> {
+export async function exportBaseToCsv(
+  pageId: string,
+  filter?: FilterNode,
+): Promise<void> {
   const req = await api.post(
     "/bases/export-csv",
-    { pageId },
+    { pageId, filter },
     { responseType: "blob" },
   );
 
```

**File**: `apps/server/src/ee` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 8190e2182cbbcc5e291217a13147fcd246ede3fe
+Subproject commit d6260785de583ddb85109802c92499eb9c21b8f0
```

---

### Incident Patch 2: `2e0538c7` (2026-10-04)
**Commit Message**: fix: throttle tracking bug (#2537)

**File**: `apps/server/src/integrations/throttle/user-throttler.guard.spec.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import { Reflector } from '@nestjs/core';
+import { ThrottlerStorageService } from '@nestjs/throttler';
+import { JwtType } from '../../core/auth/dto/jwt-payload';
+import { UserThrottlerGuard } from './user-throttler.guard';
+
+const guard = new UserThrottlerGuard(
+  [],
+  new ThrottlerStorageService(),
+  new Reflector(),
+);
+
+function getTracker(req: Record<string, any>): Promise<string> {
+  return guard['getTracker'](req);
+}
+
+describe('UserThrottlerGuard.getTracker', () => {
+  it('tracks a signed-in request by its user id', async () => {
+    const req = {
+      ip: '203.0.113.7',
+      user: {
+        user: { id: 'user_1' },
+        workspace: { id: 'ws_1' },
+        authType: JwtType.ACCESS,
+      },
+    };
+
+    await expect(getTracker(req)).resolves.toBe('user:user_1');
+  });
+
+  it('falls back to the client ip when nobody is signed in', async () => {
+    const req = { ip: '203.0.113.7', user: null };
+
+    await expect(getTracker(req)).resolves.toBe('203.0.113.7');
+  });
+
+  it('falls back to the socket address when the ip is empty', async () => {
+    const req = {
+      ip: '',
+      user: null,
+      socket: { remoteAddress: '198.51.100.4' },
+    };
+
+    await expect(getTracker(req)).resolves.toBe('198.51.100.4');
+  });
+
+  it('uses a constant tracker for an unidentifiable client', async () => {
+    const req = { ip: '', user: null, socket: {} };
+
+    await expect(getTracker(req)).resolves.toBe('unknown');
+  });
+});
```

**File**: `apps/server/src/integrations/throttle/user-throttler.guard.ts` (modified, +9/-3)
```diff
@@ -1,13 +1,19 @@
 import { Injectable } from '@nestjs/common';
 import { ThrottlerGuard } from '@nestjs/throttler';
 
-type AuthedRequest = { user?: { id?: string } };
+type AuthedRequest = {
+  user?: { user?: { id?: string } } | null;
+  socket?: { remoteAddress?: string };
+};
 
 @Injectable()
 export class UserThrottlerGuard extends ThrottlerGuard {
   protected async getTracker(req: AuthedRequest): Promise<string> {
-    const userId = req.user?.id;
+    const userId = req.user?.user?.id;
     if (userId) return `user:${userId}`;
-    return super.getTracker(req as Parameters<ThrottlerGuard['getTracker']>[0]);
+    const ip = await super.getTracker(
+      req as Parameters<ThrottlerGuard['getTracker']>[0],
+    );
+    return ip || req.socket?.remoteAddress || 'unknown';
   }
 }
```

---

### Incident Patch 3: `b6434371` (2026-09-30)
**Commit Message**: fix: add markdown attribute to details blocks in markdown export (#2533)

**File**: `apps/server/src/collaboration/collaboration.util.spec.ts` (removed, +0/-54)
```diff
@@ -1,54 +0,0 @@
-import { jsonToMarkdown } from './collaboration.util';
-
-const cell = (type: 'tableHeader' | 'tableCell', text: string) => ({
-  type,
-  content: [
-    {
-      type: 'paragraph',
-      content: text ? [{ type: 'text', text }] : [],
-    },
-  ],
-});
-
-const row = (type: 'tableHeader' | 'tableCell', texts: string[]) => ({
-  type: 'tableRow',
-  content: texts.map((text) => cell(type, text)),
-});
-
-const tableDoc = (rows: ReturnType<typeof row>[]) => ({
-  type: 'doc',
-  content: [{ type: 'table', content: rows }],
-});
-
-describe('jsonToMarkdown', () => {
-  it('uses the table header row as the markdown header', () => {
-    const markdown = jsonToMarkdown(
-      tableDoc([
-        row('tableHeader', ['Name', 'Role']),
-        row('tableCell', ['Ada', 'Engineer']),
-      ]),
-    );
-
-    expect(markdown.trim().split('\n')).toEqual([
-      '| Name | Role |',
-      '| --- | --- |',
-      '| Ada | Engineer |',
-    ]);
-  });
-
-  it('adds an empty header when the table has no header row', () => {
-    const markdown = jsonToMarkdown(
-      tableDoc([
-        row('tableCell', ['Ada', 'Engineer']),
-        row('tableCell', ['Alan', 'Mathematician']),
-      ]),
-    );
-
-    expect(markdown.trim().split('\n')).toEqual([
-      '|     |     |',
-      '| --- | --- |',
-      '| Ada | Engineer |',
-      '| Alan | Mathematician |',
-    ]);
-  });
-});
```

**File**: `apps/server/src/integrations/export/html-to-markdown.spec.ts` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+import { htmlToMarkdown } from '@docmost/editor-ext';
+
+const colgroup =
+  '<colgroup><col style="min-width: 25px;" /><col style="min-width: 25px;" /></colgroup>';
+
+describe('htmlToMarkdown', () => {
+  it('uses the table header row as the markdown header', () => {
+    const markdown = htmlToMarkdown(
+      `<table>${colgroup}<tbody>` +
+        '<tr><th><p>Name</p></th><th><p>Role</p></th></tr>' +
+        '<tr><td><p>Ada</p></td><td><p>Engineer</p></td></tr>' +
+        '</tbody></table>',
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '| Name | Role |',
+      '| --- | --- |',
+      '| Ada | Engineer |',
+    ]);
+  });
+
+  it('adds an empty header when the table has no header row', () => {
+    const markdown = htmlToMarkdown(
+      `<table>${colgroup}<tbody>` +
+        '<tr><td><p>Ada</p></td><td><p>Engineer</p></td></tr>' +
+        '<tr><td><p>Alan</p></td><td><p>Mathematician</p></td></tr>' +
+        '</tbody></table>',
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '|     |     |',
+      '| --- | --- |',
+      '| Ada | Engineer |',
+      '| Alan | Mathematician |',
+    ]);
+  });
+
+  it('marks details blocks so their content is parsed as markdown', () => {
+    const markdown = htmlToMarkdown(
+      '<details><summary data-type="detailsSummary">Title</summary>' +
+        '<div data-type="detailsContent"><p>Some <strong>bold</strong></p></div>' +
+        '</details>',
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '<details markdown="1">',
+      '<summary>Title</summary>',
+      '',
+      'Some **bold**',
+      '',
+      '</details>',
+    ]);
+  });
+});
```

**File**: `packages/editor-ext/src/lib/markdown/utils/turndown.utils.ts` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ function preserveDetail(turndownService: _TurndownService) {
         )
         .join('');
 
-      return `\n<details>\n${detailSummary}\n\n${detailsContent}\n\n</details>\n`;
+      return `\n<details markdown="1">\n${detailSummary}\n\n${detailsContent}\n\n</details>\n`;
     },
   });
 }
```

---

### Incident Patch 4: `f4caf0ba` (2026-09-30)
**Commit Message**: fix: preserve table header row in markdown export (#2532)

**File**: `apps/server/src/collaboration/collaboration.util.spec.ts` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+import { jsonToMarkdown } from './collaboration.util';
+
+const cell = (type: 'tableHeader' | 'tableCell', text: string) => ({
+  type,
+  content: [
+    {
+      type: 'paragraph',
+      content: text ? [{ type: 'text', text }] : [],
+    },
+  ],
+});
+
+const row = (type: 'tableHeader' | 'tableCell', texts: string[]) => ({
+  type: 'tableRow',
+  content: texts.map((text) => cell(type, text)),
+});
+
+const tableDoc = (rows: ReturnType<typeof row>[]) => ({
+  type: 'doc',
+  content: [{ type: 'table', content: rows }],
+});
+
+describe('jsonToMarkdown', () => {
+  it('uses the table header row as the markdown header', () => {
+    const markdown = jsonToMarkdown(
+      tableDoc([
+        row('tableHeader', ['Name', 'Role']),
+        row('tableCell', ['Ada', 'Engineer']),
+      ]),
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '| Name | Role |',
+      '| --- | --- |',
+      '| Ada | Engineer |',
+    ]);
+  });
+
+  it('adds an empty header when the table has no header row', () => {
+    const markdown = jsonToMarkdown(
+      tableDoc([
+        row('tableCell', ['Ada', 'Engineer']),
+        row('tableCell', ['Alan', 'Mathematician']),
+      ]),
+    );
+
+    expect(markdown.trim().split('\n')).toEqual([
+      '|     |     |',
+      '| --- | --- |',
+      '| Ada | Engineer |',
+      '| Alan | Mathematician |',
+    ]);
+  });
+});
```

**File**: `packages/editor-ext/src/lib/markdown/utils/turndown.utils.ts` (modified, +5/-1)
```diff
@@ -37,7 +37,11 @@ export function htmlToMarkdown(html: string): string {
     footnoteRef,
     footnotesList,
   ]);
-  return turndownService.turndown(html).replaceAll('<br>', ' ');
+  const htmlWithoutColgroups = html.replace(
+    /<colgroup\b[^>]*>[\s\S]*?<\/colgroup>/gi,
+    '',
+  );
+  return turndownService.turndown(htmlWithoutColgroups).replaceAll('<br>', ' ');
 }
 
 function listParagraph(turndownService: _TurndownService) {
```

---

### Incident Patch 5: `a78e52b8` (2026-09-30)
**Commit Message**: fix: copy page labels when duplicating pages (#2531)

**File**: `apps/server/src/core/page/services/page.service.ts` (modified, +9/-1)
```diff
@@ -56,6 +56,7 @@ import { markdownToHtml } from '@docmost/editor-ext';
 import { WatcherService } from '../../watcher/watcher.service';
 import { sql } from 'kysely';
 import { TransclusionService } from '../transclusion/transclusion.service';
+import { LabelRepo } from '@docmost/db/repos/label/label.repo';
 
 @Injectable()
 export class PageService {
@@ -74,6 +75,7 @@ export class PageService {
     private collaborationGateway: CollaborationGateway,
     private readonly watcherService: WatcherService,
     private readonly transclusionService: TransclusionService,
+    private readonly labelRepo: LabelRepo,
   ) {}
 
   async findById(
@@ -715,7 +717,13 @@ export class PageService {
       }),
     );
 
-    await this.db.insertInto('pages').values(insertablePages).execute();
+    await executeTx(this.db, async (trx) => {
+      await trx.insertInto('pages').values(insertablePages).execute();
+      await this.labelRepo.copyLabelsToPages(
+        new Map([...pageMap].map(([oldId, entry]) => [oldId, entry.newPageId])),
+        trx,
+      );
+    });
 
     // Extract transclusions from every duplicated page and persist them in
     // one statement. Duplication bypasses Yjs onStoreDocument; brand-new
```

**File**: `apps/server/src/database/repos/label/label.repo.ts` (modified, +26/-0)
```diff
@@ -176,6 +176,32 @@ export class LabelRepo {
       .execute();
   }
 
+  async copyLabelsToPages(
+    pageIdMap: Map<string, string>,
+    trx?: KyselyTransaction,
+  ): Promise<void> {
+    if (pageIdMap.size === 0) return;
+    const db = dbOrTx(this.db, trx);
+
+    const sourceLabels = await db
+      .selectFrom('pageLabels')
+      .select(['pageId', 'labelId'])
+      .where('pageId', 'in', [...pageIdMap.keys()])
+      .execute();
+    if (sourceLabels.length === 0) return;
+
+    await db
+      .insertInto('pageLabels')
+      .values(
+        sourceLabels.map((row) => ({
+          pageId: pageIdMap.get(row.pageId),
+          labelId: row.labelId,
+        })),
+      )
+      .onConflict((oc) => oc.doNothing())
+      .execute();
+  }
+
   async removeLabelFromPage(
     pageId: string,
     labelId: string,
```

---

### Incident Patch 6: `01a139c3` (2026-09-30)
**Commit Message**: fix: skip page update notifications for users viewing the page (#2530)

* fix: drop malformed awareness before broadcast

* clear interval

* pass userId and avatar to awareness

* fix: skip page update notifications for editors and users viewing the page

**File**: `apps/client/src/features/editor/extensions/extensions.ts` (modified, +2/-0)
```diff
@@ -471,7 +471,9 @@ export const collabExtensions: CollabExtensions = (provider, user) => [
   CollaborationCaret.configure({
     provider,
     user: {
+      id: user.id,
       name: user.name,
+      avatarUrl: user.avatarUrl,
       color: randomElement(userColors),
     },
   }),
```

**File**: `apps/server/src/collaboration/collaboration.gateway.ts` (modified, +7/-1)
```diff
@@ -146,8 +146,14 @@ export class CollaborationGateway {
     eventName: TName,
     documentName: string,
     payload: Parameters<CollabEventHandlers[TName]>[1],
+    onlyIfOpen = false,
   ) {
-    return this.redisSync?.handleEvent(eventName, documentName, payload);
+    return this.redisSync?.handleEvent(
+      eventName,
+      documentName,
+      payload,
+      onlyIfOpen,
+    );
   }
 
   openDirectConnection(documentName: string, context?: any) {
```

**File**: `apps/server/src/collaboration/collaboration.handler.ts` (modified, +11/-0)
```diff
@@ -21,6 +21,17 @@ export class CollaborationHandler {
 
   getHandlers(hocuspocus: Hocuspocus) {
     return {
+      getConnectedUserIds: async (documentName: string) => {
+        const document = hocuspocus.documents.get(documentName);
+        if (!document) return [];
+
+        const userIds = new Set<string>();
+        for (const state of document.awareness.getStates().values()) {
+          const userId = state?.user?.id;
+          if (typeof userId === 'string') userIds.add(userId);
+        }
+        return [...userIds];
+      },
       alterState: async (documentName: string, payload: { pageId: string }) => {
         // dummy
         // this.logger.log('Processing', documentName, payload);
```

**File**: `apps/server/src/collaboration/collaboration.util.ts` (modified, +4/-0)
```diff
@@ -247,3 +247,7 @@ export function jsonToMarkdown(tiptapJson: any): string {
   const html = jsonToHtml(tiptapJson);
   return htmlToMarkdown(html);
 }
+
+export function isRenderableObject(value: unknown): boolean {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
```

**File**: `apps/server/src/collaboration/extensions/persistence.extension.ts` (modified, +48/-5)
```diff
@@ -1,5 +1,6 @@
 import {
   afterUnloadDocumentPayload,
+  beforeHandleAwarenessPayload,
   Extension,
   onChangePayload,
   onLoadDocumentPayload,
@@ -8,7 +9,12 @@ import {
 import * as Y from 'yjs';
 import { Injectable, Logger } from '@nestjs/common';
 import { TiptapTransformer } from '@hocuspocus/transformer';
-import { getPageId, jsonToText, tiptapExtensions } from '../collaboration.util';
+import {
+  getPageId,
+  isRenderableObject,
+  jsonToText,
+  tiptapExtensions,
+} from '../collaboration.util';
 import { PageRepo } from '@docmost/db/repos/page/page.repo';
 import { InjectKysely } from 'nestjs-kysely';
 import { KyselyDB } from '@docmost/db/types/kysely.types';
@@ -132,6 +138,8 @@ export class PersistenceExtension implements Extension {
           return;
         }
 
+        await this.collabHistory.addContributors(pageId, editingUserIds);
+
         let contributorIds = undefined;
         try {
           const existingContributors = page.contributorIds || [];
@@ -162,6 +170,10 @@ export class PersistenceExtension implements Extension {
       });
     } catch (err) {
       this.logger.error(`Failed to update page ${pageId}`, err);
+      page = null;
+      editingUserIds.forEach((userId) =>
+        this.trackContributor(documentName, userId),
+      );
     }
 
     if (page) {
@@ -184,8 +196,6 @@ export class PersistenceExtension implements Extension {
     }
 
     if (page) {
-      await this.collabHistory.addContributors(pageId, editingUserIds);
-
       const mentions = extractMentions(tiptapJson);
 
       const userMentions = extractUserMentions(mentions);
@@ -217,12 +227,45 @@ export class PersistenceExtension implements Extension {
     }
   }
 
+  // Drop malformed awareness before it is broadcast
+  async beforeHandleAwareness({
+    states,
+    context,
+  }: beforeHandleAwarenessPayload) {
+    const user = context?.user;
+
+    for (const [clientId, state] of states) {
+      if (!isRenderableObject(state)) {
+        states.delete(clientId);
+        continue;
+      }
+
+      if ('user' in state && !isRenderableObject(state.user)) {
+        delete state.user;
+      }
+
+      if (state.user && user) {
+        state.user.id = user.id;
+        state.user.avatarUrl = user.avatarUrl ?? null;
+      }
+
+      if (
+        'cursor' in state &&
+        state.cursor !== null &&
+        !isRenderableObject(state.cursor)
+      ) {
+        delete state.cursor;
+      }
+    }
+  }
+
   async onChange(data: onChangePayload) {
-    const documentName = data.documentName;
     const userId = data.context?.user?.id;
-
     if (!userId) return;
+    this.trackContributor(data.documentName, userId);
+  }
 
+  private trackContributor(documentName: string, userId: string) {
     if (!this.contributors.has(documentName)) {
       this.contributors.set(documentName, new Set());
     }
```

**File**: `apps/server/src/collaboration/extensions/redis-sync/redis-sync.extension.ts` (modified, +4/-6)
```diff
@@ -235,13 +235,11 @@ export class RedisSyncExtension<TCE extends CustomEvents> implements Extension {
   };
 
   async maintainLock(documentName: string) {
+    clearInterval(this.locks[documentName]);
     this.locks[documentName] = setInterval(() => {
-      this.pub.set(
-        this.getKey(documentName),
-        this.serverId,
-        'PX',
-        this.lockTTL,
-      );
+      this.pub
+        .set(this.getKey(documentName), this.serverId, 'PX', this.lockTTL)
+        .catch(() => {});
     }, this.lockTTL / 2);
   }
 
```

**File**: `apps/server/src/collaboration/server/collab-main.ts` (modified, +8/-0)
```diff
@@ -37,6 +37,14 @@ async function bootstrap() {
 
   const logger = new Logger('CollabServer');
 
+  process.on('unhandledRejection', (reason, promise) => {
+    logger.error(`UnhandledRejection, reason: ${reason}`, promise);
+  });
+
+  process.on('uncaughtException', (error) => {
+    logger.error('UncaughtException:', error);
+  });
+
   const port = process.env.COLLAB_PORT || 3001;
   const host = process.env.HOST || '0.0.0.0';
   await app.listen(port, host, () => {
```

**File**: `apps/server/src/core/notification/notification.module.ts` (modified, +2/-1)
```diff
@@ -6,9 +6,10 @@ import { CommentNotificationService } from './services/comment.notification';
 import { PageNotificationService } from './services/page.notification';
 import { VerificationNotificationService } from './services/verification.notification';
 import { PageUpdateEmailRateLimiter } from './services/page-update-email-rate-limiter';
+import { CollaborationModule } from '../../collaboration/collaboration.module';
 
 @Module({
-  imports: [],
+  imports: [CollaborationModule],
   controllers: [NotificationController],
   providers: [
     NotificationService,
```

---

### Incident Patch 7: `870b71d2` (2026-09-29)
**Commit Message**: fix search limit and performance (#2529)

**File**: `apps/server/src/core/search/dto/search.dto.ts` (modified, +5/-0)
```diff
@@ -6,11 +6,15 @@ import {
   IsOptional,
   IsString,
   IsUUID,
+  MaxLength,
 } from 'class-validator';
 
+export const SEARCH_QUERY_MAX_LENGTH = 200;
+
 export class SearchDTO {
   @IsOptional()
   @IsString()
+  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
   query?: string;
 
   @IsOptional()
@@ -61,6 +65,7 @@ export class SearchPublicSpaceDTO extends SearchDTO {
 
 export class SearchSuggestionDTO {
   @IsString()
+  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
   query: string;
 
   @IsOptional()
```

**File**: `apps/server/src/core/search/search.service.ts` (modified, +22/-6)
```diff
@@ -55,11 +55,6 @@ export class SearchService {
         : sql<number>`ts_rank(tsv, to_tsquery('english', f_unaccent(${searchQuery})))`.as(
             'rank',
           );
-    const highlightColumn = browseByFilters || titleOnly
-      ? sql<string>`''`.as('highlight')
-      : sql<string>`ts_headline('english', text_content, to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
-          'highlight',
-        );
 
     let queryResults = this.db
       .selectFrom('pages')
@@ -73,7 +68,6 @@ export class SearchService {
         'createdAt',
         'updatedAt',
         rankColumn,
-        highlightColumn,
       ])
       .$if(!browseByFilters && !titleOnly, (qb) =>
         qb.where(
@@ -189,10 +183,32 @@ export class SearchService {
       results = results.filter((r: any) => accessibleSet.has(r.id));
     }
 
+    if (!browseByFilters && !titleOnly && results.length > 0) {
+      const highlights = await this.db
+        .selectFrom('pages')
+        .select([
+          'id',
+          sql<string>`ts_headline('english', substring(text_content, 1, 100000), to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
+            'highlight',
+          ),
+        ])
+        .where(
+          'id',
+          'in',
+          results.map((r: any) => r.id),
+        )
+        .execute();
+      const highlightById = new Map(highlights.map((h) => [h.id, h.highlight]));
+      for (const result of results) {
+        result.highlight = highlightById.get(result.id) ?? '';
+      }
+    }
+
     //@ts-ignore
     const searchResults = results.map((result: SearchResponseDto) => {
       result.wholeWord = true
       if (!result.highlight) {
+        result.highlight = '';
         result.matchedText = [];
         return result;
       }
```

**File**: `apps/server/src/ee` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 5e7120dcc86a344f5af09ccda0a29d5784659938
+Subproject commit 9134679e37e8ccd0f79e6f6c05da8e238778420d
```

---

### Incident Patch 8: `6205bbeb` (2026-09-08)
**Commit Message**: fix: page tree reordering

**File**: `apps/client/src/features/page/tree/components/space-tree-node-menu.tsx` (modified, +11/-2)
```diff
@@ -33,6 +33,10 @@ import {
 
 import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
 import { treeModel } from "@/features/page/tree/model/tree-model";
+import {
+  spaceRoots,
+  updateSpaceRoots,
+} from "@/features/page/tree/utils/utils.ts";
 import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
 import type { SpaceTreeNode } from "@/features/page/tree/types.ts";
 import classes from "@/features/page/tree/styles/tree.module.css";
@@ -77,7 +81,10 @@ export function NodeMenu({ node, canEdit }: NodeMenuProps) {
       const duplicatedPage = await duplicatePage({ pageId: node.id });
 
       // figure out parent + insertion index
-      const siblings = treeModel.siblingsOf(data, node.id);
+      const siblings = treeModel.siblingsOf(
+        spaceRoots(data, node.spaceId),
+        node.id,
+      );
       const parentId = siblings?.parentId ?? null;
       const currentIndex = siblings?.index ?? 0;
       const newIndex = currentIndex + 1;
@@ -96,7 +103,9 @@ export function NodeMenu({ node, canEdit }: NodeMenuProps) {
       };
 
       setData((prev) =>
-        treeModel.insert(prev, parentId, treeNodeData, newIndex),
+        updateSpaceRoots(prev, node.spaceId, (roots) =>
+          treeModel.insert(roots, parentId, treeNodeData, newIndex),
+        ),
       );
 
       setTimeout(() => {
```

**File**: `apps/client/src/features/page/tree/components/space-tree.tsx` (modified, +11/-13)
```diff
@@ -16,6 +16,8 @@ import {
   buildTree,
   buildTreeWithChildren,
   mergeRootTrees,
+  spaceRoots,
+  updateSpaceRoots,
 } from "@/features/page/tree/utils/utils.ts";
 import { SpaceTreeNode } from "@/features/page/tree/types.ts";
 import { getPageTitle } from "@/features/page/page.utils";
@@ -66,18 +68,14 @@ export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
     const allItems = pagesData.pages.flatMap((page) => page.items);
     const treeData = buildTree(allItems);
 
-    setData((prev) => {
-      // Keep nodes belonging to other spaces — filteredData filters by spaceId
-      // for rendering, so accumulating is safe. Preserves lazy-loaded children
-      // and open-state when the user returns to a previously-visited space.
-      const otherSpaces = prev.filter((n) => n?.spaceId !== spaceId);
-      const currentSpace = prev.filter((n) => n?.spaceId === spaceId);
-      const refreshed =
-        currentSpace.length > 0
-          ? mergeRootTrees(currentSpace, treeData)
-          : treeData;
-      return [...otherSpaces, ...refreshed];
-    });
+    // Keep nodes belonging to other spaces — filteredData filters by spaceId
+    // for rendering, so accumulating is safe. Preserves lazy-loaded children
+    // and open-state when the user returns to a previously-visited space.
+    setData((prev) =>
+      updateSpaceRoots(prev, spaceId, (roots) =>
+        roots.length > 0 ? mergeRootTrees(roots, treeData) : treeData,
+      ),
+    );
     setIsDataLoaded(true);
   }, [pagesData, hasNextPage, spaceId]);
 
@@ -183,7 +181,7 @@ export default function SpaceTree({ spaceId, readOnly }: SpaceTreeProps) {
   );
 
   const filteredData = useMemo(
-    () => data.filter((node) => node?.spaceId === spaceId),
+    () => spaceRoots(data, spaceId),
     [data, spaceId],
   );
 
```

**File**: `apps/client/src/features/page/tree/hooks/use-tree-mutation.ts` (modified, +13/-5)
```diff
@@ -7,6 +7,10 @@ import { useNavigate, useParams } from "react-router-dom";
 import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
 import { treeModel } from "@/features/page/tree/model/tree-model";
 import type { DropOp } from "@/features/page/tree/model/tree-model.types";
+import {
+  spaceRoots,
+  updateSpaceRoots,
+} from "@/features/page/tree/utils/utils.ts";
 import { dropOpToMovePayload } from "./drop-op-to-move-payload";
 import { SpaceTreeNode } from "@/features/page/tree/types.ts";
 import { IPage } from "@/features/page/types/page.types.ts";
@@ -45,7 +49,7 @@ export function useTreeMutation(spaceId: string): UseTreeMutation {
 
   const handleMove = useCallback(
     async (sourceId: string, op: DropOp) => {
-      const before = store.get(treeDataAtom);
+      const before = spaceRoots(store.get(treeDataAtom), spaceId);
       const { tree: after, result } = treeModel.move(before, sourceId, op);
       if (after === before) return;
 
@@ -80,12 +84,12 @@ export function useTreeMutation(spaceId: string): UseTreeMutation {
         } as Partial<SpaceTreeNode>);
       }
 
-      setData(optimistic);
+      setData((prev) => updateSpaceRoots(prev, spaceId, () => optimistic));
 
       try {
         await movePageMutation.mutateAsync(payload);
       } catch {
-        setData(before);
+        setData((prev) => updateSpaceRoots(prev, spaceId, () => before));
         notifications.show({
           message: t("Failed to move page"),
           color: "red",
@@ -157,7 +161,7 @@ export function useTreeMutation(spaceId: string): UseTreeMutation {
       // tree (e.g. lazy-load children on expand) immediately before calling
       // handleCreate hit a stale closure and compute lastIndex against the
       // pre-load tree, requiring a setTimeout-based wait at the call site.
-      const current = store.get(treeDataAtom);
+      const current = spaceRoots(store.get(treeDataAtom), spaceId);
       let lastIndex: number;
       if (parentId === null) {
         lastIndex = current.length;
@@ -166,7 +170,11 @@ export function useTreeMutation(spaceId: string): UseTreeMutation {
         lastIndex = parent?.children?.length ?? 0;
       }
 
-      setData((prev) => treeModel.insert(prev, parentId, newNode, lastIndex));
+      setData((prev) =>
+        updateSpaceRoots(prev, spaceId, (roots) =>
+          treeModel.insert(roots, parentId, newNode, lastIndex),
+        ),
+      );
 
       setTimeout(() => {
         emit({
```

**File**: `apps/client/src/features/page/tree/utils/utils.ts` (modified, +18/-0)
```diff
@@ -220,3 +220,21 @@ export function mergeRootTrees(
 
   return sortPositionKeys(merged);
 }
+
+export function spaceRoots(
+  tree: SpaceTreeNode[],
+  spaceId: string,
+): SpaceTreeNode[] {
+  return tree.filter((node) => node?.spaceId === spaceId);
+}
+
+export function updateSpaceRoots(
+  tree: SpaceTreeNode[],
+  spaceId: string,
+  update: (roots: SpaceTreeNode[]) => SpaceTreeNode[],
+): SpaceTreeNode[] {
+  const roots = spaceRoots(tree, spaceId);
+  const next = update(roots);
+  if (next === roots) return tree;
+  return [...tree.filter((node) => node?.spaceId !== spaceId), ...next];
+}
```

**File**: `apps/client/src/features/websocket/use-tree-socket.ts` (modified, +55/-50)
```diff
@@ -6,6 +6,7 @@ import { WebSocketEvent } from "@/features/websocket/types";
 import { SpaceTreeNode } from "@/features/page/tree/types.ts";
 import { useQueryClient } from "@tanstack/react-query";
 import { treeModel } from "@/features/page/tree/model/tree-model";
+import { updateSpaceRoots } from "@/features/page/tree/utils/utils.ts";
 import localEmitter from "@/lib/local-emitter.ts";
 
 export const useTreeSocket = () => {
@@ -61,65 +62,69 @@ export const useTreeSocket = () => {
           setTreeData((prev) => {
             if (treeModel.find(prev, event.payload.data.id)) return prev;
             const newParentId = event.payload.parentId as string | null;
-            let next = treeModel.insert(
-              prev,
-              newParentId,
-              event.payload.data,
-              event.payload.index,
-            );
-            // Mirror the emitter: flip new parent's hasChildren to true so
-            // the chevron renders on the receiver.
-            if (newParentId) {
-              next = treeModel.update(next, newParentId, {
-                hasChildren: true,
-              } as Partial<SpaceTreeNode>);
-            }
-            return next;
+            return updateSpaceRoots(prev, event.spaceId, (roots) => {
+              let next = treeModel.insert(
+                roots,
+                newParentId,
+                event.payload.data,
+                event.payload.index,
+              );
+              // Mirror the emitter: flip new parent's hasChildren to true so
+              // the chevron renders on the receiver.
+              if (newParentId) {
+                next = treeModel.update(next, newParentId, {
+                  hasChildren: true,
+                } as Partial<SpaceTreeNode>);
+              }
+              return next;
+            });
           });
           break;
         case "moveTreeNode":
-          setTreeData((prev) => {
-            const sourceBefore = treeModel.find(prev, event.payload.id);
-            if (!sourceBefore) return prev;
-            const oldParentId =
-              (sourceBefore as SpaceTreeNode).parentPageId ?? null;
-            const newParentId = event.payload.parentId as string | null;
+          setTreeData((prev) =>
+            updateSpaceRoots(prev, event.spaceId, (roots) => {
+              const sourceBefore = treeModel.find(roots, event.payload.id);
+              if (!sourceBefore) return roots;
+              const oldParentId =
+                (sourceBefore as SpaceTreeNode).parentPageId ?? null;
+              const newParentId = event.payload.parentId as string | null;
 
-            const placed = treeModel.place(prev, event.payload.id, {
-              parentId: newParentId,
-              index: event.payload.index,
-            });
-            // `place` silently returns the same reference if the destination
-            // parent isn't loaded on this client. Falling back to removing the
-            // source keeps the UI consistent (the source will reappear when
-            // the user expands the new parent and lazy-load fetches it).
-            if (placed === prev) {
-              return treeModel.remove(prev, event.payload.id);
-            }
+              const placed = treeModel.place(roots, event.payload.id, {
+                parentId: newParentId,
+                index: event.payload.index,
+              });
+              // `place` silently returns the same reference if the destination
+              // parent isn't loaded on this client. Falling back to removing the
+              // source keeps the UI consistent (the source will reappear when
+              // the user expands the new parent and lazy-load fetches it).
+              if (placed === roots) {
+                return treeModel.remove(roots, event.payload.id);
+              }
 
-            let next = treeModel.update(placed, event.payload.id, {
-              position: event.payload.position,
-              parentPageId: newParentId,
-            } as Partial<SpaceTreeNode>);
+              let next = treeModel.update(placed, event.payload.id, {
+                position: event.payload.position,
+                parentPageId: newParentId,
+              } as Partial<SpaceTreeNode>);
 
-            // Mirror the emitter's hasChildren bookkeeping so both clients
-            // converge to the same chevron state.
-            if (oldParentId) {
-              const oldParent = treeModel.find(next, oldParentId);
-              if (!oldParent?.children?.length) {
-                next = treeModel.update(next, oldParentId, {
-                  hasChildren: false,
+              // Mirror the emitter's hasChildren bookkeeping so both clients
+              // converge to the same chevron state.
+              if (oldParentId) {
+                const oldParent = treeModel.find(next, oldParentId);
+                if (!oldParent?.children?.length) {
+                  next = treeModel.update(next, oldParentId, 
```

---

### Incident Patch 9: `dfc38c87` (2026-09-08)
**Commit Message**: fix: ws relay (#2482)

**File**: `apps/server/src/ws/ws.service.ts` (modified, +15/-0)
```diff
@@ -3,6 +3,8 @@ import { CACHE_MANAGER } from '@nestjs/cache-manager';
 import { Cache } from 'cache-manager';
 import { Server, Socket } from 'socket.io';
 import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
+import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
+import { SpaceRole } from '../common/helpers/types/permission';
 import {
   TREE_EVENTS,
   WS_SPACE_RESTRICTION_CACHE_PREFIX,
@@ -18,6 +20,7 @@ export class WsService {
   constructor(
     private readonly pagePermissionRepo: PagePermissionRepo,
     @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
+    private readonly spaceMemberRepo: SpaceMemberRepo,
   ) {}
 
   setServer(server: Server): void {
@@ -31,6 +34,18 @@ export class WsService {
       return;
     }
 
+    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
+      client.data.userId,
+      data.spaceId,
+    );
+    const canPublish = userSpaceRoles?.some(
+      ({ role }) => role === SpaceRole.ADMIN || role === SpaceRole.WRITER,
+    );
+
+    if (!canPublish) {
+      return;
+    }
+
     if (data.operation === 'refetchRootTreeNodeEvent') {
       client.broadcast.to(room).emit('message', data);
       return;
```

---

### Incident Patch 10: `7c368c86` (2026-09-08)
**Commit Message**: fix: h1 heading weight in editor (#2481)

* fix: h1 heading weight in editor
* cleanup

**File**: `apps/client/src/features/public-space/components/docs/docs.module.css` (modified, +4/-10)
```diff
@@ -15,8 +15,6 @@
   --docs-accent: #2b7af1;
   --docs-accent-soft: color-mix(in srgb, var(--docs-accent) 10%, transparent);
 
-  /* Cloudflare-style single-ink model: one foreground for headings, bold, and
-   * body on a just-off-white page; neither end of the scale is pure. */
   --docs-bg: oklch(99% 0 0);
   --docs-fg: oklch(21% 0 0);
   --docs-content-fg: var(--docs-fg);
@@ -410,7 +408,7 @@
   }
 }
 
-/* Expanded parents read as section headers, Cloudflare-style. */
+/* Expanded parents read as section headers. */
 .treeRow[data-open-parent="true"] {
   color: var(--docs-fg);
   font-weight: 500;
@@ -543,8 +541,6 @@
   }
 }
 
-/* ---------- Sidebar branding experiments (GitBook card / ReadMe line) ---------- */
-
 /* ---------- Footer branding ---------- */
 
 .footer {
@@ -773,13 +769,11 @@
   color: inherit;
 }
 
-/* Modest semibold heading scale (Cloudflare-style); class doubled to outrank
- * the shared editor and .public-typography rules. */
 .root.root :global(.ProseMirror) h1 {
-  font-size: 2.1875rem;
+  font-size: 1.75rem;
   font-weight: 600;
-  letter-spacing: -0.025em;
-  line-height: 1.25;
+  letter-spacing: -0.02em;
+  line-height: 1.3;
 }
 
 .root.root :global(.ProseMirror) h2 {
```

---

### Incident Patch 11: `5792fc7c` (2026-09-08)
**Commit Message**: fix: db lock operations (#2479)

* fix: advisory lock for page move

* fix: lock role count check

**File**: `apps/server/src/core/page/services/page.service.ts` (modified, +99/-53)
```diff
@@ -1,5 +1,6 @@
 import {
   BadRequestException,
+  ConflictException,
   Injectable,
   Logger,
   NotFoundException,
@@ -20,7 +21,7 @@ import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
 import { MovePageDto } from '../dto/move-page.dto';
 import { generateSlugId } from '../../../common/helpers';
 import { getPageTitle } from '../../../common/helpers';
-import { executeTx } from '@docmost/db/utils';
+import { dbOrTx, executeTx } from '@docmost/db/utils';
 import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
 import { v7 as uuid7 } from 'uuid';
 import {
@@ -174,10 +175,14 @@ export class PageService {
     return page;
   }
 
-  async nextPagePosition(spaceId: string, parentPageId?: string) {
+  async nextPagePosition(
+    spaceId: string,
+    parentPageId?: string,
+    trx?: KyselyTransaction,
+  ) {
     let pagePosition: string;
 
-    const lastPageQuery = this.db
+    const lastPageQuery = dbOrTx(this.db, trx)
       .selectFrom('pages')
       .select(['position'])
       .where('spaceId', '=', spaceId)
@@ -391,35 +396,46 @@ export class PageService {
   }
 
   async movePageToSpace(rootPage: Page, spaceId: string, userId: string) {
-    let childPageIds: string[] = [];
+    return executeTx(this.db, async (trx) => {
+      await this.pageRepo.lockPageHierarchySpaces(
+        [rootPage.spaceId, spaceId],
+        trx,
+      );
 
-    const allPages = await this.pageRepo.getPageAndDescendants(rootPage.id, {
-      includeContent: false,
-    });
+      const currentRootPage = await this.pageRepo.findById(rootPage.id, {
+        trx,
+      });
+      if (!currentRootPage || currentRootPage.deletedAt) {
+        throw new NotFoundException('Page to move not found');
+      }
+      if (currentRootPage.spaceId !== rootPage.spaceId) {
+        throw new ConflictException('Page location changed; retry the move');
+      }
 
-    // Filter to only accessible pages while maintaining tree integrity
-    const accessiblePages = await this.filterAccessibleTreePages(
-      allPages,
-      rootPage.id,
-      userId,
-      rootPage.spaceId,
-    );
-    const accessibleIds = new Set(accessiblePages.map((p) => p.id));
-
-    // Find inaccessible pages whose parent is being moved - these need to be orphaned
-    const pagesToOrphan = allPages.filter(
-      (p) =>
-        !accessibleIds.has(p.id) &&
-        p.parentPageId &&
-        accessibleIds.has(p.parentPageId),
-    );
+      const allPages = await this.pageRepo.getPageAndDescendants(
+        currentRootPage.id,
+        { includeContent: false, trx },
+      );
+      const accessiblePages = await this.filterAccessibleTreePages(
+        allPages,
+        currentRootPage.id,
+        userId,
+        currentRootPage.spaceId,
+      );
+      const accessibleIds = new Set(accessiblePages.map((p) => p.id));
+      const pagesToOrphan = allPages.filter(
+        (p) =>
+          !accessibleIds.has(p.id) &&
+          p.parentPageId &&
+          accessibleIds.has(p.parentPageId),
+      );
 
-    await executeTx(this.db, async (trx) => {
       // Orphan inaccessible child pages (make them root pages in original space)
       for (const page of pagesToOrphan) {
         const orphanPosition = await this.nextPagePosition(
-          rootPage.spaceId,
+          currentRootPage.spaceId,
           null,
+          trx,
         );
         await this.pageRepo.updatePage(
           { parentPageId: null, position: orphanPosition },
@@ -429,16 +445,18 @@ export class PageService {
       }
 
       // Update root page
-      const nextPosition = await this.nextPagePosition(spaceId);
+      const nextPosition = await this.nextPagePosition(spaceId, null, trx);
       await this.pageRepo.updatePage(
         { spaceId, parentPageId: null, position: nextPosition },
-        rootPage.id,
+        currentRootPage.id,
         trx,
       );
 
       const pageIdsToMove = accessiblePages.map((p) => p.id);
 
-      childPageIds = pageIdsToMove.filter((id) => id !== rootPage.id);
+      const childPageIds = pageIdsToMove.filter(
+        (id) => id !== currentRootPage.id,
+      );
 
       if (pageIdsToMove.length > 1) {
         // Update sub pages (all accessible pages except root)
@@ -501,7 +519,7 @@ export class PageService {
           {
             pageIds: pageIdsToMove,
             spaceId,
-            workspaceId: rootPage.workspaceId,
+            workspaceId: currentRootPage.workspaceId,
           },
           {
             attempts: 2,
@@ -512,9 +530,9 @@ export class PageService {
           },
         );
       }
-    });
 
-    return { childPageIds };
+      return { childPageIds };
+    });
   }
 
   async duplicatePage(
@@ -825,31 +843,59 @@ export class PageService {
       throw new BadRequestException('A page cannot be its own parent');
     }
 
-    let parentPageId = null;
-    if (movedPage.parentPageId === dto.parentPageId) {
-      parentPageId = undefined;
-    } else {
-  
```

**File**: `apps/server/src/core/space/services/space-member.service.ts` (modified, +67/-66)
```diff
@@ -10,7 +10,7 @@ import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
 import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
 import { AddSpaceMembersDto } from '../dto/add-space-members.dto';
 import { InjectKysely } from 'nestjs-kysely';
-import { Space, SpaceMember, User } from '@docmost/db/types/entity.types';
+import { Space, User } from '@docmost/db/types/entity.types';
 import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
 import { RemoveSpaceMemberDto } from '../dto/remove-space-member.dto';
 import { UpdateSpaceMemberRoleDto } from '../dto/update-space-member-role.dto';
@@ -218,41 +218,18 @@ export class SpaceMemberService {
     dto: RemoveSpaceMemberDto,
     workspaceId: string,
   ): Promise<void> {
-    const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
-    if (!space) {
-      throw new NotFoundException('Space not found');
-    }
+    const memberTypeId = dto.userId
+      ? { userId: dto.userId }
+      : dto.groupId
+        ? { groupId: dto.groupId }
+        : null;
 
-    let spaceMember: SpaceMember = null;
-
-    if (dto.userId) {
-      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
-        dto.spaceId,
-        {
-          userId: dto.userId,
-        },
-      );
-    } else if (dto.groupId) {
-      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
-        dto.spaceId,
-        {
-          groupId: dto.groupId,
-        },
-      );
-    } else {
+    if (!memberTypeId) {
       throw new BadRequestException(
         'Please provide a valid userId or groupId to remove',
       );
     }
 
-    if (!spaceMember) {
-      throw new NotFoundException('Space membership not found');
-    }
-
-    if (spaceMember.role === SpaceRole.ADMIN) {
-      await this.validateLastAdmin(dto.spaceId);
-    }
-
     let affectedUserIds: string[] = [];
     if (dto.userId) {
       affectedUserIds = [dto.userId];
@@ -262,7 +239,29 @@ export class SpaceMemberService {
       );
     }
 
-    await executeTx(this.db, async (trx) => {
+    const { space, spaceMember } = await executeTx(this.db, async (trx) => {
+      const space = await this.spaceRepo.findById(
+        dto.spaceId,
+        workspaceId,
+        { withLock: true, trx },
+      );
+      if (!space) {
+        throw new NotFoundException('Space not found');
+      }
+
+      const spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
+        dto.spaceId,
+        memberTypeId,
+        trx,
+      );
+      if (!spaceMember) {
+        throw new NotFoundException('Space membership not found');
+      }
+
+      if (spaceMember.role === SpaceRole.ADMIN) {
+        await this.validateLastAdmin(dto.spaceId, trx);
+      }
+
       await this.spaceMemberRepo.removeSpaceMemberById(
         spaceMember.id,
         dto.spaceId,
@@ -280,6 +279,8 @@ export class SpaceMemberService {
         dto.spaceId,
         { trx },
       );
+
+      return { space, spaceMember };
     });
 
     this.auditService.log({
@@ -304,48 +305,40 @@ export class SpaceMemberService {
     dto: UpdateSpaceMemberRoleDto,
     workspaceId: string,
   ): Promise<void> {
-    const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
-    if (!space) {
-      throw new NotFoundException('Space not found');
-    }
-
-    let spaceMember: SpaceMember = null;
+    const memberTypeId = dto.userId
+      ? { userId: dto.userId }
+      : dto.groupId
+        ? { groupId: dto.groupId }
+        : null;
 
-    if (dto.userId) {
-      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
-        dto.spaceId,
-        {
-          userId: dto.userId,
-        },
-      );
-    } else if (dto.groupId) {
-      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
-        dto.spaceId,
-        {
-          groupId: dto.groupId,
-        },
-      );
-    } else {
+    if (!memberTypeId) {
       throw new BadRequestException(
         'Please provide a valid userId or groupId to remove',
       );
     }
 
-    if (!spaceMember) {
-      throw new NotFoundException('Space membership not found');
-    }
+    const result = await executeTx(this.db, async (trx) => {
+      const space = await this.spaceRepo.findById(
+        dto.spaceId,
+        workspaceId,
+        { withLock: true, trx },
+      );
+      if (!space) {
+        throw new NotFoundException('Space not found');
+      }
 
-    if (spaceMember.role === dto.role) {
-      return;
-    }
+      const spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
+        dto.spaceId,
+        memberTypeId,
+        trx,
+      );
+      if (!spaceMember) {
+        throw new NotFoundException('Space membership not found');
+      }
 
-    await executeTx(this.db, async (trx) => {
-      await trx
-        .selectFrom('spaces')
-        .select('id')
-        .where('id', '=', dto.spaceId)
-        .forUpdate()
-        .executeTakeFirst();
+      if (s
```

**File**: `apps/server/src/core/workspace/services/workspace.service.ts` (modified, +113/-76)
```diff
@@ -747,44 +747,61 @@ export class WorkspaceService {
     userRoleDto: UpdateWorkspaceUserRoleDto,
     workspaceId: string,
   ) {
-    const user = await this.userRepo.findById(userRoleDto.userId, workspaceId);
-
     const newRole = userRoleDto.role.toLowerCase();
+    const result = await executeTx(this.db, async (trx) => {
+      const workspace = await this.workspaceRepo.findById(workspaceId, {
+        withLock: true,
+        trx,
+      });
+      if (!workspace) {
+        throw new NotFoundException('Workspace not found');
+      }
 
-    if (!user) {
-      throw new BadRequestException('Workspace member not found');
-    }
+      const user = await this.userRepo.findById(
+        userRoleDto.userId,
+        workspaceId,
+        { trx },
+      );
+      if (!user) {
+        throw new BadRequestException('Workspace member not found');
+      }
 
-    // prevent ADMIN from managing OWNER role
-    if (
-      isAdminActingOnOwner(authUser.role, newRole) ||
-      isAdminActingOnOwner(authUser.role, user.role)
-    ) {
-      throw new ForbiddenException();
-    }
+      if (
+        isAdminActingOnOwner(authUser.role, newRole) ||
+        isAdminActingOnOwner(authUser.role, user.role)
+      ) {
+        throw new ForbiddenException();
+      }
 
-    if (user.role === newRole) {
-      return user;
-    }
+      if (user.role === newRole) {
+        return { changed: false, user };
+      }
 
-    const workspaceOwnerCount = await this.userRepo.roleCountByWorkspaceId(
-      UserRole.OWNER,
-      workspaceId,
-    );
+      if (
+        user.role === UserRole.OWNER &&
+        !user.deletedAt &&
+        !user.deactivatedAt
+      ) {
+        await this.validateLastWorkspaceOwner(workspaceId, trx);
+      }
 
-    if (user.role === UserRole.OWNER && workspaceOwnerCount === 1) {
-      throw new BadRequestException(
-        'There must be at least one workspace owner',
+      await this.userRepo.updateUser(
+        {
+          role: newRole,
+        },
+        user.id,
+        workspaceId,
+        trx,
       );
+
+      return { changed: true, user };
+    });
+
+    if (!result.changed) {
+      return result.user;
     }
 
-    await this.userRepo.updateUser(
-      {
-        role: newRole,
-      },
-      user.id,
-      workspaceId,
-    );
+    const { user } = result;
 
     this.auditService.log({
       event: AuditEvent.USER_ROLE_CHANGED,
@@ -848,47 +865,47 @@ export class WorkspaceService {
     userId: string,
     workspaceId: string,
   ): Promise<void> {
-    const user = await this.userRepo.findById(userId, workspaceId);
-
-    if (!user || user.deletedAt) {
-      throw new BadRequestException('Workspace member not found');
-    }
-
-    if (user.deactivatedAt) {
-      throw new BadRequestException('User is already deactivated');
-    }
+    const user = await executeTx(this.db, async (trx) => {
+      const workspace = await this.workspaceRepo.findById(workspaceId, {
+        withLock: true,
+        trx,
+      });
+      if (!workspace) {
+        throw new NotFoundException('Workspace not found');
+      }
 
-    if (authUser.id === userId) {
-      throw new BadRequestException('You cannot deactivate yourself');
-    }
+      const user = await this.userRepo.findById(userId, workspaceId, { trx });
+      if (!user || user.deletedAt) {
+        throw new BadRequestException('Workspace member not found');
+      }
 
-    if (isAdminActingOnOwner(authUser.role, user.role)) {
-      throw new BadRequestException(
-        'You cannot deactivate a user with owner role',
-      );
-    }
+      if (user.deactivatedAt) {
+        throw new BadRequestException('User is already deactivated');
+      }
 
-    if (user.role === UserRole.OWNER) {
-      const workspaceOwnerCount = await this.userRepo.roleCountByWorkspaceId(
-        UserRole.OWNER,
-        workspaceId,
-      );
+      if (authUser.id === userId) {
+        throw new BadRequestException('You cannot deactivate yourself');
+      }
 
-      if (workspaceOwnerCount === 1) {
+      if (isAdminActingOnOwner(authUser.role, user.role)) {
         throw new BadRequestException(
-          'There must be at least one workspace owner',
+          'You cannot deactivate a user with owner role',
         );
       }
-    }
 
-    await executeTx(this.db, async (trx) => {
+      if (user.role === UserRole.OWNER) {
+        await this.validateLastWorkspaceOwner(workspaceId, trx);
+      }
+
       await this.userRepo.updateUser(
         { deactivatedAt: new Date() },
         userId,
         workspaceId,
         trx,
       );
       await this.userSessionRepo.revokeByUserId(userId, workspaceId, trx);
+
+      return user;
     });
 
     this.auditService.log({
@@ -951,32 +968,34 @@ export class WorkspaceService {
     userId: string,
     workspaceId: string,
   ): Promise<void> {
-    const user = await this.userRepo.findById(userId, workspaceId);
-
-    if (!user || user.deletedAt) {
-      throw new BadReq
```

**File**: `apps/server/src/database/repos/page/page.repo.ts` (modified, +48/-2)
```diff
@@ -161,6 +161,22 @@ export class PageRepo {
     return result;
   }
 
+  async lockPageHierarchySpaces(
+    spaceIds: string[],
+    trx: KyselyTransaction,
+  ): Promise<void> {
+    const sortedSpaceIds = [...new Set(spaceIds)].sort();
+
+    for (const spaceId of sortedSpaceIds) {
+      await sql`
+        SELECT pg_advisory_xact_lock(
+          hashtext('page-hierarchy'),
+          hashtext(${spaceId})
+        )
+      `.execute(trx);
+    }
+  }
+
   async insertPage(
     insertablePage: InsertablePage,
     trx?: KyselyTransaction,
@@ -489,9 +505,9 @@ export class PageRepo {
 
   async getPageAndDescendants(
     parentPageId: string,
-    opts: { includeContent: boolean },
+    opts: { includeContent: boolean; trx?: KyselyTransaction },
   ) {
-    return this.db
+    return dbOrTx(this.db, opts.trx)
       .withRecursive('page_hierarchy', (db) =>
         db
           .selectFrom('pages')
@@ -535,6 +551,36 @@ export class PageRepo {
       .execute();
   }
 
+  async isPageDescendant(
+    ancestorPageId: string,
+    descendantPageId: string,
+    trx?: KyselyTransaction,
+  ): Promise<boolean> {
+    const result = await dbOrTx(this.db, trx)
+      .withRecursive('page_ancestors', (db) =>
+        db
+          .selectFrom('pages')
+          .select(['id', 'parentPageId'])
+          .where('id', '=', descendantPageId)
+          .union((exp) =>
+            exp
+              .selectFrom('pages as parent')
+              .select(['parent.id', 'parent.parentPageId'])
+              .innerJoin(
+                'page_ancestors as ancestor',
+                'ancestor.parentPageId',
+                'parent.id',
+              ),
+          ),
+      )
+      .selectFrom('page_ancestors')
+      .select('id')
+      .where('id', '=', ancestorPageId)
+      .executeTakeFirst();
+
+    return Boolean(result);
+  }
+
   /**
    * Get page and all descendants, excluding restricted pages and their subtrees.
    * More efficient than getPageAndDescendants + filtering because:
```

**File**: `apps/server/src/database/repos/space/space.repo.ts` (modified, +10/-1)
```diff
@@ -25,7 +25,11 @@ export class SpaceRepo {
   async findById(
     spaceId: string,
     workspaceId: string,
-    opts?: { includeMemberCount?: boolean; trx?: KyselyTransaction },
+    opts?: {
+      includeMemberCount?: boolean;
+      withLock?: boolean;
+      trx?: KyselyTransaction;
+    },
   ): Promise<Space> {
     const db = dbOrTx(this.db, opts?.trx);
 
@@ -41,6 +45,11 @@ export class SpaceRepo {
     } else {
       query = query.where(sql`LOWER(slug)`, '=', sql`LOWER(${spaceId})`);
     }
+
+    if (opts?.withLock && opts?.trx) {
+      query = query.forUpdate();
+    }
+
     return query.executeTakeFirst();
   }
 
```

**File**: `apps/server/src/database/repos/user/user.repo.ts` (modified, +5/-1)
```diff
@@ -145,12 +145,16 @@ export class UserRepo {
   async roleCountByWorkspaceId(
     role: string,
     workspaceId: string,
+    trx?: KyselyTransaction,
   ): Promise<number> {
-    const { count } = await this.db
+    const db = dbOrTx(this.db, trx);
+    const { count } = await db
       .selectFrom('users')
       .select((eb) => eb.fn.count('role').as('count'))
       .where('role', '=', role)
       .where('workspaceId', '=', workspaceId)
+      .where('deletedAt', 'is', null)
+      .where('deactivatedAt', 'is', null)
       .executeTakeFirst();
 
     return count as number;
```

---

### Incident Patch 12: `94907274` (2026-09-08)
**Commit Message**: fix: align input shortcuts (#2467)

* align input shortcuts

* minor fix

* minor fix

**File**: `apps/client/src/ee/base/components/row-detail-modal/fields/detail-field.tsx` (modified, +4/-1)
```diff
@@ -18,6 +18,7 @@ export type FieldProps = {
   rowId: string;
   readOnly: boolean;
   onChange: (value: unknown) => void;
+  onEditingChange?: (editing: boolean) => void;
 };
 
 type FieldShellProps = {
@@ -99,9 +100,10 @@ type DetailFieldProps = {
   row: IBaseRow;
   readOnly: boolean;
   onUpdate: (propertyId: string, value: unknown) => void;
+  onEditingChange: (editing: boolean) => void;
 };
 
-export function DetailField({ property, row, readOnly, onUpdate }: DetailFieldProps) {
+export function DetailField({ property, row, readOnly, onUpdate, onEditingChange }: DetailFieldProps) {
   const descriptor = getDescriptor(property.type);
   const value = descriptor?.systemAccessor
     ? descriptor.systemAccessor(row)
@@ -112,6 +114,7 @@ export function DetailField({ property, row, readOnly, onUpdate }: DetailFieldPr
     rowId: row.id,
     readOnly,
     onChange: (next: unknown) => onUpdate(property.id, next),
+    onEditingChange
   };
 
   switch (property.type) {
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/fields/field-long-text.tsx` (modified, +12/-2)
```diff
@@ -9,7 +9,13 @@ const normalize = (s: string) => {
   return trimmed.length ? trimmed : null;
 };
 
-export function FieldLongText({ property, value, readOnly, onChange }: FieldProps) {
+export function FieldLongText({
+  property,
+  value,
+  readOnly,
+  onChange,
+  onEditingChange,
+}: FieldProps) {
   const text = toText(value);
   const [draft, setDraft] = useState(text);
   const [focused, setFocused] = useState(false);
@@ -23,6 +29,7 @@ export function FieldLongText({ property, value, readOnly, onChange }: FieldProp
 
   const commit = () => {
     setFocused(false);
+    onEditingChange?.(false);
     if (cancelRef.current) {
       cancelRef.current = false;
       setDraft(text);
@@ -50,7 +57,10 @@ export function FieldLongText({ property, value, readOnly, onChange }: FieldProp
         className={classes.fieldTextarea}
         classNames={{ input: classes.fieldTextareaInput }}
         value={draft}
-        onFocus={() => setFocused(true)}
+        onFocus={() => {
+          setFocused(true);
+          onEditingChange?.(true);
+        }}
         onChange={(e) => setDraft(e.currentTarget.value)}
         onBlur={commit}
         onKeyDown={(e) => {
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/fields/field-number.tsx` (modified, +9/-1)
```diff
@@ -11,7 +11,13 @@ import classes from "@/ee/base/styles/row-detail-modal.module.css";
 const toDraft = (value: unknown) =>
   typeof value === "number" ? String(value) : "";
 
-export function FieldNumber({ property, value, readOnly, onChange }: FieldProps) {
+export function FieldNumber({
+  property,
+  value,
+  readOnly,
+  onChange,
+  onEditingChange,
+}: FieldProps) {
   const typeOptions = property.typeOptions as NumberTypeOptions | undefined;
   const numValue = typeof value === "number" ? value : null;
   const [draft, setDraft] = useState(toDraft(value));
@@ -36,6 +42,7 @@ export function FieldNumber({ property, value, readOnly, onChange }: FieldProps)
 
   const commit = () => {
     setFocused(false);
+    onEditingChange?.(false);
     if (cancelRef.current) {
       cancelRef.current = false;
       setDraft(toDraft(value));
@@ -54,6 +61,7 @@ export function FieldNumber({ property, value, readOnly, onChange }: FieldProps)
         onFocus={() => {
           setDraft(toDraft(value));
           setFocused(true);
+          onEditingChange?.(true);
         }}
         onChange={(e) => {
           const v = e.target.value;
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/fields/field-text.tsx` (modified, +12/-2)
```diff
@@ -5,7 +5,13 @@ import classes from "@/ee/base/styles/row-detail-modal.module.css";
 
 const toText = (value: unknown) => (typeof value === "string" ? value : "");
 
-export function FieldText({ property, value, readOnly, onChange }: FieldProps) {
+export function FieldText({
+  property,
+  value,
+  readOnly,
+  onChange,
+  onEditingChange,
+}: FieldProps) {
   const text = toText(value);
   const [draft, setDraft] = useState(text);
   const [focused, setFocused] = useState(false);
@@ -20,6 +26,7 @@ export function FieldText({ property, value, readOnly, onChange }: FieldProps) {
 
   const commit = () => {
     setFocused(false);
+    onEditingChange?.(false);
     if (cancelRef.current) {
       cancelRef.current = false;
       setDraft(text);
@@ -54,7 +61,10 @@ export function FieldText({ property, value, readOnly, onChange }: FieldProps) {
         className={classes.fieldInput}
         value={draft}
         maxLength={1000}
-        onFocus={() => setFocused(true)}
+        onFocus={() => {
+          setFocused(true);
+          onEditingChange?.(true);
+        }}
         onChange={(e) => setDraft(e.currentTarget.value)}
         onBlur={commit}
         onKeyDown={(e) => {
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/property-row.tsx` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@ type PropertyRowProps = {
   onMenuOpenChange: (opened: boolean) => void;
   onMenuDirtyChange: (dirty: boolean) => void;
   onUpdate: (propertyId: string, value: unknown) => void;
+  onEditingChange?: (editing: boolean) => void;
   autoFocusValue?: boolean;
   onAutoFocused?: () => void;
 };
@@ -29,6 +30,7 @@ export function PropertyRow({
   onMenuOpenChange,
   onMenuDirtyChange,
   onUpdate,
+  onEditingChange,
   autoFocusValue,
   onAutoFocused,
 }: PropertyRowProps) {
@@ -112,6 +114,7 @@ export function PropertyRow({
         row={row}
         readOnly={!canEdit}
         onUpdate={onUpdate}
+        onEditingChange={onEditingChange}
       />
     </div>
   );
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/row-detail-modal.tsx` (modified, +32/-7)
```diff
@@ -75,6 +75,7 @@ export function RowDetailModal({
 
   const isSaving = updateRowMutation.isPending;
   const opened = !!openRowId;
+  const [editingField, setEditingField] = useState(false);
 
   // One field menu open at a time, mirroring the grid header's semantics.
   // The shared closeRequest atom asks an open dirty PropertyMenuContent to
@@ -90,6 +91,7 @@ export function RowDetailModal({
   useEffect(() => {
     setOpenMenuId(null);
     menuDirtyRef.current = false;
+    setEditingField(false);
   }, [openRowId]);
 
   const handleMenuDirtyChange = useCallback((dirty: boolean) => {
@@ -293,7 +295,7 @@ export function RowDetailModal({
             row={row}
             primaryProperty={primaryProperty}
             canEdit={canEdit}
-            onClose={onClose}
+            onEditingChange={setEditingField}
             onCommit={(value) => {
               if (!primaryProperty) return;
               updateRowMutation.mutate({
@@ -317,6 +319,7 @@ export function RowDetailModal({
                     autoFocusValue={property.id === newPropertyId}
                     onAutoFocused={clearNewProperty}
                     menuOpened={openMenuId === property.id}
+                    onEditingChange={setEditingField}
                     onMenuOpenChange={(nextOpened) =>
                       handleMenuOpenChange(property.id, nextOpened)
                     }
@@ -367,16 +370,38 @@ export function RowDetailModal({
               ) : null}
             </div>
             <div className={classes.kbdHint}>
-              {rowIndex >= 0 && rows.length > 1 && (
+              {editingField ? (
                 <>
-                  <kbd className={classes.kbd}>↑</kbd>
-                  <kbd className={classes.kbd}>↓</kbd>
-                  <span>{t("to navigate")}</span>
+                  <span className={classes.kbdGroup}>
+                    <kbd className={classes.kbd}>Ctrl/Cmd</kbd>
+                    <span className={classes.kbdPlus} >+</span>
+                    <kbd className={classes.kbd}>Enter</kbd>
+                    <span>{t("to save")}</span>
+                  </span>
+
                   <span className={classes.kbdSeparator} />
+
+                  <span className={classes.kbdGroup}>
+                    <kbd className={classes.kbd}>Esc</kbd>
+                    <span>{t("to reset")}</span>
+                  </span>
+                </>
+              ) : (
+                <>
+                  {rowIndex >= 0 && rows.length > 1 && (
+                    <>
+                      <kbd className={classes.kbd}>↑</kbd>
+                      <kbd className={classes.kbd}>↓</kbd>
+                      <span>{t("to navigate")}</span>
+                      <span className={classes.kbdSeparator} />
+                    </>
+                  )}
+                  <>
+                    <kbd className={classes.kbd}>Esc</kbd>
+                    <span>{t("to close")}</span>
+                  </>
                 </>
               )}
-              <kbd className={classes.kbd}>Esc</kbd>
-              <span>{t("to close")}</span>
             </div>
           </footer>
         </>
```

**File**: `apps/client/src/ee/base/components/row-detail-modal/row-detail-title.tsx` (modified, +23/-12)
```diff
@@ -1,4 +1,4 @@
-import { useEffect, useState } from "react";
+import { useEffect, useRef, useState } from "react";
 import { useTranslation } from "react-i18next";
 import { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";
 import { timeAgo } from "@/lib/time.ts";
@@ -9,21 +9,32 @@ type RowDetailTitleProps = {
   primaryProperty: IBaseProperty | undefined;
   canEdit: boolean;
   onCommit: (value: string) => void;
-  onClose: () => void;
+  onEditingChange?: (editing: boolean) => void;
 };
 
 export function RowDetailTitle({
   row,
   primaryProperty,
   canEdit,
   onCommit,
-  onClose,
+  onEditingChange,
 }: RowDetailTitleProps) {
   const { t } = useTranslation();
   const initial = primaryProperty
     ? (((row.cells ?? {})[primaryProperty.id] as string) ?? "")
     : "";
   const [value, setValue] = useState(initial);
+  const cancelRef = useRef(false);
+
+  const commit = () => {
+    onEditingChange?.(false);
+    if (cancelRef.current) {
+      cancelRef.current = false;
+      setValue(initial);
+      return;
+    }
+    if (value !== initial) onCommit(value);
+  };
 
   // Re-sync when the row changes underneath us (navigation or remote edit).
   useEffect(() => {
@@ -43,18 +54,18 @@ export function RowDetailTitle({
           aria-label={primaryProperty?.name ?? t("Untitled")}
           value={value}
           maxLength={1000}
-          onChange={(e) => setValue(e.currentTarget.value)}
-          onBlur={() => {
-            if (value !== initial) onCommit(value);
+          onFocus={() => {
+            onEditingChange?.(true);
           }}
+          onChange={(e) => setValue(e.currentTarget.value)}
+          onBlur={commit}
           onKeyDown={(e) => {
-            if (e.key === "Enter") {
-              e.preventDefault();
-              (e.currentTarget as HTMLInputElement).blur();
-            } else if (e.key === "Escape") {
+            if (e.key === "Escape") {
+              cancelRef.current = true;
+              e.currentTarget.blur();
+            } else if (e.key === "Enter") {
               e.preventDefault();
-              (e.currentTarget as HTMLInputElement).blur();
-              onClose();
+              e.currentTarget.blur();
             }
           }}
         />
```

**File**: `apps/client/src/ee/base/styles/row-detail-modal.module.css` (modified, +16/-0)
```diff
@@ -416,9 +416,25 @@
 }
 
 .kbdHint {
+  display: flex;
+  align-items: center;
+  justify-content: flex-end;
+  gap: 10px;
+  flex-wrap: wrap;
+  width: 100%;
+}
+
+.kbdGroup {
   display: inline-flex;
   align-items: center;
   gap: 6px;
+  white-space: nowrap;
+  height: fit-content;
+}
+
+.kbdPlus {
+  color: light-dark(var(--mantine-color-gray-5), var(--mantine-color-dark-3));
+  font-size: 11px;
 }
 
 .kbdSeparator {
```

---

### Incident Patch 13: `0a87db4f` (2026-09-07)
**Commit Message**: fix: meta title for shared subpages (#2478)

**File**: `apps/server/src/core/share/share-seo.controller.ts` (modified, +13/-8)
```diff
@@ -60,16 +60,21 @@ export class ShareSeoController {
 
       const pageId = this.extractPageSlugId(pageSlug);
 
-      const share = await this.shareService.getShareForPage(
-        pageId,
-        workspace.id,
-      );
-
-      if (!share) {
+      let title: string;
+      let searchIndexing = false;
+      try {
+        const shared = await this.shareService.getSharedPage(
+          { pageId },
+          workspace.id,
+          { includeContent: false },
+        );
+        title = shared.page.title;
+        searchIndexing = shared.share.searchIndexing;
+      } catch (err) {
         return this.sendIndex(indexFilePath, res);
       }
 
-      const rawTitle = htmlEscape(share?.sharedPage.title ?? 'untitled');
+      const rawTitle = htmlEscape(title ?? 'untitled');
       const metaTitle =
         rawTitle.length > 80 ? `${rawTitle.slice(0, 77)}…` : rawTitle;
 
@@ -78,7 +83,7 @@ export class ShareSeoController {
       const metaTags = [
         `<meta property="og:title" content="${metaTitle}" />`,
         `<meta property="twitter:title" content="${metaTitle}" />`,
-        !share.searchIndexing ? `<meta name="robots" content="noindex" />` : '',
+        !searchIndexing ? `<meta name="robots" content="noindex" />` : '',
       ]
         .filter(Boolean)
         .join('\n    ');
```

**File**: `apps/server/src/core/share/share.service.ts` (modified, +15/-6)
```diff
@@ -110,7 +110,11 @@ export class ShareService {
     }
   }
 
-  async getSharedPage(dto: ShareInfoDto, workspaceId: string) {
+  async getSharedPage(
+    dto: ShareInfoDto,
+    workspaceId: string,
+    opts?: { includeContent?: boolean },
+  ) {
     //TODO: we should resolve the page from the share id
     if (!dto.pageId) throw new NotFoundException('Shared page not found');
 
@@ -120,10 +124,13 @@ export class ShareService {
       throw new NotFoundException('Shared page not found');
     }
 
-    const page = await this.pageRepo.findById(dto.pageId, {
-      includeContent: true,
-      includeCreator: true,
-    });
+    const includeContent = opts?.includeContent !== false;
+    const page = includeContent
+      ? await this.pageRepo.findById(dto.pageId, {
+          includeContent: true,
+          includeCreator: true,
+        })
+      : await this.pageRepo.findById(dto.pageId);
 
     if (!page || page.deletedAt) {
       throw new NotFoundException('Shared page not found');
@@ -137,7 +144,9 @@ export class ShareService {
       throw new NotFoundException('Shared page not found');
     }
 
-    page.content = await this.updatePublicAttachments(page);
+    if (includeContent) {
+      page.content = await this.updatePublicAttachments(page);
+    }
 
     return { page, share };
   }
```

---

### Incident Patch 14: `89e27a1a` (2026-09-06)
**Commit Message**: fix(editor): allow gap cursors between top-level blocks (#2477)

**File**: `apps/client/src/features/editor/extensions/document.test.ts` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+import { Editor, Node } from "@tiptap/core";
+import { GapCursor } from "@tiptap/pm/gapcursor";
+import { NodeSelection, TextSelection } from "@tiptap/pm/state";
+import { StarterKit } from "@tiptap/starter-kit";
+import { describe, expect, it } from "vitest";
+import { TiptapDocument } from "./document";
+
+const Footnotes = Node.create({
+  name: "footnotes",
+  group: "",
+  content: "paragraph*",
+  isolating: true,
+  renderHTML() {
+    return ["ol", { class: "footnotes" }, 0];
+  },
+});
+
+const AtomBlock = Node.create({
+  name: "atomBlock",
+  group: "block",
+  atom: true,
+  renderHTML() {
+    return ["div", { "data-atom-block": "" }];
+  },
+});
+
+const IsolatingBlock = Node.create({
+  name: "isolatingBlock",
+  group: "block",
+  content: "paragraph+",
+  isolating: true,
+  renderHTML() {
+    return ["div", { "data-isolating-block": "" }, 0];
+  },
+});
+
+function createEditor(content: object[]) {
+  const element = document.createElement("div");
+  document.body.appendChild(element);
+
+  return new Editor({
+    element,
+    extensions: [
+      TiptapDocument,
+      StarterKit.configure({ document: false }),
+      Footnotes,
+      AtomBlock,
+      IsolatingBlock,
+    ],
+    content: { type: "doc", content },
+  });
+}
+
+function pressKey(editor: Editor, key: string, keyCode: number) {
+  editor.view.dom.dispatchEvent(
+    new KeyboardEvent("keydown", {
+      key,
+      keyCode,
+      bubbles: true,
+      cancelable: true,
+    }),
+  );
+}
+
+describe("TiptapDocument", () => {
+  it("stops on the gap when arrowing down from a selected block node", () => {
+    const editor = createEditor([
+      { type: "atomBlock" },
+      { type: "atomBlock" },
+      { type: "paragraph" },
+    ]);
+    const gapPos = editor.state.doc.child(0).nodeSize;
+    editor.view.dispatch(
+      editor.state.tr.setSelection(
+        NodeSelection.create(editor.state.doc, 0),
+      ),
+    );
+
+    pressKey(editor, "ArrowDown", 40);
+
+    expect(editor.state.selection).toBeInstanceOf(GapCursor);
+    expect(editor.state.selection.head).toBe(gapPos);
+
+    editor.destroy();
+  });
+
+  it("stops on the gap when arrowing right out of an isolating block", () => {
+    const paragraph = (text: string) => ({
+      type: "paragraph",
+      content: [{ type: "text", text }],
+    });
+    const editor = createEditor([
+      { type: "isolatingBlock", content: [paragraph("a")] },
+      { type: "isolatingBlock", content: [paragraph("b")] },
+      { type: "paragraph" },
+    ]);
+    const gapPos = editor.state.doc.child(0).nodeSize;
+    const endOfFirstText = gapPos - 2;
+    editor.view.dispatch(
+      editor.state.tr.setSelection(
+        TextSelection.create(editor.state.doc, endOfFirstText),
+      ),
+    );
+
+    pressKey(editor, "ArrowRight", 39);
+
+    expect(editor.state.selection).toBeInstanceOf(GapCursor);
+    expect(editor.state.selection.head).toBe(gapPos);
+
+    editor.destroy();
+  });
+});
```

**File**: `apps/client/src/features/editor/extensions/document.ts` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+import { Document } from "@tiptap/extension-document";
+
+// With `block+ footnotes?`, ProseMirror's defaultType after the first block is
+// `footnotes` (not a textblock), so GapCursor.valid() rejects every top-level gap.
+export const TiptapDocument = Document.extend({
+  content: "block+ footnotes?",
+  allowGapCursor: true,
+});
```

**File**: `apps/client/src/features/editor/extensions/extensions.ts` (modified, +2/-4)
```diff
@@ -1,6 +1,6 @@
 import { markInputRule } from "@tiptap/core";
 import { StarterKit } from "@tiptap/starter-kit";
-import { Document } from "@tiptap/extension-document";
+import { TiptapDocument } from "@/features/editor/extensions/document";
 import { Code } from "@tiptap/extension-code";
 import { TextAlign } from "@tiptap/extension-text-align";
 import { TaskList, TaskItem } from "@tiptap/extension-list";
@@ -148,9 +148,7 @@ export const mainExtensions = [
     codeBlock: false,
     code: false,
   }),
-  Document.extend({
-    content: "block+ footnotes?",
-  }),
+  TiptapDocument,
   // Override TipTap's Code extension to fix the inline code input rule.
   // The upstream regex /(^|[^`])`([^`]+)`(?!`)$/ captures the character
   // before the opening backtick as part of the match, causing markInputRule
```

---

### Incident Patch 15: `27fa9af9` (2026-09-05)
**Commit Message**: fix: public page print (#2476)

* fix pdf-print for public pages

* fix print in dark mode

**File**: `apps/client/src/features/public-space/components/docs/docs-shell.tsx` (modified, +41/-0)
```diff
@@ -25,6 +25,8 @@ import { SearchMobileControl } from "@/features/search/components/search-control
 import styles from "./docs.module.css";
 
 const MemoizedDocsSidebarTree = React.memo(DocsSidebarTree);
+const MANTINE_COLOR_SCHEME_ATTRIBUTE = "data-mantine-color-scheme";
+const DOCS_PRINT_COLOR_SCHEME_ATTRIBUTE = "data-docs-print-color-scheme";
 
 type DocsShellProps = {
   surface: DocsSurface;
@@ -47,6 +49,45 @@ export default function DocsShell({
   );
   const [mobileTocOpen, setMobileTocOpen] = useAtom(docsMobileTocAtom);
 
+  React.useEffect(() => {
+    const root = document.documentElement;
+    let previousColorScheme: string | null = null;
+    let isPrinting = false;
+
+    const restoreColorScheme = () => {
+      if (!isPrinting) return;
+
+      if (previousColorScheme === null) {
+        root.removeAttribute(MANTINE_COLOR_SCHEME_ATTRIBUTE);
+      } else {
+        root.setAttribute(MANTINE_COLOR_SCHEME_ATTRIBUTE, previousColorScheme);
+      }
+      root.removeAttribute(DOCS_PRINT_COLOR_SCHEME_ATTRIBUTE);
+      isPrinting = false;
+    };
+
+    const useLightPrintTheme = () => {
+      if (isPrinting) return;
+
+      previousColorScheme = root.getAttribute(MANTINE_COLOR_SCHEME_ATTRIBUTE);
+      root.setAttribute(
+        DOCS_PRINT_COLOR_SCHEME_ATTRIBUTE,
+        previousColorScheme ?? "light",
+      );
+      root.setAttribute(MANTINE_COLOR_SCHEME_ATTRIBUTE, "light");
+      isPrinting = true;
+    };
+
+    window.addEventListener("beforeprint", useLightPrintTheme);
+    window.addEventListener("afterprint", restoreColorScheme);
+
+    return () => {
+      window.removeEventListener("beforeprint", useLightPrintTheme);
+      window.removeEventListener("afterprint", restoreColorScheme);
+      restoreColorScheme();
+    };
+  }, []);
+
   return (
     <DocsSurfaceProvider value={surface}>
       <div className={clsx(styles.root, "public-typography")}>
```

**File**: `apps/client/src/features/public-space/components/docs/docs.module.css` (modified, +56/-0)
```diff
@@ -900,3 +900,59 @@
   display: flex;
   flex-direction: column;
 }
+
+/* ---------- Print ---------- */
+
+@page public-doc {
+  background-color: #fff;
+}
+
+/* Only the article prints; the body grid collapses so it takes the page width. */
+@media print {
+  :global(html):has(.root),
+  :global(body):has(.root) {
+    page: public-doc;
+    background-color: #fff !important;
+  }
+
+  :global(html[data-docs-print-color-scheme="dark"])
+    .root.root
+    :global(.codeBlock svg) {
+    filter: invert(1) hue-rotate(180deg);
+  }
+
+  .header,
+  .sidebar,
+  .toc,
+  .articleActions,
+  .breadcrumbs,
+  .pageNav,
+  .footer {
+    display: none !important;
+  }
+
+  .root {
+    --docs-bg: #fff;
+    --docs-fg: #1f1f1f;
+    --docs-content-fg: var(--docs-fg);
+    --docs-nav-fg: #495057;
+    --docs-muted: #5f6368;
+    --docs-hover: #f1f3f5;
+    --docs-faint: #868e96;
+    --docs-border: #dee2e6;
+    --docs-header-bg: #fff;
+
+    min-height: 0;
+    background-color: #fff;
+    color: var(--docs-fg);
+  }
+
+  .body {
+    display: block;
+  }
+
+  .article {
+    max-width: none;
+    padding: 0;
+  }
+}
```

#### Recent Merged Pull Requests:
- **PR #2541** (2026-10-05): fix(base): export CSV with the active view's filter (@Philipinho)
- **PR #2537** (2026-10-04): fix: throttle tracking bug (@Philipinho)
- **PR #2535** (closed): test/cd (@JingzeGuo)
- **PR #2533** (2026-09-30): fix: add markdown attribute to details blocks in markdown export (@Philipinho)
- **PR #2532** (2026-09-30): fix: preserve table header row in markdown export (@Philipinho)
- **PR #2531** (2026-09-30): fix: copy page labels when duplicating pages (@Philipinho)
- **PR #2530** (2026-09-30): fix: skip page update notifications for users viewing the page (@Philipinho)
- **PR #2529** (2026-09-29): fix search limit and performance (@Philipinho)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
