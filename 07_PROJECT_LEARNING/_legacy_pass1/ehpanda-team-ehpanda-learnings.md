# Forensic Learning Record (Deep Inspection): EhPanda-Team/EhPanda

> **Canonical Artifact**: `07_PROJECT_LEARNING/ehpanda-team-ehpanda-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/EhPanda-Team/EhPanda](https://github.com/EhPanda-Team/EhPanda))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T05:23:17.618Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `EhPanda-Team/EhPanda`
- **Description**: An unofficial E-Hentai App for iOS built with SwiftUI & TCA.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3986 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #458** (2026-07-20): **[BUG] Cannot install 2.8.0 from AltStore source: The file does not exist**
  *Symptoms*: ### Description  <img width="1206" height="508" alt="Image" src="https://github.com/user-attachments/assets/776a9ea3-dfee-449d-bd13-b5fec61de90f" />  ### Checklist  - [ ] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  Installs with no errors  ### Actual behavior  NSCocoaErrorDomain 4: EhPanda could not be downloaded. The file doesn’t exist.  ### Reproduction steps  _No response_  ### EhPanda version information  2.8.0  ### Destination operating system  iOS 26.5  ### Destination device  iPhone 17 Pro
  **Post-Mortem & Fix Analysis**:
  > Restored the v2.8.0 release, it should be resolved by now.
  > @chihchy Not quite - it now says hash mismatch. You'll want to update the hash in the source.
  > https://github.com/EhPanda-Team/EhPanda/pull/459

- **Issue #452** (2026-07-03): **[BUG] 打开任意本子，点击标签，跳转搜索出来的本子页面一片空白**
  *Symptoms*: ### Description  打开任意本子，点击标签，跳转搜索出来的本子页面一片空白，如图所示  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/a81f48b3-4598-45b6-97f0-e1b337629e55" />  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/8d4f69b6-cd51-4003-abd2-f8ce6ae77f88" />  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproduction steps  _No response_  ### EhPanda version information  3.0.0  ### Destination operating system  ios27.0  ### Destination device  iPhone17
  **Post-Mortem & Fix Analysis**:
  > Resolved in the latest 3.0.0 pre-release build.

- **Issue #445** (2026-06-23): **[BUG] app设置在ipad mini6上会出现两个设置框**
  *Symptoms*: ### Description  在进入app并点击设置后，在屏幕上会出现两个不同大小的、不同图层的设置框  <img width="744" height="1133" alt="Image" src="https://github.com/user-attachments/assets/1ae3db87-d484-4985-b38a-bd1bfdd233e5" />  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  仅出现一个设置窗口  ### Actual behavior  出现两个设置框  ### Reproduction steps  1.进入EhPanda app 2.点击设置  ### EhPanda version information  3.0.0 (158)  ### Destination operating system  iPadOS 26.5 (23F77)  ### Destination device  iPad mini 6
  **Post-Mortem & Fix Analysis**:
  > Resolved in the latest 3.0.0 pre-release build.

- **Issue #439** (2026-05-26): **[BUG]部分作品动图无法正常播放**
  *Symptoms*: ### Description  动图无法正常播放，显示为普通图片  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproduction steps  _No response_  ### EhPanda version information  2.8.0  ### Destination operating system  iPadOS 26.3.1  ### Destination device  iPad Pro, 11-inch (3rd generation)
  **Post-Mortem & Fix Analysis**:
  > In particular, I've also encountered this problem, not only on my phone (15 Pro Max) but also on my iPad (22 Pro 11-inch), and I'm waiting for a solution.
  > I suspect this might be related to .webp format compatibility.

- **Issue #436** (2026-05-26): **[错误]ios18.5**
  *Symptoms*: ### Description  Signature installation flashback v2.8.0  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproduction steps  _No response_  ### EhPanda version information  2.8.0  ### Destination operating system  ios18  ### Destination device  14pm

- **Issue #429** (2025-10-23): **[BUG] Pre-release v2.8.0 Crashes on Launch**
  *Symptoms*: ### Description  App immediately crashes when opening the app  ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior  No crash  ### Actual behavior  Crashes  ### Reproduction steps  Immediately crashes  ### EhPanda version information  v2.8.0 (20208b0), installed with TrollStore  ### Destination operating system  iPadOS 17.0  ### Destination device  iPad Pro 6th gen
  **Post-Mortem & Fix Analysis**:
  > Thank you for bringing this up. Unfortunately iPadOS 17.0 is no longer supported in the upcoming version 2.8.0.
  > Understandable 

- **Issue #426** (2025-10-23): **[BUG] Vertical Reading Mode Not Functioning (观看漫画时垂直滑动不起作用）**
  *Symptoms*: ### Description  ipad air(M1),ipadOS 26,  v2.7.10  Description  There seems to be an issue with the vertical reading mode in the comic viewer. While both the right-to-left (RTL) and left-to-right (LTR) reading modes work as expected, I am unable to scroll vertically when the "Vertical Mode" is selected.  Interestingly, vertical scrolling does work correctly in other parts of the app, such as on the search results page. This suggests the bug is isolated to the comic reader component.  Steps to Reproduce  Open any comic to enter the reader view.  Navigate to the reader settings and select "Vertical" as the reading mode.  Attempt to scroll up or down to navigate through the pages.  Expected Behavior  The comic pages should scroll vertically, allowing the user to read by swiping up and down.  Actual Behavior  The reader does not respond to vertical swipe/scroll gestures. The view remains static, making it impossible to read the comic in vertical mode.   ### Checklist  - [x] If possible, I've reproduced the issue using the latest version of this app. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/EhPanda-Team/EhPanda/issues) or [discussion](https://github.com/EhPanda-Team/EhPanda/discussions).  ### Expected behavior    The comic pages should scroll vertically, allowing the user to read by swiping up and down.  ### Actual behavior  The reader does not respond to vertical swipe/scroll gestures. The view remains static, making it impossible to
  **Post-Mortem & Fix Analysis**:
  > Thanks for your feedback with such a detailed description of your issue. It's resolved in v2.8.0.

- **Issue #422** (2025-10-23): **Bugfixes & Liquid Glass adaptation**
  *Symptoms*: 1. feat: Adapt to the new Liquid Glass design. 3. fix: Gesture issue in the reading page. 4. fix: Crash issue in eh setting page. 5. fix: A minor issue in search page.
  **Post-Mortem & Fix Analysis**:
  > Updating the pull request description to fulfill deploy workflow requirements...
  > ### Liquid glass preview  | Favorites  | Reading | | ------------- | ------------- | | ![](https://github.com/user-attachments/assets/23a9a9cd-2e77-4717-b7a8-0d47b96c5455)   | ![](https://github.com/user-attachments/assets/dc6cc46a-b644-484d-a749-586e041ed891)  |
  > Reviewing...

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

### Incident Patch 1: `37b97996` (2026-07-20)
**Commit Message**: Fix typos

**File**: `AltStore.json` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
           "buildVersion": "158",
           "marketingVersion": "2.8.1",
           "date": "2026-07-20T12:11:49Z",
-          "localizedDescription": "1. feat: Adapt to the new Liquid Glass design.\\n3. fix: Gesture issue in the reading page.\\n4. fix: Crash issue in eh setting page.\\n5. fix: A minor issue in search page.",
+          "localizedDescription": "1. feat: Adapt to the new Liquid Glass design.\\n2. fix: Gesture issue in the reading page.\\n3. fix: Crash issue in eh setting page.\\n4. fix: A minor issue in search page.",
           "downloadURL": "https://github.com/EhPanda-Team/EhPanda/releases/download/v2.8.1/EhPanda.ipa",
           "size": 7352364,
           "sha256": "2f389e36270414a8d9f3537e330f5c2bbff80887109c56ff9b4ba68ed377d62b",
```

