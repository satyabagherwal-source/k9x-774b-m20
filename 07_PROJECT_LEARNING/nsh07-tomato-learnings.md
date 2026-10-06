# Forensic Learning Record (Deep Inspection): nsh07/Tomato

> **Canonical Artifact**: `07_PROJECT_LEARNING/nsh07-tomato-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nsh07/Tomato](https://github.com/nsh07/Tomato))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:34:20.485Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nsh07/Tomato`
- **Description**: Minimalist, data-oriented pomodoro timer for Android and Desktop based on Material 3 Expressive
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1482 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/main/java/org/nsh07/pomodoro/service/NotificationUtils.kt`
```
/*
 * Copyright (c) 2025-2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.service

import android.app.PendingIntent
import android.app.PendingIntent.FLAG_IMMUTABLE
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import org.nsh07.pomodoro.R

fun NotificationCompat.Builder.addTimerActions(
    context: Context,
    playPauseText: String
): NotificationCompat.Builder = this
    .addAction(
        R.drawable.play,
        playPauseText,
        PendingIntent.getService(
            context,
            0,
            Intent(context, TimerService::class.java).also {
                it.action = TimerService.Actions.TOGGLE.toString()
            },
            FLAG_IMMUTABLE
        )
    )
    .addAction(
        R.drawable.restart,
        context.getString(R.string.exit),
        PendingIntent.getService(
            context,
            0,
            Intent(context, TimerService::class.java).also {
                it.action = TimerService.Actions.RESET.toString()
            },
            FLAG_IMMUTABLE
        )
    )
    .addAction(
        R.drawable.skip_next,
        context.getString(R.string.skip),
        PendingIntent.getService(
            context,
            0,
            Intent(context, TimerService::class.java).also {
                it.action = TimerService.Actions.SKIP.toString()
            },
            FLAG_IMMUTABLE
        )
    )

fun NotificationCompat.Builder.addStopAlarmAction(
    context: Context
): NotificationCompat.Builder = this
    .addAction(
        R.drawable.alarm,
        context.getString(R.string.stop_alarm),
        PendingIntent.getService(
            context,
            0,
            Intent(context, TimerService::class.java).also {
                it.action = TimerService.Actions.STOP_ALARM.toString()
            },
            FLAG_IMMUTABLE
        )
    )
```

### Core Architecture Module: `shared/src/androidMain/kotlin/org/nsh07/pomodoro/ui/UiUtils.android.kt`
```
/*
 * Copyright (c) 2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.ui

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.RequiresApi
import androidx.compose.foundation.systemGestureExclusion
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.WindowInfo
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.fromHtml
import androidx.compose.ui.unit.Density
import androidx.core.net.toUri
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.compose.resources.stringResource
import org.nsh07.pomodoro.ui.settingsScreen.viewModel.SettingsAction
import org.nsh07.pomodoro.utils.androidSdkVersionAtLeast
import tomato.shared.generated.resources.Res
import tomato.shared.generated.resources.alarm_sound
import tomato.shared.generated.resources.app_name
import tomato.shared.generated.resources.dnd_permission_message

@Composable
actual fun AodSystemBarsHandler(
    density: Density,
    windowInfo: WindowInfo,
    secureAod: Boolean,
    setTimerFrequency: (Float) -> Unit
) {
    val activity = LocalActivity.current
    val view = LocalView.current

    val window = remember { (view.context as Activity).window }
    val insetsController = remember { WindowCompat.getInsetsController(window, view) }

    DisposableEffect(Unit) {
        setTimerFrequency(1f)
        window.addFlags(
            if (secureAod) {
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
            } else WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            activity?.setShowWhenLocked(true)
        }
        insetsController.apply {
            hide(WindowInsetsCompat.Type.statusBars())
            hide(WindowInsetsCompat.Type.navigationBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        onDispose {
            setTimerFrequency(60f)
            window.clearFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                activity?.setShowWhenLocked(false)
            }
            insetsController.apply {
                show(WindowInsetsCompat.Type.statusBars())
                show(WindowInsetsCompat.Type.navigationBars())
                systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
            }
        }
    }
}

@Composable
actual fun rememberRequestDndPermissionCallback(): (Boolean) -> Unit {
    val context = LocalContext.current
    val inspectionMode = LocalInspectionMode.current

    val permissionString =
        stringResource(Res.string.dnd_permission_message, stringResource(Res.string.app_name))

    return remember {
        val notificationManagerService = if (!inspectionMode)
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        else null

        { dndEnabled ->
            if (dndEnabled && notificationManagerService?.isNotificationPolicyAccessGranted() == false) {
                val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)

                Toast
                    .makeText(
                        context,
                        permissionString,
                        Toast.LENGTH_LONG
                    )
                    .show()

                context.startActivity(intent)
            } else if (!dndEnabled && notificationManagerService?.isNotificationPolicyAccessGranted() == true) {
                notificationManagerService.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
            }
        }
    }
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
@Composable
actual fun rememberRequestNotificationPermissionCallback(): () -> Unit {
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = {}
    )
    return { permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }
}

@Composable
actual fun rememberRingtonePickerLauncherCallback(
    alarmSoundFilePath: String?,
    onResult: (SettingsAction) -> Unit
): suspend () -> Unit {
    val alamSoundString = stringResource(Res.string.alarm_sound)

    val ringtonePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val uri =
                if (androidSdkVersionAtLeast(33)) {
                    result.data?.getParcelableExtra(
                        RingtoneManager.EXTRA_RINGTONE_PICKED_URI,
                        Uri::class.java
                    )
                } else {
                    @Suppress("DEPRECATION")
                    result.data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
                }
            onResult(SettingsAction.SaveAlarmSound(uri.toString()))
        }
    }

    val ringtonePickerIntent = remember(alarmSoundFilePath) {
        Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
            putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM)
            putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, alamSoundString)
            putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, alarmSoundFilePath?.toUri())
        }
    }

    return { ringtonePickerLauncher.launch(ringtonePickerIntent) }
}

@Composable
actual fun rememberRingtoneNameProviderCallback(): suspend (String?) -> String {
    val context = LocalContext.current

    return remember {
        { alarmSoundFilePath ->
            withContext(Dispatchers.IO) {
                try {
                    RingtoneManager.getRingtone(context, alarmSoundFilePath?.toUri())
                        ?.getTitle(context) ?: "..."
                } catch (e: Exception) {
                    Log.e("AlarmSettings", "Unable to get ringtone title: ${e.message}")
                    e.printStackTrace()
                    "..."
                }
            }
        }
    }
}

actual fun Modifier.androidSystemGestureExclusion() = this.systemGestureExclusion()

actual fun htmlToAnnotatedString(html: String): AnnotatedString = AnnotatedString.fromHtml(html)
actual fun Modifier.hideCursor(): Modifier {
    // TODO: implement this later
    return this
}
```

### Core Architecture Module: `shared/src/androidMain/kotlin/org/nsh07/pomodoro/utils/Utils.android.kt`
```
/*
 * Copyright (c) 2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.utils

import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.annotation.ChecksSdkIntAtLeast

@ChecksSdkIntAtLeast(parameter = 0)
actual fun androidSdkVersionAtLeast(version: Int): Boolean =
    Build.VERSION.SDK_INT >= version

actual fun getDefaultAlarmTone(): String? =
    (Settings.System.DEFAULT_ALARM_ALERT_URI
        ?: Settings.System.DEFAULT_RINGTONE_URI)?.toString()

actual fun logError(tag: String, message: String): Int =
    Log.e(tag, message)

actual fun androidDeviceManufacturerIs(manufacturer: String): Boolean =
    Build.MANUFACTURER == manufacturer

actual val currentOS: OS = OS.ANDROID
```

### Core Architecture Module: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/data/StateRepository.kt`
```
/*
 * Copyright (c) 2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.data

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.lightColorScheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.nsh07.pomodoro.data.Topic.Companion.defaultTopic
import org.nsh07.pomodoro.service.TimerStateSnapshot
import org.nsh07.pomodoro.ui.settingsScreen.viewModel.SettingsState
import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerMode
import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerState
import org.nsh07.pomodoro.utils.getDefaultAlarmTone
import org.nsh07.pomodoro.utils.millisecondsToStr
import kotlin.concurrent.Volatile

@OptIn(ExperimentalCoroutinesApi::class)
class StateRepository(
    private val preferenceRepository: PreferenceRepository,
    private val topicRepository: TopicRepository
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val timerState = MutableStateFlow(TimerState())
    val settingsState = MutableStateFlow(SettingsState())

    private val _currentTopicId = MutableStateFlow(defaultTopic.id)
    val currentTopicId: StateFlow<Long> = _currentTopicId.asStateFlow()

    private val _currentTopic = MutableStateFlow(defaultTopic)
    val currentTopic: StateFlow<Topic> = _currentTopic.asStateFlow()

    val time = MutableStateFlow(25 * 60 * 1000L)

    /** Tick rate wanted by the screen being shown, while the app is [foreground] */
    @Volatile
    var screenTimerFrequency: Float = 60f

    /** Whether the app is on screen at all */
    @Volatile
    var foreground: Boolean = true

    /** Ticks per second of the timer loop */
    val timerFrequency: Float
        get() = if (foreground) screenTimerFrequency else 1f

    var colorScheme: ColorScheme = lightColorScheme()
    var timerStateSnapshot: TimerStateSnapshot =
        TimerStateSnapshot(time = 0, timerState = TimerState())

    val windowVisible = MutableStateFlow(true) // Used on desktop

    private val _topicLoaded = MutableStateFlow(false)
    val topicLoaded: StateFlow<Boolean> = _topicLoaded.asStateFlow()

    private var isFirstLoad = true

    init {
        scope.launch {
            observeCurrentTopic()
        }
        scope.launch {
            // signalled even if the load fails, so that a restore can never wait forever
            try {
                reloadSettings()
            } finally {
                _topicLoaded.value = true
            }
        }
    }

    private suspend fun observeCurrentTopic() {
        _currentTopicId
            .flatMapLatest { id -> topicRepository.observeTopicById(id).map { id to it } }
            .collect { (id, topic) ->
                if (id != _currentTopicId.value) return@collect // another topic has been selected
                if (topic != null) {
                    publishTopic(topic)
                } else { // the selected topic has been deleted
                    if (id != defaultTopic.id) {
                        _currentTopicId.value = defaultTopic.id
                        preferenceRepository.saveLongPreference(CURRENT_TOPIC_KEY, defaultTopic.id)
                    }
                    publishTopic(defaultTopic)
                }
            }
    }

    suspend fun reloadSettings() {
        val defaults = SettingsState()

        val focusGoal = preferenceRepository.getIntPreference("focus_goal")?.toLong()
            ?: preferenceRepository.saveIntPreference("focus_goal", defaults.focusGoal.toInt())
                .toLong()

        val alarmSoundUri = (
                preferenceRepository.getStringPreference("alarm_sound")
                    ?: preferenceRepository.saveStringPreference(
                        "alarm_sound",
                        getDefaultAlarmTone().toString()
                    )
                )

        val theme = preferenceRepository.getStringPreference("theme")
            ?: preferenceRepository.saveStringPreference("theme", defaults.theme)
        val colorScheme = preferenceRepository.getColorPreference("color_scheme")
            ?: preferenceRepository.saveColorPreference("color_scheme", defaults.colorScheme)
        val blackTheme = preferenceRepository.getBooleanPreference("black_theme")
            ?: preferenceRepository.saveBooleanPreference("black_theme", defaults.blackTheme)
        val aodEnabled = preferenceRepository.getBooleanPreference("aod_enabled")
            ?: preferenceRepository.saveBooleanPreference("aod_enabled", defaults.aodEnabled)
        val alarmEnabled = preferenceRepository.getBooleanPreference("alarm_enabled")
            ?: preferenceRepository.saveBooleanPreference(
                "alarm_enabled",
                defaults.alarmEnabled
            )
        val vibrateEnabled = preferenceRepository.getBooleanPreference("vibrate_enabled")
            ?: preferenceRepository.saveBooleanPreference(
                "vibrate_enabled",
                defaults.vibrateEnabled
            )
        val mediaVolumeForAlarm =
            preferenceRepository.getBooleanPreference("media_volume_for_alarm")
                ?: preferenceRepository.saveBooleanPreference(
                    "media_volume_for_alarm",
                    defaults.mediaVolumeForAlarm
                )
        val singleProgressBar = preferenceRepository.getBooleanPreference("single_progress_bar")
            ?: preferenceRepository.saveBooleanPreference(
                "single_progress_bar",
                defaults.singleProgressBar
            )
        val secureAod = preferenceRepository.getBooleanPreference("secure_aod")
            ?: preferenceRepository.saveBooleanPreference("secure_aod", defaults.secureAod)

        val vibrationOnDuration = (preferenceRepository.getIntPreference("vibration_on_duration")
            ?: preferenceRepository.saveIntPreference(
                "vibration_on_duration",
                defaults.vibrationOnDuration.toInt()
            )).toLong()

        val vibrationOffDuration = (preferenceRepository.getIntPreference("vibration_off_duration")
            ?: preferenceRepository.saveIntPreference(
                "vibration_off_duration",
                defaults.vibrationOffDuration.toInt()
            )).toLong()

        val vibrationAmplitude = preferenceRepository.getIntPreference("vibration_amplitude")
            ?: preferenceRepository.saveIntPreference(
                "vibration_amplitude",
                defaults.vibrationAmplitude
            )

        val customWindowDecor = preferenceRepository.getBooleanPreference("custom_window_decor")
            ?: preferenceRepository.saveBooleanPreference(
                "custom_window_decor",
                defaults.customWindowDecor
            )

        settingsState.update { currentState ->
            currentState.copy(
                focusGoal = focusGoal,
                theme = theme,
                colorScheme = colorScheme,
                alarmSoundUri = alarmSoundUri,
                blackTheme = blackTheme,
                aodEnabled = aodEnabled,
                alarmEnabled = alarmEnabled,
                vibrateEnabled = vibrateEnabled,
                mediaVolumeForAlarm = mediaVolumeForAlarm,
                singleProgressBar = singleProgressBar,
                secureAod = secureAod,
                vibrationOnDuration = vibrationOnDuration,
                vibrationOffDuration = vibrationOffDuration,
                vibrationAmplitude = vibrationAmplitude,
                customWindowDecor = customWindowDecor
            )
        }

        if (isFirstLoad) {
            isFirstLoad = false
            restoreCurrentTopic()
        }
    }

    suspend fun setTopic(topic: Topic) {
        if (_currentTopicId.value == topic.id) return
        _currentTopicId.value = topic.id
        publishTopic(topic)
        preferenceRepository.saveLongPreference(CURRENT_TOPIC_KEY, topic.id)
    }

    private fun publishTopic(topic: Topic) {
        val previous = _currentTopic.value
        _currentTopic.value = topic
        if (topic.id != previous.id || !topic.hasSameIntervals(previous)) refreshTimer(topic)
    }

    private fun refreshTimer(topic: Topic) {
        val currentState = timerState.value
        if (currentState.sessionActive || currentState.infiniteFocus) return

        time.value = topic.focusTime
        timerState.update {
            it.copy(
                timerMode = TimerMode.FOCUS,
                timeStr = millisecondsToStr(topic.focusTime),
                totalTime = topic.focusTime,
                nextTimerMode = if (topic.sessionLength > 1) TimerMode.SHORT_BREAK else TimerMode.LONG_BREAK,
                nextTimeStr = millisecondsToStr(if (topic.sessionLength > 1) topic.shortBreakTime else topic.longBreakTime),
                currentFocusCount = 1,
                totalFocusCount = topic.sessionLength
            )
        }
    }

