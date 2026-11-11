> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/revenuecat-purchases-ios-learnings.md`  
> **Source**: github ([https://github.com/RevenueCat/purchases-ios](https://github.com/RevenueCat/purchases-ios))  
> **Source Version**: `c9c4ede1`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T20:21:36.447Z  
> **Learning ID**: `learn-github-revenuecat-purchases-ios`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): RevenueCat/purchases-ios

> **Canonical Artifact**: `07_PROJECT_LEARNING/revenuecat-purchases-ios-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RevenueCat/purchases-ios](https://github.com/RevenueCat/purchases-ios))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-08T20:21:36.440Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RevenueCat/purchases-ios`
- **Description**: In-app purchases and subscriptions made easy. Support for iOS, watchOS, tvOS, macOS, and visionOS.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3093 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `AdapterSDKs/RevenueCatAdMob/Sources/RevenueCatAdMob/RewardVerification/State.swift`
```
//
//  State.swift
//
//  Created by RevenueCat.
//

import Foundation

#if os(iOS) && canImport(GoogleMobileAds)

@available(iOS 15.0, *)
internal extension RewardVerification {

    /// Per-ad reward-verification correlation data plus a one-shot guard for the reward-time
    /// outcome dispatch.
    @MainActor
    final class State {

        let clientTransactionID: String

        private var didFire = false

        init(clientTransactionID: String) {
            self.clientTransactionID = clientTransactionID
        }

        /// Returns `true` exactly once per instance; subsequent calls return `false`.
        func consumeFireToken() -> Bool {
            guard !self.didFire else { return false }
            self.didFire = true
            return true
        }
    }

    /// Per-ad ``RewardVerification/State`` stash, keyed by the vendor ad object.
    typealias StateStore = AssociatedObjectStore<State>

    @MainActor static let stateStore = StateStore()
}

#endif

```

### Core Architecture Module: `Examples/MagicWeather/MagicWeather/Sources/Lifecycle/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  Magic Weather
//
//  Created by Cody Kerns on 12/14/20.
//

import UIKit
import RevenueCat

// swiftlint:disable force_unwrapping

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        /* Enable debug logs before calling `configure`. */
        Purchases.logLevel = .debug

        /*
         Initialize the RevenueCat Purchases SDK.
         
            - `appUserID` is nil by default, so an anonymous ID will be generated automatically by the Purchases SDK.
                Read more about Identifying Users here: https://docs.revenuecat.com/docs/user-ids
         */

        Purchases.configure(
            with: Configuration.Builder(withAPIKey: Constants.apiKey)
                .with(storeKitVersion: .storeKit2)
                .build()
        )

        /// - Set the delegate to this instance of AppDelegate. Scroll down to see this implementation.
        Purchases.shared.delegate = self
        
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // Called when the user discards a scene session.
        // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
        // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
    }

}

/*
 Example implementation of PurchasesDelegate.
 */
extension AppDelegate: PurchasesDelegate {
    
    /// -  Whenever the `shared` instance of Purchases updates the PurchaserInfo cache, this method will be called.
    func purchases(_ purchases: Purchases, receivedUpdated customerInfo: CustomerInfo) {
        /// - If necessary, refresh app UI from updated PurchaserInfo
    }

}

```

### Core Architecture Module: `Examples/MagicWeather/MagicWeather/Sources/Lifecycle/SceneDelegate.swift`
```
//
//  SceneDelegate.swift
//  Magic Weather
//
//  Created by Cody Kerns on 12/14/20.
//

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let scene = (scene as? UIWindowScene) else { return }
        
        /// - This sample app uses the dark interface style by default
        scene.windows.forEach { (window) in
            window.overrideUserInterfaceStyle = .dark
        }
    }
    
}

```

### Core Architecture Module: `Examples/MagicWeatherSwiftUI/MagicWeatherSwiftUI/Sources/Lifecycle/MagicWeatherApp.swift`
```
//
//  MagicWeatherApp.swift
//  Magic Weather SwiftUI
//
//  Created by Cody Kerns on 1/11/21.
//

import SwiftUI
import RevenueCat

@main
struct MagicWeatherApp: App {
    
    init() {
        /* Enable debug logs before calling `configure`. */
        Purchases.logLevel = .debug
        
        /*
         Initialize the RevenueCat Purchases SDK.
         
         - `appUserID` is nil by default, so an anonymous ID will be generated automatically by the Purchases SDK.
            Read more about Identifying Users here: https://docs.revenuecat.com/docs/user-ids

         */

        Purchases.configure(
            with: Configuration.Builder(withAPIKey: Constants.apiKey)
                .with(storeKitVersion: .storeKit2)
                .build()
        )

        /* Set the delegate to our shared instance of PurchasesDelegateHandler */
        Purchases.shared.delegate = PurchasesDelegateHandler.shared
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .task {
                    do {
                        // Fetch the available offerings
                        UserViewModel.shared.offerings = try await Purchases.shared.offerings()
                    } catch {
                        print("Error fetching offerings: \(error)")
                    }
                }
        }
    }
}

```

### Core Architecture Module: `Examples/MagicWeatherSwiftUI/MagicWeatherSwiftUI/Sources/Lifecycle/PurchasesDelegateHandler.swift`
```
//
//  PurchasesDelegateHandler.swift
//  Magic Weather SwiftUI
//
//  Created by Cody Kerns on 1/19/21.
//

import Foundation
import RevenueCat

/*
 The class we'll use to publish CustomerInfo data to our Magic Weather app.
 */

class PurchasesDelegateHandler: NSObject, ObservableObject {

    static let shared = PurchasesDelegateHandler()

}

extension PurchasesDelegateHandler: PurchasesDelegate {
    /**
     - Note: this can be tested by opening a link like:
     itms-services://?action=purchaseIntent&bundleId=<BUNDLE_ID>&productIdentifier=<SKPRODUCT_ID>
     */
    func purchases(_ purchases: Purchases,
                   readyForPromotedProduct product: StoreProduct,
                   purchase startPurchase: @escaping StartPurchaseBlock) {
        startPurchase { (transaction, info, error, cancelled) in
            if let info = info, error == nil, !cancelled {
                UserViewModel.shared.customerInfo = info
            }
        }
    }

}

```

### Core Architecture Module: `Examples/SampleCat/SampleCat/Utils/Extensions/AppHealth+Ext.swift`
```
import RevenueCat
import SwiftUI