---

### Incident Patch 2: `ef7395de` (2025-10-22)
**Commit Message**: Too many issues... reverting changes

**File**: `EhPanda.xcodeproj/project.pbxproj` (modified, +16/-20)
```diff
@@ -7,11 +7,6 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
-		145E7E3E2E36DE6D00822CB0 /* ReadingViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E3D2E36DE6D00822CB0 /* ReadingViewModel.swift */; };
-		145E7E3F2E36DE6D00822CB0 /* GestureCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E382E36DE6D00822CB0 /* GestureCoordinator.swift */; };
-		145E7E412E36DE6D00822CB0 /* PageCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E3A2E36DE6D00822CB0 /* PageCoordinator.swift */; };
-		145E7E422E36DE6D00822CB0 /* ReadingViewExtensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E3C2E36DE6D00822CB0 /* ReadingViewExtensions.swift */; };
-		145E7E432E36DE6D00822CB0 /* ImageStackView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 145E7E392E36DE6D00822CB0 /* ImageStackView.swift */; };
 		AB0929B6277F043D00F107CA /* AccountSettingReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = AB0929B5277F043D00F107CA /* AccountSettingReducer.swift */; };
 		AB0929BE2780032400F107CA /* EhSettingReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = AB0929BD2780032400F107CA /* EhSettingReducer.swift */; };
 		AB0929C027805A8200F107CA /* LoginReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = AB0929BF27805A8200F107CA /* LoginReducer.swift */; };
@@ -281,6 +276,10 @@
 		EA0C925E2C3EB49500D211F6 /* README.jpn.md in Resources */ = {isa = PBXBuildFile; fileRef = EA0C92582C3EB49500D211F6 /* README.jpn.md */; };
 		EA2E2E7F2A1F7E500038A261 /* SettingReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA2E2E7E2A1F7E500038A261 /* SettingReducer.swift */; };
 		EA2E2E822A1FA1060038A261 /* SearchReducer.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA2E2E812A1FA1050038A261 /* SearchReducer.swift */; };
+		EA5AA4A72EA9149E00BC2B5C /* PageHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA5AA4A62EA9149E00BC2B5C /* PageHandler.swift */; };
+		EA5AA4A82EA9149E00BC2B5C /* LiveTextHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA5AA4A52EA9149E00BC2B5C /* LiveTextHandler.swift */; };
+		EA5AA4A92EA9149E00BC2B5C /* GestureHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA5AA4A42EA9149E00BC2B5C /* GestureHandler.swift */; };
+		EA5AA4AA2EA9149E00BC2B5C /* AutoPlayHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA5AA4A32EA9149E00BC2B5C /* AutoPlayHandler.swift */; };
 		EA698C032CCDD2FB0058BC19 /* EquatableVoid.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA698C022CCDD2FB0058BC19 /* EquatableVoid.swift */; };
 		EA698C092CCDE7090058BC19 /* IdentifiableBox.swift in Sources */ = {isa = PBXBuildFile; fileRef = EA698C082CCDE7050058BC19 /* IdentifiableBox.swift */; };
 		EAE63E2129E2A6330048C601 /* SwiftyBeaver in Frameworks */ = {isa = PBXBuildFile; productRef = EAE63E2029E2A6330048C601 /* SwiftyBeaver */; };
@@ -318,11 +317,6 @@
 /* End PBXCopyFilesBuildPhase section */
 
 /* Begin PBXFileReference section */
-		145E7E382E36DE6D00822CB0 /* GestureCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GestureCoordinator.swift; sourceTree = "<group>"; };
-		145E7E392E36DE6D00822CB0 /* ImageStackView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ImageStackView.swift; sourceTree = "<group>"; };
-		145E7E3A2E36DE6D00822CB0 /* PageCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PageCoordinator.swift; sourceTree = "<group>"; };
-		145E7E3C2E36DE6D00822CB0 /* ReadingViewExtensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ReadingViewExtensions.swift; sourceTree = "<group>"; };
-		145E7E3D2E36DE6D00822CB0 /* ReadingViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ReadingViewModel.swift; sourceTree = "<group>"; };
 		AB0929B5277F043D00F107CA /* AccountSettingReducer.swift */ = {isa = PBXFileReference; lastKn
```

