> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crosspaste-crosspaste-desktop-learnings.md`  
> **Source**: github ([https://github.com/CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop))  
> **Source Version**: `36683ed7`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T14:25:15.769Z  
> **Learning ID**: `learn-github-crosspaste-crosspaste-desktop`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): CrossPaste/crosspaste-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/crosspaste-crosspaste-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T14:25:15.761Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CrossPaste/crosspaste-desktop`
- **Description**: Cross-device clipboard sync for macOS, Windows & Linux — end-to-end encrypted, LAN-only, no cloud. OCR, CLI and MCP server built in.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2661 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/app/AppLaunchState.kt`
```
package com.crosspaste.app

interface AppLaunchState {

    val acquiredLock: Boolean

    val firstLaunch: Boolean
}

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/app/AppLockState.kt`
```
package com.crosspaste.app

interface AppLockState {

    val acquiredLock: Boolean

    val firstLaunch: Boolean
}

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/app/GeneralAppLockState.kt`
```
package com.crosspaste.app

class GeneralAppLockState(
    override val acquiredLock: Boolean,
    override val firstLaunch: Boolean,
) : AppLockState

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/net/NetworkStateMonitor.kt`
```
package com.crosspaste.net

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow

/**
 * Observes real OS network state so the discovery layer can self-heal.
 *
 * The JVM exposes no callback for interface up/down, IP changes, or reachability,
 * so platform implementations bridge native events (e.g. macOS `NWPathMonitor`,
 * Windows IP Helper / Network List Manager, Linux RTNETLINK) into [networkChanges].
 *
 * Each emission means "something about the network changed" — it carries no payload;
 * consumers re-read the current interface snapshot themselves. Emissions may be
 * coalesced/debounced by the implementation or the consumer.
 */
interface NetworkStateMonitor {

    val networkChanges: Flow<Unit>

    fun start()

    fun stop()
}

/**
 * Fallback for platforms without a native monitor yet. Never emits, so the
 * discovery layer behaves exactly as it did before [NetworkStateMonitor] existed
 * (config-driven only).
 */
class NoopNetworkStateMonitor : NetworkStateMonitor {

    override val networkChanges: Flow<Unit> = emptyFlow()

    override fun start() {}

    override fun stop() {}
}

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/pairing/v3/PairingSessionState.kt`
```
package com.crosspaste.pairing.v3

enum class PairingSessionState {
    INTENT_RECEIVED,
    PIN_AVAILABLE,
    PAKE_NEGOTIATING,
    PEER_CONFIRMED,
    COMMITTING,
    TRUSTED,
    REJECTED,
    CANCELLED,
    EXPIRED,
    FAILED,
    ;

    val isTerminal: Boolean
        get() =
            when (this) {
                TRUSTED, REJECTED, CANCELLED, EXPIRED, FAILED -> true
                else -> false
            }

    /**
     * The explicit legal transition graph. Terminal states are absorbing.
     * TRUSTED is reachable only from COMMITTING — there is no shortcut that
     * skips PAKE, mutual confirmation, and the authenticated commit.
     */
    fun successors(): Set<PairingSessionState> =
        when (this) {
            INTENT_RECEIVED -> setOf(PIN_AVAILABLE) + ABORT_STATES
            PIN_AVAILABLE -> setOf(PAKE_NEGOTIATING) + ABORT_STATES
            PAKE_NEGOTIATING -> setOf(PIN_AVAILABLE, PEER_CONFIRMED) + ABORT_STATES
            PEER_CONFIRMED -> setOf(COMMITTING) + ABORT_STATES
            COMMITTING -> setOf(TRUSTED) + ABORT_STATES
            TRUSTED, REJECTED, CANCELLED, EXPIRED, FAILED -> emptySet()
        }

    /** Same-state updates (data-only) are legal for non-terminal states. */
    fun canTransitionTo(next: PairingSessionState): Boolean =
        if (next == this) {
            !isTerminal
        } else {
            next in successors()
        }

    companion object {
        /** Failure/abort exits available from every non-terminal state. */
        val ABORT_STATES: Set<PairingSessionState> = setOf(REJECTED, CANCELLED, EXPIRED, FAILED)
    }
}

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/rendering/OpenGraphService.kt`
```
package com.crosspaste.rendering

import com.crosspaste.config.CommonConfigManager
import com.crosspaste.db.paste.PasteDao
import com.crosspaste.image.GenerateImageService
import com.crosspaste.image.ImageHandler
import com.crosspaste.net.ClientResponse
import com.crosspaste.net.ResourceRequestLimits
import com.crosspaste.net.ResourcesClient
import com.crosspaste.paste.PasteData
import com.crosspaste.paste.item.UpdatePasteItemHelper
import com.crosspaste.paste.item.UrlPasteItem
import com.crosspaste.paste.item.clearRenderingFiles
import com.crosspaste.paste.item.getLegacyRenderingFilePath
import com.crosspaste.paste.item.getRenderingFilePath
import com.crosspaste.path.UserDataPathProvider
import com.crosspaste.utils.getFileUtils
import com.crosspaste.utils.getUrlUtils
import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.Document
import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.ContentType
import io.ktor.utils.io.toByteArray
import okio.Path

