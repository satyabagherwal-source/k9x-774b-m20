# Forensic Learning Record (Deep Inspection): sayaka-sh/spmp

> **Canonical Artifact**: `07_PROJECT_LEARNING/sayaka-sh-spmp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sayaka-sh/spmp](https://github.com/sayaka-sh/spmp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:00:58.522Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sayaka-sh/spmp`
- **Description**: SpMp has been succeeded by Kanon, see README --- A YouTube Music client with a focus on customisation of colours and song metadata. Built with Compose Multiplatform for Android and desktop.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1451 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/main/java/com/toasterofbread/spmp/widget/SongQueueWidgetReceiver.kt`
```
package com.toasterofbread.spmp.widget

class SongQueueWidgetReceiver: SpMpWidgetReceiver(SpMpWidgetType.SONG_QUEUE)

```

### Core Architecture Module: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/ExoPlayerUtils.kt`
```
package com.toasterofbread.spmp.platform.playerservice

import android.media.audiofx.LoudnessEnhancer
import androidx.core.net.toUri
import androidx.media3.common.MediaMetadata
import com.toasterofbread.spmp.model.mediaitem.song.Song
import com.toasterofbread.spmp.model.mediaitem.song.SongRef
import com.toasterofbread.spmp.platform.AppContext
import com.toasterofbread.spmp.db.Database
import dev.toastbits.spms.socketapi.shared.SpMsPlayerState
import androidx.media3.common.MediaItem as ExoMediaItem

internal fun Song.buildExoMediaItem(context: AppContext): ExoMediaItem =
    ExoMediaItem.Builder()
        .setRequestMetadata(ExoMediaItem.RequestMetadata.Builder().setMediaUri(id.toUri()).build())
        .setUri(id)
        .setCustomCacheKey(id)
        .setMediaMetadata(
            MediaMetadata.Builder()
                .apply {
                    val db: Database = context.database

                    setArtworkUri(id.toUri())
                    setTitle(getActiveTitle(db))
                    setArtist(Artists.get(db)?.firstOrNull()?.getActiveTitle(db))

                    val album = Album.get(db)
                    setAlbumTitle(album?.getActiveTitle(db))
                    setAlbumArtist(album?.Artists?.get(db)?.firstOrNull()?.getActiveTitle(db))
                }
                .build()
        )
        .build()

fun convertState(exo_state: Int): SpMsPlayerState =
    SpMsPlayerState.entries[exo_state - 1]

fun ExoMediaItem.toSong(): Song =
    SongRef(mediaMetadata.artworkUri.toString())

internal suspend fun LoudnessEnhancer.update(song: Song?, context: AppContext) {
    if (song == null || !context.settings.Streaming.ENABLE_AUDIO_NORMALISATION.get()) {
        enabled = false
        return
    }

    val loudness_db: Float? = song.LoudnessDb.get(context.database)
    if (loudness_db == null) {
        setTargetGain(0)
    }
    else {
        setTargetGain((loudness_db * 100).toInt())
    }

    enabled = true
}

```

### Core Architecture Module: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/NotificationImageUtils.kt`
```
package com.toasterofbread.spmp.platform.playerservice

import android.graphics.Bitmap
import android.os.Build
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import com.toasterofbread.spmp.model.mediaitem.song.Song
import com.toasterofbread.spmp.platform.AppContext
import kotlin.math.roundToInt

private const val A13_MEDIA_NOTIFICATION_ASPECT = 2.9f / 5.7f

fun getMediaNotificationImageMaxOffset(image: Bitmap): IntOffset {
    val dimensions: IntSize = getMediaNotificationImageSize(image)
    return IntOffset(
        (image.width - dimensions.width) / 2,
        (image.height - dimensions.height) / 2
    )
}

fun getMediaNotificationImageSize(image: Bitmap, square: Boolean = false): IntSize {
    val aspect: Float =
        if (!square && Build.VERSION.SDK_INT >= 33) A13_MEDIA_NOTIFICATION_ASPECT
        else 1f

    if (image.width > image.height) {
        return IntSize(
            image.height,
            (image.height * aspect).roundToInt()
        )
    }
    else {
        return IntSize(
            image.width,
            (image.width * aspect).roundToInt()
        )
    }
}

internal fun formatMediaNotificationImage(
    image: Bitmap,
    song: Song,
    context: AppContext,
): Bitmap {
    val offset: IntOffset = song.NotificationImageOffset.get(context.database) ?: IntOffset.Zero
    val square: Boolean = offset.x == 0 && offset.y == 0
    val dimensions: IntSize = getMediaNotificationImageSize(image, square = square)

    return Bitmap.createBitmap(
        image,
        (((image.width - dimensions.width) / 2) + offset.x).coerceIn(0, image.width - dimensions.width),
        (((image.height - dimensions.height) / 2) + offset.y).coerceIn(0, image.height - dimensions.height),
        dimensions.width,
        dimensions.height
    )
}

```

### Core Architecture Module: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/notification/NotificationState.kt`
```
package com.toasterofbread.spmp.platform.playerservice.notification

import android.media.session.PlaybackState
import dev.toastbits.ytmkt.model.external.SongLikedStatus

data class NotificationState(
    val playback_state: Int? = PlaybackState.STATE_NONE,
    val paused: Boolean = true,
    val current_liked_status: SongLikedStatus? = null,
    val authenticated: Boolean = false,
    val position_ms: Long? = null
)

```

### Core Architecture Module: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/notification/NotificationStateManager.kt`
```
package com.toasterofbread.spmp.platform.playerservice.notification

import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.SystemClock
import androidx.media3.common.Player
import com.toasterofbread.spmp.platform.playerservice.PlayerServiceNotificationCustomAction
import com.toasterofbread.spmp.ui.getAndroidIcon
import dev.toastbits.composekit.util.platform.launchSingle
import dev.toastbits.ytmkt.model.external.SongLikedStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext

class NotificationStateManager(private val media_session: MediaSession) {
    var current: NotificationState = NotificationState()
        private set

    private val coroutine_scope: CoroutineScope = CoroutineScope(Job())

    fun update(
        playback_state: Int? = current.playback_state,
        paused: Boolean = current.paused,
        current_liked_status: SongLikedStatus? = current.current_liked_status,
        authenticated: Boolean = current.authenticated,
        position_ms: Long? = current.position_ms
    ) {
        val new_state: NotificationState =
            NotificationState(
                playback_state,
                paused,
                current_liked_status,
                authenticated,
                position_ms
            )

        if (new_state == current) {
            return
        }

        current = new_state

        coroutine_scope.launchSingle {
            media_session.setPlaybackState(new_state.build())
        }
    }

    fun release() {
        coroutine_scope.cancel()
    }

    private suspend fun NotificationState.build(): PlaybackState? = withContext(Dispatchers.Main) {
        val state_builder: PlaybackState.Builder = PlaybackState.Builder()

        state_builder.setState(
            playback_state
                ?: if (paused) PlaybackState.STATE_PAUSED else PlaybackState.STATE_PLAYING,
            position_ms ?: 0,
            if (paused) 0f else 1f,
            SystemClock.elapsedRealtime()
        )
        state_builder.setActions(
            PlaybackState.ACTION_SEEK_TO or PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS
        )

        val like_action: PlayerServiceNotificationCustomAction =
            when (current_liked_status) {
                SongLikedStatus.NEUTRAL, null -> PlayerServiceNotificationCustomAction.LIKE
                SongLikedStatus.DISLIKED,
                SongLikedStatus.LIKED -> PlayerServiceNotificationCustomAction.UNLIKE
            }

        state_builder.addCustomAction(
            PlaybackState.CustomAction.Builder(
                like_action.name,
                like_action.name,
                current_liked_status.getAndroidIcon(authenticated)
            ).build()
        )

        return@withContext state_builder.build()
    }
}

```

### Core Architecture Module: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/action/QueueSeekAction.kt`
```
package com.toasterofbread.spmp.widget.action

import SpMp
import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import com.toasterofbread.spmp.platform.playerservice.PlayerService
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch

class QueueSeekAction: ActionCallback {
    @OptIn(DelicateCoroutinesApi::class)
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val index: Int = parameters[keyIndex] ?: return
        val controller: PlayerService = SpMp._player_state?.controller ?: return

        GlobalScope.launch(Dispatchers.Main) {
            controller.seekToItem(index)
        }
    }

    companion object {
        val keyIndex: ActionParameters.Key<Int> = ActionParameters.Key("index")

        operator fun invoke(index: Int): Action =
            actionRunCallback<QueueSeekAction>(
                actionParametersOf(keyIndex to index)
            )
    }
}
```

