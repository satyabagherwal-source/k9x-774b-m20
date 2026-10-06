# Forensic Learning Record (Deep Inspection): SvenTiigi/WhatsNewKit

> **Canonical Artifact**: `07_PROJECT_LEARNING/sventiigi-whatsnewkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SvenTiigi/WhatsNewKit](https://github.com/SvenTiigi/WhatsNewKit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:56:54.549Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SvenTiigi/WhatsNewKit`
- **Description**: Showcase your awesome new app features 📱
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4430 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Example/Example/App.swift`
```
import SwiftUI
import WhatsNewKit

// MARK: - App

/// The App
@main
struct App {}

// MARK: - SwiftUI.App

extension App: SwiftUI.App {
    
    /// The content and behavior of the app.
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(
                    \.whatsNew,
                     .init(
                        versionStore: InMemoryWhatsNewVersionStore(),
                        whatsNewCollection: self
                     )
                )
        }
    }
    
}

// MARK: - App+WhatsNewCollectionProvider

extension App: WhatsNewCollectionProvider {
    
    /// A WhatsNewCollection
    var whatsNewCollection: WhatsNewCollection {
        WhatsNew(
            version: "1.0.0",
            title: "WhatsNewKit",
            features: [
                .init(
                    image: .init(
                        systemName: "star.fill",
                        foregroundColor: .orange
                    ),
                    title: "Showcase your new App Features",
                    subtitle: "Present your new app features just like a native app from Apple."
                ),
                .init(
                    image: .init(
                        systemName: "wand.and.stars",
                        foregroundColor: .cyan
                    ),
                    title: "Automatic Presentation",
                    subtitle: .init(
                        try! AttributedString(
                            markdown: "Simply declare a WhatsNew per Version and present it automatically by using the `.whatsNewSheet()` modifier."
                        )
                    )
                ),
                .init(
                    image: .init(
                        systemName: "gear.circle.fill",
                        foregroundColor: .gray
                    ),
                    title: "Configuration",
                    subtitle: "Easily adjust colors, strings, haptic feedback, behaviours and the layout of the presented WhatsNewView to your needs."
                ),
                .init(
                    image: .init(
                        systemName: "swift",
                        foregroundColor: .init(.init(red: 240.0 / 255, green: 81.0 / 255, blue: 56.0 / 255, alpha: 1))
                    ),
                    title: "Swift Package Manager",
                    subtitle: "WhatsNewKit can be easily integrated via the Swift Package Manager."
                )
            ],
            primaryAction: .init(
                hapticFeedback: {
                    #if os(iOS)
                    .notification(.success)
                    #else
                    nil
                    #endif
                }()
            ),
            secondaryAction: .init(
                title: "Learn more",
                action: .openURL(.init(string: "https://github.com/SvenTiigi/WhatsNewKit"))
            )
        )
    }
    
}

```

### Core Architecture Module: `Example/Example/ContentView.swift`
```
import SwiftUI
import WhatsNewKit

// MARK: - ContentView

/// The ContentView
struct ContentView {}

// MARK: - View

extension ContentView: View {
    
    /// The content and behavior of the view
    var body: some View {
        NavigationStack {
            ExamplesView()
        }
        .whatsNewSheet()
    }
    
}

```

### Core Architecture Module: `Example/Example/ExamplesView.swift`
```
import SwiftUI
import WhatsNewKit

// MARK: - ExamplesView

/// The ExamplesView
struct ExamplesView {
    
    /// The Examples
    private let examples = WhatsNew.Example.allCases
    
    /// The currently presented WhatsNew object
    @State
    private var whatsNew: WhatsNew?
    
}

// MARK: - View

extension ExamplesView: View {
    
    /// The content and behavior of the view
    var body: some View {
        List {
            Section(
                header: Text(
                    verbatim: "Examples"
                ),
                footer: Text(
                    verbatim: "Tap on an example to manually present a WhatsNewView"
                )
            ) {
                ForEach(
                    self.examples,
                    id: \.rawValue
                ) { example in
                    Button(
                        action: {
                            self.whatsNew = example.whatsNew
                        }
                    ) {
                        Text(
                            verbatim: example.displayName
                        )
                    }
                }
            }
        }
        .navigationTitle("WhatsNewKit")
        .sheet(
            whatsNew: self.$whatsNew
        )
    }
    
}

// MARK: - WhatsNew+Example

private extension WhatsNew {
    
    /// A WhatsNew Example
    enum Example: String, Codable, Hashable, CaseIterable {
        /// Calendar
        case calendar
        /// Maps
        case maps
        /// Translate
        case translate
    }
    
}

// MARK: - WhatsNew+Example+displayName

private extension WhatsNew.Example {
    
    /// The user friendly display name
    var displayName: String {
        self.rawValue.prefix(1).capitalized + self.rawValue.dropFirst()
    }
    
}

// MARK: - WhatsNew+Example+whatsNew

private extension WhatsNew.Example {
    
    /// The WhatsNew
    var whatsNew: WhatsNew {
        switch self {
        case .calendar:
            return .init(
                title: "What's New in Calendar",
                features: [
                    .init(
                        image: .init(
                            systemName: "envelope",
                            foregroundColor: .red
                        ),
                        title: "Found Events",
                        subtitle: "Siri suggests events found in Mail, Messages, and Safari, so you can add them easily, such as flight reservations and hotel bookings."
                    ),
                    .init(
                        image: .init(
                            systemName: "clock",
                            foregroundColor: .red
                        ),
                        title: "Time to Leave",
                        subtitle: "Calendar uses Apple Maps to look up locations, traffic conditions, and transit options to tell you when it's time to leave."
                    ),
                    .init(
                        image: .init(
                            systemName: "location",
                            foregroundColor: .red
                        ),
                        title: "Location Suggestions",
                        subtitle: "Calendar suggests locations based on your past events and significant locations."
                    )
                ],
                primaryAction: .init(
                    backgroundColor: .red
                )
            )
        case .maps:
            return .init(
                title: "What's New in Maps",
                features: [
                    .init(
                        image: .init(
                            systemName: "map.fill",
                            foregroundColor: .green
                        ),
                        title: "Updated Map Style",
                        subtitle: "An improved design makes it easier to navigate and explore the map."
                    ),
                    .init(
                        image: .init(
                            systemName: "mappin.and.ellipse",
                            foregroundColor: .pink
                        ),
                        title: "All-New Place Cards",
                        subtitle: "Completely redesigned place cards make it easier to learn about and interact with places."
                    ),
                    .init(
                        image: .init(
                            systemName: "magnifyingglass",
                            foregroundColor: .blue
                        ),
                        title: "Improved Search",
                        subtitle: "Finding places is now easier with filters and automatic updates when you're browsing results on the map."
                    )
                ],
                primaryAction: .init(backgroundColor: .blue),
                secondaryAction: .init(
                    title: "About Apple Maps & Privacy",
                    foregroundColor: .blue,
                    action: .openURL(.init(string: "maps://"))
                )
            )
        case .translate:
            return .init(
                title: .init(
                    text: .init(
                        "What's New in "
                        + AttributedString(
                            "Translate",
                            attributes: .foregroundColor(.cyan)
                        )
                    )
                ),
                features: [
                    .init(
                        image: .init(
                            systemName: "rectangle.portrait.bottomthird.inset.filled",
                            foregroundColor: .cyan
                        ),
                        title: "Conversation Views",
                        subtitle: "Choose a side-by-side or face-to-face conversation view."
                    ),
                    .init(
                        image: .init(
                            systemName: "mic",
                            foregroundColor: .cyan
                        ),
                        title: "Auto Translate",
                        subtitle: "Respond in conversations without tapping the microphone button."
                    ),
                    .init(
                        image: .init(
                            systemName: "iphone",
                            foregroundColor: .cyan
                        ),
                        title: "System-Wide Translation",
                        subtitle: "Translate selected text anywhere on your iPhone."
                    )
                ],
                primaryAction: .init(
                    backgroundColor: .cyan
                ),
                secondaryAction: .init(
                    title: "About Translation & Privacy",
                    foregroundColor: .cyan,
                    action: .openURL(
                        .init(string: "https://apple.com/privacy")
                    )
                )
            )
        }
    }
    
}

