# Forensic Learning Record (Deep Inspection): JuulLabs/kable

> **Canonical Artifact**: `07_PROJECT_LEARNING/juullabs-kable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/JuulLabs/kable](https://github.com/JuulLabs/kable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:07:33.122Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `JuulLabs/kable`
- **Description**: Kotlin Asynchronous Bluetooth Low-Energy
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1197 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `kable-core/src/androidMain/kotlin/AndroidAdvertisement.kt`
```
package com.juul.kable

@Deprecated(
    "Moved to `PlatformAdvertisement`",
    replaceWith = ReplaceWith("PlatformAdvertisement"),
    level = DeprecationLevel.HIDDEN,
)
public typealias AndroidAdvertisement = PlatformAdvertisement

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/AndroidPeripheral.kt`
```
package com.juul.kable

import android.Manifest
import android.Manifest.permission.BLUETOOTH_CONNECT
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothStatusCodes
import android.os.Build
import androidx.annotation.RequiresPermission
import kotlinx.coroutines.flow.StateFlow

@Deprecated(
    message = "Moved as nested class of `AndroidPeripheral`.",
    replaceWith = ReplaceWith("AndroidPeripheral.Priority"),
    level = DeprecationLevel.HIDDEN,
)
public typealias Priority = AndroidPeripheral.Priority

public interface AndroidPeripheral : Peripheral {

    public enum class Priority { Low, Balanced, High }

    public enum class Type {

        /** https://developer.android.com/reference/android/bluetooth/BluetoothDevice#DEVICE_TYPE_CLASSIC */
        Classic,

        /**
         * Low Energy - LE-only
         * https://developer.android.com/reference/android/bluetooth/BluetoothDevice#DEVICE_TYPE_LE
         */
        LowEnergy,

        /**
         * Dual Mode - BR/EDR/LE
         * https://developer.android.com/reference/android/bluetooth/BluetoothDevice#DEVICE_TYPE_DUAL
         */
        DualMode,

        /** https://developer.android.com/reference/android/bluetooth/BluetoothDevice#DEVICE_TYPE_UNKNOWN */
        Unknown,
    }

    /**
     * Represents possible write operation results, as defined by Android's
     * [WriteOperationReturnValues](https://cs.android.com/android/platform/superproject/main/+/b7a389a145ff443550e1a942bf713c60c2bd6a14:packages/modules/Bluetooth/framework/java/android/bluetooth/BluetoothGatt.java;l=1587-1593)
     * `IntDef`.
     */
    public enum class WriteResult {

        /**
         * Error code indicating that the Bluetooth Device specified is not connected, but is bonded.
         *
         * https://cs.android.com/android/platform/superproject/main/+/main:packages/modules/Bluetooth/framework/java/android/bluetooth/BluetoothStatusCodes.java;l=50
         */
        NotConnected,

        /**
         * A GATT writeCharacteristic request is not permitted on the remote device.
         *
         * See: [BluetoothStatusCodes.ERROR_GATT_WRITE_NOT_ALLOWED]
         * https://developer.android.com/reference/kotlin/android/bluetooth/BluetoothStatusCodes#error_gatt_write_not_allowed
         */
        WriteNotAllowed,

        /**
         * A GATT writeCharacteristic request is issued to a busy remote device.
         *
         * See: [BluetoothStatusCodes.ERROR_GATT_WRITE_REQUEST_BUSY]
         * https://developer.android.com/reference/kotlin/android/bluetooth/BluetoothStatusCodes#error_gatt_write_request_busy
         */
        WriteRequestBusy,

        /**
         * Error code indicating that the caller does not have the [BLUETOOTH_CONNECT] permission.
         *
         * See: [BluetoothStatusCodes.ERROR_MISSING_BLUETOOTH_CONNECT_PERMISSION]
         * https://developer.android.com/reference/kotlin/android/bluetooth/BluetoothStatusCodes#error_missing_bluetooth_connect_permission
         */
        MissingBluetoothConnectPermission,

        /**
         * Error code indicating that the profile service is not bound. You can bind a profile service
         * by calling [BluetoothAdapter.getProfileProxy].
         *
         * See: [BluetoothStatusCodes.ERROR_PROFILE_SERVICE_NOT_BOUND]
         * https://developer.android.com/reference/kotlin/android/bluetooth/BluetoothStatusCodes#error_profile_service_not_bound
         */
        ProfileServiceNotBound,

        /**
         * Indicates that an unknown error has occurred.
         *
         * See: [BluetoothStatusCodes.ERROR_UNKNOWN]
         * https://developer.android.com/reference/kotlin/android/bluetooth/BluetoothStatusCodes#error_unknown
         */
        Unknown,
    }

    /**
     * Get the type of the peripheral.
     *
     * Per [Making Android BLE work — part 1: Clearing the cache](https://medium.com/@martijn.van.welie/making-android-ble-work-part-1-a736dcd53b02#42d8),
     * when [type] is [Unknown][Type.Unknown], a scan should be performed before [connect].
     *
     * For apps targeting [R][Build.VERSION_CODES.R] or lower, [type] requires the
     * [BLUETOOTH][Manifest.permission.BLUETOOTH] permission which can be gained with a simple
     * `<uses-permission>` manifest tag.
     *
     * For apps targeting [S][Build.VERSION_CODES.S] or or higher, [type] requires the
     * [BLUETOOTH_CONNECT][Manifest.permission.BLUETOOTH_CONNECT] permission which can be gained
     * with `Activity.requestPermissions(String[], int)`.
     */
    @get:RequiresPermission(
        anyOf = ["android.permission.BLUETOOTH", "android.permission.BLUETOOTH_CONNECT"],
    )
    public val type: Type

    /**
     * Returns the hardware address of this [AndroidPeripheral].
     *
     * For example, "00:11:22:AA:BB:CC".
     */
    public val address: String

    public fun requestConnectionPriority(priority: Priority): Boolean

    /**
     * Requests that the current connection's MTU be changed. Suspends until the MTU changes, or failure occurs. The
     * negotiated MTU value is returned, which may not be [mtu] value requested if the remote peripheral negotiated an
     * alternate MTU.
     *
     * @throws NotConnectedException if invoked without an established [connection][Peripheral.connect].
     * @throws GattRequestRejectedException if Android was unable to fulfill the MTU change request.
     * @throws GattStatusException if MTU change request failed.
     */
    public suspend fun requestMtu(mtu: Int): Int

    /**
     * @see Peripheral.write
     * @throws NotConnectedException if invoked without an established [connection][connect].
     * @throws GattWriteException if underlying [BluetoothGatt] write operation call fails.
     */
    override suspend fun write(
        characteristic: Characteristic,
        data: ByteArray,
        writeType: WriteType,
    )

    /**
     * @see Peripheral.write
     * @throws NotConnectedException if invoked without an established [connection][connect].
     * @throws GattWriteException if underlying [BluetoothGatt] write operation call fails.
     */
    override suspend fun write(descriptor: Descriptor, data: ByteArray)

    /**
     * [StateFlow] of the most recently negotiated MTU. The MTU will change upon a successful request to change the MTU
     * (via [requestMtu]), or if the peripheral initiates an MTU change. [StateFlow]'s `value` will be `null` until MTU
     * is negotiated.
     */
    public val mtu: StateFlow<Int?>

    /**
     * This is an internal API and may be removed from a future release. If you are using it, please
     * open an issue and report your use case.
     */
    @InternalKableApi
    public val bluetoothDevice: BluetoothDevice
}

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/AndroidScanner.kt`
```
package com.juul.kable

@Deprecated(
    "Moved to PlatformScanner.",
    replaceWith = ReplaceWith("PlatformScanner"),
    level = DeprecationLevel.HIDDEN,
)
public typealias AndroidScanner = PlatformScanner

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/Bluetooth.kt`
```
package com.juul.kable

import android.bluetooth.BluetoothManager

@Deprecated(
    message = "`Bluetooth.availability` has inconsistent behavior across platforms. " +
        "Will be removed in a future release. " +
        "See https://github.com/JuulLabs/kable/issues/737 for more details.",
    level = DeprecationLevel.ERROR,
)
public actual enum class Reason {
    @Deprecated(
        message = "`Bluetooth.availability` has inconsistent behavior across platforms. " +
            "Will be removed in a future release. " +
            "See https://github.com/JuulLabs/kable/issues/737 for more details.",
        level = DeprecationLevel.ERROR,
    )
    Off, // BluetoothAdapter.STATE_OFF

    @Deprecated(
        message = "`Bluetooth.availability` has inconsistent behavior across platforms. " +
            "Will be removed in a future release. " +
            "See https://github.com/JuulLabs/kable/issues/737 for more details.",
        level = DeprecationLevel.ERROR,
    )
    TurningOff, // BluetoothAdapter.STATE_TURNING_OFF or BluetoothAdapter.STATE_BLE_TURNING_OFF

    @Deprecated(
        message = "`Bluetooth.availability` has inconsistent behavior across platforms. " +
            "Will be removed in a future release. " +
            "See https://github.com/JuulLabs/kable/issues/737 for more details.",
        level = DeprecationLevel.ERROR,
    )
    TurningOn, // BluetoothAdapter.STATE_TURNING_ON or BluetoothAdapter.STATE_BLE_TURNING_ON

    /**
     * [BluetoothManager] unavailable or [BluetoothManager.getAdapter] returned `null` (indicating
     * that Bluetooth is not available).
     */
    @Deprecated(
        message = "`Bluetooth.availability` has inconsistent behavior across platforms. " +
            "Will be removed in a future release. " +
            "See https://github.com/JuulLabs/kable/issues/737 for more details.",
        level = DeprecationLevel.ERROR,
    )
    AdapterNotAvailable,

    /** Only applicable on Android 11 (API 30) and lower. */
    @Deprecated(
        message = "`Bluetooth.availability` has inconsistent behavior across platforms. " +
            "Will be removed in a future release. " +
            "See https://github.com/JuulLabs/kable/issues/737 for more details.",
        level = DeprecationLevel.ERROR,
    )
    LocationServicesDisabled,
}

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/BluetoothAdapter.kt`
```
package com.juul.kable

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import androidx.core.content.ContextCompat

