# Forensic Learning Record (Deep Inspection): u14app/deep-research

> **Canonical Artifact**: `07_PROJECT_LEARNING/u14app-deep-research-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/u14app/deep-research](https://github.com/u14app/deep-research))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:28:51.448Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `u14app/deep-research`
- **Description**: Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 4693 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app/api/utils.ts`
```
import { completePath } from "@/utils/url";

// AI provider API base url
const GOOGLE_GENERATIVE_AI_API_BASE_URL =
  process.env.GOOGLE_GENERATIVE_AI_API_BASE_URL ||
  "https://generativelanguage.googleapis.com";
const OPENROUTER_API_BASE_URL =
  process.env.OPENROUTER_API_BASE_URL || "https://openrouter.ai/api";
const OPENAI_API_BASE_URL =
  process.env.OPENAI_API_BASE_URL || "https://api.openai.com";
const ANTHROPIC_API_BASE_URL =
  process.env.ANTHROPIC_API_BASE_URL || "https://api.anthropic.com";
const DEEPSEEK_API_BASE_URL =
  process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com";
const ATLASCLOUD_API_BASE_URL =
  process.env.ATLASCLOUD_API_BASE_URL || "https://api.atlascloud.ai";
const XAI_API_BASE_URL = process.env.XAI_API_BASE_URL || "https://api.x.ai";
const MISTRAL_API_BASE_URL =
  process.env.MISTRAL_API_BASE_URL || "https://api.mistral.ai";
const AZURE_API_BASE_URL = `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments`;
const OPENAI_COMPATIBLE_API_BASE_URL =
  process.env.OPENAI_COMPATIBLE_API_BASE_URL || "";
const POLLINATIONS_API_BASE_URL =
  process.env.POLLINATIONS_API_BASE_URL ||
  "https://text.pollinations.ai/openai";
const OLLAMA_API_BASE_URL =
  process.env.OLLAMA_API_BASE_URL || "http://0.0.0.0:11434";
// Search provider API base url
const TAVILY_API_BASE_URL =
  process.env.TAVILY_API_BASE_URL || "https://api.tavily.com";
const FIRECRAWL_API_BASE_URL =
  process.env.FIRECRAWL_API_BASE_URL || "https://api.firecrawl.dev";
const CRW_API_BASE_URL =
  process.env.CRW_API_BASE_URL || "https://fastcrw.com/api";
const EXA_API_BASE_URL = process.env.EXA_API_BASE_URL || "https://api.exa.ai";
const BOCHA_API_BASE_URL =
  process.env.BOCHA_API_BASE_URL || "https://api.bochaai.com";
const SEARXNG_API_BASE_URL =
  process.env.SEARXNG_API_BASE_URL || "http://0.0.0.0:8080";

const GOOGLE_GENERATIVE_AI_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const ATLASCLOUD_API_KEY = process.env.ATLASCLOUD_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
const AZURE_API_KEY = process.env.AZURE_API_KEY || "";
const OPENAI_COMPATIBLE_API_KEY = process.env.OPENAI_COMPATIBLE_API_KEY || "";
const GOOGLE_VERTEX_API_BASE_URL = `https://${process.env.GOOGLE_VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_VERTEX_PROJECT}/locations/${process.env.GOOGLE_VERTEX_LOCATION}/publishers/google`;
// Search provider API key
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";
const CRW_API_KEY = process.env.CRW_API_KEY || "";
const EXA_API_KEY = process.env.EXA_API_KEY || "";
const BOCHA_API_KEY = process.env.BOCHA_API_KEY || "";

export function getAIProviderBaseURL(provider: string) {
  switch (provider) {
    case "google":
      return completePath(GOOGLE_GENERATIVE_AI_API_BASE_URL, "/v1beta");
    case "openai":
      return completePath(OPENAI_API_BASE_URL, "/v1");
    case "anthropic":
      return completePath(ANTHROPIC_API_BASE_URL, "/v1");
    case "deepseek":
      return completePath(DEEPSEEK_API_BASE_URL, "/v1");
    case "atlascloud":
      return completePath(ATLASCLOUD_API_BASE_URL, "/v1");
    case "xai":
      return completePath(XAI_API_BASE_URL, "/v1");
    case "mistral":
      return completePath(MISTRAL_API_BASE_URL, "/v1");
    case "azure":
      return AZURE_API_BASE_URL;
    case "openrouter":
      return completePath(OPENROUTER_API_BASE_URL, "/api/v1");
    case "openaicompatible":
      return completePath(OPENAI_COMPATIBLE_API_BASE_URL, "/v1");
    case "pollinations":
      return completePath(POLLINATIONS_API_BASE_URL, "/v1");
    case "ollama":
      return completePath(OLLAMA_API_BASE_URL, "/api");
    case "google-vertex":
      return completePath(GOOGLE_VERTEX_API_BASE_URL);
    default:
      throw new Error("Unsupported Provider: " + provider);
  }
}

export function getAIProviderApiKey(provider: string) {
  switch (provider) {
    case "google":
      return GOOGLE_GENERATIVE_AI_API_KEY;
    case "openai":
      return OPENAI_API_KEY;
    case "anthropic":
      return ANTHROPIC_API_KEY;
    case "deepseek":
      return DEEPSEEK_API_KEY;
    case "atlascloud":
      return ATLASCLOUD_API_KEY;
    case "xai":
      return XAI_API_KEY;
    case "mistral":
      return MISTRAL_API_KEY;
    case "azure":
      return AZURE_API_KEY;
    case "openrouter":
      return OPENROUTER_API_KEY;
    case "openaicompatible":
      return OPENAI_COMPATIBLE_API_KEY;
    case "google-vertex":
    case "pollinations":
    case "ollama":
      return "";
    default:
      throw new Error("Unsupported Provider: " + provider);
  }
}

export function getSearchProviderBaseURL(provider: string) {
  switch (provider) {
    case "tavily":
      return TAVILY_API_BASE_URL;
    case "firecrawl":
      return FIRECRAWL_API_BASE_URL;
    case "crw":
      return CRW_API_BASE_URL;
    case "exa":
      return EXA_API_BASE_URL;
    case "bocha":
      return BOCHA_API_BASE_URL;
    case "searxng":
      return SEARXNG_API_BASE_URL;
    case "model":
      return "";
    default:
      throw new Error("Unsupported Provider: " + provider);
  }
}

export function getSearchProviderApiKey(provider: string) {
  switch (provider) {
    case "tavily":
      return TAVILY_API_KEY;
    case "firecrawl":
      return FIRECRAWL_API_KEY;
    case "crw":
      return CRW_API_KEY;
    case "exa":
      return EXA_API_KEY;
    case "bocha":
      return BOCHA_API_KEY;
    case "searxng":
    case "model":
      return "";
    default:
      throw new Error("Unsupported Provider: " + provider);
  }
}

```

### Core Architecture Module: `src/hooks/useAccurateTimer.ts`
```
import { useState, useMemo, useRef, useEffect } from "react";

