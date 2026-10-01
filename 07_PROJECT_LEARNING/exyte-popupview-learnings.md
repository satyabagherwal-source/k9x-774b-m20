# Forensic Learning Record (Deep Inspection): exyte/PopupView

> **Canonical Artifact**: `07_PROJECT_LEARNING/exyte-popupview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/exyte/PopupView](https://github.com/exyte/PopupView))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T01:51:22.016Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `exyte/PopupView`
- **Description**: Toasts and popups library written with SwiftUI
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4060 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/PopupView/PopupView.h`
```
//
//  PopupView.h
//  PopupView
//
//  Created by Alisa Mylnikova on 23/04/2020.
//  Copyright © 2020 Exyte. All rights reserved.
//

#import <Foundation/Foundation.h>

//! Project version number for PopupView.
FOUNDATION_EXPORT double PopupViewVersionNumber;

//! Project version string for PopupView.
FOUNDATION_EXPORT const unsigned char PopupViewVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <PopupView/PublicHeader.h>



```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #299** (2026-09-22): **Fix macOS popup drag dismissal state**
  *Symptoms*: - Prevent the popup from bouncing before closing when dismissed by dragging. - Clear stale drag offsets after the dismissal animation completes. - Reset presentation state when reopening a popup. - Fix an issue where reopening a popup could show only the background blur while the content remained off-screen.
  **Post-Mortem & Fix Analysis**:
  > Hey @Corotata, thank you for the PR, have a wonderful day!

- **Issue #298** (2026-07-30): **The new version fails to compile on macOS**
  *Symptoms*:   <img width="923" height="817" alt="Image" src="https://github.com/user-attachments/assets/362d1a88-75a4-4a21-a6c1-d70d495511de" />
  **Post-Mortem & Fix Analysis**:
  > Hey @lexrus, please check out version 5.0.5, have a great day!

- **Issue #297** (2026-07-29): **Add becomesKeyWindow option to avoid stealing keyboard from presenting .window mode**
  *Symptoms*: ## Bug: `.displayMode(.window)` steals keyboard focus from the presenting screen  ### Problem  https://github.com/user-attachments/assets/974d0c9d-6619-4678-9169-813573925c51   When a popup is shown with `.displayMode(.window)` while a text field is focused on the screen behind it, the keyboard is dismissed as soon as the popup appears, and then reappears once the popup is dismissed.  This is especially noticeable for transient, non-interactive popups like toasts/snackbars — showing a toast while the user is typing in a text field causes the keyboard to flicker (hide → show), which is a jarring UX regression and breaks scenarios like "show a validation toast while the user keeps typing".  Related reports of the same underlying `UIWindow`/key-window behavior with `UIAlertController`: - https://stackoverflow.com/questions/28564710/keep-keyboard-on-when-uialertcontroller-is-presented-in-swift - https://www.reddit.com/r/iOSProgramming/comments/8yeeol/is-there-a-way-to-prevent-the-keyboard-from-being/  ### Root cause  `WindowManager.showInNewWindow(...)` unconditionally calls:  ```swift window.makeKeyAndVisible() ```  `makeKeyAndVisible()` always transfers key-window (and, with it, first-responder / keyboard) status to the new window — even when the popup itself has no interactive content and never needs to become key. Since the previous key window loses that status, whatever text field was focused there loses first responder, and the keyboard is dismissed. 
  **Post-Mortem & Fix Analysis**:
  > when apply fix you see it's work correctly    https://github.com/user-attachments/assets/ee77373e-7c0a-49ac-9dd5-71825158671e   
  > Hey @dmtrbbrv, thank you so much for this fix and the explanation! Have an amazing day!

- **Issue #296** (2026-07-15): **macos == > UIKit-- UIEdgeInsets**
  *Symptoms*:     macos == > UIKit-- UIEdgeInsets ` static var safeAreaInsets: UIEdgeInsets { #if os(iOS) || os(tvOS)         UIApplication.shared             .connectedScenes             .compactMap { $0 as? UIWindowScene }             .first?             .keyWindow?             .safeAreaInsets ?? .zero #else         return .zero #endif`
  **Post-Mortem & Fix Analysis**:
  > Sorry, I didn't get this. Please explain more, have a nice day
  > macOS using AppKit ; code written with UIKit will fail to compile on macOS.
  > Check out 5.0.3

- **Issue #295** (2026-06-16): **Cannot find 'popupViewBackground' in scope**
  *Symptoms*: **Environment** - PopupView: 5.0.0 and 5.0.1 (both affected) - Xcode: 26.5 (Build 17F42) - Swift: 6.3.2 - Platform: iOS  **Error** Build fails with:    PopupModifier.swift:242:13: Cannot find 'popupViewBackground' in scope  **Root cause** `popupViewBackground()` is called twice in `Sources/PopupView/PopupModifier.swift`  (lines 230 and 242) but no function with that name is defined anywhere in the package:    grep -rn "func popupViewBackground" Sources/   → no results  The function appears to have been removed or renamed during the 5.x rewrite  without updating the call sites in `PopupModifier.swift`.  **Workaround** Pinning to 4.2.2 (the last working 4.x release) unblocks the build. The 4.x API is source-compatible for basic `.popup` usage.
  **Post-Mortem & Fix Analysis**:
  > Hey @GheberEl, I only found this problem inside #elseif os(macOS) || os(tvOS), it compiles normally on ios for me. Please let me know if it's still an issue for you on ios, have a nice day