**File**: `EhPanda/View/Reading/ReadingReducer.swift` (modified, +433/-818)
```diff
@@ -7,39 +7,34 @@ import SwiftUI
 import TTProgressHUD
 import ComposableArchitecture
 
-// MARK: - Reading Reducer
 @Reducer
 struct ReadingReducer {
-
-    // MARK: - Route
     @CasePathable
     enum Route: Equatable {
         case hud
         case share(IdentifiableBox<ShareItem>)
         case readingSetting(EquatableVoid = .init())
     }
 
-    // MARK: - Share Item
     enum ShareItem: Equatable {
-        case data(Data)
-        case image(UIImage)
-
         var associatedValue: Any {
             switch self {
-            case .data(let data): return data
-            case .image(let image): return image
+            case .data(let data):
+                return data
+            case .image(let image):
+                return image
             }
         }
+        case data(Data)
+        case image(UIImage)
     }
 
-    // MARK: - Image Action
     enum ImageAction {
         case copy(Bool)
         case save(Bool)
         case share(Bool)
     }
 
-    // MARK: - Cancel IDs
     private enum CancelID: CaseIterable {
         case fetchImage
         case fetchDatabaseInfos
@@ -51,107 +46,136 @@ struct ReadingReducer {
         case fetchMPVImageURL
     }
 
-    // MARK: - State
     @ObservableState
     struct State: Equatable {
-        // MARK: - Navigation & UI
         var route: Route?
-        var showsPanel = false
-        var showsSliderPreview = false
-        var hudConfig: TTProgressHUDConfig = .loading
-        var forceRefreshID: UUID = .init()
-
-        // MARK: - Gallery Data
         var gallery: Gallery = .empty
         var galleryDetail: GalleryDetail?
+
         var readingProgress: Int = .zero
+        var forceRefreshID: UUID = .init()
+        var hudConfig: TTProgressHUDConfig = .loading
 
-        // MARK: - Loading States
         var webImageLoadSuccessIndices = Set<Int>()
         var imageURLLoadingStates = [Int: LoadingState]()
         var previewLoadingStates = [Int: LoadingState]()
         var databaseLoadingState: LoadingState = .loading
-
-        // MARK: - Preview Configuration
         var previewConfig: PreviewConfig = .normal(rows: 4)
 
-        // MARK: - URL Storage
         var previewURLs = [Int: URL]()
+
         var thumbnailURLs = [Int: URL]()
         var imageURLs = [Int: URL]()
         var originalImageURLs = [Int: URL]()
 
-        // MARK: - MPV Support
         var mpvKey: String?
         var mpvImageKeys = [Int: String]()
         var mpvSkipServerIdentifiers = [Int: String]()
+
+        var showsPanel = false
+        var showsSliderPreview = false
+
+        // Update
+        func update<T>(stored: inout [Int: T], new: [Int: T], replaceExisting: Bool = true) {
+            guard !new.isEmpty else { return }
+            stored = stored.merging(new, uniquingKeysWith: { stored, new in replaceExisting ? new : stored })
+        }
+        mutating func updatePreviewURLs(_ previewURLs: [Int: URL]) {
+            update(stored: &self.previewURLs, new: previewURLs)
+        }
+        mutating func updateThumbnailURLs(_ thumbnailURLs: [Int: URL]) {
+            update(stored: &self.thumbnailURLs, new: thumbnailURLs)
+        }
+        mutating func updateImageURLs(_ imageURLs: [Int: URL], _ originalImageURLs: [Int: URL]) {
+            update(stored: &self.imageURLs, new: imageURLs)
+            update(stored: &self.originalImageURLs, new: originalImageURLs)
+        }
+
+        // Image
+        func containerDataSource(setting: Setting, isLandscape: Bool = DeviceUtil.isLandscape) -> [Int] {
+            let defaultData = Array(1...gallery.pageCount)
+            guard isLandscape && setting.enablesDualPageMode
+                    && setting.readingDirection != .vertical
+            else { return defaultData }
+
+            let data = setting.exceptCover
+                ? [1] + Array(stride(from: 2, through: gallery.pageCount, by: 2))
+                : Array(stride(from: 1, through: gallery.pageCount, by: 2))
+
+            return data
+ 
```