function useAccurateTimer() {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Format time, recalculate only when time changes
  const formattedTime = useMemo(() => {
    const seconds = Math.floor(time / 1000);
    const milliseconds = time % 1000;
    return `${seconds}.${Math.floor(milliseconds / 100)
      .toString()
      .padStart(1, "0")}s`;
  }, [time]);

  // Use useCallback to optimize start and stop functions to avoid unnecessary re-rendering
  function start() {
    setTime(0);
    if (!timerRef.current) {
      setIsRunning(true);
      // Record the start time, taking into account the pause situation
      startTimeRef.current = Date.now() - time;

      const tick = () => {
        if (startTimeRef.current !== null) {
          setTime(Date.now() - startTimeRef.current);
          // Using requestAnimationFrame
          timerRef.current = requestAnimationFrame(tick);
        }
      };

      // Start the animation frame loop
      timerRef.current = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (timerRef.current) {
      setIsRunning(false);
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    setTime(0);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, []);

  return {
    time,
    formattedTime,
    isRunning,
    start,
    stop,
  };
}

export default useAccurateTimer;

```

### Core Architecture Module: `src/hooks/useAiProvider.ts`
```
import { useSettingStore } from "@/store/setting";
import {
  createAIProvider,
  type AIProviderOptions,
} from "@/utils/deep-research/provider";
import {
  GEMINI_BASE_URL,
  OPENROUTER_BASE_URL,
  OPENAI_BASE_URL,
  ANTHROPIC_BASE_URL,
  DEEPSEEK_BASE_URL,
  ATLASCLOUD_BASE_URL,
  XAI_BASE_URL,
  MISTRAL_BASE_URL,
  OLLAMA_BASE_URL,
  POLLINATIONS_BASE_URL,
} from "@/constants/urls";
import { multiApiKeyPolling } from "@/utils/model";
import { generateSignature } from "@/utils/signature";
import { completePath } from "@/utils/url";

function useModelProvider() {
  async function createModelProvider(model: string, settings?: any) {
    const { mode, provider, accessPassword } = useSettingStore.getState();
    const options: AIProviderOptions = {
      baseURL: "",
      provider,
      model,
      settings,
    };

    switch (provider) {
      case "google":
        const { apiKey = "", apiProxy } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(
            apiProxy || GEMINI_BASE_URL,
            "/v1beta"
          );
          options.apiKey = multiApiKeyPolling(apiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/google/v1beta";
        }
        break;
      case "google-vertex":
        const {
          googleVertexProject,
          googleVertexLocation,
          googleClientEmail,
          googlePrivateKey,
          googlePrivateKeyId,
        } = useSettingStore.getState();
        if (mode === "local") {
          options.auth = {
            project: googleVertexProject,
            location: googleVertexLocation,
          };
          if (googleClientEmail && googlePrivateKey) {
            options.auth.clientEmail = googleClientEmail;
            options.auth.privateKey = googlePrivateKey;
            if (googlePrivateKeyId) {
              options.auth.privateKeyId = googlePrivateKeyId;
            }
          }
        } else {
          options.baseURL = location.origin + "/api/ai/google-vertex";
        }
        break;
      case "openai":
        const { openAIApiKey = "", openAIApiProxy } =
          useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(
            openAIApiProxy || OPENAI_BASE_URL,
            "/v1"
          );
          options.apiKey = multiApiKeyPolling(openAIApiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/openai/v1";
        }
        break;
      case "anthropic":
        const { anthropicApiKey = "", anthropicApiProxy } =
          useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(
            anthropicApiProxy || ANTHROPIC_BASE_URL,
            "/v1"
          );
          options.headers = {
            // Avoid cors error
            "anthropic-dangerous-direct-browser-access": "true",
          };
          options.apiKey = multiApiKeyPolling(anthropicApiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/anthropic/v1";
        }
        break;
      case "deepseek":
        const { deepseekApiKey = "", deepseekApiProxy } =
          useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(
            deepseekApiProxy || DEEPSEEK_BASE_URL,
            "/v1"
          );
          options.apiKey = multiApiKeyPolling(deepseekApiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/deepseek/v1";
        }
        break;
      case "atlascloud":
        const { atlasCloudApiKey = "", atlasCloudApiProxy } =
          useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(
            atlasCloudApiProxy || ATLASCLOUD_BASE_URL,
            "/v1"
          );
          options.apiKey = multiApiKeyPolling(atlasCloudApiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/atlascloud/v1";
        }
        break;
      case "xai":
        const { xAIApiKey = "", xAIApiProxy } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(xAIApiProxy || XAI_BASE_URL, "/v1");
          options.apiKey = multiApiKeyPolling(xAIApiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/xai/v1";
        }
        break;
      case "mistral":
        const { mistralApiKey = "", mistralApiProxy } =
          useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(
            mistralApiProxy || MISTRAL_BASE_URL,
            "/v1"
          );
          options.apiKey = multiApiKeyPolling(mistralApiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/mistral/v1";
        }
        break;
      case "azure":
        const {
          azureApiKey = "",
          azureResourceName,
          azureApiVersion,
        } = useSettingStore.getState();
        if (mode === "local") {
          options.auth = {
            resourceName: azureResourceName,
            apiKey: multiApiKeyPolling(azureApiKey),
            apiVersion: azureApiVersion,
          };
        } else {
          options.baseURL = location.origin + "/api/ai/azure";
        }
        break;
      case "openrouter":
        const { openRouterApiKey = "", openRouterApiProxy } =
          useSettingStore.getState();
        if (mode === "local") {
          const baseUrl = openRouterApiProxy || OPENROUTER_BASE_URL;
          options.baseURL = completePath(
            baseUrl,
            baseUrl.endsWith("/api") ? "/v1" : "/api/v1"
          );
          options.apiKey = multiApiKeyPolling(openRouterApiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/openrouter/api/v1";
        }
        break;
      case "openaicompatible":
        const { openAICompatibleApiKey = "", openAICompatibleApiProxy } =
          useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(openAICompatibleApiProxy, "/v1");
          options.apiKey = multiApiKeyPolling(openAICompatibleApiKey);
        } else {
          options.baseURL = location.origin + "/api/ai/openaicompatible/v1";
        }
        break;
      case "pollinations":
        const { pollinationsApiProxy } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(
            pollinationsApiProxy || POLLINATIONS_BASE_URL,
            "/v1"
          );
        } else {
          options.baseURL = location.origin + "/api/ai/pollinations/v1";
        }
        break;
      case "ollama":
        const { ollamaApiProxy } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = completePath(
            ollamaApiProxy || OLLAMA_BASE_URL,
            "/api"
          );
        } else {
          options.baseURL = location.origin + "/api/ai/ollama/api";
          options.headers = {
            Authorization: generateSignature(accessPassword, Date.now()),
          };
        }
        break;
      default:
        break;
    }

    if (mode === "proxy") {
      options.apiKey = generateSignature(accessPassword, Date.now());
    }

    return await createAIProvider(options);
  }

  function getModel() {
    const { provider } = useSettingStore.getState();

    switch (provider) {
      case "google":
        const { thinkingModel, networkingModel } = useSettingStore.getState();
        return { thinkingModel, networkingModel };
      case "google-vertex":
        const { googleVertexThinkingModel, googleVertexNetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: googleVertexThinkingModel,
          networkingModel: googleVertexNetworkingModel,
        };
      case "openai":
        const { openAIThinkingModel, openAINetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: openAIThinkingModel,
          networkingModel: openAINetworkingModel,
        };
      case "anthropic":
        const { anthropicThinkingModel, anthropicNetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: anthropicThinkingModel,
          networkingModel: anthropicNetworkingModel,
        };
      case "deepseek":
        const { deepseekThinkingModel, deepseekNetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: deepseekThinkingModel,
          networkingModel: deepseekNetworkingModel,
        };
      case "atlascloud":
        const { atlasCloudThinkingModel, atlasCloudNetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: atlasCloudThinkingModel,
          networkingModel: atlasCloudNetworkingModel,
        };
      case "xai":
        const { xAIThinkingModel, xAINetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: xAIThinkingModel,
          networkingModel: xAINetworkingModel,
        };
      case "mistral":
        const { mistralThinkingModel, mistralNetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: mistralThinkingModel,
          networkingModel: mistralNetworkingModel,
        };
      case "azure":
        const { azureThinkingModel, azureNetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: azureThinkingModel,
          networkingModel: azureNetworkingModel,
        };
      case "openrouter":
        const { openRouterThinkingModel, openRouterNetworkingModel } =
          useSettingStore.getState();
        return {
          thinkingModel: openRouterThinkingModel,
          networkingModel: openRouterNetworkingModel,
        };
      case "openaicompatible":
        const {
          openAICompatibleThinkingModel,
          openAICompatibleNetworkingModel,
        } = useSet
```

### Core Architecture Module: `src/hooks/useArtifact.ts`
```
import { useState } from "react";
import { streamText, smoothStream } from "ai";
import { toast } from "sonner";
import { useSettingStore } from "@/store/setting";
import useModelProvider from "@/hooks/useAiProvider";
import {
  AIWritePrompt,
  changeLanguagePrompt,
  changeReadingLevelPrompt,
  adjustLengthPrompt,
  continuationPrompt,
  addEmojisPrompt,
} from "@/utils/artifact";
import { parseError } from "@/utils/error";

type ArtifactProps = {
  value: string;
  onChange: (value: string) => void;
};

function smoothTextStream(type: "character" | "word" | "line") {
  return smoothStream({
    chunking: type === "character" ? /./ : type,
    delayInMs: 0,
  });
}

function handleError(error: unknown) {
  const errorMessage = parseError(error);
  toast.error(errorMessage);
}

function useArtifact({ value, onChange }: ArtifactProps) {
  const { smoothTextStreamType } = useSettingStore();
  const { createModelProvider, getModel } = useModelProvider();
  const [loadingAction, setLoadingAction] = useState<string>("");

  async function AIWrite(prompt: string, systemInstruction?: string) {
    const { thinkingModel } = getModel();
    setLoadingAction("aiWrite");
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      prompt: AIWritePrompt(value, prompt, systemInstruction),
      experimental_transform: smoothTextStream(smoothTextStreamType),
      onError: handleError,
    });
    let text = "";
    for await (const textPart of result.textStream) {
      text += textPart;
      onChange(text);
    }
    text = "";
    setLoadingAction("");
  }

  async function translate(lang: string, systemInstruction?: string) {
    const { thinkingModel } = getModel();
    setLoadingAction("translate");
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      prompt: changeLanguagePrompt(value, lang, systemInstruction),
      experimental_transform: smoothTextStream(smoothTextStreamType),
      onError: handleError,
    });
    let text = "";
    for await (const textPart of result.textStream) {
      text += textPart;
      onChange(text);
    }
    text = "";
    setLoadingAction("");
  }

  async function changeReadingLevel(level: string, systemInstruction?: string) {
    const { thinkingModel } = getModel();
    setLoadingAction("readingLevel");
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      prompt: changeReadingLevelPrompt(value, level, systemInstruction),
      experimental_transform: smoothTextStream(smoothTextStreamType),
      onError: handleError,
    });
    let text = "";
    for await (const textPart of result.textStream) {
      text += textPart;
      onChange(text);
    }
    text = "";
    setLoadingAction("");
  }

  async function adjustLength(length: string, systemInstruction?: string) {
    const { thinkingModel } = getModel();
    setLoadingAction("adjustLength");
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      prompt: adjustLengthPrompt(value, length, systemInstruction),
      experimental_transform: smoothTextStream(smoothTextStreamType),
      onError: handleError,
    });
    let text = "";
    for await (const textPart of result.textStream) {
      text += textPart;
      onChange(text);
    }
    text = "";
    setLoadingAction("");
  }

  async function continuation(systemInstruction?: string) {
    const { thinkingModel } = getModel();
    setLoadingAction("continuation");
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      prompt: continuationPrompt(value, systemInstruction),
      experimental_transform: smoothTextStream(smoothTextStreamType),
      onError: handleError,
    });
    let text = value + "\n";
    for await (const textPart of result.textStream) {
      text += textPart;
      onChange(text);
    }
    text = "";
    setLoadingAction("");
  }

  async function addEmojis(systemInstruction?: string) {
    const { thinkingModel } = getModel();
    setLoadingAction("addEmojis");
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      prompt: addEmojisPrompt(value, systemInstruction),
      experimental_transform: smoothTextStream(smoothTextStreamType),
      onError: handleError,
    });
    let text = "";
    for await (const textPart of result.textStream) {
      text += textPart;
      onChange(text);
    }
    text = "";
    setLoadingAction("");
  }

  return {
    loadingAction,
    AIWrite,
    translate,
    changeReadingLevel,
    adjustLength,
    continuation,
    addEmojis,
  };
}

export default useArtifact;

```

### Core Architecture Module: `src/hooks/useDeepResearch.ts`
```
import { useState } from "react";
import {
  streamText,
  smoothStream,
  type JSONValue,
  type Tool,
  type UserContent,
} from "ai";
import { parsePartialJson } from "@ai-sdk/ui-utils";
import { openai } from "@ai-sdk/openai";
import { type GoogleGenerativeAIProviderMetadata } from "@ai-sdk/google";
import { useTranslation } from "react-i18next";
import Plimit from "p-limit";
import { toast } from "sonner";
import useModelProvider from "@/hooks/useAiProvider";
import useWebSearch from "@/hooks/useWebSearch";
import { useTaskStore } from "@/store/task";
import { useHistoryStore } from "@/store/history";
import { useSettingStore } from "@/store/setting";
import { useKnowledgeStore } from "@/store/knowledge";
import {
  parseDeepResearchPromptOverrides,
  type DeepResearchPromptOverrides,
} from "@/constants/prompts";
import {
  getSystemPrompt,
  getOutputGuidelinesPrompt,
  generateQuestionsPrompt,
  writeReportPlanPrompt,
  generateSerpQueriesPrompt,
  processResultPrompt,
  processSearchResultPrompt,
  processSearchKnowledgeResultPrompt,
  reviewSerpQueriesPrompt,
  writeFinalReportPrompt,
  getSERPQuerySchema,
} from "@/utils/deep-research/prompts";
import { isNetworkingModel } from "@/utils/model";
import { ThinkTagStreamProcessor, removeJsonMarkdown } from "@/utils/text";
import { parseError } from "@/utils/error";
import { pick, flat, unique } from "radash";

type ProviderOptions = Record<string, Record<string, JSONValue>>;
type Tools = Record<string, Tool>;

function getResponseLanguagePrompt() {
  return `\n\n**Respond in the same language as the user's language**`;
}

function smoothTextStream(type: "character" | "word" | "line") {
  return smoothStream({
    chunking: type === "character" ? /./ : type,
    delayInMs: 0,
  });
}

function handleError(error: unknown) {
  console.log(error);
  const errorMessage = parseError(error);
  toast.error(errorMessage);
}

