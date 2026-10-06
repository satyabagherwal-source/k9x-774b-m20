# Forensic Learning Record (Deep Inspection): nalexn/clean-architecture-swiftui

> **Canonical Artifact**: `07_PROJECT_LEARNING/nalexn-clean-architecture-swiftui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nalexn/clean-architecture-swiftui](https://github.com/nalexn/clean-architecture-swiftui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:37.467Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nalexn/clean-architecture-swiftui`
- **Description**: SwiftUI sample app using Clean Architecture. Examples of working with SwiftData persistence, networking, dependency injection, unit testing, and more.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6606 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `CountriesSwiftUI/Core/App.swift`
```
//
//  CountriesApp.swift
//  CountriesSwiftUI
//
//  Created by Alexey on 7/11/24.
//  Copyright © 2024 Alexey Naumov. All rights reserved.
//

import SwiftUI
import EnvironmentOverrides

@main
struct MainApp: App {
    
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            appDelegate.rootView
        }
    }
}

extension AppEnvironment {
    var rootView: some View {
        VStack {
            if isRunningTests {
                Text("Running unit tests")
            } else {
                CountriesList()
                    .modifier(RootViewAppearance())
                    .modelContainer(modelContainer)
                    .attachEnvironmentOverrides(onChange: onChangeHandler)
                    .inject(diContainer)
                if modelContainer.isStub {
                    Text("⚠️ There is an issue with local database")
                        .font(.caption2)
                }
            }
        }
    }

    private var onChangeHandler: (EnvironmentValues.Diff) -> Void {
        return { diff in
            if !diff.isDisjoint(with: [.locale, .sizeCategory]) {
                self.diContainer.appState[\.routing] = AppState.ViewRouting()
            }
        }
    }
}

```

### Core Architecture Module: `CountriesSwiftUI/Core/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 23.10.2019.
//  Copyright © 2019 Alexey Naumov. All rights reserved.
//

import UIKit
import SwiftUI
import Combine
import Foundation

@MainActor
final class AppDelegate: UIResponder, UIApplicationDelegate {

    private lazy var environment = AppEnvironment.bootstrap()
    private var systemEventsHandler: SystemEventsHandler { environment.systemEventsHandler }

    var rootView: some View {
        environment.rootView
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions
        launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config: UISceneConfiguration = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        SceneDelegate.register(systemEventsHandler)
        return config
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        systemEventsHandler.handlePushRegistration(result: .success(deviceToken))
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        systemEventsHandler.handlePushRegistration(result: .failure(error))
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
        return await systemEventsHandler
            .appDidReceiveRemoteNotification(payload: userInfo)
    }
}

// MARK: - SceneDelegate

@MainActor
final class SceneDelegate: UIResponder, UIWindowSceneDelegate, ObservableObject {

    private static var systemEventsHandler: SystemEventsHandler?
    private var systemEventsHandler: SystemEventsHandler? { Self.systemEventsHandler }

    static func register(_ systemEventsHandler: SystemEventsHandler?) {
        Self.systemEventsHandler = systemEventsHandler
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        systemEventsHandler?.sceneOpenURLContexts(URLContexts)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        systemEventsHandler?.sceneDidBecomeActive()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        systemEventsHandler?.sceneWillResignActive()
    }
}

```

### Core Architecture Module: `CountriesSwiftUI/Core/AppState.swift`
```
//
//  AppState.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 23.10.2019.
//  Copyright © 2019 Alexey Naumov. All rights reserved.
//

import SwiftUI
import Combine

struct AppState: Equatable {
    var routing = ViewRouting()
    var system = System()
    var permissions = Permissions()
}

extension AppState {
    struct ViewRouting: Equatable {
        var countriesList = CountriesList.Routing()
        var countryDetails = CountryDetails.Routing()
    }
}

extension AppState {
    struct System: Equatable {
        var isActive: Bool = false
        var keyboardHeight: CGFloat = 0
    }
}

extension AppState {
    struct Permissions: Equatable {
        var push: Permission.Status = .unknown
    }

    static func permissionKeyPath(for permission: Permission) -> WritableKeyPath<AppState, Permission.Status> {
        let pathToPermissions = \AppState.permissions
        switch permission {
        case .pushNotifications:
            return pathToPermissions.appending(path: \.push)
        }
    }
}

func == (lhs: AppState, rhs: AppState) -> Bool {
    return lhs.routing == rhs.routing
        && lhs.system == rhs.system
        && lhs.permissions == rhs.permissions
}

```

### Core Architecture Module: `CountriesSwiftUI/Core/DeepLinksHandler.swift`
```
//
//  DeepLinksHandler.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 26.04.2020.
//  Copyright © 2020 Alexey Naumov. All rights reserved.
//

import Foundation

enum DeepLink: Equatable {
    
    case showCountryFlag(alpha3Code: String)

    init?(url: URL) {
        guard
            let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
            components.host == "www.example.com",
            let query = components.queryItems
            else { return nil }
        if let item = query.first(where: { $0.name == "alpha3code" }),
            let alpha3Code = item.value {
            self = .showCountryFlag(alpha3Code: alpha3Code)
            return
        }
        return nil
    }
}

// MARK: - DeepLinksHandler

@MainActor
protocol DeepLinksHandler {
    func open(deepLink: DeepLink)
}

struct RealDeepLinksHandler: DeepLinksHandler {
    
    private let container: DIContainer
    
    init(container: DIContainer) {
        self.container = container
    }
    
    func open(deepLink: DeepLink) {
        switch deepLink {
        case let .showCountryFlag(alpha3Code):
            let routeToDestination = {
                self.container.appState.bulkUpdate {
                    $0.routing.countriesList.countryCode = alpha3Code
                    $0.routing.countryDetails.detailsSheet = true
                }
            }
            /*
             SwiftUI is unable to perform complex navigation involving
             simultaneous dismissal or older screens and presenting new ones.
             A work around is to perform the navigation in two steps:
             */
            let defaultRouting = AppState.ViewRouting()
            if container.appState.value.routing != defaultRouting {
                self.container.appState[\.routing] = defaultRouting
                let delay: DispatchTime = .now() + (ProcessInfo.processInfo.isRunningTests ? 0 : 1.5)
                DispatchQueue.main.asyncAfter(deadline: delay, execute: routeToDestination)
            } else {
                routeToDestination()
            }
        }
    }
}

```

### Core Architecture Module: `CountriesSwiftUI/Core/PushNotificationsHandler.swift`
```
//
//  PushNotificationsHandler.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 26.04.2020.
//  Copyright © 2020 Alexey Naumov. All rights reserved.
//

import UserNotifications

protocol PushNotificationsHandler { }

final class RealPushNotificationsHandler: NSObject, PushNotificationsHandler {
    
    private let deepLinksHandler: DeepLinksHandler
    