```

### Core Architecture Module: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/service/TimerStateSnapshot.kt`
```
/*
 * Copyright (c) 2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.service

import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerState

data class TimerStateSnapshot(
    var lastSavedDuration: Long = 0L,
    var time: Long,
    var cycles: Int = 0,
    var startTime: Long = 0L,
    var pauseTime: Long = 0L,
    var pauseDuration: Long = 0L,
    var timerState: TimerState
) {
    fun save(
        lastSavedDuration: Long,
        time: Long,
        cycles: Int,
        startTime: Long,
        pauseTime: Long,
        pauseDuration: Long,
        timerState: TimerState
    ) {
        this.lastSavedDuration = lastSavedDuration
        this.time = time
        this.cycles = cycles
        this.startTime = startTime
        this.pauseTime = pauseTime
        this.pauseDuration = pauseDuration
        this.timerState = timerState
    }
}
```

### Core Architecture Module: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/UiUtils.kt`
```
/*
 * Copyright (c) 2025-2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.material3.adaptive.WindowAdaptiveInfo
import androidx.compose.material3.adaptive.allVerticalHingeBounds
import androidx.compose.material3.adaptive.layout.HingePolicy
import androidx.compose.material3.adaptive.layout.PaneScaffoldDirective
import androidx.compose.material3.adaptive.occludingVerticalHingeBounds
import androidx.compose.material3.adaptive.separatingVerticalHingeBounds
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.WindowInfo
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import org.nsh07.pomodoro.ui.settingsScreen.viewModel.SettingsAction

@Composable
fun mergePaddingValues(
    topSource: PaddingValues,
    restSource: PaddingValues
): PaddingValues {
    val layoutDirection = LocalLayoutDirection.current

    return PaddingValues(
        top = topSource.calculateTopPadding(),
        bottom = restSource.calculateBottomPadding(),
        start = restSource.calculateStartPadding(layoutDirection),
        end = restSource.calculateEndPadding(layoutDirection)
    )
}

/**
 * A [androidx.compose.runtime.DisposableEffect] that makes the app full-screen and exits
 * full-screen when this function exits composition
 */
@Composable
expect fun AodSystemBarsHandler(
    density: Density,
    windowInfo: WindowInfo,
    secureAod: Boolean,
    setTimerFrequency: (Float) -> Unit
)

/**
 * Returns and remembers a lambda that requests the system for the DND permission
 *
 * @return an empty lambda on all platforms except Android, where it returns a lambda that launches
 * a permission settings menu, and shows a Toast that instructs the user to grant the permission.
 */
@Composable
expect fun rememberRequestDndPermissionCallback(): (Boolean) -> Unit

/**
 * Returns and remembers a lambda that requests the system for the notification permission
 *
 * @return a lambda that launches the current platform's corresponding notification permission
 * dialog
 */
@Composable
expect fun rememberRequestNotificationPermissionCallback(): () -> Unit

/**
 * Returns and remembers a lambda that launches the ringtone picker
 *
 * @param alarmSoundFilePath string representation of the existing ringtone's path
 * @param onResult lambda that passes the ringtone picked by the user in an instance of
 * [SettingsAction.SaveAlarmSound]. This should essentially be a [androidx.lifecycle.ViewModel]'s
 * MVI intent handler.
 *
 * @return a lambda that launches the current platform's ringtone/media picker
 */
@Composable
expect fun rememberRingtonePickerLauncherCallback(
    alarmSoundFilePath: String?,
    onResult: (SettingsAction) -> Unit
): suspend () -> Unit

/**
 * Returns and remembers a lambda that returns the name of the current ringtone
 *
 * @return a lambda that accepts the string representation of the existing ringtone's path and
 * returns its name as a [String]
 */
@Composable
expect fun rememberRingtoneNameProviderCallback(): suspend (String?) -> String

/**
 * (copied from [androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirective] with
 * minor modifications, namely the reduction of horizontalPartitionSpacerSize to 0.dp)
 *
 * Calculates the recommended [PaneScaffoldDirective] from a given [WindowAdaptiveInfo]. Use this
 * method with [androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2] to acquire
 * Material-recommended adaptive layout settings of the current activity window.
 *
 * See more details on the [Material design guideline site]
 * (https://m3.material.io/foundations/layout/applying-layout/window-size-classes).
 *
 * @param windowAdaptiveInfo [WindowAdaptiveInfo] that collects useful information in making layout
 *   adaptation decisions like [WindowSizeClass].
 * @param verticalHingePolicy [HingePolicy] that decides how layouts are supposed to address
 *   vertical hinges.
 * @return an [PaneScaffoldDirective] to be used to decide adaptive layout states.
 */
fun calculatePaneScaffoldDirective(
    windowAdaptiveInfo: WindowAdaptiveInfo,
    verticalHingePolicy: HingePolicy = HingePolicy.AvoidSeparating,
): PaneScaffoldDirective {
    val maxHorizontalPartitions: Int
    val horizontalPartitionSpacerSize: Dp
    val defaultPanePreferredWidth: Dp
    when (windowAdaptiveInfo.windowSizeClass.minWidthDp) {
        0 -> {
            maxHorizontalPartitions = 1
            horizontalPartitionSpacerSize = 0.dp
            defaultPanePreferredWidth = 360.dp
        }

        WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND -> {
            maxHorizontalPartitions = 1
            horizontalPartitionSpacerSize = 0.dp
            defaultPanePreferredWidth = 360.dp
        }

        WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND -> {
            maxHorizontalPartitions = 2
            horizontalPartitionSpacerSize = 0.dp
            defaultPanePreferredWidth = 360.dp
        }

        else -> {
            maxHorizontalPartitions = 3
            horizontalPartitionSpacerSize = 0.dp
            defaultPanePreferredWidth = 412.dp
        }
    }
    val maxVerticalPartitions: Int
    val verticalPartitionSpacerSize: Dp

    if (
        windowAdaptiveInfo.windowPosture.isTabletop ||
        (maxHorizontalPartitions == 1 &&
                windowAdaptiveInfo.windowSizeClass.minHeightDp ==
                WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
    ) {
        maxVerticalPartitions = 2
        verticalPartitionSpacerSize = 24.dp
    } else {
        maxVerticalPartitions = 1
        verticalPartitionSpacerSize = 0.dp
    }

    val defaultPanePreferredHeight = 420.dp

    return PaneScaffoldDirective(
        maxHorizontalPartitions = maxHorizontalPartitions,
        horizontalPartitionSpacerSize = horizontalPartitionSpacerSize,
        maxVerticalPartitions = maxVerticalPartitions,
        verticalPartitionSpacerSize = verticalPartitionSpacerSize,
        defaultPanePreferredWidth = defaultPanePreferredWidth,
        defaultPanePreferredHeight = defaultPanePreferredHeight,
        excludedBounds = when (verticalHingePolicy) {
            HingePolicy.AvoidSeparating -> windowAdaptiveInfo.windowPosture.separatingVerticalHingeBounds
            HingePolicy.AvoidOccluding -> windowAdaptiveInfo.windowPosture.occludingVerticalHingeBounds
            HingePolicy.AlwaysAvoid -> windowAdaptiveInfo.windowPosture.allVerticalHingeBounds
            else -> emptyList()
        }
    )
}

expect fun Modifier.androidSystemGestureExclusion(): Modifier

expect fun htmlToAnnotatedString(html: String): AnnotatedString

expect fun Modifier.hideCursor(): Modifier
```

### Core Architecture Module: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/settingsScreen/screens/backupRestore/viewModel/BackupRestoreState.kt`
```
/*
 * Copyright (c) 2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.ui.settingsScreen.screens.backupRestore.viewModel

enum class BackupRestoreState {
    CHOOSE_FILE, LOADING, DONE
}
```

### Core Architecture Module: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/settingsScreen/viewModel/SettingsState.kt`
```
/*
 * Copyright (c) 2025-2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.ui.settingsScreen.viewModel

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import org.nsh07.pomodoro.utils.OS
import org.nsh07.pomodoro.utils.currentOS
import org.nsh07.pomodoro.utils.getDefaultAlarmTone

@Immutable
data class SettingsState(
    val theme: String = "auto",
    val colorScheme: Color = Color.White,
    val blackTheme: Boolean = false,
    val aodEnabled: Boolean = false,
    val alarmEnabled: Boolean = true,
    val vibrateEnabled: Boolean = true,
    val mediaVolumeForAlarm: Boolean = false,
    val singleProgressBar: Boolean = false,
    val secureAod: Boolean = true,
    val isShowingEraseDataDialog: Boolean = false,

    val vibrationOnDuration: Long = 1000L,
    val vibrationOffDuration: Long = 1000L,
    val vibrationAmplitude: Int = -1,
    val focusGoal: Long = 0L,

    val alarmSoundUri: String? = getDefaultAlarmTone(),

    val customWindowDecor: Boolean = currentOS != OS.WINDOWS,
)

```

### Core Architecture Module: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/timerScreen/viewModel/TimerState.kt`
```
/*
 * Copyright (c) 2025-2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.ui.timerScreen.viewModel

import androidx.compose.runtime.Immutable
import org.nsh07.pomodoro.utils.millisecondsToStr

@Immutable
data class TimerState(
    val timerMode: TimerMode = TimerMode.FOCUS,
    val timeStr: String = "25:00",
    val totalTime: Long = 25 * 60 * 1000,
    /** Whether the interval is counting down. Independent of [sessionActive]. */
    val timerRunning: Boolean = false,
    val nextTimerMode: TimerMode = TimerMode.SHORT_BREAK,
    val nextTimeStr: String = "5:00",
    val showBrandTitle: Boolean = true,
    val currentFocusCount: Int = 1,
    val totalFocusCount: Int = 4,
    val alarmRinging: Boolean = false,
    val infiniteFocus: Boolean = false
) {
    /**
     * Whether the timer has been moved off its reset state, which is when the topic must not be
     * switched or edited
     */
    val sessionActive: Boolean
        get() = timerRunning ||
                timerMode != TimerMode.FOCUS ||
                currentFocusCount != 1 ||
                timeStr != millisecondsToStr(if (infiniteFocus) 0 else totalTime)
}

enum class TimerMode {
    FOCUS, SHORT_BREAK, LONG_BREAK, BRAND
}
```

