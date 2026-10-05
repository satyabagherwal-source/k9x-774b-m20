# Forensic Learning Record (Deep Inspection): krzysztofzablocki/Inject

> **Canonical Artifact**: `07_PROJECT_LEARNING/krzysztofzablocki-inject-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/krzysztofzablocki/Inject](https://github.com/krzysztofzablocki/Inject))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:30:31.551Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `krzysztofzablocki/Inject`
- **Description**: Hot Reloading for Swift applications! 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3485 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "Inject",
    platforms: [
            .macOS(.v10_15),
            .iOS(.v11),
            .tvOS(.v13)
        ],
    products: [
        .library(
            name: "Inject",
            targets: ["Inject"]),
    ],
    
    dependencies: [
    ],
    targets: [
        .target(
            name: "Inject",
            dependencies: []),
    ]
)

```

### Core Architecture Module: `Sources/Inject/InjectConfiguration.swift`
```
import Foundation
import Combine
import SwiftUI

#if !os(watchOS)
/// Common protocol interface for classes that support observing injection events
/// This is automatically added to all NSObject subclasses like `ViewController`s or `Window`s
@MainActor public protocol InjectListener {
    associatedtype InjectInstanceType = Self

    func enableInjection()
    func onInjection(callback: @escaping (InjectInstanceType) -> Void) -> Void
}

/// Public namespace for using Inject API
@MainActor public enum InjectConfiguration {
    public static var bundlePath = "/Applications/InjectionIII.app/Contents/Resources/"
    @available(iOS 13.0, *)
    public static let observer = injectionObserver
    public static let load: Void = loadInjectionImplementation
    @available(iOS 13.0, *)
    public static var animation: SwiftUI.Animation?
}

@MainActor public extension InjectListener {
    /// Ensures injection is enabled
    @inlinable @inline(__always)
    func enableInjection() {
        _ = InjectConfiguration.load
    }
}

#if DEBUG
@MainActor private var loadInjectionImplementation: Void = {
    guard objc_getClass("InjectionClient") == nil else { return }
    // If project has a "Build Phase" running this script, Inject should
    // work on a device (requires an InjectionIII github release 4.8.0+):
    // /Applications/InjectionIII.app/Contents/Resources/copy_bundle.sh
    if let path = Bundle.main.path(forResource:
            "iOSInjection", ofType: "bundle") ??
        Bundle.main.path(forResource:
            "macOSInjection", ofType: "bundle"),
        Bundle(path: path)?.load() == true {
        return
    }
#if os(macOS)
    let bundleName = "macOSInjection.bundle"
#elseif os(tvOS)
    let bundleName = "tvOSInjection.bundle"
#elseif os(visionOS)
    let bundleName = "xrOSInjection.bundle"
#elseif targetEnvironment(simulator)
    let bundleName = "iOSInjection.bundle"
#elseif targetEnvironment(macCatalyst)
    let bundleName = "macOSInjection.bundle"
#else
    let bundleName = "maciOSInjection.bundle"
#endif // OS and environment conditions

#if targetEnvironment(simulator) || os(macOS) || targetEnvironment(macCatalyst)
    for which in ["III", "Next"] {
        let bundlePath = InjectConfiguration.bundlePath
            .replacingOccurrences(of: "III", with: which) + bundleName
        if let bundle = Bundle(path: bundlePath), bundle.load() {
            return
        }
    }

    print("⚠️ Inject: InjectionIII bundle not found, verify if it's in \(InjectConfiguration.bundlePath)")
#endif
}()

@available(iOS 13.0, *)
@MainActor public class InjectionObserver: ObservableObject {
    @Published public private(set) var injectionNumber = 0
    private var cancellable: AnyCancellable?

    fileprivate init() {
        _ = loadInjectionImplementation
        cancellable = NotificationCenter.default.publisher(for: Notification.Name("INJECTION_BUNDLE_NOTIFICATION"))
            .sink { [weak self] _ in
                if let animation = InjectConfiguration.animation {
                    withAnimation(animation) {
                        self?.injectionNumber += 1
                    }
                } else {
                    self?.injectionNumber += 1
                }
            }
    }
}

@available(iOS 13.0, *)
@MainActor private let injectionObserver = InjectionObserver()
@available(iOS 13.0, *)
@MainActor private var injectionObservationKey = arc4random()

@MainActor public extension InjectListener where Self: NSObject {
    func onInjection(callback: @escaping (Self) -> Void) {
        guard #available(iOS 13.0, *) else {
            return
        }
        let observation = injectionObserver.objectWillChange.sink(receiveValue: { [weak self] in
            guard let self = self else { return }
            callback(self)
        })

        objc_setAssociatedObject(self, &injectionObservationKey, observation, .OBJC_ASSOCIATION_RETAIN)
    }
}

#else
@available(iOS 13.0, *)
@MainActor public class InjectionObserver: ObservableObject {}
@available(iOS 13.0, *)
@MainActor private let injectionObserver = InjectionObserver()
@MainActor private var loadInjectionImplementation: Void = {}()

@MainActor public extension InjectListener where Self: NSObject {
    @inlinable @inline(__always)
    func onInjection(callback: @escaping (Self) -> Void) {}
}
#endif // DEBUG
#endif

```

