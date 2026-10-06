# Forensic Learning Record (Deep Inspection): sparrowcode/AlertKit

> **Canonical Artifact**: `07_PROJECT_LEARNING/sparrowcode-alertkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sparrowcode/AlertKit](https://github.com/sparrowcode/AlertKit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:23:11.128Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sparrowcode/AlertKit`
- **Description**: Native alert from Apple Music & Feedback. Contains Done, Heart & Message and other presets.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2633 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.9

import PackageDescription

let package = Package(
    name: "AlertKit",
    platforms: [
        .iOS(.v13),
        .visionOS(.v1)
    ],
    products: [
        .library(
            name: "AlertKit",
            targets: ["AlertKit"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "AlertKit",
            swiftSettings: [
                .define("ALERTKIT_SPM")
            ]
        )
    ],
    swiftLanguageVersions: [.v5]
)


```

### Core Architecture Module: `Sources/AlertKit/AlertHaptic.swift`
```
import UIKit

public enum AlertHaptic {
    
    case success
    case warning
    case error
    case none
    
    func impact() {
        #if os(iOS)
        let generator = UINotificationFeedbackGenerator()
        switch self {
        case .success:
            generator.notificationOccurred(UINotificationFeedbackGenerator.FeedbackType.success)
        case .warning:
            generator.notificationOccurred(UINotificationFeedbackGenerator.FeedbackType.warning)
        case .error:
            generator.notificationOccurred(UINotificationFeedbackGenerator.FeedbackType.error)
        case .none:
            break
        }
        #endif
    }
}

```

### Core Architecture Module: `Sources/AlertKit/AlertIcon.swift`
```
import UIKit

public enum AlertIcon: Equatable {
    
    case done
    case error
    case heart
    case spinnerSmall
    case spinnerLarge
    
    case custom(_ image: UIImage)
    
    func createView(lineThick: CGFloat) -> UIView {
        switch self {
        case .done: return AlertIconDoneView(lineThick: lineThick)
        case .error: return AlertIconErrorView(lineThick: lineThick)
        case .heart: return AlertIconHeartView()
        case .spinnerSmall: return AlertSpinnerView(style: .medium)
        case .spinnerLarge: return AlertSpinnerView(style: .large)
        case .custom(let image):
            let imageView = UIImageView(image: image)
            imageView.contentMode = .scaleAspectFit
            return imageView
        }
    }
}

public protocol AlertIconAnimatable {

    func animate()
}

```

### Core Architecture Module: `Sources/AlertKit/AlertKitAPI.swift`
```
import UIKit

public enum AlertKitAPI {
    
    public static func present(view: AlertViewProtocol, completion: @escaping ()->Void = {}) {
        guard let window = UIApplication.shared.windows.filter({ $0.isKeyWindow }).first else { return }
        view.present(on: window, completion: completion)
    }
    
    public static func present(title: String? = nil, subtitle: String? = nil, icon: AlertIcon? = nil, style: AlertViewStyle, haptic: AlertHaptic? = nil) {
        switch style {
        #if os(iOS)
        case .iOS16AppleMusic:
            guard let window = UIApplication.shared.windows.filter({ $0.isKeyWindow }).first else { return }
            let view = AlertAppleMusic16View(title: title, subtitle: subtitle, icon: icon)
            view.haptic = haptic
            view.present(on: window)
        #endif
        #if os(iOS) || os(visionOS)
        case .iOS17AppleMusic:
            guard let window = UIApplication.shared.windows.filter({ $0.isKeyWindow }).first else { return }
            let view = AlertAppleMusic17View(title: title, subtitle: subtitle, icon: icon)
            view.haptic = haptic
            view.present(on: window)
        #endif
        }
    }
    
    /**
     Call only with this one `completion`. Internal ones is canceled.
     */
    public static func dismissAllAlerts(completion: (() -> Void)? = nil) {
        
        var alertViews: [AlertViewInternalDismissProtocol] = []
        
        for window in UIApplication.shared.windows {
            for view in window.subviews {
                if let view = view as? AlertViewInternalDismissProtocol {
                    alertViews.append(view)
                }
            }
        }
        
        if alertViews.isEmpty {
            completion?()
        } else {
            for (index, view) in alertViews.enumerated() {
                if index == .zero {
                    view.dismiss(customCompletion: {
                        completion?()
                    })
                } else {
                    view.dismiss(customCompletion: nil)
                }
            }
        }
    }
}

```

### Core Architecture Module: `Sources/AlertKit/AlertViewStyle.swift`
```
import Foundation

public enum AlertViewStyle {
    
    #if os(iOS)
    case iOS16AppleMusic
    #endif
    
    #if os(iOS) || os(visionOS)
    case iOS17AppleMusic
    #endif
}

```

### Core Architecture Module: `Sources/AlertKit/Extensions/SwiftUIExtension.swift`
```
import SwiftUI

@available(iOS 13.0, *)
extension View {
    
    public func alert(isPresent: Binding<Bool>, view: AlertViewProtocol, completion: (()->Void)? = nil) -> some View {
        if isPresent.wrappedValue {
            let wrapperCompletion = {
                isPresent.wrappedValue = false
                completion?()
            }
            if let window = UIApplication.shared.windows.filter({ $0.isKeyWindow }).first {
                view.present(on: window, completion: wrapperCompletion)
            }
        }
        return self
    }
}

```

### Core Architecture Module: `Sources/AlertKit/Extensions/UIFontExtension.swift`
```
import UIKit

extension UIFont {
    
    static func preferredFont(forTextStyle style: TextStyle, weight: Weight, addPoints: CGFloat = 0) -> UIFont {
        let descriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: style)
        let font = UIFont.systemFont(ofSize: descriptor.pointSize + addPoints, weight: weight)
        let metrics = UIFontMetrics(forTextStyle: style)
        return metrics.scaledFont(for: font)
    }
}

```

### Core Architecture Module: `Sources/AlertKit/Extensions/UILabelExtension.swift`
```
import UIKit

extension UILabel {
    
    func layoutDynamicHeight(x: CGFloat, y: CGFloat, width: CGFloat) {
        frame = CGRect.init(x: x, y: y, width: width, height: frame.height)
        sizeToFit()
        if frame.width != width {
            frame = .init(x: x, y: y, width: width, height: frame.height)
        }
    }
}

```

### Core Architecture Module: `Sources/AlertKit/Icons/AlertIconDoneView.swift`
```
import UIKit

public class AlertIconDoneView: UIView, AlertIconAnimatable {
    
    private let lineThick: CGFloat
    
    init(lineThick: CGFloat) {
        self.lineThick = lineThick
        super.init(frame: .zero)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public func animate() {
        let length = frame.width
        let animatablePath = UIBezierPath()
        animatablePath.move(to: CGPoint(x: length * 0.196, y: length * 0.527))
        animatablePath.addLine(to: CGPoint(x: length * 0.47, y: length * 0.777))
        animatablePath.addLine(to: CGPoint(x: length * 0.99, y: length * 0.25))
        
        let animatableLayer = CAShapeLayer()
        animatableLayer.path = animatablePath.cgPath
        animatableLayer.fillColor = UIColor.clear.cgColor
        animatableLayer.strokeColor = tintColor?.cgColor
        animatableLayer.lineWidth = lineThick
        animatableLayer.lineCap = .round
        animatableLayer.lineJoin = .round
        animatableLayer.strokeEnd = 0
        layer.addSublayer(animatableLayer)
        
        let animation = CABasicAnimation(keyPath: "strokeEnd")
        animation.duration = 0.3
        animation.fromValue = 0
        animation.toValue = 1
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        animatableLayer.strokeEnd = 1
        animatableLayer.add(animation, forKey: "animation")
    }
}

```

### Core Architecture Module: `Sources/AlertKit/Icons/AlertIconErrorView.swift`
```
import UIKit

public class AlertIconErrorView: UIView, AlertIconAnimatable {

    private let lineThick: CGFloat
    