    init(deepLinksHandler: DeepLinksHandler) {
        self.deepLinksHandler = deepLinksHandler
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension RealPushNotificationsHandler: UNUserNotificationCenterDelegate {
    
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler:
        @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.list, .banner, .sound])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        handleNotification(userInfo: userInfo, completionHandler: completionHandler)
    }
    
    func handleNotification(userInfo: [AnyHashable: Any], completionHandler: @escaping () -> Void) {
        guard let payload = userInfo["aps"] as? [AnyHashable: Any],
            let countryCode = payload["country"] as? String else {
            completionHandler()
            return
        }
        Task { @MainActor in
            deepLinksHandler.open(deepLink: .showCountryFlag(alpha3Code: countryCode))
            completionHandler()
        }
    }
}

```

### Core Architecture Module: `CountriesSwiftUI/Core/SystemEventsHandler.swift`
```
//
//  SystemEventsHandler.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 27.10.2019.
//  Copyright © 2019 Alexey Naumov. All rights reserved.
//

import UIKit
import Combine

@MainActor
protocol SystemEventsHandler {
    func sceneOpenURLContexts(_ urlContexts: Set<UIOpenURLContext>)
    func sceneDidBecomeActive()
    func sceneWillResignActive()
    func handlePushRegistration(result: Result<Data, Error>)
    @MainActor
    func appDidReceiveRemoteNotification(payload: [AnyHashable: Any]) async -> UIBackgroundFetchResult
}

struct RealSystemEventsHandler: SystemEventsHandler {

    let container: DIContainer
    let deepLinksHandler: DeepLinksHandler
    let pushNotificationsHandler: PushNotificationsHandler
    let pushTokenWebRepository: PushTokenWebRepository
    private let cancelBag = CancelBag()

    init(container: DIContainer,
         deepLinksHandler: DeepLinksHandler,
         pushNotificationsHandler: PushNotificationsHandler,
         pushTokenWebRepository: PushTokenWebRepository) {

        self.container = container
        self.deepLinksHandler = deepLinksHandler
        self.pushNotificationsHandler = pushNotificationsHandler
        self.pushTokenWebRepository = pushTokenWebRepository

        installKeyboardHeightObserver()
        installPushNotificationsSubscriberOnLaunch()
    }

    private func installKeyboardHeightObserver() {
        let appState = container.appState
        NotificationCenter.default.keyboardHeightPublisher
            .sink { [appState] height in
                appState[\.system.keyboardHeight] = height
            }
            .store(in: cancelBag)
    }

    private func installPushNotificationsSubscriberOnLaunch() {
        weak var permissions = container.interactors.userPermissions
        container.appState
            .updates(for: AppState.permissionKeyPath(for: .pushNotifications))
            .first(where: { $0 != .unknown })
            .sink { status in
                if status == .granted {
                    // If the permission was granted on previous launch
                    // requesting the push token again:
                    permissions?.request(permission: .pushNotifications)
                }
            }
            .store(in: cancelBag)
    }

    func sceneOpenURLContexts(_ urlContexts: Set<UIOpenURLContext>) {
        guard let url = urlContexts.first?.url else { return }
        handle(url: url)
    }

    private func handle(url: URL) {
        guard let deepLink = DeepLink(url: url) else { return }
        deepLinksHandler.open(deepLink: deepLink)
    }

    func sceneDidBecomeActive() {
        container.appState[\.system.isActive] = true
        container.interactors.userPermissions.resolveStatus(for: .pushNotifications)
    }

    func sceneWillResignActive() {
        container.appState[\.system.isActive] = false
    }

    func handlePushRegistration(result: Result<Data, Error>) {

    }

    func appDidReceiveRemoteNotification(payload: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
        return .noData
    }
}

// MARK: - Notifications

private extension NotificationCenter {
    var keyboardHeightPublisher: AnyPublisher<CGFloat, Never> {
        let willShow = publisher(for: UIApplication.keyboardWillShowNotification)
            .map { $0.keyboardHeight }
        let willHide = publisher(for: UIApplication.keyboardWillHideNotification)
            .map { _ in CGFloat(0) }
        return Publishers.Merge(willShow, willHide)
            .eraseToAnyPublisher()
    }
}

private extension Notification {
    var keyboardHeight: CGFloat {
        return (userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?
            .cgRectValue.height ?? 0
    }
}

```

### Core Architecture Module: `CountriesSwiftUI/Utilities/CancelBag.swift`
```
//
//  CancelBag.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 04.04.2020.
//  Copyright © 2020 Alexey Naumov. All rights reserved.
//

import Combine

final class CancelBag {
    fileprivate(set) var subscriptions = [any Cancellable]()
    private let equalToAny: Bool
    
    init(equalToAny: Bool = false) {
        self.equalToAny = equalToAny
    }
    
    func cancel() {
        subscriptions.removeAll()
    }
    
    func isEqual(to other: CancelBag) -> Bool {
        return other === self || other.equalToAny || self.equalToAny
    }
}

extension Cancellable {
    
    func store(in cancelBag: CancelBag) {
        cancelBag.subscriptions.append(self)
    }
}

extension Task: @retroactive Cancellable { }

```

### Core Architecture Module: `CountriesSwiftUI/Utilities/Helpers.swift`
```
//
//  Helpers.swift
//  CountriesSwiftUI
//
//  Created by Alexey on 7/11/24.
//  Copyright © 2024 Alexey Naumov. All rights reserved.
//

import Foundation
import Combine

extension ProcessInfo {
    var isRunningTests: Bool {
        environment["XCTestConfigurationFilePath"] != nil
    }
}

extension String {
    func localized(_ locale: Locale) -> String {
        let localeId = locale.shortIdentifier
        guard let path = Bundle.main.path(forResource: localeId, ofType: "lproj"),
            let bundle = Bundle(path: path) else {
            return NSLocalizedString(self, comment: "")
        }
        return bundle.localizedString(forKey: self, value: nil, table: nil)
    }
}

extension Locale {
    static var backendDefault: Locale {
        return Locale(identifier: "en")
    }

    var shortIdentifier: String {
        return String(identifier.prefix(2))
    }
}

extension Result {
    var isSuccess: Bool {
        switch self {
        case .success: return true
        case .failure: return false
        }
    }
}

// MARK: - View Inspection helper

internal final class Inspection<V> {
    let notice = PassthroughSubject<UInt, Never>()
    var callbacks = [UInt: (V) -> Void]()

    func visit(_ view: V, _ line: UInt) {
        if let callback = callbacks.removeValue(forKey: line) {
            callback(view)
        }
    }
}

```

### Core Architecture Module: `CountriesSwiftUI/Utilities/Loadable.swift`
```
//
//  Loadable.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 23.10.2019.
//  Copyright © 2019 Alexey Naumov. All rights reserved.
//

import Foundation
import SwiftUI

typealias LoadableSubject<T> = Binding<Loadable<T>>

enum Loadable<T> {

