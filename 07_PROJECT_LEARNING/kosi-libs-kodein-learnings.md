# Forensic Learning Record (Deep Inspection): kosi-libs/Kodein

> **Canonical Artifact**: `07_PROJECT_LEARNING/kosi-libs-kodein-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kosi-libs/Kodein](https://github.com/kosi-libs/Kodein))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:17:59.700Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kosi-libs/Kodein`
- **Description**: Painless Kotlin Dependency Injection
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3333 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `framework/android/kodein-di-framework-android-core/src/main/java/org/kodein/di/android/closest.kt`
```
@file:Suppress("DEPRECATION")

package org.kodein.di.android

import android.app.Dialog
import android.app.Fragment
import android.content.AbstractThreadedSyncAdapter
import android.content.Context
import android.content.ContextWrapper
import android.content.Loader
import android.view.View
import org.kodein.di.*
import kotlin.reflect.KProperty

private fun closestDI(thisRef: Any?, rootContext: Context): DI {
    var context: Context? = rootContext
    while (context != null) {
        if (context != thisRef && context is DIAware) {
            return context.di
        }
        context = if (context is ContextWrapper) context.baseContext else null
    }
    val appContext = rootContext.applicationContext as? DIAware
        ?: error("Trying to find closest DI, but no DI container was found at all. Your Application should be DIAware.")
    return appContext.di
}

/**
 * Provides a `Lazy<DI>`, to be used as a property delegate.
 *
 * @param T The receiver type.
 */
public interface DIPropertyDelegateProvider<in T> {
    /** @suppress */
    public operator fun provideDelegate(thisRef: T, property: KProperty<*>?): Lazy<DI>
}

private class ContextDIPropertyDelegateProvider : DIPropertyDelegateProvider<Context> {
    override operator fun provideDelegate(thisRef: Context, property: KProperty<*>?) = lazy { closestDI(thisRef, thisRef) }
}

public class LazyContextDIPropertyDelegateProvider(private val getContext: () -> Context) : DIPropertyDelegateProvider<Any?> {
    override operator fun provideDelegate(thisRef: Any?, property: KProperty<*>?): Lazy<DI> = lazy { closestDI(thisRef, getContext()) }
}

/**
 * Returns the closest DI (or the app DI, if no closest DI could be found).
 *
 * To be used on Android's `Context` classes, such as `Activity` or `Service`.
 */
public fun closestDI(): DIPropertyDelegateProvider<Context> = ContextDIPropertyDelegateProvider()

/**
 * Returns the closest DI (or the app DI, if no closest DI could be found).
 *
 * @param context The Android context to use to walk up the context hierarchy.
 */
public fun closestDI(context: Context): LazyContextDIPropertyDelegateProvider = LazyContextDIPropertyDelegateProvider { context }

/**
 * Returns the closest DI (or the app DI, if no closest DI could be found).
 *
 * @param getContext A function that returns the Android context to use to walk up the context hierarchy.
 */
public fun closestDI(getContext: () -> Context): DIPropertyDelegateProvider<Any?> = LazyContextDIPropertyDelegateProvider(getContext)

/**
 * Returns the closest DI (or the app DI, if no closest DI could be found).
 */
public fun Fragment.closestDI(): DIPropertyDelegateProvider<Any?> = closestDI { activity }

/**
 * Returns the closest DI (or the app DI, if no closest DI could be found).
 */
public fun Dialog.closestDI(): DIPropertyDelegateProvider<Any?> = closestDI { context }

/**
 * Returns the closest DI (or the app DI, if no closest DI could be found).
 */
public fun View.closestDI(): DIPropertyDelegateProvider<Any?> = closestDI { context }

/**
 * Returns the closest DI (or the app DI, if no closest DI could be found).
 */
public fun AbstractThreadedSyncAdapter.closestDI(): DIPropertyDelegateProvider<Any?> = closestDI { context }

/**
 * Returns the closest DI (or the app DI, if no closest DI could be found).
 */
public fun Loader<*>.closestDI(): DIPropertyDelegateProvider<Any?> = closestDI { context }

```

### Core Architecture Module: `framework/android/kodein-di-framework-android-core/src/main/java/org/kodein/di/android/module.kt`
```
@file:Suppress("DEPRECATION")

package org.kodein.di.android

import android.accounts.AccountManager
import android.annotation.SuppressLint
import android.app.Activity
import android.app.ActivityManager
import android.app.AlarmManager
import android.app.Application
import android.app.Dialog
import android.app.DownloadManager
import android.app.Fragment
import android.app.KeyguardManager
import android.app.NotificationManager
import android.app.SearchManager
import android.app.UiModeManager
import android.app.WallpaperManager
import android.app.admin.DevicePolicyManager
import android.app.job.JobScheduler
import android.app.usage.NetworkStatsManager
import android.app.usage.UsageStatsManager
import android.appwidget.AppWidgetManager
import android.content.AbstractThreadedSyncAdapter
import android.content.ClipboardManager
import android.content.Context
import android.content.Loader
import android.content.RestrictionsManager
import android.content.pm.LauncherApps
import android.content.pm.ShortcutManager
import android.hardware.SensorManager
import android.hardware.camera2.CameraManager
import android.hardware.fingerprint.FingerprintManager
import android.hardware.usb.UsbManager
import android.location.LocationManager
import android.media.AudioManager
import android.media.midi.MidiManager
import android.media.projection.MediaProjectionManager
import android.media.session.MediaSessionManager
import android.media.tv.TvInputManager
import android.net.ConnectivityManager
import android.net.wifi.WifiManager
import android.net.wifi.p2p.WifiP2pManager
import android.nfc.NfcManager
import android.os.BatteryManager
import android.os.Build
import android.os.DropBoxManager
import android.os.HardwarePropertiesManager
import android.os.PowerManager
import android.os.Vibrator
import android.os.health.SystemHealthManager
import android.os.storage.StorageManager
import android.preference.PreferenceManager
import android.telecom.TelecomManager
import android.telephony.CarrierConfigManager
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityManager
import android.view.inputmethod.InputMethodManager
import android.view.textservice.TextServicesManager
import org.kodein.di.DI
import org.kodein.di.bind
import org.kodein.di.bindProvider
import org.kodein.di.bindings.Factory
import org.kodein.di.bindings.Provider
import org.kodein.di.bindings.SimpleContextTranslator
import org.kodein.type.TypeToken
import org.kodein.type.generic

public val androidCoreContextTranslators: DI.Module = DI.Module(name = "\u2063androidCoreContextTranslators") {
    RegisterContextTranslator(SimpleContextTranslator<Fragment, Activity>(generic(), generic()) { it.activity })
    RegisterContextTranslator(SimpleContextTranslator<Dialog, Context>(generic(), generic()) { it.context })
    RegisterContextTranslator(SimpleContextTranslator<View, Context>(generic(), generic()) { it.context })
    RegisterContextTranslator(SimpleContextTranslator<Loader<*>, Context>(generic(), generic()) { it.context })
    RegisterContextTranslator(SimpleContextTranslator<AbstractThreadedSyncAdapter, Context>(generic(), generic()) { it.context })
}

/**
 * Android `DI.Module` that defines a lot of platform bindings.
 *
 * @param app The application object, used for context.
 * @return An Android `DI.Module` that defines a lot of platform bindings.
 */
@SuppressLint("NewApi")
public fun androidCoreModule(app: Application): DI.Module = DI.Module(name = "\u2063androidModule") {

    importOnce(androidCoreContextTranslators)

    val contextToken = generic<Context>()

    bind { Provider(TypeToken.Any, generic()) { app } }

    bind { Provider(contextToken, generic()) { context.assets } }
    bind { Provider(contextToken, generic()) { context.contentResolver } }
    bind { Provider(contextToken, generic()) { context.applicationInfo } }
    bind { Provider(contextToken, generic()) { context.mainLooper } }
    bind { Provider(contextToken, generic()) { context.packageManager } }
    bind { Provider(contextToken, generic()) { context.resources } }
    bind { Provider(contextToken, generic()) { context.theme } }

    bind { Provider(contextToken, generic()) { PreferenceManager.getDefaultSharedPreferences(context) } }
    bind {
        Factory(contextToken, generic(), generic()) { name: String ->
            context.getSharedPreferences(
                name,
                Context.MODE_PRIVATE
            )
        }
    }

    bind(tag = "cache") { Provider(contextToken, generic()) { context.cacheDir } }
    // Bind<File>(generic(), tag = "externalCache") with Provider(contextToken, generic()) { context.externalCacheDir } TODO: re-enable once we found how to bind nullables
    bind(tag = "files") { Provider(contextToken, generic()) { context.filesDir } }
    bind(tag = "obb") { Provider(contextToken, generic()) { context.obbDir } }

    bind(tag = "packageCodePath") { Provider(contextToken, generic()) { context.packageCodePath } }
    bind(tag = "packageName") { Provider(contextToken, generic()) { context.packageName } }
    bind(tag = "packageResourcePath") { Provider(contextToken, generic()) { context.packageResourcePath } }

    bind { Provider(contextToken, generic()) { context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.ACCOUNT_SERVICE) as AccountManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.ALARM_SERVICE) as AlarmManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.DROPBOX_SERVICE) as DropBoxManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.LOCATION_SERVICE) as LocationManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.NFC_SERVICE) as NfcManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.POWER_SERVICE) as PowerManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.SEARCH_SERVICE) as SearchManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.SENSOR_SERVICE) as SensorManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.STORAGE_SERVICE) as StorageManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.TEXT_SERVICES_MANAGER_SERVICE) as TextServicesManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.UI_MODE_SERVICE) as UiModeManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.USB_SERVICE) as UsbManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.WALLPAPER_SERVICE) as WallpaperManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.WIFI_SERVICE) as WifiManager } }
    bind { Provider(contextToken, generic()) { context.getSystemService(Context.WINDOW_SERVICE) as WindowManager } }

    if (Build.VERSION.SDK_INT >= 21) {
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.APPWIDGET_SERVICE) as AppWidgetManager } }
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager } }
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.CAMERA_SERVICE) as CameraManager } }
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler } }
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.LAUNCHER_APPS_SERVICE) as LauncherApps } }
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager } }
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager } }
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.RESTRICTIONS_SERVICE) as RestrictionsManager } }
        bind { Provider(contextToken, generic()) { context.getSystemService(Context.TELECOM_SERVICE)
```

### Core Architecture Module: `framework/android/kodein-di-framework-android-core/src/main/java/org/kodein/di/android/retained.kt`
```
@file:Suppress("DEPRECATION")

package org.kodein.di.android

import android.app.Activity
import android.app.Fragment
import android.os.Bundle
import org.kodein.di.*

/** @suppress */
public class RetainedDIFragment : Fragment() {

    private var _di: DI? = null
    public var di: DI?
        get() = _di
        set(value) {
            _di = value
        }

    @Deprecated("Deprecated in Java")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        retainInstance = true
    }

}

private const val DI_RETAINED_FRAGMENT_TAG = "org.kodein.di.android.RetainedDIFragment"

/**
 * A DI instance that will be retained between activity changes.
 *
 * @property allowSilentOverride Whether this module is allowed to non-explicit overrides.
 * @property init The block of configuration for this module.
 */
public fun Activity.retainedDI(allowSilentOverride: Boolean = false, init: DI.MainBuilder.() -> Unit): Lazy<DI> = lazy {
    (fragmentManager.findFragmentByTag(DI_RETAINED_FRAGMENT_TAG) as? RetainedDIFragment)?.di?.let { return@lazy it }

    val di = DI(allowSilentOverride, init)
    val fragment = RetainedDIFragment()
    fragment.di = di
    fragmentManager.beginTransaction().add(fragment, DI_RETAINED_FRAGMENT_TAG).commit()

    return@lazy di
}
```

