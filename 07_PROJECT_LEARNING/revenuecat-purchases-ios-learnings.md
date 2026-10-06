# Forensic Learning Record (Deep Inspection): RevenueCat/purchases-ios

> **Canonical Artifact**: `07_PROJECT_LEARNING/revenuecat-purchases-ios-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RevenueCat/purchases-ios](https://github.com/RevenueCat/purchases-ios))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:16:30.300Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RevenueCat/purchases-ios`
- **Description**: In-app purchases and subscriptions made easy. Support for iOS, watchOS, tvOS, macOS, and visionOS.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3074 stars

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

### Core Architecture Module: `Examples/SampleCat/SampleCat/Utils/Views/Spinner/Spinner.swift`
```
import SwiftUI

struct Spinner: View {
    @State private var ballRotation: Double = 0
    @State private var yarnAngle: Double = 0
    @State private var yarnDirection: Double = 1

    let tint: Color

    init(tint: Color = .accent) {
        self.tint = tint
    }

    var body: some View {
        ZStack {
            YarnShape()
                .stroke(tint, lineWidth: 2)
                .rotationEffect(.degrees(yarnAngle), anchor: .trailing)

            BallShape()
                .fill(tint)
                .rotationEffect(.degrees(ballRotation), anchor: UnitPoint(x: 0.5, y: 0.51))
        }
        .frame(width: 40, height: 40)
        .onAppear {
            withAnimation(.linear(duration: 0.8).repeatForever(autoreverses: false)) {
                ballRotation = 360
            }

            Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { _ in
                Task {
                    await MainActor.run {
                        yarnAngle += yarnDirection * (2.0 / (0.8 * 60.0))
                        if abs(yarnAngle) >= 2 {
                            yarnDirection *= -1
                        }
                    }
                }
            }
        }
    }
}

```