### Core Architecture Module: `Sources/Inject/Integrations/Hosts.swift`
```
#if !os(watchOS)
#if canImport(UIKit)
import UIKit
public typealias InjectViewControllerType = UIViewController
public typealias InjectViewType = UIView
#elseif canImport(AppKit)
import AppKit
public typealias InjectViewControllerType = NSViewController
public typealias InjectViewType = NSView
#endif

#if DEBUG

public typealias ViewControllerHost = _InjectableViewControllerHost
public typealias ViewHost = _InjectableViewHost

/// Usage: to create an autoreloading view controller, wrap your
/// view controller that you wish to see changes within `ViewHost`. For example,
/// If you are using a `TestViewController`, you would do the following:
/// `let myView = ViewControllerHost(TestViewController())`
/// And within the parent view, you should add the view above.
@dynamicMemberLookup
open class _InjectableViewControllerHost<Hosted: InjectViewControllerType>: InjectViewControllerType {
    public private(set) var instance: Hosted
    let constructor: () -> Hosted
    /// Attaches a hook to be executed each time after a controller is reloaded.
    ///
    /// Usage:
    /// ```swift
    /// let myView = ViewControllerHost(TestViewController())
    /// myView.onInjectionHook = { hostedViewController in
    /// //any thing here will be executed each time the controller is reloaded
    /// // for example, you might want to re-assign the controller to your presenter
    ///     presenter.ui = hostedViewController
    /// }
    /// ```
    public var onInjectionHook: ((Hosted) -> Void)?
    
    public init(_ constructor: @autoclosure @escaping () -> Hosted) {
        instance = constructor()
        self.constructor = constructor
        
        super.init(nibName: nil, bundle: nil)
        self.enableInjection()
        
        addAsChild()
        onInjection { [weak self] instance in
            guard let self else { return }
            instance.resetHosted()
            self.onInjectionHook?(self.instance)
        }
    }
    
    override open func loadView() {
        view = InjectViewType(frame: .zero)
    }
    
    private func resetHosted() {
        // remove old vc from child list
#if canImport(UIKit)
        instance.willMove(toParent: nil)
#endif
        instance.view.removeFromSuperview()
        instance.removeFromParent()
        
        instance = constructor()
        addAsChild()
    }
    
    private func addAsChild() {
        // add the real content as child
        addChild(instance)
        view.addSubview(instance.view)
#if canImport(UIKit)
        instance.didMove(toParent: self)
        
        title = instance.title
        tabBarItem = instance.tabBarItem
        definesPresentationContext = instance.definesPresentationContext
        modalPresentationStyle = instance.modalPresentationStyle
        #if !os(tvOS)
        navigationItem.title = instance.navigationItem.title
        navigationItem.titleView = instance.navigationItem.titleView
        navigationItem.backButtonTitle = instance.navigationItem.backButtonTitle
        navigationItem.backBarButtonItem = instance.navigationItem.backBarButtonItem
        navigationItem.leftBarButtonItems = instance.navigationItem.leftBarButtonItems
        navigationItem.rightBarButtonItems = instance.navigationItem.rightBarButtonItems
        navigationItem.largeTitleDisplayMode = instance.navigationItem.largeTitleDisplayMode
        navigationItem.searchController = instance.navigationItem.searchController
        navigationItem.hidesSearchBarWhenScrolling = instance.navigationItem.hidesSearchBarWhenScrolling
        toolbarItems = instance.toolbarItems
        hidesBottomBarWhenPushed = instance.hidesBottomBarWhenPushed
        #endif
#endif
        
        instance.view.translatesAutoresizingMaskIntoConstraints = false
        [
            instance.view.topAnchor.constraint(equalTo: view.topAnchor),
            instance.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            instance.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            instance.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ]
        .forEach { $0.isActive = true }
    }
    
    @available(*, unavailable)
    required public init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
#if canImport(UIKit) && os(iOS)
    override open var childForStatusBarStyle: InjectViewControllerType? {
        instance
    }
#endif

    public subscript<T>(dynamicMember keyPath: WritableKeyPath<Hosted, T>) -> T {
        get { instance[keyPath: keyPath] }
        set { instance[keyPath: keyPath] = newValue }
    }
    
    public subscript<T>(dynamicMember keyPath: KeyPath<Hosted, T>) -> T {
        instance[keyPath: keyPath]
    }
}

/// Usage: to create an autoreloading view, wrap your
/// view that you wish to see changes within `ViewHost`. For example,
/// If you are using a `TestView`, you would do the following:
/// `let myView = ViewHost(TestView())`
/// And within the parent view, you should add the view above.
@dynamicMemberLookup
public class _InjectableViewHost<Hosted: InjectViewType>: InjectViewType {
    public private(set) var instance: Hosted
    let constructor: () -> Hosted
    
    public init(_ constructor: @autoclosure @escaping () -> Hosted) {
        instance = constructor()
        self.constructor = constructor
        
        super.init(frame: .zero)
        self.enableInjection()
        addAsChild()
        onInjection { instance in
            instance.resetHosted()
        }
    }
    
    private func resetHosted() {
        instance.removeFromSuperview()
        
        instance = constructor()
        addAsChild()
    }
    
    private func addAsChild() {
        // add the real content as child
        addSubview(instance)
        
        instance.translatesAutoresizingMaskIntoConstraints = false
        [
            instance.topAnchor.constraint(equalTo: topAnchor),
            instance.leadingAnchor.constraint(equalTo: leadingAnchor),
            instance.bottomAnchor.constraint(equalTo: bottomAnchor),
            instance.trailingAnchor.constraint(equalTo: trailingAnchor)
        ]
        .forEach { $0.isActive = true }
    }
    
    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public subscript<T>(dynamicMember keyPath: WritableKeyPath<Hosted, T>) -> T {
        get { instance[keyPath: keyPath] }
        set { instance[keyPath: keyPath] = newValue }
    }
    
    public subscript<T>(dynamicMember keyPath: KeyPath<Hosted, T>) -> T {
        instance[keyPath: keyPath]
    }
}

@MainActor extension InjectConfiguration {
    public static func ViewControllerHost<Hosted: InjectViewControllerType>(_ viewController: Hosted) -> ViewControllerHost<Hosted> {
        Inject.ViewControllerHost(viewController)
    }
    public static func ViewHost<Hosted: InjectViewType>(_ view: Hosted) -> ViewHost<Hosted> {
        Inject.ViewHost(view)
    }
}
#else

@MainActor extension InjectConfiguration {
    public static func ViewControllerHost<Hosted: InjectViewControllerType>(_ viewController: Hosted) -> Hosted {
        viewController
    }
    public static func ViewHost<Hosted: InjectViewType>(_ view: Hosted) -> Hosted {
        view
    }
}

#endif
#endif

```

### Core Architecture Module: `Sources/Inject/Integrations/KitFrameworks.swift`
```
#if !os(watchOS)
#if canImport(UIKit)
import Foundation
import UIKit

extension UIView: InjectListener {}
extension UIViewController: InjectListener {}
#elseif canImport(AppKit)
import AppKit
import Foundation

extension NSView: InjectListener {}
extension NSViewController: InjectListener {}
extension NSWindow: InjectListener {}
#endif
#endif

```

### Core Architecture Module: `Sources/Inject/Integrations/SwiftUI.swift`
```
import Foundation
import SwiftUI

#if !os(watchOS)
#if DEBUG
@available(iOS 13.0, *)
public extension SwiftUI.View {
    func enableInjection() -> some SwiftUI.View {
        _ = InjectConfiguration.load
        
        // Use AnyView in case the underlying view structure changes during injection.
        // This is only in effect in debug builds.
        return AnyView(self)
    }

    func onInjection(callback: @escaping (Self) -> Void) -> some SwiftUI.View {
        onReceive(InjectConfiguration.observer.objectWillChange, perform: {
            callback(self)
        })
        .enableInjection()
    }
}

@available(iOS 13.0, *)
@propertyWrapper @preconcurrency @MainActor
public struct ObserveInjection: DynamicProperty {
    @ObservedObject private var iO = InjectConfiguration.observer
    public init() {}
    // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
    public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
}

#else
@available(iOS 13.0, *)
public extension SwiftUI.View {
    @inlinable @inline(__always)
    func enableInjection() -> Self { self }

