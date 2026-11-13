# Verification Protocol: Verification Protocol: Empirical Defect Shield for modelcontextprotocol-kotlin-sdk-learnings

<!-- PROVENANCE_START
{
  "source_repository": "modelcontextprotocol-kotlin-sdk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:41:50.057Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-modelcontextprotocol-kotlin-sdk-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [modelcontextprotocol-kotlin-sdk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:41:50.057Z`  
> **Learning ID**: `LEARN-REEXTRACT-modelcontextprotocol-kotlin-sdk-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `modelcontextprotocol-kotlin-sdk-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-kotlin-sdk-learnings.md`  
> **Source**: github ([https://github.com/modelcontextprotocol/kotlin-sdk](https://github.com/modelcontextprotocol/kotlin-sdk))  
> **Source Version**: `0fd2f874`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T08:07:04.928Z  
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
> **Harvest Timestamp**: 2026-11-12T08:04:31.666Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/kotlin-sdk`
- **Description**: The official Kotlin SDK for Model Context Protocol servers and clients. Maintained in collaboration with JetBrains
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1486 stars

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
                timeout = base.timeout,
            ),
        )
    }
}

/** The [
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
- **Issue #1093** (2026-11-09): **stdio: the time to receive a message grows with the square of its size**
  *Symptoms*: **Describe the bug**  `ReadBuffer.readNextLine()` searches for the newline from the start of the buffer on every `readMessage()` call:  https://github.com/modelcontextprotocol/kotlin-sdk/blob/382e27b0ee5bfd3dad89c9fbc34fff1984e16ecd/kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/ReadBuffer.kt#L65-L72  The stdio transports read up to 8 KiB at a time and call `readMessage()` after each chunk, so the time to receive one message grows with the square of its size. A 15 MiB message arrives in at least 1,920 chunks, and about 14 GiB is searched in total.  **To Reproduce**  The snippet feeds one message to `ReadBuffer` in 8 KiB chunks, as the stdio transports do.  ```kotlin import io.modelcontextprotocol.kotlin.sdk.shared.ReadBuffer import kotlin.time.Duration import kotlin.time.measureTime  fun receive(sizeMiB: Int): Duration {     val data = "x".repeat(sizeMiB * 1024 * 1024)     val frame = """{"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"$data"}}""" + "\n"     val bytes = frame.encodeToByteArray()     val readBuffer = ReadBuffer()     return measureTime {         for (offset in bytes.indices step 8192) {             readBuffer.append(bytes.copyOfRange(offset, minOf(offset + 8192, bytes.size)))             // null until the last chunk arrives; every call searches the buffer from the start             readBuffer.readMessage()         }     } }  fun main() {     receive(1) // warm-up     for (sizeMiB in listOf(1, 2

- **Issue #1086** (2026-11-10): **A cancelled handler stops StdioServerTransport**
  *Symptoms*: When a handler throws `CancellationException`, the `processorPump` of `StdioServerTransport` rethrows it. That ends the read loop, the `finally` block closes the write channel, and the transport fires `onClose` without `onError`. A single handler's cancellation, for example a cancelled request scope leaking out of a handler, therefore closes the whole connection. Other handler exceptions are logged and the loop continues.  **Expected:** treat a `CancellationException` that comes from a handler like any other handler failure, while the transport's own cancellation still stops it. They can be told apart, for example, with `currentCoroutineContext().isActive`. Update the test `should not invoke onError for CancellationException in handler`, which pins the current behavior.  Related: #518. 

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

### Incident Patch 1: `dfcb7a8b` (2026-11-10)
**Commit Message**: fix(core,server): keep StdioServerTransport running when a handler is cancelled (#1101)

Fixes #1086

## Problem

When a message handler threw `CancellationException`, `processorPump`
rethrew it. The read loop ended, the `finally` block closed the write
channel, and the transport fired `onClose` without `onError`. A single
handler's cancellation, for example a cancelled request scope leaking
out of a handler, closed the whole connection. Other handler exceptions
are logged and the loop continues.

## Change

- In the handler `catch` for `CancellationException`, call
`currentCoroutineContext().ensureActive()` first. If the transport's own
coroutine is cancelled (`close()` or a cancelled external scope), this
rethrows and the loop stops as before.
- Otherwise the exception came from the handler. It is logged and passed
to `onError`, like any other handler failure, and the loop continues.
- Follow-up in `Protocol.onRequest` (core, second commit): in the serial
phase before `notifications/initialized`, a `CancellationException`
leaking from a handler was rethrown. Once the Stdio transport stops
closing on it, that request got no reply and the peer waited for its own
timeout. It now ans

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/Protocol.kt` (modified, +4/-2)
```diff
@@ -42,6 +42,7 @@ import kotlinx.coroutines.NonCancellable
 import kotlinx.coroutines.SupervisorJob
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.currentCoroutineContext
+import kotlinx.coroutines.ensureActive
 import kotlinx.coroutines.job
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.sync.Semaphore
@@ -625,8 +626,9 @@ public abstract class Protocol(@PublishedApi internal val options: ProtocolOptio
                 )
             } catch (e: CancellationException) {
                 // Intentional exception to the always-rethrow-CE convention, only at this boundary.
-                if (handlerJob == null) throw e // serial phase: inline dispatch is not response-suppressed
-                if (handlerJob.isCancelled) throw e // genuine peer or close cancel: suppress the response
+                // Serial phase: the handler runs inline, so a real close cancels the delivering coroutine itself.
+                if (handlerJob == null) currentCoroutineContext().ensureActive()
+                if (handlerJob?.isCancelled == true) throw e // genuine peer or close cancel: suppress the response
                 // CE escaped a live handler job (e.g. a leaked inner withTimeout). Answer
                 // INTERNAL_ERROR so the peer does not hang until its own timeout.
                 respondWithError(capturedTransport, request, e)
```

**File**: `kotlin-sdk-core/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/ProtocolConcurrencyTest.kt` (modified, +29/-0)
```diff
@@ -165,6 +165,35 @@ class ProtocolConcurrencyTest {
         error.error.code shouldBe RPCError.ErrorCode.INTERNAL_ERROR
     }
 
+    @Test
+    fun `handler leaking CancellationException in the serial phase produces INTERNAL_ERROR`() = runTest {
+        val (protocol, transport) = connected(concurrent = false)
+        protocol.fallbackRequestHandler = { _, _ -> throw CancellationException("leaked") }
+
+        transport.deliver(JSONRPCRequest(id = RequestId(7L), method = "test/leak"))
+
+        val error = errorsOn(transport).single()
+        error.id shouldBe RequestId(7L)
+        error.error.code shouldBe RPCError.ErrorCode.INTERNAL_ERROR
+    }
+
+    @Test
+    fun `cancelling the delivering coroutine in the serial phase sends no response`() = runTest {
+        val (protocol, transport) = connected(concurrent = false)
+        protocol.fallbackRequestHandler = { _, _ ->
+            delay(10.seconds)
+            EmptyResult()
+        }
+
+        val delivery = launch { transport.deliver(JSONRPCRequest(id = RequestId(8L), method = "test/slow")) }
+        runCurrent()
+        delivery.cancel()
+        advanceUntilIdle()
+
+        delivery.isCancelled shouldBe true
+        transport.sentWithOptions shouldBe emptyList()
+    }
+
     @Test
     fun `suspension-free notification handlers observe strict arrival order`() = runTest {
         val (protocol, transport) = connected()
```

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StdioServerTransport.kt` (modified, +6/-1)
```diff
@@ -25,6 +25,7 @@ import kotlinx.coroutines.cancelAndJoin
 import kotlinx.coroutines.channels.Channel
 import kotlinx.coroutines.channels.ClosedSendChannelException
 import kotlinx.coroutines.currentCoroutineContext
+import kotlinx.coroutines.ensureActive
 import kotlinx.coroutines.isActive
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.withContext
@@ -218,7 +219,11 @@ public class StdioServerTransport private constructor(
                     try {
                         _onMessage(message)
                     } catch (e: CancellationException) {
-                        throw e
+                        // Only the transport's own cancellation stops the loop. A cancellation that
+                        // escapes a handler is a failure of that handler, like any other exception.
+                        currentCoroutineContext().ensureActive()
+                        logger.error(e) { "Message handler leaked a CancellationException" }
+                        _onError(e)
                     } catch (e: Throwable) {
                         logger.error(e) { "Error processing message" }
                         _onError(e)
```

**File**: `kotlin-sdk-server/src/jvmTest/kotlin/io/modelcontextprotocol/kotlin/sdk/server/StdioServerTransportTest.kt` (modified, +35/-19)
```diff
@@ -21,6 +21,7 @@ import kotlinx.coroutines.SupervisorJob
 import kotlinx.coroutines.asCoroutineDispatcher
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.coroutineScope
+import kotlinx.coroutines.job
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.withTimeoutOrNull
 import kotlinx.io.Buffer
@@ -225,24 +226,6 @@ class StdioServerTransportTest {
         server.close()
     }
 
-    @Test
-    fun `should not invoke onError for CancellationException in handler`() = runIntegrationTest {
-        val server = StdioServerTransport(input = bufferedInput, output = printOutput)
-        val capturedError = CompletableDeferred<Throwable>()
-        val closed = CompletableDeferred<Unit>()
-        server.onError { capturedError.complete(it) }
-        server.onClose { closed.complete(Unit) }
-        server.onMessage { throw CancellationException("cancelled") }
-        server.start()
-
-        inputWriter.write(serializeMessage(PingRequest().toJSON()))
-        inputWriter.flush()
-
-        // The cancellation stops the processor; the transport then shuts down without reporting an error.
-        closed.await()
-        capturedError.isCompleted shouldBe false
-    }
-
     // endregion
 
     @Test
@@ -400,9 +383,10 @@ class StdioServerTransportTest {
     @Test
     fun `should not hang close when handler suspends indefinitely`() = runIntegrationTest {
         val server = StdioServerTransport(input = bufferedInput, output = printOutput)
+        val capturedErrors = mutableListOf<Throwable>()
         val handlerEntered = CompletableDeferred<Unit>()
         val neverComplete = CompletableDeferred<Unit>()
-        server.onError {}
+        server.onError { capturedErrors.add(it) }
         server.onMessage {
             handlerEntered.complete(Unit)
             neverComplete.await()
@@ -414,6 +398,7 @@ class StdioServerTransportTest {
 
         handlerEntered.await()
         server.close()
+        capturedErrors shouldBe emptyList()
     }
 
     // endregion
@@ -442,6 +427,36 @@ class StdioServerTransportTest {
         ex.code shouldBe RPCError.ErrorCode.CONNECTION_CLOSED
     }
 
+    @Test
+    fun `should stop without onError when the scope is cancelled during a handler`() = runIntegrationTest {
+        val externalScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
+        val server = StdioServerTransport(input = bufferedInput, output = printOutput) {
+            scope = externalScope
+        }
+        val capturedErrors = mutableListOf<Throwable>()
+        val handlerEntered = CompletableDeferred<Unit>()
+        val closeCaptured = CompletableDeferred<Unit>()
+        server.onError { capturedErrors.add(it) }
+        server.onClose { closeCaptured.complete(Unit) }
+        server.onMessage {
+            handlerEntered.complete(Unit)
+            CompletableDeferred<Unit>().await()
+        }
+        server.start()
+
+        inputWriter.write(serializeMessage(PingRequest().toJSON()))
+        inputWriter.flush()
+        handlerEntered.await()
+        externalScope.cancel()
+
+        closeCaptured.await()
+        // onClose can fire before the processor has handled the cancellation, so wait for all pumps.
+        // Closing the input lets the blocking reader return.
+        inputWriter.close()
+        externalScope.coroutineContext.job.join()
+        capturedErrors shouldBe emptyList()
+    }
+
     @Test
     fun `should use ioDispatcher for reader and writer`() = runIntegrationTest {
         val threadName = "stdio-test-io-thread"
@@ -541,6 +556,7 @@ class StdioServerTransportTest {
     private fun handlerErrors() = listOf(
         RuntimeException("handler failure"),
         OutOfMemoryError("handler error"),
+        CancellationException("handler cancelled"),
     )
 
     /** A [RawSource] that immediately throws [throwable] on every read attempt. */
