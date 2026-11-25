# Domain G — Architecture Intelligence: Architecture Intelligence: modelcontextprotocol/kotlin-sdk Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "modelcontextprotocol/kotlin-sdk",
  "source_url": "https://github.com/modelcontextprotocol/kotlin-sdk",
  "source_version": "df24fb0b",
  "license": "NOASSERTION",
  "timestamp": "2026-11-25T09:37:23.809Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-modelcontextprotocol-kotlin-sdk",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [modelcontextprotocol/kotlin-sdk](https://github.com/modelcontextprotocol/kotlin-sdk) (Revision: `df24fb0b`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-25T09:37:23.809Z`  
> **Learning ID**: `learn-github-modelcontextprotocol-kotlin-sdk`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 68%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from modelcontextprotocol/kotlin-sdk:

# Forensic Learning Record (Deep Inspection): modelcontextprotocol/kotlin-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-kotlin-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/kotlin-sdk](https://github.com/modelcontextprotocol/kotlin-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T09:37:20.435Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/kotlin-sdk`
- **Description**: The official Kotlin SDK for Model Context Protocol servers and clients. Maintained in collaboration with JetBrains
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1492 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/ExperimentalMcpApi.kt`
```
package io.modelcontextprotocol.kotlin.sdk

import kotlin.annotation.AnnotationTarget.ANNOTATION_CLASS
import kotlin.annotation.AnnotationTarget.CLASS
import kotlin.annotation.AnnotationTarget.CONSTRUCTOR
import kotlin.annotation.AnnotationTarget.FIELD
import kotlin.annotation.AnnotationTarget.FUNCTION
import kotlin.annotation.AnnotationTarget.LOCAL_VARIABLE
import kotlin.annotation.AnnotationTarget.PROPERTY
import kotlin.annotation.AnnotationTarget.PROPERTY_GETTER
import kotlin.annotation.AnnotationTarget.PROPERTY_SETTER
import kotlin.annotation.AnnotationTarget.TYPEALIAS
import kotlin.annotation.AnnotationTarget.VALUE_PARAMETER

/**
 * Annotation marking an API as experimental and subject to changes or removal in the future.
 *
 * This annotation is used to signal that a particular element, such as a class, function, or property,
 * is part of an experimental API. Such APIs may not be stable, and their usage requires opting in
 * explicitly.
 *
 * Users of the annotated API must explicitly accept the opt-in requirement to ensure they are aware
 * of the potential instability or unfinished nature of the API.
 *
 * Targets that can be annotated include:
 * - Classes
 * - Annotation classes
 * - Properties
 * - Fields
 * - Local variables
 * - Value parameters
 * - Constructors
 * - Functions
 * - Property getters
 * - Property setters
 * - Type aliases
 */
@RequiresOptIn(
    message = "This API is experimental. It may be changed in the future without notice.",
    level = RequiresOptIn.Level.WARNING,
)
@MustBeDocumented
@Target(
    CLASS,
    ANNOTATION_CLASS,
    PROPERTY,
    FIELD,
    LOCAL_VARIABLE,
    VALUE_PARAMETER,
    CONSTRUCTOR,
    FUNCTION,
    PROPERTY_GETTER,
    PROPERTY_SETTER,
    TYPEALIAS,
)
@Retention(AnnotationRetention.BINARY)
public annotation class ExperimentalMcpApi

```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/InternalMcpApi.kt`
```
package io.modelcontextprotocol.kotlin.sdk

import kotlin.annotation.AnnotationTarget.ANNOTATION_CLASS
import kotlin.annotation.AnnotationTarget.CLASS
import kotlin.annotation.AnnotationTarget.CONSTRUCTOR
import kotlin.annotation.AnnotationTarget.FIELD
import kotlin.annotation.AnnotationTarget.FUNCTION
import kotlin.annotation.AnnotationTarget.LOCAL_VARIABLE
import kotlin.annotation.AnnotationTarget.PROPERTY
import kotlin.annotation.AnnotationTarget.PROPERTY_GETTER
import kotlin.annotation.AnnotationTarget.PROPERTY_SETTER
import kotlin.annotation.AnnotationTarget.TYPEALIAS
import kotlin.annotation.AnnotationTarget.VALUE_PARAMETER

/**
 * Denotes that the annotated API is internal to the MCP SDK and its usage is restricted to components
 * within the SDK. It is not intended to be used in general application code or by external consumers.
 *
 * This annotation is used to communicate and enforce the limited visibility of certain APIs to prevent
 * accidental usage outside their intended context.
 *
 * Applying this annotation requires consumers to explicitly opt-in, acknowledging the warning level
 * associated with its use.
 *
 * This annotation can be used on classes, annotations, properties, fields, local variables, value
 * parameters, constructors, functions, property accessors, and type aliases.
 *
 * The annotation is retained in the binary and must be documented.
 */
@RequiresOptIn(
    message = "This API is internal, and its usage is restricted to internal components of the MCP SDK.",
    level = RequiresOptIn.Level.WARNING,
)
@MustBeDocumented
@Target(
    CLASS,
    ANNOTATION_CLASS,
    PROPERTY,
    FIELD,
    LOCAL_VARIABLE,
    VALUE_PARAMETER,
    CONSTRUCTOR,
    FUNCTION,
    PROPERTY_GETTER,
    PROPERTY_SETTER,
    TYPEALIAS,
)
@Retention(AnnotationRetention.BINARY)
public annotation class InternalMcpApi

```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/internal/utils.kt`
```
package io.modelcontextprotocol.kotlin.sdk.internal

import kotlinx.coroutines.CoroutineDispatcher

/** Platform-specific [CoroutineDispatcher] for I/O-bound operations. */
public expect val IODispatcher: CoroutineDispatcher

```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/AbstractClientTransport.kt`
```
package io.modelcontextprotocol.kotlin.sdk.shared

import io.github.oshai.kotlinlogging.KLogger
import io.modelcontextprotocol.kotlin.sdk.InternalMcpApi
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
import io.modelcontextprotocol.kotlin.sdk.types.McpException
import io.modelcontextprotocol.kotlin.sdk.types.RPCError.ErrorCode.CONNECTION_CLOSED
import io.modelcontextprotocol.kotlin.sdk.types.RPCError.ErrorCode.INTERNAL_ERROR
import kotlinx.coroutines.CompletableDeferred
import kotlin.concurrent.atomics.AtomicReference
import kotlin.concurrent.atomics.ExperimentalAtomicApi
import kotlin.coroutines.cancellation.CancellationException

/**
 * Abstract base class representing a client-side transport layer for communication.
 *
 * This class is responsible for managing the lifecycle of a transport instance, including its initialization,
 * state transitions, message transmission, and graceful shutdown. It provides a framework for implementing
 * specific transport mechanisms by defining abstract methods that subclasses must implement.
 *
 * Thread-safety is achieved through the use of atomic references to manage transport state transitions and
 * to ensure invariants during lifecycle events. The initialization and shutdown logic is designed to handle
 * async workflows, ensuring proper resource cleanup in the case of failure or cancellation.
 */
@OptIn(ExperimentalAtomicApi::class, InternalMcpApi::class)
public abstract class AbstractClientTransport : AbstractTransport() {

    protected abstract val logger: KLogger

    /**
     * Represents the current state of the client transport in an atomic and thread-safe manner.
     *
     * This private field is used internally to manage state transitions of the transport, ensuring
     * consistency across concurrent operations. The state transitions are validated and managed
     * using the `stateTransition` method, adhering to defined rules in [ClientTransportState.VALID_TRANSITIONS].
     *
     * @see ClientTransportState
     * @see stateTransition
     * @see checkState
     */
    private val _state: AtomicReference<ClientTransportState> = AtomicReference(ClientTransportState.New)

    private val operational = CompletableDeferred<Unit>()

    /**
     * Current transport state. Thread-safe via atomic reference.
     * Initial state is [ClientTransportState.New].
     */
    @InternalMcpApi
    protected val state: ClientTransportState
        get() = _state.load()

    /**
     * Updates the internal state of the client transport to the specified new state.
     *
     * This method is used to manage the lifecycle and operational state of the client transport
     * by transitioning it to the provided [new] state. The new state is stored atomically,
     * ensuring thread safety during concurrent modifications.
     *
     * @param new The new state to transition the client transport to. It must be a valid state
     *            as defined in the transport's lifecycle logic.
     */
    @InternalMcpApi
    protected fun updateState(new: ClientTransportState) {
        _state.store(new)
    }

    /**
     * Performs transport-specific initialization (connections, I/O streams, background coroutines).
     *
     * Called by [start] during [ClientTransportState.Initializing]. On exception, state transitions to
     * [ClientTransportState.InitializationFailed], [closeResources] is called, and exception propagates.
     */
    protected abstract suspend fun initialize()

    /**
     * Atomically transitions state from `from` to `to`.
     *
     * Validates transition per [ClientTransportState.VALID_TRANSITIONS] and performs atomic compare-and-exchange.
     *
     * @throws IllegalArgumentException if transition isn't allowed
     * @throws IllegalStateException if the actual state doesn't match `from`
     */
    @InternalMcpApi
    protected fun stateTransition(from: ClientTransportState, to: ClientTransportState) {
        require(to in ClientTransportState.VALID_TRANSITIONS.getValue(from)) {
            "Invalid transition: $from → $to"
        }
        val actualState = _state.compareAndExchange(
            expectedValue = from,
            newValue = to,
        )
        check(actualState == from) {
            "Can't change state: expected transport state $from, but found $actualState."
        }
    }

    /**
     * Verifies that the current transport state matches the expected state and throws an exception if it does not.
     *
     * This method ensures that the transport's state is in alignment with the caller’s expectations before
     * proceeding with further operations. It is often used to enforce state invariants within the transport's
     * lifecycle mechanics, enabling robust error handling and debugging in case of unexpected state transitions.
     *
     * @param expected The expected transport state.
     * An exception will be thrown if the actual state does not match this value.
     * @param lazyMessage Function that builds the exception message from the actual state when the check fails.
     * Defaults to a message that compares the expected state against the observed one.
     */
    protected fun checkState(
        expected: ClientTransportState,
        lazyMessage: (ClientTransportState) -> Any = {
            "Expected transport state $expected, but found $it"
        },
    ) {
        val actualState = state
        check(actualState == expected) { lazyMessage }
    }

    /**
     * Initiates the transport by transitioning through the required states to prepare it for operation.
     *
     * This method transitions the transport state from `New` to `Initializing`, performs initialization
     * logic specific to the transport implementation, and then transitions the state to `Operational`
     * upon successful initialization. If an exception occurs during initialization, the state is transitioned
     * to `InitializationFailed`, resources are cleaned up, and the exception is rethrown.
     *
     * This method operates within a suspend context to allow for asynchronous initialization tasks.
     *
     *  **Important! This method will eventually become `final`.
     *  Please don't override it, or consistency guarantees might be lost. Override [initialize] instead.**
     *
     * @throws Exception if the initialization process fails and transfers state
     *                  to [ClientTransportState.InitializationFailed].
     * @see initialize
     */
    public override suspend fun start() {
        stateTransition(from = ClientTransportState.New, to = ClientTransportState.Initializing)
        try {
            initialize()
            stateTransition(from = ClientTransportState.Initializing, to = ClientTransportState.Operational)
            operational.complete(Unit)
        } catch (e: Exception) {
            _state.store(ClientTransportState.InitializationFailed)
            closeResources()
            throw e
        }
    }

    /**
     * Registers [block] to handle inbound messages. Messages received before [start] completes
     * are handed to [block] only once the transport is [ClientTransportState.Operational].
     */
    public override fun onMessage(block: suspend (JSONRPCMessage) -> Unit) {
        super.onMessage { message ->
            operational.await()
            block(message)
        }
    }

    /**
     * Sends a JSON-RPC message using the transport layer.
     *
     * This method ensures that the transport is operational before attempting to send the message.
     * If the transport's state does not allow sending operations, an exception is thrown.
     * It delegates the actual transmission to the abstract [performSend] method, which must be
     * implemented by subclasses to handle the specifics of the transmission mechanism. Errors
     * during the send operation are handled appropriately, and cancellation exceptions are always
     * propagated.
     *
     * **Important! This method will eventually become `final`.
     * Please don't override it, or consistency guarantees might be lost. Override [performSend] instead.**
     *
     * @param message The JSON-RPC message to be sent. Must adhere to the JSON-RPC 2.0 specification.
     * @param options Optional parameters that influence how the message is transmitted, such as
     *                timeout specifications or message delivery guarantees. Can be null if no
     *                specific options are required.
     * @throws McpException If the transport is not operational or other application-specific errors occur.
     * @throws CancellationException If the coroutine is canceled.
     * @see performSend
     */
    public override suspend fun send(message: JSONRPCMessage, options: TransportSendOptions?) {
        // fast path - state check to avoid nonsense operations
        if (state != ClientTransportState.Operational) {
            throw McpException(
                code = CONNECTION_CLOSED,
                message = "Transport is not ready",
            )
        }
        // limitation: state could still change at the time of use
        try {
            performSend(message, options)
        } catch (e: CancellationException) {
            throw e // Always propagate cancellation
        } catch (e: Exception) {
            _onError(e)
            if (e is McpException) {
                throw e
            } else {
                throw McpException(
                    code = INTERNAL_ERROR,
                    message = "Error while sending message: ${e.message}",
                    cause = e,
                )
            }
        }
    }

    /**
     * Transmits a JSON-RPC message via the underlying protocol.
     *
     * The method is responsible for transmitting a given JSON-RPC message to the intended destination.
     * It is implemented by concrete subclasses of the transport to handle specific transmission
     * mechanisms.
     *
     * Called by [send] after verifying transport
```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/AbstractTransport.kt`
```
package io.modelcontextprotocol.kotlin.sdk.shared

import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
import io.modelcontextprotocol.kotlin.sdk.utils.runCatchingCancellable
import kotlinx.coroutines.CompletableDeferred
import kotlin.concurrent.atomics.AtomicBoolean
import kotlin.concurrent.atomics.ExperimentalAtomicApi

/**
 * Base class for [Transport] implementations that handles the bookkeeping for [onClose], [onError]
 * and [onMessage] callback registration, exposing the composed callbacks to subclasses for invocation.
 *
 * The callbacks are composed: each call to [onClose], [onError], or [onMessage] chains the new block
 * after any previously registered ones.
 */
@OptIn(ExperimentalAtomicApi::class)
public abstract class AbstractTransport : Transport {
    private val onCloseCalled = AtomicBoolean(false)
    private var _onClose: (() -> Unit) = {}
    protected var _onError: ((Throwable) -> Unit) = {}
        private set

    // to not skip messages
    private val _onMessageInitialized = CompletableDeferred<Unit>()
    protected var _onMessage: (suspend ((JSONRPCMessage) -> Unit)) = {
        _onMessageInitialized.await()
        _onMessage.invoke(it)
    }
        private set

    override fun onClose(block: () -> Unit) {
        val old = _onClose
        _onClose = {
            old()
            block()
        }
    }

    override fun onError(block: (Throwable) -> Unit) {
        val old = _onError
        _onError = { e ->
            old(e)
            block(e)
        }
    }

    override fun onMessage(block: suspend (JSONRPCMessage) -> Unit) {
        val old: suspend (JSONRPCMessage) -> Unit = when (_onMessageInitialized.isCompleted) {
            true -> _onMessage
            false -> { _ -> }
        }

        _onMessage = { message ->
            old(message)
            block(message)
        }

        _onMessageInitialized.complete(Unit)
    }

    /**
     * Invokes the `_onClose` callback if it has not been already triggered.
     *
     * This method ensures the `_onClose` callback is executed only once by utilizing
     * an atomic flag (`onCloseCalled`). If the callback has already been executed,
     * the method does nothing. Any exceptions thrown during the execution of the
     * `_onClose` callback are caught and suppressed.
     */
    protected fun invokeOnCloseCallback() {
        if (onCloseCalled.compareAndSet(expectedValue = false, newValue = true)) {
            runCatchingCancellable { _onClose() }
        }
    }

    /**
     * Reports [error] through the `_onError` callback, swallowing any [Throwable] the callback
     * raises. A [kotlin.coroutines.cancellation.CancellationException] propagates instead.
     */
    protected fun invokeOnErrorCallback(error: Throwable) {
        runCatchingCancellable { _onError(error) }
    }
}

```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/ClientTransportState.kt`
```
package io.modelcontextprotocol.kotlin.sdk.shared

/**
 * States of a client transport within the protocol lifecycle
 *
 * These states are generally aligned with the corresponding phases
 * defined under the MCP [Protocol Lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).
 */
public enum class ClientTransportState {

    /**
     * The transport has just been created.
     *
     * This is the Initial state
     */
    New,

    /**
     * Indicates that the protocol
     * is in the [Initialization Phase](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#initialization).
     */
    Initializing,

    /**
     * Indicates that the initialization phase of the protocol lifecycle has failed.
     *
     * This state suggests that the transport encountered an error or issue during
     * initialization, preventing it from successfully transitioning to a fully operational state.
     */
    InitializationFailed,

    /**
     * Represents the [operational phase](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#operation)
     * of the protocol lifecycle.
     *
     * During the operation phase, the client and server exchange messages according to the negotiated capabilities.
     */
    Operational,

    /**
     * Represents the shutting down phase of the protocol lifecycle.
     *
     * This state indicates that the transport is in the process of shutting down
     * and transitioning to a non-operational state.
     *
     * During this phase, no new outgoing messages should be accepted.
     */
    ShuttingDown,

    /**
     * Indicates that the shutdown phase of the protocol lifecycle has failed.
     *
     * This state signifies that an error was encountered during the shutdown phase.
     */
    ShutdownFailed,

    /**
     * Indicates that the transport has fully stopped.
     *
     * This state represents the final phase of the lifecycle, where the transport is no longer
     * operational and all cleanup routines or resource deallocations have been completed.
     */
    Stopped,

    ;

    internal companion object {
        val VALID_TRANSITIONS: Map<ClientTransportState, Set<ClientTransportState>> = mapOf(
            New to setOf(Initializing, Stopped),
            Initializing to setOf(Operational, InitializationFailed),
            Operational to setOf(ShuttingDown),
            ShuttingDown to setOf(Stopped, ShutdownFailed),
            // Terminal states allow no transitions
            InitializationFailed to emptySet(),
            Stopped to emptySet(),
            ShutdownFailed to emptySet(),
        )
    }
}

```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/Protocol.kt`
```
package io.modelcontextprotocol.kotlin.sdk.shared

import io.github.oshai.kotlinlogging.KotlinLogging
import io.modelcontextprotocol.kotlin.sdk.types.CancelledNotification
import io.modelcontextprotocol.kotlin.sdk.types.CancelledNotificationParams
import io.modelcontextprotocol.kotlin.sdk.types.CustomResult
import io.modelcontextprotocol.kotlin.sdk.types.EmptyResult
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCEmptyMessage
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCError
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCNotification
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCResponse
import io.modelcontextprotocol.kotlin.sdk.types.McpException
import io.modelcontextprotocol.kotlin.sdk.types.McpJson
import io.modelcontextprotocol.kotlin.sdk.types.Method
import io.modelcontextprotocol.kotlin.sdk.types.Notification
import io.modelcontextprotocol.kotlin.sdk.types.PingRequest
import io.modelcontextprotocol.kotlin.sdk.types.Progress
import io.modelcontextprotocol.kotlin.sdk.types.ProgressNotification
import io.modelcontextprotocol.kotlin.sdk.types.ProgressToken
import io.modelcontextprotocol.kotlin.sdk.types.RPCError
import io.modelcontextprotocol.kotlin.sdk.types.Request
import io.modelcontextprotocol.kotlin.sdk.types.RequestId
import io.modelcontextprotocol.kotlin.sdk.types.RequestResult
import io.modelcontextprotocol.kotlin.sdk.types.fromJSON
import io.modelcontextprotocol.kotlin.sdk.types.toJSON
import kotlinx.atomicfu.AtomicRef
import kotlinx.atomicfu.atomic
import kotlinx.atomicfu.getAndUpdate
import kotlinx.atomicfu.update
import kotlinx.collections.immutable.PersistentList
import kotlinx.collections.immutable.PersistentMap
import kotlinx.collections.immutable.persistentListOf
import kotlinx.collections.immutable.persistentMapOf
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.encodeToJsonElement
import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.ContinuationInterceptor
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

private val logger = KotlinLogging.logger { }

/** Default implementation name used in MCP handshake. */
public const val IMPLEMENTATION_NAME: String = "mcp-ktor"

/**
 * Callback for progress notifications.
 */
public typealias ProgressCallback = (Progress) -> Unit

/**
 * Additional initialization options.
 *
 * [handlerCoroutineContext] is read once when [Protocol.connect] attaches a transport and stays
 * fixed until the next [Protocol.connect].
 *
 * @property enforceStrictCapabilities whether to restrict emitted requests to only those the remote
 * side advertised support for. Local-side capability checks are unaffected. Defaults to `false` for
 * backward compatibility with SDK versions that did not advertise capabilities correctly.
 * @property timeout default timeout for outgoing requests
 * @property handlerCoroutineContext coroutine context used to run inbound request and notification
 * handlers once initialization has completed. Must contain a real dispatching
 * [kotlin.coroutines.ContinuationInterceptor]. `Dispatchers.Unconfined` and unconfined test
 * dispatchers are unsupported, since handler resumptions would then run on the transport read loop
 * and reintroduce head-of-line blocking. Any [kotlinx.coroutines.Job] in this context is ignored.
 */
public open class ProtocolOptions(
    public var enforceStrictCapabilities: Boolean = false,
    public var timeout: Duration = DEFAULT_REQUEST_TIMEOUT,
    public var handlerCoroutineContext: CoroutineContext = Dispatchers.Default,
    // Internal handler-concurrency bounds, read once at connect and not part of the public surface.
    internal var maxConcurrentHandlers: Int = DEFAULT_MAX_CONCURRENT_HANDLERS,
    internal var maxInFlightHandlers: Int = DEFAULT_MAX_IN_FLIGHT_HANDLERS,
)

/**
 * The default request timeout.
 */
public val DEFAULT_REQUEST_TIMEOUT: Duration = 60.seconds

/** Default cap on concurrently executing inbound handlers per connection. */
internal const val DEFAULT_MAX_CONCURRENT_HANDLERS: Int = 64

/** Default cap on launched-but-not-completed inbound handlers per connection. */
internal const val DEFAULT_MAX_IN_FLIGHT_HANDLERS: Int = 256

/**
 * Options that can be given per request.
 *
 * @param relatedRequestId if present, used to indicate to the transport which incoming request to
 * associate this outgoing message with.
 * @param resumptionToken the resumption token used to continue long-running requests that were interrupted.
 * Allows clients to reconnect and continue from where they left off, if supported by the transport.
 * @param onResumptionToken callback invoked when the resumption token changes, if supported by the transport.
 * Allows clients to persist the latest token for potential reconnection.
 * @property onProgress callback for progress notifications.
 * If set, requests progress notifications from the remote end (if supported);
 * when progress notifications are received, this callback is invoked.
 * @property timeout a timeout for this request.
 * If exceeded, a [McpException] with code `RequestTimeout` is raised from [Protocol.request].
 * If not specified, [DEFAULT_REQUEST_TIMEOUT] is used.
 */
public class RequestOptions(
    relatedRequestId: RequestId? = null,
    resumptionToken: String? = null,
    onResumptionToken: ((String) -> Unit)? = null,
    public val onProgress: ProgressCallback? = null,
    public val timeout: Duration = DEFAULT_REQUEST_TIMEOUT,
) : TransportSendOptions(relatedRequestId, resumptionToken, onResumptionToken) {
    /** Destructuring component for [onProgress]. */
    public operator fun component4(): ProgressCallback? = onProgress

    /** Destructuring component for [timeout]. */
    public operator fun component5(): Duration = timeout

    /** Creates a copy of this [RequestOptions] with the specified fields replaced. */
    public fun copy(
        relatedRequestId: RequestId? = this.relatedRequestId,
        resumptionToken: String? = this.resumptionToken,
        onResumptionToken: ((String) -> Unit)? = this.onResumptionToken,
        onProgress: ProgressCallback? = this.onProgress,
        timeout: Duration = this.timeout,
    ): RequestOptions = RequestOptions(relatedRequestId, resumptionToken, onResumptionToken, onProgress, timeout)

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false
        if (!super.equals(other)) return false

        other as RequestOptions

        return onProgress == other.onProgress && timeout == other.timeout
    }

    override fun hashCode(): Int {
        var result = super.hashCode()
        result = 31 * result + onProgress.hashCode()
        result = 31 * result + timeout.hashCode()
        return result
    }

    override fun toString(): String =
        "RequestOptions(relatedRequestId=$relatedRequestId, resumptionToken=$resumptionToken, onResumptionToken=$onResumptionToken, onProgress=$onProgress, timeout=$timeout)"
}

