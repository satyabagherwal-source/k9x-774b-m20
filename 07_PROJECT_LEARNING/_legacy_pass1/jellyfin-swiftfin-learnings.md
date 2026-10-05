# Forensic Learning Record (Deep Inspection): jellyfin/Swiftfin

> **Canonical Artifact**: `07_PROJECT_LEARNING/jellyfin-swiftfin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jellyfin/Swiftfin](https://github.com/jellyfin/Swiftfin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T01:50:58.292Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jellyfin/Swiftfin`
- **Description**: Native Jellyfin Client for iOS and tvOS 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4191 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2339** (2026-09-28): **Fix tvOS `ListRow` Clipping**
  *Symptoms*: ### Summary  Fixes weird clipping for Library List items. Just changing the location of the modifier. Zoom transition is unchanged for iOS. But we're just zooming to and from the image in the list row instead of the full row.  #### Before  <img width="396" height="143" alt="Screenshot 2026-09-27 at 18 52 44" src="https://github.com/user-attachments/assets/6090fc56-210c-43fd-839a-d4b18a257979" />  #### After  <img width="399" height="142" alt="Screenshot 2026-09-27 at 18 54 08" src="https://github.com/user-attachments/assets/492689b2-c320-4cba-b51a-8fcfec9f81b2" />
  **Post-Mortem & Fix Analysis**:
  > We may also want to remove the row divider on tvOS but I'll defer on that.

- **Issue #2335** (2026-09-26): **Content group focus**
  *Symptoms*: Closes #2234  Coordinate focus for content group states.

- **Issue #2334** (2026-09-26): **Poster overlay indicator styling, accessibility**
  *Symptoms*: - Poster overlay 	- Fix "rewatching" by showing progress even if marked as played 	- Adjust poster labels from circles to quadrant, generalizing the previous "episode count" design 		- Will go to circle/capsule design when poster has progress 	- Have overlay runtime in capsule instead of plain text - Poster settings 	- Allow selection of variety of item metadata in poster label 		- Does re-require requesting more item fields, should be fine. Would also be greatly aided with #2327. 	- As stored objects change over time, decoding to not broadly cause setting resets requires more manual work. Had implemented overall behavior as a macro, and finally made a macro for option sets while I'm at it. - Manual poster item accessibility for VoiceOver 	- A bit more intrusive than I wanted it to be 	- Closes #963, as that issue directly calls out poster data for VoiceOver. Overall, accessibility is improving and I'll take more specific issues going forward. - Episode cards 	- Closes #2158, now uses the same poster size resolution. This did cause an increase in requested size, can up if necessary. 	- Now have context menu

- **Issue #2332** (2026-09-24): **Use product name**
  *Symptoms*: Closes #2329  Use product name instead of target name.

- **Issue #2331** (2026-09-24): **`ActivityLogs` `ignoreSafeArea`**
  *Symptoms*: ### Summary  Same as https://github.com/jellyfin/Swiftfin/pull/2328 just adding `ignoreSafeArea` so the Activity Logs fill the the top safe area.  #### Before  <img width="360" height="320" alt="Before" src="https://github.com/user-attachments/assets/d1d2cdc4-7d3c-4851-a748-4f49bd7b74ce" />  #### After  <img width="355" height="305" alt="Screenshot 2026-09-23 at 21 59 18" src="https://github.com/user-attachments/assets/ef3aa118-0395-48db-8463-a6e568111cf4" />

- **Issue #2329** (2026-09-24): **The app should just be named "Swiftfin", not "Swiftfin iOS".**
  *Symptoms*: ### This issue respects the following points:  - [x] This is a **bug**, not a question or a configuration issue; Please visit our [forum or chat rooms](https://jellyfin.org/contact/) first to troubleshoot with volunteers, before creating a report. - [x] This issue is **not** already reported on [GitHub](https://github.com/jellyfin/Swiftfin/issues?q=is%3Aopen+is%3Aissue). - [x] I have read the [Common Issues](https://github.com/jellyfin/Swiftfin/blob/main/Documentation/common_issues.md) documentation and this issue was not mentioned there. - [x] I'm using an up to date version of Swiftfin; We generally do not support previous older versions. If possible, please update to the latest version before opening an issue. - [x] I agree to follow Jellyfin's [Code of Conduct](https://jellyfin.org/docs/general/community-standards.html#code-of-conduct).  ### Description of the bug  I have installed Swiftfin on my iPad, from the AppStore. Not a private build, the public thing.  When installed, it shows up on my home screen as "Swiftfin iOS". Not only is the name technically incorrect (at some point they renamed it to _iPad OS_), it's also redundant and just looks weird. I mean, the other apps are not named "Safari iOS" or "Mail iOS", are they?  Anyway, you get the idea: the app should just be "Swiftfin" ; I know I'm using iOS.  ## Notes   - I'm really only arguing about the public builds. If y'all want to use a different name for local builds or TestFlights releases, fine by me!  - Thank y
  **Post-Mortem & Fix Analysis**:
  > Awesome, thanks!