    case notRequested
    case isLoading(last: T?, cancelBag: CancelBag)
    case loaded(T)
    case failed(Error)

    var value: T? {
        switch self {
        case let .loaded(value): return value
        case let .isLoading(last, _): return last
        default: return nil
        }
    }
    var error: Error? {
        switch self {
        case let .failed(error): return error
        default: return nil
        }
    }
}

extension Loadable {
    
    mutating func setIsLoading(cancelBag: CancelBag) {
        self = .isLoading(last: value, cancelBag: cancelBag)
    }
    
    mutating func cancelLoading() {
        switch self {
        case let .isLoading(last, cancelBag):
            cancelBag.cancel()
            if let last = last {
                self = .loaded(last)
            } else {
                let error = NSError(
                    domain: NSCocoaErrorDomain, code: NSUserCancelledError,
                    userInfo: [NSLocalizedDescriptionKey: NSLocalizedString("Canceled by user", comment: "")])
                self = .failed(error)
            }
        default: break
        }
    }
    
    func map<V>(_ transform: (T) throws -> V) -> Loadable<V> {
        do {
            switch self {
            case .notRequested: return .notRequested
            case let .failed(error): return .failed(error)
            case let .isLoading(value, cancelBag):
                return .isLoading(last: try value.map { try transform($0) },
                                  cancelBag: cancelBag)
            case let .loaded(value):
                return .loaded(try transform(value))
            }
        } catch {
            return .failed(error)
        }
    }
}

protocol SomeOptional {
    associatedtype Wrapped
    func unwrap() throws -> Wrapped
}

struct ValueIsMissingError: Error {
    var localizedDescription: String {
        NSLocalizedString("Data is missing", comment: "")
    }
}

extension Optional: SomeOptional {
    func unwrap() throws -> Wrapped {
        switch self {
        case let .some(value): return value
        case .none: throw ValueIsMissingError()
        }
    }
}

extension Loadable where T: SomeOptional {
    func unwrap() -> Loadable<T.Wrapped> {
        map { try $0.unwrap() }
    }
}

extension Loadable: Equatable where T: Equatable {
    static func == (lhs: Loadable<T>, rhs: Loadable<T>) -> Bool {
        switch (lhs, rhs) {
        case (.notRequested, .notRequested): return true
        case let (.isLoading(lhsV, lhsC), .isLoading(rhsV, rhsC)):
            return lhsV == rhsV && lhsC.isEqual(to: rhsC)
        case let (.loaded(lhsV), .loaded(rhsV)): return lhsV == rhsV
        case let (.failed(lhsE), .failed(rhsE)):
            return lhsE.localizedDescription == rhsE.localizedDescription
        default: return false
        }
    }
}

extension LoadableSubject {
    func load<T>(_ resource: @escaping () async throws -> T) where Value == Loadable<T> {
        let cancelBag = CancelBag()
        wrappedValue.setIsLoading(cancelBag: cancelBag)
        let task = Task {
            do {
                wrappedValue = .loaded(try await resource())
            } catch {
                wrappedValue = .failed(error)
            }
        }
        task.store(in: cancelBag)
    }
}

```

### Core Architecture Module: `CountriesSwiftUI/Utilities/Store.swift`
```
//
//  Store.swift
//  CountriesSwiftUI
//
//  Created by Alexey Naumov on 04.04.2020.
//  Copyright © 2020 Alexey Naumov. All rights reserved.
//

import SwiftUI
import Combine

typealias Store<State> = CurrentValueSubject<State, Never>

extension Store {

    subscript<T>(keyPath: WritableKeyPath<Output, T>) -> T where T: Equatable {
        get { value[keyPath: keyPath] }
        set {
            var value = self.value
            if value[keyPath: keyPath] != newValue {
                value[keyPath: keyPath] = newValue
                self.value = value
            }
        }
    }

    func bulkUpdate(_ update: (inout Output) -> Void) {
        var value = self.value
        update(&value)
        self.value = value
    }

    func updates<Value>(for keyPath: KeyPath<Output, Value>) ->
        AnyPublisher<Value, Failure> where Value: Equatable {
        return map(keyPath).removeDuplicates().eraseToAnyPublisher()
    }
}

// MARK: -

extension Binding where Value: Equatable {
    func dispatched<State>(to state: Store<State>,
                           _ keyPath: WritableKeyPath<State, Value>) -> Self {
        return onSet { state[keyPath] = $0 }
    }
}

extension Binding where Value: Equatable {
    typealias ValueClosure = (Value) -> Void

    func onSet(_ perform: @escaping ValueClosure) -> Self {
        return .init(get: { () -> Value in
            self.wrappedValue
        }, set: { value in
            if self.wrappedValue != value {
                self.wrappedValue = value
            }
            perform(value)
        })
    }
}


```

### Core Architecture Module: `CountriesSwiftUI/DependencyInjection/AppEnvironment.swift`
```
//
//  AppEnvironment.swift
//  CountriesSwiftUI
//
//  Created by Alexey on 7/11/24.
//  Copyright © 2024 Alexey Naumov. All rights reserved.
//

import UIKit
import SwiftData

@MainActor
struct AppEnvironment {
    let isRunningTests: Bool
    let diContainer: DIContainer
    let modelContainer: ModelContainer
    let systemEventsHandler: SystemEventsHandler
}

extension AppEnvironment {

    static func bootstrap() -> AppEnvironment {
        let appState = Store<AppState>(AppState())
        /*
         To see the deep linking in action:

         1. Launch the app in iOS 13.4 simulator (or newer)
         2. Subscribe on Push Notifications with "Allow Push" button
         3. Minimize the app
         4. Drag & drop "push_with_deeplink.apns" into the Simulator window
         5. Tap on the push notification

         Alternatively, just copy the code below before the "return" and launch:

            DispatchQueue.main.async {
                deepLinksHandler.open(deepLink: .showCountryFlag(alpha3Code: "AFG"))
            }
        */
        let session = configuredURLSession()
        let webRepositories = configuredWebRepositories(session: session)
        let modelContainer = configuredModelContainer()
        let dbRepositories = configuredDBRepositories(modelContainer: modelContainer)
        let interactors = configuredInteractors(appState: appState, webRepositories: webRepositories, dbRepositories: dbRepositories)
        let diContainer = DIContainer(appState: appState, interactors: interactors)
        let deepLinksHandler = RealDeepLinksHandler(container: diContainer)
        let pushNotificationsHandler = RealPushNotificationsHandler(deepLinksHandler: deepLinksHandler)
        let systemEventsHandler = RealSystemEventsHandler(
            container: diContainer,
            deepLinksHandler: deepLinksHandler,
            pushNotificationsHandler: pushNotificationsHandler,
            pushTokenWebRepository: webRepositories.pushToken)
        return AppEnvironment(
            isRunningTests: ProcessInfo.processInfo.isRunningTests,
            diContainer: diContainer,
            modelContainer: modelContainer,
            systemEventsHandler: systemEventsHandler)
    }

