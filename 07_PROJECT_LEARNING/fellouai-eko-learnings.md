# Forensic Learning Record (Deep Inspection): FellouAI/eko

> **Canonical Artifact**: `07_PROJECT_LEARNING/fellouai-eko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FellouAI/eko](https://github.com/FellouAI/eko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:46:35.551Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FellouAI/eko`
- **Description**: Eko (Eko Keeps Operating) - Build Production-ready Agentic Workflow with Natural Language - eko.fellou.ai
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4958 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example/extension/src/background/agent/utils.ts`
```
import { Agent } from "@eko-ai/eko"
import { JSONSchema7, Tool } from "@eko-ai/eko/types"

export function wrapToolInputSchema(agent: Agent, tool: Tool) {
  switch (tool.name) {
    case 'watch_trigger':
    case 'human_interact':
    case 'task_node_status':
      return
  }
  const parameters: JSONSchema7 = tool.parameters
  if (parameters.type != 'object') {
    return
  }
  const agentDefalutPrompt: Record<string, string> = {
    Browser: `The user-side prompt, showing what you are doing, e.g. "Openning google.com." or "Click the search button"`,
  }
  // observation, thinking, userSidePrompt
  // observation: Your observation of the previous steps. Should start with "In the previous step, I\'ve ...".
  // thinking: Your thinking draft.
  // userSidePrompt: The user-side prompt, showing what you are doing, e.g. "Openning google.com."
  const properties = new Map()
  // properties.set("thinking", {
  //   type: "string",
  //   description: "Current thinking content, which can be analysis of the problem, assumptions, insights, reflections, or a summary of the previous, suggest the next action step to be taken, which should be specific, executable, and verifiable.",
  // });
  properties.set('userSidePrompt', {
    type: 'string',
    description:
      agentDefalutPrompt[agent.Name] || agentDefalutPrompt['Browser'],
  })
  Object.keys(parameters.properties as any).forEach(key =>
    properties.set(key, (parameters.properties as any)[key]),
  )
  parameters.properties = Object.fromEntries(properties)
  const required: string[] = parameters.required || []
  if (required.indexOf('userSidePrompt') == -1) {
    parameters.required = ['userSidePrompt', ...required]
    // parameters.required = ["thinking", "userSidePrompt", ...required];
  }
}
```

### Core Architecture Module: `example/extension/src/sidebar/MarkdownRenderer.tsx`
```
import React from "react";
import "katex/dist/katex.min.css";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  secondary?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  secondary = false,
}) => {
  if (!content) {
    return null;
  }
  return (
    <div 
      className="markdown-body"
      style={{
        color: secondary ? 'rgba(0, 0, 0, 0.45)' : undefined,
        opacity: secondary ? 0.85 : 1,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

```

### Core Architecture Module: `example/extension/src/sidebar/hooks/useChatCallbacks.ts`
```
import React from "react";
import type {
  TaskData,
  ChatMessage,
  AgentExecution,
  ChatStreamMessage,
  AgentStreamMessage,
} from "../types";
import { useCallback } from "react";
import { uuidv4 } from "@eko-ai/eko";

export const useChatCallbacks = (
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  currentMessageId: string | null,
  setCurrentMessageId: React.Dispatch<React.SetStateAction<string | null>>
) => {
  // Handle chat callbacks
  const handleChatCallback = useCallback(
    (data: ChatStreamMessage) => {
      setMessages((prev) => {
        const newMessages = [...prev];
        const aiMessageId = `ai-${data.messageId}`;
        let aiMessage = newMessages.find((m) => m.id === aiMessageId);

        if (!aiMessage) {
          const userMessage = newMessages.find((m) => m.id === data.messageId);
          if (!userMessage) {
            // User message doesn't exist, might be message order issue, return early
            return prev;
          }
          userMessage.status = "running";
          const _aiMessage: ChatMessage = {
            id: aiMessageId,
            role: "assistant",
            content: "",
            status: "waiting",
            timestamp: Date.now(),
            contentItems: [],
          };
          newMessages.push(_aiMessage);
          aiMessage = _aiMessage;
        }

        if (!aiMessage.contentItems) {
          aiMessage.contentItems = [];
        }

        // Handle different types of callbacks
        if (data.type === "chat_start") {
          if (data.messageId !== currentMessageId) {
            setCurrentMessageId(data.messageId);
          }
        } else {
          aiMessage.status = "running";
        }
        if (data.type === "text" || data.type === "thinking") {
          const existingIndex = aiMessage.contentItems.findIndex(
            (item) =>
              (item.type === "text" || item.type === "thinking") &&
              item.streamId === data.streamId
          );

          if (existingIndex >= 0) {
            (aiMessage.contentItems[existingIndex] as any).text = data.text;
            (aiMessage.contentItems[existingIndex] as any).streamDone =
              data.streamDone;
          } else {
            aiMessage.contentItems.push({
              type: data.type,
              streamId: data.streamId,
              text: data.text,
              streamDone: data.streamDone,
            });
          }

          if (data.type === "text" && data.streamDone) {
            aiMessage.content = data.text;
          }
        } else if (data.type === "file") {
          aiMessage.contentItems.push({
            type: "file",
            mimeType: data.mimeType,
            data: data.data,
          });
        } else if (data.type === "tool_streaming") {
          const existingIndex = aiMessage.contentItems.findIndex(
            (item) =>
              item.type === "tool" && item.toolCallId === data.toolCallId
          );

          if (existingIndex >= 0) {
            (aiMessage.contentItems[existingIndex] as any).paramsText =
              data.paramsText;
          } else {
            aiMessage.contentItems.push({
              type: "tool",
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              paramsText: data.paramsText,
            });
          }
        } else if (data.type === "tool_use") {
          const existingIndex = aiMessage.contentItems.findIndex(
            (item) =>
              item.type === "tool" && item.toolCallId === data.toolCallId
          );

          if (existingIndex >= 0) {
            (aiMessage.contentItems[existingIndex] as any).params = data.params;
          } else {
            aiMessage.contentItems.push({
              type: "tool",
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              params: data.params,
            });
          }
        } else if (data.type === "tool_running") {
          const existingIndex = aiMessage.contentItems.findIndex(
            (item) =>
              item.type === "tool" && item.toolCallId === data.toolCallId
          );

          if (existingIndex >= 0) {
            (aiMessage.contentItems[existingIndex] as any).running =
              !data.streamDone;
            (aiMessage.contentItems[existingIndex] as any).runningText =
              data.text;
          } else {
            aiMessage.contentItems.push({
              type: "tool",
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              running: true,
              runningText: data.text,
            });
          }
        } else if (data.type === "tool_result") {
          const existingIndex = aiMessage.contentItems.findIndex(
            (item) =>
              item.type === "tool" && item.toolCallId === data.toolCallId
          );

          if (existingIndex >= 0) {
            (aiMessage.contentItems[existingIndex] as any).result =
              data.toolResult;
            (aiMessage.contentItems[existingIndex] as any).running = false;
          } else {
            aiMessage.contentItems.push({
              type: "tool",
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              params: data.params,
              result: data.toolResult,
            });
          }

          if (data.toolName === "deepAction") {
            const taskId = (data.params as any)?.taskId || uuidv4();
            const taskIndex = aiMessage.contentItems.findIndex(
              (item) => item.type === "task" && item.taskId === taskId
            );

            if (taskIndex < 0) {
              const toolIndex = aiMessage.contentItems.findIndex(
                (item) =>
                  item.type === "tool" && item.toolCallId === data.toolCallId
              );
              const insertIndex =
                toolIndex >= 0 ? toolIndex + 1 : aiMessage.contentItems.length;
              aiMessage.contentItems.splice(insertIndex, 0, {
                type: "task",
                taskId: taskId,
                task: {
                  taskId: taskId,
                  agents: [],
                },
              });
            }
          }
        } else if (data.type === "error") {
          aiMessage.error = data.error;
        } else if (data.type === "finish") {
          aiMessage.usage = data.usage;
        } else if (data.type == "chat_end") {
          if (data.messageId === currentMessageId) {
            setCurrentMessageId(null);
          }
          const userMessage = newMessages.find((m) => m.id === data.messageId);
          if (userMessage) {
            userMessage.status = data.error ? "error" : "done";
          }
          aiMessage.error = data.error;
          if (aiMessage.status != "terminated") {
            aiMessage.status = data.error ? "error" : "done";
          }
          aiMessage.contentItems.forEach((item) => {
            if (item.type == "text" || item.type == "thinking") {
              item.streamDone = true;
            } else if (item.type == "tool") {
              item.running = false;
            } else if (item.type == "task") {
              const task = item.task;
              task.workflowStreamDone = true;
              task.agents.forEach((agent) => {
                if (agent.status == "running") {
                  agent.status = data.error ? "error" : "done";
                }
                agent.contentItems.forEach((contentItem) => {
                  if (
                    contentItem.type == "text" ||
                    contentItem.type == "thinking"
                  ) {
                    contentItem.streamDone = true;
                  } else if (contentItem.type == "tool") {
                    contentItem.running = false;
                  }
                });
              });
            }
          });
        }

        return newMessages;
      });
    },
    [currentMessageId, setCurrentMessageId, setMessages]
  );

  // Handle task callbacks
  const handleTaskCallback = useCallback(
    (data: AgentStreamMessage & { messageId: string }) => {
      setMessages((prev) => {
        const newMessages = [...prev];
        const message = newMessages.find(
          (m) => m.id === `ai-${data.messageId}`
        );

        if (!message) return prev;

        const taskItemIndex = message.contentItems.findIndex(
          (item) => item.type === "task" && item.taskId === data.taskId
        );

        if (taskItemIndex < 0) {
          message.contentItems.push({
            type: "task",
            taskId: data.taskId,
            task: {
              taskId: data.taskId,
              agents: [],
            },
          });
        }

        const taskItem = message.contentItems.find(
          (item) => item.type === "task" && item.taskId === data.taskId
        ) as { type: "task"; taskId: string; task: TaskData } | undefined;

        if (!taskItem) return prev;

        if (data.type === "workflow") {
          taskItem.task.workflow = data.workflow;
          taskItem.task.workflowStreamDone = data.streamDone;
        } else if (data.type === "workflow_confirm") {
          taskItem.task.workflowConfirm = "pending";
        } else if (data.type === "agent_start") {
          const existingAgent = taskItem.task.agents.find(
            (a) => a.agentNode.id === data.nodeId
          );
          if (!existingAgent) {
            const agentExecution: AgentExecution = {
              agentNode: data.agentNode,
              contentItems: [],
              status: "running",
            };
            taskItem.task.agents.push(agentExecution);
          }
        } else if (data.type === "text" || data.type === "thinking") {
          const agent = taskItem.task.agents.find(
            (a) => a.agentNode.id === data.nodeId
          );
          if (agent) {
            const existingIndex = agent.contentItems.findIndex(
           
```

### Core Architecture Module: `example/extension/src/sidebar/hooks/useFileUpload.ts`
```
import { useCallback } from "react";
import { uuidv4 } from "@eko-ai/eko";
import type { UploadedFile } from "../types";

export const useFileUpload = () => {
  // Convert file to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Upload file to server
  const uploadFile = useCallback(
    async (file: UploadedFile): Promise<{ fileId: string; url: string }> => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
          reject("Upload timeout");
        }, 180_000);

        const requestId = uuidv4();

        // Set up listener first
        const listener = (message: any) => {
          if (
            message.type === "uploadFile_result" &&
            message.requestId === requestId
          ) {
            clearTimeout(timer);
            chrome.runtime.onMessage.removeListener(listener);
            if (!message.data || message.data.error) {
              reject(new Error(message.data.error || "Upload failed"));
            } else {
              resolve(message.data);
            }
          }
        };
        chrome.runtime.onMessage.addListener(listener);

        // Send upload request
        chrome.runtime.sendMessage({
          requestId,
          type: "uploadFile",
          data: {
            base64Data: file.base64Data,
            mimeType: file.mimeType,
            filename: file.filename,
          },
        });
      });
    },
    []
  );

  return { fileToBase64, uploadFile };
};

```

### Core Architecture Module: `example/extension/src/sidebar/utils/index.ts`
```
export function isJsonStr(str?: string): boolean {
  str = str ?? "";
  str = str.trim();
  if (!str) {
    return false;
  }
  if (!str.startsWith("{") && !str.endsWith("[")) {
    return false;
  }
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
}

```

### Core Architecture Module: `packages/eko-core/jest.config.js`
```
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  setupFiles: ['dotenv/config'],
  testMatch: ["**/*.test.ts"],
  testTimeout: 60000,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  }
};

```

### Core Architecture Module: `packages/eko-core/rollup.config.debug.js`
```
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs.js',
        format: 'cjs',
        sourcemap: true,
        compact: false,
        minifyInternalExports: false
      }
    ],
    external: ['dotenv'],
    plugins: [
      commonjs(),
      resolve({
        preferBuiltins: true,
      }),
      typescript({
        sourceMap: true,
        inlineSources: true,
        declaration: true,
        declarationMap: true
      }),
      copy({
        targets: [
          { src: '../../README.md', dest: './' }
        ]
      })
    ],
    treeshake: false
  },
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
        compact: false,
        minifyInternalExports: false
      }
    ],
    external: ['dotenv', 'buffer'],
    plugins: [
      commonjs(),
      resolve({
        browser: true,
        preferBuiltins: true,
      }),
      typescript({
        sourceMap: true,
        inlineSources: true,
        declaration: true,
        declarationMap: true
      }),
      copy({
        targets: [
          { src: '../../README.md', dest: './' }
        ]
      })
    ],
    treeshake: false
  }
];
```

### Core Architecture Module: `packages/eko-core/rollup.config.js`
```
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
        interop: 'auto'
      }
    ],
    external: ['dotenv', 'buffer', 'canvas'],
    plugins: [
      commonjs(),
      resolve({
        preferBuiltins: true,
      }),
      typescript({
        declaration: true,
        declarationMap: true,
        compilerOptions: {
          declaration: true,
          declarationMap: true,
          moduleResolution: 'Bundler',
        }
      }),
      copy({
        targets: [
          { src: '../../README.md', dest: './' }
        ],
        hook: 'writeBundle'
      })
    ]
  },
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true
      }
    ],
    external: ['dotenv', 'buffer', 'canvas'],
    plugins: [
      commonjs(),
      resolve({
        browser: true,
        preferBuiltins: true,
      }),
      typescript({
        declaration: false,
        declarationMap: false,
      })
    ]
  }
];
```

### Core Architecture Module: `packages/eko-core/src/agent/a2a.ts`
```
import { Agent } from "./base";

