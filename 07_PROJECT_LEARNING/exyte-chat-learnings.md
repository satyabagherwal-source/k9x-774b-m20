> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/exyte-chat-learnings.md`  
> **Source**: github ([https://github.com/exyte/Chat](https://github.com/exyte/Chat))  
> **Source Version**: `49bf1f37`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T02:34:18.833Z  
> **Learning ID**: `learn-github-exyte-chat`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): exyte/Chat

> **Canonical Artifact**: `07_PROJECT_LEARNING/exyte-chat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/exyte/Chat](https://github.com/exyte/Chat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T02:34:18.205Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `exyte/Chat`
- **Description**: A SwiftUI Chat UI framework with fully customizable message cells and a built-in media picker
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1891 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ChatFirestoreExample/ChatFirestoreExample/Utils/Constants.swift`
```
//
//  Constants.swift
//  ChatFirestoreExample
//
//  Created by Alisa Mylnikova on 10.07.2023.
//

import SwiftUI
import ExyteChat
import ExyteMediaPicker

struct Collection {
    static let users = "users"
    static let conversations = "conversations"
    static let messages = "messages"
}

#if swift(<5.9)
extension Color {
    static var exampleBlue = Color("exampleBlue")
    static var exampleDarkGray = Color("exampleDarkGray")
    static var exampleFieldBorder = Color("exampleFieldBorder")
    static var exampleLightGray = Color("exampleLightGray")
    static var exampleMidGray = Color("exampleMidGray")
    static var examplePickerBg = Color("examplePickerBg")
    static var exampleSearchField = Color("exampleSearchField")
    static var exampleSecondaryText = Color("exampleSecondaryText")
    static var exampleTertiaryText = Color("exampleTertiaryText")
}
}
#endif

extension String {
    static var avatarPlaceholder = "avatarPlaceholder"
    static var placeholderAvatar = "placeholderAvatar"
    static var bob = "bob"
    static var checkSelected = "checkSelected"
    static var checkUnselected = "checkUnselected"
    static var groupChat = "groupChat"
    static var imagePlaceholder = "imagePlaceholder"
    static var logo = "logo"
    static var navigateBack = "navigateBack"
    static var newChat = "newChat"
    static var photoIcon = "photoIcon"
    static var searchCancel = "searchCancel"
    static var searchIcon = "searchIcon"
    static var steve = "steve"
    static var tim = "tim"
}

var dataStorage = DataStorageManager.shared

public typealias User = ExyteChat.User
public typealias Message = ExyteChat.Message
public typealias Recording = ExyteChat.Recording
public typealias Media = ExyteMediaPicker.Media

```

### Core Architecture Module: `ChatFirestoreExample/ChatFirestoreExample/Utils/NetworkMonitor.swift`
```
//
//  NetworkMonitor.swift
//
//
//  Created by Alisa Mylnikova on 01.09.2023.
//

import Foundation
import Network

class NetworkMonitor: ObservableObject {
    private let networkMonitor = NWPathMonitor()
    private let workerQueue = DispatchQueue(label: "Monitor")
    var isConnected = false

    init() {
        networkMonitor.pathUpdateHandler = { path in
            self.isConnected = path.status == .satisfied
            Task {
                await MainActor.run {
                    self.objectWillChange.send()
                }
            }
        }
        networkMonitor.start(queue: workerQueue)
    }
}

```

### Core Architecture Module: `ChatFirestoreExample/ChatFirestoreExample/Utils/Utils.swift`
```
//
//  Utils.swift
//  ChatFirestoreExample
//
//  Created by Alisa Mylnikova on 19.06.2023.
//

import SwiftUI

extension Sequence {
    func asyncMap<T>(
        _ transform: (Element) async throws -> T
    ) async rethrows -> [T] {
        var values = [T]()

        for element in self {
            try await values.append(transform(element))
        }

        return values
    }
}