class OpenGraphService<Image>(
    private val configManager: CommonConfigManager,
    private val generateImageService: GenerateImageService,
    private val imageHandler: ImageHandler<Image>,
    private val resourcesClient: ResourcesClient,
    private val updatePasteItemHelper: UpdatePasteItemHelper,
    private val userDataPathProvider: UserDataPathProvider,
    private val pasteDao: PasteDao,
) : RenderingService<String> {

    private val logger = KotlinLogging.logger {}

    private val fileUtils = getFileUtils()

    private val urlUtils = getUrlUtils()

    override suspend fun render(pasteData: PasteData) {
        if (!configManager.getCurrentConfig().enableUrlPreview) {
            return
        }
        pasteData.getPasteItem(UrlPasteItem::class)?.let { urlPasteItem ->
            if (!urlUtils.isHttpUrl(urlPasteItem.url)) {
                return
            }
            val openGraphImage =
                urlPasteItem.getRenderingFilePath(
                    pasteData.getPasteCoordinate(),
                    userDataPathProvider,
                )

            if (fileUtils.existFile(openGraphImage)) {
                logger.info { "Open graph image file exists" }
            } else {
                resourcesClient.request(urlPasteItem.url, ResourceRequestLimits.HTML).onSuccess { response ->
                    response.getContentType()?.let { contentType ->
                        if (contentType.match(ContentType.Text.Html) ||
                            contentType.match(ContentType.Application.Xml)
                        ) {
                            parserHtml(
                                openGraphImage,
                                pasteData,
                                urlPasteItem,
                                response,
                            )
                        }
                    }
                }
            }
        }
    }

    private suspend fun parserHtml(
        openGraphImage: Path,
        pasteData: PasteData,
        urlPasteItem: UrlPasteItem,
        response: ClientResponse,
    ) {
        val bytes = response.getBody().toByteArray()
        val html = bytes.decodeToString()
        val doc = Ksoup.parse(html)

        val htmlTitle =
            sequenceOf(
                { doc.select("meta[property=og:title]").firstOrNull()?.attr("content") },
                { doc.select("meta[name=og:title]").firstOrNull()?.attr("content") },
                { doc.select("meta[name=twitter:title]").firstOrNull()?.attr("content") },
                { doc.select("meta[property=twitter:title]").firstOrNull()?.attr("content") },
                { doc.select("title").firstOrNull()?.text() },
                { doc.select("meta[name=title]").firstOrNull()?.attr("content") },
                { doc.select("meta[itemprop=name]").firstOrNull()?.attr("content") },
                { doc.select("h1").firstOrNull()?.text() },
            ).mapNotNull { it() }.firstOrNull { it.isNotBlank() }

        htmlTitle?.let { title ->
            updatePasteItemHelper.updateTitle(
                pasteData,
                title,
                urlPasteItem,
            )
        }

        val ogImage =
            sequenceOf(
                // 1. Open Graph Protocol (most common)
                { doc.select("meta[property=og:image]").firstOrNull()?.attr("content") },
                { doc.select("meta[property=og:image:url]").firstOrNull()?.attr("content") },
                { doc.select("meta[property=og:image:secure_url]").firstOrNull()?.attr("content") },
                // 2. Twitter Card
                { doc.select("meta[name=twitter:image]").firstOrNull()?.attr("content") },
                { doc.select("meta[property=twitter:image]").firstOrNull()?.attr("content") },
                { doc.select("meta[name=twitter:image:src]").firstOrNull()?.attr("content") },
                // 3. Schema.org / JSON-LD
                { extractFromJsonLd(doc) },
                // 4. Standard HTML <meta> tags
                { doc.select("meta[name=image]").firstOrNull()?.attr("content") },
                { doc.select("meta[itemprop=image]").firstOrNull()?.attr("content") },
                { doc.select("meta[name=thumbnail]").firstOrNull()?.attr("content") },
                { doc.select("meta[name=thumbnailUrl]").firstOrNull()?.attr("content") },
                // 5. <link> tags
                { doc.select("link[rel=image_src]").firstOrNull()?.attr("href") },
                { doc.select("link[rel=apple-touch-icon]").firstOrNull()?.attr("href") },
                {
                    doc
                        .select("link[rel=icon]")
                        .firstOrNull {
                            it.attr("sizes").contains("192") || it.attr("sizes").contains("512")
                        }?.attr("href")
                },
                // 6. Article-specific selectors
                { doc.select("article img").firstOrNull()?.attr("src") },
                { doc.select("main img").firstOrNull()?.attr("src") },
                { doc.select(".post img").firstOrNull()?.attr("src") },
                { doc.select(".content img").firstOrNull()?.attr("src") },
                // 7. Common hero/banner images
                { doc.select(".hero img").firstOrNull()?.attr("src") },
                { doc.select(".banner img").firstOrNull()?.attr("src") },
                { doc.select("header img").firstOrNull()?.attr("src") },
                // 8. The largest image on the page (final fallback)
                { findLargestImage(doc) },
            ).mapNotNull { it() }.firstOrNull { urlUtils.isHttpUrl(it) }

        ogImage?.let { imageUrl ->
            resourcesClient.request(imageUrl, ResourceRequestLimits.IMAGE).onSuccess { imageResponse ->
                imageHandler.readImage(imageResponse.getBody())?.also { image ->
                    if (imageHandler.writeImage(image, "png", openGraphImage)) {
                        val currentUrlItem =
                            pasteDao
                                .getNoDeletePasteData(pasteData.id)
                                ?.pasteAppearItem as? UrlPasteItem
                        if (currentUrlItem?.url == urlPasteItem.url) {
                            generateImageService.markGenerationComplete(openGraphImage)
                            deleteLegacyRenderingFile(pasteData, urlPasteItem)
                        } else {
                            urlPasteItem.clearRenderingFiles(
                                pasteCoordinate = pasteData.getPasteCoordinate(),
                                userDataPathProvider = userDataPathProvider,
                            )
                        }
                    }
                }
            }
        } ?: run {
            logger.warn { "No Open Graph image found for URL: ${urlPasteItem.url}" }
        }
    }

    private fun deleteLegacyRenderingFile(
        pasteData: PasteData,
        urlPasteItem: UrlPasteItem,
    ) {
        if (urlPasteItem.getMarketingPath() != null) return

        val legacyPath =
            urlPasteItem.getLegacyRenderingFilePath(
                pasteCoordinate = pasteData.getPasteCoordinate(),
                userDataPathProvider = userDataPathProvider,
            )
        if (fileUtils.existFile(legacyPath)) {
            fileUtils.deleteFile(legacyPath)
        }
    }

    private fun extractFromJsonLd(doc: Document): String? {
        val jsonLdScripts = doc.select("script[type=application/ld+json]")

        for (script in jsonLdScripts) {
            runCatching {
                val json = script.data()
                val match = JSON_LD_IMAGE_PATTERN.find(json)
                if (match != null) {
                    return match.groupValues[1]
                }
            }
        }
        return null
    }

    companion object {
        private val JSON_LD_IMAGE_PATTERN = """"image"\s*:\s*"([^"]+)"""".toRegex()
    }

    private fun findLargestImage(doc: Document): String? =
        doc
            .select("img[src]")
            .filter { img ->
                val src = img.attr("src")
                urlUtils.isHttpUrl(src) &&
                    !src.contains("pixel") &&
                    !src.contains("tracking") &&
                    !src.contains("1x1") &&
                    !src.endsWith(".gif")
            }.maxByOrNull { img ->
                val width = img.attr("width").toIntOrNull() ?: 0
                val height = img.attr("height").toIntOrNull() ?: 0
                width * height
            }?.attr("src")

    override fun start() {
    }

    override fun stop() {
    }
}

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/rendering/RenderingService.kt`
```
package com.crosspaste.rendering

