> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmlongco-factory-learnings.md`  
> **Source**: github ([https://github.com/hmlongco/Factory](https://github.com/hmlongco/Factory))  
> **Source Version**: `aa8596de`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T16:51:46.709Z  
> **Learning ID**: `learn-github-hmlongco-factory`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): hmlongco/Factory

> **Canonical Artifact**: `07_PROJECT_LEARNING/hmlongco-factory-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hmlongco/Factory](https://github.com/hmlongco/Factory))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-22T16:51:46.484Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hmlongco/Factory`
- **Description**: A modern approach to Container-Based Dependency Injection for Swift and SwiftUI.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2918 stars

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
    @StateObject var model = ContentViewModel()

    var body: some View {
        List {
            Section("Scene Demo") {
                SceneDemoView()
            }

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
                ObservableObjectView()
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #389** (2026-09-24): **Scope box nil check optimisation**
  *Symptoms*: ## Decide the `Scope.box` nil check without a protocol cast  Three scope functions ask whether a resolved instance is a nil `Optional`, and they ask it with a cast to an internal protocol:  ```swift if let optional = instance as? OptionalProtocol {     if optional.hasWrappedValue { ... }     return nil } ```  `Scope.box`, `Scope.Shared.box` and `Scope.Shared.unboxed` run this cast on every instance that a scoped registration returns. For a non-optional registration, which is most of them, the cast fails.  A failing cast to a protocol is not free. The Swift runtime has no negative answer to give until it looked, so it scans the protocol conformance records of every loaded image that is not in the dyld shared cache, once per (type, protocol) pair. The result is cached, so the cost lands on the first resolve of each registered type. That is exactly the set of resolves an app performs while it starts.  The cost grows with the size of the binary, not with the size of Factory.   ## The change  The three sites cast the instance to `Optional<Any>` instead of to a protocol:  ```swift internal func isNil<T>(_ instance: T) -> Bool {     if case Optional<Any>.none = instance as Any {         return true     }     return false } ```  `swift_dynamicCast` decides a cast to an `Optional` target from the metadata kinds of the two types. It reads the source metadata, sees whether the kind is `Optional`, and returns the payload or the empty case. It reads no

- **Issue #388** (2026-09-24): **Prevent stale resolutions from repopulating invalidated caches**
  *Symptoms*: ## Problem  A factory resolution can select an old registration, then finish after the factory is re-registered or its cache is reset. Its result is inserted after invalidation and becomes the cached value for later callers.  ## Change  Capture the effective cache revision while selecting the registration, before waiting for resolution locks. Insert a newly created value only if that revision is still current, checking and writing under the cache lock. Track factory, scope, and whole-cache revisions so unrelated invalidations preserve valid work. Apply invalidation to cache resets and restored container state as well.  An already-started caller can still finish with its original result; subsequent resolutions use the current registration.  ## Validation  - Five semaphore-controlled invalidation cases failed on the original implementation. - Regression coverage includes cached/singleton re-registration, factory/container/scope resets, state restoration, unrelated invalidations, and an already-selected parameterized resolution. - `swift test`: 146 XCTest + 22 Swift Testing tests pass. - `swift build -c release`: passes. - `git diff --check`: passes.  Validated locally with Xcode 26.6 / Swift 6.3.3.

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

### Incident Patch 1: `aa8596de` (2026-10-21)
**Commit Message**: DocC for 3.5.1

**File**: `docs/data/documentation/factorykit.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"identifier":{"interfaceLanguage":"swift","url":"doc:\/\/FactoryKit\/documentation\/FactoryKit"},"abstract":[{"type":"text","text":"A modern approach to Container-Based Dependency Injection for Swift and SwiftUI."}],"metadata":{"role":"collection","modules":[{"name":"FactoryKit"}],"externalID":"FactoryKit","symbolKind":"module","title":"FactoryKit","roleHeading":"Framework"},"topicSections":[{"anchor":"The-Basics","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/GettingStarted","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Containers","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Scopes"],"title":"The Basics"},{"anchor":"Development-and-Testing","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/SwiftUI","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Previews","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Testing","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Contexts","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Debugging","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Chains"],"title":"Development and Testing"},{"anchor":"Advanced-Topics","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Modifiers","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Actors","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Modules","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Scenes","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Cycle","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Optionals","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Functional","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Tags"],"title":"Advanced Topics"},{"anchor":"Additional-Topics","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Design","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Migration"],"title":"Additional Topics"},{"anchor":"Classes","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container","doc:\/\/FactoryKit\/documentation\/FactoryKit\/ContainerManager"],"title":"Classes","generated":true},{"anchor":"Protocols","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering","doc:\/\/FactoryKit\/documentation\/FactoryKit\/FactoryModifying","doc:\/\/FactoryKit\/documentation\/FactoryKit\/ManagedContainer","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Resolving","doc:\/\/FactoryKit\/documentation\/FactoryKit\/SharedContainer"],"title":"Protocols","generated":true},{"title":"Structures","generated":true,"identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/DynamicInjected","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Factory","doc:\/\/FactoryKit\/documentation\/FactoryKit\/FactoryContext","doc:\/\/FactoryKit\/documentation\/FactoryKit\/FactoryRegistration","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Injected","doc:\/\/FactoryKit\/documentation\/FactoryKit\/InjectedContainer","doc:\/\/FactoryKit\/documentation\/FactoryKit\/InjectedObject","doc:\/\/FactoryKit\/documentation\/FactoryKit\/InjectedObservable","doc:\/\/FactoryKit\/documentation\/FactoryKit\/InjectedType","doc:\/\/FactoryKit\/documentation\/FactoryKit\/LazyInjected","doc:\/\/FactoryKit\/documentation\/FactoryKit\/ParameterFactory","doc:\/\/FactoryKit\/documentation\/FactoryKit\/WeakLazyInjected"],"anchor":"Structures"},{"identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/dependency(_:)-952hq","doc:\/\/FactoryKit\/documentation\/FactoryKit\/dependency(_:)-9pmu1","doc:\/\/FactoryKit\/documentation\/FactoryKit\/dependency(_:parameter:)-7g39a","doc:\/\/FactoryKit\/documentation\/FactoryKit\/dependency(_:parameter:)-96ign","doc:\/\/FactoryKit\/documentation\/FactoryKit\/resolve(_:)-1v66f","doc:\/\/FactoryKit\/documentation\/FactoryKit\/resolve(_:)-22zpa"],"generated":true,"anchor":"Functions","title":"Functions"},{"identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/ParameterFactoryType","doc:\/\/FactoryKit\/documentation\/FactoryKit\/VoidFactoryType"],"generated":true,"anchor":"Type-Aliases","title":"Type Aliases"},{"identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/FactoryContextType","doc:\/\/FactoryKit\/documentation\/FactoryKit\/FactoryResetOptions"],"generated":true,"anchor":"Enumerations","title":"Enumerations"},{"identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Swift","doc:\/\/FactoryKit\/documentation\/FactoryKit\/SwiftUICore"],"generated":true,"anchor":"Extended-Modules","title":"Extended Modules"}],"primaryContentSections":[{"content":[{"anchor":"Overview","level":2,"type":"heading","text":"Overview"},{"inlineContent":[{"text":"Factory is strongly influenced by SwiftUI, and in my opinion is highly suited for use in that environment.","type":"text"}],"type":"paragraph"},{"inlineContent":[{"text":"Factory is…","type":"text"}],"type":"paragraph"},{"type":"unorderedList","items":[{"content":[{"type":"paragraph","inlineContent":[{"inlineContent":[{"type":"text","text":"Adaptable"}],"type":"strong"},{"type":"text","text":": Factory doesn’t tie you down to a single dependency injection strategy or tech
```

**File**: `docs/data/documentation/factorykit/actors.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"identifier":{"interfaceLanguage":"swift","url":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Actors"},"abstract":[{"type":"text","text":"Registering and resolving actors and actor-isolated dependencies."}],"metadata":{"title":"Actors and Actor Isolation","modules":[{"name":"FactoryKit"}],"roleHeading":"Article","role":"article"},"primaryContentSections":[{"content":[{"type":"heading","level":2,"text":"Overview","anchor":"Overview"},{"inlineContent":[{"text":"Factory resolution is synchronous. You ask for a dependency and you get one back, right now, with no ","type":"text"},{"type":"codeVoice","code":"await"},{"text":" in sight. That model is simple and fast, but it bumps up against Swift Concurrency the moment a dependency needs to be built on a specific actor.","type":"text"}],"type":"paragraph"},{"inlineContent":[{"type":"text","text":"This page walks through the cases in order, from the one that just works to the one that needs a little help. The simplest case is a plain actor. Then a main actor-isolated type. Then a custom global actor."}],"type":"paragraph"},{"type":"paragraph","inlineContent":[{"type":"text","text":"And finally what to do when you need to resolve one of those isolated types from a detached task that’s non-isolated and not on any actor."}]},{"type":"heading","level":2,"anchor":"Plain-Actors","text":"Plain Actors"},{"inlineContent":[{"type":"text","text":"An ordinary actor is the easy case. Define it and register it like anything else."}],"type":"paragraph"},{"syntax":"swift","type":"codeListing","code":["actor OrdinaryActor {","    private var count = 0","    func increment() -> Int {","        count += 1","        return count","    }","}","","extension Container {","    var ordinaryActor: Factory<OrdinaryActor> {","        self { OrdinaryActor() }","    }","}"]},{"type":"paragraph","inlineContent":[{"text":"Resolution needs nothing special, because an actor’s initializer is ","type":"text"},{"type":"emphasis","inlineContent":[{"text":"nonisolated","type":"text"}]},{"type":"text","text":". It runs synchronously on whatever thread asks for it, so Factory can build one from any context."}]},{"syntax":"swift","type":"codeListing","code":["let actor = Container.shared.ordinaryActor()"]},{"type":"paragraph","inlineContent":[{"type":"text","text":"The isolation only matters once you touch the actor’s state, and the compiler already handles that for you by requiring "},{"type":"codeVoice","code":"await"},{"type":"text","text":" on the call."}]},{"syntax":"swift","type":"codeListing","code":["let count = await actor.increment()"]},{"type":"paragraph","inlineContent":[{"type":"text","text":"So for a plain old everyday actor there’s no annotation, no special resolution function, and nothing to remember. Register it, resolve it, await its methods."}]},{"type":"paragraph","inlineContent":[{"type":"text","text":"Done."}]},{"anchor":"Main-Actor-Isolation","type":"heading","level":2,"text":"Main Actor Isolation"},{"type":"paragraph","inlineContent":[{"text":"Now consider a type that is isolated to the main actor. View models are the common example.","type":"text"}]},{"type":"codeListing","code":["@MainActor","class ContentViewModel {","    init() {","        \/\/ initializer is @MainActor-isolated","    }","    func load() async { ... }","}"],"syntax":"swift"},{"inlineContent":[{"type":"text","text":"Because the initializer is "},{"type":"codeVoice","code":"@MainActor"},{"type":"text","text":"-isolated, the factory closure that calls it has to be "},{"type":"codeVoice","code":"@MainActor"},{"type":"text","text":"-isolated too. You get there by annotating the computed property."}],"type":"paragraph"},{"type":"codeListing","code":["extension Container {","    @MainActor","    var contentViewModel: Factory<ContentViewModel> {","        self { ContentViewModel() }","    }","}"],"syntax":"swift"},{"type":"paragraph","inlineContent":[{"type":"text","text":"The annotation is the whole trick. It requires the Factory request to be on the main actor so the initializer runs on the MainActor as well."}]},{"type":"paragraph","inlineContent":[{"text":"Most of the time you never think about this because you resolve a main actor type from main actor code. A ","type":"text"},{"code":"@MainActor","type":"codeVoice"},{"text":" view model resolved by ","type":"text"},{"code":"@Injected","type":"codeVoice"},{"text":" inside another ","type":"text"},{"code":"@MainActor","type":"codeVoice"},{"text":" type, or referenced from a SwiftUI view, is already on the main actor when the Factory is requested and resolution occurs.","type":"text"}]},{"syntax":"swift","code":["@MainActor","class CoordinatorViewModel {","    @Injected(\\.contentViewModel) var content","}"],"type":"codeListing"},{"inlineContent":[{"text":"See ","type":"text"},{"isActive":true,"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/SwiftUI","type":"reference"},{"text":" for more on main actor types and the SwiftUI property wrapper
```

**File**: `docs/data/documentation/factorykit/autoregistering.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"identifier":{"url":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering","interfaceLanguage":"swift"},"primaryContentSections":[{"declarations":[{"platforms":["macOS"],"languages":["swift"],"tokens":[{"kind":"keyword","text":"protocol"},{"kind":"text","text":" "},{"kind":"identifier","text":"AutoRegistering"}]}],"kind":"declarations"},{"kind":"mentions","mentions":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Containers"]},{"kind":"content","content":[{"text":"Overview","type":"heading","anchor":"overview","level":2},{"inlineContent":[{"text":"Add this protocol to a container to support first-time registration of needed dependencies prior to first resolution","type":"text"},{"text":" ","type":"text"},{"text":"of a dependency on that container.","type":"text"}],"type":"paragraph"},{"syntax":"swift","code":["extension Container: @retroactive AutoRegistering {","    func autoRegister() {","        someService.register {","            CrossModuleService()","        }","    }","}"],"type":"codeListing"},{"type":"paragraph","inlineContent":[{"type":"text","text":"The "},{"code":"autoRegister","type":"codeVoice"},{"type":"text","text":" function is called on each instantiated container prior to"},{"type":"text","text":" "},{"type":"text","text":"the first resolution of a Factory on that container."}]},{"content":[{"inlineContent":[{"type":"text","text":"Calling "},{"type":"codeVoice","code":"container.manager.reset(options: .all)"},{"type":"text","text":" restores the container to it’s initial state"},{"type":"text","text":" "},{"type":"text","text":"and autoRegister will be called again if it exists."}],"type":"paragraph"}],"type":"aside","name":"Warning","style":"warning"},{"inlineContent":[{"type":"text","text":"The "},{"type":"codeVoice","code":"@retroactive"},{"type":"text","text":" attribute is needed as of Swift 6 to silence a conformance warning."}],"type":"paragraph"}]}],"sections":[],"variants":[{"traits":[{"interfaceLanguage":"swift"}],"paths":["\/documentation\/factorykit\/autoregistering"]}],"topicSections":[{"identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering\/autoRegister()"],"title":"Instance Methods","generated":true,"anchor":"Instance-Methods"}],"abstract":[{"type":"text","text":"Adds an registration “hook” to a "},{"type":"codeVoice","code":"Container"},{"type":"text","text":"."}],"schemaVersion":{"major":0,"patch":0,"minor":3},"hierarchy":{"paths":[["doc:\/\/FactoryKit\/documentation\/FactoryKit"]]},"kind":"symbol","metadata":{"fragments":[{"text":"protocol","kind":"keyword"},{"text":" ","kind":"text"},{"text":"AutoRegistering","kind":"identifier"}],"externalID":"s:10FactoryKit15AutoRegisteringP","title":"AutoRegistering","role":"symbol","navigatorTitle":[{"kind":"identifier","text":"AutoRegistering"}],"roleHeading":"Protocol","symbolKind":"protocol","modules":[{"name":"FactoryKit"}]},"references":{"doc://FactoryKit/documentation/FactoryKit/Containers":{"url":"\/documentation\/factorykit\/containers","abstract":[{"text":"Containers are the cornerstone of Factory 2.0. What are they and how do we use them?","type":"text"}],"role":"article","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Containers","type":"topic","kind":"article","title":"Containers"},"doc://FactoryKit/documentation/FactoryKit/AutoRegistering":{"url":"\/documentation\/factorykit\/autoregistering","abstract":[{"type":"text","text":"Adds an registration “hook” to a "},{"type":"codeVoice","code":"Container"},{"type":"text","text":"."}],"role":"symbol","fragments":[{"text":"protocol","kind":"keyword"},{"text":" ","kind":"text"},{"text":"AutoRegistering","kind":"identifier"}],"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering","type":"topic","kind":"symbol","title":"AutoRegistering","navigatorTitle":[{"text":"AutoRegistering","kind":"identifier"}]},"doc://FactoryKit/documentation/FactoryKit/AutoRegistering/autoRegister()":{"url":"\/documentation\/factorykit\/autoregistering\/autoregister()","abstract":[{"type":"text","text":"User provided function that supports first-time registration of needed dependencies prior to first resolution"},{"type":"text","text":" "},{"type":"text","text":"of a dependency on that container."}],"role":"symbol","fragments":[{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"kind":"identifier","text":"autoRegister"},{"kind":"text","text":"()"}],"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering\/autoRegister()","type":"topic","kind":"symbol","title":"autoRegister()","required":true},"doc://FactoryKit/documentation/FactoryKit":{"role":"collection","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit","type":"topic","title":"FactoryKit","abstract":[{"type":"text","text":"A modern approach to Container-Based Dependency Injection for Swift and SwiftUI."}],"url":"\/documentation\/factorykit","kind":"symbol"}}}
\ No newline at end of file
+{"topicSections":[{"anchor":"Instance-Me
```

**File**: `docs/data/documentation/factorykit/autoregistering/autoregister().json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"primaryContentSections":[{"declarations":[{"platforms":["macOS"],"languages":["swift"],"tokens":[{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"text":"autoRegister","kind":"identifier"},{"text":"()","kind":"text"}]}],"kind":"declarations"}],"variants":[{"paths":["\/documentation\/factorykit\/autoregistering\/autoregister()"],"traits":[{"interfaceLanguage":"swift"}]}],"hierarchy":{"paths":[["doc:\/\/FactoryKit\/documentation\/FactoryKit","doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering"]]},"abstract":[{"text":"User provided function that supports first-time registration of needed dependencies prior to first resolution","type":"text"},{"text":" ","type":"text"},{"text":"of a dependency on that container.","type":"text"}],"sections":[],"identifier":{"interfaceLanguage":"swift","url":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering\/autoRegister()"},"schemaVersion":{"major":0,"patch":0,"minor":3},"kind":"symbol","metadata":{"roleHeading":"Instance Method","role":"symbol","symbolKind":"method","modules":[{"name":"FactoryKit"}],"externalID":"s:10FactoryKit15AutoRegisteringP12autoRegisteryyF","fragments":[{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"kind":"identifier","text":"autoRegister"},{"kind":"text","text":"()"}],"title":"autoRegister()","required":true},"references":{"doc://FactoryKit/documentation/FactoryKit":{"role":"collection","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit","type":"topic","title":"FactoryKit","abstract":[{"type":"text","text":"A modern approach to Container-Based Dependency Injection for Swift and SwiftUI."}],"url":"\/documentation\/factorykit","kind":"symbol"},"doc://FactoryKit/documentation/FactoryKit/AutoRegistering/autoRegister()":{"url":"\/documentation\/factorykit\/autoregistering\/autoregister()","abstract":[{"type":"text","text":"User provided function that supports first-time registration of needed dependencies prior to first resolution"},{"type":"text","text":" "},{"type":"text","text":"of a dependency on that container."}],"role":"symbol","fragments":[{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"kind":"identifier","text":"autoRegister"},{"kind":"text","text":"()"}],"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering\/autoRegister()","type":"topic","kind":"symbol","title":"autoRegister()","required":true},"doc://FactoryKit/documentation/FactoryKit/AutoRegistering":{"url":"\/documentation\/factorykit\/autoregistering","abstract":[{"type":"text","text":"Adds an registration “hook” to a "},{"type":"codeVoice","code":"Container"},{"type":"text","text":"."}],"role":"symbol","fragments":[{"text":"protocol","kind":"keyword"},{"text":" ","kind":"text"},{"text":"AutoRegistering","kind":"identifier"}],"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering","type":"topic","kind":"symbol","title":"AutoRegistering","navigatorTitle":[{"text":"AutoRegistering","kind":"identifier"}]}}}
\ No newline at end of file
+{"metadata":{"symbolKind":"method","title":"autoRegister()","fragments":[{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"kind":"identifier","text":"autoRegister"},{"kind":"text","text":"()"}],"role":"symbol","roleHeading":"Instance Method","modules":[{"name":"FactoryKit"}],"required":true,"externalID":"s:10FactoryKit15AutoRegisteringP12autoRegisteryyF"},"abstract":[{"type":"text","text":"User provided function that supports first-time registration of needed dependencies prior to first resolution"},{"type":"text","text":" "},{"type":"text","text":"of a dependency on that container."}],"schemaVersion":{"patch":0,"minor":3,"major":0},"identifier":{"url":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering\/autoRegister()","interfaceLanguage":"swift"},"primaryContentSections":[{"kind":"declarations","declarations":[{"tokens":[{"text":"func","kind":"keyword"},{"text":" ","kind":"text"},{"text":"autoRegister","kind":"identifier"},{"text":"()","kind":"text"}],"languages":["swift"],"platforms":["macOS"]}]}],"variants":[{"paths":["\/documentation\/factorykit\/autoregistering\/autoregister()"],"traits":[{"interfaceLanguage":"swift"}]}],"kind":"symbol","hierarchy":{"paths":[["doc:\/\/FactoryKit\/documentation\/FactoryKit","doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering"]]},"sections":[],"references":{"doc://FactoryKit/documentation/FactoryKit/AutoRegistering/autoRegister()":{"type":"topic","url":"\/documentation\/factorykit\/autoregistering\/autoregister()","abstract":[{"text":"User provided function that supports first-time registration of needed dependencies prior to first resolution","type":"text"},{"text":" ","type":"text"},{"text":"of a dependency on that container.","type":"text"}],"title":"autoRegister()","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/AutoRegistering\/autoRegister()","fragments":[{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"kind":"identifier","text
```

**File**: `docs/data/documentation/factorykit/chains.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"identifier":{"url":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Chains","interfaceLanguage":"swift"},"abstract":[{"text":"Detecting and solving Circular Dependency Chains.","type":"text"}],"metadata":{"role":"article","title":"Circular Dependency Chains","modules":[{"name":"FactoryKit"}],"roleHeading":"Article"},"primaryContentSections":[{"kind":"content","content":[{"text":"Circular Dependency Chain Detection","anchor":"Circular-Dependency-Chain-Detection","type":"heading","level":2},{"inlineContent":[{"text":"What’s a circular dependency? Let’s say that A needs B to be constructed, and B needs a C. But what happens if C needs an A?","type":"text"}],"type":"paragraph"},{"inlineContent":[{"text":"Examine the following class definitions.","type":"text"}],"type":"paragraph"},{"syntax":"swift","type":"codeListing","code":["class CircularA {","    @Injected(\\.circularB) var circularB","}","","class CircularB {","    @Injected(\\.circularC) var circularC","}","","class CircularC {","    @Injected(\\.circularA) var circularA","}"]},{"inlineContent":[{"text":"Attempting make an instance of ","type":"text"},{"type":"codeVoice","code":"CircularA"},{"text":" is going to result in an infinite loop.","type":"text"}],"type":"paragraph"},{"inlineContent":[{"text":"Why? Well, A’s injected property wrapper needs a B in to construct an A. Okay, fine. Let’s make one. But B’s wrapper needs a C, which can’t be made without injecting an A, which once more needs a B… and so on. Ad infinitum.","type":"text"}],"type":"paragraph"},{"type":"paragraph","inlineContent":[{"text":"This is a circular dependency chain.","type":"text"}]},{"level":2,"anchor":"Resolution","text":"Resolution","type":"heading"},{"type":"paragraph","inlineContent":[{"text":"Unfortunately, by the time this code is compiled and run it’s too late to break the cycle. We’ve effectively coded an infinite loop into our program.","type":"text"}]},{"type":"paragraph","inlineContent":[{"text":"All Factory can do in this case is die gracefully and in the process dump the dependency chain that indicates where the problem lies.","type":"text"}]},{"code":["2022-12-23 14:57:23.512032-0600 FactoryDemo[47546:6946786] Factory\/Factory.swift:393: ","FACTORY: Circular dependency on Container.recursiveA"],"type":"codeListing","syntax":null},{"type":"paragraph","inlineContent":[{"type":"text","text":"With the above information in hand we could start walking recursiveA’s dependency tree to find the problem… but Factory provides an easier way. Just turn on trace prior to creating recursiveA."}]},{"syntax":"swift","code":["Container.shared.manager.trace.toggle()","let a = Container.shared.recursiveA()"],"type":"codeListing"},{"type":"paragraph","inlineContent":[{"type":"text","text":"With the trace log in hand, the cycle becomes obvious."}]},{"syntax":null,"type":"codeListing","code":["0: FactoryKit.Container.circularA<FactoryDemo.CircularA>","1:     FactoryKit.Container.circularB<FactoryDemo.CircularB>","2:         FactoryKit.Container.circularC<FactoryDemo.CircularC>","3:             FactoryKit.Container.circularA<FactoryDemo.CircularA>"]},{"type":"paragraph","inlineContent":[{"type":"text","text":"CircularC is attempting to inject an instance of CircularA, and we can see that in the code."}]},{"syntax":"swift","type":"codeListing","code":["class RecursiveC {","    @Injected(\\.recursiveA) var a: RecursiveA?","    init() {}","}"]},{"type":"paragraph","inlineContent":[{"type":"text","text":"We could fix things by changing CircularC’s injection wrapper to "},{"type":"codeVoice","code":"LazyInjected"},{"type":"text","text":" or, better yet, "},{"type":"codeVoice","code":"WeakLazyInjected"},{"type":"text","text":" in order to avoid a retain cycle."}]},{"type":"paragraph","inlineContent":[{"type":"text","text":"But a better solution would probably entail breaking out some of the functionality from RecursiveA and creating a "},{"inlineContent":[{"type":"text","text":"third"}],"type":"emphasis"},{"type":"text","text":" object that RecursiveA "},{"inlineContent":[{"type":"text","text":"and"}],"type":"emphasis"},{"type":"text","text":" RecursiveC could both include."}]},{"type":"paragraph","inlineContent":[{"type":"text","text":"Circular dependencies such as this are usually a violation of the Single Responsibility Principle, and should be avoided."}]},{"style":"important","name":"Important","type":"aside","content":[{"inlineContent":[{"type":"text","text":"Due to the overhead involved, circular dependency detection only occurs when running the application in DEBUG mode. The code is stripped out of production builds for improved performance."}],"type":"paragraph"}]},{"text":"Disabling CDC Detection","anchor":"Disabling-CDC-Detection","type":"heading","level":2},{"type":"paragraph","inlineContent":[{"type":"text","text":"Circular dependency chain detection can be disabled if desired."}]},{"syntax":"swift","type":"codeListing","code":["Container.shared.manager.circularDepende
```

**File**: `docs/data/documentation/factorykit/container.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"identifier":{"interfaceLanguage":"swift","url":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container"},"hierarchy":{"paths":[["doc:\/\/FactoryKit\/documentation\/FactoryKit"]]},"schemaVersion":{"major":0,"minor":3,"patch":0},"sections":[],"kind":"symbol","topicSections":[{"title":"Initializers","generated":true,"anchor":"Initializers","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/init()"]},{"title":"Instance Properties","generated":true,"anchor":"Instance-Properties","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/manager"]},{"title":"Type Properties","generated":true,"anchor":"Type-Properties","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/shared"]},{"title":"Default Implementations","generated":true,"anchor":"Default-Implementations","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/ManagedContainer-Implementations","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/SharedContainer-Implementations"]}],"primaryContentSections":[{"kind":"declarations","declarations":[{"platforms":["macOS"],"languages":["swift"],"tokens":[{"text":"nonisolated","kind":"attribute"},{"text":" ","kind":"text"},{"text":"final","kind":"keyword"},{"text":" ","kind":"text"},{"text":"class","kind":"keyword"},{"text":" ","kind":"text"},{"text":"Container","kind":"identifier"}]}]},{"kind":"mentions","mentions":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/Containers"]},{"kind":"content","content":[{"level":2,"anchor":"overview","text":"Overview","type":"heading"},{"inlineContent":[{"type":"text","text":"Containers are used by Factory to manage object creation, object resolution, and object lifecycles in general."}],"type":"paragraph"},{"syntax":"swift","code":["extension Container {","    var service: Factory<ServiceType> {","        self { MyService() }","    }","}"],"type":"codeListing"},{"inlineContent":[{"type":"text","text":"Registrations and scope caches will persist as long as the associated container remains in scope."},{"type":"text","text":" "},{"type":"text","text":"If the Container’s @TaskLocal macro provided "},{"type":"codeVoice","code":"withValue"},{"type":"text","text":" function is used, the aforementioned scope of the container will be isolated to that task."}],"type":"paragraph"},{"inlineContent":[{"type":"text","text":"See "},{"type":"reference","isActive":true,"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Containers"},{"type":"text","text":" for more information."}],"type":"paragraph"}]}],"variants":[{"paths":["\/documentation\/factorykit\/container"],"traits":[{"interfaceLanguage":"swift"}]}],"metadata":{"externalID":"s:10FactoryKit9ContainerC","title":"Container","fragments":[{"text":"class","kind":"keyword"},{"text":" ","kind":"text"},{"text":"Container","kind":"identifier"}],"modules":[{"name":"FactoryKit"}],"roleHeading":"Class","navigatorTitle":[{"text":"Container","kind":"identifier"}],"symbolKind":"class","role":"symbol"},"abstract":[{"text":"This is the default Container provided for your convenience by Factory.","type":"text"}],"relationshipsSections":[{"title":"Conforms To","kind":"relationships","type":"conformsTo","identifiers":["doc:\/\/FactoryKit\/documentation\/FactoryKit\/ManagedContainer","doc:\/\/FactoryKit\/documentation\/FactoryKit\/SharedContainer","doc:\/\/FactoryKit\/s8SendableP","doc:\/\/FactoryKit\/s16SendableMetatypeP"]}],"references":{"doc://FactoryKit/documentation/FactoryKit/ManagedContainer":{"role":"symbol","type":"topic","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/ManagedContainer","title":"ManagedContainer","navigatorTitle":[{"text":"ManagedContainer","kind":"identifier"}],"abstract":[{"text":"ManagedContainer defines the core protocol all Containers must adopt.","type":"text"}],"kind":"symbol","url":"\/documentation\/factorykit\/managedcontainer","fragments":[{"text":"protocol","kind":"keyword"},{"text":" ","kind":"text"},{"text":"ManagedContainer","kind":"identifier"}]},"doc://FactoryKit/documentation/FactoryKit/Container":{"fragments":[{"text":"class","kind":"keyword"},{"text":" ","kind":"text"},{"text":"Container","kind":"identifier"}],"title":"Container","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container","type":"topic","abstract":[{"text":"This is the default Container provided for your convenience by Factory.","type":"text"}],"url":"\/documentation\/factorykit\/container","navigatorTitle":[{"text":"Container","kind":"identifier"}],"role":"symbol","kind":"symbol"},"doc://FactoryKit/documentation/FactoryKit/Container/SharedContainer-Implementations":{"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/SharedContainer-Implementations","title":"SharedContainer Implementations","kind":"article","url":"\/documentation\/factorykit\/container\/sharedcontainer-implementations","type":"topic","role":"collectionGroup","abstract":[]},"doc://FactoryKit/documentation/FactoryKit/Contain
```

**File**: `docs/data/documentation/factorykit/container/callasfunction(_:).json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"identifier":{"interfaceLanguage":"swift","url":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/callAsFunction(_:)"},"abstract":[{"type":"text","text":"Defines a convenience function to allow easy container transformations in SwiftUI Previews."}],"metadata":{"fragments":[{"text":"func","kind":"keyword"},{"text":" ","kind":"text"},{"text":"callAsFunction","kind":"identifier"},{"text":"((","kind":"text"},{"text":"Self","kind":"typeIdentifier"},{"text":") -> ","kind":"text"},{"preciseIdentifier":"s:s4Voida","text":"Void","kind":"typeIdentifier"},{"text":") -> ","kind":"text"},{"preciseIdentifier":"s:7SwiftUI9EmptyViewV","text":"EmptyView","kind":"typeIdentifier"}],"title":"callAsFunction(_:)","roleHeading":"Instance Method","role":"symbol","externalID":"s:10FactoryKit15SharedContainerPAAE14callAsFunctiony7SwiftUI9EmptyViewVyxXEF::SYNTHESIZED::s:10FactoryKit9ContainerC","modules":[{"name":"FactoryKit"}],"extendedModule":"FactoryKit","symbolKind":"method"},"primaryContentSections":[{"declarations":[{"tokens":[{"kind":"attribute","text":"@discardableResult"},{"kind":"text","text":" "},{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"kind":"identifier","text":"callAsFunction"},{"kind":"text","text":"("},{"kind":"externalParam","text":"_"},{"kind":"text","text":" "},{"kind":"internalParam","text":"transform"},{"kind":"text","text":": ("},{"kind":"typeIdentifier","text":"Self"},{"kind":"text","text":") -> "},{"kind":"typeIdentifier","text":"Void","preciseIdentifier":"s:s4Voida"},{"kind":"text","text":") -> "},{"kind":"typeIdentifier","text":"EmptyView","preciseIdentifier":"s:7SwiftUI9EmptyViewV"}],"platforms":["macOS"],"languages":["swift"]}],"kind":"declarations"},{"kind":"content","content":[{"anchor":"discussion","level":2,"type":"heading","text":"Discussion"},{"code":["#Preview {","    Container.shared {","        $0.requestUsers { MockAsyncRequest { User.mockUsers } }","        \/\/ as many as needed","    }","    MainView()","}"],"type":"codeListing","syntax":"swift"},{"type":"paragraph","inlineContent":[{"type":"text","text":"Without it you’d need something like the following let assignment."}]},{"code":["#Preview {","    let _ = Container.shared {","        $0.requestUsers { MockAsyncRequest { User.mockUsers } }","    }","    MainView()","}"],"type":"codeListing","syntax":"swift"}]}],"schemaVersion":{"patch":0,"major":0,"minor":3},"hierarchy":{"paths":[["doc:\/\/FactoryKit\/documentation\/FactoryKit","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container"]]},"kind":"symbol","sections":[],"variants":[{"paths":["\/documentation\/factorykit\/container\/callasfunction(_:)"],"traits":[{"interfaceLanguage":"swift"}]}],"references":{"doc://FactoryKit/documentation/FactoryKit/Container":{"fragments":[{"text":"class","kind":"keyword"},{"text":" ","kind":"text"},{"text":"Container","kind":"identifier"}],"title":"Container","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container","type":"topic","abstract":[{"text":"This is the default Container provided for your convenience by Factory.","type":"text"}],"url":"\/documentation\/factorykit\/container","navigatorTitle":[{"text":"Container","kind":"identifier"}],"role":"symbol","kind":"symbol"},"doc://FactoryKit/documentation/FactoryKit":{"role":"collection","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit","type":"topic","title":"FactoryKit","abstract":[{"type":"text","text":"A modern approach to Container-Based Dependency Injection for Swift and SwiftUI."}],"url":"\/documentation\/factorykit","kind":"symbol"},"doc://FactoryKit/documentation/FactoryKit/Container/callAsFunction(_:)":{"url":"\/documentation\/factorykit\/container\/callasfunction(_:)","abstract":[{"type":"text","text":"Defines a convenience function to allow easy container transformations in SwiftUI Previews."}],"role":"symbol","fragments":[{"text":"func","kind":"keyword"},{"text":" ","kind":"text"},{"text":"callAsFunction","kind":"identifier"},{"text":"((","kind":"text"},{"kind":"typeIdentifier","text":"Self"},{"text":") -> ","kind":"text"},{"text":"Void","preciseIdentifier":"s:s4Voida","kind":"typeIdentifier"},{"text":") -> ","kind":"text"},{"text":"EmptyView","preciseIdentifier":"s:7SwiftUI9EmptyViewV","kind":"typeIdentifier"}],"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/callAsFunction(_:)","type":"topic","kind":"symbol","title":"callAsFunction(_:)"}}}
\ No newline at end of file
+{"metadata":{"symbolKind":"method","title":"callAsFunction(_:)","extendedModule":"FactoryKit","fragments":[{"text":"func","kind":"keyword"},{"text":" ","kind":"text"},{"text":"callAsFunction","kind":"identifier"},{"text":"((","kind":"text"},{"text":"Self","kind":"typeIdentifier"},{"text":") -> ","kind":"text"},{"text":"Void","preciseIdentifier":"s:s4Voida","kind":"typeIdentifier"},{"text":") -> ","kind":"text"},{"text":"EmptyView","preciseIdentifier":"s:7SwiftUI9EmptyViewV","kind":"typeIdentifier"}],"role":"symbol","modules":[{"name":"F
```

**File**: `docs/data/documentation/factorykit/container/callasfunction(key:_:)-9dimj.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"identifier":{"interfaceLanguage":"swift","url":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/callAsFunction(key:_:)-9dimj"},"abstract":[{"text":"Syntactic sugar allows container to create a properly bound Factory.","type":"text"}],"metadata":{"fragments":[{"text":"func","kind":"keyword"},{"text":" ","kind":"text"},{"text":"callAsFunction","kind":"identifier"},{"text":"<","kind":"text"},{"text":"T","kind":"genericParameter"},{"text":">(","kind":"text"},{"text":"key","kind":"externalParam"},{"text":": ","kind":"text"},{"text":"StaticString","preciseIdentifier":"s:s12StaticStringV","kind":"typeIdentifier"},{"text":", ","kind":"text"},{"text":"VoidFactoryType","preciseIdentifier":"s:10FactoryKit04VoidA4Typea","kind":"typeIdentifier"},{"text":"<","kind":"text"},{"text":"T","preciseIdentifier":"s:10FactoryKit16ManagedContainerPAAE14callAsFunction3key_AA0A0Vyqd__Gs12StaticStringV_qd__yctlF1TL_qd__mfp","kind":"typeIdentifier"},{"text":">) -> ","kind":"text"},{"text":"Factory","preciseIdentifier":"s:10FactoryKit0A0V","kind":"typeIdentifier"},{"text":"<","kind":"text"},{"text":"T","preciseIdentifier":"s:10FactoryKit16ManagedContainerPAAE14callAsFunction3key_AA0A0Vyqd__Gs12StaticStringV_qd__yctlF1TL_qd__mfp","kind":"typeIdentifier"},{"text":">","kind":"text"}],"title":"callAsFunction(key:_:)","roleHeading":"Instance Method","role":"symbol","externalID":"s:10FactoryKit16ManagedContainerPAAE14callAsFunction3key_AA0A0Vyqd__Gs12StaticStringV_qd__yctlF::SYNTHESIZED::s:10FactoryKit9ContainerC","modules":[{"name":"FactoryKit"}],"extendedModule":"FactoryKit","symbolKind":"method"},"primaryContentSections":[{"declarations":[{"platforms":["macOS"],"tokens":[{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"kind":"identifier","text":"callAsFunction"},{"kind":"text","text":"<"},{"kind":"genericParameter","text":"T"},{"kind":"text","text":">("},{"kind":"externalParam","text":"key"},{"kind":"text","text":": "},{"kind":"typeIdentifier","preciseIdentifier":"s:s12StaticStringV","text":"StaticString"},{"text":" = ","kind":"text"},{"text":"#function","kind":"keyword"},{"text":", ","kind":"text"},{"text":"_","kind":"externalParam"},{"kind":"text","text":" "},{"kind":"internalParam","text":"factory"},{"kind":"text","text":": "},{"kind":"attribute","text":"@escaping"},{"kind":"text","text":" "},{"kind":"typeIdentifier","text":"VoidFactoryType","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/VoidFactoryType","preciseIdentifier":"s:10FactoryKit04VoidA4Typea"},{"kind":"text","text":"<"},{"kind":"typeIdentifier","text":"T","preciseIdentifier":"s:10FactoryKit16ManagedContainerPAAE14callAsFunction3key_AA0A0Vyqd__Gs12StaticStringV_qd__yctlF1TL_qd__mfp"},{"kind":"text","text":">) -> "},{"kind":"typeIdentifier","text":"Factory","identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Factory","preciseIdentifier":"s:10FactoryKit0A0V"},{"kind":"text","text":"<"},{"kind":"typeIdentifier","text":"T","preciseIdentifier":"s:10FactoryKit16ManagedContainerPAAE14callAsFunction3key_AA0A0Vyqd__Gs12StaticStringV_qd__yctlF1TL_qd__mfp"},{"kind":"text","text":">"}],"languages":["swift"]}],"kind":"declarations"}],"hierarchy":{"paths":[["doc:\/\/FactoryKit\/documentation\/FactoryKit","doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container"]]},"schemaVersion":{"major":0,"minor":3,"patch":0},"sections":[],"kind":"symbol","variants":[{"paths":["\/documentation\/factorykit\/container\/callasfunction(key:_:)-9dimj"],"traits":[{"interfaceLanguage":"swift"}]}],"references":{"doc://FactoryKit/documentation/FactoryKit/Container/callAsFunction(key:_:)-9dimj":{"url":"\/documentation\/factorykit\/container\/callasfunction(key:_:)-9dimj","abstract":[{"type":"text","text":"Syntactic sugar allows container to create a properly bound Factory."}],"role":"symbol","fragments":[{"kind":"keyword","text":"func"},{"kind":"text","text":" "},{"kind":"identifier","text":"callAsFunction"},{"kind":"text","text":"<"},{"kind":"genericParameter","text":"T"},{"kind":"text","text":">("},{"kind":"externalParam","text":"key"},{"kind":"text","text":": "},{"kind":"typeIdentifier","text":"StaticString","preciseIdentifier":"s:s12StaticStringV"},{"kind":"text","text":", "},{"kind":"typeIdentifier","text":"VoidFactoryType","preciseIdentifier":"s:10FactoryKit04VoidA4Typea"},{"kind":"text","text":"<"},{"kind":"typeIdentifier","text":"T","preciseIdentifier":"s:10FactoryKit16ManagedContainerPAAE14callAsFunction3key_AA0A0Vyqd__Gs12StaticStringV_qd__yctlF1TL_qd__mfp"},{"kind":"text","text":">) -> "},{"kind":"typeIdentifier","text":"Factory","preciseIdentifier":"s:10FactoryKit0A0V"},{"kind":"text","text":"<"},{"kind":"typeIdentifier","text":"T","preciseIdentifier":"s:10FactoryKit16ManagedContainerPAAE14callAsFunction3key_AA0A0Vyqd__Gs12StaticStringV_qd__yctlF1TL_qd__mfp"},{"kind":"text","text":">"}],"identifier":"doc:\/\/FactoryKit\/documentation\/FactoryKit\/Container\/callAsFunction(key:_:)-9dimj","type":"topic","kind":"symbol","title":"callAsFunction(
```

---

### Incident Patch 2: `db8d149e` (2026-10-21)
**Commit Message**: Update README

**File**: `README.md` (modified, +2/-1)
```diff
@@ -113,8 +113,8 @@ struct FactoryDemoApp: App {
         }
     }
 }
-
 ```
+
 New to Factory 3.5 is support for scene-based containers in SwiftUI. `InjectedObservable` and `InjectedObject` both obtain their containers from the environment and resolve their dependencies from the current scene.
 
 ```swift
@@ -125,6 +125,7 @@ struct ContentView: View {
     }
 }
 ```
+
 See [Scenes](https://hmlongco.github.io/Factory/documentation/factorykit/scenes) for more examples.
 
 Finally, Factory also has a set of global dependency resolution functions. These global functions can easily be replaced should you want to minimize your codebase's apparent dependency on Factory.
```

#### Recent Merged Pull Requests:
- **PR #389** (closed): Scope box nil check optimisation (@feduza)
- **PR #388** (closed): Prevent stale resolutions from repopulating invalidated caches (@lucaspham1)
- **PR #387** (closed): Reclaim unused resolution locks and parameter keys (@lucaspham1)
- **PR #386** (closed): Fix graph-scoped delegation across containers (@lucaspham1)
- **PR #385** (2026-09-15): Fix concurrent first resolution of cached dependencies (@lucaspham1)
- **PR #384** (2026-09-16): Fix parameter-scoped cache key hash collisions (@lucaspham1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