function useDeepResearch() {
  const { t } = useTranslation();
  const taskStore = useTaskStore();
  const { smoothTextStreamType } = useSettingStore();
  const { createModelProvider, getModel } = useModelProvider();
  const { search } = useWebSearch();
  const [status, setStatus] = useState<string>("");

  function getPromptOverrides() {
    const { deepResearchPromptOverrides } = useSettingStore.getState();
    try {
      return parseDeepResearchPromptOverrides(deepResearchPromptOverrides);
    } catch (error) {
      handleError(error);
      return {} as DeepResearchPromptOverrides;
    }
  }

  function getMaxCollectionTopics() {
    const { maxCollectionTopics } = useSettingStore.getState();
    const value = Number(maxCollectionTopics);
    if (!Number.isFinite(value)) {
      return 5;
    }
    return Math.max(1, Math.min(20, Math.floor(value)));
  }

  function getAutoReviewRounds() {
    const { autoReviewRounds } = useSettingStore.getState();
    const value = Number(autoReviewRounds);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(5, Math.floor(value)));
  }

  function getReportPreferenceRequirement(
    reportStyle: "balanced" | "executive" | "technical" | "concise",
    reportLength: "brief" | "standard" | "comprehensive"
  ) {
    const stylePrompts: Record<
      "balanced" | "executive" | "technical" | "concise",
      string
    > = {
      balanced:
        "Keep a balanced writing style with clear explanations, practical examples, and moderate technical depth.",
      executive:
        "Prioritize decision-ready insights. Begin sections with key findings and focus on business impact, risks, and recommendations.",
      technical:
        "Prioritize technical depth and precision. Include implementation details, tradeoffs, assumptions, and limitations.",
      concise:
        "Be concise and direct. Eliminate filler and keep each section tightly focused on essential information.",
    };
    const lengthPrompts: Record<"brief" | "standard" | "comprehensive", string> =
      {
        brief:
          "Keep the report compact while preserving critical insights and evidence.",
        standard:
          "Write a standard-length report with good depth and practical detail.",
        comprehensive:
          "Write a comprehensive report with deep coverage, detailed analysis, and thorough supporting context.",
      };

    return [
      "Additional report preferences:",
      `- Style: ${stylePrompts[reportStyle]}`,
      `- Length: ${lengthPrompts[reportLength]}`,
    ].join("\n");
  }

  async function generateSearchSettings(searchModel: string) {
    const { provider, enableSearch, searchProvider, searchMaxResult } =
      useSettingStore.getState();

    if (enableSearch === "1" && searchProvider === "model") {
      const createModel = (model: string) => {
        // Enable Gemini's built-in search tool
        if (
          ["google", "google-vertex"].includes(provider) &&
          isNetworkingModel(model)
        ) {
          return createModelProvider(model, { useSearchGrounding: true });
        } else {
          return createModelProvider(model);
        }
      };
      const getTools = (model: string) => {
        // Enable OpenAI's built-in search tool
        if (
          ["openai", "azure", "openaicompatible"].includes(provider) &&
          (model.startsWith("gpt-4o") ||
            model.startsWith("gpt-4.1") ||
            model.startsWith("gpt-5"))
        ) {
          return {
            web_search_preview: openai.tools.webSearchPreview({
              // optional configuration:
              searchContextSize: searchMaxResult > 5 ? "high" : "medium",
            }),
          } as Tools;
        }
      };
      const getProviderOptions = (model: string) => {
        // Enable OpenRouter's built-in search tool
        if (provider === "openrouter") {
          return {
            openrouter: {
              plugins: [
                {
                  id: "web",
                  max_results: searchMaxResult, // Defaults to 5
                },
              ],
            },
          } as ProviderOptions;
        } else if (
          provider === "xai" &&
          model.startsWith("grok-3") &&
          !model.includes("mini")
        ) {
          return {
            xai: {
              search_parameters: {
                mode: "auto",
                max_search_results: searchMaxResult,
              },
            },
          } as ProviderOptions;
        }
      };

      return {
        model: await createModel(searchModel),
        tools: getTools(searchModel),
        providerOptions: getProviderOptions(searchModel),
      };
    } else {
      return {
        model: await createModelProvider(searchModel),
      };
    }
  }

  async function askQuestions() {
    const { question } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.thinking"));
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const promptOverrides = getPromptOverrides();
    const searchSettings = await generateSearchSettings(thinkingModel);
    const result = streamText({
      ...searchSettings,
      system: getSystemPrompt(promptOverrides),
      prompt: [
        generateQuestionsPrompt(question, promptOverrides),
        getResponseLanguagePrompt(),
      ].join("\n\n"),
      experimental_transform: smoothTextStream(smoothTextStreamType),
      onError: handleError,
    });
    let content = "";
    let reasoning = "";
    taskStore.setQuestion(question);
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        thinkTagStreamProcessor.processChunk(
          part.textDelta,
          (data) => {
            content += data;
            taskStore.updateQuestions(content);
          },
          (data) => {
            reasoning += data;
          }
        );
      } else if (part.type === "reasoning") {
        reasoning += part.textDelta;
      }
    }
    if (reasoning) console.log(reasoning);
  }

  async function writeReportPlan() {
    const { query } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.thinking"));
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const promptOverrides = getPromptOverrides();
    const searchSettings = await generateSearchSettings(thinkingModel);
    const result = streamText({
      ...searchSettings,
      system: getSystemPrompt(promptOverrides),
      prompt: [
        writeReportPlanPrompt(query, promptOverrides),
        getResponseLanguagePrompt(),
      ].join("\n\n"),
      experimental_transform: smoothTextStream(smoothTextStreamType),
      onError: handleError,
    });
    let content = "";
    let reasoning = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        thinkTagStreamProcessor.processChunk(
          part.textDelta,
          (data) => {
            content += data;
            taskStore.updateReportPlan(content);
          },
          (data) => {
            reasoning += data;
          }
        );
      } else if (part.type === "reasoning") {
        reasoning += part.textDelta;
      }
    }
    if (reasoning) console.log(reasoning);
    return content;
  }

  async function searchLocalKnowledges(
    query: string,
    researchGoal: string,
    promptOverrides: DeepResearchPromptOverrides = {}
  ) {
    const { resources } = useTaskStore.getState();
    const knowledgeStore = useKnowledgeStore.getState();
    const knowledges: Knowledge[] = [];

    for (const item of resources) {
      if (item.status === "completed") {
        const resource = knowledgeStore.get(item.id);
        if (resource) {
          knowledges.push(resource);
        }
      }
    }

    const { networkingModel } = getModel();
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const searchResult = streamText({
      model: await createModelProvider(networkingModel),
```

### Core Architecture Module: `src/hooks/useKnowledge.ts`
```
import { streamText, smoothStream } from "ai";
import { Md5 } from "ts-md5";
import { toast } from "sonner";
import useModelProvider from "@/hooks/useAiProvider";
import { useKnowledgeStore } from "@/store/knowledge";
import { useTaskStore } from "@/store/task";
import { useSettingStore } from "@/store/setting";
import {
  parseDeepResearchPromptOverrides,
  resolveDeepResearchPromptTemplates,
} from "@/constants/prompts";
import { jinaReader, localCrawler } from "@/utils/crawler";
import { fileParser } from "@/utils/parser";
import { getTextByteSize } from "@/utils/file";
import {
  splitText,
  containsXmlHtmlTags,
  ThinkTagStreamProcessor,
} from "@/utils/text";
import { parseError } from "@/utils/error";
import { omit } from "radash";

const MAX_CHUNK_LENGTH = 10000;

function smoothTextStream(type: "character" | "word" | "line") {
  return smoothStream({
    chunking: type === "character" ? /./ : type,
    delayInMs: 0,
  });
}

function handleError(error: unknown) {
  const errorMessage = parseError(error);
  toast.error(errorMessage);
}

function useKnowledge() {
  const { smoothTextStreamType } = useSettingStore();
  const { createModelProvider, getModel } = useModelProvider();
  const knowledgeStore = useKnowledgeStore();

  function getRewritingPrompt() {
    try {
      const { deepResearchPromptOverrides } = useSettingStore.getState();
      const promptOverrides = parseDeepResearchPromptOverrides(
        deepResearchPromptOverrides
      );
      return resolveDeepResearchPromptTemplates(promptOverrides).rewritingPrompt;
    } catch {
      return resolveDeepResearchPromptTemplates().rewritingPrompt;
    }
  }

  function generateId(
    type: "file" | "url" | "knowledge",
    options?: {
      fileMeta?: FileMeta;
      url?: string;
    }
  ): string {
    if (type === "file" && options && options.fileMeta) {
      const { fileMeta } = options;
      const meta = `${fileMeta.name}::${fileMeta.size}::${fileMeta.type}::${fileMeta.lastModified}`;
      return Md5.hashStr(meta);
    } else if (type === "url" && options && options.url) {
      return Md5.hashStr(
        `${options.url}::${Date.now().toString().substring(0, 8)}`
      );
    } else if (type === "knowledge") {
      return Md5.hashStr(`KNOWLEDGE::${Date.now()}`);
    } else {
      throw new Error("Parameter error");
    }
  }

  async function getKnowledgeFromFile(file: File) {
    const { resources, addResource, updateResource } = useTaskStore.getState();

    const fileMeta: FileMeta = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };
    const id = generateId("file", { fileMeta });
    const isExist = resources.find((item) => item.id === id);
    if (isExist) {
      return toast.message(`File already exist: ${file.name}`);
    }

    async function extractText(rid: string, title: string, text: string) {
      const { networkingModel } = getModel();

      let content = "";
      let reasoning = "";
      const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
      const result = streamText({
        model: await createModelProvider(networkingModel),
        prompt: text,
        system: getRewritingPrompt(),
        onFinish: () => {
          const currentTime = Date.now();
          knowledgeStore.save({
            id: rid,
            title,
            content,
            type: "file",
            fileMeta,
            createdAt: currentTime,
            updatedAt: currentTime,
          });
        },
        experimental_transform: smoothTextStream(smoothTextStreamType),
        onError: (err) => {
          updateResource(id, { status: "failed" });
          handleError(err);
        },
      });
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          thinkTagStreamProcessor.processChunk(
            part.textDelta,
            (data) => {
              content += data;
            },
            (data) => {
              reasoning += data;
            }
          );
        } else if (part.type === "reasoning") {
          reasoning += part.textDelta;
        }
      }
      if (reasoning) console.log(reasoning);
      return content;
    }

    try {
      if (knowledgeStore.exist(id)) {
        const knowledge = knowledgeStore.get(id);
        if (knowledge) {
          addResource({
            id,
            name: knowledge.title,
            type: knowledge.type,
            size: getTextByteSize(knowledge.content),
            status: "completed",
          });
        }
      } else {
        addResource({
          ...omit(fileMeta, ["lastModified"]),
          id,
          status: "processing",
        });

        const text = await fileParser(file);
        if (text.length > MAX_CHUNK_LENGTH || !file.type.startsWith("text/")) {
          const chunks = splitText(text, MAX_CHUNK_LENGTH);
          for (const idx in chunks) {
            const chunk = chunks[idx];
            const index = Number(idx);
            let rid = id;
            const names = fileMeta.name.split(".");
            const filename = `${names[0]}-${index + 1}.${names[1] || "txt"}`;

            if (index > 0) {
              rid = `${id}_${index}`;
              addResource({
                ...omit(fileMeta, ["lastModified"]),
                id: rid,
                name: filename,
                size: getTextByteSize(chunk),
                status: "processing",
              });
            } else {
              updateResource(rid, {
                name: filename,
                size: getTextByteSize(chunk),
                status: "processing",
              });
            }

            let content = "";
            if (containsXmlHtmlTags(chunk)) {
              content = await extractText(rid, filename, chunk);
            } else {
              content = chunk;
              // Save to knowledge store for non-XML/HTML content
              const currentTime = Date.now();
              knowledgeStore.save({
                id: rid,
                title: filename,
                content,
                type: "file",
                fileMeta,
                createdAt: currentTime,
                updatedAt: currentTime,
              });
            }
            updateResource(rid, {
              name: filename,
              size: getTextByteSize(content),
              status: "completed",
            });
          }
        } else {
          knowledgeStore.save({
            id,
            title: fileMeta.name,
            content: text,
            type: "file",
            fileMeta,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          updateResource(id, {
            size: getTextByteSize(text),
            status: "completed",
          });
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        updateResource(id, { status: "failed" });
        toast.error(err.message);
      } else {
        toast.error("File parsing failed");
      }
    }
  }

  async function getKnowledgeFromUrl(url: string, crawler: string) {
    const knowledgeStore = useKnowledgeStore.getState();
    const { resources, addResource, updateResource } = useTaskStore.getState();

    const id = generateId("url", { url });
    const isExist = resources.find((item) => item.id === id);
    if (isExist) {
      return toast.message(`Url already loaded: ${url}`);
    }
    try {
      if (knowledgeStore.exist(id)) {
        const knowledge = knowledgeStore.get(id);
        if (knowledge) {
          addResource({
            id,
            name: url,
            type: "url",
            size: getTextByteSize(knowledge.content),
            status: "completed",
          });
        }
      } else {
        addResource({
          id,
          name: url,
          type: "url",
          size: 0,
          status: "processing",
        });
        if (crawler === "jina") {
          const result = await jinaReader(url);
          const currentTime = Date.now();
          knowledgeStore.save({
            id,
            title: result.title,
            content: result.content,
            type: "url",
            url,
            createdAt: currentTime,
            updatedAt: currentTime,
          });
          updateResource(id, {
            size: getTextByteSize(result.content),
            status: "completed",
          });
        } else if (crawler === "local") {
          const { networkingModel } = getModel();
          const { accessPassword } = useSettingStore.getState();
          const result = await localCrawler(url, accessPassword);
          let content = "";
          const stream = streamText({
            model: await createModelProvider(networkingModel),
            prompt: result.content,
            system: getRewritingPrompt(),
            onFinish: () => {
              const currentTime = Date.now();
              knowledgeStore.save({
                id,
                title: result.title,
                content,
                type: "url",
                url,
                createdAt: currentTime,
                updatedAt: currentTime,
              });
            },
            experimental_transform: smoothTextStream(smoothTextStreamType),
            onError: (err) => {
              updateResource(id, { status: "failed" });
              handleError(err);
            },
          });
          for await (const textPart of stream.textStream) {
            content += textPart;
          }
          updateResource(id, {
            size: getTextByteSize(content),
            status: "completed",
          });
        } else {
          throw new Error(`Unknown crawler: ${crawler}`);
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        updateResource(id, { status: "failed" });
        return toast.error(err.message);
      } else {
        toast.error("Url parsing failed");
      }
    }
  }

  retu
```

### Core Architecture Module: `src/hooks/useMobile.ts`
```
import { useState, useEffect } from "react";

export function useMobile(mobileBreakpoint = 768) {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < mobileBreakpoint);
    return () => mql.removeEventListener("change", onChange);
  }, [mobileBreakpoint]);

  return !!isMobile;
}

```

### Core Architecture Module: `src/hooks/useModelList.ts`
```
import { useEffect, useState } from "react";
import { useSettingStore } from "@/store/setting";
import {
  GEMINI_BASE_URL,
  OPENROUTER_BASE_URL,
  OPENAI_BASE_URL,
  ANTHROPIC_BASE_URL,
  DEEPSEEK_BASE_URL,
  ATLASCLOUD_BASE_URL,
  XAI_BASE_URL,
  MISTRAL_BASE_URL,
  POLLINATIONS_BASE_URL,
  OLLAMA_BASE_URL,
} from "@/constants/urls";
import { multiApiKeyPolling } from "@/utils/model";
import { generateSignature } from "@/utils/signature";
import { completePath } from "@/utils/url";

interface GeminiModel {
  name: string;
  description: string;
  displayName: string;
  inputTokenLimit: number;
  maxTemperature?: number;
  outputTokenLimit: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  supportedGenerationMethods: string[];
  version: string;
}

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
    input_cache_read: string;
    input_cache_write: string;
    web_search: string;
    internal_reasoning: string;
  };
  per_request_limits: Record<string, string> | null;
}

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface AnthropicModel {
  id: string;
  display_name: string;
  type: string;
  created_at: string;
}

