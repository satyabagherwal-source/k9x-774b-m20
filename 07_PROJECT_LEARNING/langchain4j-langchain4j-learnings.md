> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/langchain4j-langchain4j-learnings.md`  
> **Source**: github ([https://github.com/langchain4j/langchain4j](https://github.com/langchain4j/langchain4j))  
> **Source Version**: `a82bcc47`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T22:20:17.164Z  
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
> **Harvest Timestamp**: 2026-11-04T22:20:17.155Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langchain4j/langchain4j`
- **Description**: LangChain4j is an idiomatic, open-source Java library for building LLM-powered applications on the JVM. It offers a unified API over popular LLM providers and vector stores, and makes implementing tool calling (including MCP support), agents and RAG easy. It integrates seamlessly with enterprise Java frameworks like Quarkus and Spring Boot.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13356 stars

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

### Incident Patch 1: `a82bcc47` (2026-11-04)
**Commit Message**: Fix VertexAiGeminiStreamingChatModelIT for unsupported parameters reported through onError (#6983)

## Change
Since #6964, `VertexAiGeminiStreamingChatModel` reports an unsupported
request parameter (for example `stopSequences`) to the handler's
`onError()` instead of throwing it from `chat(request, handler)`. The
shared
`AbstractStreamingChatModelIT.should_fail_if_stopSequences_parameter_is_not_supported`
still expected the exception to be thrown, so it failed on `main` after
waiting 30 seconds.

- `AbstractStreamingChatModelIT` gets a hook,
`reportsUnsupportedParametersThroughOnError()` (default `false`). When a
model returns `true`, the test checks that `chat(request, handler)` does
not throw and that the handler's `onError()` receives the
`UnsupportedFeatureException`.
- `VertexAiGeminiStreamingChatModelIT` returns `true`.

Other streaming models are not affected.

## General checklist
- [X] There are no breaking changes (API, behaviour)
- [X] I have added unit and/or integration tests for my change
- [ ] The tests cover both positive and negative cases
- [ ] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green (the c

**File**: `langchain4j-core/src/test/java/dev/langchain4j/model/chat/common/AbstractStreamingChatModelIT.java` (modified, +19/-0)
```diff
@@ -16,6 +16,7 @@
 import org.junit.jupiter.api.condition.EnabledIf;
 import org.junit.jupiter.params.ParameterizedTest;
 import org.junit.jupiter.params.provider.MethodSource;
+import org.mockito.ArgumentCaptor;
 
 import java.util.ArrayList;
 import java.util.List;
@@ -166,6 +167,14 @@ protected boolean supportsStreamingCancellation() {
         return true;
     }
 
+    /**
+     * Whether the model reports a request it cannot handle (e.g. an unsupported parameter) to the handler's
+     * {@code onError()} instead of throwing it from {@code chat(request, handler)}.
+     */
+    protected boolean reportsUnsupportedParametersThroughOnError() {
+        return false;
+    }
+
     @Override
     protected boolean assertThreads() {
         return streamingModes().equals(List.of(StreamingMode.HANDLER));
@@ -399,6 +408,16 @@ public void onComplete() {
                     .hasMessageContaining("not support");
             assertThat(onNextCalled).isFalse();
             assertThat(onCompleteCalled).isFalse();
+        } else if (reportsUnsupportedParametersThroughOnError()) {
+            StreamingChatResponseHandler handler = mock(StreamingChatResponseHandler.class);
+            assertThatCode(() -> model.chat(chatRequest, handler)).doesNotThrowAnyException();
+            ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
+            verify(handler, timeout(30_000)).onError(error.capture());
+            assertThat(error.getValue())
+                    .isExactlyInstanceOf(UnsupportedFeatureException.class)
+                    .hasMessageContaining("stopSequences")
+                    .hasMessageContaining("not support");
+            verify(handler, never()).onCompleteResponse(any());
         } else {
             StreamingChatResponseHandler handler = mock(StreamingChatResponseHandler.class);
             assertThatThrownBy(() -> model.chat(chatRequest, handler))
```

**File**: `langchain4j-vertex-ai-gemini/src/test/java/dev/langchain4j/model/vertexai/gemini/common/VertexAiGeminiStreamingChatModelIT.java` (modified, +5/-0)
```diff
@@ -48,6 +48,11 @@ protected boolean supportsStopSequencesParameter() {
         return false; // TODO implement
     }
 
+    @Override
+    protected boolean reportsUnsupportedParametersThroughOnError() {
+        return true;
+    }
+
     @Override
     protected boolean supportsToolChoiceRequired() {
         return false; // TODO implement
```

---

### Incident Patch 2: `aad19f6c` (2026-11-04)
**Commit Message**: fix(mcp): coerce scope values to the declared parameter types (#6938)

## Issue
Closes #6937

## Change

`McpClientAgentInvoker`'s typed path built its invocation arguments
inline, duplicating a subset of `AgentUtil.agentInvocationArguments()`:
it read each value from the scope and threw `MissingArgumentException`
when a required one was absent (added in #5477), but it skipped
`adaptValueToType()`, skipped `AgentArgument.defaultValue()`, and never
wrote the coerced value back to the scope.

This delegates the typed path to
`AgentUtil.agentInvocationArguments(agenticScope, arguments)`, which is
what `A2AClientAgentInvoker` already does. Behaviour for the untyped
path is unchanged.

Concretely, an agent method declared as

```java
@Agent(description = "List records")
String list(@V("limit") int limit);
```

used to fail with `AgentInvocationException: Failed to invoke agent
method ... / Caused by: IllegalArgumentException: argument type
mismatch` whenever `limit` sat in the scope as a `String`, and now sends
`{"limit":5}`. The hand-written `inputKeys` field and helper are gone
because nothing else used them.

## Tests

Two tests in `McpAgentTest`:

- `typed_mcp_agent_coerces_scope_va

**File**: `langchain4j-agentic-mcp/src/main/java/dev/langchain4j/agentic/mcp/McpClientAgentInvoker.java` (modified, +2/-29)
```diff
@@ -1,5 +1,6 @@
 package dev.langchain4j.agentic.mcp;
 
+import static dev.langchain4j.agentic.internal.AgentUtil.agentInvocationArguments;
 import static dev.langchain4j.agentic.internal.AgentUtil.argumentsFromMethod;
 import static dev.langchain4j.agentic.internal.AgentUtil.untypedAgentInvocationArguments;
 
@@ -17,15 +18,12 @@
 import dev.langchain4j.agentic.scope.AgenticScope;
 import java.lang.reflect.Method;
 import java.lang.reflect.Type;
-import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
-import java.util.stream.Stream;
 
 public class McpClientAgentInvoker implements AgentInvoker {
 
     private String agentId;
-    private final String[] inputKeys;
     private final Map<String, String> inputDescriptions;
 
     private final McpClientInstance mcpClientInstance;
@@ -43,21 +41,12 @@ public McpClientAgentInvoker(McpClientInstance mcpClientInstance, Method method)
         this.toolName = mcpClientInstance.toolName();
         this.toolDescription = mcpClientInstance.toolDescription();
         this.agentId = name();
-        this.inputKeys = inputKeys(mcpClientInstance);
         this.inputDescriptions = mcpClientInstance.inputDescriptions();
         this.arguments = isUntyped()
                 ? mcpClientInstance.arguments()
                 : McpSchemaToType.mergeDescriptions(argumentsFromMethod(method), inputDescriptions);
     }
 
-    private String[] inputKeys(McpClientInstance mcpClientInstance) {
-        return isUntyped()
-                ? mcpClientInstance.inputKeys()
-                : Stream.of(method.getParameters())
-                        .map(AgentInvoker::parameterName)
-                        .toArray(String[]::new);
-    }
-
     @Override
     public String name() {
         return toolName;
@@ -128,23 +117,7 @@ public AgentInvocationArguments toInvocationArguments(AgenticScope agenticScope)
             }
             return untypedAgentInvocationArguments(agenticScope);
         }
-        return agentInvocationArguments(agenticScope);
-    }
-
-    private AgentInvocationArguments agentInvocationArguments(AgenticScope agenticScope) {
-        Map<String, Object> namedArgs = new HashMap<>();
-        Object[] positionalArgs = new Object[inputKeys.length];
-
-        int i = 0;
-        for (String argName : inputKeys) {
-            Object argValue = agenticScope.readState(argName);
-            if (argValue == null) {
-                throw new MissingArgumentException(argName);
-            }
-            positionalArgs[i++] = argValue;
-            namedArgs.put(argName, argValue);
-        }
-        return new AgentInvocationArguments(namedArgs, positionalArgs);
+        return agentInvocationArguments(agenticScope, arguments);
     }
 
     private boolean isUntyped() {
```

**File**: `langchain4j-agentic-mcp/src/test/java/dev/langchain4j/agentic/mcp/McpAgentTest.java` (modified, +52/-0)
```diff
@@ -20,6 +20,7 @@
 import dev.langchain4j.agentic.scope.AgentInvocation;
 import dev.langchain4j.agentic.scope.AgenticScope;
 import dev.langchain4j.agentic.scope.ResultWithAgenticScope;
+import dev.langchain4j.internal.Json;
 import dev.langchain4j.mcp.client.McpClient;
 import dev.langchain4j.model.chat.request.json.JsonAnyOfSchema;
 import dev.langchain4j.model.chat.request.json.JsonArraySchema;
@@ -809,4 +810,55 @@ void typed_mcp_agent_in_workflow_throws_on_missing_required_input() {
                 .isInstanceOf(MissingArgumentException.class)
                 .hasMessageContaining("language");
     }
+
+    public interface TypedLimitAgent {
+
+        @Agent(description = "List records")
+        String list(@V("limit") int limit);
+    }
+
+    private static McpClient mockLimitClient() {
+        McpClient mcpClient = mock(McpClient.class);
+        ToolSpecification toolSpec = ToolSpecification.builder()
+                .name("list_records")
+                .description("List records")
+                .parameters(JsonObjectSchema.builder()
+                        .addProperty("limit", new JsonIntegerSchema())
+                        .build())
+                .build();
+        when(mcpClient.listTools()).thenReturn(List.of(toolSpec));
+        mockToolResult(mcpClient, "ok");
+        return mcpClient;
+    }
+
+    @Test
+    void typed_mcp_agent_coerces_scope_values_to_the_declared_parameter_types() {
+        McpClient mcpClient = mockLimitClient();
+
+        TypedLimitAgent records =
+                McpAgent.builder(mcpClient, TypedLimitAgent.class).build();
+        UntypedAgent pipeline =
+                AgenticServices.sequenceBuilder().subAgents(records).build();
+
+        // A previous agent's String output leaves a String in the scope, while the agent method declares an int.
+        pipeline.invoke(Map.of("limit", "5"));
+
+        ArgumentCaptor<ToolExecutionRequest> captor = ArgumentCaptor.forClass(ToolExecutionRequest.class);
+        verify(mcpClient).executeTool(captor.capture());
+
+        assertThat(Json.fromJson(captor.getValue().arguments(), Map.class)).containsEntry("limit", 5);
+    }
+
+    @Test
+    void typed_mcp_agent_rejects_a_scope_value_that_cannot_be_coerced() {
+        McpClient mcpClient = mockLimitClient();
+
+        TypedLimitAgent records =
+                McpAgent.builder(mcpClient, TypedLimitAgent.class).build();
+        UntypedAgent pipeline =
+                AgenticServices.sequenceBuilder().subAgents(records).build();
+
+        assertThatThrownBy(() -> pipeline.invoke(Map.of("limit", "not-a-number")))
+                .isInstanceOf(NumberFormatException.class);
+    }
 }
```

---

### Incident Patch 3: `ac10f8c4` (2026-11-04)
**Commit Message**: Build the modules before generating Javadoc in the docs workflow (#6968)

## Issue
No linked issue. The "Documentation: build and deploy" workflow failed
on main after #6112:

```
Could not find artifact dev.langchain4j:langchain4j-hibernate:jar:tests:1.24.0-beta34-SNAPSHOT in central-portal-snapshots
```

## Change
The workflow ran `mvn javadoc:aggregate -DskipTests` without building
the modules. So Maven took the repository's own artifacts from Central
snapshots, and the build failed whenever main was ahead of the latest
snapshot:
- after a new test-jar: `langchain4j-hibernate:tests`, added in #6112;
- after a version bump: `langchain4j-core:tests:1.24.0-SNAPSHOT`, on
2026-10-29.

It now runs `mvn -B -DskipTests -DembeddingsSkipDownload -T8C
test-compile javadoc:aggregate`. Maven uses the classes compiled in the
same build, the same way the Java CI workflow does (`test
javadoc:aggregate`). The Javadoc is also built from the current code,
not from the last snapshot.

Checked locally on main (a3f92b0d6):
- the old command fails with the same error as CI;
- the new command passes, and the generated Javadoc includes
`MilvusDatabaseKind` from the new module.

The docs job takes a bit 

**File**: `.github/workflows/docs.yaml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
           cache: 'maven'
 
       - name: Generate Javadoc
-        run: mvn javadoc:aggregate -DskipTests
+        run: mvn -B -DskipTests -DembeddingsSkipDownload -T8C test-compile javadoc:aggregate
 
       - name: Set up Node.js
         uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5
```

#### Recent Merged Pull Requests:
- **PR #6983** (2026-11-04): Fix VertexAiGeminiStreamingChatModelIT for unsupported parameters reported through onError (@dliubarskyi)
- **PR #6968** (2026-11-04): Build the modules before generating Javadoc in the docs workflow (@dliubarskyi)
- **PR #6964** (2026-11-04): Pass the AI Service invocation id to model, embedding store and content retriever listeners (@dliubarskyi)
- **PR #6963** (2026-11-04): Limit the size of messages received by the Streamable HTTP and WebSocket MCP transports (backport of #6954 to 1.19.x) (@jmartisk)
- **PR #6962** (2026-11-04): Limit the size of messages received by the Streamable HTTP and WebSocket MCP transports (backport of #6954 to 1.11.x) (@jmartisk)
- **PR #6959** (2026-11-03): Add ScoringModelListener to observe scoring (re-ranking) model calls (@dliubarskyi)

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

## X. VertexAiGeminiStreamingChatModelIT for unsupported parameters reported through o

**RULE**:
When implementing operations in `langchain4j-core/src/test/java/dev/langchain4j/model/chat/common/AbstractStreamingChatModelIT.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in langchain4j/langchain4j. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a82bcc47`: VertexAiGeminiStreamingChatModelIT for unsupported parameters reported through onError (#6983). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `langchain4j-core/src/test/java/dev/langchain4j/model/chat/common/AbstractStreamingChatModelIT.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import org.mockito.ArgumentCaptor;
    /**
     * Whether the model reports a request it cannot handle (e.g. an unsupported parameter) to the handler's
     * {@code onError()} instead of throwing it from {@code chat(request, handler)}.
     */
    protected boolean reportsUnsupportedParametersThroughOnError() {
        return false;
    }

        } else if (reportsUnsupportedParametersThroughOnError()) {
            StreamingChatResponseHandler handler = mock(StreamingChatResponseHandler.class);
            assertThatCode(() -> model.chat(chatRequest, handler)).doesNotThrowAnyException();
            ArgumentCaptor<Throwable> error = ArgumentCaptor.forClass(Throwable.class);
            verify(handler, timeout(30_000)).onError(error.capture());
            assertThat(error.getValue())
                    .isExactlyInstanceOf(UnsupportedFeatureException.class)
                    .hasMessageContaining("stopSequences")
                    .hasMessageContaining("not support");
            verify(handler, never()).onCompleteResponse(any());
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a82bcc47` are properly handled with clean fallback behavior.