extension PurchasesDiagnostics.ProductStatus {
    var color: Color {
        switch self {
        case .valid: .green
        case .couldNotCheck, .unknown: .gray
        case .notFound: .red
        case .needsAction, .actionInProgress: .yellow
        }
    }

    var icon: String {
        switch self {
        case .valid: "checkmark.circle.fill"
        case .couldNotCheck, .unknown: "questionmark.circle.fill"
        case .notFound: "xmark.circle.fill"
        case .actionInProgress, .needsAction: "exclamationmark.triangle.fill"
        }
    }
}

extension PurchasesDiagnostics.SDKHealthCheckStatus {
    var icon: String {
        switch self {
        case .passed: "checkmark.circle.fill"
        case .failed: "xmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        }
    }

    var color: Color {
        switch self {
        case .passed: .green
        case .failed: .red
        case .warning: .yellow
        }
    }
}

```

### Core Architecture Module: `Examples/SampleCat/SampleCat/Utils/Views/ConceptIntroductionView.swift`
```
import SwiftUI

struct ConceptIntroductionView: View {
    let imageName: String
    let title: String
    let description: String

    var body: some View {
        VStack(spacing: 32) {
            Image(imageName)
                .resizable()
                .frame(width: 280, height: 280)
                .accessibilityHidden(true)

            VStack(spacing: 8) {
                Text(title)
                    .font(.largeTitle)
                    .fontWeight(.semibold)
                Text(description)
            }
            .padding(.horizontal, 24)
            .multilineTextAlignment(.center)
        }
        .padding(.vertical, 32)
    }
}

#Preview {
    ConceptIntroductionView(
        imageName: "visual-products",
        title: "Products",
        description: "Products are the individual in-app purchases and subscriptions that you have set up on the App Store."
    )
}

```

### Core Architecture Module: `Examples/SampleCat/SampleCat/Utils/Views/ContentBackgroundView.swift`
```
import SwiftUI

struct ContentBackgroundView: View {
    let color: Color
    var body: some View {
        ZStack {
            LinearGradient(colors: [
                color.opacity(0.15),
                color.opacity(0)
            ], startPoint: .top, endPoint: .bottom)
            PatternBackground()
        }
        .ignoresSafeArea()
    }
}

#Preview {
    ContentBackgroundView(color: .accent)
}

struct PatternBackground: UIViewRepresentable {
    func makeUIView(context _: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = UIColor(patternImage: UIImage(named: "noise-pattern")!)
        return view
    }

    func updateUIView(_: UIView, context _: Context) {}
}

```

### Core Architecture Module: `Examples/SampleCat/SampleCat/Utils/Views/Spinner/Shapes/BallShape.swift`
```
import SwiftUI

