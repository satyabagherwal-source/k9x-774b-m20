# Forensic Learning Record (Deep Inspection): mikepenz/multiplatform-markdown-renderer

> **Canonical Artifact**: `07_PROJECT_LEARNING/mikepenz-multiplatform-markdown-renderer-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mikepenz/multiplatform-markdown-renderer](https://github.com/mikepenz/multiplatform-markdown-renderer))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:24:28.671Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mikepenz/multiplatform-markdown-renderer`
- **Description**: Markdown renderer for Kotlin Multiplatform Projects (Android, iOS, Desktop), using Compose.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1099 stars

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
): MarkdownColors = DefaultMarkdownColors(
    text = text,
    codeBackground = codeBackground,
    inlineCodeBackground = inlineCodeBackground,
    dividerColor = dividerColor,
    tableBackground = tableBackground,
    alert = alert,
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

### Core Architecture Module: `multiplatform-markdown-renderer-m3/src/commonMain/kotlin/com/mikepenz/markdown/m3/Markdown.kt`
```
package com.mikepenz.markdown.m3

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.mikepenz.markdown.compose.MarkdownSuccess
import com.mikepenz.markdown.compose.StreamingMarkdownSuccess
import com.mikepenz.markdown.compose.components.MarkdownComponents
import com.mikepenz.markdown.compose.components.markdownComponents
import com.mikepenz.markdown.m3.elements.MarkdownCheckBox
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
 * Renders the markdown content using Material 3 styles.
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
 * Renders the markdown content using Material 3 styles.
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
 * Renders streaming markdown content using Material 3 styles.
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
 * Renders the markdown content using Material 3 styles.
 *
 * @param state The [State] to use for parsing.
 * @param colors The [MarkdownColors] to use for styling.
 * @param typography The [MarkdownTypography] to use for text styles.
 * @param modifier The [Modifier] to apply to the component.
 * @param padding The [Mar
```

### Core Architecture Module: `multiplatform-markdown-renderer-m3/src/commonMain/kotlin/com/mikepenz/markdown/m3/MarkdownColors.kt`
```
package com.mikepenz.markdown.m3

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import com.mikepenz.markdown.model.DefaultMarkdownColors
import com.mikepenz.markdown.model.MarkdownAlertColors
import com.mikepenz.markdown.model.MarkdownColors
import com.mikepenz.markdown.model.markdownAlertColors

@Composable
fun markdownColor(
    text: Color = MaterialTheme.colorScheme.onBackground,
    codeBackground: Color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
    inlineCodeBackground: Color = codeBackground,
    dividerColor: Color = MaterialTheme.colorScheme.outlineVariant,
    tableBackground: Color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.02f),
    /** Material 3 has no `isLight` flag; derive it from the background so alerts follow the theme. */
    darkTheme: Boolean = MaterialTheme.colorScheme.background.luminance() < 0.5f,
    alert: MarkdownAlertColors = markdownAlertColors(darkTheme),
): MarkdownColors = DefaultMarkdownColors(
    text = text,
    codeBackground = codeBackground,
    inlineCodeBackground = inlineCodeBackground,
    dividerColor = dividerColor,
    tableBackground = tableBackground,
    alert = alert,
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #637** (2026-10-01): **Provide "share" contextual action when user select the content**
  *Symptoms*: ## Feature Description  To have a "share" option when the user select some text, like in the example of the Wikipedia app:  ("Compartir" means "Share" in Spanish)  <img width="583" height="1280" alt="Image" src="https://github.com/user-attachments/assets/043d3aee-cf21-4bcc-a76b-62fc176a4f62" />  ## Problem Statement  The user has no option to easily share a text content to other apps.  ## Proposed Solution  To add this "share" option along with the current available options: "Copy" and "Select all".  ## Alternatives Considered  Maybe it depends on the operating system or something else not related to this component? I had no clue, sorry   ## Use Case  Any user just select the text and can share the content to another app. It would be even better if we, as developers, can configure the intent extra text, so we can add a link to the app. But this is optional.  ## Additional Context  Not sure if this can be done from multiplatform-markdown-renderer or should be done somewhere else :/  ## Checklist  - [X] I have searched for [similar feature requests](https://github.com/mikepenz/multiplatform-markdown-renderer/issues) - [x] I have read the [README](https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/README.md) - [X] I have checked the [CHANGELOG](https://github.com/mikepenz/multiplatform-markdown-renderer/releases) to see if this feature is already planned 
  **Post-Mortem & Fix Analysis**:
  > Good day.   Thank you for your feedback.   This is outside of the scope of the library. The selectable capability is managed by Compose and the options you see with it as a result as well. 
  > The selection menu can be customized at the Compose layer, outside this library.  Compose provides [`Modifier.appendTextContextMenuComponents`](https://developer.android.com/reference/kotlin/androidx/compose/foundation/text/contextmenu/modifier/appendTextContextMenuComponents.modifier) to add actions such as “Share” and [`Modifier.filterTextContextMenuComponents`](https://developer.android.com/reference/kotlin/androidx/compose/foundation/text/contextmenu/modifier/filterTextContextMenuComponents.modifier) to filter existing actions.  With a version that supports [`SelectionState`](https://developer.android.com/reference/kotlin/androidx/compose/foundation/text/selection/SelectionState), the selected text is available through `selectedTexts`. A custom share action could use that text, optionally append an app link, and invoke the platform’s sharing API.  For Compose Multiplatform, the menu modifiers are defined in common code, while the `item()` extension has separate [Android](https://gi

- **Issue #636** (2026-09-08): **chore(deps): update mike penz internal projects**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | OpenSSF | |---|---|---|---|---| | [mikepenz/action-junit-report](https://redirect.github.com/mikepenz/action-junit-report) | action | minor | `v6.4.2` → `v6.5.0` | [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/mikepenz/action-junit-report/badge)](https://securityscorecards.dev/viewer/?uri=github.com/mikepenz/action-junit-report) | | [mikepenz/release-changelog-builder-action](https://redirect.github.com/mikepenz/release-changelog-builder-action) | action | minor | `v6.2.3` → `v6.3.0` | [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/mikepenz/release-changelog-builder-action/badge)](https://securityscorecards.dev/viewer/?uri=github.com/mikepenz/release-changelog-builder-action) |  ---  ### Release Notes  <details> <summary>mikepenz/action-junit-report (mikepenz/action-junit-report)</summary>  ### [`v6.5.0`](https://redirect.github.com/mikepenz/action-junit-report/releases/tag/v6.5.0)  [Compare Source](https://redirect.github.com/mikepenz/action-junit-report/compare/v6.4.2...v6.5.0)  #### 🚀 Features  - ci: add OpenSSF Scorecard, top-level permissions, fix script injection   - PR: [#&#8203;1609](https://redirect.github.com/mikepenz/action-junit-report/issues/1609)  #### 🐛 Fixes  - fix: accept comma separated exclude\_sources again   - PR: [#&#8203;1611](https://redirect.github.com/mikepenz/action-junit-report/issues/1611)  #### 📦 Dependenci

- **Issue #634** (2026-09-05): **Link without scheme or www does not open correctly**
  *Symptoms*: I'm using version 0.45.0 and on Desktop (might be an issue on other platforms as well!), I have the following link: `[foo](google.de)` but when I try to open it, it's just opening `about:blank` which is bad. If I add `https://`, or `www.` it works, but obviously this should not be required.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report @vanniktech   This is platform behavior, and we don't necessarily want to change the string which is provided for the `uri`.   If you provide your own `LocalUriHandler` you can adjust the behavior to the one that suites your needs best:   ```   CompositionLocalProvider(LocalUriHandler provides object : UriHandler {                                                                                                              val delegate = LocalUriHandler.current                                                                                                                                           override fun openUri(uri: String) =                                                                                                                                                  delegate.openUri(if ("://" in uri) uri else "https://$uri")                                                                                                              }) { Markdown(content) } 
  > Alright, works for me. Still find a bit weird though that the library does not do this automatically. [Test](google.com) - edit: okay, if I put it without scheme/www in github, it also fails)

- **Issue #633** (2026-08-30): **fix: expose MarkdownBasicText as public**
  *Symptoms*: ## Summary - Makes `MarkdownBasicText(String, ...)` public so custom Markdown components can reuse the built-in plain-text styling wrapper instead of duplicating it or converting the content to `AnnotatedString`. - Ran `apiDump` to update the `.api` files for the new public API.  ## Test plan - [x] `./gradlew :multiplatform-markdown-renderer:compileKotlinJvm` passes - [x] `./gradlew :multiplatform-markdown-renderer:compileAndroidMain` passes - [x] `./gradlew :multiplatform-markdown-renderer:apiCheck` passes after `apiDump` - [x] `git diff --check` passes 

- **Issue #632** (2026-08-30): **Clean up deprecated APIs and Gradle configuration**
  *Symptoms*: ## Description  This PR removes deprecated parser and Gradle usages and cleans up stale compatibility code.  - Migrates `MarkdownParser` construction and string parsing to the current overloads, using `CancellationToken.NonCancellable` to preserve existing behavior. - Removes obsolete KMP Gradle properties, updates the sample Android target DSL, uses version-catalog dependencies for M3 JVM tests, and drops unused Coil catalog and workaround entries. - Removes legacy `UrlAnnotation` copying from `ExtendedSpans`; current `LinkAnnotation` ranges remain preserved.  No linked issue.  Compatibility note: external callers that pass deprecated `UrlAnnotation` ranges to `ExtendedSpans` will no longer have those ranges copied. The renderer itself already creates links with `LinkAnnotation`.  ## Type of change  - [x] Bug fix (non-breaking change which fixes an issue) - [x] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [x] Refactoring (no functional changes, no API changes) - [x] Build configuration change  ## How Has This Been Tested?  Tested with Zulu JDK 21.0.11 and Gradle 9.7.1.  - [x] `./gradlew apiCheck` - [x] `./gradlew :multiplatform-markdown-renderer:jvmTest` - [x] `./gradlew :multiplatform-markdown-renderer-m3:jvmTest` - [x] `./gradlew :multiplatform-markdown-renderer-m2:compileKotlinJvm` - [x] `./gradlew :multiplatform-markdown-renderer-coil3:compileKotlinJvm` - [x] `./gradlew :sample:shared:compileAndroidMain` - [x] `git di

- **Issue #631** (2026-08-28): **dev -> main**
  *Symptoms*: dev -> main
  **Post-Mortem & Fix Analysis**:
  > You are seeing this message because GitHub Code Scanning has recently been set up for this repository, or this pull request contains the workflow file for the Code Scanning tool.  ### What Enabling Code Scanning Means:  - The 'Security' tab will display more code scanning analysis results (e.g., for the default branch). - Depending on your configuration and choice of analysis tool, future pull requests will be annotated with code scanning analysis results. - You will be able to see the analysis results for the pull request's branch on this [overview](/mikepenz/multiplatform-markdown-renderer/security/code-scanning?query=pr%3A631+is%3Aopen) once the scans have completed and the checks have passed.  For more information about GitHub Code Scanning, check out [the documentation](https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning). 

- **Issue #630** (2026-08-28): **fix: expose resolveImageLink, resolveImageAlt, ImageAltTooltip as public**
  *Symptoms*: ## Summary - Makes `ASTNode.resolveImageLink`, `ASTNode.resolveImageAlt`, and `ImageAltTooltip` public so custom image components (via `MarkdownComponents`) can reuse the built-in link/alt resolution and tooltip wrapper instead of copy-pasting the logic. - Ran `apiDump` to update the `.api` files for the new public surface.  Fixes #577  ## Test plan - [x] `./gradlew :multiplatform-markdown-renderer:compileKotlinJvm` passes - [x] `./gradlew apiCheck` passes (via `apiDump`)