private fun getBluetoothManagerOrNull(): BluetoothManager? =
    ContextCompat.getSystemService(applicationContext, BluetoothManager::class.java)

/** @throws IllegalStateException If bluetooth is unavailable. */
private fun getBluetoothManager(): BluetoothManager =
    getBluetoothManagerOrNull() ?: error("BluetoothManager is not a supported system service")

/**
 * Per documentation, `BluetoothAdapter.getDefaultAdapter()` returns `null` when "Bluetooth is not
 * supported on this hardware platform".
 *
 * https://developer.android.com/reference/android/bluetooth/BluetoothAdapter#getDefaultAdapter()
 */
internal fun getBluetoothAdapterOrNull(): BluetoothAdapter? =
    getBluetoothManagerOrNull()?.adapter

/** @throws IllegalStateException If bluetooth is not supported. */
internal fun getBluetoothAdapter(): BluetoothAdapter =
    getBluetoothManager().adapter ?: error("Bluetooth not supported")

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/BluetoothDevice.kt`
```
package com.juul.kable

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothDevice.PHY_LE_1M_MASK
import android.bluetooth.BluetoothDevice.PHY_LE_2M_MASK
import android.bluetooth.BluetoothDevice.PHY_LE_CODED_MASK
import android.bluetooth.BluetoothDevice.TRANSPORT_AUTO
import android.bluetooth.BluetoothDevice.TRANSPORT_BREDR
import android.bluetooth.BluetoothDevice.TRANSPORT_LE
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi
import com.juul.kable.gatt.Callback
import com.juul.kable.logs.Logging
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.io.IOException
import kotlin.coroutines.CoroutineContext
import kotlin.time.Duration

/**
 * @param transport is only used on API level >= 23.
 * @param phy is only used on API level >= 26.
 */
internal fun BluetoothDevice.connect(
    coroutineContext: CoroutineContext,
    context: Context,
    autoConnect: Boolean,
    transport: Transport,
    phy: Phy,
    state: MutableStateFlow<State>,
    services: MutableStateFlow<List<PlatformDiscoveredService>?>,
    mtu: MutableStateFlow<Int?>,
    onCharacteristicChanged: MutableSharedFlow<ObservationEvent<ByteArray>>,
    logging: Logging,
    threadingStrategy: ThreadingStrategy,
    disconnectTimeout: Duration,
): Connection {
    val callback = Callback(state, mtu, onCharacteristicChanged, logging, address)
    val threading = threadingStrategy.acquire()

    val bluetoothGatt = try {
        when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O -> {
                val handler = (threading as Threading.Handler).handler
                connectGatt(context, autoConnect, callback, transport.intValue, phy.intValue, handler)
            }

            Build.VERSION.SDK_INT <= Build.VERSION_CODES.M && autoConnect ->
                connectGattWithReflection(context, true, callback, transport)
                    ?: connectGattCompat(context, true, callback, transport)

            else -> connectGattCompat(context, autoConnect, callback, transport)
        } ?: throw IOException("Binder remote-invocation error")
    } catch (e: SecurityException) {
        threading.release()
        throw IllegalStateException(e.message, e)
    } catch (t: Throwable) {
        threading.release()
        throw t
    }

    return Connection(coroutineContext, bluetoothGatt, threading, callback, services, disconnectTimeout, logging)
}

private fun BluetoothDevice.connectGattCompat(
    context: Context,
    autoConnect: Boolean,
    callback: BluetoothGattCallback,
    transport: Transport,
): BluetoothGatt? = when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> connectGatt(context, autoConnect, callback, transport.intValue)
    else -> connectGatt(context, autoConnect, callback)
}

internal val Transport.intValue: Int
    @RequiresApi(Build.VERSION_CODES.M)
    get() = when (this) {
        Transport.Auto -> TRANSPORT_AUTO
        Transport.BrEdr -> TRANSPORT_BREDR
        Transport.Le -> TRANSPORT_LE
    }

private val Phy.intValue: Int
    @RequiresApi(Build.VERSION_CODES.O)
    get() = when (this) {
        Phy.Le1M -> PHY_LE_1M_MASK
        Phy.Le2M -> PHY_LE_2M_MASK
        Phy.LeCoded -> PHY_LE_CODED_MASK
    }

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/BluetoothDeviceAndroidPeripheral.kt`
```
package com.juul.kable

import android.bluetooth.BluetoothAdapter.STATE_OFF
import android.bluetooth.BluetoothAdapter.STATE_TURNING_OFF
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothDevice.DEVICE_TYPE_CLASSIC
import android.bluetooth.BluetoothDevice.DEVICE_TYPE_DUAL
import android.bluetooth.BluetoothDevice.DEVICE_TYPE_LE
import android.bluetooth.BluetoothDevice.DEVICE_TYPE_UNKNOWN
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic.PROPERTY_INDICATE
import android.bluetooth.BluetoothGattCharacteristic.PROPERTY_NOTIFY
import android.bluetooth.BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
import android.bluetooth.BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
import android.bluetooth.BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
import android.bluetooth.BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
import android.bluetooth.BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
import com.juul.kable.AndroidPeripheral.Priority
import com.juul.kable.AndroidPeripheral.Type
import com.juul.kable.State.Disconnected
import com.juul.kable.WriteType.WithResponse
import com.juul.kable.WriteType.WithoutResponse
import com.juul.kable.bluetooth.checkBluetoothIsOn
import com.juul.kable.bluetooth.checkBluetoothIsSupported
import com.juul.kable.bluetooth.clientCharacteristicConfigUuid
import com.juul.kable.bluetooth.requireNonZeroAddress
import com.juul.kable.gatt.Response.OnCharacteristicRead
import com.juul.kable.gatt.Response.OnCharacteristicWrite
import com.juul.kable.gatt.Response.OnDescriptorRead
import com.juul.kable.gatt.Response.OnDescriptorWrite
import com.juul.kable.gatt.Response.OnReadRemoteRssi
import com.juul.kable.logs.Logger
import com.juul.kable.logs.Logging
import com.juul.kable.logs.Logging.DataProcessor.Operation
import com.juul.kable.logs.detail
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Duration

// Number of service discovery attempts to make if no services are discovered.
// https://github.com/JuulLabs/kable/issues/295
private const val DISCOVER_SERVICES_RETRIES = 5

private const val DEFAULT_ATT_MTU = 23
private const val ATT_MTU_HEADER_SIZE = 3

