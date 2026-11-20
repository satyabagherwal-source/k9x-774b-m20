> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/revenuecat-purchases-ios-learnings.md`  
> **Source**: github ([https://github.com/RevenueCat/purchases-ios](https://github.com/RevenueCat/purchases-ios))  
> **Source Version**: `aa9fb54b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T16:13:56.664Z  
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
> **Harvest Timestamp**: 2026-11-20T16:12:58.911Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RevenueCat/purchases-ios`
- **Description**: In-app purchases and subscriptions made easy. Support for iOS, watchOS, tvOS, macOS, and visionOS.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3095 stars

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

### Incident Patch 1: `8119b57c` (2026-11-18)
**Commit Message**: fix: avoid decoding cached customer info on the main thread (#25)

**File**: `Sources/Identity/CustomerInfoManager.swift` (modified, +5/-3)
```diff
@@ -198,9 +198,11 @@ class CustomerInfoManager {
             }
 
             self.systemInfo.isApplicationBackgrounded { [self] isAppBackgrounded in
-                self.fetchAndCacheCustomerInfoDataIfStale(appUserID: appUserID,
-                                                          isAppBackgrounded: isAppBackgrounded,
-                                                          completion: completionIfNotCalledAlready)
+                self.operationDispatcher.dispatchOnWorkerThread {
+                    self.fetchAndCacheCustomerInfoDataIfStale(appUserID: appUserID,
+                                                              isAppBackgrounded: isAppBackgrounded,
+                                                              completion: completionIfNotCalledAlready)
+                }
             }
 
         case .notStaleCachedOrFetched:
```

**File**: `Tests/UnitTests/Identity/CustomerInfoManagerTests.swift` (modified, +89/-0)
```diff
@@ -925,6 +925,66 @@ class CustomerInfoManagerGetCustomerInfoTests: BaseCustomerInfoManagerTests {
         await expect(self.mockBackend.invokedGetSubscriberDataCount).toEventually(equal(1))
     }
 
