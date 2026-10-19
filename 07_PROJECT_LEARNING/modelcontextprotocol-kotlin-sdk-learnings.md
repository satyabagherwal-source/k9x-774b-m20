> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-kotlin-sdk-learnings.md`  
> **Source**: github ([https://github.com/modelcontextprotocol/kotlin-sdk](https://github.com/modelcontextprotocol/kotlin-sdk))  
> **Source Version**: `d9f19a1d`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T14:46:57.418Z  
> **Learning ID**: `learn-github-modelcontextprotocol-kotlin-sdk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): modelcontextprotocol/kotlin-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-kotlin-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/kotlin-sdk](https://github.com/modelcontextprotocol/kotlin-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T14:46:57.412Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/kotlin-sdk`
- **Description**: The official Kotlin SDK for Model Context Protocol servers and clients. Maintained in collaboration with JetBrains
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1471 stars

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
        } catch (e: Exception) {
            _state.store(ClientTransportState.InitializationFailed)
            closeResources()
            throw e
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
     * Called by [send] after verifying transport [state].
     *
     * @param message The JSON-RPC message to be sent. Must comply with the JSON-RPC 2.0 specification.
     * @param options Optional parameters that influence how the message is transmitted, such as
     *                timeout settings or delivery guarantees. May be null if no specific options
     *                are required.
     * @see send
     */
    protected abstract suspend fun performSend(message: JSONRPCMessage, options: TransportSendOptions? = null)

    /**
     * Closes the client transport gracef
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
                timeout = base.timeout,
            ),
        )
    }
}

/** The [RequestHandlerExtra] of the MCP request
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
    }

    private val logger = KotlinLogging.logger { }

    private val buffer: Buffer = Buffer()

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
                logger.error(e) { "Failed to deserialize message from line: $line\nAttempting to recover..." }
                tryRecover(line)
            }
            if (message != null) {
                return message
            }
        }
    }

    private fun readNextLine(): String? {
        val lfIndex = if (buffer.exhausted()) -1L else buffer.indexOf('\n'.code.toByte())
        if (lfIndex == -1L) {
            failIfFrameTooLong(buffer.size)
            return null
        }
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
            buffer.clear()
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
        } catch (ignored: Exception) {
            logger.error(ignored) { "Deserialization failed for line: $line\nSkipping..." }
            null
        }
    }

    /** Clears all buffered data, discarding any partially received messages. */
    public fun clear() {
        buffer.clear()
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
- **Issue #1080** (2026-10-16): **SseClientTransport cannot connect to an SSE server mounted on a subpath**
  *Symptoms*: An SDK SSE server announces a query-only endpoint, `?sessionId=…`. `SseClientTransport` resolves a relative endpoint against the parent directory of the SSE URL instead of following RFC 3986, under which a query-only reference keeps the base path.  Steps: server `mcp("/sse")`, client `SseClientTransport(urlString = "http://localhost:…/sse")` without a custom `requestBuilder`. The client opens `GET /sse`, then posts to `/?sessionId=…` and gets `404`. `connect()` fails with `Error POSTing to endpoint (HTTP 404 Not Found)`. Servers mounted at the root work only by accident.  **Expected:** resolve the endpoint per RFC 3986, for example with Ktor's `URLBuilder.takeFrom`, and add a subpath test without a path override.  The SSE transport is deprecated, so this is a correctness fix for the releases that still ship it. 

- **Issue #1079** (2026-10-15): **mcpStreamableHttp fails when the SSE plugin is already installed**
  *Symptoms*: `Application.mcp { }` and `Application.mcpStreamableHttp { }` call `install(SSE)` unconditionally. Ktor throws `DuplicatePluginException` when the application already has the SSE plugin installed, or when two `mcpStreamableHttp` endpoints are registered in one application. Content negotiation, right next to it, is already installed only when it is missing.  **Expected:** install SSE only if `pluginOrNull(SSE) == null`, with a test that registers two endpoints in one application. 

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

### Incident Patch 1: `43c7c252` (2026-09-30)
**Commit Message**: test: remove redundant tests and fix vacuous ones (#1054)

Trims the test suite down to tests that protect real SDK behavior and
fixes tests that could not fail. This touches only tests and test
infrastructure; there are no production changes.

- **Core types:**
- Removed serialize/deserialize twins, per-field copies and "minimal"
variants. They re-ran the same generated serializer that
`verifySerialization` already round-trips.
- The result and request tests that remain now go through the
polymorphic `ServerResult`, `ClientResult` and `Request` dispatch.
  - One table test now covers every request method.
- **DSL builders and the URI template matcher:**
  - Removed duplicated builder tests.
- Removed the 7 matcher "security" tests that still passed with
normalization disabled; JVM tests that fail without it replace them.
- **Protocol and transports:**
  - Removed duplicated state-machine tests.
- Removed the client lifecycle suite, which re-tested
`AbstractClientTransport` for three transports.
  - The `terminateSession` tests now actually send a DELETE.
- **integration-test:**
- The registry CRUD and `list_changed` suites were copied per feature
type; they are now parameterized t

**File**: `buildSrc/src/main/kotlin/mcp.multiplatform.gradle.kts` (modified, +0/-2)
```diff
@@ -34,8 +34,6 @@ kotlin {
 
             useJUnitPlatform()
 
-            maxParallelForks = Runtime.getRuntime().availableProcessors()
-            forkEvery = 100
             testLogging {
                 exceptionFormat = TestExceptionFormat.SHORT
                 events("failed")
```

**File**: `buildSrc/src/main/kotlin/netty-convention.gradle.kts` (removed, +0/-61)
```diff
@@ -1,61 +0,0 @@
-import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension
-
-/**
- * Netty convention plugin that adds platform-specific Netty native transport libraries
- * to the jvmTest source set. This is similar to how Maven handles OS-specific dependencies
- * with profile activation.
- *
- * This plugin should be applied to any module that uses Netty for testing.
- */
-val nettyVersion = "4.2.7.Final"
-plugins {
-    id("org.gradle.base")
-}
-
-// This plugin is applied to projects that already have the kotlin multiplatform plugin applied
-// It adds the Netty native transport libraries to the jvmTest source set
-
-afterEvaluate {
-
-    extensions.findByType<KotlinMultiplatformExtension>()?.apply {
-        sourceSets.findByName("jvmTest")?.apply {
-            dependencies {
-                // Netty native transport libraries for different platforms
-                val osName = System.getProperty("os.name").lowercase()
-                val osArch = System.getProperty("os.arch").lowercase()
-
-                // Add the base Netty platform
-                implementation(project.dependencies.platform("io.netty:netty-bom:$nettyVersion"))
-
-                when {
-                    osName.contains("linux") -> {
-                        val archClassifier =
-                            if (osArch.contains("aarch64")) {
-                                "linux-aarch_64"
-                            } else {
-                                "linux-x86_64"
-                            }
-                        runtimeOnly(
-                            "io.netty:netty-transport-native-epoll:$nettyVersion:$archClassifier",
-                        )
-                    }
-
-                    osName.contains("mac") -> {
-                        val archClassifier =
-                            if (osArch.contains("aarch64")) {
-                                "osx-aarch_64"
-                            } else {
-                                "osx-x86_64"
-                            }
-                        runtimeOnly(
-                            "io.netty:netty-transport-native-kqueue:$nettyVersion:$archClassifier",
-                        )
-                        runtimeOnly(
-                            "io.netty:netty-resolver-dns-native-macos:$nettyVersion:$archClassifier",
-                        )
-                    }
-                }
-            }
-        }
-    }
-}
```

**File**: `gradle/libs.versions.toml` (modified, +0/-3)
```diff
@@ -8,7 +8,6 @@ kover = "0.9.9"
 ktlint = "14.2.0"
 knit = "0.5.1"
 mavenPublish = "0.37.0"
-netty = "4.2.18.Final"
 
 # libraries version
 awaitility = "4.3.0"
@@ -41,7 +40,6 @@ kotlinx-io-core = { group = "org.jetbrains.kotlinx", name = "kotlinx-io-core", v
 kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }
 
 # Ktor
-ktor-client-apache5 = { group = "io.ktor", name = "ktor-client-apache5", version.ref = "ktor" }
 ktor-client-auth = { group = "io.ktor", name = "ktor-client-auth", version.ref = "ktor" }
 ktor-client-core = { group = "io.ktor", name = "ktor-client-core", version.ref = "ktor" }
 ktor-client-logging = { group = "io.ktor", name = "ktor-client-logging", version.ref = "ktor" }
@@ -62,7 +60,6 @@ kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-cor
 ktor-client-mock = { group = "io.ktor", name = "ktor-client-mock", version.ref = "ktor" }
 ktor-server-test-host = { group = "io.ktor", name = "ktor-server-test-host", version.ref = "ktor" }
 mockk = { module = "io.mockk:mockk", version.ref = "mockk" }
-netty-bom = { group = "io.netty", name = "netty-bom", version.ref = "netty" }
 slf4j-simple = { group = "org.slf4j", name = "slf4j-simple", version.ref = "slf4j" }
 junit-jupiter-params = { module = "org.junit.jupiter:junit-jupiter-params", version.ref = "junit" }
 
```

**File**: `integration-test/build.gradle.kts` (modified, +0/-2)
```diff
@@ -25,8 +25,6 @@ kotlin {
                 implementation(libs.ktor.server.websockets)
                 implementation(libs.ktor.server.auth)
                 implementation(libs.ktor.server.test.host)
-                implementation(libs.ktor.server.content.negotiation)
-                implementation(libs.ktor.serialization)
             }
         }
         jvmTest {
```

**File**: `integration-test/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/client/ClientTest.kt` (modified, +250/-1372)
```diff
@@ -1,6 +1,14 @@
 package io.modelcontextprotocol.kotlin.sdk.client
 
+import io.kotest.assertions.throwables.shouldThrow
+import io.kotest.assertions.throwables.shouldThrowAny
+import io.kotest.assertions.withClue
+import io.kotest.matchers.collections.shouldBeEmpty
+import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
 import io.kotest.matchers.shouldBe
+import io.kotest.matchers.string.shouldContain
+import io.kotest.matchers.string.shouldStartWith
+import io.kotest.matchers.types.shouldBeInstanceOf
 import io.modelcontextprotocol.kotlin.sdk.server.Server
 import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
 import io.modelcontextprotocol.kotlin.sdk.server.ServerSession
@@ -12,27 +20,22 @@ import io.modelcontextprotocol.kotlin.sdk.types.ClientCapabilities
 import io.modelcontextprotocol.kotlin.sdk.types.CreateMessageRequest
 import io.modelcontextprotocol.kotlin.sdk.types.CreateMessageResult
 import io.modelcontextprotocol.kotlin.sdk.types.DoubleSchema
+import io.modelcontextprotocol.kotlin.sdk.types.ElicitRequest
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitRequestFormParams
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitRequestParams
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitRequestURLParams
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitResult
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitationCompleteNotification
 import io.modelcontextprotocol.kotlin.sdk.types.ElicitationCompleteNotificationParams
 import io.modelcontextprotocol.kotlin.sdk.types.EmptyJsonObject
+import io.modelcontextprotocol.kotlin.sdk.types.EnumOption
 import io.modelcontextprotocol.kotlin.sdk.types.Implementation
-import io.modelcontextprotocol.kotlin.sdk.types.InitializeRequest
 import io.modelcontextprotocol.kotlin.sdk.types.InitializeResult
 import io.modelcontextprotocol.kotlin.sdk.types.IntegerSchema
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
-import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCNotification
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCResponse
-import io.modelcontextprotocol.kotlin.sdk.types.LATEST_PROTOCOL_VERSION
-import io.modelcontextprotocol.kotlin.sdk.types.ListResourcesRequest
-import io.modelcontextprotocol.kotlin.sdk.types.ListResourcesResult
 import io.modelcontextprotocol.kotlin.sdk.types.ListRootsRequest
-import io.modelcontextprotocol.kotlin.sdk.types.ListToolsRequest
-import io.modelcontextprotocol.kotlin.sdk.types.ListToolsResult
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingLevel
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingMessageNotification
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingMessageNotificationParams
@@ -46,1532 +49,407 @@ import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
 import io.modelcontextprotocol.kotlin.sdk.types.StringSchema
 import io.modelcontextprotocol.kotlin.sdk.types.TextContent
 import io.modelcontextprotocol.kotlin.sdk.types.TitledMultiSelectEnumSchema
-import io.modelcontextprotocol.kotlin.sdk.types.Tool
-import io.modelcontextprotocol.kotlin.sdk.types.ToolSchema
 import io.modelcontextprotocol.kotlin.sdk.types.UntitledMultiSelectEnumSchema
 import io.modelcontextprotocol.kotlin.sdk.types.UntitledSingleSelectEnumSchema
 import io.modelcontextprotocol.kotlin.sdk.types.UrlElicitationRequiredException
 import kotlinx.coroutines.CompletableDeferred
-import kotlinx.coroutines.TimeoutCancellationException
-import kotlinx.coroutines.awaitCancellation
-import kotlinx.coroutines.cancel
-import kotlinx.coroutines.delay
-import kotlinx.coroutines.joinAll
-import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.runTest
-import kotlinx.coroutines.withTimeout
-import kotlinx.serialization.json.JsonObject
+import kotlinx.serialization.SerializationException
 import kotlinx.serialization.json.JsonPrimitive
+import kotlinx.serialization.json.add
 import kotlinx.serialization.json.buildJsonObject
-import kotlinx.serialization.json.jsonPrimitive
 import kotlinx.serialization.json.put
-import kotlin.coroutines.cancellation.CancellationException
+import kotlinx.serialization.json.putJsonArray
 import kotlin.test.Test
-import kotlin.test.assertEquals
-import kotlin.test.assertFailsWith
-import kotlin.test.assertIs
-import kotlin.test.assertNull
-import kotlin.test.assertTrue
-import kotlin.test.fail
-import kotlin.time.Duration.Companion.seconds
 
 class ClientTest {
-    @Test
-    fun `should initialize with matching protocol version`() = runTest {
-        var initialised = false
-        val clientTransport = object : AbstractTransport() {
-            override suspend fun start() {}
-
-            override suspend fun send(message: JSONRPCMessage, options: TransportSendOptions?) {
-                if (message !is JSONRPCRequest) return
-                initialised = true
-                val result = InitializeResult(
-                    protocolVersi
```

**File**: `integration-test/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/client/SseTransportTest.kt` (modified, +18/-100)
```diff
@@ -1,139 +1,57 @@
 package io.modelcontextprotocol.kotlin.sdk.client
 
+import io.kotest.matchers.shouldBe
 import io.ktor.client.HttpClient
 import io.ktor.server.application.install
 import io.ktor.server.cio.CIO
-import io.ktor.server.engine.EmbeddedServer
 import io.ktor.server.engine.embeddedServer
 import io.ktor.server.routing.routing
 import io.modelcontextprotocol.kotlin.sdk.server.Server
 import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
 import io.modelcontextprotocol.kotlin.sdk.server.mcp
-import io.modelcontextprotocol.kotlin.sdk.shared.BaseTransportTest
 import io.modelcontextprotocol.kotlin.sdk.types.Implementation
 import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.test.runTest
 import kotlinx.coroutines.withContext
-import kotlin.test.BeforeTest
 import kotlin.test.Test
 import io.ktor.client.plugins.sse.SSE as ClientSSE
 import io.ktor.server.sse.SSE as ServerSSE
 
-class SseTransportTest : BaseTransportTest() {
-
-    private suspend fun EmbeddedServer<*, *>.actualPort() = engine.resolvedConnectors().first().port
-
-    private lateinit var mcpServer: Server
-
-    @BeforeTest
-    fun setUp() {
-        mcpServer = Server(
-            serverInfo = Implementation(
-                name = "test-server",
-                version = "1.0",
-            ),
-            options = ServerOptions(ServerCapabilities()),
-        )
-    }
-
-    @Test
-    fun `should start then close cleanly`() = runTest {
-        val server = embeddedServer(CIO, port = 0) {
-            install(ServerSSE)
-            routing {
-                mcp { mcpServer }
-            }
-        }.startSuspend(wait = false)
-
-        val actualPort = server.actualPort()
-
-        val transport = HttpClient {
-            install(ClientSSE)
-        }.mcpSseTransport {
-            url {
-                host = "localhost"
-                this.port = actualPort
-            }
-        }
-
-        try {
-            testTransportOpenClose(transport)
-        } finally {
-            server.stopSuspend()
-        }
-    }
+class SseTransportTest {
 
     @Test
-    fun `should read messages`() = runTest {
-        val server = embeddedServer(CIO, port = 0) {
-            install(ServerSSE)
-            routing {
-                mcp { mcpServer }
-            }
-        }.startSuspend(wait = false)
-
-        val actualPort = server.actualPort()
-
-        val transport = HttpClient {
-            install(ClientSSE)
-        }.mcpSseTransport {
-            url {
-                host = "localhost"
-                this.port = actualPort
-            }
-        }
-
-        val client = Client(
-            clientInfo = Implementation(name = "test-client", version = "1.0"),
-            options = ClientOptions(),
+    fun `should connect ping and close over SSE`() = runTest {
+        val mcpServer = Server(
+            serverInfo = Implementation(name = "test-server", version = "1.0"),
+            options = ServerOptions(ServerCapabilities()),
         )
-
-        try {
-            withContext(Dispatchers.Default) {
-                client.connect(transport)
-                client.ping()
-            }
-        } finally {
-            client.close()
-            server.stopSuspend()
-        }
-    }
-
-    @Test
-    fun `test sse path not root path`() = runTest {
         val server = embeddedServer(CIO, port = 0) {
             install(ServerSSE)
-            routing {
-                mcp("/sse") { mcpServer }
-            }
+            routing { mcp { mcpServer } }
         }.startSuspend(wait = false)
-
-        val actualPort = server.actualPort()
-
-        val transport = HttpClient {
-            install(ClientSSE)
-        }.mcpSseTransport {
+        val serverPort = server.engine.resolvedConnectors().first().port
+        val httpClient = HttpClient { install(ClientSSE) }
+        val transport = httpClient.mcpSseTransport {
             url {
                 host = "localhost"
-                this.port = actualPort
-                pathSegments = listOf("sse")
+                port = serverPort
             }
         }
-
-        val client = Client(
-            clientInfo = Implementation(name = "test-client", version = "1.0"),
-            options = ClientOptions(),
-        )
+        var closed = false
+        transport.onClose { closed = true }
+        val client = Client(clientInfo = Implementation(name = "test-client", version = "1.0"))
 
         try {
             withContext(Dispatchers.Default) {
                 client.connect(transport)
                 client.ping()
+                client.close()
             }
+            closed shouldBe true
         } finally {
-            client.close()
-            server.stopSuspend()
+            httpClient.close()
+            server.stopSuspend(gracePeriodMillis = 0, timeoutMillis = 500)
         }
     }
 }
```

**File**: `integration-test/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/client/WebSocketTransportTest.kt` (removed, +0/-52)
```diff
@@ -1,52 +0,0 @@
-package io.modelcontextprotocol.kotlin.sdk.client
-
-import io.ktor.server.testing.testApplication
-import io.ktor.server.websocket.WebSockets
-import io.modelcontextprotocol.kotlin.sdk.server.mcpWebSocket
-import io.modelcontextprotocol.kotlin.sdk.server.mcpWebSocketTransport
-import io.modelcontextprotocol.kotlin.sdk.shared.BaseTransportTest
-import kotlinx.coroutines.CompletableDeferred
-import kotlin.test.Ignore
-import kotlin.test.Test
-
-class WebSocketTransportTest : BaseTransportTest() {
-    @Test
-    @Ignore // "Test disabled for investigation #17"
-    fun `should start then close cleanly`() = testApplication {
-        install(WebSockets)
-        routing {
-            mcpWebSocket()
-        }
-
-        val client = createClient {
-            install(io.ktor.client.plugins.websocket.WebSockets)
-        }.mcpWebSocketTransport()
-
-        testTransportOpenClose(client)
-    }
-
-    @Test
-    @Ignore // "Test disabled for investigation #17"
-    fun `should read messages`() = testApplication {
-        val clientFinished = CompletableDeferred<Unit>()
-
-        install(WebSockets)
-        routing {
-            mcpWebSocketTransport {
-                onMessage {
-                    send(it)
-                }
-
-                clientFinished.await()
-            }
-        }
-
-        val transport = createClient {
-            install(io.ktor.client.plugins.websocket.WebSockets)
-        }.mcpWebSocketTransport()
-
-        testTransportRead(transport)
-
-        clientFinished.complete(Unit)
-    }
-}
```

**File**: `integration-test/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/integration/InMemoryTransportTest.kt` (removed, +0/-206)
```diff
@@ -1,206 +0,0 @@
-package io.modelcontextprotocol.kotlin.sdk.integration
-
-import io.modelcontextprotocol.kotlin.sdk.shared.InMemoryTransport
-import io.modelcontextprotocol.kotlin.sdk.types.BaseNotificationParams
-import io.modelcontextprotocol.kotlin.sdk.types.InitializedNotification
-import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
-import io.modelcontextprotocol.kotlin.sdk.types.PromptListChangedNotification
-import io.modelcontextprotocol.kotlin.sdk.types.ResourceListChangedNotification
-import io.modelcontextprotocol.kotlin.sdk.types.ResourceUpdatedNotification
-import io.modelcontextprotocol.kotlin.sdk.types.ResourceUpdatedNotificationParams
-import io.modelcontextprotocol.kotlin.sdk.types.ToolListChangedNotification
-import io.modelcontextprotocol.kotlin.sdk.types.toJSON
-import kotlinx.coroutines.test.runTest
-import kotlin.test.BeforeTest
-import kotlin.test.Test
-import kotlin.test.assertEquals
-import kotlin.test.assertFailsWith
-import kotlin.test.assertNotNull
-import kotlin.test.assertTrue
-
-class InMemoryTransportTest {
-    private lateinit var clientTransport: InMemoryTransport
-    private lateinit var serverTransport: InMemoryTransport
-
-    @BeforeTest
-    fun setUp() {
-        val (client, server) = InMemoryTransport.createLinkedPair()
-        clientTransport = client
-        serverTransport = server
-    }
-
-    @Test
-    fun `should create linked pair`() {
-        assertNotNull(clientTransport)
-        assertNotNull(serverTransport)
-    }
-
-    @Test
-    fun `should start without error`() = runTest {
-        clientTransport.start()
-        serverTransport.start()
-        // If no exception is thrown, the test passes
-    }
-
-    @Test
-    fun `should send message from client to server`() = runTest {
-        val message = InitializedNotification()
-
-        var receivedMessage: JSONRPCMessage? = null
-        serverTransport.onMessage { msg ->
-            receivedMessage = msg
-        }
-
-        val rpcNotification = message.toJSON()
-        clientTransport.send(rpcNotification)
-        assertEquals(rpcNotification, receivedMessage)
-    }
-
-    @Test
-    fun `should send message from server to client`() = runTest {
-        val message = InitializedNotification()
-            .toJSON()
-
-        var receivedMessage: JSONRPCMessage? = null
-        clientTransport.onMessage { msg ->
-            receivedMessage = msg
-        }
-
-        serverTransport.send(message)
-        assertEquals(message, receivedMessage)
-    }
-
-    @Test
-    fun `should handle close`() = runTest {
-        var clientClosed = false
-        var serverClosed = false
-
-        clientTransport.onClose {
-            clientClosed = true
-        }
-
-        serverTransport.onClose {
-            serverClosed = true
-        }
-
-        clientTransport.close()
-        assertTrue(clientClosed)
-        assertTrue(serverClosed)
-    }
-
-    @Test
-    fun `should throw error when sending after close`() = runTest {
-        clientTransport.close()
-
-        assertFailsWith<IllegalStateException> {
-            clientTransport.send(
-                InitializedNotification().toJSON(),
-            )
-        }
-    }
-
-    @Test
-    fun `should queue messages sent before start`() = runTest {
-        val message = InitializedNotification()
-            .toJSON()
-
-        var receivedMessage: JSONRPCMessage? = null
-        serverTransport.onMessage { msg ->
-            receivedMessage = msg
-        }
-
-        clientTransport.send(message)
-        serverTransport.start()
-        assertEquals(message, receivedMessage)
-    }
-
-    @Test
-    fun `should send ToolListChangedNotification from server to client`() = runTest {
-        val notification = ToolListChangedNotification(
-            BaseNotificationParams(),
-        )
-
-        var receivedMessage: JSONRPCMessage? = null
-        clientTransport.onMessage { msg ->
-            receivedMessage = msg
-        }
-
-        val rpcMessage = notification.toJSON()
-        serverTransport.send(rpcMessage)
-        assertEquals(rpcMessage, receivedMessage)
-    }
-
-    @Test
-    fun `should send PromptListChangedNotification from server to client`() = runTest {
-        val notification = PromptListChangedNotification(
-            BaseNotificationParams(),
-        )
-
-        var receivedMessage: JSONRPCMessage? = null
-        clientTransport.onMessage { msg ->
-            receivedMessage = msg
-        }
-
-        val rpcMessage = notification.toJSON()
-        serverTransport.send(rpcMessage)
-        assertEquals(rpcMessage, receivedMessage)
-    }
-
-    @Test
-    fun `should send ResourceListChangedNotification from server to client`() = runTest {
-        val notification = ResourceListChangedNotification(
-            BaseNotificationParams(),
-        )
-
-        var receivedMessage: JSONRPCMessage? = null
-        clientTransport.onMessage { msg ->
-            receivedMessage = msg
```

---

### Incident Patch 2: `bb4353f6` (2026-10-15)
**Commit Message**: Fix duplicate SSE plugin installation in Ktor application helpers (#1079) (#1092)

Fixes #1079.

## Summary

- Install Ktor's SSE plugin only when it is absent in `Application.mcp`
and the shared `Application.mcpStreamableHttp` setup.
- Preserve an application's existing SSE plugin while keeping automatic
installation for the usual single-endpoint setup.
- Add regression coverage for preinstalled SSE in both helpers and two
Streamable HTTP endpoints in the same application. Each streamable
endpoint completes an MCP initialization and closes its session.

The production change is one import and two guards. There are no public
API changes.

## Testing

Using JDK 21.0.12.1 and the repository's Gradle 9.8.0 wrapper:

- Before the production fix, `./gradlew :kotlin-sdk-server:jvmTest
--tests '*KtorExtensionsTest'` ran 8 cases: the 3 duplicate-install
regressions failed with `DuplicatePluginException`, and the other 5
passed.
- After the fix, the same command passed all 8 cases.
- `./gradlew :kotlin-sdk-server:jvmTest` passed all 167 server JVM
tests, with no failures or skips.
- `./gradlew :kotlin-sdk-server:ktlintCheck` passed.
- `./gradlew :kotlin-sdk-server:detekt` passed, including


**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/KtorServer.kt` (modified, +9/-2)
```diff
@@ -9,6 +9,7 @@ import io.ktor.server.application.ApplicationCall
 import io.ktor.server.application.ApplicationCallPipeline
 import io.ktor.server.application.MissingApplicationPluginException
 import io.ktor.server.application.install
+import io.ktor.server.application.pluginOrNull
 import io.ktor.server.request.ApplicationRequest
 import io.ktor.server.request.header
 import io.ktor.server.request.httpMethod
@@ -128,6 +129,7 @@ public fun Route.mcp(
  *
  * Automatically installs [ContentNegotiation][io.ktor.server.plugins.contentnegotiation.ContentNegotiation]
  * with [McpJson][io.modelcontextprotocol.kotlin.sdk.types.McpJson] and [SSE].
+ * An already installed [SSE] plugin is reused.
  *
  * @param enableDnsRebindingProtection whether to install [DnsRebindingProtection] on this route. Defaults to `true`.
  * @param allowedHosts hostnames allowed in the `Host` header. Defaults to `localhost`, `127.0.0.1`, `[::1]`.
@@ -151,7 +153,9 @@ public fun Application.mcp(
     block: ServerSSESession.() -> Server,
 ) {
     installMcpContentNegotiation()
-    install(SSE)
+    if (pluginOrNull(SSE) == null) {
+        install(SSE)
+    }
 
     routing {
         mcp(enableDnsRebindingProtection, allowedHosts, allowedOrigins, maxRequestBodySize, block)
@@ -169,7 +173,9 @@ private fun Application.mcpStreamableHttp(
     block: RoutingContext.() -> Server,
 ) {
     installMcpContentNegotiation()
-    install(SSE)
+    if (pluginOrNull(SSE) == null) {
+        install(SSE)
+    }
 
     val transportManager = TransportManager<StreamableHttpServerTransport>()
 
@@ -220,6 +226,7 @@ private fun Application.mcpStreamableHttp(
  *
  * Automatically installs [ContentNegotiation][io.ktor.server.plugins.contentnegotiation.ContentNegotiation]
  * with [McpJson][io.modelcontextprotocol.kotlin.sdk.types.McpJson] and [SSE].
+ * An already installed [SSE] plugin is reused.
  *
  * @param path The base path for the MCP Streamable HTTP endpoint. Defaults to "/mcp".
  * @param enableDnsRebindingProtection Enables DNS rebinding attack protection for the endpoint. Defaults to `true`.
```

**File**: `kotlin-sdk-server/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/KtorExtensionsTest.kt` (modified, +43/-0)
```diff
@@ -6,18 +6,23 @@ import io.kotest.assertions.throwables.shouldThrow
 import io.kotest.matchers.nulls.shouldNotBeNull
 import io.kotest.matchers.string.shouldContain
 import io.ktor.client.HttpClient
+import io.ktor.client.request.delete
 import io.ktor.client.request.get
+import io.ktor.client.request.header
 import io.ktor.client.request.post
 import io.ktor.client.request.prepareGet
 import io.ktor.client.request.setBody
 import io.ktor.http.ContentType
+import io.ktor.http.HttpHeaders
 import io.ktor.http.HttpStatusCode
 import io.ktor.http.contentType
 import io.ktor.server.application.install
 import io.ktor.server.routing.route
 import io.ktor.server.routing.routing
 import io.ktor.server.sse.SSE
 import io.ktor.server.testing.testApplication
+import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
+import io.modelcontextprotocol.kotlin.sdk.types.McpJson
 import kotlin.test.Test
 
 class KtorExtensionsTest {
@@ -75,6 +80,44 @@ class KtorExtensionsTest {
         client.assertMcpEndpointsAt("/")
     }
 
+    @Test
+    fun `Application mcp should reuse an installed SSE plugin`() = testApplication {
+        application {
+            install(SSE)
+            mcp(enableDnsRebindingProtection = false) { testServer() }
+        }
+
+        client.assertMcpEndpointsAt("/")
+    }
+
+    @Test
+    fun `Application mcpStreamableHttp should register independent endpoints`() = testApplication {
+        application {
+            mcpStreamableHttp("/first") { testServer() }
+            mcpStreamableHttp("/second") { testServer() }
+        }
+
+        val firstSession = client.initializeStreamableSession("/first")
+        // Also proves /second is registered, so the 404 below comes from its own session table.
+        client.initializeStreamableSession("/second")
+
+        client.delete("/second") {
+            header(HttpHeaders.Host, "localhost")
+            header(MCP_SESSION_ID_HEADER, firstSession)
+        }.shouldHaveStatus(HttpStatusCode.NotFound)
+    }
+
+    /** POSTs `initialize` to the Streamable HTTP endpoint at [path] and returns the session id it assigns. */
+    private suspend fun HttpClient.initializeStreamableSession(path: String): String {
+        val response = post(path) {
+            header(HttpHeaders.Host, "localhost")
+            streamableHeaders()
+            setBody(McpJson.encodeToString(JSONRPCMessage.serializer(), initializeRequest()))
+        }
+        response.shouldHaveStatus(HttpStatusCode.OK)
+        return response.headers[MCP_SESSION_ID_HEADER].shouldNotBeNull()
+    }
+
     /**
      * GET at [path] opens an SSE stream announcing a session, a POST for that session is accepted,
      * and a POST without a session is rejected.
```

---

### Incident Patch 3: `b78de5ce` (2026-10-15)
**Commit Message**: fix(server): run onInitialized callbacks registered after initialization (#1019)

Fixes #920

`ServerSession.onInitialized` put callbacks together in a plain `var`,
and the `notifications/initialized` handler invoked it. That caused two
problems:

- If you register a callback after the client has sent
`notifications/initialized`, it never runs.
- The `var` is read and written without synchronization. When
`onInitialized` is called from several threads while the handshake is in
progress, two registrations can read the same old value, and one of the
callbacks is then dropped.

Pending callbacks are now stored in an `AtomicRef<PersistentList<() ->
Unit>?>`, using the same atomicfu + kotlinx-collections-immutable
pattern as `FeatureRegistry`:

- `onInitialized` adds the callback with `getAndUpdate`. If the ref was
already `null`, initialization has finished, so the callback runs right
away on the caller's thread.
- The initialized handler calls `getAndSet(null)` and runs the list it
gets back once, in registration order.

Each callback now runs at most once, and callbacks pending when
`notifications/initialized` arrives run in registration order. (A
callback never runs if the client do

**File**: `integration-test/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/ServerSessionInitializeTest.kt` (modified, +91/-0)
```diff
@@ -10,6 +10,7 @@ import io.modelcontextprotocol.kotlin.sdk.types.ClientCapabilities
 import io.modelcontextprotocol.kotlin.sdk.types.Implementation
 import io.modelcontextprotocol.kotlin.sdk.types.InitializeRequest
 import io.modelcontextprotocol.kotlin.sdk.types.InitializeRequestParams
+import io.modelcontextprotocol.kotlin.sdk.types.InitializedNotification
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCError
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
@@ -21,6 +22,7 @@ import io.modelcontextprotocol.kotlin.sdk.types.ServerCapabilities
 import io.modelcontextprotocol.kotlin.sdk.types.toJSON
 import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.Job
 import kotlinx.coroutines.joinAll
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.runTest
@@ -30,6 +32,7 @@ import kotlinx.serialization.json.put
 import kotlinx.serialization.json.putJsonObject
 import org.junit.jupiter.api.Test
 import java.util.concurrent.CopyOnWriteArrayList
+import java.util.concurrent.atomic.AtomicInteger
 
 class ServerSessionInitializeTest {
 
@@ -161,4 +164,92 @@ class ServerSessionInitializeTest {
         successes shouldHaveSize 1
         errors.map { it.error.code } shouldBe List(n - 1) { RPCError.ErrorCode.INVALID_REQUEST }
     }
+
+    private suspend fun connectAndInitialize(session: ServerSession): InMemoryTransport {
+        val (clientTransport, serverTransport) = InMemoryTransport.createLinkedPair()
+        val responseDone = CompletableDeferred<JSONRPCResponse>()
+        clientTransport.onMessage { message ->
+            if (message is JSONRPCResponse) responseDone.complete(message)
+        }
+
+        session.connect(serverTransport)
+        clientTransport.send(createInitializeRequest("test-client").toJSON())
+        responseDone.await()
+        return clientTransport
+    }
+
+    private suspend fun completeHandshake(session: ServerSession) {
+        connectAndInitialize(session).send(InitializedNotification().toJSON())
+    }
+
+    @Test
+    fun `should run onInitialized callback registered after initialization`() = runTest {
+        val session = createSession()
+        val calls = CopyOnWriteArrayList<String>()
+        val initialized = CompletableDeferred<Unit>()
+
+        session.onInitialized { calls.add("early") }
+        session.onInitialized { initialized.complete(Unit) }
+
+        completeHandshake(session)
+        initialized.await()
+
+        session.onInitialized { calls.add("late") }
+
+        calls shouldBe listOf("early", "late")
+    }
+
+    @Test
+    fun `should run each onInitialized callback exactly once when registration races initialization`() = runTest {
+        val session = createSession()
+        val clientTransport = connectAndInitialize(session)
+        val counters = List(200) { AtomicInteger() }
+
+        withContext(Dispatchers.Default) {
+            val barrier = CompletableDeferred<Unit>()
+            val jobs = mutableListOf<Job>()
+            counters.forEachIndexed { index, counter ->
+                // Mid-batch, so registrations land before, during and after the notification.
+                if (index == counters.size / 2) {
+                    jobs += launch {
+                        barrier.await()
+                        clientTransport.send(InitializedNotification().toJSON())
+                    }
+                }
+                jobs += launch {
+                    barrier.await()
+                    session.onInitialized { counter.incrementAndGet() }
+                }
+            }
+            barrier.complete(Unit)
+            jobs.joinAll()
+        }
+        // A duplicate notification must not run any callback again.
+        clientTransport.send(InitializedNotification().toJSON())
+
+        counters.map { it.get() } shouldBe List(counters.size) { 1 }
+    }
+
+    @Test
+    fun `should report onInitialized callback failures to onError without skipping other callbacks`() = runTest {
+        val errors = CopyOnWriteArrayList<Throwable>()
+        val session = object : ServerSession(
+            serverInfo = Implementation(name = "test-server", version = "1.0"),
+            options = ServerOptions(capabilities = ServerCapabilities()),
+            instructions = null,
+        ) {
+            override fun onError(error: Throwable) {
+                errors.add(error)
+            }
+        }
+        val calls = CopyOnWriteArrayList<String>()
+        session.onInitialized { error("early failure") }
+        session.onInitialized { calls.add("early") }
+
+        completeHandshake(session)
+        session.onInitialized { error("late failure") }
+
+        calls shouldBe listOf("early")
+        errors.map { it.message } shouldBe listOf("early failure", "late failure")
+    }
 }
```

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/ServerSession.kt` (modified, +30/-6)
```diff
@@ -31,8 +31,12 @@ import io.modelcontextprotocol.kotlin.sdk.types.SUPPORTED_PROTOCOL_VERSIONS
 import io.modelcontextprotocol.kotlin.sdk.types.SetLevelRequest
 import kotlinx.atomicfu.AtomicRef
 import kotlinx.atomicfu.atomic
+import kotlinx.atomicfu.getAndUpdate
+import kotlinx.collections.immutable.PersistentList
+import kotlinx.collections.immutable.persistentListOf
 import kotlinx.coroutines.CompletableDeferred
 import kotlinx.serialization.json.JsonObject
+import kotlin.coroutines.cancellation.CancellationException
 import kotlin.uuid.ExperimentalUuidApi
 import kotlin.uuid.Uuid
 
@@ -64,7 +68,12 @@ public open class ServerSession(
     @OptIn(ExperimentalUuidApi::class)
     public val sessionId: String = Uuid.random().toString()
 
-    private var _onInitialized: (() -> Unit) = {}
+    /**
+     * Callbacks waiting for `notifications/initialized`, or `null` once it has been received.
+     * A callback registered after that point runs immediately instead of being stored.
+     */
+    private val pendingInitializedCallbacks: AtomicRef<PersistentList<() -> Unit>?> =
+        atomic(persistentListOf())
 
     private var _onClose: () -> Unit = {}
 
@@ -94,7 +103,7 @@ public open class ServerSession(
             handleInitialize(request)
         }
         setNotificationHandler<InitializedNotification>(Defined.NotificationsInitialized) {
-            _onInitialized()
+            pendingInitializedCallbacks.getAndSet(null)?.forEach { callback -> callback() }
             CompletableDeferred(Unit)
         }
 
@@ -120,12 +129,27 @@ public open class ServerSession(
      *
      * The callback must be synchronous and fast: it runs on the message-dispatch path for
      * `notifications/initialized`, after concurrent dispatch has been enabled for the session.
+     *
+     * If initialization has already completed, [block] runs immediately on the calling thread.
+     * Otherwise it runs when `notifications/initialized` is received, after the callbacks
+     * registered before it. Each callback runs at most once.
+     *
+     * An exception thrown by [block] is reported to [onError] instead of being propagated,
+     * so it does not prevent other callbacks from running.
      */
     public fun onInitialized(block: () -> Unit) {
-        val old = _onInitialized
-        _onInitialized = {
-            old()
-            block()
+        val callback = {
+            try {
+                block()
+            } catch (e: CancellationException) {
+                throw e
+            } catch (cause: Throwable) {
+                logger.error(cause) { "Error in onInitialized callback" }
+                onError(cause)
+            }
+        }
+        if (pendingInitializedCallbacks.getAndUpdate { it?.adding(callback) } == null) {
+            callback()
         }
     }
 
```

#### Recent Merged Pull Requests:
- **PR #1126** (2026-10-19): chore(deps): bump zod from 4.6.5 to 4.6.7 in /integration-test/src/jvmTest/typescript in the all-dependencies group (@dependabot[bot])
- **PR #1116** (2026-10-14): chore(deps): bump kotlin from 2.4.20 to 2.4.21 in /samples/weather-stdio-server (@dependabot[bot])
- **PR #1115** (2026-10-14): chore(deps): bump the all-dependencies group across 1 directory with 2 updates (@dependabot[bot])
- **PR #1114** (2026-10-14): chore(deps): bump kotlin from 2.4.20 to 2.4.21 in /samples/simple-streamable-server (@dependabot[bot])
- **PR #1113** (2026-10-13): chore(deps): bump kotlin from 2.4.20 to 2.4.21 in /samples/kotlinlang-mcp-server (@dependabot[bot])
- **PR #1112** (2026-10-14): chore(deps): bump gradle-wrapper from 9.8.0 to 9.8.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
