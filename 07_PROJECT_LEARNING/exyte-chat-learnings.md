# Forensic Learning Record (Deep Inspection): exyte/Chat

> **Canonical Artifact**: `07_PROJECT_LEARNING/exyte-chat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/exyte/Chat](https://github.com/exyte/Chat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:31:59.064Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `exyte/Chat`
- **Description**: A SwiftUI Chat UI framework with fully customizable message cells and a built-in media picker
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1882 stars

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

### Core Architecture Module: `Sources/ExyteChat/Utils/CustomFocus.swift`
```
//
//  Created by Alex.M on 23.06.2022.
//

import Foundation
import SwiftUI

struct CustomFocus<T: Hashable>: ViewModifier {
    @Binding var binding: T
    @FocusState var focus: Bool
    var equals: T

    init(_ binding: Binding<T>, equals: T) {
        self._binding = binding
        self.equals = equals
        self.focus = (binding.wrappedValue == equals)
    }

    func body(content: Content) -> some View {
        content
            .focused($focus, equals: true)
            .onChange(of: binding) {
                focus = (binding == equals)
            }
            .onChange(of: focus) {
                if focus {
                    binding = equals
                }
            }
    }
}

extension View {
    func customFocus<Value>(_ binding: Binding<Value>, equals value: Value) -> some View where Value : Hashable {
        modifier(CustomFocus(binding, equals: value))
    }
}

```

### Core Architecture Module: `Sources/ExyteChat/Utils/FrameGetter.swift`
```
//
//  Created by Alex.M on 20.06.2022.
//

import Foundation
import SwiftUI

struct FrameGetter: ViewModifier {

    @Binding var frame: CGRect

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { proxy -> AnyView in
                    DispatchQueue.main.async {
                        let rect = proxy.frame(in: .global)
                        // This avoids an infinite layout loop
                        if rect.integral != self.frame.integral {
                            self.frame = rect
                        }
                    }
                    return AnyView(EmptyView())
                }
            )
    }
}

struct SizeGetter: ViewModifier {
    @Binding var size: CGSize

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { proxy -> Color in
                    if proxy.size != self.size {
                        DispatchQueue.main.async {
                            self.size = proxy.size
                        }
                    }
                    return Color.clear
                }
            )
    }
}

struct MaxHeightGetter: ViewModifier {
    @Binding var height: CGFloat

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { proxy -> Color in
                    if proxy.size.height > self.height {
                        DispatchQueue.main.async {
                            self.height = proxy.size.height
                        }
                    }
                    return Color.clear
                }
            )
    }
}

extension View {

    func frameGetter(_ frame: Binding<CGRect>) -> some View {
        modifier(FrameGetter(frame: frame))
    }

    func sizeGetter(_ size: Binding<CGSize>) -> some View {
        modifier(SizeGetter(size: size))
    }
    
    func maxHeightGetter(_ height: Binding<CGFloat>) -> some View {
        modifier(MaxHeightGetter(height: height))
    }
}

actor MessageMenuPreferenceKey: PreferenceKey {
    typealias Value = [String: CGRect]

    static var defaultValue: Value = [:]

    static func reduce(value: inout Value, nextValue: () -> Value) {
        value.merge(nextValue()) { (_, new) in new }
    }
}

struct MessageMenuPreferenceViewSetter: View {
    let id: String

    var body: some View {
        GeometryReader { geometry in
            Rectangle()
                .fill(Color.clear)
                .preference(key: MessageMenuPreferenceKey.self,
                            value: [id: geometry.frame(in: .global)])
        }
    }
}

struct FinalMeasuringTrickView<Content: View>: View {
    @Binding var size: CGSize
    @State private var rawSize: CGSize = .zero
    var id: String?

    let content: () -> Content

    var body: some View {
        content()
            .background(
                GeometryReader { geo in
                    Color.clear
                        .onAppear {
                            if let id {
                                print("measuring", id, rawSize, geo.size)
                            }
                            if geo.size.height != 0 {
                                rawSize = geo.size
                            }
                        }
                        .onChange(of: geo.size) { _ , newSize in
                            if let id {
                                print("measuring", id, rawSize, newSize)
                            }
                            if newSize.height != 0 {
                                rawSize = newSize
                            }
                        }
                }
            )
            .onChange(of: rawSize) { _ , newValue in
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(16)) // 1 frame
                    if let id {
                        print("measuring", id, "rawSize change", rawSize, newValue)
                    }
                    if rawSize == newValue {
                        size = newValue
                    }
                }
            }
            .hidden()
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

### Incident Patch 1: `49bf1f37` (2026-10-01)
**Commit Message**: Merge pull request #305 from lissine0/small-fix

Small fix

**File**: `Sources/ExyteChat/Views/InputView/InputView+AttachMenu.swift` (modified, +0/-1)
```diff
@@ -116,7 +116,6 @@ extension InputView {
             onAction(action)
         } label: {
             image
-                .resizable()
                 .viewSize(24)
                 .padding(EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 6))
         }
```

---

### Incident Patch 2: `03b43a5b` (2026-09-29)
**Commit Message**: Fix attach menu position with keyboard

**File**: `Sources/ExyteChat/Views/InputView/InputView+AttachMenu.swift` (modified, +23/-0)
```diff
@@ -4,6 +4,7 @@
 //
 
 import SwiftUI
+import UIKit
 import AnchoredPopup
 
 private struct AttachMenuItem {
@@ -85,7 +86,29 @@ extension InputView {
                     .background(.none)
                     .closeOnTapOutside(true)
                     .animation(.default)
+                    .openOnTap(false)
             }
+            .onTapGesture {
+                openAttachMenu()
+            }
+    }
+
+    /// the popup's position is derived from `inputBarFrame`, which only settles into its
+    /// post-keyboard layout once the keyboard has fully dismissed, so the growing animation
+    /// is deferred until then to avoid anchoring to the pre-dismiss frame
+    fileprivate func openAttachMenu() {
+        guard keyboardState.isShown else {
+            AnchoredPopup.launchGrowingAnimation(id: attachMenuPopupId)
+            return
+        }
+
+        keyboardState.resignFirstResponder()
+        Task {
+            for await _ in NotificationCenter.default.notifications(named: UIResponder.keyboardDidHideNotification) {
+                break
+            }
+            AnchoredPopup.launchGrowingAnimation(id: attachMenuPopupId)
+        }
     }
 
     func menuButton(action: InputViewAction, image: Image) -> some View {
```

---

### Incident Patch 3: `dcb3e5a3` (2026-09-22)
**Commit Message**: Merge pull request #303 from Shonchik/fix-location

Divided location into staticLocation and liveLocation

**File**: `ChatExample/ChatExample/Screens/ChatExampleView.swift` (modified, +4/-2)
```diff
@@ -95,13 +95,15 @@ struct ChatExampleView: View {
         .setRecorderSettings(recorderSettings)
         .messageReactionDelegate(viewModel)
         .showLastReadIndicator(true)
-        .setAvailableInputs([.text, .media, .giphy, .audio, .document, .location])
+        .setAvailableInputs([.text, .media, .giphy, .audio, .document, .staticLocation, .liveLocation])
         .onLiveLocationBroadcast { event in
             switch event {
             case .updated(let messageId, let liveLocation):
                 viewModel.updateLiveLocation(messageId: messageId, liveLocation: liveLocation)
             case .ended(let messageId):
-                print("Live location sharing ended for message \(messageId)")
+                guard var liveLocation = viewModel.messages.first(where: { $0.id == messageId })?.liveLocation else { return }
+                liveLocation.expiresAt = Date()
+                viewModel.updateLiveLocation(messageId: messageId, liveLocation: liveLocation)
             }
         }
         .swipeActions(edge: .leading, performsFirstActionWithFullSwipe: true, items: [replyAction])
```

**File**: `Sources/ExyteChat/Views/ChatView.swift` (modified, +5/-1)
```diff
@@ -234,7 +234,11 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
                 .ignoresSafeArea()
             }
             .sheet(isPresented: $inputViewModel.showLocationPicker) {
-                LocationPickerView(localization: chatCustomizationParameters.localization) { staticLocation in
+                LocationPickerView(
+                    localization: chatCustomizationParameters.localization,
+                    isStaticLocationAvailable: inputViewCustomizationParameters.availableInputs.contains(.staticLocation),
+                    isLiveLocationAvailable: inputViewCustomizationParameters.availableInputs.contains(.liveLocation)
+                ) { staticLocation in
                     inputViewModel.attachments.staticLocation = staticLocation
                 } onPickLiveLocation: { liveLocation in
                     inputViewModel.attachments.liveLocation = liveLocation
```

**File**: `Sources/ExyteChat/Views/InputView/InputView+Types.swift` (modified, +4/-1)
```diff
@@ -66,7 +66,10 @@ public enum AvailableInputType: Sendable {
     case media
     case giphy
     case document
-    case location
+    /// Enables sharing a single, fixed location.
+    case staticLocation
+    /// Enables sharing a live, continuously-updating location.
+    case liveLocation
     case audio
 }
 
```

**File**: `Sources/ExyteChat/Views/InputView/InputView.swift` (modified, +1/-1)
```diff
@@ -236,6 +236,6 @@ struct InputView: View {
     }
 
     func isLocationAvailable() -> Bool {
-        availableInputs.contains(AvailableInputType.location)
+        availableInputs.contains(AvailableInputType.staticLocation) || availableInputs.contains(AvailableInputType.liveLocation)
     }
 }
```

**File**: `Sources/ExyteChat/Views/InputView/TextInputView.swift` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ struct TextInputView: View {
     }
     
     private func isAttachmentsAvailable() -> Bool {
-        let attachmentTypes: [AvailableInputType] = [.media, .giphy, .document, .location]
+        let attachmentTypes: [AvailableInputType] = [.media, .giphy, .document, .staticLocation, .liveLocation]
         return attachmentTypes.contains { availableInputs.contains($0) }
     }
 }