export interface IA2aClient {
  listAgents(taskPrompt: string): Promise<Agent[]>;
}

export class A2aClient {
  // TODO A2A: https://www.a2aprotocol.net/zh
}
```

### Core Architecture Module: `packages/eko-core/src/agent/agent-context.ts`
```
import { Agent } from "../agent";
import { sleep } from "../common/utils";
import Chain, { AgentChain } from "../agent/chain";
import {
  Workflow,
  EkoConfig,
  WorkflowAgent,
  LanguageModelV2Prompt,
} from "../types";

export default class TaskContext {
  chatId: string;
  taskId: string; // messageId
  config: EkoConfig;
  chain: Chain;
  agents: Agent[];
  controller: AbortController;
  variables: Map<string, any>;
  workflow?: Workflow;
  conversation: string[] = [];
  private pauseStatus: 0 | 1 | 2 = 0;
  readonly currentStepControllers: Set<AbortController> = new Set();

  constructor(
    chatId: string,
    taskId: string,
    config: EkoConfig,
    agents: Agent[],
    chain: Chain
  ) {
    this.chatId = chatId;
    this.taskId = taskId;
    this.config = config;
    this.agents = agents;
    this.chain = chain;
    this.variables = new Map();
    this.controller = new AbortController();
  }

  async checkAborted(noCheckPause?: boolean): Promise<void> {
    if (this.controller.signal.aborted) {
      const error = new Error("Operation was interrupted");
      error.name = "AbortError";
      throw error;
    }
    while (this.pauseStatus > 0 && !noCheckPause) {
      await sleep(500);
      if (this.pauseStatus == 2) {
        this.currentStepControllers.forEach((c) => {
          c.abort("Pause");
        });
        this.currentStepControllers.clear();
      }
      if (this.controller.signal.aborted) {
        const error = new Error("Operation was interrupted");
        error.name = "AbortError";
        throw error;
      }
    }
  }

  currentAgent(): [Agent, WorkflowAgent, AgentContext] | null {
    const agentNode = this.chain.agents[this.chain.agents.length - 1];
    if (!agentNode) {
      return null;
    }
    const agent = this.agents.filter(
      (agent) => agent.Name == agentNode.agent.name
    )[0];
    if (!agent) {
      return null;
    }
    const agentContext = agent.AgentContext as AgentContext;
    return [agent, agentNode.agent, agentContext];
  }

  get pause() {
    return this.pauseStatus > 0;
  }

  setPause(pause: boolean, abortCurrentStep?: boolean) {
    this.pauseStatus = pause ? (abortCurrentStep ? 2 : 1) : 0;
    if (this.pauseStatus == 2) {
      this.currentStepControllers.forEach((c) => {
        c.abort("Pause");
      });
      this.currentStepControllers.clear();
    }
  }

  reset() {
    this.pauseStatus = 0;
    if (!this.controller.signal.aborted) {
      this.controller.abort();
    }
    this.currentStepControllers.forEach((c) => {
      c.abort("reset");
    });
    this.currentStepControllers.clear();
    this.controller = new AbortController();
  }
}

export class AgentContext {
  agent: Agent;
  context: TaskContext;
  agentChain: AgentChain;
  variables: Map<string, any>;
  consecutiveErrorNum: number;
  messages?: LanguageModelV2Prompt;

  constructor(context: TaskContext, agent: Agent, agentChain: AgentChain) {
    this.context = context;
    this.agent = agent;
    this.agentChain = agentChain;
    this.variables = new Map();
    this.consecutiveErrorNum = 0;
  }
}

```

### Core Architecture Module: `packages/eko-core/src/agent/agent-llm.ts`
```
import config from "../config";
import * as memory from "../memory";
import { AgentContext } from "./agent-context";
import { callLLM, RetryLanguageModel } from "../llm";
import { toFile, getMimeType } from "../common/utils";
import {
  Tool,
  ToolResult,
  LLMRequest,
  DialogueTool,
  HumanCallback,
  AgentStreamCallback,
} from "../types";
import {
  LanguageModelV2Prompt,
  LanguageModelV2TextPart,
  SharedV2ProviderOptions,
  LanguageModelV2ToolChoice,
  LanguageModelV2ToolCallPart,
  LanguageModelV2FunctionTool,
  LanguageModelV2ToolResultPart,
  LanguageModelV2ToolResultOutput,
} from "@ai-sdk/provider";
import { AnthropicProviderOptions } from "@ai-sdk/anthropic";

export function defaultLLMProviderOptions(): SharedV2ProviderOptions {
  return {
    // openai: {
    //   reasoning: {
    //     effort: "low",
    //   },
    // },
    // anthropic: {
    //   effort: "low",
    // },
    // openrouter: {
    //   reasoning: {
    //     effort: "low",
    //   },
    // },
  };
}

export function defaultMessageProviderOptions(): SharedV2ProviderOptions {
  return {
    anthropic: {
      cacheControl: { type: "ephemeral", ttl: "1h" },
    } as AnthropicProviderOptions,
    bedrock: {
      cachePoint: { type: "default" },
    },
    openrouter: {
      cacheControl: { type: "ephemeral" },
    },
  };
}

export function convertTools(
  tools: Tool[] | DialogueTool[]
): LanguageModelV2FunctionTool[] {
  return tools.map((tool, index) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
    providerOptions: index < 3 ? defaultMessageProviderOptions() : undefined,
  }));
}

export function getTool<T extends Tool | DialogueTool>(
  tools: T[],
  name: string
): T | null {
  for (let i = 0; i < tools.length; i++) {
    if (tools[i].name == name) {
      return tools[i];
    }
  }
  return null;
}

export function convertToolResult(
  toolUse: LanguageModelV2ToolCallPart,
  toolResult: ToolResult,
  user_messages?: LanguageModelV2Prompt
): LanguageModelV2ToolResultPart {
  let result: LanguageModelV2ToolResultOutput;
  if (!toolResult || !toolResult.content) {
    result = {
      type: "error-text",
      value: "Error",
    };
  } else if (
    toolResult.content.length == 1 &&
    toolResult.content[0].type == "text"
  ) {
    let text = toolResult.content[0].text;
    result = {
      type: "text",
      value: text,
    };
    let isError = toolResult.isError == true;
    if (isError && !text.startsWith("Error")) {
      text = "Error: " + text;
      result = {
        type: "error-text",
        value: text,
      };
    } else if (!isError && text.length == 0) {
      text = "Successful";
      result = {
        type: "text",
        value: text,
      };
    }
    if (
      text &&
      ((text.startsWith("{") && text.endsWith("}")) ||
        (text.startsWith("[") && text.endsWith("]")))
    ) {
      try {
        result = JSON.parse(text);
        result = {
          type: "json",
          value: result,
        };
      } catch (e) {}
    }
  } else {
    result = {
      type: "content",
      value: [],
    };
    for (let i = 0; i < toolResult.content.length; i++) {
      let content = toolResult.content[i];
      if (content.type == "text") {
        result.value.push({
          type: "text",
          text: content.text,
        });
      } else {
        if (config.toolResultMultimodal) {
          // Support returning images from tool results
          let mediaData = content.data;
          if (mediaData.startsWith("data:")) {
            mediaData = mediaData.substring(mediaData.indexOf(",") + 1);
          }
          result.value.push({
            type: "media",
            data: mediaData,
            mediaType: content.mimeType || "image/png",
          });
        } else {
          // Only the claude model supports returning images from tool results, while openai only supports text,
          // Compatible with other AI models that do not support tool results as images.
          if (user_messages) {
            user_messages.push({
              role: "user",
              content: [
                {
                  type: "file",
                  data: toFile(content.data),
                  mediaType: content.mimeType || getMimeType(content.data),
                },
                {
                  type: "text",
                  text: `call \`${toolUse.toolName}\` tool result`,
                },
              ],
            });
          } else {
            result.value.push({
              type: "text",
              text: "[image]",
            });
          }
        }
      }
    }
  }
  return {
    type: "tool-result",
    toolCallId: toolUse.toolCallId,
    toolName: toolUse.toolName,
    output: result,
  };
}

export async function callAgentLLM(
  agentContext: AgentContext,
  rlm: RetryLanguageModel,
  messages: LanguageModelV2Prompt,
  tools: LanguageModelV2FunctionTool[],
  noCompress?: boolean,
  toolChoice?: LanguageModelV2ToolChoice,
  callback?: AgentStreamCallback & HumanCallback,
  requestHandler?: (request: LLMRequest) => void
): Promise<Array<LanguageModelV2TextPart | LanguageModelV2ToolCallPart>> {
  await agentContext.context.checkAborted();
  if (
    !noCompress &&
    (messages.length >= config.compressThreshold ||
      (messages.length >= 10 &&
        estimatePromptTokens(messages, tools) >=
          config.compressTokensThreshold))
  ) {
    // Compress messages
    await memory.compressAgentMessages(agentContext, messages, tools);
  }
  if (!toolChoice) {
    // Append user dialogue
    appendUserConversation(agentContext, messages);
  }
  const context = agentContext.context;
  const agentChain = agentContext.agentChain;
  const agentNode = agentChain.agent;
  const streamCallback = callback ||
    context.config.callback || {
      onMessage: async () => {},
    };
  const stepController = new AbortController();
  const signal = AbortSignal.any([
    context.controller.signal,
    stepController.signal,
  ]);
  const request: LLMRequest = {
    tools: tools,
    toolChoice,
    messages: messages,
    abortSignal: signal,
  };
  requestHandler && requestHandler(request);
  try {
    agentChain.agentRequest = request;
    context.currentStepControllers.add(stepController);
    const result = await callLLM(
      rlm,
      request,
      async (message) => {
        await context.checkAborted();
        await streamCallback.onMessage({
          streamType: "agent",
          chatId: context.chatId,
          taskId: context.taskId,
          agentName: agentNode.name,
          nodeId: agentNode.id,
          ...message,
        });
      },
      async (request, error) => {
        if ((error + "").indexOf("is too long") > -1) {
          await memory.compressAgentMessages(agentContext, messages, tools);
        }
      },
      async (request, finishReason, value, retryNum) => {
        if (finishReason === "content-filter") {
          throw new Error("LLM error: trigger content filtering violation");
        } else if (finishReason === "other") {
          throw new Error("LLM error: terminated due to other reasons");
        } else if (
          finishReason === "length" &&
          messages.length >= 3 &&
          !noCompress &&
          retryNum < config.maxRetryNum
        ) {
          await memory.compressAgentMessages(agentContext, messages, tools);
          return "retry";
        }
      }
    );
    agentChain.agentResult = result
      .filter((s) => s.type == "text")
      .map((s) => s.text)
      .join("\n\n");
    return result;
  } finally {
    context.currentStepControllers.delete(stepController);
  }
}

export function estimatePromptTokens(
  messages: LanguageModelV2Prompt,
  tools?: LanguageModelV2FunctionTool[]
) {
  let tokens = messages.reduce((total, message) => {
    if (message.role == "system") {
      return total + estimateTokens(message.content);
    } else if (message.role == "user") {
      return (
        total +
        estimateTokens(
          message.content
            .filter((part) => part.type == "text")
            .map((part) => part.text)
            .join("\n")
        )
      );
    } else if (message.role == "assistant") {
      return (
        total +
        estimateTokens(
          message.content
            .map((part) => {
              if (part.type == "text") {
                return part.text;
              } else if (part.type == "reasoning") {
                return part.text;
              } else if (part.type == "tool-call") {
                return part.toolName + JSON.stringify(part.input || {});
              } else if (part.type == "tool-result") {
                return part.toolName + JSON.stringify(part.output || {});
              }
              return "";
            })
            .join("")
        )
      );
    } else if (message.role == "tool") {
      return (
        total +
        estimateTokens(
          message.content
            .map((part) => part.toolName + JSON.stringify(part.output || {}))
            .join("")
        )
      );
    }
    return total;
  }, 0);
  if (tools) {
    tokens += tools.reduce((total, tool) => {
      return total + estimateTokens(JSON.stringify(tool));
    }, 0);
  }
  return tokens;
}

