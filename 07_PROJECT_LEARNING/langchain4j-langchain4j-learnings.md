> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/langchain4j-langchain4j-learnings.md`  
> **Source**: github ([https://github.com/langchain4j/langchain4j](https://github.com/langchain4j/langchain4j))  
> **Source Version**: `28f8ba4a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T23:13:18.616Z  
> **Learning ID**: `learn-github-langchain4j-langchain4j`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): langchain4j/langchain4j

> **Canonical Artifact**: `07_PROJECT_LEARNING/langchain4j-langchain4j-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langchain4j/langchain4j](https://github.com/langchain4j/langchain4j))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-03T23:13:18.407Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langchain4j/langchain4j`
- **Description**: LangChain4j is an idiomatic, open-source Java library for building LLM-powered applications on the JVM. It offers a unified API over popular LLM providers and vector stores, and makes implementing tool calling (including MCP support), agents and RAG easy. It integrates seamlessly with enterprise Java frameworks like Quarkus and Spring Boot.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13350 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/data/document/DocumentLoaderExtensions.kt`
```
package dev.langchain4j.kotlin.data.document

import dev.langchain4j.data.document.Document
import dev.langchain4j.data.document.DocumentLoader
import dev.langchain4j.data.document.DocumentParser
import dev.langchain4j.data.document.DocumentSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.coroutines.CoroutineContext

/**
 * Asynchronously loads a document from the specified source using a given parser.
 *
 * @param source The [dev.langchain4j.data.document.DocumentSource] from which the document will be loaded.
 * @param parser The [dev.langchain4j.data.document.DocumentParser] to parse the loaded document.
 * @param context The [CoroutineContext] to use for asynchronous execution,
 *                  defaults to `Dispatchers.IO`.
 * @return The loaded and parsed Document.
 */
public suspend fun loadAsync(
    source: DocumentSource,
    parser: DocumentParser,
    context: CoroutineContext = Dispatchers.IO
): Document =
    withContext(context) {
        DocumentLoader.load(source, parser)
    }

```

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/data/document/DocumentParserExtensions.kt`
```
package dev.langchain4j.kotlin.data.document

import dev.langchain4j.data.document.Document
import dev.langchain4j.data.document.DocumentParser
import dev.langchain4j.data.document.DocumentSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream
import kotlin.coroutines.CoroutineContext

/**
 * Asynchronously parses a document from the specified document source
 * using the given coroutine context.
 *
 * @param source The [dev.langchain4j.data.document.DocumentSource] from which the document will be parsed.
 * @param context The [CoroutineContext] to use for asynchronous execution,
 * defaults to [Dispatchers.IO].
 * @return The parsed [dev.langchain4j.data.document.Document],
 * potentially with merged metadata from the document source.
 */
public suspend fun DocumentParser.parseAsync(
    source: DocumentSource,
    context: CoroutineContext = Dispatchers.IO
): Document {
    val document =
        source.inputStream().use { inputStream ->
            return@use parseAsync(inputStream, context)
        }
    val documentSourceMetadata = source.metadata()
    return if (documentSourceMetadata.toMap().isNotEmpty()) {
        Document.from(document.text(), documentSourceMetadata.merge(document.metadata()))
    } else {
        document
    }
}

/**
 * Asynchronously parses a document from the provided input stream using the specified dispatcher.
 *
 * @param input The [InputStream] from which the document will be parsed.
 * @param context The CoroutineContext to use for asynchronous execution,
 *                  defaults to `[Dispatchers.IO]`.
 * @return The parsed Document.
 */
public suspend fun DocumentParser.parseAsync(
    input: InputStream,
    context: CoroutineContext = Dispatchers.IO
): Document =
    withContext(context) {
        parse(input)
    }

```

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/data/document/loader/FileSystemDocumentLoaderExtensions.kt`
```
package dev.langchain4j.kotlin.data.document.loader

import dev.langchain4j.data.document.BlankDocumentException
import dev.langchain4j.data.document.Document
import dev.langchain4j.data.document.DocumentParser
import dev.langchain4j.data.document.loader.FileSystemDocumentLoader
import dev.langchain4j.kotlin.data.document.parseAsync
import dev.langchain4j.data.document.source.FileSystemSource
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import org.slf4j.LoggerFactory
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.PathMatcher
import kotlin.coroutines.CoroutineContext
import kotlin.io.path.exists
import kotlin.io.path.isDirectory

private val logger = LoggerFactory.getLogger(FileSystemDocumentLoader::class.java)

/**
 * Asynchronously loads documents from the specified directories.
 *
 * All matching files are read in parallel. Files that cannot be parsed are skipped rather than
 * failing the whole call: a file that turns out to be blank is skipped silently, and any other
 * parsing failure is logged as a warning together with its exception. Once loading has finished,
 * a summary is logged if anything was skipped. This means the returned list may contain fewer
 * documents than there are files in the directories, and may be empty if none of them could be
 * parsed. Inspect the returned list if your application needs to react to that.
 *
 * @param directoryPaths A list of directories from which documents should be loaded.
 * @param documentParser The parser to convert files into [Document] objects.
 * @param recursive Determines whether subdirectories should also be searched for documents. Defaults to `false`.
 * @param pathMatcher An optional filter to match file paths against specific patterns.
 * @param context The CoroutineContext to be used for asynchronous operations. Defaults to [Dispatchers.IO].
 * @return A list of Document objects representing the successfully loaded documents.
 */
public suspend fun loadDocuments(
    directoryPaths: List<Path>,
    documentParser: DocumentParser,
    recursive: Boolean = false,
    pathMatcher: PathMatcher? = null,
    context: CoroutineContext = Dispatchers.IO
): List<Document> =
    coroutineScope {
        // Validate all paths before processing
        directoryPaths.forEach { path ->
            require(path.exists()) { "Path doesn't exist: $path" }
            require(path.isDirectory()) { "Path is not a directory: $path" }
        }
        // Collect all files from the directory paths matching the pathMatcher
        val matchedFiles =
            directoryPaths.flatMap { path ->
                val files = mutableListOf<Path>()
                // Matches all if no pathMatcher is provided
                val matcher: PathMatcher = pathMatcher ?: PathMatcher { true }

                // Traverse directories conditionally based on the recursive flag
                val fileStream = if (recursive) Files.walk(path) else Files.walk(path, 1)

                fileStream.use { stream ->
                    stream
                        .filter { file ->
                            Files.isRegularFile(file) && matcher.matches(file)
                        }.forEach { file ->
                            files.add(file)
                        }
                }
                files
            }

        // Process each file in parallel
        val documents =
            matchedFiles
                .map { file ->
                    async(context) {
                        @Suppress("TooGenericExceptionCaught")
                        try {
                            documentParser.parseAsync(FileSystemSource(file), context)
                        } catch (e: CancellationException) {
                            // Not a parse failure: rethrow so that cancelling the caller
                            // (e.g. withTimeout) still cancels the whole load.
                            throw e
                        } catch (ignored: BlankDocumentException) {
                            // Blank files are expected, so they are skipped without a warning,
                            // the same way FileSystemDocumentLoader does it.
                            null
                        } catch (e: Exception) {
                            // DocumentParser is pluggable and may throw anything,
                            // so one unreadable file must not abort the whole batch.
                            logger.warn("Failed to load '{}'", file, e)
                            null
                        }
                    }
                }.awaitAll()
                .filterNotNull()
                .map { document ->
                    val metadata = document.metadata()
                    logger.info(
                        "Loaded document: {}/{}",
                        metadata.getString(Document.ABSOLUTE_DIRECTORY_PATH),
                        metadata.getString(Document.FILE_NAME)
                    )
                    document
                }

        if (documents.size < matchedFiles.size) {
            logger.warn(
                "Loaded {} of {} documents from {}. The rest were blank or failed to parse.",
                documents.size,
                matchedFiles.size,
                directoryPaths
            )
        }

        documents
    }