### Core Architecture Module: `framework/android/kodein-di-framework-android-core/src/main/java/org/kodein/di/android/scopes.kt`
```
@file:Suppress("DEPRECATION")

package org.kodein.di.android

import android.app.Activity
import android.app.Fragment
import android.content.Context
import android.os.Build
import android.os.Bundle
import org.kodein.di.bindings.*
import java.lang.ref.WeakReference

private const val SCOPE_FRAGMENT_TAG = "org.kodein.android.ActivityRetainedScope.RetainedScopeFragment"

/**
 * A scope that allows to get an activity-scoped singleton that's independent from the activity restart.
 */
public open class ActivityRetainedScope private constructor(private val registryType: RegistryType) : Scope<Activity> {

    private enum class RegistryType {
        Standard { override fun new() = StandardScopeRegistry() },
        SingleItem { override fun new() = SingleItemScopeRegistry() };
        abstract fun new(): ScopeRegistry
    }

    public object Keys {
        public const val registryTypeOrdinal: String = "org.kodein.di.android.registryTypeOrdinal"
    }

    public companion object MultiItem: ActivityRetainedScope(RegistryType.Standard)

    public object SingleItem: ActivityRetainedScope(RegistryType.SingleItem)

    /** @suppress */
    public class RetainedScopeFragment: Fragment() {
        public val registry: ScopeRegistry by lazy {
            val ordinal = arguments.getInt(Keys.registryTypeOrdinal)
            RegistryType.entries[ordinal].new()
        }

        public var transactionPendingFragmentCache: MutableMap<Activity, WeakReference<RetainedScopeFragment>>? = null

        @Deprecated("Deprecated in Java")
        override fun onAttach(context: Context?) {
            super.onAttach(context)
            transactionPendingFragmentCache?.remove(context)
            transactionPendingFragmentCache = null
        }

        @Deprecated("Deprecated in Java")
        override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
            retainInstance = true
        }

        @Deprecated("Deprecated in Java")
        override fun onDestroy() {
            registry.clear()
            super.onDestroy()
        }
    }

    // This is a hack to circumvent the fact that commitNow do not exist before Android N.
    // See https://github.com/Kodein-Framework/Kodein-DI/pull/174
    private val transactionPendingFragmentCache = HashMap<Activity, WeakReference<RetainedScopeFragment>>()

    override fun getRegistry(context: Activity): ScopeRegistry {
        val fragment = context.retainedScopeFragment ?: run {
            synchronized(context) {
                context.retainedScopeFragment ?: transactionPendingFragmentCache[context]?.get() ?: run {
                    RetainedScopeFragment().also {
                        it.arguments = Bundle().apply { putInt(Keys.registryTypeOrdinal, registryType.ordinal) }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            context.fragmentManager.beginTransaction().add(it, SCOPE_FRAGMENT_TAG).commitNow()
                        } else {
                            // since we can't commit immediately, we cache the fragment temporarily and clear
                            // the reference when the commit completes
                            transactionPendingFragmentCache[context] = WeakReference(it)
                            it.transactionPendingFragmentCache = transactionPendingFragmentCache
                            context.fragmentManager.beginTransaction().add(it, SCOPE_FRAGMENT_TAG).commit()
                        }
                    }
                }
            }
        }
        return fragment.registry
    }

    private val Activity.retainedScopeFragment: RetainedScopeFragment?
        get() = fragmentManager.findFragmentByTag(SCOPE_FRAGMENT_TAG) as? RetainedScopeFragment

}

```

### Core Architecture Module: `framework/android/kodein-di-framework-android-core/src/main/java/org/kodein/di/android/sub.kt`
```
package org.kodein.di.android

import android.app.Activity
import org.kodein.di.*

public inline fun subDI(noinline parentDI: () -> DI, allowSilentOverride: Boolean = false, copy: Copy = Copy.NonCached, crossinline init: DI.MainBuilder.() -> Unit): LazyDI = DI.lazy(allowSilentOverride) {
    extend(parentDI(), copy = copy)
    init()
}

public inline fun subDI(parentDI: Lazy<DI>, allowSilentOverride: Boolean = false, copy: Copy = Copy.NonCached, crossinline init: DI.MainBuilder.() -> Unit): LazyDI = subDI({ parentDI.value }, allowSilentOverride, copy, init)

public inline fun <T> T.subDI(parentDI: DIPropertyDelegateProvider<T>, allowSilentOverride: Boolean = false, copy: Copy = Copy.NonCached, crossinline init: DI.MainBuilder.() -> Unit): LazyDI = subDI(parentDI.provideDelegate(this, null), allowSilentOverride, copy, init)

public inline fun Activity.retainedSubDI(noinline parentDI: () -> DI, allowSilentOverride: Boolean = false, copy: Copy = Copy.NonCached, crossinline init: DI.MainBuilder.() -> Unit): Lazy<DI> = retainedDI(allowSilentOverride) {
    extend(parentDI(), copy = copy)
    init()
}

public inline fun Activity.retainedSubDI(parentDI: Lazy<DI>, allowSilentOverride: Boolean = false, copy: Copy = Copy.NonCached, crossinline init: DI.MainBuilder.() -> Unit): Lazy<DI> = retainedSubDI({ parentDI.value }, allowSilentOverride, copy, init)

public inline fun Activity.retainedSubDI(parentDI: DIPropertyDelegateProvider<Activity>, allowSilentOverride: Boolean = false, copy: Copy = Copy.NonCached, crossinline init: DI.MainBuilder.() -> Unit): Lazy<DI> = retainedSubDI(parentDI.provideDelegate(this, null), allowSilentOverride, copy, init)
```

### Core Architecture Module: `framework/android/kodein-di-framework-android-x-viewmodel-savedstate/src/main/java/org/kodein/di/android/x/viewmodel/savedstate/DIAware.kt`
```
@file:Suppress("UNCHECKED_CAST")

package org.kodein.di.android.x.viewmodel.savedstate

import androidx.annotation.MainThread
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.createViewModelLazy
import androidx.lifecycle.AbstractSavedStateViewModelFactory
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelLazy
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.CreationExtras
import org.kodein.di.DI
import org.kodein.di.DIAware
import org.kodein.di.direct
import org.kodein.type.generic

/**
 * Returns a [Lazy] property delegate to access the [AppCompatActivity]'s [ViewModel], which will be obtained from a
 * Kodein DI factory with a [SavedStateHandle] argument.
 *
 * ```
 * class MyAppCompatActivity : AppCompatActivity(), DIAware {
 *     override val di: DI by closestDI()
 *     private val viewmodel: MyViewModel by viewModelWithSavedStateHandle()
 * }
 * ```
 * @param A Extension function applies to [AppCompatActivity] which implements [DIAware]
 * @param VM The type of [ViewModel] to obtain
 * @param tag The bound Kodein DI tag
 * @throws IllegalArgumentException if accessed before the [AppCompatActivity] is attached to the [Application]
 * @throws DI.NotFoundException If no factory was found.
 * @throws DI.DependencyLoopException When calling the factory, if the value construction triggered a dependency loop.
 */
@MainThread
public inline fun <A, reified VM> A.viewModelWithSavedStateHandle(
    tag: Any? = null,
): Lazy<VM> where A : AppCompatActivity, A : DIAware, VM : ViewModel {
    val factoryProducer = { object : AbstractSavedStateViewModelFactory(this@viewModelWithSavedStateHandle, null) {
        override fun <T : ViewModel> create(key: String, modelClass: Class<T>, handle: SavedStateHandle): T {
            val factory = direct.Factory(generic<SavedStateHandle>(), generic<VM>(), tag)
            return factory(handle) as T
        }
    } }
    return ViewModelLazy(VM::class, { viewModelStore }, factoryProducer)
}

/**
 * Returns a [Lazy] property delegate to access a [ViewModel] by **default** scoped to this [Fragment], which will
 * be obtained from a Kodein DI factory with a [SavedStateHandle] argument.
 * ```
 * class MyFragment : Fragment(), DIAware {
 *     override val di: DI by closesDI()
 *     private val viewmodel: MyViewModel by viewModelWithSavedStateHandle()
 * }
 * ```
 *
 * Default scope may be overridden with parameter [ownerProducer]:
 * ```
 * class MyFragment : Fragment(), DIAware {
 *     override val di: DI by closestDI()
 *     private val viewmodel: MyViewModel by viewModelWithSavedStateHandle(ownerProducer = { requireParentFragment() })
 * }
 * ```
 *
 * @param F Extension function applies to [Fragment] which implements [DIAware]
 * @param VM The type of [ViewModel] to obtain
 * @param ownerProducer Optionally override the default ViewModel owner
 * @param tag The bound Kodein DI tag
 * @throws IllegalArgumentException if accessed before this Fragment is attached
 * @throws DI.NotFoundException If no factory was found.
 * @throws DI.DependencyLoopException When calling the factory, if the value construction triggered a dependency loop.
 */
@MainThread
public inline fun <F, reified VM> F.viewModelWithSavedStateHandle(
    noinline ownerProducer: () -> ViewModelStoreOwner = { this },
    tag: Any? = null,
): Lazy<VM> where F : Fragment, F : DIAware, VM : ViewModel {
    return createViewModelLazy(
        viewModelClass = VM::class,
        storeProducer = { ownerProducer().viewModelStore},
        factoryProducer = {
            object : AbstractSavedStateViewModelFactory(this@viewModelWithSavedStateHandle, arguments) {
                override fun <T : ViewModel> create(key: String, modelClass: Class<T>, handle: SavedStateHandle): T {
                    val factory = direct.Factory(generic<SavedStateHandle>(), generic<VM>(), tag)
                    return factory(handle) as T
                }
            }
        }
    )
}

```

### Core Architecture Module: `kodein-di-jxinject-jvm/src/main/kotlin/org/kodein/di/jxinject/reflect-utils.kt`
```
package org.kodein.di.jxinject

import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type
import java.lang.reflect.WildcardType

internal fun Type.rawType(): Class<*> = when (this) {
    is Class<*> -> this
    is ParameterizedType -> rawType.rawType()
    is WildcardType -> upperBounds[0].rawType()
    else -> throw IllegalStateException("Cannot get raw type of $this")
}

internal fun Type.lower(): Type = when (this) {
    is WildcardType -> lowerBounds[0]
    else -> this
}

```

### Core Architecture Module: `kodein-di/src/commonMain/kotlin/org/kodein/di/internal/concurrent.kt`
```
package org.kodein.di.internal

import kotlinx.atomicfu.locks.SynchronizedObject
import kotlinx.atomicfu.locks.synchronized

/**
 * Using kotlinx-atomicfu may cause some performance issues on native platforms.
 * @see https://youtrack.jetbrains.com/issue/CMP-1182 and https://youtrack.jetbrains.com/issue/KT-70751
 */
public inline fun <R> maySynchronized(lock: SynchronizedObject?, block: () -> R): R =
    if (lock == null) {
        block()
    } else {
        synchronized(lock, block)
    }

/** @suppress */
public inline fun <T: Any, R> synchronizedIfNull(lock: SynchronizedObject?, predicate: () -> T?, ifNotNull: (T) -> R, ifNull: () -> R): R {
    predicate()?.let {
        return ifNotNull(it)
    }

    val value = maySynchronized(lock) {
        predicate()?.let { return@maySynchronized it }

        return ifNull()
    }

    return ifNotNull(value)
}

/** @suppress */
internal inline fun <T: Any, R> synchronizedIfNotNull(lock: SynchronizedObject?, predicate: () -> T?, ifNull: () -> R, ifNotNull: (T) -> R): R {
    if (predicate() == null) {
        return ifNull()
    }

    maySynchronized(lock) {
        val value = predicate() ?: return@maySynchronized

        return ifNotNull(value)
    }

    return ifNull()
}

```

### Core Architecture Module: `compiler/kodein-resolver-api/src/commonMain/kotlin/org/kodein/di/resolver/DIResolver.kt`
```
package org.kodein.di.resolver

/**
 * Defines that a DI resolver instance that must check
 * the dependencies linked to it by the symbol processor.
 */
public interface DIResolver {
    public fun check()
}
```

### Core Architecture Module: `compiler/kodein-resolver-api/src/commonMain/kotlin/org/kodein/di/resolver/annotations.kt`
```
package org.kodein.di.resolver

/**
 * Defines that a given interface can be resolved by linking a DI container
 * and generating some instance accessors through a symbol processor
 */
@Retention(AnnotationRetention.SOURCE)
@Target(AnnotationTarget.CLASS)
@MustBeDocumented
public annotation class Resolved

/**
 * Defines a tag on a bind function in a [Resolved]
 */
@Retention(AnnotationRetention.SOURCE)
@Target(AnnotationTarget.FUNCTION)
@MustBeDocumented
public annotation class Tag(val ref: String)

```

### Core Architecture Module: `compiler/kodein-resolver-processor/src/main/kotlin/org/kodein/di/resolver/KodeinProcessor.kt`
```
package org.kodein.di.resolver

import com.google.devtools.ksp.processing.CodeGenerator
import com.google.devtools.ksp.processing.Dependencies
import com.google.devtools.ksp.processing.KSPLogger
import com.google.devtools.ksp.processing.Resolver
import com.google.devtools.ksp.processing.SymbolProcessor
import com.google.devtools.ksp.symbol.ClassKind
import com.google.devtools.ksp.symbol.KSAnnotated
import com.google.devtools.ksp.symbol.KSClassDeclaration
import com.google.devtools.ksp.validate
import com.squareup.kotlinpoet.FileSpec
import com.squareup.kotlinpoet.ksp.writeTo
import org.kodein.di.resolver.visitor.DIResolverGenerator

public class KodeinProcessor(
    private val codeGenerator: CodeGenerator,
    private val logger: KSPLogger,
) : SymbolProcessor {
    override fun process(resolver: Resolver): List<KSAnnotated> = try {
        resolver.getSymbolsWithAnnotation(Names.Resolved.canonicalName)
            .filterIsInstance<KSClassDeclaration>()
            .filterNot { processClass(it, resolver) }
            .toList()
    } catch (e: IllegalStateException) {
        logger.error("Kodein Resolver: ${e.message}")
        emptyList()
    }

    private fun processClass(classDeclaration: KSClassDeclaration, resolver: Resolver): Boolean {
        if (!classDeclaration.validate()) return false
        if (classDeclaration.classKind != ClassKind.INTERFACE)
            error("${classDeclaration.simpleName.asString()} must be and interface to be annoted with @${Names.Resolved}.")

        // Handle DI resolver class generation
        val (resolverGeneratedClassName, diResolver, creatorFun) =
            classDeclaration.accept(DIResolverGenerator(resolver), Unit)

        val gFile = FileSpec.builder(classDeclaration.packageName.asString(), resolverGeneratedClassName)
            .addImport(Names.diPackageName, "DI", "direct", "instance", "hasFactory")
            .addType(diResolver)

        gFile.addFunction(creatorFun)

        gFile.build().writeTo(codeGenerator, Dependencies(aggregating = false))

        return true
    }
}

```

