# Forensic Learning Record (Deep Inspection): hmlongco/Factory

> **Canonical Artifact**: `07_PROJECT_LEARNING/hmlongco-factory-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hmlongco/Factory](https://github.com/hmlongco/Factory))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:18:53.414Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hmlongco/Factory`
- **Description**: A modern approach to Container-Based Dependency Injection for Swift and SwiftUI.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2913 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `FactoryDemo/FactoryDemo/Concepts/Actors.swift`
```
//
//  SomeActor.swift
//  FactoryDemo
//
//  Created by Michael Long on 9/12/22.
//

import Foundation
import FactoryKit

extension Container {
    var myActor: Factory<SomeActor> { self { SomeActor() } }
    var mainActorFuncTest: Factory<MainActorFuncTest> { self { MainActorFuncTest() } }
}

extension Container {
    @MainActor var mainActorTest1: Factory<MainActorTest1> { self { MainActorTest1() } }
    var mainActorTest2: Factory<MainActorTest2> { self { MainActorTest2() } }
}

@MainActor
class MainActorTest1 {
    init() {}
    func load() async -> String {
        return "Acting"
    }
}

@MainActor
class MainActorTest2 {
    nonisolated init() {}
    func load() async -> String {
        return "Acting"
    }
}

class MainActorFuncTest {
    @MainActor
    func load() async -> String {
        return "Acting"
    }
}

actor SomeActor {
    func load() async -> String {
        return "Acting"
    }
}

@MainActor
class SomeActorParent {

    @Injected(\.mainActorTest1) var mainActor
    @Injected(\.myActor) var myActor

    let myTest0 = Container.shared.mainActorFuncTest()
    let myTest1 = Container.shared.mainActorTest1()
    let myTest2 = Container.shared.mainActorTest2()

    func test() async {
        let result0 = await myActor.load()
        print(result0)
        let result1 = await myTest1.load()
        print(result1)
        let result2 = await myTest2.load()
        print(result2)
    }

}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/Concepts/AsyncInit.swift`
```
//
//  AsyncInit.swift
//  FactoryDemo
//
//  Created by Michael Long on 6/26/24.
//

import Foundation
import FactoryKit

// something with an asynchronous initializer
nonisolated struct AsyncInit {
    private let value: Int
    init() async {
        value = 123456
    }
    func value() async -> Int {
        value
    }
}

// generic wrapper for any asynchronous initializer
class AsyncWrapper<T> {
    private var instance: T?
    private let factory: () async -> T

    init(factory: @escaping () async -> T) {
        self.factory = factory
    }

    func callAsFunction() async -> T {
        if let instance {
            return instance
        }
        let instance = await factory()
        self.instance = instance
        return instance
    }
}

extension Container {
    // Factory using async initialization wrapper
    var asyncObject: Factory<AsyncWrapper<AsyncInit>> {
        self { AsyncWrapper { await AsyncInit() } }.cached
    }
}

func testAsyncInit() {
    @Injected(\.asyncObject) var asyncObject
    Task {
        let result = await asyncObject().value()
        print("AsyncInit Value: \(result)")
    }
}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/Concepts/CircularDependencies.swift`
```
//
//  CircularDependencies.swift
//  FactoryDemo
//
//  Created by Michael Long on 12/23/22.
//

import Foundation
import FactoryKit

// Circular

class CircularA {
    @Injected(\.circularB) var circularB
}

class CircularB {
    @Injected(\.circularC) var circularC
}

class CircularC {
    @Injected(\.circularA) var circularA
}

extension Container {

    var circularA: Factory<CircularA> { self { CircularA() } }
    var circularB: Factory<CircularB> { self { CircularB() } }
    var circularC: Factory<CircularC> { self { CircularC() } }

    var optionalA: Factory<CircularA?> { self { CircularA() } }

    static func testCircularDependencies() {
        Container.shared.manager.trace.toggle()
        let a = Container.shared.circularA()
        print(a)
    }
}


```