```

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/model/chat/ChatModelExtensions.kt`
```
package dev.langchain4j.kotlin.model.chat

import dev.langchain4j.internal.VirtualThreadUtils
import dev.langchain4j.kotlin.model.chat.request.ChatRequestBuilder
import dev.langchain4j.kotlin.model.chat.request.chatRequest
import dev.langchain4j.model.chat.request.ChatRequest
import dev.langchain4j.model.chat.response.ChatResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext
import kotlin.coroutines.CoroutineContext

/**
 * Asynchronously processes a chat request using the language model within
 * a coroutine scope. This extension function provides a structured
 * concurrency wrapper around the synchronous [dev.langchain4j.model.chat.ChatModel.chat] method.
 *
 * Example usage:
 * ```kotlin
 * val response = model.chatAsync(request = chatRequest, coroutineContext = Dispatchers.IO)
 * ```
 *
 * Note: [dev.langchain4j.model.chat.ChatModel] declares a member
 * `chatAsync(ChatRequest): CompletableFuture<ChatResponse>`. Because a same-signature member always wins over an
 * extension in Kotlin overload resolution, a bare single-argument call (`model.chatAsync(request)`) resolves to that
 * member and returns a [java.util.concurrent.CompletableFuture]. This suspend wrapper is selected when a
 * [coroutineContext] argument is supplied (or via the builder/lambda overloads below); to suspend on the member's
 * future instead, call `model.chatAsync(request).await()`.
 *
 * @param request The chat request containing messages and optional parameters
 *    for the model.
 * @param coroutineContext processes a chat request in provided [CoroutineContext]
 * @return [ChatResponse] containing the model's response and any additional
 *    metadata.
 * @throws Exception if the chat request fails or is interrupted.
 * @see dev.langchain4j.model.chat.ChatModel.chat(ChatRequest)
 * @see ChatRequest
 * @see ChatResponse
 * @author Konstantin Pavlov
 */
@JvmOverloads
public suspend fun dev.langchain4j.model.chat.ChatModel.chatAsync(
    request: ChatRequest,
    coroutineContext: CoroutineContext = defaultCoroutineContext()
): ChatResponse {
    val model = this
    return withContext(coroutineContext) { model.chat(request) }
}

/**
 * Asynchronously processes a chat request using a [ChatRequest.Builder] for
 * convenient request configuration. This extension function combines the
 * builder pattern with coroutine-based asynchronous execution.
 *
 * Example usage:
 * ```kotlin
 * val response = model.chat(
 *     ChatRequest.builder()
 *         .messages(listOf(UserMessage("Hello")))
 *         .temperature(0.7)
 *         .maxTokens(100)
 * )
 * ```
 *
 * @param requestBuilder The builder instance configured with desired chat
 *    request parameters.
 * @param coroutineContext processes a chat request in provided [CoroutineContext]
 * @return [ChatResponse] containing the model's response and any additional
 *    metadata.
 * @throws Exception if the chat request fails, is interrupted, or the builder
 *    produces an invalid configuration.
 * @see ChatRequest
 * @see ChatResponse
 * @see ChatRequest.Builder
 * @see chatAsync
 * @author Konstantin Pavlov
 */
@JvmOverloads
public suspend fun dev.langchain4j.model.chat.ChatModel.chat(
    requestBuilder: ChatRequest.Builder,
    coroutineContext: CoroutineContext = defaultCoroutineContext()
): ChatResponse = chatAsync(coroutineContext = coroutineContext, request = requestBuilder.build())

/**
 * Asynchronously processes a chat request by configuring a [ChatRequest]
 * using a provided builder block. This method facilitates the creation
 * of well-structured chat requests using a [ChatRequestBuilder] and
 * executes the request using the associated [dev.langchain4j.model.chat.ChatModel].
 *
 * Example usage:
 * ```kotlin
 * model.chat {
 *     messages += systemMessage("You are a helpful assistant")
 *     messages += userMessage("Say 'Hello'")
 *     parameters {
 *         temperature = 0.1
 *     }
 * }
 * ```
 *
 * @param block A lambda with receiver on [ChatRequestBuilder] used to
 *    configure the messages and parameters for the chat request.
 * @param coroutineContext processes a chat request in provided [CoroutineContext]
 * @return A [ChatResponse] containing the response from the model and any
 *    associated metadata.
 * @throws Exception if the chat request fails or encounters an error during execution.
 * @author Konstantin Pavlov
 */
public suspend fun dev.langchain4j.model.chat.ChatModel.chat(
    coroutineContext: CoroutineContext = defaultCoroutineContext(),
    block: ChatRequestBuilder.() -> Unit
): ChatResponse = chatAsync(coroutineContext = coroutineContext, request = chatRequest(block))

public suspend fun dev.langchain4j.model.chat.ChatModel.chat(block: ChatRequestBuilder.() -> Unit): ChatResponse =
    chatAsync(coroutineContext = defaultCoroutineContext(), request = chatRequest(block))

/**
 * Provides the default [CoroutineContext] for executing asynchronous operations.
 *
 * This method attempts to create a coroutine dispatcher backed by a virtual thread
 *  executor if virtual threads are available on the current platform (Java 21+).
 * If virtual threads are not supported, it defaults to using [Dispatchers.IO].
 *
 * @return A [CoroutineContext] appropriate for executing background tasks,
 *         defaulting to a virtual thread dispatcher when available or [Dispatchers.IO] otherwise.
 */
internal fun defaultCoroutineContext(): CoroutineContext =
    if (VirtualThreadUtils.isVirtualThreadsSupported()) {
        VirtualThreadUtils.createVirtualThreadExecutor().asCoroutineDispatcher()
    } else {
        Dispatchers.IO
    }


```

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/model/chat/StreamingChatModelExtensions.kt`
```
package dev.langchain4j.kotlin.model.chat

import dev.langchain4j.internal.Markers
import dev.langchain4j.kotlin.model.chat.request.ChatRequestBuilder
import dev.langchain4j.kotlin.model.chat.request.chatRequest
import dev.langchain4j.model.chat.response.ChatResponse
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger(dev.langchain4j.model.chat.StreamingChatModel::class.java)

/**
 * Represents different types of replies that can be received from an AI language model during streaming.
 * This sealed interface provides type-safe handling of both intermediate tokens and final completion responses.
 *
 * @author Konstantin Pavlov
 */
public sealed interface StreamingChatModelReply {
    /**
     * Represents a partial response received from an AI language model during a streaming interaction.
     *
     * This data class is used to encapsulate an intermediate token that the model generates as part of its
     * streaming output. Partial responses are often used in scenarios where the model's output is produced
     * incrementally, enabling real-time updates to the user or downstream processes.
     *
     * @property partialResponse The partial response, usually a single token, but might be more,
     *                           which is a part of the complete response.
     * @see StreamingChatResponseHandler.onPartialResponse
     */
    public data class PartialResponse(
        val partialResponse: String
    ) : StreamingChatModelReply

    /**
     * Represents a final completion response received from the AI language model
     * during the streaming chat process.
     *
     * This data class encapsulates the complete response, which typically contains
     * the final output of a model's reply in the context of a conversation.
     *
     * @property response The final chat response generated by the model.
     * @see StreamingChatResponseHandler.onCompleteResponse
     */
    public data class CompleteResponse(
        val response: ChatResponse
    ) : StreamingChatModelReply

    /**
     * Represents an error that occurred during the streaming process
     * when generating a reply from the AI language model. This type
     * of reply is used to indicate a failure in the operation and
     * provides details about the cause of the error.
     *
     * @property cause The underlying exception or error that caused the failure.
     * @see StreamingChatResponseHandler.onError
     */
    public data class Error(
        val cause: Throwable
    ) : StreamingChatModelReply
}

/**
 * Converts a streaming chat model into a Kotlin [Flow] of [StreamingChatModelReply]
 * events. This extension function provides a coroutine-friendly way to consume streaming responses
 * from the language model.
 *
 * The method uses a provided configuration block to build a chat request
 * and manages the streaming process by handling partial responses, complete
 * responses, and errors through a LC4J's [dev.langchain4j.model.chat.response.StreamingChatResponseHandler].
 *
 * @param block A lambda with receiver on [ChatRequestBuilder] used to configure
 * the [dev.langchain4j.model.chat.request.ChatRequest] by adding messages and/or setting parameters.
 *
 * @return A [Flow] of [StreamingChatModelReply], which emits different
 * types of replies during the chat interaction, including partial responses,
 * final responses, and errors.
 *
 * @author Konstantin Pavlov
 */
public fun dev.langchain4j.model.chat.StreamingChatModel.chatFlow(
    block: ChatRequestBuilder.() -> Unit
): Flow<StreamingChatModelReply> =
    callbackFlow {
        val model = this@chatFlow
        val chatRequest = chatRequest(block)
        val handler =
            object : StreamingChatResponseHandler {
                override fun onPartialResponse(token: String) {
                    logger.trace(
                        Markers.SENSITIVE,
                        "Received partialResponse: {}",
                        token
                    )
                    trySend(StreamingChatModelReply.PartialResponse(token))
                }

                override fun onCompleteResponse(completeResponse: ChatResponse) {
                    logger.trace(
                        Markers.SENSITIVE,
                        "Received completeResponse: {}",
                        completeResponse
                    )
                    trySend(StreamingChatModelReply.CompleteResponse(completeResponse))
                    close()
                }

                override fun onError(error: Throwable) {
                    logger.error(
                        "Received error: {}",
                        error.message,
                        error
                    )
                    trySend(StreamingChatModelReply.Error(error))
                    close(error)
                }
            }

        logger.debug("Starting flow...")
        model.chat(chatRequest, handler)

        // This will be called when the flow collection is closed or cancelled.
        awaitClose {
            // cleanup
            logger.debug("Flow is closed or cancelled.")
        }
    }

