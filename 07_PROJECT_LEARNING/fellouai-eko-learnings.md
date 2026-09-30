# Forensic Learning Record (Deep Inspection): FellouAI/eko

> **Canonical Artifact**: `07_PROJECT_LEARNING/fellouai-eko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FellouAI/eko](https://github.com/FellouAI/eko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:56:00.809Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FellouAI/eko`
- **Description**: Eko (Eko Keeps Operating) - Build Production-ready Agentic Workflow with Natural Language - eko.fellou.ai
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4963 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example/extension/src/background/agent/browser-service.ts`
```
import { BrowserService } from "@eko-ai/eko";
import { PageTab, PageContent } from "@eko-ai/eko/types";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");

export class SimpleBrowserService implements BrowserService {
  async loadTabs(
    chatId: string,
    tabIds?: string[] | undefined
  ): Promise<PageTab[]> {
    let tabs = await chrome.tabs.query({});
    if (tabIds) {
      tabs = tabs.filter((tab) => tabIds.includes(String(tab.id)));
    }
    const sortedTabs = tabs
      .sort((a, b) => {
        const aTime = (a as any).lastAccessed || 0;
        const bTime = (b as any).lastAccessed || 0;
        return bTime - aTime;
      })
      .filter((tab) => !tab.url.startsWith("chrome://"))
      .map((tab) => {
        const lastAccessed = (tab as any).lastAccessed;
        const pageTab: PageTab = {
          tabId: String(tab.id),
          windowId: String(tab.windowId),
          title: tab.title || "",
          url: tab.url || "",
          active: tab.active,
          status: tab.status as "unloaded" | "loading" | "complete",
          favicon: tab.favIconUrl,
          lastAccessed: lastAccessed
            ? new Date(lastAccessed).toLocaleString()
            : undefined,
        };
        return pageTab;
      })
      .slice(0, 15);
    return Promise.resolve(sortedTabs);
  }

  async extractPageContents(
    chatId: string,
    tabIds: string[]
  ): Promise<PageContent[]> {
    const contents: PageContent[] = [];
    for (const tabId of tabIds) {
      const tab = await chrome.tabs.get(Number(tabId));
      const frameResults = await chrome.scripting.executeScript({
        target: { tabId: Number(tabId) },
        func: extractPageContent,
        args: [],
      });
      let tabHtmls = frameResults[0].result as string;
      if (!tabHtmls) {
        tabHtmls = await this.extractPdfContent(tab.url);
      }
      contents.push({
        tabId: tabId,
        url: tab.url,
        title: tab.title,
        content: tabHtmls,
      });
    }
    return Promise.resolve(contents);
  }

  private async extractPdfContent(pdfUrl: string): Promise<string> {
    try {
      const loadingTask = getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      let textContent = "";

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textData = await page.getTextContent();
        const pageText = textData.items.map((item: any) => item.str).join(" ");
        textContent += `PDF Page ${pageNum}:\n${pageText}\n\n`;
      }

      return textContent;
    } catch (error) {
      console.warn("Unable to load PDF:", error);
      return "";
    }
  }
}

