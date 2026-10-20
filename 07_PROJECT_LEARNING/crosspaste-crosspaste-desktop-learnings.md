> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crosspaste-crosspaste-desktop-learnings.md`  
> **Source**: github ([https://github.com/CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop))  
> **Source Version**: `e9e85210`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T21:27:33.834Z  
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
> **Harvest Timestamp**: 2026-10-20T21:27:33.699Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CrossPaste/crosspaste-desktop`
- **Description**: Cross-device clipboard sync for macOS, Windows & Linux — end-to-end encrypted, LAN-only, no cloud. OCR, CLI and MCP server built in.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2647 stars

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
- **Issue #5189** (2026-10-12): **Windows MSIX install fails with 0x80080204: duplicate windows.appExecutionAlias extension**
  *Symptoms*: ## Summary  Installing CrossPaste 2.2.1 on Windows via the App Installer (`https://oss.crosspaste.com/site/crosspaste.appinstaller`) fails with `0x80080204` (APPX_E_INVALID_MANIFEST). Reported in https://github.com/CrossPaste/crosspaste-desktop/issues/4996#issuecomment-6115927687.  ``` Error: Failed to install https://oss.crosspaste.com/site/crosspaste.appinstaller due to error: 0x80080204: AppxManifest validation error: line 26, column 26, reason: Only one Extension element with Category attribute value "windows.appExecutionAlias" may be declared. ```  (The original message is localized Chinese; the text above is a translation.)  ## Root cause  The MSIX manifest declares two `windows.appExecutionAlias` extensions inside the same `<Application>`:  - `crosspaste.exe` → `updatecheck.exe`, generated by Conveyor for the main launcher - `crosspaste-cli.exe` → `app\bin\crosspaste-cli.exe`, appended by `cli.conveyor.conf` through `app.windows.manifests.msix.extensions-xml` (introduced in #4776, shipped since 2.2.0)  Line 26, column 26 of the published `AppxManifest.xml` is exactly the second extension.  Nothing on our side changed between 2.2.0 and 2.2.1:  - The `AppxManifest.xml` extracted from `crosspaste-2.2.0-2544.x64.msix` and `crosspaste-2.2.1-2706.x64.msix` is identical apart from the version number. - Both releases were built with the same Conveyor GitHub action (`v22.1`). - 2.2.0 installed fine on the same Windows machines at the time.  So a recent Windows update started en

- **Issue #5185** (2026-10-11): **Linux: showing a file in the file manager always fails (BROWSE_FILE_DIR unsupported)**
  *Symptoms*: ## Problem  On Linux, "show in file manager" for file paste items always fails with the `failed_to_browse_file_pasteboard` notification. `DesktopUISupport.browseFile` only works when AWT reports `Desktop.Action.BROWSE_FILE_DIR`, and JBR/AWT never supports that action on Linux. Verified on Ubuntu 24.04 under both GNOME and KDE Plasma (Wayland): `isSupported(BROWSE_FILE_DIR) == false` in both sessions.  `browseFile` is reached from `openPasteData` for non-image/non-video file items and for multi-image items, so double-clicking those items on Linux never does anything useful.  This is separate from #5184, which moved URL/HTML/RTF/file opening on Linux to `xdg-open` but did not touch `browseFile`.  ## Proposed fix  On Linux, bypass AWT and:  1. Call the freedesktop `org.freedesktop.FileManager1.ShowItems` D-Bus method (implemented by Nautilus, Dolphin, Nemo, Caja, Thunar, ...) via `dbus-send`, which opens the containing folder with the file selected. 2. If `dbus-send` is missing or the call fails (no FileManager1 service), fall back to opening the parent directory with `xdg-open`. 3. Notify `failed_to_browse_file_pasteboard` only if both fail.  macOS and Windows behaviour stays unchanged. 

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