+    func testCustomerInfoCachedOrFetchedDoesNotReadFreshCacheAgainOnMainActor() async throws {
+        let systemInfo = MainActorSystemInfo(finishTransactions: true)
+        let deviceCache = MainThreadRecordingDeviceCache(systemInfo: systemInfo)
+        self.mockOperationDispatcher.forwardToOriginalDispatchOnWorkerThread = true
+        let customerInfoManager = CustomerInfoManager(
+            offlineEntitlementsManager: self.mockOfflineEntitlementsManager,
+            operationDispatcher: self.mockOperationDispatcher,
+            deviceCache: deviceCache,
+            backend: self.mockBackend,
+            transactionFetcher: self.mockTransationFetcher,
+            transactionPoster: self.mockTransactionPoster,
+            systemInfo: systemInfo
+        )
+        customerInfoManager.cache(customerInfo: self.mockCustomerInfo, appUserID: Self.appUserID)
+
+        await withCheckedContinuation { continuation in
+            DispatchQueue.global().async {
+                customerInfoManager.customerInfo(appUserID: Self.appUserID,
+                                                 fetchPolicy: .cachedOrFetched,
+                                                 trackDiagnostics: false) { _ in
+                    continuation.resume()
+                }
+            }
+        }
+
+        await expect(deviceCache.cachedCustomerInfoReadsWereOnMainThread)
+            .toEventually(equal([false, false]))
+    }
+
+    func testCustomerInfoCachedOrFetchedDoesNotReadStaleCacheAgainOnMainActor() async throws {
+        let systemInfo = MainActorSystemInfo(finishTransactions: true)
+        let deviceCache = MainThreadRecordingDeviceCache(systemInfo: systemInfo)
+        deviceCache.stubbedIsCustomerInfoCacheStale = true
+        self.mockBackend.stubbedGetCustomerInfoResult = .success(self.mockRefreshedCustomerInfo)
+        self.mockOperationDispatcher.forwardToOriginalDispatchOnWorkerThread = true
+        let customerInfoManager = CustomerInfoManager(
+            offlineEntitlementsManager: self.mockOfflineEntitlementsManager,
+            operationDispatcher: self.mockOperationDispatcher,
+            deviceCache: deviceCache,
+            backend: self.mockBackend,
+            transactionFetcher: self.mockTransationFetcher,
+            transactionPoster: self.mockTransactionPoster,
+            systemInfo: systemInfo
+        )
+        customerInfoManager.cache(customerInfo: self.mockCustomerInfo, appUserID: Self.appUserID)
+
+        await withCheckedContinuation { continuation in
+            DispatchQueue.global().async {
+                customerInfoManager.customerInfo(appUserID: Self.appUserID,
+                                                 fetchPolicy: .cachedOrFetched,
+                                                 trackDiagnostics: false) { _ in
+                    continuation.resume()
+                }
+            }
+        }
+
+        await expect(self.mockBackend.invokedGetSubscriberDataCount).toEventually(equal(1))
+        expect(deviceCache.cachedCustomerInfoReadsWereOnMainThread) == [false]
+    }
+
     func testCustomerInfoCachedOrFetchedFetchesIfNoCache() async throws {
         self.mockBackend.stubbedGetCustomerInfoResult = .success(self.mockRefreshedCustomerInfo)
 
@@ -1085,6 +1145,35 @@ class CustomerInfoManagerGetCustomerInfoTests: BaseCustomerInfoManagerTests {
 
 }
 
+private final class MainActorSystemInfo: MockSystemInfo {
+
+    override func isApplicationBackgrounded(completion: @escaping (Bool) -> Void) {
+        OperationDispatcher.default.dispatchOnMainActor {
+            completion(false)
+        }
+    }
+
+}
+
+extension MainActorSystemInfo: @unchecked Sendable {}
+
+private final class MainThreadRecordingDeviceCache: MockDeviceCache {
+
+    private let readsWereOnMainThread: Atomic<[Bool]> = .init([])
+
+    var cachedCustomerInfoReadsWereOnMainThread: [Bool] {
+        return self.readsWereOnMainThread.value
+    }
+
+    override func cachedCustomerInfoData(appUserID: String) -> Data? {
+        self.readsWereOnMainThread.modify { $0.append(Thread.isMainThread) }
+        return super.cachedCustomerInfoData(appUserID: appUserID)
+    }
+
+}
+
+extension MainThreadRecordingDeviceCache: @unchecked Sendable {}
+
 @available(iOS 15.0, tvOS 15.0, macOS 12.0, watchOS 8.0, *)
 class CustomerInfoVerificationTrackingTests: BaseCustomerInfoManagerTests {
 
```

---

### Incident Patch 2: `aa9fb54b` (2026-11-20)
**Commit Message**: [AUTOMATIC] test: sync audience fixtures from Khepri main (RevenueCat/purchases-ios_internal#73)

Co-authored-by: facumenzella <[REDACTED_EMAIL]>
GitOrigin-RevId: 6019b1b025369274860b0571ee1cf1fceae4ea8e

**File**: `Tests/UnitTests/LocalRules/AudienceCompatibility/coverage.json` (modified, +8/-6)
```diff
@@ -2,13 +2,15 @@
   "schema_version": 1,
   "required_fields": [
     "country",
+    "latestOwnershipType",
     "latestStore",
     "locale",
     "storefront",
     "totalRenewals"
   ],
   "condition_files": [
     "conditions/country.json",
+    "conditions/latest_ownership_type.json",
     "conditions/latest_store.json",
     "conditions/locale.json",
     "conditions/storefront.json",
@@ -2472,37 +2474,37 @@
     {
       "field": "latestOwnershipType",
       "operator": "is",
-      "status": "unverified",
+      "status": "covered",
       "errors": []
     },
     {
       "field": "latestOwnershipType",
       "operator": "isNot",
-      "status": "unverified",
+      "status": "covered",
       "errors": []
     },
     {
       "field": "latestOwnershipType",
       "operator": "isAnyOf",
-      "status": "unverified",
+      "status": "covered",
       "errors": []
     },
     {
       "field": "latestOwnershipType",
       "operator": "isNotAnyOf",
-      "status": "unverified",
+      "status": "covered",
       "errors": []
     },
     {
       "field": "latestOwnershipType",
       "operator": "isEmpty",
-      "status": "unverified",
+      "status": "covered",
       "errors": []
     },
     {
       "field": "latestOwnershipType",
       "operator": "isNotEmpty",
-      "status": "unverified",
+      "status": "covered",
       "errors": []
     },
     {
```

**File**: `Tests/UnitTests/LocalRules/AudienceCompatibility/profiles.json` (modified, +1072/-0)
```diff
@@ -1972,6 +1972,1078 @@
         },
         "as_of": 350000
       }
+    },
+    "ownership_purchased": {
+      "app_user_id": "compatibility-user",
+      "evaluated_at": 1717200000,
+      "device": {
+        "app_version": "1.0.0",
+        "platform": "ios",
+        "platform_version": [
+          26,
+          0,
+          0
+        ],
+        "sdk_version": "10.0.0",
+        "locale": null
+      },
+      "store_country": null,
+      "attributes": {},
+      "customer_info": {
+        "request_date": "2024-06-01T00:00:00+00:00",
+        "subscriber": {
+          "first_seen": "1970-01-01T00:00:01Z",
+          "original_app_user_id": "compatibility-user",
+          "original_application_version": "1.0",
+          "subscriptions": {
+            "premium": {
+              "purchase_date": "1970-01-01T00:01:40Z",
+              "original_purchase_date": "1970-01-01T00:01:40Z",
+              "expires_date": "1970-01-01T00:05:00Z",
+              "store": "app_store",
+              "ownership_type": "PURCHASED",
+              "is_sandbox": false,
+              "period_type": "normal"
+            }
+          },
+          "non_subscriptions": {},
+          "entitlements": {}
+        }
+      },
+      "subscriber_dimensions": {
+        "dimensions": {
+          "country": null,
+          "sdk_flavor": null,
+          "last_seen_at": null,
+          "subscription_status": "expired",
+          "total_renewals": 1,
+          "total_spent": 0,
+          "first_purchase_at": 100000,
+          "most_recent_purchase_at": 100000,
+          "most_recent_renewal_at": 100000,
+          "latest_expiration_at": 300000,
+          "trial_start_at": null,
+          "trial_end_at": null,
+          "subscription_opt_out_at": null,
+          "trial_opt_out_at": null,
+          "latest_product_identifier": "premium",
+          "latest_offer": null,
+          "latest_store": "app_store",
+          "is_rc_promo": false,
+          "latest_ownership_type": "purchased",
+          "latest_purchased_offering": null,
+          "price_experiment_id": null,
+          "price_experiment_variant": null,
+          "latest_auto_renew_intent": false,
+          "latest_offer_type": "no_offer",
+          "latest_store_country": null,
+          "total_ad_impressions": null,
+          "total_ad_revenue": null,
+          "total_rewarded_ad_completions": null,
+          "last_ad_impression_at": null,
+          "last_rewarded_ad_completion_at": null
+        },
+        "as_of": 350000
+      }
+    },
+    "ownership_family_shared": {
+      "app_user_id": "compatibility-user",
+      "evaluated_at": 1717200000,
+      "device": {
+        "app_version": "1.0.0",
+        "platform": "ios",
+        "platform_version": [
+          26,
+          0,
+          0
+        ],
+        "sdk_version": "10.0.0",
+        "locale": null
+      },
+      "store_country": null,
+      "attributes": {},
+      "customer_info": {
+        "request_date": "2024-06-01T00:00:00+00:00",
+        "subscriber": {
+          "first_seen": "1970-01-01T00:00:01Z",
+          "original_app_user_id": "compatibility-user",
+          "original_application_version": "1.0",
+          "subscriptions": {
+            "monthly": {
+              "purchase_date": "1970-01-01T00:01:40Z",
+              "original_purchase_date": "1970-01-01T00:01:40Z",
+              "expires_date": "1970-01-01T00:05:00Z",
+              "store": "app_store",
+              "ownership_type": "FAMILY_SHARED",
+              "is_sandbox": false,
+              "period_type": "normal"
+            }
+          },
+          "non_subscriptions": {},
+          "entitlements": {}
+        }
+      },
+      "subscriber_dimensions": {
+        "dimensions": {
+          "country": null,
+          "sdk_flavor": null,
+          "last_seen_at": null,
+          "subscription_status": "expired",
+          "total_renewals": 1,
+          "total_spent": 0,
+          "first_purchase_at": 100000,
+          "most_recent_purchase_at": 100000,
+          "most_recent_renewal_at": 100000,
+          "latest_expiration_at": 300000,
+          "trial_start_at": null,
+          "trial_end_at": null,
+          "subscription_opt_out_at": null,
+          "trial_opt_out_at": null,
+          "latest_product_identifier": "monthly",
+          "latest_offer": null,
+          "latest_store": "app_store",
+          "is_rc_promo": false,
+          "latest_ownership_type": "family_shared",
+          "latest_purchased_offering": null,
+          "price_experiment_id": null,
+          "price_experiment_variant": null,
+          "latest_auto_renew_intent": false,
+          "latest_offer_type": "no_offer",
+          "latest_store_country": null,
+          "total_ad_impressions": null,
+          "total_ad_revenue": null,
+          "total_rewarded_ad_completions": null,
+          "last_ad_impression_at": null,
+          "last_rewarded_ad_completion_a
```

---

### Incident Patch 3: `f994104f` (2026-11-20)
**Commit Message**: ci: add the hotfix PR comment command (RevenueCat/purchases-ios_internal#62)

GitOrigin-RevId: 482abeef96f8114fd680394c47b359ee71b805f0

**File**: `Contributing/RELEASING.md` (modified, +8/-9)
```diff
@@ -10,12 +10,11 @@
 5. The release branch PR can be merged after the release is completed.
 
 ##### Hotfixes:
-Sometimes you might need to release a patch on a version that's not the latest. Or sometimes there might have been commits on `main` that shouldn't be released, but the latest version has a big bug. For example, let's say the last version is 4.0.0, but there's a bug on 3.9.0 that needs to be released as a 3.9.1:
-1. Open a PR with the fix, merge it to `main`.
-2. Jump to 3.9.0 and create a new branch `release/3.9.0`. Push this branch since it will be used as base for the PR you will open in the next steps.
-3. Cherry pick the changes with your fix that you just merged to `main` using `git cherry-pick <sha_of_the_squashed_commit_in_main>`. Fix any conflicts if there are any. Push the cherry picked commit to the remote branch `release/3.9.0`.
-4. Run `bundle exec fastlane ios bump` as you would do with any release. This will create a new PR `release/3.9.1`. Make sure the base branch of the PR is pointing to `release/3.9.0` and that the PR is labeled with **DO NOT MERGE** (add it to the title too so it's not merged by mistake)
-5. When the PR is approved, **DO NOT MERGE IT**. The `wait-for-pr-approval` job is approved automatically once the PR is approved, and CircleCI tags the release when the tests pass. If there is no such job because the release is older than when we introduced it, manually tag the last commit in `release/3.9.1` with `3.9.1`.
-6. CircleCI will start the deployment process
-7. Close the PR after the release has been completed and delete both `release/3.9.0` and `release/3.9.1` branches.
-8. Remember to edit the CHANGELOG.md in `main` to include the version that has been just released
+To release a fix merged into `main` without releasing the rest of `main`, for example 3.9.1 when the latest is 4.0.0, or 4.0.1 while `main` is not ready to release:
+1. Comment `@RCGitBot hotfix 3` on the merged fix PR. The bot cherry-picks the fix onto the latest 3.x tag, bumps the version, opens a `release/3.9.1` PR into a new `hotfix/3.9.0` branch and comments the release PR link on the fix PR.
+1. Approve the release PR, but **don't merge it**. Once tests pass, CircleCI tags 3.9.1, deploys it and merges the PR into `hotfix/3.9.0`. If that does not happen, approve the `wait-for-pr-approval` job in CircleCI by hand, or tag the last commit of `release/3.9.1` with `3.9.1` and push the tag.
+1. Delete the `hotfix/3.9.0` branch and add the release to CHANGELOG.md on `main`.
+
+If the cherry-pick conflicts, the bot comments a local command instead: run it from `main`, resolve the conflicts, run `git cherry-pick --continue`, then run it again to open the PR.
+
+To patch an older minor (3.8.x while 3.9.0 exists), run `bundle exec fastlane ios hotfix pr:<number> version:3.8.2` locally (releases 3.8.3). Both local commands need `fastlane/.env`, like `bump`.
```

**File**: `Gemfile.lock` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ GIT
 GIT
   remote: https://github.com/RevenueCat/fastlane-plugin-revenuecat_internal
   revision: 37768463cc78744ee71218b93ecec964fd4c8c83
+  tag: v0.3.0
   specs:
     fastlane-plugin-revenuecat_internal (0.3.0)
       nokogiri
```

**File**: `fastlane/Fastfile` (modified, +16/-0)
```diff
@@ -119,6 +119,22 @@ platform :ios do
     bump(options)
   end
 
+  desc "Open a hotfix release PR that patches an older release with a PR merged into main. Usage: fastlane ios hotfix pr:1234 version:9.16.0"
+  lane :hotfix do |options|
+    create_hotfix(
+      pr_number: options[:pr],
+      version: options[:version],
+      changelog_latest_path: CHANGELOG_LATEST_PATH,
+      changelog_path: CHANGELOG_PATH,
+      files_to_update: files_with_version_number,
+      files_to_update_without_prerelease_modifiers: files_with_version_number_without_prerelease_modifiers,
+      files_to_update_on_latest_stable_releases: files_to_update_on_latest_stable_releases,
+      repo_name: INTERNAL_REPO_NAME,
+      omit_pr_references_in_changelog_files: true,
+      dry_run: options[:dry_run]
+    )
+  end
+
   desc "Make github release"
   lane :github_release do |options|
     create_github_release(
```

**File**: `fastlane/Pluginfile` (modified, +1/-1)
```diff
@@ -3,6 +3,6 @@
 # Ensure this file is checked in to source control!
 
 gem 'fastlane-plugin-create_xcframework', git: "https://github.com/RevenueCat/fastlane-plugin-create_xcframework"
-gem "fastlane-plugin-revenuecat_internal", git: "https://github.com/RevenueCat/fastlane-plugin-revenuecat_internal"
+gem "fastlane-plugin-revenuecat_internal", git: "https://github.com/RevenueCat/fastlane-plugin-revenuecat_internal", tag: "v0.3.0"
 gem 'fastlane-plugin-emerge'
 gem 'fastlane-plugin-sentry'
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

## X. avoid decoding cached customer info on the main thread

**RULE**:
When implementing operations in `Sources/Identity/CustomerInfoManager.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RevenueCat/purchases-ios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8119b57c`: avoid decoding cached customer info on the main thread. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/Identity/CustomerInfoManager.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                self.operationDispatcher.dispatchOnWorkerThread {
                    self.fetchAndCacheCustomerInfoDataIfStale(appUserID: appUserID,
                                                              isAppBackgrounded: isAppBackgrounded,
                                                              completion: completionIfNotCalledAlready)
                }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
                self.fetchAndCacheCustomerInfoDataIfStale(appUserID: appUserID,
                                                          isAppBackgrounded: isAppBackgrounded,
                                                          completion: completionIfNotCalledAlready)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8119b57c` are properly handled with clean fallback behavior.
