# Forensic Learning Record (Deep Inspection): amir1376/ab-download-manager

> **Canonical Artifact**: `07_PROJECT_LEARNING/amir1376-ab-download-manager-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/amir1376/ab-download-manager](https://github.com/amir1376/ab-download-manager))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:37:16.706Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `amir1376/ab-download-manager`
- **Description**: A Download Manager that speeds up your downloads
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 18269 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/add/shared/SelectQueue.kt`
```
package com.abdownloadmanager.android.pages.add.shared

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.abdownloadmanager.android.ui.SheetHeader
import com.abdownloadmanager.android.ui.SheetTitle
import com.abdownloadmanager.android.ui.SheetUI
import com.abdownloadmanager.resources.Res
import com.abdownloadmanager.shared.pages.adddownload.addToQueue.SelectQueueComponent
import com.abdownloadmanager.shared.ui.widget.*
import com.abdownloadmanager.shared.util.OnFullyDismissed
import com.abdownloadmanager.shared.util.ResponsiveDialog
import com.abdownloadmanager.shared.util.div
import com.abdownloadmanager.shared.util.rememberResponsiveDialogState
import com.abdownloadmanager.shared.util.ui.VerticalScrollableContent
import com.abdownloadmanager.shared.util.ui.WithContentColor
import com.abdownloadmanager.shared.util.ui.icon.MyIcons
import com.abdownloadmanager.shared.util.ui.myColors
import com.abdownloadmanager.shared.util.ui.theme.mySpacings
import com.abdownloadmanager.shared.util.ui.theme.myTextSizes
import ir.amirab.downloader.queue.DownloadQueue
import ir.amirab.util.compose.asStringSource
import ir.amirab.util.compose.resources.myStringResource
import ir.amirab.util.ifThen

@Composable
fun ShowAddToQueueDialog(
    queueComponent: SelectQueueComponent,
    onRequestAddNewQueue: () -> Unit,
) {
    ShowAddToQueueDialog(
        queueList = queueComponent.queueList.collectAsState().value,
        selectedQueue = queueComponent.selectedQueue.collectAsState().value,
        onQueueSelected = queueComponent::setSelectedQueue,
        startQueue = queueComponent.startQueue.collectAsState().value,
        setStartQueue = queueComponent::setStartQueue,
        rememberThisChoice = queueComponent.rememberThisChoice.collectAsState().value,
        setRememberThisChoice = queueComponent::setRememberThisChoice,
        onClose = queueComponent::closeAddToQueue,
        onConfirm = queueComponent::onConfirm,
        isOpened = queueComponent.shouldShowAddToQueue,
        newQueueAction = onRequestAddNewQueue
    )
}

@Composable
private fun ShowAddToQueueDialog(
    queueList: List<DownloadQueue>,
    selectedQueue: Long?,
    onQueueSelected: (Long?) -> Unit,
    startQueue: Boolean,
    setStartQueue: (Boolean) -> Unit,
    newQueueAction: () -> Unit,
    rememberThisChoice: Boolean,
    setRememberThisChoice: (Boolean) -> Unit,
    onClose: () -> Unit,
    onConfirm: () -> Unit,
    isOpened: Boolean,
) {
    val withoutQueueSelected = selectedQueue == null
    val state = rememberResponsiveDialogState(false)
    LaunchedEffect(isOpened) {
        if (isOpened) {
            state.show()
        } else {
            state.hide()
        }
    }
    state.OnFullyDismissed {
        onClose()
    }
    ResponsiveDialog(
        onDismiss = state::hide,
        state = state,
    ) {
        SheetUI(
            header = {
                SheetHeader(
                    headerTitle = {
                        SheetTitle(
                            myStringResource(Res.string.select_queue)
                        )
                    },
                    headerActions = {
                        TransparentIconActionButton(
                            icon = MyIcons.close,
                            contentDescription = Res.string.close.asStringSource(),
                            onClick = onClose
                        )
                    }
                )
            }
        ) {
            WithContentColor(myColors.onBackground) {
                Column(
                    Modifier.fillMaxWidth()
                ) {
                    Column(
                        Modifier
                    ) {
                        val addToQueueModifier = Modifier.fillMaxWidth()
                        val scrollState = rememberScrollState()
                        VerticalScrollableContent(
                            scrollState,
                            Modifier
                                .padding(1.dp),
                        ) {
                            Column(
                                modifier = Modifier
                                    .verticalScroll(scrollState)
                            ) {
                                QueueItemToSelect(
                                    modifier = addToQueueModifier,
                                    name = myStringResource(Res.string.without_queue),
                                    onSelect = {
                                        onQueueSelected(null)
                                    },
                                    isSelected = selectedQueue == null,
                                )
                                for (q in queueList) {
                                    key(q.id) {
                                        val queueModel by q.queueModel.collectAsState()
                                        QueueItemToSelect(
                                            modifier = addToQueueModifier,
                                            name = queueModel.name,
                                            onSelect = {
                                                onQueueSelected(queueModel.id)
                                            },
                                            isSelected = selectedQueue == queueModel.id,
                                        )
                                    }
                                }
                            }
                        }
                        Divider()
                        Column(
                            Modifier
                                .padding(horizontal = 8.dp)
                        ) {
                            FlowRow(
                                modifier = Modifier.fillMaxWidth(),
                                itemVerticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                LabeledCheckbox(
                                    modifier = Modifier,
                                    value = startQueue,
                                    onValueChange = setStartQueue,
                                    enabled = !withoutQueueSelected,
                                    description = myStringResource(Res.string.start_queue),
                                )
                                LabeledCheckbox(
                                    modifier = Modifier,
                                    value = rememberThisChoice,
                                    onValueChange = setRememberThisChoice,
                                    description = myStringResource(Res.string.remember_this),
                                )
                            }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                IconActionButton(
                                    icon = MyIcons.add,
                                    contentDescription = Res.string.add_new_queue.asStringSource(),
                                    onClick = newQueueAction
                                )
                                Spacer(Modifier.width(4.dp))
                                PrimaryMainActionButton(
                                    text = myStringResource(Res.string.ok),
                                    modifier = Modifier.weight(1f),
                                    onClick = onConfirm
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun QueueItemToSelect(
    modifier: Modifier,
    name: String,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    Row(
        modifier
            .ifThen(isSelected) {
                background(myColors.selectionGradient())
            }
            .clickable(onClick = onSelect)
            .heightIn(mySpacings.thumbSize)
            .padding(vertical = 4.dp)
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(
            isSelected,
            onValueChange = {
                if (it) {
                    onSelect()
                }
            },
        )
        Spacer(Modifier.width(mySpacings.mediumSpace))
        Text(
            name,
            fontSize = myTextSizes.base,
        )
    }
}

@Composable
private fun Divider() {
    Spacer(
        Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(myColors.onBackground / 10),
    )
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/browser/SearchEngines.kt`
```
package com.abdownloadmanager.android.pages.browser

import java.net.URLEncoder
import java.nio.charset.StandardCharsets

sealed class SearchEngines(
    val baseUrl: String,
    val query: String,
    val home: String = baseUrl,
) {
    fun createSearchUrl(textToSearch: String): String {
        return buildSearchUrl(baseUrl, query, textToSearch)
    }

    data object DuckDuckGo : SearchEngines(
        baseUrl = "https://duckduckgo.com/",
        query = "q",
    )

    data object Google : SearchEngines(
        baseUrl = "https://www.google.com/search",
        query = "q",
        home = "https://www.google.com",
    )

    data object Bing : SearchEngines(
        baseUrl = "https://www.bing.com/search",
        query = "q",
    )

    data object Brave : SearchEngines(
        baseUrl = "https://search.brave.com/search",
        query = "q",
        home = "https://search.brave.com",
    )

    companion object {
        private fun buildSearchUrl(
            baseUrl: String,
            queryParam: String,
            query: String
        ): String {
            val encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8.toString())
            return "$baseUrl?$queryParam=$encodedQuery"
        }
    }
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/home/HomePageStateToPersist.kt`
```
package com.abdownloadmanager.android.pages.home

import arrow.optics.optics
import com.abdownloadmanager.android.pages.home.sections.sort.DownloadSortBy
import com.abdownloadmanager.shared.ui.widget.sort.Sort
import kotlinx.serialization.Serializable

@optics
@Serializable
data class HomePageStateToPersist(
    val sortBy: Sort<DownloadSortBy> = Sort<DownloadSortBy>(DownloadSortBy.DataAdded, Sort.DEFAULT_IS_DESCENDING)
) {
    companion object {}
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/home/RenderAddMenu.kt`
```
package com.abdownloadmanager.android.pages.home

import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.abdownloadmanager.android.ui.menu.RenderMenuInSinglePage
import com.abdownloadmanager.shared.ui.widget.rememberMyComponentRectPositionProvider

@Composable
fun RenderAddMenu(component: HomeComponent) {
    val mainMenuShowing by component.isAddMenuShowing.collectAsState()
    if (mainMenuShowing) {
        val onDismissRequest = {
            component.setIsAddMenuShowing(false)
        }
        Popup(
            popupPositionProvider = rememberMyComponentRectPositionProvider(
                anchor = Alignment.TopEnd,
                alignment = Alignment.TopStart,
                offset = DpOffset(x = 0.dp, y = (-8).dp)
            ),
            onDismissRequest = onDismissRequest,
            properties = PopupProperties(
                focusable = true,
            )
        ) {
            RenderMenuInSinglePage(
                menu = component.addMenu,
                onDismissRequest = onDismissRequest,
                modifier = Modifier.width(IntrinsicSize.Max),
            )
        }
    }
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/home/RenderDownloadItem.kt`
```
package com.abdownloadmanager.android.pages.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.BlurredEdgeTreatment.Companion.Unbounded
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.abdownloadmanager.shared.singledownloadpage.createStatusStringWithReason
import com.abdownloadmanager.shared.ui.widget.CheckBox
import com.abdownloadmanager.shared.ui.widget.Text
import com.abdownloadmanager.shared.util.*
import com.abdownloadmanager.shared.util.downloaderror.DownloadErrorReason
import com.abdownloadmanager.shared.util.ui.*
import com.abdownloadmanager.shared.util.ui.icon.MyIcons
import com.abdownloadmanager.shared.util.ui.theme.myShapes
import com.abdownloadmanager.shared.util.ui.theme.myTextSizes
import com.abdownloadmanager.shared.util.ui.widget.MyIcon
import ir.amirab.downloader.downloaditem.DownloadJobStatus
import ir.amirab.downloader.monitor.CompletedDownloadItemState
import ir.amirab.downloader.monitor.IDownloadItemState
import ir.amirab.downloader.monitor.ProcessingDownloadItemState
import ir.amirab.downloader.monitor.statusOrFinished
import ir.amirab.downloader.utils.ExceptionUtils
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.datetime.TimeZone
import kotlinx.datetime.format
import kotlinx.datetime.periodUntil
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Clock
import kotlin.time.Duration.Companion.seconds
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

private const val PROGRESS_HEIGHT = 6

@Composable
fun RenderDownloadItem(
    checked: Boolean?,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    downloadItem: IDownloadItemState,
    errorReason: DownloadErrorReason?,
    fileIconProvider: FileIconProvider,
    modifier: Modifier,
) {
    Row(
        modifier
    ) {
        WithContentColor(
            myColors.onSurface,
        ) {
            Column(
                Modifier
                    .weight(1f)
                    .let {
                        if (checked == true) {
                            val selectionColor = myColors.onBackground
                            it.background(myColors.selectionGradient(0.15f, 0.03f, selectionColor))
                        } else {
                            it.border(1.dp, Color.Transparent)
                        }
                    }
                    .combinedClickable(
                        onClick = onClick,
                        onLongClick = onLongClick,
                    )
                    .padding(16.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    AnimatedVisibility(
                        checked != null
                    ) {
                        Row {
                            val isChecked = checked ?: false
                            CheckBox(
                                value = isChecked,
                                onValueChange = { onLongClick() },
                                size = 18.dp,
                            )
                            Spacer(Modifier.width(8.dp))
                        }
                    }
                    RenderFileIcon(
                        downloadItem = downloadItem,
                        fileIconProvider = fileIconProvider,
                    )
                    Spacer(Modifier.width(8.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            downloadItem.name,
                            maxLines = 1,
                        )
                        Spacer(Modifier.height(8.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RenderProgressBar(
                                downloadItem, Modifier
                                    .weight(1f)
                                    .height(PROGRESS_HEIGHT.dp)
                            )
                            if (downloadItem is ProcessingDownloadItemState) {
                                Spacer(Modifier.width(2.dp))
                                RenderProgressLight(downloadItem)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                RenderSubTexts(downloadItem, errorReason)
            }
        }
    }
}

@Composable
fun RenderProgressLight(itemState: IDownloadItemState) {
    val color = when (val status = itemState.statusOrFinished()) {
        is DownloadJobStatus.IsActive -> {
            myColors.primaryGradient
        }

        is DownloadJobStatus.CanBeResumed -> {
            if (status is DownloadJobStatus.Canceled && !ExceptionUtils.isNormalCancellation(status.e)) {
                myColors.errorGradient
            } else {
                myColors.warningGradient
            }
        }

        DownloadJobStatus.Finished -> {
            myColors.successGradient
        }
    }
    Box(
        modifier = Modifier
            .size((PROGRESS_HEIGHT).dp)
            .background(color, CircleShape),
    )
}

@Composable
fun RenderSubTexts(itemState: IDownloadItemState, errorReason: DownloadErrorReason?) {
    CompositionLocalProvider(
        LocalTextStyle provides LocalTextStyle.current.copy(fontSize = myTextSizes.xs),
        LocalContentAlpha provides 0.8f
    ) {
        Box(
            Modifier.fillMaxWidth()
        ) {
            RenderLeftSubText(itemState, Modifier.align(Alignment.CenterStart))
            RenderCenterSubText(itemState, errorReason, Modifier.align(Alignment.Center))
            RenderRightSubText(itemState, Modifier.align(Alignment.CenterEnd))
        }
    }
}

@Composable
private fun RenderEta(itemState: ProcessingDownloadItemState, modifier: Modifier) {
    val eta = remember(itemState.remainingTime) {
        itemState.remainingTime?.let {
            convertTimeRemainingToHumanReadable(
                it,
                TimeNames.ShortNames
            )
        }.orEmpty()
    }
    Text(eta, modifier)
}

@OptIn(ExperimentalTime::class)
@Composable
private fun RenderAddedTime(itemState: IDownloadItemState, modifier: Modifier) {
    var dateAddedString by remember { mutableStateOf("") }
    val useRelativeDateTime = LocalUseRelativeDateTime.current

    LaunchedEffect(
        itemState.dateAdded,
        useRelativeDateTime,
    ) {
        val instant = Instant.fromEpochMilliseconds(itemState.dateAdded)
        if (useRelativeDateTime) {
            while (isActive) {
                val now = Clock.System.now()
                val period = now.periodUntil(instant, TimeZone.UTC)
                val relativeTime = prettifyRelativeTime(period)
                dateAddedString = relativeTime
                delay(1.seconds)
            }
        } else {
            val dateTime = instant.toLocalDateTime(TimeZone.currentSystemDefault())
            dateAddedString = dateTime.format(MyDateAndTimeFormats.fullDateTime)
        }
    }
    Text(dateAddedString, modifier)
}

@Composable
fun RenderRightSubText(itemState: IDownloadItemState, modifier: Modifier) {
    if (itemState is ProcessingDownloadItemState && itemState.status is DownloadJobStatus.IsActive) {
        RenderEta(itemState, modifier)
    } else {
        RenderAddedTime(itemState, modifier)
    }
}

@Composable
fun RenderCenterSubText(itemState: IDownloadItemState, errorReason: DownloadErrorReason?, modifier: Modifier) {
    if (itemState is ProcessingDownloadItemState) {
        if (itemState.status is DownloadJobStatus.IsActive) {
            RenderSpeed(itemState.speed, modifier)
        } else {
            RenderTextStatus(itemState, errorReason, modifier)
        }
    }
}

@Composable
fun RenderTextStatus(
    itemState: IDownloadItemState,
    errorReason: DownloadErrorReason?,
    modifier: Modifier,
) {
    val status = createStatusStringWithReason(itemState, errorReason)
    Text(
        status.rememberString(),
        color = if (errorReason != null) {
            myColors.error
        } else {
            LocalContentColor.current
        },
        modifier = modifier,
    )
}

@Composable
fun RenderSpeed(speed: Long, modifier: Modifier) {
    val target = LocalSpeedUnit.current
    val speedString = remember(speed) {
        convertPositiveSpeedToHumanReadable(speed, target)
    }
    Text(speedString, modifier)
}

@Composable
fun RenderLeftSubText(itemState: IDownloadItemState, modifier: Modifier) {
    val totalSize = itemState.contentLength
    val sizeUnit = LocalSizeUnit.current
    val totalSizeString = remember(totalSize, sizeUnit) {
        convertPositiveSizeToHumanReadable(totalSize, sizeUnit, true)
    }
    val progress = (itemState as? ProcessingDownloadItemState)?.progress
    val progressStringOrNull = remember(progress, sizeUnit) {
        progress?.let {
            convertPositiveSizeToHumanReadable(progress, sizeUnit, true)
        }
    }
    val text = when {
        else -> {
            buildString {
                progressStringOrNull?.let {
                    append(it.rememberString())
                    append("/")
                }
                append(totalSizeString.rememberString())
            }
        }
    }
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
     
```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/home/RenderMainMenu.kt`
```
package com.abdownloadmanager.android.pages.home