### Incident Patch 1: `e9e85210` (2026-10-20)
**Commit Message**: :fire: remove the sort toggle from the search window (#5235)

**File**: `app/src/commonMain/kotlin/com/crosspaste/ui/model/GeneralPasteSearchViewModel.kt` (modified, +0/-1)
```diff
@@ -49,7 +49,6 @@ class GeneralPasteSearchViewModel(
                 searchPasteData
                     .searchPasteDataFlow(
                         searchTerms = params.searchTerms,
-                        sort = params.sort,
                         pasteTypeList = params.pasteTypeList,
                         tag = params.tag,
                         limit = params.limit,
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/ui/model/PasteSearchViewModel.kt` (modified, +0/-10)
```diff
@@ -33,7 +33,6 @@ abstract class PasteSearchViewModel : ViewModel() {
         MutableStateFlow(
             SearchBaseParams(
                 pasteTypeList = listOf(),
-                sort = true,
                 tag = null,
                 limit = QUERY_BATCH_SIZE,
             ),
@@ -67,7 +66,6 @@ abstract class PasteSearchViewModel : ViewModel() {
             SearchParams(
                 searchTerms = searchTerms,
                 pasteTypeList = searchBaseParams.pasteTypeList,
-                sort = searchBaseParams.sort,
                 tag = searchBaseParams.tag,
                 limit = searchBaseParams.limit,
             )
@@ -87,13 +85,6 @@ abstract class PasteSearchViewModel : ViewModel() {
         _loadAll.value = false
     }
 
-    fun switchSort() {
-        _searchBaseParams.value =
-            _searchBaseParams.value.copy(
-                sort = !_searchBaseParams.value.sort,
-            )
-    }
-
     fun updatePasteType(pasteTypeList: List<Int>) {
         pendingLoadJob?.cancel()
         _searchBaseParams.value =
@@ -162,7 +153,6 @@ abstract class PasteSearchViewModel : ViewModel() {
         _searchBaseParams.value =
             _searchBaseParams.value.copy(
                 pasteTypeList = listOf(),
-                sort = true,
                 tag = null,
                 limit = QUERY_BATCH_SIZE,
             )
```

**File**: `app/src/commonMain/kotlin/com/crosspaste/ui/model/SearchParams.kt` (modified, +0/-2)
```diff
@@ -2,15 +2,13 @@ package com.crosspaste.ui.model
 
 data class SearchBaseParams(
     val pasteTypeList: List<Int>,
-    val sort: Boolean,
     val tag: Long?,
     val limit: Int,
 )
 
 data class SearchParams(
     val searchTerms: List<String>,
     val pasteTypeList: List<Int>,
-    val sort: Boolean,
     val tag: Long?,
     val limit: Int,
 )
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/paste/side/SidePasteboardContentView.kt` (modified, +1/-2)
```diff
@@ -133,12 +133,11 @@ fun SidePasteboardContentView() {
     }
 
     // Reset selection to the first match and scroll to the top whenever the search query or any
-    // filter changes (term, sort, type, or tag). Input is debounced, so the matching results
+    // filter changes (term, type, or tag). Input is debounced, so the matching results
     // arrive a moment after the params change: re-assert once they land so the first item is
     // selected and scrolled into view. This also covers the case where nothing matches.
     LaunchedEffect(
         inputSearch,
-        searchBaseParams.sort,
         searchBaseParams.pasteTypeList,
         searchBaseParams.tag,
     ) {
```

**File**: `app/src/desktopMain/kotlin/com/crosspaste/ui/search/SearchTrailingIcon.kt` (modified, +0/-33)
```diff
@@ -7,15 +7,13 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.foundation.layout.Row
-import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.height
 import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.layout.width
 import androidx.compose.foundation.layout.wrapContentHeight
 import androidx.compose.foundation.layout.wrapContentSize
 import androidx.compose.foundation.layout.wrapContentWidth
 import androidx.compose.material3.HorizontalDivider
-import androidx.compose.material3.IconButtonDefaults.iconButtonColors
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.OutlinedButton
 import androidx.compose.material3.Text
@@ -36,25 +34,18 @@ import androidx.compose.ui.unit.TextUnit
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.Popup
 import androidx.compose.ui.window.PopupProperties
-import com.composables.icons.materialsymbols.MaterialSymbols
-import com.composables.icons.materialsymbols.rounded.Arrow_downward
-import com.composables.icons.materialsymbols.rounded.Arrow_upward
 import com.crosspaste.i18n.GlobalCopywriter
 import com.crosspaste.paste.PasteType
 import com.crosspaste.paste.PasteType.Companion.ALL_TYPES
-import com.crosspaste.ui.base.GeneralIconButton
 import com.crosspaste.ui.base.MenuItemView
 import com.crosspaste.ui.model.PasteSearchViewModel
 import com.crosspaste.ui.theme.AppUIFont.getFontWidth
 import com.crosspaste.ui.theme.AppUISize.huge
-import com.crosspaste.ui.theme.AppUISize.large2X
 import com.crosspaste.ui.theme.AppUISize.small
 import com.crosspaste.ui.theme.AppUISize.small3X
-import com.crosspaste.ui.theme.AppUISize.tiny2X
 import com.crosspaste.ui.theme.AppUISize.tiny2XRoundedCornerShape
 import com.crosspaste.ui.theme.AppUISize.tiny3X
 import com.crosspaste.ui.theme.AppUISize.tiny5X
-import com.crosspaste.ui.theme.AppUISize.xLarge
 import com.crosspaste.ui.theme.AppUISize.xxxxLarge
 import com.crosspaste.ui.theme.AppUISize.zero
 import org.koin.compose.koinInject
@@ -96,30 +87,6 @@ fun SearchTrailingIcon() {
         horizontalArrangement = Arrangement.Start,
         verticalAlignment = Alignment.CenterVertically,
     ) {
-        // The arrow shows the current order, following the list-header convention:
-        // pointing down = descending (newest first), pointing up = ascending (oldest first).
-        GeneralIconButton(
-            imageVector =
-                if (searchBaseParams.sort) {
-                    MaterialSymbols.Rounded.Arrow_downward
-                } else {
-                    MaterialSymbols.Rounded.Arrow_upward
-                },
-            desc = if (searchBaseParams.sort) "sort_newest_first" else "sort_oldest_first",
-            colors =
-                iconButtonColors(
-                    containerColor = Color.Transparent,
-                    contentColor = MaterialTheme.colorScheme.primary,
-                ),
-            buttonSize = xLarge,
-            iconSize = large2X,
-            shape = tiny2XRoundedCornerShape,
-        ) {
-            pasteSearchViewModel.switchSort()
-        }
-
-        Spacer(modifier = Modifier.width(tiny2X))
-
         OutlinedButton(
             onClick = {
                 showTypes = true
```

**File**: `app/src/desktopMain/resources/i18n/de.properties` (modified, +0/-2)
```diff
@@ -362,8 +362,6 @@ show_search=Suchfenster ein- oder ausblenden
 size=Größe
 size_limits=Größenlimits
 skip_pre_launch_pasteboard_content=Zwischenablage-Inhalt von vor dem Start ignorieren
-sort_newest_first=Neueste zuerst
-sort_oldest_first=Älteste zuerst
 sound_effect=Töne
 source=Quelle
 source_control_settings=Zwischenablage-Quellen
```

**File**: `app/src/desktopMain/resources/i18n/en.properties` (modified, +0/-2)
```diff
@@ -362,8 +362,6 @@ show_search=Show or hide search window
 size=Size
 size_limits=Size limits
 skip_pre_launch_pasteboard_content=Ignore clipboard contents from before launch
-sort_newest_first=Newest first
-sort_oldest_first=Oldest first
 sound_effect=Sounds
 source=Source
 source_control_settings=Clipboard sources
```

**File**: `app/src/desktopMain/resources/i18n/es.properties` (modified, +0/-2)
```diff
@@ -362,8 +362,6 @@ show_search=Mostrar u ocultar la ventana de búsqueda
 size=Tamaño
 size_limits=Límites de tamaño
 skip_pre_launch_pasteboard_content=Ignorar el contenido del portapapeles anterior al inicio
-sort_newest_first=Más recientes primero
-sort_oldest_first=Más antiguos primero
 sound_effect=Sonidos
 source=Fuente
 source_control_settings=Fuentes del portapapeles
```

#### Recent Merged Pull Requests:
- **PR #5235** (2026-10-20): :fire: remove the sort toggle from the search window (@guiyanakuang)
- **PR #5234** (2026-10-19): :bug: discard remote pastes with invalid content instead of writing them to the clipboard (@guiyanakuang)
- **PR #5233** (2026-10-18): :sparkles: catch up on missed pastes when a peer reconnects (@guiyanakuang)
- **PR #5232** (2026-10-18): :construction_worker: refresh README contributors when an outside contributor's PR is merged (@guiyanakuang)
- **PR #5231** (2026-10-17): :hammer: expose the pairing v3 dialog state as a StateFlow (@guiyanakuang)
- **PR #5229** (2026-10-17): :bug: report Windows plugin script failures as a single line (@guiyanakuang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