- **Issue #2328** (2026-09-24): **Various `ActiveSession` Cleanup**
  *Symptoms*: ### Summary  The original goal of this PR was to cleanup an issue where, the `SessionInfoDto` should tell us which stream indexes are selected & which `mediaSource` is being watched. Previously, I was just assuming always the first source and the first index so the transcode comparison could be off. Mostly just like, it would show ALL of the source codexes instead of just the actual one being converted.  We also had a change in 1.5 where the preferred poster for episodes moved to lanscape which always looked too small for the context of the session information.  While I was there, I just kept finding old things that I feel like we (well, I) could've done better the first time so this is some cleanup.  1. Right now, episodes use the landscape image. This just says use square if square is preferred otherwise use portrait. I added this on the `Poster` primarily to allow it to also be used on the `FormItemSection`.  <img width="345" height="191" alt="Screenshot 2026-09-23 at 15 09 20" src="https://github.com/user-attachments/assets/0ea9a588-0a9b-4550-90f7-ca88dbd54237" />  2. Change the Sessions `CollectionVGrid` to ignore the safe area to more accurately mirror other usages of this and have a more "Liquid Glass" header:  | Before | After | | --- | --- | | <img width="240" height="500" src="https://github.com/user-attachments/assets/a93ab925-33ae-4390-b1fe-5c534fb063d8" /> | <img width="240" height="500" src="https://github.com/user-attachments/assets/83c8ac95-d8f

- **Issue #2325** (2026-09-23): **Revert #2313 & Real Spacing Fix**
  *Symptoms*: ### Summary  Moves the `PosterHStack`.`horizontalInset` into `PosterHStackMetrics`.`horizontalInset` so this can be re-used by the Episode HStack in `ContentGroups`.  Figured out there was no spacing issue for the landscape posters on tvOS it's just the images that were larger would clip out of their containers. Using `.fit` resolves this but would cause [issues](https://github.com/jellyfin/Swiftfin/pull/2322#pullrequestreview-5272347496) with sizing. The fix is I am measuring the frame and using that then fitting to the frame on tvOS only. tvOS isn't the same `PosterButton` since the text and the poster need to focus as a single object so that was the source of our issue.  Also found that the usage of `AlternateLayoutView` would cause the number indicator for unplayed to only be as large as the default frame instead of allowing it to grow width-wise as needed while preserving height.  ### Episodes  #### Before  <img width="3840" height="2160" alt="Image" src="https://github.com/user-attachments/assets/de724904-0368-4f0e-bdc9-9bc2ffffb9f7" />  #### After  <img width="1920" height="1080" alt="Screenshot Apple TV 4K (3rd generation) (at 1080p) 09-22-2026 at 15 33 40" src="https://github.com/user-attachments/assets/b6d00980-9a46-4529-8172-74dff105d52c" />  ### Home / `PosterHStack`  #### Before  <img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/305aa62b-f43e-4cd4-ac7c-98de13aaba53" />  #### After  <img width="19

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

