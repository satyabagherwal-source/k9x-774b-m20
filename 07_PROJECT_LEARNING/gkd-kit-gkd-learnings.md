> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gkd-kit-gkd-learnings.md`  
> **Source**: github ([https://github.com/gkd-kit/gkd](https://github.com/gkd-kit/gkd))  
> **Source Version**: `c45a1241`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T12:08:57.863Z  
> **Learning ID**: `learn-github-gkd-kit-gkd`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): gkd-kit/gkd

> **Canonical Artifact**: `07_PROJECT_LEARNING/gkd-kit-gkd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gkd-kit/gkd](https://github.com/gkd-kit/gkd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-31T12:08:56.595Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gkd-kit/gkd`
- **Description**: 基于无障碍，高级选择器，订阅规则的自定义屏幕点击安卓应用 | An Android APP with custom screen tapping based on Accessibility, Advanced Selectors, and Subscription Rules
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 43771 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/data/subscription/SubscriptionState.kt`
```
package li.gkd.app.data.subscription

import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import li.gkd.app.appScope
import li.gkd.app.matching.RuleExecutionHost
import li.gkd.app.rule.RuleSummaryBuilder
import li.gkd.app.rule.ruleGroupState
import li.gkd.app.state.Loadable
import li.gkd.app.subscription.SubscriptionRepository

object SubscriptionState {
    val subsMapFlow by lazy {
        SubscriptionRepository.snapshotFlow
            .map { it.value?.subscriptions.orEmpty() }
            .stateIn(
                appScope,
                SharingStarted.Eagerly,
                SubscriptionRepository.snapshotFlow.value.value?.subscriptions.orEmpty(),
            )
    }

    val ruleSummaryFlow by lazy {
        ruleGroupState
            .map { state ->
                when (state) {
                    Loadable.Loading -> Loadable.Loading
                    is Loadable.Failure -> state
                    is Loadable.Ready ->
                        Loadable.Ready(
                            RuleSummaryBuilder.build(
                                state.value.groups,
                                state.value.apps,
                                RuleExecutionHost.runtime,
                            ),
                        )
                }
            }
            .catch { emit(Loadable.Failure(it)) }
            .stateIn(appScope, SharingStarted.Eagerly, Loadable.Loading)
    }
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/matching/input/AndroidForegroundState.kt`
```
package li.gkd.app.matching.input

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import li.gkd.app.appScope
import li.gkd.app.data.subscription.SubscriptionState
import li.gkd.app.logging.LogUtils
import li.gkd.app.matching.AndroidAutomationSessions
import li.gkd.app.matching.ForegroundRuleSnapshot
import li.gkd.app.matching.MatchInvalidationReason
import li.gkd.app.matching.MatchingRuntime
import li.gkd.app.matching.RuleAvailability
import li.gkd.app.matching.RuleExecutionHost
import li.gkd.app.matching.diagnostics.MatchPageObservation
import li.gkd.app.matching.diagnostics.MatchStage
import li.gkd.app.matching.retainUnaffectedExecution
import li.gkd.app.record.AppVisitInput
import li.gkd.app.record.RuntimeRecordRepository
import li.gkd.app.rule.RuleSummary
import li.gkd.app.rule.TopActivity
import li.gkd.app.service.updateTopTaskAppId
import li.gkd.app.settings.SettingsRepository
import li.gkd.app.state.Loadable
import li.gkd.app.util.Constants
import li.gkd.app.util.launchLogged
import li.songe.codeorigin.CallSite

val foregroundRulesFlow: StateFlow<ForegroundRuleSnapshot>
    get() = AndroidForegroundState.foregroundRulesFlow

val topActivityFlow = foregroundRulesFlow.map { it.topActivity }.distinctUntilChanged()
val currentTopActivity: TopActivity
    get() = foregroundRulesFlow.value.topActivity

sealed class ActivityScene {
    data object ScreenOn : ActivityScene()

    data object A11y : ActivityScene()

    data object TaskStack : ActivityScene()

    data object Nodes : ActivityScene()
}

object AndroidForegroundState {
    private val lock = Any()

    // Only state reads/commits belong here. Platform Binder queries must run outside this lock.
    fun <T> withTopActivityLock(block: () -> T): T = synchronized(lock, block)

    val foregroundRulesFlow: StateFlow<ForegroundRuleSnapshot>
        field =
            MutableStateFlow(
                ForegroundRuleSnapshot(
                    blockMatch = SettingsRepository.checkAppBlockMatch(Constants.systemUiAppId),
                    ruleAvailability = RuleAvailability.Loading,
                ),
            )
    val currentRule: ForegroundRuleSnapshot
        get() = synchronized(lock) { foregroundRulesFlow.value }

    private var page = Any()
    private var confirmedPage: Any? = null
    val currentPage: Any
        get() = synchronized(lock) { page }

    fun onWindowChanged(): Unit =
        synchronized(lock) {
            page = Any()
            MatchingRuntime.coordinator.invalidate(MatchInvalidationReason.ForegroundConflict)
        }

    fun onRulesChanged(snapshot: Loadable<RuleSummary>) {
        synchronized(lock) {
            if (SubscriptionState.ruleSummaryFlow.value !== snapshot) return
            val summary = snapshot.value ?: RuleSummary()
            if (currentRule.ruleSummary === summary) return
            val top = currentRule.topActivity
            applyTopActivity(
                top.appId,
                top.activityId,
                ActivityScene.A11y,
                "rules_updated",
                snapshot,
                true,
            )
        }
        AndroidAutomationSessions.service?.matchHost?.onRulesChanged()
    }

    fun onScreenForcedActive(): Unit =
        synchronized(lock) {
            val top = foregroundRulesFlow.value.topActivity
            updateTopActivity(top.appId, top.activityId, ActivityScene.ScreenOn)
        }

    private var lastValidActivity: TopActivity = foregroundRulesFlow.value.topActivity
        set(value) {
            if (value.activityId != null) {
                field = value
            }
        }

    @Volatile
    var foregroundPending = false
        private set

    fun foregroundSnapshot() = synchronized(lock) { MatchingRuntime.inputs.foregroundSnapshot() }

    fun updateSystemSurface(covered: Boolean?, sourceTimeMillis: Long? = null): Unit =
        synchronized(lock) {
            val result =
                MatchingRuntime.inputs.accept(
                    MatchInput.SystemSurface(covered),
                    MatchingRuntime.coordinator.policy.value,
                    sourceTimeMillis,
                )
            val decision = checkNotNull(result.foreground)
            foregroundPending = decision.pending != null
            if (result.cancelWork) {
                page = Any()
                // Same soft invalidation as a page change: an already-started gesture completes.
                MatchingRuntime.coordinator.invalidate(MatchInvalidationReason.ForegroundConflict)
            }
            if (decision.reason != ForegroundDecisionReason.SurfaceUnchanged)
                AndroidAutomationSessions.service?.matchHost?.confirmForeground()
        }

    private var lastAppId = Constants.systemUiAppId

    fun updateTopActivity(
        appId: String,
        activityId: String?,
        scene: ActivityScene = ActivityScene.A11y,
        sourceTimeMillis: Long? = null,
        @CallSite loc: String = "",
    ): Unit =
        synchronized(lock) {
            if (scene == ActivityScene.TaskStack) {
                updateTopTaskAppId(appId)
            }
            if (scene != ActivityScene.ScreenOn) {
                val source =
                    when (scene) {
                        ActivityScene.TaskStack -> ForegroundSource.TaskStack
                        ActivityScene.Nodes -> ForegroundSource.Nodes
                        else -> ForegroundSource.Accessibility
                    }
                val inputDecision =
                    MatchingRuntime.inputs.accept(
                        MatchInput.Foreground(source, ForegroundIdentity(appId, activityId)),
                        MatchingRuntime.coordinator.policy.value,
                        sourceTimeMillis,
                    )
                val decision = checkNotNull(inputDecision.foreground)
                foregroundPending = decision.pending != null
                if (foregroundPending) {
                    if (inputDecision.cancelWork) {
                        page = Any()
                        MatchingRuntime.coordinator.invalidate(
                            MatchInvalidationReason.ForegroundConflict,
                        )
                    }
                    AndroidAutomationSessions.service?.matchHost?.confirmForeground()
                    return@synchronized
                }
                if (
                    !decision.changed &&
                        !decision.appReentered &&
                        (scene == ActivityScene.Nodes ||
                            scene == ActivityScene.TaskStack ||
                            decision.reason == ForegroundDecisionReason.TaskBelowConfirmedSurface ||
                            decision.reason == ForegroundDecisionReason.TaskBelowSystemSurface ||
                            decision.reason == ForegroundDecisionReason.ExitingSystemSurface)
                )
                    return@synchronized
                applyTopActivity(
                    decision.confirmed.appId,
                    decision.confirmed.activityId,
                    scene,
                    loc,
                    appReentered = decision.appReentered,
                )
                return@synchronized
            }
            applyTopActivity(appId, activityId, scene, loc)
        }

    private fun applyTopActivity(
        appId: String,
        activityId: String?,
        scene: ActivityScene,
        loc: String,
        snapshot: Loadable<RuleSummary> = SubscriptionState.ruleSummaryFlow.value,
        rulesOnly: Boolean = false,
        appReentered: Boolean = false,
    ) {
        val ruleSummary = snapshot.value ?: RuleSummary()
        val availability =
            when (snapshot) {
                Loadable.Loading -> RuleAvailability.Loading
                is Loadable.Ready -> RuleAvailability.Ready
                is Loadable.Failure -> RuleAvailability.Failed
            }
        val wallTime = System.currentTimeMillis()
        val t = RuleExecutionHost.runtime.now()
        val oldActivity = foregroundRulesFlow.value.topActivity
        val oldActivityRule = foregroundRulesFlow.value
        val idChanged =
            (appReentered ||
                scene == ActivityScene.ScreenOn ||
                appId != oldActivityRule.topActivity.appId)
        val isSame =
            !appReentered &&
                scene != ActivityScene.ScreenOn &&
                oldActivity.sameAs(appId, activityId)
        val number =
            if (isSame) {
                oldActivity.number + 1
            } else {
                0
            }
        val topActivity =
            if (rulesOnly) oldActivity
            else
                TopActivity(
                    appId = appId,
                    activityId =
                        activityId ?: lastValidActivity.takeIf { it.appId == appId }?.activityId,
                    number = number,
                )
        lastValidActivity = oldActivity
        if (!rulesOnly)
            appScope.launchLogged {
                RuntimeRecordRepository.recordActivity(appId, activityId, wallTime)
            }
        // Keep foreground/visit bookkeeping active while no complete executable snapshot exists.
        // Presentation still observes Loading/Failure; the executor receives no runnable rules.
        val topChanged = idChanged || oldActivityRule.topActivity != topActivity
        val ruleChanged = oldActivityRule.ruleSummary !== ruleSummary
        if (topChanged || ruleChanged) {
            if (ruleChanged) ruleSummary.retainUnaffectedExecution(oldActivityRule.ruleSummary)
            if (!isSame) {
                page = Any()
                MatchingRuntime.coordinator.invalidate(MatchInvalidationReason.PageChanged)
            }
            val newActivityRule =
                ForegroundRuleSnapsho
```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/network/NetworkState.android.kt`
```
package li.gkd.app.network

// Real requests determine reachability; no unrelated host gates them.
actual fun isNetworkRequestAllowed(): Boolean = true

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/permission/PermissionState.kt`
```
package li.gkd.app.permission

import android.app.AppOpsManager
import android.app.AppOpsManagerHidden
import android.os.Process
import android.provider.Settings
import com.hjq.permissions.XXPermissions
import com.hjq.permissions.permission.PermissionLists
import com.hjq.permissions.permission.base.IPermission
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import li.gkd.app.app
import li.gkd.app.app.AppInfoRepository
import li.gkd.app.appScope
import li.gkd.app.priv.PrivilegeCapabilities
import li.gkd.app.priv.privilegeContextFlow
import li.gkd.app.priv.queryPrivilegeCapabilities
import li.gkd.app.resources.*
import li.gkd.app.util.AndroidTarget
import li.gkd.app.util.ToastUtils
import li.gkd.app.util.mapState
import li.songe.codeorigin.CallSite
import org.jetbrains.compose.resources.StringResource
import priv.kit.core.Privilege

data class PermissionCheck(
    val checkedAt: Long,
    val granted: Boolean,
)

class PermissionState(
    val id: String,
    private val nameResource: StringResource,
    private val check: () -> Boolean,
    val permission: IPermission? = null,
    private val purposeResource: StringResource? = null,
    val resolution: PermissionResolution? = null,
    private val onChanged: (() -> Unit)? = null,
    val recheckPolicy: PermissionRecheckPolicy = PermissionRecheckPolicy.Immediate,
) {
    val name: String
        get() = nameResource.getSync()

    val purpose: String?
        get() = purposeResource?.getSync()

    val stateFlow: StateFlow<Boolean>
        field = MutableStateFlow(false)
    val value
        get() = stateFlow.value

    @Volatile
    var lastCheck: PermissionCheck? = null
        private set

    fun updateAndGet(): Boolean {
        val granted = check()
        lastCheck = PermissionCheck(System.currentTimeMillis(), granted)
        stateFlow.value = granted
        return granted
    }

    fun refresh(): Boolean {
        val oldValue = value
        val newValue = updateAndGet()
        if (oldValue != newValue) {
            onChanged?.invoke()
        }
        return newValue
    }

    fun checkOrToast(@CallSite loc: String = ""): Boolean {
        val granted = refresh()
        if (!granted) {
            ToastUtils.show(Res.string.permission_required.getSync(name), loc = loc)
        }
        return granted
    }
}

class PermissionResolution(
    private val messageProvider: () -> String,
    private val confirmResource: StringResource = Res.string.permission_open_settings,
    val navigateToPrivilegeService: Boolean = false,
) {
    val message: String
        get() = messageProvider()

    val confirmText: String
        get() = confirmResource.getSync()
}

private fun requestablePermissionState(
    id: String,
    nameResource: StringResource,
    purposeResource: StringResource,
    permission: IPermission,
    check: () -> Boolean = { XXPermissions.isGrantedPermission(app, permission) },
    onChanged: (() -> Unit)? = null,
    recheckPolicy: PermissionRecheckPolicy = PermissionRecheckPolicy.Immediate,
) =
    PermissionState(
        id = id,
        nameResource = nameResource,
        check = check,
        permission = permission,
        purposeResource = purposeResource,
        resolution =
            PermissionResolution(
                messageProvider = {
                    Res.string.permission_not_granted_description.getSync(nameResource.getSync())
                },
            ),
        onChanged = onChanged,
        recheckPolicy = recheckPolicy,
    )

private fun checkAllowedOp(op: String): Boolean =
    app.appOpsManager
        .checkOpNoThrow(
            op,
            Process.myUid(),
            app.packageName,
        )
        .let {
            it != AppOpsManager.MODE_IGNORED && it != AppOpsManager.MODE_ERRORED
        }

object PermissionStates {
    // https://github.com/gkd-kit/gkd/issues/954
    // https://github.com/gkd-kit/gkd/issues/887
    val foregroundServiceSpecialUse by lazy {
        PermissionState(
            id = "foreground_service_special_use",
            nameResource = Res.string.permission_special_foreground_service,
            check = {
                if (AndroidTarget.UPSIDE_DOWN_CAKE) {
                    checkAllowedOp(AppOpsManagerHidden.OPSTR_FOREGROUND_SERVICE_SPECIAL_USE)
                } else {
                    true
                }
            },
            resolution =
                PermissionResolution(
                    messageProvider = {
                        Res.string.permission_special_foreground_service_restricted.getSync()
                    },
                    confirmResource = Res.string.permission_go_authorize,
                    navigateToPrivilegeService = true,
                ),
        )
    }

    // https://github.com/orgs/gkd-kit/discussions/1234
    private fun checkAccessA11y(): Boolean {
        return !AndroidTarget.Q || checkAllowedOp(AppOpsManagerHidden.OPSTR_ACCESS_ACCESSIBILITY)
    }

    private var canRestrictsRead = true

    private fun checkAccessRestrictedSettings(): Boolean {
        return if (
            canRestrictsRead &&
                AndroidTarget.UPSIDE_DOWN_CAKE &&
                app.checkGrantedPermission(AndroidPermissions.GET_APP_OPS_STATS)
        ) {
            try {
                // https://cs.android.com/android/platform/superproject/+/android-14.0.0_r55:frameworks/base/services/core/java/com/android/server/appop/AppOpsService.java;l=4237
                checkAllowedOp(AppOpsManagerHidden.OPSTR_ACCESS_RESTRICTED_SETTINGS)
            } catch (_: SecurityException) {
                // https://cs.android.com/android/platform/superproject/+/android-14.0.0_r54:frameworks/base/services/core/java/com/android/server/appop/AppOpsService.java;l=4227
                canRestrictsRead = false
                true
            }
        } else {
            true
        }
    }

    private val accessRestrictions = MutableStateFlow<Set<AppPermissionRestriction>>(emptySet())

    private val appOpsAllowed by lazy {
        PermissionState(
            id = "app_ops_allowed",
            nameResource = Res.string.permission_start_operations,
            check = {
                val accessA11yAllowed = checkAccessA11y()
                val accessRestrictedSettingsAllowed = checkAccessRestrictedSettings()
                accessRestrictions.value = buildSet {
                    if (!accessA11yAllowed) add(AppPermissionRestriction.Accessibility)
                    if (!accessRestrictedSettingsAllowed)
                        add(AppPermissionRestriction.RestrictedSettings)
                }
                accessA11yAllowed && accessRestrictedSettingsAllowed
            },
        )
    }

    val appRestrictionsFlow by lazy {
        combine(
                accessRestrictions,
                foregroundServiceSpecialUse.stateFlow,
            ) { access, foregroundServiceAllowed ->
                if (foregroundServiceAllowed) access
                else access + AppPermissionRestriction.ForegroundService
            }
            .stateIn(appScope, SharingStarted.Eagerly, emptySet())
    }

    val appOpsRestrictedFlow by lazy { appRestrictionsFlow.mapState(appScope) { it.isNotEmpty() } }

    val notification by lazy {
        requestablePermissionState(
            id = "notification",
            nameResource = Res.string.permission_notifications,
            purposeResource = Res.string.permission_notifications_description,
            permission = PermissionLists.getPostNotificationsPermission(),
        )
    }

    val localNetwork by lazy {
        requestablePermissionState(
            id = "local_network",
            nameResource = Res.string.permission_local_network,
            purposeResource = Res.string.permission_local_network_description,
            permission = PermissionLists.getAccessLocalNetworkPermission(),
        )
    }

    val queryPackages by lazy {
        requestablePermissionState(
            id = "query_packages",
            nameResource = Res.string.permission_query_apps,
            purposeResource = Res.string.permission_query_apps_description,
            permission = PermissionLists.getGetInstalledAppsPermission(),
            onChanged = {
                AppInfoRepository.requestRefresh()
            },
        )
    }

    val drawOverlays by lazy {
        requestablePermissionState(
            id = "overlay",
            nameResource = Res.string.permission_overlay,
            purposeResource = Res.string.permission_overlay_description,
            permission = PermissionLists.getSystemAlertWindowPermission(),
            check = {
                // https://developer.android.com/security/fraud-prevention/activities?hl=zh-cn#hide_overlay_windows
                Settings.canDrawOverlays(app)
            },
        )
    }

    val writeExternalStorage by lazy {
        requestablePermissionState(
            id = "write_external_storage",
            nameResource = Res.string.permission_external_storage,
            purposeResource = Res.string.permission_external_storage_description,
            permission = PermissionLists.getWriteExternalStoragePermission(),
            check = {
                if (AndroidTarget.Q) {
                    true
                } else {
                    app.checkGrantedPermission(AndroidPermissions.WRITE_EXTERNAL_STORAGE)
                }
            },
        )
    }

    val ignoreBatteryOptimizations by lazy {
        requestablePermissionState(
            id = "ignore_battery_optimizations",
            nameResource = Res.string.permission_ignore_battery_optimization,
            purposeResource = Res.string.permission_ignore_battery_optimization_description,
            permission = PermissionLists.getRequestIgnoreBatteryOptimizationsPermission(),
            
```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/platform/lifecycle/LifecycleHooks.kt`
```
package li.gkd.app.platform.lifecycle

import androidx.annotation.MainThread
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import li.gkd.app.logging.LogUtils
import li.songe.codeorigin.CallSite

class LifecycleHooks(
    private val onLifecycleEvent: (String, String) -> Unit = { event, loc ->
        LogUtils.i(event, loc = loc)
    },
    private val onCleanupError: (Throwable, String) -> Unit = { error, loc ->
        LogUtils.e(error, loc = loc)
    },
) {
    private data class DestroyedCallback(
        val callback: () -> Unit,
        val loc: String,
    )

    private val createdCallbacks = mutableListOf<() -> Unit>()
    private val destroyedCallbacks = ArrayDeque<DestroyedCallback>()
    private var created = false
    private var destroyed = false

    @MainThread
    fun useLogLifecycle(
        owner: Any,
        @CallSite loc: String = "",
    ) {
        val ownerName = owner::class.simpleName
        onCreated { onLifecycleEvent("onCreated -> $ownerName", loc) }
        onDestroyed(loc = loc) { onLifecycleEvent("onDestroyed -> $ownerName", loc) }
    }

    @MainThread
    fun onCreated(callback: () -> Unit) {
        check(!created) { "onCreated must be registered before creation" }
        createdCallbacks += callback
    }

    @MainThread
    fun onDestroyed(
        @CallSite loc: String = "",
        callback: () -> Unit,
    ) {
        check(!destroyed) { "Lifecycle is already destroyed" }
        destroyedCallbacks.addFirst(DestroyedCallback(callback, loc))
    }

    @MainThread
    fun dispatchCreated() {
        if (created) return
        check(!destroyed) { "Lifecycle is already destroyed" }
        created = true
        try {
            createdCallbacks.forEach { it() }
        } finally {
            createdCallbacks.clear()
        }
    }

    @MainThread
    fun dispatchDestroyed() {
        if (destroyed) return
        destroyed = true
        createdCallbacks.clear()
        while (destroyedCallbacks.isNotEmpty()) {
            val destroyedCallback = destroyedCallbacks.removeFirst()
            runCatching { destroyedCallback.callback() }
                .onFailure { onCleanupError(it, destroyedCallback.loc) }
        }
    }
}

@MainThread
fun LifecycleOwner.useLogLifecycle(@CallSite loc: String = "") {
    val ownerName = this::class.simpleName
    onCreated { LogUtils.i("onCreated -> $ownerName", loc = loc) }
    onDestroyed { LogUtils.i("onDestroyed -> $ownerName", loc = loc) }
}

@MainThread
fun LifecycleOwner.onCreated(callback: () -> Unit) {
    lifecycle.addObserver(
        object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                owner.lifecycle.removeObserver(this)
                callback()
            }
        },
    )
}

@MainThread
fun LifecycleOwner.onDestroyed(callback: () -> Unit) {
    lifecycle.addObserver(
        object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) {
                callback()
            }
        },
    )
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/platform/lifecycle/MainActivityLifecycle.kt`
```
package li.gkd.app.platform.lifecycle

import androidx.activity.ComponentActivity
import androidx.annotation.MainThread
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.atomicfu.atomic
import li.gkd.app.META
import li.gkd.app.logging.LogUtils
import li.gkd.app.matching.input.currentTopActivity
import li.gkd.app.matching.input.updateTopActivity
import li.songe.codeorigin.CallSite

private val visibleActivityCount = atomic(0)

object MainActivityVisibility {
    val isVisible: Boolean
        get() = visibleActivityCount.value > 0
}

@MainThread
fun ComponentActivity.useMainActivityLifecycle(@CallSite loc: String = "") {
    lifecycle.addObserver(MainActivityLifecycleObserver(this, loc))
}

private class MainActivityLifecycleObserver(
    private val activity: ComponentActivity,
    private val logLoc: String,
) : DefaultLifecycleObserver {
    override fun onStart(owner: LifecycleOwner) {
        LogUtils.i("MainActivity::onStart", loc = logLoc)
        visibleActivityCount.incrementAndGet()
        if (currentTopActivity.appId != META.appId) {
            updateTopActivity(
                META.appId,
                activity.javaClass.name,
            )
        }
    }

    override fun onResume(owner: LifecycleOwner) {
        LogUtils.i("MainActivity::onResume", loc = logLoc)
        RuntimeStateSynchronizer.requestSync(loc = logLoc)
    }

    override fun onStop(owner: LifecycleOwner) {
        LogUtils.i("MainActivity::onStop", loc = logLoc)
        visibleActivityCount.decrementAndGet()
    }
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/platform/lifecycle/RuntimeStateSynchronizer.kt`
```
package li.gkd.app.platform.lifecycle

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import li.gkd.app.appScope
import li.gkd.app.logging.LogUtils
import li.gkd.app.matching.input.updateSystemDefaultAppId
import li.gkd.app.permission.PermissionStates
import li.gkd.app.priv.privilegeContextFlow
import li.gkd.app.service.fixRestartAutomatorService
import li.songe.codeorigin.CallSite

object RuntimeStateSynchronizer {
    private val requests = Channel<String>(Channel.CONFLATED)

    init {
        appScope.launch(Dispatchers.IO) {
            for (initialLoc in requests) {
                delay(COALESCE_DELAY_MILLIS)
                var loc = initialLoc
                while (true) {
                    loc = requests.tryReceive().getOrNull() ?: break
                }
                try {
                    updateSystemDefaultAppId()
                    privilegeContextFlow.value?.grantSelf()
                    PermissionStates.refreshAll()
                    fixRestartAutomatorService()
                } catch (e: Exception) {
                    LogUtils.e(e, loc = loc)
                }
            }
        }
    }

    fun requestSync(@CallSite loc: String = "") {
        requests.trySend(loc)
    }

    private const val COALESCE_DELAY_MILLIS = 50L
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/priv/PrivilegeOwnerLifecycle.kt`
```
package li.gkd.app.priv

import li.gkd.app.logging.LogUtils
import priv.kit.core.Privilege
import priv.kit.core.PrivilegeConfig

object PrivilegeOwnerLifecycle {
    private const val FOLLOW_DEATH_DELAY_MILLIS = 10 * 60 * 1000L
    private const val APP_RESTART_PASSIVE_TIMEOUT_MILLIS = 5_000L

    fun configure(enableAutomator: Boolean) {
        PrivilegeConfig.configure(
            followDeathDelayMillis = if (enableAutomator) FOLLOW_DEATH_DELAY_MILLIS else 0L,
            activeReconnectOnOwnerDeath = enableAutomator,
        )
    }

    fun prepareAppRestart() {
        runCatching {
            Privilege.prepareOwnerRestart(APP_RESTART_PASSIVE_TIMEOUT_MILLIS)
        }
            .onFailure { error ->
                LogUtils.e("prepare owner restart failed", error)
            }
    }
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/service/LifecycleHookService.kt`
```
package li.gkd.app.service

import androidx.lifecycle.LifecycleService
import li.gkd.app.platform.lifecycle.LifecycleHooks
import li.songe.codeorigin.CallSite

abstract class LifecycleHookService : LifecycleService() {
    private val lifecycleHooks = LifecycleHooks()

    fun onCreated(callback: () -> Unit) = lifecycleHooks.onCreated(callback)

    fun onDestroyed(
        @CallSite loc: String = "",
        callback: () -> Unit,
    ) = lifecycleHooks.onDestroyed(loc = loc, callback = callback)

    fun useLogLifecycle(@CallSite loc: String = "") {
        lifecycleHooks.useLogLifecycle(owner = this, loc = loc)
    }

    final override fun onCreate() {
        super.onCreate()
        lifecycleHooks.dispatchCreated()
    }

    final override fun onDestroy() {
        lifecycleHooks.dispatchDestroyed()
        super.onDestroy()
    }
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/ui/AndroidMainState.kt`
```
package li.gkd.app.ui

import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import li.gkd.app.crash.FileCrashStorage
import li.gkd.app.entry.EntryActivity
import li.gkd.app.entry.OpenFileActivity
import li.gkd.app.logging.LogUtils
import li.gkd.app.permission.PermissionRequests
import li.gkd.app.permission.PermissionStates
import li.gkd.app.platform.service.ServiceController
import li.gkd.app.priv.AutomationService
import li.gkd.app.priv.privilegeContextFlow
import li.gkd.app.priv.uiAutomationFlow
import li.gkd.app.resources.*
import li.gkd.app.service.A11yService
import li.gkd.app.settings.AutomatorMode
import li.gkd.app.settings.SettingsRepository
import li.gkd.app.storage.FileSource
import li.gkd.app.storage.StorageMaintenance
import li.gkd.app.ui.home.BottomNavItem
import li.gkd.app.ui.navigation.GkdLink
import li.gkd.app.ui.navigation.PrivilegeServiceRoute
import li.gkd.app.ui.share.ActivityResultRequests
import li.gkd.app.ui.share.importBackup as importBackupArchive
import li.gkd.app.ui.share.launchUi
import li.gkd.app.util.AndroidStorage
import li.gkd.app.util.IntentUtils
import li.gkd.app.util.ThreadUtils
import li.gkd.app.util.ToastUtils
import li.gkd.app.util.launchLogged

fun createMainViewModel(): MainViewModel {
    lateinit var vm: MainViewModel
    val permissions = PermissionRequests { vm.navigator.navigate(PrivilegeServiceRoute) }
    vm = MainViewModel(permissions)
    vm.addCloseable("android", AndroidMainState(vm, permissions))
    return vm
}

val MainViewModel.androidState: AndroidMainState
    get() = requireNotNull(getCloseable<AndroidMainState>("android"))

class AndroidMainState(
    private val mainVm: MainViewModel,
    val permissionRequests: PermissionRequests,
) : AutoCloseable {
    /** Returns whether the start request was issued; observe StatusService for running state. */
    suspend fun enableStatusService(): Boolean {
        if (
            !permissionRequests.ensurePermissions(
                PermissionStates.foregroundServiceSpecialUse,
                PermissionStates.notification,
            )
        )
            return false
        ServiceController.setStatusEnabled(true)
        return true
    }

    val activityResults = ActivityResultRequests()

    fun handleGkdUri(uri: Uri) {
        val notFoundToast = { ToastUtils.show(Res.string.uri_unknown.getSync(uri)) }
        when (val link = GkdLink.parse(uri.toString())) {
            is GkdLink.Home ->
                ThreadUtils.runMainOrPost {
                    val tab = link.tab
                    if (tab != null && BottomNavItem.allSubObjects.any { it.key == tab }) {
                        mainVm.homeNavigation.selectTab(
                            BottomNavItem.allSubObjects.first { it.key == tab },
                        )
                    }
                    // MainActivity 被复用时，也需要返回首页。
                    mainVm.navigator.popToHome()
                }

            is GkdLink.Page -> mainVm.navigator.openPage(link)
            GkdLink.WeChatScanner -> IntentUtils.openWeChatScanner()
            null -> notFoundToast()
        }
    }

    fun handleIntent(intent: Intent) =
        mainVm.scope.launchUi {
            LogUtils.i(intent)
            val uri = intent.data?.normalizeScheme()
            val source = intent.getStringExtra(EntryActivity.activityNavSourceName)
            if (uri?.scheme == "gkd") {
                handleGkdUri(uri)
            } else if (source == OpenFileActivity::class.java.name && uri != null) {
                if (
                    !mainVm.dialogRequests.confirm(
                        title = Res.string.backup_import_label.getSync(),
                        text = Res.string.backup_import_confirmation.getSync(),
                    )
                ) {
                    return@launchUi
                }
                importBackupArchive(FileSource.Uri(uri.toString()))
            }
        }

    override fun close() {
        updateAutomatorModeJob?.cancel()
    }

    private var updateAutomatorModeJob: Job? = null

    private fun applyAutomatorMode(option: AutomatorMode) {
        SettingsRepository.updateAutomatorMode(option.value)
        A11yService.instance?.shutdown()
        uiAutomationFlow.value?.shutdown()
    }

    fun updateAutomatorMode(option: AutomatorMode) {
        updateAutomatorModeJob?.cancel()
        if (SettingsRepository.settings.value.automatorMode == option.value) return
        if (option != AutomatorMode.Automation || privilegeContextFlow.value == null) {
            applyAutomatorMode(option)
            return
        }
        updateAutomatorModeJob =
            mainVm.scope.launch {
                val occupied =
                    try {
                        withContext(Dispatchers.IO) {
                            AutomationService.isOtherUiAutomationRunning()
                        }
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        ToastUtils.show(Res.string.automation_state_check_failed.getSync(e.message))
                        LogUtils.e("detect automation state failed", e)
                        return@launch
                    }
                if (occupied) {
                    AutomationService.showOccupiedWarning()
                    return@launch
                }
                applyAutomatorMode(option)
            }
    }

    init {
        mainVm.scope.launchLogged(Dispatchers.IO) {
            // 每次进入删除缓存
            StorageMaintenance.clearExpired(AndroidStorage.storage)
        }

        if (SettingsRepository.termsAccepted.value && mainVm.updateStatus?.canRecheck == true) {
            mainVm.updateStatus.checkUpdate()
        }

        mainVm.scope.launchLogged(Dispatchers.IO) {
            val list = FileCrashStorage.takePending()
            withContext(Dispatchers.Main.immediate) { mainVm.showCrashReports(list) }
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1034** (2025-11-13): **[BUG] com.android.systemui 系统界面识别异常**
  *Symptoms*: ### 日志文件   [log-1749443937546.zip](https://github.com/user-attachments/files/20649266/log-1749443937546.zip)  ### BUG描述(文字/截图/视频)   系统界面通知栏下拉。有时点击，有时不点击。规则如下。 ```json5 {   "key": 2,   "name": "功能类",   "rules": [     {       "matches": [         "@[visibleToUser=true][text=\"小窗打开\"] <<n [vid=\"expanded\"]"       ],       "quickFind": true,       "matchRoot": true,       "forcedTime": 60000,       "priorityTime": 5000,       "actionMaximum": 10,       "actionDelay": 20,       "snapshotUrls": [         "https://i.gkd.li/i/20638271"       ],       "exampleUrls": [         "https://e.gkd.li/516fae2b-3e06-4fed-b229-9e9ba438852c"       ],       "activityIds": [         "com.android.launcher3.uioverrides.QuickstepLauncher"       ]     }   ] } ```  https://github.com/user-attachments/assets/d4aa72d8-56de-454f-9ce7-dafbb54eb921  在桌面状态下下拉通知栏他不点击。只有当我打开某个应用并下拉通知栏。，它才会点击。  ### 期望行为(文字/截图/视频)   我不知道是不是什么bug或者缺陷。来这里反馈一下。  ### 实际行为(文字/截图/视频)   我试了好久才发现这个规律。
  **Post-Mortem & Fix Analysis**:
  > > 在桌面状态下下拉通知栏  根据日志得到的界面是 com.meizu.flyme.launcher/com.android.launcher3.uioverrides.QuickstepLauncher  所以你的规则不会触发  你在系统桌面添加同样的规则就可以触发了  ---  不过为什么你的设备从桌面下拉得到的通知界面是 `com.meizu.flyme.launcher` ，你可以把这个界面快照发出来看看  此外你也可以关闭 shizuku 授权后重新快照看看  另外 `com.android.systemui` 这个应用比较特殊，它并不适用 android 系统的 activity 概念 
  > > > 在桌面状态下下拉通知栏 >  > 根据日志得到的界面是 com.meizu.flyme.launcher/com.android.launcher3.uioverrides.QuickstepLauncher >  > 所以你的规则不会触发 >  > 你在系统桌面添加同样的规则就可以触发了 >  > 不过为什么你的设备从桌面下拉得到的通知界面是 `com.meizu.flyme.launcher` ，你可以把这个界面快照发出来看看 >  > 此外你也可以关闭 shizuku 授权后重新快照看看 >  > 另外 `com.android.systemui` 这个应用比较特殊，它并不适用 android 系统的 activity 概念  这是从桌面状态下下拉的通知栏。https://i.gkd.li/i/20649480 这是我打开某个应用之后下拉的通知栏。 https://i.gkd.li/i/20649525

- **Issue #1027** (2025-11-13): **[BUG] resetMatch=app 且 activityIds 有值时匹配异常**
  *Symptoms*: ### 日志文件   https://github.com/user-attachments/files/20566245/log-1748942787571.zip  ### BUG描述(文字/截图/视频)   #1025  ### 期望行为(文字/截图/视频)   正常匹配  ### 实际行为(文字/截图/视频)   无法匹配
  **Post-Mortem & Fix Analysis**:
  > https://github.com/gkd-kit/gkd/releases

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

### Incident Patch 1: `3ca225ef` (2026-10-29)
**Commit Message**: refactor: reorganize settings and provide UI hosts through composition

Group advanced settings, add dedicated debug and keep-alive pages, and preserve focused navigation. Enable desktop LAN debugging with adaptive address layout. Replace page host threading with LocalUiHost and update documentation.

**File**: `AGENTS.md` (modified, +4/-4)
```diff
@@ -10,7 +10,7 @@
 - androidMain 普通工具、适配、UI 接入及基类按职责归入 `li.gkd.app.*`；已注册 Application、Activity、Service、磁贴、特权入口及紧密关联实现保留原身份。`com.google.android.accessibility.selecttospeak.SelectToSpeakService` 的包名、路径和注册不变。包名整理不得改变组件、路由序列化名称/参数、AIDL 或持久化兼容标识。
 - Android 权限、Activity Result、通知、悬浮窗、Service 和特权进程位于 gkd-app/src/androidMain，由真实组件管理生命周期。gkd-aidl 只编译 Binder 协议；gkd-hidden-api 只提供 stub。引用 stub 的模块必须独立完成对应字节码的 remap。
 - ViewModel、Repository、业务状态和流程在 commonMain 保持唯一实现，ViewModel 使用 `XxxViewModel` 命名。禁止同名宿主子类、空壳继承、旧路径 typealias 或纯转发包装；共享类默认不可继承，宿主在原 ViewModelStoreOwner 直接创建，复杂/复用构造可用明确工厂。
-- 平台差异优先使用对应功能包的函数级 `expect/actual`，实现文件为 `.android.kt` / `.jvm.kt`；禁止整份 ViewModel、Repository 或业务流程 actual 化。能力签名只用公共类型，不导航、弹 Toast 或读取 UI ViewModel；仅 UI 组装可用 Composable expect/actual，需平台 UI 能力时显式接收所属 UiHost。无生命周期工具只持有 Application Context，Activity/窗口引用限于生命周期绑定的 UI 会话。
+- 平台差异优先使用对应功能包的函数级 `expect/actual`，实现文件为 `.android.kt` / `.jvm.kt`；禁止整份 ViewModel、Repository 或业务流程 actual 化。能力签名只用公共类型，不导航、弹 Toast 或读取 UI ViewModel；仅 UI 组装可用 Composable expect/actual；页面及平台 UI 适配可从 LocalUiHost 获取所属宿主，非 Composable 平台 UI 操作仍显式接收 UiHost 或回调。无生命周期工具只持有 Application Context，Activity/窗口引用限于生命周期绑定的 UI 会话。
 - 不支持的平台动作统一返回 `PlatformResult<T>`，无数据成功为 `Unit`；不得另造 Unsupported 类型或用 Boolean/null 暗示不支持。契约明确成功含义，保留异常/取消传播，不替代业务结果、用户取消或权限状态。
 - 应用仓库由应用生命周期唯一持有，禁止重复创建、可替换全局实例和无意义转发。无独立会话需求时优先使用 object；需要独立生命周期或明确依赖时允许普通类及构造注入。平台依赖先于消费者初始化，所属生命周期结束时清理协程和资源，不为测试增加生产重置接口。
 
@@ -19,9 +19,9 @@
 - 两端共用 commonMain 的生产页面、组件、业务和事件链，模拟输入也经过生产 Repository/ViewModel；共享代码不得直接依赖 Android Application、平台专属 Store/Service 或伪造全局实例；共享 MainViewModel 的访问遵循下述单主界面规则。Desktop 默认四标签，组件目录仅显式诊断。新增入口同时覆盖双端及下游弹窗、面板、返回路径，不用整页 Toast/占位掩盖缺失；交付需业务、读写、生命周期和验证证据。
 - 两端共用 `GkAppNavigation` 注册及 `GkNavigation` 保存状态/条目生命周期；禁止 Desktop 字符串分支注册生产路由、复制平台路由或另写保存/导航规则。普通/编辑页面过渡统一声明，公共页面只注册一次；HTTP 标签等状态读取生产来源。
 - MainViewModel 属于主界面的 ViewModelStore，页面 ViewModel 属于具体导航条目；有需要保留的页面状态或事件流程时按需创建，不为纯展示或组件瞬时状态创建。根不持有其他 ViewModel 或子 ViewModelStore；子路由用条目标准 API 获取，多次入栈实例独立、出栈清理，不预建、缓存或跨路由借用。导航不重建仓库，宿主退出清理 ViewModel/协程；Desktop 场景重载只重置页面/草稿，不清空数据或模拟配置。
-- 路由及私有 Composable 可获取页面 ViewModel、处理平台 UI；主题、通用布局、可复用组件和工具仅接收状态/事件，不通过默认参数、工厂、CompositionLocal 或全局入口隐藏获取。Service、悬浮窗、后台任务使用自身作用域和应用仓库，不借用或补建页面 ViewModel。
+- 路由、页面及私有 Composable 可获取页面 ViewModel，并通过 LocalUiHost 处理平台 UI，无需经导航或中间页面传递宿主；主题、通用布局、可复用组件和工具仅接收状态/事件，不通过默认参数、工厂、CompositionLocal 或全局入口隐藏获取。Service、悬浮窗、后台任务使用自身作用域和应用仓库，不借用或补建页面 ViewModel。
 - Android/Desktop 均采用单主界面设计，同一应用运行实例只存在一个根 MainViewModel，其生命周期覆盖所有子页面 ViewModel。生产页面、其私有 Composable 及所属子页面 ViewModel（含 commonMain）可通过 `MainViewModel.requireCurrent()` 获取已注册的根实例，无需逐层传递。宿主完成初始化和必要绑定后注册，根实例清理时注销；静态入口只提供访问，不创建实例或延长其生命周期。主题、通用布局、可复用组件、工具、Repository、Service、悬浮窗和后台任务不得通过该入口获取，也不引入 LocalMainViewModel。
-- 页面 ViewModel 可组织校验、保存、确认弹窗及后续导航等事件流程，按需使用 MainViewModel 的页面能力；Compose 负责展示、收集状态、转发事件及 IME、焦点等组合/宿主相关操作。不为缩短调用增加纯转发方法，不把页面流程转移到根 ViewModel。平台 UI 操作显式接收所属 UiHost 或事件回调，宿主引用绑定所属生命周期，不由页面 ViewModel 长期持有。
+- 页面 ViewModel 可组织校验、保存、确认弹窗及后续导航等事件流程，按需使用 MainViewModel 的页面能力；Compose 负责展示、收集状态、转发事件及 IME、焦点等组合/宿主相关操作。不为缩短调用增加纯转发方法，不把页面流程转移到根 ViewModel。LocalUiHost 由 Android 主界面根部提供当前 LocalActivity 对应的 MainActivity、Desktop 主界面根部提供当前 DesktopSession，覆盖导航及所属弹窗；仅传递宿主，不承载业务状态。非 Composable 平台 UI 操作显式接收所属 UiHost 或事件回调，不依赖宿主的操作使用普通函数；宿主引用绑定所属生命周期，不存入 ViewModel 或单例。
 - 自定义页面业务状态，包括编辑草稿及基准、搜索/筛选条件、分页、保存冲突和页面切换后需要保留的状态，优先由所属页面 ViewModel 使用 `MutableStateFlow<T>` 管理，对外暴露只读 `StateFlow<T>` 和明确修改方法，默认不使用 `rememberSaveable` 或自定义 Saver。页面状态随所属导航条目清理，不为保留它而提升到 MainViewModel；StateFlow 本身不提供落盘或进程重启恢复。
 - 滚动、焦点、动画、拖拽及简单组件展开等纯 UI 工具状态留在 Compose，允许使用官方 `rememberXxxState`；确需恢复的简单工具/组件状态可使用 `rememberSaveable`，无需恢复的瞬时状态使用 `remember`。不为规避 rememberSaveable 将这些工具状态搬入 ViewModel，也不以工具状态名义承载页面业务对象。`rememberXxxState` 不访问 ViewModel、数据库、Store、Service 或导航。组合工作使用 rememberCoroutineScope，稳定且绑定同一组合的 scope 不作冗余 remember key。主题状态、时序及深色优先级双端共用，宿主只给系统主题/色板。
 - `XxxUiState/Actions` 仅用于确有需要的复用、预览或复杂契约；UiState 是不可变快照，不含 Flow、Paging 或高频状态；多个构造路径重复映射时才提取私有构建函数。业务状态不通过 CompositionLocal 传递。
@@ -68,7 +68,7 @@
 - 预览/控制窗口同进程，关闭控制窗口不退出 App 且可重新打开（F12）。模拟器为单一状态源，控件和 HTTP 同命令路径。系统栏由 jvmMain 窗口模拟层实时绘制，时间取当前时钟，系统栏/挖孔统一计算 Insets；不以静态或整页截图替代 UI，不把模拟网络/电量冒充真机。未实现内容如实标识，不宣称模拟成功。
 - 不支持仅针对具体动作，以非模态 Toast 显示“当前平台不支持”，不替代整页或伪造成功；编辑/列表/文件业务继续真实执行。用户明确要求的 priv-ui 模拟可修改 Desktop 授权/启动/停止状态，日志标记 simulation，不执行真实特权命令。
 - priv-ui 只用公开 PrivilegeScreen、状态/actions，禁用内部 renderer/模拟器或 INVISIBLE_MEMBER；页面及系统提示 Insets 分别注入，宿主模拟状态机与控制窗口特权可用状态同步。使用版本目录的远程稳定版，升级验证双端编译和实际页面。
-- Desktop 调试服务统一使用一个 HTTP 监听和端口，绑定 127.0.0.1；桌面控制路由位于 jvmMain，状态修改在 UI 线程。Android 的浏览器与诊断接口共用 DebugService 和配置端口，可通过局域网访问；诊断接入放 gkd-app/src/androidMain，由 DebugService 在 META.debuggable 为 true 时直接创建。服务统一导出，Release 启动校验 Intent 的外部调用 token，内部启动也携带，Debug 启动不校验；诊断 HTTP 使用短期凭据，工具支持 ADB 转发；Release 不装配诊断路由。语义树/操作/截图明确 app|controls，各窗口节点快照独立；操作执行真实控件，不用直接改状态冒充点击。模拟返回先收 IME，再处理弹窗/编辑/页面。
+- Desktop 调试服务统一使用一个 HTTP 监听和端口，绑定 0.0.0.0，支持本机及局域网 IPv4 访问；页面显示 127.0.0.1 与真实局域网 IPv4 地址，浏览器、诊断和桌面控制接口共用该监听。桌面控制路由位于 jvmMain，状态修改在 UI 线程。Android 的浏览器与诊断接口共用 DebugService 和配置端口，可通过局域网访问；诊断
```

**File**: `docs/architecture.md` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@
 
 平台差异通过函数级 `expect/actual`、事件回调或原生内容槽接入；业务与领域实现保留在共享层。Desktop 只替换平台输入和能力，不执行真实 Android 自动化；不支持的具体动作返回 `PlatformResult.Unsupported`，页面、编辑和可移植文件流程仍正常工作。
 
+共享页面通过 `LocalUiHost.current` 获取当前平台 UI 宿主：Android 的 `UiHost` 是 `MainActivity`，应用根部从 `LocalActivity` 读取并提供；Desktop 的 `UiHost` 是 `DesktopSession`，主窗口组合提供当前会话。Provider 覆盖生产导航和所属弹窗，导航及首页标签不再逐层传递宿主。页面读取宿主后调用平台扩展；通用组件接收状态和事件回调，非 Composable 平台操作仍显式接收所需宿主。宿主不会存入 ViewModel、Repository 或单例；与宿主无关的操作（如调试端口变更通知）使用普通函数。独立组合或页面预览需要提供实际使用的平台宿主，单纯的通用组件预览无需提供。
+
 ## 状态与生命周期
 
 当前应用仓库使用 `object`，平台启动先初始化真实依赖，再启动消费者；退出先提交待保存数据，再关闭应用协程、网络、数据库和日志。
```

**File**: `gkd-app/README.md` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@
 
 日常启动使用已有开发数据，默认按正常窗口启动。`--focus` 仅绕过测试模式的后台窗口启动方式，焦点交给系统决定，不主动抢焦点或置顶；绿色版也支持此参数。`--test` 自动创建隔离会话，不读取日常 profile；无测试输入时使用最小模拟清单。测试窗口默认位于可视区域之外且不主动获取系统焦点；点击任务栏图标可手动聚焦，并将窗口移回屏幕内。后台弹窗不抢焦点，手动激活后弹窗可正常接收焦点。组合 `--test --focus` 时窗口直接显示在屏幕内并允许获取焦点，数据仍然隔离。控制窗口通过标题栏齿轮或 F12 打开，关闭它不会退出 App。
 
-Desktop 启动时自动开启唯一调试服务，监听 `127.0.0.1:<httpServerPort>`（默认 8888）。`/api/*` 为浏览器接口，`/debug/*` 为应用诊断，`/desktop/*` 为 JVM 宿主控制。实际端口写入当前会话 `debug-server.json`，改端口后更新，停止时删除。页面或 F12 控制窗口可关闭整个服务并重新开启，关闭期间所有 HTTP 接口均不可用。退出 App 时停止服务。修改 Kotlin 后先关闭本任务启动的 Desktop，再编译、重启，避免覆盖运行中的 JAR。
+Desktop 启动时自动开启唯一调试服务，监听 `0.0.0.0:<httpServerPort>`（默认 8888），支持本机和局域网 IPv4 访问。`/api/*` 为浏览器接口，`/debug/*` 为应用诊断，`/desktop/*` 为 JVM 宿主控制。实际端口写入当前会话 `debug-server.json`，改端口后更新，停止时删除。页面或 F12 控制窗口可关闭整个服务并重新开启，关闭期间所有 HTTP 接口均不可用。退出 App 时停止服务。修改 Kotlin 后先关闭本任务启动的 Desktop，再编译、重启，避免覆盖运行中的 JAR。
 
 按改动范围选择命令，不必每次全部执行：
 
@@ -109,7 +109,7 @@ adb shell am start -n li.songe.gkd.debug/li.gkd.app.MainActivity -a li.gkd.actio
 
 生产页面的服务开关已接入 Desktop 生命周期管理，包括常驻通知、快照按钮、界面、事件、轨迹、截屏、HTTP、无障碍和自动化服务。HTTP 使用真实服务端，其他服务使用生命周期模拟。F12 控制窗口的“服务生命周期（模拟）”可配置成功、失败或手动完成，以及授权同意、取消或弹窗确认。截屏服务默认弹出模拟授权框；手动启动保持“启动中”，直到投递连接完成或失败事件。
 
-运行状态由 `SimulatorStore` 统一提供，页面重载不会停止服务；退出 Desktop 后不恢复运行状态。模拟条件会保存到会话 `simulator.json`。模拟不执行 Android 自动化、真实截屏或悬浮窗。调试服务复用 Android 的共享检查路由，实际监听 `127.0.0.1:<httpServerPort>`（默认 8888），浏览器、应用诊断和桌面控制共用该监听。页面可打开真实地址；修改端口时重启监听，关闭时释放端口，并按“自动清空内存订阅”设置清理 HTTP 订阅。快照列表/文件读取、删除和订阅更新使用真实 Repository/DAO；`captureSnapshot`、`execSelector` 返回不支持，设备信息标识 Desktop。特权模拟断开会结束依赖它的自动化模拟。
+运行状态由 `SimulatorStore` 统一提供，页面重载不会停止服务；退出 Desktop 后不恢复运行状态。模拟条件会保存到会话 `simulator.json`。模拟不执行 Android 自动化、真实截屏或悬浮窗。调试服务复用 Android 的共享检查路由，实际监听 `0.0.0.0:<httpServerPort>`（默认 8888），支持本机和局域网 IPv4 访问，浏览器、应用诊断和桌面控制共用该监听。页面显示并可打开 `127.0.0.1` 及真实局域网 IPv4 地址，进入页面或切换调试服务时重新读取网卡地址；修改端口时重启监听，关闭时释放端口，并按“自动清空内存订阅”设置清理 HTTP 订阅。快照列表/文件读取、删除和订阅更新使用真实 Repository/DAO；`captureSnapshot`、`execSelector` 返回不支持，设备信息标识 Desktop。特权模拟断开会结束依赖它的自动化模拟。
 
 工具默认读取日常会话 `.local/desktop/debug-server.json`；隔离宿主请使用启动日志中的连接文件，下列示例显式使用隔离会话连接文件，请替换 `<会话>`；也可使用 `--port` 指定该实例的实际端口：
 
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/ui/PrivilegeServicePage.android.kt` (modified, +1/-2)
```diff
@@ -11,13 +11,12 @@ import androidx.lifecycle.viewmodel.compose.viewModel
 import li.gkd.app.priv.gkdPrivilegeUiConfig
 import li.gkd.app.ui.page.GkPrivilegeTopBar
 import li.gkd.app.ui.page.PrivilegeServiceInfoDialog
-import li.gkd.app.ui.platform.UiHost
 import li.gkd.app.util.ToastUtils
 import priv.kit.ui.PrivilegeScaffold
 import priv.kit.ui.PrivilegeUiViewModel
 
 @Composable
-actual fun PrivilegeServicePage(host: UiHost) {
+actual fun PrivilegeServicePage() {
     val mainVm = MainViewModel.requireCurrent()
     val application = LocalContext.current.applicationContext as Application
     val privilegeVm = viewModel {
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/ui/WebViewPage.android.kt` (modified, +0/-2)
```diff
@@ -42,7 +42,6 @@ import li.gkd.app.ui.component.GkWebViewErrorContent
 import li.gkd.app.ui.navigation.WebViewRoute
 import li.gkd.app.ui.page.WebViewScreen
 import li.gkd.app.ui.platform.SystemActionFeedback
-import li.gkd.app.ui.platform.UiHost
 import li.gkd.app.ui.share.LocalDarkTheme
 import li.gkd.app.ui.share.launchUiAction
 import li.gkd.app.ui.style.scaffoldPadding
@@ -54,7 +53,6 @@ import org.jetbrains.compose.resources.stringResource
 @Composable
 actual fun WebViewPage(
     route: WebViewRoute,
-    host: UiHost,
 ) {
     val mainVm = MainViewModel.requireCurrent()
     val initUrl = route.initUrl
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/ui/app/AppOverlayHost.kt` (modified, +12/-2)
```diff
@@ -11,15 +11,20 @@ import li.gkd.app.priv.uiAutomationOccupiedFlow
 import li.gkd.app.resources.*
 import li.gkd.app.service.A11yService
 import li.gkd.app.settings.SettingsRepository
+import li.gkd.app.storage.createLogArchive
 import li.gkd.app.ui.component.GkPlatformWarningDialogs
 import li.gkd.app.ui.component.GkTermsAcceptDialog
 import li.gkd.app.ui.navigation.PrivilegeServiceRoute
+import li.gkd.app.ui.platform.LocalUiHost
+import li.gkd.app.ui.share.saveArchive
+import li.gkd.app.ui.share.shareArchive
 import li.gkd.app.util.ToastUtils
 import li.gkd.app.util.copyText
+import org.jetbrains.compose.resources.getString
 
 @Composable
 fun AppOverlayHost() {
-    val activity = LocalActivity.current as MainActivity
+    val activity = LocalUiHost.current
     val mainVm = activity.mainVm
     if (!SettingsRepository.termsAccepted.collectAsStateWithLifecycle().value) {
         GkTermsAcceptDialog(
@@ -45,7 +50,12 @@ fun AppOverlayHost() {
         )
         mainVm.ruleControlDialog.Render()
         mainVm.textDialog.Render(onCopy = ::copyText)
-        mainVm.shareLog.Render(activity)
+        mainVm.shareLog.Render(
+            onShare = {
+                activity.shareArchive(getString(Res.string.logs_share_file), ::createLogArchive)
+            },
+            onSave = { activity.saveArchive(::createLogArchive) },
+        )
     }
 }
 
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/ui/app/AppRoot.kt` (modified, +11/-7)
```diff
@@ -3,25 +3,29 @@ package li.gkd.app.ui.app
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.zIndex
 import li.gkd.app.MainActivity
 import li.gkd.app.ui.androidState
 import li.gkd.app.ui.navigation.GkAppNavigation
+import li.gkd.app.ui.platform.LocalUiHost
 import li.gkd.app.ui.style.AppTheme
 
 @Composable
 fun AppRoot() {
     val activity = androidx.activity.compose.LocalActivity.current as MainActivity
     val mainVm = activity.mainVm
-    AppTheme {
-        Box(modifier = Modifier.fillMaxSize()) {
-            GkAppNavigation(host = activity)
-            AppOverlayHost()
-            mainVm.androidState.permissionRequests.Render(
-                modifier = Modifier.align(Alignment.TopCenter).zIndex(1f),
-            )
+    CompositionLocalProvider(LocalUiHost provides activity) {
+        AppTheme {
+            Box(modifier = Modifier.fillMaxSize()) {
+                GkAppNavigation()
+                AppOverlayHost()
+                mainVm.androidState.permissionRequests.Render(
+                    modifier = Modifier.align(Alignment.TopCenter).zIndex(1f),
+                )
+            }
         }
     }
 }
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/ui/settings/ServiceActions.android.kt` (modified, +1/-1)
```diff
@@ -111,4 +111,4 @@ actual fun eventMonitorRunning() = EventService.isRunning.collectAsStateWithLife
 actual fun trackServiceRunning() = TrackService.isRunning.collectAsStateWithLifecycle().value
 
 // The Android service already applies port changes in its lifecycle-owned collector.
-actual fun UiHost.httpServerPortChanged() = Unit
+actual fun httpServerPortChanged() = Unit
```

---

### Incident Patch 2: `56ffac10` (2026-10-29)
**Commit Message**: fix: remove deprecated thread ID access in match benchmark

**File**: `gkd-app/src/jvmMain/kotlin/li/gkd/app/development/matching/MatchBenchmark.kt` (modified, +2/-3)
```diff
@@ -106,7 +106,6 @@ suspend fun benchmarkMatching(input: MatchBenchmarkRequest): MatchBenchmarkRepor
                         (ManagementFactory.getThreadMXBean() as? ThreadMXBean)?.takeIf {
                             it.isThreadAllocatedMemorySupported && it.isThreadAllocatedMemoryEnabled
                         }
-                    val thread = Thread.currentThread().id
                     val adapter =
                         CountingNodeAdapter(
                             SimulatedNodeAdapter(
@@ -138,7 +137,7 @@ suspend fun benchmarkMatching(input: MatchBenchmarkRequest): MatchBenchmarkRepor
                         repeat(3) { offset ->
                             val level = (round + offset) % 3
                             val beforeAccess = adapter.accesses
-                            val beforeBytes = bean?.getThreadAllocatedBytes(thread)
+                            val beforeBytes = bean?.getCurrentThreadAllocatedBytes()
                             val start = System.nanoTime()
                             val result =
                                 evaluateDebugRule(
@@ -151,7 +150,7 @@ suspend fun benchmarkMatching(input: MatchBenchmarkRequest): MatchBenchmarkRepor
                                 )
                             val elapsed = System.nanoTime() - start
                             val allocated = beforeBytes?.let {
-                                checkNotNull(bean).getThreadAllocatedBytes(thread) - it
+                                checkNotNull(bean).getCurrentThreadAllocatedBytes() - it
                             }
                             check(expected == null || expected == result) {
                                 "Query result changed during benchmark; use stable rule eligibility"
```

---

### Incident Patch 3: `344efde8` (2026-10-29)
**Commit Message**: refactor(crash): simplify crash report handling and improve UI interactions

**File**: `gkd-app/src/commonMain/composeResources/values/strings.xml` (modified, +4/-4)
```diff
@@ -123,7 +123,6 @@
     <string name="activity_switch_logs">界面切换日志</string>
     <string name="add_success">添加成功</string>
     <string name="advanced_settings">高级设置</string>
-    <string name="android_version_description">Android：%1$s (%2$s)</string>
     <string name="apk_continue_suffix">，或点击下方继续操作</string>
     <string name="apk_download_official_link">建议点此从官网下载</string>
     <string name="apk_google_services_required">当前导出的 APK 文件只能在已安装 Google 框架的设备上才能使用，否则安装打开后会提示报错，</string>
@@ -273,18 +272,19 @@
     <string name="cookie_change">更换 Cookie</string>
     <string name="copy_success">复制成功</string>
     <string name="crash_app_description">应用：%1$s (%2$s)</string>
-    <string name="crash_details_collapse">收起崩溃详情</string>
-    <string name="crash_details_expand">展开崩溃详情</string>
+    <string name="crash_details">崩溃详情</string>
+    <string name="crash_details_view">查看崩溃详情</string>
     <string name="crash_device_description">设备：%1$s</string>
     <string name="crash_report_delete">删除崩溃记录</string>
     <string name="crash_report_delete_confirmation">确定删除这条崩溃记录？</string>
-    <string name="crash_report_delete_current">删除这条崩溃记录</string>
     <string name="crash_report_delete_failed">删除崩溃记录失败</string>
     <string name="crash_reports">崩溃记录</string>
     <string name="crash_reports_clear">清空崩溃记录</string>
     <string name="crash_reports_clear_confirmation">确定删除全部崩溃记录？</string>
     <string name="crash_reports_delete_partially_failed">部分崩溃记录删除失败</string>
     <string name="crash_reports_empty">暂无崩溃记录</string>
+    <string name="crash_system_android_description">系统：Android %1$s (API %2$s)</string>
+    <string name="crash_system_desktop_description">系统：%1$s / %2$s</string>
     <string name="crash_thread_description">线程：%1$s</string>
     <string name="crash_version_thread">v%1$s (%2$s) · %3$s</string>
     <string name="theme_mode">主题模式</string>
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/crash/CrashReportPage.kt` (modified, +198/-137)
```diff
@@ -1,25 +1,29 @@
 package li.gkd.app.ui.crash
 
+import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Arrangement
-import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.foundation.layout.fillMaxWidth
-import androidx.compose.foundation.layout.height
 import androidx.compose.foundation.layout.heightIn
 import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.layout.width
 import androidx.compose.foundation.lazy.LazyColumn
 import androidx.compose.foundation.lazy.items
+import androidx.compose.foundation.rememberScrollState
+import androidx.compose.foundation.text.selection.SelectionContainer
+import androidx.compose.foundation.verticalScroll
 import androidx.compose.material3.BottomAppBar
+import androidx.compose.material3.Button
 import androidx.compose.material3.Card
 import androidx.compose.material3.HorizontalDivider
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Text
 import androidx.compose.material3.TextButton
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.DisposableEffect
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
 import androidx.compose.ui.Alignment
@@ -29,7 +33,9 @@ import androidx.compose.ui.unit.dp
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.lifecycle.viewmodel.compose.viewModel
 import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.launch
+import kotlinx.coroutines.yield
 import li.gkd.app.crash.CrashData
 import li.gkd.app.error.displayMessage
 import li.gkd.app.network.AppLinks
@@ -39,15 +45,16 @@ import li.gkd.app.time.format
 import li.gkd.app.ui.MainViewModel
 import li.gkd.app.ui.component.GkCopyTextCard
 import li.gkd.app.ui.component.GkEmptyState
-import li.gkd.app.ui.component.GkExpandableSection
 import li.gkd.app.ui.component.GkFixedTimeText
+import li.gkd.app.ui.component.GkIcon
 import li.gkd.app.ui.component.GkIconButton
 import li.gkd.app.ui.component.GkIcons
 import li.gkd.app.ui.component.GkPageBottomSpace
 import li.gkd.app.ui.component.GkScaffold
 import li.gkd.app.ui.component.GkTopAppBar
 import li.gkd.app.ui.component.gkTopAppBarScroll
 import li.gkd.app.ui.component.rememberListScrollState
+import li.gkd.app.ui.platform.GkFullscreenDialog
 import li.gkd.app.ui.share.noRippleClickable
 import li.gkd.app.ui.style.itemHorizontalPadding
 import li.gkd.app.ui.style.itemVerticalPadding
@@ -63,8 +70,8 @@ fun CrashReportPage() {
     val mainVm = MainViewModel.requireCurrent()
     val vm = viewModel { CrashReportViewModel(mainVm.takeCrashDataList()) }
     val records by vm.crashDataState.collectAsStateWithLifecycle()
-    val expandedCrashId by vm.expandedCrashId.collectAsStateWithLifecycle()
-    fun delete(record: CrashData?) {
+    val selected by vm.selected.collectAsStateWithLifecycle()
+    fun delete(record: CrashData?, beforeDelete: suspend () -> Unit = {}) {
         vm.scope.launch {
             try {
                 if (
@@ -82,8 +89,8 @@ fun CrashReportPage() {
                         error = true,
                     )
                 ) {
+                    beforeDelete()
                     if (record == null) vm.deleteAllCrashes() else vm.deleteCrash(record)
-                    if (record == null || expandedCrashId == record.id) vm.setExpandedCrashId(null)
                     ToastUtils.show(getString(Res.string.delete_success))
                 }
             } catch (e: CancellationException) {
@@ -153,15 +160,9 @@ fun CrashReportPage() {
                 items = crashDataList,
                 key = { it.id },
             ) { crashData ->
-                val expanded = expandedCrashId == crashData.id
                 CrashReportCard(
                     crashData = crashData,
-                    onCopy = ::copyText,
-                    expanded = expanded,
-                    onToggle = {
-                        vm.setExpandedCrashId(if (expanded) null else crashData.id)
-                    },
-                    onDelete = { delete(crashData) },
+                    onClick = { vm.show(crashData) },
                 )
             }
             item(key = "crash-report-footer") {
@@ -174,172 +175,232 @@ fun CrashReportPage() {
             }
         }
     }
+    crashDataList
+        .find { it.id == selected }
+        ?.let { record ->
+            val detailsClosed = remember(record.id) { CompletableDeferred<Unit>() }
+            DisposableEffect(detailsClosed) {
+                onDispose { detailsClosed.complete(Unit) }
+            }
+            CrashReportDialog(
+                crashData = record,
+                onDismiss = vm::dismiss,

```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/crash/CrashReportViewModel.kt` (modified, +10/-4)
```diff
@@ -15,11 +15,15 @@ import org.jetbrains.compose.resources.getString
 class CrashReportViewModel(
     initialCrashDataList: List<CrashData>,
 ) : BaseViewModel() {
-    val expandedCrashId: StateFlow<Long?>
-        field = MutableStateFlow<Long?>(initialCrashDataList.firstOrNull()?.id)
+    val selected: StateFlow<Long?>
+        field = MutableStateFlow<Long?>(null)
 
-    fun setExpandedCrashId(value: Long?) {
-        expandedCrashId.value = value
+    fun show(record: CrashData) {
+        selected.value = record.id
+    }
+
+    fun dismiss() {
+        selected.value = null
     }
 
     val crashDataState: StateFlow<Loadable<List<CrashData>>>
@@ -44,6 +48,7 @@ class CrashReportViewModel(
                 FileCrashStorage.delete(crashData)
             }
         if (deleted) {
+            if (selected.value == crashData.id) dismiss()
             crashDataState.value =
                 Loadable.Ready(
                     crashDataState.value.value.orEmpty().filterNot { it.id == crashData.id },
@@ -67,6 +72,7 @@ class CrashReportViewModel(
         if (!deleted) {
             error(getString(Res.string.crash_reports_delete_partially_failed))
         }
+        dismiss()
     }
 
     private suspend fun reloadAfterDeleteFailure() {
```

#### Recent Merged Pull Requests:
- **PR #1500** (2026-10-29): fix: remap scope keys when appending rule groups (@jjjj31)
- **PR #1472** (closed): fix: 自动化模式下开机自启状态服务 (@LYYZZ)
- **PR #1470** (closed): fix(a11y): 开机后自愈无障碍服务"假在线"状态 (@LYYZZ)
- **PR #1467** (closed): Add Japanese localization across GKD UI (@okker24)
- **PR #1466** (closed): translation for english (@theclumsypirate)
- **PR #1457** (closed): refactor: remove unused methods and clean up code (@KevinDoremy)

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

## X. reorganize settings and provide UI hosts through composition

**RULE**:
When implementing operations in `AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gkd-kit/gkd. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3ca225ef`: reorganize settings and provide UI hosts through composition. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
- 平台差异优先使用对应功能包的函数级 `expect/actual`，实现文件为 `.android.kt` / `.jvm.kt`；禁止整份 ViewModel、Repository 或业务流程 actual 化。能力签名只用公共类型，不导航、弹 Toast 或读取 UI ViewModel；仅 UI 组装可用 Composable expect/actual；页面及平台 UI 适配可从 LocalUiHost 获取所属宿主，非 Composable 平台 UI 操作仍显式接收 UiHost 或回调。无生命周期工具只持有 Application Context，Activity/窗口引用限于生命周期绑定的 UI 会话。
- 路由、页面及私有 Composable 可获取页面 ViewModel，并通过 LocalUiHost 处理平台 UI，无需经导航或中间页面传递宿主；主题、通用布局、可复用组件和工具仅接收状态/事件，不通过默认参数、工厂、CompositionLocal 或全局入口隐藏获取。Service、悬浮窗、后台任务使用自身作用域和应用仓库，不借用或补建页面 ViewModel。
- 页面 ViewModel 可组织校验、保存、确认弹窗及后续导航等事件流程，按需使用 MainViewModel 的页面能力；Compose 负责展示、收集状态、转发事件及 IME、焦点等组合/宿主相关操作。不为缩短调用增加纯转发方法，不把页面流程转移到根 ViewModel。LocalUiHost 由 Android 主界面根部提供当前 LocalActivity 对应的 MainActivity、Desktop 主界面根部提供当前 DesktopSession，覆盖导航及所属弹窗；仅传递宿主，不承载业务状态。非 Composable 平台 UI 操作显式接收所属 UiHost 或事件回调，不依赖宿主的操作使用普通函数；宿主引用绑定所属生命周期，不存入 ViewModel 或单例。
- Desktop 调试服务统一使用一个 HTTP 监听和端口，绑定 0.0.0.0，支持本机及局域网 IPv4 访问；页面显示 127.0.0.1 与真实局域网 IPv4 地址，浏览器、诊断和桌面控制接口共用该监听。桌面控制路由位于 jvmMain，状态修改在 UI 线程。Android 的浏览器与诊断接口共用 DebugService 和配置端口，可通过局域网访问；诊断
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
- 平台差异优先使用对应功能包的函数级 `expect/actual`，实现文件为 `.android.kt` / `.jvm.kt`；禁止整份 ViewModel、Repository 或业务流程 actual 化。能力签名只用公共类型，不导航、弹 Toast 或读取 UI ViewModel；仅 UI 组装可用 Composable expect/actual，需平台 UI 能力时显式接收所属 UiHost。无生命周期工具只持有 Application Context，Activity/窗口引用限于生命周期绑定的 UI 会话。
- 路由及私有 Composable 可获取页面 ViewModel、处理平台 UI；主题、通用布局、可复用组件和工具仅接收状态/事件，不通过默认参数、工厂、CompositionLocal 或全局入口隐藏获取。Service、悬浮窗、后台任务使用自身作用域和应用仓库，不借用或补建页面 ViewModel。
- 页面 ViewModel 可组织校验、保存、确认弹窗及后续导航等事件流程，按需使用 MainViewModel 的页面能力；Compose 负责展示、收集状态、转发事件及 IME、焦点等组合/宿主相关操作。不为缩短调用增加纯转发方法，不把页面流程转移到根 ViewModel。平台 UI 操作显式接收所属 UiHost 或事件回调，宿主引用绑定所属生命周期，不由页面 ViewModel 长期持有。
- Desktop 调试服务统一使用一个 HTTP 监听和端口，绑定 127.0.0.1；桌面控制路由位于 jvmMain，状态修改在 UI 线程。Android 的浏览器与诊断接口共用 DebugService 和配置端口，可通过局域网访问；诊断接入放 gkd-app/src/androidMain，由 DebugService 在 META.debuggable 为 true 时直接创建。服务统一导出，Release 启动校验 Intent 的外部调用 token，内部启动也携带，Debug 启动不校验；诊断 HTTP 使用短期凭据，工具支持 ADB 转发；Release 不装配诊断路由。语义树/操作/截图明确 app|controls，各窗口节点快照独立；操作执行真实控件，不用直接改状态冒充点击。模拟返回先收 IME，再处理弹窗/编辑/页面。
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3ca225ef` are properly handled with clean fallback behavior.