- **Issue #294** (2026-06-16): **Update AuthWebViewController to avoid UIScreen.main on iOS 26**
  *Symptoms*: ### Description  Apple's WWDC26 session “Modernize your UIKit app” recommends avoiding global main-screen references. In scene-based apps, especially with iPhone Mirroring, external displays, and multi-window setups, `UIScreen.main` may not represent the display where current UI is running.  `PopupView/Sources/Utils.swift` currently uses `UIScreen.main` on line 23. Please update this usage to follow scene-based UIKit geometry guidance.  ### Reference  Apple WWDC26: “Modernize your UIKit app”   https://developer.apple.com/videos/play/wwdc2026/278/
  **Post-Mortem & Fix Analysis**:
  > Hey @OliverChoi-iOS, updated to use UIApplication.shared.connectedScenes, hope this is what you meant, have a nice day

- **Issue #293** (2026-06-04): **dragToDismiss and scrollView conflict in Popup Middle**
  *Symptoms*: Hello creators of the best Popup library!  When I have a ScrollView in the Middle Screen Popup on the iPad with a .dragToDismiss(true) - there is a conflict. A video shows it better:  https://github.com/user-attachments/assets/9134bdff-dc07-4e8a-9117-5d77ce90c8c6  Here is the basic code: ```Swift .popup(isPresented: $popups.showingMiddle) { 	MyPopupMiddle() } customize: { 	$0 		.closeOnTap(false) 		.backgroundColor(.black.opacity(0.4)) } ``` I've used Form here for prettiness, but a basic ScrollView behaves the same. ```Swift struct MyPopupMiddle: View {     var body: some View {         Form {             Section {                 Text("""                     In the kingdom of Swift, where the view trees grow,                     And constraints throw tantrums developers know,                     There lived a fine library, clever and spry,                     Called PopupView, floating gracefully by.                                          Forged by Exyte’s engineers with precision and flair,                     It summoned popups from seemingly nowhere.                     From the bottom, the center, the top with delight,                     Appearing so smoothly, it felt almost right.                                          No wrestling with UIKit deep in the night,                     No mysterious offsets refusing to bite.                     Just a modifier here and a closure or two,                     And a popup emerged like morning dew!                          
  **Post-Mortem & Fix Analysis**:
  > Hey @BredBurr, thank you for your kind words! I added position to scroll popup modifier params, so please use like this  ``` .scrollPopup(isPresented: $show) {     MyPopupMiddle() } header: {     // if needed, or remove this closure } customize: {     $0         .position(.center(200))         .dragToDismiss(dragToDismiss) } ```  Generally speaking, there is no way for the lib to avoid this pan gestures conflict. If you add your own scroll and set .dragToDismiss to true, there will be 2 pan gestures. scrollPopup adds the scroll for you, so the lib can control it somewhat, and check if it needs to actually add dragToDismiss, or just reuse scroll's pan.  scrollPopup is usually auto-sizing its scrollView to fit as much content as possible, so for your case i added padding parameter - to restrict scroll's size. please check it out, and let me know if this works for you, have a great day!
  > Understandable, have a great day ✌️

- **Issue #292** (2026-06-08): **Updating from 4.1.19 disables touch events in the background of a popup**
  *Symptoms*: See the attached sample project. Works as-is using 4.1.19.  Updating the PopupView dependency to >= 4.1.20 and uncommenting line 23 in `ContentView.swift` breaks the scrolling of the List view.  [PopupViewTest.zip](https://github.com/user-attachments/files/27634496/PopupViewTest.zip)
  **Post-Mortem & Fix Analysis**:
  > Hey @gereons, could you please try version 4.2.2, it should fix background taps, have a great day!
  > Unfortunately this does not work, I still get no scrolling when updating to 4.2.2.
  > got it, I will give it a look, as soon as I have time

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

### Incident Patch 1: `e053f506` (2026-09-23)
**Commit Message**: Fix drag to hide animation after lifting a finger

**File**: `Sources/PopupView/PopupBody.swift` (modified, +17/-2)
```diff
@@ -259,7 +259,11 @@ struct PopupBody<PopupContent: View>: View {
                     timeToHide: $timeToHide,
                     params: params,
                     appearFrom: calculatedAppearFrom,
-                    shouldDismiss: { dismissCallback(.drag) }
+                    shouldDismiss: {
+                        consolidateDragOffset(dragToDismissManager.dragTranslation)
+                        dragToDismissManager.resetDragTranslation()
+                        dismissCallback(.drag)
+                    }
                 )
             }
 
@@ -277,6 +281,14 @@ struct PopupBody<PopupContent: View>: View {
         }
     }
 
+    /// Bakes a live drag offset into `actualCurrentOffset` so a subsequent hide animation
+    /// covers only the remaining distance instead of restarting from the displayed position
+    /// on top of the still-applied drag offset.
+    private func consolidateDragOffset(_ translation: CGSize) {
+        actualCurrentOffset.x += translation.width
+        actualCurrentOffset.y += translation.height
+    }
+
     /// This is the builder for the sheet content
     @ViewBuilder
     func bodyWithGestures() -> some View {
@@ -288,7 +300,10 @@ struct PopupBody<PopupContent: View>: View {
                         dragToDismissManager: dragToDismissManager,
                         sheetContentRect: $sheetContentRect,
                         scrollParams: params,
-                        shouldDismiss: { dismissCallback(.drag) }
+                        shouldDismiss: { dragOffset in
+                            consolidateDragOffset(CGSize(width: 0, height: dragOffset))
+                            dismissCallback(.drag)
+                        }
                     ))
                 }
 #endif
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +4/-2)
```diff
@@ -330,8 +330,10 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
             params.willDismissCallback(dismissSource ?? .binding)
             autohidingWorkHolder.work?.cancel()
             dismissibleInWorkHolder.work?.cancel()
-            shouldShowContent = false // this will cause currentOffset change thus triggering the sliding hiding animation
-            animatableOpacity = 0
+            withAnimation {
+                shouldShowContent = false // this will cause currentOffset change thus triggering the sliding hiding animation
+                animatableOpacity = 0
+            }
             // do the rest once the animation is finished (see onAnimationCompleted())
         }
 