### Core Architecture Module: `compiler/kodein-resolver-processor/src/main/kotlin/org/kodein/di/resolver/KodeinProcessorProvider.kt`
```
package org.kodein.di.resolver

import com.google.devtools.ksp.processing.SymbolProcessor
import com.google.devtools.ksp.processing.SymbolProcessorEnvironment
import com.google.devtools.ksp.processing.SymbolProcessorProvider

public class KodeinProcessorProvider : SymbolProcessorProvider {
    override fun create(environment: SymbolProcessorEnvironment): SymbolProcessor =
        KodeinProcessor(
            codeGenerator = environment.codeGenerator,
            logger = environment.logger,
        )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #513** (2026-07-21): **fix(#508): handle NoClassDefFoundError during JSR-330 injection**
  *Symptoms*: Skip class hierarchy levels that reference types absent at runtime, allowing injection to continue up the chain. Logs a WARNING when a level is skipped.  This fixes injection on Android devices where a compiled app may reference platform types that don't exist at runtime (e.g., ComponentActivity below API 31 referencing PictureInPictureUiState from androidx.activity 1.13.0+).

- **Issue #512** (2026-07-19): **The documentation website is not working.**
  *Symptoms*: https://kosi-libs.org/kodein/
  **Post-Mortem & Fix Analysis**:
  > Any updates? 
  > Wow thanks, I'll look into this ASAP!
  > It is live again. Sorry 😔 

- **Issue #511** (2026-07-21): **fix(#508): tolerate unresolvable member types during reflective injection**
  *Symptoms*: ## Problem  Injecting into any subclass of `ComponentActivity` crashes with `java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState` on Android devices running below API 31. `PictureInPictureUiState` was introduced in API 31, and the failure started appearing after upgrading `androidx.activity:activity` from `1.12.4` to `1.13.0`.  ``` java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState;     at java.lang.reflect.Executable.getParameterTypesInternal(...)     at java.lang.reflect.Method.getParameterTypes(...)     at java.lang.Class.getDeclaredMethods(...)     at org.kodein.di.jxinject.internal.JxInjectorContainer.fillMembersSetters(...) ```  ## Root cause  As diagnosed in #508, `fillMembersSetters` enumerates each class in the receiver's hierarchy with `cls.declaredFields` and `cls.declaredMethods`. Both `Class.getDeclaredMethods()` and `Class.getDeclaredFields()` **eagerly resolve the types referenced by every member's signature**. When a member references a type that is absent at runtime — here a platform class from a newer API level than the device provides — the whole enumeration throws `NoClassDefFoundError` before we can inspect any individual member, even though the offending member is not annotated with `@Inject`.  The reporter confirmed `cls.declaredMethods` is the trigger and noted `cls.declaredFields` could fail the same way under other circumstances. A Google engineer replying on the correspon
  **Post-Mortem & Fix Analysis**:
  > Thanks 🙏 , based on what you suggested I've done things slightly different [here](https://github.com/kosi-libs/Kodein/pull/513)

- **Issue #510** (2026-07-19): **Regenerate Kotlin/JS yarn.lock for Kotlin 2.4.0**
  *Symptoms*: ## Summary - Regenerates `kotlin-js-store/yarn.lock` (and removes the now-unused `kotlin-js-store/wasm/yarn.lock`) to sync with the internal Kodein Gradle plugin 9.2.0 / Kotlin 2.4.0 already pinned in `settings.gradle.kts`. - Part of a coordinated lockfile-sync update across kosi-libs projects — mirrors the fix already applied in the sibling `Canard` project, which hit CI failures on `:kotlinStoreYarnLock` with "Lock file was changed. Run the `kotlinUpgradeYarnLock` task to actualize lock file". - Verified locally by re-running `kotlinUpgradeYarnLock` / `kotlinWasmUpgradeYarnLock` — both report the lockfile as up to date (no diff after regeneration), and the JS/Wasm yarn-lock tasks all report `UP-TO-DATE`/`SKIPPED` with no "Lock file was changed" error during `./gradlew check`.  ## Test plan - [ ] CI (`check` workflow — unit-tests / check-with-android) passes with no yarn/lockfile-staleness errors

- **Issue #508** (2026-07-21): **Unavoidable exception when injecting into latest androidx ComponentActivity**
  *Symptoms*: When trying to inject into any subclass of `ComponentActivity`, we see a `java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState` on Android devices lower than API 31. The `PictureInPictureUiState` class was added in API 31, and it seems that a call to `getDeclaredMethods` triggers attempted access to this class.  We only began seeing this issue after upgrading `androidx.activity:activity` from `1.12.4` to `1.13.0` and I initially assumed it was an issue with the new Activity library version because this part of Kodein hasn't changed since 2017, however an engineer at Google responded to an issue report and said that callers need to be more lenient: https://issuetracker.google.com/issues/492945630#comment4  Relevant part of the stack trace: ``` java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState;     at java.lang.reflect.Executable.getParameterTypesInternal(...)     at java.lang.reflect.Method.getParameterTypes(...)     at java.lang.Class.getDeclaredMethods(...)     at org.kodein.di.jxinject.internal.JxInjectorContainer.fillMembersSetters(...) ```  I did some digging and found there are two `fillSetters` calls in JxInjectorContainer.kt (see: https://github.com/kosi-libs/Kodein/blob/v7.32.0/kodein-di-jxinject-jvm/src/main/kotlin/org/kodein/di/jxinject/internal/JxInjectorContainer.kt#L157-L176) that may need to become more lenient: - the first `fillSetters` call passes in `cls.declaredFields` (this may o
  **Post-Mortem & Fix Analysis**:
  > fixed in https://github.com/kosi-libs/Kodein/releases/tag/v7.33.0.   Just curious, why don't you use android specific Kodein modules?
  > @romainbsl that decision was made before my time here, but my understanding is our app introduced Kodein a long time ago (either 2017 or 2018) and it was implemented behind an abstraction that hides which DI framework is being used, so JSR-330 injection is used as a way to avoid having Kodein-specific code throughout the codebase.  Your caution note is interesting, I was not aware we are paying a perf penalty by using JSR-330 on all our legacy Activity/Fragment injections. We have more than 100 such calls, sounds like I might need to investigate further.  Thank you for the fix! 🙏

- **Issue #507** (2026-03-25): **fix((#506): update KodeinViewModelScopedFactory and KodeinViewModelScopedSingleton to use generic types**
  *Symptoms*: This pull request refactors how ViewModel factories are created and used with Kodein DI in both Android and multiplatform Compose modules. The main focus is to ensure that the correct type information for ViewModels is passed explicitly, improving type safety and reliability. It also introduces deprecation warnings for older factory constructors and marks the main factory classes as internal.  **Key changes:**  ### Type Safety and Factory Construction  * Both `KodeinViewModelScopedFactory` and `KodeinViewModelScopedSingleton` now require an explicit `vmType` (`TypeToken<*>`) parameter, ensuring the correct ViewModel type is used for DI resolution. Previous usage of `erased(modelClass)` is replaced with `generic<VM>()` for better type inference. [[1]](diffhunk://#diff-5ef990178895d1b21fa47a664d53b94c5fe30d35ff2978466b41ba9b0f214400L11-R55) [[2]](diffhunk://#diff-ab140d128ab8cf8de08e23934c99a426e56aec10730afd826bed92b1f8adf43fL12-R56) * All usages of these factories in Compose utility functions (`rememberViewModel`, `viewModel`, and navigation-scoped ViewModel providers) have been updated to pass the explicit `vmType` parameter using `generic<VM>()`. [[1]](diffhunk://#diff-f60f5df3bae74d76ff85c13a0493ab86c2372f3b54a5f6839a8c273c342543e9L35-R35) [[2]](diffhunk://#diff-f60f5df3bae74d76ff85c13a0493ab86c2372f3b54a5f6839a8c273c342543e9L64-R64) [[3]](diffhunk://#diff-f60f5df3bae74d76ff85c13a0493ab86c2372f3b54a5f6839a8c273c342543e9L102-R103) [[4]](diffhunk://#diff-f60f5df3bae74

- **Issue #506** (2026-03-25): **Compose rememberViewModel can crash with generic ViewModel bounds (Cannot create TypeToken for non fully reified type)**
  *Symptoms*: ### Describe the bug When using `org.kodein.di.compose.viewmodel.rememberViewModel` with a generic `ViewModel` subclass, runtime lookup will crash with:  `IllegalArgumentException: Cannot create TypeToken for non fully reified type ...`  In our case this happens with FlowMVI's `ContainerViewModel<T, S, I, A>` (`pro.respawn.flowmvi.android.ContainerViewModel`).  ### Stacktrace ```text java.lang.IllegalArgumentException: Cannot create TypeToken for non fully reified type pro.respawn.flowmvi.api.Container<S, I, A>     at org.kodein.type.TypeTokensJVMKt.typeToken(typeTokensJVM.kt:101)     at org.kodein.type.JVMClassTypeToken.getGenericParameters(JVMClassTypeToken.kt:10)     at org.kodein.type.AbstractTypeToken.equals(TypeToken.kt:117)     at org.kodein.type.AbstractTypeToken.isAssignableFrom(TypeToken.kt:86)     at org.kodein.di.internal.TypeChecker$Up.check(DITreeImpl.kt:18)     ...     at org.kodein.di.compose.viewmodel.KodeinViewModelScopedSingleton.create(KodeinViewModelScope.kt:44) ```  ### Reproduction 1. Bind a generic ViewModel in DI (example with FlowMVI): ```kotlin  bind<ContainerViewModel<MyContainer, MyState, MyIntent, MyAction>>() with provider {     ContainerViewModel(MyContainer(...)) } ``` Here all functions used are inline and parameters reified (so the error message will be misleading)  2. Resolve it from compose:  ```kotlin val vm by rememberViewModel<ContainerViewModel<MyContainer, MyState, MyIntent, MyAction>>() ```  in this function, the ContainerViewModel i
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/kosi-libs/Kodein/releases/tag/v7.32.0  Let me know if that's ok for you.

- **Issue #505** (2026-03-23): **fix((#504): bring back scope on SetBinder and ArgSetBinder**
  *Symptoms*: 

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

### Incident Patch 1: `4c2a4813` (2026-07-21)
**Commit Message**: fix(#508): handle NoClassDefFoundError during JSR-330 injection (#513)

Skip class hierarchy levels that reference types absent at runtime, allowing
injection to continue up the chain. Logs a WARNING when a level is skipped.

This fixes injection on Android devices where a compiled app may reference
platform types that don't exist at runtime (e.g., ComponentActivity below API 31
referencing PictureInPictureUiState from androidx.activity 1.13.0+).

**File**: `CHANGELOG.md` (modified, +23/-1)
```diff
@@ -1,4 +1,26 @@
-#### 7.30.0 (TBD)
+#### 7.33.0 (TBD)
+
+## What's Changed
+* **Fixed `NoClassDefFoundError` during JSR-330 injection** (#508):
+    * Injecting into a class whose hierarchy declares a member referencing a type absent at runtime no longer fails
+    * Notably affected any `ComponentActivity` subclass below API 31 since `androidx.activity` 1.13.0, which declares `onPictureInPictureUiStateChanged(android.app.PictureInPictureUiState)` (an API 31 type)
+    * Such a class level is now skipped and injection continues up the hierarchy; documented in the JSR-330 page
+    * The skip is reported as a `WARNING` on the `org.kodein.di.jxinject` `java.util.logging` logger (logcat tag `org.kodein.di.jxinject` on Android), silenceable with `org.kodein.di.jxinject.level = OFF`
+* Kotlin 2.4.0 / KIGP 9.2.0 / Kaverit 2.13.0 / Gradle 9.3.1 / Compose 1.10.3
+* Migrated the Android Compose namespace to the target API
+
+#### 7.32.0 (2026-03-25)
+
+## What's Changed
+* Fixed `KodeinViewModelScopedFactory` and `KodeinViewModelScopedSingleton` to use generic types (#506)
+* Brought back scope on `SetBinder` and `ArgSetBinder` (#504)
+
+#### 7.31.0 (2026-02-08)
+
+## What's Changed
+* Upgraded Ktor dependency from 3.3.2 to 3.4.0 (#503)
+
+#### 7.30.0 (2025-11-20)
 
 ## What's Changed
 * Fixed DSL receiver scope issue (#478): Applied `@DslMarker` to DSL receiver interfaces to prevent accidental calls to outer receiver methods
```

**File**: `doc/modules/extension/pages/jsr330.adoc` (modified, +39/-0)
```diff
@@ -17,6 +17,45 @@ CAUTION: Every-thing that is described here is *a lot less performant* than usin
          Kittens *will* die painfully if you do!
 
 
+[[hierarchy]]
+== What gets visited
+
+`inject` does not look at the receiver's class alone: it walks the *entire* class hierarchy up to `Object` and enumerates every declared field and method of each level, looking for those annotated with `@Inject`.
+
+Two consequences are worth knowing:
+
+- The cost grows with inheritance depth, including superclasses you do not own.
+- A class level whose members cannot be introspected is *skipped*, and injection continues with the rest of the hierarchy.
+  This happens when a member's signature references a type that is absent at run-time, whether or not that member is annotated with `@Inject`.
+  An `@Inject` member on such a level is not injected, and no exception is raised.
+
+The typical case is Android, where a framework class compiled against a recent SDK may reference a platform type that does not exist on the device's API level.
+
+Because the failure is precisely the inability to enumerate members, Kodein-DI cannot know whether the skipped level declared any `@Inject` member.
+It therefore logs a `WARNING` on the `org.kodein.di.jxinject` logger, using `java.util.logging`:
+
+[source]
+----
+WARNING: Could not introspect the methods of androidx.activity.ComponentActivity: any @Inject member it
+declares will NOT be injected. This usually means a member signature references a type that is absent at
+runtime.
+----
+
+On Android this reaches logcat as a `WARN` entry tagged `org.kodein.di.jxinject`.
+
+If the skipped level is a framework class you do not own, the warning is expected and there is nothing to fix; you can silence it through the standard `java.util.logging` configuration.
+
+[source,properties]
+.Example: silencing the warning
+----
+org.kodein.di.jxinject.level = OFF
+----
+
+CAUTION: On Android, do not use JSR-330 injection on framework components (`Activity`, `Fragment`, `Service`...).
+         Their hierarchy is deep and entirely outside of your control, so every injection pays to walk it and is subject to the behaviour described above.
+         Use Kodein-DI's standard retrieval instead (`by instance()`), which uses no member reflexivity at all: see xref:framework:android.adoc[Android].
+
+
 [[install]]
 == Install
 
```

**File**: `kodein-di-jxinject-jvm/src/main/kotlin/org/kodein/di/jxinject/internal/JxInjectorContainer.kt` (modified, +38/-2)
```diff
@@ -7,10 +7,23 @@ import org.kodein.type.typeToken
 import java.lang.reflect.*
 import java.util.*
 import java.util.concurrent.ConcurrentHashMap
+import java.util.logging.Level
+import java.util.logging.Logger
 import javax.inject.Inject
 import javax.inject.Provider
 
 internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
+    internal companion object {
+        /**
+         * Deliberately a literal rather than this class' name: [JxInjectorContainer] is internal and its FQN is an
+         * implementation detail, whereas this name is documented for users to configure. It is also 22 characters, so
+         * Android's `AndroidHandler` uses it verbatim as the logcat tag (it truncates anything longer than 23).
+         */
+        private const val LOGGER_NAME: String = "org.kodein.di.jxinject"
+
+        private val logger: Logger = Logger.getLogger(LOGGER_NAME)
+    }
+
     internal class Qualifier(val cls: Class<out Annotation>, val tagProvider: (Annotation) -> Any)
 
     private val _qualifiers = qualifiers.associate { it.cls to it.tagProvider }
@@ -138,6 +151,29 @@ internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
             }
     }
 
+    /**
+     * Enumerating declared members eagerly resolves the types referenced by every member's signature, whether or not
+     * that member is annotated with [Inject]. A signature referencing a type that is absent at runtime therefore makes
+     * the whole enumeration fail. This happens on Android, where a class compiled against a recent SDK may reference a
+     * platform type that does not exist on an older device (see https://github.com/kosi-libs/Kodein/issues/508).
+     *
+     * Such a level is skipped and the walk up the hierarchy continues. Because the failure *is* the inability to
+     * enumerate, we cannot know whether the level declared any [Inject] member, so this is reported as a possibility
+     * rather than as a fact.
+     */
+    private inline fun <reified M> declaredMembersOrEmpty(cls: Class<*>, kind: String, members: () -> Array<M>): Array<M> =
+        try {
+            members()
+        } catch (error: LinkageError) {
+            logger.log(
+                Level.WARNING,
+                "Could not introspect the $kind of ${cls.name}: any @Inject member it declares will NOT be injected. " +
+                    "This usually means a member signature references a type that is absent at runtime.",
+                error
+            )
+            emptyArray()
+        }
+
     private tailrec fun fillMembersSetters(cls: Class<*>, setters: MutableList<DirectDI.(Any) -> Any>) {
         if (cls == Any::class.java)
             return
@@ -155,7 +191,7 @@ internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
         }
 
         fillSetters(
-            members = cls.declaredFields,
+            members = declaredMembersOrEmpty(cls, "fields") { cls.declaredFields },
             elements = { arrayOf(FieldElement(this)) },
             call = { receiver, values -> set(receiver, values[0]) },
             setters = setters
@@ -169,7 +205,7 @@ internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
         }
 
         fillSetters(
-            members = cls.declaredMethods,
+            members = declaredMembersOrEmpty(cls, "methods") { cls.declaredMethods },
             elements = { (0 until parameterTypes.size).map { ParameterElement(this, it) }.toTypedArray() },
             call = { receiver, values -> invoke(receiver, *values) },
             setters = setters
```

**File**: `kodein-di-jxinject-jvm/src/test/java/org/kodein/di/jxinject/InjectJvmTests_05_LenientReflection.java` (added, +221/-0)
```diff
@@ -0,0 +1,221 @@
+package org.kodein.di.jxinject;
+
+import org.junit.FixMethodOrder;
+import org.junit.Test;
+import org.junit.runners.MethodSorters;
+
+import javax.inject.Inject;
+import java.io.ByteArrayOutputStream;
+import java.io.IOException;
+import java.io.InputStream;
+import java.lang.reflect.Constructor;
+import java.lang.reflect.Field;
+import java.util.ArrayList;
+import java.util.Arrays;
+import java.util.HashSet;
+import java.util.List;
+import java.util.Set;
+import java.util.logging.Handler;
+import java.util.logging.Level;
+import java.util.logging.LogRecord;
+import java.util.logging.Logger;
+
+import static org.junit.Assert.*;
+
+/**
+ * Regression tests for https://github.com/kosi-libs/Kodein/issues/508
+ *
+ * On Android, an app compiles against a recent SDK but runs against the device's framework. A class
+ * introduced in API 31 such as {@code android.app.PictureInPictureUiState} is simply absent at runtime on an
+ * API 30 device. That is normally harmless, because ART only fails when such a method is actually executed.
+ * Reflection defeats that leniency: {@code getDeclaredMethods()} / {@code getDeclaredFields()} eagerly resolve
+ * the types in every member's signature, so a single unresolvable type makes the whole enumeration throw
+ * {@link NoClassDefFoundError} -- even for members that carry no {@code @Inject} annotation.
+ *
+ * Since androidx.activity 1.13.0, {@code ComponentActivity} declares
+ * {@code onPictureInPictureUiStateChanged(android.app.PictureInPictureUiState)} directly, so walking the
+ * superclass chain of any Activity hits exactly that.
+ *
+ * These tests reproduce the failure on a plain JVM with a class loader that refuses to resolve one type.
+ */
+@FixMethodOrder(MethodSorters.NAME_ASCENDING)
+public class InjectJvmTests_05_LenientReflection {
+
+    /** Loads {@code reloaded} classes itself, refuses to resolve {@code hidden}, delegates everything else. */
+    private static final class HidingClassLoader extends ClassLoader {
+        private final String hidden;
+        private final Set<String> reloaded;
+
+        HidingClassLoader(ClassLoader parent, String hidden, String... reloaded) {
+            super(parent);
+            this.hidden = hidden;
+            this.reloaded = new HashSet<>(Arrays.asList(reloaded));
+        }
+
+        @Override
+        protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
+            if (name.equals(hidden))
+                throw new ClassNotFoundException(name + " does not exist at runtime (mimics an API level too low)");
+
+            synchronized (getClassLoadingLock(name)) {
+                Class<?> cls = findLoadedClass(name);
+                if (cls == null) {
+                    if (reloaded.contains(name)) {
+                        byte[] bytes = readBytecode(name);
+                        cls = defineClass(name, bytes, 0, bytes.length);
+                    } else {
+                        cls = getParent().loadClass(name);
+                    }
+                }
+                if (resolve) resolveClass(cls);
+                return cls;
+            }
+        }
+
+        private byte[] readBytecode(String name) throws ClassNotFoundException {
+            String path = name.replace('.', '/') + ".class";
+            try (InputStream in = getParent().getResourceAsStream(path)) {
+                if (in == null) throw new ClassNotFoundException(name);
+                ByteArrayOutputStream out = new ByteArrayOutputStream();
+                byte[] buffer = new byte[8192];
+                int read;
+                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
+                return out.toByteArray();
+            } catch (IOException e) {
+                throw new ClassNotFoundException(name, e);
+            }
+        }
+    }
+
+    private static final String MISSING = "org.kodein.di.jxinject.LenientMissing";
+    private static final String METHOD_BASE = "org.kodein.di.jxinject.LenientMethodBase";
+    private static final String METHOD_SUB = "org.kodein.di.jxinject.LenientMethodSub";
+    private static final String FIELD_BASE = "org.kodein.di.jxinject.LenientFieldBase";
+    private static final String FIELD_SUB = "org.kodein.di.jxinject.LenientFieldSub";
+
+    private static Class<?> loadHiding(String name) throws Exception {
+        ClassLoader loader = new HidingClassLoader(
+                InjectJvmTests_05_LenientReflection.class.getClassLoader(),
+                MISSING,
+                METHOD_BASE, METHOD_SUB, FIELD_BASE, FIELD_SUB
+        );
+        return loader.loadClass(name);
+    }
+
+    /** These classes are package-private but loaded by another loader, so they land in a different runtime package. */
+    private static Object instantiate(String name) throws Exception {
+        Constructor<?> constructor = loadHiding(name).getDeclaredConstructor();
+        constructor.setAccessible(true);
+     
```

---

### Incident Patch 2: `ba2ffa38` (2026-03-25)
**Commit Message**: fix((#506): update KodeinViewModelScopedFactory and KodeinViewModelScopedSingleton to use generic types (#507)

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/KodeinViewModelScopedFactory.kt` (modified, +31/-3)
```diff
@@ -8,20 +8,48 @@ import org.kodein.di.direct
 import org.kodein.type.TypeToken
 import org.kodein.type.erased
 
-public class KodeinViewModelScopedFactory<A : Any>(
+@PublishedApi
+internal class KodeinViewModelScopedFactory<A : Any>(
     private val di: DI,
     private val argType: TypeToken<A>,
+    private val vmType: TypeToken<*>,
     private val arg: A,
     private val tag: String? = null,
 ) : ViewModelProvider.Factory {
+    @Suppress("UNCHECKED_CAST")
     override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
-            di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
+            di.direct.Factory(argType, vmType as TypeToken<T>, tag).invoke(arg)
 }
 
-public class KodeinViewModelScopedSingleton(
+@PublishedApi
+internal class KodeinViewModelScopedSingleton(
     private val di: DI,
+    private val vmType: TypeToken<*>,
     private val tag: String? = null,
 ) : ViewModelProvider.Factory {
+    @Suppress("UNCHECKED_CAST")
+    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
+        di.direct.Instance(type = vmType as TypeToken<T>, tag = tag)
+}
+
+@Deprecated("Use rememberViewModel instead.", level = DeprecationLevel.WARNING)
+@Suppress("FunctionName")
+public fun KodeinViewModelScopedSingleton(
+    di: DI,
+    tag: String? = null,
+): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
     override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
         di.direct.Instance(type = erased(modelClass), tag = tag)
 }
+
+@Deprecated("Use rememberViewModel instead.", level = DeprecationLevel.WARNING)
+@Suppress("FunctionName")
+public fun <A : Any> KodeinViewModelScopedFactory(
+    di: DI,
+    argType: TypeToken<A>,
+    arg: A,
+    tag: String? = null,
+): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
+    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
+        di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
+}
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/navigation/navGraphViewModel.kt` (modified, +9/-7)
```diff
@@ -8,9 +8,9 @@ import androidx.lifecycle.ViewModelProvider
 import androidx.navigation.NavBackStackEntry
 import androidx.navigation.NavHostController
 import org.kodein.di.compose.localDI
-import org.kodein.di.compose.viewmodel.KodeinViewModelScopedFactory
-import org.kodein.di.compose.viewmodel.KodeinViewModelScopedSingleton
-import org.kodein.type.erased
+import org.kodein.di.compose.android.KodeinViewModelScopedFactory
+import org.kodein.di.compose.android.KodeinViewModelScopedSingleton
+import org.kodein.type.generic
 
 /**
  * Gets an instance of a [VM] as an android [ViewModel], scoped on a [NavGraph], for the given [tag].
@@ -32,7 +32,7 @@ public inline fun <reified VM : ViewModel> NavBackStackEntry.rememberNavGraphVie
         ViewModelLazy(
             viewModelClass = VM::class,
             storeProducer = { navHostController.getBackStackEntry(getParentId()).viewModelStore },
-            factoryProducer = { KodeinViewModelScopedSingleton(di = this, tag = tag) }
+            factoryProducer = { KodeinViewModelScopedSingleton(di = this, vmType = generic<VM>(), tag = tag) }
         )
     }
 }
@@ -61,7 +61,7 @@ public inline fun <reified VM : ViewModel> NavBackStackEntry.navGraphViewModel(
     remember(this@navGraphViewModel, di, tag) {
         val provider = ViewModelProvider(
             navHostController.getBackStackEntry(getParentId()).viewModelStore,
-            KodeinViewModelScopedSingleton(di = di, tag = tag)
+            KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag)
         )
         if (tag == null) {
             provider[VM::class.java]
@@ -99,7 +99,8 @@ public inline fun <reified A : Any, reified VM : ViewModel> NavBackStackEntry.re
             factoryProducer = {
                 KodeinViewModelScopedFactory(
                     di = di,
-                    argType = erased<A>(),
+                    argType = generic<A>(),
+                    vmType = generic<VM>(),
                     arg = arg,
                     tag = tag,
                 )
@@ -139,7 +140,8 @@ public inline fun <reified A : Any, reified VM : ViewModel> NavBackStackEntry.na
             navHostController.getBackStackEntry(getParentId()).viewModelStore,
             KodeinViewModelScopedFactory(
                 di = di,
-                argType = erased<A>(),
+                argType = generic<A>(),
+                vmType = generic<VM>(),
                 arg = arg,
                 tag = tag,
             )
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/viewModel.kt` (modified, +4/-3)
```diff
@@ -31,7 +31,7 @@ public inline fun <reified VM : ViewModel> rememberViewModel(
         ViewModelLazy(
             viewModelClass = VM::class,
             storeProducer = { viewModelStoreOwner.viewModelStore },
-            factoryProducer = { KodeinViewModelScopedSingleton(di = di, tag = tag) },
+            factoryProducer = { KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag) },
         )
     }
 }
@@ -63,7 +63,7 @@ public inline fun <reified VM : ViewModel> viewModel(
     remember {
         val provider = ViewModelProvider(
             viewModelStoreOwner,
-            KodeinViewModelScopedSingleton(di = di, tag = tag),
+            KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag),
         )
         if (tag == null) {
             provider[VM::class.java]
@@ -103,6 +103,7 @@ public inline fun <reified A : Any, reified VM : ViewModel> rememberViewModel(
                 KodeinViewModelScopedFactory(
                     di = di,
                     argType = generic<A>(),
+                    vmType = generic<VM>(),
                     arg = arg,
                     tag = tag,
                 )
@@ -142,7 +143,7 @@ public inline fun <reified A : Any, reified VM : ViewModel> viewModel(
     remember {
         val provider = ViewModelProvider(
             viewModelStoreOwner,
-            KodeinViewModelScopedFactory(di = di, argType = generic<A>(), arg = arg, tag = tag),
+            KodeinViewModelScopedFactory(di = di, argType = generic<A>(), vmType = generic<VM>(), arg = arg, tag = tag),
         )
         if (tag == null) {
             provider[VM::class.java]
```

**File**: `framework/compose/kodein-di-framework-compose/src/commonMain/kotlin/org.kodein.di.compose/viewmodel/KodeinViewModelScope.kt` (modified, +31/-20)
```diff
@@ -9,37 +9,48 @@ import org.kodein.type.TypeToken
 import org.kodein.type.erased
 import kotlin.reflect.KClass
 
-/**
- * Factory class for creating ViewModel instances using Kodein dependency injection.
- *
- * @param A The type of argument to be passed to the ViewModel constructor.
- * @property di The instance of the Kodein DI container.
- * @property argType The TypeToken of the argument type.
- * @property arg The argument value to be passed to the ViewModel constructor.
- * @property tag The optional tag to be used for resolving ViewModel instance from DI container.
- */
-public class KodeinViewModelScopedFactory<A : Any>(
+@PublishedApi
+internal class KodeinViewModelScopedFactory<A : Any>(
     private val di: DI,
     private val argType: TypeToken<A>,
+    private val vmType: TypeToken<*>,
     private val arg: A,
     private val tag: String? = null,
 ) : ViewModelProvider.Factory {
+    @Suppress("UNCHECKED_CAST")
     override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
-        di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
+        di.direct.Factory(argType, vmType as TypeToken<T>, tag).invoke(arg)
 }
 
-/**
- * Factory class used to create ViewModel instances with Kodein DI container
- * @param di The Kodein DI container instance
- * @param tag An optional tag to filter the bindings
- *
- * @throws DI.NotFoundException if ViewModel class binding is not found in the DI container
- * @see ViewModelProvider.Factory
- */
-public class KodeinViewModelScopedSingleton(
+@PublishedApi
+internal class KodeinViewModelScopedSingleton(
     private val di: DI,
+    private val vmType: TypeToken<*>,
     private val tag: String? = null,
 ) : ViewModelProvider.Factory {
+    @Suppress("UNCHECKED_CAST")
+    override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
+        di.direct.Instance(type = vmType as TypeToken<T>, tag = tag)
+}
+
+@Deprecated("Use rememberViewModel instead.", level = DeprecationLevel.WARNING)
+@Suppress("FunctionName")
+public fun KodeinViewModelScopedSingleton(
+    di: DI,
+    tag: String? = null,
+): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
     override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
         di.direct.Instance(type = erased(modelClass), tag = tag)
 }
+
+@Deprecated("Use rememberViewModel instead.", level = DeprecationLevel.WARNING)
+@Suppress("FunctionName")
+public fun <A : Any> KodeinViewModelScopedFactory(
+    di: DI,
+    argType: TypeToken<A>,
+    arg: A,
+    tag: String? = null,
+): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
+    override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
+        di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
+}
```

**File**: `framework/compose/kodein-di-framework-compose/src/commonMain/kotlin/org.kodein.di.compose/viewmodel/viewModel.kt` (modified, +2/-1)
```diff
@@ -29,7 +29,7 @@ public inline fun <reified VM : ViewModel> rememberViewModel(
         ViewModelLazy(
             viewModelClass = VM::class,
             storeProducer = { viewModelStoreOwner.viewModelStore },
-            factoryProducer = { KodeinViewModelScopedSingleton(di = di, tag = tag) }
+            factoryProducer = { KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag) }
         )
     }
 }
@@ -63,6 +63,7 @@ public inline fun <reified A : Any, reified VM : ViewModel> rememberViewModel(
                 KodeinViewModelScopedFactory(
                     di = di,
                     argType = generic<A>(),
+                    vmType = generic<VM>(),
                     arg = arg,
                     tag = tag
                 )
```

---

### Incident Patch 3: `07bc997f` (2026-03-23)
**Commit Message**: fix((#504): bring back scope on SetBinder and ArgSetBinder (#505)

**File**: `kodein-di/src/commonMain/kotlin/org/kodein/di/DI.kt` (modified, +2/-4)
```diff
@@ -304,8 +304,7 @@ public interface DI : DIAware {
         /**
          * Manage multiple bindings in a [Set]
          */
-        @DIDsl
-        public interface SetBinder<T : Any> : BindBuilder.WithScope<Any> {
+        public interface SetBinder<T : Any> {
 
             /**
              * Add a binding in the [Set] of type [T]
@@ -379,8 +378,7 @@ public interface DI : DIAware {
         /**
          * Manage multiple bindings, with type argument, in a [Set]
          */
-        @DIDsl
-        public interface ArgSetBinder<A : Any, T : Any> : BindBuilder.WithScope<Any> {
+        public interface ArgSetBinder<A : Any, T : Any> {
 
             /**
              * Add a binding in the [Set] of type [T]
```

**File**: `kodein-di/src/commonMain/kotlin/org/kodein/di/internal/DIBuilderImpl.kt` (modified, +6/-6)
```diff
@@ -87,9 +87,9 @@ internal open class DIBuilderImpl internal constructor(
         addSetBindingToContainer: Boolean = true,
     ) : DI.Builder.SetBinder<T> {
 
-        override val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
-        override val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
-        override val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
+        val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
+        val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
+        val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
 
         private val setBinding: BaseMultiBinding<*, *, T> by lazy {
             val setType = erasedComp(Set::class, setBindingType) as TypeToken<Set<T>>
@@ -161,9 +161,9 @@ internal open class DIBuilderImpl internal constructor(
         addSetBindingToContainer: Boolean = true,
     ) : DI.Builder.ArgSetBinder<A, T> {
 
-        override val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
-        override val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
-        override val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
+        val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
+        val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
+        val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
 
         private val setBinding: BaseMultiBinding<*, in A, out T> by lazy {
             val setType = erasedComp(Set::class, setBindingType) as TypeToken<Set<T>>
```

**File**: `kodein-di/src/commonTest/kotlin/org/kodein/di/Tests_13_Scope.kt` (modified, +66/-0)
```diff
@@ -440,4 +440,70 @@ class Tests_13_Scope {
         assertTrue(c.closed)
     }
 
+    @Test
+    fun test_18_ScopedSetBindingSingleton() {
+        val registries = mapOf("a" to SingleItemScopeRegistry(), "b" to SingleItemScopeRegistry())
+        val myScope = object : Scope<String> {
+            override fun getRegistry(context: String) = registries[context]!!
+        }
+
+        val di = DI {
+            bindSet<IPerson> {
+                add { scoped(myScope).singleton { Person("Salomon") } }
+                add { scoped(myScope).singleton { Person("Laila") } }
+            }
+        }
+
+        val personsA: Set<IPerson> by di.on(context = "a").instance()
+        val personsB: Set<IPerson> by di.on(context = "b").instance()
+
+        assertEquals(2, personsA.size)
+        assertEquals(2, personsB.size)
+
+        val personsA2: Set<IPerson> by di.on(context = "a").instance()
+        assertEquals(personsA, personsA2)
+
+        registries["a"]!!.clear()
+        val personsA3: Set<IPerson> by di.on(context = "a").instance()
+        assertTrue(personsA.none { a -> personsA3.any { b -> a === b } })
+    }
+
+    @Test
+    fun test_19_NonScopedSetBindingConvenienceMethods() {
+        val di = DI {
+            bindSet<IPerson> {
+                addSingleton { Person("Salomon") }
+                addProvider { Person("Laila") }
+                addInstance(Person("Mary"))
+            }
+        }
+
+        val persons: Set<IPerson> by di.instance()
+        assertEquals(3, persons.size)
+        assertTrue(Person("Salomon") in persons)
+        assertTrue(Person("Laila") in persons)
+        assertTrue(Person("Mary") in persons)
+    }
+
+    @Test
+    fun test_20_ScopedArgSetBindingMultiton() {
+        val registries = mapOf("a" to SingleItemScopeRegistry(), "b" to SingleItemScopeRegistry())
+        val myScope = object : Scope<String> {
+            override fun getRegistry(context: String) = registries[context]!!
+        }
+
+        val di = DI {
+            bindArgSet<String, IPerson> {
+                add { scoped(myScope).multiton { name: String -> Person(name) } }
+            }
+        }
+
+        val personsA: Set<IPerson> by di.on(context = "a").instance(arg = "Salomon")
+        assertEquals(1, personsA.size)
+        assertTrue(Person("Salomon") in personsA)
+
+        val personsA2: Set<IPerson> by di.on(context = "a").instance(arg = "Salomon")
+        assertEquals(personsA, personsA2)
+    }
+
 }
```

---

### Incident Patch 4: `f0945187` (2025-11-11)
**Commit Message**: Applied the @DIDsl annotation to relevant builder interfaces and add specific convenience functions to [Arg]SetBinder (#498)

**File**: `CHANGELOG.md` (modified, +5/-5)
```diff
@@ -2,10 +2,10 @@
 
 ## What's Changed
 * Fixed DSL receiver scope issue (#478): Applied `@DslMarker` to DSL receiver interfaces to prevent accidental calls to outer receiver methods
-* Added convenience methods to `SetBinder` and `ArgSetBinder` for cleaner syntax:
-  * `SetBinder`: `addSingleton()`, `addProvider()`, `addInstance()`
-  * `ArgSetBinder`: `addFactory()`, `addMultiton()`
-  * Example: `addSingleton { Foo() }` instead of `add { singleton { Foo() } }`
+* Added convenience methods for multi-binding:
+    * `add*` methods (set-only): `addSingleton`, `addProvider`, `addInstance`, `addFactory`, `addMultiton`
+    * `bind*` methods (set + container): `bindSingleton`, `bindProvider`, `bindInstance`, `bindFactory`, `bindMultiton`
+    * `bind*` methods support tag and overrides parameters for individual retrieval from container
 * Updated multi-binding documentation with new convenience methods examples
 
 #### 7.29.0 (2025-11-11)
@@ -265,7 +265,7 @@ We will re-enable it in 7.13.1 as soon as a new version of compiler plugin will
 #### 7.11.0 (2022-02-18)
 
   - CORE
-    * Documentation improvements (thanks to the contributors!).
+    * Documentation improvements (thanks to the contributors!).  
     * Deprecation cycle
   - COMPOSE
     * JB Compose 1.1.0 Alpha5
```

**File**: `doc/modules/core/pages/multi-binding.adoc` (modified, +84/-9)
```diff
@@ -19,13 +19,13 @@ To have multiple bindings in a set, you need to:
 ----
 val di = DI {
     bindSet<Configuration> { // <1>
-        add { provider { FooConfiguration() } } // <2>
+        add { provider{ FooConfiguration() } } // <2>
         bind { singleton { BarConfiguration() } } // <3>
     }
 }
 ----
 <1> Creating a set binding of `Configuration`.
-<2> adds a `Configuration` binding implementation.
+<2> adds a `Configuration` binding implementation using the convenience method.
 <3> adds a `Configuration` binding and attaches it to the DI container.
 
 [NOTE]
@@ -36,13 +36,67 @@ You can:
 * Add bindings to the same set in different modules if the set has been declared first.
 ====
 
+==== Convenience Methods
+
+_Kodein-DI_ provides two types of convenience methods for adding bindings to sets:
+
+===== add* Methods
+
+The `add*` methods add bindings only to the set:
+
+[source,kotlin]
+.Example using add* convenience methods.
+----
+val di = DI {
+    bindSet<Configuration> {
+        addSingleton { FooConfiguration() }   // <1>
+        addProvider { BarConfiguration() }    // <2>
+        addInstance(existingConfig)           // <3>
+    }
+}
+----
+<1> Adds a singleton binding to the set (equivalent to `add { singleton { FooConfiguration() } }`).
+<2> Adds a provider binding to the set (equivalent to `add { provider { BarConfiguration() } }`).
+<3> Adds an instance binding to the set (equivalent to `add { instance(existingConfig) }`).
+
+===== bind* Methods
+
+The `bind*` methods add bindings to both the set AND the DI container, allowing retrieval by tag:
+
+[source,kotlin]
+.Example using bind* convenience methods with tags.
+----
+val di = DI {
+    bindSet<Configuration> {
+        bindSingleton(tag = "foo") { FooConfiguration() }      // <1>
+        bindProvider(tag = "bar") { BarConfiguration() }       // <2>
+        bindInstance(tag = "existing", instance = existingConfig) // <3>
+    }
+}
+
+// Retrieve from set
+val allConfigs: Set<Configuration> by di.instance()
+
+// Also retrieve individually by tag
+val fooConfig: Configuration by di.instance(tag = "foo")
+val barConfig: Configuration by di.instance(tag = "bar")
+----
+<1> Adds a singleton to the set AND registers it in the container with tag "foo".
+<2> Adds a provider to the set AND registers it in the container with tag "bar".
+<3> Adds an instance to the set AND registers it in the container with tag "existing".
+
+[TIP]
+====
+Use `add*` methods when you only need set bindings. Use `bind*` methods when you want both set membership and individual retrieval by tag.
+====
+
 [source,kotlin]
 .Example creating a set of `Configuration` bindings and populates it from modules.
 ----
 val module1 by DI.Module {
     inBindSet<Configuration> {
-        add { provider { FooConfiguration() } } // <2>
-        add { singleton { BarConfiguration() } } // <2>
+        addProvider { FooConfiguration() } // <2>
+        addSingleton { BarConfiguration() } // <2>
     }
 }
 val di = DI {
@@ -51,22 +105,43 @@ val di = DI {
 }
 ----
 <1> Creating a set binding of `Configuration`.
-<2> add multiple `Configuration` binding implementation.
+<2> add multiple `Configuration` binding implementation using convenience methods.
 
 You can also bind multiple bindings with arguments (such as `factory` or `multiton`) in a set *as long as all bindings share the same argument type*.
 
 [source,kotlin]
-.Example creating a set of `Result` bindings.
+.Example creating a set of `Result` bindings with add* methods.
 ----
 val di = DI {
     bindArgSet<Query, Result> { // <1>
-        add { factory { q: Query -> Foo.query(q) } } // <2>
-        add { multiton { q: Query -> Bar.query(q) } } // <2>
+        addFactory { q: Query -> Foo.query(q) } // <2>
+        addMultiton { q: Query -> Bar.query(q) } // <3>
     }
 }
 ----
 <1> Creating an argument set binding of `Result` for arguments of type `Query`.
-<2> Binding multiple `Result` factories implementations.
+<2> Adds a factory binding using convenience method (equivalent to `add { factory { q: Query -> Foo.query(q) } }`).
+<3> Adds a multiton binding using convenience method (equivalent to `add { multiton { q: Query -> Bar.query(q) } }`).
+
+[source,kotlin]
+.Example using bind* methods with argument sets for tagged retrieval.
+----
+val di = DI {
+    bindArgSet<Query, Result> {
+        bindFactory(tag = "foo") { q: Query -> Foo.query(q) }     // <1>
+        bindMultiton(tag = "bar") { q: Query -> Bar.query(q) }    // <2>
+    }
+}
+
+// Retrieve from set
+val results: Set<Result> by di.instance(arg = Query("SELECT * FROM USER;"))
+
+// Also retrieve individually by tag
+val fooFactory: (Query) -> Result by di.factory(tag = "foo")
+val barMultiton: (Query) -> Result by di.factory(tag = "bar")
+----
+<1> Adds a factory to the set AND registers it in the container with tag "foo".
+<2> Adds a multiton to the set AND registers it in the container with tag "bar".
 
 === Retrieving from a Set
 
```

**File**: `kodein-di/src/commonMain/kotlin/org/kodein/di/DI.kt` (modified, +98/-2)
```diff
@@ -2,9 +2,12 @@
 
 package org.kodein.di
 
+import org.kodein.di.bindings.BindingDI
 import org.kodein.di.bindings.ContextTranslator
 import org.kodein.di.bindings.DIBinding
 import org.kodein.di.bindings.ExternalSource
+import org.kodein.di.bindings.NoArgBindingDI
+import org.kodein.di.bindings.RefMaker
 import org.kodein.di.bindings.Scope
 import org.kodein.di.internal.DIImpl
 import org.kodein.type.TypeToken
@@ -234,6 +237,7 @@ public interface DI : DIAware {
          *
          * @param T The type to bind.
          */
+        @DIDsl
         public interface TypeBinder<T : Any> {
 
             /**
@@ -248,6 +252,7 @@ public interface DI : DIAware {
         /**
          * Left part of the delegate-binding syntax (`delegate(tag)`).
          */
+        @DIDsl
         public abstract class DelegateBinder<T : Any> {
 
             /**
@@ -281,6 +286,7 @@ public interface DI : DIAware {
          * Left part of the constant-binding syntax (`constant(tag)`).
          *
          */
+        @DIDsl
         public interface ConstantBinder {
 
             /**
@@ -298,7 +304,8 @@ public interface DI : DIAware {
         /**
          * Manage multiple bindings in a [Set]
          */
-        public interface SetBinder<T : Any> {
+        @DIDsl
+        public interface SetBinder<T : Any> : BindBuilder.WithScope<Any> {
 
             /**
              * Add a binding in the [Set] of type [T]
@@ -315,12 +322,65 @@ public interface DI : DIAware {
              * @param createBinding The builder that should add binding in the set.
              */
             public fun bind(tag: Any? = null, overrides: Boolean? = null, createBinding: () -> DIBinding<*, *, out T>)
+
+            /**
+             * Adds a singleton binding to the set.
+             *
+             * @param ref The reference maker to use (defaults to strong reference if null).
+             * @param sync Whether the singleton should be thread-safe.
+             * @param creator The function that creates the singleton instance.
+             */
+            public fun addSingleton(ref: RefMaker? = null, sync: Boolean = true, creator: NoArgBindingDI<Any>.() -> T)
+
+            /**
+             * Adds a provider binding to the set.
+             *
+             * @param creator The function that creates a new instance each time.
+             */
+            public fun addProvider(creator: NoArgBindingDI<Any>.() -> T)
+
+            /**
+             * Adds an instance binding to the set.
+             *
+             * @param instance The instance to add.
+             */
+            public fun addInstance(instance: T)
+
+            /**
+             * Binds a singleton to both the set and the DI container.
+             *
+             * @param tag The tag to bind in the DI container.
+             * @param overrides Whether this bind must or must not override an existing binding.
+             * @param ref The reference maker to use (null for eager singleton).
+             * @param sync Whether the singleton should be thread-safe.
+             * @param creator The function that creates the singleton instance.
+             */
+            public fun bindSingleton(tag: Any? = null, overrides: Boolean? = null, ref: RefMaker? = null, sync: Boolean = true, creator: NoArgBindingDI<Any>.() -> T)
+
+            /**
+             * Binds a provider to both the set and the DI container.
+             *
+             * @param tag The tag to bind in the DI container.
+             * @param overrides Whether this bind must or must not override an existing binding.
+             * @param creator The function that creates a new instance each time.
+             */
+            public fun bindProvider(tag: Any? = null, overrides: Boolean? = null, creator: NoArgBindingDI<Any>.() -> T)
+
+            /**
+             * Binds an instance to both the set and the DI container.
+             *
+             * @param tag The tag to bind in the DI container.
+             * @param overrides Whether this bind must or must not override an existing binding.
+             * @param instance The instance to bind.
+             */
+            public fun bindInstance(tag: Any? = null, overrides: Boolean? = null, instance: T)
         }
 
         /**
          * Manage multiple bindings, with type argument, in a [Set]
          */
-        public interface ArgSetBinder<A : Any, T : Any> {
+        @DIDsl
+        public interface ArgSetBinder<A : Any, T : Any> : BindBuilder.WithScope<Any> {
 
             /**
              * Add a binding in the [Set] of type [T]
@@ -341,6 +401,42 @@ public interface DI : DIAware {
                 overrides: Boolean? = null,
                 createBinding: () -> DIBinding<*, in A, out T>,
             )
+
+            /**
+             * Adds a factory binding to the set.
+             *
+             * @param creator The function that creates a new instance each time with an argument.
+             */
+            public 
```

**File**: `kodein-di/src/commonMain/kotlin/org/kodein/di/internal/DIBuilderImpl.kt` (modified, +62/-8)
```diff
@@ -7,14 +7,20 @@ import org.kodein.di.DI
 import org.kodein.di.DirectDI
 import org.kodein.di.bindings.ArgSetBinding
 import org.kodein.di.bindings.BaseMultiBinding
+import org.kodein.di.bindings.BindingDI
 import org.kodein.di.bindings.ContextTranslator
 import org.kodein.di.bindings.DIBinding
 import org.kodein.di.bindings.ExternalSource
+import org.kodein.di.bindings.Factory
 import org.kodein.di.bindings.InstanceBinding
+import org.kodein.di.bindings.Multiton
+import org.kodein.di.bindings.NoArgBindingDI
 import org.kodein.di.bindings.NoScope
 import org.kodein.di.bindings.Provider
+import org.kodein.di.bindings.RefMaker
 import org.kodein.di.bindings.Scope
 import org.kodein.di.bindings.SetBinding
+import org.kodein.di.bindings.Singleton
 import org.kodein.type.TypeToken
 import org.kodein.type.erasedComp
 
@@ -42,7 +48,7 @@ internal open class DIBuilderImpl internal constructor(
         override infix fun <C : Any, A> with(binding: DIBinding<in C, in A, out T>) = containerBuilder.bind(
             DI.Key(binding.contextType, binding.argType, type, tag),
             binding,
-            moduleName,
+            this@DIBuilderImpl.moduleName,
             overrides
         )
     }
@@ -70,7 +76,7 @@ internal open class DIBuilderImpl internal constructor(
     inner class ConstantBinder internal constructor(private val _tag: Any, private val _overrides: Boolean?) :
         DI.Builder.ConstantBinder {
         override fun <T : Any> With(valueType: TypeToken<out T>, value: T) =
-            Bind(tag = _tag, overrides = _overrides, binding = InstanceBinding(valueType, value))
+            this@DIBuilderImpl.Bind(tag = _tag, overrides = _overrides, binding = InstanceBinding(valueType, value))
     }
 
     @Suppress("unchecked_cast")
@@ -81,19 +87,23 @@ internal open class DIBuilderImpl internal constructor(
         addSetBindingToContainer: Boolean = true,
     ) : DI.Builder.SetBinder<T> {
 
+        override val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
+        override val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
+        override val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
+
         private val setBinding: BaseMultiBinding<*, *, T> by lazy {
             val setType = erasedComp(Set::class, setBindingType) as TypeToken<Set<T>>
             val setKey = DI.Key(TypeToken.Any, TypeToken.Unit, setType, setBindingTag)
 
-            val setBinding = containerBuilder.bindingsMap[setKey]?.first()
+            val setBinding = this@DIBuilderImpl.containerBuilder.bindingsMap[setKey]?.first()
                 ?: throw IllegalStateException("No set binding to $setKey")
             setBinding.binding as? BaseMultiBinding<*, *, T>
                 ?: throw IllegalStateException("$setKey is associated to a ${setBinding.binding.factoryName()} while it should be associated with bindingSet")
         }
 
         init {
             if (addSetBindingToContainer) {
-                Bind(
+                this@DIBuilderImpl.Bind(
                     tag = setBindingTag,
                     overrides = setBindingOverrides,
                     binding = SetBinding(
@@ -114,7 +124,31 @@ internal open class DIBuilderImpl internal constructor(
             val binding = createBinding()
             (setBinding.set as MutableSet<DIBinding<*, *, *>>).add(binding)
 
-            Bind(tag = tag, overrides = overrides, binding = binding)
+            this@DIBuilderImpl.Bind(tag = tag, overrides = overrides, binding = binding)
+        }
+
+        override fun addSingleton(ref: RefMaker?, sync: Boolean, creator: NoArgBindingDI<Any>.() -> T) {
+            add { Singleton(scope, contextType, explicitContext, setBindingType, ref, sync, creator) }
+        }
+
+        override fun addProvider(creator: NoArgBindingDI<Any>.() -> T) {
+            add { Provider(contextType, setBindingType, creator) }
+        }
+
+        override fun addInstance(instance: T) {
+            add { InstanceBinding(setBindingType, instance) }
+        }
+
+        override fun bindSingleton(tag: Any?, overrides: Boolean?, ref: RefMaker?, sync: Boolean, creator: NoArgBindingDI<Any>.() -> T) {
+            bind(tag, overrides) { Singleton(scope, contextType, explicitContext, setBindingType, ref, sync, creator) }
+        }
+
+        override fun bindProvider(tag: Any?, overrides: Boolean?, creator: NoArgBindingDI<Any>.() -> T) {
+            bind(tag, overrides) { Provider(contextType, setBindingType, creator) }
+        }
+
+        override fun bindInstance(tag: Any?, overrides: Boolean?, instance: T) {
+            bind(tag, overrides) { InstanceBinding(setBindingType, instance) }
         }
     }
 
@@ -127,19 +161,23 @@ internal open class DIBuilderImpl internal constructor(
         addSetBindingToContainer: Boolean = true,
     ) : DI.Builder.ArgSetBinder<A, T> {
 
+        override val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
+        override v
```

**File**: `kodein-di/src/commonTest/kotlin/org/kodein/di/Tests_18_MultiBindings.kt` (modified, +161/-0)
```diff
@@ -349,4 +349,165 @@ class Tests_18_MultiBindings {
 
         assertSame(persons.last(), salomon)
     }
+
+    @Test
+    fun test_16_DslMarker_enforces_correct_receiver_scope() {
+        // Before the fix, code like this would compile but fail:
+        //   inBindSet<IPerson> { bindSingleton { Person("Wrong") } }
+        // where bindSingleton would incorrectly call DI.Builder.bindSingleton
+        // instead of SetBinder's method (which didn't exist).
+        //
+        // After the fix, only the correct SetBinder methods are in scope.
+
+        val di = DI {
+            bindSet<IPerson>()
+
+            inBindSet<IPerson> {
+                // These calls are now restricted to SetBinder's scope only.
+                // Attempting to call DI.Builder methods here will cause a compilation error.
+                add { singleton { Person("Salomon") } }
+                add { provider { Person("Laila") } }
+            }
+        }
+
+        val persons: Set<IPerson> by di.instance()
+
+        assertTrue(Person("Salomon") in persons)
+        assertTrue(Person("Laila") in persons)
+        assertEquals(2, persons.size)
+    }
+
+    @Test
+    fun test_17_MultiSet_with_add_convenience_methods() {
+        // Test the add* convenience methods for cleaner syntax
+        val di = DI {
+            bindSet<IPerson> {
+                addSingleton { Person("Salomon") }  // Instead of: add { singleton { Person("Salomon") } }
+                addProvider { Person("Laila") }     // Instead of: add { provider { Person("Laila") } }
+            }
+
+            bind<List<IPerson>>() with provider { instance<Set<IPerson>>().toList() }
+        }
+
+        val persons1: Set<IPerson> by di.instance()
+
+        assertTrue(Person("Salomon") in persons1)
+        assertTrue(Person("Laila") in persons1)
+
+        val persons2: Set<IPerson> by di.instance()
+
+        val salomon1 = persons1.first { it.name == "Salomon" }
+        val salomon2 = persons2.first { it.name == "Salomon" }
+
+        val laila1 = persons1.first { it.name == "Laila" }
+        val laila2 = persons2.first { it.name == "Laila" }
+
+        // Singleton should be the same instance
+        assertSame(salomon1, salomon2)
+        // Provider should create new instances
+        assertNotSame(laila1, laila2)
+
+        val list: List<IPerson> by di.instance()
+        assertEquals(persons1.toList(), list)
+    }
+
+    @Test
+    fun test_18_MultiSet_with_addInstance() {
+        val existingPerson = Person("Romain")
+
+        val di = DI {
+            bindSet<IPerson> {
+                addInstance(existingPerson)  // Instead of: add { instance(existingPerson) }
+                addSingleton { Person("Salomon") }
+            }
+        }
+
+        val persons: Set<IPerson> by di.instance()
+
+        assertTrue(existingPerson in persons)
+        assertTrue(Person("Salomon") in persons)
+        assertEquals(2, persons.size)
+
+        // Instance should be the exact same object
+        assertSame(existingPerson, persons.first { it.name == "Romain" })
+    }
+
+    @Test
+    fun test_19_MultiSetWithArg_with_add_convenience_methods() {
+        // Test addFactory and addMultiton convenience methods
+        val di = DI {
+            bindArgSet<String, IPerson> {
+                addFactory { lastName: String -> Person("Salomon $lastName") }  // Instead of: add { factory { ... } }
+                addMultiton { lastName: String -> Person("Laila $lastName") }   // Instead of: add { multiton { ... } }
+            }
+        }
+
+        val persons1: Set<IPerson> by di.instance(arg = "BRYS")
+        assertTrue(Person("Salomon BRYS") in persons1)
+        assertTrue(Person("Laila BRYS") in persons1)
+
+        val persons2: Set<IPerson> by di.instance(arg = "BRYS")
+
+        val salomon1 = persons1.first { it.name == "Salomon BRYS" }
+        val salomon2 = persons2.first { it.name == "Salomon BRYS" }
+
+        val laila1 = persons1.first { it.name == "Laila BRYS" }
+        val laila2 = persons2.first { it.name == "Laila BRYS" }
+
+        // Factory should create new instances
+        assertNotSame(salomon1, salomon2)
+        // Multiton should cache per argument
+        assertSame(laila1, laila2)
+    }
+
+    @Test
+    fun test_20_MultiSet_with_bind_convenience_methods() {
+        // Test bind* methods that add to both set AND container
+        val existingPerson = Person("Romain")
+        val di = DI {
+            bindSet<IPerson> {
+                bindInstance(tag = "romain", instance = existingPerson)
+                bindSingleton(tag = "salomon") { Person("Salomon") }
+                bindProvider(tag = "laila") { Person("Laila") }
+            }
+
+            bindArgSet<String, IPerson> {
+                bindFactory(tag = "withLastName") { lastName: String -> Person("Factory $lastName") }
+                bindMultiton(tag = "cachedPerson") { lastName: String -> Person("Cached $lastName") }
+            }
+   
```

---

### Incident Patch 5: `bf481fc2` (2025-09-25)
**Commit Message**: fix: exclude Compose Multiplatform tests

**File**: `test-utils/build.gradle.kts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 plugins {
-    kodein.library.mpp
+    kodein.mpp
 }
 
 kotlin.kodein {
```

---

### Incident Patch 6: `21bbfec6` (2025-05-04)
**Commit Message**: fix: downgrade Kotlin to 2.1.20

**File**: `README.md` (modified, +9/-8)
```diff
@@ -80,14 +80,15 @@ kotlin {
 Kotlin & JVM compatibility
 ---------
 
-|   Kodein    | Kotlin |   JDK   |
-|:-----------:|:------:|:-------:|
-|   7.22      | 2.0.+  | min 11  |
-|   7.21      | 1.9.+  | min 1.8 |
-|   7.20      | 1.8.10 | min 1.8 |
-|   7.19      | 1.8.10 | min 1.8 |
-|   7.18      | 1.8.0  | min 1.8 |
-|   7.17      | 1.8.0  | min 1.8 |
+| Kodein | Kotlin |   JDK   |
+|:------:|:------:|:-------:|
+|  7.23  | 2.0.+  | min 17  |
+|  7.22  | 2.0.+  | min 11  |
+|  7.21  | 1.9.+  | min 1.8 |
+|  7.20  | 1.8.10 | min 1.8 |
+|  7.19  | 1.8.10 | min 1.8 |
+|  7.18  | 1.8.0  | min 1.8 |
+|  7.17  | 1.8.0  | min 1.8 |
 
 > Full table can be found [here](https://kosi-libs.org/kodein/7.22/core/platform-and-genericity.html)
 
```

**File**: `doc/antora.yml` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
 name: kodein
 title: Kodein
 version: '7.26'
-display_version: '7.26.0'
+display_version: '7.26.1'
 nav:
   - modules/ROOT/nav.adoc
   - modules/core/nav.adoc
@@ -11,6 +11,6 @@ nav:
 asciidoc:
   attributes:
     branch: '7.26'
-    version: '7.26.0'
-    kotlin: '2.1.21-RC'
+    version: '7.26.1'
+    kotlin: '2.1.20'
     jdk: '17'
\ No newline at end of file
```

**File**: `doc/modules/framework/pages/compose.adoc` (modified, +3/-3)
```diff
@@ -16,9 +16,9 @@ Here is a table containing the version compatibility:
 |JetBrains Compose
 |Kotlin
 
-|7.26.0
-|Compose 1.8.0-RC
-|2.1.21-RC
+|7.26.1
+|Compose 1.8.0-rc01
+|2.1.20
 
 |7.25.0
 |Compose 1.7.3
```

**File**: `settings.gradle.kts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ buildscript {
         maven(url = "https://raw.githubusercontent.com/kosi-libs/kodein-internal-gradle-plugin/mvn-repo")
     }
     dependencies {
-        classpath("org.kodein.internal.gradle:kodein-internal-gradle-settings:8.12.0")
+        classpath("org.kodein.internal.gradle:kodein-internal-gradle-settings:8.12.1")
     }
 }
 
```

---

### Incident Patch 7: `54ec7074` (2025-01-20)
**Commit Message**: fix support section

**File**: `README.md` (modified, +1/-1)
```diff
@@ -168,6 +168,6 @@ Support is held in the [Kodein Slack channel](https://kotlinlang.slack.com/messa
 
 If you are using KODEIN, please [let us know](mailto:contact@kodein.net)!
 
-### Supported by
+## Supported by
 
 [![JetBrains logo.](https://resources.jetbrains.com/storage/products/company/brand/logos/jetbrains.svg)](https://jb.gg/OpenSourceSupport)
\ No newline at end of file
```

---

### Incident Patch 8: `2db4c24d` (2025-01-19)
**Commit Message**: fix: re-enable js target

**File**: `framework/compose/kodein-di-framework-compose/build.gradle.kts` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ plugins {
 kotlin.kodein {
     jsEnv()
     allComposeUi()
+    js() // Not embedded in allComposeUi
 
     common.mainDependencies {
         implementation(kotlin.compose.runtime)
```

**File**: `gradle.properties` (modified, +9/-1)
```diff
@@ -6,8 +6,16 @@ org.gradle.parallel=true
 android.enableJetifier=true
 android.useAndroidX=true
 
-# Wasm
+# Compose
 org.jetbrains.compose.experimental.wasm.enabled=true
+org.jetbrains.compose.experimental.jscanvas.enabled=true
+org.jetbrains.compose.experimental.macos.enabled=true
+
+# Wasm
+kotlin.wasm.stability.nowarn=true
+
+# KGP
+kotlin.apple.xcodeCompatibility.nowarn=true
 
 # Kosi
 org.kodein.native.enableCrossCompilation=true
\ No newline at end of file
```

---

### Incident Patch 9: `db87bf3d` (2024-12-02)
**Commit Message**: chore: revert deprecation on Jetpack Compose APIs.

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -5,5 +5,5 @@ plugins {
 
 allprojects {
     group = "org.kodein.di"
-    version = "7.23.0"
+    version = "7.23.1"
 }
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/viewModel.kt` (modified, +0/-6)
```diff
@@ -86,12 +86,6 @@ public inline fun <reified VM : ViewModel> viewModel(
  * @throws DI.DependencyLoopException If the value construction triggered a dependency loop.
  */
 @Composable
-@Deprecated(
-    message = "Use the new Compose Multiplatform rememberViewModel instead from Kodein Framework Compose",
-    ReplaceWith("rememberViewModel", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
-@Suppress("DEPRECATION")
 public inline fun <reified A : Any, reified VM : ViewModel> rememberViewModel(
     tag: String? = null,
     arg: A,
```

**File**: `framework/compose/kodein-di-framework-compose/src/androidMain/kotlin/org/kodein/di/compose/viewModel.kt` (modified, +0/-10)
```diff
@@ -21,11 +21,6 @@ import org.kodein.di.instance
  * @throws DI.DependencyLoopException If the value construction triggered a dependency loop.
  */
 @Composable
-@Deprecated(
-    message = "Use the new Compose Multiplatform rememberViewModel instead",
-    ReplaceWith("rememberViewModel", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
 public inline fun <reified VM : ViewModel> rememberViewModel(tag: Any? = null): ViewModelLazy<VM> = with(localDI()) {
     val viewModelStoreOwner = LocalViewModelStoreOwner.current ?: error("")
 
@@ -57,11 +52,6 @@ public inline fun <reified VM : ViewModel> rememberViewModel(tag: Any? = null):
  * @throws DI.DependencyLoopException If the value construction triggered a dependency loop.
  */
 @Composable
-@Deprecated(
-    message = "Use the new Compose Multiplatform rememberViewModel instead",
-    ReplaceWith("rememberViewModel", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
 public inline fun <reified A: Any, reified VM : ViewModel> rememberViewModel(tag: Any? = null, arg: A): ViewModelLazy<VM> = with(localDI()) {
     val viewModelStoreOwner = LocalViewModelStoreOwner.current ?: error("")
 
```

---

### Incident Patch 10: `b3cc6a9f` (2024-11-29)
**Commit Message**: chore: revert deprecation on Jetpack Compose APIs.

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/KodeinViewModelScopedFactory.kt` (modified, +0/-10)
```diff
@@ -8,11 +8,6 @@ import org.kodein.di.direct
 import org.kodein.type.TypeToken
 import org.kodein.type.erased
 
-@Deprecated(
-    message = "Use the new Compose Multiplatform KodeinViewModelScopedFactory instead from Kodein Framework Compose",
-    ReplaceWith("KodeinViewModelScopedFactory", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
 public class KodeinViewModelScopedFactory<A : Any>(
     private val di: DI,
     private val argType: TypeToken<A>,
@@ -23,11 +18,6 @@ public class KodeinViewModelScopedFactory<A : Any>(
             di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
 }
 
-@Deprecated(
-    message = "Use the new Compose Multiplatform KodeinViewModelScopedSingleton instead from Kodein Framework Compose",
-    ReplaceWith("KodeinViewModelScopedSingleton", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
 public class KodeinViewModelScopedSingleton(
     private val di: DI,
     private val tag: String? = null,
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/viewModel.kt` (modified, +0/-6)
```diff
@@ -22,12 +22,6 @@ import org.kodein.type.generic
  * @throws DI.DependencyLoopException If the value construction triggered a dependency loop.
  */
 @Composable
-@Deprecated(
-    message = "Use the new Compose Multiplatform rememberViewModel instead from Kodein Framework Compose",
-    ReplaceWith("rememberViewModel", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
-@Suppress("DEPRECATION")
 public inline fun <reified VM : ViewModel> rememberViewModel(
     tag: String? = null
 ): ViewModelLazy<VM> = with(localDI()) {
```

---

### Incident Patch 11: `c59ee38d` (2024-07-12)
**Commit Message**: build: update publication

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -21,8 +21,8 @@ jobs:
     needs: create-staging-repository
     runs-on: macOS-latest
     env:
-      SONATYPE_USERNAME: ${{ secrets.SONATYPE_USERNAME }}
-      SONATYPE_PASSWORD: ${{ secrets.SONATYPE_PASSWORD }}
+      SONATYPE_USERNAME: ${{ secrets.SONATYPE_TOKEN_USER }}
+      SONATYPE_PASSWORD: ${{ secrets.SONATYPE_TOKEN_PASSWORD }}
       GPG_PRIVATE_KEY: ${{ secrets.PGP_SIGNING_KEY }}
       GPG_PRIVATE_PASSWORD: ${{ secrets.PGP_SIGNING_PASSWORD }}
     steps:
```

**File**: `.github/workflows/snapshot.yml` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ jobs:
       - instrumentation-tests
     runs-on: macOS-latest
     env:
-      SONATYPE_USERNAME: ${{ secrets.sonatype_username }}
-      SONATYPE_PASSWORD: ${{ secrets.sonatype_password }}
+      SONATYPE_USERNAME: ${{ secrets.SONATYPE_TOKEN_USER }}
+      SONATYPE_PASSWORD: ${{ secrets.SONATYPE_TOKEN_PASSWORD }}
     steps:
       - name: Setup
         uses: kosi-libs/kodein-internal-github-actions/setup@main
```

---

### Incident Patch 12: `e5f783e1` (2024-07-12)
**Commit Message**: build: update CI scripts

**File**: `.github/workflows/snapshot.yml` (modified, +0/-1)
```diff
@@ -18,7 +18,6 @@ jobs:
     uses: kosi-libs/kodein-internal-github-actions/.github/workflows/unit-tests.yml@main
   instrumentation-tests:
     uses: kosi-libs/kodein-internal-github-actions/.github/workflows/check-with-android.yml@main
-
   upload-snapshot:
     needs:
       - unit-tests
```

**File**: `.github/workflows/test.yml` (modified, +4/-7)
```diff
@@ -10,10 +10,7 @@ on:
       - '!./github/workflow/test.yml'
 
 jobs:
-  check:
-    runs-on: macOS-latest
-    steps:
-      - name: Setup
-        uses: kosi-libs/kodein-internal-github-actions/setup@main
-      - name: Check with Android
-        uses: kosi-libs/kodein-internal-github-actions/.github/workflows/check-with-android.yml@main
+  unit-tests:
+    uses: kosi-libs/kodein-internal-github-actions/.github/workflows/unit-tests.yml@main
+  instrumentation-tests:
+    uses: kosi-libs/kodein-internal-github-actions/.github/workflows/check-with-android.yml@main
```

---

### Incident Patch 13: `435519b1` (2024-07-11)
**Commit Message**: chore: update gradle build scripts

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -5,5 +5,5 @@ plugins {
 
 allprojects {
     group = "org.kodein.di"
-    version = "7.22.0"
+    version = "7.23.0"
 }
```

**File**: `gradle/libs.versions.toml` (modified, +5/-0)
```diff
@@ -9,6 +9,8 @@ androidx-lifecycle = "2.7.0"
 androidx-compose = "2.7.7"
 # Compose
 jbCompose = "1.6.10"
+compose-viewmodel = "2.8.0"
+compose-navigation = "2.7.0-alpha07"
 compose-compiler = "2.0.0"
 compose-bom = "2024.05.00"
 # KSP
@@ -40,6 +42,9 @@ android-x-lifecycle-viewmodel-compose = { module = "androidx.lifecycle:lifecycle
 android-x-compose-navigation = { module = "androidx.navigation:navigation-compose", version.ref = "androidx-compose" }
 android-compose-bom = { module = "androidx.compose:compose-bom", version.ref = "compose-bom" }
 android-compose-runtime = { module = "androidx.compose.runtime:runtime" }
+# Compose Multiplatform
+jetbrains-compose-viewmodel = { module = "org.jetbrains.androidx.lifecycle:lifecycle-viewmodel-compose", version.ref = "compose-viewmodel" }
+jetbrains-compose-navigation = { module = "org.jetbrains.androidx.navigation:navigation-compose", version.ref = "compose-navigation" }
 # KSP
 kotlinpoet = { module = "com.squareup:kotlinpoet", version.ref = "kotlinpoet" }
 kotlinpoet-ksp = { module = "com.squareup:kotlinpoet-ksp", version.ref = "kotlinpoet" }
```

**File**: `kodein-di/build.gradle.kts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 plugins {
-    id("org.kodein.library.mpp")
+    kodein.library.mpp
 }
 
 kotlin.kodein {
```

---

### Incident Patch 14: `34eee243` (2024-05-23)
**Commit Message**: fix CI android checks

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Setup
         uses: kosi-libs/kodein-internal-github-actions/setup@main
       - name: Check with Android
-        uses: kosi-libs/kodein-internal-github-actions/checkWithAndroid@main
+        uses: kosi-libs/kodein-internal-github-actions/.github/workflows/check-with-android.yml@main
       - name: Upload
         run: ./gradlew publishAllPublicationsToOssrhStagingRepository -Porg.kodein.sonatype.repositoryId=${{ needs.create-staging-repository.outputs.repository-id }}
         shell: bash
```

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -16,4 +16,4 @@ jobs:
       - name: Setup
         uses: kosi-libs/kodein-internal-github-actions/setup@main
       - name: Check with Android
-        uses: kosi-libs/kodein-internal-github-actions/checkWithAndroid@main
+        uses: kosi-libs/kodein-internal-github-actions/.github/workflows/check-with-android.yml@main
```

---

### Incident Patch 15: `78684f49` (2024-01-12)
**Commit Message**: fix: k/wasm targets

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -5,5 +5,5 @@ plugins {
 
 allprojects {
     group = "org.kodein.di"
-    version = "7.21.1"
+    version = "7.21.2"
 }
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/build.gradle.kts` (modified, +0/-4)
```diff
@@ -20,10 +20,6 @@ android {
     }
 }
 
-compose {
-    kotlinCompilerPlugin.set(libs.versions.compose.compiler.get())
-}
-
 kodeinUpload {
     name = "Kodein-Framework-Compose-Android"
     description = "Kodein extensions for AndroidX ViewModels using Jetpack Compose"
```

**File**: `framework/compose/kodein-di-framework-compose/build.gradle.kts` (modified, +0/-6)
```diff
@@ -6,8 +6,6 @@ plugins {
 kotlin.kodein {
     jsEnv()
 
-//    allComposeStable()
-    // 1.5.11 does not work with compose WasmJS yet
     allComposeExperimental()
 
     common.mainDependencies {
@@ -23,10 +21,6 @@ kotlin.kodein {
     }
 }
 
-compose {
-    kotlinCompilerPlugin.set(libs.versions.compose.compiler.get())
-}
-
 android {
     namespace = "org.kodein.di.compose"
 }
```

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -1,14 +1,14 @@
 [versions]
 # Core
-kaverit = "2.8.1"
+kaverit = "2.8.2"
 # Android
 android-appcompat = "28.0.0"
 androidx-appcompat = "1.6.1"
 androidx-fragment = "1.6.2"
 androidx-lifecycle = "2.6.2"
 androidx-compose = "2.7.5"
 # Compose
-jbCompose = "1.5.10-dev-wasm03"
+jbCompose = "1.6.0-alpha01"
 compose-compiler = "1.5.4"
 compose-bom = "2023.10.01"
 # KSP
```

#### Recent Merged Pull Requests:
- **PR #513** (2026-07-21): fix(#508): handle NoClassDefFoundError during JSR-330 injection (@romainbsl)
- **PR #511** (closed): fix(#508): tolerate unresolvable member types during reflective injection (@tonytonycoder11)
- **PR #510** (2026-07-19): Regenerate Kotlin/JS yarn.lock for Kotlin 2.4.0 (@romainbsl)
- **PR #507** (2026-03-25): fix((#506): update KodeinViewModelScopedFactory and KodeinViewModelScopedSingleton to use generic types (@romainbsl)
- **PR #505** (2026-03-23): fix((#504): bring back scope on SetBinder and ArgSetBinder (@romainbsl)
- **PR #503** (2026-02-08): Upgrade Ktor dependency from 3.3.2 to 3.4.0 (@romainbsl)
- **PR #500** (2025-11-20): New with arguments (@SalomonBrys)
- **PR #499** (2025-11-11): Update CHANGELOG.md (@romainbsl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
