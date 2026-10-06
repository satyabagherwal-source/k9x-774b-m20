# Forensic Learning Record (Deep Inspection): CrossPaste/crosspaste-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/crosspaste-crosspaste-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:50:51.084Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CrossPaste/crosspaste-desktop`
- **Description**: Cross-device clipboard sync for macOS, Windows & Linux — end-to-end encrypted, LAN-only, no cloud. OCR, CLI and MCP server built in.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2611 stars

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

    override suspend fun render(pasteData: PasteData) {
        if (!configManager.getCurrentConfig().enableUrlPreview) {
            return
        }
        pasteData.getPasteItem(UrlPasteItem::class)?.let { urlPasteItem ->
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
            ).mapNotNull { it() }.firstOrNull { it.isNotBlank() }

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

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/utils/AppEnvUtils.kt`
```
package com.crosspaste.utils

import com.crosspaste.app.AppEnv
import com.crosspaste.app.AppEnv.BETA
import com.crosspaste.app.AppEnv.DEVELOPMENT
import com.crosspaste.app.AppEnv.PRODUCTION
import com.crosspaste.app.AppEnv.TEST

expect fun getAppEnvUtils(): AppEnvUtils

interface AppEnvUtils {

    fun getCurrentAppEnv(): AppEnv

    fun isProduction(): Boolean {
        val appEnv = getCurrentAppEnv()
        return appEnv == PRODUCTION || appEnv == BETA
    }

    // use in mobile app
    fun isBeta(): Boolean = getCurrentAppEnv() == BETA

    fun isDevelopment(): Boolean = getCurrentAppEnv() == DEVELOPMENT

    fun isTest(): Boolean = getCurrentAppEnv() == TEST
}

```

### Core Architecture Module: `app/src/commonMain/kotlin/com/crosspaste/utils/CoilUtils.kt`
```
package com.crosspaste.utils

import coil3.Bitmap
import coil3.Image
import okio.Path

expect fun getCoilUtils(): CoilUtils

interface CoilUtils {

    fun createBitmap(path: Path): Bitmap

    fun createBitmap(
        path: Path,
        width: Int,
        height: Int,
    ): Bitmap

    fun createImage(path: Path): Image = asImage(createBitmap(path))

    fun createImage(
        path: Path,
        width: Int,
        height: Int,
    ): Image = asImage(createBitmap(path, width, height))

    fun asImage(
        bitmap: Bitmap,
        shareable: Boolean = true,
    ): Image
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5040** (2026-09-21): **Windows → HarmonyOS 6: image sync briefly shows a loading card, then disappears**
  *Symptoms*: ### How frequently does the bug occur?  Always  ### Description  Image clipboard entries sent from Windows 11 to a HarmonyOS 6 tablet fail to complete synchronization.  Text synchronization works normally. When an image is copied on Windows, the HarmonyOS client briefly displays a loading/placeholder card for less than one second. The card then disappears and the image is not retained in the CrossPaste pasteboard.  Expected behavior: The image should finish downloading and remain available in the HarmonyOS CrossPaste pasteboard.  Actual behavior: The tablet receives the image metadata and starts loading, but the image retrieval appears to fail and the placeholder is removed.  This happens with every tested image, including files of approximately 6.7 KB, 49 KB, 120 KB, and 300 KB, so it is not related to the image-size limit.  Text sync continues to work correctly. The visible behavior is similar to #2446.  ### Stacktrace & log output  ```shell No crash or stacktrace is shown on the HarmonyOS client. ```  ### Can you reproduce the bug?  Always  ### Reproduction Steps  1. Install CrossPaste 2.2.0 on a Windows 11 computer and a HarmonyOS 6 tablet. 2. Connect and pair both devices. 3. Confirm that text clipboard synchronization from Windows to the tablet works. 4. Copy any PNG or JPEG image on Windows. 5. Open or observe the CrossPaste pasteboard on the HarmonyOS tablet. 6. A loading card appears for less than one second and then disappears. 7. The image is not available in the t
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. We have identified the cause: a path-handling issue on the HarmonyOS client when receiving images sent from Windows. A fixed HarmonyOS version will be released as soon as possible; no change is needed on the Windows side.
  > CrossPaste 2.2.1 for HarmonyOS has been released. Updating the HarmonyOS client should resolve this issue.  Closing for now — feel free to reopen if the problem persists.

- **Issue #4944** (2026-09-08): **Expired push session cleanup can delete a paste that a concurrent finalize retry already acknowledged**
  *Symptoms*: ## Summary  `PushSessionManager` can delete a paste row that it has already acknowledged as durably received. Sweep cleanup of an expired, chunk-complete session and a concurrent finalize retry (`/complete` or a repeated last chunk) race on the session's terminal state.  ## Details  - `PushSession.finalize` only holds `finalizeLock` around the finalization callback. - `finalizeIfComplete` checks map membership *before* taking that lock, so a request that resolved the session keeps going even if the session is cleaned up while it waits. - `sweepExpired` retries finalization; on failure it calls `discardExpiredSession`, which removes the session from the map and calls `pasteDao.markDeletePasteData` **outside** the lock. `markDeletePasteData` has no state precondition. - `finalizeIfComplete` returns `Complete` even when `sessions.remove` fails.  ## Interleaving  1. A chunk-complete session whose earlier finalization failed expires. 2. Sweep retries finalization, fails again, releases the lock. 3. A concurrent `/complete` retry that already passed the membership check takes the lock and starts finalizing. 4. Sweep removes the session and enters the delete path (suspends on the DB dispatcher). 5. The retry succeeds, commits `LOADED`, and returns `Complete` to the sender. 6. Sweep's delete transaction marks the freshly committed row deleted and schedules content cleanup.  ## Impact  The receiver deletes a paste it has confirmed to the sender, and the sender stops retrying because i

- **Issue #4854** (2026-08-21): **Headless daemon returns an opaque 500 for CLI image previews when OpenGL libraries are missing**
  *Symptoms*: ## Reproduce  On a minimal Linux system without OpenGL userspace libraries (fresh Ubuntu server / container — no `libGL.so.1` / `libEGL.so.1`):  1. Run the daemon (`--headless`), sync an image paste to it. 2. `crosspaste paste <id>` in a sixel-capable terminal, or directly:  ``` GET /cli/paste/{id}/image?maxWidth=400&maxHeight=300 HTTP/1.1 500 Internal Server Error {"message":"Could not initialize class org.jetbrains.skia.Image"} ```  The CLI quietly falls back to printing file paths ("N image(s) not previewed"), and nothing anywhere tells the user what is actually wrong. Root cause is only discoverable by running `ldd` on the skiko native library:  ``` libGL.so.1 => not found libEGL.so.1 => not found ```  ## Root cause  `CliImageTranscoder.transcode` catches `Exception` around `Image.makeFromEncoded`, but a failed skiko native load surfaces as `ExceptionInInitializerError` (and `NoClassDefFoundError` on every subsequent call) — these are `Error`s, so they propagate out of the route handler and become a generic 500 whose message is just the JVM class-init failure text. The failure is also permanent for the daemon's lifetime: after installing the libraries the daemon must be restarted, which the error never hints at.  ## Scope  - The official **deb is fine**: its generated `Depends` already includes `libgl1` and `libegl1 | libegl-mali-xlnx` (verified against the 2.2.0.2502 arm64 deb), so apt installs pull the libraries automatically. - Affected: AppImage / tarball / source run

- **Issue #4853** (2026-08-21): **Gradle configuration fails on linux-arm64 hosts: "Unknown host target: linux aarch64" from cli/build.gradle.kts**
  *Symptoms*: ## Environment  - Host: Ubuntu 26.04 aarch64 (OrbStack VM on Apple Silicon; any linux-arm64 host reproduces — arm64 servers, Docker on Apple Silicon, Raspberry Pi) - JDK 21, Gradle wrapper from the repo  ## Reproduce  On a linux-arm64 host:  ```sh ./gradlew :app:desktopMainClasses ```  Configuration fails before any task runs:  ``` * Where: Build file '.../cli/build.gradle.kts' line: 163  * What went wrong: Unknown host target: linux aarch64 ```  ## Root cause  `cli/build.gradle.kts` evaluates `HostManager.host` in two places during configuration:  1. the `hostTestTaskName` lookup used by the `cliNativeTest` aggregate task 2. the host-target selection that registers the `:cli:run` task  Kotlin/Native has no linux-arm64 host toolchain, and `HostManager.host` throws `TargetSupportException` instead of returning null on unsupported hosts. Because this happens at configuration time it takes down the whole build — including modules that do not involve Kotlin/Native at all. Notably `./gradlew :app:run --args="--headless"` cannot be used to run the headless daemon from source on an arm64 Linux machine, which is otherwise a fully working scenario (verified: with the call sites guarded, the app module builds and the daemon runs fine on Ubuntu arm64).  ## Fix  Guard both call sites so an unsupported K/N host degrades gracefully: the host-only conveniences (`:cli:run`, the host test wired into `cliNativeTest`) are simply not registered, and everything else configures normally. `HostMana

- **Issue #4791** (2026-09-01): **Short-window keep-first dedup for duplicate image records from a single clipboard operation**
  *Symptoms*: ## Background  On Windows, Snipping Tool writes the clipboard twice per capture (30–90 ms apart; see #4737). Each clipboard event is collected independently, producing two identical history records and two identical PNGs. This duplication is **not caused by consumer concurrency** — even fully serialized collection would produce two records — and it persists because image records intentionally bypass the generic same-hash cleanup.  ## Why the existing gate must stay  The `isRefFiles()` gate in `PasteReleaseService.releaseLocalPasteData` was added deliberately by #2693 as a resource-lifecycle guard:  - `PasteItem.clear()` deletes the real backing files for non-ref (`basePath == null`) file/image items; - `markDeleteSameHash` schedules an immediate `DELETE_PASTE_TASK` (no delay); - the task executor runs up to 10 tasks concurrently, so an older record's sync task may still be reading the very file being deleted.  Lifting the gate would reintroduce premature file deletion and sync failures. **Do not lift it.**  ## Scope  This issue is a **fallback**, contingent on #4793: implement only if duplicate records still occur after the Windows event-coalescing pipeline lands and is validated with real capture runs.  ## Design: short-window keep-first dedup  - When a locally collected image paste computes its final hash and a local image record with the same hash already exists within a short window (a few seconds), keep the **first** record and discard the **second**. - Discarding the se
  **Post-Mortem & Fix Analysis**:
  > Implemented in #4798 (keep-first dedup within a bounded time window, reusing the hash already computed during collection) and #4799 (fixes the SQLite pragma issue the added write concurrency surfaced). Verified on a real Windows machine with the 2.2.0 release build: a Snipping Tool capture now produces a single history record. Shipped in v2.2.0.

- **Issue #4551** (2026-06-11): **In-client software update is not available**
  *Symptoms*: ### How frequently does the bug occur?  Always  ### Description  win  第一次点击更新 <img width="578" height="684" alt="Image" src="https://github.com/user-attachments/assets/1398a9f4-aef1-436a-8477-25cc5634456a" />  第二次打开客户端 <img width="576" height="686" alt="Image" src="https://github.com/user-attachments/assets/c4bd5d30-9fe3-4ab2-990d-ecce119a9f85" />  ### Stacktrace & log output  ```shell  ```  ### Can you reproduce the bug?  -- select --  ### Reproduction Steps  _No response_  ### Version  2.1.3（2297）  ### OS  win11 & macos
  **Post-Mortem & Fix Analysis**:
  > macos  <img width="712" height="812" alt="Image" src="https://github.com/user-attachments/assets/5921abd1-3c98-4b20-ad77-ea152eceb1ed" /> 
  > Thanks for the report — we've confirmed this is a real bug. The in-client update is currently broken on both Windows and macOS, and the issue has been present since 2.1.3.  We're already working on an emergency fix (2.1.5) — it's in progress and not ready yet, but we'll get it out as soon as we can. Tracking fix: #4555.  One important note: because the bug affects the updater itself, the in-app update won't be able to pull the fix. Once 2.1.5 is released, you'll need to download and install it manually to recover. We'll update this issue when the build is available.  Sorry for the inconvenience, and thanks for helping us catch it.
  > This is now fixed in **[2.1.5](https://github.com/CrossPaste/crosspaste-desktop/releases/tag/2.1.5.2343)**, released as a hotfix. You can download it directly from the release page:  https://github.com/CrossPaste/crosspaste-desktop/releases/tag/2.1.5.2343  Root cause: when a newer version was available, triggering the update from the menu threw `Cannot call invokeAndWait from the event dispatcher thread`, which broke the update flow on the Windows installer and macOS builds. The trigger now runs correctly on the UI thread (#4554, #4555).  One additional note: the update **metadata is currently hosted on GitHub Releases**. From mainland China, GitHub is often unreachable without a proxy, so the app may fail to discover new versions even after this fix — that is a separate limitation, not this bug. We plan to address it by serving updates through a global CDN, so update checks and downloads work reliably both inside and outside China. Progress will be tracked in a separate issue.  Thanks

- **Issue #4542** (2026-06-10): **:bug: Fix/idea html clipboard mojibake**
  *Symptoms*: 

- **Issue #4500** (2026-06-03): **Macbook M1 Non Stop remote pasting simultaneously**
  *Symptoms*: ### How frequently does the bug occur?  -- select --  ### Description  I copied a text from my another device, pasted it one time, and it pasted it simultaneously.  ### Stacktrace & log output  ```shell  ```  ### Can you reproduce the bug?  -- select --  ### Reproduction Steps  _No response_  ### Version  2.1.3 (2297)  ### OS  Macos Apple silicon
  **Post-Mortem & Fix Analysis**:
  > Hi @aryaaaaa-cell, thanks for reporting this!  To help us narrow down the cause, could you let us know a few things:  1. **Is your other device also an Apple device (Mac/iPhone/iPad)?** If so, do you have Apple's built-in **Handoff / Universal Clipboard** enabled (System Settings → General → AirDrop & Handoff)?     We suspect this might be a feedback loop: when Apple's Universal Clipboard and CrossPaste are both syncing the clipboard at the same time, the same content can keep bouncing between the two systems, which could explain the non-stop / repeated pasting you're seeing. A quick test would be to **temporarily turn off Handoff** on both devices and see if the issue goes away.  2. **When you say "pasted simultaneously", do you mean:**    - the same text was pasted multiple times in a row into one app, or    - CrossPaste kept auto-pasting on its own without you triggering it?  3. **Logs would be very helpful.** On macOS you can find them here:     `~/Library/Application Support/Cross
  > My other device is android, and I don't think that the problem would be in Apple's built-in Handoff. When I say "pasted simultaneously", I mean CrossPaste kept auto-pasting on its own without I triggering it. I copied from my Samsung S21 FE phone, and I just pasted it to my note for initial testing. After that, the application did not stop from pasting and it ruined my MacBook. I had to do force shutdown.  [crosspaste.log](https://github.com/user-attachments/files/28506821/crosspaste.log) 
  > Thanks for the logs — I've located the issue.  It looks like you set a shortcut to **Cmd+V**. Cmd+V is the system paste shortcut, which we use internally to trigger the paste. It shouldn't be assigned to any other action, otherwise it causes the infinite loop you're seeing.  I'll fix this in the next version by disallowing Cmd+V as a shortcut, since it's reserved for system paste. In the meantime, you can change that shortcut to something else to avoid the problem. 

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

### Incident Patch 1: `ce27b2e9` (2026-10-06)
**Commit Message**: :bug: stop logging the pairing token in headless mode (#5108) (#5109)

**File**: `app/src/desktopMain/kotlin/com/crosspaste/headless/HeadlessAppTokenService.kt` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ class HeadlessAppTokenService : AppTokenService() {
     private val logger = KotlinLogging.logger {}
 
     override fun preShowToken() {
-        logger.info { "Token: ${token.value.concatToString()}" }
+        logger.info { "Pairing token requested; run 'crosspaste token' to read it" }
     }
 
     override fun preShowPairingCode() {
```

---

### Incident Patch 2: `150d3e52` (2026-10-06)
**Commit Message**: :bug: reference MCP-added files at their original path (#5106)

* :bug: reference MCP-added files at their original path (#5105)

add_to_clipboard stored file/image items without a basePath, so they
resolved to a non-existent managed-storage path and could not be pasted,
previewed or synced. Record the source folder as basePath, require an
absolute path and build the file info with a streaming hash.

* :bug: normalize MCP file paths and reject unreadable or directory images

Normalize the path before resolving it, reject a directory passed as an
image, and report an unreadable file as a tool error instead of throwing.

**File**: `app/src/desktopMain/kotlin/com/crosspaste/mcp/McpToolProvider.kt` (modified, +40/-32)
```diff
@@ -29,11 +29,9 @@ import com.crosspaste.paste.plugin.type.DesktopImageTypePlugin
 import com.crosspaste.paste.plugin.type.DesktopRtfTypePlugin
 import com.crosspaste.paste.plugin.type.DesktopTextTypePlugin
 import com.crosspaste.paste.plugin.type.DesktopUrlTypePlugin
-import com.crosspaste.presist.SingleFileInfoTree
 import com.crosspaste.utils.ColorParser
 import com.crosspaste.utils.DateUtils
 import com.crosspaste.utils.HtmlUtils
-import com.crosspaste.utils.getCodecsUtils
 import com.crosspaste.utils.getFileUtils
 import io.modelcontextprotocol.kotlin.sdk.server.Server
 import io.modelcontextprotocol.kotlin.sdk.types.CallToolResult
@@ -445,8 +443,6 @@ class McpToolProvider(
         }
     }
 
-    private val codecsUtils = getCodecsUtils()
-
     private fun createPasteData(
         content: String,
         type: String,
@@ -498,13 +494,11 @@ class McpToolProvider(
                     ) to PasteType.COLOR_TYPE
                 }
                 "file" -> {
-                    createFilePasteItem(content, PasteType.FILE_TYPE)
-                        ?: return Result.failure(
-                            IllegalArgumentException("File not found: '$content'."),
-                        )
+                    createFilePasteItem(content, PasteType.FILE_TYPE, notFoundLabel = "File")
+                        .getOrElse { return Result.failure(it) }
                 }
                 "image" -> {
-                    val path = content.toPath()
+                    val path = content.toPath(normalize = true)
                     val ext = path.name.substringAfterLast('.', "").lowercase()
                     if (!fileUtils.canPreviewImage(ext)) {
                         return Result.failure(
@@ -514,10 +508,8 @@ class McpToolProvider(
                             ),
                         )
                     }
-                    createFilePasteItem(content, PasteType.IMAGE_TYPE)
-                        ?: return Result.failure(
-                            IllegalArgumentException("Image file not found: '$content'."),
-                        )
+                    createFilePasteItem(content, PasteType.IMAGE_TYPE, notFoundLabel = "Image file")
+                        .getOrElse { return Result.failure(it) }
                 }
                 else -> {
                     createTextPasteItem(
@@ -541,41 +533,57 @@ class McpToolProvider(
         )
     }
 
+    /**
+     * References the file in place, like a clipboard file that is too large to
+     * copy: [basePath] is the file's own folder, so every reader resolves the
+     * original absolute path instead of a non-existent managed-storage path.
+     */
     private fun createFilePasteItem(
         filePath: String,
         pasteType: PasteType,
-    ): Pair<PasteItem, PasteType>? {
-        val path = filePath.toPath()
-        if (!FileSystem.SYSTEM.exists(path)) {
-            return null
+        notFoundLabel: String,
+    ): Result<Pair<PasteItem, PasteType>> {
+        val path = filePath.toPath(normalize = true)
+        if (!path.isAbsolute) {
+            return Result.failure(IllegalArgumentException("'$filePath' is not an absolute path."))
+        }
+        val parent = path.parent
+        val metadata = FileSystem.SYSTEM.metadataOrNull(path)
+        if (parent == null || metadata == null) {
+            return Result.failure(IllegalArgumentException("$notFoundLabel not found: '$filePath'."))
+        }
+        if (pasteType == PasteType.IMAGE_TYPE && metadata.isDirectory) {
+            return Result.failure(IllegalArgumentException("'$filePath' is a directory, not an image file."))
         }
-        val metadata = FileSystem.SYSTEM.metadata(path)
-        val fileSize = metadata.size ?: 0L
-        val fileBytes = FileSystem.SYSTEM.read(path) { readByteArray() }
-        val fileHash = codecsUtils.hash(fileBytes)
         val fileName = path.name
-        val fileInfoTree = SingleFileInfoTree(size = fileSize, hash = fileHash)
-        val identifiers =
-            if (pasteType == PasteType.IMAGE_TYPE) {
-                listOf(DesktopImageTypePlugin.IMAGE)
-            } else {
-                listOf(DesktopFilesTypePlugin.FILE_LIST_ID)
+        val fileInfoTree =
+            runCatching {
+                fileUtils.getFileInfoTree(path)
+            }.getOrElse { error ->
+                return Result.failure(
+                    IllegalArgumentException(
+                        "Cannot read $notFoundLabel '$filePath': ${error.message}",
+                    ),
+                )
             }
+        val fileInfoTreeMap = mapOf(fileName to fileInfoTree)
         val item =
             if (pasteType == PasteType.IMAGE_TYPE) {
                 createImagesPasteItem(
-                    identifiers = identifiers,
+                    identifiers = listOf(DesktopImageTypePlugin.IMAGE),
+                    basePath = parent.toString(),
                     relativePathList = listOf(fileName),
-       
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/mcp/McpToolProviderTest.kt` (modified, +105/-9)
```diff
@@ -13,6 +13,8 @@ import com.crosspaste.paste.PasteType
 import com.crosspaste.paste.SearchContentService
 import com.crosspaste.paste.item.CreatePasteItemHelper.createTextPasteItem
 import com.crosspaste.paste.item.DefaultPasteItemReader
+import com.crosspaste.paste.item.PasteFiles
+import com.crosspaste.paste.item.hasExistingFiles
 import com.crosspaste.paste.plugin.type.DesktopTextTypePlugin
 import com.crosspaste.path.UserDataPathProvider
 import com.crosspaste.task.TaskSubmitter
@@ -30,7 +32,12 @@ import io.modelcontextprotocol.kotlin.sdk.types.TextContent
 import kotlinx.coroutines.test.runTest
 import kotlinx.serialization.json.buildJsonObject
 import kotlinx.serialization.json.put
+import okio.Path.Companion.toOkioPath
+import java.nio.file.Files
 import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNotNull
 import kotlin.test.assertTrue
 
 class McpToolProviderTest {
@@ -460,20 +467,109 @@ class McpToolProviderTest {
         }
 
     @Test
-    fun `add_to_clipboard creates file item for existing file`() =
+    fun `add_to_clipboard rejects a relative file path`() =
         runTest {
             val server = createServer()
-            // Use build.gradle.kts as an existing file
             val result =
-                callTool(
-                    server,
-                    "add_to_clipboard",
-                    mapOf("content" to "build.gradle.kts", "type" to "file"),
-                )
-            assertTrue(result.contains("Successfully added"))
-            assertTrue(result.contains("type: file"))
+                callTool(server, "add_to_clipboard", mapOf("content" to "build.gradle.kts", "type" to "file"))
+            assertTrue(result.contains("Error"))
+            assertTrue(result.contains("not an absolute path"))
+        }
+
+    @Test
+    fun `add_to_clipboard file item references the original absolute path`() =
+        runTest {
+            val file = Files.createTempFile("mcp-add", ".txt")
+            Files.writeString(file, "referenced, not copied")
+            val path = file.toOkioPath()
+            val server = createServer()
+
+            val result = callTool(server, "add_to_clipboard", mapOf("content" to path.toString(), "type" to "file"))
+
+            assertTrue(result.contains("type: file"), result)
+            val item = addedPasteFiles(result)
+            assertEquals(path.parent.toString(), item.basePath)
+            assertEquals(listOf(path.name), item.relativePathList)
+            assertTrue(item.hasExistingFiles())
+
+            Files.delete(file)
+            assertFalse(item.hasExistingFiles())
+        }
+
+    @Test
+    fun `add_to_clipboard file item with directory references the original absolute path`() =
+        runTest {
+            val dir = Files.createTempDirectory("mcp-add-dir")
+            val child = Files.createFile(dir.resolve("child.txt"))
+            Files.writeString(child, "content in dir")
+            val path = dir.toOkioPath()
+            val server = createServer()
+
+            val result = callTool(server, "add_to_clipboard", mapOf("content" to path.toString(), "type" to "file"))
+
+            assertTrue(result.contains("type: file"), result)
+            val item = addedPasteFiles(result)
+            assertEquals(path.parent.toString(), item.basePath)
+            assertEquals(listOf(path.name), item.relativePathList)
+            assertTrue(item.hasExistingFiles())
+
+            Files.delete(child)
+            Files.delete(dir)
+            assertFalse(item.hasExistingFiles())
         }
 
+    @Test
+    fun `add_to_clipboard image item references the original absolute path`() =
+        runTest {
+            val file = Files.createTempFile("mcp-add", ".png")
+            Files.write(file, byteArrayOf(1, 2, 3))
+            val path = file.toOkioPath()
+            val server = createServer()
+
+            val result = callTool(server, "add_to_clipboard", mapOf("content" to path.toString(), "type" to "image"))
+
+            assertTrue(result.contains("type: image"), result)
+            val item = addedPasteFiles(result)
+            assertEquals(path.parent.toString(), item.basePath)
+            assertTrue(item.hasExistingFiles())
+            Files.delete(file)
+            assertFalse(item.hasExistingFiles())
+        }
+
+    @Test
+    fun `add_to_clipboard rejects a relative image path`() =
+        runTest {
+            val server = createServer()
+            val result =
+                callTool(server, "add_to_clipboard", mapOf("content" to "photo.png", "type" to "image"))
+            assertTrue(result.contains("Error"))
+            assertTrue(result.contains("not an absolute path"))
+        }
+
+    @Test
+    fun `add_to_clipboard rejects a directory for image type`() =
+        runTest {
+            val parent = Files.createTempDirectory("mcp-image-test")
+            val dir = Files.createDirectory(parent.resolve("di
```

---

### Incident Patch 3: `6b810341` (2026-10-06)
**Commit Message**: :memo: fix broken DeepWiki badge and bump download badge to v2.2.1 (#5107)

**File**: `README.md` (modified, +2/-2)
```diff
@@ -27,10 +27,10 @@
    [![Sqlite](https://img.shields.io/badge/Database-Sqlite-39477F?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
    ![Kotlin](https://img.shields.io/badge/Lang-Kotlin-0095D5.svg?logo=kotlin&logoColor=white)
    ![OS](https://img.shields.io/badge/OS-Windows%20%7C%20macOS%20%7C%20Linux-2cbe4e)
-   [![Download](https://img.shields.io/badge/Download-v2.2.0-2cbe4e?logo=download&link=https://crosspaste.com/en/download)](https://crosspaste.com/en/download)
+   [![Download](https://img.shields.io/badge/Download-v2.2.1-2cbe4e?logo=download&link=https://crosspaste.com/en/download)](https://crosspaste.com/en/download)
    [![AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-2cbe4e.svg)](https://github.com/CrossPaste/crosspaste-desktop/blob/main/LICENSE)
    [![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/crosspaste/crosspaste-desktop)
-   [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/CrossPaste/crosspaste-desktop)
+   [![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-2cbe4e)](https://deepwiki.com/CrossPaste/crosspaste-desktop)
 
    <a href="https://github.com/sponsors/CrossPaste"><img src="https://img.shields.io/badge/sponsor-30363D?style=social&logo=GitHub-Sponsors&logoColor=#white" height="30px"></a>
    <img src="https://img.shields.io/github/stars/CrossPaste/crosspaste-desktop?style=social" height="30px">
```

**File**: `README.zh-CN.md` (modified, +2/-2)
```diff
@@ -27,10 +27,10 @@
    [![Sqlite](https://img.shields.io/badge/Database-Sqlite-39477F?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
    ![Kotlin](https://img.shields.io/badge/Lang-Kotlin-0095D5.svg?logo=kotlin&logoColor=white)
    ![OS](https://img.shields.io/badge/OS-Windows%20%7C%20macOS%20%7C%20Linux-2cbe4e)
-   [![Download](https://img.shields.io/badge/Download-v2.2.0-2cbe4e?logo=download&link=https://crosspaste.com/download)](https://crosspaste.com/download)
+   [![Download](https://img.shields.io/badge/Download-v2.2.1-2cbe4e?logo=download&link=https://crosspaste.com/download)](https://crosspaste.com/download)
    [![AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-2cbe4e.svg)](https://github.com/CrossPaste/crosspaste-desktop/blob/main/LICENSE)
    [![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/crosspaste/crosspaste-desktop)
-   [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/CrossPaste/crosspaste-desktop)
+   [![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-2cbe4e)](https://deepwiki.com/CrossPaste/crosspaste-desktop)
 
    <a href="https://github.com/sponsors/CrossPaste"><img src="https://img.shields.io/badge/sponsor-30363D?style=social&logo=GitHub-Sponsors&logoColor=#white" height="30px"></a>
    <img src="https://img.shields.io/github/stars/CrossPaste/crosspaste-desktop?style=social" height="30px">
```

---

### Incident Patch 4: `7ff5389e` (2026-10-05)
**Commit Message**: :bug: refresh companion flavors when editing a paste from the UI (#5104)

* :bug: refresh companion flavors when editing a paste from the UI (#5103)

UI text/HTML/color edits went through UpdatePasteItemHelper, which only
rewrote the appear item and left the plain-text companion stale, so
plain-text targets pasted the old content. Route them through
PasteContentEditor like the CLI and drop the duplicate content methods.

* :hammer: split text edit view to reduce method complexity

Move undo/redo into TextEditHistory, extract the toolbar, and share the
save shortcut, save button and save notification with the HTML editor.

* :art: use a for loop instead of range forEach in TextEditHistoryTest

**File**: `app/src/commonMain/kotlin/com/crosspaste/paste/PasteContentEditor.kt` (modified, +31/-4)
```diff
@@ -95,7 +95,37 @@ class PasteContentEditor(
 
                 else -> return EditOutcome.NotEditable
             }
+        return applyEdit(
+            pasteData = pasteData,
+            mainItem = mainItem,
+            newMainItem = newMainItem,
+            expectedHash = expectedHash,
+            urlChanged = mainItem is UrlPasteItem && mainItem.url != newContent,
+        )
+    }
 
+    /** Recolors a color paste, e.g. from the desktop color picker. */
+    suspend fun updateColor(
+        pasteData: PasteData,
+        color: Int,
+    ): EditOutcome {
+        val mainItem = pasteData.pasteAppearItem as? ColorPasteItem ?: return EditOutcome.NotEditable
+        return applyEdit(
+            pasteData = pasteData,
+            mainItem = mainItem,
+            newMainItem = mainItem.copy(color),
+            expectedHash = pasteData.hash,
+            urlChanged = false,
+        )
+    }
+
+    private suspend fun applyEdit(
+        pasteData: PasteData,
+        mainItem: PasteItem,
+        newMainItem: PasteItem,
+        expectedHash: String,
+        urlChanged: Boolean,
+    ): EditOutcome {
         val oldCompanions = pasteData.pasteCollection.pasteItems
         val derivedText = pasteItemReader.getText(newMainItem)
         val newCompanions =
@@ -130,10 +160,7 @@ class PasteContentEditor(
                 expectedHash = expectedHash,
             )
         if (!applied) return EditOutcome.Conflict
-        return EditOutcome.Updated(
-            newItem = newMainItem,
-            urlChanged = mainItem is UrlPasteItem && mainItem.url != newContent,
-        )
+        return EditOutcome.Updated(newItem = newMainItem, urlChanged = urlChanged)
     }
 
     /**
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/paste/item/UpdatePasteItemHelper.kt` (modified, +4/-68)
```diff
@@ -4,81 +4,17 @@ import com.crosspaste.db.paste.PasteDao
 import com.crosspaste.paste.PasteData
 import com.crosspaste.paste.SearchContentService
 import com.crosspaste.paste.item.CreatePasteItemHelper.copy
-import com.crosspaste.paste.item.CreatePasteItemHelper.createColorPasteItem
 import kotlinx.serialization.json.put
 
+/**
+ * Adjusts a single item's metadata (name, URL title). Content edits go through
+ * [com.crosspaste.paste.PasteContentEditor], which keeps companion flavors in sync.
+ */
 class UpdatePasteItemHelper(
     val pasteDao: PasteDao,
     val pasteItemReader: PasteItemReader,
     val searchContentService: SearchContentService,
 ) {
-    suspend fun updateColor(
-        pasteData: PasteData,
-        newColor: Long,
-        colorPasteItem: ColorPasteItem,
-    ): Result<ColorPasteItem> {
-        val newPasteItem =
-            createColorPasteItem(
-                identifiers = colorPasteItem.identifiers,
-                color = newColor.toInt(),
-                extraInfo = colorPasteItem.extraInfo,
-            )
-        return updateIfUnchanged(
-            pasteData = pasteData,
-            pasteItem = newPasteItem,
-            pasteSearchContent =
-                searchContentService.createSearchContent(
-                    pasteData.source,
-                    pasteItemReader.getSearchContent(newPasteItem),
-                ),
-        )
-    }
-
-    suspend fun updateHtml(
-        pasteData: PasteData,
-        newHtml: String,
-        backgroundColor: Int? = null,
-        htmlPasteItem: HtmlPasteItem,
-    ): Result<HtmlPasteItem> {
-        var newPasteItem = htmlPasteItem.copy(newHtml)
-
-        if (backgroundColor != null) {
-            newPasteItem =
-                newPasteItem.copy {
-                    put(PasteItemProperties.BACKGROUND, backgroundColor)
-                } as HtmlPasteItem
-        }
-
-        return updateIfUnchanged(
-            pasteData = pasteData,
-            pasteItem = newPasteItem,
-            pasteSearchContent =
-                searchContentService.createSearchContent(
-                    pasteData.source,
-                    pasteItemReader.getSearchContent(newPasteItem),
-                ),
-            addedSize = newPasteItem.size - htmlPasteItem.size,
-        )
-    }
-
-    suspend fun updateText(
-        pasteData: PasteData,
-        newText: String,
-        textPasteItem: TextPasteItem,
-    ): Result<TextPasteItem> {
-        val newPasteItem = textPasteItem.copy(newText)
-        return updateIfUnchanged(
-            pasteData = pasteData,
-            pasteItem = newPasteItem,
-            pasteSearchContent =
-                searchContentService.createSearchContent(
-                    pasteData.source,
-                    pasteItemReader.getSearchContent(newPasteItem),
-                ),
-            addedSize = newPasteItem.size - textPasteItem.size,
-        )
-    }
-
     suspend fun updateTitle(
         pasteData: PasteData,
         title: String,
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/base/DesktopUISupport.kt` (modified, +9/-13)
```diff
@@ -6,12 +6,12 @@ import com.crosspaste.app.DesktopAppWindowManager
 import com.crosspaste.i18n.GlobalCopywriter
 import com.crosspaste.notification.MessageType
 import com.crosspaste.notification.NotificationManager
+import com.crosspaste.paste.PasteContentEditor
 import com.crosspaste.paste.PasteData
 import com.crosspaste.paste.PasteType
 import com.crosspaste.paste.item.ColorPasteItem
 import com.crosspaste.paste.item.PasteFiles
 import com.crosspaste.paste.item.PasteRtf
-import com.crosspaste.paste.item.UpdatePasteItemHelper
 import com.crosspaste.paste.item.UrlPasteItem
 import com.crosspaste.paste.item.getFilePaths
 import com.crosspaste.path.UserDataPathProvider
@@ -39,7 +39,7 @@ class DesktopUISupport(
     private val copywriter: GlobalCopywriter,
     private val notificationManager: NotificationManager,
     private val platform: Platform,
-    private val updatePasteItemHelper: UpdatePasteItemHelper,
+    private val pasteContentEditor: PasteContentEditor,
     private val userDataPathProvider: UserDataPathProvider,
     private val appWindowManager: DesktopAppWindowManager,
     private val actionScope: CoroutineScope = namedScope(ioDispatcher, "DesktopUISupport"),
@@ -167,17 +167,13 @@ class DesktopUISupport(
 
                     logger.info { "Selected color: $rgbColor" }
                     actionScope.launch {
-                        updatePasteItemHelper
-                            .updateColor(
-                                pasteData,
-                                newColor,
-                                pasteItem,
-                            ).onFailure {
-                                notificationManager.sendNotification(
-                                    title = { copywriter.getText("save_failed") },
-                                    messageType = MessageType.Error,
-                                )
-                            }
+                        val outcome = pasteContentEditor.updateColor(pasteData, newColor.toInt())
+                        if (outcome !is PasteContentEditor.EditOutcome.Updated) {
+                            notificationManager.sendNotification(
+                                title = { copywriter.getText("save_failed") },
+                                messageType = MessageType.Error,
+                            )
+                        }
                     }
                 }
             }
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/paste/edit/EditContentCommon.kt` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+package com.crosspaste.ui.paste.edit
+
+import androidx.compose.material3.FloatingActionButton
+import androidx.compose.material3.Icon
+import androidx.compose.material3.MaterialTheme
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.input.key.KeyEvent
+import androidx.compose.ui.input.key.KeyEventType
+import androidx.compose.ui.input.key.isCtrlPressed
+import androidx.compose.ui.input.key.isMetaPressed
+import androidx.compose.ui.input.key.key
+import androidx.compose.ui.input.key.type
+import com.composables.icons.materialsymbols.MaterialSymbols
+import com.composables.icons.materialsymbols.rounded.Save
+import com.crosspaste.i18n.GlobalCopywriter
+import com.crosspaste.notification.MessageType
+import com.crosspaste.notification.NotificationManager
+import com.crosspaste.paste.PasteContentEditor
+import org.koin.compose.koinInject
+
+/** Cmd+S on macOS, Ctrl+S elsewhere. */
+fun KeyEvent.isSaveShortcut(isMac: Boolean): Boolean =
+    type == KeyEventType.KeyDown &&
+        key == Key.S &&
+        if (isMac) isMetaPressed else isCtrlPressed
+
+/** Notifies the save result; returns true when the edit was stored. */
+fun NotificationManager.notifyEditOutcome(outcome: PasteContentEditor.EditOutcome): Boolean {
+    val saved = outcome is PasteContentEditor.EditOutcome.Updated
+    sendNotification(
+        title = { it.getText(if (saved) "save_successful" else "save_failed") },
+        messageType = if (saved) MessageType.Success else MessageType.Error,
+    )
+    return saved
+}
+
+@Composable
+fun EditSaveButton(
+    hasChanges: Boolean,
+    onSave: () -> Unit,
+    modifier: Modifier = Modifier,
+) {
+    val copywriter = koinInject<GlobalCopywriter>()
+    val colorScheme = MaterialTheme.colorScheme
+    FloatingActionButton(
+        onClick = onSave,
+        modifier = modifier,
+        containerColor = if (hasChanges) colorScheme.primaryContainer else colorScheme.surfaceVariant,
+        contentColor =
+            if (hasChanges) colorScheme.onPrimaryContainer else colorScheme.onSurfaceVariant.copy(alpha = 0.3f),
+    ) {
+        Icon(
+            imageVector = MaterialSymbols.Rounded.Save,
+            contentDescription = copywriter.getText("save"),
+        )
+    }
+}
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/paste/edit/PasteHtmlEditContentView.kt` (modified, +15/-66)
```diff
@@ -7,7 +7,6 @@ import androidx.compose.foundation.layout.offset
 import androidx.compose.foundation.layout.padding
 import androidx.compose.material3.ExperimentalMaterial3Api
 import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
-import androidx.compose.material3.FloatingActionButton
 import androidx.compose.material3.FloatingToolbarDefaults
 import androidx.compose.material3.HorizontalFloatingToolbar
 import androidx.compose.material3.Icon
@@ -27,13 +26,7 @@ import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
 import androidx.compose.ui.focus.focusProperties
 import androidx.compose.ui.graphics.Color
-import androidx.compose.ui.input.key.Key
-import androidx.compose.ui.input.key.KeyEventType
-import androidx.compose.ui.input.key.isCtrlPressed
-import androidx.compose.ui.input.key.isMetaPressed
-import androidx.compose.ui.input.key.key
 import androidx.compose.ui.input.key.onPreviewKeyEvent
-import androidx.compose.ui.input.key.type
 import androidx.compose.ui.text.AnnotatedString
 import androidx.compose.ui.text.SpanStyle
 import androidx.compose.ui.text.TextRange
@@ -49,14 +42,11 @@ import com.composables.icons.materialsymbols.rounded.Format_italic
 import com.composables.icons.materialsymbols.rounded.Format_strikethrough
 import com.composables.icons.materialsymbols.rounded.Format_underlined
 import com.composables.icons.materialsymbols.rounded.Redo
-import com.composables.icons.materialsymbols.rounded.Save
 import com.composables.icons.materialsymbols.rounded.Undo
 import com.crosspaste.app.DesktopAppWindowManager
-import com.crosspaste.i18n.GlobalCopywriter
-import com.crosspaste.notification.MessageType
 import com.crosspaste.notification.NotificationManager
+import com.crosspaste.paste.PasteContentEditor
 import com.crosspaste.paste.item.HtmlPasteItem
-import com.crosspaste.paste.item.UpdatePasteItemHelper
 import com.crosspaste.platform.Platform
 import com.crosspaste.ui.LocalThemeState
 import com.crosspaste.ui.base.InnerScaffold
@@ -82,9 +72,8 @@ private const val MAX_UNDO_STACK_SIZE = 50
 @Composable
 fun PasteDataScope.PasteHtmlEditContentView() {
     val appWindowManager = koinInject<DesktopAppWindowManager>()
-    val copywriter = koinInject<GlobalCopywriter>()
     val notificationManager = koinInject<NotificationManager>()
-    val updatePasteItemHelper = koinInject<UpdatePasteItemHelper>()
+    val pasteContentEditor = koinInject<PasteContentEditor>()
     val platform = koinInject<Platform>()
 
     val scope = rememberCoroutineScope()
@@ -212,28 +201,14 @@ fun PasteDataScope.PasteHtmlEditContentView() {
         if (hasChanges) {
             scope.launch {
                 val newHtml = richTextState.toHtml()
-                updatePasteItemHelper
-                    .updateHtml(
-                        pasteData,
-                        newHtml,
-                        htmlPasteItem.getBackgroundColor(),
-                        htmlPasteItem,
-                    ).onSuccess {
-                        savedAnnotatedString = richTextState.annotatedString
-                        currentHtml = newHtml
-                        undoStack.clear()
-                        redoStack.clear()
-                        notificationManager.sendNotification(
-                            title = { copywriter.getText("save_successful") },
-                            messageType = MessageType.Success,
-                        )
-                        appWindowManager.hideBubbleWindow()
-                    }.onFailure {
-                        notificationManager.sendNotification(
-                            title = { copywriter.getText("save_failed") },
-                            messageType = MessageType.Error,
-                        )
-                    }
+                val outcome = pasteContentEditor.updateContent(pasteData, newHtml, pasteData.hash)
+                if (notificationManager.notifyEditOutcome(outcome)) {
+                    savedAnnotatedString = richTextState.annotatedString
+                    currentHtml = newHtml
+                    undoStack.clear()
+                    redoStack.clear()
+                    appWindowManager.hideBubbleWindow()
+                }
             }
         }
     }
@@ -244,15 +219,7 @@ fun PasteDataScope.PasteHtmlEditContentView() {
                 .fillMaxSize()
                 .clip(tinyRoundedCornerShape)
                 .onPreviewKeyEvent { keyEvent ->
-                    if (keyEvent.type == KeyEventType.KeyDown &&
-                        keyEvent.key == Key.S &&
-                        (if (isMac) keyEvent.isMetaPressed else keyEvent.isCtrlPressed)
-                    ) {
-                        save()
-                        true
-                    } else {
-                        false
-                    }
+                    keyEvent.isSaveShortcut(isMac).also { if (it) save() }
                 },
         containerColor = MaterialTheme.colorScheme.surface,
      
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/paste/edit/PasteTextEditContentView.kt` (modified, +54/-140)
```diff
@@ -7,39 +7,26 @@ import androidx.compose.foundation.layout.offset
 import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
-import androidx.compose.material3.FloatingActionButton
 import androidx.compose.material3.FloatingToolbarDefaults
 import androidx.compose.material3.HorizontalFloatingToolbar
 import androidx.compose.material3.Icon
 import androidx.compose.material3.IconButton
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.runtime.Composable
-import androidx.compose.runtime.getValue
-import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
-import androidx.compose.runtime.setValue
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
-import androidx.compose.ui.input.key.Key
-import androidx.compose.ui.input.key.KeyEventType
-import androidx.compose.ui.input.key.isCtrlPressed
-import androidx.compose.ui.input.key.isMetaPressed
-import androidx.compose.ui.input.key.key
 import androidx.compose.ui.input.key.onPreviewKeyEvent
-import androidx.compose.ui.input.key.type
 import androidx.compose.ui.unit.dp
 import com.composables.icons.materialsymbols.MaterialSymbols
 import com.composables.icons.materialsymbols.rounded.Close
 import com.composables.icons.materialsymbols.rounded.Redo
-import com.composables.icons.materialsymbols.rounded.Save
 import com.composables.icons.materialsymbols.rounded.Undo
 import com.crosspaste.app.DesktopAppWindowManager
-import com.crosspaste.i18n.GlobalCopywriter
-import com.crosspaste.notification.MessageType
 import com.crosspaste.notification.NotificationManager
+import com.crosspaste.paste.PasteContentEditor
 import com.crosspaste.paste.item.TextPasteItem
-import com.crosspaste.paste.item.UpdatePasteItemHelper
 import com.crosspaste.platform.Platform
 import com.crosspaste.ui.base.CustomTextField
 import com.crosspaste.ui.base.InnerScaffold
@@ -52,73 +39,26 @@ import com.crosspaste.ui.theme.AppUISize.tinyRoundedCornerShape
 import kotlinx.coroutines.launch
 import org.koin.compose.koinInject
 
-private const val MAX_HISTORY_SIZE = 50
-
-@OptIn(ExperimentalMaterial3ExpressiveApi::class)
 @Composable
 fun PasteDataScope.PasteTextEditContentView() {
     val appWindowManager = koinInject<DesktopAppWindowManager>()
-    val copywriter = koinInject<GlobalCopywriter>()
     val notificationManager = koinInject<NotificationManager>()
-    val updatePasteItemHelper = koinInject<UpdatePasteItemHelper>()
+    val pasteContentEditor = koinInject<PasteContentEditor>()
     val platform = koinInject<Platform>()
 
     val scope = rememberCoroutineScope()
     val isMac = remember { platform.isMacos() }
 
-    val textPasteItem = getPasteItem(TextPasteItem::class)
-    val originalText = remember(pasteData.id, pasteData.hash) { textPasteItem.text }
-    var textValue by remember(pasteData.id, pasteData.hash) { mutableStateOf(originalText) }
-    var history by remember(pasteData.id, pasteData.hash) { mutableStateOf(listOf(originalText)) }
-    var historyIndex by remember(pasteData.id, pasteData.hash) { mutableStateOf(0) }
-
-    val canUndo = historyIndex > 0
-    val canRedo = historyIndex < history.size - 1
-    val hasChanges = textValue != originalText && textValue.isNotEmpty()
-
-    fun updateTextWithHistory(newText: String) {
-        if (newText == textValue) return
-        val newHistory = history.subList(0, historyIndex + 1).toMutableList()
-        newHistory.add(newText)
-        if (newHistory.size > MAX_HISTORY_SIZE) {
-            newHistory.removeAt(0)
-        }
-        history = newHistory
-        historyIndex = newHistory.size - 1
-        textValue = newText
-    }
-
-    fun undo() {
-        if (canUndo) {
-            historyIndex -= 1
-            textValue = history[historyIndex]
-        }
-    }
-
-    fun redo() {
-        if (canRedo) {
-            historyIndex += 1
-            textValue = history[historyIndex]
-        }
-    }
+    val originalText = remember(pasteData.id, pasteData.hash) { getPasteItem(TextPasteItem::class).text }
+    val history = remember(pasteData.id, pasteData.hash) { TextEditHistory(originalText) }
+    val hasChanges = history.text != originalText && history.text.isNotEmpty()
 
     fun save() {
-        if (hasChanges) {
-            scope.launch {
-                updatePasteItemHelper
-                    .updateText(pasteData, textValue, textPasteItem)
-                    .onSuccess {
-                        notificationManager.sendNotification(
-                            title = { copywriter.getText("save_successful") },
-                            messageType = MessageType.Success,
-                        )
-                        appWindowManager.hideBubbleWindow()
-                    }.onFailure {
-                        notificationManager.sendNotifica
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/paste/edit/TextEditHistory.kt` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+package com.crosspaste.ui.paste.edit
+
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.setValue
+
+private const val MAX_HISTORY_SIZE = 50
+
+/** Bounded undo/redo history for the plain-text editor. */
+class TextEditHistory(
+    initialText: String,
+) {
+    private var history by mutableStateOf(listOf(initialText))
+    private var index by mutableStateOf(0)
+
+    val text: String get() = history[index]
+    val canUndo: Boolean get() = index > 0
+    val canRedo: Boolean get() = index < history.size - 1
+
+    fun push(newText: String) {
+        if (newText == text) return
+        history = (history.subList(0, index + 1) + newText).takeLast(MAX_HISTORY_SIZE)
+        index = history.size - 1
+    }
+
+    fun undo() {
+        if (canUndo) index -= 1
+    }
+
+    fun redo() {
+        if (canRedo) index += 1
+    }
+}
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/paste/PasteContentEditorTest.kt` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+package com.crosspaste.paste
+
+import com.crosspaste.app.AppInfo
+import com.crosspaste.db.TestDriverFactory
+import com.crosspaste.db.createDatabase
+import com.crosspaste.db.paste.SqlPasteDao
+import com.crosspaste.paste.item.ColorPasteItem
+import com.crosspaste.paste.item.CreatePasteItemHelper.createColorPasteItem
+import com.crosspaste.paste.item.CreatePasteItemHelper.createHtmlPasteItem
+import com.crosspaste.paste.item.CreatePasteItemHelper.createTextPasteItem
+import com.crosspaste.paste.item.CreatePasteItemHelper.createUrlPasteItem
+import com.crosspaste.paste.item.DefaultPasteItemReader
+import com.crosspaste.paste.item.HtmlPasteItem
+import com.crosspaste.paste.item.PasteItem
+import com.crosspaste.paste.item.PasteItemProperties
+import com.crosspaste.paste.item.TextPasteItem
+import com.crosspaste.paste.item.UrlPasteItem
+import com.crosspaste.utils.DateUtils
+import com.crosspaste.utils.getJsonUtils
+import io.mockk.mockk
+import kotlinx.coroutines.test.runTest
+import kotlinx.serialization.json.buildJsonObject
+import kotlinx.serialization.json.put
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertIs
+import kotlin.test.assertNotNull
+import kotlin.test.assertTrue
+
+class PasteContentEditorTest {
+
+    // Eagerly initialize JsonUtils to avoid circular class initialization between
+    // PasteItem.Companion (which calls getJsonUtils()) and TextPasteItem
+    @Suppress("unused")
+    private val jsonUtils = getJsonUtils()
+
+    private val searchContentService =
+        object : SearchContentService {
+            override fun createSearchContent(
+                source: String?,
+                searchContentList: List<String>,
+            ): String = searchContentList.joinToString(" ")
+
+            override fun createSearchTerms(queryString: String): List<String> = listOf(queryString)
+        }
+
+    private val pasteItemReader = DefaultPasteItemReader()
+
+    private val pasteDao =
+        SqlPasteDao(
+            appInfo = AppInfo("test-instance", "1.0.0", "abc", "testUser"),
+            database = createDatabase(TestDriverFactory()),
+            pasteItemReader = pasteItemReader,
+            searchContentService = searchContentService,
+            taskSubmitter = mockk(relaxed = true),
+            userDataPathProvider = mockk(relaxed = true),
+        )
+
+    private val editor = PasteContentEditor(pasteDao, pasteItemReader, searchContentService)
+
+    private suspend fun storePaste(
+        appearItem: PasteItem,
+        companions: List<PasteItem>,
+        pasteType: PasteType,
+    ): PasteData {
+        val id =
+            pasteDao.createPasteData(
+                PasteData(
+                    appInstanceId = "test-instance",
+                    pasteAppearItem = appearItem,
+                    pasteCollection = PasteCollection(companions),
+                    pasteType = pasteType.type,
+                    size = appearItem.size + companions.sumOf { it.size },
+                    hash = appearItem.hash,
+                    pasteState = PasteState.LOADED,
+                    createTime = DateUtils.nowEpochMilliseconds(),
+                ),
+            )
+        return assertNotNull(pasteDao.getNoDeletePasteData(id))
+    }
+
+    @Test
+    fun `html edit re-derives the plain-text companion and drops underivable ones`() =
+        runTest {
+            val html =
+                createHtmlPasteItem(
+                    html = "<p>old words</p>",
+                    extraInfo = buildJsonObject { put(PasteItemProperties.BACKGROUND, 0xFF112233.toInt()) },
+                )
+            val pasteData =
+                storePaste(
+                    appearItem = html,
+                    companions =
+                        listOf(
+                            createTextPasteItem(text = "old words"),
+                            createUrlPasteItem(url = "https://old.example.com"),
+                        ),
+                    pasteType = PasteType.HTML_TYPE,
+                )
+            val newHtml = "<p>new words</p>"
+
+            val outcome = editor.updateContent(pasteData, newHtml, pasteData.hash)
+
+            assertIs<PasteContentEditor.EditOutcome.Updated>(outcome)
+            val stored = assertNotNull(pasteDao.getNoDeletePasteData(pasteData.id))
+            val storedHtml = assertIs<HtmlPasteItem>(stored.pasteAppearItem)
+            assertEquals(newHtml, storedHtml.html)
+            assertEquals(html.getBackgroundColor(), storedHtml.getBackgroundColor())
+            val companions = stored.pasteCollection.pasteItems
+            assertEquals(1, companions.size)
+            assertEquals("new words", assertIs<TextPasteItem>(companions.single()).text)
+            assertTrue(companions.none { it is UrlPasteItem })
+        }
+
+    @Test
+    fun `color edit re-derives the plain-text companion`() =
+        runTest {
+            val red = createColorPasteItem(color = 
```

---

### Incident Patch 5: `9f27f1bc` (2026-10-05)
**Commit Message**: :bug: remove tag links when a tag or paste is deleted (#5101) (#5102)

foreign_keys is off on every driver, so the ON DELETE CASCADE on
PasteTagEntity never fired and pastes of a deleted tag stayed tagged
forever, escaping cleanup, dedup and clear-history. Delete the links
explicitly and purge existing orphans in migration 4.

**File**: `app/src/desktopTest/kotlin/com/crosspaste/db/paste/PasteDaoTest.kt` (modified, +74/-12)
```diff
@@ -1,6 +1,7 @@
 package com.crosspaste.db.paste
 
 import app.cash.turbine.test
+import com.crosspaste.Database
 import com.crosspaste.app.AppInfo
 import com.crosspaste.db.TestDriverFactory
 import com.crosspaste.db.createDatabase
@@ -106,6 +107,15 @@ class PasteDaoTest {
         )
     }
 
+    private fun stubDeleteTaskSubmission() {
+        coEvery { taskSubmitter.submit(any()) } coAnswers {
+            val block = firstArg<suspend com.crosspaste.task.TaskBuilder.() -> Unit>()
+            val builder = mockk<com.crosspaste.task.TaskBuilder>(relaxed = true)
+            every { builder.addDeletePasteTasks(any()) } returns builder
+            block.invoke(builder)
+        }
+    }
+
     // --- Create and retrieve ---
 
     @Test
@@ -239,12 +249,7 @@ class PasteDaoTest {
     @Test
     fun `markDeletePasteData marks paste as deleted`() =
         runTest {
-            coEvery { taskSubmitter.submit(any()) } coAnswers {
-                val block = firstArg<suspend com.crosspaste.task.TaskBuilder.() -> Unit>()
-                val builder = mockk<com.crosspaste.task.TaskBuilder>(relaxed = true)
-                every { builder.addDeletePasteTasks(any()) } returns builder
-                block.invoke(builder)
-            }
+            stubDeleteTaskSubmission()
 
             val pasteData = createTestPasteData()
             val id = pasteDao.createPasteData(pasteData)
@@ -259,12 +264,7 @@ class PasteDaoTest {
     @Test
     fun `getDeletePasteData retrieves marked-deleted paste`() =
         runTest {
-            coEvery { taskSubmitter.submit(any()) } coAnswers {
-                val block = firstArg<suspend com.crosspaste.task.TaskBuilder.() -> Unit>()
-                val builder = mockk<com.crosspaste.task.TaskBuilder>(relaxed = true)
-                every { builder.addDeletePasteTasks(any()) } returns builder
-                block.invoke(builder)
-            }
+            stubDeleteTaskSubmission()
 
             val pasteData = createTestPasteData()
             val id = pasteDao.createPasteData(pasteData)
@@ -518,6 +518,68 @@ class PasteDaoTest {
             }
         }
 
+    @Test
+    fun `deletePasteTagBlock unlinks tagged pastes so cleanup can reclaim them`() =
+        runTest {
+            stubDeleteTaskSubmission()
+            val pasteData = createTestPasteData()
+            val pasteId = pasteDao.createPasteData(pasteData)
+            val tagId = pasteTagDao.createPasteTag("to_delete", 0xFF0000L)
+            pasteTagDao.switchPinPasteTagBlock(pasteId, tagId)
+
+            pasteTagDao.deletePasteTagBlock(tagId)
+
+            assertTrue(pasteTagDao.getPasteTagsBlock(pasteId).isEmpty())
+            assertEquals(0L, pasteDao.getSize(allOrTagged = false))
+
+            pasteDao.markDeleteByCleanTime(pasteData.createTime + 1, null)
+            assertNull(pasteDao.getNoDeletePasteData(pasteId))
+        }
+
+    @Test
+    fun `deletePasteData removes the paste's tag links`() =
+        runTest {
+            stubDeleteTaskSubmission()
+            val pasteId = pasteDao.createPasteData(createTestPasteData())
+            val tagId = pasteTagDao.createPasteTag("kept", 0xFF0000L)
+            pasteTagDao.switchPinPasteTagBlock(pasteId, tagId)
+            pasteDao.markDeletePasteData(pasteId)
+
+            pasteDao.deletePasteData(pasteId)
+
+            assertTrue(pasteTagDao.getPasteTagsBlock(pasteId).isEmpty())
+        }
+
+    @Test
+    fun `migration 4 removes tag links whose tag or paste no longer exists`() {
+        val driverFactory = TestDriverFactory()
+        val queries = createDatabase(driverFactory).tagDatabaseQueries
+        val driver = driverFactory.sqlDriver!!
+        try {
+            val liveTagId =
+                queries.transactionWithResult {
+                    queries.createTag("live", 0L, 0L)
+                    queries.getLastId().executeAsOne()
+                }
+            driver.execute(
+                null,
+                "INSERT INTO PasteDataEntity(id, appInstanceId, favorite, pasteCollection, size, hash, " +
+                    "createTime, remote) VALUES (1, 'a', 0, '', 0, 'h', 0, 0)",
+                0,
+            )
+            queries.pinPasteTag(1L, liveTagId)
+            queries.pinPasteTag(1L, liveTagId + 100) // tag deleted
+            queries.pinPasteTag(2L, liveTagId) // paste deleted
+
+            Database.Schema.migrate(driver, 4, 5)
+
+            assertEquals(listOf(liveTagId), queries.getPasteTags(1L).executeAsList())
+            assertTrue(queries.getPasteTags(2L).executeAsList().isEmpty())
+        } finally {
+            driverFactory.closeDriver()
+        }
+    }
+
     @Test
     fun `getMaxSortOrder returns max sort order`() =
         runTest {
```

**File**: `shared/src/commonMain/kotlin/com/crosspaste/db/paste/SqlPasteDao.kt` (modified, +4/-1)
```diff
@@ -213,7 +213,10 @@ class SqlPasteDao(
         withContext(ioDispatcher) {
             getDeletePasteData(id)?.let {
                 it.clear(userDataPathProvider)
-                pasteDatabaseQueries.deletePasteData(listOf(id))
+                database.transaction {
+                    database.tagDatabaseQueries.deletePasteTagsByPasteIds(listOf(id))
+                    pasteDatabaseQueries.deletePasteData(listOf(id))
+                }
             }
         }
     }
```

**File**: `shared/src/commonMain/kotlin/com/crosspaste/db/paste/SqlPasteTagDao.kt` (modified, +4/-1)
```diff
@@ -120,7 +120,10 @@ class SqlPasteTagDao(
     }
 
     override fun deletePasteTagBlock(id: Long) {
-        tagDatabaseQueries.deleteTag(id)
+        database.transaction {
+            tagDatabaseQueries.deletePasteTagsByTagId(id)
+            tagDatabaseQueries.deleteTag(id)
+        }
     }
 
     override fun getAllTagsBlock(): List<PasteTag> = tagDatabaseQueries.getAllTags(PasteTag::mapper).executeAsList()
```

**File**: `shared/src/commonMain/sqldelight/com/crosspaste/db/TagDatabase.sq` (modified, +8/-0)
```diff
@@ -54,6 +54,14 @@ UPDATE TagEntity SET sortOrder = ? WHERE id = ?;
 deleteTag:
 DELETE FROM TagEntity WHERE id = ?;
 
+-- foreign_keys is off on every driver, so ON DELETE CASCADE never fires:
+-- links must be removed explicitly before deleting a tag or a paste.
+deletePasteTagsByTagId:
+DELETE FROM PasteTagEntity WHERE tagId = ?;
+
+deletePasteTagsByPasteIds:
+DELETE FROM PasteTagEntity WHERE pasteId IN ?;
+
 maxSortOrder:
 SELECT IFNULL(MAX(sortOrder), 0) FROM TagEntity;
 
```

**File**: `shared/src/commonMain/sqldelight/com/crosspaste/db/migrations/4.sqm` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+-- Remove tag links left behind by tag/paste deletes: foreign_keys was never
+-- enabled, so the ON DELETE CASCADE on PasteTagEntity never fired.
+DELETE FROM PasteTagEntity
+WHERE tagId NOT IN (SELECT id FROM TagEntity)
+   OR pasteId NOT IN (SELECT id FROM PasteDataEntity);
```

---

### Incident Patch 6: `04d9f639` (2026-10-05)
**Commit Message**: :bug: never overwrite an unreadable app config with defaults (#5098) (#5099)

Any load failure fell back to defaults silently, and the next save (e.g.
lastPasteboardChangeCount on exit) wrote those defaults over the user's
file. A single transient read error or truncated file reset every
setting, including a custom storage path.

Corrupt content is now moved to appConfig.json.corrupt before defaults
are used. Other read failures run the session on in-memory defaults and
block saves so the file is left intact. The single-key updateConfig now
delegates to the list overload.

**File**: `app/src/desktopMain/kotlin/com/crosspaste/config/DesktopConfigManager.kt` (modified, +36/-23)
```diff
@@ -7,6 +7,7 @@ import com.crosspaste.utils.LocaleUtils
 import io.github.oshai.kotlinlogging.KotlinLogging
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.StateFlow
+import kotlinx.serialization.SerializationException
 
 class DesktopConfigManager(
     private val configFilePersist: OneFilePersist,
@@ -15,14 +16,10 @@ class DesktopConfigManager(
 
     private val logger = KotlinLogging.logger {}
 
-    private val _config: MutableStateFlow<DesktopAppConfig> =
-        MutableStateFlow(
-            runCatching {
-                loadConfig() ?: createDefaultAppConfig()
-            }.getOrElse {
-                createDefaultAppConfig()
-            },
-        )
+    // Declared before _config: its initializer sets this flag.
+    private var saveBlocked = false
+
+    private val _config: MutableStateFlow<DesktopAppConfig> = MutableStateFlow(loadInitialConfig())
 
     override val config: StateFlow<DesktopAppConfig> = _config
 
@@ -35,25 +32,37 @@ class DesktopConfigManager(
             language = localeUtils.getLanguage(),
         )
 
-    @Synchronized
+    /**
+     * The defaults used on a failed load get written back by the next save, and
+     * background writers (e.g. pasteboard services on stop) save on every exit. So a
+     * user's config may only be replaced once it is safe:
+     * - Corrupt content is moved aside to `.corrupt` first, then defaults may be saved.
+     * - Any other failure (file locked, permission denied) may be transient, so this
+     *   session runs on defaults in memory and never saves over the file.
+     */
+    private fun loadInitialConfig(): DesktopAppConfig =
+        try {
+            loadConfig() ?: createDefaultAppConfig()
+        } catch (e: SerializationException) {
+            runCatching { configFilePersist.quarantine() }
+                .onSuccess { backupPath ->
+                    logger.error(e) { "App config is corrupt; backed it up to $backupPath and using defaults" }
+                }.onFailure { moveError ->
+                    saveBlocked = true
+                    logger.error(e) { "App config is corrupt and could not be backed up: $moveError" }
+                }
+            createDefaultAppConfig()
+        } catch (e: Exception) {
+            saveBlocked = true
+            logger.error(e) { "Failed to read app config; using defaults without saving them this session" }
+            createDefaultAppConfig()
+        }
+
     override fun updateConfig(
         key: String,
         value: Any,
     ) {
-        val oldConfig = _config.value
-        _config.value = oldConfig.copy(key, value)
-        runCatching {
-            saveConfig(_config.value)
-        }.onFailure { e ->
-            logger.error(e) { "Failed to save config" }
-            notificationManager?.let { manager ->
-                manager.sendNotification(
-                    title = { it.getText("failed_to_save_config") },
-                    messageType = MessageType.Error,
-                )
-            }
-            _config.value = oldConfig
-        }
+        updateConfig(listOf(key), listOf(value))
     }
 
     @Synchronized
@@ -68,6 +77,10 @@ class DesktopConfigManager(
             newConfig = newConfig.copy(key = keys[i], value = values[i])
         }
         _config.value = newConfig
+        if (saveBlocked) {
+            logger.warn { "Not saving config change to $keys: app config could not be read at startup" }
+            return
+        }
         runCatching {
             saveConfig(_config.value)
         }.onFailure { e ->
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/config/DesktopConfigManagerTest.kt` (modified, +44/-0)
```diff
@@ -6,6 +6,7 @@ import okio.Path.Companion.toOkioPath
 import java.nio.file.Files
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
 import kotlin.test.assertNotEquals
 import kotlin.test.assertNotNull
 import kotlin.test.assertTrue
@@ -161,4 +162,47 @@ class DesktopConfigManagerTest {
         manager.updateConfig("enableSyncImage", false)
         assertEquals(false, manager.getCurrentConfig().enableSyncImage)
     }
+
+    @Test
+    fun `corrupt config is quarantined before defaults are written`() {
+        val (_, configPath) = createConfigManager()
+        val configFile = configPath.toFile()
+        configFile.writeText("{ not json")
+
+        val manager = DesktopConfigManager(OneFilePersist(configPath), DesktopLocaleUtils)
+        assertEquals(13129, manager.getCurrentConfig().port)
+
+        manager.updateConfig("lastPasteboardChangeCount", 7)
+
+        val backup = configPath.parent!!.resolve("appConfig.json.corrupt").toFile()
+        assertEquals("{ not json", backup.readText())
+        assertTrue(configFile.readText().contains("lastPasteboardChangeCount"))
+    }
+
+    @Test
+    fun `unreadable config is never overwritten with defaults`() {
+        val (_, configPath) = createConfigManager()
+        val configFile = configPath.toFile()
+        val original = """{"port":5555}"""
+        configFile.writeText(original)
+        assertTrue(configFile.setReadable(false))
+        try {
+            val manager = DesktopConfigManager(OneFilePersist(configPath), DesktopLocaleUtils)
+            assertEquals(13129, manager.getCurrentConfig().port)
+
+            manager.updateConfig("lastPasteboardChangeCount", 7)
+
+            // The session keeps working in memory, but the user's file stays as it was.
+            assertEquals(7, manager.getCurrentConfig().lastPasteboardChangeCount)
+        } finally {
+            configFile.setReadable(true)
+        }
+        assertEquals(original, configFile.readText())
+        assertFalse(
+            configPath.parent!!
+                .resolve("appConfig.json.corrupt")
+                .toFile()
+                .exists(),
+        )
+    }
 }
```

---

### Incident Patch 7: `8631a5a2` (2026-10-05)
**Commit Message**: :bug: keep the owning record when a file is copied out of CrossPaste storage (#5096) (#5097)

Copying a file that lives in managed storage produces a ref item pointing
at the original record's folder with the same content hash. Same-hash
cleanup then deleted the original record and, with it, the files the new
ref record points at.

Exclude records that own any file the new ref item references from
same-hash cleanup; other cleanup is unchanged.

**File**: `app/src/commonMain/kotlin/com/crosspaste/paste/PasteReleaseService.kt` (modified, +32/-2)
```diff
@@ -13,6 +13,7 @@ import com.crosspaste.paste.item.PasteItemProperties
 import com.crosspaste.paste.item.PasteItemReader
 import com.crosspaste.paste.item.applyRenameMap
 import com.crosspaste.paste.item.bindItem
+import com.crosspaste.paste.item.getFilePaths
 import com.crosspaste.paste.plugin.process.DiscardOversizedNonFilePlugin
 import com.crosspaste.paste.plugin.process.PasteProcessPlugin
 import com.crosspaste.path.UserDataPathProvider
@@ -81,24 +82,53 @@ class PasteReleaseService(
         newPasteDataId: Long,
         newPasteDataType: Int,
         newPasteDataHash: String,
+        refFiles: PasteFiles? = null,
     ) {
         if (newPasteDataHash.isEmpty()) {
             return
         }
 
-        val idList =
+        val sameHashIds =
             pasteDao.getSameHashPasteDataIds(
                 newPasteDataHash,
                 newPasteDataType,
                 newPasteDataId,
             )
 
+        val idList =
+            refFiles?.let {
+                val referencedPaths = it.canonicalFilePaths()
+                sameHashIds.filterNot { id -> ownsAnyFile(id, referencedPaths) }
+            } ?: sameHashIds
+
         database.transaction {
             database.pasteDatabaseQueries.markDeletePasteData(idList)
             addDeletePasteTasks(idList)
         }
     }
 
+    /**
+     * Copying a file out of managed storage (e.g. after "reveal in file manager")
+     * yields a ref item pointing at files another record owns. Deleting that owner
+     * would delete the very files the new record refers to, so it is kept.
+     */
+    private fun ownsAnyFile(
+        pasteDataId: Long,
+        paths: Set<String>,
+    ): Boolean {
+        val pasteData = pasteDao.getNoDeletePasteDataBlock(pasteDataId) ?: return false
+        return pasteData
+            .getPasteAppearItems()
+            .filterIsInstance<PasteFiles>()
+            .filterNot { it.isRefFiles() }
+            .any { pasteFiles -> pasteFiles.canonicalFilePaths().any { it in paths } }
+    }
+
+    private fun PasteFiles.canonicalFilePaths(): Set<String> =
+        getFilePaths(userDataPathProvider)
+            .map { path -> runCatching { fileUtils.fileSystem.canonicalize(path) }.getOrDefault(path).toString() }
+            .toSet()
+
     suspend fun releaseLocalPasteData(
         id: Long,
         pasteItems: List<PasteItem>,
@@ -172,7 +202,7 @@ class PasteReleaseService(
 
                     if (pasteType.isFile() || pasteType.isImage()) {
                         if ((firstItem as PasteFiles).isRefFiles()) {
-                            markDeleteSameHash(id, pasteType.type, hash)
+                            markDeleteSameHash(id, pasteType.type, hash, refFiles = firstItem)
                         }
                     } else {
                         markDeleteSameHash(id, pasteType.type, hash)
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/paste/PasteReleaseServiceImageDedupTest.kt` (modified, +73/-2)
```diff
@@ -1,6 +1,8 @@
 package com.crosspaste.paste
 
 import com.crosspaste.app.AppInfo
+import com.crosspaste.config.AppConfig
+import com.crosspaste.config.CommonConfigManager
 import com.crosspaste.db.TestDriverFactory
 import com.crosspaste.db.createDatabase
 import com.crosspaste.db.paste.SqlPasteDao
@@ -9,17 +11,23 @@ import com.crosspaste.paste.item.CreatePasteItemHelper.createTextPasteItem
 import com.crosspaste.paste.item.DefaultPasteItemReader
 import com.crosspaste.paste.item.ImagesPasteItem
 import com.crosspaste.paste.item.PasteItem
+import com.crosspaste.path.PlatformUserDataPathProvider
+import com.crosspaste.path.UserDataPathProvider
 import com.crosspaste.presist.SingleFileInfoTree
 import com.crosspaste.task.TaskBuilder
 import com.crosspaste.task.TaskSubmitter
 import com.crosspaste.utils.DateUtils
 import com.crosspaste.utils.getJsonUtils
 import io.mockk.coVerify
+import io.mockk.every
 import io.mockk.mockk
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.async
 import kotlinx.coroutines.awaitAll
 import kotlinx.coroutines.test.runTest
+import okio.Path.Companion.toOkioPath
+import java.io.File
+import java.nio.file.Files
 import java.util.concurrent.CopyOnWriteArrayList
 import java.util.concurrent.atomic.AtomicInteger
 import kotlin.test.Test
@@ -131,6 +139,7 @@ class PasteReleaseServiceImageDedupTest {
         fun init(
             appInfo: AppInfo,
             searchContentService: SearchContentService,
+            userDataPathProvider: UserDataPathProvider,
         ) {
             pasteDao =
                 SqlPasteDao(
@@ -154,12 +163,31 @@ class PasteReleaseServiceImageDedupTest {
                     searchContentService = searchContentService,
                     syncRuntimeInfoDao = mockk(relaxed = true),
                     taskSubmitter = taskSubmitter,
-                    userDataPathProvider = mockk(relaxed = true),
+                    userDataPathProvider = userDataPathProvider,
                 )
         }
     }
 
-    private fun newFixture(): Fixture = Fixture().apply { init(appInfo, searchContentService) }
+    private fun newFixture(userDataPathProvider: UserDataPathProvider = mockk(relaxed = true)): Fixture =
+        Fixture().apply { init(appInfo, searchContentService, userDataPathProvider) }
+
+    private fun userDataPathProvider(storageDir: File): UserDataPathProvider {
+        val appConfig = mockk<AppConfig>()
+        every { appConfig.useDefaultStoragePath } returns true
+        val configManager = mockk<CommonConfigManager>()
+        every { configManager.getCurrentConfig() } returns appConfig
+        val platformProvider = mockk<PlatformUserDataPathProvider>()
+        every { platformProvider.getUserDefaultStoragePath() } returns storageDir.toOkioPath()
+        return UserDataPathProvider(configManager, platformProvider)
+    }
+
+    private fun refImageItem(basePath: File): ImagesPasteItem =
+        createImagesPasteItem(
+            identifiers = listOf("image/png"),
+            basePath = basePath.absolutePath,
+            relativePathList = listOf("a.png"),
+            fileInfoTreeMap = mapOf("a.png" to SingleFileInfoTree(size = 10L, hash = "file-hash")),
+        )
 
     private fun imageItem(fileHash: String = "file-hash"): ImagesPasteItem =
         createImagesPasteItem(
@@ -432,4 +460,47 @@ class PasteReleaseServiceImageDedupTest {
             assertNotNull(fixture.pasteDao.getDeletePasteData(discardedId))
             assertContentEquals(listOf(discardedId), fixture.taskSubmitter.builder.deleteIds)
         }
+
+    @Test
+    fun `ref item pointing into managed storage does not mark the original deleted`() =
+        runTest {
+            val tempDir = Files.createTempDirectory("ref-into-storage").toFile()
+            tempDir.deleteOnExit()
+            val storageDir = File(tempDir, "storage")
+            val fixture = newFixture(userDataPathProvider(storageDir))
+            // The original record owns storage/images/img/a.png; copying that file
+            // from the file manager yields a ref item whose basePath is its folder.
+            val ownedFile = File(storageDir, "images/img/a.png").also { it.parentFile.mkdirs() }
+            ownedFile.writeText("png")
+            val originalId =
+                fixture.createLoadedRecord(imageItem(), PasteType.IMAGE_TYPE, DateUtils.nowEpochMilliseconds())
+            val loadingId = fixture.createLoadingRecord()
+
+            fixture.service.releaseLocalPasteData(loadingId, listOf(refImageItem(ownedFile.parentFile)), null)
+
+            assertTrue(
+                fixture.taskSubmitter.builder.deleteIds
+                    .isEmpty(),
+            )
+            assertNotNull(fixture.pasteDao.getNoDeletePasteDataBlock(originalId))
+            assertNotNull(fixture.pasteDao.getNoDeletePasteDataBlock(loadingId))
+            assertTrue(ownedFile.exists())
+        }
+
+    @Test
+    fun `ref item outside managed storage still removes same-hash r
```

---

### Incident Patch 8: `fd47d0fd` (2026-10-05)
**Commit Message**: :bug: reject import records whose paths escape managed storage (#5094) (#5095)

Imported .data archives are untrusted input. appInstanceId and file names
from the archive became path components unchecked, so a crafted record
(e.g. appInstanceId "../../x" or an absolute path) made import create
directories and move files outside managed storage.

Validate appInstanceId for every record, and fileInfoTreeMap keys plus
relativePathList names for file records, before anything is stored.

**File**: `app/src/commonMain/kotlin/com/crosspaste/paste/PasteImportService.kt` (modified, +1/-0)
```diff
@@ -147,6 +147,7 @@ class PasteImportService(
     ): Boolean {
         var recordId: Long? = null
         return runCatching {
+            userDataPathProvider.validateImportPaths(pasteData)
             val id = pasteDao.createPasteData(pasteData)
             recordId = id
 
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/paste/PasteExportImportServiceTest.kt` (modified, +149/-0)
```diff
@@ -1,25 +1,34 @@
 package com.crosspaste.paste
 
 import com.crosspaste.app.AppFileType
+import com.crosspaste.config.AppConfig
+import com.crosspaste.config.CommonConfigManager
 import com.crosspaste.db.paste.PasteDao
 import com.crosspaste.notification.NotificationManager
 import com.crosspaste.paste.item.CreatePasteItemHelper.createColorPasteItem
+import com.crosspaste.paste.item.CreatePasteItemHelper.createFilesPasteItem
 import com.crosspaste.paste.item.CreatePasteItemHelper.createHtmlPasteItem
 import com.crosspaste.paste.item.CreatePasteItemHelper.createRtfPasteItem
 import com.crosspaste.paste.item.CreatePasteItemHelper.createTextPasteItem
 import com.crosspaste.paste.item.CreatePasteItemHelper.createUrlPasteItem
 import com.crosspaste.paste.item.PasteItem
 import com.crosspaste.paste.item.PasteItemReader
 import com.crosspaste.paste.item.PasteText
+import com.crosspaste.path.PlatformUserDataPathProvider
 import com.crosspaste.path.UserDataPathProvider
+import com.crosspaste.presist.SingleFileInfoTree
 import com.crosspaste.utils.DateUtils
 import com.crosspaste.utils.getCodecsUtils
 import com.crosspaste.utils.getCompressUtils
 import com.crosspaste.utils.getJsonUtils
 import io.mockk.coEvery
+import io.mockk.coVerify
 import io.mockk.every
 import io.mockk.mockk
+import kotlinx.coroutines.CompletableDeferred
+import kotlinx.coroutines.runBlocking
 import kotlinx.coroutines.test.runTest
+import kotlinx.coroutines.withTimeout
 import okio.Path.Companion.toOkioPath
 import okio.buffer
 import okio.sink
@@ -28,8 +37,10 @@ import java.io.File
 import java.nio.file.Files
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
 import kotlin.test.assertNotNull
 import kotlin.test.assertTrue
+import kotlin.time.Duration.Companion.seconds
 
 class PasteExportImportServiceTest {
 
@@ -408,4 +419,142 @@ class PasteExportImportServiceTest {
 
             assertEquals(PasteImportResult.Failed, result)
         }
+
+    // --- Import must keep archive-controlled paths inside managed storage ---
+
+    @Test
+    fun `import rejects records whose appInstanceId escapes storage`() {
+        val tempDir = Files.createTempDirectory("import-escape-test").toFile()
+        tempDir.deleteOnExit()
+        val escapingIds =
+            listOf(
+                "../../escaped-relative",
+                File(tempDir, "escaped-absolute").absolutePath,
+                "C:escaped-drive",
+            )
+
+        for (appInstanceId in escapingIds) {
+            val pasteDao = mockk<PasteDao>(relaxed = true)
+            val result =
+                importArchive(
+                    tempDir = tempDir,
+                    pasteDao = pasteDao,
+                    pasteData = createFilesPasteData(appInstanceId, "a.sh"),
+                )
+
+            assertEquals(PasteImportResult.Completed(0, 1), result, appInstanceId)
+            coVerify(exactly = 0) { pasteDao.createPasteData(any()) }
+        }
+        assertFalse(File(tempDir, "escaped-relative").exists())
+        assertFalse(File(tempDir, "escaped-absolute").exists())
+    }
+
+    @Test
+    fun `import rejects records whose file name escapes the paste directory`() {
+        val tempDir = Files.createTempDirectory("import-escape-name-test").toFile()
+        tempDir.deleteOnExit()
+        val pasteDao = mockk<PasteDao>(relaxed = true)
+
+        val result =
+            importArchive(
+                tempDir = tempDir,
+                pasteDao = pasteDao,
+                pasteData = createFilesPasteData("remote-app", "sub/.."),
+            )
+
+        assertEquals(PasteImportResult.Completed(0, 1), result)
+        coVerify(exactly = 0) { pasteDao.createPasteData(any()) }
+    }
+
+    @Test
+    fun `import moves file resources into managed storage`() {
+        val tempDir = Files.createTempDirectory("import-files-test").toFile()
+        tempDir.deleteOnExit()
+        val pasteDao = mockk<PasteDao>(relaxed = true)
+        coEvery { pasteDao.createPasteData(any()) } returns 42L
+
+        val result =
+            importArchive(
+                tempDir = tempDir,
+                pasteDao = pasteDao,
+                pasteData = createFilesPasteData("remote-app", "a.txt"),
+                archiveFiles = mapOf("remote-app/1/a.txt" to "hello"),
+            )
+
+        assertEquals(PasteImportResult.Completed(1, 1), result)
+        val imported =
+            File(tempDir, "storage/files/remote-app")
+                .walkTopDown()
+                .single { it.name == "a.txt" }
+        assertEquals("42", imported.parentFile.name)
+        assertEquals("hello", imported.readText())
+    }
+
+    private fun createFilesPasteData(
+        appInstanceId: String,
+        fileName: String,
+    ): PasteData {
+        val item =
+            createFilesPasteItem(
+                relativePathList = listOf(fileName),
+                fileInfoTreeMap = mapOf(fileName to SingleFileInfoTree(size = 5, hash = "h")
```

**File**: `shared/src/commonMain/kotlin/com/crosspaste/path/UserDataPathProvider.kt` (modified, +17/-0)
```diff
@@ -4,6 +4,7 @@ import com.crosspaste.app.AppFileType
 import com.crosspaste.config.CommonConfigManager
 import com.crosspaste.exception.PasteException
 import com.crosspaste.exception.StandardErrorCode
+import com.crosspaste.paste.PasteData
 import com.crosspaste.paste.item.PasteFiles
 import com.crosspaste.paste.item.getAppFileType
 import com.crosspaste.paste.item.getFilePaths
@@ -139,6 +140,22 @@ class UserDataPathProvider(
         }
     }
 
+    /**
+     * Import archives are untrusted input: [PasteData.appInstanceId] and file names
+     * become path components under managed storage, so they get the same component
+     * rules as received pastes. File names are taken from relativePathList because
+     * that is what import lays files out by, and it need not match fileInfoTreeMap keys.
+     */
+    fun validateImportPaths(pasteData: PasteData) {
+        validateStorageComponent(pasteData.appInstanceId)
+        pasteData.getPasteAppearItems().filterIsInstance<PasteFiles>().forEach { pasteFiles ->
+            validateReceivePaths(pasteData.appInstanceId, pasteFiles)
+            pasteFiles.relativePathList.forEach { relativePath ->
+                validateStorageComponent(relativePath.toPath().name)
+            }
+        }
+    }
+
     private fun resolveFileInfoTree(
         basePath: Path,
         name: String,
```

---

### Incident Patch 9: `d82f3a7a` (2026-10-05)
**Commit Message**: :bug: quote FTS search terms so punctuation no longer breaks search (#5093)

**File**: `app/src/desktopTest/kotlin/com/crosspaste/db/paste/PasteDaoTest.kt` (modified, +27/-0)
```diff
@@ -308,6 +308,33 @@ class PasteDaoTest {
             assertEquals(2, results.size)
         }
 
+    @Test
+    fun `searchPasteData treats punctuation in search terms as literals`() =
+        runTest {
+            pasteDao.createPasteData(createTestPasteData(text = "mail foo@bar.com today"))
+            pasteDao.createPasteData(createTestPasteData(text = "unrelated note"))
+
+            for (term in listOf("bar.com", "don't", "c++", "foo@bar", "3.14", "a-b", "say\"hi")) {
+                pasteDao.searchPasteData(searchTerms = listOf(term), limit = 100)
+            }
+
+            val results = pasteDao.searchPasteData(searchTerms = listOf("bar.com"), limit = 100)
+            assertEquals(1, results.size)
+            assertTrue(results.single().pasteSearchContent!!.contains("foo@bar.com"))
+        }
+
+    @Test
+    fun `searchPasteDataFlow filters by terms containing punctuation`() =
+        runTest {
+            pasteDao.createPasteData(createTestPasteData(text = "mail foo@bar.com today"))
+            pasteDao.createPasteData(createTestPasteData(text = "unrelated note"))
+
+            pasteDao.searchPasteDataFlow(searchTerms = listOf("bar.com"), limit = 100).test {
+                assertEquals(1, awaitItem().size)
+                cancelAndIgnoreRemainingEvents()
+            }
+        }
+
     @Test
     fun `searchPasteData with tag filter`() =
         runTest {
```

**File**: `shared/src/commonMain/kotlin/com/crosspaste/db/paste/SqlPasteDao.kt` (modified, +5/-1)
```diff
@@ -380,6 +380,10 @@ class SqlPasteDao(
             null
         }
 
+    // Quote each term as an FTS5 string literal so punctuation (".", "'", "@", "+", "-")
+    // is matched as text instead of being parsed as query syntax.
+    private fun toFtsPrefixLiteral(term: String): String = "\"${term.replace("\"", "\"\"")}\"*"
+
     private fun createSearchPasteQuery(
         searchTerms: List<String>,
         local: Boolean? = null,
@@ -396,7 +400,7 @@ class SqlPasteDao(
         val pasteTypeLongList = pasteTypeList.ifEmpty { listOf(INVALID_TYPE.type) }.map { it.toLong() }
 
         return if (searchTerms.isNotEmpty()) {
-            val searchQuery = "pasteSearchContent:(${searchTerms.joinToString(" AND ") { "$it*" }})"
+            val searchQuery = "pasteSearchContent:(${searchTerms.joinToString(" AND ") { toFtsPrefixLiteral(it) }})"
             logger.info { "Creating paste query: $searchQuery" }
 
             pasteDatabaseQueries.complexSearch(
```

---

### Incident Patch 10: `93860a28` (2026-10-02)
**Commit Message**: :bug: fix portable update offline trigger, mirror affinity, cross-mirror resume and rate limiter burst (#5092)

* :bug: fix portable update offline trigger, mirror affinity and rate limiter burst

* :bug: continue a portable update download on the other mirror from the same byte and make the stall and mirror tests exercise what they claim

* :memo: record #5092 in the 2.2.1 changelog

* :bug: drop stale mirror etag when primary mirror changes during checksum check

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -17,7 +17,7 @@ All notable changes to this project will be documented in this file.
   background as soon as the periodic check finds it, throttled to
   1 MB/s, with HTTP range resume across restarts and dropped
   connections; the prompt then offers a one-click restart. A General
-  settings switch turns automatic downloads off (#5090 #5091).
+  settings switch turns automatic downloads off (#5090 #5091 #5092).
 
 - 🔒 **Password-manager hints and source exclusion**
   Copies that password managers mark as "do not record" (Bitwarden,
@@ -75,6 +75,7 @@ All notable changes to this project will be documented in this file.
 
 # Bug Fixes 🐛
 
+- :bug: Fix portable update offline trigger, mirror affinity, cross-mirror resume and rate limiter burst (#5092)
 - :bug: Self-register the initiator's address on the pairing v3 commit so an acceptor that never sees its mDNS can reach it (#5086)
 - :bug: Fix multi-monitor placement, clipping and focus handling for Linux paste panel menu (#5079)
 - :bug: Close the floating button's menu on Linux when the user clicks elsewhere (#5078)
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/DesktopAppUpdateService.kt` (modified, +7/-8)
```diff
@@ -92,7 +92,8 @@ class DesktopAppUpdateService(
     }
 
     override fun tryTriggerUpdate() {
-        val hasNewVersion = lastVersion.value?.let { it > currentVersion.value } ?: false
+        val isReadyToApply = windowsZipUpdater.updateState.value is UpdateState.ReadyToApply
+        val hasNewVersion = isReadyToApply || (lastVersion.value?.let { it > currentVersion.value } ?: false)
 
         if (!hasNewVersion) {
             notificationManager.sendNotification(
@@ -118,14 +119,12 @@ class DesktopAppUpdateService(
             // a silent background retry two hours later.
             WindowsUpdateChannel.PORTABLE_ZIP -> {
                 windowsZipUpdater.resetUpdatePrompt()
-                if (configManager.getCurrentConfig().autoDownloadUpdate) {
+                if (configManager.getCurrentConfig().autoDownloadUpdate && !isReadyToApply) {
                     windowsZipUpdater.startDownload()
-                    if (windowsZipUpdater.updateState.value !is UpdateState.ReadyToApply) {
-                        notificationManager.sendNotification(
-                            title = { it.getText("update_downloading") },
-                            messageType = MessageType.Info,
-                        )
-                    }
+                    notificationManager.sendNotification(
+                        title = { it.getText("update_downloading") },
+                        messageType = MessageType.Info,
+                    )
                 }
                 appWindowManager.showMainWindow(WindowTrigger.MENU)
             }
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/ResumableUpdateDownloader.kt` (modified, +35/-20)
```diff
@@ -14,6 +14,8 @@ import kotlinx.coroutines.delay
 import okio.Path
 import java.io.File
 import java.io.FileOutputStream
+import java.nio.file.Files
+import java.nio.file.StandardCopyOption
 import kotlin.coroutines.cancellation.CancellationException
 import kotlin.time.Duration
 import kotlin.time.Duration.Companion.nanoseconds
@@ -35,8 +37,11 @@ sealed interface UpdateDownloadResult {
  * - **Resume.** Bytes go to `<target>.part`; the server's ETag is kept next to it. A later
  *   call for the same target sends `Range: bytes=<have>-` plus `If-Range: <etag>`, so an
  *   unchanged file continues where it stopped (HTTP 206) and a changed one is restarted
- *   from zero (HTTP 200). A `.part` without an ETag, or a 206 whose range does not line up
- *   with what we have, is discarded and the download restarts.
+ *   from zero (HTTP 200). A `.part` without an ETag is resumed with a bare `Range`: the
+ *   caller uses that to continue on a different mirror of the same bytes, where the ETag
+ *   would not match, and its checksum catches the (unlikely) case of the mirrors
+ *   disagreeing. A 206 whose range does not line up with what we have is discarded and
+ *   the download restarts.
  * - **Throttle.** [limitBytesPerSecond] is read before every chunk; a positive value caps
  *   the average rate over the current rate window with a sleep after each chunk, zero or
  *   less means unlimited. The window restarts whenever the limit changes so switching from
@@ -70,14 +75,12 @@ class ResumableUpdateDownloader(
                 ?.readText()
                 ?.trim()
                 ?.takeIf { it.isNotEmpty() }
-        val resume = have > 0 && etag != null
-        if (have > 0 && !resume) {
-            logger.info { "Discarding ${part.name}: partial file without an ETag cannot be validated" }
-            reset(part, etagFile)
+        if (have > 0 && etag == null) {
+            logger.info { "Resuming ${part.name} at $have bytes without an ETag; the checksum validates the result" }
         }
 
         val attempt =
-            runCatching { fetch(url, part, etagFile, if (resume) have else 0L, etag, limitBytesPerSecond, onProgress) }
+            runCatching { fetch(url, part, etagFile, have, etag, limitBytesPerSecond, onProgress) }
         attempt.exceptionOrNull()?.let { e ->
             if (e is CancellationException) throw e
             logger.warn(e) { "Update download failed: $url" }
@@ -112,17 +115,22 @@ class ResumableUpdateDownloader(
         part: File,
         etagFile: File,
         target: Path,
-    ): UpdateDownloadResult {
-        val finished = target.toFile()
-        if (finished.exists() && !finished.delete()) {
-            return UpdateDownloadResult.Failed(null, IllegalStateException("Cannot replace $finished"))
-        }
-        if (!part.renameTo(finished)) {
-            return UpdateDownloadResult.Failed(null, IllegalStateException("Cannot move ${part.name} into place"))
+    ): UpdateDownloadResult =
+        runCatching {
+            val targetNio = target.toNioPath()
+            targetNio.parent?.let { Files.createDirectories(it) }
+            Files.move(
+                part.toPath(),
+                targetNio,
+                StandardCopyOption.REPLACE_EXISTING,
+            )
+            etagFile.delete()
+            UpdateDownloadResult.Success
+        }.getOrElse { e ->
+            if (e is CancellationException) throw e
+            logger.warn(e) { "Cannot move ${part.name} into place at $target" }
+            UpdateDownloadResult.Failed(null, e)
         }
-        etagFile.delete()
-        return UpdateDownloadResult.Success
-    }
 
     private sealed interface Fetch {
         data object Done : Fetch
@@ -148,10 +156,10 @@ class ResumableUpdateDownloader(
     ): Fetch =
         httpClient()
             .prepareGet(url) {
-                if (offset > 0 && etag != null) {
+                if (offset > 0) {
                     headers {
                         append(HttpHeaders.Range, "bytes=$offset-")
-                        append(HttpHeaders.IfRange, etag)
+                        if (etag != null) append(HttpHeaders.IfRange, etag)
                     }
                 }
             }.execute { response ->
@@ -255,7 +263,14 @@ class ResumableUpdateDownloader(
             val expectedNanos = windowBytes * NANOS_PER_SECOND / limit
             val elapsedNanos = now() - windowStart
             val behind = expectedNanos - elapsedNanos
-            if (behind > 0) sleep(behind.nanoseconds)
+            if (behind > 0) {
+                sleep(behind.nanoseconds)
+            } else {
+                // If the link was slower than the cap or paused, do not let "credit"
+                // accumulate into an unthrottled burst when throughput recovers.
+                windowStart = now()
+                windowBytes = 0L
+            }
         }
     }
 
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/WindowsZipUpdater.kt` (modified, +97/-17)
```diff
@@ -298,12 +298,28 @@ class WindowsZipUpdater(
         // Aliyun OSS repository ACLs. Proper hardening is to verify a detached signature
         // (e.g. minisign / GPG) over the zip or checksum against a public key baked into
         // the app, before extracting. See doc/en/WindowsZipSelfUpdateTest.md.
-        val winner = fetchChecksumFromFastestSource(release)
-        if (winner == null) {
+        val candidateBases = mirrorBases(release)
+        val savedSource = readSavedSource(release)
+        val hasPartialDownload = hasPartialDownload(release)
+
+        // If we already have a partial download from a specific mirror, reuse that mirror
+        // so the server's ETag matches and HTTP 206 Range resume succeeds.
+        val preferredBase = savedSource?.takeIf { hasPartialDownload && it in candidateBases }
+
+        val checksumResult: Pair<String, String>? =
+            if (preferredBase != null) {
+                fetchChecksumFromSource(preferredBase)?.let { preferredBase to it }
+                    ?: fetchChecksumFromFastestSource(release)
+            } else {
+                fetchChecksumFromFastestSource(release)
+            }
+
+        if (checksumResult == null) {
             fail("update_download_failed")
             return
         }
-        val (base, checksumText) = winner
+
+        val (primaryBase, checksumText) = checksumResult
         val expectedHash = parseChecksum(checksumText, release.fileName)
         if (expectedHash == null) {
             fail("update_checksum_missing")
@@ -313,12 +329,36 @@ class WindowsZipUpdater(
         val zipPath = updateDir.resolve(release.fileName)
 
         _updateState.value = UpdateState.Downloading(0)
-        val downloaded = downloadFile(base + release.fileName, zipPath)
+        // If the checksum race selected a different mirror than the previous partial
+        // download came from, drop that mirror's ETag so the download resumes with a bare
+        // Range on the new mirror instead of failing an If-Range match and restarting from 0.
+        if (primaryBase != savedSource) {
+            forgetMirrorEtag(release)
+        }
+        saveSource(release, primaryBase)
+        var downloaded = downloadFile(primaryBase + release.fileName, zipPath)
+
+        // Both mirrors serve the same bytes, so a failed transfer continues on the other
+        // one from where it stopped. Only the ETag is dropped: it belongs to the mirror
+        // that failed, and the final SHA-256 covers the stitched file.
+        if (!downloaded) {
+            val fallbackBases = candidateBases.filter { it != primaryBase }
+            for (fallbackBase in fallbackBases) {
+                logger.info { "Download failed from $primaryBase, continuing on fallback mirror $fallbackBase" }
+                forgetMirrorEtag(release)
+                saveSource(release, fallbackBase)
+                downloaded = downloadFile(fallbackBase + release.fileName, zipPath)
+                if (downloaded) break
+            }
+        }
+
         if (!downloaded) {
             fail("update_download_failed")
             return
         }
 
+        runCatching { fileUtils.deleteFile(sourceFile(release)) }
+
         _updateState.value = UpdateState.Verifying
         val actualHash = sha256(zipPath)
         if (!actualHash.equals(expectedHash, ignoreCase = true)) {
@@ -360,20 +400,59 @@ class WindowsZipUpdater(
         }
     }
 
+    private fun sourceFile(release: RemoteRelease): Path = updateDir().resolve("${release.fileName}.source")
+
+    /** True when a resumable partial download (at least one byte) of [release] is on disk. */
+    private fun hasPartialDownload(release: RemoteRelease): Boolean {
+        val part = ResumableUpdateDownloader.partFile(updateDir().resolve(release.fileName))
+        return part.isFile && part.length() > 0L
+    }
+
+    private fun readSavedSource(release: RemoteRelease): String? =
+        runCatching {
+            val file = sourceFile(release).toFile()
+            if (file.isFile) file.readText().trim().takeIf { it.isNotEmpty() } else null
+        }.getOrNull()
+
+    private fun saveSource(
+        release: RemoteRelease,
+        sourceBase: String,
+    ) {
+        runCatching {
+            sourceFile(release).toFile().writeText(sourceBase)
+        }
+    }
+
+    /** Drops the ETag of the mirror we are leaving so the partial resumes with a bare Range. */
+    private fun forgetMirrorEtag(release: RemoteRelease) {
+        runCatching { fileUtils.deleteFile(updateDir().resolve("${release.fileName}.etag")) }
+    }
+
     /**
      * Drops zips and partial downloads of any other release so a superseded download is
-     * not resumed, while keeping this release's `.part` + `.etag` for the resume.
+     * not resumed, while keeping this release's `.part` + `.etag` + `.source` for the resume.
      */
     private fun dropFilesNotFor(release: RemoteRelease) {
-        val keep = setOf(release.fileNam
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/UpdateAvailableDialog.kt` (modified, +8/-3)
```diff
@@ -59,19 +59,24 @@ fun UpdateDialogHost() {
     val backStackEntry by navController.currentBackStackEntryAsState()
     val onChangeLog = backStackEntry?.let { getRootRouteName(it.destination) } == ChangeLog.NAME
 
-    val version = lastVersion?.toString() ?: return
+    val state = updateState
+    val version =
+        when (state) {
+            is UpdateState.ReadyToApply -> state.version
+            else -> lastVersion?.toString()
+        } ?: return
 
     // While a download is in flight the changelog banner shows progress, so don't pop
     // the dialog. Idle only counts when nothing will happen on its own.
-    val state = updateState
     val relevant =
         when (state) {
             is UpdateState.ReadyToApply -> true
             is UpdateState.Failed -> state.manual
             is UpdateState.Idle -> !config.autoDownloadUpdate
             else -> false
         }
-    if (!hasNewVersion || !relevant || version == dismissedForVersion || onChangeLog) return
+    val newVersionPending = state is UpdateState.ReadyToApply || hasNewVersion
+    if (!newVersionPending || !relevant || version == dismissedForVersion || onChangeLog) return
 
     val menuHelper = koinInject<MenuHelper>()
     val exitApplication = LocalExitApplication.current
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/app/DesktopAppUpdateServiceTest.kt` (modified, +13/-0)
```diff
@@ -6,6 +6,7 @@ import io.mockk.coEvery
 import io.mockk.every
 import io.mockk.mockk
 import io.mockk.verify
+import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.runBlocking
 import kotlin.test.Test
 
@@ -102,4 +103,16 @@ class DesktopAppUpdateServiceTest {
 
         verify(exactly = 0) { updater.startBackgroundDownload() }
     }
+
+    @Test
+    fun `a manual check triggers update when already ready to apply even if lastVersion is null`() {
+        val updater = mockk<WindowsZipUpdater>(relaxed = true)
+        every { updater.updateState } returns MutableStateFlow(UpdateState.ReadyToApply("1.1.0"))
+        val service = service("1.0.0", null, autoDownload = true, WindowsUpdateChannel.PORTABLE_ZIP, updater)
+
+        service.tryTriggerUpdate()
+
+        verify(exactly = 1) { updater.resetUpdatePrompt() }
+        verify(exactly = 0) { updater.startDownload() }
+    }
 }
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/app/ResumableUpdateDownloaderTest.kt` (modified, +42/-3)
```diff
@@ -38,7 +38,8 @@ class ResumableUpdateDownloaderTest {
                         HttpHeaders.IfRange to request.headers[HttpHeaders.IfRange],
                     )
                 val range = request.headers[HttpHeaders.Range]
-                if (honorRange && range != null && request.headers[HttpHeaders.IfRange] == etag) {
+                val ifRange = request.headers[HttpHeaders.IfRange]
+                if (honorRange && range != null && (ifRange == null || ifRange == etag)) {
                     val from = range.removePrefix("bytes=").removeSuffix("-").toInt()
                     respond(
                         content = body.copyOfRange(from, body.size),
@@ -108,7 +109,7 @@ class ResumableUpdateDownloaderTest {
     }
 
     @Test
-    fun `a partial file without an ETag is not resumed`() {
+    fun `a partial file without an ETag is resumed with a bare Range request`() {
         val target = target()
         seedPartial(target, 120_000, withEtag = false)
         val requests = mutableListOf<Map<String, String?>>()
@@ -117,7 +118,8 @@ class ResumableUpdateDownloaderTest {
         val result = runBlocking { downloader.download(url, target) }
 
         assertEquals(UpdateDownloadResult.Success, result)
-        assertNull(requests[0][HttpHeaders.Range])
+        assertEquals("bytes=120000-", requests[0][HttpHeaders.Range])
+        assertNull(requests[0][HttpHeaders.IfRange])
         assertContentEquals(body, target.toFile().readBytes())
     }
 
@@ -181,4 +183,41 @@ class ResumableUpdateDownloaderTest {
         assertNull(ResumableUpdateDownloader.parseContentRange("bytes */300"))
         assertNull(ResumableUpdateDownloader.parseContentRange(null))
     }
+
+    @Test
+    fun `a stall or pause does not cause an unthrottled catch-up burst afterwards`() {
+        val target = target()
+        var clock = 0L
+        val sleeps = mutableListOf<Duration>()
+        val downloader =
+            ResumableUpdateDownloader(
+                httpClient = { server(honorRange = false, mutableListOf()) },
+                sleep = {
+                    sleeps += it
+                    clock += it.inWholeNanoseconds
+                },
+                now = { clock },
+            )
+
+        // The link stalls for 10 s after the first chunk lands. Without the window reset
+        // the limiter would treat that as 10 s of credit and let the remaining ~235 KB
+        // through at full speed; with it, every later chunk is still paced.
+        var stalled = false
+        val result =
+            runBlocking {
+                downloader.download(url, target, limitBytesPerSecond = { 100_000L }) { _, _ ->
+                    if (!stalled) {
+                        stalled = true
+                        clock += 10_000_000_000L
+                    }
+                }
+            }
+
+        assertEquals(UpdateDownloadResult.Success, result)
+        val totalMillis = sleeps.sumOf { it.inWholeMilliseconds }
+        assertTrue(
+            totalMillis in 2_000..3_100,
+            "chunks after the stall should still be throttled, slept $totalMillis ms",
+        )
+    }
 }
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/app/WindowsZipUpdaterDownloadTest.kt` (modified, +262/-16)
```diff
@@ -10,9 +10,12 @@ import io.ktor.client.engine.mock.MockEngine
 import io.ktor.client.engine.mock.respond
 import io.ktor.client.request.get
 import io.ktor.client.statement.bodyAsChannel
+import io.ktor.http.HttpHeaders
 import io.ktor.http.HttpStatusCode
+import io.ktor.http.Url
 import io.ktor.http.contentLength
 import io.ktor.http.contentType
+import io.ktor.http.headersOf
 import io.ktor.http.isSuccess
 import io.ktor.utils.io.toByteArray
 import io.mockk.every
@@ -67,30 +70,39 @@ class WindowsZipUpdaterDownloadTest {
             .digest(bytes)
             .joinToString("") { "%02x".format(it) }
 
+    private fun singleSourceEngine(
+        zipBytes: ByteArray,
+        checksumBody: String,
+    ): MockEngine =
+        MockEngine { request ->
+            val path = request.url.encodedPath
+            when {
+                path.endsWith("metadata.properties") ->
+                    respond("app.version=$version\napp.revision=$revision\n", HttpStatusCode.OK)
+                path.endsWith("checksum.txt") ->
+                    respond(checksumBody, HttpStatusCode.OK)
+                path.endsWith(".zip") ->
+                    respond(zipBytes, HttpStatusCode.OK)
+                else ->
+                    respond("not found", HttpStatusCode.NotFound)
+            }
+        }
+
     private fun newUpdater(
         zipBytes: ByteArray,
         checksumBody: String,
         tmp: Path,
+        engine: MockEngine = singleSourceEngine(zipBytes, checksumBody),
+        baseUrlOverride: String? = baseUrl,
     ): WindowsZipUpdater {
-        val engine =
-            MockEngine { request ->
-                val path = request.url.encodedPath
-                when {
-                    path.endsWith("metadata.properties") ->
-                        respond("app.version=$version\napp.revision=$revision\n", HttpStatusCode.OK)
-                    path.endsWith("checksum.txt") ->
-                        respond(checksumBody, HttpStatusCode.OK)
-                    path.endsWith(".zip") ->
-                        respond(zipBytes, HttpStatusCode.OK)
-                    else ->
-                        respond("not found", HttpStatusCode.NotFound)
-                }
-            }
         val httpClient = HttpClient(engine)
         val resourcesClient = MockResourcesClient(httpClient)
         return WindowsZipUpdater(
             appInfo = mockk(relaxed = true) { every { appVersion } returns "1.0.0" },
-            appUrls = mockk(relaxed = true),
+            appUrls =
+                mockk(
+                    relaxed = true,
+                ) { every { checkMetadataUrl } returns "https://meta.test/metadata.properties" },
             appPathProvider = FakeAppPathProvider(tmp),
             appLaunchState =
                 DesktopAppLaunchState(
@@ -104,11 +116,121 @@ class WindowsZipUpdaterDownloadTest {
             downloader = ResumableUpdateDownloader(httpClient = { httpClient }, sleep = {}),
             platform = mockk(relaxed = true),
             metadataFetcher = UpdateMetadataFetcher(resourcesClient),
-            baseUrlOverride = baseUrl,
+            baseUrlOverride = baseUrlOverride,
             forcedChannel = WindowsUpdateChannel.PORTABLE_ZIP,
         )
     }
 
+    private val githubHost = "github.com"
+    private val ossHost = "oss.crosspaste.com"
+
+    private fun etagFor(host: String): String = "\"etag-$host\""
+
+    private enum class Mirror { FULL, HONOR_RANGE, DOWN, TRUNCATED }
+
+    /**
+     * Serves the real GitHub + OSS mirror layout (no override): metadata from the
+     * mocked check URL, checksum.txt from both mirrors, and the zip according to each
+     * host's [Mirror] mode. HONOR_RANGE answers a matching If-Range with 206; TRUNCATED
+     * promises the full length but sends half, like a dropped connection. Every zip
+     * request is recorded as host to Range header.
+     */
+    private fun mirrorsEngine(
+        zipBytes: ByteArray,
+        checksumBody: String,
+        modes: Map<String, Mirror>,
+        zipRequests: MutableList<Pair<String, String?>>,
+        checksumModes: Map<String, HttpStatusCode> = emptyMap(),
+        zipIfRanges: MutableList<String?> = mutableListOf(),
+        zipResponses: MutableList<HttpStatusCode> = mutableListOf(),
+    ): MockEngine =
+        MockEngine { request ->
+            val path = request.url.encodedPath
+            val host = request.url.host
+            val hostEtag = etagFor(host)
+            when {
+                path.endsWith("metadata.properties") ->
+                    respond("app.version=$version\napp.revision=$revision\n", HttpStatusCode.OK)
+                path.endsWith("checksum.txt") -> {
+                    val status = checksumModes[host] ?: HttpStatusCode.OK
+                    if (status.isSuccess()) {
+                        respond(checksumBody, status)
+                    } else {
+                        respond("unavailable", status)
+                 
```

---

### Incident Patch 11: `5b24c73d` (2026-10-01)
**Commit Message**: :bug: self-register the initiator's address on the pairing v3 commit so an acceptor that never sees its mDNS can reach it (#5086)

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/SyncInfoAdvertiser.kt` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+package com.crosspaste.net
+
+import com.crosspaste.db.sync.HostInfo
+import io.github.oshai.kotlinlogging.KotlinLogging
+import kotlinx.coroutines.withTimeoutOrNull
+import kotlin.coroutines.cancellation.CancellationException
+import kotlin.time.Duration
+import kotlin.time.Duration.Companion.milliseconds
+
+/**
+ * Builds the `crosspaste-sync-info` routing hint we piggyback onto requests so a peer
+ * learns where to reach us back without waiting for an mDNS round. Shared by the
+ * `/sync/telnet` probe (#4509 phase 3) and the pairing v3 commit, so a peer that never
+ * receives our multicast (one-way mDNS: VM NAT, AP isolation) still ends the pairing
+ * with a usable address for us.
+ */
+class SyncInfoAdvertiser(
+    private val networkInterfaceService: NetworkInterfaceService,
+    private val syncInfoFactory: SyncInfoFactory,
+) {
+
+    companion object {
+        // Building the hint waits on our own server port (createSyncInfo blocks on
+        // portFlow.first { it > 0 }), which is instant once the server is up but stalls
+        // during cold start. The probe caps it tightly so a not-yet-ready server just
+        // means "no hint this round".
+        val PROBE_BUILD_TIMEOUT: Duration = 100.milliseconds
+    }
+
+    private val logger = KotlinLogging.logger {}
+
+    /** Every address we currently listen on. */
+    fun allHostInfo(): List<HostInfo> =
+        networkInterfaceService
+            .getCurrentUseNetworkInterfaces()
+            .map { it.toHostInfo() }
+
+    /**
+     * The local address(es) the peer at [peerAddress] should use to reach us: our
+     * interface(s) on the peer's subnet. Reuses [HostInfo.filter] — the same subnet match
+     * the trust flow uses to pick a reachable address. Empty when no local interface shares
+     * the peer's subnet (cross-subnet / offline). Cheap and non-blocking.
+     */
+    fun subnetMatchedHostInfo(peerAddress: String): List<HostInfo> = allHostInfo().filter { it.filter(peerAddress) }
+
+    /**
+     * Encode [hostInfoList] into the value for [SyncInfoHeaderCodec.HEADER]. Best-effort:
+     * swallows non-cancellation failures and is bounded by [timeout], so building the hint
+     * can never fail or stall the request it rides on.
+     */
+    suspend fun buildHeader(
+        hostInfoList: List<HostInfo>,
+        timeout: Duration = PROBE_BUILD_TIMEOUT,
+    ): String? =
+        runCatching {
+            // withTimeoutOrNull returns null on its own timeout (no throw) but still
+            // propagates a real parent cancellation — exactly the best-effort semantics
+            // we want for the hint.
+            withTimeoutOrNull(timeout) {
+                SyncInfoHeaderCodec.encode(syncInfoFactory.createSyncInfo(hostInfoList))
+            }
+        }.onFailure {
+            if (it is CancellationException) throw it
+            logger.debug(it) { "failed to build advertise header for $hostInfoList" }
+        }.getOrNull()
+}
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/TelnetHelper.kt` (modified, +6/-42)
```diff
@@ -43,23 +43,19 @@ data class TelnetResult(
 }
 
 class TelnetHelper(
-    private val networkInterfaceService: NetworkInterfaceService,
+    networkInterfaceService: NetworkInterfaceService,
     private val pasteClient: PasteClient,
     private val syncApi: SyncApi,
-    private val syncInfoFactory: SyncInfoFactory,
+    syncInfoFactory: SyncInfoFactory,
 ) {
 
     companion object {
         const val FAST_TIMEOUT = 500L
         const val SLOW_TIMEOUT = 2000L
-
-        // Building the advertise hint must never stall the probe. createSyncInfo waits
-        // for our own server port (portFlow.first { it > 0 }), which is instant once the
-        // server is up but blocks during the cold-start window before it is. Cap it so a
-        // not-yet-ready local server just means "no hint this round", not a delayed probe.
-        private val ADVERTISE_BUILD_TIMEOUT = 100.milliseconds
     }
 
+    private val advertiser = SyncInfoAdvertiser(networkInterfaceService, syncInfoFactory)
+
     private val logger = KotlinLogging.logger {}
 
     // Last address set we successfully advertised to each peer (keyed by the probed host
@@ -149,10 +145,10 @@ class TelnetHelper(
             // can actually route to — and only when it differs from what we last delivered
             // to this peer, so a steady network tells each peer exactly once. Best-effort:
             // a failure here must never turn a reachable host into an "unreachable" result.
-            val advertiseHostInfo = currentAdvertiseHostInfo(hostAddress)
+            val advertiseHostInfo = advertiser.subnetMatchedHostInfo(hostAddress)
             val advertiseHeader =
                 if (advertiseHostInfo.isNotEmpty() && lastAdvertised[hostAddress] != advertiseHostInfo) {
-                    buildAdvertiseHeader(advertiseHostInfo)
+                    advertiser.buildHeader(advertiseHostInfo)
                 } else {
                     null
                 }
@@ -201,36 +197,4 @@ class TelnetHelper(
             if (it is CancellationException) throw it
             logger.debug(it) { "telnet $hostAddress fail" }
         }.getOrNull()
-
-    /**
-     * The local address(es) the peer at [peerAddress] should use to reach us: our
-     * interface(s) on the peer's subnet (#4509 phase 3). Reuses [HostInfo.filter] — the same
-     * subnet match the trust flow uses to pick a reachable address. Empty when no local
-     * interface shares the peer's subnet (cross-subnet / offline). Cheap and non-blocking,
-     * so it can drive the "did our address change?" check on every probe.
-     */
-    private fun currentAdvertiseHostInfo(peerAddress: String): List<HostInfo> =
-        networkInterfaceService
-            .getCurrentUseNetworkInterfaces()
-            .map { it.toHostInfo() }
-            .filter { it.filter(peerAddress) }
-
-    /**
-     * Encode [hostInfoList] into the value for [SyncInfoHeaderCodec.HEADER]. Best-effort:
-     * swallows non-cancellation failures so building the hint can never fail the probe, and
-     * is time-bounded because [SyncInfoFactory.createSyncInfo] waits on our own server port
-     * ([ADVERTISE_BUILD_TIMEOUT]) — a not-yet-ready server just means "no hint this round".
-     */
-    private suspend fun buildAdvertiseHeader(hostInfoList: List<HostInfo>): String? =
-        runCatching {
-            // withTimeoutOrNull returns null on its own timeout (no throw) but still
-            // propagates a real parent cancellation — exactly the best-effort semantics
-            // we want for the hint.
-            withTimeoutOrNull(ADVERTISE_BUILD_TIMEOUT) {
-                SyncInfoHeaderCodec.encode(syncInfoFactory.createSyncInfo(hostInfoList))
-            }
-        }.onFailure {
-            if (it is CancellationException) throw it
-            logger.debug(it) { "failed to build advertise header for $hostInfoList" }
-        }.getOrNull()
 }
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/net/clientapi/PairingV3ClientApi.kt` (modified, +38/-2)
```diff
@@ -8,12 +8,16 @@ import com.crosspaste.dto.pairing.v3.PairingOfferV3
 import com.crosspaste.dto.pairing.v3.PairingProofResponseV3
 import com.crosspaste.dto.pairing.v3.PairingProofV3
 import com.crosspaste.net.PasteClient
+import com.crosspaste.net.SyncInfoAdvertiser
+import com.crosspaste.net.SyncInfoHeaderCodec
 import com.crosspaste.net.exception.ExceptionHandler
 import com.crosspaste.utils.buildUrl
 import io.github.oshai.kotlinlogging.KotlinLogging
 import io.ktor.client.call.*
 import io.ktor.http.*
 import io.ktor.util.reflect.*
+import kotlin.time.Duration
+import kotlin.time.Duration.Companion.seconds
 
 /**
  * Transport-only client for the pairing v3 endpoints.
@@ -25,8 +29,17 @@ import io.ktor.util.reflect.*
 class PairingV3ClientApi(
     private val pasteClient: PasteClient,
     private val exceptionHandler: ExceptionHandler,
+    // Optional so platforms that have not wired an advertiser keep the plain commit.
+    private val syncInfoAdvertiser: SyncInfoAdvertiser? = null,
 ) : PairingV3Transport {
 
+    companion object {
+        // The commit is a one-off at the end of pairing, not a hot probe: a slow server
+        // port wait is worth a short stall here because the header is what lets a peer
+        // that never sees our mDNS reach us back at all.
+        val COMMIT_ADVERTISE_TIMEOUT: Duration = 1.seconds
+    }
+
     private val logger = KotlinLogging.logger {}
 
     override suspend fun sendIntent(
@@ -66,11 +79,19 @@ class PairingV3ClientApi(
     override suspend fun sendCommit(
         commit: PairingCommitV3,
         toUrl: URLBuilder.() -> Unit,
-    ): ClientApiResult =
-        request(logger, exceptionHandler, request = {
+    ): ClientApiResult {
+        // Self-register our address on the commit, mirroring what the browser extension
+        // does. The acceptor only otherwise learns our address from mDNS, and a peer that
+        // never receives our multicast (VM NAT, AP isolation) would finish the pairing
+        // trusted but unreachable — it could not push to us or pull our files.
+        val advertiseHeader = buildCommitAdvertiseHeader(toUrl)
+        return request(logger, exceptionHandler, request = {
             pasteClient.post(
                 commit,
                 typeInfo<PairingCommitV3>(),
+                headersBuilder = {
+                    advertiseHeader?.let { append(SyncInfoHeaderCodec.HEADER, it) }
+                },
                 urlBuilder = {
                     toUrl()
                     buildUrl("sync", "pairing", "v3", "commit")
@@ -79,6 +100,21 @@ class PairingV3ClientApi(
         }) { response ->
             response.body<PairingCommitAckV3>()
         }
+    }
+
+    /**
+     * Prefer the interface(s) on the acceptor's subnet (the address it can route to);
+     * when none share its subnet, advertise everything we listen on and let the
+     * acceptor's reachability probe pick a candidate.
+     */
+    private suspend fun buildCommitAdvertiseHeader(toUrl: URLBuilder.() -> Unit): String? {
+        val advertiser = syncInfoAdvertiser ?: return null
+        val peerHost = URLBuilder().apply(toUrl).host
+        val hostInfoList =
+            advertiser.subnetMatchedHostInfo(peerHost).ifEmpty { advertiser.allHostInfo() }
+        if (hostInfoList.isEmpty()) return null
+        return advertiser.buildHeader(hostInfoList, COMMIT_ADVERTISE_TIMEOUT)
+    }
 
     override suspend fun sendCancel(
         cancel: PairingCancelV3,
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/DesktopNetworkModule.kt` (modified, +3/-1)
```diff
@@ -32,6 +32,7 @@ import com.crosspaste.net.Server
 import com.crosspaste.net.ServerFactory
 import com.crosspaste.net.ServerModule
 import com.crosspaste.net.SyncApi
+import com.crosspaste.net.SyncInfoAdvertiser
 import com.crosspaste.net.TelnetHelper
 import com.crosspaste.net.WindowsNetworkStateMonitor
 import com.crosspaste.net.clientapi.PairingV3ClientApi
@@ -153,12 +154,13 @@ fun desktopNetworkModule(
             }
         }
         single<PasteBonjourService> { DesktopPasteBonjourService(get(), get(), get(), get()) }
+        single<SyncInfoAdvertiser> { SyncInfoAdvertiser(get(), get()) }
         single<TelnetHelper> { TelnetHelper(get(), get(), get(), get()) }
         // endregion
 
         // region HTTP client & API
         single<FaviconLoader> { DesktopFaviconLoader(get(), get(), get()) }
-        single<PairingV3ClientApi> { PairingV3ClientApi(get(), get()) }
+        single<PairingV3ClientApi> { PairingV3ClientApi(get(), get(), get()) }
         single<PairingV3Transport> { get<PairingV3ClientApi>() }
         single<PasteClient> { PasteClient(get(), get(), get()) }
         single<PasteClientApi> { PasteClientApi(get(), get()) }
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/net/clientapi/PairingV3ClientApiTest.kt` (added, +182/-0)
```diff
@@ -0,0 +1,182 @@
+package com.crosspaste.net.clientapi
+
+import com.crosspaste.db.sync.HostInfo
+import com.crosspaste.dto.pairing.v3.PairingCommitAckV3
+import com.crosspaste.dto.pairing.v3.PairingCommitV3
+import com.crosspaste.net.NetworkInterfaceInfo
+import com.crosspaste.net.NetworkInterfaceService
+import com.crosspaste.net.PasteClient
+import com.crosspaste.net.SyncInfoAdvertiser
+import com.crosspaste.net.SyncInfoFactory
+import com.crosspaste.net.SyncInfoHeaderCodec
+import com.crosspaste.net.exception.DesktopExceptionHandler
+import com.crosspaste.net.exception.ExceptionHandler
+import com.crosspaste.sync.SyncTestFixtures
+import com.crosspaste.utils.HostAndPort
+import com.crosspaste.utils.buildUrl
+import com.crosspaste.utils.getJsonUtils
+import io.ktor.client.HttpClient
+import io.ktor.client.engine.mock.MockEngine
+import io.ktor.client.engine.mock.respond
+import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
+import io.ktor.client.request.HttpRequestData
+import io.ktor.client.request.headers
+import io.ktor.client.request.post
+import io.ktor.client.request.setBody
+import io.ktor.http.ContentType
+import io.ktor.http.HeadersBuilder
+import io.ktor.http.HttpHeaders
+import io.ktor.http.HttpStatusCode
+import io.ktor.http.URLBuilder
+import io.ktor.http.contentType
+import io.ktor.http.headersOf
+import io.ktor.serialization.kotlinx.json.json
+import io.ktor.util.reflect.TypeInfo
+import io.mockk.CapturingSlot
+import io.mockk.coEvery
+import io.mockk.every
+import io.mockk.mockk
+import io.mockk.slot
+import kotlinx.coroutines.runBlocking
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNotNull
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+/**
+ * The pairing v3 commit must self-register the initiator's address via the
+ * `crosspaste-sync-info` header: an acceptor that never receives our mDNS (one-way
+ * multicast: VM NAT, AP isolation) has no other way to learn where to reach us, and
+ * would otherwise finish the pairing trusted but unreachable.
+ */
+class PairingV3ClientApiTest {
+
+    private val json = getJsonUtils().JSON
+    private val exceptionHandler: ExceptionHandler = DesktopExceptionHandler()
+
+    private val commit =
+        PairingCommitV3(
+            sessionId = ByteArray(16) { 1 },
+            transcriptHash = ByteArray(32) { 2 },
+            commitMac = ByteArray(32) { 3 },
+        )
+
+    private val ack =
+        PairingCommitAckV3(
+            sessionId = commit.sessionId,
+            transcriptHash = commit.transcriptHash,
+            receiptMac = ByteArray(32) { 4 },
+        )
+
+    /** A mocked PasteClient whose `post` routes through a real HttpClient(MockEngine). */
+    private fun buildClient(): Pair<PasteClient, MockEngine> {
+        val engine =
+            MockEngine {
+                respond(
+                    content = json.encodeToString(PairingCommitAckV3.serializer(), ack),
+                    status = HttpStatusCode.OK,
+                    headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
+                )
+            }
+        val realClient =
+            HttpClient(engine) {
+                install(ContentNegotiation) { json(json, ContentType.Application.Json) }
+            }
+        val client = mockk<PasteClient>()
+        coEvery {
+            client.post(any<Any>(), any<TypeInfo>(), any<Long>(), any(), any())
+        } coAnswers {
+            val message: Any = firstArg()
+            val headersBuilder: HeadersBuilder.() -> Unit = arg(3)
+            val urlBuilder: URLBuilder.() -> Unit = arg(4)
+            realClient.post {
+                headers(headersBuilder)
+                contentType(ContentType.Application.Json)
+                url { urlBuilder() }
+                setBody(message)
+            }
+        }
+        return client to engine
+    }
+
+    private fun advertiser(
+        interfaces: List<NetworkInterfaceInfo>,
+        capturedList: CapturingSlot<List<HostInfo>>,
+    ): SyncInfoAdvertiser {
+        val networkInterfaceService = mockk<NetworkInterfaceService>(relaxed = true)
+        every { networkInterfaceService.getCurrentUseNetworkInterfaces() } returns interfaces
+        val syncInfoFactory = mockk<SyncInfoFactory>()
+        coEvery { syncInfoFactory.createSyncInfo(capture(capturedList)) } coAnswers {
+            SyncTestFixtures.createSyncInfo(hostInfoList = capturedList.captured)
+        }
+        return SyncInfoAdvertiser(networkInterfaceService, syncInfoFactory)
+    }
+
+    private fun toPeer(host: String): URLBuilder.() -> Unit = { buildUrl(HostAndPort(host, 13129)) }
+
+    private fun onlyCommitRequest(engine: MockEngine): HttpRequestData {
+        val request = engine.requestHistory.single()
+        assertTrue(request.url.encodedPath.endsWith("/sync/pairing/v3/commit"), request.url.toString())
+        return request
+    }
+
+    @Test
+    fun sendCom
```

---

### Incident Patch 12: `771b605b` (2026-10-01)
**Commit Message**: :white_check_mark: add a logback config to the e2e harness so JmDNS debug output stops drowning the results (#5085)

**File**: `e2e/src/desktopMain/resources/logback.xml` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+<configuration>
+    <appender name="STDERR" class="ch.qos.logback.core.ConsoleAppender">
+        <target>System.err</target>
+        <encoder>
+            <pattern>%d{HH:mm:ss.SSS} %-5level %logger{24} - %msg%n</pattern>
+        </encoder>
+    </appender>
+    <logger name="javax.jmdns" level="WARN"/>
+    <logger name="io.ktor" level="INFO"/>
+    <root level="INFO">
+        <appender-ref ref="STDERR"/>
+    </root>
+</configuration>
```

---

### Incident Patch 13: `bde8fe65` (2026-09-29)
**Commit Message**: :bug: fix multi-monitor placement, clipping and focus handling for Linux paste panel menu (#5079)

* :bug: fix multi-monitor placement, clipping and focus handling for Linux paste panel menu

* :bug: keep the Linux paste panel menu open through the focus shuffle and close it on Escape

A focus loss during the grace period was taken as the user clicking
elsewhere, but the focus can bounce while the window comes up, which
would have closed the menu on every open. Ignore losses during the grace
period again and check where the focus ended up once at the end: gone
after it was gained means the user clicked away, never gained means the
compositor refused and the menu stays usable through its items and the
button's toggle.

The Escape handler sat on the column, which never holds the focus, so
the key never reached it. It now sits on the window.

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelButtonWindow.kt` (modified, +8/-1)
```diff
@@ -115,7 +115,7 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
                 return
             }
             if (isLinux) {
-                linuxMenuAnchor = Rectangle(window.bounds)
+                linuxMenuAnchor = if (linuxMenuAnchor == null) Rectangle(window.bounds) else null
                 return
             }
             val menu = popupMenu ?: return
@@ -130,6 +130,12 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
             menu.show(window.contentPane, x, y)
         }
 
+        LaunchedEffect(buttonInfo.show) {
+            if (!buttonInfo.show) {
+                linuxMenuAnchor = null
+            }
+        }
+
         PastePanelWindowContext {
             PastePanelButtonContent(
                 window = window,
@@ -140,6 +146,7 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
                 },
                 onSecondaryClick = { x, y -> showMenu(x, y) },
                 onMoved = { x, y ->
+                    linuxMenuAnchor = null
                     appWindowManager.movePastePanelButton(WindowPosition(x.dp, y.dp))
                 },
             )
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelMenuWindow.kt` (modified, +126/-35)
```diff
@@ -23,11 +23,11 @@ import androidx.compose.ui.draw.clip
 import androidx.compose.ui.input.key.Key
 import androidx.compose.ui.input.key.KeyEventType
 import androidx.compose.ui.input.key.key
-import androidx.compose.ui.input.key.onPreviewKeyEvent
 import androidx.compose.ui.input.key.type
 import androidx.compose.ui.layout.onSizeChanged
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.unit.DpSize
+import androidx.compose.ui.unit.IntSize
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.Window
 import androidx.compose.ui.window.WindowPosition
@@ -47,6 +47,8 @@ import com.sun.jna.NativeLong
 import kotlinx.coroutines.delay
 import kotlinx.coroutines.launch
 import org.koin.compose.koinInject
+import java.awt.GraphicsEnvironment
+import java.awt.Point
 import java.awt.Rectangle
 import java.awt.Toolkit
 import java.awt.event.WindowAdapter
@@ -57,8 +59,44 @@ import kotlin.time.Duration.Companion.milliseconds
 // Gap between the button and the menu beside it.
 private val MENU_GAP = 4.dp
 
-// Stand-in for the menu's width until its content has been measured.
-private val MENU_WIDTH_GUESS = 200.dp
+// Stand-in for the menu's size until its content has been measured.
+private val MENU_WIDTH_GUESS = 180.dp
+private val MENU_HEIGHT_GUESS = 200.dp
+
+/**
+ * Computes where the context menu window goes beside the button at [anchor].
+ *
+ * Places the menu to the right of the button if it fits within [usableScreen],
+ * otherwise to its left. Top edges are aligned with the button, clamped to ensure
+ * the whole menu remains within the vertical bounds of the usable screen area.
+ */
+internal fun pastePanelMenuPositionBeside(
+    anchor: Rectangle,
+    menuWidth: Int,
+    menuHeight: Int,
+    usableScreen: Rectangle,
+    gap: Int,
+): Point {
+    val rightOfButton = anchor.x + anchor.width + gap
+    val leftOfButton = anchor.x - gap - menuWidth
+    val screenRight = usableScreen.x + usableScreen.width
+    val screenBottom = usableScreen.y + usableScreen.height
+
+    val x =
+        if (rightOfButton + menuWidth <= screenRight) {
+            rightOfButton
+        } else if (leftOfButton >= usableScreen.x) {
+            leftOfButton
+        } else {
+            val maxX = maxOf(usableScreen.x, screenRight - menuWidth)
+            rightOfButton.coerceIn(usableScreen.x, maxX)
+        }
+
+    val maxY = maxOf(usableScreen.y, screenBottom - menuHeight)
+    val y = anchor.y.coerceIn(usableScreen.y, maxY)
+
+    return Point(x, y)
+}
 
 /**
  * The floating button's context menu on Linux, drawn in a window of its own.
@@ -78,51 +116,97 @@ fun PastePanelMenuWindow(
     val appWindowManager = koinInject<DesktopAppWindowManager>()
     val title = appWindowManager.pastePanelMenuWindowTitle
 
-    // Beside the button rather than over it: the button is an override-redirect
-    // window the compositor keeps above every managed one, so anything under it
-    // would be covered. Right of the button, top edges aligned, or to its left
-    // when it would run off the screen. The window packs to its content, so the
-    // final placement waits for the content's measured width; until then a
-    // guess keeps the first frame close.
     val gap = MENU_GAP.value.toInt()
-    val screenWidth = remember { Toolkit.getDefaultToolkit().screenSize.width }
     val density = LocalDensity.current
-    var menuWidth by remember { mutableStateOf<Int?>(null) }
 
-    fun leftFor(width: Int): Int {
-        val right = anchor.x + anchor.width + gap
-        return if (right + width > screenWidth) anchor.x - gap - width else right
-    }
+    val center = remember(anchor) { Point(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2) }
+    val usableScreen =
+        remember(center) {
+            val ge = GraphicsEnvironment.getLocalGraphicsEnvironment()
+            val configuration =
+                ge.screenDevices
+                    .map { it.defaultConfiguration }
+                    .firstOrNull { it.bounds.contains(center) }
+                    ?: ge.defaultScreenDevice.defaultConfiguration
+            val bounds = configuration.bounds
+            val insets = Toolkit.getDefaultToolkit().getScreenInsets(configuration)
+            Rectangle(
+                bounds.x + insets.left,
+                bounds.y + insets.top,
+                bounds.width - insets.left - insets.right,
+                bounds.height - insets.top - insets.bottom,
+            )
+        }
+
+    var menuSize by remember { mutableStateOf<IntSize?>(null) }
+
+    fun currentPosition(
+        width: Int,
+        height: Int,
+    ): Point =
+        pastePanelMenuPositionBeside(
+            anchor = anchor,
+            menuWidth = width,
+            menuHeight = height,
+            usableScreen = usableScreen,
+            gap = gap,
+        )
+
+    val initialPos =
+        remember(anchor, usableScreen) {
+            currentPosition(MENU_WIDTH_GUESS.value.toInt(), ME
```

**File**: `app/src/desktopTest/kotlin/com/crosspaste/ui/PastePanelMenuPlacementTest.kt` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+package com.crosspaste.ui
+
+import java.awt.Point
+import java.awt.Rectangle
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class PastePanelMenuPlacementTest {
+
+    private val screen = Rectangle(0, 25, 1440, 875)
+    private val gap = 4
+    private val menuWidth = 180
+    private val menuHeight = 200
+
+    private fun button(
+        x: Int,
+        y: Int,
+        width: Int = 48,
+        height: Int = 48,
+    ) = Rectangle(x, y, width, height)
+
+    @Test
+    fun `menu opens to the left of the button when right exceeds screen`() {
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(1376, 200),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = screen,
+                gap = gap,
+            )
+        // 1376 - 4 - 180 = 1192
+        assertEquals(Point(1192, 200), position)
+    }
+
+    @Test
+    fun `menu opens to the right of the button when space permits`() {
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(100, 200),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = screen,
+                gap = gap,
+            )
+        // 100 + 48 + 4 = 152
+        assertEquals(Point(152, 200), position)
+    }
+
+    @Test
+    fun `menu is pushed up so it stays on screen near the bottom`() {
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(1376, 800),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = screen,
+                gap = gap,
+            )
+        // screen bottom = 25 + 875 = 900. Max Y = 900 - 200 = 700.
+        assertEquals(700, position.y)
+    }
+
+    @Test
+    fun `menu is pushed down below the top inset near the top`() {
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(1376, 0),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = screen,
+                gap = gap,
+            )
+        // screen top = 25
+        assertEquals(25, position.y)
+    }
+
+    @Test
+    fun `menu stays on secondary monitor with positive offset`() {
+        val secondaryScreen = Rectangle(1920, 0, 1920, 1080)
+        // Button on right edge of secondary monitor: 1920 + 1920 - 48 - 16 = 3776
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(3776, 300),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = secondaryScreen,
+                gap = gap,
+            )
+        // 3776 - 4 - 180 = 3592 (stays on secondary screen)
+        assertEquals(Point(3592, 300), position)
+    }
+
+    @Test
+    fun `menu stays on secondary monitor with negative offset`() {
+        val secondaryScreen = Rectangle(-1920, 0, 1920, 1080)
+        // Button on right edge of left secondary monitor: -48 - 16 = -64
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(-64, 300),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = secondaryScreen,
+                gap = gap,
+            )
+        // -64 - 4 - 180 = -248 (stays on left secondary screen)
+        assertEquals(Point(-248, 300), position)
+    }
+
+    @Test
+    fun `menu is clamped when neither side fits completely`() {
+        val narrowScreen = Rectangle(0, 0, 150, 600)
+        val position =
+            pastePanelMenuPositionBeside(
+                anchor = button(50, 100),
+                menuWidth = menuWidth,
+                menuHeight = menuHeight,
+                usableScreen = narrowScreen,
+                gap = gap,
+            )
+        assertEquals(0, position.x)
+    }
+}
```

---

### Incident Patch 14: `77f8e430` (2026-09-29)
**Commit Message**: :bug: close the floating button's menu on Linux when the user clicks elsewhere (#5078)

The XAWT popup menu learns about a click elsewhere through an X pointer
grab, which under XWayland never sees a click on a Wayland surface, so the
menu stayed open until an item was chosen.

On Linux the menu is now a focusable window of its own that closes on focus
loss, Escape or choosing an item, opens beside the button instead of under
it, hides the paste panel when it opens and is hidden by a left click on the
button. macOS keeps the native AWT menu and Windows the Win32 one.

Closes #5077

**File**: `app/src/desktopMain/kotlin/com/crosspaste/app/DesktopAppWindowManager.kt` (modified, +3/-0)
```diff
@@ -99,6 +99,7 @@ abstract class DesktopAppWindowManager(
         private const val PASTE_PANEL_WINDOW_TITLE = "CrossPaste Paste Panel"
 
         private const val PASTE_PANEL_BUTTON_WINDOW_TITLE = "CrossPaste Paste Panel Button"
+        private const val PASTE_PANEL_MENU_WINDOW_TITLE = "CrossPaste Paste Panel Menu"
     }
 
     protected val logger: KLogger = KotlinLogging.logger {}
@@ -113,6 +114,8 @@ abstract class DesktopAppWindowManager(
 
     val pastePanelButtonWindowTitle: String = PASTE_PANEL_BUTTON_WINDOW_TITLE
 
+    val pastePanelMenuWindowTitle: String = PASTE_PANEL_MENU_WINDOW_TITLE
+
     protected val ioScope = namedScope(ioDispatcher, "DesktopAppWindowManager")
 
     private val _mainWindowInfo =
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelButtonWindow.kt` (modified, +29/-18)
```diff
@@ -1,15 +1,14 @@
 package com.crosspaste.ui
 
-import androidx.compose.material3.MaterialTheme
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.DisposableEffect
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.collectAsState
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
-import androidx.compose.ui.graphics.Color
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.graphics.painter.Painter
-import androidx.compose.ui.graphics.toArgb
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.WindowPosition
 import com.crosspaste.app.DesktopAppWindowManager
@@ -28,6 +27,7 @@ import kotlinx.coroutines.launch
 import org.koin.compose.koinInject
 import java.awt.MenuItem
 import java.awt.PopupMenu
+import java.awt.Rectangle
 
 /**
  * Floating round button that opens and closes [PastePanelWindow]. It is toggled by the
@@ -57,6 +57,7 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
 
     val isMac = remember { platform.isMacos() }
     val isWindows = remember { platform.isWindows() }
+    val isLinux = remember { platform.isLinux() }
 
     NonActivatingWindow(
         visible = buttonInfo.show,
@@ -72,11 +73,13 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
 
         val window = this.window
         val popupMenu =
-            if (isWindows) {
-                null
-            } else {
+            if (isMac) {
                 remember(window) { PopupMenu().also { window.add(it) } }
+            } else {
+                null
             }
+        // Linux draws the menu in a window of its own beside the button, see PastePanelMenuWindow
+        var linuxMenuAnchor by remember { mutableStateOf<Rectangle?>(null) }
         DisposableEffect(window) {
             onDispose {
                 popupMenu?.let { window.remove(it) }
@@ -102,14 +105,19 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
         fun showMenu(
             x: Int,
             y: Int,
-            surface: Color,
         ) {
+            // The menu and the panel never show together
+            appWindowManager.hidePastePanelWindow()
             if (isWindows) {
                 WindowsPopupMenu.show(menuEntries()) { action ->
                     mainCoroutineDispatcher.launch { action() }
                 }
                 return
             }
+            if (isLinux) {
+                linuxMenuAnchor = Rectangle(window.bounds)
+                return
+            }
             val menu = popupMenu ?: return
             menu.removeAll()
             menuEntries().forEach { entry ->
@@ -119,27 +127,30 @@ fun PastePanelButtonWindow(windowIcon: Painter?) {
                     NativeMenuEntry.Separator -> menu.addSeparator()
                 }
             }
-            // XAWT paints the menu in the background colour of the component it is shown
-            // over, and a transparent window's own background is fully transparent, which left the
-            // Linux menu see-through. The content pane never paints inside a transparent
-            // window, so its colour is free to carry the theme surface for the menu; XAWT
-            // derives a readable text colour from it in either theme.
-            val contentPane = window.contentPane
-            contentPane.background = java.awt.Color(surface.toArgb())
-            menu.show(contentPane, x, y)
+            menu.show(window.contentPane, x, y)
         }
 
         PastePanelWindowContext {
-            val menuSurface = MaterialTheme.colorScheme.surface
             PastePanelButtonContent(
                 window = window,
                 panelOpen = panelInfo.show,
-                onClick = { appWindowManager.switchPastePanelWindow(WindowTrigger.SYSTEM) },
-                onSecondaryClick = { x, y -> showMenu(x, y, menuSurface) },
+                onClick = {
+                    linuxMenuAnchor = null
+                    appWindowManager.switchPastePanelWindow(WindowTrigger.SYSTEM)
+                },
+                onSecondaryClick = { x, y -> showMenu(x, y) },
                 onMoved = { x, y ->
                     appWindowManager.movePastePanelButton(WindowPosition(x.dp, y.dp))
                 },
             )
         }
+
+        linuxMenuAnchor?.let { anchor ->
+            PastePanelMenuWindow(
+                anchor = anchor,
+                entries = menuEntries(),
+                onDismiss = { linuxMenuAnchor = null },
+            )
+        }
     }
 }
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/PastePanelMenuWindow.kt` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+package com.crosspaste.ui
+
+import androidx.compose.foundation.background
+import androidx.compose.foundation.border
+import androidx.compose.foundation.clickable
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.IntrinsicSize
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.width
+import androidx.compose.material3.HorizontalDivider
+import androidx.compose.material3.MaterialTheme
+import androidx.compose.material3.Text
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.DisposableEffect
+import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.draw.clip
+import androidx.compose.ui.input.key.Key
+import androidx.compose.ui.input.key.KeyEventType
+import androidx.compose.ui.input.key.key
+import androidx.compose.ui.input.key.onPreviewKeyEvent
+import androidx.compose.ui.input.key.type
+import androidx.compose.ui.layout.onSizeChanged
+import androidx.compose.ui.platform.LocalDensity
+import androidx.compose.ui.unit.DpSize
+import androidx.compose.ui.unit.dp
+import androidx.compose.ui.window.Window
+import androidx.compose.ui.window.WindowPosition
+import androidx.compose.ui.window.rememberWindowState
+import com.crosspaste.app.DesktopAppWindowManager
+import com.crosspaste.platform.linux.api.X11Api
+import com.crosspaste.ui.DesktopContext.PastePanelWindowContext
+import com.crosspaste.ui.base.NativeMenuEntry
+import com.crosspaste.ui.theme.AppUIColors
+import com.crosspaste.ui.theme.AppUISize.medium
+import com.crosspaste.ui.theme.AppUISize.tiny2X
+import com.crosspaste.ui.theme.AppUISize.tiny3X
+import com.crosspaste.ui.theme.AppUISize.tiny3XRoundedCornerShape
+import com.crosspaste.ui.theme.AppUISize.tiny5X
+import com.crosspaste.utils.GlobalCoroutineScope.mainCoroutineDispatcher
+import com.sun.jna.NativeLong
+import kotlinx.coroutines.delay
+import kotlinx.coroutines.launch
+import org.koin.compose.koinInject
+import java.awt.Rectangle
+import java.awt.Toolkit
+import java.awt.event.WindowAdapter
+import java.awt.event.WindowEvent
+import java.util.concurrent.atomic.AtomicBoolean
+import kotlin.time.Duration.Companion.milliseconds
+
+// Gap between the button and the menu beside it.
+private val MENU_GAP = 4.dp
+
+// Stand-in for the menu's width until its content has been measured.
+private val MENU_WIDTH_GUESS = 200.dp
+
+/**
+ * The floating button's context menu on Linux, drawn in a window of its own.
+ *
+ * The XAWT popup menu finds out about a click elsewhere through an X pointer
+ * grab. Under XWayland a click on a Wayland surface never reaches the X server,
+ * so that menu simply stayed open. This window takes the keyboard focus instead
+ * and closes the moment it loses it, the way the search and bubble windows do,
+ * which works wherever the compositor moves focus — X11 and Wayland alike.
+ */
+@Composable
+fun PastePanelMenuWindow(
+    anchor: Rectangle,
+    entries: List<NativeMenuEntry>,
+    onDismiss: () -> Unit,
+) {
+    val appWindowManager = koinInject<DesktopAppWindowManager>()
+    val title = appWindowManager.pastePanelMenuWindowTitle
+
+    // Beside the button rather than over it: the button is an override-redirect
+    // window the compositor keeps above every managed one, so anything under it
+    // would be covered. Right of the button, top edges aligned, or to its left
+    // when it would run off the screen. The window packs to its content, so the
+    // final placement waits for the content's measured width; until then a
+    // guess keeps the first frame close.
+    val gap = MENU_GAP.value.toInt()
+    val screenWidth = remember { Toolkit.getDefaultToolkit().screenSize.width }
+    val density = LocalDensity.current
+    var menuWidth by remember { mutableStateOf<Int?>(null) }
+
+    fun leftFor(width: Int): Int {
+        val right = anchor.x + anchor.width + gap
+        return if (right + width > screenWidth) anchor.x - gap - width else right
+    }
+    val windowState =
+        rememberWindowState(
+            position = WindowPosition(leftFor(MENU_WIDTH_GUESS.value.toInt()).dp, anchor.y.dp),
+            size = DpSize.Unspecified,
+        )
+    LaunchedEffect(menuWidth) {
+        menuWidth?.let { windowState.position = WindowPosition(leftFor(it).dp, anchor.y.dp) }
+    }
+
+    // Mapping the window does not hand it the focus; ask X11 for it as the other
+    // windows do, and ignore the focus shuffle on the way up.
+    val ignoreFocusLoss = remember { AtomicBoolean(true) }
+    LaunchedEffect(Unit) {
+        delay(100.milliseconds)
+        X11Api.bringToFront(X11Api.getWindow(title), source = NativeLong(1))
+        delay(300.millisecon
```

---

### Incident Patch 15: `e0e8c2cc` (2026-09-29)
**Commit Message**: :bug: let the floating button fade back on Linux when no pointer exit arrives (#5076)

With an absolute pointing device — VMs, tablets, touchscreens — XWayland
delivers MotionNotify to the button's canvas but never an EnterNotify or
LeaveNotify, so Compose's hoverable switched on with the first move and
never off: the button went opaque on the first hover and stayed that way.

On Linux, count the button as hovered while pointer events keep arriving and
fade it 800 ms after the last one, or at once when an Exit does arrive. The
composable is split into a PointerActivity holder, a gesture Modifier and
the drawing; the gesture reads its callbacks through rememberUpdatedState,
and the transparent corners outside the circle no longer take pointer input.

Closes #5075

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/paste/panel/PastePanelButtonContent.kt` (modified, +153/-45)
```diff
@@ -14,7 +14,10 @@ import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.material3.Icon
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.rememberUpdatedState
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.awt.ComposeWindow
@@ -24,18 +27,27 @@ import androidx.compose.ui.graphics.Brush
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.input.pointer.AwaitPointerEventScope
 import androidx.compose.ui.input.pointer.PointerEvent
+import androidx.compose.ui.input.pointer.PointerEventPass
 import androidx.compose.ui.input.pointer.PointerEventType
+import androidx.compose.ui.input.pointer.PointerInputChange
 import androidx.compose.ui.input.pointer.isSecondaryPressed
 import androidx.compose.ui.input.pointer.pointerInput
 import com.crosspaste.app.generated.resources.Res
 import com.crosspaste.app.generated.resources.crosspaste_svg
 import com.crosspaste.i18n.GlobalCopywriter
+import com.crosspaste.platform.Platform
 import com.crosspaste.ui.LocalDesktopAppSizeValueState
+import kotlinx.coroutines.Job
+import kotlinx.coroutines.coroutineScope
+import kotlinx.coroutines.delay
+import kotlinx.coroutines.launch
 import org.jetbrains.compose.resources.painterResource
 import org.koin.compose.koinInject
 import java.awt.MouseInfo
 import kotlin.math.hypot
 import kotlin.math.roundToInt
+import kotlin.time.Duration
+import kotlin.time.Duration.Companion.milliseconds
 
 // The app icon's blue gradient; the white clipboard glyph is drawn straight onto it.
 private val BUTTON_GRADIENT_TOP = Color(0xFF2F7BFE)
@@ -45,6 +57,9 @@ private const val IDLE_ALPHA = 0.6f
 
 private const val GLYPH_FRACTION = 0.55f
 
+// How long the button stays lit after the last pointer event on Linux.
+private val LINUX_HOVER_HOLD = 800.milliseconds
+
 /**
  * Round, translucent button: the app icon's gradient with its white glyph on top, so
  * the two read as one shape. Opaque while hovered or while the panel it controls is
@@ -60,61 +75,33 @@ fun PastePanelButtonContent(
     onMoved: (x: Int, y: Int) -> Unit,
 ) {
     val copywriter = koinInject<GlobalCopywriter>()
-
+    val platform = koinInject<Platform>()
     val appSizeValue = LocalDesktopAppSizeValueState.current
 
+    val isLinux = remember { platform.isLinux() }
+    val pointerActivity = remember { PointerActivity() }
     val interactionSource = remember { MutableInteractionSource() }
-    val hovered by interactionSource.collectIsHoveredAsState()
+    val hovered =
+        if (isLinux) {
+            pointerActivity.isRecentlyActive
+        } else {
+            interactionSource.collectIsHoveredAsState().value
+        }
     val alpha by animateFloatAsState(if (hovered || panelOpen) 1f else IDLE_ALPHA)
 
     Box(
         modifier =
             Modifier
                 .size(appSizeValue.pastePanelButtonSize)
                 .alpha(alpha)
-                .hoverable(interactionSource)
-                .pointerInput(window) {
-                    awaitEachGesture {
-                        val press = awaitEventOfType(PointerEventType.Press)
-                        val down = press.changes.first()
-                        if (press.buttons.isSecondaryPressed) {
-                            down.consume()
-                            val up = awaitEventOfType(PointerEventType.Release).changes.first()
-                            up.consume()
-                            onSecondaryClick(
-                                up.position.x
-                                    .toDp()
-                                    .value
-                                    .roundToInt(),
-                                up.position.y
-                                    .toDp()
-                                    .value
-                                    .roundToInt(),
-                            )
-                            return@awaitEachGesture
-                        }
-                        val startPointer = MouseInfo.getPointerInfo()?.location ?: return@awaitEachGesture
-                        val startWindow = window.location
-                        var dragging = false
-                        drag(down.id) { change ->
-                            val pointer = MouseInfo.getPointerInfo()?.location ?: return@drag
-                            val dx = pointer.x - startPointer.x
-                            val dy = pointer.y - startPointer.y
-                            if (!dragging && hypot(dx.toDouble(), dy.toDouble()) > viewConfiguration.touchSlop) {
-                                dragging = true
-                            }
-                            if (dragging) {
-                                change.consume()
-                                window.setLocat
```

#### Recent Merged Pull Requests:
- **PR #5115** (2026-10-06): :white_check_mark: make eight silently skipped tests run and guard against non-void test methods (#5114) (@guiyanakuang)
- **PR #5113** (2026-10-06): :zap: stop the tutorial button pulse after a few cycles (#5112) (@guiyanakuang)
- **PR #5111** (2026-10-06): :zap: only compose the device refresh spinners while they spin (#5110) (@guiyanakuang)
- **PR #5109** (2026-10-06): :bug: stop logging the pairing token in headless mode (#5108) (@guiyanakuang)
- **PR #5107** (2026-10-06): :memo: fix broken DeepWiki badge and bump download badge to v2.2.1 (@guiyanakuang)
- **PR #5106** (2026-10-06): :bug: reference MCP-added files at their original path (@guiyanakuang)
- **PR #5104** (2026-10-05): :bug: refresh companion flavors when editing a paste from the UI (@guiyanakuang)
- **PR #5102** (2026-10-05): :bug: remove tag links when a tag or paste is deleted (@guiyanakuang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