### Core Architecture Module: `FactoryDemo/FactoryDemo/Concepts/FunctionInjection.swift`
```
//
//  FunctionInjection.swift
//  FactoryDemo
//
//  Created by Michael Long on 10/17/22.
//

import SwiftUI
import FactoryKit

//typealias OpenURLFunction = (_ url: URL) -> Bool
//
//extension Container {
//    var openURL: Factory<OpenURLFunction> {
//        self { UIApplication.shared.openURL }
//    }
//}
//
//struct OpenView: View {
//    let site: String
//    @Injected(\.openURL) var openURL
//    var body: some View {
//        Button("Open") {
//            _ = openURL(URL(string: site)!)
//        }
//    }
//}
//
//struct OpenView_Previews: PreviewProvider {
//    static var previews: some View {
//        let _ = Container.shared.openURL.register { { _ in false } }
//        OpenView(site: "https://www.google.com")
//    }
//}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/Concepts/GenericAPIs.swift`
```
//
//  GenericAPIs.swift
//  FactoryDemo
//
//  Created by Michael Long on 12/23/22.
//

import Foundation
import FactoryKit

nonisolated struct Account {

}

nonisolated struct Transaction {

}

nonisolated protocol AccountLoading {
    func load() -> [Account]
}

struct AccountLoader: AccountLoading {
    func load() -> [Account] {
        return [Account()]
    }
}

extension Container {
    var accountLoader: Factory<AccountLoading> {
        self { AccountLoader() }
    }
}

struct MockAccountLoader: AccountLoading {
    func load() -> [Account] {
        return [Account()]
    }
}

func setupMocks() {
    Container.shared.accountLoader.register { MockAccountLoader() }
}



nonisolated struct NetworkLoader<T> {
    let path: String
    func load() -> T {
        fatalError()
    }
}

nonisolated struct MockLoader<T> {
    let data: T
    func load() -> T {
        return data
    }
}

extension Container {
    var genericAaccountLoader: Factory<AccountLoading> {
        self { NetworkLoader<[Account]>(path: "/api/accounts") }
    }
}


extension NetworkLoader<[Account]>: AccountLoading {}
extension MockLoader<[Account]>: AccountLoading {}



//protocol TypeLoading {
//    associatedtype T
//    func load() -> T
//}

extension NetworkLoader: TypeLoading {}
extension MockLoader: TypeLoading {}


nonisolated protocol TypeLoading<T> {
    associatedtype T
    func load() -> T
}

nonisolated struct AnyLoader<T> {
    let wrapped: any TypeLoading<T>
    init(_ wrapped:  any TypeLoading<T>) {
        self.wrapped = wrapped
    }
    func load() -> T {
        wrapped.load()
    }
}

extension Container {
    var anyAccountLoader: Factory<AnyLoader<[Account]>> {
        self { AnyLoader(NetworkLoader(path: "/api/accounts")) }
    }
}

//extension Container {
//    static let typedAccountLoader = Factory<any TypeLoading<[Account]>> {
//        NetworkLoader<[Account]>(path: "/api/accounts") as any TypeLoading<[Account]>
//    }
//}


protocol NewAccountLoading: TypeLoading where T == [Account] {}

extension NetworkLoader<[Account]>: NewAccountLoading {}
extension MockLoader<[Account]>: NewAccountLoading {}

extension Container {
    var newAccountLoader: Factory<any NewAccountLoading> {
        self { NetworkLoader<[Account]>(path: "/api/accounts") }
    }
}



nonisolated class AbstractClassLoader<T> {
    func load() -> T {
        fatalError()
    }
}

class NetworkClassLoader<T>: AbstractClassLoader<T> {
    private let path: String
    init(path: String) {
        self.path = path
    }
    override func load() -> T {
        fatalError() // would return actual data
    }
}

extension Container {
    var abstractAccountLoader: Factory<AbstractClassLoader<[Account]>> {
        self { NetworkClassLoader<[Account]>(path: "/api/accounts") }
    }
}

typealias LoadFunction<T> = () -> T

extension Container {
    var functionalAccountLoader: Factory<LoadFunction<[Account]>> {
        self { NetworkClassLoader<[Account]>(path: "/api/accounts").load }
    }
}


//extension Container {
//    static func setupModules() {
//        accountLoader.register {
//            NetworkLoader<[Account]>(path: "/api/accounts")
//        }
//    }
//}

class ViewModel: ObservableObject {
    @Injected(\.abstractAccountLoader) var loader
    @Published var accounts: [Account] = []
    func load() {
        accounts = loader.load()
    }
}


//public struct Factory<T> {
//    public init(factory: @escaping () -> T) {
//        // save it
//    }
//    public func callAsFunction() -> T {
//        // do it
//    }
//}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/Concepts/SimpleContainer.swift`
```
//
//  SimpleContainer.swift
//  FactoryDemo
//
//  Created by Michael Long on 2/19/23.
//

import Foundation

protocol SimpleContaining: AnyObject, Sendable  {
    var registrations: [ObjectIdentifier:() -> Any] { get set }
}

extension SimpleContaining {
    func resolve<T>(_ keyPath: KeyPath<Self, T>) -> T {
        let id = ObjectIdentifier(keyPath)
        if let factory = registrations[id], let instance = factory() as? T {
            return instance
        }
        return self[keyPath: keyPath]
    }
    func register<T>(_ keyPath: KeyPath<Self, T>, _ factory: @escaping () -> T) {
        let id = ObjectIdentifier(keyPath)
        registrations[id] = factory
    }
}

class SimpleContainerTest {
    static func test() {
        let container = SimpleContainer.shared

        let s1 = container.resolve(\.service1)
        print(s1.self)

        let s2 = container.resolve(\.service2)
        print(s2.self)

        container.register(\.service3) {
            MockServiceN(3)
        }
        let s3 = container.resolve(\.service3)
        print(s3.self)
    }
}

final class SimpleContainer: SimpleContaining, @unchecked Sendable  {
    static let shared = SimpleContainer()
    var registrations: [ObjectIdentifier:() -> Any] = [:]
}

extension SimpleContainer {
    var service1: MyServiceType { MyService() }
    var service2: MyServiceType { MyService() }
    var service3: MyServiceType { MyService() }
}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/Concepts/Tags.swift`
```
//
//  Tags.swift
//  FactoryDemo
//
//  Created by Michael Long on 4/8/23.
//

import Foundation
import FactoryKit

extension SharedContainer {
    var processor1: Factory<Processor> { self { Processor(name: "processor #1") } }
    var processor2: Factory<Processor> { self { Processor(name: "processor #2") } }
}

//extension Container {
//    static var processors: [KeyPath<Container, Factory<Processor>>] = [
//        \.processor1,
//        \.processor2,
//    ]
//    func processors() -> [Processor] {
//        Container.processors.map { self[keyPath: $0]() }
//    }
//}

nonisolated final class TaggedContainer: SharedContainer {
    static let shared = TaggedContainer()
    let manager = ContainerManager()
}

//extension TaggedContainer: AutoRegistering {
//    func autoRegister() {
//        tag(\TaggedContainer.processor1, as: .pipelineProcessor)
//        tag(\TaggedContainer.processor2, as: .pipelineProcessor)
//    }
//}

nonisolated struct Tag<T>: @unchecked Sendable {
    let path: KeyPath<Container, Factory<T>>
    let priority: Int
}

extension Container {
    static let processors: [Tag<Processor>] = [
        Tag(path: \.processor1, priority: 20),
        Tag(path: \.processor2, priority: 10),
    ]
    func processors() -> [Processor] {
        Container.processors
            .sorted(by: { $0.priority < $1.priority })
            .map { self[keyPath: $0.path]() }
    }
}



struct Processor {
    var name: String
}

//struct PipelineProcessorTag : Tag {
//    typealias S = Processor
//}
//
//extension Tag where Self == PipelineProcessorTag {
//    static var pipelineProcessor: PipelineProcessorTag { PipelineProcessorTag() }
//}

//public protocol Tag<S> {
//    associatedtype S
//    var name: String { get }
//}
//
//extension Tag {
//    var name: String {
//        String(reflecting: type(of: self))
//    }
//}
//
//protocol AnyTaggedFactory {
//    var priority: Int { get }
//}
//
//struct TaggedFactory<C: SharedContainer, T: Tag> : AnyTaggedFactory {
//    let tag: T
//    let factoryKeyPath: KeyPath<C, Factory<T.S>>
//    let priority: Int
//    let alias: String?
//}
//
//// FactoryModifying tagging
//extension SharedContainer {
//    func tag<C: SharedContainer, T: Tag>(_ keyPath: KeyPath<C, Factory<T.S>>, as tag: T, priority: Int = 0, alias: String? = nil) {
//        self._tag(keyPath, as: tag, priority: priority, alias: alias)
//    }
//
//    fileprivate func _tag<C: SharedContainer, T: Tag>(_ keyPath: KeyPath<C, Factory<T.S>>, as tag: T, priority: Int = 0, alias: String? = nil) {
//        let taggedFactory = TaggedFactory(tag: tag, factoryKeyPath: keyPath, priority: priority, alias: alias)
//        if taggedFactories[tag.name] == nil {
//            taggedFactories[tag.name] = [:]
//        }
//        taggedFactories[tag.name]![C.shared[keyPath: keyPath].registration.id] = taggedFactory
//    }
//
//    func resolve<T: Tag>(tagged tag: T) -> [T.S] {
//        let taggedFactories = taggedFactories[tag.name] ?? [:]
//        var results: [T.S] = []
//        for anyTaggedFactory in taggedFactories.values.sorted(by: { $0.priority < $1.priority }) {
//            guard let taggedFactory = anyTaggedFactory as? TaggedFactory<Self, T> else {
//                continue
//            }
//            let instance = self[keyPath: taggedFactory.factoryKeyPath].resolve()
//            results.append(instance)
//        }
//        return results
//    }
//
//    func resolveAssociative<T: Tag>(tagged tag: T) -> [String: T.S] {
//        let taggedFactories = taggedFactories[tag.name] ?? [:]
//        var results: [String: T.S] = [:]
//        for anyTaggedFactory in taggedFactories.values {
//            guard let taggedFactory = anyTaggedFactory as? TaggedFactory<Self, T>, let alias = taggedFactory.alias else {
//                continue
//            }
//            results[alias] = self[keyPath: taggedFactory.factoryKeyPath].resolve()
//        }
//        return results
//    }
//}
//
//extension Container {
//    func tag<T: Tag>(_ keyPath: KeyPath<Container, Factory<T.S>>, as tag: T, priority: Int = 0, alias: String? = nil) {
//        self._tag(keyPath, as: tag, priority: priority, alias: alias)
//    }
//}
//
//// would go in manager
//
///// Alias for tagged registrations.
//internal typealias TaggedFactoryMap = [String:[String: AnyTaggedFactory]]
///// tagged registrations
//internal var taggedFactories: TaggedFactoryMap = .init(minimumCapacity: 32)

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/ContainerDemoView.swift`
```

import SwiftUI
import FactoryKit

struct ContainerDemoView: View {

    @StateObject var model = ContainerDemoViewModel()

    var body: some View {
        VStack(spacing: 20) {
            Text("Showing \(model.text())")
        }
        .padding()
    }

}

struct ContainerDemoVieww_Previews: PreviewProvider {
    static var previews: some View {
        let _ = DemoContainer.shared.with {
            $0.myServiceType.register { ParameterService(count: 8) }
        }
        ContainerDemoView(model: ContainerDemoViewModel())
    }
}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/ContainerDemoViewModel.swift`
```
//
//  EnvironmentViewModel.swift
//  FactoryDemo
//
//  Created by Michael Long on 6/2/22.
//

import Foundation
import FactoryKit
import Common
import Networking
import SwiftUI

protocol MyCustomContainer: SharedContainer {
    var constructedService: Factory<MyConstructedService> { get }
    var additionalService: Factory<SimpleService> { get }
}

@MainActor
class ContainerDemoViewModel: ObservableObject {

    @Injected(\.customContainer) var container

    lazy var constructedService = container.constructedService()
    lazy var additionalService = container.additionalService()

    private let service: MyServiceType

    init(_ container: DemoContainer = .shared) {
        service = container.myServiceType()
    }

    func text() -> String {
        return "Demo \(service.text())"
    }

}

extension DemoContainer: @preconcurrency MyCustomContainer {}

extension Container {
    var demoContainer: Factory<DemoContainer> { self { DemoContainer.shared }}
    var customContainer: Factory<MyCustomContainer> { self { DemoContainer.shared }}
}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/ContentView.swift`
```
//
//  ContentView.swift
//  FactoryDemo
//
//  Created by Michael Long on 6/2/22.
//

import SwiftUI
import FactoryKit

struct ContentView: View {

//    @InjectedObject(\.contentViewModel)
//    @StateObject var model = resolve(\.contentViewModel)
    @StateObject var model = ContentViewModel()

    var body: some View {
        List {
            Section("View Model Bindings") {
                HStack {
                    Text("Name")
                        .foregroundColor(.secondary)
                    Spacer()
                    TextField("Name", text: $model.name)
                        .multilineTextAlignment(.trailing)
                }

                Button("Mutate") {
                    model.name += "z"
                }

                child()
            }

            Section("Navigation") {
                NavigationLink("Link") {
                    ContentView()
                }
            }

            Section("Crash Tests") {
                Button("Trigger Circular Dependency Crash") {
                    Container.testCircularDependencies()
                }
                Button("Promised Crash") {
                    let _ = Container.shared.promisedService()
                }
            }

            Section("Miscellaneous") {
                if #available(iOS 17, *) {
                    ObservableView()
                }
                ModelTest()
                HStack {
                    Text("Testing")
                    Spacer()
                    Text(model.testing)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    @ViewBuilder func child() -> some View {
        ChildContentView(model: model)
            .foregroundColor(.secondary)
    }
    
}

struct innerView: View {
    var body: some View {
        Text("Hello")
            .foregroundColor(.red)
    }
}
struct outerView: View {
    var body: some View {
        innerView()
            .foregroundColor(.green)
    }
}

struct ChildContentView: View {
    @ObservedObject var model: ContentViewModel
    var body: some View {
        Text(model.text() + " for \(model.name)")
    }
}

// Illustrates single
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        // Depends on preview context set in FactoryDemoApp+AutoRegister.swift
        ContentView()
    }
}

// New Previews
#Preview {
    Group {
        Container.shared.myServiceType { MockServiceN(4) }
        ContentView()
    }
}

#Preview {
    Group {
        Container.shared.myServiceType { MockServiceN(8) }
        ContentView()
    }
}

// Illustrates multiple
//struct ContentView_Previews: PreviewProvider {
//    static var previews: some View {
//        Group {
//            let _ = Container.shared.myServiceType.onPreview { MockServiceN(44) }
//            let model1 = ContentViewModel()
//            ContentView(model: model1)
//            let _ = Container.shared.myServiceType.onPreview { MockServiceN(88) }
//            let model2 = ContentViewModel()
//            ContentView(model: model2)
//        }
//    }
//}

// Illustrates multiple w/injectedobject
//struct ContentView_Previews: PreviewProvider {
//    static var previews: some View {
//        Group {
//            let _ = Container.shared.myServiceType.register { MockServiceN(44) }
//            let model1 = ContentViewModel()
//            ContentView(model: InjectedObject(model1))
//
//            let _ = Container.shared.myServiceType.register { MockServiceN(88) }
//            let model2 = ContentViewModel()
//            ContentView(model: InjectedObject(model2))
//        }
//    }
//}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/ContentViewModel.swift`
```
//
//  ContentViewModel.swift
//  FactoryDemo
//
//  Created by Michael Long on 6/2/22.
//

import Foundation
import FactoryKit
import Common
import Networking
import SwiftUI

@MainActor
class ContentViewModel: ObservableObject {

    @InjectedContainer var container
    @InjectedContainer(DemoContainer.self) var demo

    @Injected(\.myServiceType) private var service
    @Injected(\.networkType) private var network
    @Injected(\.fatalType) private var fatal

    private let simpleService = Container.shared.simpleService()

    @Published var name: String = "Michael"

    init() {
        testContainer()
        testFactory()
        testResolving()
    }

    func text() -> String {
        return service.text()
    }

    var testing: String {
        let test = NSClassFromString("XCTest") != nil
        return test ? "Yes" : "No"
    }

    func testContainer() {
        let service1 = container.myServiceType()
        print("Container Service = \(service1.text())")
        let service2 = demo.myServiceType()
        print("Demo Container Service = \(service2.text())")
    }

    func testFactory() {
        let m0 = Container.shared.myServiceType()
        print("MyServiceType - \(m0.text())")
        let m1 = CycleDemo()
        print("CycleDemo - W/O ROOT \(m1.aService === m1.bService)")
        let m2 = Container.shared.cycleDemo()
        print("CycleDemo - W/ROOT \(m2.aService === m2.bService)")

        let p1 = Container.shared.promisedType()
        p1?.test()

        let f1 = Container.shared.fatalType()
        f1.test()

        let n1 = Container.shared.networkType()
        n1.test()

//        macro.test()

        let processors = Container.shared.processors()
        processors.forEach { p in
            print(p.name)
        }

        DispatchQueue.main.async {
            let m9 = Container.shared.myServiceType()
            print("MyServiceType - \(m9.text())")
        }

        testAsyncInit()
    }

    @InjectedType private var simple: SimpleService?

    func testResolving() {
        let c = Container.shared
        let s1: MyService? = c.resolve()
        print(s1?.id as Any)
        c.register { MyService() as MyServiceType }
            .scope(.singleton)
        let s2: MyServiceType? = c.resolve()
        print(s2?.id as Any)
        let s3: MyServiceType? = c.resolve()
        print(s3?.id as Any)
        // injected
        print(simple?.text() as Any)
    }

}

internal class MyCommonType: CommonType {
    public init() {}
    public func test() {
        print("My Common Test")
    }
}

```