interface MistralModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  capabilities: {
    completion_chat: boolean;
    completion_fim: boolean;
    function_calling: boolean;
    fine_tuning: boolean;
    vision: boolean;
    classification: boolean;
  };
  name: string;
  description: string;
  max_context_length: number;
  aliases: string[];
  default_model_temperature: number;
  type: string;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format?: string;
    family?: string;
    families?: string | null;
    parameter_size?: string;
    quantization_level?: string;
  };
}

function useModelList() {
  const [modelList, setModelList] = useState<string[]>([]);
  const { mode, provider } = useSettingStore.getState();

  useEffect(() => {
    setModelList([]);
  }, [provider]);

  async function refresh(provider: string): Promise<string[]> {
    const { accessPassword } = useSettingStore.getState();
    const accessKey = generateSignature(accessPassword, Date.now());

    if (provider === "google") {
      const { apiKey = "", apiProxy } = useSettingStore.getState();
      if (mode === "local" && !apiKey) {
        return [];
      }
      const key = multiApiKeyPolling(apiKey);
      const response = await fetch(
        mode === "local"
          ? completePath(apiProxy || GEMINI_BASE_URL, "/v1beta") + "/models"
          : "/api/ai/google/v1beta/models",
        {
          headers: {
            "x-goog-api-key": mode === "local" ? key : accessKey,
          },
        }
      );
      const { models = [] } = await response.json();
      const newModelList = (models as GeminiModel[])
        .filter(
          (item) =>
            item.name.startsWith("models/gemini") &&
            item.supportedGenerationMethods.includes("generateContent")
        )
        .map((item) => item.name.replace("models/", ""));
      setModelList(newModelList);
      return newModelList;
    } else if (provider === "openrouter") {
      const { openRouterApiKey = "", openRouterApiProxy } =
        useSettingStore.getState();
      if (mode === "local" && !openRouterApiKey) {
        return [];
      }
      const apiKey = multiApiKeyPolling(openRouterApiKey);
      const response = await fetch(
        mode === "local"
          ? completePath(openRouterApiProxy || OPENROUTER_BASE_URL, "/api/v1") +
              "/models"
          : "/api/ai/openrouter/v1/models",
        {
          headers: {
            authorization: `Bearer ${mode === "local" ? apiKey : accessKey}`,
          },
        }
      );
      const { data = [] } = await response.json();
      const newModelList = (data as OpenRouterModel[]).map((item) => item.id);
      setModelList(newModelList);
      return newModelList;
    } else if (provider === "openai") {
      const { openAIApiKey = "", openAIApiProxy } = useSettingStore.getState();
      if (mode === "local" && !openAIApiKey) {
        return [];
      }
      const apiKey = multiApiKeyPolling(openAIApiKey);
      const response = await fetch(
        mode === "local"
          ? completePath(openAIApiProxy || OPENAI_BASE_URL, "/v1") + "/models"
          : "/api/ai/openai/v1/models",
        {
          headers: {
            authorization: `Bearer ${mode === "local" ? apiKey : accessKey}`,
          },
        }
      );
      const { data = [] } = await response.json();
      const newModelList = (data as OpenAIModel[])
        .map((item) => item.id)
        .filter(
          (id) =>
            !(
              id.startsWith("text") ||
              id.startsWith("tts") ||
              id.startsWith("whisper") ||
              id.startsWith("dall-e")
            )
        );
      setModelList(newModelList);
      return newModelList;
    } else if (provider === "anthropic") {
      const { anthropicApiKey = "", anthropicApiProxy } =
        useSettingStore.getState();
      if (mode === "local" && !anthropicApiKey) {
        return [];
      }
      const apiKey = multiApiKeyPolling(anthropicApiKey);
      const response = await fetch(
        mode === "local"
          ? completePath(anthropicApiProxy || ANTHROPIC_BASE_URL, "/v1") +
              "/models"
          : "/api/ai/anthropic/v1/models",
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": mode === "local" ? apiKey : accessKey,
            "Anthropic-Version": "2023-06-01",
            // Avoid cors error
            "anthropic-dangerous-direct-browser-access": "true",
          },
        }
      );
      const { data = [] } = await response.json();
      const newModelList = (data as AnthropicModel[]).map((item) => item.id);
      setModelList(newModelList);
      return newModelList;
    } else if (provider === "deepseek") {
      const { deepseekApiKey = "", deepseekApiProxy } =
        useSettingStore.getState();
      if (mode === "local" && !deepseekApiKey) {
        return [];
      }
      const apiKey = multiApiKeyPolling(deepseekApiKey);
      const response = await fetch(
        mode === "local"
          ? completePath(deepseekApiProxy || DEEPSEEK_BASE_URL, "/v1") +
              "/models"
          : "/api/ai/deepseek/v1/models",
        {
          headers: {
            authorization: `Bearer ${mode === "local" ? apiKey : accessKey}`,
          },
        }
      );
      const { data = [] } = await response.json();
      const newModelList = (data as OpenAIModel[]).map((item) => item.id);
      setModelList(newModelList);
      return newModelList;
    } else if (provider === "atlascloud") {
      const { atlasCloudApiKey = "", atlasCloudApiProxy } =
        useSettingStore.getState();
      if (mode === "local" && !atlasCloudApiKey) {
        return [];
      }
      const apiKey = multiApiKeyPolling(atlasCloudApiKey);
      const response = await fetch(
        mode === "local"
          ? completePath(atlasCloudApiProxy || ATLASCLOUD_BASE_URL, "/v1") +
              "/models"
          : "/api/ai/atlascloud/v1/models",
        {
          headers: {
            authorization: `Bearer ${mode === "local" ? apiKey : accessKey}`,
          },
        }
      );
      const { data = [] } = await response.json();
      const newModelList = (data as OpenAIModel[]).map((item) => item.id);
      setModelList(newModelList);
      return newModelList;
    } else if (provider === "xai") {
      const { xAIApiKey = "", xAIApiProxy } = useSettingStore.getState();
      if (mode === "local" && !xAIApiKey) {
        return [];
      }
      const apiKey = multiApiKeyPolling(xAIApiKey);
      const response = await fetch(
        mode === "local"
          ? completePath(xAIApiProxy || XAI_BASE_URL, "/v1") + "/models"
          : "/api/ai/xai/v1/models",
        {
          headers: {
            authorization: `Bearer ${mode === "local" ? apiKey : accessKey}`,
          },
        }
      );
      const { data = [] } = await response.json();
      const newModelList = (data as OpenAIModel[])
        .map((item) => item.id)
        .filter((id) => !id.includes("image"));
      setModelList(newModelList);
      return newModelList;
    } else if (provider === "mistral") {
      const { mistralApiKey = "", mistralApiProxy } =
        useSettingStore.getState();
      if (mode === "local" && !mistralApiKey) {
        return [];
      }
      const apiKey = multiApiKeyPolling(mistralApiKey);
      const response = await fetch(
        mode === "local"
          ? completePath(mistralApiProxy || MISTRAL_BASE_URL, "/v1") + "/models"
          : "/api/ai/mistral/v1/models",
        {
          headers: {
            authorization: `Bearer ${mode === "local" ? apiKey : accessKey}`,
          },
        }
      );
      const { data = [] } = await response.json();
      const newModelList = (data as MistralModel[])
        .filter((item) => item.capabilities.completion_chat)
        .map((item) => item.id);
      setModelList(newModelList);
      return newModelList;
    } else if (provider === "openaicompatible") {
      const { openAICompatibleApiKey = "", openAICompatibleApiProxy } =
        useSettingStore.getState();
      if (mode === "local" && !openAICompatibleApiKey) {
        return [];
      }
      const apiKey = multiApiKeyPolling(openAICompatibleApiKey);
      const response = await fetch(
        mode === "loc
```

### Core Architecture Module: `src/hooks/useSubmitShortcut.ts`
```
import { useCallback, type KeyboardEvent } from "react";

type SubmitTarget = HTMLTextAreaElement | HTMLInputElement;

function useSubmitShortcut(
  onSubmit: () => void
): (event: KeyboardEvent<SubmitTarget>) => void {
  return useCallback(
    (event: KeyboardEvent<SubmitTarget>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        onSubmit();
      }
    },
    [onSubmit]
  );
}

export default useSubmitShortcut;

```

### Core Architecture Module: `src/hooks/useWebSearch.ts`
```
import { useSettingStore } from "@/store/setting";
import {
  createSearchProvider,
  type SearchProviderOptions,
} from "@/utils/deep-research/search";
import { multiApiKeyPolling } from "@/utils/model";
import { generateSignature } from "@/utils/signature";

function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^\*\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function parseDomainList(value: string) {
  return value
    .split(/[\s,\n]+/g)
    .map((item) => normalizeDomain(item))
    .filter((item) => item.length > 0);
}

function matchDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isUrlAllowed(
  url: string,
  includeDomains: string[],
  excludeDomains: string[]
) {
  try {
    const hostname = normalizeDomain(new URL(url).hostname);
    if (excludeDomains.some((domain) => matchDomain(hostname, domain))) {
      return false;
    }
    if (includeDomains.length === 0) {
      return true;
    }
    return includeDomains.some((domain) => matchDomain(hostname, domain));
  } catch {
    return includeDomains.length === 0;
  }
}

function applyDomainFilters(
  result: { sources: Source[]; images: ImageSource[] },
  includeDomains: string[],
  excludeDomains: string[]
) {
  if (includeDomains.length === 0 && excludeDomains.length === 0) {
    return result;
  }

  return {
    sources: result.sources.filter((source) =>
      isUrlAllowed(source.url, includeDomains, excludeDomains)
    ),
    images: result.images.filter((image) =>
      isUrlAllowed(image.url, includeDomains, excludeDomains)
    ),
  };
}

function useWebSearch() {
  async function search(query: string) {
    const {
      mode,
      searchProvider,
      searchMaxResult,
      accessPassword,
      searchIncludeDomains,
      searchExcludeDomains,
    } = useSettingStore.getState();
    const options: SearchProviderOptions = {
      provider: searchProvider,
      maxResult: searchMaxResult,
      query,
    };
    const includeDomains = parseDomainList(searchIncludeDomains);
    const excludeDomains = parseDomainList(searchExcludeDomains);

    switch (searchProvider) {
      case "tavily":
        const { tavilyApiKey, tavilyApiProxy, tavilyScope } =
          useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = tavilyApiProxy;
          options.apiKey = multiApiKeyPolling(tavilyApiKey);
        } else {
          options.baseURL = location.origin + "/api/search/tavily";
        }
        options.scope = tavilyScope;
        break;
      case "firecrawl":
        const { firecrawlApiKey, firecrawlApiProxy } =
          useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = firecrawlApiProxy;
          options.apiKey = multiApiKeyPolling(firecrawlApiKey);
        } else {
          options.baseURL = location.origin + "/api/search/firecrawl";
        }
        break;
      case "crw":
        const { crwApiKey, crwApiProxy } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = crwApiProxy;
          options.apiKey = multiApiKeyPolling(crwApiKey);
        } else {
          options.baseURL = location.origin + "/api/search/crw";
        }
        break;
      case "exa":
        const { exaApiKey, exaApiProxy, exaScope } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = exaApiProxy;
          options.apiKey = multiApiKeyPolling(exaApiKey);
        } else {
          options.baseURL = location.origin + "/api/search/exa";
        }
        options.scope = exaScope;
        break;
      case "bocha":
        const { bochaApiKey, bochaApiProxy } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = bochaApiProxy;
          options.apiKey = multiApiKeyPolling(bochaApiKey);
        } else {
          options.baseURL = location.origin + "/api/search/bocha";
        }
        break;
      case "brave":
        const { braveApiKey, braveApiProxy } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = braveApiProxy;
          options.apiKey = multiApiKeyPolling(braveApiKey);
        } else {
          options.baseURL = location.origin + "/api/search/brave";
        }
        break;
      case "searxng":
        const { searxngApiProxy, searxngScope } = useSettingStore.getState();
        if (mode === "local") {
          options.baseURL = searxngApiProxy;
        } else {
          options.baseURL = location.origin + "/api/search/searxng";
        }
        options.scope = searxngScope;
        break;
      default:
        break;
    }

    if (mode === "proxy") {
      options.apiKey = generateSignature(accessPassword, Date.now());
    }

    const result = await createSearchProvider(options);
    return applyDomainFilters(result, includeDomains, excludeDomains);
  }

  return { search };
}