```

**File**: `Sources/PopupView/Utils/ScrollPopupModifier.swift` (modified, +5/-2)
```diff
@@ -15,7 +15,7 @@ struct ScrollPopupModifier: ViewModifier {
     @ObservedObject var dragToDismissManager: DragToDismissHelper
     @Binding var sheetContentRect: CGRect
     var scrollParams: Popup.ScrollPopupParameters
-    var shouldDismiss: ()->()
+    var shouldDismiss: (CGFloat)->()
 
     @StateObject private var scrollViewDelegate = PopupScrollViewDelegate()
 
@@ -94,7 +94,10 @@ struct ScrollPopupModifier: ViewModifier {
         let referenceY = sheetContentRect.height / 3
         scrollViewDelegate.onDragEnded = { value in
             if scrollParams.dragToDismiss && value >= referenceY {
-                shouldDismiss()
+                // consolidate the live drag offset into the shared hide animation so it only
+                // covers the remaining distance, instead of stacking on top of a full-length one
+                dragToDismissOffset = 0
+                shouldDismiss(value)
             } else {
                 withAnimation {
                     dragToDismissOffset = .zero
```

---

### Incident Patch 2: `693492f6` (2026-08-02)
**Commit Message**: Fix macOS popup drag dismissal state

- Prevent the popup from bouncing before closing when dismissed by dragging.
- Clear stale drag offsets after the dismissal animation completes.
- Reset presentation state when reopening a popup.
- Fix an issue where reopening a popup could show only the background blur while the content remained off-screen.

**File**: `Sources/PopupView/PopupBody.swift` (modified, +8/-0)
```diff
@@ -232,6 +232,14 @@ struct PopupBody<PopupContent: View>: View {
                 changeParamsWithAnimation(shouldShowContent)
             }
 
+            .onChange(of: showContent) {
+                // Keep the drag offset during the closing animation to avoid a
+                // visible bounce, then clear it after the popup is unloaded.
+                if !showContent {
+                    dragToDismissManager.resetDragTranslation()
+                }
+            }
+
             .onChange(of: keyboardHeightHelper.keyboardHeight) {
                 if shouldShowContent {
                     changeParamsWithAnimation(true)
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +8/-0)
```diff
@@ -115,6 +115,10 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
         if isBoolMode {
             main(content)
                 .onChange(of: isPresented) {
+                    // Mark the presentation transition synchronously before queuing
+                    // the animation work, preventing a drag dismissal from being
+                    // mistaken for a second presentation during layout updates.
+                    closingIsInProcess = !isPresented
                     eventsQueue.async { [eventsSemaphore] in
                         eventsSemaphore.wait()
                         DispatchQueue.main.async {
@@ -314,6 +318,10 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
     func appearAction(popupPresented: Bool) {
         if popupPresented {
             dismissSource = nil
+            // Popup content is reused on macOS. Clear the previous dismissal state
+            // so the next presentation measures and positions its content again.
+            closingIsInProcess = false
+            sheetContentRect = .zero
             showSheet = true // show transparent fullscreen sheet
             showContent = true // immediately load popup body
             // shouldShowContent is set after popup's frame is calculated, see .onChange(of: sheetContentRect)
```

**File**: `Sources/PopupView/Utils/DragToDismissHelper.swift` (modified, +5/-0)
```diff
@@ -60,6 +60,11 @@ class DragToDismissHelper: ObservableObject {
         self.shouldDismiss = shouldDismiss
     }
 
+    /// Clears the drag offset left by a completed drag dismissal.
+    func resetDragTranslation() {
+        dragTranslation = .zero
+    }
+
     func limitToDismissDirection(_ translation: CGSize) -> CGSize {
         switch appearFrom {
         case .topSlide:
```

---

### Incident Patch 3: `62e16981` (2026-07-30)
**Commit Message**: Fix macos

**File**: `Sources/PopupView/Utils/ScrollViewResolver.swift` (modified, +2/-0)
```diff
@@ -7,6 +7,7 @@
 
 import SwiftUI
 
+#if os(iOS)
 struct ScrollViewResolver: UIViewRepresentable {
     var onResolve: (UIScrollView) -> Void
 
@@ -35,3 +36,4 @@ extension UIView {
         return nil
     }
 }
+#endif
```

---

### Incident Patch 4: `fdb56609` (2026-07-29)
**Commit Message**: Merge pull request #297 from dmtrbbrv/fix/window-becomes-key-steals-keyboard

Add becomesKeyWindow option to avoid stealing keyboard from presenting .window mode

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +1/-0)
```diff
@@ -207,6 +207,7 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
                             id: id,
                             closeOnTapOutside: params.closeOnTapOutside,
                             allowTapThroughBG: params.allowTapThroughBG,
+                            becomesKeyWindow: params.becomesKeyWindow,
                             dismissClosure: {
                                 dismissSource = .binding
                                 isPresented = false
```

**File**: `Sources/PopupView/PublicAPI.swift` (modified, +14/-0)
```diff
@@ -169,6 +169,14 @@ public class Popup {
         /// move up for keyboardHeight when it is displayed
         var useKeyboardSafeArea: Bool = false
 
+        /// Only relevant for `displayMode == .window`.
+        /// Whether the popup's own `UIWindow` should become the key window when shown.
+        /// Default is `true` (previous behavior, needed e.g. for popups hosting a focusable
+        /// text input). Set to `false` for transient, non-interactive popups (toasts/snackbars)
+        /// so presenting them doesn't steal key window / first responder status - and with it
+        /// the keyboard - from whatever window/text field was focused before the popup appeared.
+        var becomesKeyWindow: Bool = true
+
         /// called when when dismiss animation starts
         var willDismissCallback: (DismissSource) -> () = {_ in}
 
@@ -249,6 +257,12 @@ public class Popup {
             return self
         }
 
+        /// Only relevant for `displayMode == .window`. See `becomesKeyWindow` doc above.
+        public func becomesKeyWindow(_ becomesKeyWindow: Bool) -> Self {
+            self.becomesKeyWindow = becomesKeyWindow
+            return self
+        }
+
         // MARK: - dismiss callbacks
 
         public func willDismissCallback(_ dismissCallback: @escaping (DismissSource) -> ()) -> Self {
```

**File**: `Sources/PopupView/Utils/WindowManager.swift` (modified, +23/-3)
```diff
@@ -41,6 +41,7 @@ final class WindowManager {
         id: UUID,
         closeOnTapOutside: Bool,
         allowTapThroughBG: Bool,
+        becomesKeyWindow: Bool = true,
         dismissClosure: @escaping SendableClosure,
         content: @escaping () -> Content
     ) {
@@ -53,6 +54,7 @@ final class WindowManager {
             windowScene: scene,
             closeOnTapOutside: closeOnTapOutside,
             isPassthrough: allowTapThroughBG,
+            canBecomeKey: becomesKeyWindow,
             dismissClosure: dismissClosure
         )
 
@@ -70,7 +72,16 @@ final class WindowManager {
         controller.view.backgroundColor = .clear
         window.rootViewController = controller
         window.windowLevel = .alert + 1
-        window.makeKeyAndVisible()
+
+        // `makeKeyAndVisible()` transfers key window (and first responder / keyboard) status
+        // away from whatever window currently holds it. For transient, non-interactive popups
+        // (toasts) this steals the keyboard from a focused text field in the presenting window.
+        // Only become key when the popup actually needs it (e.g. it hosts its own text input).
+        if becomesKeyWindow {
+            window.makeKeyAndVisible()
+        } else {
+            window.isHidden = false
+        }
 
         // Store window and controller reference
         shared.entries[id] = Entry(window: window, controller: controller)
@@ -100,10 +111,15 @@ class UIPassthroughWindow: UIWindow {
     var closeOnTapOutside: Bool
     var isPassthrough: Bool
     var dismissClosure: SendableClosure?
-    
-    init(windowScene: UIWindowScene, closeOnTapOutside: Bool, isPassthrough: Bool, dismissClosure: SendableClosure?) {
+    /// When `false`, this window will never become the key window (see `makeKeyAndVisible`
+    /// usage in `WindowManager`), so it can't steal first responder / keyboard status from
+    /// whatever window currently has it.
+    private let allowsBecomingKey: Bool
+
+    init(windowScene: UIWindowScene, closeOnTapOutside: Bool, isPassthrough: Bool, canBecomeKey: Bool = true, dismissClosure: SendableClosure?) {
         self.closeOnTapOutside = closeOnTapOutside
         self.isPassthrough = isPassthrough
+        self.allowsBecomingKey = canBecomeKey
         self.dismissClosure = dismissClosure
         super.init(windowScene: windowScene)
     }
@@ -112,6 +128,10 @@ class UIPassthroughWindow: UIWindow {
         fatalError("init(coder:) has not been implemented")
     }
 
+    override var canBecomeKey: Bool {
+        allowsBecomingKey
+    }
+
     override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
         guard let vc = rootViewController else {
             return nil
```

---

### Incident Patch 5: `6b4ab760` (2026-07-15)
**Commit Message**: Fix macos

**File**: `PopupExample/PopupExample/BGTapsExamplesView.swift` (modified, +1/-5)
```diff
@@ -91,10 +91,6 @@ struct BGTapsExamplePopup: View {
     var closeOnTapOutside: Bool
     var allowTapThroughBG: Bool
 
-    private var screenWidth: CGFloat {
-        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.width ?? 390
-    }
-
     var body: some View {
         VStack(spacing: 12) {
             VStack {
@@ -123,7 +119,7 @@ struct BGTapsExamplePopup: View {
         }
         .padding(EdgeInsets(top: 37, leading: 24, bottom: 40, trailing: 24))
         .background(Color.white.cornerRadius(20))
-        .frame(width: screenWidth - 120)
+        .frame(width: ScreenUtils.width - 120)
         .shadowedStyle()
     }
 }
```

**File**: `PopupExample/PopupExample/PopupExampleApp.swift` (modified, +7/-6)
```diff
@@ -13,6 +13,7 @@ struct PopupExampleApp: App {
 
     var body: some Scene {
         WindowGroup {
+#if os(iOS)
             NavigationView {
                 List {
                     Section {
@@ -24,24 +25,24 @@ struct PopupExampleApp: App {
                             PositionExamplesView()
                         }
 
-                        NavigationLink("Scroll examples") {
-                            ScrollExamplesView()
-                        }
-
                         NavigationLink("BG taps examples") {
                             BGTapsExamplesView()
                         }
+                        NavigationLink("Scroll examples") {
+                            ScrollExamplesView()
+                        }
 
-#if os(iOS)
                         NavigationLink("Misc examples") {
                             MiscExamplesView()
                         }
-#endif
                     }
                 }
                 .navigationTitle("Popup examples")
                 .navigationBarTitleDisplayMode(.inline)
             }
+#else
+            GithubExampleView()
+#endif
         }
     }
 }
```

**File**: `PopupExample/PopupExample/ScrollExamplesView.swift` (modified, +2/-0)
```diff
@@ -7,6 +7,7 @@
 
 import SwiftUI
 
+#if os(iOS)
 struct ScrollExamplesView: View {
 
     private let values = [false, true]
@@ -98,3 +99,4 @@ struct ScrollExamplePopup: View {
         .background(.white)
     }
 }
+#endif
```

**File**: `PopupExample/PopupExample/Utils/Utils.swift` (modified, +25/-0)
```diff
@@ -7,6 +7,31 @@
 
 import SwiftUI
 
+@MainActor
+struct ScreenUtils {
+    static var bounds: CGRect {
+#if os(watchOS)
+        return WKInterfaceDevice.current().screenBounds
+#elseif os(macOS)
+        return NSApplication.shared.keyWindow?.frame
+        ?? NSScreen.main?.frame
+        ?? .zero
+#else
+        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
+        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
+        return scene?.screen.bounds ?? .zero
+#endif
+    }
+
+    static var width: CGFloat {
+        bounds.width
+    }
+
+    static var height: CGFloat {
+        bounds.height
+    }
+}
+
 extension Color {
     init(hex: String) {
         let scanner = Scanner(string: hex)
```

**File**: `PopupExample/PopupWatchExample Watch App/ContentView.swift` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@
 import SwiftUI
 import PopupView
 
-struct ExampleButton : View {
+struct ExampleButton: View {
 
     @Binding var showing: Bool
     var title: String
@@ -27,7 +27,7 @@ struct ExampleButton : View {
     }
 }
 
-struct ContentView : View {
+struct ContentView: View {
 
     let bgColor = Color(hex: "e0fbfc")
     let popupColor = Color(hex: "3d5a80")
```

---

### Incident Patch 6: `e56e8961` (2026-06-16)
**Commit Message**: Fix for non-ios platforms

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +2/-2)
```diff
@@ -227,7 +227,7 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
             presenterContent
                 .disabled(showContent)
 
-            popupViewBackground()
+            popupWithBackground()
         }
         .onExitCommand {
             dismissSource = .exitCommand
@@ -239,7 +239,7 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
             presenterContent
                 .disabled(showContent)
 
-            popupViewBackground()
+            popupWithBackground()
         }
 #endif
     }
```

**File**: `Sources/PopupView/Utils/Utils.swift` (modified, +5/-1)
```diff
@@ -20,7 +20,11 @@ struct ScreenUtils {
         ?? NSScreen.main?.frame
         ?? .zero
 #else
-        return UIScreen.main.bounds
+        let scene = UIApplication.shared.connectedScenes
+            .first { $0.activationState == .foregroundActive } as? UIWindowScene
+        return scene?.screen.bounds
+        ?? UIScreen.main.bounds
+        ?? .zero
 #endif
     }
 
```

---

### Incident Patch 7: `752a966f` (2026-05-29)
**Commit Message**: Fix customizer for scroll popup

**File**: `PopupExample/PopupExample/PopupExampleApp.swift` (modified, +0/-36)
```diff
@@ -10,8 +10,6 @@ import PopupView
 
 @main
 struct PopupExampleApp: App {
-    @State private var a: EdgeInsets = EdgeInsets()
-    @State private var b: EdgeInsets = EdgeInsets()
 
     var body: some Scene {
         WindowGroup {
@@ -20,18 +18,10 @@ struct PopupExampleApp: App {
                     Section {
                         NavigationLink("Github example") {
                             GithubExampleView()
-                                .safeAreaGetter($a)
-                                .onChange(of: a) {
-                                    print("a", a)
-                                }
                         }
 
                         NavigationLink("Position examples") {
                             PositionExamplesView()
-                                .safeAreaGetter($b)
-                                .onChange(of: b) {
-                                    print("b", b)
-                                }
                         }
 
                         NavigationLink("BG taps examples") {
@@ -51,29 +41,3 @@ struct PopupExampleApp: App {
         }
     }
 }
-struct SafeAreaGetter: ViewModifier {
-
-    @Binding var safeArea: EdgeInsets
-
-    func body(content: Content) -> some View {
-        content
-            .background(
-                GeometryReader { proxy -> AnyView in
-                    DispatchQueue.main.async {
-                        let area = proxy.safeAreaInsets
-                        // This avoids an infinite layout loop
-                        if area != self.safeArea {
-                            self.safeArea = area
-                        }
-                    }
-                    return AnyView(EmptyView())
-                }
-            )
-    }
-}
-
-extension View {
-    public func safeAreaGetter(_ safeArea: Binding<EdgeInsets>) -> some View {
-        modifier(SafeAreaGetter(safeArea: safeArea))
-    }
-}
```

**File**: `Sources/PopupView/PopupBody.swift` (modified, +3/-3)
```diff
@@ -35,9 +35,6 @@ struct PopupBody<PopupContent: View>: View {
 
     // MARK: - Public Properties
 
-    @Binding var isDragging: Bool
-    @Binding var timeToHide: Bool
-
     /// Trigger popup showing/hiding animations and...
     @Binding var shouldShowContent: Bool
     /// ... once hiding animation is finished remove popup from the memory using this flag
@@ -47,6 +44,9 @@ struct PopupBody<PopupContent: View>: View {
     @Binding var presenterContentRect: CGRect
     @Binding var sheetContentRect: CGRect
 
+    @Binding var isDragging: Bool
+    @Binding var timeToHide: Bool
+
     var params: Popup.BasePopupParameters
 
     var popupBodyBuilder: () -> PopupContent
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +2/-2)
```diff
@@ -267,12 +267,12 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
         }
 
         PopupBody(
-            isDragging: $isDragging,
-            timeToHide: $timeToHide,
             shouldShowContent: $shouldShowContent,
             showContent: $showContent,
             presenterContentRect: $presenterContentRect,
             sheetContentRect: $sheetContentRect,
+            isDragging: $isDragging,
+            timeToHide: $timeToHide,
             params: params,
             popupBodyBuilder: viewForItem != nil ? viewForItem! : view,
             dismissCallback: { source in
```

**File**: `Sources/PopupView/PublicModifiers.swift` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ extension View {
         header: @escaping () -> any View = { EmptyView() },
         customize: @escaping (Popup.ScrollPopupParameters) -> Popup.ScrollPopupParameters = { $0 }
     ) -> some View {
-        let params = Popup.ScrollPopupParameters().headerView(header)
+        let params = customize(Popup.ScrollPopupParameters()).headerView(header)
 
         return self.modifier(
             PopupModifier<Int, PopupContent>(
@@ -85,7 +85,7 @@ extension View {
         header: @escaping () -> any View = { EmptyView() },
         customize: @escaping (Popup.ScrollPopupParameters) -> Popup.ScrollPopupParameters = { $0 }
     ) -> some View {
-        let params = Popup.ScrollPopupParameters().headerView(header)
+        let params = customize(Popup.ScrollPopupParameters()).headerView(header)
 
         return self.modifier(
             PopupModifier<Item, PopupContent>(
```

---

### Incident Patch 8: `afe7490c` (2026-05-22)
**Commit Message**: Fix closeOnTap/allowTapThrough for .window popups

**File**: `Sources/PopupView/PopupBody.swift` (modified, +5/-0)
```diff
@@ -252,6 +252,11 @@ struct PopupBody<PopupContent: View>: View {
 
     var body: some View {
         bodyWithGestures()
+            .background {
+                if params.displayMode == .window {
+                    PopupHitRegion() // apply here, because offset doesn't actually change popup's position, effectively breaking expected behaviour
+                }
+            }
             .scaleEffect(actualScale)
             .offset(x: actualCurrentOffset.x, y: actualCurrentOffset.y)
 
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +3/-0)
```diff
@@ -291,6 +291,9 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
     func popupViewBackground() -> some View {
         ZStack {
             popupBackground()
+            if params.displayMode == .window {
+                BGHitRegion()
+            }
             popupBody()
                 .frameGetter($sheetContentRect)
         }
```

**File**: `Sources/PopupView/WindowManager.swift` (modified, +53/-32)
```diff
@@ -10,7 +10,7 @@ import SwiftUI
 #if os(iOS)
 
 @MainActor
-public final class WindowManager {
+final class WindowManager {
     static let shared = WindowManager()
     private var entries: [UUID: Entry] = [:]
     
@@ -37,7 +37,7 @@ public final class WindowManager {
     }
 
     // Show a new window with hosted SwiftUI content
-    public static func showInNewWindow<Content: View>(
+    static func showInNewWindow<Content: View>(
         id: UUID,
         closeOnTapOutside: Bool,
         allowTapThroughBG: Bool,
@@ -59,9 +59,7 @@ public final class WindowManager {
         window.backgroundColor = .clear
 
         let rootView = content()
-            .environment(\.popupDismiss) {
-                dismissClosure()
-            }
+            .environment(\.popupDismiss, dismissClosure)
 
         let controller = if #available(iOS 18, *) {
             UIHostingController(rootView: rootView)
@@ -78,7 +76,7 @@ public final class WindowManager {
         shared.entries[id] = Entry(window: window, controller: controller)
     }
 
-    public static func updateRootView<Content: View>(
+    static func updateRootView<Content: View>(
         id: UUID,
         dismissClosure: @escaping () -> (),
         content: @escaping () -> Content
@@ -115,42 +113,65 @@ class UIPassthroughWindow: UIWindow {
     }
 
     override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
-        guard let vc = self.rootViewController else {
-            return nil // pass to next window
+        guard let vc = rootViewController else {
+            return nil
         }
-
         vc.view.layoutIfNeeded() // otherwise the frame is as if the popup is still outside the screen
 
-        let layerHitTestResult = vc.view.layer.hitTest(vc.view.convert(point, from: self))
-        let superlayerDelegateName = layerHitTestResult?.superlayer?.delegate.map { String(describing: type(of: $0)) }
-        let didTapBackground = superlayerDelegateName?.contains(String(describing: PopupHitTestingBackground.self)) ?? false
-
-        if didTapBackground {
-            if closeOnTapOutside {
-                dismissClosure?()
+        for subview in vc.view.subviews {
+            //print("rrr \(classNameContains(subview, "PopupHitRegion") ? "PopupHitRegion" : "BGHitRegion") \(subview.frame.contains(point))")
+            if classNameContains(subview, "PopupHitRegion"),
+               subview.frame.contains(point) {
+                return vc.view // let UIKit pass this touch to wrapped SwiftUI view in regular manner
             }
-            
-            if isPassthrough {
-                return nil // pass to next window
-            }
-            return vc.view
         }
-        
-        // pass tap to this
-        let farthestDescendent = super.hitTest(point, with: event)
-        return farthestDescendent
-    }
 
-    private func isTouchInsideSubview(point: CGPoint, vc: UIView) -> UIView? {
-        for subview in vc.subviews {
-            if subview.frame.contains(point) {
-                return subview
-            }
+        // here we know the tap was outside the actual popup's body, meaning the background was tapped
+
+        if closeOnTapOutside {
+            dismissClosure?()
         }
-        return nil
+
+        if isPassthrough {
+            return nil // pass to next window
+        }
+        return vc.view
+    }
+
+    private func classNameContains(_ view: UIView, _ string: String) -> Bool {
+        String(describing: view.self).contains(string)
     }
 }
 
+final class BGHitRegionView: UIView {
+    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
+        true
+    }
+}
+
+struct BGHitRegion: UIViewRepresentable {
+    func makeUIView(context: Context) -> UIView {
+        BGHitRegionView()
+    }
+
+    func updateUIView(_ uiView: UIView, context: Context) {}
+}
+
+
+final class PopupHitRegionView: UIView {
+    override func point(inside point: CGPoint, with event: UIEvent
```

---

### Incident Patch 9: `74c070e9` (2026-05-12)
**Commit Message**: Merge pull request #290 from Shonchik/fix-scroll-header

Fix scroll headerView

**File**: `Package.resolved` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-{
-  "pins" : [
-    {
-      "identity" : "swiftui-introspect",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/siteline/swiftui-introspect",
-      "state" : {
-        "revision" : "a08b87f96b41055577721a6e397562b21ad52454",
-        "version" : "26.0.0"
-      }
-    }
-  ],
-  "version" : 2
-}
```

**File**: `Package.swift` (modified, +2/-6)
```diff
@@ -13,15 +13,11 @@ let package = Package(
     products: [
         .library(name: "PopupView", targets: ["PopupView"]),
     ],
-    dependencies: [
-        .package(url: "https://github.com/siteline/swiftui-introspect", "1.3.0"..<"27.0.0"),
-    ],
+    dependencies: [],
     targets: [
         .target(
             name: "PopupView",
-            dependencies: [
-                .product(name: "SwiftUIIntrospect", package: "swiftui-introspect"),
-            ],
+            dependencies: [],
             swiftSettings: [
               .enableExperimentalFeature("StrictConcurrency")
             ]
```

**File**: `PopupExample/PopupExample.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-{
-  "pins" : [
-    {
-      "identity" : "swiftui-introspect",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/siteline/swiftui-introspect",
-      "state" : {
-        "revision" : "807f73ce09a9b9723f12385e592b4e0aaebd3336",
-        "version" : "1.3.0"
-      }
-    }
-  ],
-  "version" : 2
-}
```

**File**: `PopupExample/PopupExample/ContentView.swift` (modified, +1/-1)
```diff
@@ -242,7 +242,7 @@ struct ContentView : View {
                 ActionSheetSecond()
             } customize: {
                 $0
-                    .type(.scroll(headerView: AnyView(scrollViewHeader())))
+                    .type(.scroll(headerView: scrollViewHeader()))
                     .position(.bottom)
                     .closeOnTap(false)
                     .closeOnTapOutside(true)
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -281,7 +281,8 @@ scroll parameters:
 `autohideIn` - time after which popup should disappear    
 `dismissibleIn(Double?, Binding<Bool>?)` - only allow dismiss after this time passes (forbids closeOnTap, closeOnTapOutside, and drag). Pass a boolean binding if you'd like to track current status     
 `dragToDismiss` - true by default: enable/disable drag to dismiss (upwards for .top popup types, downwards for .bottom and default type)    
-`closeOnTap` - true by default: enable/disable closing on tap on popup     
+`closeOnTap` - true by default: enable/disable closing on tap on popup. 
+NOTE: any gesture or control element you add to popup's body will override tap to close. in this case please close the popup manually if you need it to     
 `closeOnTapOutside` - false by default: enable/disable closing on tap on outside of popup     
 `allowTapThroughBG` - Should allow taps to pass "through" the popup's background down to views "below" it. `.sheet` popup is always allowTapThroughBG = false. False by default    
 `backgroundColor` - Color.clear by default: change background color of outside area     
```

---

### Incident Patch 10: `4b36a52b` (2026-05-05)
**Commit Message**: Fix closeOnTapOutside

**File**: `Sources/PopupView/FullscreenPopup.swift` (modified, +1/-0)
```diff
@@ -270,6 +270,7 @@ public struct FullscreenPopup<Item: Equatable, PopupContent: View>: ViewModifier
                 item: $item,
                 animatableOpacity: $animatableOpacity,
                 dismissSource: $dismissSource,
+                isWindowMode: params.displayMode == .window,
                 backgroundColor: backgroundColor,
                 backgroundView: backgroundView,
                 closeOnTapOutside: closeOnTapOutside,
```

**File**: `Sources/PopupView/PopupBackgroundView.swift` (modified, +37/-20)
```diff
@@ -18,6 +18,7 @@ struct PopupBackgroundView<Item: Equatable>: View {
     @Binding var animatableOpacity: CGFloat
     @Binding var dismissSource: DismissSource?
 
+    var isWindowMode: Bool
     var backgroundColor: Color
     var backgroundView: AnyView?
     var closeOnTapOutside: Bool
@@ -26,35 +27,51 @@ struct PopupBackgroundView<Item: Equatable>: View {
 
     var body: some View {
         ZStack {
-            Group {
-                if let backgroundView = backgroundView {
-                    backgroundView
-                } else {
-                    backgroundColor
-                }
-            }
-            .allowsHitTesting(!allowTapThroughBG)
-            .opacity(animatableOpacity)
-            .edgesIgnoringSafeArea(.all)
-            .animation(.linear(duration: 0.2), value: animatableOpacity)
 #if os(watchOS) || os(macOS)
-            .applyIf(closeOnTapOutside) { view in
-                view.contentShape(Rectangle())
-            }
-            .addTapIfNotTV(if: closeOnTapOutside) {
-                if dismissEnabled.wrappedValue {
-                    dismissSource = .tapOutside
-                    isPresented = false
-                    item = nil
+            contentView()
+                .applyIf(closeOnTapOutside) { view in
+                    view.contentShape(Rectangle())
+                }
+                .addTapIfNotTV(if: closeOnTapOutside) {
+                    if dismissEnabled.wrappedValue {
+                        dismissSource = .tapOutside
+                        isPresented = false
+                        item = nil
+                    }
+                }
+#else
+            contentView()
+                .applyIf(closeOnTapOutside && !isWindowMode) { view in
+                    view.contentShape(Rectangle())
+                }
+                .addTapIfNotTV(if: closeOnTapOutside && !isWindowMode) {
+                    if dismissEnabled.wrappedValue {
+                        dismissSource = .tapOutside
+                        isPresented = false
+                        item = nil
+                    }
                 }
-            }
 #endif
 #if !(os(watchOS) || os(macOS))
             PopupHitTestingBackground() // Hit testing workaround
                 .ignoresSafeArea()
 #endif
         }
     }
+
+    func contentView() -> some View {
+        Group {
+            if let backgroundView = backgroundView {
+                backgroundView
+            } else {
+                backgroundColor
+            }
+        }
+        .allowsHitTesting(!allowTapThroughBG)
+        .opacity(animatableOpacity)
+        .edgesIgnoringSafeArea(.all)
+        .animation(.linear(duration: 0.2), value: animatableOpacity)
+    }
 }
 
 #if !(os(watchOS) || os(macOS))
```

**File**: `Sources/PopupView/PopupView.swift` (modified, +1/-13)
```diff
@@ -392,7 +392,7 @@ public struct Popup<PopupContent: View>: ViewModifier {
         switch type {
         case .scroll(let headerView):
             VStack(spacing: 0) {
-                scrollHeaderView(view: headerView)
+                AnyView(headerView)
                     .fixedSize(horizontal: false, vertical: true)
                     .offset(dragOffset())
                     .simultaneousGesture(dragGesture)
@@ -420,18 +420,6 @@ public struct Popup<PopupContent: View>: ViewModifier {
 #endif
     }
 
-#if os(iOS)
-    @ViewBuilder
-    func scrollHeaderView(view: any View) -> some View {
-        ZStack {
-            Color.white
-                .mask(AnyView(view))
-
-            AnyView(view)
-        }
-    }
-#endif
-
 #if swift(>=5.9)
     /// This is the builder for the sheet content
     @ViewBuilder
```

#### Recent Merged Pull Requests:
- **PR #299** (2026-09-22): Fix macOS popup drag dismissal state (@Corotata)
- **PR #297** (2026-07-29): Add becomesKeyWindow option to avoid stealing keyboard from presenting .window mode (@dmtrbbrv)
- **PR #291** (2026-05-02): Fix .scroll popup shifting off-screen when keyboard appears (@pgovindaraj1)
- **PR #290** (2026-05-12): Fix scroll headerView (@Shonchik)
- **PR #288** (2026-04-22): Fix scroll (@Shonchik)
- **PR #287** (2026-04-15): Update examples, update allowTapThroughBG to false by default (@Shonchik)
- **PR #286** (2026-04-14): Fix macOS (@Shonchik)
- **PR #285** (2026-04-13): Fix watchOS (@Shonchik)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