function extractPageContent(max_url_length = 200) {
  let result = "";
  max_url_length = max_url_length || 200;
  try {
    function traverse(node: any) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        if (["script", "style", "noscript"].includes(tagName)) {
          return;
        }
        const style = window.getComputedStyle(node);
        if (
          style.display == "none" ||
          style.visibility == "hidden" ||
          style.opacity == "0"
        ) {
          return;
        }
      }
      if (node.nodeType === Node.TEXT_NODE) {
        // text
        const text = node.textContent.trim();
        if (text) {
          result += text + " ";
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        if (["input", "select", "textarea"].includes(tagName)) {
          // input / select / textarea
          if (tagName == "input" && node.type == "checkbox") {
            result += node.checked + " ";
          } else if (tagName == "input" && node.type == "radio") {
            if (node.checked && node.value) {
              result += node.value + " ";
            }
          } else if (node.value) {
            result += node.value + " ";
          }
        } else if (tagName === "img") {
          // image
          const src =
            node.src ||
            node.getAttribute("src") ||
            node.getAttribute("data-src");
          const alt = node.alt || node.title || "";
          if (
            src &&
            src.length <= max_url_length &&
            node.width * node.height >= 10000 &&
            src.startsWith("http")
          ) {
            result += `![${alt ? alt : "image"}](${src.trim()}) `;
          }
        } else if (tagName === "a" && node.children.length == 0) {
          // link
          const href = node.href || node.getAttribute("href");
          const text = node.innerText.trim() || node.title;
          if (
            text &&
            href &&
            href.length <= max_url_length &&
            href.startsWith("http")
          ) {
            result += `[${text}](${href.trim()}) `;
          } else {
            result += text + " ";
          }
        } else if (tagName === "video" || tagName == "audio") {
          // video / audio
          let src = node.src || node.getAttribute("src");
          const sources = node.querySelectorAll("source");
          if (sources.length > 0 && sources[0].src) {
            src = sources[0].src;
            if (src && src.startsWith("http") && sources[0].type) {
              result += sources[0].type + " ";
            }
          }
          if (src && src.startsWith("http")) {
            result += src.trim() + " ";
          }
        } else if (tagName === "br") {
          // br
          result += "\n";
        } else if (
          ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)
        ) {
          // block
          result += "\n";
          for (let child of node.childNodes) {
            traverse(child);
          }
          result += "\n";
          return;
        } else if (tagName === "hr") {
          // hr
          result += "\n--------\n";
        } else {
          // recursive
          for (let child of node.childNodes) {
            traverse(child);
          }
        }
      }
    }

    traverse(document.body);
  } catch (e) {
    result = document.body.innerText;
  }
  return result.replace(/\s*\n/g, "\n").replace(/\n+/g, "\n").trim();
}

```

### Core Architecture Module: `example/extension/src/background/agent/chat-service.ts`
```
import { ChatService, uuidv4 } from "@eko-ai/eko";
import { EkoMessage, WebSearchResult } from "@eko-ai/eko/types";

export class SimpleChatService implements ChatService {
  loadMessages(chatId: string): Promise<EkoMessage[]> {
    return Promise.resolve([]);
  }

  addMessage(chatId: string, messages: EkoMessage[]): Promise<void> {
    return Promise.resolve();
  }

  memoryRecall(chatId: string, prompt: string): Promise<string> {
    return Promise.resolve("");
  }

  async uploadFile(
    file: { base64Data: string; mimeType: string; filename?: string },
    chatId: string,
    taskId?: string | undefined
  ): Promise<{
    fileId: string;
    url: string;
  }> {
    return Promise.resolve({
      fileId: uuidv4(),
      url: file.base64Data.startsWith('data:')
        ? file.base64Data
        : `data:${file.mimeType};base64,${file.base64Data}`,
    });
  }

  websearch(
    chatId: string,
    query: string,
    site?: string,
    language?: string,
    maxResults?: number
  ): Promise<WebSearchResult[]> {
    return Promise.resolve([]);
  }
}

```

### Core Architecture Module: `example/extension/src/background/agent/file-agent.ts`
```
import { Agent, AgentContext } from "@eko-ai/eko";
import { LanguageModelV2ToolCallPart, ToolResult } from "@eko-ai/eko/types";

export default class WriteFileAgent extends Agent {
  constructor() {
    super({
      name: "WriteFile",
      description:
        "File writing tool, used for writing content to local files.",
      tools: [
        {
          name: "write_file",
          parameters: {
            type: "object",
            properties: {
              filename: {
                type: "string",
                description:
                  "File name only, path is not supported. For example: data.md",
              },
              content: {
                type: "string",
                description: "The content to write to the file.",
              },
            },
          },
          execute: async (
            args: Record<string, unknown>,
            agentContext: AgentContext,
            toolCall: LanguageModelV2ToolCallPart
          ): Promise<ToolResult> => {
            return this.writeFile(
              args.filename as string,
              args.content as string
            );
          },
        },
      ],
      llms: [],
    });
  }

  private async writeFile(
    filename: string,
    content: string
  ): Promise<ToolResult> {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const encodedContent = encodeURIComponent(content);
    const dataUrl = `data:text/plain;charset=utf-8,${encodedContent}`;
    await new Promise<void>((resolve, reject) => {
      chrome.downloads.download(
        {
          url: dataUrl,
          filename: sanitizedFilename,
          saveAs: false,
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (downloadId === undefined) {
            reject(new Error("Failed to download: no download ID returned"));
          } else {
            resolve();
          }
        }
      );
    });

    return {
      content: [
        {
          type: "text",
          text: `File written successfully: ${sanitizedFilename}`,
        },
      ],
    };
  }