    init(lineThick: CGFloat) {
        self.lineThick = lineThick
        super.init(frame: .zero)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public func animate() {
        animateTopToBottomLine()
        animateBottomToTopLine()
    }
        
    private func animateTopToBottomLine() {
        let length = frame.width
        
        let topToBottomLine = UIBezierPath()
        topToBottomLine.move(to: CGPoint(x: length * 0, y: length * 0))
        topToBottomLine.addLine(to: CGPoint(x: length * 1, y: length * 1))
        
        let animatableLayer = CAShapeLayer()
        animatableLayer.path = topToBottomLine.cgPath
        animatableLayer.fillColor = UIColor.clear.cgColor
        animatableLayer.strokeColor = tintColor?.cgColor
        animatableLayer.lineWidth = lineThick
        animatableLayer.lineCap = .round
        animatableLayer.lineJoin = .round
        animatableLayer.strokeEnd = 0
        self.layer.addSublayer(animatableLayer)
        
        let animation = CABasicAnimation(keyPath: "strokeEnd")
        animation.duration = 0.22
        animation.fromValue = 0
        animation.toValue = 1
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        
        animatableLayer.strokeEnd = 1
        animatableLayer.add(animation, forKey: "animation")
    }
        
    private func animateBottomToTopLine() {
        let length = frame.width
        
        let bottomToTopLine = UIBezierPath()
        bottomToTopLine.move(to: CGPoint(x: length * 0, y: length * 1))
        bottomToTopLine.addLine(to: CGPoint(x: length * 1, y: length * 0))
        
        let animatableLayer = CAShapeLayer()
        animatableLayer.path = bottomToTopLine.cgPath
        animatableLayer.fillColor = UIColor.clear.cgColor
        animatableLayer.strokeColor = tintColor?.cgColor
        animatableLayer.lineWidth = lineThick
        animatableLayer.lineCap = .round
        animatableLayer.lineJoin = .round
        animatableLayer.strokeEnd = 0
        self.layer.addSublayer(animatableLayer)
        
        let animation = CABasicAnimation(keyPath: "strokeEnd")
        animation.duration = 0.22
        animation.fromValue = 0
        animation.toValue = 1
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        
        animatableLayer.strokeEnd = 1
        animatableLayer.add(animation, forKey: "animation")
    }
}

```

### Core Architecture Module: `Sources/AlertKit/Icons/AlertIconHeartView.swift`
```
import UIKit

public class AlertIconHeartView: UIView {
        
    init() {
        super.init(frame: .zero)
        self.backgroundColor = .clear
    }
    
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public override func draw(_ rect: CGRect) {
        super.draw(rect)
        HeartDraw.draw(frame: rect, resizing: .aspectFit, fillColor: self.tintColor)
    }
    
    class HeartDraw: NSObject {
        
        @objc dynamic public class func draw(frame targetFrame: CGRect = CGRect(x: 0, y: 0, width: 510, height: 470), resizing: ResizingBehavior = .aspectFit, fillColor: UIColor = UIColor(red: 0.000, green: 0.000, blue: 0.000, alpha: 1.000)) {
            let context = UIGraphicsGetCurrentContext()!
            context.saveGState()
            let resizedFrame: CGRect = resizing.apply(rect: CGRect(x: 0, y: 0, width: 510, height: 470), target: targetFrame)
            context.translateBy(x: resizedFrame.minX, y: resizedFrame.minY)
            context.scaleBy(x: resizedFrame.width / 510, y: resizedFrame.height / 470)
            let bezierPath = UIBezierPath()
            bezierPath.move(to: CGPoint(x: 255, y: 469.6))
            bezierPath.addLine(to: CGPoint(x: 219.3, y: 433.9))
            bezierPath.addCurve(to: CGPoint(x: 0, y: 140.65), controlPoint1: CGPoint(x: 86.7, y: 316.6), controlPoint2: CGPoint(x: 0, y: 237.55))
            bezierPath.addCurve(to: CGPoint(x: 140.25, y: 0.4), controlPoint1: CGPoint(x: 0, y: 61.6), controlPoint2: CGPoint(x: 61.2, y: 0.4))
            bezierPath.addCurve(to: CGPoint(x: 255, y: 53.95), controlPoint1: CGPoint(x: 183.6, y: 0.4), controlPoint2: CGPoint(x: 226.95, y: 20.8))
            bezierPath.addCurve(to: CGPoint(x: 369.75, y: 0.4), controlPoint1: CGPoint(x: 283.05, y: 20.8), controlPoint2: CGPoint(x: 326.4, y: 0.4))
            bezierPath.addCurve(to: CGPoint(x: 510, y: 140.65), controlPoint1: CGPoint(x: 448.8, y: 0.4), controlPoint2: CGPoint(x: 510, y: 61.6))
            bezierPath.addCurve(to: CGPoint(x: 290.7, y: 433.9), controlPoint1: CGPoint(x: 510, y: 237.55), controlPoint2: CGPoint(x: 423.3, y: 316.6))
            bezierPath.addLine(to: CGPoint(x: 255, y: 469.6))
            bezierPath.close()
            fillColor.setFill()
            bezierPath.fill()
            context.restoreGState()
        }
        
        @objc(HeartStyleKitResizingBehavior)
        public enum ResizingBehavior: Int {
            
            case aspectFit
            case aspectFill
            case stretch
            case center
            
            public func apply(rect: CGRect, target: CGRect) -> CGRect {
                if rect == target || target == CGRect.zero {
                    return rect
                }
                
                var scales = CGSize.zero
                scales.width = abs(target.width / rect.width)
                scales.height = abs(target.height / rect.height)
                
                switch self {
                case .aspectFit:
                    scales.width = min(scales.width, scales.height)
                    scales.height = scales.width
                case .aspectFill:
                    scales.width = max(scales.width, scales.height)
                    scales.height = scales.width
                case .stretch:
                    break
                case .center:
                    scales.width = 1
                    scales.height = 1
                }
                
                var result = rect.standardized
                result.size.width *= scales.width
                result.size.height *= scales.height
                result.origin.x = target.minX + (target.width - result.width) / 2
                result.origin.y = target.minY + (target.height - result.height) / 2
                return result
            }
        }
    }
}


```

### Core Architecture Module: `Sources/AlertKit/Icons/AlertSpinnerView.swift`
```
import UIKit

class AlertSpinnerView: UIView {
    
    let activityIndicatorView: UIActivityIndicatorView
    