extension View {
    func font(_ size: CGFloat, _ color: Color = .black, _ weight: Font.Weight = .regular) -> some View {
        self
            .fontWeight(weight)
            .font(.system(size: size))
            .foregroundColor(color)
    }
}

extension View {
    func dismissKeyboard() {
        DispatchQueue.main.async {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
    }
}

extension String {
    func toURL() -> URL? {
        URL(string: self)
    }
}

extension Date {
    func timeAgoFormat(numericDates: Bool = false) -> String {
        let calendar = Calendar.current
        let date = self
        let now = Date()
        let earliest = (now as NSDate).earlierDate(date)
        let latest = (earliest == now) ? date : now
        let components:DateComponents = (calendar as NSCalendar).components([NSCalendar.Unit.minute , NSCalendar.Unit.hour , NSCalendar.Unit.day , NSCalendar.Unit.weekOfYear , NSCalendar.Unit.month , NSCalendar.Unit.year , NSCalendar.Unit.second], from: earliest, to: latest, options: NSCalendar.Options())
        
        if components.year! >= 2 {
            return "\(components.year!) years ago"
        } else if components.year! >= 1 {
            if numericDates {
                return "1 year ago"
            } else {
                return "Last year"
            }
        } else if components.month! >= 2 {
            return "\(components.month!) months ago"
        } else if components.month! >= 1 {
            if numericDates {
                return "1 month ago"
            } else {
                return "Last month"
            }
        } else if components.weekOfYear! >= 2 {
            return "\(components.weekOfYear!) weeks ago"
        } else if components.weekOfYear! >= 1 {
            if numericDates {
                return "1 week ago"
            } else {
                return "Last week"
            }
        } else if components.day! >= 2 {
            return "\(components.day!) days ago"
        } else if components.day! >= 1 {
            if numericDates {
                return "1 day ago"
            } else {
                return "Yesterday"
            }
        } else if components.hour! >= 2 {
            return "\(components.hour!) hours ago"
        } else if components.hour! >= 1 {
            if numericDates {
                return "1 hour ago"
            } else {
                return "An hour ago"
            }
        } else if components.minute! >= 2 {
            return "\(components.minute!) minutes ago"
        } else if components.minute! >= 1 {
            if numericDates {
                return "1 minute ago"
            } else {
                return "A minute ago"
            }
        } else {
            return "Just now"
        }
    }
}

```

### Core Architecture Module: `Sources/ExyteChat/Extensions/AVPlayer+State.swift`
```
//
//  Created by Alex.M on 22.06.2022.
//

import Foundation
import AVKit

extension AVPlayer {
    nonisolated var isPlaying: Bool {
        rate != 0 && error == nil
    }
}

```

### Core Architecture Module: `Sources/ExyteChat/Managers/GlobalFocusState.swift`
```
//
//  Created by Alex.M on 23.06.2022.
//

import Foundation

final class GlobalFocusState: ObservableObject {
    @Published var focus: Focusable?
}

```

### Core Architecture Module: `Sources/ExyteChat/Managers/KeyboardState.swift`
```
//
//  Created by Alex.M on 02.10.2023.
//

import Foundation
import Combine
import UIKit

@MainActor
public final class KeyboardState: ObservableObject {
    @Published private(set) public var isShown: Bool = false
    @Published private(set) public var keyboardFrame: CGRect = .zero
    
    private var subscriptions = Set<AnyCancellable>()

    init() {
        subscribeKeyboardNotifications()
    }

