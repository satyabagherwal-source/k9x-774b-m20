# Forensic Learning Record (Deep Inspection): langchain4j/langchain4j

> **Canonical Artifact**: `07_PROJECT_LEARNING/langchain4j-langchain4j-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langchain4j/langchain4j](https://github.com/langchain4j/langchain4j))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:52:03.056Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langchain4j/langchain4j`
- **Description**: LangChain4j is an idiomatic, open-source Java library for building LLM-powered applications on the JVM. It offers a unified API over popular LLM providers and vector stores, and makes implementing tool calling (including MCP support), agents and RAG easy. It integrates seamlessly with enterprise Java frameworks like Quarkus and Spring Boot.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13204 stars

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
- **Issue #6574** (2026-10-05): **[BUG] ServiceHelper.loadFactories warns "ignoring" implementations that callers actually use**
  *Symptoms*: **Describe the bug** `ServiceHelper.loadFactories` now calls `warnIfAmbiguous` on every call ([L82-L83](https://github.com/langchain4j/langchain4j/blob/1.20.2/langchain4j-core/src/main/java/dev/langchain4j/spi/ServiceHelper.java#L82-L83), [L110-L123](https://github.com/langchain4j/langchain4j/blob/1.20.2/langchain4j-core/src/main/java/dev/langchain4j/spi/ServiceHelper.java#L110-L123)); it was added in #6184. The [Javadoc](https://github.com/langchain4j/langchain4j/blob/1.20.2/langchain4j-core/src/main/java/dev/langchain4j/spi/ServiceHelper.java#L87-L93) and [`PrioritizedFactory`](https://github.com/langchain4j/langchain4j/blob/1.20.2/langchain4j-core/src/main/java/dev/langchain4j/spi/PrioritizedFactory.java#L6-L8) both assume that *"every caller of this takes the first service and ignores the rest"*. But `loadFactories` returns a `Collection`, and several callers use all of it.  langchain4j itself: `DefaultAiServices` loads the adapter SPIs ([L103-L106](https://github.com/langchain4j/langchain4j/blob/1.20.2/langchain4j/src/main/java/dev/langchain4j/service/DefaultAiServices.java#L103-L106)): ```java private final Collection<TokenStreamAdapter> tokenStreamAdapters = loadFactories(TokenStreamAdapter.class); private final Collection<CompletableFutureAdapter> completableFutureAdapters =         loadFactories(CompletableFutureAdapter.class); private final Collection<PublisherAdapter> publisherAdapters = loadFactories(PublisherAdapter.class); ``` It then iterates over every one of 
  **Post-Mortem & Fix Analysis**:
  > @edeandrea thanks a lot for reporting!

- **Issue #6549** (2026-10-01): **[BUG] Tool enum argument coercion fails when LLM adds leading/trailing whitespace**
  *Symptoms*: # [BUG] Tool enum argument coercion fails when LLM adds leading/trailing whitespace  <!-- Please provide as many details as possible, this will help us to deliver a fix as soon as possible. Thank you! -->  **Describe the bug** `DefaultToolExecutor.coerceArgument` maps tool arguments to Java enums via `Enum.valueOf`, with an uppercase fallback. If the model returns an enum name with leading or trailing whitespace (e.g. `" Presentation"`), both attempts fail and tool execution throws `IllegalArgumentException: Argument "…" is not a valid enum value`, even though the trimmed value would match a constant.  **Log and Stack trace** ``` java.lang.IllegalArgumentException: Argument "type" is not a valid enum value for …: < Presentation> Caused by: java.lang.IllegalArgumentException: No enum constant …. PRESENTATION 	at java.lang.Enum.valueOf(…) 	at dev.langchain4j.service.tool.DefaultToolExecutor.coerceArgument(DefaultToolExecutor.java:…) ```  **To Reproduce** 1. AI Service with a `@Tool` method that takes an enum parameter. 2. Model returns that argument with surrounding spaces (e.g. `" A"` for enum constant `A`). 3. Tool execution fails in `coerceArgument` before the tool method runs.  ```java DefaultToolExecutor.coerceArgument(" A", "arg", ExampleEnum.class, null); // fails today; should resolve to ExampleEnum.A ```  **Expected behavior** Whitespace around the enum name is trimmed before `valueOf` / uppercase fallback, so `" A"`, `"A "`, and `" a "` coerce successfully when they m

- **Issue #6529** (2026-09-29): **[BUG] `StreamableHttpMcpTransport` registers the client's reply to a server ping as a pending operation**
  *Symptoms*: <!-- Please provide as many details as possible, this will help us to deliver a fix as soon as possible. Thank you! -->  **Describe the bug** <!-- A clear and concise description of what the bug is. --> `StreamableHttpMcpTransport.sendMessage` goes through the same execute method as sendRequest, and execute registers the message id in the pending-operations map whenever the id is not null. sendMessage is meant for messages that expect no reply, so nothing should be registered. Notifications have no id and are fine, but a reply to a server-initiated request carries an id - the server's. That reply is registered and never completed, because nothing is ever going to answer it. The two transports that share a single channel already avoid this: StdioMcpTransport passes a null id and WebSocketMcpTransport passes null as well. Only the Streamable HTTP transport registers. There are two consequences. The entry stays in the pending-operations map for the lifetime of the client. And since the client and the server number their requests independently, a server id can be equal to the id of a client request that is still in flight; the registration then overwrites that request's future, and the request can only end in a timeout.  **Log and Stack trace** <!-- Please provide a log and a stack trace (with exception), if applicable. -->  **To Reproduce** <!-- Please provide a relevant code snippets to reproduce this bug. --> Any server that sends a ping request to the client, which is a commo

- **Issue #6494** (2026-09-29): **[BUG] MCP x-mcp-header confuses dotted property names with nested paths**
  *Symptoms*: <!-- Please provide as many details as possible, this will help us to deliver a fix as soon as possible. Thank you! -->  **Describe the bug**  When an MCP tool parameter annotated with `x-mcp-header` contains a literal `.` in its JSON property name, LangChain4j treats the dot as a nested-property separator.  For example, a top-level property named `config.region` can be confused with a nested `config -> region` property during MCP parameter header lookup.  As a result, LangChain4j may send the wrong value in the corresponding `Mcp-Param-*` HTTP header.  **Log and Stack trace**  Not applicable. No exception or stack trace is produced; the incorrect header value is sent silently.  **To Reproduce**  Use an MCP tool schema containing both a literal dotted property and a nested property:  ```json {   "type": "object",   "properties": {     "config.region": {       "type": "string",       "x-mcp-header": "Region"     },     "config": {       "type": "object",       "properties": {         "region": {           "type": "string"         }       }     }   } } ```  Then execute the tool with arguments such as:  ```json {   "config.region": "literal",   "config": {     "region": "nested"   } } ```  The current implementation resolves the annotated property through a dot-separated property path. In this case, the `Mcp-Param-Region` header is populated with:  ```text nested ```  instead of the value of the literal top-level property:  ```text literal ```  This is reproducible on the curre

- **Issue #6493** (2026-09-24): **[BUG] `Mcp-Param` headers are not sent on the non-blocking and multi-round-trip tools/call paths**
  *Symptoms*: **Describe the bug**  Tool parameters marked with x-mcp-header are sent as Mcp-Param- HTTP headers only when a tool is executed through the blocking path (McpClient.executeTool). When the same tool is executed through the non-blocking path (McpClient.executeToolAsync, used by AI Services whose method returns a CompletableFuture or a reactive type), the headers are silently dropped.  The x-mcp-header support was added in #5881 , which built the header map only inside DefaultMcpClient.executeTool. The non-blocking path had been added earlier in #5527  and was not updated, so there the McpCallContext is created without the header map.  A related gap in the same feature: on a multi-round-trip retry (input_required), the retried tools/call also carries no headers, so even the blocking path sends them on the first attempt only. Impact: a server declares x-mcp-header so that a gateway or proxy can route or authorize the call without parsing the body. With the header missing, such calls are rejected or misrouted, while the request body looks perfectly correct — which makes it hard to diagnose.  **Log and Stack trace**  na  **To Reproduce**  Server tool definition:  ```json {   "name": "query_database",   "inputSchema": {     "type": "object",     "properties": {       "tenant": { "type": "string", "x-mcp-header": "X-Tenant-Id" },       "sql": { "type": "string" }     }   } } ```  Client:  ```java McpClient client = new DefaultMcpClient.Builder()         .transport(StreamableHttpMcpTr

- **Issue #6460** (2026-09-21): **[BUG] AgenticScopeSerializer cannot round-trip UserMessage stored directly in AgenticScope state**
  *Symptoms*: **Describe the bug**  `AgenticScopeSerializer` cannot deserialize an `AgenticScope` when a `UserMessage` is stored directly in the scope state.  Serialization succeeds, but the generated JSON contains:  ```json "type": "USER" ```  inside the serialized `UserMessage`.  During deserialization, Jackson uses `UserMessage.Builder`, which does not accept a `type` property, so `AgenticScopeSerializer.fromJson()` fails with an `UnrecognizedPropertyException`.  The issue is reproducible on a plain JVM, without Quarkus, persistence, or native-image.  A similar problem can also be reproduced when `TextContent` or `AiMessage` are stored directly as arbitrary scope state values.  ---  **Log and Stack trace**  Generated JSON for a `UserMessage` stored in scope state:  ```json {   "memoryId": "...",   "kind": "EPHEMERAL",   "state": [     "java.util.concurrent.ConcurrentHashMap",     {       "candidate": [         "dev.langchain4j.data.message.UserMessage",         {           "contents": [             "java.util.Collections$UnmodifiableRandomAccessList",             [               {                 "text": "hello",                 "type": "TEXT"               }             ]           ],           "type": "USER"         }       ]     }   ],   "agentInvocations": [     "java.util.Collections$SynchronizedRandomAccessList",     []   ],   "context": [     "java.util.Collections$SynchronizedRandomAccessList",     []   ] } ```  `AgenticScopeSerializer.fromJson()` then fails with:  ```text java.
  **Post-Mortem & Fix Analysis**:
  > opened #6465 for this. It covers `UserMessage`, the other message and content types, and messages kept inside a list or map in the scope state. 

- **Issue #6456** (2026-10-01): **[BUG] google-genai: generated images in chat responses are silently dropped**
  *Symptoms*: **Describe the bug**  Comparing the two Gemini modules, the new `langchain4j-google-genai` drops generated images from chat responses. The older `langchain4j-google-ai-gemini` surfaces them.  `GoogleGenAiContentMapper.toChatResponse` handles `part.text()`, `part.audioTranscription()`, `part.functionCall()` and `part.thoughtSignature()`. It never reads `part.inlineData()`. So an image that arrives in a chat response never lands in `AiMessage.attributes`, and `AiMessage.images()` stays empty.  That mapper is shared, so all three chat models in the module are affected:  - `GoogleGenAiChatModel` (non-streaming) - `GoogleGenAiStreamingChatModel` (streaming) - `GoogleGenAiBatchChatModel` (batch)  The old module does handle it. `PartsAndContentsMapper.fromGPartsToAiMessage()` writes `inlineData` into `AiMessage.GENERATED_IMAGES_KEY` (that came in with #3641), and `GeminiStreamingResponseBuilder` merges that list across chunks rather than overwriting it (#5972). The new module already reads `inlineData` in `GoogleGenAiImageModel` and `GoogleGenAiBatchImageModel`, so it looks like only the chat path got missed in the migration.  One more thing on the same path: `GoogleGenAiStreamingChatModel` (around line 195) still calls `attributes.putAll(aiMessage.attributes())`. That's the line #5972 replaced with a merge on the old side. With putAll, a later chunk replaces whatever an earlier one put under the same key.  **Log and Stack trace**  Nothing to show. No exception, nothing in the logs.

- **Issue #6419** (2026-09-16): **[BUG] Regression in 1.20.0: Bedrock streaming tool calls NPE in `ToolService.toResultMessage` when `arguments` has 2+ keys and a custom `.toolExecutor(...)` is configured**
  *Symptoms*: ### Describe the bug  When using `AiServices` with a custom `.toolExecutor(...)` (an async executor for tool calls) together with `langchain4j-bedrock`'s `BedrockStreamingChatModel`, a tool call whose `arguments` is a JSON object with **2 or more keys** deterministically throws:  NullPointerException: Cannot invoke "dev.langchain4j.service.tool.ToolExecutionResult.resultContents()" because "result" is null  **This is a regression: confirmed absent on `1.14.1`, confirmed present on `1.20.0`**, with the same application code and the same tool. Diffing the actual sources of both releases pinpoints exactly what changed (see "Root cause" below) — this isn't a long-standing latent bug, it was introduced by a specific refactor.  The NPE is thrown inside `dev.langchain4j.service.tool.ToolService.toResultMessage`, called from `ToolService.processToolResults` (line numbers below are from the `1.20.0` release tag):  ```java public ToolResultsOutcome processToolResults(         AiServiceContext context,         List<ToolExecutionRequest> toolExecutionRequests,         Map<ToolExecutionRequest, ToolExecutionResult> toolResults,         List<ToolExecution> toolExecutions,         InvocationContext invocationContext,         ToolServiceContext toolServiceContext) {     ...     for (ToolExecutionRequest request : toolExecutionRequests) {         ToolExecutionResult result = toolResults.get(request);         resultMessages.add(toResultMessage(request, result));  // NPEs here when result == nu

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

### Incident Patch 1: `7eec68ce` (2026-10-05)
**Commit Message**: fix(ai-services): avoid duplicating @UserMessage TextContent arguments (#6587)

## Issue
Closes #6585

## Change
In `DefaultAiServices.addContentsToUserMessage`, a single `Content`
argument annotated with `@UserMessage` was added to `contents` without
updating `hasTextContent`. When the argument was a `TextContent`,
`hasTextContent` remained `false`, causing
`prependTextContentsToUserMessage` to prepend the `TextContent` already
placed in `originalUserMessage` by `prepareUserMessage` and duplicating
it in both the outgoing `ChatRequest` and `ChatMemory`.

Set `hasTextContent |= content instanceof TextContent;` in the
`@UserMessage Content` branch (matching the existing `Map`,
`List<Content>`, and unannotated single-`Content` branches), and add
unit tests covering both blocking and streaming (`TokenStream`)
invocations.

## General checklist
- [x] There are no breaking changes (API, behaviour)
- [x] I have added unit and/or integration tests for my change
- [x] The tests cover both positive and negative cases
- [x] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green

---------

Co-authored-by: chengwudi1 <[REDACTED_EMAIL]

**File**: `langchain4j/src/main/java/dev/langchain4j/service/DefaultAiServices.java` (modified, +1/-0)
```diff
@@ -1701,6 +1701,7 @@ private static UserMessage addContentsToUserMessage(Method method, Object[] args
         for (int i = 0; i < parameters.length; i++) {
             if (parameters[i].isAnnotationPresent(dev.langchain4j.service.UserMessage.class)) {
                 if (args[i] instanceof Content content) {
+                    hasTextContent |= content instanceof TextContent;
                     contents.add(content);
                 } else if (isListOfContents(args[i])) {
                     hasTextContent |= ((List<Content>) args[i]).stream().anyMatch(TextContent.class::isInstance);
```

**File**: `langchain4j/src/test/java/dev/langchain4j/service/AiServicesUserMessageConfigTest.java` (modified, +56/-0)
```diff
@@ -13,17 +13,23 @@
 import dev.langchain4j.data.message.ImageContent;
 import dev.langchain4j.data.message.TextContent;
 import dev.langchain4j.invocation.InvocationParameters;
+import dev.langchain4j.memory.ChatMemory;
+import dev.langchain4j.memory.chat.MessageWindowChatMemory;
 import dev.langchain4j.model.chat.ChatModel;
 import dev.langchain4j.model.chat.mock.ChatModelMock;
+import dev.langchain4j.model.chat.mock.StreamingChatModelMock;
 import dev.langchain4j.model.chat.request.ChatRequest;
 import dev.langchain4j.model.chat.request.ChatRequestParameters;
+import dev.langchain4j.model.chat.response.ChatResponse;
 import java.lang.annotation.ElementType;
 import java.lang.annotation.Retention;
 import java.lang.annotation.RetentionPolicy;
 import java.lang.annotation.Target;
 import java.util.LinkedHashMap;
 import java.util.List;
 import java.util.Map;
+import java.util.concurrent.CompletableFuture;
+import java.util.concurrent.TimeUnit;
 import org.junit.jupiter.api.AfterEach;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.extension.ExtendWith;
@@ -113,6 +119,8 @@ interface AiService {
 
         String chat19_1(@UserMessage Content content);
         String chat19_2(@UserMessage AudioContent audioContent);
+        String chat19_3(@UserMessage TextContent textContent);
+        TokenStream stream19_3(@UserMessage TextContent textContent);
 
         String chat20_1(List<Content> contents);
         String chat20_2(List<AudioContent> audioContents);
@@ -541,6 +549,54 @@ void user_message_configuration_19_2() {
         verify(chatModel).supportedCapabilities();
     }
 
+    @Test
+    void user_message_configuration_19_3() {
+        // given
+        ChatMemory chatMemory = MessageWindowChatMemory.withMaxMessages(10);
+        AiService aiService = AiServices.builder(AiService.class)
+                .chatModel(chatModel)
+                .chatMemory(chatMemory)
+                .build();
+
+        TextContent textContent = TextContent.from("What is the capital of Germany?");
+
+        // when
+        aiService.chat19_3(textContent);
+
+        // then
+        verify(chatModel)
+                .chat(ChatRequest.builder().messages(userMessage(textContent)).build());
+        verify(chatModel).supportedCapabilities();
+        assertThat(chatMemory.messages()).first().isEqualTo(userMessage(textContent));
+    }
+
+    @Test
+    void user_message_configuration_19_3_streaming() throws Exception {
+        // given
+        StreamingChatModelMock streamingChatModel = StreamingChatModelMock.thatAlwaysStreams("Berlin");
+        ChatMemory chatMemory = MessageWindowChatMemory.withMaxMessages(10);
+        AiService aiService = AiServices.builder(AiService.class)
+                .streamingChatModel(streamingChatModel)
+                .chatMemory(chatMemory)
+                .build();
+
+        TextContent textContent = TextContent.from("What is the capital of Germany?");
+        CompletableFuture<ChatResponse> future = new CompletableFuture<>();
+
+        // when
+        aiService
+                .stream19_3(textContent)
+                .onPartialResponse(ignored -> {})
+                .onCompleteResponse(future::complete)
+                .onError(future::completeExceptionally)
+                .start();
+        future.get(5, TimeUnit.SECONDS);
+
+        // then
+        assertThat(streamingChatModel.request().messages()).containsExactly(userMessage(textContent));
+        assertThat(chatMemory.messages()).first().isEqualTo(userMessage(textContent));
+    }
+
     @Test
     void user_message_configuration_20_1() {
         // given
```

---

### Incident Patch 2: `2dbeb432` (2026-10-05)
**Commit Message**: fix(pgvector, mariadb): make metadata column type parsing locale-independent (#6444)

## Issue
Closes #6440

## Change
`MetadataColumDefinition.from(...)` in both `langchain4j-pgvector` and
`langchain4j-mariadb` now lowercases the column type token with
`Locale.ROOT`. Previously, under a Turkish default locale, types
containing `i` (e.g. `INT`) became `ınt` and downstream type checks
(e.g. `JSONBMetadataHandler`) misbehaved depending on the JVM default
locale. The mariadb module already used `Locale.ROOT` elsewhere in the
same class; this makes it consistent.

## General checklist
- [X] There are no breaking changes (API, behaviour)
- [X] I have added unit and/or integration tests for my change
- [X] The tests cover both positive and negative cases
- [X] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green
- [ ] I have manually run all the unit and integration tests in the
[core](https://github.com/langchain4j/langchain4j/tree/main/langchain4j-core)
and
[main](https://github.com/langchain4j/langchain4j/tree/main/langchain4j)
modules, and they are all green (no changes there; unrelated
pre-existing environment-specific fai

**File**: `langchain4j-mariadb/src/main/java/dev/langchain4j/store/embedding/mariadb/MetadataColumDefinition.java` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ public static MetadataColumDefinition from(String sqlDefinition, List<String> sq
                     .substring(fieldName.length())
                     .trim()
                     .split(" ")[0]
-                    .toLowerCase();
+                    .toLowerCase(Locale.ROOT);
 
             if (!fieldName.startsWith("`") && sqlKeywords.contains(unescapedName.toLowerCase(Locale.ROOT))) {
                 // if field name is a reserved keywords, force quote
```

**File**: `langchain4j-mariadb/src/test/java/dev/langchain4j/store/embedding/mariadb/MetadataColumDefinitionTest.java` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+package dev.langchain4j.store.embedding.mariadb;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.assertThatThrownBy;
+
+import java.util.List;
+import java.util.Locale;
+import org.junit.jupiter.api.Test;
+
+class MetadataColumDefinitionTest {
+
+    @Test
+    void should_parse_type_in_a_locale_independent_way() {
+        Locale defaultLocale = Locale.getDefault();
+        Locale.setDefault(Locale.forLanguageTag("tr-TR"));
+        try {
+            assertThat(MetadataColumDefinition.from("mycol INT", List.of()).type())
+                    .isEqualTo("int");
+        } finally {
+            Locale.setDefault(defaultLocale);
+        }
+    }
+
+    @Test
+    void should_parse_column_definition() {
+        MetadataColumDefinition definition = MetadataColumDefinition.from("mycol INT", List.of());
+
+        assertThat(definition.name()).isEqualTo("mycol");
+        assertThat(definition.escapedName()).isEqualTo("mycol");
+        assertThat(definition.type()).isEqualTo("int");
+        assertThat(definition.fullDefinition()).isEqualTo("mycol INT");
+    }
+
+    @Test
+    void should_parse_quoted_column_definition() {
+        MetadataColumDefinition definition = MetadataColumDefinition.from("`my col` INT", List.of());
+
+        assertThat(definition.name()).isEqualTo("my col");
+        assertThat(definition.escapedName()).isEqualTo("`my col`");
+        assertThat(definition.type()).isEqualTo("int");
+    }
+
+    @Test
+    void should_reject_definition_without_type() {
+        assertThatThrownBy(() -> MetadataColumDefinition.from("mycol", List.of()))
+                .isInstanceOf(IllegalArgumentException.class);
+    }
+}
```

**File**: `langchain4j-pgvector/src/main/java/dev/langchain4j/store/embedding/pgvector/MetadataColumDefinition.java` (modified, +6/-5)
```diff
@@ -1,9 +1,9 @@
 package dev.langchain4j.store.embedding.pgvector;
 
 import dev.langchain4j.internal.ValidationUtils;
-
 import java.util.Arrays;
 import java.util.List;
+import java.util.Locale;
 import java.util.stream.Collectors;
 
 /**
@@ -29,13 +29,14 @@ private MetadataColumDefinition(String fullDefinition, String name, String type)
     public static MetadataColumDefinition from(String sqlDefinition) {
         String fullDefinition = ValidationUtils.ensureNotNull(sqlDefinition, "Metadata column definition");
         List<String> tokens = Arrays.stream(fullDefinition.split(" "))
-                .filter(s -> !s.isEmpty()).collect(Collectors.toList());
+                .filter(s -> !s.isEmpty())
+                .collect(Collectors.toList());
         if (tokens.size() < 2) {
-            throw new IllegalArgumentException("Definition format should be: column type" +
-                    " [ NULL | NOT NULL ] [ UNIQUE ] [ DEFAULT value ]");
+            throw new IllegalArgumentException(
+                    "Definition format should be: column type" + " [ NULL | NOT NULL ] [ UNIQUE ] [ DEFAULT value ]");
         }
         String name = tokens.get(0);
-        String type = tokens.get(1).toLowerCase();
+        String type = tokens.get(1).toLowerCase(Locale.ROOT);
         return new MetadataColumDefinition(fullDefinition, name, type);
     }
 
```

**File**: `langchain4j-pgvector/src/test/java/dev/langchain4j/store/embedding/pgvector/MetadataColumDefinitionTest.java` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+package dev.langchain4j.store.embedding.pgvector;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.assertThatThrownBy;
+
+import java.util.Locale;
+import org.junit.jupiter.api.Test;
+
+class MetadataColumDefinitionTest {
+
+    @Test
+    void should_parse_type_in_a_locale_independent_way() {
+        Locale defaultLocale = Locale.getDefault();
+        Locale.setDefault(Locale.forLanguageTag("tr-TR"));
+        try {
+            assertThat(MetadataColumDefinition.from("mycol INT").getType()).isEqualTo("int");
+            assertThat(MetadataColumDefinition.from("myjson JSONB").getType()).isEqualTo("jsonb");
+        } finally {
+            Locale.setDefault(defaultLocale);
+        }
+    }
+
+    @Test
+    void should_parse_column_definition() {
+        MetadataColumDefinition definition = MetadataColumDefinition.from("mycol INT");
+
+        assertThat(definition.getName()).isEqualTo("mycol");
+        assertThat(definition.getType()).isEqualTo("int");
+        assertThat(definition.getFullDefinition()).isEqualTo("mycol INT");
+    }
+
+    @Test
+    void should_reject_definition_without_type() {
+        assertThatThrownBy(() -> MetadataColumDefinition.from("mycol")).isInstanceOf(IllegalArgumentException.class);
+    }
+}
```

---

### Incident Patch 3: `b5c1e03a` (2026-10-05)
**Commit Message**: fix(google-custom-web-search): make geoLocation casing locale-independent (#6443)

## Issue
Closes #6439

## Change
`GoogleCustomWebSearchEngine.setCountryRestrict` now uppercases the
`geoLocation` country code with `Locale.ROOT` instead of the JVM default
locale. Previously, under a Turkish/Azeri default locale, codes
containing `i` (e.g. `in` for India) were corrupted to `İN` and an
invalid `cr` parameter was sent to the Google Custom Search API.

The method was made package-private `static` to follow the module's
existing test-access pattern; no public API change.

## General checklist
- [X] There are no breaking changes (API, behaviour)
- [X] I have added unit and/or integration tests for my change
- [X] The tests cover both positive and negative cases
- [X] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green
- [ ] I have manually run all the unit and integration tests in the
[core](https://github.com/langchain4j/langchain4j/tree/main/langchain4j-core)
and
[main](https://github.com/langchain4j/langchain4j/tree/main/langchain4j)
modules, and they are all green (no changes there; unrelated
pre-existing environment-spec

**File**: `web-search-engines/langchain4j-web-search-engine-google-custom/src/test/java/dev/langchain4j/web/search/google/customsearch/GoogleCustomWebSearchEngineTest.java` (modified, +68/-0)
```diff
@@ -6,7 +6,12 @@
 import com.google.api.services.customsearch.v1.model.Result;
 import com.google.api.services.customsearch.v1.model.Search;
 import dev.langchain4j.web.search.WebSearchOrganicResult;
+import dev.langchain4j.web.search.WebSearchRequest;
 import java.util.List;
+import java.util.Locale;
+import java.util.Map;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.BeforeEach;
 import org.junit.jupiter.api.Test;
 
 class GoogleCustomWebSearchEngineTest {
@@ -141,4 +146,67 @@ void mappingDoesNotThrowWhenEveryLinkIsUnresolvable() {
                 })
                 .doesNotThrowAnyException();
     }
+
+    private Locale originalLocale;
+
+    @BeforeEach
+    void rememberDefaultLocale() {
+        originalLocale = Locale.getDefault();
+    }
+
+    @AfterEach
+    void restoreDefaultLocale() {
+        Locale.setDefault(originalLocale);
+    }
+
+    @Test
+    void setCountryRestrict_underTurkishLocale_doesNotMangleGeoCodeContainingI() {
+        Locale.setDefault(Locale.forLanguageTag("tr"));
+        WebSearchRequest request = WebSearchRequest.builder()
+                .searchTerms("query")
+                .geoLocation("in")
+                .build();
+
+        String cr = GoogleCustomWebSearchEngine.setCountryRestrict(request);
+
+        assertThat(cr).isEqualTo("countryIN");
+    }
+
+    @Test
+    void setCountryRestrict_underTurkishLocale_upperCasesCodeWithoutI() {
+        Locale.setDefault(Locale.forLanguageTag("tr"));
+        WebSearchRequest request = WebSearchRequest.builder()
+                .searchTerms("query")
+                .geoLocation("de")
+                .build();
+
+        String cr = GoogleCustomWebSearchEngine.setCountryRestrict(request);
+
+        assertThat(cr).isEqualTo("countryDE");
+    }
+
+    @Test
+    void setCountryRestrict_withoutGeoLocation_returnsDefaultValue() {
+        Locale.setDefault(Locale.forLanguageTag("tr"));
+        WebSearchRequest request =
+                WebSearchRequest.builder().searchTerms("query").build();
+
+        String cr = GoogleCustomWebSearchEngine.setCountryRestrict(request);
+
+        assertThat(cr).isEmpty();
+    }
+
+    @Test
+    void setCountryRestrict_withCrInAdditionalParams_prefersAdditionalParams() {
+        Locale.setDefault(Locale.forLanguageTag("tr"));
+        WebSearchRequest request = WebSearchRequest.builder()
+                .searchTerms("query")
+                .geoLocation("in")
+                .additionalParams(Map.of("cr", "countryUS"))
+                .build();
+
+        String cr = GoogleCustomWebSearchEngine.setCountryRestrict(request);
+
+        assertThat(cr).isEqualTo("countryUS");
+    }
 }
```

---

### Incident Patch 4: `e7342515` (2026-10-05)
**Commit Message**: fix: make Google Custom Search country restrict locale-independent (#6437)

## Issue

Closes #6436

## Change

Use `Locale.ROOT` when building the Google Custom Search `cr` parameter.
It was uppercasing the geo location with the default locale, so under
Turkish and Azerbaijani a country code containing an `i` produced a
dotted `İ`: `geoLocation("in")` sent `cr=countryİN` rather than
`cr=countryIN`, and the country restriction was silently wrong. `id`,
`ie`, `il`, `is` and `it` are affected the same way; codes without an
`i` were always fine.

`setCountryRestrict` goes from `private static` to package private so
the test can call it, matching `toWebSearchOrganicResults` in the same
class, which is already package private for the same reason.

Add `GoogleCustomWebSearchEngineLocaleTest` following the existing
`*LocaleTest` classes: `@Isolated` and `@Execution(SAME_THREAD)` because
it mutates the JVM default locale, with the locale restored afterwards.
It covers `en-US` as a control plus `tr-TR` and `az-AZ`, and includes
`it` alongside `in` so it is clear this is not one special case. The
three non-ASCII-folding rows fail without the production change and the
`en-US` row passes.

Foll

**File**: `web-search-engines/langchain4j-web-search-engine-google-custom/src/main/java/dev/langchain4j/web/search/google/customsearch/GoogleCustomWebSearchEngine.java` (modified, +5/-3)
```diff
@@ -23,6 +23,7 @@
 import java.util.Collections;
 import java.util.HashMap;
 import java.util.List;
+import java.util.Locale;
 import java.util.Map;
 import java.util.Objects;
 
@@ -258,11 +259,11 @@ private static Integer calculatePageNumber(Integer startIndex) {
         return ((startIndex - 1) / 10) + 1;
     }
 
-    private static String setCountryRestrict(WebSearchRequest webSearchRequest) {
+    static String setCountryRestrict(WebSearchRequest webSearchRequest) {
         return webSearchRequest.additionalParams().get("cr") != null
                 ? webSearchRequest.additionalParams().get("cr").toString()
                 : isNotNullOrBlank(webSearchRequest.geoLocation())
-                        ? "country" + webSearchRequest.geoLocation().toUpperCase()
+                        ? "country" + webSearchRequest.geoLocation().toUpperCase(Locale.ROOT)
                         : ""; // default value
     }
 
@@ -385,7 +386,8 @@ public GoogleCustomWebSearchEngine build() {
         }
 
         public String toString() {
-            return "GoogleCustomWebSearchEngine.GoogleCustomWebSearchEngineBuilder(apiKey=" + (this.apiKey == null ? null : "********") + ", csi="
+            return "GoogleCustomWebSearchEngine.GoogleCustomWebSearchEngineBuilder(apiKey="
+                    + (this.apiKey == null ? null : "********") + ", csi="
                     + this.csi + ", siteRestrict=" + this.siteRestrict + ", includeImages=" + this.includeImages
                     + ", timeout=" + this.timeout + ", maxRetries=" + this.maxRetries + ", logRequests="
                     + this.logRequests + ", logResponses=" + this.logResponses + ")";
```

**File**: `web-search-engines/langchain4j-web-search-engine-google-custom/src/test/java/dev/langchain4j/web/search/google/customsearch/GoogleCustomWebSearchEngineLocaleTest.java` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package dev.langchain4j.web.search.google.customsearch;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+import dev.langchain4j.web.search.WebSearchRequest;
+import java.util.Locale;
+import org.junit.jupiter.api.parallel.Execution;
+import org.junit.jupiter.api.parallel.ExecutionMode;
+import org.junit.jupiter.api.parallel.Isolated;
+import org.junit.jupiter.params.ParameterizedTest;
+import org.junit.jupiter.params.provider.ValueSource;
+
+/**
+ * These tests mutate the JVM default {@link Locale}, so the whole class runs {@link Isolated}
+ * and single-threaded to avoid races with the otherwise parallel test suite.
+ */
+@Isolated
+@Execution(ExecutionMode.SAME_THREAD)
+class GoogleCustomWebSearchEngineLocaleTest {
+
+    @ParameterizedTest
+    @ValueSource(strings = {"en-US", "tr-TR", "az-AZ"})
+    void should_build_country_restrict_independently_of_default_locale(String languageTag) {
+        // Without Locale.ROOT, "in".toUpperCase() yields the dotted "İN" under tr/az, so "cr" becomes "countryİN"
+        withDefaultLocale(languageTag, () -> {
+            WebSearchRequest request = WebSearchRequest.builder()
+                    .searchTerms("langchain4j")
+                    .geoLocation("in")
+                    .build();
+
+            assertThat(GoogleCustomWebSearchEngine.setCountryRestrict(request)).isEqualTo("countryIN");
+        });
+    }
+
+    private static void withDefaultLocale(String languageTag, Runnable action) {
+        Locale previousDefault = Locale.getDefault();
+        try {
+            Locale.setDefault(Locale.forLanguageTag(languageTag));
+            action.run();
+        } finally {
+            Locale.setDefault(previousDefault);
+        }
+    }
+}
```

---

### Incident Patch 5: `f1a88d7a` (2026-10-05)
**Commit Message**: docs: fix source links and outcome anchors in guardrails tutorial (#6579)

## Issue
Documentation-only broken-link correction; no associated issue.

## Change
The Guardrails extension-points table links to nonexistent standalone
`InputGuardrailsConfigBuilder.java` and
`OutputGuardrailsConfigBuilder.java` files. These builders are nested in
`InputGuardrailsConfig.java` and `OutputGuardrailsConfig.java`; point
the existing labels to their containing source files.

The output-guardrails introduction also links to nonexistent `#retry`
and `#reprompt` anchors. Point both links to the existing Output
Guardrail Outcomes section, which documents both behaviors.

## Validation
- `git diff --check` passed.
- Verified the two old source URLs return HTTP 404 and their
replacements return HTTP 200.
- Verified both nested builder declarations exist in the replacement
sources.
- `cd docs && npm ci --no-audit --no-fund && npm run build` passed.
- Checked the generated Guardrails HTML contains the corrected source
links and valid `#output-guardrail-outcomes` links; this page no longer
produces broken-anchor warnings.
- The documentation build still reports pre-existing broken
links/anchors on other

**File**: `docs/docs/tutorials/guardrails.md` (modified, +3/-3)
```diff
@@ -265,7 +265,7 @@ There are several common use cases where implementations of an input guardrail a
 
 ## Output Guardrails
 
-Output guardrails are functions executed after the LLM has produced its output. Failing an output guardrail allows for more advanced scenarios, such as [retrying](#retry) or [reprompting](#reprompt), to help improve the response. They are invoked _after_ all other operations, including function/tool calls, have happened.
+Output guardrails are functions executed after the LLM has produced its output. Failing an output guardrail allows for more advanced scenarios, such as [retrying](#output-guardrail-outcomes) or [reprompting](#output-guardrail-outcomes), to help improve the response. They are invoked _after_ all other operations, including function/tool calls, have happened.
 
 ### Implementing Output Guardrails
 
@@ -579,8 +579,8 @@ All of these extension points utilize the [Java Service Provider Interface (Java
 | [`ClassInstanceFactory`](https://github.com/langchain4j/langchain4j/blob/main/langchain4j-core/src/main/java/dev/langchain4j/spi/classloading/ClassInstanceFactory.java)                                     | Provides instances of classes.<br/> - Intended to delegate instance creation/retrieval to some other means.<br/> - If not provided, uses reflection to create an instance using the default constructor.<br/> - Other frameworks (like Quarkus or Spring) may use their own bean containers to provide instances of classes. Those frameworks would provide an implementation.<br/> - A Quarkus implementation may look something like [`CDIClassInstanceFactory`](https://github.com/langchain4j/langchain4j/blob/main/integration-tests/integration-tests-class-instance-loader/integration-tests-class-instance-loader-quarkus/src/main/java/com/example/CDIClassInstanceFactory.java)<br/> - A Spring implementation may look something like [`ApplicationContextClassInstanceFactory`](https://github.com/langchain4j/langchain4j/blob/main/integration-tests/integration-tests-class-instance-loader/integration-tests-class-instance-loader-spring/src/main/java/com/example/classes/ApplicationContextClassInstanceFactory.java) |
 | [`ClassMetadataProviderFactory`](https://github.com/langchain4j/langchain4j/blob/main/langchain4j-core/src/main/java/dev/langchain4j/spi/classloading/ClassMetadataProviderFactory.java)                     | Provides access to class metadata.<br/> - Used to scan the methods on `AiService` interfaces, and find and process the `@InputGuardrails`/`@OutputGuardrails` annotations.<br/> - [`ReflectionBasedClassMetadataProviderFactory`](https://github.com/langchain4j/langchain4j/blob/main/langchain4j/src/main/java/dev/langchain4j/classloading/ReflectionBasedClassMetadataProviderFactory.java) is the default implementation if no others are found, providing class metadata using reflection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
  | [`GuardrailServiceBuilderFactory`](https://github.com/langchain4j/langchain4j/blob/main/langchain4j/src/main/java/dev/langchain4j/service/guardrail/spi/GuardrailServiceBuilderFactory.java)                 | Provides builder instances for building [`GuardrailService`](https://github.com/langchain4j/langchain4j/blob/main/langchain4j/src/main/java/dev/langchain4j/service/guardrail/GuardrailService.java) instances. An application or framework would implement this if they needed to customize the way they build `GuardrailService` instances.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
- | [`InputGuardrailsConfigBuilderFactory`](https://github.com/langchain4j/langchain4j/blob/main/langchain4j-core/src/main/java/dev/langchain4j/spi/guardrail/config/InputGuardrailsConfigBuilderFactory.java)   | - SPI for overriding and/or extending the default [`InputGuardrailsConfigBuilder`](https://github.com/langchain4j/langchain4j/blob/main/langchain4j-core/src/main/java/dev/langchain4j/guardrail/con
```

---

### Incident Patch 6: `e65b13ef` (2026-10-05)
**Commit Message**: docs: fix malformed Markdown links in Hibernate embedding store docs (#6523)

## What

Fixes two malformed Markdown links in
`docs/docs/integrations/embedding-stores/hibernate.md` (CockroachDB and
SAP HANA sections). In both places, a complete Markdown link was
accidentally pasted inside the link target's brackets, e.g.:

```markdown
[CockroachDB documentation]([https://github.com/pgvector/pgvector?tab=readme-ov-file#indexing](https://www.cockroachlabs.com/docs/v26.2/vector-indexes))
```

## Why

The nested-bracket syntax does not render as a link on the docs site —
the raw URL text leaks into the page. The fix removes the stray inner
link and keeps the intended target URL for each section (CockroachDB →
cockroachlabs.com, SAP HANA → help.sap.com), matching the clean pattern
already used by the neighboring pgvector/Oracle/SQL Server sections.

## How checked

- Grepped `docs/` for the `]([` pattern: these two lines are the only
occurrences.
- Verified the CockroachDB target URL resolves (301 to
docs.cockroachlabs.com, same path).
- Reviewed the Markdown diff; no other changes.

**File**: `docs/docs/integrations/embedding-stores/hibernate.md` (modified, +2/-2)
```diff
@@ -502,7 +502,7 @@ create index if not exists my_entity_ivfflat_index
 
 ##### CockroachDB
 
-See the [CockroachDB documentation]([https://github.com/pgvector/pgvector?tab=readme-ov-file#indexing](https://www.cockroachlabs.com/docs/v26.2/vector-indexes)) for details.
+See the [CockroachDB documentation](https://www.cockroachlabs.com/docs/v26.2/vector-indexes) for details.
 
 ```sql
 create vector index if not exists my_entity_ivfflat_index
@@ -531,7 +531,7 @@ create vector index my_entity_vector_index
 
 ##### SAP HANA
 
-See the [`create vector index` statement documentation]([https://learn.microsoft.com/en-us/sql/t-sql/statements/create-vector-index-transact-sql?view=sql-server-ver17](https://help.sap.com/docs/hana-cloud-database/sap-hana-cloud-sap-hana-database-sql-reference-guide/create-vector-index-statement-data-definition?locale=en-US))
+See the [`create vector index` statement documentation](https://help.sap.com/docs/hana-cloud-database/sap-hana-cloud-sap-hana-database-sql-reference-guide/create-vector-index-statement-data-definition?locale=en-US)
 for details.
 
 ```sql
```

---

### Incident Patch 7: `d6f0a3b4` (2026-10-05)
**Commit Message**: Fix flaky provider integration tests

- Shared should_respect_multiple_messages: replace "What was your previous
  answer?" with a follow-up that needs the previous answer without asking
  about the conversation itself; Amazon Nova often refuses the old question
  citing privacy or a lack of memory.
- Vertex AI Gemini: send fingers.mp4 as VideoContent and re-encode it to a
  2 s baseline H.264 clip (it was 0.2 s), which Vertex intermittently
  rejected with INVALID_ARGUMENT.
- Vertex AI Gemini streaming: give the audio/video tests a 180 s budget via
  a new TestStreamingChatResponseHandler.get(Duration), and reference the
  video via gs:// so it is not downloaded by the runner first.
- Vertex AI Gemini streaming common IT: use temperature 0 to reduce
  hallucinated google:python_interpreter tool calls.
- Mistral FIM IT: stop at ")" so the completion stays short and does not
  run into the HTTP timeout.

**File**: `langchain4j-core/src/test/java/dev/langchain4j/model/chat/TestStreamingChatResponseHandler.java` (modified, +7/-2)
```diff
@@ -1,6 +1,6 @@
 package dev.langchain4j.model.chat;
 
-import static java.util.concurrent.TimeUnit.SECONDS;
+import static java.util.concurrent.TimeUnit.MILLISECONDS;
 import static org.assertj.core.api.Assertions.assertThat;
 
 import dev.langchain4j.data.message.AiMessage;
@@ -12,6 +12,7 @@
 import dev.langchain4j.model.chat.response.PartialToolCall;
 import dev.langchain4j.model.chat.response.PartialToolCallContext;
 import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
+import java.time.Duration;
 import java.util.concurrent.CompletableFuture;
 import java.util.concurrent.ExecutionException;
 import java.util.concurrent.TimeoutException;
@@ -69,8 +70,12 @@ public void onError(Throwable error) {
     }
 
     public ChatResponse get() {
+        return get(Duration.ofSeconds(60));
+    }
+
+    public ChatResponse get(Duration timeout) {
         try {
-            return futureResponse.get(60, SECONDS);
+            return futureResponse.get(timeout.toMillis(), MILLISECONDS);
         } catch (InterruptedException e) {
             Thread.currentThread().interrupt();
             throw new RuntimeException(e);
```

**File**: `langchain4j-core/src/test/java/dev/langchain4j/model/chat/common/AbstractBaseChatModelIT.java` (modified, +5/-3)
```diff
@@ -229,11 +229,13 @@ protected void should_respect_multiple_messages(M model) {
         // given
         ChatRequest chatRequest = ChatRequest.builder()
                 .messages(
-                        // asking the model about its own previous answer instead of about the user,
-                        // as Amazon Nova refuses to repeat anything the user said, treating it as personal information
+                        // the last question can only be answered using the previous answer, without asking about
+                        // the conversation itself: Amazon Nova often refuses to repeat what the user said
+                        // or what it answered before, citing privacy or a lack of memory
                         UserMessage.from(WHAT_IS_THE_CAPITAL_OF_GERMANY),
                         AiMessage.from("Berlin"),
-                        UserMessage.from("What was your previous answer?"))
+                        UserMessage.from(
+                                "Which river flows through that city? Answer in one sentence that names the city."))
                 .build();
 
         // when
```

**File**: `langchain4j-mistral-ai/src/test/java/dev/langchain4j/model/mistralai/MistralAiFimModelIT.java` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ class MistralAiFimModelIT {
     LanguageModel codestral = MistralAiFimModel.builder()
             .apiKey(System.getenv("MISTRAL_AI_API_KEY"))
             .modelName(MistralAiFimModelName.CODESTRAL_LATEST)
+            .stop(List.of(")"))
             .logRequests(true)
             .logResponses(true)
             .build();
```

**File**: `langchain4j-vertex-ai-gemini/src/test/java/dev/langchain4j/model/vertexai/gemini/VertexAiGeminiChatModelIT.java` (modified, +1/-1)
```diff
@@ -461,7 +461,7 @@ void should_accept_local_file() {
         assertThat(file).exists();
 
         UserMessage msg = UserMessage.from(
-                AudioContent.from(Paths.get("src/test/resources/fingers.mp4").toUri()),
+                VideoContent.from(Paths.get("src/test/resources/fingers.mp4").toUri()),
                 TextContent.from("What's in this video?"));
 
         // when
```

**File**: `langchain4j-vertex-ai-gemini/src/test/java/dev/langchain4j/model/vertexai/gemini/VertexAiGeminiStreamingChatModelIT.java` (modified, +5/-4)
```diff
@@ -30,6 +30,7 @@
 import java.io.File;
 import java.io.IOException;
 import java.nio.file.Paths;
+import java.time.Duration;
 import java.util.ArrayList;
 import java.util.Arrays;
 import java.util.HashMap;
@@ -322,7 +323,7 @@ void should_accept_audio() {
         model.chat(singletonList(msg), handler);
 
         // then
-        assertThat(handler.get().aiMessage().text()).containsIgnoringCase("Pixel");
+        assertThat(handler.get(Duration.ofSeconds(180)).aiMessage().text()).containsIgnoringCase("Pixel");
     }
 
     @Test
@@ -338,15 +339,15 @@ void should_accept_video() {
 
         // when
         UserMessage msg = UserMessage.from(
-                AudioContent.from("https://storage.googleapis.com/cloud-samples-data/video/animals.mp4"),
+                VideoContent.from("gs://cloud-samples-data/video/animals.mp4"),
                 TextContent.from("What's in this video?"));
 
         // when
         TestStreamingChatResponseHandler handler = new TestStreamingChatResponseHandler();
         model.chat(singletonList(msg), handler);
 
         // then
-        assertThat(handler.get().aiMessage().text()).containsIgnoringCase("animal");
+        assertThat(handler.get(Duration.ofSeconds(180)).aiMessage().text()).containsIgnoringCase("animal");
     }
 
     @Test
@@ -365,7 +366,7 @@ void should_accept_local_file() {
         assertThat(file).exists();
 
         UserMessage msg = UserMessage.from(
-                AudioContent.from(Paths.get("src/test/resources/fingers.mp4").toUri()),
+                VideoContent.from(Paths.get("src/test/resources/fingers.mp4").toUri()),
                 TextContent.from("What's in this video?"));
 
         // when
```

**File**: `langchain4j-vertex-ai-gemini/src/test/java/dev/langchain4j/model/vertexai/gemini/common/VertexAiGeminiStreamingChatModelIT.java` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ protected List<StreamingChatModel> models() {
                         .project(System.getenv("GCP_PROJECT_ID"))
                         .location(System.getenv("GCP_LOCATION"))
                         .modelName("gemini-2.5-flash")
+                        .temperature(0.0f)
                         .build()
                 // TODO add more model configs, see OpenAiChatModelIT
         );
```

---

### Incident Patch 8: `7e5844bd` (2026-10-05)
**Commit Message**: chore(deps): bump brace-expansion from 1.1.18 to 1.1.21 in /docs (#6559)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion)
from 1.1.18 to 1.1.21.
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/8e81e187b6e9c6c723d16c042657c00acefc2483"><code>8e81e18</code></a>
1.1.21</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/ffdfa3e3806bed17c0874b8f1439b084de354a7e"><code>ffdfa3e</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/c6513ad31e08edb56dc414a629e39cba724b7548"><code>c6513ad</code></a>
1.1.20</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/1efee7c397c191da6287a78ec19512476a966a7b"><code>1efee7c</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/a34340a053abb475cc226aeb3f71887018e71bd0"><code>a34340a</code></a>
1.1.19</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/0bcbfc0a5928c3073d48f42999d1ce4fc1c42fbc"><code>0bcbfc0</code></a>
Merge commit from fork</li>
<li>See full diff in <a
href="https://github.com/juliangru

**File**: `docs/package-lock.json` (modified, +3/-3)
```diff
@@ -6365,9 +6365,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.18",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
-      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^1.0.0",
```

---

### Incident Patch 9: `1613ff57` (2026-10-01)
**Commit Message**: fix(jackson3): restore the remaining Jackson 2 defaults and document the deliberate differences (#6564)

## Issue

The Jackson 3 opt-in promises that switching codecs does not change
behaviour, and `Jackson3Defaults` sets the changed Jackson 3 defaults
back to their Jackson 2 values. Comparing every LangChain4j Jackson 2
codec with its Jackson 3 counterpart (all feature flags, plus read/write
probes, including the modules Spring Boot and Quarkus put on the
classpath) found defaults it missed, which change what LangChain4j reads
or writes:

- **`READ_ENUMS_USING_TO_STRING` / `WRITE_ENUMS_USING_TO_STRING`** are
on in Jackson 3, so every enum that overrides `toString()` changes on
the wire:
- Gemini responses with code execution fail to parse: Gemini sends
`"outcome": "OUTCOME_OK"`, but `GeminiOutcome.toString()` returns
`outcome_ok`.
- Gemini schema types are sent as `"type": "string"` instead of
`"STRING"`.
- User enums in structured output and tool arguments can no longer be
read from the `name()` values the JSON schema lists.
- **`DETECT_PARAMETER_NAMES`** is on in Jackson 3. The Jackson 2 general
codec gets the same behaviour from `jackson-module-parameter-names` when
it is on th

**File**: `docs/docs/tutorials/jackson-3.md` (modified, +53/-3)
```diff
@@ -42,7 +42,9 @@ directly. Adding it alongside `langchain4j-jackson3` is unnecessary but harmless
 ## What stays the same
 
 Switching a JSON library is a good way to change behaviour by accident, so the module works hard not
-to. Jackson 3 changed several defaults, and every one of them is set back to what Jackson 2 did:
+to. Jackson 3 changed several defaults, and almost every one that changes what LangChain4j reads or
+writes is set back to what Jackson 2 did. The few kept on purpose are listed under
+[What is deliberately different](#what-is-deliberately-different).
 
 | Setting | Jackson 3 default | What this module does |
 |---|---|---|
@@ -51,12 +53,60 @@ to. Jackson 3 changed several defaults, and every one of them is set back to wha
 | `SORT_PROPERTIES_ALPHABETICALLY` | enabled | disabled |
 | `FAIL_ON_TRAILING_TOKENS` | enabled | disabled |
 | `FAIL_ON_NULL_FOR_PRIMITIVES` | enabled | disabled |
-| `""` coerced to an enum | rejected | read as `null`, as Jackson 2 does |
+| `READ_ENUMS_USING_TO_STRING` | enabled | disabled: an enum is read by `name()` |
+| `WRITE_ENUMS_USING_TO_STRING` | enabled | disabled: an enum is written by `name()` |
+| `DETECT_PARAMETER_NAMES` | enabled | disabled, except for structured output and tool arguments (see below) |
+| `FAIL_ON_UNKNOWN_PROPERTIES` | disabled | enabled: a field the target type does not have fails in structured output, tool arguments, chat memory, agent state and stored embedding stores; provider responses still ignore unknown fields |
+| `FAIL_ON_EMPTY_BEANS` | disabled | enabled: an object with nothing to write - for example one whose fields are private and have no getters - fails instead of being sent as `{}` |
 
 The first one matters most: without it, a final collection field is left empty instead of being
 populated, and nothing tells you.
 
-**Failures get a LangChain4j type.** This is the one place where the opt-in does change something.
+`DETECT_PARAMETER_NAMES` only matters when your code is compiled with `-parameters`, as Spring Boot
+and Quarkus projects usually are. For structured output and tool arguments, constructor parameter
+names are used, as the Jackson 2 codec does when `jackson-module-parameter-names` is on the classpath,
+which it is in Spring Boot and Quarkus: a class with only a constructor with arguments, such as a
+Lombok `@AllArgsConstructor` class, can be read. Chat memory, agent state and the other codecs do not
+use parameter names, as with Jackson 2.
+
+To choose a constructor explicitly, whatever the compiler settings, annotate it:
+
+- with `@JsonCreator(mode = JsonCreator.Mode.DELEGATING)` to read a plain value such as `"abc"` through
+  a one-argument constructor;
+- with `@JsonCreator`, and each parameter with `@JsonProperty("name")`, to read an object through a
+  constructor with arguments.
+
+Both work with either Jackson version.
+
+## What is deliberately different
+
+A few differences remain on purpose, because restoring them would cost more than it gives:
+
+- **Dates and times are written as ISO-8601 strings.** `java.util.Date` and `Calendar` become
+  `"1970-01-01T00:00:00.000Z"` instead of epoch milliseconds. With `jackson-datatype-jsr310` on the
+  classpath, as in Spring Boot and Quarkus applications, Jackson 2 also writes `Instant`,
+  `OffsetDateTime` and `Duration` as numbers; this module writes them as ISO-8601 strings, which an
+  LLM reads far more reliably. Numbers are still read for `Date`, `Instant` and `Duration`.
+- **`java.time.Month` is written as a number starting at 1** (`1` for January). With
+  `jackson-datatype-jsr310`, Jackson 2 writes `"JANUARY"` and reads a number as a position starting
+  at 0, so `1` is `FEBRUARY`. Both versions read the name.
+- **`""` is read as `null` for an enum**, the same as a missing value. This applies to required
+  enums too: like a missing field, `""` gives `null` rather than an error. Jackson 2 fails instead,
+  but providers send it - an OpenAI-compatible server returning `"type": ""` for a tool call is what
+  found this - and an LLM may answer `""` for an optional enum. `""` for an object, a map or a list
+  still fails, as it does with Jackson 2.
+- **A `private` one-argument constructor is not used to read a plain value.** Jackson 2 uses it;
+  with Jackson 3, annotate it with `@JsonCreator(mode = JsonCreator.Mode.DELEGATING)`.
+- **For structured output and tool arguments, a class with both a no-argument constructor and a
+  constructor with arguments is created through the one with arguments** when it is compiled with
+  `-parameters`. Jackson 2 uses the no-argument constructor and then sets the fields. This only
+  matters if that constructor does more than assign fields.
+- **A field such as `xValue` with a getter `getXValue()` is written as `"xValue"`.** Jackson 2 derives
+  `"xvalue"` from the getter: for structured output, tool results and agent state it writes both
+  `"xValue"` and `"xvalue"`, and for provider requests only `"xvalue"`. 
```

**File**: `langchain4j-core-jackson3/pom.xml` (modified, +18/-0)
```diff
@@ -43,4 +43,22 @@
 
     </dependencies>
 
+    <build>
+        <plugins>
+            <plugin>
+                <groupId>org.apache.maven.plugins</groupId>
+                <artifactId>maven-compiler-plugin</artifactId>
+                <executions>
+                    <execution>
+                        <!-- Spring Boot and Quarkus applications are compiled with -parameters, which changes how constructors are chosen -->
+                        <id>java-test-compile</id>
+                        <configuration>
+                            <parameters>true</parameters>
+                        </configuration>
+                    </execution>
+                </executions>
+            </plugin>
+        </plugins>
+    </build>
+
 </project>
```

**File**: `langchain4j-core-jackson3/src/main/java/dev/langchain4j/jackson3/Jackson3Defaults.java` (modified, +16/-7)
```diff
@@ -3,14 +3,17 @@
 import dev.langchain4j.Internal;
 import tools.jackson.databind.DeserializationFeature;
 import tools.jackson.databind.MapperFeature;
+import tools.jackson.databind.SerializationFeature;
 import tools.jackson.databind.cfg.CoercionAction;
 import tools.jackson.databind.cfg.CoercionInputShape;
+import tools.jackson.databind.cfg.EnumFeature;
 import tools.jackson.databind.json.JsonMapper;
 import tools.jackson.databind.type.LogicalType;
 /**
  * Jackson 3 changed a number of defaults. Every codec in this module restores the Jackson 2
- * values, so that swapping the JSON library does not also change behaviour. Adopting any of the
- * new defaults should be a deliberate, separately tested decision.
+ * values, so that swapping the JSON library does not also change behaviour. The few differences
+ * that remain are deliberate, listed in the Jackson 3 guide and covered by tests; adopting any
+ * other new default should be a deliberate, separately tested decision too.
  */
 @Internal
 public final class Jackson3Defaults {
@@ -23,15 +26,21 @@ public static JsonMapper.Builder pinJackson2Defaults(JsonMapper.Builder builder)
                 .disable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
                 .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                 .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
+                .disable(EnumFeature.READ_ENUMS_USING_TO_STRING)
+                .disable(EnumFeature.WRITE_ENUMS_USING_TO_STRING)
+                // with parameter names, a one-argument constructor stops accepting a plain value
+                // and a constructor is preferred over the no-argument one
+                .disable(MapperFeature.DETECT_PARAMETER_NAMES)
                 // Jackson 3 disables these; without the first, final collection fields are
                 // silently left empty on deserialization
                 .enable(MapperFeature.ALLOW_FINAL_FIELDS_AS_MUTATORS)
                 .enable(MapperFeature.USE_GETTERS_AS_SETTERS)
-                // Jackson 2 reads "" as null for an enum rather than failing, and providers do
-                // send it - an OpenAI-compatible server returning "type": "" for a tool call is
-                // what found this. Scoped to enums on purpose: Jackson 2 fails on "" for a POJO,
-                // a Map or a List, so coercing those too would make this codec more lenient than
-                // the one it stands in for.
+                .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
+                .enable(SerializationFeature.FAIL_ON_EMPTY_BEANS)
+                // Deliberately more lenient than Jackson 2, which fails on "" for an enum: providers
+                // send it - an OpenAI-compatible server returning "type": "" for a tool call is what
+                // found this - and an LLM may answer "" for an optional enum. Scoped to enums on
+                // purpose, so that "" for a POJO, a Map or a List still fails as it does under Jackson 2.
                 .withCoercionConfig(
                         LogicalType.Enum,
                         config -> config.setCoercion(CoercionInputShape.EmptyString, CoercionAction.AsNull));
```

**File**: `langchain4j-core-jackson3/src/main/java/dev/langchain4j/jackson3/Jackson3JsonCodec.java` (modified, +6/-1)
```diff
@@ -14,6 +14,7 @@
 import tools.jackson.databind.introspect.JacksonAnnotationIntrospector;
 import tools.jackson.databind.json.JsonMapper;
 import static com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility.ANY;
+import static com.fasterxml.jackson.annotation.PropertyAccessor.CREATOR;
 import static com.fasterxml.jackson.annotation.PropertyAccessor.FIELD;
 
 
@@ -31,11 +32,15 @@ public class Jackson3JsonCodec implements Json.JsonCodec {
 
     static ObjectMapper createObjectMapper() {
         return Jackson3Defaults.pinJackson2Defaults(JsonMapper.builder())
-                .changeDefaultVisibility(vc -> vc.withVisibility(FIELD, ANY))
+                .changeDefaultVisibility(vc -> vc.withVisibility(FIELD, ANY).withVisibility(CREATOR, ANY))
                 // same intent as the Jackson 2 codec
                 .disable(SerializationFeature.INDENT_OUTPUT)
                 .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                 .enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)
+                // together with CREATOR visibility above: the Jackson 2 codec gets the same from
+                // jackson-module-parameter-names, which findAndRegisterModules() picks up in Spring
+                // Boot and Quarkus applications
+                .enable(MapperFeature.DETECT_PARAMETER_NAMES)
                 // the Jackson 2 codec calls findAndRegisterModules(); without the same here, a
                 // user's own datatype module - Kotlin, Guava, Joda - would be picked up on the
                 // default codec and silently dropped on this one
```

**File**: `langchain4j-core-jackson3/src/test/java/dev/langchain4j/jackson3/Jackson3DefaultsTest.java` (added, +429/-0)
```diff
@@ -0,0 +1,429 @@
+package dev.langchain4j.jackson3;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.assertThatThrownBy;
+
+import com.fasterxml.jackson.annotation.JsonAlias;
+import com.fasterxml.jackson.annotation.JsonCreator;
+import com.fasterxml.jackson.annotation.JsonProperty;
+import com.fasterxml.jackson.annotation.JsonValue;
+import dev.langchain4j.exception.JsonReadException;
+import dev.langchain4j.exception.JsonWriteException;
+import dev.langchain4j.internal.Json;
+import dev.langchain4j.internal.ProviderJson;
+import dev.langchain4j.internal.ProviderJsonSpec;
+import java.lang.reflect.Constructor;
+import java.time.Month;
+import java.util.ArrayList;
+import java.util.Date;
+import java.util.EnumMap;
+import java.util.List;
+import java.util.Locale;
+import java.util.Map;
+import java.util.Set;
+import java.util.TreeSet;
+import org.junit.jupiter.api.Test;
+import tools.jackson.databind.DeserializationFeature;
+import tools.jackson.databind.MapperFeature;
+import tools.jackson.databind.ObjectMapper;
+import tools.jackson.databind.SerializationFeature;
+import tools.jackson.databind.cfg.DatatypeFeature;
+import tools.jackson.databind.cfg.DateTimeFeature;
+import tools.jackson.databind.cfg.EnumFeature;
+import tools.jackson.databind.cfg.JsonNodeFeature;
+import tools.jackson.databind.json.JsonMapper;
+
+/**
+ * The Jackson 3 defaults that {@link Jackson3Defaults} sets back to Jackson 2's values, and the
+ * differences from Jackson 2 that are kept on purpose (listed in the Jackson 3 guide). Where the
+ * Jackson 2 counterpart of a codec is on the classpath, the same input goes through both codecs,
+ * so the tests check parity rather than what Jackson 2 is believed to do.
+ */
+class Jackson3DefaultsTest {
+
+    private static final Json.JsonCodec JACKSON_2 = jackson2("dev.langchain4j.internal.JacksonJsonCodec");
+    private static final Json.JsonCodec JACKSON_3 = new Jackson3JsonCodec();
+    private static final List<Json.JsonCodec> BOTH = List.of(JACKSON_2, JACKSON_3);
+
+    private static final Json.JsonCodec PROVIDER = ProviderJson.codec(ProviderJsonSpec.builder().build());
+
+    // ---------- set back to Jackson 2 ----------
+
+    @Test
+    void an_enum_is_read_and_written_by_name() {
+        for (Json.JsonCodec codec : BOTH) {
+            assertThat(codec.fromJson("{\"priority\":\"HIGH\"}", Task.class).priority)
+                    .as(name(codec))
+                    .isEqualTo(Priority.HIGH);
+            assertThat(codec.toJson(task(Priority.LOW))).as(name(codec)).isEqualTo("{\"priority\":\"LOW\"}");
+        }
+        assertThat(PROVIDER.fromJson("{\"priority\":\"HIGH\"}", Task.class).priority)
+                .isEqualTo(Priority.HIGH);
+        assertThat(PROVIDER.toJson(task(Priority.LOW))).isEqualTo("{\"priority\":\"LOW\"}");
+    }
+
+    @Test
+    void an_enum_map_key_is_read_and_written_by_name() {
+        for (Json.JsonCodec codec : BOTH) {
+            ByPriority byPriority = new ByPriority();
+            byPriority.owners = new EnumMap<>(Map.of(Priority.HIGH, "alice"));
+
+            assertThat(codec.toJson(byPriority)).as(name(codec)).isEqualTo("{\"owners\":{\"HIGH\":\"alice\"}}");
+            assertThat(codec.fromJson("{\"owners\":{\"LOW\":\"bob\"}}", ByPriority.class).owners)
+                    .as(name(codec))
+                    .containsEntry(Priority.LOW, "bob");
+        }
+    }
+
+    @Test
+    void json_alias_reads_a_former_to_string_value_and_json_value_keeps_to_string() {
+        for (Json.JsonCodec codec : BOTH) {
+            assertThat(codec.fromJson("{\"level\":\"Level high\"}", WithAliasedLevel.class).level)
+                    .as(name(codec))
+                    .isEqualTo(AliasedLevel.HIGH);
+            assertThat(codec.fromJson("{\"level\":\"HIGH\"}", WithAliasedLevel.class).level)
+                    .as(name(codec))
+                    .isEqualTo(AliasedLevel.HIGH);
+
+            WithValuedLevel valued = new WithValuedLevel();
+            valued.level = ValuedLevel.LOW;
+            assertThat(codec.toJson(valued)).as(name(codec)).isEqualTo("{\"level\":\"Level low\"}");
+            assertThat(codec.fromJson("{\"level\":\"Level low\"}", WithValuedLevel.class).level)
+                    .as(name(codec))
+                    .isEqualTo(ValuedLevel.LOW);
+        }
+    }
+
+    // this module's tests are compiled with -parameters, as Spring Boot and Quarkus applications are
+
+    @Test
+    void structured_output_detects_constructors_from_parameter_names() {
+        assertThat(JACKSON_3.fromJson("{\"title\":\"x\",\"priority\":2}", ConstructorOnly.class).title)
+                .isEqualTo("x");
+        assertThat(JACKSON_3.fromJson("{\"value\":\"abc\"}", UserId.class).value).isEqualTo("abc");
+    }
+
+    @Test
+    void other_codecs_do_not_detect_constructors_from_parameter_names() {
+        Jackson3ToolSpecificationJsonCodec codec = new Jackson3ToolSpecificati
```

**File**: `langchain4j-google-ai-gemini/src/test/java/dev/langchain4j/model/googleai/FunctionMapperTest.java` (modified, +15/-0)
```diff
@@ -499,4 +499,19 @@ private static String withoutNullValues(String toString) {
         return toString.replaceAll("(, )?(?<=(, |\\())[^\\s(]+?=null(?:, )?", " ")
                 .replaceFirst(", \\)$", ")");
     }
+
+    @Test
+    void should_write_built_in_tools_as_empty_objects() {
+        GeminiTool tool = new GeminiTool(
+                null,
+                new GeminiTool.GeminiCodeExecution(),
+                new GeminiTool.GeminiGoogleSearchRetrieval(),
+                new GeminiTool.GeminiUrlContext(),
+                null);
+
+        assertThat(Json.toJsonWithoutIndent(tool))
+                .contains("\"codeExecution\":{}")
+                .contains("\"google_search\":{}")
+                .contains("\"urlContext\":{}");
+    }
 }
```

**File**: `langchain4j-google-ai-gemini/src/test/java/dev/langchain4j/model/googleai/GeminiEnumLocaleTest.java` (modified, +4/-4)
```diff
@@ -79,12 +79,12 @@ void should_serialize_enums_independently_of_default_locale(String languageTag)
         var code = new GeminiExecutableCode(GeminiLanguage.LANGUAGE_UNSPECIFIED, "print(1)");
         var result = new GeminiCodeExecutionResult(GeminiOutcome.OUTCOME_FAILED, "failed");
 
-        // Jackson 2 uses enum names; the optional Jackson 3 codec uses toString().
-        assertThat(codec.fromJson(codec.toJson(schema), Map.class).get("type")).isIn("INTEGER", "integer");
+        // Gemini expects enum names on the wire, whichever codec is used.
+        assertThat(codec.fromJson(codec.toJson(schema), Map.class).get("type")).isEqualTo("INTEGER");
         assertThat(codec.fromJson(codec.toJson(code), Map.class).get("programmingLanguage"))
-                .isIn("LANGUAGE_UNSPECIFIED", "language_unspecified");
+                .isEqualTo("LANGUAGE_UNSPECIFIED");
         assertThat(codec.fromJson(codec.toJson(result), Map.class).get("outcome"))
-                .isIn("OUTCOME_FAILED", "outcome_failed");
+                .isEqualTo("OUTCOME_FAILED");
         assertThat(codec.fromJson(codec.toJson(GeminiType.INTEGER), GeminiType.class))
                 .isEqualTo(GeminiType.INTEGER);
         assertThat(codec.fromJson(codec.toJson(code), GeminiExecutableCode.class))
```

**File**: `langchain4j-google-ai-gemini/src/test/java/dev/langchain4j/model/googleai/PartsAndContentsMapperTest.java` (modified, +24/-0)
```diff
@@ -375,6 +375,30 @@ void fromGPartsToAiMessage_rendersExecutableCodeAsFencedBlock() {
         assertThat(result.text()).isEqualTo("Code executed:\n```python\nprint(1)\n```\n");
     }
 
+    @Test
+    void fromGPartsToAiMessage_rendersCodeExecutionResultParsedFromResponse() {
+        // Given
+        String json = """
+                {
+                  "candidates": [{
+                    "content": {
+                      "role": "model",
+                      "parts": [{"codeExecutionResult": {"outcome": "OUTCOME_OK", "output": "1"}}]
+                    }
+                  }]
+                }
+                """;
+        GeminiGenerateContentResponse response = Json.fromJson(json, GeminiGenerateContentResponse.class);
+        List<GeminiContent.GeminiPart> parts =
+                response.candidates().get(0).content().parts();
+
+        // When
+        AiMessage result = PartsAndContentsMapper.fromGPartsToAiMessage(parts, true, null);
+
+        // Then
+        assertThat(result.text()).isEqualTo("Output:\n```\n1```\n");
+    }
+
     @Test
     void fromGPartsToAiMessage_ignoresNonImageInlineData() {
         // Given
```

---

### Incident Patch 10: `0a2f7371` (2026-10-01)
**Commit Message**: fix(openai): deserialize image token details with Jackson 3 and expose image token usage (#6450)

## Issue

Closes #6449.

With the Jackson 3 opt-in, an OpenAI image response containing
`usage.input_tokens_details` or `usage.output_tokens_details` throws
`JsonReadException` because `ImageUsage.TokensDetails` has no recognized
creator.

## Change

### Fix
- Add `@JsonCreator` to the builder-taking `TokensDetails` constructor,
matching the enclosing `ImageUsage`.
- Expose `TokensDetailsBuilder` fields through `@JsonAutoDetect`, so
`image_tokens` and `text_tokens` are populated. Adding the creator alone
stops the exception but silently produces null token counts.
- Add a regression test through the actual OpenAI JSON entry point that
checks input/output detail values and aggregate counts, plus a test for
partial details with unknown fields. Both run with the default codec and
the existing `jackson3` Maven profile.

### Preventing the same gap in other DTOs
- `OpenAiBuilderCreatorParityTest` only compared DTOs that already had a
`@JsonCreator`, so a DTO missing it was skipped silently. It now also
fails when any builder-based DTO (`@JsonDeserialize(builder = ...)`)
lacks the `@JsonCrea

**File**: `docs/docs/integrations/image-models/dall-e.md` (modified, +19/-0)
```diff
@@ -89,6 +89,25 @@ langchain4j.open-ai.image-model.timeout=...
 langchain4j.open-ai.image-model.user=...
 ```
 
+## Token usage
+
+GPT image models report how many tokens a request used. `OpenAiImageModel` returns this as an
+`OpenAiImageTokenUsage`, which also splits the input and output tokens into image tokens and text
+tokens (OpenAI prices them differently):
+
+```java
+Response<Image> response = model.generate("A watercolor painting of a lighthouse");
+
+OpenAiImageTokenUsage tokenUsage = (OpenAiImageTokenUsage) response.tokenUsage();
+tokenUsage.inputTokenCount();                    // all input tokens
+tokenUsage.inputTokensDetails().textTokens();    // input tokens from the prompt
+tokenUsage.inputTokensDetails().imageTokens();   // input tokens from input images (edits)
+tokenUsage.outputTokenCount();                   // all output tokens
+```
+
+The details are `null` when OpenAI does not report them. DALL·E models do not report usage at all,
+so for them `response.tokenUsage()` is `null`.
+
 ## Examples
 
 - [OpenAiImageModelExamples](https://github.com/langchain4j/langchain4j-examples/blob/main/open-ai-examples/src/main/java/OpenAiImageModelExamples.java)
```

**File**: `docs/docs/tutorials/jackson-3.md` (modified, +8/-4)
```diff
@@ -178,9 +178,12 @@ ProviderJson.codec(ProviderJsonSpec.builder()
 If a single field needs a different name, `@JsonProperty("...")` works under both, because it comes
 from `jackson-annotations`, the artifact the two versions share.
 
-**A builder-based DTO needs `@JsonCreator`.** `@JsonDeserialize(builder = ...)` is also a `databind`
-annotation, so under Jackson 3 the DTO is instead built through the `@JsonCreator` on the
-constructor that takes the builder. Both have to be present.
+**A builder-based DTO needs `@JsonCreator` and field visibility on its builder.**
+`@JsonDeserialize(builder = ...)` is also a `databind` annotation, so under Jackson 3 the DTO is
+instead built through the `@JsonCreator` on the constructor that takes the builder. Jackson 3 fills
+that builder by writing its private fields, so the builder also needs
+`@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY)`. Without it, the response parses
+without an error but the fields stay `null`. All three have to be present.
 
 **Whether a builder method runs depends on the annotations on it.** This is the part to
 internalise, because it is silent and the rule is not the one you would guess. Jackson 2 fills a
@@ -227,7 +230,8 @@ that needs the full artifact, is covered by `langchain4j-jackson3`'s own tests a
 `langchain4j-open-ai` also carries `OpenAiBuilderCreatorParityTest`, which compares every
 builder-based DTO built through its builder against the same DTO parsed from `{}`. That is the
 difference the missing `build()` call above produces, so the test catches it for the whole of the
-OpenAI wire model at once rather than one field at a time.
+OpenAI wire model at once rather than one field at a time. The same test also fails when a
+builder-based DTO is missing the `@JsonCreator` or its builder is missing `@JsonAutoDetect`.
 
 ## If you plug in your own JSON
 
```

**File**: `langchain4j-open-ai/src/main/java/dev/langchain4j/model/openai/OpenAiImageModel.java` (modified, +35/-6)
```diff
@@ -16,6 +16,7 @@
 import dev.langchain4j.model.openai.internal.image.GenerateImagesResponse;
 import dev.langchain4j.model.openai.internal.image.ImageData;
 import dev.langchain4j.model.openai.internal.image.ImageFile;
+import dev.langchain4j.model.openai.internal.image.ImageUsage;
 import dev.langchain4j.model.openai.spi.OpenAiImageModelBuilderFactory;
 import dev.langchain4j.model.output.Response;
 import java.time.Duration;
@@ -84,7 +85,8 @@ public Response<Image> generate(String prompt) {
         GenerateImagesResponse response =
                 withRetryMappingExceptions(() -> client.imagesGeneration(request).execute(), maxRetries);
 
-        return Response.from(fromImageData(response.data().get(0), response.outputFormat()));
+        return Response.from(
+                fromImageData(response.data().get(0), response.outputFormat()), tokenUsageFrom(response.usage()));
     }
 
     @Override
@@ -95,9 +97,11 @@ public Response<List<Image>> generate(String prompt, int n) {
                 withRetryMappingExceptions(() -> client.imagesGeneration(request).execute(), maxRetries);
 
         String responseOutputFormat = response.outputFormat();
-        return Response.from(response.data().stream()
-                .map(data -> fromImageData(data, responseOutputFormat))
-                .collect(Collectors.toList()));
+        return Response.from(
+                response.data().stream()
+                        .map(data -> fromImageData(data, responseOutputFormat))
+                        .collect(Collectors.toList()),
+                tokenUsageFrom(response.usage()));
     }
 
     @Override
@@ -107,7 +111,8 @@ public Response<Image> edit(Image image, String prompt) {
         GenerateImagesResponse response =
                 withRetryMappingExceptions(() -> client.imagesEdit(request).execute(), maxRetries);
 
-        return Response.from(fromImageData(response.data().get(0), response.outputFormat()));
+        return Response.from(
+                fromImageData(response.data().get(0), response.outputFormat()), tokenUsageFrom(response.usage()));
     }
 
     @Override
@@ -118,7 +123,8 @@ public Response<Image> edit(Image image, Image mask, String prompt) {
         GenerateImagesResponse response =
                 withRetryMappingExceptions(() -> client.imagesEdit(request).execute(), maxRetries);
 
-        return Response.from(fromImageData(response.data().get(0), response.outputFormat()));
+        return Response.from(
+                fromImageData(response.data().get(0), response.outputFormat()), tokenUsageFrom(response.usage()));
     }
 
     public static OpenAiImageModelBuilder builder() {
@@ -294,6 +300,29 @@ private static Image fromImageData(ImageData data, String outputFormat) {
         return imageBuilder.build();
     }
 
+    private static OpenAiImageTokenUsage tokenUsageFrom(ImageUsage usage) {
+        if (usage == null) {
+            return null;
+        }
+        return OpenAiImageTokenUsage.builder()
+                .inputTokenCount(usage.inputTokens())
+                .inputTokensDetails(tokensDetailsFrom(usage.inputTokensDetails()))
+                .outputTokenCount(usage.outputTokens())
+                .outputTokensDetails(tokensDetailsFrom(usage.outputTokensDetails()))
+                .totalTokenCount(usage.totalTokens())
+                .build();
+    }
+
+    private static OpenAiImageTokenUsage.TokensDetails tokensDetailsFrom(ImageUsage.TokensDetails details) {
+        if (details == null) {
+            return null;
+        }
+        return OpenAiImageTokenUsage.TokensDetails.builder()
+                .imageTokens(details.imageTokens())
+                .textTokens(details.textTokens())
+                .build();
+    }
+
     private GenerateImagesRequest.Builder requestBuilder(String prompt) {
         return GenerateImagesRequest.builder()
                 .model(modelName)
```

**File**: `langchain4j-open-ai/src/main/java/dev/langchain4j/model/openai/OpenAiImageTokenUsage.java` (added, +220/-0)
```diff
@@ -0,0 +1,220 @@
+package dev.langchain4j.model.openai;
+
+import dev.langchain4j.model.output.TokenUsage;
+import java.util.Objects;
+
+/**
+ * Token usage of an OpenAI image generation or edit request, as returned by {@link OpenAiImageModel}
+ * in {@link dev.langchain4j.model.output.Response#tokenUsage()}.
+ * <p>
+ * In addition to the input, output and total token counts, it reports how many of the input and
+ * output tokens were image tokens and how many were text tokens. OpenAI prices these differently,
+ * so the split is needed to compute the cost of a request.
+ * <p>
+ * Only models that report usage (such as {@code gpt-image-1}) return it. For other models (such as
+ * {@code dall-e-3}), {@code Response#tokenUsage()} is {@code null}.
+ *
+ * @since 1.21.0
+ */
+public class OpenAiImageTokenUsage extends TokenUsage {
+
+    private final TokensDetails inputTokensDetails;
+    private final TokensDetails outputTokensDetails;
+
+    private OpenAiImageTokenUsage(Builder builder) {
+        super(builder.inputTokenCount, builder.outputTokenCount, builder.totalTokenCount);
+        this.inputTokensDetails = builder.inputTokensDetails;
+        this.outputTokensDetails = builder.outputTokensDetails;
+    }
+
+    /**
+     * Returns the breakdown of the input tokens into image and text tokens,
+     * or {@code null} if OpenAI did not report it.
+     */
+    public TokensDetails inputTokensDetails() {
+        return inputTokensDetails;
+    }
+
+    /**
+     * Returns the breakdown of the output tokens into image and text tokens,
+     * or {@code null} if OpenAI did not report it.
+     */
+    public TokensDetails outputTokensDetails() {
+        return outputTokensDetails;
+    }
+
+    @Override
+    public OpenAiImageTokenUsage add(TokenUsage that) {
+        if (that == null) {
+            return this;
+        }
+
+        TokensDetails thatInputTokensDetails = null;
+        TokensDetails thatOutputTokensDetails = null;
+        if (that instanceof OpenAiImageTokenUsage thatImageTokenUsage) {
+            thatInputTokensDetails = thatImageTokenUsage.inputTokensDetails;
+            thatOutputTokensDetails = thatImageTokenUsage.outputTokensDetails;
+        }
+
+        return OpenAiImageTokenUsage.builder()
+                .inputTokenCount(sum(this.inputTokenCount(), that.inputTokenCount()))
+                .inputTokensDetails(TokensDetails.sum(this.inputTokensDetails, thatInputTokensDetails))
+                .outputTokenCount(sum(this.outputTokenCount(), that.outputTokenCount()))
+                .outputTokensDetails(TokensDetails.sum(this.outputTokensDetails, thatOutputTokensDetails))
+                .totalTokenCount(sum(this.totalTokenCount(), that.totalTokenCount()))
+                .build();
+    }
+
+    @Override
+    public boolean equals(Object o) {
+        if (this == o) return true;
+        if (o == null || getClass() != o.getClass()) return false;
+        if (!super.equals(o)) return false;
+        OpenAiImageTokenUsage that = (OpenAiImageTokenUsage) o;
+        return Objects.equals(inputTokensDetails, that.inputTokensDetails)
+                && Objects.equals(outputTokensDetails, that.outputTokensDetails);
+    }
+
+    @Override
+    public int hashCode() {
+        return Objects.hash(super.hashCode(), inputTokensDetails, outputTokensDetails);
+    }
+
+    @Override
+    public String toString() {
+        return "OpenAiImageTokenUsage {" + " inputTokenCount = "
+                + inputTokenCount() + ", inputTokensDetails = "
+                + inputTokensDetails + ", outputTokenCount = "
+                + outputTokenCount() + ", outputTokensDetails = "
+                + outputTokensDetails + ", totalTokenCount = "
+                + totalTokenCount() + " }";
+    }
+
+    public static Builder builder() {
+        return new Builder();
+    }
+
+    public static class Builder {
+
+        private Integer inputTokenCount;
+        private TokensDetails inputTokensDetails;
+        private Integer outputTokenCount;
+        private TokensDetails outputTokensDetails;
+        private Integer totalTokenCount;
+
+        public Builder inputTokenCount(Integer inputTokenCount) {
+            this.inputTokenCount = inputTokenCount;
+            return this;
+        }
+
+        public Builder inputTokensDetails(TokensDetails inputTokensDetails) {
+            this.inputTokensDetails = inputTokensDetails;
+            return this;
+        }
+
+        public Builder outputTokenCount(Integer outputTokenCount) {
+            this.outputTokenCount = outputTokenCount;
+            return this;
+        }
+
+        public Builder outputTokensDetails(TokensDetails outputTokensDetails) {
+            this.outputTokensDetails = outputTokensDetails;
+            return this;
+        }
+
+        public Builder totalTokenCount(Integer totalTokenCount) {
+            this.totalTokenCount = totalTokenCount;
+            return this;
+        }
+
+        public OpenAiImage
```

**File**: `langchain4j-open-ai/src/main/java/dev/langchain4j/model/openai/internal/image/ImageUsage.java` (modified, +2/-0)
```diff
@@ -144,6 +144,7 @@ public static class TokensDetails {
         @JsonProperty
         private final Integer textTokens;
 
+        @JsonCreator
         public TokensDetails(TokensDetailsBuilder builder) {
             this.imageTokens = builder.imageTokens;
             this.textTokens = builder.textTokens;
@@ -184,6 +185,7 @@ public static TokensDetailsBuilder builder() {
 
         @JsonPOJOBuilder(withPrefix = "")
         @JsonIgnoreProperties(ignoreUnknown = true)
+        @JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY)
         public static class TokensDetailsBuilder {
 
             private Integer imageTokens;
```

**File**: `langchain4j-open-ai/src/test/java/dev/langchain4j/model/openai/OpenAiImageModelIT.java` (modified, +7/-0)
```diff
@@ -40,6 +40,13 @@ void simple_image_generation_works() {
         Image image = response.content();
         assertThat(image.base64Data()).isNotNull().isNotBlank();
         assertThat(image.mimeType()).isNotNull();
+
+        OpenAiImageTokenUsage tokenUsage = (OpenAiImageTokenUsage) response.tokenUsage();
+        assertThat(tokenUsage.inputTokenCount()).isPositive();
+        assertThat(tokenUsage.inputTokensDetails().textTokens()).isPositive();
+        assertThat(tokenUsage.outputTokenCount()).isPositive();
+        assertThat(tokenUsage.totalTokenCount())
+                .isEqualTo(tokenUsage.inputTokenCount() + tokenUsage.outputTokenCount());
     }
 
     @Test
```

**File**: `langchain4j-open-ai/src/test/java/dev/langchain4j/model/openai/OpenAiImageModelTokenUsageTest.java` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+package dev.langchain4j.model.openai;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+import dev.langchain4j.data.image.Image;
+import dev.langchain4j.http.client.MockHttpClient;
+import dev.langchain4j.http.client.MockHttpClientBuilder;
+import dev.langchain4j.http.client.SuccessfulHttpResponse;
+import dev.langchain4j.model.output.Response;
+import java.util.List;
+import org.junit.jupiter.api.Test;
+
+class OpenAiImageModelTokenUsageTest {
+
+    private static final OpenAiImageTokenUsage EXPECTED_TOKEN_USAGE = OpenAiImageTokenUsage.builder()
+            .inputTokenCount(10)
+            .inputTokensDetails(OpenAiImageTokenUsage.TokensDetails.builder()
+                    .imageTokens(7)
+                    .textTokens(3)
+                    .build())
+            .outputTokenCount(20)
+            .outputTokensDetails(OpenAiImageTokenUsage.TokensDetails.builder()
+                    .imageTokens(18)
+                    .textTokens(2)
+                    .build())
+            .totalTokenCount(30)
+            .build();
+
+    @Test
+    void should_return_token_usage_with_image_and_text_details() {
+        OpenAiImageModel model = modelRespondingWith(
+                """
+                {
+                  "created": 1,
+                  "data": [{"b64_json": "aW1hZ2U="}],
+                  "usage": {
+                    "input_tokens": 10,
+                    "output_tokens": 20,
+                    "total_tokens": 30,
+                    "input_tokens_details": {"image_tokens": 7, "text_tokens": 3},
+                    "output_tokens_details": {"image_tokens": 18, "text_tokens": 2}
+                  }
+                }
+                """);
+
+        Response<Image> response = model.generate("a cat");
+
+        assertThat(response.tokenUsage()).isEqualTo(EXPECTED_TOKEN_USAGE);
+    }
+
+    @Test
+    void should_return_token_usage_when_generating_multiple_images() {
+        OpenAiImageModel model = modelRespondingWith(
+                """
+                {
+                  "created": 1,
+                  "data": [{"b64_json": "aW1hZ2U="}, {"b64_json": "aW1hZ2U="}],
+                  "usage": {
+                    "input_tokens": 10,
+                    "output_tokens": 20,
+                    "total_tokens": 30,
+                    "input_tokens_details": {"image_tokens": 7, "text_tokens": 3},
+                    "output_tokens_details": {"image_tokens": 18, "text_tokens": 2}
+                  }
+                }
+                """);
+
+        Response<List<Image>> response = model.generate("a cat", 2);
+
+        assertThat(response.content()).hasSize(2);
+        assertThat(response.tokenUsage()).isEqualTo(EXPECTED_TOKEN_USAGE);
+    }
+
+    @Test
+    void should_return_null_token_usage_when_model_does_not_report_usage() {
+        // dall-e models do not return usage
+        OpenAiImageModel model = modelRespondingWith(
+                """
+                {
+                  "created": 1,
+                  "data": [{"url": "https://example.com/image.png"}]
+                }
+                """);
+
+        Response<Image> response = model.generate("a cat");
+
+        assertThat(response.tokenUsage()).isNull();
+    }
+
+    private static OpenAiImageModel modelRespondingWith(String body) {
+        MockHttpClient mockHttpClient = MockHttpClient.thatAlwaysResponds(
+                SuccessfulHttpResponse.builder().statusCode(200).body(body).build());
+        return OpenAiImageModel.builder()
+                .httpClientBuilder(new MockHttpClientBuilder(mockHttpClient))
+                .apiKey("banana")
+                .modelName("gpt-image-1")
+                .build();
+    }
+}
```

**File**: `langchain4j-open-ai/src/test/java/dev/langchain4j/model/openai/OpenAiImageTokenUsageTest.java` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+package dev.langchain4j.model.openai;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+import dev.langchain4j.model.output.TokenUsage;
+import org.junit.jupiter.api.Test;
+
+class OpenAiImageTokenUsageTest {
+
+    @Test
+    void should_add_token_usages_with_details() {
+        // given
+        OpenAiImageTokenUsage tokenUsage1 = OpenAiImageTokenUsage.builder()
+                .inputTokenCount(10)
+                .inputTokensDetails(OpenAiImageTokenUsage.TokensDetails.builder()
+                        .imageTokens(7)
+                        .textTokens(3)
+                        .build())
+                .outputTokenCount(20)
+                .outputTokensDetails(OpenAiImageTokenUsage.TokensDetails.builder()
+                        .imageTokens(20)
+                        .build())
+                .totalTokenCount(30)
+                .build();
+
+        OpenAiImageTokenUsage tokenUsage2 = OpenAiImageTokenUsage.builder()
+                .inputTokenCount(5)
+                .inputTokensDetails(OpenAiImageTokenUsage.TokensDetails.builder()
+                        .imageTokens(1)
+                        .textTokens(4)
+                        .build())
+                .outputTokenCount(40)
+                .outputTokensDetails(OpenAiImageTokenUsage.TokensDetails.builder()
+                        .imageTokens(40)
+                        .build())
+                .totalTokenCount(45)
+                .build();
+
+        // when
+        OpenAiImageTokenUsage result = tokenUsage1.add(tokenUsage2);
+
+        // then
+        assertThat(result)
+                .isEqualTo(OpenAiImageTokenUsage.builder()
+                        .inputTokenCount(15)
+                        .inputTokensDetails(OpenAiImageTokenUsage.TokensDetails.builder()
+                                .imageTokens(8)
+                                .textTokens(7)
+                                .build())
+                        .outputTokenCount(60)
+                        .outputTokensDetails(OpenAiImageTokenUsage.TokensDetails.builder()
+                                .imageTokens(60)
+                                .build())
+                        .totalTokenCount(75)
+                        .build());
+    }
+
+    @Test
+    void should_keep_details_when_only_one_side_has_them() {
+        // given
+        OpenAiImageTokenUsage.TokensDetails details = OpenAiImageTokenUsage.TokensDetails.builder()
+                .imageTokens(7)
+                .textTokens(3)
+                .build();
+        OpenAiImageTokenUsage tokenUsage1 = OpenAiImageTokenUsage.builder()
+                .inputTokenCount(10)
+                .inputTokensDetails(details)
+                .build();
+        OpenAiImageTokenUsage tokenUsage2 =
+                OpenAiImageTokenUsage.builder().inputTokenCount(5).build();
+
+        // when
+        OpenAiImageTokenUsage result = tokenUsage1.add(tokenUsage2);
+
+        // then
+        assertThat(result.inputTokenCount()).isEqualTo(15);
+        assertThat(result.inputTokensDetails()).isEqualTo(details);
+        assertThat(result.outputTokensDetails()).isNull();
+    }
+
+    @Test
+    void should_add_plain_token_usage() {
+        // given
+        OpenAiImageTokenUsage.TokensDetails details =
+                OpenAiImageTokenUsage.TokensDetails.builder().imageTokens(7).build();
+        OpenAiImageTokenUsage tokenUsage = OpenAiImageTokenUsage.builder()
+                .inputTokenCount(10)
+                .inputTokensDetails(details)
+                .outputTokenCount(20)
+                .totalTokenCount(30)
+                .build();
+
+        // when
+        OpenAiImageTokenUsage result = tokenUsage.add(new TokenUsage(1, 2, 3));
+
+        // then
+        assertThat(result.inputTokenCount()).isEqualTo(11);
+        assertThat(result.outputTokenCount()).isEqualTo(22);
+        assertThat(result.totalTokenCount()).isEqualTo(33);
+        assertThat(result.inputTokensDetails()).isEqualTo(details);
+    }
+
+    @Test
+    void should_handle_null_token_usage_when_adding() {
+        // given
+        OpenAiImageTokenUsage tokenUsage =
+                OpenAiImageTokenUsage.builder().inputTokenCount(10).build();
+
+        // when
+        OpenAiImageTokenUsage result = tokenUsage.add(null);
+
+        // then
+        assertThat(result).isEqualTo(tokenUsage);
+    }
+}
```

---

### Incident Patch 11: `a318c071` (2026-10-01)
**Commit Message**: fix: trim whitespace when coercing tool enum arguments (#6551)

## Issue
Fixes #6549

## Change
`DefaultToolExecutor.coerceArgument` now trims leading/trailing
whitespace on enum tool arguments before `Enum.valueOf` and before the
existing uppercase fallback.

Some models return enum names with surrounding spaces (e.g. `"
Presentation"`), which made both lookup attempts fail even though the
trimmed value matches a constant. Unit tests cover leading/trailing/both
whitespace (including the uppercase path) and keep invalid values
failing.

Related prior fix: #5778 (locale-independent uppercase); this adds trim
only.

## General checklist
<!-- Please double-check the following points and mark them like this:
[X] -->
- [x] There are no breaking changes (API, behaviour)
- [x] I have added unit and/or integration tests for my change
- [x] The tests cover both positive and negative cases
- [x] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green
- [ ] I have manually run all the unit and integration tests in the
[core](https://github.com/langchain4j/langchain4j/tree/main/langchain4j-core)
and
[main](https://github.com/langchain4j

**File**: `langchain4j/src/main/java/dev/langchain4j/service/tool/DefaultToolExecutor.java` (modified, +6/-7)
```diff
@@ -8,8 +8,8 @@
 import static dev.langchain4j.internal.Utils.getOrDefault;
 import static dev.langchain4j.internal.Utils.isNotNullOrBlank;
 import static dev.langchain4j.internal.ValidationUtils.ensureNotNull;
-import static dev.langchain4j.spi.ServiceHelper.loadFactories;
 import static dev.langchain4j.service.tool.ToolExecutionRequestUtil.argumentsAsMap;
+import static dev.langchain4j.spi.ServiceHelper.loadFactories;
 
 import dev.langchain4j.agent.tool.P;
 import dev.langchain4j.agent.tool.Tool;
@@ -166,7 +166,8 @@ public ToolExecutionResult executeWithContext(ToolExecutionRequest request, Invo
      * the calling thread, like the default implementation.
      */
     @Override
-    public CompletableFuture<ToolExecutionResult> executeAsync(ToolExecutionRequest request, InvocationContext context) {
+    public CompletableFuture<ToolExecutionResult> executeAsync(
+            ToolExecutionRequest request, InvocationContext context) {
         Object[] arguments = prepareArguments(request, context);
 
         Object result;
@@ -452,14 +453,12 @@ static Object coerceArgument(Object argument, String parameterName, Class<?> par
             try {
                 @SuppressWarnings({"unchecked", "rawtypes"})
                 Class<Enum> enumClass = (Class<Enum>) parameterClass;
+                String enumValue = Objects.requireNonNull(argument).toString().strip();
                 try {
-                    return Enum.valueOf(
-                            enumClass, Objects.requireNonNull(argument).toString());
+                    return Enum.valueOf(enumClass, enumValue);
                 } catch (IllegalArgumentException e) {
                     // try to convert to uppercase as a last resort
-                    return Enum.valueOf(
-                            enumClass,
-                            Objects.requireNonNull(argument).toString().toUpperCase(Locale.ROOT));
+                    return Enum.valueOf(enumClass, enumValue.toUpperCase(Locale.ROOT));
                 }
             } catch (Exception | Error e) {
                 throw new IllegalArgumentException(
```

**File**: `langchain4j/src/test/java/dev/langchain4j/service/tool/DefaultToolExecutorTest.java` (modified, +12/-4)
```diff
@@ -18,7 +18,6 @@
 import dev.langchain4j.exception.ToolArgumentsException;
 import dev.langchain4j.invocation.InvocationContext;
 import java.lang.reflect.Method;
-import java.util.concurrent.CompletableFuture;
 import java.math.BigDecimal;
 import java.math.BigInteger;
 import java.util.HashMap;
@@ -28,6 +27,7 @@
 import java.util.Optional;
 import java.util.Set;
 import java.util.UUID;
+import java.util.concurrent.CompletableFuture;
 import org.assertj.core.api.WithAssertions;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.params.ParameterizedTest;
@@ -171,9 +171,17 @@ void coerce_argument() {
         assertThat(coerceArgument("A", "arg", ExampleEnum.class, null)).isEqualTo(ExampleEnum.A);
         assertThat(coerceArgument(ExampleEnum.A, "arg", ExampleEnum.class, null))
                 .isEqualTo(ExampleEnum.A);
+        assertThat(coerceArgument(" A", "arg", ExampleEnum.class, null)).isEqualTo(ExampleEnum.A);
+        assertThat(coerceArgument("A ", "arg", ExampleEnum.class, null)).isEqualTo(ExampleEnum.A);
+        assertThat(coerceArgument(" a ", "arg", ExampleEnum.class, null)).isEqualTo(ExampleEnum.A);
+        assertThat(coerceArgument("\u2002A\u2002", "arg", ExampleEnum.class, null))
+                .isEqualTo(ExampleEnum.A);
         assertThatExceptionOfType(IllegalArgumentException.class)
                 .isThrownBy(() -> coerceArgument("D", "arg", ExampleEnum.class, null))
                 .withMessageContaining("Argument \"arg\" is not a valid enum value for");
+        assertThatExceptionOfType(IllegalArgumentException.class)
+                .isThrownBy(() -> coerceArgument(" D ", "arg", ExampleEnum.class, null))
+                .withMessageContaining("Argument \"arg\" is not a valid enum value for");
 
         assertThat(coerceArgument(true, "arg", boolean.class, null)).isEqualTo(true);
         assertThat(coerceArgument(Boolean.FALSE, "arg", boolean.class, null)).isEqualTo(false);
@@ -990,9 +998,9 @@ private ToolExecutionResult executeAsync(String methodName) throws Exception {
                 .name(methodName)
                 .arguments("{}")
                 .build();
-        return executor.executeAsync(request, InvocationContext.builder()
-                        .chatMemoryId("DEFAULT")
-                        .build())
+        return executor.executeAsync(
+                        request,
+                        InvocationContext.builder().chatMemoryId("DEFAULT").build())
                 .get();
     }
 
```

---

### Incident Patch 12: `53466fc5` (2026-10-01)
**Commit Message**: fix(google-genai): surface generated images from chat responses (#6457)

## Issue

Fixes #6456

## Change

`GoogleGenAiContentMapper.toChatResponse` now reads `part.inlineData()`.
An image the model generated lands in `AiMessage.attributes` under
`GENERATED_IMAGES_KEY`, which is what `AiMessage.images()` reads. Only
`image/` mime types get picked up, which is the same filter the old
module uses.

Before this the image was dropped on the floor. The mapper is shared, so
the non-streaming, streaming and batch chat models were all affected.

Second spot, on the streaming path: `GoogleGenAiStreamingChatModel`
merged each chunk with `attributes.putAll(...)`, which lets a later
chunk replace what an earlier one put under the same key. For images
that meant only the last chunk's survived. Chunks are merged for that
key now, so images accumulate.

Both changes follow what `langchain4j-google-ai-gemini` already does:
`PartsAndContentsMapper` maps `inlineData` into the same key (#3641) and
`GeminiStreamingResponseBuilder` merges it across chunks (#5972).

Tests:

- `GoogleGenAiContentMapperTest` covers the mapping: one image, several
images in one response, text alongside an image, and the tw

**File**: `docs/docs/integrations/language-models/google-genai.md` (modified, +31/-0)
```diff
@@ -33,6 +33,7 @@ https://github.com/googleapis/java-genai
 - [Token Usage](#token-usage)
 - [Multimodality (Audio, Video, PDF)](#multimodality-audio-video-pdf)
 - [Audio Transcription](#audio-transcription)
+- [Image Generation Output](#image-generation-output)
 - [Token Count Estimator](#token-count-estimator)
 - [Model Catalog](#model-catalog)
 
@@ -721,6 +722,36 @@ for (Part part : metadata.rawResponse().parts()) {
 `GoogleGenAiStreamingChatModel` accepts the same `audioTranscriptionConfig`, but its raw response only holds the last streamed chunk,
 so use `GoogleGenAiChatModel` when you need word timestamps or speaker labels.
 
+## Image Generation Output
+
+Some Gemini models, such as `gemini-2.5-flash-image`, return generated pictures alongside the text of a chat
+response. They arrive as `inlineData` parts, and `GoogleGenAiChatModel` maps them into the `AiMessage` attributes
+under `GENERATED_IMAGES_KEY`, which is what `AiMessage.images()` reads:
+
+```java
+ChatModel model = GoogleGenAiChatModel.builder()
+    .apiKey(System.getenv("GOOGLE_AI_GEMINI_API_KEY"))
+    .modelName("gemini-2.5-flash-image")
+    .build();
+
+ChatResponse response = model.chat(UserMessage.from("A watercolor sketch of a lighthouse at dusk"));
+
+for (Image image : response.aiMessage().images()) {
+    System.out.println("Generated image: " + image.mimeType());
+
+    // Save it, display it, or hand it to another model
+    Files.write(Paths.get("generated_image.png"), Base64.getDecoder().decode(image.base64Data()));
+}
+```
+
+Only `image/*` blobs become generated images; inline data of any other type is ignored.
+
+Streaming responses work the same way. `GoogleGenAiStreamingChatModel` receives the answer one chunk at a time, and
+every chunk contributes its images to the final message, so a picture that arrives on its own chunk is not lost.
+
+`langchain4j-google-ai-gemini` stores generated images under the same key, so the same reading code works with
+either module.
+
 ## Token Count Estimator
 
 You can accurately estimate the number of tokens in your prompts and messages using the `GoogleGenAiTokenCountEstimator`, which uses the official SDK's counting endpoints.
```

**File**: `langchain4j-google-genai/src/main/java/dev/langchain4j/model/google/genai/GoogleGenAiContentMapper.java` (modified, +31/-0)
```diff
@@ -1,9 +1,11 @@
 package dev.langchain4j.model.google.genai;
 
+import static dev.langchain4j.data.message.AiMessage.GENERATED_IMAGES_KEY;
 import static dev.langchain4j.internal.Exceptions.illegalArgument;
 import static dev.langchain4j.internal.Utils.getOrDefault;
 import static dev.langchain4j.internal.Utils.isNullOrEmpty;
 
+import com.google.genai.types.Blob;
 import com.google.genai.types.Candidate;
 import com.google.genai.types.Content;
 import com.google.genai.types.FunctionCall;
@@ -37,6 +39,7 @@
 import java.util.List;
 import java.util.Locale;
 import java.util.Map;
+import java.util.Optional;
 import java.util.UUID;
 import java.util.stream.Collectors;
 
@@ -286,6 +289,7 @@ static ChatResponse toChatResponse(GenerateContentResponse response, String mode
         StringBuilder thinkingBuilder = new StringBuilder();
         List<ToolExecutionRequest> toolRequests = new ArrayList<>();
         Map<String, Object> attributes = new HashMap<>();
+        List<Image> generatedImages = new ArrayList<>();
 
         if (content != null) {
             List<Part> parts = content.parts().orElse(List.of());
@@ -323,6 +327,8 @@ static ChatResponse toChatResponse(GenerateContentResponse response, String mode
                             .arguments(jsonArgs)
                             .build());
                 }
+
+                toGeneratedImage(part).ifPresent(generatedImages::add);
             }
 
             if (!parts.isEmpty()) {
@@ -335,6 +341,10 @@ static ChatResponse toChatResponse(GenerateContentResponse response, String mode
                                     .encodeToString(lastPart.thoughtSignature().get()));
                 }
             }
+
+            if (!generatedImages.isEmpty()) {
+                attributes.put(GENERATED_IMAGES_KEY, generatedImages);
+            }
         }
 
         String text = textBuilder.toString();
@@ -375,6 +385,27 @@ static ChatResponse toChatResponse(GenerateContentResponse response, String mode
         return ChatResponse.builder().aiMessage(aiMessage).metadata(metadata).build();
     }
 
+    /**
+     * Reads an image the model generated into the given part. Only image blobs are picked up, which is
+     * what {@code PartsAndContentsMapper} does in {@code langchain4j-google-ai-gemini}; any other inline
+     * data is left alone.
+     */
+    private static Optional<Image> toGeneratedImage(Part part) {
+        if (part.inlineData().isEmpty()) {
+            return Optional.empty();
+        }
+        Blob blob = part.inlineData().get();
+        if (blob.mimeType().isEmpty()
+                || !blob.mimeType().get().startsWith("image/")
+                || blob.data().isEmpty()) {
+            return Optional.empty();
+        }
+        return Optional.of(Image.builder()
+                .base64Data(Base64.getEncoder().encodeToString(blob.data().get()))
+                .mimeType(blob.mimeType().get())
+                .build());
+    }
+
     private static void appendTranscription(StringBuilder textBuilder, Transcription transcription) {
         String text = transcription
                 .text()
```

**File**: `langchain4j-google-genai/src/main/java/dev/langchain4j/model/google/genai/GoogleGenAiStreamingChatModel.java` (modified, +23/-1)
```diff
@@ -1,5 +1,6 @@
 package dev.langchain4j.model.google.genai;
 
+import static dev.langchain4j.data.message.AiMessage.GENERATED_IMAGES_KEY;
 import static dev.langchain4j.internal.InternalStreamingChatResponseHandlerUtils.onUnmappedRawEvent;
 import static dev.langchain4j.internal.Utils.copy;
 import static dev.langchain4j.internal.Utils.getOrDefault;
@@ -192,7 +193,7 @@ public void doChat(ChatRequest chatRequest, StreamingChatResponseHandler handler
 
                     if (aiMessage.attributes() != null
                             && !aiMessage.attributes().isEmpty()) {
-                        attributes.putAll(aiMessage.attributes());
+                        mergeAttributes(attributes, aiMessage.attributes());
                     }
 
                     if (aiMessage.thinking() != null && !aiMessage.thinking().isEmpty()) {
@@ -309,6 +310,27 @@ public static Builder builder() {
         return new Builder();
     }
 
+    /**
+     * Copies the attributes of one chunk into the attributes accumulated so far. Generated images are
+     * concatenated rather than replaced, because each chunk carries its own images and the last chunk
+     * would otherwise discard the ones before it.
+     */
+    private static void mergeAttributes(Map<String, Object> accumulated, Map<String, Object> partial) {
+        partial.forEach((key, value) -> {
+            if (GENERATED_IMAGES_KEY.equals(key)) {
+                accumulated.merge(key, value, GoogleGenAiStreamingChatModel::concatenate);
+            } else {
+                accumulated.put(key, value);
+            }
+        });
+    }
+
+    private static Object concatenate(Object accumulated, Object added) {
+        List<Object> concatenated = new ArrayList<>((List<?>) accumulated);
+        concatenated.addAll((List<?>) added);
+        return concatenated;
+    }
+
     public static class Builder {
 
         private Client client;
```

**File**: `langchain4j-google-genai/src/test/java/dev/langchain4j/model/google/genai/GoogleGenAiContentMapperTest.java` (modified, +66/-0)
```diff
@@ -8,6 +8,7 @@
 import static org.assertj.core.api.Assertions.assertThat;
 import static org.assertj.core.api.Assertions.assertThatThrownBy;
 
+import com.google.genai.types.Blob;
 import com.google.genai.types.Candidate;
 import com.google.genai.types.Content;
 import com.google.genai.types.FinishReason;
@@ -30,6 +31,7 @@
 import dev.langchain4j.data.message.UserMessage;
 import dev.langchain4j.model.chat.response.ChatResponse;
 import java.net.URI;
+import java.nio.charset.StandardCharsets;
 import java.nio.file.Files;
 import java.nio.file.Path;
 import java.util.Base64;
@@ -1090,6 +1092,64 @@ void should_build_text_from_words_when_audio_transcription_has_no_text() {
         assertThat(result.aiMessage().text()).isEqualTo("Hello world Hi");
     }
 
+    @Test
+    void should_collect_a_generated_image_from_inline_data() {
+        byte[] pngBytes = "fake-png-bytes".getBytes(StandardCharsets.UTF_8);
+
+        ChatResponse result = GoogleGenAiContentMapper.toChatResponse(
+                responseWithParts(imagePart(pngBytes, "image/png")), "gemini-2.5-flash-image");
+
+        assertThat(result.aiMessage().images()).hasSize(1);
+        Image generatedImage = result.aiMessage().images().get(0);
+        assertThat(generatedImage.mimeType()).isEqualTo("image/png");
+        assertThat(generatedImage.base64Data()).isEqualTo(Base64.getEncoder().encodeToString(pngBytes));
+    }
+
+    @Test
+    void should_collect_every_generated_image_returned_in_one_response() {
+        ChatResponse result = GoogleGenAiContentMapper.toChatResponse(
+                responseWithParts(
+                        imagePart("first".getBytes(StandardCharsets.UTF_8), "image/png"),
+                        imagePart("second".getBytes(StandardCharsets.UTF_8), "image/jpeg")),
+                "gemini-2.5-flash-image");
+
+        assertThat(result.aiMessage().images()).hasSize(2);
+        assertThat(result.aiMessage().images().get(0).mimeType()).isEqualTo("image/png");
+        assertThat(result.aiMessage().images().get(1).mimeType()).isEqualTo("image/jpeg");
+    }
+
+    @Test
+    void should_keep_text_alongside_a_generated_image() {
+        ChatResponse result = GoogleGenAiContentMapper.toChatResponse(
+                responseWithParts(
+                        Part.builder().text("Here is your picture").build(),
+                        imagePart("bytes".getBytes(StandardCharsets.UTF_8), "image/png")),
+                "gemini-2.5-flash-image");
+
+        assertThat(result.aiMessage().text()).isEqualTo("Here is your picture");
+        assertThat(result.aiMessage().images()).hasSize(1);
+    }
+
+    @Test
+    void should_ignore_inline_data_that_is_not_an_image() {
+        ChatResponse result = GoogleGenAiContentMapper.toChatResponse(
+                responseWithParts(imagePart("audio-bytes".getBytes(StandardCharsets.UTF_8), "audio/mpeg")),
+                "gemini-2.5-flash-image");
+
+        assertThat(result.aiMessage().images()).isEmpty();
+    }
+
+    @Test
+    void should_ignore_inline_data_without_a_mime_type() {
+        Blob blob =
+                Blob.builder().data("bytes".getBytes(StandardCharsets.UTF_8)).build();
+
+        ChatResponse result = GoogleGenAiContentMapper.toChatResponse(
+                responseWithParts(Part.builder().inlineData(blob).build()), "gemini-2.5-flash-image");
+
+        assertThat(result.aiMessage().images()).isEmpty();
+    }
+
     private static GenerateContentResponse responseWithParts(Part... parts) {
         return GenerateContentResponse.builder()
                 .candidates(List.of(Candidate.builder()
@@ -1098,6 +1158,12 @@ private static GenerateContentResponse responseWithParts(Part... parts) {
                 .build();
     }
 
+    private static Part imagePart(byte[] data, String mimeType) {
+        return Part.builder()
+                .inlineData(Blob.builder().data(data).mimeType(mimeType).build())
+                .build();
+    }
+
     private static Part transcriptionPart(Transcription transcription) {
         return Part.builder().audioTranscription(transcription).build();
     }
```

**File**: `langchain4j-google-genai/src/test/java/dev/langchain4j/model/google/genai/GoogleGenAiStreamingChatModelTest.java` (modified, +69/-0)
```diff
@@ -10,6 +10,7 @@
 import com.google.genai.Models;
 import com.google.genai.ResponseStream;
 import com.google.genai.types.AudioTranscriptionConfig;
+import com.google.genai.types.Blob;
 import com.google.genai.types.Candidate;
 import com.google.genai.types.Content;
 import com.google.genai.types.FunctionCall;
@@ -29,6 +30,7 @@
 import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
 import dev.langchain4j.model.output.FinishReason;
 import java.lang.reflect.Field;
+import java.nio.charset.StandardCharsets;
 import java.time.Duration;
 import java.util.ArrayList;
 import java.util.Base64;
@@ -281,6 +283,73 @@ public void onError(Throwable error) {
                 .isEqualTo(encodedSig);
     }
 
+    @Test
+    void should_keep_the_images_of_every_streaming_chunk() throws Exception {
+        Client client = mock(Client.class);
+        Models models = mock(Models.class);
+        Field modelsField = Client.class.getDeclaredField("models");
+        modelsField.setAccessible(true);
+        modelsField.set(client, models);
+
+        @SuppressWarnings("unchecked")
+        ResponseStream<GenerateContentResponse> stream = mock(ResponseStream.class);
+
+        when(models.generateContentStream(any(String.class), any(List.class), any()))
+                .thenReturn(stream);
+
+        GenerateContentResponse firstChunk = responseWithImage("first-image");
+        GenerateContentResponse secondChunk = responseWithImage("second-image");
+
+        when(stream.iterator()).thenReturn(List.of(firstChunk, secondChunk).iterator());
+
+        GoogleGenAiStreamingChatModel model = GoogleGenAiStreamingChatModel.builder()
+                .client(client)
+                .modelName("gemini-2.5-flash-image")
+                .build();
+
+        CompletableFuture<ChatResponse> future = new CompletableFuture<>();
+
+        model.chat(List.of(UserMessage.from("Draw me two pictures")), new StreamingChatResponseHandler() {
+            @Override
+            public void onPartialResponse(String partialResponse) {}
+
+            @Override
+            public void onCompleteResponse(ChatResponse completeResponse) {
+                future.complete(completeResponse);
+            }
+
+            @Override
+            public void onError(Throwable error) {
+                future.completeExceptionally(error);
+            }
+        });
+
+        ChatResponse response = future.get(5, TimeUnit.SECONDS);
+
+        assertThat(response.aiMessage().images()).hasSize(2);
+        assertThat(response.aiMessage().images().get(0).base64Data())
+                .isEqualTo(Base64.getEncoder().encodeToString("first-image".getBytes(StandardCharsets.UTF_8)));
+        assertThat(response.aiMessage().images().get(1).base64Data())
+                .isEqualTo(Base64.getEncoder().encodeToString("second-image".getBytes(StandardCharsets.UTF_8)));
+    }
+
+    private static GenerateContentResponse responseWithImage(String data) {
+        Part part = Part.builder()
+                .inlineData(Blob.builder()
+                        .data(data.getBytes(StandardCharsets.UTF_8))
+                        .mimeType("image/png")
+                        .build())
+                .build();
+        return GenerateContentResponse.builder()
+                .candidates(List.of(Candidate.builder()
+                        .content(Content.builder()
+                                .role("model")
+                                .parts(List.of(part))
+                                .build())
+                        .build()))
+                .build();
+    }
+
     @Test
     void should_not_overwrite_truncation_finish_reason_with_stop() throws Exception {
         Client client = mock(Client.class);
```

---

### Incident Patch 13: `79051d67` (2026-10-01)
**Commit Message**: fix: Widen float metadata values to double in Infinispan IN and NOT IN filters (#5953)

## Issue

Closes #5952

## Change

`InfinispanMetadataFilterMapper` renders `Float` metadata values two
different ways.

`=`, `>`, `<` go through `getDoubleValue()`, which returns `((Float)
value).doubleValue()`.

`IN` / `NOT IN` go through `formattedComparisonValue(Object, boolean
asFloat)`, whose widening branch only covers `Integer` and `Long`, so a
`Float` falls through to `value.toString()`.

Both target the `value_float` column, declared `Type.Scalar.DOUBLE` in
`LangchainSchemaCreator`, and `LangChainMetadataMarshaller.writeTo()`
stores a `Float` there as `((Float) value).doubleValue()`.
`metadataKey("score").isIn(1.1f)` therefore emits `IN (1.1)` while
`isEqualTo(1.1f)` emits `= 1.100000023841858`.

This widens every `Number` when the mapper has selected `value_float`,
matching what `computeFilter()` already does:

```java
if (asFloat) {
    return String.valueOf(((Number) value).doubleValue());
}
```

`Integer` and `Long` keep their current output, `Double` is unchanged
because `String.valueOf(double)` is `Double.toString()`, and
non-`value_float` filters are untouched.

Tests: the `inFi

**File**: `langchain4j-infinispan/src/main/java/dev/langchain4j/store/embedding/infinispan/InfinispanMetadataFilterMapper.java` (modified, +3/-1)
```diff
@@ -204,7 +204,9 @@ private String formattedComparisonValue(Object value, boolean asFloat) {
         if (!(value instanceof Number)) {
             return "'" + escape(String.valueOf(value)) + "'";
         }
-        if (asFloat && (value instanceof Integer || value instanceof Long)) {
+        if (asFloat) {
+            // value_float is a protobuf double and LangChainMetadataMarshaller stores a Float as
+            // ((Float) value).doubleValue(), so widen every Number here the same way computeFilter() does.
             return String.valueOf(((Number) value).doubleValue());
         }
         return value.toString();
```

**File**: `langchain4j-infinispan/src/test/java/dev/langchain4j/store/embedding/infinispan/InfinispanMetadataFilterMapperTest.java` (modified, +27/-1)
```diff
@@ -136,7 +136,7 @@ static List<Arguments> inFilters() {
                 // Float IsIn
                 Arguments.of(
                         new IsIn("scores", Arrays.asList(1.1f, 2.2f, 3.3f)),
-                        "m0.name='scores' and m0.value_float IN (3.3, 1.1, 2.2)",
+                        "m0.name='scores' and m0.value_float IN (3.299999952316284, 1.100000023841858, 2.200000047683716)",
                         " join i.metadata m0"));
     }
 
@@ -380,6 +380,32 @@ void should_handle_mixed_numeric_types_in_in_filter() {
         assertThat(result.query).isEqualTo("m0.name='mixed' and m0.value_float IN (3.0, 4.0, 1.0, 2.0)");
     }
 
+    @Test
+    void should_widen_float_to_double_in_in_filter() {
+        // given — 1.1f is not exactly representable, so Float.toString() and doubleValue() differ
+        Filter filter = new IsIn("score", Arrays.asList(1.1f));
+
+        // when
+        InfinispanMetadataFilterMapper.FilterResult result = mapper.map(filter);
+
+        // then — same literal as IsEqualTo("score", 1.1f) produces for the same value_float column
+        assertThat(result.query).isEqualTo("m0.name='score' and m0.value_float IN (1.100000023841858)");
+    }
+
+    @Test
+    void should_widen_float_to_double_in_not_in_filter() {
+        // given
+        Filter filter = new IsNotIn("score", Arrays.asList(1.1f));
+
+        // when
+        InfinispanMetadataFilterMapper.FilterResult result = mapper.map(filter);
+
+        // then
+        assertThat(result.query)
+                .isEqualTo(
+                        "(m0.value_float NOT IN (1.100000023841858) and m0.name='score') OR (m0.value_float IN (1.100000023841858) and m0.name!='score') OR (i.metadata is null) ");
+    }
+
     @ParameterizedTest
     @MethodSource("numericInColumnSelection")
     void should_select_in_column_independently_of_iteration_order(List<?> values, String expectedColumn) {
```

---

### Incident Patch 14: `204a1cde` (2026-09-30)
**Commit Message**: fix(a2a): Stateless a2a agent (#6418)

## Issue
Closes #6371 

## Change
Removed taskid automatically saved in scope.

## General checklist
<!-- Please double-check the following points and mark them like this:
[X] -->
- [ ] There are no breaking changes (API, behaviour)
- [x] I have added unit and/or integration tests for my change
- [x] The tests cover both positive and negative cases
- [x] I have manually run all the unit and integration tests in the
module I have added/changed, and they are all green
- [x] I have manually run all the unit and integration tests in the
[core](https://github.com/langchain4j/langchain4j/tree/main/langchain4j-core)
and
[main](https://github.com/langchain4j/langchain4j/tree/main/langchain4j)
modules, and they are all green
- [X] I have added/updated the
[documentation](https://github.com/langchain4j/langchain4j/tree/main/docs/docs)
- [X] I have added an example in the [examples
repo](https://github.com/langchain4j/langchain4j-examples) (only for
"big" features)
- [ ] I have added/updated [Spring Boot
starter(s)](https://github.com/langchain4j/langchain4j-spring) (if
applicable)

---------

Co-authored-by: w1nstep <[REDACTED_EMAIL]>
Co-authored-by: Ma

**File**: `docs/docs/tutorials/agents.md` (modified, +14/-10)
```diff
@@ -3096,7 +3096,7 @@ The remote A2A agent must return a [Task](https://a2a-protocol.org/latest/specif
 
 ### Multi-turn conversations with A2A servers
 
-The A2A protocol supports multi-turn conversations through `contextId` and `taskId` fields on the message envelope. A `contextId` groups related tasks into a conversation, while a `taskId` references a specific task within that conversation. When omitted, the A2A server generates new values; when provided, the server continues the existing conversation.
+The A2A protocol supports multi-turn conversations through `contextId` and `taskId` fields on the message envelope. A `contextId` groups related tasks into a conversation, while a `taskId` references a specific task within that conversation. When omitted, the A2A server generates new values; when a `taskId` is provided, the server continues that existing task instead of creating a new one.
 
 To pass these fields on the outgoing message envelope, annotate method parameters with `@A2AContextId` and `@A2ATaskId`. These parameters are **not** sent as message content — they are set on the message envelope instead.
 
@@ -3112,9 +3112,13 @@ public interface ChatAgent {
 
 When `null` is passed for `contextId` or `taskId`, the field is omitted from the envelope and the server creates new values.
 
-When the `@A2AContextId` or `@A2ATaskId` parameters also have recognizable names, possibly configured through the `@V` annotation, the server-assigned values from the response are automatically written back to the `AgenticScope` under that name. This enables multi-turn flows where the first call captures the IDs and subsequent calls reuse them.
+When the `@A2AContextId` parameter also has a recognizable name, possibly configured through the `@V` annotation, the server-assigned value from the response is automatically written back to the `AgenticScope` under that name. This enables multi-turn flows, where the first call captures the context and subsequent calls continue the same conversation: the server keeps the context and creates a new task in it for every invocation.
 
-If the method returns `ResultWithAgenticScope`, the IDs are accessible directly:
+The `taskId` follows a different rule: it is written back to the `AgenticScope` only when the remote task is still open at the moment the invocation returns, and the scope entry is cleared otherwise. An invocation normally returns once its task has reached a terminal state, and the A2A server rejects any further message sent to such a task, so in the common case nothing is propagated and the next invocation starts a fresh task. The one exception is a [streaming client listener](#streaming-a2a-client-listener) that stops consuming the stream early: the remote task keeps running, and its identifier is kept in the scope so that it can still be polled, canceled or continued.
+
+Outside of that case the `taskId` is taken from the invocation arguments: pass `null` (or omit the parameter) to let the server create a new task, or pass the identifier of an existing task to continue it.
+
+If the method returns `ResultWithAgenticScope`, the context is accessible directly:
 
 ```java
 public interface ChatAgent {
@@ -3129,13 +3133,13 @@ public interface ChatAgent {
 // First turn — server generates contextId and taskId
 ResultWithAgenticScope<String> first = chatAgent.chat("hello", null, null);
 String contextId = (String) first.agenticScope().readState("contextId");
-String taskId = (String) first.agenticScope().readState("taskId");
 
-// Second turn — reuse the server-generated IDs to continue the conversation
-ResultWithAgenticScope<String> second = chatAgent.chat("follow-up", contextId, taskId);
+// Second turn — reuse the server-generated context to continue the conversation,
+// while letting the server create a new task for this invocation
+ResultWithAgenticScope<String> second = chatAgent.chat("follow-up", contextId, null);
 ```
 
-In this way, when an A2A agent is used in an agentic system, the `contextId` and `taskId` are automatically propagated through the shared `AgenticScope`. This means a sequence of two A2A calls to the same server will naturally form a multi-turn conversation:
+In this way, when an A2A agent is used in an agentic system, the `contextId` is automatically propagated through the shared `AgenticScope`. This means a sequence of two A2A calls to the same server will naturally form a multi-turn conversation:
 
 ```java
 public interface EchoSubAgent {
@@ -3166,7 +3170,7 @@ MultiTurnWorkflow workflow = AgenticServices.sequenceBuilder(MultiTurnWorkflow.c
 ResultWithAgenticScope<String> result = workflow.converse("hello");
 ```
 
-In this sequence, the first agent sends a message with no `contextId`/`taskId` (they are `null` in the scope). The server creates a new task and context. The response IDs are written to the scope. When the second agent runs, it reads the now-populated `contextId` and `taskId` from the scope and sends them on the message envelope, 
```

**File**: `langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/DefaultA2AClientBuilder.java` (modified, +32/-21)
```diff
@@ -67,7 +67,7 @@ public class DefaultA2AClientBuilder<T> implements A2AClientBuilder<T>, Internal
     private static final String RESPONSE_STATE_PREFIX = "a2a.response.";
 
     private record A2AInvocationResult(
-            Object parsedResult, String contextIdKey, String contextId, String taskIdKey, String taskId) {}
+            Object parsedResult, String contextIdKey, String contextId, String taskIdKey, String openTaskId) {}
 
     private final ServiceOutputParser serviceOutputParser = new ServiceOutputParser();
 
@@ -189,8 +189,11 @@ public Object invoke(Object proxy, Method method, Object[] args) throws Exceptio
         if (result.contextIdKey != null && result.contextId != null) {
             scope.writeState(result.contextIdKey, result.contextId);
         }
-        if (result.taskIdKey != null && result.taskId != null) {
-            scope.writeState(result.taskIdKey, result.taskId);
+        if (result.taskIdKey != null) {
+            // The task id is propagated only while the remote task is still open: a task that already
+            // reached a terminal state cannot accept further messages, so its id must not survive in
+            // the scope for the next invocation
+            scope.writeState(result.taskIdKey, result.openTaskId);
         }
 
         return method.getReturnType() == ResultWithAgenticScope.class
@@ -286,11 +289,15 @@ private A2AInvocationResult invokeAgent(Method method, Type returnType, Object[]
 
         LOG.debug("Response: {}", response.text);
         Object parsedResult = serviceOutputParser.parseText(returnType, response.text);
-        return new A2AInvocationResult(parsedResult, contextIdKey, response.contextId, taskIdKey, response.taskId);
+        return new A2AInvocationResult(parsedResult, contextIdKey, response.contextId, taskIdKey, response.openTaskId);
     }
 
+    /**
+     * @param openTaskId the id of the remote task if it was still running when this response was
+     *     produced, {@code null} if the task reached a terminal state or no task was created.
+     */
     private record A2AResponse(
-            String text, String contextId, String taskId, A2ATaskInterruptedException interruption) {}
+            String text, String contextId, String openTaskId, A2ATaskInterruptedException interruption) {}
 
     static void suspend(AgenticScope scope, String agentId, A2ATaskInterruptedException interruption) {
         String responseId = agentId + ":" + interruption.taskId();
@@ -324,9 +331,9 @@ static Message continuationMessage(A2ATaskInterruptedException interruption, Str
     private A2AResponse sendMessage(Message message, String callTenant) throws A2AClientException {
         final CompletableFuture<String> messageResponse = new CompletableFuture<>();
         AtomicReference<String> responseContextId = new AtomicReference<>();
-        AtomicReference<String> responseTaskId = new AtomicReference<>();
+        AtomicReference<String> openTaskId = new AtomicReference<>();
         List<BiConsumer<ClientEvent, AgentCard>> consumers =
-                getEventConsumers(responseContextId, responseTaskId, messageResponse);
+                getEventConsumers(responseContextId, openTaskId, messageResponse);
         Consumer<Throwable> streamingErrorHandler = error -> handleStreamEnd(error, messageResponse);
         if (callTenant != null) {
             a2aClient.sendMessage(
@@ -343,14 +350,14 @@ private A2AResponse sendMessage(Message message, String callTenant) throws A2ACl
 
         try {
             String responseText = messageResponse.get();
-            return new A2AResponse(responseText, responseContextId.get(), responseTaskId.get(), null);
+            return new A2AResponse(responseText, responseContextId.get(), openTaskId.get(), null);
         } catch (InterruptedException e) {
             Thread.currentThread().interrupt();
             LOG.error("Failed to get response: {}", e.getMessage(), e);
             throw new RuntimeException("Failed to get response: " + e.getMessage(), e);
         } catch (ExecutionException e) {
             if (e.getCause() instanceof A2ATaskInterruptedException interruption) {
-                return new A2AResponse(null, interruption.contextId(), interruption.taskId(), interruption);
+                return new A2AResponse(null, interruption.contextId(), null, interruption);
             }
             LOG.error("Failed to get response: {}", e.getMessage(), e);
             if (e.getCause() instanceof RuntimeException runtimeException) {
@@ -362,7 +369,7 @@ private A2AResponse sendMessage(Message message, String callTenant) throws A2ACl
 
     private List<BiConsumer<ClientEvent, AgentCard>> getEventConsumers(
             AtomicReference<String> responseContextId,
-            AtomicReference<String> responseTaskId,
+            AtomicReference<String> openTaskId,
             CompletableFuture<String> messageResponse) {
 
         AtomicBoolean stopped = new AtomicBoolean(false);
@@ -
```

**File**: `langchain4j-agentic-a2a/src/test/java/dev/langchain4j/agentic/a2a/A2AAgentIT.java` (modified, +32/-33)
```diff
@@ -414,44 +414,44 @@ ResultWithAgenticScope<String> echo(
      * are set on the A2A Message envelope instead of becoming TextParts.
      *
      * The test does a two-turn conversation:
-     *   1st turn: null contextId/taskId → server generates them, returned in the AgenticScope
-     *   2nd turn: reuses those IDs via @A2AContextId/@A2ATaskId → server finds the existing task
+     *   1st turn: null contextId/taskId → server creates a new context and task; only the contextId
+     *             is written back to the AgenticScope, since the task is already completed
+     *   2nd turn: reuses the contextId via @A2AContextId and leaves taskId null, so the server
+     *             creates a new task in the same context
      *
      * Requires: a2a-echo-server running on port 8081
      *   cd langchain4j-agentic-a2a/a2a-echo-server
      *   mvn quarkus:dev
      */
     @Test
     @Disabled("Requires a2a-echo-server to be running on port 8081")
-    void a2a_client_agent_should_propagate_contextId_and_taskId_on_message_envelope() {
+    void a2a_client_agent_should_propagate_contextId_on_message_envelope() {
         EchoWithAgenticScopAgent echoAgent = AgenticServices.a2aBuilder(
                         A2A_ECHO_SERVER_URL, EchoWithAgenticScopAgent.class)
                 .outputKey("response")
                 .build();
 
         // FIRST TURN: no contextId/taskId → server creates new task and context
-        ResultWithAgenticScope<String> firstResult = echoAgent.echo("hello", null, null);
+        ResultWithAgenticScope<String> firstResult = echoAgent.echo("stop task1", null, null);
         System.out.println("First response: " + firstResult.result());
-        assertThat(firstResult.result()).contains("input=hello");
-
-        // Read server-generated IDs from the AgenticScope
+        assertThat(firstResult.result()).contains("input=stop task1");
+        // Read the server-generated context from the AgenticScope
         AgenticScope firstScope = firstResult.agenticScope();
         String serverContextId = (String) firstScope.readState("contextId");
-        String serverTaskId = (String) firstScope.readState("taskId");
         assertThat(serverContextId).isNotNull();
-        assertThat(serverTaskId).isNotNull();
+        // The task completed during this invocation, so its id is not reusable and not persisted
+        assertThat(firstScope.readState("taskId")).isNull();
 
-        // SECOND TURN: pass the server-generated IDs to continue the conversation
-        // Without the fix this throws TaskNotFoundError because the IDs end up as TextParts
-        ResultWithAgenticScope<String> secondResult =
-                echoAgent.echo("follow-up question", serverContextId, serverTaskId);
+        // SECOND TURN: pass the server-generated contextId to continue the conversation.
+        // The taskId is left null because the previous task already reached a terminal state.
+        ResultWithAgenticScope<String> secondResult = echoAgent.echo("stop task2", serverContextId, null);
         System.out.println("Second response: " + secondResult.result());
+        assertThat(secondResult.result()).contains("input=stop task2");
 
-        // The server should resolve to the same context and task
+        // The server should resolve to the same context, but run a new task in it
         AgenticScope secondScope = secondResult.agenticScope();
         assertThat(secondScope.readState("contextId", "")).isEqualTo(serverContextId);
-        assertThat(secondScope.readState("taskId", "")).isEqualTo(serverTaskId);
-        assertThat(secondResult.result()).contains("input=follow-up question");
+        assertThat(secondScope.readState("taskId")).isNull();
     }
 
     public interface EchoAgent {
@@ -476,17 +476,19 @@ public interface MultiTurnWorkflow extends AgenticScopeAccess {
      * Tests @A2AContextId/@A2ATaskId in a complete workflow-based agentic system.
      *
      * A sequence of two echo agents where:
-     *   1st agent: sends message with no contextId/taskId → server generates them → written to scope
-     *   2nd agent: reads contextId/taskId from scope → sends them on the message envelope → server
-     *              finds the existing task and continues the conversation
+     *   1st agent: sends message with no contextId/taskId → server creates a context and a task →
+     *              the context is written to the scope
+     *   2nd agent: reads the contextId from the scope → sends it on the message envelope → the server
+     *              continues the conversation by creating a new task in that context
      *
-     * This proves contextId/taskId flow through the AgenticScope across agents in a workflow.
+     * This proves the context flows through the AgenticScope across agents in a workflow, while each
+     * invocation gets a task of its own.
      *
      * Requires: a2a-echo-server running on port 8081
      */
     @Test
     @Disabled("Requires a2a-echo-server t
```

**File**: `langchain4j-agentic-a2a/src/test/java/dev/langchain4j/agentic/a2a/DefaultA2AClientBuilderInvokeTest.java` (added, +333/-0)
```diff
@@ -0,0 +1,333 @@
+package dev.langchain4j.agentic.a2a;
+
+import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.assertThatThrownBy;
+import static org.mockito.ArgumentMatchers.any;
+import static org.mockito.ArgumentMatchers.anyList;
+import static org.mockito.Mockito.doAnswer;
+import static org.mockito.Mockito.mock;
+
+import dev.langchain4j.agentic.observability.A2AStreamingClientListenerResult;
+import dev.langchain4j.agentic.scope.AgenticScope;
+import dev.langchain4j.agentic.scope.DefaultAgenticScope;
+import dev.langchain4j.agentic.scope.ResultWithAgenticScope;
+import dev.langchain4j.invocation.LangChain4jManaged;
+import dev.langchain4j.service.V;
+import java.lang.reflect.Method;
+import java.util.ArrayList;
+import java.util.List;
+import java.util.Map;
+import java.util.Queue;
+import java.util.concurrent.ConcurrentLinkedQueue;
+import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.function.BiConsumer;
+import java.util.function.Supplier;
+import org.a2aproject.sdk.client.Client;
+import org.a2aproject.sdk.client.ClientEvent;
+import org.a2aproject.sdk.client.MessageEvent;
+import org.a2aproject.sdk.client.TaskEvent;
+import org.a2aproject.sdk.client.TaskUpdateEvent;
+import org.a2aproject.sdk.spec.AgentCapabilities;
+import org.a2aproject.sdk.spec.AgentCard;
+import org.a2aproject.sdk.spec.Artifact;
+import org.a2aproject.sdk.spec.Message;
+import org.a2aproject.sdk.spec.Part;
+import org.a2aproject.sdk.spec.Task;
+import org.a2aproject.sdk.spec.TaskState;
+import org.a2aproject.sdk.spec.TaskStatus;
+import org.a2aproject.sdk.spec.TaskStatusUpdateEvent;
+import org.a2aproject.sdk.spec.TextPart;
+import org.junit.jupiter.api.Test;
+
+/**
+ * End-to-end tests for {@link DefaultA2AClientBuilder#invoke(Object, Method, Object[])}: the proxy
+ * call, the outgoing {@code Message}, the event consumption and the scope write-back, all running
+ * in-process against a mocked A2A {@link Client}.
+ *
+ * <p>These tests pin the stateless contract introduced for issue #6371: the taskId of a task that
+ * reached a terminal state is not written back into the {@code AgenticScope}, so repeating an
+ * invocation of the same agent starts a fresh task instead of sending a message to a task that can
+ * no longer accept one. The taskId of a task that is still open when the invocation returns — which
+ * only happens when a {@code streamingClientListener} stops consuming the stream early — is still
+ * propagated, since that task remains continuable, pollable and cancelable. The contextId
+ * write-back is intentionally kept (it identifies the conversation, and reusing it across tasks is
+ * legitimate multi-turn behaviour), so it is pinned here as well to protect it from being dropped
+ * later.
+ */
+class DefaultA2AClientBuilderInvokeTest {
+
+    interface EchoAgent {
+        ResultWithAgenticScope<String> echo(
+                @V("question") String question,
+                @A2AContextId @V("contextId") String contextId,
+                @A2ATaskId @V("taskId") String taskId);
+    }
+
+    private record MockedClient(Client client, List<Message> sentMessages) {}
+
+    private static AgentCard agentCard() {
+        return AgentCard.builder()
+                .name("echo")
+                .description("Echo agent for stateless contract tests")
+                .version("1.0.0")
+                .url("http://localhost")
+                .capabilities(new AgentCapabilities(false, false, false, List.of()))
+                .defaultInputModes(List.of("text"))
+                .defaultOutputModes(List.of("text"))
+                .skills(List.of())
+                .supportedInterfaces(List.of())
+                .build();
+    }
+
+    /**
+     * A mocked {@link Client} that captures every outgoing message and, on each invocation, replays
+     * the next queued event through the consumer list the builder registered, synchronously.
+     */
+    private static MockedClient clientReplaying(ClientEvent... events) {
+        AgentCard card = agentCard();
+        List<Message> sentMessages = new ArrayList<>();
+        Queue<ClientEvent> eventQueue = new ConcurrentLinkedQueue<>(List.of(events));
+        Client client = mock(Client.class);
+        doAnswer(invocation -> {
+                    sentMessages.add(invocation.getArgument(0, Message.class));
+                    List<BiConsumer<ClientEvent, AgentCard>> consumers = invocation.getArgument(1);
+                    ClientEvent event = eventQueue.poll();
+                    if (event != null) {
+                        consumers.get(0).accept(event, card);
+                    }
+                    return null;
+                })
+                .when(client)
+                .sendMessage(any(Message.class), anyList(), any(), any());
+        return new MockedClient(client, sentMessages);
+    }
+
+    private static DefaultA2AClientBuilder<EchoAgent> builder(Client client) {
+        r
```

---

### Incident Patch 15: `1a277ed6` (2026-09-30)
**Commit Message**: fix(a2a): preserve @A2ATenantId positional arg when tenant is pre-con… (#6548)

…figured

Dropping the arg caused Method.invoke() to fail with too few positional
args. Map it to an equivalent arg with the configured tenant as its
default value instead of filtering it out.

<!--
Thank you so much for your contribution!

Please fill in all the sections below.
Please open the PR as ready for review (not as a draft), with tests and
documentation already included.
Please note that PRs with breaking changes, or without tests and
documentation, will be rejected.

Please note that PRs will be reviewed based on the priority of the
issues they address.
We ask for your patience. We are doing our best to review your PR as
quickly as possible.
Please refrain from pinging and asking when it will be reviewed. Thank
you for understanding!
-->

## Issue
<!-- Please specify the ID of the issue this PR is addressing. For
example: "Closes #1234" or "Fixes #1234" -->
Closes #

## Change
<!-- Please describe the changes you made. -->


## General checklist
<!-- Please double-check the following points and mark them like this:
[X] -->
- [X] There are no breaking changes (API, behaviour)
- [X] I have adde

**File**: `langchain4j-agentic-a2a/src/main/java/dev/langchain4j/agentic/a2a/A2AClientAgentInvoker.java` (modified, +29/-9)
```diff
@@ -43,25 +43,45 @@ public A2AClientAgentInvoker(A2AClientInstance a2AClientInstance, Method method)
         this.arguments = arguments(a2AClientInstance);
     }
 
+    /**
+     * Builds the argument list for the agent method.
+     *
+     * <p>All three A2A protocol annotation types ({@link A2ATenantId}, {@link A2AContextId},
+     * {@link A2ATaskId}) are marked optional so they resolve gracefully at invocation time:
+     * context and task IDs fall back to {@code null} when absent from scope; a tenant arg
+     * falls back to its {@code defaultValue} when absent from scope.
+     *
+     * <p>When a tenant is pre-configured on the client, the tenant arg is mapped to an
+     * {@link AgentArgument} carrying the configured value as its {@code defaultValue}.
+     * The arg is intentionally kept in the list: removing it would shorten the positional
+     * array and cause {@link java.lang.reflect.Method#invoke} to fail with a wrong argument
+     * count. The pre-configured value is used at invocation time unless the scope already
+     * contains a value for that argument, in which case the scope value takes precedence.
+     */
     private List<AgentArgument> arguments(A2AClientInstance a2AClientInstance) {
         if (isUntyped()) {
             return Stream.of(a2AClientInstance.inputKeys())
                     .map(input -> new AgentArgument(Object.class, input))
                     .toList();
         }
-        Set<String> optionalProtocolArgs = Stream.of(method.getParameters())
-                .filter(p -> (p.isAnnotationPresent(A2AContextId.class)
-                                || p.isAnnotationPresent(A2ATaskId.class)
-                                || p.isAnnotationPresent(A2ATenantId.class))
-                        && ParameterNameResolver.hasName(p))
+        Set<String> tenantArgNames = Stream.of(method.getParameters())
+                .filter(p -> p.isAnnotationPresent(A2ATenantId.class) && ParameterNameResolver.hasName(p))
                 .map(ParameterNameResolver::name)
                 .collect(Collectors.toSet());
+        Set<String> optionalProtocolArgs = Stream.concat(
+                        tenantArgNames.stream(),
+                        Stream.of(method.getParameters())
+                                .filter(p -> (p.isAnnotationPresent(A2AContextId.class)
+                                                || p.isAnnotationPresent(A2ATaskId.class))
+                                        && ParameterNameResolver.hasName(p))
+                                .map(ParameterNameResolver::name))
+                .collect(Collectors.toSet());
         if (a2AClientInstance.tenant() != null) {
+            String configuredTenant = a2AClientInstance.tenant();
             return argumentsFromMethod(method, optionalProtocolArgs).stream()
-                    .filter(arg -> Stream.of(method.getParameters())
-                            .noneMatch(p -> p.isAnnotationPresent(A2ATenantId.class)
-                                    && ParameterNameResolver.hasName(p)
-                                    && ParameterNameResolver.name(p).equals(arg.name())))
+                    .map(arg -> tenantArgNames.contains(arg.name())
+                            ? new AgentArgument(arg.type(), arg.name(), configuredTenant, true, arg.description())
+                            : arg)
                     .toList();
         }
         return argumentsFromMethod(method, optionalProtocolArgs);
```

**File**: `langchain4j-agentic-a2a/src/test/java/dev/langchain4j/agentic/a2a/A2ATenantIdTest.java` (modified, +59/-4)
```diff
@@ -10,7 +10,9 @@
 import static org.mockito.Mockito.verify;
 import static org.mockito.Mockito.when;
 
+import dev.langchain4j.agentic.internal.AgentInvocationArguments;
 import dev.langchain4j.agentic.planner.AgentArgument;
+import dev.langchain4j.agentic.scope.DefaultAgenticScope;
 import dev.langchain4j.service.V;
 import java.lang.reflect.Method;
 import java.util.List;
@@ -58,8 +60,6 @@ void setUp() {
                 .build();
     }
 
-    // --- A2AClientAgentInvoker argument tests ---
-
     @Test
     void tenantId_parameter_is_optional_in_invoker_arguments() throws NoSuchMethodException {
         A2AClientInstance clientInstance = mock(A2AClientInstance.class);
@@ -78,6 +78,63 @@ void tenantId_parameter_is_optional_in_invoker_arguments() throws NoSuchMethodEx
         assertThat(args.get(1).isOptional()).isTrue();
     }
 
+    @Test
+    void preconfigured_tenant_argument_retains_default_value_in_arguments_list() throws NoSuchMethodException {
+        A2AClientInstance clientInstance = mock(A2AClientInstance.class);
+        when(clientInstance.agentCard()).thenReturn(agentCard);
+        when(clientInstance.tenant()).thenReturn("pre-configured-tenant");
+
+        Method chatMethod = TenantAwareAgent.class.getMethod("chat", String.class, String.class);
+        A2AClientAgentInvoker invoker = new A2AClientAgentInvoker(clientInstance, chatMethod);
+
+        List<AgentArgument> args = invoker.arguments();
+
+        assertThat(args).hasSize(2);
+        assertThat(args.get(0).name()).isEqualTo("question");
+        assertThat(args.get(1).name()).isEqualTo("tenant");
+        assertThat(args.get(1).isOptional()).isTrue();
+        assertThat(args.get(1).defaultValue()).isEqualTo("pre-configured-tenant");
+    }
+
+    @Test
+    void preconfigured_tenant_produces_correct_positional_arg_count() throws NoSuchMethodException {
+        A2AClientInstance clientInstance = mock(A2AClientInstance.class);
+        when(clientInstance.agentCard()).thenReturn(agentCard);
+        when(clientInstance.tenant()).thenReturn("pre-configured-tenant");
+
+        Method chatMethod = TenantAwareAgent.class.getMethod("chat", String.class, String.class);
+        A2AClientAgentInvoker invoker = new A2AClientAgentInvoker(clientInstance, chatMethod);
+
+        DefaultAgenticScope scope = DefaultAgenticScope.ephemeralAgenticScope();
+        scope.writeState("question", "hello");
+
+        AgentInvocationArguments args = invoker.toInvocationArguments(scope);
+
+        assertThat(args.positionalArgs()).hasSize(2);
+        assertThat(args.positionalArgs()[0]).isEqualTo("hello");
+        assertThat(args.positionalArgs()[1]).isEqualTo("pre-configured-tenant");
+    }
+
+    @Test
+    void scope_value_takes_precedence_over_preconfigured_tenant() throws NoSuchMethodException {
+        A2AClientInstance clientInstance = mock(A2AClientInstance.class);
+        when(clientInstance.agentCard()).thenReturn(agentCard);
+        when(clientInstance.tenant()).thenReturn("pre-configured-tenant");
+
+        Method chatMethod = TenantAwareAgent.class.getMethod("chat", String.class, String.class);
+        A2AClientAgentInvoker invoker = new A2AClientAgentInvoker(clientInstance, chatMethod);
+
+        DefaultAgenticScope scope = DefaultAgenticScope.ephemeralAgenticScope();
+        scope.writeState("question", "hello");
+        scope.writeState("tenant", "scope-tenant");
+
+        AgentInvocationArguments args = invoker.toInvocationArguments(scope);
+
+        assertThat(args.positionalArgs()).hasSize(2);
+        assertThat(args.positionalArgs()[0]).isEqualTo("hello");
+        assertThat(args.positionalArgs()[1]).isEqualTo("scope-tenant");
+    }
+
     @Test
     void contextId_and_tenantId_parameters_are_both_optional_in_invoker_arguments() throws NoSuchMethodException {
         A2AClientInstance clientInstance = mock(A2AClientInstance.class);
@@ -97,8 +154,6 @@ void contextId_and_tenantId_parameters_are_both_optional_in_invoker_arguments()
         assertThat(args.get(2).isOptional()).isTrue();
     }
 
-    // --- DefaultA2AClientBuilder invocation tests ---
-
     @Test
     void nonNull_tenant_is_passed_via_MessageSendParams() throws Exception {
         Client mockClient = mock(Client.class);
```

#### Recent Merged Pull Requests:
- **PR #6588** (2026-10-05): Only warn about ambiguous SPI implementations where one is picked (@dliubarskyi)
- **PR #6587** (2026-10-05): fix(ai-services): avoid duplicating @UserMessage TextContent arguments (@chengwudi1)
- **PR #6586** (2026-10-05): feat(micrometer-metrics): add EmbeddingModel metrics listener (@Snow7-G)
- **PR #6580** (closed): docs: add Inferrail to OpenAI-compatible language models (@domondi1)
- **PR #6579** (2026-10-05): docs: fix source links and outcome anchors in guardrails tutorial (@pei711)
- **PR #6577** (2026-10-05): site: add missing language tags to code blocks in docs/README.md (@zh-hanlabs)
- **PR #6564** (2026-10-01): fix(jackson3): restore the remaining Jackson 2 defaults and document the deliberate differences (@dliubarskyi)
- **PR #6561** (2026-10-02): Introduce a DecisionModel-based router agentic pattern (@mariofusco)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