export default useWebSearch;

```

### Core Architecture Module: `src/utils/animate-text.ts`
```
// Reference https://github.com/bytedance/deer-flow/blob/main/web/src/core/rehype/rehype-split-words-into-spans.ts
import type { Element, Root, ElementContent } from "hast";
import { visit } from "unist-util-visit";
import type { BuildVisitor } from "unist-util-visit";

export function animateText(locale: string = "zh") {
  return (tree: Root) => {
    if (tree) {
      visit(tree, "element", ((node: Element) => {
        if (
          ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "strong"].includes(
            node.tagName
          ) &&
          node.children
        ) {
          const newChildren: Array<ElementContent> = [];
          node.children.forEach((child) => {
            if (child.type === "text") {
              const segmenter = new Intl.Segmenter(locale, {
                granularity: "word",
              });
              const segments = segmenter.segment(child.value);
              const words = Array.from(segments)
                .map((segment) => segment.segment)
                .filter(Boolean);
              words.forEach((word: string) => {
                newChildren.push({
                  type: "element",
                  tagName: "span",
                  properties: {
                    className: "animate-fade-in",
                  },
                  children: [{ type: "text", value: word }],
                });
              });
            } else {
              newChildren.push(child);
            }
          });
          node.children = newChildren;
        }
      }) as BuildVisitor<Root, "element">);
    }
  };
}

```

### Core Architecture Module: `src/utils/artifact.ts`
```
export function AIWritePrompt(
  content: string,
  prompt: string,
  systemInstruction: string = ""
) {
  return `Your task is to modify the following artifacts as required in feature.
Try not to change the meaning or story behind the artifact as much as possible.

here is the feature list:
<feature>
${prompt}
</feature>

Here is the current content of the artifact:
<artifact>
${content}
</artifact>

When the following systemInstruction is not empty, you can also think further about artifacts in conjunction with systemInstruction.
<systemInstruction>
${systemInstruction}
</systemInstruction>

Rules and guidelines:
<rules-guidelines>
- ONLY change the language and nothing else.
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in \`<feature></feature>\`, \`<artifact></artifact>\`, \`<systemInstruction></systemInstruction>\`, \`<rules-guidelines></rules-guidelines>\`. Ensure it's just the updated artifact.
- Do not change the language of the updated artifact. The updated artifact language is consistent with the current artifact.
</rules-guidelines>`;
}

export function changeLanguagePrompt(
  content: string,
  lang: string,
  systemInstruction: string = ""
) {
  return `You are a professional ${lang} translator, editor, spelling corrector and improver with rich experience.
You can understand any language, and when I talk to you in any language, you will detect the language of that language, translate it correctly, and reply with the corrected and improved version of the ${lang} text.

Here is the current content of the artifact:
<artifact>
${content}
</artifact>

When the following systemInstruction is not empty, you can also think further about artifacts in conjunction with systemInstruction.
<systemInstruction>
${systemInstruction}
</systemInstruction>

Rules and guidelines:
<rules-guidelines>
- ONLY change the language and nothing else.
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in \`<artifact></artifact>\`, \`<systemInstruction></systemInstruction>\`, \`<rules-guidelines></rules-guidelines>\`. Ensure it's just the updated artifact.
</rules-guidelines>`;
}

export function changeReadingLevelPrompt(
  content: string,
  level: string,
  systemInstruction: string = ""
) {
  let prompt = "";
  if (level === "pirate") {
    prompt = `You are tasked with re-writing the following artifact to sound like a pirate.
Ensure you do not change the meaning or story behind the artifact, simply update the tone to sound like a pirate.    
`;
  } else {
    prompt = `You are tasked with re-writing the following artifact to be at a ${level} reading level.
Ensure you do not change the meaning or story behind the artifact, simply update the tone to be of the appropriate reading level for a ${level} audience.`;
  }
  return `${prompt}
Keep the language of the artifact unchanged. For example, if the original text is in Chinese, the rewritten content must also be in Chinese.

Here is the current content of the artifact:
<artifact>
${content}
</artifact>

When the following systemInstruction is not empty, you can also think further about artifacts in conjunction with systemInstruction.
<systemInstruction>
${systemInstruction}
</systemInstruction>

Rules and guidelines:
<rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in \`<artifact></artifact>\`, \`<systemInstruction></systemInstruction>\`, \`<rules-guidelines></rules-guidelines>\`. Ensure it's just the updated artifact.
- Do not change the language of the updated artifact. The updated artifact language is consistent with the current artifact.
</rules-guidelines>`;
}

export function adjustLengthPrompt(
  content: string,
  length: string,
  systemInstruction: string = ""
) {
  return `You are tasked with re-writing the following artifact to be ${length}.
Ensure you do not change the meaning or story behind the artifact, simply update the artifacts length to be ${length}.

Here is the current content of the artifact:
<artifact>
${content}
</artifact>

When the following systemInstruction is not empty, you can also think further about artifacts in conjunction with systemInstruction.
<systemInstruction>
${systemInstruction}
</systemInstruction>

Rules and guidelines:
</rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in \`<artifact></artifact>\`, \`<systemInstruction></systemInstruction>\`, \`<rules-guidelines></rules-guidelines>\`. Ensure it's just the updated artifact.
- Do not change the language of the updated artifact. The updated artifact language is consistent with the current artifact.
</rules-guidelines>`;
}

export function addEmojisPrompt(
  content: string,
  systemInstruction: string = ""
) {
  return `You are tasked with revising the following artifact by adding emojis to it.
Ensure you do not change the meaning or story behind the artifact, simply include emojis throughout the text where appropriate.

Here is the current content of the artifact:
<artifact>
${content}
</artifact>

When the following systemInstruction is not empty, you can also think further about artifacts in conjunction with systemInstruction.
<systemInstruction>
${systemInstruction}
</systemInstruction>

Rules and guidelines:
</rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Ensure you respond with the entire updated artifact, including the emojis.
- Do not wrap it in \`<artifact></artifact>\`, \`<systemInstruction></systemInstruction>\`, \`<rules-guidelines></rules-guidelines>\`. Ensure it's just the updated artifact.
- Do not change the language of the updated artifact. The updated artifact language is consistent with the current artifact.
</rules-guidelines>`;
}