### Core Architecture Module: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/impl/SongQueueWidget.kt`
```
package com.toasterofbread.spmp.widget.impl

import LocalPlayerState
import android.graphics.Bitmap
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.lazy.itemsIndexed
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import com.toasterofbread.spmp.model.mediaitem.song.Song
import com.toasterofbread.spmp.service.playercontroller.PlayerState
import com.toasterofbread.spmp.widget.SpMpWidget
import com.toasterofbread.spmp.widget.action.SongQueueWidgetClickAction
import com.toasterofbread.spmp.widget.component.GlanceLazyColumn
import com.toasterofbread.spmp.widget.configuration.type.SongQueueWidgetConfig
import com.toasterofbread.spmp.widget.action.QueueSeekAction
import com.toasterofbread.spmp.widget.component.spmp.GlanceSongPreview
import dev.toastbits.composekit.util.thenIf
import org.jetbrains.compose.resources.stringResource
import spmp.shared.generated.resources.Res
import spmp.shared.generated.resources.widget_empty_status_nothing_playing
import spmp.shared.generated.resources.widget_queue_heading_now_playing
import spmp.shared.generated.resources.widget_queue_heading_up_next

internal class SongQueueWidget: SpMpWidget<SongQueueWidgetClickAction, SongQueueWidgetConfig>(false) {
    override fun executeTypeAction(action: SongQueueWidgetClickAction) =
        when (action) {
            else -> throw IllegalStateException(action.toString())
        }

    @Composable
    private fun Heading(text: String, modifier: GlanceModifier = GlanceModifier) {
        WidgetText(
            text,
            modifier.padding(bottom = 5.dp),
            font_size = 15.sp,
            alpha = 0.5f
        )
    }

    @Composable
    override fun Content(
        song: Song?,
        song_image: Bitmap?,
        modifier: GlanceModifier,
        content_padding: PaddingValues
    ) {
        val player: PlayerState = LocalPlayerState.current

        if (song != null) {
            GlanceLazyColumn(
                content_padding,
                modifier.fillMaxWidth()
            ) {
                if (type_configuration.show_current_song) {
                    item {
                        Heading(stringResource(Res.string.widget_queue_heading_now_playing))
                    }

                    item {
                        GlanceSongPreview(song, GlanceModifier.fillMaxWidth())
                    }
                }

                val playing_index: Int = player.status.m_index
                val following_songs: MutableList<Song> = mutableListOf()

                for (offset in 1 .. type_configuration.next_songs_to_show.let { if (it < 0) player.status.m_song_count else it }) {
                    val following: Song = player.controller?.getSong(playing_index + offset) ?: break
                    following_songs.add(following)
                }

                if (following_songs.isNotEmpty()) {
                    item {
                        Heading(
                            stringResource(Res.string.widget_queue_heading_up_next),
                            GlanceModifier.padding(top = 15.dp)
                        )
                    }

                    itemsIndexed(following_songs) { index, following ->
                        GlanceSongPreview(
                            following,
                            GlanceModifier
                                .fillMaxWidth()
                                .clickable(
                                    QueueSeekAction(playing_index + 1 + index)
                                )
                                .thenIf(index + 1 != following_songs.size) {
                                    padding(bottom = 3.dp)
                                }
                        )
                    }
                }
            }
        }
        else {
            WidgetText(stringResource(Res.string.widget_empty_status_nothing_playing), modifier)
        }
    }
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/model/appaction/action/playback/QueuePlaybackActions.kt`
```
package com.toasterofbread.spmp.model.appaction.action.playback

import kotlinx.serialization.Serializable
import com.toasterofbread.spmp.service.playercontroller.PlayerState

@Serializable
class ShuffleQueuePlaybackAppAction: PlaybackAction {
    override fun getType(): PlaybackAction.Type =
        PlaybackAction.Type.SHUFFLE_QUEUE

    override suspend fun execute(player: PlayerState) {
        player.withPlayer{
            undoableAction {
                shuffleQueue(start = current_item_index + 1)
            }
        }
    }
}

@Serializable
class ClearQueuePlaybackAppAction: PlaybackAction {
    override fun getType(): PlaybackAction.Type =
        PlaybackAction.Type.CLEAR_QUEUE

    override suspend fun execute(player: PlayerState) {
        player.withPlayer {
            undoableAction {
                clearQueue(keep_current = player.status.m_song_count > 1)
            }
        }
    }
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/model/appaction/shortcut/ShortcutState.kt`
```
package com.toasterofbread.spmp.model.appaction.shortcut

import LocalPlayerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.key
import com.toasterofbread.spmp.service.playercontroller.PlayerState
import com.toasterofbread.spmp.ui.component.shortcut.trigger.KeyboardShortcutTrigger
import com.toasterofbread.spmp.ui.component.shortcut.trigger.MouseButtonShortcutTrigger
import dev.toastbits.composekit.util.addUnique
import kotlinx.coroutines.launch
import kotlin.math.roundToLong

val LocalShortcutState: ProvidableCompositionLocal<ShortcutState> = compositionLocalOf { ShortcutState() }

typealias KeyDetectionState = (Key) -> Unit
typealias ButtonDetectionState = (Int) -> Unit

private val NUMBER_KEYS: List<Key?> = listOf(
    Key.Zero, Key.One, Key.Two, Key.Three, Key.Four, Key.Five, Key.Six, Key.Seven, Key.Eight, Key.Nine, null
)

class ShortcutState {
    private val pressed_modifiers: MutableList<KeyboardShortcutTrigger.KeyboardModifier> = mutableStateListOf()
    private var navigate_song_with_numbers: Boolean = false

    private var key_detection_state: KeyDetectionState? = null
    private var button_detection_state: ButtonDetectionState? = null

    private var keyboard_shortcuts: List<Shortcut> = emptyList()
    private var mouse_button_shortcuts: List<Shortcut> = emptyList()

    @Composable
    fun ObserveState() {
        val player: PlayerState = LocalPlayerState.current
        navigate_song_with_numbers = player.settings.Shortcut.NAVIGATE_SONG_WITH_NUMBERS.observe().value

        val shortcuts: List<Shortcut>? by player.settings.Shortcut.CONFIGURED_SHORTCUTS.observe()
        LaunchedEffect(shortcuts) {
            val keyboard_shortcuts: MutableList<Shortcut> = mutableListOf()
            val mouse_button_shortcuts: MutableList<Shortcut> = mutableListOf()

            for (shortcut in (shortcuts ?: getDefaultShortcuts())) {
                when (shortcut.trigger) {
                    null -> {}
                    is KeyboardShortcutTrigger -> keyboard_shortcuts.add(shortcut)
                    is MouseButtonShortcutTrigger -> mouse_button_shortcuts.add(shortcut)
                }
            }

            this@ShortcutState.keyboard_shortcuts = keyboard_shortcuts
            this@ShortcutState.mouse_button_shortcuts = mouse_button_shortcuts
        }
    }

    fun onModifierDown(modifier: KeyboardShortcutTrigger.KeyboardModifier) {
        pressed_modifiers.addUnique(modifier)
    }

    fun onModifierUp(modifier: KeyboardShortcutTrigger.KeyboardModifier) {
        pressed_modifiers.remove(modifier)
    }

    fun onKeyPress(
        event: KeyEvent,
        text_input_active: Boolean,
        player: PlayerState
    ): Boolean {
        key_detection_state?.also {
            it.invoke(event.key)
            return true
        }

        for (shortcut in keyboard_shortcuts) {
            if (text_input_active && !shortcut.action.isUsableDuringTextInput()) {
                continue
            }

            val trigger: KeyboardShortcutTrigger = shortcut.trigger as KeyboardShortcutTrigger
            if (trigger.isTriggeredBy(event)) {
                player.coroutine_scope.launch {
                    shortcut.action.executeAction(player)
                }
                return true
            }
        }

        if (navigate_song_with_numbers) {
            val number_index: Int = NUMBER_KEYS.indexOf(event.key)
            if (number_index != -1 && KeyboardShortcutTrigger.KeyboardModifier.entries.none { it.isPressedInEvent(event) }) {
                player.withPlayer {
                    val seek_target: Long = (duration_ms * (number_index.toFloat() / NUMBER_KEYS.size)).roundToLong()
                    seekTo(seek_target)
                }
                return true
            }
        }

        return false
    }

    fun onButtonPress(button_code: Int, player: PlayerState): Boolean {
        button_detection_state?.also {
            it.invoke(button_code)
            return true
        }

        for (shortcut in mouse_button_shortcuts) {
            val trigger: MouseButtonShortcutTrigger = shortcut.trigger as MouseButtonShortcutTrigger
            if (trigger.isTriggeredBy(button_code)) {
                player.coroutine_scope.launch {
                    shortcut.action.executeAction(player)
                }
                return true
            }
        }

        return false
    }

    fun setKeyDetectionState(state: KeyDetectionState?) {
        key_detection_state = state
    }

    fun setButtonDetectionState(state: ButtonDetectionState?) {
        button_detection_state = state
    }
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/model/mediaitem/db/ObserveAsState.kt`
```
package com.toasterofbread.spmp.model.mediaitem.db

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import app.cash.sqldelight.Query

@Composable
fun <T, Q: Query<*>> Q.observeAsState(
    key: Any,
    mapValue: (Q) -> T = { it as T },
    onExternalChange: (suspend (T) -> Unit)?
): MutableState<T> {
    val state: MutableState<T> = remember(key) { mutableStateOf(mapValue(this)) }
    var current_value: T by remember(state) { mutableStateOf(state.value) }

    DisposableEffect(state) {
        val listener: Query.Listener = Query.Listener {
            current_value = mapValue(this@observeAsState)
            state.value = current_value
        }

        addListener(listener)
        onDispose {
            removeListener(listener)
        }
    }

    LaunchedEffect(state.value) {
        if (state.value != current_value) {
            current_value = state.value

            if (onExternalChange != null) {
                try {
                    onExternalChange(current_value)
                }
                catch (e: Throwable) {
                    if (e::class.qualifiedName != "androidx.compose.runtime.LeftCompositionCancellationException") {
                        e.printStackTrace()
                        throw RuntimeException("onExternalChange failed for observed query (${this@observeAsState}, $current_value)", e)
                    }
                }
            }
            else {
                throw IllegalStateException("onExternalChange has not been defined (${this@observeAsState}, $current_value)")
            }
        }
    }

    return state
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/model/mediaitem/db/Utils.kt`
```
package com.toasterofbread.spmp.model.mediaitem.db

import com.toasterofbread.spmp.model.mediaitem.MediaItemData
import com.toasterofbread.spmp.model.mediaitem.loader.MediaItemLoader
import com.toasterofbread.spmp.platform.AppContext

fun Boolean.toSQLBoolean(): Long? = if (this) 0L else null
fun Long?.fromSQLBoolean(): Boolean = this != null

fun Boolean?.toNullableSQLBoolean(): Long? =
    when (this) {
        false -> 0L
        true -> 1L
        null -> null
    }
fun Long?.fromNullableSQLBoolean(): Boolean? =
    when (this) {
        0L -> false
        1L -> true
        else -> null
    }

suspend fun <T, ItemType: MediaItemData> AppContext.loadMediaItemValue(item: ItemType, getValue: ItemType.() -> T?): Result<T>? {
    // If the item is marked as already loaded, give up
    val loaded = database.mediaItemQueries.loadedById(item.id).executeAsOneOrNull()?.loaded.fromSQLBoolean()
    if (loaded) {
        return null
    }

    // Load item data
    val load_result = MediaItemLoader.loadUnknown(item, this)
    val loaded_item = load_result.fold(
        { it },
        { return Result.failure(it) }
    )

    val value = getValue(loaded_item)
    return value?.let { Result.success(it) }
}

```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/model/radio/RadioState.kt`
```
package com.toasterofbread.spmp.model.radio