    init(style: UIActivityIndicatorView.Style) {
        self.activityIndicatorView = UIActivityIndicatorView(style: style)
        super.init(frame: .zero)
        self.backgroundColor = .clear
        addSubview(activityIndicatorView)
        activityIndicatorView.startAnimating()
    }
    
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        activityIndicatorView.sizeToFit()
        activityIndicatorView.center = .init(x: frame.width / 2, y: frame.height / 2)
    }

}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #73** (2024-07-19): **Alert blinks when navigate to another view**
  *Symptoms*: Given my view  ``` import SwiftUI import AlertKit  struct CreateRewardView: View {     @StateObject var viewModel: CreateRewardViewModel = CreateRewardViewModel()     @Environment(\.dismiss) private var dismiss      var body: some View {         VStack { ...         }         .toolbar {             ToolbarItem(placement: .confirmationAction) {                 Button("Save", action: {                     Task {                         await viewModel.save()                         dismiss()                     }                 })             }         }         .alert(isPresent: $viewModel.showCreatedAlert, view: viewModel.createdAlert)     } } ``` When the user clicks on "Save" button I `showCreatedAlert` becomes `true` so the alert is shown.  The problem is that a strange behavior happens when `dismiss` is triggered. The alert appears/disappears multiple times. Am I doing something wrong?    https://github.com/sparrowcode/AlertKit/assets/33574414/98af653b-d376-4709-8e78-851f7a260cdd  
  **Post-Mortem & Fix Analysis**:
  > Looks like your view re-render twice, can you check it? 
  > > Looks like your view re-render twice, can you check it?  Hi @ivanvorobei, thanks for the reply,  how can I check that?  To add more context I am in a parent view, that view has a child that on success emits an event that triggers this method   ```         func onSuccessfullyCreatedReward() {         navigateToAddReward = false         showCreatedAlert = true     } ```  
  > > > Looks like your view re-render twice, can you check it? >  > Hi @ivanvorobei, thanks for the reply, how can I check that? >  > To add more context I am in a parent view, that view has a child that on success emits an event that triggers this method >  > ``` >     func onSuccessfullyCreatedReward() { >         navigateToAddReward = false >         showCreatedAlert = true >     } > ```  You can print or observe trigger when Sui view redraw. If you see double redraw or double call present — so reason your code. If it call once, reason bug inside

- **Issue #67** (2023-12-13): **N/A**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Please provide any more details, Xcode version and iOS target. 
  > In last version other code. I think you should upgrade.  <img width="892" alt="Screenshot 2023-12-13 at 13 35 16" src="https://github.com/sparrowcode/AlertKit/assets/10995774/4cff4df3-482a-4208-972e-7354caf44498"> 

- **Issue #62** (2023-10-17): **Build failures: Likely regression in recent commit**
  *Symptoms*: Hello from React Native land! I'm crawling up from a distant dependency on [this package](https://www.npmjs.com/package/burnt) (see initial author post in #45 ) which recently seems to have broken due to a change in AlertKit.   I found this issue while trying to build using Expo, which is a React Native build service for anyone not familiar. Specifically, in the step in which it runs Fastlane. The issue started around Oct 14, 2023 5:16 PM EST, which seems to line up with the timing and contents of 0bc23a55142cfb541dc9b941c4d1c1d424d93bd4.   The full error message refers to [AlertAppleMusic16View.swift](https://github.com/sparrowcode/AlertKit/blob/0bc23a55142cfb541dc9b941c4d1c1d424d93bd4/Sources/AlertKit/Views/AlertAppleMusic16View.swift) and [AlertAppleMusic17View.swift](https://github.com/sparrowcode/AlertKit/blob/v5/Sources/AlertKit/Views/AlertAppleMusic17View.swift).  ``` ❌  (/Users/expo/workingdir/build/react-native-app/ios/Pods/SPAlert/Sources/AlertKit/Views/AlertAppleMusic16View.swift:19:5)    17 |         default: UIColor(red: 88 / 255, green: 87 / 255, blue: 88 / 255, alpha: 1)   18 |         } > 19 |     }      |     ^ missing return in closure expected to return 'UIColor'   20 |        21 |     fileprivate weak var viewForPresent: UIView?   22 |     fileprivate var presentDismissDuration: TimeInterval = 0.2  ❌  (/Users/expo/workingdir/build/react-native-app/ios/Pods/SPAlert/Sources/AlertKit/Views/AlertAppleMusic17View.swift:19:5)    17 |         de
  **Post-Mortem & Fix Analysis**:
  > We are experiencing the same issue, with the same timing.  @nahn20 Hey! Did you just end up removing the entire `burnt` dep? 
  > Hi, I'm having the same issue - however, I actually am using burnt, so I can't just delete it. would appreciate your help 💪🏻  Thanks!
  > > We are experiencing the same issue, with the same timing. >  > @nahn20 Hey! Did you just end up removing the entire `burnt` dep?  Yep, not as a long-term fix, but more so to demonstrate that it was causing the issues (and so that I could continue with dev builds). 

- **Issue #57** (2023-07-23): **How to Dismiss this?**
  *Symptoms*:  AlertKitAPI.present(             title: "...",             icon: AlertIcon.spinnerSmall,             style: .iOS17AppleMusic,             haptic: AlertHaptic.none         )
  **Post-Mortem & Fix Analysis**:
  > Try this: ``` let alertView = AlertAppleMusic17View(title: "...", icon: .spinnerSmall) alertView.haptic = .none alertView.dismiss() ```  
  > Yes, thanks to @HassanTaleb90 !  its exactly like should work. Wrapper is good for fast templates.  But with customise use view. 

- **Issue #45** (2023-10-14): **I made this for React Native!**
  *Symptoms*: Hey! Just wanted to share that I wrapped this library (and `SPIndicator`) for React Native. I'd never used Swift before.  You can see it here: https://github.com/nandorojo/burnt  And I wrote about it here: https://twitter.com/FernandoTheRojo/status/1592923529644625920  Thanks for the great library!
  **Post-Mortem & Fix Analysis**:
  > @nandorojo hello! are you support adaptation still or not? 

- **Issue #43** (2023-10-14): **Content color is not always correct for Dark Mode.**
  *Symptoms*: **Details**  - iOS Version 13+  - Framework Version 4.2.0  - Installed via SPM   **Describe the Bug** Content color is not always correct for Dark Mode.  **Reason** When initiating the view, `defaultContentColor` is called from the initializer, looking for a window to get the traitCollection. As the window is not defined yet, nil is returned, and `lightColor` will always be in use.  **Solution for iOS 13+ only** Use `UIColor.init(dynamicProvider: _)`  I'll make a PR about that. EDIT: opened https://github.com/ivanvorobei/SPAlert/pull/44  I don't know yet how to fix it for iOS 12.x
  **Post-Mortem & Fix Analysis**:
  > Fixed in last version. 

- **Issue #37** (2021-11-30): **Set dismissByTap to false is not working**
  *Symptoms*: **Describe the bug** tapGesterRecognizer is initialized before dismissByTap is set to false.  **To Reproduce** ``` let alertView = SPAlertView(title: "", preset: .spinner) // tapGesture is added to view alertView.dismissByTap = false // will not work alertView.present() ```  ![CleanShot 2021-11-30 at 19 54 21](https://user-images.githubusercontent.com/10215098/144042886-b7a994e3-ad1a-4411-9951-a11b0847ee37.png) 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reported!  Fixed in `3.5.1` version, please, update.

- **Issue #33** (2021-07-22): **Xcode 13 beta 3: 'shared' is unavailable in application extensions for iOS**
  *Symptoms*: **Describe the bug** The package won't compile in latest Xcode 13.0 beta 3 using SPM. It seems that the latest compiler requires us to mark `present(...)` as `@available(iOSApplicationExtension, unavailable)` explicitly since `UIApplication.shared` is unavailable in extension target. Even though we don't have any extension target.  ```swift // SPAlertView.swift      open func present(duration: TimeInterval = SPAlertConfiguration.duration, haptic: SPAlertHaptic = .success, completion: (() -> Void)? = nil) {                  if self.presentWindow == nil {             self.presentWindow = UIApplication.shared.keyWindow // <=== 👀 Error: 'shared' is unavailable in application extensions for iOS: Use view controller based solutions where appropriate instead.... 'shared' has been explicitly marked unavailable here (UIKit.UIApplication)         }                  guard let window = self.presentWindow else { return }                  window.addSubview(self)                  // Prepare for present         // ...          ```  **To Reproduce** 1. Create a new iOS project in Xcode, and add SPAlert in Package Dependencies. 2. Add SPAlert library to iOS target. 3. Compile.  **Expected behavior** No error like in Xcode 12.  **Smartphone (please complete the following information):**  - Xcode version 13.0 beta 3  - `SPAlert` version 3.2.4  - Installed via SPM 
  **Post-Mortem & Fix Analysis**:
  > Thanks for it, in beta I think no way using key window. I going to check it and find any other solution. Soon let you know here.
  > Having the same issue :(
  > Fixed in `3.3.0`, please, update. If have any problem after update version, let me know please.

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

### Incident Patch 1: `3d35de60` (2023-11-08)
**Commit Message**: Fixed crash when tap for alert.

**File**: `README.md` (modified, +7/-5)
```diff
@@ -75,7 +75,7 @@ or adding it to the `dependencies` of your `Package.swift`:
 
 ```swift
 dependencies: [
-    .package(url: "https://github.com/sparrowcode/AlertKit", .upToNextMajor(from: "5.1.5"))
+    .package(url: "https://github.com/sparrowcode/AlertKit", .upToNextMajor(from: "5.1.8"))
 ]
 ```
 
@@ -99,7 +99,7 @@ If you prefer not to use any of dependency managers, you can integrate manually.
 
 ## SwiftUI
 
-You can use basic way via AlertKitAPI or call via modifier:
+You can use basic way via `AlertKitAPI` or call via modifier:
 
 ```swift
 let alertView = AlertAppleMusic17View(title: "Hello", subtitle: nil, icon: .done)
@@ -114,9 +114,10 @@ If you need customisation fonts, icon, colors or any other, make view:
 
 ```swift
 let alertView = AlertAppleMusic17View(title: "Added to Library", subtitle: nil, icon: .done)
-// Change Font
+
+// change font
 alertView.titleLabel.font = UIFont.systemFont(ofSize: 21)
-// Change Color
+// change color
 alertView.titleLabel.textColor = .white
 ```
 
@@ -126,8 +127,9 @@ You can present and dismiss alerts manually via view.
 
 ```swift
 let alertView = AlertAppleMusic17View(title: "Added to Library", subtitle: nil, icon: .done)
-alertView.present(on: self)
 
+// present
+alertView.present(on: self)
 // and dismiss
 alertView.dismiss()
 ```
```

**File**: `SPAlert.podspec` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 Pod::Spec.new do |s|
 
   s.name = 'SPAlert'
-  s.version = '5.1.6'
+  s.version = '5.1.8'
   s.summary = 'Native alert from Apple Music & Feedback. Contains Done, Heart & Message and other presets. Support SwiftUI.'
   s.homepage = 'https://github.com/sparrowcode/AlertKit'
   s.source = { :git => 'https://github.com/sparrowcode/AlertKit.git', :tag => s.version }
```

**File**: `Sources/AlertKit/AlertKitAPI.swift` (modified, +9/-7)
```diff
@@ -26,13 +26,16 @@ public enum AlertKitAPI {
         }
     }
     
+    /**
+     Call only with this one `completion`. Internal ones is canceled.
+     */
     public static func dismissAllAlerts(completion: (() -> Void)? = nil) {
         
-        var alertViews: [AlertViewProtocol] = []
+        var alertViews: [AlertViewInternalDismissProtocol] = []
         
         for window in UIApplication.shared.windows {
             for view in window.subviews {
-                if let view = view as? AlertViewProtocol {
+                if let view = view as? AlertViewInternalDismissProtocol {
                     alertViews.append(view)
                 }
             }
@@ -43,14 +46,13 @@ public enum AlertKitAPI {
         } else {
             for (index, view) in alertViews.enumerated() {
                 if index == .zero {
-                    view.dismiss(completion: completion)
+                    view.dismiss(customCompletion: {
+                        completion?()
+                    })
                 } else {
-                    view.dismiss(completion: nil)
+                    view.dismiss(customCompletion: nil)
                 }
             }
-            alertViews.first?.dismiss {
-                completion?()
-            }
         }
     }
 }
```

**File**: `Sources/AlertKit/Views/AlertAppleMusic16View.swift` (modified, +10/-3)
```diff
@@ -23,6 +23,8 @@ public class AlertAppleMusic16View: UIView, AlertViewProtocol {
     fileprivate var presentDismissDuration: TimeInterval = 0.2
     fileprivate var presentDismissScale: CGFloat = 0.8
     
+    fileprivate var completion: (()->Void)? = nil
+    
     private lazy var backgroundView: UIVisualEffectView = {
         let view: UIVisualEffectView = {
             #if !os(tvOS)
@@ -124,6 +126,7 @@ public class AlertAppleMusic16View: UIView, AlertViewProtocol {
     
     open func present(on view: UIView, completion: (()->Void)? = nil) {
         self.viewForPresent = view
+        self.completion = completion
         viewForPresent?.addSubview(self)
         guard let viewForPresent = viewForPresent else { return }
         
@@ -155,20 +158,24 @@ public class AlertAppleMusic16View: UIView, AlertViewProtocol {
                 DispatchQueue.main.asyncAfter(deadline: DispatchTime.now() + self.duration) {
                     // If dismiss manually no need call original completion.
                     if self.alpha != 0 {
-                        self.dismiss(completion: completion)
+                        self.dismiss()
                     }
                 }
             }
         })
     }
     
-    @objc open func dismiss(completion: (()->Void)? = nil) {
+    @objc open func dismiss() {
+        self.dismiss(customCompletion: self.completion)
+    }
+    
+    func dismiss(customCompletion: (()->Void)? = nil) {
         UIView.animate(withDuration: presentDismissDuration, animations: {
             self.alpha = 0
             self.transform = self.transform.scaledBy(x: self.presentDismissScale, y: self.presentDismissScale)
         }, completion: { [weak self] finished in
             self?.removeFromSuperview()
-            completion?()
+            customCompletion?()
         })
     }
     
```

**File**: `Sources/AlertKit/Views/AlertAppleMusic17View.swift` (modified, +11/-4)
```diff
@@ -2,7 +2,7 @@ import UIKit
 import SwiftUI
 
 @available(iOS 13, visionOS 1, *)
-public class AlertAppleMusic17View: UIView, AlertViewProtocol {
+public class AlertAppleMusic17View: UIView, AlertViewProtocol, AlertViewInternalDismissProtocol {
     
     open var dismissByTap: Bool = true
     open var dismissInTime: Bool = true
@@ -28,6 +28,8 @@ public class AlertAppleMusic17View: UIView, AlertViewProtocol {
     fileprivate var presentDismissDuration: TimeInterval = 0.2
     fileprivate var presentDismissScale: CGFloat = 0.8
     
+    fileprivate var completion: (()->Void)? = nil
+    
     private lazy var backgroundView: UIView = {
         #if os(visionOS)
         let swiftUIView = VisionGlassBackgroundView(cornerRadius: 12)
@@ -126,6 +128,7 @@ public class AlertAppleMusic17View: UIView, AlertViewProtocol {
     
     open func present(on view: UIView, completion: (()->Void)? = nil) {
         self.viewForPresent = view
+        self.completion = completion
         viewForPresent?.addSubview(self)
         guard let viewForPresent = viewForPresent else { return }
         
@@ -163,20 +166,24 @@ public class AlertAppleMusic17View: UIView, AlertViewProtocol {
                 DispatchQueue.main.asyncAfter(deadline: DispatchTime.now() + self.duration) {
                     // If dismiss manually no need call original completion.
                     if self.alpha != 0 {
-                        self.dismiss(completion: completion)
+                        self.dismiss()
                     }
                 }
             }
         })
     }
     
-    @objc open func dismiss(completion: (()->Void)? = nil) {
+    @objc open func dismiss() {
+        self.dismiss(customCompletion: self.completion)
+    }
+    
+    func dismiss(customCompletion: (()->Void)? = nil) {
         UIView.animate(withDuration: presentDismissDuration, animations: {
             self.alpha = 0
             self.transform = self.transform.scaledBy(x: self.presentDismissScale, y: self.presentDismissScale)
         }, completion: { [weak self] finished in
             self?.removeFromSuperview()
-            completion?()
+            customCompletion?()
         })
     }
     
```

**File**: `Sources/AlertKit/Views/AlertViewInternalDismissProtocol.swift` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+import UIKit
+
+protocol AlertViewInternalDismissProtocol {
+    
+    func dismiss(customCompletion: (()->Void)?)
+}
```

**File**: `Sources/AlertKit/Views/AlertViewProtocol.swift` (modified, +1/-1)
```diff
@@ -3,5 +3,5 @@ import UIKit
 public protocol AlertViewProtocol {
     
     func present(on view: UIView, completion: (()->Void)?)
-    func dismiss(completion: (()->Void)?)
+    func dismiss()
 }
```

---

### Incident Patch 2: `3c7acb28` (2023-11-01)
**Commit Message**: Fix layout bug when trigger in any time.

**File**: `Sources/AlertKit/Views/AlertAppleMusic16View.swift` (modified, +2/-0)
```diff
@@ -176,6 +176,8 @@ public class AlertAppleMusic16View: UIView, AlertViewProtocol {
     
     public override func layoutSubviews() {
         super.layoutSubviews()
+        
+        guard self.transform == .identity else { return }
         backgroundView.frame = self.bounds
         
         if let iconView = self.iconView {
```

**File**: `Sources/AlertKit/Views/AlertAppleMusic17View.swift` (modified, +1/-0)
```diff
@@ -182,6 +182,7 @@ public class AlertAppleMusic17View: UIView, AlertViewProtocol {
     
     public override func layoutSubviews() {
         super.layoutSubviews()
+        guard self.transform == .identity else { return }
         backgroundView.frame = self.bounds
         layout(maxWidth: frame.width)
     }
```

---

### Incident Patch 3: `30228c31` (2023-10-17)
**Commit Message**: Fixed blur style for iOS17 preset.

**File**: `SPAlert.podspec` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 Pod::Spec.new do |s|
 
   s.name = 'SPAlert'
-  s.version = '5.1.2'
+  s.version = '5.1.4'
   s.summary = 'Native alert from Apple Music & Feedback. Contains Done, Heart & Message and other presets. Support SwiftUI.'
   s.homepage = 'https://github.com/sparrowcode/AlertKit'
   s.source = { :git => 'https://github.com/sparrowcode/AlertKit.git', :tag => s.version }
```

**File**: `Sources/AlertKit/Views/AlertAppleMusic17View.swift` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ public class AlertAppleMusic17View: UIView, AlertViewProtocol {
         hostView.isUserInteractionEnabled = false
         return hostView
         #else
-        let view = UIVisualEffectView(effect: UIBlurEffect())
+        let view = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
         view.isUserInteractionEnabled = false
         return view
         #endif
```

---

### Incident Patch 4: `ebc2d5c4` (2023-10-14)
**Commit Message**: Allow customisation. Added support SwiftUI.

**File**: `README.md` (modified, +37/-7)
```diff
@@ -5,7 +5,7 @@ I tried to recreate Apple's alerts as much as possible. You can find these alert
 
 ![Alert Kit v5](https://cdn.sparrowcode.io/github/alertkit/v5/preview-v1_2.png)
 
-For run alert just call this:
+For UIKit & SwiftUI call this:
 
 ```swift
 AlertKitAPI.present(
@@ -27,25 +27,31 @@ public enum AlertViewStyle {
 ```
 
 ### Community
-    
+
 <p float="left">
     <a href="https://twitter.com/sparrowcode_en">
         <img src="https://cdn.sparrowcode.io/github%2Fbadges%2Ftwitter.png?version=4" height="52">
     </a>
     <a href="https://t.me/sparrowcode_en">
         <img src="https://cdn.sparrowcode.io/github/badges/telegram.png?version=1" height="52">
     </a>
-    <a href="https://mastodon.social/@sparrowcode_en">
-        <img src="https://cdn.sparrowcode.io/github/badges/mastodon.png?version=2" height="52">
-    </a>
     <a href="#apps-using">
         <img src="https://cdn.sparrowcode.io/github/badges/download-on-the-appstore.png?version=4" height="52">
     </a>
 </p>
 
+## Navigate
+
+- [Installation](#installation)
+    - [Swift Package Manager](#swift-package-manager)
+    - [CocoaPods](#cocoapods)
+- [SwiftUI](#swiftui)
+- [Customisation](#customisation)
+- [Apps Using](#apps-using)
+
 ## Installation
 
-Ready to use on iOS 13+.
+Ready to use on iOS 13+. Supports iOS and visionOS. Working with `UIKit` and `SwiftUI`.
 
 ### Swift Package Manager
 
@@ -59,7 +65,7 @@ or adding it to the `dependencies` of your `Package.swift`:
 
 ```swift
 dependencies: [
-    .package(url: "https://github.com/sparrowcode/AlertKit", .upToNextMajor(from: "5.0.0"))
+    .package(url: "https://github.com/sparrowcode/AlertKit", .upToNextMajor(from: "5.1.0"))
 ]
 ```
 
@@ -80,11 +86,35 @@ pod 'SPAlert'
 
 If you prefer not to use any of dependency managers, you can integrate manually. Put `Sources/AlertKit` folder in your Xcode project. Make sure to enable `Copy items if needed` and `Create groups`.
 
+## SwiftUI
+
+You can use basic way via AlertKitAPI or call via modifier: 
+
+```swift
+let alertView = AlertAppleMusic17View(title: "Hello", subtitle: nil, icon: .done)
+
+VStack {}
+    .alert(isPresent: $alertPresented, view: alertView)
+```
+
+## Customisation
+
+If you need customisation fonts, icon, colors or any other, make view: 
+
+```swift
+let alertView = AlertAppleMusic17View(title: "Added to Library", subtitle: nil, icon: .done)
+// Change content color
+alertView.contentColor = .systemBlue
+// Change font
+alertView.titleLabel.font = UIFont.systemFont(ofSize: 21)
+```
+
 ## Apps Using
 
 <p float="left">
     <a href="https://apps.apple.com/app/id1624477055"><img src="https://cdn.sparrowcode.io/github/apps-using/id1624477055.png?version=2" height="65"></a>
     <a href="https://apps.apple.com/app/id1625641322"><img src="https://cdn.sparrowcode.io/github/apps-using/id1625641322.png?version=2" height="65"></a>
+    <a href="https://apps.apple.com/app/id1625641322"><img src="https://cdn.sparrowcode.io/github/apps-using/id6449774982.png?version=2" height="65"></a>
     <a href="https://apps.apple.com/app/id875280793"><img src="https://cdn.sparrowcode.io/github/apps-using/id875280793.png?version=2" height="65"></a>
     <a href="https://apps.apple.com/app/id743843090"><img src="https://cdn.sparrowcode.io/github/apps-using/id743843090.png?version=2" height="65"></a>
     <a href="https://apps.apple.com/app/id537070378"><img src="https://cdn.sparrowcode.io/github/apps-using/id537070378.png?version=2" height="65"></a>
```

**File**: `SPAlert.podspec` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 Pod::Spec.new do |s|
 
   s.name = 'SPAlert'
-  s.version = '5.0.1'
+  s.version = '5.1.0'
   s.summary = 'Native alert from Apple Music & Feedback. Contains Done, Heart & Message and other presets. Support SwiftUI.'
   s.homepage = 'https://github.com/sparrowcode/AlertKit'
   s.source = { :git => 'https://github.com/sparrowcode/AlertKit.git', :tag => s.version }
```

**File**: `Sources/AlertKit/AlertKitAPI.swift` (modified, +5/-0)
```diff
@@ -2,6 +2,11 @@ import UIKit
 
 public enum AlertKitAPI {
     
+    public static func present(view: AlertViewProtocol, completion: @escaping ()->Void = {}) {
+        guard let window = UIApplication.shared.windows.filter({ $0.isKeyWindow }).first else { return }
+        view.present(on: window, completion: completion)
+    }
+    
     public static func present(title: String? = nil, subtitle: String? = nil, icon: AlertIcon? = nil, style: AlertViewStyle, haptic: AlertHaptic? = nil) {
         switch style {
         case .iOS16AppleMusic:
```

**File**: `Sources/AlertKit/Extensions/SwiftUIExtension.swift` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import SwiftUI
+
+@available(iOS 13.0, *)
+extension View {
+    
+    public func alert(isPresent: Binding<Bool>, view: AlertViewProtocol) -> some View {
+        if isPresent.wrappedValue {
+            let alertCompletion = view.completion
+            let completion = {
+                isPresent.wrappedValue = false
+                alertCompletion?()
+            }
+            if let window = UIApplication.shared.windows.filter({ $0.isKeyWindow }).first {
+                view.present(on: window, completion: completion)
+            }
+        }
+        return self
+    }
+}
```

**File**: `Sources/AlertKit/Extensions/UIFontExtension.swift` (modified, +0/-21)
```diff
@@ -1,24 +1,3 @@
-// The MIT License (MIT)
-// Copyright © 2020 Ivan Vorobei (hello@ivanvorobei.io)
-//
-// Permission is hereby granted, free of charge, to any person obtaining a copy
-// of this software and associated documentation files (the "Software"), to deal
-// in the Software without restriction, including without limitation the rights
-// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
-// copies of the Software, and to permit persons to whom the Software is
-// furnished to do so, subject to the following conditions:
-//
-// The above copyright notice and this permission notice shall be included in all
-// copies or substantial portions of the Software.
-//
-// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-// SOFTWARE.
-
 import UIKit
 
 extension UIFont {
```

**File**: `Sources/AlertKit/Icons/AlertIconDoneView.swift` (modified, +0/-1)
```diff
@@ -24,7 +24,6 @@ public class AlertIconDoneView: UIView, AlertIconAnimatable {
         animatableLayer.path = animatablePath.cgPath
         animatableLayer.fillColor = UIColor.clear.cgColor
         animatableLayer.strokeColor = tintColor?.cgColor
-        //animatableLayer.lineWidth = 9
         animatableLayer.lineWidth = lineThick
         animatableLayer.lineCap = .round
         animatableLayer.lineJoin = .round
```

**File**: `Sources/AlertKit/Views/AlertAppleMusic16View.swift` (modified, +12/-21)
```diff
@@ -1,21 +1,28 @@
 import UIKit
 
-public class AlertAppleMusic16View: UIView {
+public class AlertAppleMusic16View: UIView, AlertViewProtocol {
     
     open var dismissByTap: Bool = true
     open var dismissInTime: Bool = true
     open var duration: TimeInterval = 1.5
     open var haptic: AlertHaptic? = nil
     
-    fileprivate let titleLabel: UILabel?
-    fileprivate let subtitleLabel: UILabel?
-    fileprivate let iconView: UIView?
+    public let titleLabel: UILabel?
+    public let subtitleLabel: UILabel?
+    public let iconView: UIView?
+    
+    public var contentColor = UIColor { trait in
+        switch trait.userInterfaceStyle {
+        case .dark: UIColor(red: 127 / 255, green: 127 / 255, blue: 129 / 255, alpha: 1)
+        default: UIColor(red: 88 / 255, green: 87 / 255, blue: 88 / 255, alpha: 1)
+        }
+    }
     
     fileprivate weak var viewForPresent: UIView?
     fileprivate var presentDismissDuration: TimeInterval = 0.2
     fileprivate var presentDismissScale: CGFloat = 0.8
     
-    var completion: (() -> Void)? = nil
+    open var completion: (() -> Void)? = nil
     
     private lazy var backgroundView: UIVisualEffectView = {
         let view: UIVisualEffectView = {
@@ -114,22 +121,6 @@ public class AlertAppleMusic16View: UIView {
     
     open func present(on view: UIView, completion: @escaping ()->Void = {}) {
         
-        let contentColor = {
-            let darkColor = UIColor(red: 127 / 255, green: 127 / 255, blue: 129 / 255, alpha: 1)
-            let lightColor = UIColor(red: 88 / 255, green: 87 / 255, blue: 88 / 255, alpha: 1)
-            if #available(iOS 12.0, *) {
-                let interfaceStyle = view.traitCollection.userInterfaceStyle
-                switch interfaceStyle {
-                case .light: return lightColor
-                case .dark: return darkColor
-                case .unspecified: return lightColor
-                @unknown default: return lightColor
-                }
-            } else {
-                return lightColor
-            }
-        }()
-        
         self.titleLabel?.textColor = contentColor
         self.subtitleLabel?.textColor = contentColor
         self.iconView?.tintColor = contentColor
```

**File**: `Sources/AlertKit/Views/AlertAppleMusic17View.swift` (modified, +11/-20)
```diff
@@ -1,15 +1,22 @@
 import UIKit
 
-public class AlertAppleMusic17View: UIView {
+public class AlertAppleMusic17View: UIView, AlertViewProtocol {
     
     open var dismissByTap: Bool = true
     open var dismissInTime: Bool = true
     open var duration: TimeInterval = 1.5
     open var haptic: AlertHaptic? = nil
     
-    fileprivate let titleLabel: UILabel?
-    fileprivate let subtitleLabel: UILabel?
-    fileprivate let iconView: UIView?
+    public let titleLabel: UILabel?
+    public let subtitleLabel: UILabel?
+    public let iconView: UIView?
+    
+    public var contentColor = UIColor { trait in
+        switch trait.userInterfaceStyle {
+        case .dark: UIColor(red: 127 / 255, green: 127 / 255, blue: 129 / 255, alpha: 1)
+        default: UIColor(red: 88 / 255, green: 87 / 255, blue: 88 / 255, alpha: 1)
+        }
+    }
     
     fileprivate weak var viewForPresent: UIView?
     fileprivate var presentDismissDuration: TimeInterval = 0.2
@@ -112,22 +119,6 @@ public class AlertAppleMusic17View: UIView {
     
     open func present(on view: UIView, completion: @escaping ()->Void = {}) {
         
-        let contentColor = {
-            let darkColor = UIColor(red: 127 / 255, green: 127 / 255, blue: 129 / 255, alpha: 1)
-            let lightColor = UIColor(red: 88 / 255, green: 87 / 255, blue: 88 / 255, alpha: 1)
-            if #available(iOS 12.0, *) {
-                let interfaceStyle = view.traitCollection.userInterfaceStyle
-                switch interfaceStyle {
-                case .light: return lightColor
-                case .dark: return darkColor
-                case .unspecified: return lightColor
-                @unknown default: return lightColor
-                }
-            } else {
-                return lightColor
-            }
-        }()
-        
         self.titleLabel?.textColor = contentColor
         self.subtitleLabel?.textColor = contentColor
         self.iconView?.tintColor = contentColor
```

---

### Incident Patch 5: `0285e202` (2021-12-20)
**Commit Message**: Updated swiftui extension.

**File**: `Sources/SPAlert/Extensions/SwiftUIExtension.swift` (modified, +19/-17)
```diff
@@ -33,6 +33,7 @@ extension View {
         duration: TimeInterval = 2.0,
         haptic: SPAlertHaptic = .none
     ) -> some View {
+        
         if isPresent.wrappedValue {
             let alertCompletion = alertView.completion
             let alertDismiss = {
@@ -45,36 +46,37 @@ extension View {
         return self
     }
     
-    public func SPAlert(isPresent: Binding<Bool>,
-                        title: String = "",
-                        message: String? = nil,
-                        duration: TimeInterval = 2.0,
-                        dismissOnTap: Bool = true,
-                        preset: SPAlertIconPreset = .done,
-                        haptic: SPAlertHaptic = .none,
-                        layout: SPAlertLayout? = nil,
-                        completion: (()-> Void)? = nil
+    public func SPAlert(
+        isPresent: Binding<Bool>,
+        title: String = "",
+        message: String? = nil,
+        duration: TimeInterval = 2.0,
+        dismissOnTap: Bool = true,
+        preset: SPAlertIconPreset = .done,
+        haptic: SPAlertHaptic = .none,
+        layout: SPAlertLayout? = nil,
+        completion: (()-> Void)? = nil
     ) -> some View {
+        
         let alertView = SPAlertView(title: title, message: message, preset: preset)
         alertView.dismissByTap = dismissOnTap
         alertView.layout = layout ??  SPAlertLayout(for: preset)
         alertView.completion = completion
-        
         return SPAlert(isPresent: isPresent, alertView: alertView, duration: duration, haptic: haptic)
     }
     
-    public func SPAlert(isPresent: Binding<Bool>,
-                        message: String,
-                        duration: TimeInterval = 2.0,
-                        dismissOnTap: Bool = true,
-                        haptic: SPAlertHaptic = .none,
-                        completion: (()-> Void)? = nil
+    public func SPAlert(
+        isPresent: Binding<Bool>,
+        message: String,
+        duration: TimeInterval = 2.0,
+        dismissOnTap: Bool = true,
+        haptic: SPAlertHaptic = .none,
+        completion: (()-> Void)? = nil
     ) -> some View {
         
         let alertView = SPAlertView(message: message)
         alertView.dismissByTap = dismissOnTap
         alertView.completion = completion
-        
         return SPAlert(isPresent: isPresent, alertView: alertView, duration: duration, haptic: haptic)
     }
 }
```

---

### Incident Patch 6: `17939549` (2021-11-30)
**Commit Message**: Fixed dismiss by tap flag.

**File**: `Example App/SPAlert.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -18,14 +18,14 @@
 /* End PBXBuildFile section */
 
 /* Begin PBXFileReference section */
-		F43A587826564DDF009098ED /* SPAlert */ = {isa = PBXFileReference; lastKnownFileType = folder; name = SPAlert; path = ..; sourceTree = "<group>"; };
 		F47E1DFA26564B6A008D901C /* iOS Example.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = "iOS Example.app"; sourceTree = BUILT_PRODUCTS_DIR; };
 		F47E1E0B26564B6C008D901C /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
 		F47E1E1226564BB3008D901C /* AlertPresetModel.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = AlertPresetModel.swift; sourceTree = "<group>"; };
 		F47E1E1426564BB3008D901C /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
 		F47E1E1626564BB3008D901C /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; name = Base; path = Base.lproj/LaunchScreen.storyboard; sourceTree = "<group>"; };
 		F47E1E1726564BB3008D901C /* AppDelegate.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
 		F47E1E1926564BB3008D901C /* PresetsController.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = PresetsController.swift; sourceTree = "<group>"; };
+		F482FBF42756A77100E40FDA /* SPAlert */ = {isa = PBXFileReference; lastKnownFileType = folder; name = SPAlert; path = ..; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -45,7 +45,7 @@
 		F47E1DF126564B6A008D901C = {
 			isa = PBXGroup;
 			children = (
-				F43A587826564DDF009098ED /* SPAlert */,
+				F482FBF42756A77100E40FDA /* SPAlert */,
 				F47E1DFC26564B6A008D901C /* iOS Example */,
 				F47E1DFB26564B6A008D901C /* Products */,
 			);
```

**File**: `SPAlert.podspec` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 Pod::Spec.new do |s|
 
   s.name = 'SPAlert'
-  s.version = '3.5.0'
+  s.version = '3.5.1'
   s.summary = 'Native alert from Apple Music & Feedback. Contains Done, Heart & Message and other presets.'
   s.homepage = 'https://github.com/ivanvorobei/SPAlert'
   s.source = { :git => 'https://github.com/ivanvorobei/SPAlert.git', :tag => s.version }
```

**File**: `Sources/SPAlert/SPAlertView.swift` (modified, +18/-13)
```diff
@@ -88,33 +88,38 @@ open class SPAlertView: UIView {
     
     public init(title: String, message: String? = nil, preset: SPAlertIconPreset) {
         super.init(frame: CGRect.zero)
-        
-        switch preset {
-        case .spinner:
-            self.dismissInTime = false
-        default:
-            self.dismissInTime = true
-        }
-        
         commonInit()
         layout = SPAlertLayout(for: preset)
         setTitle(title)
         if let message = message {
             setMessage(message)
         }
         setIcon(for: preset)
+        
+        switch preset {
+        case .spinner:
+            dismissInTime = false
+            dismissByTap = false
+        default:
+            dismissInTime = true
+            dismissByTap = true
+        }
     }
     
     public init(message: String) {
         super.init(frame: CGRect.zero)
         commonInit()
         layout = SPAlertLayout.message()
         setMessage(message)
+        dismissInTime = true
+        dismissByTap = true
     }
     
     public required init?(coder aDecoder: NSCoder) {
         super.init(coder: aDecoder)
         commonInit()
+        dismissInTime = true
+        dismissByTap = true
     }
     
     private func commonInit() {
@@ -127,11 +132,6 @@ open class SPAlertView: UIView {
         backgroundColor = .clear
         addSubview(backgroundView)
         
-        if dismissByTap {
-            let tapGesterRecognizer = UITapGestureRecognizer(target: self, action: #selector(dismiss))
-            addGestureRecognizer(tapGesterRecognizer)
-        }
-        
         setCornerRadius(self.cornerRadius)
     }
     
@@ -217,6 +217,11 @@ open class SPAlertView: UIView {
         setFrame()
         transform = transform.scaledBy(x: self.presentDismissScale, y: self.presentDismissScale)
         
+        if dismissByTap {
+            let tapGesterRecognizer = UITapGestureRecognizer(target: self, action: #selector(dismiss))
+            addGestureRecognizer(tapGesterRecognizer)
+        }
+        
         // Present
         
         haptic.impact()
```

---

### Incident Patch 7: `a087d7eb` (2021-11-04)
**Commit Message**: Fixed readme.

**File**: `README.md` (modified, +0/-1)
```diff
@@ -154,7 +154,6 @@ You can remove duration and completion, its have default values.
 I added preset `.spinner`, for use it simple call this:
 
 ```swift
-let 
 let alertView = SPAlertView(title: "Please, wait", preset: .spinner)
 alertView.present()
 ```
```

---

### Incident Patch 8: `6dc0c1b8` (2021-10-01)
**Commit Message**: Updated readme and fix typos.

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (modified, +1/-1)
```diff
@@ -3,5 +3,5 @@
 
 ## Checklist
 <!--- Go over all the following points, and put an `x` in all the boxes that apply. -->
-- [ ] Testing in `iOS`
+- [ ] Testing in compability platforms
 - [ ] Installed correct via Swift Package Manager and Cocoapods
```

**File**: `README.md` (modified, +8/-4)
```diff
@@ -175,6 +175,10 @@ Button("Show alert") {
         })
 ```
 
+## Сontribution
+
+My English is very bad. You can see this once you read the documentation. I would really like to have clean and nice documentation. If you see gramatical errors and can help fix the Readme, please contact me hello@ivanvorobei.by or make a Pull Request. Thank you in advance!
+
 ## Other Projects
 
 I love being helpful. Here I have provided a list of libraries that I keep up to date. For see `video previews` of libraries without install open [opensource.ivanvorobei.by](https://opensource.ivanvorobei.by) website.<br>
@@ -184,6 +188,9 @@ I have libraries with native interface and managing permissions. Also available
     <a href="https://opensource.ivanvorobei.by">
         <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/more-libraries.svg">
     </a>
+        <a href="https://xcodeshop.ivanvorobei.by">
+        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/xcode-shop.svg">
+    </a>
 </p>
 
 ## Russian Community
@@ -193,10 +200,7 @@ I have libraries with native interface and managing permissions. Also available
 
 <p float="left">
     <a href="https://tutorials.ivanvorobei.by/telegram/channel">
-        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-tutorials.svg">
-    </a>
-    <a href="https://tutorials.ivanvorobei.by/telegram/libs">
-        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-libraries.svg">
+        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/open-telegram-channel.svg">
     </a>
     <a href="https://tutorials.ivanvorobei.by/telegram/chat">
         <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-chat.svg">
```

**File**: `SPAlert.podspec` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 Pod::Spec.new do |s|
 
   s.name = 'SPAlert'
-  s.version = '3.4.0'
+  s.version = '3.4.1'
   s.summary = 'Native alert from Apple Music & Feedback. Contains Done, Heart & Message and other presets.'
   s.homepage = 'https://github.com/ivanvorobei/SPAlert'
   s.source = { :git => 'https://github.com/ivanvorobei/SPAlert.git', :tag => s.version }
```

**File**: `TODO.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 
 Here provided ideas or features which will be implemented soon.
 
-- Mode animatable views.
+- More animatable views.
```

---

### Incident Patch 9: `e984d307` (2021-09-12)
**Commit Message**: Adopt to UIAppearance support.

**File**: `Example App/iOS Example/App/AppDelegate.swift` (modified, +6/-0)
```diff
@@ -21,13 +21,19 @@
 
 import UIKit
 import SparrowKit
+import SPAlert
 
 @UIApplicationMain
 class AppDelegate: SPAppWindowDelegate {
 
     func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
         let rootController = PresetsController().wrapToNavigationController(prefersLargeTitles: false)
         makeKeyAndVisible(viewController: rootController, tint: .systemBlue)
+        
+        // If need to change for all alerts.
+        // SPAlertView.appearance().duration = 2
+        // SPAlertView.appearance().cornerRadius = 8
+        
         return true
     }
 }
```

**File**: `README.md` (modified, +8/-8)
```diff
@@ -141,11 +141,11 @@ You can remove duration and completion, its have default values.
 Also you can change some default values for alerts. For example you can change default duration and corner radius for alert with next code:
 
 ```swift
-SPAlertConfiguration.duration = 2
-SPAlertConfiguration.cornerRadius = 12
+SPAlertView.appearance().duration = 2
+SPAlertView.appearance().cornerRadius = 12
 ```
 
-It will apply for all alerts. Shoud set configuration before present any alerts. I recomend set it in app delegate.
+It will apply for all alerts. I recomend set it in app delegate. But you can change it in runtime.
 
 ## SwiftUI
 
@@ -192,17 +192,17 @@ I have libraries with native interface and managing permissions. Also available
 Со сложными и непонятными задачами помогут в чате.
 
 <p float="left">
-    <a href="https://sparrowcode.by/telegram/channel">
+    <a href="https://tutorials.ivanvorobei.by/telegram/channel">
         <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-tutorials.svg">
     </a>
-    <a href="https://sparrowcode.by/telegram/libs">
+    <a href="https://tutorials.ivanvorobei.by/telegram/libs">
         <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-libraries.svg">
     </a>
-    <a href="https://sparrowcode.by/telegram/chat">
+    <a href="https://tutorials.ivanvorobei.by/telegram/chat">
         <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-chat.svg">
     </a>
 </p>
 
-Видео-туториалы выклыдываю на [YouTube](https://sparrowcode.by/youtube):
+Видео-туториалы выклыдываю на [YouTube](https://tutorials.ivanvorobei.by/youtube):
 
-[![Tutorials on YouTube](https://cdn.ivanvorobei.by/github/readme/youtube-preview.jpg)](https://sparrowcode.by/youtube)
+[![Tutorials on YouTube](https://cdn.ivanvorobei.by/github/readme/youtube-preview.jpg)](https://tutorials.ivanvorobei.by/youtube)
```

**File**: `SPAlert.podspec` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 Pod::Spec.new do |s|
 
   s.name = 'SPAlert'
-  s.version = '3.3.1'
+  s.version = '3.4.0'
   s.summary = 'Native alert from Apple Music & Feedback. Contains Done, Heart & Message and other presets.'
   s.homepage = 'https://github.com/ivanvorobei/SPAlert'
   s.source = { :git => 'https://github.com/ivanvorobei/SPAlert.git', :tag => s.version }
```

**File**: `Sources/SPAlert/SPAlertConfiguration.swift` (removed, +0/-59)
```diff
@@ -1,59 +0,0 @@
-// The MIT License (MIT)
-// Copyright © 2020 Ivan Vorobei (hello@ivanvorobei.by)
-//
-// Permission is hereby granted, free of charge, to any person obtaining a copy
-// of this software and associated documentation files (the "Software"), to deal
-// in the Software without restriction, including without limitation the rights
-// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
-// copies of the Software, and to permit persons to whom the Software is
-// furnished to do so, subject to the following conditions:
-//
-// The above copyright notice and this permission notice shall be included in all
-// copies or substantial portions of the Software.
-//
-// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-// SOFTWARE.
-
-import UIKit
-
-/**
- SPAlert: Configuration interface.
- 
- Use this for change default values. For example you want change default duration of alerts,
- set property `duration` to specific value.
- */
-public class SPAlertConfiguration {
-    
-    // MARK: - Public
-    
-    /**
-     SPAlert: Change default corner radius for alert views.
-     */
-    public static var cornerRadius: CGFloat {
-        get { shared.cornerRadius }
-        set { shared.cornerRadius = newValue }
-    }
-    
-    /**
-     SPAlert: Change visible duration for alerts.
-     */
-    public static var duration: TimeInterval {
-        get { shared.duration }
-        set { shared.duration = newValue }
-    }
-    
-    // MARK: - Internal
-    
-    private var cornerRadius: CGFloat = 8
-    private var duration: TimeInterval = 1.5
-    
-    // MARK: - Singltone
-    
-    private static let shared = SPAlertConfiguration()
-    private init() {}
-}
```

**File**: `Sources/SPAlert/SPAlertView.swift` (modified, +22/-2)
```diff
@@ -41,6 +41,16 @@ open class SPAlertView: UIView {
     open var dismissByTap: Bool = true
     open var completion: (() -> Void)? = nil
     
+    // MARK: - UIAppearance
+    
+    @objc dynamic open var cornerRadius: CGFloat = 8 {
+        didSet {
+            layer.cornerRadius = self.cornerRadius
+        }
+    }
+    
+    @objc dynamic open var duration: TimeInterval = 1.5
+    
     // MARK: - Views
     
     open var titleLabel: UILabel?
@@ -91,15 +101,17 @@ open class SPAlertView: UIView {
         if #available(iOS 11.0, *) {
             insetsLayoutMarginsFromSafeArea = false
         }
+        
         layer.masksToBounds = true
-        layer.cornerRadius = SPAlertConfiguration.cornerRadius
         backgroundColor = .clear
         addSubview(backgroundView)
         
         if dismissByTap {
             let tapGesterRecognizer = UITapGestureRecognizer(target: self, action: #selector(dismiss))
             addGestureRecognizer(tapGesterRecognizer)
         }
+        
+        setCornerRadius(self.cornerRadius)
     }
     
     // MARK: - Configure
@@ -134,6 +146,10 @@ open class SPAlertView: UIView {
         addSubview(view)
     }
     
+    private func setCornerRadius(_ value: CGFloat) {
+        layer.cornerRadius = value
+    }
+    
     // MARK: - Present
     
     fileprivate var presentDismissDuration: TimeInterval = 0.2
@@ -157,7 +173,11 @@ open class SPAlertView: UIView {
         }
     }
     
-    open func present(duration: TimeInterval = SPAlertConfiguration.duration, haptic: SPAlertHaptic = .success, completion: (() -> Void)? = nil) {
+    open func present(haptic: SPAlertHaptic = .success, completion: (() -> Void)? = nil) {
+        present(duration: self.duration, haptic: haptic, completion: completion)
+    }
+    
+    open func present(duration: TimeInterval, haptic: SPAlertHaptic = .success, completion: (() -> Void)? = nil) {
         
         if self.presentWindow == nil {
             self.presentWindow = UIApplication.shared.keyWindow
```

---

### Incident Patch 10: `4c19b207` (2021-07-22)
**Commit Message**: Fixed bugs for Xcode 13.3.

**File**: `Example App/SPAlert.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +4/-4)
```diff
@@ -6,17 +6,17 @@
         "repositoryURL": "https://github.com/ivanvorobei/SparrowKit",
         "state": {
           "branch": null,
-          "revision": "fdac977986b64f240e6e72f00b499503d327bb31",
-          "version": "3.0.7"
+          "revision": "d1a2d489417f98620558da08ddcf44a9d53e58f3",
+          "version": "3.2.0"
         }
       },
       {
         "package": "SPDiffable",
         "repositoryURL": "https://github.com/ivanvorobei/SPDiffable",
         "state": {
           "branch": null,
-          "revision": "2350c8a491fcc29ef833509905c5c9a2a3b51e7e",
-          "version": "1.2.2"
+          "revision": "884198fb29a339156b824483bc09e2b488d27e28",
+          "version": "1.4.1"
         }
       }
     ]
```

**File**: `Example App/iOS Example/App/AppDelegate.swift` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ class AppDelegate: SPAppWindowDelegate {
 
     func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
         let rootController = PresetsController().wrapToNavigationController(prefersLargeTitles: false)
-        makeKeyAndVisible(rootController, tint: .systemBlue)
+        makeKeyAndVisible(viewController: rootController, tint: .systemBlue)
         return true
     }
 }
```

**File**: `SPAlert.podspec` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 Pod::Spec.new do |s|
 
   s.name = 'SPAlert'
-  s.version = '3.2.4'
+  s.version = '3.3.0'
   s.summary = 'Native alert from Apple Music & Feedback. Contains Done, Heart & Message and other presets.'
   s.homepage = 'https://github.com/ivanvorobei/SPAlert'
   s.source = { :git => 'https://github.com/ivanvorobei/SPAlert.git', :tag => s.version }
```

**File**: `Sources/SPAlert/Extensions/SwiftUIExtension.swift` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
 import SwiftUI
 
 @available(iOS 13.0, *)
+@available(iOSApplicationExtension, unavailable)
 extension View {
     
     public func spAlert(
```

**File**: `Sources/SPAlert/SPAlert.swift` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ import UIKit
  SPAlert: Acess level. Here you get ready-use methods.
  Recomended use it.
  */
+@available(iOSApplicationExtension, unavailable)
 public enum SPAlert {
     
     /**
```

**File**: `Sources/SPAlert/SPAlertView.swift` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ import UIKit
  
  Recomended call `SPAlert` and choose style func.
  */
+@available(iOSApplicationExtension, unavailable)
 open class SPAlertView: UIView {
     
     // MARK: - Properties
```

---

### Incident Patch 11: `9fa6c085` (2021-07-13)
**Commit Message**: Fixed naming paths.

**File**: `README.md` (modified, +6/-6)
```diff
@@ -195,14 +195,14 @@ I have libraries with native interface and managing permissions. Also available
 Я веду каналы про iOS разработку. Один с туториалами и новостями, другой с обзором библиотек. Помощь можно найти в нашем чате.
 
 <p float="left">
-    <a href="https://opensource.ivanvorobei.by">
-        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-comunity-tutorials.svg">
+    <a href="https://sparrowcode.by/telegram/channel">
+        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-tutorials.svg">
     </a>
-    <a href="https://opensource.ivanvorobei.by">
-        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-comunity-libraries.svg">
+    <a href="https://sparrowcode.by/telegram/libs">
+        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-libraries.svg">
     </a>
-    <a href="https://opensource.ivanvorobei.by">
-        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-comunity-chat">
+    <a href="https://sparrowcode.by/telegram/chat">
+        <img src="https://github.com/ivanvorobei/Readme/blob/main/Buttons/russian-community-chat">
     </a>
 </p>
 
```

#### Recent Merged Pull Requests:
- **PR #75** (2024-08-11): Updated README.md (@SaurabhPrajapati)
- **PR #72** (2024-04-11): Made AlertView's init more readable. (@alpaycli)
- **PR #70** (closed): Add LineTime to apps using (@samdawes)
- **PR #66** (2023-11-15): Add Captionista to apps-using (@shakhrayv)
- **PR #65** (closed): Fix 16 Alert dismiss crash (@crazypoo)
- **PR #63** (2023-10-17): Add Feedster app to apps-using section (@nikolajjsj)
- **PR #56** (closed): Update AlertAppleMusic17View.swift (@HassanTaleb90)
- **PR #55** (closed): Update AlertAppleMusic16View.swift (@HassanTaleb90)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
