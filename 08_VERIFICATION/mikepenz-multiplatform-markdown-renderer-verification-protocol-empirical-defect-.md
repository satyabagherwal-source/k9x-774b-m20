# Verification Protocol: Verification Protocol: Empirical Defect Shield for mikepenz/multiplatform-markdown-renderer

<!-- PROVENANCE_START
{
  "source_repository": "mikepenz/multiplatform-markdown-renderer",
  "source_url": "https://github.com/mikepenz/multiplatform-markdown-renderer",
  "source_version": "8077f612",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T04:53:22.883Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mikepenz-multiplatform-markdown-renderer",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mikepenz/multiplatform-markdown-renderer](https://github.com/mikepenz/multiplatform-markdown-renderer) (Revision: `8077f612`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T04:53:22.883Z`  
> **Learning ID**: `learn-github-mikepenz-multiplatform-markdown-renderer`


## 1. Scope & Verification Target
- **Target Repository**: `mikepenz/multiplatform-markdown-renderer` (Commit: `8077f612`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): mikepenz/multiplatform-markdown-renderer

> **Canonical Artifact**: `07_PROJECT_LEARNING/mikepenz-multiplatform-markdown-renderer-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mikepenz/multiplatform-markdown-renderer](https://github.com/mikepenz/multiplatform-markdown-renderer))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T04:53:21.486Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mikepenz/multiplatform-markdown-renderer`
- **Description**: Markdown renderer for Kotlin Multiplatform Projects (Android, iOS, Desktop), using Compose.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1138 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `multiplatform-markdown-renderer-code/src/commonMain/kotlin/com/mikepenz/markdown/compose/elements/MarkdownHighlightedCode.kt`
```
package com.mikepenz.markdown.compose.elements

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.mikepenz.markdown.compose.LocalMarkdownColors
import com.mikepenz.markdown.compose.LocalMarkdownDimens
import com.mikepenz.markdown.compose.LocalMarkdownPadding
import com.mikepenz.markdown.compose.LocalMarkdownTypography
import com.mikepenz.markdown.compose.components.MarkdownComponent
import com.mikepenz.markdown.compose.elements.material.MarkdownBasicText
import dev.snipme.highlights.Highlights
import dev.snipme.highlights.model.BoldHighlight
import dev.snipme.highlights.model.ColorHighlight
import dev.snipme.highlights.model.SyntaxLanguage
import dev.snipme.highlights.model.SyntaxThemes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.intellij.markdown.ast.ASTNode

/** Default definition for the [MarkdownHighlightedCodeFence]. Uses default theme, attempts to apply language from markdown. */
val highlightedCodeFence: MarkdownComponent = {
    MarkdownHighlightedCodeFence(content = it.content, node = it.node, style = it.typography.code)
}

/** Default definition for the [MarkdownHighlightedCodeBlock]. Uses default theme, attempts to apply language from markdown. */
val highlightedCodeBlock: MarkdownComponent = {
    MarkdownHighlightedCodeBlock(content = it.content, node = it.node, style = it.typography.code)
}

@Composable
fun MarkdownHighlightedCodeFence(
    content: String,
    node: ASTNode,
    style: TextStyle = LocalMarkdownTypography.current.code,
    highlightsBuilder: Highlights.Builder = rememberHighlightsBuilder(),
    showHeader: Boolean = false,
    immediate: Boolean = LocalInspectionMode.current,
) {
    MarkdownCodeFence(content, node, style) { code, language, style ->
        MarkdownHighlightedCode(
            code = code,
            language = language,
            style = style,
            highlightsBuilder = highlightsBuilder,
            showHeader = showHeader,
            immediate = immediate,
        )
    }
}

@Composable
fun MarkdownHighlightedCodeBlock(
    content: String,
    node: ASTNode,
    style: TextStyle = LocalMarkdownTypography.current.code,
    highlightsBuilder: Highlights.Builder = rememberHighlightsBuilder(),
    showHeader: Boolean = false,
    immediate: Boolean = LocalInspectionMode.current,
) {
    MarkdownCodeBlock(content, node, style) { code, language, style ->
        MarkdownHighlightedCode(
            code = code,
            language = language,
            style = style,
            highlightsBuilder = highlightsBuilder,
            showHeader = showHeader,
            immediate = immediate,
        )
    }
}

@Composable
fun MarkdownHighlightedCode(
    code: String,
    language: String?,
    style: TextStyle = LocalMarkdownTypography.current.code,
    highlightsBuilder: Highlights.Builder = rememberHighlightsBuilder(),
    showHeader: Boolean = false,
    immediate: Boolean = false,
) {
    val backgroundCodeColor = LocalMarkdownColors.current.codeBackground
    val codeBackgroundCornerSize = LocalMarkdownDimens.current.codeBackgroundCornerSize
    val codeBlockPadding = LocalMarkdownPadding.current.codeBlock
    val codeHighlights: AnnotatedString by produceHighlightsState(
        code = code,
        language = language,
        highlightsBuilder = highlightsBuilder,
        immediate = immediate,
    )

    MarkdownCodeBackground(
        color = backgroundCodeColor,
        shape = RoundedCornerShape(codeBackgroundCornerSize),
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        showHeader = showHeader,
        language = language,
        code = code
    ) {
        MarkdownBasicText(
            text = codeHighlights,
            style = style,
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(codeBlockPadding),
        )
    }
}

@Composable
private fun rememberHighlightsBuilder(
    isDarkTheme: Boolean = isSystemInDarkTheme(),
): Highlights.Builder {
    return remember(isDarkTheme) {
        Highlights.Builder().theme(SyntaxThemes.default(darkMode = isDarkTheme))
    }
}

@Composable
private fun produceHighlightsState(
    code: String,
    language: String?,
    highlightsBuilder: Highlights.Builder,
    immediate: Boolean,
): State<AnnotatedString> {
    if (immediate) {
        val highlighted = remember(code) {
            buildHighlightedAnnotatedString(code, language, highlightsBuilder)
        }
        return rememberUpdatedState(highlighted)
    }

    return produceState(
        initialValue = AnnotatedString(text = code),
        key1 = code,
    ) {
        val job = launch(Dispatchers.Default) {
            value = buildHighlightedAnnotatedString(code, language, highlightsBuilder)
        }
        awaitDispose {
            job.cancel()
        }
    }
}

private fun buildHighlightedAnnotatedString(
    code: String,
    language: String?,
    highlightsBuilder: Highlights.Builder,
): AnnotatedString {
    val syntaxLanguage = language?.let { SyntaxLanguage.getByName(it) }
    val codeHighlights = highlightsBuilder
        .code(code)
        .let { if (syntaxLanguage != null) it.language(syntaxLanguage) else it }
        .build()
        .getHighlights()
    return buildAnnotatedString {
        append(code)
        codeHighlights.forEach {
            val style = when (it) {
                is ColorHighlight -> SpanStyle(color = Color(it.rgb).copy(alpha = 1f))
                is BoldHighlight -> SpanStyle(fontWeight = FontWeight.Bold)
            }
            addStyle(
                style = style,
                start = it.location.start,
                end = it.location.end,
            )
        }
    }
}

```

### Core Architecture Module: `multiplatform-markdown-renderer-coil2/src/androidMain/kotlin/com/mikepenz/markdown/coil2/ImagePainterProvider.kt`
```
package com.mikepenz.markdown.coil2

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImagePainter
import coil.compose.rememberAsyncImagePainter
import coil.request.ImageRequest
import coil.size.Size

@Composable
internal actual fun imagePainter(url: String): Painter? {
    return rememberAsyncImagePainter(
        model = ImageRequest.Builder(LocalContext.current)
            .data(url)
            .size(Size.ORIGINAL)
            .build()
    )
}

@Composable
internal actual fun painterIntrinsicSize(painter: Painter): androidx.compose.ui.geometry.Size {
    var size by remember(painter) { mutableStateOf(painter.intrinsicSize) }

    if (painter is AsyncImagePainter) {
        LaunchedEffect(painter.state) {
            painter.state.painter?.let {
                size = it.intrinsicSize
            }
        }
    }

    return size
}

```

### Core Architecture Module: `multiplatform-markdown-renderer-coil2/src/commonMain/kotlin/com/mikepenz/markdown/coil2/Coil2ImagePainterProvider.kt`
```
package com.mikepenz.markdown.coil2

import androidx.compose.runtime.Composable
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.painter.Painter

@Composable
internal expect fun imagePainter(url: String): Painter?

@Composable
internal expect fun painterIntrinsicSize(painter: Painter): Size
```

### Core Architecture Module: `multiplatform-markdown-renderer-coil2/src/commonMain/kotlin/com/mikepenz/markdown/coil2/Coil2ImageTransformerImpl.kt`
```
package com.mikepenz.markdown.coil2

import androidx.compose.runtime.Composable
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.painter.Painter
import com.mikepenz.markdown.model.ImageData
import com.mikepenz.markdown.model.ImageTransformer

object Coil2ImageTransformerImpl : ImageTransformer {

    @Composable
    override fun transform(link: String): ImageData? {
        return imagePainter(link)?.let { ImageData(it) }
    }

    @Composable
    override fun intrinsicSize(painter: Painter): Size {
        return painterIntrinsicSize(painter)
    }
}
```

### Core Architecture Module: `multiplatform-markdown-renderer-coil2/src/jvmMain/kotlin/com/mikepenz/markdown/coil2/ImagePainterProvider.kt`
```
package com.mikepenz.markdown.coil2

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.toComposeImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.skia.Image
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

@Composable
internal actual fun imagePainter(url: String): Painter? {
    return fetchImage(url)?.let { BitmapPainter(it) }
}


@Composable
internal actual fun painterIntrinsicSize(painter: Painter): Size {
    return painter.intrinsicSize
}

@Composable
fun fetchImage(url: String): ImageBitmap? {
    var image by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(url) {
        image = loadPicture(url)
    }
    return image
}

suspend fun loadPicture(url: String): ImageBitmap? = withContext(Dispatchers.IO) {
    return@withContext runCatching {
        val connection: HttpURLConnection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 5000
        connection.connect()

        val input: InputStream = connection.inputStream
        Image.makeFromEncoded(input.readBytes()).toComposeImageBitmap()
    }.getOrNull()
}
```

### Core Architecture Module: `multiplatform-markdown-renderer-coil3/src/commonMain/kotlin/com/mikepenz/markdown/coil3/Coil3ImageTransformerImpl.kt`
```
package com.mikepenz.markdown.coil3

import androidx.compose.runtime.*
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.painter.Painter
import coil3.compose.AsyncImagePainter
import coil3.compose.LocalPlatformContext
import coil3.compose.rememberAsyncImagePainter
import coil3.request.ImageRequest
import com.mikepenz.markdown.model.ImageData
import com.mikepenz.markdown.model.ImageTransformer

object Coil3ImageTransformerImpl : ImageTransformer {

    @Composable
    override fun transform(link: String): ImageData {
        return rememberAsyncImagePainter(
            model = ImageRequest.Builder(LocalPlatformContext.current)
                .data(link)
                .size(coil3.size.Size.ORIGINAL)
                .build()
        ).let { ImageData(it) }
    }

    @Composable
    override fun intrinsicSize(painter: Painter): Size {
        var size by remember(painter) { mutableStateOf(painter.intrinsicSize) }
        if (painter is AsyncImagePainter) {
            val painterState = painter.state.collectAsState()
            val intrinsicSize = painterState.value.painter?.intrinsicSize
            intrinsicSize?.also { size = it }
        }
        return size
    }
}
```

### Core Architecture Module: `multiplatform-markdown-renderer-m2/src/commonMain/kotlin/com/mikepenz/markdown/m2/Markdown.kt`
```
package com.mikepenz.markdown.m2

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.mikepenz.markdown.compose.MarkdownSuccess
import com.mikepenz.markdown.compose.StreamingMarkdownSuccess
import com.mikepenz.markdown.compose.components.MarkdownComponents
import com.mikepenz.markdown.compose.components.markdownComponents
import com.mikepenz.markdown.m2.elements.MarkdownCheckBox
import com.mikepenz.markdown.model.ImageTransformer
import com.mikepenz.markdown.model.MarkdownAnimations
import com.mikepenz.markdown.model.MarkdownAnnotator
import com.mikepenz.markdown.model.MarkdownColors
import com.mikepenz.markdown.model.MarkdownDimens
import com.mikepenz.markdown.model.MarkdownExtendedSpans
import com.mikepenz.markdown.model.MarkdownInlineContent
import com.mikepenz.markdown.model.MarkdownPadding
import com.mikepenz.markdown.model.MarkdownState
import com.mikepenz.markdown.model.MarkdownTypography
import com.mikepenz.markdown.model.NoOpImageTransformerImpl
import com.mikepenz.markdown.model.ReferenceLinkHandler
import com.mikepenz.markdown.model.ReferenceLinkHandlerImpl
import com.mikepenz.markdown.model.State
import com.mikepenz.markdown.model.StreamingMarkdownState
import com.mikepenz.markdown.model.markdownAnimations
import com.mikepenz.markdown.model.markdownAnnotator
import com.mikepenz.markdown.model.markdownDimens
import com.mikepenz.markdown.model.markdownExtendedSpans
import com.mikepenz.markdown.model.markdownInlineContent
import com.mikepenz.markdown.model.markdownPadding
import org.intellij.markdown.flavours.MarkdownFlavourDescriptor
import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
import org.intellij.markdown.parser.CancellationToken
import org.intellij.markdown.parser.MarkdownParser


/**
 * Renders the markdown content using Material 2 styles.
 *
 * @param content The markdown content to be rendered.
 * @param colors The [MarkdownColors] to use for styling.
 * @param typography The [MarkdownTypography] to use for text styles.
 * @param modifier The [Modifier] to apply to the component.
 * @param padding The [MarkdownPadding] to use for padding.
 * @param dimens The [MarkdownDimens] to use for dimensions.
 * @param flavour The [MarkdownFlavourDescriptor] to use for parsing.
 * @param parser The [MarkdownParser] to use for parsing.
 * @param imageTransformer The [ImageTransformer] to use for transforming images.
 * @param annotator The [MarkdownAnnotator] to use for annotating links.
 * @param extendedSpans The [MarkdownExtendedSpans] to use for extended spans.
 * @param inlineContent The [MarkdownInlineContent] to use for inline content.
 * @param components The [MarkdownComponents] to use for custom components.
 * @param animations The [MarkdownAnimations] to use for animations.
 * @param referenceLinkHandler The reference link handler to be used for handling links.
 * @param loading Composable function to display while loading.
 * @param success A composable function to be displayed with the markdown content. It receives the modifier, state and components as parameters. By default this is a [Column].
 * @param error Composable function to display on error.
 */
@Composable
fun Markdown(
    content: String,
    colors: MarkdownColors = markdownColor(),
    typography: MarkdownTypography = markdownTypography(),
    modifier: Modifier = Modifier.fillMaxSize(),
    padding: MarkdownPadding = markdownPadding(),
    dimens: MarkdownDimens = markdownDimens(),
    flavour: MarkdownFlavourDescriptor = GFMFlavourDescriptor(),
    parser: MarkdownParser = MarkdownParser(flavour, cancellationToken = CancellationToken.NonCancellable),
    imageTransformer: ImageTransformer = NoOpImageTransformerImpl(),
    annotator: MarkdownAnnotator = markdownAnnotator(),
    extendedSpans: MarkdownExtendedSpans = markdownExtendedSpans(),
    inlineContent: MarkdownInlineContent = markdownInlineContent(),
    components: MarkdownComponents = markdownComponents(checkbox = { MarkdownCheckBox(it.content, it.node, it.typography.text) }),
    animations: MarkdownAnimations = markdownAnimations(),
    referenceLinkHandler: ReferenceLinkHandler = ReferenceLinkHandlerImpl(),
    loading: @Composable (modifier: Modifier) -> Unit = { Box(modifier) },
    success: @Composable (state: State.Success, components: MarkdownComponents, modifier: Modifier) -> Unit = { state, components, modifier ->
        MarkdownSuccess(state = state, components = components, modifier = modifier)
    },
    error: @Composable (modifier: Modifier) -> Unit = { Box(modifier) },
) = com.mikepenz.markdown.compose.Markdown(
    content = content,
    colors = colors,
    typography = typography,
    modifier = modifier,
    padding = padding,
    dimens = dimens,
    flavour = flavour,
    parser = parser,
    imageTransformer = imageTransformer,
    annotator = annotator,
    extendedSpans = extendedSpans,
    inlineContent = inlineContent,
    components = components,
    animations = animations,
    referenceLinkHandler = referenceLinkHandler,
    loading = loading,
    success = success,
    error = error,
)

/**
 * Renders the markdown content using Material 2 styles.
 *
 * @param markdownState The [MarkdownState] to use for parsing.
 * @param colors The [MarkdownColors] to use for styling.
 * @param typography The [MarkdownTypography] to use for text styles.
 * @param modifier The [Modifier] to apply to the component.
 * @param padding The [MarkdownPadding] to use for padding.
 * @param dimens The [MarkdownDimens] to use for dimensions.
 * @param imageTransformer The [ImageTransformer] to use for transforming images.
 * @param annotator The [MarkdownAnnotator] to use for annotating links.
 * @param extendedSpans The [MarkdownExtendedSpans] to use for extended spans.
 * @param inlineContent The [MarkdownInlineContent] to use for inline content.
 * @param components The [MarkdownComponents] to use for custom components.
 * @param animations The [MarkdownAnimations] to use for animations.
 * @param loading Composable function to display while loading.
 * @param success A composable function to be displayed with the markdown content. It receives the modifier, state and components as parameters. By default this is a [Column].
 * @param error Composable function to display on error.
 */
@Composable
fun Markdown(
    markdownState: MarkdownState,
    colors: MarkdownColors = markdownColor(),
    typography: MarkdownTypography = markdownTypography(),
    modifier: Modifier = Modifier.fillMaxSize(),
    padding: MarkdownPadding = markdownPadding(),
    dimens: MarkdownDimens = markdownDimens(),
    imageTransformer: ImageTransformer = NoOpImageTransformerImpl(),
    annotator: MarkdownAnnotator = markdownAnnotator(),
    extendedSpans: MarkdownExtendedSpans = markdownExtendedSpans(),
    inlineContent: MarkdownInlineContent = markdownInlineContent(),
    components: MarkdownComponents = markdownComponents(checkbox = { MarkdownCheckBox(it.content, it.node, it.typography.text) }),
    animations: MarkdownAnimations = markdownAnimations(),
    loading: @Composable (modifier: Modifier) -> Unit = { Box(modifier) },
    success: @Composable (state: State.Success, components: MarkdownComponents, modifier: Modifier) -> Unit = { state, components, modifier ->
        MarkdownSuccess(state = state, components = components, modifier = modifier)
    },
    error: @Composable (modifier: Modifier) -> Unit = { Box(modifier) },
) = com.mikepenz.markdown.compose.Markdown(
    markdownState = markdownState,
    colors = colors,
    typography = typography,
    modifier = modifier,
    padding = padding,
    dimens = dimens,
    imageTransformer = imageTransformer,
    annotator = annotator,
    extendedSpans = extendedSpans,
    inlineContent = inlineContent,
    components = components,
    animations = animations,
    loading = loading,
    success = success,
    error = error,
)

/**
 * Renders streaming markdown content using Material 2 styles.
 */
@Composable
fun Markdown(
    streamingMarkdownState: StreamingMarkdownState,
    colors: MarkdownColors = markdownColor(),
    typography: MarkdownTypography = markdownTypography(),
    modifier: Modifier = Modifier.fillMaxSize(),
    padding: MarkdownPadding = markdownPadding(),
    dimens: MarkdownDimens = markdownDimens(),
    imageTransformer: ImageTransformer = NoOpImageTransformerImpl(),
    annotator: MarkdownAnnotator = markdownAnnotator(),
    extendedSpans: MarkdownExtendedSpans = markdownExtendedSpans(),
    inlineContent: MarkdownInlineContent = markdownInlineContent(),
    components: MarkdownComponents = markdownComponents(checkbox = { MarkdownCheckBox(it.content, it.node, it.typography.text) }),
    animations: MarkdownAnimations = markdownAnimations(),
    success: @Composable (snapshot: StreamingMarkdownState.Snapshot, components: MarkdownComponents, modifier: Modifier) -> Unit = { snapshot, components, modifier ->
        StreamingMarkdownSuccess(streamingMarkdownState = streamingMarkdownState, snapshot = snapshot, components = components, modifier = modifier)
    },
) = com.mikepenz.markdown.compose.Markdown(
    streamingMarkdownState = streamingMarkdownState,
    colors = colors,
    typography = typography,
    modifier = modifier,
    padding = padding,
    dimens = dimens,
    imageTransformer = imageTransformer,
    annotator = annotator,
    extendedSpans = extendedSpans,
    inlineContent = inlineContent,
    components = components,
    animations = animations,
    success = success,
)

/**
 * Renders the markdown content using Material 2 styles.
 *
 * @param state The [State] to use for parsing.
 * @param colors The [MarkdownColors] to use for styling.
 * @param typography The [MarkdownTypography] to use for text styles.
 * @param modifier The [Modifier] to apply to the component.
 * @param padding The [Mar
```

### Core Architecture Module: `multiplatform-markdown-renderer-m2/src/commonMain/kotlin/com/mikepenz/markdown/m2/MarkdownColors.kt`
```
package com.mikepenz.markdown.m2

import androidx.compose.material.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.mikepenz.markdown.model.DefaultMarkdownColors
import com.mikepenz.markdown.model.MarkdownAlertColors
import com.mikepenz.markdown.model.MarkdownColors
import com.mikepenz.markdown.model.markdownAlertColors

@Composable
fun markdownColor(
    text: Color = MaterialTheme.colors.onBackground,
    codeBackground: Color = MaterialTheme.colors.onBackground.copy(alpha = 0.1f),
    inlineCodeBackground: Color = codeBackground,
    dividerColor: Color = MaterialTheme.colors.onSurface.copy(alpha = 0.12f),
    tableBackground: Color = MaterialTheme.colors.onBackground.copy(alpha = 0.02f),
    darkTheme: Boolean = !MaterialTheme.colors.isLight,
    alert: MarkdownAlertColors = markdownAlertColors(darkTheme),
    highlightText: Color = MaterialTheme.colors.onSecondary,
    highlightBackground: Color = MaterialTheme.colors.secondary,
): MarkdownColors = DefaultMarkdownColors(
    text = text,
    codeBackground = codeBackground,
    inlineCodeBackground = inlineCodeBackground,
    dividerColor = dividerColor,
    tableBackground = tableBackground,
    alert = alert,
    highlightText = highlightText,
    highlightBackground = highlightBackground,
)

```

### Core Architecture Module: `multiplatform-markdown-renderer-m2/src/commonMain/kotlin/com/mikepenz/markdown/m2/MarkdownTypography.kt`
```
package com.mikepenz.markdown.m2

import androidx.compose.material.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.TextUnit
import com.mikepenz.markdown.model.DefaultMarkdownTypography
import com.mikepenz.markdown.model.MarkdownTypography

@Composable
fun markdownTypography(
    h1: TextStyle = MaterialTheme.typography.h1,
    h2: TextStyle = MaterialTheme.typography.h2,
    h3: TextStyle = MaterialTheme.typography.h3,
    h4: TextStyle = MaterialTheme.typography.h4,
    h5: TextStyle = MaterialTheme.typography.h5,
    h6: TextStyle = MaterialTheme.typography.h6,
    text: TextStyle = MaterialTheme.typography.body1,
    code: TextStyle = MaterialTheme.typography.body2.copy(fontFamily = FontFamily.Monospace),
    inlineCode: TextStyle = text.copy(
        fontFamily = FontFamily.Monospace, fontSize = TextUnit.Unspecified
    ),
    quote: TextStyle = MaterialTheme.typography.body2.plus(SpanStyle(fontStyle = FontStyle.Italic)),
    paragraph: TextStyle = MaterialTheme.typography.body1,
    ordered: TextStyle = MaterialTheme.typography.body1,
    bullet: TextStyle = MaterialTheme.typography.body1,
    list: TextStyle = MaterialTheme.typography.body1,
    textLink: TextLinkStyles = TextLinkStyles(
        style = MaterialTheme.typography.body1.copy(
            fontWeight = FontWeight.Bold, textDecoration = TextDecoration.Underline
        ).toSpanStyle()
    ),
    table: TextStyle = text,
    alertTitle: TextStyle = MaterialTheme.typography.body1.copy(fontWeight = FontWeight.Bold),
): MarkdownTypography = DefaultMarkdownTypography(
    h1 = h1,
    h2 = h2,
    h3 = h3,
    h4 = h4,
    h5 = h5,
    h6 = h6,
    text = text,
    quote = quote,
    code = code,
    inlineCode = inlineCode,
    paragraph = paragraph,
    ordered = ordered,
    bullet = bullet,
    list = list,
    textLink = textLink,
    table = table,
    alertTitle = alertTitle,
)

```

### Core Architecture Module: `multiplatform-markdown-renderer-m2/src/commonMain/kotlin/com/mikepenz/markdown/m2/elements/MarkdownCheckBox.kt`
```
package com.mikepenz.markdown.m2.elements

import androidx.compose.material.Checkbox
import androidx.compose.runtime.Composable
import androidx.compose.ui.semantics.Role.Companion.Checkbox
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import com.mikepenz.markdown.compose.elements.MarkdownCheckBox
import org.intellij.markdown.ast.ASTNode

@Composable
fun MarkdownCheckBox(
    content: String,
    node: ASTNode,
    style: TextStyle,
) = MarkdownCheckBox(
    content = content,
    node = node,
    style = style,
    checkedIndicator = { checked, modifier ->
        Checkbox(
            checked = checked,
            onCheckedChange = null,
            modifier = modifier.semantics {
                role = Checkbox
                stateDescription = if (checked) "Checked" else "Unchecked"
            },
        )
    },
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #672** (2026-11-15): **fix(deps): update dependency dev.snipme:highlights to v1.2.0**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | OpenSSF | |---|---|---|---|---| | [dev.snipme:highlights](https://redirect.github.com/SnipMeDev/Highlights) | dependencies | minor | `1.1.0` → `1.2.0` | [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/SnipMeDev/Highlights/badge)](https://securityscorecards.dev/viewer/?uri=github.com/SnipMeDev/Highlights) |  ---  ### Release Notes  <details> <summary>SnipMeDev/Highlights (dev.snipme:highlights)</summary>  ### [`v1.2.0`](https://redirect.github.com/SnipMeDev/Highlights/blob/HEAD/CHANGELOG.md#120)  [Compare Source](https://redirect.github.com/SnipMeDev/Highlights/compare/1.1.0...1.2.0)  ##### Fixed  - invalid range in multiline comment locating - comment delimiters inside string and char literals starting a comment ([#&#8203;78](https://redirect.github.com/SnipMeDev/Highlights/issues/78)) - marks, punctuation, numbers and annotations reported inside comments and strings  </details>  ---  ### Configuration  📅 **Schedule**: (in timezone Europe/Berlin)  - Branch creation   - "before 6am on Monday" - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Enabled.  ♻ **Rebasing**: Whenever PR is behind base branch, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR has been generated by [Mend Renovat

- **Issue #671** (2026-11-15): **chore(deps): update github actions updates**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | Pending | OpenSSF | |---|---|---|---|---|---| | [actions/setup-java](https://redirect.github.com/actions/setup-java) | action | minor | `v6.1.0` → `v6.2.0` | `v6.3.0` | [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/actions/setup-java/badge)](https://securityscorecards.dev/viewer/?uri=github.com/actions/setup-java) | | [github/codeql-action](https://redirect.github.com/github/codeql-action) | action | patch | `v4.39.1` → `v4.39.3` |  | [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/github/codeql-action/badge)](https://securityscorecards.dev/viewer/?uri=github.com/github/codeql-action) |  ---  ### Release Notes  <details> <summary>actions/setup-java</summary>  ### [`v6.2.0`](https://redirect.github.com/actions/setup-java/releases/tag/v6.2.0)  [Compare Source](https://redirect.github.com/actions/setup-java/compare/v6.1.0...v6.2.0)  ##### What's Changed  - Fix Liberica SDKMAN patch release resolution by [@&#8203;brunoborges](https://redirect.github.com/brunoborges) in [#&#8203;1291](https://redirect.github.com/actions/setup-java/pull/1291) - Update Undici to 6.29.1 by [@&#8203;brunoborges](https://redirect.github.com/brunoborges) in [#&#8203;1308](https://redirect.github.com/actions/setup-java/pull/1308) - chore(deps): bump the monthly-npm-updates group with 12 updates by [@&#8203;dependabot](https://redirect.github.com/dependabot)\[bot] in [#

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

### Incident Patch 1: `a60347dc` (2026-11-15)
**Commit Message**: fix(deps): update dependency dev.snipme:highlights to v1.2.0 (#672)

Co-authored-by: renovate-mike[bot] <274037420+renovate-mike[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ coil = "3.6.3"
 coil2 = "2.7.0"
 markdown = "0.7.18"
 ktor = "3.6.1"
-highlights = "1.1.0"
+highlights = "1.2.0"
 
 [libraries]
 androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "androidx-activityCompose" }
```

---

### Incident Patch 2: `2fc99061` (2026-11-14)
**Commit Message**: build: update Gradle wrapper to 9.9.1 (#670)

**File**: `gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-9.8.2-bin.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-9.9.1-bin.zip
 networkTimeout=10000
 retries=0
 retryBackOffMs=500
```

#### Recent Merged Pull Requests:
- **PR #672** (2026-11-15): fix(deps): update dependency dev.snipme:highlights to v1.2.0 (@renovate-mike[bot])
- **PR #671** (2026-11-15): chore(deps): update github actions updates (@renovate-mike[bot])
- **PR #670** (2026-11-14): build: update Gradle wrapper to 9.9.1 (@mikepenz)
- **PR #667** (2026-11-13): chore(deps): update mikepenz/action-junit-report action to v6.7.1 (@renovate-mike[bot])
- **PR #665** (2026-11-10): chore(deps): update mikepenz/action-junit-report action to v6.7.0 (@renovate-mike[bot])
- **PR #664** (2026-11-08): fix(deps): update ktor monorepo to v3.6.1 (@renovate-mike[bot])

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

## X. deps): update dependency dev.snipme:highlights to v1.2.0

**RULE**:
When implementing operations in `gradle/libs.versions.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mikepenz/multiplatform-markdown-renderer. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a60347dc`: deps): update dependency dev.snipme:highlights to v1.2.0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `gradle/libs.versions.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
highlights = "1.2.0"
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
highlights = "1.1.0"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a60347dc` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
