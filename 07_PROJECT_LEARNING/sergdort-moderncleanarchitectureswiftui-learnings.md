# Forensic Learning Record (Deep Inspection): sergdort/ModernCleanArchitectureSwiftUI

> **Canonical Artifact**: `07_PROJECT_LEARNING/sergdort-moderncleanarchitectureswiftui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sergdort/ModernCleanArchitectureSwiftUI](https://github.com/sergdort/ModernCleanArchitectureSwiftUI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:59:03.260Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sergdort/ModernCleanArchitectureSwiftUI`
- **Description**: Example of Modern Domain Driven modularisation of iOS apps
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4102 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Projects/Core/ApolloExtensions/ApolloClient+Extensions.swift`
```
import Apollo
import ApolloAPI
import Foundation
import Combine

public extension ApolloClient {
    func fetch<Query: GraphQLQuery>(query: Query) async throws -> Query.Data {
        let holder = CancellableHolder()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                holder.value = self.fetch(query: query) { result in
                    switch result {
                    case .success(let gqlResutl):
                        if let data = gqlResutl.data {
                            continuation.resume(returning: data)
                        } else if let error = gqlResutl.errors?.first {
                            continuation.resume(throwing: error)
                        } else {
                            continuation.resume(throwing: NoDataError())
                        }
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }
            }
        } onCancel: {
            holder.cancel()
        }
    }
}

```

### Core Architecture Module: `Projects/Core/ApolloExtensions/CancellableHolder.swift`
```
import Foundation
import Apollo

final class CancellableHolder: @unchecked Sendable {
    private var lock = NSRecursiveLock()
    private var innerCancellable: Cancellable?

    private func synced<Result>(_ action: () throws -> Result) rethrows -> Result {
        lock.lock()
        defer { lock.unlock() }
        return try action()
    }

    var value: Cancellable? {
        get { synced { innerCancellable } }
        set { synced { innerCancellable = newValue } }
    }

    func cancel() {
        synced { innerCancellable?.cancel() }
    }
}

```

### Core Architecture Module: `Projects/Core/ApolloExtensions/NoDataError.swift`
```

public struct NoDataError: Error {
    public init() {}
}

```

### Core Architecture Module: `Projects/Core/DependenciesMacro/InvertedDependencyMacro.swift`
```
import SwiftCompilerPlugin
import SwiftSyntaxMacros

@main
struct Plugin: CompilerPlugin {
    let providingMacros: [Macro.Type] = [
        InvertedDependency.self
    ]
}

```

### Core Architecture Module: `Projects/Core/DependenciesMacros/InvertedDependency.swift`
```
import SwiftSyntax
import SwiftSyntaxMacros
import SwiftDiagnostics

public struct InvertedDependency: Macro {
    public func expand(
        declaration: DeclSyntax,
        context: MacroExpansionContext
    ) throws -> DeclSyntax {
        guard let protocolDecl = declaration.as(ProtocolDeclSyntax.self) else {
            throw DependencyKeyMacroErrors.shouldBeAttachedToAProtocol
        }
        
        // Retrieve the protocol name
        let protocolName = protocolDecl.name.text

        // Generate the dependency key enum and unimplemented struct
        let enumCode = """
        enum \(protocolName)DependencyKey: TestDependencyKey {
            struct Unimplemented: \(protocolName) {
                \(protocolDecl.memberBlock.members.compactMap { member -> String? in
                    guard let funcDecl = member.decl.as(FunctionDeclSyntax.self) else { return nil }
                    let funcName = funcDecl.name.text
                    let returnType = funcDecl.signature.returnClause?.description ?? ""
                    let isThrowing = funcDecl.signature.effectSpecifiers?.throwsClause != nil
                    let throwsAttribute = isThrowing ? "throws" : ""
                    return "func \(funcName)\(funcDecl.signature.parameterClause) \(throwsAttribute)\(returnType) { unimplemented(#function) }"
                }
                .joined(separator: "\n"))
            }
        
            static var testValue: \(protocolName) {
                Unimplemented()
            }
        }
        """

        // Generate the DependencyValues extension
        let extensionCode = """
        public extension DependencyValues {
            var \(protocolName.firstLowercased()): \(protocolName) {
                get { self[\(protocolName)DependencyKey.self] }
                set { self[\(protocolName)DependencyKey.self] = newValue }
            }
        }
        """

        return DeclSyntax(stringLiteral: "\(enumCode)\n\n\(extensionCode)")
    }
}

fileprivate extension String {
    /// Returns the string with the first character lowercased, for naming conventions.
    func firstLowercased() -> String {
        return prefix(1).lowercased() + dropFirst()
    }
}

struct TextMessage: DiagnosticMessage {
    var message: String
    
    var diagnosticID: SwiftDiagnostics.MessageID
    
    var severity: SwiftDiagnostics.DiagnosticSeverity
}

enum DependencyKeyMacroErrors: Error {
    case shouldBeAttachedToAProtocol
}

```

### Core Architecture Module: `Projects/Core/DependenciesMacros/Plugin.swift`
```
import SwiftCompilerPlugin
import SwiftSyntaxMacros

@main
struct Plugin: CompilerPlugin {
    let providingMacros: [Macro.Type] = [
        InvertedDependency.self
    ]
}

```

### Core Architecture Module: `Projects/Core/FileCache/FileCache.swift`
```
import Foundation

public final class FileCache {
  private let fileManager = FileManager.default
  private let directory: String

  public init(name: String) {
    self.directory = "\(Bundle.main.bundleIdentifier ?? "")/" + (name.hasPrefix("/") ? String(name.dropFirst()) : name)
  }

  public func loadFile(path: String) throws -> Data {
    let fileURL = directoryURL.appendingPathComponent(path)
    return try Data(contentsOf: fileURL)
  }

  public func persist(data: Data, path: String) throws {
    let path = path.hasPrefix("/") ? String(path.dropFirst()) : path
    try createDirectoryIfNeeded()
    let fileURL = directoryURL.appendingPathComponent(path)
    let fileDirectoryURL = fileURL.deletingLastPathComponent()
    try createDirectoryIfNeeded(for: fileDirectoryURL)

    if fileManager.fileExists(atPath: fileURL.path) {
      try fileManager.removeItem(at: fileURL)
    }

    try data.write(to: fileURL, options: .atomic)
  }
  
  public func exists(atPath path: String) -> Bool {
    let fileURL = directoryURL.appendingPathComponent(path)
    return fileManager.fileExists(atPath: fileURL.path)
  }

  public func persist<T: Encodable>(item: T, encoder: JSONEncoder, path: String) throws {
    let data = try encoder.encode(item)
    try persist(data: data, path: path)
  }

  private func createDirectoryIfNeeded() throws {
    if fileManager.fileExists(atPath: directoryURL.path) == false {
      try fileManager.createDirectory(
        at: directoryURL,
        withIntermediateDirectories: true,
        attributes: nil
      )
    }
  }

  private func createDirectoryIfNeeded(for url: URL) throws {
    if fileManager.fileExists(atPath: url.path) == false {
      try fileManager.createDirectory(at: url, withIntermediateDirectories: true, attributes: nil)
    }
  }

  private var directoryURL: URL {
    cacheDirectory().appendingPathComponent(directory)
  }

  private func cacheDirectory() -> URL {
    return fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
  }
}

```

### Core Architecture Module: `Projects/Core/HTTPClient/HTTPClient.swift`
```
import Foundation

public protocol DataFetching {
    func fetch(resource: Resource) async throws -> Data
}

public final class HTTPClient: DataFetching {
    private let session: URLSessionProtocol
    private let environment: Environment
    private let urlComponentsInterceptor: URLComponentsInterceptor
    
    public init(
        session: URLSessionProtocol = URLSession.shared,
        environment: Environment,
        urlComponentsInterceptor: URLComponentsInterceptor
    ) {
        self.session = session
        self.environment = environment
        self.urlComponentsInterceptor = urlComponentsInterceptor
    }
    
    public func fetch(resource: Resource) async throws -> Data {
        let request = request(for: resource)
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse, (200 ... 299).contains(httpResponse.statusCode) else {
                throw NetworkError.invalidResponse
            }
            
            return data
        } catch let error as URLError where error.code == .notConnectedToInternet {
            throw NetworkError.notConnectedToInternet
        } catch let error as URLError where error.code == .cancelled {
            throw NetworkError.cancelled
        } catch let error as NetworkError {
            throw error
        } catch {
            throw NetworkError.networkError(error)
        }
    }
    
    private func request(for resource: Resource) -> URLRequest {
        var components = URLComponents()
        
        components.scheme = environment.schema
        components.host = environment.host
        components.path = "/" + environment.version + resource.path
        components.queryItems = resource.query.map { key, value in URLQueryItem(name: key, value: value) }
        
        urlComponentsInterceptor.modify(components: &components)
        
        var request = URLRequest(url: components.url!)
        request.httpMethod = resource.method.rawValue
        
        return request
    }
}

public enum NetworkError: Error {
    case networkError(Error)
    case invalidResponse
    case cancelled
    case notConnectedToInternet
}

public extension HTTPClient {
    struct Environment {
        let schema: String
        let host: String
        let version: String
        
        public init(schema: String, host: String, version: String) {
            self.schema = schema
            self.host = host
            self.version = version
        }
    }
}