import com.toasterofbread.spmp.model.mediaitem.MediaItem
import com.toasterofbread.spmp.model.mediaitem.artist.Artist
import com.toasterofbread.spmp.model.mediaitem.getMediaItemFromUid
import com.toasterofbread.spmp.model.mediaitem.getUid
import com.toasterofbread.spmp.model.mediaitem.playlist.LocalPlaylist
import com.toasterofbread.spmp.model.mediaitem.playlist.LocalPlaylistData
import com.toasterofbread.spmp.model.mediaitem.playlist.PlaylistData
import com.toasterofbread.spmp.model.mediaitem.playlist.RemotePlaylist
import com.toasterofbread.spmp.model.mediaitem.playlist.RemotePlaylistData
import com.toasterofbread.spmp.model.mediaitem.song.Song
import com.toasterofbread.spmp.model.mediaitem.song.SongData
import com.toasterofbread.spmp.model.mediaitem.song.toSongData
import com.toasterofbread.spmp.platform.AppContext
import dev.toastbits.ytmkt.endpoint.ArtistShuffleEndpoint
import dev.toastbits.ytmkt.endpoint.RadioBuilderModifier
import dev.toastbits.ytmkt.endpoint.SongRadioEndpoint
import dev.toastbits.ytmkt.model.external.mediaitem.YtmSong
import dev.toastbits.ytmkt.radio.BuiltInRadioContinuation
import dev.toastbits.ytmkt.radio.RadioContinuation
import kotlinx.serialization.Serializable