```

**File**: `Sources/ExyteChat/Views/Location/LiveLocationBroadcaster.swift` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ final class LiveLocationBroadcaster: ObservableObject {
         activeShare = ActiveShare(messageId: messageId, startedAt: startedAt, expiresAt: expiresAt)
         lastCoordinate = nil
 
-        locationManager.startContinuousUpdates()
+        locationManager.startUpdatingLiveLocation()
         cancellable = locationManager.$currentLocation
             .compactMap { $0 }
             .sink { [weak self] coordinate in
@@ -58,7 +58,7 @@ final class LiveLocationBroadcaster: ObservableObject {
 
     func finish() {
         guard let share = activeShare else { return }
-        locationManager.stopContinuousUpdates()
+        locationManager.stopUpdatingLiveLocation()
         cancellable = nil
         expiryTimer?.invalidate()
         expiryTimer = nil
```

**File**: `Sources/ExyteChat/Views/Location/LocationManager.swift` (modified, +46/-28)
```diff
@@ -11,8 +11,14 @@ final class LocationManager: NSObject, ObservableObject {
     @Published var currentLocation: CLLocationCoordinate2D?
     @Published var authorizationStatus: CLAuthorizationStatus
 
+    private enum LocationType {
+        case staticLocation
+        case liveLocation
+    }
+
     private let manager = CLLocationManager()
-    private var wantsContinuousUpdates = false
+    /// Resumed by `locationManagerDidChangeAuthorization` once the user answers the system prompt.
+    private var authorizationContinuation: CheckedContinuation<Bool, Never>?
 
     override init() {
         authorizationStatus = manager.authorizationStatus
@@ -21,39 +27,55 @@ final class LocationManager: NSObject, ObservableObject {
         manager.desiredAccuracy = kCLLocationAccuracyBest
     }
 
-    func requestLocation() {
-        switch manager.authorizationStatus {
-        case .notDetermined:
-            manager.requestWhenInUseAuthorization()
-        case .authorizedWhenInUse, .authorizedAlways:
-            manager.requestLocation()
-        default:
-            break
+    func requestStaticLocation() {
+        Task {
+            guard await requestPermission() else { return }
+            startUpdatingLocation(.staticLocation)
         }
     }
 
-    /// Keeps publishing `currentLocation` updates as the device moves, until `stopContinuousUpdates()` is called.
-    func startContinuousUpdates() {
-        wantsContinuousUpdates = true
-        switch manager.authorizationStatus {
-        case .notDetermined:
-            manager.requestWhenInUseAuthorization()
-        case .authorizedWhenInUse, .authorizedAlways:
+    /// Keeps publishing `currentLocation` updates as the device moves, until `stopUpdatingLiveLocation()` is called.
+    func startUpdatingLiveLocation() {
+        Task {
+            guard await requestPermission() else { return }
             manager.allowsBackgroundLocationUpdates = manager.authorizationStatus == .authorizedAlways && Self.supportsBackgroundLocationUpdates
-            manager.startUpdatingLocation()
-        default:
-            break
+            startUpdatingLocation(.liveLocation)
         }
     }
 
-    func stopContinuousUpdates() {
-        wantsContinuousUpdates = false
+    func stopUpdatingLiveLocation() {
         if Self.supportsBackgroundLocationUpdates {
             manager.allowsBackgroundLocationUpdates = false
         }
         manager.stopUpdatingLocation()
     }
 
+    /// Resolves once the user has answered the authorization prompt (or immediately if already
+    /// determined), and returns whether we're now allowed to use location. Knows nothing about
+    /// what the caller intends to do with that location.
+    private func requestPermission() async -> Bool {
+        switch manager.authorizationStatus {
+        case .authorizedWhenInUse, .authorizedAlways:
+            return true
+        case .notDetermined:
+            return await withCheckedContinuation { continuation in
+                authorizationContinuation = continuation
+                manager.requestWhenInUseAuthorization()
+            }
+        default:
+            return false
+        }
+    }
+
+    private func startUpdatingLocation(_ type: LocationType) {
+        switch type {
+        case .liveLocation:
+            manager.startUpdatingLocation()
+        case .staticLocation:
+            manager.requestLocation()
+        }
+    }
+
     /// Background live-location updates only work if the host app opted into the "location" UIBackgroundMode;
     /// otherwise setting `allowsBackgroundLocationUpdates` throws an assertion. Without it, updates still work
     /// while the app is foregrounded/backgrounded briefly, just not indefinitely in the background.
@@ -67,13 +89,9 @@ extension LocationManager: CLLocationManagerDelegate {
         let status = manager.authorizationStatus
         Task { @MainActor in
             self.authorizationStatus = status
-            guard status == .authorizedWhenInUse || status == .authorizedAlways else { return }
-            if self.wantsContinuousUpdates {
-                manager.allowsBackgroundLocationUpdates = status == .authorizedAlways && Self.supportsBackgroundLocationUpdates
-                manager.startUpdatingLocation()
-            } else {
-                manager.requestLocation()
-            }
+            guard status != .notDetermined else { return }
+            self.authorizationContinuation?.resume(returning: status == .authorizedWhenInUse || status == .authorizedAlways)
+            self.authorizationContinuation = nil
         }
     }
 
```

**File**: `Sources/ExyteChat/Views/Location/LocationPickerView.swift` (modified, +14/-8)
```diff
@@ -21,6 +21,8 @@ struct LocationPickerView: View {
     @State private var showLiveDurationDialog = false
 
     var localization: ChatLocalization
+    var isStaticLocationAvailable: Bool
+    var isLiveLocationAvailable: Bool
     var onPickStaticLocation: (StaticLocation) -> Void
     var onPickLiveLocation: (LiveLocation) -> Void
 
@@ -41,7 +43,7 @@ struct LocationPickerView: View {
             .ignoresSafeArea(edges: .bottom)
             .overlay(alignment: .bottomTrailing) {
                 Button {
-                    locationManager.requestLocation()
+                    locationManager.requestStaticLocation()
                 } label: {
                     Image(systemName: "location.fill")
                         .padding(12)
@@ -53,15 +55,19 @@ struct LocationPickerView: View {
             }
             .safeAreaInset(edge: .bottom) {
                 VStack(spacing: 10) {
-                    pickerActionButton(localization.sendLocationText, filled: true) {
-                        if let selectedCoordinate {
-                            onPickStaticLocation(StaticLocation(coordinate: selectedCoordinate))
-                            dismiss()
+                    if isStaticLocationAvailable {
+                        pickerActionButton(localization.sendLocationText, filled: true) {
+                            if let selectedCoordinate {
+                                onPickStaticLocation(StaticLocation(coordinate: selectedCoordinate))
+                                dismiss()
+                            }
                         }
                     }
 
-                    pickerActionButton(localization.shareLiveLocationText, filled: false) {
-                        showLiveDurationDialog = true
+                    if isLiveLocationAvailable {
+                        pickerActionButton(localization.shareLiveLocationText, filled: false) {
+                            showLiveDurationDialog = true
+                        }
                     }
                 }
                 .padding()
@@ -95,7 +101,7 @@ struct LocationPickerView: View {
             }
         }
         .onAppear {
-            locationManager.requestLocation()
+            locationManager.requestStaticLocation()
         }
         .onReceive(locationManager.$currentLocation.compactMap { $0 }) { newValue in
             guard !didCenterOnUser else { return }
```

---

### Incident Patch 4: `ea93daef` (2026-09-21)
**Commit Message**: Fix timestamp placement

**File**: `Sources/ExyteChat/Extensions/AttributedString+Extensions.swift` (modified, +20/-1)
```diff
@@ -14,9 +14,13 @@ extension AttributedString {
         return ceil(boundingBox.width)
     }
 
+    /// Applies `font` as the base, but keeps each run's bold/italic/code emphasis so the
+    /// measured size matches what `Text(attributedText)` actually renders.
     func toAttrString(font: UIFont) -> NSAttributedString {
         var str = self
-        str.setAttributes(AttributeContainer([.font: font]))
+        for run in str.runs {
+            str[run.range].setAttributes(AttributeContainer([.font: font.applyingInlinePresentationIntent(run.inlinePresentationIntent)]))
+        }
         return NSAttributedString(str)
     }
 
@@ -63,3 +67,18 @@ public extension AttributedString {
         .compactMap { $0 }
     }
 }
+
+private extension UIFont {
+    /// Mirrors how `Text` renders `inlinePresentationIntent` runs (from markdown) on top of an ambient font.
+    func applyingInlinePresentationIntent(_ intent: InlinePresentationIntent?) -> UIFont {
+        guard let intent else { return self }
+
+        var traits: UIFontDescriptor.SymbolicTraits = []
+        if intent.contains(.stronglyEmphasized) { traits.insert(.traitBold) }
+        if intent.contains(.emphasized) { traits.insert(.traitItalic) }
+        if intent.contains(.code) { traits.insert(.traitMonoSpace) }
+
+        guard !traits.isEmpty, let descriptor = fontDescriptor.withSymbolicTraits(traits) else { return self }
+        return UIFont(descriptor: descriptor, size: pointSize)
+    }
+}
```

---

### Incident Patch 5: `ab22b6cc` (2026-09-21)
**Commit Message**: Fix theme not applied to some icons