  private sanitizeFilename(filename: string): string {
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;
    let sanitized = filename.replace(invalidChars, "_");
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, "");
    if (!sanitized) {
      sanitized = "untitled.txt";
    }
    if (sanitized.length > 255) {
      const ext = this.getFileExtension(sanitized);
      const nameWithoutExt = sanitized.slice(0, 255 - ext.length);
      sanitized = nameWithoutExt + ext;
    }
    return sanitized;
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot !== -1 ? filename.slice(lastDot) : "";
  }
}

export { WriteFileAgent };

```

### Core Architecture Module: `example/extension/src/background/agent/index.ts`
```
import { config, global } from "@eko-ai/eko";
import { SimpleChatService } from "./chat-service";
import { SimpleBrowserService } from "./browser-service";

export function initAgentServices() {
  config.workflowConfirm = false;
  global.browserService = new SimpleBrowserService();
  global.chatService = new SimpleChatService();
}

```

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

### Core Architecture Module: `example/extension/src/background/index.ts`
```
import {
  LLMs,
  config,
  global,
  uuidv4,
  ChatAgent,
  AgentContext,
  AgentStreamMessage,
} from "@eko-ai/eko";
import {
  HumanCallback,
  MessageTextPart,
  MessageFilePart,
  ChatStreamMessage,
  AgentStreamCallback,
} from "@eko-ai/eko/types";
import { initAgentServices } from "./agent";
import WriteFileAgent from "./agent/file-agent";
import { BrowserAgent } from "@eko-ai/eko-extension";

var chatAgent: ChatAgent | null = null;
const callbackIdMap = new Map<string, Function>();
const abortControllers = new Map<string, AbortController>();

// Chat callback
const chatCallback = {
  onMessage: async (message: ChatStreamMessage) => {
    chrome.runtime.sendMessage({
      type: "chat_callback",
      data: message,
    });
    console.log("chat message: ", JSON.stringify(message, null, 2));
  },
};

// Task agent callback
const taskCallback: AgentStreamCallback & HumanCallback = {
  onMessage: async (message: AgentStreamMessage) => {
    chrome.runtime.sendMessage({
      type: "task_callback",
      data: { ...message, messageId: message.taskId },
    });
    if (message.type === "workflow_confirm") {
      callbackIdMap.set(message.taskId, (value: "confirm" | "cancel") => {
        callbackIdMap.delete(message.taskId);
        message.resolve(value);
      });
    }
    console.log("task message: ", JSON.stringify(message, null, 2));
  },
  onHumanConfirm: async (context: AgentContext, prompt: string) => {
    const callbackId = uuidv4();
    chrome.runtime.sendMessage({
      type: "task_callback",
      data: {
        streamType: "agent",
        chatId: context.context.chatId,
        taskId: context.context.taskId,
        agentName: context.agent.Name,
        nodeId: context.agentChain.agent.id,
        messageId: context.context.taskId,
        type: "human_confirm",
        callbackId: callbackId,
        prompt: prompt,
      },
    });
    console.log("human_confirm: ", prompt);
    return new Promise((resolve) => {
      callbackIdMap.set(callbackId, (value: boolean) => {
        callbackIdMap.delete(callbackId);
        resolve(value);
      });
    });
  },
  onHumanInput: async (context: AgentContext, prompt: string) => {
    const callbackId = uuidv4();
    chrome.runtime.sendMessage({
      type: "task_callback",
      data: {
        streamType: "agent",
        chatId: context.context.chatId,
        taskId: context.context.taskId,
        agentName: context.agent.Name,
        nodeId: context.agentChain.agent.id,
        messageId: context.context.taskId,
        type: "human_input",
        callbackId: callbackId,
        prompt: prompt,
      },
    });
    console.log("human_input: ", prompt);
    return new Promise((resolve) => {
      callbackIdMap.set(callbackId, (value: string) => {
        callbackIdMap.delete(callbackId);
        resolve(value);
      });
    });
  },
  onHumanSelect: async (
    context: AgentContext,
    prompt: string,
    options: string[],
    multiple: boolean
  ) => {
    const callbackId = uuidv4();
    chrome.runtime.sendMessage({
      type: "task_callback",
      data: {
        streamType: "agent",
        chatId: context.context.chatId,
        taskId: context.context.taskId,
        agentName: context.agent.Name,
        nodeId: context.agentChain.agent.id,
        messageId: context.context.taskId,
        type: "human_select",
        callbackId: callbackId,
        prompt: prompt,
        options: options,
        multiple: multiple,
      },
    });
    console.log("human_select: ", prompt);
    return new Promise((resolve) => {
      callbackIdMap.set(callbackId, (value: string[]) => {
        callbackIdMap.delete(callbackId);
        resolve(value);
      });
    });
  },
  onHumanHelp: async (
    context: AgentContext,
    helpType: "request_login" | "request_assistance",
    prompt: string
  ) => {
    const callbackId = uuidv4();
    chrome.runtime.sendMessage({
      type: "task_callback",
      data: {
        streamType: "agent",
        chatId: context.context.chatId,
        taskId: context.context.taskId,
        agentName: context.agent.Name,
        nodeId: context.agentChain.agent.id,
        messageId: context.context.taskId,
        type: "human_help",
        callbackId: callbackId,
        helpType: helpType,
        prompt: prompt,
      },
    });
    console.log("human_help: ", prompt);
    return new Promise((resolve) => {
      callbackIdMap.set(callbackId, (value: boolean) => {
        callbackIdMap.delete(callbackId);
        resolve(value);
      });
    });
  },
};