@Serializable
data class RadioState(
    val source: RadioStateSource? = null,
    val item_queue_index: Int? = null,
    val shuffle: Boolean = false,
    @Serializable(with = RadioContinuationSerializer::class)
    val continuation: RadioContinuation? = null,
    val initial_songs_loaded: Boolean = false,

    val filters: List<RadioFilter>? = null,
    val current_filter_index: Int? = null
) {
    interface RadioStateSource {
        fun getDesiredMinimumItemCount(): Int = 0

        fun isItem(item: MediaItem): Boolean
        fun getMediaItem(): MediaItem

        data class ItemUid(val item_uid: String): RadioStateSource {
            override fun isItem(item: MediaItem): Boolean =
                item.getUid() == item_uid
            override fun getMediaItem(): MediaItem =
                getMediaItemFromUid(item_uid)
        }
    }

    fun isContinuationAvailable(): Boolean =
        continuation != null || (source != null && !initial_songs_loaded)

    internal suspend fun loadContinuation(context: AppContext): Result<RadioLoadResult?> = runCatching {
        if (source == null) {
            return@runCatching null
        }

        val item: MediaItem = source.getMediaItem()

        val result: RadioLoadResult = (
            if (continuation == null) loadInitialSongs(
                context = context,
                item = item,
                desired_minimum_item_count = source.getDesiredMinimumItemCount()
            )
            else loadContinuationSongs(context, item, continuation)
        )

        if (shuffle) {
            return@runCatching result.copy(songs = result.songs.shuffled())
        }

        return@runCatching result
    }

    private suspend fun loadInitialSongs(
        context: AppContext,
        item: MediaItem,
        desired_minimum_item_count: Int
    ): RadioLoadResult {
        if (initial_songs_loaded) {
            throw RuntimeException("Initial songs already loaded $this")
        }

        when (item) {
            is Song -> {
                val radio: SongRadioEndpoint.RadioData =
                    context.ytapi.SongRadio.getSongRadio(
                        song_id = item.id,
                        continuation = null,
                        filters = getCurrentFilter()
                    ).getOrThrow()

                return RadioLoadResult(
                    songs = radio.items.map { it.toSongData() },
                    continuation = radio.continuation?.let { token ->
                        BuiltInRadioContinuation(token, type = BuiltInRadioContinuation.Type.SONG, item_id = item.id)
                    },
                    filters = radio.filters
                )
            }
            is Artist -> {
                val shufflePlaylistId: String =
                    item.ShufflePlaylistId.get(context.database)
                    ?: throw NullPointerException("Artist ${item.id} has no shuffle playlist ID")

                val radio: ArtistShuffleEndpoint.RadioData =
                    context.ytapi.ArtistShuffle.getArtistShuffle(
                        artist_shuffle_playlist_id = shufflePlaylistId,
                        continuation = null
                    ).getOrThrow()

                return RadioLoadResult(
                    songs = radio.items.map { it.toSongData() },
                    continuation = radio.continuation
                )
            }
            is RemotePlaylist -> {
                val playlist_data: RemotePlaylistData = item.loadData(context).getOrThrow()
                val items: List<SongData>? = playlist_data.items
                checkNotNull(items) { "playlist_data.items is null (${item.id})" }
                return loadInitialPlaylistRadio(items, playlist_data.continuation, desired_minimum_item_count = desired_minimum_item_count)
            }
            is LocalPlaylist -> {
                val items: List<SongData>? = item.loadData(context).getOrThrow().items
                checkNotNull(items) { "playlist_data.items is null (${item.id})" }
                return loadInitialPlaylistRadio(items, desired_minimum_item_count = desired_minimum_item_count)
            }
            else -> throw NotImplementedError(item::class.toString())
        }
    }

    private fun loadInitialPlaylistRadio(
        items: List<SongData>,
        next_continuation: RadioContinuation? = null,
        desired_minimum_item_count: Int = 0
    ): RadioLoadResult {
        val step_size: Int =
            maxOf(desired_minimum_item_count, PlaylistItemsRadioContinuation.PLAYLIST_RADIO_LOAD_STEP_SIZE)
        val continuation: RadioContinuation? =
            if (items.size > step_size)
                PlaylistItemsRadioContinuation(
                    song_ids = items.map { it.id },
                    head = step_size,
                    next_continuation = next_continuation
                )
            else next_continuation

        return RadioLoadResult(
            songs = items.take(step_size),
            continuation = continuation
        )
    }

    private suspend fun loadContinuationSongs(
        context: AppContext,
        item: MediaItem,
        continuation: RadioContinuation
    ): RadioLoadResult {
        val (songs, new_continuation) = continuation.loadContinuation(context.ytapi, getCurrentFilter()).getOrThrow()
        return RadioLoadResult(
            songs = songs.map { song ->
                when (song) {
                    is Song -> song
                    is YtmSong -> song.toSongData()
                    else -> throw IllegalStateException("Not a song $song (from $continuation)")
                }
            },
            continuation = new_continuation,
            filters = filters
        )
    }

    private fun getCurrentFilter(): RadioFilter {
        if (current_filter_index == null) {
            return emptyList()
        }
        if (current_filter_index == -1) {
            return listOf(RadioBuilderModifier.Internal.ARTIST)
        }
        return filters?.getOrNull(current_filter_index) ?: emptyList()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #452** (2025-02-21): **SpMp fails to get the video stream URL for any song.**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  1. Open SpMp 2. Play any song you see 3. Doesn't play at all  ### Expected behavior  Should play  ### Actual behavior  Doesn't play  ### Screenshots / recordings  https://github.com/user-attachments/assets/2019bba5-0113-4e20-9a3e-ce96c5bde7ef  ### Logs  `java.lang.RuntimeException: Getting video stream url for XqoanTj5pNY failed         at dev.toastbits.spms.mpv.MpvClientImpl.onMpvHook-z13BHRw$library(MpvClientImpl.kt:282)         at dev.toastbits.spms.mpv.MpvClientImpl$onMpvHook$1.invokeSuspend(MpvClientImpl.kt)         at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:33)         at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:104)         at kotlinx.coroutines.internal.LimitedDispatcher$Worker.run(LimitedDispatcher.kt:111)         at kotlinx.coroutines.scheduling.TaskImpl.run(Tasks.kt:99)         at kotlinx.coroutines.scheduling.CoroutineScheduler.runSafely(CoroutineScheduler.kt:585)         at kotlinx.coroutines.
  **Post-Mortem & Fix Analysis**:
  > This happens for all stream/download methods.
  > Duplicate of #416

- **Issue #448** (2025-01-29): **Does not play anything**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  1. Choose any one of the three playback methods 2. Try to play anything  ### Expected behavior  The song should play  ### Actual behavior  The app endlessly “loads”, nothing happens, not even the length of the song  ### Screenshots / recordings  https://github.com/user-attachments/assets/7d37484c-c479-48b8-9e63-0e877de56a25  ### Logs  No crash  ### SpMp version  0.4.2  ### SpMp platform  Android  ### OS version  Android 14  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #416.

- **Issue #447** (2025-01-27): **Playback is stuck indefinitely**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. (actually there are closed ones but it didn't help) - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  1. Search a song. For example "Sucker" cover by Itsuki. 2. Play it  ### Expected behavior  The song plays. It used to work fine.  ### Actual behavior  It's stuck indefinitely.   ### Screenshots / recordings  ![Image](https://github.com/user-attachments/assets/920d3c1a-55f7-436e-ac7a-0742913e8c66)   ### Logs  1737937203.314 10088  2792  2792 E ActivityManagerWrapper: getRecentTasks: taskId=24647   userId=0   baseIntent=Intent { act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=com.toasterofbread.spmp.debug/com.toasterofbread.spmp.MainActivity } 1737937203.326 10088  2792  2792 D TaskView: TaskView bind task, task=[id=24647 stackId=24647 windowingMode=1 user=0 lastActiveTime=501729358, component=ComponentInfo{com.toasterofbread.spmp.debug/com.toasterofbread.spmp.MainActivity}] SpMp (debug), isLock=false 1737937203.328 10088  2792  2956 D IconLoader: Loading icon: id=24647 sta
  **Post-Mortem & Fix Analysis**:
  > I have the same problem with youtubei
  > Duplicate of #416.
  > @toasterofbread Is it? I'm not getting any getVideoFormats error. No error popup, and no such error in my log. What makes you think it's the same issue?

- **Issue #443** (2025-01-22): **Takes an indefinite amount of time to load a song**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  1. Login to YouTube  2. Play a song  ### Expected behavior  Songs should load without waiting indefinitely  ### Actual behavior  Songs takes a long time to load  ### Screenshots / recordings  _No response_  ### Logs   None  ### SpMp version  0.4.2  ### SpMp platform  Android  ### OS version  Android 13  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #416

- **Issue #441** (2025-01-22): **Unable to download songs**
  *Symptoms*: ### Checklist  - [x] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [x] I've checked that there is no open or closed issue about this bug. - [x] This issue contains only one bug. - [x] The title of this issue accurately describes the bug.  ### Steps to reproduce  Select download song, Song unable to download  ### Expected behavior  Song should be downloaded  ### Actual behavior  Error promt: java.lang.RuntimeException: No valid formats returned by getVideoFormats(NfxKuAHDC3s)     at com.toasterofbread.spmp.model.mediaitem.song.SongAudioQualityKt.getSongFormats(Unknown Source:141)     at com.toasterofbread.spmp.model.mediaitem.song.SongAudioQualityKt$getSongFormats$1.invokeSuspend(Unknown Source:10)     at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(Unknown Source:8)     at kotlinx.coroutines.DispatchedTask.run(Unknown Source:112)     at androidx.core.app.ActivityRecreator$1.run(Unknown Source:98)     at kotlinx.coroutines.scheduling.TaskImpl.run(Unknown Source:2)     at kotlinx.coroutines.scheduling.CoroutineScheduler$Worker.run(Unknown Source:95)  ### Screenshots / recordings  _No response_  ### Logs  java.lang.RuntimeException: No valid formats returned by getVideoFormats(NfxKuAHDC3s)     at com.toast
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #416.

- **Issue #437** (2025-01-08): **Runtime Exception**
  *Symptoms*: ### Checklist  - [X] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [X] I've checked that there is no open or closed issue about this bug. - [X] This issue contains only one bug. - [X] The title of this issue accurately describes the bug.  ### Steps to reproduce  >play some music >In some case throw a notification saying "RunTimeException" >In some cases don't play radio playlist of the same artist's songs  ### Expected behavior  Don't appear the notification saying RunTimeException   ### Actual behavior  Apeear notification saying RunTimeException   ### Screenshots / recordings  ![Screenshot_2025-01-07-22-15-54-778_com toasterofbread spmp](https://github.com/user-attachments/assets/fe4177f6-0875-4292-9c02-6a2e9536bd37) ![Screenshot_2025-01-07-22-17-19-074_com toasterofbread spmp](https://github.com/user-attachments/assets/2eb8ff86-9542-4d9d-948a-4553156bc048) ![Screenshot_2025-01-07-22-15-48-346_com toasterofbread spmp](https://github.com/user-attachments/assets/5c296a91-fe92-4679-8360-3a6ef6a114b1)   ### Logs  java.lang.RuntimeException: No valid formats returned by getVideoFormats(FF3leCRssIc) 	at com.toasterofbread.spmp.model.mediaitem.song.SongAudioQualityKt.getSongFormats(Unknown Source:141) 	at com.toasterof
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #416 (this is the pinned issue, did you really check for duplicates?).

- **Issue #431** (2025-01-02): **Unable to Stream or Download Music**
  *Symptoms*: ### Checklist  - [X] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [X] I've checked that there is no open or closed issue about this bug. - [X] This issue contains only one bug. - [X] The title of this issue accurately describes the bug.  ### Steps to reproduce  1) Open application 2) log into YT account 3) wait for YT music selection to appear 4) select music to stream or download 5) wait forever  ### Expected behavior  Music playback and/or download  ### Actual behavior  Infinite buffering  ### Screenshots / recordings  ![17358479899341384423398805041991](https://github.com/user-attachments/assets/a5a70593-7044-4db9-a99d-64c413fc2dad)   ### Logs  Couldn't find a file, so here's a direct-from-terminal copy:  [user@computer ~]$ flatpak run dev.toastbits.spmp Database is already up to date (version 6) Loading resource file at values/strings.xml Loading resource file at values-en-US/strings.xml SLF4J(W): No SLF4J providers were found. SLF4J(W): Defaulting to no-operation (NOP) logger implementation SLF4J(W): See https://www.slf4j.org/codes.html#noProviders for further details. Event (true, null): PROPERTY_CHANGED({key="is_playing", value=false}) Connecting to server at tcp://127.0.0
  **Post-Mortem & Fix Analysis**:
  > Also, not sure if this is separate, but the radio tab gives this:  ![20250102_151528.jpg](https://github.com/user-attachments/assets/87ad174b-a435-4b61-8e18-11b10ef75e5e)  
  > It makes sense you wouldn't realise because the error message is slightly different, but this is a duplicate of #416.

- **Issue #430** (2025-01-01): **Android Auto**
  *Symptoms*: ### Checklist  - [X] I am able to reproduce the bug with the latest debug version ([Android](https://nightly.link/toasterofbread/spmp/workflows/build-android/main), [Linux](https://nightly.link/toasterofbread/spmp/workflows/build-linux/main), [Windows](https://nightly.link/toasterofbread/spmp/workflows/build-windows/main)) - [X] I've checked that there is no open or closed issue about this bug. - [X] This issue contains only one bug. - [X] The title of this issue accurately describes the bug.  ### Steps to reproduce  Connect phone to android auto Not able to see spmp player on car screen  ### Expected behavior  App should appear in car display after android auto connect   ### Actual behavior  App not appearing in car display after android auto connect   ### Screenshots / recordings  _No response_  ### Logs  No logs  ### SpMp version  0.4.2  ### SpMp platform  Android  ### OS version  Android 15  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #67. This is not planned.

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

### Incident Patch 1: `5a76563a` (2025-03-14)
**Commit Message**: Build with JDK23

Patch for AUR Git package

**File**: `.github/workflows/build-android.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: 22
+        java-version: 23
 
     - name: Build debug APK
       run: ./gradlew androidApp:packageDebug
```

**File**: `.github/workflows/build-linux.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ jobs:
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: 22
+        java-version: 23
 
     - name: Build tarball
       run: ./gradlew desktopApp:packageReleaseTarball
```

**File**: `.github/workflows/build-windows.yml` (modified, +2/-2)
```diff
@@ -25,12 +25,12 @@ jobs:
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: 22
+        java-version: 23
 
     - name: Set PACKAGE_JAVA_HOME
       run: |
         chcp 65001
-        echo ("PACKAGE_JAVA_HOME=" + $env:JAVA_HOME_22_X64) >> $env:GITHUB_ENV
+        echo ("PACKAGE_JAVA_HOME=" + $env:JAVA_HOME_23_X64) >> $env:GITHUB_ENV
 
     - name: Download mpv
       run: curl -L https://downloads.sourceforge.net/project/mpv-player-windows/libmpv/mpv-dev-x86_64-20240114-git-bd35dc8.7z --output mpv.7z
```

**File**: `androidApp/build.gradle.kts` (modified, +3/-3)
```diff
@@ -127,14 +127,14 @@ android {
     }
 
     compileOptions {
-        sourceCompatibility = JavaVersion.VERSION_22
-        targetCompatibility = JavaVersion.VERSION_22
+        sourceCompatibility = JavaVersion.VERSION_23
+        targetCompatibility = JavaVersion.VERSION_23
         isCoreLibraryDesugaringEnabled = true
     }
 
     kotlin {
         jvmToolchain {
-            version = "22"
+            version = "23"
         }
     }
 
```

**File**: `buildSrc/build.gradle.kts` (modified, +1/-1)
```diff
@@ -14,5 +14,5 @@ dependencies {
 }
 
 tasks.withType(JavaCompile::class) {
-    options.release.set(22)
+    options.release.set(23)
 }
```

**File**: `desktopApp/build.gradle.kts` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ fun getString(key: String): String {
 }
 
 kotlin {
-    jvmToolchain(22)
+    jvmToolchain(23)
 
     jvm()
     sourceSets {
```

**File**: `docker-image/Dockerfile` (modified, +4/-4)
```diff
@@ -11,8 +11,8 @@ RUN test -n "$ANDROID_SDK_VERSION"
 RUN apt-get update && \
     apt-get install -y openjdk-21-jre wget git unzip binutils desktop-file-utils
 
-RUN wget https://download.oracle.com/java/22/latest/jdk-22_linux-x64_bin.deb && \
-    apt-get install -y ./jdk-22_linux-x64_bin.deb
+RUN wget https://download.oracle.com/java/23/latest/jdk-23_linux-x64_bin.deb && \
+    apt-get install -y ./jdk-23_linux-x64_bin.deb
 
 RUN wget https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage -O /appimagetool && \
     chmod +x /appimagetool && \
@@ -36,8 +36,8 @@ ENV GRADLE_HOME=/gradle-$GRADLE_VERSION
 ENV GRADLE_USER_HOME=/gradle-user-home
 
 ENV JAVA_21_HOME=/usr/lib/jvm/java-21-openjdk-amd64
-ENV JAVA_22_HOME=/usr/lib/jvm/jdk-22.0.2-oracle-x64
-ENV JAVA_HOME=$JAVA_22_HOME
+ENV JAVA_23_HOME=/usr/lib/jvm/jdk-23.0.2-oracle-x64
+ENV JAVA_HOME=$JAVA_23_HOME
 
 WORKDIR /src
 ENTRYPOINT ["/src/docker-image/gradleEntryPoint.sh"]
```

**File**: `shared/build.gradle.kts` (modified, +2/-2)
```diff
@@ -189,8 +189,8 @@ android {
     namespace = "com.toasterofbread.spmp.shared"
 
     compileOptions {
-        sourceCompatibility = JavaVersion.VERSION_22
-        targetCompatibility = JavaVersion.VERSION_22
+        sourceCompatibility = JavaVersion.VERSION_23
+        targetCompatibility = JavaVersion.VERSION_23
     }
 
     sourceSets.getByName("main") {
```

---

### Incident Patch 2: `06adced2` (2025-03-12)
**Commit Message**: Fix desktop workflows build

**File**: `.github/workflows/build-linux.yml` (modified, +1/-6)
```diff
@@ -22,12 +22,7 @@ jobs:
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: |
-          22
-          21
-
-    - name: Set up Gradle
-      uses: gradle/gradle-build-action@v3
+        java-version: 22
 
     - name: Build tarball
       run: ./gradlew desktopApp:packageReleaseTarball
```

**File**: `.github/workflows/build-windows.yml` (modified, +1/-6)
```diff
@@ -25,9 +25,7 @@ jobs:
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: |
-          22
-          21
+        java-version: 22
 
     - name: Set PACKAGE_JAVA_HOME
       run: |
@@ -47,9 +45,6 @@ jobs:
 
     - run: dir desktopApp\build\package\windows
 
-    - name: Set up Gradle
-      uses: gradle/gradle-build-action@v3
-
     - name: Build zip and exe
       run: .\gradlew.bat desktopApp:packageReleaseZip desktopApp:packageReleaseExe -PGIT_TAG_OVERRIDE="v0.4.0"
 
```

---

### Incident Patch 3: `82a3c5af` (2025-03-12)
**Commit Message**: Fix Android workflow build

**File**: `.github/workflows/build-android.yml` (modified, +2/-7)
```diff
@@ -18,16 +18,11 @@ jobs:
       with:
         submodules: recursive
 
-    - name: Set up JDKs
+    - name: Set up JDK
       uses: actions/setup-java@v3
       with:
         distribution: 'temurin'
-        java-version: |
-          22
-          21
-
-    - name: Set up Gradle
-      uses: gradle/gradle-build-action@v3
+        java-version: 22
 
     - name: Build debug APK
       run: ./gradlew androidApp:packageDebug
```

**File**: `androidApp/build.gradle.kts` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ android {
 
     kotlin {
         jvmToolchain {
-            version = "17"
+            version = "22"
         }
     }
 
```

**File**: `buildSrc/build.gradle.kts` (modified, +1/-1)
```diff
@@ -14,5 +14,5 @@ dependencies {
 }
 
 tasks.withType(JavaCompile::class) {
-    options.release.set(21)
+    options.release.set(22)
 }
```

**File**: `desktopApp/build.gradle.kts` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ fun getString(key: String): String {
 }
 
 kotlin {
-    jvmToolchain(21)
+    jvmToolchain(22)
 
     jvm()
     sourceSets {
```

**File**: `gradle.properties` (modified, +1/-1)
```diff
@@ -23,6 +23,6 @@ org.jetbrains.compose.experimental.wasm.enabled=true
 
 # Plugin versions
 kotlin.version=2.1.10
-agp.version=8.4.1
+agp.version=8.8.2
 compose.version=1.8.0-alpha01
 sqldelight.version=2.0.2
```

**File**: `gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 #Fri Jul 19 17:43:19 GMT 2024
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-8.8-bin.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-8.11.1-bin.zip
 zipStoreBase=GRADLE_USER_HOME
 zipStorePath=wrapper/dists
```

---

### Incident Patch 4: `be104052` (2025-01-30)
**Commit Message**: Fix NP background image opacity being used as theme BG opacity

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/platform/AppContext.kt` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ class AppThemeManager(
     private var accent_colour_source: AccentColourSource? by
         mutableStateOf(context.settings.Theme.ACCENT_COLOUR_SOURCE.get())
     private var background_opacity: Float by
-        mutableStateOf(context.settings.Theme.NOWPLAYING_DEFAULT_BACKGROUND_IMAGE_OPACITY.get())
+        mutableStateOf(context.settings.Theme.WINDOW_BACKGROUND_OPACITY.get())
 
     override fun selectAccentColour(values: ThemeValues, contextualColour: Color?): Color =
         when(accent_colour_source ?: AccentColourSource.THEME) {
```

---

### Incident Patch 5: `c28e8e8b` (2024-11-12)
**Commit Message**: Fix notification back button restarting song (closes #398)

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/PlayerSessionCallback.kt` (modified, +2/-2)
```diff
@@ -39,11 +39,11 @@ class PlayerSessionCallback(
     }
 
     override fun onSkipToNext() {
-        player.seekToNext()
+        player.seekToNextMediaItem()
     }
 
     override fun onSkipToPrevious() {
-        player.seekToPrevious()
+        player.seekToPreviousMediaItem()
     }
 
     override fun onPlay() {
```

---

### Incident Patch 6: `fbafb618` (2024-11-08)
**Commit Message**: Remove widget debug information display option

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/SpMpWidget.kt` (modified, +19/-35)
```diff
@@ -199,44 +199,34 @@ abstract class SpMpWidget<A: TypeWidgetClickAction, T: TypeWidgetConfig<A>>(
                             .clickable(WidgetActionCallback(configuration.type_configuration.click_action)),
                         contentAlignment = Alignment.Center
                     ) {
-                        if (base_configuration.show_debug_information) {
-                            shouldHide()
-                            hasContent()
-                        }
-                        else {
+                        WithCurrentSongImage { song, song_image ->
                             if (shouldHide() || !visible) {
-                                return@Box
+                                return@WithCurrentSongImage
                             }
 
-                            if (!hasContent() && base_configuration.hide_when_no_content) {
-                                return@Box
+                            if (!hasContent(song) && base_configuration.hide_when_no_content) {
+                                return@WithCurrentSongImage
                             }
-                        }
 
-                        GlanceBorderBox(
-                            base_configuration.border_radius_dp.dp,
-                            theme.theme.accent,
-                            GlanceModifier
-                                .fillMaxSize()
-                                .systemCornerRadius()
-                        ) {
-                            Column(
+                            GlanceBorderBox(
+                                base_configuration.border_radius_dp.dp,
+                                theme.theme.accent,
                                 GlanceModifier
                                     .fillMaxSize()
-                                    .thenIf(!custom_background) {
-                                        background(widget_background_colour)
-                                    }
                                     .systemCornerRadius()
                             ) {
-                                if (base_configuration.show_debug_information) {
-                                    DebugInfoItems(GlanceModifier)
-                                }
-
-                                Box(
-                                    GlanceModifier.fillMaxSize().defaultWeight(),
-                                    contentAlignment = Alignment.Center
+                                Column(
+                                    GlanceModifier
+                                        .fillMaxSize()
+                                        .thenIf(!custom_background) {
+                                            background(widget_background_colour)
+                                        }
+                                        .systemCornerRadius()
                                 ) {
-                                    WithCurrentSongImage { song, song_image ->
+                                    Box(
+                                        GlanceModifier.fillMaxSize().defaultWeight(),
+                                        contentAlignment = Alignment.Center
+                                    ) {
                                         Content(
                                             song, song_image, GlanceModifier.wrapContentSize(),
                                             PaddingValues(15.dp)
@@ -321,17 +311,11 @@ abstract class SpMpWidget<A: TypeWidgetClickAction, T: TypeWidgetConfig<A>>(
     )
 
     @Composable
-    protected open fun hasContent(): Boolean = true
+    protected open fun hasContent(song: Song?): Boolean = song != null
 
     @Composable
     protected open fun shouldHide(): Boolean = false
 
-    @Composable
-    protected open fun DebugInfoItems(item_modifier: GlanceModifier) {
-        WidgetText("ID: $widget_id", item_modifier)
-        WidgetText("Update: ${widget_type.getUpdateValue()}", item_modifier)
-    }
-
     @Composable
     fun WidgetText(
         text: String,
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/impl/LyricsWidget.kt` (modified, +1/-8)
```diff
@@ -53,18 +53,11 @@ internal abstract class LyricsWidget: SpMpWidget<LyricsWidgetClickAction, Lyrics
     }
 
     @Composable
-    override fun hasContent(): Boolean {
-        val song: Song? = LocalPlayerState.current.status.m_song
+    override fun hasContent(song: Song?): Boolean {
         lyrics_state = song?.let { SongLyricsLoader.rememberItemState(it, context) }
         return lyrics_state?.lyrics?.sync_type?.let { it != SongLyrics.SyncType.NONE } == true
     }
 
-    @Composable
-    override fun DebugInfoItems(item_modifier: GlanceModifier) {
-        super.DebugInfoItems(item_modifier)
-        WidgetText("Song: ${lyrics_state?.song} (${lyrics_state?.song?.observeActiveTitle()?.value})", item_modifier)
-    }
-
     @Composable
     final override fun Content(
         song: Song?,
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/impl/SongQueueWidget.kt` (modified, +0/-4)
```diff
@@ -32,10 +32,6 @@ internal class SongQueueWidget: SpMpWidget<SongQueueWidgetClickAction, SongQueue
             else -> throw IllegalStateException(action.toString())
         }
 
-    @Composable
-    override fun hasContent(): Boolean =
-        LocalPlayerState.current.status.m_song != null
-
     @Composable
     private fun Heading(text: String, modifier: GlanceModifier = GlanceModifier) {
         WidgetText(
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/widget/impl/SplitImageControlsWidget.kt` (modified, +0/-4)
```diff
@@ -58,10 +58,6 @@ internal class SplitImageControlsWidget: SpMpWidget<SplitImageControlsWidgetClic
             else -> throw IllegalStateException(action.toString())
         }
 
-    @Composable
-    override fun hasContent(): Boolean =
-        LocalPlayerState.current.status.m_song != null
-
     @Composable
     override fun Content(
         song: Song?,
```

**File**: `shared/src/commonMain/composeResources/values-ja-rJP/strings.xml` (modified, +0/-1)
```diff
@@ -1084,7 +1084,6 @@
     <string name="widget_config_common_key_border_radius">ボーダーの半径（dp）</string>
     <string name="widget_config_common_key_hide_when_no_content">コンテンツがないときは非表示</string>
     <string name="widget_config_common_key_show_app_icon">アプリのアイコンを表示</string>
-    <string name="widget_config_common_key_show_debug_information">デバッグ情報を表示</string>
     <string name="widget_config_common_key_click_action">タップアクション</string>
     <string name="widget_config_common_key_section_theme_opacity">不透明度</string>
     <string name="widget_config_common_option_section_theme_mode_background">バックグラウンド</string>
```

**File**: `shared/src/commonMain/composeResources/values/strings.xml` (modified, +0/-1)
```diff
@@ -1139,7 +1139,6 @@
     <string name="widget_config_common_key_border_radius">Border radius (dp)</string>
     <string name="widget_config_common_key_hide_when_no_content">Hide when no content</string>
     <string name="widget_config_common_key_show_app_icon">Show app icon</string>
-    <string name="widget_config_common_key_show_debug_information">Show debug information</string>
     <string name="widget_config_common_key_click_action">Tap action</string>
     <string name="widget_config_common_key_section_theme_opacity">Opacity</string>
     <string name="widget_config_common_option_section_theme_mode_background">Background</string>
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/widget/configuration/base/BaseWidgetConfig.kt` (modified, +1/-18)
```diff
@@ -7,7 +7,6 @@ import androidx.compose.runtime.getValue
 import androidx.compose.runtime.mutableIntStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.ui.Modifier
-import com.toasterofbread.spmp.ProjectBuildConfig
 import com.toasterofbread.spmp.model.settings.category.AccentColourSource
 import com.toasterofbread.spmp.model.settings.category.FontMode
 import com.toasterofbread.spmp.platform.AppContext
@@ -33,7 +32,6 @@ import spmp.shared.generated.resources.widget_config_common_key_font
 import spmp.shared.generated.resources.widget_config_common_key_font_size
 import spmp.shared.generated.resources.widget_config_common_key_hide_when_no_content
 import spmp.shared.generated.resources.widget_config_common_key_show_app_icon
-import spmp.shared.generated.resources.widget_config_common_key_show_debug_information
 import spmp.shared.generated.resources.widget_config_common_key_styled_border_mode
 import spmp.shared.generated.resources.widget_config_common_key_theme
 import spmp.shared.generated.resources.widget_config_common_option_accent_colour_source_app
@@ -56,8 +54,7 @@ data class BaseWidgetConfig(
     val styled_border_mode: WidgetStyledBorderMode = WidgetStyledBorderMode.WAVE,
     val border_radius_dp: Float = 0f,
     val hide_when_no_content: Boolean = false,
-    val show_app_icon: Boolean = true,
-    val show_debug_information: Boolean = ProjectBuildConfig.IS_DEBUG
+    val show_app_icon: Boolean = true
 ): WidgetConfig() {
     fun LazyListScope.ConfigItems(
         context: AppContext,
@@ -233,20 +230,6 @@ data class BaseWidgetConfig(
                 onItemChanged()
             }
         }
-        configItem(
-            defaults_mask?.show_debug_information,
-            item_modifier,
-            { onDefaultsMaskChanged(defaults_mask!!.copy(show_debug_information = it)) }
-        ) { modifier, onItemChanged ->
-            ToggleItem(
-                show_debug_information,
-                Res.string.widget_config_common_key_show_debug_information,
-                modifier
-            ) {
-                onChanged(copy(show_debug_information = it))
-                onItemChanged()
-            }
-        }
     }
 
     @Composable
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/widget/configuration/base/BaseWidgetConfigDefaultsMask.kt` (modified, +2/-4)
```diff
@@ -13,8 +13,7 @@ data class BaseWidgetConfigDefaultsMask(
     val styled_border_mode: Boolean = true,
     val border_radius_dp: Boolean = true,
     val hide_when_no_content: Boolean = true,
-    val show_app_icon: Boolean = true,
-    val show_debug_information: Boolean = true
+    val show_app_icon: Boolean = true
 ) {
     fun applyTo(config: BaseWidgetConfig, default: BaseWidgetConfig): BaseWidgetConfig =
         BaseWidgetConfig(
@@ -27,7 +26,6 @@ data class BaseWidgetConfigDefaultsMask(
             styled_border_mode = if (this.styled_border_mode) default.styled_border_mode else config.styled_border_mode,
             border_radius_dp = if (this.border_radius_dp) default.border_radius_dp else config.border_radius_dp,
             hide_when_no_content = if (this.hide_when_no_content) default.hide_when_no_content else config.hide_when_no_content,
-            show_app_icon = if (this.show_app_icon) default.show_app_icon else config.show_app_icon,
-            show_debug_information = if (this.show_debug_information) default.show_debug_information else config.show_debug_information,
+            show_app_icon = if (this.show_app_icon) default.show_app_icon else config.show_app_icon
         )
 }
\ No newline at end of file
```

---

### Incident Patch 7: `d5d25302` (2024-11-07)
**Commit Message**: Fix status bar colour not set correctly on app reopen

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/ui/layout/nowplaying/container/UpdateBarColours.kt` (modified, +6/-4)
```diff
@@ -21,10 +21,12 @@ internal fun UpdateBarColours(page_height: Dp) {
     val background_colour: Color = player.getNPBackground()
     val status_bar_height: Dp = WindowInsets.statusBars.getTop()
 
-    val status_bar_height_percent = (
-        status_bar_height.value * (if (player.context.isDisplayingAboveNavigationBar()) 1f else 0.75f)
-    ) / page_height.value
-    val under_status_bar by remember { derivedStateOf { 1f - expansion.get() < status_bar_height_percent } }
+    val status_bar_height_percent: Float =
+        (status_bar_height.value * (if (player.context.isDisplayingAboveNavigationBar()) 1f else 0.75f)) / page_height.value
+
+    val under_status_bar: Boolean by remember(status_bar_height) { derivedStateOf {
+        1f - expansion.get() < status_bar_height_percent
+    } }
 
     DisposableEffect(under_status_bar, background_colour) {
         player.bar_colour_state.status_bar.setLevelColour(
```

---

### Incident Patch 8: `95ac9ffe` (2024-11-01)
**Commit Message**: Add 'Hide' action to multiselect overflow menu

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/ui/component/multiselect/MultiSelectInfoDisplay.kt` (modified, +3/-1)
```diff
@@ -174,7 +174,9 @@ fun MediaItemMultiSelectContext.MultiSelectInfoDisplayContent(
                         Text(title_text)
                     },
                     text = {
-                        Column {
+                        Column(
+                            verticalArrangement = Arrangement.spacedBy(10.dp)
+                        ) {
                             MultiSelectOverflowActions(this@MultiSelectInfoDisplayContent, additionalSelectedItemActions)
                         }
                     }
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/ui/component/multiselect/MultiSelectOverflowActions.kt` (modified, +46/-12)
```diff
@@ -2,17 +2,35 @@ package com.toasterofbread.spmp.ui.component.multiselect_context
 
 import LocalPlayerState
 import androidx.compose.animation.AnimatedVisibility
-import androidx.compose.foundation.layout.*
+import androidx.compose.foundation.layout.ColumnScope
+import androidx.compose.foundation.layout.Row
+import androidx.compose.foundation.layout.height
+import androidx.compose.foundation.layout.padding
 import androidx.compose.material.icons.Icons
-import androidx.compose.material.icons.filled.*
-import androidx.compose.material3.*
-import androidx.compose.runtime.*
+import androidx.compose.material.icons.automirrored.filled.PlaylistAdd
+import androidx.compose.material.icons.filled.Close
+import androidx.compose.material.icons.filled.Done
+import androidx.compose.material.icons.filled.Download
+import androidx.compose.material.icons.filled.VisibilityOff
+import androidx.compose.material3.AlertDialog
+import androidx.compose.material3.Button
+import androidx.compose.material3.ButtonDefaults
+import androidx.compose.material3.Icon
+import androidx.compose.material3.IconButtonDefaults
+import androidx.compose.material3.MaterialTheme
+import androidx.compose.material3.Text
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.derivedStateOf
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateListOf
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.rememberCoroutineScope
+import androidx.compose.runtime.setValue
 import androidx.compose.runtime.snapshots.SnapshotStateList
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.unit.dp
-import dev.toastbits.composekit.platform.vibrateShort
-import dev.toastbits.composekit.utils.composable.PlatformClickableButton
-import dev.toastbits.composekit.utils.composable.ShapedIconButton
+import com.toasterofbread.spmp.model.mediaitem.MediaItem
 import com.toasterofbread.spmp.model.mediaitem.library.MediaItemLibrary
 import com.toasterofbread.spmp.model.mediaitem.library.createLocalPlaylist
 import com.toasterofbread.spmp.model.mediaitem.playlist.InteractivePlaylistEditor
@@ -23,21 +41,24 @@ import com.toasterofbread.spmp.model.mediaitem.song.Song
 import com.toasterofbread.spmp.platform.download.DownloadStatus
 import com.toasterofbread.spmp.platform.download.rememberSongDownloads
 import com.toasterofbread.spmp.platform.getOrNotify
+import com.toasterofbread.spmp.service.playercontroller.PlayerState
 import com.toasterofbread.spmp.ui.component.multiselect.MediaItemMultiSelectContext
 import com.toasterofbread.spmp.ui.layout.PlaylistSelectMenu
-import com.toasterofbread.spmp.service.playercontroller.PlayerState
+import dev.toastbits.composekit.platform.vibrateShort
 import dev.toastbits.composekit.settings.ui.on_accent
+import dev.toastbits.composekit.utils.composable.PlatformClickableButton
+import dev.toastbits.composekit.utils.composable.ShapedIconButton
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.NonCancellable
 import kotlinx.coroutines.launch
 import org.jetbrains.compose.resources.getString
 import org.jetbrains.compose.resources.stringResource
 import spmp.shared.generated.resources.Res
-import spmp.shared.generated.resources.song_add_to_playlist
 import spmp.shared.generated.resources.lpm_action_download
-import spmp.shared.generated.resources.toast_playlist_added
+import spmp.shared.generated.resources.lpm_action_hide
 import spmp.shared.generated.resources.playlist_create
 import spmp.shared.generated.resources.song_add_to_playlist
+import spmp.shared.generated.resources.toast_playlist_added
 
 @Composable
 internal fun ColumnScope.MultiSelectOverflowActions(
@@ -75,11 +96,24 @@ internal fun ColumnScope.MultiSelectOverflowActions(
         Button({
             adding_to_playlist = multiselect_context.getUniqueSelectedItems().filterIsInstance<Song>()
         }) {
-            Icon(Icons.Default.PlaylistAdd, null)
+            Icon(Icons.AutoMirrored.Filled.PlaylistAdd, null, Modifier.padding(end = 5.dp))
             Text(stringResource(Res.string.song_add_to_playlist))
         }
     }
 
+    // Hide
+    Button({
+        player.database.transaction {
+            for (item in multiselect_context.getUniqueSelectedItems().filterIsInstance<MediaItem>()) {
+                item.Hidden.set(true, player.database)
+            }
+        }
+        multiselect_context.onActionPerformed()
+    }) {
+        Icon(Icons.Default.VisibilityOff, null, Modifier.padding(end = 5.dp))
+        Text(stringResource(Res.string.lpm_action_hide))
+    }
+
     // Download
     AnimatedVisibility(any_are_downloadable) {
         PlatformClickableButton(
@@ -95,7 +129,7 @@ internal fun ColumnScope.MultiSelectOverflowActions(
                 player.context.vibrateShort()
             }
         ) {
-            Icon(Icons.Default.Download, null)
+            Icon(Icons.Default.Download, null, Modifier.padding(e
```

---

### Incident Patch 9: `46bcdc22` (2024-10-31)
**Commit Message**: Fix existing songs not skipped when starting radio from player

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/platform/playerservice/PlayerServicePlayer.kt` (modified, +0/-1)
```diff
@@ -323,7 +323,6 @@ abstract class PlayerServicePlayer(internal val service: PlayerService) {
                         },
                         onSuccessfulLoad = onSuccessfulLoad,
                         insertion_index = index,
-                        skip_existing = false,
                         clear_after = true
                     )
                 }
```

---

### Incident Patch 10: `5ef7c57d` (2024-10-31)
**Commit Message**: Fix queue clear, shuffle, and artist button appearances

**File**: `buildSrc/src/main/kotlin/plugins/spmp/Dependencies.kt` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ class SpMpDeps(extra: Map<String, Any>) {
                 license_url = "https://github.com/toasterofbread/spmp-server/blob/6dde651ffc102d604ac7ecd5ac7471b1572fd2e6/LICENSE"
             ),
             "dev.toastbits.composekit" to DependencyInfo(
-                version = "76ef6d1ac7",
+                version = "d4a289335a",
                 name = "ComposeKit",
                 author = "toasterofbread",
                 url = "https://github.com/toasterofbread/composekit",
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/ui/layout/nowplaying/queue/CurrentRadioIndicator.kt` (modified, +13/-3)
```diff
@@ -131,7 +131,13 @@ internal fun CurrentRadioIndicator(
 }
 
 @Composable
-private fun RadioFilterChip(selected: Boolean, getAccentColour: () -> Color, onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
+private fun RadioFilterChip(
+    selected: Boolean,
+    getAccentColour: () -> Color,
+    onClick: () -> Unit,
+    modifier: Modifier = Modifier,
+    content: @Composable () -> Unit
+) {
     FilterChip(
         selected,
         modifier = modifier.height(32.dp),
@@ -175,9 +181,13 @@ private fun FiltersRow(
                         radio.setRadioFilter(-1)
                     }
                 },
-                modifier = Modifier.width(48.dp)
+                modifier = Modifier.width(40.dp)
             ) {
-                Icon(MediaItemType.ARTIST.getIcon(), null, Modifier.offset(x = (-4).dp))
+                Icon(
+                    MediaItemType.ARTIST.getIcon(),
+                    null,
+                    Modifier.requiredSize(18.dp)
+                )
             }
         }
 
```

---

### Incident Patch 11: `60bb637e` (2024-10-30)
**Commit Message**: Fix notification seek position not updating on some transitions

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/PlatformExternalPlayerService.android.kt` (modified, +0/-1)
```diff
@@ -109,7 +109,6 @@ actual class PlatformExternalPlayerService: ForegroundPlayerService(play_when_re
             }
 
             override fun seekTo(index: Int, position_ms: Long) {
-                println("PROXY SEEK $index $position_ms")
                 server.seekToSong(index)
                 server.seekTo(position_ms)
             }
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/notification/NotificationState.kt` (modified, +2/-1)
```diff
@@ -7,5 +7,6 @@ data class NotificationState(
     val playback_state: Int? = PlaybackState.STATE_NONE,
     val paused: Boolean = true,
     val current_liked_status: SongLikedStatus? = null,
-    val authenticated: Boolean = false
+    val authenticated: Boolean = false,
+    val position_ms: Long? = null
 )
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/notification/NotificationStateManager.kt` (modified, +6/-7)
```diff
@@ -14,10 +14,7 @@ import kotlinx.coroutines.Job
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.withContext
 
-class NotificationStateManager(
-    private val media_session: MediaSession,
-    private val player: Player
-) {
+class NotificationStateManager(private val media_session: MediaSession) {
     var current: NotificationState = NotificationState()
         private set
 
@@ -27,14 +24,16 @@ class NotificationStateManager(
         playback_state: Int? = current.playback_state,
         paused: Boolean = current.paused,
         current_liked_status: SongLikedStatus? = current.current_liked_status,
-        authenticated: Boolean = current.authenticated
+        authenticated: Boolean = current.authenticated,
+        position_ms: Long? = current.position_ms
     ) {
         val new_state: NotificationState =
             NotificationState(
                 playback_state,
                 paused,
                 current_liked_status,
-                authenticated
+                authenticated,
+                position_ms
             )
 
         if (new_state == current) {
@@ -58,7 +57,7 @@ class NotificationStateManager(
         state_builder.setState(
             playback_state
                 ?: if (paused) PlaybackState.STATE_PAUSED else PlaybackState.STATE_PLAYING,
-            player.currentPosition,
+            position_ms ?: 0,
             if (paused) 0f else 1f,
             SystemClock.elapsedRealtime()
         )
```

**File**: `shared/src/androidMain/kotlin/com/toasterofbread/spmp/platform/playerservice/notification/PlayerServiceNotificationManager.kt` (modified, +14/-3)
```diff
@@ -43,15 +43,15 @@ class PlayerServiceNotificationManager(
     private val media_session: MediaSession,
     private val notification_manager: NotificationManager,
     private val service: ForegroundPlayerService,
-    player: Player
+    private val player: Player
 ) {
     private var current_song: Song? = null
     private val thumbnail_load_scope: CoroutineScope = CoroutineScope(Job())
     private val auth_state_observe_scope: CoroutineScope = CoroutineScope(Job())
     private val song_liked_load_scope: CoroutineScope = CoroutineScope(Job())
 
     private val metadata_builder: MediaMetadata.Builder = MediaMetadata.Builder()
-    private val state: NotificationStateManager = NotificationStateManager(media_session, player)
+    private val state: NotificationStateManager = NotificationStateManager(media_session)
 
     private val notification_listener: PlayerNotificationManager.NotificationListener =
         object : PlayerNotificationManager.NotificationListener {
@@ -85,7 +85,10 @@ class PlayerServiceNotificationManager(
                 }
 
                 current_song = song
-                state.update(current_liked_status = song?.Liked?.get(context.database))
+                state.update(
+                    current_liked_status = song?.Liked?.get(context.database),
+                    position_ms = player.currentPosition
+                )
 
                 if (song != null) {
                     context.database.songQueries.likedById(song.id).addListener(song_liked_listener)
@@ -102,10 +105,18 @@ class PlayerServiceNotificationManager(
                 }
             }
 
+            override fun onSeeked(position_ms: Long) {
+                state.update(position_ms = position_ms)
+            }
+
             override fun onPlayingChanged(is_playing: Boolean) {
                 state.update(paused = !is_playing)
             }
 
+            override fun onEvents() {
+                state.update(position_ms = player.currentPosition)
+            }
+
             override fun onStateChanged(state: SpMsPlayerState) {
                 this@PlayerServiceNotificationManager.state.update(
                     playback_state =
```

---

### Incident Patch 12: `7baf6ca7` (2024-10-25)
**Commit Message**: Only send Discord webhook on main branch build

**File**: `.github/workflows/build-android.yml` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ jobs:
       uses: discord-actions/message@v2
       env:
         BUILD_NOTIFICATION_DISCORD_WEBHOOK: ${{ secrets.BUILD_NOTIFICATION_DISCORD_WEBHOOK }}
-      if: env.BUILD_NOTIFICATION_DISCORD_WEBHOOK != null && github.event_name != 'pull_request'
+      if: env.BUILD_NOTIFICATION_DISCORD_WEBHOOK != null && github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
       with:
         webhookUrl: ${{ secrets.BUILD_NOTIFICATION_DISCORD_WEBHOOK }}
         message: "${{ github.workflow }} [build](<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}>) completed for commit - [${{ env.COMMIT_SHA }}](<${{ github.event.head_commit.url }}>) ${{ github.event.head_commit.message }} - [Downloads](https://nightly.link/${{ github.repository }}/actions/runs/${{ github.run_id }})"
```

---

### Incident Patch 13: `ed02270c` (2024-10-24)
**Commit Message**: Fix Android release build

**File**: `androidApp/proguard-rules.pro` (modified, +6/-0)
```diff
@@ -42,6 +42,12 @@
 # Ktor
 -dontwarn io.ktor.**
 
+-dontwarn java.beans.BeanDescriptor
+-dontwarn java.beans.BeanInfo
+-dontwarn java.beans.IntrospectionException
+-dontwarn java.beans.Introspector
+-dontwarn java.beans.PropertyDescriptor
+
 # From proguard-android-optimize.txt
 
 -optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
```

---

### Incident Patch 14: `259b834c` (2024-10-23)
**Commit Message**: Fix crash when setting layout bar background colour

**File**: `shared/src/commonMain/composeResources/values-ja-rJP/strings.xml` (modified, +3/-0)
```diff
@@ -928,6 +928,9 @@
     <string name="theme_colour_accent">アクセント</string>
     <string name="theme_colour_vibrant_accent">明るいアクセント</string>
     <string name="theme_colour_card">カード</string>
+    <string name="theme_colour_on_background">背景の上</string>
+    <string name="theme_colour_on_accent">アクセントの上</string>
+    <string name="theme_colour_error">エラー</string>
 
     <string name="shortcut_trigger_none">なし</string>
     <string name="shortcut_trigger_keyboard">キーボード</string>
```

**File**: `shared/src/commonMain/composeResources/values/strings.xml` (modified, +3/-0)
```diff
@@ -983,6 +983,9 @@
     <string name="theme_colour_accent">Accent</string>
     <string name="theme_colour_vibrant_accent">Vibrant accent</string>
     <string name="theme_colour_card">Card</string>
+    <string name="theme_colour_on_background">On background</string>
+    <string name="theme_colour_on_accent">On accent</string>
+    <string name="theme_colour_error">Error</string>
 
     <string name="shortcut_trigger_none">None</string>
     <string name="shortcut_trigger_keyboard">Keyboard</string>
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/ui/component/ColourSelectionDialog.kt` (modified, +6/-1)
```diff
@@ -55,6 +55,9 @@ import spmp.shared.generated.resources.theme_colour_background
 import spmp.shared.generated.resources.theme_colour_accent
 import spmp.shared.generated.resources.theme_colour_vibrant_accent
 import spmp.shared.generated.resources.theme_colour_card
+import spmp.shared.generated.resources.theme_colour_on_background
+import spmp.shared.generated.resources.theme_colour_on_accent
+import spmp.shared.generated.resources.theme_colour_error
 
 @Composable
 fun ColourSelectionDialog(
@@ -209,5 +212,7 @@ fun ThemeValues.Colour.getReadable(): String =
         ThemeValues.Colour.ACCENT -> stringResource(Res.string.theme_colour_accent)
         ThemeValues.Colour.VIBRANT_ACCENT -> stringResource(Res.string.theme_colour_vibrant_accent)
         ThemeValues.Colour.CARD -> stringResource(Res.string.theme_colour_card)
-        else -> throw NotImplementedError(this.toString())
+        ThemeValues.Colour.ON_BACKGROUND -> stringResource(Res.string.theme_colour_on_background)
+        ThemeValues.Colour.ON_ACCENT -> stringResource(Res.string.theme_colour_on_accent)
+        ThemeValues.Colour.ERROR -> stringResource(Res.string.theme_colour_error)
     }
```

---

### Incident Patch 15: `279cb53c` (2024-10-22)
**Commit Message**: Fix ytm auth state not initialising to null

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/model/settings/PackUserAuthState.kt` (modified, +5/-1)
```diff
@@ -30,7 +30,11 @@ fun ApiAuthenticationState.Companion.packSetData(
 fun ApiAuthenticationState.Companion.unpackSetData(
     set: Set<String>,
     context: AppContext
-): Pair<String?, Headers> {
+): Pair<String?, Headers>? {
+    if (set.isEmpty()) {
+        return null
+    }
+
     var own_channel_id: String? = null
     val headers_builder: HeadersBuilder = HeadersBuilder()
 
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/platform/playerservice/SpMsPlayerService.kt` (modified, +1/-1)
```diff
@@ -517,7 +517,7 @@ abstract class SpMsPlayerService(val plays_audio: Boolean): PlatformServiceImpl(
                 ApiAuthenticationState.unpackSetData(
                     context.settings.youtube_auth.YTM_AUTH.get(),
                     context
-                ).takeIf { it.first != null }
+                ).takeIf { it?.first != null }
             sendAuthInfoToPlayers(ytm_auth)
         }
     }
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/ui/layout/apppage/settingspage/YtmAuthItem.kt` (modified, +2/-2)
```diff
@@ -115,8 +115,8 @@ fun getYtmAuthItem(context: AppContext, ytm_auth: PreferencesProperty<Set<String
 //            }
 
             val auth: Set<String> by ytm_auth.observe()
-            val data: Pair<String?, Headers> = ApiAuthenticationState.unpackSetData(auth, context)
-            if (data.first != null) {
+            val data: Pair<String?, Headers>? = ApiAuthenticationState.unpackSetData(auth, context)
+            if (data?.first != null) {
                 own_channel = ArtistRef(data.first!!)
             }
 
```

**File**: `shared/src/commonMain/kotlin/com/toasterofbread/spmp/youtubeapi/SpMpYoutubeiApi.kt` (modified, +5/-4)
```diff
@@ -81,10 +81,11 @@ internal class SpMpYoutubeiApi(
         }
     }
 
-    private suspend fun getCurrentUserAuthState() =
-        ApiAuthenticationState.unpackSetData(context.settings.youtube_auth.YTM_AUTH.get(), context).let { data ->
-            SpMpYoutubeiAuthenticationState(context.database, this, data.first, data.second)
-        }
+    private suspend fun getCurrentUserAuthState(): SpMpYoutubeiAuthenticationState? =
+        ApiAuthenticationState.unpackSetData(context.settings.youtube_auth.YTM_AUTH.get(), context)
+            ?.let { data ->
+                SpMpYoutubeiAuthenticationState(context.database, this, data.first, data.second)
+            }
 
     // // -- User auth ---
     // override val YoutubeChannelCreationForm = YTMYoutubeChannelCreationFormEndpoint(this)
```

#### Recent Merged Pull Requests:
- **PR #454** (closed): hm (@nfw64)
- **PR #435** (closed): Rewrite download service (@sayaka-sh)
- **PR #421** (2024-12-22): Allow audio capture for screen recorders on Android (@kairusds)
- **PR #415** (2025-01-29): Update to new ComposeKit (@sayaka-sh)
- **PR #391** (2024-10-27): Upload binaries to nightly release (@sayaka-sh)
- **PR #386** (2024-11-06): Add Android widgets (@sayaka-sh)
- **PR #370** (2024-09-04): Add Lrclib lyrics provider (@spl3g)
- **PR #369** (closed): WIP: Add lrclib lyrics provider (@spl3g)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