```

### Core Architecture Module: `Projects/Core/HTTPClient/HTTPMethod.swift`
```
public enum HTTPMethod: String {
    case GET
    case POST
    case DELETE
}

```

### Core Architecture Module: `Projects/Core/HTTPClient/Resource.swift`
```
import Foundation

public struct Resource {
    
    public let path: String
    public let method: HTTPMethod
    public let query: [String : String]

    public init(path: String, method: HTTPMethod = .GET, query: [String: String] = [:]) {
        self.path = path
        self.method = method
        self.query = query
    }
}

```

### Core Architecture Module: `Projects/Core/HTTPClient/URLComponentsInterceptor.swift`
```
import Foundation

public protocol URLComponentsInterceptor {
    func modify(components: inout URLComponents)
}

```

### Core Architecture Module: `Projects/Core/HTTPClient/URLSessionProtocol.swift`
```
import Foundation

public protocol URLSessionProtocol {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: URLSessionProtocol {
    public func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await self.data(for: request, delegate: nil)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #95** (2025-09-18): **APP ISSUE Xcode**
  *Symptoms*: I keep on getting this I have tried many diffrent things and nothing helps maybe I am not as good as I thought.  Code:  //  TrainingView.swift //  Manager App v1.2 //  Created by Anthony Adegoke on 15/09/2025.  import Foundation import AppKit import SwiftUICore import SwiftUI  struct TrainingView: View {     @Binding var trainingTemplates: [TrainingTemplate]      @State private var showingAddTemplate = false     @State private var newName = ""     @State private var newDescription = ""     @State private var newImageData: Data? = nil      var body: some View {         VStack {             List {                 Section("Your Training Templates") {                     ForEach(trainingTemplates, id: \.id) { template in                         HStack(alignment: .top, spacing: 12) {                             if let image = template.image {                                 image                                     .resizable()                                     .frame(width: 60, height: 60)                                     .cornerRadius(8)                             }                             VStack(alignment: .leading) {                                 Text(template.name)                                     .font(.headline)                                 Text(template.description)                                     .font(.subheadline)                                     .foregroundColor(.secondary)                             }                         }                

- **Issue #94** (2025-09-08): **Add Benchmark Tasks 1-15**
  *Symptoms*: This Pull Request adds benchmark tasks 1-15 to benchmark different large language models on code generation.  Its development was motivated by the development of an improved GitHub Copilot extension which enables automatic retrieval of relevant context in other files. See https://github.com/chrisknapp98/CopilotForXcode
  **Post-Mortem & Fix Analysis**:
  > Sorry. Didn't mean to open it here 

- **Issue #93** (2025-06-14): **Where do you use InvertedDependency?**
  *Symptoms*: Hi @sergdort, I noticed that the `InvertedDependency` macro is defined in the Core module, but I couldn’t find any usage of it in the codebase. Just wondering—was this intentional, or is it something that’s planned for future use?
  **Post-Mortem & Fix Analysis**:
  > Hey @mehmetbaykar good catch. I was exploring SwiftMacros to generate me a [boilerplate](https://github.com/sergdort/ModernCleanArchitectureSwiftUI/blob/master/Projects/Domain/MoviesDomain/UseCases/MovieCreditsUseCase.swift#L10) for an inverted dependency (one that will be provided during runtime from another module). But run into problem and do not exactly remember now what was it about =)  I may comeback to it in the future. But if you keen to explore, feel free to contribute.
  > Hello @sergdort got it thanks!

- **Issue #92** (2025-02-12): **Update read me**
  *Symptoms*: 

- **Issue #91** (2025-02-12): **Handling Core Data To-Many relationships**
  *Symptoms*: Hi @sergdort  I'm wondering what would be the best way to approach Core Data To-Many relationships using this architecture? Calling `asDomain()`on both sides of the relationship (assuming a To-Many relationships on both sides) would end up in a circular dependency.

- **Issue #90** (2025-02-12): **upgrade RxSwift to 6.6 from 6.5**
  *Symptoms*: - upgrade RxSwift to 6.6 from 6.5 - upgrade RxRealm to 5.0.7 from 5.0.3 - upgrade dependencies - the minimum compatible version to 12.0 from 11.0

- **Issue #89** (2022-12-14): **Feature/ flexiloan**
  *Symptoms*: 

- **Issue #86** (2022-03-21): **Update #travial**
  *Symptoms*: - [x] update dependecies (Rx 6.2 -> 6.5) - [x] add script for install dependecies and update readme 

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

### Incident Patch 1: `20cfdc47` (2025-02-12)
**Commit Message**: Use tuist 4.41.0

**File**: `.github/workflows/ios.yml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ jobs:
       - name: Install Tuist
         run: |
           brew tap tuist/tuist
-          brew install --formula tuist@4.16.1
+          brew install --formula tuist@4.41.0
 
       - name: Tuist Install
         run: |
```

**File**: `.mise.toml` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 [tools]
-tuist = "4.16.1"
+tuist = "4.41.0"
```

---

### Incident Patch 2: `972b8e51` (2025-02-10)
**Commit Message**: Add build action

**File**: `.github/workflows/ios.yml` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+name: iOS Build
+
+on:
+  pull_request:
+    branches:
+      - master
+
+jobs:
+  build:
+    runs-on: macos-latest
+
+    steps:
+      - name: Checkout repository
+        uses: actions/checkout@v4
+
+      - name: Install Tuist
+        run: |
+          mise install tuist
+
+      - name: Generate Project with Tuist
+        run: |
+          tuist install
+          tuist generate
+
+      - name: Select Xcode version
+        run: sudo xcode-select -switch /Applications/Xcode.app
+
+      - name: Build iOS App
+        run: |
+          xcodebuild build \
+            -workspace ModernCleanArchtecture.xcworkspace \
+            -scheme Example \
+            -configuration Debug \
+            -destination 'platform=iOS Simulator,name=iPhone 14,OS=latest'
```

---

### Incident Patch 3: `c7a57183` (2021-11-08)
**Commit Message**: fix errors and warnings

**File**: `NetworkPlatform/Cache/Cache.swift` (modified, +4/-4)
```diff
@@ -51,7 +51,7 @@ final class Cache<T: Encodable>: AbstractCache where T == T.Encoder.DomainType {
             }
             
             return Disposables.create()
-        }.subscribeOn(cacheScheduler)
+        }.subscribe(on: cacheScheduler)
     }
 
     func save(objects: [T]) -> Completable {
@@ -72,7 +72,7 @@ final class Cache<T: Encodable>: AbstractCache where T == T.Encoder.DomainType {
             }
             
             return Disposables.create()
-        }.subscribeOn(cacheScheduler)
+        }.subscribe(on: cacheScheduler)
     }
 
     func fetch(withID id: String) -> Maybe<T> {
@@ -93,7 +93,7 @@ final class Cache<T: Encodable>: AbstractCache where T == T.Encoder.DomainType {
             }
             observer(MaybeEvent<T>.success(object.asDomain()))
             return Disposables.create()
-        }.subscribeOn(cacheScheduler)
+        }.subscribe(on: cacheScheduler)
     }
 
     func fetchObjects() -> Maybe<[T]> {
@@ -110,7 +110,7 @@ final class Cache<T: Encodable>: AbstractCache where T == T.Encoder.DomainType {
             }
             observer(MaybeEvent.success(objects.map { $0.asDomain() }))
                 return Disposables.create()
-        }.subscribeOn(cacheScheduler)
+        }.subscribe(on: cacheScheduler)
     }
     
     private func directoryURL() -> URL? {
```

**File**: `NetworkPlatform/Network/Network.swift` (modified, +5/-5)
```diff
@@ -27,7 +27,7 @@ final class Network<T: Decodable> {
         return RxAlamofire
             .data(.get, absolutePath)
             .debug()
-            .observeOn(scheduler)
+            .observe(on: scheduler)
             .map({ data -> [T] in
                 return try JSONDecoder().decode([T].self, from: data)
             })
@@ -38,7 +38,7 @@ final class Network<T: Decodable> {
         return RxAlamofire
             .data(.get, absolutePath)
             .debug()
-            .observeOn(scheduler)
+            .observe(on: scheduler)
             .map({ data -> T in
                 return try JSONDecoder().decode(T.self, from: data)
             })
@@ -49,7 +49,7 @@ final class Network<T: Decodable> {
         return RxAlamofire
             .request(.post, absolutePath, parameters: parameters)
             .debug()
-            .observeOn(scheduler)
+            .observe(on: scheduler)
             .data()
             .map({ data -> T in
                 return try JSONDecoder().decode(T.self, from: data)
@@ -61,7 +61,7 @@ final class Network<T: Decodable> {
         return RxAlamofire
             .request(.put, absolutePath, parameters: parameters)
             .debug()
-            .observeOn(scheduler)
+            .observe(on: scheduler)
             .data()
             .map({ data -> T in
                 return try JSONDecoder().decode(T.self, from: data)
@@ -73,7 +73,7 @@ final class Network<T: Decodable> {
         return RxAlamofire
             .request(.delete, absolutePath)
             .debug()
-            .observeOn(scheduler)
+            .observe(on: scheduler)
             .data()
             .map({ data -> T in
                 return try JSONDecoder().decode(T.self, from: data)
```

**File**: `RealmPlatform/Repository/Repository.swift` (modified, +2/-2)
```diff
@@ -57,13 +57,13 @@ final class Repository<T:RealmRepresentable>: AbstractRepository where T == T.Re
     func save(entity: T) -> Observable<Void> {
         return Observable.deferred {
             return self.realm.rx.save(entity: entity)
-        }.subscribeOn(scheduler)
+        }.subscribe(on: scheduler)
     }
 
     func delete(entity: T) -> Observable<Void> {
         return Observable.deferred {
             return self.realm.rx.delete(entity: entity)
-        }.subscribeOn(scheduler)
+        }.subscribe(on: scheduler)
     }
 
 }
```

**File**: `RealmPlatform/Utility/Extensions/Realm+Ext.swift` (modified, +3/-3)
```diff
@@ -16,13 +16,13 @@ extension RealmSwift.SortDescriptor {
         self.init(keyPath: sortDescriptor.key ?? "", ascending: sortDescriptor.ascending)
     }
 }
-
-extension Reactive where Base: Realm {
+extension Realm: ReactiveCompatible {}
+extension Reactive where Base == Realm {
     func save<R: RealmRepresentable>(entity: R, update: Bool = true) -> Observable<Void> where R.RealmType: Object  {
         return Observable.create { observer in
             do {
                 try self.base.write {
-                    self.base.add(entity.asRealm(), update: update)
+                    self.base.add(entity.asRealm(), update: update ? .all : .error)
                 }
                 observer.onNext(())
                 observer.onCompleted()
```

---

### Incident Patch 4: `3f600d2c` (2021-11-08)
**Commit Message**: fix error: ambiguous type

**File**: `RealmPlatform/Entities/RMUser.swift` (modified, +5/-3)
```diff
@@ -39,7 +39,8 @@ extension RMUser {
 }
 
 extension RMUser: DomainConvertibleType {
-    func asDomain() -> User {
+    typealias DomainType = Domain.User
+    func asDomain() -> Domain.User {
         return User(address: address!.asDomain(),
                     company: company!.asDomain(),
                     email: email,
@@ -51,8 +52,9 @@ extension RMUser: DomainConvertibleType {
     }
 }
 
-extension User: RealmRepresentable {
-    func asRealm() -> RMUser {
+extension Domain.User: RealmRepresentable {
+    typealias RealmType = RealmPlatform.RMUser
+    func asRealm() -> RealmPlatform.RMUser {
         return RMUser.build { object in
             object.uid = uid
             object.address = address.asRealm()
```

---

### Incident Patch 5: `ecc53d8e` (2021-11-05)
**Commit Message**: Merge pull request #84 from ShenYj/fix-naming-confilct

Naming conflict on iOS 15

**File**: `RealmPlatform/Utility/Extensions/Realm+Ext.swift` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ extension Object {
     }
 }
 
-extension SortDescriptor {
+extension RealmSwift.SortDescriptor {
     init(sortDescriptor: NSSortDescriptor) {
         self.init(keyPath: sortDescriptor.key ?? "", ascending: sortDescriptor.ascending)
     }
```

---

### Incident Patch 6: `c35aea59` (2020-05-01)
**Commit Message**: Spelling mistake fix

**File**: `README.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ You can do this by:
 - opening an issue to discuss the current solution, ask a question, propose your solution etc. (also English is not my native language so if you think that something can be corrected please open a PR 😊)
 - opening a PR if you want to fix bugs or improve something
 
-### Instalation
+### Installation
 
 Dependencies in this project are provided via Cocoapods. Please install all dependecies with
 
```

---

### Incident Patch 7: `bae0423a` (2019-03-21)
**Commit Message**: Fix no delete action

https://github.com/sergdort/CleanArchitectureRxSwift/issues/61

**File**: `CleanArchitectureRxSwift/Scenes/EditPost/EditPostViewController.swift` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ final class EditPostViewController: UIViewController {
                     preferredStyle: .alert
                 )
                 let yesAction = UIAlertAction(title: "Yes", style: .destructive, handler: { _ -> () in observer.onNext(()) })
-                let noAction = UIAlertAction(title: "No", style: .cancel, handler: { _ -> () in observer.onNext(()) })
+                let noAction = UIAlertAction(title: "No", style: .cancel, handler: nil)
                 alert.addAction(yesAction)
                 alert.addAction(noAction)
 
```

---

### Incident Patch 8: `c0666666` (2017-11-14)
**Commit Message**: Rename Network to NetworkPlatform fixing private framework collusion name

**File**: `CleanArchitectureRxSwift.xcodeproj/project.pbxproj` (modified, +179/-51)
```diff
@@ -78,13 +78,14 @@
 		515F9CD8F2B13D0328B77B6C /* Realm+Ext.swift in Sources */ = {isa = PBXBuildFile; fileRef = 515F977CB3763872350F7874 /* Realm+Ext.swift */; };
 		515F9DBB950E2ABDB8D7895B /* RMPost.swift in Sources */ = {isa = PBXBuildFile; fileRef = 515F988220373D06226F4EDE /* RMPost.swift */; };
 		515F9EA01C8D63D03B41FF8F /* PostsUseCase.swift in Sources */ = {isa = PBXBuildFile; fileRef = 515F9DAA48376FC95A9D91B5 /* PostsUseCase.swift */; };
+		59CE6AAC086B5C1AC880DB70 /* Pods_NetworkPlatformTests.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 2AF991A848BB04AAFE03A804 /* Pods_NetworkPlatformTests.framework */; };
 		7752FCB51F716D650079522C /* PostsViewModelTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7752FCB41F716D650079522C /* PostsViewModelTests.swift */; };
 		7752FCB71F716D7A0079522C /* AllPostsUseCaseMock.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7752FCB61F716D7A0079522C /* AllPostsUseCaseMock.swift */; };
 		7752FCB91F716D940079522C /* PostsNavigatorMock.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7752FCB81F716D940079522C /* PostsNavigatorMock.swift */; };
 		7BA4DC961F3AEA380043DAB6 /* PostItemViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7BA4DC951F3AEA380043DAB6 /* PostItemViewModel.swift */; };
 		7DFB155E3444551C4DB34AAC /* Pods_CleanArchitectureRxSwift.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 09A6B74019E724CAD9CA96DC /* Pods_CleanArchitectureRxSwift.framework */; };
+		8A148DC8CA606C8F34807082 /* Pods_NetworkPlatform.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 763D40E220B6FF96E969B284 /* Pods_NetworkPlatform.framework */; };
 		8B0507E0C0AB1064B7372844 /* Pods_RealmPlatform.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 006BDFA0A26FDD0EBA50E777 /* Pods_RealmPlatform.framework */; };
-		8E549C0D492F9142D1CF88F2 /* Pods_Network.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 8C5EFC85E3DC2D413D89C8F9 /* Pods_Network.framework */; };
 		9CBC9DB91790C744BC17C099 /* Pods_CleanArchitectureRxSwiftTests.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 550BE321D44EC009D885BBE1 /* Pods_CleanArchitectureRxSwiftTests.framework */; };
 		BC8D07731E9309D000B4D96A /* UidTransform.swift in Sources */ = {isa = PBXBuildFile; fileRef = BC8D07721E9309D000B4D96A /* UidTransform.swift */; };
 		BCD8C8AC1E73421300F79E3E /* Address+Mapping.swift in Sources */ = {isa = PBXBuildFile; fileRef = BCD8C8AB1E73421300F79E3E /* Address+Mapping.swift */; };
@@ -102,11 +103,11 @@
 		BCD8C8C41E73473300F79E3E /* RMPhoto.swift in Sources */ = {isa = PBXBuildFile; fileRef = BCD8C8C31E73473300F79E3E /* RMPhoto.swift */; };
 		BCD8C8C61E73474600F79E3E /* RMTodo.swift in Sources */ = {isa = PBXBuildFile; fileRef = BCD8C8C51E73474600F79E3E /* RMTodo.swift */; };
 		BCD8C8C81E73475000F79E3E /* RMUser.swift in Sources */ = {isa = PBXBuildFile; fileRef = BCD8C8C71E73475000F79E3E /* RMUser.swift */; };
-		BD107F521E7298690043D900 /* Network.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = BD107F491E7298690043D900 /* Network.framework */; };
+		BD107F521E7298690043D900 /* NetworkPlatform.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = BD107F491E7298690043D900 /* NetworkPlatform.framework */; };
 		BD107F591E72986A0043D900 /* NetworkTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = BD107F581E72986A0043D900 /* NetworkTests.swift */; };
 		BD107F5B1E72986A0043D900 /* Network.h in Headers */ = {isa = PBXBuildFile; fileRef = BD107F4B1E7298690043D900 /* Network.h */; settings = {ATTRIBUTES = (Public, ); }; };
-		BD107F5E1E72986A0043D900 /* Network.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = BD107F491E7298690043D900 /* Network.framework */; };
-		BD107F5F1E72986A0043D900 /* Network.framework in Embed Frameworks */ = {isa = PBXBuildFile; fileRef = BD107F491E7298690043D900 /* Network.framework */; settings = {ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }; };
+		BD107F5E1E72986A0043D900 /* NetworkPlatform.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = BD107F491E7298690043D900 /* NetworkPlatform.framework */; };
+		BD107F5F1E72986A0043D900 /* NetworkPlatform.framework in Embed Frameworks */ = {isa = PBXBuildFile; fileRef = BD107F491E7298690043D900 /* NetworkPlatform.framework */; settings = {ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }; };
 		BD107F661E72A0D20043D900 /* Domain.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 25897B281E58BF0D00D3563C /* Domain.framework */; };
 		BD107F691E72A0EF0043D900 /* PostsNetwork.swift in Sources */ = {isa = PBXBuildFile; fileRef = BD107F681E72A0EF0043D900 /* PostsNetwork.swift */; };
 		BD107F751E72B1E20043D900 /* Post+Mapping.swift in Sources */ = {isa = PBXBuildFile; fileRef = BD107F741E72B1E20043D900 /* Post+Mapping.swift */; };
@@ -258,7 +259,7 @@
 				25897B831E58BF4600D3563C /* RealmPlatform.framework in Embed Frameworks */,
 				25897B611E58BF3600D3563C /* CoreDataPlatform.f
```

**File**: `CleanArchitectureRxSwift/Application/Application.swift` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 import Foundation
 import Domain
-import Network
+import NetworkPlatform
 import CoreDataPlatform
 import RealmPlatform
 
@@ -9,12 +9,12 @@ final class Application {
 
     private let coreDataUseCaseProvider: Domain.UseCaseProvider
     private let realmUseCaseProvider: Domain.UseCaseProvider
-    private let networkUseCaseProvider: Network.UseCaseProvider
+    private let networkUseCaseProvider: NetworkPlatform.UseCaseProvider
 
     private init() {
         self.coreDataUseCaseProvider = CoreDataPlatform.UseCaseProvider()
         self.realmUseCaseProvider = RealmPlatform.UseCaseProvider()
-        self.networkUseCaseProvider = Network.UseCaseProvider()
+        self.networkUseCaseProvider = NetworkPlatform.UseCaseProvider()
     }
 
     func configureMainInterface(in window: UIWindow) {
```

**File**: `NetworkPlatformTests/NetworkTests.swift` (renamed, +1/-1)
```diff
@@ -7,7 +7,7 @@
 //
 
 import XCTest
-@testable import Network
+@testable import NetworkPlatform
 
 class NetworkTests: XCTestCase {
     
```

**File**: `Podfile` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@ target 'Domain' do
 
 end
 
-target 'Network' do
+target 'NetworkPlatform' do
     # Comment the next line if you're not using Swift and don't want to use dynamic frameworks
     use_frameworks!
     rx_swift
@@ -62,7 +62,7 @@ target 'Network' do
     pod 'ObjectMapper'
     pod 'AlamofireObjectMapper'
 
-    target 'NetworkTests' do
+    target 'NetworkPlatformTests' do
         inherit! :search_paths
         test_pods
     end
```

**File**: `Podfile.lock` (modified, +22/-22)
```diff
@@ -1,16 +1,16 @@
 PODS:
-  - Alamofire (4.5.0)
-  - AlamofireObjectMapper (4.1.0):
+  - Alamofire (4.5.1)
+  - AlamofireObjectMapper (5.0.0):
     - Alamofire (~> 4.1)
-    - ObjectMapper (~> 2.0)
-  - Nimble (7.0.1)
-  - ObjectMapper (2.2.8)
+    - ObjectMapper (~> 3.0)
+  - Nimble (7.0.2)
+  - ObjectMapper (3.1.0)
   - QueryKit (0.13.0)
-  - Realm (2.8.3):
-    - Realm/Headers (= 2.8.3)
-  - Realm/Headers (2.8.3)
-  - RealmSwift (2.8.3):
-    - Realm (= 2.8.3)
+  - Realm (2.10.2):
+    - Realm/Headers (= 2.10.2)
+  - Realm/Headers (2.10.2)
+  - RealmSwift (2.10.2):
+    - Realm (= 2.10.2)
   - RxAlamofire (3.0.3):
     - RxAlamofire/Core (= 3.0.3)
   - RxAlamofire/Core (3.0.3):
@@ -20,9 +20,9 @@ PODS:
     - RxSwift (~> 3.6)
   - RxCocoa (3.6.1):
     - RxSwift (~> 3.6)
-  - RxRealm (0.6.0):
-    - RealmSwift (~> 2.5)
-    - RxSwift (~> 3.2)
+  - RxRealm (0.7.2):
+    - RealmSwift (~> 2)
+    - RxSwift (~> 3)
   - RxSwift (3.6.1)
   - RxTest (3.6.1):
     - RxSwift (~> 3.6)
@@ -43,20 +43,20 @@ DEPENDENCIES:
   - RxTest (~> 3.0)
 
 SPEC CHECKSUMS:
-  Alamofire: f28cdffd29de33a7bfa022cbd63ae95a27fae140
-  AlamofireObjectMapper: 435adc82f5b367679bd9e71c4974a54efd0b2521
-  Nimble: 657d000e11df8aebe27cdaf9d244de7f30ed87f7
-  ObjectMapper: 3d571bb5af471c779e1160828cd9ad5c4ef90958
+  Alamofire: 2d95912bf4c34f164fdfc335872e8c312acaea4a
+  AlamofireObjectMapper: 5fafc816351cbbc0d486611aaeba7461c0cbad49
+  Nimble: bfe1f814edabba69ff145cb1283e04ed636a67f2
+  ObjectMapper: 20505058f54e5c3ca69e1d6de9897d152a5369a6
   QueryKit: 406c42b9b4eb5f8dab380a9e5bd9ef656542d1f4
-  Realm: 3601ef091c8c499a31101d8563b991e75546cdce
-  RealmSwift: 8183818515471b01a99abdd2970f8e4fd52b6f4a
+  Realm: 0ef72b837fb67e9f4b098bac771ddd72c7fdbb69
+  RealmSwift: 07a9ae0505091eda6b2ee7c190c3786d6e90a7b0
   RxAlamofire: 5eb39188c4917ad98127c0ecb4878a61b7517003
   RxBlocking: 4f4bd5732e8b952e54ae8a57739bcfb645de12bc
   RxCocoa: 84a08739ab186248c7f31ce4ee92d6f8a947d690
-  RxRealm: 323de579b50b5e0f4a3e087d5925021f976ffaf1
+  RxRealm: 9cf5c15c5312fc770aaa542a360cffec4916e63a
   RxSwift: f9de85ea20cd2f7716ee5409fc13523dc638e4e4
   RxTest: 1d00348a7848c91ab5bf5d197d2378aa6b2bb356
 
-PODFILE CHECKSUM: '048e4f9ed7e8f8ff423ddfbcf8b3349cc175b774'
+PODFILE CHECKSUM: ad7fe454efdb3b742a7918ebc09510be79b19131
 
-COCOAPODS: 1.2.0
+COCOAPODS: 1.3.1
```

**File**: `Pods/Alamofire/LICENSE` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-Copyright (c) 2014-2016 Alamofire Software Foundation (http://alamofire.org/)
+Copyright (c) 2014-2017 Alamofire Software Foundation (http://alamofire.org/)
 
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
```

**File**: `Pods/Alamofire/README.md` (modified, +15/-10)
```diff
@@ -1,9 +1,9 @@
-![Alamofire: Elegant Networking in Swift](https://raw.githubusercontent.com/Alamofire/Alamofire/assets/alamofire.png)
+![Alamofire: Elegant Networking in Swift](https://raw.githubusercontent.com/Alamofire/Alamofire/master/alamofire.png)
 
 [![Build Status](https://travis-ci.org/Alamofire/Alamofire.svg?branch=master)](https://travis-ci.org/Alamofire/Alamofire)
 [![CocoaPods Compatible](https://img.shields.io/cocoapods/v/Alamofire.svg)](https://img.shields.io/cocoapods/v/Alamofire.svg)
 [![Carthage Compatible](https://img.shields.io/badge/Carthage-compatible-4BC51D.svg?style=flat)](https://github.com/Carthage/Carthage)
-[![Platform](https://img.shields.io/cocoapods/p/Alamofire.svg?style=flat)](http://cocoadocs.org/docsets/Alamofire)
+[![Platform](https://img.shields.io/cocoapods/p/Alamofire.svg?style=flat)](https://alamofire.github.io/Alamofire)
 [![Twitter](https://img.shields.io/badge/twitter-@AlamofireSF-blue.svg?style=flat)](http://twitter.com/AlamofireSF)
 [![Gitter](https://badges.gitter.im/Alamofire/Alamofire.svg)](https://gitter.im/Alamofire/Alamofire?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)
 
@@ -45,7 +45,7 @@ Alamofire is an HTTP networking library written in Swift.
 - [x] TLS Certificate and Public Key Pinning
 - [x] Network Reachability
 - [x] Comprehensive Unit and Integration Test Coverage
-- [x] [Complete Documentation](http://cocoadocs.org/docsets/Alamofire)
+- [x] [Complete Documentation](https://alamofire.github.io/Alamofire)
 
 ## Component Libraries
 
@@ -57,8 +57,8 @@ In order to keep Alamofire focused specifically on core networking implementatio
 ## Requirements
 
 - iOS 8.0+ / macOS 10.10+ / tvOS 9.0+ / watchOS 2.0+
-- Xcode 8.1, 8.2, 8.3, and 9.0
-- Swift 3.0, 3.1, 3.2, and 4.0
+- Xcode 8.3+
+- Swift 3.1+
 
 ## Migration Guides
 
@@ -84,7 +84,7 @@ In order to keep Alamofire focused specifically on core networking implementatio
 $ gem install cocoapods
 ```
 
-> CocoaPods 1.1.0+ is required to build Alamofire 4.0.0+.
+> CocoaPods 1.1+ is required to build Alamofire 4.0+.
 
 To integrate Alamofire into your Xcode project using CocoaPods, specify it in your `Podfile`:
 
@@ -94,7 +94,7 @@ platform :ios, '10.0'
 use_frameworks!
 
 target '<Your Target Name>' do
-    pod 'Alamofire', '~> 4.4'
+    pod 'Alamofire', '~> 4.5'
 end
 ```
 
@@ -118,7 +118,7 @@ $ brew install carthage
 To integrate Alamofire into your Xcode project using Carthage, specify it in your `Cartfile`:
 
 ```ogdl
-github "Alamofire/Alamofire" ~> 4.4
+github "Alamofire/Alamofire" ~> 4.5
 ```
 
 Run `carthage update` to build the framework and drag the built `Alamofire.framework` into your Xcode project.
@@ -736,7 +736,7 @@ When sending relatively small amounts of data to a server using JSON or URL enco
 #### Uploading Data
 
 ```swift
-let imageData = UIPNGRepresentation(image)!
+let imageData = UIImagePNGRepresentation(image)!
 
 Alamofire.upload(imageData, to: "https://httpbin.org/post").responseJSON { response in
     debugPrint(response)
@@ -1812,10 +1812,15 @@ There are some important things to remember when using network reachability to d
 The following radars have some effect on the current implementation of Alamofire.
 
 - [`rdar://21349340`](http://www.openradar.me/radar?id=5517037090635776) - Compiler throwing warning due to toll-free bridging issue in test case
-- [`rdar://26761490`](http://www.openradar.me/radar?id=5010235949318144) - Swift string interpolation causing memory leak with common usage
 - `rdar://26870455` - Background URL Session Configurations do not work in the simulator
 - `rdar://26849668` - Some URLProtocol APIs do not properly handle `URLRequest`
 
+## Resolved Radars
+
+The following radars have been resolved over time after being filed against the Alamofire project.
+
+- [`rdar://26761490`](http://www.openradar.me/radar?id=5010235949318144) - Swift string interpolation causing memory leak with common usage (Resolved on 9/1/17 in Xcode 9 beta 6).
+
 ## FAQ
 
 ### What's the origin of the name Alamofire?
```

**File**: `Pods/Alamofire/Source/AFError.swift` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 //
 //  AFError.swift
 //
-//  Copyright (c) 2014-2016 Alamofire Software Foundation (http://alamofire.org/)
+//  Copyright (c) 2014-2017 Alamofire Software Foundation (http://alamofire.org/)
 //
 //  Permission is hereby granted, free of charge, to any person obtaining a copy
 //  of this software and associated documentation files (the "Software"), to deal
```

---

### Incident Patch 9: `4365ee73` (2017-10-14)
**Commit Message**: Fix `cacheScheduler` spelling error

**File**: `Network/Cache/Cache.swift` (modified, +5/-5)
```diff
@@ -39,7 +39,7 @@ final class Cache<T: Encodable>: AbstractCache<T> where T == T.Encoder.DomainTyp
     }
 
     private let path: String
-    private let chacheScheduler = SerialDispatchQueueScheduler(internalSerialQueueName: "com.CleanAchitecture.Network.Cache.queue")
+    private let cacheScheduler = SerialDispatchQueueScheduler(internalSerialQueueName: "com.CleanAchitecture.Network.Cache.queue")
 
     init(path: String) {
         self.path = path
@@ -64,7 +64,7 @@ final class Cache<T: Encodable>: AbstractCache<T> where T == T.Encoder.DomainTyp
             }
             
             return Disposables.create()
-        }.subscribeOn(chacheScheduler)
+        }.subscribeOn(cacheScheduler)
     }
 
     override func save(objects: [T]) -> Completable {
@@ -85,7 +85,7 @@ final class Cache<T: Encodable>: AbstractCache<T> where T == T.Encoder.DomainTyp
             }
             
             return Disposables.create()
-        }.subscribeOn(chacheScheduler)
+        }.subscribeOn(cacheScheduler)
     }
 
     override func fetch(withID id: String) -> Maybe<T> {
@@ -106,7 +106,7 @@ final class Cache<T: Encodable>: AbstractCache<T> where T == T.Encoder.DomainTyp
             }
             observer(MaybeEvent<T>.success(object.asDomain()))
             return Disposables.create()
-        }.subscribeOn(chacheScheduler)
+        }.subscribeOn(cacheScheduler)
     }
 
     override func fetchObjects() -> Maybe<[T]> {
@@ -123,7 +123,7 @@ final class Cache<T: Encodable>: AbstractCache<T> where T == T.Encoder.DomainTyp
             }
             observer(MaybeEvent.success(objects.map { $0.asDomain() }))
                 return Disposables.create()
-        }.subscribeOn(chacheScheduler)
+        }.subscribeOn(cacheScheduler)
     }
     
     private func directoryURL() -> URL? {
```

---

### Incident Patch 10: `5f0ba907` (2017-08-09)
**Commit Message**: Use PostItemViewModel instead of direct Post binding to the UITableViewCell

**File**: `CleanArchitectureRxSwift.xcodeproj/project.pbxproj` (modified, +14/-10)
```diff
@@ -83,6 +83,7 @@
 		515F9CD8F2B13D0328B77B6C /* Realm+Ext.swift in Sources */ = {isa = PBXBuildFile; fileRef = 515F977CB3763872350F7874 /* Realm+Ext.swift */; };
 		515F9DBB950E2ABDB8D7895B /* RMPost.swift in Sources */ = {isa = PBXBuildFile; fileRef = 515F988220373D06226F4EDE /* RMPost.swift */; };
 		515F9EA01C8D63D03B41FF8F /* AllPostsUseCase.swift in Sources */ = {isa = PBXBuildFile; fileRef = 515F9DAA48376FC95A9D91B5 /* AllPostsUseCase.swift */; };
+		7BA4DC961F3AEA380043DAB6 /* PostItemViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7BA4DC951F3AEA380043DAB6 /* PostItemViewModel.swift */; };
 		7DFB155E3444551C4DB34AAC /* Pods_CleanArchitectureRxSwift.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 09A6B74019E724CAD9CA96DC /* Pods_CleanArchitectureRxSwift.framework */; };
 		8B0507E0C0AB1064B7372844 /* Pods_RealmPlatform.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 006BDFA0A26FDD0EBA50E777 /* Pods_RealmPlatform.framework */; };
 		8E549C0D492F9142D1CF88F2 /* Pods_Network.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 8C5EFC85E3DC2D413D89C8F9 /* Pods_Network.framework */; };
@@ -361,6 +362,7 @@
 		6FC0A7F85D212DE861F0D4F5 /* Pods-Network.release.xcconfig */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-Network.release.xcconfig"; path = "Pods/Target Support Files/Pods-Network/Pods-Network.release.xcconfig"; sourceTree = "<group>"; };
 		71C4CC5892A6E3601D801729 /* Pods-CoreDataPlatform.release.xcconfig */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-CoreDataPlatform.release.xcconfig"; path = "Pods/Target Support Files/Pods-CoreDataPlatform/Pods-CoreDataPlatform.release.xcconfig"; sourceTree = "<group>"; };
 		771F87FDB28A5E6EC32A9841 /* Pods_Domain.framework */ = {isa = PBXFileReference; explicitFileType = wrapper.framework; includeInIndex = 0; path = Pods_Domain.framework; sourceTree = BUILT_PRODUCTS_DIR; };
+		7BA4DC951F3AEA380043DAB6 /* PostItemViewModel.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = PostItemViewModel.swift; sourceTree = "<group>"; };
 		84A5797E91E6FA5FA24A4896 /* Pods-CleanArchitectureRxSwift.debug.xcconfig */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-CleanArchitectureRxSwift.debug.xcconfig"; path = "Pods/Target Support Files/Pods-CleanArchitectureRxSwift/Pods-CleanArchitectureRxSwift.debug.xcconfig"; sourceTree = "<group>"; };
 		8C5EFC85E3DC2D413D89C8F9 /* Pods_Network.framework */ = {isa = PBXFileReference; explicitFileType = wrapper.framework; includeInIndex = 0; path = Pods_Network.framework; sourceTree = BUILT_PRODUCTS_DIR; };
 		92BD9FF4B0878F787003D01E /* Pods-NetworkTests.release.xcconfig */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.xcconfig; name = "Pods-NetworkTests.release.xcconfig"; path = "Pods/Target Support Files/Pods-NetworkTests/Pods-NetworkTests.release.xcconfig"; sourceTree = "<group>"; };
@@ -904,6 +906,7 @@
 				515F94C9D806D051CFBCC327 /* PostsNavigator.swift */,
 				515F92B305125A2C9E279E71 /* PostsViewController.swift */,
 				515F93CEB3B316E01CDACEA7 /* PostsViewModel.swift */,
+				7BA4DC951F3AEA380043DAB6 /* PostItemViewModel.swift */,
 			);
 			path = AllPosts;
 			sourceTree = "<group>";
@@ -1514,7 +1517,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "diff \"${PODS_PODFILE_DIR_PATH}/Podfile.lock\" \"${PODS_ROOT}/Manifest.lock\" > /dev/null\nif [ $? != 0 ] ; then\n    # print error to STDERR\n    echo \"error: The sandbox is not in sync with the Podfile.lock. Run 'pod install' or update your CocoaPods installation.\" >&2\n    exit 1\nfi\n";
+			shellScript = "diff \"${PODS_ROOT}/../Podfile.lock\" \"${PODS_ROOT}/Manifest.lock\" > /dev/null\nif [ $? != 0 ] ; then\n    # print error to STDERR\n    echo \"error: The sandbox is not in sync with the Podfile.lock. Run 'pod install' or update your CocoaPods installation.\" >&2\n    exit 1\nfi\n";
 			showEnvVarsInLog = 0;
 		};
 		17B07EE7C6E1F9585169BCEF /* [CP] Embed Pods Frameworks */ = {
@@ -1544,7 +1547,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "diff \"${PODS_PODFILE_DIR_PATH}/Podfile.lock\" \"${PODS_ROOT}/Manifest.lock\" > /dev/null\nif [ $? != 0 ] ; then\n    # print error to STDERR\n    echo \"error: The sandbox is not in sync with the Podfile.lock. Run 'pod install' or update your CocoaPods installation.\" >&2\n    exit 1\nfi\n";
+			shellScript = "diff \"${PODS_ROOT}/../Podfile.lock\" \"${PODS_ROOT}/Manifest.lock\" > /dev/null\nif [ $? != 0 ] ; then\n    # print error to STDERR\n    echo \"error: The sandbox is not in sync with the Podfile.lock. Run 'pod install' or update your CocoaPods installation.\" >&2\n    exit 1\nfi\n";
 			showEnvVarsInLog = 0;
 		};
 		203BDCA1039B7C197B857E89 /* [CP] Embed Pods Fram
```

**File**: `CleanArchitectureRxSwift/Scenes/AllPosts/PostItemViewModel.swift` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+//
+//  PostItemViewModel.swift
+//  CleanArchitectureRxSwift
+//
+//  Created by Stefano Mondino on 09/08/17.
+//  Copyright © 2017 sergdort. All rights reserved.
+//
+
+import Foundation
+import Domain
+
+final class PostItemViewModel   {
+    var title:String
+    var subtitle : String
+    var post: Post
+    init (with post:Post) {
+        self.post = post
+        self.title = post.title.uppercased()
+        self.subtitle = post.body
+    }
+}
```

**File**: `CleanArchitectureRxSwift/Scenes/AllPosts/PostTableViewCell.swift` (modified, +6/-0)
```diff
@@ -3,4 +3,10 @@ import UIKit
 final class PostTableViewCell: UITableViewCell {
     @IBOutlet weak var titleLabel: UILabel!
     @IBOutlet weak var detailsLabel: UILabel!
+    
+    func bind(to viewModel:PostItemViewModel) {
+        self.titleLabel.text = viewModel.title
+        self.detailsLabel.text = viewModel.subtitle
+    }
+    
 }
```

**File**: `CleanArchitectureRxSwift/Scenes/AllPosts/PostsViewController.swift` (modified, +3/-3)
```diff
@@ -36,9 +36,9 @@ class PostsViewController: UIViewController {
                                        selection: tableView.rx.itemSelected.asDriver())
         let output = viewModel.transform(input: input)
         //Bind Posts to UITableView
-        output.posts.drive(tableView.rx.items(cellIdentifier: PostTableViewCell.reuseID, cellType: PostTableViewCell.self)) { tv, item, cell in
-            cell.titleLabel.text = item.title
-            cell.detailsLabel.text = item.body
+        output.posts.drive(tableView.rx.items(cellIdentifier: PostTableViewCell.reuseID, cellType: PostTableViewCell.self)) { tv, viewModel, cell in
+            cell.bind(to: viewModel)
+
         }.addDisposableTo(disposeBag)
         //Connect Create Post to UI
         
```

**File**: `CleanArchitectureRxSwift/Scenes/AllPosts/PostsViewModel.swift` (modified, +3/-2)
```diff
@@ -12,7 +12,7 @@ final class PostsViewModel: ViewModelType {
     }
     struct Output {
         let fetching: Driver<Bool>
-        let posts: Driver<[Post]>
+        let posts: Driver<[PostItemViewModel]>
         let createPost: Driver<Void>
         let selectedPost: Driver<Post>
         let error: Driver<Error>
@@ -34,13 +34,14 @@ final class PostsViewModel: ViewModelType {
                 .trackActivity(activityIndicator)
                 .trackError(errorTracker)
                 .asDriverOnErrorJustComplete()
+                .map { $0.map { PostItemViewModel(with: $0) } }
         }
         
         let fetching = activityIndicator.asDriver()
         let errors = errorTracker.asDriver()
         let selectedPost = input.selection
             .withLatestFrom(posts) { (indexPath, posts) -> Post in
-                return posts[indexPath.row]
+                return posts[indexPath.row].post
             }
             .do(onNext: navigator.toPost)
         let createPost = input.createPostTrigger
```

**File**: `Podfile.lock` (modified, +2/-2)
```diff
@@ -57,6 +57,6 @@ SPEC CHECKSUMS:
   RxSwift: f9de85ea20cd2f7716ee5409fc13523dc638e4e4
   RxTest: 1d00348a7848c91ab5bf5d197d2378aa6b2bb356
 
-PODFILE CHECKSUM: 048e4f9ed7e8f8ff423ddfbcf8b3349cc175b774
+PODFILE CHECKSUM: '048e4f9ed7e8f8ff423ddfbcf8b3349cc175b774'
 
-COCOAPODS: 1.2.1
+COCOAPODS: 1.2.0
```

**File**: `Pods/Manifest.lock` (modified, +2/-2)
```diff
@@ -57,6 +57,6 @@ SPEC CHECKSUMS:
   RxSwift: f9de85ea20cd2f7716ee5409fc13523dc638e4e4
   RxTest: 1d00348a7848c91ab5bf5d197d2378aa6b2bb356
 
-PODFILE CHECKSUM: 048e4f9ed7e8f8ff423ddfbcf8b3349cc175b774
+PODFILE CHECKSUM: '048e4f9ed7e8f8ff423ddfbcf8b3349cc175b774'
 
-COCOAPODS: 1.2.1
+COCOAPODS: 1.2.0
```

**File**: `Pods/Target Support Files/Pods-CleanArchitectureRxSwift/Pods-CleanArchitectureRxSwift-resources.sh` (modified, +0/-3)
```diff
@@ -21,9 +21,6 @@ case "${TARGETED_DEVICE_FAMILY}" in
   3)
     TARGET_DEVICE_ARGS="--target-device tv"
     ;;
-  4)
-    TARGET_DEVICE_ARGS="--target-device watch"
-    ;;
   *)
     TARGET_DEVICE_ARGS="--target-device mac"
     ;;
```

---

### Incident Patch 11: `c07015eb` (2017-07-22)
**Commit Message**: Remove trace resources

**File**: `CleanArchitectureRxSwift.xcodeproj/project.pbxproj` (modified, +9/-1)
```diff
@@ -548,6 +548,13 @@
 			name = Frameworks;
 			sourceTree = "<group>";
 		};
+		25707C6E1F23745700F852F7 /* Persistence */ = {
+			isa = PBXGroup;
+			children = (
+			);
+			path = Persistence;
+			sourceTree = "<group>";
+		};
 		25897AF71E58BD9100D3563C = {
 			isa = PBXGroup;
 			children = (
@@ -976,13 +983,14 @@
 		BD107F4A1E7298690043D900 /* Network */ = {
 			isa = PBXGroup;
 			children = (
+				25707C6E1F23745700F852F7 /* Persistence */,
 				BD107F671E72A0DC0043D900 /* API */,
 				BD107F731E72B1790043D900 /* Entries */,
 				BD50EEF31E7AD99400CBEBD4 /* Network */,
 				BC8D07711E9309B200B4D96A /* Utils */,
+				515F94BB8B79F597BACF0614 /* UseCases */,
 				BD107F4C1E7298690043D900 /* Info.plist */,
 				BD107F4B1E7298690043D900 /* Network.h */,
-				515F94BB8B79F597BACF0614 /* UseCases */,
 			);
 			path = Network;
 			sourceTree = "<group>";
```

**File**: `Podfile` (modified, +0/-10)
```diff
@@ -84,13 +84,3 @@ target 'RealmPlatform' do
   end
 
 end
-
-post_install do |installer|
-    installer.pods_project.targets.each do |target|
-            target.build_configurations.each do |config|
-                if config.name == 'Debug'
-                    config.build_settings['OTHER_SWIFT_FLAGS'] ||= ['-D', 'TRACE_RESOURCES']
-                end
-        end
-    end
-end
```

**File**: `Podfile.lock` (modified, +1/-1)
```diff
@@ -57,6 +57,6 @@ SPEC CHECKSUMS:
   RxSwift: f9de85ea20cd2f7716ee5409fc13523dc638e4e4
   RxTest: 1d00348a7848c91ab5bf5d197d2378aa6b2bb356
 
-PODFILE CHECKSUM: fa9f0770597d1a764b8214e2441c9b92040e2c10
+PODFILE CHECKSUM: 048e4f9ed7e8f8ff423ddfbcf8b3349cc175b774
 
 COCOAPODS: 1.2.1
```

**File**: `Podfile.save` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+# Uncomment the next line to define a global platform for your project
+# platform :ios, '9.0'
+
+def rx_swift
+    pod 'RxSwift', '~> 3.0'
+end
+
+def rx_cocoa
+    pod 'RxCocoa', '~> 3.0'
+end
+
+def test_pods
+    pod 'RxTest', '~> 3.0'
+    pod 'RxBlocking', '~> 3.0'
+    pod 'Nimble'
+end
+
+
+target 'CleanArchitectureRxSwift' do
+  # Comment the next line if you're not using Swift and don't want to use dynamic frameworks
+  use_frameworks!
+  rx_cocoa
+  rx_swift
+  pod 'QueryKit'
+  target 'CleanArchitectureRxSwiftTests' do
+    inherit! :search_paths
+    test_pods
+  end
+
+end
+
+target 'CoreDataPlatform' do
+  # Comment the next line if you're not using Swift and don't want to use dynamic frameworks
+  use_frameworks!
+  rx_swift
+  pod 'QueryKit'
+  target 'CoreDataPlatformTests' do
+    inherit! :search_paths
+    test_pods
+  end
+
+end
+
+target 'Domain' do
+  # Comment the next line if you're not using Swift and don't want to use dynamic frameworks
+  use_frameworks!
+  rx_swift
+
+  target 'DomainTests' do
+    inherit! :search_paths
+    test_pods
+  end
+
+end
+
+target 'Network' do
+    # Comment the next line if you're not using Swift and don't want to use dynamic frameworks
+    use_frameworks!
+    rx_swift
+    pod 'Alamofire'
+    pod 'RxAlamofire'
+    pod 'ObjectMapper'
+    pod 'AlamofireObjectMapper'
+
+    target 'NetworkTests' do
+        inherit! :search_paths
+        test_pods
+    end
+    
+end
+
+target 'RealmPlatform' do
+  # Comment the next line if you're not using Swift and don't want to use dynamic frameworks
+  use_frameworks!
+  rx_swift
+  pod 'RxRealm'
+  pod 'QueryKit'
+  pod 'RealmSwift'
+  pod 'Realm'
+
+  target 'RealmPlatformTests' do
+    inherit! :search_paths
+    test_pods
+  end
+
+end
+ost_install do |installer|
+    installer.pods_project.targets.each do |target|
+            target.build_configurations.each do |config|
+                if config.name == 'Debug' || target.name == 'RxSwift'
+                    config.build_settings['OTHER_SWIFT_FLAGS'] ||= ['-D', 'TRACE_RESOURCES']
+                end
+        end
+    end
+end
```

**File**: `Pods/Manifest.lock` (modified, +1/-1)
```diff
@@ -57,6 +57,6 @@ SPEC CHECKSUMS:
   RxSwift: f9de85ea20cd2f7716ee5409fc13523dc638e4e4
   RxTest: 1d00348a7848c91ab5bf5d197d2378aa6b2bb356
 
-PODFILE CHECKSUM: fa9f0770597d1a764b8214e2441c9b92040e2c10
+PODFILE CHECKSUM: 048e4f9ed7e8f8ff423ddfbcf8b3349cc175b774
 
 COCOAPODS: 1.2.1
```

**File**: `Pods/Pods.xcodeproj/project.pbxproj` (modified, +428/-451)
```diff
@@ -5295,6 +5295,45 @@
 			};
 			name = Release;
 		};
+		163D2C0AA233713A45E65BF9488C4F2A /* Debug */ = {
+			isa = XCBuildConfiguration;
+			baseConfigurationReference = 354F73962E920D1FFFC01DEF466ED849 /* Pods-RealmPlatformTests.debug.xcconfig */;
+			buildSettings = {
+				CODE_SIGN_IDENTITY = "";
+				"CODE_SIGN_IDENTITY[sdk=appletvos*]" = "";
+				"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "";
+				"CODE_SIGN_IDENTITY[sdk=watchos*]" = "";
+				CURRENT_PROJECT_VERSION = 1;
+				DEBUG_INFORMATION_FORMAT = dwarf;
+				DEFINES_MODULE = YES;
+				DYLIB_COMPATIBILITY_VERSION = 1;
+				DYLIB_CURRENT_VERSION = 1;
+				DYLIB_INSTALL_NAME_BASE = "@rpath";
+				ENABLE_STRICT_OBJC_MSGSEND = YES;
+				GCC_NO_COMMON_BLOCKS = YES;
+				INFOPLIST_FILE = "Target Support Files/Pods-RealmPlatformTests/Info.plist";
+				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
+				IPHONEOS_DEPLOYMENT_TARGET = 10.2;
+				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
+				MACH_O_TYPE = staticlib;
+				MODULEMAP_FILE = "Target Support Files/Pods-RealmPlatformTests/Pods-RealmPlatformTests.modulemap";
+				MTL_ENABLE_DEBUG_INFO = YES;
+				OTHER_LDFLAGS = "";
+				OTHER_LIBTOOLFLAGS = "";
+				PODS_ROOT = "$(SRCROOT)";
+				PRODUCT_BUNDLE_IDENTIFIER = "org.cocoapods.${PRODUCT_NAME:rfc1034identifier}";
+				PRODUCT_NAME = Pods_RealmPlatformTests;
+				SDKROOT = iphoneos;
+				SKIP_INSTALL = YES;
+				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
+				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
+				SWIFT_VERSION = 3.0;
+				TARGETED_DEVICE_FAMILY = "1,2";
+				VERSIONING_SYSTEM = "apple-generic";
+				VERSION_INFO_PREFIX = "";
+			};
+			name = Debug;
+		};
 		166E2CAC58E8608AD59A6F0B71C9C3E0 /* Debug */ = {
 			isa = XCBuildConfiguration;
 			buildSettings = {
@@ -5343,9 +5382,9 @@
 			};
 			name = Debug;
 		};
-		286DADB63A9FA83ECB40616BEC95A938 /* Debug */ = {
+		1CD0E7E92B68EDB296AE8E42F4AE4399 /* Debug */ = {
 			isa = XCBuildConfiguration;
-			baseConfigurationReference = 25EE4EBEA13E2F61540F74A2E29F8700 /* Realm.xcconfig */;
+			baseConfigurationReference = 6C890E098E1F9E80B5238E8FEB547700 /* RxRealm.xcconfig */;
 			buildSettings = {
 				CODE_SIGN_IDENTITY = "";
 				"CODE_SIGN_IDENTITY[sdk=appletvos*]" = "";
@@ -5359,17 +5398,57 @@
 				DYLIB_INSTALL_NAME_BASE = "@rpath";
 				ENABLE_STRICT_OBJC_MSGSEND = YES;
 				GCC_NO_COMMON_BLOCKS = YES;
-				GCC_PREFIX_HEADER = "Target Support Files/Realm/Realm-prefix.pch";
-				INFOPLIST_FILE = "Target Support Files/Realm/Info.plist";
+				GCC_PREFIX_HEADER = "Target Support Files/RxRealm/RxRealm-prefix.pch";
+				INFOPLIST_FILE = "Target Support Files/RxRealm/Info.plist";
 				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
 				IPHONEOS_DEPLOYMENT_TARGET = 8.0;
 				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
-				MODULEMAP_FILE = "Target Support Files/Realm/Realm.modulemap";
+				MODULEMAP_FILE = "Target Support Files/RxRealm/RxRealm.modulemap";
 				MTL_ENABLE_DEBUG_INFO = YES;
-				OTHER_SWIFT_FLAGS = "-D TRACE_RESOURCES";
-				PRODUCT_NAME = Realm;
+				PRODUCT_NAME = RxRealm;
+				SDKROOT = iphoneos;
+				SKIP_INSTALL = YES;
+				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
+				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
+				SWIFT_VERSION = 3.0;
+				TARGETED_DEVICE_FAMILY = "1,2";
+				VERSIONING_SYSTEM = "apple-generic";
+				VERSION_INFO_PREFIX = "";
+			};
+			name = Debug;
+		};
+		223E3C0488C378AD8CB09EEA56223B37 /* Debug */ = {
+			isa = XCBuildConfiguration;
+			baseConfigurationReference = 401681AC4E74CAAED853FA3CB6F50486 /* Pods-Domain.debug.xcconfig */;
+			buildSettings = {
+				CODE_SIGN_IDENTITY = "";
+				"CODE_SIGN_IDENTITY[sdk=appletvos*]" = "";
+				"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "";
+				"CODE_SIGN_IDENTITY[sdk=watchos*]" = "";
+				CURRENT_PROJECT_VERSION = 1;
+				DEBUG_INFORMATION_FORMAT = dwarf;
+				DEFINES_MODULE = YES;
+				DYLIB_COMPATIBILITY_VERSION = 1;
+				DYLIB_CURRENT_VERSION = 1;
+				DYLIB_INSTALL_NAME_BASE = "@rpath";
+				ENABLE_STRICT_OBJC_MSGSEND = YES;
+				GCC_NO_COMMON_BLOCKS = YES;
+				INFOPLIST_FILE = "Target Support Files/Pods-Domain/Info.plist";
+				INSTALL_PATH = "$(LOCAL_LIBRARY_DIR)/Frameworks";
+				IPHONEOS_DEPLOYMENT_TARGET = 10.2;
+				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";
+				MACH_O_TYPE = staticlib;
+				MODULEMAP_FILE = "Target Support Files/Pods-Domain/Pods-Domain.modulemap";
+				MTL_ENABLE_DEBUG_INFO = YES;
+				OTHER_LDFLAGS = "";
+				OTHER_LIBTOOLFLAGS = "";
+				PODS_ROOT = "$(SRCROOT)";
+				PRODUCT_BUNDLE_IDENTIFIER = "org.cocoapods.${PRODUCT_NAME:rfc1034identifier}";
+				PRODUCT_NAME = Pods_Domain;
 				SDKROOT = iphoneos;
 				SKIP_INSTALL = YES;
+				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
+				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
 				SWIFT_VERSION = 3.0;
 				TARGETED_DEVICE_FAMILY = "1,2";
 				VERSIONING_SYSTEM = "apple-generic";
@@ -5415,9 +5494,9 @@
 
```

**File**: `Pods/Pods.xcodeproj/project.xcworkspace/contents.xcworkspacedata` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-<?xml version="1.0" encoding="UTF-8"?>
-<Workspace
-   version = "1.0">
-</Workspace>
```

**File**: `Pods/Pods.xcodeproj/xcuserdata/andrey.yastrebov.xcuserdatad/xcschemes/Alamofire.xcscheme` (removed, +0/-60)
```diff
@@ -1,60 +0,0 @@
-<?xml version="1.0" encoding="UTF-8"?>
-<Scheme
-   LastUpgradeVersion = "0700"
-   version = "1.3">
-   <BuildAction
-      parallelizeBuildables = "YES"
-      buildImplicitDependencies = "YES">
-      <BuildActionEntries>
-         <BuildActionEntry
-            buildForAnalyzing = "YES"
-            buildForTesting = "YES"
-            buildForRunning = "YES"
-            buildForProfiling = "YES"
-            buildForArchiving = "YES">
-            <BuildableReference
-               BuildableIdentifier = 'primary'
-               BlueprintIdentifier = '88E9EC28B8B46C3631E6B242B50F4442'
-               BlueprintName = 'Alamofire'
-               ReferencedContainer = 'container:Pods.xcodeproj'
-               BuildableName = 'Alamofire.framework'>
-            </BuildableReference>
-         </BuildActionEntry>
-      </BuildActionEntries>
-   </BuildAction>
-   <TestAction
-      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
-      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
-      shouldUseLaunchSchemeArgsEnv = "YES"
-      buildConfiguration = "Debug">
-      <AdditionalOptions>
-      </AdditionalOptions>
-   </TestAction>
-   <LaunchAction
-      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
-      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
-      launchStyle = "0"
-      useCustomWorkingDirectory = "NO"
-      ignoresPersistentStateOnLaunch = "NO"
-      debugDocumentVersioning = "YES"
-      debugServiceExtension = "internal"
-      buildConfiguration = "Debug"
-      allowLocationSimulation = "YES">
-      <AdditionalOptions>
-      </AdditionalOptions>
-   </LaunchAction>
-   <ProfileAction
-      savedToolIdentifier = ""
-      useCustomWorkingDirectory = "NO"
-      debugDocumentVersioning = "YES"
-      buildConfiguration = "Release"
-      shouldUseLaunchSchemeArgsEnv = "YES">
-   </ProfileAction>
-   <AnalyzeAction
-      buildConfiguration = "Debug">
-   </AnalyzeAction>
-   <ArchiveAction
-      buildConfiguration = "Release"
-      revealArchiveInOrganizer = "YES">
-   </ArchiveAction>
-</Scheme>
```

---

### Incident Patch 12: `44b4a20d` (2017-06-15)
**Commit Message**: Merge pull request #9 from ikenox/fix-syntax-error-in-podfile

Fix syntax error in Podfile

**File**: `Podfile` (modified, +1/-0)
```diff
@@ -93,3 +93,4 @@ post_install do |installer|
                 end
         end
     end
+end
```

---

### Incident Patch 13: `2faa78c2` (2017-06-15)
**Commit Message**: fix syntax error in Podfile

**File**: `Podfile` (modified, +1/-0)
```diff
@@ -93,3 +93,4 @@ post_install do |installer|
                 end
         end
     end
+end
```

---

### Incident Patch 14: `423a353f` (2017-04-19)
**Commit Message**: Fix missing image in README

**File**: `README.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ The `Platform` is a concrete implementation of the `Domain` in a specific platfo
 
 
 ## Detail overview
-![](Architecture/Modules Details.png)
+![](Architecture/ModulesDetails.png)
  
 To enforce modularity, `Domain`, `Platform` and `Application` are separate targets in the App, which allows us to take advantage of the `internal` access layer in Swift to prevent exposing of types that we don't want to expose.
 
```

---

### Incident Patch 15: `bbfe9e1f` (2017-04-04)
**Commit Message**: - fix build error

**File**: `CoreDataPlatform/Entities/CDAlbum+Ext.swift` (modified, +2/-2)
```diff
@@ -21,8 +21,8 @@ extension CDAlbum {
 extension CDAlbum: DomainConvertibleType {
     func asDomain() -> Album {
         return Album(title: title!,
-                     uid: uid,
-                     userId: userId)
+                     uid: uid!,
+                     userId: userId!)
     }
 }
 
```

**File**: `CoreDataPlatform/Entities/CDComment+Ext.swift` (modified, +2/-2)
```diff
@@ -25,8 +25,8 @@ extension CDComment: DomainConvertibleType {
         return Comment(body: body!,
                        email: email!,
                        name: name!,
-                       postId: postId,
-                       uid: uid)
+                       postId: postId!,
+                       uid: uid!)
     }
 }
 
```

**File**: `CoreDataPlatform/Entities/CDPhoto+Ext.swift` (modified, +2/-2)
```diff
@@ -22,10 +22,10 @@ extension CDPhoto {
 
 extension CDPhoto: DomainConvertibleType {
     func asDomain() -> Photo {
-        return Photo(albumId: albumId,
+        return Photo(albumId: albumId!,
                      thumbnailUrl: thumbnailUrl!,
                      title: title!,
-                     uid: uid,
+                     uid: uid!,
                      url: url!)
     }
 }
```

**File**: `CoreDataPlatform/Entities/CDPost+Ext.swift` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ extension CDPost: DomainConvertibleType {
     func asDomain() -> Post {
         return Post(body: body!,
                     title: title!,
-                    uid: uid,
-                    userId: userId)
+                    uid: uid!,
+                    userId: userId!)
     }
 }
 
```

**File**: `CoreDataPlatform/Entities/CDTodo+Ext.swift` (modified, +2/-2)
```diff
@@ -23,8 +23,8 @@ extension CDTodo: DomainConvertibleType {
     func asDomain() -> Todo {
         return Todo(completed: completed,
                     title: title!,
-                    uid: uid,
-                    userId: userId)
+                    uid: uid!,
+                    userId: userId!)
     }
 }
 
```

**File**: `CoreDataPlatform/Entities/CDUser+Ext.swift` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ extension CDUser: DomainConvertibleType {
                     email: email!,
                     name: name!,
                     phone: phone!,
-                    uid: uid,
+                    uid: uid!,
                     username: username!,
                     website: website!)
     }
```

**File**: `Pods/Pods.xcodeproj/xcuserdata/andrey.yastrebov.xcuserdatad/xcschemes/Nimble.xcscheme` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
             buildForArchiving = "YES">
             <BuildableReference
                BuildableIdentifier = 'primary'
-               BlueprintIdentifier = '0921CC2F4398BE9A4F1CEACB30684B56'
+               BlueprintIdentifier = '5EAD26FEFD7C04C3E2C7218C2145C13E'
                BlueprintName = 'Nimble'
                ReferencedContainer = 'container:Pods.xcodeproj'
                BuildableName = 'Nimble.framework'>
```

**File**: `Pods/Pods.xcodeproj/xcuserdata/andrey.yastrebov.xcuserdatad/xcschemes/Pods-CleanArchitectureRxSwift.xcscheme` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@
             buildForAnalyzing = "YES">
             <BuildableReference
                BuildableIdentifier = "primary"
-               BlueprintIdentifier = "DC4A15F4D2E8A03786D3094824A0EB5B"
+               BlueprintIdentifier = "A55B2C54462C11B038EADB43EC1EE523"
                BuildableName = "Pods_CleanArchitectureRxSwift.framework"
                BlueprintName = "Pods-CleanArchitectureRxSwift"
                ReferencedContainer = "container:Pods.xcodeproj">
@@ -45,7 +45,7 @@
       <MacroExpansion>
          <BuildableReference
             BuildableIdentifier = "primary"
-            BlueprintIdentifier = "DC4A15F4D2E8A03786D3094824A0EB5B"
+            BlueprintIdentifier = "A55B2C54462C11B038EADB43EC1EE523"
             BuildableName = "Pods_CleanArchitectureRxSwift.framework"
             BlueprintName = "Pods-CleanArchitectureRxSwift"
             ReferencedContainer = "container:Pods.xcodeproj">
```

#### Recent Merged Pull Requests:
- **PR #94** (closed): Add Benchmark Tasks 1-15 (@chrisknapp98)
- **PR #92** (closed): Update read me (@sergdort)
- **PR #90** (closed): upgrade RxSwift to 6.6 from 6.5 (@ShenYj)
- **PR #89** (closed): Feature/ flexiloan (@codedeman)
- **PR #86** (2022-03-21): Update #travial (@ShenYj)
- **PR #85** (2021-11-08): Update to rx6 (@ShenYj)
- **PR #84** (2021-11-05): Naming conflict on iOS 15 (@ShenYj)
- **PR #79** (2020-05-22): Spelling mistake fix (@Istiakmorsalin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