**File**: `Sources/ExyteChat/Extensions/Image+Extensions.swift` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+//
+//  Image+Extensions.swift
+//
+//
+//  Created by Alisa Mylnikova on 21.09.2026.
+//
+
+import SwiftUI
+
+extension Image {
+    /// Resizable, template-rendered icon tinted to a single color and squared to `size`.
+    @MainActor
+    func sizeAndColor(_ size: CGFloat, _ color: Color, contentMode: ContentMode = .fit) -> some View {
+        self
+            .resizable()
+            .renderingMode(.template)
+            .aspectRatio(contentMode: contentMode)
+            .foregroundColor(color)
+            .viewSize(size)
+    }
+}
```

**File**: `Sources/ExyteChat/Views/Attachments/AttachmentCell.swift` (modified, +3/-10)
```diff
@@ -58,9 +58,7 @@ public struct AttachmentCell: View {
                             VStack {
                                 Spacer()
                                 theme.images.message.playVideo
-                                    .resizable()
-                                    .foregroundColor(.white)
-                                    .viewSize(36)
+                                    .sizeAndColor(36, .white)
                                 Spacer()
                             }
                         case .cancelled:
@@ -72,9 +70,7 @@ public struct AttachmentCell: View {
                         VStack {
                             Spacer()
                             theme.images.message.playVideo
-                                .resizable()
-                                .foregroundColor(.white)
-                                .viewSize(36)
+                                .sizeAndColor(36, .white)
                             Spacer()
                         }
                     }
@@ -96,10 +92,7 @@ public struct AttachmentCell: View {
     private var documentContent: some View {
         VStack(spacing: 6) {
             theme.images.message.attachedDocument
-                .resizable()
-                .scaledToFit()
-                .viewSize(32)
-                .foregroundColor(theme.colors.mainTint)
+                .sizeAndColor(32, theme.colors.mainTint)
 
             Text(attachment.fileName ?? attachment.full.lastPathComponent)
                 .font(.caption2)
```

**File**: `Sources/ExyteChat/Views/Attachments/AttachmentsPage.swift` (modified, +1/-4)
```diff
@@ -56,10 +56,7 @@ struct AttachmentsPage: View {
     private var documentView: some View {
         VStack(spacing: 16) {
             theme.images.message.attachedDocument
-                .resizable()
-                .scaledToFit()
-                .viewSize(64)
-                .foregroundColor(theme.colors.mainTint)
+                .sizeAndColor(64, theme.colors.mainTint)
 
             Text(attachment.fileName ?? attachment.full.lastPathComponent)
                 .foregroundColor(theme.colors.mainText)
```

**File**: `Sources/ExyteChat/Views/InputView/InputView+AttachMenu.swift` (modified, +1/-5)
```diff
@@ -115,11 +115,7 @@ private struct AttachMenuRow: View {
         } label: {
             HStack(spacing: 10) {
                 icon
-                    .renderingMode(.template)
-                    .resizable()
-                    .scaledToFit()
-                    .viewSize(20)
-                    .foregroundColor(theme.colors.mainTint)
+                    .sizeAndColor(20, theme.colors.mainTint)
                 Text(title)
                     .font(.callout)
                     .foregroundColor(theme.colors.mainText)
```

**File**: `Sources/ExyteChat/Views/InputView/InputView+AttachmentPreviews.swift` (modified, +3/-9)
```diff
@@ -127,11 +127,9 @@ extension InputView {
                 }
             } label: {
                 theme.images.mediaPicker.cross
-                    .resizable()
-                    .viewSize(10)
+                    .sizeAndColor(10, .white)
                     .padding(4)
                     .background(Circle().fill(Color.black.opacity(0.6)))
-                    .foregroundColor(.white)
             }
         }
         .padding(.horizontal, 26)
@@ -157,11 +155,9 @@ extension InputView {
                 }
             } label: {
                 theme.images.mediaPicker.cross
-                    .resizable()
-                    .viewSize(10)
+                    .sizeAndColor(10, .white)
                     .padding(4)
                     .background(Circle().fill(Color.black.opacity(0.6)))
-                    .foregroundColor(.white)
             }
         }
         .padding(.horizontal, 26)
@@ -189,11 +185,9 @@ private struct RemovableAttachmentThumbnail<Content: View>: View {
             .overlay(alignment: .topTrailing) {
                 Button(action: onRemove) {
                     theme.images.mediaPicker.cross
-                        .resizable()
-                        .viewSize(10)
+                        .sizeAndColor(10, .white)
                         .padding(4)
                         .background(Circle().fill(Color.black.opacity(0.6)))
-                        .foregroundColor(.white)
                 }
                 .offset(x: 6, y: -6)
             }
```

**File**: `Sources/ExyteChat/Views/InputView/InputView.swift` (modified, +1/-4)
```diff
@@ -205,10 +205,7 @@ struct InputView: View {
             viewModel.text = ""
         } label: {
             theme.images.inputView.clearText
-                .resizable()
-                .renderingMode(.template)
-                .foregroundColor(theme.colors.mainText.opacity(0.6))
-                .viewSize(18)
+                .sizeAndColor(18, theme.colors.mainText.opacity(0.6))
                 .padding(EdgeInsets(top: 12, leading: 8, bottom: 12, trailing: 12))
         }
     }
```

**File**: `Sources/ExyteChat/Views/MessageView/MessageStatusView.swift` (modified, +1/-5)
```diff
@@ -32,11 +32,7 @@ struct MessageStatusView: View {
 
     private func statusImageStyled(image: Image, color: Color) -> some View {
         image
-            .renderingMode(.template)
-            .resizable()
-            .aspectRatio(contentMode: .fit)
-            .foregroundColor(color)
-            .frame(width: 40)
+            .sizeAndColor(40, color)
     }
 }
 
```

---

### Incident Patch 6: `5c0aa283` (2026-09-21)
**Commit Message**: Fix removing photos selected through system picker

**File**: `Sources/ExyteChat/Views/Attachments/AttachmentsEditor.swift` (modified, +4/-4)
```diff
@@ -56,7 +56,7 @@ struct AttachmentsEditor<InputViewContent: View>: View {
             Button {
                 seleсtedMedias = []
                 inputViewModel.attachments.medias = []
-                inputViewModel.showPicker = false
+                inputViewModel.showMediaPicker = false
             } label: {
                 theme.images.backButton
             }
@@ -80,7 +80,7 @@ struct AttachmentsEditor<InputViewContent: View>: View {
     }
 
     var mediaPicker: some View {
-        MediaPicker(isPresented: $inputViewModel.showPicker) {
+        MediaPicker(isPresented: $inputViewModel.showMediaPicker) {
             seleсtedMedias = $0
             assembleSelectedMedia()
         } albumSelectionBuilder: { _, albumSelectionView, _ in
@@ -91,7 +91,7 @@ struct AttachmentsEditor<InputViewContent: View>: View {
         }
         .didPressCancelCamera {
             inputViewModel.attachments.medias = []
-            inputViewModel.showPicker = false
+            inputViewModel.showMediaPicker = false
         }
         .fullscreenMedia($currentFullscreenMedia)
         .pickerMode($inputViewModel.mediaPickerMode)
@@ -100,7 +100,7 @@ struct AttachmentsEditor<InputViewContent: View>: View {
         .onChange(of: currentFullscreenMedia) {
             assembleSelectedMedia()
         }
-        .onChange(of: inputViewModel.showPicker) {
+        .onChange(of: inputViewModel.showMediaPicker) {
             let showFullscreenPreview = mediaPickerParameters.selectionParameters.showFullscreenPreview
             let selectionLimit = mediaPickerParameters.selectionParameters.selectionLimit ?? 1
 
```

**File**: `Sources/ExyteChat/Views/Attachments/SystemPhotoPicker.swift` (modified, +26/-18)
```diff
@@ -14,10 +14,8 @@ import AVFoundation
 
 struct SystemPhotoPickerModifier: ViewModifier {
     @Binding var isPresented: Bool
+    @Binding var medias: [Media]
     var selectionParameters: MediaPickerSelectionParameters
-    var onSelect: ([Media]) -> Void
-
-    @State private var selection: [PhotosPickerItem] = []
 
     private var matchingFilter: PHPickerFilter {
         switch selectionParameters.mediaType {
@@ -34,35 +32,45 @@ struct SystemPhotoPickerModifier: ViewModifier {
         }
     }
 
+    private var selection: Binding<[PhotosPickerItem]> {
+        Binding(
+            get: {
+                medias.compactMap { ($0.source as? SystemPickerMediaModel)?.item }
+            },
+            set: { newValue in
+                let existingByID = Dictionary(uniqueKeysWithValues: medias.compactMap { media in
+                    (media.source as? SystemPickerMediaModel)?.item.itemIdentifier.map { ($0, media) }
+                })
+
+                medias = newValue.map { item in
+                    guard let id = item.itemIdentifier, let existing = existingByID[id] else {
+                        return Media(source: SystemPickerMediaModel(item: item))
+                    }
+                    return existing
+                }
+            }
+        )
+    }
+
     func body(content: Content) -> some View {
         content
             .photosPicker(
                 isPresented: $isPresented,
-                selection: $selection,
+                selection: selection,
                 maxSelectionCount: selectionParameters.selectionLimit,
                 selectionBehavior: selectionBehavior,
                 matching: matchingFilter
             )
-            .onChange(of: selection) { oldValue, newValue in
-                let oldIDs = Set(oldValue.compactMap(\.itemIdentifier))
-                let added = newValue.filter { item in
-                    guard let id = item.itemIdentifier else { return true }
-                    return !oldIDs.contains(id)
-                }
-                guard !added.isEmpty else { return }
-                let medias = added.map { Media(source: SystemPickerMediaModel(item: $0)) }
-                onSelect(medias)
-            }
     }
 }
 
 extension View {
     func systemPhotoPicker(
         isPresented: Binding<Bool>,
-        selectionParameters: MediaPickerSelectionParameters,
-        onSelect: @escaping ([Media]) -> Void
+        medias: Binding<[Media]>,
+        selectionParameters: MediaPickerSelectionParameters
     ) -> some View {
-        modifier(SystemPhotoPickerModifier(isPresented: isPresented, selectionParameters: selectionParameters, onSelect: onSelect))
+        modifier(SystemPhotoPickerModifier(isPresented: isPresented, medias: medias, selectionParameters: selectionParameters))
     }
 }
 
@@ -86,7 +94,7 @@ private struct SystemPickerTransferFile: Transferable {
 }
 
 actor SystemPickerMediaModel: MediaModelProtocol {
-    private let item: PhotosPickerItem
+    nonisolated let item: PhotosPickerItem
     nonisolated let mediaType: MediaType?
     private var cachedURL: URL?
 
```

**File**: `Sources/ExyteChat/Views/ChatView.swift` (modified, +7/-8)
```diff
@@ -111,15 +111,15 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
 
     private var customMediaPickerBinding: Binding<Bool> {
         Binding(
-            get: { inputViewModel.showPicker && !useSystemPhotoPicker },
-            set: { inputViewModel.showPicker = $0 }
+            get: { inputViewModel.showMediaPicker && !useSystemPhotoPicker },
+            set: { inputViewModel.showMediaPicker = $0 }
         )
     }
 
     private var systemMediaPickerBinding: Binding<Bool> {
         Binding(
-            get: { inputViewModel.showPicker && useSystemPhotoPicker },
-            set: { inputViewModel.showPicker = $0 }
+            get: { inputViewModel.showMediaPicker && useSystemPhotoPicker },
+            set: { inputViewModel.showMediaPicker = $0 }
         )
     }
 
@@ -188,7 +188,7 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
                 }
             }
             // any attachment picker opening should resign the text field's focus
-            .onChange(of: [inputViewModel.showPicker, inputViewModel.showGiphyPicker, inputViewModel.showDocumentPicker, inputViewModel.showLocationPicker]) { _, newValues in
+            .onChange(of: [inputViewModel.showMediaPicker, inputViewModel.showGiphyPicker, inputViewModel.showDocumentPicker, inputViewModel.showLocationPicker]) { _, newValues in
                 if newValues.contains(true) {
                     globalFocusState.focus = nil
                 }
@@ -224,10 +224,9 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
             }
             .systemPhotoPicker(
                 isPresented: systemMediaPickerBinding,
+                medias: $inputViewModel.attachments.medias,
                 selectionParameters: inputViewCustomizationParameters.mediaPickerParameters.selectionParameters
-            ) { medias in
-                inputViewModel.attachments.medias = medias
-            }
+            )
             .sheet(isPresented: $inputViewModel.showDocumentPicker) {
                 DocumentPicker { documents in
                     inputViewModel.attachments.documents.append(contentsOf: documents)
```

**File**: `Sources/ExyteChat/Views/InputView/InputViewModel.swift` (modified, +4/-4)
```diff
@@ -15,7 +15,7 @@ final class InputViewModel: ObservableObject {
     @Published var state: InputViewState = .empty
 
     @Published var showGiphyPicker = false
-    @Published var showPicker = false
+    @Published var showMediaPicker = false
     @Published var showDocumentPicker = false
     @Published var showLocationPicker = false
 
@@ -53,7 +53,7 @@ final class InputViewModel: ObservableObject {
         attachments = InputViewAttachments()
         state = .empty
         showGiphyPicker = false
-        showPicker = false
+        showMediaPicker = false
         showDocumentPicker = false
         showLocationPicker = false
         saveEditingClosure = nil
@@ -85,12 +85,12 @@ final class InputViewModel: ObservableObject {
             showGiphyPicker = true
         case .photo:
             mediaPickerMode = .photos
-            showPicker = true
+            showMediaPicker = true
         case .add:
             mediaPickerMode = .camera
         case .camera:
             mediaPickerMode = .camera
-            showPicker = true
+            showMediaPicker = true
         case .document:
             showDocumentPicker = true
         case .location:
```

---

### Incident Patch 7: `60ff30bc` (2026-09-19)
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

### Incident Patch 8: `85152a86` (2026-09-18)
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

### Incident Patch 9: `01141705` (2026-09-18)
**Commit Message**: Fix video preview for system picker

**File**: `Sources/ExyteChat/Views/InputView/InputView+AttachmentPreviews.swift` (modified, +17/-19)
```diff
@@ -173,12 +173,13 @@ extension InputView {
 
 private struct RemovableAttachmentThumbnail<Content: View>: View {
     @Environment(\.chatTheme) var theme
+    @Environment(\.chatSize) var chatSize
 
     var onRemove: () -> Void
     @ViewBuilder var content: () -> Content
 
     private var thumbnailSize: CGFloat {
-        UIScreen.main.bounds.width / 5
+        chatSize.width / 5
     }
 
     var body: some View {
@@ -201,32 +202,29 @@ private struct RemovableAttachmentThumbnail<Content: View>: View {
 
 private struct MediaAttachmentThumbnail: View {
     @Environment(\.chatTheme) var theme
-    @Environment(\.chatSize) var chatSize
 
     var media: Media
     var onRemove: () -> Void
 
     @State private var thumbnail: UIImage?
 
-    private var thumbnailSize: CGFloat {
-        chatSize.width / 5
-    }
-
     var body: some View {
         RemovableAttachmentThumbnail(onRemove: onRemove) {
-            if let thumbnail {
-                Image(uiImage: thumbnail)
-                    .resizable()
-                    .scaledToFill()
-            } else {
-                Rectangle()
-                    .fill(theme.colors.messageFriendBG)
-            }
-
-            if media.type == .video {
-                Image(systemName: "play.circle.fill")
-                    .foregroundColor(.white)
-                    .font(.system(size: 20))
+            ZStack {
+                if let thumbnail {
+                    Image(uiImage: thumbnail)
+                        .resizable()
+                        .scaledToFill()
+                } else {
+                    Rectangle()
+                        .fill(theme.colors.messageFriendBG)
+                }
+                
+                if media.type == .video {
+                    Image(systemName: "play.circle.fill")
+                        .foregroundColor(.white)
+                        .font(.system(size: 20))
+                }
             }
         }
         .task(id: media.id) {
```

---

### Incident Patch 10: `660174bf` (2026-09-15)
**Commit Message**: Merge pull request #297 from lissine0/back-arrow-color-fix

A small theme fix

**File**: `Sources/ExyteChat/Resources/Media.xcassets/backArrow.imageset/Contents.json` (modified, +3/-0)
```diff
@@ -8,5 +8,8 @@
   "info" : {
     "author" : "xcode",
     "version" : 1
+  },
+  "properties" : {
+    "template-rendering-intent" : "template"
   }
 }
```

**File**: `Sources/ExyteChat/Views/Attachments/AttachmentsEditor.swift` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ struct AttachmentsEditor<InputViewContent: View>: View {
                 inputViewModel.attachments.medias = []
                 inputViewModel.showPicker = false
             } label: {
-                Image("backArrow", bundle: .current)
+                theme.images.backButton
             }
         }
     }
```

---

### Incident Patch 11: `0655f368` (2026-09-15)
**Commit Message**: Render the back arrow image as a template

This allows it to be colored.

**File**: `Sources/ExyteChat/Resources/Media.xcassets/backArrow.imageset/Contents.json` (modified, +3/-0)
```diff
@@ -8,5 +8,8 @@
   "info" : {
     "author" : "xcode",
     "version" : 1
+  },
+  "properties" : {
+    "template-rendering-intent" : "template"
   }
 }
```

---

### Incident Patch 12: `759fb99c` (2026-08-26)
**Commit Message**: fix FullscreenMediaPages

**File**: `Sources/ExyteChat/Views/Attachments/FullscreenMediaPages.swift` (modified, +0/-2)
```diff
@@ -10,7 +10,6 @@ struct FullscreenMediaPages: View {
     @Environment(\.chatTheme) private var theme
 
     @StateObject var viewModel: FullscreenMediaPagesViewModel
-    var safeAreaInsets: EdgeInsets
     var showShareButton: Bool = true
     var onClose: () -> Void
 
@@ -76,7 +75,6 @@ struct FullscreenMediaPages: View {
             Text("\(viewModel.index + 1)/\(viewModel.attachments.count)")
                 .foregroundColor(tintColor)
         }
-        .padding(.top, safeAreaInsets.top)
         .padding(.bottom, 8)
     }
 
```

**File**: `Sources/ExyteChat/Views/ChatView.swift` (modified, +1/-1)
```diff
@@ -172,7 +172,6 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
             ) { medias in
                 inputViewModel.attachments.medias = medias
             }
-            .fullScreenCover(isPresented: $viewModel.fullscreenAttachmentPresented) {
             .sheet(isPresented: $inputViewModel.showDocumentPicker) {
                 DocumentPicker { documents in
                     inputViewModel.attachments.documents.append(contentsOf: documents)
@@ -186,6 +185,7 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
                     inputViewModel.attachments.liveLocation = liveLocation
                 }
             }
+            .fullScreenCover(isPresented: $viewModel.fullscreenAttachmentPresented) {
                 let attachments = sections.flatMap { section in section.rows.flatMap { $0.message.attachments } }
                 let index = attachments.firstIndex { $0.id == viewModel.fullscreenAttachmentItem?.id }
 
```

---

### Incident Patch 13: `aab915c9` (2026-08-21)
**Commit Message**: Fix for ipad's 3 dots button

**File**: `ChatExample/ChatExample/ContentView.swift` (modified, +1/-0)
```diff
@@ -73,6 +73,7 @@ struct ContentView: View {
                         }
                         ColorPicker("", selection: $color)
                     }
+                    .fixedSize()
                 }
             }
         }
```

**File**: `ChatExample/ChatExample/Screens/ChatExampleView.swift` (modified, +0/-1)
```diff
@@ -175,7 +175,6 @@ struct ChatExampleView: View {
                     }
                 }
             }
-            .padding(.leading, 10)
         }
     }
 
```

**File**: `Sources/ExyteChat/Extensions/View+WindowCover.swift` (removed, +0/-105)
```diff
@@ -1,105 +0,0 @@
-//
-//  View+WindowCover.swift
-//  Chat
-//
-//  Created by Alisa Mylnikova on 19.08.2026.
-//
-
-import SwiftUI
-import UIKit
-
-extension View {
-    func windowCover<Content: View>(
-        isPresented: Binding<Bool>,
-        @ViewBuilder content: @escaping () -> Content
-    ) -> some View {
-        modifier(WindowCoverModifier(isPresented: isPresented, coverContent: content))
-    }
-}
-
-private final class WindowCoverHost: ObservableObject {
-    weak var scene: UIWindowScene?
-    private var window: UIWindow?
-
-    func show<Content: View>(_ content: Content) {
-        guard window == nil, let scene else { return }
-
-        let appFrame: CGRect
-        if #available(iOS 15.0, *), let kw = scene.keyWindow {
-            appFrame = kw.frame
-        } else {
-            appFrame = UIApplication.shared.keyWindow?.frame ?? scene.screen.bounds
-        }
-
-        let newWindow = UIWindow(windowScene: scene)
-        newWindow.windowLevel = .alert
-        newWindow.frame = appFrame
-
-        let hostingController = UIHostingController(rootView: AnyView(content))
-        hostingController.view.backgroundColor = .clear
-        newWindow.rootViewController = hostingController
-        newWindow.makeKeyAndVisible()
-
-        newWindow.transform = CGAffineTransform(translationX: 0, y: 1000)
-        UIView.animate(withDuration: 0.35, delay: 0, options: .curveEaseOut) {
-            newWindow.transform = .identity
-        }
-
-        window = newWindow
-    }
-
-    func hide() {
-        guard let w = window else { return }
-        window = nil
-        UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseIn) {
-            w.transform = CGAffineTransform(translationX: 0, y: 1000)
-        } completion: { _ in
-            w.resignKey()
-            w.windowScene = nil
-        }
-    }
-
-    deinit {
-        window?.resignKey()
-        window?.windowScene = nil
-    }
-}
-
-private struct SceneCaptureView: UIViewRepresentable {
-    let onScene: (UIWindowScene) -> Void
-
-    class Coordinator {
-        weak var lastScene: UIWindowScene?
-    }
-
-    func makeCoordinator() -> Coordinator { Coordinator() }
-    func makeUIView(context: Context) -> UIView { UIView() }
-
-    func updateUIView(_ uiView: UIView, context: Context) {
-        guard let scene = uiView.window?.windowScene,
-              scene !== context.coordinator.lastScene else { return }
-        context.coordinator.lastScene = scene
-        onScene(scene)
-    }
-}
-
-private struct WindowCoverModifier<CoverContent: View>: ViewModifier {
-    @Binding var isPresented: Bool
-    let coverContent: () -> CoverContent
-
-    @StateObject private var host = WindowCoverHost()
-
-    func body(content: Content) -> some View {
-        content
-            .background(SceneCaptureView { scene in
-                host.scene = scene
-            })
-            .onChange(of: isPresented) { _, newValue in
-                if newValue {
-                    host.show(coverContent())
-                } else {
-                    host.hide()
-                }
-            }
-    }
-}
```

**File**: `Sources/ExyteChat/Views/Attachments/AttachmentsEditor.swift` (modified, +45/-42)
```diff
@@ -10,7 +10,7 @@ import ExyteMediaPicker
 import ActivityIndicatorView
 
 struct AttachmentsEditor<InputViewContent: View>: View {
-    
+
     typealias InputViewBuilderParamsClosure = ChatView<EmptyView, InputViewContent, DefaultMessageMenuAction>.InputViewBuilderParamsClosure
 
     @Environment(\.chatTheme) var theme
@@ -36,9 +36,46 @@ struct AttachmentsEditor<InputViewContent: View>: View {
     }
 
     var body: some View {
-        VStack(spacing: 0) {
-            mediaPicker
-            inputView
+        NavigationStack {
+            VStack(spacing: 0) {
+                mediaPicker
+                inputView
+            }
+            .navigationBarTitleDisplayMode(.inline)
+            .toolbarBackground(mediaPickerTheme.main.pickerBackground, for: .navigationBar)
+            .toolbarBackground(.visible, for: .navigationBar)
+            .toolbar {
+                backToolbarItem
+                titleToolbarItem
+            }
+        }
+    }
+
+    var backToolbarItem: some ToolbarContent {
+        ToolbarItem(placement: .navigationBarLeading) {
+            Button {
+                seleсtedMedias = []
+                inputViewModel.attachments.medias = []
+                inputViewModel.showPicker = false
+            } label: {
+                Image("backArrow", bundle: .current)
+            }
+        }
+    }
+
+    var titleToolbarItem: some ToolbarContent {
+        ToolbarItem(placement: .principal) {
+            Button {
+                withAnimation {
+                    inputViewModel.mediaPickerMode = showingAlbums ? .photos : .albums
+                }
+            } label: {
+                HStack(spacing: 4) {
+                    Text(localization.recentToggleText)
+                    Image(systemName: "chevron.down")
+                        .rotationEffect(Angle(radians: showingAlbums ? .pi : 0))
+                }
+            }
         }
     }
 
@@ -47,12 +84,10 @@ struct AttachmentsEditor<InputViewContent: View>: View {
             seleсtedMedias = $0
             assembleSelectedMedia()
         } albumSelectionBuilder: { _, albumSelectionView, _ in
-            VStack {
-                albumSelectionHeaderView
-                albumSelectionView
-            }
-            .frame(maxWidth: .infinity, maxHeight: .infinity)
-            .background(mediaPickerTheme.main.pickerBackground.ignoresSafeArea())
+            albumSelectionView
+                .frame(maxWidth: .infinity, maxHeight: .infinity)
+                .background(mediaPickerTheme.main.pickerBackground)
+                .tint(mediaPickerTheme.main.pickerText)
         }
         .didPressCancelCamera {
             inputViewModel.attachments.medias = []
@@ -61,7 +96,6 @@ struct AttachmentsEditor<InputViewContent: View>: View {
         .fullscreenMedia($currentFullscreenMedia)
         .pickerMode($inputViewModel.mediaPickerMode)
         .setMediaPickerParameters(mediaPickerParameters)
-        .padding(.top)
         .background(theme.colors.mainBG)
         .onChange(of: currentFullscreenMedia) {
             assembleSelectedMedia()
@@ -127,37 +161,6 @@ struct AttachmentsEditor<InputViewContent: View>: View {
         }
     }
 
-    var albumSelectionHeaderView: some View {
-        ZStack {
-            HStack {
-                Button {
-                    seleсtedMedias = []
-                    inputViewModel.attachments.medias = []
-                    inputViewModel.showPicker = false
-                } label: {
-                    Text(localization.cancelButtonText)
-                }
-
-                Spacer()
-            }
-
-            HStack {
-                Text(localization.recentToggleText)
-                Image(systemName: "chevron.down")
-                    .rotationEffect(Angle(radians: showingAlbums ? .pi : 0))
-            }
-            .onTapGesture {
-                withAnimation {
-                    inputViewModel.mediaPickerMode = showingAlbums ? .photos : .albums
-                }
-            }
-            .frame(maxWidth: .infinity)
-        }
-        .foregroundColor(mediaPickerTheme.main.pickerText)
-        .padding(.horizontal)
-        .padding(.bottom, 5)
-    }
-
     func cameraSelectionHeaderView(cancelClosure: @escaping ()->()) -> some View {
         HStack {
             Button(action: cancelClosure) {
```

**File**: `Sources/ExyteChat/Views/ChatView.swift` (modified, +12/-16)
```diff
@@ -158,7 +158,7 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
                     Text("no giphy key found")
                 }
             }
-            .windowCover(isPresented: customMediaPickerBinding) {
+            .fullScreenCover(isPresented: customMediaPickerBinding) {
                 AttachmentsEditor(
                     inputViewModel: inputViewModel,
                     inputViewBuilder: inputViewBuilder,
@@ -175,24 +175,20 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
             ) { medias in
                 inputViewModel.attachments.medias = medias
             }
-            .windowCover(isPresented: $viewModel.fullscreenAttachmentPresented) {
+            .fullScreenCover(isPresented: $viewModel.fullscreenAttachmentPresented) {
                 let attachments = sections.flatMap { section in section.rows.flatMap { $0.message.attachments } }
                 let index = attachments.firstIndex { $0.id == viewModel.fullscreenAttachmentItem?.id }
 
-                GeometryReader { g in
-                    FullscreenMediaPages(
-                        viewModel: FullscreenMediaPagesViewModel(
-                            attachments: attachments,
-                            index: index ?? 0
-                        ),
-                        safeAreaInsets: g.safeAreaInsets,
-                        showShareButton: chatCustomizationParameters.showShareAttachmentButton,
-                        onClose: { [weak viewModel] in
-                            viewModel?.dismissAttachmentFullScreen()
-                        }
-                    )
-                    .ignoresSafeArea()
-                }
+                FullscreenMediaPages(
+                    viewModel: FullscreenMediaPagesViewModel(
+                        attachments: attachments,
+                        index: index ?? 0
+                    ),
+                    showShareButton: chatCustomizationParameters.showShareAttachmentButton,
+                    onClose: { [weak viewModel] in
+                        viewModel?.dismissAttachmentFullScreen()
+                    }
+                )
             }
             .sheet(item: $viewModel.shareAttachmentsItem) { item in
                 ShareSheet(activityItems: item.urls)
```

---

### Incident Patch 14: `4230399c` (2026-08-19)
**Commit Message**: More UIScreen bug fixes

**File**: `ChatExample/ChatExample.xcodeproj/project.pbxproj` (modified, +2/-0)
```diff
@@ -58,6 +58,7 @@
 		5B0636D52C2E9F6100E54AEE /* CommentsExampleView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CommentsExampleView.swift; sourceTree = "<group>"; };
 		5B0636DA2C2EA21900E54AEE /* Sequence+asyncMap.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Sequence+asyncMap.swift"; sourceTree = "<group>"; };
 		5B6D3A722987D85A00765148 /* Color+hex.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Color+hex.swift"; sourceTree = "<group>"; };
+		5B83F95030357B7C0073275B /* MediaPicker */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = MediaPicker; path = "/Users/f3dm76/Work/!OpenSource/MediaPicker"; sourceTree = "<absolute>"; };
 		5BE239E82FADEA4700B95E5B /* ActiveChatExampleView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ActiveChatExampleView.swift; sourceTree = "<group>"; };
 		5BE239EA2FADEB1F00B95E5B /* ActiveChatExampleViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ActiveChatExampleViewModel.swift; sourceTree = "<group>"; };
 		FF220E5C2DD9F0AF00BE315E /* .editorconfig */ = {isa = PBXFileReference; lastKnownFileType = text; path = .editorconfig; sourceTree = "<group>"; };
@@ -79,6 +80,7 @@
 		135549272864620900C9459A = {
 			isa = PBXGroup;
 			children = (
+				5B83F95030357B7C0073275B /* MediaPicker */,
 				135549322864620900C9459A /* ChatExample */,
 				5B4DBAA32D92E2560067A006 /* Frameworks */,
 				135549312864620900C9459A /* Products */,
```

**File**: `Sources/ExyteChat/Extensions/View+WindowCover.swift` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+//
+//  View+WindowCover.swift
+//  Chat
+//
+//  Created by Alisa Mylnikova on 19.08.2026.
+//
+
+import SwiftUI
+import UIKit
+
+extension View {
+    func windowCover<Content: View>(
+        isPresented: Binding<Bool>,
+        @ViewBuilder content: @escaping () -> Content
+    ) -> some View {
+        modifier(WindowCoverModifier(isPresented: isPresented, coverContent: content))
+    }
+}
+
+private final class WindowCoverHost: ObservableObject {
+    weak var scene: UIWindowScene?
+    private var window: UIWindow?
+
+    func show<Content: View>(_ content: Content) {
+        guard window == nil, let scene else { return }
+
+        let appFrame: CGRect
+        if #available(iOS 15.0, *), let kw = scene.keyWindow {
+            appFrame = kw.frame
+        } else {
+            appFrame = UIApplication.shared.keyWindow?.frame ?? scene.screen.bounds
+        }
+
+        let newWindow = UIWindow(windowScene: scene)
+        newWindow.windowLevel = .alert
+        newWindow.frame = appFrame
+
+        let hostingController = UIHostingController(rootView: AnyView(content))
+        hostingController.view.backgroundColor = .clear
+        newWindow.rootViewController = hostingController
+        newWindow.makeKeyAndVisible()
+
+        newWindow.transform = CGAffineTransform(translationX: 0, y: 1000)
+        UIView.animate(withDuration: 0.35, delay: 0, options: .curveEaseOut) {
+            newWindow.transform = .identity
+        }
+
+        window = newWindow
+    }
+
+    func hide() {
+        guard let w = window else { return }
+        window = nil
+        UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseIn) {
+            w.transform = CGAffineTransform(translationX: 0, y: 1000)
+        } completion: { _ in
+            w.resignKey()
+            w.windowScene = nil
+        }
+    }
+
+    deinit {
+        window?.resignKey()
+        window?.windowScene = nil
+    }
+}
+
+private struct SceneCaptureView: UIViewRepresentable {
+    let onScene: (UIWindowScene) -> Void
+
+    class Coordinator {
+        weak var lastScene: UIWindowScene?
+    }
+
+    func makeCoordinator() -> Coordinator { Coordinator() }
+    func makeUIView(context: Context) -> UIView { UIView() }
+
+    func updateUIView(_ uiView: UIView, context: Context) {
+        guard let scene = uiView.window?.windowScene,
+              scene !== context.coordinator.lastScene else { return }
+        context.coordinator.lastScene = scene
+        onScene(scene)
+    }
+}
+
+private struct WindowCoverModifier<CoverContent: View>: ViewModifier {
+    @Binding var isPresented: Bool
+    let coverContent: () -> CoverContent
+
+    @StateObject private var host = WindowCoverHost()
+
+    func body(content: Content) -> some View {
+        content
+            .background(SceneCaptureView { scene in
+                host.scene = scene
+            })
+            .onChange(of: isPresented) { _, newValue in
+                if newValue {
+                    host.show(coverContent())
+                } else {
+                    host.hide()
+                }
+            }
+    }
+}
```

**File**: `Sources/ExyteChat/Views/Attachments/AttachmentsEditor.swift` (modified, +41/-63)
```diff
@@ -36,78 +36,56 @@ struct AttachmentsEditor<InputViewContent: View>: View {
     }
 
     var body: some View {
-        ZStack {
+        VStack(spacing: 0) {
             mediaPicker
-
-            if inputViewModel.showActivityIndicator {
-                ActivityIndicator()
-            }
+            inputView
         }
     }
 
     var mediaPicker: some View {
-        GeometryReader { g in
-            MediaPicker(isPresented: $inputViewModel.showPicker) {
-                seleсtedMedias = $0
-                assembleSelectedMedia()
-            } albumSelectionBuilder: { _, albumSelectionView, _ in
-                VStack {
-                    albumSelectionHeaderView
-                        .padding(.top, g.safeAreaInsets.top)
-                    albumSelectionView
-                    Spacer()
-                    inputView
-                        .padding(.bottom, g.safeAreaInsets.bottom)
-                }
-                .background(mediaPickerTheme.main.pickerBackground.ignoresSafeArea())
-            } cameraSelectionBuilder: { _, cancelClosure, cameraSelectionView in
-                VStack {
-                    cameraSelectionView
-                        .overlay(alignment: .top) {
-                            cameraSelectionHeaderView(cancelClosure: cancelClosure)
-                                .padding(.top, 12)
-                        }
-                        .padding(.top, g.safeAreaInsets.top)
-                    Spacer()
-                    inputView
-                        .padding(.bottom, g.safeAreaInsets.bottom)
-                }
-                .background(mediaPickerTheme.main.pickerBackground.ignoresSafeArea())
-            }
-            .didPressCancelCamera {
-                inputViewModel.attachments.medias = []
-                inputViewModel.showPicker = false
-            }
-            .fullscreenMedia($currentFullscreenMedia)
-            .pickerMode($inputViewModel.mediaPickerMode)
-            .setMediaPickerParameters(mediaPickerParameters)
-            .padding(.top)
-            .background(theme.colors.mainBG)
-            .ignoresSafeArea(.all)
-            .onChange(of: currentFullscreenMedia) {
-                assembleSelectedMedia()
+        MediaPicker(isPresented: $inputViewModel.showPicker) {
+            seleсtedMedias = $0
+            assembleSelectedMedia()
+        } albumSelectionBuilder: { _, albumSelectionView, _ in
+            VStack {
+                albumSelectionHeaderView
+                albumSelectionView
             }
-            .onChange(of: inputViewModel.showPicker) {
-                let showFullscreenPreview = mediaPickerParameters.selectionParameters.showFullscreenPreview
-                let selectionLimit = mediaPickerParameters.selectionParameters.selectionLimit ?? 1
+            .frame(maxWidth: .infinity, maxHeight: .infinity)
+            .background(mediaPickerTheme.main.pickerBackground.ignoresSafeArea())
+        }
+        .didPressCancelCamera {
+            inputViewModel.attachments.medias = []
+            inputViewModel.showPicker = false
+        }
+        .fullscreenMedia($currentFullscreenMedia)
+        .pickerMode($inputViewModel.mediaPickerMode)
+        .setMediaPickerParameters(mediaPickerParameters)
+        .padding(.top)
+        .background(theme.colors.mainBG)
+        .onChange(of: currentFullscreenMedia) {
+            assembleSelectedMedia()
+        }
+        .onChange(of: inputViewModel.showPicker) {
+            let showFullscreenPreview = mediaPickerParameters.selectionParameters.showFullscreenPreview
+            let selectionLimit = mediaPickerParameters.selectionParameters.selectionLimit ?? 1
 
-                if selectionLimit == 1 && !showFullscreenPreview {
-                    assembleSelectedMedia()
-                    inputViewModel.send()
-                }
+            if selectionLimit == 1 && !showFullscreenPreview {
+                assembleSelectedMedia()
+                inputViewModel.send()
             }
-            .applyIf(!mediaPickerThemeIsOverridden) {
-                $0.mediaPickerTheme(
-                    main: .init(
-                        pickerText: theme.colors.mainText,
-                        pickerBackground: theme.colors.mainBG,
-                        fullscreenPhotoBackground: theme.colors.mainBG
-                    ),
-                    selection: .init(
-                        accent: theme.colors.sendButtonBackground
-                    )
+        }
+        .applyIf(!mediaPickerThemeIsOverridden) {
+            $0.mediaPickerTheme(
+                main: .init(
+                    pickerText: theme.colors.mainText,
+                    pickerBackground: theme.colors.mainBG,
+                    fullscreenPhotoBackground: theme.colors.mainBG
+                ),
+                selection: .init(
+                    accent: theme.colors.sendButtonBackground
                 )
-            }
+            )
         }
 
```

**File**: `Sources/ExyteChat/Views/ChatView.swift` (modified, +3/-3)
```diff
@@ -158,7 +158,7 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
                     Text("no giphy key found")
                 }
             }
-            .fullScreenCover(isPresented: customMediaPickerBinding) {
+            .windowCover(isPresented: customMediaPickerBinding) {
                 AttachmentsEditor(
                     inputViewModel: inputViewModel,
                     inputViewBuilder: inputViewBuilder,
@@ -175,7 +175,7 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
             ) { medias in
                 inputViewModel.attachments.medias = medias
             }
-            .fullScreenCover(isPresented: $viewModel.fullscreenAttachmentPresented) {
+            .windowCover(isPresented: $viewModel.fullscreenAttachmentPresented) {
                 let attachments = sections.flatMap { section in section.rows.flatMap { $0.message.attachments } }
                 let index = attachments.firstIndex { $0.id == viewModel.fullscreenAttachmentItem?.id }
 
@@ -248,7 +248,7 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
         }
         // Used to prevent ChatView movement during Emoji Keyboard invocation
         .ignoresSafeArea(isShowingMenu ? .keyboard : [])
-        .onGeometryChange(for: CGSize.self) { $0.size } action: { chatSize = $0 }
+        .sizeGetter($chatSize)
         .environment(\.chatSize, chatSize)
     }
     
```

---

### Incident Patch 15: `eead710d` (2026-08-18)
**Commit Message**: Replace UIScreen size with actual chat size

**File**: `Sources/ExyteChat/Views/ChatView.swift` (modified, +3/-0)
```diff
@@ -101,6 +101,7 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
 
     @State private var giphyConfigured = false
     @State private var selectedGiphyMedia: GPHMedia? = nil
+    @State private var chatSize: CGSize = .zero
 
     public var body: some View {
         mainView
@@ -247,6 +248,8 @@ public struct ChatView<MessageContent: View, InputViewContent: View, MenuAction:
         }
         // Used to prevent ChatView movement during Emoji Keyboard invocation
         .ignoresSafeArea(isShowingMenu ? .keyboard : [])
+        .onGeometryChange(for: CGSize.self) { $0.size } action: { chatSize = $0 }
+        .environment(\.chatSize, chatSize)
     }
     
     var waitingForNetwork: some View {
```

**File**: `Sources/ExyteChat/Views/InputView/InputView.swift` (modified, +4/-2)
```diff
@@ -82,6 +82,7 @@ struct InputView: View {
     
     @Environment(\.chatTheme) private var theme
     @Environment(\.mediaPickerTheme) private var pickerTheme
+    @Environment(\.chatSize) private var chatSize
 
     @EnvironmentObject private var keyboardState: KeyboardState
     
@@ -677,7 +678,7 @@ struct InputView: View {
                     onAction(.recordAudioLock)
                 }
                 
-                if value.location.x < UIScreen.main.bounds.width/2,
+                if value.location.x < chatSize.width / 2,
                    value.location.y > recordButtonFrame.minY {
                     cancelGesture = true
                     onAction(.deleteRecord)
@@ -753,14 +754,15 @@ private struct AttachMenuRow: View {
 
 private struct MediaAttachmentThumbnail: View {
     @Environment(\.chatTheme) private var theme
+    @Environment(\.chatSize) private var chatSize
 
     let media: Media
     let onRemove: () -> Void
 
     @State private var thumbnail: UIImage?
 
     private var thumbnailSize: CGFloat {
-        UIScreen.main.bounds.width / 5
+        chatSize.width / 5
     }
 
     var body: some View {
```

**File**: `Sources/ExyteChat/Views/MessageView/MessageMenu/MessageMenu+ReactionSelectionView.swift` (modified, +9/-8)
```diff
@@ -8,7 +8,8 @@ import SwiftUI
 struct ReactionSelectionView: View {
     
     @Environment(\.dynamicTypeSize) private var dynamicTypeSize
-    
+    @Environment(\.chatSize) private var chatSize
+
     static let maxSelectionRowWidth: CGFloat = 400
 
     @StateObject private var keyboardState = KeyboardState()
@@ -177,7 +178,7 @@ struct ReactionSelectionView: View {
             Color.clear.viewWidth(max(1, leadingPadding - 8))
             Spacer()
         } else {
-            let additionalPadding = max(0, UIScreen.main.bounds.width - maxSelectionRowWidth - trailingPadding)
+            let additionalPadding = max(0, chatSize.width - maxSelectionRowWidth - trailingPadding)
             Color.clear.viewWidth(additionalPadding + trailingPadding * 3)
         }
     }
@@ -188,7 +189,7 @@ struct ReactionSelectionView: View {
             Spacer()
             Color.clear.viewWidth(trailingPadding)
         } else {
-            let additionalPadding = max(0, UIScreen.main.bounds.width - maxSelectionRowWidth - leadingPadding)
+            let additionalPadding = max(0, chatSize.width - maxSelectionRowWidth - leadingPadding)
             Color.clear.viewWidth(additionalPadding + trailingPadding * 3)
         }
     }
@@ -287,16 +288,16 @@ struct ReactionSelectionView: View {
     /// - Note: If the messageFrame's width is equal to, or larger than, the Screens width then we skip the offset animation
     /// - Note: This also prevents the offset animation from occuring when the user uses a custom message builder
     private func getXOffset() -> CGFloat {
-        guard viewModel.messageFrame.width < UIScreen.main.bounds.width else { return .leastNonzeroMagnitude }
+        guard viewModel.messageFrame.width < chatSize.width else { return .leastNonzeroMagnitude }
         switch viewState {
         case .initial, .row:
             return .leastNonzeroMagnitude
         case .search, .picked:
             if alignment == .left {
-                let additionalPadding = max(0, UIScreen.main.bounds.width - maxSelectionRowWidth - leadingPadding) - UIApplication.safeArea.leading
-                return -((UIScreen.main.bounds.width - (additionalPadding + trailingPadding * 3) - (bubbleDiameter * 0.8)) - viewModel.messageFrame.maxX)
+                let additionalPadding = max(0, chatSize.width - maxSelectionRowWidth - leadingPadding) - UIApplication.safeArea.leading
+                return -((chatSize.width - (additionalPadding + trailingPadding * 3) - (bubbleDiameter * 0.8)) - viewModel.messageFrame.maxX)
             } else {
-                let additionalPadding = max(0, UIScreen.main.bounds.width - maxSelectionRowWidth - trailingPadding) - UIApplication.safeArea.leading
+                let additionalPadding = max(0, chatSize.width - maxSelectionRowWidth - trailingPadding) - UIApplication.safeArea.leading
                 return viewModel.messageFrame.minX - ((additionalPadding + trailingPadding * 3) + (bubbleDiameter * 0.8))
             }
         }
@@ -307,7 +308,7 @@ struct ReactionSelectionView: View {
     /// - Note: If the messageFrame's width is equal to, or larger than, the Screens width then we skip the offset animation
     /// - Note: This also prevents the offset animation from occuring when the user uses a custom message builder
     private func getYOffset() -> CGFloat {
-        guard viewModel.messageFrame.width < UIScreen.main.bounds.width else { return .leastNonzeroMagnitude }
+        guard viewModel.messageFrame.width < chatSize.width else { return .leastNonzeroMagnitude }
         switch viewState {
         case .initial, .row:
             return .leastNonzeroMagnitude
```

**File**: `Sources/ExyteChat/Views/MessageView/MessageMenu/MessageMenu.swift` (modified, +13/-17)
```diff
@@ -23,15 +23,13 @@ struct MessageMenu<MainButton: View, ActionEnum: MessageMenuAction>: View {
 
     @Environment(\.chatTheme) private var theme
     @Environment(\.dismiss) var dismiss
-    
+    @Environment(\.chatSize) private var chatSize
+
     @StateObject private var keyboardState = KeyboardState()
     @StateObject var viewModel: ChatViewModel
-    
+
     @Binding var isShowingMenu: Bool
-    
-    /// Overall ChatView Frame
-    let chatViewFrame: CGRect = UIScreen.main.bounds
-    
+
     /// The max height for the menu
     /// - Note: menus that exceed this value will be placed in a ScrollView
     let maxMenuHeight: CGFloat = 200
@@ -123,9 +121,10 @@ struct MessageMenu<MainButton: View, ActionEnum: MessageMenuAction>: View {
         dismissSelf(rt)
     }
     
-    /// The max height for the entire message menu and surrounding views
+    private var chatViewFrame: CGRect { CGRect(origin: .zero, size: chatSize) }
+
     var maxEntireHeight: CGFloat {
-        self.chatViewFrame.height
+        chatViewFrame.height - UIApplication.safeArea.top - UIApplication.safeArea.bottom
     }
     
     /// Unwraps and returns our optional `UIFont` as a `Font` or `nil`
@@ -251,7 +250,7 @@ struct MessageMenu<MainButton: View, ActionEnum: MessageMenuAction>: View {
             reactionOverviewIsVisible = shouldShowReactionOverviewView
             reactionSelectionIsVisible = shouldShowReactionSelectionView
             menuIsVisible = true
-            verticalOffset = UIScreen.main.bounds.height * 2
+            verticalOffset = chatSize.height * 2
             
             /// Kick off the background animation
             withAnimation(.easeInOut(duration: animationDuration)) {
@@ -270,7 +269,7 @@ struct MessageMenu<MainButton: View, ActionEnum: MessageMenuAction>: View {
             }
             
             /// If we're in landscape mode, adjust the `horizontalOffset` appropriately
-            if UIScreen.main.bounds.width > UIScreen.main.bounds.height {
+            if chatSize.width > chatSize.height {
                 switch alignment {
                 case .left:
                     horizontalOffset = UIApplication.safeArea.leading
@@ -287,17 +286,15 @@ struct MessageMenu<MainButton: View, ActionEnum: MessageMenuAction>: View {
             
             messageTopPadding = 4
             
-            /// Calculate our vertical safe area insets
-            let safeArea = UIApplication.safeArea.top + UIApplication.safeArea.bottom
             /// Calculate our ReactionOverview height
             let rOHeight: CGFloat = reactionOverviewIsVisible ? reactionOverviewHeight : 0
             /// We calculate the total height here, instead of using messageMenuFrame.height
             /// messageMenuHeight renders the menu buttons in a VStack by default, and we need to account for the clamping of the menu height
             let totalMenuHeight = calculateMessageMenuHeight(including: [.message, .reactionSelection]) + min(menuHeight, maxMenuHeight)
             /// Compare our total menu height with our free screen space to determine if we need to place it in a ScrollView or not
-            if ( totalMenuHeight + rOHeight ) > maxEntireHeight - safeArea {
+            if ( totalMenuHeight + rOHeight ) > maxEntireHeight {
                 /// We need to place our entire view in a ScrollView
-                messageMenuStyle = .scrollView(height: maxEntireHeight - safeArea)
+                messageMenuStyle = .scrollView(height: maxEntireHeight)
             } else if menuHeight > maxMenuHeight {
                 /// We need to place our menu buttons in a ScrollView
                 menuStyle = .scrollView(height: maxMenuHeight)
@@ -359,9 +356,8 @@ struct MessageMenu<MainButton: View, ActionEnum: MessageMenuAction>: View {
                     /// Ensure we still need our scroll view
                     let rOHeight: CGFloat = reactionOverviewIsVisible ? reactionOverviewHeight : 0
                     let contentHeight = calculateMessageMenuHeight(including: [.message, .reactionSelection, .menu]) + rOHeight
-                    let safeArea = UIApplication.safeArea.top + UIApplication.safeArea.bottom
-                    if contentHeight > maxEntireHeight - safeArea {
-                        messageMenuStyle = .scrollView(height: maxEntireHeight - safeArea)
+                    if contentHeight > maxEntireHeight {
+                        messageMenuStyle = .scrollView(height: maxEntireHeight)
                     } else {
                         messageMenuStyle = .vStack
                     }
```

**File**: `Sources/ExyteChat/Views/MessageView/MessageView.swift` (modified, +4/-3)
```diff
@@ -10,6 +10,7 @@ import SwiftUI
 struct MessageView: View {
 
     @Environment(\.chatTheme) var theme
+    @Environment(\.chatSize) var chatSize
 
     @ObservedObject var viewModel: ChatViewModel
 
@@ -51,7 +52,7 @@ struct MessageView: View {
         let statusViewWithPaddings = MessageView.statusViewWidth + MessageView.horizontalSpacing
         let textPaddings = MessageView.horizontalTextPadding * 2
         let widthWithoutMedia =
-            UIScreen.main.bounds.width
+            chatSize.width
             - bubblePaddings
             - (isCurrentUser && params.showAvatar ? 0 : avatarViewWithPaddings)
             - (isCurrentUser ? MessageView.statusViewWidth : 0)
@@ -80,7 +81,7 @@ struct MessageView: View {
         struct Cache { static var value: CGFloat? }
         if let value = Cache.value { return value }
 
-        let value = AttributedString("🙃️️️️").width(withConstrainedWidth: UIScreen.main.bounds.width, font: params.font) + ReactionBubble.padding * 2
+        let value = AttributedString("🙃️️️️").width(withConstrainedWidth: chatSize.width, font: params.font) + ReactionBubble.padding * 2
 
         Cache.value = value
         return value
@@ -140,7 +141,7 @@ struct MessageView: View {
             message.user.isCurrentUser ? .leading : .trailing, MessageView.horizontalBubblePadding
         )
         .frame(
-            maxWidth: UIScreen.main.bounds.width,
+            maxWidth: chatSize.width,
             alignment: message.user.isCurrentUser ? .trailing : .leading
         )
     }
```

**File**: `Sources/ExyteChat/Views/MessageView/MessageViewEnvironment.swift` (modified, +9/-0)
```diff
@@ -8,6 +8,10 @@ private struct MessageCustomizationParamsEnvironmentKey: EnvironmentKey {
     static let defaultValue = MessageCustomizationParameters()
 }
 
+private struct ChatSizeEnvironmentKey: EnvironmentKey {
+    static let defaultValue: CGSize = .zero
+}
+
 extension EnvironmentValues {
     var chatMessageType: ChatType {
         get { self[ChatMessageTypeEnvironmentKey.self] }
@@ -18,4 +22,9 @@ extension EnvironmentValues {
         get { self[MessageCustomizationParamsEnvironmentKey.self] }
         set { self[MessageCustomizationParamsEnvironmentKey.self] = newValue }
     }
+
+    var chatSize: CGSize {
+        get { self[ChatSizeEnvironmentKey.self] }
+        set { self[ChatSizeEnvironmentKey.self] = newValue }
+    }
 }
```

**File**: `Sources/ExyteChat/Views/Recording/RecordWaveform.swift` (modified, +50/-57)
```diff
@@ -69,90 +69,83 @@ struct RecordWaveformWithButtons: View {
 }
 
 struct RecordWaveformPlaying: View {
+    @Environment(\.chatSize) private var chatSize
+
     var samples: [CGFloat] // 0...1
     var progress: CGFloat
     var color: Color
     var addExtraDots: Bool
-    var maxLength: CGFloat = 0.0
 
     let progressChangeHandler: (CGFloat) -> Void
 
     @State private var offset: CGSize = .zero
-
-    private var adjustedSamples: [CGFloat] = []
-    
-    init(samples: [CGFloat],
-         progress: CGFloat,
-         color: Color,
-         addExtraDots: Bool,
-         progressChangeHandler: @escaping (CGFloat) -> Void) {
-        self.samples = samples
-        self.progress = progress
-        self.color = color
-        self.addExtraDots = addExtraDots
-        self.progressChangeHandler = progressChangeHandler
-        self.adjustedSamples = adjustedSamples(UIScreen.main.bounds.width)
-        self.maxLength = max((RecordWaveform.spacing + RecordWaveform.width) * CGFloat(self.adjustedSamples.count) - RecordWaveform.spacing, 0)
-    }
+    @State private var recordingMaxLen: CGFloat = 0
 
     var body: some View {
-        GeometryReader { g in
-            ZStack {
-                let adjusted = addExtraDots ? adjustedSamples(g.size.width) : adjustedSamples
-                RecordWaveform(samples: adjusted, addExtraDots: addExtraDots)
-                    .foregroundColor(color.opacity(0.4))
-                RecordWaveform(samples: adjusted, addExtraDots: addExtraDots)
-                    .foregroundColor(color)
-                    .mask(alignment: .leading) {
-                        Rectangle()
-                            .frame(width: maxLength * progress, height: 2*RecordWaveform.maxSampleHeight)
+        if addExtraDots {
+            GeometryReader { g in
+                let adjusted = adjustedSamples(g.size.width)
+                let maxLen = computeMaxLength(adjusted)
+                waveformZStack(adjusted: adjusted, maxLen: maxLen)
+                    .onAppear { recordingMaxLen = maxLen }
+                    .onChange(of: g.size.width) { _, newWidth in
+                        let adj = adjustedSamples(newWidth)
+                        recordingMaxLen = computeMaxLength(adj)
                     }
             }
             .frame(height: RecordWaveform.maxSampleHeight)
-            
+            .frame(maxWidth: .infinity)
+            .gesture(dragGesture(maxLen: recordingMaxLen))
+        } else {
+            let adjusted = adjustedSamples(chatSize.width)
+            let maxLen = computeMaxLength(adjusted)
+            waveformZStack(adjusted: adjusted, maxLen: maxLen)
+                .frame(height: RecordWaveform.maxSampleHeight)
+                .frame(width: maxLen)
+                .fixedSize(horizontal: true, vertical: true)
+                .gesture(dragGesture(maxLen: maxLen))
         }
-        .frame(height: RecordWaveform.maxSampleHeight)
-        .applyIf(!addExtraDots) {
-            $0.frame(width: maxLength)
+    }
+
+    @ViewBuilder
+    private func waveformZStack(adjusted: [CGFloat], maxLen: CGFloat) -> some View {
+        ZStack {
+            RecordWaveform(samples: adjusted, addExtraDots: addExtraDots)
+                .foregroundColor(color.opacity(0.4))
+            RecordWaveform(samples: adjusted, addExtraDots: addExtraDots)
+                .foregroundColor(color)
+                .mask(alignment: .leading) {
+                    Rectangle()
+                        .frame(width: maxLen * progress, height: 2 * RecordWaveform.maxSampleHeight)
+                }
         }
-        .frame(maxWidth: addExtraDots ? .infinity : maxLength)
-        .fixedSize(horizontal: !addExtraDots, vertical: true)
-        .gesture(addDragGesture)
+        .frame(height: RecordWaveform.maxSampleHeight)
     }
 
-    private var addDragGesture: some Gesture {
+    private func dragGesture(maxLen: CGFloat) -> some Gesture {
         DragGesture()
-            .onChanged { value in
-                offset = value.translation
-            }
+            .onChanged { value in offset = value.translation }
             .onEnded { _ in
-                let currentPosition = maxLength * progress
+                guard maxLen > 0 else { return }
+                let current = maxLen * progress
                 // multiply by 0.5 so that the sliding will not be too sensitive
-                var newPosition: CGFloat = currentPosition + offset.width * 0.5
-                if offset.width > 0 {
-                    newPosition = min(newPosition, maxLength)
-                } else {
-                    newPosition = max(newPosition, 0)
-                }
-                let newProgress = newPosition / maxLength
-                progressChangeHandler(newProgress)
+                var newPos = current + offset.width * 0.5
+                newPos = offset.width > 0 ? min(newPos, maxLen) : max(newPos, 0)
+                progressChangeHandler(newPos / maxLen)
            
```

#### Recent Merged Pull Requests:
- **PR #305** (2026-10-01): Small fix (@lissine0)
- **PR #303** (2026-09-22): Divided location into staticLocation and liveLocation (@Shonchik)
- **PR #302** (2026-09-19): Fix Xcode 27 linker crash by co-locating ChatView's init with its @State properties (@nezhyborets)
- **PR #297** (2026-09-15): A small theme fix (@lissine0)
- **PR #294** (closed): Add imageCache to CachedAsyncImage (@Shonchik)
- **PR #292** (2026-08-14): Fix crash when scrolling to oldest message on an empty table (@fayharinn)
- **PR #290** (2026-09-07): Add document and location attachments (@Shonchik)
- **PR #289** (2026-07-27): Fix inputView wasn't being cleared (@Shonchik)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