### Core Architecture Module: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/utils/Utils.kt`
```
/*
 * Copyright (c) 2025-2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.utils

import androidx.annotation.ChecksSdkIntAtLeast
import java.util.Locale
import java.util.concurrent.TimeUnit

fun millisecondsToStr(t: Long): String {
    return String.format(
        Locale.getDefault(),
        "%02d:%02d",
        TimeUnit.MILLISECONDS.toMinutes(t),
        TimeUnit.MILLISECONDS.toSeconds(t) % TimeUnit.MINUTES.toSeconds(1)
    )
}

fun millisecondsToHours(t: Long, format: String = "%dh"): String {
    return String.format(
        Locale.getDefault(),
        format,
        TimeUnit.MILLISECONDS.toHours(t)
    )
}

fun millisecondsToMinutes(t: Long, format: String = "%dm"): String {
    return String.format(
        Locale.getDefault(),
        format,
        TimeUnit.MILLISECONDS.toMinutes(t)
    )
}

fun millisecondsToHoursMinutes(t: Long, format: String = $$"%1$dh %2$dm"): String {
    return String.format(
        Locale.getDefault(),
        format,
        TimeUnit.MILLISECONDS.toHours(t),
        TimeUnit.MILLISECONDS.toMinutes(t) % TimeUnit.HOURS.toMinutes(1)
    )
}

fun <T> MutableList<T>.onBack() {
    if (size > 1) removeLastOrNull()
}

fun <T> MutableList<T>.onTopLevelNavigate(screen: T) {
    if (size < 2) add(screen)
    else set(1, screen)
}

/**
 * Checks the system SDK version on Android
 *
 * @param version SDK version code
 * @return false if device is not running Android or SDK version is lower than [version], else true
 */
@ChecksSdkIntAtLeast(parameter = 0)
expect fun androidSdkVersionAtLeast(version: Int): Boolean

expect fun androidDeviceManufacturerIs(manufacturer: String): Boolean

/**
 * Returns the default alarm tone for the device
 *
 * @return string representation of the path (or URI) of the alarm tone, or null if none
 */
expect fun getDefaultAlarmTone(): String?

/**
 * Cross-platform function for using the system-provided logger
 *
 * @param tag tag for the log message. This is often used on Android to mark logs.
 * @param message message to be logged
 */
expect fun logError(tag: String, message: String): Int

enum class OS {
    ANDROID, LINUX, WINDOWS, MACOS
}

expect val currentOS: OS
```

### Core Architecture Module: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/ui/UiUtils.jvm.kt`
```
/*
 * Copyright (c) 2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.platform.WindowInfo
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.Density
import androidx.compose.ui.window.WindowPlacement
import androidx.compose.ui.window.WindowState
import io.github.vinceglb.filekit.FileKit
import io.github.vinceglb.filekit.PlatformFile
import io.github.vinceglb.filekit.dialogs.FileKitType
import io.github.vinceglb.filekit.dialogs.openFilePicker
import io.github.vinceglb.filekit.exists
import io.github.vinceglb.filekit.name
import io.github.vinceglb.filekit.parent
import io.github.vinceglb.filekit.path
import org.koin.compose.koinInject
import org.nsh07.pomodoro.ui.settingsScreen.viewModel.SettingsAction
import java.awt.Point
import java.awt.Toolkit
import java.awt.image.BufferedImage

@Composable
actual fun AodSystemBarsHandler(
    density: Density,
    windowInfo: WindowInfo,
    secureAod: Boolean,
    setTimerFrequency: (Float) -> Unit
) {
    val windowState: WindowState = koinInject()

    DisposableEffect(Unit) {
        setTimerFrequency(30f)
        windowState.placement = WindowPlacement.Fullscreen

        onDispose {
            setTimerFrequency(60f)
            windowState.placement = WindowPlacement.Floating
        }
    }
}

actual fun Modifier.androidSystemGestureExclusion(): Modifier = this

// TODO: use a working implementation
actual fun htmlToAnnotatedString(html: String): AnnotatedString =
    AnnotatedString(html.replace("</?([a-z]+)>".toRegex(), ""))

@Composable
actual fun rememberRequestDndPermissionCallback(): (Boolean) -> Unit = {}

@Composable
actual fun rememberRequestNotificationPermissionCallback(): () -> Unit = {}

/** Paths handed out by the XDG document portal inside a Flatpak or Snap sandbox */
private val documentPortalPathRegex = Regex("""^/run/user/\d+/doc(/|$)""")

/**
 * The directory the alarm sound picker should open in, or `null` to let the picker decide.
 *
 * In a sandbox the previously picked sound lives in the document portal rather than where the user
 * keeps their music, so opening it there would show an opaque directory holding a single file.
 */
private fun alarmSoundPickerDirectory(alarmSoundFilePath: String?): PlatformFile? {
    val parent = alarmSoundFilePath?.let { PlatformFile(it).parent() } ?: return null
    if (documentPortalPathRegex.containsMatchIn(parent.path)) return null
    return parent.takeIf { it.exists() }
}

@Composable
actual fun rememberRingtonePickerLauncherCallback(
    alarmSoundFilePath: String?,
    onResult: (SettingsAction) -> Unit
): suspend () -> Unit = {
    // TODO: copy the file to the data directory and use its path instead, to avoid dependence on a file that the user may delete
    val file = FileKit.openFilePicker(
        type = FileKitType.File("mp3"),
        directory = alarmSoundPickerDirectory(alarmSoundFilePath)
    )
    file?.let { onResult(SettingsAction.SaveAlarmSound(it.path)) }
}

@Composable
actual fun rememberRingtoneNameProviderCallback(): suspend (String?) -> String = { path ->
    path?.let { PlatformFile(it).name } ?: "..."
}

actual fun Modifier.hideCursor(): Modifier {
    return pointerHoverIcon(
        PointerIcon(
            Toolkit.getDefaultToolkit().createCustomCursor(
                BufferedImage(10, 10, BufferedImage.TYPE_INT_ARGB),
                Point(0, 0),
                "Empty Cursor"
            )
        )
    )
}
```

### Core Architecture Module: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/utils/Utils.jvm.kt`
```
/*
 * Copyright (c) 2026 Nishant Mishra
 *
 * This file is part of Tomato - a minimalist pomodoro timer for Android.
 *
 * Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Tomato.
 * If not, see <https://www.gnu.org/licenses/>.
 */

package org.nsh07.pomodoro.utils

import androidx.annotation.ChecksSdkIntAtLeast

@ChecksSdkIntAtLeast(parameter = 0)
actual fun androidSdkVersionAtLeast(version: Int): Boolean = false

actual fun androidDeviceManufacturerIs(manufacturer: String): Boolean = false

actual fun getDefaultAlarmTone(): String? = null

actual fun logError(tag: String, message: String): Int {
    System.err.println("$tag: $message")
    return 0
}

actual val currentOS: OS = run {
    val osName = System.getProperty("os.name").lowercase()
    when {
        osName.contains("win") -> OS.WINDOWS
        osName.contains("mac") -> OS.MACOS
        else -> OS.LINUX
    }
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #314** (2026-09-19): **[BUG] App crashed after click reset timer and Next Session buttons**
  *Symptoms*: **Describe the bug** When the timer starts and I need to press the reset timer button and the next session button Application crashed.   **To Reproduce** Steps to reproduce the behavior:  1. Go to timer and start 2. Click on reset timer or next session 3. See error (app crashed)   **Expected behavior** They should work normally  **Screenshots** https://github.com/user-attachments/assets/9ded3a35-8843-4557-ad15-9ed8ccb9e5ce    **Device (please complete the following information):**  - Device model: [HUAWEI Y6s] - Android version: [Android 9] - App version: [v2.0.0] - Installed from: [Github releases]  **Additional context** I tracked the App to catch logs and Got this  ``` SDK: 28 PRODUCT_NAME: JAT-L29HW DEVICE_NAME: HWJAT-M BOARD_NAME: JAT-L29HW SUPPORTED_ABIS: armeabi-v7a, armeabi MANUFACTURER: HUAWEI BRAND: HUAWEI MODEL: JAT-L29  APP_NAME: Tomato PACKAGE: org.nsh07.pomodoro VERSION_NAME: 2.0.0 VERSION_CODE: 39  1789824377.447 11377 10102 10131 E AndroidRuntime: FATAL EXCEPTION: DefaultDispatcher-worker-8 1789824377.447 11377 10102 10131 E AndroidRuntime: Process: org.nsh07.pomodoro, PID: 10102 1789824377.447 11377 10102 10131 E AndroidRuntime: android.database.sqlite.SQLiteException: near "ON": syntax error (Sqlite code 1 SQLITE_ERROR): , while compiling: INSERT INTO stat (date, topicId, focusTimeQ1, focusTimeQ2, focusTimeQ3, focusTimeQ4, breakTime) 1789824377.447 11377 10102 10131 E AndroidRuntime:         VALUES (?, ?, ?, ?, ?, ?, ?) 1789824377.447 11377 10102 10131 E And
  **Post-Mortem & Fix Analysis**:
  > Can you please upload a video showing how to reproduce this? I cannot seem to be able to reproduce this bug. Thanks!
  > Ok this bug only happens on Android 10 or lower that does not support this newer database syntax. I will fix this and create a new release.
  > > Ok this bug only happens on Android 10 or lower that does not support this newer database syntax. I will fix this and create a new release.  Ok bro Thank you ❤️ 

- **Issue #299** (2026-08-20): **[BUG] Infinity Focus: Extremely long break time**
  *Symptoms*: **Describe the bug** Break duration is recorded as a huge number such as 2562047788015h 12m. Seems to only happen on days that I use infinity focus. Focus-break ratio is shown as 100% break.  **To Reproduce** Steps to reproduce the behavior:  1. Enable infinity Focus 2. Study and take breaks (maybe resetting, skipping, or multiple cycles are required)  **Expected behavior** Break time is recorded correctly  **Screenshots** If applicable, add screenshots to help explain your problem.  <img width="191" alt="Image" src="https://github.com/user-attachments/assets/9efa2d4b-7b60-4c41-9121-83ba885f8d13" /> <img width="191" alt="Image" src="https://github.com/user-attachments/assets/f6c895ff-b796-49b4-966c-96cad02de657" /> <img width="191" alt="Image" src="https://github.com/user-attachments/assets/d7863cbe-100f-40cc-b0a6-1d5c73e84123" />  **Device (please complete the following information):**  - Device model: Fairphone 4 - Android version: Android 15 (latest) - App version: v1.8.5 (latest) - Installed from: F-Droid  **Additional context** A database export is [here](https://drive.google.com/file/d/1XAtkvZ0N9WZ72IuKwCsH-nm-WwGYC9ZR/view?usp=sharing). Screenshots are from 2026-08-12. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! This bug is now fixed in [v2.0.0-alpha02](https://github.com/nsh07/Tomato/releases/tag/v2.0.0-alpha02) .
  > Also, I can fix your broken stats if you want. Create a new backup from Tomato > Settings > Backup and Restore > Backup, and upload the file here. I'll remove the huge break, then upload the fixed backup file here which you can restore.
  > sure, thank you :) maybe you could have the app do this automatically by running some code when it's opened - just an idea.  Github doesnt allow me to upload the file here, so here's a link to gdrive: https://drive.google.com/file/d/1KlJSEiKjjUMBzgH0Xzs_2u6py_YhDZ5v/view?usp=sharing

- **Issue #291** (2026-09-13): **[BUG] No vibration although enabled in settings**
  *Symptoms*: **Describe the bug** The vibration has been enabled. When one pomodoro interval ends, the alarm sound is played, but the device does not vibrate. Moreover, the vibration preview does not work in settings.  **To Reproduce** Steps to reproduce the behavior:  ***For alarm*** 1. In the settings, go to the alarm settings. 2. Enable vibration when a timer finishes. 3. Start a focus session. 4. At the end of the focus session (usually after 25 minutes), the alarm is played, but the device does not vibrate.  ***For vibration preview*** 1. In the settings, go to the alarm settings. 2. Enable vibration when a timer finishes. 3. Press the "play" button for the vibration pattern preview. The device does not vibrate.  **Expected behavior** The device should vibrate when a timer finishes or when the preview is used.  **Device:**  - Device model: OnePlus 6 - Android version: Android 16 (/e/OS 15, 4.1.1) - App version: 1.8.5 - Installed from: F-Droid  I really like this app, especially the OLED option! Keep up the good work! 
  **Post-Mortem & Fix Analysis**:
  > Hi, sorry for the extremely late reply but can you make sure haptics are enabled system-wide for you in Settings > Accessibility > Vibration and haptics (or a similar location in Settings)? Thanks!
  > No problem for the late reply! I have enabled "Vibration for media", and now vibration works! I will see whether this has any side effects e.g. for my Android user experience. If not, I will close this issue.
  > I have found no side effects from enabling "Vibration for media". Hence, I can close this issue, and thank you for helping me find the solution!  Before closing the issue, a question: Should additional information be added to the Tomato Alarm settings that "Vibration for media" has to be enabled?

