# Forensic Learning Record (Deep Inspection): SimonSchubert/LinuxCommandLibrary

> **Canonical Artifact**: `07_PROJECT_LEARNING/simonschubert-linuxcommandlibrary-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SimonSchubert/LinuxCommandLibrary](https://github.com/SimonSchubert/LinuxCommandLibrary))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:10:41.460Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SimonSchubert/LinuxCommandLibrary`
- **Description**: 2M+ app downloads, 500k+ monthly website visitors, Linux basics, tips and formatted man pages
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2048 stars

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
            stack.removeAt(stack.lastIndex)
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
    val listDetailDirective = calculatePaneScaffoldDirective(adaptiveInfo).copy(
        defaultPanePreferredWidth = 320.dp,
        horizontalPartitionSpacerSize = 8.dp,
    )

    // Initialize navigators with the deep-linked detail pane up-front so we don't flash the
    // list pane for one frame before navigating; this also makes the first composition
    // render the final UI, which screenshot tooling depends on.
    val initialCommandName = (deeplinkResult.selection as? InitialSelection.Command)?.name
    val initialBasicId = (deeplinkResult.selection as? InitialSelection.Basics)?.id
    val commandsNavigator = rememberListDetailPaneScaffoldNavigator(
        scaffoldDirective = listDetailDirective,
        initialDestinationHistory = if (initialCommandName != null) {
            listOf(
                ThreePaneScaffoldDestinationItem(ListDetailPaneScaffoldRole.List, null),
                ThreePaneScaffoldDestinationItem(ListDetailPaneScaffoldRole.Detail, initialCommandName),
            )
        } else {
            listOf(ThreePaneScaffoldDestinationItem(ListDetailPaneScaffoldRole.List, null))
        },
    )
    val basicsNavigator = rememberListDetailPaneScaffoldNavigator(
        scaffoldDirective = listDetailDirective,
        initialDestinationHistory = if (initialBasicId != null) {
            listOf(
                ThreePaneScaffoldDestinationItem(ListDetailPaneScaffoldRole.List, null),
                ThreePaneScaffoldDestinationItem(ListDetailPaneScaffoldRole.Detail, initialBasicId),
            )
        } else {
            listOf(ThreePaneScaffoldDestinationItem(ListDetailPaneScaffoldRole.List, null))
        },
    )

    val pendingCommand = rememberSaveable { mutableStateOf<String?>(null) }
    val pendingBasic = rememberSaveable { mutableStateOf<String?>(null) }
    val pendingExpand = rememberSaveable { mutableStateOf<Long?>(null) }
  
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
    fun hide() {
        isVisibleState.value = false
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

/**
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

### Core Architecture Module: `cli/src/commonMain/kotlin/com/linuxcommandlibrary/nativecli/Theme.kt`
```
package com.linuxcommandlibrary.nativecli

import com.github.ajalt.mordant.rendering.TextColors.*
import com.github.ajalt.mordant.rendering.TextStyles
import com.github.ajalt.mordant.rendering.TextStyles.*

/**
 * Central theme definitions for the CLI UI.
 * Uses red/coral tones as the primary accent color.
 */
object Theme {
    // Colors
    private val primary = brightRed
    private val secondary = red
    private val success = green
    private val linkColor = brightBlue

    // Combined styles
    private val titleStyle = bold + secondary
    private val selectedStyle = bold + primary
    private val codeStyle = success
    private val headerStyle = bold + secondary

    // Text formatting functions
    fun title(text: String): String = titleStyle(text)
    fun selected(text: String): String = selectedStyle(text)
    fun help(text: String): String = com.github.ajalt.mordant.rendering.TextStyles.dim(text)
    fun code(text: String): String = codeStyle(text)
    fun header(text: String): String = headerStyle(text)
    fun highlight(text: String): String = primary(text)
    fun dim(text: String): String = com.github.ajalt.mordant.rendering.TextStyles.dim(text)
    fun boldText(text: String): String = bold(text)
    fun italicText(text: String): String = italic(text)

    // Clickable OSC 8 hyperlink. Supporting terminals (iTerm2, kitty, WezTerm,
    // GNOME Terminal, Windows Terminal, ...) open [url] when [text] is clicked.
    // The link is colored (not underlined) for the affordance: some terminals
    // (e.g. the JetBrains/Android Studio console) don't honor the underline-off
    // code and would leak the style across the rest of the screen.
    fun link(url: String, text: String): String = (linkColor + TextStyles.hyperlink(url))(text)

    // Colored text used as an in-app link affordance (no URL). The TUI tracks these
    // regions and navigates on click instead of opening a browser.
    fun linkText(text: String): String = linkColor(text)

    // Logo styling - gradient from bright to regular red
    fun logoLine(line: String, lineIndex: Int): String = when {
        lineIndex < 3 -> brightRed(line)
        lineIndex < 6 -> red(line)
        else -> red(line)
    }

    // Decorative borders for section titles
    fun sectionTitle(text: String): String {
        val decorator = "═"
        val padding = 3
        val decoratorLength = padding
        return "${secondary(decorator.repeat(decoratorLength))} ${title(text)} ${secondary(decorator.repeat(decoratorLength))}"
    }
}

```

### Core Architecture Module: `cli/src/commonMain/kotlin/com/linuxcommandlibrary/nativecli/TuiApp.kt`
```
package com.linuxcommandlibrary.nativecli

import com.github.ajalt.mordant.input.KeyboardEvent
import com.github.ajalt.mordant.input.MouseEvent
import com.github.ajalt.mordant.input.MouseTracking
import com.github.ajalt.mordant.input.enterRawModeOrNull
import com.github.ajalt.mordant.input.isCtrlC
import com.github.ajalt.mordant.terminal.Terminal
import com.linuxcommandlibrary.nativecli.screens.MainMenuScreen
import com.linuxcommandlibrary.nativecli.screens.Screen
import com.linuxcommandlibrary.nativecli.screens.ScreenResult

class TuiApp(private val terminal: Terminal) {

    private val screenStack = mutableListOf<Screen>()
    private var running = true
    private var rawModeSupported = true

    fun run(initialScreen: Screen = MainMenuScreen()) {
        screenStack.add(initialScreen)

        // Try to detect raw mode support
        rawModeSupported = detectRawModeSupport()

        while (running && screenStack.isNotEmpty()) {
            val currentScreen = screenStack.last()

            // Clear screen and render
            clearScreen()
            print(currentScreen.render())

            // Handle input
            val result = if (rawModeSupported) {
                handleRawModeInput(currentScreen)
            } else {
                handleFallbackInput(currentScreen)
            }

            processResult(result)
        }
    }

    private fun detectRawModeSupport(): Boolean = try {
        val os = getPlatformName()
        os != "Windows"
    } catch (e: Exception) {
        false
    }

    private fun handleRawModeInput(screen: Screen): ScreenResult {
        return try {
            val rawMode = terminal.enterRawModeOrNull(MouseTracking.Normal)
            if (rawMode == null) {
                rawModeSupported = false
                return handleFallbackInput(screen)
            }
            rawMode.use { scope ->
                when (val event = scope.readEvent()) {
                    is KeyboardEvent -> if (event.isCtrlC) ScreenResult.Exit else screen.handleInput(event)
                    is MouseEvent -> screen.handleMouse(event)
                }
            }
        } catch (e: Exception) {
            rawModeSupported = false
            handleFallbackInput(screen)
        }
    }

    private fun handleFallbackInput(screen: Screen): ScreenResult {
        print("\n> ")
        val input = readlnOrNull() ?: return ScreenResult.Exit
        return screen.handleFallbackInput(input)
    }

    private fun processResult(result: ScreenResult) {
        when (result) {
            is ScreenResult.Stay -> {
                // Do nothing, re-render current screen
            }

            is ScreenResult.Back -> {
                if (screenStack.size > 1) {
                    screenStack.removeLast()
                } else {
                    running = false
                }
            }

            is ScreenResult.Exit -> {
                running = false
            }

            is ScreenResult.Navigate -> {
                screenStack.add(result.screen)
            }
        }
    }

    private fun clearScreen() {
        print("[2J[H")
    }
}

internal expect fun getPlatformName(): String

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #104** (2026-04-28): **Upgrading to 3.7.8 destroyed all bookmarks**
  *Symptoms*: ### Type  GUI  ### Platform  Android  ### Description  Upgrading to 3.7.8 destroyed all bookmarks  (i probably had about 40)   ### Steps to reproduce  Bookmark 40 commands, then upgrade to 3.7.8
  **Post-Mortem & Fix Analysis**:
  > Apologies, I will look into this and hope I will be able to restore you bookmarks  It's something I usually keep an eye. I dont know how this could have happened yet
  > ✅ next release will have a migration and your bookmarks should get restored and merged with your new ones(if you have any) https://github.com/SimonSchubert/LinuxCommandLibrary/commit/f24b87753fdaddf375fc0ae2bd4c92ab3c702233
  > Great.  thank you!

- **Issue #96** (2026-03-23): **Terminal games/pipes/nbpipes | Empty page**
  *Symptoms*: ### Type  GUI  ### Platform  Android  ### Description  App version: 3.7.0 Android version: 15  At least since the version above, the page for Terminal games/pipes/nbpipes is empty.  It might be a misplacement since the actual program seems to serve a different purpose than being a game as described on the website :  https://linuxcommandlibrary.com/man/nbpipes  As a side note I thank all the devs for the awesome work done on this app.  ### Steps to reproduce  Open the app and navigate to Terminal games/pipes/nbpipes
  **Post-Mortem & Fix Analysis**:
  > Looking into this thanks for the report  Reproduceable: <img width="1080" height="2220" alt="Image" src="https://github.com/user-attachments/assets/f251c43b-1f39-4bc2-bcd1-76cd878cd4b4" />
  > Fixed ✅ + terminal game previews  will go live with the release later today  <img width="1080" height="2220" alt="Image" src="https://github.com/user-attachments/assets/ab4052bb-6577-4599-b792-6fd9bfef3ef2" /> <img width="1080" height="2220" alt="Image" src="https://github.com/user-attachments/assets/addc9495-54d5-4402-b9a8-ab1fff638643" />

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

### Incident Patch 1: `2b957e84` (2026-09-26)
**Commit Message**: Auto-fix: lintFix and refresh Paparazzi screenshots [skip ci]



---

### Incident Patch 2: `ee6583ec` (2026-09-24)
**Commit Message**: Auto-fix: lintFix and refresh Paparazzi screenshots [skip ci]



---

### Incident Patch 3: `3361b435` (2026-09-18)
**Commit Message**: Auto-fix: lintFix and refresh Paparazzi screenshots [skip ci]

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [versions]
-agp = "9.4.0"
+agp = "9.4.1"
 appVersion = "4.8.0"
 androidVersionCode = "173"
 android-compileSdk = "37"
```

---

### Incident Patch 4: `3716c75a` (2026-09-16)
**Commit Message**: Fix CI: skip removed Android SDK tools package in setup-android

**File**: `.github/workflows/android.yml` (modified, +6/-2)
```diff
@@ -23,7 +23,9 @@ jobs:
       - name: Set execution flag for gradlew
         run: chmod +x gradlew
       - name: Setup Android SDK
-        uses: android-actions/setup-android@v3
+        uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
       - name: Install Android Build Tools
         run: sdkmanager "build-tools;29.0.3"
       - name: Run unit tests
@@ -485,7 +487,9 @@ jobs:
       - name: Set execution flag for gradlew
         run: chmod +x gradlew
       - name: Setup Android SDK
-        uses: android-actions/setup-android@v3
+        uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
       - name: Decode keystore
         run: echo "${{ secrets.KEYSTORE_B64 }}" | base64 --decode > /tmp/keystore.jks
       - name: Decode service account key
```

**File**: `.github/workflows/screenshots.yml` (modified, +3/-1)
```diff
@@ -20,7 +20,9 @@ jobs:
         with:
           java-version: '21'
           distribution: 'temurin'
-      - uses: android-actions/setup-android@v3
+      - uses: android-actions/setup-android@v4
+        with:
+          packages: platform-tools
       - uses: gradle/actions/setup-gradle@v4
       # leftover lint errors (not auto-fixable) must not skip screenshot updates
       - run: ./gradlew :composeApp:lintFix :android:lintFix
```

#### Recent Merged Pull Requests:
- **PR #122** (2026-08-26): docs: fix typo quering -> querying (@vaibhav8a)
- **PR #120** (closed): Bump json from 2.20.0 to 2.21.2 (@dependabot[bot])
- **PR #112** (closed): Bump faraday from 1.10.5 to 1.10.6 (@dependabot[bot])
- **PR #103** (2026-04-28): TMUX: More ctrl + b prefix keys, separated by command type (@Hawkhobo)
- **PR #102** (2026-04-23): refined 2 `find` commands at the one-liners (@DJCrashdummy)
- **PR #93** (2026-02-11): Complete vim keys in CLI (@jneidel)
- **PR #92** (2026-02-11): Expand on tips (@jneidel)
- **PR #91** (2026-02-05): Fix deeplink test and update dependencies (@Rikul)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