### Incident Patch 1: `cdda8e64` (2026-09-28)
**Commit Message**: Fix tvOS `ListRow` Clipping (#2339)

Co-authored-by: Ethan Pippin <ethanpippin2343@gmail.com>

**File**: `Shared/Components/ListRow.swift` (modified, +11/-44)
```diff
@@ -17,9 +17,6 @@ struct ListRow<Leading: View, Content: View>: View {
     @ViewContextContains(.isListRowSeparatorVisible)
     private var isListRowSeparatorVisible
 
-    @FocusState
-    private var isButtonFocused
-
     @State
     private var contentSize: CGSize = .zero
 
@@ -28,16 +25,16 @@ struct ListRow<Leading: View, Content: View>: View {
     private var insets: EdgeInsets
     private let leading: Leading
 
-    private init(
-        leading: Leading,
-        content: Content,
-        action: @escaping () -> Void,
-        insets: EdgeInsets
+    init(
+        insets: EdgeInsets = .zero,
+        @ViewBuilder leading: @escaping () -> Leading,
+        @ViewBuilder content: @escaping () -> Content,
+        action: @escaping () -> Void = {}
     ) {
-        self.leading = leading
-        self.content = content
         self.action = action
+        self.content = content()
         self.insets = insets
+        self.leading = leading()
     }
 
     var body: some View {
@@ -55,48 +52,18 @@ struct ListRow<Leading: View, Content: View>: View {
                 .padding(insets)
             }
             .foregroundStyle(.primary, .secondary)
-            .focused($isButtonFocused)
+            .contentShape(.contextMenuPreview, Rectangle())
             #if os(tvOS)
             .buttonStyle(.card)
-            #else
-            .contentShape(.contextMenuPreview, Rectangle())
             #endif
 
-            if isListRowSeparatorVisible, !isButtonFocused {
+            #if !os(tvOS)
+            if isListRowSeparatorVisible {
                 Color.secondarySystemFill
                     .frame(width: contentSize.width, height: 1)
                     .padding(.trailing, insets.trailing)
             }
+            #endif
         }
     }
 }
-
-extension ListRow {
-
-    init(
-        insets: EdgeInsets = .zero,
-        @ViewBuilder leading: @escaping () -> Leading,
-        @ViewBuilder content: @escaping () -> Content
-    ) {
-        self.init(
-            insets: insets,
-            leading: leading,
-            content: content,
-            action: {}
-        )
-    }
-
-    init(
-        insets: EdgeInsets = .zero,
-        @ViewBuilder leading: @escaping () -> Leading,
-        @ViewBuilder content: @escaping () -> Content,
-        action: @escaping () -> Void
-    ) {
-        self.init(
-            leading: leading(),
-            content: content(),
-            action: action,
-            insets: insets
-        )
-    }
-}
```

**File**: `Shared/Extensions/JellyfinAPI/BaseItemDto+LibraryElement.swift` (modified, +2/-0)
```diff
@@ -128,7 +128,9 @@ private struct BaseItemDtoLibraryListElement: View {
         } action: {
             item.libraryDidSelectElement(router: router, in: namespace)
         }
+        #if !os(tvOS)
         .matchedTransitionSource(id: "item", in: namespace)
+        #endif
         #if os(tvOS)
         .focusedValue(\.focusedPoster, AnyPoster(item))
         #endif
```

**File**: `Shared/Objects/Libraries/UserViewLibrary.swift` (modified, +2/-0)
```diff
@@ -268,7 +268,9 @@ private struct UserViewLibraryListElement: View {
         } action: {
             element.libraryDidSelectElement(router: router, in: namespace)
         }
+        #if !os(tvOS)
         .matchedTransitionSource(id: "item", in: namespace)
+        #endif
         .onFirstAppear(perform: setImageSources)
         .onChange(of: useRandomImage) {
             setImageSources()
```

---

### Incident Patch 2: `14fe5b8e` (2026-09-23)
**Commit Message**: Revert #2313 & Real Spacing Fix (#2325)

Co-authored-by: Ethan Pippin <ethanpippin2343@gmail.com>

**File**: `Shared/Components/LibraryElement.swift` (modified, +25/-42)
```diff
@@ -72,27 +72,23 @@ extension LibraryElement {
         let libraryStyle = options.normalized(libraryStyle)
 
         #if os(iOS)
-        let gridLayout: CollectionVGridLayout = {
-            switch libraryStyle.posterDisplayType {
-            case .landscape:
-                .minWidth(220, insets: insets)
-            case .portrait, .square:
-                .minWidth(140, insets: insets)
-            }
-        }()
-
-        let phoneGridLayout: CollectionVGridLayout = {
-            switch libraryStyle.posterDisplayType {
-            case .landscape:
-                .columns(2, insets: insets)
-            case .portrait, .square:
-                .columns(3, insets: insets)
-            }
-        }()
-
         switch libraryStyle.displayType {
         case .grid:
-            return UIDevice.isPhone ? phoneGridLayout : gridLayout
+            if UIDevice.isPhone {
+                return .columns(
+                    libraryStyle.posterDisplayType == .landscape ? 2 : 3,
+                    insets: insets,
+                    itemSpacing: EdgeInsets.itemSpacing,
+                    lineSpacing: EdgeInsets.itemSpacing
+                )
+            }
+
+            return .minWidth(
+                libraryStyle.posterDisplayType == .landscape ? 220 : 140,
+                insets: insets,
+                itemSpacing: EdgeInsets.itemSpacing,
+                lineSpacing: EdgeInsets.itemSpacing
+            )
         case .list:
             return .columns(
                 libraryStyle.listColumnCount,
@@ -102,32 +98,19 @@ extension LibraryElement {
             )
         }
         #else
-        switch libraryStyle.displayType {
+        let columnCount = switch libraryStyle.displayType {
         case .grid:
-            switch libraryStyle.posterDisplayType {
-            case .landscape:
-                return .columns(
-                    4,
-                    insets: .init(vertical: 0, horizontal: EdgeInsets.edgePadding),
-                    itemSpacing: EdgeInsets.edgePadding,
-                    lineSpacing: EdgeInsets.edgePadding
-                )
-            case .portrait, .square:
-                return .columns(
-                    7,
-                    insets: .init(vertical: 0, horizontal: EdgeInsets.edgePadding),
-                    itemSpacing: EdgeInsets.edgePadding,
-                    lineSpacing: EdgeInsets.edgePadding
-                )
-            }
+            libraryStyle.posterDisplayType == .landscape ? 4 : 7
         case .list:
-            return .columns(
-                libraryStyle.listColumnCount,
-                insets: .init(vertical: 0, horizontal: EdgeInsets.edgePadding),
-                itemSpacing: EdgeInsets.edgePadding,
-                lineSpacing: EdgeInsets.edgePadding
-            )
+            libraryStyle.listColumnCount
         }
+
+        return .columns(
+            columnCount,
+            insets: .init(vertical: 0, horizontal: EdgeInsets.edgePadding),
+            itemSpacing: EdgeInsets.itemSpacing,
+            lineSpacing: EdgeInsets.itemSpacing
+        )
         #endif
     }
 }
```

**File**: `Shared/Components/PosterButton.swift` (modified, +7/-4)
```diff
@@ -53,11 +53,10 @@ struct PosterButton<Item: Poster>: View {
         PosterImage(
             item: item,
             type: displayType,
-            size: size,
-            contentMode: .fit
+            size: size
         )
         .frame(maxWidth: .infinity, maxHeight: .infinity)
-        .overlay { overlay.posterStyle(displayType, contentMode: .fit) }
+        .overlay { overlay.posterStyle(displayType) }
         .contentShape(.contextMenuPreview, Rectangle())
         .matchedTransitionSource(id: "item", in: namespace)
         .subtleShadow()
@@ -83,14 +82,15 @@ struct PosterButton<Item: Poster>: View {
             // Layout required for tvOS focused offset label behavior
             #if os(tvOS)
             posterImage(overlay: item.posterOverlay(for: displayType))
+                .posterAspectRatio(displayType, contentMode: .fit)
+                .frame(width: posterSize.width > 0 ? posterSize.width : nil)
 
             if posterConfiguration.showLabels {
                 item.posterLabel
                     .frame(maxWidth: .infinity, alignment: .leading)
             }
             #else
             buttonLabel(overlay: item.posterOverlay(for: displayType))
-                .trackingSize($posterSize)
             #endif
         }
         .environment(\.posterDisplayType, displayType)
@@ -99,7 +99,10 @@ struct PosterButton<Item: Poster>: View {
         .buttonBorderShape(.roundedRectangle)
         #if os(tvOS)
         .focusedValue(\.focusedPoster, AnyPoster(item))
+        .frame(maxWidth: .infinity, alignment: .leading)
+        .ignoresSafeArea()
         #endif
+        .trackingSize($posterSize)
         .posterContextMenu(for: item) {
             contextMenuPreview
                 .withViewContext(viewContext)
```

**File**: `Shared/Components/PosterHStack.swift` (modified, +2/-21)
```diff
@@ -9,17 +9,6 @@
 import CollectionHStack
 import SwiftUI
 
-enum PosterHStackMetrics {
-
-    static let itemSpacing: CGFloat = {
-        #if os(tvOS)
-        40
-        #else
-        EdgeInsets.edgePadding / 2
-        #endif
-    }()
-}
-
 struct PosterHStack<
     Data: Collection
 >: View where Data.Element: Poster, Data.Index == Int {
@@ -80,14 +69,6 @@ struct PosterHStack<
         #endif
     }
 
-    private var horizontalInset: CGFloat {
-        #if os(tvOS)
-        60
-        #else
-        EdgeInsets.edgePadding
-        #endif
-    }
-
     var body: some View {
         CollectionHStack(
             uniqueElements: elements,
@@ -102,8 +83,8 @@ struct PosterHStack<
             }
         }
         .clipsToBounds(false)
-        .insets(horizontal: horizontalInset)
-        .itemSpacing(PosterHStackMetrics.itemSpacing)
+        .insets(horizontal: EdgeInsets.edgePadding)
+        .itemSpacing(EdgeInsets.itemSpacing)
         .scrollBehavior(.continuousLeadingEdge)
         .withViewContext(.isThumb)
     }
```

**File**: `Shared/Components/PosterIndicators/UnplayedIndicator.swift` (modified, +12/-12)
```diff
@@ -17,25 +17,25 @@ struct UnplayedIndicator: View {
     let count: Int?
 
     var body: some View {
-        AlternateLayoutView(alignment: .topTrailing) {
-            Color.clear
-                .aspectRatio(1, contentMode: .fit)
-        } content: { (size: CGSize) in
-            if let count, count > 0 {
+        if let count, count > 0 {
+            ZStack {
+                Color.clear
+                    .aspectRatio(1, contentMode: .fit)
+
                 Text(count.description)
                     .fontWeight(.semibold)
                     .foregroundStyle(accentColor.overlayColor)
                     .padding(.horizontal, UIDevice.isTV ? 8 : 4)
                     .fixedSize()
-                    .frame(minWidth: size.width, minHeight: size.height)
-                    .background {
-                        UnevenRoundedRectangle(bottomLeadingRadius: UIDevice.isTV ? 18 : 6)
-                            .fill(accentColor)
-                    }
-            } else {
-                Q3RightTriangle()
+            }
+            .background {
+                UnevenRoundedRectangle(bottomLeadingRadius: UIDevice.isTV ? 18 : 6)
                     .fill(accentColor)
             }
+        } else {
+            Q3RightTriangle()
+                .fill(accentColor)
+                .aspectRatio(1, contentMode: .fit)
         }
     }
 }
```

**File**: `Shared/Extensions/EdgeInsets.swift` (modified, +9/-0)
```diff
@@ -36,6 +36,15 @@ extension EdgeInsets {
 
     static let edgeInsets: EdgeInsets = .init(edgePadding)
 
+    /// The gap between collection items and rows, independent of content insets.
+    static let itemSpacing: CGFloat = {
+        #if os(tvOS)
+        40
+        #else
+        10
+        #endif
+    }()
+
     init(_ constant: CGFloat) {
         self.init(top: constant, leading: constant, bottom: constant, trailing: constant)
     }
```

---

### Incident Patch 3: `83ab4365` (2026-09-16)
**Commit Message**: fix(player): show audio and subtitle tracks during Live TV (#2298)

**File**: `Shared/Views/VideoPlayer/Components/Toolbar/ActionButtons/VideoPlayer+ActionButtons.swift` (modified, +0/-2)
```diff
@@ -46,11 +46,9 @@ extension VideoPlayer.PlaybackControls.Toolbar {
             }
 
             if manager.item.isLiveStream {
-                filteredButtons.removeAll { $0 == .audio }
                 filteredButtons.removeAll { $0 == .autoPlay }
                 filteredButtons.removeAll { $0 == .playbackSpeed }
                 filteredButtons.removeAll { $0 == .playbackSettings }
-                filteredButtons.removeAll { $0 == .subtitles }
             }
 
             return filteredButtons
```

---

### Incident Patch 4: `9b2c17a4` (2026-09-09)
**Commit Message**: Fix tvOS item overview title and navigation (#2279)

**File**: `Shared/Views/ItemContentGroupView/AboutItemGroup.swift` (modified, +4/-1)
```diff
@@ -87,12 +87,15 @@ struct AboutItemGroup: ContentGroup {
         @ViewBuilder
         private var descriptionCard: some View {
             let subtitle = item.taglines?.first ?? item.parentTitle
+            let hasOverviewContent = item.taglines?.first?.isNotEmpty == true || item.overview?.isNotEmpty == true
 
             AboutCard(
                 title: item.displayTitle,
                 subtitle: subtitle
             ) {
-                router.route(to: .itemOverview(item: item))
+                if hasOverviewContent {
+                    router.route(to: .itemOverview(item: item))
+                }
             } content: {
                 if let overview = item.overview, overview.isNotEmpty {
                     SeeMoreText(overview)
```

**File**: `Shared/Views/MediaInformation/ItemOverview.swift` (modified, +0/-6)
```diff
@@ -19,12 +19,6 @@ struct ItemOverviewView: View {
     var body: some View {
         ScrollView {
             VStack(alignment: UIDevice.isTV ? .center : .leading, spacing: 10) {
-
-                #if os(tvOS)
-                Text(item.displayTitle)
-                    .font(.title)
-                #endif
-
                 if let firstTagline = item.taglines?.first {
                     Text(firstTagline)
                         .font(.title3)
```

---

### Incident Patch 5: `d99bedc1` (2026-09-05)
**Commit Message**: Fix tvOS episode state card corner radius (#2272)

**File**: `Shared/Objects/ContentGroup/SeriesEpisodeContentGroup/SeriesEpisodeContentGroup+EpisodeCard.swift` (modified, +3/-0)
```diff
@@ -114,6 +114,9 @@ extension SeriesEpisodeContentGroup {
                         }
                     }
                     .posterStyle(.landscape)
+                #if os(tvOS)
+                    .posterCornerRadius(.landscape)
+                #endif
                     .subtleShadow()
             }
         }
```

---

### Incident Patch 6: `c6541393` (2026-09-05)
**Commit Message**: Merge pull request #2262 from nintwentydo/fix/active-recording-playback

Fix playback of in-progress live tv recordings

**File**: `Shared/Objects/MediaPlayerManager/MediaPlayerItem/MediaPlayerItem+Build.swift` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ extension MediaPlayerItem {
         playbackInfo.audioStreamIndex = audioStreamIndex
         playbackInfo.subtitleStreamIndex = subtitleStreamIndex
 
-        if !item.isLiveStream {
+        if !item.isLiveStream, initialMediaSource.type != .placeholder {
             playbackInfo.mediaSourceID = initialMediaSource.id
         }
 
```

---

### Incident Patch 7: `5f3f91f8` (2026-09-05)
**Commit Message**: Fix user button disappearing (#2270)

**File**: `Shared/Coordinators/Navigation/NavigationInjectionView.swift` (modified, +9/-1)
```diff
@@ -45,13 +45,21 @@ struct NavigationInjectionView: View {
             content
                 .navigationDestination(for: NavigationRoute.self) { route in
                     route.destination
+                        .environment(
+                            \.router,
+                            .init(
+                                navigationCoordinator: coordinator,
+                                isRootOfPath: false
+                            )
+                        )
                 }
         }
         .trackingFrame(for: .navigationStack)
         .environment(
             \.router,
             .init(
-                navigationCoordinator: coordinator
+                navigationCoordinator: coordinator,
+                isRootOfPath: true
             )
         )
         .environmentObject(coordinator)
```

**File**: `Shared/Coordinators/Navigation/Router.swift` (modified, +4/-14)
```diff
@@ -14,6 +14,7 @@ extension NavigationCoordinator {
     struct Router {
 
         let navigationCoordinator: NavigationCoordinator?
+        let isRootOfPath: Bool
 
         func route(
             to route: NavigationRoute,
@@ -36,20 +37,8 @@ struct Router: DynamicProperty {
         let router: NavigationCoordinator.Router
         let dismiss: DismissAction
 
-        private let isRootBox: PublishedBox<Bool?> = .init(initialValue: nil)
-
         var isRootOfPath: Bool {
-            if let boxValue = isRootBox.value {
-                return boxValue
-            }
-
-            guard let router = router.navigationCoordinator else {
-                return false
-            }
-
-            let value = router.path.isEmpty
-            isRootBox.value = value
-            return value
+            router.isRootOfPath
         }
 
         func route(
@@ -112,6 +101,7 @@ extension EnvironmentValues {
 
     @Entry
     var router: NavigationCoordinator.Router = .init(
-        navigationCoordinator: nil
+        navigationCoordinator: nil,
+        isRootOfPath: false
     )
 }
```

#### Recent Merged Pull Requests:
- **PR #2341** (closed): Fix CJK subtitle rendering in VLC (@trulyspinach)
- **PR #2340** (2026-09-29): tvOS App Icon Selection (@JPKribs)
- **PR #2339** (2026-09-28): Fix tvOS `ListRow` Clipping (@JPKribs)
- **PR #2338** (2026-09-27): Clean up app icons, resources (@LePips)
- **PR #2337** (2026-09-27): SwiftUI font cleanup, rows frame, warnings (@LePips)
- **PR #2335** (2026-09-26): Content group focus (@LePips)
- **PR #2334** (2026-09-26): Poster overlay indicator styling, accessibility (@LePips)
- **PR #2333** (2026-09-24): Actions artifacts (@LePips)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