    /// Requests the dismissal of the current / active keyboard
    public func resignFirstResponder() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

private extension KeyboardState {
    func subscribeKeyboardNotifications() {
        let pub = Publishers.Merge(
            NotificationCenter.default
                .publisher(for: UIResponder.keyboardWillShowNotification)
                .compactMap { $0.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue }
                .map { $0.cgRectValue },

            NotificationCenter.default
                .publisher(for: UIResponder.keyboardWillHideNotification)
                .map { _ in .zero }
        )
        .receive(on: RunLoop.main)
        
        // Assign the CGRect to keyboardFrame and store the sub
        pub.assign(to: \.keyboardFrame, on: self).store(in: &subscriptions)
        // Map the CGRect into a Bool, assign it to isShown and store the sub
        pub.map { $0 != .zero }.assign(to: \.isShown, on: self).store(in: &subscriptions)
    }
}

```

### Core Architecture Module: `Sources/ExyteChat/Managers/PaginationState.swift`
```
//
//  Created by Alex.M on 30.06.2022.
//

import Foundation
import SwiftUI

public struct PaginationHandler {
    public enum TriggerType {
        /// when (messages.count - 1 - offset)-th message is displayed handleClosure will be called
        /// 0 means last message triggers handleClosure
        case cellIndex(_ offset: Int)
        /// when table's y offset hits this threshold handleClosure will be called
        case pixels(_ offset: CGFloat)
    }

    let triggerType: TriggerType
    let hasMoreToLoad: Bool
    let handleClosure: () async -> ()
    let loadingIndicatorBuilder: (()->AnyView)

    public init<V: View>(triggerType: TriggerType = .pixels(0), hasMoreToLoad: Bool = true, handleClosure: @escaping () async -> (), loadingIndicatorBuilder: @escaping ()->V = { EmptyView() }) {
        self.triggerType = triggerType
        self.hasMoreToLoad = hasMoreToLoad
        self.handleClosure = handleClosure
        self.loadingIndicatorBuilder = { AnyView(loadingIndicatorBuilder()) }
    }

    @available(*, deprecated, message: "use TriggerType init instead")
    public init<V: View>(offset: Int = 0, hasMoreToLoad: Bool = true, handleClosure: @escaping () async -> (), loadingIndicatorBuilder: @escaping ()->V = { EmptyView() }) {
        self.triggerType = .cellIndex(offset)
        self.hasMoreToLoad = hasMoreToLoad
        self.handleClosure = handleClosure
        self.loadingIndicatorBuilder = { AnyView(loadingIndicatorBuilder()) }
    }
}

```

### Core Architecture Module: `Sources/ExyteChat/Utils/AsyncMap.swift`
```
//
//  AsyncMap.swift
//
//
//  Created by Alisa Mylnikova on 26.06.2023.
//

import Foundation

extension Sequence {
    func asyncMap<T>(
        _ transform: (Element) async throws -> T
    ) async rethrows -> [T] {
        var values = [T]()

        for element in self {
            try await values.append(transform(element))
        }

        return values
    }
}

extension Sequence {
    func asyncCompactMap<T>(
        _ transform: (Element) async throws -> T?
    ) async rethrows -> [T] {
        var values = [T]()

        for element in self {
            if let el = try await transform(element) {
                values.append(el)
            }
        }

        return values
    }
}

```

### Core Architecture Module: `Sources/ExyteChat/Utils/CachedAnimatedImage.swift`
```
//
//  CachedAnimatedImage.swift
//

import SwiftUI
import Kingfisher

struct CachedAnimatedImage<Placeholder: View>: View {

    let url: URL
    let cacheKey: String?
    let contentMode: SwiftUI.ContentMode
    @ViewBuilder var placeholder: () -> Placeholder