- **Issue #629** (2026-08-28): **chore(deps): update dependencies**
  *Symptoms*: ## Summary - coil 3.5.0 -> 3.6.0 - gradle wrapper 9.7.0 -> 9.7.1 - com.mikepenz:version-catalog 0.19.0 -> 0.20.0  via com.mikepenz:version-catalog 0.19.0 -> 0.20.0: - agp 9.3.1 -> 9.3.2 - compose 1.11.4 -> 1.12.0 - compose-multiplatform 1.11.1 -> 1.12.0 - screenshot 0.0.1-alpha15 -> 0.0.1-alpha16 - aboutLibraries 15.0.4 -> 15.1.1 - versionCatalogUpdate 1.1.0 -> 1.1.1 - stabilityAnalyzer 0.12.0 -> 0.13.0 - composablePreviewScanner 0.9.1 -> 0.9.3 - new jetbrains-compose-ui-test library entry added  MIGRATION.md updated with a new "Version 0.45.0" entry. README had no version-specific content requiring changes.  ## Test plan - [ ] ./gradlew apiCheck - [ ] ./gradlew :sample:android:verifyPaparazzi

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

### Incident Patch 1: `11b9e1c3` (2026-08-29)
**Commit Message**: fix: clean up deprecated text annotation APIs

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/compose/extendedspans/ExtendedSpans.kt` (modified, +0/-7)
```diff
@@ -1,8 +1,6 @@
 // Copyright 2023, Saket Narayan
 // SPDX-License-Identifier: Apache-2.0
 // https://github.com/saket/extended-spans
-@file:OptIn(ExperimentalTextApi::class)
-
 package com.mikepenz.markdown.compose.extendedspans
 
 import androidx.compose.runtime.Stable
@@ -13,7 +11,6 @@ import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.drawBehind
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.text.AnnotatedString
-import androidx.compose.ui.text.ExperimentalTextApi
 import androidx.compose.ui.text.LinkAnnotation
 import androidx.compose.ui.text.TextLayoutResult
 import androidx.compose.ui.text.buildAnnotatedString