### Core Architecture Module: `RevenueCatUI/CustomerCenter/ContactSupportUtilities.swift`
```
//
//  Copyright RevenueCat Inc. All Rights Reserved.
//
//  Licensed under the MIT License (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      https://opensource.org/licenses/MIT
//
//  ContactSupportUtilities.swift
//
//  Created by Antonio Rico Diez on 2024-10-23.

import Foundation
@_spi(Internal) import RevenueCat
#if canImport(UIKit)
import UIKit
#endif

@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
@available(macOS, unavailable)
@available(tvOS, unavailable)
@available(watchOS, unavailable)
extension CustomerCenterConfigData.Support {

    func calculateBody(_ localization: CustomerCenterConfigData.Localization,
                       dataToInclude: [(String, String)]? = nil,
                       purchasesProvider: CustomerCenterPurchasesType) -> String {
        let infoToInclude: [(String, String)]
        if let dataToInclude {
            infoToInclude = dataToInclude
        } else {
            infoToInclude = Self.defaultData(localization, purchasesProvider: purchasesProvider)
        }
        let defaultBody =
            """
            \(localization[.defaultBody])

            ---------------------------
            \(infoToInclude.map { (key, value) in
                "- \(key): \(value)"
            }.joined(separator: "\n"))
            """
        return defaultBody
    }

    private static func defaultData(_ localization: CustomerCenterConfigData.Localization,
                                    purchasesProvider: CustomerCenterPurchasesType) -> [(String, String)] {
        let unknown = localization[.unknown]
        var osVersion = unknown
        var deviceModel = unknown
        #if canImport(UIKit) && !os(watchOS)
        osVersion = UIDevice.current.systemVersion
        deviceModel = UIDevice.current.model
        #endif
        let userID = Purchases.isConfigured ? purchasesProvider.appUserID : unknown
        let storeFrontCountryCode = purchasesProvider.isConfigured ?
        purchasesProvider.storeFrontCountryCode ?? unknown : unknown

        return [
            ("RC User ID", userID),
            ("App Version", Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? unknown),
            ("Device", deviceModel),
            ("OS Version", osVersion),
            ("StoreFront Country Code", storeFrontCountryCode)
        ]
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7538** (2026-09-18): **🐛 Paywall voice over support is poor/buggy**
  *Symptoms*: ### Describe the bug  I am using my Paywall as an example. See screenshot below and video walkthrough at https://www.youtube.com/shorts/zCAxuvaZpDI.  Summary of issues:  - The currently selected offer is not noted. It is not obvious to user what is currently selected. This is a major issue. It should be read something like "Yearly, Selected. /Summary/. Button" and "Monthly, Not Selected. /Summary/. Button". Because this is lacking, the user has no way to know which offer they have selected and what they will purchase. This is the core bug of this issue. The others below are less critical. - There is no way to mark something as ignored. So, for example, a simple check symbol used in a bullet list cannot be skipped over and is read as image. Or an icon for an app used in a header cannot be skipped. I have since found how alt text can be defined for my logo via the media gallery (https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls/components#alt-text), but I just want it ignored. - The voice over label for payment terms should be customized and not reply on the screen text. So for example, $1.24/mo is read as "1 dollar and 24 cents slash mo" instead of "1 dollar and 24 cents per month". This should be done and localized. - There is no way to open the links in the paragraph below my header. When I had rotor set to hyperlinks and swiped down, the link was highlighted briefly but then the focus went back to the paragraph the link was in.  <img width="1260" height="2736
  **Post-Mortem & Fix Analysis**:
  > With https://github.com/RevenueCat/purchases-ios/pull/7545, here is voice over on my paywall: https://www.youtube.com/shorts/EB8cq4-bRCI
  > @t9mike Thank you for the detailed video!! We should definitely do better in the accessibility area. I can't promise timeline on this ones but we most certainly put it in the radar (we accept PRs for some of these if you need them sooner)
  > > [@t9mike](https://github.com/t9mike) Thank you for the detailed video!! We should definitely do better in the accessibility area. I can't promise timeline on this ones but we most certainly put it in the radar (we accept PRs for some of these if you need them sooner)  I have a PR :-) https://github.com/RevenueCat/purchases-ios/pull/7545 

- **Issue #7122** (2026-07-02): **🐛 RevenueCatUI 5.80+: Purchases+PreviewPaywall.swift uses UIApplication.shared and breaks compilation in app extensions**
  *Symptoms*: ### Describe the bug  RevenueCatUI 5.80+ adds `Purchases+PreviewPaywall.swift` with `UIApplication.shared`, which breaks compilation for any app extension that links `RevenueCatUI`. Reproduced on 5.80.1. Works on 5.79.0.  ### Platform  iOS  ### SDK version  5.80.1  ### SDK integration method  CocoaPods  ### StoreKit version  {"StoreKit 1 (default on versions <5.0.0. Can be enabled in versions >=5.0.0 with `.with(storeKitVersion" => ".storeKit1)`)"}  ### OS version  iOS 26.5.2  ### Xcode version  26.3  ### Device and/or simulator  Device  ### Environment  Sandbox  ### How widespread is the issue  100%  ### Debug logs  ```shell Compile-time error when building WidgetKit app extension with RevenueCatUI 5.80.1:  RevenueCatUI/Purchases+PreviewPaywall.swift:  'shared' is unavailable in application extensions for iOS: Use view controller based solutions where appropriate instead.          if presentationContext == nil {             presentationContext = UIApplication.shared                                                .connectedScenes                                                .compactMap { $0 as? UIWindowScene } ```  ### Steps to reproduce  1. Link `RevenueCatUI` 5.80.1 into a WidgetKit app extension (CocoaPods). 2. Build the extension target.  **Expected:** compiles (works on 5.79.0).   **Actual:** compile error in `Purchases+PreviewPaywall.swift` - `'shared' is unavailable in application extensions for iOS` at `UIApplication.shared`.  ### Other information  **Related:** - I
  **Post-Mortem & Fix Analysis**:
  > @stepushchik thank you so much for reporting this! I'll have a PR up to fix this in a few minutes.
  > @stepushchik Thanks again for reporting this! We just pushed out v5.80.2 to address this.
  > @davedelong thanks for the quick fix - confirmed working with 5.80.2.

- **Issue #6985** (2026-06-15): **🐛 Paywall looping video crashes with NSInternalInconsistencyException — AVQueuePlayer + AVPlayerLooper handed to AVPlayerViewController (KVO currentItem.status)**
  *Symptoms*: ### Describe the bug  Environment  - [ ] Component: RevenueCatUI Paywalls V2 — video background component - [ ] Platform: iOS 16+ (release builds, observed via Crashlytics in production)  **Summary** When a Paywall V2 offering uses a looping video background, RevenueCatUI creates an AVQueuePlayer + AVPlayerLooper and assigns it to an AVPlayerViewController. Because AVPlayerLooper swaps the queue player's currentItem without sending standard KVO notifications, AVKit's internal AVPlayerController crashes while removing its currentItem.* observers during deallocation. This is a fatal, non-catchable exception.    ### Platform  iOS  ### SDK version  5.66.0  ### SDK integration method  Swift Package Manager  ### StoreKit version  {"StoreKit 1 (default on versions <5.0.0. Can be enabled in versions >=5.0.0 with `.with(storeKitVersion" => ".storeKit1)`)"}  ### OS version  iOS 26.5  ### Xcode version  26.3  ### Device and/or simulator  Device  ### Environment  Production  ### How widespread is the issue  5  ### Debug logs  ```shell Fatal Exception: NSInternalInconsistencyException Cannot remove an observer <NSKeyValueObservance 0x1736832d0> for the key path "currentItem.status" from <AVQueuePlayer 0x1326a9a00>, most likely because the value for the key "currentItem" has changed without an appropriate KVO notification being sent. Check the KVO-compliance of the AVQueuePlayer class.  Crashed: com.google.firebase.crashlytics.ios.exception 0  BushnellGolf                   0x10d1bc8 FIRCL
  **Post-Mortem & Fix Analysis**:
  > We're taking a look @jijopulikkottil ! We'll ping you back

- **Issue #6977** (2026-06-11): **🐛 iOS 27 SDK - Various redeclaration errors**
  *Symptoms*: ### Describe the bug  Within `CustomerCenterConfigData.swift`:  ``` @_spi(Internal) public init(                 light: String?,                 dark: String?             ) {                 if let light = light {                     do {                         self.light = try RCColor(stringRepresentation: light) // Ambiguous use of 'init(stringRepresentation:)'                     } catch {                         Logger.error("Failed to parse light color \(light)")                     }                 }                 if let dark = dark {                     do {                         self.dark = try RCColor(stringRepresentation: dark) // Ambiguous use of 'init(stringRepresentation:)'                     } catch {                         Logger.error("Failed to parse dark color \(dark)")                     }                 }             } ```  As a result of `PaywallColor.swift`:  ``` extension PaywallColor { // Invalid redeclaration of synthesized memberwise 'init(stringRepresentation:)'      #if canImport(SwiftUI)      /// Creates a color from a Hex string: `#RRGGBB` or `#RRGGBBAA`.     public init(stringRepresentation: String) throws {         self.init(stringRepresentation: stringRepresentation, color: try Self.parseColor(stringRepresentation))     }          #if canImport(UIKit)          /// Creates a dynamic color for 2 ``ColorScheme``s.         @available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)         public init(light: PaywallColor, dark: PaywallCo
  **Post-Mortem & Fix Analysis**:
  > Hi @Nathan1258, thanks for your report! This exact issue should be resolved (by [#6949](https://github.com/RevenueCat/purchases-ios/pull/6949)) in version [5.78.0](https://github.com/RevenueCat/purchases-ios/releases/tag/5.78.0) of the SDK.   Could you please double check to ensure you're using that specific version of the SDK?  Please let me know in case you have any other questions.  Thanks!
  > > Hi [@Nathan1258](https://github.com/Nathan1258), thanks for your report! This exact issue should be resolved (by [#6949](https://github.com/RevenueCat/purchases-ios/pull/6949)) in version [5.78.0](https://github.com/RevenueCat/purchases-ios/releases/tag/5.78.0) of the SDK. >  > Could you please double check to ensure you're using that specific version of the SDK? >  > Please let me know in case you have any other questions. >  > Thanks!  Yes, apologies for the duplicate I was literally about to open a Pull request for this fix until I realised SPM cached the old release. Closing now!
  > No problem! Happy to hear it's resolved!

- **Issue #6972** (2026-06-10): **🐛 iOS 27 - RCColor(stringRepresentation: light) - Ambiguous use of 'init(stringRepresentation:)'**
  *Symptoms*: ### Describe the bug  🐛 iOS 27 - RCColor(stringRepresentation: light) - Ambiguous use of 'init(stringRepresentation:)'  ### Platform  iOS  ### SDK version  5.78.0  ### SDK integration method  Swift Package Manager  ### StoreKit version  {"StoreKit 1 (default on versions <5.0.0. Can be enabled in versions >=5.0.0 with `.with(storeKitVersion" => ".storeKit1)`)"}  ### OS version  27  ### Xcode version  27  ### Device and/or simulator  Device  ### Environment  Sandbox  ### How widespread is the issue  ios 27  ### Debug logs  ```shell na ```  ### Steps to reproduce  na  ### Other information  ```markdown  ```  ### Additional context  ```markdown  ```
  **Post-Mortem & Fix Analysis**:
  > Hi @jordanZeleny, thanks for reporting! 🙌  You mention that you're using it in the issue, but can you please double check and confirm that you're seeing this build failure on version 5.78.0 of the SDK? `RCColor` is a typealias of `PaywallColor`, which exhibited this compilation issue and was fixed in https://github.com/RevenueCat/purchases-ios/pull/6949 and released with SDK version 5.78.0.  I just tested it out and am unable to reproduce myself using Xcode 27 beta 1. If you can confirm that you're on version 5.78.0, can you please include the following info: - Which platform you're trying to build for - Build logs showing the failure - The exact version of Xcode you're using  Thank you!
  > got it working had to reset my mac

- **Issue #6950** (2026-06-09): **🐛 Cannot compile the latest RC SDK in Xcode 27**
  *Symptoms*: ### Describe the bug  In Xcode 27 the RC SDK fails to compile. It would be great to start building with Xcode 27!  See attached screenshot  <img width="352" height="135" alt="Image" src="https://github.com/user-attachments/assets/d41f7266-aaa2-416c-9ff0-a1ac58414655" />  ### Platform  iOS  ### SDK version  5.73.0  ### SDK integration method  Swift Package Manager  ### StoreKit version  StoreKit 2 (default on versions >=5.0.0)  ### OS version  26.5.1  ### Xcode version  27.0  ### Device and/or simulator  Simulator  ### Environment  Sandbox  ### How widespread is the issue  0%  ### Debug logs  ```shell Ambiguous use of 'init(stringRepresentation:)' ```  ### Steps to reproduce  1. Compile in Xcode 27 2. Note compile error  ### Other information  ```markdown  ```  ### Additional context  ```markdown  ```
  **Post-Mortem & Fix Analysis**:
  > Hi @ethan021021, thanks for reporting! We'll be shipping https://github.com/RevenueCat/purchases-ios/pull/6949 soon, so please keep an eye out!
  > i got same errror
  > We just released [v5.78.0](https://github.com/RevenueCat/purchases-ios/releases/tag/5.78.0) with the fix for this. Thank you again for reporting @ethan021021!

- **Issue #6891** (2026-06-04): **Clear offerings cache on locale override even when rate-limited**
  *Symptoms*: ### Motivation  Follow-up to support ticket 74771 (and the earlier 72726 → #6446 work).  `overridePreferredUILocale(_:)` clears the in-memory offerings cache and triggers a background re-fetch so the next paywall reflects the new locale. But the cache clear sat **inside** the `RateLimiter(maxCalls: 2, period: 60)` gate together with the re-fetch — so once the limiter is exhausted, a genuine locale change clears nothing, and the next paywall presentation renders the **previously cached** locale. That's the "paywall stays in the old language after switching" report on 74771.  ### Change  Move `self.offeringsManager.clearInMemoryOfferingsCache()` out of the rate-limit gate in `overridePreferredUILocale(_:)`: the in-memory cache is cleared on **every** genuine locale change, while the rate limiter keeps throttling only the eager network re-fetch.  `OfferingsManager.offerings(...)` fetches fresh from the network whenever the in-memory cache is empty (the on-disk `largeItemCache` is only a network-failure fallback via `fetchCachedOfferingsFromDisk`), so clearing the in-memory cache is enough to guarantee the next presentation uses the new locale.  - Correctness (the cache clear) is no longer suppressed by the limiter; only network spam is throttled. - **No public API change.** The on-disk offerings cache is intentionally left intact for offline resilience; it only surfaces a stale locale when the device is fully offline.  ### Tests  - Updated `testOverridePreferredUILocaleStillClea

- **Issue #6809** (2026-05-18): **Pass Customer Center's change plans configuration when loading expired transactions**
  *Symptoms*: ### Motivation When a subscription is expired, and we have filtered subscription by configuring `Configure switchable subscriptions` in the Customer Center, the filter wouldn't be applied.  ### Description Fix the bug. Pass the change plans configuration when loading expired subscriptions.  <!-- CURSOR_SUMMARY --> ---  > [!NOTE] > **Low Risk** > Low risk bug fix that only changes how `changePlans` configuration is passed when constructing purchase info for expired subscriptions; no auth or data persistence changes. >  > **Overview** > Fixes Customer Center subscription filtering for expired subscriptions by passing `configuration.changePlans` (instead of an empty list) when building `PurchaseInformation` for the most recent expired transaction. >  > This makes the *switchable subscriptions* / change-plan configuration apply consistently for both active and expired subscription displays. >  > <sup>Reviewed by [Cursor Bugbot](https://cursor.com/bugbot) for commit 99f3d68718dd7d396d4d0eaa64e9d9edb212df47. Bugbot is set up for automated code reviews on this repo. Configure [here](https://www.cursor.com/dashboard/bugbot).</sup> <!-- /CURSOR_SUMMARY -->

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

### Incident Patch 1: `aff909d6` (2026-10-05)
**Commit Message**: fix(customer-center): keep an explicit TupleView in the label row fallback (#7917)

Xcode 27 can make a multi-view builder block a TupleContent (iOS 26+).
On iOS 17 and 18 the app cannot find that type and crashes when
Customer Center opens.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `RevenueCatUI/CustomerCenter/Views/CompatibilityLabeledContent.swift` (modified, +3/-5)
```diff
@@ -78,11 +78,9 @@ struct CompatibilityLabeledContent<Label: View, Content: View>: View {
             }
         } else {
             HStack {
-                label()
-
-                Spacer()
-
-                content()
+                // Keep the explicit TupleView. Without it, Xcode 27 can make this block a TupleContent (iOS 26+),
+                // and the app crashes on older iOS.
+                TupleView((label(), Spacer(), content()))
             }
         }
     }
```

---

### Incident Patch 2: `b23e172a` (2026-10-05)
**Commit Message**: FIX(Paywalls) Custom Component not rendering in iOS 27 (#7897)

* attach to host correctly in iOS 27

* ensure the instance can be reused after a dismissal

**File**: `RevenueCatUI/Templates/V2/Components/WebView/WebViewComponentView.swift` (modified, +6/-0)
```diff
@@ -244,6 +244,12 @@ struct WebViewRepresentable: PlatformViewRepresentable {
                 instance?.reconcile(host: host)
             }
         }
+        // The first layout pass proves the host is really on screen; re-evaluate so the web view moves off
+        // a host that entered the window earlier but is never laid out.
+        host.onFirstLayout = { [weak instance] host in
+            guard host.window != nil else { return }
+            instance?.reconcile(host: host)
+        }
 
         return host
     }
```

**File**: `RevenueCatUI/Templates/V2/Components/WebView/WebViewInstance.swift` (modified, +42/-6)
```diff
@@ -156,22 +156,28 @@ final class WebViewInstance: ObservableObject {
         self.attachWebView(to: preferredHost)
     }
 
-    /// The candidate closest to its carousel's active page. Ties go to the host already showing the web
-    /// view, then to the host that entered the window first, so a replacement host mounted during a
-    /// redraw only takes over once the current host leaves.
+    /// The candidate closest to its carousel's active page. Among those, hosts that have been laid out
+    /// win over hosts that never have: `ViewThatFits` (see `scrollableIfNecessaryWhenAvailable`)
+    /// instantiates every branch, so the losing branch's host sits in the window without ever receiving
+    /// `layoutSubviews`; a web view parented there stays 0×0. Remaining ties go to the host already
+    /// showing the web view, then to the host that entered the window first, so a replacement host
+    /// mounted during a redraw only takes over once the current host leaves.
     private func preferredHost() -> WebViewHostView? {
         let candidates = self.candidateHosts.compactMap(\.host)
         guard let closestDistance = candidates.map(\.carouselDistance).min() else {
             return nil
         }
 
+        let closest = candidates.filter { $0.carouselDistance == closestDistance }
+        let laidOut = closest.filter(\.hasLaidOut)
+        let eligible = laidOut.isEmpty ? closest : laidOut
+
         if let attachedHost = self.attachedHost,
-           attachedHost.carouselDistance == closestDistance,
-           candidates.contains(where: { $0 === attachedHost }) {
+           eligible.contains(where: { $0 === attachedHost }) {
             return attachedHost
         }
 
-        return candidates.first { $0.carouselDistance == closestDistance }
+        return eligible.first
     }
 
     private func attachWebView(to host: WebViewHostView) {
@@ -273,30 +279,60 @@ final class WebViewInstance: ObservableObject {
 final class WebViewHostView: NSView {
 
     var onMoveToWindow: ((WebViewHostView) -> Void)?
+    /// Called the first time the host is laid out after entering a window, so the instance can prefer it
+    /// over hosts that never are.
+    var onFirstLayout: ((WebViewHostView) -> Void)?
 
     /// Distance from the active carousel page; `0` when active or not in a carousel. Closest host wins.
     var carouselDistance: Int = 0
 
+    /// Whether the host has gone through a layout pass since entering its current window. A host that
+    /// never does is not actually being displayed (for example the losing branch of a `ViewThatFits`).
+    private(set) var hasLaidOut = false
+
     override func viewDidMoveToWindow() {
         super.viewDidMoveToWindow()
+        self.hasLaidOut = false
         self.onMoveToWindow?(self)
     }
 
+    override func layout() {
+        super.layout()
+        guard !self.hasLaidOut else { return }
+        self.hasLaidOut = true
+        self.onFirstLayout?(self)
+    }
+
 }
 #else
 @available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
 final class WebViewHostView: UIView {
 
     var onMoveToWindow: ((WebViewHostView) -> Void)?
+    /// Called the first time the host is laid out after entering a window, so the instance can prefer it
+    /// over hosts that never are.
+    var onFirstLayout: ((WebViewHostView) -> Void)?
 
     /// Distance from the active carousel page; `0` when active or not in a carousel. Closest host wins.
     var carouselDistance: Int = 0
 
+    /// Whether the host has gone through a layout pass since entering its current window. A host that
+    /// never does is not actually being displayed (for example the losing branch of a `ViewThatFits`).
+    private(set) var hasLaidOut = false
+
     override func didMoveToWindow() {
         super.didMoveToWindow()
+        self.hasLaidOut = false
         self.onMoveToWindow?(self)
     }
 
+    override func layoutSubviews() {
+        super.layoutSubviews()
+        guard !self.hasLaidOut else { return }
+        self.hasLaidOut = true
+        self.onFirstLayout?(self)
+    }
+
 }
 #endif
 
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/WebViewInstanceTests.swift` (modified, +110/-0)
```diff
@@ -277,6 +277,105 @@ final class WebViewInstanceHostAttachmentTests: TestCase {
         XCTAssertTrue(webView.superview === displayed)
     }
 
+    // MARK: - Hosts that are never laid out
+
+    /// `ViewThatFits` instantiates every branch, so the losing branch's host can enter the window first
+    /// without ever being laid out. The host that actually lays out must take the web view from it.
+    func testLaidOutHostTakesTheWebViewFromAnEarlierHostThatIsNeverLaidOut() {
+        let instance = Self.makeInstance()
+        let webView = instance.webView { WKWebView(frame: .zero) }
+        let phantom = self.makeWindowedHost()
+        let displayed = self.makeWindowedHost()
+
+        instance.reconcile(host: phantom)
+        instance.reconcile(host: displayed)
+        XCTAssertTrue(webView.superview === phantom)
+
+        self.layOut(displayed)
+        instance.reconcile(host: displayed)
+
+        XCTAssertTrue(webView.superview === displayed)
+        XCTAssertFalse(phantom.hasLaidOut)
+        XCTAssertTrue(displayed.hasLaidOut)
+    }
+
+    /// A redraw mounts the incoming host before the outgoing one leaves; the outgoing host has been laid
+    /// out and the incoming one has not, so ownership must not move until the outgoing host leaves.
+    func testHostThatHasNotLaidOutCannotTakeTheWebViewFromALaidOutHost() {
+        let instance = Self.makeInstance()
+        let webView = instance.webView { WKWebView(frame: .zero) }
+        let outgoing = self.makeWindowedHost()
+        let incoming = self.makeWindowedHost()
+
+        instance.reconcile(host: outgoing)
+        self.layOut(outgoing)
+        instance.reconcile(host: outgoing)
+        instance.reconcile(host: incoming)
+
+        XCTAssertTrue(webView.superview === outgoing)
+    }
+
+    func testAttachedHostKeepsTheWebViewWhenBothHostsHaveLaidOut() {
+        let instance = Self.makeInstance()
+        let webView = instance.webView { WKWebView(frame: .zero) }
+        let displayed = self.makeWindowedHost()
+        let other = self.makeWindowedHost()
+
+        instance.reconcile(host: displayed)
+        self.layOut(displayed)
+        instance.reconcile(host: displayed)
+        self.layOut(other)
+        instance.reconcile(host: other)
+
+        XCTAssertTrue(webView.superview === displayed)
+    }
+
+    /// Carousel proximity still outranks layout state: the active page wins even before it lays out.
+    func testActiveCarouselPageOutranksALaidOutOffscreenCopy() {
+        let instance = Self.makeInstance()
+        let webView = instance.webView { WKWebView(frame: .zero) }
+        let offscreenCopy = self.makeWindowedHost(carouselDistance: 2)
+        let activeCopy = self.makeWindowedHost(carouselDistance: 0)
+
+        instance.reconcile(host: offscreenCopy)
+        self.layOut(offscreenCopy)
+        instance.reconcile(host: offscreenCopy)
+        instance.reconcile(host: activeCopy)
+
+        XCTAssertTrue(webView.superview === activeCopy)
+    }
+
+    func testHostReportsItsFirstLayoutOnce() {
+        let host = self.makeWindowedHost()
+        var reports = 0
+        host.onFirstLayout = { _ in reports += 1 }
+
+        self.layOut(host)
+        self.layOut(host)
+
+        XCTAssertTrue(host.hasLaidOut)
+        XCTAssertEqual(reports, 1)
+    }
+
+    func testHostReportsItsFirstLayoutAgainAfterReenteringWindow() throws {
+        let host = self.makeWindowedHost()
+        let container = try XCTUnwrap(host.superview)
+        var reports = 0
+        host.onFirstLayout = { _ in reports += 1 }
+
+        self.layOut(host)
+        host.removeFromSuperview()
+        container.addSubview(host)
+
+        XCTAssertFalse(host.hasLaidOut)
+
+        self.layOut(host)
+        self.layOut(host)
+
+        XCTAssertTrue(host.hasLaidOut)
+        XCTAssertEqual(reports, 2)
+    }
+
     // MARK: - Carousel copies
 
     /// In a looping carousel the off-screen copy at the start of the strip enters the window first; the
@@ -497,6 +596,17 @@ final class WebViewInstanceHostAttachmentTests: TestCase {
         return host
     }
 
+    /// Forces a layout pass on `host`, as UIKit/AppKit would for a host that is really on screen.
+    private func layOut(_ host: WebViewHostView) {
+        #if os(macOS)
+        host.needsLayout = true
+        host.layoutSubtreeIfNeeded()
+        #else
+        host.setNeedsLayout()
+        host.layoutIfNeeded()
+        #endif
+    }
+
 }
 
 #endif
```

---

### Incident Patch 3: `7b8b2b75` (2026-10-05)
**Commit Message**: fix(paywalls): report purchase cancellations without fetching CustomerInfo (#7895)

A cancellation only needed CustomerInfo to fill PurchaseResultData, so a failed fetch surfaced a dismissed hosted checkout as a purchase failure.

**File**: `RevenueCat.xcodeproj/project.pbxproj` (modified, +0/-4)
```diff
@@ -165,7 +165,6 @@
 		16E146AD2E99F3480089B609 /* TransactionNotifications.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16E146AB2E99F1E20089B609 /* TransactionNotifications.swift */; };
 		16E147A22F3B4C010089B609 /* PurchasesConfiguredNotifier.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16E147A12F3B4C010089B609 /* PurchasesConfiguredNotifier.swift */; };
 		16E147A42F3B4C010089B609 /* PurchasesUIService.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16E147A32F3B4C010089B609 /* PurchasesUIService.swift */; };
-		16E146B22E99FC7E0089B609 /* PurchaseResultComparator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16E146B12E99FC7E0089B609 /* PurchaseResultComparator.swift */; };
 		16E2B7F12EA01DFA00F04A7A /* SynchronizedLargeItemCacheTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16E2B7F02EA01DFA00F04A7A /* SynchronizedLargeItemCacheTests.swift */; };
 		16E4A3C89791426AAD027A49 /* PlatformInfoTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 043FB8686FEB4A31B9CF48C8 /* PlatformInfoTests.swift */; };
 		16F376262E93F1E300ADF649 /* LargeItemCacheTypeTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 16F376252E93F1E300ADF649 /* LargeItemCacheTypeTests.swift */; };
@@ -1918,7 +1917,6 @@
 		16E147A12F3B4C010089B609 /* PurchasesConfiguredNotifier.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PurchasesConfiguredNotifier.swift; sourceTree = "<group>"; };
 		16E147A32F3B4C010089B609 /* PurchasesUIService.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PurchasesUIService.swift; sourceTree = "<group>"; };
 		16E147A52F3B4C010089B609 /* PurchasesUIServiceTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PurchasesUIServiceTests.swift; sourceTree = "<group>"; };
-		16E146B12E99FC7E0089B609 /* PurchaseResultComparator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PurchaseResultComparator.swift; sourceTree = "<group>"; };
 		16E146B42E99FF640089B609 /* MockStoreTransaction.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MockStoreTransaction.swift; sourceTree = "<group>"; };
 		16E2B7F02EA01DFA00F04A7A /* SynchronizedLargeItemCacheTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SynchronizedLargeItemCacheTests.swift; sourceTree = "<group>"; };
 		16F376252E93F1E300ADF649 /* LargeItemCacheTypeTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LargeItemCacheTypeTests.swift; sourceTree = "<group>"; };
@@ -6416,7 +6414,6 @@
 				1699BC2C2EEB4DBC002001FB /* PaywallWarning.swift */,
 				0387D3C72EC51F09008E4A6B /* FileImageLoader.swift */,
 				16216FEE2EBB8641008ACFE9 /* ResumeAction.swift */,
-				16E146B12E99FC7E0089B609 /* PurchaseResultComparator.swift */,
 				57F7DAAA2D9E906100855622 /* RuntimeUtils.swift */,
 				358DECA22D9BEF85003B1CC0 /* EmergeRenderingMode.swift */,
 				353FDC102CA447270055F328 /* StoreProduct+Extensions.swift */,
@@ -9173,7 +9170,6 @@
 				2C7457242CE713E5004ACE52 /* PreviewMock.swift in Sources */,
 				77AABEA32F02B3340018C1D3 /* CustomerCenterViewControllerDelegate.swift in Sources */,
 				887A60812C1D037000E1A461 /* PaywallData+Default.swift in Sources */,
-				16E146B22E99FC7E0089B609 /* PurchaseResultComparator.swift in Sources */,
 				887A606A2C1D037000E1A461 /* TrialOrIntroEligibilityChecker.swift in Sources */,
 				4A6F3C012F5F123400ABCDE1 /* MarkdownUnderlineFormatter.swift in Sources */,
 				88B1BAEE2C813A3C001B7EE5 /* TextComponentView.swift in Sources */,
```

**File**: `RevenueCatUI/Helpers/PurchaseResultComparator.swift` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-//
-//  PurchaseResultComparator.swift
-//  RevenueCat
-//
-//  Created by Jacob Zivan Rakidzich on 10/10/25.
-//
-
-import Foundation
-@_spi(Internal) import RevenueCat
-
-enum PurchaseResultComparator {
-    static func compare(
-        _ lhs: PurchaseResultData?,
-        _ rhs: PurchaseResultData
-    ) -> Bool {
-        return lhs?.transaction == rhs.transaction &&
-            lhs?.userCancelled == rhs.userCancelled &&
-            lhs?.customerInfo == rhs.customerInfo
-    }
-}
```

**File**: `RevenueCatUI/PaywallView.swift` (modified, +1/-1)
```diff
@@ -526,7 +526,7 @@ struct LoadedOfferingPaywallView: View {
             .preference(key: PurchasedResultPreferenceKey.self,
                         value: .init(
                             data: self.purchaseHandler.sessionPurchaseResult,
-                            diffKey: (self.purchaseHandler.sessionPurchaseResult?.userCancelled == true) ?
+                            diffKey: self.purchaseHandler.sessionPurchaseResult == .cancelled ?
                             self.purchaseHandler.consecutiveCancellationRequestID : nil
                         ))
             .preference(key: RestoredCustomerInfoPreferenceKey.self,
```

**File**: `RevenueCatUI/Purchasing/PurchaseHandler.swift` (modified, +53/-56)
```diff
@@ -100,21 +100,16 @@ final class PurchaseHandler: ObservableObject {
     /// More extensible than a boolean - gives access to full result data for
     /// potential future exit offer triggers (e.g., based on specific products).
     @Published
-    fileprivate(set) var sessionPurchaseResult: PurchaseResultData? {
+    fileprivate(set) var sessionPurchaseResult: PaywallPurchaseResult? {
         willSet {
             if haveBothBeenCanceled(lhs: newValue, rhs: sessionPurchaseResult) {
                 self.consecutiveCancellationRequestID = UUID()
             }
         }
     }
 
-    private func haveBothBeenCanceled(lhs: PurchaseResultData?, rhs: PurchaseResultData?) -> Bool {
-        switch (lhs, rhs) {
-        case (nil, nil):
-            return false
-        case let (left, right):
-            return left?.userCancelled == true && right?.userCancelled == true
-        }
+    private func haveBothBeenCanceled(lhs: PaywallPurchaseResult?, rhs: PaywallPurchaseResult?) -> Bool {
+        return lhs == .cancelled && rhs == .cancelled
     }
 
     /// Unique identifier for the latest `consecutiveCancellationRequestID`.
@@ -137,14 +132,14 @@ final class PurchaseHandler: ObservableObject {
     /// Whether a purchase was successfully completed in the current session.
     /// Convenience property for checking if we should skip exit offers.
     var hasPurchasedInSession: Bool {
-        guard let result = sessionPurchaseResult else { return false }
-        return !result.userCancelled
+        guard case .purchased = sessionPurchaseResult else { return false }
+        return true
     }
 
     /// When a purchase completes, this will include the `CustomerInfo`
     /// associated to it IF RevenueCat is making the purchase.
     @Published
-    fileprivate(set) var purchaseResult: PurchaseResultData?
+    fileprivate(set) var purchaseResult: PaywallPurchaseResult?
 
     /// When `purchasesAreCompletedBy` is `.myApp`, this is the app-defined
     /// callback method that performs the purchase
@@ -214,7 +209,8 @@ final class PurchaseHandler: ObservableObject {
         self.performRestore = performRestore
 
         purchaseResultPublisher
-            .removeDuplicates(by: PurchaseResultComparator.compare)
+            .map(PaywallPurchaseResult.init)
+            .removeDuplicates()
             .receive(on: RunLoop.main)
             .sink { [weak self] result in
                 self?.setResult(result)
@@ -262,8 +258,8 @@ final class PurchaseHandler: ObservableObject {
         )
     }
 
-    private func setResult(_ result: PurchaseResultData) {
-        guard !PurchaseResultComparator.compare(purchaseResult, result) else {
+    private func setResult(_ result: PaywallPurchaseResult) {
+        guard result != self.purchaseResult else {
             return
         }
         self.purchaseResult = result
@@ -822,13 +818,11 @@ extension PurchaseHandler {
         if let paywallEvent { self.track(paywallEvent) }
 
         do {
-            let result: PurchaseResultData
+            let result = PaywallPurchaseResult(try await self.purchases.purchase(package: package,
+                                                                                 promotionalOffer: promotionalOffer,
+                                                                                 paywallEvent: paywallEvent))
 
-            result = try await self.purchases.purchase(package: package,
-                                                       promotionalOffer: promotionalOffer,
-                                                       paywallEvent: paywallEvent)
-
-            if result.userCancelled {
+            if result == .cancelled {
                 self.trackCancelledPurchase(package: package)
             }
 
@@ -891,9 +885,12 @@ extension PurchaseHandler {
             throw error
         }
 
-        let resultInfo: PurchaseResultData = (transaction: nil,
-                                             customerInfo: try await self.purchases.customerInfo(),
-                                            userCancelled: result.userCancelled)
+        let resultInfo: PaywallPurchaseResult
+        if result.userCancelled {
+            resultInfo = .cancelled
+        } else {
+            resultInfo = .purchased(transaction: nil, customerInfo: try await self.purchases.customerInfo())
+        }
 
         // Set sessionPurchaseResult BEFORE setResult so that handleMainPaywallDismiss
         // sees the correct state when the sheet dismisses.
@@ -916,7 +913,7 @@ extension PurchaseHandler {
     /// the `CustomerInfo` fetched when confirming it.
     @MainActor
     func handleHostedCheckoutPurchase(customerInfo: CustomerInfo) {
-        self.reportHostedCheckoutOutcome(customerInfo: customerInfo, userCancelled: false)
+        self.reportHostedCheckoutOutcome(.purchased(transaction: nil, customerInfo: customerInfo))
     }
 
     /// Reports a checkout that failed, as opposed to one the customer walked away fro
```

**File**: `RevenueCatUI/Templates/V2/PaywallsV2View.swift` (modified, +1/-1)
```diff
@@ -417,7 +417,7 @@ struct PaywallsV2View: View {
             .preference(key: PurchasedResultPreferenceKey.self,
                         value: .init(
                             data: self.purchaseHandler.sessionPurchaseResult,
-                            diffKey: (self.purchaseHandler.sessionPurchaseResult?.userCancelled == true) ?
+                            diffKey: self.purchaseHandler.sessionPurchaseResult == .cancelled ?
                             self.purchaseHandler.consecutiveCancellationRequestID : nil
                         ))
             .preference(key: RestoredCustomerInfoPreferenceKey.self,
```

**File**: `RevenueCatUI/View+PresentPaywall.swift` (modified, +2/-3)
```diff
@@ -763,9 +763,8 @@ private struct PresentingPaywallModifier: ViewModifier {
         }
 
         // Check shouldDisplay with the purchase result if available
-        if let purchaseResult = self.purchaseHandler.sessionPurchaseResult,
-           !purchaseResult.userCancelled,
-           !self.shouldDisplay(purchaseResult.customerInfo) {
+        if case let .purchased(_, customerInfo)? = self.purchaseHandler.sessionPurchaseResult,
+           !self.shouldDisplay(customerInfo) {
             self.purchaseHandler.trackPaywallClose()
             self.purchaseHandler.resetForNewSession()
             self.onDismiss?()
```

**File**: `RevenueCatUI/View+PurchaseRestoreCompleted.swift` (modified, +3/-3)
```diff
@@ -554,8 +554,8 @@ private struct OnPurchaseCompletedModifier: ViewModifier {
     func body(content: Content) -> some View {
         content
             .onPreferenceChange(PurchasedResultPreferenceKey.self) { result in
-                if let result, !result.userCancelled {
-                    self.handler(result.transaction, result.customerInfo)
+                if case let .purchased(transaction, customerInfo)? = result?.result {
+                    self.handler(transaction, customerInfo)
                 }
             }
     }
@@ -574,7 +574,7 @@ private struct OnPurchaseCancelledModifier: ViewModifier {
     func body(content: Content) -> some View {
         content
             .onPreferenceChange(PurchasedResultPreferenceKey.self) { result in
-                if let result, result.userCancelled {
+                if result?.result == .cancelled {
                     self.handler()
                 }
             }
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/HostedCheckoutTests.swift` (modified, +1/-2)
```diff
@@ -253,8 +253,7 @@ final class HostedCheckoutTests: TestCase {
 
         handler.handleHostedCheckoutPurchase(customerInfo: TestData.customerInfo)
 
-        expect(handler.sessionPurchaseResult?.userCancelled) == false
-        expect(handler.sessionPurchaseResult?.customerInfo) == TestData.customerInfo
+        expect(handler.sessionPurchaseResult) == .purchased(transaction: nil, customerInfo: TestData.customerInfo)
         expect(handler.purchaseError).to(beNil())
     }
 
```

---

### Incident Patch 4: `9644d736` (2026-10-01)
**Commit Message**: other(paywalls): extract prototype skeleton UI (#7873)

* other(paywalls): add prototype skeleton transform

* other(paywalls): add skeleton rendering support

* fix(paywalls): include skeleton files in Xcode project

* refactor(paywalls): simplify skeleton styling

**File**: `RevenueCat.xcodeproj/project.pbxproj` (modified, +8/-0)
```diff
@@ -1106,6 +1106,8 @@
 		80CDB7B62E69C35100D7DB9E /* CustomerCenterStylingUtilities.swift in Sources */ = {isa = PBXBuildFile; fileRef = 80CDB7B52E69C35100D7DB9E /* CustomerCenterStylingUtilities.swift */; };
 		80E80EF226970E04008F245A /* ReceiptFetcher.swift in Sources */ = {isa = PBXBuildFile; fileRef = 80E80EF026970DC3008F245A /* ReceiptFetcher.swift */; };
 		81BD918A48974816AEEF22C6 /* WorkflowStepEventTracker.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5E8F7749E65DE2FD7FDCB105 /* WorkflowStepEventTracker.swift */; };
+		8218F275D8114FE8A8A5C481 /* WorkflowSkeleton.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5F2A7E65C54B49218B63ED11 /* WorkflowSkeleton.swift */; };
+		8218F275D8114FE8A8A5C482 /* WorkflowSkeletonShimmer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5F2A7E65C54B49218B63ED12 /* WorkflowSkeletonShimmer.swift */; };
 		830003FF2E26162000143F9F /* PlatformFont.swift in Sources */ = {isa = PBXBuildFile; fileRef = 830003FE2E26161D00143F9F /* PlatformFont.swift */; };
 		830004012E261AC100143F9F /* PlatformImage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 830004002E261ABE00143F9F /* PlatformImage.swift */; };
 		831660B62E3AAA4E00855312 /* FixMacButtonsModifier.swift in Sources */ = {isa = PBXBuildFile; fileRef = 831660B52E3AAA4900855312 /* FixMacButtonsModifier.swift */; };
@@ -2833,6 +2835,8 @@
 		5A8F581105413FA192D2446A /* AccessorOperators.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = AccessorOperators.swift; sourceTree = "<group>"; };
 		5C3DF79A7BCAA00FD8DCBD07 /* PublishedWorkflowCodableTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PublishedWorkflowCodableTests.swift; sourceTree = "<group>"; };
 		5E8F7749E65DE2FD7FDCB105 /* WorkflowStepEventTracker.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = WorkflowStepEventTracker.swift; sourceTree = "<group>"; };
+		5F2A7E65C54B49218B63ED11 /* WorkflowSkeleton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WorkflowSkeleton.swift; sourceTree = "<group>"; };
+		5F2A7E65C54B49218B63ED12 /* WorkflowSkeletonShimmer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WorkflowSkeletonShimmer.swift; sourceTree = "<group>"; };
 		61F92C8B490F4B78AC8B1AAF /* ErrorCode+Conformances.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "ErrorCode+Conformances.swift"; sourceTree = "<group>"; };
 		64FEF3704AAACD669F3BF4E0 /* BackendTokenLoginTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BackendTokenLoginTests.swift; sourceTree = "<group>"; };
 		65279ABC122869A50AEB8A27 /* ExitOffer.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = ExitOffer.swift; sourceTree = "<group>"; };
@@ -4109,6 +4113,7 @@
 				88B1BAE72C813A3C001B7EE5 /* PaywallComponentTypeTransformers.swift */,
 				2C08B3342CDD16550024857B /* PaywallComponentViewModel.swift */,
 				DB1FC9502F9A1B23009A95EA /* WorkflowScreenMapper.swift */,
+				5F2A7E65C54B49218B63ED11 /* WorkflowSkeleton.swift */,
 				6A10AD61D82EB73FC5338DA2 /* WorkflowNavigator.swift */,
 				5E8F7749E65DE2FD7FDCB105 /* WorkflowStepEventTracker.swift */,
 				323A476D8518423CBF843BE1 /* WorkflowStepEventCoordinator.swift */,
@@ -6752,6 +6757,7 @@
 				2C7457432CEA6470004ACE52 /* Components */,
 				2C7457222CE713DA004ACE52 /* Previews */,
 				800A129055A298C390AED0B5 /* WorkflowPaywallView.swift */,
+				5F2A7E65C54B49218B63ED12 /* WorkflowSkeletonShimmer.swift */,
 				AB70B73749FDB04A429A0E13 /* Layout */,
 			);
 			path = V2;
@@ -9406,6 +9412,8 @@
 				97B9F00926E0977B0DAAD7D7 /* EnvironmentValues+Workflow.swift in Sources */,
 				150BEBF14F59182317CDA8DA /* WorkflowContext.swift in Sources */,
 				C53CDAA4FC3E6B51CC70D724 /* WorkflowPaywallView.swift in Sources */,
+				8218F275D8114FE8A8A5C481 /* WorkflowSkeleton.swift in Sources */,
+				8218F275D8114FE8A8A5C482 /* WorkflowSkeletonShimmer.swift in Sources */,
 				C1311C20A12B3813D86A2EDF /* WorkflowPreview.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
```

**File**: `RevenueCatUI/Templates/V2/Components/ComponentsView.swift` (modified, +3/-0)
```diff
@@ -68,15 +68,18 @@ struct ComponentsView: View {
             )
         case .text(let viewModel):
             TextComponentView(viewModel: viewModel)
+                .workflowSkeletonShimmer()
         case .image(let viewModel):
             ImageComponentView(viewModel: viewModel)
+                .workflowSkeletonShimmer()
         case .icon(let viewModel):
             IconComponentView(viewModel: viewModel)
         case .stack(let viewModel):
             StackComponentView(
                 viewModel: viewModel,
                 onDismiss: onDismiss
             )
+            .workflowSkeletonShimmer()
         case .button(let viewModel):
             ButtonComponentView(viewModel: viewModel, onDismiss: onDismiss)
         case .package(let viewModel):
```

**File**: `RevenueCatUI/Templates/V2/Components/Image/ImageComponentView.swift` (modified, +53/-34)
```diff
@@ -77,6 +77,18 @@ struct ImageComponentView: View {
     @Environment(\.requestSizeCalculation)
     private var requestSizeCalculation
 
+    #if ENABLE_WORKFLOW_BRANCH_LOADING
+    @Environment(\.redactionReasons) private var redactionReasons
+    #endif
+
+    private var isSkeletonPlaceholder: Bool {
+        #if ENABLE_WORKFLOW_BRANCH_LOADING
+        return self.redactionReasons.contains(.placeholder)
+        #else
+        return false
+        #endif
+    }
+
     let viewModel: ImageComponentViewModel
 
     var renderForPreview: Bool {
@@ -138,49 +150,56 @@ struct ImageComponentView: View {
                             self.decorate(Color.clear, with: style)
                         }
 
-                        switch plan.content {
-                        case .none:
-                            EmptyView()
-                        case .preview:
-                            #if DEBUG
+                        if self.isSkeletonPlaceholder {
                             self.decorate(
-                                self.renderImage(
-                                    DualColorImageGenerator.purpleOrangeWide.image.resizable(),
-                                    effectiveSize ?? .zero,
-                                    maxWidth: Self.calculateMaxWidth(
-                                        parentWidth: effectiveSize?.width ?? 0,
-                                        style: style
-                                    ),
-                                    with: style
-                                ),
+                                Color.clear.aspectRatio(self.aspectRatio(style: style), contentMode: .fit),
                                 with: style
                             )
-                            #else
-                            EmptyView()
-                            #endif
-                        case .image:
-                            self.decorate(
-                                RemoteImage(
-                                    url: style.url,
-                                    lowResUrl: style.lowResUrl,
-                                    darkUrl: style.darkUrl,
-                                    darkLowResUrl: style.darkLowResUrl,
-                                    // The expectedSize is important
-                                    // It renders a clear image if actual image is being fetched
-                                    expectedSize: expectedSize
-                                ) { (image, size) in
+                        } else {
+                            switch plan.content {
+                            case .none:
+                                EmptyView()
+                            case .preview:
+                                #if DEBUG
+                                self.decorate(
                                     self.renderImage(
-                                        image,
-                                        size,
+                                        DualColorImageGenerator.purpleOrangeWide.image.resizable(),
+                                        effectiveSize ?? .zero,
                                         maxWidth: Self.calculateMaxWidth(
                                             parentWidth: effectiveSize?.width ?? 0,
                                             style: style
                                         ),
                                         with: style
-                                    )
-                                },
-                                with: style
-                            )
+                                    ),
+                                    with: style
+                                )
+                                #else
+                                EmptyView()
+                                #endif
+                            case .image:
+                                self.decorate(
+                                    RemoteImage(
+                                        url: style.url,
+                                        lowResUrl: style.lowResUrl,
+                                        darkUrl: style.darkUrl,
+                                        darkLowResUrl: style.darkLowResUrl,
+                                        // The expectedSize is important
+                                        // It renders a clear image if actual image is being fetched
+                                        expectedSize: expectedSize
+                                    ) { (image, size) in
+                                        self.renderImage(
+                                            image,
+                                            size,
+                                            maxWidth: Self.calculateMaxWidth(
+                                                parentWidth: effectiveSize?.width ?? 0,
+                                                style: style
+                                            )
```

**File**: `RevenueCatUI/Templates/V2/Components/Text/TextComponentView.swift` (modified, +8/-0)
```diff
@@ -60,6 +60,10 @@ struct TextComponentView: View {
     @Environment(\.dynamicTypeSize)
     private var dynamicTypeSize
 
+    #if ENABLE_WORKFLOW_BRANCH_LOADING
+    @Environment(\.redactionReasons) private var redactionReasons
+    #endif
+
     @Environment(\.isPaywallLoading)
     private var isPaywallLoading
 
@@ -116,7 +120,11 @@ struct TextComponentView: View {
                     .fixedSize(horizontal: false, vertical: true)
                     .multilineTextAlignment(style.textAlignment)
                     .foregroundColorScheme(style.color)
+                    #if ENABLE_WORKFLOW_BRANCH_LOADING
+                    .redacted(reason: isPaywallLoading ? .placeholder : self.redactionReasons)
+                    #else
                     .redacted(reason: isPaywallLoading ? .placeholder : [])
+                    #endif
                     .padding(style.padding)
                     .size(style.size,
                           horizontalAlignment: style.horizontalAlignment)
```

**File**: `RevenueCatUI/Templates/V2/ViewModelHelpers/WorkflowSkeleton.swift` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+//
+//  Copyright RevenueCat Inc. All Rights Reserved.
+//
+//  Licensed under the MIT License (the "License");
+//  you may not use this file except in compliance with the License.
+//  You may obtain a copy of the License at
+//
+//      https://opensource.org/licenses/MIT
+//
+//  WorkflowSkeleton.swift
+
+import Foundation
+@_spi(Internal) import RevenueCat
+
+#if !os(tvOS) && ENABLE_WORKFLOW_BRANCH_LOADING
+
+struct WorkflowSkeleton {
+
+    private let tone: PaywallComponent.ColorScheme
+    private let colors: [String: PaywallComponent.ColorScheme]
+
+    static func transform(
+        _ data: PaywallComponentsData,
+        colors: [String: PaywallComponent.ColorScheme]
+    ) -> PaywallComponentsData {
+        let background = Self.backgroundColor(data.componentsConfig.base.background)
+        let light = Self.brightness(background.light, colors: colors, dark: false)
+        let dark = Self.brightness(background.dark ?? background.light, colors: colors, dark: true)
+        let transform = Self(
+            tone: .init(light: light < 0.5 ? Self.darkPlaceholderColor : Self.lightPlaceholderColor,
+                        dark: dark < 0.5 ? Self.darkPlaceholderColor : Self.lightPlaceholderColor),
+            colors: colors
+        )
+        let base = data.componentsConfig.base
+        var copy = data
+        copy.exitOffers = nil
+        copy.componentsConfig = .init(base: .init(
+            stack: transform.stack(base.stack),
+            header: base.header.map { .init(stack: transform.stack($0.stack)) },
+            stickyFooter: base.stickyFooter.map { .init(stack: transform.stack($0.stack)) },
+            background: .color(background)
+        ))
+        return copy
+    }
+
+    private func stack(
+        _ stack: PaywallComponent.StackComponent,
+        contentHidden: Bool = false,
+        forceBlock: Bool = false
+    ) -> PaywallComponent.StackComponent {
+        let isBlock = forceBlock || self.hasFill(stack.background, color: stack.backgroundColor, border: stack.border)
+        return .init(
+            visible: stack.visible,
+            components: stack.components.compactMap { self.component($0, contentHidden: contentHidden || isBlock) },
+            dimension: stack.dimension,
+            size: stack.size,
+            spacing: stack.spacing,
+            backgroundColor: isBlock && !contentHidden ? self.tone : nil,
+            padding: stack.padding,
+            margin: stack.margin,
+            shape: stack.shape,
+            border: stack.border.map { .init(color: contentHidden ? Self.clear : self.tone, width: $0.width) },
+            overflow: stack.overflow
+        )
+    }
+
+    // Invisible content still measures fit-sized blocks, without showing their labels.
+    // swiftlint:disable:next cyclomatic_complexity
+    private func component(_ component: PaywallComponent, contentHidden: Bool = false) -> PaywallComponent? {
+        switch component {
+        case let .text(text):
+            guard text.fontSize >= 14 || contentHidden else { return nil }
+            return .text(.init(
+                visible: text.visible, text: text.text, fontName: text.fontName, fontWeight: text.fontWeight,
+                color: contentHidden ? Self.clear : self.tone,
+                size: text.size, padding: text.padding, margin: text.margin,
+                fontSize: text.fontSize, horizontalAlignment: text.horizontalAlignment,
+                fontWeightInt: text.fontWeightInt
+            ))
+        case let .stack(stack):
+            return .stack(self.stack(stack, contentHidden: contentHidden))
+        case let .button(button):
+            guard button.visible != false else { return nil }
+            return .stack(self.stack(button.stack, contentHidden: contentHidden))
+        case let .package(package):
+            guard package.visible != false else { return nil }
+            return .stack(self.stack(package.stack, contentHidden: contentHidden, forceBlock: true))
+        case let .purchaseButton(button):
+            return .stack(self.stack(button.stack, contentHidden: contentHidden, forceBlock: true))
+        case let .stickyFooter(footer):
+            return .stack(self.stack(footer.stack, contentHidden: contentHidden))
+        case let .image(image):
+            return .image(self.image(image, contentHidden: contentHidden))
+        case let .video(video):
+            return .image(self.image(.init(
+                visible: video.visible,
+                source: .init(light: Self.imageSource(video.source.light),
+                              dark: video.source.dark.map(Self.imageSource)),
+                size: video.size, fitMode: video.fitMode, maskShape: video.maskShape,
+                padding: video.padding, margin: video.margin, border: video.border
+            ), contentHidden: contentHidden))
+        case let .tabs(tabs):
+            return .stack(self.stack(.init(
+                visible: tabs.
```

**File**: `RevenueCatUI/Templates/V2/WorkflowSkeletonShimmer.swift` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+//
+//  Copyright RevenueCat Inc. All Rights Reserved.
+//
+//  Licensed under the MIT License (the "License");
+//  you may not use this file except in compliance with the License.
+//  You may obtain a copy of the License at
+//
+//      https://opensource.org/licenses/MIT
+//
+//  WorkflowSkeletonShimmer.swift
+
+import SwiftUI
+
+#if !os(tvOS)
+
+@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
+extension View {
+
+    @ViewBuilder
+    func workflowSkeletonShimmer() -> some View {
+        #if ENABLE_WORKFLOW_BRANCH_LOADING
+        self.modifier(WorkflowSkeletonShimmer())
+        #else
+        self
+        #endif
+    }
+
+}
+
+#if ENABLE_WORKFLOW_BRANCH_LOADING
+
+@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
+struct WorkflowSkeletonShimmer: ViewModifier {
+
+    @Environment(\.workflowSkeletonShimmerEnabled) private var isEnabled
+    @Environment(\.accessibilityReduceMotion) private var reduceMotion
+    @State private var isAnimating = false
+
+    @ViewBuilder
+    func body(content: Content) -> some View {
+        if self.isEnabled && !self.reduceMotion {
+            content
+                .environment(\.workflowSkeletonShimmerEnabled, false)
+                .overlay {
+                    GeometryReader { proxy in
+                        LinearGradient(
+                            colors: [.clear, .white.opacity(0.04), .clear],
+                            startPoint: .leading,
+                            endPoint: .trailing
+                        )
+                        .frame(width: proxy.size.width)
+                        .offset(x: self.isAnimating ? proxy.size.width : -proxy.size.width)
+                        .animation(.linear(duration: 2.4).repeatForever(autoreverses: false), value: self.isAnimating)
+                        .onAppear { self.isAnimating = true }
+                    }
+                    .clipped()
+                    .blendMode(.sourceAtop)
+                    .allowsHitTesting(false)
+                    .accessibilityHidden(true)
+                }
+                // Isolate the blend so the shimmer only affects this component's visible pixels.
+                .compositingGroup()
+        } else {
+            content
+        }
+    }
+
+    fileprivate struct EnabledKey: EnvironmentKey {
+
+        static let defaultValue = false
+
+    }
+
+}
+
+@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
+extension EnvironmentValues {
+
+    var workflowSkeletonShimmerEnabled: Bool {
+        get { self[WorkflowSkeletonShimmer.EnabledKey.self] }
+        set { self[WorkflowSkeletonShimmer.EnabledKey.self] = newValue }
+    }
+
+}
+
+#endif
+
+#endif
```

---

### Incident Patch 5: `6df37680` (2026-09-30)
**Commit Message**: Run RevenueCatUI tests on macOS in CI (#7869)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `.circleci/default_config.yml` (modified, +37/-0)
```diff
@@ -967,6 +967,33 @@ jobs:
           path: fastlane/test_output
           destination: scan-test-output
 
+  spm-revenuecat-ui-macos:
+    executor:
+      name: macos-executor
+      xcode_version: "27.0.0"
+    steps:
+      - checkout
+      # xcbeautify not needed: test_revenuecatui uses xcodebuild directly
+      # which uses xcpretty
+      - install-dependencies:
+          install_xcbeautify: false
+      - update-spm-installation-commit
+      - run:
+          name: SPM RevenueCatUI Tests
+          command: bundle exec fastlane test_revenuecatui
+          no_output_timeout: 15m
+          environment:
+            PLATFORM: macOS
+            BUILD_SDK: macosx
+      - compress_result_bundle:
+          directory: fastlane/test_output
+          bundle_name: revenuecatui
+      - store_test_results:
+          path: fastlane/test_output/revenuecatui/tests.xml
+      - store_artifacts:
+          path: fastlane/test_output
+          destination: scan-test-output
+
   run-test-tvos-and-macos:
     executor:
       name: macos-executor
@@ -2469,6 +2496,11 @@ workflows:
             - approve-full-tests
           context:
             - slack-secrets
+      - spm-revenuecat-ui-macos:
+          requires:
+            - approve-full-tests
+          context:
+            - slack-secrets
       # Needs no context: the paywall under test is a local sample, so no API key is involved.
       - run-paywall-accessibility-ui-tests:
           requires:
@@ -2570,6 +2602,7 @@ workflows:
             - spm-revenuecat-ui-ios-16
             - run-revenuecat-ui-ios-18-and-17
             - spm-revenuecat-ui-watchos
+            - spm-revenuecat-ui-macos
             - run-paywall-accessibility-ui-tests
             - record-and-upload-paywalls-v1-snapshots
             - record-and-upload-paywalls-v2-snapshots
@@ -2872,6 +2905,9 @@ workflows:
       - spm-revenuecat-ui-watchos:
           context:
             - slack-secrets
+      - spm-revenuecat-ui-macos:
+          context:
+            - slack-secrets
       - record-and-upload-paywalls-v1-snapshots:
           context:
             - slack-secrets
@@ -2950,6 +2986,7 @@ workflows:
             - spm-revenuecat-ui-ios-16
             - run-revenuecat-ui-ios-18-and-17
             - spm-revenuecat-ui-watchos
+            - spm-revenuecat-ui-macos
             - record-and-upload-paywalls-v1-snapshots
             - installation-tests-all-but-carthage
             - installation-tests-carthage
```

**File**: `.circleci/generate-requested-jobs-config.js` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ const JOBS = {
   "spm-receipt-parser": ["slack-secrets"],
   "spm-revenuecat-ui-ios-15": ["slack-secrets"],
   "spm-revenuecat-ui-ios-16": ["slack-secrets"],
+  "spm-revenuecat-ui-macos": ["slack-secrets"],
   "spm-revenuecat-ui-watchos": ["slack-secrets"],
 };
 
```

**File**: `Tests/RevenueCatUITests/Data/LocalizedAlertErrorTests.swift` (modified, +5/-0)
```diff
@@ -38,7 +38,12 @@ class LocalizedAlertErrorCodeTests: TestCase {
     }
 
     func testFailureReason() {
+        #if os(macOS)
+        expect(Self.error.failureReason) == "Error 2: There was a problem with the App Store. " +
+            "This could also indicate the purchase dialog was cancelled."
+        #else
         expect(Self.error.failureReason) == "Error 2: There was a problem with the App Store."
+        #endif
     }
 
 }
```

**File**: `Tests/RevenueCatUITests/Data/PaywallDataValidationTests.swift` (modified, +5/-0)
```diff
@@ -17,6 +17,9 @@ import Nimble
 import SnapshotTesting
 import XCTest
 
+// Legacy paywalls are unsupported on macOS, so validation always fails there.
+#if !os(macOS)
+
 @available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
 class PaywallDataValidationTests: TestCase {
 
@@ -348,3 +351,5 @@ private extension PaywallDataValidationTests {
     )
 
 }
+
+#endif
```

**File**: `Tests/RevenueCatUITests/Helpers/DataExtensions.swift` (modified, +2/-2)
```diff
@@ -79,9 +79,9 @@ extension PaywallData {
     var withLocalImages: Self {
         var copy = self
         #if SWIFT_PACKAGE
-        copy.assetBaseURL = URL(fileURLWithPath: Bundle.module.bundlePath)
+        copy.assetBaseURL = URL(fileURLWithPath: Bundle.module.resourcePath ?? Bundle.module.bundlePath)
         #else
-        copy.assetBaseURL = URL(fileURLWithPath: Bundle.revenueCatUI.bundlePath)
+        copy.assetBaseURL = URL(fileURLWithPath: Bundle.revenueCatUI.resourcePath ?? Bundle.revenueCatUI.bundlePath)
         #endif
         copy.config.images = .init(header: "header.heic",
                                    background: "background.heic",
```

**File**: `fastlane/Fastfile` (modified, +1/-1)
```diff
@@ -1005,7 +1005,7 @@ platform :ios do
       xcodebuild(
         workspace: '.',
         scheme: 'RevenueCatUI',
-        destination: "platform=" + platform + ",name=" + destination,
+        destination: platform == 'macOS' ? "platform=macOS" : "platform=" + platform + ",name=" + destination,
         sdk: sdk,
         result_bundle_path: 'fastlane/test_output/revenuecatui.xcresult',
         report_formats: [:junit],
```

---

### Incident Patch 6: `a5803795` (2026-09-29)
**Commit Message**: Chore(Paywalls): Add DEBUG-only JSON paywall preview renderer (#7746)

* Add a DEBUG-only JSON paywall preview renderer

Extract the local-JSON paywall preview used by min/max sizing work into a
reusable helper so future PRs can render dashboard PaywallComponentsData
strings in Xcode previews without shipping that code in release SDK builds.

Co-authored-by: jacob.rakidzich <[REDACTED_EMAIL]>

* Ignore SwiftLint function_parameter_count on preview package helper

The DEBUG-only preview renderer failed CI lint because the private package factory takes six parameters.

Co-authored-by: jacob.rakidzich <[REDACTED_EMAIL]>

* Fix sample paywall JSON so preview decoding does not fall back

The iOS decoder records missing revision/padding/margin in errorInfo instead
of throwing, which made the sample preview render the default paywall overlay.

Co-authored-by: jacob.rakidzich <[REDACTED_EMAIL]>

* undo accidental commit

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: jacob.rakidzich <[REDACTED_EMAIL]>

**File**: `RevenueCat.xcodeproj/project.pbxproj` (modified, +6/-0)
```diff
@@ -233,6 +233,7 @@
 		2C0B98CD2797070B00C5874F /* PromotionalOffer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C0B98CC2797070B00C5874F /* PromotionalOffer.swift */; };
 		2C2AEB0F2CA64E0E00A50F38 /* Template1Preview.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C2AEB0E2CA64E0E00A50F38 /* Template1Preview.swift */; };
 		832A761DBC4EA873D769CB83 /* WindowSizeConditionsPreview.swift in Sources */ = {isa = PBXBuildFile; fileRef = 527C8FDAD4BC0E20186FB251 /* WindowSizeConditionsPreview.swift */; };
+		D9F5B2C38E6A51A9B4D2FA13 /* PaywallPreviewRenderer.swift in Sources */ = {isa = PBXBuildFile; fileRef = C8E4A1B27D5F4098A3C1E902 /* PaywallPreviewRenderer.swift */; };
 		9FDCB2854C16420D876A9751 /* WorkflowSheetRelativeDiscountPreview.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9FDCB2854C16420D876A9752 /* WorkflowSheetRelativeDiscountPreview.swift */; };
 		2C2AEB3B2CA7209F00A50F38 /* PaywallPackageComponent.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C2AEB3A2CA7209F00A50F38 /* PaywallPackageComponent.swift */; };
 		2C2AEB3F2CA7235300A50F38 /* PaywallPurchaseButtonComponent.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C2AEB3E2CA7235300A50F38 /* PaywallPurchaseButtonComponent.swift */; };
@@ -1992,6 +1993,8 @@
 		2C0B98CC2797070B00C5874F /* PromotionalOffer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PromotionalOffer.swift; sourceTree = "<group>"; };
 		2C2AEB0E2CA64E0E00A50F38 /* Template1Preview.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Template1Preview.swift; sourceTree = "<group>"; };
 		527C8FDAD4BC0E20186FB251 /* WindowSizeConditionsPreview.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WindowSizeConditionsPreview.swift; sourceTree = "<group>"; };
+		C8E4A1B27D5F4098A3C1E902 /* PaywallPreviewRenderer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PaywallPreviewRenderer.swift; sourceTree = "<group>"; };
+		E0A6C3D49F7B62BAC5E30B24 /* PaywallPreviewRendererTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PaywallPreviewRendererTests.swift; sourceTree = "<group>"; };
 		9FDCB2854C16420D876A9752 /* WorkflowSheetRelativeDiscountPreview.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WorkflowSheetRelativeDiscountPreview.swift; sourceTree = "<group>"; };
 		D793578E154692425D9938B6 /* WindowSizeConditionTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WindowSizeConditionTests.swift; sourceTree = "<group>"; };
 		4B90A3E17C25D8F1206BA442 /* PaywallWindowSizeMeasurementTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PaywallWindowSizeMeasurementTests.swift; sourceTree = "<group>"; };
@@ -3701,6 +3704,7 @@
 				F4A8C1D25E3B47A9B0D6E718 /* MixedTabsDefaultPackageVisibilityTests.swift */,
 				DBB32F183007CACD00A86DC7 /* BottomSheetSwitchTests.swift */,
 				A5C7E90130F8000100ABCDEF /* SizeModifierTests.swift */,
+				E0A6C3D49F7B62BAC5E30B24 /* PaywallPreviewRendererTests.swift */,
 				DB1FC9592F9A1B74009A95EA /* WorkflowScreenMapperTests.swift */,
 				F468C7BCEB786BEC80277ECA /* WorkflowNavigatorTests.swift */,
 				C07759C930F712D2D53B9333 /* WorkflowStepEventTrackerTests.swift */,
@@ -4040,6 +4044,7 @@
 			isa = PBXGroup;
 			children = (
 				2C7457232CE713E5004ACE52 /* PreviewMock.swift */,
+				C8E4A1B27D5F4098A3C1E902 /* PaywallPreviewRenderer.swift */,
 				2C2AEB0D2CA64DA900A50F38 /* TemplateComponentsViewPreviews */,
 				DB8C95132F900E2A00FCEE6B /* SafeAreaPreviewShell.swift */,
 			);
@@ -9168,6 +9173,7 @@
 				577132B92E4CE43A003A0CBD /* NoSubscriptionsCardViewModel.swift in Sources */,
 				2C2AEB0F2CA64E0E00A50F38 /* Template1Preview.swift in Sources */,
 				832A761DBC4EA873D769CB83 /* WindowSizeConditionsPreview.swift in Sources */,
+				D9F5B2C38E6A51A9B4D2FA13 /* PaywallPreviewRenderer.swift in Sources */,
 				9FDCB2854C16420D876A9751 /* WorkflowSheetRelativeDiscountPreview.swift in Sources */,
 				88A543E32C37A4970039C6A5 /* Template7View.swift in Sources */,
 				2C91068C2CE22D4F00189565 /* JustifyContent.swift in Sources */,
```

**File**: `RevenueCatUI/Templates/V2/Previews/PaywallPreviewRenderer.swift` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+//
+//  Copyright RevenueCat Inc. All Rights Reserved.
+//
+//  Licensed under the MIT License (the "License");
+//  you may not use this file except in compliance with the License.
+//  You may obtain a copy of the License at
+//
+//      https://opensource.org/licenses/MIT
+//
+//  PaywallPreviewRenderer.swift
+//
+//  Renders a Paywalls V2 preview from a local JSON string. This entire file is compiled only in
+//  DEBUG (non-release) SDK builds so dashboard fixtures can be pasted into previews without
+//  shipping in production.
+
+import Foundation
+@_spi(Internal) import RevenueCat
+import StoreKit
+import SwiftUI
+
+#if DEBUG && !os(tvOS)
+
+/// Loads `PaywallComponentsData` JSON and builds a preview `Offering`.
+///
+/// Usage in a future PR:
+/// ```swift
+/// struct MyFeature_Previews: PreviewProvider {
+///     static var previews: some View {
+///         PaywallPreviewFromJSON(json: Self.json)
+///             .previewLayout(.fixed(width: 402, height: 800))
+///             .previewDisplayName("My feature")
+///     }
+///
+///     static let json = #"""
+///     { ... paywall components JSON ... }
+///     """#
+/// }
+/// ```
+@available(iOS 15.0, macOS 12.0, watchOS 8.0, *)
+enum PaywallPreviewRenderer {
+
+    struct Fixture {
+        let offering: Offering
+        let paywallComponents: Offering.PaywallComponents
+    }
+
+    enum LoadingError: LocalizedError {
+        case decoding(Error)
+        case paywallErrors(String)
+
+        var errorDescription: String? {
+            switch self {
+            case .decoding(let error):
+                return "Unable to decode paywall preview JSON: \(error.localizedDescription)"
+            case .paywallErrors(let details):
+                return "Unable to decode paywall preview JSON:\n\(details)"
+            }
+        }
+    }
+
+    /// Dashboard-shaped `PaywallComponentsData` JSON for the sample preview and unit tests.
+    /// Includes required fields (`revision`, `padding`, `margin`) so the resilient decoder
+    /// does not record `errorInfo` and fall back to the default paywall.
+    static let sampleJSON = """
+    {
+      "template_name": "components",
+      "asset_base_url": "https://assets.pawwalls.com",
+      "revision": 1,
+      "default_locale": "en_US",
+      "components_config": {
+        "base": {
+          "background": {
+            "type": "color",
+            "value": {
+              "light": { "type": "hex", "value": "#ffffffff" }
+            }
+          },
+          "stack": {
+            "type": "stack",
+            "components": [
+              {
+                "type": "text",
+                "text_lid": "title",
+                "color": {
+                  "light": { "type": "hex", "value": "#111111ff" }
+                },
+                "font_size": 24,
+                "font_weight": "bold",
+                "horizontal_alignment": "center",
+                "size": {
+                  "width": { "type": "fit" },
+                  "height": { "type": "fit" }
+                },
+                "padding": { "leading": 0, "trailing": 0, "top": 0, "bottom": 0 },
+                "margin": { "leading": 0, "trailing": 0, "top": 0, "bottom": 0 }
+              }
+            ],
+            "size": {
+              "width": { "type": "fill" },
+              "height": { "type": "fit" }
+            },
+            "dimension": {
+              "type": "vertical",
+              "alignment": "center",
+              "distribution": "center"
+            },
+            "padding": { "leading": 0, "trailing": 0, "top": 0, "bottom": 0 },
+            "margin": { "leading": 0, "trailing": 0, "top": 0, "bottom": 0 }
+          }
+        }
+      },
+      "components_localizations": {
+        "en_US": { "title": "JSON paywall preview" }
+      }
+    }
+    """
+
+    static func load(
+        json: String,
+        offeringIdentifier: String = "json-preview",
+        serverDescription: String = "JSON paywall preview",
+        packages: [Package]? = nil,
+        uiConfig: UIConfig = PreviewUIConfig.make()
+    ) throws -> Fixture {
+        let decoder = JSONDecoder()
+        decoder.keyDecodingStrategy = .convertFromSnakeCase
+        decoder.dateDecodingStrategy = .iso8601
+
+        let jsonData = Data(json.utf8)
+        let data: PaywallComponentsData
+        do {
+            data = try decoder.decode(PaywallComponentsData.self, from: jsonData)
+        } catch {
+            throw LoadingError.decoding(error)
+        }
+
+        if let errorInfo = data.errorInfo, !errorInfo.isEmpty {
+            let details = errorInfo
+                .map { "\($0.key): \($0.value)" }
+                .sorted()
+                .joined(separator: "\n")
+            throw LoadingError.paywallErrors(details)
+        }
+
+        let paywallComponents = Offering.PaywallComponents(uiConfig: uiConfig, data: data)
+        let resolvedPackages = packages ?? self.defaultPacka
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/PaywallPreviewRendererTests.swift` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+//
+//  Copyright RevenueCat Inc. All Rights Reserved.
+//
+//  Licensed under the MIT License (the "License");
+//  you may not use this file except in compliance with the License.
+//  You may obtain a copy of the License at
+//
+//      https://opensource.org/licenses/MIT
+//
+//  PaywallPreviewRendererTests.swift
+
+import Nimble
+@_spi(Internal) @testable import RevenueCat
+@_spi(Internal) @testable import RevenueCatUI
+import XCTest
+
+#if DEBUG && !os(tvOS)
+
+@available(iOS 15.0, macOS 12.0, watchOS 8.0, *)
+final class PaywallPreviewRendererTests: TestCase {
+
+    func testLoadDecodesSampleJSONIntoOffering() throws {
+        let fixture = try PaywallPreviewRenderer.load(json: PaywallPreviewRenderer.sampleJSON)
+
+        expect(fixture.offering.identifier) == "json-preview"
+        expect(fixture.offering.serverDescription) == "JSON paywall preview"
+        expect(fixture.offering.availablePackages).to(haveCount(3))
+        expect(fixture.offering.availablePackages.map(\.identifier)) == [
+            "$rc_weekly",
+            "$rc_monthly",
+            "$rc_annual"
+        ]
+        expect(fixture.paywallComponents.data.templateName) == "components"
+        expect(fixture.paywallComponents.data.defaultLocale) == "en_US"
+        expect(fixture.paywallComponents.data.revision) == 1
+        expect(fixture.paywallComponents.data.errorInfo).to(beNil())
+        expect(
+            fixture.paywallComponents.data.componentsLocalizations["en_US"]?["title"]
+        ) == .string("JSON paywall preview")
+    }
+
+    func testLoadUsesCustomOfferingIdentifierAndPackages() throws {
+        let fixture = try PaywallPreviewRenderer.load(
+            json: PaywallPreviewRenderer.sampleJSON,
+            offeringIdentifier: "custom-offering",
+            serverDescription: "Custom",
+            packages: []
+        )
+
+        expect(fixture.offering.identifier) == "custom-offering"
+        expect(fixture.offering.serverDescription) == "Custom"
+        expect(fixture.offering.availablePackages).to(beEmpty())
+    }
+
+    func testLoadThrowsOnInvalidJSON() {
+        expect {
+            try PaywallPreviewRenderer.load(json: "{ not-json")
+        }.to(throwError())
+    }
+
+    func testLoadIgnoresUnknownDashboardKeys() throws {
+        let json = """
+        {
+          "template_name": "components",
+          "asset_base_url": "https://assets.pawwalls.com",
+          "revision": 1,
+          "generated_by": "dashboard",
+          "published_revision": 9,
+          "components_config": {
+            "base": {
+              "background": {
+                "type": "color",
+                "value": { "light": { "type": "hex", "value": "#ffffffff" } }
+              },
+              "stack": {
+                "type": "stack",
+                "components": [],
+                "size": { "width": { "type": "fill" }, "height": { "type": "fit" } },
+                "dimension": {
+                  "type": "vertical",
+                  "alignment": "center",
+                  "distribution": "center"
+                },
+                "padding": { "leading": 0, "trailing": 0, "top": 0, "bottom": 0 },
+                "margin": { "leading": 0, "trailing": 0, "top": 0, "bottom": 0 }
+              }
+            }
+          },
+          "components_localizations": { "en_US": {} },
+          "default_locale": "en_US"
+        }
+        """
+
+        let fixture = try PaywallPreviewRenderer.load(json: json, packages: [])
+        expect(fixture.paywallComponents.data.templateName) == "components"
+        expect(fixture.paywallComponents.data.errorInfo).to(beNil())
+    }
+
+    func testLoadThrowsWhenRequiredComponentFieldsAreMissing() {
+        let json = """
+        {
+          "template_name": "components",
+          "asset_base_url": "https://assets.pawwalls.com",
+          "components_config": {
+            "base": {
+              "background": {
+                "type": "color",
+                "value": { "light": { "type": "hex", "value": "#ffffffff" } }
+              },
+              "stack": {
+                "type": "stack",
+                "components": [],
+                "size": { "width": { "type": "fill" }, "height": { "type": "fit" } },
+                "dimension": {
+                  "type": "vertical",
+                  "alignment": "center",
+                  "distribution": "center"
+                }
+              }
+            }
+          },
+          "components_localizations": { "en_US": {} },
+          "default_locale": "en_US"
+        }
+        """
+
+        expect {
+            try PaywallPreviewRenderer.load(json: json, packages: [])
+        }.to(throwError())
+    }
+
+}
+
+#endif
```

---

### Incident Patch 7: `6df6cd67` (2026-09-29)
**Commit Message**: Fix(paywalls) Crash on logout (#7836)

* address crash

* add test

* update comment

* update compile flags used around new function

* Apply suggestion from @JZDesign

**File**: `RevenueCatUI/Cache/WebViewWebsiteDataStoreSweeper.swift` (modified, +14/-1)
```diff
@@ -42,7 +42,7 @@ final class WebViewWebsiteDataStoreSweeper: WebViewDataStoreSweeping {
 
     #if DEBUG
 
-    // Test initializer - Invoking WebKit APIs in the unit test suite crashes
+    // Test initializer - for mocking and spying WebKit APIs
     init(
         idStore: WebViewDataStoreIdentifierStore = .init(),
         existingIdentifiers: (@MainActor () async -> Set<UUID>)? = nil,
@@ -98,6 +98,7 @@ final class WebViewWebsiteDataStoreSweeper: WebViewDataStoreSweeping {
         #if compiler(>=5.9) && !os(tvOS) && !os(watchOS) && canImport(WebKit)
         // Compiler 5.9 is beyond Xcode 14. Even with the following guard 👇 Xcode 14 fails to compile
         if #available(iOS 17.0, macOS 14.0, *) {
+            ensureWebKitIsReady()
             return Set(await WKWebsiteDataStore.allDataStoreIdentifiers)
         }
         #endif
@@ -111,6 +112,7 @@ final class WebViewWebsiteDataStoreSweeper: WebViewDataStoreSweeping {
         // Compiler 5.9 is beyond Xcode 14. Even with the following guard 👇 Xcode 14 fails to compile
         if #available(iOS 17.0, macOS 14.0, *) {
             do {
+                ensureWebKitIsReady()
                 try await WKWebsiteDataStore.remove(forIdentifier: identifier)
                 return true
             } catch {
@@ -123,4 +125,15 @@ final class WebViewWebsiteDataStoreSweeper: WebViewDataStoreSweeping {
         return true
     }
 
+    #if compiler(>=5.9) && !os(tvOS) && !os(watchOS) && canImport(WebKit)
+    // There are certain cases where a consuming application will invoke the cache clearing path in our SDK
+    // before a data store is initialized. In those cases, our SDK can crash with a EXC_BAD_ACCESS when attempting
+    // to interact with the WebKit API. By creating one, we can ensure that the crash never happens, and we can
+    // clear the retired store. 
+    // reported in: https://github.com/RevenueCat/purchases-ios/issues/7830
+    @MainActor
+    private static func ensureWebKitIsReady() {
+        _ = WKWebsiteDataStore.default()
+    }
+    #endif
 }
```

**File**: `Tests/RevenueCatUITests/Cache/WebViewWebsiteDataStoreSweeperTests.swift` (modified, +14/-0)
```diff
@@ -78,6 +78,20 @@ final class WebViewWebsiteDataStoreSweeperTests: TestCase {
         XCTAssertTrue(store.pendingRemovalIdentifiers().isEmpty)
     }
 
+    #if compiler(>=5.9) && !os(tvOS) && !os(watchOS) && canImport(WebKit)
+    @available(iOS 17.0, macOS 14.0, *)
+    func testProductionSweeperDoesNotCrashBeforeWebKitIsInitialized() async throws {
+        let store = try self.makeStore()
+        _ = store.identifier()
+        store.retireCurrentIdentifier()
+        let sweeper = WebViewWebsiteDataStoreSweeper(store: store)
+
+        await sweeper.sweepStores()
+
+        XCTAssertTrue(store.pendingRemovalIdentifiers().isEmpty)
+    }
+    #endif
+
     func testSweepStoresRemovesClearedIdentifiersFromPending() async throws {
         let store = try self.makeStore()
         let first = store.identifier()
```

---

### Incident Patch 8: `cd40d73b` (2026-09-29)
**Commit Message**: Fix iOS AdMob capture method (#7844)

* fix: identify iOS AdMob capture method

* Remove legacy capture method deprecation warning

* Restore legacy capture method deprecation

**File**: `AdapterSDKs/RevenueCatAdMob/Sources/RevenueCatAdMob/RewardVerification/RewardedAds+RewardVerification.swift` (modified, +1/-1)
```diff
@@ -203,7 +203,7 @@ internal extension RewardVerification.CapableAd {
                 await Purchases.shared.pollRewardVerification(
                     clientTransactionID: clientTransactionID,
                     trackingMetadata: trackingMetadata,
-                    captureMethod: .adapter
+                    captureMethod: .iosAdMobAdapter
                 )
             }
 
```

**File**: `AdapterSDKs/RevenueCatAdMob/Sources/RevenueCatAdMob/Tracking/PurchasesTracker.swift` (modified, +5/-5)
```diff
@@ -18,19 +18,19 @@ internal extension Tracking {
         var isConfigured: Bool { Purchases.isConfigured }
 
         func trackAdLoaded(_ data: AdLoaded) {
-            Purchases.shared.adTracker.trackAdLoaded(data, captureMethod: .adapter)
+            Purchases.shared.adTracker.trackAdLoaded(data, captureMethod: .iosAdMobAdapter)
         }
         func trackAdDisplayed(_ data: AdDisplayed) {
-            Purchases.shared.adTracker.trackAdDisplayed(data, captureMethod: .adapter)
+            Purchases.shared.adTracker.trackAdDisplayed(data, captureMethod: .iosAdMobAdapter)
         }
         func trackAdOpened(_ data: AdOpened) {
-            Purchases.shared.adTracker.trackAdOpened(data, captureMethod: .adapter)
+            Purchases.shared.adTracker.trackAdOpened(data, captureMethod: .iosAdMobAdapter)
         }
         func trackAdRevenue(_ data: AdRevenue) {
-            Purchases.shared.adTracker.trackAdRevenue(data, captureMethod: .adapter)
+            Purchases.shared.adTracker.trackAdRevenue(data, captureMethod: .iosAdMobAdapter)
         }
         func trackAdFailedToLoad(_ data: AdFailedToLoad) {
-            Purchases.shared.adTracker.trackAdFailedToLoad(data, captureMethod: .adapter)
+            Purchases.shared.adTracker.trackAdFailedToLoad(data, captureMethod: .iosAdMobAdapter)
         }
 
     }
```

**File**: `Sources/Ads/Events/AdEvent.swift` (modified, +7/-2)
```diff
@@ -33,11 +33,16 @@ internal protocol AdImpressionEventData: AdEventData {
     var impressionId: String { get }
 }
 
-/// Identifies the mechanism that emitted an ad event. The SDK only ever emits these two values;
-/// pre-feature versions send nothing, which the backend treats as `unknown`.
+/// Identifies the mechanism that emitted an ad event.
+/// Pre-feature versions send nothing, which the backend treats as `unknown`.
 @_spi(Internal) public enum AdEventCaptureMethod: String, Codable, Sendable {
 
+    /// Auto-captured by the official RevenueCat Google AdMob adapter for iOS.
+    case iosAdMobAdapter = "ios_admob_adapter"
+
     /// Auto-captured by an official RevenueCat ad-network adapter.
+    /// Retained so events stored by older adapter versions can still be decoded and sent.
+    @available(*, deprecated, message: "Use iosAdMobAdapter instead.")
     case adapter
 
     /// Reported via the public `trackAd*` tracking API.
```

**File**: `Sources/Purchasing/Purchases/Purchases.swift` (modified, +1/-1)
```diff
@@ -2032,7 +2032,7 @@ extension Purchases {
     }
 
     /// Adapter entry point: identical to the public overload, but lets an official RevenueCat
-    /// ad-network adapter stamp `captureMethod: .adapter` on the tracked events instead of `.manual`.
+    /// ad-network adapter stamp `captureMethod: .iosAdMobAdapter` on the tracked events instead of `.manual`.
     @_spi(Internal) public func pollRewardVerification(
         clientTransactionID: String,
         trackingMetadata: RewardedAdTrackingMetadata?,
```

**File**: `Tests/UnitTests/Ads/Events/AdEventsRequestTests.swift` (modified, +10/-3)
```diff
@@ -291,17 +291,24 @@ class AdFeatureEventsRequestTests: TestCase {
 
     // MARK: - Capture method
 
-    func testAdapterCaptureMethodIsSerialized() throws {
+    func testIOSAdMobAdapterCaptureMethodIsSerialized() throws {
         let creationData = AdEvent.CreationData(
             id: .init(uuidString: "72164C05-2BDC-4807-8918-A4105F727DEB")!,
             date: .init(timeIntervalSince1970: 1694029328),
-            captureMethod: .adapter
+            captureMethod: .iosAdMobAdapter
         )
         let event = AdEvent.displayed(creationData, Self.eventData)
         let storedEvent = try Self.createStoredAdEvent(from: event)
         let requestEvent = try XCTUnwrap(AdEventsRequest.AdEventRequest(storedEvent: storedEvent))
 
-        expect(requestEvent.captureMethod) == "adapter"
+        expect(requestEvent.captureMethod) == "ios_admob_adapter"
+    }
+
+    func testLegacyAdapterCaptureMethodCanStillBeDeserialized() throws {
+        let data = try XCTUnwrap("\"adapter\"".data(using: .utf8))
+        let captureMethod = try JSONDecoder.default.decode(AdEventCaptureMethod.self, from: data)
+
+        expect(captureMethod.rawValue) == "adapter"
     }
 
     func testCaptureMethodIsOmittedForLegacyStoredEvent() throws {
```

**File**: `Tests/UnitTests/Ads/Events/PurchasesAdEventsTests.swift` (modified, +10/-10)
```diff
@@ -188,7 +188,7 @@ class PurchasesAdEventsTests: BasePurchasesTests {
             rewardVerificationEnabled: true
         )
 
-        self.purchases.adTracker.trackAdRewardEarnedUnverified(data, captureMethod: .adapter)
+        self.purchases.adTracker.trackAdRewardEarnedUnverified(data, captureMethod: .iosAdMobAdapter)
 
         await expect { try await self.mockEventsManager.trackedAdEvents }.toEventually(haveCount(1))
 
@@ -218,7 +218,7 @@ class PurchasesAdEventsTests: BasePurchasesTests {
             impressionId: "impression-123"
         )
 
-        self.purchases.adTracker.trackAdRewardVerified(data, captureMethod: .adapter)
+        self.purchases.adTracker.trackAdRewardVerified(data, captureMethod: .iosAdMobAdapter)
 
         await expect { try await self.mockEventsManager.trackedAdEvents }.toEventually(haveCount(1))
 
@@ -248,7 +248,7 @@ class PurchasesAdEventsTests: BasePurchasesTests {
             failureReason: .backendError(reason: nil)
         )
 
-        self.purchases.adTracker.trackAdRewardFailedToVerify(data, captureMethod: .adapter)
+        self.purchases.adTracker.trackAdRewardFailedToVerify(data, captureMethod: .iosAdMobAdapter)
 
         await expect { try await self.mockEventsManager.trackedAdEvents }.toEventually(haveCount(1))
 
@@ -279,7 +279,7 @@ class PurchasesAdEventsTests: BasePurchasesTests {
             reward: .virtualCurrency(code: "GOLD", amount: 100)
         )
 
-        self.purchases.adTracker.trackAdRewardGranted(data, captureMethod: .adapter)
+        self.purchases.adTracker.trackAdRewardGranted(data, captureMethod: .iosAdMobAdapter)
 
         await expect { try await self.mockEventsManager.trackedAdEvents }.toEventually(haveCount(1))
 
@@ -320,7 +320,7 @@ class PurchasesAdEventsTests: BasePurchasesTests {
         expect(trackedEvents.first?.creationData.captureMethod) == .manual
     }
 
-    func testAdapterEntryPointStampsAdapterCaptureMethod() async throws {
+    func testAdapterEntryPointStampsIOSAdMobAdapterCaptureMethod() async throws {
         let displayedData = AdDisplayed(
             networkName: "AdMob",
             mediatorName: .adMob,
@@ -329,15 +329,15 @@ class PurchasesAdEventsTests: BasePurchasesTests {
             impressionId: "impression-123"
         )
 
-        self.purchases.adTracker.trackAdDisplayed(displayedData, captureMethod: .adapter)
+        self.purchases.adTracker.trackAdDisplayed(displayedData, captureMethod: .iosAdMobAdapter)
 
         await expect { try await self.mockEventsManager.trackedAdEvents }.toEventually(haveCount(1))
 
         let trackedEvents = try await self.mockEventsManager.trackedAdEvents
-        expect(trackedEvents.first?.creationData.captureMethod) == .adapter
+        expect(trackedEvents.first?.creationData.captureMethod) == .iosAdMobAdapter
     }
 
-    func testRewardTrackingStampsAdapterCaptureMethod() async throws {
+    func testRewardTrackingStampsIOSAdMobAdapterCaptureMethod() async throws {
         let data = AdRewardVerified(
             networkName: "AdMob",
             mediatorName: .adMob,
@@ -347,12 +347,12 @@ class PurchasesAdEventsTests: BasePurchasesTests {
             impressionId: "impression-123"
         )
 
-        self.purchases.adTracker.trackAdRewardVerified(data, captureMethod: .adapter)
+        self.purchases.adTracker.trackAdRewardVerified(data, captureMethod: .iosAdMobAdapter)
 
         await expect { try await self.mockEventsManager.trackedAdEvents }.toEventually(haveCount(1))
 
         let trackedEvents = try await self.mockEventsManager.trackedAdEvents
-        expect(trackedEvents.first?.creationData.captureMethod) == .adapter
+        expect(trackedEvents.first?.creationData.captureMethod) == .iosAdMobAdapter
     }
 
 }
```

---

### Incident Patch 9: `17d852e8` (2026-09-28)
**Commit Message**: Fix customer center survey title wrapping on iOS 26 (#7843)

Co-authored-by: Facundo Menzella <[REDACTED_EMAIL]>

**File**: `RevenueCatUI/CustomerCenter/Views/FeedbackSurveyView.swift` (modified, +1/-0)
```diff
@@ -116,6 +116,7 @@ struct FeedbackSurveyView: View {
                         .font(.headline)
                         .multilineTextAlignment(.center)
                         .lineLimit(2)
+                        .fixedSize(horizontal: false, vertical: true)
                 }
             })
         }
```

---

### Incident Patch 10: `e14ffc91` (2026-09-25)
**Commit Message**: Fix Paywalls V2 picking a random regional locale (#7835)

A hyphenated preferred locale (en-GB) never matched an underscored paywall key (en_GB), and the same-language fallback depended on dictionary iteration order, so paywalls with multiple regional variants of a language showed a random one per launch. Match within a language using Bundle.preferredLocalizations over a sorted candidate list.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `RevenueCatUI/Data/Localization.swift` (modified, +11/-6)
```diff
@@ -318,16 +318,21 @@ extension Locale {
 
     /// Selects the best-matching locale from `availableLocales` given `preferredLocales`.
     ///
-    /// Matches on language first, then exact region within language matches.
+    /// Matches on language first, then picks the closest region/script within language matches.
     /// Returns `nil` if no language match exists for any preferred locale.
     static func selectPreferredLocale(from availableLocales: [Locale],
                                       preferredLocales: [Locale]) -> Locale? {
         for preferred in preferredLocales {
-            guard let languageMatch = availableLocales.first(where: {
-                $0.languageCodeIdentifier == preferred.languageCodeIdentifier
-            }) else { continue }
-            // Prefer an exact locale match (language + region) over a language-only match.
-            return availableLocales.first(where: { $0 == preferred }) ?? languageMatch
+            let languageMatches = availableLocales
+                .filter { $0.languageCodeIdentifier == preferred.languageCodeIdentifier }
+                .sorted { $0.identifier < $1.identifier }
+            guard let firstMatch = languageMatches.first else { continue }
+
+            let bestIdentifier = Bundle.preferredLocalizations(
+                from: languageMatches.map(\.identifier),
+                forPreferences: [preferred.identifier]
+            ).first
+            return languageMatches.first { $0.identifier == bestIdentifier } ?? firstMatch
         }
         return nil
     }
```

**File**: `Tests/RevenueCatUITests/LocalizationTests.swift` (modified, +25/-0)
```diff
@@ -632,4 +632,29 @@ class PaywallsV2LocaleResolutionTests: TestCase {
         expect(chosen) == Locale(identifier: "fr_FR")
     }
 
+    func testRegionalMatchIgnoresSeparatorAndKeyOrder() {
+        let cases: [(available: [String], preferred: String, expected: String)] = [
+            (["en_AU", "en_CA", "en_GB", "en_US"], "en-GB", "en_GB"),
+            (["en_AU", "en_CA", "en_GB", "en_US"], "en_GB", "en_GB"),
+            (["en_AU", "en_CA", "en_GB", "en_US"], "en-IE", "en_GB"),
+            (["zh_Hans", "zh_Hant"], "zh-Hant-TW", "zh_Hant"),
+            (["zh_Hans", "zh_Hant"], "zh-Hans-CN", "zh_Hans"),
+            (["pt_BR", "pt_PT"], "pt-PT", "pt_PT"),
+            (["es_ES", "es_MX"], "es-MX", "es_MX")
+        ]
+
+        for testCase in cases {
+            for available in [testCase.available, testCase.available.reversed()] {
+                let chosen = Locale.selectPreferredLocale(
+                    from: available.map(Locale.init(identifier:)),
+                    preferredLocales: [Locale(identifier: testCase.preferred)]
+                )
+                expect(chosen).to(
+                    equal(Locale(identifier: testCase.expected)),
+                    description: "\(testCase.preferred) from \(available)"
+                )
+            }
+        }
+    }
+
 }
```

---

### Incident Patch 11: `d766fd3e` (2026-09-25)
**Commit Message**: fix(customerinfo): notify observers when active entitlements change (#7820)

**File**: `Sources/Identity/CustomerInfoManager.swift` (modified, +14/-4)
```diff
@@ -379,14 +379,24 @@ class CustomerInfoManager {
                 return
             }
 
-            guard !$0.customerInfoObserversByIdentifier.isEmpty, lastSentCustomerInfo != customerInfo else {
+            guard !$0.customerInfoObserversByIdentifier.isEmpty else {
                 return
             }
 
-            if $0.lastSentCustomerInfo != nil {
-                Logger.debug(Strings.customerInfo.sending_updated_customerinfo_to_delegate)
-            } else {
+            let activeEntitlementsChanged = lastSentCustomerInfo.map {
+                Set($0.entitlements.active.keys) != Set(customerInfo.entitlements.active.keys)
+            } ?? false
+
+            guard lastSentCustomerInfo != customerInfo || activeEntitlementsChanged else {
+                return
+            }
+
+            if lastSentCustomerInfo == nil {
                 Logger.debug(Strings.customerInfo.sending_latest_customerinfo_to_delegate)
+            } else if lastSentCustomerInfo == customerInfo {
+                Logger.debug(Strings.customerInfo.sending_customerinfo_with_changed_active_entitlements_to_delegate)
+            } else {
+                Logger.debug(Strings.customerInfo.sending_updated_customerinfo_to_delegate)
             }
 
             $0.lastSentCustomerInfo = customerInfo
```

**File**: `Sources/Logging/Strings/CustomerInfoStrings.swift` (modified, +3/-0)
```diff
@@ -36,6 +36,7 @@ enum CustomerInfoStrings {
     case updating_request_date(CustomerInfo, Date)
     case sending_latest_customerinfo_to_delegate
     case sending_updated_customerinfo_to_delegate
+    case sending_customerinfo_with_changed_active_entitlements_to_delegate
     case vending_cache
     case error_encoding_customerinfo(Error)
 
@@ -93,6 +94,8 @@ extension CustomerInfoStrings: LogMessage {
             return "Sending latest CustomerInfo to delegate."
         case .sending_updated_customerinfo_to_delegate:
             return "Sending updated CustomerInfo to delegate."
+        case .sending_customerinfo_with_changed_active_entitlements_to_delegate:
+            return "Sending CustomerInfo to delegate: active entitlements changed since last update."
         case .vending_cache:
             return "Vending CustomerInfo from cache."
         case let .error_encoding_customerinfo(error):
```

**File**: `Tests/UnitTests/Identity/CustomerInfoManagerTests.swift` (modified, +41/-0)
```diff
@@ -761,6 +761,47 @@ class CustomerInfoManagerTests: BaseCustomerInfoManagerTests {
         expect(self.customerInfoManagerLastCustomerInfoChange) == (old: self.mockCustomerInfo, new: newCustomerInfo)
     }
 
+    func testCacheCustomerInfoSendsUpdateWhenEntitlementExpiresWithOnlyRequestDateChanged() throws {
+        let now = Date()
+        let expirationDate = ISO8601DateFormatter.default.string(from: now.addingTimeInterval(60 * 60))
+        let activeInfo = try CustomerInfo(data: [
+            "request_date": ISO8601DateFormatter.default.string(from: now),
+            "subscriber": [
+                "original_app_user_id": Self.appUserID,
+                "first_seen": "2019-06-17T16:05:33Z",
+                "subscriptions": [
+                    "monthly": [
+                        "expires_date": expirationDate,
+                        "purchase_date": "2019-06-26T23:45:40Z",
+                        "store": "app_store"
+                    ] as [String: Any]
+                ],
+                "non_subscriptions": [:] as [String: Any],
+                "entitlements": [
+                    "pro": [
+                        "product_identifier": "monthly",
+                        "expires_date": expirationDate,
+                        "purchase_date": "2019-06-26T23:45:40Z"
+                    ] as [String: Any]
+                ]
+            ] as [String: Any]
+        ])
+        let expiredInfo = activeInfo.copy(with: now.addingTimeInterval(2 * 60 * 60))
+
+        expect(activeInfo) == expiredInfo
+        expect(activeInfo.entitlements.active.keys).to(contain("pro"))
+        expect(expiredInfo.entitlements.active).to(beEmpty())
+
+        self.customerInfoManager.cache(customerInfo: activeInfo, appUserID: Self.appUserID)
+        expect(self.customerInfoManagerChangesCallCount).toEventually(equal(1))
+
+        self.customerInfoManager.cache(customerInfo: expiredInfo, appUserID: Self.appUserID)
+
+        expect(self.customerInfoManagerChangesCallCount).toEventually(equal(2))
+        expect(self.customerInfoManagerLastCustomerInfoChange?.new.entitlements.active).to(beEmpty())
+        expect(self.customerInfoManager.lastSentCustomerInfo) === expiredInfo
+    }
+
     func testCacheCustomerInfoSendsToDelegateIfAppUserIDIsCurrent() {
         self.mockCurrentUserProvider = MockCurrentUserProvider(mockAppUserID: "myUser")
         self.customerInfoManager.currentUserProvider = self.mockCurrentUserProvider
```

---

### Incident Patch 12: `06cd8c17` (2026-09-23)
**Commit Message**: other: Add trace_id to the checkpoint hit event (#7811)

* Add trace_id to the checkpoint hit event

The id is created when the checkpoint is evaluated and handed to the workflow it
starts, so the hit, the workflow's step and paywall events and the receipt's
paywall trace_id all share it.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Drop Android references from trace id comments

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Remove remaining Android references in workflow event comments

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `RevenueCatUI/Checkpoints/WorkflowPresenter.swift` (modified, +2/-1)
```diff
@@ -182,7 +182,8 @@ final class WorkflowPresenter: NSObject, WorkflowPresenterType {
             workflow: presentation.workflow.workflow,
             offerings: presentation.workflow.offerings,
             uiConfig: presentation.workflow.uiConfig,
-            workflowBlobRef: presentation.workflow.workflowBlobRef
+            workflowBlobRef: presentation.workflow.workflowBlobRef,
+            traceId: presentation.workflow.traceId
         )
         let viewController = PaywallViewController(
             workflowContext: workflowContext,
```

**File**: `RevenueCatUI/Purchasing/PurchaseHandler.swift` (modified, +4/-2)
```diff
@@ -664,7 +664,8 @@ extension PurchaseHandler {
         uiConfig: UIConfig,
         allOfferings: Offerings,
         presentedOfferingContext: PresentedOfferingContext?,
-        workflowBlobRef: String? = nil
+        workflowBlobRef: String? = nil,
+        traceId: String? = nil
     ) throws -> WorkflowContext {
         guard let step = workflow.steps[workflow.initialStepId] else {
             throw PaywallError.workflowInitialStepNotFound(
@@ -714,7 +715,8 @@ extension PurchaseHandler {
             allOfferings: allOfferings,
             initialOffering: offering,
             presentedOfferingContext: presentedOfferingContext,
-            workflowBlobRef: workflowBlobRef
+            workflowBlobRef: workflowBlobRef,
+            traceId: traceId
         )
     }
     #endif
```

**File**: `RevenueCatUI/Purchasing/WorkflowContext.swift` (modified, +5/-1)
```diff
@@ -28,16 +28,20 @@ import Foundation
     /// Package context from `singleStepFallbackId`, precomputed because it is stable for a workflow.
     let workflowPackageContext: WorkflowPackageContext?
     let workflowBlobRef: String?
+    /// Set when a checkpoint started the workflow, so its events join the checkpoint hit.
+    let traceId: String?
 
     init(
         workflow: PublishedWorkflow,
         uiConfig: UIConfig,
         allOfferings: Offerings,
         initialOffering: Offering,
         presentedOfferingContext: PresentedOfferingContext?,
-        workflowBlobRef: String? = nil
+        workflowBlobRef: String? = nil,
+        traceId: String? = nil
     ) {
         self.workflowBlobRef = workflowBlobRef
+        self.traceId = traceId
         self.workflow = workflow
         self.uiConfig = uiConfig
         self.allOfferings = allOfferings
```

**File**: `RevenueCatUI/Purchasing/WorkflowPreview.swift` (modified, +8/-4)
```diff
@@ -31,14 +31,16 @@ import Foundation
             variableConfig: .init(variableCompatibilityMap: [:], functionCompatibilityMap: [:])
         ),
         presentedOfferingContext: PresentedOfferingContext? = nil,
-        workflowBlobRef: String? = nil
+        workflowBlobRef: String? = nil,
+        traceId: String? = nil
     ) throws -> WorkflowContext {
         return try self.makeContext(
             workflow: workflow,
             offerings: .preview(offerings: offerings),
             uiConfig: uiConfig,
             presentedOfferingContext: presentedOfferingContext,
-            workflowBlobRef: workflowBlobRef
+            workflowBlobRef: workflowBlobRef,
+            traceId: traceId
         )
     }
 
@@ -52,14 +54,16 @@ import Foundation
             variableConfig: .init(variableCompatibilityMap: [:], functionCompatibilityMap: [:])
         ),
         presentedOfferingContext: PresentedOfferingContext? = nil,
-        workflowBlobRef: String? = nil
+        workflowBlobRef: String? = nil,
+        traceId: String? = nil
     ) throws -> WorkflowContext {
         return try PurchaseHandler.makeWorkflowContext(
             workflow: workflow,
             uiConfig: uiConfig,
             allOfferings: offerings,
             presentedOfferingContext: presentedOfferingContext,
-            workflowBlobRef: workflowBlobRef
+            workflowBlobRef: workflowBlobRef,
+            traceId: traceId
         )
     }
 
```

**File**: `RevenueCatUI/Templates/V2/ViewModelHelpers/WorkflowStepEventCoordinator.swift` (modified, +7/-11)
```diff
@@ -16,9 +16,9 @@ import Foundation
 
 /// Owns the per-impression workflow step event state machine and drives ``WorkflowStepEventTracker``
 /// at the four emission points (initial step, forward, back, terminal). It exists so the emission
-/// *sequence* and its gating (the "fire once", "only if a page rendered" rules that on Android live in
-/// `PaywallViewModelImpl`) can be unit tested without rendering a live SwiftUI view: ``WorkflowPaywallView``
-/// holds it as `@State` and delegates its lifecycle/navigation hooks to it.
+/// *sequence* and its gating (the "fire once", "only if a page rendered" rules) can be unit tested without
+/// rendering a live SwiftUI view: ``WorkflowPaywallView`` holds it as `@State` and delegates its
+/// lifecycle/navigation hooks to it.
 @available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
 final class WorkflowStepEventCoordinator {
 
@@ -43,9 +43,7 @@ final class WorkflowStepEventCoordinator {
         )
     }
 
-    /// Production entry point: each impression gets a fresh `traceId`, matching Android's per-impression
-    /// `workflowTraceId`. Because the view creates the coordinator in `init`, a new presentation (new view
-    /// identity) yields a new coordinator and therefore a new `traceId`.
+    /// Mints a fresh `traceId` for the impression.
     convenience init(
         workflow: PublishedWorkflow,
         workflowBlobRef: String? = nil,
@@ -54,8 +52,7 @@ final class WorkflowStepEventCoordinator {
         self.init(workflow: workflow, traceId: UUID().uuidString, workflowBlobRef: workflowBlobRef, sink: sink)
     }
 
-    /// Emits the initial `stepStarted` once, and only if the initial step actually rendered. Mirrors
-    /// Android firing the START event only when the initial workflow state is non-nil.
+    /// Emits the initial `stepStarted` once, and only if the initial step actually rendered.
     func trackInitialStep(_ step: WorkflowStep?, hasRenderedPage: Bool) {
         guard !self.hasTrackedInitialStep, hasRenderedPage, let step else {
             return
@@ -65,7 +62,7 @@ final class WorkflowStepEventCoordinator {
     }
 
     /// Tracks a forward/back transition. When the destination failed to render (`renderedPageIsNil`), the
-    /// step being left completes with no destination and no `stepStarted` is emitted (Android parity).
+    /// step being left completes with no destination and no `stepStarted` is emitted.
     func trackTransition(
         from fromStep: WorkflowStep?,
         to toStep: WorkflowStep,
@@ -85,8 +82,7 @@ final class WorkflowStepEventCoordinator {
     /// Emits a terminal `stepCompleted` (no destination) once, and only if a page is currently rendered.
     /// A step that never rendered (initial build failure) or a forward/back destination that failed to
     /// render clears the rendered page, so this must not emit a `stepCompleted` with no preceding
-    /// `stepStarted`. Mirrors Android keying terminal completion off `_workflowState.value?.currentStepId`,
-    /// which is null when a step fails to render.
+    /// `stepStarted`.
     func trackTerminalCompletion(currentStep: WorkflowStep?, hasRenderedPage: Bool) {
         guard !self.hasTrackedTerminalCompletion, hasRenderedPage, let currentStep else {
             return
```

**File**: `RevenueCatUI/Templates/V2/WorkflowPaywallView.swift` (modified, +4/-3)
```diff
@@ -283,8 +283,8 @@ struct WorkflowPaywallView: View {
     @StateObject private var promoOfferCacheOwner: PromoOfferCacheOwner
     @State private var presentationState: PresentationState
     /// Owns the per-impression workflow step event state machine (trace id, fire-once flags, gating).
-    /// Created in `init`, so a new presentation (new view identity) yields a fresh `traceId`, matching
-    /// Android's per-impression `workflowTraceId`. Its sequence/gating is unit tested in
+    /// Created in `init`, so a new presentation (new view identity) yields a fresh `traceId`, unless a
+    /// checkpoint passed the one its hit carries. Its sequence/gating is unit tested in
     /// `WorkflowStepEventCoordinatorTests`.
     @State private var stepEventCoordinator: WorkflowStepEventCoordinator
     @State private var transitionState: WorkflowPageTransitionState<RenderedPage>
@@ -347,6 +347,7 @@ struct WorkflowPaywallView: View {
         self._stepEventCoordinator = .init(
             wrappedValue: WorkflowStepEventCoordinator(
                 workflow: context.workflow,
+                traceId: context.traceId ?? UUID().uuidString,
                 workflowBlobRef: context.workflowBlobRef,
                 sink: { [purchaseHandler] event in purchaseHandler.track(event) }
             )
@@ -410,7 +411,7 @@ struct WorkflowPaywallView: View {
         // Re-emitted on every step change because navigator is @StateObject with @Published
         // currentStepId. The exit offer is resolved synchronously from allOfferings on the
         // triggering step; when the user navigates away the value becomes nil, clearing
-        // exitOfferOffering — matching Android's shouldTriggerExitOfferForCurrentStep guard.
+        // exitOfferOffering.
         .preference(
             key: WorkflowExitOfferPreferenceKey.self,
             value: self.presentationState.hasFailed
```

**File**: `RevenueCatUI/UIKit/PaywallViewController.swift` (modified, +2/-0)
```diff
@@ -134,6 +134,8 @@ public class PaywallViewController: UIViewController {
 
     var exitOfferOfferingForTesting: Offering? { self.exitOfferOffering }
 
+    var workflowContextForTesting: WorkflowContext? { self.configuration.injectedWorkflowContext }
+
     func simulateWorkflowExitOfferUpdate(_ offering: Offering?) {
         self.updateWorkflowExitOffer(offering)
     }
```

**File**: `Sources/Checkpoints/CheckpointEvent.swift` (modified, +11/-4)
```diff
@@ -54,6 +54,7 @@ extension CheckpointEvent {
         var workflowID: String?
         var offeringID: String?
         var checkpointRuleID: String?
+        var traceID: String?
 
         init(
             id: UUID = .init(),
@@ -63,7 +64,8 @@ extension CheckpointEvent {
             result: CheckpointHitResult,
             workflowID: String? = nil,
             offeringID: String? = nil,
-            checkpointRuleID: String? = nil
+            checkpointRuleID: String? = nil,
+            traceID: String? = nil
         ) {
             self.id = id
             self.identifier = identifier
@@ -73,6 +75,7 @@ extension CheckpointEvent {
             self.workflowID = workflowID
             self.offeringID = offeringID
             self.checkpointRuleID = checkpointRuleID
+            self.traceID = traceID
         }
 
     }
@@ -112,6 +115,7 @@ extension CheckpointEvent.Data {
         case workflowID = "workflowId"
         case offeringID = "offeringId"
         case checkpointRuleID = "checkpointRuleId"
+        case traceID = "traceId"
 
     }
 
@@ -130,7 +134,8 @@ extension CheckpointEvent.Data {
                 date: date,
                 result: .presentUI,
                 workflowID: matched.workflow.id,
-                checkpointRuleID: resolved.checkpointRuleID
+                checkpointRuleID: resolved.checkpointRuleID,
+                traceID: resolved.traceID
             )
 
         case let .matchedOffering(offering):
@@ -139,14 +144,16 @@ extension CheckpointEvent.Data {
                 date: date,
                 result: .returnData,
                 offeringID: offering.identifier,
-                checkpointRuleID: resolved.checkpointRuleID
+                checkpointRuleID: resolved.checkpointRuleID,
+                traceID: resolved.traceID
             )
 
         case let .noAction(reason):
             self.init(
                 identifier: identifier,
                 date: date,
-                result: .init(reason)
+                result: .init(reason),
+                traceID: resolved.traceID
             )
         }
     }
```

---

### Incident Patch 13: `d55d2945` (2026-09-22)
**Commit Message**: Fix relative discounts for workflow paywalls with plans in sheets (#7775)

* fix: include sheet packages in workflow discount context

* fix: preserve workflow promo precedence and preview sheet discounts

* test: polish workflow discount paywall and plans sheet previews

* build: register workflow discount previews in Xcode project

* test: give workflow discount previews a cat theme

* test: trim workflow discount regression scaffolding

* fix: preserve workflow page selection when collecting sheet plans

**File**: `RevenueCat.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -233,6 +233,7 @@
 		2C0B98CD2797070B00C5874F /* PromotionalOffer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C0B98CC2797070B00C5874F /* PromotionalOffer.swift */; };
 		2C2AEB0F2CA64E0E00A50F38 /* Template1Preview.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C2AEB0E2CA64E0E00A50F38 /* Template1Preview.swift */; };
 		832A761DBC4EA873D769CB83 /* WindowSizeConditionsPreview.swift in Sources */ = {isa = PBXBuildFile; fileRef = 527C8FDAD4BC0E20186FB251 /* WindowSizeConditionsPreview.swift */; };
+		9FDCB2854C16420D876A9751 /* WorkflowSheetRelativeDiscountPreview.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9FDCB2854C16420D876A9752 /* WorkflowSheetRelativeDiscountPreview.swift */; };
 		2C2AEB3B2CA7209F00A50F38 /* PaywallPackageComponent.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C2AEB3A2CA7209F00A50F38 /* PaywallPackageComponent.swift */; };
 		2C2AEB3F2CA7235300A50F38 /* PaywallPurchaseButtonComponent.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C2AEB3E2CA7235300A50F38 /* PaywallPurchaseButtonComponent.swift */; };
 		2C6CC1162B8D2B6900432E4D /* PurchasesSyncAttributesAndOfferingsIfNeededTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2C6CC1152B8D2B6800432E4D /* PurchasesSyncAttributesAndOfferingsIfNeededTests.swift */; };
@@ -1975,6 +1976,7 @@
 		2C0B98CC2797070B00C5874F /* PromotionalOffer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PromotionalOffer.swift; sourceTree = "<group>"; };
 		2C2AEB0E2CA64E0E00A50F38 /* Template1Preview.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Template1Preview.swift; sourceTree = "<group>"; };
 		527C8FDAD4BC0E20186FB251 /* WindowSizeConditionsPreview.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WindowSizeConditionsPreview.swift; sourceTree = "<group>"; };
+		9FDCB2854C16420D876A9752 /* WorkflowSheetRelativeDiscountPreview.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WorkflowSheetRelativeDiscountPreview.swift; sourceTree = "<group>"; };
 		D793578E154692425D9938B6 /* WindowSizeConditionTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WindowSizeConditionTests.swift; sourceTree = "<group>"; };
 		4B90A3E17C25D8F1206BA442 /* PaywallWindowSizeMeasurementTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PaywallWindowSizeMeasurementTests.swift; sourceTree = "<group>"; };
 		2C2AEB3A2CA7209F00A50F38 /* PaywallPackageComponent.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PaywallPackageComponent.swift; sourceTree = "<group>"; };
@@ -3997,6 +3999,7 @@
 				DBAA1FBA2F8D45C2000E8C81 /* HeaderTextBodyHeroSafeAreaPreview.swift */,
 				DBAA1FC12F8D4ED8000E8C81 /* HeaderNestedHeroZLayerSafeAreaPreview.swift */,
 				527C8FDAD4BC0E20186FB251 /* WindowSizeConditionsPreview.swift */,
+				9FDCB2854C16420D876A9752 /* WorkflowSheetRelativeDiscountPreview.swift */,
 			);
 			path = TemplateComponentsViewPreviews;
 			sourceTree = "<group>";
@@ -9104,6 +9107,7 @@
 				577132B92E4CE43A003A0CBD /* NoSubscriptionsCardViewModel.swift in Sources */,
 				2C2AEB0F2CA64E0E00A50F38 /* Template1Preview.swift in Sources */,
 				832A761DBC4EA873D769CB83 /* WindowSizeConditionsPreview.swift in Sources */,
+				9FDCB2854C16420D876A9751 /* WorkflowSheetRelativeDiscountPreview.swift in Sources */,
 				88A543E32C37A4970039C6A5 /* Template7View.swift in Sources */,
 				2C91068C2CE22D4F00189565 /* JustifyContent.swift in Sources */,
 				806797FE2FCD970800DF760F /* PaywallZLayerScrollPolicy.swift in Sources */,
```

**File**: `RevenueCatUI/Purchasing/WorkflowContext.swift` (modified, +33/-12)
```diff
@@ -191,17 +191,20 @@ import Foundation
         for base: PaywallComponentsData.PaywallComponentsConfig,
         offering: Offering
     ) -> WorkflowPackageContext? {
-        let allComponents = base.stack.components
+        let allComponents = (base.header?.stack.components ?? [])
+            + base.stack.components
             + (base.stickyFooter?.stack.components ?? [])
         let packages = Self.collectPackages(in: allComponents, offering: offering)
+        let pagePackages = packages.filter { !$0.isInSheet }
+        let selectionCandidates = pagePackages.isEmpty ? packages : pagePackages
 
-        guard let selectedPackage = packages.first(where: { $0.isSelectedByDefault })?.package
-                ?? packages.first?.package else {
+        guard let selectedPackage = selectionCandidates.first(where: { $0.isSelectedByDefault })?.package
+                ?? selectionCandidates.first?.package else {
             return nil
         }
 
         let promoOfferCodes = packages.reduce(into: [String: String]()) { result, entry in
-            if let code = entry.promoOfferCode {
+            if let code = entry.promoOfferCode, result[entry.package.identifier] == nil {
                 result[entry.package.identifier] = code
             }
         }
@@ -267,26 +270,44 @@ import Foundation
         ).withPaywallComponents(paywallComponents)
     }
 
+    private struct CollectedPackage {
+
+        let package: Package
+        let isSelectedByDefault: Bool
+        let promoOfferCode: String?
+        let isInSheet: Bool
+
+    }
+
     private static func collectPackages(
         in components: [PaywallComponent],
-        offering: Offering
-    ) -> [(package: Package, isSelectedByDefault: Bool, promoOfferCode: String?)] {
+        offering: Offering,
+        isInSheet: Bool = false
+    ) -> [CollectedPackage] {
         return components.reduce(into: []) { result, component in
             switch component {
             case .package(let pkg):
                 if let rcPackage = offering.package(identifier: pkg.packageID) {
-                    result.append((package: rcPackage,
-                                   isSelectedByDefault: pkg.isSelectedByDefault,
-                                   promoOfferCode: pkg.applePromoOfferProductCode))
+                    result.append(.init(package: rcPackage,
+                                        isSelectedByDefault: pkg.isSelectedByDefault,
+                                        promoOfferCode: pkg.applePromoOfferProductCode,
+                                        isInSheet: isInSheet))
+                }
+                result += Self.collectPackages(in: pkg.stack.components, offering: offering, isInSheet: isInSheet)
+            case .button(let button):
+                result += Self.collectPackages(in: button.stack.components, offering: offering, isInSheet: isInSheet)
+                // Sheet plans contribute to pricing without overriding the page's initial selection.
+                if case let .navigateTo(.sheet(sheet)) = button.action, let sheet {
+                    result += Self.collectPackages(in: sheet.stack.components, offering: offering, isInSheet: true)
                 }
             case .stack(let stack):
-                result += Self.collectPackages(in: stack.components, offering: offering)
+                result += Self.collectPackages(in: stack.components, offering: offering, isInSheet: isInSheet)
             case .tabs(let tabs):
                 result += Self.collectPackages(
-                    in: tabs.tabs.flatMap { $0.stack.components }, offering: offering)
+                    in: tabs.tabs.flatMap { $0.stack.components }, offering: offering, isInSheet: isInSheet)
             case .carousel(let carousel):
                 result += Self.collectPackages(
-                    in: carousel.pages.flatMap { $0.components }, offering: offering)
+                    in: carousel.pages.flatMap { $0.components }, offering: offering, isInSheet: isInSheet)
             default:
                 break
             }
```

**File**: `RevenueCatUI/Templates/V2/Previews/TemplateComponentsViewPreviews/WorkflowSheetRelativeDiscountPreview.swift` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+//
+//  Copyright RevenueCat Inc. All Rights Reserved.
+//
+//  Licensed under the MIT License (the "License");
+//  you may not use this file except in compliance with the License.
+//  You may obtain a copy of the License at
+//
+//      https://opensource.org/licenses/MIT
+//
+//  WorkflowSheetRelativeDiscountPreview.swift
+
+#if DEBUG && !os(tvOS)
+
+@_spi(Internal) import RevenueCat
+import SwiftUI
+
+@MainActor
+@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
+struct WorkflowSheetRelativeDiscountPreview: PreviewProvider {
+
+    static var previews: some View {
+        Self.paywall
+            .previewLayout(.fixed(width: 400, height: 860))
+            .previewDisplayName("Workflow: annual discount with plans in closed sheet")
+
+        Self.plansSheet
+            .previewLayout(.fixed(width: 400, height: 860))
+            .previewDisplayName("Workflow: all plans sheet with relative discounts")
+    }
+
+    static var paywall: some View { WorkflowDiscountPreviewView(sheetPresented: false) }
+    static var plansSheet: some View { WorkflowDiscountPreviewView(sheetPresented: true) }
+
+}
+
+@MainActor
+@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
+private struct WorkflowDiscountPreviewView: View {
+
+    private let context: WorkflowContext
+    private let packageContext: PackageContext
+    @State private var sheet: SheetViewModel?
+
+    init(sheetPresented: Bool) {
+        let context = WorkflowDiscountPreviewData.context
+        self.context = context
+        self.packageContext = WorkflowPaywallView.buildPackageInput(
+            stepId: "paywall", context: context, preferredPackage: nil, showZeroDecimalPlacePrices: true
+        ).packageContext
+        // Seed the production overlay for first-frame snapshots using the workflow's package input.
+        self._sheet = .init(initialValue: sheetPresented ? WorkflowDiscountPreviewData.sheetViewModel(context) : nil)
+    }
+
+    var body: some View {
+        WorkflowPaywallView(
+            context: self.context,
+            purchaseHandler: .default(),
+            introEligibilityChecker: .producing(eligibility: .ineligible),
+            showZeroDecimalPlacePrices: true,
+            displayCloseButton: false,
+            promoOfferCache: nil,
+            onDismiss: { }
+        )
+        .bottomSheet(sheet: self.$sheet, safeAreaInsets: .init(), onSheetContentAppear: nil)
+        .previewRequiredPaywallsV2Properties(packageContext: self.packageContext)
+        .environment(\.paywallLoadingOverride, false)
+        .environment(\.locale, Locale(identifier: "en_US"))
+        .preferredColorScheme(.dark)
+    }
+
+}
+
+@MainActor
+@available(iOS 15.0, macOS 12.0, tvOS 15.0, watchOS 8.0, *)
+private enum WorkflowDiscountPreviewData {
+
+    static let accent = "#D4B6FF"
+    static let background = "#141122"
+    static let surface = "#211B34"
+    static let muted = "#B8AEC9"
+    static let localizations: PaywallComponent.LocalizationDictionary = [
+        "brand": .string("P U R R   C L U B"),
+        "cats": .string("🐈  🐈‍⬛"),
+        "headline": .string("More purrs.\nLess boredom."),
+        "subtitle": .string("Daily play, clever enrichment,\nand happier indoor cats."),
+        "benefits": .string(
+            "✓  Play ideas for every personality\n✓  A fresh adventure every day\n✓  One membership, all your cats"
+        ),
+        "recommended": .string("NINE LIVES. ENDLESS POSSIBILITIES."),
+        "all_plans": .string("Explore all plans"),
+        "sheet_title": .string("Pick your purr-fect plan"),
+        "sheet_subtitle": .string("All the play. All the cats. Whichever plan fits."),
+        "$rc_annual": .string("Annual"),
+        "$rc_three_month": .string("3 months"),
+        "$rc_monthly": .string("Monthly"),
+        "per_month": .string("{{ product.price_per_month }}/mo"),
+        "price": .string("{{ product.price }}"),
+        "discount": .string("{{ product.relative_discount }} OFF"),
+        "selection": .string("○"),
+        "selected": .string("●"),
+        "continue": .string("Join the club"),
+        "close": .string("×"),
+        "terms": .string("Auto-renews. Cancel anytime."),
+        "footer": .string("Restore purchases   ·   Terms   ·   Privacy")
+    ]
+
+    static var context: WorkflowContext {
+        let products: [(PackageType, Decimal, SubscriptionPeriod)] = [
+            (.annual, 79.99, .init(value: 1, unit: .year)),
+            (.threeMonth, 34.99, .init(value: 3, unit: .month)),
+            (.monthly, 14.99, .init(value: 1, unit: .month))
+        ]
+        let packages = products.map { type, price, period in
+            Package(
+                identifier: type.identifier, packageType: type,
+                storeProduct: TestStoreProduct(
+                    localizedTitle: type.identifier, price: price, currencyCode: "USD",
+                    localizedPriceString: "$\(price)", productIdentifier: type.identifier,
```

**File**: `Tests/RevenueCatUITests/Purchasing/WorkflowContextTests.swift` (modified, +241/-0)
```diff
@@ -12,6 +12,7 @@
 import Nimble
 @_spi(Internal) @testable import RevenueCat
 @_spi(Internal) @testable import RevenueCatUI
+import SwiftUI
 import XCTest
 
 #if !os(tvOS) // For Paywalls V2
@@ -159,6 +160,141 @@ final class WorkflowContextTests: TestCase {
         expect(context.packageContext(for: "step_terminal")?.selectedPackage.identifier) == "$rc_annual"
     }
 
+    // MARK: - Sheet packages and relative discounts
+
+    @MainActor
+    func testRelativeDiscountIncludesPackagesInViewAllPlansSheet() throws {
+        let context = try Self.makeSheetContext()
+        let input = WorkflowPaywallView.buildPackageInput(
+            stepId: "paywall", context: context, preferredPackage: nil, showZeroDecimalPlacePrices: true
+        )
+
+        expect(input.packageContext.package?.identifier) == "$rc_annual"
+        expect(input.packageContext.variableContext.mostExpensivePricePerMonth) == 14.99
+        expect(try Self.discountText(context: input.packageContext)) == "56%"
+    }
+
+    @MainActor
+    func testPackagelessStepInheritsDiscountBaselineFromSheet() throws {
+        let context = try Self.makeSheetContext()
+        let input = WorkflowPaywallView.buildPackageInput(
+            stepId: "intro", context: context, preferredPackage: nil, showZeroDecimalPlacePrices: true
+        )
+
+        expect(try Self.discountText(context: input.packageContext)) == "56%"
+    }
+
+    @MainActor
+    func testSheetDefaultDoesNotOverridePageDefault() throws {
+        let context = try Self.makeSheetContext(footer: [
+            Self.sheetButton([.stack(.init(components: [Self.packageComponent("$rc_monthly", isDefault: true)]))]),
+            Self.packageComponent("$rc_annual", isDefault: true)
+        ])
+        let input = WorkflowPaywallView.buildPackageInput(
+            stepId: "paywall", context: context, preferredPackage: nil, showZeroDecimalPlacePrices: true
+        )
+
+        expect(input.packageContext.package?.identifier) == "$rc_annual"
+        expect(try Self.discountText(context: input.packageContext)) == "56%"
+    }
+
+    func testSheetDefaultDoesNotOverrideFirstPagePackageWhenPageHasNoDefault() throws {
+        let context = try Self.makeSheetContext(footer: [
+            Self.sheetButton([Self.packageComponent("$rc_monthly", isDefault: true)]),
+            Self.packageComponent("$rc_annual")
+        ])
+
+        expect(context.workflowPackageContext?.selectedPackage.identifier) == "$rc_annual"
+    }
+
+    @MainActor
+    func testSheetOnlyPaywallUsesSheetDefaultAndDiscountBaseline() throws {
+        let context = try Self.makeSheetContext(footer: [
+            Self.sheetButton([
+                Self.packageComponent("$rc_monthly"),
+                Self.packageComponent("$rc_annual", isDefault: true)
+            ])
+        ])
+        let input = WorkflowPaywallView.buildPackageInput(
+            stepId: "paywall", context: context, preferredPackage: nil, showZeroDecimalPlacePrices: true
+        )
+
+        expect(input.packageContext.package?.identifier) == "$rc_annual"
+        expect(try Self.discountText(context: input.packageContext)) == "56%"
+    }
+
+    @MainActor
+    func testPreferredMonthlySheetPackageHasNoRelativeDiscount() throws {
+        let context = try Self.makeSheetContext()
+        let monthly = try XCTUnwrap(context.initialOffering.monthly)
+        let input = WorkflowPaywallView.buildPackageInput(
+            stepId: "intro", context: context, preferredPackage: monthly, showZeroDecimalPlacePrices: true
+        )
+
+        expect(input.packageContext.package?.identifier) == "$rc_monthly"
+        expect(try Self.discountText(context: input.packageContext)) == ""
+    }
+
+    func testCollectsSheetInsidePackageStack() throws {
+        let annual = Self.packageComponent(
+            "$rc_annual", isDefault: true, children: [Self.sheetButton([Self.packageComponent("$rc_monthly")])]
+        )
+        let context = try Self.makeSheetContext(footer: [annual])
+
+        expect(context.packageContext(for: "paywall")?.packages.map(\.identifier))
+            .to(contain("$rc_annual", "$rc_monthly"))
+        expect(context.workflowPackageContext?.selectedPackage.identifier) == "$rc_annual"
+    }
+
+    func testDuplicateSheetPackagePreservesFirstPromoOfferCode() throws {
+        let context = try Self.makeSheetContext(footer: [
+            Self.packageComponent("$rc_annual", isDefault: true, promoCode: "annual_promo"),
+            Self.sheetButton([Self.packageComponent("$rc_annual", promoCode: "sheet_promo")])
+        ])
+
+        expect(context.packageContext(for: "paywall")?.promoOfferCodesByPackageId["$rc_annual"]) == "annual_promo"
+    }
+
+    func testDuplicateSheetPackageFillsMissingPromoOfferCode() throws {
+        let context = try Self.makeSheetContext(footer: [
+            Self.packageComponent("$rc_annual", isDefault: true),
+            Self.sheetButton([Self.packageComponent("$rc_annual", promoCode: "sheet_pr
```

---

### Incident Patch 14: `f45da7f3` (2026-09-21)
**Commit Message**: Fix(Paywalls): Prevent Fill children from expanding the paywall root (#7782)

* Fix Paywalls V2 fill sizing overflow

Co-authored-by: jacob.rakidzich <[REDACTED_EMAIL]>

* Simplify Fill sizing comments

Co-authored-by: jacob.rakidzich <[REDACTED_EMAIL]>

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: jacob.rakidzich <[REDACTED_EMAIL]>

**File**: `RevenueCatUI/Templates/V2/Components/WebView/WebViewComponentView.swift` (modified, +2/-2)
```diff
@@ -463,7 +463,7 @@ private extension View {
                 )
             )
         case .fill:
-            self.frame(maxWidth: .infinity)
+            self.frame(minWidth: 0, maxWidth: .infinity)
         case .fixed(let value):
             self.frame(width: CGFloat(value))
         case .relative:
@@ -486,7 +486,7 @@ private extension View {
                 )
             )
         case .fill:
-            self.frame(maxHeight: .infinity)
+            self.frame(minHeight: 0, maxHeight: .infinity)
         case .fixed(let value):
             self.frame(height: CGFloat(value))
         case .relative:
```

**File**: `RevenueCatUI/Templates/V2/ViewHelpers/ApplySizing.swift` (modified, +2/-2)
```diff
@@ -26,7 +26,7 @@ extension View {
             self.applyWidthLimits(minMax, alignment: .center)
         case let .fill(minMax):
             self
-                .frame(maxWidth: .infinity)
+                .frame(minWidth: 0, maxWidth: .infinity)
                 .applyWidthLimits(minMax, alignment: .center)
         case .fixed(let value):
             self.frame(width: Double(value))
@@ -56,7 +56,7 @@ extension View {
             }
         case let .fill(minMax):
             self
-                .frame(maxHeight: .infinity)
+                .frame(minHeight: 0, maxHeight: .infinity)
                 .applyHeightLimits(minMax, alignment: .center)
         case .fixed(let value):
             self.frame(height: Double(value))
```

**File**: `RevenueCatUI/Templates/V2/ViewHelpers/SizeModifier.swift` (modified, +3/-2)
```diff
@@ -32,14 +32,15 @@ struct SizeModifier: ViewModifier {
 
 extension View {
 
+    /// A zero minimum prevents oversized children from widening Fill ancestors.
     @ViewBuilder
     func applyWidth(_ sizeConstraint: PaywallComponent.SizeConstraint, alignment: Alignment) -> some View {
         switch sizeConstraint {
         case let .fit(_, minMax):
             self.applyWidthLimits(minMax, alignment: alignment)
         case let .fill(minMax):
             self
-                .frame(maxWidth: .infinity, alignment: alignment)
+                .frame(minWidth: 0, maxWidth: .infinity, alignment: alignment)
                 .applyWidthLimits(minMax, alignment: alignment)
         case .fixed(let value):
             self
@@ -57,7 +58,7 @@ extension View {
             self.applyHeightLimits(minMax, alignment: alignment)
         case let .fill(minMax):
             self
-                .frame(maxHeight: .infinity, alignment: alignment)
+                .frame(minHeight: 0, maxHeight: .infinity, alignment: alignment)
                 .applyHeightLimits(minMax, alignment: alignment)
         case .fixed(let value):
             self
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/SizeModifierTests.swift` (modified, +21/-0)
```diff
@@ -65,6 +65,27 @@ final class SizeModifierTests: TestCase {
         XCTAssertEqual(Self.fittingSize(of: view, in: .init(width: 100, height: 100)).width, 120)
     }
 
+    func testFillDoesNotGrowToOversizedChild() {
+        let view = Color.clear
+            .frame(width: 500, height: 500)
+            .size(.init(width: .fill, height: .fill))
+
+        XCTAssertEqual(
+            Self.fittingSize(of: view, in: .init(width: 100, height: 100)),
+            .init(width: 100, height: 100)
+        )
+    }
+
+    func testFillParentDoesNotGrowToChildMinimum() {
+        let child = Color.clear
+            .size(.init(width: .fill(.init(min: 120, max: nil)), height: .fixed(10)))
+        let parent = child
+            .size(.init(width: .fill, height: .fixed(10)))
+
+        XCTAssertEqual(Self.fittingSize(of: child, in: .init(width: 100, height: 100)).width, 120)
+        XCTAssertEqual(Self.fittingSize(of: parent, in: .init(width: 100, height: 100)).width, 100)
+    }
+
     func testMinimumTakesPrecedenceOverMaximum() {
         let view = Color.clear
             .size(
```

---

### Incident Patch 15: `474a29a6` (2026-09-18)
**Commit Message**: Fix(Paywalls) Support Web Views in looping carousels (#7688)

* fix looping a carousel would not show the web view.

* playback gating

* calculate ancestor distance

* pr feedback - more closely match production bug in test

* remove default

* pr feedback, renames

* use orignal function

* add test

* pr feedback

**File**: `RevenueCatUI/Templates/V2/Components/Carousel/CarouselComponentView.swift` (modified, +4/-1)
```diff
@@ -162,6 +162,9 @@ private struct CarouselItem<Content: View>: Identifiable {
 private struct CarouselView<Content: View>: View {
     // MARK: - Configuration
 
+    @Environment(\.carouselState)
+    private var ancestorCarouselState
+
     private let pageAlignment: VerticalAlignment
     private let width: CGFloat
     private let initialIndex: Int
@@ -278,7 +281,7 @@ private struct CarouselView<Content: View>: View {
                         .environment(\.carouselState, CarouselState(
                             activeIndex: index,
                             pageIndex: pageIndex,
-                            originalCount: originalCount
+                            ancestorDistanceFromActive: self.ancestorCarouselState?.distanceFromActive ?? 0
                         ))
                         // ensure rendering doesn't need to wait on size calculations as the item
                         // attempts to enter the view
```

**File**: `RevenueCatUI/Templates/V2/Components/WebView/WebViewComponentView.swift` (modified, +21/-9)
```diff
@@ -53,6 +53,9 @@ struct WebViewComponentView: View {
     @Environment(\.paywallStateDefaults)
     private var paywallStateDefaults
 
+    @Environment(\.carouselState)
+    private var carouselState
+
     let viewModel: WebViewComponentViewModel
 
     private var style: WebViewComponentStyle {
@@ -94,7 +97,8 @@ struct WebViewComponentView: View {
             HostedWebViewComponentView(
                 size: style.size,
                 url: url,
-                instance: instance
+                instance: instance,
+                carouselDistance: self.carouselState?.distanceFromActive ?? 0
             )
         } else if style.visible {
             // Meant to be shown but not renderable (bad URL / no resolvable origin / missing id):
@@ -146,12 +150,15 @@ private struct HostedWebViewComponentView: View {
     @ObservedObject
     var instance: WebViewInstance
 
+    let carouselDistance: Int
+
     var body: some View {
         if !self.instance.processTerminated, !self.instance.loadFailed {
             WebViewRepresentable(
                 url: self.url,
                 instance: self.instance,
-                idStore: .shared
+                idStore: .shared,
+                carouselDistance: self.carouselDistance
             )
             .webViewSize(
                 self.size,
@@ -179,14 +186,16 @@ struct WebViewRepresentable: PlatformViewRepresentable {
     let url: URL
     let instance: WebViewInstance
     let idStore: WebViewDataStoreIdentifierStore
+    /// See ``WebViewHostView/carouselDistance``.
+    let carouselDistance: Int
 
     var expectedOrigin: WebViewOrigin {
         self.instance.session.expectedOrigin
     }
 
     /// One coordinator per instance, retained by the instance: `navigationDelegate` is weak, so a
-    /// coordinator owned by a `ViewThatFits` candidate would stop delivering callbacks the moment
-    /// that candidate is discarded.
+    /// coordinator owned by the representable would stop delivering callbacks the moment a parent
+    /// redraw discards that representable.
     func makeCoordinator() -> Coordinator {
         self.instance.navigationDelegate {
             let coordinator = Coordinator(expectedOrigin: self.expectedOrigin)
@@ -197,9 +206,9 @@ struct WebViewRepresentable: PlatformViewRepresentable {
         }
     }
 
-    // Deliberately no `dismantleNSView/dismantleUIView` implementation: a discarded subtree is usually just a
-    // `ViewThatFits` candidate losing the layout, and tearing the web view down there is what caused
-    // the component to blank out and reload. The component view model owns the web view instead.
+    // Deliberately no `dismantleNSView/dismantleUIView` implementation: a discarded subtree is usually just
+    // a parent redraw, and tearing the web view down there is what caused the component to blank out and
+    // reload. The component view model owns the web view instead.
     #if os(macOS)
     func makeNSView(context: Context) -> WebViewHostView {
         self.makeHost(context: context)
@@ -221,6 +230,7 @@ struct WebViewRepresentable: PlatformViewRepresentable {
     @MainActor
     private func makeHost(context: Context) -> WebViewHostView {
         let host = WebViewHostView()
+        host.carouselDistance = self.carouselDistance
 
         _ = self.instance.webView {
             self.makeWebView(context: context)
@@ -231,7 +241,7 @@ struct WebViewRepresentable: PlatformViewRepresentable {
             if host.window == nil {
                 instance?.hostDidLeaveWindow(host)
             } else {
-                instance?.hostDidEnterWindow(host)
+                instance?.reconcile(host: host)
             }
         }
 
@@ -240,8 +250,10 @@ struct WebViewRepresentable: PlatformViewRepresentable {
 
     @MainActor
     private func update(_ host: WebViewHostView) {
+        // A carousel page change re-updates every copy; the instance needs the new distance before it re-evaluates.
+        host.carouselDistance = self.carouselDistance
         if host.window != nil {
-            self.instance.updateHost(host)
+            self.instance.reconcile(host: host)
         }
     }
 
```

**File**: `RevenueCatUI/Templates/V2/Components/WebView/WebViewInstance.swift` (modified, +87/-37)
```diff
@@ -35,14 +35,17 @@ final class WebViewInstance: ObservableObject {
 
     private weak var attachedHost: WebViewHostView?
 
-    /// A host that entered a window while the current host was still mounted. Remembering it lets the
-    /// current host complete the handoff when it leaves instead of stranding the web view off-screen.
-    private weak var pendingHost: WebViewHostView?
+    /// Hosts currently in a window, in entry order. Several is normal: a parent redraw can mount the new
+    /// host before unmounting the old one, and a looping carousel mounts copies of each page.
+    private var candidateHosts: [WeakHost] = []
 
     /// `true` while playback is suspended because no host is showing the web view. Tracked so suspend
     /// and resume stay paired, as WebKit requires.
     private(set) var isMediaPlaybackSuspended = false
 
+    /// The last suspension state requested during the current main-actor turn.
+    private var scheduledMediaSuspension: Bool?
+
     init(
         componentID: String,
         expectedOrigin: WebViewOrigin,
@@ -114,54 +117,61 @@ final class WebViewInstance: ObservableObject {
         self.loadFailed = true
     }
 
-    func hostDidEnterWindow(_ host: WebViewHostView) {
-        guard let webView = self.webView else {
-            return
-        }
+    func reconcile(host: WebViewHostView) {
+        self.registerCandidate(host)
+        self.reconcileAttachment()
+    }
 
-        if let attachedHost = self.attachedHost,
-           attachedHost !== host,
-           attachedHost.window != nil,
-           webView.superview === attachedHost {
-            self.pendingHost = host
+    func hostDidLeaveWindow(_ host: WebViewHostView) {
+        self.candidateHosts.removeAll { $0.host === host }
+        self.reconcileAttachment()
+    }
+
+    private func registerCandidate(_ host: WebViewHostView) {
+        guard !self.candidateHosts.contains(where: { $0.host === host }) else {
             return
         }
 
-        self.pendingHost = nil
-        self.attachWebView(to: host)
+        self.candidateHosts.append(WeakHost(host))
     }
 
-    func hostDidLeaveWindow(_ host: WebViewHostView) {
-        if self.pendingHost === host {
-            self.pendingHost = nil
-        }
-
-        guard self.attachedHost === host else {
+    /// Moves the web view to the host that should be showing it, and suspends playback while it is off-screen.
+    private func reconcileAttachment() {
+        guard self.webView != nil else {
             return
         }
 
-        self.attachedHost = nil
+        self.candidateHosts.removeAll { $0.host?.window == nil }
 
-        if let pendingHost = self.pendingHost, pendingHost.window != nil {
-            self.pendingHost = nil
-            self.attachWebView(to: pendingHost)
+        guard let preferredHost = self.preferredHost() else {
+            // Nothing is showing the web view any more — the component was hidden, or the paywall went
+            // away. The web view survives on the view model, so without this an `autoplay` video would
+            // keep playing audio from a component that is no longer on screen.
+            self.attachedHost = nil
+            self.setMediaPlaybackSuspended(true)
             return
         }
 
-        // Nothing is showing the web view any more — the component was hidden, or the paywall went
-        // away. The web view survives on the view model, so without this an `autoplay` video would
-        // keep playing audio from a component that is no longer on screen.
-        self.setMediaPlaybackSuspended(true)
+        self.setMediaPlaybackSuspended(preferredHost.carouselDistance > 1)
+        self.attachWebView(to: preferredHost)
     }
 
-    /// Reasserts attachment for a host SwiftUI updated after it was already in a window. Unlike
-    /// ``hostDidEnterWindow(_:)``, updates from another mounted candidate do not compete for ownership.
-    func updateHost(_ host: WebViewHostView) {
-        guard self.attachedHost == nil || self.attachedHost === host else {
-            return
+    /// The candidate closest to its carousel's active page. Ties go to the host already showing the web
+    /// view, then to the host that entered the window first, so a replacement host mounted during a
+    /// redraw only takes over once the current host leaves.
+    private func preferredHost() -> WebViewHostView? {
+        let candidates = self.candidateHosts.compactMap(\.host)
+        guard let closestDistance = candidates.map(\.carouselDistance).min() else {
+            return nil
         }
 
-        self.attachWebView(to: host)
+        if let attachedHost = self.attachedHost,
+           attachedHost.carouselDistance == closestDistance,
+           candidates.contains(where: { $0 === attachedHost }) {
+            return attachedHost
+        }
+
+        return candidates.first { $0.carouselDistance == closestDistance }
     }
 
     private func attachWebView(to host: WebViewHostV
```

**File**: `RevenueCatUI/Templates/V2/EnvironmentObjects/CarouselState.swift` (modified, +17/-8)
```diff
@@ -25,18 +25,27 @@ struct CarouselState: Equatable {
     /// This page's index in the carousel's data array.
     let pageIndex: Int
 
-    /// The number of original pages (before copies for looping).
-    let originalCount: Int
+    /// The effective distance inherited from all enclosing carousels.
+    private let ancestorDistanceFromActive: Int
 
-    /// Whether this page is the currently visible page in the data array.
-    var isActive: Bool {
-        return activeIndex == pageIndex
+    init(
+        activeIndex: Int,
+        pageIndex: Int,
+        ancestorDistanceFromActive: Int
+    ) {
+        self.activeIndex = activeIndex
+        self.pageIndex = pageIndex
+        self.ancestorDistanceFromActive = ancestorDistanceFromActive
     }
 
-    /// Whether this page is active or adjacent to the active page in the data array.
-    /// This matches the visible "side" pages in the carousel strip.
+    /// The greatest distance from the active page across this carousel and its ancestors.
+    var distanceFromActive: Int {
+        return max(abs(activeIndex - pageIndex), self.ancestorDistanceFromActive)
+    }
+
+    /// Whether this page is active or adjacent in this carousel and every enclosing carousel.
     var isActiveOrNeighbor: Bool {
-        return abs(activeIndex - pageIndex) <= 1
+        return self.distanceFromActive <= 1
     }
 
 }
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/CarouselStateTests.swift` (modified, +42/-45)
```diff
@@ -19,104 +19,101 @@ import XCTest
 @available(iOS 15.0, macOS 12.0, watchOS 8.0, *)
 class CarouselStateTests: TestCase {
 
-    // MARK: - isActive Tests
-
-    func testIsActiveReturnsTrueWhenIndicesMatch() {
-        let state = CarouselState(activeIndex: 2, pageIndex: 2, originalCount: 5)
-        XCTAssertTrue(state.isActive)
-    }
-
-    func testIsActiveReturnsFalseWhenIndicesDontMatch() {
-        let state = CarouselState(activeIndex: 2, pageIndex: 3, originalCount: 5)
-        XCTAssertFalse(state.isActive)
+    // MARK: - Distance From Active
+
+    func testDistanceFromActiveUsesAbsoluteDataIndexDifference() {
+        XCTAssertEqual(CarouselState(
+            activeIndex: 2,
+            pageIndex: 2,
+            ancestorDistanceFromActive: 0
+        ).distanceFromActive, 0)
+        XCTAssertEqual(CarouselState(
+            activeIndex: 2,
+            pageIndex: 0,
+            ancestorDistanceFromActive: 0
+        ).distanceFromActive, 2)
+        XCTAssertEqual(CarouselState(
+            activeIndex: 2,
+            pageIndex: 4,
+            ancestorDistanceFromActive: 0
+        ).distanceFromActive, 2)
     }
 
-    func testIsActiveHandlesLoopingCarousel() {
-        // In a looping carousel, isActive represents the visible data index only.
-        let state = CarouselState(activeIndex: 3, pageIndex: 0, originalCount: 3)
-        XCTAssertFalse(state.isActive, "Only the active data index should be marked active")
-    }
-
-    func testIsActiveWithZeroOriginalCountFallsBackToDirectComparison() {
-        let state = CarouselState(activeIndex: 2, pageIndex: 2, originalCount: 0)
-        XCTAssertTrue(state.isActive)
+    func testDistanceFromActiveIncludesEnclosingCarouselDistance() {
+        let state = CarouselState(
+            activeIndex: 0,
+            pageIndex: 0,
+            ancestorDistanceFromActive: 3
+        )
 
-        let state2 = CarouselState(activeIndex: 2, pageIndex: 3, originalCount: 0)
-        XCTAssertFalse(state2.isActive)
+        XCTAssertEqual(state.distanceFromActive, 3)
+        XCTAssertFalse(state.isActiveOrNeighbor)
     }
 
     // MARK: - isActiveOrNeighbor Tests
 
     func testIsActiveOrNeighborReturnsTrueForActiveIndex() {
-        let state = CarouselState(activeIndex: 2, pageIndex: 2, originalCount: 5)
+        let state = CarouselState(activeIndex: 2, pageIndex: 2, ancestorDistanceFromActive: 0)
         XCTAssertTrue(state.isActiveOrNeighbor)
     }
 
     func testIsActiveOrNeighborReturnsTrueForPreviousPage() {
-        let state = CarouselState(activeIndex: 2, pageIndex: 1, originalCount: 5)
+        let state = CarouselState(activeIndex: 2, pageIndex: 1, ancestorDistanceFromActive: 0)
         XCTAssertTrue(state.isActiveOrNeighbor)
     }
 
     func testIsActiveOrNeighborReturnsTrueForNextPage() {
-        let state = CarouselState(activeIndex: 2, pageIndex: 3, originalCount: 5)
+        let state = CarouselState(activeIndex: 2, pageIndex: 3, ancestorDistanceFromActive: 0)
         XCTAssertTrue(state.isActiveOrNeighbor)
     }
 
     func testIsActiveOrNeighborReturnsFalseForDistantPage() {
-        let state = CarouselState(activeIndex: 2, pageIndex: 4, originalCount: 5)
+        let state = CarouselState(activeIndex: 2, pageIndex: 4, ancestorDistanceFromActive: 0)
         XCTAssertFalse(state.isActiveOrNeighbor)
     }
 
     func testIsActiveOrNeighborUsesDataIndicesInExpandedCarousel() {
         // In a looping carousel, indices are from the expanded data array.
         // User starts in the middle copy (index 5 for a 5-page carousel).
-        let active = CarouselState(activeIndex: 5, pageIndex: 5, originalCount: 5)
-        let neighbor = CarouselState(activeIndex: 5, pageIndex: 6, originalCount: 5)
-        let distant = CarouselState(activeIndex: 5, pageIndex: 10, originalCount: 5)
+        let active = CarouselState(activeIndex: 5, pageIndex: 5, ancestorDistanceFromActive: 0)
+        let neighbor = CarouselState(activeIndex: 5, pageIndex: 6, ancestorDistanceFromActive: 0)
+        let distant = CarouselState(activeIndex: 5, pageIndex: 10, ancestorDistanceFromActive: 0)
 
         XCTAssertTrue(active.isActiveOrNeighbor)
         XCTAssertTrue(neighbor.isActiveOrNeighbor)
         XCTAssertFalse(distant.isActiveOrNeighbor)
     }
 
     func testIsActiveOrNeighborWithSinglePageCarousel() {
-        let state = CarouselState(activeIndex: 0, pageIndex: 0, originalCount: 1)
+        let state = CarouselState(activeIndex: 0, pageIndex: 0, ancestorDistanceFromActive: 0)
         XCTAssertTrue(state.isActiveOrNeighbor)
     }
 
     func testIsActiveOrNeighborWithTwoPageCarousel() {
         // Both pages are always neighbors in a 2-page carousel
-        let state1 = CarouselState(activeIndex: 0, pageIndex: 1, originalCount: 2)
+        let state1 = CarouselState(activeIndex: 0, pageIndex: 1, ancestorDistanceFromActive: 0)
         XCTAssertTrue(state1.isActiveOrNeighbor)
 
-        let state2 = CarouselState(activeI
```

**File**: `Tests/RevenueCatUITests/PaywallsV2/WebViewInstanceTests.swift` (modified, +162/-25)
```diff
@@ -129,7 +129,12 @@ final class WebViewInstanceTests: TestCase {
             let owned = try XCTUnwrap(viewModel.webViewInstance())
             let ownedWebView = owned.webView { WKWebView(frame: .zero) }
             // Built through the real representable so the coordinator's captures are the shipping ones.
-            _ = WebViewRepresentable(url: Self.url, instance: owned, idStore: store).makeCoordinator()
+            _ = WebViewRepresentable(
+                url: Self.url,
+                instance: owned,
+                idStore: store,
+                carouselDistance: 0
+            ).makeCoordinator()
 
             instance = owned
             webView = ownedWebView
@@ -209,7 +214,7 @@ final class WebViewInstanceHostAttachmentTests: TestCase {
         let webView = instance.webView { WKWebView(frame: .zero) }
         let host = self.makeWindowedHost()
 
-        instance.hostDidEnterWindow(host)
+        instance.reconcile(host: host)
 
         XCTAssertTrue(webView.superview === host)
     }
@@ -219,8 +224,8 @@ final class WebViewInstanceHostAttachmentTests: TestCase {
         let webView = instance.webView { WKWebView(frame: .zero) }
         let host = self.makeWindowedHost()
 
-        instance.hostDidEnterWindow(host)
-        instance.updateHost(host)
+        instance.reconcile(host: host)
+        instance.reconcile(host: host)
 
         XCTAssertTrue(webView.superview === host)
         XCTAssertEqual(host.subviews.count, 1)
@@ -232,22 +237,22 @@ final class WebViewInstanceHostAttachmentTests: TestCase {
         let displayed = self.makeWindowedHost()
         let other = self.makeWindowedHost()
 
-        instance.hostDidEnterWindow(displayed)
-        instance.hostDidEnterWindow(other)
+        instance.reconcile(host: displayed)
+        instance.reconcile(host: other)
 
         XCTAssertTrue(webView.superview === displayed)
     }
 
     /// SwiftUI may mount the incoming representable before unmounting the outgoing one. The incoming
     /// request must complete when the outgoing host leaves without requiring another update callback.
-    func testPendingHostTakesTheWebViewWhenTheCurrentHostLeavesItsWindow() {
+    func testIncomingCandidateTakesTheWebViewWhenTheAttachedHostLeavesItsWindow() {
         let instance = Self.makeInstance()
         let webView = instance.webView { WKWebView(frame: .zero) }
         let outgoing = self.makeWindowedHost()
         let incoming = self.makeWindowedHost()
 
-        instance.hostDidEnterWindow(outgoing)
-        instance.hostDidEnterWindow(incoming)
+        instance.reconcile(host: outgoing)
+        instance.reconcile(host: incoming)
         XCTAssertTrue(webView.superview === outgoing)
 
         outgoing.removeFromSuperview()
@@ -256,62 +261,193 @@ final class WebViewInstanceHostAttachmentTests: TestCase {
         XCTAssertTrue(webView.superview === incoming)
     }
 
-    func testPendingHostIsForgottenIfItLeavesBeforeTheCurrentHost() {
+    func testCandidateIsRemovedIfItLeavesBeforeTheAttachedHost() {
         let instance = Self.makeInstance()
         let webView = instance.webView { WKWebView(frame: .zero) }
         let displayed = self.makeWindowedHost()
-        let pending = self.makeWindowedHost()
+        let candidate = self.makeWindowedHost()
 
-        instance.hostDidEnterWindow(displayed)
-        instance.hostDidEnterWindow(pending)
-        pending.removeFromSuperview()
-        instance.hostDidLeaveWindow(pending)
+        instance.reconcile(host: displayed)
+        instance.reconcile(host: candidate)
+        candidate.removeFromSuperview()
+        instance.hostDidLeaveWindow(candidate)
         displayed.removeFromSuperview()
         instance.hostDidLeaveWindow(displayed)
 
         XCTAssertTrue(webView.superview === displayed)
     }
 
+    // MARK: - Carousel copies
+
+    /// In a looping carousel the off-screen copy at the start of the strip enters the window first; the
+    /// copy the user is looking at must win regardless.
+    func testActiveCarouselPageTakesTheWebViewFromAnEarlierOffscreenCopy() {
+        let instance = Self.makeInstance()
+        let webView = instance.webView { WKWebView(frame: .zero) }
+        let offscreenCopy = self.makeWindowedHost(carouselDistance: 3)
+        let activeCopy = self.makeWindowedHost(carouselDistance: 0)
+
+        instance.reconcile(host: offscreenCopy)
+        XCTAssertTrue(webView.superview === offscreenCopy)
+
+        instance.reconcile(host: activeCopy)
+
+        XCTAssertTrue(webView.superview === activeCopy)
+    }
+
+    func testFartherCarouselCopyCannotTakeTheWebViewFromTheActivePage() {
+        let instance = Self.makeInstance()
+        let webView = instance.webView { WKWebView(frame: .zero) }
+        let activeCopy = self.makeWindowedHost(carouselDistance: 0)
+        let neighborCopy = self.makeWindowedHost(carouselDistance: 1)
+
+        instance.reconcile(host: activeCopy)
+        instance.reconcile(host: neighborCopy)

```

#### Recent Merged Pull Requests:
- **PR #7917** (2026-10-05): Customer Center: fix crash on iOS 17 and 18 with Xcode 27 builds (@facumenzella)
- **PR #7909** (2026-10-05): Chore(deps): Bump fastlane-plugin-revenuecat_internal from `9f7a03e` to `c3e3afe` (@dependabot[bot])
- **PR #7907** (2026-10-02): Update baseline swiftinterface files for `support-bundle-suite-product-type` (@RCGitBot)
- **PR #7905** (2026-10-03): Remove video fade-in over the paywall thumbnail (@vegaro)
- **PR #7904** (2026-10-05): FEAT(Paywalls) enable min/max sizing (@JZDesign)
- **PR #7903** (closed): Allow triggering SDK update tests via @RCGitBot please test (@ajpallares)
- **PR #7899** (2026-10-02): Add Maestro flow for a workflow screen without text (@facumenzella)
- **PR #7898** (closed): Fix blank web_view component (@pnicholls)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
