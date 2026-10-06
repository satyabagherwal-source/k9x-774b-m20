# Forensic Learning Record (Deep Inspection): gkd-kit/gkd

> **Canonical Artifact**: `07_PROJECT_LEARNING/gkd-kit-gkd-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gkd-kit/gkd](https://github.com/gkd-kit/gkd))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:22:49.790Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gkd-kit/gkd`
- **Description**: 基于无障碍，高级选择器，订阅规则的自定义屏幕点击安卓应用 | An Android APP with custom screen tapping based on Accessibility, Advanced Selectors, and Subscription Rules
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 42518 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/a11y/A11yRuleEngine.kt`
```
package li.gkd.app.a11y

import android.util.Log
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.atomicfu.atomic
import kotlinx.atomicfu.getAndUpdate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runInterruptible
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import li.gkd.app.META
import li.gkd.app.data.ActionPerformer
import li.gkd.app.platform.lifecycle.MainActivityVisibility
import li.gkd.app.priv.privilegeContextFlow
import li.gkd.app.rule.ActivityRule
import li.gkd.app.rule.AppRule
import li.gkd.app.rule.ResolvedRule
import li.gkd.app.rule.RuleDelayScheduler
import li.gkd.app.rule.RuleStatus
import li.gkd.app.service.EventService
import li.gkd.app.service.topAppIdFlow
import li.gkd.app.settings.SettingsRepository
import li.gkd.app.util.AndroidTarget
import li.gkd.app.util.Constants
import li.gkd.app.util.ToastUtils
import li.gkd.app.util.launchLogged
import java.util.concurrent.Executors
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.time.Duration.Companion.milliseconds

private val eventDispatcher = Executors.newSingleThreadExecutor().asCoroutineDispatcher()
private val queryDispatcher = Executors.newSingleThreadExecutor().asCoroutineDispatcher()
private val actionDispatcher = Executors.newSingleThreadExecutor().asCoroutineDispatcher()

class A11yRuleEngine(private val service: A11yCommonImpl) {
    private val a11yContext = A11yContext(getRoot = { safeActiveWindow })
    private val effective get() = A11yRuntime.isEffective(service)
    private val hasOthersService = A11yRuntime.hasOtherService(service)

    fun onA11yConnected() {
        if (SettingsRepository.settings.value.enableBlockA11yAppList && !SettingsRepository.actualBlockA11yAppList.contains(
                topAppIdFlow.value
            )
        ) {
            startQueryJob(byForced = true)
        }
    }

    fun onScreenForcedActive() {
        // 关闭屏幕 -> Activity::onStop -> 点亮屏幕 -> Activity::onStart -> Activity::onResume
        A11yState.onScreenForcedActive()
        startQueryJob()
    }

    val safeActiveWindow: AccessibilityNodeInfo?
        get() = try {
            // 某些应用耗时 554ms
            // java.lang.SecurityException: Call from user 0 as user -2 without permission INTERACT_ACROSS_USERS or INTERACT_ACROSS_USERS_FULL not allowed.
            service.windowNodeInfo?.setGeneratedTime()
        } catch (_: Throwable) {
            null
        }.apply {
            a11yContext.rootCache.value = this
        }

    private val safeActiveWindowAppId: String?
        get() = safeActiveWindow?.packageName?.toString()

    private val scope get() = service.scope

    @Volatile
    private var latestStateEvent: A11yEvent? = null
    private var lastContentEventTime = 0L
    private var lastEventTime = 0L
    private val eventDeque = ArrayDeque<A11yEvent>()
    fun onA11yEvent(event: AccessibilityEvent?) {
        if (!effective) return
        if (!event.isUseful()) return
        // 拒绝副屏无障碍事件
        if (AndroidTarget.TIRAMISU && event.displayId != Display.DEFAULT_DISPLAY) return
        onA11yFeatEvent(event)
        if (event.eventType == CONTENT_CHANGED) {
            if (!isInteractive) return // 屏幕关闭后仍然有无障碍事件 type:2048, time:8094, app:com.miui.aod, cls:android.widget.TextView
            if (event.packageName == Constants.systemUiAppId && event.packageName != currentTopActivity.appId) return
        }
        // 过滤部分输入法事件
        if (event.packageName == imeAppId && currentTopActivity.appId != imeAppId) {
            if (event.recordCount == 0 && event.action == 0 && !event.isFullScreen) return
        }
        // 直接丢弃自身事件，自行更新 topActivity
        if (
            (event.eventType == CONTENT_CHANGED || !MainActivityVisibility.isVisible) &&
            event.packageName == META.appId
        ) return

        val a11yEvent = event.toA11yEvent() ?: return
        if (a11yEvent.type == CONTENT_CHANGED) {
            // 防止 content 类型事件过快
            if (a11yEvent.time - lastContentEventTime < 100 && a11yEvent.time - appChangeTime > 5000 && a11yEvent.time - lastTriggerTime > 3000) {
                return
            }
            lastContentEventTime = a11yEvent.time
        }
        EventService.logEvent(event)
        if (META.debuggable) {
            Log.d(
                "onNewA11yEvent",
                "type:${event.eventType}, time:${event.eventTime - lastEventTime}, app:${event.packageName}, cls:${event.className}"
            )
        }
        if (event.eventTime < lastEventTime) {
            // 某些应用会发送负时间事件, 直接丢弃
            // type:32, time:-104, app:com.miui.home, cls:com.miui.home.launcher.Launcher
            return
        }
        lastEventTime = event.eventTime
        if (event.eventType == STATE_CHANGED) {
            latestStateEvent = a11yEvent
        }
        synchronized(eventDeque) { eventDeque.addLast(a11yEvent) }
        scope.launch(eventDispatcher) { consumeEvent(a11yEvent) }
    }

    private val queryEvents = mutableListOf<A11yEvent>()
    private suspend fun consumeEvent(headEvent: A11yEvent) {
        val consumedEvents = synchronized(eventDeque) {
            if (eventDeque.firstOrNull() !== headEvent) return
            eventDeque.filter { it.sameAs(headEvent) }.apply {
                repeat(size) { eventDeque.removeFirst() }
            }
        }
        val latestEvent = consumedEvents.last()
        val evAppId = latestEvent.appId
        val evActivityId = latestEvent.name
        val oldAppId = currentTopActivity.appId
        val rightAppId = if (oldAppId == evAppId) {
            evAppId
        } else {
            getTimeoutAppId() ?: return
        }
        if (rightAppId == evAppId) {
            if (latestEvent.type == STATE_CHANGED) {
                A11yState.withTopActivityLock {
                    // tv.danmaku.bili, com.miui.home, com.miui.home.launcher.Launcher
                    if (isActivity(evAppId, evActivityId)) {
                        updateTopActivity(evAppId, evActivityId)
                    }
                }
            }
        }
        if (rightAppId != currentTopActivity.appId) {
            A11yState.withTopActivityLock {
                // 从 锁屏，下拉通知栏 返回等情况, 应用不会发送事件, 但是系统组件会发送事件
                val topCpn = privilegeContextFlow.value?.topCpn()
                if (topCpn?.packageName == rightAppId) {
                    updateTopActivity(topCpn.packageName, topCpn.className)
                } else {
                    updateTopActivity(rightAppId, null)
                }
            }
        }
        val activityRule = activityRuleFlow.value
        if (evAppId != rightAppId || activityRule.skipConsumeEvent || !SettingsRepository.settings.value.enableMatch) {
            return
        }
        synchronized(queryEvents) { queryEvents.addAll(consumedEvents) }
        a11yContext.interruptKey++
        startQueryJob(byEvent = latestEvent)
    }

    private var lastGetAppIdTime = 0L
    private var lastAppId: String? = null
    private suspend fun getTimeoutAppId(): String? {
        if (lastAppId != null && System.currentTimeMillis() - lastGetAppIdTime <= 100) return lastAppId
        // 某些应用通过无障碍获取 safeActiveWindow 耗时长，导致多个事件连续堆积堵塞，无法检测到 appId 切换导致状态异常
        // https://github.com/gkd-kit/gkd/issues/622
        lastAppId = withTimeoutOrNull(100.milliseconds) {
            runInterruptible(Dispatchers.IO) { safeActiveWindowAppId }
        } ?: privilegeContextFlow.value?.run { topCpn()?.packageName }
        lastGetAppIdTime = System.currentTimeMillis()
        return lastAppId
    }

    // 某些场景耗时 5000 ms
    private suspend fun getTimeoutActiveWindow(): AccessibilityNodeInfo? {
        return suspendCancellableCoroutine { s ->
            val temp = atomic<Continuation<AccessibilityNodeInfo?>?>(s)
            scope.launch(Dispatchers.IO) {
                delay(500L.milliseconds)
                if (s.isActive) {
                    temp.getAndUpdate { null }?.resume(null)
                }
            }
            scope.launch(Dispatchers.IO) {
                val a = safeActiveWindow
                if (s.isActive) {
                    temp.getAndUpdate { null }?.resume(a)
                }
            }
        }
    }

    @Volatile
    private var querying = false

    @Synchronized
    private fun startQueryJob(
        byEvent: A11yEvent? = null,
        byForced: Boolean = false,
        byDelayRule: ResolvedRule? = null,
    ) {
        if (!effective) return
        if (!SettingsRepository.settings.value.enableMatch) return
        if (activityRuleFlow.value.currentRules.isEmpty()) return
        if (querying) return
        // 无障碍从零启动时获取 safeActiveWindow 非常耗时
        if (byEvent == null && service.justStarted && !hasOthersService) return checkFutureStartJob()
        scope.launchLogged(queryDispatcher) {
            querying = true
            val st = if (META.debuggable) System.currentTimeMillis() else 0L
            try {
                if (META.debuggable) {
                    Log.d(
                        "A11yRuleEngine",
                        "startQueryJob start byEvent=${byEvent != null}, byForced=$byForced, byDelayRule=${byDelayRule != null}"
                    )
                }
                queryAction(byEvent, byForced, byDelayRule)
            } finally {
                checkFutureStartJob()
                if (META.debuggable) {
                    val et = System.currentTimeMillis() - st
                    Log.d("A11yRuleEngine", "startQueryJob end $et ms")
                }
                querying = false
            }
        }
    }