// MARK: - AttributeContainer+foregroundColor

private extension AttributeContainer {
    
    /// A AttributeContainer with a given foreground color
    /// - Parameter color: The foreground color
    static func foregroundColor(
        _ color: Color
    ) -> Self {
        var container = Self()
        container.foregroundColor = color
        return container
    }
    
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "WhatsNewKit",
    platforms: [
        .iOS(.v13),
        .macOS(.v11),
        .visionOS(.v1)
    ],
    products: [
        .library(
            name: "WhatsNewKit",
            targets: [
                "WhatsNewKit"
            ]
        )
    ],
    targets: [
        .target(
            name: "WhatsNewKit",
            path: "Sources",
            resources: [
                .process("Resources/PrivacyInfo.xcprivacy")
            ]
        ),
        .testTarget(
            name: "WhatsNewKitTests",
            dependencies: [
                "WhatsNewKit"
            ],
            path: "Tests"
        )
    ]
)

```

### Core Architecture Module: `Sources/Collection/WhatsNewCollection.swift`
```
import Foundation

/// A WhatsNewCollection type representing an array of WhatsNew elements
public typealias WhatsNewCollection = [WhatsNew]

```

### Core Architecture Module: `Sources/Collection/WhatsNewCollectionProvider.swift`
```
import Foundation

// MARK: - WhatsNewProvider

/// A WhatsNewCollection Provider type
public protocol WhatsNewCollectionProvider {
    
    /// A WhatsNewCollection
    @WhatsNewCollectionBuilder
    var whatsNewCollection: WhatsNewCollection { get }
    
}

```

### Core Architecture Module: `Sources/Environment/WhatsNewEnvironment+Key.swift`
```
import SwiftUI

// MARK: - WhatsNewEnvironment+Key

public extension WhatsNewEnvironment {
    
    /// The WhatsNewEnvironment Key
    enum Key: EnvironmentKey {
        
        /// The default value for the environment key
        public static var defaultValue = WhatsNewEnvironment()
        
    }
    
}

// MARK: - EnvironmentValues+whatsNew

public extension EnvironmentValues {
    
    /// The WhatsNewEnvironment
    var whatsNew: WhatsNewEnvironment {
        get {
            self[WhatsNewEnvironment.Key.self]
        }
        set {
            self[WhatsNewEnvironment.Key.self] = newValue
        }
    }
    
}

```

### Core Architecture Module: `Sources/Environment/WhatsNewEnvironment.swift`
```
import Foundation

// MARK: - WhatsNewEnvironment

/// A WhatsNew Environment
open class WhatsNewEnvironment {
    
    // MARK: Properties
    
    /// The current WhatsNew Version
    public let currentVersion: WhatsNew.Version
    
    /// The WhatsNewVersionStore
    public let whatsNewVersionStore: WhatsNewVersionStore
    
    /// The default WhatsNew Layout
    public let defaultLayout: WhatsNew.Layout
    
    /// The WhatsNewCollection
    public let whatsNewCollection: WhatsNewCollection
    
    // MARK: Initializer
    
    /// Creates a new instance of `WhatsNewEnvironment`
    /// - Parameters:
    ///   - currentVersion: The current WhatsNew Version. Default value `.current()`
    ///   - versionStore: The WhatsNewVersionStore. Default value `UserDefaultsWhatsNewVersionStore()`
    ///   - defaultLayout: The default WhatsNew Layout. Default value `.default`
    ///   - whatsNewCollection: The WhatsNewCollection
    public init(
        currentVersion: WhatsNew.Version = .current(),
        versionStore: WhatsNewVersionStore = UserDefaultsWhatsNewVersionStore(),
        defaultLayout: WhatsNew.Layout = .default,
        whatsNewCollection: WhatsNewCollection = .init()
    ) {
        self.currentVersion = currentVersion
        self.whatsNewVersionStore = versionStore
        self.defaultLayout = defaultLayout
        self.whatsNewCollection = whatsNewCollection
    }
    
    /// Creates a new instance of `WhatsNewEnvironment`
    /// - Parameters:
    ///   - currentVersion: The current WhatsNew Version. Default value `.current()`
    ///   - versionStore: The WhatsNewVersionStore. Default value `UserDefaultsWhatsNewVersionStore()`
    ///   - defaultLayout: The default WhatsNew Layout. Default value `.default`
    ///   - whatsNewCollection: The WhatsNewCollectionProvider
    public convenience init(
        currentVersion: WhatsNew.Version = .current(),
        versionStore: WhatsNewVersionStore = UserDefaultsWhatsNewVersionStore(),
        defaultLayout: WhatsNew.Layout = .default,
        whatsNewCollection whatsNewCollectionProvider: WhatsNewCollectionProvider
    ) {
        self.init(
            currentVersion: currentVersion,
            versionStore: versionStore,
            defaultLayout: defaultLayout,
            whatsNewCollection: whatsNewCollectionProvider.whatsNewCollection
        )
    }
    
