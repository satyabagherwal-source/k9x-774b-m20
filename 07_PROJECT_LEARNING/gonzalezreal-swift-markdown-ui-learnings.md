# Forensic Learning Record (Deep Inspection): gonzalezreal/swift-markdown-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/gonzalezreal-swift-markdown-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gonzalezreal/swift-markdown-ui](https://github.com/gonzalezreal/swift-markdown-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:28:34.514Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gonzalezreal/swift-markdown-ui`
- **Description**: Maintenance mode — new development in Textual: https://github.com/gonzalezreal/textual
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3931 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/MarkdownUI/Renderer/AttributedStringInlineRenderer.swift`
```
import Foundation

extension InlineNode {
  func renderAttributedString(
    baseURL: URL?,
    textStyles: InlineTextStyles,
    softBreakMode: SoftBreak.Mode,
    attributes: AttributeContainer
  ) -> AttributedString {
    var renderer = AttributedStringInlineRenderer(
      baseURL: baseURL,
      textStyles: textStyles,
      softBreakMode: softBreakMode,
      attributes: attributes
    )
    renderer.render(self)
    return renderer.result.resolvingFonts()
  }
}

private struct AttributedStringInlineRenderer {
  var result = AttributedString()

  private let baseURL: URL?
  private let textStyles: InlineTextStyles
  private let softBreakMode: SoftBreak.Mode
  private var attributes: AttributeContainer
  private var shouldSkipNextWhitespace = false

  init(
    baseURL: URL?,
    textStyles: InlineTextStyles,
    softBreakMode: SoftBreak.Mode,
    attributes: AttributeContainer
  ) {
    self.baseURL = baseURL
    self.textStyles = textStyles
    self.softBreakMode = softBreakMode
    self.attributes = attributes
  }

  mutating func render(_ inline: InlineNode) {
    switch inline {
    case .text(let content):
      self.renderText(content)
    case .softBreak:
      self.renderSoftBreak()
    case .lineBreak:
      self.renderLineBreak()
    case .code(let content):
      self.renderCode(content)
    case .html(let content):
      self.renderHTML(content)
    case .emphasis(let children):
      self.renderEmphasis(children: children)
    case .strong(let children):
      self.renderStrong(children: children)
    case .strikethrough(let children):
      self.renderStrikethrough(children: children)
    case .link(let destination, let children):
      self.renderLink(destination: destination, children: children)
    case .image(let source, let children):
      self.renderImage(source: source, children: children)
    }
  }

  private mutating func renderText(_ text: String) {
    var text = text

    if self.shouldSkipNextWhitespace {
      self.shouldSkipNextWhitespace = false
      text = text.replacingOccurrences(of: "^\\s+", with: "", options: .regularExpression)
    }

    self.result += .init(text, attributes: self.attributes)
  }

  private mutating func renderSoftBreak() {
    switch softBreakMode {
    case .space where self.shouldSkipNextWhitespace:
      self.shouldSkipNextWhitespace = false
    case .space:
      self.result += .init(" ", attributes: self.attributes)
    case .lineBreak:
      self.renderLineBreak()
    }
  }

  private mutating func renderLineBreak() {
    self.result += .init("\n", attributes: self.attributes)
  }

  private mutating func renderCode(_ code: String) {
    self.result += .init(code, attributes: self.textStyles.code.mergingAttributes(self.attributes))
  }

  private mutating func renderHTML(_ html: String) {
    let tag = HTMLTag(html)

    switch tag?.name.lowercased() {
    case "br":
      self.renderLineBreak()
      self.shouldSkipNextWhitespace = true
    default:
      self.renderText(html)
    }
  }

  private mutating func renderEmphasis(children: [InlineNode]) {
    let savedAttributes = self.attributes
    self.attributes = self.textStyles.emphasis.mergingAttributes(self.attributes)

    for child in children {
      self.render(child)
    }

    self.attributes = savedAttributes
  }

  private mutating func renderStrong(children: [InlineNode]) {
    let savedAttributes = self.attributes
    self.attributes = self.textStyles.strong.mergingAttributes(self.attributes)

    for child in children {
      self.render(child)
    }

    self.attributes = savedAttributes
  }

  private mutating func renderStrikethrough(children: [InlineNode]) {
    let savedAttributes = self.attributes
    self.attributes = self.textStyles.strikethrough.mergingAttributes(self.attributes)

    for child in children {
      self.render(child)
    }

    self.attributes = savedAttributes
  }

  private mutating func renderLink(destination: String, children: [InlineNode]) {
    let savedAttributes = self.attributes
    self.attributes = self.textStyles.link.mergingAttributes(self.attributes)
    self.attributes.link = URL(string: destination, relativeTo: self.baseURL)

    for child in children {
      self.render(child)
    }

    self.attributes = savedAttributes
  }

  private mutating func renderImage(source: String, children: [InlineNode]) {
    // AttributedString does not support images
  }
}