    private fun checkFutureStartJob() {
        val t = System.currentTimeMillis()
        if (t - lastTriggerTime < 3000L || t - appChangeT
```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/a11y/A11yState.kt`
```
package li.gkd.app.a11y

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import android.util.LruCache
import android.view.accessibility.AccessibilityNodeInfo
import com.android.internal.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import li.gkd.app.app
import li.gkd.app.appScope
import li.gkd.app.data.appinfo.PackageAppCatalog
import li.gkd.app.data.isSystem
import li.gkd.app.data.subscription.SubscriptionState
import li.gkd.app.data.toAttrInfo
import li.gkd.app.model.ActionResult
import li.gkd.app.record.ActionRecordInput
import li.gkd.app.record.AppVisitInput
import li.gkd.app.record.RuntimeRecordRepository
import li.gkd.app.rule.ActivityRule
import li.gkd.app.rule.ResolvedRule
import li.gkd.app.rule.RuleSummary
import li.gkd.app.rule.TopActivity
import li.gkd.app.service.updateTopTaskAppId
import li.gkd.app.settings.SettingsRepository
import li.gkd.app.ui.rule.statusText
import li.gkd.app.util.AndroidTarget
import li.gkd.app.util.Constants
import li.gkd.app.util.LogUtils
import li.gkd.app.util.launchLogged
import li.songe.codeorigin.CallSite
import li.gkd.app.app as gkdApp

val activityRuleFlow: StateFlow<ActivityRule>
    get() = A11yState.activityRuleFlow

val topActivityFlow = activityRuleFlow.map { it.topActivity }.distinctUntilChanged()
val currentTopActivity: TopActivity
    get() = activityRuleFlow.value.topActivity

private object ActivityCache : LruCache<Pair<String, String>, Boolean>(256) {
    override fun create(key: Pair<String, String>): Boolean = try {
        app.packageManager.getActivityInfo(
            ComponentName(key.first, key.second),
            PackageAppCatalog.packageFlags
        )
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }
}

fun isActivity(
    appId: String,
    activityId: String,
): Boolean {
    return currentTopActivity.sameAs(appId, activityId) || ActivityCache.get(appId to activityId)
}

sealed class ActivityScene {
    data object ScreenOn : ActivityScene()
    data object A11y : ActivityScene()
    data object TaskStack : ActivityScene()
}

object A11yState {
    private val lock = Any()

    // Resolving the foreground activity can block on the privileged process. Keep that
    // query, its checks and the update in one critical section shared by every writer.
    fun <T> withTopActivityLock(block: () -> T): T = synchronized(lock, block)

    val activityRuleFlow: StateFlow<ActivityRule>
        field = MutableStateFlow(ActivityRule(blockMatch = SettingsRepository.checkAppBlockMatch(Constants.systemUiAppId)))
    val currentRule: ActivityRule
        get() = synchronized(lock) { activityRuleFlow.value }

    fun onScreenForcedActive(): Unit = synchronized(lock) {
        val top = activityRuleFlow.value.topActivity
        updateTopActivity(top.appId, top.activityId, ActivityScene.ScreenOn)
    }

    private var lastValidActivity: TopActivity = activityRuleFlow.value.topActivity
        set(value) {
            if (value.activityId != null) {
                field = value
            }
        }

    private var lastActivityUpdateTime = 0L
    private var lastActivityForceUpdateTime = 0L

    private var lastAppId = Constants.systemUiAppId

    fun updateTopActivity(
        appId: String,
        activityId: String?,
        scene: ActivityScene = ActivityScene.A11y,
        @CallSite loc: String = "",
    ): Unit = synchronized(lock) {
        val t = System.currentTimeMillis()
        if (scene == ActivityScene.TaskStack) {
            updateTopTaskAppId(appId)
        }
        val oldActivity = activityRuleFlow.value.topActivity
        val oldActivityRule = activityRuleFlow.value
        val idChanged =
            (scene == ActivityScene.ScreenOn || appId != oldActivityRule.topActivity.appId)
        val isSame = scene != ActivityScene.ScreenOn && oldActivity.sameAs(appId, activityId)
        if (scene == ActivityScene.TaskStack) {
            lastActivityForceUpdateTime = t
        } else if (scene == ActivityScene.A11y) {
            if (idChanged && lastActivityForceUpdateTime > 0) {
                // ITaskStackListener 大部分场景快于无障碍
                if (t - lastActivityForceUpdateTime < 1000) return
                if (activityId != null && t - lastActivityForceUpdateTime < 3000) return
            }
            if (isSame && t - lastActivityUpdateTime < 1000) return
        }
        val number = if (isSame) {
            oldActivity.number + 1
        } else {
            0
        }
        val topActivity = TopActivity(
            appId = appId,
            activityId = activityId ?: lastValidActivity.takeIf { it.appId == appId }?.activityId,
            number = number,
        )
        lastValidActivity = oldActivity
        lastActivityUpdateTime = t
        appScope.launchLogged { RuntimeRecordRepository.recordActivity(appId, activityId, t) }
        // Keep foreground/visit bookkeeping active while no complete executable snapshot exists.
        // Presentation still observes Loading/Failure; the executor receives no runnable rules.
        val ruleSummary = SubscriptionState.ruleSummaryFlow.value.value ?: RuleSummary()
        val topChanged = idChanged || oldActivityRule.topActivity != topActivity
        val ruleChanged = oldActivityRule.ruleSummary !== ruleSummary
        if (topChanged || ruleChanged) {
            val newActivityRule = ActivityRule(
                ruleSummary = ruleSummary,
                topActivity = topActivity,
                blockMatch = SettingsRepository.checkAppBlockMatch(topActivity.appId),
            )
            if (idChanged) {
                val oldAppId = lastAppId
                lastAppId = appId
                val visit = AppVisitInput(oldAppId, appId, t)
                appScope.launchLogged { RuntimeRecordRepository.recordVisit(visit) }
                RuleExecutionHost.runtime.onAppChanged(t)
                ruleSummary.globalRules.forEach { it.resetState(t) }
                ruleSummary.appIdToRules[oldActivityRule.topActivity.appId]?.forEach {
                    it.resetState(
                        t
                    )
                }
                newActivityRule.appRules.forEach { it.resetState(t) }
            } else {
                newActivityRule.currentRules.forEach { r ->
                    r.onActivityTransition(t, previouslyMatched = r in oldActivityRule.currentRules)
                }
            }
            activityRuleFlow.value = newActivityRule
            LogUtils.d(
                "${oldActivity.format()} -> ${topActivity.format()} (scene=$scene)",
                loc = loc,
                tag = "updateTopActivity",
            )
        }
    }
}

fun updateTopActivity(
    appId: String,
    activityId: String?,
    scene: ActivityScene = ActivityScene.A11y,
    @CallSite loc: String = "",
) = A11yState.updateTopActivity(appId, activityId, scene, loc)

val lastTriggerTime: Long get() = RuleExecutionHost.runtime.lastTriggerTime

val appChangeTime: Long get() = RuleExecutionHost.runtime.appChangeTime

var imeAppId = ""
val launcherAppIdFlow: StateFlow<String>
    field = MutableStateFlow("")
val launcherAppId: String get() = launcherAppIdFlow.value
var systemRecentCn = ComponentName("", "")

fun updateSystemDefaultAppId() {
    imeAppId = app.getSecureString(Settings.Secure.DEFAULT_INPUT_METHOD)
        ?.let(ComponentName::unflattenFromString)?.packageName ?: ""
    val launcherCn = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        .resolveActivity(app.packageManager)
    launcherAppIdFlow.value = launcherCn.packageName
    if (app.getPkgInfo(launcherAppId)?.applicationInfo?.isSystem == true) {
        systemRecentCn = launcherCn
    } else {
        if (AndroidTarget.P) {
            systemRecentCn = ComponentName.unflattenFromString(
                gkdApp.getString(R.string.config_recentsComponentName)
            ) ?: systemRecentCn
        }
        if (systemRecentCn.packageName.isEmpty()) {
            // https://github.com/android-cs/8/blob/main/packages/SystemUI/src/com/android/systemui/recents/RecentsActivity.java
            systemRecentCn = ComponentName(
                Constants.systemUiAppId,
                "${Constants.systemUiAppId}.recents.RecentsActivity",
            )
        }
    }
}

fun addActionLog(
    rule: ResolvedRule,
    topActivity: TopActivity,
    target: AccessibilityNodeInfo,
    actionResult: ActionResult,
) {
    val input = ActionRecordInput(
        appId = topActivity.appId,
        activityId = topActivity.activityId,
        subsId = rule.subsItem.id,
        subsVersion = rule.rawSubs.version,
        groupKey = rule.g.group.key,
        groupType = rule.g.group.groupType,
        ruleIndex = rule.index,
        ruleKey = rule.key,
        time = System.currentTimeMillis(),
    )
    appScope.launchLogged { RuntimeRecordRepository.recordAction(input) }
    // Android node inspection is diagnostic only and stays outside the production record writer.
    appScope.launchLogged(Dispatchers.IO) {
        LogUtils.d(rule.statusText(), target.toAttrInfo(0, 0), actionResult)
    }
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/data/subscription/SubscriptionState.kt`
```
package li.gkd.app.data.subscription

import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import li.gkd.app.a11y.RuleExecutionHost
import li.gkd.app.appScope
import li.gkd.app.rule.RuleSummaryBuilder
import li.gkd.app.rule.ruleGroupState
import li.gkd.app.state.Loadable
import li.gkd.app.subscription.SubscriptionRepository

object SubscriptionState {
    val subsMapFlow by lazy {
        SubscriptionRepository.snapshotFlow.map { it.value?.subscriptions.orEmpty() }
            .stateIn(
                appScope,
                SharingStarted.Eagerly,
                SubscriptionRepository.snapshotFlow.value.value?.subscriptions.orEmpty(),
            )
    }

    val ruleSummaryFlow by lazy {
        ruleGroupState.map { state ->
            when (state) {
                Loadable.Loading -> Loadable.Loading
                is Loadable.Failure -> state
                is Loadable.Ready -> Loadable.Ready(
                    RuleSummaryBuilder.build(state.value.groups, state.value.apps, RuleExecutionHost.runtime)
                )
            }
        }.catch { emit(Loadable.Failure(it)) }
            .stateIn(appScope, SharingStarted.Eagerly, Loadable.Loading)
    }
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/network/NetworkState.android.kt`
```
package li.gkd.app.network

actual fun isNetworkAvailable(): Boolean = NetworkAvailability.canResolveProbeHost()

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
import kotlinx.coroutines.flow.updateAndGet
import li.gkd.app.app
import li.gkd.app.app.AppInfoRepository
import li.gkd.app.appScope
import li.gkd.app.priv.privilegeContextFlow
import li.gkd.app.priv.PrivilegeCapabilities
import li.gkd.app.priv.queryPrivilegeCapabilities
import li.gkd.app.resources.Res
import li.gkd.app.resources.permission_external_storage
import li.gkd.app.resources.permission_external_storage_description
import li.gkd.app.resources.permission_go_authorize
import li.gkd.app.resources.permission_ignore_battery_optimization
import li.gkd.app.resources.permission_ignore_battery_optimization_description
import li.gkd.app.resources.permission_local_network
import li.gkd.app.resources.permission_local_network_description
import li.gkd.app.resources.permission_not_granted_description
import li.gkd.app.resources.permission_notifications
import li.gkd.app.resources.permission_notifications_description
import li.gkd.app.resources.permission_open_settings
import li.gkd.app.resources.permission_overlay
import li.gkd.app.resources.permission_overlay_description
import li.gkd.app.resources.permission_query_apps
import li.gkd.app.resources.permission_query_apps_description
import li.gkd.app.resources.permission_required
import li.gkd.app.resources.permission_special_foreground_service
import li.gkd.app.resources.permission_special_foreground_service_restricted
import li.gkd.app.resources.permission_start_operations
import li.gkd.app.resources.permission_write_secure_settings
import li.gkd.app.resources.privilege_service
import li.gkd.app.ui.text.getSync
import li.gkd.app.util.AndroidTarget
import li.gkd.app.util.ToastUtils
import li.gkd.app.util.mapState
import li.songe.codeorigin.CallSite
import org.jetbrains.compose.resources.StringResource
import priv.kit.core.Privilege

class PermissionState(
    private val nameResource: StringResource,
    private val check: () -> Boolean,
    val permission: IPermission? = null,
    private val purposeResource: StringResource? = null,
    val resolution: PermissionResolution? = null,
    private val onChanged: (() -> Unit)? = null,
    val recheckPolicy: PermissionRecheckPolicy = PermissionRecheckPolicy.Immediate,
) {
    val name: String get() = nameResource.getSync()
    val purpose: String? get() = purposeResource?.getSync()

    val stateFlow: StateFlow<Boolean>
        field = MutableStateFlow(false)
    val value get() = stateFlow.value

    fun updateAndGet(): Boolean {
        return stateFlow.updateAndGet { check() }
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
    val message: String get() = messageProvider()
    val confirmText: String get() = confirmResource.getSync()
}

private fun requestablePermissionState(
    nameResource: StringResource,
    purposeResource: StringResource,
    permission: IPermission,
    check: () -> Boolean = { XXPermissions.isGrantedPermission(app, permission) },
    onChanged: (() -> Unit)? = null,
    recheckPolicy: PermissionRecheckPolicy = PermissionRecheckPolicy.Immediate,
) = PermissionState(
    nameResource = nameResource,
    check = check,
    permission = permission,
    purposeResource = purposeResource,
    resolution = PermissionResolution(
        messageProvider = { Res.string.permission_not_granted_description.getSync(nameResource.getSync()) },
    ),
    onChanged = onChanged,
    recheckPolicy = recheckPolicy,
)

private fun checkAllowedOp(op: String): Boolean = app.appOpsManager.checkOpNoThrow(
    op,
    Process.myUid(),
    app.packageName
).let {
    it != AppOpsManager.MODE_IGNORED && it != AppOpsManager.MODE_ERRORED
}

object PermissionStates {
    // https://github.com/gkd-kit/gkd/issues/954
    // https://github.com/gkd-kit/gkd/issues/887
    val foregroundServiceSpecialUse by lazy {
        PermissionState(
            nameResource = Res.string.permission_special_foreground_service,
            check = {
                if (AndroidTarget.UPSIDE_DOWN_CAKE) {
                    checkAllowedOp(AppOpsManagerHidden.OPSTR_FOREGROUND_SERVICE_SPECIAL_USE)
                } else {
                    true
                }
            },
            resolution = PermissionResolution(
                messageProvider = { Res.string.permission_special_foreground_service_restricted.getSync() },
                confirmResource = Res.string.permission_go_authorize,
                navigateToPrivilegeService = true,
            ),
        )
    }

    // https://github.com/orgs/gkd-kit/discussions/1234
    private fun checkAccessA11y(): Boolean {
        return !AndroidTarget.Q ||
                checkAllowedOp(AppOpsManagerHidden.OPSTR_ACCESS_ACCESSIBILITY)
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
            nameResource = Res.string.permission_start_operations,
            check = {
                val accessA11yAllowed = checkAccessA11y()
                val accessRestrictedSettingsAllowed = checkAccessRestrictedSettings()
                accessRestrictions.value = buildSet {
                    if (!accessA11yAllowed) add(AppPermissionRestriction.Accessibility)
                    if (!accessRestrictedSettingsAllowed) add(AppPermissionRestriction.RestrictedSettings)
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
            if (foregroundServiceAllowed) access else access + AppPermissionRestriction.ForegroundService
        }.stateIn(appScope, SharingStarted.Eagerly, emptySet())
    }

    val appOpsRestrictedFlow by lazy { appRestrictionsFlow.mapState(appScope) { it.isNotEmpty() } }

    val notification by lazy {
        requestablePermissionState(
            nameResource = Res.string.permission_notifications,
            purposeResource = Res.string.permission_notifications_description,
            permission = PermissionLists.getPostNotificationsPermission(),
        )
    }

    val localNetwork by lazy {
        requestablePermissionState(
            nameResource = Res.string.permission_local_network,
            purposeResource = Res.string.permission_local_network_description,
            permission = PermissionLists.getAccessLocalNetworkPermission(),
        )
    }

    val queryPackages by lazy {
        requestablePermissionState(
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

    val ignoreBa
```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/platform/lifecycle/LifecycleHooks.kt`
```
package li.gkd.app.platform.lifecycle

import androidx.annotation.MainThread
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import li.gkd.app.util.LogUtils
import li.songe.codeorigin.CallSite

class LifecycleHooks(
    private val onLifecycleEvent: (String, String) -> Unit = { event, loc ->
        LogUtils.d(event, loc = loc)
    },
    private val onCleanupError: (Throwable, String) -> Unit = { error, loc ->
        LogUtils.d(error, loc = loc)
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
    onCreated { LogUtils.d("onCreated -> $ownerName", loc = loc) }
    onDestroyed { LogUtils.d("onDestroyed -> $ownerName", loc = loc) }
}

@MainThread
fun LifecycleOwner.onCreated(callback: () -> Unit) {
    lifecycle.addObserver(object : DefaultLifecycleObserver {
        override fun onCreate(owner: LifecycleOwner) {
            owner.lifecycle.removeObserver(this)
            callback()
        }
    })
}

@MainThread
fun LifecycleOwner.onDestroyed(callback: () -> Unit) {
    lifecycle.addObserver(object : DefaultLifecycleObserver {
        override fun onDestroy(owner: LifecycleOwner) {
            callback()
        }
    })
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
import li.gkd.app.a11y.currentTopActivity
import li.gkd.app.a11y.updateTopActivity
import li.gkd.app.util.LogUtils
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
        LogUtils.d("MainActivity::onStart", loc = logLoc)
        visibleActivityCount.incrementAndGet()
        if (currentTopActivity.appId != META.appId) {
            updateTopActivity(
                META.appId,
                activity.javaClass.name,
            )
        }
    }

    override fun onResume(owner: LifecycleOwner) {
        LogUtils.d("MainActivity::onResume", loc = logLoc)
        RuntimeStateSynchronizer.requestSync(loc = logLoc)
    }

    override fun onStop(owner: LifecycleOwner) {
        LogUtils.d("MainActivity::onStop", loc = logLoc)
        visibleActivityCount.decrementAndGet()
    }

}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/platform/lifecycle/ResourceSlot.kt`
```
package li.gkd.app.platform.lifecycle

import li.gkd.app.util.LogUtils
import li.songe.codeorigin.CallSite

class ResourceSlot<T : AutoCloseable> : AutoCloseable {
    private var resource: T? = null
    private var resourceLoc = ""
    private var closed = false

    @Synchronized
    fun replace(
        newResource: T?,
        @CallSite loc: String = "",
    ): T? {
        check(!closed) { "ResourceSlot is already closed" }
        if (resource === newResource) return newResource
        val oldResource = resource
        val oldResourceLoc = resourceLoc
        resource = newResource
        resourceLoc = if (newResource == null) "" else loc
        oldResource?.closeSafely(oldResourceLoc)
        return newResource
    }

    @Synchronized
    fun replace(
        @CallSite loc: String = "",
        createResource: () -> T,
    ): T {
        check(!closed) { "ResourceSlot is already closed" }
        val oldResource = resource
        val oldResourceLoc = resourceLoc
        resource = null
        resourceLoc = ""
        oldResource?.closeSafely(oldResourceLoc)
        return createResource().also {
            resource = it
            resourceLoc = loc
        }
    }

    @Synchronized
    fun get(): T? = resource

    @Synchronized
    fun clear() {
        if (closed) return
        val oldResource = resource
        val oldResourceLoc = resourceLoc
        resource = null
        resourceLoc = ""
        oldResource?.closeSafely(oldResourceLoc)
    }

    @Synchronized
    override fun close() {
        if (closed) return
        closed = true
        val oldResource = resource
        val oldResourceLoc = resourceLoc
        resource = null
        resourceLoc = ""
        oldResource?.closeSafely(oldResourceLoc)
    }

    private fun T.closeSafely(loc: String) {
        runCatching(::close).onFailure { LogUtils.d(it, loc = loc) }
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
import li.gkd.app.a11y.updateSystemDefaultAppId
import li.gkd.app.appScope
import li.gkd.app.permission.PermissionStates
import li.gkd.app.priv.privilegeContextFlow
import li.gkd.app.service.fixRestartAutomatorService
import li.gkd.app.util.LogUtils
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
                    LogUtils.d(e, loc = loc)
                }
            }
        }
    }

    fun requestSync(@CallSite loc: String = "") {
        check(requests.trySend(loc).isSuccess) { "运行时状态同步队列已关闭" }
    }

    private const val COALESCE_DELAY_MILLIS = 50L
}

```

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/priv/PrivilegeOwnerLifecycle.kt`
```
package li.gkd.app.priv

import li.gkd.app.util.LogUtils
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
        }.onFailure { error ->
            LogUtils.d("prepare owner restart failed", error)
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

### Core Architecture Module: `gkd-app/src/androidMain/kotlin/li/gkd/app/ui/component/ShareLogState.kt`
```
package li.gkd.app.ui.component

import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import li.gkd.app.MainActivity
import li.gkd.app.data.LogMetadataSources
import li.gkd.app.resources.Res
import li.gkd.app.resources.logs_share_file
import li.gkd.app.resources.logs_title
import li.gkd.app.resources.upload_busy
import li.gkd.app.storage.FileExports
import li.gkd.app.storage.LogArchive
import li.gkd.app.storage.StorageMaintenance
import li.gkd.app.ui.share.launchUi
import li.gkd.app.ui.text.getSync
import li.gkd.app.ui.upload.GithubUploadItem
import li.gkd.app.ui.upload.GithubUploadState
import li.gkd.app.util.AndroidStorage
import li.gkd.app.util.LogUtils
import li.gkd.app.util.ToastUtils

