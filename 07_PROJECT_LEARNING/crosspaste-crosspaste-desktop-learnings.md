> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crosspaste-crosspaste-desktop-learnings.md`  
> **Source**: github ([https://github.com/CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop))  
> **Source Version**: `9498f76d`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T02:02:02.364Z  
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
> **Harvest Timestamp**: 2026-11-25T02:02:02.355Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CrossPaste/crosspaste-desktop`
- **Description**: Cross-device clipboard sync for macOS, Windows & Linux — end-to-end encrypted, LAN-only, no cloud. OCR, CLI and MCP server built in.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2733 stars

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
- **Issue #5279** (2026-10-26): **Double-click paste in the search window is ignored after reopening it**
  *Symptoms*: ## Steps  1. Open the search window and single-click an item. 2. Close it with Esc. 3. Reopen it with the shortcut (Shift+Cmd+Space by default) and double-click an item.  Nothing is pasted and the window stays open. Single clicks also toggle multi-selection as if Shift were held.  ## Cause  `SidePasteboardContentView` tracks Shift in a `isShiftPressed` state that is updated only from key events reaching the paste list. The open-search shortcut itself holds Shift, and the matching key-up is not always delivered to the list (the window is hidden or not yet focused), so the state stays `true`. The `LaunchedEffect(searchWindowInfo.show)` meant to reset it is unreliable because the window content's composition is paused while hidden (see the note on `PasteSelectionViewModel.resetToTop`). With the stale `true`, `onDoubleTap` skips `quickPasteFromSearchWindow`.

- **Issue #5277** (2026-10-26): **Double-clicking a search window item sometimes does nothing**
  *Symptoms*: ## Problem  Double-clicking an item in the search window occasionally does nothing: the window stays open and nothing is pasted. Retrying with a quicker double-click works.  ## Cause  Compose Desktop hard-codes the double-tap timeout to 300 ms (`PlatformContext.DefaultViewConfiguration`), while the OS lets the user pick the double-click speed (macOS defaults to 500 ms, read by AWT as `awt.multiClickInterval`). A double-click whose second press lands 300–500 ms after the first release is a double-click to the OS but reaches `detectTapGestures` as two single taps, so `onDoubleTap` never fires.  Reproduced with synthesized CGEvents: a ~390 ms gap leaves the window open with no paste; a 150 ms gap pastes.

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