import com.crosspaste.paste.PasteData

interface RenderingService<T> {

    suspend fun render(pasteData: PasteData)

    fun start()

    fun stop()

    fun restart() {
        stop()
        start()
    }
}

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/ui/base/KeyboardUtils.kt`
```
package com.crosspaste.ui.base

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.input.ImeAction

@Composable
expect fun numberKeyboardOptions(imeAction: ImeAction = ImeAction.Default): KeyboardOptions

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/ui/base/StateTagView.kt`
```
package com.crosspaste.ui.base

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.crosspaste.i18n.GlobalCopywriter
import com.crosspaste.ui.theme.AppUISize.small
import com.crosspaste.ui.theme.AppUISize.small3X
import com.crosspaste.ui.theme.AppUISize.tiny3X
import com.crosspaste.ui.theme.AppUISize.tinyRoundedCornerShape
import com.crosspaste.ui.theme.AppUISize.xLarge
import org.koin.compose.koinInject

data class StateTagStyle(
    val label: String,
    val labelUppercase: Boolean = true,
    val containerColor: Color,
    val contentColor: Color,
    val icon: ImageVector,
)

@Composable
fun StateTagView(style: StateTagStyle) {
    val copywriter = koinInject<GlobalCopywriter>()
    Surface(
        color = style.containerColor,
        shape = tinyRoundedCornerShape,
        shadowElevation = 1.5.dp,
    ) {
        Row(
            modifier =
                Modifier
                    .height(xLarge)
                    .padding(horizontal = small3X),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(tiny3X),
        ) {
            Icon(
                imageVector = style.icon,
                contentDescription = null,
                modifier = Modifier.size(small),
                tint = style.contentColor,
            )

            val label =
                if (style.labelUppercase) {
                    copywriter.getText(style.label).uppercase()
                } else {
                    copywriter.getText(style.label)
                }

            Text(
                text = label,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                softWrap = false,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                color = style.contentColor,
            )
        }
    }
}

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/ui/devices/DeviceStateView.kt`
```
package com.crosspaste.ui.devices

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import com.composables.icons.materialsymbols.MaterialSymbols
import com.composables.icons.materialsymbols.rounded.Arrow_back
import com.composables.icons.materialsymbols.rounded.Arrow_forward
import com.composables.icons.materialsymbols.rounded.Autorenew
import com.composables.icons.materialsymbols.rounded.Close
import com.composables.icons.materialsymbols.rounded.Link_off
import com.composables.icons.materialsymbols.rounded.Pause
import com.composables.icons.materialsymbols.rounded.Shield
import com.composables.icons.materialsymbols.rounded.Sync_alt
import com.composables.icons.materialsymbols.rounded.Warning
import com.crosspaste.db.sync.SyncState
import com.crosspaste.ui.LocalThemeExtState
import com.crosspaste.ui.base.StateTagStyle
import com.crosspaste.ui.base.StateTagView
import com.crosspaste.utils.DateUtils
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

val syncedStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_synced",
            containerColor = LocalThemeExtState.current.success.container,
            contentColor = LocalThemeExtState.current.success.onContainer,
            icon = MaterialSymbols.Rounded.Sync_alt,
        )

val outgoingOnlyStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_outgoing_only",
            containerColor = LocalThemeExtState.current.info.container,
            contentColor = LocalThemeExtState.current.info.onContainer,
            icon = MaterialSymbols.Rounded.Arrow_forward,
        )

val incomingOnlyStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_incoming_only",
            containerColor = LocalThemeExtState.current.info.container,
            contentColor = LocalThemeExtState.current.info.onContainer,
            icon = MaterialSymbols.Rounded.Arrow_back,
        )

val pauseSyncStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_paused",
            containerColor = LocalThemeExtState.current.neutral.container,
            contentColor = LocalThemeExtState.current.neutral.onContainer,
            icon = MaterialSymbols.Rounded.Pause,
        )

/**
 * Solid primary, like the nearby-search progress ring and the header refresh
 * icon: "in progress" reads as active. A neutral container sits too close to
 * the row background in both themes, so a neutral tag and button would vanish
 * into the row and look disabled while connecting.
 */
val connectingStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_connecting",
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            icon = MaterialSymbols.Rounded.Autorenew,
        )

val disconnectedStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_disconnected",
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer,
            icon = MaterialSymbols.Rounded.Link_off,
        )

val unmatchedStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_unmatched",
            containerColor = LocalThemeExtState.current.warning.container,
            contentColor = LocalThemeExtState.current.warning.onContainer,
            icon = MaterialSymbols.Rounded.Warning,
        )

val unverifiedStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_unverified",
            containerColor = LocalThemeExtState.current.warning.container,
            contentColor = LocalThemeExtState.current.warning.onContainer,
            icon = MaterialSymbols.Rounded.Shield,
        )

val incompatibleStateStyle
    @Composable @ReadOnlyComposable
    get() =
        StateTagStyle(
            label = "sync_status_incompatible",
            containerColor = MaterialTheme.colorScheme.error,
            contentColor = MaterialTheme.colorScheme.onError,
            icon = MaterialSymbols.Rounded.Close,
        )

/**
 * Everything the list row and the detail header derive from a device's connect
 * state: the platform icon tint, the status tag, and the action button colors.
 * Kept in one mapping so the three never disagree on a state. A manual refresh
 * is shown exactly like an automatic reconnect: both are "connecting".
 */
class SyncStateVisual(
    val iconColor: Color,
    val tag: StateTagStyle,
)