import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.abdownloadmanager.android.ui.menu.RenderMenuInSinglePage
import com.abdownloadmanager.shared.ui.widget.rememberMyComponentRectPositionProvider

@Composable
fun RenderMainMenu(component: HomeComponent) {
    val mainMenuShowing by component.isMainMenuShowing.collectAsState()
    if (mainMenuShowing) {
        val onDismissRequest = {
            component.setIsMainMenuShowing(false)
        }
        Popup(
            popupPositionProvider = rememberMyComponentRectPositionProvider(
                anchor = Alignment.TopStart,
                alignment = Alignment.TopEnd,
                offset = DpOffset(x = 0.dp, y = (-8).dp)
            ),
            onDismissRequest = onDismissRequest,
            properties = PopupProperties(
                focusable = true,
            )
        ) {
            RenderMenuInSinglePage(
                menu = component.mainMenu,
                onDismissRequest = onDismissRequest,
                modifier = Modifier.width(IntrinsicSize.Max),
            )
        }
    }
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/home/RenderStatusFilterMenu.kt`
```
package com.abdownloadmanager.android.pages.home

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.abdownloadmanager.android.pages.home.sections.Categories
import com.abdownloadmanager.android.pages.home.sections.queues.QueuesSection
import com.abdownloadmanager.resources.Res
import com.abdownloadmanager.shared.ui.widget.ActionButton
import com.abdownloadmanager.shared.util.div
import com.abdownloadmanager.shared.util.ui.myColors
import com.abdownloadmanager.shared.util.ui.theme.myShapes
import com.abdownloadmanager.shared.util.ui.theme.mySpacings
import ir.amirab.util.compose.modifiers.hijackClick
import ir.amirab.util.compose.resources.myStringResource

@Composable
fun RenderStatusFilterMenu(
    component: HomeComponent,
    modifier: Modifier,
    enter: EnterTransition,
    exit: ExitTransition,
) {
    val isShowingStatusFilterMenu by component.isCategoryFilterShowing.collectAsState()
    AnimatedVisibility(
        modifier = modifier,
        visible = isShowingStatusFilterMenu,
        enter = enter,
        exit = exit,
    ) {
        BackHandler {
            component.setIsCategoryFilterShowing(false)
        }
        val shape = myShapes.defaultRounded
        Column(
            Modifier
                .clip(shape)
                .hijackClick()
                .background(myColors.surface, shape)
                .border(1.dp, myColors.onSurface / 0.2f, shape)
        ) {
            Column(
                Modifier
                    .weight(1f, false)
                    .verticalScroll(rememberScrollState())
            ) {
                Categories(component, Modifier)
                Spacer(
                    Modifier
                        .padding(4.dp)
                        .height(1.dp)
                        .fillMaxWidth()
                        .background(myColors.onSurface / 0.1f)
                )
                QueuesSection(component, Modifier)
            }
            ActionButton(
                text = myStringResource(Res.string.ok),
                onClick = {
                    component.setIsSortMenuShowing(false)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        mySpacings.largeSpace
                    ),
            )
        }
    }
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/home/SelectedQueueItemsOption.kt`
```
package com.abdownloadmanager.android.pages.home

import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.style.TextAlign
import com.abdownloadmanager.resources.Res
import com.abdownloadmanager.shared.ui.widget.IconActionButton
import com.abdownloadmanager.shared.ui.widget.Text
import com.abdownloadmanager.shared.ui.widget.TransparentIconActionButton
import com.abdownloadmanager.shared.util.ui.icon.MyIcons
import ir.amirab.util.compose.asStringSource

@Immutable
data class QueueSelectedItemsMenuProps(
    val queueName: String,
    val onRequestQueueItemsUp: () -> Unit,
    val onRequestQueueItemsDown: () -> Unit,
    val onRequestRemoveItemsFromQueue: () -> Unit,
)

@Composable
fun RenderSelectedQueueItemsOption(
    props: QueueSelectedItemsMenuProps,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TransparentIconActionButton(
            icon = MyIcons.up,
            contentDescription = Res.string.move_up.asStringSource(),
            onClick = props.onRequestQueueItemsUp,
            shape = RectangleShape,
        )
        TransparentIconActionButton(
            icon = MyIcons.down,
            contentDescription = Res.string.move_down.asStringSource(),
            onClick = props.onRequestQueueItemsDown,
            shape = RectangleShape,
        )
        Text(
            props.queueName,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center,
        )
        TransparentIconActionButton(
            MyIcons.minus,
            Res.string.remove.asStringSource(),
            onClick = props.onRequestRemoveItemsFromQueue,
            shape = RectangleShape,
        )
    }
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/home/sections/queues/Queues.kt`
```
package com.abdownloadmanager.android.pages.home.sections.queues

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import com.abdownloadmanager.android.pages.home.HomeComponent
import com.abdownloadmanager.android.ui.menu.RenderMenuInSinglePage
import com.abdownloadmanager.android.ui.myCombinedClickable
import com.abdownloadmanager.shared.pages.home.queue.QueueActions
import com.abdownloadmanager.resources.Res
import com.abdownloadmanager.shared.ui.widget.ExpandableItem
import com.abdownloadmanager.shared.ui.widget.Text
import com.abdownloadmanager.shared.ui.widget.rememberMyPopupPositionProviderAtPosition
import com.abdownloadmanager.shared.util.div
import com.abdownloadmanager.shared.util.ui.LocalContentAlpha
import com.abdownloadmanager.shared.util.ui.LocalContentColor
import com.abdownloadmanager.shared.util.ui.WithContentAlpha
import com.abdownloadmanager.shared.util.ui.icon.MyIcons
import com.abdownloadmanager.shared.util.ui.myColors
import com.abdownloadmanager.shared.util.ui.theme.myShapes
import com.abdownloadmanager.shared.util.ui.theme.mySpacings
import com.abdownloadmanager.shared.util.ui.theme.myTextSizes
import com.abdownloadmanager.shared.util.ui.widget.MyIcon
import ir.amirab.downloader.db.QueueModel
import ir.amirab.downloader.queue.DownloadQueue
import ir.amirab.util.compose.action.MenuItem
import ir.amirab.util.compose.asStringSource
import ir.amirab.util.compose.resources.myStringResource

@Composable
internal fun QueuesSection(
    component: HomeComponent,
    modifier: Modifier,
) {

    val currentSelectedQueue = component.filterState.queueFilter
    val filterMode by component.filterMode
    val queues by component.queueManager.queues.collectAsState()
    val clipShape = myShapes.defaultRounded
    val showQueueOption by component.queueActions.collectAsState()
    var lastPointerPosition by remember { mutableStateOf(Offset.Zero) }
    fun showQueueOption(downloadQueue: DownloadQueue?, pointerPosition: Offset) {
        lastPointerPosition = pointerPosition
        component.showCategoryOptions(downloadQueue)
    }

    fun closeQueueOptions() {
        component.closeQueueOptions()
    }

    var isExpanded by remember {
        mutableStateOf(
            filterMode is HomeComponent.FilterMode.Queue
        )
    }
    Column(
        modifier
            .border(1.dp, myColors.surface, clipShape)
            .clip(clipShape)
            .padding(1.dp),
    ) {
        var layoutCoordinates by remember {
            mutableStateOf(null as LayoutCoordinates?)
        }
        ExpandableItem(
            isExpanded = isExpanded,
            modifier = Modifier,
            header = {
                Box(
                    Modifier
                        .height(IntrinsicSize.Max)
                        .heightIn(mySpacings.thumbSize)
                        .onGloballyPositioned {
                            layoutCoordinates = it
                        }
                        .myCombinedClickable(
                            onClick = {
                                isExpanded = !isExpanded
                            },
                            onLongClick = {
                                showQueueOption(null, layoutCoordinates?.localToWindow(it) ?: Offset.Zero)
                            },
                            interactionSource = remember { MutableInteractionSource() },
                            indication = LocalIndication.current,
                        )
                ) {
                    Row(
                        Modifier
                            .padding(vertical = 4.dp)
                            .padding(start = 16.dp)
                            .padding(end = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        WithContentAlpha(0.75f) {
                            MyIcon(
                                MyIcons.queue,
                                null,
                                Modifier.size(mySpacings.iconSize)
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                myStringResource(Res.string.queues),
                                Modifier.weight(1f),
                                fontWeight = FontWeight.Normal,
                                fontSize = myTextSizes.lg,
                                overflow = TextOverflow.Ellipsis,
                                maxLines = 1,
                            )
                            MyIcon(
                                MyIcons.up, null, Modifier
                                    .fillMaxHeight()
                                    .wrapContentHeight()
                                    .clip(CircleShape)
                                    .clickable {
                                        isExpanded = !isExpanded
                                    }
                                    .padding(6.dp)
                                    .size(16.dp)
                                    .rotate(if (isExpanded) 0f else 180f))
                        }
                    }
                }
            },
            body = {
                Column {
                    queues.forEachIndexed { index, queue ->
                        key(queue.id) {
                            QueueFilterItem(
                                modifier = Modifier,
                                isSelected = currentSelectedQueue?.id == queue.id,
                                onSelect = {
                                    component.onQueueFilterChange(queue.queueModel.value)
                                },
//                                onItemsDroppedInQueue = { downloadIds ->
//                                    component.moveItemsToQueue(queue, downloadIds)
//                                },
                                queueModel = queue.queueModel.collectAsState().value,
                                isActive = queue.activeFlow.collectAsState().value,
                                showQueueOption = { position ->
                                    showQueueOption(queue, position)
                                }
//                                parentShape = clipShape,
//                                isLast = queues.lastIndex == index
                            )
                        }
                    }
                }
            },
        )
    }
    showQueueOption?.let {
        QueueOption(
            queueOptionMenuState = it,
            onDismiss = {
                closeQueueOptions()
            },
            position = lastPointerPosition,
        )
    }
}

@Composable
private fun QueueFilterItem(
    isSelected: Boolean,
    onSelect: () -> Unit,
//    onItemsDroppedInQueue: (List<Long>) -> Unit,
    queueModel: QueueModel,
    isActive: Boolean,
    modifier: Modifier = Modifier,
    showQueueOption: (offset: Offset) -> Unit,
    // I add this to properly create border on drag when the item is in the last position
//    isLast: Boolean,
//    parentShape: RoundedCornerShape,
) {
//    var isDraggingOnMe by remember { mutableStateOf(false) }
    var layoutCoordinates by remember { mutableStateOf(null as LayoutCoordinates?) }
    Box(
        modifier
//            .dropDownloadItemsHere(
//                onDragIn = { isDraggingOnMe = true },
//                onDragDone = { isDraggingOnMe = false },
//                onItemsDropped = onItemsDroppedInQueue,
//            )
            .background(
                if (isSelected) {
                    myColors.onBackground / 0.05f
                } else Color.Transparent
            )
//            .ifThen(isDraggingOnMe) {
//                val infiniteTransition = rememberInfiniteTransition()
//                val color by infiniteTransition.animateColor(
//                    initialValue = myColors.primary,
//                    targetValue = myColors.secondary,
//                    animationSpec = infiniteRepeatab
```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/home/sections/sort/RenderSortMenu.kt`
```
package com.abdownloadmanager.android.pages.home.sections.sort

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.abdownloadmanager.android.pages.home.HomeComponent
import com.abdownloadmanager.resources.Res
import com.abdownloadmanager.shared.ui.widget.ActionButton
import com.abdownloadmanager.shared.ui.widget.Text
import com.abdownloadmanager.shared.ui.widget.sort.Sort
import com.abdownloadmanager.shared.ui.widget.sort.SortIndicatorMode
import com.abdownloadmanager.shared.ui.widget.sort.isDescending
import com.abdownloadmanager.shared.ui.widget.sort.toSortIndicatorMode
import com.abdownloadmanager.shared.ui.widget.sort.next
import com.abdownloadmanager.shared.util.div
import com.abdownloadmanager.shared.util.ui.icon.MyIcons
import com.abdownloadmanager.shared.util.ui.myColors
import com.abdownloadmanager.shared.util.ui.theme.myShapes
import com.abdownloadmanager.shared.util.ui.theme.mySpacings
import com.abdownloadmanager.shared.util.ui.theme.myTextSizes
import com.abdownloadmanager.shared.util.ui.widget.MyIcon
import ir.amirab.util.compose.modifiers.hijackClick
import ir.amirab.util.compose.resources.myStringResource
import ir.amirab.util.ifThen

@Composable
fun RenderSortMenu(
    component: HomeComponent,
    modifier: Modifier,
    enter: EnterTransition,
    exit: ExitTransition,
) {
    val isShowingSortMenu by component.isSortMenuShowing.collectAsState()
    AnimatedVisibility(
        modifier = modifier,
        visible = isShowingSortMenu,
        enter = enter,
        exit = exit,
    ) {
        BackHandler {
            component.setIsSortMenuShowing(false)
        }
        val shape = myShapes.defaultRounded
        Column(
            Modifier
                .clip(shape)
                .hijackClick()
                .background(myColors.surface, shape)
                .border(1.dp, myColors.onSurface / 0.2f, shape)
        ) {
            val selectedSort by component.selectedSort.collectAsState()
            Text(
                text = myStringResource(Res.string.sort_by),
                fontWeight = FontWeight.Bold,
                fontSize = myTextSizes.xl,
                modifier = Modifier.padding(
                    mySpacings.largeSpace
                )
            )
            Column(
                Modifier
                    .weight(1f, false)
                    .verticalScroll(rememberScrollState()),
            ) {
                for (downloadSortBy in component.possibleSorts) {
                    val isSelected = downloadSortBy == selectedSort.cell
                    key(downloadSortBy) {
                        SortItem(
                            downloadSortBy,
                            sortIndicatorMode = if (isSelected) {
                                selectedSort.toSortIndicatorMode()
                            } else {
                                SortIndicatorMode.None
                            },
                            onSortChange = {
                                component.setSelectedSort(
                                    Sort(
                                        cell = downloadSortBy,
                                        isDescending = it.isDescending()
                                    )
                                )
                            },
                            Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
            ActionButton(
                text = myStringResource(Res.string.ok),
                onClick = {
                    component.setIsSortMenuShowing(false)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        mySpacings.largeSpace
                    ),
            )
        }
    }
}

@Composable
private fun SortItem(
    sortBy: DownloadSortBy,
    sortIndicatorMode: SortIndicatorMode,
    onSortChange: (SortIndicatorMode) -> Unit,
    modifier: Modifier,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .clickable {
                onSortChange(sortIndicatorMode.next())
            }
            .ifThen(sortIndicatorMode == SortIndicatorMode.None) {
                alpha(0.6f)
            }
            .heightIn(min = mySpacings.thumbSize)
            .padding(horizontal = mySpacings.largeSpace),
    ) {
        MyIcon(sortBy.icon, null, Modifier.size(24.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            sortBy.name.rememberString(),
            Modifier.weight(1f)
        )
        Spacer(Modifier.width(8.dp))
        RenderSortIndicatorMode(sortIndicatorMode)
    }
}

@Composable
fun RenderSortIndicatorMode(sortIndicatorMode: SortIndicatorMode) {
    val icon = when (sortIndicatorMode) {
        SortIndicatorMode.None -> null
        SortIndicatorMode.Ascending -> MyIcons.sortUp
        SortIndicatorMode.Descending -> MyIcons.sortDown
    }
    icon?.let {
        MyIcon(
            it,
            null,
            Modifier
                .size(16.dp)
                .alpha(0.75f)
        )
    }
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/newqueue/NewQueue.kt`
```
package com.abdownloadmanager.android.pages.newqueue

import androidx.compose.runtime.Composable
import com.abdownloadmanager.android.ui.configurable.SheetInput
import com.abdownloadmanager.resources.Res
import com.abdownloadmanager.shared.ui.widget.MyTextField
import ir.amirab.util.compose.asStringSource
import ir.amirab.util.compose.resources.myStringResource

@Composable
fun NewQueueSheet(
    onQueueCreate: (String) -> Unit,
    isOpened: Boolean,
    onCloseRequest: () -> Unit,
) {
    SheetInput(
        title = Res.string.add_new_queue.asStringSource(),
        validate = { it.isNotEmpty() },
        isOpened = isOpened,
        initialValue = { "" },
        onDismiss = onCloseRequest,
        onConfirm = onQueueCreate,
        inputContent = {
            MyTextField(
                modifier = it.modifier,
                text = it.editingValue,
                onTextChange = it.setEditingValue,
                placeholder = myStringResource(Res.string.queue_name),
            )
        },
    )
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/abdownloadmanager/android/pages/onboarding/permissions/BatteryOptimizationUtil.kt`
```
package com.abdownloadmanager.android.pages.onboarding.permissions

import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.provider.Settings
import androidx.core.net.toUri
import ir.amirab.util.ifThen

fun requestIgnoreBatteryOptimizationPermission(
    context: Context,
    startNewTask: Boolean = false,
) {
    try {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = ("package:" + context.packageName).toUri()
        }.ifThen(startNewTask) {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        // Fallback
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            .ifThen(startNewTask) {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        context.startActivity(intent)
    }
}

fun isBatteryOptimizationDisabled(
    context: Context
): Boolean {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return powerManager.isIgnoringBatteryOptimizations(context.packageName)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #535** (2025-05-05): **Downloading with AB DM a PDF file attached to an email**
  *Symptoms*: When downloading a PDF file attached to an email, AB DM gives it a strange name, for example =_UTF-8_B_15HXmdeQ15XXqNeZ150g15HXpNeo16nXmdeV16o=_= =_UTF-8_B_INeq15bXqNeZ16Ig157XpteV16jXoi5wZGY=_=  Thanks!  EDGE GMAIL.COM AB Download Manager Version 1.5.5
  **Post-Mortem & Fix Analysis**:
  > @amir1376  I looked into the issue more deeply. When the attached file name is in English, there is no problem. The issue is only when the attached file name is in Arabic or Hebrew. Thanks!
  > Hi @H5820121 can you please share an example link ? 
  > > Hi [@H5820121](https://github.com/H5820121) can you please share an example link ?   @amir1376  Please give me your GMAIL email address and I will send you an attachment in a few minutes and you can try downloading it.

- **Issue #433** (2025-03-05): **"Use Category by default" not working properly**
  *Symptoms*: ### Description  **Version:** `1.5.3`  The `Use Category by default` setting does not work correctly. If this option is enabled, then the new download will be added to the appropriate category. However, if this setting is turned off, new download will still be added to the appropriate category.  Yes, the checkbox for using categories will be disabled in the "New download" window, but the categorisation will still take place.  My suggestion: if this option is disabled, then the download appears only in the `All` / `Finished` / `Unfinished` category.  ### Video  [Video demonstration](https://drive.google.com/file/d/1hD079ItxFp7XOcLvm82V20uSvjN4fO8h/view?usp=sharing) 
  **Post-Mortem & Fix Analysis**:
  > Oh. You are right its bug I will fix it. thank you
  > @amir1376, Thanks.

- **Issue #75** (2024-09-20): **[Feature] Import List**
  *Symptoms*: The import from clipboard is nice, but what If I have a list of URI in my clipboard? Or what about just plain file import which dumps a URL list into a queue?
  **Post-Mortem & Fix Analysis**:
  > @zQueal Hi there.  Yes I agreed. I should implement a form of backup to also store download configs ( headers / user / user-agent etc.. ) as well alongside the URL into a file so they can be restored later.  > what If I have a list of URI in my clipboard?   you can already copy a list of links and paste it to the app.  
  > > you can already copy a list of links and paste it to the app.  Interesting, the whole reason why I opened this ticket was I tried it, and didn't see a way to do it. I copied a list of URI to my clipboard tried to import via clipboard and it only did the first URI.  Did I miss something?
  > @zQueal you just need the  open the app and press `Ctrl V` a list will appear containing all the links and their info which you can select which one you want to add.( or just simply select all)   for example ``` https://example.com/a.txt https://example.com/b.txt https://example.com/c.txt ```  if you still can't import them, tell me how can I reproduce the problem you faced. maybe there is a bug or sowthing.

- **Issue #46** (2024-08-26): **Multilanguage Support and Chinese Filename Parsing Issue**
  *Symptoms*: First of all, thank you for creating such an excellent download manager. Your work is greatly appreciated!  ## Multilanguage Support  Have you considered adding multilanguage support to the program? I would be happy to assist by providing translations for Simplified Chinese and German.  ## Chinese Filename Parsing Issue  I've encountered a small issue when trying to download files with Chinese characters in the filename from a self-hosted Cloudreve instance. The Chinese characters are not being parsed correctly.  ### Steps to Reproduce: 1. Set up a local Cloudreve instance 2. Try to download a file with Chinese characters in the filename 3. Observe the parsed filename in ab-download-manager  ### Example: - Original filename: "KomNetze_Prakt_V02_中文翻译.pdf" - Download URL: `http://x.x.x.x:xxxx/api/v3/file/download/9cUxR4LNDVf8gdlG?sign=btph8rt20jqP3eWFuLQQYAUiMtF1qhrvLQ0MQMBUKsg%3D%3A1724436075` - Parsed filename by ab-download-manager: "KomNetze_Prakt_V02_%E4%B8%AD%E6%96%87%E7%BF%BB%E8%AF%91"  As you can see, the Chinese characters are not decoded properly and remain URL-encoded.  ### Additional Information: This issue seems to be specific to certain URL formats. For example, when downloading from GitHub or a local AList instance, Chinese filenames are parsed correctly. These URLs typically look like: `https://github.com/Ceelog/DictionaryByGPT4/raw/main/%E5%A8%81%E5%A8%81%E7%9A%84GPT%E5%8D%95%E8%AF%8D%E6%9C%AC(8000%E8%AF%8D).mdx`  In these cases, ab-do
  **Post-Mortem & Fix Analysis**:
  > @Atlantis-Gura Hi, Thanks for reporting this actually this is not related to Chinese! any `UTF8` character may have this issue too! . this bug exists for some URLs that uses `URL Encoded` which I have to fix that in next version  BTW thank you for you interest to translate the app  after I setup an i18n (internationalization) for the app, I will use your help❤️

- **Issue #20** (2024-08-17): **Speed is incorrect when we open app after a while **
  *Symptoms*: download speed is incorrect when we open app after a while  1. start download  2. close all the app windows 3. after a while reopen the app main screen  4. you will see that download speed is not correct (for about 2 seconds) then it will fixed

- **Issue #4** (2025-01-24): **[Bug] System tray does not do anything on linux**
  *Symptoms*: Hi @amir1376   The system tray do nothing on linux, i can't open or close the app (no context menu appear).  Thanks,
  **Post-Mortem & Fix Analysis**:
  > @ZorinFoss what is your distro ?  
  > > @ZorinFoss what is your distro ?  I'm on Arch linux KDE Wayland.
  > @ZorinFoss I will check it ,Thanks.

- **Issue #3** (2025-01-05): **Make system tray icon transparent**
  *Symptoms*: Hi @amir1376   Please make the system tray icon transparent to be more adaptive with light and dark theme.  This is how it look with dark theme: ![Screenshot_20240804_153208](https://github.com/user-attachments/assets/fe6755cc-4a65-46fc-b7e6-044125eef32d)  thanks, 
  **Post-Mortem & Fix Analysis**:
  > @ZorinFoss thanks for reporting this This bug is related to compose/jdk in linux, I have to find a workaround for this, maybe use native api
  > May I suggest using a specific icon image file like "abdowloadmanager-tray.png" somewhere, which will enable users to choose some other one in accordance with their current icon theme?
  > Fixed now.

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

### Incident Patch 1: `39043674` (2026-10-01)
**Commit Message**: fix(macos): detach the app with a bundled setsid helper (#1434)

* fix DetachedLauncher not working on macOS

* fix(macos): set a deployment target for the setsid helper

Without -mmacosx-version-min clang targets the macOS version of the
build machine, so the release builds (macos-15 runners) produced a
helper with minos 15.0 and chained fixups, while the app launcher is
patched to minos 10.13. Use the same minimum for the helper.

---------

Co-authored-by: AmirHossein Abdolmotallebi <[REDACTED_EMAIL]>

**File**: `desktop/app-utils/src/main/kotlin/com/abdownloadmanager/desktop/NativeExtractor.kt` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+package com.abdownloadmanager.desktop
+
+import okio.FileSystem
+import okio.Path.Companion.toPath
+import okio.sink
+import java.io.File
+import java.util.concurrent.ConcurrentHashMap
+
+object NativeExtractor {
+    private val cache = ConcurrentHashMap<String, File>()
+
+    fun getFromResource(path: String): File {
+        return cache.computeIfAbsent(path) { resourcePath ->
+            val resource = resourcePath.toPath()
+            val file = File.createTempFile("abdm_${resource.name}", null).apply {
+                deleteOnExit()
+            }
+
+            try {
+                FileSystem.RESOURCES.read(resource) {
+                    file.sink().use {
+                        readAll(it)
+                    }
+                }
+                file.setExecutable(true, false)
+                file
+            } catch (t: Throwable) {
+                file.delete()
+                throw t
+            }
+        }
+    }
+}
\ No newline at end of file
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/utils/DetachedLauncher.kt` (modified, +15/-1)
```diff
@@ -1,7 +1,10 @@
 package com.abdownloadmanager.desktop.utils
 
+import com.abdownloadmanager.desktop.NativeExtractor
+import ir.amirab.util.desktop.mac.native.MacOSNativeFilesInResources
 import ir.amirab.util.platform.Platform
 import ir.amirab.util.platform.asDesktop
+import ir.amirab.util.platform.isMac
 import ir.amirab.util.platform.isWindows
 import ir.amirab.util.withoutJPackageEnvVariable
 import java.io.File
@@ -98,13 +101,24 @@ object DetachedLauncher {
 
     private fun String.psSingleQuoteEscape(): String = replace("'", "''")
 
+    private val macSetSidPath by lazy {
+        NativeExtractor
+            .getFromResource(MacOSNativeFilesInResources.setsid)
+            .absolutePath
+    }
+
+    private fun getSetsidExecutablePath(): String {
+        return if (Platform.isMac()) macSetSidPath
+        else "setsid"
+    }
+
     // Linux/macOS: browsers sandbox native hosts with a process group /
     // session too. setsid detaches into a brand-new session so the child
     // isn't in the browser's session and survives it exiting/killing.
     // No shell involved -> no quoting needed, argv passed directly.
     private fun execViaSetsid(exePath: File, args: List<String>) {
         val command = buildList {
-            add("setsid")
+            add(getSetsidExecutablePath())
             add(exePath.path)
             addAll(args)
         }
```

**File**: `desktop/mac_utils/build.gradle.kts` (modified, +45/-1)
```diff
@@ -1,3 +1,47 @@
-plugins{
+import ir.amirab.util.platform.Platform
+import ir.amirab.util.platform.isMac
+
+plugins {
     id(MyPlugins.kotlin)
+}
+
+val generatedResources = layout.buildDirectory.dir("generated/resources")
+
+val setsidSource = layout.projectDirectory.file("src/main/native/setsid.c")
+val setsidBinary = generatedResources.map { it.file("native/macos/setsid") }
+
+val compileMacOsSetsid = tasks.register<Exec>("compileMacOsSetsid") {
+    description = "Compile the macOS setsid helper"
+    onlyIf { Platform.isMac() }
+
+    inputs.file(setsidSource)
+    outputs.file(setsidBinary)
+
+    doFirst {
+        setsidBinary.get().asFile.parentFile.mkdirs()
+    }
+
+    commandLine(
+        "clang",
+        setsidSource.asFile.absolutePath,
+        "-O2",
+        "-Wall",
+        "-Wextra",
+        "-Werror",
+        "-arch", "arm64",
+        "-arch", "x86_64",
+        // same minimum as the app launcher, otherwise clang uses the build machine's macOS version
+        "-mmacosx-version-min=10.13",
+        "-o", setsidBinary.get().asFile.absolutePath,
+    )
+}
+
+tasks.named("processResources") {
+    dependsOn(compileMacOsSetsid)
+}
+
+sourceSets {
+    main {
+        resources.srcDir(generatedResources)
+    }
 }
\ No newline at end of file
```

**File**: `desktop/mac_utils/src/main/kotlin/ir/amirab/util/desktop/mac/native/MacOSNativeFilesInResources.kt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+package ir.amirab.util.desktop.mac.native
+
+object MacOSNativeFilesInResources {
+    val setsid: String = "native/macos/setsid"
+}
\ No newline at end of file
```

**File**: `desktop/mac_utils/src/main/native/setsid.c` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+#include <errno.h>
+#include <stdio.h>
+#include <stdlib.h>
+#include <unistd.h>
+
+int main(int argc, char *argv[]) {
+    if (argc < 2) {
+        fprintf(stderr, "Usage: %s program [argument ...]\n", argv[0]);
+        return 1;
+    }
+
+    if (setsid() == -1) {
+        if (errno != EPERM) {
+            perror("setsid");
+            return 1;
+        }
+
+        pid_t pid = fork();
+        if (pid < 0) {
+            perror("fork");
+            return 1;
+        }
+
+        if (pid > 0) {
+            _exit(0);
+        }
+
+        if (setsid() == -1) {
+            perror("setsid");
+            return 1;
+        }
+    }
+
+    execvp(argv[1], &argv[1]);
+
+    perror(argv[1]);
+    return 127;
+}
\ No newline at end of file
```

---

### Incident Patch 2: `2beb913e` (2026-09-23)
**Commit Message**: fix: create windows with their title already set (#1432)

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/about/AboutDialog.kt` (modified, +5/-3)
```diff
@@ -2,7 +2,6 @@ package com.abdownloadmanager.desktop.pages.about
 
 import com.abdownloadmanager.desktop.AppComponent
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
-import com.abdownloadmanager.desktop.window.custom.WindowTitle
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.collectAsState
 import androidx.compose.ui.Alignment
@@ -14,6 +13,7 @@ import androidx.compose.ui.window.v2.WindowPositionProvider
 import androidx.compose.ui.window.v2.WindowSizeProvider
 import androidx.compose.ui.window.v2.rememberWindowState
 import com.abdownloadmanager.desktop.window.custom.WindowIcon
+import com.abdownloadmanager.desktop.window.custom.rememberWindowController
 import com.abdownloadmanager.shared.util.ui.icon.MyIcons
 import com.abdownloadmanager.shared.util.ui.theme.LocalUiScale
 import com.abdownloadmanager.resources.Res
@@ -57,9 +57,11 @@ fun AboutDialog(
                 positionProvider = WindowPositionProvider.CenteredOnScreen
             ),
         ),
-        onCloseRequest = onClose
+        onCloseRequest = onClose,
+        windowController = rememberWindowController(
+            title = myStringResource(Res.string.about),
+        ),
     ) {
-        WindowTitle(myStringResource(Res.string.about))
         WindowIcon(MyIcons.info)
         AboutPage(
             onRequestShowOpenSourceLibraries = onRequestShowOpenSourceLibraries,
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/addDownload/ShowAddDownloadDialogs.kt` (modified, +7/-3)
```diff
@@ -19,7 +19,7 @@ import com.abdownloadmanager.desktop.pages.addDownload.single.AddDownloadPage
 import com.abdownloadmanager.shared.pages.adddownload.single.BaseAddSingleDownloadComponent
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
 import com.abdownloadmanager.desktop.window.custom.WindowIcon
-import com.abdownloadmanager.desktop.window.custom.WindowTitle
+import com.abdownloadmanager.desktop.window.custom.rememberWindowController
 import com.abdownloadmanager.resources.Res
 import com.abdownloadmanager.shared.pages.adddownload.AddDownloadComponent
 import com.abdownloadmanager.shared.util.ui.icon.MyIcons
@@ -75,12 +75,14 @@ private fun AddDownloadWindow(
                 onCloseRequest = onRequestClose,
                 alwaysOnTop = true,
                 minSize = DpSize(w.dp, h.dp),
+                windowController = rememberWindowController(
+                    title = myStringResource(Res.string.add_download),
+                ),
             ) {
                 LaunchedEffect(Unit) {
                     PlatformAppActivator.active()
                 }
 //                    BringToFront()
-                WindowTitle(myStringResource(Res.string.add_download))
                 WindowIcon(MyIcons.appIcon)
                 AddDownloadPage(addDownloadComponent)
             }
@@ -103,12 +105,14 @@ private fun AddDownloadWindow(
                 onCloseRequest = onRequestClose,
                 alwaysOnTop = true,
                 minSize = DpSize(w.dp, h.dp),
+                windowController = rememberWindowController(
+                    title = myStringResource(Res.string.add_download),
+                ),
             ) {
                 LaunchedEffect(Unit) {
                     PlatformAppActivator.active()
                 }
 //                    BringToFront()
-                WindowTitle(myStringResource(Res.string.add_download))
                 WindowIcon(MyIcons.appIcon)
                 AddMultiItemPage(addDownloadComponent)
             }
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/batchdownload/BatchDownloadWindow.kt` (modified, +7/-1)
```diff
@@ -9,11 +9,14 @@ import androidx.compose.ui.window.v2.WindowSizeProvider
 import androidx.compose.ui.window.v2.rememberWindowState
 import com.abdownloadmanager.desktop.AppComponent
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
+import com.abdownloadmanager.desktop.window.custom.rememberWindowController
 import com.abdownloadmanager.shared.pages.batchdownload.BaseBatchDownloadComponent
 import com.abdownloadmanager.shared.util.mvi.HandleEffects
 import com.abdownloadmanager.shared.util.rememberChild
 import com.abdownloadmanager.shared.util.ui.theme.LocalUiScale
 import ir.amirab.util.desktop.screen.applyUiScale
+import com.abdownloadmanager.resources.Res
+import ir.amirab.util.compose.resources.myStringResource
 
 @Composable
 fun BatchDownloadWindow(appComponent: AppComponent) {
@@ -34,7 +37,10 @@ private fun BatchDownloadWindow(desktopBatchDownloadComponent: DesktopBatchDownl
                 positionProvider = WindowPositionProvider.CenteredOnScreen
             )
         ),
-        onCloseRequest = desktopBatchDownloadComponent.onClose
+        onCloseRequest = desktopBatchDownloadComponent.onClose,
+        windowController = rememberWindowController(
+            title = myStringResource(Res.string.batch_download),
+        ),
     ) {
         HandleEffects(desktopBatchDownloadComponent) {
             when (it) {
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/batchdownload/BatchDownnload.kt` (modified, +0/-2)
```diff
@@ -12,7 +12,6 @@ import androidx.compose.ui.focus.FocusRequester
 import androidx.compose.ui.focus.focusRequester
 import androidx.compose.ui.unit.dp
 import com.abdownloadmanager.desktop.pages.batchdownload.WildcardSelect.*
-import com.abdownloadmanager.desktop.window.custom.WindowTitle
 import com.abdownloadmanager.shared.util.ui.icon.MyIcons
 import com.abdownloadmanager.shared.ui.widget.*
 import com.abdownloadmanager.shared.util.ui.myColors
@@ -31,7 +30,6 @@ import ir.amirab.util.compose.asStringSource
 fun BatchDownload(
     component: DesktopBatchDownloadComponent,
 ) {
-    WindowTitle(myStringResource(Res.string.batch_download))
     val link by component.link.collectAsState()
     val setLink = component::setLink
     val start by component.start.collectAsState()
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/category/NewCategoryPage.kt` (modified, +0/-10)
```diff
@@ -9,7 +9,6 @@ import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
 import androidx.compose.ui.unit.dp
 import com.abdownloadmanager.shared.ui.widget.MyTextFieldIcon
-import com.abdownloadmanager.desktop.window.custom.WindowTitle
 import com.abdownloadmanager.shared.util.ui.icon.MyIcons
 import com.abdownloadmanager.shared.ui.widget.*
 import com.abdownloadmanager.shared.util.ui.myColors
@@ -27,15 +26,6 @@ import java.io.File
 fun NewCategory(
     categoryComponent: CategoryComponent,
 ) {
-    WindowTitle(
-        myStringResource(
-            if (categoryComponent.isEditMode) {
-                Res.string.edit_category
-            } else {
-                Res.string.add_category
-            }
-        )
-    )
     Column(
         modifier = Modifier
             .padding(horizontal = 32.dp)
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/category/ShowCategoryDialogs.kt` (modified, +13/-1)
```diff
@@ -10,9 +10,12 @@ import androidx.compose.ui.window.v2.WindowPositionProvider
 import androidx.compose.ui.window.v2.WindowSizeProvider
 import androidx.compose.ui.window.v2.rememberWindowState
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
+import com.abdownloadmanager.desktop.window.custom.rememberWindowController
 import com.abdownloadmanager.shared.pages.category.CategoryComponent
 import com.abdownloadmanager.shared.util.ui.theme.LocalUiScale
 import ir.amirab.util.desktop.screen.applyUiScale
+import com.abdownloadmanager.resources.Res
+import ir.amirab.util.compose.resources.myStringResource
 
 @Composable
 fun ShowCategoryDialogs(dialogManager: DesktopCategoryDialogManager) {
@@ -38,7 +41,16 @@ private fun CategoryDialog(
                 ),
                 positionProvider = WindowPositionProvider.CenteredOnScreen
             )
-        )
+        ),
+        windowController = rememberWindowController(
+            title = myStringResource(
+                if (component.isEditMode) {
+                    Res.string.edit_category
+                } else {
+                    Res.string.add_category
+                }
+            ),
+        ),
     ) {
         NewCategory(component)
     }
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/checksum/FileChecksumPage.kt` (modified, +0/-2)
```diff
@@ -19,7 +19,6 @@ import com.abdownloadmanager.shared.ui.configurable.item.FileChecksumConfigurabl
 import com.abdownloadmanager.shared.ui.configurable.RenderSpinner
 import com.abdownloadmanager.shared.util.ClipboardUtil
 import com.abdownloadmanager.shared.ui.configurable.RenderConfigurable
-import com.abdownloadmanager.desktop.window.custom.WindowTitle
 import com.abdownloadmanager.resources.Res
 import com.abdownloadmanager.shared.pages.checksum.ChecksumStatus
 import com.abdownloadmanager.shared.pages.checksum.DownloadItemWithChecksum
@@ -54,7 +53,6 @@ import kotlinx.coroutines.flow.MutableStateFlow
 
 @Composable
 fun FileChecksumPage(component: DesktopFileChecksumComponent) {
-    WindowTitle(myStringResource(Res.string.file_checksum_page))
     val horizontalPadding = 16.dp
     Column {
         Table(
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/checksum/FileChecksumWindow.kt` (modified, +7/-1)
```diff
@@ -10,10 +10,13 @@ import androidx.compose.ui.window.v2.WindowSizeProvider
 import androidx.compose.ui.window.v2.rememberWindowState
 import com.abdownloadmanager.desktop.AppComponent
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
+import com.abdownloadmanager.desktop.window.custom.rememberWindowController
 import com.abdownloadmanager.shared.pages.checksum.BaseFileChecksumComponent
 import com.abdownloadmanager.shared.util.mvi.HandleEffects
 import com.abdownloadmanager.shared.util.ui.theme.LocalUiScale
 import ir.amirab.util.desktop.screen.applyUiScale
+import com.abdownloadmanager.resources.Res
+import ir.amirab.util.compose.resources.myStringResource
 
 @Composable
 fun FileChecksumWindow(
@@ -39,7 +42,10 @@ fun FileChecksumWindow(
     )
     CustomWindow(
         state = state,
-        onCloseRequest = component::onRequestClose
+        onCloseRequest = component::onRequestClose,
+        windowController = rememberWindowController(
+            title = myStringResource(Res.string.file_checksum_page),
+        ),
     ) {
         HandleEffects(component) {
             when (it) {
```

---

### Incident Patch 3: `3bb3994d` (2026-08-18)
**Commit Message**: cleanup UI entry logic

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/batchdownload/BatchDownloadWindow.kt` (modified, +11/-2)
```diff
@@ -6,14 +6,23 @@ import androidx.compose.ui.unit.DpSize
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.WindowPosition
 import androidx.compose.ui.window.rememberWindowState
+import com.abdownloadmanager.desktop.AppComponent
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
 import com.abdownloadmanager.shared.pages.batchdownload.BaseBatchDownloadComponent
-import com.abdownloadmanager.shared.util.ui.theme.LocalUiScale
 import com.abdownloadmanager.shared.util.mvi.HandleEffects
+import com.abdownloadmanager.shared.util.rememberChild
+import com.abdownloadmanager.shared.util.ui.theme.LocalUiScale
 import ir.amirab.util.desktop.screen.applyUiScale
 
 @Composable
-fun BatchDownloadWindow(desktopBatchDownloadComponent: DesktopBatchDownloadComponent) {
+fun BatchDownloadWindow(appComponent: AppComponent) {
+    appComponent.batchDownloadSlot.rememberChild()?.let {
+        BatchDownloadWindow(it)
+    }
+}
+
+@Composable
+private fun BatchDownloadWindow(desktopBatchDownloadComponent: DesktopBatchDownloadComponent) {
     CustomWindow(
         state = rememberWindowState(
             size = DpSize(500.dp, 420.dp)
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/editdownload/EditDownload.kt` (modified, +11/-0)
```diff
@@ -22,6 +22,7 @@ import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.Popup
 import androidx.compose.ui.window.WindowPosition
 import androidx.compose.ui.window.rememberWindowState
+import com.abdownloadmanager.desktop.AppComponent
 import com.abdownloadmanager.desktop.pages.addDownload.shared.ExtraConfig
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
 import com.abdownloadmanager.desktop.window.custom.WindowTitle
@@ -36,6 +37,7 @@ import com.abdownloadmanager.shared.util.FileIconProvider
 import com.abdownloadmanager.shared.util.div
 import com.abdownloadmanager.shared.util.downloaderror.DownloadErrorReason
 import com.abdownloadmanager.shared.util.mvi.HandleEffects
+import com.abdownloadmanager.shared.util.rememberChild
 import com.abdownloadmanager.shared.util.ui.WithContentAlpha
 import com.abdownloadmanager.shared.util.ui.WithContentColor
 import com.abdownloadmanager.shared.util.ui.icon.MyIcons
@@ -54,6 +56,15 @@ import ir.amirab.util.ifThen
 
 @Composable
 fun EditDownloadWindow(
+    appComponent: AppComponent,
+) {
+    appComponent.editDownloadSlot.rememberChild()?.let {
+        EditDownloadWindow(it)
+    }
+}
+
+@Composable
+private fun EditDownloadWindow(
     component: DesktopEditDownloadComponent,
 ) {
     CustomWindow(
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/home/HomeWindow.kt` (modified, +11/-0)
```diff
@@ -6,18 +6,29 @@ import androidx.compose.ui.Alignment
 import androidx.compose.ui.window.WindowPlacement
 import androidx.compose.ui.window.WindowPosition
 import androidx.compose.ui.window.rememberWindowState
+import com.abdownloadmanager.desktop.AppComponent
 import com.abdownloadmanager.desktop.utils.AppInfo
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
 import com.abdownloadmanager.desktop.window.custom.rememberWindowController
 import com.abdownloadmanager.shared.util.LocalShortCutManager
 import com.abdownloadmanager.shared.util.mvi.HandleEffects
+import com.abdownloadmanager.shared.util.rememberChild
 import com.abdownloadmanager.shared.util.ui.icon.MyIcons
 import kotlinx.coroutines.flow.launchIn
 import kotlinx.coroutines.flow.onEach
 import java.awt.Dimension
 
 @Composable
 fun HomeWindow(
+    appComponent: AppComponent,
+) {
+    appComponent.showHomeSlot.rememberChild()?.let {
+        HomeWindow(it, appComponent::closeHome)
+    }
+}
+
+@Composable
+private fun HomeWindow(
     homeComponent: HomeComponent,
     onCLoseRequest: () -> Unit,
 ) {
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/queue/QueueWindow.kt` (modified, +13/-3)
```diff
@@ -1,12 +1,22 @@
 package com.abdownloadmanager.desktop.pages.queue
 
-import com.abdownloadmanager.desktop.window.custom.CustomWindow
-import com.abdownloadmanager.shared.util.mvi.HandleEffects
 import androidx.compose.runtime.Composable
 import androidx.compose.ui.window.rememberWindowState
+import com.abdownloadmanager.desktop.AppComponent
+import com.abdownloadmanager.desktop.window.custom.CustomWindow
+import com.abdownloadmanager.shared.util.mvi.HandleEffects
+import com.abdownloadmanager.shared.util.rememberChild
+
+@Composable
+fun QueuesWindow(appComponent: AppComponent) {
+    appComponent.showQueuesSlot.rememberChild()?.let {
+        QueuesWindow(it)
+    }
+}
+
 
 @Composable
-fun QueuesWindow(queuesComponent: QueuesComponent) {
+private fun QueuesWindow(queuesComponent: QueuesComponent) {
     val state = rememberWindowState()
     CustomWindow(
         state = state,
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/settings/SettingWindow.kt` (modified, +11/-0)
```diff
@@ -8,10 +8,21 @@ import androidx.compose.ui.Alignment
 import androidx.compose.ui.window.WindowPlacement
 import androidx.compose.ui.window.WindowPosition
 import androidx.compose.ui.window.rememberWindowState
+import com.abdownloadmanager.desktop.AppComponent
 import com.abdownloadmanager.shared.settings.BaseSettingsComponent
+import com.abdownloadmanager.shared.util.rememberChild
 
 @Composable
 fun SettingWindow(
+    appComponent: AppComponent,
+) {
+    appComponent.showSettingSlot.rememberChild()?.let {
+        SettingWindow(it, appComponent::closeSettings)
+    }
+}
+
+@Composable
+private fun SettingWindow(
     settingsComponent: DesktopSettingsComponent,
     onRequestCloseWindow: () -> Unit,
 ) {
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/ui/Ui.kt` (modified, +13/-36)
```diff
@@ -1,11 +1,6 @@
 package com.abdownloadmanager.desktop.ui
 
-import androidx.compose.runtime.Composable
-import androidx.compose.runtime.LaunchedEffect
-import androidx.compose.runtime.collectAsState
-import androidx.compose.runtime.getValue
-import androidx.compose.runtime.remember
-import androidx.compose.runtime.rememberCoroutineScope
+import androidx.compose.runtime.*
 import androidx.compose.ui.window.ApplicationScope
 import androidx.compose.ui.window.application
 import com.abdownloadmanager.desktop.AppArguments
@@ -18,27 +13,26 @@ import com.abdownloadmanager.desktop.pages.about.ShowAboutDialog
 import com.abdownloadmanager.desktop.pages.addDownload.ShowAddDownloadDialogs
 import com.abdownloadmanager.desktop.pages.batchdownload.BatchDownloadWindow
 import com.abdownloadmanager.desktop.pages.category.ShowCategoryDialogs
+import com.abdownloadmanager.desktop.pages.checksum.FileChecksumWindow
 import com.abdownloadmanager.desktop.pages.confirmexit.ConfirmExit
 import com.abdownloadmanager.desktop.pages.credits.translators.ShowTranslators
+import com.abdownloadmanager.desktop.pages.downloaderror.DownloadErrorDialog
 import com.abdownloadmanager.desktop.pages.editdownload.EditDownloadWindow
 import com.abdownloadmanager.desktop.pages.enterurl.EnterNewDownloadWindow
 import com.abdownloadmanager.desktop.pages.extenallibs.ShowOpenSourceLibraries
-import com.abdownloadmanager.desktop.pages.checksum.FileChecksumWindow
-import com.abdownloadmanager.desktop.pages.downloaderror.DownloadErrorDialog
 import com.abdownloadmanager.desktop.pages.home.HomeWindow
 import com.abdownloadmanager.desktop.pages.newQueue.NewQueueDialog
 import com.abdownloadmanager.desktop.pages.perhostsettings.PerHostSettingsWindow
+import com.abdownloadmanager.desktop.pages.poweractionalert.PowerActionAlert
 import com.abdownloadmanager.desktop.pages.queue.QueuesWindow
 import com.abdownloadmanager.desktop.pages.settings.FontManager
 import com.abdownloadmanager.desktop.pages.settings.SettingWindow
-import com.abdownloadmanager.shared.ui.theme.ThemeManager
-import com.abdownloadmanager.desktop.pages.poweractionalert.PowerActionAlert
 import com.abdownloadmanager.desktop.pages.singleDownloadPage.ShowDownloadDialogs
 import com.abdownloadmanager.desktop.pages.updater.ShowUpdaterDialog
 import com.abdownloadmanager.desktop.ui.configurable.comon.CommonConfigurableRenderersForDesktop
 import com.abdownloadmanager.desktop.ui.configurable.platform.PlatformConfigurableRenderersForDesktop
-import com.abdownloadmanager.desktop.ui.widget.Tray
 import com.abdownloadmanager.desktop.ui.widget.ShowMessageDialogs
+import com.abdownloadmanager.desktop.ui.widget.Tray
 import com.abdownloadmanager.desktop.utils.AppInfo
 import com.abdownloadmanager.desktop.utils.GlobalAppExceptionHandler
 import com.abdownloadmanager.desktop.utils.ProvideGlobalExceptionHandler
@@ -47,6 +41,7 @@ import com.abdownloadmanager.shared.ui.ProvideCommonSettings
 import com.abdownloadmanager.shared.ui.ProvideSizeUnits
 import com.abdownloadmanager.shared.ui.configurable.ConfigurableRendererRegistry
 import com.abdownloadmanager.shared.ui.theme.ABDownloaderTheme
+import com.abdownloadmanager.shared.ui.theme.ThemeManager
 import com.abdownloadmanager.shared.ui.widget.NotificationManager
 import com.abdownloadmanager.shared.ui.widget.ProvideLanguageManager
 import com.abdownloadmanager.shared.ui.widget.ProvideNotificationManager
@@ -97,6 +92,7 @@ object Ui : KoinComponent {
             )
         }
     }
+
     fun start(
         globalAppExceptionHandler: GlobalAppExceptionHandler,
     ) {
@@ -111,31 +107,12 @@ object Ui : KoinComponent {
             ) {
                 HandleEffectsForApp(appComponent)
                 SystemTray(appComponent)
-                val showHomeSlot =
-                    appComponent.showHomeSlot.collectAsState().value
-                showHomeSlot.child?.instance?.let {
-                    HomeWindow(it, appComponent::closeHome)
-                }
-                val showSettingSlot =
-                    appComponent.showSettingSlot.collectAsState().value
-                showSettingSlot.child?.instance?.let {
-                    SettingWindow(it, appComponent::closeSettings)
-                }
-                val showQueuesSlot =
-                    appComponent.showQueuesSlot.collectAsState().value
-                showQueuesSlot.child?.instance?.let {
-                    QueuesWindow(it)
-                }
-                val batchDownloadSlot =
-                    appComponent.batchDownloadSlot.collectAsState().value
-                batchDownloadSlot.child?.instance?.let {
-                    BatchDownloadWindow(it)
-                }
-                val editDownloadSlot =
-                    appComponent.editDownloadSlot.collectAsState().value
-                editDownloadSlot.child?.instance?.let {
-                    EditDownloadWindow(it)
-                }
+
+                HomeWindow(appComponent)
+                Settin
```

---

### Incident Patch 4: `db9ffad7` (2026-08-06)
**Commit Message**: Fix typo in error message for unsupported distro (#1364)

**File**: `scripts/install.sh` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ detect_package_manager() {
     elif [ -f /etc/debian_version ]; then
         local OS=Debian
     else
-        logger error "Your Linux Distro is not Supperted."
+        logger error "Your Linux Distro is not Supported."
         logger error "Please install ${DEPENDENCIES[@]} Manually."
         exit 1
     fi
```

---

### Incident Patch 5: `9b70eccf` (2026-07-24)
**Commit Message**: fix some cli commands

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/cli/nativemessaging/install/NativeMessagingInstallCommand.kt` (modified, +2/-5)
```diff
@@ -1,19 +1,16 @@
 package com.abdownloadmanager.desktop.cli.nativemessaging.install
 
 import com.abdownloadmanager.desktop.nativemessaging.NativeMessaging
-import com.abdownloadmanager.desktop.nativemessaging.host.NativeMessagingHostLauncher
 import com.github.ajalt.clikt.command.SuspendingCliktCommand
-import com.github.ajalt.clikt.core.Abort
 import com.github.ajalt.clikt.core.Context
-import com.github.ajalt.clikt.core.PrintCompletionMessage
-import com.github.ajalt.clikt.core.PrintMessage
+import kotlinx.serialization.json.Json
 
 class NativeMessagingInstallCommand : SuspendingCliktCommand(
     "install"
 ) {
     override fun help(context: Context): String = "Installs the native messaging host manifest file"
 
     override suspend fun run() {
-        NativeMessaging.getDefault().installManifests()
+        NativeMessaging.getDefault(Json).installManifests()
     }
 }
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/cli/nativemessaging/uninstall/NativeMessagingUninstallCommand.kt` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@ import com.abdownloadmanager.desktop.nativemessaging.NativeMessaging
 import com.abdownloadmanager.desktop.nativemessaging.host.NativeMessagingHostLauncher
 import com.github.ajalt.clikt.command.SuspendingCliktCommand
 import com.github.ajalt.clikt.core.Context
+import kotlinx.serialization.json.Json
 
 class NativeMessagingUninstallCommand : SuspendingCliktCommand(
     "uninstall"
@@ -13,6 +14,6 @@ class NativeMessagingUninstallCommand : SuspendingCliktCommand(
     override fun help(context: Context): String = "Uninstalls the native messaging host manifest file"
 
     override suspend fun run() {
-        NativeMessaging.getDefault().uninstallManifests()
+        NativeMessaging.getDefault(Json).uninstallManifests()
     }
 }
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/di/Di.kt` (modified, +1/-1)
```diff
@@ -477,7 +477,7 @@ val startUpModule = module {
 }
 val nativeMessagingModule = module {
     single<NativeMessaging> {
-        NativeMessaging.getDefault()
+        NativeMessaging.getDefault(get())
     }
 }
 
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/nativemessaging/NativeMessaging.kt` (modified, +4/-2)
```diff
@@ -2,9 +2,11 @@ package com.abdownloadmanager.desktop.nativemessaging
 
 import com.abdownloadmanager.desktop.utils.AppInfo
 import com.abdownloadmanager.shared.util.SharedConstants
+import io.ktor.util.Platform
 import ir.amirab.util.logger.thisLogger
 import kotlinx.serialization.SerialName
 import kotlinx.serialization.Serializable
+import kotlinx.serialization.json.Json
 
 data class NativeMessagingManifests(
     val firefoxNativeMessagingManifest: FirefoxNativeMessagingManifest,
@@ -97,8 +99,8 @@ class NativeMessaging(
     }
 
     companion object {
-        fun getDefault(): NativeMessaging {
-            return NativeMessaging(NativeMessagingManifestApplier.getForCurrentPlatform())
+        fun getDefault(json: Json): NativeMessaging {
+            return NativeMessaging(NativeMessagingManifestApplier.getForCurrentPlatform(json))
         }
     }
 }
```

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/nativemessaging/NativeMessagingManifestApplier.kt` (modified, +34/-21)
```diff
@@ -5,16 +5,17 @@ import com.abdownloadmanager.desktop.utils.AppProperties
 import com.abdownloadmanager.desktop.utils.isAppInstalled
 import ir.amirab.util.createParentDirectories
 import ir.amirab.util.deleteIfExists
-import ir.amirab.util.platform.Platform
 import ir.amirab.util.desktop.WindowsRegistry
+import ir.amirab.util.platform.Platform
 import ir.amirab.util.writeText
 import kotlinx.serialization.json.Json
 import org.koin.core.component.KoinComponent
-import org.koin.core.component.inject
-import kotlin.io.path.*
+import kotlin.io.path.Path
+import kotlin.io.path.createParentDirectories
+import kotlin.io.path.deleteIfExists
+import kotlin.io.path.writeText
 
-abstract class NativeMessagingManifestApplier : KoinComponent {
-    protected val json by inject<Json>()
+abstract class NativeMessagingManifestApplier(val json: Json) : KoinComponent {
     protected inline fun <reified T : Any> serialize(data: T): String {
         return json.encodeToString(data)
     }
@@ -27,21 +28,21 @@ abstract class NativeMessagingManifestApplier : KoinComponent {
     abstract fun removeManifests()
 
     companion object {
-        fun getForCurrentPlatform(): NativeMessagingManifestApplier {
-            if (!AppInfo.isAppInstalled()){
-                return NoOpNativeMessagingApplier()
+        fun getForCurrentPlatform(json: Json): NativeMessagingManifestApplier {
+            if (!AppInfo.isAppInstalled()) {
+                return NoOpNativeMessagingApplier(json)
             }
-            return when(AppInfo.platform){
-                Platform.Desktop.Linux -> LinuxNativeMessagingManifestApplier()
-                Platform.Desktop.MacOS -> MacosNativeMessagingManifestApplier()
-                Platform.Desktop.Windows -> WindowsNativeMessagingManifestApplier()
+            return when (AppInfo.platform) {
+                Platform.Desktop.Linux -> LinuxNativeMessagingManifestApplier(json)
+                Platform.Desktop.MacOS -> MacosNativeMessagingManifestApplier(json)
+                Platform.Desktop.Windows -> WindowsNativeMessagingManifestApplier(json)
                 Platform.Android -> error("there is no native messaging for android so this code should never used in android")
             }
         }
     }
 }
 
-class WindowsNativeMessagingManifestApplier : NativeMessagingManifestApplier() {
+class WindowsNativeMessagingManifestApplier(json: Json) : NativeMessagingManifestApplier(json) {
     private val baseNativeMessagingDir get() = AppInfo.definedPaths.configDir / "native_messaging"
     private val firefoxManifestFile get() = baseNativeMessagingDir / "firefox" / "${AppInfo.packageName}.json"
     private val chromeManifestFile get() = baseNativeMessagingDir / "chrome" / "${AppInfo.packageName}.json"
@@ -82,22 +83,26 @@ class WindowsNativeMessagingManifestApplier : NativeMessagingManifestApplier() {
 
 }
 
-class MacosNativeMessagingManifestApplier : NativeMessagingManifestApplier() {
+class MacosNativeMessagingManifestApplier(
+    json: Json
+) : NativeMessagingManifestApplier(json) {
     private val firefoxNativeMessagingPath
-        get() = Path(AppProperties.userDir, "Library/Application Support/Mozilla/NativeMessagingHosts",
+        get() = Path(
+            AppProperties.userDir, "Library/Application Support/Mozilla/NativeMessagingHosts",
             "${AppInfo.packageName}.json"
         )
     private val chromeNativeMessagingPath
-        get() = Path(AppProperties.userDir, "Library/Application Support/Google/Chrome/NativeMessagingHosts",
+        get() = Path(
+            AppProperties.userDir, "Library/Application Support/Google/Chrome/NativeMessagingHosts",
             "${AppInfo.packageName}.json"
         )
     private val chromiumNativeMessagingPath
-        get() = Path(AppProperties.userDir, "Library/Application Support/Chromium/NativeMessagingHosts",
+        get() = Path(
+            AppProperties.userDir, "Library/Application Support/Chromium/NativeMessagingHosts",
             "${AppInfo.packageName}.json"
         )
 
 
-
     override fun updateManifests(manifests: NativeMessagingManifests) {
         listOf(
             firefoxNativeMessagingPath,
@@ -106,7 +111,7 @@ class MacosNativeMessagingManifestApplier : NativeMessagingManifestApplier() {
         ).forEach { it.createParentDirectories() }
 
         firefoxNativeMessagingPath.writeText(serialize(manifests.firefoxNativeMessagingManifest))
-        val chromeManifestString=serialize(manifests.chromeNativeMessagingManifest)
+        val chromeManifestString = serialize(manifests.chromeNativeMessagingManifest)
         chromeNativeMessagingPath.writeText(chromeManifestString)
         chromiumNativeMessagingPath.writeText(chromeManifestString)
     }
@@ -118,7 +123,11 @@ class MacosNativeMessagingManifestApplier : NativeMessagingManifestApplier() {
     }
 }
 
-class LinuxNativeMessagingManifestApplier : NativeMessagingManifestApplier() {
+class LinuxNativeMessagingManifestApplier(
+    json: Json
+) :
```

---

### Incident Patch 6: `148d18b8` (2026-06-21)
**Commit Message**: fix vertical/horizontal mouse hover icon (#1287)

**File**: `shared/app/src/desktopMain/kotlin/com/abdownloadmanager/shared/ui/modifier/PointerHoverIcon.desktop.kt` (modified, +2/-2)
```diff
@@ -27,8 +27,8 @@ private fun MyPointerHoverIcon.toDesktopIcon(): PointerIcon {
 }
 
 private object MyDesktopCursors {
-    val horizontalResize = pointerIconFromCursorInt(Cursor.S_RESIZE_CURSOR)
-    val verticalResize = pointerIconFromCursorInt(Cursor.E_RESIZE_CURSOR)
+    val horizontalResize = pointerIconFromCursorInt(Cursor.E_RESIZE_CURSOR)
+    val verticalResize = pointerIconFromCursorInt(Cursor.S_RESIZE_CURSOR)
 
     private fun pointerIconFromCursorInt(
         cursorInt: Int
```

---

### Incident Patch 7: `6dce89f2` (2026-06-20)
**Commit Message**: update bug report issue template and CONTRIBUTING.md

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +3/-1)
```diff
@@ -7,7 +7,9 @@ body:
     attributes:
       value: |
         Thank you for taking the time to report a bug!
-        **Before submitting, please [search the existing issues](./issues) to make sure this is not a duplicate.**
+        ### Before submitting
+        - Search the existing [issues](./issues) to check whether this has already been reported.
+        - Read the [Contributing guidelines](./blob/master/CONTRIBUTING.md#bug-reports) for bug reporting requirements.
   - type: textarea
     id: description
     attributes:
```

**File**: `CONTRIBUTING.md` (modified, +14/-0)
```diff
@@ -15,6 +15,20 @@ I welcome the following types of contributions:
 
 - **Pull Requests**: If you’d like to contribute code, feel free to submit a pull request. Just make sure to read the guidelines below before you start.
 
+## Bug Reports
+
+#### Before opening an issue:
+
+- Make sure you are using the [latest version](https://github.com/amir1376/ab-download-manager/releases/latest).
+- Search existing issues.
+- Include steps to reproduce the problem.
+- Include logs when applicable.
+
+#### After opening an issue:
+
+- If you find the cause of the issue, share it before closing the issue. Documenting solutions helps other users,
+  reduces duplicate reports, and saves everyone time.
+
 ## Translations
 
 If you’d like to help translate AB Download Manager into another language, or improve existing translations, you can do
```

---

### Incident Patch 8: `4b3ce773` (2026-06-19)
**Commit Message**: chore: update composeNativeTray version and fix macOS tray icon size (#1279)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ proxyVole = "2.0.1"
 jbrApi = "1.10.1"
 gradleVersions = "0.53.0"
 handlebars = "4.5.0"
-composeNativeTray = "1.3.0"
+composeNativeTray = "1.3.3"
 autoServiceKsp = "1.2.0"
 autoService = "1.1.1"
 kermit = "2.1.0"
```

---

### Incident Patch 9: `d2741745` (2026-06-10)
**Commit Message**: log crash on app startup

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/App.kt` (modified, +0/-2)
```diff
@@ -19,8 +19,6 @@ import ir.amirab.util.logger.AppLogger
 import ir.amirab.util.logger.appLogger
 import ir.amirab.util.writeText
 import kotlinx.coroutines.runBlocking
-import okio.FileSystem
-import okio.Path.Companion.toPath
 import org.koin.core.component.KoinComponent
 import org.koin.core.component.inject
 import kotlin.system.exitProcess
```

---

### Incident Patch 10: `2b7fcae7` (2026-06-10)
**Commit Message**: add crash log file path and log stack trace on app startup failure

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/App.kt` (modified, +1/-0)
```diff
@@ -108,6 +108,7 @@ fun main(args: Array<String>) {
         appLogger.e(throwable = e) { "Fail to start the ${AppInfo.displayName} app because:" }
         System.err.println("Fail to start the ${AppInfo.displayName} app because:")
         e.printStackTrace()
+        AppInfo.definedPaths.crashLogFile.writeText(e.stackTraceToString())
         exitProcess(-1)
     }
 }
```

**File**: `shared/app/src/commonMain/kotlin/com/abdownloadmanager/shared/util/DefinedPaths.kt` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ abstract class DefinedPaths(
     val systemDir: Path = dataDir.resolve("system")
     val updateDir: Path = systemDir.resolve("update")
     val logDir: Path = systemDir.resolve("log")
+    val crashLogFile: Path = logDir.resolve("crash.log")
     val pagesStateDir: Path = configDir.resolve("pages")
     val optionsDir: Path = configDir.resolve("options")
     val downloadDbDir: Path = configDir.resolve("download_db")
```

---

### Incident Patch 11: `918ac64f` (2026-05-09)
**Commit Message**: fix a bug in DesktopSystemThemeDetector

**File**: `shared/app/src/desktopMain/kotlin/com/abdownloadmanager/shared/util/PlatformThemeDetector.desktop.kt` (modified, +2/-1)
```diff
@@ -6,6 +6,7 @@ import kotlinx.coroutines.channels.awaitClose
 import kotlinx.coroutines.flow.callbackFlow
 import kotlinx.coroutines.flow.emitAll
 import kotlinx.coroutines.flow.flow
+import java.util.function.Consumer
 
 actual typealias PlatformThemeDetector = DesktopSystemThemeDetector
 
@@ -18,7 +19,7 @@ class DesktopSystemThemeDetector : ISystemThemeDetector {
     private val detector by lazy { OsThemeDetector.getDetector() }
 
     private val isSystemDarkFlowByLibrary = callbackFlow<Boolean> {
-        val listener: (Boolean) -> Unit = { isDark: Boolean ->
+        val listener = Consumer<Boolean> { isDark: Boolean ->
             trySend(isDark)
         }
         detector.registerListener(listener)
```

---

### Incident Patch 12: `d6721eea` (2026-04-23)
**Commit Message**: fix initially maximized home window bug (#1185)

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/home/HomeWindow.kt` (modified, +11/-5)
```diff
@@ -6,12 +6,15 @@ import androidx.compose.ui.Alignment
 import androidx.compose.ui.window.WindowPlacement
 import androidx.compose.ui.window.WindowPosition
 import androidx.compose.ui.window.rememberWindowState
-import com.abdownloadmanager.shared.util.LocalShortCutManager
+import com.abdownloadmanager.desktop.utils.AppInfo
 import com.abdownloadmanager.desktop.window.custom.CustomWindow
 import com.abdownloadmanager.desktop.window.custom.rememberWindowController
-import com.abdownloadmanager.shared.util.ui.icon.MyIcons
-import com.abdownloadmanager.desktop.utils.AppInfo
+import com.abdownloadmanager.shared.util.LocalShortCutManager
 import com.abdownloadmanager.shared.util.mvi.HandleEffects
+import com.abdownloadmanager.shared.util.ui.icon.MyIcons
+import kotlinx.coroutines.flow.distinctUntilChanged
+import kotlinx.coroutines.flow.launchIn
+import kotlinx.coroutines.flow.onEach
 import java.awt.Dimension
 
 @Composable
@@ -53,8 +56,11 @@ fun HomeWindow(
                     homeComponent.setWindowSize(windowState.size)
                 }
             }
-            LaunchedEffect(windowState.placement) {
-                homeComponent.setIsMaximized(windowState.placement == WindowPlacement.Maximized)
+            LaunchedEffect(windowState) {
+                snapshotFlow { windowState.placement }
+                    .onEach {
+                        homeComponent.setIsMaximized(windowState.placement == WindowPlacement.Maximized)
+                    }.launchIn(this)
             }
             window.minimumSize = Dimension(
                 400, 400
```

---

### Incident Patch 13: `d641fcc0` (2026-04-23)
**Commit Message**: fix show part info not showing automatically if it was shown last time (#1183)

**File**: `shared/app/src/commonMain/kotlin/com/abdownloadmanager/shared/singledownloadpage/BaseSingleDownloadComponent.kt` (modified, +7/-2)
```diff
@@ -138,8 +138,13 @@ abstract class BaseSingleDownloadComponent<
             }.launchIn(scope)
     }
 
-    private val _showPartInfo = MutableStateFlow(defaultShowPartInfo)
-    val showPartInfo = _showPartInfo.asStateFlow()
+    private val _showPartInfo by lazy {
+        // I make it lazy because [defaultShowPartInfo] is an open val, overridden properties won't apply in supper class initialization which makes our logic buggy
+        MutableStateFlow(defaultShowPartInfo)
+    }
+    val showPartInfo by lazy {
+        _showPartInfo.asStateFlow()
+    }
     open fun setShowPartInfo(value: Boolean) {
         _showPartInfo.value = value
     }
```

---

### Incident Patch 14: `5ee92ecf` (2026-02-26)
**Commit Message**: change quit shortcut (#1125)

**File**: `desktop/app/src/main/kotlin/com/abdownloadmanager/desktop/pages/home/HomeComponent.kt` (modified, +1/-1)
```diff
@@ -410,7 +410,7 @@ class HomeComponent(
         "$metaKey V" to newDownloadFromClipboardAction
         "$metaKey C" to downloadActions.copyDownloadLinkAction
         "$metaKey alt S" to gotoSettingsAction
-        "$metaKey W" to requestExitAction
+        "$metaKey Q" to requestExitAction
         "$metaKey O" to downloadActions.openFileAction
         "$metaKey F" to downloadActions.openFolderAction
         "$metaKey E" to downloadActions.editDownloadAction
```

#### Recent Merged Pull Requests:
- **PR #1450** (closed): [Feat] Add monet theming for android (@soymadip)
- **PR #1447** (2026-10-01): feat: add date started and date finished to the download list table for desktop (@amir1376)
- **PR #1445** (2026-09-30): feat: show selected item info including selected count and content size (@amir1376)
- **PR #1444** (closed): fix DetachedLauncher not working on macOS (@amir1376)
- **PR #1434** (2026-10-01): fix(macos): detach the app with a bundled setsid helper (@MohammedSaud404)
- **PR #1432** (2026-09-23): fix: create windows with their title already set (@dagimg-dot)
- **PR #1409** (2026-09-08): use non-strict settings for SchemaKt (@amir1376)
- **PR #1406** (2026-09-07): an option to save download location on add new download (@amir1376)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