    var body: some View {
        // `.network(...)` only works for http(s) URLs; local `file://` URLs (e.g. GIFs picked
        // from the photo library) need `.provider(LocalFileImageDataProvider)`, which
        // `convertToSource` picks automatically based on the URL scheme.
        KFAnimatedImage(source: url.convertToSource(overrideCacheKey: cacheKey))
            .configure { view in
#if canImport(UIKit)
                view.contentMode = contentMode == .fill ? .scaleAspectFill : .scaleAspectFit
                view.clipsToBounds = true
#elseif canImport(AppKit)
                view.imageScaling = .scaleProportionallyUpOrDown
#endif
            }
            .cacheOriginalImage()
            .placeholder(placeholder)
    }
}

```

### Core Architecture Module: `Sources/ExyteChat/Utils/CachedAsyncImage.swift`
```
//
//  Created by Aman Kumar on 26/08/25.
//

import SwiftUI
import Kingfisher

/// A view that asynchronously loads and displays an image using Kingfisher.
///
///     CachedAsyncImage(url: URL(string: "https://example.com/icon.png"))
///         .frame(width: 200, height: 200)
///
/// You can specify a custom cache key:
///
///     CachedAsyncImage(url: URL(string: "https://example.com/icon.png"), cacheKey: "custom-key")
///
@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
public struct CachedAsyncImage<Content>: View where Content: View {

    @State private var phase: AsyncImagePhase

    private let url: URL?
    private let cacheKey: String?
    private let scale: CGFloat
    private let transaction: Transaction
    private let content: (AsyncImagePhase) -> Content

    public var body: some View {
        content(phase)
            .task(id: url, load)
    }

    /// Loads and displays an image from the specified URL.
    public init(url: URL?, cacheKey: String? = nil, scale: CGFloat = 1) where Content == Image {
        self.init(url: url, cacheKey: cacheKey, scale: scale) { phase in
    #if os(macOS)
            phase.image ?? Image(nsImage: .init())
    #else
            phase.image ?? Image(uiImage: .init())
    #endif
        }
    }

    /// Loads and displays a modifiable image with placeholder.
    public init<I, P>(
        url: URL?,
        cacheKey: String? = nil,
        scale: CGFloat = 1,
        @ViewBuilder content: @escaping (Image) -> I,
        @ViewBuilder placeholder: @escaping () -> P
    ) where Content == _ConditionalContent<I, P>, I: View, P: View {
        self.init(url: url, cacheKey: cacheKey, scale: scale) { phase in
            if let image = phase.image {
                content(image)
            } else {
                placeholder()
            }
        }
    }

    /// Loads and displays a modifiable image in phases.
    public init(
        url: URL?,
        cacheKey: String? = nil,
        scale: CGFloat = 1,
        transaction: Transaction = Transaction(),
        @ViewBuilder content: @escaping (AsyncImagePhase) -> Content
    ) {
        self.url = url
        self.cacheKey = cacheKey
        self.scale = scale
        self.transaction = transaction
        self.content = content
        self._phase = State(wrappedValue: .empty)
    }