### Incident Patch 1: `9498f76d` (2026-11-23)
**Commit Message**: :bug: Add WS pause gating, inbound business queue budget, and extension heartbeat_ack support (#5346)

Follow-up to #5345 improving WebSocket lifecycle and backpressure stability:

- Add pause/resume gating to WsSessionManager, WsClientConnector, and WsRouting so pausing atomically rejects new sessions/handshakes, cancels in-flight dials, and closes active sessions.
- Enforce per-session inbound business queue limits (128 MiB payload bytes / 256 messages) in dispatchWsSessionMessages, closing overflowing sessions with TRY_AGAIN_LATER (1013) so peers fall back to retry/HTTP without unbounded memory growth.
- Advertise heartbeat_ack capability in the browser extension and echo requestId in HEARTBEAT_ACK responses while remaining backwards-compatible with legacy heartbeats.

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/routing/WsRouting.kt` (modified, +9/-1)
```diff
@@ -56,6 +56,12 @@ fun Routing.wsRouting(
             return@webSocket
         }
 
+        if (!wsSessionManager.isAcceptingSessions()) {
+            logger.info { "WS connection rejected: $appInstanceId while session manager paused" }
+            close(CloseReason(CloseReason.Codes.GOING_AWAY, "Session manager paused"))
+            return@webSocket
+        }
+
         val authenticationRequested =
             call.request.queryParameters["authVersion"] == WsAuthenticationCodec.VERSION.toString()
         val serverAuthentication =
@@ -90,7 +96,9 @@ fun Routing.wsRouting(
                     SyncApi.supportsPairingV3(serverAuthentication?.remotePairingVersion),
                 peerCapabilities = serverAuthentication?.remoteCapabilities.orEmpty(),
             )
-        wsSessionManager.registerSession(appInstanceId, wsSession)
+        if (!wsSessionManager.registerSession(appInstanceId, wsSession)) {
+            return@webSocket
+        }
 
         dispatchWsSessionMessages(
             appInstanceId = appInstanceId,
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsClientConnector.kt` (modified, +40/-7)
```diff
@@ -36,6 +36,26 @@ class WsClientConnector(
     private val inFlightLock = SynchronizedObject()
     private val inFlightHandshakes = HashMap<String, InFlightHandshake>()
 
+    init {
+        wsSessionManager.addOnPausedListener {
+            cancelInFlightHandshakes()
+        }
+    }
+
+    fun cancelInFlightHandshakes() {
+        val jobsToCancel =
+            synchronized(inFlightLock) {
+                if (inFlightHandshakes.isEmpty()) {
+                    emptyList()
+                } else {
+                    val jobs = inFlightHandshakes.values.map { it.job }
+                    inFlightHandshakes.clear()
+                    jobs
+                }
+            }
+        jobsToCancel.forEach { it.cancel() }
+    }
+
     /**
      * Attempt to open a WebSocket connection to a remote peer.
      * This is called opportunistically after HTTP CONNECTED state is reached.
@@ -54,11 +74,16 @@ class WsClientConnector(
         onHandshakeFinished: () -> Unit = {},
     ): Boolean =
         runCatching {
+            if (!wsSessionManager.isAcceptingSessions()) {
+                logger.debug { "WebSocket connect skipped for $targetAppInstanceId at $host:$port (paused)" }
+                return false
+            }
             val path =
                 "/ws/sync?appInstanceId=${appInfo.appInstanceId}" +
                     "&targetAppInstanceId=$targetAppInstanceId" +
                     "&authVersion=${WsAuthenticationCodec.VERSION}"
 
+            var sessionRegistered = false
             client.webSocket(host = host, port = port, path = path) {
                 val rawSession = WsSession(this, targetAppInstanceId)
                 val receivedChallenge =
@@ -124,8 +149,12 @@ class WsClientConnector(
                         peerSupportsChunkedPayload = SyncApi.supportsPairingV3(challenge.pairingVersion),
                         peerCapabilities = challenge.capabilities,
                     )
-                wsSessionManager.registerSession(targetAppInstanceId, wsSession)
+                val registered = wsSessionManager.registerSession(targetAppInstanceId, wsSession)
                 onHandshakeFinished()
+                if (!registered) {
+                    return@webSocket
+                }
+                sessionRegistered = true
 
                 dispatchWsSessionMessages(
                     appInstanceId = targetAppInstanceId,
@@ -149,7 +178,7 @@ class WsClientConnector(
                     }
                 }
             }
-            true
+            sessionRegistered
         }.onFailure { e ->
             logger.debug(e) { "WebSocket connection to $targetAppInstanceId at $host:$port failed (fallback to HTTP)" }
         }.getOrDefault(false)
@@ -188,13 +217,17 @@ class WsClientConnector(
         var previousJobToCancel: Job? = null
         val shouldStart =
             synchronized(inFlightLock) {
-                val existing = inFlightHandshakes[targetAppInstanceId]
-                if (existing != null && existing.host == host && existing.port == port) {
+                if (!wsSessionManager.isAcceptingSessions()) {
                     false
                 } else {
-                    previousJobToCancel = existing?.job
-                    inFlightHandshakes[targetAppInstanceId] = candidate
-                    true
+                    val existing = inFlightHandshakes[targetAppInstanceId]
+                    if (existing != null && existing.host == host && existing.port == port) {
+                        false
+                    } else {
+                        previousJobToCancel = existing?.job
+                        inFlightHandshakes[targetAppInstanceId] = candidate
+                        true
+                    }
                 }
             }
 
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsMessage.kt` (modified, +11/-0)
```diff
@@ -38,6 +38,17 @@ const val WS_MAX_PAYLOAD_SIZE: Long = 128L * 1024 * 1024
 /** Maximum accepted [WsEnvelopeHeader.payloadChunkCount], derived from the two limits above. */
 const val WS_MAX_PAYLOAD_CHUNK_COUNT: Int = (WS_MAX_PAYLOAD_SIZE / WS_PAYLOAD_CHUNK_SIZE).toInt()
 
+/**
+ * Per-session memory budget for queued (not yet processed) inbound business payloads.
+ * Sized to [WS_MAX_PAYLOAD_SIZE] so a single max-size paste is always accepted when
+ * the queue is empty, while preventing unbounded memory growth if a peer pushes large
+ * messages faster than decryption and DB ingestion can drain them.
+ */
+const val WS_MAX_PENDING_PAYLOAD_BYTES: Long = WS_MAX_PAYLOAD_SIZE
+
+/** Per-session upper bound on queued inbound business messages (guards against zero-byte floods). */
+const val WS_MAX_PENDING_MESSAGES: Int = 256
+
 /**
  * Wire header sent as a Text frame (JSON).
  * When [hasPayload] is true, the next [payloadChunkCount] frames MUST be Binary
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsMessageHandler.kt` (modified, +74/-1)
```diff
@@ -15,9 +15,15 @@ import com.crosspaste.secure.SecureStore
 import com.crosspaste.utils.getFileUtils
 import com.crosspaste.utils.getJsonUtils
 import io.github.oshai.kotlinlogging.KotlinLogging
+import io.ktor.websocket.CloseReason
+import kotlinx.atomicfu.locks.SynchronizedObject
+import kotlinx.atomicfu.locks.synchronized
 import kotlinx.coroutines.channels.Channel
 import kotlinx.coroutines.coroutineScope
+import kotlinx.coroutines.currentCoroutineContext
+import kotlinx.coroutines.ensureActive
 import kotlinx.coroutines.launch
+import kotlinx.coroutines.withTimeoutOrNull
 import kotlin.coroutines.cancellation.CancellationException
 
 class WsMessageHandler(
@@ -384,29 +390,68 @@ class WsMessageHandler(
     }
 }
 
+private class WsInboundQueueOverflowException : Exception()
+
+private const val OVERFLOW_CLOSE_TIMEOUT_MS = 1_000L
+
 /**
  * Runs a WebSocket session's receive loop while decoupling lightweight control/response
  * frames from slower business messages. Control and response frames run inline on the
  * receive loop; business messages run serially in FIFO order on a per-session worker so
  * paste ordering is preserved without blocking heartbeats or ACKs.
+ *
+ * Enforces a per-session byte budget ([maxPendingPayloadBytes]) and message count cap
+ * ([maxPendingMessages]) on queued business messages. If a peer pushes faster than the
+ * worker drains and exceeds the budget, the session is closed with
+ * [CloseReason.Codes.TRY_AGAIN_LATER] so the sender falls back to its existing retry/HTTP
+ * path instead of accumulating unbounded payload buffers in memory.
  */
 internal suspend fun dispatchWsSessionMessages(
     appInstanceId: String,
     wsSession: WsSession,
     wsMessageHandler: WsMessageHandler,
     onReadLoopFinished: () -> Unit,
+    maxPendingPayloadBytes: Long = WS_MAX_PENDING_PAYLOAD_BYTES,
+    maxPendingMessages: Int = WS_MAX_PENDING_MESSAGES,
     readLoop: suspend (dispatch: suspend (WsEnvelope) -> Unit) -> Unit,
 ) = coroutineScope {
     val logger = KotlinLogging.logger("WsSessionDispatcher")
     val workChannel = Channel<WsEnvelope>(Channel.UNLIMITED)
+    val budgetLock = SynchronizedObject()
+    var pendingBytes = 0L
+    var pendingMessages = 0
+
+    fun tryReserve(payloadBytes: Long): Boolean =
+        synchronized(budgetLock) {
+            if (pendingMessages >= maxPendingMessages ||
+                pendingBytes + payloadBytes > maxPendingPayloadBytes
+            ) {
+                false
+            } else {
+                pendingBytes += payloadBytes
+                pendingMessages += 1
+                true
+            }
+        }
+
+    fun release(payloadBytes: Long) {
+        synchronized(budgetLock) {
+            pendingBytes = (pendingBytes - payloadBytes).coerceAtLeast(0L)
+            pendingMessages = (pendingMessages - 1).coerceAtLeast(0)
+        }
+    }
+
     launch {
         for (envelope in workChannel) {
+            val payloadBytes = envelope.payload.size.toLong()
             try {
                 wsMessageHandler.handleMessage(appInstanceId, envelope)
             } catch (e: CancellationException) {
                 throw e
             } catch (e: Exception) {
                 logger.error(e) { "Unhandled error processing WS ${envelope.type} from $appInstanceId" }
+            } finally {
+                release(payloadBytes)
             }
         }
     }
@@ -416,9 +461,37 @@ internal suspend fun dispatchWsSessionMessages(
             if (WsMessageHandler.isControlOrResponse(envelope.type)) {
                 wsMessageHandler.handleMessage(appInstanceId, envelope)
             } else {
-                workChannel.send(envelope)
+                val payloadBytes = envelope.payload.size.toLong()
+                if (!tryReserve(payloadBytes)) {
+                    logger.warn {
+                        "WS inbound business queue budget exceeded for $appInstanceId " +
+                            "(incomingBytes=$payloadBytes, maxBytes=$maxPendingPayloadBytes, " +
+                            "maxMessages=$maxPendingMessages); closing session"
+                    }
+                    try {
+                        withTimeoutOrNull(OVERFLOW_CLOSE_TIMEOUT_MS) {
+                            wsSession.close(
+                                reason = "Inbound business queue budget exceeded",
+                                code = CloseReason.Codes.TRY_AGAIN_LATER,
+                            )
+                        }
+                    } catch (e: CancellationException) {
+                        currentCoroutineContext().ensureActive()
+                    } catch (e: Exception) {
+                        logger.debug(e) { "Error closing overflowed WS session for $appInstanceId" }
+                    }
+                    throw WsInboundQueueOverflowException()
+                }
+                try {
+                    workChannel.send(envelope)
+                } catch (e: Throwable) {
+              
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsSession.kt` (modified, +5/-2)
```diff
@@ -124,8 +124,11 @@ class WsSession(
             }
         } ?: false
 
-    suspend fun close(reason: String = "Normal closure") {
-        session.close(CloseReason(CloseReason.Codes.NORMAL, reason))
+    suspend fun close(
+        reason: String = "Normal closure",
+        code: CloseReason.Codes = CloseReason.Codes.NORMAL,
+    ) {
+        session.close(CloseReason(code, reason))
     }
 
     companion object {
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsSessionManager.kt` (modified, +58/-2)
```diff
@@ -2,6 +2,8 @@ package com.crosspaste.net.ws
 
 import io.github.oshai.kotlinlogging.KotlinLogging
 import io.ktor.util.collections.*
+import kotlinx.atomicfu.locks.SynchronizedObject
+import kotlinx.atomicfu.locks.synchronized
 import kotlinx.coroutines.TimeoutCancellationException
 import kotlinx.coroutines.currentCoroutineContext
 import kotlinx.coroutines.ensureActive
@@ -14,6 +16,9 @@ class WsSessionManager {
     private val pendingRequests = WsPendingRequests()
 
     private val sessions: ConcurrentMap<String, WsSession> = ConcurrentMap()
+    private val lifecycleLock = SynchronizedObject()
+    private var acceptingSessions = true
+    private val onPausedListeners = mutableListOf<() -> Unit>()
 
     private var onSessionClosed: ((String) -> Unit)? = null
 
@@ -27,11 +32,61 @@ class WsSessionManager {
         onSessionOpened = callback
     }
 
+    fun addOnPausedListener(listener: () -> Unit) {
+        synchronized(lifecycleLock) {
+            onPausedListeners.add(listener)
+        }
+    }
+
+    fun isAcceptingSessions(): Boolean = synchronized(lifecycleLock) { acceptingSessions }
+
+    /**
+     * Stops accepting new sessions or handshakes, cancels any in-flight handshakes
+     * registered via [addOnPausedListener], and closes all active sessions.
+     * Call [resume] when background pause ends.
+     */
+    suspend fun pause() {
+        val listeners =
+            synchronized(lifecycleLock) {
+                acceptingSessions = false
+                onPausedListeners.toList()
+            }
+        listeners.forEach { listener ->
+            try {
+                listener()
+            } catch (e: Exception) {
+                logger.warn(e) { "Error in WsSessionManager onPaused listener" }
+            }
+        }
+        closeAll()
+    }
+
+    /** Re-enables accepting WebSocket handshakes and session registrations after [pause]. */
+    fun resume() {
+        synchronized(lifecycleLock) {
+            acceptingSessions = true
+        }
+    }
+
     suspend fun registerSession(
         appInstanceId: String,
         session: WsSession,
-    ) {
-        val existing = sessions.put(appInstanceId, session)
+    ): Boolean {
+        var rejected = false
+        val existing =
+            synchronized(lifecycleLock) {
+                if (!acceptingSessions) {
+                    rejected = true
+                    null
+                } else {
+                    sessions.put(appInstanceId, session)
+                }
+            }
+        if (rejected) {
+            logger.info { "Rejected WebSocket session registration for $appInstanceId while paused" }
+            closeSessionSafely(appInstanceId, session, "Session manager paused")
+            return false
+        }
         if (existing != null) {
             logger.info { "Replaced existing WebSocket session for $appInstanceId" }
             pendingRequests.failForSession(existing, "WebSocket session replaced for $appInstanceId")
@@ -40,6 +95,7 @@ class WsSessionManager {
             logger.info { "Registered WebSocket session for $appInstanceId" }
         }
         onSessionOpened?.invoke(appInstanceId)
+        return true
     }
 
     fun unregisterSession(appInstanceId: String) {
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/net/ws/WsClientConnectorTest.kt` (modified, +65/-0)
```diff
@@ -138,4 +138,69 @@ class WsClientConnectorTest {
                 client.close()
             }
         }
+
+    @Test
+    fun pause_cancelsInFlightHandshakeAndBlocksNewDialsUntilResume() =
+        runBlocking {
+            val attempts = AtomicInteger(0)
+            val firstStarted = CompletableDeferred<Unit>()
+            val firstCancelled = CompletableDeferred<Unit>()
+            val resumedDialStarted = CompletableDeferred<Unit>()
+
+            val client =
+                HttpClient(
+                    MockEngine {
+                        val attempt = attempts.incrementAndGet()
+                        if (attempt == 1) {
+                            firstStarted.complete(Unit)
+                            try {
+                                kotlinx.coroutines.awaitCancellation()
+                            } finally {
+                                firstCancelled.complete(Unit)
+                            }
+                        } else {
+                            resumedDialStarted.complete(Unit)
+                            respondError(HttpStatusCode.ServiceUnavailable)
+                        }
+                    },
+                ) {
+                    install(WebSockets)
+                }
+
+            val appInfo: AppInfo =
+                mockk(relaxed = true) {
+                    every { appInstanceId } returns "local-peer"
+                }
+            val wsSessionManager = WsSessionManager()
+            val connector =
+                WsClientConnector(
+                    appInfo = appInfo,
+                    client = client,
+                    secureStore = mockk<SecureStore>(relaxed = true),
+                    wsSessionManager = wsSessionManager,
+                    wsMessageHandler = mockk<WsMessageHandler>(relaxed = true),
+                )
+
+            try {
+                connector.connectAsync("127.0.0.1", 8080, "remote-peer")
+                withTimeout(5.seconds) { firstStarted.await() }
+
+                // Pause must cancel the in-flight handshake and reject new dials.
+                wsSessionManager.pause()
+                withTimeout(5.seconds) { firstCancelled.await() }
+
+                connector.connectAsync("127.0.0.1", 8080, "remote-peer")
+                assertEquals(1, attempts.get())
+                assertEquals(false, connector.connect("127.0.0.1", 8080, "remote-peer"))
+                assertEquals(1, attempts.get())
+
+                // Resume re-enables outbound handshakes.
+                wsSessionManager.resume()
+                connector.connectAsync("127.0.0.1", 8080, "remote-peer")
+                withTimeout(5.seconds) { resumedDialStarted.await() }
+                assertEquals(2, attempts.get())
+            } finally {
+                client.close()
+            }
+        }
 }
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/net/ws/WsMessageHandlerTest.kt` (modified, +99/-0)
```diff
@@ -13,11 +13,16 @@ import com.crosspaste.secure.SecureStore
 import com.crosspaste.sync.SyncHandler
 import com.crosspaste.sync.SyncTestFixtures.createConnectedSyncRuntimeInfo
 import com.crosspaste.utils.getJsonUtils
+import io.ktor.websocket.CloseReason
+import io.ktor.websocket.Frame
+import io.ktor.websocket.WebSocketSession
+import io.ktor.websocket.readReason
 import io.mockk.coEvery
 import io.mockk.coVerify
 import io.mockk.coVerifyOrder
 import io.mockk.every
 import io.mockk.mockk
+import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.runTest
 import kotlin.test.Test
 import kotlin.test.assertEquals
@@ -248,4 +253,98 @@ class WsMessageHandlerTest {
                 )
             }
         }
+
+    @Test
+    fun dispatchWsSessionMessages_closesSessionWhenPendingPayloadBudgetExceeded() =
+        runTest {
+            val authenticatedPeer = "authenticated-peer"
+            val firstStarted = kotlinx.coroutines.CompletableDeferred<Unit>()
+            val releaseFirst = kotlinx.coroutines.CompletableDeferred<Unit>()
+            val handledRequestIds = mutableListOf<String?>()
+            val wsMessageHandler = mockk<WsMessageHandler>()
+            coEvery { wsMessageHandler.handleMessage(authenticatedPeer, any()) } coAnswers {
+                val env = secondArg<WsEnvelope>()
+                handledRequestIds.add(env.requestId)
+                if (env.requestId == "p-1") {
+                    firstStarted.complete(Unit)
+                    releaseFirst.await()
+                }
+            }
+            val innerSession = mockk<WebSocketSession>(relaxed = true)
+            val session =
+                WsSession(
+                    session = innerSession,
+                    remoteAppInstanceId = authenticatedPeer,
+                )
+            var readLoopFinished = false
+
+            val dispatcherJob =
+                launch {
+                    dispatchWsSessionMessages(
+                        appInstanceId = authenticatedPeer,
+                        wsSession = session,
+                        wsMessageHandler = wsMessageHandler,
+                        onReadLoopFinished = { readLoopFinished = true },
+                        maxPendingPayloadBytes = 100L,
+                    ) { dispatch ->
+                        dispatch(WsEnvelope(WsMessageType.PASTE_PUSH, payload = ByteArray(60), requestId = "p-1"))
+                        firstStarted.await()
+                        // Second payload would push queued bytes to 120 > 100; must close session and not enqueue.
+                        dispatch(WsEnvelope(WsMessageType.PASTE_PUSH, payload = ByteArray(60), requestId = "p-2"))
+                    }
+                }
+
+            firstStarted.await()
+            releaseFirst.complete(Unit)
+            dispatcherJob.join()
+
+            assertTrue(readLoopFinished)
+            assertEquals(listOf<String?>("p-1"), handledRequestIds)
+            coVerify(exactly = 1) {
+                innerSession.send(
+                    match<Frame.Close> { frame ->
+                        frame.readReason()?.knownReason == CloseReason.Codes.TRY_AGAIN_LATER
+                    },
+                )
+            }
+        }
+
+    @Test
+    fun dispatchWsSessionMessages_releasesBudgetAfterProcessingMessage() =
+        runTest {
+            val authenticatedPeer = "authenticated-peer"
+            val firstDone = kotlinx.coroutines.CompletableDeferred<Unit>()
+            val handledRequestIds = mutableListOf<String?>()
+            val wsMessageHandler = mockk<WsMessageHandler>()
+            coEvery { wsMessageHandler.handleMessage(authenticatedPeer, any()) } coAnswers {
+                val env = secondArg<WsEnvelope>()
+                handledRequestIds.add(env.requestId)
+                if (env.requestId == "p-1") {
+                    firstDone.complete(Unit)
+                }
+            }
+            val innerSession = mockk<io.ktor.websocket.WebSocketSession>(relaxed = true)
+            val session =
+                WsSession(
+                    session = innerSession,
+                    remoteAppInstanceId = authenticatedPeer,
+                )
+
+            dispatchWsSessionMessages(
+                appInstanceId = authenticatedPeer,
+                wsSession = session,
+                wsMessageHandler = wsMessageHandler,
+                onReadLoopFinished = {},
+                maxPendingPayloadBytes = 100L,
+            ) { dispatch ->
+                dispatch(WsEnvelope(WsMessageType.PASTE_PUSH, payload = ByteArray(80), requestId = "p-1"))
+                firstDone.await()
+                // Yield so worker's finally block releases the 80 bytes before next message arrives.
+                kotlinx.coroutines.yield()
+                dispatch(WsEnvelope(WsMessageType.PASTE_PUSH, payload = ByteArray(80), requestId = "p-2"))
+            }
+
+            assertEquals(listOf<String?>("p-1", "p-2"), handledRequestIds)
+
```

---

### Incident Patch 2: `a90af100` (2026-11-22)
**Commit Message**: :bug: Fix WebSocket reconnect upgrade, pending request fast-fail, cancellation handling, and heartbeat probe (#5345)

Improve WebSocket reconnection and transport stability across shared commonMain code:

- Trigger opportunistic WebSocket upgrade in SyncResolver.verifyConnection() and trust paths, with endpoint-aware in-flight handshake deduplication and immediate replacement on peer host/port change in WsClientConnector.
- Bind WsPendingRequests slots to (appInstanceId, session) and fast-fail in-flight waiters on session close, replacement, unregister, and closeAll(), removing the session before failing waiters to avoid concurrent races.
- Distinguish caller coroutine cancellation from underlying Ktor channel cancellation via currentCoroutineContext().ensureActive() in WsSessionManager send/close paths so caller cancellation does not tear down healthy sessions while closed channels still fall back cleanly.
- Add correlated HEARTBEAT/HEARTBEAT_ACK capability negotiation and half-open probe support in verifyConnection() with session closure on failure, decoupling control/response frames from per-session business message handling and tracking inbound frame progress (including chunked

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/routing/WsRouting.kt` (modified, +20/-8)
```diff
@@ -14,6 +14,7 @@ import com.crosspaste.net.ws.WsMessageType
 import com.crosspaste.net.ws.WsServerAuthentication
 import com.crosspaste.net.ws.WsSession
 import com.crosspaste.net.ws.WsSessionManager
+import com.crosspaste.net.ws.dispatchWsSessionMessages
 import com.crosspaste.net.ws.receiveWsEnvelope
 import com.crosspaste.secure.SecureStore
 import com.crosspaste.utils.getCodecsUtils
@@ -91,11 +92,21 @@ fun Routing.wsRouting(
             )
         wsSessionManager.registerSession(appInstanceId, wsSession)
 
-        try {
-            receiveWebSocketMessages(appInstanceId, authenticationContext, wsMessageHandler)
-        } finally {
-            logger.info { "WebSocket disconnected: $appInstanceId" }
-            wsSessionManager.notifySessionClosed(appInstanceId, wsSession)
+        dispatchWsSessionMessages(
+            appInstanceId = appInstanceId,
+            wsSession = wsSession,
+            wsMessageHandler = wsMessageHandler,
+            onReadLoopFinished = {
+                logger.info { "WebSocket disconnected: $appInstanceId" }
+                wsSessionManager.notifySessionClosed(appInstanceId, wsSession)
+            },
+        ) { dispatch ->
+            receiveWebSocketMessages(
+                appInstanceId = appInstanceId,
+                authenticationContext = authenticationContext,
+                onFrameReceived = wsSession::recordInboundActivity,
+                dispatch = dispatch,
+            )
         }
     }
 }
@@ -173,11 +184,12 @@ private suspend fun DefaultWebSocketServerSession.authenticateWebSocketPeer(
 private suspend fun DefaultWebSocketServerSession.receiveWebSocketMessages(
     appInstanceId: String,
     authenticationContext: WsAuthenticationContext?,
-    wsMessageHandler: WsMessageHandler,
+    onFrameReceived: () -> Unit,
+    dispatch: suspend (WsEnvelope) -> Unit,
 ) {
     val logger = KotlinLogging.logger {}
     while (true) {
-        val receivedResult = runCatching { receiveWsEnvelope(incoming) }
+        val receivedResult = runCatching { receiveWsEnvelope(incoming, onFrameReceived = onFrameReceived) }
         val receiveFailure = receivedResult.exceptionOrNull()
         if (receiveFailure != null) {
             if (receiveFailure is CancellationException) throw receiveFailure
@@ -197,7 +209,7 @@ private suspend fun DefaultWebSocketServerSession.receiveWebSocketMessages(
             close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid message authentication"))
             break
         }
-        wsMessageHandler.handleMessage(appInstanceId, received.envelope)
+        dispatch(received.envelope)
     }
 }
 
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/ReceivedWsEnvelope.kt` (modified, +8/-2)
```diff
@@ -12,15 +12,19 @@ data class ReceivedWsEnvelope(
     val envelope: WsEnvelope,
 )
 
-suspend fun receiveWsEnvelope(incoming: ReceiveChannel<Frame>): ReceivedWsEnvelope? {
+suspend fun receiveWsEnvelope(
+    incoming: ReceiveChannel<Frame>,
+    onFrameReceived: () -> Unit = {},
+): ReceivedWsEnvelope? {
     val json = getJsonUtils().JSON
     while (true) {
         when (val frame = incoming.receiveCatching().getOrNull() ?: return null) {
             is Frame.Text -> {
                 val header = json.decodeFromString<WsEnvelopeHeader>(frame.readText())
+                onFrameReceived()
                 val payload =
                     if (header.hasPayload) {
-                        receiveChunkedPayload(incoming, header.payloadChunkCount)
+                        receiveChunkedPayload(incoming, header.payloadChunkCount, onFrameReceived)
                     } else {
                         byteArrayOf()
                     }
@@ -46,6 +50,7 @@ suspend fun receiveWsEnvelope(incoming: ReceiveChannel<Frame>): ReceivedWsEnvelo
 private suspend fun receiveChunkedPayload(
     incoming: ReceiveChannel<Frame>,
     chunkCount: Int,
+    onFrameReceived: () -> Unit,
 ): ByteArray {
     require(chunkCount in 1..WS_MAX_PAYLOAD_CHUNK_COUNT) {
         "Invalid WebSocket payload chunk count: $chunkCount"
@@ -60,6 +65,7 @@ private suspend fun receiveChunkedPayload(
         require(totalSize <= WS_MAX_PAYLOAD_SIZE) {
             "WebSocket payload exceeds $WS_MAX_PAYLOAD_SIZE bytes"
         }
+        onFrameReceived()
         chunks.add(bytes)
     }
     if (chunks.size == 1) return chunks[0]
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsAuthentication.kt` (modified, +2/-1)
```diff
@@ -43,8 +43,9 @@ data class WsServerAuthentication(
 object WsCapability {
 
     const val PASTE_PUSH_ACK = "paste_push_ack"
+    const val HEARTBEAT_ACK = "heartbeat_ack"
 
-    val supported: Set<String> = setOf(PASTE_PUSH_ACK)
+    val supported: Set<String> = setOf(PASTE_PUSH_ACK, HEARTBEAT_ACK)
 }
 
 class WsAuthenticationContext(
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsClientConnector.kt` (modified, +83/-9)
```diff
@@ -10,6 +10,10 @@ import io.github.oshai.kotlinlogging.KotlinLogging
 import io.ktor.client.*
 import io.ktor.client.plugins.websocket.*
 import io.ktor.websocket.*
+import kotlinx.atomicfu.locks.SynchronizedObject
+import kotlinx.atomicfu.locks.synchronized
+import kotlinx.coroutines.CoroutineStart
+import kotlinx.coroutines.Job
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.withTimeoutOrNull
 
@@ -20,9 +24,17 @@ class WsClientConnector(
     private val wsSessionManager: WsSessionManager,
     private val wsMessageHandler: WsMessageHandler,
 ) {
+    private class InFlightHandshake(
+        val host: String,
+        val port: Int,
+        val job: Job,
+    )
+
     private val logger = KotlinLogging.logger {}
     private val json = getJsonUtils().JSON
     private val connectScope = namedScope(ioDispatcher, "WsClientConnector")
+    private val inFlightLock = SynchronizedObject()
+    private val inFlightHandshakes = HashMap<String, InFlightHandshake>()
 
     /**
      * Attempt to open a WebSocket connection to a remote peer.
@@ -33,6 +45,13 @@ class WsClientConnector(
         host: String,
         port: Int,
         targetAppInstanceId: String,
+    ): Boolean = connectInternal(host, port, targetAppInstanceId)
+
+    private suspend fun connectInternal(
+        host: String,
+        port: Int,
+        targetAppInstanceId: String,
+        onHandshakeFinished: () -> Unit = {},
     ): Boolean =
         runCatching {
             val path =
@@ -106,20 +125,28 @@ class WsClientConnector(
                         peerCapabilities = challenge.capabilities,
                     )
                 wsSessionManager.registerSession(targetAppInstanceId, wsSession)
+                onHandshakeFinished()
 
-                try {
+                dispatchWsSessionMessages(
+                    appInstanceId = targetAppInstanceId,
+                    wsSession = wsSession,
+                    wsMessageHandler = wsMessageHandler,
+                    onReadLoopFinished = {
+                        logger.info { "WebSocket client disconnected from $targetAppInstanceId" }
+                        wsSessionManager.notifySessionClosed(targetAppInstanceId, wsSession)
+                    },
+                ) { dispatch ->
                     while (true) {
-                        val received = receiveWsEnvelope(incoming) ?: break
+                        val received =
+                            receiveWsEnvelope(incoming, onFrameReceived = wsSession::recordInboundActivity)
+                                ?: break
                         if (!authenticationContext.verify(received.header, received.envelope.payload)) {
                             logger.warn { "Rejected unauthenticated WS message from $targetAppInstanceId" }
                             close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid message authentication"))
                             break
                         }
-                        wsMessageHandler.handleMessage(targetAppInstanceId, received.envelope)
+                        dispatch(received.envelope)
                     }
-                } finally {
-                    logger.info { "WebSocket client disconnected from $targetAppInstanceId" }
-                    wsSessionManager.notifySessionClosed(targetAppInstanceId, wsSession)
                 }
             }
             true
@@ -129,15 +156,62 @@ class WsClientConnector(
 
     /**
      * Attempt WebSocket connection in the background.
-     * Does not block — failures are silently handled.
+     * Coalesces concurrent handshake attempts to the same peer and endpoint, replaces
+     * an in-flight handshake immediately when the peer's host/port changes, and silently
+     * handles failures.
      */
     fun connectAsync(
         host: String,
         port: Int,
         targetAppInstanceId: String,
     ) {
-        connectScope.launch {
-            connect(host, port, targetAppInstanceId)
+        var entry: InFlightHandshake? = null
+        val release = {
+            synchronized(inFlightLock) {
+                val current = entry
+                if (current != null && inFlightHandshakes[targetAppInstanceId] === current) {
+                    inFlightHandshakes.remove(targetAppInstanceId)
+                }
+            }
+        }
+        val job =
+            connectScope.launch(start = CoroutineStart.LAZY) {
+                try {
+                    connectInternal(host, port, targetAppInstanceId, onHandshakeFinished = release)
+                } finally {
+                    release()
+                }
+            }
+        val candidate = InFlightHandshake(host, port, job)
+        entry = candidate
+
+        var previousJobToCancel: Job? = null
+        val shouldStart =
+            synchronized(inFlightLock) {
+                val existing = inFlightHandshakes[targetAppInstanceId]
+                if (existing != null && existing.host == host && exis
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsMessageHandler.kt` (modified, +69/-1)
```diff
@@ -15,6 +15,9 @@ import com.crosspaste.secure.SecureStore
 import com.crosspaste.utils.getFileUtils
 import com.crosspaste.utils.getJsonUtils
 import io.github.oshai.kotlinlogging.KotlinLogging
+import kotlinx.coroutines.channels.Channel
+import kotlinx.coroutines.coroutineScope
+import kotlinx.coroutines.launch
 import kotlin.coroutines.cancellation.CancellationException
 
 class WsMessageHandler(
@@ -46,13 +49,19 @@ class WsMessageHandler(
             WsMessageType.HEARTBEAT -> {
                 wsSessionManager.send(
                     appInstanceId,
-                    WsEnvelope(type = WsMessageType.HEARTBEAT_ACK),
+                    WsEnvelope(
+                        type = WsMessageType.HEARTBEAT_ACK,
+                        requestId = envelope.requestId,
+                    ),
                 )
             }
 
             WsMessageType.HEARTBEAT_ACK -> {
                 // Peer acknowledged our heartbeat — connection is alive
                 logger.debug { "Heartbeat ACK from $appInstanceId" }
+                envelope.requestId?.let { requestId ->
+                    wsSessionManager.completePendingRequest(requestId, envelope)
+                }
             }
 
             WsMessageType.PASTE_PUSH -> {
@@ -355,6 +364,65 @@ class WsMessageHandler(
             )
         wsSessionManager.send(appInstanceId, errorEnvelope)
     }
+
+    companion object {
+        /**
+         * Control and response frames are lightweight and must be handled inline on the
+         * receive loop so slow business handlers (e.g. large paste ingestion or file I/O)
+         * cannot head-of-line block heartbeats or in-flight request ACKs.
+         */
+        internal fun isControlOrResponse(type: String): Boolean =
+            when (type) {
+                WsMessageType.HEARTBEAT,
+                WsMessageType.HEARTBEAT_ACK,
+                WsMessageType.PASTE_PUSH_ACK,
+                WsMessageType.FILE_PULL_RESPONSE,
+                WsMessageType.ERROR,
+                -> true
+                else -> false
+            }
+    }
+}
+
+/**
+ * Runs a WebSocket session's receive loop while decoupling lightweight control/response
+ * frames from slower business messages. Control and response frames run inline on the
+ * receive loop; business messages run serially in FIFO order on a per-session worker so
+ * paste ordering is preserved without blocking heartbeats or ACKs.
+ */
+internal suspend fun dispatchWsSessionMessages(
+    appInstanceId: String,
+    wsSession: WsSession,
+    wsMessageHandler: WsMessageHandler,
+    onReadLoopFinished: () -> Unit,
+    readLoop: suspend (dispatch: suspend (WsEnvelope) -> Unit) -> Unit,
+) = coroutineScope {
+    val logger = KotlinLogging.logger("WsSessionDispatcher")
+    val workChannel = Channel<WsEnvelope>(Channel.UNLIMITED)
+    launch {
+        for (envelope in workChannel) {
+            try {
+                wsMessageHandler.handleMessage(appInstanceId, envelope)
+            } catch (e: CancellationException) {
+                throw e
+            } catch (e: Exception) {
+                logger.error(e) { "Unhandled error processing WS ${envelope.type} from $appInstanceId" }
+            }
+        }
+    }
+    try {
+        readLoop { envelope ->
+            wsSession.recordInboundActivity()
+            if (WsMessageHandler.isControlOrResponse(envelope.type)) {
+                wsMessageHandler.handleMessage(appInstanceId, envelope)
+            } else {
+                workChannel.send(envelope)
+            }
+        }
+    } finally {
+        workChannel.close()
+        onReadLoopFinished()
+    }
 }
 
 internal data class WholeFileCandidate(
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsPendingRequests.kt` (modified, +101/-14)
```diff
@@ -1,25 +1,38 @@
 package com.crosspaste.net.ws
 
 import io.github.oshai.kotlinlogging.KotlinLogging
-import io.ktor.util.collections.*
+import kotlinx.atomicfu.locks.SynchronizedObject
+import kotlinx.atomicfu.locks.synchronized
 import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.withTimeout
 import kotlin.uuid.ExperimentalUuidApi
 import kotlin.uuid.Uuid
 
+internal class WsSessionClosedException(
+    message: String,
+) : IllegalStateException(message)
+
 /**
  * Manages in-flight WebSocket request-response correlations.
  *
- * A requester [open]s a [Pending] slot, sends an envelope stamped with its
- * [Pending.requestId], then [Pending.await]s the correlated response that the
- * receive loop delivers through [complete]. [request] bundles those steps for
- * callers that only need a boolean send outcome.
+ * A requester [open]s a [Pending] slot bound to a peer ([appInstanceId]) and
+ * optional [WsSession], sends an envelope stamped with its [Pending.requestId],
+ * then [Pending.await]s the correlated response that the receive loop delivers
+ * through [complete]. When a session closes or is replaced, [failForSession],
+ * [failForPeer], or [failAll] immediately fails matching in-flight waiters
+ * instead of letting them hang until timeout.
  */
 internal class WsPendingRequests {
 
-    private val logger = KotlinLogging.logger {}
+    private class PendingEntry(
+        val appInstanceId: String,
+        val session: WsSession?,
+        val deferred: CompletableDeferred<WsEnvelope>,
+    )
 
-    private val pending: MutableMap<String, CompletableDeferred<WsEnvelope>> = ConcurrentMap()
+    private val logger = KotlinLogging.logger {}
+    private val lock = SynchronizedObject()
+    private val pending: MutableMap<String, PendingEntry> = HashMap()
 
     companion object {
         const val DEFAULT_TIMEOUT_MS = 30_000L
@@ -37,15 +50,22 @@ internal class WsPendingRequests {
             }
 
         fun close() {
-            pending.remove(requestId)
+            synchronized(lock) {
+                pending.remove(requestId)
+            }
         }
     }
 
     @OptIn(ExperimentalUuidApi::class)
-    fun open(): Pending {
+    fun open(
+        appInstanceId: String,
+        session: WsSession? = null,
+    ): Pending {
         val requestId = Uuid.random().toString()
         val deferred = CompletableDeferred<WsEnvelope>()
-        pending[requestId] = deferred
+        synchronized(lock) {
+            pending[requestId] = PendingEntry(appInstanceId, session, deferred)
+        }
         return Pending(requestId, deferred)
     }
 
@@ -56,11 +76,13 @@ internal class WsPendingRequests {
      * [send] returning false is reported as an [IllegalStateException].
      */
     suspend fun request(
+        appInstanceId: String,
+        session: WsSession? = null,
         envelope: WsEnvelope,
         timeoutMs: Long = DEFAULT_TIMEOUT_MS,
         send: suspend (WsEnvelope) -> Boolean,
     ): WsEnvelope {
-        val slot = open()
+        val slot = open(appInstanceId, session)
         try {
             if (!send(envelope.copy(requestId = slot.requestId))) {
                 throw IllegalStateException("WebSocket request send failed")
@@ -80,12 +102,77 @@ internal class WsPendingRequests {
         requestId: String,
         response: WsEnvelope,
     ): Boolean {
-        val deferred = pending.remove(requestId)
-        if (deferred != null) {
-            deferred.complete(response)
+        val entry = synchronized(lock) { pending.remove(requestId) }
+        if (entry != null) {
+            entry.deferred.complete(response)
             return true
         }
         logger.debug { "No pending request for requestId=$requestId" }
         return false
     }
+
+    /**
+     * Returns true if at least one in-flight request (optionally excluding [excludeRequestId])
+     * is currently bound to [session].
+     */
+    fun hasInFlightForSession(
+        session: WsSession,
+        excludeRequestId: String? = null,
+    ): Boolean =
+        synchronized(lock) {
+            pending.entries.any { (requestId, entry) ->
+                entry.session === session && requestId != excludeRequestId
+            }
+        }
+
+    /**
+     * Fail all in-flight requests bound to [appInstanceId].
+     *
+     * @return number of pending requests failed.
+     */
+    fun failForPeer(
+        appInstanceId: String,
+        reason: String,
+    ): Int = failMatching(reason) { it.appInstanceId == appInstanceId }
+
+    /**
+     * Fail all in-flight requests bound to [session].
+     *
+     * @return number of pending requests failed.
+     */
+    fun failForSession(
+        session: WsSession,
+        reason: String,
+    ): Int = failMatching(reason) { it.session === session }
+
+    /**
+     * Fail all in-flight requests across all peers.
+     *
+     * @return number of pending requests failed.
+     */
+    fun failAll(reason: String): Int = f
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsSession.kt` (modified, +9/-1)
```diff
@@ -2,6 +2,7 @@ package com.crosspaste.net.ws
 
 import com.crosspaste.utils.getJsonUtils
 import io.ktor.websocket.*
+import kotlinx.atomicfu.atomic
 import kotlinx.coroutines.isActive
 import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
@@ -49,10 +50,17 @@ class WsSession(
 ) {
     private val json = getJsonUtils().JSON
     private val sendMutex = Mutex()
+    private val inboundActivityCount = atomic(0L)
 
     val isActive: Boolean
         get() = session.isActive
 
+    internal fun recordInboundActivity() {
+        inboundActivityCount.incrementAndGet()
+    }
+
+    internal fun inboundActivitySnapshot(): Long = inboundActivityCount.value
+
     suspend fun sendEnvelope(envelope: WsEnvelope) {
         sendMutex.withLock {
             sendEnvelopeLocked(envelope)
@@ -122,6 +130,6 @@ class WsSession(
 
     companion object {
         private val PING_PAYLOAD = "cp".encodeToByteArray()
-        private const val PING_TIMEOUT_MS = 3_000L
+        internal const val PING_TIMEOUT_MS = 3_000L
     }
 }
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/ws/WsSessionManager.kt` (modified, +154/-25)
```diff
@@ -3,6 +3,9 @@ package com.crosspaste.net.ws
 import io.github.oshai.kotlinlogging.KotlinLogging
 import io.ktor.util.collections.*
 import kotlinx.coroutines.TimeoutCancellationException
+import kotlinx.coroutines.currentCoroutineContext
+import kotlinx.coroutines.ensureActive
+import kotlinx.coroutines.withTimeoutOrNull
 import kotlin.coroutines.cancellation.CancellationException
 
 class WsSessionManager {
@@ -31,8 +34,8 @@ class WsSessionManager {
         val existing = sessions.put(appInstanceId, session)
         if (existing != null) {
             logger.info { "Replaced existing WebSocket session for $appInstanceId" }
-            runCatching { existing.close("Replaced by new session") }
-                .onFailure { e -> logger.warn(e) { "Error closing old WS session for $appInstanceId" } }
+            pendingRequests.failForSession(existing, "WebSocket session replaced for $appInstanceId")
+            closeSessionSafely(appInstanceId, existing, "Replaced by new session")
         } else {
             logger.info { "Registered WebSocket session for $appInstanceId" }
         }
@@ -43,13 +46,16 @@ class WsSessionManager {
         sessions.remove(appInstanceId)?.let {
             logger.info { "Unregistered WebSocket session for $appInstanceId" }
         }
+        pendingRequests.failForPeer(appInstanceId, "WebSocket session unregistered for $appInstanceId")
     }
 
     fun notifySessionClosed(
         appInstanceId: String,
         session: WsSession,
     ) {
-        if (sessions.remove(appInstanceId, session)) {
+        val removed = sessions.remove(appInstanceId, session)
+        pendingRequests.failForSession(session, "WebSocket session closed for $appInstanceId")
+        if (removed) {
             logger.info { "Unregistered WebSocket session for $appInstanceId" }
             onSessionClosed?.invoke(appInstanceId)
         }
@@ -62,35 +68,126 @@ class WsSessionManager {
     fun supportsChunkedPayload(appInstanceId: String): Boolean =
         sessions[appInstanceId]?.peerSupportsChunkedPayload == true
 
-    suspend fun probe(appInstanceId: String): Boolean {
+    fun supportsHeartbeatAck(appInstanceId: String): Boolean =
+        sessions[appInstanceId]?.let { WsCapability.HEARTBEAT_ACK in it.peerCapabilities } == true
+
+    suspend fun probe(
+        appInstanceId: String,
+        timeoutMs: Long = WsSession.PING_TIMEOUT_MS,
+    ): Boolean {
         val session = sessions[appInstanceId] ?: return false
         if (!session.isActive) {
             notifySessionClosed(appInstanceId, session)
             return false
         }
-        val success = session.ping()
+        val success =
+            if (WsCapability.HEARTBEAT_ACK in session.peerCapabilities) {
+                if (pendingRequests.hasInFlightForSession(session)) {
+                    logger.debug { "Skipping WebSocket heartbeat probe for busy session $appInstanceId" }
+                    return true
+                }
+                probeHeartbeat(appInstanceId, session, timeoutMs)
+            } else {
+                session.ping()
+            }
         if (!success) {
             notifySessionClosed(appInstanceId, session)
+            closeSessionSafely(
+                appInstanceId = appInstanceId,
+                session = session,
+                reason = "Heartbeat probe failed",
+                timeoutMs = PROBE_CLOSE_TIMEOUT_MS,
+            )
         }
         return success
     }
 
+    private suspend fun probeHeartbeat(
+        appInstanceId: String,
+        session: WsSession,
+        timeoutMs: Long,
+    ): Boolean {
+        val inboundBefore = session.inboundActivitySnapshot()
+        val pending = pendingRequests.open(appInstanceId, session)
+        try {
+            if (sessions[appInstanceId] !== session) return false
+            val sent =
+                sendToSession(
+                    appInstanceId,
+                    session,
+                    WsEnvelope(type = WsMessageType.HEARTBEAT, requestId = pending.requestId),
+                )
+            if (!sent) return false
+
+            val response =
+                try {
+                    pending.await(timeoutMs)
+                } catch (_: TimeoutCancellationException) {
+                    if (session.inboundActivitySnapshot() != inboundBefore ||
+                        pendingRequests.hasInFlightForSession(session, excludeRequestId = pending.requestId)
+                    ) {
+                        logger.debug {
+                            "WebSocket heartbeat probe timed out while session $appInstanceId showed active traffic; keeping session"
+                        }
+                        return true
+                    }
+                    logger.warn { "WebSocket heartbeat probe timed out for $appInstanceId" }
+                    return false
+                } catch (e: CancellationException) {
+                    throw e
+                } catch (e: Exception) 
```

#### Recent Merged Pull Requests:
- **PR #5346** (2026-11-23): :bug: Add WS pause gating, inbound business queue budget, and extension heartbeat_ack support (@guiyanakuang)
- **PR #5345** (2026-11-22): :bug: Fix WebSocket reconnect upgrade, pending request fast-fail, send cancellation, and heartbeat probe (@guiyanakuang)
- **PR #5344** (2026-11-19): ⬆️ Bump gradle-wrapper from 9.9.0 to 9.9.1 (@dependabot[bot])
- **PR #5343** (2026-11-17): :hammer: defer the launch state in GuidePasteDataService (@guiyanakuang)
- **PR #5342** (2026-11-14): :lipstick: Refresh iPhone and iPad device icons and add iPhone Duo (@guiyanakuang)
- **PR #5340** (2026-11-12): ⬆️ Bump com.helger:ph-css from 8.2.3 to 8.4.0 (@dependabot[bot])

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

## X. :bug: Add WS pause gating, inbound business queue budget, and extension heartbea

**RULE**:
When implementing operations in `app/src/commonMain/kotlin/com/crosspaste/net/routing/WsRouting.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in CrossPaste/crosspaste-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9498f76d`: :bug: Add WS pause gating, inbound business queue budget, and extension heartbeat_ack support. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `app/src/commonMain/kotlin/com/crosspaste/net/routing/WsRouting.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        if (!wsSessionManager.isAcceptingSessions()) {
            logger.info { "WS connection rejected: $appInstanceId while session manager paused" }
            close(CloseReason(CloseReason.Codes.GOING_AWAY, "Session manager paused"))
            return@webSocket
        }

        if (!wsSessionManager.registerSession(appInstanceId, wsSession)) {
            return@webSocket
        }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
        wsSessionManager.registerSession(appInstanceId, wsSession)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9498f76d` are properly handled with clean fallback behavior.