    @inlinable @inline(__always)
    func onInjection(callback: @escaping (Self) -> Void) -> Self {
        self
    }
}

@available(iOS 13.0, *)
@propertyWrapper @preconcurrency @MainActor
public struct ObserveInjection: DynamicProperty {
    public init() {}
    // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
    public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
}
#endif
#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #129** (2026-10-02): **邀请 inject 加入 GithubStarMate，让更多人发现你的作品**
  *Symptoms*: 你好，想邀请你把 inject 分享到 [GithubStarMate](https://www.githubstarmate.com/?utm_source=github&utm_medium=issue&utm_campaign=community_invitation&utm_content=krzysztofzablocki%2Finject)。你已经投入时间把项目做出来了，它值得被更多开发者发现。  很多好项目，只差一个被更多人看到的机会。如果你正在为 inject 寻找推广渠道，欢迎免费加入。也许下一位愿意使用它、为它点亮 Star 的开发者，就从这里认识你。  GithubStarMate 是一个面向 GitHub 开发者的项目发现与互助平台。你可以展示自己的仓库、浏览其他开发者的项目，并通过 Star、Watch 和 Fork 参与互动，在支持其他项目的同时，为自己的作品积累关注。  👉 **[免费加入 GithubStarMate，让更多人发现 inject](https://www.githubstarmate.com/zh-Hans/register?utm_source=github&utm_medium=issue&utm_campaign=community_invitation&utm_content=krzysztofzablocki%2Finject)**  说明一下：这条邀请来自平台的积分奖励推广活动，我会因参与活动获得相应积分，你没有注册或参与的义务。  如果这类邀请不适合你的项目，直接关闭此 Issue 即可。感谢你维护和分享 inject，抱歉打扰  <!-- githubstarmate:community:scheduled:camel4724 -->
  **Post-Mortem & Fix Analysis**:
  > English please!

- **Issue #128** (2026-04-29): **fix: align Inject with Swift 6 concurrency isolation**
  *Symptoms*: ## Summary - isolate Inject public listener/config APIs to `@MainActor` where they interact with UI/ObservableObject state - isolate injected observer globals and loader globals to `@MainActor` - update `ObserveInjection` initializers to actor-compatible initializers under strict Swift 6 checks - mark host helper extensions on `InjectConfiguration` as `@MainActor`  ## Reproduction Using strict Swift 6 checks:  ```bash swift build -Xswiftc -strict-concurrency=complete -Xswiftc -warnings-as-errors ```  Before this change, build fails with concurrency diagnostics in: - `InjectConfiguration` static/global mutable state - `ObserveInjection` initialization isolation - host factory helper methods crossing actor boundaries  ## Verification - `swift build -Xswiftc -strict-concurrency=complete -Xswiftc -warnings-as-errors`  (Repository currently has no test target, so build verification is used.)  Made with [Cursor](https://cursor.com)
  **Post-Mortem & Fix Analysis**:
  > I'm fearful this will drop support for previous versions of the compiler. How about specifying Swift 5 language mode for now instead? https://github.com/johnno1962/HotSwiftUI/commit/3a59d2ed791ac519b7d60b6fd4e51eeec61289fa
  > D'oh, specifying v5 language mode for the package doesn't prevent strict concurrency checks being applied.
  > Yes — for Swift 5 language mode on modern toolchains, the Inject PR should remain compatible.  Why: The package still declares swift-tools-version:5.3 in Package.swift. The PR changes (@MainActor isolation + removing nonisolated on SwiftUI wrapper init) use attributes supported by Swift 5-era concurrency-capable compilers (especially 5.5+). There are no #if swift(>=6)-only constructs in that Inject patch.  One nuance:  If someone tries to build with a very old Swift 5 compiler pre-concurrency (e.g. 5.3/5.4 toolchain), @MainActor annotations may be an issue. In Xcode environments where you switch between Swift 5 and Swift 6 language modes, compatibility is preserved.

- **Issue #127** (2026-04-14): **Hey Team needs a new tag from the main**
  *Symptoms*: To get the next changes, we need to create a new tag. :/
  **Post-Mortem & Fix Analysis**:
  > @krzysztofzablocki  can you help me with this?
  > Seems like we're well overdue for a tag https://github.com/krzysztofzablocki/Inject/compare/1.5.2...main. Resolve to the main branch to pick up the latest goodies.
  > added 1.6.0

- **Issue #124** (2026-01-10): **Xcode 26 support issue?**
  *Symptoms*: 💉 Compiling /Users/myname/iOS Projects/iOS_Retail/MyProject Mobile iOS/MyProject Mobile iOS/UI/Online Products/Screens/Mortgage Loan/Mortgage Loan Intro/View/MortgageLoanIntroScreen.swift iphonesimulator/MyProject.build/DerivedSources/x86_64 -Xcc -I/Users/myname/Library/Developer/Xcode/DerivedData/MyProject_Mobile_iOS-gjpmetflefngncgvqylxdfnbbthu/Build/Intermediates.noindex/MyProject\ Mobile\ iOS.build/Debug-iphonesimulator/MyProject.build/DerivedSources -Xcc -DDEBUG\=1 -Xcc -DCOCOAPODS\=1 -Xcc -DDEBUG\=1 -Xcc -DPB_FIELD_32BIT\=1 -Xcc -DPB_NO_PACKED_STRUCTS\=1 -Xcc -DPB_ENABLE_MALLOC\=1 -import-objc-header /Users/myname/Library/Developer/Xcode/DerivedData/MyProject_Mobile_iOS-gjpmetflefngncgvqylxdfnbbthu/Build/Intermediates.noindex/MyProject\ Mobile\ iOS.build/Debug-iphonesimulator/MyProject.build/Objects-normal/x86_64/MyProject-primary-Bridging-header.pch -no-auto-bridging-header-chaining -module-name MyProject -disable-clang-spi -target-sdk-version 26.0 -target-sdk-name iphonesimulator26.0 -clang-target x86_64-apple-ios26.0-simulator -in-process-plugin-server-path /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/host/libSwiftInProcPluginServer.dylib -o /tmp/injection.o > "/Users/myname/Library/Containers/com.johnholdsworth.InjectionIII/Data/tmp/eval103.log" 2>&1 💉 ⚠️ Re-compilation failed (see: /Users/myname/Library/Containers/com.johnholdsworth.InjectionIII/Data/tmp/command.sh) <unknown>:0: error: fatal error encountered during
  **Post-Mortem & Fix Analysis**:
  > Hi, can you try moving to the newer version of Injection, https://github.com/johnno1962/InjectionNext. You can use it pretty much the same way as InjectionIII if you use the script copy_bundle.sh or add it as a Swift Package.
  > I use rosetta iPhone 17  ⚠️ Recompile failed for: /Users/myname/iOS Projects/iOS_Retail/MyAppName Mobile iOS/MyAppName Mobile iOS/UI/Online Products/Screens/Mortgage Loan/Mortgage Loan Intro/View/MortgageLoanIntroScreen.swift /Users/myname/iOS Projects/iOS_Retail/MyAppName Mobile iOS/MyAppName Mobile iOS/UI/Online Products/Account Opening/New Card/AccountOpeningConnectWithNewCardViewController.swift:7:8: error: could not find module 'MyAppNameLib' for target 'arm64-apple-ios-simulator'; found: x86_64-apple-ios-simulator, at: /Users/myname/Library/Developer/Xcode/DerivedData/MyAppName_Mobile_iOS-gjpmetflefngncgvqylxdfnbbthu/Build/Products/Debug-iphonesimulator/MyAppNameLib/MyAppNameLib.framework/Modules/MyAppNameLib.swiftmodule   5 |    6 | import UIKit   7 | import MyAppNameLib     |        `- error: could not find module 'MyAppNameLib' for target 'arm64-apple-ios-simulator'; found: x86_64-apple-ios-simulator, at: /Users/myname/Library/Developer/Xcode/DerivedData/MyAppName_Mobile_iOS-g
  > Not sure you'll be able to use Rosetta simulators. This has come up as an issue before: https://github.com/johnno1962/InjectionNext/issues/106. Rather than using the version where you launch Xcode from inside InjectionNext.app you may want to try the log parsing version where you use the "...or Watch Project" menu item.

- **Issue #123** (2026-01-19): **HotReload Macro**
  *Symptoms*: Hey there! I'm a happy user of this library, but always needing to add `@ObserveInjection` and `.enableInjection()` felt a bit repetitive. I wrote a small macro which does this for you, which reduces the boilerplate even more.  With this macro, you're able to write  ```swift @HotReload struct ExampleView: View {     var body: some View {         Text("Hello world!")     } } ```  Instead of: ```swift struct ExampleView: View {          @ObserveInjection var observe          var body: some View {         Text("Hello world!")             .enableInjection()     } } ```  ### Macro details After macro expansion, the struct will look like this:  ```swift struct ExampleView: View {     var body: some View {         Text("Hello world!")     }  #if DEBUG  @ObserveInjection private var __observeInjection  typealias Body = AnyView  @_implements(View, body) @_disfavoredOverload var __body: AnyView {     AnyView(body) } #endif } ```  **Some notes** - `__body` acts as a replacement for the existing `body` implementation. Essentially, we have two `body` implementations. `__body` will be picked instead of `body`, as its type matches the `Body` type which we explicitly set to `AnyView`. The macro enforces that the `body` type cannot be `AnyView`, as that would cause conflicts. - `@_disfavoredOverload` is added, so `body` has preference over `__body` when used inside `__body`. Confusing but without it it'll pick `__body` and cause infinite loo
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks very much for this but I'd be personally would be against including a macro in Inject due to the performance concerns only recently addressed.  If you want to furnish a macro I'd suggest creating another repo with Inject as a dependency so the two can be separate and Inject can remain lightweight.
  > I'm not sure if that's an issue with the trait? As mentioned, the trait is disabled by default, which also means that if you don't want to use the macro, swift-syntax isn't included in the dependency tree, so it's not fetched or compiled. Inject would then be as lightweight as it is today.
  > Your call @krzysztofzablocki, the change would bring the minimum supported Xcode to 16.3

- **Issue #122** (2025-09-23): **cmd+s**
  *Symptoms*: The reload only happens when we press cmd + s, right? Is there anyone updating the change without cmd+s or clicking on simulator? 
  **Post-Mortem & Fix Analysis**:
  > Thanks you for your three issues. Injection occurs when a file changes. This can also occur when you click on the simulator as Xcode does an auto save when it looses selection.

- **Issue #121** (2026-07-20): **watchOS Behaviour**
  *Symptoms*: `Value of type 'some View' has no member 'enableInjection'` when trying to build a watchOS target using `Inject` and `.enableInjection()`
  **Post-Mortem & Fix Analysis**:
  > I think the short answer to your question is that watchOS is not supported and may not even have been tried before now.
  > The release title for this one suggests otherwise, though?  https://github.com/johnno1962/InjectionIII/releases/tag/5.1.0
  > Perhaps you could try checking out and editing the Inject project ([howto](https://developer.apple.com/documentation/xcode/editing-a-package-dependency-as-a-local-package)) and removing any #if !os(watchOS) it contains or switch to https://github.com/johnno1962/HotSwiftUI which is similar and report back.

- **Issue #120** (2025-08-18): **Using from local SPM dependency?**
  *Symptoms*: I got the DemoApp working. However I haven't been able to get my own working, with Xcode 26b4 and the EMIT_FRONTEND_COMMAND_LINES=YES setting enabled. I'm using InjectionIII (didn't have luck with InjectionNext).  I have all my code in a Vendor/ submodule used as a local SPM dependency. I also added Inject as a dependency to this package (and to my Xcode workspace project). InjectIII turns yellow. Is it because the code is in this package and not directly part of the project? What can I do?  (Sometimes it looks like it's recompiling well when I save. However sometimes it shows the Inject library error message that enumerates several potential fixes.)
  **Post-Mortem & Fix Analysis**:
  > Answer I found was to use `defaults write com.apple.dt.Xcode EnableDebugActivityLogs -bool YES` but this hasn't helped either
  > Ah I get this:  ``` <unknown>:0: error: unknown argument: '-no-auto-bridging-header-chaining' <unknown>:0: error: unknown argument: '-in-process-plugin-server-path' ```
  > InjectionNext resolved it

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

### Incident Patch 1: `67e3ee9a` (2026-04-29)
**Commit Message**: Merge pull request #128 from brientim/fix/swift-6_3-concurrency

**File**: `Sources/Inject/InjectConfiguration.swift` (modified, +12/-12)
```diff
@@ -5,15 +5,15 @@ import SwiftUI
 #if !os(watchOS)
 /// Common protocol interface for classes that support observing injection events
 /// This is automatically added to all NSObject subclasses like `ViewController`s or `Window`s
-public protocol InjectListener {
+@MainActor public protocol InjectListener {
     associatedtype InjectInstanceType = Self
 
     func enableInjection()
     func onInjection(callback: @escaping (InjectInstanceType) -> Void) -> Void
 }
 
 /// Public namespace for using Inject API
-public enum InjectConfiguration {
+@MainActor public enum InjectConfiguration {
     public static var bundlePath = "/Applications/InjectionIII.app/Contents/Resources/"
     @available(iOS 13.0, *)
     public static let observer = injectionObserver
@@ -22,7 +22,7 @@ public enum InjectConfiguration {
     public static var animation: SwiftUI.Animation?
 }
 
-public extension InjectListener {
+@MainActor public extension InjectListener {
     /// Ensures injection is enabled
     @inlinable @inline(__always)
     func enableInjection() {
@@ -31,7 +31,7 @@ public extension InjectListener {
 }
 
 #if DEBUG
-private var loadInjectionImplementation: Void = {
+@MainActor private var loadInjectionImplementation: Void = {
     guard objc_getClass("InjectionClient") == nil else { return }
     // If project has a "Build Phase" running this script, Inject should
     // work on a device (requires an InjectionIII github release 4.8.0+):
@@ -71,7 +71,7 @@ private var loadInjectionImplementation: Void = {
 }()
 
 @available(iOS 13.0, *)
-public class InjectionObserver: ObservableObject {
+@MainActor public class InjectionObserver: ObservableObject {
     @Published public private(set) var injectionNumber = 0
     private var cancellable: AnyCancellable?
 
@@ -91,11 +91,11 @@ public class InjectionObserver: ObservableObject {
 }
 
 @available(iOS 13.0, *)
-private let injectionObserver = InjectionObserver()
+@MainActor private let injectionObserver = InjectionObserver()
 @available(iOS 13.0, *)
-private var injectionObservationKey = arc4random()
+@MainActor private var injectionObservationKey = arc4random()
 
-public extension InjectListener where Self: NSObject {
+@MainActor public extension InjectListener where Self: NSObject {
     func onInjection(callback: @escaping (Self) -> Void) {
         guard #available(iOS 13.0, *) else {
             return
@@ -111,12 +111,12 @@ public extension InjectListener where Self: NSObject {
 
 #else
 @available(iOS 13.0, *)
-public class InjectionObserver: ObservableObject {}
+@MainActor public class InjectionObserver: ObservableObject {}
 @available(iOS 13.0, *)
-private let injectionObserver = InjectionObserver()
-private var loadInjectionImplementation: Void = {}()
+@MainActor private let injectionObserver = InjectionObserver()
+@MainActor private var loadInjectionImplementation: Void = {}()
 
-public extension InjectListener where Self: NSObject {
+@MainActor public extension InjectListener where Self: NSObject {
     @inlinable @inline(__always)
     func onInjection(callback: @escaping (Self) -> Void) {}
 }
```

**File**: `Sources/Inject/Integrations/Hosts.swift` (modified, +2/-2)
```diff
@@ -182,7 +182,7 @@ public class _InjectableViewHost<Hosted: InjectViewType>: InjectViewType {
     }
 }
 
-extension InjectConfiguration {
+@MainActor extension InjectConfiguration {
     public static func ViewControllerHost<Hosted: InjectViewControllerType>(_ viewController: Hosted) -> ViewControllerHost<Hosted> {
         Inject.ViewControllerHost(viewController)
     }
@@ -192,7 +192,7 @@ extension InjectConfiguration {
 }
 #else
 
-extension InjectConfiguration {
+@MainActor extension InjectConfiguration {
     public static func ViewControllerHost<Hosted: InjectViewControllerType>(_ viewController: Hosted) -> Hosted {
         viewController
     }
```

**File**: `Sources/Inject/Integrations/SwiftUI.swift` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ public extension SwiftUI.View {
 @propertyWrapper @preconcurrency @MainActor
 public struct ObserveInjection: DynamicProperty {
     @ObservedObject private var iO = InjectConfiguration.observer
-    public nonisolated init() {}
+    public init() {}
     // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
     public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
 }
@@ -45,7 +45,7 @@ public extension SwiftUI.View {
 @available(iOS 13.0, *)
 @propertyWrapper @preconcurrency @MainActor
 public struct ObserveInjection: DynamicProperty {
-    public nonisolated init() {}
+    public init() {}
     // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
     public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
 }
```

---

### Incident Patch 2: `383ffe78` (2026-04-29)
**Commit Message**: fix: align Inject with Swift 6 concurrency isolation

Apply MainActor isolation to Inject configuration and listener APIs, and update SwiftUI property wrapper initialization so strict Swift 6 builds pass without mutable global concurrency diagnostics.

Made-with: Cursor

**File**: `Sources/Inject/InjectConfiguration.swift` (modified, +12/-12)
```diff
@@ -5,15 +5,15 @@ import SwiftUI
 #if !os(watchOS)
 /// Common protocol interface for classes that support observing injection events
 /// This is automatically added to all NSObject subclasses like `ViewController`s or `Window`s
-public protocol InjectListener {
+@MainActor public protocol InjectListener {
     associatedtype InjectInstanceType = Self
 
     func enableInjection()
     func onInjection(callback: @escaping (InjectInstanceType) -> Void) -> Void
 }
 
 /// Public namespace for using Inject API
-public enum InjectConfiguration {
+@MainActor public enum InjectConfiguration {
     public static var bundlePath = "/Applications/InjectionIII.app/Contents/Resources/"
     @available(iOS 13.0, *)
     public static let observer = injectionObserver
@@ -22,7 +22,7 @@ public enum InjectConfiguration {
     public static var animation: SwiftUI.Animation?
 }
 
-public extension InjectListener {
+@MainActor public extension InjectListener {
     /// Ensures injection is enabled
     @inlinable @inline(__always)
     func enableInjection() {
@@ -31,7 +31,7 @@ public extension InjectListener {
 }
 
 #if DEBUG
-private var loadInjectionImplementation: Void = {
+@MainActor private var loadInjectionImplementation: Void = {
     guard objc_getClass("InjectionClient") == nil else { return }
     // If project has a "Build Phase" running this script, Inject should
     // work on a device (requires an InjectionIII github release 4.8.0+):
@@ -71,7 +71,7 @@ private var loadInjectionImplementation: Void = {
 }()
 
 @available(iOS 13.0, *)
-public class InjectionObserver: ObservableObject {
+@MainActor public class InjectionObserver: ObservableObject {
     @Published public private(set) var injectionNumber = 0
     private var cancellable: AnyCancellable?
 
@@ -91,11 +91,11 @@ public class InjectionObserver: ObservableObject {
 }
 
 @available(iOS 13.0, *)
-private let injectionObserver = InjectionObserver()
+@MainActor private let injectionObserver = InjectionObserver()
 @available(iOS 13.0, *)
-private var injectionObservationKey = arc4random()
+@MainActor private var injectionObservationKey = arc4random()
 
-public extension InjectListener where Self: NSObject {
+@MainActor public extension InjectListener where Self: NSObject {
     func onInjection(callback: @escaping (Self) -> Void) {
         guard #available(iOS 13.0, *) else {
             return
@@ -111,12 +111,12 @@ public extension InjectListener where Self: NSObject {
 
 #else
 @available(iOS 13.0, *)
-public class InjectionObserver: ObservableObject {}
+@MainActor public class InjectionObserver: ObservableObject {}
 @available(iOS 13.0, *)
-private let injectionObserver = InjectionObserver()
-private var loadInjectionImplementation: Void = {}()
+@MainActor private let injectionObserver = InjectionObserver()
+@MainActor private var loadInjectionImplementation: Void = {}()
 
-public extension InjectListener where Self: NSObject {
+@MainActor public extension InjectListener where Self: NSObject {
     @inlinable @inline(__always)
     func onInjection(callback: @escaping (Self) -> Void) {}
 }
```

**File**: `Sources/Inject/Integrations/Hosts.swift` (modified, +2/-2)
```diff
@@ -182,7 +182,7 @@ public class _InjectableViewHost<Hosted: InjectViewType>: InjectViewType {
     }
 }
 
-extension InjectConfiguration {
+@MainActor extension InjectConfiguration {
     public static func ViewControllerHost<Hosted: InjectViewControllerType>(_ viewController: Hosted) -> ViewControllerHost<Hosted> {
         Inject.ViewControllerHost(viewController)
     }
@@ -192,7 +192,7 @@ extension InjectConfiguration {
 }
 #else
 
-extension InjectConfiguration {
+@MainActor extension InjectConfiguration {
     public static func ViewControllerHost<Hosted: InjectViewControllerType>(_ viewController: Hosted) -> Hosted {
         viewController
     }
```

**File**: `Sources/Inject/Integrations/SwiftUI.swift` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ public extension SwiftUI.View {
 @propertyWrapper @preconcurrency @MainActor
 public struct ObserveInjection: DynamicProperty {
     @ObservedObject private var iO = InjectConfiguration.observer
-    public nonisolated init() {}
+    public init() {}
     // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
     public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
 }
@@ -45,7 +45,7 @@ public extension SwiftUI.View {
 @available(iOS 13.0, *)
 @propertyWrapper @preconcurrency @MainActor
 public struct ObserveInjection: DynamicProperty {
-    public nonisolated init() {}
+    public init() {}
     // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
     public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
 }
```

---

### Incident Patch 3: `528935b4` (2024-12-29)
**Commit Message**: feat: Add optional build script to automate Inject setup in SwiftUI views (use with caution)

This commit introduces an optional build phase script that automates the process of adding the necessary Inject dependencies to SwiftUI view files.

**What the script does:**

The script iterates through all Swift files in the project and, for each file containing `: View {`, it attempts to:

1.  Add `import Inject` if it's not already present.
2.  Add `@ObserveInjection var inject` inside the struct definition.
3.  Add `.enableInjection()` just before the closing brace of the `var body: some View {` definition.

**How to use it:**

To use the script, add it as a "Run Script" build phase in your Xcode project target's "Build Phases" settings. Instructions on how to do this are provided in the README.

**Potential risks and limitations:**

**THIS SCRIPT MODIFIES YOUR SOURCE CODE. USE IT WITH CAUTION AND REVIEW THE CHANGES IT MAKES.**

**File**: `README.md` (modified, +85/-0)
```diff
@@ -141,6 +141,91 @@ presenter.ui = hostedViewController
 }
 ```
 
+## (Optional) Automatic Injection Script
+
+> **WARNING:** This script automatically modifies your Swift source code. It's provided as a convenience but use it with caution!  Review the changes it makes carefully. It might not be suitable for all projects or coding styles. Consider using Xcode code snippets for more manual control.
+
+To automatically add `import Inject`, `@ObserveInjection var inject`, and `.enableInjection()` to your SwiftUI views, you can add the following script as a "Run Script" build phase in your Xcode project:
+
+```sh
+#!/bin/bash
+
+# Function to modify a single Swift file
+modify_swift_file() {
+    local filepath="$1"
+    local filename=$(basename "$filepath")
+    local tempfile="$filepath.tmp"
+
+    # Check if the file should be processed
+    if [[ $(grep -c ": View {" "$filepath") -eq 0 ]]; then
+        echo "Skipping: $filename (No ': View {' found)"
+        return
+    fi
+
+    # Create a temporary file for modifications
+    cp "$filepath" "$tempfile"
+
+    # 1. Add import Inject if needed
+    if ! grep -q "import Inject" "$tempfile"; then
+        sed -i '' -e '/^import SwiftUI/a\
+import Inject' "$tempfile"
+    fi
+
+    # 2. Add @ObserveInjection var inject if needed
+    if ! grep -q "@ObserveInjection var inject" "$tempfile"; then
+        sed -i '' -e '/struct.*: View {/a\
+    @ObserveInjection var inject' "$tempfile"
+    fi
+
+    # 3. Add .enableInjection() just before the closing brace of the body
+    # Find the start of var body: some View {
+    local body_start_line=$(grep -n "var body: some View {" "$tempfile" | cut -d ':' -f 1)
+
+    if [[ -n "$body_start_line" ]]; then
+        # Get the line number of the closing brace of the body
+        local body_end_line=$(awk -v start="$body_start_line" '
+            NR == start { count = 1 }
+            NR > start {
+                if ($0 ~ /{/) count++
+                if ($0 ~ /}/) {
+                    count--
+                    if (count == 0) {
+                        print NR
+                        exit
+                    }
+                }
+            }
+        ' "$tempfile")
+
+        if [[ -n "$body_end_line" ]]; then
+            # Check if .enableInjection() is already present
+            if ! grep -q ".enableInjection()" "$tempfile"; then
+                # Insert .enableInjection() before the closing brace of the body
+                sed -i '' -e "${body_end_line}i\\
+        .enableInjection()" "$tempfile"
+            fi
+        fi
+    fi
+
+    # Check if modifications were made and overwrite the original file
+    if ! cmp -s "$filepath" "$tempfile"; then
+        mv "$tempfile" "$filepath"
+        echo "Modified: $filename"
+    else
+        echo "No changes for: $filename"
+    fi
+
+    rm -f "$tempfile"
+}
+
+# Main script
+find "$SRCROOT" -name "*.swift" -print0 | while IFS= read -r -d $'\0' filepath; do
+    modify_swift_file "$filepath"
+done
+
+echo "Inject modification script completed."
+```
+
 #### iOS 12
 You need to add -weak_framework SwiftUI to Other Linker Flags for iOS 12 to work.
 
```

---

### Incident Patch 4: `e03a1df6` (2024-12-03)
**Commit Message**: Update Readme to clarify Xlinker flag to debug builds only

**File**: `README.md` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ pod 'InjectHotReload'
 ### Individual Developer setup (once per machine)
 If anyone in your project wants to use injection, they only need to:
 
-- You must add "-Xlinker -interposable" (without the double quotes and on separate lines) to the "Other Linker Flags" of all targets in your project for the Debug configuration (qualified by the simulator SDK to avoid complications with bitcode), refer to [InjectionForXcode documentation](https://github.com/johnno1962/InjectionIII#limitationsfaq) if you run into any issues
+- You must add "-Xlinker -interposable" (without the double quotes and on separate lines) to the "Other Linker Flags" of all targets in your project for the **Debug** configuration (qualified by the simulator SDK to avoid complications with bitcode), refer to [InjectionForXcode documentation](https://github.com/johnno1962/InjectionIII#limitationsfaq) if you run into any issues
 -  Download newest version of Xcode Injection from it's [GitHub Page](https://github.com/johnno1962/InjectionIII/releases)
   - Unpack it and place under `/Applications`
 - Make sure that the Xcode version you are using to compile our projects is under the default location: `/Applications/Xcode.app`
```

---

### Incident Patch 5: `6ce9700f` (2024-07-06)
**Commit Message**: Merge pull request #97 from Archery-Inc/fix-94

**File**: `Sources/Inject/Integrations/Hosts.swift` (modified, +9/-0)
```diff
@@ -181,6 +181,15 @@ public class _InjectableViewHost<Hosted: InjectViewType>: InjectViewType {
         instance[keyPath: keyPath]
     }
 }
+
+extension InjectConfiguration {
+    public static func ViewControllerHost<Hosted: InjectViewControllerType>(_ viewController: Hosted) -> ViewControllerHost<Hosted> {
+        Inject.ViewControllerHost(viewController)
+    }
+    public static func ViewHost<Hosted: InjectViewType>(_ view: Hosted) -> ViewHost<Hosted> {
+        Inject.ViewHost(view)
+    }
+}
 #else
 
 extension InjectConfiguration {
```

---

### Incident Patch 6: `49a4e0f1` (2024-07-05)
**Commit Message**: Add ViewControllerHost and ViewHost functions in InjectConfiguration in DEBUG mode (fixes #94, relates to #82)

The API contract between DEBUG and non-DEBUG builds is still not strictly equivalent as the functions will return a wrapper in DEBUG mode and the original view in prod, and thus the return types of the functions are not the same in the two environments.
That should not be an issue unless the client is trying to keep a reference to a view given by any of those two functions while specifying explicitly the type of the reference (e.g. `let view: MyView = InjectConfiguration.ViewHost(myView)`).
In practice I don’t think this will be an issue.

**File**: `Sources/Inject/Integrations/Hosts.swift` (modified, +9/-0)
```diff
@@ -181,6 +181,15 @@ public class _InjectableViewHost<Hosted: InjectViewType>: InjectViewType {
         instance[keyPath: keyPath]
     }
 }
+
+extension InjectConfiguration {
+    public static func ViewControllerHost<Hosted: InjectViewControllerType>(_ viewController: Hosted) -> ViewControllerHost<Hosted> {
+        Inject.ViewControllerHost(viewController)
+    }
+    public static func ViewHost<Hosted: InjectViewType>(_ view: Hosted) -> ViewHost<Hosted> {
+        Inject.ViewHost(view)
+    }
+}
 #else
 
 extension InjectConfiguration {
```

---

### Incident Patch 7: `5ddde54c` (2024-06-27)
**Commit Message**: Merge pull request #95 from john-flanagan/jflan/crash-workaround

Work around String metatype bug

**File**: `Sources/Inject/Integrations/SwiftUI.swift` (modified, +4/-2)
```diff
@@ -26,7 +26,8 @@ public extension SwiftUI.View {
 public struct ObserveInjection: DynamicProperty {
     @ObservedObject private var iO = InjectConfiguration.observer
     public init() {}
-    public private(set) var wrappedValue: InjectConfiguration.Type = InjectConfiguration.self
+    // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
+    public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
 }
 
 #else
@@ -45,7 +46,8 @@ public extension SwiftUI.View {
 @propertyWrapper @MainActor
 public struct ObserveInjection: DynamicProperty {
     public init() {}
-    public private(set) var wrappedValue: InjectConfiguration.Type = InjectConfiguration.self
+    // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
+    public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
 }
 #endif
 #endif
```

---

### Incident Patch 8: `911247fb` (2024-06-27)
**Commit Message**: Work around String metatype bug

**File**: `Sources/Inject/Integrations/SwiftUI.swift` (modified, +4/-2)
```diff
@@ -26,7 +26,8 @@ public extension SwiftUI.View {
 public struct ObserveInjection: DynamicProperty {
     @ObservedObject private var iO = InjectConfiguration.observer
     public init() {}
-    public private(set) var wrappedValue: InjectConfiguration.Type = InjectConfiguration.self
+    // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
+    public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
 }
 
 #else
@@ -45,7 +46,8 @@ public extension SwiftUI.View {
 @propertyWrapper @MainActor
 public struct ObserveInjection: DynamicProperty {
     public init() {}
-    public private(set) var wrappedValue: InjectConfiguration.Type = InjectConfiguration.self
+    // Use a computed property rather than directly storing the value to work around https://github.com/swiftlang/swift/issues/62003
+    public var wrappedValue: InjectConfiguration.Type { InjectConfiguration.self }
 }
 #endif
 #endif
```

---

### Incident Patch 9: `cf2d5551` (2024-03-04)
**Commit Message**: Merge pull request #88 from niorko/fix/make-targets-that-are-used-in-watchos-buildable

Workaround for Inject Frameworks (Conditionally Excludes Code in WatchOS)

**File**: `Sources/Inject/Inject.swift` (modified, +2/-0)
```diff
@@ -2,6 +2,7 @@ import Foundation
 import Combine
 import SwiftUI
 
+#if !os(watchOS)
 /// Common protocol interface for classes that support observing injection events
 /// This is automatically added to all NSObject subclasses like `ViewController`s or `Window`s
 public protocol InjectListener {
@@ -116,3 +117,4 @@ public extension InjectListener where Self: NSObject {
     func onInjection(callback: @escaping (Self) -> Void) {}
 }
 #endif // DEBUG
+#endif
```

**File**: `Sources/Inject/Integrations/Hosts.swift` (modified, +2/-0)
```diff
@@ -1,3 +1,4 @@
+#if !os(watchOS)
 #if canImport(UIKit)
 import UIKit
 public typealias InjectViewControllerType = UIViewController
@@ -180,3 +181,4 @@ extension Inject {
 }
 
 #endif
+#endif
```

**File**: `Sources/Inject/Integrations/KitFrameworks.swift` (modified, +3/-1)
```diff
@@ -1,3 +1,4 @@
+#if !os(watchOS)
 #if canImport(UIKit)
 import Foundation
 import UIKit
@@ -11,4 +12,5 @@ import Foundation
 extension NSView: InjectListener {}
 extension NSViewController: InjectListener {}
 extension NSWindow: InjectListener {}
-#endif
\ No newline at end of file
+#endif
+#endif
```

**File**: `Sources/Inject/Integrations/SwiftUI.swift` (modified, +2/-0)
```diff
@@ -1,6 +1,7 @@
 import Foundation
 import SwiftUI
 
+#if !os(watchOS)
 #if DEBUG
 @available(iOS 13.0, *)
 public extension SwiftUI.View {
@@ -47,3 +48,4 @@ public struct ObserveInjection {
     public private(set) var wrappedValue: Inject.Type = Inject.self
 }
 #endif
+#endif
```

---

### Incident Patch 10: `6991982e` (2024-03-01)
**Commit Message**: Make shared targets that are used for WatchOS buildable

**File**: `Sources/Inject/Inject.swift` (modified, +2/-0)
```diff
@@ -2,6 +2,7 @@ import Foundation
 import Combine
 import SwiftUI
 
+#if !os(watchOS)
 /// Common protocol interface for classes that support observing injection events
 /// This is automatically added to all NSObject subclasses like `ViewController`s or `Window`s
 public protocol InjectListener {
@@ -116,3 +117,4 @@ public extension InjectListener where Self: NSObject {
     func onInjection(callback: @escaping (Self) -> Void) {}
 }
 #endif // DEBUG
+#endif
```

**File**: `Sources/Inject/Integrations/Hosts.swift` (modified, +2/-0)
```diff
@@ -1,3 +1,4 @@
+#if !os(watchOS)
 #if canImport(UIKit)
 import UIKit
 public typealias InjectViewControllerType = UIViewController
@@ -180,3 +181,4 @@ extension Inject {
 }
 
 #endif
+#endif
```

**File**: `Sources/Inject/Integrations/KitFrameworks.swift` (modified, +3/-1)
```diff
@@ -1,3 +1,4 @@
+#if !os(watchOS)
 #if canImport(UIKit)
 import Foundation
 import UIKit
@@ -11,4 +12,5 @@ import Foundation
 extension NSView: InjectListener {}
 extension NSViewController: InjectListener {}
 extension NSWindow: InjectListener {}
-#endif
\ No newline at end of file
+#endif
+#endif
```

**File**: `Sources/Inject/Integrations/SwiftUI.swift` (modified, +2/-0)
```diff
@@ -1,6 +1,7 @@
 import Foundation
 import SwiftUI
 
+#if !os(watchOS)
 #if DEBUG
 @available(iOS 13.0, *)
 public extension SwiftUI.View {
@@ -47,3 +48,4 @@ public struct ObserveInjection {
     public private(set) var wrappedValue: Inject.Type = Inject.self
 }
 #endif
+#endif
```

---

### Incident Patch 11: `8f0458f7` (2023-09-05)
**Commit Message**: Merge pull request #79 from zenangst/fix/tvos-not-compiling

**File**: `Sources/Inject/Integrations/Hosts.swift` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ open class _InjectableViewControllerHost<Hosted: InjectViewControllerType>: Inje
         fatalError("init(coder:) has not been implemented")
     }
     
-#if canImport(UIKit)
+#if canImport(UIKit) && os(iOS)
     override open var childForStatusBarStyle: InjectViewControllerType? {
         instance
     }
```

---

### Incident Patch 12: `2057eb98` (2023-07-28)
**Commit Message**: fix catalyst

**File**: `Sources/Inject/Inject.swift` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ private var loadInjectionImplementation: Void = {
     let bundleName = "maciOSInjection.bundle"
 #endif // OS and environment conditions
 
-#if targetEnvironment(simulator) || os(macOS)
+#if targetEnvironment(simulator) || os(macOS) || targetEnvironment(macCatalyst)
 
     if let bundle = Bundle(path: Inject.bundlePath + bundleName) {
         bundle.load()
```

---

### Incident Patch 13: `abcc4b09` (2023-02-07)
**Commit Message**: Merge pull request #69 from krzysztofzablocki/fix-fatal-error

Replace fatal error

**File**: `Sources/Inject/Inject.swift` (modified, +3/-1)
```diff
@@ -43,11 +43,13 @@ private var loadInjectionImplementation: Void = {
     let bundleName = "maciOSInjection.bundle"
 #endif // OS and environment conditions
 
+#if targetEnvironment(simulator) || os(macOS)
     if let bundle = Bundle(path: "/Applications/InjectionIII.app/Contents/Resources/" + bundleName) {
         bundle.load()
     } else {
-        assertionFailure("InjectionIII not found, verify if it's in /Applications")
+        print("⚠️ Inject: InjectionIII not found, verify if it's in /Applications")
     }
+#endif
 }()
 
 @available(iOS 13.0, *)
```

---

### Incident Patch 14: `ba34ac1a` (2023-02-06)
**Commit Message**: fix: replace fatal error

**File**: `Sources/Inject/Inject.swift` (modified, +3/-1)
```diff
@@ -43,11 +43,13 @@ private var loadInjectionImplementation: Void = {
     let bundleName = "maciOSInjection.bundle"
 #endif // OS and environment conditions
 
+#if targetEnvironment(simulator) || os(macOS)
     if let bundle = Bundle(path: "/Applications/InjectionIII.app/Contents/Resources/" + bundleName) {
         bundle.load()
     } else {
-        assertionFailure("InjectionIII not found, verify if it's in /Applications")
+        print("⚠️ Inject: InjectionIII not found, verify if it's in /Applications")
     }
+#endif
 }()
 
 @available(iOS 13.0, *)
```

---

### Incident Patch 15: `fb3a4ec6` (2023-01-19)
**Commit Message**: fix: grammar

**File**: `Sources/Inject/Inject.swift` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ private var loadInjectionImplementation: Void = {
     if let bundle = Bundle(path: "/Applications/InjectionIII.app/Contents/Resources/" + bundleName) {
         bundle.load()
     } else {
-        assertionFailure("InjectionIII not found, verify it is in /Applications")
+        assertionFailure("InjectionIII not found, verify if it's in /Applications")
     }
 }()
 
```

#### Recent Merged Pull Requests:
- **PR #128** (2026-04-29): fix: align Inject with Swift 6 concurrency isolation (@brientim)
- **PR #123** (closed): HotReload Macro (@Wouter01)
- **PR #114** (2025-05-08): Add fallback to InjectionNext (@johnno1962)
- **PR #108** (2025-01-02): feat: Add optional build script to automate Inject setup in SwiftUI views (@KevinDoremy)
- **PR #106** (2024-12-04): Update Readme to clarify Xlinker flag to debug builds only (@teameh)
- **PR #105** (2024-11-25): .enableInjection() may not have been called. (@johnno1962)
- **PR #99** (2024-08-19): Update README.md (@AgapovOne)
- **PR #98** (2024-07-19): Update ObserveInjection concurrency (@john-flanagan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