@Composable
@ReadOnlyComposable
fun DeviceScope.syncStateVisual(connecting: Boolean = false): SyncStateVisual {
    val themeExt = LocalThemeExtState.current
    if (connecting) {
        return SyncStateVisual(MaterialTheme.colorScheme.primary, connectingStateStyle)
    }
    return when (syncRuntimeInfo.connectState) {
        SyncState.CONNECTED ->
            when {
                syncRuntimeInfo.allowSend && syncRuntimeInfo.allowReceive ->
                    SyncStateVisual(themeExt.success.color, syncedStateStyle)
                syncRuntimeInfo.allowSend ->
                    SyncStateVisual(themeExt.info.color, outgoingOnlyStateStyle)
                syncRuntimeInfo.allowReceive ->
                    SyncStateVisual(themeExt.info.color, incomingOnlyStateStyle)
                else ->
                    SyncStateVisual(themeExt.neutral.color, pauseSyncStateStyle)
            }
        SyncState.DISCONNECTED -> SyncStateVisual(MaterialTheme.colorScheme.error, disconnectedStateStyle)
        SyncState.UNMATCHED -> SyncStateVisual(themeExt.warning.color, unmatchedStateStyle)
        SyncState.UNVERIFIED -> SyncStateVisual(themeExt.info.color, unverifiedStateStyle)
        SyncState.INCOMPATIBLE -> SyncStateVisual(MaterialTheme.colorScheme.error, incompatibleStateStyle)
        else -> SyncStateVisual(MaterialTheme.colorScheme.primary, connectingStateStyle)
    }
}

@Composable
@ReadOnlyComposable
fun PlatformScope.SyncStateColor(): Color =
    if (this is DeviceScope) {
        syncStateVisual().iconColor
    } else {
        LocalThemeExtState.current.info.color
    }

@Composable
fun DeviceScope.SyncStateTag(connecting: Boolean) {
    StateTagView(syncStateVisual(connecting).tag)
}

/**
 * The single "connecting" flag a device row shows: true while a manual refresh
 * runs or the sync layer is in CONNECTING, held for at least
 * [MIN_CONNECTING_VISIBLE] once entered. A reconnect against an unreachable
 * peer fails within milliseconds, and without the hold every automatic attempt
 * flickers the tag, the icon tint and the spinner.
 */
class ConnectingIndicator(
    val visible: Boolean,
    val onRefreshingChange: (Boolean) -> Unit,
)

@Composable
fun DeviceScope.rememberConnectingIndicator(): ConnectingIndicator {
    var refreshing by remember { mutableStateOf(false) }
    val connecting = refreshing || syncRuntimeInfo.connectState == SyncState.CONNECTING
    var visible by remember { mutableStateOf(connecting) }
    var since by remember { mutableStateOf(0L) }

    LaunchedEffect(connecting) {
        if (connecting) {
            since = DateUtils.nowEpochMilliseconds()
            visible = true
        } else if (visible) {
            val elapsed = (DateUtils.nowEpochMilliseconds() - since).milliseconds
            val remaining = MIN_CONNECTING_VISIBLE - elapsed
            if (remaining.isPositive()) {
                delay(remaining)
            }
            visible = false
        }
    }

    return ConnectingIndicator(visible) { refreshing = it }
}

private val MIN_CONNECTING_VISIBLE = 1.seconds

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5254** (2026-10-23): **Windows: CrossPaste's own bubble editor window can be recorded as the previous app and receive the paste**
  *Symptoms*: ## Problem  On Windows, `WindowFocusRecorder.isValidWindow` only excludes the main window and search window titles. Other CrossPaste windows — most notably the bubble editor window (`CrossPaste Editor`), which is focusable — can be recorded as `lastWinAppInfo`, i.e. as "the previous app".  When the user then pastes from the search or main window, CrossPaste activates its own bubble window and injects the paste keystroke into it. Since #5248, the foreground check (`WindowsFocusUtils.isForegroundProcessOf`) compares by process, so it reports our own window as "back in the foreground" and the paste is treated as verified.  macOS is not affected: `prevMacAppInfo` is only updated when the frontmost bundle ID differs from CrossPaste's.  ## Steps to reproduce (Windows)  1. Open the bubble editor window and click into it. 2. Open the search window with the shortcut and pick an item with Enter. 3. The item is pasted into the bubble editor instead of the app used before it.  ## Open question  Pasting into the bubble while editing in it may sometimes be what the user wants, so we need to decide on the behavior first. Options:  - Exclude every CrossPaste window (by process ID) in `isValidWindow`, matching macOS. This is the simplest fix and keeps behavior consistent across platforms. - Keep recording the bubble window, but only treat it as a paste target on purpose.  ## Context  Found while reviewing #5248. The behavior existed before #5248; that PR just makes the paste look verified. 

- **Issue #5236** (2026-10-21): **Newest paste is half off-screen when added while the search window is at the start**
  *Symptoms*: ## Problem  With the search window open and the paste list at its initial position (newest item at the far left), a newly added paste is inserted but often ends up only half visible, with its left half outside the window. Earlier items stay still and only part of the list shifts.  ## Cause  The LazyRow is keyed by `item.id`, so when an item is prepended, LazyList anchors to the previous first item and the new one lands off-screen to the left. The list then tried to recover with `animateScrollToItem(0)` after the fact, triggered twice via `snapshotFlow { layoutInfo }.take(2)`. Interrupted or racing scroll animations left the newest item partly off-screen.  ## Expected  - At the start of the list: the new paste shows fully at the front with a smooth insertion animation, and older items move to the right. - Scrolled further along: adding a paste must not move what the user is currently looking at.

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

