# Forensic Learning Record (Deep Inspection): SciPhi-AI/R2R

> **Canonical Artifact**: `07_PROJECT_LEARNING/sciphi-ai-r2r-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SciPhi-AI/R2R](https://github.com/SciPhi-AI/R2R))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:47:19.094Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SciPhi-AI/R2R`
- **Description**: SoTA production-ready AI retrieval system. Agentic Retrieval-Augmented Generation (RAG) with a RESTful API.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8009 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `js/sdk/src/utils/index.ts`
```
export * from "./typeTransformer";
export * from "./utils";

```

### Core Architecture Module: `js/sdk/src/utils/typeTransformer.ts`
```
/**
 * Utility type to convert string to camelCase
 */
type CamelCase<S extends string> = S extends `${infer P}_${infer Q}`
  ? `${P}${Capitalize<CamelCase<Q>>}`
  : S;

/**
 * Recursively transforms object keys to camelCase
 */
type CamelCaseKeys<T> = {
  [K in keyof T as K extends string ? CamelCase<K> : K]: T[K] extends Record<
    string,
    any
  >
    ? CamelCaseKeys<T[K]>
    : T[K] extends Array<any>
      ? Array<CamelCaseKeys<T[K][number]>>
      : T[K];
};

/**
 * Utility type to convert string to snake_case
 */
type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? T extends Uppercase<T>
    ? `${T extends Lowercase<T> ? "" : "_"}${Lowercase<T>}${SnakeCase<U>}`
    : `${T}${SnakeCase<U>}`
  : S;

/**
 * Recursively transforms object keys to snake_case
 */
type SnakeCaseKeys<T> = {
  [K in keyof T as K extends string ? SnakeCase<K> : K]: T[K] extends Record<
    string,
    any
  >
    ? SnakeCaseKeys<T[K]>
    : T[K] extends Array<any>
      ? Array<SnakeCaseKeys<T[K][number]>>
      : T[K];
};

const isObject = (value: unknown): value is Record<string | symbol, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof Map) &&
  !(value instanceof Set) &&
  !(value instanceof Error) &&
  !(value instanceof RegExp);

const isValidInput = (value: unknown): boolean =>
  value !== null && value !== undefined;

const convertToCamelCase = (str: string): string => {
  // Preserve leading underscores
  const matches = str.match(/^(_+)/);
  const leadingUnderscores = matches ? matches[1] : "";
  const withoutLeadingUnderscores = str.slice(leadingUnderscores.length);

  if (!withoutLeadingUnderscores) {
    return str;
  }

  // Split by underscore and capitalize
  const converted = withoutLeadingUnderscores
    .split("_")
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");

  return leadingUnderscores + converted;
};

const convertToSnakeCase = (str: string): string => {
  // Preserve leading underscores
  const matches = str.match(/^(_+)/);
  const leadingUnderscores = matches ? matches[1] : "";
  const withoutLeadingUnderscores = str.slice(leadingUnderscores.length);

  if (!withoutLeadingUnderscores) {
    return str;
  }

  // Handle acronyms and regular camelCase
  const withAcronyms = withoutLeadingUnderscores
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();

  return leadingUnderscores + withAcronyms;
};

export function ensureCamelCase<T>(input: T): CamelCaseKeys<T> {
  if (!isValidInput(input)) {
    return input as CamelCaseKeys<T>;
  }

  if (Array.isArray(input)) {
    return input.map((item) => ensureCamelCase(item)) as CamelCaseKeys<T>;
  }

  if (!isObject(input)) {
    return input as CamelCaseKeys<T>;
  }

  try {
    const result = {} as Record<string | symbol, unknown>;

    // Handle all properties including symbols
    const allKeys = [
      ...Object.getOwnPropertyNames(input),
      ...Object.getOwnPropertySymbols(input),
    ];

    for (const key of allKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)!;

      if (typeof key === "symbol") {
        Object.defineProperty(result, key, descriptor);
      } else {
        const newKey = convertToCamelCase(key.toString());
        const value = (input as any)[key];

        if (isObject(value)) {
          // Transform nested object and preserve its symbol properties
          const transformed = ensureCamelCase(value);
          result[newKey] = transformed;

          // Copy all symbol properties from the original nested object
          Object.getOwnPropertySymbols(value).forEach((symKey) => {
            const symDesc = Object.getOwnPropertyDescriptor(value, symKey)!;
            Object.defineProperty(transformed, symKey, symDesc);
          });
        } else if (Array.isArray(value)) {
          result[newKey] = value.map((item) => ensureCamelCase(item));
        } else {
          result[newKey] = value;
        }
      }
    }

    return result as CamelCaseKeys<T>;
  } catch (error) {
    throw new Error(
      `Failed to transform to camelCase: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export function ensureSnakeCase<T>(input: T): SnakeCaseKeys<T> {
  if (!isValidInput(input)) {
    return input as SnakeCaseKeys<T>;
  }

  if (Array.isArray(input)) {
    return input.map((item) => ensureSnakeCase(item)) as SnakeCaseKeys<T>;
  }

  if (!isObject(input)) {
    return input as SnakeCaseKeys<T>;
  }

  try {
    const result = {} as Record<string | symbol, unknown>;
    const descriptors = Object.getOwnPropertyDescriptors(input);

    for (const key of [
      ...Object.getOwnPropertyNames(input),
      ...Object.getOwnPropertySymbols(input),
    ]) {
      const desc = descriptors[key as any];
      const { value } = desc;

      if (typeof key === "symbol") {
        if (isObject(value)) {
          const transformed = ensureSnakeCase(value);
          Object.defineProperty(result, key, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: transformed,
          });
        } else {
          result[key] = value;
        }
      } else {
        const newKey = convertToSnakeCase(key.toString());
        if (isObject(value)) {
          const transformed = ensureSnakeCase(value) as Record<
            string | symbol,
            unknown
          >;
          result[newKey] = transformed;

          // Copy symbol properties
          Object.getOwnPropertySymbols(value).forEach((symKey) => {
            Object.defineProperty(transformed, symKey, {
              ...Object.getOwnPropertyDescriptor(value, symKey)!,
              value: value[symKey],
            });
          });
        } else if (Array.isArray(value)) {
          result[newKey] = value.map((item) => ensureSnakeCase(item));
        } else {
          result[newKey] = value;
        }
      }
    }

    return result as SnakeCaseKeys<T>;
  } catch (error) {
    throw new Error(
      `Failed to transform to snake_case: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

```

### Core Architecture Module: `js/sdk/src/utils/utils.ts`
```
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

```

### Core Architecture Module: `py/core/__init__.py`
```
import logging

# Keep '*' imports for enhanced development velocity
from .agent import *
from .base import *
from .main import *
from .parsers import *
from .providers import *

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Create a console handler and set the level to info
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)

# Create a formatter and set it for the handler
formatter = logging.Formatter(
    "%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)
ch.setFormatter(formatter)

# Add the handler to the logger
logger.addHandler(ch)

# Optional: Prevent propagation to the root logger
logger.propagate = False

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("LiteLLM").setLevel(logging.WARNING)

__all__ = [
    "ThinkingEvent",
    "ToolCallEvent",
    "ToolResultEvent",
    "CitationEvent",
    "Citation",
    "R2RAgent",
    "SearchResultsCollector",
    "R2RRAGAgent",
    "R2RXMLToolsRAGAgent",
    "R2RStreamingRAGAgent",
    "R2RXMLToolsStreamingRAGAgent",
    "AsyncSyncMeta",
    "syncable",
    "MessageType",
    "Document",
    "DocumentChunk",
    "DocumentResponse",
    "IngestionStatus",
    "GraphExtractionStatus",
    "GraphConstructionStatus",
    "DocumentType",
    "R2RDocumentProcessingError",
    "R2RException",
    "Entity",
    "GraphExtraction",
    "Relationship",
    "GenerationConfig",
    "LLMChatCompletion",
    "LLMChatCompletionChunk",
    "RAGCompletion",
    "Prompt",
    "AggregateSearchResult",
    "WebSearchResult",
    "GraphSearchResult",
    "ChunkSearchSettings",
    "GraphSearchSettings",
    "ChunkSearchResult",
    "WebPageSearchResult",
    "SearchSettings",
    "select_search_filters",
    "SearchMode",
    "HybridSearchSettings",
    "Token",
    "TokenData",
    "Vector",
    "VectorEntry",
    "VectorType",
    "IndexConfig",
    "Agent",
    "AgentConfig",
    "Conversation",
    "Message",
    "TokenResponse",
    "User",
    "AppConfig",
    "Provider",
    "ProviderConfig",
    "AuthConfig",
    "AuthProvider",
    "CryptoConfig",
    "CryptoProvider",
    "EmailConfig",
    "EmailProvider",
    "LimitSettings",
    "DatabaseConfig",
    "DatabaseProvider",
    "EmbeddingConfig",
    "EmbeddingProvider",
    "CompletionConfig",
    "CompletionProvider",
    "RecursiveCharacterTextSplitter",
    "TextSplitter",
    "generate_id",
    "validate_uuid",
    "yield_sse_event",
    "convert_nonserializable_objects",
    "num_tokens",
    "num_tokens_from_messages",
    "SearchResultsCollector",
    "R2RProviders",
    "R2RApp",
    "R2RBuilder",
    "R2RConfig",
    "R2RProviderFactory",
    "AuthService",
    "IngestionService",
    "MaintenanceService",
    "ManagementService",
    "RetrievalService",
    "GraphService",
    "AudioParser",
    "BMPParser",
    "DOCParser",
    "DOCXParser",
    "ImageParser",
    "ODTParser",
    "OCRPDFParser",
    "VLMPDFParser",
    "BasicPDFParser",
    "PDFParserUnstructured",
    "PPTParser",
    "PPTXParser",
    "RTFParser",
    "CSVParser",
    "CSVParserAdvanced",
    "EMLParser",
    "EPUBParser",
    "JSONParser",
    "MSGParser",
    "ORGParser",
    "P7SParser",
    "RSTParser",
    "TSVParser",
    "XLSParser",
    "XLSXParser",
    "XLSXParserAdvanced",
    "MDParser",
    "HTMLParser",
    "TextParser",
    "PythonParser",
    "JavaScriptParser",
    "TypeScriptParser",
    "CSSParser",
    "SupabaseAuthProvider",
    "R2RAuthProvider",
    "JwtAuthProvider",
    "ClerkAuthProvider",
    # Email
    # Crypto
    "BCryptCryptoProvider",
    "BcryptCryptoConfig",
    "NaClCryptoConfig",
    "NaClCryptoProvider",
    "PostgresDatabaseProvider",
    "LiteLLMEmbeddingProvider",
    "OpenAIEmbeddingProvider",
    "OllamaEmbeddingProvider",
    "OpenAICompletionProvider",
    "R2RCompletionProvider",
    "LiteLLMCompletionProvider",
    "UnstructuredIngestionProvider",
    "R2RIngestionProvider",
    "ChunkingStrategy",
]

```

### Core Architecture Module: `py/core/agent/__init__.py`
```
# FIXME: Once the agent is properly type annotated, remove the type: ignore comments
from .base import (  # type: ignore
    R2RAgent,
    R2RStreamingAgent,
    R2RXMLStreamingAgent,
)
from .rag import (  # type: ignore
    R2RRAGAgent,
    R2RStreamingRAGAgent,
    R2RXMLToolsRAGAgent,
    R2RXMLToolsStreamingRAGAgent,
)

# Import the concrete implementations
from .research import (
    R2RResearchAgent,
    R2RStreamingResearchAgent,
    R2RXMLToolsResearchAgent,
    R2RXMLToolsStreamingResearchAgent,
)

__all__ = [
    # Base
    "R2RAgent",
    "R2RStreamingAgent",
    "R2RXMLStreamingAgent",
    # RAG Agents
    "R2RRAGAgent",
    "R2RXMLToolsRAGAgent",
    "R2RStreamingRAGAgent",
    "R2RXMLToolsStreamingRAGAgent",
    "R2RResearchAgent",
    "R2RStreamingResearchAgent",
    "R2RXMLToolsResearchAgent",
    "R2RXMLToolsStreamingResearchAgent",
]

```

### Core Architecture Module: `py/core/agent/base.py`
```
import asyncio
import json
import logging
import re
from abc import ABCMeta
from typing import AsyncGenerator, Optional, Tuple

from core.base import AsyncSyncMeta, LLMChatCompletion, Message, syncable
from core.base.agent import Agent, Conversation
from core.utils import (
    CitationTracker,
    SearchResultsCollector,
    SSEFormatter,
    convert_nonserializable_objects,
    dump_obj,
    find_new_citation_spans,
)

logger = logging.getLogger()


class CombinedMeta(AsyncSyncMeta, ABCMeta):
    pass


def sync_wrapper(async_gen):
    loop = asyncio.get_event_loop()

    def wrapper():
        try:
            while True:
                try:
                    yield loop.run_until_complete(async_gen.__anext__())
                except StopAsyncIteration:
                    break
        finally:
            loop.run_until_complete(async_gen.aclose())

    return wrapper()


class R2RAgent(Agent, metaclass=CombinedMeta):
    def __init__(self, *args, **kwargs):
        self.search_results_collector = SearchResultsCollector()
        super().__init__(*args, **kwargs)
        self._reset()

    async def _generate_llm_summary(self, iterations_count: int) -> str:
        """
        Generate a summary of the conversation using the LLM when max iterations are exceeded.

        Args:
            iterations_count: The number of iterations that were completed

        Returns:
            A string containing the LLM-generated summary
        """
        try:
            # Get all messages in the conversation
            all_messages = await self.conversation.get_messages()

            # Create a prompt for the LLM to summarize
            summary_prompt = {
                "role": "user",
                "content": (
                    f"The conversation has reached the maximum limit of {iterations_count} iterations "
                    f"without completing the task. Please provide a concise summary of: "
                    f"1) The key information you've gathered that's relevant to the original query, "
                    f"2) What you've attempted so far and why it's incomplete, and "
                    f"3) A specific recommendation for how to proceed. "
                    f"Keep your summary brief (3-4 sentences total) and focused on the most valuable insights. If it is possible to answer the original user query, then do so now instead."
                    f"Start with '⚠️ **Maximum iterations exceeded**'"
                ),
            }

            # Create a new message list with just the conversation history and summary request
            summary_messages = all_messages + [summary_prompt]

            # Get a completion for the summary
            generation_config = self.get_generation_config(summary_prompt)
            response = await self.llm_provider.aget_completion(
                summary_messages,
                generation_config,
            )

            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating LLM summary: {str(e)}")
            # Fall back to basic summary if LLM generation fails
            return (
                "⚠️ **Maximum iterations exceeded**\n\n"
                "The agent reached the maximum iteration limit without completing the task. "
                "Consider breaking your request into smaller steps or refining your query."
            )

    def _reset(self):
        self._completed = False
        self.conversation = Conversation()

    @syncable
    async def arun(
        self,
        messages: list[Message],
        system_instruction: Optional[str] = None,
        *args,
        **kwargs,
    ) -> list[dict]:
        self._reset()
        await self._setup(system_instruction)

        if messages:
            for message in messages:
                await self.conversation.add_message(message)
        iterations_count = 0
        while (
            not self._completed
            and iterations_count < self.config.max_iterations
        ):
            iterations_count += 1
            messages_list = await self.conversation.get_messages()
            generation_config = self.get_generation_config(messages_list[-1])
            response = await self.llm_provider.aget_completion(
                messages_list,
                generation_config,
            )
            logger.debug(f"R2RAgent response: {response}")
            await self.process_llm_response(response, *args, **kwargs)

        if not self._completed:
            # Generate a summary of the conversation using the LLM
            summary = await self._generate_llm_summary(iterations_count)
            await self.conversation.add_message(
                Message(role="assistant", content=summary)
            )

        # Return final content
        all_messages: list[dict] = await self.conversation.get_messages()
        all_messages.reverse()

        output_messages = []
        for message_2 in all_messages:
            if (
                # message_2.get("content")
                message_2.get("content") != messages[-1].content
            ):
                output_messages.append(message_2)
            else:
                break
        output_messages.reverse()

        return output_messages

    async def process_llm_response(
        self, response: LLMChatCompletion, *args, **kwargs
    ) -> None:
        if not self._completed:
            message = response.choices[0].message
            finish_reason = response.choices[0].finish_reason

            if finish_reason == "stop":
                self._completed = True

            # Determine which provider we're using
            using_anthropic = (
                "anthropic" in self.rag_generation_config.model.lower()
            )

            # OPENAI HANDLING
            if not using_anthropic:
                if message.tool_calls:
                    assistant_msg = Message(
                        role="assistant",
                        content="",
                        tool_calls=[msg.dict() for msg in message.tool_calls],
                    )
                    await self.conversation.add_message(assistant_msg)

                    # If there are multiple tool_calls, call them sequentially here
                    for tool_call in message.tool_calls:
                        await self.handle_function_or_tool_call(
                            tool_call.function.name,
                            tool_call.function.arguments,
                            tool_id=tool_call.id,
                            *args,
                            **kwargs,
                        )
                else:
                    await self.conversation.add_message(
                        Message(role="assistant", content=message.content)
                    )
                    self._completed = True

            else:
                # First handle thinking blocks if present
                if (
                    hasattr(message, "structured_content")
                    and message.structured_content
                ):
                    # Check if structured_content contains any tool_use blocks
                    has_tool_use = any(
                        block.get("type") == "tool_use"
                        for block in message.structured_content
                    )

                    if not has_tool_use and message.tool_calls:
                        # If it has thinking but no tool_use, add a separate message with structured_content
                        assistant_msg = Message(
                            role="assistant",
                            structured_content=message.structured_content,  # Use structured_content field
                        )
                        await self.conversation.add_message(assistant_msg)

                        # Add explicit tool_use blocks in a separate message
                        tool_uses = []
                        for tool_call in message.tool_calls:
                            # Safely parse arguments if they're a string
                            try:
                                if isinstance(
                                    tool_call.function.arguments, str
                                ):
                                    input_args = json.loads(
                                        tool_call.function.arguments
                                    )
                                else:
                                    input_args = tool_call.function.arguments
                            except json.JSONDecodeError:
                                logger.error(
                                    f"Failed to parse tool arguments: {tool_call.function.arguments}"
                                )
                                input_args = {
                                    "_raw": tool_call.function.arguments
                                }

                            tool_uses.append(
                                {
                                    "type": "tool_use",
                                    "id": tool_call.id,
                                    "name": tool_call.function.name,
                                    "input": input_args,
                                }
                            )

                        # Add tool_use blocks as a separate assistant message with structured content
                        if tool_uses:
                            await self.conversation.add_message(
                                Message(
                                    role="assistant",
                                    structured_content=tool_uses,
                                    content="",
                                )
                            )
                    else:
                        # If it already has tool_use or no tool_calls, preserve original structure
                        assistant_msg = Message(
 
```

### Core Architecture Module: `py/core/agent/rag.py`
```
# type: ignore
import logging
from typing import Callable, Optional

from core.base import (
    format_search_results_for_llm,
)
from core.base.abstractions import (
    AggregateSearchResult,
    GenerationConfig,
    SearchSettings,
)
from core.base.agent.tools.registry import ToolRegistry
from core.base.providers import DatabaseProvider
from core.providers import (
    AnthropicCompletionProvider,
    LiteLLMCompletionProvider,
    OpenAICompletionProvider,
    R2RCompletionProvider,
)
from core.utils import (
    SearchResultsCollector,
    num_tokens,
)

from ..base.agent.agent import RAGAgentConfig

# Import the base classes from the refactored base file
from .base import (
    R2RAgent,
    R2RStreamingAgent,
    R2RXMLStreamingAgent,
    R2RXMLToolsAgent,
)

logger = logging.getLogger(__name__)


class RAGAgentMixin:
    """
    A Mixin for adding search_file_knowledge, web_search, and content tools
    to your R2R Agents. This allows your agent to:
      - call knowledge_search_method (semantic/hybrid search)
      - call content_method (fetch entire doc/chunk structures)
      - call an external web search API
    """

    def __init__(
        self,
        *args,
        search_settings: SearchSettings,
        knowledge_search_method: Callable,
        content_method: Callable,
        file_search_method: Callable,
        max_tool_context_length=10_000,
        max_context_window_tokens=512_000,
        tool_registry: Optional[ToolRegistry] = None,
        **kwargs,
    ):
        # Save references to the retrieval logic
        self.search_settings = search_settings
        self.knowledge_search_method = knowledge_search_method
        self.content_method = content_method
        self.file_search_method = file_search_method
        self.max_tool_context_length = max_tool_context_length
        self.max_context_window_tokens = max_context_window_tokens
        self.search_results_collector = SearchResultsCollector()
        self.tool_registry = tool_registry or ToolRegistry()

        super().__init__(*args, **kwargs)

    def _register_tools(self):
        """
        Register all requested tools from self.config.rag_tools using the ToolRegistry.
        """
        if not self.config.rag_tools:
            logger.warning(
                "No RAG tools requested. Skipping tool registration."
            )
            return

        # Make sure tool_registry exists
        if not hasattr(self, "tool_registry") or self.tool_registry is None:
            self.tool_registry = ToolRegistry()

        format_function = self.format_search_results_for_llm

        for tool_name in set(self.config.rag_tools):
            # Try to get the tools from the registry
            if tool_instance := self.tool_registry.create_tool_instance(
                tool_name, format_function, context=self
            ):
                logger.debug(
                    f"Successfully registered tool from registry: {tool_name}"
                )
                self._tools.append(tool_instance)
            else:
                logger.warning(f"Unknown tool requested: {tool_name}")

        logger.debug(f"Registered {len(self._tools)} RAG tools.")

    def format_search_results_for_llm(
        self, results: AggregateSearchResult
    ) -> str:
        context = format_search_results_for_llm(results)
        context_tokens = num_tokens(context) + 1
        frac_to_return = self.max_tool_context_length / (context_tokens)

        if frac_to_return > 1:
            return context
        else:
            return context[: int(frac_to_return * len(context))]


class R2RRAGAgent(RAGAgentMixin, R2RAgent):
    """
    Non-streaming RAG Agent that supports search_file_knowledge, content, web_search.
    """

    def __init__(
        self,
        database_provider: DatabaseProvider,
        llm_provider: (
            AnthropicCompletionProvider
            | LiteLLMCompletionProvider
            | OpenAICompletionProvider
            | R2RCompletionProvider
        ),
        config: RAGAgentConfig,
        search_settings: SearchSettings,
        rag_generation_config: GenerationConfig,
        knowledge_search_method: Callable,
        content_method: Callable,
        file_search_method: Callable,
        tool_registry: Optional[ToolRegistry] = None,
        max_tool_context_length: int = 20_000,
    ):
        # Initialize base R2RAgent
        R2RAgent.__init__(
            self,
            database_provider=database_provider,
            llm_provider=llm_provider,
            config=config,
            rag_generation_config=rag_generation_config,
        )
        self.tool_registry = tool_registry or ToolRegistry()
        # Initialize the RAGAgentMixin
        RAGAgentMixin.__init__(
            self,
            database_provider=database_provider,
            llm_provider=llm_provider,
            config=config,
            search_settings=search_settings,
            rag_generation_config=rag_generation_config,
            max_tool_context_length=max_tool_context_length,
            knowledge_search_method=knowledge_search_method,
            file_search_method=file_search_method,
            content_method=content_method,
            tool_registry=tool_registry,
        )

        self._register_tools()


class R2RXMLToolsRAGAgent(RAGAgentMixin, R2RXMLToolsAgent):
    """
    Non-streaming RAG Agent that supports search_file_knowledge, content, web_search.
    """

    def __init__(
        self,
        database_provider: DatabaseProvider,
        llm_provider: (
            AnthropicCompletionProvider
            | LiteLLMCompletionProvider
            | OpenAICompletionProvider
            | R2RCompletionProvider
        ),
        config: RAGAgentConfig,
        search_settings: SearchSettings,
        rag_generation_config: GenerationConfig,
        knowledge_search_method: Callable,
        content_method: Callable,
        file_search_method: Callable,
        tool_registry: Optional[ToolRegistry] = None,
        max_tool_context_length: int = 20_000,
    ):
        # Initialize base R2RAgent
        R2RXMLToolsAgent.__init__(
            self,
            database_provider=database_provider,
            llm_provider=llm_provider,
            config=config,
            rag_generation_config=rag_generation_config,
        )
        self.tool_registry = tool_registry or ToolRegistry()
        # Initialize the RAGAgentMixin
        RAGAgentMixin.__init__(
            self,
            database_provider=database_provider,
            llm_provider=llm_provider,
            config=config,
            search_settings=search_settings,
            rag_generation_config=rag_generation_config,
            max_tool_context_length=max_tool_context_length,
            knowledge_search_method=knowledge_search_method,
            file_search_method=file_search_method,
            content_method=content_method,
            tool_registry=tool_registry,
        )

        self._register_tools()


class R2RStreamingRAGAgent(RAGAgentMixin, R2RStreamingAgent):
    """
    Streaming-capable RAG Agent that supports search_file_knowledge, content, web_search,
    and emits citations as [abc1234] short IDs if the LLM includes them in brackets.
    """

    def __init__(
        self,
        database_provider: DatabaseProvider,
        llm_provider: (
            AnthropicCompletionProvider
            | LiteLLMCompletionProvider
            | OpenAICompletionProvider
            | R2RCompletionProvider
        ),
        config: RAGAgentConfig,
        search_settings: SearchSettings,
        rag_generation_config: GenerationConfig,
        knowledge_search_method: Callable,
        content_method: Callable,
        file_search_method: Callable,
        tool_registry: Optional[ToolRegistry] = None,
        max_tool_context_length: int = 10_000,
    ):
        # Force streaming on
        config.stream = True

        # Initialize base R2RStreamingAgent
        R2RStreamingAgent.__init__(
            self,
            database_provider=database_provider,
            llm_provider=llm_provider,
            config=config,
            rag_generation_config=rag_generation_config,
        )
        self.tool_registry = tool_registry or ToolRegistry()
        # Initialize the RAGAgentMixin
        RAGAgentMixin.__init__(
            self,
            database_provider=database_provider,
            llm_provider=llm_provider,
            config=config,
            search_settings=search_settings,
            rag_generation_config=rag_generation_config,
            max_tool_context_length=max_tool_context_length,
            knowledge_search_method=knowledge_search_method,
            content_method=content_method,
            file_search_method=file_search_method,
            tool_registry=tool_registry,
        )

        self._register_tools()


class R2RXMLToolsStreamingRAGAgent(RAGAgentMixin, R2RXMLStreamingAgent):
    """
    A streaming agent that:
     - treats <think> or <Thought> blocks as chain-of-thought
       and emits them incrementally as SSE "thinking" events.
     - accumulates user-visible text outside those tags as SSE "message" events.
     - filters out all XML tags related to tool calls and actions.
     - upon finishing each iteration, it parses <Action><ToolCalls><ToolCall> blocks,
       calls the appropriate tool, and emits SSE "tool_call" / "tool_result".
     - properly emits citations when they appear in the text
    """

    def __init__(
        self,
        database_provider: DatabaseProvider,
        llm_provider: (
            AnthropicCompletionProvider
            | LiteLLMCompletionProvider
            | OpenAICompletionProvider
            | R2RCompletionProvider
        ),
        config: RAGAgentConfig,
        search_settings: SearchSettings,
        rag_generation_config: GenerationConfig,
        knowledge_search_method: Callable,
        content_method: Callable,
        file_search_method: Ca
```

### Core Architecture Module: `py/core/agent/research.py`
```
import logging
import os
import subprocess
import sys
import tempfile
from copy import copy
from typing import Any, Callable, Optional

from core.base import AppConfig
from core.base.abstractions import GenerationConfig, Message, SearchSettings
from core.base.providers import DatabaseProvider
from core.providers import (
    AnthropicCompletionProvider,
    LiteLLMCompletionProvider,
    OpenAICompletionProvider,
    R2RCompletionProvider,
)
from core.utils import extract_citations
from shared.abstractions.tool import Tool

from ..base.agent.agent import RAGAgentConfig  # type: ignore

# Import the RAG agents we'll leverage
from .rag import (  # type: ignore
    R2RRAGAgent,
    R2RStreamingRAGAgent,
    R2RXMLToolsRAGAgent,
    R2RXMLToolsStreamingRAGAgent,
    RAGAgentMixin,
)

logger = logging.getLogger(__name__)


class ResearchAgentMixin(RAGAgentMixin):
    """
    A mixin that extends RAGAgentMixin to add research capabilities to any R2R agent.

    This mixin provides all RAG capabilities plus additional research tools:
    - A RAG tool for knowledge retrieval (which leverages the underlying RAG capabilities)
    - A Python execution tool for code execution and computation
    - A reasoning tool for complex problem solving
    - A critique tool for analyzing conversation history
    """

    def __init__(
        self,
        *args,
        app_config: AppConfig,
        search_settings: SearchSettings,
        knowledge_search_method: Callable,
        content_method: Callable,
        file_search_method: Callable,
        max_tool_context_length=10_000,
        **kwargs,
    ):
        # Store the app configuration needed for research tools
        self.app_config = app_config

        # Call the parent RAGAgentMixin's __init__ with explicitly passed parameters
        super().__init__(
            *args,
            search_settings=search_settings,
            knowledge_search_method=knowledge_search_method,
            content_method=content_method,
            file_search_method=file_search_method,
            max_tool_context_length=max_tool_context_length,
            **kwargs,
        )

        # Register our research-specific tools
        self._register_research_tools()

    def _register_research_tools(self):
        """
        Register research-specific tools to the agent.
        This is called by the mixin's __init__ after the parent class initialization.
        """
        # Add our research tools to whatever tools are already registered
        research_tools = []
        for tool_name in set(self.config.research_tools):
            if tool_name == "rag":
                research_tools.append(self.rag_tool())
            elif tool_name == "reasoning":
                research_tools.append(self.reasoning_tool())
            elif tool_name == "critique":
                research_tools.append(self.critique_tool())
            elif tool_name == "python_executor":
                research_tools.append(self.python_execution_tool())
            else:
                logger.warning(f"Unknown research tool: {tool_name}")
                raise ValueError(f"Unknown research tool: {tool_name}")

        logger.debug(f"Registered research tools: {research_tools}")
        self.tools = research_tools

    def rag_tool(self) -> Tool:
        """Tool that provides access to the RAG agent's search capabilities."""
        return Tool(
            name="rag",
            description=(
                "Search for information using RAG (Retrieval-Augmented Generation). "
                "This tool searches across relevant sources and returns comprehensive information. "
                "Use this tool when you need to find specific information on any topic. Be sure to pose your query as a comprehensive query."
            ),
            results_function=self._rag,
            llm_format_function=self._format_search_results,
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find information.",
                    }
                },
                "required": ["query"],
            },
            context=self,
        )

    def reasoning_tool(self) -> Tool:
        """Tool that provides access to a strong reasoning model."""
        return Tool(
            name="reasoning",
            description=(
                "A dedicated reasoning system that excels at solving complex problems through step-by-step analysis. "
                "This tool connects to a separate AI system optimized for deep analytical thinking.\n\n"
                "USAGE GUIDELINES:\n"
                "1. Formulate your request as a complete, standalone question to a reasoning expert.\n"
                "2. Clearly state the problem/question at the beginning.\n"
                "3. Provide all relevant context, data, and constraints.\n\n"
                "IMPORTANT: This system has no memory of previous interactions or context from your conversation.\n\n"
                "STRENGTHS: Mathematical reasoning, logical analysis, evaluating complex scenarios, "
                "solving multi-step problems, and identifying potential errors in reasoning."
            ),
            results_function=self._reason,
            llm_format_function=self._format_search_results,
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A complete, standalone question with all necessary context, appropriate for a dedicated reasoning system.",
                    }
                },
                "required": ["query"],
            },
        )

    def critique_tool(self) -> Tool:
        """Tool that provides critical analysis of the reasoning done so far in the conversation."""
        return Tool(
            name="critique",
            description=(
                "Analyzes the conversation history to identify potential flaws, biases, and alternative "
                "approaches to the reasoning presented so far.\n\n"
                "Use this tool to get a second opinion on your reasoning, find overlooked considerations, "
                "identify biases or fallacies, explore alternative hypotheses, and improve the robustness "
                "of your conclusions."
            ),
            results_function=self._critique,
            llm_format_function=self._format_search_results,
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A specific aspect of the reasoning you want critiqued, or leave empty for a general critique.",
                    },
                    "focus_areas": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional specific areas to focus the critique (e.g., ['logical fallacies', 'methodology'])",
                    },
                },
                "required": ["query"],
            },
        )

    def python_execution_tool(self) -> Tool:
        """Tool that provides Python code execution capabilities."""
        return Tool(
            name="python_executor",
            description=(
                "Executes Python code and returns the results, output, and any errors. "
                "Use this tool for complex calculations, statistical operations, or algorithmic implementations.\n\n"
                "The execution environment includes common libraries such as numpy, pandas, sympy, scipy, statsmodels, biopython, etc.\n\n"
                "USAGE:\n"
                "1. Send complete, executable Python code as a string.\n"
                "2. Use print statements for output you want to see.\n"
                "3. Assign to the 'result' variable for values you want to return.\n"
                "4. Do not use input() or plotting (matplotlib). Output is text-based."
            ),
            results_function=self._execute_python_with_process_timeout,
            llm_format_function=self._format_python_results,
            parameters={
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute.",
                    }
                },
                "required": ["code"],
            },
        )

    async def _rag(
        self,
        query: str,
        *args,
        **kwargs,
    ) -> dict[str, Any]:
        """Execute a search using an internal RAG agent."""
        # Create a copy of the current configuration for the RAG agent
        config_copy = copy(self.config)
        config_copy.max_iterations = 10  # Could be configurable

        # Always include critical web search tools
        default_tools = ["web_search", "web_scrape"]

        # Get the configured RAG tools from the original config
        configured_tools = set(self.config.rag_tools or default_tools)

        # Combine default tools with all configured tools, ensuring no duplicates
        config_copy.rag_tools = list(
            set(default_tools + list(configured_tools))
        )

        logger.debug(f"Using RAG tools: {config_copy.rag_tools}")

        # Create a generation config for the RAG agent
        generation_config = GenerationConfig(
            model=self.app_config.quality_llm,
            max_tokens_to_sample=16000,
        )

        # Create a new RAG agent - we'll use the non-streaming variant for consistent results
        rag_agent = R2RRAGAgent(
            database_provider=self.database_provider,
            llm_provider=self.llm_provider,
            config=config_copy,
            search_settings=self.se
```

### Core Architecture Module: `py/core/base/__init__.py`
```
from .abstractions import *
from .agent import *
from .api.models import *
from .parsers import *
from .providers import *
from .utils import *

__all__ = [
    "ThinkingEvent",
    "ToolCallEvent",
    "ToolResultEvent",
    "CitationEvent",
    "Citation",
    ## ABSTRACTIONS
    # Base abstractions
    "AsyncSyncMeta",
    "syncable",
    # Completion abstractions
    "MessageType",
    # Document abstractions
    "Document",
    "DocumentChunk",
    "DocumentResponse",
    "IngestionStatus",
    "GraphExtractionStatus",
    "GraphConstructionStatus",
    "DocumentType",
    # Exception abstractions
    "R2RDocumentProcessingError",
    "R2RException",
    # Graph abstractions
    "Entity",
    "GraphExtraction",
    "Relationship",
    "Community",
    "GraphCreationSettings",
    "GraphEnrichmentSettings",
    # LLM abstractions
    "GenerationConfig",
    "LLMChatCompletion",
    "LLMChatCompletionChunk",
    "RAGCompletion",
    # Prompt abstractions
    "Prompt",
    # Search abstractions
    "AggregateSearchResult",
    "WebSearchResult",
    "GraphSearchResult",
    "GraphSearchSettings",
    "ChunkSearchSettings",
    "ChunkSearchResult",
    "WebPageSearchResult",
    "SearchSettings",
    "select_search_filters",
    "SearchMode",
    "HybridSearchSettings",
    # User abstractions
    "Token",
    "TokenData",
    # Vector abstractions
    "Vector",
    "VectorEntry",
    "VectorType",
    "StorageResult",
    "IndexConfig",
    ## AGENT
    # Agent abstractions
    "Agent",
    "AgentConfig",
    "Conversation",
    "Message",
    ## API
    # Auth Responses
    "TokenResponse",
    "User",
    ## PARSERS
    # Base parser
    "AsyncParser",
    ## PROVIDERS
    # Base provider classes
    "AppConfig",
    "Provider",
    "ProviderConfig",
    # Auth provider
    "AuthConfig",
    "AuthProvider",
    # Crypto provider
    "CryptoConfig",
    "CryptoProvider",
    # Database providers
    "LimitSettings",
    "DatabaseConfig",
    "DatabaseProvider",
    "Handler",
    "PostgresConfigurationSettings",
    # Email provider
    "EmailConfig",
    "EmailProvider",
    # Embedding provider
    "EmbeddingConfig",
    "EmbeddingProvider",
    # File provider
    "FileConfig",
    "FileProvider",
    # Ingestion provider
    "IngestionConfig",
    "IngestionProvider",
    "ChunkingStrategy",
    # LLM provider
    "CompletionConfig",
    "CompletionProvider",
    ## UTILS
    "RecursiveCharacterTextSplitter",
    "TextSplitter",
    "format_search_results_for_llm",
    "validate_uuid",
    # ID generation
    "generate_id",
    "generate_document_id",
    "generate_extraction_id",
    "generate_default_user_collection_id",
    "generate_user_id",
    "yield_sse_event",
    "dump_collector",
    "dump_obj",
]

```

### Core Architecture Module: `py/core/base/abstractions/__init__.py`
```
from shared.abstractions.base import AsyncSyncMeta, R2RSerializable, syncable
from shared.abstractions.document import (
    ChunkEnrichmentSettings,
    Document,
    DocumentChunk,
    DocumentResponse,
    DocumentType,
    GraphConstructionStatus,
    GraphExtractionStatus,
    IngestionStatus,
    RawChunk,
    UnprocessedChunk,
    UpdateChunk,
)
from shared.abstractions.exception import (
    R2RDocumentProcessingError,
    R2RException,
)
from shared.abstractions.graph import (
    Community,
    Entity,
    Graph,
    GraphCommunitySettings,
    GraphCreationSettings,
    GraphEnrichmentSettings,
    GraphExtraction,
    Relationship,
    StoreType,
)
from shared.abstractions.llm import (
    GenerationConfig,
    LLMChatCompletion,
    LLMChatCompletionChunk,
    Message,
    MessageType,
    RAGCompletion,
)
from shared.abstractions.prompt import Prompt
from shared.abstractions.search import (
    AggregateSearchResult,
    ChunkSearchResult,
    ChunkSearchSettings,
    GraphCommunityResult,
    GraphEntityResult,
    GraphRelationshipResult,
    GraphSearchResult,
    GraphSearchResultType,
    GraphSearchSettings,
    HybridSearchSettings,
    SearchMode,
    SearchSettings,
    WebPageSearchResult,
    WebSearchResult,
    select_search_filters,
)
from shared.abstractions.user import Token, TokenData, User
from shared.abstractions.vector import (
    IndexArgsHNSW,
    IndexArgsIVFFlat,
    IndexConfig,
    IndexMeasure,
    IndexMethod,
    StorageResult,
    Vector,
    VectorEntry,
    VectorQuantizationSettings,
    VectorQuantizationType,
    VectorTableName,
    VectorType,
)

__all__ = [
    # Base abstractions
    "R2RSerializable",
    "AsyncSyncMeta",
    "syncable",
    # Completion abstractions
    "MessageType",
    # Document abstractions
    "Document",
    "DocumentChunk",
    "DocumentResponse",
    "DocumentType",
    "IngestionStatus",
    "GraphExtractionStatus",
    "GraphConstructionStatus",
    "RawChunk",
    "UnprocessedChunk",
    "UpdateChunk",
    # Exception abstractions
    "R2RDocumentProcessingError",
    "R2RException",
    # Graph abstractions
    "Entity",
    "Graph",
    "Community",
    "StoreType",
    "GraphExtraction",
    "Relationship",
    # Index abstractions
    "IndexConfig",
    # LLM abstractions
    "GenerationConfig",
    "LLMChatCompletion",
    "LLMChatCompletionChunk",
    "Message",
    "RAGCompletion",
    # Prompt abstractions
    "Prompt",
    # Search abstractions
    "WebSearchResult",
    "AggregateSearchResult",
    "GraphSearchResult",
    "GraphSearchResultType",
    "GraphEntityResult",
    "GraphRelationshipResult",
    "GraphCommunityResult",
    "GraphSearchSettings",
    "ChunkSearchSettings",
    "ChunkSearchResult",
    "WebPageSearchResult",
    "SearchSettings",
    "select_search_filters",
    "SearchMode",
    "HybridSearchSettings",
    # Graph abstractions
    "GraphCreationSettings",
    "GraphEnrichmentSettings",
    "GraphCommunitySettings",
    # User abstractions
    "Token",
    "TokenData",
    "User",
    # Vector abstractions
    "Vector",
    "VectorEntry",
    "VectorType",
    "IndexMeasure",
    "IndexMethod",
    "VectorTableName",
    "IndexArgsHNSW",
    "IndexArgsIVFFlat",
    "VectorQuantizationSettings",
    "VectorQuantizationType",
    "StorageResult",
    "ChunkEnrichmentSettings",
]

```

### Core Architecture Module: `py/core/base/agent/__init__.py`
```
# FIXME: Once the agent is properly type annotated, remove the type: ignore comments
from .agent import (  # type: ignore
    Agent,
    AgentConfig,
    Conversation,
)

__all__ = [
    # Agent abstractions
    "Agent",
    "AgentConfig",
    "Conversation",
]

```

### Core Architecture Module: `py/core/base/agent/agent.py`
```
# type: ignore
import asyncio
import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from json import JSONDecodeError
from typing import Any, AsyncGenerator, Optional, Type

from pydantic import BaseModel

from core.base.abstractions import (
    GenerationConfig,
    LLMChatCompletion,
    Message,
)
from core.base.providers import CompletionProvider, DatabaseProvider
from shared.abstractions.tool import Tool, ToolResult

logger = logging.getLogger()


class Conversation:
    def __init__(self):
        self.messages: list[Message] = []
        self._lock = asyncio.Lock()

    async def add_message(self, message):
        async with self._lock:
            self.messages.append(message)

    async def get_messages(self) -> list[dict[str, Any]]:
        async with self._lock:
            return [
                {**msg.model_dump(exclude_none=True), "role": str(msg.role)}
                for msg in self.messages
            ]


# TODO - Move agents to provider pattern
class AgentConfig(BaseModel):
    rag_rag_agent_static_prompt: str = "static_rag_agent"
    rag_agent_dynamic_prompt: str = "dynamic_reasoning_rag_agent_prompted"
    stream: bool = False
    include_tools: bool = True
    max_iterations: int = 10

    @classmethod
    def create(cls: Type["AgentConfig"], **kwargs: Any) -> "AgentConfig":
        base_args = cls.model_fields.keys()
        filtered_kwargs = {
            k: v if v != "None" else None
            for k, v in kwargs.items()
            if k in base_args
        }
        return cls(**filtered_kwargs)  # type: ignore


class Agent(ABC):
    def __init__(
        self,
        llm_provider: CompletionProvider,
        database_provider: DatabaseProvider,
        config: AgentConfig,
        rag_generation_config: GenerationConfig,
    ):
        self.llm_provider = llm_provider
        self.database_provider: DatabaseProvider = database_provider
        self.config = config
        self.conversation = Conversation()
        self._completed = False
        self._tools: list[Tool] = []
        self.tool_calls: list[dict] = []
        self.rag_generation_config = rag_generation_config
        # self._register_tools()

    @abstractmethod
    def _register_tools(self):
        pass

    async def _setup(
        self, system_instruction: Optional[str] = None, *args, **kwargs
    ):
        await self.conversation.add_message(
            Message(
                role="system",
                content=system_instruction
                or (
                    await self.database_provider.prompts_handler.get_cached_prompt(
                        self.config.rag_rag_agent_static_prompt,
                        inputs={
                            "date": str(datetime.now().strftime("%m/%d/%Y"))
                        },
                    )
                    + f"\n Note,you only have {self.config.max_iterations} iterations or tool calls to reach a conclusion before your operation terminates."
                ),
            )
        )

    @property
    def tools(self) -> list[Tool]:
        return self._tools

    @tools.setter
    def tools(self, tools: list[Tool]):
        self._tools = tools

    @abstractmethod
    async def arun(
        self,
        system_instruction: Optional[str] = None,
        messages: Optional[list[Message]] = None,
        *args,
        **kwargs,
    ) -> list[LLMChatCompletion] | AsyncGenerator[LLMChatCompletion, None]:
        pass

    @abstractmethod
    async def process_llm_response(
        self,
        response: Any,
        *args,
        **kwargs,
    ) -> None | AsyncGenerator[str, None]:
        pass

    async def execute_tool(self, tool_name: str, *args, **kwargs) -> str:
        if tool := next((t for t in self.tools if t.name == tool_name), None):
            return await tool.results_function(*args, **kwargs)
        else:
            return f"Error: Tool {tool_name} not found."

    def get_generation_config(
        self, last_message: dict, stream: bool = False
    ) -> GenerationConfig:
        if (
            last_message["role"] in ["tool", "function"]
            and last_message["content"] != ""
            and "ollama" in self.rag_generation_config.model
            or not self.config.include_tools
        ):
            return GenerationConfig(
                **self.rag_generation_config.model_dump(
                    exclude={"functions", "tools", "stream"}
                ),
                stream=stream,
            )

        return GenerationConfig(
            **self.rag_generation_config.model_dump(
                exclude={"functions", "tools", "stream"}
            ),
            # FIXME: Use tools instead of functions
            # TODO - Investigate why `tools` fails with OpenAI+LiteLLM
            tools=(
                [
                    {
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": tool.parameters,
                        },
                        "type": "function",
                        "name": tool.name,
                    }
                    for tool in self.tools
                ]
                if self.tools
                else None
            ),
            stream=stream,
        )

    async def handle_function_or_tool_call(
        self,
        function_name: str,
        function_arguments: str,
        tool_id: Optional[str] = None,
        save_messages: bool = True,
        *args,
        **kwargs,
    ) -> ToolResult:
        logger.debug(
            f"Calling function: {function_name}, args: {function_arguments}, tool_id: {tool_id}"
        )
        if tool := next(
            (t for t in self.tools if t.name == function_name), None
        ):
            try:
                function_args = json.loads(function_arguments)

            except JSONDecodeError as e:
                error_message = f"Calling the requested tool '{function_name}' with arguments {function_arguments} failed with `JSONDecodeError`."
                if save_messages:
                    await self.conversation.add_message(
                        Message(
                            role="tool" if tool_id else "function",
                            content=error_message,
                            name=function_name,
                            tool_call_id=tool_id,
                        )
                    )

            merged_kwargs = {**kwargs, **function_args}
            try:
                raw_result = await tool.execute(*args, **merged_kwargs)
                llm_formatted_result = tool.llm_format_function(raw_result)
            except Exception as e:
                raw_result = f"Calling the requested tool '{function_name}' with arguments {function_arguments} failed with an exception: {e}."
                logger.error(raw_result)
                llm_formatted_result = raw_result

            tool_result = ToolResult(
                raw_result=raw_result,
                llm_formatted_result=llm_formatted_result,
            )
            if tool.stream_function:
                tool_result.stream_result = tool.stream_function(raw_result)

            if save_messages:
                await self.conversation.add_message(
                    Message(
                        role="tool" if tool_id else "function",
                        content=str(tool_result.llm_formatted_result),
                        name=function_name,
                        tool_call_id=tool_id,
                    )
                )
                # HACK - to fix issues with claude thinking + tool use [https://github.com/anthropics/anthropic-cookbook/blob/main/extended_thinking/extended_thinking_with_tool_use.ipynb]
                logger.debug(
                    f"Extended thinking - Claude needs a particular message continuation which however breaks other models. Model in use : {self.rag_generation_config.model}"
                )
                is_anthropic = (
                    self.rag_generation_config.model
                    and "anthropic/" in self.rag_generation_config.model
                )
                if (
                    self.rag_generation_config.extended_thinking
                    and is_anthropic
                ):
                    await self.conversation.add_message(
                        Message(
                            role="user",
                            content="Continue...",
                        )
                    )

            self.tool_calls.append(
                {
                    "name": function_name,
                    "args": function_arguments,
                }
            )
        return tool_result


# TODO - Move agents to provider pattern
class RAGAgentConfig(AgentConfig):
    rag_rag_agent_static_prompt: str = "static_rag_agent"
    rag_agent_dynamic_prompt: str = "dynamic_reasoning_rag_agent_prompted"
    stream: bool = False
    include_tools: bool = True
    max_iterations: int = 10
    # tools: list[str] = [] # HACK - unused variable.

    # Default RAG tools
    rag_tools: list[str] = [
        "search_file_descriptions",
        "search_file_knowledge",
        "get_file_content",
        # Web search tools - disabled by default
        # "web_search",
        # "web_scrape",
        # "tavily_search",
        # "tavily_extract",
    ]

    # Default Research tools
    research_tools: list[str] = [
        "rag",
        "reasoning",
        # DISABLED by default
        "critique",
        "python_executor",
    ]

    @classmethod
    def create(cls: Type["AgentConfig"], **kwargs: Any) -> "AgentConfig":
        base_args = cls.model_fields.keys()
        filtered_kwargs = {
            k: v if v != "None" else None
            for k, v in kwargs.items()
            if k in base_args
        }
        filtered_kwargs["tools"] = kwargs.get("too
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #209** (2024-03-29): **Synthetic Query Generation Pipeline**
  *Symptoms*: 1. Revive the synthetic query generation pipeline 2. Add documentation around synthetic query generation (e.g. clearer example use)

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

### Incident Patch 1: `95affa55` (2025-11-07)
**Commit Message**: Fix multiple issues (limit inconsistency, invisible documents (#2260)

* fix multiple issues

* revert counter changes

* revert document list changes

**File**: `llms.txt` (modified, +2/-2)
```diff
@@ -4180,7 +4180,7 @@ Returns a paginated list of documents accessible to the authenticated user. Regu
 | :-------------------------- | :------- | :------ | :-------------------------------------------------------------------------- |
 | `ids`                       | `string` | No      | A comma-separated list of document IDs to retrieve.                         |
 | `offset`                    | `integer`| No      | Number of objects to skip. Defaults to `0`.                                 |
-| `limit`                     | `integer`| No      | Max number of objects to return, `1–100`. Defaults to `100`.               |
+| `limit`                     | `integer`| No      | Max number of objects to return, `1–1000`. Defaults to `100`.               |
 | `include_summary_embeddings`| `integer`| No      | Whether to include embeddings of each document summary (`1` for true, `0` for false). |
 
 **Successful Response:**
@@ -4434,7 +4434,7 @@ Retrieves the text chunks generated from a document during ingestion. Chunks rep
 | Parameter         | Type      | Required | Description                                       |
 | :---------------- | :-------- | :------ | :------------------------------------------------ |
 | `offset`          | `integer` | No      | Number of chunks to skip. Defaults to `0`.        |
-| `limit`           | `integer` | No      | Number of chunks to return (`1–100`). Defaults to `100`. |
+| `limit`           | `integer` | No      | Number of chunks to return (`1–1000`). Defaults to `100`. |
 | `include_vectors` | `boolean` | No      | Whether to include vector embeddings in the response (`true` or `false`). |
 
 **Successful Response:**
```

**File**: `py/core/main/api/v3/chunks_router.py` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@ async def list_chunks(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedChunksResponse:
```

**File**: `py/core/main/api/v3/collections_router.py` (modified, +4/-4)
```diff
@@ -336,7 +336,7 @@ async def list_collections(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             owner_only: bool = Query(
                 False,
@@ -359,7 +359,7 @@ async def list_collections(
             else:
                 requesting_user_id = [auth_user.id]
 
-            collection_uuids = [UUID(collection_id) for collection_id in ids]
+            collection_uuids = [UUID(collection_id) for collection_id in ids] if ids else None
 
             collections_overview_response = (
                 await self.services.management.collections_overview(
@@ -738,7 +738,7 @@ async def get_collection_documents(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedDocumentsResponse:
@@ -898,7 +898,7 @@ async def get_collection_users(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedUsersResponse:
```

**File**: `py/core/main/api/v3/documents_router.py` (modified, +15/-7)
```diff
@@ -532,14 +532,22 @@ async def create_document(
                 file_data["content_type"],
             )
 
-            await self.services.ingestion.ingest_file_ingress(
+            ingest_result = await self.services.ingestion.ingest_file_ingress(
                 file_data=workflow_input["file_data"],
                 user=auth_user,
                 document_id=workflow_input["document_id"],
                 size_in_bytes=workflow_input["size_in_bytes"],
                 metadata=workflow_input["metadata"],
                 version=workflow_input["version"],
             )
+            
+            # Update workflow input with the document's collection_ids
+            document_info = ingest_result["info"]
+            workflow_input["collection_ids"] = (
+                [str(cid) for cid in document_info.collection_ids]
+                if document_info.collection_ids
+                else None
+            )
 
             if run_with_orchestration:
                 try:
@@ -980,7 +988,7 @@ async def get_documents(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             include_summary_embeddings: bool = Query(
                 False,
@@ -1010,7 +1018,7 @@ async def get_documents(
                 requesting_user_id = [auth_user.id]
                 filter_collection_ids = auth_user.collection_ids
 
-            document_uuids = [UUID(document_id) for document_id in ids]
+            document_uuids = [UUID(document_id) for document_id in ids] if ids else None
             documents_overview_response = (
                 await self.services.management.documents_overview(
                     user_ids=requesting_user_id,
@@ -1176,7 +1184,7 @@ async def list_chunks(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             include_vectors: Optional[bool] = Query(
                 False,
@@ -1562,7 +1570,7 @@ async def get_document_collections(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedCollectionsResponse:
@@ -1890,7 +1898,7 @@ async def get_entities(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             include_embeddings: Optional[bool] = Query(
                 False,
@@ -2117,7 +2125,7 @@ async def get_relationships(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             entity_names: Optional[list[str]] = Query(
                 None,
```

**File**: `py/core/main/api/v3/users_router.py` (modified, +2/-2)
```diff
@@ -756,7 +756,7 @@ async def list_users(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedUsersResponse:
@@ -1040,7 +1040,7 @@ async def get_user_collections(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedCollectionsResponse:
```

**File**: `py/core/main/orchestration/hatchet/ingestion_workflow.py` (modified, +3/-7)
```diff
@@ -150,9 +150,7 @@ async def parse(self, context: Context) -> dict:
                     status=IngestionStatus.SUCCESS,
                 )
 
-                collection_ids = context.workflow_input()["request"].get(
-                    "collection_ids"
-                )
+                collection_ids = document_info.collection_ids
                 if not collection_ids:
                     # TODO: Move logic onto the `management service`
                     collection_id = generate_default_user_collection_id(
@@ -363,7 +361,7 @@ async def ingest(self, context: Context) -> dict:
                 DocumentChunk(
                     id=generate_extraction_id(document_id, i),
                     document_id=document_id,
-                    collection_ids=[],
+                    collection_ids=document_info.collection_ids,
                     owner_id=document_info.owner_id,
                     data=chunk.text,
                     metadata=parsed_data["metadata"],
@@ -429,9 +427,7 @@ async def finalize(self, context: Context) -> dict:
 
             try:
                 # TODO - Move logic onto the `management service`
-                collection_ids = context.workflow_input()["request"].get(
-                    "collection_ids"
-                )
+                collection_ids = document_info.collection_ids
                 if not collection_ids:
                     # TODO: Move logic onto the `management service`
                     collection_id = generate_default_user_collection_id(
```

**File**: `py/core/main/orchestration/simple/ingestion_workflow.py` (modified, +2/-2)
```diff
@@ -93,7 +93,7 @@ async def ingest_files(input_data):
                 document_info, status=IngestionStatus.SUCCESS
             )
 
-            collection_ids = parsed_data.get("collection_ids")
+            collection_ids = document_info.collection_ids
 
             try:
                 if not collection_ids:
@@ -255,7 +255,7 @@ async def ingest_chunks(input_data):
             )
             document_id = document_info.id
 
-            collection_ids = parsed_data.get("collection_ids") or []
+            collection_ids = document_info.collection_ids or []
             if isinstance(collection_ids, str):
                 collection_ids = [collection_ids]
             collection_ids = [UUID(id_str) for id_str in collection_ids]
```

**File**: `py/core/main/services/ingestion_service.py` (modified, +27/-2)
```diff
@@ -158,10 +158,15 @@ def create_document_info_from_file(
         metadata = metadata or {}
         metadata["version"] = version
 
+        collection_ids = metadata.get("collection_ids", [])
+        if not collection_ids and user.collection_ids:
+            # If no collection_ids provided, assign to user's first collection (default)
+            collection_ids = [user.collection_ids[0]]
+
         return DocumentResponse(
             id=document_id,
             owner_id=user.id,
-            collection_ids=metadata.get("collection_ids", []),
+            collection_ids=collection_ids,
             document_type=DocumentType[file_extension.upper()],
             title=(
                 metadata.get("title", file_name.split("/")[-1])
@@ -187,10 +192,15 @@ def _create_document_info_from_chunks(
         metadata = metadata or {}
         metadata["version"] = version
 
+        collection_ids = metadata.get("collection_ids", [])
+        if not collection_ids and user.collection_ids:
+            # If no collection_ids provided, assign to user's first collection (default)
+            collection_ids = [user.collection_ids[0]]
+
         return DocumentResponse(
             id=document_id,
             owner_id=user.id,
-            collection_ids=metadata.get("collection_ids", []),
+            collection_ids=collection_ids,
             document_type=DocumentType.TXT,
             title=metadata.get("title", f"Ingested Chunks - {document_id}"),
             metadata=metadata,
@@ -542,6 +552,21 @@ async def _update_document_status_in_db(
         self, document_info: DocumentResponse
     ):
         try:
+            # Check if document still exists before updating status
+            # This prevents recreating documents that were deleted during ingestion
+            existing_docs = await self.providers.database.documents_handler.get_documents_overview(
+                offset=0,
+                limit=1,
+                filter_document_ids=[document_info.id]
+            )
+            
+            if not existing_docs["results"]:
+                logger.warning(
+                    f"Document {document_info.id} no longer exists. "
+                    f"Skipping status update to {document_info.ingestion_status}."
+                )
+                return
+            
             await self.providers.database.documents_handler.upsert_documents_overview(
                 document_info
             )
```

---

### Incident Patch 2: `e7ada714` (2025-11-07)
**Commit Message**: Fix #2257 (#2259)

* Fix: Update collection_ids assignment in DocumentResponse creation

* Fix: Include collection_ids in document selection query

**File**: `py/core/providers/database/collections.py` (modified, +2/-1)
```diff
@@ -310,6 +310,7 @@ async def documents_in_collection(
         query = f"""
             SELECT d.id, d.owner_id, d.type, d.metadata, d.title, d.version,
                 d.size_in_bytes, d.ingestion_status, d.extraction_status, d.created_at, d.updated_at, d.summary,
+                d.collection_ids,
                 COUNT(*) OVER() AS total_entries
             FROM {self._get_table_name("documents")} d
             WHERE $1 = ANY(d.collection_ids)
@@ -326,7 +327,7 @@ async def documents_in_collection(
         documents = [
             DocumentResponse(
                 id=row["id"],
-                collection_ids=[collection_id],
+                collection_ids=row["collection_ids"],
                 owner_id=row["owner_id"],
                 document_type=DocumentType(row["type"]),
                 metadata=json.loads(row["metadata"]),
```

---

### Incident Patch 3: `b9319b75` (2025-08-17)
**Commit Message**: Fix invalid syntax in README.md (#2231)

**File**: `py/README.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ response = client.retrieval.rag(query="What is DeepSeek R1?")
 response = client.retrieval.agent(
   message={"role":"user", "content": "What does deepseek r1 imply? Think about market, societal implications, and more."},
   rag_generation_config={
-    "model"="anthropic/claude-3-7-sonnet-20250219",
+    "model": "anthropic/claude-3-7-sonnet-20250219",
     "extended_thinking": True,
     "thinking_budget": 4096,
     "temperature": 1,
```

---

### Incident Patch 4: `19150119` (2025-06-06)
**Commit Message**: Hotfix: Lint community K8s PR and bump package

**File**: `.pre-commit-config.yaml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ repos:
       - id: check-ast
         exclude: ^.venv/
       - id: check-yaml
-        exclude: ^.venv/
+        exclude: ^(.venv/|deployment/)
 
   - repo: local
     hooks:
```

**File**: `deployment/k8s/kustomizations/helm-values_hatchet.yaml` (modified, +1/-1)
```diff
@@ -215,4 +215,4 @@ rabbitmq:
       amqp: 5672
 
 caddy:
-  enabled: false
\ No newline at end of file
+  enabled: false
```

**File**: `deployment/k8s/kustomizations/helm-values_postgresql.yaml` (modified, +1/-1)
```diff
@@ -10,4 +10,4 @@ global:
   storageClass: csi-sc
   postgresql:
     auth:
-      database: hatchet
\ No newline at end of file
+      database: hatchet
```

**File**: `deployment/k8s/kustomizations/include/cm-hatchet.yaml` (modified, +1/-1)
```diff
@@ -17,4 +17,4 @@ data:
   HATCHET_ADMIN_INIT_ALLOW_OVERRIDE_APIKEY: "false"
   HATCHET_TENANT_ID: "707d0855-80ab-4e1f-a156-f1c4546cbf52"
   RABBITMQ_URL: "http://hatchet-rabbitmq"
-  RABBITMQ_MGMT_PORT: "15672"
\ No newline at end of file
+  RABBITMQ_MGMT_PORT: "15672"
```

**File**: `deployment/k8s/kustomizations/include/cm-hatchet_OLD.yaml` (modified, +1/-1)
```diff
@@ -37,4 +37,4 @@ data:
   #New
   HATCHET_CLIENT_TLS_STRATEGY: "none"
   HATCHET_CLIENT_GRPC_MAX_RECV_MESSAGE_LENGTH: "134217728"
-  HATCHET_CLIENT_GRPC_MAX_SEND_MESSAGE_LENGTH: "134217728"
\ No newline at end of file
+  HATCHET_CLIENT_GRPC_MAX_SEND_MESSAGE_LENGTH: "134217728"
```

**File**: `deployment/k8s/kustomizations/include/cm-init-scripts-hatchet.yaml` (modified, +5/-5)
```diff
@@ -86,7 +86,7 @@ data:
     set -e
 
     # Wait for required config files
-    MAX_WAIT=300  
+    MAX_WAIT=300
     WAIT_TIME=0
     CONFIG_FILES=("/hatchet/config/server.yaml" "/hatchet/config/database.yaml" "/hatchet_api_key/api_key.txt")
 
@@ -135,8 +135,8 @@ data:
           "${API_SERVER}/api/v1/namespaces/${NAMESPACE}/secrets/${SECRET_NAME}")
 
       if [[ "$response_code" == "200" ]]; then
-          [[ "$ALLOW_OVERRIDE" == "true" || "$ALLOW_OVERRIDE" == "1" ]] || { 
-              echo "ALLOW_OVERRIDE is false. Skipping update."; return; 
+          [[ "$ALLOW_OVERRIDE" == "true" || "$ALLOW_OVERRIDE" == "1" ]] || {
+              echo "ALLOW_OVERRIDE is false. Skipping update."; return;
           }
           echo "Updating existing secret: $SECRET_NAME"
           response=$(curl -s -X PUT --insecure --header "Authorization: Bearer ${TOKEN}" --header "Content-Type: application/json" \
@@ -150,7 +150,7 @@ data:
       echo "JSON:"
       echo "$response" | jq '.data |= with_entries(.value="[REDACTED]")'
     }
-  
+
     update_secret "$1" "$2" "$3"
     echo "Finished processing secret: $2 in folder: $1. ALLOW_OVERRIDE: $3"
     exit 0
@@ -259,4 +259,4 @@ data:
                 root /usr/share/nginx/html;
             }
         }
-    }
\ No newline at end of file
+    }
```

**File**: `deployment/k8s/kustomizations/include/cm-init-scripts-r2r.yaml` (modified, +1/-1)
```diff
@@ -111,4 +111,4 @@ data:
                 root /usr/share/nginx/html;
             }
         }
-    }
\ No newline at end of file
+    }
```

**File**: `deployment/k8s/kustomizations/include/cm-r2r.yaml` (modified, +1/-2)
```diff
@@ -39,7 +39,7 @@ data:
   LITELLM_PROXY_API_URL: "https://litellm.mywebsite.com/v1"
   HUGGINGFACE_API_BASE: "https://hf-tei.mywebsite.com"
 
-  
+
   AZURE_FOUNDRY_API_ENDPOINT: ""
   AZURE_API_BASE: ""
   AZURE_API_VERSION: ""
@@ -58,4 +58,3 @@ data:
   R2R_SENTRY_PROFILES_SAMPLE_RATE: ""
   GOOGLE_REDIRECT_URI: ""
   GITHUB_REDIRECT_URI: ""
-  
```

---

### Incident Patch 5: `b00bcbd2` (2025-05-30)
**Commit Message**: Fix incorrect project name (#2206)

**File**: `py/core/main/app_entry.py` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ async def create_r2r_app(
 config = R2RConfig.load(config_name=config_name, config_path=config_path)
 
 project_name = (
-    os.getenv("R2R_PROJECT_NAME") or config.app.project_name or "default"
+    os.getenv("R2R_PROJECT_NAME") or config.app.project_name or "r2r_default"
 )
 
 logging.info(
```

---

### Incident Patch 6: `5f043c2c` (2025-05-27)
**Commit Message**: Fix setting non-default project name (#2201)

**File**: `py/core/main/app.py` (modified, +6/-2)
```diff
@@ -10,7 +10,7 @@
 )
 from core.utils.sentry import init_sentry
 
-from .abstractions import R2RServices
+from .abstractions import R2RProviders, R2RServices
 from .api.v3.chunks_router import ChunksRouter
 from .api.v3.collections_router import CollectionsRouter
 from .api.v3.conversations_router import ConversationsRouter
@@ -33,6 +33,7 @@ def __init__(
             HatchetOrchestrationProvider | SimpleOrchestrationProvider
         ),
         services: R2RServices,
+        providers: R2RProviders,
         chunks_router: ChunksRouter,
         collections_router: CollectionsRouter,
         conversations_router: ConversationsRouter,
@@ -48,6 +49,7 @@ def __init__(
 
         self.config = config
         self.services = services
+        self.providers = providers
         self.chunks_router = chunks_router
         self.collections_router = collections_router
         self.conversations_router = conversations_router
@@ -97,6 +99,8 @@ async def openapi_spec():
 
     def _apply_middleware(self):
         origins = ["*", "http://localhost:3000", "http://localhost:7272"]
+        project_name = self.providers.database.project_name
+
         self.app.add_middleware(
             CORSMiddleware,
             allow_origins=origins,
@@ -107,7 +111,7 @@ def _apply_middleware(self):
 
         self.app.add_middleware(
             ProjectSchemaMiddleware,
-            default_schema="r2r_default",
+            default_schema=project_name,
         )
 
     async def serve(self, host: str = "0.0.0.0", port: int = 7272):
```

**File**: `py/core/main/app_entry.py` (modified, +11/-3)
```diff
@@ -11,6 +11,7 @@
 from core.base import R2RException
 from core.utils.logging_config import configure_logging
 
+from .app import R2RApp
 from .assembly import R2RBuilder, R2RConfig
 from .middleware.project_schema import ProjectSchemaMiddleware
 
@@ -50,7 +51,7 @@ async def lifespan(app: FastAPI):
 async def create_r2r_app(
     config_name: Optional[str] = "default",
     config_path: Optional[str] = None,
-):
+) -> R2RApp:
     config = R2RConfig.load(config_name=config_name, config_path=config_path)
 
     if (
@@ -74,6 +75,12 @@ async def create_r2r_app(
 host = os.getenv("R2R_HOST", os.getenv("HOST", "0.0.0.0"))
 port = int(os.getenv("R2R_PORT", "7272"))
 
+config = R2RConfig.load(config_name=config_name, config_path=config_path)
+
+project_name = (
+    os.getenv("R2R_PROJECT_NAME") or config.app.project_name or "default"
+)
+
 logging.info(
     f"Environment R2R_IMAGE: {os.getenv('R2R_IMAGE')}",
 )
@@ -84,7 +91,7 @@ async def create_r2r_app(
     f"Environment R2R_CONFIG_PATH: {'None' if config_path is None else config_path}"
 )
 logging.info(f"Environment R2R_PROJECT_NAME: {os.getenv('R2R_PROJECT_NAME')}")
-
+logging.info(f"Using project name: {project_name}")
 logging.info(
     f"Environment R2R_POSTGRES_HOST: {os.getenv('R2R_POSTGRES_HOST')}"
 )
@@ -125,7 +132,8 @@ async def r2r_exception_handler(request: Request, exc: R2RException):
     allow_headers=["*"],
 )
 
+
 app.add_middleware(
     ProjectSchemaMiddleware,
-    default_schema="r2r_default",
+    default_schema=project_name,
 )
```

**File**: `py/core/main/assembly/builder.py` (modified, +1/-0)
```diff
@@ -135,6 +135,7 @@ async def build(self, *args, **kwargs) -> R2RApp:
             config=self.config,
             orchestration_provider=providers.orchestration,
             services=services,
+            providers=providers,
             **routers,
         )
 
```

---

### Incident Patch 7: `c53e75b9` (2025-05-22)
**Commit Message**: Hotfix: Change example PDF



---

### Incident Patch 8: `6726c110` (2025-05-22)
**Commit Message**: Fix middleware for containers (#2197)

**File**: `py/core/main/app_entry.py` (modified, +6/-0)
```diff
@@ -12,6 +12,7 @@
 from core.utils.logging_config import configure_logging
 
 from .assembly import R2RBuilder, R2RConfig
+from .middleware.project_schema import ProjectSchemaMiddleware
 
 log_file = configure_logging()
 
@@ -123,3 +124,8 @@ async def r2r_exception_handler(request: Request, exc: R2RException):
     allow_methods=["*"],
     allow_headers=["*"],
 )
+
+app.add_middleware(
+    ProjectSchemaMiddleware,
+    default_schema="r2r_default",
+)
```

**File**: `py/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "r2r"
-version = "3.6.2"
+version = "3.6.3"
 description = "SciPhi R2R"
 readme = "README.md"
 license = {text = "MIT"}
```

---

### Incident Patch 9: `28870a65` (2025-05-21)
**Commit Message**: Fix community summary errors where openai returns non xml entity strings (#2196)

**File**: `py/core/main/services/graph_service.py` (modified, +3/-1)
```diff
@@ -813,7 +813,9 @@ async def _process_community_summary(
                         "No <community> XML found in LLM response"
                     )
 
-                xml_content = match.group(0)
+                xml_content = re.sub(
+                    r"&(?!amp;|quot;|apos;|lt;|gt;)", "&amp;", match.group(0)
+                ).strip()
                 root = ET.fromstring(xml_content)
 
                 # extract fields
```

---

### Incident Patch 10: `388fb3ae` (2025-05-20)
**Commit Message**: Update search_file_knowledge.py to fix filtering issue (#2192)

**File**: `py/core/base/agent/tools/built_in/search_file_knowledge.py` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ async def execute(self, query: str, *args, **kwargs):
             """
             results = await knowledge_search_method(
                 query=query,
-                settings=context.search_settings,
+                search_settings=context.search_settings,
             )
 
             # FIXME: This is slop
```

---

### Incident Patch 11: `9634c7d1` (2025-05-13)
**Commit Message**: fix(ollama): correct API base URL for Ollama integration (#2186)

Fixed issue #2177 where Ollama connections were failing with "All connection attempts failed" errors.
The problem was caused by an incorrect API base URL format in the full_ollama.toml configuration.

Changed:
- Removed the "/v1" suffix from the Ollama API base URL
- Updated from "http://localhost:11434/v1" to "http://host.docker.internal:11434"

This change aligns with LiteLLM's expected format for Ollama connections and resolves
the connection errors reported in the issue.

**File**: `py/core/configs/full_ollama.toml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ concurrent_request_limit = 1
   top_p = 1
   max_tokens_to_sample = 1_024
   stream = false
-  api_base = "http://localhost:11434/v1"
+  api_base = "http://host.docker.internal:11434"
 
 [ingestion]
 provider = "unstructured_local"
```

---

### Incident Patch 12: `e4b806b9` (2025-05-12)
**Commit Message**: Fix Firecrawl API call, web_page_search_results (#2180)

* Fix Firecrawl API call, web_page_search_results

* Clean up more cruft

* Bump pyproject

**File**: `py/core/agent/rag.py` (modified, +1/-3)
```diff
@@ -102,9 +102,7 @@ def _register_tools(self):
     def format_search_results_for_llm(
         self, results: AggregateSearchResult
     ) -> str:
-        context = format_search_results_for_llm(
-            results, self.search_results_collector
-        )
+        context = format_search_results_for_llm(results)
         context_tokens = num_tokens(context) + 1
         frac_to_return = self.max_tool_context_length / (context_tokens)
 
```

**File**: `py/core/base/agent/tools/built_in/web_scrape.py` (modified, +3/-4)
```diff
@@ -53,20 +53,19 @@ async def execute(self, url: str, *args, **kwargs):
         )
 
         context = self.context
-
         app = FirecrawlApp()
         logger.debug(f"[Firecrawl] Scraping URL={url}")
 
         response = await asyncio.get_event_loop().run_in_executor(
             None,  # Uses the default executor
             lambda: app.scrape_url(
                 url=url,
-                params={"formats": ["markdown"]},
+                formats=["markdown"],
             ),
         )
 
-        markdown_text = response.get("markdown", "")
-        metadata = response.get("metadata", {})
+        markdown_text = response.markdown or ""
+        metadata = response.metadata or {}
         page_title = metadata.get("title", "Untitled page")
 
         if len(markdown_text) > 100_000:
```

**File**: `py/core/base/agent/tools/built_in/web_search.py` (modified, +0/-1)
```diff
@@ -53,7 +53,6 @@ async def execute(self, query: str, *args, **kwargs):
             None, lambda: WebSearchResult.from_serper_results(raw_results)
         )
 
-        # FIXME: Need to understand why we would have had this referencing only web_response.organic_results
         result = AggregateSearchResult(
             web_search_results=[web_response],
         )
```

**File**: `py/core/main/api/v3/examples.py` (removed, +0/-1046)
```diff
@@ -1,1046 +0,0 @@
-import textwrap
-
-"""
-This file contains updated OpenAPI examples for the RetrievalRouterV3 class.
-These examples are designed to be included in the openapi_extra field for each route.
-"""
-
-# Updated examples for search_app endpoint
-search_app_examples = {
-    "x-codeSamples": [
-        {
-            "lang": "Python",
-            "source": textwrap.dedent(
-                """
-                from r2r import R2RClient
-
-                client = R2RClient()
-                # if using auth, do client.login(...)
-
-                # Basic search
-                response = client.retrieval.search(
-                    query="What is DeepSeek R1?",
-                )
-
-                # Advanced mode with specific filters
-                response = client.retrieval.search(
-                    query="What is DeepSeek R1?",
-                    search_mode="advanced",
-                    search_settings={
-                        "filters": {"document_id": {"$eq": "e43864f5-a36f-548e-aacd-6f8d48b30c7f"}},
-                        "limit": 5
-                    }
-                )
-
-                # Using hybrid search
-                response = client.retrieval.search(
-                    query="What was Uber's profit in 2020?",
-                    search_settings={
-                        "use_hybrid_search": True,
-                        "hybrid_settings": {
-                            "full_text_weight": 1.0,
-                            "semantic_weight": 5.0,
-                            "full_text_limit": 200,
-                            "rrf_k": 50
-                        },
-                        "filters": {"title": {"$in": ["DeepSeek_R1.pdf"]}},
-                    }
-                )
-
-                # Advanced filtering
-                results = client.retrieval.search(
-                    query="What are the effects of climate change?",
-                    search_settings={
-                        "filters": {
-                            "$and":[
-                                {"document_type": {"$eq": "pdf"}},
-                                {"metadata.year": {"$gt": 2020}}
-                            ]
-                        },
-                        "limit": 10
-                    }
-                )
-
-                # Knowledge graph enhanced search
-                results = client.retrieval.search(
-                    query="What was DeepSeek R1",
-                )
-                """
-            ),
-        },
-        {
-            "lang": "JavaScript",
-            "source": textwrap.dedent(
-                """
-                const { r2rClient } = require("r2r-js");
-
-                const client = new r2rClient();
-                // if using auth, do client.login(...)
-
-                // Basic search
-                const response = await client.retrieval.search({
-                    query: "What is DeepSeek R1?",
-                });
-
-                // With specific filters
-                const filteredResponse = await client.retrieval.search({
-                    query: "What is DeepSeek R1?",
-                    searchSettings: {
-                        filters: {"document_id": {"$eq": "e43864f5-a36f-548e-aacd-6f8d48b30c7f"}},
-                        limit: 5
-                    }
-                });
-
-                // Using hybrid search
-                const hybridResponse = await client.retrieval.search({
-                    query: "What was Uber's profit in 2020?",
-                    searchSettings: {
-                        indexMeasure: "l2_distance",
-                        useHybridSearch: true,
-                        hybridSettings: {
-                            fulltextWeight: 1.0,
-                            semanticWeight: 5.0,
-                            fulltextLimit: 200,
-                        },
-                        filters: {"title": {"$in": ["DeepSeek_R1.pdf"]}},
-                    }
-                });
-
-                // Advanced filtering
-                const advancedResults = await client.retrieval.search({
-                    query: "What are the effects of climate change?",
-                    searchSettings: {
-                        filters: {
-                            $and: [
-                                {document_type: {$eq: "pdf"}},
-                                {"metadata.year": {$gt: 2020}}
-                            ]
-                        },
-                        limit: 10
-                    }
-                });
-
-                // Knowledge graph enhanced search
-                const kgResults = await client.retrieval.search({
-                    query: "who was aristotle?"
-                });
-                """
-            ),
-        },
-        {
-            "lang": "Shell",
-            "source": textwrap.dedent(
-                """
-                # Basic search
-                curl -X POS
```

**File**: `py/core/main/api/v3/retrieval_router.py` (modified, +348/-9)
```diff
@@ -1,4 +1,5 @@
 import logging
+import textwrap
 from typing import Any, Literal, Optional
 from uuid import UUID
 
@@ -25,7 +26,6 @@
 from ...abstractions import R2RProviders, R2RServices
 from ...config import R2RConfig
 from .base_router import BaseRouterV3
-from .examples import EXAMPLES
 
 logger = logging.getLogger(__name__)
 
@@ -88,7 +88,54 @@ def _setup_routes(self):
             "/retrieval/search",
             dependencies=[Depends(self.rate_limit_dependency)],
             summary="Search R2R",
-            openapi_extra=EXAMPLES["search"],
+            openapi_extra={
+                "x-codeSamples": [
+                    {
+                        "lang": "Python",
+                        "source": textwrap.dedent(
+                            """
+                            from r2r import R2RClient
+
+                            client = R2RClient()
+                            # if using auth, do client.login(...)
+
+                            response = client.retrieval.search(
+                                query="What is DeepSeek R1?",
+                            )
+                            """
+                        ),
+                    },
+                    {
+                        "lang": "JavaScript",
+                        "source": textwrap.dedent(
+                            """
+                            const { r2rClient } = require("r2r-js");
+
+                            const client = new r2rClient();
+                            // if using auth, do client.login(...)
+
+                            const response = await client.retrieval.search({
+                                query: "What is DeepSeek R1?",
+                            });
+                            """
+                        ),
+                    },
+                    {
+                        "lang": "Shell",
+                        "source": textwrap.dedent(
+                            """
+                            # Basic search
+                            curl -X POST "https://api.sciphi.ai/v3/retrieval/search" \\
+                                -H "Content-Type: application/json" \\
+                                -H "Authorization: Bearer YOUR_API_KEY" \\
+                                -d '{
+                                "query": "What is DeepSeek R1?"
+                            }'
+                            """
+                        ),
+                    },
+                ]
+            },
         )
         @self.base_endpoint
         async def search_app(
@@ -195,7 +242,56 @@ async def search_app(
             dependencies=[Depends(self.rate_limit_dependency)],
             summary="RAG Query",
             response_model=None,
-            openapi_extra=EXAMPLES["rag"],
+            openapi_extra={
+                "x-codeSamples": [
+                    {
+                        "lang": "Python",
+                        "source": textwrap.dedent(
+                            """
+                            from r2r import R2RClient
+
+                            client = R2RClient()
+                            # when using auth, do client.login(...)
+
+                            # Basic RAG request
+                            response = client.retrieval.rag(
+                                query="What is DeepSeek R1?",
+                            )
+                            """
+                        ),
+                    },
+                    {
+                        "lang": "JavaScript",
+                        "source": textwrap.dedent(
+                            """
+                            const { r2rClient } = require("r2r-js");
+
+                            const client = new r2rClient();
+                            // when using auth, do client.login(...)
+
+                            // Basic RAG request
+                            const response = await client.retrieval.rag({
+                                query: "What is DeepSeek R1?",
+                            });
+                            """
+                        ),
+                    },
+                    {
+                        "lang": "Shell",
+                        "source": textwrap.dedent(
+                            """
+                            # Basic RAG request
+                            curl -X POST "https://api.sciphi.ai/v3/retrieval/rag" \\
+                                -H "Content-Type: application/json" \\
+                                -H "Authorization: Bearer YOUR_API_KEY" \\
+                                -d '{
+                                "query": "What is DeepSeek R1?"
+                            }'
+                            """
+                        ),
+                    },
+                ]
+            },
         )
         @self.base_endpoint
         async def rag_app(
@@ -293,7 +389,7 @@ async def rag_app(
             ```
             """
 
-            if "model" 
```

**File**: `py/core/main/services/retrieval_service.py` (modified, +2/-4)
```diff
@@ -1025,9 +1025,7 @@ async def rag(
             # 3) Build context from aggregator
             collector = SearchResultsCollector()
             collector.add_aggregate_result(aggregated_results)
-            context_str = format_search_results_for_llm(
-                aggregated_results, collector
-            )
+            context_str = format_search_results_for_llm(aggregated_results)
 
             # 4) Prepare system+task messages
             system_prompt_name = system_prompt_name or "system"
@@ -1368,7 +1366,7 @@ async def agent(
                 effective_generation_config = research_generation_config
 
             # Set appropriate LLM model based on mode if not explicitly specified
-            if "model" not in effective_generation_config.__fields_set__:
+            if "model" not in effective_generation_config.model_fields_set:
                 if mode == "rag":
                     effective_generation_config.model = (
                         self.config.app.quality_llm
```

**File**: `py/core/utils/serper.py` (modified, +0/-24)
```diff
@@ -81,27 +81,3 @@ def get_raw(self, query: str, limit: int = 10) -> list:
         data = response.read()
         json_data = json.loads(data.decode("utf-8"))
         return SerperClient._extract_results(json_data)
-
-    @staticmethod
-    def construct_context(results: list) -> str:
-        # Organize results by type
-        organized_results = {}
-        for result in results:
-            result_type = result.metadata.pop(
-                "type", "Unknown"
-            )  # Pop the type and use as key
-            if result_type not in organized_results:
-                organized_results[result_type] = [result.metadata]
-            else:
-                organized_results[result_type].append(result.metadata)
-
-        context = ""
-        # Iterate over each result type
-        for result_type, items in organized_results.items():
-            context += f"# {result_type} Results:\n"
-            for index, item in enumerate(items, start=1):
-                # Process each item under the current type
-                context += f"Item {index}:\n"
-                context += process_json(item) + "\n"
-
-        return context
```

**File**: `py/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "r2r"
-version = "3.6.0"
+version = "3.6.1"
 description = "SciPhi R2R"
 readme = "README.md"
 license = {text = "MIT"}
```

---

### Incident Patch 13: `0e1741e9` (2025-05-08)
**Commit Message**: fix: update Supabase token retrieval to remove unnecessary await (#2166)

* fix: update Supabase token retrieval to remove unnecessary await

* fix: remove unnecessary await from Supabase authentication methods

**File**: `py/core/providers/auth/supabase.py` (modified, +8/-8)
```diff
@@ -74,7 +74,7 @@ async def decode_token(self, token: str) -> TokenData:
                 token = token[7:]
 
             # Get Supabase token information
-            auth_response = await self.supabase.auth.get_user(token)
+            auth_response = self.supabase.auth.get_user(token)
 
             if not auth_response or not auth_response.user:
                 raise R2RException(status_code=401, message="Invalid token")
@@ -147,7 +147,7 @@ async def verify_email(
     async def login(self, email: str, password: str) -> dict[str, Token]:
         # Use Supabase client to authenticate user and get tokens
         try:
-            response = await self.supabase.auth.sign_in_with_password(
+            response = self.supabase.auth.sign_in_with_password(
                 {"email": email, "password": password}
             )
             # Correct access method - token information is found in response.session
@@ -177,7 +177,7 @@ async def refresh_access_token(
     ) -> dict[str, Token]:
         # Use Supabase client to refresh access token
         try:
-            response = await self.supabase.auth.refresh_session(refresh_token)
+            response = self.supabase.auth.refresh_session(refresh_token)
             if response.session:
                 new_access_token = response.session.access_token
                 new_refresh_token = response.session.refresh_token
@@ -202,7 +202,7 @@ async def refresh_access_token(
     async def user(self, token: str = Depends(oauth2_scheme)) -> User:
         # Use Supabase client to get user details from token
         try:
-            auth_response = await self.supabase.auth.get_user(token)
+            auth_response = self.supabase.auth.get_user(token)
             if auth_response.user:
                 user_data = auth_response.user
                 return User(
@@ -236,11 +236,11 @@ async def change_password(
         # Use Supabase client to update user password
         try:
             # First, we log in with the current password to verify the user
-            await self.supabase.auth.sign_in_with_password(
+            self.supabase.auth.sign_in_with_password(
                 {"email": user.email, "password": current_password}
             )
             # Then we update the password
-            await self.supabase.auth.update_user({"password": new_password})
+            self.supabase.auth.update_user({"password": new_password})
             return {"message": "Password changed successfully"}
         except Exception as e:
             logger.error(f"Password change error: {str(e)}")
@@ -270,7 +270,7 @@ async def request_password_reset(self, email: str) -> dict[str, str]:
                 # Use the default URL
                 redirect_url = "https://app.sciphi.ai/auth/login"
             # Send the password reset email and use the custom redirect URL
-            await self.supabase.auth.reset_password_for_email(
+            self.supabase.auth.reset_password_for_email(
                 email, options={"redirect_to": redirect_url}
             )
             # Return a success message for security reasons
@@ -294,7 +294,7 @@ async def confirm_password_reset(
     async def logout(self, token: str) -> dict[str, str]:
         try:
             # Logout the user
-            await self.supabase.auth.sign_out()
+            self.supabase.auth.sign_out()
             return {"message": "Logged out successfully"}
         except Exception as e:
             logger.error(f"Logout error: {str(e)}")
```

---

### Incident Patch 14: `d2c99efa` (2025-05-05)
**Commit Message**: Hotfix: Bump Python version

**File**: `py/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "r2r"
-version = "3.5.18"
+version = "3.5.19"
 description = "SciPhi R2R"
 readme = "README.md"
 license = {text = "MIT"}
```

---

### Incident Patch 15: `d9f91b65` (2025-05-05)
**Commit Message**: No timeout by default, only for VLM PDF parsing for now (#2172)

* No timeout by default, only for VLM PDF parsing for now

* Rename to apply_timeout

**File**: `py/core/base/providers/llm.py` (modified, +23/-7)
```diff
@@ -53,21 +53,27 @@ def __init__(self, config: CompletionConfig) -> None:
             max_workers=config.concurrent_request_limit
         )
 
-    async def _execute_with_backoff_async(self, task: dict[str, Any]):
+    async def _execute_with_backoff_async(
+        self,
+        task: dict[str, Any],
+        apply_timeout: bool = False,
+    ):
         retries = 0
         backoff = self.config.initial_backoff
         while retries < self.config.max_retries:
             try:
                 # A semaphore allows us to limit concurrent requests
                 async with self.semaphore:
-                    # And we use asyncio.wait_for to set a timeout for the request
-                    try:
+                    if not apply_timeout:
+                        return await self._execute_task(task)
+
+                    try:  # Use asyncio.wait_for to set a timeout for the request
                         return await asyncio.wait_for(
                             self._execute_task(task),
                             timeout=self.config.request_timeout,
                         )
                     except asyncio.TimeoutError as e:
-                        raise Exception(
+                        raise TimeoutError(
                             f"Request timed out after {self.config.request_timeout} seconds"
                         ) from e
             except AuthenticationError:
@@ -105,15 +111,22 @@ async def _execute_with_backoff_async_stream(
                 await asyncio.sleep(random.uniform(0, backoff))
                 backoff = min(backoff * 2, self.config.max_backoff)
 
-    def _execute_with_backoff_sync(self, task: dict[str, Any]):
+    def _execute_with_backoff_sync(
+        self,
+        task: dict[str, Any],
+        apply_timeout: bool = False,
+    ):
         retries = 0
         backoff = self.config.initial_backoff
         while retries < self.config.max_retries:
+            if not apply_timeout:
+                return self._execute_task_sync(task)
+
             try:
                 future = self.thread_pool.submit(self._execute_task_sync, task)
                 return future.result(timeout=self.config.request_timeout)
             except TimeoutError as e:
-                raise Exception(
+                raise TimeoutError(
                     f"Request timed out after {self.config.request_timeout} seconds"
                 ) from e
             except Exception as e:
@@ -157,14 +170,17 @@ async def aget_completion(
         self,
         messages: list[dict],
         generation_config: GenerationConfig,
+        apply_timeout: bool = False,
         **kwargs,
     ) -> LLMChatCompletion:
         task = {
             "messages": messages,
             "generation_config": generation_config,
             "kwargs": kwargs,
         }
-        response = await self._execute_with_backoff_async(task)
+        response = await self._execute_with_backoff_async(
+            task=task, apply_timeout=apply_timeout
+        )
         return LLMChatCompletion(**response.dict())
 
     async def aget_completion_stream(
```

**File**: `py/core/parsers/media/pdf_parser.py` (modified, +4/-1)
```diff
@@ -155,6 +155,7 @@ async def process_page(self, image, page_num: int) -> dict[str, str]:
                 response = await self.llm_provider.aget_completion(
                     messages=messages,
                     generation_config=generation_config,
+                    apply_timeout=True,
                     tools=[
                         {
                             "name": "parse_pdf_page",
@@ -198,7 +199,9 @@ async def process_page(self, image, page_num: int) -> dict[str, str]:
                     return {"page": str(page_num), "content": ""}
             else:
                 response = await self.llm_provider.aget_completion(
-                    messages=messages, generation_config=generation_config
+                    messages=messages,
+                    generation_config=generation_config,
+                    apply_timeout=True,
                 )
 
                 if response.choices and response.choices[0].message:
```

#### Recent Merged Pull Requests:
- **PR #2310** (closed): Add llmman as a local model provider (@ericcurtin)
- **PR #2303** (closed): chunk prefix (@LeoHelfferich)
- **PR #2302** (closed): Fix typo in R2R (#2297) (@bglglzd)
- **PR #2283** (closed): Delete arm build (@lgcorzo)
- **PR #2282** (closed): R2r stream solve (@lgcorzo)
- **PR #2281** (closed): KAIG-996-html base64 fix (@nithingovindugari)
- **PR #2278** (closed): collection count fix (@nithingovindugari)
- **PR #2277** (closed): Claude/add gcloud mcp config 014 pubm8ibpx yr rhjstcph8 l (@evgenygurin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