    /// Creates a new instance of `WhatsNewEnvironment`
    /// - Parameters:
    ///   - currentVersion: The current WhatsNew Version. Default value `.current()`
    ///   - versionStore: The WhatsNewVersionStore. Default value `UserDefaultsWhatsNewVersionStore()`
    ///   - defaultLayout: The default WhatsNew Layout. Default value `.default`
    ///   - whatsNewCollection: A result builder closure that produces a WhatsNewCollection
    public convenience init(
        currentVersion: WhatsNew.Version = .current(),
        versionStore: WhatsNewVersionStore = UserDefaultsWhatsNewVersionStore(),
        defaultLayout: WhatsNew.Layout = .default,
        @WhatsNewCollectionBuilder
        whatsNewCollection: () -> WhatsNewCollection
    ) {
        self.init(
            currentVersion: currentVersion,
            versionStore: versionStore,
            defaultLayout: defaultLayout,
            whatsNewCollection: whatsNewCollection()
        )
    }
    
    // MARK: WhatsNew
    
    /// Retrieve a WhatsNew that should be presented to the user, if available.
    open func whatsNew() -> WhatsNew? {
        // Retrieve presented WhatsNew Versions from WhatsNewVersionStore
        let presentedWhatsNewVersions = self.whatsNewVersionStore.presentedVersions
        // Verify the current Version has not been presented
        guard !presentedWhatsNewVersions.contains(self.currentVersion) else {
            // Otherwise WhatsNew has already been presented for the current version
            return nil
        }
        // Check if a WhatsNew is available for the current Version
        if let whatsNew = self.whatsNewCollection.first(where: { $0.version == self.currentVersion }) {
            // Return WhatsNew for the current Version
            return whatsNew
        }
        // Otherwise initialize current minor release Version
        let currentMinorVersion = WhatsNew.Version(
            major: self.currentVersion.major,
            minor: self.currentVersion.minor,
            patch: 0
        )
        // Verify the current minor release Version has not been presented
        guard !presentedWhatsNewVersions.contains(currentMinorVersion) else {
            // Otherwise WhatsNew for current minor release Version has already been preseted
            return nil
        }
        // Return WhatsNew for current minor release Version, if available
        return self.whatsNewCollection.first { $0.version == currentMinorVersion }
    }
    
}

```

### Core Architecture Module: `Sources/Extensions/ScrollView+alwaysBounceVertical.swift`
```
#if os(iOS)
import SwiftUI

// MARK: - ScrollView+alwaysBounceVertical

extension ScrollView {
    
    /// Resolve the underlying `UIScrollView` to update the `alwaysBounceVertical` attribute which is
    /// a Boolean value that determines whether bouncing always occurs when vertical scrolling reaches the end of the content.
    /// - Parameter alwaysBounceVertical: Bool value if the UIScrollView should always bounce vertical
    func alwaysBounceVertical(
        _ alwaysBounceVertical: Bool
    ) -> some View {
        self.overlay(
            ViewControllerResolver { viewController in
                // Verify UIScrollView is available
                guard let scrollView = viewController
                        .view
                        .subviews
                        .first(where: { $0 is UIScrollView }) as? UIScrollView else {
                    // Otherwise return out of function
                    return
                }
                // Set alwaysBounceVertical
                scrollView.alwaysBounceVertical = alwaysBounceVertical
            }
            .frame(width: 0, height: 0)
        )
    }
    
}

// MARK: - ViewControllerResolver

/// The ViewControllerResolver
private struct ViewControllerResolver: UIViewControllerRepresentable {
    
    // MARK: Typealias
    
    /// A typealias represents a UIViewController resolver closure
    typealias Resolver = (UIViewController) -> Void
    
    // MARK: Properties
    
    /// The Resolver
    let resolver: Resolver
    
    // MARK: UIViewControllerRepresentable
    
    /// Make ResolvedViewController
    /// - Parameter context: The Context
    func makeUIViewController(
        context: Context
    ) -> Content {
        .init(resolver: self.resolver)
    }
    
    /// Update ResolvedViewController
    /// - Parameters:
    ///   - uiViewController: The ResolvedViewController
    ///   - context: The Context
    func updateUIViewController(
        _ content: Content,
        context: Context
    ) {
        content.resolver = self.resolver
    }
    
}

// MARK: - ViewControllerResolver+Content

private extension ViewControllerResolver {
    
    /// The ViewControllerResolver Content
    final class Content: UIViewController {
        
        // MARK: Properties
        
        /// The Resolver
        var resolver: Resolver
        
        // MARK: Initializer
        
        /// Creates a new instance of `ViewControllerResolver.Content`
        /// - Parameter onResolve: The Resolver
        init(
            resolver: @escaping Resolver
        ) {
            self.resolver = resolver
            super.init(nibName: nil, bundle: nil)
        }
        
        /// Initializer with NSCoder is unavailable
        @available(*, unavailable)
        required init?(
            coder aDecoder: NSCoder
        ) { nil }
        
        // MARK: View-Lifecycle
        
        /// Did move to parent ViewController
        /// - Parameter parent: The parent ViewController
        override func didMove(
            toParent parent: UIViewController?
        ) {
            super.didMove(toParent: parent)
            parent.flatMap(self.resolver)
        }
    }
    
}
#endif

```

### Core Architecture Module: `Sources/Extensions/Text+WhatsNewText.swift`
```
import SwiftUI

// MARK: - Text+init(whatsNewText:)

extension Text {
    
    /// Creates a new instance of `Text` from a `WhatsNew.Text` instance
    /// - Parameter whatsNewText: The WhatsNew Text
    init(
        whatsNewText: WhatsNew.Text
    ) {
        // Check if iOS 15 or greater is available
        if #available(iOS 15.0, macOS 12.0, visionOS 1.0, *) {
            // Initialize with AttributedString
            self.init(
                AttributedString(
                    whatsNewText.attributedString
                )
            )
        } else {
            // Initialize with raw string value
            self.init(
                verbatim: whatsNewText.attributedString.string
            )
        }
    }
    
}

```

### Core Architecture Module: `Sources/Extensions/UIVisualEffectView+Representable.swift`
```
#if os(iOS)
import SwiftUI

// MARK: - UIVisualEffectView+Representable

extension UIVisualEffectView {
    
    /// A UIVisualEffect SwiftUI Representable View
    struct Representable: UIViewRepresentable {
        
        // MARK: Properties
        
        /// The UIVisualEffect. Default value `UIBlurEffect(style: .regular)`
        var effect: UIVisualEffect = UIBlurEffect(style: .regular)
        
        // MARK: UIViewRepresentable
        
        /// Make UIVisualEffectView
        /// - Parameter context: The Context
        func makeUIView(
            context: Context
        ) -> UIVisualEffectView {
            .init(
                effect: self.effect
            )
        }
        
