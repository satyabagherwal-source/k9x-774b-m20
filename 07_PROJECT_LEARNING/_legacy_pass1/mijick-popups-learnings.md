# Forensic Learning Record (Deep Inspection): Mijick/Popups

> **Canonical Artifact**: `07_PROJECT_LEARNING/mijick-popups-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Mijick/Popups](https://github.com/Mijick/Popups))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:52:28.896Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Mijick/Popups`
- **Description**: Popups, popovers, sheets, alerts, toasts, banners, (...) presentation made simple. Written with and for SwiftUI.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1809 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/Internal/Models/DragGestureState.swift`
```
//
//  DragGestureState.swift of MijickPopups
//
//  Created by Alina Petrovska
//    - Mail: alina.petrovskaya@mijick.com
//    - GitHub: https://github.com/alina-p-k
//
//  Copyright ©2025 Mijick. All rights reserved.
		

import SwiftUI

struct DragGestureState {
    let startLocationY: Double
    let height: Double 
}

extension DragGestureState {
    init(_ value: DragGesture.Value) {
        self.startLocationY = value.startLocation.y
        self.height = value.translation.height
    }
}

```

### Core Architecture Module: `Sources/Internal/Utilities/Logger.swift`
```
//
//  Logger.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import os

class Logger {}

// MARK: Log
extension Logger {
    static func log(level: OSLogType, message: String) {
        os.Logger().log(level: level, "ERROR!\n\nFRAMEWORK: MijickPopups\nDESCRIPTION: \(message)")
    }
}

```

### Core Architecture Module: `Sources/Internal/Utilities/PopupActionScheduler.swift`
```
//
//  PopupActionScheduler.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import Foundation

@MainActor
class PopupActionScheduler {
    private var time: Double = 0
    private var action: DispatchSourceTimer?
}

// MARK: Prepare
extension PopupActionScheduler {
    static func prepare(time: Double) -> PopupActionScheduler {
        let scheduler = PopupActionScheduler()
        scheduler.time = time
        return scheduler
    }
}

// MARK: Schedule
extension PopupActionScheduler {
    func schedule(action: @escaping () -> ()) {
        self.action = DispatchSource.makeTimerSource(queue: .main)
        self.action?.schedule(deadline: .now() + max(0.6, time))
        self.action?.setEventHandler(handler: action)
        self.action?.resume()
    }
}

```

### Core Architecture Module: `Sources/Internal/Utilities/PopupAlignment.swift`
```
//
//  PopupAlignment.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import SwiftUI

enum PopupAlignment {
    case top
    case center
    case bottom
}

// MARK: Initialize
extension PopupAlignment {
    init(_ config: LocalConfig.Type) { switch config.self {
        case is TopPopupConfig.Type: self = .top
        case is CenterPopupConfig.Type: self = .center
        case is BottomPopupConfig.Type: self = .bottom
        default: fatalError()
    }}
}

// MARK: Negation
extension PopupAlignment {
    static prefix func !(lhs: Self) -> Self { switch lhs {
        case .top: .bottom
        case .center: .center
        case .bottom: .top
    }}
}

// MARK: Type Casting
extension PopupAlignment {
    func toEdge() -> Edge { switch self {
        case .top: .top
        case .center: .bottom
        case .bottom: .bottom
    }}
    func toAlignment() -> Alignment { switch self {
        case .top: .top
        case .center: .center
        case .bottom: .bottom
    }}
}

```

### Core Architecture Module: `Sources/Public/Popup/Public+Popup+Utilities.swift`
```
//
//  Public+Popup+Utilities.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import Foundation

// MARK: Height Mode
public enum HeightMode: Sendable {
    /**
     Popup height is calculated based on its content.

     ## Visualisation
     ![image](https://github.com/Mijick/Assets/blob/main/Framework%20Docs/Popups/height-mode-auto.png?raw=true)

     - note: If the calculated height is greater than the screen height, the height mode will automatically be switched to ``large``.
     */
    case auto

    /**
     The popup has a fixed height, which is equal to the height of the screen minus the safe area and the height of the popups stack (if ``GlobalConfig/Vertical/enableStacking(_:)`` is enabled).

     ## Visualisation
     ![image](https://github.com/Mijick/Assets/blob/main/Framework%20Docs/Popups/height-mode-large.png?raw=true)
     */
    case large

    /**
     Fills the entire height of the screen, regardless of the height of the popup content.

     ## Visualisation
     ![image](https://github.com/Mijick/Assets/blob/main/Framework%20Docs/Popups/height-mode-fullscreen.png?raw=true)
     */
    case fullscreen
}

// MARK: Drag Detent
public enum DragDetent: Sendable {
    /**
     A detent with the specified height.

     ## Visualisation
     ![image](https://github.com/Mijick/Assets/blob/main/Framework%20Docs/Popups/drag-detent-height.png?raw=true)
     */
    case height(CGFloat)

    /**
     A detent with the specified fractional height.

     ## Visualisation
     ![image](https://github.com/Mijick/Assets/blob/main/Framework%20Docs/Popups/drag-detent-fraction.png?raw=true)
     */
    case fraction(CGFloat)

    /**
     A detent for a popup at large height.
     See ``HeightMode/large`` for more details.

     ## Visualisation
     ![image](https://github.com/Mijick/Assets/blob/main/Framework%20Docs/Popups/drag-detent-large.png?raw=true)
     */
    case large

    /**
     A detent for a popup at fullscreen height.
     See ``HeightMode/fullscreen`` for more details.

     ## Visualisation
     ![image](https://github.com/Mijick/Assets/blob/main/Framework%20Docs/Popups/drag-detent-fullscreen.png?raw=true)
     */
    case fullscreen
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version: 6.0
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "MijickPopups",
    platforms: [
        .iOS(.v14),
        .macOS(.v12),
        .tvOS(.v15),
        .watchOS(.v7),
        .visionOS(.v1)
    ],
    products: [
        .library(name: "MijickPopups", targets: ["MijickPopups"])
    ],
    targets: [
        .target(name: "MijickPopups", dependencies: [], path: "Sources"),
        .testTarget(name: "MijickPopupsTests", dependencies: ["MijickPopups"], path: "Tests")
    ],
    swiftLanguageModes: [.v6]
)

```

### Core Architecture Module: `Sources/Internal/Configurables/Global/GlobalConfig+Center.swift`
```
//
//  GlobalConfig+Center.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import SwiftUI

@MainActor
public final class GlobalConfigCenter: GlobalConfig { required public init() {}
    // MARK: Active Variables
    public var popupPadding: EdgeInsets = .init(top: 0, leading: 16, bottom: 0, trailing: 16)
    public var cornerRadius: CGFloat = 24
    public var backgroundColor: Color = .white
    public var overlayColor: Color = .black.opacity(0.5)
    public var isTapOutsideToDismissEnabled: Bool = false

    // MARK: Inactive Variables
    public var ignoredSafeAreaEdges: Edge.Set = []
    public var heightMode: HeightMode = .auto
    public var dragDetents: [DragDetent] = []
    public var isDragGestureEnabled: Bool = false
    public var dragThreshold: CGFloat = 0
    public var isStackingEnabled: Bool = false
    public var dragGestureAreaSize: CGFloat = 0
}

```

### Core Architecture Module: `Sources/Internal/Configurables/Global/GlobalConfig+Vertical.swift`
```
//
//  GlobalConfig+Vertical.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import SwiftUI

@MainActor
public final class GlobalConfigVertical: GlobalConfig { required public init() {}
    // MARK: Content
    public var popupPadding: EdgeInsets = .init()
    public var cornerRadius: CGFloat = 40
    public var backgroundColor: Color = .white
    public var overlayColor: Color = .black.opacity(0.5)
    public var isStackingEnabled: Bool = true

    // MARK: Gestures
    public var isTapOutsideToDismissEnabled: Bool = false
    public var isDragGestureEnabled: Bool = true
    public var dragThreshold: CGFloat = 1/3
    public var dragGestureAreaSize: CGFloat = 30

    // MARK: Non-Customizable
    public var ignoredSafeAreaEdges: Edge.Set = []
    public var heightMode: HeightMode = .auto
    public var dragDetents: [DragDetent] = []
}

```

### Core Architecture Module: `Sources/Internal/Configurables/Global/GlobalConfig.swift`
```
//
//  GlobalConfig.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import SwiftUI

@MainActor
public protocol GlobalConfig: LocalConfig {
    var dragThreshold: CGFloat { get set }
    var isStackingEnabled: Bool { get set }
}

```

### Core Architecture Module: `Sources/Internal/Configurables/Local/LocalConfig+Center.swift`
```
//
//  LocalConfig+Center.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import SwiftUI

@MainActor
public class LocalConfigCenter: LocalConfig { required public init() {}
    // MARK: Active Variables
    public var popupPadding: EdgeInsets = GlobalConfigContainer.center.popupPadding
    public var cornerRadius: CGFloat = GlobalConfigContainer.center.cornerRadius
    public var backgroundColor: Color = GlobalConfigContainer.center.backgroundColor
    public var overlayColor: Color = GlobalConfigContainer.center.overlayColor
    public var isTapOutsideToDismissEnabled: Bool = GlobalConfigContainer.center.isTapOutsideToDismissEnabled

    // MARK: Inactive Variables
    public var ignoredSafeAreaEdges: Edge.Set = GlobalConfigContainer.center.ignoredSafeAreaEdges
    public var heightMode: HeightMode = GlobalConfigContainer.center.heightMode
    public var dragDetents: [DragDetent] = GlobalConfigContainer.center.dragDetents
    public var isDragGestureEnabled: Bool = GlobalConfigContainer.center.isDragGestureEnabled
    public var dragGestureAreaSize: CGFloat = GlobalConfigContainer.center.dragGestureAreaSize
}

```

### Core Architecture Module: `Sources/Internal/Configurables/Local/LocalConfig+Vertical.swift`
```
//
//  LocalConfig+Vertical.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import SwiftUI

@MainActor
public class LocalConfigVertical: LocalConfig { required public init() {}
    // MARK: Content
    public var popupPadding: EdgeInsets = GlobalConfigContainer.vertical.popupPadding
    public var cornerRadius: CGFloat = GlobalConfigContainer.vertical.cornerRadius
    public var ignoredSafeAreaEdges: Edge.Set = GlobalConfigContainer.vertical.ignoredSafeAreaEdges
    public var backgroundColor: Color = GlobalConfigContainer.vertical.backgroundColor
    public var overlayColor: Color = GlobalConfigContainer.vertical.overlayColor
    public var heightMode: HeightMode = GlobalConfigContainer.vertical.heightMode
    public var dragDetents: [DragDetent] = GlobalConfigContainer.vertical.dragDetents

    // MARK: Gestures
    public var isTapOutsideToDismissEnabled: Bool = GlobalConfigContainer.vertical.isTapOutsideToDismissEnabled
    public var isDragGestureEnabled: Bool = GlobalConfigContainer.vertical.isDragGestureEnabled
    public var dragGestureAreaSize: CGFloat = GlobalConfigContainer.vertical.dragGestureAreaSize
}