```

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/model/chat/request/ChatRequestExtensions.kt`
```
package dev.langchain4j.kotlin.model.chat.request

import dev.langchain4j.agent.tool.ToolSpecification
import dev.langchain4j.data.message.ChatMessage
import dev.langchain4j.model.chat.request.DefaultChatRequestParameters

/**
 * Builds and returns a [dev.langchain4j.model.chat.request.ChatRequest] using the provided configuration block.
 * The configuration is applied on a [ChatRequestBuilder] instance to customize
 * messages and parameters that will be part of the resulting [dev.langchain4j.model.chat.request.ChatRequest].
 *
 * Sample usage:
 * ```kotlin
 * chatRequest {
 *     messages += systemMessage("You are helpful assistant")
 *     message += userMessage("Tell me a haiku")
 * }
 * ```
 * @param block A lambda with receiver on [ChatRequestBuilder] to configure messages
 * and/or parameters for the [dev.langchain4j.model.chat.request.ChatRequest] .
 * @return A fully constructed [dev.langchain4j.model.chat.request.ChatRequest] instance,
 * based on the applied configurations.
 * @author Konstantin Pavlov
 */
public fun chatRequest(block: ChatRequestBuilder.() -> Unit): dev.langchain4j.model.chat.request.ChatRequest {
    val builder = ChatRequestBuilder()
    builder.apply { block() }
    return builder.build()
}

/**
 * A utility class for building and configuring chat request parameters.
 * This builder allows fine-grained control over various fields
 * such as model configuration, response shaping, and tool integration.
 *
 * @param B The type of the builder for the default chat request parameters.
 * @property builder The builder used to configure the chat request parameters.
 * @property modelName Specifies the name of the model to be used for the chat request.
 * @property temperature Controls the randomness in the response generation. Higher values produce more random outputs.
 * @property topP Configures nucleus sampling, limiting the selection to a subset of tokens
 * with a cumulative probability of `topP`.
 * @property topK Limits the selection to the top `K` tokens during response generation.
 * @property frequencyPenalty Applies a penalty to discourage repetition of tokens based on frequency.
 * @property presencePenalty Applies a penalty to encourage diversity by penalizing token presence
 * in the conversation context.
 * @property maxOutputTokens Specifies the maximum number of tokens for the generated response.
 * @property stopSequences A list of sequences that will terminate the response generation if encountered.
 * @property toolSpecifications A list of tool specifications for integrating external tools into the chat request.
 * @property toolChoice Defines the specific tool to be used if multiple tools are available in the request.
 * @property responseFormat Specifies the format of the response, such as plain text or structured data.
 * @author Konstantin Pavlov
 */
@Suppress("LongParameterList")
public open class ChatRequestParametersBuilder<B : DefaultChatRequestParameters.Builder<*>>(
    public val builder: B,
    public var modelName: String? = null,
    public var temperature: Double? = null,
    public var topP: Double? = null,
    public var topK: Int? = null,
    public var frequencyPenalty: Double? = null,
    public var presencePenalty: Double? = null,
    public var maxOutputTokens: Int? = null,
    public var stopSequences: List<String>? = null,
    public var toolSpecifications: List<ToolSpecification>? = null,
    public var toolChoice: dev.langchain4j.model.chat.request.ToolChoice? = null,
    public var responseFormat: dev.langchain4j.model.chat.request.ResponseFormat? = null
)

/**
 * Builder class for constructing a [dev.langchain4j.model.chat.request.ChatRequest] instance. Allows configuring
 * messages and request parameters to customize the resulting request.
 *
 * This builder provides methods to add individual or multiple chat messages,
 * as well as set request parameters for the generated [dev.langchain4j.model.chat.request.ChatRequest].
 */
public open class ChatRequestBuilder(
    public var messages: MutableList<ChatMessage> = mutableListOf(),
    public var parameters: dev.langchain4j.model.chat.request.ChatRequestParameters? = null
) {
    /**
     * Adds a list of [ChatMessage] objects to the builder's messages collection.
     *
     * @param value The list of [ChatMessage] objects to be added to the builder.
     * @return This builder instance for chaining other method calls.
     */
    public open fun messages(value: List<ChatMessage>): ChatRequestBuilder = apply { this.messages.addAll(value) }

    /**
     * Adds a chat message to the message list.
     *
     * @param value The chat message to be added.
     * @return The current instance for method chaining.
     */
    public open fun message(value: ChatMessage): ChatRequestBuilder = apply { this.messages.add(value) }

    /**
     * Builds and returns a ChatRequest instance using the current state of messages and parameters.
     *
     * @return A new instance of ChatRequest configured with the provided messages and parameters.
     */
    public open fun build(): dev.langchain4j.model.chat.request.ChatRequest =
        dev.langchain4j.model.chat.request.ChatRequest
            .Builder()
            .messages(this.messages)
            .parameters(this.parameters)
            .build()

    /**
     * Configures and sets the parameters for the chat request.
     *
     * @param builder The builder instance used to create the chat request parameters.
     * Defaults to an instance of [DefaultChatRequestParameters.Builder].
     * @param configurer A lambda with the builder as receiver to configure the chat request parameters.
     */
    @JvmOverloads
    public open fun <B : DefaultChatRequestParameters.Builder<*>> parameters(
        @Suppress("UNCHECKED_CAST")
        builder: B = DefaultChatRequestParameters.builder() as B,
        configurer: ChatRequestParametersBuilder<B>.() -> Unit
    ) {
        val b = ChatRequestParametersBuilder(builder = builder).also(configurer)
        parameters =
            builder
                .apply {
                    b.modelName?.let { modelName(it) }
                    b.temperature?.let { temperature(it) }
                    b.topP?.let { topP(it) }
                    b.topK?.let { topK(it) }
                    b.frequencyPenalty?.let { frequencyPenalty(it) }
                    b.presencePenalty?.let { presencePenalty(it) }
                    b.maxOutputTokens?.let { maxOutputTokens(it) }
                    b.stopSequences?.let { stopSequences(it) }
                    b.toolSpecifications?.let { toolSpecifications(it) }
                    b.toolChoice?.let { toolChoice(it) }
                    b.responseFormat?.let { responseFormat(it) }
                }.build()
    }
}

```

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/service/TokenStreamExtensions.kt`
```
package dev.langchain4j.kotlin.service

import dev.langchain4j.kotlin.model.chat.StreamingChatModelReply
import dev.langchain4j.service.TokenStream
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.callbackFlow

/**
 * Defines the default buffer capacity used for buffering operations or TokenStream processing.
 *
 * This constant is set to ensure consistent and optimal memory management when handling
 * buffers, providing a balance between performance and resource usage.
 * Depending on the context, it can be used as a standard size to initialize or manage buffers in memory.
 */
public const val DEFAULT_BUFFER_CAPACITY: Int = 32768

/**
 *
 * Converts a [TokenStream] into a [Flow] of strings which emits partial responses
 * as they are streamed, and closes when the stream is complete or encounters an error.
 *
 * @param bufferCapacity The capacity of the buffer used in the flow to control backpressure.
 *    Defaults to [DEFAULT_BUFFER_CAPACITY] if not specified.
 *    Use value [kotlinx.coroutines.channels.Channel.UNLIMITED]
 *    if you are feeling optimistic about [java.lang.OutOfMemoryError]s.
 * @return A [Flow] emitting strings, where each string represents a partial response
 *    from the associated language model.
 */
@JvmOverloads
public fun TokenStream.asFlow(
    bufferCapacity: Int = DEFAULT_BUFFER_CAPACITY,
    onBufferOverflow: BufferOverflow = BufferOverflow.SUSPEND,
    includeCompleteResponse: Boolean = false
): Flow<String> =
    callbackFlow {
        onPartialResponse { trySend(it) }
        onCompleteResponse {
            it.aiMessage()?.text()?.let { text ->
                if (includeCompleteResponse) {
                    trySend(text)
                }
            }
            close()
        }
        onError { close(it) }
        start()
        awaitClose()
    }.buffer(
        capacity = bufferCapacity, onBufferOverflow = onBufferOverflow
    )

/**
 * Converts a `TokenStream` into a `Flow` of `StreamingChatModelReply` instances, where each
 * emitted item represents a partial or complete response received during streaming.
 *
 * This function utilizes a coroutine-based flow to provide real-time updates of the
 * streaming response. The flow handles partial responses, the final complete response, and
 * errors that may occur during the streaming process. Responses are buffered with the specified
 * capacity.
 *
 * @param bufferCapacity The capacity of the flow buffer, which determines how many items can
 *                       be collected before backpressure occurs. Defaults to [DEFAULT_BUFFER_CAPACITY].
 *                       Use value [kotlinx.coroutines.channels.Channel.UNLIMITED]
 *                       if you are feeling optimistic about [java.lang.OutOfMemoryError].
 * @return A `Flow` that will emit `StreamingChatModelReply` instances including partial
 *         responses, complete responses, or errors in the order they are received.
 */
@JvmOverloads
public fun TokenStream.asReplyFlow(
    bufferCapacity: Int = DEFAULT_BUFFER_CAPACITY,
    onBufferOverflow: BufferOverflow = BufferOverflow.SUSPEND
): Flow<StreamingChatModelReply> =
    callbackFlow {
        onPartialResponse { token ->
            trySend(StreamingChatModelReply.PartialResponse(token))
        }
        onCompleteResponse { response ->
            trySend(StreamingChatModelReply.CompleteResponse(response))
            close()
        }
        onError { throwable -> close(throwable) }
        start()
        awaitClose()
    }.buffer(capacity = bufferCapacity, onBufferOverflow = onBufferOverflow)

```

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/service/TokenStreamToReplyFlowAdapter.kt`
```
package dev.langchain4j.kotlin.service

import dev.langchain4j.Internal
import dev.langchain4j.kotlin.model.chat.StreamingChatModelReply
import dev.langchain4j.service.TokenStream
import dev.langchain4j.spi.services.TokenStreamAdapter
import kotlinx.coroutines.flow.Flow
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type

@Internal
public class TokenStreamToReplyFlowAdapter : TokenStreamAdapter {
    public override fun canAdaptTokenStreamTo(type: Type): Boolean {
        if (type is ParameterizedType && type.rawType === Flow::class.java) {
            val typeArguments: Array<Type> = type.actualTypeArguments
            return typeArguments.size == 1 &&
                    typeArguments[0] === StreamingChatModelReply::class.java
        }
        return false
    }

    public override fun adapt(tokenStream: TokenStream): Any = tokenStream.asReplyFlow()
}

```

### Core Architecture Module: `langchain4j-kotlin/src/main/kotlin/dev/langchain4j/kotlin/service/TokenStreamToStringFlowAdapter.kt`
```
package dev.langchain4j.kotlin.service

import dev.langchain4j.Internal
import dev.langchain4j.service.TokenStream
import dev.langchain4j.spi.services.TokenStreamAdapter
import kotlinx.coroutines.flow.Flow
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type

@Internal
public class TokenStreamToStringFlowAdapter : TokenStreamAdapter {
    public override fun canAdaptTokenStreamTo(type: Type): Boolean {
        if (type is ParameterizedType && type.rawType === Flow::class.java) {
            val typeArguments: Array<Type> = type.actualTypeArguments
            return typeArguments.size == 1 && typeArguments[0] === String::class.java
        }
        return false
    }

    public override fun adapt(tokenStream: TokenStream): Any = tokenStream.asFlow()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6913** (2026-11-02): **[BUG] A listener that throws keeps the other composed agent listeners from being notified**
  *Symptoms*: **Describe the bug**  `ComposedAgentListener` notifies its listeners in a plain loop with no per-listener guard, so a listener that throws keeps every listener after it from being notified. The listeners are kept in a `HashSet`, so which listeners get skipped depends on their identity hash codes. It changes from one JVM run to the next, and stays the same within a run.  `ListenerNotifierUtil` catches and logs the exception, but it wraps the *composed* listener as a whole, so the skipped listeners are never notified at all. #6360 mentions this side effect ("a listener that throws also prevents every listener after it in the set from being notified"), but its scope was the `AgentMonitor` failure itself.  It matters when another listener relies on the notification for more than recording. quarkus-flow's `FlowAgentContextListener` activates the caller's OpenTelemetry context on the agent's thread in `beforeAgentInvocation`. When a root agent extends `MonitoredAgent`, the `AgentMonitor` sits in the same composed listener, and for the sub-agents of a parallel workflow it throws `No ongoing parent invocation found` (#6885). In the runs where the monitor is iterated first, Flow's listener is skipped. Each parallel sub-agent then runs without the caller's context, and its AI service and model spans land in traces of their own.  **Log and Stack trace**  ``` ERROR [dev.langchain4j.agentic.observability.ListenerNotifierUtil] beforeAgentInvocation listener for agent assessClaimantSentimen