### Core Architecture Module: `FactoryDemo/FactoryDemo/FacotryDemoApp+Nonisolated.swift`
```
//
//  FacotryDemoApp+Nonisolated.swift
//  FactoryDemo
//
//  Created by Michael Long on 12/26/25.
//

import Foundation
import FactoryKit
import Common
import SwiftUI

nonisolated final class NonisolatedNetworkService0 {
    // @Injected(\.preferences) var preferences // FAILS: 'nonisolated' is not supported on properties with property wrappers
    func load() {}
}

nonisolated final class SharedContainerNetworkService {
    let preferences = Container.shared.preferences()
    func load() {}
}

nonisolated final class PassedContainerNetworkService {
    let preferences: Preferences
    init(_ container: Container = Container.shared) {
        preferences = container.preferences()
    }
    func load() {}
}

nonisolated final class DependencyFunctionNetworkService {
    let preferences: Preferences = dependency(\.preferences)
    func load() {}
}

protocol PreferencesProviding {
    var preferences: Factory<Preferences> { get }
}

extension Container: PreferencesProviding {}

nonisolated final class PassedProtocolNetworkService {
    let preferences: Preferences
    init(_ provider: PreferencesProviding = Container.shared) {
        preferences = provider.preferences()
    }
    func load() {}
}

nonisolated final class FancyWayToAvoidSharedNetworkService {
    let preferences: Preferences = { Injected(\.preferences).wrappedValue }()
    func load() {}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #389** (2026-09-24): **Scope box nil check optimisation**
  *Symptoms*: ## Decide the `Scope.box` nil check without a protocol cast  Three scope functions ask whether a resolved instance is a nil `Optional`, and they ask it with a cast to an internal protocol:  ```swift if let optional = instance as? OptionalProtocol {     if optional.hasWrappedValue { ... }     return nil } ```  `Scope.box`, `Scope.Shared.box` and `Scope.Shared.unboxed` run this cast on every instance that a scoped registration returns. For a non-optional registration, which is most of them, the cast fails.  A failing cast to a protocol is not free. The Swift runtime has no negative answer to give until it looked, so it scans the protocol conformance records of every loaded image that is not in the dyld shared cache, once per (type, protocol) pair. The result is cached, so the cost lands on the first resolve of each registered type. That is exactly the set of resolves an app performs while it starts.  The cost grows with the size of the binary, not with the size of Factory.   ## The change  The three sites cast the instance to `Optional<Any>` instead of to a protocol:  ```swift internal func isNil<T>(_ instance: T) -> Bool {     if case Optional<Any>.none = instance as Any {         return true     }     return false } ```  `swift_dynamicCast` decides a cast to an `Optional` target from the metadata kinds of the two types. It reads the source metadata, sees whether the kind is `Optional`, and returns the payload or the empty case. It reads no
  **Post-Mortem & Fix Analysis**:
  > Crediting this PR, but baking a similar change into 3.4.1. I like eliminating the protocol, but rewrote all of the conditional code as guards.

- **Issue #388** (2026-09-24): **Prevent stale resolutions from repopulating invalidated caches**
  *Symptoms*: ## Problem  A factory resolution can select an old registration, then finish after the factory is re-registered or its cache is reset. Its result is inserted after invalidation and becomes the cached value for later callers.  ## Change  Capture the effective cache revision while selecting the registration, before waiting for resolution locks. Insert a newly created value only if that revision is still current, checking and writing under the cache lock. Track factory, scope, and whole-cache revisions so unrelated invalidations preserve valid work. Apply invalidation to cache resets and restored container state as well.  An already-started caller can still finish with its original result; subsequent resolutions use the current registration.  ## Validation  - Five semaphore-controlled invalidation cases failed on the original implementation. - Regression coverage includes cached/singleton re-registration, factory/container/scope resets, state restoration, unrelated invalidations, and an already-selected parameterized resolution. - `swift test`: 146 XCTest + 22 Swift Testing tests pass. - `swift build -c release`: passes. - `git diff --check`: passes.  Validated locally with Xcode 26.6 / Swift 6.3.3.
  **Post-Mortem & Fix Analysis**:
  > LLM generated submission adds happy path overhead over an issue I've yet to see reported as an actual problem in real life. (Most systems rarely reset their registrations and caches, especially in threaded environments.)

- **Issue #387** (2026-09-24): **Reclaim unused resolution locks and parameter keys**
  *Symptoms*: Resetting a container cleared cached values but left parameter objects retained by the resolution-lock dictionary. Long-lived containers could accumulate those keys even after reset.  Track holders and waiters for each resolution lock and remove its entry after the last caller unlocks. Resets preserve locks still in use, so competing resolutions continue to share the same lock. Uncached nil results also release their lock entries.  Adds five regression tests covering parameter release after container, factory, and scope resets, nil results, and lock identity/reclamation with registered waiters.  Validation: `swift test` passed in a clean worktree containing this commit.
  **Post-Mortem & Fix Analysis**:
  > Another LLM generated submission. Most systems rarely reset their registrations and caches, and I'd decided when I implemented cache locks that cleaning up the cache wasn't really worth the effort as the additional checks also had a small impact on happy path performance.  Especially since even after a reset the same factory keys were likely to be requested from the container.
  > Revisited this and added an improved variant in 3.4.1. Credited this PR.

- **Issue #386** (2026-09-24): **Fix graph-scoped delegation across containers**
  *Symptoms*: ## Problem  Graph-scoped factories in different containers share one graph cache. When factories have the same key and result type, they also share a resolution lock. Delegating from one container to the other recursively acquires that non-recursive lock and crashes on Apple platforms (`_os_unfair_lock_recursive_abort`). Independent resolutions can also return another container's cached value.  ## Change  Include the originating container cache's identity in graph cache keys. Preserve the parameter value when adding this identity, and preserve the identity during key normalization. This separates both cached values and locks across containers while retaining reuse within one graph and cleanup between graphs.  Add regression tests for same-key container isolation, nested delegation using default graph scopes, and parameterized graph factories.  ## Validation  - The container-isolation regression test fails on the original implementation. - `swift package clean && swift test`: 140 XCTest tests and 22 Swift Testing tests pass. - `swift build -c release`: passes. - `git diff --check`: passes.  Validated with Xcode 26.6 / Swift 6.3.3. 
  **Post-Mortem & Fix Analysis**:
  > We're getting off into more and more rarely used edge cases, especially in the use of cross-container graph scopes, resets, and parameterized resolutions and I'm somewhat disinclined to add a lot of extra tracking to support those behaviors, especially when it affects mainstream performance.  Adding extra fields to FactoryKey is especially problematic in regard to the performance hit entailed taking the structure past three words in memory.
  > I'm also about this close to deprecating graph scopes anyway...

- **Issue #385** (2026-09-15): **Fix concurrent first resolution of cached dependencies**
  *Symptoms*: ## Problem  Concurrent first access to a cached or singleton factory can execute its closure multiple times when graph scope and debug tracing/circular checks are disabled. The default-value dictionary lookup creates a lock without inserting it, so competing callers use different locks.  ## Change  Store and reuse a resolution lock for each key in Scope.Cache. Cache-local locks preserve independent resolution and same-key delegation across containers. Retain locks across cache resets so in-flight resolutions keep using the same lock.  Add cold-cache concurrency tests for cached and singleton scopes without global serialization, plus a cross-container delegation regression test. Both concurrency tests reproduced 10 creations instead of 1 before the fix.  ## Validation  - Clean swift test: 135 XCTest tests and 22 Swift Testing tests pass. - swift build -c release: passes. - git diff --check: passes.  Validated with Xcode 26.6 / Swift 6.3.3.

- **Issue #384** (2026-09-16): **Fix parameter-scoped cache key hash collisions**
  *Symptoms*: ## Problem  With `.scopeOnParameters.cached`, unequal `Hashable` parameters that produce the same hash resolve to the same cached dependency. `FactoryKey` stores only `hashValue`, so resolving values 1 and 2 from a deliberately colliding parameter type returns 1 and 1.  ## Change  Store the parameter as `AnyHashable?` so key equality preserves parameter equality. Use `nil` for unparameterized and normalized keys, preserving cache invalidation across all parameters.  Add regression coverage for distinct colliding parameters, reuse for equal parameters, scope reset, and re-registration. Update the component test to check unparameterized key equality and normalization.  ## Validation  - Both new regression tests fail on the original implementation. - `swift test`: 134 XCTest tests and 22 Swift Testing tests pass. - `swift build -c release`: passes. - `git diff --check`: passes.  Validated locally with Xcode 26.6 / Swift 6.3.3. 
  **Post-Mortem & Fix Analysis**:
  > Hi @hmlongco Could you please review this PR? 

- **Issue #383** (2026-09-15): **Fix parameter-scoped cache key hash collisions**
  *Symptoms*: ## Problem  With `.scopeOnParameters.cached`, unequal `Hashable` parameters that produce the same hash resolve to the same cached dependency. `FactoryKey` stores only `hashValue`, so resolving values 1 and 2 from a deliberately colliding parameter type returns 1 and 1.  ## Change  Store the parameter as `AnyHashable?` so key equality preserves parameter equality. Use `nil` for unparameterized and normalized keys, preserving cache invalidation across all parameters.  Add regression coverage for distinct colliding parameters, reuse for equal parameters, scope reset, and re-registration. Update the component test to check unparameterized key equality and normalization.  ## Validation  - Both new regression tests fail on the original implementation. - `swift test`: 134 XCTest tests and 22 Swift Testing tests pass. - `swift build -c release`: passes. - `git diff --check`: passes.  Validated locally with Xcode 26.6 / Swift 6.3.3. 

- **Issue #382** (2026-09-16): **Update iOS deployment target to 15.0 to support Xcode 27**
  *Symptoms*: Hi,  The project currently fails to build with Xcode 27.  When building with Xcode 27 RC, the following error occurs:  > The iOS Simulator deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set to 13.0, but the range of supported deployment target versions is 15.0 to 27.0.x.  Xcode 27 no longer supports iOS 13 as a deployment target. The minimum supported deployment targets are now:  - iOS 15 - iPadOS 15 - tvOS 15 - watchOS 9 - visionOS 1 - macOS 12 - DriverKit 21  Could you please update the deployment target so the project can be built with Xcode 27?
  **Post-Mortem & Fix Analysis**:
  > @hosaruzu I think you should update your app to support iOS 15.0 and later. Almost no one uses iOS versions below 15.0 anymore. 
  > > [@hosaruzu](https://github.com/hosaruzu) I think you should update your app to support iOS 15.0 and later. Almost no one uses iOS versions below 15.0 anymore.  The issue is specifically with Xcode 27: it no longer accepts iOS 13 as a deployment target, so the package itself needs to use iOS 15+ when built with Xcode 27. Otherwise, the project fails to compile before the app’s deployment target comes into play. 
  > Will be in 3.4.0

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

### Incident Patch 1: `cd67ba85` (2026-09-16)
**Commit Message**: Merge pull request #384 from lucaspham1/fix/parameter-hash-collisions

Fix parameter-scoped cache key hash collisions

**File**: `Sources/FactoryKit/FactoryKit/Key.swift` (modified, +6/-5)
```diff
@@ -29,16 +29,16 @@ internal struct FactoryKey: Hashable {
 
     let type: ObjectIdentifier
     let key: StaticString
-    let parameter: Int
+    let parameter: AnyHashable?
 
     internal init(type: Any.Type, key: StaticString) {
         self.type = ObjectIdentifier(type) // globalIdentifier(for: type)
         self.key = key
-        self.parameter = 0
+        self.parameter = nil
     }
 
     @inline(__always)
-    private init(type: ObjectIdentifier, key: StaticString, parameter: Int) {
+    private init(type: ObjectIdentifier, key: StaticString, parameter: AnyHashable?) {
         self.type = type
         self.key = key
         self.parameter = parameter
@@ -58,11 +58,12 @@ internal struct FactoryKey: Hashable {
         guard let hashable = value as? any Hashable else {
             return self
         }
-        return .init(type: type, key: key, parameter: hashable.hashValue)
+        // Preserve equality so distinct parameters with the same hash do not share a cached value.
+        return .init(type: type, key: key, parameter: AnyHashable(hashable))
     }
 
     internal func normalized() -> Self {
-        return .init(type: type, key: key, parameter: 0)
+        return .init(type: type, key: key, parameter: nil)
     }
 
 }
```

**File**: `Tests/FactoryTests/XCTests/FactoryComponentTests.swift` (modified, +3/-1)
```diff
@@ -105,7 +105,9 @@ final class FactoryComponentTests: XCTestCase {
         let f1b = f2.parameterized("bar")
         XCTAssertNotEqual(f1b, f2f)
         let f1v = f1.parameterized(())
-        XCTAssertEqual(f1v.parameter, 0)
+        XCTAssertEqual(f1v, f1)
+        XCTAssertEqual(f1f.normalized(), f1)
+        XCTAssertEqual(f1b.normalized(), f2)
     }
 
 }
```

**File**: `Tests/FactoryTests/XCTests/FactoryParameterTests.swift` (modified, +52/-0)
```diff
@@ -62,6 +62,50 @@ final class FactoryParameterTests: XCTestCase {
         XCTAssertTrue(Container.shared.manager.isEmpty(.scope))
     }
 
+    func testScopeOnParametersDistinguishesHashCollisions() {
+        let container = Container()
+        let factory = ParameterFactory<CollidingParameter, ParameterService>(container) {
+            ParameterService(value: $0.value)
+        }.scopeOnParameters.cached
+        let first = CollidingParameter(value: 1)
+        let second = CollidingParameter(value: 2)
+
+        XCTAssertNotEqual(first, second)
+        XCTAssertEqual(first.hashValue, second.hashValue)
+
+        let service1 = factory(first)
+        let service2 = factory(second)
+        XCTAssertEqual(service1.value, 1)
+        XCTAssertEqual(service2.value, 2)
+        XCTAssertFalse(service1 === service2)
+        XCTAssertTrue(factory(CollidingParameter(value: 1)) === service1)
+        XCTAssertTrue(factory(CollidingParameter(value: 2)) === service2)
+
+        factory.reset(.scope)
+        XCTAssertFalse(factory(first) === service1)
+        XCTAssertFalse(factory(second) === service2)
+        XCTAssertEqual(factory(first).value, 1)
+        XCTAssertEqual(factory(second).value, 2)
+    }
+
+    func testRegistrationInvalidatesAllCollidingParameters() {
+        let container = Container()
+        let factory = ParameterFactory<CollidingParameter, ParameterService>(container) {
+            ParameterService(value: $0.value)
+        }.scopeOnParameters.cached
+        let first = CollidingParameter(value: 1)
+        let second = CollidingParameter(value: 2)
+        let service1 = factory(first)
+        let service2 = factory(second)
+
+        factory.register { ParameterService(value: $0.value + 10) }
+
+        XCTAssertEqual(factory(first).value, 11)
+        XCTAssertEqual(factory(second).value, 12)
+        XCTAssertFalse(factory(first) === service1)
+        XCTAssertFalse(factory(second) === service2)
+    }
+
 #if canImport(SwiftUI)
     func testPreviewFunction() throws {
         let service1 = Container.shared.parameterService(5)
@@ -76,3 +120,11 @@ final class FactoryParameterTests: XCTestCase {
 #endif
 
 }
+
+private struct CollidingParameter: Hashable {
+    let value: Int
+
+    func hash(into hasher: inout Hasher) {
+        hasher.combine(0)
+    }
+}
```

---

### Incident Patch 2: `f1a7daf5` (2026-09-15)
**Commit Message**: Merge pull request #385 from lucaspham1/fix/concurrent-cached-resolution

Fix concurrent first resolution of cached dependencies

**File**: `Sources/FactoryKit/FactoryKit/Scopes.swift` (modified, +13/-4)
```diff
@@ -69,9 +69,7 @@ public class Scope: @unchecked Sendable {
             }
         }
 
-        let keyLock = lock.withLock {
-            locks[key, default: CrossPlatformLock()]
-        }
+        let keyLock = cache.resolutionLock(forKey: key)
 
         let result: (instance: T, cached: Bool) = keyLock.withLock {
             if let box = cache.value(forKey: key), let cached: T = unboxed(box: box) {
@@ -113,7 +111,6 @@ public class Scope: @unchecked Sendable {
 
     internal let scopeID: UUID = UUID()
     internal let lock: NSLocking = CrossPlatformLock()
-    internal var locks: [FactoryKey: CrossPlatformLock] = [:]
 
 }
 
@@ -263,7 +260,19 @@ extension Scope {
         // locals
         let lock = ReadWriteLock()
         var cache: CacheMap
+        // Keep locks for the cache lifetime, including across resets while resolutions may be in flight.
+        private var resolutionLocks: [FactoryKey: CrossPlatformLock] = [:]
         /// internal support functions
+        internal func resolutionLock(forKey key: FactoryKey) -> CrossPlatformLock {
+            lock.withWriteLock {
+                if let existing = resolutionLocks[key] {
+                    return existing
+                }
+                let newLock = CrossPlatformLock()
+                resolutionLocks[key] = newLock
+                return newLock
+            }
+        }
         @inlinable @inline(__always) func value(forKey key: FactoryKey) -> AnyBox? {
             lock.withReadLock { cache[key] }
         }
```

**File**: `Tests/FactoryTests/XCTests/FactoryConcurrencyStressTests.swift` (modified, +60/-0)
```diff
@@ -10,6 +10,53 @@ final class FactoryConcurrencyStressTests: XCTestCase, @unchecked Sendable {
         Scope.singleton.reset()
     }
 
+    func testCachedConcurrentFirstResolution() {
+        assertConcurrentFirstResolution(scope: Scope.Cached())
+    }
+
+    func testSingletonConcurrentFirstResolution() {
+        assertConcurrentFirstResolution(scope: Scope.Singleton())
+    }
+
+    private func assertConcurrentFirstResolution(scope: Scope, file: StaticString = #filePath, line: UInt = #line) {
+        let container = Container()
+        let circularDependencyTesting = container.manager.circularDependencyTesting
+        let trace = container.manager.trace
+        container.manager.circularDependencyTesting = false
+        container.manager.trace = false
+        defer {
+            container.manager.circularDependencyTesting = circularDependencyTesting
+            container.manager.trace = trace
+        }
+        XCTAssertFalse(container.manager.graphScopeEnabled, file: file, line: line)
+
+        let counter = CallCounter()
+        let results = ResolutionResults()
+        let factory = Factory(container) {
+            counter.increment()
+            // Keep the cache cold long enough for competing callers to enter resolution.
+            Thread.sleep(forTimeInterval: 0.02)
+            return UUID()
+        }.scope(scope)
+
+        DispatchQueue.concurrentPerform(iterations: 32) { _ in
+            results.insert(factory())
+        }
+
+        XCTAssertEqual(counter.value, 1, "Factory must execute exactly once", file: file, line: line)
+        XCTAssertEqual(results.count, 1, "Every caller must receive the same cached value", file: file, line: line)
+    }
+
+    func testCachedResolutionCanDelegateAcrossContainersWithSameKey() {
+        let first = Container()
+        let second = Container()
+        let scope = Scope.Cached()
+        let inner = Factory(second, key: "service") { UUID() }.scope(scope)
+        let outer = Factory(first, key: "service") { inner() }.scope(scope)
+
+        XCTAssertEqual(outer(), inner())
+    }
+
     /// Verifies that singleton scope returns the same instance across all threads.
     func testSingletonConsistencyUnderContention() throws {
         let threadCount = 100
@@ -208,3 +255,16 @@ private final class CallCounter: @unchecked Sendable {
         _lock.unlock()
     }
 }
+
+private final class ResolutionResults: @unchecked Sendable {
+    private let lock = NSLock()
+    private var values: Set<UUID> = []
+
+    var count: Int {
+        lock.withLock { values.count }
+    }
+
+    func insert(_ value: UUID) {
+        lock.withLock { _ = values.insert(value) }
+    }
+}
```

---

### Incident Patch 3: `717d784e` (2026-09-15)
**Commit Message**: Fix parameter-scoped cache key hash collisions

**File**: `Sources/FactoryKit/FactoryKit/Key.swift` (modified, +6/-5)
```diff
@@ -29,16 +29,16 @@ internal struct FactoryKey: Hashable {
 
     let type: ObjectIdentifier
     let key: StaticString
-    let parameter: Int
+    let parameter: AnyHashable?
 
     internal init(type: Any.Type, key: StaticString) {
         self.type = ObjectIdentifier(type) // globalIdentifier(for: type)
         self.key = key
-        self.parameter = 0
+        self.parameter = nil
     }
 
     @inline(__always)
-    private init(type: ObjectIdentifier, key: StaticString, parameter: Int) {
+    private init(type: ObjectIdentifier, key: StaticString, parameter: AnyHashable?) {
         self.type = type
         self.key = key
         self.parameter = parameter
@@ -58,11 +58,12 @@ internal struct FactoryKey: Hashable {
         guard let hashable = value as? any Hashable else {
             return self
         }
-        return .init(type: type, key: key, parameter: hashable.hashValue)
+        // Preserve equality so distinct parameters with the same hash do not share a cached value.
+        return .init(type: type, key: key, parameter: AnyHashable(hashable))
     }
 
     internal func normalized() -> Self {
-        return .init(type: type, key: key, parameter: 0)
+        return .init(type: type, key: key, parameter: nil)
     }
 
 }
```

**File**: `Tests/FactoryTests/XCTests/FactoryComponentTests.swift` (modified, +3/-1)
```diff
@@ -105,7 +105,9 @@ final class FactoryComponentTests: XCTestCase {
         let f1b = f2.parameterized("bar")
         XCTAssertNotEqual(f1b, f2f)
         let f1v = f1.parameterized(())
-        XCTAssertEqual(f1v.parameter, 0)
+        XCTAssertEqual(f1v, f1)
+        XCTAssertEqual(f1f.normalized(), f1)
+        XCTAssertEqual(f1b.normalized(), f2)
     }
 
 }
```

**File**: `Tests/FactoryTests/XCTests/FactoryParameterTests.swift` (modified, +52/-0)
```diff
@@ -62,6 +62,50 @@ final class FactoryParameterTests: XCTestCase {
         XCTAssertTrue(Container.shared.manager.isEmpty(.scope))
     }
 
+    func testScopeOnParametersDistinguishesHashCollisions() {
+        let container = Container()
+        let factory = ParameterFactory<CollidingParameter, ParameterService>(container) {
+            ParameterService(value: $0.value)
+        }.scopeOnParameters.cached
+        let first = CollidingParameter(value: 1)
+        let second = CollidingParameter(value: 2)
+
+        XCTAssertNotEqual(first, second)
+        XCTAssertEqual(first.hashValue, second.hashValue)
+
+        let service1 = factory(first)
+        let service2 = factory(second)
+        XCTAssertEqual(service1.value, 1)
+        XCTAssertEqual(service2.value, 2)
+        XCTAssertFalse(service1 === service2)
+        XCTAssertTrue(factory(CollidingParameter(value: 1)) === service1)
+        XCTAssertTrue(factory(CollidingParameter(value: 2)) === service2)
+
+        factory.reset(.scope)
+        XCTAssertFalse(factory(first) === service1)
+        XCTAssertFalse(factory(second) === service2)
+        XCTAssertEqual(factory(first).value, 1)
+        XCTAssertEqual(factory(second).value, 2)
+    }
+
+    func testRegistrationInvalidatesAllCollidingParameters() {
+        let container = Container()
+        let factory = ParameterFactory<CollidingParameter, ParameterService>(container) {
+            ParameterService(value: $0.value)
+        }.scopeOnParameters.cached
+        let first = CollidingParameter(value: 1)
+        let second = CollidingParameter(value: 2)
+        let service1 = factory(first)
+        let service2 = factory(second)
+
+        factory.register { ParameterService(value: $0.value + 10) }
+
+        XCTAssertEqual(factory(first).value, 11)
+        XCTAssertEqual(factory(second).value, 12)
+        XCTAssertFalse(factory(first) === service1)
+        XCTAssertFalse(factory(second) === service2)
+    }
+
 #if canImport(SwiftUI)
     func testPreviewFunction() throws {
         let service1 = Container.shared.parameterService(5)
@@ -76,3 +120,11 @@ final class FactoryParameterTests: XCTestCase {
 #endif
 
 }
+
+private struct CollidingParameter: Hashable {
+    let value: Int
+
+    func hash(into hasher: inout Hasher) {
+        hasher.combine(0)
+    }
+}
```

---

### Incident Patch 4: `73384e79` (2026-09-15)
**Commit Message**: Fix concurrent first resolution of cached dependencies

**File**: `Sources/FactoryKit/FactoryKit/Scopes.swift` (modified, +13/-4)
```diff
@@ -69,9 +69,7 @@ public class Scope: @unchecked Sendable {
             }
         }
 
-        let keyLock = lock.withLock {
-            locks[key, default: CrossPlatformLock()]
-        }
+        let keyLock = cache.resolutionLock(forKey: key)
 
         let result: (instance: T, cached: Bool) = keyLock.withLock {
             if let box = cache.value(forKey: key), let cached: T = unboxed(box: box) {
@@ -113,7 +111,6 @@ public class Scope: @unchecked Sendable {
 
     internal let scopeID: UUID = UUID()
     internal let lock: NSLocking = CrossPlatformLock()
-    internal var locks: [FactoryKey: CrossPlatformLock] = [:]
 
 }
 
@@ -263,7 +260,19 @@ extension Scope {
         // locals
         let lock = ReadWriteLock()
         var cache: CacheMap
+        // Keep locks for the cache lifetime, including across resets while resolutions may be in flight.
+        private var resolutionLocks: [FactoryKey: CrossPlatformLock] = [:]
         /// internal support functions
+        internal func resolutionLock(forKey key: FactoryKey) -> CrossPlatformLock {
+            lock.withWriteLock {
+                if let existing = resolutionLocks[key] {
+                    return existing
+                }
+                let newLock = CrossPlatformLock()
+                resolutionLocks[key] = newLock
+                return newLock
+            }
+        }
         @inlinable @inline(__always) func value(forKey key: FactoryKey) -> AnyBox? {
             lock.withReadLock { cache[key] }
         }
```

**File**: `Tests/FactoryTests/XCTests/FactoryConcurrencyStressTests.swift` (modified, +60/-0)
```diff
@@ -10,6 +10,53 @@ final class FactoryConcurrencyStressTests: XCTestCase, @unchecked Sendable {
         Scope.singleton.reset()
     }
 
+    func testCachedConcurrentFirstResolution() {
+        assertConcurrentFirstResolution(scope: Scope.Cached())
+    }
+
+    func testSingletonConcurrentFirstResolution() {
+        assertConcurrentFirstResolution(scope: Scope.Singleton())
+    }
+
+    private func assertConcurrentFirstResolution(scope: Scope, file: StaticString = #filePath, line: UInt = #line) {
+        let container = Container()
+        let circularDependencyTesting = container.manager.circularDependencyTesting
+        let trace = container.manager.trace
+        container.manager.circularDependencyTesting = false
+        container.manager.trace = false
+        defer {
+            container.manager.circularDependencyTesting = circularDependencyTesting
+            container.manager.trace = trace
+        }
+        XCTAssertFalse(container.manager.graphScopeEnabled, file: file, line: line)
+
+        let counter = CallCounter()
+        let results = ResolutionResults()
+        let factory = Factory(container) {
+            counter.increment()
+            // Keep the cache cold long enough for competing callers to enter resolution.
+            Thread.sleep(forTimeInterval: 0.02)
+            return UUID()
+        }.scope(scope)
+
+        DispatchQueue.concurrentPerform(iterations: 32) { _ in
+            results.insert(factory())
+        }
+
+        XCTAssertEqual(counter.value, 1, "Factory must execute exactly once", file: file, line: line)
+        XCTAssertEqual(results.count, 1, "Every caller must receive the same cached value", file: file, line: line)
+    }
+
+    func testCachedResolutionCanDelegateAcrossContainersWithSameKey() {
+        let first = Container()
+        let second = Container()
+        let scope = Scope.Cached()
+        let inner = Factory(second, key: "service") { UUID() }.scope(scope)
+        let outer = Factory(first, key: "service") { inner() }.scope(scope)
+
+        XCTAssertEqual(outer(), inner())
+    }
+
     /// Verifies that singleton scope returns the same instance across all threads.
     func testSingletonConsistencyUnderContention() throws {
         let threadCount = 100
@@ -208,3 +255,16 @@ private final class CallCounter: @unchecked Sendable {
         _lock.unlock()
     }
 }
+
+private final class ResolutionResults: @unchecked Sendable {
+    private let lock = NSLock()
+    private var values: Set<UUID> = []
+
+    var count: Int {
+        lock.withLock { values.count }
+    }
+
+    func insert(_ value: UUID) {
+        lock.withLock { _ = values.insert(value) }
+    }
+}
```

---

### Incident Patch 5: `080104be` (2026-09-15)
**Commit Message**: Fix parameter docs in FactoryRegistration that name parameters that don't exist

Three doc comments in Registrations.swift document parameters the
signatures do not have:

- resolve(with parameters:) documents `factory`, which is a stored
  property on the struct, not a parameter of this method. The real
  parameter, `parameters`, was undocumented.
- register(factory:) documents an `id` parameter.
- reset(options:) documents an `id` parameter.

`id` does not appear as a parameter anywhere in FactoryKit; grepping for
it outside comments returns nothing. These look like leftovers from an
earlier signature.

Comment-only change; no behavior is affected.

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `Sources/FactoryKit/FactoryKit/Registrations.swift` (modified, +3/-7)
```diff
@@ -48,7 +48,7 @@ public nonisolated struct FactoryRegistration<P,T> {
 
     /// Resolves a Factory, returning an instance of the desired type. All roads lead here.
     ///
-    /// - Parameter factory: Factory wanting resolution.
+    /// - Parameter parameters: Parameters to pass to the factory closure.
     /// - Returns: Instance of the desired type.
     internal func resolve(with parameters: P) -> T {
         let manager: ContainerManager = container.manager
@@ -171,9 +171,7 @@ extension FactoryRegistration {
 
     /// Registers a new factory closure capable of producing an object or service of the desired type. This factory overrides the original factory and
     /// the next time this factory is resolved Factory will evaluate the newly registered factory instead.
-    /// - Parameters:
-    ///   - id: ID of associated Factory.
-    ///   - factory: Factory closure called to create a new instance of the service when needed.
+    /// - Parameter factory: Factory closure called to create a new instance of the service when needed.
     internal func register(factory: @escaping (P) -> T) {
         defer { container.manager.lock.unlock()  }
         container.manager.lock.lock()
@@ -252,9 +250,7 @@ extension FactoryRegistration {
 
     /// Support function resets the behavior for a specific Factory to its original state, removing any associated registrations and clearing
     /// any cached instances from the specified scope.
-    /// - Parameters:
-    ///   - options: Reset option: .all, .registration, .scope, .none
-    ///   - id: ID of item to remove from the appropriate cache.
+    /// - Parameter options: Reset option: .all, .registration, .scope, .none
     internal func reset(options: FactoryResetOptions) {
         guard options != .none else {
             return
```

---

### Incident Patch 6: `7e9eb1c2` (2026-09-04)
**Commit Message**: Fix typo in README

**File**: `README.md` (modified, +1/-1)
```diff
@@ -430,7 +430,7 @@ To do so, open your project in Xcode and...
 1. Select `File > Packages > Update to Latest Package Versions`
 2. Select `File > Packages > Reset Package Caches`
 3. Go to your application target, remove the `Factory` library, and add the `FactoryKit` library
-4. Go a global search and replace, renaming `import Factory` to `import FactoryKit`
+4. Do a global search and replace, renaming `import Factory` to `import FactoryKit`
 5. Clean and build your project.
 
 You may need to do the same for any other targets or modules that imported Factory.
```

---

### Incident Patch 7: `0e1ca303` (2026-07-12)
**Commit Message**: Fix simple demo tests

**File**: `.claude/settings.local.json` (modified, +11/-1)
```diff
@@ -16,7 +16,17 @@
       "Bash(nm -gU .build/out/Products/Debug/libFactoryTestingDynamic.dylib)",
       "Bash(ln -s ../../../Sources/FactoryTesting/ContainerTrait.swift ContainerTrait.swift)",
       "Bash(nm -gu .build/out/Products/Debug/libFactoryTestingDynamic.dylib)",
-      "Bash(awk '/4CA5899529DE482D00FA7845 \\\\/\\\\* FactoryDemoTests \\\\*\\\\/ = \\\\{/,/^\\\\t\\\\t\\\\};/' FactoryDemo/FactoryDemo.xcodeproj/project.pbxproj)"
+      "Bash(awk '/4CA5899529DE482D00FA7845 \\\\/\\\\* FactoryDemoTests \\\\*\\\\/ = \\\\{/,/^\\\\t\\\\t\\\\};/' FactoryDemo/FactoryDemo.xcodeproj/project.pbxproj)",
+      "Bash(plutil -p .swiftpm/xcode/package.xcworkspace/xcuserdata/michael.xcuserdatad/IDEFindNavigatorScopes.plist)",
+      "Bash(git check-ignore *)",
+      "Read(//Users/michael/Dropbox/Projects/iOS/OSS/Factory/**)",
+      "Bash(find . -maxdepth 2 -iname \"*movie*\")",
+      "Bash(find \"/Users/michael/Dropbox/Projects/iOS/OSS\" -maxdepth 2 2>/dev/null)",
+      "Bash(find /Users/michael/Dropbox/Projects/iOS/OSS/MovieDemo -maxdepth 3 -not -path */.git*)",
+      "Bash(xcodebuild test *)",
+      "Bash(xcodebuild -list)",
+      "Bash(find /Users/michael/Library/Developer/Xcode/DerivedData -maxdepth 4 -iname \"Test-FactoryDemo-*.xcresult\" 2>/dev/null | sort | tail -1)",
+      "Bash(xcrun xcresulttool *)"
     ]
   }
 }
```

**File**: `FactoryDemo/Package.swift` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-// swift-tools-version: 5.6
+// swift-tools-version: 6.0
 // The swift-tools-version declares the minimum version of Swift required to build this package.
 
 import PackageDescription
```

**File**: `FactorySimpleDemo/FactorySimpleDemoTests/FactorySimpleDemoTests.swift` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ import Testing
 import FactoryKit
 import FactoryTesting
 
-@testable import FactoryTestingTest
+@testable import FactorySimpleDemo
 
 @MainActor
 @Suite(.container)
```

**File**: `FactorySimpleDemo/Package.swift` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+// swift-tools-version: 6.0
+// The swift-tools-version declares the minimum version of Swift required to build this package.
+
+import PackageDescription
```

---

### Incident Patch 8: `4654b75a` (2026-07-11)
**Commit Message**: Fix debug function in release build #376

**File**: `CHANGELOG` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # Factory Changelog
 
+### 3.3.1
+
+* Fix debug function in release build #376
+
 ### 3.3.0
 
 * Breaking change to graph scope management and performance on containers
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 
 A modern approach to Container-Based Dependency Injection for Swift and SwiftUI.
 
-## Factory Version 3.3.0
+## Factory Version 3.3.1
 
 Factory is strongly influenced by SwiftUI, and in my opinion is highly suited for that environment. Factory is...
 
```

**File**: `Sources/FactoryKit/FactoryKit/Registrations.swift` (modified, +2/-0)
```diff
@@ -208,7 +208,9 @@ extension FactoryRegistration {
             manager.options[key] = FactoryOptions(scope: scope)
         }
         if scope === Scope.graph && manager.state.hasGraphScope == false {
+            #if DEBUG
             globalLogger("FACTORY: Graph scope requested on container where graphScopeEnabled was false. Results indeterminate.")
+            #endif
             manager.state.hasGraphScope = true
         }
     }
```

---

### Incident Patch 9: `39acd513` (2026-07-05)
**Commit Message**: Fix for key regression issue #373

**File**: `CHANGELOG` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # Factory Changelog
 
+### 3.2.3
+
+* Fix for key regression issue #373
+
 ### 3.2.2
 
 * Factory supports Xcode 27 skill manifests and its skill can now be imported into Xcode
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 
 A modern approach to Container-Based Dependency Injection for Swift and SwiftUI.
 
-## Factory Version 3.2.2
+## Factory Version 3.2.3
 
 Factory is strongly influenced by SwiftUI, and in my opinion is highly suited for that environment. Factory is...
 
```

**File**: `Sources/FactoryKit/FactoryKit/Key.swift` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ internal struct FactoryKey: Hashable {
     internal func hash(into hasher: inout Hasher) {
         hasher.combine(self.type)
         if key.hasPointerRepresentation {
-            hasher.combine(UInt(bitPattern: key.utf8Start))
+            hasher.combine(bytes: UnsafeRawBufferPointer(start: key.utf8Start, count: key.utf8CodeUnitCount))
         } else {
             hasher.combine(key.unicodeScalar.value)
         }
```

---

### Incident Patch 10: `be2a7ebe` (2026-06-14)
**Commit Message**: README fix

**File**: `FactoryDemo/FactoryDemo/ContentView.swift` (modified, +2/-2)
```diff
@@ -100,14 +100,14 @@ struct ContentView_Previews: PreviewProvider {
 // New Previews
 #Preview {
     Group {
-        let _ = Container.shared.myServiceType.register { MockServiceN(4) }
+        register(\.myServiceType) { MockServiceN(4) }
         ContentView()
     }
 }
 
 #Preview {
     Group {
-        let _ = Container.shared.myServiceType.register { MockServiceN(8) }
+        register(\.myServiceType) { MockServiceN(8) }
         ContentView()
     }
 }
```

**File**: `README.md` (modified, +4/-3)
```diff
@@ -41,7 +41,7 @@ extension Container {
 
 Unlike frameworks that require registering every single type up front, or SwiftUI, where defining a new environment variable requires creating a new EnvironmentKey and adding additional getters and setters, here we simply add a new `Factory` computed variable to the default container. When it's called our Factory is created, its closure is evaluated, and we get an instance of our dependency when we need it. 
 
-\*That `self { ... }` syntax is sugared shorthand for the more formal and explicit `Factory(self) { ... }` format. Both are equivalent and are covered in [Simplified Syntax](#simplified-syntax) below.\*
+*That `self { ... }` syntax is sugared shorthand for the original, more formal, and more explicit `Factory(self) { ... }` format. Both are equivalent and are covered in [Simplified Syntax](#simplified-syntax) below.*
 
 Injecting an instance of our service is equally straightforward. Here's just one of the many ways Factory can be used.
 
@@ -396,7 +396,7 @@ It can be obtained here: [MovieDemo](https://github.com/hmlongco/MovieDemo).
 
 ## Installation
 
-With the sunsetting of CocoaPods, Factory 3.0 supports the Swift Package Manager. Period.
+With the sunsetting of CocoaPods, Factory 3.x supports the Swift Package Manager. Period.
 
 Factory's primary import library is named `FactoryKit`. This is done in order to avoid SPM import conflicts between the library itself and the `Factory` object defined within the library.
 
@@ -414,7 +414,7 @@ If you're using Swift Testing you'll probably also want to also import the `Fact
 
 ## Migration
 
-Factory 3.0.0 works with SPM, Xcode 26 under Strict Concurrency guidelines, and with Swift Testing.
+Factory 3.0.0 works with SPM, Xcode 26 (and 27) under Strict Concurrency guidelines, and with Swift Testing.
 
 If you're a current Factory user you'll need to update your code and switch from importing `Factory` to importing `FactoryKit`. This avoids SPM naming conflicts between the import library name and the primary `Factory` object.
 
@@ -444,6 +444,7 @@ var contentViewModel: Factory<ContentViewModel> {
     self { ContentViewModel() }
 }
 ```
+Keep in mind that resolution of `@MainActor` dependencies should occur *on* the `@MainActor` and not simply be awaited.
 
 ## Discussion Forum
 
```

---

### Incident Patch 11: `b53c6702` (2026-05-28)
**Commit Message**: Fix test warnings

**File**: `Tests/FactoryTests/XCTests/FactoryConcurrencyStressTests.swift` (modified, +4/-4)
```diff
@@ -16,7 +16,7 @@ final class FactoryConcurrencyStressTests: XCTestCase, @unchecked Sendable {
         let group = DispatchGroup()
         let queue = DispatchQueue(label: "singleton-stress", attributes: .concurrent)
 
-        let results = UnsafeMutableBufferPointer<ObjectIdentifier?>.allocate(capacity: threadCount)
+        nonisolated(unsafe) let results = UnsafeMutableBufferPointer<ObjectIdentifier?>.allocate(capacity: threadCount)
         results.initialize(repeating: nil)
 
         for i in 0..<threadCount {
@@ -72,7 +72,7 @@ final class FactoryConcurrencyStressTests: XCTestCase, @unchecked Sendable {
         // Pre-warm to establish the cached instance
         let expected = ObjectIdentifier(StressContainer.shared.cachedService())
 
-        let failures = UnsafeMutablePointer<Int>.allocate(capacity: 1)
+        nonisolated(unsafe) let failures = UnsafeMutablePointer<Int>.allocate(capacity: 1)
         failures.initialize(to: 0)
         let failureLock = NSLock()
 
@@ -103,7 +103,7 @@ final class FactoryConcurrencyStressTests: XCTestCase, @unchecked Sendable {
         let group = DispatchGroup()
         let queue = DispatchQueue(label: "graph-stress", attributes: .concurrent)
 
-        let results = UnsafeMutableBufferPointer<Bool>.allocate(capacity: threadCount)
+        nonisolated(unsafe) let results = UnsafeMutableBufferPointer<Bool>.allocate(capacity: threadCount)
         results.initialize(repeating: false)
 
         for i in 0..<threadCount {
@@ -160,7 +160,7 @@ private class StressService {
 }
 
 private class CountedService {
-    nonisolated(unsafe) private static let _lock = NSLock()
+    private static let _lock = NSLock()
     nonisolated(unsafe) private static var _count = 0
     static var creationCount: Int {
         _lock.lock()
```

---

### Incident Patch 12: `0ce2b976` (2026-05-27)
**Commit Message**: Fix default decorator behavior

**File**: `Sources/FactoryKit/FactoryKit/Containers.swift` (modified, +2/-2)
```diff
@@ -211,7 +211,7 @@ extension ManagedContainer {
     /// Defines a decorator for the container. This decorator will see every dependency resolved by this container.
     public func decorator(_ decorator: ((Any) -> ())?) {
         manager.lock.withLock {
-            manager.state.decorator = decorator
+            manager.state.defaultDecorator = decorator
         }
     }
     /// Defines a thread safe access mechanism to reset the container.
@@ -330,7 +330,7 @@ public final nonisolated class ContainerManager: @unchecked Sendable {
         /// Flag indicating auto registration check needs to be performed and executed if needed.
         internal var autoRegistrationCheckNeeded = true
         /// Internal closure decorates all factory resolutions for this container.
-        internal var decorator: ((Any) -> ())?
+        internal var defaultDecorator: ((Any) -> ())?
         /// Default scope
         internal var defaultScope: Scope?
         /// Graph scope enabled
```

**File**: `Sources/FactoryKit/FactoryKit/Registrations.swift` (modified, +3/-3)
```diff
@@ -61,7 +61,7 @@ public nonisolated struct FactoryRegistration<P,T> {
 
         let options: FactoryOptions? = manager.options[key]
         let scope: Scope? = options?.scope ?? manager.defaultScope
-        let decorator: ((Any) -> ())? = manager.state.decorator
+        let decorator: ((Any) -> ())? = manager.state.defaultDecorator
 
         manager.lock.unlock()
 
@@ -151,10 +151,10 @@ public nonisolated struct FactoryRegistration<P,T> {
 
         if let decorator = options?.decorator as? (T, Bool) -> Void {
             decorator(instance, instantiated)
+        } else {
+            decorator?(instance)
         }
 
-        decorator?(instance)
-
         return instance
     }
 
```

---

### Incident Patch 13: `79a63814` (2026-05-27)
**Commit Message**: Fix graph scope missed value check

**File**: `Sources/FactoryKit/FactoryKit/Scopes.swift` (modified, +2/-8)
```diff
@@ -145,14 +145,8 @@ extension Scope {
             super.init()
         }
         internal override func resolve<T>(using cache: Cache, key: FactoryKey, ttl: TimeInterval?, factory: () -> T) -> (T, Bool) {
-            if let box = self.cache.value(forKey: key), let cached: T = unboxed(box: box) {
-                return (cached, false)
-            }
-            let instance = factory()
-            if let box = box(instance) {
-                self.cache.set(value: box, forKey: key)
-            }
-            return (instance, true)
+            // ignore container's cache in favor of our own
+            return super.resolve(using: self.cache, key: key, ttl: ttl, factory: factory)
         }
         // call to enter a new resolution level
         internal func enter() {
```

---

### Incident Patch 14: `4c32658d` (2026-05-27)
**Commit Message**: Fixes for cache misses

**File**: `Sources/FactoryKit/FactoryKit/Containers.swift` (modified, +2/-2)
```diff
@@ -391,7 +391,7 @@ extension ContainerManager {
     /// Test function pushes the current registration and cache states
     public func push() {
         lock.withLock {
-            stack.append((options, cache.cache, state))
+            stack.append((options, cache.clone().cache, state))
         }
     }
 
@@ -400,7 +400,7 @@ extension ContainerManager {
         lock.withLock {
             if let values = stack.popLast() {
                 options = values.0
-                cache.cache = values.1
+                cache.assign(map: values.1)
                 state = values.2
             }
         }
```

**File**: `Sources/FactoryKit/FactoryKit/Scopes.swift` (modified, +41/-7)
```diff
@@ -68,11 +68,35 @@ public class Scope: @unchecked Sendable {
                 return (cached, false)
             }
         }
-        let instance = factory()
-        if let box = box(instance) {
-             cache.set(value: box, forKey: key)
+
+        let keyLock = lock.withLock {
+            locks[key, default: CrossPlatformLock()]
+        }
+
+        let result: (instance: T, cached: Bool) = keyLock.withLock {
+            if let box = cache.value(forKey: key), let cached: T = unboxed(box: box) {
+                if let ttl = ttl {
+                    let now = CFAbsoluteTimeGetCurrent()
+                    if (box.timestamp + ttl) > now {
+                        cache.set(timestamp: now, forKey: key)
+                        return (cached, false)
+                    }
+                } else {
+                    return (cached, false)
+                }
+            }
+            let instance = factory()
+            if let box = box(instance) {
+                cache.set(value: box, forKey: key)
+            }
+            return (instance, true)
         }
-        return (instance, true)
+
+        lock.withLock {
+            _ = locks.removeValue(forKey: key)
+        }
+
+        return (result.instance, result.cached)
     }
 
     /// Internal function returns unboxed value if it exists
@@ -92,6 +116,8 @@ public class Scope: @unchecked Sendable {
     }
 
     internal let scopeID: UUID = UUID()
+    internal let lock = CrossPlatformLock()
+    internal var locks: [FactoryKey: CrossPlatformLock] = [:]
 
 }
 
@@ -118,8 +144,14 @@ extension Scope {
             super.init()
         }
         internal override func resolve<T>(using cache: Cache, key: FactoryKey, ttl: TimeInterval?, factory: () -> T) -> (T, Bool) {
-            // ignore container's cache in favor of our own
-            return super.resolve(using: self.cache, key: key, ttl: ttl, factory: factory)
+            if let box = self.cache.value(forKey: key), let cached: T = unboxed(box: box) {
+                return (cached, false)
+            }
+            let instance = factory()
+            if let box = box(instance) {
+                self.cache.set(value: box, forKey: key)
+            }
+            return (instance, true)
         }
         // call to enter a new resolution level
         internal func enter() {
@@ -147,7 +179,6 @@ extension Scope {
         public private(set) var depth: Int = 0
         /// Private shared cache
         internal var cache = Cache()
-        internal let lock = CrossPlatformLock()
     }
 
     /// A reference to the default shared scope manager.
@@ -274,6 +305,9 @@ extension Scope {
         internal func clone() -> Cache {
             lock.withReadLock { .init(copy: cache) }
         }
+        internal func assign(map: CacheMap) {
+            lock.withWriteLock { self.cache = map }
+        }
         #if DEBUG
         internal var isEmpty: Bool {
             lock.withReadLock { cache.isEmpty }
```

---

### Incident Patch 15: `b32dc7a8` (2026-05-25)
**Commit Message**: Further race issue tests.

**File**: `CHANGELOG` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 # Factory Changelog
 
+## 3.0.5
+
+* Fix additional data race issues in @LazyInjected and @WeakLazyInjected on concurrent first access #362
+* Add performance tests for locking and resolution #365
+
 ## 3.0.4
 
 * Fix data race in @LazyInjected and @WeakLazyInjected on concurrent first access #362
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 
 A modern approach to Container-Based Dependency Injection for Swift and SwiftUI.
 
-## Factory Version 3.0.4
+## Factory Version 3.0.5
 
 Factory is strongly influenced by SwiftUI, and in my opinion is highly suited for that environment. Factory is...
 
```

**File**: `Tests/FactoryTests/XCTests/FactoryMultithreadingTests.swift` (modified, +15/-4)
```diff
@@ -8,10 +8,21 @@ final class FactoryMultithreadingTests: XCTestCase, @unchecked Sendable {
     let qc = DispatchQueue(label: "C", qos: .background, attributes: .concurrent)
     let qd = DispatchQueue(label: "E", qos: .background, attributes: .concurrent)
 
+    var globalCircularDependencyTestingState = false
+
     override func setUp() {
         super.setUp()
         MultiThreadedContainer.shared.reset()
         iterations = 0
+
+        globalCircularDependencyTestingState = globalCircularDependencyTesting
+        globalCircularDependencyTesting = false
+    }
+
+    override func tearDown() {
+        super.tearDown()
+
+        globalCircularDependencyTesting = globalCircularDependencyTestingState
     }
 
     func testMultiThreading() throws {
@@ -80,12 +91,12 @@ final class FactoryMultithreadingTests: XCTestCase, @unchecked Sendable {
 
         // threads not quite done yet
 
-        while interationValue() < 80008 {
+        while interationValue() < 100010 {
             Thread.sleep(forTimeInterval: 0.2)
         }
 
         print(iterations)
-        XCTAssertEqual(iterations, 80008)
+        XCTAssertEqual(iterations, 100010)
 
     }
 
@@ -143,9 +154,9 @@ fileprivate class D {
     }
 }
 
-fileprivate class E {
+fileprivate class E: @unchecked Sendable {
     @LazyInjected(\MultiThreadedContainer.d) var d: D
-    init() {}
+    init() { Task { test() }}
     func test() {
         d.test()
         increment()
```

**File**: `Tests/FactoryTests/XCTests/FactoryPerformanceTests.swift` (modified, +8/-22)
```diff
@@ -19,7 +19,7 @@ private final class Leaf1 {
     @Injected(\PerfContainer.leaf2) var d
     var total: Int = 0
     init() {
-        for i in 0..<10 {
+        for i in 0..<10000 {
             total += i
         }
     }
@@ -30,6 +30,11 @@ private final class Leaf2 {
     @Injected(\PerfContainer.leaf3) var f
     @Injected(\PerfContainer.leaf3) var g
     var total: Int = 0
+    init() {
+        for i in 0..<10 {
+            total += i
+        }
+    }
 }
 private final class Leaf3 {
     var total: Int = 0
@@ -42,32 +47,17 @@ private final class Leaf3 {
 private final class Mid1 {
     @Injected(\PerfContainer.leaf1) var a
     var total: Int = 0
-//    init() {
-//        for i in 0..<10 {
-//            total += i
-//        }
-//    }
 }
 private final class Mid2 {
     @Injected(\PerfContainer.leaf2) var b
     @Injected(\PerfContainer.leaf2) var c
     @Injected(\PerfContainer.leaf2) var d
     var total: Int = 0
-//    init() {
-//        for i in 0..<10 {
-//            total += i
-//        }
-//    }
 }
 private final class Root {
     @Injected(\PerfContainer.mid1) var m1
     @Injected(\PerfContainer.mid2) var m2
     var total: Int = 0
-//    init() {
-//        for i in 0..<10 {
-//            total += i
-//        }
-//    }
 }
 
 /// Dedicated container for the performance tests so registrations, scope caches,
@@ -89,25 +79,20 @@ final class FactoryPerformanceTests: XCTestCase {
 
     override func setUp() {
         super.setUp()
-        PerfContainer.shared.manager.reset()
         globalCircularDependencyTesting = false
     }
     override func tearDown() {
         super.tearDown()
-        PerfContainer.shared.manager.reset()
         globalCircularDependencyTesting = true
     }
 
     /// Raw multi-threaded throughput. Prints ns/op per run so you can diff the
     /// console output between `main` and `locks` directly.
     @available(iOS 15.0, *)
     func testMultiThreadedResolutionThroughput() {
-        let threads = ProcessInfo.processInfo.activeProcessorCount
+        let threads = ProcessInfo.processInfo.activeProcessorCount - 1
         let perThread = 1_000
 
-        // Warm up — let modifiers fire, autoRegister settle, caches prime.
-        for _ in 0..<10 { _ = PerfContainer.shared.root() }
-
         print("---- FactoryPerformanceTests ----")
         for run in 1...3 {
             let (wallMs, msPerOp) = measureOnce(threads: threads, perThread: perThread)
@@ -123,6 +108,7 @@ final class FactoryPerformanceTests: XCTestCase {
 
     private func measureOnce(threads: Int, perThread: Int) -> (wallMs: UInt64, msPerOp: Double) {
         let start = DispatchTime.now()
+        PerfContainer.shared.manager.reset()
         DispatchQueue.concurrentPerform(iterations: threads) { _ in
             for _ in 0..<perThread { _ = PerfContainer.shared.root() }
         }
```

#### Recent Merged Pull Requests:
- **PR #389** (closed): Scope box nil check optimisation (@feduza)
- **PR #388** (closed): Prevent stale resolutions from repopulating invalidated caches (@lucaspham1)
- **PR #387** (closed): Reclaim unused resolution locks and parameter keys (@lucaspham1)
- **PR #386** (closed): Fix graph-scoped delegation across containers (@lucaspham1)
- **PR #385** (2026-09-15): Fix concurrent first resolution of cached dependencies (@lucaspham1)
- **PR #384** (2026-09-16): Fix parameter-scoped cache key hash collisions (@lucaspham1)
- **PR #383** (closed): Fix parameter-scoped cache key hash collisions (@lucaspham1)
- **PR #381** (2026-09-16): Fix parameter docs in FactoryRegistration that name parameters that don't exist (@hxperl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