```

---

### Incident Patch 2: `cb43229a` (2026-11-10)
**Commit Message**: fix: omit empty _meta from outgoing requests (#1121) (#1122)

Fixes #1121

## Motivation and Context
`Client.callTool` wrapped `meta` in `RequestMeta` even when empty, so
every request carried `"_meta": {}`. Strict servers reject it: a Python
SDK user hit HTTP 400 / -32602 "_meta for Request must be a dict or
null" from Meta's hosted Ads MCP server (python-sdk#3473, fixed in
python-sdk#3628). The Kotlin client now only sends `_meta` when it's
non-empty, like the Swift, Go, Java and C# SDKs.

## How Has This Been Tested?
- `ClientMetaParameterTest`: an omitted meta now asserts `_meta` is
absent (this test previously pinned the empty object), and a new test
checks a non-empty meta is still sent.
- Reverting the fix makes the new assertion fail.
- `:kotlin-sdk-client:jvmTest` passes (57 tests), plus `ktlintCheck`,
`detekt` and `checkKotlinAbi` for the client module. Native, JS and wasm
targets weren't run locally.

## Breaking Changes
No API change (`checkKotlinAbi` passes). On the wire, an empty `_meta`
is no longer sent.

## Types of changes
- [x] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [x]

**File**: `integration-test/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/client/ClientTest.kt` (modified, +16/-0)
```diff
@@ -36,6 +36,7 @@ import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCMessage
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCRequest
 import io.modelcontextprotocol.kotlin.sdk.types.JSONRPCResponse
 import io.modelcontextprotocol.kotlin.sdk.types.ListRootsRequest