    private static func configuredURLSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 60
        configuration.timeoutIntervalForResource = 120
        configuration.waitsForConnectivity = true
        configuration.httpMaximumConnectionsPerHost = 5
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        configuration.urlCache = .shared
        return URLSession(configuration: configuration)
    }

    private static func configuredWebRepositories(session: URLSession) -> DIContainer.WebRepositories {
        let images = RealImagesWebRepository(session: session)
        let countries = RealCountriesWebRepository(session: session)
        let pushToken = RealPushTokenWebRepository(session: session)
        return .init(images: images,
                     countries: countries,
                     pushToken: pushToken)
    }

    private static func configuredDBRepositories(modelContainer: ModelContainer) -> DIContainer.DBRepositories {
        let mainDBRepository = MainDBRepository(modelContainer: modelContainer)
        return .init(countries: mainDBRepository)
    }

    private static func configuredModelContainer() -> ModelContainer {
        do {
            return try ModelContainer.appModelContainer()
        } catch {
            // Log the error
            return ModelContainer.stub
        }
    }

    private static func configuredInteractors(
        appState: Store<AppState>,
        webRepositories: DIContainer.WebRepositories,
        dbRepositories: DIContainer.DBRepositories
    ) -> DIContainer.Interactors {
        let images = RealImagesInteractor(webRepository: webRepositories.images)
        let countries = RealCountriesInteractor(
            webRepository: webRepositories.countries,
            dbRepository: dbRepositories.countries)
        let userPermissions = RealUserPermissionsInteractor(
            appState: appState, openAppSettings: {
                URL(string: UIApplication.openSettingsURLString).flatMap {
                    UIApplication.shared.open($0, options: [:], completionHandler: nil)
                }
            })
        return .init(images: images,
                     countries: countries,
                     userPermissions: userPermissions)
    }
}

```

### Core Architecture Module: `CountriesSwiftUI/DependencyInjection/DIContainer.swift`
```
//
//  DIContainer.swift
//  CountriesSwiftUI
//
//  Created by Alexey on 7/11/24.
//  Copyright © 2024 Alexey Naumov. All rights reserved.
//

import SwiftUI
import SwiftData

struct DIContainer {

    let appState: Store<AppState>
    let interactors: Interactors

    init(appState: Store<AppState> = .init(AppState()), interactors: Interactors) {
        self.appState = appState
        self.interactors = interactors
    }

    init(appState: AppState, interactors: Interactors) {
        self.init(appState: Store<AppState>(appState), interactors: interactors)
    }
}

extension DIContainer {
    struct WebRepositories {
        let images: ImagesWebRepository
        let countries: CountriesWebRepository
        let pushToken: PushTokenWebRepository
    }
    struct DBRepositories {
        let countries: CountriesDBRepository
    }
    struct Interactors {
        let images: ImagesInteractor
        let countries: CountriesInteractor
        let userPermissions: UserPermissionsInteractor

        static var stub: Self {
            .init(images: StubImagesInteractor(),
                  countries: StubCountriesInteractor(),
                  userPermissions: StubUserPermissionsInteractor())
        }
    }
}

extension EnvironmentValues {
    @Entry var injected: DIContainer = DIContainer(appState: AppState(), interactors: .stub)
}

