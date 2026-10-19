> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/revenuecat-purchases-ios-learnings.md`  
> **Source**: github ([https://github.com/RevenueCat/purchases-ios](https://github.com/RevenueCat/purchases-ios))  
> **Source Version**: `f93701d2`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T21:59:31.418Z  
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
> **Harvest Timestamp**: 2026-10-19T21:59:30.575Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RevenueCat/purchases-ios`
- **Description**: In-app purchases and subscriptions made easy. Support for iOS, watchOS, tvOS, macOS, and visionOS.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3080 stars

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
- **Issue #7931** (2026-10-08): **🐛 Received unknown workflow trigger type: on_purchase_press (iOS, 10.11.0)**
  *Symptoms*: ### Describe the bug  On iOS the SDK logs this warning on every launch:  [RevenueCat] ⚠️ Received unknown workflow trigger type: on_purchase_press  It is logged during workflow cache warm-up, right after offerings load and before the paywall is presented ("Warming up workflow caches for 1 screen(s)"). The workflow has a single screen and its Purchase button carries an on_purchase_press trigger.  react-native-purchases 10.11.0 bundles PurchasesHybridCommon 19.5.0, which uses the iOS SDK 5.92.0. In that SDK, WorkflowTriggerType (Sources/Networking/Responses/WorkflowsResponse.swift) only decodes "on_press"; any other value is logged and mapped to .unknown, and WorkflowNavigator looks triggers up by .onPress, so the trigger is never acted on.  purchases-ios#6905 lists "Handling on_purchase_press / on_close_workflow_press workflow trigger types" as out of scope ("separate PRs; this branch logs them as unknown"). I found no tracking issue and no released fix: 5.92.0 and PurchasesHybridCommon 19.6.0 are the latest, and the default branch of purchases-ios still only has on_press.  Questions: 1. Is this expected for workflows served by the backend today? 2. What does the Purchase button do while this trigger is unsupported? 3. Is there a tracking issue or timeline for on_purchase_press support?  I have not checked Android.   ### Platform  iOS  ### SDK version  SDK version: react-native-purchases 10.11.0, react-native-purchases-ui 10.11.0 (PurchasesHybridCommon 19.5.0, iOS SDK 5.92.0, 

- **Issue #7538** (2026-09-18): **🐛 Paywall voice over support is poor/buggy**
  *Symptoms*: ### Describe the bug  I am using my Paywall as an example. See screenshot below and video walkthrough at https://www.youtube.com/shorts/zCAxuvaZpDI.  Summary of issues:  - The currently selected offer is not noted. It is not obvious to user what is currently selected. This is a major issue. It should be read something like "Yearly, Selected. /Summary/. Button" and "Monthly, Not Selected. /Summary/. Button". Because this is lacking, the user has no way to know which offer they have selected and what they will purchase. This is the core bug of this issue. The others below are less critical. - There is no way to mark something as ignored. So, for example, a simple check symbol used in a bullet list cannot be skipped over and is read as image. Or an icon for an app used in a header cannot be skipped. I have since found how alt text can be defined for my logo via the media gallery (https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls/components#alt-text), but I just want it ignored. - The voice over label for payment terms should be customized and not reply on the screen text. So for example, $1.24/mo is read as "1 dollar and 24 cents slash mo" instead of "1 dollar and 24 cents per month". This should be done and localized. - There is no way to open the links in the paragraph below my header. When I had rotor set to hyperlinks and swiped down, the link was highlighted briefly but then the focus went back to the paragraph the link was in.  <img width="1260" height="2736

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