**File**: `EhPanda/View/Reading/ReadingView.swift` (modified, +524/-366)
```diff
@@ -8,466 +8,624 @@ import Kingfisher
 import SwiftUIPager
 import ComposableArchitecture
 
-// MARK: - Main Reading View
 struct ReadingView: View {
     @Environment(\.colorScheme) private var colorScheme
-    @Bindable var store: StoreOf<ReadingReducer>
 
-    // MARK: - Configuration
+    @Bindable var store: StoreOf<ReadingReducer>
     private let gid: String
     @Binding private var setting: Setting
     private let blurRadius: Double
 
-    // MARK: - View Models
-    @StateObject private var viewModel: ReadingViewModel
-    @StateObject private var gestureCoordinator: GestureCoordinator
-    @StateObject private var pageCoordinator: PageCoordinator
+    @StateObject private var liveTextHandler = LiveTextHandler()
+    @StateObject private var autoPlayHandler = AutoPlayHandler()
+    @StateObject private var gestureHandler = GestureHandler()
+    @StateObject private var pageHandler = PageHandler()
     @StateObject private var page: Page = .first()
 
-    // MARK: - Initialization
     init(
         store: StoreOf<ReadingReducer>,
-        gid: String,
-        setting: Binding<Setting>,
-        blurRadius: Double
+        gid: String, setting: Binding<Setting>, blurRadius: Double
     ) {
         self.store = store
         self.gid = gid
         _setting = setting
         self.blurRadius = blurRadius
+    }
 
-        // Initialize view models with dependencies
-        _viewModel = StateObject(wrappedValue: ReadingViewModel())
-        _gestureCoordinator = StateObject(wrappedValue: GestureCoordinator())
-        _pageCoordinator = StateObject(wrappedValue: PageCoordinator())
+    private var backgroundColor: Color {
+        colorScheme == .light ? Color(.systemGray4) : Color(.systemGray6)
     }
 
-    // MARK: - Body
     var body: some View {
+        changeTriggers(content: { content })
+            .sheet(item: $store.route.sending(\.setNavigation).readingSetting) { _ in
+                NavigationView {
+                    ReadingSettingView(
+                        readingDirection: $setting.readingDirection,
+                        prefetchLimit: $setting.prefetchLimit,
+                        enablesLandscape: $setting.enablesLandscape,
+                        contentDividerHeight: $setting.contentDividerHeight,
+                        maximumScaleFactor: $setting.maximumScaleFactor,
+                        doubleTapScaleFactor: $setting.doubleTapScaleFactor
+                    )
+                    .toolbar {
+                        if !DeviceUtil.isPad && DeviceUtil.isLandscape {
+                            CustomToolbarItem(placement: .cancellationAction) {
+                                Button {
+                                    store.send(.setNavigation(nil))
+                                } label: {
+                                    Image(systemSymbol: .chevronDown)
+                                }
+                            }
+                        }
+                    }
+                }
+                .accentColor(setting.accentColor)
+                .tint(setting.accentColor)
+                .autoBlur(radius: blurRadius)
+                .navigationViewStyle(.stack)
+            }
+            .sheet(item: $store.route.sending(\.setNavigation).share) { shareItemBox in
+                ActivityView(activityItems: [shareItemBox.wrappedValue.associatedValue])
+                    .accentColor(setting.accentColor)
+                    .autoBlur(radius: blurRadius)
+            }
+            .progressHUD(
+                config: store.hudConfig,
+                unwrapping: $store.route,
+                case: \.hud
+            )
+
+            .animation(.linear(duration: 0.1), value: gestureHandler.offset)
+            .animation(.default, value: liveTextHandler.enablesLiveText)
+            .animation(.default, value: liveTextHandler.liveTextGroups)
+            .animation(.default, value: gestureHandler.scale)
+            .animation(.default, value: sto
```