- **Issue #282** (2026-09-19): **[BUG] <app running in the background problem>**
  *Symptoms*: **Describe the bug** After starting the timer when i visit another app after sometimes ( the time is not fixed eg.30min , 10 min)the timer notification gets blank or the notification disappears. When i go back to the app the timer resets (my spend time wasn't count).  ### I think it is due to the app cannot run in the background properly.   Another thing - on my device battery optimization is off, background run is on .  **To Reproduce** Steps to reproduce the behavior:  1. Sart the timer 2. Use other apps in your device  3.  Suddenly you will see the timer on the notification gets black or the notification disappears. 5. After that if you visit the app spend time wasn't count.  **Expected behavior** The timer should run properly in the background.  The notification shouldn't get blank or disappear and notification timer shouldn't stop unexpectedly. The timer should count all the spent time properly. The timer shouldn't reset unexpectedly.   **Screenshots** If [#applicable,](url) add screenshots to help explain your problem.  **Device (please complete the following information):**  - Device model: Huawei matepad 10.4 - Android version: Android 11 - App version: version 1.8.5 (android) - Installed from: github  **Additional context** The interface of the app is good . This bug is the only thing that stops me to use this app .  ### May be the bug is deu to the  ram management problem of the app . For that it cannot run in the background properly    
  **Post-Mortem & Fix Analysis**:
  > https://dontkillmyapp.com/huawei
  > > https://dontkillmyapp.com/huawei  I have followed all of that long  ago. I know this is a problem with the app . I use other same type  of apps also , they don't have that problem 
  > > > https://dontkillmyapp.com/huawei >  > I have followed all of that long ago. I know this is a problem with the app . I use other same type of apps also , they don't have that problem  Well, I have A16 and I never had this issue, so it could be a compatibility issue with older android versions

- **Issue #278** (2026-08-20): **[BUG] 175h of focus time recorded.**
  *Symptoms*: **Describe the bug** Probably after an update I found 175h of focus time recorded.  **To Reproduce** ??  **Expected behavior** No false focus time! We don't cheat 😄 . Possibly remove the wrong time recorded.  **Screenshots** <img width="591" height="1280" alt="Image" src="https://github.com/user-attachments/assets/78051df4-c8b1-4f43-af1b-a9e5f5058c98" />  **Device (please complete the following information):**  Device model: Mi 9T Pro Android version: Android 13 (LineageOS 20) App version: 1.8.5 Installed from: FDroid  **Additional context** I am not sure but it may have happened after an app update. 
  **Post-Mortem & Fix Analysis**:
  > This is hilarious but I would really like to fix it lol  Can you tell me the steps you took to make this happen? If possible.  For now, you can go into Backup and Restore in Settings, then Backup, and upload the backup file here. I will change the focus duration of that day to whatever you want in the file and I'll upload the fixed backup file so that you can restore it.
  > > This is hilarious but I would really like to fix it lol It was really hahahaha, sadly tho I have no idea on how to reproduce.  I didn't think about editing a backup, I can try that myself today and if not I will share it here. Thanks!
  > To edit the backup, you will have to use an SQLite database editor to change the row for that particular day. Look for the "stat" table.  Here's one I found that works online: https://sqlable.com/sqlite/  Just so you know what is needed to do this, because the backup is an SQLite database file which you cannot edit normally with a text editor.

- **Issue #259** (2026-04-07): **[BUG] Infinite focus mode NowBar acts like normal 25-5 min pomodoro**
  *Symptoms*: **Describe the bug** If infinite focus mode starts, NowBar acts like normal 25-5 min pomodoro in progress bar status. I dont know if its releated with NowBar or not.  **To Reproduce** Steps to reproduce the behavior:  1. Start "infinite focus" mode 2. Enable  NowBar support if not enabled 3. Wait like 5-10 min for progress bar filling some 4. Look at the progress bar 5- (optional) Wait 25+ minutes and see the progress bar fully filled  **Expected behavior** If Infinite Focus mode is enabled, there should be no progress bar in the NowBar  and no "skip" button.  **Screenshots** ![Image](https://github.com/user-attachments/assets/68a7a53b-0fe7-43b3-b44d-7e7d7cd75409) ![Image](https://github.com/user-attachments/assets/7fc1118f-5d7e-4b29-b95d-f1f7d274432f)  **Device** - Device model: Samsung A16F (SM-A165F) - Android version: Android 16 - App version: v1.8.5 (34) - Installed from: Github Releases  **Additional context** None 
  **Post-Mortem & Fix Analysis**:
  > >Expected behavior >If Infinite Focus mode is enabled, there should be no progress bar in the NowBar and no "skip" button  This cannot be achieved, because for a notification to be eligible for being a Live Update notification, the notifications style *must* be `ProgressStyle`. That is, the notification MUST have a progress bar to be considered eligible for promotion to a Live Update notification.  A progress bar in infinite focus mode doesn't make sense as you pointed out, but because I have to show one, I'm showing a dummy progress bar.  About the skip button request: keeping the skip button in the notification is useful if you ever want to start a break when running an infinite focus timer. Do note that infinite focus only changes the duration of focus timers to infinity, but the sequence of the pomodoro technique (several short breaks followed by a long break) is still followed.  I hope you understand.
  > Wouldn’t it be better to use a standard notification with a button that can’t be swiped away instead of a live notification for infinite focus mode? But I think that with the approach I’m suggesting, it would be impossible to display the focus duration in real time.
  > If I use a standard notification, it wouldn't be usable with Now Bar which is the whole point of the notification. You also wouldn't be able to see the timer at a glance because Now Bar/Live Updates don't work with inf focus anymore. I'm sure I'll start getting more bug reports saying "Now Bar doesn't work in Infinite Focus mode" if I do this. I'd love to hear your thoughts on this, and thanks for the feedback!

- **Issue #255** (2026-04-04): **[BUG] Locale Change Bug**
  *Symptoms*: **Describe the bug** When the device system language is set to English, and the user changes the app language to Indonesian via Settings: - The app UI refreshes/recomposes - **But the language does not actually change** - it still shows English text  **To Reproduce** Steps to reproduce the behavior:  1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** 1. User opens Settings → Language 2. User selects "Indonesia" 3. Bottom sheet closes 4. **App UI immediately refreshes with Indonesian text**  **Screenshots** If applicable, add screenshots to help explain your problem.  **Device (please complete the following information):**  - Device model: Realme 5 Pro - Android version: Android 15 - App version: Latest - Installed from: Github Release  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the PR, I'll review and merge it!

- **Issue #242** (2026-03-18): **[BUG] seconds missing a digit with Eastern Arabic numerals**
  *Symptoms*: **Describe the bug**  the seconds doesn't work, only 1 digit is shown  Note: This only happens when System language is Arabic and in Tomato app language is set to System as it will be using Eastern Arabic numerals, instead of https://en.wikipedia.org/wiki/Arabic_numerals (which is the known worldwide numbering system) when setting language to specifically Arabic in-app language settings.  **To Reproduce** Steps to reproduce the behavior:  1. Go to your system setting and set language to Arabic/العربية 2. Go to Tomato app and set language to System/النظام 3. Go to timer page and press play button   **Expected behavior**  the seconds are shown full while it is counting down  **Screenshots**  <img width="369" height="783" alt="Image" src="https://github.com/user-attachments/assets/f897dd09-d87c-4799-aaae-7eb79631a63b" />  there should be a digit shown here in the highlight area, ex: ٢٥:٠٠  **Device (please complete the following information):**  - Device model: [Samsung S22] - Android version: [Android 16/oneUI 8] - App version: [1.8.4] - Installed from: [F-Droid] 
  **Post-Mortem & Fix Analysis**:
  > Fixed in c8ba02a8

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

### Incident Patch 1: `a4797724` (2026-10-02)
**Commit Message**: fix(tray): use built-in Compose-provided tray

**File**: `README.md` (modified, +0/-2)
```diff
@@ -147,8 +147,6 @@ This app was made possible by these awesome libraries:
 
 ### Desktop
 
-- [ComposeNativeTray](https://github.com/kdroidFilter/ComposeNativeTray) - System tray applications
-  with native support for Mac, Linux and Windows
 - [Java Audio Stack](https://github.com/bowbahdoe/java-audio-stack) - Repackaged and modularized
   com.googlecode.soundlibs libraries
 
```

**File**: `desktopApp/build.gradle.kts` (modified, +0/-11)
```diff
@@ -115,14 +115,3 @@ fun getNativePackageVersion(semanticVersion: String, versionCode: String): Strin
 
     return "$major.$minor.$versionCode"
 }
-// See the matching note in shared/build.gradle.kts: skiko is pinned to the last version
-// whose Image.encodeToData() signature composenativetray 1.3.3 was compiled against.
-val skikoVersion = libs.versions.skiko.get()
-
-configurations.configureEach {
-    resolutionStrategy.eachDependency {
-        if (requested.group == "org.jetbrains.skiko") {
-            useVersion(skikoVersion)
-        }
-    }
-}
```

**File**: `gradle/libs.versions.toml` (modified, +0/-3)
```diff
@@ -8,7 +8,6 @@ activityCompose = "1.13.0"
 adaptive = "1.3.0-rc01"
 agp = "9.4.0"
 buildKonfig = "0.22.0"
-composenativetray = "1.3.3"
 coreKtx = "1.19.0"
 espressoCore = "3.7.0"
 filekitCore = "0.16.0"
@@ -28,7 +27,6 @@ sqlite = "2.7.1"
 vico = "3.3.1"
 composeMultiplatform = "1.12.0"
 composeMaterial3 = "1.12.0-alpha03"
-skiko = "0.150.0"
 koinBom = "4.2.2"
 koinCompilerPlugin = "1.2.1"
 
@@ -57,7 +55,6 @@ compose-ui-graphics = { group = "org.jetbrains.compose.ui", name = "ui-graphics"
 androidx-ui-test-junit4 = { group = "org.jetbrains.compose.ui", name = "ui-test-junit4", version.ref = "composeMultiplatform" }
 androidx-ui-tooling = { group = "org.jetbrains.compose.ui", name = "ui-tooling", version.ref = "composeMultiplatform" }
 components-resources = { module = "org.jetbrains.compose.components:components-resources", version.ref = "composeMultiplatform" }
-composenativetray = { module = "io.github.kdroidfilter:composenativetray", version.ref = "composenativetray" }
 filekit-core = { module = "io.github.vinceglb:filekit-core", version.ref = "filekitCore" }
 filekit-dialogs-compose = { module = "io.github.vinceglb:filekit-dialogs-compose", version.ref = "filekitDialogsCompose" }
 jlayer-player = { module = "dev.mccue:jlayer-player", version.ref = "jlayerPlayer" }
```

**File**: `shared/build.gradle.kts` (modified, +0/-15)
```diff
@@ -123,8 +123,6 @@ kotlin {
 
             implementation(libs.filekit.dialogs.compose)
 
-            implementation(libs.composenativetray) // tray icons
-
             implementation(libs.jlayer.player) // MP3 playback
         }
 
@@ -174,16 +172,3 @@ androidComponents {
         variant.sources.res?.addStaticSourceDirectory("src/commonMain/composeResources")
     }
 }
-// Compose Multiplatform 1.12.0-rc01 ships skiko 0.150.1, which changed the binary
-// signature of Image.encodeToData(). composenativetray 1.3.3 was compiled against the
-// previous one and crashes with NoSuchMethodError while rendering the tray icon.
-// Pin skiko to 0.150.0 on the JVM target only, until the library is rebuilt.
-val skikoVersion = libs.versions.skiko.get()
-
-configurations.matching { it.name.startsWith("jvm") }.configureEach {
-    resolutionStrategy.eachDependency {
-        if (requested.group == "org.jetbrains.skiko") {
-            useVersion(skikoVersion)
-        }
-    }
-}
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/AppSystemTray.kt` (modified, +13/-7)
```diff
@@ -23,16 +23,18 @@ import androidx.compose.runtime.derivedStateOf
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
 import androidx.compose.ui.window.ApplicationScope
-import com.kdroid.composetray.tray.api.Tray
+import androidx.compose.ui.window.Tray
 import kotlinx.coroutines.flow.update
+import org.jetbrains.compose.resources.painterResource
 import org.jetbrains.compose.resources.stringResource
-import org.jetbrains.compose.resources.vectorResource
 import org.koin.compose.koinInject
 import org.koin.compose.viewmodel.koinViewModel
 import org.nsh07.pomodoro.data.StateRepository
 import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerAction
 import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerMode
 import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerViewModel
+import org.nsh07.pomodoro.utils.OS
+import org.nsh07.pomodoro.utils.currentOS
 import tomato.shared.generated.resources.Res
 import tomato.shared.generated.resources.app_name
 import tomato.shared.generated.resources.focus
@@ -84,14 +86,18 @@ fun ApplicationScope.AppSystemTray(
     }
     val remainingTimeStr = stringResource(Res.string.min_remaining_notification, remainingTimeS)
 
+    val trayIcon = painterResource(
+        if (currentOS == OS.WINDOWS) Res.drawable.logo
+        else Res.drawable.tomato_logo_notification
+    )
+
     Tray(
-        windowsIcon = Res.drawable.logo,
-        macLinuxIcon = vectorResource(Res.drawable.tomato_logo_notification),
+        icon = trayIcon,
         tooltip = stringResource(Res.string.app_name),
-        primaryAction = { stateRepository.windowVisible.update { true } }
+        onAction = { stateRepository.windowVisible.update { true } }
     ) {
         if (!timerState.alarmRinging) {
-            SubMenu(
+            Menu(
                 "$timerModeStr $middleDot ${
                     if (timerState.timerMode == TimerMode.FOCUS && timerState.infiniteFocus) infiniteString
                     else remainingTimeStr
@@ -108,7 +114,7 @@ fun ApplicationScope.AppSystemTray(
         } else {
             Item(stopAlarmString) { timerViewModel.onAction(TimerAction.StopAlarm) }
         }
-        Divider()
+        Separator()
         Item(openTomato) { stateRepository.windowVisible.update { true } }
         Item(quitTomato, onClick = ::exitApplication)
     }
```

---

### Incident Patch 2: `1615a150` (2026-10-02)
**Commit Message**: fix(alarm): fix IllegalStateExceptions related to alarm state changes

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +31/-7)
```diff
@@ -110,7 +110,12 @@ class TimerService : Service(), KoinComponent {
         runBlocking(Dispatchers.IO) { timerManager.saveTimeToDb() }
         setDoNotDisturb(false)
         notificationManager.cancel(1)
-        alarm?.release()
+        try {
+            alarm?.release()
+        } catch (e: Exception) {
+            Log.e("TimerService", "Error releasing alarm", e)
+        }
+        alarm = null
         super.onDestroy()
     }
 
@@ -374,7 +379,13 @@ class TimerService : Service(), KoinComponent {
 
     fun startAlarm() {
         val settingsState = _settingsState.value
-        if (settingsState.alarmEnabled) alarm?.start()
+        if (settingsState.alarmEnabled) {
+            try {
+                alarm?.start()
+            } catch (e: Exception) {
+                Log.e("TimerService", "Error starting alarm", e)
+            }
+        }
 
         activityCallbacks.activityTurnScreenOn(true)
 
@@ -419,9 +430,13 @@ class TimerService : Service(), KoinComponent {
         autoAlarmStopScope?.cancel()
 
         if (settingsState.alarmEnabled) {
-            alarm?.let {
-                if (it.isPlaying) it.pause()
-                it.seekTo(0)
+            alarm?.let { player ->
+                try {
+                    if (player.isPlaying) player.pause()
+                    player.seekTo(0)
+                } catch (e: Exception) {
+                    Log.e("TimerService", "Error stopping alarm", e)
+                }
             }
         }
 
@@ -460,7 +475,11 @@ class TimerService : Service(), KoinComponent {
         return try {
             MediaPlayer().apply {
                 setOnErrorListener { mp, what, extra ->
-                    mp.reset()
+                    try {
+                        mp.reset()
+                    } catch (e: Exception) {
+                        Log.e("TimerService", "Error resetting MediaPlayer", e)
+                    }
                     Log.e("TimerService", "MediaPlayer error: $what, $extra")
                     true
                 }
@@ -482,6 +501,7 @@ class TimerService : Service(), KoinComponent {
                 }
             }
         } catch (e: Exception) {
+            Log.e("TimerService", "Error initializing MediaPlayer", e)
             e.printStackTrace()
             null
         }
@@ -496,7 +516,11 @@ class TimerService : Service(), KoinComponent {
     }
 
     private fun updateAlarmTone() {
-        alarm?.release()
+        try {
+            alarm?.release()
+        } catch (e: Exception) {
+            Log.e("TimerService", "Error releasing alarm", e)
+        }
         alarm = initializeMediaPlayer()
     }
 
```

---

### Incident Patch 3: `f1cfb5df` (2026-09-19)
**Commit Message**: fix(db): use compatible SQL query on older API levels

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/data/StatDao.kt` (modified, +58/-0)
```diff
@@ -17,11 +17,13 @@
 
 package org.nsh07.pomodoro.data
 
+import androidx.annotation.RequiresApi
 import androidx.room.Dao
 import androidx.room.Insert
 import androidx.room.OnConflictStrategy.Companion.IGNORE
 import androidx.room.OnConflictStrategy.Companion.REPLACE
 import androidx.room.Query
+import androidx.room.Transaction
 import kotlinx.coroutines.flow.Flow
 import java.time.LocalDate
 
@@ -42,6 +44,7 @@ interface StatDao {
     /**
      * Adds the given times to the row for [date] and [topicId], creating it if it does not exist
      */
+    @RequiresApi(30)
     @Query(
         """
         INSERT INTO stat (date, topicId, focusTimeQ1, focusTimeQ2, focusTimeQ3, focusTimeQ4, breakTime)
@@ -64,6 +67,61 @@ interface StatDao {
         breakTime: Long
     )
 
+    /**
+     * Adds the given times to the row for [date] and [topicId], creating it if it does not exist.
+     * Fallback for Android versions prior to API 30 (Android 11) which do not support SQLite UPSERT syntax.
+     */
+    @Transaction
+    suspend fun addStatTimesLegacy(
+        date: LocalDate,
+        topicId: Long,
+        focusTimeQ1: Long,
+        focusTimeQ2: Long,
+        focusTimeQ3: Long,
+        focusTimeQ4: Long,
+        breakTime: Long
+    ) {
+        insertDefaultStatTimes(date, topicId)
+        updateStatTimes(
+            date,
+            topicId,
+            focusTimeQ1,
+            focusTimeQ2,
+            focusTimeQ3,
+            focusTimeQ4,
+            breakTime
+        )
+    }
+
+    @Query(
+        """
+        INSERT OR IGNORE INTO stat (date, topicId, focusTimeQ1, focusTimeQ2, focusTimeQ3, focusTimeQ4, breakTime)
+        VALUES (:date, :topicId, 0, 0, 0, 0, 0)
+        """
+    )
+    suspend fun insertDefaultStatTimes(date: LocalDate, topicId: Long)
+
+    @Query(
+        """
+        UPDATE stat SET
+            focusTimeQ1 = focusTimeQ1 + :focusTimeQ1,
+            focusTimeQ2 = focusTimeQ2 + :focusTimeQ2,
+            focusTimeQ3 = focusTimeQ3 + :focusTimeQ3,
+            focusTimeQ4 = focusTimeQ4 + :focusTimeQ4,
+            breakTime = breakTime + :breakTime
+        WHERE date = :date AND topicId = :topicId
+        """
+    )
+    suspend fun updateStatTimes(
+        date: LocalDate,
+        topicId: Long,
+        focusTimeQ1: Long,
+        focusTimeQ2: Long,
+        focusTimeQ3: Long,
+        focusTimeQ4: Long,
+        breakTime: Long
+    )
+
     @Query(
         """
         SELECT
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/data/StatRepository.kt` (modified, +35/-2)
```diff
@@ -20,6 +20,7 @@ package org.nsh07.pomodoro.data
 import kotlinx.coroutines.CoroutineDispatcher
 import kotlinx.coroutines.flow.Flow
 import kotlinx.coroutines.withContext
+import org.nsh07.pomodoro.utils.androidSdkVersionAtLeast
 import java.time.LocalDate
 import java.time.LocalTime
 
@@ -73,7 +74,7 @@ class AppStatRepository(
                 else -> 4
             }
 
-            statDao.addStatTimes(
+            addStatTimes(
                 date = LocalDate.now(),
                 topicId = topicId,
                 focusTimeQ1 = if (quarter == 1) focusTime else 0,
@@ -86,7 +87,7 @@ class AppStatRepository(
 
     override suspend fun addBreakTime(topicId: Long, breakTime: Long) =
         withContext(ioDispatcher) {
-            statDao.addStatTimes(
+            addStatTimes(
                 date = LocalDate.now(),
                 topicId = topicId,
                 focusTimeQ1 = 0,
@@ -97,6 +98,38 @@ class AppStatRepository(
             )
         }
 
+    private suspend fun addStatTimes(
+        date: LocalDate,
+        topicId: Long,
+        focusTimeQ1: Long,
+        focusTimeQ2: Long,
+        focusTimeQ3: Long,
+        focusTimeQ4: Long,
+        breakTime: Long
+    ) {
+        if (androidSdkVersionAtLeast(30)) {
+            statDao.addStatTimes(
+                date = date,
+                topicId = topicId,
+                focusTimeQ1 = focusTimeQ1,
+                focusTimeQ2 = focusTimeQ2,
+                focusTimeQ3 = focusTimeQ3,
+                focusTimeQ4 = focusTimeQ4,
+                breakTime = breakTime
+            )
+        } else {
+            statDao.addStatTimesLegacy(
+                date = date,
+                topicId = topicId,
+                focusTimeQ1 = focusTimeQ1,
+                focusTimeQ2 = focusTimeQ2,
+                focusTimeQ3 = focusTimeQ3,
+                focusTimeQ4 = focusTimeQ4,
+                breakTime = breakTime
+            )
+        }
+    }
+
     override fun getTodayStat(): Flow<Stat?> {
         val currentDate = LocalDate.now()
         return statDao.getStat(currentDate)
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/utils/Utils.kt` (modified, +2/-0)
```diff
@@ -17,6 +17,7 @@
 
 package org.nsh07.pomodoro.utils
 
+import androidx.annotation.ChecksSdkIntAtLeast
 import java.util.Locale
 import java.util.concurrent.TimeUnit
 
@@ -69,6 +70,7 @@ fun <T> MutableList<T>.onTopLevelNavigate(screen: T) {
  * @param version SDK version code
  * @return false if device is not running Android or SDK version is lower than [version], else true
  */
+@ChecksSdkIntAtLeast(parameter = 0)
 expect fun androidSdkVersionAtLeast(version: Int): Boolean
 
 expect fun androidDeviceManufacturerIs(manufacturer: String): Boolean
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/utils/Utils.jvm.kt` (modified, +3/-0)
```diff
@@ -17,6 +17,9 @@
 
 package org.nsh07.pomodoro.utils
 
+import androidx.annotation.ChecksSdkIntAtLeast
+
+@ChecksSdkIntAtLeast(parameter = 0)
 actual fun androidSdkVersionAtLeast(version: Int): Boolean = false
 
 actual fun androidDeviceManufacturerIs(manufacturer: String): Boolean = false
```

**File**: `shared/src/jvmTest/kotlin/org/nsh07/pomodoro/data/StatDaoTest.kt` (modified, +27/-0)
```diff
@@ -83,6 +83,33 @@ class StatDaoTest : DatabaseTest() {
         )
     }
 
+    @Test
+    fun `adding times legacy creates row when missing and accumulates onto existing row`(): Unit =
+        runBlocking {
+            val work = insertTopic("Work")
+            val date = LocalDate.parse("2026-03-12")
+
+            statDao.addStatTimesLegacy(date, work.id, 1, 2, 3, 4, 5)
+
+            val created = assertNotNull(statFor("2026-03-12", work.id))
+            assertEquals(10L, created.totalFocusTime())
+            assertEquals(5L, created.breakTime)
+
+            statDao.addStatTimesLegacy(date, work.id, 10, 20, 30, 40, 50)
+
+            val summed = assertNotNull(statFor("2026-03-12", work.id))
+            assertContentEquals(
+                listOf(11L, 22L, 33L, 44L, 55L),
+                listOf(
+                    summed.focusTimeQ1,
+                    summed.focusTimeQ2,
+                    summed.focusTimeQ3,
+                    summed.focusTimeQ4,
+                    summed.breakTime
+            )
+        )
+    }
+
     @Test
     fun `adding times keeps each topic's row separate`(): Unit = runBlocking {
         val work = insertTopic("Work")
```

---

### Incident Patch 4: `8d618cdb` (2026-09-19)
**Commit Message**: fix(widget): make history widget preview functional again

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/widget/HistoryAppWidget.kt` (modified, +153/-135)
```diff
@@ -23,6 +23,7 @@ import androidx.compose.material3.MaterialTheme.typography
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.key
 import androidx.compose.runtime.rememberCoroutineScope
+import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.util.fastForEachIndexed
 import androidx.glance.ColorFilter
@@ -54,6 +55,7 @@ import androidx.glance.layout.fillMaxWidth
 import androidx.glance.layout.height
 import androidx.glance.layout.padding
 import androidx.glance.layout.width
+import androidx.glance.material3.ColorProviders
 import androidx.glance.preview.ExperimentalGlancePreviewApi
 import androidx.glance.preview.Preview
 import androidx.glance.text.FontWeight
@@ -65,9 +67,11 @@ import org.nsh07.pomodoro.MainActivity
 import org.nsh07.pomodoro.R
 import org.nsh07.pomodoro.data.Stat
 import org.nsh07.pomodoro.data.StatRepository
+import org.nsh07.pomodoro.ui.theme.lightScheme
 import org.nsh07.pomodoro.utils.millisecondsToHoursMinutes
 import org.nsh07.pomodoro.widget.TomatoWidgetSize.Width4
 import org.nsh07.pomodoro.widget.components.GlanceText
+import java.time.LocalDate
 
 class HistoryAppWidget : GlanceAppWidget(), KoinComponent {
     override val sizeMode: SizeMode = SizeMode.Exact
@@ -199,140 +203,154 @@ class HistoryAppWidget : GlanceAppWidget(), KoinComponent {
     @Preview(widthDp = 400, heightDp = 216)
     @Composable
     private fun ContentPreview() {
-        // TODO: add topic parameter
-//        val history = listOf(
-//            Stat(
-//                date = LocalDate.of(2026, 3, 12),
-//                focusTimeQ1 = 1617943 + 7200000,
-//                focusTimeQ2 = 5704591,
-//                focusTimeQ3 = 556490,
-//                focusTimeQ4 = 1200498,
-//                breakTime = 3939448
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 13),
-//                focusTimeQ1 = 1128282 + 7200000,
-//                focusTimeQ2 = 4590524,
-//                focusTimeQ3 = 7747202,
-//                focusTimeQ4 = 1119272,
-//                breakTime = 311887
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 14),
-//                focusTimeQ1 = 1418079 + 7200000,
-//                focusTimeQ2 = 8141785,
-//                focusTimeQ3 = 5208864,
-//                focusTimeQ4 = 2793210,
-//                breakTime = 2873581
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 15),
-//                focusTimeQ1 = 38960 + 7200000,
-//                focusTimeQ2 = 9544172,
-//                focusTimeQ3 = 2216626,
-//                focusTimeQ4 = 1424242,
-//                breakTime = 4635775
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 16),
-//                focusTimeQ1 = 948108 + 7200000,
-//                focusTimeQ2 = 7715257,
-//                focusTimeQ3 = 648629,
-//                focusTimeQ4 = 319655,
-//                breakTime = 1710029
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 17),
-//                focusTimeQ1 = 1673932 + 7200000,
-//                focusTimeQ2 = 7368028,
-//                focusTimeQ3 = 6028910,
-//                focusTimeQ4 = 2134210,
-//                breakTime = 2811766
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 18),
-//                focusTimeQ1 = 435688 + 7200000,
-//                focusTimeQ2 = 9487983,
-//                focusTimeQ3 = 248276,
-//                focusTimeQ4 = 913853,
-//                breakTime = 162869
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 19),
-//                focusTimeQ1 = 1579291 + 7200000,
-//                focusTimeQ2 = 3743344,
-//                focusTimeQ3 = 3383617,
-//                focusTimeQ4 = 3424645,
-//                breakTime = 3443552
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 20),
-//                focusTimeQ1 = 522247 + 7200000,
-//                focusTimeQ2 = 7156785,
-//                focusTimeQ3 = 5190730,
-//                focusTimeQ4 = 3086522,
-//                breakTime = 3768831
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 21),
-//                focusTimeQ1 = 310048 + 7200000,
-//                focusTimeQ2 = 5901959,
-//                focusTimeQ3 = 441673,
-//                focusTimeQ4 = 3562958,
-//                breakTime = 5470220
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 22),
-//                focusTimeQ1 = 1200000 + 7200000,
-//                focusTimeQ2 = 4000000,
-//                focusTimeQ3 = 3000000,
-//                focusTimeQ4 = 1000000,
-//                breakTime = 2000000
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 23),
-// 
```

---

### Incident Patch 5: `39f3d4b9` (2026-09-18)
**Commit Message**: fix(purchases): add test store key for testing

**File**: `androidApp/build.gradle.kts` (modified, +2/-0)
```diff
@@ -69,9 +69,11 @@ android {
             isMinifyEnabled = true
             isShrinkResources = true
             signingConfig = signingConfigs.getByName("release")
+            buildConfigField("String", "REVENUECAT_API_KEY", "\"goog_jBpRIBjTYvhKYluCqkPXSHbuFbX\"")
         }
         debug {
             applicationIdSuffix = ".debug"
+            buildConfigField("String", "REVENUECAT_API_KEY", "\"test_YwOIjOuWhXcnCqSuqlIzMlstGeW\"")
         }
     }
 
```

**File**: `androidApp/src/play/java/org/nsh07/pomodoro/billing/initializePurchases.kt` (modified, +2/-1)
```diff
@@ -20,11 +20,12 @@ package org.nsh07.pomodoro.billing
 import android.content.Context
 import com.revenuecat.purchases.Purchases
 import com.revenuecat.purchases.PurchasesConfiguration
+import org.nsh07.pomodoro.BuildConfig
 
 fun initializePurchases(context: Context) {
     Purchases.configure(
         PurchasesConfiguration
-            .Builder(context, "goog_jBpRIBjTYvhKYluCqkPXSHbuFbX")
+            .Builder(context, BuildConfig.REVENUECAT_API_KEY)
             .build()
     )
 }
\ No newline at end of file
```

---

### Incident Patch 6: `14619831` (2026-09-17)
**Commit Message**: Revert "build(desktop): use ProGuard optimization & obfuscation"

This reverts commit dee6602d8012bfcff4e6c588f2276a53c5c107ee.

**File**: `desktopApp/build.gradle.kts` (modified, +1/-3)
```diff
@@ -86,10 +86,8 @@ compose.desktop {
         }
 
         buildTypes.release.proguard {
-            isEnabled = true
+            isEnabled = false
             optimize = true
-            obfuscate = true
-            configurationFiles.from(project.file("proguard-rules.pro"))
         }
     }
 }
```

**File**: `desktopApp/proguard-rules.pro` (modified, +0/-46)
```diff
@@ -1,46 +0,0 @@
-# ProGuard rules for the desktop (JVM) target. The Compose Gradle plugin already applies its own
-# defaults (Kotlin, coroutines, Skiko, kotlinx.serialization); these are only project additions.
-
--optimizationpasses 5
--allowaccessmodification
-
-# Readable stack traces; generics and nesting metadata for the reflection-based libraries below
--keepattributes SourceFile,LineNumberTable,Signature,InnerClasses,EnclosingMethod
-
-# Room locates the generated implementation via Class.forName("<database>_Impl")
--keep class * extends androidx.room.RoomDatabase { <init>(); }
-
-# JNI: keep native method names and the classes the native side calls back into
--keepclasseswithmembernames,includedescriptorclasses class * { native <methods>; }
--keep class androidx.sqlite.** { *; }
-
-# JNA (tray, dark mode detection, file dialogs) resolves native symbols, structure fields and
-# callbacks by reflection on their names
--keep class com.sun.jna.** { *; }
--keep,includedescriptorclasses class * extends com.sun.jna.** { *; }
--dontnote com.sun.jna.**
-
-# composenativetray and nucleus call back into their bridge classes from native code by name
-# (e.g. ThemeChangeCallback.onThemeChanged), which the native-method rule above does not cover
--keep,includedescriptorclasses class com.kdroid.composetray.lib.** { *; }
--keep class io.github.kdroidfilter.nucleus.darkmodedetector.** { *; }
-
-# dbus-java (Linux tray) introspects interfaces, annotations and generic signatures at runtime
--keep class org.freedesktop.dbus.** { *; }
--dontnote org.freedesktop.dbus.**
--dontwarn org.slf4j.**
--dontnote org.slf4j.**
-
-# JLayer instantiates its audio device by class name and loads its *.ser tables relative to
-# JavaLayerUtils' package
--keep class dev.mccue.jlayer.player.JavaSoundAudioDevice { <init>(); }
--keepnames class dev.mccue.jlayer.decoder.JavaLayerUtils
-
-# Vico's MutableCartesianMeasuringContext calls MeasuringContext.super methods, which is only legal
-# while MeasuringContext stays a direct superinterface; the shrinker otherwise drops that entry
--keep,allowobfuscation interface com.patrykandpatrick.vico.compose.common.MeasuringContext
-
-# Skiko is pinned below the version these were compiled against (see build.gradle.kts); neither
-# code path is used by the app
--dontwarn androidx.compose.desktop.ui.tooling.preview.runtime.NonInteractivePreviewFacade*
--dontwarn io.github.vinceglb.filekit.dialogs.compose.util.ImageBitmapExt_nonAndroidKt*
```

---

### Incident Patch 7: `41855cab` (2026-09-11)
**Commit Message**: fix(deps): update all non-major dependencies

**File**: `gradle/libs.versions.toml` (modified, +3/-3)
```diff
@@ -16,21 +16,21 @@ filekitDialogsCompose = "0.16.0"
 glance = "1.2.0"
 jlayerPlayer = "2024.04.19"
 junitVersion = "1.3.0"
-kotlin = "2.4.10"
+kotlin = "2.4.20"
 kotlinxCoroutines = "1.11.0"
 ksp = "2.3.12"
 lifecycleRuntime = "2.11.0"
 materialKolor = "5.0.1"
 navigation3 = "1.1.1"
-revenuecat = "10.20.0"
+revenuecat = "10.21.1"
 room = "2.8.5"
 sqlite = "2.7.1"
 vico = "3.3.1"
 composeMultiplatform = "1.12.0"
 composeMaterial3 = "1.12.0-alpha03"
 skiko = "0.150.0"
 koinBom = "4.2.2"
-koinCompilerPlugin = "1.2.0"
+koinCompilerPlugin = "1.2.1"
 
 [libraries]
 androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
```

---

### Incident Patch 8: `6d25cfad` (2026-09-17)
**Commit Message**: fix(alarm): loop alarm sound until dialog is dismissed

Closes #292

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +1/-0)
```diff
@@ -465,6 +465,7 @@ class TimerService : Service(), KoinComponent {
                     true
                 }
 
+                isLooping = true
                 setAudioAttributes(
                     AudioAttributes.Builder()
                         .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/timer/MP3Player.kt` (modified, +9/-6)
```diff
@@ -23,6 +23,7 @@ import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.Job
 import kotlinx.coroutines.SupervisorJob
 import kotlinx.coroutines.cancel
+import kotlinx.coroutines.isActive
 import kotlinx.coroutines.launch
 import java.io.BufferedInputStream
 import java.io.File
@@ -47,19 +48,21 @@ class MP3Player(val audioPath: String?) {
         get() = playJob?.isActive == true
 
     /**
-     * Starts playback. If audio is already playing, it does nothing.
+     * Starts looping playback until [stop] is called. If audio is already playing, it does nothing.
      */
     fun play() {
         if (isPlaying) return
 
         playJob = audioScope.launch {
             try {
                 audioFile?.let {
-                    val fileInputStream = FileInputStream(audioFile)
-                    val bufferedInputStream = BufferedInputStream(fileInputStream)
+                    while (isActive) {
+                        val fileInputStream = FileInputStream(audioFile)
+                        val bufferedInputStream = BufferedInputStream(fileInputStream)
 
-                    player = Player(bufferedInputStream)
-                    player?.play()
+                        player = Player(bufferedInputStream)
+                        player?.play()
+                    }
                 }
             } catch (e: Exception) {
                 println("Playback stopped or encountered an error: ${e.message}")
@@ -74,8 +77,8 @@ class MP3Player(val audioPath: String?) {
      */
     fun stop() {
         if (isPlaying) {
-            player?.close()
             playJob?.cancel()
+            player?.close()
             reset()
         }
     }
```

---

### Incident Patch 9: `dee6602d` (2026-09-17)
**Commit Message**: build(desktop): use ProGuard optimization & obfuscation

**File**: `desktopApp/build.gradle.kts` (modified, +3/-1)
```diff
@@ -86,8 +86,10 @@ compose.desktop {
         }
 
         buildTypes.release.proguard {
-            isEnabled = false
+            isEnabled = true
             optimize = true
+            obfuscate = true
+            configurationFiles.from(project.file("proguard-rules.pro"))
         }
     }
 }
```

**File**: `desktopApp/proguard-rules.pro` (modified, +46/-0)
```diff
@@ -0,0 +1,46 @@
+# ProGuard rules for the desktop (JVM) target. The Compose Gradle plugin already applies its own
+# defaults (Kotlin, coroutines, Skiko, kotlinx.serialization); these are only project additions.
+
+-optimizationpasses 5
+-allowaccessmodification
+
+# Readable stack traces; generics and nesting metadata for the reflection-based libraries below
+-keepattributes SourceFile,LineNumberTable,Signature,InnerClasses,EnclosingMethod
+
+# Room locates the generated implementation via Class.forName("<database>_Impl")
+-keep class * extends androidx.room.RoomDatabase { <init>(); }
+
+# JNI: keep native method names and the classes the native side calls back into
+-keepclasseswithmembernames,includedescriptorclasses class * { native <methods>; }
+-keep class androidx.sqlite.** { *; }
+
+# JNA (tray, dark mode detection, file dialogs) resolves native symbols, structure fields and
+# callbacks by reflection on their names
+-keep class com.sun.jna.** { *; }
+-keep,includedescriptorclasses class * extends com.sun.jna.** { *; }
+-dontnote com.sun.jna.**
+
+# composenativetray and nucleus call back into their bridge classes from native code by name
+# (e.g. ThemeChangeCallback.onThemeChanged), which the native-method rule above does not cover
+-keep,includedescriptorclasses class com.kdroid.composetray.lib.** { *; }
+-keep class io.github.kdroidfilter.nucleus.darkmodedetector.** { *; }
+
+# dbus-java (Linux tray) introspects interfaces, annotations and generic signatures at runtime
+-keep class org.freedesktop.dbus.** { *; }
+-dontnote org.freedesktop.dbus.**
+-dontwarn org.slf4j.**
+-dontnote org.slf4j.**
+
+# JLayer instantiates its audio device by class name and loads its *.ser tables relative to
+# JavaLayerUtils' package
+-keep class dev.mccue.jlayer.player.JavaSoundAudioDevice { <init>(); }
+-keepnames class dev.mccue.jlayer.decoder.JavaLayerUtils
+
+# Vico's MutableCartesianMeasuringContext calls MeasuringContext.super methods, which is only legal
+# while MeasuringContext stays a direct superinterface; the shrinker otherwise drops that entry
+-keep,allowobfuscation interface com.patrykandpatrick.vico.compose.common.MeasuringContext
+
+# Skiko is pinned below the version these were compiled against (see build.gradle.kts); neither
+# code path is used by the app
+-dontwarn androidx.compose.desktop.ui.tooling.preview.runtime.NonInteractivePreviewFacade*
+-dontwarn io.github.vinceglb.filekit.dialogs.compose.util.ImageBitmapExt_nonAndroidKt*
```

---

### Incident Patch 10: `5c26ed10` (2026-09-16)
**Commit Message**: fix(service): run IO operation on IO dispatcher in onDestroy

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +7/-8)
```diff
@@ -106,13 +106,11 @@ class TimerService : Service(), KoinComponent {
     override fun onDestroy() {
         isRunning = false
         updateQSTile()
-        runBlocking {
-            job.cancel()
-            timerManager.saveTimeToDb()
-            setDoNotDisturb(false)
-            notificationManager.cancel(1)
-            alarm?.release()
-        }
+        job.cancel()
+        runBlocking(Dispatchers.IO) { timerManager.saveTimeToDb() }
+        setDoNotDisturb(false)
+        notificationManager.cancel(1)
+        alarm?.release()
         super.onDestroy()
     }
 
@@ -448,8 +446,9 @@ class TimerService : Service(), KoinComponent {
             }, paused = true, complete = false
         )
 
+        // Off the main thread like every other action, since starting writes the session out
         if (currentTopic.autostartNextSession && !fromAutoStop)  // auto start next session
-            toggleTimer()
+            skipScope.launch { toggleTimer() }
 
         CoroutineScope(Dispatchers.IO).launch {
             updateWidget()
```

---

### Incident Patch 11: `1d1d7bd2` (2026-09-16)
**Commit Message**: fix(widget): widget and QS tile consistency fixes

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/TomatoApplication.kt` (modified, +17/-1)
```diff
@@ -20,7 +20,12 @@ package org.nsh07.pomodoro
 import android.app.Application
 import android.app.NotificationChannel
 import android.app.NotificationManager
+import android.content.ComponentName
+import android.service.quicksettings.TileService
 import androidx.core.app.NotificationManagerCompat
+import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.launch
 import org.koin.android.ext.android.get
 import org.koin.android.ext.koin.androidContext
 import org.koin.android.ext.koin.androidLogger
@@ -31,6 +36,7 @@ import org.nsh07.pomodoro.di.androidModule
 import org.nsh07.pomodoro.di.dbModule
 import org.nsh07.pomodoro.di.servicesModule
 import org.nsh07.pomodoro.di.viewModels
+import org.nsh07.pomodoro.qsTile.TomatoQSTileService
 import org.nsh07.pomodoro.service.TimerManager
 
 class TomatoApplication : Application() {
@@ -63,6 +69,16 @@ class TomatoApplication : Application() {
         get<NotificationManagerCompat>().createNotificationChannel(notificationChannel)
 
         // created eagerly so that a stored session is restored however the process was started
-        get<TimerManager>()
+        val timerManager = get<TimerManager>()
+
+        // The tile keeps whatever it last showed, from before a reboot or a kill, until told to
+        // ask again, and asking before the restore has run would only show it a fresh timer
+        CoroutineScope(Dispatchers.Default).launch {
+            timerManager.awaitRestore()
+            TileService.requestListeningState(
+                this@TomatoApplication,
+                ComponentName(this@TomatoApplication, TomatoQSTileService::class.java)
+            )
+        }
     }
 }
```

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +4/-21)
```diff
@@ -20,7 +20,6 @@ package org.nsh07.pomodoro.service
 import android.annotation.SuppressLint
 import android.app.NotificationManager
 import android.app.Service
-import android.appwidget.AppWidgetManager
 import android.content.ComponentName
 import android.content.Intent
 import android.media.AudioAttributes
@@ -36,8 +35,7 @@ import androidx.compose.ui.graphics.toArgb
 import androidx.core.app.NotificationCompat
 import androidx.core.app.NotificationManagerCompat
 import androidx.core.net.toUri
-import androidx.glance.GlanceId
-import androidx.glance.appwidget.GlanceAppWidgetManager
+import androidx.glance.appwidget.updateAll
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.Job
@@ -71,8 +69,6 @@ class TimerService : Service(), KoinComponent {
     private val _settingsState by lazy { stateRepository.settingsState }
 
     private val widget by lazy { TimerAppWidget() }
-    private val widgetManager by lazy { GlanceAppWidgetManager(this) }
-    private var glanceId: GlanceId? = null
 
     private var job = SupervisorJob()
     private val timerScope = CoroutineScope(Dispatchers.IO + job)
@@ -126,16 +122,6 @@ class TimerService : Service(), KoinComponent {
             return START_NOT_STICKY
         }
 
-        if (glanceId == null) {
-            val widgetId = intent.getIntExtra(
-                AppWidgetManager.EXTRA_APPWIDGET_ID,
-                AppWidgetManager.INVALID_APPWIDGET_ID
-            )
-
-            glanceId = if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) null
-            else widgetManager.getGlanceIdBy(widgetId)
-        }
-
         val action = intent.action
         // Noted before promoting, to tell a service that was already showing something apart from
         // one that exists only to carry this action
@@ -342,13 +328,10 @@ class TimerService : Service(), KoinComponent {
     }
 
     /**
-     * Updates the most recently interacted [TimerAppWidget] widget to make it show the correct time
-     * as long as the timer runs
+     * Updates all instance of [TimerAppWidget] widget to make them show the correct time as long as
+     * the timer runs
      */
-    private suspend fun updateWidget() =
-        glanceId?.let {
-            widget.update(this@TimerService, it)
-        }
+    private suspend fun updateWidget() = widget.updateAll(this)
 
     private fun updateProgressSegments() {
         val settingsState = _settingsState.value
```

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/widget/StartServiceAction.kt` (modified, +0/-4)
```diff
@@ -17,13 +17,11 @@
 
 package org.nsh07.pomodoro.widget
 
-import android.appwidget.AppWidgetManager
 import android.content.Context
 import android.content.Intent
 import android.util.Log
 import androidx.glance.GlanceId
 import androidx.glance.action.ActionParameters
-import androidx.glance.appwidget.GlanceAppWidgetManager
 import androidx.glance.appwidget.action.ActionCallback
 import org.nsh07.pomodoro.service.TimerService
 
@@ -34,11 +32,9 @@ class StartServiceAction : ActionCallback {
         parameters: ActionParameters
     ) {
         val timerAction = parameters[key] as TimerService.Actions
-        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(glanceId)
 
         val serviceIntent = Intent(context, TimerService::class.java).apply {
             action = timerAction.toString()
-            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
         }
 
         try {
```

---

### Incident Patch 12: `23461728` (2026-09-16)
**Commit Message**: fix(timer): derive timer frequency based on foreground status

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/MainActivity.kt` (modified, +3/-5)
```diff
@@ -84,7 +84,7 @@ class MainActivity : ComponentActivity() {
                 AppScreen(
                     isAODEnabled = settingsState.aodEnabled,
                     setTimerFrequency = {
-                        stateRepository.timerFrequency = it
+                        stateRepository.screenTimerFrequency = it
                     }
                 )
             }
@@ -94,14 +94,12 @@ class MainActivity : ComponentActivity() {
 
     override fun onStop() {
         super.onStop()
-        // Reduce the timer loop frequency when not visible to save battery
-        stateRepository.timerFrequency = 1f
+        stateRepository.foreground = false
     }
 
     override fun onStart() {
         super.onStart()
-        // Increase the timer loop frequency again when visible to make the progress smoother
-        stateRepository.timerFrequency = 60f
+        stateRepository.foreground = true
         resumeStoredTimer()
     }
 
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/data/StateRepository.kt` (modified, +14/-1)
```diff
@@ -37,6 +37,7 @@ import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerMode
 import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerState
 import org.nsh07.pomodoro.utils.getDefaultAlarmTone
 import org.nsh07.pomodoro.utils.millisecondsToStr
+import kotlin.concurrent.Volatile
 
 @OptIn(ExperimentalCoroutinesApi::class)
 class StateRepository(
@@ -55,7 +56,19 @@ class StateRepository(
     val currentTopic: StateFlow<Topic> = _currentTopic.asStateFlow()
 
     val time = MutableStateFlow(25 * 60 * 1000L)
-    var timerFrequency: Float = 60f
+
+    /** Tick rate wanted by the screen being shown, while the app is [foreground] */
+    @Volatile
+    var screenTimerFrequency: Float = 60f
+
+    /** Whether the app is on screen at all */
+    @Volatile
+    var foreground: Boolean = true
+
+    /** Ticks per second of the timer loop */
+    val timerFrequency: Float
+        get() = if (foreground) screenTimerFrequency else 1f
+
     var colorScheme: ColorScheme = lightColorScheme()
     var timerStateSnapshot: TimerStateSnapshot =
         TimerStateSnapshot(time = 0, timerState = TimerState())
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/AppWindow.kt` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ fun ApplicationScope.AppWindow(
                             AppScreen(
                                 isAODEnabled = settingsState.aodEnabled,
                                 setTimerFrequency = {
-                                    stateRepository.timerFrequency = it
+                                    stateRepository.screenTimerFrequency = it
                                 }
                             )
 
```

**File**: `shared/src/jvmTest/kotlin/org/nsh07/pomodoro/data/StateRepositoryTest.kt` (modified, +13/-0)
```diff
@@ -153,6 +153,19 @@ class StateRepositoryTest {
         assertEquals(work.focusTime, stateRepository.timerState.value.totalTime)
     }
 
+    @Test
+    fun `the timer only ticks at the screen's rate while the app is in the foreground`() {
+        val stateRepository = stateRepository()
+
+        stateRepository.screenTimerFrequency = 1f // the AOD is shown
+        stateRepository.foreground = false
+        stateRepository.screenTimerFrequency = 60f // the AOD leaves the screen
+        assertEquals(1f, stateRepository.timerFrequency)
+
+        stateRepository.foreground = true
+        assertEquals(60f, stateRepository.timerFrequency)
+    }
+
     @Test
     fun `deleting the selected topic selects the default topic`() = runBlocking {
         val preferenceRepository = preferenceRepository(work.id)
```

---

### Incident Patch 13: `bfcfe416` (2026-09-16)
**Commit Message**: fix(timer): pause timer in the reset function instead of separately

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +0/-1)
```diff
@@ -154,7 +154,6 @@ class TimerService : Service(), KoinComponent {
 
             Actions.RESET.toString() -> skipScope.launch {
                 timerManager.awaitRestore()
-                if (_timerState.value.timerRunning) toggleTimer()
                 timerManager.resetTimer(::updateProgressSegments)
                 stopForegroundService()
             }
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/service/TimerManager.kt` (modified, +9/-0)
```diff
@@ -483,9 +483,18 @@ class TimerManager(
         }
     }
 
+    /**
+     * Stops the timer and puts it back at the start of the first focus interval.
+     */
     suspend fun resetTimer(onCompletion: () -> Unit) {
         val currentTopic = stateRepository.currentTopic.value
 
+        timerJob?.cancel()
+        if (_timerState.value.timerRunning) {
+            pauseTime = currentTime()
+            _timerState.update { it.copy(timerRunning = false) }
+        }
+
         saveLock.withLock {
             saveElapsedTime()
             // Snapshotted after flushing, so that an undo cannot save the same time twice
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/timer/DesktopTimerHelper.kt` (modified, +2/-5)
```diff
@@ -47,11 +47,8 @@ class DesktopTimerHelper(
 
     override fun onAction(action: TimerAction) {
         when (action) {
-            TimerAction.ResetTimer -> {
-                if (_timerState.value.timerRunning) toggleTimer()
-                skipScope.launch {
-                    timerManager.resetTimer {}
-                }
+            TimerAction.ResetTimer -> skipScope.launch {
+                timerManager.resetTimer {}
             }
 
             is TimerAction.SkipTimer -> skipScope.launch {
```

**File**: `shared/src/jvmTest/kotlin/org/nsh07/pomodoro/service/TimerManagerTest.kt` (modified, +38/-0)
```diff
@@ -433,6 +433,44 @@ class TimerManagerTest {
         assertEquals(15 * MINUTE, statRepository.focusTime)
     }
 
+    @Test
+    fun `resetting a running timer stops it`() = runBlocking {
+        timerManager.toggle()
+        clock += 10 * MINUTE
+
+        timerManager.resetTimer {}
+
+        val timerState = stateRepository.timerState.value
+        assertFalse(timerState.timerRunning)
+        assertEquals(TimerMode.FOCUS, timerState.timerMode)
+        assertEquals(topic.focusTime, stateRepository.time.value)
+        assertNull(scheduledExpiry)
+        assertEquals(10 * MINUTE, statRepository.focusTime)
+
+        // The time before the reset was kept, and the time after it was not
+        clock += 5 * MINUTE
+        timerManager.undoReset()
+        timerManager.toggle() // resume
+        clock += 5 * MINUTE
+        timerManager.saveTimeToDb()
+        assertEquals(15 * MINUTE, statRepository.focusTime)
+    }
+
+    /** Regression test: pausing a frozen session takes it over, so the reset must not rely on it */
+    @Test
+    fun `resetting a session left without a loop stops it`() = runBlocking {
+        val serviceScope = CoroutineScope(NeverDispatcher)
+        timerManager.toggle(serviceScope)
+        clock += 10 * MINUTE
+        serviceScope.cancel() // the service is destroyed, taking the timer loop with it
+
+        timerManager.resetTimer {}
+
+        assertFalse(stateRepository.timerState.value.timerRunning)
+        assertNull(scheduledExpiry)
+        assertEquals(topic.focusTime, stateRepository.time.value)
+    }
+
     @Test
     fun `a running session is still paused by the button while its loop is alive`() = runBlocking {
         timerManager.toggle()
```

---

### Incident Patch 14: `56914bd6` (2026-09-16)
**Commit Message**: fix(timer): make serviceRunning a custom getter val for consistency

Also rename it to sessionActive to better represent its purpose

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/MainActivity.kt` (modified, +1/-2)
```diff
@@ -109,8 +109,7 @@ class MainActivity : ComponentActivity() {
     private fun resumeStoredTimer() = lifecycleScope.launch {
         timerManager.awaitRestore()
 
-        val timerState = stateRepository.timerState.value
-        if (!timerState.timerRunning || timerState.serviceRunning) return@launch
+        if (!stateRepository.timerState.value.timerRunning || TimerService.isRunning) return@launch
 
         try {
             startService(
```

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +8/-2)
```diff
@@ -103,12 +103,12 @@ class TimerService : Service(), KoinComponent {
     override fun onCreate() {
         super.onCreate()
         updateProgressSegments()
-        stateRepository.timerState.update { it.copy(serviceRunning = true) }
+        isRunning = true
         alarm = initializeMediaPlayer()
     }
 
     override fun onDestroy() {
-        stateRepository.timerState.update { it.copy(serviceRunning = false) }
+        isRunning = false
         updateQSTile()
         runBlocking {
             job.cancel()
@@ -543,4 +543,10 @@ class TimerService : Service(), KoinComponent {
     enum class Actions {
         TOGGLE, SKIP, RESET, UNDO_RESET, EXPIRE, RESUME, STOP_ALARM, UPDATE_ALARM_TONE
     }
+
+    companion object {
+        /** Whether a service is up to tick the timer */
+        var isRunning = false
+            private set
+    }
 }
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/data/StateRepository.kt` (modified, +1/-1)
```diff
@@ -210,7 +210,7 @@ class StateRepository(
 
     private fun refreshTimer(topic: Topic) {
         val currentState = timerState.value
-        if (currentState.serviceRunning || currentState.infiniteFocus) return
+        if (currentState.sessionActive || currentState.infiniteFocus) return
 
         time.value = topic.focusTime
         timerState.update {
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/settingsScreen/SettingsScreen.kt` (modified, +3/-3)
```diff
@@ -76,7 +76,7 @@ fun SettingsScreenRoot(
 
     val minuteInputs = viewModel.minuteInputs
 
-    val serviceRunning by viewModel.serviceRunning.collectAsStateWithLifecycle()
+    val sessionActive by viewModel.sessionActive.collectAsStateWithLifecycle()
     val currentTopicId by viewModel.currentTopicId.collectAsStateWithLifecycle()
 
     val settingsState by viewModel.settingsState.collectAsStateWithLifecycle()
@@ -169,7 +169,7 @@ fun SettingsScreenRoot(
                 val editingTopic by viewModel.editingTopic.collectAsStateWithLifecycle()
 
                 TimerSettings(
-                    serviceRunning = serviceRunning,
+                    sessionActive = sessionActive,
                     currentTopicId = currentTopicId,
                     settingsState = settingsState,
                     contentPadding = contentPadding,
@@ -192,7 +192,7 @@ fun SettingsScreenRoot(
                 TopicsSettings(
                     topics = topics,
                     editingTopic = editingTopic,
-                    serviceRunning = serviceRunning,
+                    sessionActive = sessionActive,
                     currentTopicId = currentTopicId,
                     minuteInputs = minuteInputs,
                     sessionsSliderState = sessionsSliderState,
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/settingsScreen/screens/TimerSettings.kt` (modified, +5/-5)
```diff
@@ -132,7 +132,7 @@ import tomato.shared.generated.resources.view_day
 @OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterial3ExpressiveApi::class)
 @Composable
 fun TimerSettings(
-    serviceRunning: Boolean,
+    sessionActive: Boolean,
     currentTopicId: Long,
     settingsState: SettingsState,
     contentPadding: PaddingValues,
@@ -151,7 +151,7 @@ fun TimerSettings(
 
     SeededTheme(editingTopic.color) {
         val colorScheme = colorScheme
-        val topicRunning = serviceRunning && editingTopic.id == currentTopicId
+        val topicRunning = sessionActive && editingTopic.id == currentTopicId
 
         val widthExpanded = currentWindowAdaptiveInfoV2()
             .windowSizeClass
@@ -161,7 +161,7 @@ fun TimerSettings(
             settingsState.aodEnabled,
             settingsState.secureAod,
             isPlus,
-            serviceRunning
+            sessionActive
         ) {
             listOf(
                 SettingsSwitchItem(
@@ -397,7 +397,7 @@ fun TimerSettings(
                                 trailingContent = {
                                     Switch(
                                         checked = settingsState.singleProgressBar,
-                                        enabled = !serviceRunning,
+                                        enabled = !sessionActive,
                                         onCheckedChange = {
                                             haptic.performToggle(it)
                                             onAction(
@@ -540,7 +540,7 @@ private fun TimerSettingsPreview() {
     TomatoTheme(dynamicColor = false) {
         Surface(Modifier.fillMaxSize()) {
             TimerSettings(
-                serviceRunning = false,
+                sessionActive = false,
                 currentTopicId = defaultTopic.id,
                 settingsState = remember { SettingsState() },
                 contentPadding = PaddingValues(),
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/settingsScreen/screens/TopicsSettings.kt` (modified, +4/-4)
```diff
@@ -139,7 +139,7 @@ fun StyleScope.selected(block: () -> Unit) {
 fun TopicsSettings(
     topics: List<Topic>,
     editingTopic: Topic,
-    serviceRunning: Boolean,
+    sessionActive: Boolean,
     currentTopicId: Long,
     minuteInputs: MinuteInputs,
     sessionsSliderState: SliderState,
@@ -427,7 +427,7 @@ fun TopicsSettings(
                                 TopicTimerSettings(
                                     topic = topic,
                                     topics = topics,
-                                    topicRunning = serviceRunning && topic.id == currentTopicId,
+                                    topicRunning = sessionActive && topic.id == currentTopicId,
                                     minuteInputs = minuteInputs,
                                     sessionsSliderState = sessionsSliderState,
                                     onAction = onAction,
@@ -466,7 +466,7 @@ fun TopicsSettingsPreview() {
         TopicsSettings(
             topics = topics,
             editingTopic = editingTopic,
-            serviceRunning = false,
+            sessionActive = false,
             currentTopicId = editingTopic.id,
             minuteInputs = MinuteInputs("25", "5", "15"),
             sessionsSliderState = rememberSliderState(4f, valueRange = 1f..10f),
@@ -499,7 +499,7 @@ fun TopicsSettingsDarkPreview() {
         TopicsSettings(
             topics = topics,
             editingTopic = editingTopic,
-            serviceRunning = false,
+            sessionActive = false,
             currentTopicId = editingTopic.id,
             minuteInputs = MinuteInputs("25", "5", "15"),
             sessionsSliderState = rememberSliderState(4f, valueRange = 1f..10f),
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/settingsScreen/viewModel/SettingsViewModel.kt` (modified, +9/-8)
```diff
@@ -32,6 +32,7 @@ import kotlinx.coroutines.delay
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.SharingStarted
 import kotlinx.coroutines.flow.asStateFlow
+import kotlinx.coroutines.flow.distinctUntilChanged
 import kotlinx.coroutines.flow.flowOn
 import kotlinx.coroutines.flow.map
 import kotlinx.coroutines.flow.stateIn
@@ -68,17 +69,17 @@ class SettingsViewModel(
     val backStack = mutableStateListOf<Screen.Settings>(Screen.Settings.Main)
 
     val isPlus = billingManager.isPlus
-    val serviceRunning = stateRepository.timerState
-        .map { it.serviceRunning }
-        .flowOn(Dispatchers.IO)
+    val sessionActive = stateRepository.timerState
+        .map { it.sessionActive }
+        .distinctUntilChanged()
         .stateIn(
             viewModelScope,
             SharingStarted.WhileSubscribed(5000),
-            false
+            stateRepository.timerState.value.sessionActive
         )
 
-    private val isServiceRunning: Boolean
-        get() = stateRepository.timerState.value.serviceRunning
+    private val isSessionActive: Boolean
+        get() = stateRepository.timerState.value.sessionActive
 
     val currentTopicId = stateRepository.currentTopicId
 
@@ -165,7 +166,7 @@ class SettingsViewModel(
             val created = topic.copy(id = id)
             setEditingTopic(created)
 
-            if (setAsCurrent && !isServiceRunning) {
+            if (setAsCurrent && !isSessionActive) {
                 stateRepository.setTopic(created)
             }
         }
@@ -296,7 +297,7 @@ class SettingsViewModel(
             viewModelScope.launch(Dispatchers.IO) { saveMinutes(minuteInputs) }
         }
 
-        if (!isServiceRunning)
+        if (!isSessionActive)
             try {
                 timerHelper.onAction(TimerAction.ResetTimer)
             } catch (e: Exception) {
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/ui/timerScreen/TimerMainPane.kt` (modified, +1/-1)
```diff
@@ -288,7 +288,7 @@ fun SharedTransitionScope.TimerMainPane(
                 actions = {
                     var expanded by remember { mutableStateOf(false) }
 
-                    val canSwitchTopic = !timerState.serviceRunning
+                    val canSwitchTopic = !timerState.sessionActive
                     val topicItemColors = MenuDefaults.selectableItemColors()
 
                     FilledTonalIconToggleButton(
```

---

### Incident Patch 15: `8ccebcbe` (2026-09-15)
**Commit Message**: fix(icon): use correctly sized glass-style icon on MacOS



#### Recent Merged Pull Requests:
- **PR #310** (2026-09-17): fix(deps): update all non-major dependencies (@renovate[bot])
- **PR #308** (2026-09-10): fix(deps): update all non-major dependencies (@renovate[bot])
- **PR #304** (2026-09-01): chore(deps): update actions/setup-java action to v6 (@renovate[bot])
- **PR #303** (2026-09-10): Add Dimu under the Special Thanks section of the README (@pdimu)
- **PR #300** (2026-09-01): fix(deps): update all non-major dependencies (@renovate[bot])
- **PR #298** (2026-08-19): fix(deps): update all non-major dependencies (@renovate[bot])
- **PR #295** (2026-08-19): chore(deps): update actions/checkout action to v7 (@renovate[bot])
- **PR #289** (2026-08-09): fix(deps): update dependency com.materialkolor:material-kolor to v5 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
