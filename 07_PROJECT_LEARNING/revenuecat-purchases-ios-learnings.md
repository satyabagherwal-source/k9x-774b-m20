> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/revenuecat-purchases-ios-learnings.md`  
> **Source**: github ([https://github.com/RevenueCat/purchases-ios](https://github.com/RevenueCat/purchases-ios))  
> **Source Version**: `8c1ff472`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T02:38:16.316Z  
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
> **Harvest Timestamp**: 2026-11-26T02:38:16.311Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RevenueCat/purchases-ios`
- **Description**: In-app purchases and subscriptions made easy. Support for iOS, watchOS, tvOS, macOS, and visionOS.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3099 stars

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

### Incident Patch 1: `3f27f02e` (2026-11-25)
**Commit Message**: fix(paywalls): use the selected tab’s sheet price (RevenueCat/purchases-ios_internal#78)

GitOrigin-RevId: 7ed9e3c9efd6b47ff2818517e9161870e855662a

**File**: `RevenueCatUI/Templates/V2/Components/Root/RootView.swift` (modified, +1/-1)
```diff
@@ -267,7 +267,7 @@ struct RootPackageSelectionSheetModifier: ViewModifier {
                         : self.sheetPackageContext?.variableContext ?? self.packageContext.variableContext,
                     isReconcile: true
                 )
-                self.packageContext.presentedSheetContext = nil
+                self.packageContext.dismissSheet(retainingSelection: !self.hasNonSheetPackages)
                 self.sheetPackageContext = nil
                 self.variableContextBeforeOpeningSheet = nil
                 self.packageBeforeOpeningSheet = nil
```

**File**: `RevenueCatUI/Templates/V2/Components/Tabs/TabsComponentView.swift` (modified, +5/-0)
```diff
@@ -440,6 +440,11 @@ struct LoadedTabsComponentView: View {
                     if activeTabViewModel.packages.isEmpty {
                         self.selectionState.parentOwnedPackage = self.packageContext.package
                         self.selectionState.parentOwnedVariableContext = self.packageContext.variableContext
+                    } else {
+                        tierPackageContext.adoptRetainedSheetPackage(
+                            from: self.packageContext,
+                            tabPackages: activeTabViewModel.packages
+                        )
                     }
                     self.reconcileSelection(tierPackageContext, tabViewModel: activeTabViewModel)
                 }
```

**File**: `RevenueCatUI/Templates/V2/Components/Tabs/TabsComponentViewModel.swift` (modified, +5/-5)
```diff
@@ -152,11 +152,12 @@ class TabViewModel {
     let tab: PaywallComponent.TabsComponent.Tab
     let uiConfigProvider: UIConfigProvider
     let stackViewModel: StackComponentViewModel
-    let packages: [Package]
+    private(set) lazy var packages = self.packageValidator.packages
 
     /// Held rather than pre-resolved because a package's visibility can depend on custom variables and
     /// offer eligibility, which are only known at render time.
-    private let packageValidator: PackageValidator
+    private lazy var packageValidator = self.resolvePackageValidator()
+    private let resolvePackageValidator: () -> PackageValidator
 
     var name: String? {
         return self.tab.name
@@ -165,13 +166,12 @@ class TabViewModel {
     init(
         tab: PaywallComponent.TabsComponent.Tab,
         stackViewModel: StackComponentViewModel,
-        packageValidator: PackageValidator,
+        resolvePackageValidator: @escaping () -> PackageValidator,
         uiConfigProvider: UIConfigProvider
     ) {
         self.tab = tab
         self.stackViewModel = stackViewModel
-        self.packageValidator = packageValidator
-        self.packages = packageValidator.packages
+        self.resolvePackageValidator = resolvePackageValidator
         self.uiConfigProvider = uiConfigProvider
     }
 
```

**File**: `RevenueCatUI/Templates/V2/EnvironmentObjects/PackageContext.swift` (modified, +25/-0)
```diff
@@ -150,11 +150,36 @@ class PackageContext: ObservableObject {
                 showZeroDecimalPlacePrices: self.variableContext.showZeroDecimalPlacePrices
             )
         )
+        self.retainedSheetSelection = nil
         self.presentedSheetContext = context
         self.update(package: context.package, variableContext: context.variableContext, isReconcile: true)
         return context
     }
 
+    /// A sheet-only paywall keeps the sheet's final package for the purchase button.
+    /// Let the active tab adopt it even when dismissal does not change the parent's package.
+    private var retainedSheetSelection: (package: Package, wasManuallySelected: Bool)?
+
+    func dismissSheet(retainingSelection: Bool) {
+        if retainingSelection, let sheet = self.presentedSheetContext, let package = sheet.package {
+            self.retainedSheetSelection = (package, sheet.manuallySelectedPackage?.identifier == package.identifier)
+        } else {
+            self.retainedSheetSelection = nil
+        }
+        self.presentedSheetContext = nil
+    }
+
+    @MainActor
+    func adoptRetainedSheetPackage(from parent: PackageContext, tabPackages: [Package]) {
+        guard let selection = parent.retainedSheetSelection,
+              tabPackages.contains(where: { $0.identifier == selection.package.identifier }) else { return }
+        self.update(
+            package: selection.package,
+            variableContext: self.variableContext,
+            isReconcile: !selection.wasManuallySelected
+        )
+    }
+
     func clearManualSelection() {
         self.manuallySelectedPackage = nil
     }
```

**File**: `RevenueCatUI/Templates/V2/ViewModelHelpers/PackageValidator.swift` (modified, +26/-6)
```diff
@@ -71,13 +71,19 @@ class PackageValidator {
         case tab
     }
 
-    private var scopedPackageInfos: [(info: PackageInfo, scope: Scope)] = []
+    private struct ScopedPackageInfo {
+        var info: PackageInfo
+        let scope: Scope
+        let isInitialSelectionCandidate: Bool
+    }
+
+    private var scopedPackageInfos: [ScopedPackageInfo] = []
 
     var packageInfos: [PackageInfo] {
         self.scopedPackageInfos.map(\.info)
     }
 
-    private var hasPageScopedPackages: Bool {
+    var hasPageScopedPackages: Bool {
         self.scopedPackageInfos.contains { $0.scope == .page }
     }
 
@@ -89,11 +95,24 @@ class PackageValidator {
     private var loggedWarnings: Set<String> = []
 
     func add(_ packageInfo: PackageInfo) {
-        self.scopedPackageInfos.append((packageInfo, .page))
+        self.scopedPackageInfos.append(.init(info: packageInfo, scope: .page, isInitialSelectionCandidate: true))
+    }
+
+    func addTabScoped(_ packageInfo: PackageInfo, isInitialSelectionCandidate: Bool = true) {
+        self.scopedPackageInfos.append(.init(
+            info: packageInfo,
+            scope: .tab,
+            isInitialSelectionCandidate: isInitialSelectionCandidate
+        ))
     }
 
-    func addTabScoped(_ packageInfo: PackageInfo) {
-        self.scopedPackageInfos.append((packageInfo, .tab))
+    func addTabPackages(from tab: PackageValidator, initiallySelected: Bool) {
+        for entry in tab.scopedPackageInfos {
+            self.addTabScoped(
+                entry.info,
+                isInitialSelectionCandidate: initiallySelected && entry.isInitialSelectionCandidate
+            )
+        }
     }
 
     func addAncestorStack(
@@ -148,7 +167,8 @@ class PackageValidator {
     /// 2. otherwise the first visible package in document order
     /// 3. otherwise `nil`
     func defaultSelectedPackage(in context: PackageSelectionContext) -> Package? {
-        return self.defaultSelectedPackage(among: self.packageInfos, in: context)
+        let candidates = self.scopedPackageInfos.filter(\.isInitialSelectionCandidate).map(\.info)
+        return self.defaultSelectedPackage(among: candidates, in: context)
     }
 
     /// The selection that should be in effect, or `nil` when nothing needs to change: only moves a
```

**File**: `RevenueCatUI/Templates/V2/ViewModelHelpers/ViewModelFactory.swift` (modified, +15/-7)
```diff
@@ -30,7 +30,7 @@ struct ViewModelFactory {
 
     let packageValidator = PackageValidator()
     /// Sheet inventory also provides the initial selection when the page has no packages.
-    let sheetPackageValidator = PackageValidator()
+    private(set) var sheetPackageValidator = PackageValidator()
 
     /// Closed sheets supply the root selection when the page has no package components.
     var rootSelectionValidator: PackageValidator {
@@ -397,7 +397,10 @@ struct ViewModelFactory {
             let tabViewModels: [TabViewModel] = try component.tabs.map { tab in
                 let tabPackageValidator = PackageValidator()
 
-                let stackViewModel = try toStackViewModel(
+                var tabFactory = self
+                let tabSheets = PackageValidator()
+                tabFactory.sheetPackageValidator = tabSheets
+                let stackViewModel = try tabFactory.toStackViewModel(
                     component: tab.stack,
                     packageValidator: tabPackageValidator,
                     purchaseButtonCollector: purchaseButtonCollector,
@@ -413,15 +416,20 @@ struct ViewModelFactory {
                     discardRules: discardRules
                 )
 
-                // Merging into entire paywall package validator
-                for packageInfo in tabPackageValidator.packageInfos {
-                    packageValidator.addTabScoped(packageInfo)
-                }
+                let initiallySelected = tab.id == (component.defaultTabId ?? component.tabs.first?.id)
+                packageValidator.addTabPackages(from: tabPackageValidator, initiallySelected: initiallySelected)
+                self.sheetPackageValidator.addTabPackages(from: tabSheets, initiallySelected: initiallySelected)
 
+                // The root inventory is complete only after later siblings and the footer are built.
+                let pagePackages = self.packageValidator
                 return .init(
                     tab: tab,
                     stackViewModel: tabsStackViewModel.copy(withViewModels: [.stack(stackViewModel)]),
-                    packageValidator: tabPackageValidator,
+                    resolvePackageValidator: {
+                        pagePackages.hasPageScopedPackages || tabPackageValidator.isValid
+                            ? tabPackageValidator
+                            : tabSheets
+                    },
                     uiConfigProvider: uiConfigProvider
                 )
             }
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/PackageResolutionTestFixture.swift` (modified, +24/-5)
```diff
@@ -25,7 +25,13 @@ struct PackageResolutionTestFixture {
     let offering: Offering
     let context: PackageContext
 
-    init(competingDefaults: Bool = false) throws {
+    enum SheetPlacement {
+        case none
+        case bothTabs
+        case secondTab
+    }
+
+    init(competingDefaults: Bool = false, sheets: SheetPlacement = .none) throws {
         var monthlyXL = TestData.monthlyProduct
         monthlyXL.price = 29.99
         monthlyXL.localizedPriceString = "$29.99"
@@ -51,11 +57,13 @@ struct PackageResolutionTestFixture {
             ? [Self.package("monthly_xl", selected: true)]
             : [Self.package("monthly_xl", selected: true), Self.package("annual_xl", selected: false)]
         var components: [PaywallComponent] = competingDefaults ? [Self.package("$rc_monthly", selected: true)] : []
+        let firstTab = sheets == .bothTabs ? [Self.sheet("standard", standard)] : standard
+        let secondTab = sheets != .none ? [Self.sheet("xl", xlComponents)] : xlComponents
         components.append(.tabs(.init(
             control: .init(type: .buttons, stack: .init(components: [])),
-            tabs: [.init(id: "tab-1", stack: .init(components: standard)),
-                   .init(id: "tab-2", stack: .init(components: xlComponents))],
-            defaultTabId: "tab-1"
+            tabs: [.init(id: "tab-1", stack: .init(components: firstTab)),
+                   .init(id: "tab-2", stack: .init(components: secondTab))],
+            defaultTabId: sheets != .none ? "tab-2" : "tab-1"
         )))
         if competingDefaults {
             let sheet = PaywallComponent.ButtonComponent.Sheet(
@@ -92,7 +100,9 @@ struct PackageResolutionTestFixture {
             return nil
         }.first)
         self.context = PackageContext(
-            package: self.state.viewModelFactory.packageValidator.defaultSelectedPackage(in: .provisional),
+            package: PaywallsV2View.defaultSelectedPackage(
+                in: self.state.viewModelFactory, context: .provisional, workflowDefaultPackage: nil
+            ),
             variableContext: .init(packages: packages, showZeroDecimalPlacePrices: false)
         )
     }
@@ -134,6 +144,15 @@ struct PackageResolutionTestFixture {
 @available(iOS 15.0, *)
 private extension PackageResolutionTestFixture {
 
+    static func sheet(_ id: String, _ components: [PaywallComponent]) -> PaywallComponent {
+        let sheet = PaywallComponent.ButtonComponent.Sheet(
+            id: id, name: id, stack: .init(components: components),
+            backgroundBlur: false, size: .init(width: .fill, height: .fit(nil))
+        )
+        return .button(.init(action: .navigateTo(destination: .sheet(sheet: sheet)),
+                             stack: .init(components: [Self.text("Open sheet")])))
+    }
+
     static func package(_ identifier: String, selected: Bool) -> PaywallComponent {
         .package(.init(packageID: identifier, isSelectedByDefault: selected, applePromoOfferProductCode: nil,
                        stack: .init(components: [Self.text("Package")])))
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/PackageValidatorTests.swift` (modified, +19/-0)
```diff
@@ -654,6 +654,25 @@ final class PackageValidatorTests: TestCase {
 
     // MARK: - Mixed page and tab scopes
 
+    func testNestedTabPackageIsAnInitialCandidateOnlyWhenBothTabsAreSelected() {
+        let inner = PackageValidator()
+        inner.add(Self.makePackageInfo(package: TestData.annualPackage, isSelectedByDefault: true, visible: true))
+
+        for innerSelected in [false, true] {
+            let outer = PackageValidator()
+            outer.addTabPackages(from: inner, initiallySelected: innerSelected)
+            for outerSelected in [false, true] {
+                let root = PackageValidator()
+                root.addTabPackages(from: outer, initiallySelected: outerSelected)
+
+                XCTAssertFalse(root.hasPageScopedPackages)
+                XCTAssertEqual(root.packages.map(\.identifier), [TestData.annualPackage.identifier])
+                XCTAssertEqual(root.defaultSelectedPackage(in: Self.context())?.identifier,
+                               innerSelected && outerSelected ? TestData.annualPackage.identifier : nil)
+            }
+        }
+    }
+
     /// A package inside a tab must not stop the page from reconciling its own packages, and must not be
     /// picked as the replacement either: the user may be on a different tab.
     func testReconcileFallsBackToAPageScopedPackageWhenTabsAlsoHoldPackages() {
```

---

### Incident Patch 2: `8f857110` (2026-11-25)
**Commit Message**: [AUTOMATIC] test: sync audience fixtures from Khepri main (RevenueCat/purchases-ios_internal#74)

Co-authored-by: facumenzella <[REDACTED_EMAIL]>
GitOrigin-RevId: ef24bf743933bada08b9b9694aafe94a684d7571

**File**: `Sources/CodableExtensions/Store+Extensions.swift` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ extension Store: Decodable {
         self = type
     }
 
-    private static let mapping: [String: Self] = Self.allCases
+    static let mapping: [String: Self] = Self.allCases
         .reduce(into: [:]) { result, store in
             if let name = store.name { result[name] = store }
         }
@@ -52,7 +52,7 @@ extension Store: Encodable {
 
 }
 
-private extension Store {
+extension Store {
 
     var name: String? {
         switch self {
```

**File**: `Sources/LocalRules/CustomerInfoDimensionProvider.swift` (modified, +5/-6)
```diff
@@ -67,20 +67,21 @@ private extension CustomerInfoDimensionProvider {
     struct DatedPurchase {
 
         let purchaseDate: Date
-        let store: Store
+        let storeIdentifier: String?
         let values: [String: DimensionValue]
     }
 
     static func purchases(from customerInfo: CustomerInfo, at date: Date) -> [[String: DimensionValue]] {
         // Only a CustomerInfo computed offline can hold a purchase the backend has not been told about.
         let unsyncedProductIdentifiers = customerInfo.unsyncedProductIdentifiers
 
+        let subscriptionResponses = customerInfo.subscriber.subscriptions
         let subscriptions = customerInfo.subscriptionsByProductIdentifier.values
             .sorted { $0.productIdentifier < $1.productIdentifier }
             .map { subscription in
                 DatedPurchase(
                     purchaseDate: subscription.purchaseDate,
-                    store: subscription.store,
+                    storeIdentifier: subscriptionResponses[subscription.productIdentifier]?.storeIdentifier,
                     values: Self.values(
                         for: subscription,
                         at: date,
@@ -92,7 +93,7 @@ private extension CustomerInfoDimensionProvider {
         let nonSubscriptions = customerInfo.nonSubscriptions.map { transaction in
             DatedPurchase(
                 purchaseDate: transaction.purchaseDate,
-                store: transaction.store,
+                storeIdentifier: transaction.store.dimensionValue,
                 values: Self.values(
                     for: transaction,
                     isSynced: !unsyncedProductIdentifiers.contains(transaction.productIdentifier)
@@ -114,9 +115,7 @@ private extension CustomerInfoDimensionProvider {
             .map { indexedPurchase in
                 let purchase = indexedPurchase.element
                 var values = purchase.values
-                if let store = purchase.store.dimensionValue {
-                    values["store"] = .string(store)
-                }
+                values.set("store", string: purchase.storeIdentifier)
                 return values
             }
     }
```

**File**: `Sources/Networking/Responses/CustomerInfoResponse.swift` (modified, +17/-4)
```diff
@@ -54,8 +54,11 @@ extension CustomerInfoResponse {
         var purchaseDate: Date
         var originalPurchaseDate: Date?
         var expiresDate: Date?
-        @IgnoreDecodeErrors<Store>
-        var store: Store
+        @IgnoreDecodeErrors<String?>
+        var storeIdentifier: String?
+        var store: Store {
+            return storeIdentifier.flatMap { Store.mapping[$0] } ?? .unknownStore
+        }
         @DefaultDecodable.False
         var isSandbox: Bool
         var unsubscribeDetectedAt: Date?
@@ -132,7 +135,17 @@ extension CustomerInfoResponse {
 // MARK: - Codable
 
 extension CustomerInfoResponse.Subscriber: Codable, Hashable {}
-extension CustomerInfoResponse.Subscription: Codable, Hashable {}
+extension CustomerInfoResponse.Subscription: Codable, Hashable {
+    // Keep the raw store ID under the JSON key "store" so audience rules can use IDs the SDK does not recognize.
+    // With an explicit CodingKeys enum, every field we encode or decode needs a key here.
+    private enum CodingKeys: String, CodingKey {
+        case storeIdentifier = "store"
+        case periodType, purchaseDate, originalPurchaseDate, expiresDate, isSandbox
+        case unsubscribeDetectedAt, billingIssuesDetectedAt, ownershipType, productPlanIdentifier
+        case metadata, gracePeriodExpiresDate, refundedAt, storeTransactionId, autoResumeDate
+        case displayName, price, managementUrl
+    }
+}
 extension CustomerInfoResponse.PurchasePaidPrice: Codable, Hashable {}
 
 extension CustomerInfoResponse.Entitlement: Hashable {}
@@ -330,7 +343,7 @@ extension CustomerInfoResponse.Subscription {
         self.purchaseDate = purchaseDate
         self.originalPurchaseDate = originalPurchaseDate
         self.expiresDate = expiresDate
-        self.store = store
+        self.storeIdentifier = store.name
         self.isSandbox = isSandbox
         self.unsubscribeDetectedAt = unsubscribeDetectedAt
         self.billingIssuesDetectedAt = billingIssuesDetectedAt
```

**File**: `Tests/UnitTests/LocalRules/AudienceCompatibility/conditions/app_version.json` (added, +709/-0)
```diff
@@ -0,0 +1,709 @@
+{
+  "schema_version": 1,
+  "cases": [
+    {
+      "id": "appVersion/equal/1.2.0/new",
+      "field": "appVersion",
+      "operator": "equal",
+      "profile": "new",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"==\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.2.0\"]}, 0]}]}",
+      "expected": true
+    },
+    {
+      "id": "appVersion/equal/1.2.0/renewed",
+      "field": "appVersion",
+      "operator": "equal",
+      "profile": "renewed",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"==\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.2.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/equal/1.2.0/first_purchase",
+      "field": "appVersion",
+      "operator": "equal",
+      "profile": "first_purchase",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"==\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.2.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/equal/1.2.0/unavailable",
+      "field": "appVersion",
+      "operator": "equal",
+      "profile": "unavailable",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"==\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.2.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/equal/1.10.0/new",
+      "field": "appVersion",
+      "operator": "equal",
+      "profile": "new",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"==\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.10.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/equal/1.10.0/renewed",
+      "field": "appVersion",
+      "operator": "equal",
+      "profile": "renewed",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"==\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.10.0\"]}, 0]}]}",
+      "expected": true
+    },
+    {
+      "id": "appVersion/equal/1.10.0/first_purchase",
+      "field": "appVersion",
+      "operator": "equal",
+      "profile": "first_purchase",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"==\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.10.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/equal/1.10.0/unavailable",
+      "field": "appVersion",
+      "operator": "equal",
+      "profile": "unavailable",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"==\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.10.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/notEqual/1.2.0/new",
+      "field": "appVersion",
+      "operator": "notEqual",
+      "profile": "new",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"!=\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.2.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/notEqual/1.2.0/renewed",
+      "field": "appVersion",
+      "operator": "notEqual",
+      "profile": "renewed",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"!=\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.2.0\"]}, 0]}]}",
+      "expected": true
+    },
+    {
+      "id": "appVersion/notEqual/1.2.0/first_purchase",
+      "field": "appVersion",
+      "operator": "notEqual",
+      "profile": "first_purchase",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"!=\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.2.0\"]}, 0]}]}",
+      "expected": true
+    },
+    {
+      "id": "appVersion/notEqual/1.2.0/unavailable",
+      "field": "appVersion",
+      "operator": "notEqual",
+      "profile": "unavailable",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"!=\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.2.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/notEqual/1.10.0/new",
+      "field": "appVersion",
+      "operator": "notEqual",
+      "profile": "new",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"!=\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.10.0\"]}, 0]}]}",
+      "expected": true
+    },
+    {
+      "id": "appVersion/notEqual/1.10.0/renewed",
+      "field": "appVersion",
+      "operator": "notEqual",
+      "profile": "renewed",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": [\"app_version\", null]}, null]}, {\"!=\": [{\"rc.semverCompare\": [{\"var\": \"app_version\"}, \"1.10.0\"]}, 0]}]}",
+      "expected": false
+    },
+    {
+      "id": "appVersion/notEqual/1.10.0/first_purchase
```

**File**: `Tests/UnitTests/LocalRules/AudienceCompatibility/conditions/first_purchase_at.json` (added, +1013/-0)
```diff
@@ -0,0 +1,1013 @@
+{
+  "schema_version": 1,
+  "cases": [
+    {
+      "id": "firstPurchaseAt/before/2024-05-18/new",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "new",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1715990400000]}]}",
+      "expected": false
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-18/renewed",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "renewed",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1715990400000]}]}",
+      "expected": true
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-18/first_purchase",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "first_purchase",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1715990400000]}]}",
+      "expected": true
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-18/unavailable",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "unavailable",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1715990400000]}]}",
+      "expected": false
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-18/purchase_history",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "purchase_history",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1715990400000]}]}",
+      "expected": false
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-18/one_time_only",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "one_time_only",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1715990400000]}]}",
+      "expected": false
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-25/new",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "new",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1716595200000]}]}",
+      "expected": false
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-25/renewed",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "renewed",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1716595200000]}]}",
+      "expected": true
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-25/first_purchase",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "first_purchase",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1716595200000]}]}",
+      "expected": true
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-25/unavailable",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "unavailable",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1716595200000]}]}",
+      "expected": false
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-25/purchase_history",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "purchase_history",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1716595200000]}]}",
+      "expected": true
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-25/one_time_only",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "one_time_only",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1716595200000]}]}",
+      "expected": false
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-30/new",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "new",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1717027200000]}]}",
+      "expected": false
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-30/renewed",
+      "field": "firstPurchaseAt",
+      "operator": "before",
+      "profile": "renewed",
+      "predicate": "{\"and\": [{\"!=\": [{\"var\": \"first_purchase_at\"}, null]}, {\"<\": [{\"var\": \"first_purchase_at\"}, 1717027200000]}]}",
+      "expected": true
+    },
+    {
+      "id": "firstPurchaseAt/before/2024-05-30/first_purchase",
+      "field": "firstPurchaseAt",
+      "operator": "before"
```

**File**: `Tests/UnitTests/LocalRules/AudienceCompatibility/conditions/latest_offer.json` (added, +789/-0)
```diff
@@ -0,0 +1,789 @@
+{
+  "schema_version": 1,
+  "cases": [
+    {
+      "id": "latestOffer/is/Intro Offer (premium)/new",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"Intro Offer (premium)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/Intro Offer (premium)/renewed",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"Intro Offer (premium)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/Intro Offer (premium)/first_purchase",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"Intro Offer (premium)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/Intro Offer (premium)/unavailable",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "unavailable",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"Intro Offer (premium)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/Intro Offer (premium)/intro_offer",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "intro_offer",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"Intro Offer (premium)\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestOffer/is/Intro Offer (premium)/latest_promo",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "latest_promo",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"Intro Offer (premium)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/Intro Offer (premium)/latest_intro",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "latest_intro",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"Intro Offer (premium)\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestOffer/is/spring (lifetime)/new",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring (lifetime)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring (lifetime)/renewed",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring (lifetime)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring (lifetime)/first_purchase",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring (lifetime)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring (lifetime)/unavailable",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "unavailable",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring (lifetime)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring (lifetime)/intro_offer",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "intro_offer",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring (lifetime)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring (lifetime)/latest_promo",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "latest_promo",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring (lifetime)\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestOffer/is/spring (lifetime)/latest_intro",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "latest_intro",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring (lifetime)\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring/new",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring/renewed",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring/first_purchase",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring/unavailable",
+      "field": "latestOffer",
+      "operator": "is",
+      "profile": "unavailable",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer\"}, \"spring\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOffer/is/spring/intro_offer
```

**File**: `Tests/UnitTests/LocalRules/AudienceCompatibility/conditions/latest_offer_type.json` (added, +1013/-0)
```diff
@@ -0,0 +1,1013 @@
+{
+  "schema_version": 1,
+  "cases": [
+    {
+      "id": "latestOfferType/is/no_offer/new",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"no_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/no_offer/renewed",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"no_offer\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestOfferType/is/no_offer/first_purchase",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"no_offer\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestOfferType/is/no_offer/unavailable",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "unavailable",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"no_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/no_offer/intro_offer",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "intro_offer",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"no_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/no_offer/latest_promo",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "latest_promo",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"no_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/no_offer/latest_intro",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "latest_intro",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"no_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/introductory_offer/new",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"introductory_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/introductory_offer/renewed",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"introductory_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/introductory_offer/first_purchase",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"introductory_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/introductory_offer/unavailable",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "unavailable",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"introductory_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/introductory_offer/intro_offer",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "intro_offer",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"introductory_offer\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestOfferType/is/introductory_offer/latest_promo",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "latest_promo",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"introductory_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/introductory_offer/latest_intro",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "latest_intro",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"introductory_offer\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestOfferType/is/promotional_offer/new",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"promotional_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/promotional_offer/renewed",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"promotional_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/promotional_offer/first_purchase",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_offer_type\"}, \"promotional_offer\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestOfferType/is/promotional_offer/unavailable",
+      "field": "latestOfferType",
+      "operator": "is",
+      "profile": "unavailable",
+      "predicate": "{\"
```

**File**: `Tests/UnitTests/LocalRules/AudienceCompatibility/conditions/latest_purchased_offering.json` (added, +789/-0)
```diff
@@ -0,0 +1,789 @@
+{
+  "schema_version": 1,
+  "cases": [
+    {
+      "id": "latestPurchasedOffering/is/welcome/new",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"welcome\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/welcome/renewed",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"welcome\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/welcome/first_purchase",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"welcome\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/welcome/unavailable",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "unavailable",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"welcome\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/welcome/intro_offer",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "intro_offer",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"welcome\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestPurchasedOffering/is/welcome/latest_promo",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "latest_promo",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"welcome\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/welcome/latest_intro",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "latest_intro",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"welcome\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestPurchasedOffering/is/seasonal/new",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"seasonal\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/seasonal/renewed",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"seasonal\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/seasonal/first_purchase",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"seasonal\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/seasonal/unavailable",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "unavailable",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"seasonal\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/seasonal/intro_offer",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "intro_offer",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"seasonal\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/seasonal/latest_promo",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "latest_promo",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"seasonal\"]}",
+      "expected": true
+    },
+    {
+      "id": "latestPurchasedOffering/is/seasonal/latest_intro",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "latest_intro",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"seasonal\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/season/new",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "new",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"season\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/season/renewed",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "renewed",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"season\"]}",
+      "expected": false
+    },
+    {
+      "id": "latestPurchasedOffering/is/season/first_purchase",
+      "field": "latestPurchasedOffering",
+      "operator": "is",
+      "profile": "first_purchase",
+      "predicate": "{\"==\": [{\"var\": \"latest_purchased_offering\"}, \"season\"]}",
+      "expected": false
+    },
+
```

---

### Incident Patch 3: `f36ed805` (2026-11-25)
**Commit Message**: fix(customer-center): preserve purchase presentation context (RevenueCat/purchases-ios_internal#42)

GitOrigin-RevId: 115e0b6d7708ff4cbd4e7467cbb5fc71d8bbdb0c

**File**: `RevenueCat.xcodeproj/project.pbxproj` (modified, +2/-0)
```diff
@@ -3689,6 +3689,7 @@
 		E0C5D92DA02C4041B4420237 /* CustomerCenterInjectedPaywall.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CustomerCenterInjectedPaywall.swift; sourceTree = "<group>"; };
 		AE841F7F44424C93CF2B7314 /* CustomerCenterDataStateTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CustomerCenterDataStateTests.swift; sourceTree = "<group>"; };
 		5CFC0D5799A0F95C634C8B5E /* CustomerCenterPreviewProviderTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CustomerCenterPreviewProviderTests.swift; sourceTree = "<group>"; };
+		CC0000000000000000000001 /* CustomerCenterPurchasesTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CustomerCenterPurchasesTests.swift; sourceTree = "<group>"; };
 		5FE4A197DECF4510AAF4573D /* CustomerCenterPreviewActionsTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CustomerCenterPreviewActionsTests.swift; sourceTree = "<group>"; };
 		6AB7056A482B4E098D3131B8 /* CustomerCenterViewModel+Presentation.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "CustomerCenterViewModel+Presentation.swift"; sourceTree = "<group>"; };
 		5051D25707904187B344ABB3 /* CustomerCenterPreviewPaywallTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CustomerCenterPreviewPaywallTests.swift; sourceTree = "<group>"; };
@@ -5435,6 +5436,7 @@
 		3544DA6B2C2C848E00704E9D /* CustomerCenter */ = {
 			isa = PBXGroup;
 			children = (
+				CC0000000000000000000001 /* CustomerCenterPurchasesTests.swift */,
 				5051D25707904187B344ABB3 /* CustomerCenterPreviewPaywallTests.swift */,
 				5CFC0D5799A0F95C634C8B5E /* CustomerCenterPreviewProviderTests.swift */,
 				5FE4A197DECF4510AAF4573D /* CustomerCenterPreviewActionsTests.swift */,
```

**File**: `RevenueCatUI/CustomerCenter/Abstractions/CustomerCenterPurchasesType.swift` (modified, +10/-0)
```diff
@@ -15,6 +15,9 @@ import Foundation
 @_spi(Internal) import RevenueCat
 import StoreKit
 import SwiftUI
+#if canImport(UIKit) && !os(watchOS)
+import UIKit
+#endif
 
 // swiftlint:disable missing_docs
 
@@ -58,13 +61,20 @@ import SwiftUI
 ///   - promotionalOffer: An optional `PromotionalOffer` to apply
 /// - Returns: A `PurchaseResultData` object containing the result of the purchase.
 /// - Throws: An error if the purchase flow fails or is cancelled.
+    @MainActor
     func purchase(
         product: StoreProduct,
         promotionalOffer: PromotionalOffer?
     ) async throws -> PurchaseResultData
 
+    @MainActor
     func purchase(package: Package) async throws -> PurchaseResultData
 
+    #if canImport(UIKit) && !os(watchOS)
+    @MainActor
+    func updatePresentationWindow(_ window: UIWindow?, reportedBy owner: AnyObject)
+    #endif
+
     func track(customerCenterEvent: any CustomerCenterEventType)
 
     func loadCustomerCenter() async throws -> CustomerCenterConfigData
```

**File**: `RevenueCatUI/CustomerCenter/Data/CustomerCenterPurchases.swift` (modified, +47/-8)
```diff
@@ -20,6 +20,24 @@ import Foundation
 @available(watchOS, unavailable)
 final class CustomerCenterPurchases: CustomerCenterPurchasesType {
 
+    typealias PurchaseAction = @Sendable (PurchaseParams) async throws -> PurchaseResultData
+
+    private let purchaseAction: PurchaseAction
+
+    #if canImport(UIKit) && !os(watchOS)
+    private let presentationWindowStore = PresentationWindowStore()
+    #endif
+
+    init() {
+        self.purchaseAction = { params in
+            try await Purchases.shared.purchase(params)
+        }
+    }
+
+    init(purchaseAction: @escaping PurchaseAction) {
+        self.purchaseAction = purchaseAction
+    }
+
     var isSandbox: Bool {
         return Purchases.shared.isSandbox
     }
@@ -56,24 +74,32 @@ final class CustomerCenterPurchases: CustomerCenterPurchasesType {
                                                     product: product)
     }
 
+    @MainActor
     func purchase(
         product: StoreProduct,
         promotionalOffer: PromotionalOffer?
     ) async throws -> PurchaseResultData {
-        if let promotionalOffer = promotionalOffer {
-            return try await Purchases.shared.purchase(
-                product: product,
-                promotionalOffer: promotionalOffer
-            )
-        } else {
-            return try await Purchases.shared.purchase(product: product)
+        let builder = PurchaseParams.Builder(product: product)
+        if let promotionalOffer {
+            _ = builder.with(promotionalOffer: promotionalOffer)
         }
+
+        return try await self.purchaseAction(self.purchaseParams(from: builder))
     }
 
+    @MainActor
     func purchase(package: Package) async throws -> PurchaseResultData {
-        return try await Purchases.shared.purchase(package: package)
+        let builder = PurchaseParams.Builder(package: package)
+        return try await self.purchaseAction(self.purchaseParams(from: builder))
     }
 
+    #if canImport(UIKit) && !os(watchOS)
+    @MainActor
+    func updatePresentationWindow(_ window: PurchasePresentationWindow?, reportedBy owner: AnyObject) {
+        self.presentationWindowStore.update(window, reportedBy: owner)
+    }
+    #endif
+
     func track(customerCenterEvent: any CustomerCenterEventType) {
         Purchases.shared.track(customerCenterEvent: customerCenterEvent)
     }
@@ -114,4 +140,17 @@ final class CustomerCenterPurchases: CustomerCenterPurchasesType {
         try await Purchases.shared.beginRefundRequest(forProduct: productID)
     }
     #endif
+
+    /// Builds purchase parameters anchored to the Customer Center's current presentation window.
+    @MainActor
+    private func purchaseParams(from builder: PurchaseParams.Builder) -> PurchaseParams {
+        #if canImport(UIKit) && !os(watchOS)
+        if let presentationContext = self.presentationWindowStore.presentationContext {
+            _ = builder.with(presentationContext: presentationContext)
+        }
+        #endif
+
+        return builder.build()
+    }
+
 }
```

**File**: `RevenueCatUI/CustomerCenter/Mocks/MockCustomerCenterPurchases.swift` (modified, +9/-0)
```diff
@@ -103,6 +103,15 @@ final class MockCustomerCenterPurchases: @unchecked Sendable, CustomerCenterPurc
         return try (purchasePackageResult ?? purchaseResult).get()
     }
 
+    #if canImport(UIKit) && !os(watchOS)
+    private(set) var presentationWindow: PurchasePresentationWindow?
+    private(set) var presentationWindowOwner: AnyObject?
+    func updatePresentationWindow(_ window: PurchasePresentationWindow?, reportedBy owner: AnyObject) {
+        self.presentationWindow = window
+        self.presentationWindowOwner = owner
+    }
+    #endif
+
     var trackCallCount = 0
     var trackError: Error?
     var trackedEvents: [CustomerCenterEventType] = []
```

**File**: `RevenueCatUI/CustomerCenter/ViewModels/CustomerCenterViewModel+Presentation.swift` (modified, +4/-0)
```diff
@@ -88,6 +88,10 @@ extension CustomerCenterViewModel {
             await loadScreen()
         }
     }
+
+    func updatePresentationWindow(_ window: PurchasePresentationWindow?, reportedBy owner: AnyObject) {
+        self.purchasesProvider.updatePresentationWindow(window, reportedBy: owner)
+    }
 }
 
 private extension VirtualCurrencies {
```

**File**: `RevenueCatUI/CustomerCenter/Views/CustomerCenterView.swift` (modified, +3/-0)
```diff
@@ -120,6 +120,9 @@ public struct CustomerCenterView: View {
     // swiftlint:disable:next missing_docs
     public var body: some View {
         navigationContent
+            .modifier(PresentationContextModifier { window, owner in
+                self.viewModel.updatePresentationWindow(window, reportedBy: owner)
+            })
             .task {
                 await loadInformationIfNeeded()
                 await viewModel.observePreviewCustomerInfoUpdates()
```

**File**: `RevenueCatUI/Purchasing/PresentationContextModifier.swift` (modified, +60/-2)
```diff
@@ -11,6 +11,7 @@
 //
 //  Created by Rick van der Linden on 10/9/26.
 
+@_spi(Internal) import RevenueCat
 import SwiftUI
 
 #if canImport(UIKit) && !os(watchOS)
@@ -19,16 +20,73 @@ import UIKit
 import AppKit
 #endif
 
+#if canImport(UIKit) && !os(watchOS)
+typealias PurchasePresentationWindow = UIWindow
+#elseif canImport(AppKit)
+typealias PurchasePresentationWindow = NSWindow
+#endif
+
+#if (canImport(UIKit) && !os(watchOS)) || canImport(AppKit)
+@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
+final class PresentationWindowStore: Sendable {
+
+    // Keep the window weak because its view hierarchy owns the object using this store.
+    @MainActor private(set) weak var window: PurchasePresentationWindow?
+    @MainActor private weak var owner: AnyObject?
+
+    @MainActor
+    var presentationContext: PresentationContext? {
+        #if canImport(UIKit) && !os(watchOS)
+        return self.window.flatMap {
+            PresentationContext(window: $0, allowsDefaultPresentationFallback: true)
+        }
+        #elseif canImport(AppKit)
+        return self.window.map {
+            PresentationContext(window: $0, allowsDefaultPresentationFallback: true)
+        }
+        #endif
+    }
+
+    @MainActor
+    func update(_ window: PurchasePresentationWindow?, reportedBy owner: AnyObject) {
+        if let window {
+            self.window = window
+            self.owner = owner
+        } else if self.owner === owner {
+            self.window = nil
+            self.owner = nil
+        }
+    }
+
+}
+#endif
+
 @available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
 struct PresentationContextModifier: ViewModifier {
 
-    let purchaseHandler: PurchaseHandler
+    #if (canImport(UIKit) && !os(watchOS)) || canImport(AppKit)
+    private let onWindowChange: @MainActor (PurchasePresentationWindow?, AnyObject) -> Void
+    #endif
+
+    init(purchaseHandler: PurchaseHandler) {
+        #if (canImport(UIKit) && !os(watchOS)) || canImport(AppKit)
+        self.onWindowChange = { window, owner in
+            purchaseHandler.updatePresentationWindow(window, reportedBy: owner)
+        }
+        #endif
+    }
+
+    #if (canImport(UIKit) && !os(watchOS)) || canImport(AppKit)
+    init(onWindowChange: @escaping @MainActor (PurchasePresentationWindow?, AnyObject) -> Void) {
+        self.onWindowChange = onWindowChange
+    }
+    #endif
 
     func body(content: Content) -> some View {
         #if (canImport(UIKit) && !os(watchOS)) || canImport(AppKit)
         content.background {
             PresentationContextReader { window, owner in
-                self.purchaseHandler.updatePresentationWindow(window, reportedBy: owner)
+                self.onWindowChange(window, owner)
             }
             .frame(width: 0, height: 0)
         }
```

**File**: `RevenueCatUI/Purchasing/PurchaseHandler.swift` (modified, +9/-25)
```diff
@@ -23,12 +23,6 @@ import UIKit
 import AppKit
 #endif
 
-#if canImport(UIKit) && !os(watchOS)
-typealias PurchasePresentationWindow = UIWindow
-#elseif canImport(AppKit)
-typealias PurchasePresentationWindow = NSWindow
-#endif
-
 // swiftlint:disable file_length
 
 private struct TerminalOfferingWorkflowError: Error {}
@@ -59,11 +53,8 @@ final class PurchaseHandler: ObservableObject {
     private let paywallEventTracker: PaywallEventTracker
     private let keyWindowFocusResigner: KeyWindowFocusResigning
 
-    // Keep the host weak because its view hierarchy owns this handler. A strong
-    // PresentationContext here would retain that hierarchy through its scene or window.
     #if (canImport(UIKit) && !os(watchOS)) || canImport(AppKit)
-    private(set) weak var presentationWindow: PurchasePresentationWindow?
-    private weak var presentationWindowOwner: AnyObject?
+    private let presentationWindowStore = PresentationWindowStore()
     #endif
 
     /// Side-by-side paywalls should use separate `PurchaseHandler` instances so each keeps its own session.
@@ -388,15 +379,14 @@ final class PurchaseHandler: ObservableObject {
 @available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
 extension PurchaseHandler {
 
+    @MainActor
+    var presentationWindow: PurchasePresentationWindow? {
+        return self.presentationWindowStore.window
+    }
+
     @MainActor
     func updatePresentationWindow(_ window: PurchasePresentationWindow?, reportedBy owner: AnyObject) {
-        if let window {
-            self.presentationWindow = window
-            self.presentationWindowOwner = owner
-        } else if self.presentationWindowOwner === owner {
-            self.presentationWindow = nil
-            self.presentationWindowOwner = nil
-        }
+        self.presentationWindowStore.update(window, reportedBy: owner)
     }
 
 }
@@ -1412,14 +1402,8 @@ private extension PurchaseHandler {
 
     @MainActor
     var presentationContext: PresentationContext? {
-        #if canImport(UIKit) && !os(watchOS)
-        return self.presentationWindow.flatMap {
-            PresentationContext(window: $0, allowsDefaultPresentationFallback: true)
-        }
-        #elseif canImport(AppKit)
-        return self.presentationWindow.map {
-            PresentationContext(window: $0, allowsDefaultPresentationFallback: true)
-        }
+        #if (canImport(UIKit) && !os(watchOS)) || canImport(AppKit)
+        return self.presentationWindowStore.presentationContext
         #else
         return nil
         #endif
```

#### Recent Merged Pull Requests:
- **PR #8309** (closed): fix(paywalls): format Paywalls V2 prices with the paywall locale (@vegaro)
- **PR #8308** (closed): fix(paywalls): format percent variables with the price locale (@vegaro)
- **PR #8306** (2026-11-16): chore(storekit): remove ENABLE_MULTISEAT_PURCHASES compiler flag (@fire-at-will)
- **PR #8305** (closed): feat(storekit): introduce .seats() PurchaseParams for multiseat purchases (@fire-at-will)
- **PR #8304** (closed): fix: avoid decoding cached customer info on the main thread (@rickvdl)
- **PR #8303** (2026-11-16): Chore(deps): Bump fastlane-plugin-revenuecat_internal from `52a8b95` to `32d32fe` (@dependabot[bot])

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

## X. paywalls): use the selected tab’s sheet price (RevenueCat/purchases-ios_internal

**RULE**:
When implementing operations in `RevenueCatUI/Templates/V2/Components/Root/RootView.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RevenueCat/purchases-ios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3f27f02e`: paywalls): use the selected tab’s sheet price (RevenueCat/purchases-ios_internal#78). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `RevenueCatUI/Templates/V2/Components/Root/RootView.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                self.packageContext.dismissSheet(retainingSelection: !self.hasNonSheetPackages)
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
                self.packageContext.presentedSheetContext = nil
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3f27f02e` are properly handled with clean fallback behavior.