@@ -66,10 +63,6 @@ class ExtendedSpans(
             text.getTtsAnnotations(start = 0, end = text.length).fastForEach {
                 addTtsAnnotation(it.item, it.start, it.end)
             }
-            @Suppress("DEPRECATION")
-            text.getUrlAnnotations(start = 0, end = text.length).fastForEach {
-                addUrlAnnotation(it.item, it.start, it.end)
-            }
             text.getLinkAnnotations(start = 0, end = text.length).fastForEach { range ->
                 val decorated = painters.fastFold(initial = range.item) { updated, painter ->
                     painter.decorate(updated, range.start, range.end, text = text, builder = this)
```

---

### Incident Patch 2: `a5b5d556` (2026-08-19)
**Commit Message**: fix: avoid deprecated MarkdownParser APIs

**File**: `multiplatform-markdown-renderer-m2/src/commonMain/kotlin/com/mikepenz/markdown/m2/Markdown.kt` (modified, +2/-1)
```diff
@@ -33,6 +33,7 @@ import com.mikepenz.markdown.model.markdownInlineContent
 import com.mikepenz.markdown.model.markdownPadding
 import org.intellij.markdown.flavours.MarkdownFlavourDescriptor
 import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
+import org.intellij.markdown.parser.CancellationToken
 import org.intellij.markdown.parser.MarkdownParser
 
 
@@ -67,7 +68,7 @@ fun Markdown(
     padding: MarkdownPadding = markdownPadding(),
     dimens: MarkdownDimens = markdownDimens(),
     flavour: MarkdownFlavourDescriptor = GFMFlavourDescriptor(),
-    parser: MarkdownParser = MarkdownParser(flavour),
+    parser: MarkdownParser = MarkdownParser(flavour, cancellationToken = CancellationToken.NonCancellable),
     imageTransformer: ImageTransformer = NoOpImageTransformerImpl(),
     annotator: MarkdownAnnotator = markdownAnnotator(),
     extendedSpans: MarkdownExtendedSpans = markdownExtendedSpans(),
```

**File**: `multiplatform-markdown-renderer-m3/src/commonMain/kotlin/com/mikepenz/markdown/m3/Markdown.kt` (modified, +2/-1)
```diff
@@ -33,6 +33,7 @@ import com.mikepenz.markdown.model.markdownInlineContent
 import com.mikepenz.markdown.model.markdownPadding
 import org.intellij.markdown.flavours.MarkdownFlavourDescriptor
 import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
+import org.intellij.markdown.parser.CancellationToken
 import org.intellij.markdown.parser.MarkdownParser
 
 
@@ -67,7 +68,7 @@ fun Markdown(
     padding: MarkdownPadding = markdownPadding(),
     dimens: MarkdownDimens = markdownDimens(),
     flavour: MarkdownFlavourDescriptor = GFMFlavourDescriptor(),
-    parser: MarkdownParser = MarkdownParser(flavour),
+    parser: MarkdownParser = MarkdownParser(flavour, cancellationToken = CancellationToken.NonCancellable),
     imageTransformer: ImageTransformer = NoOpImageTransformerImpl(),
     annotator: MarkdownAnnotator = markdownAnnotator(),
     extendedSpans: MarkdownExtendedSpans = markdownExtendedSpans(),
```

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/annotator/AnnotatedStringKtx.kt` (modified, +5/-1)
```diff
@@ -29,6 +29,7 @@ import org.intellij.markdown.flavours.MarkdownFlavourDescriptor
 import org.intellij.markdown.flavours.gfm.GFMElementTypes
 import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
 import org.intellij.markdown.flavours.gfm.GFMTokenTypes
+import org.intellij.markdown.parser.CancellationToken
 import org.intellij.markdown.parser.MarkdownParser
 
 /**
@@ -85,7 +86,10 @@ fun String.buildMarkdownAnnotatedString(
     flavour: MarkdownFlavourDescriptor = GFMFlavourDescriptor(),
 ): AnnotatedString {
     val content = this
-    val parsedTree = MarkdownParser(flavour).buildMarkdownTreeFromString(content)
+    val parsedTree = MarkdownParser(
+        flavour = flavour,
+        cancellationToken = CancellationToken.NonCancellable,
+    ).buildMarkdownTreeFromString(content as CharSequence)
     val textNode = parsedTree.children.firstOrNull { node ->
         node.type == MarkdownTokenTypes.TEXT || node.type == MarkdownElementTypes.PARAGRAPH
     }
```

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/compose/Markdown.kt` (modified, +2/-1)
```diff
@@ -36,6 +36,7 @@ import com.mikepenz.markdown.model.rememberMarkdownState
 import com.mikepenz.markdown.utils.LogCompositions
 import org.intellij.markdown.flavours.MarkdownFlavourDescriptor
 import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
+import org.intellij.markdown.parser.CancellationToken
 import org.intellij.markdown.parser.MarkdownParser
 
 
@@ -99,7 +100,7 @@ fun Markdown(
     padding: MarkdownPadding = markdownPadding(),
     dimens: MarkdownDimens = markdownDimens(),
     flavour: MarkdownFlavourDescriptor = GFMFlavourDescriptor(),
-    parser: MarkdownParser = MarkdownParser(flavour),
+    parser: MarkdownParser = MarkdownParser(flavour = flavour, cancellationToken = CancellationToken.NonCancellable),
     imageTransformer: ImageTransformer = NoOpImageTransformerImpl(),
     annotator: MarkdownAnnotator = markdownAnnotator(),
     extendedSpans: MarkdownExtendedSpans = markdownExtendedSpans(),
```

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/model/MarkdownState.kt` (modified, +11/-6)
```diff
@@ -24,6 +24,7 @@ import kotlinx.coroutines.withContext
 import org.intellij.markdown.ast.ASTNode
 import org.intellij.markdown.flavours.MarkdownFlavourDescriptor
 import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
+import org.intellij.markdown.parser.CancellationToken
 import org.intellij.markdown.parser.MarkdownParser
 
 /**
@@ -43,7 +44,9 @@ fun rememberMarkdownState(
     lookupLinks: Boolean = true,
     retainState: Boolean = false,
     flavour: MarkdownFlavourDescriptor = remember { GFMFlavourDescriptor() },
-    parser: MarkdownParser = remember(flavour) { MarkdownParser(flavour) },
+    parser: MarkdownParser = remember(flavour) {
+        MarkdownParser(flavour = flavour, cancellationToken = CancellationToken.NonCancellable)
+    },
     referenceLinkHandler: ReferenceLinkHandler = remember { ReferenceLinkHandlerImpl() },
     immediate: Boolean = LocalInspectionMode.current,
 ): MarkdownState {
@@ -105,7 +108,9 @@ fun rememberMarkdownState(
     lookupLinks: Boolean = true,
     retainState: Boolean = false,
     flavour: MarkdownFlavourDescriptor = remember { GFMFlavourDescriptor() },
-    parser: MarkdownParser = remember(flavour) { MarkdownParser(flavour) },
+    parser: MarkdownParser = remember(flavour) {
+        MarkdownParser(flavour, cancellationToken = CancellationToken.NonCancellable)
+    },
     referenceLinkHandler: ReferenceLinkHandler = remember { ReferenceLinkHandlerImpl() },
     block: suspend () -> String,
 ): MarkdownState {
@@ -218,7 +223,7 @@ internal class MarkdownStateImpl(
      */
     internal fun parseBlocking(): State {
         return try {
-            val parsedResult = input.parser.buildMarkdownTreeFromString(input.content)
+            val parsedResult = input.parser.buildMarkdownTreeFromString(input.content as CharSequence)
             if (input.lookupLinks) {
                 val links = mutableMapOf<String, String?>()
                 lookupLinkDefinition(links, parsedResult, input.content, recursive = true)
@@ -250,7 +255,7 @@ fun parseMarkdownFlow(
     content: String,
     lookupLinks: Boolean = true,
     flavour: MarkdownFlavourDescriptor = GFMFlavourDescriptor(),
-    parser: MarkdownParser = MarkdownParser(flavour),
+    parser: MarkdownParser = MarkdownParser(flavour, cancellationToken = CancellationToken.NonCancellable),
     referenceLinkHandler: ReferenceLinkHandler = ReferenceLinkHandlerImpl(),
 ) = flow {
     emit(State.Loading(referenceLinkHandler))
@@ -289,7 +294,7 @@ fun parseMarkdown(
     content: String,
     lookupLinks: Boolean = true,
     flavour: MarkdownFlavourDescriptor = GFMFlavourDescriptor(),
-    parser: MarkdownParser = MarkdownParser(flavour),
+    parser: MarkdownParser = MarkdownParser(flavour, cancellationToken = CancellationToken.NonCancellable),
     referenceLinkHandler: ReferenceLinkHandler = ReferenceLinkHandlerImpl(),
 ): State {
     return MarkdownStateImpl(
@@ -320,7 +325,7 @@ fun Flow<String>.asMarkdownState(
     lookupLinks: Boolean = true,
     retainState: Boolean = false,
     flavour: MarkdownFlavourDescriptor = GFMFlavourDescriptor(),
-    parser: MarkdownParser = MarkdownParser(flavour),
+    parser: MarkdownParser = MarkdownParser(flavour, cancellationToken = CancellationToken.NonCancellable),
     referenceLinkHandler: ReferenceLinkHandler = ReferenceLinkHandlerImpl(),
 ): Flow<State> {
     val markdownState = MarkdownStateImpl(
```

**File**: `multiplatform-markdown-renderer/src/commonTest/kotlin/com/mikepenz/markdown/model/StreamingMarkdownStateTest.kt` (modified, +2/-1)
```diff
@@ -9,6 +9,7 @@ import kotlinx.coroutines.test.runTest
 import org.intellij.markdown.MarkdownElementTypes
 import org.intellij.markdown.ast.ASTNode
 import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
+import org.intellij.markdown.parser.CancellationToken
 import org.intellij.markdown.parser.MarkdownParser
 import kotlin.test.Test
 import kotlin.test.assertEquals
@@ -198,7 +199,7 @@ class StreamingMarkdownStateTest {
                 content = "",
                 lookupLinks = lookupLinks,
                 flavour = flavour,
-                parser = MarkdownParser(flavour),
+                parser = MarkdownParser(flavour, cancellationToken = CancellationToken.NonCancellable),
                 referenceLinkHandler = referenceLinkHandler,
                 retainState = true,
             )
```

**File**: `multiplatform-markdown-renderer/src/commonTest/kotlin/com/mikepenz/markdown/parser/AlertAstShapeTest.kt` (modified, +5/-1)
```diff
@@ -9,6 +9,7 @@ import org.intellij.markdown.ast.getTextInNode
 import org.intellij.markdown.flavours.gfm.GFMElementTypes
 import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
 import org.intellij.markdown.flavours.gfm.GFMTokenTypes
+import org.intellij.markdown.parser.CancellationToken
 import org.intellij.markdown.parser.MarkdownParser
 import kotlin.test.Test
 import kotlin.test.assertEquals
@@ -23,7 +24,10 @@ import kotlin.test.assertTrue
 class AlertAstShapeTest {
 
     private fun parse(input: String): ASTNode =
-        MarkdownParser(GFMFlavourDescriptor()).buildMarkdownTreeFromString(input)
+        MarkdownParser(
+            flavour = GFMFlavourDescriptor(),
+            cancellationToken = CancellationToken.NonCancellable,
+        ).buildMarkdownTreeFromString(input as CharSequence)
 
     private fun alerts(tree: ASTNode): List<ASTNode> = tree.children.filter { it.type == GFMElementTypes.ALERT }
 
```

**File**: `multiplatform-markdown-renderer/src/commonTest/kotlin/com/mikepenz/markdown/parser/TableAstShapeTest.kt` (modified, +5/-1)
```diff
@@ -5,6 +5,7 @@ import org.intellij.markdown.ast.getTextInNode
 import org.intellij.markdown.flavours.gfm.GFMElementTypes
 import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
 import org.intellij.markdown.flavours.gfm.GFMTokenTypes
+import org.intellij.markdown.parser.CancellationToken
 import org.intellij.markdown.parser.MarkdownParser
 import kotlin.test.Test
 import kotlin.test.assertNotNull
@@ -23,7 +24,10 @@ import kotlin.test.assertTrue
 class TableAstShapeTest {
 
     private fun parse(input: String): ASTNode =
-        MarkdownParser(GFMFlavourDescriptor()).buildMarkdownTreeFromString(input)
+        MarkdownParser(
+            flavour = GFMFlavourDescriptor(),
+            cancellationToken = CancellationToken.NonCancellable,
+        ).buildMarkdownTreeFromString(input as CharSequence)
 
     /** Pretty-print an AST subtree with text snippets. */
     private fun dump(node: ASTNode, content: String, indent: String = ""): String {
```

---

### Incident Patch 3: `830e8198` (2026-08-28)
**Commit Message**: fix: expose resolveImageLink, resolveImageAlt, ImageAltTooltip as public

Custom image components defined via MarkdownComponents could not reuse the
built-in link/alt resolution or tooltip wrapper since they were internal.

Fixes #577

**File**: `multiplatform-markdown-renderer/api/jvm/multiplatform-markdown-renderer.api` (modified, +6/-0)
```diff
@@ -218,6 +218,10 @@ public final class com/mikepenz/markdown/compose/elements/MarkdownHeaderKt {
 	public static final fun MarkdownHeader (Ljava/lang/String;Lorg/intellij/markdown/ast/ASTNode;Landroidx/compose/ui/text/TextStyle;Lorg/intellij/markdown/IElementType;Landroidx/compose/runtime/Composer;II)V
 }
 
+public final class com/mikepenz/markdown/compose/elements/MarkdownImageAltTooltipKt {
+	public static final fun ImageAltTooltip (Ljava/lang/String;Lkotlin/jvm/functions/Function2;Landroidx/compose/runtime/Composer;I)V
+}
+
 public final class com/mikepenz/markdown/compose/elements/MarkdownImageKt {
 	public static final fun MarkdownImage (Ljava/lang/String;Lorg/intellij/markdown/ast/ASTNode;Landroidx/compose/runtime/Composer;I)V
 }
@@ -972,6 +976,8 @@ public final class com/mikepenz/markdown/utils/ExtensionsKt {
 	public static final fun getUnescapedTextInNode (Lorg/intellij/markdown/ast/ASTNode;Ljava/lang/CharSequence;)Ljava/lang/String;
 	public static final fun mapAutoLinkToType (Ljava/util/List;Lorg/intellij/markdown/IElementType;)Ljava/util/List;
 	public static synthetic fun mapAutoLinkToType$default (Ljava/util/List;Lorg/intellij/markdown/IElementType;ILjava/lang/Object;)Ljava/util/List;
+	public static final fun resolveImageAlt (Lorg/intellij/markdown/ast/ASTNode;Ljava/lang/String;)Ljava/lang/String;
+	public static final fun resolveImageLink (Lorg/intellij/markdown/ast/ASTNode;Ljava/lang/String;Lcom/mikepenz/markdown/model/ReferenceLinkHandler;)Ljava/lang/String;
 }
 
 public final class com/mikepenz/markdown/utils/LogCompositionsKt {
```

**File**: `multiplatform-markdown-renderer/api/multiplatform-markdown-renderer.klib.api` (modified, +3/-0)
```diff
@@ -992,13 +992,16 @@ final fun (kotlinx.coroutines.flow/Flow<kotlin/String>).com.mikepenz.markdown.mo
 final fun (kotlinx.coroutines.flow/Flow<kotlin/String>).com.mikepenz.markdown.model/collectAsStreamingMarkdownState(kotlin/Boolean, org.intellij.markdown.flavours/MarkdownFlavourDescriptor?, com.mikepenz.markdown.model/ReferenceLinkHandler?, androidx.compose.runtime/Composer?, kotlin/Int, kotlin/Int): com.mikepenz.markdown.model/StreamingMarkdownState // com.mikepenz.markdown.model/collectAsStreamingMarkdownState|collectAsStreamingMarkdownState@kotlinx.coroutines.flow.Flow<kotlin.String>(kotlin.Boolean;org.intellij.markdown.flavours.MarkdownFlavourDescriptor?;com.mikepenz.markdown.model.ReferenceLinkHandler?;androidx.compose.runtime.Composer?;kotlin.Int;kotlin.Int){}[0]
 final fun (org.intellij.markdown.ast/ASTNode).com.mikepenz.markdown.utils/findAlertType(kotlin/String): com.mikepenz.markdown.model/MarkdownAlertType? // com.mikepenz.markdown.utils/findAlertType|findAlertType@org.intellij.markdown.ast.ASTNode(kotlin.String){}[0]
 final fun (org.intellij.markdown.ast/ASTNode).com.mikepenz.markdown.utils/getUnescapedTextInNode(kotlin/CharSequence): kotlin/String // com.mikepenz.markdown.utils/getUnescapedTextInNode|getUnescapedTextInNode@org.intellij.markdown.ast.ASTNode(kotlin.CharSequence){}[0]
+final fun (org.intellij.markdown.ast/ASTNode).com.mikepenz.markdown.utils/resolveImageAlt(kotlin/String): kotlin/String? // com.mikepenz.markdown.utils/resolveImageAlt|resolveImageAlt@org.intellij.markdown.ast.ASTNode(kotlin.String){}[0]
+final fun (org.intellij.markdown.ast/ASTNode).com.mikepenz.markdown.utils/resolveImageLink(kotlin/String, com.mikepenz.markdown.model/ReferenceLinkHandler?): kotlin/String? // com.mikepenz.markdown.utils/resolveImageLink|resolveImageLink@org.intellij.markdown.ast.ASTNode(kotlin.String;com.mikepenz.markdown.model.ReferenceLinkHandler?){}[0]
 final fun com.mikepenz.markdown.annotator/annotatorSettings(androidx.compose.ui.text/TextLinkStyles?, androidx.compose.ui.text/SpanStyle?, com.mikepenz.markdown.model/MarkdownAnnotator?, com.mikepenz.markdown.model/ReferenceLinkHandler?, androidx.compose.ui.platform/UriHandler?, androidx.compose.ui.text/LinkInteractionListener?, androidx.compose.runtime/Composer?, kotlin/Int, kotlin/Int): com.mikepenz.markdown.annotator/AnnotatorSettings // com.mikepenz.markdown.annotator/annotatorSettings|annotatorSettings(androidx.compose.ui.text.TextLinkStyles?;androidx.compose.ui.text.SpanStyle?;com.mikepenz.markdown.model.MarkdownAnnotator?;com.mikepenz.markdown.model.ReferenceLinkHandler?;androidx.compose.ui.platform.UriHandler?;androidx.compose.ui.text.LinkInteractionListener?;androidx.compose.runtime.Composer?;kotlin.Int;kotlin.Int){}[0]
 final fun com.mikepenz.markdown.annotator/com_mikepenz_markdown_annotator_DefaultAnnotatorSettings$stableprop_getter(): kotlin/Int // com.mikepenz.markdown.annotator/com_mikepenz_markdown_annotator_DefaultAnnotatorSettings$stableprop_getter|com_mikepenz_markdown_annotator_DefaultAnnotatorSettings$stableprop_getter(){}[0]
 final fun com.mikepenz.markdown.compose.components/com_mikepenz_markdown_compose_components_CurrentComponentsBridge$stableprop_getter(): kotlin/Int // com.mikepenz.markdown.compose.components/com_mikepenz_markdown_compose_components_CurrentComponentsBridge$stableprop_getter|com_mikepenz_markdown_compose_components_CurrentComponentsBridge$stableprop_getter(){}[0]
 final fun com.mikepenz.markdown.compose.components/com_mikepenz_markdown_compose_components_MarkdownComponentModel$stableprop_getter(): kotlin/Int // com.mikepenz.markdown.compose.components/com_mikepenz_markdown_compose_components_MarkdownComponentModel$stableprop_getter|com_mikepenz_markdown_compose_components_MarkdownComponentModel$stableprop_getter(){}[0]
 final fun com.mikepenz.markdown.compose.components/markdownComponents(kotlin/Function3<com.mikepenz.markdown.compose.components/MarkdownComponentModel, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit> = ..., kotlin/Function3<com.mikepenz.markdown.compose.components/MarkdownComponentModel, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit> = ..., kotlin/Function3<com.mikepenz.markdown.compose.components/MarkdownComponentModel, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit> = ..., kotlin/Function3<com.mikepenz.markdown.compose.components/MarkdownComponentModel, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit> = ..., kotlin/Function3<com.mikepenz.markdown.compose.components/MarkdownComponentModel, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit> = ..., kotlin/Function3<com.mikepenz.markdown.compose.components/MarkdownComponentModel, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit> = ..., kotlin/Function3<com.mikepenz.markdown.compose.components/MarkdownComponentModel, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit> = ..., kotlin/Function3<com.mikepenz.markdown.compose.components/MarkdownComponentModel, androidx
```

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/compose/elements/MarkdownImageAltTooltip.kt` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ import kotlinx.coroutines.delay
  * [com.mikepenz.markdown.model.MarkdownAnnotatorConfig.imageAltTooltipHoverDelayMs].
  */
 @Composable
-internal fun ImageAltTooltip(alt: String?, content: @Composable () -> Unit) {
+fun ImageAltTooltip(alt: String?, content: @Composable () -> Unit) {
     val config = LocalMarkdownAnnotator.current.config
     if (!config.showImageAltTooltip || alt.isNullOrBlank()) {
         content()
```

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/utils/Extensions.kt` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@ const val MARKDOWN_TAG_IMAGE_URL = "MARKDOWN_IMAGE_URL"
  * web-style hover tooltip. Falls back through `LINK_TEXT` (inline + full
  * reference forms) and `LINK_LABEL` (short reference form).
  */
-internal fun ASTNode.resolveImageAlt(content: String): String? {
+fun ASTNode.resolveImageAlt(content: String): String? {
     findChildOfTypeRecursive(MarkdownElementTypes.LINK_TEXT)?.let {
         val text = it.getUnescapedTextInNode(content).trim('[', ']').trim()
         if (text.isNotEmpty()) return text
@@ -47,7 +47,7 @@ internal fun ASTNode.resolveImageAlt(content: String): String? {
  * via the supplied [referenceLinkHandler] when no inline `LINK_DESTINATION`
  * is present (i.e. for reference-style images like `![alt][id]`).
  */
-internal fun ASTNode.resolveImageLink(
+fun ASTNode.resolveImageLink(
     content: String,
     referenceLinkHandler: ReferenceLinkHandler?,
 ): String? {
```

---

### Incident Patch 4: `b2cdcaa4` (2026-08-28)
**Commit Message**: Merge pull request #627 from thejdubb02/fix/gfm-math-dropped

fix: render GFM math spans as text instead of dropping them

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/annotator/AnnotatedStringKtx.kt` (modified, +7/-0)
```diff
@@ -312,6 +312,13 @@ fun AnnotatedString.Builder.buildMarkdownAnnotatedString(
                     MarkdownElementTypes.SHORT_REFERENCE_LINK -> appendMarkdownReference(content, child, annotatorSettings)
                     MarkdownElementTypes.FULL_REFERENCE_LINK -> appendMarkdownReference(content, child, annotatorSettings)
 
+                    // GFM math ($...$ and $$...$$). We don't typeset LaTeX, but the raw source
+                    // must survive: without these branches the whole span (delimiters and the
+                    // content between them) falls through to `else` and is silently dropped, so
+                    // e.g. "Pay bills $100 and $50" renders as "Pay bills 50".
+                    GFMElementTypes.INLINE_MATH, GFMElementTypes.BLOCK_MATH ->
+                        append(child.getTextInNode(content))
+
                     // Token Types
                     MarkdownTokenTypes.TEXT -> append(child.getUnescapedTextInNode(content))
                     MarkdownTokenTypes.EMAIL_AUTOLINK -> if (parentType == MarkdownElementTypes.LINK_TEXT) {
```

---

### Incident Patch 5: `f0ed7ef4` (2026-08-25)
**Commit Message**: fix: render GFM math spans as text instead of dropping them

The annotated string builder has a `when` branch for every inline element
and token it expects, but none for GFM INLINE_MATH or BLOCK_MATH nodes.
Those fall through to the `else` (which only handles `~`) and contribute
nothing, so any text containing a `$...$` or `$$...$$` span is silently
truncated.

The jetbrains markdown GFM flavour parses the `$100 and $` in
"Pay bills $100 and $50" into an INLINE_MATH node, which gets dropped,
leaving "Pay bills 50". Reported downstream at tasks/tasks#4577.

Append the raw source text of the math node instead. This library does not
typeset LaTeX, so showing the source as written is the correct
non-destructive behavior, and matches what GitHub renders when math is off.

Signed-off-by: Justin Willhite <[REDACTED_EMAIL]>

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/annotator/AnnotatedStringKtx.kt` (modified, +7/-0)
```diff
@@ -312,6 +312,13 @@ fun AnnotatedString.Builder.buildMarkdownAnnotatedString(
                     MarkdownElementTypes.SHORT_REFERENCE_LINK -> appendMarkdownReference(content, child, annotatorSettings)
                     MarkdownElementTypes.FULL_REFERENCE_LINK -> appendMarkdownReference(content, child, annotatorSettings)
 
+                    // GFM math ($...$ and $$...$$). We don't typeset LaTeX, but the raw source
+                    // must survive: without these branches the whole span (delimiters and the
+                    // content between them) falls through to `else` and is silently dropped, so
+                    // e.g. "Pay bills $100 and $50" renders as "Pay bills 50".
+                    GFMElementTypes.INLINE_MATH, GFMElementTypes.BLOCK_MATH ->
+                        append(child.getTextInNode(content))
+
                     // Token Types
                     MarkdownTokenTypes.TEXT -> append(child.getUnescapedTextInNode(content))
                     MarkdownTokenTypes.EMAIL_AUTOLINK -> if (parentType == MarkdownElementTypes.LINK_TEXT) {
```

---

### Incident Patch 6: `52e98d48` (2026-08-17)
**Commit Message**: fix(deps): update dependency org.jetbrains:markdown to v0.7.8

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 androidx-activityCompose = "1.13.0"
 coil = "3.5.0"
 coil2 = "2.7.0"
-markdown = "0.7.6"
+markdown = "0.7.8"
 ktor = "3.5.2"
 highlights = "1.1.0"
 
```

---

### Incident Patch 7: `14e16507` (2026-08-11)
**Commit Message**: Revert "docs: point README images at the review branch [REVERT BEFORE MERGE]"

This reverts commit 46e7855d87204fa0d52268a8e993b09e4b4a982a.

**File**: `README.md` (modified, +16/-16)
```diff
@@ -8,22 +8,22 @@
     <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/actions"><img src="https://github.com/mikepenz/multiplatform-markdown-renderer/workflows/CI/badge.svg" alt="CI status"></a>
     <a href="https://central.sonatype.com/artifact/com.mikepenz/multiplatform-markdown-renderer"><img src="https://img.shields.io/maven-central/v/com.mikepenz/multiplatform-markdown-renderer?style=flat-square&color=%231B4897" alt="Maven Central version"></a>
     <a href="https://scorecard.dev/viewer/?uri=github.com/mikepenz/multiplatform-markdown-renderer"><img src="https://img.shields.io/ossf-scorecard/github.com/mikepenz/multiplatform-markdown-renderer?style=flat-square&label=scorecard" alt="OpenSSF Scorecard"></a>
-    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/docs/readme-redesign/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="Apache 2.0 license"></a>
+    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="Apache 2.0 license"></a>
 </p>
 
 <p align="center">
     <picture>
-        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/hero-dark.svg">
-        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/hero-light.svg" width="100%" alt="A markdown String is parsed by JetBrains Markdown into an AST, mapped through overridable MarkdownComponents, and rendered as Compose Multiplatform UI on Android, iOS, Desktop, Web and macOS.">
+        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/hero-dark.svg">
+        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/hero-light.svg" width="100%" alt="A markdown String is parsed by JetBrains Markdown into an AST, mapped through overridable MarkdownComponents, and rendered as Compose Multiplatform UI on Android, iOS, Desktop, Web and macOS.">
     </picture>
 </p>
 
 <p align="center">
     <a href="#quickstart">Quickstart</a> &bull;
     <a href="#showcase">Showcase</a> &bull;
     <a href="#reference">Reference</a> &bull;
-    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/docs/readme-redesign/MIGRATION.md">Migration</a> &bull;
-    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/docs/readme-redesign/CHANGELOG.md">Changelog</a>
+    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/MIGRATION.md">Migration</a> &bull;
+    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/CHANGELOG.md">Changelog</a>
 </p>
 
 | | |
@@ -77,17 +77,17 @@ the [Reference](#reference) below.
 ## Showcase
 
 Every panel below is a Paparazzi snapshot of the sample app, recorded from
-[`ReadmeShowcasePreviews.kt`](https://github.com/mikepenz/multiplatform-markdown-renderer/blob/docs/readme-redesign/sample/android/src/main/kotlin/com/mikepenz/markdown/ui/readme/ReadmeShowcasePreviews.kt)
+[`ReadmeShowcasePreviews.kt`](https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/sample/android/src/main/kotlin/com/mikepenz/markdown/ui/readme/ReadmeShowcasePreviews.kt)
 and refreshed by `./gradlew :sample:android:recordPaparazzi :sample:android:copyReadmeArt`.
 
 <p align="center">
     <picture>
-        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/showcase-rich-text-dark.png">
-        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/showcase-rich-text-light.png" width="395" alt="Headings, italic, bold, inline code, a link, a blockquote, and ordered plus unordered lists.">
+        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/showcase-rich-text-dark.png">
+        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/showcase-rich-text-light.png" width="395" alt="Headings, italic, bold, inline code, a link, a blockquote, and ordered plus unordered lists.">
     </picture>
     <picture>
-        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/showcase-syntax-dark.png">
-        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/showcase-syntax-light.png" width="395" alt="A Kotlin and a JSON code fence, syntax highlighted, each with a language header and copy button.">
+        <source med
```

---

### Incident Patch 8: `46e7855d` (2026-08-11)
**Commit Message**: docs: point README images at the review branch [REVERT BEFORE MERGE]

**File**: `README.md` (modified, +16/-16)
```diff
@@ -8,22 +8,22 @@
     <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/actions"><img src="https://github.com/mikepenz/multiplatform-markdown-renderer/workflows/CI/badge.svg" alt="CI status"></a>
     <a href="https://central.sonatype.com/artifact/com.mikepenz/multiplatform-markdown-renderer"><img src="https://img.shields.io/maven-central/v/com.mikepenz/multiplatform-markdown-renderer?style=flat-square&color=%231B4897" alt="Maven Central version"></a>
     <a href="https://scorecard.dev/viewer/?uri=github.com/mikepenz/multiplatform-markdown-renderer"><img src="https://img.shields.io/ossf-scorecard/github.com/mikepenz/multiplatform-markdown-renderer?style=flat-square&label=scorecard" alt="OpenSSF Scorecard"></a>
-    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="Apache 2.0 license"></a>
+    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/docs/readme-redesign/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="Apache 2.0 license"></a>
 </p>
 
 <p align="center">
     <picture>
-        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/hero-dark.svg">
-        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/hero-light.svg" width="100%" alt="A markdown String is parsed by JetBrains Markdown into an AST, mapped through overridable MarkdownComponents, and rendered as Compose Multiplatform UI on Android, iOS, Desktop, Web and macOS.">
+        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/hero-dark.svg">
+        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/hero-light.svg" width="100%" alt="A markdown String is parsed by JetBrains Markdown into an AST, mapped through overridable MarkdownComponents, and rendered as Compose Multiplatform UI on Android, iOS, Desktop, Web and macOS.">
     </picture>
 </p>
 
 <p align="center">
     <a href="#quickstart">Quickstart</a> &bull;
     <a href="#showcase">Showcase</a> &bull;
     <a href="#reference">Reference</a> &bull;
-    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/MIGRATION.md">Migration</a> &bull;
-    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/CHANGELOG.md">Changelog</a>
+    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/docs/readme-redesign/MIGRATION.md">Migration</a> &bull;
+    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/blob/docs/readme-redesign/CHANGELOG.md">Changelog</a>
 </p>
 
 | | |
@@ -77,17 +77,17 @@ the [Reference](#reference) below.
 ## Showcase
 
 Every panel below is a Paparazzi snapshot of the sample app, recorded from
-[`ReadmeShowcasePreviews.kt`](https://github.com/mikepenz/multiplatform-markdown-renderer/blob/develop/sample/android/src/main/kotlin/com/mikepenz/markdown/ui/readme/ReadmeShowcasePreviews.kt)
+[`ReadmeShowcasePreviews.kt`](https://github.com/mikepenz/multiplatform-markdown-renderer/blob/docs/readme-redesign/sample/android/src/main/kotlin/com/mikepenz/markdown/ui/readme/ReadmeShowcasePreviews.kt)
 and refreshed by `./gradlew :sample:android:recordPaparazzi :sample:android:copyReadmeArt`.
 
 <p align="center">
     <picture>
-        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/showcase-rich-text-dark.png">
-        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/showcase-rich-text-light.png" width="395" alt="Headings, italic, bold, inline code, a link, a blockquote, and ordered plus unordered lists.">
+        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/showcase-rich-text-dark.png">
+        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/docs/readme-redesign/art/showcase-rich-text-light.png" width="395" alt="Headings, italic, bold, inline code, a link, a blockquote, and ordered plus unordered lists.">
     </picture>
     <picture>
-        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/showcase-syntax-dark.png">
-        <img src="https://raw.githubusercontent.com/mikepenz/multiplatform-markdown-renderer/develop/art/showcase-syntax-light.png" width="395" alt="A Kotlin and a JSON code fence, syntax highlighted, each with a language header and copy button.">
+        <source media="(prefers-color-scheme:
```

---

### Incident Patch 9: `f9a46c8a` (2026-08-11)
**Commit Message**: docs: rebuild README as a landing page with generated art

Restructure the README into a landing page above the fold and a reference
section below it. Every line of the previous README is preserved under
`# Reference`.

Above the fold:
- generated SVG hero (light/dark) showing the parse pipeline and targets
- claim table, three-step quickstart, captioned showcase

All art is generated, so it cannot go stale again:
- `art/hero-{light,dark}.svg` are both emitted by `art/hero.py`
- `art/showcase-*.png` are Paparazzi snapshots of purpose-built previews in
  `ReadmeShowcasePreviews.kt`, copied to stable names by the new
  `:sample:android:copyReadmeArt` task, which fails on a missing snapshot

Also fixes drift found while verifying the README's claims:
- document the streaming API (`rememberStreamingMarkdownState`,
  `collectAsStreamingMarkdownState`), previously undocumented
- duplicate `What's included` heading under Usage -> `Basic Usage`
- license copyright 2025 -> 2026

chore: drop dead AGP screenshot-test baselines

`sample/android/src/debug/screenshotTest/` held 72 reference images from the
AGP screenshot-testing pipeline, last updated 2025-05-01 and superseded by
Paparazzi (`src

**File**: `CLAUDE.md` (modified, +5/-2)
```diff
@@ -15,8 +15,11 @@ repository.
 ./gradlew :sample:web:wasmJsBrowserDevelopmentRun
 
 # Tests (Paparazzi screenshot tests)
-./gradlew :sample:android:verifyPaparazzi        # validate against snapshots
-./gradlew :sample:android:updateDebugScreenshotTest  # update snapshots
+./gradlew :sample:android:verifyPaparazzi   # validate against snapshots
+./gradlew :sample:android:recordPaparazzi   # update snapshots
+
+# README showcase art (after recordPaparazzi)
+./gradlew :sample:android:copyReadmeArt
 
 # API compatibility check
 ./gradlew apiCheck
```

**File**: `README.md` (modified, +156/-23)
```diff
@@ -1,35 +1,140 @@
-<h1 align="center">
-  Kotlin Multiplatform Markdown Renderer
-</h1>
+<h1 align="center">multiplatform-markdown-renderer</h1>
 
 <p align="center">
-    ... a powerful Kotlin Multiplatform Markdown Renderer for Kotlin Multiplatform projects using Compose Multiplatform
+    Render Markdown as native Compose UI — one API, every platform.
 </p>
 
-<div align="center">
-    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/actions">
-		<img src="https://github.com/mikepenz/multiplatform-markdown-renderer/workflows/CI/badge.svg"/>
-	</a>
-    <a href="https://central.sonatype.com/artifact/com.mikepenz/multiplatform-markdown-renderer">
-        <img src="https://img.shields.io/maven-central/v/com.mikepenz/multiplatform-markdown-renderer?style=flat-square&color=%231B4897"/>
-    </a>
-    <a href="https://scorecard.dev/viewer/?uri=github.com/mikepenz/multiplatform-markdown-renderer">
-        <img src="https://img.shields.io/ossf-scorecard/github.com/mikepenz/multiplatform-markdown-renderer?style=flat-square&label=scorecard"/>
-    </a>
-</div>
-<br />
+<p align="center">
+    <a href="https://github.com/mikepenz/multiplatform-markdown-renderer/actions"><img src="https://github.com/mikepenz/multiplatform-markdown-renderer/workflows/CI/badge.svg" alt="CI status"></a>
+    <a href="https://central.sonatype.com/artifact/com.mikepenz/multiplatform-markdown-renderer"><img src="https://img.shields.io/maven-central/v/com.mikepenz/multiplatform-markdown-renderer?style=flat-square&color=%231B4897" alt="Maven Central version"></a>
+    <a href="https://scorecard.dev/viewer/?uri=github.com/mikepenz/multiplatform-markdown-renderer"><img src="https://img.shields.io/ossf-scorecard/github.com/mikepenz/multiplatform-markdown-renderer?style=flat-square&label=scorecard" alt="OpenSSF Scorecard"></a>
+    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="Apache 2.0 license"></a>
+</p>
 
--------
+<p align="center">
+    <picture>
+        <source media="(prefers-color-scheme: dark)" srcset="art/hero-dark.svg">
+        <img src="art/hero-light.svg" width="100%" alt="A markdown String is parsed by JetBrains Markdown into an AST, mapped through overridable MarkdownComponents, and rendered as Compose Multiplatform UI on Android, iOS, Desktop, Web and macOS.">
+    </picture>
+</p>
+
+<p align="center">
+    <a href="#quickstart">Quickstart</a> &bull;
+    <a href="#showcase">Showcase</a> &bull;
+    <a href="#reference">Reference</a> &bull;
+    <a href="MIGRATION.md">Migration</a> &bull;
+    <a href="CHANGELOG.md">Changelog</a>
+</p>
+
+| | |
+| --- | --- |
+| 🧩 **Every platform** | Android, iOS, Desktop (JVM), Web (Wasm / JS) and macOS from one `commonMain` call. |
+| ⚡ **Async by default** | `rememberMarkdownState` parses off the composition; `retainState = true` keeps content visible while re-parsing. |
+| 🎨 **Material 2 and 3** | Themed defaults from `-m2` / `-m3`; override with `markdownColor()` and `markdownTypography()`. |
+| 🧱 **Every element overridable** | `MarkdownComponents` maps each AST node to a `@Composable` you control. |
+| 📊 **Full GFM** | Tables, task lists, strikethrough, autolinks and GitHub alerts, out of the box. |
+| 📡 **Built for streaming** | `rememberStreamingMarkdownState()` appends chunks and re-parses only the unstable tail. |
+
+## Quickstart
+
+**1 — Add the dependency.** Pick the module matching your Material theme:
+
+```kotlin
+dependencies {
+    implementation("com.mikepenz:multiplatform-markdown-renderer:0.43.0")
+    implementation("com.mikepenz:multiplatform-markdown-renderer-m3:0.43.0") // or -m2
+}
+```
+
+**2 — Render.** Import `Markdown` from `com.mikepenz.markdown.m3` (or `.m2`):
+
+```kotlin
+import com.mikepenz.markdown.m3.Markdown
+
+Markdown(
+    """
+    # Hello Markdown
+
+    - Bullet points
+    - **Bold** and *italic* text
+
+    [Check out this link](https://github.com/mikepenz/multiplatform-markdown-renderer)
+    """.trimIndent()
+)
+```
+
+**3 — Hoist the parse for anything non-trivial.** `rememberMarkdownState` parses asynchronously and
+survives recomposition:
+
+```kotlin
+val markdownState = rememberMarkdownState(markdown)
+Markdown(markdownState)
+```
+
+Full configuration — custom components, image loading, syntax highlighting, extended spans — is in
+the [Reference](#reference) below.
+
+## Showcase
+
+Every panel below is a Paparazzi snapshot of the sample app, recorded from
+[`ReadmeShowcasePreviews.kt`](sample/android/src/main/kotlin/com/mikepenz/markdown/ui/readme/ReadmeShowcasePreviews.kt)
+and refreshed by `./gradlew :sample:android:recordPaparazzi :sample:android:copyReadmeArt`.
+
+<p align="center">
+    <picture>
+        <source media="(prefers-color-scheme: dark)" srcset="art/showcase-rich-text-dark.png">
+        <img src="art/showcase-rich-text-light.png" width="395" alt="Headings, italic, bold, inline code, a link, a blockquote, and ordered plus unordered 
```

**File**: `art/hero-dark.svg` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420" role="img" aria-labelledby="heroTitle heroDesc">
+<title id="heroTitle">multiplatform-markdown-renderer</title>
+<desc id="heroDesc">A markdown String is parsed by JetBrains Markdown into an AST, mapped through overridable MarkdownComponents, and rendered as Compose Multiplatform UI on Android, iOS, Desktop, Web and macOS.</desc>
+<rect width="1200" height="420" rx="24" fill="#1a1a1a"/>
+<g id="title-block" transform="translate(64 0)">
+<text x="0" y="72" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="19" letter-spacing="2.6" fill="#9a9a9a">KOTLIN MULTIPLATFORM · COMPOSE MULTIPLATFORM</text>
+<text x="0" y="126" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="52" font-weight="700" fill="#ffffff">multiplatform-markdown-renderer</text>
+<text x="0" y="164" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" fill="#9a9a9a">Render Markdown as native Compose UI — one API, every platform.</text>
+</g>
+<g id="pipeline" transform="translate(64 196)">
+<g transform="translate(0 0)">
+<rect width="248" height="108" rx="14" fill="#242424" stroke="#3a3a3a"/>
+<rect width="248" height="4" rx="2" fill="#c7ff1e"/>
+<text x="20" y="46" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="600" fill="#ffffff">Markdown</text>
+<text x="20" y="78" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="18" fill="#9a9a9a">String</text>
+</g>
+<path d="M252 54.0 H266" stroke="#3a3a3a" stroke-width="2"/>
+<path d="M261 49.0 l6 5 -6 5" fill="none" stroke="#9a9a9a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
+<g transform="translate(274 0)">
+<rect width="248" height="108" rx="14" fill="#242424" stroke="#3a3a3a"/>
+<rect width="248" height="4" rx="2" fill="#00ff6a"/>
+<text x="20" y="46" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="600" fill="#ffffff">AST</text>
+<text x="20" y="78" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="18" fill="#9a9a9a">JetBrains Markdown</text>
+</g>
+<path d="M526 54.0 H540" stroke="#3a3a3a" stroke-width="2"/>
+<path d="M535 49.0 l6 5 -6 5" fill="none" stroke="#9a9a9a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
+<g transform="translate(548 0)">
+<rect width="248" height="108" rx="14" fill="#242424" stroke="#3a3a3a"/>
+<rect width="248" height="4" rx="2" fill="#00b9ff"/>
+<text x="20" y="46" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="600" fill="#ffffff">Components</text>
+<text x="20" y="78" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="18" fill="#9a9a9a">MarkdownComponents</text>
+</g>
+<path d="M800 54.0 H814" stroke="#3a3a3a" stroke-width="2"/>
+<path d="M809 49.0 l6 5 -6 5" fill="none" stroke="#9a9a9a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
+<g transform="translate(822 0)">
+<rect width="248" height="108" rx="14" fill="#242424" stroke="#3a3a3a"/>
+<rect width="248" height="4" rx="2" fill="#00b9ff"/>
+<text x="20" y="46" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="600" fill="#ffffff">Compose UI</text>
+<text x="20" y="78" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="18" fill="#9a9a9a">@Composable</text>
+</g>
+</g>
+<g id="platforms" transform="translate(64 366)">
+<circle cx="6" cy="-6" r="5" fill="#00ff6a"/>
+<text x="22" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#9a9a9a">Android</text>
+<circle cx="136" cy="-6" r="5" fill="#00ff6a"/>
+<text x="152" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#9a9a9a">iOS</text>
+<circle cx="223" cy="-6" r="5" fill="#00ff6a"/>
+<text x="239" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#9a9a9a">Desktop (JVM)</text>
+<circle cx="416" cy="-6" r="5" fill="#00ff6a"/>
+<text x="432" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#9a9a9a">Web (Wasm / JS)</text>
+<circle cx="631" cy="-6" r="5" fill="#00ff6a"/>
+<text x="647" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#9a9a9a">macOS</text>
+</g>
+</svg>
```

**File**: `art/hero-light.svg` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420" role="img" aria-labelledby="heroTitle heroDesc">
+<title id="heroTitle">multiplatform-markdown-renderer</title>
+<desc id="heroDesc">A markdown String is parsed by JetBrains Markdown into an AST, mapped through overridable MarkdownComponents, and rendered as Compose Multiplatform UI on Android, iOS, Desktop, Web and macOS.</desc>
+<rect width="1200" height="420" rx="24" fill="#ffffff"/>
+<g id="title-block" transform="translate(64 0)">
+<text x="0" y="72" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="19" letter-spacing="2.6" fill="#5f5f5f">KOTLIN MULTIPLATFORM · COMPOSE MULTIPLATFORM</text>
+<text x="0" y="126" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="52" font-weight="700" fill="#1a1a1a">multiplatform-markdown-renderer</text>
+<text x="0" y="164" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" fill="#5f5f5f">Render Markdown as native Compose UI — one API, every platform.</text>
+</g>
+<g id="pipeline" transform="translate(64 196)">
+<g transform="translate(0 0)">
+<rect width="248" height="108" rx="14" fill="#f4f4f4" stroke="#e0e0e0"/>
+<rect width="248" height="4" rx="2" fill="#c7ff1e"/>
+<text x="20" y="46" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="600" fill="#1a1a1a">Markdown</text>
+<text x="20" y="78" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="18" fill="#5f5f5f">String</text>
+</g>
+<path d="M252 54.0 H266" stroke="#e0e0e0" stroke-width="2"/>
+<path d="M261 49.0 l6 5 -6 5" fill="none" stroke="#5f5f5f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
+<g transform="translate(274 0)">
+<rect width="248" height="108" rx="14" fill="#f4f4f4" stroke="#e0e0e0"/>
+<rect width="248" height="4" rx="2" fill="#00ff6a"/>
+<text x="20" y="46" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="600" fill="#1a1a1a">AST</text>
+<text x="20" y="78" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="18" fill="#5f5f5f">JetBrains Markdown</text>
+</g>
+<path d="M526 54.0 H540" stroke="#e0e0e0" stroke-width="2"/>
+<path d="M535 49.0 l6 5 -6 5" fill="none" stroke="#5f5f5f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
+<g transform="translate(548 0)">
+<rect width="248" height="108" rx="14" fill="#f4f4f4" stroke="#e0e0e0"/>
+<rect width="248" height="4" rx="2" fill="#00b9ff"/>
+<text x="20" y="46" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="600" fill="#1a1a1a">Components</text>
+<text x="20" y="78" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="18" fill="#5f5f5f">MarkdownComponents</text>
+</g>
+<path d="M800 54.0 H814" stroke="#e0e0e0" stroke-width="2"/>
+<path d="M809 49.0 l6 5 -6 5" fill="none" stroke="#5f5f5f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
+<g transform="translate(822 0)">
+<rect width="248" height="108" rx="14" fill="#f4f4f4" stroke="#e0e0e0"/>
+<rect width="248" height="4" rx="2" fill="#00b9ff"/>
+<text x="20" y="46" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="600" fill="#1a1a1a">Compose UI</text>
+<text x="20" y="78" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="18" fill="#5f5f5f">@Composable</text>
+</g>
+</g>
+<g id="platforms" transform="translate(64 366)">
+<circle cx="6" cy="-6" r="5" fill="#00a44a"/>
+<text x="22" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#5f5f5f">Android</text>
+<circle cx="136" cy="-6" r="5" fill="#00a44a"/>
+<text x="152" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#5f5f5f">iOS</text>
+<circle cx="223" cy="-6" r="5" fill="#00a44a"/>
+<text x="239" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#5f5f5f">Desktop (JVM)</text>
+<circle cx="416" cy="-6" r="5" fill="#00a44a"/>
+<text x="432" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#5f5f5f">Web (Wasm / JS)</text>
+<circle cx="631" cy="-6" r="5" fill="#00a44a"/>
+<text x="647" y="0" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" fill="#5f5f5f">macOS</text>
+</g>
+</svg>
```

**File**: `art/hero.py` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+#!/usr/bin/env python3
+"""Generates art/hero-light.svg and art/hero-dark.svg from one source of truth."""
+import pathlib
+
+W, H = 1200, 420
+
+SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
+MONO = "ui-monospace,SFMono-Regular,Menlo,monospace"
+
+LIME, GREEN, BLUE = "#c7ff1e", "#00ff6a", "#00b9ff"
+
+THEMES = {
+    # `dot` is the only accent that carries meaning at 5px, so it needs real contrast on white.
+    "dark": dict(bg="#1a1a1a", fg="#ffffff", muted="#9a9a9a", card="#242424", stroke="#3a3a3a",
+                 dot=GREEN),
+    "light": dict(bg="#ffffff", fg="#1a1a1a", muted="#5f5f5f", card="#f4f4f4", stroke="#e0e0e0",
+                  dot="#00a44a"),
+}
+
+# label, sub-label, accent
+STAGES = [
+    ("Markdown", "String", LIME),
+    ("AST", "JetBrains Markdown", GREEN),
+    ("Components", "MarkdownComponents", BLUE),
+    ("Compose UI", "@Composable", BLUE),
+]
+
+PLATFORMS = ["Android", "iOS", "Desktop (JVM)", "Web (Wasm / JS)", "macOS"]
+
+CARD_W, CARD_H, GAP = 248, 108, 26
+PIPE_Y = 196
+PIPE_X = 64
+
+
+def esc(s):
+    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
+
+
+def build(theme_name):
+    t = THEMES[theme_name]
+    o = []
+    a = o.append
+    a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
+      f'viewBox="0 0 {W} {H}" role="img" aria-labelledby="heroTitle heroDesc">')
+    a('<title id="heroTitle">multiplatform-markdown-renderer</title>')
+    a('<desc id="heroDesc">A markdown String is parsed by JetBrains Markdown into an AST, '
+      'mapped through overridable MarkdownComponents, and rendered as Compose Multiplatform UI '
+      'on Android, iOS, Desktop, Web and macOS.</desc>')
+    a(f'<rect width="{W}" height="{H}" rx="24" fill="{t["bg"]}"/>')
+
+    # --- title block ---
+    a(f'<g id="title-block" transform="translate({PIPE_X} 0)">')
+    a(f'<text x="0" y="72" font-family="{MONO}" font-size="19" letter-spacing="2.6" '
+      f'fill="{t["muted"]}">KOTLIN MULTIPLATFORM · COMPOSE MULTIPLATFORM</text>')
+    a(f'<text x="0" y="126" font-family="{SANS}" font-size="52" font-weight="700" '
+      f'fill="{t["fg"]}">multiplatform-markdown-renderer</text>')
+    a(f'<text x="0" y="164" font-family="{SANS}" font-size="24" fill="{t["muted"]}">'
+      f'Render Markdown as native Compose UI — one API, every platform.</text>')
+    a('</g>')
+
+    # --- pipeline ---
+    a(f'<g id="pipeline" transform="translate({PIPE_X} {PIPE_Y})">')
+    for i, (label, sub, accent) in enumerate(STAGES):
+        x = i * (CARD_W + GAP)
+        a(f'<g transform="translate({x} 0)">')
+        a(f'<rect width="{CARD_W}" height="{CARD_H}" rx="14" fill="{t["card"]}" '
+          f'stroke="{t["stroke"]}"/>')
+        a(f'<rect width="{CARD_W}" height="4" rx="2" fill="{accent}"/>')
+        a(f'<text x="20" y="46" font-family="{SANS}" font-size="24" font-weight="600" '
+          f'fill="{t["fg"]}">{esc(label)}</text>')
+        a(f'<text x="20" y="78" font-family="{MONO}" font-size="18" '
+          f'fill="{t["muted"]}">{esc(sub)}</text>')
+        a('</g>')
+        if i < len(STAGES) - 1:
+            cx = x + CARD_W
+            a(f'<path d="M{cx + 4} {CARD_H / 2} H{cx + GAP - 8}" stroke="{t["stroke"]}" '
+              f'stroke-width="2"/>')
+            a(f'<path d="M{cx + GAP - 13} {CARD_H / 2 - 5} l6 5 -6 5" fill="none" '
+              f'stroke="{t["muted"]}" stroke-width="2" stroke-linecap="round" '
+              f'stroke-linejoin="round"/>')
+    a('</g>')
+
+    # --- platform row ---
+    a(f'<g id="platforms" transform="translate({PIPE_X} 366)">')
+    x = 0
+    for name in PLATFORMS:
+        a(f'<circle cx="{x + 6}" cy="-6" r="5" fill="{t["dot"]}"/>')
+        a(f'<text x="{x + 22}" y="0" font-family="{SANS}" font-size="20" '
+          f'fill="{t["muted"]}">{esc(name)}</text>')
+        x += 26 + int(len(name) * 10.6) + 30
+    a('</g>')
+
+    a('</svg>')
+    return "\n".join(o) + "\n"
+
+
+out = pathlib.Path(__file__).resolve().parent
+for name in THEMES:
+    p = out / f"hero-{name}.svg"
+    p.write_text(build(name))
+    print(p)
```

**File**: `sample/README.md` (modified, +10/-4)
```diff
@@ -12,19 +12,25 @@
 ### Generate reference images for tests
 
 ```bash
-./gradlew :sample:android:updateDebugScreenshotTest
+./gradlew :sample:android:recordPaparazzi
 ```
 
-### Generate ScreenshotTest report
+### Verify snapshots against the reference images
 
 ```bash
-./gradlew :sample:android:validateDebugScreenshotTest
+./gradlew :sample:android:verifyPaparazzi
+```
+
+### Refresh the README showcase art
+
+```bash
+./gradlew :sample:android:recordPaparazzi :sample:android:copyReadmeArt
 ```
 
 ### Run Android app
 
 ```bash
-./gradlew :sample:installDebug
+./gradlew :sample:android:installDebug
 ```
 
 ### Run Desktop app
```

**File**: `sample/android/build.gradle.kts` (modified, +35/-1)
```diff
@@ -39,4 +39,38 @@ composablePreviewPaparazzi {
     enable = true
     packages.add("com.mikepenz.markdown.ui")
 }
- */
\ No newline at end of file
+ */
+
+/**
+ * Snapshots recorded from `ui/readme/ReadmeShowcasePreviews.kt`, mapped to the stable names the
+ * README links to. Re-run after `recordPaparazzi` so the README art follows the current UI:
+ *
+ *   ./gradlew :sample:android:recordPaparazzi :sample:android:copyReadmeArt
+ */
+val readmeArt = mapOf(
+    "showcaserichtext.light" to "showcase-rich-text-light.png",
+    "showcaserichtext.dark_night" to "showcase-rich-text-dark.png",
+    "showcasesyntaxhighlighting.light" to "showcase-syntax-light.png",
+    "showcasesyntaxhighlighting.dark_night" to "showcase-syntax-dark.png",
+    "showcasetablesandalerts.light" to "showcase-tables-alerts-light.png",
+    "showcasetablesandalerts.dark_night" to "showcase-tables-alerts-dark.png",
+    "showcasecustomcomponents.light" to "showcase-custom-light.png",
+    "showcasecustomcomponents.dark_night" to "showcase-custom-dark.png",
+).mapKeys { (preview, _) ->
+    "Paparazzi_Preview_Test_com.mikepenz.markdown.ui.readme.readmeshowcasepreviewskt.$preview.png"
+}
+
+tasks.register<Copy>("copyReadmeArt") {
+    group = "documentation"
+    description = "Copies the README showcase snapshots into art/ under stable names."
+
+    val snapshots = layout.projectDirectory.dir("src/test/snapshots/images")
+    into(rootProject.layout.projectDirectory.dir("art"))
+    readmeArt.forEach { (src, dst) -> from(snapshots.file(src)) { rename { dst } } }
+
+    // `from` on a missing file is silently skipped — that is exactly how README art goes stale.
+    doFirst {
+        val missing = readmeArt.keys.filterNot { snapshots.file(it).asFile.exists() }
+        require(missing.isEmpty()) { "Missing README snapshots: ${missing.joinToString()}" }
+    }
+}
\ No newline at end of file
```

**File**: `sample/android/src/main/kotlin/com/mikepenz/markdown/ui/readme/ReadmeShowcasePreviews.kt` (added, +175/-0)
```diff
@@ -0,0 +1,175 @@
+package com.mikepenz.markdown.ui.readme
+
+import android.content.res.Configuration
+import androidx.compose.foundation.background
+import androidx.compose.foundation.isSystemInDarkTheme
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.padding
+import androidx.compose.material3.MaterialTheme
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.CompositionLocalProvider
+import androidx.compose.runtime.remember
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.platform.LocalInspectionMode
+import androidx.compose.ui.tooling.preview.Preview
+import androidx.compose.ui.unit.dp
+import com.mikepenz.markdown.compose.components.markdownComponents
+import com.mikepenz.markdown.compose.elements.MarkdownHighlightedCodeFence
+import com.mikepenz.markdown.compose.extendedspans.ExtendedSpans
+import com.mikepenz.markdown.compose.extendedspans.RoundedCornerSpanPainter
+import com.mikepenz.markdown.compose.extendedspans.SquigglyUnderlineSpanPainter
+import com.mikepenz.markdown.compose.extendedspans.rememberSquigglyUnderlineAnimator
+import com.mikepenz.markdown.m3.Markdown
+import com.mikepenz.markdown.m3.elements.MarkdownCheckBox
+import com.mikepenz.markdown.m3.markdownColor
+import com.mikepenz.markdown.model.markdownExtendedSpans
+import com.mikepenz.markdown.model.rememberMarkdownState
+import com.mikepenz.markdown.sample.theme.SampleTheme
+import dev.snipme.highlights.Highlights
+import dev.snipme.highlights.model.SyntaxThemes
+
+/**
+ * Panels rendered for the README showcase. Unlike the `ui.m2` / `ui.m3` previews — which pin
+ * behaviour for tests — these go through the sample app's own [SampleTheme] and mirror
+ * `MarkDownPage` so the README shows the product, not test output.
+ *
+ * Copied into `art/` by the `copyReadmeArt` task; see the map in `sample/android/build.gradle.kts`.
+ */
+@Preview(name = "light", heightDp = 490)
+@Preview(name = "dark", heightDp = 490, uiMode = Configuration.UI_MODE_NIGHT_YES)
+annotation class ShowcasePreview
+
+@Composable
+private fun Panel(content: @Composable () -> Unit) = SampleTheme(isSystemInDarkTheme()) {
+    CompositionLocalProvider(LocalInspectionMode provides true) {
+        Box(
+            Modifier
+                .fillMaxWidth()
+                .background(MaterialTheme.colorScheme.background)
+                .padding(16.dp)
+        ) { content() }
+    }
+}
+
+/** Headings, emphasis, links, lists and blockquotes — the default `Markdown` composable. */
+@ShowcasePreview
+@Composable
+fun ShowcaseRichText() = Panel {
+    Markdown(rememberMarkdownState(RICH_TEXT))
+}
+
+/** `markdownComponents(codeFence = ...)` wired to `MarkdownHighlightedCodeFence`. */
+@ShowcasePreview
+@Composable
+fun ShowcaseSyntaxHighlighting() = Panel {
+    val darkTheme = isSystemInDarkTheme()
+    val highlightsBuilder = remember(darkTheme) {
+        Highlights.Builder().theme(SyntaxThemes.atom(darkMode = darkTheme))
+    }
+    Markdown(
+        rememberMarkdownState(CODE),
+        components = markdownComponents(
+            codeFence = {
+                MarkdownHighlightedCodeFence(
+                    content = it.content,
+                    node = it.node,
+                    highlightsBuilder = highlightsBuilder,
+                    showHeader = true,
+                )
+            },
+        ),
+    )
+}
+
+/** GFM tables and GitHub alert banners, both rendered out of the box. */
+@ShowcasePreview
+@Composable
+fun ShowcaseTablesAndAlerts() = Panel {
+    Markdown(rememberMarkdownState(TABLE_AND_ALERT))
+}
+
+/** `markdownComponents(checkbox = ...)`, `markdownColor(...)` and `markdownExtendedSpans`. */
+@ShowcasePreview
+@Composable
+fun ShowcaseCustomComponents() = Panel {
+    Markdown(
+        rememberMarkdownState(CUSTOM),
+        colors = markdownColor(inlineCodeBackground = Color(0x2600B9FF)),
+        components = markdownComponents(
+            checkbox = { MarkdownCheckBox(it.content, it.node, it.typography.text) },
+        ),
+        extendedSpans = markdownExtendedSpans {
+            val animator = rememberSquigglyUnderlineAnimator()
+            remember {
+                ExtendedSpans(
+                    RoundedCornerSpanPainter(),
+                    SquigglyUnderlineSpanPainter(animator = animator),
+                )
+            }
+        },
+    )
+}
+
+private val RICH_TEXT = """
+# Markdown, rendered
+
+Compose Multiplatform text with *italic*, **bold**, `inline code`
+and a [real link](https://github.com/mikepenz).
+
+> Blockquotes keep their accent bar.
+
+1. Ordered lists
+2. Nested content
+   - and unordered children
+
+- Unordered lists, ~~strikethrough~~
+""".trimIndent()
+
+private val CODE = """
+### Syntax highlighting
+
+```kotlin
+fun greet(name: String): String {
+    val greeting = "Hello, ${'$'}name"
+    return greeting.u
```

---

### Incident Patch 10: `abb5654f` (2026-08-11)
**Commit Message**: ci: attest build provenance for releases

Scorecard's Signed-Releases check scored 0. Attach a provenance attestation
to the release assets as .intoto.jsonl, since the check inspects release
assets rather than the repository attestation store.

**File**: `.github/workflows/ci.yml` (modified, +15/-0)
```diff
@@ -172,6 +172,8 @@ jobs:
     if: startsWith(github.ref, 'refs/tags/')
     permissions:
       contents: write
+      id-token: write # mint the Sigstore certificate for provenance
+      attestations: write # upload the attestation to the repository
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
@@ -193,6 +195,19 @@ jobs:
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
 
+      - name: Attest build provenance
+        id: attest
+        uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
+        with:
+          subject-path: artifacts/*
+
+      # The attestation lives in the repository store by default; Scorecard's
+      # Signed-Releases check only looks at release assets, so ship it alongside them.
+      - name: Attach provenance to the release assets
+        env:
+          BUNDLE_PATH: ${{ steps.attest.outputs.bundle-path }}
+        run: cp "$BUNDLE_PATH" "artifacts/multiplatform-markdown-renderer-${GITHUB_REF_NAME}.intoto.jsonl"
+
       - name: Release
         uses: mikepenz/action-gh-release@2a00e201320fb618d8e705a736286b2e31aa48e2 # v3.0.0
         with:
```

---

### Incident Patch 11: `08c15d4d` (2026-08-10)
**Commit Message**: fix(deps): update ktor monorepo to v3.5.2

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ androidx-activityCompose = "1.13.0"
 coil = "3.5.0"
 coil2 = "2.7.0"
 markdown = "0.7.6"
-ktor = "3.5.1"
+ktor = "3.5.2"
 highlights = "1.1.0"
 
 [libraries]
```

---

### Incident Patch 12: `adba0e6b` (2026-08-09)
**Commit Message**: fix(deps): update dependency com.mikepenz:version-catalog to v0.19.0

**File**: `settings.gradle.kts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ dependencyResolutionManagement {
 
     versionCatalogs {
         create("baseLibs") {
-            from("com.mikepenz:version-catalog:0.18.0")
+            from("com.mikepenz:version-catalog:0.19.0")
         }
     }
 }
```

---

### Incident Patch 13: `f18899ee` (2026-08-01)
**Commit Message**: Merge pull request #612 from mikepenz/fix/alert-title-color-and-padding

fix(alert): honor explicit title color and horizontal content padding

**File**: `multiplatform-markdown-renderer/src/commonMain/kotlin/com/mikepenz/markdown/compose/elements/MarkdownAlert.kt` (modified, +41/-38)
```diff
@@ -17,6 +17,7 @@ import androidx.compose.ui.draw.drawBehind
 import androidx.compose.ui.geometry.Offset
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.ColorFilter
+import androidx.compose.ui.graphics.isSpecified
 import androidx.compose.ui.graphics.vector.ImageVector
 import androidx.compose.ui.graphics.vector.rememberVectorPainter
 import androidx.compose.ui.semantics.contentDescription
@@ -85,51 +86,53 @@ fun MarkdownAlert(
             }
             .padding(padding.container)
     ) {
-        Spacer(Modifier.height(padding.content.calculateTopPadding()))
-
-        Row(verticalAlignment = Alignment.CenterVertically) {
-            if (icon != null) {
-                Image(
-                    painter = rememberVectorPainter(icon),
-                    contentDescription = null,
-                    colorFilter = ColorFilter.tint(accent),
-                    modifier = Modifier.size(dimens.iconSize),
+        Column(modifier = Modifier.padding(padding.content)) {
+            Row(verticalAlignment = Alignment.CenterVertically) {
+                if (icon != null) {
+                    Image(
+                        painter = rememberVectorPainter(icon),
+                        contentDescription = null,
+                        colorFilter = ColorFilter.tint(accent),
+                        modifier = Modifier.size(dimens.iconSize),
+                    )
+                    Spacer(Modifier.width(padding.iconSpacing))
+                }
+                MarkdownBasicText(
+                    text = title,
+                    style = style,
+                    color = if (style.color.isSpecified) style.color else accent,
                 )
-                Spacer(Modifier.width(padding.iconSpacing))
             }
-            MarkdownBasicText(text = title, style = style, color = accent)
-        }
 
-        Spacer(Modifier.height(padding.titleSpacing))
+            Spacer(Modifier.height(padding.titleSpacing))
 
-        // The parser leaves the `> ` markers in the tree: a leading BLOCK_QUOTE *token*, and an
-        // `EOL WHITE_SPACE` pair before every continuation line. Dropping those, plus everything up
-        // to and including ALERT_TITLE, leaves exactly the alert's block content. Blocks are always
-        // separated by a blank line, so a uniform gap between them is enough. Note the marker token
-        // shares its name with `MarkdownElementTypes.BLOCK_QUOTE` — a nested quote — which renders.
-        var pastTitle = false
-        var seenContent = false
-        node.children.forEach { child ->
-            when {
-                !pastTitle -> if (child.type == GFMTokenTypes.ALERT_TITLE) pastTitle = true
-                child.type == EOL || child.type == WHITE_SPACE || child.type == BLOCK_QUOTE -> Unit
-                else -> {
-                    if (seenContent) Spacer(Modifier.height(padding.titleSpacing))
-                    seenContent = true
-                    // Stable key by source offset gives each child its own slot and
-                    // keeps recompositions isolated when a sibling changes.
-                    key(child.startOffset) {
-                        MarkdownElement(
-                            node = child,
-                            components = markdownComponents,
-                            content = content,
-                            includeSpacer = false,
-                        )
+            // The parser leaves the `> ` markers in the tree: a leading BLOCK_QUOTE *token*, and an
+            // `EOL WHITE_SPACE` pair before every continuation line. Dropping those, plus everything up
+            // to and including ALERT_TITLE, leaves exactly the alert's block content. Blocks are always
+            // separated by a blank line, so a uniform gap between them is enough. Note the marker token
+            // shares its name with `MarkdownElementTypes.BLOCK_QUOTE` — a nested quote — which renders.
+            var pastTitle = false
+            var seenContent = false
+            node.children.forEach { child ->
+                when {
+                    !pastTitle -> if (child.type == GFMTokenTypes.ALERT_TITLE) pastTitle = true
+                    child.type == EOL || child.type == WHITE_SPACE || child.type == BLOCK_QUOTE -> Unit
+                    else -> {
+                        if (seenContent) Spacer(Modifier.height(padding.titleSpacing))
+                        seenContent = true
+                        // Stable key by source offset gives each child its own slot and
+                        // keeps recompositions isolated when a sibling changes.
+                        key(child.startOffset) {
+                            MarkdownElement(
+                                node = child,
+                                components = markdownComponents,
+                                content = content,
+                                includeSpacer = false,
+                  
```

**File**: `sample/android/src/main/kotlin/com/mikepenz/markdown/ui/m2/AlertsTests.kt` (modified, +35/-0)
```diff
@@ -1,7 +1,17 @@
 package com.mikepenz.markdown.ui.m2
 
+import androidx.compose.foundation.isSystemInDarkTheme
+import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.CompositionLocalProvider
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.platform.LocalInspectionMode
+import androidx.compose.ui.unit.dp
+import com.mikepenz.markdown.model.markdownPadding
+import com.mikepenz.markdown.model.markdownAlertPadding
+import com.mikepenz.markdown.model.rememberMarkdownState
 import com.mikepenz.markdown.ui.annotation.DarkLightPreview
+import com.mikepenz.markdown.ui.m2.theme.SampleTheme
 import com.mikepenz.markdown.ui.m2.util.TestMarkdown
 
 /**
@@ -117,3 +127,28 @@ fun AlertsAndBlockquoteTogetherTest() = TestMarkdown(
         > Dorothy followed her through many of the beautiful rooms in her castle.
         """.trimIndent()
 )
+
+/**
+ * Pins two fixes: an explicit [markdownTypography] `alertTitle` color must win over the
+ * per-type accent, and [markdownAlertPadding] `content` horizontal insets must be honored.
+ */
+@DarkLightPreview
+@Composable
+fun AlertWithExplicitTitleColorAndPaddingTest() = SampleTheme(isSystemInDarkTheme()) {
+    CompositionLocalProvider(LocalInspectionMode provides true) {
+        com.mikepenz.markdown.m2.Markdown(
+            rememberMarkdownState(
+                """
+                > [!NOTE]
+                > The title above should render in magenta, indented well past the accent bar.
+                """.trimIndent()
+            ),
+            typography = com.mikepenz.markdown.m2.markdownTypography(
+                alertTitle = com.mikepenz.markdown.m2.markdownTypography().alertTitle.copy(color = Color.Magenta),
+            ),
+            padding = markdownPadding(
+                alert = markdownAlertPadding(content = PaddingValues(horizontal = 32.dp, vertical = 4.dp)),
+            ),
+        )
+    }
+}
```

**File**: `sample/android/src/main/kotlin/com/mikepenz/markdown/ui/m3/AlertsTests.kt` (modified, +35/-0)
```diff
@@ -1,7 +1,17 @@
 package com.mikepenz.markdown.ui.m3
 
+import androidx.compose.foundation.isSystemInDarkTheme
+import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.CompositionLocalProvider
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.platform.LocalInspectionMode
+import androidx.compose.ui.unit.dp
+import com.mikepenz.markdown.model.markdownAlertPadding
+import com.mikepenz.markdown.model.markdownPadding
+import com.mikepenz.markdown.model.rememberMarkdownState
 import com.mikepenz.markdown.ui.annotation.DarkLightPreview
+import com.mikepenz.markdown.ui.m3.theme.SampleTheme
 import com.mikepenz.markdown.ui.m3.util.TestMarkdown
 
 /**
@@ -117,3 +127,28 @@ fun AlertsAndBlockquoteTogetherTest() = TestMarkdown(
         > Dorothy followed her through many of the beautiful rooms in her castle.
         """.trimIndent()
 )
+
+/**
+ * Pins two fixes: an explicit [markdownTypography] `alertTitle` color must win over the
+ * per-type accent, and [markdownAlertPadding] `content` horizontal insets must be honored.
+ */
+@DarkLightPreview
+@Composable
+fun AlertWithExplicitTitleColorAndPaddingTest() = SampleTheme(isSystemInDarkTheme()) {
+    CompositionLocalProvider(LocalInspectionMode provides true) {
+        com.mikepenz.markdown.m3.Markdown(
+            rememberMarkdownState(
+                """
+                > [!NOTE]
+                > The title above should render in magenta, indented well past the accent bar.
+                """.trimIndent()
+            ),
+            typography = com.mikepenz.markdown.m3.markdownTypography(
+                alertTitle = com.mikepenz.markdown.m3.markdownTypography().alertTitle.copy(color = Color.Magenta),
+            ),
+            padding = markdownPadding(
+                alert = markdownAlertPadding(content = PaddingValues(horizontal = 32.dp, vertical = 4.dp)),
+            ),
+        )
+    }
+}
```

---

### Incident Patch 14: `c812a835` (2026-08-01)
**Commit Message**: test: add m3 parity coverage for alert title color/padding fix

Mirrors the m2 AlertWithExplicitTitleColorAndPaddingTest snapshot.

**File**: `sample/android/src/main/kotlin/com/mikepenz/markdown/ui/m3/AlertsTests.kt` (modified, +35/-0)
```diff
@@ -1,7 +1,17 @@
 package com.mikepenz.markdown.ui.m3
 
+import androidx.compose.foundation.isSystemInDarkTheme
+import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.CompositionLocalProvider
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.platform.LocalInspectionMode
+import androidx.compose.ui.unit.dp
+import com.mikepenz.markdown.model.markdownAlertPadding
+import com.mikepenz.markdown.model.markdownPadding
+import com.mikepenz.markdown.model.rememberMarkdownState
 import com.mikepenz.markdown.ui.annotation.DarkLightPreview
+import com.mikepenz.markdown.ui.m3.theme.SampleTheme
 import com.mikepenz.markdown.ui.m3.util.TestMarkdown
 
 /**
@@ -117,3 +127,28 @@ fun AlertsAndBlockquoteTogetherTest() = TestMarkdown(
         > Dorothy followed her through many of the beautiful rooms in her castle.
         """.trimIndent()
 )
+
+/**
+ * Pins two fixes: an explicit [markdownTypography] `alertTitle` color must win over the
+ * per-type accent, and [markdownAlertPadding] `content` horizontal insets must be honored.
+ */
+@DarkLightPreview
+@Composable
+fun AlertWithExplicitTitleColorAndPaddingTest() = SampleTheme(isSystemInDarkTheme()) {
+    CompositionLocalProvider(LocalInspectionMode provides true) {
+        com.mikepenz.markdown.m3.Markdown(
+            rememberMarkdownState(
+                """
+                > [!NOTE]
+                > The title above should render in magenta, indented well past the accent bar.
+                """.trimIndent()
+            ),
+            typography = com.mikepenz.markdown.m3.markdownTypography(
+                alertTitle = com.mikepenz.markdown.m3.markdownTypography().alertTitle.copy(color = Color.Magenta),
+            ),
+            padding = markdownPadding(
+                alert = markdownAlertPadding(content = PaddingValues(horizontal = 32.dp, vertical = 4.dp)),
+            ),
+        )
+    }
+}
```

---

### Incident Patch 15: `291dfc52` (2026-08-01)
**Commit Message**: test: pin explicit alert title color and content padding fix

Adds a Paparazzi snapshot overriding markdownTypography(alertTitle)
color and markdownAlertPadding(content) horizontal insets, to catch
regressions of the color/padding fix in MarkdownAlert.

**File**: `sample/android/src/main/kotlin/com/mikepenz/markdown/ui/m2/AlertsTests.kt` (modified, +35/-0)
```diff
@@ -1,7 +1,17 @@
 package com.mikepenz.markdown.ui.m2
 
+import androidx.compose.foundation.isSystemInDarkTheme
+import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.CompositionLocalProvider
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.platform.LocalInspectionMode
+import androidx.compose.ui.unit.dp
+import com.mikepenz.markdown.model.markdownPadding
+import com.mikepenz.markdown.model.markdownAlertPadding
+import com.mikepenz.markdown.model.rememberMarkdownState
 import com.mikepenz.markdown.ui.annotation.DarkLightPreview
+import com.mikepenz.markdown.ui.m2.theme.SampleTheme
 import com.mikepenz.markdown.ui.m2.util.TestMarkdown
 
 /**
@@ -117,3 +127,28 @@ fun AlertsAndBlockquoteTogetherTest() = TestMarkdown(
         > Dorothy followed her through many of the beautiful rooms in her castle.
         """.trimIndent()
 )
+
+/**
+ * Pins two fixes: an explicit [markdownTypography] `alertTitle` color must win over the
+ * per-type accent, and [markdownAlertPadding] `content` horizontal insets must be honored.
+ */
+@DarkLightPreview
+@Composable
+fun AlertWithExplicitTitleColorAndPaddingTest() = SampleTheme(isSystemInDarkTheme()) {
+    CompositionLocalProvider(LocalInspectionMode provides true) {
+        com.mikepenz.markdown.m2.Markdown(
+            rememberMarkdownState(
+                """
+                > [!NOTE]
+                > The title above should render in magenta, indented well past the accent bar.
+                """.trimIndent()
+            ),
+            typography = com.mikepenz.markdown.m2.markdownTypography(
+                alertTitle = com.mikepenz.markdown.m2.markdownTypography().alertTitle.copy(color = Color.Magenta),
+            ),
+            padding = markdownPadding(
+                alert = markdownAlertPadding(content = PaddingValues(horizontal = 32.dp, vertical = 4.dp)),
+            ),
+        )
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #636** (2026-09-08): chore(deps): update mike penz internal projects (@renovate-mike[bot])
- **PR #633** (closed): fix: expose MarkdownBasicText as public (@keta1)
- **PR #632** (2026-08-30): Clean up deprecated APIs and Gradle configuration (@keta1)
- **PR #631** (2026-08-28): dev -> main (@mikepenz)
- **PR #630** (2026-08-28): fix: expose resolveImageLink, resolveImageAlt, ImageAltTooltip as public (@mikepenz)
- **PR #629** (2026-08-28): chore(deps): update dependencies (@mikepenz)
- **PR #628** (2026-08-27): chore(deps): update mikepenz/action-gh-release action to v3.1.0 (@renovate-mike[bot])
- **PR #627** (2026-08-28): fix: render GFM math spans as text instead of dropping them (@thejdubb02)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