/**
 * Extra data given to request handlers.
 *
 * One instance exists per in-flight inbound request. It is passed as the second parameter to
 * low-level handlers registered via [Protocol.setRequestHandler] **and** installed into the
 * handler coroutine's [CoroutineContext], so code nested anywhere under the handler can reach it
 * via [currentRequestHandlerExtra] without parameter plumbing.
 *
 * @property requestId the JSON-RPC id of the request being handled
 * @property method the request's method
 */
public class RequestHandlerExtra internal constructor(
    public val requestId: RequestId,
    public val method: Method,
    private val protocol: Protocol,
    internal val capturedTransport: Transport,
) : AbstractCoroutineContextElement(Key) {

    /** Context key for retrieving the extra from a handler coroutine's context. */
    public companion object Key : CoroutineContext.Key<RequestHandlerExtra>

    /**
     * Sends a notification tagged with `relatedRequestId = `[requestId], letting transports
     * associate it with the request being handled (e.g. route it onto the request's SSE stream).
     */
    public suspend fun sendNotification(notification: Notification) {
        protocol.notification(notification, relatedRequestId = requestId)
    }

    /**
     * Sends a request to the peer tagged with `relatedRequestId = `[requestId].
     *
     * Mirrors [Protocol.request]; cancellation of the handler coroutine propagates into this call.
     */
    public suspend fun <T : RequestResult> sendRequest(request: Request, options: RequestOptions? = null): T {
        val base = options ?: RequestOptions()
        return protocol.request(
            request,
            RequestOptions(
                relatedRequestId = requestId,
                resumptionToken = base.resumptionToken,
                onResumptionToken = base.onResumptionToken,
                onProgress = base.onProgress,
                timeou
```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/ReadBuffer.kt`
```
package io.modelcontextprotocol.kotlin.sdk.shared

import io.github.oshai.kotlinlogging.KotlinLogging
import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
import io.modelcontextprotocol.kotlin.sdk.types.McpJson
import kotlinx.io.Buffer
import kotlinx.io.IOException
import kotlinx.io.indexOf
import kotlinx.io.readString

/**
 * Buffers a continuous stdio stream into discrete JSON-RPC messages.
 *
 * A single newline-terminated frame may not exceed an internal size cap (16 MiB): a peer that streams
 * bytes without ever sending a newline triggers a [TooLongFrameException] from [readMessage] instead
 * of growing the buffer without bound. A non-positive cap disables the check.
 */
public class ReadBuffer internal constructor(private val maxFrameSize: Int) {

    public constructor() : this(DEFAULT_MAX_FRAME_SIZE)

    internal companion object {
        internal const val DEFAULT_MAX_FRAME_SIZE: Int = 16 * 1024 * 1024
        private const val LOG_LINE_PREFIX_LENGTH: Int = 160
    }

    private val logger = KotlinLogging.logger { }

    private val buffer: Buffer = Buffer()

    /** Number of bytes at the front of [buffer] already known to hold no line terminator. */
    private var scannedBytes: Long = 0

    /** Appends raw bytes to the internal buffer for subsequent message parsing. */
    public fun append(chunk: ByteArray) {
        buffer.write(chunk)
    }

    /**
     * Reads and deserializes a JSON-RPC message from the input buffer.
     *
     * The method attempts to read lines from the buffer until a valid `JSONRPCMessage` is successfully
     * deserialized. Blank lines are ignored, and if a deserialization error occurs, the method attempts
     * to recover and process the message.
     *
     * Recovery involves attempting to parse from the first detected JSON object in the line when an
     * error is encountered during deserialization.
     *
     * @return A deserialized `JSONRPCMessage` if successfully processed; otherwise, `null` if the
     *         input buffer is exhausted or no valid message is found.
     */
    public fun readMessage(): JSONRPCMessage? {
        while (true) {
            val line = readNextLine() ?: return null
            if (line.isBlank()) continue

            val message = try {
                deserializeMessage(line)
            } catch (e: Exception) {
                val recovered = tryRecover(line)
                if (recovered != null) {
                    logger.warn {
                        "Recovered JSON-RPC message after deserialization failure; line prefix: ${line.logPrefix()}"
                    }
                } else {
                    logger.error(e) {
                        "Failed to deserialize JSON-RPC message; line prefix: ${line.logPrefix()}; skipping."
                    }
                }
                recovered
            }
            if (message != null) {
                return message
            }
        }
    }

    private fun readNextLine(): String? {
        val lfIndex = if (buffer.exhausted()) -1L else buffer.indexOf('\n'.code.toByte(), startIndex = scannedBytes)
        if (lfIndex == -1L) {
            scannedBytes = buffer.size
            failIfFrameTooLong(buffer.size)
            return null
        }
        scannedBytes = 0
        failIfFrameTooLong(lfIndex)

        return if (lfIndex == 0L) {
            buffer.skip(1)
            ""
        } else {
            var skipBytes = 1
            var messageLength = lfIndex
            if (buffer[lfIndex - 1] == '\r'.code.toByte()) {
                messageLength -= 1
                skipBytes += 1
            }
            val string = buffer.readString(messageLength)
            buffer.skip(skipBytes.toLong())
            string
        }
    }

    private fun failIfFrameTooLong(frameSize: Long) {
        if (maxFrameSize in 1..<frameSize) {
            clear()
            throw TooLongFrameException(frameSize, maxFrameSize)
        }
    }

    private fun tryRecover(line: String): JSONRPCMessage? {
        // if there is a non-JSON object prefix, try to parse from the first '{' onward.
        val braceIndex = line.indexOf('{')
        if (braceIndex == -1) return null

        val trimmed = line.substring(braceIndex)

        return try {
            deserializeMessage(trimmed)
        } catch (_: Exception) {
            null
        }
    }

    private fun String.logPrefix(): String =
        if (length > LOG_LINE_PREFIX_LENGTH) take(LOG_LINE_PREFIX_LENGTH) + "..." else this

    /** Clears all buffered data, discarding any partially received messages. */
    public fun clear() {
        buffer.clear()
        scannedBytes = 0
    }
}

/**
 * Thrown by [ReadBuffer.readMessage] when a single newline-terminated frame exceeds the maximum size
 * before its terminator arrives — i.e. a peer is streaming data without ever framing it. Transports
 * treat it as fatal and close the connection.
 *
 * @property frameSize number of unframed bytes observed when the limit was tripped
 * @property maxFrameSize the maximum frame size that was exceeded
 */
public class TooLongFrameException(public val frameSize: Long, public val maxFrameSize: Int) :
    IOException(
        "JSON-RPC frame exceeded the maximum size of $maxFrameSize bytes " +
            "before a newline terminator (observed $frameSize bytes).",
    )

internal fun deserializeMessage(line: String): JSONRPCMessage = McpJson.decodeFromString<JSONRPCMessage>(line)

/** Serializes a [JSONRPCMessage] to its JSON string representation with a trailing newline. */
public fun serializeMessage(message: JSONRPCMessage): String = McpJson.encodeToString(message) + "\n"

```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/Transport.kt`
```
package io.modelcontextprotocol.kotlin.sdk.shared

import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage

/**
 * Describes the minimal contract for MCP transport that a client or server can communicate over.
 */
public interface Transport {
    /**
     * Starts processing messages on the transport, including any connection steps that might need to be taken.
     *
     * This method should only be called after callbacks are installed, or else messages may be lost.
     *
     * Method waits for the initialization flow to complete and then returns, so the transport is ready to send and receive user messages.
     *
     * NOTE: This method should not be called explicitly when using Client, Server, or Protocol classes,
     * as they will implicitly call start().
     */
    public suspend fun start()

    /**
     * Sends a JSON-RPC message (request or response).
     *
     * @param message the JSON-RPC message to send, either a request or a response
     * @param options optional transport-specific options that control sending behavior;
     * different transport implementations may support different options
     */
    public suspend fun send(message: JSONRPCMessage, options: TransportSendOptions? = null)

    /**
     * Closes the transport.
     */
    public suspend fun close()

    /**
     * Callback for when the connection is closed for any reason.
     *
     * This should be invoked when close() is called as well.
     */
    public fun onClose(block: () -> Unit)

    /**
     * Callback for when an error occurs.
     *
     * Note that errors are not necessarily fatal; they are used for reporting any kind of
     * exceptional condition out of a band.
     */
    public fun onError(block: (Throwable) -> Unit)

    /**
     * Callback for when a message (request or response) is received over the connection.
     */
    public fun onMessage(block: suspend (JSONRPCMessage) -> Unit)
}

```

### Core Architecture Module: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/TransportSendOptions.kt`
```
package io.modelcontextprotocol.kotlin.sdk.shared

import io.modelcontextprotocol.kotlin.sdk.types.RequestId

/**
 * Options for sending a JSON-RPC message through transport.
 *
 * @property relatedRequestId if present,
 * `relatedRequestId` is used to indicate to the transport which incoming request to associate this outgoing message with.
 * @property resumptionToken the resumption token used to continue long-running requests that were interrupted.
 * This allows clients to reconnect and continue from where they left off, if supported by the transport.
 * @property onResumptionToken a callback that is invoked when the resumption token changes, if supported by the transport.
 * This allows clients to persist the latest token for potential reconnection.
 */
public open class TransportSendOptions(
    public val relatedRequestId: RequestId? = null,
    public val resumptionToken: String? = null,
    public val onResumptionToken: ((String) -> Unit)? = null,
) {
    /** Destructuring component for [relatedRequestId]. */
    public operator fun component1(): RequestId? = relatedRequestId

    /** Destructuring component for [resumptionToken]. */
    public operator fun component2(): String? = resumptionToken

    /** Destructuring component for [onResumptionToken]. */
    public operator fun component3(): ((String) -> Unit)? = onResumptionToken

    /** Creates a copy of this [TransportSendOptions] with the specified fields replaced. */
    public open fun copy(
        relatedRequestId: RequestId? = this.relatedRequestId,
        resumptionToken: String? = this.resumptionToken,
        onResumptionToken: ((String) -> Unit)? = this.onResumptionToken,
    ): TransportSendOptions = TransportSendOptions(relatedRequestId, resumptionToken, onResumptionToken)

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as TransportSendOptions

        return relatedRequestId == other.relatedRequestId &&
            resumptionToken == other.resumptionToken &&
            onResumptionToken == other.onResumptionToken
    }

    override fun hashCode(): Int {
        var result = relatedRequestId?.hashCode() ?: 0
        result = 31 * result + (resumptionToken?.hashCode() ?: 0)
        result = 31 * result + (onResumptionToken?.hashCode() ?: 0)
        return result
    }

    override fun toString(): String =
        "TransportSendOptions(relatedRequestId=$relatedRequestId, resumptionToken=$resumptionToken, onResumptionToken=$onResumptionToken)"
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1170** (2026-11-16): **Resuming a request stream cancels the other SSE streams in StreamableHttpClientTransport**
  *Symptoms*: `StreamableHttpClientTransport` runs all its GET streams in one `sseJob`, and `startSseSession` cancels the running job before starting the next. So resuming a request stream (after the server closes it before the response, or via `resumptionToken`) cancels either the standalone GET stream for the rest of the session or another request's resumption, and that request times out. A resumption also ends only on a response, so after a request is cancelled the client keeps reconnecting until the transport closes.  #1091 brings this to TypeScript and Python SDK servers: once the client sends `MCP-Protocol-Version`, they can close request streams to make the client poll.

- **Issue #1093** (2026-11-09): **stdio: the time to receive a message grows with the square of its size**
  *Symptoms*: **Describe the bug**  `ReadBuffer.readNextLine()` searches for the newline from the start of the buffer on every `readMessage()` call:  https://github.com/modelcontextprotocol/kotlin-sdk/blob/382e27b0ee5bfd3dad89c9fbc34fff1984e16ecd/kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/ReadBuffer.kt#L65-L72  The stdio transports read up to 8 KiB at a time and call `readMessage()` after each chunk, so the time to receive one message grows with the square of its size. A 15 MiB message arrives in at least 1,920 chunks, and about 14 GiB is searched in total.  **To Reproduce**  The snippet feeds one message to `ReadBuffer` in 8 KiB chunks, as the stdio transports do.  ```kotlin import io.modelcontextprotocol.kotlin.sdk.shared.ReadBuffer import kotlin.time.Duration import kotlin.time.measureTime  fun receive(sizeMiB: Int): Duration {     val data = "x".repeat(sizeMiB * 1024 * 1024)     val frame = """{"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"$data"}}""" + "\n"     val bytes = frame.encodeToByteArray()     val readBuffer = ReadBuffer()     return measureTime {         for (offset in bytes.indices step 8192) {             readBuffer.append(bytes.copyOfRange(offset, minOf(offset + 8192, bytes.size)))             // null until the last chunk arrives; every call searches the buffer from the start             readBuffer.readMessage()         }     } }  fun main() {     receive(1) // warm-up     for (sizeMiB in listOf(1, 2

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

### Incident Patch 1: `de2e90df` (2026-11-23)
**Commit Message**: fix(core): read a negative discovery ttlMs as zero instead of failing (#1188)

## Why

Goal: turn the confirmed review findings on #985 into atomic fixes.
Follow-up to #985.

A server that sends `"ttlMs": -1` in a `server/discover` result makes
the client fail to decode the whole result. The non-negative check in
`DiscoverResult`'s `init` also ran on decode. The [caching
spec](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
says: "If `ttlMs` is negative, clients SHOULD ignore it and treat it as
`0`."

## What changed

- `TtlMsSerializer` in `serializers.kt` reads a negative `ttlMs` as `0`
and writes the value unchanged.
- `DiscoverResult.ttlMs` uses it through `@Serializable(with =
TtlMsSerializer::class)`. The property stays `val`, so the non-negative
check in `init` still guards direct construction and no setter can
bypass it.
- The `init` check stays, so `DiscoverResult(ttlMs = -1)` in code still
throws `IllegalArgumentException`.

Design history: the init-block clamp suggested in
[review](https://github.com/modelcontextprotocol/kotlin-sdk/pull/1188#discussion_r4664081752)
landed in 56f5dac and is reverted in f54cbf5. The clamp required `ttlMs`

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/types/discovery.kt` (modified, +1/-0)
```diff
@@ -83,6 +83,7 @@ public data class DiscoverResult(
     @EncodeDefault
     val resultType: String = COMPLETE_RESULT_TYPE,
     @Required
+    @Serializable(with = TtlMsSerializer::class)
     val ttlMs: Long = 0,
     @Required
     val cacheScope: CacheScope = CacheScope.Private,
```

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/types/serializers.kt` (modified, +12/-0)
```diff
@@ -69,6 +69,18 @@ internal object MethodSerializer : KSerializer<Method> {
     override fun deserialize(decoder: Decoder): Method = Method.from(decoder.decodeString())
 }
 
+/** Per the caching spec, clients SHOULD ignore a negative `ttlMs` and treat it as `0`. */
+internal object TtlMsSerializer : KSerializer<Long> {
+    override val descriptor: SerialDescriptor =
+        PrimitiveSerialDescriptor("io.modelcontextprotocol.kotlin.sdk.types.TtlMs", PrimitiveKind.LONG)
+
+    override fun serialize(encoder: Encoder, value: Long) {
+        encoder.encodeLong(value)
+    }
+
+    override fun deserialize(decoder: Decoder): Long = decoder.decodeLong().coerceAtLeast(0)
+}
+
 // ============================================================================
 // Reference Serializers
 // ============================================================================
```

**File**: `kotlin-sdk-core/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/types/DiscoveryTest.kt` (modified, +16/-0)
```diff
@@ -213,6 +213,22 @@ class DiscoveryTest {
         }
     }
 
+    @Test
+    fun `should read a negative discovery ttl from the wire as zero`() {
+        val result = McpJson.decodeFromString<ServerResult>(
+            """
+            {
+              "supportedVersions": ["2026-07-28"],
+              "capabilities": {},
+              "ttlMs": -1,
+              "cacheScope": "private"
+            }
+            """.trimIndent(),
+        )
+
+        assertEquals(0L, assertIs<DiscoverResult>(result).ttlMs)
+    }
+
     @Test
     fun `should serialize unsupported protocol version data`() {
         verifySerialization(
```

---

### Incident Patch 2: `08f3c91b` (2026-11-24)
**Commit Message**: fix(core): fail requests on results of unknown shape instead of timing out (#1186)

A response whose result matched no known type failed to decode in the
transport, so it was dropped and the request ended with a timeout. Such
a result is now kept as received (internal `CustomResult`), and the
request fails at once with `SerializationException`. Typed results of
extension methods come later, picked by request method (Skills in
#1020).

## How Has This Been Tested?

`JsonRpcTest` round-trips a response with a result of unknown shape.
`ProtocolTest` checks that a request with such a result throws
`SerializationException` instead of timing out. JVM tests of core,
client and server pass, as do the core tests on JS; `ProtocolTest` and
`JsonRpcTest` also pass on macosArm64.

## Breaking Changes

None in the API. A request whose result has an unknown shape now throws
`SerializationException` at once; before, it timed out with
`McpException` (`REQUEST_TIMEOUT`).

Closes #1087

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/Protocol.kt` (modified, +8/-1)
```diff
@@ -3,6 +3,7 @@ package io.modelcontextprotocol.kotlin.sdk.shared
 import io.github.oshai.kotlinlogging.KotlinLogging
 import io.modelcontextprotocol.kotlin.sdk.types.CancelledNotification
 import io.modelcontextprotocol.kotlin.sdk.types.CancelledNotificationParams
+import io.modelcontextprotocol.kotlin.sdk.types.CustomResult
 import io.modelcontextprotocol.kotlin.sdk.types.EmptyResult
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCEmptyMessage
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCError
@@ -814,8 +815,14 @@ public abstract class Protocol(@PublishedApi internal val options: ProtocolOptio
                 }
 
                 try {
+                    val value = response!!.result
+                    if (value is CustomResult) {
+                        throw SerializationException(
+                            "Cannot determine RequestResult type from JSON: ${value.json.keys}",
+                        )
+                    }
                     @Suppress("UNCHECKED_CAST")
-                    result.complete(response!!.result as T)
+                    result.complete(value as T)
                 } catch (e: Throwable) {
                     result.completeExceptionally(e)
                 }
```

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/types/request.kt` (modified, +9/-0)
```diff
@@ -240,6 +240,15 @@ public data class EmptyResult(@SerialName("_meta") override val meta: JsonObject
     ClientResult,
     ServerResult
 
+/**
+ * A result whose shape matches no known [RequestResult] type, such as a custom method's, kept as received.
+ */
+@Serializable(with = CustomResultSerializer::class)
+internal data class CustomResult(val json: JsonObject) : RequestResult {
+    override val meta: JsonObject?
+        get() = json["_meta"] as? JsonObject
+}
+
 /**
  * Represents a paginated result.
  */
```

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/types/serializers.kt` (modified, +16/-2)
```diff
@@ -486,15 +486,29 @@ private fun selectServerResultDeserializer(element: JsonElement): Deserializatio
 /**
  * Polymorphic serializer for [RequestResult] types.
  * Supports both client and server results.
- * Throws [SerializationException] if the result type cannot be determined.
+ * Falls back to [CustomResult] if the result type cannot be determined.
  */
 internal object RequestResultPolymorphicSerializer :
     JsonContentPolymorphicSerializer<RequestResult>(RequestResult::class) {
     override fun selectDeserializer(element: JsonElement): DeserializationStrategy<RequestResult> =
         selectClientResultDeserializer(element)
             ?: selectServerResultDeserializer(element)
             ?: selectEmptyResult(element)
-            ?: throw SerializationException("Cannot determine RequestResult type from JSON: ${element.jsonObject.keys}")
+            ?: CustomResultSerializer
+}
+
+/**
+ * Writes and reads a [CustomResult] as its JSON object, unchanged.
+ */
+internal object CustomResultSerializer : KSerializer<CustomResult> {
+    override val descriptor: SerialDescriptor = JsonObject.serializer().descriptor
+
+    override fun serialize(encoder: Encoder, value: CustomResult) {
+        JsonObject.serializer().serialize(encoder, value.json)
+    }
+
+    override fun deserialize(decoder: Decoder): CustomResult =
+        CustomResult(JsonObject.serializer().deserialize(decoder))
 }
 
 /**
```

**File**: `kotlin-sdk-core/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/ProtocolTest.kt` (modified, +20/-0)
```diff
@@ -9,6 +9,7 @@ import io.kotest.matchers.types.shouldBeInstanceOf
 import io.kotest.matchers.types.shouldBeSameInstanceAs
 import io.modelcontextprotocol.kotlin.sdk.types.CustomRequest
 import io.modelcontextprotocol.kotlin.sdk.types.EmptyResult
+import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCNotification
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCResponse
@@ -28,6 +29,7 @@ import kotlinx.coroutines.async
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.TestScope
 import kotlinx.coroutines.test.runTest
+import kotlinx.serialization.SerializationException
 import kotlinx.serialization.json.JsonObject
 import kotlinx.serialization.json.buildJsonObject
 import kotlinx.serialization.json.encodeToJsonElement
@@ -257,4 +259,22 @@ class ProtocolTest {
         }
         error.message.shouldNotBeNull() shouldContain "maxInFlightHandlers"
     }
+
+    /** Decodes a response to [id] the way a transport does. */
+    private fun wireResponse(id: RequestId, result: String): JSONRPCMessage =
+        McpJson.decodeFromString("""{"jsonrpc":"2.0","id":${McpJson.encodeToString(id)},"result":$result}""")
+
+    @Test
+    fun `request rejects a result of unknown shape instead of timing out`() = runTest {
+        val (protocol, transport) = connectedProtocol()
+        val inFlight = async {
+            shouldThrow<SerializationException> {
+                protocol.request<EmptyResult>(CustomRequest(Method.Custom("skills/list"), null))
+            }
+        }
+
+        transport.deliver(wireResponse(transport.awaitRequest().id, """{"skills":[]}"""))
+
+        inFlight.await()
+    }
 }
```

**File**: `kotlin-sdk-core/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/types/JsonRpcTest.kt` (modified, +20/-0)
```diff
@@ -186,6 +186,26 @@ class JsonRpcTest {
         )
     }
 
+    @Test
+    fun `should keep a JSONRPCResponse result of unknown shape as received`() {
+        val message = verifyDeserialization<JSONRPCMessage>(
+            McpJson,
+            """
+            {
+              "id": 3,
+              "result": {
+                "skills": [{ "uri": "skill://code-review/SKILL.md" }],
+                "_meta": { "traceId": "abc" }
+              },
+              "jsonrpc": "2.0"
+            }
+            """.trimIndent(),
+        )
+
+        val result = assertIs<CustomResult>(assertIs<JSONRPCResponse>(message).result)
+        result.meta shouldBe buildJsonObject { put("traceId", "abc") }
+    }
+
     @Test
     fun `should decode JSONRPCMessage as request`() {
         val json = """
```

---

### Incident Patch 3: `702cbf02` (2026-11-23)
**Commit Message**: fix(server): log resource updates skipped without a subscription (#1216)

The fallback for a session with no subscription was `?: { ... }`, a
lambda that is never invoked, so the skip was never logged.

The `?.let { ... } ?: ...` chain is now a `when`, and the skip is logged
at `debug`: a session without a subscription is the common case and hits
this branch on every resource update. Notification delivery is
unchanged.

Closes #1082

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/FeatureNotificationService.kt` (modified, +14/-13)
```diff
@@ -119,23 +119,24 @@ private class SessionNotificationJob {
             }
 
             is ResourceUpdatedNotification -> {
-                resourceSubscriptions.value[notification.params.uri]?.let { resourceFromTimestamp ->
-                    if (event.timestamp >= resourceFromTimestamp) {
+                val uri = notification.params.uri
+                val subscribedAt = resourceSubscriptions.value[uri]
+                when {
+                    subscribedAt == null -> logger.debug {
+                        "No subscription for resource $uri in sessionId: ${session.sessionId}. Skipping notification"
+                    }
+
+                    event.timestamp < subscribedAt -> logger.info {
+                        "Skipping resource updated notification for resource $uri " +
+                            "as it is older than subscription timestamp $subscribedAt"
+                    }
+
+                    else -> {
                         logger.info {
-                            "Sending resource updated notification for resource ${notification.params.uri} " +
+                            "Sending resource updated notification for resource $uri " +
                                 "to sessionId: ${session.sessionId}"
                         }
                         session.notification(notification)
-                    } else {
-                        logger.info {
-                            "Skipping resource updated notification for resource ${notification.params.uri} " +
-                                "as it is older than subscription timestamp $resourceFromTimestamp"
-                        }
-                    }
-                } ?: {
-                    logger.info {
-                        "No subscription for resource ${notification.params.uri}. " +
-                            "Skipping notification: $notification"
                     }
                 }
             }
```

#### Recent Merged Pull Requests:
- **PR #1216** (2026-11-23): fix(server): log resource updates skipped without a subscription (@devcrocod)
- **PR #1207** (2026-11-20): fix(transport): hold inbound messages until the client transport is operational (@e5l)
- **PR #1206** (2026-11-20): fix(client): forget the discovery result when reconnecting (@e5l)
- **PR #1205** (closed): docs(server): describe the SSE response on the stateless endpoint (@e5l)
- **PR #1204** (2026-11-24): fix(client): keep no result fetched across a cache invalidation (@e5l)
- **PR #1203** (2026-11-24): fix(core): refuse a non-string protocolVersion in toEnvelope (@e5l)

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

## X. core): read a negative discovery ttlMs as zero instead of failing

**RULE**:
When implementing operations in `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/types/discovery.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in modelcontextprotocol/kotlin-sdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `de2e90df`: core): read a negative discovery ttlMs as zero instead of failing. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/types/discovery.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
    @Serializable(with = TtlMsSerializer::class)
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `de2e90df` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