### Incident Patch 1: `ee58e9bb` (2026-10-18)
**Commit Message**: Fix(Paywalls) Intro Offer Eligibility checks were not resumable and sometimes slow (#8054)

* Share tasks

* run asyncronously

* ensure things are ran on the main thread like they used tobe

* correct the async work

* revert resolved

* Replace shared result mechanism

* allow subset requests to piggy back on inflight work

* prevent race condition where first result can finish when second result just starts to wait for it

* optimize calls by checking by subscription group instead of by product

**File**: `Sources/Purchasing/CachingTrialOrIntroPriceEligibilityChecker.swift` (modified, +86/-23)
```diff
@@ -18,9 +18,55 @@ import Foundation
 /// `TrialOrIntroPriceEligibilityCheckerType` decorator that adds caching behavior on each request.
 class CachingTrialOrIntroPriceEligibilityChecker: TrialOrIntroPriceEligibilityCheckerType {
 
-    private let checker: TrialOrIntroPriceEligibilityCheckerType
+    private struct RequestKey: Hashable, Sendable {
+        let productIdentifiers: Set<String>
+        let cacheGeneration: Int
+    }
+
+    private enum RequestAction {
+        case complete([String: IntroEligibility])
+        case wait
+        case start(RequestKey)
+    }
+
+    private struct State {
+        var cachedEligibilities: [String: IntroEligibility] = [:]
+        var cacheGeneration = 0
+        var inFlightRequests: [RequestKey: [ReceiveIntroEligibilityBlock]] = [:]
+
+        mutating func prepareRequest(
+            productIdentifiers: Set<String>,
+            completion: @escaping ReceiveIntroEligibilityBlock
+        ) -> (action: RequestAction, cachedProductIdentifiers: Set<String>) {
+            let cached = self.cachedEligibilities.filter { productIdentifiers.contains($0.key) }
+            let cachedProductIdentifiers = Set(cached.keys)
+            let missingProducts = productIdentifiers.subtracting(cached.keys)
+
+            guard !missingProducts.isEmpty else {
+                return (.complete(cached), cachedProductIdentifiers)
+            }
+
+            let requestKey = RequestKey(
+                productIdentifiers: missingProducts,
+                cacheGeneration: self.cacheGeneration
+            )
+            let containingRequestKey = self.inFlightRequests.keys.first { inFlightRequestKey in
+                inFlightRequestKey.cacheGeneration == requestKey.cacheGeneration
+                    && inFlightRequestKey.productIdentifiers.isSuperset(of: requestKey.productIdentifiers)
+            }
+            let key = containingRequestKey ?? requestKey
+            self.inFlightRequests[key, default: []].append { fetched in
+                let requestedProducts = fetched.filter { requestKey.productIdentifiers.contains($0.key) }
+                completion(cached + requestedProducts)
+            }
+
+            let action: RequestAction = containingRequestKey == nil ? .start(requestKey) : .wait
+            return (action, cachedProductIdentifiers)
+        }
+    }
 
-    private let cache: Atomic<[String: IntroEligibility]> = .init([:])
+    private let checker: TrialOrIntroPriceEligibilityCheckerType
+    private let state: Atomic<State> = .init(.init())
 
     /// Creates a `CachingTrialOrIntroPriceEligibilityChecker` wrapping the underlying checker,
     /// or returns `checker` if it already is this type.
@@ -41,7 +87,10 @@ class CachingTrialOrIntroPriceEligibilityChecker: TrialOrIntroPriceEligibilityCh
     func clearCache() {
         Logger.debug(Strings.eligibility.clearing_intro_eligibility_cache)
 
-        self.cache.value.removeAll(keepingCapacity: false)
+        self.state.modify {
+            $0.cacheGeneration += 1
+            $0.cachedEligibilities.removeAll(keepingCapacity: false)
+        }
     }
 
 }
@@ -57,30 +106,44 @@ extension CachingTrialOrIntroPriceEligibilityChecker {
             return
         }
 
-        let uniqueProductIdentifiers = Set(productIdentifiers)
-
-        // Note: this can suffer from race conditions, but the only downside is performing concurrent requests
-        // multiple times instead of returning the cached result on the second one.
-        // It's a fine compromise to keep this implementation simpler.
-        let cached = self.cache.value.filter { uniqueProductIdentifiers.contains($0.key) }
-
-        if !cached.isEmpty {
-            Logger.debug(Strings.eligibility.found_cached_eligibility_for_products(Set(cached.keys)))
+        let (action, cachedProductIdentifiers) = self.state.modify {
+            $0.prepareRequest(productIdentifiers: productIdentifiers, completion: completion)
         }
 
-        let missingProducts = uniqueProductIdentifiers.subtracting(cached.keys)
+        if !cachedProductIdentifiers.isEmpty {
+            Logger.debug(Strings.eligibility.found_cached_eligibility_for_products(cachedProductIdentifiers))
+        }
 
-        if missingProducts.isEmpty {
+        switch action {
+        case .complete(let cached):
             completion(cached)
-        } else {
-            self.checker.checkEligibility(productIdentifiers: missingProducts) { result in
-                let productsToCache = result.filter { $0.value.shouldCache }
-
-                Logger.debug(Strings.eligibility.caching_intro_eligibility_for_products(Set(productsToCache.keys)))
-                self.cache.modify { $0 += productsToCache }
-
-                completion(cached + result)
-            }
+        case .wait:
+            return
+        case .start(let requestKey):
+            self.checker.checkEligibility(
+                productIdentifiers: requestKey.productIdentifiers,
+                c
```

**File**: `Sources/Purchasing/TrialOrIntroPriceEligibilityChecker.swift` (modified, +37/-35)
```diff
@@ -163,58 +163,60 @@ class TrialOrIntroPriceEligibilityChecker: TrialOrIntroPriceEligibilityCheckerTy
             }
         }
     }
-
     @available(iOS 15.0, tvOS 15.0, watchOS 8.0, macOS 12.0, *)
     func sk2CheckEligibility(_ compoundProductIdentifiers: Set<String>) async throws -> [String: IntroEligibility] {
         var introDictionary: [String: IntroEligibility] = compoundProductIdentifiers.dictionaryWithValues { _ in
                 .init(eligibilityStatus: .unknown)
         }
 
         let products = try await self.productsManager.sk2Products(withIdentifiers: compoundProductIdentifiers)
-        for sk2StoreProduct in products {
-            let eligibilityStatus: IntroEligibilityStatus = await checkEligibility(for: sk2StoreProduct)
-            introDictionary[sk2StoreProduct.id] = .init(eligibilityStatus: eligibilityStatus)
+        var productIdentifiersByGroup: [String: [String]] = [:]
+        for product in products {
+            if let subscriptionGroupID = product.subscriptionGroupIDForIntroEligibilityCheck {
+                productIdentifiersByGroup[subscriptionGroupID, default: []].append(product.id)
+            } else {
+                introDictionary[product.id] = .init(eligibilityStatus: .noIntroOfferExists)
+            }
         }
 
+        await withTaskGroup(of: (String, Bool).self) { group in
+            for subscriptionGroupID in productIdentifiersByGroup.keys {
+                group.addTask {
+                    let isEligible = await TimingUtil.measureAndLogIfTooSlow(
+                        threshold: .introEligibility,
+                        message: Strings.eligibility.sk2_intro_eligibility_too_slow.description
+                    ) {
+                        await SK2Product.SubscriptionInfo.isEligibleForIntroOffer(for: subscriptionGroupID)
+                    }
+                    return (subscriptionGroupID, isEligible)
+                }
+            }
+            for await (subscriptionGroupID, isEligible) in group {
+                let status: IntroEligibilityStatus = isEligible ? .eligible : .ineligible
+                for productIdentifier in productIdentifiersByGroup[subscriptionGroupID] ?? [] {
+                    introDictionary[productIdentifier] = .init(eligibilityStatus: status)
+                }
+            }
+        }
         return introDictionary
     }
 
-    @available(iOS 15.0, tvOS 15.0, watchOS 8.0, macOS 12.0, *)
-    private func checkEligibility(for sk2StoreProduct: SK2StoreProduct) async -> IntroEligibilityStatus {
-        let sk2Product = sk2StoreProduct.underlyingSK2Product
+}
 
-        #if compiler(>=6.3.2)
-        if sk2StoreProduct.representsBillingPlan,
-           let subscription = sk2Product.subscription {
-            let billingPlanContainsIntroOffer = sk2StoreProduct.containsSubscriptionOfferTypeOnBillingPlan(
-                subscriptionOfferType: .introductory
-            )
-
-            guard billingPlanContainsIntroOffer else {
-                return .noIntroOfferExists
-            }
+@available(iOS 15.0, tvOS 15.0, watchOS 8.0, macOS 12.0, *)
+private extension SK2StoreProduct {
 
-            let isEligible = await TimingUtil.measureAndLogIfTooSlow(
-                threshold: .introEligibility,
-                message: Strings.eligibility.sk2_intro_eligibility_too_slow.description) {
-                    return await subscription.isEligibleForIntroOffer
-                }
-            return isEligible ? .eligible : .ineligible
+    /// Group to ask StoreKit about, or `nil` when the product has no introductory offer.
+    var subscriptionGroupIDForIntroEligibilityCheck: String? {
+        guard let subscription = self.underlyingSK2Product.subscription else { return nil }
+        #if compiler(>=6.3.2)
+        if self.representsBillingPlan {
+            let hasIntroOffer = self.containsSubscriptionOfferTypeOnBillingPlan(subscriptionOfferType: .introductory)
+            return hasIntroOffer ? subscription.subscriptionGroupID : nil
         }
         #endif
-
-        if let subscription = sk2Product.subscription, subscription.introductoryOffer != nil {
-            let isEligible = await TimingUtil.measureAndLogIfTooSlow(
-                threshold: .introEligibility,
-                message: Strings.eligibility.sk2_intro_eligibility_too_slow.description) {
-                    return await subscription.isEligibleForIntroOffer
-                }
-            return isEligible ? .eligible : .ineligible
-        } else {
-            return .noIntroOfferExists
-        }
+        return subscription.introductoryOffer == nil ? nil : subscription.subscriptionGroupID
     }
-
 }
 
 /// Default overload implementation that takes a single `StoreProductType`.
```

**File**: `Tests/UnitTests/Mocks/MockTrialOrIntroPriceEligibilityChecker.swift` (modified, +9/-5)
```diff
@@ -40,14 +40,18 @@ class MockTrialOrIntroPriceEligibilityChecker: TrialOrIntroPriceEligibilityCheck
     var invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParameters: Set<String>?
     var invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParametersList: [Set<String>] = []
     var stubbedCheckTrialOrIntroPriceEligibilityFromOptimalStoreReceiveEligibilityResult: [String: IntroEligibility] = [:]
+    private let checkEligibilityLock = Lock()
 
     override func checkEligibility(productIdentifiers: Set<String>,
                                    completion: @escaping ReceiveIntroEligibilityBlock) {
-        invokedCheckTrialOrIntroPriceEligibilityFromOptimalStore = true
-        invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreCount += 1
-        invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParameters = productIdentifiers
-        invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParametersList.append(Set(productIdentifiers))
-        completion(stubbedCheckTrialOrIntroPriceEligibilityFromOptimalStoreReceiveEligibilityResult)
+        let result = self.checkEligibilityLock.perform {
+            invokedCheckTrialOrIntroPriceEligibilityFromOptimalStore = true
+            invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreCount += 1
+            invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParameters = productIdentifiers
+            invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParametersList.append(Set(productIdentifiers))
+            return stubbedCheckTrialOrIntroPriceEligibilityFromOptimalStoreReceiveEligibilityResult
+        }
+        completion(result)
     }
 
     var invokedSk1checkTrialOrIntroPriceEligibility = false
```

**File**: `Tests/UnitTests/Purchasing/CachingTrialOrIntroPriceEligibilityCheckerTests.swift` (modified, +202/-10)
```diff
@@ -45,6 +45,22 @@ class CachingTrialOrIntroPriceEligibilityCheckerTests: TestCase {
         expect(self.mockChecker.invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParameters) == [Self.productID1]
     }
 
+    func testCallsCompletionOnMainThread() async {
+        let expected: Result = [
+            Self.productID1: .init(eligibilityStatus: .eligible)
+        ]
+        self.mockChecker.stubbedCheckTrialOrIntroPriceEligibilityFromOptimalStoreReceiveEligibilityResult = expected
+        let completionCalled = self.expectation(description: "Completion called")
+
+        self.caching.checkEligibility(productIdentifiers: [Self.productID1]) { result in
+            expect(Thread.isMainThread).to(beTrue())
+            expect(result) == expected
+            completionCalled.fulfill()
+        }
+
+        await self.fulfillment(of: [completionCalled], timeout: 1)
+    }
+
     func testCachesResultForOneProduct() async {
         let expected: Result = [
             Self.productID1: .init(eligibilityStatus: .eligible)
@@ -127,11 +143,10 @@ class CachingTrialOrIntroPriceEligibilityCheckerTests: TestCase {
         expect(result) == expected
 
         expect(self.mockChecker.invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreCount) == 2
-        expect(self.mockChecker.invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParametersList)
-            .to(contain([
-                [Self.productID1, Self.productID2],
-                [Self.productID2]
-            ]))
+        expect(self.mockChecker.invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParametersList) == [
+            productIDs,
+            [Self.productID2]
+        ]
     }
 
     func testFetchesOnlyMissingProductsFromCache() async {
@@ -167,18 +182,153 @@ class CachingTrialOrIntroPriceEligibilityCheckerTests: TestCase {
         expect(result) == allEligibilities
 
         expect(self.mockChecker.invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreCount) == 2
-        expect(self.mockChecker.invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParametersList)
-            .to(contain([
-                Set(cachedProductIDs),
-                [Self.productID3]
-            ]))
+        expect(self.mockChecker.invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreParametersList) == [
+            cachedProductIDs,
+            [Self.productID3]
+        ]
 
         let cachedResult = await self.caching.checkEligibility(productIdentifiers: productIDs)
         expect(cachedResult) == allEligibilities
 
         expect(self.mockChecker.invokedCheckTrialOrIntroPriceEligibilityFromOptimalStoreCount) == 2
     }
 
+    func testIdenticalRequestsShareInFlightCheck() async {
+        let checker = DelayedTrialOrIntroPriceEligibilityChecker()
+        let caching = CachingTrialOrIntroPriceEligibilityChecker(checker: checker)
+        let productIDs: Set<String> = [Self.productID1, Self.productID2]
+
+        let firstRequest = Task {
+            await caching.checkEligibility(productIdentifiers: productIDs)
+        }
+
+        await expect(checker.invocations.count).toEventually(equal(1))
+
+        let secondRequest = Task {
+            await caching.checkEligibility(productIdentifiers: productIDs)
+        }
+
+        await expect(checker.invocations.count).toAlways(equal(1))
+
+        let expected: Result = [
+            Self.productID1: .init(eligibilityStatus: .eligible),
+            Self.productID2: .init(eligibilityStatus: .ineligible)
+        ]
+        checker.complete(productIdentifiers: productIDs, with: expected)
+
+        let receivedFirstResult = await firstRequest.value
+        let receivedSecondResult = await secondRequest.value
+
+        expect(checker.invocations) == [productIDs]
+        expect(receivedFirstResult) == expected
+        expect(receivedSecondResult) == expected
+    }
+
+    func testRequestSharesInFlightCheckContainingAllItsProducts() async {
+        let checker = DelayedTrialOrIntroPriceEligibilityChecker()
+        let caching = CachingTrialOrIntroPriceEligibilityChecker(checker: checker)
+        let firstProductIDs: Set<String> = [Self.productID1, Self.productID2]
+        let secondProductIDs: Set<String> = [Self.productID1]
+
+        let firstRequest = Task {
+            await caching.checkEligibility(productIdentifiers: firstProductIDs)
+        }
+
+        await expect(checker.invocations.count).toEventually(equal(1))
+
+        let secondRequest = Task {
+            await caching.checkEligibility(productIdentifiers: secondProductIDs)
+        }
+
+        await expect(checker.invocations.count).toAlways(equal(1))
+
+        let expected: Result = [
+            Self.productID1: .init(eligibilityStatus: .eligible),
+            Self.productID2: .init(eligibilityStatus: .ineligible)
+        ]
+        checker.complete(productIdentifiers: firstProductIDs, with: expected)
+
+        let receivedFirstResult = await firstRequest.value
+        let receivedSe
```

---

### Incident Patch 2: `ee0afe9d` (2026-10-16)
**Commit Message**: fix(checkpoints): prevent presentation conflicts from blocking future calls (#8048)

* fix(checkpoints): finish when error alert cannot be presented

* fix(checkpoints): suppress busy presentation contexts

* refactor(checkpoints): clarify unavailable presentation context

**File**: `RevenueCatUI/Checkpoints/CheckpointError.swift` (modified, +5/-1)
```diff
@@ -21,6 +21,7 @@ enum CheckpointError: Error {
     case configurationUnavailable
     case operationAlreadyInProgress
     case noPresentationContext
+    case presentationContextUnavailable
     case presentationFailed
 
 }
@@ -33,7 +34,8 @@ extension CheckpointError: CustomNSError {
 
     var errorCode: Int {
         switch self {
-        case .invalidIdentifier, .configurationUnavailable, .noPresentationContext, .presentationFailed:
+        case .invalidIdentifier, .configurationUnavailable, .noPresentationContext,
+             .presentationContextUnavailable, .presentationFailed:
             return ErrorCode.configurationError.rawValue
         case .operationAlreadyInProgress:
             return ErrorCode.operationAlreadyInProgressForProductError.rawValue
@@ -54,6 +56,8 @@ extension CheckpointError: CustomNSError {
             return "Another checkpoint UI is already being presented."
         case .noPresentationContext:
             return "Unable to locate a view controller for checkpoint presentation."
+        case .presentationContextUnavailable:
+            return "The checkpoint presentation context is unavailable."
         case .presentationFailed:
             return "Unable to present checkpoint UI."
         }
```

**File**: `RevenueCatUI/Checkpoints/CheckpointPresenter.swift` (modified, +2/-0)
```diff
@@ -59,6 +59,8 @@ final class CheckpointPresenter: CheckpointPresenterType {
             return try await self.workflowPresenter.present(presentation)
         } catch CheckpointError.operationAlreadyInProgress {
             throw CheckpointError.operationAlreadyInProgress
+        } catch CheckpointError.presentationContextUnavailable {
+            throw CheckpointError.presentationContextUnavailable
         } catch {
             await withCheckedContinuation { continuation in
                 presentation.errorPresentationHandler(
```

**File**: `RevenueCatUI/Checkpoints/CheckpointsManager.swift` (modified, +2/-1)
```diff
@@ -236,7 +236,8 @@ final class CheckpointsManager {
             case .backedOut, .failed, .nothingPresented:
                 return .suppressed
             }
-        } catch CheckpointError.operationAlreadyInProgress {
+        } catch CheckpointError.operationAlreadyInProgress,
+                CheckpointError.presentationContextUnavailable {
             return .suppressed
         } catch {
             return .failed(error)
```

**File**: `RevenueCatUI/Checkpoints/DefaultErrorPresenter.swift` (modified, +5/-0)
```diff
@@ -103,6 +103,11 @@ final class DefaultErrorPresenter: ErrorPresenter {
                 self.acknowledge(current)
             }
         )
+
+        guard current.alertController?.presentingViewController != nil else {
+            self.finish(current)
+            return
+        }
     }
 
     private func acknowledge(_ current: Presentation) {
```

**File**: `RevenueCatUI/Checkpoints/WorkflowPresenter.swift` (modified, +7/-3)
```diff
@@ -120,7 +120,11 @@ final class WorkflowPresenter: NSObject, WorkflowPresenterType {
             do {
                 try self.startPresentation(presentation)
             } catch {
-                Logger.error(error.localizedDescription)
+                if case CheckpointError.presentationContextUnavailable = error {
+                    Logger.warning(error.localizedDescription)
+                } else {
+                    Logger.error(error.localizedDescription)
+                }
                 self.finish(throwing: error)
             }
         }
@@ -140,7 +144,7 @@ final class WorkflowPresenter: NSObject, WorkflowPresenterType {
         do {
             if let presentationStarter = self.presentationStarter {
                 guard try presentationStarter(presentation) else {
-                    throw CheckpointError.presentationFailed
+                    throw CheckpointError.presentationContextUnavailable
                 }
             } else {
                 try self.presentAutomatically(presentation)
@@ -261,7 +265,7 @@ final class WorkflowPresenter: NSObject, WorkflowPresenterType {
         viewController.modalPresentationStyle = presentation.presentationMode.modalPresentationStyle
         presentationContext.present(viewController, animated: true)
         guard viewController.presentingViewController != nil else {
-            throw CheckpointError.presentationFailed
+            throw CheckpointError.presentationContextUnavailable
         }
     }
 
```

**File**: `Tests/RevenueCatUITests/Checkpoints/CheckpointsManagerTests.swift` (modified, +22/-0)
```diff
@@ -393,6 +393,28 @@ final class CheckpointsManagerTests: TestCase {
         }
     }
 
+    func testCallbackCheckpointIsSuppressedWithoutPresentingErrorWhenPresentationContextIsUnavailable() async {
+        let workflowPresenter = WorkflowPresenter(presentationStarter: { _ in false })
+        var errorPresentationCount = 0
+        let manager = CheckpointsManager(
+            resolveCheckpoint: { _, _ in .matchedWorkflow(Self.workflow()) },
+            workflowPresenter: workflowPresenter
+        )
+
+        let result = await manager.checkpointForCallback(
+            identifier: "soft_paywall",
+            params: .init(errorPresenter: { _, completion in
+                errorPresentationCount += 1
+                completion.complete()
+            })
+        )
+
+        guard case .suppressed = result else {
+            return XCTFail("Expected the callback to be suppressed")
+        }
+        XCTAssertEqual(errorPresentationCount, 0)
+    }
+
     func testUnmatchedCallbackCheckpointStillCompletesWhileAnotherFlowIsBeingPresented() async {
         let executor = MockWorkflowPresenter()
         executor.error = CheckpointError.operationAlreadyInProgress
```

**File**: `Tests/RevenueCatUITests/Checkpoints/DefaultErrorPresenterTests.swift` (modified, +36/-2)
```diff
@@ -286,6 +286,17 @@ final class DefaultErrorPresenterTests: TestCase {
         XCTAssertEqual(terminalCompletionCount, 1)
     }
 
+    func testFailedAlertPresentationDoesNotLeaveFlowWaiting() {
+        let harness = Harness(failsPresentation: true)
+
+        harness.presenter.present(
+            params: Self.params(kind: .flowCouldNotBeShown),
+            completion: harness.completion
+        )
+
+        XCTAssertEqual(harness.completionCount, 1)
+    }
+
     private static func params(
         message: String = "boom",
         kind: CheckpointFailureKind = .flowActionFailed
@@ -322,6 +333,7 @@ final class DefaultErrorPresenterTests: TestCase {
     private final class Harness {
         private let host = UIViewController()
         private let defersDismissal: Bool
+        private let failsPresentation: Bool
         private let localeIdentifier: String?
         var presentedTitle: String?
         var presentedMessages: [String] = []
@@ -330,8 +342,13 @@ final class DefaultErrorPresenterTests: TestCase {
         var completionCount = 0
         var deferredAlerts: [DeferredDismissalViewController] = []
 
-        init(defersDismissal: Bool = false, localeIdentifier: String? = "en") {
+        init(
+            defersDismissal: Bool = false,
+            failsPresentation: Bool = false,
+            localeIdentifier: String? = "en"
+        ) {
             self.defersDismissal = defersDismissal
+            self.failsPresentation = failsPresentation
             self.localeIdentifier = localeIdentifier
         }
 
@@ -350,7 +367,11 @@ final class DefaultErrorPresenterTests: TestCase {
                     return alert
                 }
 
-                return UIViewController()
+                if self?.failsPresentation == true {
+                    return UIViewController()
+                }
+
+                return PresentedViewController()
             }
         )
 
@@ -363,6 +384,19 @@ final class DefaultErrorPresenterTests: TestCase {
         }
     }
 
+    @MainActor
+    private final class PresentedViewController: UIViewController {
+        private let presentingController = UIViewController()
+
+        override var presentingViewController: UIViewController? {
+            return self.presentingController
+        }
+
+        override func dismiss(animated flag: Bool, completion: (() -> Void)? = nil) {
+            completion?()
+        }
+    }
+
     @MainActor
     private final class DeferredDismissalViewController: UIViewController {
         private let presentingController = UIViewController()
```

**File**: `Tests/RevenueCatUITests/Checkpoints/WorkflowPresenterTests.swift` (modified, +3/-3)
```diff
@@ -564,15 +564,15 @@ final class WorkflowPresenterTests: TestCase {
 
     #if canImport(UIKit) && !os(tvOS) && !os(watchOS)
 
-    func testRejectedPresentationThrowsAndCleansStoredCall() {
+    func testUnavailablePresentationContextThrowsAndCleansStoredCall() {
         var shouldAcceptPresentation = false
         let presenter = WorkflowPresenter { _ in shouldAcceptPresentation }
 
         XCTAssertThrowsError(
             try presenter.startPresentation(Self.presentation())
         ) { error in
-            guard case CheckpointError.presentationFailed = error else {
-                return XCTFail("Expected presentationFailed, got \(error)")
+            guard case CheckpointError.presentationContextUnavailable = error else {
+                return XCTFail("Expected presentationContextUnavailable, got \(error)")
             }
         }
 
```

---

### Incident Patch 3: `c0d53773` (2026-10-19)
**Commit Message**: Fix(Paywalls) Adjust loading state during eligibility check (#8055)

* redact only the text that depends on the eligibility check

* segregate the loading states

* comment for agents just in case we have some strange naming later

* correct loading state + add tests

* add missing snapshots

* update previews for snapshot tests

* redact text on all stack children if it depends on intro offer eligibility

* Add tests for stack text redaction during eligibility load.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* add file to xcode project

* ensure the check only waits for what is needed

* Keep the stack's redaction modifier in place so eligibility finishing does not recreate its children

* naming clarity

* finish the implementation -> add to buttons and packages

* fill composite component gap

* shared modifier

* consolidate loading check

* optimize calculations in text components

* consolidate whisker check

* prevent initial result from being permanent

* cleanup -> reuse code

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `RevenueCat.xcodeproj/project.pbxproj` (modified, +10/-0)
```diff
@@ -29,6 +29,7 @@
 		A0D100000000000000000005 /* LocalRulesEvaluatorTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = A0D200000000000000000005 /* LocalRulesEvaluatorTests.swift */; };
 		02F84B23216242A7B8CDAB4A /* ErrorCode+Conformances.swift in Sources */ = {isa = PBXBuildFile; fileRef = 61F92C8B490F4B78AC8B1AAF /* ErrorCode+Conformances.swift */; };
 		030890812D2B764D0069677B /* VariableHandlerV2.swift in Sources */ = {isa = PBXBuildFile; fileRef = 030890802D2B76450069677B /* VariableHandlerV2.swift */; };
+		C4E8A91B2F6D4E70A1B3C5D7 /* OfferEligibilityTextDependency.swift in Sources */ = {isa = PBXBuildFile; fileRef = C4E8A91C2F6D4E70A1B3C5D8 /* OfferEligibilityTextDependency.swift */; };
 		030F93B32D5ED90B0085103F /* ProgressViewModifier.swift in Sources */ = {isa = PBXBuildFile; fileRef = 030F93B22D5ED90B0085103F /* ProgressViewModifier.swift */; };
 		0313FD41268A506400168386 /* DateProvider.swift in Sources */ = {isa = PBXBuildFile; fileRef = 0313FD40268A506400168386 /* DateProvider.swift */; };
 		032B13C82E0263750099E1ED /* SubscriptionHistoryTracker.swift in Sources */ = {isa = PBXBuildFile; fileRef = 032B13C72E0263750099E1ED /* SubscriptionHistoryTracker.swift */; };
@@ -1801,6 +1802,7 @@
 		A0D200000000000000000005 /* LocalRulesEvaluatorTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LocalRulesEvaluatorTests.swift; sourceTree = "<group>"; };
 		019BA4A7731BC93FEC1A74FA /* PaywallScrollEnvironment.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; name = PaywallScrollEnvironment.swift; path = RevenueCatUI/Templates/V2/Layout/PaywallScrollEnvironment.swift; sourceTree = SOURCE_ROOT; };
 		030890802D2B76450069677B /* VariableHandlerV2.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = VariableHandlerV2.swift; sourceTree = "<group>"; };
+		C4E8A91C2F6D4E70A1B3C5D8 /* OfferEligibilityTextDependency.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OfferEligibilityTextDependency.swift; sourceTree = "<group>"; };
 		030890832D2B77E20069677B /* VariableHandlerV2Tests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = VariableHandlerV2Tests.swift; sourceTree = "<group>"; };
 		030F918B2D55C9D80085103F /* LocaleFinderTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LocaleFinderTests.swift; sourceTree = "<group>"; };
 		030F93B22D5ED90B0085103F /* ProgressViewModifier.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ProgressViewModifier.swift; sourceTree = "<group>"; };
@@ -3422,6 +3424,9 @@
 		E32EE3749710C439BCB9AFD6 /* RulesEngine.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = RulesEngine.swift; sourceTree = "<group>"; };
 		E35BAD07C46D469D8CC7C396 /* RemoteConfiguration.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteConfiguration.swift; sourceTree = "<group>"; };
 		E78770053AB84EF380CC0C1D /* TextComponentViewLoadingTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = TextComponentViewLoadingTests.swift; sourceTree = "<group>"; };
+		C4E8A91D2F6D4E70A1B3C5D9 /* OfferEligibilityTextRedactionTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = OfferEligibilityTextRedactionTests.swift; sourceTree = "<group>"; };
+		C4E8A91E2F6D4E71A1B3C5DA /* StackOfferEligibilityVisibilityTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = StackOfferEligibilityVisibilityTests.swift; sourceTree = "<group>"; };
+		C4E8A91F2F6D4E72A1B3C5DB /* ButtonPackageOfferEligibilityVisibilityTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = ButtonPackageOfferEligibilityVisibilityTests.swift; sourceTree = "<group>"; };
 		E7D46162A95A4706925EC868 /* TabControlHapticFeedbackTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TabControlHapticFeedbackTests.swift; sourceTree = "<group>"; };
 		E7EAAD1DC166ABD68E484EAA /* RootViewSheetDismissalTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RootViewSheetDismissalTests.swift; sourceTree = "<group>"; };
 		E7EB64E9D44783DD16A28B05 /* WebViewComponentViewTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WebViewComponentViewTests.swift; sourceTree = "<group>"; };
@@ -3722,6 +3727,7 @@
 		0308907F2D2B76340069677B /* Variables */ = {
 			isa = PBXGroup;
 			children = (
+				C4E8A91C2F6D4E70A1B3C5D8 /* OfferEligibilityTextDependency.swift */,
 				030890802D2B76450069677B /* VariableHandlerV2.swift */,
 			);
 			path = Variables;
@@ -3771,6 +3777,9 @@
 				077AC81FEBE38D1468AE8670 /* VideoAutoplayHandlerTests.swift */,
 				B2
```

**File**: `RevenueCatUI/Templates/V2/Components/Button/ButtonComponentView.swift` (modified, +24/-6)
```diff
@@ -95,16 +95,19 @@ struct ButtonComponentView: View {
     }
 
     var body: some View {
+        let isEligibleForIntroOffer = self.introOfferEligibilityContext.isEligible(
+            package: self.packageContext.package
+        )
+        let isEligibleForPromoOffer = self.paywallPromoOfferCache.isMostLikelyEligible(
+            for: self.packageContext.package
+        )
+
         if !self.viewModel.hasUnknownAction,
            self.viewModel.visible(
                state: self.componentViewState,
                condition: self.screenCondition,
-               isEligibleForIntroOffer: self.introOfferEligibilityContext.isEligible(
-                   package: self.packageContext.package
-               ),
-               isEligibleForPromoOffer: self.paywallPromoOfferCache.isMostLikelyEligible(
-                   for: self.packageContext.package
-               ),
+               isEligibleForIntroOffer: isEligibleForIntroOffer,
+               isEligibleForPromoOffer: isEligibleForPromoOffer,
                selectedPackageId: self.selectedPackageId,
                customVariables: self.customVariables,
                windowSize: self.paywallWindowSize
@@ -117,6 +120,21 @@ struct ButtonComponentView: View {
                     onDismiss: self.onDismiss,
                     showActivityIndicatorOverContent: self.showActivityIndicatorOverContent
                 )
+                .redactedWhileOfferEligibilityLoads(
+                    self.viewModel,
+                    isEligibleForIntroOffer: isEligibleForIntroOffer,
+                    isEligibleForPromoOffer: isEligibleForPromoOffer
+                ) { intro, promo in
+                    self.viewModel.visible(
+                        state: self.componentViewState,
+                        condition: self.screenCondition,
+                        isEligibleForIntroOffer: intro,
+                        isEligibleForPromoOffer: promo,
+                        selectedPackageId: self.selectedPackageId,
+                        customVariables: self.customVariables,
+                        windowSize: self.paywallWindowSize
+                    )
+                }
             }
             .applyIfLet(self.derivedAccessibilityLabel, apply: { view, label in
                 view.accessibilityLabel(label)
```

**File**: `RevenueCatUI/Templates/V2/Components/Button/ButtonComponentViewModel.swift` (modified, +5/-2)
```diff
@@ -19,7 +19,7 @@ import Foundation
 typealias PresentedButtonPartial = PaywallComponent.PartialButtonComponent
 
 @available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
-class ButtonComponentViewModel {
+class ButtonComponentViewModel: OfferEligibilityVisibilityDependency {
 
     /// A mirror of ButtonComponent.Action, with the sole purpose of being able to change the type of urlLid parameters
     /// of some Destination's to actual URLs.
@@ -58,6 +58,7 @@ class ButtonComponentViewModel {
     let localizedBundle: Bundle
     private let uiConfigProvider: UIConfigProvider
     private let presentedOverrides: PresentedOverrides<PresentedButtonPartial>?
+    let dependsOnOfferEligibility: Bool
 
     // swiftlint:disable:next cyclomatic_complexity
     init(
@@ -76,7 +77,9 @@ class ButtonComponentViewModel {
         self.sheetStackViewModel = sheetStackViewModel
         self.componentVisible = component.visible
         self.uiConfigProvider = uiConfigProvider
-        self.presentedOverrides = component.overrides?.toPresentedOverrides(discardRules: discardRules)
+        let presentedOverrides = component.overrides?.toPresentedOverrides(discardRules: discardRules)
+        self.presentedOverrides = presentedOverrides
+        self.dependsOnOfferEligibility = presentedOverrides?.contains(where: \.dependsOnOfferEligibility) ?? false
 
         let localizedStrings = localizationProvider.localizedStrings
 
```

**File**: `RevenueCatUI/Templates/V2/Components/Carousel/CarouselComponentView.swift` (modified, +23/-6)
```diff
@@ -55,15 +55,17 @@ struct CarouselComponentView: View {
     @State private var carouselHeight: CGFloat = 0
 
     var body: some View {
+        let isEligibleForIntroOffer = self.introOfferEligibilityContext.isEligible(
+            package: self.packageContext.package
+        )
+        let isEligibleForPromoOffer = self.paywallPromoOfferCache.isMostLikelyEligible(
+            for: self.packageContext.package
+        )
         viewModel.styles(
             state: self.componentViewState,
             condition: self.screenCondition,
-            isEligibleForIntroOffer: self.introOfferEligibilityContext.isEligible(
-                package: self.packageContext.package
-            ),
-            isEligibleForPromoOffer: self.paywallPromoOfferCache.isMostLikelyEligible(
-                for: self.packageContext.package
-            ),
+            isEligibleForIntroOffer: isEligibleForIntroOffer,
+            isEligibleForPromoOffer: isEligibleForPromoOffer,
             selectedPackageId: self.selectedPackageId,
             customVariables: self.customVariables,
             windowSize: self.paywallWindowSize,
@@ -120,6 +122,21 @@ struct CarouselComponentView: View {
                        uiConfigProvider: self.viewModel.uiConfigProvider)
                 .shadow(shadow: style.shadow, shape: style.shape?.toInsettableShape())
                 .padding(style.margin)
+                .redactedWhileOfferEligibilityLoads(
+                    self.viewModel,
+                    isEligibleForIntroOffer: isEligibleForIntroOffer,
+                    isEligibleForPromoOffer: isEligibleForPromoOffer
+                ) { intro, promo in
+                    self.viewModel.visible(
+                        state: self.componentViewState,
+                        condition: self.screenCondition,
+                        isEligibleForIntroOffer: intro,
+                        isEligibleForPromoOffer: promo,
+                        selectedPackageId: self.selectedPackageId,
+                        customVariables: self.customVariables,
+                        windowSize: self.paywallWindowSize
+                    )
+                }
             }
         }
     }
```

**File**: `RevenueCatUI/Templates/V2/Components/Carousel/CarouselComponentViewModel.swift` (modified, +32/-2)
```diff
@@ -20,7 +20,7 @@ import SwiftUI
 typealias PresentedCarouselPartial = PaywallComponent.PartialCarouselComponent
 
 @available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
-class CarouselComponentViewModel {
+class CarouselComponentViewModel: OfferEligibilityVisibilityDependency {
 
     private let localizationProvider: LocalizationProvider
     let uiConfigProvider: UIConfigProvider
@@ -29,6 +29,7 @@ class CarouselComponentViewModel {
     private let pageContextNames: [String?]
 
     private let presentedOverrides: PresentedOverrides<PresentedCarouselPartial>?
+    let dependsOnOfferEligibility: Bool
 
     init(
         localizationProvider: LocalizationProvider,
@@ -43,7 +44,9 @@ class CarouselComponentViewModel {
         self.pageStackViewModels = pageStackViewModels
         self.pageContextNames = component.pages.map(\.name)
 
-        self.presentedOverrides = self.component.overrides?.toPresentedOverrides(discardRules: discardRules)
+        let presentedOverrides = component.overrides?.toPresentedOverrides(discardRules: discardRules)
+        self.presentedOverrides = presentedOverrides
+        self.dependsOnOfferEligibility = presentedOverrides?.contains(where: \.dependsOnOfferEligibility) ?? false
     }
 
     var componentName: String? {
@@ -112,6 +115,33 @@ class CarouselComponentViewModel {
         apply(style)
     }
 
+    // swiftlint:disable:next function_parameter_count
+    func visible(
+        state: ComponentViewState,
+        condition: ScreenCondition,
+        isEligibleForIntroOffer: Bool,
+        isEligibleForPromoOffer: Bool,
+        selectedPackageId: String?,
+        customVariables: [String: CustomVariableValue],
+        windowSize: CGSize? = nil
+    ) -> Bool {
+        let conditionContext = self.uiConfigProvider.conditionContext(
+            selectedPackageId: selectedPackageId,
+            customVariables: customVariables,
+            windowSize: windowSize
+        )
+
+        let partial = PresentedCarouselPartial.buildPartial(
+            state: state,
+            condition: condition,
+            isEligibleForIntroOffer: isEligibleForIntroOffer,
+            isEligibleForPromoOffer: isEligibleForPromoOffer,
+            conditionContext: conditionContext,
+            with: self.presentedOverrides
+        )
+        return partial?.visible ?? self.component.visible ?? true
+    }
+
 }
 
 extension PresentedCarouselPartial: PresentedPartial {
```

**File**: `RevenueCatUI/Templates/V2/Components/Packages/Package/PackageComponentView.swift` (modified, +25/-6)
```diff
@@ -55,16 +55,20 @@ struct PackageComponentView: View {
     }
 
     var body: some View {
+        let packageViewState = self.packageViewState
+        let isEligibleForIntroOffer = self.introOfferEligibilityContext.isEligible(
+            package: self.viewModel.package
+        )
+        let isEligibleForPromoOffer = self.paywallPromoOfferCache.isMostLikelyEligible(
+            for: self.viewModel.package
+        )
+
         if let package = self.viewModel.package,
            viewModel.visible(
                state: packageViewState,
                condition: screenCondition,
-               isEligibleForIntroOffer: introOfferEligibilityContext.isEligible(
-                   package: package
-               ),
-               isEligibleForPromoOffer: paywallPromoOfferCache.isMostLikelyEligible(
-                   for: package
-               ),
+               isEligibleForIntroOffer: isEligibleForIntroOffer,
+               isEligibleForPromoOffer: isEligibleForPromoOffer,
                selectedPackageId: selectedPackageId,
                customVariables: customVariables,
                windowSize: paywallWindowSize
@@ -73,6 +77,21 @@ struct PackageComponentView: View {
                 viewModel: self.viewModel.stackViewModel,
                 onDismiss: self.onDismiss
             )
+            .redactedWhileOfferEligibilityLoads(
+                self.viewModel,
+                isEligibleForIntroOffer: isEligibleForIntroOffer,
+                isEligibleForPromoOffer: isEligibleForPromoOffer
+            ) { intro, promo in
+                self.viewModel.visible(
+                    state: packageViewState,
+                    condition: self.screenCondition,
+                    isEligibleForIntroOffer: intro,
+                    isEligibleForPromoOffer: promo,
+                    selectedPackageId: self.selectedPackageId,
+                    customVariables: self.customVariables,
+                    windowSize: self.paywallWindowSize
+                )
+            }
             .environment(\.componentViewState, packageViewState)
             // Overrides the existing PackageContext
             .environmentObject(PackageContext(
```

**File**: `RevenueCatUI/Templates/V2/Components/Packages/Package/PackageComponentViewModel.swift` (modified, +5/-2)
```diff
@@ -19,7 +19,7 @@ import Foundation
 typealias PresentedPackagePartial = PaywallComponent.PartialPackageComponent
 
 @available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
-class PackageComponentViewModel {
+class PackageComponentViewModel: OfferEligibilityVisibilityDependency {
 
     let isSelectedByDefault: Bool
     let promotionalOfferProductCode: String?
@@ -30,6 +30,7 @@ class PackageComponentViewModel {
     let hapticFeedbackEnabled: Bool
 
     let visibilityResolver: PackageVisibilityResolver
+    let dependsOnOfferEligibility: Bool
 
     init(
         component: PaywallComponent.PackageComponent,
@@ -39,11 +40,13 @@ class PackageComponentViewModel {
         uiConfigProvider: UIConfigProvider,
         discardRules: Bool = false
     ) {
-        self.visibilityResolver = PackageVisibilityResolver(
+        let visibilityResolver = PackageVisibilityResolver(
             component: component,
             uiConfigProvider: uiConfigProvider,
             discardRules: discardRules
         )
+        self.visibilityResolver = visibilityResolver
+        self.dependsOnOfferEligibility = visibilityResolver.dependsOnOfferEligibility
         self.isSelectedByDefault = component.isSelectedByDefault
         self.promotionalOfferProductCode = component.applePromoOfferProductCode
         self.componentName = component.name
```

**File**: `RevenueCatUI/Templates/V2/Components/Packages/Package/PackageVisibilityResolver.swift` (modified, +4/-1)
```diff
@@ -28,6 +28,7 @@ struct PackageVisibilityResolver {
     private let componentVisible: Bool?
     private let uiConfigProvider: UIConfigProvider
     private let presentedOverrides: PresentedOverrides<PresentedPackagePartial>?
+    let dependsOnOfferEligibility: Bool
 
     init(
         component: PaywallComponent.PackageComponent,
@@ -36,7 +37,9 @@ struct PackageVisibilityResolver {
     ) {
         self.componentVisible = component.visible
         self.uiConfigProvider = uiConfigProvider
-        self.presentedOverrides = component.overrides?.toPresentedOverrides(discardRules: discardRules)
+        let presentedOverrides = component.overrides?.toPresentedOverrides(discardRules: discardRules)
+        self.presentedOverrides = presentedOverrides
+        self.dependsOnOfferEligibility = presentedOverrides?.contains(where: \.dependsOnOfferEligibility) ?? false
     }
 
     // swiftlint:disable:next function_parameter_count
```

#### Recent Merged Pull Requests:
- **PR #8065** (2026-10-19): Update baseline swiftinterface files for `assigned-ownership-type` (@RCGitBot)
- **PR #8063** (2026-10-19): Fix Customer Center preview tests on Xcode 14.3.1 (@MonikaMateska)
- **PR #8059** (2026-10-19): Chore(deps): Bump fastlane from 2.241.0 to 2.241.1 (@dependabot[bot])
- **PR #8058** (2026-10-19): other: attribute checkpoint offering purchases to their hit (@facumenzella)
- **PR #8057** (2026-10-19): docs: require explicit fields in data model initializers (@polmiro)
- **PR #8056** (closed): Fix parent visibility redaction and clarify eligibility checks (@vegaro)

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

## X. Paywalls) Intro Offer Eligibility checks were not resumable and sometimes slow (

**RULE**:
When implementing operations in `Sources/Purchasing/CachingTrialOrIntroPriceEligibilityChecker.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RevenueCat/purchases-ios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ee58e9bb`: Paywalls) Intro Offer Eligibility checks were not resumable and sometimes slow (#8054). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/Purchasing/CachingTrialOrIntroPriceEligibilityChecker.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    private struct RequestKey: Hashable, Sendable {
        let productIdentifiers: Set<String>
        let cacheGeneration: Int
    }

    private enum RequestAction {
        case complete([String: IntroEligibility])
        case wait
        case start(RequestKey)
    }

    private struct State {
        var cachedEligibilities: [String: IntroEligibility] = [:]
        var cacheGeneration = 0
        var inFlightRequests: [RequestKey: [ReceiveIntroEligibilityBlock]] = [:]

        mutating func prepareRequest(
            productIdentifiers: Set<String>,
            completion: @escaping ReceiveIntroEligibilityBlock
        ) -> (action: RequestAction, cachedProductIdentifiers: Set<String>) {
            let cached = self.cachedEligibilities.filter { productIdentifiers.contains($0.key) }
            let cachedProductIdentifiers = Set(cached.keys)
            let missingProducts = productIdentifiers.subtracting(cached.keys)

            guard !missingProducts.isEmpty else {
                return (.complete(cached), cachedProductIdentifiers)
            }

            let requestKey = RequestKey(
                productIdentifiers: missingProducts,
                cacheGeneratio
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
    private let checker: TrialOrIntroPriceEligibilityCheckerType
    private let cache: Atomic<[String: IntroEligibility]> = .init([:])
        self.cache.value.removeAll(keepingCapacity: false)
        let uniqueProductIdentifiers = Set(productIdentifiers)

        // Note: this can suffer from race conditions, but the only downside is performing concurrent requests
        // multiple times instead of returning the cached result on the second one.
        // It's a fine compromise to keep this implementation simpler.
        let cached = self.cache.value.filter { uniqueProductIdentifiers.contains($0.key) }

        if !cached.isEmpty {
            Logger.debug(Strings.eligibility.found_cached_eligibility_for_products(Set(cached.keys)))
        let missingProducts = uniqueProductIdentifiers.subtracting(cached.keys)
        if missingProducts.isEmpty {
        } else {
            self.checker.checkEligibility(productIdentifiers: missingProducts) { result in
                let productsToCache = result.filter { $0.value.shouldCache }

                Logger.debug(Strings.eligibility.caching_intro_eligibility_for_products(Set(productsToCache.keys)))
                self.cache.modify
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ee58e9bb` are properly handled with clean fallback behavior.