export function estimateTokens(text: string) {
  if (!text) {
    return 0;
  }
  let tokenCount = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      tokenCount += 2;
    } else if (/\s/.test(char)) {
      continue;
    } else if (/[a-zA-Z]/.test(char)) {
      let word = "";
      while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        word += text[i];
      
```

### Core Architecture Module: `packages/eko-core/src/agent/base.ts`
```
import config from "../config";
import Log from "../common/log";
import * as memory from "../memory";
import { RetryLanguageModel } from "../llm";
import { mergeTools } from "../common/utils";
import { ToolWrapper } from "../tools/wrapper";
import { AgentChain, ToolChain } from "./chain";
import {
  McpTool,
  ForeachTaskTool,
  WatchTriggerTool,
  HumanInteractTool,
  VariableStorageTool,
} from "../tools";
import {
  Tool,
  ToolSchema,
  IMcpClient,
  LLMRequest,
  ToolResult,
  ToolExecuter,
  WorkflowAgent,
  HumanCallback,
  AgentStreamCallback,
} from "../types";
import {
  LanguageModelV2Prompt,
  LanguageModelV2FilePart,
  LanguageModelV2TextPart,
  LanguageModelV2ToolCallPart,
  LanguageModelV2ToolResultPart,
} from "@ai-sdk/provider";
import {
  getTool,
  convertTools,
  callAgentLLM,
  convertToolResult,
  defaultMessageProviderOptions,
} from "./agent-llm";
import { convertAssistantContent } from "../llm/react";
import TaskContext, { AgentContext } from "./agent-context";
import { doTaskResultCheck } from "../tools/task-result-check";
import { doTodoListManager } from "../tools/todo-list-manager";
import { getAgentSystemPrompt, getAgentUserPrompt } from "../prompt/agent";

export type AgentParams = {
  name: string;
  description: string;
  tools: Tool[];
  llms?: string[];
  mcpClient?: IMcpClient;
  planDescription?: string;
  requestHandler?: (request: LLMRequest) => void;
};

export class Agent {
  protected name: string;
  protected description: string;
  protected tools: Tool[] = [];
  protected llms?: string[];
  protected mcpClient?: IMcpClient;
  protected planDescription?: string;
  protected requestHandler?: (request: LLMRequest) => void;
  protected callback?: AgentStreamCallback & HumanCallback;
  protected agentContext?: AgentContext;

  constructor(params: AgentParams) {
    this.name = params.name;
    this.description = params.description;
    this.tools = params.tools;
    this.llms = params.llms;
    this.mcpClient = params.mcpClient;
    this.planDescription = params.planDescription;
    this.requestHandler = params.requestHandler;
  }

  public async run(
    context: TaskContext,
    agentChain: AgentChain
  ): Promise<string> {
    const mcpClient = this.mcpClient || context.config.defaultMcpClient;
    const agentContext = new AgentContext(context, this, agentChain);
    try {
      this.agentContext = agentContext;
      mcpClient &&
        !mcpClient.isConnected() &&
        (await mcpClient.connect(context.controller.signal));
      return await this.runWithContext(
        agentContext,
        mcpClient,
        config.maxReactNum
      );
    } finally {
      mcpClient && (await mcpClient.close());
    }
  }

  public async runWithContext(
    agentContext: AgentContext,
    mcpClient?: IMcpClient,
    maxReactNum: number = 100,
    historyMessages: LanguageModelV2Prompt = []
  ): Promise<string> {
    let loopNum = 0;
    let checkNum = 0;
    this.agentContext = agentContext;
    const context = agentContext.context;
    const agentNode = agentContext.agentChain.agent;
    const tools = [
      ...this.tools,
      ...this.system_auto_tools(agentNode, agentContext),
    ];
    const systemPrompt = await this.buildSystemPrompt(agentContext, tools);
    const userPrompt = await this.buildUserPrompt(agentContext, tools);
    const messages: LanguageModelV2Prompt = [
      {
        role: "system",
        content: systemPrompt,
        providerOptions: defaultMessageProviderOptions(),
      },
      ...historyMessages,
      {
        role: "user",
        content: userPrompt,
      },
    ];
    agentContext.messages = messages;
    const rlm = new RetryLanguageModel(context.config.llms, this.llms);
    rlm.setContext(agentContext);
    let agentTools = tools;
    while (loopNum < maxReactNum) {
      await context.checkAborted();
      if (mcpClient) {
        const controlMcp = await this.controlMcpTools(
          agentContext,
          messages,
          loopNum
        );
        if (controlMcp.mcpTools) {
          const mcpTools = await this.listTools(
            context,
            mcpClient,
            agentNode,
            controlMcp.mcpParams
          );
          const usedTools = memory.extractUsedTool(messages, agentTools);
          const _agentTools = mergeTools(tools, usedTools);
          agentTools = mergeTools(_agentTools, mcpTools);
        }
      }
      await this.handleMessages(agentContext, messages, tools);
      const llm_tools = convertTools(agentTools);
      const results = await callAgentLLM(
        agentContext,
        rlm,
        messages,
        llm_tools,
        false,
        undefined,
        this.callback,
        this.requestHandler
      );
      const forceStop = agentContext.variables.get("forceStop");
      if (forceStop) {
        return forceStop;
      }
      const finalResult = await this.handleCallResult(
        agentContext,
        messages,
        agentTools,
        results
      );
      loopNum++;
      if (!finalResult) {
        if (
          config.mode == "expert" &&
          loopNum % config.expertModeTodoLoopNum == 0
        ) {
          await doTodoListManager(agentContext, rlm, messages, llm_tools);
        }
        continue;
      }
      if (config.mode == "expert" && checkNum == 0) {
        checkNum++;
        const { completionStatus } = await doTaskResultCheck(
          agentContext,
          rlm,
          messages,
          llm_tools
        );
        if (completionStatus == "incomplete") {
          continue;
        }
      }
      return finalResult;
    }
    return "Unfinished";
  }

  protected async handleCallResult(
    agentContext: AgentContext,
    messages: LanguageModelV2Prompt,
    agentTools: Tool[],
    results: Array<LanguageModelV2TextPart | LanguageModelV2ToolCallPart>
  ): Promise<string | null> {
    const user_messages: LanguageModelV2Prompt = [];
    const toolResults: LanguageModelV2ToolResultPart[] = [];
    // results = memory.removeDuplicateToolUse(results);
    messages.push({
      role: "assistant",
      content: convertAssistantContent(results),
    });
    if (results.length == 0) {
      return null;
    }
    if (results.every((s) => s.type == "text")) {
      return results.map((s) => s.text).join("\n\n");
    }
    const toolCalls = results.filter((s) => s.type == "tool-call");
    if (
      toolCalls.length > 1 &&
      this.canParallelToolCalls(toolCalls) &&
      toolCalls.every(
        (s) =>
          agentTools.find((t) => t.name == s.toolName)?.supportParallelCalls
      )
    ) {
      const results = await Promise.all(
        toolCalls.map((toolCall) =>
          this.callToolCall(agentContext, agentTools, toolCall, user_messages)
        )
      );
      for (let i = 0; i < results.length; i++) {
        toolResults.push(results[i]);
      }
    } else {
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];
        const toolResult = await this.callToolCall(
          agentContext,
          agentTools,
          toolCall,
          user_messages
        );
        toolResults.push(toolResult);
      }
    }
    if (toolResults.length > 0) {
      messages.push({
        role: "tool",
        content: toolResults,
      });
      user_messages.forEach((message) => messages.push(message));
      return null;
    } else {
      return results
        .filter((s) => s.type == "text")
        .map((s) => s.text)
        .join("\n\n");
    }
  }

  protected async callToolCall(
    agentContext: AgentContext,
    agentTools: Tool[],
    result: LanguageModelV2ToolCallPart,
    user_messages: LanguageModelV2Prompt = []
  ): Promise<LanguageModelV2ToolResultPart> {
    const context = agentContext.context;
    const toolChain = new ToolChain(
      result,
      agentContext.agentChain.agentRequest as LLMRequest
    );
    agentContext.agentChain.push(toolChain);
    let toolResult: ToolResult;
    try {
      const args =
        typeof result.input == "string"
          ? JSON.parse(result.input || "{}")
          : result.input || {};
      toolChain.params = args;
      let tool = getTool(agentTools, result.toolName);
      if (!tool) {
        throw new Error(result.toolName + " tool does not exist");
      }
      toolResult = await tool.execute(args, agentContext, result);
      toolChain.updateToolResult(toolResult);
      agentContext.consecutiveErrorNum = 0;
    } catch (e) {
      Log.error("tool call error: ", result.toolName, result.input, e);
      toolResult = {
        content: [
          {
            type: "text",
            text: e + "",
          },
        ],
        isError: true,
      };
      toolChain.updateToolResult(toolResult);
      if (++agentContext.consecutiveErrorNum >= 10) {
        throw e;
      }
    }
    const callback = this.callback || context.config.callback;
    if (callback) {
      await callback.onMessage(
        {
          streamType: "agent",
          chatId: context.chatId,
          taskId: context.taskId,
          agentName: agentContext.agent.Name,
          nodeId: agentContext.agentChain.agent.id,
          type: "tool_result",
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          params: result.input || {},
          toolResult: toolResult,
        },
        agentContext
      );
    }
    return convertToolResult(result, toolResult, user_messages);
  }

  protected system_auto_tools(
    agentNode: WorkflowAgent,
    agentContext: AgentContext
  ): Tool[] {
    const tools: Tool[] = [];
    const agentNodeXml = agentNode.xml;
    const hasVariable =
      agentNodeXml.indexOf("input=") > -1 ||
      agentNodeXml.indexOf("output=") > -1;
    if (hasVariable) {
      tools.push(new VariableStorageTool());
    } else {
      const dependentVariables =
        agentContext.context.variables.get("dependentVariables");
      if (dependentVariables && dependentVariables.length > 0) {
        tools.push(n
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #270** (2026-02-07): **[BUG] OpenAI and OpenAI compatible models always throws AI_APICallError**
  *Symptoms*: ### Description  When I use open ai models with extension, the agent throws error after first turn.  ### Steps to Reproduce  1. Open extension 2. Select open ai or open ai compatible and add credentials 3. Type "Open twitter and follow google" 4. You will see the AI_APICallError error  ### Expected Behavior  Works perfectly fine with anthropic and gemini.  ### Environment  Chrome, Mac  ### Additional Context  _No response_

- **Issue #261** (2025-10-30): **[BUG] nodejs createImageBitmap is not defined**
  *Symptoms*: ### Description   execute error createImageBitmap is not defined ReferenceError: createImageBitmap is not defined  ### Steps to Reproduce  I followed the official documentation to install Node.js. https://fellou.ai/eko/docs/getting-started/quickstart/#running-a-nodejs-script 1. mkdir try-eko cd try-eko npm init 2. npm add @eko-ai/eko @eko-ai/eko-nodejs ts-node 3. Then write a script named index.ts: ``` import { Eko, Agent, LLMs } from "@eko-ai/eko"; import { BrowserAgent } from "@eko-ai/eko-nodejs";  async function run() {   let llms: LLMs = {     default: {       provider: "anthropic",       model: "claude-3-5-sonnet-20241022",       apiKey: "sk-xxx", // replace it with your API KEY       config: {         baseURL: "https://api.anthropic.com/v1",       },     },   };   let agents: Agent[] = [new BrowserAgent()];   let eko = new Eko({ llms, agents });   let result = await eko.run("Search for the latest news about Musk");   console.log("result: ", result.result); }  run().catch(e => {   console.log(e) }); ```  ### Expected Behavior  The expected result should be that it can run normally and return the task result  ### Environment  macOS  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed, thank you for the feedback!

- **Issue #241** (2025-10-13): **[BUG] Eko consumed $120 in 10 minutes（Eko 10分钟内消耗我 $120）**
  *Symptoms*: ### Description  Today I noticed an abnormal cost. After checking the logs, I found that at a certain point yesterday, nearly 100 requests were sent within 10 minutes, many of which were repeated LLM requests.  ### Steps to Reproduce  ``` "@eko-ai/eko": "^3.0.3" "@eko-ai/eko-extension": "^3.0.3" ```  Today I noticed an abnormal cost. After checking the logs, I found that at a certain point yesterday, nearly 100 requests were sent within 10 minutes, many of which were repeated LLM requests.  Each request has nearly 500,000 input tokens. Based on the Claude-4 token pricing at that time, these repeated requests within 10 minutes caused a direct loss of about $120. The root cause has not been identified yet, but it is observed that the Eko browser plugin Agent triggered LLM calls very frequently during this period. Users should exercise caution.  A sample log is as follows: `{   "data_info_msg_metrics": {     "ttft": 3937,     "ttlt": 4,     "input_token": 493458,     "output_token": 0   },   "data_info_msg_requestId": "eebd4b5f-e6fe-46dc-85d9-9c010f7062a7",   "data_info_msg_forwardUrl": "http://bedrock-runtime.us-west-2.amazonaws.com",   "data_info_msg_bellaTraceId": "openapi-a1dd1a8d-7d63-4d59-b0e9-8e3b80a067e1",   "data_info_msg_request": {     "removed": true,     "reason": "Log size exceeded 102400 bytes"   },   "data_info_msg_requestTime": "1758771992",   "data_info_msg_akCode": "ak-9cf95cbe-8a06-44d5-9397-8989759ab8f4",   "data_info_msg_model": "claude-4-sonnet",   "data_i
  **Post-Mortem & Fix Analysis**:
  > That's the reason why it's better to use a local LLM.
  > I am deeply sorry for the bad experience I have caused you. the issue has been fixed, limiting the abnormal situations of agents.
  > > I am deeply sorry for the bad experience I have caused you. the issue has been fixed, limiting the abnormal situations of agents.  Has a security policy been implemented to ensure that unexpected frequent calls do not occur？

- **Issue #228** (2025-10-14): **[BUG] Windows permissions error: macOS function called on Windows platform**
  *Symptoms*: ### Description  Fellou is attempting to call a macOS-specific function on Windows, causing automation features to fail. The error occurs when running as administrator on Windows and trying to use desktop automation capabilities.  ### Steps to Reproduce  ## Environment - **Platform:** Windows 11/10 - **Fellou version:** Latest - **Running as:** Administrator - **Node.js version:** [Please specify if known]  ## Steps to Reproduce 1. Install Fellou on a Windows machine 2. Run Fellou as Administrator 3. Attempt to use desktop automation features (computer use functionality) 4. Try to interact with desktop applications via automation  ## Actual Error Message ``` ```  ## Additional Context The error indicates that the code is attempting to call `systemPreferences.isTrustedAccessibilityClient`, which is a macOS-specific Electron API function. This function does not exist on Windows platforms and causes the automation features to fail completely.  ## Impact - Unable to use any desktop automation features on Windows - Affects users trying to automate desktop applications - Makes Fellou unusable for computer use cases on Windows platform  ## Suggested Fix - Implement platform-specific permission checking - Use Windows-appropriate APIs for checking automation permissions - Add proper platform detection before calling platform-specific functions - Provide Windows-specific guidance for enabling automation permissions## Environment - **Platform:** Windows 11/10 - **Fellou version:** Lates
  **Post-Mortem & Fix Analysis**:
  > Thank you very much for your feedback. We have resolved it in the latest CE version, and you can update it through the official website https://fellou.ai/

- **Issue #192** (2025-06-14): **[BUG] The browser extension doesn't work**
  *Symptoms*: ### Description  The agent can't manipulate the web browser although it can analysis the task  ### Steps to Reproduce  1.Os: windows. Browser: edge/google 2. Follwing the tutorial, import the extension into the browser. And then set the api key.  3. When I prompt the task ,the eko agent can analysis what he need to do. However, it failed at operating the task ,and an error called "Error: Plan Error" occured. It seemed that the eko agent can't use the web browser to do something.  ### Expected Behavior  _No response_  ### Environment  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > This is usually an error returned when the model call fails. Please use a model that supports images, such as OpenAI / Claude / Gemini, etc. For specific error details, you can open DevTools to check the console logs.

- **Issue #191** (2025-06-14): **[BUG] execute error Cannot read properties of undefined (reading 'sent')**
  *Symptoms*: ### Description  execute error Cannot read properties of undefined (reading 'sent')  ### Steps to Reproduce   [ERROR] execute error Cannot read properties of undefined (reading 'sent') TypeError: Cannot read properties of undefined (reading 'sent')  ### Expected Behavior  _No response_  ### Environment  _No response_  ### Additional Context  ![Image](https://github.com/user-attachments/assets/e618e23a-40cf-4c01-972c-ae9fa863ba07)  ![Image](https://github.com/user-attachments/assets/8d40db8e-6abb-4576-a257-9e5602192073)
  **Post-Mortem & Fix Analysis**:
  > I suspect you may have encountered incompatibility issues when using the openrouter provider to call the relay station. I suggest switching to the openai provider and configuring access via the baseURL method.

- **Issue #189** (2025-06-12): **[BUG]system_auto_tools(). will always return [];**
  *Symptoms*: ### Description  system_auto_tools(). will always return [];  ### Steps to Reproduce  <img width="786" alt="Image" src="https://github.com/user-attachments/assets/885be225-1ac4-4609-b590-d7e0e16c9137" />  ### Expected Behavior  _No response_  ### Environment  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > The logic is as follows: this is to filter the tools passed by the user themselves to prevent duplication.
  > alright.

- **Issue #188** (2025-06-12): **[BUG] HumanInteraction-confirm can not be used in the background**
  *Symptoms*: ### Description  HumanInteraction-confirm can not be used in the background  ### Steps to Reproduce  <img width="1000" alt="Image" src="https://github.com/user-attachments/assets/feb33b85-a3cf-449d-b469-41833f3a38ca" />  <img width="1072" alt="Image" src="https://github.com/user-attachments/assets/ebcc48f1-dc1f-4241-b5a6-337db6f4b442" />    let callback: StreamCallback & HumanCallback = {     onMessage: async (message: StreamCallbackMessage) => {       if (message.type == "workflow") {         // printLog("Plan\n" + message.workflow.xml, "info", !message.streamDone);         printWorkflow(message.workflow, !message.streamDone);       } else if (message.type == "text") {         printLog(message.text, "info", !message.streamDone);       } else if (message.type == "tool_streaming") {         printLog(`${message.agentName} > ${message.toolName}\n${message.paramsText}`, "info", true);       } else if (message.type == "tool_use") {         printLog(           `${message.agentName} > ${message.toolName}\n${JSON.stringify(             message.params           )}`         );       }       console.log("message: ", JSON.stringify(message, null, 2));     },     onHumanConfirm: async (context, prompt) => {       **return confirm(prompt);**     }   };  ### Expected Behavior  _No response_  ### Environment  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the feedback. I forgot it was running in a background environment. It has been fixed.

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

### Incident Patch 1: `a7621aea` (2025-12-10)
**Commit Message**: fix: extension input bug

**File**: `example/extension/src/sidebar/components/WebpageMentionInput.tsx` (modified, +9/-2)
```diff
@@ -145,6 +145,7 @@ export const WebpageMentionInput: React.FC<WebpageMentionInputProps> = ({
   const [loadingTabs, setLoadingTabs] = useState(false);
   const pendingFocusRefId = useRef<string | null>(null);
   const skipSyncRef = useRef(false);
+  const isComposingRef = useRef(false);
 
   const resetMentionState = useCallback(() => {
     setShowDropdown(false);
@@ -414,7 +415,7 @@ export const WebpageMentionInput: React.FC<WebpageMentionInputProps> = ({
           }
           return;
         }
-        if (event.key === "Enter" && !event.shiftKey) {
+        if (event.key === "Enter" && !event.shiftKey && !isComposingRef.current) {
           event.preventDefault();
           if (highlightedIndex >= 0 && highlightedIndex < filteredTabs.length) {
             insertWebpageReference(filteredTabs[highlightedIndex]);
@@ -423,7 +424,7 @@ export const WebpageMentionInput: React.FC<WebpageMentionInputProps> = ({
         }
       }
 
-      if (event.key === "Enter" && !event.shiftKey && !showDropdown) {
+      if (event.key === "Enter" && !event.shiftKey && !showDropdown && !isComposingRef.current) {
         event.preventDefault();
         onSend();
       } else if (event.key === "Escape" && showDropdown) {
@@ -471,6 +472,12 @@ export const WebpageMentionInput: React.FC<WebpageMentionInputProps> = ({
         onMouseUp={updateMentionState}
         onClick={handleEditorClick}
         onPaste={handleEditorPaste}
+        onCompositionStart={() => {
+          isComposingRef.current = true;
+        }}
+        onCompositionEnd={() => {
+          isComposingRef.current = false;
+        }}
       />
       {showDropdown && (
         <div
```

**File**: `example/extension/src/sidebar/index.tsx` (modified, +25/-5)
```diff
@@ -18,6 +18,7 @@ const AppRun = () => {
   const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const messagesContainerRef = useRef<HTMLDivElement>(null);
+  const [autoScroll, setAutoScroll] = useState(true);
 
   const { handleChatCallback, handleTaskCallback } = useChatCallbacks(
     setMessages,
@@ -26,14 +27,33 @@ const AppRun = () => {
   );
   const { fileToBase64, uploadFile } = useFileUpload();
 
-  // Scroll to bottom
-  const scrollToBottom = useCallback(() => {
-    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
+  const isNearBottom = useCallback(() => {
+    const container = messagesContainerRef.current;
+    if (!container) return true;
+    const threshold = 200;
+    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
+    return scrollBottom < threshold;
   }, []);
 
   useEffect(() => {
-    scrollToBottom();
-  }, [messages, scrollToBottom]);
+    const container = messagesContainerRef.current;
+    if (!container) return;
+
+    const handleScroll = () => {
+      setAutoScroll(isNearBottom());
+    };
+
+    container.addEventListener('scroll', handleScroll);
+    return () => {
+      container.removeEventListener('scroll', handleScroll);
+    };
+  }, [isNearBottom]);
+
+  useEffect(() => {
+    if (autoScroll) {
+      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
+    }
+  }, [messages, autoScroll]);
 
   // Listen to background messages
   useEffect(() => {
```

---

### Incident Patch 2: `8cbf71d8` (2025-12-04)
**Commit Message**: feat: fix problem of expire time in cookie, enhance local storage handling in LocalCookiesBrowserAgent and update package dependencies

**File**: `example/nodejs/package.json` (modified, +6/-3)
```diff
@@ -19,19 +19,22 @@
     "@eko-ai/eko": "workspace:*",
     "@eko-ai/eko-nodejs": "workspace:*",
     "canvas": "^3.2.0",
+    "chrome-cookies-secure": "^3.0.0",
     "glob": "^11.0.2",
+    "keytar": "^7.9.0",
+    "level": "^10.0.0",
+    "leveldown": "^6.1.1",
     "merge-deep": "^3.0.3",
     "playwright": "^1.57.0",
     "playwright-extra": "^4.3.6",
-    "puppeteer-extra-plugin-stealth": "^2.11.2",
-    "chrome-cookies-secure": "^3.0.0",
-    "keytar": "^7.9.0"
+    "puppeteer-extra-plugin-stealth": "^2.11.2"
   },
   "devDependencies": {
     "@rollup/plugin-commonjs": "^28.0.3",
     "@rollup/plugin-json": "^6.1.0",
     "@rollup/plugin-node-resolve": "^16.0.1",
     "@rollup/plugin-typescript": "^12.1.2",
+    "@types/leveldown": "^4.0.6",
     "@types/node": "^22.15.19",
     "dotenv": "^16.5.0",
     "rollup": "^4.40.0",
```

**File**: `example/nodejs/rollup.config.js` (modified, +9/-3)
```diff
@@ -12,9 +12,15 @@ export default {
     },
   ],
   external: (id) =>
-    ["chrome-cookies-secure", "sqlite3", "keytar", "bindings"].some(
-      (mod) => id === mod || id.startsWith(mod + "/")
-    ) || id.endsWith(".node"),
+    [
+      "chrome-cookies-secure",
+      "sqlite3",
+      "keytar",
+      "bindings",
+      "level",
+      "leveldown",
+    ].some((mod) => id === mod || id.startsWith(mod + "/")) ||
+    id.endsWith(".node"),
   plugins: [
     json(),
     commonjs({
```

**File**: `example/nodejs/src/browser.ts` (modified, +227/-15)
```diff
@@ -1,14 +1,208 @@
 import os from "os";
 import fs from "fs";
+import path from "path";
+import { promises as fsPromises } from "fs";
 import chromeCookies from "chrome-cookies-secure";
 import { BrowserAgent } from "@eko-ai/eko-nodejs";
 import { AgentContext } from "@eko-ai/eko";
+import { Level } from "level";
 
 export default class LocalCookiesBrowserAgent extends BrowserAgent {
   private caches: Record<string, boolean> = {};
+  private localStorageCaches: Record<string, Record<string, string>> = {};
   private profileName: string =
     LocalCookiesBrowserAgent.getLastUsedProfileName();
 
+  protected async loadLocalStorageWithUrl(
+    url: string
+  ): Promise<Record<string, string>> {
+    const urlObj = new URL(url);
+    const origin = urlObj.origin;
+    if (this.localStorageCaches[origin]) {
+      return this.localStorageCaches[origin];
+    }
+
+    let tempDir: string | null = null;
+    let db: Level<string, Buffer> | null = null;
+
+    try {
+      const localStoragePath = this.getLocalStoragePath();
+      if (!fs.existsSync(localStoragePath)) {
+        return {};
+      }
+
+      // 复制 LevelDB 到临时目录（因为 Chrome 可能正在使用）
+      tempDir = path.join(os.tmpdir(), `chrome-ls-${Date.now()}`);
+      await this.copyDirectory(localStoragePath, tempDir);
+
+      // 打开 LevelDB
+      db = new Level(tempDir, {
+        valueEncoding: "binary",
+        keyEncoding: "binary",
+      } as any);
+
+      const result: Record<string, string> = {};
+      const urlOrigin = urlObj.origin;
+      const urlHref = urlObj.href;
+      const urlHostname = urlObj.hostname;
+
+      // 遍历所有键值对
+      for await (const [rawKey, rawVal] of db.iterator()) {
+        const key = rawKey.toString();
+
+        // Chrome localStorage keys format: "_https://example.commyKey" 或 "_https://example.com/^0partitionKeymyKey"
+        if (key.startsWith("_")) {
+          let storageKey = "";
+          let matched = false;
+
+          // 优先精确匹配 origin
+          if (key.startsWith(`_${urlOrigin}`)) {
+            storageKey = key.substring(`_${urlOrigin}`.length);
+            matched = true;
+          } else if (key.startsWith(`_${urlHref}`)) {
+            storageKey = key.substring(`_${urlHref}`.length);
+            matched = true;
+          } else {
+            // 尝试匹配 hostname（处理不同协议或端口的情况）
+            const hostnamePattern = new RegExp(`^_https?://${urlHostname.replace(/\./g, "\\.")}`);
+            if (hostnamePattern.test(key)) {
+              // 提取 origin 部分（从 _ 到第一个非 origin 字符）
+              const originMatch = key.match(/^_(https?:\/\/[^/]+)/);
+              if (originMatch) {
+                const keyOrigin = originMatch[1];
+                // 如果 hostname 匹配，提取 storageKey
+                if (keyOrigin.includes(urlHostname)) {
+                  storageKey = key.substring(originMatch[0].length);
+                  matched = true;
+                }
+              }
+            }
+          }
+
+          if (matched && storageKey) {
+            // 处理分区键的情况（格式：/^0partitionKeystorageKey）
+            // 例如：/^0https://google.comyt-remote-connected-devices
+            if (storageKey.startsWith("/^0")) {
+              const afterPartition = storageKey.substring(3);
+              // 分区键通常是完整的 URL（如 https://google.com）
+              // storageKey 通常以字母或下划线开头
+              // 从后往前匹配，找到 storageKey 的开始位置
+              // storageKey 模式：字母/下划线开头，包含字母、数字、下划线、连字符、冒号
+              const storageKeyPattern = /([a-zA-Z_][a-zA-Z0-9_:-]+)$/;
+              const keyMatch = afterPartition.match(storageKeyPattern);
+              if (keyMatch) {
+                storageKey = keyMatch[1];
+                // 验证前面确实是 URL 格式
+                const beforeKey = afterPartition.substring(0, afterPartition.length - keyMatch[1].length);
+                if (beforeKey.match(/^https?:\/\//)) {
+                  // 确认是有效的分区键格式
+                } else {
+                  // 如果不是 URL 格式，可能整个都是 storageKey
+                  storageKey = afterPartition;
+                }
+              } else {
+                // 如果无法匹配，尝试直接使用（可能是特殊格式）
+                storageKey = afterPartition;
+              }
+            }
+
+            // 清理 storageKey 中的控制字符（\x00, \x01 等）
+            storageKey = storageKey.replace(/[\x00-\x1F]/g, "");
+
+            // 解析值（可能是 JSON 格式）
+            let rawValue = rawVal.toString();
+            // 清理 value 中的控制字符（\x00, \x01 等）
+            rawValue = rawValue.replace(/[\x00-\x1F]/g, "");
+            
+            try {
+              const parsed = JSON.parse(rawValue);
+              // 如果解析成功且是对象，检查是否有 data 字段
+              if (typeof parsed === "object" && parsed !== null && "data" in parsed) {
+                result[storageKey] =
+                  typeof parsed.data === "string"
+                    ? parsed.data
+                    : JSON.stringify(parsed.data);
+              } else {
+                result[storageKey] = rawValue;
+              }
+            } catch {
+              
```

**File**: `example/nodejs/src/index.ts` (modified, +15/-2)
```diff
@@ -1,8 +1,16 @@
 import dotenv from "dotenv";
 import FileAgent from "./file-agent";
 import LocalCookiesBrowserAgent from "./browser";
+import os from "os";
 import { BrowserAgent } from "@eko-ai/eko-nodejs";
-import { Eko, Agent, Log, LLMs, AgentStreamMessage } from "@eko-ai/eko";
+import {
+  Eko,
+  Agent,
+  Log,
+  LLMs,
+  AgentStreamMessage,
+  AgentContext,
+} from "@eko-ai/eko";
 
 dotenv.config();
 
@@ -48,10 +56,15 @@ async function run() {
   //   "Search for the latest news about Musk, summarize and save to the desktop as Musk.md"
   // );
   // console.log("result: ", result.result);
+
   const browser = new LocalCookiesBrowserAgent();
-  await browser.openUrl("https://www.baidu.com");
+  //browser.initUserDataDir(`${os.homedir()}/Library/Application Support/Google/Chrome_NotRunning/`);
+  const testUrl = "https://bilibili.com";
+  browser.openUrl(testUrl);
 }
 
+
+
 run().catch((e) => {
   console.log(e);
 });
```

**File**: `packages/eko-nodejs/src/browser.ts` (modified, +19/-40)
```diff
@@ -8,7 +8,6 @@ export default class BrowserAgent extends BaseBrowserLabelsAgent {
   private userDataDir?: string;
   private options?: Record<string, any>;
   private cookies?: Array<any>;
-  private localStorage?: Record<string, string>;
   protected browser: Browser | null = null;
   private browser_context: BrowserContext | null = null;
   private current_page: Page | null = null;
@@ -41,10 +40,6 @@ export default class BrowserAgent extends BaseBrowserLabelsAgent {
     this.cookies = cookies;
   }
 
-  public setLocalStorage(localStorage: Record<string, string>) {
-    this.localStorage = localStorage;
-  }
-
   public setOptions(options?: Record<string, any>) {
     this.options = options;
   }
@@ -198,7 +193,7 @@ export default class BrowserAgent extends BaseBrowserLabelsAgent {
     await page.setViewportSize({ width: 1536, height: 864 });
     try {
       await this.autoLoadCookies(url);
-      await this.autoLoadLocalStorage(url, page);
+      await this.autoLoadLocalStorage(page, url);
       await page.goto(url, {
         waitUntil: "domcontentloaded",
         timeout: 10000,
@@ -293,25 +288,16 @@ export default class BrowserAgent extends BaseBrowserLabelsAgent {
       // https://www.browserscan.net/
       chromium.use(StealthPlugin());
       const init_script = await this.initScript();
-      const localStorageScript = this.getLocalStorageInitScript();
       if (init_script.content || init_script.path) {
-        const combinedScript = {
-          content: localStorageScript
-            ? `${localStorageScript}\n${init_script.content || ""}`
-            : init_script.content,
-          path: init_script.path,
-        };
-        this.browser_context.addInitScript(combinedScript);
-      } else if (localStorageScript) {
-        this.browser_context.addInitScript({ content: localStorageScript });
+        this.browser_context.addInitScript(init_script);
       }
       this.browser_context.on("page", async (page) => {
         page.on("framenavigated", async (frame) => {
           if (frame === page.mainFrame()) {
             const url = frame.url();
             if (url.startsWith("http")) {
               await this.autoLoadCookies(url);
-              await this.autoLoadLocalStorage(url, page);
+              await this.autoLoadLocalStorage(page, url);
             }
           }
         });
@@ -327,23 +313,30 @@ export default class BrowserAgent extends BaseBrowserLabelsAgent {
     try {
       const cookies = await this.loadCookiesWithUrl(url);
       if (cookies && cookies.length > 0) {
-        this.browser_context?.addCookies(cookies);
+        await this.browser_context?.clearCookies();
+        await this.browser_context?.addCookies(cookies);
+        const injected_cookies = await this.browser_context?.cookies(url);
+        console.log("===> Injected Cookies: ", injected_cookies);
       }
     } catch (e) {
       Log.error("Failed to auto load cookies: " + url, e);
     }
   }
 
-  private async autoLoadLocalStorage(url: string, page: Page): Promise<void> {
+  private async autoLoadLocalStorage(page: Page, url: string): Promise<void> {
     try {
       const localStorageData = await this.loadLocalStorageWithUrl(url);
-      if (localStorageData && Object.keys(localStorageData).length > 0) {
-        await page.evaluate((data) => {
-          Object.keys(data).forEach((key) => {
-            localStorage.setItem(key, data[key]);
-          });
-        }, localStorageData);
-      }
+      await page.addInitScript(
+        (storage: Record<string, string>) => {
+        try {
+          for (const [key, value] of Object.entries(storage)) {
+              localStorage.setItem(key, value);
+            }
+          } catch (e) {
+            console.error("Failed to inject localStorage: " + url, e);
+          }
+        }, localStorageData
+      );
     } catch (e) {
       Log.error("Failed to auto load localStorage: " + url, e);
     }
@@ -372,19 +365,6 @@ export default class BrowserAgent extends BaseBrowserLabelsAgent {
     return {};
   }
 
-  private getLocalStorageInitScript(): string {
-    if (!this.localStorage || Object.keys(this.localStorage).length === 0) {
-      return "";
-    }
-    const data = JSON.stringify(this.localStorage);
-    return `(function() {
-      const data = ${data};
-      Object.keys(data).forEach(key => {
-        localStorage.setItem(key, data[key]);
-      });
-    })();`;
-  }
-
   protected getChromiumArgs(): string[] {
     return [
       "--no-sandbox",
@@ -417,5 +397,4 @@ export default class BrowserAgent extends BaseBrowserLabelsAgent {
     return {};
   }
 }
-
 export { BrowserAgent };
```

---

### Incident Patch 3: `b3e0f06d` (2025-11-25)
**Commit Message**: feat(chatbot): support @webpage UI

**File**: `example/extension/src/background/index.ts` (modified, +39/-6)
```diff
@@ -1,9 +1,3 @@
-import {
-  LLMs,
-  global,
-  ChatAgent,
-  AgentStreamMessage,
-} from "@eko-ai/eko";
 import {
   HumanCallback,
   MessageTextPart,
@@ -12,6 +6,7 @@ import {
   AgentStreamCallback,
 } from "@eko-ai/eko/types";
 import { BrowserAgent } from "@eko-ai/eko-extension";
+import { LLMs, global, ChatAgent, AgentStreamMessage } from "@eko-ai/eko";
 
 const abortControllers = new Map<string, AbortController>();
 
@@ -126,6 +121,44 @@ export async function init(): Promise<ChatAgent> {
         abortController.abort("user aborted");
         abortControllers.delete(data.messageId);
       }
+    } else if (type == "getTabs") {
+      try {
+        const tabs = await chrome.tabs.query({});
+        const sortedTabs = tabs
+          .sort((a, b) => {
+            const aTime = (a as any).lastAccessed || 0;
+            const bTime = (b as any).lastAccessed || 0;
+            return bTime - aTime;
+          })
+          .filter((tab) => !tab.url.startsWith("chrome://"))
+          .map((tab) => {
+            const lastAccessed = (tab as any).lastAccessed;
+            return {
+              tabId: String(tab.id),
+              title: tab.title || "",
+              url: tab.url || "",
+              active: tab.active,
+              status: tab.status,
+              iconUrl: tab.favIconUrl,
+              lastAccessed: lastAccessed
+                ? new Date(lastAccessed).toLocaleString()
+                : "",
+            };
+          })
+          .slice(0, 15);
+
+        chrome.runtime.sendMessage({
+          requestId,
+          type: "getTabs_result",
+          data: { tabs: sortedTabs },
+        });
+      } catch (error) {
+        chrome.runtime.sendMessage({
+          requestId,
+          type: "getTabs_result",
+          data: { error: String(error) },
+        });
+      }
     }
   });
 
```

**File**: `example/extension/src/sidebar/components/ChatInput.tsx` (modified, +11/-16)
```diff
@@ -1,15 +1,15 @@
+import React, { useRef } from "react";
 import {
   SendOutlined,
   StopOutlined,
   FileOutlined,
   DeleteOutlined,
   PaperClipOutlined,
 } from "@ant-design/icons";
-import React, { useRef } from "react";
 import type { UploadedFile } from "../types";
-import { Button, Input, Space, Image, Typography } from "antd";
+import { Button, Space, Image, Typography } from "antd";
+import { WebpageMentionInput } from "./WebpageMentionInput";
 
-const { TextArea } = Input;
 const { Text } = Typography;
 
 interface ChatInputProps {
@@ -45,7 +45,6 @@ export const ChatInput: React.FC<ChatInputProps> = ({
         borderTop: "1px solid #e8e8e8",
       }}
     >
-      {/* Uploaded files list */}
       {uploadedFiles.length > 0 && (
         <div style={{ marginBottom: 8 }}>
           <Space wrap>
@@ -104,7 +103,8 @@ export const ChatInput: React.FC<ChatInputProps> = ({
           </Space>
         </div>
       )}
-      <Space.Compact style={{ width: "100%" }}>
+
+      <Space.Compact style={{ width: "100%", alignItems: "center" }}>
         <input
           ref={fileInputRef}
           type="file"
@@ -118,20 +118,14 @@ export const ChatInput: React.FC<ChatInputProps> = ({
           onClick={() => fileInputRef.current?.click()}
           disabled={sending || currentMessageId !== null}
         />
-        <TextArea
+
+        <WebpageMentionInput
           value={inputValue}
-          onChange={(e) => onInputChange(e.target.value)}
-          onPressEnter={(e) => {
-            if (!e.shiftKey) {
-              e.preventDefault();
-              onSend();
-            }
-          }}
-          placeholder="Type a message..."
-          autoSize={{ minRows: 1, maxRows: 4 }}
-          style={{ flex: 1, margin: "0 4px" }}
+          onChange={onInputChange}
           disabled={sending || currentMessageId !== null}
+          onSend={onSend}
         />
+
         {currentMessageId ? (
           <Button danger icon={<StopOutlined />} onClick={onStop}>
             Stop
@@ -145,6 +139,7 @@ export const ChatInput: React.FC<ChatInputProps> = ({
             disabled={
               (!inputValue.trim() && uploadedFiles.length === 0) || sending
             }
+            style={{ padding: "0 10px" }}
           >
             Send
           </Button>
```

**File**: `example/extension/src/sidebar/components/MessageItem.tsx` (modified, +94/-2)
```diff
@@ -1,4 +1,4 @@
-import React from "react";
+import React, { useMemo } from "react";
 import { TextItem } from "./TextItem";
 import type { ChatMessage } from "../types";
 import { ThinkingItem } from "./ThinkingItem";
@@ -10,11 +10,103 @@ import { RobotOutlined, UserOutlined, FileOutlined } from "@ant-design/icons";
 
 const { Text, Paragraph } = Typography;
 
+const decodeHtmlEntities = (text: string) => {
+  if (!text) return "";
+  if (typeof window === "undefined") {
+    return text
+      .replace(/&lt;/g, "<")
+      .replace(/&gt;/g, ">")
+      .replace(/&amp;/g, "&")
+      .replace(/&quot;/g, '"')
+      .replace(/&#39;/g, "'");
+  }
+  const textarea = document.createElement("textarea");
+  textarea.innerHTML = text;
+  return textarea.value;
+};
+
+const renderContentWithWebRefs = (
+  content: string,
+  onWebRefClick: (url: string) => void
+) => {
+  if (!content) return null;
+  const elements: React.ReactNode[] = [];
+  const regex =
+    /<span class="webpage-reference"[^>]*tab-id="([^"]+)"[^>]*url="([^"]+)"[^>]*>(.*?)<\/span>/gi;
+  let lastIndex = 0;
+  let keyIndex = 0;
+
+  const pushText = (text: string) => {
+    if (!text) return;
+    const normalized = text.replace(/<br\s*\/?>/gi, "\n");
+    const decoded = decodeHtmlEntities(normalized);
+    if (!decoded) return;
+    const parts = decoded.split(/(\n)/);
+    parts.forEach((part) => {
+      if (!part) {
+        return;
+      }
+      if (part === "\n") {
+        elements.push(<br key={`br-${keyIndex++}`} />);
+      } else {
+        elements.push(
+          <React.Fragment key={`text-${keyIndex++}`}>{part}</React.Fragment>
+        );
+      }
+    });
+  };
+
+  let match: RegExpExecArray | null;
+  while ((match = regex.exec(content)) !== null) {
+    const [fullMatch, tabId, url, title] = match;
+    if (match.index > lastIndex) {
+      pushText(content.slice(lastIndex, match.index));
+    }
+
+    const decodedTitle = decodeHtmlEntities(title);
+    const decodedUrl = decodeHtmlEntities(url);
+    elements.push(
+      <span
+        key={`webref-${tabId || keyIndex}`}
+        className="webpage-reference-display user-webpage-reference"
+        onClick={() => onWebRefClick(decodedUrl)}
+      >
+        {`${decodedTitle}`}
+      </span>
+    );
+    lastIndex = match.index + fullMatch.length;
+  }
+
+  if (lastIndex < content.length) {
+    pushText(content.slice(lastIndex));
+  }
+
+  if (elements.length === 0) {
+    return decodeHtmlEntities(content);
+  }
+
+  return elements;
+};
+
 interface MessageItemProps {
   message: ChatMessage;
 }
 
 export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
+  const handleWebRefClick = (url: string) => {
+    if (!url) return;
+    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
+      chrome.tabs.create({ url });
+    } else {
+      window.open(url, "_blank", "noopener");
+    }
+  };
+
+  const userContent = useMemo(
+    () => renderContentWithWebRefs(message.content || "", handleWebRefClick),
+    [message.content]
+  );
+
   if (message.role === "user") {
     return (
       <div
@@ -40,7 +132,7 @@ export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
                 <UserOutlined />
                 {message.content && (
                   <Paragraph style={{ margin: 0, color: "white" }}>
-                    {message.content}
+                    {userContent}
                   </Paragraph>
                 )}
                 {message.loading && (
```

**File**: `example/extension/src/sidebar/components/ToolCallItem.tsx` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ export const ToolCallItem: React.FC<ToolCallItemProps> = ({ item }) => {
               key: "params",
               label: "Parameters",
               children: (
-                <pre style={{ margin: 0, fontSize: 12 }}>
+                <pre className="tool-params-pre">
                   {JSON.stringify(item.params, null, 2)}
                 </pre>
               ),
```

**File**: `example/extension/src/sidebar/components/WebpageMentionInput.tsx` (added, +574/-0)
```diff
@@ -0,0 +1,574 @@
+import React, {
+  useRef,
+  useMemo,
+  useState,
+  useEffect,
+  useCallback,
+} from "react";
+import { Typography } from "antd";
+import { uuidv4 } from "@eko-ai/eko";
+import type { TabInfo } from "../types";
+import { GlobalOutlined } from "@ant-design/icons";
+
+interface WebpageMentionInputProps {
+  value: string;
+  onChange: (value: string) => void;
+  disabled: boolean;
+  onSend: () => void;
+}
+
+const { Text } = Typography;
+
+const escapeHtml = (text: string) =>
+  text
+    .replace(/&/g, "&amp;")
+    .replace(/</g, "&lt;")
+    .replace(/>/g, "&gt;")
+    .replace(/"/g, "&quot;")
+    .replace(/'/g, "&#39;");
+
+const formatValueForDisplay = (value: string) => {
+  if (!value) return "";
+  const container = document.createElement("div");
+  container.innerHTML = value;
+  container.querySelectorAll(".webpage-reference").forEach((el) => {
+    const displaySpan = document.createElement("span");
+    displaySpan.setAttribute("class", "webpage-reference-display");
+    displaySpan.setAttribute("contenteditable", "false");
+    Array.from(el.attributes).forEach((attr) => {
+      if (attr.name === "class") return;
+      displaySpan.setAttribute(attr.name, attr.value);
+    });
+    displaySpan.textContent = el.textContent || "";
+    el.replaceWith(displaySpan);
+  });
+  return container.innerHTML.replace(/\n/g, "<br/>");
+};
+
+const htmlToPlainText = (html: string) => {
+  const container = document.createElement("div");
+  container.innerHTML = html;
+  container.querySelectorAll(".webpage-reference-display").forEach((el) => {
+    const title = el.textContent || "";
+    const displayText = title.startsWith("@") ? title : `@${title}`;
+    el.replaceWith(displayText);
+  });
+  container.querySelectorAll(".webpage-reference").forEach((el) => {
+    const title = el.textContent || "";
+    el.replaceWith(`@${title}`);
+  });
+  return container.innerText.replace(/\u00A0/g, " ");
+};
+
+const htmlToValue = (html: string) => {
+  const container = document.createElement("div");
+  container.innerHTML = html;
+
+  container.querySelectorAll(".webpage-reference-display").forEach((el) => {
+    const span = document.createElement("span");
+    span.setAttribute("class", "webpage-reference");
+    const tabId = el.getAttribute("tab-id") || "";
+    const url = el.getAttribute("url") || "";
+    if (tabId) {
+      span.setAttribute("tab-id", tabId);
+    }
+    if (url) {
+      span.setAttribute("url", url);
+    }
+    const textContent = (el.textContent || "").replace(/^@/, "");
+    span.textContent = textContent;
+    el.replaceWith(span);
+  });
+
+  const placeholders: string[] = [];
+  container.querySelectorAll(".webpage-reference").forEach((el, index) => {
+    const token = `__WEB_REF_${index}__`;
+    placeholders.push(el.outerHTML);
+    el.replaceWith(token);
+  });
+
+  let plainText = container.innerText.replace(/\u00A0/g, " ");
+
+  placeholders.forEach((markup, index) => {
+    plainText = plainText.replace(`__WEB_REF_${index}__`, markup);
+  });
+
+  return plainText.trim();
+};
+
+const getHtmlToCaret = (editor: HTMLDivElement | null) => {
+  if (!editor) return null;
+  const selection = window.getSelection();
+  if (!selection || selection.rangeCount === 0) return null;
+  const range = selection.getRangeAt(0);
+  if (!editor.contains(range.endContainer)) return null;
+  const preRange = range.cloneRange();
+  preRange.selectNodeContents(editor);
+  preRange.setEnd(range.endContainer, range.endOffset);
+  const div = document.createElement("div");
+  div.appendChild(preRange.cloneContents());
+  return div.innerHTML;
+};
+
+const ensureSpaceAfterElement = (element: HTMLElement) => {
+  const parent = element.parentNode;
+  if (!parent) return;
+  const nextNode = element.nextSibling;
+  if (!nextNode) {
+    parent.appendChild(document.createTextNode(" "));
+    return;
+  }
+  if (nextNode.nodeType === Node.TEXT_NODE) {
+    const textNode = nextNode as Text;
+    if (!textNode.textContent?.startsWith(" ")) {
+      textNode.insertData(0, " ");
+    }
+  } else {
+    parent.insertBefore(document.createTextNode(" "), nextNode);
+  }
+};
+
+export const WebpageMentionInput: React.FC<WebpageMentionInputProps> = ({
+  value,
+  onChange,
+  disabled,
+  onSend,
+}) => {
+  const editorRef = useRef<HTMLDivElement>(null);
+  const tabListRef = useRef<HTMLDivElement>(null);
+  const [tabs, setTabs] = useState<TabInfo[]>([]);
+  const [showDropdown, setShowDropdown] = useState(false);
+  const [atPosition, setAtPosition] = useState<number | null>(null);
+  const [mentionQueryLength, setMentionQueryLength] = useState(0);
+  const [mentionQuery, setMentionQuery] = useState("");
+  const [highlightedIndex, setHighlightedIndex] = useState(0);
+  const [loadingTabs, setLoadingTabs] = useState(false);
+  const pendingFocusRefId = useRef<string | null>(null);
+  const skipSyncRef = useRef(false);
+
+  const resetMentionState = useCallback(() => {
+    setShowDrop
```

**File**: `example/extension/src/sidebar/index.css` (modified, +62/-0)
```diff
@@ -43,3 +43,65 @@ body {
   }
 }
 
+.tool-params-pre {
+  margin: 0;
+  font-size: 12px;
+  overflow-x: auto;
+  scrollbar-width: none;
+  -ms-overflow-style: none;
+}
+
+.tool-params-pre::-webkit-scrollbar {
+  display: none;
+}
+
+.chat-input-rich-container {
+  position: relative;
+  flex: 1;
+  margin: 0 4px;
+}
+
+.chat-input-editor {
+  max-height: 160px;
+  overflow-y: auto;
+  border: 1px solid #d9d9d9;
+  border-radius: 6px;
+  padding: 6px 11px;
+  font-size: 14px;
+  line-height: 1.5715;
+  transition: border-color 0.2s, box-shadow 0.2s;
+  white-space: pre-wrap;
+  word-break: break-word;
+}
+
+.chat-input-editor:focus {
+  border-color: #1677ff;
+  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.2);
+  outline: none;
+}
+
+.chat-input-editor:empty::before {
+  content: attr(data-placeholder);
+  color: rgba(0, 0, 0, 0.25);
+}
+
+.webpage-reference-display {
+  color: #1677ff;
+  background: rgba(22, 119, 255, 0.12);
+  border-radius: 4px;
+  padding: 0 4px;
+  cursor: pointer;
+  display: inline-flex;
+  align-items: center;
+}
+
+.user-webpage-reference {
+  color: white;
+  background: #4CAF50;
+}
+
+.webpage-reference-display::before {
+  content: "@";
+  margin-right: 2px;
+}
+
```

**File**: `example/extension/src/sidebar/index.tsx` (modified, +5/-1)
```diff
@@ -191,12 +191,16 @@ const AppRun = () => {
         style={{
           flex: 1,
           overflowY: "auto",
+          overflowX: "hidden",
           padding: "16px",
           backgroundColor: "#f5f5f5",
         }}
       >
         {messages.length === 0 ? (
-          <Empty description="Start a conversation!" style={{ marginTop: "20vh" }} />
+          <Empty
+            description="Start a conversation!"
+            style={{ marginTop: "20vh" }}
+          />
         ) : (
           messages.map((message) => (
             <MessageItem key={message.id} message={message} />
```

**File**: `example/extension/src/sidebar/types.ts` (modified, +10/-0)
```diff
@@ -64,6 +64,16 @@ export interface UploadedFile {
   url?: string; // URL after upload
 }
 
+export interface TabInfo {
+  tabId: string;
+  title: string;
+  url: string;
+  active: boolean;
+  iconUrl?: string;
+  status?: string;
+  lastAccessed: string;
+}
+
 export interface ChatMessage {
   id: string;
   role: MessageRole;
```

---

### Incident Patch 4: `a652f6ca` (2025-11-24)
**Commit Message**: chore: add markdown rendering

**File**: `example/extension/package.json` (modified, +7/-0)
```diff
@@ -16,17 +16,24 @@
     "@ant-design/icons": "^5.5.1",
     "react": "^18.2.0",
     "react-dom": "^18.2.0",
+    "react-markdown": "^9.0.1",
+    "remark-gfm": "^4.0.0",
+    "remark-math": "^6.0.0",
+    "rehype-katex": "^7.0.0",
+    "katex": "^0.16.11",
     "@eko-ai/eko": "workspace:*",
     "@eko-ai/eko-extension": "workspace:*"
   },
   "devDependencies": {
     "@types/chrome": "0.0.158",
     "@types/react": "^18.0.29",
     "@types/react-dom": "^18.0.11",
+    "css-loader": "^7.1.2",
     "copy-webpack-plugin": "^9.0.1",
     "glob": "^7.1.6",
     "prettier": "^2.2.1",
     "rimraf": "^3.0.2 ",
+    "style-loader": "^4.0.0",
     "ts-loader": "^8.0.0",
     "typescript": "^5.0.4",
     "webpack": "^5.94.0",
```

**File**: `example/extension/src/content/index.ts` (modified, +4/-0)
```diff
@@ -1 +1,5 @@
 declare const eko: any;
+declare module "react-markdown";
+declare module "remark-gfm";
+declare module "remark-math";
+declare module "rehype-katex";
```

**File**: `example/extension/src/sidebar/index.tsx` (modified, +51/-7)
```diff
@@ -23,6 +23,11 @@ import {
   CloseCircleOutlined,
   LoadingOutlined,
 } from "@ant-design/icons";
+import ReactMarkdown from "react-markdown";
+import remarkGfm from "remark-gfm";
+import remarkMath from "remark-math";
+import rehypeKatex from "rehype-katex";
+import "katex/dist/katex.min.css";
 import type {
   ChatStreamMessage,
   AgentStreamMessage,
@@ -34,7 +39,22 @@ import { uuidv4 } from "@eko-ai/eko";
 
 const { TextArea } = Input;
 const { Text, Paragraph } = Typography;
-const { Panel } = Collapse;
+
+const MarkdownRenderer = ({ content }: { content: string }) => {
+  if (!content) {
+    return null;
+  }
+  return (
+    <div className="markdown-body">
+      <ReactMarkdown
+        remarkPlugins={[remarkGfm, remarkMath]}
+        rehypePlugins={[rehypeKatex]}
+      >
+        {content}
+      </ReactMarkdown>
+    </div>
+  );
+};
 
 // 消息类型定义
 type MessageRole = "user" | "assistant";
@@ -474,15 +494,15 @@ const AppRun = () => {
     return (
       <div>
         {textArray.map(([streamId, streamText], index) => (
-          <Paragraph 
-            key={streamId} 
-            style={{ margin: index === 0 ? 0 : "8px 0 0 0", whiteSpace: "pre-wrap" }}
+          <div
+            key={streamId}
+            style={{ margin: index === 0 ? 0 : "8px 0 0 0" }}
           >
-            {streamText.text}
+            <MarkdownRenderer content={streamText.text} />
             {!streamText.streamDone && (
               <span className="streaming-cursor">▊</span>
             )}
-          </Paragraph>
+          </div>
         ))}
       </div>
     );
@@ -841,7 +861,9 @@ const AppRun = () => {
             <div style={{ marginBottom: 8 }}>{renderStreamText(message.texts)}</div>
           )}
           {!message.texts && message.content && (
-            <Paragraph style={{ margin: 0 }}>{message.content}</Paragraph>
+            <div style={{ marginBottom: 8 }}>
+              <MarkdownRenderer content={message.content} />
+            </div>
           )}
           {message.files && message.files.length > 0 && (
             <div style={{ marginBottom: 8 }}>
@@ -950,6 +972,28 @@ const AppRun = () => {
           animation: blink 1s infinite;
           color: #1890ff;
         }
+        .markdown-body {
+          font-size: 14px;
+          color: rgba(0, 0, 0, 0.88);
+        }
+        .markdown-body p {
+          margin: 0 0 8px 0;
+          white-space: pre-wrap;
+        }
+        .markdown-body ul,
+        .markdown-body ol {
+          margin: 0 0 8px 16px;
+        }
+        .markdown-body code {
+          background: rgba(0,0,0,0.04);
+          padding: 2px 4px;
+          border-radius: 4px;
+          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
+        }
+        .markdown-body pre code {
+          display: block;
+          padding: 12px;
+        }
         @keyframes blink {
           0%, 50% { opacity: 1; }
           51%, 100% { opacity: 0; }
```

**File**: `example/extension/webpack.config.js` (modified, +11/-0)
```diff
@@ -31,6 +31,17 @@ module.exports = {
         use: "ts-loader",
         exclude: /node_modules/,
       },
+      {
+        test: /\.css$/,
+        use: ["style-loader", "css-loader"],
+      },
+      {
+        test: /\.(woff2?|ttf|eot|otf|svg)$/,
+        type: "asset/resource",
+        generator: {
+          filename: "assets/[name][ext]",
+        },
+      },
     ],
   },
   resolve: {
```

---

### Incident Patch 5: `2eec7f51` (2025-11-24)
**Commit Message**: fix: build_dom_tree parent element hidden but child still visible

**File**: `packages/eko-core/src/agent/browser/build-dom-tree.ts` (modified, +8/-11)
```diff
@@ -587,21 +587,17 @@ export function run_build_dom_tree() {
       return false;
     }
 
-    // Helper function to check if element exists
-    function isElementExist(element) {
-      const style = getCachedComputedStyle(element);
-      return (
-        style?.visibility !== 'hidden' &&
-        style?.display !== 'none'
-      );
-    }
-
     // Helper function to check if element is visible
     function isElementVisible(element) {
       if (element.offsetWidth === 0 && element.offsetHeight === 0) {
         return false;
       }
-      return isElementExist(element);
+
+      const style = getCachedComputedStyle(element);
+      return (
+        style?.visibility !== 'hidden' &&
+        style?.display !== 'none'
+      );
     }
 
     // Helper function to check if element is the top element at its position
@@ -774,7 +770,8 @@ export function run_build_dom_tree() {
           console.warn('Unable to access iframe:', node);
         }
       } else {
-        if (isElementExist(node)) {
+        const style = getCachedComputedStyle(node);
+        if (style && style.display !== 'none') {
           const children = Array.from(node.children).map((child) =>
             buildDomTree(child, parentIframe)
           ).filter(child => child !== null);
```

---

### Incident Patch 6: `e56874a4` (2025-11-22)
**Commit Message**: fix: build_dom_tree parent element hidden but child still visible

**File**: `packages/eko-core/src/agent/browser/build_dom_tree.ts` (modified, +8/-11)
```diff
@@ -587,21 +587,17 @@ export function run_build_dom_tree() {
       return false;
     }
 
-    // Helper function to check if element exists
-    function isElementExist(element) {
-      const style = getCachedComputedStyle(element);
-      return (
-        style?.visibility !== 'hidden' &&
-        style?.display !== 'none'
-      );
-    }
-
     // Helper function to check if element is visible
     function isElementVisible(element) {
       if (element.offsetWidth === 0 && element.offsetHeight === 0) {
         return false;
       }
-      return isElementExist(element);
+
+      const style = getCachedComputedStyle(element);
+      return (
+        style?.visibility !== 'hidden' &&
+        style?.display !== 'none'
+      );
     }
 
     // Helper function to check if element is the top element at its position
@@ -774,7 +770,8 @@ export function run_build_dom_tree() {
           console.warn('Unable to access iframe:', node);
         }
       } else {
-        if (isElementExist(node)) {
+        const style = getCachedComputedStyle(node);
+        if (style && style.display !== 'none') {
           const children = Array.from(node.children).map((child) =>
             buildDomTree(child, parentIframe)
           ).filter(child => child !== null);
```

---

### Incident Patch 7: `9561859f` (2025-10-30)
**Commit Message**: fix: Multi-environment compatibility

**File**: `README.md` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ Follow these steps when moving an existing Eko 2.x project to 3.0:
 const llms: LLMs = {
   default: {
     provider: "anthropic",
-    model: "claude-sonnet-4-20250514",
+    model: "claude-sonnet-4-5-20250929",
     apiKey: "your-api-key"
   },
   gemini: {
```

**File**: `example/nodejs/package.json` (modified, +4/-3)
```diff
@@ -16,9 +16,10 @@
     "eko"
   ],
   "dependencies": {
-    "playwright": "^1.52.0",
-    "@eko-ai/eko": "file:../../packages/eko-core",
-    "@eko-ai/eko-nodejs": "file:../../packages/eko-nodejs"
+    "@eko-ai/eko": "workspace:*",
+    "@eko-ai/eko-nodejs": "workspace:*",
+    "canvas": "^3.2.0",
+    "playwright": "^1.52.0"
   },
   "devDependencies": {
     "@rollup/plugin-commonjs": "^28.0.3",
```

**File**: `example/nodejs/src/index.ts` (modified, +2/-2)
```diff
@@ -12,15 +12,15 @@ const claudeApiKey = process.env.ANTHROPIC_API_KEY;
 const llms: LLMs = {
   default: {
     provider: "anthropic",
-    model: "claude-sonnet-4-20250514",
+    model: "claude-sonnet-4-5-20250929",
     apiKey: claudeApiKey || "",
     config: {
       baseURL: claudeBaseURL,
     },
   },
   openai: {
     provider: "openai",
-    model: "gpt-5-mini",
+    model: "gpt-5",
     apiKey: openaiApiKey || "",
     config: {
       baseURL: openaiBaseURL,
```

**File**: `example/web/package.json` (modified, +2/-2)
```diff
@@ -17,8 +17,8 @@
     "react-dom": "^19.1.0",
     "react-scripts": "^5.0.1",
     "@react-login-page/base": "^1.0.4",
-    "@eko-ai/eko": "file:../../packages/eko-core",
-    "@eko-ai/eko-web": "file:../../packages/eko-web"
+    "@eko-ai/eko": "workspace:*",
+    "@eko-ai/eko-web": "workspace:*"
   },
   "browserslist": {
     "production": [
```

**File**: `example/web/src/main.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ export async function auto_test_case() {
   const llms: LLMs = {
     default: {
       provider: "anthropic",
-      model: "claude-sonnet-4-20250514",
+      model: "claude-sonnet-4-5-20250929",
       apiKey: "your_api_key",
       config: {
         baseURL: "https://api.anthropic.com/v1",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@eko-ai/eko",
-  "version": "3.1.3",
+  "version": "3.1.4",
   "description": "Empowering language to transform human words into action.",
   "workspaces": [
     "packages/eko-core",
```

**File**: `packages/eko-core/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@eko-ai/eko",
-  "version": "3.1.3-alpha.1",
+  "version": "3.1.4",
   "description": "Empowering language to transform human words into action.",
   "main": "dist/index.cjs.js",
   "module": "dist/index.esm.js",
```

**File**: `packages/eko-core/rollup.config.js` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@ export default [
         sourcemap: true
       }
     ],
-    external: ['dotenv'],
+    external: ['dotenv', 'buffer', 'canvas'],
     plugins: [
       commonjs(),
       resolve({
@@ -36,7 +36,7 @@ export default [
         sourcemap: true
       }
     ],
-    external: ['dotenv', 'buffer'],
+    external: ['dotenv', 'buffer', 'canvas'],
     plugins: [
       commonjs(),
       resolve({
```

---

### Incident Patch 8: `29e72217` (2025-10-27)
**Commit Message**: fix: iframe loop mark

**File**: `packages/eko-core/src/agent/browser/build_dom_tree.ts` (modified, +11/-7)
```diff
@@ -261,6 +261,7 @@ export function run_build_dom_tree() {
 
   function build_dom_tree(markHighlightElements) {
     let highlightIndex = 0; // Reset highlight index
+    let duplicates = new Set();
 
     function highlightElement(element, index, parentIframe = null) {
       // Create or get highlight container
@@ -679,7 +680,10 @@ export function run_build_dom_tree() {
 
     // Function to traverse the DOM and create nested JSON
     function buildDomTree(node, parentIframe = null) {
-      if (!node) return null;
+      if (!node || duplicates.has(node)) {
+        return null;
+      }
+      duplicates.add(node);
 
       // Special case for text nodes
       if (node.nodeType === Node.TEXT_NODE) {
@@ -750,9 +754,9 @@ export function run_build_dom_tree() {
 
       // Handle shadow DOM
       if (node.shadowRoot) {
-        const shadowChildren = Array.from(node.shadowRoot.childNodes).map((child) =>
+        const shadowChildren = Array.from(node.shadowRoot.children).map((child) =>
           buildDomTree(child, parentIframe)
-        );
+        ).filter(child => child !== null);
         nodeData.children.push(...shadowChildren);
       }
 
@@ -761,19 +765,19 @@ export function run_build_dom_tree() {
         try {
           const iframeDoc = node.contentDocument || node.contentWindow.document;
           if (iframeDoc) {
-            const iframeChildren = Array.from(iframeDoc.body.childNodes).map((child) =>
+            const iframeChildren = Array.from(iframeDoc.body.children).map((child) =>
               buildDomTree(child, node)
-            );
+            ).filter(child => child !== null);
             nodeData.children.push(...iframeChildren);
           }
         } catch (e) {
           console.warn('Unable to access iframe:', node);
         }
       } else {
         if (isElementExist(node)) {
-          const children = Array.from(node.childNodes).map((child) =>
+          const children = Array.from(node.children).map((child) =>
             buildDomTree(child, parentIframe)
-          );
+          ).filter(child => child !== null);
           nodeData.children.push(...children);
         }
       }
```

---

### Incident Patch 9: `65950102` (2025-10-22)
**Commit Message**: chore: improve build_dom_tree

**File**: `packages/eko-core/src/agent/browser/build_dom_tree.ts` (modified, +32/-27)
```diff
@@ -494,6 +494,35 @@ export function run_build_dom_tree() {
 
       if (hasInteractiveRole) return true;
 
+      // const eventTypes = [
+      //   'click',
+      //   'mousedown',
+      //   'mouseup',
+      //   'touchstart',
+      //   'touchend',
+      //   'keydown',
+      //   'keyup',
+      //   'focus',
+      //   'blur',
+      // ];
+
+      const clickEventTypes = [
+        'click',
+        'mousedown',
+        'mouseup',
+        'touchstart',
+        'touchend',
+      ];
+
+      // Filter elements that have no real event listeners at all
+      if (window.getEventListeners) {
+        const listeners = window.getEventListeners(element);
+        const hasRealClickListeners = clickEventTypes.some((type) => listeners[type]?.length > 0);
+        if (!hasRealClickListeners) {
+          return false;
+        }
+      }
+
       // Check for event listeners
       const hasClickHandler =
         element.onclick !== null ||
@@ -504,28 +533,10 @@ export function run_build_dom_tree() {
 
       // Helper function to safely get event listeners
       function getElementEventListeners(el) {
-        // if (window.getEventListeners) {
-        //   const listeners = window.getEventListeners?.(el);
-        //   if (listeners) {
-        //     return listeners;
-        //   }
-        // }
-
         // List of common event types to check
         const listeners = {};
-        const eventTypes = [
-          'click',
-          'mousedown',
-          'mouseup',
-          'touchstart',
-          'touchend',
-          'keydown',
-          'keyup',
-          'focus',
-          'blur',
-        ];
-
-        for (const type of eventTypes) {
+
+        for (const type of clickEventTypes) {
           const handler = el[`on${type}`];
           if (handler) {
             listeners[type] = [
@@ -542,13 +553,7 @@ export function run_build_dom_tree() {
 
       // Check for click-related events on the element itself
       const listeners = getElementEventListeners(element);
-      const hasClickListeners =
-        listeners &&
-        (listeners.click?.length > 0 ||
-          listeners.mousedown?.length > 0 ||
-          listeners.mouseup?.length > 0 ||
-          listeners.touchstart?.length > 0 ||
-          listeners.touchend?.length > 0);
+      const hasClickListeners = clickEventTypes.some((type) => listeners[type]?.length > 0);
 
       // Check for ARIA properties that suggest interactivity
       const hasAriaProps =
```

---

### Incident Patch 10: `a52c4a68` (2025-10-22)
**Commit Message**: fix: build_dom_tree bug

**File**: `packages/eko-core/src/agent/browser/build_dom_tree.ts` (modified, +36/-31)
```diff
@@ -199,23 +199,23 @@ export function run_build_dom_tree() {
     let depth = 0;
 
     while (win && win !== win.parent && depth < maxDepth) {
-        depth++;
-        const frameElement = win.frameElement;
-        if (!frameElement) {
-            break;
-        }
-        
-        const frameRect = frameElement.getBoundingClientRect();
-        x += frameRect.left;
-        y += frameRect.top;
-
-        // Consider the border and padding of the iframe.
-        const frameStyle = getCachedComputedStyle(frameElement);
-        x += parseFloat(frameStyle.borderLeftWidth) || 0;
-        y += parseFloat(frameStyle.borderTopWidth) || 0;
-        x += parseFloat(frameStyle.paddingLeft) || 0;
-        y += parseFloat(frameStyle.paddingTop) || 0;
-        win = win.parent;
+      depth++;
+      const frameElement = win.frameElement;
+      if (!frameElement) {
+        break;
+      }
+
+      const frameRect = frameElement.getBoundingClientRect();
+      x += frameRect.left;
+      y += frameRect.top;
+
+      // Consider the border and padding of the iframe.
+      const frameStyle = getCachedComputedStyle(frameElement);
+      x += parseFloat(frameStyle.borderLeftWidth) || 0;
+      y += parseFloat(frameStyle.borderTopWidth) || 0;
+      x += parseFloat(frameStyle.paddingLeft) || 0;
+      y += parseFloat(frameStyle.paddingTop) || 0;
+      win = win.parent;
     }
     return { x, y, width, height };
   }
@@ -489,7 +489,7 @@ export function run_build_dom_tree() {
         interactiveRoles.has(ariaRole) ||
         (tabIndex !== null && tabIndex !== '-1') ||
         element.getAttribute('data-action') === 'a-dropdown-select' ||
-        element.getAttribute('data-action') === 'a-dropdown-button' || 
+        element.getAttribute('data-action') === 'a-dropdown-button' ||
         element.getAttribute('contenteditable') === 'true';
 
       if (hasInteractiveRole) return true;
@@ -504,12 +504,12 @@ export function run_build_dom_tree() {
 
       // Helper function to safely get event listeners
       function getElementEventListeners(el) {
-        if (window.getEventListeners) {
-          const listeners = window.getEventListeners?.(el);
-          if (listeners) {
-            return listeners;
-          }
-        }
+        // if (window.getEventListeners) {
+        //   const listeners = window.getEventListeners?.(el);
+        //   if (listeners) {
+        //     return listeners;
+        //   }
+        // }
 
         // List of common event types to check
         const listeners = {};
@@ -577,22 +577,27 @@ export function run_build_dom_tree() {
         }
         return true;
       }
-      
+
       return false;
     }
 
-    // Helper function to check if element is visible
-    function isElementVisible(element) {
-      if (element.offsetWidth === 0 && element.offsetHeight === 0) {
-        return false;
-      }
+    // Helper function to check if element exists
+    function isElementExist(element) {
       const style = getCachedComputedStyle(element);
       return (
         style?.visibility !== 'hidden' &&
         style?.display !== 'none'
       );
     }
 
+    // Helper function to check if element is visible
+    function isElementVisible(element) {
+      if (element.offsetWidth === 0 && element.offsetHeight === 0) {
+        return false;
+      }
+      return isElementExist(element);
+    }
+
     // Helper function to check if element is the top element at its position
     function isTopElement(element) {
       // Find the correct document context and root element
@@ -760,7 +765,7 @@ export function run_build_dom_tree() {
           console.warn('Unable to access iframe:', node);
         }
       } else {
-        if (nodeData.isVisible != false) {
+        if (isElementExist(node)) {
           const children = Array.from(node.childNodes).map((child) =>
             buildDomTree(child, parentIframe)
           );
```

---

### Incident Patch 11: `a5038ceb` (2025-10-21)
**Commit Message**: chore: modify build_dom_tree

**File**: `packages/eko-core/src/agent/browser/build_dom_tree.ts` (modified, +33/-26)
```diff
@@ -489,16 +489,11 @@ export function run_build_dom_tree() {
         interactiveRoles.has(ariaRole) ||
         (tabIndex !== null && tabIndex !== '-1') ||
         element.getAttribute('data-action') === 'a-dropdown-select' ||
-        element.getAttribute('data-action') === 'a-dropdown-button';
+        element.getAttribute('data-action') === 'a-dropdown-button' || 
+        element.getAttribute('contenteditable') === 'true';
 
       if (hasInteractiveRole) return true;
 
-      // Get computed style
-      const style = getCachedComputedStyle(element);
-
-      // Check if element has click-like styling
-      const hasClickStyling = style.cursor === 'pointer' || element.style.cursor === 'pointer';
-
       // Check for event listeners
       const hasClickHandler =
         element.onclick !== null ||
@@ -508,10 +503,13 @@ export function run_build_dom_tree() {
         element.hasAttribute('v-on:click');
 
       // Helper function to safely get event listeners
-      function getEventListeners(el) {
-        // if (window.getEventListeners) {
-        //   return window.getEventListeners?.(el) || {};
-        // }
+      function getElementEventListeners(el) {
+        if (window.getEventListeners) {
+          const listeners = window.getEventListeners?.(el);
+          if (listeners) {
+            return listeners;
+          }
+        }
 
         // List of common event types to check
         const listeners = {};
@@ -543,7 +541,7 @@ export function run_build_dom_tree() {
       }
 
       // Check for click-related events on the element itself
-      const listeners = getEventListeners(element);
+      const listeners = getElementEventListeners(element);
       const hasClickListeners =
         listeners &&
         (listeners.click?.length > 0 ||
@@ -559,23 +557,28 @@ export function run_build_dom_tree() {
         element.hasAttribute('aria-selected') ||
         element.hasAttribute('aria-checked');
 
-      // Check for form-related functionality
-      const isFormRelated =
-        element.form !== undefined ||
-        element.hasAttribute('contenteditable') ||
-        (style && style.userSelect !== 'none');
-
       // Check if element is draggable
       const isDraggable = element.draggable || element.getAttribute('draggable') === 'true';
 
-      return (
-        hasAriaProps ||
-        hasClickStyling ||
-        hasClickHandler ||
-        hasClickListeners ||
-        // isFormRelated ||
-        isDraggable
-      );
+      if (hasAriaProps || hasClickHandler || hasClickListeners || isDraggable) {
+        return true;
+      }
+
+      // Check if element has click-like styling
+      let hasClickStyling = element.style.cursor === 'pointer' || getCachedComputedStyle(element).cursor === 'pointer';
+      if (hasClickStyling) {
+        let count = 0;
+        let current = element.parentElement;
+        while (current && current !== document.documentElement) {
+          hasClickStyling = current.style.cursor === 'pointer' || getCachedComputedStyle(current).cursor === 'pointer';
+          if (hasClickStyling) return false;
+          current = current.parentElement;
+          if (++count > 10) break;
+        }
+        return true;
+      }
+      
+      return false;
     }
 
     // Helper function to check if element is visible
@@ -612,10 +615,12 @@ export function run_build_dom_tree() {
           if (!topEl) return false;
 
           // Check if the element or any of its parents match our target element
+          let count = 0;
           let current = topEl;
           while (current && current !== shadowRoot) {
             if (current === element) return true;
             current = current.parentElement;
+            if (++count > 15) break;
           }
           return false;
         } catch (e) {
@@ -631,10 +636,12 @@ export function run_build_dom_tree() {
         const topEl = document.elementFromPoint(point.x, point.y);
         if (!topEl) return false;
 
+        let count = 0;
         let current = topEl;
         while (current && current !== document.documentElement) {
           if (current === element) return true;
           current = current.parentElement;
+          if (++count > 15) break;
         }
         return false;
       } catch (e) {
```

#### Recent Merged Pull Requests:
- **PR #280** (closed): fix: buffer stdout chunks and parse complete newline-delimited JSON messages (@redinside-dev)
- **PR #273** (closed): feat: apply dark grey and purple theme to extension sidebar (@chalizardking)
- **PR #268** (closed): Update package manager from pnpm to bun (@akemmanuel)
- **PR #264** (closed): feat: add DOM-first navigation with visual fallback for browser agent (@ProneoAI)
- **PR #262** (2025-10-30): fix: Multi-environment compatibility (@veasion)
- **PR #260** (2025-10-27): chore: compress image (@veasion)
- **PR #259** (2025-10-27): Develop (@veasion)
- **PR #258** (2025-10-27): feat: ModelScope and qwen models support (@yrk111222)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