    @Sendable
    private func load() async {
        guard let url = url else {
            withAnimation(transaction.animation) { phase = .empty }
            return
        }

        // Load xcassets images directly — no disk I/O, no Kingfisher overhead
        if url.scheme == "asset", let name = url.host {
#if canImport(UIKit)
            if let uiImage = UIImage(named: name) {
                withAnimation(transaction.animation) {
                    phase = .success(Image(uiImage: uiImage))
                }
            }
#elseif canImport(AppKit)
            if let nsImage = NSImage(named: name) {
                withAnimation(transaction.animation) {
                    phase = .success(Image(nsImage: nsImage))
                }
            }
#endif
            return
        }

        let resource = ImageResource(downloadURL: url, cacheKey: cacheKey ?? url.absoluteString)

        do {
            let image = try await withCheckedThrowingContinuation { continuation in
                KingfisherManager.shared.retrieveImage(
                    with: resource,
                    options: [
                        .cacheOriginalImage,
                        .scaleFactor(scale)
                    ]
                ) { result in
                    switch result {
                    case .success(let value):
                        continuation.resume(returning: value.image)
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
            }

            withAnimation(transaction.animation) {
#if canImport(UIKit)
                phase = .success(Image(uiImage: image))
#elseif canImport(AppKit)
                phase = .success(Image(nsImage: image))
#endif
            }
        } catch {
            withAnimation(transaction.animation) {
                phase = .failure(error)
            }
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #91** (2025-04-04): **DatePicker not responding on tap gesture.**
  *Symptoms*: Hello,   I'd like to send a date picker as a custom message. It works fine but the problem is that date picker only reacts to long press and not tap gesture. I tried to override this behaviour but couldn't make it. I think there are some conflicts between the internal library gestures and date picker. It's not the same for Buttons.   Any idea of how to make this work? 
  **Post-Mortem & Fix Analysis**:
  > I had similar problem with attachments. You can try to use `.highPriorityGesture` if it's applicable in your case.
  > Hey guys, sorry, it's been a while, but I think this issue should be fixed now, please try version 2.6.0, have a wonderful day!

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

### Incident Patch 1: `85152a86` (2026-09-18)
**Commit Message**: Fix Xcode 27 linker crash by co-locating ChatView's init with its @State properties

Xcode 27's Swift 6.4 compiler fails to link the default-value symbol for a
@State property when the type's initializer is declared in a different file
(swiftlang/swift#91700). ChatView's designated init lived in
ChatBuilderParameters.swift while its @State properties are declared in
ChatView.swift, so any app linking against ChatView failed with:

  Undefined symbols for architecture arm64:
    "variable initialization expression of ExyteChat.ChatView.(__chatSize ...)"

Moving the init into ChatView.swift (same file as the @State declarations)
resolves it, per the workaround described in the upstream issue.

**File**: `Sources/ExyteChat/Views/ChatBuilderParameters.swift` (modified, +0/-30)
```diff
@@ -60,36 +60,6 @@ extension ChatView {
         _ defaultActionClosure: @escaping (Message, DefaultMessageMenuAction) -> Void,
         _ message: Message
     ) -> Void
-
-    public init(
-        messages: [Message],
-        chatType: ChatType = .conversation,
-        replyMode: ReplyMode = .quote,
-        didSendMessage: @escaping (DraftMessage) -> Void,
-        @ViewBuilder messageBuilder: @escaping (_ params: MessageBuilderParameters) -> MessageContent = { _ in
-            DummyView()
-        },
-        @ViewBuilder inputViewBuilder: @escaping (_ params: InputViewBuilderParameters) -> InputViewContent = { _ in
-            DummyView()
-        },
-        messageMenuAction: @escaping (
-            _ selectedMenuAction: MenuAction,
-            _ defaultActionClosure: @escaping (Message, DefaultMessageMenuAction) -> Void,
-            _ message: Message
-        ) -> Void = { (selectedMenuAction: DefaultMessageMenuAction, defaultActionClosure, message) in
-            defaultActionClosure(message, selectedMenuAction)
-        },
-        didUpdateAttachmentStatus: ((AttachmentUploadUpdate) -> Void)? = nil
-    ) {
-        self.type = chatType
-        self.sections = ChatView.mapMessages(messages, chatType: chatType, replyMode: replyMode)
-        self.ids = messages.map { $0.id }
-        self.didSendMessage = didSendMessage
-        self.messageBuilder = messageBuilder
-        self.inputViewBuilder = inputViewBuilder
-        self.messageMenuAction = messageMenuAction
-        self.didUpdateAttachmentStatus = didUpdateAttachmentStatus
-    }
 }
 
 public struct DummyView: View {
```

**File**: `Sources/ExyteChat/Views/ChatView.swift` (modified, +40/-0)
```diff
@@ -618,3 +618,43 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
 //            text: "That I shall say 'Good night' till it be morrow"),
 //    ]) { draft in }
 //}
+
+// The designated initializer is kept in this file, alongside the `@State` property
+// declarations it doesn't explicitly assign. Xcode 27's Swift 6.4 compiler emits an
+// unresolvable "variable initialization expression" linker symbol for a `@State`
+// property's default value when its type's initializer lives in a different file
+// (https://github.com/swiftlang/swift/issues/91700). This was previously declared in
+// ChatBuilderParameters.swift, which reproduced that bug for every `@State` property
+// on `ChatView`.
+extension ChatView {
+
+    public init(
+        messages: [Message],
+        chatType: ChatType = .conversation,
+        replyMode: ReplyMode = .quote,
+        didSendMessage: @escaping (DraftMessage) -> Void,
+        @ViewBuilder messageBuilder: @escaping (_ params: MessageBuilderParameters) -> MessageContent = { _ in
+            DummyView()
+        },
+        @ViewBuilder inputViewBuilder: @escaping (_ params: InputViewBuilderParameters) -> InputViewContent = { _ in
+            DummyView()
+        },
+        messageMenuAction: @escaping (
+            _ selectedMenuAction: MenuAction,
+            _ defaultActionClosure: @escaping (Message, DefaultMessageMenuAction) -> Void,
+            _ message: Message
+        ) -> Void = { (selectedMenuAction: DefaultMessageMenuAction, defaultActionClosure, message) in
+            defaultActionClosure(message, selectedMenuAction)
+        },
+        didUpdateAttachmentStatus: ((AttachmentUploadUpdate) -> Void)? = nil
+    ) {
+        self.type = chatType
+        self.sections = ChatView.mapMessages(messages, chatType: chatType, replyMode: replyMode)
+        self.ids = messages.map { $0.id }
+        self.didSendMessage = didSendMessage
+        self.messageBuilder = messageBuilder
+        self.inputViewBuilder = inputViewBuilder
+        self.messageMenuAction = messageMenuAction
+        self.didUpdateAttachmentStatus = didUpdateAttachmentStatus
+    }
+}
```

---

### Incident Patch 2: `60ff30bc` (2026-09-19)
**Commit Message**: Merge pull request #302 from nezhyborets/macpaw-xcode27-init-fix

Fix Xcode 27 linker crash by co-locating ChatView's init with its @State properties

**File**: `Sources/ExyteChat/Views/ChatBuilderParameters.swift` (modified, +0/-30)
```diff
@@ -60,36 +60,6 @@ extension ChatView {
         _ defaultActionClosure: @escaping (Message, DefaultMessageMenuAction) -> Void,
         _ message: Message
     ) -> Void
-
-    public init(
-        messages: [Message],
-        chatType: ChatType = .conversation,
-        replyMode: ReplyMode = .quote,
-        didSendMessage: @escaping (DraftMessage) -> Void,
-        @ViewBuilder messageBuilder: @escaping (_ params: MessageBuilderParameters) -> MessageContent = { _ in
-            DummyView()
-        },
-        @ViewBuilder inputViewBuilder: @escaping (_ params: InputViewBuilderParameters) -> InputViewContent = { _ in
-            DummyView()
-        },
-        messageMenuAction: @escaping (
-            _ selectedMenuAction: MenuAction,
-            _ defaultActionClosure: @escaping (Message, DefaultMessageMenuAction) -> Void,
-            _ message: Message
-        ) -> Void = { (selectedMenuAction: DefaultMessageMenuAction, defaultActionClosure, message) in
-            defaultActionClosure(message, selectedMenuAction)
-        },
-        didUpdateAttachmentStatus: ((AttachmentUploadUpdate) -> Void)? = nil
-    ) {
-        self.type = chatType
-        self.sections = ChatView.mapMessages(messages, chatType: chatType, replyMode: replyMode)
-        self.ids = messages.map { $0.id }
-        self.didSendMessage = didSendMessage
-        self.messageBuilder = messageBuilder
-        self.inputViewBuilder = inputViewBuilder
-        self.messageMenuAction = messageMenuAction
-        self.didUpdateAttachmentStatus = didUpdateAttachmentStatus
-    }
 }
 
 public struct DummyView: View {
```

**File**: `Sources/ExyteChat/Views/ChatView.swift` (modified, +40/-0)
```diff
@@ -618,3 +618,43 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
 //            text: "That I shall say 'Good night' till it be morrow"),
 //    ]) { draft in }
 //}
+
+// The designated initializer is kept in this file, alongside the `@State` property
+// declarations it doesn't explicitly assign. Xcode 27's Swift 6.4 compiler emits an
+// unresolvable "variable initialization expression" linker symbol for a `@State`
+// property's default value when its type's initializer lives in a different file
+// (https://github.com/swiftlang/swift/issues/91700). This was previously declared in
+// ChatBuilderParameters.swift, which reproduced that bug for every `@State` property
+// on `ChatView`.
+extension ChatView {
+
+    public init(
+        messages: [Message],
+        chatType: ChatType = .conversation,
+        replyMode: ReplyMode = .quote,
+        didSendMessage: @escaping (DraftMessage) -> Void,
+        @ViewBuilder messageBuilder: @escaping (_ params: MessageBuilderParameters) -> MessageContent = { _ in
+            DummyView()
+        },
+        @ViewBuilder inputViewBuilder: @escaping (_ params: InputViewBuilderParameters) -> InputViewContent = { _ in
+            DummyView()
+        },
+        messageMenuAction: @escaping (
+            _ selectedMenuAction: MenuAction,
+            _ defaultActionClosure: @escaping (Message, DefaultMessageMenuAction) -> Void,
+            _ message: Message
+        ) -> Void = { (selectedMenuAction: DefaultMessageMenuAction, defaultActionClosure, message) in
+            defaultActionClosure(message, selectedMenuAction)
+        },
+        didUpdateAttachmentStatus: ((AttachmentUploadUpdate) -> Void)? = nil
+    ) {
+        self.type = chatType
+        self.sections = ChatView.mapMessages(messages, chatType: chatType, replyMode: replyMode)
+        self.ids = messages.map { $0.id }
+        self.didSendMessage = didSendMessage
+        self.messageBuilder = messageBuilder
+        self.inputViewBuilder = inputViewBuilder
+        self.messageMenuAction = messageMenuAction
+        self.didUpdateAttachmentStatus = didUpdateAttachmentStatus
+    }
+}
```

---

### Incident Patch 3: `e3a99865` (2026-08-14)
**Commit Message**: Merge pull request #292 from fayharinn/fix/scroll-to-oldest-on-empty-table

Fix crash when scrolling to oldest message on an empty table

**File**: `Sources/ExyteChat/Views/UIList.swift` (modified, +7/-2)
```diff
@@ -158,8 +158,13 @@ struct UIList<MessageContent: View>: UIViewRepresentable {
         case .newestMessage:
             tableView.setContentOffset(CGPoint(x: 0, y: 0), animated: false)
         case .oldestMessage:
-            let lastSection = max(tableView.numberOfSections - 1, 0)
-            let lastRow = max(tableView.numberOfRows(inSection: lastSection) - 1, 0)
+            // An empty table has no section 0 to ask about: clamping the index
+            // to 0 makes numberOfRows(inSection:) raise
+            // "Requested the number of rows for section (0) which is out of bounds".
+            guard tableView.numberOfSections > 0 else { return }
+
+            let lastSection = tableView.numberOfSections - 1
+            let lastRow = tableView.numberOfRows(inSection: lastSection) - 1
 
             guard lastRow >= 0 else { return }
 
```

#### Recent Merged Pull Requests:
- **PR #305** (2026-10-01): Small fix (@lissine0)
- **PR #303** (2026-09-22): Divided location into staticLocation and liveLocation (@Shonchik)
- **PR #302** (2026-09-19): Fix Xcode 27 linker crash by co-locating ChatView's init with its @State properties (@nezhyborets)
- **PR #297** (2026-09-15): A small theme fix (@lissine0)
- **PR #294** (closed): Add imageCache to CachedAsyncImage (@Shonchik)
- **PR #292** (2026-08-14): Fix crash when scrolling to oldest message on an empty table (@fayharinn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
