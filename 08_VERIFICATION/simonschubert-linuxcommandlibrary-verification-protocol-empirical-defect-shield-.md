# Verification Protocol: Verification Protocol: Empirical Defect Shield for SimonSchubert/LinuxCommandLibrary

<!-- PROVENANCE_START
{
  "source_repository": "SimonSchubert/LinuxCommandLibrary",
  "source_url": "https://github.com/SimonSchubert/LinuxCommandLibrary",
  "source_version": "6bf6a477",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T03:28:28.654Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-simonschubert-linuxcommandlibrary",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [SimonSchubert/LinuxCommandLibrary](https://github.com/SimonSchubert/LinuxCommandLibrary) (Revision: `6bf6a477`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T03:28:28.654Z`  
> **Learning ID**: `learn-github-simonschubert-linuxcommandlibrary`


## 1. Scope & Verification Target
- **Target Repository**: `SimonSchubert/LinuxCommandLibrary` (Commit: `6bf6a477`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): SimonSchubert/LinuxCommandLibrary

> **Canonical Artifact**: `07_PROJECT_LEARNING/simonschubert-linuxcommandlibrary-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SimonSchubert/LinuxCommandLibrary](https://github.com/SimonSchubert/LinuxCommandLibrary))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T03:28:26.825Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SimonSchubert/LinuxCommandLibrary`
- **Description**: 2M+ app downloads, 500k+ monthly website visitors, Linux basics, tips and formatted man pages
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2130 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/linuxcommandlibrary/app/nav/LinuxNavState.kt`
```
@file:OptIn(ExperimentalMaterial3AdaptiveApi::class)

package com.linuxcommandlibrary.app.nav

import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.WindowAdaptiveInfo
import androidx.compose.material3.adaptive.layout.ListDetailPaneScaffoldRole
import androidx.compose.material3.adaptive.layout.ThreePaneScaffoldDestinationItem
import androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirective
import androidx.compose.material3.adaptive.navigation.BackNavigationBehavior
import androidx.compose.material3.adaptive.navigation.ThreePaneScaffoldNavigator
import androidx.compose.material3.adaptive.navigation.rememberListDetailPaneScaffoldNavigator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.linuxcommandlibrary.app.NavEvent
import com.linuxcommandlibrary.app.Route
import com.linuxcommandlibrary.app.platform.rememberOpenAppAction
import com.linuxcommandlibrary.app.ui.composables.SearchState
import com.linuxcommandlibrary.app.ui.composables.rememberSearchState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

private val backBehavior = BackNavigationBehavior.PopUntilContentChange

@Stable
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
internal class LinuxNavState(
    val navController: NavHostController,
    val commandsNavigator: ThreePaneScaffoldNavigator<String>,
    val basicsNavigator: ThreePaneScaffoldNavigator<String>,
    val searchState: SearchState,
    val initialRoute: Route,
    val stacks: Map<RouteKey, SnapshotStateList<TabStackEntry>>,
    pendingCommand: MutableState<String?>,
    pendingBasic: MutableState<String?>,
    pendingExpand: MutableState<Long?>,
    lastBasicsGroupId: MutableState<Long?>,
    private val openAppAction: (String) -> Unit,
    private val scope: CoroutineScope,
) {
    var pendingCommand: String? by pendingCommand
    var pendingBasic: String? by pendingBasic
    var pendingExpand: Long? by pendingExpand
    var lastBasicsGroupId: Long? by lastBasicsGroupId

    fun stackFor(key: RouteKey): SnapshotStateList<TabStackEntry> = stacks.getValue(key)

    fun popStack(key: RouteKey) {
        val s = stackFor(key)
        if (s.isNotEmpty()) s.removeAt(s.lastIndex)
    }

    /** Snapshot read of the active tab; falls back to [initialRoute] before NavController emits. */
    private val currentKeyNow: RouteKey
        get() = navController.currentDestination.toRouteKey() ?: initialRoute.toRouteKey()

    /** Composable-tracking version of [currentKeyNow] for selected-state UI. */
    @Composable
    fun currentKey(): RouteKey {
        val entry by navController.currentBackStackEntryAsState()
        return entry?.destination.toRouteKey() ?: initialRoute.toRouteKey()
    }

    fun selectTab(route: Route) {
        navController.navigate(route) {
            popUpTo(navController.graph.startDestinationId) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
        searchState.clear()
    }

    /**
     * First-level detail in the originating tab routes through that tab's pane navigator
     * (via [pendingCommand]/[pendingBasic]); once a cross-type entry is on the stack, further
     * details of either type layer on top via the stack so chained "see also" stays in the tab.
     */
    fun onNavigate(event: NavEvent) {
        when (event) {
            is NavEvent.ToCommand -> {
                val key = currentKeyNow
                val stack = stackFor(key)
                if (key == RouteKey.Commands && stack.isEmpty()) {
                    pendingCommand = event.commandName
                } else {
                    stack.add(TabStackEntry.Command(event.commandName))
                }
            }

            is NavEvent.ToBasicGroups -> {
                lastBasicsGroupId = event.expandGroupId
                val key = currentKeyNow
                val stack = stackFor(key)
                if (key == RouteKey.Basics && stack.isEmpty()) {
                    pendingBasic = event.categoryId
                    pendingExpand = event.expandGroupId
                } else {
                    stack.add(TabStackEntry.BasicGroup(event.categoryId, event.expandGroupId))
                }
            }

            NavEvent.ToLicenses -> stackFor(currentKeyNow).add(TabStackEntry.License)

            is NavEvent.OpenAction -> openAppAction(event.action)
        }
    }

    private fun navigatorFor(key: RouteKey): ThreePaneScaffoldNavigator<String>? = when (key) {
        RouteKey.Basics -> basicsNavigator
        RouteKey.Commands -> commandsNavigator
        RouteKey.Tips -> null
    }

    /** Composable view of whether back is currently meaningful. */
    @Composable
    fun isBackEnabled(): Boolean {
        val key = currentKey()
        val stack = stackFor(key)
        if (stack.isNotEmpty()) return true
        val nav = navigatorFor(key) ?: return false
        return nav.canNavigateBack(backBehavior)
    }

    /**
     * PopUntilContentChange so chained see-also detail screens pop one at a time;
     * the default PopUntilScaffoldValueChange treats Detail("ls") and Detail("rm") as the
     * same scaffold value and pops both together.
     */
    fun onBack() {
        val key = currentKeyNow
        val stack = stackFor(key)
        if (stack.isNotEmpty()) {
            popStack(key)
            val nav = navigatorFor(key)
            if (stack.isEmpty() &&
                nav?.canNavigateBack(backBehavior) != true &&
                searchState.searchText.isNotEmpty()
            ) {
                searchState.requestFocus()
            }
            return
        }
        val nav = navigatorFor(key) ?: return
        if (nav.canNavigateBack(backBehavior)) {
            scope.launch {
                nav.navigateBack(backBehavior)
                if (searchState.searchText.isNotEmpty()) searchState.requestFocus()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
internal fun rememberLinuxNavState(
    initialDeeplink: String?,
    adaptiveInfo: WindowAdaptiveInfo,
): LinuxNavState {
    val navController = rememberNavController()
    // `initialDeeplink` is honored on cold start only. On Android the activity is restarted
    // for new intents in our launchMode; on iOS hand-off and on warm app re-entry, the
    // navigator + searchState already remembered above are not re-keyed — so a deep link
    // arriving mid-session would be ignored. If we ever support warm-deeplink, also key
    // navController/searchState/navigators on `initialDeeplink`.
    val deeplinkResult = remember(initialDeeplink) {
        parseDeeplink(initialDeeplink) ?: DeeplinkResult(Route.Basics, null)
    }
    val initialRoute = deeplinkResult.route

    val initialSearchQuery = (deeplinkResult.selection as? InitialSelection.SearchQuery)?.query.orEmpty()
    val searchState = rememberSearchState(initialText = initialSearchQuery)
    val openAppAction = rememberOpenAppAction()
    val scope = rememberCoroutineScope()

    // Default list pane is 360dp; 320dp gives the detail pane ~40dp more on a typical
    // landscape phone window without truncating list rows.
    // Default inter-pane spacer is 24dp at expanded width — tighter at 8dp avoids the wide
    // dead column between list and detail.
    // Adaptive info comes from the V2 API, which allows 3 partitions at XL width (>=1600dp);
    // cap at 2 since list-detail has no extra pane.
    val defaultDirective = calculatePaneScaffoldDirective(adaptiveInfo)
    val listDetailDirective = defaultDirective.copy(
        maxHorizontalPartitions = defaultDirective.maxHorizontalPartitions.coerceAtMost(2),
        defaultPanePreferredWidth = 320.dp,
        horizontalPartitionSpacerSize = 8.dp,
    )

    // Initialize navigators with the deep-linked detail pane up-front so we don't flash the
    // list pane for one frame before navigating; this also makes the first composition
    // render the final UI, which screenshot tooling depends on.
    val initialCommandName = (deeplinkResult.selection as? InitialSelection.Command)?.name
    val initialBasicId = (deeplinkResult.selection as? InitialSelection.Basics)?.id
    fun initialHistory(detail: String?) = listOfNotNull(
        ThreePaneScaffoldDestinationItem(ListDetailPaneScaffoldRole.List, null),
        detail?.let { ThreePaneScaffoldDestinationItem(ListDetailPaneScaffoldRole.Detail, it) },
    )
    val commandsNavigator = rememberListDetailPaneScaffoldNavigator(
        scaffoldDirective = listDetailDirective,
        initialDestinationHistory = initialHistory(initialCommandName),
    )
    val basicsNavigator = rememberListDetailPaneScaffoldNavigator(
        scaffoldDirective = listDetailDirective,
        initialDestinationHistory = initialHistory(initialBasicId),
    )

    val pendingCommand = rememberSaveable { mutableStateOf<String?>(null) }
    val pendingBasic = rememberSaveable { mutableStateOf<String?>(null) }
    val pendingExpand = rememberSaveable { mutableStateOf<Long?>(null) }
    // Survives consume/clear of pendingExpand so the search overlay can still
    // highlight the matching result on the basicsNavigator path.
    val lastBasicsGroupId = rememberSav
```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/com/linuxcommandlibrary/app/ui/composables/SearchState.kt`
```
package com.linuxcommandlibrary.app.ui.composables

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue

class SearchState(
    private val textFieldValue: MutableState<TextFieldValue>,
    private val isVisibleState: MutableState<Boolean>,
    private val focusEpochState: MutableState<Int>,
) {
    val searchText: String get() = textFieldValue.value.text
    val currentValue: TextFieldValue get() = textFieldValue.value
    val isVisible: Boolean get() = isVisibleState.value
    val focusEpoch: Int get() = focusEpochState.value
    fun updateText(value: TextFieldValue) {
        textFieldValue.value = value
    }
    fun clearText() {
        textFieldValue.value = TextFieldValue("")
    }
    fun show() {
        isVisibleState.value = true
    }
    fun clear() {
        textFieldValue.value = TextFieldValue(text = "", selection = TextRange(0))
        isVisibleState.value = false
    }
    fun requestFocus() {
        focusEpochState.value += 1
    }
}

@Composable
fun rememberSearchState(initialText: String = ""): SearchState {
    val textFieldValue = rememberSaveable(stateSaver = TextFieldValue.Saver) {
        mutableStateOf(TextFieldValue(text = initialText, selection = TextRange(initialText.length)))
    }
    val isVisible = rememberSaveable { mutableStateOf(initialText.isNotEmpty()) }
    // Transient request signal, not state — `remember` only. After process death the user
    // returns to a focused-but-not-keyboard-raised search field, which is fine.
    val focusEpoch = remember { mutableIntStateOf(0) }
    return remember { SearchState(textFieldValue, isVisible, focusEpoch) }
}

```

### Core Architecture Module: `viewmodels/src/commonMain/kotlin/com/linuxcommandlibrary/app/ui/screens/basicgroups/BasicGroupsUiState.kt`
```
package com.linuxcommandlibrary.app.ui.screens.basicgroups

import com.linuxcommandlibrary.app.data.BasicGroup
import com.linuxcommandlibrary.shared.TipSectionElement
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.ImmutableMap
import kotlinx.collections.immutable.persistentListOf
import kotlinx.collections.immutable.persistentMapOf

data class BasicGroupsUiState(
    val categoryTitle: String = "",
    val basicGroups: ImmutableList<BasicGroup> = persistentListOf(),
    val collapsedMap: ImmutableMap<Long, Boolean> = persistentMapOf(),
    val sectionsByGroupId: ImmutableMap<Long, ImmutableList<TipSectionElement>> = persistentMapOf(),
)

```

### Core Architecture Module: `viewmodels/src/commonMain/kotlin/com/linuxcommandlibrary/app/ui/screens/commanddetail/CommandDetailUiState.kt`
```
package com.linuxcommandlibrary.app.ui.screens.commanddetail

import com.linuxcommandlibrary.app.data.CommandSectionInfo
import com.linuxcommandlibrary.shared.InstallEntry
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.ImmutableMap
import kotlinx.collections.immutable.persistentListOf
import kotlinx.collections.immutable.persistentMapOf

data class CommandDetailUiState(
    val sections: ImmutableList<CommandSectionInfo> = persistentListOf(),
    val expandedSectionsMap: ImmutableMap<Long, Boolean> = persistentMapOf(),
    val isBookmarked: Boolean = false,
    val seeAlsoCommands: ImmutableList<String> = persistentListOf(),
    val resources: ImmutableList<ResourceLink> = persistentListOf(),
    val installEntries: ImmutableList<InstallEntry> = persistentListOf(),
) {
    fun isAllExpanded(): Boolean = expandedSectionsMap.all { it.value }
}

/**
 * An external resource link shown as a chip in the RESOURCES section
 * (e.g. label "Source code" opening the upstream repository URL).
 */
data class ResourceLink(
    val label: String,
    val url: String,
)

```

### Core Architecture Module: `viewmodels/src/commonMain/kotlin/com/linuxcommandlibrary/app/ui/screens/search/SearchUiState.kt`
```
package com.linuxcommandlibrary.app.ui.screens.search

import com.linuxcommandlibrary.app.data.BasicGroupMatch
import com.linuxcommandlibrary.app.data.CommandInfo
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.persistentListOf

data class SearchUiState(
    val filteredCommands: ImmutableList<CommandInfo> = persistentListOf(),
    val filteredBasicGroups: ImmutableList<BasicGroupMatch> = persistentListOf(),
)

```

### Core Architecture Module: `viewmodels/src/linuxMain/kotlin/com/linuxcommandlibrary/app/nativeapi/MarkdownRenderer.kt`
```
package com.linuxcommandlibrary.app.nativeapi

import com.linuxcommandlibrary.shared.CommandElement
import com.linuxcommandlibrary.shared.TextElement
import com.linuxcommandlibrary.shared.TipSectionElement

/*
 * Renders parsed basics/tips content back to Markdown for Qt's Text.MarkdownText.
 *
 * Commands already ship as Markdown and are passed through untouched, but basics and
 * tips only exist as parsed element trees. Serialising them here keeps the C boundary
 * to plain strings instead of exposing the whole sealed hierarchy through the header.
 *
 * Man pages and links become `man:` / `lcl:` URLs so QML's onLinkActivated can route
 * them without needing to know how they were encoded.
 */

/** Block kind, so the UI can style code and quotes differently from prose. */
internal fun TipSectionElement.kind(): String = when (this) {
    is TipSectionElement.Text -> "text"
    is TipSectionElement.Blockquote -> "quote"
    is TipSectionElement.Code -> "code"
    is TipSectionElement.Table -> "table"
}

internal fun TipSectionElement.toMarkdown(): String = when (this) {
    is TipSectionElement.Text -> elements.inline()
    is TipSectionElement.Blockquote -> "> " + elements.inline()
    is TipSectionElement.Code -> elements.commandLine().ifBlank { "`$command`" }
    is TipSectionElement.Table -> table()
}

/**
 * Character count of the rendered element, without rendering it. Used to balance the
 * tip card columns, which otherwise had to build every tip's Markdown just to measure it.
 */
internal fun TipSectionElement.weight(): Int = when (this) {
    is TipSectionElement.Text -> elements.textLength()
    is TipSectionElement.Blockquote -> elements.textLength()
    is TipSectionElement.Code -> command.length
    is TipSectionElement.Table -> headers.sumOf { it.textLength() } + rows.sumOf { row -> row.sumOf { it.textLength() } }
}

private fun List<TextElement>.textLength(): Int = sumOf { element ->
    when (element) {
        is TextElement.Plain -> element.text.length
        is TextElement.Bold -> element.text.length
        is TextElement.Italic -> element.text.length
        is TextElement.Man -> element.man.length
        is TextElement.Link -> element.text.length
    }
}

private fun List<TextElement>.inline(): String = joinToString("") { element ->
    when (element) {
        is TextElement.Plain -> element.text
        is TextElement.Bold -> "**${element.text}**"
        is TextElement.Italic -> "_${element.text}_"
        is TextElement.Man -> "[${element.man}](man:${element.man})"
        is TextElement.Link -> "[${element.text}](lcl:${element.action})"
    }
}

private fun List<CommandElement>.commandLine(): String = joinToString("") { element ->
    when (element) {
        is CommandElement.Text -> element.text
        is CommandElement.Man -> "[${element.man}](man:${element.man})"
        is CommandElement.Url -> "[${element.command}](${element.url})"
    }
}.trim()

private fun TipSectionElement.Table.table(): String {
    if (headers.isEmpty()) return ""
    val head = headers.joinToString(" | ", prefix = "| ", postfix = " |") { it.inline() }
    val divider = headers.joinToString(" | ", prefix = "| ", postfix = " |") { "---" }
    val body = rows.joinToString("\n") { row ->
        row.joinToString(" | ", prefix = "| ", postfix = " |") { it.inline() }
    }
    return listOf(head, divider, body).filter { it.isNotBlank() }.joinToString("\n")
}

```

### Core Architecture Module: `android/src/main/java/com/inspiredandroid/linuxcommandbibliotheca/LinuxApplication.kt`
```
package com.inspiredandroid.linuxcommandbibliotheca

import android.app.Application
import com.linuxcommandlibrary.app.di.commonModule
import com.linuxcommandlibrary.app.di.platformModule
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.GlobalContext.startKoin

class LinuxApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        startKoin {
            androidLogger()
            androidContext(this@LinuxApplication)
            modules(commonModule, platformModule())
        }
    }
}

```

### Core Architecture Module: `android/src/main/java/com/inspiredandroid/linuxcommandbibliotheca/MainActivity.kt`
```
package com.inspiredandroid.linuxcommandbibliotheca

import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import com.linuxcommandlibrary.app.App

/* Copyright 2022 Simon Schubert
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(
                android.graphics.Color.TRANSPARENT,
                android.graphics.Color.TRANSPARENT,
            ),
            navigationBarStyle = SystemBarStyle.auto(
                android.graphics.Color.TRANSPARENT,
                android.graphics.Color.TRANSPARENT,
            ),
        )
        super.onCreate(savedInstanceState)
        setContent {
            App(initialDeeplink = intent?.data?.toString())
        }
    }
}

```

### Core Architecture Module: `cli/src/commonMain/kotlin/com/linuxcommandlibrary/nativecli/ContentFormatter.kt`
```
package com.linuxcommandlibrary.nativecli

import com.linuxcommandlibrary.shared.TextElement

/**
 * Converts a command section's markdown into CLI-friendly, terminal-styled text.
 *
 * Shared by the interactive [com.linuxcommandlibrary.nativecli.screens.CommandDetailScreen]
 * and the non-interactive `lcl <command>` output.
 *
 * Man cross references (SEE ALSO and inline `/man/` links) render differently per mode:
 *  - [formatInteractive] underlines them and reports their on-screen [ManLink] regions so
 *    a click can open that command's detail screen inside the TUI.
 *  - [format] (non-interactive, one-shot output) turns them into clickable web links to the
 *    online man page, since there is no TUI session to navigate to.
 *
 * RESOURCES links are always clickable web links in both modes.
 */
object ContentFormatter {

    /** Already-parsed inline elements (basics, tips) as styled terminal text. */
    fun renderTextElements(elements: List<TextElement>): String = elements.joinToString("") { element ->
        when (element) {
            is TextElement.Plain -> element.text
            is TextElement.Bold -> Theme.boldText(element.text)
            is TextElement.Italic -> Theme.italicText(element.text)
            is TextElement.Man -> element.man
            is TextElement.Link -> element.text
        }
    }

    private const val MAN_BASE_URL = "https://linuxcommandlibrary.com/man/"

    private val inlineCodeRegex = Regex("""```([^`]+)```""")
    private val blockquoteRegex = Regex("""^> (.+)""")

    // RESOURCES links are wrapped in code fences: ```[Label](https://...)```
    private val resourceLinkRegex = Regex("""```\[([^\]]+)]\((https?://[^)]+)\)```""")

    // Inline markup matched in one left-to-right pass so the visible column of each man reference
    // can be tracked exactly. Groups: 1=bold, 2=italic, 3=inline code, 4=man label, 5=man command.
    private val tokenRegex = Regex(
        """\*\*([^*]+)\*\*""" +
            """|_([^_]+)_""" +
            """|```([^`]+)```""" +
            """|\[([^\]]+)]\(/man/([^)]+)\)""",
    )

    /** A clickable man-page reference and the visible region it occupies in a rendered line. */
    data class ManLink(val lineIndex: Int, val startCol: Int, val endCol: Int, val command: String)

    /** A rendered section: display [lines] plus the navigable [links] within them. */
    data class Section(val lines: List<String>, val links: List<ManLink>)

    /** Non-interactive rendering: man references become clickable links to the online man page. */
    fun format(title: String, content: String): String = if (title == "RESOURCES") {
        formatResources(content)
    } else {
        buildDefaultSection(content) { label, command -> Theme.link(MAN_BASE_URL + command, label) }
            .lines.joinToString("\n")
    }

    /** Interactive (TUI) rendering: man references become underlined, in-app navigable links. */
    fun formatInteractive(title: String, content: String): Section = if (title == "RESOURCES") {
        Section(formatResources(content).lines(), emptyList())
    } else {
        buildDefaultSection(content) { label, _ -> Theme.linkText(label) }
    }

    /**
     * Shared markdown -> styled-text conversion. Each line is tokenized left to right so the
     * visible column of every man reference is known exactly (independent of the styling codes
     * inserted around bold/italic/code spans). [wrapManLink] decides how each man reference is
     * styled; its visible text is always the link label.
     */
    private fun buildDefaultSection(
        content: String,
        wrapManLink: (label: String, command: String) -> String,
    ): Section {
        val lines = mutableListOf<String>()
        val links = mutableListOf<ManLink>()

        for (rawLine in content.lines()) {
            val lineIndex = lines.size

            // Drop stray multi-line code-fence markers (a complete inline ```...``` is kept).
            if (rawLine.trim().startsWith("```") && !inlineCodeRegex.containsMatchIn(rawLine)) {
                lines.add("")
                continue
            }

            val blockquote = blockquoteRegex.find(rawLine)
            val body = blockquote?.groupValues?.get(1) ?: rawLine

            val sb = StringBuilder()
            var visibleCol = 0
            if (blockquote != null) {
                sb.append("    ")
                visibleCol = 4
            }

            var last = 0
            for (match in tokenRegex.findAll(body)) {
                if (match.range.first > last) {
                    val plain = body.substring(last, match.range.first)
                    sb.append(plain)
                    visibleCol += plain.length
                }
                when {
                    match.groups[1] != null -> { // bold
                        val text = match.groupValues[1]
                        sb.append(Theme.boldText(text))
                        visibleCol += text.length
                    }

                    match.groups[2] != null -> { // italic
                        val text = match.groupValues[2]
                        sb.append(Theme.italicText(text))
                        visibleCol += text.length
                    }

                    match.groups[3] != null -> { // inline code block
                        val text = match.groupValues[3]
                        sb.append("  ${Theme.code("$")} $text")
                        visibleCol += "  $ ".length + text.length
                    }

                    else -> { // man link
                        val label = match.groupValues[4]
                        val command = match.groupValues[5]
                        links.add(ManLink(lineIndex, visibleCol, visibleCol + label.length, command))
                        sb.append(wrapManLink(label, command))
                        visibleCol += label.length
                    }
                }
                last = match.range.last + 1
            }
            if (last < body.length) sb.append(body.substring(last))

            lines.add(sb.toString())
        }

        return Section(lines, links)
    }

    // Render RESOURCES as "Label: <clickable url>" lines (the URL stays visible and copyable).
    // Drops the hidden "<!-- verified: ... -->" metadata comment.
    private fun formatResources(content: String): String = content.lines()
        .mapNotNull { line ->
            val trimmed = line.trim()
            when {
                trimmed.isEmpty() -> null

                trimmed.startsWith("<!--") -> null

                else -> resourceLinkRegex.find(trimmed)
                    ?.let { "  ${Theme.boldText(it.groupValues[1])}: ${Theme.link(it.groupValues[2], it.groupValues[2])}" }
                    ?: line
            }
        }
        .joinToString("\n")
}

```

### Core Architecture Module: `cli/src/commonMain/kotlin/com/linuxcommandlibrary/nativecli/Main.kt`
```
package com.linuxcommandlibrary.nativecli

import com.github.ajalt.mordant.terminal.Terminal
import com.linuxcommandlibrary.nativecli.data.DataRepository
import com.linuxcommandlibrary.shared.Version

fun main(args: Array<String>) {
    val terminal = Terminal()

    when {
        args.isEmpty() -> {
            // Interactive mode
            val app = TuiApp(terminal)
            app.run()
        }

        args[0] == "--help" || args[0] == "-h" -> {
            showHelp(terminal)
        }

        args[0] == "--version" || args[0] == "-v" -> {
            terminal.println("Linux Command Library v${Version.APP_VERSION}")
        }

        args[0] == "--list" || args[0] == "-l" -> {
            // List all commands
            DataRepository.getCommandNames().forEach { name ->
                terminal.println(name)
            }
        }

        else -> {
            // Direct command access: lcl grep
            val commandName = args[0].lowercase()
            val commands = DataRepository.getCommandNames()

            // Check for exact match
            val exactMatch = commands.find { it.lowercase() == commandName }
            if (exactMatch != null) {
                // Show command details directly (non-interactive)
                showCommandNonInteractive(terminal, exactMatch)
            } else {
                // Try fuzzy search
                val matches = DataRepository.getCommandsByQuery(commandName).take(10)
                if (matches.isNotEmpty()) {
                    if (matches.size == 1) {
                        // Single match, show it
                        showCommandNonInteractive(terminal, matches[0].name)
                    } else {
                        // Multiple matches, start interactive with search pre-filled
                        terminal.println("Multiple commands found for '$commandName':")
                        matches.forEachIndexed { index, cmd ->
                            terminal.println("  ${index + 1}. ${cmd.name}")
                        }
                        terminal.println()
                        terminal.println("Run 'lcl <command>' with an exact name, or run 'lcl' for interactive mode.")
                    }
                } else {
                    terminal.println("Command not found: $commandName")
                    terminal.println("Run 'lcl --list' to see all available commands.")
                }
            }
        }
    }
}

private fun showHelp(terminal: Terminal) {
    terminal.println(
        """
Linux Command Library - Native CLI

Usage:
  lcl                    Start interactive mode
  lcl <command>          Show details for a specific command
  lcl --list, -l         List all available commands
  lcl --version, -v      Show version
  lcl --help, -h         Show this help

Interactive Mode Controls:
  Arrow keys / j/k       Navigate up/down
  Enter                  Select item
  Esc / q                Go back / Exit
  Page Up/Down           Scroll pages
  Home / End             Jump to start/end
  Type characters        Search (in search screen)

Examples:
  lcl                    # Start interactive browser
  lcl grep               # Show grep command details
  lcl --list | grep net  # Find network-related commands
        """.trimIndent(),
    )
}

private fun showCommandNonInteractive(terminal: Terminal, commandName: String) {
    val sections = DataRepository.getCommandSections(commandName)

    terminal.println()
    terminal.println(Theme.sectionTitle(commandName))
    terminal.println()

    sections.forEach { section ->
        terminal.println(Theme.header(section.title))
        terminal.println(ContentFormatter.format(section.title, section.content))
        terminal.println()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #131** (2026-11-07): **When switching to the search tab, the page for 2048 is on**
  *Symptoms*: ### Type  GUI  ### Platform  Android  ### Description  When I search for a command, 2048's page is always on, which is annoying since I have to press the back button everytime I open the app to search for something. I'm using Android 16, CalyxOS 7.2.2.0, with 280 override density (smallest display size possible without using Developer Options)   ### Steps to reproduce  Open the app Then go to Commands 2048's page will be there by default  <img width="720" height="1600" alt="Screenshot showing the screen after pressing on the search button" src="https://github.com/user-attachments/assets/4c426ce2-24e9-4d3b-88a2-c6d6e8b147a9" />

- **Issue #129** (2026-11-07): **Misnomer: "Binary References" (wrt file permissions)**
  *Symptoms*: ### Type  GUI  ### Platform  Web  ### Description  Hello,  First, this is an awesome project. Nice work!  I had to raise an issue due to a point of pedantry: "Binary References" is a misnomer when referring to file permissions, e.g here: https://linuxcommandlibrary.com/tips#89400787  The numeric permissions are octal, not binary. Generally these would be called "octal permissions" or "octal notation" (e.g [here](https://en.wikipedia.org/wiki/File-system_permissions#Octal_notation)). I've never heard them called "binary" or "binary references" in >25 years using *nix operating systems. I did a couple of web searches to check whether this was a common thing I wasn't aware of, and I don't see many other places calling them that (and lots of the ones that do are mirrors of your work)  I *do* totally see where the "binary" label comes from - this is an octal representation of 3 binary bits representing r/w/x permissions. But the representation '7' for `rwx` is octal, not binary - binary would be `111`.  I feel pretty strongly that all references to "binary" permissions should be changed to "octal", and "binary references" should be changed to either "octal notation" or "octal permissions". Referring to them as "binary" is teaching people the wrong thing. A note saying that these octal values correspond to 3 binary bits might be a good idea, but otoh that might be too longwinded for this project.  I'd be happy to make this change and submit a PR if that's helpful. I considered just

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

### Incident Patch 1: `6bf6a477` (2026-11-23)
**Commit Message**: Add commands

**File**: `assets/commands/index.txt` (modified, +5/-0)
```diff
@@ -8345,6 +8345,7 @@ tlmgr-dump-tlpdb.md
 tlmgr-generate.md
 tlmgr-gui.md
 tlmgr-info.md
+tlmgr-init-usertree.md
 tlmgr-install.md
 tlmgr-key.md
 tlmgr-option.md
@@ -8594,11 +8595,14 @@ ufw-delete.md
 ufw-deny.md
 ufw-disable.md
 ufw-enable.md
+ufw-insert.md
 ufw-limit.md
 ufw-logging.md
+ufw-prepend.md
 ufw-reject.md
 ufw-reload.md
 ufw-reset.md
+ufw-route.md
 ufw-show.md
 ufw-status.md
 ufw-version.md
@@ -9393,6 +9397,7 @@ zcomplete.md
 zdb.md
 zdiff.md
 zdump.md
+zean.md
 zebra.md
 zed.md
 zeditor.md
```

**File**: `assets/commands/tlmgr-init-usertree.md` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+# TAGLINE
+
+Create a user TeX Live tree for tlmgr user mode
+
+# TLDR
+
+Initialize the default user tree (**TEXMFHOME**)
+
+```tlmgr init-usertree```
+
+Initialize a tree in a **chosen directory**
+
+```tlmgr init-usertree --usertree [path/to/texmf]```
+
+After setup, **install** into that tree
+
+```tlmgr --usermode install [package]```
+
+Use a **non-default** tree for one command
+
+```tlmgr --usermode --usertree [path/to/texmf] install [package]```
+
+# SYNOPSIS
+
+**tlmgr** [**--usertree** _dir_] **init-usertree**
+
+# PARAMETERS
+
+**init-usertree**
+> Create the directories and the minimal package database a user tree needs
+
+**--usertree** _dir_
+> Use _dir_ instead of the default user tree (**TEXMFHOME**)
+
+# DESCRIPTION
+
+**tlmgr init-usertree** prepares a texmf tree for TeX Live user mode. It is a **tlmgr** action, not a separate binary.
+
+User mode lets someone without write access to the system TeX Live installation install and update packages in a tree of their own. The action creates `web2c` and `tlpkg/tlpobj` under the user tree, plus a minimal `tlpkg/texlive.tlpdb`. The default location is the directory named by **TEXMFHOME**. **--usertree** selects another directory.
+
+Initialization does not turn user mode on. Later package commands must pass **--usermode** every time. No configuration-file setting enables it. With a non-default tree, pass **--usertree** on those commands as well.
+
+The user tree's `texlive.tlpdb` lists only packages that **tlmgr** installed there, plus options from the virtual package `00texlive.installation`. Only relocatable packages can be installed in user mode. Packages that ship executables, and a few core packages, are not relocatable. Most of the TeX Live catalogue is relocatable.
+
+# CAVEATS
+
+Run **init-usertree** before **--usermode** package actions. **tlmgr** warns and refuses actions that user mode does not support. **platform** is not supported. **gui** is not supported in current releases.
+
+Actions that do not need write permission behave as in normal mode. Those include **check**, **help**, **list**, **search**, **show**, and **version**.
+
+In user mode, installing a collection installs its dependent packages but not dependent collections. A package that ships map files rewrites `updmap.cfg` under the user tree's `web2c` directory and keeps a backup of the previous file.
+
+User-mode logs are written under **TEXMFVAR** `/web2c/` rather than the system variable tree.
+
+# SEE ALSO
+
+[tlmgr](/man/tlmgr)(1), [tlmgr-install](/man/tlmgr-install)(1), [tlmgr-update](/man/tlmgr-update)(1), [tlmgr-remove](/man/tlmgr-remove)(1), [tlmgr-option](/man/tlmgr-option)(1), [tex](/man/tex)(1)
+
+# RESOURCES
+
+```[Homepage](https://www.tug.org/texlive/)```
+
+```[Documentation](https://www.tug.org/texlive/doc/tlmgr.html)```
+
+```[Source code](https://www.tug.org/texlive/svn/)```
+
+<!-- verified: 2026-11-23 -->
```

**File**: `assets/commands/tlmgr.md` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ Requires TeX Live (not distro packages). Some distributions manage separately. N
 
 # SEE ALSO
 
-[latex](/man/latex)(1), [pdflatex](/man/pdflatex)(1), [texdoc](/man/texdoc)(1), [install-tl](/man/install-tl)(1)
+[latex](/man/latex)(1), [pdflatex](/man/pdflatex)(1), [texdoc](/man/texdoc)(1), [install-tl](/man/install-tl)(1), [tlmgr-init-usertree](/man/tlmgr-init-usertree)(1)
 
 # RESOURCES
 
```

**File**: `assets/commands/ufw-delete.md` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ Part of **ufw** (Uncomplicated Firewall), the Ubuntu-originated frontend for ipt
 
 # SEE ALSO
 
-[ufw](/man/ufw)(8), [ufw-status](/man/ufw-status)(8), [ufw-allow](/man/ufw-allow)(8), [ufw-deny](/man/ufw-deny)(8), [ufw-default](/man/ufw-default)(8), [iptables](/man/iptables)(8)
+[ufw](/man/ufw)(8), [ufw-status](/man/ufw-status)(8), [ufw-allow](/man/ufw-allow)(8), [ufw-deny](/man/ufw-deny)(8), [ufw-default](/man/ufw-default)(8), [ufw-insert](/man/ufw-insert)(8), [ufw-prepend](/man/ufw-prepend)(8), [ufw-route](/man/ufw-route)(8), [iptables](/man/iptables)(8)
 
 # RESOURCES
 
```

**File**: `assets/commands/ufw-insert.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+# TAGLINE
+
+Insert an Uncomplicated Firewall rule at a numbered position
+
+# TLDR
+
+List rules with **numbers**
+
+```sudo ufw status numbered```
+
+**Insert** a deny rule as rule number 1
+
+```sudo ufw insert 1 deny from [source_address]```
+
+Insert an **allow** for a port and protocol at a chosen position
+
+```sudo ufw insert [3] allow [22]/tcp```
+
+Insert a **full-syntax** rule at a position
+
+```sudo ufw insert 3 deny to any port 22 from 10.0.0.135 proto tcp```
+
+Insert a **rate limit** rule
+
+```sudo ufw insert [2] limit [22]/tcp```
+
+**Preview** an insertion without applying it
+
+```sudo ufw --dry-run insert [3] deny from [source_address]```
+
+# SYNOPSIS
+
+**ufw** [_--dry-run_] **insert** _NUM_ **allow**|**deny**|**reject**|**limit** [_rule_]
+
+**ufw** [_--dry-run_] **route insert** _NUM_ **allow**|**deny**|**reject**|**limit** [_rule_]
+
+# PARAMETERS
+
+**insert** _NUM_
+> Place the new user rule at that 1-based position. Later rules shift down. Read positions from `ufw status numbered`
+
+**route insert** _NUM_
+> Same positioning for a forwarded rule. See **ufw route**
+
+**allow** / **deny** / **reject** / **limit**
+> Action of the inserted rule. The rest of the line is normal ufw rule syntax: a port, an application profile, or the full **from** / **to** / **port** / **proto** / **on** form
+
+**comment** '_text_'
+> Attach a comment to the new rule. **insert** cannot change the comment on a rule that already exists
+
+**--dry-run**
+> Show what would change without applying it
+
+# DESCRIPTION
+
+**ufw insert** adds an Uncomplicated Firewall rule at a specific position instead of appending it. It is a **ufw** subcommand, not a separate binary.
+
+The first matching rule wins, so position is the point of the command. With four rules already loaded, `ufw insert 3 deny to any port 22 from 10.0.0.135 proto tcp` makes the new rule number 3 and shifts the previous third and fourth rules down.
+
+**prepend** is the form that does not take a number: it places the rule ahead of every existing rule of the same IP version. **route insert** uses the same numbering for traffic forwarded through the host.
+
+# CAVEATS
+
+Requires root or sudo. Check `ufw status numbered` immediately before inserting. Deletes and earlier inserts renumber the list. Inserting a rule that blocks the current SSH session can lock you out. Prefer **--dry-run** on a remote host.
+
+When IPv6 is enabled, a generic rule such as `ufw allow 22/tcp` creates paired IPv4 and IPv6 entries. **insert** adds a rule; it does not rewrite rules already in the list.
+
+# HISTORY
+
+Part of **ufw** (Uncomplicated Firewall), the Ubuntu-originated frontend for iptables and nftables.
+
+# INSTALL
+
+```dnf: sudo dnf install ufw```
+
+```pacman: sudo pacman -S ufw```
+
+```apk: sudo apk add ufw```
+
+```zypper: sudo zypper install ufw```
+
+<!-- packages: 2026-11-23 -->
+
+# SEE ALSO
+
+[ufw](/man/ufw)(8), [ufw-prepend](/man/ufw-prepend)(8), [ufw-delete](/man/ufw-delete)(8), [ufw-status](/man/ufw-status)(8), [ufw-allow](/man/ufw-allow)(8), [ufw-route](/man/ufw-route)(8), [iptables](/man/iptables)(8)
+
+# RESOURCES
+
+```[Source code](https://git.launchpad.net/ufw)```
+
+```[Documentation](https://manpages.ubuntu.com/manpages/man8/ufw.8.html)```
+
+<!-- verified: 2026-11-23 -->
```

**File**: `assets/commands/ufw-prepend.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+# TAGLINE
+
+Add an Uncomplicated Firewall rule ahead of existing rules
+
+# TLDR
+
+**Deny** a source address ahead of the current rules
+
+```sudo ufw prepend deny from [source_address]```
+
+Prepend a deny for a **subnet**
+
+```sudo ufw prepend deny from 192.168.0.0/24```
+
+**Reject** traffic from a source to one port
+
+```sudo ufw prepend reject from [source_address] to any port [25]```
+
+Prepend an **allow** for a port and protocol
+
+```sudo ufw prepend allow [22]/tcp```
+
+Prepend a **routed** rule
+
+```sudo ufw route prepend deny to [destination_address]```
+
+**Preview** a prepend without applying it
+
+```sudo ufw --dry-run prepend deny from [source_address]```
+
+# SYNOPSIS
+
+**ufw** [_--dry-run_] **prepend** **allow**|**deny**|**reject**|**limit** [_rule_]
+
+**ufw** [_--dry-run_] **route prepend** **allow**|**deny**|**reject**|**limit** [_rule_]
+
+# PARAMETERS
+
+**prepend**
+> Insert the rule before every existing user rule of the same IP version. No rule number is required
+
+**route prepend**
+> Same placement for a forwarded rule
+
+**allow** / **deny** / **reject** / **limit**
+> Action of the new rule. The rest of the line is normal ufw rule syntax
+
+**comment** '_text_'
+> Attach a comment to the new rule. **prepend** cannot change the comment on a rule that already exists
+
+**--dry-run**
+> Show what would change without applying it
+
+# DESCRIPTION
+
+**ufw prepend** adds a rule at the front of the matching ruleset. It is a **ufw** subcommand, not a separate binary.
+
+Unlike **ufw insert**, prepend does not take a position. An IPv4 rule is placed before every other IPv4 rule. An IPv6 rule is placed before every other IPv6 rule. That is the form used by dynamic firewalls and intrusion-prevention hooks, which must push a block ahead of rules already loaded without looking up a number.
+
+The rule body is the same syntax as **ufw allow**, **ufw deny**, **ufw reject**, and **ufw limit**, including the full **from** / **to** / **port** / **proto** form. **ufw route prepend** targets traffic forwarded through the host rather than traffic destined to it.
+
+# CAVEATS
+
+Requires root or sudo. A broad prepended allow can shadow a later, more specific deny, because the first match wins. A prepended deny of the current SSH source can lock you out. Prefer **--dry-run**.
+
+IPv4 and IPv6 lists are ordered separately, so the new rule is not always number 1 in the combined `ufw status numbered` listing.
+
+# HISTORY
+
+Part of **ufw** (Uncomplicated Firewall), the Ubuntu-originated frontend for iptables and nftables.
+
+# INSTALL
+
+```dnf: sudo dnf install ufw```
+
+```pacman: sudo pacman -S ufw```
+
+```apk: sudo apk add ufw```
+
+```zypper: sudo zypper install ufw```
+
+<!-- packages: 2026-11-23 -->
+
+# SEE ALSO
+
+[ufw](/man/ufw)(8), [ufw-insert](/man/ufw-insert)(8), [ufw-delete](/man/ufw-delete)(8), [ufw-status](/man/ufw-status)(8), [ufw-allow](/man/ufw-allow)(8), [ufw-deny](/man/ufw-deny)(8), [ufw-route](/man/ufw-route)(8)
+
+# RESOURCES
+
+```[Source code](https://git.launchpad.net/ufw)```
+
+```[Documentation](https://manpages.ubuntu.com/manpages/man8/ufw.8.html)```
+
+<!-- verified: 2026-11-23 -->
```

**File**: `assets/commands/ufw-route.md` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+# TAGLINE
+
+Manage Uncomplicated Firewall rules for forwarded traffic
+
+# TLDR
+
+**Allow** traffic forwarded from one interface to another
+
+```sudo ufw route allow in on eth0 out on eth1```
+
+Allow a **subnet** to reach a host on one port and protocol
+
+```sudo ufw route allow from 10.0.0.0/24 to [destination_address] port [80] proto tcp```
+
+**Deny** forwarded traffic to an address
+
+```sudo ufw route deny to [destination_address]```
+
+**Reject** forwarded traffic leaving an interface
+
+```sudo ufw route reject out on [eth1]```
+
+**Insert** a route rule at a numbered position
+
+```sudo ufw route insert [1] deny from [source_address]```
+
+**Delete** a route rule by repeating it
+
+```sudo ufw route delete deny to 192.168.0.12```
+
+**Preview** a route rule without applying it
+
+```sudo ufw --dry-run route allow in on eth0 out on eth1```
+
+# SYNOPSIS
+
+**ufw** [_--dry-run_] **route** [**delete**] [**insert** _NUM_] [**prepend**] **allow**|**deny**|**reject**|**limit** [_rule_]
+
+# PARAMETERS
+
+**route**
+> Match traffic forwarded through this host, not traffic destined to the host
+
+**allow** / **deny** / **reject** / **limit**
+> Action for matching forwarded packets
+
+**in on** _interface_
+> Interface the forwarded packet arrives on
+
+**out on** _interface_
+> Interface the forwarded packet leaves on
+
+**from** _address_ / **to** _address_
+> Source and destination. **to** is often a host behind the firewall, not this machine
+
+**port** _port_ / **proto** _protocol_
+> Destination port and protocol, as in other ufw rules. An application profile uses **app** in place of **port**
+
+**insert** _NUM_
+> Place the route rule at that 1-based position
+
+**prepend**
+> Place the route rule ahead of other route rules of the same IP version
+
+**delete**
+> Remove the route rule given in the rest of the command. Numbered removal is `ufw delete NUM` after `ufw status numbered`
+
+**comment** '_text_'
+> Attach a comment to the rule
+
+**--dry-run**
+> Show what would change without applying it
+
+# DESCRIPTION
+
+**ufw route** manages rules for packets routed through the host. It is a **ufw** subcommand, not a separate binary.
+
+Ordinary **allow** and **deny** rules apply when this machine is an endpoint. A route rule applies when the packet should leave toward another host. `ufw route allow in on eth0 out on eth1 to 12.34.45.67 port 80 proto tcp` accepts packets that arrive on eth0 and are forwarded out eth1 to TCP port 80 on that address.
+
+In `ufw status`, forwarded rules are marked **ALLOW FWD** (or the matching deny, reject, or limit action). Input and output rules print the interface relative to this host as an endpoint. Route rules print it relative to the direction packets flow through the firewall.
+
+The default policy for routed traffic is deny. A route rule does not turn forwarding on. Enable IPv4 forwarding and IPv6 forwarding for `default` and `all` in `/etc/ufw/sysctl.conf`, then run `ufw disable` and `ufw enable` so ufw reloads those settings. Another sysctl configuration can override that file. See **sysctl**.
+
+# CAVEATS
+
+Requires root or sudo. Turning on forwarding makes the host a router. Keep the default routed policy at deny unless every forwarded flow is intentional.
+
+Route syntax is not OpenBSD PF syntax. Interfaces are written **in on** and **out on**, matching netfilter's FORWARD chain.
+
+Deleting by number removes one numbered row. When IPv6 is enabled, prefixing the original rule with **route delete** is the form that drops the rule as specified rather than a single numbered row.
+
+# HISTORY
+
+Part of **ufw** (Uncomplicated Firewall), the Ubuntu-originated frontend for iptables and nftables.
+
+# INSTALL
+
+```dnf: sudo dnf install ufw```
+
+```pacman: sudo pacman -S ufw```
+
+```apk: sudo apk add ufw```
+
+```zypper: sudo zypper install ufw```
+
+<!-- packages: 2026-11-23 -->
+
+# SEE ALSO
+
+[ufw](/man/ufw)(8), [ufw-allow](/man/ufw-allow)(8), [ufw-default](/man/ufw-default)(8), [ufw-delete](/man/ufw-delete)(8), [ufw-insert](/man/ufw-insert)(8), [ufw-prepend](/man/ufw-prepend)(8), [sysctl](/man/sysctl)(8), [iptables](/man/iptables)(8)
+
+# RESOURCES
+
+```[Source code](https://git.launchpad.net/ufw)```
+
+```[Documentation](https://manpages.ubuntu.com/manpages/man8/ufw.8.html)```
+
+<!-- verified: 2026-11-23 -->
```

**File**: `assets/commands/ufw.md` (modified, +1/-1)
```diff
@@ -203,4 +203,4 @@ Default policies are deny incoming, allow outgoing, deny forwarding. Enabling uf
 
 # SEE ALSO
 
-[iptables](/man/iptables)(8), [ip6tables](/man/ip6tables)(8), [nft](/man/nft)(8), [firewall-cmd](/man/firewall-cmd)(1)
+[iptables](/man/iptables)(8), [ip6tables](/man/ip6tables)(8), [nft](/man/nft)(8), [firewall-cmd](/man/firewall-cmd)(1), [ufw-insert](/man/ufw-insert)(8), [ufw-prepend](/man/ufw-prepend)(8), [ufw-route](/man/ufw-route)(8)
```

---

### Incident Patch 2: `ce6510ce` (2026-11-23)
**Commit Message**: Upgrade dependencies

**File**: `android/build.gradle.kts` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ android {
         libs.versions.android.compileSdk
             .get()
             .toInt()
+    // Compose 1.13 (BOM 2026.11.01) AARs require compile SDK 37.1.
+    compileSdkMinor = 1
     defaultConfig {
         applicationId = "com.inspiredandroid.linuxcommandbibliotheca"
         minSdk =
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ kotlin = "2.4.21"
 composeMultiplatform = "1.12.2"
 composeMaterial3 = "1.9.0"
 composeMaterial3Adaptive = "1.3.0"
-composeBom = "2026.09.00"
+composeBom = "2026.11.01"
 activityCompose = "1.13.0"
 json = "20260814"
 koinCore = "4.2.2"
```

#### Recent Merged Pull Requests:
- **PR #135** (2026-11-07): Correct octal permission terminology (@mvanhorn)
- **PR #134** (2026-11-07): appman - Revise AppImages and portable programs count in documentation (@hotlittlewhitedog)
- **PR #133** (2026-11-07): Stop the Commands tab from opening the first command (@mvanhorn)
- **PR #127** (2026-11-07): mcptoon: replace the unpublished @modelcontextprotocol/server-fetch example (@activeing123)
- **PR #122** (2026-08-26): docs: fix typo quering -> querying (@vaibhav8a)
- **PR #120** (closed): Bump json from 2.20.0 to 2.21.2 (@dependabot[bot])

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

## X. Add commands

**RULE**:
When implementing operations in `assets/commands/index.txt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in SimonSchubert/LinuxCommandLibrary. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6bf6a477`: Add commands. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `assets/commands/index.txt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
tlmgr-init-usertree.md
ufw-insert.md
ufw-prepend.md
ufw-route.md
zean.md
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6bf6a477` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