        /// Update UIVisualEffectView
        /// - Parameters:
        ///   - visualEffectView: The UIVisualEffectView
        ///   - context: The Context
        func updateUIView(
            _ visualEffectView: UIVisualEffectView,
            context: Context
        ) {
            visualEffectView.effect = self.effect
        }
        
    }
    
}
#endif

```

### Core Architecture Module: `Sources/Extensions/View+WhatsNewSheet.swift`
```
import SwiftUI

// MARK: - View+sheet(whatsNew:)

public extension View {

    /// Presents a WhatsNewView using the given WhatsNew object as a data source for the sheet’s content.
    /// - Parameters:
    ///   - whatsNew: A Binding to an optional WhatsNew object
    ///   - versionStore: The optional WhatsNewVersionStore. Default value `nil`
    ///   - layout: The WhatsNew Layout. Default value `.default`
    ///   - onDismiss: The closure to execute when dismissing the sheet. Default value `nil`
    func sheet(
        whatsNew: Binding<WhatsNew?>,
        versionStore: WhatsNewVersionStore? = nil,
        layout: WhatsNew.Layout = .default,
        onDismiss: (() -> Void)? = nil
    ) -> some View {
        self.modifier(
            ManualWhatsNewSheetViewModifier(
                whatsNew: whatsNew,
                versionStore: versionStore,
                layout: layout,
                onDismiss: onDismiss
            )
        )
    }
    
}

// MARK: - ManualWhatsNewSheetViewModifier

/// A Manual WhatsNew Sheet ViewModifier
private struct ManualWhatsNewSheetViewModifier: ViewModifier {
    
    // MARK: Properties
    
    /// A Binding to an optional WhatsNew object
    let whatsNew: Binding<WhatsNew?>
    
    /// The optional WhatsNewVersionStore
    let versionStore: WhatsNewVersionStore?
    
    /// The WhatsNew Layout
    let layout: WhatsNew.Layout
    
    /// The closure to execute when dismissing the sheet
    let onDismiss: (() -> Void)?
    
    // MARK: ViewModifier
    
    /// Gets the current body of the caller.
    /// - Parameter content: The Content
    func body(
        content: Content
    ) -> some View {
        // Check if a WhatsNew object is available
        if let whatsNew = self.whatsNew.wrappedValue {
            // Check if the WhatsNew Version has already been presented
            if self.versionStore?.hasPresented(whatsNew.version) == true {
                // Show content
                content
            } else {
                // Show WhatsNew Sheet
                content.sheet(
                    item: self.whatsNew,
                    onDismiss: self.onDismiss
                ) { whatsNew in
                    WhatsNewView(
                        whatsNew: whatsNew,
                        versionStore: self.versionStore,
                        layout: self.layout
                    )
                }
            }
        } else {
            // Otherwise show content
            content
        }
    }
    
}

// MARK: - View+whatsNewSheet()

public extension View {
    
    /// Auto-Presents a WhatsNewView to the user if needed based on the `WhatsNewEnvironment`
    /// - Parameters:
    ///   - layout: The optional custom WhatsNew Layout. Default value `nil`
    ///   - onDismiss: The closure to execute when dismissing the sheet. Default value `nil`
    func whatsNewSheet(
        layout: WhatsNew.Layout? = nil,
        onDismiss: (() -> Void)? = nil
    ) -> some View {
        self.modifier(
            AutomaticWhatsNewSheetViewModifier(
                layout: layout,
                onDismiss: onDismiss
            )
        )
    }
    
}

// MARK: - WhatsNewSheetViewModifier

/// A Automatic WhatsNew Sheet ViewModifier
private struct AutomaticWhatsNewSheetViewModifier: ViewModifier {
    
    // MARK: Properties
    
    /// The optional WhatsNew Layout
    let layout: WhatsNew.Layout?
    
    /// The optional closure to execute when dismissing the sheet
    let onDismiss: (() -> Void)?
    
    /// Bool value if sheet is dismissed
    @State
    private var isDismissed: Bool?
    
    /// The WhatsNewEnvironment
    @Environment(\.whatsNew)
    private var whatsNewEnvironment
    
    // MARK: ViewModifier
    