class ShareLogState(
    private val scope: CoroutineScope,
    private val githubUpload: GithubUploadState,
) {
    private val visibleFlow = MutableStateFlow(false)

    private fun buildArchive(): java.io.File {
        LogUtils.flush()
        return LogArchive.build(LogMetadataSources.sources())
    }

    fun show() {
        visibleFlow.value = true
    }

    private fun dismiss() {
        visibleFlow.value = false
    }

    private fun share(context: MainActivity) {
        dismiss()
        scope.launchUi {
            val logZipFile = withContext(Dispatchers.IO) { buildArchive() }
            context.shareFile(logZipFile, Res.string.logs_share_file.getSync())
        }
    }

    private fun save(context: MainActivity) {
        dismiss()
        scope.launchUi {
            FileExports.withTemporaryFile(
                create = { withContext(Dispatchers.IO) { buildArchive() } },
                delete = { StorageMaintenance.deleteSharedFile(AndroidStorage.storage, it) },
            ) { logZipFile ->
                context.saveFileToDownloads(logZipFile)
            }
        }
    }

    private fun upload() {
        dismiss()
        val item = GithubUploadItem(
            label = Res.string.logs_title.getSync(),
            getFile = { buildArchive() },
            showHref = { "http://i.gkd.li/log/${it.id}" },
            releaseFile = { StorageMaintenance.deleteSharedFile(AndroidStorage.storage, it) },
        )
        if (!githubUpload.startTask(item)) ToastUtils.show(Res.string.upload_busy.getSync())
    }

    @Composable
    fun Render() {
        val visible by visibleFlow.collectAsStateWithLifecycle()
        if (visible) {
            val context = LocalActivity.current as MainActivity
            GkShareLogDialog(
                ::dismiss,
                { share(context) },
                { save(context) },
                ::upload
            )
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
  > 在 shizuku 里关闭 gkd 的授权后，重新快照这两种情况看看呢

- **Issue #1027** (2025-11-13): **[BUG] resetMatch=app 且 activityIds 有值时匹配异常**
  *Symptoms*: ### 日志文件   https://github.com/user-attachments/files/20566245/log-1748942787571.zip  ### BUG描述(文字/截图/视频)   #1025  ### 期望行为(文字/截图/视频)   正常匹配  ### 实际行为(文字/截图/视频)   无法匹配
  **Post-Mortem & Fix Analysis**:
  > https://github.com/gkd-kit/gkd/releases

- **Issue #776** (2024-11-18): **[BUG] 开启 HTTP 服务后程序闪退**
  *Symptoms*: ### 日志文件   https://f.gkd.li/17786741  ### BUG描述(文字/截图/视频)   开启 HTTP 服务后程序闪退  ### 期望行为(文字/截图/视频)   正常开启 HTTP 服务  ### 实际行为(文字/截图/视频)   开启 HTTP 服务后程序闪退   https://github.com/user-attachments/assets/b9d4cc70-2dfb-4a4c-8092-cc671161bdc5  
  **Post-Mortem & Fix Analysis**:
  > `9781fd7` 后正常

- **Issue #765** (2024-11-11): **[BUG] anyMatches部分情况下不触发规则**
  *Symptoms*: ### 日志文件   https://f.gkd.li/17629780  ### BUG描述(文字/截图/视频)   使用如下规则，第二个选择器可匹配上节点，但是不触发规则 ``` {   id: 'com.mihoyo.hyperion',   name: '米游社',   groups: [     {       key: 8,       name: '功能类-米游自动签到测试',       desc: '包含崩坏3、绝区零、原神、星穹铁道',       forcedTime: 10000,       activityIds: '.web2.MiHoYoWebActivity',       rules: [         {           key: 0,           name: '点击签到',           anyMatches: [             '[text$="每日签到"] >4 View[childCount=11] > @View[childCount=3][visibleToUser=true] > Image[index=0][text!=null]',             '[text="《崩坏：星穹铁道》签到福利"] >4 View > View + TextView[visibleToUser=true]', // 星穹铁道           ],           exampleUrls: 'https://e.gkd.li/53d22dc7-b368-46c0-85d2-fe132b0832a9',           snapshotUrls: [             'https://i.gkd.li/i/17611613', // 星穹铁道签到前             'https://i.gkd.li/i/14967627', // 签到节点 clickable=false           ],           excludeSnapshotUrls: [             'https://i.gkd.li/i/17611617', // 星穹铁道签到后 无法排除匹配           ],         },       ],     },   ], } ``` 把 ``` anyMatches: [   '[text$="每日签到"] >4 View[childCount=11] > @View[childCount=3][visibleToUser=true] > Image[index=0][text!=null]',   '[text="《崩坏：星穹铁道》签到福利"] >4 View > View + TextView[visibleToUser=true]', // 星穹铁道 ], ``` 替换成以下任意一个皆可触发规则 ``` matches: [    '[text="《崩坏：星穹铁道》签到福利"] >4 View > View + TextView[visibleToUser=true]', // 星穹铁道 ], ``` ``` anyMatches: [    '[text="《崩坏：星穹铁道》签到福利"] >4 View > View + TextView[visibleToUser=true]',
  **Post-Mortem & Fix Analysis**:
  > https://github.com/gkd-kit/gkd/releases

- **Issue #759** (2024-11-11): **[BUG] 出现大量报错提示**
  *Symptoms*: ### 日志文件   https://f.gkd.li/17574495  ### BUG描述(文字/截图/视频)   昨天出现过一次，用beta版的时候也出现过一次，这个提示过几秒就消失了，当时没截到图，下面这个图是别人的  ![9FABD8BF41588F7D8D403B98046C0A59](https://github.com/user-attachments/assets/37e4d5ed-2ffa-4c25-bd19-f25e116637d3)   ### 期望行为(文字/截图/视频)   不出现报错提示  ### 实际行为(文字/截图/视频)   出现报错提示
  **Post-Mortem & Fix Analysis**:
  > 看起来应该是这里的顺序写反导致多线程同时 `setGeneratedTime` 出现的报错  <https://github.com/gkd-kit/gkd/blob/3e884b57d6b56d8d09e732641a0446eb6045dd5b/app/src/main/kotlin/li/songe/gkd/service/NodeExt.kt#L24-L28>  试试下面这个版本呢？  [release.zip](https://github.com/user-attachments/files/17582140/release.zip) 
  > 好的，我用一段时间看看
  > https://github.com/gkd-kit/gkd/releases

- **Issue #698** (2024-08-10): **[Bug] 短时间内多次触发后，悬浮窗toast无法消失**
  *Symptoms*: ### 一些验证  - [X] 请 **确保** 您已经查阅了 [GKD 官方文档](https://gkd.li)  以及 [常见问题](https://gkd.li/guide/faq) - [X] 1.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 2.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 3.请 **不要** 开启重复相关的 issue，这将导致别人搜索 issue 时出现无关的低质量信息, 否则你的问题将会被直接关闭甚至删除 - [X] 请 **务必** 给issue填写一个简洁明了的标题，以便他人快速检索 - [X] 请 **确保** 你的问题能在 [releases](https://github.com/gkd-kit/gkd/releases/latest) 发布的最新版本(包含测试版本)上复现 (如果不是请先更新到最新版本复现后再提交问题) - [X] 请 **确保** 提供下列的日志和BUG描述及其复现步骤, 否则你的问题将会被直接关闭  ### 日志文件-无论什么问题不包含日志将会被直接关闭   https://f.gkd.li/16569326  ### BUG描述(文字/截图/视频)    https://github.com/user-attachments/assets/4c435592-1dd6-4eea-b770-5069c8eef459  如视频  ### 期望行为(文字/截图/视频)   悬浮窗toast在短时间内多次触发后自动消失  ### 实际行为(文字/截图/视频)   如上方视频
  **Post-Mortem & Fix Analysis**:
  > [release.zip](https://github.com/user-attachments/files/16569618/release.zip)  你好，试试这个版本呢？
  > > [release.zip](https://github.com/user-attachments/files/16569618/release.zip) >  > 你好，试试这个版本呢？  这是actions里的版本吗？是的话上方就是使用该版本导致的。 如果是已经修改过代码进行修复的话，问题可能已经消失
  > > 这是actions里的版本吗？  本地修改打包的

- **Issue #695** (2024-08-08): **[BUG] 快照链接生成错误**
  *Symptoms*: ### 一些验证  - [X] 请 **确保** 您已经查阅了 [GKD 官方文档](https://gkd.li)  以及 [常见问题](https://gkd.li/guide/faq) - [X] 1.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 2.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 3.请 **不要** 开启重复相关的 issue，这将导致别人搜索 issue 时出现无关的低质量信息, 否则你的问题将会被直接关闭甚至删除 - [X] 请 **务必** 给issue填写一个简洁明了的标题，以便他人快速检索 - [X] 请 **确保** 你的问题能在 [releases](https://github.com/gkd-kit/gkd/releases/latest) 发布的最新版本(包含测试版本)上复现 (如果不是请先更新到最新版本复现后再提交问题) - [X] 请 **确保** 提供下列的日志和BUG描述及其复现步骤, 否则你的问题将会被直接关闭  ### 日志文件-无论什么问题不包含日志将会被直接关闭   https://f.gkd.li/16540833  ### BUG描述(文字/截图/视频)   生成的快照链接是日志链接的格式，且不能再次点击快照复制链接  ![1723109245402](https://github.com/user-attachments/assets/90eb3ab9-2a0e-4954-b898-a757674f4ad0)   ### 期望行为(文字/截图/视频)   生成快照格式的链接，且再次点击快照后能复制链接  ### 实际行为(文字/截图/视频)   生成日志格式的链接，且再次点击快照后不能复制链接
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈  应该是合并上传逻辑的时候丢失了快照相关的逻辑
  > https://github.com/gkd-kit/gkd/releases

- **Issue #669** (2024-07-20): **[BUG] 排除匹配生效的情况下依然触发规则**
  *Symptoms*: ### 一些验证  - [X] 请 **确保** 您已经查阅了 [GKD 官方文档](https://gkd.li)  以及 [常见问题](https://gkd.li/faq/) - [X] 1.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 2.请 **确保** [已有的问题](https://github.com/gkd-kit/gkd/issues?q=is%3Aissue) 中没有人提交过相似issue，否则请在已有的issue下进行讨论 - [X] 3.请 **不要** 开启重复相关的 issue，这将导致别人搜索 issue 时出现无关的低质量信息, 否则你的问题将会被直接关闭甚至删除 - [X] 请 **务必** 给issue填写一个简洁明了的标题，以便他人快速检索 - [X] 请 **确保** 你的问题能在 [releases](https://github.com/gkd-kit/gkd/releases/latest) 发布的最新版本(包含测试版本)上复现 (如果不是请先更新到最新版本复现后再提交问题) - [X] 请 **确保** 提供下列的日志和BUG描述及其复现步骤, 否则你的问题将会被直接关闭  ### 日志文件-无论什么问题不包含日志将会被直接关闭   https://f.gkd.li/16313156  ### BUG描述(文字/截图/视频)   预期外的点击界面快照：https://i.gkd.li/i/16312880  规则： ```   {     key: 0,     name: '开屏广告',     order: OPEN_AD_ORDER,     matchTime: 10000,     actionMaximum: 2,     resetMatch: 'app',     actionCdKey: 0,     actionMaximumKey: 0,     rules: [       {         key: 0,         fastQuery: true,         excludeMatches:           '[text*="搜索" || vid~="(?is).*search.*" || desc*="搜索"][visibleToUser=true]', // 防止在应用的搜索页面误触         matches: '[text*="跳过"][text.length<10][visibleToUser=true]',       },       {         key: 1,         excludeMatches:           '[text*="搜索" || vid~="(?is).*search.*" || desc*="搜索"][visibleToUser=true]', // 防止在应用的搜索页面误触         matches:           '[childCount=0][visibleToUser=true][((text*="跳过" || text*="跳過" || text~="(?is).*skip.*") && text.length<10) || ((desc*="跳过" || 
  **Post-Mortem & Fix Analysis**:
  > https://f.gkd.li/16313372 补充一下上述规则的key: 1的触发日志，可排除错误使用fastQuery的问题
  > 匹配是从事件节点开始的，如果你要匹配的目标在事件节点之外，那就匹配不到  两种解决方法  1. 设置 [matchRoot](https://gkd.li/api/interfaces/RawCommonProps#matchroot) 为 `true` ，所有选择器都从根节点查询 2. 或者将排除的选择器 `[text='abc']`  改成 `[text='abc'] <<n [parent=null]`
  > > 匹配是从事件节点开始的，如果你要匹配的目标在事件节点之外，那就匹配不到 >  > 两种解决方法 >  > 1. 设置 [matchRoot](https://gkd.li/api/interfaces/RawCommonProps#matchroot) 为 `true` ，所有选择器都从根节点查询 > 2. 或者将排除的选择器 `[text='abc']`  改成 `[text='abc'] <<n [parent=null]`  好的，感谢解答 构想过另一种解决全局规则在搜索页误触的方法：全局规则支持排除activityid，同时activityid支持包含匹配，搜索页的activityid基本都有```search```字符，这样就可排除搜索页，不知能否实现？

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

### Incident Patch 1: `6bd45868` (2026-10-03)
**Commit Message**: fix: expand category clear button touch target

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/subscription/GkCategoryActionsSheet.kt` (modified, +2/-3)
```diff
@@ -6,7 +6,6 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.foundation.layout.Row
-import androidx.compose.foundation.layout.defaultMinSize
 import androidx.compose.foundation.layout.fillMaxWidth
 import androidx.compose.foundation.layout.heightIn
 import androidx.compose.foundation.layout.padding
@@ -116,8 +115,8 @@ fun GkCategoryActionsSheet(
                             TextButton(
                                 enabled = !busy,
                                 onClick = onClearOverrides,
-                                modifier = Modifier.defaultMinSize(minWidth = 1.dp),
-                                contentPadding = PaddingValues(0.dp),
+                                modifier = Modifier.size(width = 56.dp, height = 48.dp),
+                                contentPadding = PaddingValues(horizontal = 8.dp),
                             ) {
                                 Text(stringResource(Res.string.action_clear))
                             }
```

---

### Incident Patch 2: `93bb83e9` (2026-10-03)
**Commit Message**: fix: preserve hidden API callbacks in R8 release builds

close #1474

**File**: `.agents/skills/android-hidden-api-r8/SKILL.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+---
+name: android-hidden-api-r8
+description: Check compatibility between Android hidden APIs and R8 when adding or changing hidden interface or superclass implementations, system callbacks, bytecode remapping, or related module dependencies. Also use for Debug-only success with minified Release failures involving AbstractMethodError, removed or renamed methods, or changed signatures. Excludes ordinary UI, documentation, and unrelated code changes.
+---
+
+# Android Hidden APIs and R8
+
+Ensure R8 receives the necessary type information and preserves the method contracts required when Android calls project code. Inspect affected paths within the task's scope. Expand to a broader audit only when requested or supported by evidence.
+
+## Identify the call contract
+
+- Distinguish calls into system hidden APIs, direct calls to project implementations, and system callbacks through hidden interfaces or superclasses. These do not all imply missing keep rules.
+- Identify the runtime caller, dispatch type, implementation, and required method names, parameter types, and return descriptors.
+- R8 analyzes bytecode and input types, not Kotlin's `override` keyword. Successful compilation does not prove that the final R8 task sees the same inheritance relationships.
+
+## Inspect actual R8 inputs
+
+- Locate the application module and build variant that run R8. Trace both compilation classpaths and actual R8 analysis inputs. Do not infer consumer visibility from a library's `compileOnly` or `androidMainCompileOnly` declaration.
+- For remapping, check that transformed type names, method descriptors, and inheritance relationships match the declarations supplied for analysis. Resolving a remap index, applying an ASM transformation, and supplying types to final R8 analysis are separate concerns.
+- Check that stubs declare the required classes and members. A separate `*Hidden` type does not automatically supply hidden members missing from a public SDK type. Do not assume R8 merges duplicate types or remapped declarations into `android.jar`.
+- Inspect existing annotations, consumer rules, merged rules, and missing-type diagnostics. `-dontwarn` suppresses warnings; it does not restore missing type relationships or preserve methods.
+- For migration regressions, compare inputs and artifacts from known working and failing versions before attributing every difference to the migration.
+
+## Choose the fix
+
+- When analysis dependencies were lost, first restore a dependency path visible to final R8 analysis while keeping compilation stubs out of the APK. Use the project's actual AGP version, variants, and task inputs; do not treat an internal task property as a stable universal API.
+- If the contract remains invisible, apply targeted `@Keep` or consumer keep rules to the actual entry points. Preserve required method existence, names, and signatures; preserving names alone must not allow required methods to be removed.
+- Ship a library's required preservation rules with the library and validate them in a consumer with R8 enabled. Do not rely on a particular host accidentally supplying stubs or keep rules.
+- Choose preservation scope from evidence. Public SDK callbacks, bundled project-owned AIDL, and entry points already covered by rules do not all need Keep merely because they use Binder. Keeping entire packages or disabling R8 is not the default fix.
+- Do not infer runtime dispatch solely from the referenced class name in decompiled output. For instructions such as `invoke-super`, verify the applicable ART/Dalvik semantics or use a minimal runtime reproduction before changing stubs.
+
+## Validate and report
+
+- Build the affected variant with R8 actually enabled. Before building, check whether associated tasks upload or publish artifacts. Prefer a validation path without external publication side effects and stay within the user's authorization.
+- Use mapping, usage, seeds, and merged rules as supporting evidence. Inspect the final DEX for critical methods, complete descriptors, and required inheritance relationships; no single report establishes every contract.
+- Confirm that compilation stubs are absent from the APK. Validate library changes through a consumer or minimal integration fixture, rather than only inspecting an AAR before final optimization.
+- Use runtime validation as needed for system dispatch, exception handling, or API-version compatibility. Contract checks should assert required methods and behavior, not fixed referenced class names or complete decompiled text that R8 may legitimately change.
+- Report root-cause evidence, fix scope, build/artifact results, and runtime validation separately. State any unverified parts when building or device testing is unavailable. Debug success or method presence alone does not establish that a runtime failure is fully resolved.
+
+Read [failure patterns](references/failure-cases.md) as needed for callbacks lost after module migration, hidden m
```

**File**: `.agents/skills/android-hidden-api-r8/references/failure-cases.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# Hidden API and R8 Failure Patterns
+
+Use these patterns to form hypotheses, then verify them against the current project's dependency graph, R8 inputs, and optimized artifacts. They are not universal diagnoses or prescribed fixes.
+
+## Hidden callbacks removed after module migration
+
+Possible symptoms: Debug works while minified Release fails with `AbstractMethodError`, and the usage report lists a system callback implementation as removed.
+
+Check whether compilation stubs remain available to a library or KMP module but are absent from the application module that runs final R8 optimization. Compare the relevant compilation classpaths with actual R8 analysis inputs. Broad `-dontwarn` rules may conceal missing-type diagnostics.
+
+If analysis dependencies are missing, restore the appropriate dependency path. Depending on the build configuration, the application may need its own `compileOnly` dependency on the stub module. Verify that the required callbacks survive optimization and that compilation stubs are not packaged. Then validate the affected runtime path.
+
+A removed method is evidence of the optimization outcome, not proof that the correct fix is to keep its entire class.
+
+## Hidden members missing from a public SDK type
+
+A public SDK class or interface may omit a hidden method that exists at runtime. A project implementation matching that hidden method can therefore appear unrelated to any system contract during R8 analysis.
+
+Direct calls to the concrete implementation may still work because R8 can rewrite both the implementation and its call sites. System dispatch through the hidden contract can fail if the required method is removed, renamed, or given a different descriptor.
+
+Check the exact declarations available to R8. A separate remapped stub type does not automatically add missing members to the SDK type. If the contract remains invisible, apply targeted preservation for the required method's existence, name, and complete signature. Validate the optimized consumer artifact and the system dispatch path separately.
+
+This does not imply that public SDK callbacks or every method in the same class also require explicit keep rules.
+
+## Misinterpreting invoke-super references
+
+An optimized `invoke-super` instruction may reference an ancestor type. That reference alone does not establish that runtime dispatch bypasses an intermediate superclass implementation.
+
+Compare with a known working artifact when available, and verify the applicable ART/Dalvik method resolution and dispatch semantics using the actual class hierarchy. Use a minimal runtime reproduction when necessary. Do not add stub declarations merely to restore a preferred class name in decompiled output.
+
+Validate the required dispatch behavior rather than fixing the text of an instruction that R8 may legitimately rewrite.
+
+## References
+
+- [Android: optimization for library authors and consumer rules](https://developer.android.com/topic/performance/app-optimization/library-optimization)
+- [AOSP: Dalvik bytecode instructions](https://source.android.com/docs/core/runtime/dalvik-bytecode)
```

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -79,4 +79,5 @@
 
 - 外部 npm 依赖/版本集中根 package.json，private 子包所有 dependencies/devDependencies/optionalDependencies/peerDependencies 仅用 workspace:。可发布子包自行声明独立安装所需运行时/optional/peer 依赖，公共开发工具仍在根；变更同步清单和 pnpm 锁文件。
 - Android framework Java/AIDL 源码定位、跨版本签名/可用性、缺失分析及 Java hidden-API 生成必须使用 [android-api-diff skill](.agents/skills/android-api-diff/SKILL.md) 与其 CLI，保留默认 JSON，不自行模拟版本检查。安装/更新 skill 在根执行 `android-api-diff skill install`。
+- 修改隐藏接口/父类实现、系统回调、remap 或相关模块依赖/R8 配置，以及排查相关混淆 Release 故障时，必须使用 [android-hidden-api-r8 skill](.agents/skills/android-hidden-api-r8/SKILL.md)。检查最终应用模块 `gkd-android` 的实际 R8 输入及优化后的运行时契约，不以源码 override、编译成功或 Debug 正常代替；`gkd-app` 可见的 `gkd-hidden-api` stub 不代表最终 R8 可见。默认仅验证受影响的 gkd Release 路径，未经用户要求或证据支持不扩大审计范围。
 - 特权进程 UserService 的可能失败 Binder 方法在最外层末端 `catch (e: Throwable)` 捕获可恢复错误，通过 Binder 可传输异常/结果保留原类型、消息、堆栈；不只在主进程捕获，不让 NoSuchMethodError 等 LinkageError 逃逸崩溃。VirtualMachineError/ThreadDeath 等终止错误可原样抛出，不伪装普通失败。
```

**File**: `gkd-android/build.gradle.kts` (modified, +2/-0)
```diff
@@ -178,6 +178,8 @@ if (buildProperty("GKD_RENAME_PACKAGE_FLAG").isPresent) {
 
 dependencies {
     implementation(project(":gkd-app"))
+    // R8 needs hidden framework declarations to preserve system callback implementations.
+    compileOnly(project(":gkd-hidden-api"))
     implementation(libs.rikka.shizuku.provider)
     debugImplementation(libs.compose.tooling)
 
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ ktor = "3.6.0"
 lifecycle = "2.11.0"
 nav3 = "1.2.0"
 paging = "3.5.1"
-priv-kit = "0.17.1"
+priv-kit = "0.17.2"
 proguard = "7.10.0"
 remap = "0.1.6"
 room = "3.0.3"
```

**File**: `skills-lock.json` (modified, +7/-0)
```diff
@@ -7,6 +7,13 @@
       "sourceType": "github",
       "skillPath": "skills/android-api-diff/SKILL.md",
       "computedHash": "1dcdc7e450ceb0bf24e300a9bdda06a1a0852714596f809a6d7af62c45e3db82"
+    },
+    "android-hidden-api-r8": {
+      "source": "lisonge/remap",
+      "ref": "main",
+      "sourceType": "github",
+      "skillPath": "skills/android-hidden-api-r8/SKILL.md",
+      "computedHash": "211d60f45888d04b3f4d6bca0d73c0e4e55a42b525d59a5def0b8455613676ad"
     }
   }
 }
```

---

### Incident Patch 3: `0f57af62` (2026-10-02)
**Commit Message**: fix(desktop): refresh lists with lifecycle-aware F5 handlers

**File**: `gkd-app/README.md` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ Invoke-RestMethod -NoProxy "$api/semantics?window=app"
 {"window":"app","type":"key","key":"Escape"}
 ```
 
-`invoke/text` 调用真实无障碍操作；坐标事件由 Compose 命中检测与手势处理器执行，不移动系统鼠标、不发送系统键盘事件、不激活窗口。按键支持 Tab、Enter、Escape、Space、Backspace、F12。坐标及控件树 bounds 使用 AWT 逻辑像素，相对当前输入弹窗内容区，无弹窗时相对宿主内容区。节点路径仅属于该窗口最近一次控件树；失效返回 `Stale node path`。后台操作只支持 `area=content`，拒绝 `nativeKey`。
+`invoke/text` 调用真实无障碍操作；坐标事件由 Compose 命中检测与手势处理器执行，不移动系统鼠标、不发送系统键盘事件、不激活窗口。按键支持 Tab、Enter、Escape、Space、Backspace、F5、F12。F5 刷新当前订阅或应用列表，菜单和弹窗打开时不触发。坐标及控件树 bounds 使用 AWT 逻辑像素，相对当前输入弹窗内容区，无弹窗时相对宿主内容区。节点路径仅属于该窗口最近一次控件树；失效返回 `Stale node path`。后台操作只支持 `area=content`，拒绝 `nativeKey`。
 
 截图默认 `mode=compose`，读取当前 Skia 绘制记录并合成弹窗和最近网页帧，响应头为 `X-GKD-Capture: compose-recording`。它不重新创建页面，可在窗口被遮挡或位于屏幕外时使用，但不含系统菜单等原生窗口。`mode=screen` 捕获屏幕像素，响应头为 `X-GKD-Capture: screen`，要求窗口可见且可能包含遮挡。两者均禁止 `activate=true`。`area=frame` 包含 Compose 标题栏，不含原生外边框。
 
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/ui/component/GkDesktopKeyHandler.android.kt` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+package li.gkd.app.ui.component
+
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.input.key.Key
+
+@Composable
+actual fun GkDesktopKeyHandler(key: Key, enabled: Boolean, onKey: () -> Unit) = Unit
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/component/GkDesktopKeyHandler.kt` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+package li.gkd.app.ui.component
+
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.input.key.Key
+
+/** Handles an unmodified desktop key on release while this composition and its route are active. */
+@Composable
+expect fun GkDesktopKeyHandler(
+    key: Key,
+    enabled: Boolean = true,
+    onKey: () -> Unit,
+)
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/component/GkMultiSelectionActions.kt` (modified, +3/-0)
```diff
@@ -54,6 +54,9 @@ fun <K> RowScope.GkMultiSelectionActions(
             enabled = enabled && selectedKeys.isNotEmpty(),
             onClick = { expanded = true },
         )
+        if (expanded && enabled && selectedKeys.isNotEmpty()) {
+            LocalOverlayBackHandler.current { expanded = false }
+        }
         DropdownMenu(
             expanded = expanded && enabled && selectedKeys.isNotEmpty(),
             onDismissRequest = { expanded = false },
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/component/GkSubscriptionActions.kt` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ fun RowScope.GkSubscriptionActions(
     onAddAppRule: () -> Unit, onAddGlobalRule: () -> Unit, onMenuOpen: () -> Boolean = { true },
 ) {
     var expanded by remember { mutableStateOf(false) }
+    if (expanded) LocalOverlayBackHandler.current { expanded = false }
     GkIconButton(
         imageVector = if (matching) GkIcons.FlashOn else GkIcons.FlashOff, animateMorph = true,
         colors = IconButtonDefaults.iconButtonColors(contentColor = if (!matching) CheckboxDefaults.colors().checkedBoxColor else LocalContentColor.current),
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/home/AppListPage.kt` (modified, +5/-9)
```diff
@@ -13,7 +13,6 @@ import androidx.compose.foundation.layout.wrapContentSize
 import androidx.compose.foundation.lazy.LazyColumn
 import androidx.compose.foundation.lazy.items
 import androidx.compose.material3.DropdownMenu
-import androidx.compose.material3.DropdownMenuItem
 import androidx.compose.material3.LocalContentColor
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Text
@@ -29,6 +28,7 @@ import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
+import androidx.compose.ui.input.key.Key
 import androidx.compose.ui.input.nestedscroll.nestedScroll
 import androidx.compose.ui.semantics.clearAndSetSemantics
 import androidx.compose.ui.semantics.contentDescription
@@ -40,7 +40,6 @@ import kotlinx.coroutines.CancellationException
 import kotlinx.coroutines.launch
 import li.gkd.app.model.AppInfo
 import li.gkd.app.resources.Res
-import li.gkd.app.resources.action_reload
 import li.gkd.app.resources.app_list_permission_error_description
 import li.gkd.app.resources.app_list_search
 import li.gkd.app.resources.app_list_update_success
@@ -70,6 +69,8 @@ import li.gkd.app.resources.whitelist_remove
 import li.gkd.app.resources.whitelist_title
 import li.gkd.app.state.Loadable
 import li.gkd.app.ui.component.DialogRequests
+import li.gkd.app.ui.component.GkDesktopKeyHandler
+import li.gkd.app.ui.component.LocalOverlayBackHandler
 import li.gkd.app.ui.component.GkAnimatedFloatingActionButton
 import li.gkd.app.ui.component.GkAppBarTextField
 import li.gkd.app.ui.component.GkCheckbox
@@ -151,6 +152,7 @@ fun appListPage(
             }
         }
     }
+    GkDesktopKeyHandler(Key.F5, onKey = ::refresh)
     dialogs.Render()
     val appInfos = state.appInfos
     val searchStr = state.searchText
@@ -243,6 +245,7 @@ fun appListPage(
                     ),
                 )
                 var expanded by remember { mutableStateOf(false) }
+                if (expanded) LocalOverlayBackHandler.current { expanded = false }
                 GkFilterIconButton(
                     filtered = !state.showAllApps,
                     contentDescription = stringResource(Res.string.sort_filter),
@@ -258,13 +261,6 @@ fun appListPage(
                         expanded = expanded,
                         onDismissRequest = { expanded = false }
                     ) {
-                        DropdownMenuItem(
-                            text = { Text(stringResource(Res.string.action_reload)) },
-                            onClick = {
-                                expanded = false
-                                refresh()
-                            },
-                        )
                         GkMenuGroupCard(
                             inTop = true,
                             title = stringResource(Res.string.sort_title)
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/home/SubsManagePage.kt` (modified, +5/-1)
```diff
@@ -20,6 +20,7 @@ import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.Modifier
+import androidx.compose.ui.input.key.Key
 import androidx.compose.ui.input.nestedscroll.nestedScroll
 import androidx.compose.ui.text.style.TextDecoration
 import androidx.compose.ui.unit.dp
@@ -52,6 +53,7 @@ import li.gkd.app.settings.SettingsRepository
 import li.gkd.app.state.Loadable
 import li.gkd.app.subscription.SubscriptionResult
 import li.gkd.app.ui.component.GkAlertDialog
+import li.gkd.app.ui.component.GkDesktopKeyHandler
 import li.gkd.app.ui.component.GkAnimatedFloatingActionButton
 import li.gkd.app.ui.component.GkBatchActionMenuItem
 import li.gkd.app.ui.component.GkIcons
@@ -125,6 +127,8 @@ private fun subsManageContent(
         }
     }
 
+    val refresh: () -> Unit = { launchAction { vm.refreshSubscriptions().message()?.let(toast) } }
+    GkDesktopKeyHandler(Key.F5, onKey = refresh)
     var settingsDialogVisible by remember { mutableStateOf(false) }
     val powerWarningItem by vm.powerWarningItemFlow.collectAsStateWithLifecycle()
     val store by SettingsRepository.settings.collectAsStateWithLifecycle()
@@ -331,7 +335,7 @@ private fun subsManageContent(
                 modifier = Modifier.weight(1f),
                 state = pullToRefreshState,
                 isRefreshing = refreshing,
-                onRefresh = { launchAction { vm.refreshSubscriptions().message()?.let(toast) } },
+                onRefresh = refresh,
             ) {
                 LazyColumn(
                     state = lazyListState,
```

**File**: `gkd-app/src/jvmMain/kotlin/li/gkd/app/DesktopBackDispatcher.kt` (modified, +8/-6)
```diff
@@ -8,11 +8,13 @@ import androidx.compose.runtime.staticCompositionLocalOf
 
 /** UI event infrastructure; registrations live exactly as long as their composables. */
 class DesktopBackDispatcher {
-    private data class Handler(val enabled: () -> Boolean, val action: () -> Unit)
+    private data class Handler(val enabled: () -> Boolean, val overlay: Boolean, val action: () -> Unit)
 
     private val handlers = mutableListOf<Handler>()
-    fun register(enabled: () -> Boolean = { true }, handler: () -> Unit): () -> Unit {
-        val entry = Handler(enabled, handler)
+    val hasOverlay get() = handlers.any { it.overlay && it.enabled() }
+
+    fun register(enabled: () -> Boolean = { true }, overlay: Boolean = false, handler: () -> Unit): () -> Unit {
+        val entry = Handler(enabled, overlay, handler)
         handlers += entry
         return { handlers.remove(entry) }
     }
@@ -27,12 +29,12 @@ val LocalDesktopBackDispatcher =
 val LocalDesktopRouteActive = staticCompositionLocalOf { true }
 
 @Composable
-fun GkDesktopBackHandler(onBack: () -> Unit) {
+fun GkDesktopBackHandler(overlay: Boolean = false, onBack: () -> Unit) {
     val dispatcher = LocalDesktopBackDispatcher.current
     val current by rememberUpdatedState(onBack)
     val active by rememberUpdatedState(LocalDesktopRouteActive.current)
-    DisposableEffect(dispatcher) {
-        val remove = dispatcher.register(enabled = { active }) { current() }
+    DisposableEffect(dispatcher, overlay) {
+        val remove = dispatcher.register(enabled = { active }, overlay = overlay) { current() }
         onDispose { remove() }
     }
 }
```

---

### Incident Patch 4: `3f1d521e` (2026-10-02)
**Commit Message**: fix: animate checkbox and menu disabled colors

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/component/GkCheckbox.kt` (modified, +46/-2)
```diff
@@ -1,10 +1,14 @@
 package li.gkd.app.ui.component
 
+import androidx.compose.animation.animateColorAsState
+import androidx.compose.animation.core.tween
 import androidx.compose.foundation.interaction.MutableInteractionSource
 import androidx.compose.material3.Checkbox
 import androidx.compose.material3.CheckboxColors
 import androidx.compose.material3.CheckboxDefaults
+import androidx.compose.material3.MaterialTheme
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
 import androidx.compose.runtime.key
 import androidx.compose.ui.Modifier
 
@@ -17,13 +21,53 @@ fun GkCheckbox(
     enabled: Boolean = true,
     colors: CheckboxColors = CheckboxDefaults.colors(),
     interactionSource: MutableInteractionSource? = null
-) = key(key) {
+) = key(key, MaterialTheme.colorScheme.primary) {
+    // Theme colors already animate in GkTheme; reset local color animations as they change.
+    val checkmarkColor by animateColorAsState(
+        targetValue = if (checked) colors.checkedCheckmarkColor else colors.uncheckedCheckmarkColor,
+        animationSpec = tween(180), label = "checkboxCheckmarkColor",
+    )
+    val boxColor by animateColorAsState(
+        targetValue = with(colors) {
+            if (enabled) {
+                if (checked) checkedBoxColor else uncheckedBoxColor
+            } else {
+                if (checked) disabledCheckedBoxColor else disabledUncheckedBoxColor
+            }
+        },
+        animationSpec = tween(180), label = "checkboxBoxColor",
+    )
+    val borderColor by animateColorAsState(
+        targetValue = with(colors) {
+            if (enabled) {
+                if (checked) checkedBorderColor else uncheckedBorderColor
+            } else {
+                if (checked) disabledBorderColor else disabledUncheckedBorderColor
+            }
+        },
+        animationSpec = tween(180), label = "checkboxBorderColor",
+    )
+    // Share animated values across state slots, including Material's disabled snap path.
+    val animatedColors = CheckboxColors(
+        checkedCheckmarkColor = checkmarkColor,
+        uncheckedCheckmarkColor = checkmarkColor,
+        checkedBoxColor = boxColor,
+        uncheckedBoxColor = boxColor,
+        disabledCheckedBoxColor = boxColor,
+        disabledUncheckedBoxColor = boxColor,
+        disabledIndeterminateBoxColor = boxColor,
+        checkedBorderColor = borderColor,
+        uncheckedBorderColor = borderColor,
+        disabledBorderColor = borderColor,
+        disabledUncheckedBorderColor = borderColor,
+        disabledIndeterminateBorderColor = borderColor,
+    )
     Checkbox(
         checked = checked,
         onCheckedChange = onCheckedChange,
         modifier = modifier,
         enabled = enabled,
-        colors = colors,
+        colors = animatedColors,
         interactionSource = interactionSource
     )
 }
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/component/GkMenu.kt` (modified, +14/-2)
```diff
@@ -1,13 +1,16 @@
 package li.gkd.app.ui.component
 
+import androidx.compose.animation.animateColorAsState
+import androidx.compose.animation.core.tween
 import androidx.compose.foundation.layout.padding
-import androidx.compose.material3.Checkbox
 import androidx.compose.material3.DropdownMenuItem
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.MenuDefaults
 import androidx.compose.material3.RadioButton
 import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.key
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.unit.dp
 
@@ -31,17 +34,26 @@ fun GkMenuItemCheckbox(
     onClick: () -> Unit,
     enabled: Boolean = true,
 ) {
+    val colors = MenuDefaults.itemColors()
+    // Theme colors already animate in GkTheme; reset only the local color animation.
+    val textColor by key(MaterialTheme.colorScheme.primary) {
+        animateColorAsState(
+            targetValue = if (enabled) colors.textColor else colors.disabledTextColor,
+            animationSpec = tween(180), label = "menuCheckboxTextColor",
+        )
+    }
     DropdownMenuItem(
         text = { Text(text = text) },
         trailingIcon = {
-            Checkbox(
+            GkCheckbox(
                 checked = checked,
                 onCheckedChange = { onClick() },
                 enabled = enabled,
             )
         },
         onClick = onClick,
         enabled = enabled,
+        colors = colors.copy(textColor = textColor, disabledTextColor = textColor),
     )
 }
 
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/component/GkRuleListItem.kt` (modified, +1/-2)
```diff
@@ -18,7 +18,6 @@ import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.layout.width
 import androidx.compose.material3.Card
 import androidx.compose.material3.CardDefaults
-import androidx.compose.material3.Checkbox
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
@@ -97,7 +96,7 @@ fun GkRuleListItem(
             // 52 dp switch + 8 dp on either side matches the content inset.
             Box(Modifier.width(68.dp).fillMaxHeight(), contentAlignment = Alignment.Center) {
                 if (selectedMode) {
-                    if (selectable) Checkbox(
+                    if (selectable) GkCheckbox(
                         selected,
                         onCheckedChange = null,
                         enabled = selectionEnabled
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/component/GkSubsItemCard.kt` (modified, +1/-2)
```diff
@@ -14,7 +14,6 @@ import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.layout.width
 import androidx.compose.material3.Card
 import androidx.compose.material3.CardDefaults
-import androidx.compose.material3.Checkbox
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Text
 import androidx.compose.material3.minimumInteractiveComponentSize
@@ -258,7 +257,7 @@ fun GkSubsItemCard(
             }
             Spacer(modifier = Modifier.width(4.dp))
             if (isSelectedMode) {
-                Checkbox(
+                GkCheckbox(
                     checked = isSelected,
                     onCheckedChange = null,
                     enabled = selectionEnabled,
```

**File**: `gkd-app/src/commonMain/kotlin/li/gkd/app/ui/snapshot/SnapshotPage.kt` (modified, +2/-2)
```diff
@@ -24,7 +24,6 @@ import androidx.compose.foundation.lazy.grid.rememberLazyGridState
 import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.material3.Card
 import androidx.compose.material3.CardDefaults
-import androidx.compose.material3.Checkbox
 import androidx.compose.material3.CheckboxDefaults
 import androidx.compose.material3.IconButtonDefaults
 import androidx.compose.material3.MaterialTheme
@@ -110,6 +109,7 @@ import li.gkd.app.time.format
 import li.gkd.app.ui.component.DialogRequests
 import li.gkd.app.ui.component.GkAppNameText
 import li.gkd.app.ui.component.GkBatchActionMenuItem
+import li.gkd.app.ui.component.GkCheckbox
 import li.gkd.app.ui.component.GkEmptyState
 import li.gkd.app.ui.component.GkFixedTimeText
 import li.gkd.app.ui.component.GkIconButton
@@ -650,7 +650,7 @@ private fun SnapshotCard(
                     contentAlignment = Alignment.Center,
                 ) {
                     if (selectedMode) {
-                        Checkbox(
+                        GkCheckbox(
                             checked = selected,
                             onCheckedChange = null,
                             modifier = Modifier.clearAndSetSemantics {},
```

---

### Incident Patch 5: `fbd455d0` (2026-10-02)
**Commit Message**: fix: sync splash theme and consolidate app metadata

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@
 - 原生 res 归 gkd-android，gkd-app 不引用其 R；通知小图标通过 Application Manifest `notificationSmallIcon` 的 `android:resource` 注入，运行时校验非零，不持久化 ID。共享颜色用 Kotlin，Compose Resources 位于 gkd-app。
 - 共享及普通 Android Kotlin 文案统一官方 Compose Resources（`Res.string/plurals`），不建自定义 UiString/Desktop 文案表或原生副本；只有 Manifest/平台配置/变体标签保留原生 ID，Kotlin 可按需读取平台标签。语义/参数与持久化数据分离，文案不在枚举、单例或静态初始化解析缓存，语言切换不改写用户模板。
 - 参数只用 `%1$s`、`%2$s` 等位置文本占位符；禁止数值/精度/补零格式指令，Kotlin 按明确 Locale/精度先格式化。Compose 用官方 Composable API，协程用 suspend getString/getPluralString；getSync 仅限低频同步边界，不用于静态初始化、高频或新增 Compose 路径，不用 runBlocking(Dispatchers.Main)。新增翻译/复数/限定符验证双端选择替换，校验任务不生成平台副本，访问器/打包交官方插件。
-- Kotlin 可见性按实际访问需求收窄，允许 private/internal；对外公开声明使用默认 public，不为统一形式扩大可见性。仅为公开属性收窄可见性/可变性的 `_xxx` 字段改用 Explicit Backing Fields；普通私有缓存、生成命名及 Lambda `_` 不受限。避免循环静态初始化。
+- Kotlin 可见性按实际访问需求收窄，优先使用 private；gkd-app 模块禁止使用 internal 关键字，需要跨文件或类访问的声明使用默认 public，其他模块允许 internal。仅为公开属性收窄可见性/可变性的 `_xxx` 字段改用 Explicit Backing Fields；普通私有缓存、生成命名及 Lambda `_` 不受限。避免循环静态初始化。
 - 工具按职责组织并优先沿用邻近代码风格；无状态工具可用顶级函数，有共享状态或明确命名空间需求时使用 object，不为形式新增包装。XxxExt.kt 只放扩展，普通工具放职责明确的文件；不借规范调整进行无关重构。
 - 跨文件/页面复用 UI 统一 `Gk` + PascalCase，名称描述用途，禁用 Perf/Custom 泛化前缀。单组件文件同名，组件族及配套声明可同文件，文件以 Gk 开头并描述组件族；配置用 GkAbcDefaults/Colors，图标用 GkIcon/GkIcons。页面、私有 Composable、Preview、工具、Modifier 扩展、独立状态及其 Render() 不强制此前缀。
 
```

**File**: `gkd-android/src/main/AndroidManifest.xml` (modified, +7/-0)
```diff
@@ -35,6 +35,13 @@
             android:name="notificationSmallIcon"
             android:resource="@drawable/ic_status" />
 
+        <meta-data
+            android:name="splashScreenLightTheme"
+            android:resource="@style/SplashScreenLightTheme" />
+        <meta-data
+            android:name="splashScreenNightTheme"
+            android:resource="@style/SplashScreenNightTheme" />
+
         <meta-data
             android:name="channel"
             android:value="${channel}" />
```

**File**: `gkd-android/src/main/res/values/themes.xml` (modified, +10/-2)
```diff
@@ -1,4 +1,4 @@
-<resources>
+<resources xmlns:tools="http://schemas.android.com/tools" tools:ignore="NewApi">
 
     <style name="AppLightTheme" parent="android:Theme.Material.Light.NoActionBar">
         <item name="android:windowBackground">@android:color/transparent</item>
@@ -9,12 +9,20 @@
     </style>
 
     <style name="SplashScreenLightTheme" parent="Theme.SplashScreen">
+        <!-- Match Material3 lightColorScheme().background. -->
+        <item name="windowSplashScreenBackground">#FEF7FF</item>
+        <item name="android:windowLightStatusBar">true</item>
+        <item name="android:windowLightNavigationBar">true</item>
         <item name="windowSplashScreenAnimatedIcon">@mipmap/gkd_black</item>
         <item name="windowSplashScreenAnimationDuration">1000</item>
         <item name="postSplashScreenTheme">@style/AppLightTheme</item>
     </style>
 
     <style name="SplashScreenNightTheme" parent="Theme.SplashScreen">
+        <!-- Match Material3 darkColorScheme().background. -->
+        <item name="windowSplashScreenBackground">#141218</item>
+        <item name="android:windowLightStatusBar">false</item>
+        <item name="android:windowLightNavigationBar">false</item>
         <item name="windowSplashScreenAnimatedIcon">@mipmap/gkd_white</item>
         <item name="windowSplashScreenAnimationDuration">1000</item>
         <item name="postSplashScreenTheme">@style/AppNightTheme</item>
@@ -30,4 +38,4 @@
 
     <style name="SplashScreenTheme" parent="SplashScreenLightTheme" />
 
-</resources>
\ No newline at end of file
+</resources>
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/App.kt` (modified, +34/-28)
```diff
@@ -69,38 +69,21 @@ private lateinit var innerApp: App
 val app: App
     get() = innerApp
 
-private val applicationInfo by lazy {
-    app.packageManager.getApplicationInfo(
-        app.packageName,
-        PackageManager.GET_META_DATA
-    )
-}
-
-private fun getMetaString(key: String): String {
-    return applicationInfo.metaData.getString(key) ?: error("Missing meta-data: $key")
-}
-
-val notificationSmallIcon: Int by lazy {
-    val resourceId = applicationInfo.metaData?.getInt("notificationSmallIcon") ?: 0
-    check(resourceId != 0) { "Missing resource meta-data: notificationSmallIcon" }
-    resourceId
-}
-
 // https://github.com/android-cs/16/blob/main/packages/SettingsLib/src/com/android/settingslib/accessibility/AccessibilityUtils.java#L41
 private const val ENABLED_ACCESSIBILITY_SERVICES_SEPARATOR = ':'
 
 @Serializable
 data class AppMeta(
-    val channel: String = getMetaString("channel"),
-    val buildKey: String = getMetaString("buildKey"),
-    val commitId: String = getMetaString("commitId"),
-    val commitTime: Long = getMetaString("commitTime").toLong(),
-    val tagName: String? = getMetaString("tagName").takeIf { it.isNotEmpty() },
-    val debuggable: Boolean = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0,
+    val channel: String = app.getMetaString("channel"),
+    val buildKey: String = app.getMetaString("buildKey"),
+    val commitId: String = app.getMetaString("commitId"),
+    val commitTime: Long = app.getMetaString("commitTime").toLong(),
+    val tagName: String? = app.getMetaString("tagName").takeIf { it.isNotEmpty() },
+    val debuggable: Boolean = app.applicationInfoWithMetadata.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0,
     val versionCode: Int = selfAppInfo.versionCode,
     val versionName: String = selfAppInfo.versionName!!,
     val appId: String = app.packageName!!,
-    val appName: String = applicationInfo.loadLabel(app.packageManager).toString()
+    val appName: String = app.applicationInfoWithMetadata.loadLabel(app.packageManager).toString()
 ) {
     val commitUrl = "${AppLinks.Repository}/".run {
         plus(if (tagName != null) "tree/$tagName" else "commit/$commitId")
@@ -112,10 +95,6 @@ data class AppMeta(
 
 val META by lazy { AppMeta() }
 
-fun contentObserver(listener: () -> Unit) = object : ContentObserver(null) {
-    override fun onChange(selfChange: Boolean) = listener()
-}
-
 class App : Application() {
     companion object {
         const val START_WAIT_TIME = 3000L
@@ -125,6 +104,33 @@ class App : Application() {
         innerApp = this
     }
 
+    val applicationInfoWithMetadata: ApplicationInfo by lazy {
+        packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
+    }
+
+    val notificationSmallIcon: Int by lazy {
+        getMetaInt("notificationSmallIcon")
+    }
+
+    val splashScreenLightTheme: Int by lazy {
+        getMetaInt("splashScreenLightTheme")
+    }
+
+    val splashScreenNightTheme: Int by lazy {
+        getMetaInt("splashScreenNightTheme")
+    }
+
+    fun getMetaString(key: String): String {
+        return applicationInfoWithMetadata.metaData?.getString(key)
+            ?: error("Missing meta-data: $key")
+    }
+
+    fun getMetaInt(key: String): Int {
+        val resourceId = applicationInfoWithMetadata.metaData?.getInt(key) ?: 0
+        check(resourceId != 0) { "Missing resource meta-data: $key" }
+        return resourceId
+    }
+
     override fun attachBaseContext(base: Context?) {
         super.attachBaseContext(base)
         if (AndroidTarget.P) {
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/MainActivity.kt` (modified, +2/-2)
```diff
@@ -17,7 +17,6 @@ import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.platform.LocalDensity
 import androidx.core.content.FileProvider
-import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
 import androidx.lifecycle.lifecycleScope
 import kotlinx.coroutines.launch
 import li.gkd.app.development.DesktopProfileExport
@@ -40,6 +39,7 @@ import li.gkd.app.ui.component.LocalTopBarWindowInsets
 import li.gkd.app.ui.share.ActivityImeController
 import li.gkd.app.ui.share.ActivityResultRequests
 import li.gkd.app.ui.share.FixedWindowInsets
+import li.gkd.app.ui.theme.installThemedSplashScreen
 import li.gkd.app.util.AndroidTarget
 import li.gkd.app.util.BarUtils
 import li.gkd.app.util.ToastUtils
@@ -99,7 +99,7 @@ class MainActivity : ComponentActivity() {
     }
 
     override fun onCreate(savedInstanceState: Bundle?) {
-        installSplashScreen()
+        installThemedSplashScreen()
         enableEdgeToEdge()
         fixTransparentNavigationBar()
         super.onCreate(savedInstanceState)
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/a11y/A11yExt.kt` (modified, +5/-3)
```diff
@@ -1,6 +1,7 @@
 package li.gkd.app.a11y
 
 import android.content.ComponentName
+import android.database.ContentObserver
 import android.provider.Settings
 import android.view.accessibility.AccessibilityEvent
 import android.view.accessibility.AccessibilityNodeInfo
@@ -11,7 +12,6 @@ import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.flow.callbackFlow
 import kotlinx.coroutines.flow.stateIn
 import li.gkd.app.app
-import li.gkd.app.contentObserver
 import li.gkd.app.service.A11yService
 import li.gkd.app.util.AndroidTarget
 import li.gkd.app.util.mapState
@@ -21,8 +21,10 @@ import kotlin.contracts.contract
 fun useEnabledA11yServicesFlow(scope: CoroutineScope): StateFlow<Set<ComponentName>> {
     val initialValue = app.getSecureA11yServices()
     return callbackFlow {
-        val contextObserver = contentObserver {
-            trySend(app.getSecureA11yServices())
+        val contextObserver = object : ContentObserver(null) {
+            override fun onChange(selfChange: Boolean) {
+                trySend(app.getSecureA11yServices())
+            }
         }
         app.registerObserver(
             Settings.Secure.getUriFor(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES),
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/logging/LogPlatform.android.kt` (modified, +4/-4)
```diff
@@ -6,14 +6,14 @@ import android.util.Log
 import li.gkd.app.META
 import li.gkd.app.data.AndroidLogMetadata
 
-internal actual fun logMetadata(): LogMetadata = AndroidLogMetadata.create()
-internal actual fun isLogDebuggable(): Boolean = META.debuggable
+actual fun logMetadata(): LogMetadata = AndroidLogMetadata.create()
+actual fun isLogDebuggable(): Boolean = META.debuggable
 
-internal actual fun writePlatformLog(tag: String, message: String) {
+actual fun writePlatformLog(tag: String, message: String) {
     Log.d(tag, message)
 }
 
-internal actual fun formatLogValue(value: Any?): String = when (value) {
+actual fun formatLogValue(value: Any?): String = when (value) {
     is Bundle -> {
         val sb = StringBuilder()
         sb.append("Bundle{")
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/notif/NotificationCatalog.kt` (modified, +3/-3)
```diff
@@ -2,7 +2,7 @@ package li.gkd.app.notif
 
 import android.app.Service
 import li.gkd.app.META
-import li.gkd.app.notificationSmallIcon
+import li.gkd.app.app
 import li.gkd.app.resources.Res
 import li.gkd.app.resources.a11y_events_recording
 import li.gkd.app.resources.a11y_running
@@ -66,7 +66,7 @@ data class ForegroundNotification(
     override val title: String,
     override val text: String? = null,
     override val uri: String? = null,
-    override val smallIcon: Int = notificationSmallIcon,
+    override val smallIcon: Int = app.notificationSmallIcon,
     override val stopService: KClass<out Service>? = null,
 ) : AppNotificationSpec {
     override val id: Int
@@ -85,7 +85,7 @@ data class PostedNotification(
     override val title: String,
     override val text: String? = null,
     override val uri: String? = null,
-    override val smallIcon: Int = notificationSmallIcon,
+    override val smallIcon: Int = app.notificationSmallIcon,
     override val ongoing: Boolean = false,
     override val autoCancel: Boolean = true,
 ) : AppNotificationSpec {
```

---

### Incident Patch 6: `23d14e4b` (2026-10-02)
**Commit Message**: ci: unify build job and artifact names

**File**: `.github/workflows/build.yml` (modified, +12/-3)
```diff
@@ -12,7 +12,7 @@ on:
       - '.github/**'
 
 jobs:
-  build:
+  build-android:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v7
@@ -44,9 +44,18 @@ jobs:
           archive: false
           path: gkd-android/build/outputs/apk/gkd/release/*.apk
 
+      - name: derive outputs artifact name from APK
+        id: outputs-artifact
+        shell: bash
+        run: |
+          apk_files=(gkd-android/build/outputs/apk/gkd/release/gkd-v*.apk)
+          [[ ${#apk_files[@]} -eq 1 && -f "${apk_files[0]}" ]]
+          apk_name=$(basename "${apk_files[0]}" .apk)
+          echo "name=${apk_name}.outputs" >> "$GITHUB_OUTPUT"
+
       - uses: actions/upload-artifact@v7
         with:
-          name: outputs
+          name: ${{ steps.outputs-artifact.outputs.name }}
           path: gkd-android/build/outputs
 
   build-windows:
@@ -73,4 +82,4 @@ jobs:
           archive: false
           include-hidden-files: true
           if-no-files-found: error
-          path: .local/desktop-packages/gkd-*-windows-*-portable.zip
+          path: .local/desktop-packages/gkd-v*.win-*.zip
```

**File**: `.github/workflows/release.yml` (modified, +9/-9)
```diff
@@ -6,7 +6,7 @@ on:
       - v*
 
 jobs:
-  build:
+  build-android:
     permissions:
       contents: write
     runs-on: ubuntu-latest
@@ -43,22 +43,22 @@ jobs:
 
       - uses: actions/upload-artifact@v7
         with:
-          name: release
+          name: gkd-apk
           path: gkd-android/build/outputs/apk/gkd/release
 
       - uses: actions/upload-artifact@v7
         with:
-          name: playRelease
+          name: gkd-play-aab
           path: gkd-android/build/outputs/bundle/playRelease
 
       - uses: actions/upload-artifact@v7
         with:
-          name: outputs
+          name: gkd-${{ github.ref_name }}.outputs
           path: gkd-android/build/outputs
 
       - run: |
           cp outputs/apk/gkd/release/*.apk "${GITHUB_WORKSPACE}/gkd-${GITHUB_REF_NAME}.apk"
-          zip -r "${GITHUB_WORKSPACE}/outputs-${GITHUB_REF_NAME}.zip" outputs
+          zip -r "${GITHUB_WORKSPACE}/gkd-${GITHUB_REF_NAME}.outputs.zip" outputs
         working-directory: gkd-android/build
 
       - uses: softprops/action-gh-release@v3
@@ -70,10 +70,10 @@ jobs:
           fail_on_unmatched_files: true
           files: |
             gkd-*.apk
-            outputs-*.zip
+            gkd-v*.outputs.zip
 
   build-windows:
-    needs: build
+    needs: build-android
     permissions:
       contents: write
     runs-on: windows-latest
@@ -99,10 +99,10 @@ jobs:
           archive: false
           include-hidden-files: true
           if-no-files-found: error
-          path: .local/desktop-packages/gkd-*-windows-*-portable.zip
+          path: .local/desktop-packages/gkd-v*.win-*.zip
 
       - uses: softprops/action-gh-release@v3
         with:
           tag_name: ${{ github.ref_name }}
           fail_on_unmatched_files: true
-          files: .local/desktop-packages/gkd-*-windows-*-portable.zip
+          files: .local/desktop-packages/gkd-v*.win-*.zip
```

**File**: `gkd-app/README.md` (modified, +2/-2)
```diff
@@ -36,9 +36,9 @@ pnpm app:tools --help
 ./gradlew.bat :gkd-app:packageWindowsPortable
 ```
 
-ZIP 输出到 `.local/desktop-packages/gkd-windows-<架构>-portable.zip`。解压完整的 `GKD/` 目录后运行 `GKD.exe`，无需安装 Java，也不生成 MSI 或安装器。架构跟随构建所用 JDK；当前 WebView2 集成使用 Windows x64，建议使用 x64 JDK，网页功能仍需系统 WebView2 Runtime。
+ZIP 输出到 `.local/desktop-packages/gkd.win-<架构>.zip`。解压完整的 `GKD/` 目录后运行 `GKD.exe`，无需安装 Java，也不生成 MSI 或安装器。架构跟随构建所用 JDK，`amd64` / `x86_64` 统一命名为 `x86_64`；当前 WebView2 集成使用 Windows x64，建议使用 x64 JDK，网页功能仍需系统 WebView2 Runtime。
 
-设置非空环境变量或 Gradle 属性 `GKD_RENAME_PACKAGE_FLAG` 后，APK 命名为 `gkd-v<版本号><提交后缀>.apk`，ZIP 命名为 `gkd-v<版本号><提交后缀>-windows-<架构>-portable.zip`。HEAD 正好位于 Git tag 时无提交后缀，否则追加 `-<7位提交ID>`。例如：
+设置非空环境变量或 Gradle 属性 `GKD_RENAME_PACKAGE_FLAG` 后，APK 命名为 `gkd-v<版本号><提交后缀>.apk`，ZIP 命名为 `gkd-v<版本号><提交后缀>.win-<架构>.zip`。HEAD 正好位于 Git tag 时无提交后缀，否则追加 `-<7位提交ID>`。例如：
 
 ```powershell
 ./gradlew.bat :gkd-app:packageWindowsPortable -PGKD_RENAME_PACKAGE_FLAG=1
```

**File**: `gkd-app/build.gradle.kts` (modified, +5/-1)
```diff
@@ -155,11 +155,15 @@ if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
     } else {
         "gkd"
     }
+    val archiveArchitecture = when (val architecture = System.getProperty("os.arch").lowercase()) {
+        "amd64", "x86_64" -> "x86_64"
+        else -> architecture
+    }
     tasks.register<Zip>("packageWindowsPortable") {
         group = "compose desktop"
         description = "Packages the Windows application and Java runtime as a portable ZIP."
         from(tasks.named("createReleaseDistributable"))
-        archiveFileName.set("$archiveBaseName-windows-${System.getProperty("os.arch")}-portable.zip")
+        archiveFileName.set("$archiveBaseName.win-$archiveArchitecture.zip")
         destinationDirectory.set(rootProject.layout.projectDirectory.dir(".local/desktop-packages"))
     }
 }
```

---

### Incident Patch 7: `818746d0` (2026-10-02)
**Commit Message**: feat: auto-start status service on boot and use non-null receiver parameters

**File**: `gkd-android/src/main/AndroidManifest.xml` (modified, +9/-0)
```diff
@@ -4,6 +4,7 @@
     tools:ignore="ProtectedPermissions,PackageVisibilityPolicy,QueryAllPackagesPermission,ForegroundServicesPolicy">
 
     <uses-permission android:name="android.permission.INTERNET" />
+    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
     <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
     <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
     <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
@@ -99,6 +100,14 @@
             </intent-filter>
         </activity>
 
+        <receiver
+            android:name="li.gkd.app.receiver.BootReceiver"
+            android:exported="false">
+            <intent-filter>
+                <action android:name="android.intent.action.BOOT_COMPLETED" />
+            </intent-filter>
+        </receiver>
+
         <provider
             android:name="rikka.shizuku.ShizukuProvider"
             android:authorities="${applicationId}.shizuku"
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/a11y/A11yFeat.kt` (modified, +4/-7)
```diff
@@ -132,8 +132,8 @@ private fun initRuleChangedLog() {
 private const val volumeChangedAction = "android.media.VOLUME_CHANGED_ACTION"
 private fun createVolumeReceiver() = object : BroadcastReceiver() {
     var lastVolumeTriggerTime = -1L
-    override fun onReceive(context: Context?, intent: Intent?) {
-        if (intent?.action == volumeChangedAction) {
+    override fun onReceive(context: Context, intent: Intent) {
+        if (intent.action == volumeChangedAction) {
             val t = System.currentTimeMillis()
             if (t - lastVolumeTriggerTime > 3000 && !ScreenUtils.isLocked()) {
                 lastVolumeTriggerTime = t
@@ -170,11 +170,8 @@ private fun initCaptureVolume() {
 var isInteractive = true
     private set
 private val screenStateReceiver = object : BroadcastReceiver() {
-    override fun onReceive(
-        context: Context?,
-        intent: Intent?
-    ) {
-        val action = intent?.action ?: return
+    override fun onReceive(context: Context, intent: Intent) {
+        val action = intent.action ?: return
         LogUtils.d("screenStateReceiver->${action}")
         isInteractive = when (action) {
             Intent.ACTION_SCREEN_ON -> true
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/data/appinfo/AppChangeMonitor.kt` (modified, +2/-2)
```diff
@@ -14,8 +14,8 @@ object AppChangeMonitor {
         ContextCompat.registerReceiver(
             app,
             object : BroadcastReceiver() {
-                override fun onReceive(context: Context?, intent: Intent?) {
-                    intent?.data?.schemeSpecificPart?.let(onChanged)
+                override fun onReceive(context: Context, intent: Intent) {
+                    intent.data?.schemeSpecificPart?.let(onChanged)
                 }
             },
             IntentFilter().apply {
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/notif/StopServiceReceiver.kt` (modified, +1/-3)
```diff
@@ -12,9 +12,7 @@ import kotlin.reflect.KClass
 class StopServiceReceiver(private val service: Service) : BroadcastReceiver(), AutoCloseable {
     private var registered = false
 
-    override fun onReceive(context: Context?, intent: Intent?) {
-        context ?: return
-        intent ?: return
+    override fun onReceive(context: Context, intent: Intent) {
         if (intent.action == STOP_ACTION && intent.getStringExtra(STOP_ACTION) == service.javaClass.name) {
             service.stopSelf()
         }
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/receiver/BootReceiver.kt` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+package li.gkd.app.receiver
+
+import android.content.BroadcastReceiver
+import android.content.Context
+import android.content.Intent
+import li.gkd.app.service.StatusService
+
+class BootReceiver : BroadcastReceiver() {
+    override fun onReceive(context: Context, intent: Intent) {
+        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
+            StatusService.autoStart()
+        }
+    }
+}
```

**File**: `gkd-app/src/androidMain/kotlin/li/gkd/app/service/StatusService.kt` (modified, +1/-1)
```diff
@@ -178,7 +178,7 @@ class StatusService : LifecycleHookService() {
         fun autoStart() {
             if (System.currentTimeMillis() - lastAutoStart < 1000) return
             // 重启自动打开通知栏状态服务
-            // 需要已有服务或前台才能自主启动，否则报错 startForegroundService() not allowed due to mAllowStartForeground false
+            // 需要前台、已有服务或开机广播等系统豁免场景，否则系统可能拒绝启动前台服务
             if (needRestart) {
                 start()
                 lastAutoStart = System.currentTimeMillis()
```

---

### Incident Patch 8: `ab837b3e` (2026-09-26)
**Commit Message**: fix: reset app list scroll after displayed items change

**File**: `gkd-app/src/main/kotlin/li/gkd/app/feature/subscription/SubsAppListPage.kt` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ fun SubsAppListPage(route: SubsAppListRoute) {
     val pageScrollState = rememberListScrollState()
     val scrollBehavior = pageScrollState.scrollBehavior
     val listState = pageScrollState.listState
-    pageScrollState.ResetOnChange(apps.map { it.id })
+    pageScrollState.ResetOnListChange(apps, key = { it.id })
     var expanded by remember { mutableStateOf(false) }
 
     Scaffold(
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/feature/subscription/SubsGlobalGroupExcludePage.kt` (modified, +1/-0)
```diff
@@ -132,6 +132,7 @@ fun SubsGlobalGroupExcludePage(route: SubsGlobalGroupExcludeRoute) {
                 AppSortOption.ByUsedTime -> named.sortedBy { visits.value?.get(it) ?: Int.MAX_VALUE }
             }
         }
+        scroll.ResetOnListChange(visibleIds, key = { it })
         val selectableTargets = visibleIds.filterTo(mutableSetOf()) { controls.getValue(it).canEnable }
         val selected = selection.selectedKeys intersect selectableTargets
         LaunchedEffect(selectableTargets) { selection.retain(selectableTargets) }
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/A11yScopeAppListPage.kt` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ fun A11yScopeAppListPage() {
     val pageScrollState = rememberListScrollState(canScroll = { !editable })
     val scrollBehavior = pageScrollState.scrollBehavior
     val listState = pageScrollState.listState
-    pageScrollState.ResetOnChange(appInfos)
+    pageScrollState.ResetOnListChange(appInfos, key = { it.id })
     BackHandler(editable, vm.scope.launchUiAction {
         context.imeController.requestHide()
         if (vm.textChanged) {
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/BlockA11yAppListPage.kt` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ fun BlockA11yAppListPage() {
     val pageScrollState = rememberListScrollState(canScroll = { !editable })
     val scrollBehavior = pageScrollState.scrollBehavior
     val listState = pageScrollState.listState
-    pageScrollState.ResetOnChange(appInfos)
+    pageScrollState.ResetOnListChange(appInfos, key = { it.id })
     BackHandler(editable, vm.scope.launchUiAction {
         context.imeController.requestHide()
         if (vm.textChanged) {
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/component/Hooks.kt` (modified, +46/-1)
```diff
@@ -12,13 +12,14 @@ import androidx.compose.material3.TopAppBarState
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.ReadOnlyComposable
+import androidx.compose.runtime.SideEffect
 import androidx.compose.runtime.Stable
+import androidx.compose.runtime.snapshotFlow
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.runtime.rememberUpdatedState
 import androidx.compose.runtime.saveable.rememberSaveable
-import androidx.compose.runtime.snapshotFlow
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.focus.FocusRequester
 import androidx.compose.ui.focus.focusRequester
@@ -79,6 +80,31 @@ private fun TopAppBarScrollBehavior.resetScroll() {
     state.contentOffset = 0f
 }
 
+private class ListChangeMarker<T>(
+    var list: List<T>,
+    var leadingItemKey: Any?,
+)
+@Composable
+fun <T> GkResetOnItemKeysChange(
+    list: List<T>,
+    key: (T) -> Any,
+    leadingItemKey: Any? = null,
+    onChange: () -> Unit,
+) {
+    // Immutable list snapshots let us skip the key comparison on unrelated recompositions.
+    val previous = remember { ListChangeMarker(list, leadingItemKey) }
+    SideEffect {
+        val changed = previous.leadingItemKey != leadingItemKey ||
+            (previous.list !== list && (
+                previous.list.size != list.size ||
+                list.indices.any { index -> key(previous.list[index]) != key(list[index]) }
+            ))
+        previous.list = list
+        previous.leadingItemKey = leadingItemKey
+        if (changed) onChange()
+    }
+}
+
 @Stable
 class ListScrollState(
     val scrollBehavior: TopAppBarScrollBehavior,
@@ -87,6 +113,13 @@ class ListScrollState(
 ) {
     private var resetJob: Job? = null
 
+    private fun requestScrollReset() {
+        resetJob?.cancel()
+        resetJob = null
+        scrollBehavior.resetScroll()
+        listState.requestScrollToItem(0)
+    }
+
     private suspend fun performScrollReset() {
         scrollBehavior.resetScroll()
         listState.scrollToItem(0)
@@ -120,6 +153,18 @@ class ListScrollState(
                 .collect { if (currentEnabled.value) resetScroll() }
         }
     }
+
+    @Composable
+    fun <T> ResetOnListChange(
+        list: List<T>,
+        key: (T) -> Any,
+        leadingItemKey: Any? = null,
+        enabled: Boolean = true,
+    ) {
+        GkResetOnItemKeysChange(list, key, leadingItemKey) {
+            if (enabled) requestScrollReset()
+        }
+    }
 }
 
 @Stable
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/home/AppListPage.kt` (modified, +5/-15)
```diff
@@ -28,7 +28,6 @@ import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.runtime.DisposableEffect
-import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
@@ -44,8 +43,6 @@ import androidx.compose.ui.text.style.TextOverflow
 import androidx.compose.ui.unit.dp
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.lifecycle.viewmodel.compose.viewModel
-import kotlinx.coroutines.flow.drop
-import kotlinx.coroutines.launch
 import li.gkd.app.text.UiStrings
 import li.gkd.app.MainActivity
 import li.gkd.app.data.AppInfo
@@ -103,18 +100,11 @@ fun useAppListPage(): ScaffoldExt {
     val pageScrollState = rememberListScrollState()
     val scrollBehavior = pageScrollState.scrollBehavior
     val listState = pageScrollState.listState
-    LaunchedEffect(null) {
-        listOf(
-            PermissionStates.queryPackages.stateFlow,
-            vm.appInfosFlow,
-        ).forEach {
-            launch {
-                it.drop(1).collect {
-                    pageScrollState.resetScroll()
-                }
-            }
-        }
-    }
+    pageScrollState.ResetOnListChange(
+        appInfos,
+        key = { it.id },
+        leadingItemKey = if (state.canQueryPackages) null else 1,
+    )
     ResetPageScrollOnRequest(BottomNavItem.AppList, pageScrollState::resetScrollAndAwait)
     return ScaffoldExt(
         navItem = BottomNavItem.AppList,
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/home/AppListVm.kt` (modified, +0/-2)
```diff
@@ -83,8 +83,6 @@ class AppListVm(mainVm: MainViewModel) : BaseViewModel() {
     )
     private val showSearchBarFlow = MutableStateFlow(false)
 
-    val appInfosFlow = appFilter.appListFlow
-
     private val controls = combine(
         showSearchBarFlow,
         editWhiteListModeFlow,
```

---

### Incident Patch 9: `677c1388` (2026-09-24)
**Commit Message**: fix(priv): forward embedded screenshot failures safely

**File**: `AGENTS.md` (modified, +5/-0)
```diff
@@ -79,3 +79,8 @@
 - 涉及 Android framework Java/AIDL API 的源码定位、跨版本签名或可用性比较、API 缺失原因分析，以及 Java hidden-API 访问代码生成时，必须使用项目内的 `android-api-diff` skill：`.agents/skills/android-api-diff/SKILL.md`。
 - 按该 skill 的路由使用 `android-api-diff` CLI，并保留默认 JSON 输出；不得自行实现或模拟 Android API 版本检查。
 - 安装或更新项目级 skill 时，在项目根目录运行 `android-api-diff skill install`。
+
+## 嵌入式 UserService 异常边界
+
+- 嵌入式 `UserService` 运行在特权进程中。调用隐藏 API 等可能失败的 Binder 方法，必须在方法最外层以末端 `catch (e: Throwable)` 兜住可恢复错误，并通过 Binder 可传输的异常或失败结果将原始类型、消息和堆栈交给主进程；不得只在主进程捕获，也不得让 `NoSuchMethodError` 等 `LinkageError` 逃逸导致特权进程崩溃。
+- `VirtualMachineError` 和 `ThreadDeath` 等无法可靠恢复的终止错误可以原样抛出；不要把它们伪装成普通业务失败。
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/priv/CompatScreenshot.kt` (modified, +4/-4)
```diff
@@ -45,10 +45,10 @@ object CompatScreenshot {
         return when {
             AndroidTarget.S -> {
                 val displayToken = SurfaceControlHidden.getInternalDisplayToken()
-                val captureArgs = SurfaceControlHidden.DisplayCaptureArgs.Builder(displayToken)
-                    .setSourceCrop(crop)
-                    .setSize(width, height)
-                    .build()
+                val builder = SurfaceControlHidden.DisplayCaptureArgs.Builder(displayToken)
+                builder.setSourceCrop(crop)
+                builder.setSize(width, height)
+                val captureArgs = builder.build()
                 SurfaceControlHidden.captureDisplay(captureArgs)?.asBitmap()
             }
 
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/priv/UserService.kt` (modified, +16/-1)
```diff
@@ -2,12 +2,27 @@ package li.gkd.app.priv
 
 import android.graphics.Bitmap
 import android.graphics.Rect
+import android.os.ServiceSpecificException
 import androidx.annotation.Keep
 
+private const val SCREENSHOT_ERROR_CODE = 1
+private const val MAX_SCREENSHOT_ERROR_LENGTH = 16_384
+
 @Keep
 class UserService : IUserService.Stub() {
     override fun takeScreenshot(crop: Rect, rotation: Int): Bitmap? {
-        return CompatScreenshot.captureBySurfaceControl(crop, rotation)
+        return try {
+            CompatScreenshot.captureBySurfaceControl(crop, rotation)
+        } catch (e: VirtualMachineError) {
+            throw e
+        } catch (e: ThreadDeath) {
+            throw e
+        } catch (e: Throwable) {
+            throw ServiceSpecificException(
+                SCREENSHOT_ERROR_CODE,
+                e.stackTraceToString().take(MAX_SCREENSHOT_ERROR_LENGTH),
+            )
+        }
     }
 
     override fun destroy() = Unit
```

**File**: `gkd-hidden-api/src/main/java/android/os/ServiceSpecificException.java` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+package android.os;
+
+public class ServiceSpecificException extends RuntimeException {
+    public ServiceSpecificException(int errorCode, String message) {
+        super(message);
+        throw new RuntimeException();
+    }
+}
```

**File**: `gkd-hidden-api/src/main/java/android/view/SurfaceControlHidden.java` (modified, +8/-4)
```diff
@@ -35,15 +35,19 @@ public static ScreenshotHardwareBuffer captureDisplay(DisplayCaptureArgs capture
         throw new RuntimeException();
     }
 
-    public static class DisplayCaptureArgs {
-        public static class Builder {
+    public abstract static class CaptureArgs {
+        public abstract static class Builder<T extends Builder<T>> {
             @RequiresApi(Build.VERSION_CODES.S)
-            public Builder(IBinder displayToken) {
+            public T setSourceCrop(Rect sourceCrop) {
                 throw new RuntimeException();
             }
+        }
+    }
 
+    public static class DisplayCaptureArgs extends CaptureArgs {
+        public static class Builder extends CaptureArgs.Builder<Builder> {
             @RequiresApi(Build.VERSION_CODES.S)
-            public Builder setSourceCrop(Rect sourceCrop) {
+            public Builder(IBinder displayToken) {
                 throw new RuntimeException();
             }
 
```

---

### Incident Patch 10: `616637f2` (2026-09-24)
**Commit Message**: fix(a11y): trigger subscription update on launcher content changes

**File**: `gkd-app/src/main/kotlin/li/gkd/app/a11y/A11yFeat.kt` (modified, +3/-3)
```diff
@@ -30,9 +30,9 @@ import li.gkd.selector.NodeAdapter
 fun onA11yFeatEvent(event: AccessibilityEvent) = event.run {
     if (event.eventType == STATE_CHANGED) {
         watchCaptureScreenshot()
-        if (event.packageName == launcherAppId) {
-            watchAutoUpdateSubs()
-        }
+    }
+    if (event.packageName == launcherAppId) {
+        watchAutoUpdateSubs()
     }
 }
 
```

---

### Incident Patch 11: `a1603664` (2026-09-23)
**Commit Message**: refactor: unify rule settings and shared UI components

**File**: `.github/workflows/Publish-Selector.yml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ jobs:
         with:
           cache-encryption-key: ${{ secrets.GRADLE_CACHE_ENCRYPTION_KEY }}
 
-      - uses: pnpm/setup@v2
+      - uses: pnpm/setup@v3
 
       - name: Validate release tag
         run: node ./gkd-selector/scripts/validate-release-tag.ts "$GITHUB_REF_NAME"
```

**File**: `AGENTS.md` (modified, +23/-1)
```diff
@@ -2,6 +2,8 @@
 
 - 除 `app_icon`、`service` 等 Android 平台必须使用 XML 的场景外，禁止新增 XML 文件。
 - UI、图标及其他能够使用 Kotlin 表达的实现必须使用 `.kt` 文件，不得为其新增 drawable、layout 等 XML 资源。
+- 新增图标资源时，页面及页面内组件使用的图标必须以 Kotlin `ImageVector` 定义，不得使用 drawable XML。
+- 只有 `AndroidManifest.xml` 等 Android 平台 XML 配置需要引用的图标及其依赖资源，才允许使用 drawable XML；同一图标同时用于平台配置和页面时，页面仍必须使用 Kotlin `ImageVector`。
 - 无法确定是否属于 XML 例外场景时，必须先向用户确认。
 
 ## Git 提交与推送
@@ -23,9 +25,18 @@
 - `XxxExt.kt` 文件只允许放置扩展声明；普通工具函数和共享工具属性必须移入对应的 `XxxUtils.kt` 或职责明确的同名 `object`。
 - Compose 页面、组件及其私有 Composable 不适用上述工具声明规则。
 
+## 通用 UI 组件命名
+
+- 项目自定义、供跨页面或跨文件复用的 UI 组件统一使用 `Gk` 前缀和 PascalCase，命名为 `GkAbc`，包括基础控件和共享业务组件；该规则不受组件所在包限制。
+- 名称必须描述组件用途，不再使用 `Perf`、`Custom` 等泛化前缀；具有实际语义的 `App`、`AppBar`、`Rule`、`Subs` 等词保留，例如 `GkAppIcon`、`GkAppBarTextField`、`GkRuleGroupCard`。
+- 单组件文件与组件同名；同一组件族的重载、私有实现和配套声明允许放在同一文件，文件以 `Gk` 开头并描述该组件族。
+- 组件专属配置类型使用 `GkAbcDefaults`、`GkAbcColors` 等名称；图标组件使用 `GkIcon`，共享图标集合使用 `GkIcons`。
+- 页面、页面私有 Composable、Preview、普通工具函数、Modifier 扩展及独立状态管理类型不强制添加 `Gk`；状态对象的 `Render()` 成员不属于独立组件入口。
+
 ## Compose 与状态边界
 
-- 除悬浮窗 Compose 外，应用 Compose 树中的 Composable 都可以通过 `LocalMainViewModel` 获取 `mainVm`，无需逐层转发导航、全局弹窗、打开 URL 等应用级操作。
+- 主界面的 Composable 和页面 ViewModel 统一通过 `MainViewModel.requireCurrent()` 获取当前 `mainVm`，无需逐层转发导航、全局弹窗、打开 URL 等应用级操作；不再使用 `LocalMainViewModel`。实例由 `MainActivity` 在权限及 Activity Result 宿主绑定后、创建 Compose 界面前注册，ViewModel 清理时按实例身份清除引用。
+- `MainViewModel.requireCurrent()` 仅用于已初始化的主界面调用链，不得用于 Service、后台任务或悬浮窗。一次操作获取一次实例并贯穿整个操作，不得在权限等待前后重新获取，也不得在静态字段中缓存；该方法不得自行创建替代实例。
 - 路由页面及其私有 Composable 可以直接获取页面 ViewModel，并处理权限和 Activity Result 等平台 UI 行为。可复用组件不得获取页面 ViewModel，只接收所需的状态和事件回调。
 - 应用级只读 Flow 由实际消费它的 Composable 直接收集，不要复制进页面 `UiState` 或 ViewModel。普通 Flow 使用 `collectAsStateWithLifecycle`，Paging 使用专用 API，高频状态放在最小消费子树。
 - Service 启停、持久化和其他业务副作用必须由明确事件触发，并交给 ViewModel、Repository 或 Store 完成；Composable 不得通过状态监听执行写入。
@@ -41,9 +52,20 @@
 - 持久化和业务副作用必须由明确的用户事件、系统事件或领域方法触发，并在 Repository/Store 中按业务一致性边界完成。允许将单一权威状态同步到幂等外部投影，但同步回调不得再读取其他状态拼装写入。
 - `debounce`、`conflate`、`collectLatest` 和互斥锁只能控制调度或并发，不能替代多状态源的原子更新；需要一致读取的状态应聚合为同一个不可变状态对象。
 
+## UI 交互与过渡动画
+
+- 可滚动页面必须在内容末尾提供统一的额外底部留白：普通 `Column` 使用 `GkPageBottomSpace()`，`LazyColumn` 使用 `gkPageBottomSpace()` 添加末尾 item；已有末尾 item 包含空状态等内容时，可在该 item 内使用 `GkPageBottomSpace()`，不得重复添加。高度统一由 `GkPageBottomSpaceDefaults` 管理，不再手写页面底部 Spacer 高度。
+- 底部留白必须位于滚动内容内部，让最后一项可以继续向上滚动；它不替代 Scaffold、系统导航栏或 IME inset 处理，也不得在统一组件中重复叠加已由宿主处理的 inset。
+
+- 动画只负责视觉过渡，交互按当前业务或 UI 状态立即响应。禁止因动画未结束、图标变形或旧内容正在退场，给按钮、图标、开关、标题等添加临时禁用态、等待动画完成、延时解锁或额外点击节流；也不得改成在点击回调中吞掉操作。
+- 禁用交互必须对应明确的业务前提，例如没有可操作数据、输入无效或权限不足。普通开关的短暂保存、模式切换或对快速点击的假设，不得成为临时锁定控件、扩大禁用范围的理由；写入一致性在 ViewModel、Repository 或 Store 中处理。
+- 退场重复内容可以从无障碍导航中隐藏，但不得因此改变控件颜色或增加点击等待。相关测试应验证过渡期间的正常点击和状态切换，不得将这类临时禁用作为正确行为固化。
+
 ## 构建与测试
 
 - 常规测试只编译 `gkd` 渠道；若用户没有明确指令，禁止运行任何 `play` 渠道的编译任务。
+- 执行界面测试（包括真机、模拟器上的 Compose UI / Instrumentation 测试）前，必须先记录应用原有的自动化开关与运行模式，临时关闭自动化功能（关闭 `enableAutomator` 并退出自动化模式），确认设置已生效后再初始化测试，防止应用自动化干扰测试初始化。
+- 测试结束后必须恢复并核对原有自动化设置；测试失败或中断时也必须执行恢复，脚本应通过 `finally` 等清理机制保证这一点。恢复时只还原本次临时修改的字段，不得用整份旧配置覆盖其他设置。
 
 ## 测试策略
 
```

**File**: `build.gradle.kts` (modified, +0/-1)
```diff
@@ -42,7 +42,6 @@ object Cfg {
         "-opt-in=kotlinx.serialization.ExperimentalSerializationApi",
         "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
         "-opt-in=androidx.compose.foundation.ExperimentalFoundationApi",
-        "-opt-in=androidx.compose.animation.graphics.ExperimentalAnimationGraphicsApi",
         "-opt-in=androidx.compose.ui.ExperimentalComposeUiApi",
         "-opt-in=androidx.compose.foundation.layout.ExperimentalLayoutApi",
         "-XXLanguage:+MultiDollarInterpolation",
```

**File**: `buildSrc/src/main/kotlin/li/gkd/gradle/GenerateUiStringsTask.kt` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+package li.gkd.gradle
+
+import org.gradle.api.DefaultTask
+import org.gradle.api.file.DirectoryProperty
+import org.gradle.api.file.RegularFileProperty
+import org.gradle.api.tasks.CacheableTask
+import org.gradle.api.tasks.InputFile
+import org.gradle.api.tasks.OutputDirectory
+import org.gradle.api.tasks.PathSensitive
+import org.gradle.api.tasks.PathSensitivity
+import org.gradle.api.tasks.TaskAction
+import org.w3c.dom.Element
+import javax.xml.parsers.DocumentBuilderFactory
+
+/** Single-language accessors keep shared presentation text usable without an Android Context. */
+@CacheableTask
+abstract class GenerateUiStringsTask : DefaultTask() {
+    @get:InputFile
+    @get:PathSensitive(PathSensitivity.RELATIVE)
+    abstract val stringsFile: RegularFileProperty
+
+    @get:OutputDirectory
+    abstract val outputDirectory: DirectoryProperty
+
+    @TaskAction
+    fun generate() {
+        val factory = DocumentBuilderFactory.newInstance().apply {
+            setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
+        }
+        val nodes = factory.newDocumentBuilder().parse(stringsFile.get().asFile)
+            .documentElement.getElementsByTagName("string")
+        val source = buildString {
+            appendLine("// Generated from res/values/strings.xml. Do not edit.")
+            appendLine("package li.gkd.app.text")
+            appendLine()
+            appendLine("object UiStrings {")
+            for (index in 0 until nodes.length) {
+                val node = nodes.item(index) as Element
+                // Platform labels can have build-variant suffixes; read those through R.string.
+                if (node.hasAttribute("debug_suffix")) continue
+                val name = node.getAttribute("name")
+                require(name.matches(Regex("[a-z][a-z0-9_]*"))) { "Invalid string name: $name" }
+                val value = decodeAndroidString(node.textContent)
+                val parameters = if (node.getAttribute("formatted") == "false") emptyList() else
+                    Regex("%(\\d+)\\\$s").findAll(value).map { it.groupValues[1].toInt() }.distinct().sorted().toList()
+                val literal = quoteKotlin(value)
+                if (parameters.isEmpty()) {
+                    appendLine("    const val $name: String = $literal")
+                } else {
+                    require(parameters == (1..parameters.size).toList()) { "Non-contiguous arguments: $name" }
+                    val args = parameters.joinToString { "arg$it: Any?" }
+                    val values = parameters.joinToString { "arg$it" }
+                    appendLine("    fun $name($args): String = String.format(java.util.Locale.ROOT, $literal, $values)")
+                }
+            }
+            appendLine("}")
+        }
+        outputDirectory.file("li/gkd/app/text/UiStrings.kt").get().asFile.apply {
+            parentFile.mkdirs()
+            writeText(source, Charsets.UTF_8)
+        }
+    }
+}
+
+// Resources with significant literal whitespace use Android's quoted form.
+private fun decodeAndroidString(value: String): String {
+    val text = if (value.startsWith('"') && value.endsWith('"')) value.substring(1, value.length - 1) else value
+    return buildString {
+        var index = 0
+        while (index < text.length) {
+            val char = text[index++]
+            if (char != '\\' || index == text.length) {
+                append(char)
+            } else {
+                when (val escaped = text[index++]) {
+                    'n' -> append('\n')
+                    'r' -> append('\r')
+                    't' -> append('\t')
+                    'u' -> {
+                        append(text.substring(index, index + 4).toInt(16).toChar())
+                        index += 4
+                    }
+                    else -> append(escaped)
+                }
+            }
+        }
+    }
+}
+
+private fun quoteKotlin(value: String): String = buildString {
+    append('"')
+    value.forEach { char ->
+        append(when (char) {
+            '\\' -> "\\\\"
+            '"' -> "\\\""
+            '$' -> "\\$"
+            '\n' -> "\\n"
+            '\r' -> "\\r"
+            '\t' -> "\\t"
+            else -> char.toString()
+        })
+    }
+    append('"')
+}
```

**File**: `gkd-app/STRINGS.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# UI 文案
+
+用户可见的标题、按钮、副文案、Toast、通知、无障碍描述和校验提示统一维护在
+`src/main/res/values/strings.xml`。日志、内部诊断、协议字段、URL、动画调试标签和用户输入不属于固定 UI 文案。
+
+资源键按用途命名，例如 `rule_enable_in_app`、`subscription_disabled`，不加 `gk_`；无障碍相关键使用 `a11y`。
+复用已有键前应确认语义相同；显示值相同但用途不同的文案可以分别命名。
+
+目前只支持一套文案，不做运行时语言切换。`generateUiStrings` 从该 XML 生成
+`li.gkd.app.text.UiStrings`，供 Compose、通知、ViewModel 和纯 Kotlin 规则逻辑共同使用，
+无需 Android Context。生成文件位于 `build/generated/source/uiStrings`，不要手动修改。
+
+```xml
+<string name="rule_enable_in_app">在此应用启用</string>
+<string name="app_count">%1$s 个应用</string>
+```
+
+```kotlin
+Text(UiStrings.rule_enable_in_app)
+Text(UiStrings.app_count(apps.size))
+```
+
+无参数文案生成常量；带参数的文案生成函数，参数使用连续编号的 `%1$s`、`%2$s`。
+普通文案无需声明 `translatable` 或 `formatted` 属性。带参数文案中的字面百分号写成 `%%`。
+普通文案不加外层双引号，仅需保留首尾空格、连续空白时使用引号包裹。
+换行写成 `\n`，双引号写成 `\"`，反斜杠写成 `\\`，XML 中的 `&`、`<` 使用实体转义。
+`${i}` 等自定义通知模板变量作为普通文本保留，无需额外属性。
+只有需要将 `%1$s` 等格式符本身作为普通文本显示时，才声明 `formatted="false"`。
+
+带 `debug_suffix` 的平台标签继续通过 `R.string` 获取，以保留构建变体后缀，不生成访问器。
+如果将来增加多语言，应将文案解析切换为 Android 资源机制，不能只新增 `values-xx` 目录。
```

**File**: `gkd-app/build.gradle.kts` (modified, +10/-9)
```diff
@@ -5,6 +5,7 @@ import com.android.build.api.variant.impl.VariantOutputImpl
 import li.gkd.gradle.BuildAssetAdapter
 import li.gkd.gradle.BuildAssetVariant
 import li.gkd.gradle.GenerateSourcePathsTask
+import li.gkd.gradle.GenerateUiStringsTask
 import li.gkd.gradle.buildProperty
 import li.gkd.gradle.configureBuildAssets
 import li.gkd.gradle.gitInfo
@@ -30,7 +31,6 @@ android {
         versionCode = 92
         versionName = "1.12.1"
 
-        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
         vectorDrawables {
             useSupportLibrary = true
         }
@@ -53,7 +53,6 @@ android {
         resValues = true
     }
 
-    sourceSets.getByName("androidTest").assets.srcDir(project(":gkd-db").file("schemas"))
 
     val gkdStoreFile = buildProperty("GKD_STORE_FILE").orNull
     val gkdSigningConfig = if (gkdStoreFile != null) {
@@ -131,6 +130,14 @@ android {
     )
 }
 
+val generateUiStrings = tasks.register<GenerateUiStringsTask>("generateUiStrings") {
+    stringsFile.set(layout.projectDirectory.file("src/main/res/values/strings.xml"))
+    outputDirectory.set(layout.buildDirectory.dir("generated/source/uiStrings"))
+}
+androidComponents.onVariants { variant ->
+    variant.sources.java?.addGeneratedSourceDirectory(generateUiStrings, GenerateUiStringsTask::outputDirectory)
+}
+
 val androidBuildAssetAdapter =
     BuildAssetAdapter<ApplicationAndroidComponentsExtension, ApplicationVariant>(
         onVariants = { components, buildType, action ->
@@ -218,11 +225,9 @@ dependencies {
     implementation(libs.compose.ui)
     implementation(libs.compose.ui.graphics)
     implementation(libs.compose.animation)
-    implementation(libs.compose.animation.graphics)
     implementation(libs.compose.icons)
     implementation(libs.compose.preview)
     debugImplementation(libs.compose.tooling)
-    androidTestImplementation(libs.compose.junit4)
 
     implementation(libs.compose.activity)
     implementation(libs.compose.material3)
@@ -232,12 +237,7 @@ dependencies {
     implementation(libs.androidx.lifecycle.viewmodel.navigation3)
 
     testImplementation(libs.junit)
-    androidTestImplementation(libs.androidx.junit)
-    androidTestImplementation(libs.androidx.espresso)
-    androidTestImplementation(libs.androidx.room.testing)
-    androidTestImplementation(libs.androidx.sqlite.framework)
 
-    // AndroidTest shares this runtime dependency with the app and requires the newer version.
     implementation(libs.androidx.concurrent.futures)
 
     remapApi(project(":gkd-hidden-api"))
@@ -266,6 +266,7 @@ dependencies {
     implementation(libs.kotlinx.atomicfu)
 
     implementation(libs.reorderable)
+    implementation(libs.morph.compose)
 
     implementation(libs.androidx.splashscreen)
 
```

**File**: `gkd-app/src/androidTest/kotlin/li/gkd/app/ConfigurationMigrationTest.kt` (removed, +0/-349)
```diff
@@ -1,349 +0,0 @@
-package li.gkd.app
-
-import android.net.Uri
-import androidx.room3.Room
-import androidx.room3.testing.MigrationTestHelper
-import androidx.room3.withWriteTransaction
-import androidx.sqlite.driver.AndroidSQLiteDriver
-import androidx.sqlite.execSQL
-import androidx.test.ext.junit.runners.AndroidJUnit4
-import androidx.test.platform.app.InstrumentationRegistry
-import kotlinx.coroutines.Dispatchers
-import kotlinx.coroutines.cancelAndJoin
-import kotlinx.coroutines.channels.Channel
-import kotlinx.coroutines.coroutineScope
-import kotlinx.coroutines.flow.first
-import kotlinx.coroutines.launch
-import kotlinx.coroutines.runBlocking
-import kotlinx.coroutines.withTimeout
-import kotlinx.coroutines.yield
-import li.gkd.app.data.RawSubscription
-import li.gkd.app.data.backup.BackupArchiveReader
-import li.gkd.app.data.backup.BackupDatabaseData
-import li.gkd.app.data.backup.BackupFormat
-import li.gkd.app.data.subscription.UsedSubsEntry
-import li.gkd.app.domain.rule.RuleGroupPolicy
-import li.gkd.app.domain.rule.RuleSummaryBuilder
-import li.gkd.db.SubsAppConfig
-import li.gkd.db.AppDb
-import li.gkd.db.ActivityLog
-import li.gkd.db.AppLastVisit
-import li.gkd.db.SubsAppGroupConfig
-import li.gkd.db.SubsCategoryConfig
-import li.gkd.db.SubsGlobalGroupConfig
-import li.gkd.db.Migration14To15
-import li.gkd.db.SubsItem
-import li.gkd.db.SubscriptionConfigSnapshot
-import li.gkd.db.SubscriptionConfigStore
-import org.junit.After
-import org.junit.Assert.assertEquals
-import org.junit.Assert.assertFalse
-import org.junit.Assert.assertTrue
-import org.junit.Test
-import org.junit.runner.RunWith
-import java.io.File
-import java.util.UUID
-import java.util.zip.ZipEntry
-import java.util.zip.ZipOutputStream
-
-@RunWith(AndroidJUnit4::class)
-class ConfigurationMigrationTest {
-    private val instrumentation = InstrumentationRegistry.getInstrumentation()
-    private val context = instrumentation.targetContext
-    private val directory = File(context.cacheDir, "configuration-tests-${UUID.randomUUID()}")
-        .apply { check(mkdirs()) }
-
-    private fun helper(name: String) = MigrationTestHelper(
-        instrumentation = instrumentation,
-        file = File(directory, name),
-        driver = AndroidSQLiteDriver(),
-        databaseClass = AppDb::class,
-    )
-
-    private fun openDatabase(name: String) = Room.databaseBuilder(
-        context,
-        AppDb::class.java,
-        File(directory, name).absolutePath,
-    ).addMigrations(Migration14To15)
-        .setDriver(AndroidSQLiteDriver())
-        .setQueryCoroutineContext(Dispatchers.IO)
-        .build()
-
-    @After
-    fun removeTestFiles() {
-        directory.deleteRecursively()
-    }
-
-    @Test
-    fun allReleasedSchemasMigrateWithTheDeviceSqliteDriver() = runBlocking {
-        for (version in 1 until 16) {
-            val helper = helper("version-$version.db")
-            helper.createDatabase(version).close()
-            helper.runMigrationsAndValidate(16, listOf(Migration14To15)).close()
-        }
-    }
-
-    @Test
-    fun version15RenamingPreservesDataAndSupportsFurtherWrites() = runBlocking {
-        val name = "renaming.db"
-        val helper = helper(name)
-        helper.createDatabase(15).use { connection ->
-            connection.execSQL("INSERT INTO subs_item VALUES (7, 1, 2, 1, 1, 0, NULL)")
-            connection.execSQL("INSERT INTO app_config VALUES (0, 7, 'app.one')")
-            connection.execSQL("INSERT INTO category_config VALUES (NULL, 7, 3)")
-            connection.execSQL("INSERT INTO app_group_config VALUES (7, 'app.one', 4, NULL, 'app-exclude')")
-            connection.execSQL("INSERT INTO global_group_config VALUES (7, 4, 1, 'global-exclude')")
-            connection.execSQL("INSERT INTO activity_log_v2 VALUES (41, 100, 'app.one', 'MainActivity')")
-            connection.execSQL("INSERT INTO app_visit_log VALUES ('app.one', 100), ('app.two', 200)")
-            connection.execSQL("""INSERT INTO a11y_event_log VALUES (5, 300, 32, 'app.one', 'Event', 'description', '["first","second"]')""")
-        }
-        helper.runMigrationsAndValidate(16, listOf(Migration14To15)).use { connection ->
-            connection.prepare("SELECT app_id, desc, text FROM a11y_event_log WHERE id = 5").use {
-                assertTrue(it.step())
-                assertEquals("app.one", it.getText(0))
-                assertEquals("description", it.getText(1))
-                assertEquals("""["first","second"]""", it.getText(2))
-            }
-            connection.prepare("SELECT last_visit_time FROM app_last_visit WHERE app_id = 'app.one'").use {
-                assertTrue(it.step())
-                assertEquals(100L, it.getLong(0))
-            }
-            connection.prepare("SELECT activity_id FROM activity_log WHERE id = 41").use {
-                assertTrue(it.step())
-                assertEquals("MainActivity", it.getText(0))
-            }
-            connection.prepare("PRAGMA 
```

**File**: `gkd-app/src/androidTest/kotlin/li/gkd/app/ExampleInstrumentedTest.kt` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
-package li.gkd.app
-
-import androidx.test.platform.app.InstrumentationRegistry
-import androidx.test.ext.junit.runners.AndroidJUnit4
-
-import org.junit.Test
-import org.junit.runner.RunWith
-
-import org.junit.Assert.*
-
-/**
- * Instrumented test, which will execute on an Android device.
- *
- * See [testing documentation](http://d.android.com/tools/testing).
- */
-@RunWith(AndroidJUnit4::class)
-class ExampleInstrumentedTest {
-    @Test
-    fun useAppContext() {
-        // Context of the app under test.
-        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
-        assertEquals("li.songe.gkd.debug", appContext.packageName)
-    }
-}
```

---

### Incident Patch 12: `613ffe98` (2026-09-02)
**Commit Message**: feat: improve crash report management

**File**: `gkd-app/src/main/kotlin/li/gkd/app/MainViewModel.kt` (modified, +2/-0)
```diff
@@ -18,6 +18,7 @@ import li.gkd.app.a11y.useA11yServiceEnabledFlow
 import li.gkd.app.a11y.useEnabledA11yServicesFlow
 import li.gkd.app.data.CrashData
 import li.gkd.app.data.RawSubscription
+import li.gkd.app.data.trimCrashDataFiles
 import li.gkd.db.Db
 import li.gkd.app.entry.EntryActivity
 import li.gkd.app.entry.OpenFileActivity
@@ -336,6 +337,7 @@ class MainViewModel : BaseViewModel(), OnSimpleLife by DefaultSimpleLifeImpl() {
         }
 
         scope.launchTry(Dispatchers.IO) {
+            trimCrashDataFiles()
             val list = (crashTempFolder.listFiles() ?: emptyArray()).mapNotNull {
                 try {
                     json.decodeFromString<CrashData>(it.readText())
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/data/CrashData.kt` (modified, +46/-0)
```diff
@@ -1,11 +1,14 @@
 package li.gkd.app.data
 
 import kotlinx.serialization.Serializable
+import li.gkd.app.util.LogUtils
 import li.gkd.app.util.crashFolder
 import li.gkd.app.util.crashTempFolder
 import li.gkd.app.util.format
 import li.gkd.app.util.json
 
+private const val MAX_CRASH_RECORD_COUNT = 20
+
 @Serializable
 data class CrashData(
     val id: Long,
@@ -25,6 +28,49 @@ data class CrashData(
         val text = json.encodeToString(this)
         crashFolder.resolve(filename).writeText(text)
         crashTempFolder.resolve(filename).writeText(text)
+        trimCrashDataFiles()
     }
 
+    fun delete(): Boolean = listOf(
+        crashFolder.resolve(filename),
+        crashTempFolder.resolve(filename),
+    ).map { file ->
+        !file.exists() || file.delete()
+    }.all { it }
+}
+
+fun deleteCrashDataList(): Boolean = listOf(
+    crashFolder,
+    crashTempFolder,
+).flatMap { folder ->
+    (folder.listFiles() ?: emptyArray()).filter { it.isFile }
+}.map { file ->
+    !file.exists() || file.delete()
+}.all { it }
+
+fun trimCrashDataFiles() {
+    listOf(crashFolder, crashTempFolder).forEach { folder ->
+        (folder.listFiles() ?: emptyArray())
+            .filter { it.isFile }
+            .sortedByDescending { it.name }
+            .drop(MAX_CRASH_RECORD_COUNT)
+            .forEach { file ->
+                if (!file.delete()) {
+                    LogUtils.d("删除过期崩溃日志失败: ${file.name}")
+                }
+            }
+    }
 }
+
+fun loadCrashDataList(): List<CrashData> =
+    (crashFolder.listFiles() ?: emptyArray())
+        .filter { it.isFile }
+        .mapNotNull { file ->
+            try {
+                json.decodeFromString<CrashData>(file.readText())
+            } catch (e: Exception) {
+                LogUtils.d("解析崩溃日志失败: ${file.name}", e)
+                null
+            }
+        }
+        .sortedByDescending { it.mtime }
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/AdvancedPage.kt` (modified, +5/-0)
```diff
@@ -227,6 +227,11 @@ private fun AdvancedContent() {
                     EventService.setEnabled(mainVm, enabled)
                 },
             )
+            SettingItem(
+                title = "崩溃记录",
+                subtitle = "应用异常退出记录",
+                onClick = { mainVm.navigatePage(CrashReportRoute) },
+            )
             Spacer(modifier = Modifier.height(EmptyHeight))
         }
     }
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/CrashReportPage.kt` (modified, +245/-18)
```diff
@@ -1,37 +1,64 @@
 package li.gkd.app.ui
 
+import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Arrangement
+import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.fillMaxSize
+import androidx.compose.foundation.layout.fillMaxWidth
 import androidx.compose.foundation.layout.height
+import androidx.compose.foundation.layout.heightIn
 import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.size
 import androidx.compose.foundation.layout.width
-import androidx.compose.foundation.verticalScroll
+import androidx.compose.foundation.lazy.LazyColumn
+import androidx.compose.foundation.lazy.items
 import androidx.compose.material3.BottomAppBar
+import androidx.compose.material3.Card
+import androidx.compose.material3.HorizontalDivider
+import androidx.compose.material3.IconButtonDefaults
+import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Scaffold
 import androidx.compose.material3.Text
 import androidx.compose.material3.TextButton
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.remember
+import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.input.nestedscroll.nestedScroll
+import androidx.compose.ui.semantics.onClick
+import androidx.compose.ui.semantics.semantics
+import androidx.compose.ui.semantics.stateDescription
+import androidx.compose.ui.text.style.TextOverflow
 import androidx.compose.ui.unit.dp
+import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.lifecycle.viewmodel.compose.viewModel
 import androidx.navigation3.runtime.NavKey
 import kotlinx.serialization.Serializable
+import li.gkd.app.data.CrashData
 import li.gkd.app.ui.component.CopyTextCard
 import li.gkd.app.ui.component.EmptyText
+import li.gkd.app.ui.component.FixedTimeText
 import li.gkd.app.ui.component.PerfIcon
 import li.gkd.app.ui.component.PerfIconButton
 import li.gkd.app.ui.component.PerfTopAppBar
-import li.gkd.app.ui.component.rememberColumnScrollState
+import li.gkd.app.ui.component.rememberListScrollState
 import li.gkd.app.ui.share.LocalMainViewModel
+import li.gkd.app.ui.share.Loadable
 import li.gkd.app.ui.share.noRippleClickable
 import li.gkd.app.ui.style.EmptyHeight
 import li.gkd.app.ui.style.itemHorizontalPadding
 import li.gkd.app.ui.style.itemVerticalPadding
+import li.gkd.app.ui.style.scaffoldPadding
+import li.gkd.app.ui.style.surfaceCardColors
 import li.gkd.app.util.ISSUES_URL
+import li.gkd.app.util.format
+import li.gkd.app.util.launchTry
 import li.gkd.app.util.throttle
+import li.gkd.app.util.toast
 
 
 @Serializable
@@ -41,9 +68,14 @@ data object CrashReportRoute : NavKey
 fun CrashReportPage() {
     val mainVm = LocalMainViewModel.current
     val vm = viewModel { CrashReportVm(mainVm.takeCrashDataList()) }
-    val pageScrollState = rememberColumnScrollState()
+    val crashDataState by vm.crashDataState.collectAsStateWithLifecycle()
+    val actionScope = vm.scope
+    val crashDataList = crashDataState.value.orEmpty()
+    val pageScrollState = rememberListScrollState()
     val scrollBehavior = pageScrollState.scrollBehavior
-    val scrollState = pageScrollState.scrollState
+    val listState = pageScrollState.listState
+    pageScrollState.ResetOnChange(crashDataList.isNotEmpty())
+    val expandedCrashId = vm.expandedCrashId
     Scaffold(
         modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
         topBar = {
@@ -61,10 +93,30 @@ fun CrashReportPage() {
                         modifier = Modifier.noRippleClickable(onClick = throttle(pageScrollState::resetScroll))
                     )
                 },
+                actions = {
+                    if (crashDataList.isNotEmpty()) {
+                        PerfIconButton(
+                            imageVector = PerfIcon.Delete,
+                            contentDescription = "清空崩溃记录",
+                            onClick = throttle {
+                                actionScope.launchTry {
+                                    if (!mainVm.dialogRequests.confirm(
+                                            title = "清空崩溃记录",
+                                            text = "确定删除全部崩溃记录？",
+                                            error = true,
+                                        )
+                                    ) return@launchTry
+                                    vm.deleteAllCrashes()
+                                    toast("删除成功")
+                                }
+                            },
+                        )
+                    }
+                },
             )
         },
         bottomBar = {
-            if (vm.crashDataList.isNotEmpty()) {
+       
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/CrashReportVm.kt` (modified, +82/-2)
```diff
@@ -1,8 +1,88 @@
 package li.gkd.app.ui
 
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.setValue
+import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.StateFlow
+import kotlinx.coroutines.launch
+import kotlinx.coroutines.withContext
 import li.gkd.app.data.CrashData
+import li.gkd.app.data.deleteCrashDataList
+import li.gkd.app.data.loadCrashDataList
 import li.gkd.app.ui.share.BaseViewModel
+import li.gkd.app.ui.share.Loadable
 
 class CrashReportVm(
-    val crashDataList: List<CrashData>,
-) : BaseViewModel()
+    initialCrashDataList: List<CrashData>,
+) : BaseViewModel() {
+    var expandedCrashId by mutableStateOf(initialCrashDataList.firstOrNull()?.id)
+        private set
+
+    val crashDataState: StateFlow<Loadable<List<CrashData>>>
+        field = MutableStateFlow(
+            if (initialCrashDataList.isEmpty()) {
+                Loadable.Loading
+            } else {
+                Loadable.Ready(initialCrashDataList)
+            },
+        )
+
+    private val initialLoadJob = scope.launch(Dispatchers.IO) {
+        crashDataState.value = try {
+            Loadable.Ready(loadCrashDataList())
+        } catch (e: CancellationException) {
+            throw e
+        } catch (e: Exception) {
+            if (initialCrashDataList.isEmpty()) {
+                Loadable.Failure(e)
+            } else {
+                Loadable.Ready(initialCrashDataList)
+            }
+        }
+    }
+
+    suspend fun deleteCrash(crashData: CrashData) {
+        initialLoadJob.join()
+        val deleted = withContext(Dispatchers.IO) {
+            crashData.delete()
+        }
+        if (deleted) {
+            crashDataState.value = Loadable.Ready(
+                crashDataState.value.value.orEmpty().filterNot { it.id == crashData.id },
+            )
+            if (expandedCrashId == crashData.id) {
+                expandedCrashId = null
+            }
+        } else {
+            reloadAfterDeleteFailure()
+            error("删除崩溃记录失败")
+        }
+    }
+
+    suspend fun deleteAllCrashes() {
+        initialLoadJob.join()
+        val deleted = withContext(Dispatchers.IO) {
+            deleteCrashDataList()
+        }
+        crashDataState.value = Loadable.Ready(
+            withContext(Dispatchers.IO) { loadCrashDataList() },
+        )
+        expandedCrashId = null
+        if (!deleted) {
+            error("部分崩溃记录删除失败")
+        }
+    }
+
+    private suspend fun reloadAfterDeleteFailure() {
+        crashDataState.value = Loadable.Ready(
+            withContext(Dispatchers.IO) { loadCrashDataList() },
+        )
+    }
+
+    fun toggleCrash(crashId: Long) {
+        expandedCrashId = if (expandedCrashId == crashId) null else crashId
+    }
+}
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/component/CopyText.kt` (modified, +6/-3)
```diff
@@ -123,16 +123,19 @@ fun CopyIconOverlay(
 fun CopyTextCard(
     text: String,
     modifier: Modifier = Modifier,
+    containerColor: Color = MaterialTheme.colorScheme.surfaceVariant,
+    contentColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
+    textStyle: TextStyle = MaterialTheme.typography.bodyLarge,
 ) {
     val shape = MaterialTheme.shapes.extraSmall
     CopyableText(
         text = remember(text) { AnnotatedString(text) },
         modifier = modifier
             .fillMaxWidth()
             .clip(shape)
-            .background(MaterialTheme.colorScheme.surfaceVariant),
+            .background(containerColor),
         contentPadding = PaddingValues(8.dp),
-        textStyle = MaterialTheme.typography.bodyLarge,
-        contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
+        textStyle = textStyle,
+        contentColor = contentColor,
     )
 }
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/ui/component/PerfIcon.kt` (modified, +4/-0)
```diff
@@ -15,6 +15,8 @@ import androidx.compose.material.icons.filled.Autorenew
 import androidx.compose.material.icons.filled.Block
 import androidx.compose.material.icons.filled.CenterFocusWeak
 import androidx.compose.material.icons.filled.Close
+import androidx.compose.material.icons.filled.ExpandLess
+import androidx.compose.material.icons.filled.ExpandMore
 import androidx.compose.material.icons.filled.History
 import androidx.compose.material.icons.filled.Memory
 import androidx.compose.material.icons.filled.MoreVert
@@ -199,6 +201,8 @@ object PerfIcon {
     val VerifiedUser get() = Icons.Outlined.VerifiedUser
     val Autorenew get() = Icons.Default.Autorenew
     val UnfoldMore get() = Icons.Default.UnfoldMore
+    val ExpandLess get() = Icons.Default.ExpandLess
+    val ExpandMore get() = Icons.Default.ExpandMore
     val Memory get() = Icons.Default.Memory
     val Notifications get() = Icons.Outlined.Notifications
     val Layers get() = Icons.Outlined.Layers
```

---

### Incident Patch 13: `c174f797` (2026-09-02)
**Commit Message**: build: migrate to kotlin-codeorigin

**File**: `README.md` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ GKD **默认不提供规则**，需自行添加本地规则，或者通过订阅
 开发过程中的衍生项目，它们正在被 gkd 使用，也许对你有帮助
 
 - [kotlin-json5](https://github.com/lisonge/kotlin-json5)
-- [kotlin-loc](https://github.com/lisonge/kotlin-loc)
+- [kotlin-codeorigin](https://github.com/lisonge/kotlin-codeorigin)
 - [android-api-diff](https://github.com/android-cs/android-api-diff)
 - [remap](https://github.com/lisonge/remap)
 - [priv-kit](https://github.com/priv-kit/priv-kit)
```

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ plugins {
     alias(libs.plugins.kotlin.compose) apply false
     alias(libs.plugins.kotlinx.atomicfu) apply false
     alias(libs.plugins.remap) apply false
-    alias(libs.plugins.loc) apply false
+    alias(libs.plugins.codeorigin) apply false
     alias(libs.plugins.littlerobots.version)
 }
 
```

**File**: `gkd-app/build.gradle.kts` (modified, +2/-6)
```diff
@@ -21,7 +21,7 @@ plugins {
     alias(libs.plugins.kotlin.compose)
     alias(libs.plugins.kotlinx.atomicfu)
     alias(libs.plugins.remap)
-    alias(libs.plugins.loc)
+    alias(libs.plugins.codeorigin)
 }
 
 android {
@@ -202,10 +202,6 @@ composeCompiler {
     )
 }
 
-loc {
-    template = "{packageName}.{methodName}({fileName}:{lineNumber})"
-}
-
 dependencies {
     implementation(libs.kotlin.stdlib)
 
@@ -282,7 +278,7 @@ dependencies {
     implementation(libs.device)
 
     implementation(libs.json5)
-    compileOnly(libs.loc.annotation)
+    compileOnly(libs.codeorigin)
 
     // compose-webview declares Material but does not use it.
     implementation(libs.kevinnzouWebview) {
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/MainViewModel.kt` (modified, +3/-3)
```diff
@@ -64,7 +64,7 @@ import li.gkd.app.util.launchTry
 import li.gkd.app.util.openWeChatScaner
 import li.gkd.app.util.runMainPost
 import li.gkd.app.util.toast
-import li.songe.loc.Loc
+import li.songe.codeorigin.CallSite
 import java.nio.file.Files
 import kotlin.reflect.jvm.jvmName
 import kotlin.time.Duration.Companion.days
@@ -109,7 +109,7 @@ class MainViewModel : BaseViewModel(), OnSimpleLife by DefaultSimpleLifeImpl() {
 
     private val backThrottleTimer = ThrottleTimer()
 
-    fun popPage(@Loc loc: String = "") = runMainPost {
+    fun popPage(@CallSite loc: String = "") = runMainPost {
         if (backThrottleTimer.expired() && backStack.size > 1) {
             val old = backStack.last()
             backStack.removeAt(backStack.lastIndex)
@@ -120,7 +120,7 @@ class MainViewModel : BaseViewModel(), OnSimpleLife by DefaultSimpleLifeImpl() {
     fun navigatePage(
         navKey: NavKey,
         replaced: Boolean = false,
-        @Loc loc: String = "",
+        @CallSite loc: String = "",
     ) = runMainPost {
         if (navKey != backStack.last()) {
             val old = backStack.last()
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/a11y/A11yState.kt` (modified, +2/-2)
```diff
@@ -33,7 +33,7 @@ import li.gkd.app.util.RuleSummary
 import li.gkd.app.util.launchTry
 import li.gkd.app.util.ruleSummaryFlow
 import li.gkd.app.util.systemUiAppId
-import li.songe.loc.Loc
+import li.songe.codeorigin.CallSite
 
 data class TopActivity(
     val appId: String = "",
@@ -145,7 +145,7 @@ fun updateTopActivity(
     appId: String,
     activityId: String?,
     scene: ActivityScene = ActivityScene.A11y,
-    @Loc loc: String = "",
+    @CallSite loc: String = "",
 ) {
     val t = System.currentTimeMillis()
     if (scene == ActivityScene.TaskStack) {
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/util/LifecycleCallbacks.kt` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@ import kotlinx.coroutines.cancel
 import kotlinx.coroutines.delay
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.launch
-import li.songe.loc.Loc
+import li.songe.codeorigin.CallSite
 
 typealias CbFn = () -> Unit
 
@@ -26,7 +26,7 @@ interface OnSimpleLife {
     fun onDestroyed(f: CbFn) = cbs<CbFn>(2).add(f)
     fun onDestroyed() = cbs<CbFn>(2).forEach { it() }
 
-    fun useLogLifecycle(@Loc loc: String = "") {
+    fun useLogLifecycle(@CallSite loc: String = "") {
         onCreated { LogUtils.d("onCreated -> " + this::class.simpleName, loc = loc) }
         onDestroyed { LogUtils.d("onDestroyed -> " + this::class.simpleName, loc = loc) }
         if (this is OnA11yLife) {
@@ -52,7 +52,7 @@ interface OnSimpleLife {
     fun useAliveToast(
         name: String,
         delayMillis: Long = 0L,
-        @Loc loc: String = "",
+        @CallSite loc: String = "",
     ) {
         onCreated {
             toast("${name}已启动", loc = loc, delayMillis = delayMillis)
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/util/LogUtils.kt` (modified, +3/-3)
```diff
@@ -8,15 +8,15 @@ import com.hjq.device.compat.DeviceMarketName
 import com.hjq.device.compat.DeviceOs
 import li.gkd.app.META
 import li.gkd.app.app
-import li.songe.loc.Loc
+import li.songe.codeorigin.CallSite
 import java.util.concurrent.Executors
 import kotlin.time.Duration.Companion.days
 
 object LogUtils {
     fun d(
         vararg args: Any?,
-        @Loc loc: String = "",
-        @Loc("{fileName}") fileName: String = "",
+        @CallSite loc: String = "",
+        @CallSite("{file}") fileName: String = "",
         tag: String = fileName.substringBeforeLast('.'),
     ) {
         val name = Thread.currentThread().name
```

**File**: `gkd-app/src/main/kotlin/li/gkd/app/util/Toast.kt` (modified, +2/-2)
```diff
@@ -29,13 +29,13 @@ import li.gkd.app.service.A11yService
 import li.gkd.app.service.OverlayWindowService
 import li.gkd.app.store.actionCountFlow
 import li.gkd.app.store.storeFlow
-import li.songe.loc.Loc
+import li.songe.codeorigin.CallSite
 
 fun toast(
     text: CharSequence,
     forced: Boolean = false,
     delayMillis: Long = 0L,
-    @Loc loc: String = "",
+    @CallSite loc: String = "",
 ) {
     if (delayMillis > 0) {
         runMainPost(delayMillis) {
```

---

### Incident Patch 14: `8c0b1800` (2026-08-30)
**Commit Message**: build: make Gradle wrapper executable

**File**: `.github/workflows/Build-Apk.yml` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ jobs:
       - name: write gkd keystore
         run: echo ${{ secrets.GKD_STORE_FILE_BASE64 }} | base64 --decode > ${{ github.workspace }}/gkd.jks
 
-      - run: chmod 777 ./gradlew
       - run: ./gradlew :gkd-app:assembleGkdRelease
         env:
           GKD_GITHUB_COOKIE: ${{ secrets.GKD_GITHUB_COOKIE }}
```

**File**: `.github/workflows/Build-Release.yml` (modified, +0/-1)
```diff
@@ -28,7 +28,6 @@ jobs:
       - name: write play keystore
         run: echo ${{ secrets.PLAY_STORE_FILE_BASE64 }} | base64 --decode > ${{ github.workspace }}/play.jks
 
-      - run: chmod 777 ./gradlew
       - run: ./gradlew :gkd-app:assembleGkdRelease :gkd-app:bundlePlayRelease
         env:
           GKD_GITHUB_COOKIE: ${{ secrets.GKD_GITHUB_COOKIE }}
```

---

### Incident Patch 15: `841f0579` (2026-08-27)
**Commit Message**: build: apply Kotlin compiler args to all modules

**File**: `build.gradle.kts` (modified, +5/-5)
```diff
@@ -52,17 +52,17 @@ val androidKmpLibraryPluginId =
     libs.plugins.android.kotlin.multiplatform.library.get().pluginId
 
 subprojects {
+    tasks.withType<KotlinCompilationTask<*>>().configureEach {
+        compilerOptions {
+            freeCompilerArgs.addAll(Cfg.kotlinCompilerArgs)
+        }
+    }
     tasks.withType<KotlinJvmCompile>().configureEach {
         compilerOptions {
             jvmTarget.set(Cfg.kotlinTargetVersion)
         }
     }
     plugins.withType<AppPlugin> {
-        tasks.withType<KotlinCompilationTask<*>>().configureEach {
-            compilerOptions {
-                freeCompilerArgs.addAll(Cfg.kotlinCompilerArgs)
-            }
-        }
         extensions.getByType(ApplicationExtension::class.java).apply {
             compileSdk = Cfg.compileSdk
             buildToolsVersion = Cfg.buildToolsVersion
```

#### Recent Merged Pull Requests:
- **PR #1472** (closed): fix: 自动化模式下开机自启状态服务 (@LYYZZ)
- **PR #1470** (closed): fix(a11y): 开机后自愈无障碍服务"假在线"状态 (@LYYZZ)
- **PR #1467** (closed): Add Japanese localization across GKD UI (@okker24)
- **PR #1466** (closed): translation for english (@theclumsypirate)
- **PR #1457** (closed): refactor: remove unused methods and clean up code (@KevinDoremy)
- **PR #1456** (closed): feat: native snapshot inspector with rule generation (GMD port) + bui… (@Azx8788)
- **PR #1451** (closed): feat: support multi-selection on snapshot page (#1392) (@wg2038)
- **PR #1444** (2026-09-24): fix(a11y): 兼容桌面内容变化事件触发订阅自动更新 (@eviaaaaa)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
