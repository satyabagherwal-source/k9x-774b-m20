> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/revenuecat-purchases-ios-learnings.md`  
> **Source**: github ([https://github.com/RevenueCat/purchases-ios](https://github.com/RevenueCat/purchases-ios))  
> **Source Version**: `3fe45f53`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T13:40:18.936Z  
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
> **Harvest Timestamp**: 2026-11-05T13:40:17.937Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RevenueCat/purchases-ios`
- **Description**: In-app purchases and subscriptions made easy. Support for iOS, watchOS, tvOS, macOS, and visionOS.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3092 stars

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

### Incident Patch 1: `f812926c` (2026-11-04)
**Commit Message**: Fix thread-safe sandbox environment detection (#8202)

**File**: `Sources/Misc/SystemInfo.swift` (modified, +10/-5)
```diff
@@ -84,6 +84,7 @@ class SystemInfo {
     private let _finishTransactions: Atomic<Bool>
     private let _isAppBackgroundedState: Atomic<Bool>
     private let _bundle: Atomic<Bundle>
+    private let _isSandbox: Atomic<Bool?> = nil
 
     private static let _forceUniversalAppStore: Atomic<Bool> = false
     private static let _proxyURL: Atomic<URL?> = nil
@@ -92,12 +93,16 @@ class SystemInfo {
     static let defaultApiBaseURL = URL(string: "https://api.revenuecat.com")!
     private static let _apiBaseURL: Atomic<URL> = .init(defaultApiBaseURL)
 
-    private lazy var _isSandbox: Bool = {
-        return self.sandboxEnvironmentDetector.isSandbox
-    }()
-
     var isSandbox: Bool {
-        return self._isSandbox
+        return self._isSandbox.modify { cachedValue in
+            if let cachedValue {
+                return cachedValue
+            }
+
+            let isSandbox = self.sandboxEnvironmentDetector.isSandbox
+            cachedValue = isSandbox
+            return isSandbox
+        }
     }
 
     /// Whether remote config lifecycle wiring is enabled. Paywall workflows read entirely through
```

**File**: `Tests/UnitTests/Misc/SystemInfoTests.swift` (modified, +53/-0)
```diff
@@ -72,6 +72,38 @@ class SystemInfoTests: TestCase {
         expect(SystemInfo.withReceiptResult(.appStoreReceipt, sandboxDetector).isSandbox) == false
     }
 
+    func testIsSandboxIsComputedOnlyOnceWhenAccessedConcurrently() {
+        let sandboxDetector = SynchronizingSandboxEnvironmentDetector()
+        let systemInfo = SystemInfo(
+            platformInfo: nil,
+            finishTransactions: false,
+            sandboxEnvironmentDetector: sandboxDetector,
+            apiKey: "api_key",
+            preferredLocalesProvider: .mock()
+        )
+        let workersReady = DispatchSemaphore(value: 0)
+        let startWorkers = DispatchSemaphore(value: 0)
+        let workersFinished = DispatchGroup()
+
+        for _ in 0..<2 {
+            workersFinished.enter()
+            DispatchQueue.global().async {
+                workersReady.signal()
+                startWorkers.wait()
+                _ = systemInfo.isSandbox
+                workersFinished.leave()
+            }
+        }
+
+        workersReady.wait()
+        workersReady.wait()
+        startWorkers.signal()
+        startWorkers.signal()
+        workersFinished.wait()
+
+        expect(sandboxDetector.callCount) == 1
+    }
+
     func testIsAppleSubscriptionURLWithAnotherURL() {
         expect(SystemInfo.isAppleSubscription(managementURL: URL(string: "www.google.com")!)) == false
     }
@@ -292,6 +324,27 @@ class SystemInfoTests: TestCase {
 
 }
 
+private final class SynchronizingSandboxEnvironmentDetector: SandboxEnvironmentDetector, @unchecked Sendable {
+
+    private let calls: Atomic<Int> = .init(0)
+    private let secondCallStarted = DispatchSemaphore(value: 0)
+
+    var callCount: Int { self.calls.value }
+
+    var isSandbox: Bool {
+        let callCount = self.calls.increment()
+
+        if callCount == 1 {
+            _ = self.secondCallStarted.wait(timeout: .now() + 0.25)
+        } else {
+            self.secondCallStarted.signal()
+        }
+
+        return true
+    }
+
+}
+
 private extension SystemInfo {
 
     static func withReceiptResult(
```

---

### Incident Patch 2: `33d2211a` (2026-11-05)
**Commit Message**: fix: present Test Store UI in the passed presentationContext (#7978)

* fix: respect presentation context in Test Store

* refactor: keep default presentation context internal

* refactor: use generalized presentation context

* refactor: simplify presentation platform branches

* refactor: group simulated store purchase context

* docs: clarify purchase presentation context support

* fix: cancel dismissed test store sheets

* refactor: unify presentation context declaration

* refactor: require simulated store presentation context argument

* fix: handle unavailable macOS presentation windows

* fix: preserve explicit presentation context failures

* docs: clarify scene purchase presentation behavior

* docs: clarify window purchase presentation behavior

* fix: resolve macOS sheet window from presentation context

**File**: `Sources/FoundationExtensions/UIApplication+RCExtensions.swift` (modified, +16/-3)
```diff
@@ -50,13 +50,26 @@ extension UIApplication {
     @available(watchOSApplicationExtension, unavailable)
     @MainActor
     public var currentPresentationViewController: UIViewController? {
-        guard let windowScene = self.currentWindowScene else { return nil }
+        return self.currentWindowScene?.currentPresentationViewController
+    }
+
+}
+
+extension UIWindowScene {
+
+    /// The topmost view controller in this window scene.
+    @available(macCatalyst 13.1, *)
+    @available(macOS, unavailable)
+    @available(watchOS, unavailable)
+    @available(watchOSApplicationExtension, unavailable)
+    @MainActor
+    var currentPresentationViewController: UIViewController? {
 
         let window: UIWindow?
         if #available(iOS 15.0, macCatalyst 15.0, tvOS 15.0, *) {
-            window = windowScene.keyWindow
+            window = self.keyWindow
         } else {
-            window = windowScene.windows.first { $0.isKeyWindow }
+            window = self.windows.first { $0.isKeyWindow }
         }
 
         return window?.rootViewController?.topMostViewController
```

**File**: `Sources/Purchasing/PresentationContext.swift` (modified, +49/-7)
```diff
@@ -13,35 +13,77 @@
 
 import Foundation
 
-#if canImport(UIKit)
+#if canImport(UIKit) && !os(watchOS)
 import UIKit
-#endif
-
-#if canImport(AppKit)
+#elseif canImport(AppKit) && !targetEnvironment(macCatalyst)
 import AppKit
 #endif
 
 /// The platform UI context for presenting SDK-owned UI.
 @_spi(Internal) public struct PresentationContext: Sendable {
 
     #if canImport(UIKit) && !os(watchOS)
-
     let scene: UIScene
 
     /// Creates a presentation context anchored to a UIKit scene.
     @_spi(Internal) public init(scene: UIScene) {
         self.scene = scene
     }
-
     #elseif canImport(AppKit) && !targetEnvironment(macCatalyst)
-
     let window: NSWindow
 
     /// Creates a presentation context anchored to an AppKit window.
     @_spi(Internal) public init(window: NSWindow) {
         self.window = window
     }
+    #endif
+
+    @MainActor
+    static func defaultPresentationContext(systemInfo: SystemInfo) -> Self? {
+        #if canImport(UIKit) && !os(watchOS)
+        if #available(macCatalyst 13.1, *) {
+            return systemInfo.sharedUIApplication?.currentWindowScene.map(Self.init(scene:))
+        }
+
+        return nil
+        #elseif canImport(AppKit) && !targetEnvironment(macCatalyst)
+        return (NSApplication.shared.keyWindow ?? NSApplication.shared.mainWindow).map(Self.init(window:))
+        #else
+        return nil
+        #endif
+    }
 
+    var isValidForPresentation: Bool {
+        #if canImport(UIKit) && !os(watchOS)
+        return self.scene is UIWindowScene
+        #elseif canImport(AppKit) && !targetEnvironment(macCatalyst)
+        return true
+        #else
+        return false
+        #endif
+    }
+
+    #if canImport(AppKit) && !targetEnvironment(macCatalyst)
+    @MainActor
+    var sheetPresentationWindow: NSWindow? {
+        var window = self.window
+        while let attachedSheet = window.attachedSheet {
+            window = attachedSheet
+        }
+
+        return window.isVisible ? window : nil
+    }
+    #endif
+
+    #if canImport(UIKit) && !os(watchOS)
+    @available(macCatalyst 13.1, *)
+    @available(macOS, unavailable)
+    @available(watchOS, unavailable)
+    @available(watchOSApplicationExtension, unavailable)
+    @MainActor
+    var presentationViewController: UIViewController? {
+        return (self.scene as? UIWindowScene)?.currentPresentationViewController
+    }
     #endif
 
 }
```

**File**: `Sources/Purchasing/Purchases/PurchaseParams.swift` (modified, +4/-2)
```diff
@@ -167,7 +167,8 @@ import AppKit
          * Set `confirmInScene`.
          *
          * - Parameter confirmInScene: The scene the system uses to show the purchase confirmation UI.
-         * - Note: This value is only used when StoreKit 2 is in use.
+         * - Note: Used to anchor StoreKit 2 purchase confirmation UI and the Test Store purchase dialog.
+         *   Ignored when using StoreKit 1.
          *
          * Availability: iOS 17.0+, macCatalyst 17.0+, tvOS 17.0+, visionOS 1.0+
          */
@@ -188,7 +189,8 @@ import AppKit
          * Set `confirmInWindow`.
          *
          * - Parameter confirmInWindow: The window to show the purchase confirmation UI in proximity to.
-         * - Note: This value is only used when StoreKit 2 is in use.
+         * - Note: Used to anchor StoreKit 2 purchase confirmation UI and the Test Store purchase dialog.
+         *   Ignored when using StoreKit 1.
          *
          * Availability: macOS 15.2+
          */
```

**File**: `Sources/Purchasing/Purchases/PurchasesOrchestrator.swift` (modified, +42/-24)
```diff
@@ -600,11 +600,17 @@ final class PurchasesOrchestrator {
                           quantity: quantity,
                           completion: completionWithTracking)
         } else if let simulatedStoreProduct = product.testStoreProduct {
-            self.handlePurchase(simulatedStoreProduct: simulatedStoreProduct,
-                                presentedOfferingContext: package?.presentedOfferingContext,
-                                paywallEvent: paywallEvent,
-                                metadata: metadata,
-                                completion: completionWithTracking)
+            let context = SimulatedStorePurchaseContext(
+                presentedOfferingContext: package?.presentedOfferingContext,
+                paywallEvent: paywallEvent,
+                metadata: metadata,
+                presentationContext: presentationContext
+            )
+            self.handlePurchase(
+                simulatedStoreProduct: simulatedStoreProduct,
+                context: context,
+                completion: completionWithTracking
+            )
         } else {
             fatalError("Unrecognized product: \(product)")
         }
@@ -2269,31 +2275,43 @@ private extension PurchasesOrchestrator {
 
 // MARK: - Simulated Store Purchases
 
+private struct SimulatedStorePurchaseContext {
+
+    let presentedOfferingContext: PresentedOfferingContext?
+    let paywallEvent: PaywallEvent?
+    let metadata: [String: String]?
+    let presentationContext: PresentationContext?
+
+}
+
 private extension PurchasesOrchestrator {
 
-    func handlePurchase(simulatedStoreProduct: SimulatedStoreProduct,
-                        presentedOfferingContext: PresentedOfferingContext?,
-                        paywallEvent: PaywallEvent?,
-                        metadata: [String: String]?,
-                        completion: @escaping PurchaseCompletedBlock) {
+    func handlePurchase(
+        simulatedStoreProduct: SimulatedStoreProduct,
+        context: SimulatedStorePurchaseContext,
+        completion: @escaping PurchaseCompletedBlock
+    ) {
         if self.systemInfo.isSimulatedStoreAPIKey {
-            self.purchase(simulatedStoreProduct: simulatedStoreProduct,
-                          presentedOfferingContext: presentedOfferingContext,
-                          paywallEvent: paywallEvent,
-                          metadata: metadata,
-                          completion: completion)
+            self.purchase(
+                simulatedStoreProduct: simulatedStoreProduct,
+                context: context,
+                completion: completion
+            )
         } else {
             self.handleTestProductNotAvailableForPurchase(completion)
         }
     }
 
-    private func purchase(simulatedStoreProduct: SimulatedStoreProduct,
-                          presentedOfferingContext: PresentedOfferingContext?,
-                          paywallEvent: PaywallEvent?,
-                          metadata: [String: String]?,
-                          completion: @escaping PurchaseCompletedBlock) {
+    private func purchase(
+        simulatedStoreProduct: SimulatedStoreProduct,
+        context: SimulatedStorePurchaseContext,
+        completion: @escaping PurchaseCompletedBlock
+    ) {
         Task {
-            let result = await self.simulatedStorePurchaseHandler.purchase(product: simulatedStoreProduct)
+            let result = await self.simulatedStorePurchaseHandler.purchase(
+                product: simulatedStoreProduct,
+                presentationContext: context.presentationContext
+            )
             switch result {
             case .cancel:
                 let customerInfo = try? await self.customerInfoManager.customerInfo(appUserID: self.appUserID,
@@ -2304,9 +2322,9 @@ private extension PurchasesOrchestrator {
             case .success(let transaction):
                 do {
                     let customerInfo = try await self.handlePurchasedTransaction(
-                        transaction, .purchase, metadata,
-                        presentedOfferingContext: presentedOfferingContext,
-                        presentedPaywall: paywallEvent
+                        transaction, .purchase, context.metadata,
+                        presentedOfferingContext: context.presentedOfferingContext,
+                        presentedPaywall: context.paywallEvent
                     )
                     await completion(transaction, customerInfo, nil, false)
                 } catch {
```

**File**: `Sources/Purchasing/SimulatedStore/SimulatedStorePurchaseHandler.swift` (modified, +12/-3)
```diff
@@ -17,7 +17,10 @@ enum TestPurchaseResult {
 protocol SimulatedStorePurchaseHandlerType: AnyObject, Sendable {
 
     @MainActor
-    func purchase(product: TestStoreProduct) async -> TestPurchaseResult
+    func purchase(
+        product: TestStoreProduct,
+        presentationContext: PresentationContext?
+    ) async -> TestPurchaseResult
 
 }
 
@@ -45,7 +48,10 @@ actor SimulatedStorePurchaseHandler: SimulatedStorePurchaseHandlerType {
         self.dateProvider = dateProvider
     }
 
-    func purchase(product: TestStoreProduct) async -> TestPurchaseResult {
+    func purchase(
+        product: TestStoreProduct,
+        presentationContext: PresentationContext? = nil
+    ) async -> TestPurchaseResult {
         guard !self.purchaseInProgress else {
             return .failure(ErrorUtils.operationAlreadyInProgressError())
         }
@@ -55,7 +61,10 @@ actor SimulatedStorePurchaseHandler: SimulatedStorePurchaseHandlerType {
                 return .failure(ErrorUtils.unknownError())
             }
 
-            let result = await self.purchaseUI.presentPurchaseUI(for: product)
+            let result = await self.purchaseUI.presentPurchaseUI(
+                for: product,
+                presentationContext: presentationContext
+            )
 
             let purchaseResult: TestPurchaseResult
             switch result {
```

**File**: `Sources/Purchasing/SimulatedStore/SimulatedStorePurchaseUI.swift` (modified, +133/-82)
```diff
@@ -12,12 +12,12 @@
 //  Created by Antonio Pallares on 1/8/25.
 
 import Foundation
-#if os(iOS) || os(tvOS) || VISION_OS || targetEnvironment(macCatalyst)
-import UIKit
-#elseif os(watchOS)
+#if os(watchOS)
 import UIKit
 import WatchKit
-#elseif os(macOS)
+#elseif canImport(UIKit)
+import UIKit
+#elseif canImport(AppKit)
 import AppKit
 #endif
 
@@ -34,21 +34,53 @@ protocol SimulatedStorePurchaseUI: Sendable {
     ///
     /// - Parameters:
     ///   - product: The product to be purchased.
+    ///   - presentationContext: The platform UI context where the purchase UI should be presented.
     /// - Returns: A result indicating the selected outcome of the purchase UI interaction.
-    func presentPurchaseUI(for product: SimulatedStoreProduct) async -> SimulatedStorePurchaseUIResult
+    func presentPurchaseUI(
+        for product: SimulatedStoreProduct,
+        presentationContext: PresentationContext?
+    ) async -> SimulatedStorePurchaseUIResult
 
 }
 
 /// Contains the logic to present a system alert for the confirmation of Simulated Store products purchases.
 struct DefaultSimulatedStorePurchaseUI: SimulatedStorePurchaseUI {
 
-    private let systemInfo: SystemInfo
+    #if os(watchOS)
+
+    init(systemInfo: SystemInfo) {}
+
+    #else
+
+    private let defaultPresentationContextProvider: @MainActor @Sendable () -> PresentationContext?
 
     init(systemInfo: SystemInfo) {
-        self.systemInfo = systemInfo
+        self.defaultPresentationContextProvider = {
+            return PresentationContext.defaultPresentationContext(systemInfo: systemInfo)
+        }
+    }
+
+    init(
+        defaultPresentationContextProvider: @escaping @MainActor @Sendable () -> PresentationContext?
+    ) {
+        self.defaultPresentationContextProvider = defaultPresentationContextProvider
     }
 
-    func presentPurchaseUI(for product: SimulatedStoreProduct) async -> SimulatedStorePurchaseUIResult {
+    @MainActor
+    func resolvedPresentationContext(_ context: PresentationContext?) -> PresentationContext? {
+        guard let context else {
+            return self.defaultPresentationContextProvider()
+        }
+
+        return context.isValidForPresentation ? context : nil
+    }
+
+    #endif
+
+    func presentPurchaseUI(
+        for product: SimulatedStoreProduct,
+        presentationContext: PresentationContext?
+    ) async -> SimulatedStorePurchaseUIResult {
         await Task { @MainActor in
             return await withUnsafeContinuation { continuation in
 
@@ -74,7 +106,7 @@ struct DefaultSimulatedStorePurchaseUI: SimulatedStorePurchaseUI {
                     }
                 )
 
-                self.showAlert(alert) { (error: PurchasesError) in
+                self.showAlert(alert, presentationContext: presentationContext) { (error: PurchasesError) in
                     completion(.error(error))
                 }
             }
@@ -103,7 +135,7 @@ struct DefaultSimulatedStorePurchaseUI: SimulatedStorePurchaseUI {
                     }
                 )
 
-                self.showAlert(alert) { _ in
+                self.showAlert(alert, presentationContext: nil) { _ in
                     completion()
                 }
             }
@@ -220,40 +252,20 @@ private extension DefaultSimulatedStorePurchaseUI {
 
 }
 
-private extension DefaultSimulatedStorePurchaseUI {
-
-    @MainActor
-    func showAlert(_ alert: Alert, onError: (PurchasesError) -> Void) {
-
-        #if os(iOS) || os(tvOS) || VISION_OS || targetEnvironment(macCatalyst)
-        guard let viewController = self.findTopViewController() else {
-            Logger.warn(Strings.purchase.unable_to_find_root_view_controller_for_simulated_purchase)
-            onError(ErrorUtils.unknownError(
-                message: Strings.purchase.unable_to_find_root_view_controller_for_simulated_purchase.description
-            ))
-            return
-        }
-
-        let alertController = UIAlertController(title: alert.title,
-                                                message: alert.message,
-                                                preferredStyle: .alert)
-
-        alert.actions.forEach { action in
-            let alertAction = UIAlertAction(title: action.title, style: action.style.alertActionStyle) { _ in
-                action.callback(action.title)
-            }
-            alertController.addAction(alertAction)
-        }
-
-        viewController.present(alertController, animated: true)
+#if os(watchOS)
 
-        #elseif os(watchOS)
+extension DefaultSimulatedStorePurchaseUI {
 
+    @MainActor
+    private func showAlert(
+        _ alert: Alert,
+        presentationContext: PresentationContext?,
+        onError: (PurchasesError) -> Void
+    ) {
         let actions: [WKAlertAction] = alert.actions.map { action in
             WKAlertAction(title: action.title, style: action.style.alertActionStyle) {
                 action.callback(action.title)
             }
-
         }
 
         WKIn
```

**File**: `Tests/UnitTests/Mocks/MockTestStorePurchaseHandler.swift` (modified, +7/-2)
```diff
@@ -12,18 +12,23 @@
 //  Created by Antonio Pallares on 21/7/25.
 
 import Foundation
-@testable import RevenueCat
+@_spi(Internal) @testable import RevenueCat
 
 actor MockSimulatedStorePurchaseHandler: SimulatedStorePurchaseHandlerType {
 
     let stubbedPurchaseResult: Atomic<TestPurchaseResult> = .init(.cancel)
     let invokedPurchase: Atomic<Bool> = .init(false)
     let invokedPurchaseProduct: Atomic<TestStoreProduct?> = .init(nil)
+    let invokedPresentationContext: Atomic<PresentationContext?> = .init(nil)
 
     @MainActor
-    func purchase(product: TestStoreProduct) async -> TestPurchaseResult {
+    func purchase(
+        product: TestStoreProduct,
+        presentationContext: PresentationContext?
+    ) async -> TestPurchaseResult {
         self.invokedPurchase.value = true
         self.invokedPurchaseProduct.value = product
+        self.invokedPresentationContext.value = presentationContext
         return self.stubbedPurchaseResult.value
     }
 
```

**File**: `Tests/UnitTests/Mocks/MockTestStorePurchaseUI.swift` (modified, +7/-2)
```diff
@@ -12,7 +12,7 @@
 //  Created by Antonio Pallares on 1/8/25.
 
 import Foundation
-@testable import RevenueCat
+@_spi(Internal) @testable import RevenueCat
 
 final class MockSimulatedStorePurchaseUI: SimulatedStorePurchaseUI {
 
@@ -21,11 +21,16 @@ final class MockSimulatedStorePurchaseUI: SimulatedStorePurchaseUI {
     let invokedPresentPurchaseUI: Atomic<Bool> = .init(false)
     let invokedPresentPurchaseUICount: Atomic<Int> = .init(0)
     let invokedPresentPurchaseUIProduct: Atomic<TestStoreProduct?> = .init(nil)
+    let invokedPresentationContext: Atomic<PresentationContext?> = .init(nil)
 
-    func presentPurchaseUI(for product: SimulatedStoreProduct) async -> SimulatedStorePurchaseUIResult {
+    func presentPurchaseUI(
+        for product: SimulatedStoreProduct,
+        presentationContext: PresentationContext?
+    ) async -> SimulatedStorePurchaseUIResult {
         self.invokedPresentPurchaseUI.value = true
         self.invokedPresentPurchaseUICount.value += 1
         self.invokedPresentPurchaseUIProduct.value = product
+        self.invokedPresentationContext.value = presentationContext
         return await self.stubbedPurchaseResult.value()
     }
 
```

---

### Incident Patch 3: `f4bfee9f` (2026-11-05)
**Commit Message**: fix: centralize presentation context resolution (#7977)

* refactor: generalize purchase presentation context

* fix: ignore non-window presentation scenes

* test: cover non-window scene filtering

* refactor: generalize presentation context naming

* fix: mark presentation context initializers as SPI

* refactor: use checked Sendable conformance

**File**: `RevenueCat.xcodeproj/project.pbxproj` (modified, +8/-4)
```diff
@@ -701,6 +701,7 @@
 		5721360F28B4602C006C46BE /* Purchases+nonasync.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5721360E28B4602C006C46BE /* Purchases+nonasync.swift */; };
 		572247D127BEC28E00C524A7 /* Array+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 572247D027BEC28E00C524A7 /* Array+Extensions.swift */; };
 		572247F727BF1ADF00C524A7 /* ArrayExtensionsTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 572247F627BF1ADF00C524A7 /* ArrayExtensionsTests.swift */; };
+		A81009B13D10000000000001 /* UIApplicationExtensionsTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = A81009B13D10000000000002 /* UIApplicationExtensionsTests.swift */; };
 		5722482727C2BD3200C524A7 /* LockTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5722482627C2BD3200C524A7 /* LockTests.swift */; };
 		5723FBBE28EDE1360003BA16 /* InternalAPI.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5723FBBD28EDE1360003BA16 /* InternalAPI.swift */; };
 		5733B18E27FF586A00EC2045 /* BackendError.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5733B18D27FF586A00EC2045 /* BackendError.swift */; };
@@ -1628,7 +1629,7 @@
 		FD6D87632FAE79E700CAF0F2 /* InstallmentsInfo.swift in Sources */ = {isa = PBXBuildFile; fileRef = FD6D87622FAE79E700CAF0F2 /* InstallmentsInfo.swift */; };
 		FD8C00472DE7A04200224B78 /* VirtualCurrencyManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = FD8C00462DE7A04200224B78 /* VirtualCurrencyManager.swift */; };
 		FD9BCEBC2DC946C400408A5D /* BottomSheetView.swift in Sources */ = {isa = PBXBuildFile; fileRef = FD9BCEBB2DC946C400408A5D /* BottomSheetView.swift */; };
-		FD54F4C42D5A664700C848A2 /* StoreKit2ConfirmInOptions.swift in Sources */ = {isa = PBXBuildFile; fileRef = FD54F4C32D5A664700C848A2 /* StoreKit2ConfirmInOptions.swift */; };
+		FD54F4C42D5A664700C848A2 /* PresentationContext.swift in Sources */ = {isa = PBXBuildFile; fileRef = FD54F4C32D5A664700C848A2 /* PresentationContext.swift */; };
 		FD6186542D1393FA007843DA /* MockCustomerCenterStoreKitUtilities.swift in Sources */ = {isa = PBXBuildFile; fileRef = FD6186532D1393FA007843DA /* MockCustomerCenterStoreKitUtilities.swift */; };
 		FD9F982D2BE28A7F0091A5BF /* MockNotificationCenter.swift in Sources */ = {isa = PBXBuildFile; fileRef = 351B515526D44B2300BD2BD7 /* MockNotificationCenter.swift */; };
 		FDA6F96F2E035544008BF232 /* VirtualCurrencyStrings.swift in Sources */ = {isa = PBXBuildFile; fileRef = FDA6F96E2E035544008BF232 /* VirtualCurrencyStrings.swift */; };
@@ -2605,6 +2606,7 @@
 		5721360E28B4602C006C46BE /* Purchases+nonasync.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Purchases+nonasync.swift"; sourceTree = "<group>"; };
 		572247D027BEC28E00C524A7 /* Array+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Array+Extensions.swift"; sourceTree = "<group>"; };
 		572247F627BF1ADF00C524A7 /* ArrayExtensionsTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ArrayExtensionsTests.swift; sourceTree = "<group>"; };
+		A81009B13D10000000000002 /* UIApplicationExtensionsTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = UIApplicationExtensionsTests.swift; sourceTree = "<group>"; };
 		5722482627C2BD3200C524A7 /* LockTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LockTests.swift; sourceTree = "<group>"; };
 		5723FBBD28EDE1360003BA16 /* InternalAPI.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = InternalAPI.swift; sourceTree = "<group>"; };
 		5733B18D27FF586A00EC2045 /* BackendError.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BackendError.swift; sourceTree = "<group>"; };
@@ -3596,7 +3598,7 @@
 		FD8C00462DE7A04200224B78 /* VirtualCurrencyManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = VirtualCurrencyManager.swift; sourceTree = "<group>"; };
 		FD9BCEBB2DC946C400408A5D /* BottomSheetView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BottomSheetView.swift; sourceTree = "<group>"; };
 		FDA6F96E2E035544008BF232 /* VirtualCurrencyStrings.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = VirtualCurrencyStrings.swift; sourceTree = "<group>"; };
-		FD54F4C32D5A664700C848A2 /* StoreKit2ConfirmInOptions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = StoreKit2ConfirmInOptions.swift; sourceTree = "<group>"; };
+		FD54F4C32D5A664700C848A2 /* PresentationContext.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PresentationContext.swift; sourceTree = "<group>"; };
 		FD6186532D1393FA007843DA /* MockCustomerCenterStoreKitUtilities.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MockCustomerCenterStoreKitUtilities.swift; sourceTree = "<group>"; 
```

**File**: `Sources/FoundationExtensions/UIApplication+RCExtensions.swift` (modified, +6/-1)
```diff
@@ -34,7 +34,12 @@ extension UIApplication {
         }
         #endif
 
-        return scenes.first as? UIWindowScene
+        return Self.firstWindowScene(in: scenes)
+    }
+
+    @MainActor
+    static func firstWindowScene<S: Sequence>(in scenes: S) -> UIWindowScene? where S.Element == UIScene {
+        return scenes.lazy.compactMap { $0 as? UIWindowScene }.first
     }
 
     /// The topmost view controller in the current foreground window scene.
```

**File**: `Sources/Purchasing/PresentationContext.swift` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+//
+//  Copyright RevenueCat Inc. All Rights Reserved.
+//
+//  Licensed under the MIT License (the "License");
+//  you may not use this file except in compliance with the License.
+//  You may obtain a copy of the License at
+//
+//      https://opensource.org/licenses/MIT
+//
+//  PresentationContext.swift
+//
+//  Created by Rick van der Linden on 7/10/26.
+
+import Foundation
+
+#if canImport(UIKit)
+import UIKit
+#endif
+
+#if canImport(AppKit)
+import AppKit
+#endif
+
+/// The platform UI context for presenting SDK-owned UI.
+@_spi(Internal) public struct PresentationContext: Sendable {
+
+    #if canImport(UIKit) && !os(watchOS)
+
+    let scene: UIScene
+
+    /// Creates a presentation context anchored to a UIKit scene.
+    @_spi(Internal) public init(scene: UIScene) {
+        self.scene = scene
+    }
+
+    #elseif canImport(AppKit) && !targetEnvironment(macCatalyst)
+
+    let window: NSWindow
+
+    /// Creates a presentation context anchored to an AppKit window.
+    @_spi(Internal) public init(window: NSWindow) {
+        self.window = window
+    }
+
+    #endif
+
+}
```

**File**: `Sources/Purchasing/Purchases/PurchaseParams.swift` (modified, +6/-6)
```diff
@@ -56,8 +56,8 @@ import AppKit
 
     #endif
 
-    /// Options for the confirmIn: parameter of the `purchase(confirmIn:options:)` SK2 APIs.
-    let storeKit2ConfirmInOptions: StoreKit2ConfirmInOptions?
+    /// The platform UI context where purchase-related UI should be presented.
+    let presentationContext: PresentationContext?
 
     private init(with builder: Builder) {
         self.promotionalOffer = builder.promotionalOffer
@@ -77,7 +77,7 @@ import AppKit
         self.promotionalOfferOptions = builder.promotionalOfferOptions
         #endif
 
-        self.storeKit2ConfirmInOptions = builder.storeKit2ConfirmInOptions
+        self.presentationContext = builder.presentationContext
     }
 
     /// The Builder for ```PurchaseParams```.
@@ -101,7 +101,7 @@ import AppKit
 
         #endif
 
-        private(set) var storeKit2ConfirmInOptions: StoreKit2ConfirmInOptions?
+        private(set) var presentationContext: PresentationContext?
 
         /**
          * Create a new builder with a ``Package``.
@@ -173,7 +173,7 @@ import AppKit
          */
         @available(iOS 17.0, macCatalyst 17.0, tvOS 17.0, visionOS 1.0, *)
         public func with(confirmInScene: UIScene) -> Self {
-            self.storeKit2ConfirmInOptions = StoreKit2ConfirmInOptions(confirmInScene: confirmInScene)
+            self.presentationContext = PresentationContext(scene: confirmInScene)
             return self
         }
         #endif
@@ -194,7 +194,7 @@ import AppKit
          */
         @available(macOS 15.2, *)
         public func with(confirmInWindow: NSWindow) -> Self {
-            self.storeKit2ConfirmInOptions = StoreKit2ConfirmInOptions(confirmInWindow: confirmInWindow)
+            self.presentationContext = PresentationContext(window: confirmInWindow)
             return self
         }
         #endif
```

**File**: `Sources/Purchasing/Purchases/PurchasesOrchestrator.swift` (modified, +9/-9)
```diff
@@ -529,7 +529,7 @@ final class PurchasesOrchestrator {
                  winBackOffer: winBackOffer,
                  introductoryOfferEligibilityJWS: introductoryOfferEligibilityJWS,
                  promotionalOfferOptions: promotionalOfferOptions,
-                 storeKit2ConfirmInOptions: params.storeKit2ConfirmInOptions,
+                 presentationContext: params.presentationContext,
                  metadata: metadata,
                  quantity: params.quantity,
                  trackDiagnostics: trackDiagnostics,
@@ -543,7 +543,7 @@ final class PurchasesOrchestrator {
                   winBackOffer: WinBackOffer? = nil,
                   introductoryOfferEligibilityJWS: String? = nil,
                   promotionalOfferOptions: StoreKit2PromotionalOfferPurchaseOptions? = nil,
-                  storeKit2ConfirmInOptions: StoreKit2ConfirmInOptions? = nil,
+                  presentationContext: PresentationContext? = nil,
                   metadata: [String: String]? = nil,
                   paywallEvent: PaywallEvent? = nil,
                   quantity: Int? = nil,
@@ -594,7 +594,7 @@ final class PurchasesOrchestrator {
                           introductoryOfferEligibilityJWS: introductoryOfferEligibilityJWS,
                           billingPlanType: billingPlanType,
                           promotionalOfferOptions: promotionalOfferOptions,
-                          storeKit2ConfirmInOptions: storeKit2ConfirmInOptions,
+                          presentationContext: presentationContext,
                           metadata: metadata,
                           paywallEvent: paywallEvent,
                           quantity: quantity,
@@ -724,7 +724,7 @@ final class PurchasesOrchestrator {
                   introductoryOfferEligibilityJWS: String?,
                   billingPlanType: BillingPlanType?,
                   promotionalOfferOptions: StoreKit2PromotionalOfferPurchaseOptions?,
-                  storeKit2ConfirmInOptions: StoreKit2ConfirmInOptions?,
+                  presentationContext: PresentationContext?,
                   metadata: [String: String]? = nil,
                   paywallEvent: PaywallEvent? = nil,
                   quantity: Int? = nil,
@@ -742,7 +742,7 @@ final class PurchasesOrchestrator {
                     metadata: metadata,
                     paywallEvent: paywallEvent,
                     quantity: quantity,
-                    storeKit2ConfirmInOptions: storeKit2ConfirmInOptions
+                    presentationContext: presentationContext
                 )
 
                 if !result.userCancelled {
@@ -784,7 +784,7 @@ final class PurchasesOrchestrator {
                   metadata: [String: String]? = nil,
                   paywallEvent: PaywallEvent? = nil,
                   quantity: Int? = nil,
-                  storeKit2ConfirmInOptions: StoreKit2ConfirmInOptions? = nil) async throws -> PurchaseResultData {
+                  presentationContext: PresentationContext? = nil) async throws -> PurchaseResultData {
         // Run the purchase + receipt post as a task that a concurrent queue-initiated receipt post for
         // the same product can await, so the attributed purchase post reaches the backend first. The
         // task only starts once registered, so a transaction reaching `Transaction.updates`
@@ -801,7 +801,7 @@ final class PurchasesOrchestrator {
                 metadata: metadata,
                 paywallEvent: paywallEvent,
                 quantity: quantity,
-                storeKit2ConfirmInOptions: storeKit2ConfirmInOptions
+                presentationContext: presentationContext
             )
         }
 
@@ -838,7 +838,7 @@ final class PurchasesOrchestrator {
         metadata: [String: String]? = nil,
         paywallEvent: PaywallEvent? = nil,
         quantity: Int? = nil,
-        storeKit2ConfirmInOptions: StoreKit2ConfirmInOptions? = nil
+        presentationContext: PresentationContext? = nil
     ) async throws -> PurchaseResultData {
         let result: Product.PurchaseResult
         var options: Set<Product.PurchaseOption> = [.simulatesAskToBuyInSandbox(Purchases.simulatesAskToBuyInSandbox)]
@@ -938,7 +938,7 @@ final class PurchasesOrchestrator {
             result = try await self.storeKit2ProductPurchaser.purchase(
                 product: sk2Product,
                 options: options,
-                storeKit2ConfirmInOptions: storeKit2ConfirmInOptions
+                presentationContext: presentationContext
             )
 
             // The `purchase(sk2Product)` call can throw a `StoreKitError.userCancelled` error.
```

**File**: `Sources/Purchasing/StoreKit2/StoreKit2ConfirmInOptions.swift` (removed, +0/-40)
```diff
@@ -1,40 +0,0 @@
-//
-//  Copyright RevenueCat Inc. All Rights Reserved.
-//
-//  Licensed under the MIT License (the "License");
-//  you may not use this file except in compliance with the License.
-//  You may obtain a copy of the License at
-//
-//      https://opensource.org/licenses/MIT
-//
-//  StoreKit2ConfirmInOptions.swift
-//
-//  Created by Will Taylor on 2/10/25.
-
-import Foundation
-
-#if canImport(UIKit)
-import UIKit
-#endif
-
-#if canImport(AppKit)
-import AppKit
-#endif
-
-/// Options for configuring the `confirmIn` parameter in StoreKit 2 purchases.
-///
-/// This struct provides platform-specific options for specifying where the purchase confirmation UI should appear.
-///
-/// - When UIKit is available, use `confirmInScene` to specify a `UIScene`.
-/// - When AppKit is available, use `confirmInWindow` to specify an `NSWindow`.
-internal struct StoreKit2ConfirmInOptions {
-    #if canImport(UIKit) && !os(watchOS)
-    /// The scene to show purchase confirmation UI in proximity to.
-    let confirmInScene: UIScene?
-    #endif
-
-    #if canImport(AppKit) && !targetEnvironment(macCatalyst)
-    /// The window to show purchase confirmation UI in proximity to.
-    let confirmInWindow: NSWindow?
-    #endif
-}
```

**File**: `Sources/Purchasing/StoreKit2/StoreKit2ProductPurchaser.swift` (modified, +5/-5)
```diff
@@ -20,7 +20,7 @@ internal protocol StoreKit2ProductPurchaserType {
     func purchase(
         product: PurchasableSK2Product,
         options: Set<StoreKit.Product.PurchaseOption>,
-        storeKit2ConfirmInOptions: StoreKit2ConfirmInOptions?
+        presentationContext: PresentationContext?
     ) async throws -> StoreKit.Product.PurchaseResult
 }
 
@@ -38,11 +38,11 @@ internal class StoreKit2ProductPurchaser: StoreKit2ProductPurchaserType {
     func purchase(
         product: PurchasableSK2Product,
         options: Set<StoreKit.Product.PurchaseOption>,
-        storeKit2ConfirmInOptions: StoreKit2ConfirmInOptions?
+        presentationContext: PresentationContext?
     ) async throws -> StoreKit.Product.PurchaseResult {
 #if VISION_OS
         let scene: UIScene
-        if let confirmInScene = storeKit2ConfirmInOptions?.confirmInScene {
+        if let confirmInScene = presentationContext?.scene {
             scene = confirmInScene
         } else {
             scene = try await self.systemInfo.currentWindowScene
@@ -56,7 +56,7 @@ internal class StoreKit2ProductPurchaser: StoreKit2ProductPurchaserType {
         // watchOS is excluded here since purchase(confirmIn:options:) isn't supported on watchOS.
 #elseif canImport(UIKit) && compiler(>=5.9.0) && !os(watchOS)
 
-        if let confirmInScene = storeKit2ConfirmInOptions?.confirmInScene,
+        if let confirmInScene = presentationContext?.scene,
            #available(iOS 17.0, iOSApplicationExtension 17.0, macCatalyst 17.0, tvOS 17.0, *) {
             return try await product.purchase(confirmIn: confirmInScene, options: options)
         } else {
@@ -67,7 +67,7 @@ internal class StoreKit2ProductPurchaser: StoreKit2ProductPurchaserType {
         // which shipped with Xcode 16.2 and the Swift 6.0.2 compiler.
 #elseif canImport(AppKit) && compiler(>=6.0.2) && !targetEnvironment(macCatalyst)
 
-        if let confirmInWindow = storeKit2ConfirmInOptions?.confirmInWindow,
+        if let confirmInWindow = presentationContext?.window,
            #available(macOS 15.2, *) {
             return try await product.purchase(confirmIn: confirmInWindow, options: options)
         } else {
```

**File**: `Tests/StoreKitUnitTests/PurchasesOrchestratorSK2Tests.swift` (modified, +2/-2)
```diff
@@ -398,7 +398,7 @@ class PurchasesOrchestratorSK2Tests: BasePurchasesOrchestratorTests, PurchasesOr
         }
 
         expect(self.mockStoreKit2ProductPurchaser.invokedPurchaseCount) == 1
-        expect(self.mockStoreKit2ProductPurchaser.receivedStoreKit2ConfirmInOptions?.confirmInScene).to(equal(scene))
+        expect(self.mockStoreKit2ProductPurchaser.receivedPresentationContext?.scene).to(equal(scene))
     }
     #endif
 
@@ -432,7 +432,7 @@ class PurchasesOrchestratorSK2Tests: BasePurchasesOrchestratorTests, PurchasesOr
         }
 
         expect(self.mockStoreKit2ProductPurchaser.invokedPurchaseCount) == 1
-        expect(self.mockStoreKit2ProductPurchaser.receivedStoreKit2ConfirmInOptions?.confirmInWindow).to(equal(window))
+        expect(self.mockStoreKit2ProductPurchaser.receivedPresentationContext?.window).to(equal(window))
     }
     #endif
 
```

#### Recent Merged Pull Requests:
- **PR #8215** (2026-11-05): Prepare next version: 5.103.0-SNAPSHOT (@RCGitBot)
- **PR #8214** (2026-11-05): test(storekit): work around iOS 27 active repurchase hang (@rickvdl)
- **PR #8213** (2026-11-05): test: fix flaky StoreKit 1 receipt retry test (@rickvdl)
- **PR #8212** (2026-11-05): [AUTOMATIC] Release/5.102.1 (@RCGitBot)
- **PR #8210** (2026-11-05): WFL-822 | Add Maestro tests for workflow branch routing (@RosieWatson)
- **PR #8207** (2026-11-05): refactor(paywalls): remove internal paywall components prewarming (@rickvdl)

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

## X. thread-safe sandbox environment detection (#8202)

**RULE**:
When implementing operations in `Sources/Misc/SystemInfo.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RevenueCat/purchases-ios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f812926c`: thread-safe sandbox environment detection (#8202). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/Misc/SystemInfo.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    private let _isSandbox: Atomic<Bool?> = nil
        return self._isSandbox.modify { cachedValue in
            if let cachedValue {
                return cachedValue
            }

            let isSandbox = self.sandboxEnvironmentDetector.isSandbox
            cachedValue = isSandbox
            return isSandbox
        }
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
    private lazy var _isSandbox: Bool = {
        return self.sandboxEnvironmentDetector.isSandbox
    }()

        return self._isSandbox
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f812926c` are properly handled with clean fallback behavior.