- **Issue #6857** (2026-10-27): **[BUG] Concurrent invocations of the same agent in one AgenticScope overwrite each other's last response reported to listeners and monitors**
  *Symptoms*: <!-- Please provide as many details as possible, this will help us to deliver a fix as soon as possible. Thank you! -->  **Describe the bug**  Both AI agents and decision agents keep the response of their last model call in a map keyed by the memory id of the `AgenticScope`, so that `AgentInvoker.invoke` can hand it to the `AgentListener`s after the agent method returns. When the same agent instance runs several times at once in the same scope, the invocations share one entry and overwrite each other. The outputs of the agents are correct; only the data reported about the invocation can belong to another invocation, or be missing.  **Where**  - AI agents: `AgentInvocationHandler.lastResponses`, filled from the `AiServiceResponseReceivedEvent` under `agenticScope.memoryId()` and read through `ChatMessagesAccess` (`lastUserMessage`, `lastChatRequest`, `lastChatResponse`, `removeLastResponseEvent`), all keyed by the memory id of the scope. - Decision agents (#6820): `DecisionAgentInvocationHandler.lastResponses`, filled by `decide` under `agenticScope.memoryId()` and read through `DecisionResponseAccess` (`lastDecisionResponse`, `removeLastDecisionResponse`). - Consumers: `AgentInvoker.invoke`, which builds the `AgentResponse` passed to `afterAgentInvocation`, and `DefaultAgenticScope.registerContext`, which reads the last user message to build the context. Everything downstream shows the wrong data: `AgentResponse.chatRequest()/chatResponse()/decisionResponse()`, `AgentInvocati

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

### Incident Patch 1: `5ce59cd7` (2026-11-03)
**Commit Message**: fix(mcp): limit the size of messages received by the Streamable HTTP and WebSocket transports (#6954)

## Issue
Part of
https://github.com/langchain4j/langchain4j/security/advisories/GHSA-89ff-7rm6-783j

## Change
An MCP server could make the client buffer an unbounded amount of data
by sending a message that never ends, until the client ran out of
memory.

Both network transports now limit the size of a single message received
from the server. The limit is set with the new `maxMessageSize` builder
option and defaults to 20 MiB.

- `StreamableHttpMcpTransport`: the limit applies to the data of each
SSE event (in responses and on the subsidiary channel) and to the whole
body of any other response, such as a JSON response or the answer to a
notification. The response parser passes lines longer than 64 KiB on in
fragments, so the transport counts the bytes before it buffers them.
When a message is too large, the transport closes the stream: the
pending request fails and the subsidiary channel reconnects.
- `WebSocketMcpTransport`: a larger message closes the connection with
status 1009 (message too big), and all pending requests fail.

The warning that is logged in this case does not 

**File**: `docs/docs/tutorials/mcp.md` (modified, +12/-0)
```diff
@@ -75,6 +75,14 @@ With the modern protocol (2026-07-28), notifications are received via `subscript
 It is disabled by default. If the server does not support it, the transport logs a warning and continues without it.
 If the stream breaks after being established, the transport reconnects automatically (respecting the server's `retry` value, defaulting to 5 seconds).
 
+**_NOTE:_** A single message received from the server can be at most 20 MiB by default: the data of one event
+on an SSE stream (in a response or on the subsidiary channel), or the whole body of any other response, such as
+a JSON response. If the server sends a larger message, the transport closes the stream and drops the message:
+the pending request fails, and the subsidiary channel reconnects. This keeps a misbehaving server from filling
+the client's memory. The size is that of the JSON text, so binary content such as images, which is base64-encoded,
+takes about a third more than its raw size. To change the limit, set it on the builder, for example
+`.maxMessageSize(50 * 1024 * 1024)` for 50 MiB.
+
 #### Custom HTTP client
 
 By default, the Streamable HTTP transport sends its requests with the JDK HTTP client
@@ -166,6 +174,10 @@ McpTransport transport = WebSocketMcpTransport.builder()
         .build();
 ```
 
+**_NOTE:_** As with the Streamable HTTP transport, a single message received from the server can be at most
+20 MiB by default. If the server sends a larger message, the transport closes the connection and all pending
+requests fail. To change the limit, set it on the builder, for example `.maxMessageSize(50 * 1024 * 1024)` for 50 MiB.
+
 For the Docker stdio transport, you first need to add a module to your pom.xml:
 
 ```xml
```

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/transport/http/McpResponseParser.java` (modified, +39/-2)
```diff
@@ -19,9 +19,13 @@
  * The transport handles JSON responses and retains its SSE field handling, including {@code id} and {@code retry},
  * which would otherwise be lost when parsing with the default SSE parser.
  * Line endings are retained separately so that non-SSE response bodies can be reconstructed without modification.
+ * A line longer than {@link #MAX_LINE_FRAGMENT_BYTES} is passed on in several {@linkplain Line#partial() partial}
+ * fragments, so that the transport, rather than this parser, decides how much of a line it is willing to buffer.
  */
 final class McpResponseParser implements ServerSentEventParser {
 
+    static final int MAX_LINE_FRAGMENT_BYTES = 64 * 1024;
+
     @Override
     public void parse(InputStream httpResponseBody, ServerSentEventListener listener) {
         var handle = new DefaultServerSentEventParsingHandle(httpResponseBody);
@@ -61,15 +65,36 @@ private static void emit(
     static final class Line extends ServerSentEvent {
 
         private final String ending;
+        private final boolean partial;
+        private final int byteLength;
 
-        private Line(String data, String ending) {
+        private Line(String data, String ending, boolean partial, int byteLength) {
             super(null, data);
             this.ending = ending;
+            this.partial = partial;
+            this.byteLength = byteLength;
         }
 
+        /**
+         * The line terminator, or an empty string for a partial fragment or a final line without a terminator.
+         */
         String ending() {
             return ending;
         }
+
+        /**
+         * Whether this is a fragment of a longer line that continues in the next {@link Line}.
+         */
+        boolean partial() {
+            return partial;
+        }
+
+        /**
+         * The number of bytes received for this line or fragment, excluding the line terminator.
+         */
+        int byteLength() {
+            return byteLength;
+        }
     }
 
     private static final class LineParser implements Incremental {
@@ -97,6 +122,12 @@ public List<ServerSentEvent> feed(ByteBuffer bytes) {
                 } else {
                     // UTF-8 continuation bytes cannot contain CR or LF. Decode only complete lines so that
                     // multi-byte characters split across chunks remain intact, without rescanning buffered bytes.
+                    // A long line is split before a byte that starts a character, which keeps fragments decodable;
+                    // a run of continuation bytes longer than any valid character is invalid UTF-8 and split anyway.
+                    if (pending.size() >= MAX_LINE_FRAGMENT_BYTES
+                            && ((next & 0xC0) != 0x80 || pending.size() >= MAX_LINE_FRAGMENT_BYTES + 3)) {
+                        lines.add(fragment());
+                    }
                     pending.write(next);
                 }
             }
@@ -113,7 +144,13 @@ public List<ServerSentEvent> flush() {
         }
 
         private Line line(String ending) {
-            var line = new Line(pending.toString(UTF_8), ending);
+            var line = new Line(pending.toString(UTF_8), ending, false, pending.size());
+            pending.reset();
+            return line;
+        }
+
+        private Line fragment() {
+            var line = new Line(pending.toString(UTF_8), "", true, pending.size());
             pending.reset();
             return line;
         }
```

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/transport/http/StreamableHttpMcpTransport.java` (modified, +82/-4)
```diff
@@ -1,6 +1,7 @@
 package dev.langchain4j.mcp.client.transport.http;
 
 import static dev.langchain4j.internal.Utils.getOrDefault;
+import static dev.langchain4j.internal.ValidationUtils.ensureGreaterThanZero;
 import static dev.langchain4j.internal.ValidationUtils.ensureNotNull;
 
 import dev.langchain4j.Experimental;
@@ -49,6 +50,8 @@
 public class StreamableHttpMcpTransport implements McpTransport {
     private static final Logger LOG = LoggerFactory.getLogger(StreamableHttpMcpTransport.class);
     private static final long DEFAULT_SUBSIDIARY_RETRY_MS = 5000;
+    private static final int DEFAULT_MAX_MESSAGE_SIZE = 20 * 1024 * 1024;
+    private static final int SSE_DATA_FIELD_NAME_LENGTH = "data:".length();
     private final String url;
     private final McpHeadersSupplier customHeadersSupplier;
     private final boolean logResponses;
@@ -67,6 +70,7 @@ public class StreamableHttpMcpTransport implements McpTransport {
 
     // Subsidiary SSE channel fields
     private final boolean subsidiaryChannelEnabled;
+    private final int maxMessageSize;
     private volatile Runnable onFailureCallback;
     private volatile boolean subsidiaryChannelEstablished;
     private final AtomicReference<String> subsidiaryLastEventId = new AtomicReference<>();
@@ -85,6 +89,8 @@ public StreamableHttpMcpTransport(StreamableHttpMcpTransport.Builder builder) {
         customHeadersSupplier = getOrDefault(builder.customHeadersSupplier, (i) -> Map.of());
         sslContext = builder.sslContext;
         subsidiaryChannelEnabled = builder.subsidiaryChannelEnabled;
+        maxMessageSize =
+                ensureGreaterThanZero(getOrDefault(builder.maxMessageSize, DEFAULT_MAX_MESSAGE_SIZE), "maxMessageSize");
         executor = getOrDefault(builder.executor, DefaultExecutorProvider.getDefaultExecutor());
         responseExecutor = builder.executor;
         if (builder.httpClientBuilder != null && builder.httpClient != null) {
@@ -544,8 +550,12 @@ private final class HttpExchange implements Flow.Subscriber<HttpStreamingEvent>
         private final CapturedContext requestContext;
         private final AtomicBoolean finished = new AtomicBoolean();
         private final StringBuilder body = new StringBuilder();
+        private long bodyBytes;
         private final StringBuilder sseData = new StringBuilder();
         private boolean sseDataPresent;
+        private long sseDataBytes;
+        private final StringBuilder sseLine = new StringBuilder();
+        private long sseLineBytes;
         private volatile Flow.Subscription subscription;
         private boolean sseResponse;
         private boolean responseReceived;
@@ -611,9 +621,9 @@ private void handleNext(HttpStreamingEvent event) {
                             errorResponse.statusCode(), "Unexpected status code: " + errorResponse.statusCode()));
                 } else if (event instanceof McpResponseParser.Line line) {
                     if (sseResponse) {
-                        handleSseLine(line.data());
+                        handleSseFragment(line);
                     } else {
-                        body.append(line.data()).append(line.ending());
+                        handleBodyFragment(line);
                     }
                 }
             } catch (RuntimeException e) {
@@ -644,7 +654,50 @@ private void onResponse(SuccessfulHttpResponse response) {
             }
         }
 
-        private void handleSseLine(String line) {
+        /**
+         * Buffers the body of a response that is not an SSE stream, failing the exchange once it exceeds
+         * {@code maxMessageSize}, so that a server cannot make the client buffer an unbounded amount of data.
+         */
+        private void handleBodyFragment(McpResponseParser.Line fragment) {
+            bodyBytes += fragment.byteLength() + fragment.ending().length();
+            if (bodyBytes > maxMessageSize) {
+                failMessageTooLarge();
+                return;
+            }
+            body.append(fragment.data()).append(fragment.ending());
+        }
+
+        /**
+         * Reassembles lines that the parser split into fragments, failing the exchange once the data of the
+         * current event and the line being read exceed {@code maxMessageSize}, so that a server cannot
+         * make the client buffer an unbounded amount of data. The line being read still contains its field name,
+         * so a {@code data:} line that carries exactly {@code maxMessageSize} bytes is accepted.
+         */
+        private void handleSseFragment(McpResponseParser.Line fragment) {
+            sseLineBytes += fragment.byteLength();
+            if (sseDataBytes + sseLineBytes > maxMessageSize + SSE_DATA_FIELD_NAME_LENGTH) {
+                failMessageTooLarge();
+                return;
+            }
+            sseLine.append(fragment.data());
+            if (fragment.partial()) {
+                return;
+            }
+            String line = sseLine.toString(
```

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/transport/websocket/WebSocketMcpListener.java` (modified, +59/-0)
```diff
@@ -1,33 +1,56 @@
 package dev.langchain4j.mcp.client.transport.websocket;
 
+import static dev.langchain4j.internal.ValidationUtils.ensureGreaterThanZero;
+
 import dev.langchain4j.mcp.client.transport.McpOperationHandler;
 import org.slf4j.Logger;
 import org.slf4j.LoggerFactory;
 import java.net.http.WebSocket;
 import java.nio.ByteBuffer;
 import java.util.concurrent.CompletionStage;
+import java.util.concurrent.TimeUnit;
 
 
 public class WebSocketMcpListener implements WebSocket.Listener {
 
+    private static final int MESSAGE_TOO_BIG = 1009;
+
     private final McpOperationHandler operationHandler;
     private final Logger trafficLogger;
     private final boolean logResponses;
     private final Runnable onCloseCallback;
     private final Logger logger = LoggerFactory.getLogger(WebSocketMcpListener.class);
     private final Runnable onFailureCallback;
+    private final int maxMessageSize;
 
 
     public WebSocketMcpListener(McpOperationHandler operationHandler,
                                 Logger trafficLogger,
                                 boolean logResponses,
                                 Runnable onCloseCallback,
                                 Runnable onFailureCallback) {
+        this(operationHandler, trafficLogger, logResponses, onCloseCallback, onFailureCallback,
+                WebSocketMcpTransport.DEFAULT_MAX_MESSAGE_SIZE);
+    }
+
+    /**
+     * Creates a listener that closes the connection when a single message received from the server
+     * is larger than {@code maxMessageSize} bytes.
+     *
+     * @since 1.24.0
+     */
+    public WebSocketMcpListener(McpOperationHandler operationHandler,
+                                Logger trafficLogger,
+                                boolean logResponses,
+                                Runnable onCloseCallback,
+                                Runnable onFailureCallback,
+                                int maxMessageSize) {
         this.operationHandler = operationHandler;
         this.trafficLogger = trafficLogger;
         this.logResponses = logResponses;
         this.onCloseCallback = onCloseCallback;
         this.onFailureCallback = onFailureCallback;
+        this.maxMessageSize = ensureGreaterThanZero(maxMessageSize, "maxMessageSize");
     }
 
     @Override
@@ -37,13 +60,20 @@ public void onOpen(WebSocket webSocket) {
     }
 
     private volatile StringBuilder receivedMessage = new StringBuilder();
+    private long receivedMessageBytes;
 
     @Override
     public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
+        receivedMessageBytes += utf8Length(data);
+        if (receivedMessageBytes > maxMessageSize) {
+            closeBecauseMessageIsTooBig(webSocket);
+            return null;
+        }
         receivedMessage.append(data);
         if(last) {
             String completeMessage = receivedMessage.toString();
             receivedMessage = new StringBuilder();
+            receivedMessageBytes = 0;
             if (logResponses) {
                 trafficLogger.info("< " + completeMessage);
             }
@@ -57,6 +87,35 @@ public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean
         return null;
     }
 
+    private void closeBecauseMessageIsTooBig(WebSocket webSocket) {
+        receivedMessage = new StringBuilder();
+        receivedMessageBytes = 0;
+        String reason = "Message from the MCP server exceeds the maximum size of " + maxMessageSize
+                + " bytes; use WebSocketMcpTransport.Builder.maxMessageSize to raise the limit";
+        logger.warn("Closing the WebSocket connection: {}", reason);
+        operationHandler.cancelAllPendingOperations(reason);
+        onCloseCallback.run();
+        webSocket
+                .sendClose(MESSAGE_TOO_BIG, "Message too big")
+                .orTimeout(5, TimeUnit.SECONDS)
+                .whenComplete((ws, error) -> webSocket.abort());
+    }
+
+    private static long utf8Length(CharSequence text) {
+        long length = 0;
+        for (int i = 0; i < text.length(); i++) {
+            char c = text.charAt(i);
+            if (c < 0x80) {
+                length += 1;
+            } else if (c < 0x800 || Character.isSurrogate(c)) {
+                length += 2;
+            } else {
+                length += 3;
+            }
+        }
+        return length;
+    }
+
     @Override
     public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
         logger.debug("Websocket connection closed with status {} and reason: {}", statusCode, reason);
```

**File**: `langchain4j-mcp/src/main/java/dev/langchain4j/mcp/client/transport/websocket/WebSocketMcpTransport.java` (modified, +27/-1)
```diff
@@ -1,6 +1,7 @@
 package dev.langchain4j.mcp.client.transport.websocket;
 
 import static dev.langchain4j.internal.Utils.getOrDefault;
+import static dev.langchain4j.internal.ValidationUtils.ensureGreaterThanZero;
 import static dev.langchain4j.internal.ValidationUtils.ensureNotNull;
 
 import dev.langchain4j.mcp.client.McpCallContext;
@@ -31,6 +32,7 @@
 
 public class WebSocketMcpTransport implements McpTransport {
     private static final Logger LOG = LoggerFactory.getLogger(WebSocketMcpTransport.class);
+    static final int DEFAULT_MAX_MESSAGE_SIZE = 20 * 1024 * 1024;
     private final String url;
     private final McpHeadersSupplier headersSupplier;
     private final boolean logResponses;
@@ -39,6 +41,7 @@ public class WebSocketMcpTransport implements McpTransport {
     private volatile McpOperationHandler operationHandler;
     private volatile McpInitializeRequest initializeRequest;
     private final Duration connectTimeout;
+    private final int maxMessageSize;
     private volatile SSLContext sslContext;
     private volatile HttpClient httpClient;
     private final Executor executor;
@@ -52,6 +55,8 @@ public WebSocketMcpTransport(Builder builder) {
         this.logRequests = builder.logRequests;
         this.trafficLog = getOrDefault(builder.logger, McpLoggers.traffic());
         this.connectTimeout = getOrDefault(builder.timeout, Duration.ofSeconds(60));
+        this.maxMessageSize =
+                ensureGreaterThanZero(getOrDefault(builder.maxMessageSize, DEFAULT_MAX_MESSAGE_SIZE), "maxMessageSize");
         this.headersSupplier = getOrDefault(builder.headersSupplier, (i) -> Map.of());
         this.executor = builder.executor;
         this.sslContext = builder.sslContext;
@@ -125,7 +130,8 @@ private synchronized CompletableFuture<WebSocket> startWebSocket() {
                             // so all running operations were lost anyway.
                             webSocketRef.set(null);
                         },
-                        actionOnFailure));
+                        actionOnFailure,
+                        maxMessageSize));
         // if the initialize method was already called and we know the necessary data for initialization, schedule
         // a new initialization right away
         if (this.initializeRequest != null) {
@@ -271,6 +277,7 @@ public static class Builder {
         private Duration timeout;
         private SSLContext sslContext;
         private McpHeadersSupplier headersSupplier;
+        private Integer maxMessageSize;
 
         public Builder logResponses(boolean logResponses) {
             this.logResponses = logResponses;
@@ -331,6 +338,25 @@ public Builder headersSupplier(McpHeadersSupplier headersSupplier) {
             return this;
         }
 
+        /**
+         * The maximum size, in bytes, of a single message received from the server.
+         * When a server sends a larger message, the transport closes the connection with status 1009
+         * (message too big) and all pending requests fail. This protects the client against servers that send
+         * an endless or huge message, which would otherwise be buffered in memory until it runs out.
+         * The size is that of the JSON text, so binary content such as images, which is base64-encoded,
+         * takes about a third more than its raw size.
+         * Defaults to 20 MiB.
+         *
+         * @param maxMessageSize the maximum message size in bytes, must be greater than zero;
+         *                       {@code null} means the default
+         * @return this builder
+         * @since 1.24.0
+         */
+        public Builder maxMessageSize(Integer maxMessageSize) {
+            this.maxMessageSize = maxMessageSize;
+            return this;
+        }
+
         public WebSocketMcpTransport build() {
             return new WebSocketMcpTransport(this);
         }
```

**File**: `langchain4j-mcp/src/test/java/dev/langchain4j/mcp/client/transport/StreamableHttpMcpTransportMaxMessageSizeTest.java` (added, +261/-0)
```diff
@@ -0,0 +1,261 @@
+package dev.langchain4j.mcp.client.transport;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.assertThatThrownBy;
+
+import com.sun.net.httpserver.HttpExchange;
+import com.sun.net.httpserver.HttpServer;
+import dev.langchain4j.mcp.client.transport.http.StreamableHttpMcpTransport;
+import dev.langchain4j.mcp.protocol.McpListToolsRequest;
+import java.io.IOException;
+import java.io.OutputStream;
+import java.net.InetSocketAddress;
+import java.nio.charset.StandardCharsets;
+import java.util.Collections;
+import java.util.Map;
+import java.util.concurrent.CompletableFuture;
+import java.util.concurrent.ConcurrentHashMap;
+import java.util.concurrent.ExecutionException;
+import java.util.concurrent.TimeUnit;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.params.ParameterizedTest;
+import org.junit.jupiter.params.provider.ValueSource;
+
+/**
+ * A server must not be able to make the client buffer an unbounded amount of data
+ * by sending a message that never ends, neither as an SSE event nor as a JSON response.
+ */
+class StreamableHttpMcpTransportMaxMessageSizeTest {
+
+    private static final int LIMIT = 256 * 1024;
+    private static final String RESPONSE_PREFIX =
+            "{\"jsonrpc\":\"2.0\",\"id\":7,\"result\":{\"tools\":[],\"padding\":\"";
+    private static final String RESPONSE_SUFFIX = "\"}}";
+
+    private HttpServer server;
+    private StreamableHttpMcpTransport transport;
+    private final Map<Long, CompletableFuture<String>> pendingOperations = new ConcurrentHashMap<>();
+
+    @FunctionalInterface
+    interface ResponseWriter {
+        void write(OutputStream out) throws IOException;
+    }
+
+    private void startServer(String contentType, ResponseWriter writer) throws IOException {
+        startServer(contentType, writer, LIMIT);
+    }
+
+    private void startServer(String contentType, ResponseWriter writer, Integer maxMessageSize)
+            throws IOException {
+        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
+        server.createContext("/mcp", exchange -> respond(exchange, contentType, writer));
+        server.start();
+        transport = StreamableHttpMcpTransport.builder()
+                .url("http://localhost:" + server.getAddress().getPort() + "/mcp")
+                .setHttpVersion1_1()
+                .maxMessageSize(maxMessageSize)
+                .build();
+        transport.start(new McpOperationHandler(
+                pendingOperations,
+                Collections::emptyList,
+                transport,
+                null,
+                () -> {},
+                null,
+                () -> {},
+                null,
+                null,
+                null,
+                null,
+                null,
+                null));
+    }
+
+    private static void respond(HttpExchange exchange, String contentType, ResponseWriter writer) throws IOException {
+        exchange.getRequestBody().readAllBytes();
+        exchange.getResponseHeaders().set("Content-Type", contentType);
+        exchange.sendResponseHeaders(200, 0);
+        try (OutputStream out = exchange.getResponseBody()) {
+            writer.write(out);
+        } catch (IOException e) {
+            // the client closed the stream
+        }
+    }
+
+    /**
+     * Writes the given chunk until the client closes the connection (or a safety cap far above the limit is reached).
+     */
+    private static void writeEndlessly(OutputStream out, String chunk) throws IOException {
+        byte[] bytes = chunk.getBytes(StandardCharsets.UTF_8);
+        for (long written = 0; written < 64L * LIMIT; written += bytes.length) {
+            out.write(bytes);
+            out.flush();
+        }
+    }
+
+    @AfterEach
+    void tearDown() throws IOException {
+        if (transport != null) {
+            transport.close();
+        }
+        if (server != null) {
+            server.stop(0);
+        }
+    }
+
+    @Test
+    void delivers_a_message_spanning_several_line_fragments_below_the_limit() throws Exception {
+        String padding = "x".repeat(LIMIT / 2);
+        startServer(
+                "text/event-stream",
+                out -> out.write(("data:" + RESPONSE_PREFIX + padding + RESPONSE_SUFFIX + "\n\n")
+                        .getBytes(StandardCharsets.UTF_8)));
+
+        CompletableFuture<String> response = transport.sendRequest(new McpListToolsRequest(7L, null));
+
+        assertThat(response.get(10, TimeUnit.SECONDS)).isEqualTo(RESPONSE_PREFIX + padding + RESPONSE_SUFFIX);
+    }
+
+    @Test
+    void fails_on_a_line_that_never_ends() throws Exception {
+        startServer("text/event-stream", out -> {
+            out.write("data: ".getBytes(StandardCharsets.UTF_8));
+            writeEndlessly(out, "x".repeat(8192));
+        });
+
+        CompletableFuture<String> response = transport.s
```

**File**: `langchain4j-mcp/src/test/java/dev/langchain4j/mcp/client/transport/StreamableHttpMcpTransportSpiTest.java` (modified, +46/-0)
```diff
@@ -604,6 +604,52 @@ void should_use_supplied_client_for_subsidiary_channel_and_resume_with_event_id(
         assertThat(reconnect.isCancelled()).isTrue();
     }
 
+    @Test
+    void should_reconnect_subsidiary_channel_when_a_message_exceeds_the_maximum_size() throws Exception {
+        start(builder().subsidiaryChannel(true).maxMessageSize(1024));
+        CompletableFuture<String> initialized = transport.sendInitializeRequest(new McpInitializeRequest(0L));
+        StreamExchange initialization = httpClient.nextExchange();
+        initialization.open(200, Map.of("Content-Type", List.of("application/json")));
+        initialization.body(INITIALIZE_RESULT);
+        initialization.complete();
+        StreamExchange notification = httpClient.nextExchange();
+        notification.open(202, Map.of());
+        notification.complete();
+
+        StreamExchange channel = httpClient.nextExchange();
+        channel.open(200, Map.of("Content-Type", List.of("text/event-stream")));
+        assertThat(initialized.get(5, TimeUnit.SECONDS)).isEqualTo(INITIALIZE_RESULT);
+        channel.body("retry: 0\n\ndata: " + "x".repeat(600) + "\n");
+        channel.body("data: " + "x".repeat(600) + "\n");
+
+        assertThat(channel.isCancelled()).isTrue();
+        StreamExchange reconnect = httpClient.nextExchange();
+        assertThat(reconnect.request().method()).isEqualTo(HttpMethod.GET);
+        transport.close();
+    }
+
+    @ParameterizedTest
+    @ValueSource(strings = {"text/event-stream", "application/json"})
+    void should_limit_the_response_to_a_notification(String contentType) throws Exception {
+        start(builder().maxMessageSize(1024));
+        CompletableFuture<String> initialized = transport.sendInitializeRequest(new McpInitializeRequest(0L));
+        StreamExchange initialization = httpClient.nextExchange();
+        initialization.open(200, Map.of("Content-Type", List.of("application/json")));
+        initialization.body(INITIALIZE_RESULT);
+        initialization.complete();
+        StreamExchange notification = httpClient.nextExchange();
+        notification.open(200, Map.of("Content-Type", List.of(contentType)));
+
+        notification.body(("data: " + "x".repeat(600) + "\n").repeat(2));
+
+        assertThat(notification.isCancelled()).isTrue();
+        assertThatThrownBy(() -> initialized.get(5, TimeUnit.SECONDS))
+                .isInstanceOf(ExecutionException.class)
+                .cause()
+                .isInstanceOf(IllegalStateException.class)
+                .hasMessageContaining("exceeds the maximum size of 1024 bytes");
+    }
+
     @Test
     void should_handle_responses_from_supplied_client_on_configured_executor() throws Exception {
         ExecutorService executor = Executors.newSingleThreadExecutor(task -> new Thread(task, "mcp-test-executor"));
```

**File**: `langchain4j-mcp/src/test/java/dev/langchain4j/mcp/client/transport/http/McpResponseParserTest.java` (modified, +48/-2)
```diff
@@ -11,6 +11,7 @@
 import java.io.InputStream;
 import java.nio.ByteBuffer;
 import java.util.ArrayList;
+import java.util.Arrays;
 import java.util.List;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.params.ParameterizedTest;
@@ -119,14 +120,59 @@ void incremental_handles_direct_buffers_and_large_unterminated_lines() {
         String body = "x".repeat(100_000) + "🦋";
         byte[] bytes = body.getBytes(UTF_8);
         var incremental = parser.incremental();
+        List<ServerSentEvent> actual = new ArrayList<>();
         for (int offset = 0; offset < bytes.length; offset += 31) {
             var chunk = ByteBuffer.allocateDirect(Math.min(31, bytes.length - offset));
             chunk.put(bytes, offset, chunk.capacity()).flip();
-            assertThat(incremental.feed(chunk)).isEmpty();
+            actual.addAll(incremental.feed(chunk));
             assertThat(chunk.hasRemaining()).isFalse();
         }
+        actual.addAll(incremental.flush());
+
+        assertThat(actual).hasSize(2);
+        assertThat(((McpResponseParser.Line) actual.get(0)).partial()).isTrue();
+        assertThat(((McpResponseParser.Line) actual.get(1)).partial()).isFalse();
+        assertThat(reconstruct(actual)).isEqualTo(body);
+    }
 
-        assertThat(incremental.flush()).extracting(ServerSentEvent::data).containsExactly(body);
+    @Test
+    void splits_long_lines_into_bounded_fragments_at_character_boundaries() {
+        int max = McpResponseParser.MAX_LINE_FRAGMENT_BYTES;
+        // two-byte characters, offset by one byte so that a fragment cannot end exactly at the limit
+        String line = "x" + "ž".repeat(max * 2);
+        String body = line + "\nnext\n";
+
+        List<ServerSentEvent> lines = parse(body);
+
+        assertThat(reconstruct(lines)).isEqualTo(body);
+        assertThat(lines).allSatisfy(event -> {
+            var fragment = (McpResponseParser.Line) event;
+            assertThat(fragment.byteLength()).isEqualTo(fragment.data().getBytes(UTF_8).length);
+            assertThat(fragment.byteLength()).isLessThanOrEqualTo(max + 3);
+        });
+        assertThat(lines)
+                .extracting(event -> ((McpResponseParser.Line) event).partial())
+                .containsExactly(true, true, true, false, false);
+        assertThat(lines).extracting(ServerSentEvent::data).last().isEqualTo("next");
+    }
+
+    @Test
+    void bounds_fragments_of_invalid_utf8() {
+        byte[] bytes = new byte[McpResponseParser.MAX_LINE_FRAGMENT_BYTES * 3];
+        Arrays.fill(bytes, (byte) 0x80);
+        var incremental = parser.incremental();
+
+        List<ServerSentEvent> lines = new ArrayList<>(incremental.feed(ByteBuffer.wrap(bytes)));
+        lines.addAll(incremental.flush());
+
+        assertThat(lines).hasSizeGreaterThan(1);
+        assertThat(lines)
+                .allSatisfy(event -> assertThat(((McpResponseParser.Line) event).byteLength())
+                        .isLessThanOrEqualTo(McpResponseParser.MAX_LINE_FRAGMENT_BYTES + 3));
+        assertThat(lines.stream()
+                        .mapToInt(event -> ((McpResponseParser.Line) event).byteLength())
+                        .sum())
+                .isEqualTo(bytes.length);
     }
 
     @Test
```

---

### Incident Patch 2: `2635ca0a` (2026-11-02)
**Commit Message**: fix(agentic): honor @Agent(optional = true) on non-AI agents (#6924)

## Issue

Fixes #6921

## Change

`@Agent(optional = true)` was only wired for AI agents:
`AgentUtil.nonAiAgentToExecutor` never read `annotation.optional()`, and
`NonAiAgentInstance` had no `optional` field, so a non-AI agent declared
`optional = true` still failed the whole agentic system with
`MissingArgumentException` when one of its arguments was missing from
the scope, instead of being silently skipped.

The skip machinery in `AgentExecutor.internalExecute` is already shared
by both kinds of agents, so this change only carries the flag from the
`@Agent` annotation into `NonAiAgentInstance`: a new `optional` field
with an `optional()` override, a constructor overload that takes it (the
existing constructors default to `false`), and the flag threaded through
the `AgentUtil.nonAiAgentInvoker` overloads. The `@HumanInTheLoop`
creation path passes `false` explicitly, matching its annotation, which
has no `optional` attribute.

Out of scope: the programmatic `AgentSpecsProvider` and
`AgenticScopeFunction` APIs cannot declare an agent optional (they
expose no `optional()` accessor); only the `@Agent` annotation pa

**File**: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/AgenticServices.java` (modified, +9/-7)
```diff
@@ -322,7 +322,7 @@ public static A2AClientBuilder<UntypedAgent> a2aBuilder(String a2aServerUrl, Str
      * @return a new A2AClientBuilder instance
      */
     public static <T> A2AClientBuilder<T> a2aBuilder(String a2aServerUrl, Class<T> agentServiceClass) {
-        return A2AService.get().a2aBuilder(a2aServerUrl,null, agentServiceClass);
+        return A2AService.get().a2aBuilder(a2aServerUrl, null, agentServiceClass);
     }
 
     /**
@@ -874,10 +874,12 @@ private static AgentExecutor createA2AClientAgent(Class<?> agentServiceClass, Me
 
     private static AgentExecutor createRegistryAgent(Class<?> agentServiceClass, Method registryMethod) {
         if (activationCondition(agentServiceClass) != null) {
-            throw new AgenticSystemConfigurationException("An @ActivationCondition is not supported on the @RegistryAgent "
-                    + agentServiceClass.getName() + ", because its agent is taken already built from the registry. "
-                    + "Set the activation condition when building the agent registered as '"
-                    + registryMethod.getAnnotation(RegistryAgent.class).value() + "'.");
+            throw new AgenticSystemConfigurationException(
+                    "An @ActivationCondition is not supported on the @RegistryAgent "
+                            + agentServiceClass.getName()
+                            + ", because its agent is taken already built from the registry. "
+                            + "Set the activation condition when building the agent registered as '"
+                            + registryMethod.getAnnotation(RegistryAgent.class).value() + "'.");
         }
         String registryName = registryMethod.getAnnotation(RegistryAgent.class).value();
         AgentInstance agent = AgentsRegistry.get().getAgent(registryName);
@@ -943,8 +945,7 @@ private static AgentExecutor createMcpClientAgent(Class<?> agentServiceClass, Me
         var mcpAgent = mcpMethod.getAnnotation(McpClientAgent.class);
 
         Object mcpClient = selectMethod(
-                        agentServiceClass,
-                        method -> method.isAnnotationPresent(McpClientSupplier.class))
+                        agentServiceClass, method -> method.isAnnotationPresent(McpClientSupplier.class))
                 .map(method -> {
                     checkReturnType(method, Object.class);
                     return invokeSupplierWithResolvers(agentServiceClass, method, Object.class);
@@ -1008,6 +1009,7 @@ private static AgentExecutor createHumanInTheLoopAgent(Class<?> agentServiceClas
                 humanInTheLoop.description(),
                 humanInTheLoop.outputKey(),
                 humanInTheLoop.async(),
+                false,
                 activationCondition(agentServiceClass));
         return new AgentExecutor(agentInvoker, humanInTheLoopBuilder.build());
     }
```

**File**: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/internal/AgentUtil.java` (modified, +17/-3)
```diff
@@ -139,11 +139,19 @@ public static AgentExecutor nonAiAgentToExecutor(Object agent, Method agenticMet
         String description = isNullOrBlank(annotation.description()) ? annotation.value() : annotation.description();
         String outputKey = AgentUtil.outputKey(annotation.outputKey(), annotation.typedOutputKey());
         return new AgentExecutor(
-                nonAiAgentInvoker(agent, agenticMethod, name, description, outputKey, annotation.async()), agent);
+                nonAiAgentInvoker(
+                        agent, agenticMethod, name, description, outputKey, annotation.async(), annotation.optional()),
+                agent);
     }
 
     private static AgentInvoker nonAiAgentInvoker(
-            Object agent, Method agenticMethod, String name, String description, String outputKey, boolean async) {
+            Object agent,
+            Method agenticMethod,
+            String name,
+            String description,
+            String outputKey,
+            boolean async,
+            boolean optional) {
         if (agent instanceof AgentSpecsProvider spec) {
             return AgentInvoker.fromSpec(spec, agenticMethod, name);
         }
@@ -156,6 +164,7 @@ private static AgentInvoker nonAiAgentInvoker(
                     description,
                     outputKey,
                     async,
+                    optional,
                     DeclarativeUtil.activationCondition(agentClass));
         }
         // the parameters of an agent passed as an instance are not provided by a SupplierParameterResolver
@@ -165,12 +174,13 @@ private static AgentInvoker nonAiAgentInvoker(
                 description,
                 outputKey,
                 async,
+                optional,
                 DeclarativeUtil.activationCondition(agent.getClass()));
     }
 
     public static AgentInvoker nonAiAgentInvoker(
             Method agenticMethod, String name, String description, String outputKey, boolean async) {
-        return nonAiAgentInvoker(agenticMethod, name, description, outputKey, async, null);
+        return nonAiAgentInvoker(agenticMethod, name, description, outputKey, async, false, null);
     }
 
     public static AgentInvoker nonAiAgentInvoker(
@@ -179,6 +189,7 @@ public static AgentInvoker nonAiAgentInvoker(
             String description,
             String outputKey,
             boolean async,
+            boolean optional,
             AgentCondition activationCondition) {
         return AgentInvoker.fromMethod(
                 new NonAiAgentInstance(
@@ -188,6 +199,7 @@ public static AgentInvoker nonAiAgentInvoker(
                         agenticMethod.getGenericReturnType(),
                         outputKey,
                         async,
+                        optional,
                         argumentsFromMethod(agenticMethod),
                         null,
                         activationCondition),
@@ -205,6 +217,7 @@ public static AgentInvoker nonAiAgentInvoker(
             String description,
             String outputKey,
             boolean async,
+            boolean optional,
             AgentCondition activationCondition) {
         Method agenticMethod = parameters.method();
         NonAiAgentInstance agentInstance = new NonAiAgentInstance(
@@ -214,6 +227,7 @@ public static AgentInvoker nonAiAgentInvoker(
                 agenticMethod.getGenericReturnType(),
                 outputKey,
                 async,
+                optional,
                 parameters.frameworkArguments(),
                 null,
                 activationCondition);
```

**File**: `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/internal/NonAiAgentInstance.java` (modified, +82/-32)
```diff
@@ -1,5 +1,7 @@
 package dev.langchain4j.agentic.internal;
 
+import static dev.langchain4j.agentic.observability.ComposedAgentListener.composeWithInherited;
+
 import dev.langchain4j.agentic.observability.AgentListener;
 import dev.langchain4j.agentic.observability.ComposedAgentListener;
 import dev.langchain4j.agentic.planner.AgentArgument;
@@ -12,15 +14,14 @@
 import java.util.List;
 import java.util.Objects;
 
-import static dev.langchain4j.agentic.observability.ComposedAgentListener.composeWithInherited;
-
 public class NonAiAgentInstance implements AgentInstance, InternalAgent {
     private final Class<?> type;
     private final String name;
     private final String description;
     private final Type outputType;
     private final String outputKey;
     private final boolean async;
+    private final boolean optional;
     private final List<AgentArgument> arguments;
     private final AgentCondition activationCondition;
 
@@ -29,22 +30,50 @@ public class NonAiAgentInstance implements AgentInstance, InternalAgent {
     private InternalAgent parent;
     private String agentId;
 
-    public NonAiAgentInstance(Class<?> type, String name, String description,
-            Type outputType, String outputKey, boolean async, List<AgentArgument> arguments,
+    public NonAiAgentInstance(
+            Class<?> type,
+            String name,
+            String description,
+            Type outputType,
+            String outputKey,
+            boolean async,
+            List<AgentArgument> arguments,
             AgentListener listener) {
-        this(type, name, description, outputType, outputKey, async, arguments, listener, null);
-    }
-
-    public NonAiAgentInstance(Class<?> type, String name, String description,
-            Type outputType, String outputKey, boolean async, List<AgentArgument> arguments,
-            AgentListener listener, AgentCondition activationCondition) {
+        this(type, name, description, outputType, outputKey, async, false, arguments, listener, null);
+    }
+
+    public NonAiAgentInstance(
+            Class<?> type,
+            String name,
+            String description,
+            Type outputType,
+            String outputKey,
+            boolean async,
+            List<AgentArgument> arguments,
+            AgentListener listener,
+            AgentCondition activationCondition) {
+        this(type, name, description, outputType, outputKey, async, false, arguments, listener, activationCondition);
+    }
+
+    public NonAiAgentInstance(
+            Class<?> type,
+            String name,
+            String description,
+            Type outputType,
+            String outputKey,
+            boolean async,
+            boolean optional,
+            List<AgentArgument> arguments,
+            AgentListener listener,
+            AgentCondition activationCondition) {
         this.type = type;
         this.name = name;
         this.agentId = name;
         this.description = description;
         this.outputType = outputType;
         this.outputKey = outputKey;
         this.async = async;
+        this.optional = optional;
         this.arguments = arguments;
         this.listener = listener;
         this.activationCondition = activationCondition;
@@ -67,7 +96,9 @@ public List<AgentInstance> subagents() {
 
     @Override
     public AgenticSystemTopology topology() {
-        return type == HumanInTheLoop.class ? AgenticSystemTopology.HUMAN_IN_THE_LOOP : AgenticSystemTopology.NON_AI_AGENT;
+        return type == HumanInTheLoop.class
+                ? AgenticSystemTopology.HUMAN_IN_THE_LOOP
+                : AgenticSystemTopology.NON_AI_AGENT;
     }
 
     @Override
@@ -105,6 +136,11 @@ public boolean async() {
         return async;
     }
 
+    @Override
+    public boolean optional() {
+        return optional;
+    }
+
     @Override
     public List<AgentArgument> arguments() {
         return arguments;
@@ -122,7 +158,9 @@ public AgentListener listener() {
 
     @Override
     public void registerInheritedParentListener(AgentListener parentListener) {
-        if (parentListener != null && parentListener.inheritedBySubagents() && isNewListener(listener, parentListener)) {
+        if (parentListener != null
+                && parentListener.inheritedBySubagents()
+                && isNewListener(listener, parentListener)) {
             listener = composeWithInherited(listener(), parentListener);
         }
     }
@@ -142,34 +180,46 @@ public boolean equals(Object obj) {
         if (obj == this) return true;
         if (obj == null || obj.getClass() != this.getClass()) return false;
         var that = (NonAiAgentInstance) obj;
-        return Objects.equals(this.type, that.type) &&
-                Objects.equals(this.name, that.name) &&
-                Objects.equals(this.description, that.description) &&
-                Objects.equals(this.outputType, that.outputType) &&
-                Objects.equals(this.outputKey, tha
```

**File**: `langchain4j-agentic/src/test/java/dev/langchain4j/agentic/NonAiOptionalAgentTest.java` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+package dev.langchain4j.agentic;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+
+import dev.langchain4j.agentic.agent.MissingArgumentException;
+import dev.langchain4j.agentic.declarative.SequenceAgent;
+import dev.langchain4j.agentic.scope.ResultWithAgenticScope;
+import dev.langchain4j.service.V;
+import java.util.Map;
+import java.util.concurrent.atomic.AtomicInteger;
+import org.junit.jupiter.api.BeforeEach;
+import org.junit.jupiter.api.Test;
+
+/**
+ * The {@code optional} attribute of {@code @Agent} is honored for non-AI agents: when one of its
+ * arguments is missing from the agentic scope, the agent is skipped instead of failing the whole
+ * agentic system.
+ */
+class NonAiOptionalAgentTest {
+
+    static final AtomicInteger FIX_INVOCATIONS = new AtomicInteger();
+
+    public static class Analyzer {
+
+        @Agent(description = "Analyzes the request", outputKey = "analysis")
+        public static String analyze(@V("request") String request) {
+            return "analysis of " + request;
+        }
+    }
+
+    public static class FixDelegator {
+
+        @Agent(description = "Delegates the fix to a remote service", outputKey = "fix", optional = true)
+        public static String applyFix(@V("repoUrl") String repoUrl) {
+            FIX_INVOCATIONS.incrementAndGet();
+            return "fixed " + repoUrl;
+        }
+    }
+
+    public static class MandatoryFixDelegator {
+
+        @Agent(description = "Delegates the fix to a remote service", outputKey = "fix")
+        public static String applyFix(@V("repoUrl") String repoUrl) {
+            FIX_INVOCATIONS.incrementAndGet();
+            return "fixed " + repoUrl;
+        }
+    }
+
+    public interface Pipeline {
+
+        @SequenceAgent(
+                outputKey = "analysis",
+                subAgents = {Analyzer.class, FixDelegator.class})
+        ResultWithAgenticScope<String> process(@V("request") String request);
+    }
+
+    @BeforeEach
+    void resetInvocations() {
+        FIX_INVOCATIONS.set(0);
+    }
+
+    @Test
+    void optional_non_ai_agent_is_skipped_when_its_argument_is_missing() {
+        UntypedAgent workflow = AgenticServices.sequenceBuilder()
+                .subAgents(Analyzer.class, FixDelegator.class)
+                .outputKey("analysis")
+                .build();
+
+        assertThat(workflow.invoke(Map.of("request", "the request"))).isEqualTo("analysis of the request");
+        assertThat(FIX_INVOCATIONS).hasValue(0);
+    }
+
+    @Test
+    void optional_non_ai_agent_runs_when_its_argument_is_present() {
+        UntypedAgent workflow = AgenticServices.sequenceBuilder()
+                .subAgents(Analyzer.class, FixDelegator.class)
+                .outputKey("fix")
+                .build();
+
+        assertThat(workflow.invoke(Map.of("request", "the request", "repoUrl", "http://repo")))
+                .isEqualTo("fixed http://repo");
+        assertThat(FIX_INVOCATIONS).hasValue(1);
+    }
+
+    @Test
+    void non_optional_non_ai_agent_fails_when_its_argument_is_missing() {
+        UntypedAgent workflow = AgenticServices.sequenceBuilder()
+                .subAgents(Analyzer.class, MandatoryFixDelegator.class)
+                .outputKey("analysis")
+                .build();
+
+        assertThat(assertThrows(
+                        MissingArgumentException.class, () -> workflow.invoke(Map.of("request", "the request"))))
+                .hasMessageContaining("repoUrl");
+    }
+
+    @Test
+    void declarative_optional_non_ai_agent_is_skipped_in_a_sequence() {
+        Pipeline pipeline = AgenticServices.createAgenticSystem(Pipeline.class);
+
+        ResultWithAgenticScope<String> result = pipeline.process("the request");
+
+        assertThat(result.result()).isEqualTo("analysis of the request");
+        assertThat(result.agenticScope().readState("fix")).isNull();
+        assertThat(result.agenticScope().readState("analysis")).isEqualTo("analysis of the request");
+        assertThat(FIX_INVOCATIONS).hasValue(0);
+    }
+}
```

---

### Incident Patch 3: `ee159440` (2026-11-03)
**Commit Message**: fix(deps): update dependency com.google.code.gson:gson to v2.15.0 (#6949)

This PR contains the following updates:

| Package | Change |
[Age](https://docs.renovatebot.com/merge-confidence/) |
[Confidence](https://docs.renovatebot.com/merge-confidence/) |
|---|---|---|---|
| [com.google.code.gson:gson](https://redirect.github.com/google/gson) |
`2.14.0` → `2.15.0` |
![age](https://developer.mend.io/api/mc/badges/age/maven/com.google.code.gson:gson/2.15.0?slim=true)
|
![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.google.code.gson:gson/2.14.0/2.15.0?slim=true)
|

---

> [!WARNING]
> Some dependencies could not be looked up. Check the [Dependency
Dashboard](../issues/2069) for more information.

---

### Configuration

📅 **Schedule**: (UTC)

- Branch creation
  - At any time (no schedule defined)
- Automerge
  - At any time (no schedule defined)

🚦 **Automerge**: Disabled by config. Please merge this manually once you
are satisfied.

♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the
rebase/retry checkbox.

🔕 **Ignore**: Close this PR and you won't be reminded about this update
again.

---

- [ ] <!-- rebase-check -->If you want to rebase/r

**File**: `langchain4j-agentic-a2a/pom.xml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@
             <dependency>
                 <groupId>com.google.code.gson</groupId>
                 <artifactId>gson</artifactId>
-                <version>2.14.0</version>
+                <version>2.15.0</version>
             </dependency>
             <dependency>
                 <groupId>com.google.errorprone</groupId>
```

#### Recent Merged Pull Requests:
- **PR #6959** (2026-11-03): Add ScoringModelListener to observe scoring (re-ranking) model calls (@dliubarskyi)
- **PR #6954** (2026-11-03): fix(mcp): limit the size of messages received by the Streamable HTTP and WebSocket transports (@jmartisk)
- **PR #6949** (2026-11-03): fix(deps): update dependency com.google.code.gson:gson to v2.15.0 (@renovate[bot])
- **PR #6945** (2026-11-02): pgvector: reject `java.util.Date` and `java.sql.Timestamp` filter values with a clear message (@dliubarskyi)
- **PR #6944** (2026-11-03): chore(deps): update dependency com.diffplug.spotless:spotless-maven-plugin to v2.46.1 (@renovate[bot])
- **PR #6943** (2026-11-03): fix(deps): update dependency com.couchbase.client:java-client to v3.13.0 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. mcp): limit the size of messages received by the Streamable HTTP and WebSocket t

**RULE**:
When implementing operations in `docs/docs/tutorials/mcp.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in langchain4j/langchain4j. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5ce59cd7`: mcp): limit the size of messages received by the Streamable HTTP and WebSocket transports (#6954). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/docs/tutorials/mcp.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
**_NOTE:_** A single message received from the server can be at most 20 MiB by default: the data of one event
on an SSE stream (in a response or on the subsidiary channel), or the whole body of any other response, such as
a JSON response. If the server sends a larger message, the transport closes the stream and drops the message:
the pending request fails, and the subsidiary channel reconnects. This keeps a misbehaving server from filling
the client's memory. The size is that of the JSON text, so binary content such as images, which is base64-encoded,
takes about a third more than its raw size. To change the limit, set it on the builder, for example
`.maxMessageSize(50 * 1024 * 1024)` for 50 MiB.

**_NOTE:_** As with the Streamable HTTP transport, a single message received from the server can be at most
20 MiB by default. If the server sends a larger message, the transport closes the connection and all pending
requests fail. To change the limit, set it on the builder, for example `.maxMessageSize(50 * 1024 * 1024)` for 50 MiB.

```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5ce59cd7` are properly handled with clean fallback behavior.