extension View {
    func inject(_ container: DIContainer) -> some View {
        return self
            .environment(\.injected, container)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #112** (2025-12-27): **Commit 1**
  *Symptoms*: Commit 1
  **Post-Mortem & Fix Analysis**:
  > Preparing review...
  > Preparing review...
  > Preparing review...

- **Issue #110** (2025-07-14): **Quick fix for the new API rule for \all route**
  *Symptoms*: The API provider recently enforced [adding fields to the \all endpoint](https://gitlab.com/restcountries/restcountries/-/issues/265). This PR fixes the issue by adding the necessary fields to the all countries endpoint.  In addition, the endpoint \name does not always return the borders for the country which causes the country view to break in the app - I don't know if this is new or not. The PR addresses this issue by making the relevant types optional. 

- **Issue #109** (2025-07-14): **Update .travis.yml**
  *Symptoms*: 

- **Issue #108** (2025-07-14): **feat: add Package.swift file**
  *Symptoms*: add Package.swift file, and we can open this repo on VSCode with Swift Extension  In order to make code completion and jump to definition features enabled: - use latest version of Swift Extension(current version is 2.2.0) - make sure Swift version is equal to or greater than 6.1 - use command `Swift: Select Target Platform...` to select iOS sdk
  **Post-Mortem & Fix Analysis**:
  > snapshot: ![image](https://github.com/user-attachments/assets/4140199c-68a8-49c0-af47-f3ddba8d7385) 

- **Issue #107** (2025-07-14): **fix: change baseURL to v3.1**
  *Symptoms*: should used v3.1 to get the latest country information  <img width="533" alt="image" src="https://github.com/user-attachments/assets/b3df48c7-980a-42a0-9111-93ca95c94efe" />  > https://restcountries.com/

- **Issue #105** (2025-07-14): **Sample**
  *Symptoms*: 

- **Issue #104** (2025-07-14): **Create new.txt**
  *Symptoms*: new file has been added

- **Issue #102** (2024-10-10): **ignore PR**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @psycho-baller are you sure this PR should be here? Looks like you want to do this on your own fork of the repo, not here

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

### Incident Patch 1: `9eca97b8` (2025-07-14)
**Commit Message**: fix: Revert API version change

**File**: `CountriesSwiftUI/Repositories/WebAPI/CountriesWebRepository.swift` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ struct RealCountriesWebRepository: CountriesWebRepository {
 
     init(session: URLSession) {
         self.session = session
-        self.baseURL = "https://restcountries.com/v3.1"
+        self.baseURL = "https://restcountries.com/v2"
     }
 
     func countries() async throws -> [ApiModel.Country] {
```

---

### Incident Patch 2: `8e5c34a9` (2025-07-14)
**Commit Message**: Merge pull request #107 from YoloMao/fix/web_api

fix: change baseURL to v3.1

**File**: `CountriesSwiftUI/Repositories/WebAPI/CountriesWebRepository.swift` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ struct RealCountriesWebRepository: CountriesWebRepository {
 
     init(session: URLSession) {
         self.session = session
-        self.baseURL = "https://restcountries.com/v2"
+        self.baseURL = "https://restcountries.com/v3.1"
     }
 
     func countries() async throws -> [ApiModel.Country] {
```

---

### Incident Patch 3: `c0a177a5` (2025-06-12)
**Commit Message**: Fix issue in countries with no neighbors

The type of the borders array returned by the API is optional

**File**: `CountriesSwiftUI/Repositories/Database/CountriesDBRepository.swift` (modified, +2/-2)
```diff
@@ -41,8 +41,8 @@ extension MainDBRepository: CountriesDBRepository {
         let alpha3Code = country.alpha3Code
         try modelContext.transaction {
             let currencies = countryDetails.currencies.map { $0.dbModel() }
-            let neighborsFetch = FetchDescriptor(predicate: #Predicate<DBModel.Country> {
-                countryDetails.borders.contains($0.alpha3Code)
+            let neighborsFetch = FetchDescriptor(predicate: #Predicate<DBModel.Country> { countryDBModel in
+                countryDetails.borders?.contains(countryDBModel.alpha3Code) == true
             })
             let neighbors = try modelContext.fetch(neighborsFetch)
             currencies.forEach {
```

**File**: `CountriesSwiftUI/Repositories/Models/CountryDetails.swift` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ extension DBModel {
         @Attribute(.unique) var alpha3Code: String
         var capital: String
         var currencies: [Currency]
-        var neighbors: [Country]
+        var neighbors: [Country]?
 
         init(alpha3Code: String, capital: String, currencies: [Currency], neighbors: [Country]) {
             self.alpha3Code = alpha3Code
@@ -33,6 +33,6 @@ extension ApiModel {
     struct CountryDetails: Codable, Equatable {
         let capital: String
         let currencies: [Currency]
-        let borders: [String]
+        let borders: [String]?
     }
 }
```

**File**: `CountriesSwiftUI/UI/CountryDetails/CountryDetailsView.swift` (modified, +4/-2)
```diff
@@ -105,8 +105,10 @@ private extension CountryDetails {
             if countryDetails.currencies.count > 0 {
                 currenciesSectionView(currencies: countryDetails.currencies)
             }
-            if countryDetails.neighbors.count > 0 {
-                neighborsSectionView(neighbors: countryDetails.neighbors)
+            if let neighbors = countryDetails.neighbors {
+                if neighbors.count  > 0 {
+                    neighborsSectionView(neighbors: neighbors)
+                }
             }
         }
         .listStyle(GroupedListStyle())
```

---

### Incident Patch 4: `9d2f4ad8` (2025-04-25)
**Commit Message**: fix: change baseURL to v3.1

**File**: `CountriesSwiftUI/Repositories/WebAPI/CountriesWebRepository.swift` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ struct RealCountriesWebRepository: CountriesWebRepository {
 
     init(session: URLSession) {
         self.session = session
-        self.baseURL = "https://restcountries.com/v2"
+        self.baseURL = "https://restcountries.com/v3.1"
     }
 
     func countries() async throws -> [ApiModel.Country] {
```

---

### Incident Patch 5: `87283f78` (2024-12-09)
**Commit Message**: Remove build status

**File**: `README.md` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ The app uses the [restcountries.com](https://restcountries.com/) REST API to sho
 
 For the example of handling the **authentication state** in the app, you can refer to my [other tiny project](https://github.com/nalexn/uikit-swiftui) that harnesses the locks and keys principle for solving this problem.
 
-![platforms](https://img.shields.io/badge/platforms-iPhone%20%7C%20iPad%20%7C%20macOS-lightgrey) [![Build Status](https://travis-ci.com/nalexn/clean-architecture-swiftui.svg?branch=master)](https://travis-ci.com/nalexn/clean-architecture-swiftui) [![codecov](https://codecov.io/gh/nalexn/clean-architecture-swiftui/branch/master/graph/badge.svg)](https://codecov.io/gh/nalexn/clean-architecture-swiftui) [![codebeat badge](https://codebeat.co/badges/db33561b-0b2b-4ee1-a941-a08efbd0ebd7)](https://codebeat.co/projects/github-com-nalexn-clean-architecture-swiftui-master)
+![platforms](https://img.shields.io/badge/platforms-iPhone%20%7C%20iPad%20%7C%20macOS-lightgrey) [![codecov](https://codecov.io/gh/nalexn/clean-architecture-swiftui/branch/master/graph/badge.svg)](https://codecov.io/gh/nalexn/clean-architecture-swiftui) [![codebeat badge](https://codebeat.co/badges/db33561b-0b2b-4ee1-a941-a08efbd0ebd7)](https://codebeat.co/projects/github-com-nalexn-clean-architecture-swiftui-master)
 
 <p align="center">
   <img src="https://github.com/nalexn/blob_files/blob/master/images/countries_preview.png?raw=true" alt="Diagram"/>
```

---

### Incident Patch 6: `28443c7a` (2024-09-26)
**Commit Message**: fix: Update tests for Xcode 16

**File**: `CountriesSwiftUI.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -1017,8 +1017,8 @@
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/nalexn/ViewInspector";
 			requirement = {
-				kind = upToNextMajorVersion;
-				minimumVersion = 0.9.7;
+				kind = exactVersion;
+				version = 0.10.0;
 			};
 		};
 		F6E7ACE023F5D1EC00AB48AB /* XCRemoteSwiftPackageReference "EnvironmentOverrides" */ = {
```

**File**: `UnitTests/UI/ContentViewTests.swift` (modified, +2/-2)
```diff
@@ -6,12 +6,12 @@ final class ContentViewTests: XCTestCase {
 
     func test_content_for_tests() throws {
         let sut = ContentView(container: .defaultValue, isRunningTests: true)
-        XCTAssertNoThrow(try sut.inspect().group().text(0))
+        XCTAssertNoThrow(try sut.inspect().implicitAnyView().group().text(0))
     }
     
     func test_content_for_build() throws {
         let sut = ContentView(container: .defaultValue, isRunningTests: false)
-        XCTAssertNoThrow(try sut.inspect().group().view(CountriesList.self, 0))
+        XCTAssertNoThrow(try sut.inspect().find(CountriesList.self))
     }
     
     func test_change_handler_for_colorScheme() throws {
```

**File**: `UnitTests/UI/CountriesListTests.swift` (modified, +5/-5)
```diff
@@ -21,7 +21,7 @@ final class CountriesListTests: XCTestCase {
             ))
         let sut = CountriesList(countries: .notRequested)
         let exp = sut.inspection.inspect { view in
-            XCTAssertNoThrow(try view.content().text(0))
+            XCTAssertNoThrow(try view.content().implicitAnyView().implicitAnyView().text(0))
             XCTAssertEqual(container.appState.value, AppState())
             container.interactors.verify()
         }
@@ -83,7 +83,7 @@ final class CountriesListTests: XCTestCase {
         let container = DIContainer(appState: AppState(), interactors: .mocked())
         let sut = CountriesList(countries: .failed(NSError.test))
         let exp = sut.inspection.inspect { view in
-            XCTAssertNoThrow(try view.content().view(ErrorView.self, 0))
+            XCTAssertNoThrow(try view.content().implicitAnyView().implicitAnyView().view(ErrorView.self, 0))
             XCTAssertEqual(container.appState.value, AppState())
             container.interactors.verify()
         }
@@ -98,8 +98,8 @@ final class CountriesListTests: XCTestCase {
         ))
         let sut = CountriesList(countries: .failed(NSError.test))
         let exp = sut.inspection.inspect { view in
-            let errorView = try view.content().view(ErrorView.self, 0)
-            try errorView.vStack().button(2).tap()
+            let errorView = try view.content().implicitAnyView().implicitAnyView().view(ErrorView.self, 0)
+            try errorView.implicitAnyView().vStack().button(2).tap()
             XCTAssertEqual(container.appState.value, AppState())
             container.interactors.verify()
         }
@@ -143,6 +143,6 @@ final class LocalizationTests: XCTestCase {
 
 extension InspectableView where View == ViewType.View<CountriesList> {
     func content() throws -> InspectableView<ViewType.NavigationView> {
-        return try geometryReader().navigationView()
+        return try implicitAnyView().geometryReader().navigationView()
     }
 }
```

**File**: `UnitTests/UI/CountryDetailsTests.swift` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ final class CountryDetailsTests: XCTestCase {
         let sut = CountryDetails(country: country, details: .failed(NSError.test))
         let exp = sut.inspection.inspect { view in
             let errorView = try view.find(ErrorView.self)
-            try errorView.vStack().button(2).tap()
+            try errorView.implicitAnyView().vStack().button(2).tap()
             interactors.verify()
         }
         ViewHosting.host(view: sut.inject(AppState(), interactors))
```

**File**: `UnitTests/UI/ImageViewTests.swift` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ import SwiftUI
 import ViewInspector
 @testable import CountriesSwiftUI
 
+@MainActor
 final class ImageViewTests: XCTestCase {
 
     let url = URL(string: "https://test.com/test.png")!
```

**File**: `UnitTests/UI/RootViewAppearanceTests.swift` (modified, +3/-2)
```diff
@@ -11,6 +11,7 @@ import SwiftUI
 import ViewInspector
 @testable import CountriesSwiftUI
 
+@MainActor
 final class RootViewAppearanceTests: XCTestCase {
 
     func test_blur_whenInactive() {
@@ -19,7 +20,7 @@ final class RootViewAppearanceTests: XCTestCase {
                                     interactors: .mocked())
         XCTAssertFalse(container.appState.value.system.isActive)
         let exp = sut.inspection.inspect { modifier in
-            let content = try modifier.viewModifierContent()
+            let content = try modifier.implicitAnyView().viewModifierContent()
             XCTAssertEqual(try content.blur().radius, 10)
         }
         let view = EmptyView().modifier(sut)
@@ -35,7 +36,7 @@ final class RootViewAppearanceTests: XCTestCase {
         container.appState[\.system.isActive] = true
         XCTAssertTrue(container.appState.value.system.isActive)
         let exp = sut.inspection.inspect { modifier in
-            let content = try modifier.viewModifierContent()
+            let content = try modifier.implicitAnyView().viewModifierContent()
             XCTAssertEqual(try content.blur().radius, 0)
         }
         let view = EmptyView().modifier(sut)
```

**File**: `UnitTests/UI/ViewPreviewsTests.swift` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ final class ViewPreviewsTests: XCTestCase {
     @MainActor
     func test_errorView_previews() throws {
         let view = ErrorView_Previews.previews
-        try view.inspect().view(ErrorView.self).actualView().retryAction()
+        try view.inspect().implicitAnyView().view(ErrorView.self).actualView().retryAction()
     }
     
     @MainActor
```

---

### Incident Patch 7: `9dcf12ae` (2024-06-25)
**Commit Message**: fix: add final keyword to class

**File**: `CountriesSwiftUI/System/PushNotificationsHandler.swift` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import UserNotifications
 
 protocol PushNotificationsHandler { }
 
-class RealPushNotificationsHandler: NSObject, PushNotificationsHandler {
+final class RealPushNotificationsHandler: NSObject, PushNotificationsHandler {
     
     private let deepLinksHandler: DeepLinksHandler
     
```

**File**: `CountriesSwiftUI/UI/Screens/CountriesList.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ private extension CountriesList {
          Variable `@Environment(\.locale) var locale: Locale`
          from the view is not accessible when searching by name
          */
-        class Container {
+        final class Container {
             var locale: Locale = .backendDefault
         }
         let container: Container
```

**File**: `CountriesSwiftUI/Utilities/LazyList.swift` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ struct LazyList<T> {
 }
 
 private extension LazyList {
-    class Cache {
+    final private class Cache {
         
         private var elements = [Int: T]()
         
```

**File**: `UnitTests/Interactors/UserPermissionsInteractorTests.swift` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import XCTest
 import Combine
 @testable import CountriesSwiftUI
 
-class UserPermissionsInteractorTests: XCTestCase {
+final class UserPermissionsInteractorTests: XCTestCase {
     
     var state = Store<AppState>(AppState())
     var sut: RealUserPermissionsInteractor!
```

**File**: `UnitTests/Mocks/MockedInteractors.swift` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ struct MockedImagesInteractor: Mock, ImagesInteractor {
 
 // MARK: - ImagesInteractor
 
-class MockedUserPermissionsInteractor: Mock, UserPermissionsInteractor {
+final class MockedUserPermissionsInteractor: Mock, UserPermissionsInteractor {
     
     enum Action: Equatable {
         case resolveStatus(Permission)
```

**File**: `UnitTests/Repositories/PushTokenWebRepositoryTests.swift` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import XCTest
 import Combine
 @testable import CountriesSwiftUI
 
-class PushTokenWebRepositoryTests: XCTestCase {
+final class PushTokenWebRepositoryTests: XCTestCase {
 
     private var sut: RealPushTokenWebRepository!
     private var cancelBag = CancelBag()
```

**File**: `UnitTests/System/DeepLinksHandlerTests.swift` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 import XCTest
 @testable import CountriesSwiftUI
 
-class DeepLinksHandlerTests: XCTestCase {
+final class DeepLinksHandlerTests: XCTestCase {
 
     func test_noSideEffectOnInit() {
         let interactors: DIContainer.Interactors = .mocked()
```

**File**: `UnitTests/System/PushNotificationsHandlerTests.swift` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import XCTest
 import UserNotifications
 @testable import CountriesSwiftUI
 
-class PushNotificationsHandlerTests: XCTestCase {
+final class PushNotificationsHandlerTests: XCTestCase {
     
     var sut: RealPushNotificationsHandler!
 
```

---

### Incident Patch 8: `1560381e` (2024-06-24)
**Commit Message**: fix: simplify self

**File**: `CountriesSwiftUI/Persistence/CoreDataHelpers.swift` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ protocol ManagedEntity: NSFetchRequestResult { }
 extension ManagedEntity where Self: NSManagedObject {
     
     static var entityName: String {
-        let nameMO = String(describing: Self.self)
+        let nameMO = String(describing: self)
         let suffixIndex = nameMO.index(nameMO.endIndex, offsetBy: -2)
         return String(nameMO[..<suffixIndex])
     }
```

---

### Incident Patch 9: `0126bfd6` (2024-06-20)
**Commit Message**: #99: Fix tests not compiling

**File**: `CountriesSwiftUI/UI/Screens/ContentView.swift` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ struct ContentView: View {
         }
     }
     
-    private var onChangeHandler: (EnvironmentValues.Diff) -> Void {
+    var onChangeHandler: (EnvironmentValues.Diff) -> Void {
         return { diff in
             if !diff.isDisjoint(with: [.locale, .sizeCategory]) {
                 self.container.appState[\.routing] = AppState.ViewRouting()
```

**File**: `CountriesSwiftUI/UI/Screens/CountriesList.swift` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ struct CountriesList: View {
     @Environment(\.locale) private var locale: Locale
     private let localeContainer = LocaleReader.Container()
     
-    private let inspection = Inspection<Self>()
+    let inspection = Inspection<Self>()
     
     init(countries: Loadable<LazyList<Country>> = .notRequested) {
         self._countries = .init(initialValue: countries)
```

**File**: `CountriesSwiftUI/UI/Screens/CountryDetails.swift` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ struct CountryDetails: View {
     private var routingBinding: Binding<Routing> {
         $routingState.dispatched(to: injected.appState, \.routing.countryDetails)
     }
-    private let inspection = Inspection<Self>()
+    let inspection = Inspection<Self>()
     
     init(country: Country, details: Loadable<Country.Details> = .notRequested) {
         self.country = country
```

---

### Incident Patch 10: `7f165d27` (2024-06-20)
**Commit Message**: fix: change access control and from variables to constants

**File**: `CountriesSwiftUI/System/SystemEventsHandler.swift` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ struct RealSystemEventsHandler: SystemEventsHandler {
     let deepLinksHandler: DeepLinksHandler
     let pushNotificationsHandler: PushNotificationsHandler
     let pushTokenWebRepository: PushTokenWebRepository
-    private var cancelBag = CancelBag()
+    private let cancelBag = CancelBag()
     
     init(container: DIContainer,
          deepLinksHandler: DeepLinksHandler,
```

**File**: `CountriesSwiftUI/UI/Components/DetailRow.swift` (modified, +2/-2)
```diff
@@ -9,8 +9,8 @@
 import SwiftUI
 
 struct DetailRow: View {
-    let leftLabel: Text
-    let rightLabel: Text
+    private let leftLabel: Text
+    private let rightLabel: Text
     
     init(leftLabel: Text, rightLabel: Text) {
         self.leftLabel = leftLabel
```

**File**: `CountriesSwiftUI/UI/Components/ImageView.swift` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import Combine
 
 struct ImageView: View {
     
-    let imageURL: URL
+    private let imageURL: URL
     @Environment(\.injected) var injected: DIContainer
     @State private var image: Loadable<UIImage>
     let inspection = Inspection<Self>()
```

**File**: `CountriesSwiftUI/UI/Components/SearchBar.swift` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ struct SearchBar: UIViewRepresentable {
 extension SearchBar {
     final class Coordinator: NSObject, UISearchBarDelegate {
         
-        let text: Binding<String>
+        private let text: Binding<String>
         
         init(text: Binding<String>) {
             self.text = text
```

**File**: `CountriesSwiftUI/UI/Screens/ContentView.swift` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ struct ContentView: View {
         }
     }
     
-    var onChangeHandler: (EnvironmentValues.Diff) -> Void {
+    private var onChangeHandler: (EnvironmentValues.Diff) -> Void {
         return { diff in
             if !diff.isDisjoint(with: [.locale, .sizeCategory]) {
                 self.container.appState[\.routing] = AppState.ViewRouting()
```

**File**: `CountriesSwiftUI/UI/Screens/CountriesList.swift` (modified, +4/-4)
```diff
@@ -22,7 +22,7 @@ struct CountriesList: View {
     @Environment(\.locale) private var locale: Locale
     private let localeContainer = LocaleReader.Container()
     
-    let inspection = Inspection<Self>()
+    private let inspection = Inspection<Self>()
     
     init(countries: Loadable<LazyList<Country>> = .notRequested) {
         self._countries = .init(initialValue: countries)
@@ -199,15 +199,15 @@ extension CountriesList {
 
 private extension CountriesList {
     
-    var routingUpdate: AnyPublisher<Routing, Never> {
+    private var routingUpdate: AnyPublisher<Routing, Never> {
         injected.appState.updates(for: \.routing.countriesList)
     }
     
-    var keyboardHeightUpdate: AnyPublisher<CGFloat, Never> {
+    private var keyboardHeightUpdate: AnyPublisher<CGFloat, Never> {
         injected.appState.updates(for: \.system.keyboardHeight)
     }
     
-    var canRequestPushPermissionUpdate: AnyPublisher<Bool, Never> {
+    private var canRequestPushPermissionUpdate: AnyPublisher<Bool, Never> {
         injected.appState.updates(for: AppState.permissionKeyPath(for: .pushNotifications))
             .map { $0 == .notRequested || $0 == .denied }
             .eraseToAnyPublisher()
```

**File**: `CountriesSwiftUI/UI/Screens/CountryDetails.swift` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@ import Combine
 
 struct CountryDetails: View {
     
-    let country: Country
+    private let country: Country
     
     @Environment(\.locale) var locale: Locale
     @Environment(\.injected) private var injected: DIContainer
@@ -20,7 +20,7 @@ struct CountryDetails: View {
     private var routingBinding: Binding<Routing> {
         $routingState.dispatched(to: injected.appState, \.routing.countryDetails)
     }
-    let inspection = Inspection<Self>()
+    private let inspection = Inspection<Self>()
     
     init(country: Country, details: Loadable<Country.Details> = .notRequested) {
         self.country = country
```

**File**: `CountriesSwiftUI/Utilities/LazyList.swift` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ struct LazyList<T> {
     typealias Access = (Int) throws -> T?
     private let access: Access
     private let useCache: Bool
-    private var cache = Cache()
+    private let cache = Cache()
     
     let count: Int
     
```

---

### Incident Patch 11: `62be15e2` (2024-06-06)
**Commit Message**: Merge pull request #97 from romekem/layoutDirectionFix

Fix displaying LTR after switch from RTL

**File**: `CountriesSwiftUI/UI/Screens/CountriesList.swift` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ struct CountriesList: View {
         .onReceive(routingUpdate) { self.routingState = $0 }
         .onReceive(canRequestPushPermissionUpdate) { self.canRequestPushPermission = $0 }
         .onReceive(inspection.notice) { self.inspection.visit(self, $0) }
+        .flipsForRightToLeftLayoutDirection(true)
     }
     
     @ViewBuilder private var content: some View {
```

---

### Incident Patch 12: `e589c245` (2024-06-05)
**Commit Message**: Fix displaying LTR after switch from RTL

**File**: `CountriesSwiftUI/UI/Screens/CountriesList.swift` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ struct CountriesList: View {
         .onReceive(routingUpdate) { self.routingState = $0 }
         .onReceive(canRequestPushPermissionUpdate) { self.canRequestPushPermission = $0 }
         .onReceive(inspection.notice) { self.inspection.visit(self, $0) }
+        .flipsForRightToLeftLayoutDirection(true)
     }
     
     @ViewBuilder private var content: some View {
```

---

### Incident Patch 13: `000eb38c` (2023-11-11)
**Commit Message**: Fix failing test in iOS 17

**File**: `UnitTests/Repositories/WebRepositoryTests.swift` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ extension TestWebRepository {
         
         var path: String {
             if self == .urlError {
-                return "😋😋😋"
+                return "\\"
             }
             return "/test/path"
         }
```

---

### Incident Patch 14: `231a47f8` (2023-11-11)
**Commit Message**: #88: Fix tests failing for updated Loadable

**File**: `CountriesSwiftUI/Utilities/CancelBag.swift` (modified, +9/-0)
```diff
@@ -10,10 +10,19 @@ import Combine
 
 final class CancelBag {
     fileprivate(set) var subscriptions = Set<AnyCancellable>()
+    private let equalToAny: Bool
+    
+    init(equalToAny: Bool = false) {
+        self.equalToAny = equalToAny
+    }
     
     func cancel() {
         subscriptions.removeAll()
     }
+    
+    func isEqual(to other: CancelBag) -> Bool {
+        return other === self || other.equalToAny || self.equalToAny
+    }
 }
 
 extension AnyCancellable {
```

**File**: `CountriesSwiftUI/Utilities/Loadable.swift` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ extension Loadable: Equatable where T: Equatable {
         switch (lhs, rhs) {
         case (.notRequested, .notRequested): return true
         case let (.isLoading(lhsV, lhsC), .isLoading(rhsV, rhsC)):
-            return lhsV == rhsV && lhsC === rhsC
+            return lhsV == rhsV && lhsC.isEqual(to: rhsC)
         case let (.loaded(lhsV), .loaded(rhsV)): return lhsV == rhsV
         case let (.failed(lhsE), .failed(rhsE)):
             return lhsE.localizedDescription == rhsE.localizedDescription
```

**File**: `UnitTests/Interactors/CountriesInteractorTests.swift` (modified, +9/-9)
```diff
@@ -60,7 +60,7 @@ final class LoadCountriesTests: CountriesInteractorTests {
         countries.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .loaded(list.lazyList)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
@@ -93,7 +93,7 @@ final class LoadCountriesTests: CountriesInteractorTests {
         countries.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .failed(error)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
@@ -126,7 +126,7 @@ final class LoadCountriesTests: CountriesInteractorTests {
         countries.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .failed(error)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
@@ -163,7 +163,7 @@ final class LoadCountriesTests: CountriesInteractorTests {
         countries.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .loaded(list.lazyList)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
@@ -199,7 +199,7 @@ final class LoadCountriesTests: CountriesInteractorTests {
         countries.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .failed(error)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
@@ -236,7 +236,7 @@ final class LoadCountryDetailsTests: CountriesInteractorTests {
         details.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .loaded(data.details)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
@@ -270,7 +270,7 @@ final class LoadCountryDetailsTests: CountriesInteractorTests {
         details.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .failed(error)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
@@ -307,7 +307,7 @@ final class LoadCountryDetailsTests: CountriesInteractorTests {
         details.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .failed(error)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
@@ -343,7 +343,7 @@ final class LoadCountryDetailsTests: CountriesInteractorTests {
         details.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .loaded(data.details)
             ], removing: Country.prefixes)
             self.mockedWebRepo.verify()
```

**File**: `UnitTests/Interactors/ImagesInteractorTests.swift` (modified, +3/-3)
```diff
@@ -57,7 +57,7 @@ final class ImagesInteractorTests: XCTestCase {
         image.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .loaded(self.testImage)
             ])
             self.verifyRepoActions()
@@ -76,7 +76,7 @@ final class ImagesInteractorTests: XCTestCase {
         image.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .notRequested,
-                .isLoading(last: nil, cancelBag: CancelBag()),
+                .isLoading(last: nil, cancelBag: .test),
                 .failed(error)
             ])
             self.verifyRepoActions()
@@ -95,7 +95,7 @@ final class ImagesInteractorTests: XCTestCase {
         image.updatesRecorder.sink { updates in
             XCTAssertEqual(updates, [
                 .loaded(self.testImage),
-                .isLoading(last: self.testImage, cancelBag: CancelBag()),
+                .isLoading(last: self.testImage, cancelBag: .test),
                 .failed(error)
             ])
             self.verifyRepoActions()
```

**File**: `UnitTests/Utilities/LoadableTests.swift` (modified, +8/-2)
```diff
@@ -61,8 +61,8 @@ final class LoadableTests: XCTestCase {
         ]
         let expect: [Loadable<String>] = [
             .notRequested,
-            .isLoading(last: nil, cancelBag: CancelBag()),
-            .isLoading(last: "5", cancelBag: CancelBag()),
+            .isLoading(last: nil, cancelBag: .test),
+            .isLoading(last: "5", cancelBag: .test),
             .loaded("7"),
             .failed(NSError.test)
         ]
@@ -100,3 +100,9 @@ final class LoadableTests: XCTestCase {
         XCTAssertEqual(ValueIsMissingError().localizedDescription, "Data is missing")
     }
 }
+
+extension CancelBag {
+    static var test: CancelBag {
+        return CancelBag(equalToAny: true)
+    }
+}
```

---

### Incident Patch 15: `be180f97` (2023-06-24)
**Commit Message**: fix: Skip one test when running on a simulator

**File**: `UnitTests/System/AppDelegateTests.swift` (modified, +5/-1)
```diff
@@ -41,9 +41,13 @@ final class AppDelegateTests: XCTestCase {
         eventsHandler.verify()
     }
     
-    func test_systemEventsHandler() {
+    func test_systemEventsHandler() throws {
+        #if targetEnvironment(simulator)
+        throw XCTSkip()
+        #else
         let sut = AppDelegate()
         let handler = sut.systemEventsHandler
         XCTAssertTrue(handler is RealSystemEventsHandler)
+        #endif
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #112** (closed): Commit 1 (@CoTMMO)
- **PR #110** (2025-07-14): Quick fix for the new API rule for \all route (@maalhamdan)
- **PR #109** (2025-07-14): Update .travis.yml (@Sumesh1294)
- **PR #108** (2025-07-14): feat: add Package.swift file (@YoloMao)
- **PR #107** (2025-07-14): fix: change baseURL to v3.1 (@YoloMao)
- **PR #105** (closed): Sample (@Aarya111024)
- **PR #104** (closed): Create new.txt (@Isabellairwin)
- **PR #102** (closed): ignore PR (@rami-maalouf)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
