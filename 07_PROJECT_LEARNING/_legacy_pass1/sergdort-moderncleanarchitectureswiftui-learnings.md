# Forensic Learning Record (Deep Inspection): sergdort/ModernCleanArchitectureSwiftUI

> **Canonical Artifact**: `07_PROJECT_LEARNING/sergdort-moderncleanarchitectureswiftui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sergdort/ModernCleanArchitectureSwiftUI](https://github.com/sergdort/ModernCleanArchitectureSwiftUI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T01:51:15.126Z  
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

### Incident Patch 1: `c7a57183` (2021-11-08)
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

### Incident Patch 2: `3f600d2c` (2021-11-08)
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

### Incident Patch 3: `ecc53d8e` (2021-11-05)
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

### Incident Patch 4: `c35aea59` (2020-05-01)
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

### Incident Patch 5: `bae0423a` (2019-03-21)
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

### Incident Patch 6: `c0666666` (2017-11-14)
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
+		BD107F5E1E72
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

---

### Incident Patch 7: `4365ee73` (2017-10-14)
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

### Incident Patch 8: `c07015eb` (2017-07-22)
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

---

### Incident Patch 9: `44b4a20d` (2017-06-15)
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

### Incident Patch 10: `2faa78c2` (2017-06-15)
**Commit Message**: fix syntax error in Podfile

**File**: `Podfile` (modified, +1/-0)
```diff
@@ -93,3 +93,4 @@ post_install do |installer|
                 end
         end
     end
+end
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