// MARK: Subclasses
public extension LocalConfigVertical {
    class Top: LocalConfigVertical {}
    class Bottom: LocalConfigVertical {}
}

```

### Core Architecture Module: `Sources/Internal/Configurables/Local/LocalConfig.swift`
```
//
//  LocalConfig.swift of MijickPopups
//
//  Created by Tomasz Kurylik. Sending ❤️ from Kraków!
//    - Mail: tomasz.kurylik@mijick.com
//    - GitHub: https://github.com/FulcrumOne
//    - Medium: https://medium.com/@mijick
//
//  Copyright ©2024 Mijick. All rights reserved.


import SwiftUI

@MainActor
public protocol LocalConfig { init()
    // MARK: Content
    var popupPadding: EdgeInsets { get set }
    var cornerRadius: CGFloat { get set }
    var ignoredSafeAreaEdges: Edge.Set { get set }
    var backgroundColor: Color { get set }
    var overlayColor: Color { get set }
    var heightMode: HeightMode { get set }
    var dragDetents: [DragDetent] { get set }

    // MARK: Gestures
    var isTapOutsideToDismissEnabled: Bool { get set }
    var isDragGestureEnabled: Bool { get set }
    var dragGestureAreaSize: CGFloat { get set }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #189** (2025-10-22): **[BUG] Can not dismiss `CenterPopoup` on iOS 26**
  *Symptoms*: ## Prerequisites - [x] I checked the [documentation](https://github.com/Mijick/Popups/wiki) and found no answer - [x] I checked to make sure that this issue has not already been filed  ## Expected Behavior Can dismiss `CenterPopoup` on iOS 26  ## Current Behavior Can not `CenterPopoup` on iOS 26
  **Post-Mortem & Fix Analysis**:
  > And the buttons in the popup cannot be clicked.
  > isTapOutsideToDismissEnabled must be true.  Because these code:  ``` func hitTest_iOS26(_ point: CGPoint, with event: UIEvent?) -> UIView? {         guard let rootView = self.rootViewController?.view else { return nil }                  let pointInRootView = self.convert(point, to: rootView)         let hitView = rootView.hitTest(pointInRootView, with: event)         let isTapOutsideToDismissEnabled = PopupStackContainer.stacks.first?.popups.last?.config.isTapOutsideToDismissEnabled ?? false                  if hitView == rootView || hitView == nil { return isTapOutsideToDismissEnabled ? rootView : nil }         return hitView     } ```
  > Hello As I understood you are working with Popup through the SceneDelegate  Centre popup dismiss is off by default.  So you have to enable it.   You can do it in 2 ways:   1. In global settings inside the SceneDelegate   ``` class MyDelegate: PopupSceneDelegate {     override init() { super.init()         configBuilder = { $0             .center {                 $0                   .tapOutsideToDismissPopup(true)             }         }     } } ```  Or directly inside the specific view   ``` func configurePopup(config: CenterPopupConfig) -> CenterPopupConfig {         config             .cornerRadius(20)             .tapOutsideToDismissPopup(true)     } ```  This action also fixes the problem with the button taps inside the view.  I'll try to fix it, but I have also a lot of other job to do. So I can't promise that it will be fast.  

- **Issue #187** (2025-10-22): **[BUG] Keyboard not display automatically when set @FocusState**
  *Symptoms*: ## Prerequisites - [x] I checked the [documentation](https://github.com/Mijick/Popups/wiki) and found no answer - [x] I checked to make sure that this issue has not already been filed  ## Expected Behavior Show keyboard automatically when set `@FocusState` to true  ## Current Behavior After set `@FocusState`, the cursor is blinking, but keyboard not display. I must tap the `TextField`.  ## Code Sample  I'm using `SceneDelegate` to set up MijickPopups  ```swift import MijickPopups import SwiftUI  struct EditPopup: BottomPopup {   @State private var notes = ""   @FocusState private var isFocused      func configurePopup(config: LocalConfigVertical.Bottom) -> LocalConfigVertical.Bottom {     return config.enableDragGesture(false)   }    var body: some View {     VStack {       TextField(         "short_description_placeholder",         text: $notes,         axis: .vertical       )       .focused($isFocused)       .lineLimit(3, reservesSpace: true)     }     .onAppear {       Task {         try? await Task.sleep(for: .seconds(2))         isFocused = true       }     }   } }  ```  ## Context Please provide any relevant information about your setup. This is important in case the issue is not reproducible except for under certain conditions.  | Name | Version | | ------| ---------| | Xcode | 16.2 | | Operating System | iOS 18.5 | | Device | iPhone 15 | 
  **Post-Mortem & Fix Analysis**:
  > Resolved in release https://github.com/Mijick/Popups/releases/tag/4.0.4 Documentation link https://github.com/Mijick/Popups/wiki/Setup#key-window-state-management

- **Issue #185** (2025-10-12): **[BUG] Doesn't build with Xcode 26 Beta 2**
  *Symptoms*: ## Prerequisites - [x] I checked the [documentation](https://github.com/Mijick/Popups/wiki) and found no answer - [x] I checked to make sure that this issue has not already been filed  ## Expected Behavior Build with Xcode 26  ## Current Behavior Unable to build with Xcode 26  ## Steps to Reproduce Add this package to a custom 'Components' package with strict swift concurrency settings: `  swiftSettings: [                 .defaultIsolation(MainActor.self),                 .strictMemorySafety()             ]`  ## Code Sample No code needed  ## Screenshots ![Image](https://github.com/user-attachments/assets/d15e6ccd-428d-4049-b446-2574d43428d0)  ## Context Please provide any relevant information about your setup. This is important in case the issue is not reproducible except for under certain conditions.  | Name | Version | | ------| ---------| | SDK | e.g. 4.0.1 | | Xcode | e.g. 26.0 Beta 2 | | Operating System | e.g. iOS 26.0 | | Device | e.g. iPhone 16 Pro Max | 
  **Post-Mortem & Fix Analysis**:
  > I am not sure if this is Xcode bug, because ideally it should build even if its unsafe.. But I tried almost every trick in my toolbox and nothing worked
  > struct AnyPopup: Popup, @unchecked Sendable {     // ...existing code... }  this is what copilot suggested  Recommended fix: Add @unchecked Sendable conformance to AnyPopup if you are sure all its properties are safe to send across concurrency domains (e.g., they are value types or thread-safe):
  > struct AnyPopup: Popup, Sendable {      init<P: Popup & Sendable>(_ popup: P) async {  these 2 lines and it builds

- **Issue #184** (2025-10-22): **[BUG] ScrollView not scrollable inside BottomPopup when drag gesture is enabled**
  *Symptoms*: ## Prerequisites - [x] I checked the [documentation](https://github.com/Mijick/Popups/wiki) and found no answer - [x] I checked to make sure that this issue has not already been filed  ## Expected Behavior The content inside the bottom popup should be vertically scrollable when the content height exceeds the popup's available space. Users should be able to scroll through a long list of items within the popup  ## Current Behavior The content inside the bottom popup cannot be scrolled vertically. The ScrollView appears to be non-functional, preventing users from accessing items that are below the visible area of the popup  ## Steps to Reproduce 1. Present the popup 2. Try to scroll vertically through the list content 3. Observe that the content does not scroll, making lower items inaccessible   ## Code Sample  ## Screenshots If applicable, add screenshots to help explain your problem.  ## Context Please provide any relevant information about your setup. This is important in case the issue is not reproducible except for under certain conditions.  | Name | Version | ---- SDK | 4.0.1 -- | -- Xcode | 15.0+ Operating System | iOS 16.0+ Device | iPhone (all sizes tested) SwiftUI | iOS 16.0+   
  **Post-Mortem & Fix Analysis**:
  > @FulcrumOne Hi，Do you have any plans to check this issue recently?
  > @FulcrumOne Hi, do you have any update on this issue?
  > Issue has been resolved in release https://github.com/Mijick/Popups/releases/tag/4.0.5

- **Issue #182** (2025-10-12): **[BUG] iOS 26 is not compatible**
  *Symptoms*: ## Prerequisites - [x] I checked the [documentation](https://github.com/Mijick/Popups/wiki) and found no answer - [x] I checked to make sure that this issue has not already been filed  ## Expected Behaviour The popups should be able to be interacted with. I.e. when the user clicks outside the popup it should dismiss and the user can click the buttons on the popup.  ## Current Behaviour The popup appears but is not intractable at all. The popup cannot be dismissed when shown and the only fix is to restart the app.  ## Steps to Reproduce Display a simple pop on iOS 26.   | Name | Version | | ------| ---------| | Xcode | e.g. 26.0 | | Operating System | e.g. iOS 26.0 | | Device | iPhone 14 Pro | 
  **Post-Mortem & Fix Analysis**:
  > looks like this project is abandoned now
  > it appears like there is a possible fix for this bug, (fixed by #183).   @FulcrumOne, is there any chance it being merged or at least reviewed?
  > > looks like this projects is abandoned now  Yup, which is sad. I created a PR that fixes this issue though: https://github.com/Mijick/Popups/pull/183

- **Issue #167** (2024-12-19): **[BUG] Fatal error: Unexpectedly found nil while implicitly unwrapping an Optional value for `updatePopupAction`**
  *Symptoms*: ## Prerequisites - [x] I checked the [documentation](https://github.com/Mijick/Popups/wiki) and found no answer - [x] I checked to make sure that this issue has not already been filed  ## Steps to Reproduce Please provide detailed steps for reproducing the issue.  I tried to implement the exact same structure as shown in the documentation, but the app crashed.  ## Code Sample If you can, please include a code sample that we can use to debug the bug.  From framework's ViewModel: ``` func updatePopupHeight(_ heightCandidate: CGFloat, _ popup: AnyPopup) async {         guard activePopupProperties.gestureTranslation == 0 else { return }          let newHeight = await calculatePopupHeight(heightCandidate, popup)         if newHeight != popup.height {             await updatePopupAction(popup.updatedHeight(newHeight))         }     } ```  | Name | Version | | ------| ---------| | Xcode | Version 16.2 (16C5032a) | | Operating System | iOS 18.1 | | Device | iPhone 16 Pro | 
  **Post-Mortem & Fix Analysis**:
  > Ah, alright. The issue was that I registered popups twice: once under the @main structure in the App and again in the AppDelegate with the scene 🙈  Once I removed it from AppDelegate all works fine. Shall we close the issue?
  > Hey @mattisssa,  I decided to protect the library against such situations and implemented support for this in patch 4.0.1.  Have a nice day, Tomasz
  > Awesome, thanks!

- **Issue #162** (2024-12-19): **[BUG] Still Crashes on 4.0.0 pre iOS 17**
  *Symptoms*: Updated to 3.0.0 and 4.0.0 and the popup still crashes for iOS 16 and below  iOS 17 and iOS 18 work fine  ``` // MARK: Popup Height extension ViewModel {     func updatePopupHeight(_ heightCandidate: CGFloat, _ popup: AnyPopup) async {         guard activePopupProperties.gestureTranslation == 0 else { return }          let newHeight = await calculatePopupHeight(heightCandidate, popup)         if newHeight != popup.height {             await updatePopupAction(popup.updatedHeight(newHeight))         }     } } ```  Thread 1: Fatal error: Unexpectedly found nil while implicitly unwrapping an Optional value  crashes on the line: **await updatePopupAction(popup.updatedHeight(newHeight))**  for centre and bottom popups   Printing description of newHeight: 0.0 Printing description of heightCandidate: 319.0 Printing description of popup.height: nil  Same popus didnt crash pre 3.0.0 
  **Post-Mortem & Fix Analysis**:
  > Hey @bukira,  Thanks for letting me know. Could you please show me the part of the code where you call the `.registerPopups()` method, as a similar issue was recently created (#158) and I wonder if this is somehow related.   Thanks again for your help, Tomasz
  >    Yes certainly   ```  var body: some Scene {         WindowGroup {             RootView()                 .registerPopups()                 .logRender("RootView")         }         .onChange(of: phase) { newPhase in             switch newPhase {             case .active:                 activePhase() //App became active             case .inactive:                 inactivePhase() //App became inactive             case .background:                 backgroundPhase() //App is running in the background no UI             @unknown default: break                 //Fallback for future cases             }         }     } ```  ``` @main struct App: App {          @Environment(\.scenePhase) private var phase          @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate          init() {         setupFirebase()         setupConfig()         setupDependencies()         setupAppearance()         setupPageControl()     }          var body: some Sce
  > @bukira, could you, for testing purposes comment out ``@Environment(`.scenePhase) private var phase`` and see if the crash still occurs? If not, I think I know how I can fix it

- **Issue #158** (2024-11-17): **[BUG] When editing the TextField, a Popup error occurs: "Thread 1: Fatal error: Unexpectedly found nil while implicitly unwrapping an Optional value"**
  *Symptoms*: ``` import SwiftUI import MijickPopups   @main struct TestApp: App {     @StateObject var viewModel:TestViewModel = TestViewModel()     var body: some Scene {         WindowGroup {             ContentView()                 .registerPopups()                 .environmentObject(viewModel)         }     } }  class TestViewModel:ObservableObject{     @Published var text: String = "" }   struct ContentView: View {     var body: some View {         NavigationStack{             List{                 NavigationLink {                     NextView()                 } label: {                     Text("Next")                 }             }         }     } }    struct NextView:View {     @EnvironmentObject var viewModel:TestViewModel     @FocusState private var isInputFocused:Bool     var body: some View{         List{             /// When editing the TextField, a Popup error occurs: "Thread 1: Fatal error: Unexpectedly found nil while implicitly unwrapping an Optional value"             TextField("Edit Text", text: $viewModel.text,onCommit: {                 isInputFocused = false             })             .focused($isInputFocused)                          Button {                 isInputFocused = false                 Popup().present()             } label: {                 Text("Test Popup")             }         }     } }     struct Popup:BottomPopup {     var body: some View{         Text("Test")             .padding(
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The branch `patch-4.0.0` should be finished by Saturday, and the problem should be resolved there. I'll let you know once you can test it.  Have a great day, T.K.
  > Thank you for the update. I will keep an eye on the patch-4.0.0 branch, and I’ll proceed with testing once it’s ready on Saturday. Have a great day, too, T.K.!
  > Hey @snow-xf,  The problem should be fixed in the `patch-4.0.0` branch - I would be very grateful if you could confirm this.  Have a great day, Tomasz

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

### Incident Patch 1: `e126d5c2` (2023-12-30)
**Commit Message**: BUGFIX

fix:
- Fixed a problem with displaying centre popups in iOS 14

**File**: `Sources/Internal/Views/PopupCentreStackView.swift` (modified, +16/-5)
```diff
@@ -34,6 +34,13 @@ struct PopupCentreStackView: PopupStack {
 
 private extension PopupCentreStackView {
     func createPopup() -> some View {
+        if #available(iOS 15, *) { return createPopupForNewPlatforms() }
+        else { return createPopupForOlderPlatforms() }
+    }
+}
+
+private extension PopupCentreStackView {
+    func createPopupForNewPlatforms() -> some View {
         activeView?
             .readHeight(onChange: saveHeight)
             .frame(height: height).frame(maxWidth: .infinity)
@@ -43,16 +50,20 @@ private extension PopupCentreStackView {
             .compositingGroup()
             .focusSectionIfAvailable()
     }
+    func createPopupForOlderPlatforms() -> some View {
+        items.last?.body
+            .readHeight(onChange: saveHeight)
+            .frame(height: height).frame(maxWidth: .infinity)
+            .background(backgroundColour, overlayColour: .clear, radius: cornerRadius, corners: .allCorners, shadow: popupShadow)
+            .padding(.horizontal, lastPopupConfig.horizontalPadding)
+            .compositingGroup()
+            .focusSectionIfAvailable()
+    }
 }
 
 // MARK: - Logic Modifiers
 private extension PopupCentreStackView {
     func onItemsChange(_ items: [AnyPopup<CentrePopupConfig>]) {
-        handlePopupChange(items)
-    }
-}
-private extension PopupCentreStackView {
-    func handlePopupChange(_ items: [AnyPopup<CentrePopupConfig>]) {
         guard let popup = items.last else { return handleClosingPopup() }
 
         showNewPopup(popup)
```

---

### Incident Patch 2: `d8d93693` (2023-11-26)
**Commit Message**: BUGFIX

fix:
- Fixed an issue with incorrectly calculated safe area size on iPhones

**File**: `MijickPopupView.podspec` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ Pod::Spec.new do |s|
   PopupView is a free and open-source library dedicated for SwiftUI that makes the process of presenting popups easier and much cleaner.
                                DESC
   
-  s.version               = '2.2.0'
+  s.version               = '2.2.1'
   s.ios.deployment_target = '14.0'
   s.osx.deployment_target = '12.0'
   s.swift_version         = '5.0'
```

**File**: `Sources/Internal/Managers/ScreenManager.swift` (modified, +5/-1)
```diff
@@ -20,7 +20,7 @@ class ScreenManager: ObservableObject {
     private var subscription: [AnyCancellable] = []
 
     static let shared: ScreenManager = .init()
-    private init() { subscribeToScreenOrientationChangeEvents() }
+    private init() { subscribeToScreenOrientationChangeEvents(); updateScreenDetails() }
 }
 
 private extension ScreenManager {
@@ -31,6 +31,10 @@ private extension ScreenManager {
             .sink(receiveValue: updateScreenValues)
             .store(in: &subscription)
     }
+    func updateScreenDetails() { DispatchQueue.main.async {
+        self.size = UIScreen.size
+        self.safeArea = UIScreen.safeArea
+    }}
 }
 private extension ScreenManager {
     func updateScreenValues(_ value: NotificationCenter.Publisher.Output) {
```

---

### Incident Patch 3: `a579ddd4` (2023-11-03)
**Commit Message**: New Features + Bug Fixes

feat:
- Added the option to hide overlay for a certain popup
- Added the ability to apply a shadow to a popup

fix:
- Fixed a problem with the incorrect placement of popups of different types
- Fixed a problem with incorrectly calculated popup sizes

**File**: `MijickPopupView.podspec` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ Pod::Spec.new do |s|
   PopupView is a free and open-source library dedicated for SwiftUI that makes the process of presenting popups easier and much cleaner.
                                DESC
   
-  s.version               = '2.1.1'
+  s.version               = '2.2.0'
   s.ios.deployment_target = '14.0'
   s.osx.deployment_target = '12.0'
   s.swift_version         = '5.0'
```

**File**: `Sources/Internal/Managers/PopupManager.swift` (modified, +6/-6)
```diff
@@ -13,6 +13,7 @@ import SwiftUI
 public class PopupManager: ObservableObject {
     @Published private(set) var views: [any Popup] = []
     private(set) var presenting: Bool = true
+    private(set) var popupsWithoutOverlay: [String] = []
 
     static let shared: PopupManager = .init()
     private init() {}
@@ -33,14 +34,13 @@ extension PopupManager {
         updateOperationType(operation)
         shared.views.perform(operation)
     }}
+    static func hideOverlay(_ popup: any Popup) { shared.popupsWithoutOverlay.append(popup.id) }
 }
 private extension PopupManager {
-    static func updateOperationType(_ operation: StackOperation) {
-        switch operation {
-            case .insertAndReplace, .insertAndStack: shared.presenting = true
-            case .removeLast, .remove, .removeAllUpTo, .removeAll: shared.presenting = false
-        }
-    }
+    static func updateOperationType(_ operation: StackOperation) { switch operation {
+        case .insertAndReplace, .insertAndStack: shared.presenting = true
+        case .removeLast, .remove, .removeAllUpTo, .removeAll: shared.presenting = false
+    }}
 }
 
 fileprivate extension [any Popup] {
```

**File**: `Sources/Internal/Managers/ScreenManager.swift` (modified, +9/-2)
```diff
@@ -65,10 +65,17 @@ class ScreenManager: ObservableObject {
     private var subscription: [AnyCancellable] = []
 
     static let shared: ScreenManager = .init()
-    private init() { subscribeToWindowSizeChangeEvents() }
+    private init() { subscribeToWindowUpdateEvents(); subscribeToWindowSizeChangeEvents() }
 }
 
 private extension ScreenManager {
+    func subscribeToWindowUpdateEvents() {
+        NotificationCenter.default
+            .publisher(for: NSWindow.didUpdateNotification)
+            .receive(on: DispatchQueue.main)
+            .sink(receiveValue: updateScreenValues)
+            .store(in: &subscription)
+    }
     func subscribeToWindowSizeChangeEvents() {
         NotificationCenter.default
             .publisher(for: NSWindow.didResizeNotification)
@@ -90,7 +97,7 @@ fileprivate extension NSScreen {
             .mainWindow?
             .contentView?
             .safeAreaInsets ?? .init(top: 0, left: 0, bottom: 0, right: 0)
-    static var size: CGSize = NSApplication.shared.mainWindow?.frame.size ?? .zero
+    static var size: CGSize = NSScreen.main?.visibleFrame.size ?? .zero
     static var cornerRadius: CGFloat = 0
 }
 
```

**File**: `Sources/Internal/Other/Shadow.swift` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+//
+//  Shadow.swift of PopupView
+//
+//  Created by Tomasz Kurylik
+//    - Twitter: https://twitter.com/tkurylik
+//    - Mail: tomasz.kurylik@mijick.com
+//    - GitHub: https://github.com/FulcrumOne
+//
+//  Copyright ©2023 Mijick. Licensed under MIT License.
+
+
+import SwiftUI
+
+struct Shadow {
+    let color: Color
+    let radius: CGFloat
+    let x: CGFloat
+    let y: CGFloat
+}
+extension Shadow {
+    static var none: Self { .init(color: .clear, radius: 0, x: 0, y: 0) }
+}
```

**File**: `Sources/Internal/View Modifiers/RoundedCorner.swift` (modified, +7/-3)
```diff
@@ -11,11 +11,15 @@
 import SwiftUI
 
 extension View {
-    func background(_ backgroundColour: Color, overlayColour: Color, radius: CGFloat, corners: RectCorner) -> some View {
-        overlay(RoundedCorner(radius: radius, corners: corners).fill(overlayColour))
-            .background(RoundedCorner(radius: radius, corners: corners).fill(backgroundColour))
+    func background(_ backgroundColour: Color, overlayColour: Color, radius: CGFloat, corners: RectCorner, shadow: Shadow) -> some View {
+        overlay(createRoundedCorner(overlayColour, radius, corners))
+            .background(createRoundedCorner(backgroundColour, radius, corners).createShadow(shadow))
     }
 }
+private extension View {
+    func createRoundedCorner(_ colour: Color, _ radius: CGFloat, _ corners: RectCorner) -> some View { RoundedCorner(radius: radius, corners: corners).fill(colour) }
+    func createShadow(_ shadowAttributes: Shadow) -> some View { shadow(color: shadowAttributes.color, radius: shadowAttributes.radius, x: shadowAttributes.x, y: shadowAttributes.y) }
+}
 
 // MARK: - Implementation
 fileprivate struct RoundedCorner: Shape {
```

**File**: `Sources/Internal/Views/PopupBottomStackView.swift` (modified, +2/-1)
```diff
@@ -44,7 +44,7 @@ private extension PopupBottomStackView {
             .fixedSize(horizontal: false, vertical: getFixedSize(item))
             .readHeight { saveHeight($0, withAnimation: transitionEntryAnimation, for: item) }
             .frame(height: height, alignment: .top).frame(maxWidth: .infinity)
-            .background(getBackgroundColour(for: item), overlayColour: getStackOverlayColour(item), radius: getCornerRadius(item), corners: getCorners())
+            .background(getBackgroundColour(for: item), overlayColour: getStackOverlayColour(item), radius: getCornerRadius(item), corners: getCorners(), shadow: popupShadow)
             .padding(.horizontal, popupHorizontalPadding)
             .offset(y: getOffset(item))
             .scaleEffect(getScale(item), anchor: .top)
@@ -117,6 +117,7 @@ private extension PopupBottomStackView {
 extension PopupBottomStackView {
     var popupBottomPadding: CGFloat { lastPopupConfig.popupPadding.bottom }
     var popupHorizontalPadding: CGFloat { lastPopupConfig.popupPadding.horizontal }
+    var popupShadow: Shadow { globalConfig.bottom.shadow }
     var height: CGFloat { heights.first { $0.key == items.last }?.value ?? (lastPopupConfig.contentFillsEntireScreen ? screen.size.height : getInitialHeight()) }
     var maxHeight: CGFloat { getMaxHeight() - popupBottomPadding }
     var distanceFromKeyboard: CGFloat { lastPopupConfig.distanceFromKeyboard ?? globalConfig.bottom.distanceFromKeyboard }
```

**File**: `Sources/Internal/Views/PopupCentreStackView.swift` (modified, +2/-1)
```diff
@@ -38,7 +38,7 @@ private extension PopupCentreStackView {
             .readHeight(onChange: saveHeight)
             .frame(height: height).frame(maxWidth: .infinity)
             .opacity(contentOpacity)
-            .background(backgroundColour, overlayColour: .clear, radius: cornerRadius, corners: .allCorners)
+            .background(backgroundColour, overlayColour: .clear, radius: cornerRadius, corners: .allCorners, shadow: popupShadow)
             .padding(.horizontal, lastPopupConfig.horizontalPadding)
             .compositingGroup()
             .focusSectionIfAvailable()
@@ -88,6 +88,7 @@ private extension PopupCentreStackView {
 extension PopupCentreStackView {
     var cornerRadius: CGFloat { lastPopupConfig.cornerRadius ?? globalConfig.centre.cornerRadius }
     var contentOpacity: CGFloat { contentIsAnimated ? 0 : 1 }
+    var popupShadow: Shadow { globalConfig.centre.shadow }
     var contentOpacityAnimationTime: CGFloat { globalConfig.centre.contentAnimationTime }
     var backgroundColour: Color { lastPopupConfig.backgroundColour ?? globalConfig.centre.backgroundColour }
 
```

**File**: `Sources/Internal/Views/PopupTopStackView.swift` (modified, +2/-1)
```diff
@@ -42,7 +42,7 @@ private extension PopupTopStackView {
             .padding(.trailing, screen.safeArea.right)
             .readHeight { saveHeight($0, for: item) }
             .frame(height: height).frame(maxWidth: .infinity)
-            .background(getBackgroundColour(for: item), overlayColour: getStackOverlayColour(item), radius: getCornerRadius(item), corners: getCorners())
+            .background(getBackgroundColour(for: item), overlayColour: getStackOverlayColour(item), radius: getCornerRadius(item), corners: getCorners(), shadow: popupShadow)
             .padding(.horizontal, lastPopupConfig.popupPadding.horizontal)
             .offset(y: getOffset(item))
             .scaleEffect(getScale(item), anchor: .bottom)
@@ -91,6 +91,7 @@ private extension PopupTopStackView {
 extension PopupTopStackView {
     var contentTopPadding: CGFloat { lastPopupConfig.contentIgnoresSafeArea ? 0 : max(screen.safeArea.top - popupTopPadding, 0) }
     var popupTopPadding: CGFloat { lastPopupConfig.popupPadding.top }
+    var popupShadow: Shadow { globalConfig.top.shadow }
     var height: CGFloat { heights.first { $0.key == items.last }?.value ?? getInitialHeight() }
     var cornerRadius: CGFloat { lastPopupConfig.cornerRadius ?? globalConfig.top.cornerRadius }
 
```

---

### Incident Patch 4: `cb84ea72` (2023-10-07)
**Commit Message**: BUGFIX

**File**: `MijickPopupView.podspec` (renamed, +2/-2)
```diff
@@ -1,11 +1,11 @@
 Pod::Spec.new do |s|
-  s.name                  = 'Mijick_PopupView'
+  s.name                  = 'MijickPopupView'
   s.summary               = 'Popups presentation made simple'
   s.description           = <<-DESC
   PopupView is a free and open-source library dedicated for SwiftUI that makes the process of presenting popups easier and much cleaner.
                                DESC
   
-  s.version               = '2.1.0'
+  s.version               = '2.1.1'
   s.ios.deployment_target = '14.0'
   s.osx.deployment_target = '12.0'
   s.swift_version         = '5.0'
```

**File**: `README.md` (modified, +5/-2)
```diff
@@ -43,7 +43,7 @@
 </p>
 
 <p align="center">
-    <img alt="Popup Examples" src="https://github.com/Mijick/PopupView/assets/23524947/593d81ff-c3ec-4784-b92a-7e3181156576"/>
+    <img alt="Popup Examples" src="https://github.com/Mijick/Assets/blob/main/PopupView/GIFs/PopupView.gif"/>
 </p>
 
 <br>
@@ -90,7 +90,7 @@ Installation steps:
 ```
 - Add CocoaPods dependency into your `Podfile`   
 ```Swift
-    pod 'Mijick_PopupView'
+    pod 'MijickPopupView'
 ```
 - Install dependency and generate `.xcworkspace` file
 ```Swift
@@ -213,6 +213,8 @@ PopupView is released under the MIT license. See [LICENSE][License] for details.
 [Navigattie] - Easier and cleaner way of navigating through your app
 <br>
 [GridView] - Lay out your data with no effort
+<br>
+[Timer] - Modern API for Timer
 
 
 [MIT]: https://en.wikipedia.org/wiki/MIT_License
@@ -227,3 +229,4 @@ PopupView is released under the MIT license. See [LICENSE][License] for details.
 
 [Navigattie]: https://github.com/Mijick/Navigattie 
 [GridView]: https://github.com/Mijick/GridView
+[Timer]: https://github.com/Mijick/Timer
```

**File**: `Sources/Public/Extensions/Public+Popup.swift` (modified, +2/-6)
```diff
@@ -13,14 +13,10 @@ import SwiftUI
 // MARK: - Presenting
 public extension Popup {
     /// Displays the popup. Stacks previous one
-    func showAndStack() { PopupManager.showAndStack(AnyPopup<Config>(self)) }
-    /// Displays the popup. Stacks previous one
-    func showAndStack() -> some Popup { PopupManager.showAndStack(AnyPopup<Config>(self)); return self }
+    @discardableResult func showAndStack() -> some Popup { PopupManager.showAndStack(AnyPopup<Config>(self)); return self }
 
     /// Displays the popup. Closes previous one
-    func showAndReplace() { PopupManager.showAndReplace(AnyPopup<Config>(self)) }
-    /// Displays the popup. Closes previous one
-    func showAndReplace() -> some Popup { PopupManager.showAndReplace(AnyPopup<Config>(self)); return self }
+    @discardableResult func showAndReplace() -> some Popup { PopupManager.showAndReplace(AnyPopup<Config>(self)); return self }
 
     /// Closes popup after n seconds
     func dismissAfter(_ seconds: Double) { DispatchQueue.main.asyncAfter(deadline: .now() + max(0.5, seconds)) {
```

---

### Incident Patch 5: `0ff4bd6c` (2023-09-16)
**Commit Message**: New Features + Bug Fixes

feat:
- Added a possibility to close popup after n time

refactor:
- Please use MijickPopupView instead of PopupView when importing the library in your project
- Moved dismiss popup methods to VIEW extension

docs:
- Documentation updated

fix:
- Fixed Problem with Scrollable Content

**File**: `Mijick_PopupView.podspec` (modified, +2/-2)
```diff
@@ -5,12 +5,12 @@ Pod::Spec.new do |s|
   PopupView is a free and open-source library dedicated for SwiftUI that makes the process of presenting popups easier and much cleaner.
                                DESC
   
-  s.version               = '2.0.0'
+  s.version               = '2.1.0'
   s.ios.deployment_target = '14.0'
   s.osx.deployment_target = '12.0'
   s.swift_version         = '5.0'
   
-  s.source_files          = 'Sources/PopupView/**/*'
+  s.source_files          = 'Sources/**/*'
   s.frameworks            = 'SwiftUI', 'Foundation', 'Combine'
   
   s.homepage              = 'https://github.com/Mijick/PopupView.git'
```

**File**: `Package.swift` (modified, +3/-3)
```diff
@@ -4,17 +4,17 @@
 import PackageDescription
 
 let package = Package(
-    name: "PopupView",
+    name: "MijickPopupView",
     platforms: [
         .iOS(.v14),
         .macOS(.v12),
         .tvOS(.v15)
     ],
     products: [
-        .library(name: "PopupView", targets: ["PopupView"])
+        .library(name: "MijickPopupView", targets: ["MijickPopupView"])
     ],
     targets: [
-        .target(name: "PopupView", dependencies: [])
+        .target(name: "MijickPopupView", dependencies: [], path: "Sources")
     ],
     swiftLanguageVersions: [.v5]
 )
```

**File**: `README.md` (modified, +24/-20)
```diff
@@ -2,9 +2,9 @@
 
 <p align="center">
   <picture> 
-    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/23524947/229163179-2033f875-f9cc-46ea-8d27-3a8a04007824.svg">
-    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/23524947/229172729-dd4fec15-8f90-4ca8-b59c-7ee109da7370.svg">
-    <img alt="PopupView Logo" src="https://user-images.githubusercontent.com/23524947/229163179-2033f875-f9cc-46ea-8d27-3a8a04007824.svg" width="88%"">
+    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Mijick/Assets/blob/main/PopupView/Logotype/On%20Dark.svg">
+    <source media="(prefers-color-scheme: light)" srcset="https://github.com/Mijick/Assets/blob/main/PopupView/Logotype/On%20Light.svg">
+    <img alt="PopupView Logo" src="https://github.com/Mijick/Assets/blob/main/PopupView/Logotype/On%20Dark.svg" width="76%"">
   </picture>
 </p>
 
@@ -17,30 +17,29 @@
 </p>
 
 <p align="center">
-    <a href="https://github.com/Mijick/PopupView-Example" rel="nofollow">Try demo we prepared</a>
+    <a href="https://github.com/Mijick/PopupView-Demo" rel="nofollow">Try demo we prepared</a>
 </p>
 
 <br>
 
 <p align="center">
-    <img alt="SwiftUI logo" src="https://github.com/Mijick/PopupView/assets/23524947/4ad7cce0-3efc-473b-bc41-9512aab2b26d.svg"/>
-    <img alt="Platforms: iOS, iPadOS, macOS, tvOS" src="https://github.com/Mijick/PopupView/assets/23524947/83f8ebf0-c083-4690-8ce7-4117af7c2e8e.svg"/>
-    <img alt="Release: 2.0.0" src="https://github.com/Mijick/PopupView/assets/23524947/6d916616-ad05-4079-ba92-4dab8d7c14a8.svg"/>
-    <img alt="Compatible: Swift Package Manager, Cocoapods" src="https://github.com/Mijick/PopupView/assets/23524947/b54d3a61-1f4c-4a74-99d4-9b81418a70ae.svg"/>
-    <img alt="License: MIT" src="https://github.com/Mijick/PopupView/assets/23524947/e3e47658-8ccd-4532-8121-fbf15853e725.svg"/>
+    <img alt="SwiftUI logo" src="https://github.com/Mijick/Assets/blob/main/PopupView/Labels/Language.svg"/>
+    <img alt="Platforms: iOS, iPadOS, macOS, tvOS" src="https://github.com/Mijick/Assets/blob/main/PopupView/Labels/Platforms.svg"/>
+    <img alt="Current Version" src="https://github.com/Mijick/Assets/blob/main/PopupView/Labels/Version.svg"/>
+    <img alt="License: MIT" src="https://github.com/Mijick/Assets/blob/main/PopupView/Labels/License.svg"/>
 </p>
 
 <p align="center">
-    <a href="https://github.com/Mijick/PopupView/stargazers">
-        <img alt="Stargazers" src="https://github.com/Mijick/PopupView/assets/23524947/f58b4257-65f2-4a83-ab0a-5b6bc26fe773"/>
-    </a>                                                                                                              
+    <img alt="Made in Kraków" src="https://github.com/Mijick/Assets/blob/main/PopupView/Labels/Origin.svg"/>
     <a href="https://twitter.com/MijickTeam">
-        <img alt="Follow us on Twitter" src="https://github.com/Mijick/PopupView/assets/23524947/26c8f5fc-1162-4721-a514-10ef17833021"/>
+        <img alt="Follow us on X" src="https://github.com/Mijick/Assets/blob/main/PopupView/Labels/X.svg"/>
     </a>
     <a href=mailto:team@mijick.com?subject=Hello>
-        <img alt="Let's work together" src="https://github.com/Mijick/PopupView/assets/23524947/4491418b-c831-41c7-b7fa-68ae9664a943"/>
-    </a>   
-    <img alt="Made in Kraków" src="https://github.com/Mijick/PopupView/assets/23524947/289bb4f8-6c0e-4e97-afb5-dae0b2688965.svg"/>
+        <img alt="Let's work together" src="https://github.com/Mijick/Assets/blob/main/PopupView/Labels/Work%20with%20us.svg"/>
+    </a>  
+    <a href="https://github.com/Mijick/PopupView/stargazers">
+        <img alt="Stargazers" src="https://github.com/Mijick/Assets/blob/main/PopupView/Labels/Stars.svg"/>
+    </a>                                                                                                               
 </p>
 
 <p align="center">
@@ -167,13 +166,15 @@ struct BottomCustomPopup: BottomPopup {
 ```
 
 ### 5. Present your popup from any place you want!
-Just call `BottomCustomPopup().showAndStack()` from the selected place
+Just call `BottomCustomPopup().showAndStack()` from the selected place. Popup can be closed automatically by adding the dismissAfter modifier.
 ```Swift
 struct SettingsViewModel {
     ...
     func saveSettings() {
         ...
-        BottomCustomPopup().showAndStack()
+        BottomCustomPopup()
+            .showAndStack()
+            .dismissAfter(5)
         ...
     }
     ...
@@ -210,16 +211,19 @@ PopupView is released under the MIT license. See [LICENSE][License] for details.
 
 # Our other open source SwiftUI libraries
 [Navigattie] - Easier and cleaner way of navigating through your app
+<br>
+[GridView] - Lay out your data with no effort
 
 
 [MIT]: https://en.wikipedia.org/wiki/MIT_License
 [SPM]: https://www.swift.org/package-manager
 
-[Demo]: https://github.com/Mijick/PopupView-Example
+[Demo]: https://github.com/Mijick/Po
```

**File**: `Sources/Internal/Views/PopupBottomStackView.swift` (renamed, +3/-2)
```diff
@@ -95,7 +95,7 @@ private extension PopupBottomStackView {
 
         if config.contentFillsEntireScreen { return heights[item] = screen.size.height }
         if config.contentFillsWholeHeight { return heights[item] = getMaxHeight() }
-        return heights[item] = min(height, getMaxHeight() - popupBottomPadding)
+        return heights[item] = min(height, maxHeight)
     }}
     func getMaxHeight() -> CGFloat {
         let basicHeight = screen.size.height - screen.safeArea.top
@@ -109,7 +109,7 @@ private extension PopupBottomStackView {
 
         return max(screen.safeArea.bottom - popupBottomPadding, 0)
     }
-    func getFixedSize(_ item: AnyPopup<BottomPopupConfig>) -> Bool { !(getConfig(item).contentFillsEntireScreen || getConfig(item).contentFillsWholeHeight) }
+    func getFixedSize(_ item: AnyPopup<BottomPopupConfig>) -> Bool { !(getConfig(item).contentFillsEntireScreen || getConfig(item).contentFillsWholeHeight || height == maxHeight) }
     func getBackgroundColour(for item: AnyPopup<BottomPopupConfig>) -> Color { item.configurePopup(popup: .init()).backgroundColour ?? globalConfig.bottom.backgroundColour }
 }
 
@@ -118,6 +118,7 @@ extension PopupBottomStackView {
     var popupBottomPadding: CGFloat { lastPopupConfig.popupPadding.bottom }
     var popupHorizontalPadding: CGFloat { lastPopupConfig.popupPadding.horizontal }
     var height: CGFloat { heights.first { $0.key == items.last }?.value ?? (lastPopupConfig.contentFillsEntireScreen ? screen.size.height : getInitialHeight()) }
+    var maxHeight: CGFloat { getMaxHeight() - popupBottomPadding }
     var distanceFromKeyboard: CGFloat { lastPopupConfig.distanceFromKeyboard ?? globalConfig.bottom.distanceFromKeyboard }
     var cornerRadius: CGFloat { let cornerRadius = lastPopupConfig.cornerRadius ?? globalConfig.bottom.cornerRadius; return lastPopupConfig.contentFillsEntireScreen ? min(cornerRadius, screen.cornerRadius ?? 0) : cornerRadius }
     var maxHeightStackedFactor: CGFloat { 0.85 }
```

**File**: `Sources/Public/Extensions/Public+Popup.swift` (renamed, +9/-13)
```diff
@@ -10,26 +10,22 @@
 
 import SwiftUI
 
-// MARK: - Presenting and Dismissing
+// MARK: - Presenting
 public extension Popup {
     /// Displays the popup. Stacks previous one
     func showAndStack() { PopupManager.showAndStack(AnyPopup<Config>(self)) }
+    /// Displays the popup. Stacks previous one
+    func showAndStack() -> some Popup { PopupManager.showAndStack(AnyPopup<Config>(self)); return self }
 
     /// Displays the popup. Closes previous one
     func showAndReplace() { PopupManager.showAndReplace(AnyPopup<Config>(self)) }
-}
-public extension Popup {
-    /// Dismisses the last popup on the stack
-    func dismiss() { PopupManager.dismiss() }
-
-    /// Dismisses all popups of the selected type on the stack
-    func dismiss<P: Popup>(_ popup: P.Type) { PopupManager.dismiss(popup) }
-
-    /// Dismisses all popups on the stack up to the popup with the selected type
-    func dismissAll<P: Popup>(upTo popup: P.Type) { PopupManager.dismissAll(upTo: popup) }
+    /// Displays the popup. Closes previous one
+    func showAndReplace() -> some Popup { PopupManager.showAndReplace(AnyPopup<Config>(self)); return self }
 
-    /// Dismisses all popups on the stack
-    func dismissAll() { PopupManager.dismissAll() }
+    /// Closes popup after n seconds
+    func dismissAfter(_ seconds: Double) { DispatchQueue.main.asyncAfter(deadline: .now() + max(0.5, seconds)) {
+        PopupManager.dismiss(Self.self)
+    }}
 }
 
 // MARK: - Available Popups
```

**File**: `Sources/Public/Extensions/Public+View.swift` (renamed, +15/-0)
```diff
@@ -22,6 +22,21 @@ public extension View {
     }
 }
 
+// MARK: - Dismissing Popups
+public extension View {
+    /// Dismisses last popup on the stack
+    func dismiss() { PopupManager.dismiss() }
+
+    /// Dismisses all popups of provided type on the stack.
+    func dismiss<P: Popup>(_ popup: P.Type) { PopupManager.dismiss(popup) }
+
+    /// Dismisses all popups on the stack up to the popup with the selected type
+    func dismissAll<P: Popup>(upTo popup: P.Type) { PopupManager.dismissAll(upTo: popup) }
+
+    /// Dismisses all the popups on the stack.
+    func dismissAll() { PopupManager.dismissAll() }
+}
+
 // MARK: - Actions
 public extension View {
     /// Triggers every time the popup is at the top of the stack
```

---

### Incident Patch 6: `594b9d25` (2023-07-02)
**Commit Message**: New Features + Code Refactorisation + Bug Fixes

feat:
- Added possibility to change the overlay colour
- Added ability to close all the popups on the stack up to the selected popup

style:
- Animations are now predefinied
- Background colour of popups is now visible on the stack

refactor:
- Reorganised global configurators
- Changed the file organisation system

docs:
- Documentation updated

fix:
- Improved onFocus function. It is now part of the View extension
- Fixed a problem with calculating screen height with a scroll view inside
- Fixed an issue with @State values when removing a view from the stack
- Fixed a problem with the Spacer() when presenting a popup that fills the entire screen
- Squashed minor UI bugs

**File**: `Mijick_PopupView.podspec` (modified, +2/-2)
```diff
@@ -1,11 +1,11 @@
 Pod::Spec.new do |s|
   s.name                  = 'Mijick_PopupView'
-  s.summary               = 'Beautiful and fully customisable popups in no time. Keep your SwiftUI code clean'
+  s.summary               = 'Popups presentation made simple'
   s.description           = <<-DESC
   PopupView is a free and open-source library dedicated for SwiftUI that makes the process of presenting popups easier and much cleaner.
                                DESC
   
-  s.version               = '1.9.0'
+  s.version               = '2.0.0'
   s.ios.deployment_target = '14.0'
   s.osx.deployment_target = '12.0'
   s.swift_version         = '5.0'
```

**File**: `README.md` (modified, +5/-4)
```diff
@@ -25,14 +25,14 @@
 <p align="center">
     <img alt="SwiftUI logo" src="https://github.com/Mijick/PopupView/assets/23524947/4ad7cce0-3efc-473b-bc41-9512aab2b26d.svg"/>
     <img alt="Platforms: iOS, iPadOS, macOS, tvOS" src="https://github.com/Mijick/PopupView/assets/23524947/83f8ebf0-c083-4690-8ce7-4117af7c2e8e.svg"/>
-    <img alt="Release: 1.9.0" src="https://github.com/Mijick/PopupView/assets/23524947/3598ec24-928c-426d-a7b1-2b92662a418c.svg"/>
+    <img alt="Release: 2.0.0" src="https://github.com/Mijick/PopupView/assets/23524947/6d916616-ad05-4079-ba92-4dab8d7c14a8.svg"/>
     <img alt="Compatible: Swift Package Manager, Cocoapods" src="https://github.com/Mijick/PopupView/assets/23524947/b54d3a61-1f4c-4a74-99d4-9b81418a70ae.svg"/>
     <img alt="License: MIT" src="https://github.com/Mijick/PopupView/assets/23524947/e3e47658-8ccd-4532-8121-fbf15853e725.svg"/>
 </p>
 
 <p align="center">
     <a href="https://github.com/Mijick/PopupView/stargazers">
-        <img alt="Stars" src="https://github.com/Mijick/PopupView/assets/23524947/43d335a7-fc5a-4521-bbb8-f183e18ecd94"/>
+        <img alt="Stargazers" src="https://github.com/Mijick/PopupView/assets/23524947/f58b4257-65f2-4a83-ab0a-5b6bc26fe773"/>
     </a>                                                                                                              
     <a href="https://twitter.com/MijickTeam">
         <img alt="Follow us on Twitter" src="https://github.com/Mijick/PopupView/assets/23524947/26c8f5fc-1162-4721-a514-10ef17833021"/>
@@ -102,7 +102,7 @@ Installation steps:
     
 # Usage
 ### 1. Setup library
-Inside your `@main` structure call the `implementPopupView` method. It takes three optional arguments - *configTop*, *configCentre*, *configBottom*, that can be used to configure some modifiers for all popups in the application.
+Inside your `@main` structure call the `implementPopupView` method. It takes the optional argument - *config*, that can be used to configure some modifiers for all popups in the application.
 ```Swift
   var body: some Scene {
         WindowGroup(content: ContentView().implementPopupView)
@@ -182,7 +182,7 @@ struct SettingsViewModel {
 
 ### 6. Closing popups
 There are two methods to do so:
-- By calling one of the methods `dismiss`, `dismiss(_ popup: Popup.Type)`, `dismissAll` inside the popup you created
+- By calling one of the methods `dismiss`, `dismiss(_ popup: Popup.Type)`, `dismissAll(upTo: Popup.Type)`, `dismissAll` inside the popup you created
 ```Swift
 struct BottomCustomPopup: BottomPopup {
     ...
@@ -195,6 +195,7 @@ struct BottomCustomPopup: BottomPopup {
 - By calling one of three static methods of PopupManager:
     - `PopupManager.dismiss()`
     - `PopupManager.dismiss(_ popup: Popup.Type)` where popup is the popup you want to close
+    - `PopupManager.dismissAll(upTo popup: Popup.Type)` where popup is the popup up to which you want to close the popups on the stack
     - `PopupManager.dismissAll()`
     
 <br>
```

**File**: `Sources/PopupView/Configurables/Global/GlobalConfig.swift` (removed, +0/-22)
```diff
@@ -1,22 +0,0 @@
-//
-//  GlobalConfig.swift of PopupView
-//
-//  Created by Tomasz Kurylik
-//    - Twitter: https://twitter.com/tkurylik
-//    - Mail: tomasz.kurylik@mijick.com
-//
-//  Copyright ©2023 Mijick. Licensed under MIT License.
-
-
-public struct GlobalConfig {
-    let top: Top
-    let centre: Centre
-    let bottom: Bottom
-
-
-    init(_ topConfigBuilder: (Top) -> Top, _ centreConfigBuilder: (Centre) -> Centre, _ bottomConfigBuilder: (Bottom) -> Bottom) {
-        self.top = topConfigBuilder(.init())
-        self.centre = centreConfigBuilder(.init())
-        self.bottom = bottomConfigBuilder(.init())
-    }
-}
```

**File**: `Sources/PopupView/Extensions/Foundation/Binding++.swift` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-//
-//  Binding++.swift of 
-//
-//  Created by Tomasz Kurylik
-//    - Twitter: https://twitter.com/tkurylik
-//    - Mail: tomasz.kurylik@mijick.com
-//
-//  Copyright ©2023 Mijick. Licensed under MIT License.
-
-
-import SwiftUI
-
-extension Binding<Bool> {
-    func toggleAfter(seconds: Double) {
-        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
-            wrappedValue.toggle()
-        }
-    }
-}
```

**File**: `Sources/PopupView/Extensions/Foundation/Bool++.swift` (removed, +0/-15)
```diff
@@ -1,15 +0,0 @@
-//
-//  Bool++.swift of PopupView
-//
-//  Created by Tomasz Kurylik
-//    - Twitter: https://twitter.com/tkurylik
-//    - Mail: tomasz.kurylik@mijick.com
-//
-//  Copyright ©2023 Mijick. Licensed under MIT License.
-
-
-import Foundation
-
-extension Bool {
-    var doubleValue: Double { self ? 1 : 0 }
-}
```

**File**: `Sources/PopupView/Extensions/Views/Spacer++.swift` (removed, +0/-26)
```diff
@@ -1,26 +0,0 @@
-//
-//  Spacer++.swift of PopupView
-//
-//  Created by Tomasz Kurylik
-//    - Twitter: https://twitter.com/tkurylik
-//    - Mail: tomasz.kurylik@mijick.com
-//
-//  Copyright ©2023 Mijick. Licensed under MIT License.
-
-
-import SwiftUI
-
-extension Spacer {
-    @ViewBuilder static func width(_ value: CGFloat?) -> some View {
-        switch value {
-            case .some(let value): Spacer().frame(width: max(value, 0))
-            case nil: Spacer()
-        }
-    }
-    @ViewBuilder static func height(_ value: CGFloat?) -> some View {
-        switch value {
-            case .some(let value): Spacer().frame(height: max(value, 0))
-            case nil: Spacer()
-        }
-    }
-}
```

**File**: `Sources/PopupView/Extensions/Views/View++.swift` (removed, +0/-80)
```diff
@@ -1,80 +0,0 @@
-//
-//  View++.swift of PopupView
-//
-//  Created by Tomasz Kurylik
-//    - Twitter: https://twitter.com/tkurylik
-//    - Mail: tomasz.kurylik@mijick.com
-//
-//  Copyright ©2023 Mijick. Licensed under MIT License.
-
-
-import SwiftUI
-
-public extension View {
-
-#if os(iOS) || os(macOS)
-    func implementPopupView(
-        configTop: (GlobalConfig.Top) -> GlobalConfig.Top = { $0 },
-        configCentre: (GlobalConfig.Centre) -> GlobalConfig.Centre = { $0 },
-        configBottom: (GlobalConfig.Bottom) -> GlobalConfig.Bottom = { $0 }
-    ) -> some View { overlay(PopupView(globalConfig: .init(configTop, configCentre, configBottom))) }
-#elseif os(tvOS)
-    func implementPopupView(
-        configTop: (GlobalConfig.Top) -> GlobalConfig.Top = { $0 },
-        configCentre: (GlobalConfig.Centre) -> GlobalConfig.Centre = { $0 },
-        configBottom: (GlobalConfig.Bottom) -> GlobalConfig.Bottom = { $0 }
-    ) -> some View { PopupView(rootView: self, globalConfig: .init(configTop, configCentre, configBottom)) }
-#endif
-    
-}
-
-// MARK: - Alignments
-extension View {
-    func alignToBottom(if shouldAlign: Bool = true, _ value: CGFloat = 0) -> some View {
-        VStack(spacing: 0) {
-            if shouldAlign { Spacer() }
-            self
-            Spacer.height(value)
-        }
-    }
-    func alignToTop(_ value: CGFloat = 0) -> some View {
-        VStack(spacing: 0) {
-            Spacer.height(value)
-            self
-            Spacer()
-        }
-    }
-}
-
-// MARK: - Frames
-extension View {
-    func frame(size: CGSize) -> some View { frame(width: size.width, height: size.height) }
-}
-
-// MARK: - Cleaning Cache
-extension View {
-    func clearCacheObjects(shouldClear: Bool, trigger: Binding<Bool>) -> some View {
-        onChange(of: shouldClear) { $0 ? trigger.toggleAfter(seconds: 0.4) : () }
-        .id(trigger.wrappedValue)
-    }
-}
-
-// MARK: - Others
-extension View {
-    @ViewBuilder func active(if condition: Bool) -> some View {
-        if condition { self }
-    }
-    func visible(if condition: Bool) -> some View {
-        opacity(condition.doubleValue)
-    }
-}
-
-extension View {
-
-#if os(iOS) || os(macOS)
-    func focusSectionIfAvailable() -> some View { self }
-#elseif os(tvOS)
-    func focusSectionIfAvailable() -> some View { focusSection() }
-#endif
-
-}
```

**File**: `Sources/PopupView/Internal/Extensions/Array++.swift` (renamed, +8/-10)
```diff
@@ -11,18 +11,16 @@
 import Foundation
 
 extension Array {
-    @inlinable mutating func append(_ newElement: Element, if prerequisite: Bool) {
-        if prerequisite { append(newElement) }
-    }
-    @inlinable mutating func replaceLast(_ newElement: Element, if prerequisite: Bool) {
-        guard prerequisite else { return }
-
+    @inlinable mutating func append(_ newElement: Element, if prerequisite: Bool) { if prerequisite { append(newElement) } }
+    @inlinable mutating func removeAllUpToElement(where predicate: (Element) -> Bool) { if let index = lastIndex(where: predicate) { removeLast(count - index - 1) } }
+    @inlinable mutating func removeLast() { if !isEmpty { removeLast(1) } }
+    @inlinable mutating func replaceLast(_ newElement: Element, if prerequisite: Bool) { if prerequisite {
         switch isEmpty {
             case true: append(newElement)
             case false: self[count - 1] = newElement
         }
-    }
-    @inlinable mutating func removeLast() {
-        if !isEmpty { removeLast(1) }
-    }
+    }}
+}
+extension Array {
+    var nextToLast: Element? { count >= 2 ? self[count - 2] : nil }
 }
```

---

### Incident Patch 7: `4fe3d12c` (2023-05-30)
**Commit Message**: BUGFIX

fix:
- Fixed a bug in which a fullscreen popup could have a corner radius greater than the screen radius

**File**: `Sources/PopupView/Configurables/BottomPopupConfig.swift` (modified, +2/-2)
```diff
@@ -89,10 +89,10 @@ public struct BottomPopupConfig: Configurable {
     private(set) var distanceFromKeyboard: CGFloat = 8
 
     private(set) var backgroundColour: Color = .white
-    private(set) var activePopupCornerRadius: CGFloat = UIScreen.displayCornerRadius ?? 32
+    private(set) var activePopupCornerRadius: CGFloat = 32
     private(set) var popupPadding: (bottom: CGFloat, horizontal: CGFloat) = (0, 0)
 
-    private(set) var stackCornerRadius: CGFloat = (UIScreen.displayCornerRadius ?? 32) * 0.6
+    private(set) var stackCornerRadius: CGFloat = 32 * 0.6
     private(set) var stackOffset: CGFloat = 8
     private(set) var stackScaleFactor: CGFloat = 0.1
     private(set) var stackLimit: Int = 4
```

**File**: `Sources/PopupView/Views/PopupBottomStackView.swift` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ private extension PopupBottomStackView {
 // MARK: -View Handlers
 private extension PopupBottomStackView {
     func getCornerRadius(for item: AnyPopup<BottomPopupConfig>) -> CGFloat {
-        if isLast(item) { return cornerRadius.active }
+        if isLast(item) { return min(config.contentFillsEntireScreen ? UIScreen.displayCornerRadius ?? 32 : .infinity, cornerRadius.active) }
         if gestureTranslation.isZero || !isNextToLast(item) { return cornerRadius.inactive }
 
         let difference = cornerRadius.active - cornerRadius.inactive
```

---

### Incident Patch 8: `285d4d02` (2023-05-10)
**Commit Message**: BUGFIX

fix:
- Fixed an issue regarding popups when @State is declared in the view

**File**: `README.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
 <p align="center">
     <img alt="SwiftUI logo" src="https://user-images.githubusercontent.com/23524947/228844494-9be6d187-b4f5-4a95-93fa-9c430b2bc043.svg"/>
     <img alt="Platforms: iOS, iPadOS" src="https://user-images.githubusercontent.com/23524947/228702908-490eaa2f-d028-49a3-8959-cc7d64261de3.svg"/>
-    <img alt="Release: 1.2.1" src="https://user-images.githubusercontent.com/23524947/233516901-19470969-7f8f-4be7-b10b-cf765b6e6a6a.svg"/>
+    <img alt="Release: 1.2.2" src="https://github.com/Mijick/PopupView/assets/23524947/198dfcaa-8615-43af-9b14-812e9dd6a7bd"/>
     <a href="https://www.swift.org/package-manager">
         <img alt="Swift Package Manager: Compatible" src="https://user-images.githubusercontent.com/23524947/228702912-50878cca-0902-4ec9-b042-c7762359137b.svg"/>
     </a>
```

**File**: `Sources/PopupView/Extensions/Foundation/Binding++.swift` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+//
+//  Binding++.swift of 
+//
+//  Created by Tomasz Kurylik
+//    - Twitter: https://twitter.com/tkurylik
+//    - Mail: tomasz.kurylik@mijick.com
+//
+//  Copyright ©2023 Mijick. Licensed under MIT License.
+
+
+import SwiftUI
+
+extension Binding<Bool> {
+    func toggleAfter(seconds: Double) {
+        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
+            wrappedValue.toggle()
+        }
+    }
+}
```

**File**: `Sources/PopupView/Extensions/Views/View++.swift` (modified, +11/-3)
```diff
@@ -16,7 +16,7 @@ public extension View {
     }
 }
 
-// MARK: -Alignments
+// MARK: - Alignments
 extension View {
     func alignToBottom(_ value: CGFloat = 0) -> some View {
         VStack(spacing: 0) {
@@ -34,7 +34,15 @@ extension View {
     }
 }
 
-// MARK: -Content Height Reader
+// MARK: - Cleaning Cache
+extension View {
+    func clearCacheObjects(shouldClear: Bool, trigger: Binding<Bool>) -> some View {
+        onChange(of: shouldClear) { $0 ? trigger.toggleAfter(seconds: 0.4) : () }
+        .id(trigger.wrappedValue)
+    }
+}
+
+// MARK: - Content Height Reader
 extension View {
     func readHeight(onChange action: @escaping (CGFloat) -> ()) -> some View {
         background(heightReader).onPreferenceChange(HeightPreferenceKey.self, perform: action)
@@ -50,7 +58,7 @@ fileprivate struct HeightPreferenceKey: PreferenceKey {
     static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {}
 }
 
-// MARK: -Others
+// MARK: - Others
 extension View {
     @ViewBuilder func active(if condition: Bool) -> some View {
         if condition { self }
```

**File**: `Sources/PopupView/Managers/PopupManager.swift` (modified, +41/-9)
```diff
@@ -12,22 +12,21 @@ import SwiftUI
 
 public class PopupManager: ObservableObject {
     @Published private var views: [any Popup] = []
+    fileprivate var operationRecentlyPerformed: Bool = false
 
     static let shared: PopupManager = .init()
     private init() {}
 }
 
 public extension PopupManager {
-    static func dismiss() { DispatchQueue.main.async { shared.views.removeLast() }}
-    static func dismiss(id: String) { DispatchQueue.main.async { shared.views.removeAll(where: { $0.id == id }) }}
-    static func dismiss<P: Popup>(_ popup: P.Type) { DispatchQueue.main.async { shared.views.removeAll(where: { $0.id == .init(describing: popup) }) }}
-    static func dismissAll() { DispatchQueue.main.async { shared.views.removeAll() }}
+    static func dismiss() { shared.views.perform(.removeLast) }
+    static func dismiss(id: String) { shared.views.perform(.remove(id: id)) }
+    static func dismiss<P: Popup>(_ popup: P.Type) { shared.views.perform(.remove(id: .init(describing: popup))) }
+    static func dismissAll() { shared.views.perform(.removeAll) }
 }
 
 extension PopupManager {
-    static func present(_ popup: some Popup) { DispatchQueue.main.async { withAnimation(nil) {
-        shared.views.append(popup, if: canBeInserted(popup))
-    }}}
+    static func present(_ popup: some Popup) { DispatchQueue.main.async { withAnimation(nil) { shared.views.perform(.insert(popup)) }}}
 }
 
 extension PopupManager {
@@ -37,6 +36,39 @@ extension PopupManager {
     var isEmpty: Bool { views.isEmpty }
 }
 
-private extension PopupManager {
-    static func canBeInserted(_ popup: some Popup) -> Bool { !shared.views.contains(where: { $0.id == popup.id }) }
+
+// MARK: - Helpers
+fileprivate extension [any Popup] {
+    enum Operation {
+        case insert(any Popup)
+        case removeLast, remove(id: String), removeAll
+    }
+}
+fileprivate extension [any Popup] {
+    mutating func perform(_ operation: Operation) {
+        guard !PopupManager.shared.operationRecentlyPerformed else { return }
+
+        blockOtherOperations()
+        performOperation(operation)
+        liftBlockade()
+    }
+}
+private extension [any Popup] {
+    func blockOtherOperations() {
+        PopupManager.shared.operationRecentlyPerformed = true
+    }
+    mutating func performOperation(_ operation: Operation) {
+        switch operation {
+            case .insert(let popup): append(popup, if: canBeInserted(popup))
+            case .removeLast: removeLast()
+            case .remove(let id): removeAll(where: { $0.id == id })
+            case .removeAll: removeAll()
+        }
+    }
+    func liftBlockade() {
+        DispatchQueue.main.asyncAfter(deadline: .now() + 0.44) { PopupManager.shared.operationRecentlyPerformed = false }
+    }
+}
+private extension [any Popup] {
+    func canBeInserted(_ popup: some Popup) -> Bool { !contains(where: { $0.id == popup.id }) }
 }
```

**File**: `Sources/PopupView/Views/PopupBottomStackView.swift` (modified, +5/-2)
```diff
@@ -14,15 +14,17 @@ struct PopupBottomStackView: View {
     let items: [AnyPopup<BottomPopupConfig>]
     @State private var heights: [AnyPopup<BottomPopupConfig>: CGFloat] = [:]
     @State private var gestureTranslation: CGFloat = 0
+    @State private var cacheCleanerTrigger: Bool = false
 
-
+    
     var body: some View {
         ZStack(alignment: .top, content: createPopupStack)
             .ignoresSafeArea()
             .animation(transitionAnimation, value: items)
             .animation(transitionAnimation, value: heights)
             .animation(dragGestureAnimation, value: gestureTranslation)
             .gesture(popupDragGesture)
+            .clearCacheObjects(shouldClear: items.isEmpty, trigger: $cacheCleanerTrigger)
     }
 }
 
@@ -37,12 +39,13 @@ private extension PopupBottomStackView {
         item.body
             .padding(.bottom, contentBottomPadding)
             .readHeight { saveHeight($0, for: item) }
-            .frame(width: width, height: height)
+            .frame(width: width, height: height, alignment: .top)
             .background(backgroundColour)
             .cornerRadius(getCornerRadius(for: item))
             .opacity(getOpacity(for: item))
             .offset(y: getOffset(for: item))
             .scaleEffect(getScale(for: item), anchor: .top)
+            .compositingGroup()
             .alignToBottom(bottomPadding)
             .transition(transition)
             .zIndex(isLast(item).doubleValue)
```

**File**: `Sources/PopupView/Views/PopupCentreStackView.swift` (modified, +4/-1)
```diff
@@ -16,8 +16,9 @@ struct PopupCentreStackView: View {
     @State private var configTemp: CentrePopupConfig?
     @State private var height: CGFloat?
     @State private var contentIsAnimated: Bool = false
+    @State private var cacheCleanerTrigger: Bool = false
 
-
+    
     var body: some View {
         createPopup()
             .frame(width: UIScreen.width, height: UIScreen.height)
@@ -27,6 +28,7 @@ struct PopupCentreStackView: View {
             .animation(transitionAnimation, value: contentIsAnimated)
             .transition(getTransition())
             .onChange(of: items, perform: onItemsChange)
+            .clearCacheObjects(shouldClear: items.isEmpty, trigger: $cacheCleanerTrigger)
     }
 }
 
@@ -38,6 +40,7 @@ private extension PopupCentreStackView {
             .opacity(contentOpacity)
             .background(backgroundColour)
             .cornerRadius(cornerRadius)
+            .compositingGroup()
     }
     func createTapArea() -> some View {
         Color.black.opacity(0.00000000001)
```

**File**: `Sources/PopupView/Views/PopupTopStackView.swift` (modified, +4/-1)
```diff
@@ -14,15 +14,17 @@ struct PopupTopStackView: View {
     let items: [AnyPopup<TopPopupConfig>]
     @State private var heights: [AnyPopup<TopPopupConfig>: CGFloat] = [:]
     @State private var gestureTranslation: CGFloat = 0
+    @State private var cacheCleanerTrigger: Bool = false
 
-
+    
     var body: some View {
         ZStack(alignment: .bottom, content: createPopupStack)
             .ignoresSafeArea()
             .animation(transitionAnimation, value: items)
             .animation(transitionAnimation, value: heights)
             .animation(dragGestureAnimation, value: gestureTranslation)
             .simultaneousGesture(popupDragGesture)
+            .clearCacheObjects(shouldClear: items.isEmpty, trigger: $cacheCleanerTrigger)
     }
 }
 
@@ -43,6 +45,7 @@ private extension PopupTopStackView {
             .opacity(getOpacity(for: item))
             .offset(y: getOffset(for: item))
             .scaleEffect(getScale(for: item), anchor: .bottom)
+            .compositingGroup()
             .alignToTop(topPadding)
             .transition(transition)
             .zIndex(isLast(item).doubleValue)
```

---

### Incident Patch 9: `f0af63f9` (2023-04-04)
**Commit Message**: BUGFIX

feat:
- ConfigurePopup method and ID variable are now optional

fix:
- Resolved problem with popup content not updating

**File**: `Sources/PopupView/Protocols/PopupProtocol.swift` (modified, +5/-2)
```diff
@@ -22,7 +22,7 @@ public protocol BottomPopup: Popup {
 
 
 // MARK: -Implementation
-public protocol Popup: View, Identifiable, Hashable, Equatable {
+public protocol Popup: View, Hashable, Equatable {
     associatedtype Config: Configurable
     associatedtype V: View
 
@@ -39,6 +39,9 @@ public extension Popup {
     func hash(into hasher: inout Hasher) { hasher.combine(id) }
 
     var body: V { createContent() }
+    var id: String { String(describing: type(of: self)) }
+
+    func configurePopup(popup: Config) -> Config { popup }
 }
 
 
@@ -51,7 +54,7 @@ struct AnyPopup<Config: Configurable>: Popup {
 
     init(_ popup: some Popup) {
         self.id = popup.id
-        self._body = AnyView(popup.createContent())
+        self._body = AnyView(popup)
         self._configBuilder = popup.configurePopup as! (Config) -> Config
     }
 }
```

---

### Incident Patch 10: `601921aa` (2023-03-30)
**Commit Message**: BUGFIX

fix:
- Fixed problem with buggy buttons animation

**File**: `Sources/PopupView/Managers/PopupManager.swift` (modified, +2/-2)
```diff
@@ -24,9 +24,9 @@ public extension PopupManager {
 }
 
 extension PopupManager {
-    static func present(_ popup: some Popup) { DispatchQueue.main.async {
+    static func present(_ popup: some Popup) { DispatchQueue.main.async { withAnimation(nil) {
         shared.views.append(popup, if: canBeInserted(popup))
-    }}
+    }}}
 }
 
 extension PopupManager {
```

---

### Incident Patch 11: `ef128db1` (2023-03-28)
**Commit Message**: BUGFIX

fix:
- Bottom Popup animations fixed
- Disabled the ability to drag popup on interactive elements (like buttons)

style:
- Changed default configuration for Bottom Popup

**File**: `Sources/PopupView/Configurables/BottomPopupConfig.swift` (modified, +2/-2)
```diff
@@ -31,8 +31,8 @@ public struct BottomPopupConfig: Configurable {
     var contentFillsWholeHeight: Bool = false
     var horizontalPadding: CGFloat = 0
     var bottomPadding: CGFloat = 0
-    var stackedViewsOffset: CGFloat = 12
-    var stackedViewsScale: CGFloat = 0.09
+    var stackedViewsOffset: CGFloat = 8
+    var stackedViewsScale: CGFloat = 0.1
     var stackedViewsCornerRadius: CGFloat = 10
     var maxStackedElements: Int = 4
     var activeViewCornerRadius: CGFloat = 32
```

**File**: `Sources/PopupView/Managers/PopupManager.swift` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ public extension PopupManager {
 }
 
 extension PopupManager {
-    static func present(_ popup: some Popup) { withAnimation(.default) {
+    static func present(_ popup: some Popup) { DispatchQueue.main.async {
         shared.views.append(popup, if: canBeInserted(popup))
     }}
 }
```

**File**: `Sources/PopupView/Views/PopupBottomStackView.swift` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ struct PopupBottomStackView: View {
             .animation(transitionAnimation, value: items)
             .animation(transitionAnimation, value: heights)
             .animation(dragGestureAnimation, value: gestureTranslation)
-            .simultaneousGesture(popupDragGesture)
+            .gesture(popupDragGesture)
     }
 }
 
```

---

### Incident Patch 12: `b89b8d61` (2023-03-24)
**Commit Message**: BUGFIX

feat:
- Content can now automatically fill the entire height of the Bottom Popup

fix:
- Fixed the problem with the maximum height for Bottom Popups

**File**: `Sources/PopupView/Configurables/BottomPopupConfig.swift` (modified, +2/-0)
```diff
@@ -13,6 +13,7 @@ import SwiftUI
 public extension BottomPopupConfig {
     func backgroundColour(_ value: Color) -> Self { changing(path: \.backgroundColour, to: value) }
     func contentIgnoresSafeArea(_ value: Bool) -> Self { changing(path: \.contentIgnoresSafeArea, to: value) }
+    func contentFillsWholeHeigh(_ value: Bool) -> Self { changing(path: \.contentFillsWholeHeight, to: value) }
     func horizontalPadding(_ value: CGFloat) -> Self { changing(path: \.horizontalPadding, to: value) }
     func bottomPadding(_ value: CGFloat) -> Self { changing(path: \.bottomPadding, to: value) }
     func stackedPopupsOffset(_ value: CGFloat) -> Self { changing(path: \.stackedViewsOffset, to: value) }
@@ -27,6 +28,7 @@ public extension BottomPopupConfig {
 public struct BottomPopupConfig: Configurable {
     var backgroundColour: Color = .white
     var contentIgnoresSafeArea: Bool = false
+    var contentFillsWholeHeight: Bool = false
     var horizontalPadding: CGFloat = 0
     var bottomPadding: CGFloat = 0
     var stackedViewsOffset: CGFloat = 12
```

**File**: `Sources/PopupView/Views/PopupBottomStackView.swift` (modified, +14/-1)
```diff
@@ -91,8 +91,19 @@ private extension PopupBottomStackView {
         let progressDifference = isNextToLast(item) ? 1 - translationProgress() : max(0.7, 1 - translationProgress())
         return 1 - scaleValue * progressDifference
     }
+    func saveHeight(_ height: CGFloat, for item: AnyPopup<BottomPopupConfig>) {
+        switch config.contentFillsWholeHeight {
+            case true: heights[item] = getMaxHeight()
+            case false: heights[item] = min(height, getMaxHeight() - bottomPadding)
+        }
+    }
+    func getMaxHeight() -> CGFloat {
+        let basicHeight = UIScreen.height - UIScreen.safeArea.top
+        let stackedViewsCount = min(max(0, config.maxStackedElements - 1), items.count - 1)
+        let stackedViewsHeight = config.stackedViewsOffset * .init(stackedViewsCount) * maxHeightStackedFactor
+        return basicHeight - stackedViewsHeight + maxHeightFactor
+    }
     func getOffset(for item: AnyPopup<BottomPopupConfig>) -> CGFloat { isLast(item) ? gestureTranslation : invertedIndex(of: item).floatValue * offsetFactor }
-    func saveHeight(_ height: CGFloat, for item: AnyPopup<BottomPopupConfig>) { heights[item] = height }
 }
 
 private extension PopupBottomStackView {
@@ -108,6 +119,8 @@ private extension PopupBottomStackView {
     var bottomPadding: CGFloat { config.bottomPadding }
     var width: CGFloat { UIScreen.width - config.horizontalPadding * 2 }
     var height: CGFloat { heights.first { $0.key == items.last }?.value ?? 0 }
+    var maxHeightFactor: CGFloat { 12 }
+    var maxHeightStackedFactor: CGFloat { 0.85 }
     var opacityFactor: Double { 1 / config.maxStackedElements.doubleValue }
     var offsetFactor: CGFloat { -config.stackedViewsOffset }
     var scaleFactor: CGFloat { config.stackedViewsScale }
```

---

### Incident Patch 13: `b541d9f7` (2023-03-23)
**Commit Message**: BUGFIX

fix:
- Button animations in a popup have been fixed

**File**: `Sources/PopupView/Managers/PopupManager.swift` (modified, +3/-1)
```diff
@@ -24,7 +24,9 @@ public extension PopupManager {
 }
 
 extension PopupManager {
-    static func present(_ popup: some Popup) { shared.views.append(popup, if: canBeInserted(popup)) }
+    static func present(_ popup: some Popup) { withAnimation(.default) {
+        shared.views.append(popup, if: canBeInserted(popup))
+    }}
 }
 
 extension PopupManager {
```

---

### Incident Patch 14: `1e06200a` (2023-03-23)
**Commit Message**: BUGFIX

fix:
- Safe area of Content View now works correctly

**File**: `Sources/PopupView/Extensions/Views/View++.swift` (modified, +3/-4)
```diff
@@ -11,10 +11,9 @@
 import SwiftUI
 
 public extension View {
-    func implementPopupView() -> some View { ZStack {
-        self
-        PopupView()
-    }}
+    func implementPopupView() -> some View {
+        overlay(PopupView())
+    }
 }
 
 // MARK: -Alignments
```

#### Recent Merged Pull Requests:
- **PR #202** (closed): fix: make popup window key window when presenting popup (@videni)
- **PR #192** (2025-10-22): Patch 4.0.5 (@alina-p-k)
- **PR #191** (2025-10-22): Patch 4.0.4 (@alina-p-k)
- **PR #190** (2025-10-12): fix: Corrects hit testing in iOS 26 to prevent tap misses (@alina-p-k)
- **PR #188** (2025-08-31): Patch 4.0.2 (@alina-p-k)
- **PR #183** (2025-08-31): Fix: Popups not registering any touch in iOS26 (@Nathan1258)
- **PR #181** (2025-05-14): Update README.md (@FulcrumOne)
- **PR #176** (2025-03-27): feat: handle conditional first responder dismissal (@EtienneGrey)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