async function loadLLMs(): Promise<LLMs> {
  const storageKey = "llmConfig";
  const llmConfig = (await chrome.storage.sync.get([storageKey]))[storageKey];
  if (!llmConfig || !llmConfig.apiKey) {
    printLog(
      "Please configure apiKey, configure in the eko extension options of the browser extensions.",
      "error"
    );
    setTimeout(() => {
      chrome.runtime.openOptionsPage();
    }, 1000);
    return;
  }
  const llms: LLMs = {
    default: {
      provider: llmConfig.llm as any,
      model: llmConfig.modelName,
      apiKey: llmConfig.apiKey,
      config: {
        baseURL: llmConfig.options.baseURL,
      },
    },
  };

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "sync" && changes[storageKey]) {
      const newConfig = changes[storageKey].newValue;
      if (newConfig) {
        llms.default.provider = newConfig.llm as any;
        llms.default.model = newConfig.modelName;
        llms.default.apiKey = newConfig.apiKey;
        llms.default.config.baseURL = newConfig.options.baseURL;
        console.log("LLM config updated");
      }
    }
  });

  return llms;
}

async function init(): Promise<ChatAgent | void> {
  initAgentServices();

  const llms = await loadLLMs();
  const agents = [new BrowserAgent(), new WriteFileAgent()];
  // agents.forEach((agent) =>
  //   agent.Tools.forEach((tool) => wrapToolInputSchema(agent, tool))
  // );
  chatAgent = new ChatAgent({ llms, agents });
  chatAgent.initMessages().catch((e) => {
    printLog("init messages error: " + e, "error");
  });

  return chatAgent;
}

// Handle chat request
async function handleChat(requestId: string, data: any): Promise<void> {
  const messageId = data.messageId;

  if (!chatAgent) {
    chrome.runtime.sendMessage({
      requestId,
      type: "chat_result",
      data: { messageId, error: "ChatAgent not initialized" },
    });
    return;
  }

  const windowId = data.windowId as number;
  const user = data.user as (MessageTextPart | MessageFilePart)[];
  const abortController = new AbortController();
  abortControllers.set(messageId, abortController);

  try {
    const result = await chatAgent.chat({
      user: user,
      messageId,
      callback: {
        chatCallback,
        taskCallback,
      },
      extra: {
        windowId: windowId,
      },
      signal: abortController.signal,
    });
    chrome.runtime.sendMessage({
      requestId,
      type: "chat_result",
      data: { messageId, result },
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      requestId,
      type: "chat_result",
      data: { messageId, error: String(error) },
    });
  }
}

// Handle callback request
async function handleCallback(requestId: string, data: any): Promise<void> {
  const callbackId = data.callbackId as string;
  const value = data.value as any;
  const callback = callbackIdMap.get(callbackId);
  if (callback) {
    callback(value);
  }
  chrome.runtime.sendMessage({
    requestId,
    type: "callback_result",
    data: { callbackId, success: callback != null },
  });
}