    /// Gets the current body of the caller.
    /// - Parameter content: The Content
    func body(
        content: Content
    ) -> some View {
        content.sheet(
            item: .init(
                get: {
                    self.isDismissed == true
                        ? nil
                        : self.whatsNewEnvironment.whatsNew()
                },
                set: {
                    self.isDismissed = $0 == nil
                }
            ),
            onDismiss: self.onDismiss
        ) { whatsNew in
            WhatsNewView(
                whatsNew: whatsNew,
                versionStore: self.whatsNewEnvironment.whatsNewVersionStore,
                layout: self.layout ?? self.whatsNewEnvironment.defaultLayout
            )
        }
    }
    
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #80** (2024-03-11): **Localized Title gets not displayed in sheet when (empty String) is selected in Localizable.xcstrings file**
  *Symptoms*: ### What happened?  The title of a new version does not get displayed when (empty String) - no translation is entered in the Localizable.xcstrings file.  `WhatsNew(version: "1.1.0", title: WhatsNew.Title(stringLiteral: String(localized: "Version 1.1.0")), features: [v1101, v1011])`  While the description (empty String) in the  Localizable.xcstrings would suggest that this is expected behaviour, other SwiftUI components handle it with displaying the text in the base language.  ### What are the steps to reproduce?  Create a WhatsNew Object with a localised title. Leave the localisation empty. See the missing title.  ### What is the expected behavior?  Displaying the title in the base language.
  **Post-Mortem & Fix Analysis**:
  > Closing this as the described issue does not fall in the responsibility of this framework.

- **Issue #75** (2024-01-21): **visionOS compability not given**
  *Symptoms*: ### What happened?  Compilation on a visionOS Target is not working due to the following error `Value of type 'WhatsNewView.FeaturesPadding' has no member 'horizontalSizeClass'` Right now I have to exclude WhatsNewKit from a dependency of the visionOS platform and add complier directives all over my code  ### What are the steps to reproduce?  Add visionOS (native) to a target where WhatsNewKit is listed as a dependency   ### What is the expected behavior?  Compile on visionOS
  **Post-Mortem & Fix Analysis**:
  > Hi @flexlixrup,  Support for visionOS is currently not released.  Please use the [`feature/vision-os-support`](https://github.com/SvenTiigi/WhatsNewKit/tree/feature/vision-os-support) branch which should compile on the visionOS platform.

- **Issue #70** (2023-09-20): **WhatsNewKit iOS dependency preventing SwiftUI preview for watchOS app**
  *Symptoms*: ### What happened?  XCode 15 + iOS app (min target iOS 15) + watchOS app (min target watchOS 9). WhatsNewKit as SPM dependency for the iOS app.  Problem: when previewing SwiftUI views for the watch app, I get this error:  `  == PREVIEW UPDATE ERROR:      SchemeBuildError: Failed to build the scheme ”MyAppWatch Watch App”          'SymbolRenderingMode' is only available in watchOS 8.0 or newer          Emitting module for WhatsNewKit:     /Users/user/Library/Developer/Xcode/DerivedData/MyApp-gglszqrqhbbrmqcgpkravwysjmar/SourcePackages/checkouts/WhatsNewKit/Sources/Models/WhatsNew+Feature+Image.swift:110:31: error: 'SymbolRenderingMode' is only available in watchOS 8.0 or newer             symboldRenderingMode: SymbolRenderingMode?,`  ### What are the steps to reproduce?  -  ### What is the expected behavior?  Do not block SwiftUI previews
  **Post-Mortem & Fix Analysis**:
  > Hi @john-work-ios,  As the WhatsNewKit does not support the watchOS platform please update your Xcode project configuration to exclude WhatsNewKit from your watchOS App Target compilation process.  https://github.com/SvenTiigi/WhatsNewKit/blob/1366a8b5855ea97fc52439f68ff29b15846d9403/Package.swift#L5-L10
  > That's just it, the watchOS target does not have WhatsNewKit in its dependencies. The issue only occurs with SwiftUI previews. Any clue?
  > I'm also experiencing this issue, so I decided to investigate it further. It seems that it's an issue with Xcode previews (source: [Apple Developer forums](https://forums.developer.apple.com/forums/thread/731732)).  In SwiftUIIntrospect, they fixed it by adding a load of `#if !os(watchos)` statements to the code, but I appreciate that it's inconvenient to do that.  A workaround that I've verified is to make a new scheme that's just for previews. [See this forum post](https://forums.developer.apple.com/forums/thread/731732?answerId=769771022#769771022) for instructions.

- **Issue #58** (2023-03-08): **[iPad] Default primary action does not dismiss the WhatsNewViewController**
  *Symptoms*: ## WhatsNewKit Environment  - WhatsNewKit version: 2.0.2 **using UIKit** - Xcode version: 13.3 - Swift version: 5+ - macOS version running Xcode: 12.4 - Dependency manager (SPM, Manually): SPM  ## What did you do?  on iPad, the continue button (primary action) does not dismiss. Works fine on iPhone.  ## What did you expect to happen?  The WhatsNewVC should dismiss  ## What happened instead?  As a workaround, I used the 'onDismiss' completion to dismiss the controller 
  **Post-Mortem & Fix Analysis**:
  > Hi @john-work-ios,  Sorry for the late reply.  I have successfully reproduced the bug and I'm currently investigating this issue. I will let you know when a new version is available which fixes this problem ✌️
  > any lead on this from your investigation if we'd like to support on a fix?
  > Hi @john-work-ios,  I've recently tried to reproduce the bug and it seems like this issue has been fixed with either iOS 15 or iOS 16. Seems like UIKit now passes a correct context for the [`PresentationMode`](https://developer.apple.com/documentation/swiftui/presentationmode) which is called when the primary action gets tapped in order to dismiss the sheet / presented view controller.  https://github.com/SvenTiigi/WhatsNewKit/blob/641b2f5e771627d172f69ebfc5dda777ee74393d/Sources/View/WhatsNewView.swift#L215-L224  https://user-images.githubusercontent.com/11733014/222533689-b3e76139-8212-45c2-8602-a97fd0950421.mov

- **Issue #52** (2022-01-09): **Truncated text on iOS 14**
  *Symptoms*: ## WhatsNewKit Environment  - WhatsNewKit version: 2.0.0 - Xcode version: 13.2.1 - Swift version: 5.5.2 - macOS version running Xcode: 12.1 - Dependency manager (SPM, Manually): SPM  ## What did you do?  Presented a WhatsNewKit view controller on a iOS 14 simulator  ## What did you expect to happen?  The text to not be truncated.  ## What happened instead?  The text was truncated. See attached screenshot. <img width="561" alt="Screenshot 2022-01-09 at 11 32 41" src="https://user-images.githubusercontent.com/2078225/148697922-6e8d9335-6b80-4a6c-90d0-e48567337d26.png"> Produce by using the following code: ```swift WhatsNewViewController(whatsNew:     WhatsNew(         title: .init(text: .init("Whats New in Reading List")),         features: [             .init(                 image: .init(systemName: "shuffle"),                 title: .init("Shake to Choose"),                 subtitle: .init("Shake your device to choose your next book")             ),             .init(                 image: .init(systemName: "hammer.fill"),                 title: .init("Improvements and Fixes"),                 subtitle: .init("Various performance improvements and bug fixes")             )         ]     ) ) ``` Note, this does not occur on iOS 15 simulators. I have seen similar issues in SwiftUI before, requiring the use of `.fixedSize()`... 
  **Post-Mortem & Fix Analysis**:
  > PR https://github.com/SvenTiigi/WhatsNewKit/pull/53 has been merged

- **Issue #48** (2021-01-17): ** iPad Adjustments not work**
  *Symptoms*: ## WhatsNewKit Environment  - WhatsNewKit version: 1.3.7 - Xcode version: 12.0.1 - Swift version: 5.0 - macOS version running Xcode: 10.15.7 - Dependency manager (SPM, Carthage, CocoaPods, Manually): SPM  ## What did you do?  I've added this code for ipad adjustments:  ``` configuration.padAdjustment = { configuration in              configuration.titleView.insets.top = 25.0             configuration.detailButton = nil              configuration.itemsView.insets.top = -20.0             configuration.itemsView.insets.left = 5.0             configuration.itemsView.insets.right = 7.0             configuration.itemsView.insets.bottom = 5.0              configuration.completionButton.insets.bottom = 17.0              WhatsNewViewController.Configuration.defaultPadAdjustment(&configuration)         } ```   but it doesn't works. For example the detail button is still visible. 
  **Post-Mortem & Fix Analysis**:
  > Hi @furiosFast,  Due to a recent bug report (https://github.com/SvenTiigi/WhatsNewKit/issues/45) the `padAdjustment` closure has been refactored to be only used to update the layout insets.   Therefore changing the `detailButton` to nil will have no effect inside the `padAdjustment` closure.  If you wish to hide the `detailButton` on an iPad you could update your WhatsNewKit configuration to something like this:  ```swift var configuration = WhatsNewViewController.Configuration()  configuration.detailButton = {     if UIDevice.current.userInterfaceIdiom == .pad {         return nil     } else {         return WhatsNewViewController.DetailButton(title: ..., action: ...)     } }() ```  
  > But I will try to fix this misleading behavior within the next release of WhatsNewKit ✌️
  > ok, thank you!!

- **Issue #45** (2020-10-17): **Squished layout on iPad in multitasking**
  *Symptoms*: ## WhatsNewKit Environment  - iOS version: 14.0 - WhatsNewKit version: 1.3.6 - Xcode version: 12.0 - Swift version: 5.0 - macOS version running Xcode: 10.15.6 - Dependency manager (SPM, Carthage, CocoaPods, Manually): SPM  ## What did you do?  Displaying the WhatsNew view with default layout values on iPad in multitasking  ## What did you expect to happen?  The layout should consider the trait collection  ## What happened instead?  The layout is being squished  `private func showWhatsNew() {         // Initialize WhatsNew         let versionStore: WhatsNewVersionStore = KeyValueWhatsNewVersionStore()                  var configuration = WhatsNewViewController.Configuration(             theme: .default         )         configuration.tintColor = UIColor(named: "someTintColor")!         configuration.itemsView.imageSize = .preferred                  let whatsNew = WhatsNew(             // The Title             title: SSKLocalizedString("STR_WHATS_NEW"),             // The features you want to showcase             items: [                 WhatsNew.Item(                     title: "XYZ",                     subtitle: "Blah blah",                     image: UIImage(systemName: "bolt.fill")                 ),                 ...,                 ...,             ]         )          // Initialize WhatsNewViewController with WhatsNew         if let whatsNewViewController = WhatsNewViewController(             whatsNew: whatsNew,       
  **Post-Mortem & Fix Analysis**:
  > Hey @lvandal   Thanks for your bug report and sorry for the delayed response I was on vacation.  Please checkout the feature branch [`trait-collection-fix`](https://github.com/SvenTiigi/WhatsNewKit/tree/feature/trait-collection-fix) and let me know if this resolves your issue.
  > Yes, it is now fixed. Thanks so much!
  > Perfect 👍  I will leave a comment as soon as the bug fix is available within a new release of WhatsNewKit

- **Issue #44** (2020-09-14): **Swipe gesture to dismiss doesn't work reliably**
  *Symptoms*: ## WhatsNewKit Environment  - WhatsNewKit version: 1.3.5 - Xcode version: 11.6 - Swift version: 5 - macOS version running Xcode: 10.15.5 - Dependency manager (SPM, Carthage, CocoaPods, Manually): SPM or standalone  ## What did you do?  Build and run WhatsNewKit-Example  Tap "Present" button  Put finger on the ItemsView and drag down  ## What did you expect to happen?  The WhatsNew panel should begin dismiss animation and follow the finger's movement  ## What happened instead?  The WhatsNew panel doesn't move at all 90% of the times. Sometimes it begins moving late after the gesture has moved a considerable amount of space. Rarely it begins immediately and follows the gesture.  
  **Post-Mortem & Fix Analysis**:
  > Personal consideration: the interference between swipe to dismiss / scrollview gestures is handled automatically when a modally presented panel contains a UITableViewController subclass. Maybe using a UIViewController subclass containing a UITableView for ItemsView needs the same behavior to be coded manually with some `UIGestureRecognizerDelegate` method.
  > Hey @francosolerio,  Thanks for your bug report 🙌  It seems like that the following line of code causes the issue (`WhatsNewItemsViewController.swift`):  ```swift tableView.alwaysBounceVertical = false ```  When the contentSize of the TableView doesn't exceed the size of the frame the TableView will ignore the scroll gesture and therefore it will be not passed down to the responder chain in order to allow iOS to listen to the scroll gesture.  Please check out the [`develop`](https://github.com/SvenTiigi/WhatsNewKit/tree/develop) branch and check if the problem still exists.
  > Thank you @SvenTiigi,  I can confirm the issue is resolved on the develop branch.

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

### Incident Patch 1: `39272ae8` (2024-01-18)
**Commit Message**: Fixed tests

**File**: `Tests/WhatsNewVersionStoreTests.swift` (modified, +4/-3)
```diff
@@ -67,6 +67,10 @@ final class WhatsNewVersionStoreTests: WhatsNewKitTestCase {
             override func set(_ value: Any?, forKey defaultName: String) {
                 self.store[defaultName] = value
             }
+            
+            override func removeObject(forKey aKey: String) {
+                self.store.removeValue(forKey: aKey)
+            }
         }
         let fakeNSUbiquitousKeyValueStore = FakeNSUbiquitousKeyValueStore()
         let ubiquitousKeyValueWhatsNewVersionStore = NSUbiquitousKeyValueWhatsNewVersionStore(
@@ -82,15 +86,12 @@ final class WhatsNewVersionStoreTests: WhatsNewKitTestCase {
             (fakeNSUbiquitousKeyValueStore.store[version.key] as? String).flatMap(WhatsNew.Version.init)
         )
         ubiquitousKeyValueWhatsNewVersionStore.removeAll()
-        // TODO: Check why this doesn't work on xrOS
-#if !os(xrOS)
         XCTAssert(
             ubiquitousKeyValueWhatsNewVersionStore.presentedVersions.isEmpty
         )
         XCTAssert(
             fakeNSUbiquitousKeyValueStore.store.isEmpty
         )
-#endif
     }
     
 }
```

---

### Incident Patch 2: `d85c1ec3` (2023-04-03)
**Commit Message**: Fixed a typo

**File**: `Sources/Models/WhatsNew+Feature+Image.swift` (modified, +2/-2)
```diff
@@ -107,15 +107,15 @@ public extension WhatsNew.Feature.Image {
     init(
         systemName: String,
         renderingMode: Image.TemplateRenderingMode? = .template,
-        symboldRenderingMode: SymbolRenderingMode?,
+        symbolRenderingMode: SymbolRenderingMode?,
         foregroundColor: Color? = .accentColor
     ) {
         self.init {
             Image(
                 systemName: systemName
             )
             .renderingMode(renderingMode)
-            .symbolRenderingMode(symboldRenderingMode)
+            .symbolRenderingMode(symbolRenderingMode)
             .font(.title)
             .imageScale(.large)
             .foregroundColor(foregroundColor)
```

---

### Incident Patch 3: `2699ffdf` (2022-12-01)
**Commit Message**: Update build_example_project.yml

**File**: `.github/workflows/build_example_project.yml` (modified, +2/-2)
```diff
@@ -13,10 +13,10 @@ on:
 
 jobs:
   build:
-    name: Build example project
+    name: Build iOS example project
     runs-on: macOS-12
     steps:
       - name: Checkout
         uses: actions/checkout@v2
       - name: Build
-        run: xcodebuild build -project Example/Example.xcodeproj -scheme Example -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14'
+        run: xcodebuild build -project Example/Example.xcodeproj -scheme Example-iOS -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14'
```

---

### Incident Patch 4: `756d0547` (2022-12-01)
**Commit Message**: Create bug_report.yml

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+name: Bug Report
+description: File a bug report.
+labels: ["bug"]
+assignees:
+  - SvenTiigi
+body:
+  - type: textarea
+    id: bug-description
+    attributes:
+      label: What happened?
+      description: Please describe the bug.
+      placeholder: Description of the bug.
+    validations:
+      required: true
+  - type: textarea
+    id: steps-to-reproduce
+    attributes:
+      label: What are the steps to reproduce?
+      description: Please describe the steps to reproduce the bug.
+      placeholder: |
+        Step 1: ...
+        Step 2: ...
+        Step 3: ...
+    validations:
+      required: true
+  - type: textarea
+    id: expected-behavior
+    attributes:
+      label: What is the expected behavior?
+      description: Please describe the behavior you expect of WhatsNewKit.
+      placeholder: I expect that WhatsNewKit would...
+    validations:
+      required: true
```

---

### Incident Patch 5: `1449ceac` (2022-12-01)
**Commit Message**: Create build_example_project.yml

**File**: `.github/workflows/build_example_project.yml` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+name: Build Example Project
+
+on:
+  workflow_dispatch:
+  push:
+    paths:
+      - 'Example/**'
+      - 'Sources/**'
+  pull_request:
+    paths:
+      - 'Example/**'
+      - 'Sources/**'
+
+jobs:
+  build:
+    name: Build example project
+    runs-on: macOS-12
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v2
+      - name: Build
+        run: xcodebuild build -project Example/Example.xcodeproj -scheme Example -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14'
```

---

### Incident Patch 6: `47012d53` (2022-12-01)
**Commit Message**: Create build_and_test.yml

**File**: `.github/workflows/build_and_test.yml` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+name: Build and Test
+
+on:
+  workflow_dispatch:
+  push:
+    paths:
+      - 'Sources/**'
+      - 'Tests/**'
+      - '!Sources/Documentation.docc/**'
+  pull_request:
+    paths:
+      - 'Sources/**'
+      - 'Tests/**'
+      - '!Sources/Documentation.docc/**'
+
+jobs:
+  iOS:
+    name: Build and test on iOS
+    runs-on: macOS-12
+    steps:
+      - uses: actions/checkout@v3
+      - name: Build
+        run: xcodebuild build-for-testing -scheme WhatsNewKit -destination 'platform=iOS Simulator,name=iPhone 14'
+      - name: Test
+        run: xcodebuild test-without-building -scheme WhatsNewKit -destination 'platform=iOS Simulator,name=iPhone 14'
+  macOS:
+    name: Build and test on macOS
+    runs-on: macos-latest
+    steps:
+      - uses: actions/checkout@v3
+      - name: Build
+        run: swift build -v
+      - name: Test
+        run: swift test -v
```

---

### Incident Patch 7: `7dcdbc2d` (2022-04-26)
**Commit Message**: Merge pull request #55 from phjs/Fix-extension-signatures

Fix extension signatures

**File**: `README.md` (modified, +2/-2)
```diff
@@ -307,7 +307,7 @@ let whatsnew = WhatsNew(
         backgroundColor: .accentColor,
         foregroundColor: .white,
         hapticFeedback: .notification(.success),
-        onDimiss: {
+        onDismiss: {
             print("WhatsNewView has been dismissed")
         }
     ),
@@ -347,7 +347,7 @@ let version: WhatsNew.Version = .current()
 A `WhatsNew.Title` represents the title text that is rendered above the features.
 
 ```swift
-// Initialize by string literla
+// Initialize by string literal
 let title: WhatsNew.Title = "Continue"
 
 // Initialize with text and foreground color
```

**File**: `Sources/Extensions/View+WhatsNewSheet.swift` (modified, +19/-3)
```diff
@@ -10,18 +10,34 @@ public extension View {
     ///   - versionStore: The optional WhatsNewVersionStore. Default value `nil`
     ///   - layout: The WhatsNew Layout. Default value `.default`
     ///   - onDimiss: The closure to execute when dismissing the sheet. Default value `nil`
+    @available(*, deprecated, renamed: "sheet(whatsNew:versionStore:layout:onDismiss:)")
     func sheet(
         whatsNew: Binding<WhatsNew?>,
         versionStore: WhatsNewVersionStore? = nil,
         layout: WhatsNew.Layout = .default,
-        onDimiss: (() -> Void)? = nil
+        onDimiss: (() -> Void)?
+    ) -> some View {
+        self.sheet(whatsNew: whatsNew, versionStore: versionStore, layout: layout, onDismiss: onDimiss)
+    }
+
+    /// Presents a WhatsNewView using the given WhatsNew object as a data source for the sheet’s content.
+    /// - Parameters:
+    ///   - whatsNew: A Binding to an optional WhatsNew object
+    ///   - versionStore: The optional WhatsNewVersionStore. Default value `nil`
+    ///   - layout: The WhatsNew Layout. Default value `.default`
+    ///   - onDismiss: The closure to execute when dismissing the sheet. Default value `nil`
+    func sheet(
+        whatsNew: Binding<WhatsNew?>,
+        versionStore: WhatsNewVersionStore? = nil,
+        layout: WhatsNew.Layout = .default,
+        onDismiss: (() -> Void)? = nil
     ) -> some View {
         self.modifier(
             ManualWhatsNewSheetViewModifier(
                 whatsNew: whatsNew,
                 versionStore: versionStore,
                 layout: layout,
-                onDismiss: onDimiss
+                onDismiss: onDismiss
             )
         )
     }
@@ -88,7 +104,7 @@ public extension View {
     /// Auto-Presents a WhatsNewView to the user if needed based on the `WhatsNewEnvironment`
     /// - Parameters:
     ///   - layout: The optional custom WhatsNew Layout. Default value `nil`
-    ///   - onDimiss: The closure to execute when dismissing the sheet. Default value `nil`
+    ///   - onDismiss: The closure to execute when dismissing the sheet. Default value `nil`
     func whatsNewSheet(
         layout: WhatsNew.Layout? = nil,
         onDismiss: (() -> Void)? = nil
```

---

### Incident Patch 8: `2a9322a8` (2022-04-26)
**Commit Message**: Fix typos

**File**: `README.md` (modified, +2/-2)
```diff
@@ -307,7 +307,7 @@ let whatsnew = WhatsNew(
         backgroundColor: .accentColor,
         foregroundColor: .white,
         hapticFeedback: .notification(.success),
-        onDimiss: {
+        onDismiss: {
             print("WhatsNewView has been dismissed")
         }
     ),
@@ -347,7 +347,7 @@ let version: WhatsNew.Version = .current()
 A `WhatsNew.Title` represents the title text that is rendered above the features.
 
 ```swift
-// Initialize by string literla
+// Initialize by string literal
 let title: WhatsNew.Title = "Continue"
 
 // Initialize with text and foreground color
```

**File**: `Sources/Extensions/View+WhatsNewSheet.swift` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ public extension View {
     /// Auto-Presents a WhatsNewView to the user if needed based on the `WhatsNewEnvironment`
     /// - Parameters:
     ///   - layout: The optional custom WhatsNew Layout. Default value `nil`
-    ///   - onDimiss: The closure to execute when dismissing the sheet. Default value `nil`
+    ///   - onDismiss: The closure to execute when dismissing the sheet. Default value `nil`
     func whatsNewSheet(
         layout: WhatsNew.Layout? = nil,
         onDismiss: (() -> Void)? = nil
```

---

### Incident Patch 9: `275ec4cd` (2022-04-26)
**Commit Message**: Fix typo in method signature

Mark old method as depricated

**File**: `Sources/Extensions/View+WhatsNewSheet.swift` (modified, +18/-2)
```diff
@@ -10,18 +10,34 @@ public extension View {
     ///   - versionStore: The optional WhatsNewVersionStore. Default value `nil`
     ///   - layout: The WhatsNew Layout. Default value `.default`
     ///   - onDimiss: The closure to execute when dismissing the sheet. Default value `nil`
+    @available(*, deprecated, renamed: "sheet(whatsNew:versionStore:layout:onDismiss:)")
     func sheet(
         whatsNew: Binding<WhatsNew?>,
         versionStore: WhatsNewVersionStore? = nil,
         layout: WhatsNew.Layout = .default,
-        onDimiss: (() -> Void)? = nil
+        onDimiss: (() -> Void)?
+    ) -> some View {
+        self.sheet(whatsNew: whatsNew, versionStore: versionStore, layout: layout, onDismiss: onDimiss)
+    }
+
+    /// Presents a WhatsNewView using the given WhatsNew object as a data source for the sheet’s content.
+    /// - Parameters:
+    ///   - whatsNew: A Binding to an optional WhatsNew object
+    ///   - versionStore: The optional WhatsNewVersionStore. Default value `nil`
+    ///   - layout: The WhatsNew Layout. Default value `.default`
+    ///   - onDismiss: The closure to execute when dismissing the sheet. Default value `nil`
+    func sheet(
+        whatsNew: Binding<WhatsNew?>,
+        versionStore: WhatsNewVersionStore? = nil,
+        layout: WhatsNew.Layout = .default,
+        onDismiss: (() -> Void)? = nil
     ) -> some View {
         self.modifier(
             ManualWhatsNewSheetViewModifier(
                 whatsNew: whatsNew,
                 versionStore: versionStore,
                 layout: layout,
-                onDismiss: onDimiss
+                onDismiss: onDismiss
             )
         )
     }
```

---

### Incident Patch 10: `d67049d2` (2022-01-09)
**Commit Message**: Use `fixedSize(horizontal: false, vertical: true)`

**File**: `Sources/View/WhatsNewView.swift` (modified, +3/-3)
```diff
@@ -129,7 +129,7 @@ private extension WhatsNewView {
         )
         .font(.largeTitle.bold())
         .multilineTextAlignment(.center)
-        .fixedSize()
+        .fixedSize(horizontal: false, vertical: true)
     }
     
 }
@@ -159,13 +159,13 @@ private extension WhatsNewView {
                 )
                 .font(.subheadline.weight(.semibold))
                 .foregroundColor(.primary)
-                .fixedSize()
+                .fixedSize(horizontal: false, vertical: true)
                 Text(
                     whatsNewText: feature.subtitle
                 )
                 .font(.subheadline)
                 .foregroundColor(.secondary)
-                .fixedSize()
+                .fixedSize(horizontal: false, vertical: true)
             }
             .multilineTextAlignment(.leading)
         }
```

---

### Incident Patch 11: `bde1bcbc` (2022-01-09)
**Commit Message**: Add fixedSize modifier to some Text views

**File**: `Sources/View/WhatsNewView.swift` (modified, +3/-0)
```diff
@@ -129,6 +129,7 @@ private extension WhatsNewView {
         )
         .font(.largeTitle.bold())
         .multilineTextAlignment(.center)
+        .fixedSize()
     }
     
 }
@@ -158,11 +159,13 @@ private extension WhatsNewView {
                 )
                 .font(.subheadline.weight(.semibold))
                 .foregroundColor(.primary)
+                .fixedSize()
                 Text(
                     whatsNewText: feature.subtitle
                 )
                 .font(.subheadline)
                 .foregroundColor(.secondary)
+                .fixedSize()
             }
             .multilineTextAlignment(.leading)
         }
```

---

### Incident Patch 12: `259201e0` (2022-01-06)
**Commit Message**: Added static shared instance to InMemoryWhatsNewVersionStore

**File**: `Sources/Store/InMemoryWhatsNewVersionStore.swift` (modified, +5/-0)
```diff
@@ -5,6 +5,11 @@ import Foundation
 /// The InMemoryWhatsNewVersionStore
 public final class InMemoryWhatsNewVersionStore {
     
+    // MARK: Static-Properties
+    
+    /// The shared `InMemoryWhatsNewVersionStore` instance
+    public static let shared = InMemoryWhatsNewVersionStore()
+    
     // MARK: Properties
     
     /// The Versions
```

#### Recent Merged Pull Requests:
- **PR #100** (closed): Updated Title to use the specified color (@JackSeaton)
- **PR #90** (2024-10-10): Add ability to display the version as a footnote (@Tibimac)
- **PR #89** (2024-10-09): Fix title color by using the parameter foregroundColor in WhatsNew.Title (@Tibimac)
- **PR #74** (2024-01-18): Add visionsOS compatibility (@alexandrereol)
- **PR #68** (2023-07-18): visionOS compatibility by removing haptic feedback (@chbeer)
- **PR #67** (2024-10-09): Improved macOS design (@voltangle)
- **PR #66** (2023-04-29): Fixed a typo (@passatgt)
- **PR #65** (2023-05-10): Support for monitoring build number change (@totoroyyb)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