internal class BluetoothDeviceAndroidPeripheral(
    @InternalKableApi override val bluetoothDevice: BluetoothDevice,
    private val autoConnectPredicate: () -> Boolean,
    private val transport: Transport,
    private val phy: Phy,
    private val threadingStrategy: ThreadingStrategy,
    observationExceptionHandler: ObservationExceptionHandler,
    private val onServicesDiscovered: ServicesDiscoveredAction,
    private val logging: Logging,
    private val disconnectTimeout: Duration,
) : BasePeripheral(bluetoothDevice.toString()), AndroidPeripheral {

    init {
        onBluetoothDisabled { state ->
            logger.debug {
                message = "Bluetooth disabled"
                detail("state", state)
            }
            disconnect()
        }
    }

    private val connectAction = scope.sharedRepeatableAction(::establishConnection)

    override val identifier: String = bluetoothDevice.address
    private val logger = Logger(logging, "Kable/Peripheral", bluetoothDevice.toString())

    private val _state = MutableStateFlow<State>(Disconnected())
    override val state = _state.asStateFlow()

    private val _services = MutableStateFlow<List<PlatformDiscoveredService>?>(null)
    override val services = _services.asStateFlow()
    private fun servicesOrThrow() = services.value ?: error("Services have not been discovered")

    private val _mtu = MutableStateFlow<Int?>(null)
    override val mtu = _mtu.asStateFlow()

    private val observers = Observers<ByteArray>(this, logging, false, observationExceptionHandler)

    private val connection = MutableStateFlow<Connection?>(null)
    private fun connectionOrThrow() =
        connection.value
            ?: throw NotConnectedException("Connection not established, current state: ${state.value}")

    override val type: Type
        get() = typeFrom(bluetoothDevice.type)

    override val address: String = requireNonZeroAddress(bluetoothDevice.address)

    @ExperimentalKableApi
    override val name: String?
        get() = bluetoothDevice.name

    private suspend fun establishConnection(scope: CoroutineScope): CoroutineScope {
        checkBluetoothIsSupported()
        checkBluetoothIsOn()

        logger.info { message = "Connecting" }
        _state.value = State.Connecting.Bluetooth

        try {
            connection.value = bluetoothDevice.connect(
                scope.coroutineContext,
                applicationContext,
                autoConnectPredicate(),
                transport,
                phy,
                _state,
                _services,
                _mtu,
                observers.characteristicChanges,
                logging,
                threadingStrategy,
                disconnectTimeout,
            )

            suspendUntil<State.Connecting.Services>()
            discoverServices()
            configureCharacteristicObservations()
        } catch (e: Exception) {
            val failure = e.unwrapCancellationException()
            logger.error(failure) { message = "Failed to establish connection" }
            throw failure
        }

        val connectionScope = connectionOrThrow().taskScope
        logger.info { message = "Connected" }
        _state.value = State.Connected(connectionScope)

        return connectionScope
    }

    private suspend fun configureCharacteristicObservations() {
        logger.verbose { message = "Configuring characteristic observations" }
        _state.value = State.Connecting.Observes
        observers.onConnected()
    }

    override suspend fun connect(): CoroutineScope =
        connectAction.awaitConnect()

    override suspend fun disconnect() {
        connectAction.cancelAndJoin(
            CancellationException(NotConnectedException("Disconnect requested")),
        )
    }

    override fun requestConnectionPriority(priority: Priority): Boolean {
        logger.debug {
            message = "requestConnectionPriority"
            detail("priority", priority.name)
        }
        return connectionOrThrow()
            .gatt
            .requestConnectionPriority(priority.intValue)
    }

    override suspend fun maximumWriteValueLengthForType(writeType: WriteType): Int =
        (mtu.value ?: DEFAULT_ATT_MTU) - ATT_MTU_HEADER_SIZE

    @ExperimentalKableApi // Experimental until Web Bluetooth advertisements APIs are stable.
    override suspend fun rssi(): Int =
        connectionOrThrow().execute<OnReadRemoteRssi> {
            readRemoteRssiOrThrow()
        }.rssi

    private suspend fun discoverServices() {
        connectionOrThrow().discoverServices(retries = DISCOVER_SERVICES_RETRIES)
        unwrapCancellationExceptions {
            onServicesDiscovered(ServicesDiscoveredPeripheral(this))
        }
    }

    override suspend fun requestMtu(mtu: Int): Int {
        logger.debug {
            message = "requestMtu"
            detail("mtu", mtu)
        }
        return connectionOrThrow().requestMtu(mtu)
    }

    override suspend fun write(
        characteristic: Characteristic,
        data: ByteArray,
        writeType: WriteType,
    ) {
        logger.debug {
            message = "write"
            detail(characteristic)
            detail(writeType)
            detail(data, Operation.Write)
        }

        val platformCharacteristic = servicesOrThrow().obtain(characteristic, writeType.properties)
        connectionOrThrow().execute<OnCharacteristicWrite> {
            writeCharacteristicOrThrow(platformCharacteristic, data, writeType.intValue)
        }
    }

    override suspend fun read(
        characteristic: Characteristic,
    ): ByteArray {
        logger.debug {
            message = "read"
            detail(characteristic)
        }

        val platformCharacteristic = servicesOrThrow().obtain(characteristic, Read)
        return connectionOrThrow().execute<OnCharacteristicRead> {
            readCharacteristicOrThrow(platformCharacteristic)
        }.value!!
    }

    override suspend fun write(
        descriptor: Descriptor,
        data: ByteArray,
    ) {
        write(servicesOrThrow().obtain(descriptor), data)
    }

    private suspend fun write(
        platformDescriptor: PlatformDescriptor,
        data: ByteArray,
    ) {
        logger.debug {
            message = "write"
            detail(platformDescriptor)
            detail(data, Operation.Write)
        }

        connectionOrThrow().execute<OnDescriptorWrite> {
            writeDescriptorOrThrow(platformDescriptor, data)
        }
    }

    override suspend fun read(
        descriptor: Descriptor,
    ): ByteArray {
        logger.debug {
            message = "read"
            detail(descriptor)
        }

        val platformDescriptor = servicesOrThrow().obtain(descriptor)
        return connectionOrThrow().execute<OnDescriptorRead> {
            readDescriptorOrThrow(platformDescriptor)
        }.value!!
    }

    override fun observe(
        characteristic: Characteristic,
        onSubscription: OnSubscriptionAction,
    ): Flow<ByteArray> = observers.acquire(characteristic, onSubscription)

    internal suspend fun startObservation(characteristic: Characteristic) {
        logger.debug {
            message = "Starting observation"
            detail(characteristic)
        }

        val platformCharacteristic = servicesOrThrow().obtain(characteristic, Notify or Indicate)

        logger.verbose {
            message = "setCharacteristicNotification"
      
```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/BluetoothGatt.kt`
```
package com.juul.kable

import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothStatusCodes.ERROR_GATT_WRITE_NOT_ALLOWED
import android.bluetooth.BluetoothStatusCodes.ERROR_GATT_WRITE_REQUEST_BUSY
import android.bluetooth.BluetoothStatusCodes.ERROR_MISSING_BLUETOOTH_CONNECT_PERMISSION
import android.bluetooth.BluetoothStatusCodes.ERROR_PROFILE_SERVICE_NOT_BOUND
import android.bluetooth.BluetoothStatusCodes.SUCCESS
import android.os.Build
import com.juul.kable.AndroidPeripheral.WriteResult

internal fun BluetoothGatt.discoverServicesOrThrow() {
    if (!discoverServices()) {
        throw GattRequestRejectedException()
    }
}

internal fun BluetoothGatt.setCharacteristicNotificationOrThrow(
    characteristic: PlatformCharacteristic,
    enable: Boolean,
) {
    if (!setCharacteristicNotification(characteristic, enable)) {
        throw GattRequestRejectedException()
    }
}

internal fun BluetoothGatt.readCharacteristicOrThrow(
    characteristic: PlatformCharacteristic,
) {
    if (!readCharacteristic(characteristic)) {
        throw GattRequestRejectedException()
    }
}

internal fun BluetoothGatt.readDescriptorOrThrow(
    descriptor: PlatformDescriptor,
) {
    if (!readDescriptor(descriptor)) {
        throw GattRequestRejectedException()
    }
}

internal fun BluetoothGatt.readRemoteRssiOrThrow() {
    if (!readRemoteRssi()) {
        throw GattRequestRejectedException()
    }
}

@Suppress("DEPRECATION")
internal fun BluetoothGatt.writeCharacteristicOrThrow(
    characteristic: PlatformCharacteristic,
    data: ByteArray,
    writeType: Int,
) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val result = writeCharacteristic(characteristic, data, writeType)
        if (result != SUCCESS) {
            throw GattWriteException(writeResultFrom(result))
        }
    } else {
        characteristic.value = data
        characteristic.writeType = writeType
        if (!writeCharacteristic(characteristic)) {
            throw GattWriteException(WriteResult.Unknown)
        }
    }
}

@Suppress("DEPRECATION")
internal fun BluetoothGatt.writeDescriptorOrThrow(
    descriptor: PlatformDescriptor,
    data: ByteArray,
) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val result = writeDescriptor(descriptor, data)
        if (result != SUCCESS) {
            throw GattWriteException(writeResultFrom(result))
        }
    } else {
        descriptor.value = data
        if (!writeDescriptor(descriptor)) {
            throw GattRequestRejectedException()
        }
    }
}

/**
 * Possible return value of [BluetoothGatt.writeCharacteristic] or [BluetoothGatt.writeDescriptor],
 * yet marked as `@hide` in Android source:
 * https://cs.android.com/android/platform/superproject/main/+/b7a389a145ff443550e1a942bf713c60c2bd6a14:packages/modules/Bluetooth/framework/java/android/bluetooth/BluetoothStatusCodes.java;l=45-50
 */
private const val ERROR_DEVICE_NOT_CONNECTED = 4

private fun writeResultFrom(value: Int): WriteResult = when (value) {
    ERROR_DEVICE_NOT_CONNECTED -> WriteResult.NotConnected
    ERROR_GATT_WRITE_NOT_ALLOWED -> WriteResult.WriteNotAllowed
    ERROR_GATT_WRITE_REQUEST_BUSY -> WriteResult.WriteRequestBusy
    ERROR_MISSING_BLUETOOTH_CONNECT_PERMISSION -> WriteResult.MissingBluetoothConnectPermission
    ERROR_PROFILE_SERVICE_NOT_BOUND -> WriteResult.ProfileServiceNotBound
    else -> WriteResult.Unknown
}

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/BluetoothLeScannerAndroidScanner.kt`
```
package com.juul.kable

import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.os.Build.VERSION.SDK_INT
import android.os.Build.VERSION_CODES.VANILLA_ICE_CREAM
import android.os.ParcelUuid
import com.juul.kable.Filter.Address
import com.juul.kable.Filter.ManufacturerData
import com.juul.kable.Filter.Name
import com.juul.kable.Filter.Service
import com.juul.kable.Filter.ServiceData
import com.juul.kable.bluetooth.checkBluetoothIsOn
import com.juul.kable.logs.Logger
import com.juul.kable.logs.Logging
import com.juul.kable.scan.ScanError
import com.juul.kable.scan.message
import com.juul.kable.scan.requirements.checkLocationServicesEnabled
import com.juul.kable.scan.requirements.checkScanPermissions
import com.juul.kable.scan.requirements.requireBluetoothLeScanner
import kotlinx.coroutines.channels.BufferOverflow.DROP_OLDEST
import kotlinx.coroutines.channels.Channel.Factory.UNLIMITED
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.onFailure
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.filter
import kotlin.reflect.KClass
import kotlin.uuid.toJavaUuid
import kotlin.uuid.toKotlinUuid

internal data class ScanFilters(

    /** [ScanFilter]s applied using Android's native filtering. */
    val native: List<ScanFilter>,

    /** [FilterPredicate]s applied via flow [filter][Flow.filter] operator. */
    val flow: List<FilterPredicate>,
)

internal class BluetoothLeScannerAndroidScanner(
    filters: List<FilterPredicate>,
    private val scanSettings: ScanSettings,
    private val bufferCapacity: Int,
    logging: Logging,
) : PlatformScanner {

    private val logger = Logger(logging, tag = "Kable/Scanner", identifier = null)

    private val scanFilters = filters.toScanFilters()

    override val advertisements: Flow<PlatformAdvertisement> = callbackFlow {
        logger.debug { message = "Initializing scan" }
        val scanner = requireBluetoothLeScanner()

        // Permissions are checked early (fail-fast), as they cannot be unexpectedly revoked prior
        // to scanning (revoking permissions on Android restarts the app).
        logger.verbose { message = "Checking permissions for scanning" }
        checkScanPermissions()

        fun sendResult(scanResult: ScanResult) {
            val advertisement = ScanResultAndroidAdvertisement(scanResult)
            // `trySend` is used (rather than `trySendBlocking`) because scan callbacks are invoked
            // from a binder thread (on some phones, the main thread), where blocking can trigger an
            // ANR. See https://github.com/JuulLabs/kable/issues/654 for more details.
            trySend(advertisement).onFailure {
                logger.warn { message = "Unable to deliver scan result due to failure in flow or premature closing." }
            }
        }

        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                sendResult(result)
            }

            override fun onBatchScanResults(results: MutableList<ScanResult>) {
                // for-each loop to avoid accidental use of java.lang.Iterable.forEach which
                // requires API 24.
                for (result in results) {
                    sendResult(result)
                }
            }

            override fun onScanFailed(errorCode: Int) {
                val scanError = ScanError(errorCode)
                logger.error {
                    detail("code", scanError.toString())
                    message = "Scan could not be started"
                }
                close(IllegalStateException(scanError.message))
            }
        }

        // These conditions could change prior to scanning, so we check them as close to
        // initiating the scan as feasible.
        logger.verbose { message = "Checking scanning requirements" }
        checkLocationServicesEnabled()
        checkBluetoothIsOn()

        logger.info {
            message = logMessage("Starting", bufferCapacity, scanFilters)
        }
        scanner.startScan(scanFilters.native, scanSettings, callback)

        awaitClose {
            logger.info {
                message = logMessage("Stopping", bufferCapacity, scanFilters)
            }
            // Can't check BLE state here, only Bluetooth, but should assume `IllegalStateException`
            // means BLE has been disabled.
            try {
                scanner.stopScan(callback)
            } catch (e: IllegalStateException) {
                logger.warn(e) { message = "Failed to stop scan. " }
            }
        }
    }.buffer(
        // Must stay adjacent to the `callbackFlow` (i.e. ahead of `filter`) to fuse into its
        // channel. Applied after an intervening operator it creates a second channel instead,
        // leaving the callback channel at the default capacity, where `trySend` drops again.
        capacity = bufferCapacity,
        onBufferOverflow = DROP_OLDEST,
    ).filter { advertisement ->
        if (scanFilters.flow.isEmpty()) {
            true
        } else {
            scanFilters.flow.matches(
                services = advertisement.uuids,
                name = advertisement.name,
                address = advertisement.address,
                manufacturerData = advertisement.manufacturerData,
                serviceData = advertisement.serviceData?.mapKeys { (key) -> key.uuid.toKotlinUuid() },
            )
        }
    }
}

private fun logMessage(
    prefix: String,
    bufferCapacity: Int,
    scanFilters: ScanFilters,
) = buildString {
    append(prefix)
    append(' ')
    append("scan ")
    if (bufferCapacity != UNLIMITED) {
        append("buffering up to ")
        append(bufferCapacity)
        append(" advertisement(s) ")
    }
    if (scanFilters.native.isEmpty() && scanFilters.flow.isEmpty()) {
        append("without filters")
    } else {
        append("with ${scanFilters.native.count()} native and ${scanFilters.flow.count()} flow filter(s)")
    }
}

internal fun List<FilterPredicate>.toScanFilters(): ScanFilters =
    if (all(FilterPredicate::supportsNativeScanFiltering)) {
        ScanFilters(
            native = map(FilterPredicate::toNativeScanFilter),
            flow = emptyList(),
        )
    } else if (count() == 1) {
        val nativeFilters = mutableMapOf<KClass<*>, Filter>()
        val flowFilters = mutableListOf<Filter>()
        // for-each loop to avoid accidental use of java.lang.Iterable.forEach which requires API 24.
        for (filter in single().filters) {
            if (filter.canFilterNatively && filter::class !in nativeFilters) {
                nativeFilters[filter::class] = filter
            } else {
                flowFilters += filter
            }
        }
        ScanFilters(
            native = listOf(nativeFilters.values.toList().toNativeScanFilter()),
            flow = listOf(FilterPredicate(flowFilters)),
        )
    } else {
        ScanFilters(
            native = emptyList(),
            flow = this,
        )
    }

// Android's `ScanFilter` does not support name prefix filtering, and only allows at most one of each filter type.
private val FilterPredicate.supportsNativeScanFiltering: Boolean
    get() {
        var service = 0
        var nameExact = 0
        var address = 0
        var manufacturerData = 0
        var serviceData = 0
        // for-each loop to avoid accidental use of java.lang.Iterable.forEach which requires API 24.
        for (filter in filters) {
            when (filter) {
                is Service -> if (++service > 1) return false
                is Name.Exact -> if (++nameExact > 1) return false
                is Name.Prefix -> return false
                is Address -> if (++address > 1) return false
                is ManufacturerData -> if (++manufacturerData > 1) return false
                is ServiceData -> if (++serviceData > 1) return false
            }
        }
        return true
    }

private val Filter.canFilterNatively: Boolean
    get() = when (this) {
        is Service -> true
        is Name.Exact -> true
        is Address -> true
        is ManufacturerData -> true
        is ServiceData -> true
        else -> false
    }

private fun FilterPredicate.toNativeScanFilter(): ScanFilter = filters.toNativeScanFilter()

private fun List<Filter>.toNativeScanFilter(): ScanFilter =
    ScanFilter.Builder().apply {
        onEach { filter ->
            when (filter) {
                is Service -> setServiceUuid(ParcelUuid(filter.uuid.toJavaUuid()))
                is Name.Exact -> setDeviceName(filter.exact)
                is Address -> setDeviceAddress(filter.address)
                is ManufacturerData -> setManufacturerData(filter.id, filterDataCompat(filter.data), filter.dataMask)
                is ServiceData -> setServiceData(ParcelUuid(filter.uuid.toJavaUuid()), filterDataCompat(filter.data), filter.dataMask)
                else -> throw AssertionError("Unsupported filter element")
            }
        }
    }.build()

// Android doesn't properly check for nullness of manufacturer or service data until Android 16.
// See https://github.com/JuulLabs/kable/issues/854 for more details.
private fun filterDataCompat(data: ByteArray?): ByteArray? =
    if (data == null && SDK_INT <= VANILLA_ICE_CREAM) byteArrayOf() else data

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/BluetoothState.kt`
```
package com.juul.kable

import android.bluetooth.BluetoothAdapter.ACTION_STATE_CHANGED
import android.bluetooth.BluetoothAdapter.ERROR
import android.bluetooth.BluetoothAdapter.EXTRA_STATE
import android.content.IntentFilter
import com.juul.tuulbox.coroutines.flow.broadcastReceiverFlow
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.flow.SharingStarted.Companion.WhileSubscribed
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.shareIn

private val intentFilter = IntentFilter(ACTION_STATE_CHANGED)

@OptIn(DelicateCoroutinesApi::class)
internal val bluetoothState = broadcastReceiverFlow(intentFilter)
    .map { intent -> intent.getIntExtra(EXTRA_STATE, ERROR) }
    .shareIn(GlobalScope, started = WhileSubscribed(replayExpirationMillis = 0))

```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/Connection.kt`
```
package com.juul.kable

import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGatt.GATT_SUCCESS
import android.os.Handler
import com.juul.kable.State.Disconnected
import com.juul.kable.android.GattStatus
import com.juul.kable.coroutines.childSupervisor
import com.juul.kable.gatt.Callback
import com.juul.kable.gatt.Response
import com.juul.kable.gatt.Response.OnServicesDiscovered
import com.juul.kable.logs.Logger
import com.juul.kable.logs.Logging
import kotlinx.coroutines.CompletableJob
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart.ATOMIC
import kotlinx.coroutines.CoroutineStart.UNDISPATCHED
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.cancellation.CancellationException
import kotlin.reflect.KClass
import kotlin.time.Duration
import kotlin.time.Duration.Companion.ZERO

private val GattSuccess = GattStatus(GATT_SUCCESS)

/**
 * Represents a Bluetooth Low Energy connection. [Connection] should be initialized with the
 * provided [BluetoothGatt] in a connecting or connected state. When a disconnect occurs (either by
 * invoking [disconnect], or peripheral initiated disconnect), this [Connection] will be
 * [disposed][close] (and cannot be re-used).
 *
 * To disconnect: simply call [disconnect] ([Connection] will be implicitly [closed][close] at the
 * end of the [disconnect] sequence).
 *
 * If [connectionScope], or parent [CoroutineContext] is canceled prior to
 * [disconnecting][disconnect], then [Connection] will be abruptly [closed][close] (upon completion
 * of [job]) without a prior [disconnect] sequence.
 */
internal class Connection(
    parentContext: CoroutineContext,
    internal val gatt: BluetoothGatt,
    private val threading: Threading,
    private val callback: Callback,
    private val services: MutableStateFlow<List<PlatformDiscoveredService>?>,
    private val disconnectTimeout: Duration,
    logging: Logging,
) {

    private val name = "Kable/Connection/${gatt.device}"

    private val connectionJob = (parentContext.job as CompletableJob).apply {
        invokeOnCompletion(::close)
    }
    private val connectionScope = CoroutineScope(
        parentContext + connectionJob + CoroutineName(name),
    )

    val taskScope = connectionScope.childSupervisor("$name/Tasks")

    private val logger =
        Logger(logging, tag = "Kable/Connection", identifier = gatt.device.toString())

    init {
        // todo: Move this `require` to the PeripheralBuilder.
        require(disconnectTimeout > ZERO) { "Disconnect timeout must be >0, was $disconnectTimeout" }

        onDispose(::disconnect)
        onServiceChanged(::discoverServices)

        on<Disconnected> {
            val state = it.toString()
            logger.debug {
                message = "Disconnect detected"
                detail("state", state)
            }
            dispose(NotConnectedException("Disconnect detected"))
        }
    }

    private val dispatcher = connectionScope.coroutineContext + threading.dispatcher
    private val guard = Mutex()

    suspend fun discoverServices(retries: Int = 1) {
        logger.verbose { message = "Discovering services" }

        repeat(retries) { attempt ->
            val discoveredServices = execute<OnServicesDiscovered> {
                discoverServicesOrThrow()
            }.services.map(::PlatformDiscoveredService)

            if (discoveredServices.isEmpty()) {
                logger.warn {
                    message = "Empty services"
                    detail("attempt", "${attempt + 1} of $retries")
                }
            } else {
                logger.verbose { message = "Discovered ${discoveredServices.count()} services" }
                services.value = discoveredServices
                return
            }
        }
        services.value = emptyList()
    }

    /**
     * Executes specified [BluetoothGatt] [action].
     *
     * Android Bluetooth Low Energy has strict requirements: all I/O must be executed sequentially.
     * In other words, the response for an [action] must be received before another [action] can be
     * performed. Additionally, the Android BLE stack can become unstable if I/O isn't performed on
     * a dedicated thread.
     *
     * These requirements are fulfilled by ensuring that all [action]s are performed behind a
     * [Mutex]. On Android pre-O a single threaded [CoroutineDispatcher] is used, Android O and
     * newer a [CoroutineDispatcher] backed by an Android [Handler] is used (and is also used in the
     * Android BLE [Callback]).
     *
     * @throws GattStatusException If response has a non-`GATT_SUCCESS` status.
     * @throws NotConnectedException If connection has been closed.
     */
    suspend inline fun <reified T : Response> execute(
        noinline action: BluetoothGatt.() -> Unit,
    ): T = execute(T::class, action)

    suspend fun <T : Response> execute(
        type: KClass<T>,
        action: BluetoothGatt.() -> Unit,
    ): T {
        val response = guard.withLock {
            var executed = false
            try {
                withContext(dispatcher) {
                    gatt.action()
                    executed = true
                }
            } catch (e: CancellationException) {
                if (executed) {
                    // Ensure response buffer is received even when calling context is cancelled.
                    // UNDISPATCHED to ensure we're within the `lock` for the `receive`.
                    connectionScope.launch(start = UNDISPATCHED) {
                        val response = callback.onResponse.receive()
                        logger.debug {
                            message = "Discarded response to cancelled request"
                            detail("response", response.toString())
                        }
                    }
                }
                currentCoroutineContext().ensureActive()
                throw e.unwrapCancellationException()
            }

            try {
                connectionScope.async {
                    callback.onResponse.receive()
                }.await()
            } catch (e: CancellationException) {
                currentCoroutineContext().ensureActive()
                throw e.unwrapCancellationException()
            }
        }.also(::checkResponse)

        // `guard` should always enforce a 1:1 matching of request-to-response, but if an Android
        // `BluetoothGattCallback` method is called out-of-order then we'll cast to the wrong type.
        return response as? T
            ?: throw InternalError(
                "Expected response type ${type.simpleName} but received ${response::class.simpleName}",
            )
    }

    /**
     * Mimics [execute] in order to uphold the same sequential execution behavior, while having a
     * dedicated channel for receiving MTU change events.
     *
     * See https://github.com/JuulLabs/kable/issues/86 for more details.
     *
     * @throws GattRequestRejectedException if underlying `BluetoothGatt` method call returns `false`.
     * @throws GattStatusException if response has a non-`GATT_SUCCESS` status.
     */
    suspend fun requestMtu(mtu: Int): Int = guard.withLock {
        try {
            withContext(dispatcher) {
                if (!gatt.requestMtu(mtu)) throw GattRequestRejectedException()
            }
            connectionScope.async { callback.onMtuChanged.receive() }.await()
        } catch (e: CancellationException) {
            currentCoroutineContext().ensureActive()
            throw e.unwrapCancellationException()
        }
    }.also(::checkResponse).mtu

    private suspend fun disconnect() {
        if (callback.state.value is Disconnected) return

        withContext(NonCancellable) {
            try {
                withTimeout(disconnectTimeout) {
                    logger.verbose { message = "Waiting for connection tasks to complete" }
                    taskScope.coroutineContext.job.join()

                    logger.debug { message = "Disconnecting" }
                    gatt.disconnect()

                    callback.state.filterIsInstance<Disconnected>().first()
                }
                logger.info { message = "Disconnected" }
            } catch (e: TimeoutCancellationException) {
                logger.warn { message = "Timed out after $disconnectTimeout waiting for disconnect" }
            }
        }
    }

    private fun close(cause: Throwable?) {
        logger.debug(cause) { message = "Closing" }
        gatt.close()
        setDisconnected()
        threading.release()
        logger.info { message = "Closed" }
    }

    private fun setDisconnected() {
        // Avoid trampling existing `Disconnected` state (and its properties) by only updating if
        // not already `Disconnected`.
        callback.state.update { previous -> previous as? Disconnected ?: Disconnected() }
    }

    private inline fun <reified T : State> on(crossinline action: suspend (T) -> Unit) {
        taskScope.launch {
            action(callback.state.filterIsInstance<T>().first())
        }
    }

 
```

### Core Architecture Module: `kable-core/src/androidMain/kotlin/Exceptions.kt`
```
package com.juul.kable

import android.bluetooth.BluetoothGatt
import com.juul.kable.AndroidPeripheral.WriteResult

/**
 * Thrown when underlying [BluetoothGatt] write operation call fails.
 *
 * The reason for the failure is available via the [result] property on Android 13 (API 33) and
 * newer.
 *
 * On Android prior to API 33, [result] is always [Unknown][WriteResult.Unknown], but the failure
 * may have been due to any of the conditions listed for [GattRequestRejectedException].
 */
public class GattWriteException internal constructor(
    public val result: WriteResult,
) : GattRequestRejectedException("Write failed: $result")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1166** (2026-07-02): **Android: Missing android.permission.BLUETOOTH_CONNECT bubbles up as java.lang.SecurityException**
  *Symptoms*: **Context** Library version: 0.43.1 compileSdk: 36 The Android app has the BLUETOOTH_SCAN permission but is missing the BLUETOOTH_CONNECT permission.  **Problem** When I call connect() on the Peripheral and do not have the BLUETOOTH_CONNECT permission, then a java.lang.SecurityException gets thrown instead of the expected IllegalStateException like when BLUETOOTH_SCAN permission is missing. This makes catching (and mapping) the thrown Exception harder as java.lang.SecurityException does not exist in shared KMP code.  The above case happens when the Android app already has the BLUETOOTH_SCAN permission but not the BLUETOOTH_CONNECT permission.  **Expectation** The thrown java.lang.SecurityException (when the BLUETOOTH_CONNECT permission is missing) gets wrapped in a kotlin.IllegalStateException
  **Post-Mortem & Fix Analysis**:
  > I’m working on this. I plan to translate the Android `SecurityException` thrown by `connectGatt()` into Kable’s common `IllegalStateException` contract while preserving the original cause, and add a focused Android host test for the behavior.

- **Issue #1136** (2026-05-04): **IllegalStateException when I cancel a Peripheral.connect() call**
  *Symptoms*: If our app is part-way through connecting a Peripheral and someone exits the screen, we cancel the coroutine scope of the connect task. But inside Kable's connect call, it has a try-catch for `IllegalStateException` and rethrows its own `IllegalStateException: Cannot connect peripheral that has been cancelled `:  https://github.com/JuulLabs/kable/blob/368d4d5b16ae7ed46c89fac331b0788183a94ed7/kable-core/src/commonMain/kotlin/SharedRepeatableAction.awaitConnect.kt#L5-L10  But `CancellationException` inherits from `IllegalStateException`, so any time you cancel the connect call, it (seemingly unintentionally) catches that cancellation and turns it into `IllegalStateException`, causing our app to crash from that unexpected exception. Am I correct in thinking this is a bug?  I'm working around it with this:  ```kotlin try {     connect() } catch (e: IllegalStateException) {     // Work around Kable seemingly accidentally catching CancellationException and throwing     // an IllegalStateException. This call throws CancellationException if we're cancelled.     currentCoroutineContext().ensureActive()      throw e } ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! That certainly does seem incorrect. I'll try to find time to look into it.
  > Thank you!
  > FYI I was also having the same problem with `TimeoutCancellationException` (it was also being swallowed). 0.43.0 fixes this too.

- **Issue #989** (2025-12-08): **Services remain empty with jvm linux target**
  *Symptoms*: After connecting to a BLE device using the new Kable JVM target on Linux, the services list in the peripheral remains empty. This happens even after the service discovery step completes.  ### Tested with - SensorTag example - Custom implementation using the new JVM target     ### Environment OS: Linux Kable: 0.39.2 target: jvm  The same behavior occurs across multiple devices. This suggests the issue is not specific to the peripheral or the custom implementation. Also this doesn't happen for android for example.  ``` > Task :app:run [I/Kable/Scanner]: Starting scan [V/Kable/Scanner]: Removing scan listener [I/SensorScreenModel] Waiting 1s to reconnect... [I/SensorTag] Connecting [I/Kable/Peripheral]: {"object_path":"/org/bluez/hci1/dev_XX_XX_XX_XX_XX"} Connecting [I/Kable/Peripheral]: {"object_path":"/org/bluez/hci1/dev_XX_XX_XX_XX_XX"} Discovering services [V/Kable/Peripheral]: {"object_path":"/org/bluez/hci1/dev_XX_XX_XX_XX_XX"} Configuring characteristic observations ========================= services: [] <--- Here is a print of the peripheral.services [I/Kable/Peripheral]: {"object_path":"/org/bluez/hci1/dev_XX_XX_XX_XX_XX"} Start observation   service: 0000180f-0000-1000-8000-00805f9b34fb   characteristic: 00002a19-0000-1000-8000-00805f9b34fb [V/Kable/Peripheral]: {"object_path":"/org/bluez/hci1/dev_XX_XX_XX_XX_XX"} Reading from LazyCharacteristic(serviceUuid=0000180f-0000-1000-8000-00805f9b34fb, characteristicUuid=00002a19-0000-1000-8000-00805f9b34fb) [D/SensorTag] RSSI
  **Post-Mortem & Fix Analysis**:
  > Yikes. Linux was a platform I didn't have conveniently available when doing the initial dev work on this -- I'll try to get a machine spun up ASAP to investigate.
  > Are there any updates regarding this issue?
  > > Are there any updates regarding this issue?  @UntriexTv fixed by me in https://github.com/JuulLabs/kable/pull/1079

- **Issue #969** (2025-07-25): **Kable JVM does not honor disconnect request**
  *Symptoms*: When the SensorTag is advertising and awaiting a connection, the status LED continually flashes. Upon connecting, the LED turns off. Usually, when disconnecting, the LED will start flashing again, but when clicking back button in SensorTag sample (while on the sensor screen), it will navigate back to the scan screen but the connection will remain active (LED remains off):  ``` > Task :app:run [I/Kable/Scanner]: Starting scan [V/Kable/Scanner]: Removing scan listener [I/SensorScreenModel] Waiting 1s to reconnect... [I/SensorTag] Connecting [I/Kable/Peripheral]: 9aa9baff-15d8-8c26-4561-01694c8637e6 Connecting [I/Kable/Peripheral]: 9aa9baff-15d8-8c26-4561-01694c8637e6 Discovering services [V/Kable/Peripheral]: 9aa9baff-15d8-8c26-4561-01694c8637e6 Configuring characteristic observations [I/Kable/Peripheral]: 9aa9baff-15d8-8c26-4561-01694c8637e6 Start observation   service: 0000180f-0000-1000-8000-00805f9b34fb   characteristic: 00002a19-0000-1000-8000-00805f9b34fb [V/Kable/Peripheral]: 9aa9baff-15d8-8c26-4561-01694c8637e6 Reading from LazyCharacteristic(serviceUuid=0000180f-0000-1000-8000-00805f9b34fb, characteristicUuid=00002a19-0000-1000-8000-00805f9b34fb) [D/SensorTag] RSSI: -47 [V/Kable/Peripheral]: 9aa9baff-15d8-8c26-4561-01694c8637e6 Reading from LazyCharacteristic(serviceUuid=f000aa80-0451-4000-b000-000000000000, characteristicUuid=f000aa83-0451-4000-b000-000000000000) [I/SensorTag] Enabling gyro [V/Kable/Peripheral]: 9aa9baff-15d8-8c26-4561-01694c8637e6 Writing to LazyChar

- **Issue #959** (2025-08-05): **Inconsistent connection state when bluetooth is turned off**
  *Symptoms*: Hello, I considered opening an issue for this, but I'm not sure if I'm using the library wrong. So I opened a discussion instead.  My question is : On iOS, given a peripheral with an active connection, should turning off the Bluetooth radio result in the `peripheral.state` flow emitting a `Disconnected` state?  In my app I never see this. On Android it works a 100% of the time but on iOS I see the following sequence of events in the Kable logs. Disconnection always times out after 5 seconds; and the `Disconnected` state is never emitted. Since things work as expected on Android, I'm assuming this might be something I'm doing wrong.  ``` I/Kable: <SOME-UUID> Bluetooth powered off   state: 4 V/Kable/Connection: <SOME-UUID> Waiting for connection tasks to complete D/Kable/Connection: <SOME-UUID> Disconnecting V/Kable/Connection: <SOME-UUID> cancelPeripheralConnection API MISUSE: <CBCentralManager: 0x30259c000> can only accept this command while in the powered on state W/Kable/Connection: <SOME-UUID> Timed out after 5s waiting for disconnect D/Kable/Connection: <SOME-UUID> Closing kotlin.coroutines.cancellation.CancellationException: com.juul.kable.NotConnectedException: Disconnect requested     at 0   MyAppName.debug.dylib      0x105570eeb        kfun:kotlin.Throwable#<init>(kotlin.Throwable?){} + 243      at 1   MyAppName.debug.dylib      0x10556b0a7        kfun:kotlin.Exception#<init>(kotlin.Throwable?){} + 95      at 2   MyAppName.debug.dylib      0x10556b27
  **Post-Mortem & Fix Analysis**:
  > @curioustechizen were you only seeing this issue when disabling bluetooth from the control center (and not when disabling from settings)?  I'm wondering if Kable needs to account for the iOS bug similar to how it was handled here: https://github.com/JuulLabs/topaz/pull/143.
  > I've only been testing the "Disable BT from the control center" case all this while. It never occurred to me that the behaviour would be different when disabling from settings.  But yes I see the exact behaviour that you describe: - Disable Bluetooth from settings: Everything works as expected, I receive the `Disconnected` state - Disable Bluetooth from Control Center: The issue described in the original bug is seen
  > Thanks for confirming. I'll be working on a workaround soon.

- **Issue #913** (2025-08-06): **Crash when creating a Peripheral with lowercase address**
  *Symptoms*: Not sure if this should be handled by Kable or not, but I was connecting to a peripheral with an address that I get from a different peripheral. That address was lowercase, which apparently causes Android to crash.
  **Post-Mortem & Fix Analysis**:
  > I assume you're calling [`Peripheral(Identifier) { .. }`](https://github.com/JuulLabs/kable/blob/d3d3a8e01479fe9e8210a9b88e68d14c6f28b622/kable-core/src/androidMain/kotlin/Peripheral.kt#L13-L17) in which case: ya, Kable should properly uppercase the MAC address for you.  Thanks for reporting!

- **Issue #894** (2025-04-10): **Manufacture code is different between iOS and Android for the same bluetooth device**
  *Symptoms*: Hi!  Thanks for the amazing library. It has been super helpful.   I think I may have found an issue with the `Scanner`  I have this in my `commonMain` ```kotlin val scanner: PlatformScanner = Scanner {} // scan everything  scanner   .advertisements   .collect { advertisement ->      logger?.d { """       Advertisement: ${advertisement.identifier}       Manufacturer code: ${advertisement.manufacturerData?.code}       Manufacturer data: ${advertisement.manufacturerData?.data?.hex}     """.trimIndent()      }   } ```  On android logcat I see  ``` Advertisement: 02:57:29:16:C0:B0 Manufacturer code: 60902 Manufacturer data: ca 47 60 c6 58 fc ad 4e c5 2f 0e 33 e2 bc 2b 4f 12 (17) ```  Same device on ios gives  ``` Advertisement: b3cf2095-6955-aad7-b955-70e8f3ab2513 Manufacturer code: -4634 Manufacturer data: ca 47 60 c6 58 fc ad 4e c5 2f 0e 33 e2 bc 2b 4f 12 (17) ```  This seems like a bug? 🤔   I'm using `kable-core@0.35.0`
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting. Looks like we aren't properly converting the data (that we read as a `short`) on iOS.  To illustrate the issue:  ```kotlin val code = 0xEDE6 // 60902 val value = code.toShort() // on iOS, we read the manufacturer data as a `short` println(value.toInt()) // outputs -4634 ```  Fix (#895) will ship in the [next release](https://github.com/JuulLabs/kable/milestone/58) (expected by end-of-week).
  > Hi! Thanks for the fix  Any update as to when this is available? Are we waiting on #890?
  > > Any update as to when this is available?  Sorry about that, we ended up getting swamped on another project at work, so reviews didn't come as quick as I had expected.  > Are we waiting on https://github.com/JuulLabs/kable/pull/890?  Exactly right. Once I get another approval, I'll merge and release. I'm hoping to get that review tomorrow.

- **Issue #854** (2025-02-07): **Filtering on companyIdentifier does not work**
  *Symptoms*: I am trying to filter devices by `companyIdentifier` this work for Android, but in JS I get an error.  requestPeripheral options: ``` private val options = Options {     filters {         match {             manufacturerData = listOf(Filter.ManufacturerData(0x0A61, byteArrayOf()))         }     } } ```  Error: ``` SystemLogEngine.kt:35 [Kable/requestDevice] TypeError: Failed to execute 'requestDevice' on 'Bluetooth': 'dataPrefix', if present, must be non-empty.   options: Options(filters=[FilterPredicate(filters=[ManufacturerData(id=2657, data=, dataMask=null)])], optionalServices=[])   processed: {"filters":[{"manufacturerData":[{"companyIdentifier":2657,"dataPrefix":{}}]}]} ```  This code in "normal" WebBLE api works:  ```        device = await navigator.bluetooth.requestDevice({           filters: [{ manufacturerData: [{ companyIdentifier: 0x0A61 }] }],         }); ```
  **Post-Mortem & Fix Analysis**:
  > I now get this error: ``` throwableExtensions.kt:25 IllegalArgumentException: If data is present (non-null), it must be non-empty     at new ManufacturerData (webpack-internal:///./kotlin/kable-kable-core.js:692:13)     at options$lambda$lambda$lambda (webpack-internal:///./kotlin/sample.js:10515:55)     at protoOf.build_wq9w6y_k$ (webpack-internal:///./kotlin/kable-kable-core.js:906:7)     at protoOf.filters_l35td1_k$ (webpack-internal:///./kotlin/kable-kable-core.js:7644:28)     at options$lambda (webpack-internal:///./kotlin/sample.js:10503:19)     at Options_0 (webpack-internal:///./kotlin/kable-kable-core.js:7605:5)     at _init_properties_RequestDeviceLocator_kt__4wd3jl (webpack-internal:///./kotlin/sample.js:10522:17)     at get_options (webpack-internal:///./kotlin/sample.js:10340:5)     at protoOf.doResume_5yljmg_k$ (webpack-internal:///./kotlin/sample.js:10393:25)     at protoOf.invoke_d9fzmj_k$ (webpack-internal:///./kotlin/sample.js:10370:16) ﻿ ```
  > Ah, I see, this was with the `byteArrayOf()` still in place. I removed that and now it works!
  > @twyatt Stop the presses :)  Seems like this change now breaks companyIdentifier filtering on Android. I now see a list of all devices

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

### Incident Patch 1: `05849690` (2026-09-24)
**Commit Message**: Update Rust crate uuid to v1.26.1 (#1273)



---

### Incident Patch 2: `c5ffb264` (2026-08-20)
**Commit Message**: Update Rust crate uuid to v1.24.1 (#1255)

**File**: `kable-btleplug-ffi/Cargo.lock` (modified, +2/-2)
```diff
@@ -1230,9 +1230,9 @@ dependencies = [
 
 [[package]]
 name = "uuid"
-version = "1.24.0"
+version = "1.24.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bf3923a6f5c4c6382e0b653c4117f48d631ea17f38ed86e2a828e6f7412f5239"
+checksum = "2cefc03fd367c0c6d4305de1b312cf00248c4114f4a0418ce6a6af769e3b0bd9"
 dependencies = [
  "js-sys",
  "serde_core",
```

---

### Incident Patch 3: `b3906b7c` (2026-08-14)
**Commit Message**: Update dependency androidx.compose.ui:ui to v1.12.0 (#1254)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ androidx-lifecycle = { module = "androidx.lifecycle:lifecycle-common", version =
 androidx-startup = { module = "androidx.startup:startup-runtime", version = "1.2.0" }
 atomicfu = { module = "org.jetbrains.kotlinx:atomicfu", version = "0.33.0" }
 compose-activity = { module = "androidx.activity:activity-compose", version = "1.13.0" }
-compose-ui = { module = "androidx.compose.ui:ui", version = "1.11.4" }
+compose-ui = { module = "androidx.compose.ui:ui", version = "1.12.0" }
 datetime = { module = "org.jetbrains.kotlinx:kotlinx-datetime", version = "0.8.0-0.6.x-compat" }
 desugar = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
 equalsverifier = { module = "nl.jqno.equalsverifier:equalsverifier", version = "4.5" }
```

---

### Incident Patch 4: `fa38c6a2` (2026-08-12)
**Commit Message**: Fix Maven Central badge (#1237)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -615,7 +615,7 @@ Android Developers guide: [Bluetooth permissions]
 
 ### Gradle
 
-[![Maven Central](https://maven-badges.herokuapp.com/maven-central/com.juul.kable/kable-core/badge.svg)](https://maven-badges.herokuapp.com/maven-central/com.juul.kable/kable-core)
+[![Maven Central](https://img.shields.io/maven-central/v/com.juul.kable/kable-core)](https://central.sonatype.com/artifact/com.juul.kable/kable-core)
 
 Kable can be configured via Gradle Kotlin DSL as follows:
 
```

---

### Incident Patch 5: `6fd5e4da` (2026-07-21)
**Commit Message**: Avoid `removeFirstOrNull` to prevent being erroneously flagged by Google Play (#1210)

**File**: `kable-core/src/androidHostTest/kotlin/com/juul/kable/PooledThreadingStrategyTests.kt` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+package com.juul.kable
+
+import android.os.Build
+import kotlinx.coroutines.test.runTest
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+import kotlin.test.Test
+import kotlin.test.assertNotSame
+import kotlin.test.assertSame
+
+@RunWith(RobolectricTestRunner::class)
+@Config(sdk = [Build.VERSION_CODES.M])
+class PooledThreadingStrategyTests {
+
+    @Test
+    fun acquire_emptyPool_createsNewThreading() = runTest {
+        val strategy = PooledThreadingStrategy(scope = backgroundScope)
+        try {
+            val first = strategy.acquire()
+            val second = strategy.acquire()
+            assertNotSame(first, second)
+            first.shutdown()
+            second.shutdown()
+        } finally {
+            strategy.cancel()
+        }
+    }
+
+    @Test
+    fun acquire_afterRelease_reusesPooledThreading() = runTest {
+        val strategy = PooledThreadingStrategy(scope = backgroundScope)
+        try {
+            val threading = strategy.acquire()
+            strategy.release(threading)
+            val reacquired = strategy.acquire()
+            assertSame(threading, reacquired)
+            reacquired.shutdown()
+        } finally {
+            strategy.cancel()
+        }
+    }
+}
```

**File**: `kable-core/src/androidMain/kotlin/ThreadingStrategy.kt` (modified, +8/-3)
```diff
@@ -41,7 +41,7 @@ public object OnDemandThreadingStrategy : ThreadingStrategy {
  * A [ThreadingStrategy] that pools unused ["threads"][Threading] until [evictAfter] time has
  * elapsed.
  *
- * In most circumstances, only a a single [PooledThreadingStrategy] instance should be created per
+ * In most circumstances, only a single [PooledThreadingStrategy] instance should be created per
  * application run, as it holds the "shared" pool of unused ["threads"][Threading].
  *
  * Useful for when [Peripheral] connections are quickly being spun down and up again — as they can
@@ -80,8 +80,13 @@ public class PooledThreadingStrategy(
     public fun cancel(): Unit = job.cancel()
 
     override fun acquire(): Threading = guard.withLock {
-        pool.removeFirstOrNull()
-            ?.let { (_, threading) -> threading }
+        // `java.util.List.removeFirst()` is only available on Android 15 (API 35) or higher and
+        // causes a `NoSuchMethodError` on earlier Android versions when compiled against
+        // `compileSdk` 35+. Google Play flagged Kable's usage of `removeFirst` or `removeLast` (in
+        // `BluetoothGattKt`) but the only seemingly similar usage was `removeFirstOrNull` (which
+        // should be safe). We avoid the usage of `removeFirstOrNull` in hopes of not being
+        // erroneously flagged. https://github.com/JuulLabs/kable/issues/1129
+        if (pool.isEmpty()) null else pool.removeAt(0).second
     } ?: Threading(generateThreadName())
 
     override fun release(threading: Threading) {
```

---

### Incident Patch 6: `e5b19643` (2026-07-21)
**Commit Message**: Update Rust crate uuid to v1.24.0 (#1219)

**File**: `kable-btleplug-ffi/Cargo.lock` (modified, +2/-2)
```diff
@@ -1230,9 +1230,9 @@ dependencies = [
 
 [[package]]
 name = "uuid"
-version = "1.23.5"
+version = "1.24.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ea5fab0d6c3c01ae70085a09cb03d4c7a1d6314e2b3e075392783396d724ca0a"
+checksum = "bf3923a6f5c4c6382e0b653c4117f48d631ea17f38ed86e2a828e6f7412f5239"
 dependencies = [
  "js-sys",
  "serde_core",
```

---

### Incident Patch 7: `38273dfd` (2026-07-16)
**Commit Message**: Relax consumer Android SDK requirement (#1211)

**File**: `kable-core/build.gradle.kts` (modified, +4/-0)
```diff
@@ -17,6 +17,10 @@ kotlin {
     android {
         compileSdk = libs.versions.android.compile.get().toInt()
         minSdk = libs.versions.android.min.get().toInt()
+        aarMetadata {
+            minCompileSdk = libs.versions.android.min.get().toInt()
+        }
+
         namespace = "com.juul.kable"
         withHostTest { }
 
```

**File**: `kable-default-permissions/build.gradle.kts` (modified, +4/-1)
```diff
@@ -5,6 +5,9 @@ plugins {
 
 android {
     compileSdk = libs.versions.android.compile.get().toInt()
-    defaultConfig.minSdk = libs.versions.android.min.get().toInt()
+    defaultConfig {
+        minSdk = libs.versions.android.min.get().toInt()
+        aarMetadata.minCompileSdk = libs.versions.android.min.get().toInt()
+    }
     namespace = "com.juul.kable.permissions"
 }
```

---

### Incident Patch 8: `a8aea818` (2026-07-13)
**Commit Message**: Update Rust crate uuid to v1.23.5 (#1204)

**File**: `kable-btleplug-ffi/Cargo.lock` (modified, +2/-2)
```diff
@@ -1219,9 +1219,9 @@ dependencies = [
 
 [[package]]
 name = "uuid"
-version = "1.23.4"
+version = "1.23.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bf80a72845275afea99e7f2b434723d3bc7e38470fcd1c7ed39a599c73319a53"
+checksum = "ea5fab0d6c3c01ae70085a09cb03d4c7a1d6314e2b3e075392783396d724ca0a"
 dependencies = [
  "js-sys",
  "serde_core",
```

---

### Incident Patch 9: `a8e32c06` (2026-07-08)
**Commit Message**: Add timeout for write-without-response (#1186)

**File**: `kable-core/api/android/kable-core.api` (modified, +2/-0)
```diff
@@ -325,6 +325,7 @@ public final class com/juul/kable/PeripheralBuilder {
 	public final fun autoConnectIf (Lkotlin/jvm/functions/Function0;)V
 	public final fun getDisconnectTimeout-UwyO8pc ()J
 	public final fun getForceCharacteristicEqualityByUuid ()Z
+	public final fun getWriteWithoutResponseTimeout-UwyO8pc ()J
 	public final fun getPhy ()Lcom/juul/kable/Phy;
 	public final fun getThreadingStrategy ()Lcom/juul/kable/ThreadingStrategy;
 	public final fun getTransport ()Lcom/juul/kable/Transport;
@@ -333,6 +334,7 @@ public final class com/juul/kable/PeripheralBuilder {
 	public final fun onServicesDiscovered (Lkotlin/jvm/functions/Function2;)V
 	public final fun setDisconnectTimeout-LRDsOJo (J)V
 	public final fun setForceCharacteristicEqualityByUuid (Z)V
+	public final fun setWriteWithoutResponseTimeout-LRDsOJo (J)V
 	public final fun setPhy (Lcom/juul/kable/Phy;)V
 	public final fun setThreadingStrategy (Lcom/juul/kable/ThreadingStrategy;)V
 	public final fun setTransport (Lcom/juul/kable/Transport;)V
```

**File**: `kable-core/api/jvm/kable-core.api` (modified, +2/-0)
```diff
@@ -272,11 +272,13 @@ public final class com/juul/kable/Peripheral$DefaultImpls {
 public final class com/juul/kable/PeripheralBuilder {
 	public final fun getDisconnectTimeout-UwyO8pc ()J
 	public final fun getForceCharacteristicEqualityByUuid ()Z
+	public final fun getWriteWithoutResponseTimeout-UwyO8pc ()J
 	public final fun logging (Lkotlin/jvm/functions/Function1;)V
 	public final fun observationExceptionHandler (Lkotlin/jvm/functions/Function3;)V
 	public final fun onServicesDiscovered (Lkotlin/jvm/functions/Function2;)V
 	public final fun setDisconnectTimeout-LRDsOJo (J)V
 	public final fun setForceCharacteristicEqualityByUuid (Z)V
+	public final fun setWriteWithoutResponseTimeout-LRDsOJo (J)V
 }
 
 public final class com/juul/kable/PeripheralKt {
```

**File**: `kable-core/src/androidMain/kotlin/PeripheralBuilder.kt` (modified, +2/-0)
```diff
@@ -119,4 +119,6 @@ public actual class PeripheralBuilder internal actual constructor() {
     public actual var disconnectTimeout: Duration = defaultDisconnectTimeout
 
     public actual var forceCharacteristicEqualityByUuid: Boolean = false
+
+    public actual var writeWithoutResponseTimeout: Duration = defaultWriteWithoutResponseTimeout
 }
```

**File**: `kable-core/src/appleMain/kotlin/CBPeripheralCoreBluetoothPeripheral.kt` (modified, +12/-1)
```diff
@@ -15,6 +15,7 @@ import com.juul.kable.logs.Logging.DataProcessor.Operation.Write
 import com.juul.kable.logs.detail
 import kotlinx.coroutines.CancellationException
 import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.TimeoutCancellationException
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.flow.Flow
 import kotlinx.coroutines.flow.MutableStateFlow
@@ -28,6 +29,7 @@ import kotlinx.coroutines.flow.onEach
 import kotlinx.coroutines.flow.onSubscription
 import kotlinx.coroutines.flow.updateAndGet
 import kotlinx.coroutines.sync.withLock
+import kotlinx.coroutines.withTimeout
 import kotlinx.io.IOException
 import platform.CoreBluetooth.CBCharacteristicWriteWithResponse
 import platform.CoreBluetooth.CBCharacteristicWriteWithoutResponse
@@ -56,6 +58,7 @@ internal class CBPeripheralCoreBluetoothPeripheral(
     private val logging: Logging,
     private val disconnectTimeout: Duration,
     private val forceCharacteristicEqualityByUuid: Boolean,
+    private val writeWithoutResponseTimeout: Duration,
 ) : BasePeripheral(cbPeripheral.identifier.toUuid()), CoreBluetoothPeripheral {
 
     private val central = CentralManager.Default
@@ -213,7 +216,15 @@ internal class CBPeripheralCoreBluetoothPeripheral(
             }
             WithoutResponse -> connectionOrThrow().guard.withLock {
                 if (!canSendWriteWithoutResponse.updateAndGet { cbPeripheral.canSendWriteWithoutResponse }) {
-                    canSendWriteWithoutResponse.first { it }
+                    try {
+                        withTimeout(writeWithoutResponseTimeout) {
+                            canSendWriteWithoutResponse.first { it }
+                        }
+                    } catch (e: TimeoutCancellationException) {
+                        logger.warn {
+                            message = "Timed out waiting for canSendWriteWithoutResponse, proceeding with write attempt"
+                        }
+                    }
                 }
                 central.writeValue(cbPeripheral, data, platformCharacteristic, CBWithoutResponse)
             }
```

**File**: `kable-core/src/appleMain/kotlin/Peripheral.kt` (modified, +1/-0)
```diff
@@ -33,5 +33,6 @@ public fun Peripheral(
         builder.logging,
         builder.disconnectTimeout,
         builder.forceCharacteristicEqualityByUuid,
+        builder.writeWithoutResponseTimeout,
     )
 }
```

**File**: `kable-core/src/appleMain/kotlin/PeripheralBuilder.kt` (modified, +2/-0)
```diff
@@ -60,4 +60,6 @@ public actual class PeripheralBuilder internal actual constructor() {
     public actual var disconnectTimeout: Duration = defaultDisconnectTimeout
 
     public actual var forceCharacteristicEqualityByUuid: Boolean = false
+
+    public actual var writeWithoutResponseTimeout: Duration = defaultWriteWithoutResponseTimeout
 }
```

**File**: `kable-core/src/appleMain/kotlin/PeripheralDelegate.kt` (modified, +1/-0)
```diff
@@ -323,6 +323,7 @@ internal class PeripheralDelegate(
     fun close(cause: Throwable?) {
         _response.close(NotConnectedException(cause = cause))
         characteristicChanges.emitBlocking(ObservationEvent.Disconnected)
+        canSendWriteWithoutResponse.value = true
     }
 }
 
```

**File**: `kable-core/src/commonMain/kotlin/PeripheralBuilder.kt` (modified, +16/-0)
```diff
@@ -3,6 +3,7 @@ package com.juul.kable
 import com.juul.kable.logs.LoggingBuilder
 import kotlinx.coroutines.flow.StateFlow
 import kotlin.time.Duration
+import kotlin.time.Duration.Companion.milliseconds
 import kotlin.time.Duration.Companion.seconds
 
 public expect class ServicesDiscoveredPeripheral {
@@ -35,6 +36,7 @@ internal typealias ServicesDiscoveredAction = suspend ServicesDiscoveredPeripher
 internal typealias ObservationExceptionHandler = suspend ObservationExceptionPeripheral.(cause: Exception) -> Unit
 
 internal val defaultDisconnectTimeout = 5.seconds
+internal val defaultWriteWithoutResponseTimeout = 30.milliseconds
 
 public expect class PeripheralBuilder internal constructor() {
     public fun logging(init: LoggingBuilder)
@@ -91,4 +93,18 @@ public expect class PeripheralBuilder internal constructor() {
      */
     @ObsoleteKableApi // Will be removed after https://github.com/JuulLabs/kable/issues/1016 is fixed.
     public var forceCharacteristicEqualityByUuid: Boolean
+
+    /**
+     * Amount of time to wait for `peripheralIsReady(toSendWriteWithoutResponse:)` before
+     * proceeding with the write.
+     *
+     * On some iOS versions/chipsets, the callback may be delayed or never fired, causing the
+     * write pipeline to stall indefinitely. When the timeout expires, a warning is logged and the
+     * write proceeds.
+     *
+     * Set to a large duration to effectively disable the timeout.
+     *
+     * Only applicable on Apple.
+     */
+    public var writeWithoutResponseTimeout: Duration
 }
```

---

### Incident Patch 10: `f4db6a57` (2026-07-08)
**Commit Message**: Update dependency androidx.compose.ui:ui to v1.11.4 (#1193)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ androidx-lifecycle = { module = "androidx.lifecycle:lifecycle-common", version =
 androidx-startup = { module = "androidx.startup:startup-runtime", version = "1.2.0" }
 atomicfu = { module = "org.jetbrains.kotlinx:atomicfu", version = "0.33.0" }
 compose-activity = { module = "androidx.activity:activity-compose", version = "1.13.0" }
-compose-ui = { module = "androidx.compose.ui:ui", version = "1.11.3" }
+compose-ui = { module = "androidx.compose.ui:ui", version = "1.11.4" }
 datetime = { module = "org.jetbrains.kotlinx:kotlinx-datetime", version = "0.8.0-0.6.x-compat" }
 desugar = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
 equalsverifier = { module = "nl.jqno.equalsverifier:equalsverifier", version = "4.5" }
```

---

### Incident Patch 11: `0654b6df` (2026-07-03)
**Commit Message**: Update dependency androidx.compose.ui:ui to v1.11.3 (#1189)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ androidx-lifecycle = { module = "androidx.lifecycle:lifecycle-common", version =
 androidx-startup = { module = "androidx.startup:startup-runtime", version = "1.2.0" }
 atomicfu = { module = "org.jetbrains.kotlinx:atomicfu", version = "0.33.0" }
 compose-activity = { module = "androidx.activity:activity-compose", version = "1.13.0" }
-compose-ui = { module = "androidx.compose.ui:ui", version = "1.11.2" }
+compose-ui = { module = "androidx.compose.ui:ui", version = "1.11.3" }
 datetime = { module = "org.jetbrains.kotlinx:kotlinx-datetime", version = "0.8.0-0.6.x-compat" }
 desugar = { module = "com.android.tools:desugar_jdk_libs", version = "2.1.5" }
 equalsverifier = { module = "nl.jqno.equalsverifier:equalsverifier", version = "4.5" }
```

---

### Incident Patch 12: `b6209841` (2026-06-27)
**Commit Message**: Update Rust crate uuid to v1.23.4 (#1180)

**File**: `kable-btleplug-ffi/Cargo.lock` (modified, +2/-2)
```diff
@@ -1207,9 +1207,9 @@ dependencies = [
 
 [[package]]
 name = "uuid"
-version = "1.23.3"
+version = "1.23.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "144d6b123cef80b301b8f72a9e2ca4370ddec21950d0a103dd22c437006d2db7"
+checksum = "bf80a72845275afea99e7f2b434723d3bc7e38470fcd1c7ed39a599c73319a53"
 dependencies = [
  "js-sys",
  "serde_core",
```

---

### Incident Patch 13: `9c719e24` (2026-06-19)
**Commit Message**: Update dependency androidx.compose.ui:ui to v1.11.3 (#1172)

**File**: `samples/sensortag/gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ voyager = "2.2.21-1.10.3"
 [libraries]
 androidx-lifecycle = { module = "androidx.lifecycle:lifecycle-common", version = "2.10.0" }
 compose-activity = { module = "androidx.activity:activity-compose", version = "1.13.0" }
-compose-ui = { module = "androidx.compose.ui:ui", version = "1.11.2" }
+compose-ui = { module = "androidx.compose.ui:ui", version = "1.11.3" }
 coroutines = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "kotlinx-coroutines" }
 coroutines-swing = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-swing", version.ref = "kotlinx-coroutines" }
 datetime = { module = "org.jetbrains.kotlinx:kotlinx-datetime", version = "0.8.0-0.6.x-compat" }
```

---

### Incident Patch 14: `dc2b5b82` (2026-06-10)
**Commit Message**: Update dependency androidx.compose.ui:ui to v1.10.1 (#526)

**File**: `samples/sensortag/gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ voyager = "1.1.0-beta03"
 [libraries]
 androidx-lifecycle = { module = "androidx.lifecycle:lifecycle-common", version = "2.10.0" }
 compose-activity = { module = "androidx.activity:activity-compose", version = "1.13.0" }
-compose-ui = { module = "androidx.compose.ui:ui", version = "1.9.5" }
+compose-ui = { module = "androidx.compose.ui:ui", version = "1.11.2" }
 coroutines = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "kotlinx-coroutines" }
 coroutines-swing = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-swing", version.ref = "kotlinx-coroutines" }
 datetime = { module = "org.jetbrains.kotlinx:kotlinx-datetime", version = "0.8.0" }
```

---

### Incident Patch 15: `2827c170` (2026-06-09)
**Commit Message**: Update Rust crate uuid to v1.23.3 (#1165)

**File**: `kable-btleplug-ffi/Cargo.lock` (modified, +2/-2)
```diff
@@ -1207,9 +1207,9 @@ dependencies = [
 
 [[package]]
 name = "uuid"
-version = "1.23.2"
+version = "1.23.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d258b83ceec21034727ecee8c382cfa6c3e133699b0742c64571814fb420c9f7"
+checksum = "144d6b123cef80b301b8f72a9e2ca4370ddec21950d0a103dd22c437006d2db7"
 dependencies = [
  "js-sys",
  "serde_core",
```

#### Recent Merged Pull Requests:
- **PR #1286** (2026-10-05): Update Rust crate btleplug to v0.13.4 (@juul-mobile-bot)
- **PR #1285** (2026-09-28): Update Gradle to v9.8.0 (@juul-mobile-bot)
- **PR #1278** (2026-09-24): Update Rust crate btleplug to v0.13.2 (@juul-mobile-bot)
- **PR #1275** (2026-09-24): Update dependency com.juul.khronicle:khronicle-core to v1.2.0 (@juul-mobile-bot)
- **PR #1274** (closed): Fix JVM maximum write length using negotiated MTU (@AvikMakwana)
- **PR #1273** (2026-09-24): Update Rust crate uuid to v1.26.1 (@juul-mobile-bot)
- **PR #1270** (closed): Workaround for trailing `Unit` bug in Kotlin compiler (@twyatt)
- **PR #1266** (closed): Update kotlin monorepo to v2.4.20 (@juul-mobile-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