export function continuationPrompt(
  content: string,
  systemInstruction: string = ""
) {
  return `Your task is to continue writing the following artifact.
Maintain the following artifact writing style, including but not limited to typesetting, punctuation, etc.
Only the continued artifact needs to be returned, without including the current artifact.

Here is the current content of the artifact:
<artifact>
${content}
</artifact>

When the following systemInstruction is not empty, you can also think further about artifacts in conjunction with systemInstruction.
<systemInstruction>
${systemInstruction}
</systemInstruction>

Rules and guidelines:
</rules-guidelines>
- Respond with ONLY the continued artifact, and no additional text before.
- Do not wrap it in \`<artifact></artifact>\`, \`<systemInstruction></systemInstruction>\`, \`<rules-guidelines></rules-guidelines>\`. Ensure it's just the updated artifact.
- Do not change the language of the continued artifact. The continued artifact language is consistent with the current artifact.
</rules-guidelines>`;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #145** (2025-11-11): **[Bug]: Google wil drop the default model in this project in 1108**
  *Symptoms*: ### Bug Description  Google wil drop the default model in this project in this week, so any update for the model changing ?  Thanks your awesome projects, it is very useful for review sth quickly.  ### Steps to Reproduce  Google wil drop the default model in this project in this week, so any update for the model changing ?  Thanks your awesome projects, it is very useful for review sth quickly.  ### Expected Behavior  Google wil drop the default model in this project in this week, so any update for the model changing ?  Thanks your awesome projects, it is very useful for review sth quickly.  ### Screenshots  _No response_  ### Deployment Method  - [ ] Docker - [ ] Vercel - [ ] Server  ### Desktop OS  _No response_  ### Desktop Browser  _No response_  ### Desktop Browser Version  _No response_  ### Smartphone Device  _No response_  ### Smartphone OS  _No response_  ### Smartphone Browser  _No response_  ### Smartphone Browser Version  _No response_  ### Additional Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > I will be upgrading the project's default model soon.

- **Issue #144** (2025-10-22): **[Question] 403 Forbidden Error When Using Proxy Mode**
  *Symptoms*: ### Bug Description  Hello dear maintainers, I'm encountering an issue specifically when trying to use the "Proxy mode". While "Local mode" works perfectly, the proxy functionality seems to be blocked.  #### **Environment** *   **Deployment:** Docker *   **Docker Command:**     ```bash     docker run -d --name deep-research \       -p 3333:3000 \       -e GOOGLE_GENERATIVE_AI_API_KEY=AIz... \       xiangfa/deep-research     ``` *   **Access URL:** `http://<my-server-ip>:3333`   ### Steps to Reproduce  1.  Start the container using the command above on a remote server. 2.  Access the web interface at `http://<my-server-ip>:3333`. 3.  **Test Local Mode:**     *   Select "Local" as the AI provider mode.     *   All features work correctly.     *   The browser's developer tools (F12 Network tab) show direct and successful requests to `https://generativelanguage.googleapis.com/v1beta/models/...`. 4.  **Test Proxy Mode:**     *   Switch to "Proxy" as the AI provider mode.     *   Attempt to perform any action that requires an AI call (e.g., initiate a search).     *   The action fails.  ### Expected Behavior  In Proxy mode, the backend server should successfully proxy the request to the Google Generative AI API and return a valid response to the frontend. The functionality should be the same as in Local mode.  #### **Actual Behavior** In Proxy mode, the request from the frontend to the backend's proxy endpoint fails with a **`403 Forbidden`** HTTP status code.  The browser's develo
  **Post-Mortem & Fix Analysis**:
  > sorry about that, I use [https://deepwiki.com/u14app/deep-research](url) ask the same question, I solve this naive problem.  I just set ACCESS_PASSWORD when I run docker image and paste the PWD in web Proxy Mode form 

- **Issue #118** (2025-07-25): **[Bug]: Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently**
  *Symptoms*: ### Bug Description  I'm encountering an issue where using any model other than gemini-2.5-pro results in errors during the information collection phase (Step 3) of my in-depth research. Below are the relevant details: Time        API Key (Partial)        Model        Status 2025/7/25 14:02:11        AIza...BF_s        gemini-2.5-pro        success 2025/7/25 14:01:33        AIza...hgEo        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...7aY4        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...gg2U        gemini-2.0-flash        failure 2025/7/25 13:55:09        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...7aY4        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:59        AIza...gg2U        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:30        AIza...7aY4        gemini-2.5-pro        success  ### Steps to Reproduce  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Expected Behavior  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Screenshots  _No response
  **Post-Mortem & Fix Analysis**:
  > You need to confirm whether your Gemini Key has search quota. Currently, the search quota for all models of Gemini free users is shared by accounts, that is, the search quota for all models of all keys under the same account is the same.  If the account's search limit is exceeded, the API will return a 429 error.
  > 我也是同样的问题也，搜索全部失败。我确认我的key最近几周都完全没有用过，不可能存在quota的问题，同时通过cherry可以搜索成功。
  >   > Bot detected the issue body's language is not English, translate it automatically.          ----     I have the same problem, all searches failed. I confirm that my key has not been used in the last few weeks, so it is impossible to have a quota problem, and at the same time, I can search successfully through cherry.         

- **Issue #117** (2025-07-25): **[Bug]: Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently**
  *Symptoms*: ### Bug Description  I'm encountering an issue where using any model other than gemini-2.5-pro results in errors during the information collection phase (Step 3) of my in-depth research. Below are the relevant details: Time        API Key (Partial)        Model        Status 2025/7/25 14:02:11        AIza...BF_s        gemini-2.5-pro        success 2025/7/25 14:01:33        AIza...hgEo        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...7aY4        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...gg2U        gemini-2.0-flash        failure 2025/7/25 13:55:09        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...7aY4        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:59        AIza...gg2U        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:30        AIza...7aY4        gemini-2.5-pro        success  ### Steps to Reproduce  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Expected Behavior  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Screenshots  _No response

- **Issue #116** (2025-07-25): **[Bug]: Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently**
  *Symptoms*: ### Bug Description  I'm encountering an issue where using any model other than gemini-2.5-pro results in errors during the information collection phase (Step 3) of my in-depth research. Below are the relevant details: Time        API Key (Partial)        Model        Status 2025/7/25 14:02:11        AIza...BF_s        gemini-2.5-pro        success 2025/7/25 14:01:33        AIza...hgEo        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...7aY4        gemini-2.0-flash        failure 2025/7/25 14:01:32        AIza...gg2U        gemini-2.0-flash        failure 2025/7/25 13:55:09        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:55:08        AIza...7aY4        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:59        AIza...gg2U        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...BF_s        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:58        AIza...hgEo        gemini-2.5-flash-preview-05-20        failure 2025/7/25 13:54:30        AIza...7aY4        gemini-2.5-pro        success  ### Steps to Reproduce  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Expected Behavior  Error in Information Collection Phase (Step 3): Only gemini-2.5-pro Succeeds, Other Models Fail Consistently  ### Screenshots  _No response

- **Issue #112** (2025-07-21): **[Bug]: Anwser in Spanish language**
  *Symptoms*: ### Bug Description  Version 0.9.18  I ask in English, my location not in Spain (or Spain speaking country), my locale in OS not Spanish, but I receive an answer in Spanish.  Possible related PR https://github.com/u14app/deep-research/pull/64 which might cause the issue.  My deployment with Helm Chart, here is `deployment.yaml` <details>   <summary>Kubernetes deployment manifest</summary>          ```yaml apiVersion: apps/v1 kind: Deployment metadata:   name: {{ .Release.Name }}   labels:     app: {{ .Release.Name }}     version: {{ .Chart.AppVersion }} spec:   replicas: 1   selector:     matchLabels:       app: {{ .Release.Name }}   template:     metadata:       labels:         app: {{ .Release.Name }}         version: {{ .Chart.AppVersion }}     spec:       serviceAccountName: {{ .Release.Name }}       containers:         - name: deep-research           image: xiangfa/deep-research:v0.9.18           imagePullPolicy: Always           ports:             - containerPort: 3000               name: http           env:             - name: OPENAI_API_KEY               valueFrom:                 secretKeyRef:                   name: "{{ .Release.Name }}-secrets"                   key: "openai-api-key"           volumeMounts:             - name: secrets-store-inline               mountPath: "/secrets/openai"               readOnly: true           resources:             requests:               memory: "256Mi"               cpu: "100m"             limits:               memory: "512Mi" 
  **Post-Mortem & Fix Analysis**:
  > Sometimes the AI fails to follow the prompt correctly, so you can add additional instructions like "Please respond in English" after asking the question.

- **Issue #108** (2025-07-18): **[Bug]: gemini font rendering anamolies**
  *Symptoms*: ### Bug Description  Using Gemini 2.5 Flash  Deep Search: v0.9.18  When Gemini generates certain responses —  the rendered text appears garbled. This severely affects readability and comprehension.  This issue appears to be Gemini specific issue. I have seen these type of weird characters in their AI playground as well. Doing some kind of parsing on the results could resolve this.   Possible Cause (Speculation): Markdown rendering issue with bold/italic text. Improper parsing Unicode or invisible character artifacts causing display issues.  ### Steps to Reproduce  Use Gemini Flash for deep research  ### Expected Behavior  Clear and legible text.  ### Screenshots  <img width="2128" height="1055" alt="Image" src="https://github.com/user-attachments/assets/0ae79868-030a-4962-b8c3-f268aae1723a" />  <img width="1454" height="566" alt="Image" src="https://github.com/user-attachments/assets/e114da3b-bf22-42c9-9456-28aec2c0975f" />  ### Deployment Method  - [ ] Docker - [x] Vercel - [ ] Server  ### Desktop OS  Windows 10  ### Desktop Browser  Edge  ### Desktop Browser Version  138.0.3351.83  ### Smartphone Device  _No response_  ### Smartphone OS  _No response_  ### Smartphone Browser  _No response_  ### Smartphone Browser Version  _No response_  ### Additional Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > This font is for inline formulas. These text segments are judged by AI as formulas and rendered in inlineMath. You can request not to use any LaTeX syntax or prohibit the use of Inline formula when writing the final report.

- **Issue #107** (2025-07-15): **[Bug]: Can't connect to deployment on Vercel**
  *Symptoms*: ### Bug Description  I deployed to Vercel with all `MCP_*` env variables and an `ACCESS_PASSWORD` set. After not being able to connect from Langgraph, Flowise, n8n while connection to localhost all worked, I tried a MCP-type request with Postman which raises the error:  ``` Couldn't run the request: Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","error":{"code":-32001,"message":"Session not found"},"id":null} ``` path is `/api/mcp/sse`, method `HTTP` (Postman apparently means SSE, not streamable-http with "HTTP"). Langgraph fails with a `400 Bad Request`.  Anything I can check?   ### Steps to Reproduce  1. Click the "Deploy to Vercel" link in the readme 2. Deploy the app   ### Expected Behavior  Successful connection with capabilities returned  ### Screenshots  _No response_  ### Deployment Method  - [ ] Docker - [ ] Vercel - [ ] Server  ### Desktop OS  _No response_  ### Desktop Browser  _No response_  ### Desktop Browser Version  _No response_  ### Smartphone Device  _No response_  ### Smartphone OS  _No response_  ### Smartphone Browser  _No response_  ### Smartphone Browser Version  _No response_  ### Additional Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > `/api/mcp/sse` is the SSE mode of the MCP protocol. It is a composite port and involves the protocol upgrade mode. You cannot directly request it using Postman. You need to use the MCP client to request it.  If you want to use the `SSE` API directly, you need to access `/api/sse`. For the request parameters, please refer to the [document description](https://github.com/u14app/deep-research?tab=readme-ov-file#server-sent-events-api).
  > Thanks! Postman offers "MCP" as additional protocol next to HTTP, WS and others in beta and acts as a MCP client. It lets you list capabilities, call tools etc. Regardless, the URL is not the issue.  Simply put, localhost and fly (newly tested) work fine. The one-click Vercel deployment does not respond:  ```python from langchain_mcp_adapters.client import MultiServerMCPClient   url = "http://localhost:3000/api/mcp" # Locally hosted OK url = "https://deep-research-snowy-paper-9176.fly.dev/api/mcp" # Fly.io hosted OK url = "https://deep-research-qojm.vercel.app/api/mcp" # Vercel hosted FAILS  client = MultiServerMCPClient(     {         "deep-research": {             "url": url,             "transport": "streamable_http",         } ) tools = await client.get_tools() model = init_chat_model("google_genai:gemini-2.5-flash").bind_tools(tools) model.invoke(...) ```
  > Have you confirmed that the vercel default domain name can be accessed normally?

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

### Incident Patch 1: `4645efd5` (2026-04-18)
**Commit Message**: fix: handle empty request body for searxng

The frontend sends a request to POST /api/search/searxng/search with no request body, but the code tries to extract it as json, which effectly parses empty string to json, which fails. This commit sets the body to null if the request body is absent.

Refs: #91

**File**: `src/app/api/search/searxng/[...slug]/route.ts` (modified, +2/-1)
```diff
@@ -18,7 +18,8 @@ const API_PROXY_BASE_URL = process.env.SEARXNG_API_BASE_URL || SEARXNG_BASE_URL;
 export async function POST(req: NextRequest) {
   let body;
   if (req.method.toUpperCase() !== "GET") {
-    body = await req.json();
+    const text = await req.text();
+    body = text ? JSON.parse(text) : null;
   }
   const searchParams = req.nextUrl.searchParams;
   const path = searchParams.getAll("slug");
```

---

### Incident Patch 2: `e11c4a1d` (2026-04-14)
**Commit Message**: fix: Fix Ollama token validation logic.

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.11.0",
+  "version": "0.11.1",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/middleware.ts` (modified, +78/-76)
```diff
@@ -62,25 +62,25 @@ export async function middleware(request: NextRequest) {
   const hasDisabledGeminiModel = () => {
     if (request.method.toUpperCase() === "GET") return false;
     const { availableModelList, disabledModelList } = getCustomModelList(
-      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : []
+      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : [],
     );
     const isAvailableModel = availableModelList.some((availableModel) =>
-      request.nextUrl.pathname.includes(`models/${availableModel}:`)
+      request.nextUrl.pathname.includes(`models/${availableModel}:`),
     );
     if (isAvailableModel) return false;
     if (disabledModelList.includes("all")) return true;
     return disabledModelList.some((disabledModel) =>
-      request.nextUrl.pathname.includes(`models/${disabledModel}:`)
+      request.nextUrl.pathname.includes(`models/${disabledModel}:`),
     );
   };
   const hasDisabledAIModel = async () => {
     if (request.method.toUpperCase() === "GET") return false;
     const { model = "" } = await request.json();
     const { availableModelList, disabledModelList } = getCustomModelList(
-      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : []
+      MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : [],
     );
     const isAvailableModel = availableModelList.some(
-      (availableModel) => availableModel === model
+      (availableModel) => availableModel === model,
     );
     if (isAvailableModel) return false;
     if (disabledModelList.includes("all")) return true;
@@ -97,19 +97,19 @@ export async function middleware(request: NextRequest) {
     ) {
       return NextResponse.json(
         { error: ERRORS.NO_PERMISSIONS },
-        { status: 403 }
+        { status: 403 },
       );
     } else {
       const apiKey = multiApiKeyPolling(GOOGLE_GENERATIVE_AI_API_KEY);
       if (apiKey) {
         const requestHeaders = new Headers();
         requestHeaders.set(
           "Content-Type",
-          request.headers.get("Content-Type") || "application/json"
+          request.headers.get("Content-Type") || "application/json",
         );
         requestHeaders.set(
           "x-goog-api-client",
-          request.headers.get("x-goog-api-client") || "genai-js/0.24.0"
+          request.headers.get("x-goog-api-client") || "genai-js/0.24.0",
         );
         requestHeaders.set("x-goog-api-key", apiKey);
         return NextResponse.next({
@@ -122,7 +122,7 @@ export async function middleware(request: NextRequest) {
           {
             error: ERRORS.NO_API_KEY,
           },
-          { status: 500 }
+          { status: 500 },
         );
       }
     }
@@ -134,22 +134,22 @@ export async function middleware(request: NextRequest) {
       !verifySignature(
         authorization.substring(7),
         accessPassword,
-        Date.now()
+        Date.now(),
       ) ||
       disabledAIProviders.includes("openrouter") ||
       isDisabledModel
     ) {
       return NextResponse.json(
         { error: ERRORS.NO_PERMISSIONS },
-        { status: 403 }
+        { status: 403 },
       );
     } else {
       const apiKey = multiApiKeyPolling(OPENROUTER_API_KEY);
       if (apiKey) {
         const requestHeaders = new Headers();
         requestHeaders.set(
           "Content-Type",
-          request.headers.get("Content-Type") || "application/json"
+          request.headers.get("Content-Type") || "application/json",
         );
         requestHeaders.set("Authorization", `Bearer ${apiKey}`);
         return NextResponse.next({
@@ -162,7 +162,7 @@ export async function middleware(request: NextRequest) {
           {
             error: ERRORS.NO_API_KEY,
           },
-          { status: 500 }
+          { status: 500 },
         );
       }
     }
@@ -174,22 +174,22 @@ export async function middleware(request: NextRequest) {
       !verifySignature(
         authorization.substring(7),
         accessPassword,
-        Date.now()
+        Date.now(),
       ) ||
       disabledAIProviders.includes("openaicompatible") ||
       isDisabledModel
     ) {
       return NextResponse.json(
         { error: ERRORS.NO_PERMISSIONS },
-        { status: 403 }
+        { status: 403 },
       );
     } else {
       const apiKey = multiApiKeyPolling(OPENAI_COMPATIBLE_API_KEY);
       if (apiKey) {
         const requestHeaders = new Headers();
         requestHeaders.set(
           "Content-Type",
-          request.headers.get("Content-Type") || "application/json"
+          request.headers.get("Content-Type") || "application/json",
         );
         requestHeaders.set("Authorization", `Bearer ${apiKey}`);
         return NextResponse.next({
@@ -202,7 +202,7 @@ export async function middleware(request: NextRequest) {
           {
             error: ERRORS.NO_API_KEY,
           },
-          { status: 500 }
+          { status: 500 },
         );
       }
     }
@@ -214,22 +214,22 @@ export async function middleware(request: NextRequest) {
       !verify
```

---

### Incident Patch 3: `dfcf9add` (2026-02-10)
**Commit Message**: Implement feature X to enhance user experience and fix bug Y in module Z



---

### Incident Patch 4: `ef227f0e` (2026-02-10)
**Commit Message**: feat: Add AGENTS.md to define coding practices and guidelines

**File**: `.vscode/settings.json` (modified, +9/-1)
```diff
@@ -3,5 +3,13 @@
   "i18n-ally.localesPaths": ["src/locales"],
   "i18n-ally.keystyle": "nested",
   "i18n-ally.displayLanguage": "en-US",
-  "i18n-ally.sourceLanguage": "en-US"
+  "i18n-ally.sourceLanguage": "en-US",
+  "files.exclude": {
+    "**/.git": true,
+    "**/.svn": true,
+    "**/.hg": true,
+    "**/.DS_Store": true,
+    "**/Thumbs.db": true
+  },
+  "hide-files.files": []
 }
```

**File**: `AGENTS.md` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+# AGENTS
+
+This file describes how automated coding agents (and humans) should work in this repository.
+
+## Scope
+
+- Applies to the entire repository unless a deeper `AGENTS.md` exists in a subdirectory.
+
+## Goals
+
+- Keep changes small, focused, and easy to review.
+- Preserve existing behavior unless the task explicitly requires behavior changes.
+- Prefer clarity over cleverness.
+
+## Working Agreement
+
+- Read relevant files before editing.
+- Reuse existing patterns and conventions in the codebase.
+- Do not make unrelated refactors while implementing a task.
+- Add or update tests when behavior changes.
+- Run the smallest relevant validation (tests/lint/typecheck) before finishing.
+
+## Safety
+
+- Never commit secrets, tokens, or private keys.
+- Avoid destructive actions (`rm -rf`, history rewriting) unless explicitly requested.
+- If unexpected local changes are present, do not revert them unless asked.
+
+## Communication
+
+- Summarize what changed, where, and why.
+- Call out tradeoffs, assumptions, and known limitations.
+- If validation could not be run, say so explicitly.
+
+## File/Code Style
+
+- Follow existing formatting and lint rules.
+- Keep functions and modules cohesive.
+- Use descriptive names and add comments only where intent is non-obvious.
+
+## Preferred Workflow
+
+1. Understand the request and inspect the relevant code.
+2. Implement the minimal correct change.
+3. Validate with targeted checks.
+4. Provide a concise summary with touched files.
```

---

### Incident Patch 5: `02122562` (2025-12-06)
**Commit Message**: build: Fix the next.js vulnerability

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.10.1",
+  "version": "0.10.2",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
@@ -60,7 +60,7 @@
     "marked": "^15.0.12",
     "mermaid": "^11.6.0",
     "nanoid": "^5.1.5",
-    "next": "^15.3.1",
+    "next": "^15.5.7",
     "next-themes": "^0.4.4",
     "ollama-ai-provider": "^1.2.0",
     "p-limit": "^6.2.0",
```

**File**: `pnpm-lock.yaml` (modified, +44/-44)
```diff
@@ -82,7 +82,7 @@ importers:
         version: 1.2.7(@types/react-dom@19.1.6(@types/react@19.1.8))(@types/react@19.1.8)(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
       '@serwist/next':
         specifier: ^9.0.14
-        version: 9.1.0(next@15.4.1(@opentelemetry/api@1.9.0)(babel-plugin-react-compiler@19.1.0-rc.1)(react-dom@19.1.0(react@19.1.0))(react@19.1.0))(typescript@5.8.3)
+        version: 9.1.0(next@15.5.7(@opentelemetry/api@1.9.0)(babel-plugin-react-compiler@19.1.0-rc.1)(react-dom@19.1.0(react@19.1.0))(react@19.1.0))(typescript@5.8.3)
       '@xiangfa/mdeditor':
         specifier: ^0.2.3
         version: 0.2.3
@@ -138,8 +138,8 @@ importers:
         specifier: ^5.1.5
         version: 5.1.5
       next:
-        specifier: ^15.3.1
-        version: 15.4.1(@opentelemetry/api@1.9.0)(babel-plugin-react-compiler@19.1.0-rc.1)(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
+        specifier: ^15.5.7
+        version: 15.5.7(@opentelemetry/api@1.9.0)(babel-plugin-react-compiler@19.1.0-rc.1)(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
       next-themes:
         specifier: ^0.4.4
         version: 0.4.6(react-dom@19.1.0(react@19.1.0))(react@19.1.0)
@@ -856,56 +856,56 @@ packages:
   '@napi-rs/wasm-runtime@0.2.12':
     resolution: {integrity: sha512-ZVWUcfwY4E/yPitQJl481FjFo3K22D6qF0DuFH6Y/nbnE11GY5uguDxZMGXPQ8WQ0128MXQD7TnfHyK4oWoIJQ==}
 
-  '@next/env@15.4.1':
-    resolution: {integrity: sha512-DXQwFGAE2VH+f2TJsKepRXpODPU+scf5fDbKOME8MMyeyswe4XwgRdiiIYmBfkXU+2ssliLYznajTrOQdnLR5A==}
+  '@next/env@15.5.7':
+    resolution: {integrity: sha512-4h6Y2NyEkIEN7Z8YxkA27pq6zTkS09bUSYC0xjd0NpwFxjnIKeZEeH591o5WECSmjpUhLn3H2QLJcDye3Uzcvg==}
 
   '@next/eslint-plugin-next@15.1.7':
     resolution: {integrity: sha512-kRP7RjSxfTO13NE317ek3mSGzoZlI33nc/i5hs1KaWpK+egs85xg0DJ4p32QEiHnR0mVjuUfhRIun7awqfL7pQ==}
 
-  '@next/swc-darwin-arm64@15.4.1':
-    resolution: {integrity: sha512-L+81yMsiHq82VRXS2RVq6OgDwjvA4kDksGU8hfiDHEXP+ncKIUhUsadAVB+MRIp2FErs/5hpXR0u2eluWPAhig==}
+  '@next/swc-darwin-arm64@15.5.7':
+    resolution: {integrity: sha512-IZwtxCEpI91HVU/rAUOOobWSZv4P2DeTtNaCdHqLcTJU4wdNXgAySvKa/qJCgR5m6KI8UsKDXtO2B31jcaw1Yw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [darwin]
 
-  '@next/swc-darwin-x64@15.4.1':
-    resolution: {integrity: sha512-jfz1RXu6SzL14lFl05/MNkcN35lTLMJWPbqt7Xaj35+ZWAX342aePIJrN6xBdGeKl6jPXJm0Yqo3Xvh3Gpo3Uw==}
+  '@next/swc-darwin-x64@15.5.7':
+    resolution: {integrity: sha512-UP6CaDBcqaCBuiq/gfCEJw7sPEoX1aIjZHnBWN9v9qYHQdMKvCKcAVs4OX1vIjeE+tC5EIuwDTVIoXpUes29lg==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [darwin]
 
-  '@next/swc-linux-arm64-gnu@15.4.1':
-    resolution: {integrity: sha512-k0tOFn3dsnkaGfs6iQz8Ms6f1CyQe4GacXF979sL8PNQxjYS1swx9VsOyUQYaPoGV8nAZ7OX8cYaeiXGq9ahPQ==}
+  '@next/swc-linux-arm64-gnu@15.5.7':
+    resolution: {integrity: sha512-NCslw3GrNIw7OgmRBxHtdWFQYhexoUCq+0oS2ccjyYLtcn1SzGzeM54jpTFonIMUjNbHmpKpziXnpxhSWLcmBA==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
 
-  '@next/swc-linux-arm64-musl@15.4.1':
-    resolution: {integrity: sha512-4ogGQ/3qDzbbK3IwV88ltihHFbQVq6Qr+uEapzXHXBH1KsVBZOB50sn6BWHPcFjwSoMX2Tj9eH/fZvQnSIgc3g==}
+  '@next/swc-linux-arm64-musl@15.5.7':
+    resolution: {integrity: sha512-nfymt+SE5cvtTrG9u1wdoxBr9bVB7mtKTcj0ltRn6gkP/2Nu1zM5ei8rwP9qKQP0Y//umK+TtkKgNtfboBxRrw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
 
-  '@next/swc-linux-x64-gnu@15.4.1':
-    resolution: {integrity: sha512-Jj0Rfw3wIgp+eahMz/tOGwlcYYEFjlBPKU7NqoOkTX0LY45i5W0WcDpgiDWSLrN8KFQq/LW7fZq46gxGCiOYlQ==}
+  '@next/swc-linux-x64-gnu@15.5.7':
+    resolution: {integrity: sha512-hvXcZvCaaEbCZcVzcY7E1uXN9xWZfFvkNHwbe/n4OkRhFWrs1J1QV+4U1BN06tXLdaS4DazEGXwgqnu/VMcmqw==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
 
-  '@next/swc-linux-x64-musl@15.4.1':
-    resolution: {integrity: sha512-9WlEZfnw1vFqkWsTMzZDgNL7AUI1aiBHi0S2m8jvycPyCq/fbZjtE/nDkhJRYbSjXbtRHYLDBlmP95kpjEmJbw==}
+  '@next/swc-linux-x64-musl@15.5.7':
+    resolution: {integrity: sha512-4IUO539b8FmF0odY6/SqANJdgwn1xs1GkPO5doZugwZ3ETF6JUdckk7RGmsfSf7ws8Qb2YB5It33mvNL/0acqA==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
 
-  '@next/swc-win32-arm64-msvc@15.4.1':
-    resolution: {integrity: sha512-WodRbZ9g6CQLRZsG3gtrA9w7Qfa9BwDzhFVdlI6sV0OCPq9JrOrJSp9/ioLsezbV8w9RCJ8v55uzJuJ5RgWLZg==}
+  '@next/swc-win32-arm64-msvc@15.5.7':
+    resolution: {integrity: sha512-CpJVTkYI3ZajQkC5vajM7/ApKJUOlm6uP4BknM3XKvJ7VXAvCqSjSLmM0LKdYzn6nBJVSjdclx8nYJSa3xlTgQ==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [win32]
 
-  '@next/swc-win32-x64-msvc@15.4.1':
-    resolution: {integrity: sha512-y+wTBxelk2xiNofmDOVU7O5WxTHcvOoL3srOM0kxTzKDjQ57kPU0tpnPJ/BWrRnsOwXEv0+3QSbGR7hY4n9LkQ==}
+  '@next/swc-win32-x64-msvc@15.5.7':
+    resolution: {integrity: sha512-gMzgBX164I6DN+9/PGA+9dQiwmTkE4TloBNx8Kv9UiGARsr9Nba7IpcBRA1iTV9vwlYnrE3Uy6I7Aj6qLjQuqw==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [win32]
@@ -3248,8 +32
```

---

### Incident Patch 6: `92a11f7f` (2025-09-11)
**Commit Message**: fix: Fixing Type Error

**File**: `src/utils/parser/officeParser.ts` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ function extractFiles(
     const extractedFiles: ExtractedFiles[] = [];
     const processZipfile = async (entry: Entry) => {
       if (filterFn(entry.filename)) {
-        if (entry.getData) {
+        if ("getData" in entry && typeof entry.getData === "function") {
           const data = await entry.getData(new BlobWriter());
           extractedFiles.push({
             filename: entry.filename,
```

---

### Incident Patch 7: `bebe7485` (2025-09-09)
**Commit Message**: fix: Compatible with openrouter default api base url

**File**: `src/hooks/useAiProvider.ts` (modified, +3/-2)
```diff
@@ -150,9 +150,10 @@ function useModelProvider() {
         const { openRouterApiKey = "", openRouterApiProxy } =
           useSettingStore.getState();
         if (mode === "local") {
+          const baseUrl = openRouterApiProxy || OPENROUTER_BASE_URL;
           options.baseURL = completePath(
-            openRouterApiProxy || OPENROUTER_BASE_URL,
-            "/api/v1"
+            baseUrl,
+            baseUrl.endsWith("/api") ? "/v1" : "/api/v1"
           );
           options.apiKey = multiApiKeyPolling(openRouterApiKey);
         } else {
```

---

### Incident Patch 8: `c389ea0e` (2025-09-05)
**Commit Message**: fix: Fix the error description of openrouter default path

**File**: `env.tpl` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ GOOGLE_PRIVATE_KEY_ID=
 
 # (Optional) Server-side OpenRouter API Key (Required for server API calls)
 OPENROUTER_API_KEY=
-# (Optional) Server-side OpenRouter API Proxy URL. Default, `https://openrouter.ai`
+# (Optional) Server-side OpenRouter API Proxy URL. Default, `https://openrouter.ai/api`
 OPENROUTER_API_BASE_URL=
 
 # (Optional) Server-side OpenAI API Key (Required for server API calls)
```

---

### Incident Patch 9: `388dba1c` (2025-08-01)
**Commit Message**: fix: Fixed the issue of abnormal google-vertex model call

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.9.21",
+  "version": "0.9.22",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/app/api/utils.ts` (modified, +4/-0)
```diff
@@ -44,6 +44,7 @@ const XAI_API_KEY = process.env.XAI_API_KEY || "";
 const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
 const AZURE_API_KEY = process.env.AZURE_API_KEY || "";
 const OPENAI_COMPATIBLE_API_KEY = process.env.OPENAI_COMPATIBLE_API_KEY || "";
+const GOOGLE_VERTEX_API_BASE_URL = `https://${process.env.GOOGLE_VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_VERTEX_PROJECT}/locations/${process.env.GOOGLE_VERTEX_LOCATION}/publishers/google`;
 // Search provider API key
 const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
 const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";
@@ -74,6 +75,8 @@ export function getAIProviderBaseURL(provider: string) {
       return completePath(POLLINATIONS_API_BASE_URL, "/v1");
     case "ollama":
       return completePath(OLLAMA_API_BASE_URL, "/api");
+    case "google-vertex":
+      return completePath(GOOGLE_VERTEX_API_BASE_URL);
     default:
       throw new Error("Unsupported Provider: " + provider);
   }
@@ -99,6 +102,7 @@ export function getAIProviderApiKey(provider: string) {
       return OPENROUTER_API_KEY;
     case "openaicompatible":
       return OPENAI_COMPATIBLE_API_KEY;
+    case "google-vertex":
     case "pollinations":
     case "ollama":
       return "";
```

---

### Incident Patch 10: `aa98f46d` (2025-07-30)
**Commit Message**: fix: Fixed `Failed to execute 'atob' on 'Window'` error

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.9.20",
+  "version": "0.9.21",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/app/api/sse/route.ts` (modified, +0/-2)
```diff
@@ -75,8 +75,6 @@ export async function POST(req: NextRequest) {
           } else if (event === "error") {
             console.error(data);
             controller.close();
-          } else {
-            console.warn(`Unknown event: ${event}`);
           }
           controller.enqueue(
             encoder.encode(
```

**File**: `src/utils/vertexAuth.ts` (modified, +5/-1)
```diff
@@ -22,6 +22,10 @@ export interface GoogleCredentials {
 const base64url = (str: string) => {
   return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
 };
+
+const decodeBase64 = (base64: string) => {
+  return Buffer.from(base64, "base64").toString("utf-8");
+};
 const importPrivateKey = async (pemKey: string) => {
   const pemHeader = "-----BEGIN PRIVATE KEY-----";
   const pemFooter = "-----END PRIVATE KEY-----";
@@ -33,7 +37,7 @@ const importPrivateKey = async (pemKey: string) => {
     .replace(/\s/g, "");
 
   // Decode base64 to binary
-  const binaryString = atob(pemContents);
+  const binaryString = decodeBase64(pemContents);
 
   // Convert binary string to Uint8Array
   const binaryData = new Uint8Array(binaryString.length);
```

---

### Incident Patch 11: `2125d359` (2025-07-19)
**Commit Message**: feat: Added support for built-in networking models in the Question and Report scenarios.

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.9.19",
+  "version": "0.9.20",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/hooks/useDeepResearch.ts` (modified, +80/-69)
```diff
@@ -58,13 +58,85 @@ function useDeepResearch() {
   const { search } = useWebSearch();
   const [status, setStatus] = useState<string>("");
 
+  async function generateSearchSettings(searchModel: string) {
+    const { provider, enableSearch, searchProvider, searchMaxResult } =
+      useSettingStore.getState();
+
+    if (enableSearch && searchProvider === "model") {
+      const createModel = (model: string) => {
+        // Enable Gemini's built-in search tool
+        if (
+          ["google", "google-vertex"].includes(provider) &&
+          isNetworkingModel(model)
+        ) {
+          return createModelProvider(model, { useSearchGrounding: true });
+        } else {
+          return createModelProvider(model);
+        }
+      };
+      const getTools = (model: string) => {
+        // Enable OpenAI's built-in search tool
+        if (
+          ["openai", "azure", "openaicompatible"].includes(provider) &&
+          model.startsWith("gpt-4o")
+        ) {
+          return {
+            web_search_preview: openai.tools.webSearchPreview({
+              // optional configuration:
+              searchContextSize: searchMaxResult > 5 ? "high" : "medium",
+            }),
+          } as Tools;
+        }
+      };
+      const getProviderOptions = (model: string) => {
+        // Enable OpenRouter's built-in search tool
+        if (provider === "openrouter") {
+          return {
+            openrouter: {
+              plugins: [
+                {
+                  id: "web",
+                  max_results: searchMaxResult, // Defaults to 5
+                },
+              ],
+            },
+          } as ProviderOptions;
+        } else if (
+          provider === "xai" &&
+          model.startsWith("grok-3") &&
+          !model.includes("mini")
+        ) {
+          return {
+            xai: {
+              search_parameters: {
+                mode: "auto",
+                max_search_results: searchMaxResult,
+              },
+            },
+          } as ProviderOptions;
+        }
+      };
+
+      return {
+        model: await createModel(searchModel),
+        tools: getTools(searchModel),
+        providerOptions: getProviderOptions(searchModel),
+      };
+    } else {
+      return {
+        model: await createModelProvider(searchModel),
+      };
+    }
+  }
+
   async function askQuestions() {
     const { question } = useTaskStore.getState();
     const { thinkingModel } = getModel();
     setStatus(t("research.common.thinking"));
     const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
+    const searchSettings = await generateSearchSettings(thinkingModel);
     const result = streamText({
-      model: await createModelProvider(thinkingModel),
+      ...searchSettings,
       system: getSystemPrompt(),
       prompt: [
         generateQuestionsPrompt(question),
@@ -100,8 +172,9 @@ function useDeepResearch() {
     const { thinkingModel } = getModel();
     setStatus(t("research.common.thinking"));
     const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
+    const searchSettings = await generateSearchSettings(thinkingModel);
     const result = streamText({
-      model: await createModelProvider(thinkingModel),
+      ...searchSettings,
       system: getSystemPrompt(),
       prompt: [writeReportPlanPrompt(query), getResponseLanguagePrompt()].join(
         "\n\n"
@@ -181,11 +254,9 @@ function useDeepResearch() {
 
   async function runSearchTask(queries: SearchTask[]) {
     const {
-      provider,
       enableSearch,
       searchProvider,
       parallelSearch,
-      searchMaxResult,
       references,
       onlyUseLocalResource,
     } = useSettingStore.getState();
@@ -194,67 +265,6 @@ function useDeepResearch() {
     setStatus(t("research.common.research"));
     const plimit = Plimit(parallelSearch);
     const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
-    const createModel = (model: string) => {
-      // Enable Gemini's built-in search tool
-      if (
-        enableSearch &&
-        searchProvider === "model" &&
-        provider === "google" &&
-        isNetworkingModel(model)
-      ) {
-        return createModelProvider(model, { useSearchGrounding: true });
-      } else {
-        return createModelProvider(model);
-      }
-    };
-    const getTools = (model: string) => {
-      // Enable OpenAI's built-in search tool
-      if (enableSearch && searchProvider === "model") {
-        if (
-          ["openai", "azure"].includes(provider) &&
-          model.startsWith("gpt-4o")
-        ) {
-          return {
-            web_search_preview: openai.tools.webSearchPreview({
-              // optional configuration:
-              searchContextSize: "medium",
-            }),
-          } as Tools;
-        }
-      }
-      return undefined;
-    };
-    const getProviderOptions = (model: string) => {
-      if (enableSearch && searchProvider === "model") {
-        // Enable OpenRouter's buil
```

**File**: `src/utils/deep-research/index.ts` (modified, +2/-2)
```diff
@@ -95,7 +95,7 @@ class DeepResearch {
       provider: AIProvider.provider,
       model: AIProvider.taskModel,
       settings:
-        AIProvider.provider === "google" &&
+        ["google", "google-vertex"].includes(AIProvider.provider) &&
         isNetworkingModel(AIProvider.taskModel)
           ? { useSearchGrounding: true }
           : undefined,
@@ -210,7 +210,7 @@ class DeepResearch {
           // Enable OpenAI's built-in search tool
           if (
             provider === "model" &&
-            ["openai", "azure"].includes(taskModel) &&
+            ["openai", "azure", "openaicompatible"].includes(taskModel) &&
             taskModel.startsWith("gpt-4o")
           ) {
             const { openai } = await import("@ai-sdk/openai");
```

---

### Incident Patch 12: `9536ab27` (2025-07-18)
**Commit Message**: build: Fixed node version number

**File**: `.node-version` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+23.11.1
\ No newline at end of file
```

---

### Incident Patch 13: `4ce72c0b` (2025-07-04)
**Commit Message**: fix: Fixed the local resource judgment logic

**File**: `src/hooks/useDeepResearch.ts` (modified, +1/-1)
```diff
@@ -275,7 +275,7 @@ function useDeepResearch() {
               resources.map((item) => `- ${item.name}`).join("\n"),
             ].join("\n\n");
 
-            if (onlyUseLocalResource) {
+            if (onlyUseLocalResource === "enable") {
               taskStore.updateTask(item.query, {
                 state: "completed",
                 learning: content,
```

---

### Incident Patch 14: `cc67a59b` (2025-07-04)
**Commit Message**: fix: Adjusted to disable local-only resources by default

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.9.17",
+  "version": "0.9.18",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/hooks/useDeepResearch.ts` (modified, +2/-2)
```diff
@@ -273,8 +273,6 @@ function useDeepResearch() {
               knowledges,
               `### ${t("research.searchResult.references")}`,
               resources.map((item) => `- ${item.name}`).join("\n"),
-              "---",
-              "",
             ].join("\n\n");
 
             if (onlyUseLocalResource) {
@@ -285,6 +283,8 @@ function useDeepResearch() {
                 images,
               });
               return content;
+            } else {
+              content += "\n\n---\n\n";
             }
           }
 
```

**File**: `src/store/setting.ts` (modified, +1/-1)
```diff
@@ -149,7 +149,7 @@ export const defaultValues: SettingStore = {
   references: "enable",
   citationImage: "enable",
   smoothTextStreamType: "word",
-  onlyUseLocalResource: "enable",
+  onlyUseLocalResource: "disable",
 };
 
 export const useSettingStore = create(
```

---

### Incident Patch 15: `cd258f59` (2025-06-21)
**Commit Message**: fix: Fixed the issue where the system language setting could not take effect

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "deep-research",
   "description": "Use any LLMs (Large Language Models) for Deep Research. Support SSE API and MCP server.",
-  "version": "0.9.14",
+  "version": "0.9.15",
   "license": "MIT",
   "repository": {
     "url": "https://github.com/u14app/deep-research"
```

**File**: `src/components/Provider/I18n.tsx` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ function I18Provider({ children }: { children: React.ReactNode }) {
 
   useLayoutEffect(() => {
     const settingStore = useSettingStore.getState();
-    if (language === "") {
+    if (settingStore.language === "") {
       const browserLang = detectLanguage();
       settingStore.update({ language: browserLang });
       i18n.changeLanguage(browserLang);
```

#### Recent Merged Pull Requests:
- **PR #164** (2026-06-15): feat: add fastCRW (Firecrawl-compatible) search provider (@us)
- **PR #162** (2026-04-22): ci: add GitHub Actions workflow for linting on PRs and manual trigger (@druppelt)
- **PR #161** (2026-04-22): fix: handle empty request body for searxng (@druppelt)
- **PR #155** (closed): Add Codex plugin quality gate CI (@internet-dot)
- **PR #151** (2026-02-10): Dev jdb (@jamesbmour)
- **PR #149** (2025-12-29): Add MCP tool annotations for better AI understanding (@bryankthompson)
- **PR #148** (closed): refactor: migrate storage from localStorage to IndexedDB (@ITOTI-Y)
- **PR #147** (closed): Claude/review docker build 011 c uv8bi b quu7 ce ljw my ehv (@awaragml00029-debug)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