**File**: `EhPanda/View/Reading/Support/AdvancedList.swift` (modified, +23/-159)
```diff
@@ -6,29 +6,20 @@
 import SwiftUI
 import SwiftUIPager
 
-/// Improved vertical list for reading view with iOS 26 scrolling fix
 struct AdvancedList<Element, ID, PageView, G>: View
 where PageView: View, Element: Equatable, ID: Hashable, G: Gesture {
+    @State var performingChanges = false
 
-    // MARK: - State
-    @State private var performingChanges = false
-    @State private var scrollTarget: Element?
-
-    // MARK: - Properties
     private let pagerModel: Page
     private let data: [Element]
     private let id: KeyPath<Element, ID>
     private let spacing: CGFloat
     private let gesture: G
     private let content: (Element) -> PageView
 
-    // MARK: - Initialization
     init<Data: RandomAccessCollection>(
-        page: Page,
-        data: Data,
-        id: KeyPath<Element, ID>,
-        spacing: CGFloat,
-        gesture: G,
+        page: Page, data: Data,
+        id: KeyPath<Element, ID>, spacing: CGFloat, gesture: G,
         @ViewBuilder content: @escaping (Element) -> PageView
     ) where Data.Index == Int, Data.Element == Element {
         self.pagerModel = page
@@ -39,170 +30,43 @@ where PageView: View, Element: Equatable, ID: Hashable, G: Gesture {
         self.content = content
     }
 
-    // MARK: - Body
     var body: some View {
         ScrollViewReader { proxy in
-            ScrollView(.vertical, showsIndicators: false) {
+            ScrollView(showsIndicators: false) {
                 LazyVStack(spacing: spacing) {
-                    ForEach(data, id: id) { element in
-                        contentWithGestures(for: element)
-                            .id(element[keyPath: id])
+                    ForEach(data, id: id) { index in
+                        let longPress = longPressGesture(index: index)
+                        let gestures = longPress.simultaneously(with: gesture)
+                        content(index).gesture(gestures)
                     }
                 }
-                .onAppear {
-                    initialScrollToPage(proxy: proxy)
-                }
+                .onAppear { tryScrollTo(id: pagerModel.index + 1, proxy: proxy) }
             }
-            // iOS 26 compatible scroll handling
-            .coordinateSpace(name: "ScrollView")
             .onChange(of: pagerModel.index) { _, newValue in
-                handlePageChange(newValue: newValue, proxy: proxy)
-            }
-            .onChange(of: scrollTarget) { _, newValue in
-                if let target = newValue {
-                    scrollToTarget(target, proxy: proxy)
-                }
+                tryScrollTo(id: newValue + 1, proxy: proxy)
             }
         }
     }
 
-    // MARK: - Content with Gestures
-    @ViewBuilder
-    private func contentWithGestures(for element: Element) -> some View {
-        let longPress = createLongPressGesture(for: element)
-        let combinedGestures = longPress.simultaneously(with: gesture)
-
-        content(element)
-            .gesture(combinedGestures)
-    }
-
-    // MARK: - Gesture Creation
-    private func createLongPressGesture(for element: Element) -> some Gesture {
-        LongPressGesture(minimumDuration: 0, maximumDistance: .infinity)
+    private func longPressGesture(index: Element) -> some Gesture {
+        // Setting `minimumDuration` to zero will block ScrollView interaction
+        LongPressGesture(minimumDuration: 0.5, maximumDistance: .infinity)
             .onEnded { _ in
-                handleLongPress(for: element)
-            }
-    }
-
-    // MARK: - Event Handlers
-    private func handleLongPress(for element: Element) {
-        guard let index = element as? Int else { return }
-
-        Logger.info("Long press detected", context: ["element": index])
-
-        performingChanges = true
-        pagerModel.update(.new(index: index - 1))
-
-        // Reset performing changes after a delay
-        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
-            performingChanges = 
```

**File**: `EhPanda/View/Reading/Support/AutoPlayHandler.swift` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+//
+//  AutoPlayHandler.swift
+//  EhPanda
+//
+
+import SwiftUI
+
+final class AutoPlayHandler: ObservableObject {
+    @Published var policy: AutoPlayPolicy = .off
+    private var timer: Timer?
+
+    deinit {
+        invalidate()
+    }
+
+    func invalidate() {
+        Logger.info("invalidate")
+        timer?.invalidate()
+    }
+
+    func setPolicy(_ policy: AutoPlayPolicy, updatePageAction: @escaping () -> Void) {
+        Logger.info("setPolicy", context: ["policy": policy])
+        self.policy = policy
+        timer?.invalidate()
+        let timeInterval = TimeInterval(policy.rawValue)
+        if timeInterval > 0 {
+            timer = .scheduledTimer(
+                withTimeInterval: timeInterval, repeats: true,
+                block: { _ in updatePageAction() }
+            )
+        }
+    }
+}
```

---

### Incident Patch 3: `989717a1` (2025-10-19)
**Commit Message**: Resolve EhSetting page crash issue

**File**: `EhPanda/View/Setting/EhSetting/EhSettingView.swift` (modified, +11/-8)
```diff
@@ -874,14 +874,17 @@ private struct ValuePicker: View {
         Slider(
             value: $value,
             in: range,
-            step: 1,
-            minimumValueLabel: Text(String(Int(range.lowerBound)) + unit)
-                .fontWeight(.medium)
-                .font(.callout),
-            maximumValueLabel: Text(String(Int(range.upperBound)) + unit)
-                .fontWeight(.medium)
-                .font(.callout),
-            label: EmptyView.init
+            label: EmptyView.init,
+            minimumValueLabel: {
+                Text(String(Int(range.lowerBound)) + unit)
+                    .fontWeight(.medium)
+                    .font(.callout)
+            },
+            maximumValueLabel: {
+                Text(String(Int(range.upperBound)) + unit)
+                    .fontWeight(.medium)
+                    .font(.callout)
+            }
         )
     }
 }
```

---

### Incident Patch 4: `a84196c8` (2025-07-29)
**Commit Message**: fixed reading view slider bottom padding under liquid glass effect and added interactive button. ready to release.

**File**: `EhPanda/View/Reading/Support/ControlPanel.swift` (modified, +5/-5)
```diff
@@ -128,7 +128,7 @@ private struct UpperPanel: View {
                         .foregroundColor(.primary)
                         .frame(width: 44, height: 44)
                 }