extension TextStyle {
  fileprivate func mergingAttributes(_ attributes: AttributeContainer) -> AttributeContainer {
    var newAttributes = attributes
    self._collectAttributes(in: &newAttributes)
    return newAttributes
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Renderer/InlineTextStyles.swift`
```
import Foundation

struct InlineTextStyles {
  let code: TextStyle
  let emphasis: TextStyle
  let strong: TextStyle
  let strikethrough: TextStyle
  let link: TextStyle
}

```

### Core Architecture Module: `Sources/MarkdownUI/Renderer/TextInlineRenderer.swift`
```
import SwiftUI

extension Sequence where Element == InlineNode {
  func renderText(
    baseURL: URL?,
    textStyles: InlineTextStyles,
    images: [String: Image],
    softBreakMode: SoftBreak.Mode,
    attributes: AttributeContainer
  ) -> Text {
    var renderer = TextInlineRenderer(
      baseURL: baseURL,
      textStyles: textStyles,
      images: images,
      softBreakMode: softBreakMode,
      attributes: attributes
    )
    renderer.render(self)
    return renderer.result
  }
}

private struct TextInlineRenderer {
  var result = Text("")

  private let baseURL: URL?
  private let textStyles: InlineTextStyles
  private let images: [String: Image]
  private let softBreakMode: SoftBreak.Mode
  private let attributes: AttributeContainer
  private var shouldSkipNextWhitespace = false

  init(
    baseURL: URL?,
    textStyles: InlineTextStyles,
    images: [String: Image],
    softBreakMode: SoftBreak.Mode,
    attributes: AttributeContainer
  ) {
    self.baseURL = baseURL
    self.textStyles = textStyles
    self.images = images
    self.softBreakMode = softBreakMode
    self.attributes = attributes
  }

  mutating func render<S: Sequence>(_ inlines: S) where S.Element == InlineNode {
    for inline in inlines {
      self.render(inline)
    }
  }

  private mutating func render(_ inline: InlineNode) {
    switch inline {
    case .text(let content):
      self.renderText(content)
    case .softBreak:
      self.renderSoftBreak()
    case .html(let content):
      self.renderHTML(content)
    case .image(let source, _):
      self.renderImage(source)
    default:
      self.defaultRender(inline)
    }
  }

  private mutating func renderText(_ text: String) {
    var text = text

    if self.shouldSkipNextWhitespace {
      self.shouldSkipNextWhitespace = false
      text = text.replacingOccurrences(of: "^\\s+", with: "", options: .regularExpression)
    }

    self.defaultRender(.text(text))
  }

  private mutating func renderSoftBreak() {
    switch self.softBreakMode {
    case .space where self.shouldSkipNextWhitespace:
      self.shouldSkipNextWhitespace = false
    case .space:
      self.defaultRender(.softBreak)
    case .lineBreak:
      self.shouldSkipNextWhitespace = true
      self.defaultRender(.lineBreak)
    }
  }

  private mutating func renderHTML(_ html: String) {
    let tag = HTMLTag(html)

    switch tag?.name.lowercased() {
    case "br":
      self.defaultRender(.lineBreak)
      self.shouldSkipNextWhitespace = true
    default:
      self.defaultRender(.html(html))
    }
  }

  private mutating func renderImage(_ source: String) {
    if let image = self.images[source] {
      self.result = self.result + Text(image)
    }
  }

  private mutating func defaultRender(_ inline: InlineNode) {
    self.result =
      self.result
      + Text(
        inline.renderAttributedString(
          baseURL: self.baseURL,
          textStyles: self.textStyles,
          softBreakMode: self.softBreakMode,
          attributes: self.attributes
        )
      )
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Utility/BlockNode+ColorSchemeImage.swift`
```
import SwiftUI

extension Sequence where Element == BlockNode {
  func filterImagesMatching(colorScheme: ColorScheme) -> [BlockNode] {
    self.rewrite { inline in
      switch inline {
      case .image(let source, _):
        guard let url = URL(string: source), url.matchesColorScheme(colorScheme) else {
          return []
        }
        return [inline]
      default:
        return [inline]
      }
    }
  }
}

extension URL {
  fileprivate func matchesColorScheme(_ colorScheme: ColorScheme) -> Bool {
    guard let fragment = self.fragment?.lowercased() else {
      return true
    }

    switch colorScheme {
    case .light:
      return fragment != "gh-dark-mode-only"
    case .dark:
      return fragment != "gh-light-mode-only"
    @unknown default:
      return true
    }
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Utility/Color+RGBA.swift`
```
import SwiftUI

extension Color {
  /// Creates a constant color from an RGBA value.
  /// - Parameter rgba: A 32-bit value that represents the red, green, blue, and alpha components of the color.
  public init(rgba: UInt32) {
    self.init(
      red: CGFloat((rgba & 0xff00_0000) >> 24) / 255.0,
      green: CGFloat((rgba & 0x00ff_0000) >> 16) / 255.0,
      blue: CGFloat((rgba & 0x0000_ff00) >> 8) / 255.0,
      opacity: CGFloat(rgba & 0x0000_00ff) / 255.0
    )
  }

  /// Creates a context-dependent color with different values for light and dark appearances.
  /// - Parameters:
  ///   - light: The light appearance color value.
  ///   - dark: The dark appearance color value.
  public init(light: @escaping @autoclosure () -> Color, dark: @escaping @autoclosure () -> Color) {
    #if os(watchOS)
      self = dark()
    #elseif canImport(UIKit)
      self.init(
        uiColor: .init { traitCollection in
          switch traitCollection.userInterfaceStyle {
          case .unspecified, .light:
            return UIColor(light())
          case .dark:
            return UIColor(dark())
          @unknown default:
            return UIColor(light())
          }
        }
      )
    #elseif canImport(AppKit)
      self.init(
        nsColor: .init(name: nil) { appearance in
          if appearance.bestMatch(from: [.aqua, .darkAqua]) == .aqua {
            return NSColor(light())
          } else {
            return NSColor(dark())
          }
        }
      )
    #endif
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Utility/Deprecations.swift`
```
import SwiftUI

// MARK: - Deprecated after 2.1.0:

extension DefaultImageProvider {
  @available(*, deprecated, message: "Use the 'default' static property")
  public init(urlSession: URLSession = .shared) {
    self.init()
  }
}

extension DefaultInlineImageProvider {
  @available(*, deprecated, message: "Use the 'default' static property")
  public init(urlSession: URLSession = .shared) {
    self.init()
  }
}

// MARK: - Deprecated after 2.0.2:

extension BlockStyle where Configuration == BlockConfiguration {
  @available(
    *,
    deprecated,
    message: "Use the initializer that takes a closure receiving a 'Configuration' value."
  )
  public init<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) {
    self.init { configuration in
      body(configuration.label)
    }
  }

  @available(
    *,
    deprecated,
    message: "Use the initializer that takes a closure receiving a 'Configuration' value."
  )
  public init() {
    self.init { $0 }
  }
}

extension View {
  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a generic 'Configuration'
      value.
      """
  )
  public func markdownBlockStyle<Body: View>(
    _ keyPath: WritableKeyPath<Theme, BlockStyle<BlockConfiguration>>,
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> some View {
    self.environment((\EnvironmentValues.theme).appending(path: keyPath), .init(body: body))
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a generic 'Configuration'
      value.
      """
  )
  public func markdownBlockStyle<Body: View>(
    _ keyPath: WritableKeyPath<Theme, BlockStyle<CodeBlockConfiguration>>,
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> some View {
    self.environment(
      (\EnvironmentValues.theme).appending(path: keyPath),
      .init { configuration in
        body(.init(configuration.label))
      }
    )
  }
}

extension Theme {
  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func heading1<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.heading1 = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func heading2<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.heading2 = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func heading3<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.heading3 = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func heading4<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.heading4 = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func heading5<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.heading5 = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func heading6<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.heading6 = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func paragraph<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.paragraph = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func blockquote<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.blockquote = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'CodeBlockConfiguration'
      value.
      """
  )
  public func codeBlock<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.codeBlock = .init { configuration in
      body(.init(configuration.label))
    }
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func image<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.image = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func list<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.list = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func listItem<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.listItem = .init(body: body)
    return theme
  }

  @available(
    *,
    deprecated,
    message: """
      Use the version of this function that takes a closure receiving a 'BlockConfiguration'
      value.
      """
  )
  public func table<Body: View>(
    @ViewBuilder body: @escaping (_ label: BlockConfiguration.Label) -> Body
  ) -> Theme {
    var theme = self
    theme.table = .init(body: body)
    return theme
  }
}

// MARK: - Unavailable after 1.1.1:

extension Heading {
  @available(*, unavailable, message: "Use 'init(_ level:content:)'")
  public init(level: Int, @InlineContentBuilder content: () -> InlineContent) {
    fatalError("Unimplemented")
  }
}

@available(*, unavailable, renamed: "Blockquote")
public typealias BlockQuote = Blockquote

@available(*, unavailable, renamed: "NumberedList")
public typealias OrderedList = NumberedList

@available(*, unavailable, renamed: "BulletedList")
public typealias BulletList = BulletedList

@available(*, unavailable, renamed: "Code")
public typealias InlineCode = Code

@available(
  *,
  unavailable,
  message: """
    "MarkdownImageHandler" has been superseded by the "ImageProvider" protocol and its conforming
    types "DefaultImageProvider" and "AssetImageProvider".
    """
)
public struct MarkdownImageHandler {
  public static var networkImage: Self {
    fatalError("Unimplemented")
  }

  public static func assetImage(
    name: @escaping (URL) -> String = \.lastPathComponent,
    in bundle: Bundle? = nil
  ) -> Self {
    fatalError("Unimplemented")
  }
}

extension Markdown {
  @available(
    *,
    unavailable,
    message: """
      "MarkdownImageHandler" has been superseded by the "ImageProvider" protocol and its conforming
      types "DefaultImageProvider" and "AssetImageProvider".
      """
  )
  public func setImageHandler(
    _ imageHandler: MarkdownImageHandler,
    forURLScheme urlScheme: String
  ) -> Markdown {
    fatalError("Unimplemented")
  }
}

extension View {
  @available(
    *,
    unavailable,
    message: "You can create a custom link action by overriding the \"openURL\" environment value."
  )
  public func onOpenMarkdownLink(perform action: ((URL) -> Void)? = nil) -> some View {
    self
  }
}

@available(
  *,
  unavailable,
  message: """
    "MarkdownStyle" and its subtypes have been superseded by the "Theme", "TextStyle", and
    "BlockStyle" types.
    """
)
public struct MarkdownStyle: Hashable {
  public struct Font: Hashable {
    public static var largeTitle: Self { fatalError("Unimplemented") }
    public static var title: Self { fatalError("Unimplemented") }
    public static var title2: Self { fatalError("Unimplemented") }
    public static var title3: Self { fatalError("Unimplemented") }
    public static var headline: Self { fatalError("Unimplemented") }
    public static var subheadline: Self { fatalError("Unimplemented") }
    public static var body: Self { fatalError("Unimplemented") }
    public static var callout: Self { fatalError("Unimplemented") }
    public static var footnote: Self { fatalError("Unimplemented") }
    public static var caption: Self { fatalError("Unimplemented") }
    public static var caption2: Self { fatalError("Unimplemented") }

    public static func system(
      size: CGFloat,
      weight: 
```

### Core Architecture Module: `Sources/MarkdownUI/Utility/FlowLayout.swift`
```
import SwiftUI

@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
struct FlowLayout: Layout {
  let horizontalSpacing: CGFloat
  let verticalSpacing: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
    let rows = self.computeLayout(for: proposal, subviews: subviews)
    return self.sizeThatFits(rows: rows)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void
  ) {
    let rows = self.computeLayout(for: proposal, subviews: subviews)
    var position = bounds.origin

    for row in rows {
      for item in row.items {
        // align to bottom
        let itemBounds = CGRect(origin: position, size: item.size)
          .offsetBy(dx: 0, dy: row.size.height - item.size.height)
        subviews[item.index].place(at: itemBounds.origin, proposal: .init(itemBounds.size))
        position.x += item.size.width + self.horizontalSpacing
      }

      position.x = bounds.origin.x
      position.y += row.size.height + self.verticalSpacing
    }
  }
}

@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
extension FlowLayout {
  private struct Item {
    let index: Int
    let size: CGSize
  }

  private struct Row {
    var size: CGSize = .zero
    var items: [Item] = []
  }

  private func computeLayout(for proposal: ProposedViewSize, subviews: Subviews) -> [Row] {
    var rows: [Row] = []
    var currentRow = Row()

    for (index, view) in zip(subviews.indices, subviews) {
      // propose the remainder of the width for low prioriy views, otherwise the full width
      // this way we can use a spacer view for hard line breaks
      let proposedWidth =
        view.priority < 0 ? proposal.width.map { $0 - currentRow.size.width } : proposal.width
      let item = Item(
        index: index,
        size: view.sizeThatFits(.init(width: proposedWidth, height: nil))
      )

      if currentRow.size.width > 0,
        currentRow.size.width + item.size.width > (proposal.width ?? .infinity)
      {
        // Remove the spacing for the last item
        currentRow.size.width -= self.horizontalSpacing
        rows.append(currentRow)
        currentRow = Row()
      }

      currentRow.items.append(item)
      currentRow.size.width += item.size.width + self.horizontalSpacing
      currentRow.size.height = max(item.size.height, currentRow.size.height)
    }

    if !currentRow.items.isEmpty {
      // Remove the spacing for the last item
      currentRow.size.width -= self.horizontalSpacing
      rows.append(currentRow)
    }

    return rows
  }

  private func sizeThatFits(rows: [Row]) -> CGSize {
    zip(rows.indices, rows).reduce(CGSize.zero) { size, tuple in
      let (index, row) = tuple
      let spacing = index < rows.endIndex - 1 ? self.verticalSpacing : 0
      return CGSize(
        width: max(size.width, row.size.width),
        height: size.height + row.size.height + spacing
      )
    }
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Utility/Indexed.swift`
```
import Foundation

struct Indexed<Value> {
  let index: Int
  let value: Value
}

extension Indexed: Equatable where Value: Equatable {}
extension Indexed: Hashable where Value: Hashable {}

extension Sequence {
  func indexed() -> [Indexed<Element>] {
    zip(0..., self).map { index, value in
      Indexed(index: index, value: value)
    }
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Utility/InlineNode+PlainText.swift`
```
import Foundation

extension Sequence where Element == InlineNode {
  func renderPlainText() -> String {
    self.collect { inline in
      switch inline {
      case .text(let content):
        return [content]
      case .softBreak:
        return [" "]
      case .lineBreak:
        return ["\n"]
      case .code(let content):
        return [content]
      case .html(let content):
        return [content]
      default:
        return []
      }
    }
    .joined()
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Utility/InlineNode+RawImageData.swift`
```
import Foundation

struct RawImageData: Hashable {
  var source: String
  var alt: String
  var destination: String?
}

extension InlineNode {
  var imageData: RawImageData? {
    switch self {
    case .image(let source, let children):
      return .init(source: source, alt: children.renderPlainText())
    case .link(let destination, let children) where children.count == 1:
      guard var imageData = children.first?.imageData else { return nil }
      imageData.destination = destination
      return imageData
    default:
      return nil
    }
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Utility/Int+Roman.swift`
```
import Foundation

extension Int {
  var roman: String {
    guard self > 0, self < 4000 else {
      return "\(self)"
    }

    let decimals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
    let numerals = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"]

    var number = self
    var result = ""

    for (decimal, numeral) in zip(decimals, numerals) {
      let repeats = number / decimal
      if repeats > 0 {
        result += String(repeating: numeral, count: repeats)
      }
      number = number % decimal
    }

    return result
  }
}

```

### Core Architecture Module: `Sources/MarkdownUI/Utility/RelativeSize.swift`
```
import SwiftUI

/// Represents a relative size or length, such as a width, padding, or font size.
///
/// `RelativeSize` values can be used in text styles like ``FontSize`` or modifiers like
/// `markdownMargin(top:bottom:)`, `relativeFrame(width:height:alignment:)`,
/// `relativeFrame(minWidth:alignment:)`, `relativePadding(_:length:)`,
/// and `relativeLineSpacing(_:)` to express parameters relative to the font size.
///
/// Use the ``em(_:)`` and the ``rem(_:)`` methods to create values relative to the current and
/// root font sizes, respectively. For example, in the following snippet, with a root font size of 17 points,
/// the line spacing will be resolved to 4.25 points (`17 * 2 * 0.125`) and the padding to 8.5 points
/// (`17 * 0.5`).
///
/// ```swift
/// label
///   .relativeLineSpacing(.em(0.125))
///   .relativePadding(length: .rem(0.5))
///   .markdownTextStyle {
///     FontWeight(.semibold)
///     FontSize(.em(2))
///   }
/// ```
public struct RelativeSize: Hashable {
  enum Unit: Hashable {
    case em
    case rem
  }

  var value: CGFloat
  var unit: Unit
}

extension RelativeSize {
  /// A size with a value of zero.
  public static let zero = RelativeSize(value: 0, unit: .rem)

  /// Creates a size value relative to the current font size.
  public static func em(_ value: CGFloat) -> RelativeSize {
    .init(value: value, unit: .em)
  }

  /// Creates a size value relative to the root font size.
  public static func rem(_ value: CGFloat) -> RelativeSize {
    .init(value: value, unit: .rem)
  }

  func points(relativeTo fontProperties: FontProperties? = nil) -> CGFloat {
    let fontProperties = fontProperties ?? .init()

    switch self.unit {
    case .em:
      return round(value * fontProperties.scaledSize)
    case .rem:
      return round(value * fontProperties.size)
    }
  }
}

extension View {
  /// Positions this view within an invisible frame with the specified size.
  ///
  /// This method behaves like the one in SwiftUI but takes `RelativeSize`
  /// values instead of `CGFloat` for the width and height.
  public func relativeFrame(
    width: RelativeSize? = nil,
    height: RelativeSize? = nil,
    alignment: Alignment = .center
  ) -> some View {
    TextStyleAttributesReader { attributes in
      self.frame(
        width: width?.points(relativeTo: attributes.fontProperties),
        height: height?.points(relativeTo: attributes.fontProperties),
        alignment: alignment
      )
    }
  }

  /// Positions this view within an invisible frame having the specified size constraints.
  ///
  /// This method behaves like the one in SwiftUI but takes `RelativeSize`
  /// values instead of `CGFloat` for the width and height.
  public func relativeFrame(
    minWidth: RelativeSize,
    alignment: Alignment = .center
  ) -> some View {
    TextStyleAttributesReader { attributes in
      self.frame(
        minWidth: minWidth.points(relativeTo: attributes.fontProperties),
        alignment: alignment
      )
    }
  }

  /// Adds an equal padding amount to specific edges of this view.
  ///
  /// This method behaves like the one in SwiftUI except that it takes a `RelativeSize`
  /// value instead of a `CGFloat` for the padding amount.
  public func relativePadding(_ edges: Edge.Set = .all, length: RelativeSize) -> some View {
    TextStyleAttributesReader { attributes in
      self.padding(edges, length.points(relativeTo: attributes.fontProperties))
    }
  }

  /// Sets the amount of space between lines of text in this view.
  ///
  /// This method behaves like the one in SwiftUI except that it takes a `RelativeSize`
  /// value instead of a `CGFloat` for the spacing amount.
  public func relativeLineSpacing(_ lineSpacing: RelativeSize) -> some View {
    TextStyleAttributesReader { attributes in
      self.lineSpacing(lineSpacing.points(relativeTo: attributes.fontProperties))
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #344** (2024-11-29): **Wrong font size with blank bullet list**
  *Symptoms*: A blank bullet list leads to an incorrect font size.  **Checklist** - [x] I can reproduce this issue with a vanilla SwiftUI project. - [x] I can reproduce this issue using the `main` branch of this package. - [x] This bug hasn't been addressed in an [existing GitHub issue](https://github.com/gonzalezreal/swift-markdown-ui/issues).  **Steps to reproduce** Explanation of how to reproduce the incorrect behavior. This could include an attached project, a link to code, or a Markdown-formatted text exhibiting the issue. 1. try to preview this markdown string:  2. `"**Banana**:\n   - oink"`, this one behaves correctly 3. try this string: `"**Banana**:\n   - "` 4. In this case the word Banana will be written with much bigger font size  **Expected behavior** It should be the same font size  **Screenshots** <img width="663" alt="Bildschirmfoto 2024-08-22 um 14 46 06" src="https://github.com/user-attachments/assets/04389e7e-4cd3-48df-8b04-1cede24ecf07">  <img width="606" alt="Bildschirmfoto 2024-08-22 um 14 45 56" src="https://github.com/user-attachments/assets/68fe06b5-d35f-4786-91de-12dad8e86b7a">  **Version information** - MarkdownUI: 2.3.1 - OS:  iOS 17.5 - Xcode: 15.0
  **Post-Mortem & Fix Analysis**:
  > @gonzalezreal The library works as expected because the parsing is driven by cmark-gfm, and the results of the two parsing are different. The second resolution is heading leve2.
  > Thanks @TMABC. I haven't got the time to look into this. Mistery solved.

- **Issue #337** (2024-09-04): **Recent change to dynamic scaling broke themes that use custom fonts**
  *Symptoms*: Hello,   Thanks for maintaining this library. We are facing an issue with the dynamic text scaling and custom fonts whenever we try to use the library after the latest update [2.3.1](https://github.com/gonzalezreal/swift-markdown-ui/releases/tag/2.3.1). In the latest release there is this following [PR](https://github.com/gonzalezreal/swift-markdown-ui/pull/330) that adjusts the use of "setting the dynamic text twice". As seen below in the images the when using the `markdownTheme` in the green box it doesnt change the size of the text while the user is changing the text size.  The project:  We use the following SwiftUI view as an example:  ```swift struct ContentView: View {     let text = """     ### Hello, world!      This is text     """     var body: some View {         VStack(spacing: 10) {             Text(text) // This should only display the text without any changes for the sake of sanity checks                 .font(.custom("menlo", size: size))                 .background(Color.red)              Markdown(MarkdownContent(text)) // This renders the markdown properly                 .markdownTextStyle {                     FontFamily(.custom("menlo"))                     FontSize(size)                 }                 .background(Color.blue)              Markdown(MarkdownContent(text))  // This fails to render the markdown properly                 .markdownTheme(.markdownTheme)                 .background(Color.green)         }         
  **Post-Mortem & Fix Analysis**:
  > cc: @gonzalezreal
  > Sorry, I am currently unavailable. I can look into this in a couple of weeks.
  > @gonzalezreal Hi! Have you got any time to look into this yet? I could open a PR to fix it, but since that would just be a revert of [this PR](https://github.com/gonzalezreal/swift-markdown-ui/pull/330), I'm not sure how to proceed.

- **Issue #226** (2023-04-27): **textColor setting in codeBlock is invalid The ForegroundColor is invalid**
  *Symptoms*:     .codeBlock { configuration in         ScrollView(.horizontal,showsIndicators: false) {           configuration.label             .relativeLineSpacing(.em(0.225))             .markdownTextStyle {               FontFamilyVariant(.monospaced)               FontSize(.em(0.85))               ForegroundColor(.secondaryText) //myadd             }

- **Issue #207** (2023-04-05): **The deprecation warning for onOpenMarkdownLink seems incorrect**
  *Symptoms*: **Describe the bug** The deprecation warning for onOpenMarkdownLink seems to be incorrect. The message suggests that "MarkdownImageHandler" has been superseded by the "ImageProvider" protocol and its conforming types "DefaultImageProvider" and "AssetImageProvider", which is not relevant to onOpenMarkdownLink.  **Checklist**   - [x ]  I can reproduce this issue with a vanilla SwiftUI project. - [x ]  I can reproduce this issue using the main branch of this package. - [ x]  This bug hasn't been addressed in an [existing GitHub issue](https://github.com/gonzalezreal/swift-markdown-ui/issues).    **Steps to reproduce**  1. Create a SwiftUI project. 2. Add a markdown view to the project. 3. Implement onOpenMarkdownLink method in the view. 4. Observe the deprecation warning for onOpenMarkdownLink.  **Expected behavior** The deprecation warning for onOpenMarkdownLink should provide relevant information related to the deprecation and point to what has replaced it if applicable.  Screenshots N/A  Version information  MarkdownUI: 2.0.2 OS: iOS 15 
  **Post-Mortem & Fix Analysis**:
  > Thanks for raising this documentation issue.

- **Issue #185** (2023-02-26): **Inline image in text in Markdown not shown**
  *Symptoms*: **Describe the bug** Prior to the newest major release, it was possible to embed images directly in the text. Since the major update it does not work any more.  **Checklist** - [x] I can reproduce this issue with a vanilla SwiftUI project. - [x] I can reproduce this issue using the `main` branch of this package. - [x] This bug hasn't been addressed in an [existing GitHub issue](https://github.com/gonzalezreal/swift-markdown-ui/issues).  **Steps to reproduce** Markdown("2.\n\n ![This is](TestFailedSymbol) \n\n**Context Class (2 of 2 tests passing)** ").markdownImageProvider(.asset)             Markdown("2.\n ![This is](TestFailedSymbol) \n\n**Context Class (2 of 2 tests passing)** ").markdownImageProvider(.asset)             Markdown("2.\n\n ![This is](TestFailedSymbol) \n**Context Class (2 of 2 tests passing)** ").markdownImageProvider(.asset)             Markdown("2.  ![This is](TestFailedSymbol)  **Context Class (2 of 2 tests passing)** ").markdownImageProvider(.asset)             Markdown("2.  ![This is](TestFailedSymbol) **Context Class (2 of 2 tests passing)** ").markdownImageProvider(.asset)             Markdown("2. ![This is](TestFailedSymbol) **Context Class (2 of 2 tests passing)** ").markdownImageProvider(.asset)  (The "This is" part from above: ! [This is] (TestFailedSymbol)           )(without spaces!) (The last 3 statements have a different amount of whitespaces to test if that changes something.)  **Expected behavior** The expected behavior w
  **Post-Mortem & Fix Analysis**:
  > Hi @huber-florian,  Thanks for reporting this issue. It is a side-effect of re-implementing the Markdown rendering with SwiftUI primitives. I have some ideas to fix it for this particular use case. Unfortunately, other use cases, like images inside links with inline text, are impossible to fix until Apple correctly supports images in `AttributedString`.  https://swiftpackageindex.com/gonzalezreal/swift-markdown-ui/2.0.0/documentation/markdownui/inlineimage
  > Hi @huber-florian,  The fix for this issue is now available in the main branch. Please take a look at the Demo project in the **Images** and **Image Providers** screens for the inline image support and the new `markdownInlineImageProvider` modifier.
  > Thank you @gonzalezreal ! It works like a charm.

- **Issue #144** (2023-01-22): **Issue preventing default button activating (macOS)**
  *Symptoms*: With MarkdownUI present on a form and a default button present, e.g.  ```swift         Button(action: {            someAction()          }, label: {             Text("Ok")             }         )         .keyboardShortcut(.defaultAction) ```  When the form is displayed, the default button does not have focus of the `.defaultAction` key binding (i.e. the Enter key). Pressing the default action once does nothing. pressing it again activates the button.  It would pre preferred if the Markdown content did not steal the focus. This issue is not present on forms with no MarkdownUI view.
  **Post-Mortem & Fix Analysis**:
  > Hi @bartreardon,  Sorry for the late response. I just released MarkdownUI 2 and I believe this bug has been fixed:  https://github.com/gonzalezreal/swift-markdown-ui/releases/tag/2.0.0  Could you please check if you can still reproduce it with this version?  Thanks!
  > oh, some nice updates in v2.0, well done 🙂 

- **Issue #119** (2023-01-22): **`DisclosureGroup` display issue**
  *Symptoms*: ## Setup  - iOS 15.5 - iPhone 12  SwiftUI view:  ```swift struct FaqView: View {      let faq: Faq     let navigationBarCtaType: SettingsNavigationCTAType     private let style = AppStyles.Settings()     @State private var expandedIds: Set<String> = Set()      func expanded(id: String) -> Binding<Bool> {         Binding(get: { expandedIds.contains(id) },                 set: {             if $0 {                 expandedIds.insert(id)             } else {                 expandedIds.remove(id)             }         })     }      var body: some View {         List {             ForEach(faq.content) { section in                 DisclosureGroup(isExpanded: expanded(id: section.id)) {                     ForEach(section.questions) { question in                         DisclosureGroup(isExpanded: expanded(id: question.id)) {                             VStack { // Hoped this would help but it doesn't                                 Markdown(question.answer)                             }                         } label: {                             Text(question.title)                         }                     }                 } label: {                     Text(section.title)                 }             }         }         .listStyle(.plain)     } } ```  By default, all disclosure groups are **not** expanded.  Mardown:  ```markdown # Alors  ## Dites  ### moi   **Bold me**  *Ça geht's mol ?*  > Quote me [Link m
  **Post-Mortem & Fix Analysis**:
  > Hi @PierreMardon,  I believe this issue has been fixed in the latest release: https://github.com/gonzalezreal/swift-markdown-ui/releases/tag/2.0.0

- **Issue #105** (2022-07-22): **Custom font not working**
  *Symptoms*: I'm trying to use custom fonts but can't get it to work. It always renders a system default font (Helvetica). I've tried the following solutions so far:  ``` Markdown(viewModel.text).markdownStyle(     MarkdownStyle(         font: MarkdownStyle.Font.custom("CustomFont-Bold", size: 16.0)     ) ) ```  ``` Markdown(viewModel.text).markdownStyle(     MarkdownStyle(         font: MarkdownStyle.Font.custom("CustomFont", size: 16.0)     ) ) ```  ``` Markdown(viewModel.text)     .font(.custom("CustomFont", size: 16.0).bold()) ```  ``` Markdown(viewModel.text)     .font(.custom("CustomFont-Bold", size: 16.0)) ```
  **Post-Mortem & Fix Analysis**:
  > Hi @raulvbrito, Sorry for the late response. Does your custom fonts work with the `Text` view? I am just asking to make sure the issue is not related to properly adding and registering custom fonts to your application.
  > Hi @gonzalezreal, yes the custom font is applied to any `Text` inside my app
  > Hi @raulvbrito, The fix for this issue will be part of the next release. Thanks for reporting.

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

### Incident Patch 1: `98d57f09` (2024-10-15)
**Commit Message**: Fix documentation typos (#354)

* fix: a typo spelling: InlineContentBuilder

* fix: a typo spelling: markdown

**File**: `Sources/MarkdownUI/DSL/Inlines/InlineContentBuilder.swift` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import Foundation
 /// A result builder that you can use to compose Markdown inline content.
 ///
 /// You don't call the methods of the result builder directly. Instead, MarkdownUI annotates the `content` parameter of the
-/// ``Paragraph``, ``Heading``, and ``TextTableColumn`` initializers with the `@InlineContentBuider` attribute,
+/// ``Paragraph``, ``Heading``, and ``TextTableColumn`` initializers with the `@InlineContentBuilder` attribute,
 /// implicitly calling this builder for you.
 @resultBuilder public enum InlineContentBuilder {
   public static func buildBlock(_ components: InlineContentProtocol...) -> InlineContent {
```

**File**: `Sources/MarkdownUI/Theme/BlockStyle/ListMarkerConfiguration.swift` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import SwiftUI
 
-/// The properties of a list marker in a mardown list.
+/// The properties of a list marker in a markdown list.
 ///
 /// The theme ``Theme/bulletedListMarker`` and ``Theme/numberedListMarker``
 /// block styles receive a `ListMarkerConfiguration` input in their `body` closure.
```

---

### Incident Patch 2: `9a8119b3` (2024-06-16)
**Commit Message**: Fix custom font dynamic size (#330)

* Calling `fixedSize` constructor for dynamic type

* Fix tests

---------

Co-authored-by: Mike Lewis <[REDACTED_EMAIL]>

**File**: `Sources/MarkdownUI/Theme/TextStyle/Styles/Font+FontProperties.swift` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ extension Font {
     case .system(let design):
       font = .system(size: size, design: design)
     case .custom(let name):
-      font = .custom(name, size: size)
+      font = .custom(name, fixedSize: size)
     }
 
     switch fontProperties.familyVariant {
```

**File**: `Tests/MarkdownUITests/FontPropertiesTests.swift` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
 
       // then
       XCTAssertEqual(
-        Font.custom("Menlo", size: FontProperties.defaultSize),
+        Font.custom("Menlo", fixedSize: FontProperties.defaultSize),
         Font.withProperties(fontProperties)
       )
 
```

---

### Incident Patch 3: `ba61e69d` (2024-06-16)
**Commit Message**: Fix format workflow (#329)

**File**: `.github/workflows/format.yml` (modified, +5/-7)
```diff
@@ -6,15 +6,13 @@ on:
 jobs:
   format:
     name: swift-format
-    runs-on: macos-12
+    runs-on: macos-13
     steps:
-      - uses: actions/checkout@v2
-      - name: Select Xcode 14.2
-        run: sudo xcode-select -s /Applications/Xcode_14.2.app
-      - name: Tap
-        run: brew tap pointfreeco/formulae
+      - uses: actions/checkout@v4
+      - name: Select Xcode
+        run: sudo xcode-select -s /Applications/Xcode_15.0.app
       - name: Install
-        run: brew install Formulae/swift-format@5.7
+        run: brew install swift-format
       - name: Format
         run: make format
       - uses: stefanzweifel/git-auto-commit-action@v4
```

---

### Incident Patch 4: `993982f2` (2024-06-16)
**Commit Message**: Fix circular reference (#328)

**File**: `Sources/MarkdownUI/Parser/InlineNode.swift` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import Foundation
 
-enum InlineNode: Hashable {
+enum InlineNode: Hashable, Sendable {
   case text(String)
   case softBreak
   case lineBreak
```

---

### Incident Patch 5: `723249a1` (2024-04-15)
**Commit Message**: Fix bullets in visionOS (#308)

Label does not align the icon with the center of the first line like on iOS

Signed-off-by: Antonio Cabezuelo Vivo <[REDACTED_EMAIL]>

**File**: `Sources/MarkdownUI/Views/Blocks/ListItemView.swift` (modified, +25/-0)
```diff
@@ -40,5 +40,30 @@ struct ListItemView: View {
         .readWidth(column: 0)
         .frame(width: self.markerWidth, alignment: .trailing)
     }
+    #if os(visionOS)
+    .labelStyle(BulletItemStyle())
+    #endif
   }
 }
+
+
+extension VerticalAlignment {
+   private enum CenterOfFirstLine: AlignmentID {
+      static func defaultValue(in context: ViewDimensions) -> CGFloat {
+         let heightAfterFirstLine = context[.lastTextBaseline] - context[.firstTextBaseline]
+         let heightOfFirstLine = context.height - heightAfterFirstLine
+         return heightOfFirstLine / 2
+      }
+   }
+   static let centerOfFirstLine = Self(CenterOfFirstLine.self)
+}
+
+
+struct BulletItemStyle: LabelStyle {
+    func makeBody(configuration: Configuration) -> some View {
+        HStack(alignment: .centerOfFirstLine, spacing: 4) {
+            configuration.icon
+            configuration.title
+        }
+    }
+}
```

---

### Incident Patch 6: `4ffe814e` (2023-12-31)
**Commit Message**: `swiftui-snapshot-testing` deprecation: use `assertSnapshot(of:…)` (#284)

**File**: `Tests/MarkdownUITests/MarkdownImageTests.swift` (modified, +6/-6)
```diff
@@ -21,7 +21,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testRelativeImage() {
@@ -49,7 +49,7 @@
         )
       )
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testImageLink() {
@@ -66,7 +66,7 @@
       .padding()
       .markdownImageProvider(AssetImageProvider(bundle: .module))
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testMultipleImages() throws {
@@ -89,7 +89,7 @@
       .padding()
       .markdownImageProvider(AssetImageProvider(bundle: .module))
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testMultipleImagesSize() throws {
@@ -109,7 +109,7 @@
       .padding()
       .markdownImageProvider(AssetImageProvider(bundle: .module))
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testColorScheme() {
@@ -136,7 +136,7 @@
       }
       .markdownImageProvider(AssetImageProvider(bundle: .module))
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
   }
 #endif
```

**File**: `Tests/MarkdownUITests/MarkdownListTests.swift` (modified, +6/-6)
```diff
@@ -19,7 +19,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testBulletedList() {
@@ -36,7 +36,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testBulletedDashedList() {
@@ -54,7 +54,7 @@
       .padding()
       .markdownBulletedListMarker(.dash)
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testNumberedList() {
@@ -81,7 +81,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testRomanNumberedList() {
@@ -103,7 +103,7 @@
       .padding()
       .markdownNumberedListMarker(.lowerRoman)
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testLooseList() {
@@ -129,7 +129,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
   }
 
```

**File**: `Tests/MarkdownUITests/MarkdownTests.swift` (modified, +12/-12)
```diff
@@ -34,7 +34,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testCodeBlock() {
@@ -60,7 +60,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testVerbatimHTML() {
@@ -79,7 +79,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testOpenCodeBlock() {
@@ -93,7 +93,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testParagraphs() {
@@ -111,7 +111,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testCenteredParagraphs() {
@@ -130,7 +130,7 @@
       .padding()
       .multilineTextAlignment(.center)
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testTrailingParagraphs() {
@@ -149,7 +149,7 @@
       .padding()
       .multilineTextAlignment(.trailing)
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testSpacing() {
@@ -171,7 +171,7 @@
           .markdownMargin(bottom: .zero)
       }
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testHeadings() {
@@ -194,7 +194,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testThematicBreak() {
@@ -220,7 +220,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testInlines() {
@@ -250,7 +250,7 @@
       .border(Color.accentColor)
       .padding()
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testInlinesStyling() {
@@ -294,7 +294,7 @@
         UnderlineStyle(.init(pattern: .dot))
       }
 
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
   }
 #endif
```

**File**: `Tests/MarkdownUITests/ThemeDocCTests.swift` (modified, +9/-9)
```diff
@@ -24,7 +24,7 @@
         Use `git status` to list all new or modified files that haven't yet been committed.
         """#
       }
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testHeadings() {
@@ -45,7 +45,7 @@
         Paragraph.
         """#
       }
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testParagraph() {
@@ -60,7 +60,7 @@
         It was a bright cold day in April, and the clocks were striking thirteen.
         """#
       }
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testBlockquote() {
@@ -73,7 +73,7 @@
         It was a bright cold day in April, and the clocks were striking thirteen.
         """#
       }
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testCodeBlock() {
@@ -93,7 +93,7 @@
         It was a bright cold day in April, and the clocks were striking thirteen.
         """#
       }
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testImage() throws {
@@ -116,7 +116,7 @@
         """#
       }
       .markdownImageProvider(AssetImageProvider(bundle: .module))
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testList() {
@@ -143,7 +143,7 @@
         - [ ] An unfinished task
         """#
       }
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testTable() throws {
@@ -162,7 +162,7 @@
         | `fast`       | Moves faster than a hare.             |
         """#
       }
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
 
     func testThematicBreak() {
@@ -175,7 +175,7 @@
         It was a bright cold day in April, and the clocks were striking thirteen.
         """#
       }
-      assertSnapshot(matching: view, as: .image(layout: layout))
+      assertSnapshot(of: view, as: .image(layout: layout))
     }
   }
 
```

---

### Incident Patch 7: `8f6affc8` (2023-12-31)
**Commit Message**: fix macCatalyst build failure: re-order `#if canImport(UIKit)` (#283)

by placing `#if canImport(UIKit)` first, it means that building for
`#if targetEnvironment(macCatalyst)` doesn't fail attempting to use
and link in `AppKit` things (since `macCatalyst` apps can link both
`UIKit` and `AppKit`

**File**: `Sources/MarkdownUI/Extensibility/AssetImageProvider.swift` (modified, +3/-3)
```diff
@@ -38,14 +38,14 @@ public struct AssetImageProvider: ImageProvider {
   }
 
   private func image(url: URL) -> PlatformImage? {
-    #if canImport(AppKit)
+    #if canImport(UIKit)
+      return UIImage(named: self.name(url), in: self.bundle, with: nil)
+    #elseif canImport(AppKit)
       if let bundle, bundle != .main {
         return bundle.image(forResource: self.name(url))
       } else {
         return NSImage(named: self.name(url))
       }
-    #elseif canImport(UIKit)
-      return UIImage(named: self.name(url), in: self.bundle, with: nil)
     #endif
   }
 }
```

**File**: `Sources/MarkdownUI/Utility/Color+RGBA.swift` (modified, +11/-11)
```diff
@@ -17,17 +17,7 @@ extension Color {
   ///   - light: The light appearance color value.
   ///   - dark: The dark appearance color value.
   public init(light: @escaping @autoclosure () -> Color, dark: @escaping @autoclosure () -> Color) {
-    #if canImport(AppKit)
-      self.init(
-        nsColor: .init(name: nil) { appearance in
-          if appearance.bestMatch(from: [.aqua, .darkAqua]) == .aqua {
-            return NSColor(light())
-          } else {
-            return NSColor(dark())
-          }
-        }
-      )
-    #elseif os(watchOS)
+    #if os(watchOS)
       self = dark()
     #elseif canImport(UIKit)
       self.init(
@@ -42,6 +32,16 @@ extension Color {
           }
         }
       )
+    #elseif canImport(AppKit)
+      self.init(
+        nsColor: .init(name: nil) { appearance in
+          if appearance.bestMatch(from: [.aqua, .darkAqua]) == .aqua {
+            return NSColor(light())
+          } else {
+            return NSColor(dark())
+          }
+        }
+      )
     #endif
   }
 }
```

---

### Incident Patch 8: `559dd00a` (2023-09-10)
**Commit Message**: Add `MarkdownContent` HTML rendering (#253)

**File**: `Sources/MarkdownUI/DSL/Blocks/MarkdownContent.swift` (modified, +5/-0)
```diff
@@ -108,4 +108,9 @@ public struct MarkdownContent: Equatable, MarkdownContentProtocol {
     let result = self.blocks.renderPlainText()
     return result.hasSuffix("\n") ? String(result.dropLast()) : result
   }
+
+  /// Renders this Markdown content value as HTML code.
+  public func renderHTML() -> String {
+    self.blocks.renderHTML()
+  }
 }
```

**File**: `Sources/MarkdownUI/Parser/MarkdownParser.swift` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@ extension Array where Element == BlockNode {
       String(cString: cmark_render_plaintext(document, CMARK_OPT_DEFAULT, 0))
     } ?? ""
   }
+
+  func renderHTML() -> String {
+    UnsafeNode.makeDocument(self) { document in
+      String(cString: cmark_render_html(document, CMARK_OPT_DEFAULT, nil))
+    } ?? ""
+  }
 }
 
 extension BlockNode {
```

---

### Incident Patch 9: `a20063b7` (2023-09-03)
**Commit Message**: Fix code block truncation (#256)

* Fix unexpected code block truncation

* Remove unused code

* Update SnapshotTesting package

**File**: `Examples/Demo/Demo/ContentView.swift` (modified, +0/-10)
```diff
@@ -100,16 +100,6 @@ struct ContentView: View {
   }
 }
 
-extension HorizontalAlignment {
-  private struct RowTitleAlignment: AlignmentID {
-    static func defaultValue(in context: ViewDimensions) -> CGFloat {
-      context[HorizontalAlignment.leading]
-    }
-  }
-
-  static let rowTitleAligmentGuide = HorizontalAlignment(RowTitleAlignment.self)
-}
-
 struct ContentView_Previews: PreviewProvider {
   static var previews: some View {
     ContentView()
```

**File**: `Package.resolved` (modified, +2/-2)
```diff
@@ -5,8 +5,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-snapshot-testing",
       "state" : {
-        "revision" : "f29e2014f6230cf7d5138fc899da51c7f513d467",
-        "version" : "1.10.0"
+        "revision" : "26ed3a2b4a2df47917ca9b790a57f91285b923fb",
+        "version" : "1.12.0"
       }
     }
   ],
```

**File**: `Sources/MarkdownUI/Theme/Theme+Basic.swift` (modified, +1/-0)
```diff
@@ -84,6 +84,7 @@ extension Theme {
     .codeBlock { configuration in
       ScrollView(.horizontal) {
         configuration.label
+          .fixedSize(horizontal: false, vertical: true)
           .relativeLineSpacing(.em(0.15))
           .relativePadding(.leading, length: .rem(1))
           .markdownTextStyle {
```

**File**: `Sources/MarkdownUI/Theme/Theme+DocC.swift` (modified, +1/-0)
```diff
@@ -96,6 +96,7 @@ extension Theme {
     .codeBlock { configuration in
       ScrollView(.horizontal) {
         configuration.label
+          .fixedSize(horizontal: false, vertical: true)
           .relativeLineSpacing(.em(0.333335))
           .markdownTextStyle {
             FontFamilyVariant(.monospaced)
```

**File**: `Sources/MarkdownUI/Theme/Theme+GitHub.swift` (modified, +1/-0)
```diff
@@ -113,6 +113,7 @@ extension Theme {
     .codeBlock { configuration in
       ScrollView(.horizontal) {
         configuration.label
+          .fixedSize(horizontal: false, vertical: true)
           .relativeLineSpacing(.em(0.225))
           .markdownTextStyle {
             FontFamilyVariant(.monospaced)
```

---

### Incident Patch 10: `ffb2d80d` (2023-04-15)
**Commit Message**: Move fixedSize modifier to themes (#222)

**File**: `Sources/MarkdownUI/Theme/Theme+Basic.swift` (modified, +3/-0)
```diff
@@ -69,6 +69,7 @@ extension Theme {
     }
     .paragraph { configuration in
       configuration.label
+        .fixedSize(horizontal: false, vertical: true)
         .relativeLineSpacing(.em(0.15))
         .markdownMargin(top: .zero, bottom: .em(1))
     }
@@ -94,6 +95,7 @@ extension Theme {
     }
     .table { configuration in
       configuration.label
+        .fixedSize(horizontal: false, vertical: true)
         .markdownMargin(top: .zero, bottom: .em(1))
     }
     .tableCell { configuration in
@@ -103,6 +105,7 @@ extension Theme {
             FontWeight(.semibold)
           }
         }
+        .fixedSize(horizontal: false, vertical: true)
         .relativeLineSpacing(.em(0.15))
         .relativePadding(.horizontal, length: .em(0.72))
         .relativePadding(.vertical, length: .em(0.35))
```

**File**: `Sources/MarkdownUI/Theme/Theme+DocC.swift` (modified, +3/-0)
```diff
@@ -75,6 +75,7 @@ extension Theme {
     }
     .paragraph { configuration in
       configuration.label
+        .fixedSize(horizontal: false, vertical: true)
         .relativeLineSpacing(.em(0.235295))
         .markdownMargin(top: .em(0.8), bottom: .zero)
     }
@@ -123,6 +124,7 @@ extension Theme {
     }
     .table { configuration in
       configuration.label
+        .fixedSize(horizontal: false, vertical: true)
         .markdownTableBorderStyle(.init(.horizontalBorders, color: .grid))
         .markdownMargin(top: .em(1.6), bottom: .zero)
     }
@@ -133,6 +135,7 @@ extension Theme {
             FontWeight(.semibold)
           }
         }
+        .fixedSize(horizontal: false, vertical: true)
         .relativeLineSpacing(.em(0.235295))
         .relativePadding(length: .rem(0.58824))
     }
```

**File**: `Sources/MarkdownUI/Theme/Theme+GitHub.swift` (modified, +3/-0)
```diff
@@ -95,6 +95,7 @@ extension Theme {
     }
     .paragraph { configuration in
       configuration.label
+        .fixedSize(horizontal: false, vertical: true)
         .relativeLineSpacing(.em(0.25))
         .markdownMargin(top: 0, bottom: 16)
     }
@@ -136,6 +137,7 @@ extension Theme {
     }
     .table { configuration in
       configuration.label
+        .fixedSize(horizontal: false, vertical: true)
         .markdownTableBorderStyle(.init(color: .border))
         .markdownTableBackgroundStyle(
           .alternatingRows(Color.background, Color.secondaryBackground)
@@ -150,6 +152,7 @@ extension Theme {
           }
           BackgroundColor(nil)
         }
+        .fixedSize(horizontal: false, vertical: true)
         .padding(.vertical, 6)
         .padding(.horizontal, 13)
         .relativeLineSpacing(.em(0.25))
```

**File**: `Sources/MarkdownUI/Views/Inlines/InlineText.swift` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ struct InlineText: View {
     .task(id: self.inlines) {
       self.inlineImages = (try? await self.loadInlineImages()) ?? [:]
     }
-    .fixedSize(horizontal: false, vertical: true)
   }
 
   private func loadInlineImages() async throws -> [String: Image] {
```

---

### Incident Patch 11: `3830c4c7` (2023-04-15)
**Commit Message**: Render HTML line breaks (#221)

**File**: `Sources/MarkdownUI/Parser/HTMLTag.swift` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import Foundation
+
+struct HTMLTag {
+  let name: String
+}
+
+extension HTMLTag {
+  private enum Constants {
+    static let tagExpression = try! NSRegularExpression(pattern: "<\\/?([a-zA-Z0-9]+)[^>]*>")
+  }
+
+  init?(_ description: String) {
+    guard
+      let match = Constants.tagExpression.firstMatch(
+        in: description,
+        range: NSRange(description.startIndex..., in: description)
+      ),
+      let nameRange = Range(match.range(at: 1), in: description)
+    else {
+      return nil
+    }
+
+    self.name = String(description[nameRange])
+  }
+}
```

**File**: `Sources/MarkdownUI/Renderer/AttributedStringInlineRenderer.swift` (modified, +29/-9)
```diff
@@ -22,6 +22,7 @@ private struct AttributedStringInlineRenderer {
   private let baseURL: URL?
   private let textStyles: InlineTextStyles
   private var attributes: AttributeContainer
+  private var shouldSkipNextWhitespace = false
 
   init(baseURL: URL?, textStyles: InlineTextStyles, attributes: AttributeContainer) {
     self.baseURL = baseURL
@@ -55,26 +56,45 @@ private struct AttributedStringInlineRenderer {
   }
 
   private mutating func renderText(_ text: String) {
+    var text = text
+
+    if self.shouldSkipNextWhitespace {
+      self.shouldSkipNextWhitespace = false
+      text = text.replacingOccurrences(of: "^\\s+", with: "", options: .regularExpression)
+    }
+
     self.result += .init(text, attributes: self.attributes)
   }
 
   private mutating func renderSoftBreak() {
-    self.result += .init(" ", attributes: self.attributes)
+    if self.shouldSkipNextWhitespace {
+      self.shouldSkipNextWhitespace = false
+    } else {
+      self.result += .init(" ", attributes: self.attributes)
+    }
   }
 
   private mutating func renderLineBreak() {
     self.result += .init("\n", attributes: self.attributes)
   }
 
-  mutating func renderCode(_ code: String) {
+  private mutating func renderCode(_ code: String) {
     self.result += .init(code, attributes: self.textStyles.code.mergingAttributes(self.attributes))
   }
 
-  mutating func renderHTML(_ html: String) {
-    self.result += .init(html, attributes: self.attributes)
+  private mutating func renderHTML(_ html: String) {
+    let tag = HTMLTag(html)
+
+    switch tag?.name.lowercased() {
+    case "br":
+      self.renderLineBreak()
+      self.shouldSkipNextWhitespace = true
+    default:
+      self.renderText(html)
+    }
   }
 
-  mutating func renderEmphasis(children: [InlineNode]) {
+  private mutating func renderEmphasis(children: [InlineNode]) {
     let savedAttributes = self.attributes
     self.attributes = self.textStyles.emphasis.mergingAttributes(self.attributes)
 
@@ -85,7 +105,7 @@ private struct AttributedStringInlineRenderer {
     self.attributes = savedAttributes
   }
 
-  mutating func renderStrong(children: [InlineNode]) {
+  private mutating func renderStrong(children: [InlineNode]) {
     let savedAttributes = self.attributes
     self.attributes = self.textStyles.strong.mergingAttributes(self.attributes)
 
@@ -96,7 +116,7 @@ private struct AttributedStringInlineRenderer {
     self.attributes = savedAttributes
   }
 
-  mutating func renderStrikethrough(children: [InlineNode]) {
+  private mutating func renderStrikethrough(children: [InlineNode]) {
     let savedAttributes = self.attributes
     self.attributes = self.textStyles.strikethrough.mergingAttributes(self.attributes)
 
@@ -107,7 +127,7 @@ private struct AttributedStringInlineRenderer {
     self.attributes = savedAttributes
   }
 
-  mutating func renderLink(destination: String, children: [InlineNode]) {
+  private mutating func renderLink(destination: String, children: [InlineNode]) {
     let savedAttributes = self.attributes
     self.attributes = self.textStyles.link.mergingAttributes(self.attributes)
     self.attributes.link = URL(string: destination, relativeTo: self.baseURL)
@@ -119,7 +139,7 @@ private struct AttributedStringInlineRenderer {
     self.attributes = savedAttributes
   }
 
-  mutating func renderImage(source: String, children: [InlineNode]) {
+  private mutating func renderImage(source: String, children: [InlineNode]) {
     // AttributedString does not support images
   }
 }
```

**File**: `Sources/MarkdownUI/Renderer/TextInlineRenderer.swift` (modified, +58/-12)
```diff
@@ -25,6 +25,7 @@ private struct TextInlineRenderer {
   private let textStyles: InlineTextStyles
   private let images: [String: Image]
   private let attributes: AttributeContainer
+  private var shouldSkipNextWhitespace = false
 
   init(
     baseURL: URL?,
@@ -46,20 +47,65 @@ private struct TextInlineRenderer {
 
   private mutating func render(_ inline: InlineNode) {
     switch inline {
+    case .text(let content):
+      self.renderText(content)
+    case .softBreak:
+      self.renderSoftBreak()
+    case .html(let content):
+      self.renderHTML(content)
     case .image(let source, _):
-      if let image = self.images[source] {
-        self.result = self.result + Text(image)
-      }
+      self.renderImage(source)
     default:
-      self.result =
-        self.result
-        + Text(
-          inline.renderAttributedString(
-            baseURL: self.baseURL,
-            textStyles: self.textStyles,
-            attributes: self.attributes
-          )
-        )
+      self.defaultRender(inline)
+    }
+  }
+
+  private mutating func renderText(_ text: String) {
+    var text = text
+
+    if self.shouldSkipNextWhitespace {
+      self.shouldSkipNextWhitespace = false
+      text = text.replacingOccurrences(of: "^\\s+", with: "", options: .regularExpression)
+    }
+
+    self.defaultRender(.text(text))
+  }
+
+  private mutating func renderSoftBreak() {
+    if self.shouldSkipNextWhitespace {
+      self.shouldSkipNextWhitespace = false
+    } else {
+      self.defaultRender(.softBreak)
+    }
+  }
+
+  private mutating func renderHTML(_ html: String) {
+    let tag = HTMLTag(html)
+
+    switch tag?.name.lowercased() {
+    case "br":
+      self.defaultRender(.lineBreak)
+      self.shouldSkipNextWhitespace = true
+    default:
+      self.defaultRender(.html(html))
+    }
+  }
+
+  private mutating func renderImage(_ source: String) {
+    if let image = self.images[source] {
+      self.result = self.result + Text(image)
     }
   }
+
+  private mutating func defaultRender(_ inline: InlineNode) {
+    self.result =
+      self.result
+      + Text(
+        inline.renderAttributedString(
+          baseURL: self.baseURL,
+          textStyles: self.textStyles,
+          attributes: self.attributes
+        )
+      )
+  }
 }
```

**File**: `Tests/MarkdownUITests/HTMLTagTests.swift` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import Foundation
+import XCTest
+
+@testable import MarkdownUI
+
+final class HTMLTagTests: XCTestCase {
+  func testInvalidTag() {
+    XCTAssertNil(HTMLTag(""))
+    XCTAssertNil(HTMLTag("foo"))
+    XCTAssertNil(HTMLTag("<"))
+    XCTAssertNil(HTMLTag("<>"))
+  }
+
+  func testOpeningTag() {
+    // given
+    let tag = HTMLTag("<sub>")
+
+    // then
+    XCTAssertEqual("sub", tag?.name)
+  }
+
+  func testOpeningTagWithAttributes() {
+    // given
+    let tag = HTMLTag(
+      "<img src=\"img_girl.jpg\" alt=\"Girl in a jacket\" width=\"500\" height=\"600\">"
+    )
+
+    // then
+    XCTAssertEqual("img", tag?.name)
+  }
+
+  func testClosingTag() {
+    let tag = HTMLTag("</sub>")
+    XCTAssertEqual(tag?.name, "sub")
+  }
+
+  func testSelfClosingTag() {
+    XCTAssertEqual("br", HTMLTag("<br />")?.name)
+  }
+}
```

**File**: `Tests/MarkdownUITests/MarkdownTests.swift` (modified, +4/-0)
```diff
@@ -241,6 +241,10 @@
         Visit https://github.com.
 
         Use `git status` to list all new or modified files that haven't yet been committed.
+
+        You can insert a line break<br>
+        using the HTML `<br>`
+        <br>      tag.
         """#
       }
       .border(Color.accentColor)
```

---

### Incident Patch 12: `66dcceca` (2023-04-05)
**Commit Message**: Fix deprecation message (#214)

**File**: `Sources/MarkdownUI/Utility/Deprecations.swift` (modified, +1/-5)
```diff
@@ -65,11 +65,7 @@ extension View {
   @available(
     *,
     unavailable,
-    message:
-      """
-     "MarkdownImageHandler" has been superseded by the "ImageProvider" protocol and its conforming
-     types "DefaultImageProvider" and "AssetImageProvider".
-     """
+    message: "You can create a custom link action by overriding the \"openURL\" environment value."
   )
   public func onOpenMarkdownLink(perform action: ((URL) -> Void)? = nil) -> some View {
     self
```

---

### Incident Patch 13: `71c42406` (2023-04-05)
**Commit Message**: Refactor Markdown parsing and implement the `renderMarkdown()` method. (#210)

**File**: `Sources/MarkdownUI/Common/MarkdownContent+ColorScheme.swift` (removed, +0/-112)
```diff
@@ -1,112 +0,0 @@
-import SwiftUI
-
-extension MarkdownContent {
-  func colorScheme(_ colorScheme: ColorScheme) -> Self {
-    .init(blocks: self.blocks.colorScheme(colorScheme))
-  }
-}
-
-extension Block {
-  fileprivate func colorScheme(_ colorScheme: ColorScheme) -> Self {
-    switch self {
-    case .blockquote(let array):
-      return .blockquote(array.colorScheme(colorScheme))
-    case .taskList(let tight, let items):
-      return .taskList(tight: tight, items: items.colorScheme(colorScheme))
-    case .bulletedList(let tight, let items):
-      return .bulletedList(tight: tight, items: items.colorScheme(colorScheme))
-    case .numberedList(let tight, let start, let items):
-      return .numberedList(tight: tight, start: start, items: items.colorScheme(colorScheme))
-    case .codeBlock, .htmlBlock, .thematicBreak:
-      return self
-    case .paragraph(let array):
-      return .paragraph(array.colorScheme(colorScheme))
-    case .heading(let level, let text):
-      return .heading(level: level, text: text.colorScheme(colorScheme))
-    case .table(let columnAlignments, let rows):
-      return .table(
-        columnAlignments: columnAlignments,
-        rows: rows.map { columns in
-          columns.map { cell in
-            cell.colorScheme(colorScheme)
-          }
-        }
-      )
-    }
-  }
-}
-
-extension Array where Element == Block {
-  fileprivate func colorScheme(_ colorScheme: ColorScheme) -> Self {
-    self.map { $0.colorScheme(colorScheme) }
-  }
-}
-
-extension TaskListItem {
-  fileprivate func colorScheme(_ colorScheme: ColorScheme) -> Self {
-    .init(isCompleted: self.isCompleted, blocks: self.blocks.colorScheme(colorScheme))
-  }
-}
-
-extension Array where Element == TaskListItem {
-  fileprivate func colorScheme(_ colorScheme: ColorScheme) -> Self {
-    self.map { $0.colorScheme(colorScheme) }
-  }
-}
-
-extension ListItem {
-  fileprivate func colorScheme(_ colorScheme: ColorScheme) -> Self {
-    .init(blocks: self.blocks.colorScheme(colorScheme))
-  }
-}
-
-extension Array where Element == ListItem {
-  fileprivate func colorScheme(_ colorScheme: ColorScheme) -> Self {
-    self.map { $0.colorScheme(colorScheme) }
-  }
-}
-
-extension Inline {
-  fileprivate func colorScheme(_ colorScheme: ColorScheme) -> Inline? {
-    switch self {
-    case .text, .softBreak, .lineBreak, .code, .html:
-      return self
-    case .emphasis(let children):
-      return .emphasis(children.colorScheme(colorScheme))
-    case .strong(let children):
-      return .strong(children.colorScheme(colorScheme))
-    case .strikethrough(let children):
-      return .strikethrough(children.colorScheme(colorScheme))
-    case .link(let destination, let children):
-      return .link(destination: destination, children: children.colorScheme(colorScheme))
-    case .image(let source, _):
-      guard let url = URL(string: source) else {
-        return self
-      }
-      return url.matchesColorScheme(colorScheme) ? self : nil
-    }
-  }
-}
-
-extension Array where Element == Inline {
-  fileprivate func colorScheme(_ colorScheme: ColorScheme) -> Self {
-    self.compactMap { $0.colorScheme(colorScheme) }
-  }
-}
-
-extension URL {
-  fileprivate func matchesColorScheme(_ colorScheme: ColorScheme) -> Bool {
-    guard let fragment = self.fragment?.lowercased() else {
-      return true
-    }
-
-    switch colorScheme {
-    case .light:
-      return fragment != "gh-dark-mode-only"
-    case .dark:
-      return fragment != "gh-light-mode-only"
-    @unknown default:
-      return true
-    }
-  }
-}
```

**File**: `Sources/MarkdownUI/Content/Blocks/Block.swift` (removed, +0/-118)
```diff
@@ -1,118 +0,0 @@
-import Foundation
-@_implementationOnly import cmark_gfm
-
-enum Block: Hashable {
-  case blockquote([Block])
-  case taskList(tight: Bool, items: [TaskListItem])
-  case bulletedList(tight: Bool, items: [ListItem])
-  case numberedList(tight: Bool, start: Int, items: [ListItem])
-  case codeBlock(info: String?, content: String)
-  case htmlBlock(String)
-  case paragraph([Inline])
-  case heading(level: Int, text: [Inline])
-  case table(columnAlignments: [TextTableColumnAlignment?], rows: [[[Inline]]])
-  case thematicBreak
-}
-
-extension Block {
-  init?(node: CommonMarkNode) {
-    switch node.type {
-    case CMARK_NODE_BLOCK_QUOTE:
-      self = .blockquote(node.children.compactMap(Block.init(node:)))
-    case CMARK_NODE_LIST where node.hasTaskItems:
-      self = .taskList(
-        tight: node.listTight,
-        items: node.children.compactMap(TaskListItem.init(node:))
-      )
-    case CMARK_NODE_LIST where node.listType == CMARK_BULLET_LIST:
-      self = .bulletedList(
-        tight: node.listTight,
-        items: node.children.compactMap(ListItem.init(node:))
-      )
-    case CMARK_NODE_LIST where node.listType == CMARK_ORDERED_LIST:
-      self = .numberedList(
-        tight: node.listTight,
-        start: node.listStart,
-        items: node.children.compactMap(ListItem.init(node:))
-      )
-    case CMARK_NODE_CODE_BLOCK:
-      self = .codeBlock(info: node.fenceInfo, content: node.literal!)
-    case CMARK_NODE_HTML_BLOCK:
-      self = .htmlBlock(node.literal!)
-    case CMARK_NODE_PARAGRAPH:
-      self = .paragraph(node.children.compactMap(Inline.init(node:)))
-    case CMARK_NODE_HEADING:
-      self = .heading(level: node.headingLevel, text: node.children.compactMap(Inline.init(node:)))
-    case CMARK_NODE_TABLE:
-      self = .table(
-        columnAlignments: node.tableAlignments.map(TextTableColumnAlignment.init),
-        rows: node.children.compactMap { rowNode in
-          guard rowNode.type == CMARK_NODE_TABLE_ROW else {
-            return nil
-          }
-          return rowNode.children.compactMap { cellNode in
-            guard cellNode.type == CMARK_NODE_TABLE_CELL else {
-              return nil
-            }
-            return cellNode.children.compactMap(Inline.init(node:))
-          }
-        }
-      )
-    case CMARK_NODE_THEMATIC_BREAK:
-      self = .thematicBreak
-    default:
-      assertionFailure("Unknown block type '\(node.typeString)'")
-      return nil
-    }
-  }
-
-  var isParagraph: Bool {
-    guard case .paragraph = self else { return false }
-    return true
-  }
-}
-
-extension Array where Element == Block {
-  init(markdown: String) {
-    let node = CommonMarkNode(markdown: markdown, extensions: .all, options: CMARK_OPT_DEFAULT)
-    let blocks = node?.children.compactMap(Block.init(node:)) ?? []
-
-    self.init(blocks)
-  }
-}
-
-extension ListItem {
-  fileprivate init?(node: CommonMarkNode) {
-    guard node.type == CMARK_NODE_ITEM else {
-      return nil
-    }
-    self.init(blocks: .init(node.children.compactMap(Block.init(node:))))
-  }
-}
-
-extension TaskListItem {
-  fileprivate init?(node: CommonMarkNode) {
-    guard node.type == CMARK_NODE_ITEM else {
-      return nil
-    }
-    self.init(
-      isCompleted: node.isTaskListItemChecked,
-      blocks: .init(node.children.compactMap(Block.init(node:)))
-    )
-  }
-}
-
-extension TextTableColumnAlignment {
-  fileprivate init?(_ character: Character) {
-    switch character {
-    case "l":
-      self = .leading
-    case "c":
-      self = .center
-    case "r":
-      self = .trailing
-    default:
-      return nil
-    }
-  }
-}
```

**File**: `Sources/MarkdownUI/Content/CommonMarkExtension.swift` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
-import Foundation
-
-struct CommonMarkExtension: Hashable, RawRepresentable {
-  let rawValue: String
-
-  init(rawValue: String) {
-    self.rawValue = rawValue
-  }
-}
-
-extension CommonMarkExtension {
-  static let autolink = Self(rawValue: "autolink")
-  static let strikethrough = Self(rawValue: "strikethrough")
-  static let tagfilter = Self(rawValue: "tagfilter")
-  static let tasklist = Self(rawValue: "tasklist")
-}
-
-@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
-extension CommonMarkExtension {
-  static let table = Self(rawValue: "table")
-}
-
-extension Set where Element == CommonMarkExtension {
-  static let all: Self = {
-    if #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *) {
-      return [.autolink, .strikethrough, .table, .tagfilter, .tasklist]
-    } else {
-      return [.autolink, .strikethrough, .tagfilter, .tasklist]
-    }
-  }()
-}
```

**File**: `Sources/MarkdownUI/Content/CommonMarkNode.swift` (removed, +0/-155)
```diff
@@ -1,155 +0,0 @@
-import Foundation
-@_implementationOnly import cmark_gfm
-
-class CommonMarkNode {
-  private let pointer: UnsafeMutablePointer<cmark_node>
-
-  init(pointer: UnsafeMutablePointer<cmark_node>) {
-    self.pointer = pointer
-  }
-
-  convenience init?(markdown: String, extensions: Set<CommonMarkExtension>, options: Int32) {
-    cmark_gfm_core_extensions_ensure_registered()
-
-    let parser = cmark_parser_new(options)
-    defer {
-      cmark_parser_free(parser)
-    }
-
-    for `extension` in extensions {
-      guard let syntaxExtension = cmark_find_syntax_extension(`extension`.rawValue) else {
-        continue
-      }
-      cmark_parser_attach_syntax_extension(parser, syntaxExtension)
-    }
-
-    cmark_parser_feed(parser, markdown, markdown.utf8.count)
-
-    guard let pointer = cmark_parser_finish(parser) else {
-      return nil
-    }
-
-    self.init(pointer: pointer)
-  }
-
-  deinit {
-    guard type == CMARK_NODE_DOCUMENT else {
-      return
-    }
-    cmark_node_free(pointer)
-  }
-}
-
-extension CommonMarkNode {
-  struct Sequence: Swift.Sequence {
-    struct Iterator: IteratorProtocol {
-      private var pointer: UnsafeMutablePointer<cmark_node>?
-
-      init(pointer: UnsafeMutablePointer<cmark_node>?) {
-        self.pointer = pointer
-      }
-
-      mutating func next() -> CommonMarkNode? {
-        guard let pointer = pointer else {
-          return nil
-        }
-
-        defer {
-          self.pointer = cmark_node_next(pointer)
-        }
-
-        return CommonMarkNode(pointer: pointer)
-      }
-    }
-
-    private let pointer: UnsafeMutablePointer<cmark_node>?
-
-    init(pointer: UnsafeMutablePointer<cmark_node>?) {
-      self.pointer = pointer
-    }
-
-    func makeIterator() -> Iterator {
-      Iterator(pointer: pointer)
-    }
-  }
-
-  var children: CommonMarkNode.Sequence {
-    .init(pointer: cmark_node_first_child(pointer))
-  }
-}
-
-extension CommonMarkNode {
-  var type: cmark_node_type {
-    cmark_node_get_type(pointer)
-  }
-
-  var typeString: String {
-    String(cString: cmark_node_get_type_string(pointer))
-  }
-
-  var literal: String? {
-    guard let literal = cmark_node_get_literal(pointer) else { return nil }
-    return String(cString: literal)
-  }
-
-  var url: String? {
-    guard let url = cmark_node_get_url(pointer) else { return nil }
-    return String(cString: url)
-  }
-
-  var title: String? {
-    guard let title = cmark_node_get_title(pointer) else { return nil }
-    return String(cString: title)
-  }
-
-  var fenceInfo: String? {
-    guard let fenceInfo = cmark_node_get_fence_info(pointer) else { return nil }
-    return String(cString: fenceInfo)
-  }
-
-  var listType: cmark_list_type {
-    cmark_node_get_list_type(pointer)
-  }
-
-  var hasTaskItems: Bool {
-    children.contains { node in
-      node.isTaskListItem
-    }
-  }
-
-  var isTaskListItem: Bool {
-    type == CMARK_NODE_ITEM && typeString == "tasklist"
-  }
-
-  var isTaskListItemChecked: Bool {
-    cmark_gfm_extensions_get_tasklist_item_checked(pointer)
-  }
-
-  var listStart: Int {
-    Int(cmark_node_get_list_start(pointer))
-  }
-
-  var listTight: Bool {
-    cmark_node_get_list_tight(pointer) != 0
-  }
-
-  var headingLevel: Int {
-    Int(cmark_node_get_heading_level(pointer))
-  }
-
-  var tableColumns: Int {
-    Int(cmark_gfm_extensions_get_table_columns(pointer))
-  }
-
-  var tableAlignments: [Character] {
-    UnsafeBufferPointer(
-      start: cmark_gfm_extensions_get_table_alignments(pointer),
-      count: tableColumns
-    )
-    .map { Character(.init($0)) }
-  }
-
-  var isTableHeader: Bool {
-    (cmark_gfm_extensions_get_table_row_is_header(pointer) != 0)
-  }
-}
```

**File**: `Sources/MarkdownUI/Content/Inlines/Inline.swift` (removed, +0/-104)
```diff
@@ -1,104 +0,0 @@
-import Foundation
-@_implementationOnly import cmark_gfm
-
-enum Inline: Hashable {
-  case text(String)
-  case softBreak
-  case lineBreak
-  case code(String)
-  case html(String)
-  case emphasis([Inline])
-  case strong([Inline])
-  case strikethrough([Inline])
-  case link(destination: String, children: [Inline])
-  case image(source: String, children: [Inline])
-}
-
-extension Inline {
-  init?(node: CommonMarkNode) {
-    switch node.type {
-    case CMARK_NODE_TEXT:
-      self = .text(node.literal!)
-    case CMARK_NODE_SOFTBREAK:
-      self = .softBreak
-    case CMARK_NODE_LINEBREAK:
-      self = .lineBreak
-    case CMARK_NODE_CODE:
-      self = .code(node.literal!)
-    case CMARK_NODE_HTML_INLINE:
-      self = .html(node.literal!)
-    case CMARK_NODE_EMPH:
-      self = .emphasis(node.children.compactMap(Inline.init(node:)))
-    case CMARK_NODE_STRONG:
-      self = .strong(node.children.compactMap(Inline.init(node:)))
-    case CMARK_NODE_STRIKETHROUGH:
-      self = .strikethrough(node.children.compactMap(Inline.init(node:)))
-    case CMARK_NODE_LINK:
-      self = .link(
-        destination: node.url ?? "",
-        children: node.children.compactMap(Inline.init(node:))
-      )
-    case CMARK_NODE_IMAGE:
-      self = .image(
-        source: node.url ?? "",
-        children: node.children.compactMap(Inline.init(node:))
-      )
-    default:
-      assertionFailure("Unknown inline type '\(node.typeString)'")
-      return nil
-    }
-  }
-
-  var text: String {
-    switch self {
-    case .text(let content):
-      return content
-    case .softBreak:
-      return " "
-    case .lineBreak:
-      return "\n"
-    case .code(let content):
-      return content
-    case .html(let content):
-      return content
-    case .emphasis(let children):
-      return children.text
-    case .strong(let children):
-      return children.text
-    case .strikethrough(let children):
-      return children.text
-    case .link(_, let children):
-      return children.text
-    case .image(_, let children):
-      return children.text
-    }
-  }
-}
-
-extension Array where Element == Inline {
-  var text: String {
-    map(\.text).joined()
-  }
-}
-
-extension Inline {
-  struct Image: Hashable {
-    var source: String?
-    var alt: String
-    var destination: String?
-  }
-
-  var image: Image? {
-    switch self {
-    case let .image(source, children):
-      return .init(source: source, alt: children.text)
-    case let .link(destination, children) where children.count == 1:
-      guard case let .some(.image(source, children)) = children.first else {
-        return nil
-      }
-      return .init(source: source, alt: children.text, destination: destination)
-    default:
-      return nil
-    }
-  }
-}
```

**File**: `Sources/MarkdownUI/DSL/Blocks/Blockquote.swift` (renamed, +1/-1)
```diff
@@ -21,7 +21,7 @@ import Foundation
 /// ![](BlockquoteContent)
 public struct Blockquote: MarkdownContentProtocol {
   public var _markdownContent: MarkdownContent {
-    .init(blocks: [.blockquote(content.blocks)])
+    .init(blocks: [.blockquote(children: content.blocks)])
   }
 
   private let content: MarkdownContent
```

**File**: `Sources/MarkdownUI/DSL/Blocks/BulletedList.swift` (renamed, +4/-4)
```diff
@@ -63,20 +63,20 @@ import Foundation
 /// ![](NestedBulletedList)
 public struct BulletedList: MarkdownContentProtocol {
   public var _markdownContent: MarkdownContent {
-    .init(blocks: [.bulletedList(tight: self.tight, items: self.items)])
+    .init(blocks: [.bulletedList(isTight: self.tight, items: self.items)])
   }
 
   private let tight: Bool
-  private let items: [ListItem]
+  private let items: [RawListItem]
 
   init(tight: Bool, items: [ListItem]) {
     // Force loose spacing if any of the items contains more than one paragraph
     let hasItemsWithMultipleParagraphs = items.contains { item in
-      item.blocks.filter(\.isParagraph).count > 1
+      item.children.filter(\.isParagraph).count > 1
     }
 
     self.tight = hasItemsWithMultipleParagraphs ? false : tight
-    self.items = items
+    self.items = items.map(\.children).map(RawListItem.init)
   }
 
   /// Creates a bulleted list with the specified items.
```

**File**: `Sources/MarkdownUI/DSL/Blocks/CodeBlock.swift` (renamed, +1/-1)
```diff
@@ -27,7 +27,7 @@ import Foundation
 /// ![](CodeBlock)
 public struct CodeBlock: MarkdownContentProtocol {
   public var _markdownContent: MarkdownContent {
-    .init(blocks: [.codeBlock(info: self.language, content: self.content)])
+    .init(blocks: [.codeBlock(fenceInfo: self.language, content: self.content)])
   }
 
   private let language: String?
```

---

### Incident Patch 14: `4392c3ce` (2023-03-11)
**Commit Message**: Add ImageRenderer demo (#198)

**File**: `Examples/Demo/Demo/RepositoryReadmeView.swift` (modified, +43/-11)
```diff
@@ -7,6 +7,9 @@ struct RepositoryReadmeView: View {
     `README.md` file and how to implement a custom `OpenURLAction` that
     scrolls to the corresponding heading when the user taps on an anchor
     link.
+
+    Additionally, it shows how to use an `ImageRenderer` to render the `README.md`
+    file into a PDF.
     """
 
   @State private var owner = "apple"
@@ -59,24 +62,33 @@ private struct ReadmeView: View {
       } else {
         ScrollViewReader { proxy in
           ScrollView {
-            Group {
-              if let response, let content = response.decodedContent {
-                Markdown(content, baseURL: response.baseURL, imageBaseURL: response.imageBaseURL)
-              } else {
-                Markdown("Oops! Something went wrong while fetching the README file.")
-              }
-            }
-            .padding()
-            .background(Theme.gitHub.textBackgroundColor)
-            .markdownTheme(.gitHub)
-            .scrollToMarkdownHeadings(using: proxy)
+            content
+              .scrollToMarkdownHeadings(using: proxy)
           }
         }
       }
     }
     .onAppear {
       self.loadContent()
     }
+    .toolbar {
+      if !self.isLoading {
+        ShareLink(item: self.renderPDF())
+      }
+    }
+  }
+
+  private var content: some View {
+    Group {
+      if let response, let content = response.decodedContent {
+        Markdown(content, baseURL: response.baseURL, imageBaseURL: response.imageBaseURL)
+      } else {
+        Markdown("Oops! Something went wrong while fetching the README file.")
+      }
+    }
+    .padding()
+    .background(Theme.gitHub.textBackgroundColor)
+    .markdownTheme(.gitHub)
   }
 
   private func loadContent() {
@@ -86,6 +98,26 @@ private struct ReadmeView: View {
       self.isLoading = false
     }
   }
+
+  @MainActor private func renderPDF() -> URL {
+    let url = URL.documentsDirectory.appending(path: "README.pdf")
+    let renderer = ImageRenderer(content: self.content.padding())
+    renderer.proposedSize = .init(width: UIScreen.main.bounds.width, height: nil)
+
+    renderer.render { size, render in
+      var mediaBox = CGRect(origin: .zero, size: size)
+      guard let context = CGContext(url as CFURL, mediaBox: &mediaBox, nil) else {
+        return
+      }
+
+      context.beginPDFPage(nil)
+      render(context)
+      context.endPDFPage()
+      context.closePDF()
+    }
+
+    return url
+  }
 }
 
 // MARK: - Heading anchor scrolling
```

---

### Incident Patch 15: `d4d89938` (2023-02-26)
**Commit Message**: Render first level inline images (#193)

* Render inline images

* Update demo project with inline images

* Update documentation

**File**: `Examples/Demo/Demo/Assets.xcassets/smallDog.imageset/Contents.json` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{
+  "images" : [
+    {
+      "filename" : "237-30x40.jpg",
+      "idiom" : "universal"
+    }
+  ],
+  "info" : {
+    "author" : "xcode",
+    "version" : 1
+  }
+}
```

**File**: `Examples/Demo/Demo/ImageProvidersView.swift` (modified, +7/-1)
```diff
@@ -13,18 +13,23 @@ struct ImageProvidersView: View {
     """
 
   private let otherContent = """
-    You can use the built-in `AssetImageProvider` to load images from image assets.
+    You can use the built-in `AssetImageProvider` and `AssetInlineImageProvider`
+    to load images from image assets.
 
     ```swift
     Markdown {
       "![A dog](dog)"
+      "A ![dog](smallDog) within a line of text."
       "― Photo by André Spieker"
     }
     .markdownImageProvider(.asset)
+    .markdownInlineImageProvider(.asset)
     ```
 
     ![A dog](dog)
 
+    An image ![dog](smallDog) within a line of text.
+
     ― Photo by André Spieker
     """
 
@@ -36,6 +41,7 @@ struct ImageProvidersView: View {
       Section("Image Assets") {
         Markdown(self.otherContent)
           .markdownImageProvider(.asset)
+          .markdownInlineImageProvider(.asset)
       }
     }
   }
```

**File**: `Examples/Demo/Demo/ImagesView.swift` (modified, +15/-9)
```diff
@@ -15,25 +15,31 @@ struct ImagesView: View {
     ― Photo by Jennifer Trovato
     """
 
-  private let assetContent = """
-    You can configure a `Markdown` view to load images from the asset catalog.
+  private let inlineImageContent = """
+    You can also insert images in a line of text, such as
+    ![](https://picsum.photos/id/237/50/25) or
+    ![](https://picsum.photos/id/433/50/25).
 
-    ```swift
-    Markdown {
-      "![This is an image](237-200x300)"
-    }
-    .markdownImageProvider(.asset)
+    ```
+    You can also insert images in a line of text, such as
+    ![](https://picsum.photos/id/237/50/25) or
+    ![](https://picsum.photos/id/433/50/25).
     ```
 
-    ![This is an image](dog)
+    Note that MarkdownUI **cannot** apply any styling to
+    inline images.
 
-    ― Photo by André Spieker
+    ― Photos by André Spieker and Thomas Lefebvre
     """
 
   var body: some View {
     DemoView {
       Markdown(self.content)
 
+      Section("Inline images") {
+        Markdown(self.inlineImageContent)
+      }
+
       Section("Customization Example") {
         Markdown(self.content)
       }
```

**File**: `Sources/MarkdownUI/Content/Inlines/Inline.swift` (modified, +14/-10)
```diff
@@ -82,19 +82,23 @@ extension Array where Element == Inline {
 }
 
 extension Inline {
-  var image: (source: String?, alt: String)? {
-    guard case let .image(source, children) = self else {
-      return nil
-    }
-    return (source, children.text)
+  struct Image: Hashable {
+    var source: String?
+    var alt: String
+    var destination: String?
   }
 
-  var imageLink: (source: String?, alt: String, destination: String?)? {
-    guard case let .link(destination, children) = self, children.count == 1,
-      let (source, alt) = children.first?.image
-    else {
+  var image: Image? {
+    switch self {
+    case let .image(source, children):
+      return .init(source: source, alt: children.text)
+    case let .link(destination, children) where children.count == 1:
+      guard case let .some(.image(source, children)) = children.first else {
+        return nil
+      }
+      return .init(source: source, alt: children.text, destination: destination)
+    default:
       return nil
     }
-    return (source, alt, destination)
   }
 }
```

**File**: `Sources/MarkdownUI/Content/Inlines/InlineImage.swift` (modified, +2/-8)
```diff
@@ -4,13 +4,6 @@ import Foundation
 ///
 /// You can use an image inline to embed an image in a paragraph.
 ///
-/// Note that even if you can compose images and text as part of the same inline content, the ``Markdown``
-/// view is currently limited to displaying image-only paragraphs and will ignore images composed with other
-/// text inlines in the same block.
-///
-/// In the following example, the ``Markdown`` view will not display the image in the last paragraph, as it
-/// is interleaved with other text inline.
-///
 /// ```swift
 /// Markdown {
 ///   Paragraph {
@@ -23,8 +16,9 @@ import Foundation
 ///     }
 ///   }
 ///   Paragraph {
-///     "The following image will be ignored:"
+///     "You can also insert images in a line of text, such as "
 ///     InlineImage(source: URL(string: "https://picsum.photos/id/237/100/150")!)
+///     "."
 ///   }
 /// }
 /// ```
```

**File**: `Sources/MarkdownUI/Extensions/AssetInlineImageProvider.swift` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import SwiftUI
+
+/// An inline image provider that loads images from resources located in an app or a module.
+public struct AssetInlineImageProvider: InlineImageProvider {
+  private let name: (URL) -> String
+  private let bundle: Bundle?
+
+  /// Creates an asset inline image provider.
+  /// - Parameters:
+  ///   - name: A closure that extracts the image resource name from the URL in the Markdown content.
+  ///   - bundle: The bundle where the image resources are located. Specify `nil` to search the app’s main bundle.
+  public init(
+    name: @escaping (URL) -> String = \.lastPathComponent,
+    bundle: Bundle? = nil
+  ) {
+    self.name = name
+    self.bundle = bundle
+  }
+
+  public func image(with url: URL, label: String) async throws -> Image {
+    .init(self.name(url), bundle: self.bundle, label: Text(label))
+  }
+}
+
+extension InlineImageProvider where Self == AssetInlineImageProvider {
+  /// An inline image provider that loads images from resources located in an app or a module.
+  ///
+  /// Use the `markdownInlineImageProvider(_:)` modifier to configure this image provider for a view hierarchy.
+  public static var asset: Self {
+    .init()
+  }
+}
```

**File**: `Sources/MarkdownUI/Extensions/DefaultInlineImageProvider.swift` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import SwiftUI
+
+/// The default inline image provider, which loads images from the network.
+public struct DefaultInlineImageProvider: InlineImageProvider {
+  private let urlSession: URLSession
+
+  /// Creates a default inline image provider.
+  /// - Parameter urlSession: An `URLSession` instance to load images.
+  public init(urlSession: URLSession = .shared) {
+    self.urlSession = urlSession
+  }
+
+  public func image(with url: URL, label: String) async throws -> Image {
+    try await Image(
+      platformImage: DefaultImageLoader.shared
+        .image(with: url, urlSession: self.urlSession)
+    )
+  }
+}
+
+extension InlineImageProvider where Self == DefaultInlineImageProvider {
+  /// The default inline image provider, which loads images from the network.
+  ///
+  /// Use the `markdownInlineImageProvider(_:)` modifier to configure
+  /// this image provider for a view hierarchy.
+  public static var `default`: Self {
+    .init()
+  }
+}
```

**File**: `Sources/MarkdownUI/Extensions/InlineImageProvider.swift` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import SwiftUI
+
+/// A type that loads images that are displayed within a line of text.
+///
+/// To configure the current inline image provider for a view hierarchy,
+/// use the `markdownInlineImageProvider(_:)` modifier.
+public protocol InlineImageProvider {
+  /// Returns an image for the given URL.
+  ///
+  /// ``Markdown`` views call this method to load images within a line of text.
+  ///
+  /// - Parameters:
+  ///   - url: The URL of the image to display.
+  ///   - label: The accessibility label associated with the image.
+  func image(with url: URL, label: String) async throws -> Image
+}
```

#### Recent Merged Pull Requests:
- **PR #450** (closed): feat: adopt Swift 6.2 tools and strict concurrency (@tylerhedrick-harvey)
- **PR #447** (closed): Remove Claude/Renovate PR reviewer workflows (@kostya-luxuryescape)
- **PR #442** (closed): convert isLink to containsLink (@AdamCockingHX)
- **PR #440** (closed): Feat/criticmarkup rendering (@kkilchrist)
- **PR #434** (closed): Long doc diff fix (@Jasonvdb)
- **PR #433** (closed): Markdown diff view (@Jasonvdb)
- **PR #430** (closed): Don't render markdown comments (@JacobHearst)
- **PR #429** (closed): Add link configuration (@dpetrov-appolica)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