### Incident Patch 1: `dd2282c7` (2026-10-21)
**Commit Message**: :bug: stop macOS search focus rechecks from blocking the EDT on AppKit (#5242)

* :bug: stop macOS search focus rechecks from blocking the EDT on AppKit

* :bug: mirror willResignActive, guard NSApp and log recheck timing for macOS focus rechecks

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/MacAppWindowManager.kt` (modified, +6/-0)
```diff
@@ -29,6 +29,12 @@ class MacAppWindowManager(
     private val crosspasteBundleID = getSystemProperty().get("mac.bundleID")
 
     init {
+        // Warms the native activation monitor so the search window's focus rechecks
+        // read cached state instead of blocking the EDT on AppKit. The first call
+        // waits for the main thread once (on this IO thread, never the UI thread)
+        // to register the observer; it relies on this manager being created during
+        // startup, before the search window can open.
+        ioScope.launch { MacAppUtils.isApplicationActive() }
         // Re-apply the Dock icon policy immediately when the setting is toggled
         // while the main window is open (the toggle lives in the main window).
         // setDockIconVisibility only switches the activation policy — it must not
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/SearchWindow.kt` (modified, +3/-1)
```diff
@@ -296,6 +296,7 @@ fun SearchWindow(windowIcon: Painter?) {
                                     currentMacFocusSession === session &&
                                     window.isShowing
                             if (eligible) {
+                                val startedAt = System.nanoTime()
                                 val focus =
                                     MacSearchWindowFocusState(
                                         appActive = MacAppUtils.isApplicationActive(),
@@ -305,9 +306,10 @@ fun SearchWindow(windowIcon: Painter?) {
                                         mainFocused = appWindowManager.mainComposeWindow?.hasFocusedWindow() == true,
                                         pointerOnStatusItem = MacAppUtils.isPointerOnStatusItem(),
                                     )
+                                val elapsedMs = (System.nanoTime() - startedAt) / 1_000_000.0
                                 logger.info {
                                     "Mac search focus recheck result: source=$source, session=$sessionId, " +
-                                        "state=$focus, dismiss=${focus.shouldDismiss}, " +
+                                        "elapsedMs=$elapsedMs, state=$focus, dismiss=${focus.shouldDismiss}, " +
                                         "show=${appWindowManager.getCurrentSearchWindowInfo().show}"
                                 }
                                 focus.shouldDismiss
```

**File**: `app/src/desktopMain/swift/MacosApi.swift` (modified, +59/-6)
```diff
@@ -501,26 +501,79 @@ public func getCurrentActiveAppInfo() -> UnsafePointer<CChar>? {
     return nil
 }
 
+// Callers on the AWT EDT must not block on the main thread: during activation
+// changes AppKit can be waiting on the EDT itself, and the two threads then stall
+// each other for a full second. The state is mirrored from the main thread instead.
+private final class ApplicationActiveMonitor {
+    private let lock = NSLock()
+    private var active: Bool?
+
+    init() {
+        DispatchQueue.main.async { [self] in
+            // The notification center retains block-based observer tokens until they
+            // are removed; this monitor lives for the whole process, so the returned
+            // tokens are intentionally discarded.
+            for (name, value) in [
+                (NSApplication.didBecomeActiveNotification, true),
+                // willResignActive is posted before the key window resigns, hence before
+                // AWT can queue the focus-loss event that reads this cache. Mirroring it
+                // closes the window where a recheck could still observe the old `true`.
+                (NSApplication.willResignActiveNotification, false),
+                (NSApplication.didResignActiveNotification, false),
+            ] {
+                NotificationCenter.default.addObserver(forName: name, object: nil, queue: nil) { [self] _ in
+                    set(value)
+                }
+            }
+            set(NSApp?.isActive ?? false)
+        }
+    }
+
+    private func set(_ value: Bool) {
+        lock.lock()
+        active = value
+        lock.unlock()
+    }
+
+    /// Nil until the observers are registered on the main thread.
+    var isActive: Bool? {
+        lock.lock()
+        defer { lock.unlock() }
+        return active
+    }
+}
+
+private let applicationActiveMonitor = ApplicationActiveMonitor()
+
 @_cdecl("isApplicationActive")
 public func isApplicationActive() -> Int32 {
     if Thread.isMainThread {
-        return NSApp.isActive ? 1 : 0
+        return (NSApp?.isActive ?? false) ? 1 : 0
+    }
+    if let active = applicationActiveMonitor.isActive {
+        return active ? 1 : 0
     }
-    return DispatchQueue.main.sync { NSApp.isActive ? 1 : 0 }
+    return DispatchQueue.main.sync { (NSApp?.isActive ?? false) ? 1 : 0 }
 }
 
 @_cdecl("isPointerOnStatusItem")
 public func isPointerOnStatusItem() -> Int32 {
-    if !Thread.isMainThread {
-        return DispatchQueue.main.sync { isPointerOnStatusItem() }
-    }
     // macOS 27 deactivates the app before it forwards the status item mouse-down,
     // so the click event arrives too late. Hardware state is already current:
     // the button is down over the icon. Requiring the press keeps Cmd+Tab while
     // hovering the icon a real dismissal.
+    //
+    // The press is sampled before hopping to the main thread, so keyboard-driven
+    // focus changes never wait on AppKit. NSEvent's class-level hardware queries
+    // read the window server's current device state and touch no AppKit objects;
+    // AppKit does not document them as main-thread-only, so this read is
+    // intentionally done off the main thread.
     guard NSEvent.pressedMouseButtons & 1 != 0 else { return 0 }
+    if !Thread.isMainThread {
+        return DispatchQueue.main.sync { isPointerOnStatusItem() }
+    }
     let pointer = NSEvent.mouseLocation
-    let onStatusItem = NSApp.windows.contains { window in
+    let onStatusItem = (NSApp?.windows ?? []).contains { window in
         NSStringFromClass(type(of: window)) == "NSStatusBarWindow" &&
             window.isVisible &&
             window.frame.contains(pointer)
```

---

### Incident Patch 2: `0d99bd65` (2026-10-21)
**Commit Message**: :bug: wait for the target window to become active before injecting the X11 paste keystroke (#5246)

* :bug: wait for the target window to become active before injecting the X11 paste keystroke

* :bug: keep the Linux X11 paste out of CrossPaste's own window

`_NET_ACTIVE_WINDOW` requests sent with the APPLICATION (1) source are ignored
by KWin X11 focus stealing prevention, even when the request carries the
requesting window or a recent timestamp. The activation wait added for #5246
therefore always timed out on KWin and the keystroke still landed in the
search box, with the paste delayed by the full timeout.

- Send the activation with the PAGER (2) source, which the window manager
  treats as a trusted activation (the same source already used for
  shortcut-triggered focus).
- Report whether the activation was confirmed. When it was not, hide our own
  window (hiding it is what makes the window manager hand the focus back),
  wait for the previous app to become active, and only then inject. If the
  focus never returns, ask the user to paste manually instead of injecting
  blindly into CrossPaste.
- Release the injected keys in a `finally` so a cancelled coroutine cannot
  leave 

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/LinuxAppWindowManager.kt` (modified, +41/-10)
```diff
@@ -15,7 +15,6 @@ import com.crosspaste.platform.linux.LinuxDesktopEntry
 import com.crosspaste.platform.linux.api.PortalHandles
 import com.crosspaste.platform.linux.api.RemoteDesktopPortalKeyboard
 import com.crosspaste.platform.linux.api.X11Api
-import com.crosspaste.platform.linux.api.X11Api.Companion.bringToBack
 import com.sun.jna.NativeLong
 import com.sun.jna.platform.unix.X11.Window
 import io.ktor.util.collections.ConcurrentSet
@@ -200,7 +199,7 @@ class LinuxAppWindowManager(
             pasteThroughPortal()
             return
         }
-        bringToBack(toPaste)
+        bringToBack(toPaste) { hideMainWindow() }
         hideMainWindow()
     }
 
@@ -219,7 +218,7 @@ class LinuxAppWindowManager(
 
     override suspend fun returnFocusToPreviousApp() {
         if (!needsPortalPaste()) {
-            prevLinuxAppInfo.value?.let { bringToBack(it) }
+            prevLinuxAppInfo.value?.let { X11Api.bringToBack(it) }
         }
     }
 
@@ -245,7 +244,12 @@ class LinuxAppWindowManager(
             }
             return
         }
-        bringToBack(toPaste)
+        val targetReady = bringToBack(toPaste) { hideSearchWindow() }
+        if (!targetReady) {
+            // No target to paste into, so the remaining items must not be injected either.
+            hideSearchWindow()
+            return
+        }
         for (i in 1 until size) {
             delay(1000.milliseconds)
             if (preparePaste(i)) {
@@ -261,13 +265,40 @@ class LinuxAppWindowManager(
      */
     private fun needsPortalPaste(): Boolean = isWaylandSession && prevLinuxAppInfo.value == null
 
-    private suspend fun bringToBack(toPaste: Boolean) {
-        val prevAppInfo = prevLinuxAppInfo.value ?: return
-        if (toPaste) {
-            bringToBack(prevAppInfo, pasteKeyCodes())
-        } else {
-            bringToBack(prevAppInfo)
+    /**
+     * Returns false when there is no previous app to paste into, or when the focus
+     * never came back, so callers must not inject any further keystrokes.
+     */
+    private suspend fun bringToBack(
+        toPaste: Boolean,
+        hideOwnWindow: () -> Unit,
+    ): Boolean {
+        val prevAppInfo = prevLinuxAppInfo.value
+        if (prevAppInfo == null) {
+            // No named previous window: there is no target, so stop before the
+            // multi-select loop injects the remaining items into our own search window.
+            if (toPaste) {
+                notifyManualPasteRequired()
+            }
+            return false
+        }
+        if (!toPaste) {
+            X11Api.bringToBack(prevAppInfo)
+            return true
         }
+        if (!X11Api.activateAndAwait(prevAppInfo)) {
+            // The window manager refused the activation request (KWin X11 ignores
+            // application-sourced `_NET_ACTIVE_WINDOW`). Hiding our own window is what
+            // makes it focus the previous app, so retry with it gone instead of
+            // injecting the keystroke into CrossPaste's own window (issue #5245).
+            hideOwnWindow()
+            if (!X11Api.awaitActive(prevAppInfo)) {
+                notifyManualPasteRequired()
+                return false
+            }
+        }
+        X11Api.toPaste(pasteKeyCodes())
+        return true
     }
 
     override suspend fun toPaste() {
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/platform/linux/api/X11Api.kt` (modified, +114/-18)
```diff
@@ -12,8 +12,11 @@ import com.sun.jna.ptr.IntByReference
 import com.sun.jna.ptr.NativeLongByReference
 import io.github.oshai.kotlinlogging.KotlinLogging
 import kotlinx.coroutines.delay
+import kotlinx.coroutines.withTimeoutOrNull
 import java.nio.file.Path
 import javax.imageio.ImageIO
+import kotlin.coroutines.cancellation.CancellationException
+import kotlin.time.Duration
 import kotlin.time.Duration.Companion.milliseconds
 
 interface X11Api : X11 {
@@ -50,6 +53,25 @@ interface X11Api : X11 {
 
         val INSTANCE: X11Api = Native.load("X11", X11Api::class.java)
 
+        private val ACTIVATION_TIMEOUT = 500.milliseconds
+
+        private val ACTIVATION_POLL_INTERVAL = 10.milliseconds
+
+        private val KEY_HOLD = 100.milliseconds
+
+        /**
+         * Source indication used for the `_NET_ACTIVE_WINDOW` requests CrossPaste issues
+         * on the user's behalf (pasting back into the previous app, returning focus).
+         *
+         * Window managers apply focus stealing prevention to `APPLICATION` (1) requests.
+         * KWin X11 ignores them even when the request carries the requesting window or a
+         * recent timestamp, which leaves the keystroke in CrossPaste's own window. The
+         * `PAGER` (2) indication is treated as a trusted activation, and the user did ask
+         * for it by picking an item. `focusMainWindow`/`focusSearchWindow` already use it
+         * for shortcut-triggered activation.
+         */
+        private val ACTIVATION_SOURCE: NativeLong = NativeLong(2)
+
         /**
          * True when a real X11 window holds the input focus.
          *
@@ -121,7 +143,7 @@ interface X11Api : X11 {
 
         fun bringToBack(
             prevLinuxAppInfo: LinuxAppInfo?,
-            source: NativeLong = NativeLong(1),
+            source: NativeLong = ACTIVATION_SOURCE,
             xServerTime: NativeLong? = null,
         ) {
             val display = INSTANCE.XOpenDisplay(null) ?: return
@@ -134,39 +156,95 @@ interface X11Api : X11 {
             }
         }
 
-        suspend fun bringToBack(
-            prevLinuxAppInfo: LinuxAppInfo?,
-            keyCodes: List<Int>,
-            source: NativeLong = NativeLong(1),
+        /**
+         * Requests activation of [prevLinuxAppInfo] and waits until the window manager
+         * reports it as the active window.
+         *
+         * XTest delivers the keystroke to whichever window holds the focus at that
+         * moment, which right after the request is still CrossPaste's own window. A
+         * `false` result means the window manager never confirmed the activation (it
+         * may have refused the request), so the caller must not inject blindly.
+         */
+        suspend fun activateAndAwait(
+            prevLinuxAppInfo: LinuxAppInfo,
+            source: NativeLong = ACTIVATION_SOURCE,
             xServerTime: NativeLong? = null,
-        ) {
-            val display = INSTANCE.XOpenDisplay(null) ?: return
-            try {
-                prevLinuxAppInfo?.let {
-                    WMCtrl.activeWindow(display, it.window, source, xServerTime ?: NativeLong(X11.CurrentTime.toLong()))
-                    toPaste(display, keyCodes)
-                }
+            timeout: Duration = ACTIVATION_TIMEOUT,
+        ): Boolean {
+            val display = INSTANCE.XOpenDisplay(null) ?: return false
+            return try {
+                WMCtrl.activeWindow(
+                    display,
+                    prevLinuxAppInfo.window,
+                    source,
+                    xServerTime ?: NativeLong(X11.CurrentTime.toLong()),
+                )
+                awaitActiveOn(display, prevLinuxAppInfo.window, timeout)
             } finally {
                 INSTANCE.XCloseDisplay(display)
             }
         }
 
+        /**
+         * Waits for [prevLinuxAppInfo] to become the active window without requesting
+         * activation. Used after hiding our own window, which is what makes the window
+         * manager hand the focus back on its own.
+         */
+        suspend fun awaitActive(
+            prevLinuxAppInfo: LinuxAppInfo,
+            timeout: Duration = ACTIVATION_TIMEOUT,
+        ): Boolean {
+            val display = INSTANCE.XOpenDisplay(null) ?: return false
+            return try {
+                awaitActiveOn(display, prevLinuxAppInfo.window, timeout)
+            } finally {
+                INSTANCE.XCloseDisplay(display)
+            }
+        }
+
+        private suspend fun awaitActiveOn(
+            display: Display,
+            window: Window,
+            timeout: Duration,
+        ): Boolean {
+            val activated =
+                awaitWindowActive(timeout, ACTIVATION_POLL_INTERVAL) {
+                    getActiveWindow(display) == window
+                }
+            if (!activated) {
+                logger.warn {
+                    "Window $window was not reported active within $timeout " +
+                  
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/platform/linux/api/X11WindowActivationWaitTest.kt` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+package com.crosspaste.platform.linux.api
+
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.test.runTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+import kotlin.time.Duration.Companion.milliseconds
+
+@OptIn(ExperimentalCoroutinesApi::class)
+class X11WindowActivationWaitTest {
+    @Test
+    fun `returns as soon as the window is reported active`() =
+        runTest {
+            var checks = 0
+
+            val activated =
+                awaitWindowActive(300.milliseconds, 10.milliseconds) {
+                    ++checks == 3
+                }
+
+            assertTrue(activated)
+            assertEquals(3, checks)
+            assertEquals(20L, testScheduler.currentTime)
+        }
+
+    @Test
+    fun `returns without waiting when the window is already active`() =
+        runTest {
+            var checks = 0
+
+            val activated =
+                awaitWindowActive(300.milliseconds, 10.milliseconds) {
+                    checks++
+                    true
+                }
+
+            assertTrue(activated)
+            assertEquals(1, checks)
+            assertEquals(0L, testScheduler.currentTime)
+        }
+
+    @Test
+    fun `gives up at the timeout when the window never becomes active`() =
+        runTest {
+            var checks = 0
+
+            val activated =
+                awaitWindowActive(300.milliseconds, 10.milliseconds) {
+                    checks++
+                    false
+                }
+
+            assertFalse(activated)
+            assertEquals(300L, testScheduler.currentTime)
+            // One check per poll interval until the timeout interrupts the wait.
+            assertTrue(checks >= 30)
+        }
+}
```

---

### Incident Patch 3: `cc2d2338` (2026-10-24)
**Commit Message**: :bug: keep development.properties and stray .claude folders out of release jars (#5273)

* :bug: keep development.properties and stray .claude folders out of release jars

* :bug: keep development-only files out of locally packaged jars

Release/beta CI already passes -PappEnv=PRODUCTION to app:build, but the tracked local packaging scripts built the jar without it, so a locally packaged Store/test build still shipped development.properties. Rebuild :app:desktopJar with the same appEnv each script packages, reject DEVELOPMENT in the test-zip script, and document the production build in the Store fallback.

DevConfig now tolerates a missing development.properties (release jars exclude it) and logs a warning in DEVELOPMENT runs, where it used to fail fast. DesktopResourceUtils resolves resources through a single openOrNull primitive so loadProperties and loadOptionalProperties cannot disagree, and tests cover both contracts. A stray .claude/ under compose resources is ignored at the repo level in addition to the jar-level exclusion.

* :memo: move maintainer-only Store and zip self-update runbooks out of the repo

MicrosoftStore.md and WindowsZipSelfUpdateTest.md are maintainer relea

**File**: `.github/workflows/build-beta-linux.yml` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ jobs:
           key: openssl-linux-${{ hashFiles('**/openssl.yaml') }}
 
       - name: Build with Gradle
-        run: ./gradlew app:build -PintegrationTests
+        run: ./gradlew app:build -PintegrationTests -PappEnv=PRODUCTION
 
       - name: Cache Kotlin/Native toolchain
         uses: actions/cache@v5
```

**File**: `.github/workflows/build-release.yml` (modified, +1/-1)
```diff
@@ -215,7 +215,7 @@ jobs:
           enableCrossOsArchive: true
 
       - name: Build with Gradle
-        run: ./gradlew app:build -PintegrationTests
+        run: ./gradlew app:build -PintegrationTests -PappEnv=PRODUCTION
 
       - name: Cache Kotlin/Native toolchain
         uses: actions/cache@v5
```

**File**: `.github/workflows/msstore-publish.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ name: "Publish to Microsoft Store"
 # pipeline and cadence, so it is deliberately not chained to the GitHub
 # Release. The app must already be live in the Store — the first submission
 # (listing, screenshots, age rating, markets) is manual in Partner Center.
-# One-time credential setup: see doc/en/MicrosoftStore.md.
+# One-time credential setup: see ai/docs/MicrosoftStore.md.
 
 on:
   workflow_dispatch:
```

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -39,6 +39,9 @@ output*/
 /code-review/
 /ai/
 /.claude/skills/ui-ux-pro-max/
+# A stray .claude/ under compose resources is tool state, not app content; it
+# would otherwise be packaged into the app jar (which also excludes it).
+**/composeResources/**/.claude/
 /docs/superpowers/
 web/dist/
 scheduled_tasks.lock
```

**File**: `app/build.gradle.kts` (modified, +9/-0)
```diff
@@ -514,12 +514,21 @@ compose.desktop {
 
             initJvmArgs(jvmArgsLambda, buildFullPlatform)
 
+            // app:run runs from this jar, so development builds keep the local
+            // development.properties; release builds pass -PappEnv=PRODUCTION
+            // to app:build so a developer's machine-specific file never ships.
             if (appEnv != "DEVELOPMENT") {
                 tasks.withType<Jar> {
                     exclude("development.properties**")
                 }
             }
 
+            // Tool state such as a stray .claude/ folder under composeResources
+            // is not app content; keep it out of every jar.
+            tasks.withType<Jar> {
+                exclude("**/.claude/**")
+            }
+
             // Add download info of jbr on all platforms
             val jbrYamlFile =
                 project.projectDir
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/WindowsZipUpdater.kt` (modified, +1/-1)
```diff
@@ -297,7 +297,7 @@ class WindowsZipUpdater(
         // user's privileges. Integrity therefore rests entirely on HTTPS + the GitHub /
         // Aliyun OSS repository ACLs. Proper hardening is to verify a detached signature
         // (e.g. minisign / GPG) over the zip or checksum against a public key baked into
-        // the app, before extracting. See doc/en/WindowsZipSelfUpdateTest.md.
+        // the app, before extracting. See ai/docs/WindowsZipSelfUpdateTest.md.
         val candidateBases = mirrorBases(release)
         val savedSource = readSavedSource(release)
         val hasPartialDownload = hasPartialDownload(release)
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/config/DevConfig.kt` (modified, +15/-1)
```diff
@@ -1,10 +1,24 @@
 package com.crosspaste.config
 
 import com.crosspaste.utils.DesktopResourceUtils
+import com.crosspaste.utils.getAppEnvUtils
+import io.github.oshai.kotlinlogging.KotlinLogging
 
 object DevConfig {
 
-    private val development = DesktopResourceUtils.loadProperties("development.properties")
+    private val logger = KotlinLogging.logger {}
+
+    // Release jars exclude development.properties, so a missing file means no overrides.
+    private val development = DesktopResourceUtils.loadOptionalProperties("development.properties")
+
+    init {
+        if (development.isEmpty && getAppEnvUtils().isDevelopment()) {
+            logger.warn {
+                "development.properties is missing; DevConfig overrides are disabled. " +
+                    "A development build normally restores it from development.properties.template."
+            }
+        }
+    }
 
     val pasteAppPath: String? = development.getProperty("pasteAppPath")
 
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/utils/DesktopResourceUtils.kt` (modified, +30/-18)
```diff
@@ -7,28 +7,40 @@ import java.util.Properties
 
 object DesktopResourceUtils {
 
-    fun loadProperties(fileName: String): Properties {
-        val properties = Properties()
-        val inputStream = ClassLoaderResourceLoader.load(fileName)
-        InputStreamReader(inputStream, StandardCharsets.UTF_8).use { inputStreamReader ->
-            properties.load(inputStreamReader)
-        }
-        return properties
-    }
+    fun loadProperties(fileName: String): Properties =
+        requireNotNull(loadPropertiesOrNull(fileName)) { "Resource $fileName not found" }
+
+    /**
+     * Like [loadProperties], but returns empty properties when the resource is
+     * absent. Release jars exclude development.properties, so DevConfig must be
+     * able to start without it.
+     */
+    fun loadOptionalProperties(fileName: String): Properties = loadPropertiesOrNull(fileName) ?: Properties()
 
-    fun readResourceBytes(fileName: String): ByteArray {
+    fun readResourceBytes(fileName: String): ByteArray =
         ClassLoaderResourceLoader.load(fileName).use { stream ->
-            return stream.readBytes()
+            stream.readBytes()
+        }
+
+    private fun loadPropertiesOrNull(fileName: String): Properties? =
+        ClassLoaderResourceLoader.openOrNull(fileName)?.use { inputStream ->
+            Properties().apply {
+                InputStreamReader(inputStream, StandardCharsets.UTF_8).use { reader ->
+                    load(reader)
+                }
+            }
         }
-    }
 }
 
 private object ClassLoaderResourceLoader {
-    fun load(resourcePath: String): InputStream {
-        val contextClassLoader = Thread.currentThread().contextClassLoader!!
-        val resource =
-            contextClassLoader.getResourceAsStream(resourcePath)
-                ?: this::class.java.getResourceAsStream(resourcePath)
-        return requireNotNull(resource) { "Resource $resourcePath not found" }
-    }
+
+    // Conveyor/JNI, Gradle tests and IDEs all set the context class loader; the
+    // class's own loader keeps resource loading working on threads that do not.
+    private fun classLoader(): ClassLoader =
+        Thread.currentThread().contextClassLoader ?: DesktopResourceUtils::class.java.classLoader
+
+    fun openOrNull(resourcePath: String): InputStream? = classLoader().getResourceAsStream(resourcePath)
+
+    fun load(resourcePath: String): InputStream =
+        requireNotNull(openOrNull(resourcePath)) { "Resource $resourcePath not found" }
 }
```

#### Recent Merged Pull Requests:
- **PR #5274** (2026-10-25): :sparkles: tint tag chips with their color and mark the selected one with a check (@guiyanakuang)
- **PR #5273** (2026-10-24): :bug: keep development.properties and stray .claude folders out of release jars (@guiyanakuang)
- **PR #5272** (2026-10-23): :construction_worker: hand the dnf repository back to the runner user before staging the update site (@guiyanakuang)
- **PR #5271** (2026-10-23): :construction_worker: build the macOS dylib with the runner's Xcode swiftc instead of Homebrew swift (@guiyanakuang)
- **PR #5270** (2026-10-23): :bookmark: release 2.3.0 (@guiyanakuang)
- **PR #5269** (2026-10-23): :sparkles: let mobile settings lists scroll behind the navigation bar (@guiyanakuang)

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

## X. :bug: stop macOS search focus rechecks from blocking the EDT on AppKit (#5242)

**RULE**:
When implementing operations in `app/src/desktopMain/kotlin/com/crosspaste/app/MacAppWindowManager.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in CrossPaste/crosspaste-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dd2282c7`: :bug: stop macOS search focus rechecks from blocking the EDT on AppKit (#5242). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `app/src/desktopMain/kotlin/com/crosspaste/app/MacAppWindowManager.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        // Warms the native activation monitor so the search window's focus rechecks
        // read cached state instead of blocking the EDT on AppKit. The first call
        // waits for the main thread once (on this IO thread, never the UI thread)
        // to register the observer; it relies on this manager being created during
        // startup, before the search window can open.
        ioScope.launch { MacAppUtils.isApplicationActive() }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dd2282c7` are properly handled with clean fallback behavior.