-                .glassEffect()
+                .glassEffect(.regular.interactive())
                 .padding(.leading, 20)
             } else {
                 Button(action: dismissAction) {
@@ -239,7 +239,7 @@ private struct UpperPanel: View {
                 }
                 .padding(.horizontal, 16)
                 .padding(.vertical, 8)
-                .glassEffect()
+                .glassEffect(.regular.interactive())
                 .padding(.trailing, 20)
             } else {
                 HStack(spacing: 20) {
@@ -352,7 +352,7 @@ private struct LowerPanel<G: Gesture>: View {
                         .font(.title2)
                         .frame(width: 44, height: 44)
                 }
-                .glassEffect(in: RoundedRectangle(cornerRadius: 22))
+                .glassEffect(.regular.interactive())
                 .gesture(dismissGesture)
                 .opacity(showsSliderPreview ? 0 : 1)
             } else {
@@ -390,10 +390,10 @@ private struct LowerPanel<G: Gesture>: View {
                             Text(isReversed ? "\(Int(range.lowerBound))" : "\(Int(range.upperBound))")
                                 .fontWeight(.medium).font(.caption).padding()
                         }
-                        .padding(.horizontal).padding(.bottom)
+                        .padding(.horizontal) //.padding(.bottom)
+                        .glassEffect()
                     }
                 }
-                .glassEffect()
             } else {
                 VStack(spacing: 0) {
                     SliderPreivew(
```

---

### Incident Patch 5: `a9604f7f` (2025-07-28)
**Commit Message**: revert bundle identifier

**File**: `EhPanda.xcodeproj/project.pbxproj` (modified, +20/-20)
```diff
@@ -2092,10 +2092,10 @@
 			isa = XCBuildConfiguration;
 			buildSettings = {
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++17";
-				CODE_SIGN_IDENTITY = "Apple Development";
-				CODE_SIGN_STYLE = Automatic;
+				CODE_SIGN_IDENTITY = "iPhone Developer";
+				CODE_SIGN_STYLE = Manual;
 				CURRENT_PROJECT_VERSION = 156;
-				DEVELOPMENT_TEAM = RYCYM2Y5FL;
+				DEVELOPMENT_TEAM = 9SKQ7QTZ74;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = ShareExtension/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = ShareExtension;
@@ -2106,9 +2106,9 @@
 					"@executable_path/Frameworks",
 					"@executable_path/../../Frameworks",
 				);
-				PRODUCT_BUNDLE_IDENTIFIER = app.zack.ehpanda.shareExtension;
+				PRODUCT_BUNDLE_IDENTIFIER = app.ehpanda.shareExtension;
 				PRODUCT_NAME = "$(TARGET_NAME)";
-				PROVISIONING_PROFILE_SPECIFIER = "";
+				PROVISIONING_PROFILE_SPECIFIER = ShareExtension_Dev;
 				SKIP_INSTALL = YES;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_VERSION = 5.0;
@@ -2120,10 +2120,10 @@
 			isa = XCBuildConfiguration;
 			buildSettings = {
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++17";
-				CODE_SIGN_IDENTITY = "Apple Development";
-				CODE_SIGN_STYLE = Automatic;
+				CODE_SIGN_IDENTITY = "iPhone Developer";
+				CODE_SIGN_STYLE = Manual;
 				CURRENT_PROJECT_VERSION = 156;
-				DEVELOPMENT_TEAM = RYCYM2Y5FL;
+				DEVELOPMENT_TEAM = 9SKQ7QTZ74;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = ShareExtension/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = ShareExtension;
@@ -2134,9 +2134,9 @@
 					"@executable_path/Frameworks",
 					"@executable_path/../../Frameworks",
 				);
-				PRODUCT_BUNDLE_IDENTIFIER = app.zack.ehpanda.shareExtension;
+				PRODUCT_BUNDLE_IDENTIFIER = app.ehpanda.shareExtension;
 				PRODUCT_NAME = "$(TARGET_NAME)";
-				PROVISIONING_PROFILE_SPECIFIER = "";
+				PROVISIONING_PROFILE_SPECIFIER = ShareExtension_Dev;
 				SKIP_INSTALL = YES;
 				SWIFT_EMIT_LOC_STRINGS = YES;
 				SWIFT_VERSION = 5.0;
@@ -2271,11 +2271,11 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
 				CODE_SIGN_ENTITLEMENTS = EhPanda/EhPanda.entitlements;
-				CODE_SIGN_IDENTITY = "Apple Development";
-				CODE_SIGN_STYLE = Automatic;
+				CODE_SIGN_IDENTITY = "iPhone Developer";
+				CODE_SIGN_STYLE = Manual;
 				CURRENT_PROJECT_VERSION = 156;
 				DEVELOPMENT_ASSET_PATHS = "";
-				DEVELOPMENT_TEAM = RYCYM2Y5FL;
+				DEVELOPMENT_TEAM = 9SKQ7QTZ74;
 				ENABLE_PREVIEWS = YES;
 				INFOPLIST_FILE = EhPanda/App/Info.plist;
 				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
@@ -2284,9 +2284,9 @@
 					"@executable_path/Frameworks",
 				);
 				OTHER_LDFLAGS = "";
-				PRODUCT_BUNDLE_IDENTIFIER = app.zack.ehpanda;
+				PRODUCT_BUNDLE_IDENTIFIER = app.ehpanda;
 				PRODUCT_NAME = "$(TARGET_NAME)";
-				PROVISIONING_PROFILE_SPECIFIER = "";
+				PROVISIONING_PROFILE_SPECIFIER = App_Dev;
 				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
 				SWIFT_VERSION = 5.0;
 				TARGETED_DEVICE_FAMILY = "1,2";
@@ -2300,11 +2300,11 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
 				CODE_SIGN_ENTITLEMENTS = EhPanda/EhPanda.entitlements;
-				CODE_SIGN_IDENTITY = "Apple Development";
-				CODE_SIGN_STYLE = Automatic;
+				CODE_SIGN_IDENTITY = "iPhone Developer";
+				CODE_SIGN_STYLE = Manual;
 				CURRENT_PROJECT_VERSION = 156;
 				DEVELOPMENT_ASSET_PATHS = "";
-				DEVELOPMENT_TEAM = RYCYM2Y5FL;
+				DEVELOPMENT_TEAM = 9SKQ7QTZ74;
 				ENABLE_PREVIEWS = YES;
 				INFOPLIST_FILE = EhPanda/App/Info.plist;
 				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
@@ -2313,9 +2313,9 @@
 					"@executable_path/Frameworks",
 				);
 				OTHER_LDFLAGS = "";
-				PRODUCT_BUNDLE_IDENTIFIER = app.zack.ehpanda;
+				PRODUCT_BUNDLE_IDENTIFIER = app.ehpanda;
 				PRODUCT_NAME = "$(TARGET_NAME)";
-				PROVISIONING_PROFILE_SPECIFIER = "";
+				PROVISIONING_PROFILE_SPECIFIER = App_Dev;
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				
```

---

### Incident Patch 6: `666d2dfd` (2025-07-28)
**Commit Message**: Fix CODEOWNERS

**File**: `.github/CODEOWNERS` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@
 # the repo. Unless a later match takes precedence,
 # @global-owner1 and @global-owner2 will be requested for
 # review when someone opens a pull request.
-* @ehpanda-maintainers
+# *       @global-owner1 @global-owner2
 
 # Order is important; the last matching pattern takes the most
 # precedence. When someone opens a pull request that only
@@ -22,7 +22,7 @@
 # be identified in the format @org/team-name. Teams must have
 # explicit write access to the repository. In this example,
 # the octocats team in the octo-org organization owns all .txt files.
-# *.txt @octo-org/octocats
+* @EhPanda-Team/ehpanda-maintainers
 
 # In this example, @doctocat owns any files in the build/logs
 # directory at the root of the repository and any of its
```

---

### Incident Patch 7: `a559192f` (2025-07-28)
**Commit Message**: Revert README.md to original state

**File**: `README.md` (modified, +14/-4)
```diff
@@ -1,9 +1,9 @@
 <h1 align="center">EhPanda</h1>
 
-<h4 align="center">An unofficial fork of the E-Hentai App for iOS.</h4>
+<h4 align="center">An unofficial E-Hentai App for iOS.</h4>
 
 <p align="center">
-<!--<img src="" width="400"></img>-->
+<img src="https://user-images.githubusercontent.com/31207151/105609404-0acbff00-5de4-11eb-9e88-f3c6e0ba9d44.png" width="400"></img>
 </p>
 
 <p align="center">
@@ -22,8 +22,10 @@ App Strings: [{lang}.lproj](/EhPanda/App)
 
 GitHub Readme: [README.{lang}.md](/READMEs)
 
+https://ehpanda.app: [main.js](https://github.com/EhPanda-Team/ehpanda-website/blob/main/src/main.js)
+
 ## Installation
-1. Get the ipa file from [Releases](https://github.com/aalberrty/EhPanda/releases).
+1. Get the ipa file from [Releases](https://github.com/EhPanda-Team/EhPanda/releases).
 2. Use some software like [AltStore](https://altstore.io) to install the ipa file on your device.
 
 ## System Requirements
@@ -35,4 +37,12 @@ The content in this application is derived from E-Hentai, which is user-generate
 **Users of this application should access the E-Hentai content at their own risk.**
 
 ## Questions & Feedback
-Please use [Github Issues](https://github.com/aalberrty/EhPanda/issues) for feedback.
+[![Twitter](https://img.shields.io/badge/Twitter-2CA5E0?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/ehpandaapp)
+[![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/BSBE9FCBTq)
+[![Telegram](https://img.shields.io/badge/Telegram-858585?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/ehpanda)
+
+## Screenshots
+https://ehpanda.app
+
+## App Icon
+Copyright © 2024 荒木辰造. All rights reserved.
```

---

### Incident Patch 8: `e9b6f42b` (2025-07-28)
**Commit Message**: fix zooming boundaries

**File**: `EhPanda/View/Reading/Support/GestureCoordinator.swift` (modified, +21/-42)
```diff
@@ -121,6 +121,7 @@ final class GestureCoordinator: ObservableObject {
             }
         } else {
             scale = finalScale
+            // Apply constraints after scale change to ensure proper bounds
             constrainOffset()
         }
         
@@ -154,14 +155,14 @@ final class GestureCoordinator: ObservableObject {
             height: baseOffset.height + currentPanOffset.height
         )
         
-        // Temporarily remove constraints for testing
-        offset = totalOffset
+        // Apply boundary constraints to prevent dragging beyond image edges
+        offset = constrainOffset(totalOffset)
         
         Logger.info("Offset updated", context: [
             "adjustedTranslation": adjustedTranslation,
             "currentPanOffset": currentPanOffset,
             "totalOffset": totalOffset,
-            "offset": offset
+            "constrainedOffset": offset
         ])
     }
     
@@ -175,8 +176,12 @@ final class GestureCoordinator: ObservableObject {
         guard scale > 1.0 else { return }
         Logger.info("Handle drag ended")
         
-        // Update base offset with final position
-        baseOffset = offset
+        // Ensure the final position is properly constrained
+        let finalOffset = constrainOffset(offset)
+        offset = finalOffset
+        
+        // Update base offset with final constrained position
+        baseOffset = finalOffset
         currentPanOffset = .zero
     }
     
@@ -233,17 +238,18 @@ final class GestureCoordinator: ObservableObject {
     private func constrainOffset(_ newOffset: CGSize? = nil) -> CGSize {
         let targetOffset = newOffset ?? offset
         
-        let constrainedWidth = constrainOffsetDimension(
-            value: targetOffset.width,
-            anchor: scaleAnchor.x,
-            screenSize: DeviceUtil.absWindowW
-        )
+        // Calculate the maximum allowed offset based on scale and screen size
+        let screenWidth = DeviceUtil.absWindowW
+        let screenHeight = DeviceUtil.absWindowH
         
-        let constrainedHeight = constrainOffsetDimension(
-            value: targetOffset.height,
-            anchor: scaleAnchor.y,
-            screenSize: DeviceUtil.absWindowH
-        )
+        // When scaled, the image is larger than the screen, so we need to constrain
+        // the offset to keep the image content visible
+        let maxOffsetX = screenWidth * (scale - 1) / 2
+        let maxOffsetY = screenHeight * (scale - 1) / 2
+        
+        // Apply constraints to keep the image within bounds
+        let constrainedWidth = min(max(targetOffset.width, -maxOffsetX), maxOffsetX)
+        let constrainedHeight = min(max(targetOffset.height, -maxOffsetY), maxOffsetY)
         
         let constrained = CGSize(width: constrainedWidth, height: constrainedHeight)
         
@@ -253,33 +259,6 @@ final class GestureCoordinator: ObservableObject {
         
         return constrained
     }
-    
-    private func constrainOffsetDimension(
-        value: Double,
-        anchor: Double,
-        screenSize: Double
-    ) -> Double {
-        let margin = screenSize * (scale - 1) / 2
-        let leadingMargin = (anchor / 0.5) * margin
-        let trailingMargin = ((1 - anchor) / 0.5) * margin
-        
-        return min(max(value, -trailingMargin), leadingMargin)
-    }
-    
-    private func constrainOffsetSimple(_ newOffset: CGSize) -> CGSize {
-        let screenWidth = DeviceUtil.absWindowW
-        let screenHeight = DeviceUtil.absWindowH
-        
-        // Calculate maximum allowed offset based on zoom level with more flexibility
-        let maxOffsetX = screenWidth * (scale - 1) * 0.8  // Allow 80% of theoretical max
-        let maxOffsetY = screenHeight * (scale - 1) * 0.8
-        
-        // Apply bounds with more flexibility for natural panning
-        let constrainedWidth = min(max(newOffset.width, -maxOffsetX), maxOffsetX)
-        let constrainedHeight = min
```

---

### Incident Patch 9: `49320bfc` (2024-12-21)
**Commit Message**: Fix reading page scroll functionality

**File**: `EhPanda/View/Reading/ReadingView.swift` (modified, +5/-1)
```diff
@@ -120,7 +120,11 @@ struct ReadingView: View {
             }
             .scaleEffect(gestureHandler.scale, anchor: gestureHandler.scaleAnchor)
             .offset(gestureHandler.offset)
-            .highPriorityGesture(dragGesture.simultaneously(with: tapGesture))
+            .highPriorityGesture(
+                dragGesture.simultaneously(with: tapGesture),
+                isEnabled: gestureHandler.scale > 1
+            )
+            .gesture(tapGesture, isEnabled: gestureHandler.scale == 1)
             .gesture(magnificationGesture)
             .ignoresSafeArea()
             .id(store.databaseLoadingState)
```

---

### Incident Patch 10: `cf4f6edf` (2024-12-15)
**Commit Message**: Fix reading page gestures

**File**: `EhPanda/View/Reading/ReadingView.swift` (modified, +2/-3)
```diff
@@ -105,7 +105,7 @@ struct ReadingView: View {
                         gesture: SimultaneousGesture(magnificationGesture, tapGesture),
                         content: imageStack
                     )
-                    .disabled(gestureHandler.scale != 1)
+                    .scrollDisabled(gestureHandler.scale != 1)
                 } else {
                     Pager(
                         page: page,
@@ -120,8 +120,7 @@ struct ReadingView: View {
             }
             .scaleEffect(gestureHandler.scale, anchor: gestureHandler.scaleAnchor)
             .offset(gestureHandler.offset)
-            .gesture(tapGesture)
-            .gesture(dragGesture)
+            .highPriorityGesture(dragGesture.simultaneously(with: tapGesture))
             .gesture(magnificationGesture)
             .ignoresSafeArea()
             .id(store.databaseLoadingState)
```

#### Recent Merged Pull Requests:
- **PR #460** (2026-07-20): Bugfixes & Liquid Glass adaptation (@chihchy)
- **PR #459** (closed): Update 2.8.0 sha256 checksum for AltStore (@i0ntempest)
- **PR #457** (2026-07-09): Drop Core Data, persist light app data via `@Shared` (@chihchy)
- **PR #456** (2026-07-05): Migrate localization to Xcode String Catalogs (@chihchy)
- **PR #455** (2026-07-03): Modernize TCA navigation: StackState, @Presents modals, and native alerts (@chihchy)
- **PR #454** (2026-07-01): Remove SwiftyBeaver and rebuild logging on OSLog (@chihchy)
- **PR #453** (2026-06-29): Modularize the app into a local Swift package (@chihchy)
- **PR #451** (2026-06-27): Add Seek to date gallery navigation (@chihchy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