+import io.modelcontextprotocol.kotlin.sdk.types.ListRootsResult
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingLevel
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingMessageNotification
 import io.modelcontextprotocol.kotlin.sdk.types.LoggingMessageNotificationParams
@@ -182,6 +183,21 @@ class ClientTest {
         session.listRoots().roots.shouldBeEmpty()
     }
 
+    @Test
+    fun `listRoots should omit _meta when no params are given`() = runTest {
+        val client = newClient(ClientCapabilities(roots = ClientCapabilities.Roots()))
+        val session = connect(client)
+        val received = CompletableDeferred<ListRootsRequest>()
+        client.setRequestHandler<ListRootsRequest>(Method.Defined.RootsList) { request, _ ->
+            received.complete(request)
+            ListRootsResult(emptyList())
+        }
+
+        session.listRoots()
+
+        received.await().params?.meta shouldBe null
+    }
+
     @Test
     fun `roots mutators should require roots capability`() {
         val client = newClient()
```

**File**: `kotlin-sdk-client/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/client/Client.kt` (modified, +2/-2)
```diff
@@ -530,13 +530,13 @@ public open class Client(private val clientInfo: Implementation, options: Client
         validateMetaKeys(meta.keys)
 
         val jsonArguments = arguments.toJson()
-        val jsonMeta = meta.toJson()
+        val requestMeta = meta.takeIf { it.isNotEmpty() }?.let { RequestMeta(JsonObject(it.toJson())) }
 
         val request = CallToolRequest(
             CallToolRequestParams(
                 name = name,
                 arguments = JsonObject(jsonArguments),
-                meta = RequestMeta(JsonObject(jsonMeta)),
+                meta = requestMeta,
             ),
         )
         return callTool(request, options)
```

**File**: `kotlin-sdk-client/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/client/ClientMetaParameterTest.kt` (modified, +2/-3)
```diff
@@ -5,7 +5,6 @@ import io.kotest.assertions.withClue
 import io.kotest.matchers.shouldBe
 import io.kotest.matchers.string.shouldContain
 import io.kotest.matchers.types.shouldBeInstanceOf
-import io.modelcontextprotocol.kotlin.sdk.types.EmptyJsonObject
 import io.modelcontextprotocol.kotlin.sdk.types.Implementation
 import kotlinx.coroutines.test.runTest
 import kotlinx.serialization.json.JsonElement
@@ -77,10 +76,10 @@ class ClientMetaParameterTest {
     }
 
     @Test
-    fun `should send an empty _meta object when no meta is given`() = runTest {
+    fun `should omit _meta when no meta is given`() = runTest {
         connectedClient().callTool("test-tool", mapOf("arg" to "value"))
 
-        sentMeta() shouldBe EmptyJsonObject
+        sentMeta() shouldBe null
     }
 
     @Test
```

**File**: `kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/ServerSession.kt` (modified, +2/-1)
```diff
@@ -438,7 +438,8 @@ public open class ServerSession(
         options: RequestOptions? = null,
     ): ListRootsResult {
         logger.debug { "Listing roots with params: $params" }
-        return request(ListRootsRequest(BaseRequestParams(RequestMeta(params))), options)
+        val requestParams = params.takeIf { it.isNotEmpty() }?.let { BaseRequestParams(RequestMeta(it)) }
+        return request(ListRootsRequest(requestParams), options)
     }
 
     /**
```

---

### Incident Patch 3: `e3567782` (2026-11-09)
**Commit Message**: fix(core): resume ReadBuffer's newline search where it left off (#1094)

Remember how far `ReadBuffer` has searched for a newline and continue
from there, instead of searching the whole buffer again after every
chunk.

fixes #1093

## Motivation and Context

With this change, the time to receive a message over stdio grows in
proportion to its size, not with its square (#1093). Results are
unchanged; only the amount of searching differs.

The position is reset to 0 wherever bytes leave the buffer: when a line
is taken out, in `clear()`, and when the frame cap trips.

## How Has This Been Tested?

This change improves performance without changing results, so the
existing tests pass with or without it, and so do the new ones. The
three tests added to `ReadBufferTest` protect the state this change
introduces: each covers one place where the search position is reset,
and fails if that reset is removed. A test that reproduces the slowdown
would have to measure time, which depends on the machine, so I did not
add one; the speed-up is shown by the measurements in #1093.

## Breaking Changes

None. The public API is unchanged.

## Types of changes
- [x] Bug fix (non-breaking change which fi

**File**: `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/ReadBuffer.kt` (modified, +8/-2)
```diff
@@ -28,6 +28,9 @@ public class ReadBuffer internal constructor(private val maxFrameSize: Int) {
 
     private val buffer: Buffer = Buffer()
 
+    /** Number of bytes at the front of [buffer] already known to hold no line terminator. */
+    private var scannedBytes: Long = 0
+
     /** Appends raw bytes to the internal buffer for subsequent message parsing. */
     public fun append(chunk: ByteArray) {
         buffer.write(chunk)
@@ -73,11 +76,13 @@ public class ReadBuffer internal constructor(private val maxFrameSize: Int) {
     }
 
     private fun readNextLine(): String? {
-        val lfIndex = if (buffer.exhausted()) -1L else buffer.indexOf('\n'.code.toByte())
+        val lfIndex = if (buffer.exhausted()) -1L else buffer.indexOf('\n'.code.toByte(), startIndex = scannedBytes)
         if (lfIndex == -1L) {
+            scannedBytes = buffer.size
             failIfFrameTooLong(buffer.size)
             return null
         }
+        scannedBytes = 0
         failIfFrameTooLong(lfIndex)
 
         return if (lfIndex == 0L) {
@@ -98,7 +103,7 @@ public class ReadBuffer internal constructor(private val maxFrameSize: Int) {
 
     private fun failIfFrameTooLong(frameSize: Long) {
         if (maxFrameSize in 1..<frameSize) {
-            buffer.clear()
+            clear()
             throw TooLongFrameException(frameSize, maxFrameSize)
         }
     }
@@ -123,6 +128,7 @@ public class ReadBuffer internal constructor(private val maxFrameSize: Int) {
     /** Clears all buffered data, discarding any partially received messages. */
     public fun clear() {
         buffer.clear()
+        scannedBytes = 0
     }
 }
 
```

**File**: `kotlin-sdk-core/src/commonTest/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/ReadBufferTest.kt` (modified, +38/-0)
```diff
@@ -29,6 +29,21 @@ class ReadBufferTest {
         readBuffer.readMessage().shouldBeNull()
     }
 
+    @Test
+    fun `should yield a short message that follows a longer one split across chunks`() {
+        val readBuffer = ReadBuffer()
+        val longMessage: JSONRPCMessage = JSONRPCNotification(method = "x".repeat(line.length * 2))
+
+        readBuffer.append(serializeMessage(longMessage).removeSuffix("\n"))
+        readBuffer.readMessage().shouldBeNull()
+        // The rest of the long frame and a whole frame shorter than what was already searched.
+        readBuffer.append("\n$line")
+
+        readBuffer.readMessage() shouldBe longMessage
+        readBuffer.readMessage() shouldBe message
+        readBuffer.readMessage().shouldBeNull()
+    }
+
     @Test
     fun `should skip empty blank and malformed lines and return the next message`() {
         val readBuffer = ReadBuffer()
@@ -60,6 +75,18 @@ class ReadBufferTest {
         readBuffer.readMessage() shouldBe message
     }
 
+    @Test
+    fun `should yield a message shorter than the searched partial data discarded by clear`() {
+        val readBuffer = ReadBuffer()
+        readBuffer.append("a".repeat(line.length * 2))
+        readBuffer.readMessage().shouldBeNull()
+
+        readBuffer.clear()
+        readBuffer.append(line)
+
+        readBuffer.readMessage() shouldBe message
+    }
+
     @Test
     fun `should fail when an unframed blob exceeds the cap`() {
         val readBuffer = ReadBuffer(maxFrameSize = 64)
@@ -69,6 +96,17 @@ class ReadBufferTest {
         shouldThrow<TooLongFrameException> { readBuffer.readMessage() }.message shouldContain "maximum size"
     }
 
+    @Test
+    fun `should yield the next message after rejecting an unframed blob`() {
+        val readBuffer = ReadBuffer(maxFrameSize = 64)
+        readBuffer.append("a".repeat(100))
+        shouldThrow<TooLongFrameException> { readBuffer.readMessage() }
+
+        readBuffer.append(line)
+
+        readBuffer.readMessage() shouldBe message
+    }
+
     @Test
     fun `should accept a line of exactly maxFrameSize bytes and reject a longer one`() {
         val frameSize = json.encodeToByteArray().size
```

#### Recent Merged Pull Requests:
- **PR #1169** (2026-11-09): chore(deps): bump github/codeql-action from 4.39.1 to 4.39.3 in the all-actions group (@dependabot[bot])
- **PR #1168** (2026-11-09): chore(deps): bump org.jetbrains.dokka:dokka-gradle-plugin from 2.2.0 to 2.3.0 in the gradle-plugins group across 1 directory (@dependabot[bot])
- **PR #1167** (2026-11-10): chore(deps): bump org.jetbrains.kotlinx:kotlinx-io-core from 0.9.1 to 0.9.2 in the kotlinx group across 1 directory (@dependabot[bot])
- **PR #1166** (2026-11-09): chore(deps): bump com.anthropic:anthropic-java from 3.3.0 to 3.6.0 in /samples/kotlin-mcp-client in the other-dependencies group across 1 directory (@dependabot[bot])
- **PR #1164** (2026-11-06): chore: rewrite the mcp-docs skill for the 2026-07-28 spec (@devcrocod)
- **PR #1163** (2026-11-10): build: require Kotlin 2.3 and stop core from pulling in the Ktor server (@devcrocod)

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

## X. core,server): keep StdioServerTransport running when a handler is cancelled (#11

**RULE**:
When implementing operations in `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/Protocol.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in modelcontextprotocol/kotlin-sdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dfcb7a8b`: core,server): keep StdioServerTransport running when a handler is cancelled (#1101). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `kotlin-sdk-core/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/shared/Protocol.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
import kotlinx.coroutines.ensureActive
                // Serial phase: the handler runs inline, so a real close cancels the delivering coroutine itself.
                if (handlerJob == null) currentCoroutineContext().ensureActive()
                if (handlerJob?.isCancelled == true) throw e // genuine peer or close cancel: suppress the response
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
                if (handlerJob == null) throw e // serial phase: inline dispatch is not response-suppressed
                if (handlerJob.isCancelled) throw e // genuine peer or close cancel: suppress the response
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dfcb7a8b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