// Handle upload file request
async function handleUploadFile(requestId: string, data: any): Promise<void> {
  if (!chatAgent) {
    chrome.runtime.sendMessage({
      requestId,
      type: "uploadFile_result",
      data: { error: "ChatAgent not initialized" },
    });
    return;
  }

  const base64Data = data.base64Data as string;
  const mimeType = data.mimeT
```

### Core Architecture Module: `example/extension/src/content/index.ts`
```
declare const eko: any;
declare module "react-markdown";
declare module "remark-gfm";
declare module "remark-math";
declare module "rehype-katex";

```

### Core Architecture Module: `example/extension/src/options/index.tsx`
```
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Form, Input, Button, message, Card, Select, AutoComplete } from "antd";

const { Option } = Select;

const OptionsPage = () => {
  const [form] = Form.useForm();

  const [config, setConfig] = useState({
    llm: "anthropic",
    apiKey: "",
    modelName: "claude-sonnet-4-6",
    options: {
      baseURL: "https://api.anthropic.com/v1",
    },
  });

  const [historyLLMConfig, setHistoryLLMConfig] = useState<Record<string, any>>(
    {}
  );

  useEffect(() => {
    chrome.storage.sync.get(["llmConfig", "historyLLMConfig"], (result) => {
      if (result.llmConfig) {
        if (result.llmConfig.llm === "") {
          result.llmConfig.llm = "anthropic";
        }
        setConfig(result.llmConfig);
        form.setFieldsValue(result.llmConfig);
      }
      if (result.historyLLMConfig) {
        setHistoryLLMConfig(result.historyLLMConfig);
      }
    });
  }, []);

  const handleSave = () => {
    form
      .validateFields()
      .then((value) => {
        setConfig(value);
        setHistoryLLMConfig({
          ...historyLLMConfig,
          [value.llm]: value,
        });
        chrome.storage.sync.set(
          {
            llmConfig: value,
            historyLLMConfig: {
              ...historyLLMConfig,
              [value.llm]: value,
            },
          },
          () => {
            message.success("Save Success!");
          }
        );
      })
      .catch(() => {
        message.error("Please check the form field");
      });
  };

  const modelLLMs = [
    { value: "anthropic", label: "Claude (default)" },
    { value: "openai", label: "OpenAI" },
    { value: "openrouter", label: "OpenRouter" },
    { value: "google", label: "Google Generative" },
    { value: "bedrock", label: "AWS Bedrock" },
    { value: "azure", label: "Microsoft Azure" },
    { value: "openai-compatible", label: "OpenAI Compatible" },
    { value: "modelscope", label: "ModelScope" },
  ];

  const modelOptions = {
    anthropic: [
      {
        value: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6 (default)",
      },
      { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
    ],
    openai: [
      { value: "gpt-5.2", label: "gpt-5.2 (default)" },
      { value: "gpt-5.1", label: "gpt-5.1" },
      { value: "gpt-5", label: "gpt-5" },
      { value: "gpt-5-mini", label: "gpt-5-mini" },
      { value: "gpt-4.1", label: "gpt-4.1" },
      { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { value: "o4-mini", label: "o4-mini" },
    ],
    openrouter: [
      {
        value: "anthropic/claude-sonnet-4.6",
        label: "claude-sonnet-4.6 (default)",
      },
      { value: "anthropic/claude-sonnet-4.5", label: "claude-sonnet-4.5" },
      { value: "anthropic/claude-sonnet-4", label: "claude-sonnet-4" },
      { value: "google/gemini-3-pro-preview", label: "gemini-3-pro-preview" },
      {
        value: "google/gemini-3-flash-preview",
        label: "gemini-3-flash-preview",
      },
      { value: "google/gemini-3-pro", label: "gemini-3-pro" },
      { value: "google/gemini-2.5-pro", label: "gemini-2.5-pro" },
      { value: "openai/gpt-5.2", label: "gpt-5.2" },
      { value: "openai/gpt-5.1", label: "gpt-5.1" },
      { value: "openai/gpt-5", label: "gpt-5" },
      { value: "openai/gpt-5-mini", label: "gpt-5-mini" },
      { value: "openai/gpt-4.1", label: "gpt-4.1" },
      { value: "openai/o4-mini", label: "o4-mini" },
      { value: "openai/gpt-4.1-mini", label: "gpt-4.1-mini" },
      { value: "x-ai/grok-4", label: "grok-4" },
      { value: "x-ai/grok-4-fast", label: "grok-4-fast" },
    ],
    google: [
      {
        value: "gemini-3-pro-preview",
        label: "gemini-3-pro-preview (default)",
      },
      { value: "gemini-3-flash-preview", label: "gemini-3-flash-preview" },
      { value: "gemini-3-pro", label: "gemini-3-pro" },
      { value: "gemini-2.5-pro", label: "gemini-2.5-pro" },
      { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    ],
    bedrock: [
      {
        value: "us.anthropic.claude-sonnet-4-6",
        label: "claude-sonnet-4-6 (default)",
      },
      {
        value: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        label: "claude-sonnet-4-5",
      },
      {
        value: "us.anthropic.claude-opus-4-1-20250805-v1:0",
        label: "claude-opus-4-1",
      },
      {
        value: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        label: "claude-sonnet-4",
      },
    ],
    azure: [
      { value: "gpt-5.2", label: "gpt-5.2 (default)" },
      { value: "gpt-5.1", label: "gpt-5.1" },
      { value: "gpt-5", label: "gpt-5" },
      { value: "gpt-4.1", label: "gpt-4.1" },
      { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
    ],
    "openai-compatible": [{ value: "", label: "Please enter the model" }],
    modelscope: [
      {
        value: "Qwen/Qwen3-VL-30B-A3B-Instruct",
        label: "Qwen3-VL-30B-A3B-Instruct (default)",
      },
      {
        value: "Qwen/Qwen3-VL-30B-A3B-Thinking",
        label: "Qwen3-VL-30B-A3B-Thinking",
      },
      {
        value: "Qwen/Qwen3-VL-235B-A22B-Instruct",
        label: "Qwen3-VL-235B-A22B-Instruct",
      },
      {
        value: "Qwen/Qwen3-VL-8B-Instruct",
        label: "Qwen3-VL-8B-Instruct",
      },
    ],
  };

  const handleLLMChange = (value: string) => {
    const baseURLMap = {
      openai: "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com/v1",
      openrouter: "https://openrouter.ai/api/v1",
      modelscope: "https://api-inference.modelscope.cn/v1",
      // https://{resourceName}.cognitiveservices.azure.com/openai
      azure: "https://{resourceName}.openai.azure.com/openai",
      "openai-compatible": "https://openrouter.ai/api/v1",
      google: "",
      bedrock: "",
    };
    const newConfig = historyLLMConfig[value] || {
      llm: value,
      apiKey: "",
      modelName: modelOptions[value][0].value,
      options: {
        baseURL: baseURLMap[value],
      },
    };
    setConfig(newConfig);
    form.setFieldsValue(newConfig);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Card title="Model Config" className="shadow-md">
        <Form form={form} layout="vertical" initialValues={config}>
          <Form.Item
            name="llm"
            label="LLM"
            rules={[
              {
                required: true,
                message: "Please select a LLM",
              },
            ]}
          >
            <Select placeholder="Choose a LLM" onChange={handleLLMChange}>
              {modelLLMs.map((llm) => (
                <Option key={llm.value} value={llm.value}>
                  {llm.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="modelName"
            label="Model Name"
            rules={[
              {
                required: true,
                message: "Please select a model",
              },
            ]}
          >
            <AutoComplete
              placeholder="Model name"
              options={modelOptions[config.llm]}
              filterOption={(inputValue, option) =>
                (option.value as string)
                  .toUpperCase()
                  .indexOf(inputValue.toUpperCase()) !== -1
              }
            />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[
              {
                required: true,
                message: "Please enter the API Key",
              },
            ]}
          >
            <Input.Password placeholder="Please enter the API Key" allowClear />
          </Form.Item>

          <Form.Item name={["options", "bas
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
+                  storageKey = afterPar
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
@@ -372,19 +365,6 @@ export default class Brow
```

---

### Incident Patch 3: `2eec7f51` (2025-11-24)
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

### Incident Patch 4: `e56874a4` (2025-11-22)
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

### Incident Patch 5: `9561859f` (2025-10-30)
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

---

### Incident Patch 6: `29e72217` (2025-10-27)
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

### Incident Patch 7: `a52c4a68` (2025-10-22)
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