struct BallShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.move(to: CGPoint(x: 0.5 * width, y: 0.125 * height))
        path.addCurve(to: CGPoint(x: 0.125 * width, y: 0.5 * height), control1: CGPoint(x: 0.29289 * width, y: 0.125 * height), control2: CGPoint(x: 0.125 * width, y: 0.29289 * height))
        path.addCurve(to: CGPoint(x: 0.5 * width, y: 0.875 * height), control1: CGPoint(x: 0.125 * width, y: 0.70711 * height), control2: CGPoint(x: 0.29289 * width, y: 0.875 * height))
        path.addCurve(to: CGPoint(x: 0.875 * width, y: 0.5 * height), control1: CGPoint(x: 0.70711 * width, y: 0.875 * height), control2: CGPoint(x: 0.875 * width, y: 0.70711 * height))
        path.addCurve(to: CGPoint(x: 0.5 * width, y: 0.125 * height), control1: CGPoint(x: 0.875 * width, y: 0.29289 * height), control2: CGPoint(x: 0.70711 * width, y: 0.125 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.32953 * width, y: 0.25692 * height))
        path.addLine(to: CGPoint(x: 0.32181 * width, y: 0.24982 * height))
        path.addCurve(to: CGPoint(x: 0.52117 * width, y: 0.79608 * height), control1: CGPoint(x: 0.48933 * width, y: 0.40036 * height), control2: CGPoint(x: 0.55523 * width, y: 0.58103 * height))
        path.addCurve(to: CGPoint(x: 0.5 * width, y: 0.79688 * height), control1: CGPoint(x: 0.51418 * width, y: 0.79662 * height), control2: CGPoint(x: 0.50712 * width, y: 0.79688 * height))
        path.addCurve(to: CGPoint(x: 0.45858 * width, y: 0.79401 * height), control1: CGPoint(x: 0.48594 * width, y: 0.79688 * height), control2: CGPoint(x: 0.47212 * width, y: 0.7959 * height))
        path.addCurve(to: CGPoint(x: 0.28463 * width, y: 0.2958 * height), control1: CGPoint(x: 0.49946 * width, y: 0.60932 * height), control2: CGPoint(x: 0.43497 * width, y: 0.44418 * height))
        path.addCurve(to: CGPoint(x: 0.32953 * width, y: 0.25692 * height), control1: CGPoint(x: 0.29821 * width, y: 0.28135 * height), control2: CGPoint(x: 0.31327 * width, y: 0.26834 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.4373 * width, y: 0.20976 * height))
        path.addLine(to: CGPoint(x: 0.43205 * width, y: 0.20488 * height))
        path.addCurve(to: CGPoint(x: 0.64067 * width, y: 0.75666 * height), control1: CGPoint(x: 0.60487 * width, y: 0.36018 * height), control2: CGPoint(x: 0.67368 * width, y: 0.54276 * height))
        path.addLine(to: CGPoint(x: 0.64742 * width, y: 0.75774 * height))
        path.addCurve(to: CGPoint(x: 0.59919 * width, y: 0.7799 * height), control1: CGPoint(x: 0.63215 * width, y: 0.7665 * height), control2: CGPoint(x: 0.61602 * width, y: 0.77394 * height))
        path.addCurve(to: CGPoint(x: 0.40011 * width, y: 0.22047 * height), control1: CGPoint(x: 0.62574 * width, y: 0.56384 * height), control2: CGPoint(x: 0.55897 * width, y: 0.37632 * height))
        path.addCurve(to: CGPoint(x: 0.4373 * width, y: 0.20976 * height), control1: CGPoint(x: 0.41209 * width, y: 0.21606 * height), control2: CGPoint(x: 0.42454 * width, y: 0.2125 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.39787 * width, y: 0.68636 * height))
        path.addLine(to: CGPoint(x: 0.39768 * width, y: 0.6967 * height))
        path.addCurve(to: CGPoint(x: 0.38663 * width, y: 0.77433 * height), control1: CGPoint(x: 0.39626 * width, y: 0.72214 * height), control2: CGPoint(x: 0.39257 * width, y: 0.74801 * height))
        path.addCurve(to: CGPoint(x: 0.31619 * width, y: 0.73314 * height), control1: CGPoint(x: 0.36109 * width, y: 0.76388 * height), control2: CGPoint(x: 0.33746 * width, y: 0.74994 * height))
        path.addCurve(to: CGPoint(x: 0.39787 * width, y: 0.68636 * height), control1: CGPoint(x: 0.33955 * width, y: 0.71756 * height), control2: CGPoint(x: 0.36474 * width, y: 0.70334 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.37954 * width, y: 0.5508 * height))
        path.addCurve(to: CGPoint(x: 0.39623 * width, y: 0.63123 * height), control1: CGPoint(x: 0.38789 * width, y: 0.57731 * height), control2: CGPoint(x: 0.39344 * width, y: 0.60402 * height))
        path.addLine(to: CGPoint(x: 0.39971 * width, y: 0.62944 * height))
        path.addCurve(to: CGPoint(x: 0.27882 * width, y: 0.69795 * height), control1: CGPoint(x: 0.34731 * width, y: 0.6555 * height), control2: CGPoint(x: 0.31232 * width, y: 0.67481 * height))
        path.addCurve(to: CGPoint(x: 0.23805 * width, y: 0.63984 * height), control1: CGPoint(x: 0.26301 * width, y: 0.68038 * height), control2: CGPoint(x: 0.2493 * width, y: 0.66087 * height))
        path.addLine(to: CGPoint(x: 0.22957 * width, y: 0.64615 * height))
        path.addCurve(to: CGPoint(x: 0.37954 * width, y: 0.5508 * height), control1: CGPoint(x: 0.27974 * width, y: 0.60801 * height), control2: CGPoint(x: 0.32973 * width, y: 0.57623 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.72259 * width, y: 0.61673 * height))
        path.addLine(to: CGPoint(x: 0.72925 * width, y: 0.61801 * height))
        path.addCurve(to: CGPoint(x: 0.76819 * width, y: 0.62741 * height), control1: CGPoint(x: 0.74075 * width, y: 0.62039 * height), control2: CGPoint(x: 0.75374 * width, y: 0.62353 * height))
        path.addCurve(to: CGPoint(x: 0.72248 * width, y: 0.69657 * height), control1: CGPoint(x: 0.75623 * width, y: 0.65261 * height), control2: CGPoint(x: 0.74077 * width, y: 0.67588 * height))
        path.addCurve(to: CGPoint(x: 0.72259 * width, y: 0.61673 * height), control1: CGPoint(x: 0.72405 * width, y: 0.66947 * height), control2: CGPoint(x: 0.72409 * width, y: 0.64288 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.32647 * width, y: 0.44097 * height))
        path.addLine(to: CGPoint(x: 0.32867 * width, y: 0.44422 * height))
        path.addCurve(to: CGPoint(x: 0.36143 * width, y: 0.504 * height), control1: CGPoint(x: 0.34132 * width, y: 0.46387 * height), control2: CGPoint(x: 0.35224 * width, y: 0.48379 * height))
        path.addCurve(to: CGPoint(x: 0.21791 * width, y: 0.59248 * height), control1: CGPoint(x: 0.31355 * width, y: 0.52802 * height), control2: CGPoint(x: 0.26571 * width, y: 0.55755 * height))
        path.addCurve(to: CGPoint(x: 0.2038 * width, y: 0.52023 * height), control1: CGPoint(x: 0.21031 * width, y: 0.56961 * height), control2: CGPoint(x: 0.20549 * width, y: 0.54535 * height))
        path.addLine(to: CGPoint(x: 0.20457 * width, y: 0.52115 * height))
        path.addCurve(to: CGPoint(x: 0.32647 * width, y: 0.44097 * height), control1: CGPoint(x: 0.24528 * width, y: 0.49021 * height), control2: CGPoint(x: 0.28591 * width, y: 0.46349 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.69845 * width, y: 0.47625 * height))
        path.addLine(to: CGPoint(x: 0.70401 * width, y: 0.4767 * height))
        path.addCurve(to: CGPoint(x: 0.79657 * width, y: 0.48859 * height), control1: CGPoint(x: 0.73025 * width, y: 0.47885 * height), control2: CGPoint(x: 0.76113 * width, y: 0.48281 * height))
        path.addCurve(to: CGPoint(x: 0.79688 * width, y: 0.5 * height), control1: CGPoint(x: 0.7968 * width, y: 0.49238 * height), control2: CGPoint(x: 0.79688 * width, y: 0.49618 * height))
        path.addCurve(to: CGPoint(x: 0.78585 * width, y: 0.58043 * height), control1: CGPoint(x: 0.79688 * width, y: 0.52788 * height), control2: CGPoint(x: 0.79303 * width, y: 0.55485 * height))
        path.addCurve(to: CGPoint(x: 0.71734 * width, y: 0.56505 * height), control1: CGPoint(x: 0.75885 * width, y: 0.57301 * height), control2: CGPoint(x: 0.73609 * width, y: 0.5679 * height))
        path.addCurve(to: CGPoint(x: 0.69845 * width, y: 0.47625 * height), control1: CGPoint(x: 0.71333 * width, y: 0.53486 * height), control2: CGPoint(x: 0.70696 * width, y: 0.50524 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.24715 * width, y: 0.34436 * height))
        path.addLine(to: CGPoint(x: 0.25925 * width, y: 0.35676 * height))
        path.addCurve(to: CGPoint(x: 0.29709 * width, y: 0.40022 * height), control1: CGPoint(x: 0.27287 * width, y: 0.3711 * height), control2: CGPoint(x: 0.28548 * width, y: 0.38558 * height))
        path.addCurve(to: CGPoint(x: 0.20609 * width, y: 0.458 * height), control1: CGPoint(x: 0.26672 * width, y: 0.41722 * height), control2: CGPoint(x: 0.23639 * width, y: 0.43652 * height))
        path.addCurve(to: CGPoint(x: 0.24715 * width, y: 0.34436 * height), control1: CGPoint(x: 0.21189 * width, y: 0.41684 * height), control2: CGPoint(x: 0.22619 * width, y: 0.37833 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.64694 * width, y: 0.35248 * height))
        path.addLine(to: CGPoint(x: 0.65612 * width, y: 0.35277 * height))
        path.addCurve(to: CGPoint(x: 0.7634 * width, y: 0.36307 * height), control1: CGPoint(x: 0.68681 * width, y: 0.35413 * height), control2: CGPoint(x: 0.7226 * width, y: 0.35756 * height))
        path.addCurve(to: CGPoint(x: 0.79016 * width, y: 0.43692 * height), control1: CGPoint(x: 0.77547 * width, y: 0.3861 * height), control2: CGPoint(x: 0.78452 * width, y: 0.41088 * height))
        path.addCurve(to: CGPoint(x: 0.68091 * width, y: 0.42517 * height), control1: CGPoint(x: 0.74729 * width, y: 0.43031 * height), control2: CGPoint(x: 0.71094 * width, y: 0.42638 * height))
        path.addCurve(to: CGPoint(x: 0.64694 * width, y: 0.35248 * height), control1: CGPoint(x: 0.67128 * width, y: 0.40048 * height), control2: CGPoint(x: 0.65993 * width, y: 0.37623 * height))
        path.closeSubpath()
        path.move(to: CGPoint(x: 0.53996 * width, y: 0.20578 * height))
        path.addCurve(to: CGPoint(x: 0.72668 * width, y: 0.30828 * height), control1: CGPoint(x: 0.61473 * width, y: 0.21593 * height), control2: CGPoint(x: 0.68041 * width, y: 0.25363 * height))
        path.addCurve(to: CGPoint(x: 0.61639 * width, y: 0.30219 * height), control
```

### Core Architecture Module: `Examples/SampleCat/SampleCat/Utils/Views/Spinner/Shapes/YarnShape.swift`
```
import SwiftUI

struct YarnShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        path.move(to: CGPoint(x: 0.03637 * width, y: 0.78444 * height))
        path.addLine(to: CGPoint(x: 0.08115 * width, y: 0.76884 * height))
        path.addCurve(to: CGPoint(x: 0.18522 * width, y: 0.77799 * height), control1: CGPoint(x: 0.11555 * width, y: 0.75686 * height), control2: CGPoint(x: 0.15344 * width, y: 0.76019 * height))
        path.addCurve(to: CGPoint(x: 0.29215 * width, y: 0.81214 * height), control1: CGPoint(x: 0.2182 * width, y: 0.79645 * height), control2: CGPoint(x: 0.25457 * width, y: 0.80807 * height))
        path.addLine(to: CGPoint(x: 0.45597 * width, y: 0.82989 * height))
        path.addCurve(to: CGPoint(x: 0.4852 * width, y: 0.83147 * height), control1: CGPoint(x: 0.46568 * width, y: 0.83094 * height), control2: CGPoint(x: 0.47544 * width, y: 0.83147 * height))
        path.addLine(to: CGPoint(x: 0.4852 * width, y: 0.83147 * height))
        path.addLine(to: CGPoint(x: 0.4852 * width, y: 0.83147 * height))
        return path
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8200** (2026-11-04): **[TSan] Data race in SystemInfo._isSandbox lazy initialization (5.102.0)**
  *Symptoms*: ### Describe the bug  Thread Sanitizer reported a race in SystemInfo._isSandbox.getter during SDK startup in a hosted iOS test run. The recorded process abort is the sanitizer terminating after ReportRace, on RC Backend Queue while constructing an HTTP request's default headers.  In purchases-ios-spm 5.102.0, Sources/Misc/SystemInfo.swift:95-101 declares an unprotected instance lazy property and returns it directly:  private lazy var _isSandbox: Bool = {     return self.sandboxEnvironmentDetector.isSandbox }()  var isSandbox: Bool {     return self._isSandbox }  Swift instance lazy initialization is not synchronized. Concurrent first access is therefore an unsafe path. Please make this cached value safe for the SDK's concurrent readers while preserving its environment-detection semantics.  The preserved crash artifact contains the reporting access stack below, but not TSan's conflicting-access stack. I cannot identify the second racing access from that artifact. No ordinary production crash, incorrect entitlement, or failed purchase has been attributed to this race.  ### Platform  iOS  ### SDK version  5.102.0 (purchases-ios-spm revision 193efe58cf61f9d59da4076dd394490ae59e86a9)  ### SDK integration method  Swift Package Manager  ### StoreKit version  StoreKit 2 (default on versions >=5.0.0)  ### OS version  iOS Simulator 27.2; host macOS 27.0.1 (26A434), Apple Silicon  ### Xcode version  27.2 (27B52)  ### Device and/or simulator  Simulator  ### Environment  Sandbox  ### How 

- **Issue #7931** (2026-10-08): **🐛 Received unknown workflow trigger type: on_purchase_press (iOS, 10.11.0)**
  *Symptoms*: ### Describe the bug  On iOS the SDK logs this warning on every launch:  [RevenueCat] ⚠️ Received unknown workflow trigger type: on_purchase_press  It is logged during workflow cache warm-up, right after offerings load and before the paywall is presented ("Warming up workflow caches for 1 screen(s)"). The workflow has a single screen and its Purchase button carries an on_purchase_press trigger.  react-native-purchases 10.11.0 bundles PurchasesHybridCommon 19.5.0, which uses the iOS SDK 5.92.0. In that SDK, WorkflowTriggerType (Sources/Networking/Responses/WorkflowsResponse.swift) only decodes "on_press"; any other value is logged and mapped to .unknown, and WorkflowNavigator looks triggers up by .onPress, so the trigger is never acted on.  purchases-ios#6905 lists "Handling on_purchase_press / on_close_workflow_press workflow trigger types" as out of scope ("separate PRs; this branch logs them as unknown"). I found no tracking issue and no released fix: 5.92.0 and PurchasesHybridCommon 19.6.0 are the latest, and the default branch of purchases-ios still only has on_press.  Questions: 1. Is this expected for workflows served by the backend today? 2. What does the Purchase button do while this trigger is unsupported? 3. Is there a tracking issue or timeline for on_purchase_press support?  I have not checked Android.   ### Platform  iOS  ### SDK version  SDK version: react-native-purchases 10.11.0, react-native-purchases-ui 10.11.0 (PurchasesHybridCommon 19.5.0, iOS SDK 5.92.0, 

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

### Incident Patch 1: `cd2ea7ef` (2026-11-05)
**Commit Message**: fix(paywalls): stop nested Fill stacks from hanging on iOS 17  (#8230)

* fix(paywalls): stop nested Fill stacks from hanging on iOS 17

On iOS 17, SwiftUI places a frame's content three times per placement
whenever an ancestor proposes an unbounded size, as the paywall's root
ScrollView or ViewThatFits does. Each nested Fill stack multiplies that,
so a paywall about a dozen stacks deep keeps the main thread busy for
minutes and never appears.

Fill sizing now goes through a single-child Layout on iOS 17 that sizes
like the frame did and aligns by size, placing its content once.



* refactor(paywalls): trim FillLayout to its essentials

Drops the negative-proposal clamp, which SwiftUI never needs, and folds
the alignment fractions inline. Behavior and test coverage are unchanged.



* refactor(paywalls): move Layout conformances into extensions

Follows the style guide: stored properties in the declaration, protocol
conformance in an extension.



---------

Co-authored-by: Nevyn Bengtsson <[REDACTED_EMAIL]>
Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `RevenueCatUI/Templates/V2/ViewHelpers/SizeModifier.swift` (modified, +62/-2)
```diff
@@ -40,7 +40,7 @@ extension View {
             self
         case let .fill(minMax):
             self
-                .frame(minWidth: 0, maxWidth: .infinity, alignment: alignment)
+                .fill(.horizontal, alignment: alignment)
                 .applyWidthLimits(minMax, alignment: alignment)
         case .fixed(let value):
             self
@@ -58,7 +58,7 @@ extension View {
             self
         case let .fill(minMax):
             self
-                .frame(minHeight: 0, maxHeight: .infinity, alignment: alignment)
+                .fill(.vertical, alignment: alignment)
                 .applyHeightLimits(minMax, alignment: alignment)
         case .fixed(let value):
             self
@@ -69,6 +69,31 @@ extension View {
         }
     }
 
+    /// Takes all the space proposed along `axis`, like `.frame(minWidth: 0, maxWidth: .infinity)`.
+    ///
+    /// iOS 17 places a frame's content three times under an unbounded proposal, such as a `ScrollView`'s, and
+    /// every nested Fill stack multiplies that until the paywall hangs. ``FillLayout`` places it once.
+    @ViewBuilder
+    func fill(_ axis: Axis, alignment: Alignment) -> some View {
+        if #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, *) {
+            self.fillFrame(axis, alignment: alignment)
+        } else if #available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *) {
+            FillLayout(axis: axis, alignment: alignment) { self }
+        } else {
+            self.fillFrame(axis, alignment: alignment)
+        }
+    }
+
+    @ViewBuilder
+    private func fillFrame(_ axis: Axis, alignment: Alignment) -> some View {
+        switch axis {
+        case .horizontal:
+            self.frame(minWidth: 0, maxWidth: .infinity, alignment: alignment)
+        case .vertical:
+            self.frame(minHeight: 0, maxHeight: .infinity, alignment: alignment)
+        }
+    }
+
     @ViewBuilder
     func applyWidthLimits(_ minMax: MinMax, alignment: Alignment) -> some View {
         if minMax.hasLimit {
@@ -97,6 +122,41 @@ extension View {
 
 }
 
+/// Lays out its single subview like `.frame(minWidth: 0, maxWidth: .infinity, alignment:)` along `axis`.
+@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+private struct FillLayout {
+
+    let axis: Axis
+    let alignment: Alignment
+
+}
+
+@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+extension FillLayout: Layout {
+
+    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
+        let size = subviews.first?.sizeThatFits(proposal) ?? .zero
+        return self.axis == .horizontal
+            ? CGSize(width: proposal.width ?? size.width, height: size.height)
+            : CGSize(width: size.width, height: proposal.height ?? size.height)
+    }
+
+    // By size, not `dimensions(in:)`: a stack's alignment guides lay out its whole subtree again.
+    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
+        guard let subview = subviews.first else { return }
+        let size = subview.sizeThatFits(proposal)
+        let horizontal = self.alignment.horizontal
+        let vertical = self.alignment.vertical
+        let xFraction: CGFloat = horizontal == .leading ? 0 : horizontal == .trailing ? 1 : 0.5
+        let yFraction: CGFloat = vertical == .top ? 0 : vertical == .bottom ? 1 : 0.5
+        subview.place(at: CGPoint(x: bounds.minX + xFraction * (bounds.width - size.width),
+                                  y: bounds.minY + yFraction * (bounds.height - size.height)),
+                      anchor: .topLeading,
+                      proposal: proposal)
+    }
+
+}
+
 extension MinMax {
 
     fileprivate var hasLimit: Bool {
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/SizeModifierTests.swift` (modified, +64/-0)
```diff
@@ -180,6 +180,35 @@ final class SizeModifierTests: TestCase {
                        .init(width: 100, height: 600))
     }
 
+    func testNestedFillStacksInsideScrollViewPlaceContentOnce() throws {
+        guard #available(iOS 16.0, *) else { throw XCTSkip("PlacementRecorder needs iOS 16") }
+        let log = PlacementRecorder.Log()
+        var content = AnyView(PlacementRecorder(log: log) { Color.clear.frame(width: 10, height: 10) })
+        for _ in 0..<10 {
+            content = AnyView(VStack { content }.size(.init(width: .fill, height: .fit(nil))))
+        }
+
+        Self.layOut(ScrollView { content }, in: .init(width: 100, height: 600))
+
+        // iOS 17 used to place each level's content three times: 2 * 3^10 placements of this leaf.
+        XCTAssertGreaterThan(log.placements.count, 0)
+        XCTAssertLessThan(log.placements.count, 20)
+    }
+
+    func testFillAlignsContentLikeAFrame() throws {
+        guard #available(iOS 16.0, *) else { throw XCTSkip("PlacementRecorder needs iOS 16") }
+        for (alignment, minX) in [(HorizontalAlignment.leading, 0.0), (.center, 45), (.trailing, 90)] {
+            let log = PlacementRecorder.Log()
+            let view = PlacementRecorder(log: log) { Color.clear.frame(width: 10, height: 10) }
+                .size(.init(width: .fill, height: .fixed(10)),
+                      horizontalAlignment: Alignment(horizontal: alignment, vertical: .center))
+
+            Self.layOut(view.frame(width: 100, height: 10), in: .init(width: 100, height: 10))
+
+            XCTAssertEqual(log.placements.last?.minX, CGFloat(minX))
+        }
+    }
+
     private static func requireFitScrollAvailability() throws {
         guard #available(iOS 16.0, *) else {
             throw XCTSkip("FIT scrolling uses ViewThatFits on iOS 16 and later")
@@ -190,6 +219,41 @@ final class SizeModifierTests: TestCase {
         UIHostingController(rootView: view).sizeThatFits(in: proposal)
     }
 
+    private static func layOut<Content: View>(_ view: Content, in size: CGSize) {
+        let controller = UIHostingController(rootView: view)
+        let window = UIWindow(frame: CGRect(origin: .zero, size: size))
+        window.rootViewController = controller
+        window.isHidden = false
+        controller.view.frame = window.bounds
+        controller.view.layoutIfNeeded()
+    }
+
+}
+
+/// Passes its single subview through unchanged, logging the bounds of every placement.
+@available(iOS 16.0, *)
+private struct PlacementRecorder {
+
+    final class Log {
+        var placements: [CGRect] = []
+    }
+
+    let log: Log
+
+}
+
+@available(iOS 16.0, *)
+extension PlacementRecorder: Layout {
+
+    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
+        subviews.first?.sizeThatFits(proposal) ?? .zero
+    }
+
+    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
+        self.log.placements.append(bounds)
+        subviews.first?.place(at: bounds.origin, proposal: proposal)
+    }
+
 }
 
 #endif
```

---

### Incident Patch 2: `87417b48` (2026-11-06)
**Commit Message**: ci: merge gate that tightens once the full suite is approved (#8235)

* ci: post a merge gate status that tightens once the full suite is approved

Adds a ci/all-tests-gate commit status driven from CircleCI. A no-requires
job posts success at pipeline start, approving the full-suite hold flips
it to pending, and all-tasks-passed posts success again once every full
job is green. Release pipelines post it from all-tests-succeeded so
release PRs are not blocked once the context is required.

The reduced suite needs no gate of its own: its jobs are already required
individually.

* test: find the merge gate by its instance name

all-tasks-passed is now an instance of the parameterized post-gate-status
job, so the workflow entry is keyed by the job name and carries name:.

* ci: never post the default gate success once the full suite is requested

full-suite-not-requested waits for the reduced suite and checks the
hold first: approved means halt without posting, so the gate goes from
unreported straight to pending; anything but on_hold fails the job
rather than posting success. all-tasks-passed reaches the reduced suite
through full-suite-started, so it keeps a single list, and the tes

**File**: `.circleci/default_config.yml` (modified, +75/-32)
```diff
@@ -2453,23 +2453,49 @@ jobs:
           name: Trigger RC App Pipeline
           command: bundle exec fastlane trigger_bump_sdk_in_rc_mobile_app
 
-  all-tests-succeeded:
-    docker:
-      - image: cimg/base:stable
-    resource_class: small
-    steps:
-      - run:
-          name: All tests succeeded
-          command: echo "All tests succeeded"
-
-  all-tasks-passed:
+  post-gate-status:
+    parameters:
+      state:
+        type: enum
+        enum: [success, pending]
+      unless_full_suite_approved:
+        type: boolean
+        default: false
     docker:
       - image: cimg/base:stable
     resource_class: small
     steps:
-      - run:
-          name: All tasks passed
-          command: echo "All tasks passed"
+      - when:
+          condition: << parameters.unless_full_suite_approved >>
+          steps:
+            - run:
+                name: Halt if approve-full-tests was already approved
+                command: |
+                  approval=$(curl --fail --silent --show-error --max-time 30 --retry 5 \
+                    -H "Circle-Token: ${CIRCLECI_API_TOKEN}" \
+                    "https://circleci.com/api/v2/workflow/${CIRCLE_WORKFLOW_ID}/job" \
+                    | jq -r '.items[] | select(.name == "approve-full-tests") | .status')
+                  case "$approval" in
+                    success)
+                      echo "Full suite already requested, leaving the gate to it"
+                      circleci-agent step halt
+                      ;;
+                    on_hold) ;;
+                    *)
+                      echo "Unexpected approve-full-tests status '${approval}', not posting"
+                      exit 1
+                      ;;
+                  esac
+      - run:
+          name: Post ci/all-tests-gate status (<< parameters.state >>)
+          environment:
+            GATE_STATE: << parameters.state >>
+          command: |
+            curl --fail --silent --show-error --output /dev/null --retry 5 \
+              -X POST "https://api.github.com/repos/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}/statuses/${CIRCLE_SHA1}" \
+              -H "Authorization: Bearer ${GITHUB_TOKEN}" \
+              -H "Accept: application/vnd.github+json" \
+              -d "{\"state\":\"${GATE_STATE}\",\"context\":\"ci/all-tests-gate\",\"target_url\":\"${CIRCLE_BUILD_URL}\"}"
 
 workflows:
   record-performance-baselines:
@@ -2585,12 +2611,38 @@ workflows:
       - revenuecat-ads-tests:
           context:
             - slack-secrets
+      - post-gate-status:
+          name: full-suite-not-requested
+          state: success
+          unless_full_suite_approved: true
+          requires:
+            - performance-tests
+            - performance-automation-tests
+            - lint
+            - check-api-changes
+            - run-test-ios-27
+            - build-samplecat
+            - build-purchase-tester
+            - pod-lib-lint
+            - run-revenuecat-ui-ios-27
+            - run-revenuecat-ui-ios-26
+            - emerge_purchases_ui_snapshot_tests
+            - binary_size_analysis
+            - build-tv-watch-mac-and-visionos
+            - revenuecat-admob-tests
+            - revenuecat-ads-tests
 
       # =============================================================
       # Hold gate for the Full Test Suite
       # =============================================================
       - approve-full-tests:
           type: approval
+      - post-gate-status:
+          name: full-suite-started
+          state: pending
+          requires:
+            - approve-full-tests
+            - full-suite-not-requested
 
       # =============================================================
       # Full Test Suite: Gated behind approve-full-tests
@@ -2745,22 +2797,11 @@ workflows:
       # =============================================================
       # Summary gate: blocks merge until all jobs pass
       # =============================================================
-      - all-tasks-passed:
+      - post-gate-status:
+          name: all-tasks-passed
+          state: success
           requires:
-            # Reduced Test Suite
-            - performance-tests
-            - performance-automation-tests
-            - lint
-            - check-api-changes
-            - run-test-ios-27
-            - build-samplecat
-            - build-purchase-tester
-            - pod-lib-lint
-            - run-revenuecat-ui-ios-27
-            - run-revenuecat-ui-ios-26
-            - emerge_purchases_ui_snapshot_tests
-            - binary_size_analysis
-            - build-tv-watch-mac-and-visionos
+            - full-suite-started
             # Full Test Suite
             - backend-integration-tests-SK1
             - backend-integration-tests-SK2
@@ -2784,8 +2825,6 @@ workflows:
             - api-tests
             - spm-receipt-parser
             - check-app-extension-safe-api-usage
-            - revenueca
```

**File**: `.github/workflows/rcgitbot_please_test.yml` (modified, +16/-1)
```diff
@@ -17,14 +17,17 @@ jobs:
       github.event.comment.author_association == 'MEMBER'
     permissions:
       pull-requests: write
+      statuses: write
 
     steps:
       # GitHub Actions `issue_comment` workflows always run from the default branch,
       # so we resolve the PR's head branch to find its CircleCI pipeline and approve
       # the hold job in the existing workflow.
       - name: Get PR branch
         id: get-branch
-        run: echo "branch=$(gh pr view "$PR_NO" --repo "$REPO" --json headRefName --jq '.headRefName')" >> "$GITHUB_OUTPUT"
+        run: |
+          gh pr view "$PR_NO" --repo "$REPO" --json headRefName,headRefOid \
+            --jq '"branch=\(.headRefName)\nsha=\(.headRefOid)"' >> "$GITHUB_OUTPUT"
         env:
           REPO: ${{ github.repository }}
           PR_NO: ${{ github.event.issue.number }}
@@ -126,6 +129,18 @@ jobs:
           fi
 
           echo "Successfully approved '$APPROVAL_JOB_NAME' in workflow '$WORKFLOW_NAME'"
+          echo "approved=true" >> "$GITHUB_OUTPUT"
+
+      - name: Mark the merge gate pending
+        if: steps.approve.outputs.approved == 'true'
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          REPO: ${{ github.repository }}
+          SHA: ${{ steps.get-branch.outputs.sha }}
+          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
+        run: |
+          gh api "repos/$REPO/statuses/$SHA" \
+            -f state=pending -f context=ci/all-tests-gate -f target_url="$RUN_URL"
 
       - name: React to comment
         if: always()
```

**File**: `fastlane/performance_baseline_helper_test.rb` (modified, +14/-2)
```diff
@@ -72,8 +72,20 @@ def test_rejects_results_after_branch_changes
   def test_pr_merge_gate_requires_the_memory_benchmark
     config = YAML.safe_load(File.read(File.join(ROOT, '.circleci/default_config.yml')), aliases: true)
     jobs = config.fetch('workflows').fetch('run-all-tests').fetch('jobs')
-    gate = jobs.find { |job| job.is_a?(Hash) && job.key?('all-tasks-passed') }
-    assert_includes gate.fetch('all-tasks-passed').fetch('requires'), 'performance-tests'
+    gate = jobs.find { |job| job.is_a?(Hash) && job.values.first['name'] == 'full-suite-not-requested' }
+    assert_includes gate.values.first.fetch('requires'), 'performance-tests'
+  end
+
+  def test_merge_gate_posts_pending_after_the_default_success_and_success_last
+    config = YAML.safe_load(File.read(File.join(ROOT, '.circleci/default_config.yml')), aliases: true)
+    jobs = config.fetch('workflows').fetch('run-all-tests').fetch('jobs')
+    gates = jobs.select { |job| job.is_a?(Hash) && job.key?('post-gate-status') }.to_h { |job| [job['post-gate-status']['name'], job['post-gate-status']] }
+    assert_equal 'success', gates.fetch('full-suite-not-requested').fetch('state')
+    assert_equal true, gates.fetch('full-suite-not-requested').fetch('unless_full_suite_approved')
+    assert_equal 'pending', gates.fetch('full-suite-started').fetch('state')
+    assert_equal %w[approve-full-tests full-suite-not-requested], gates.fetch('full-suite-started').fetch('requires').sort
+    assert_equal 'success', gates.fetch('all-tasks-passed').fetch('state')
+    assert_includes gates.fetch('all-tasks-passed').fetch('requires'), 'full-suite-started'
   end
 
   def test_requested_job_enables_record_and_push_with_boolean_parameters
```

---

### Incident Patch 3: `05faffdd` (2026-11-05)
**Commit Message**: fix(Paywalls) Package selection resolution on older OSes (#8226)

**File**: `RevenueCatUI/Templates/V2/Components/Button/BottomSheetView.swift` (modified, +2/-2)
```diff
@@ -95,9 +95,9 @@ private struct SheetPackageSelectionModifier: ViewModifier {
         )
     }
 
-    private var selectedPackageIsVisible: Bool {
+    private func selectedPackageIsVisible() -> Bool {
         guard let validator = self.viewModel.packageValidator,
-              !validator.packages.isEmpty else { return self.inheritedSelectionIsVisible }
+              !validator.packages.isEmpty else { return self.inheritedSelectionIsVisible() }
         guard let package = self.packageContext.package else { return false }
         return validator.couldBeRendering(
             package,
```

**File**: `RevenueCatUI/Templates/V2/Components/Tabs/TabsComponentView.swift` (modified, +5/-3)
```diff
@@ -252,7 +252,7 @@ struct LoadedTabsComponentView: View {
     private func reconcileSelection(_ context: PackageContext, tabViewModel: TabViewModel) {
         // A root row can intentionally clear the tab's highlight. Resuming after a sheet
         // must preserve that manual root choice while it can still render.
-        if self.selectedPackageIsVisible,
+        if self.selectedPackageIsVisible(),
            self.selectionState.didUserSelectPackage,
            self.packageContext.package?.identifier == self.selectionState.parentOwnedPackage?.identifier,
            TabPackageParentPropagation.shouldSuppressNotifyingParent(
@@ -368,13 +368,15 @@ struct LoadedTabsComponentView: View {
             .environmentObject(tierPackageContext)
             .environment(
                 \.selectedPackageIsVisible,
-                tierPackageContext === self.packageContext ? self.selectedPackageIsVisible
-                    : activeTabViewModel.validatedSelection(
+                {
+                    tierPackageContext === self.packageContext ? self.selectedPackageIsVisible()
+                        : activeTabViewModel.validatedSelection(
                         tierPackageContext.package,
                         in: self.packageSelectionContext,
                         offerEligibilityLoading: self.offerEligibilityLoading,
                         offerEligibilityAvailability: self.offerEligibilityAvailability
                     ) != nil
+                }
             )
             .environment(
                 \.planSelectionDefaultPackage,
```

**File**: `RevenueCatUI/Templates/V2/EnvironmentObjects/PlanSelectionDefaultPackage.swift` (modified, +4/-3)
```diff
@@ -21,9 +21,10 @@ private struct PlanSelectionDefaultPackageKey: EnvironmentKey {
     static let defaultValue: Package? = nil
 }
 
-/// Whether the selected package has a card that can render in its owning scope.
+/// Checks whether the current selection has a card that can render in its owning scope.
+/// Evaluate lazily because pre-iOS 17 `onChange` closures capture the previous render's environment.
 private struct SelectedPackageIsVisibleKey: EnvironmentKey {
-    static let defaultValue = true
+    static let defaultValue: () -> Bool = { true }
 }
 
 extension EnvironmentValues {
@@ -33,7 +34,7 @@ extension EnvironmentValues {
         set { self[PlanSelectionDefaultPackageKey.self] = newValue }
     }
 
-    var selectedPackageIsVisible: Bool {
+    var selectedPackageIsVisible: () -> Bool {
         get { self[SelectedPackageIsVisibleKey.self] }
         set { self[SelectedPackageIsVisibleKey.self] = newValue }
     }
```

**File**: `RevenueCatUI/Templates/V2/PaywallsV2View.swift` (modified, +1/-1)
```diff
@@ -748,7 +748,7 @@ struct LoadedPaywallsV2View: View {
         )
     }
 
-    private var selectedPackageIsVisible: Bool {
+    private func selectedPackageIsVisible() -> Bool {
         guard let package = self.selectedPackageContext.package else { return false }
         return self.paywallState.viewModelFactory.packageValidator.couldBeRendering(
             package,
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/RootViewSheetDismissalTests.swift` (modified, +8/-1)
```diff
@@ -69,7 +69,12 @@ extension RootViewSheetDismissalTests {
         try await PackageResolutionTestFixture.settlePresentation()
         let snapshot = fixture.context.package
         let variables = fixture.context.variableContext
-        let tabContext = try XCTUnwrap(fixture.context.tabsState(for: fixture.tabs).contextsByTabId["tab-2"])
+        let tabsState = fixture.context.tabsState(for: fixture.tabs)
+        let tabContext = try XCTUnwrap(tabsState.contextsByTabId["tab-2"])
+        XCTAssertEqual(snapshot?.identifier, rootPackage.identifier)
+        XCTAssertEqual(fixture.context.manuallySelectedPackage?.identifier, rootPackage.identifier)
+        XCTAssertTrue(tabsState.didUserSelectPackage)
+        XCTAssertEqual(tabsState.parentOwnedPackage?.identifier, rootPackage.identifier)
         XCTAssertNil(tabContext.package)
 
         let sheetValidator = try XCTUnwrap(fixture.state.rootViewModel.stackViewModel.viewModels.compactMap {
@@ -80,6 +85,8 @@ extension RootViewSheetDismissalTests {
         try await PackageResolutionTestFixture.settlePresentation()
         XCTAssertEqual(sheetContext.package?.identifier, "annual_xl")
         XCTAssertEqual(fixture.context.package?.identifier, "annual_xl")
+        XCTAssertEqual(fixture.context.manuallySelectedPackage?.identifier, rootPackage.identifier)
+        XCTAssertEqual(tabsState.parentOwnedPackage?.identifier, rootPackage.identifier)
 
         fixture.context.update(
             package: RootView.restoredPackageAfterSheetDismissal(
```

#### Recent Merged Pull Requests:
- **PR #8237** (2026-11-06): Prepare next version: 5.103.0-SNAPSHOT (@RCGitBot)
- **PR #8235** (2026-11-06): ci: merge gate that tightens once the full suite is approved (@AlvaroBrey)
- **PR #8233** (2026-11-06): [AUTOMATIC] Release/5.102.3 (@RCGitBot)
- **PR #8232** (2026-11-06): feat(checkpoints): gate rewarded ad steps on an earned reward (@peterporfy)
- **PR #8231** (2026-11-06): Prepare next version: 5.103.0-SNAPSHOT (@RCGitBot)
- **PR #8230** (2026-11-05): fix(paywalls): stop nested Fill stacks from hanging on iOS 17  (@JZDesign)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. paywalls): stop nested Fill stacks from hanging on iOS 17  (#8230)

**RULE**:
When implementing operations in `RevenueCatUI/Templates/V2/ViewHelpers/SizeModifier.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RevenueCat/purchases-ios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cd2ea7ef`: paywalls): stop nested Fill stacks from hanging on iOS 17  (#8230). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `RevenueCatUI/Templates/V2/ViewHelpers/SizeModifier.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                .fill(.horizontal, alignment: alignment)
                .fill(.vertical, alignment: alignment)
    /// Takes all the space proposed along `axis`, like `.frame(minWidth: 0, maxWidth: .infinity)`.
    ///
    /// iOS 17 places a frame's content three times under an unbounded proposal, such as a `ScrollView`'s, and
    /// every nested Fill stack multiplies that until the paywall hangs. ``FillLayout`` places it once.
    @ViewBuilder
    func fill(_ axis: Axis, alignment: Alignment) -> some View {
        if #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, *) {
            self.fillFrame(axis, alignment: alignment)
        } else if #available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *) {
            FillLayout(axis: axis, alignment: alignment) { self }
        } else {
            self.fillFrame(axis, alignment: alignment)
        }
    }

    @ViewBuilder
    private func fillFrame(_ axis: Axis, alignment: Alignment) -> some View {
        switch axis {
        case .horizontal:
            self.frame(minWidth: 0, maxWidth: .infinity, alignment: alignment)
        case .vertical:
            self.frame(minHeight: 0, maxHeight: .infinity, alignment: al
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
                .frame(minWidth: 0, maxWidth: .infinity, alignment: alignment)
                .frame(minHeight: 0, maxHeight: .infinity, alignment: alignment)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cd2ea7ef` are properly handled with clean fallback behavior.
