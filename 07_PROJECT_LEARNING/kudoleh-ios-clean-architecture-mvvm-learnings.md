# Forensic Learning Record (Deep Inspection): kudoleh/iOS-Clean-Architecture-MVVM

> **Canonical Artifact**: `07_PROJECT_LEARNING/kudoleh-ios-clean-architecture-mvvm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kudoleh/iOS-Clean-Architecture-MVVM](https://github.com/kudoleh/iOS-Clean-Architecture-MVVM))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:58:48.847Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kudoleh/iOS-Clean-Architecture-MVVM`
- **Description**: Template iOS app using Clean Architecture and MVVM. Includes DIContainer, FlowCoordinator, DTO, Response Caching and one of the views in SwiftUI 
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4413 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ExampleMVVM/Common/DispatchQueueType.swift`
```
import Foundation

/// Used to easily mock main and background queues in tests
protocol DispatchQueueType {
    func async(execute work: @escaping () -> Void)
}

extension DispatchQueue: DispatchQueueType {
    func async(execute work: @escaping () -> Void) {
        async(group: nil, execute: work)
    }
}

```

### Core Architecture Module: `ExampleMVVM/Data/PersistentStorages/CoreDataStorage/CoreDataStorage.swift`
```
import CoreData

enum CoreDataStorageError: Error {
    case readError(Error)
    case saveError(Error)
    case deleteError(Error)
}

final class CoreDataStorage {

    static let shared = CoreDataStorage()
    
    // MARK: - Core Data stack
    private lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "CoreDataStorage")
        container.loadPersistentStores { _, error in
            if let error = error as NSError? {
                // TODO: - Log to Crashlytics
                assertionFailure("CoreDataStorage Unresolved error \(error), \(error.userInfo)")
            }
        }
        return container
    }()

    // MARK: - Core Data Saving support
    func saveContext() {
        let context = persistentContainer.viewContext
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                // TODO: - Log to Crashlytics
                assertionFailure("CoreDataStorage Unresolved error \(error), \((error as NSError).userInfo)")
            }
        }
    }

    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        persistentContainer.performBackgroundTask(block)
    }
}

```

### Core Architecture Module: `ExampleMVVM/Data/PersistentStorages/MoviesQueriesStorage/CoreDataStorage/CoreDataMoviesQueriesStorage.swift`
```
import Foundation
import CoreData

final class CoreDataMoviesQueriesStorage {

    private let maxStorageLimit: Int
    private let coreDataStorage: CoreDataStorage

    init(
        maxStorageLimit: Int,
        coreDataStorage: CoreDataStorage = CoreDataStorage.shared
    ) {
        self.maxStorageLimit = maxStorageLimit
        self.coreDataStorage = coreDataStorage
    }
}

extension CoreDataMoviesQueriesStorage: MoviesQueriesStorage {
    
    func fetchRecentsQueries(
        maxCount: Int,
        completion: @escaping (Result<[MovieQuery], Error>) -> Void
    ) {
        
        coreDataStorage.performBackgroundTask { context in
            do {
                let request: NSFetchRequest = MovieQueryEntity.fetchRequest()
                request.sortDescriptors = [NSSortDescriptor(key: #keyPath(MovieQueryEntity.createdAt),
                                                            ascending: false)]
                request.fetchLimit = maxCount
                let result = try context.fetch(request).map { $0.toDomain() }

                completion(.success(result))
            } catch {
                completion(.failure(CoreDataStorageError.readError(error)))
            }
        }
    }
    
    func saveRecentQuery(
        query: MovieQuery,
        completion: @escaping (Result<MovieQuery, Error>) -> Void
    ) {

        coreDataStorage.performBackgroundTask { [weak self] context in
            guard let self = self else { return }
            do {
                try self.cleanUpQueries(for: query, inContext: context)
                let entity = MovieQueryEntity(movieQuery: query, insertInto: context)
                try context.save()

                completion(.success(entity.toDomain()))
            } catch {
                completion(.failure(CoreDataStorageError.saveError(error)))
            }
        }
    }
}

// MARK: - Private
extension CoreDataMoviesQueriesStorage {

    private func cleanUpQueries(
        for query: MovieQuery,
        inContext context: NSManagedObjectContext
    ) throws {
        let request: NSFetchRequest = MovieQueryEntity.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: #keyPath(MovieQueryEntity.createdAt),
                                                    ascending: false)]
        var result = try context.fetch(request)

        removeDuplicates(for: query, in: &result, inContext: context)
        removeQueries(limit: maxStorageLimit - 1, in: result, inContext: context)
    }

    private func removeDuplicates(
        for query: MovieQuery,
        in queries: inout [MovieQueryEntity],
        inContext context: NSManagedObjectContext
    ) {
        queries
            .filter { $0.query == query.query }
            .forEach { context.delete($0) }
        queries.removeAll { $0.query == query.query }
    }

    private func removeQueries(
        limit: Int,
        in queries: [MovieQueryEntity],
        inContext context: NSManagedObjectContext
    ) {
        guard queries.count > limit else { return }

        queries.suffix(queries.count - limit)
            .forEach { context.delete($0) }
    }
}

```

### Core Architecture Module: `ExampleMVVM/Data/PersistentStorages/MoviesQueriesStorage/CoreDataStorage/EntityMapping/MovieQueryEntity+Mapping.swift`
```
import Foundation
import CoreData

extension MovieQueryEntity {
    convenience init(movieQuery: MovieQuery, insertInto context: NSManagedObjectContext) {
        self.init(context: context)
        query = movieQuery.query
        createdAt = Date()
    }
}

extension MovieQueryEntity {
    func toDomain() -> MovieQuery {
        return .init(query: query ?? "")
    }
}

```

### Core Architecture Module: `ExampleMVVM/Data/PersistentStorages/MoviesResponseStorage/CoreDataMoviesResponseStorage.swift`
```
import Foundation
import CoreData

final class CoreDataMoviesResponseStorage {

    private let coreDataStorage: CoreDataStorage

    init(coreDataStorage: CoreDataStorage = CoreDataStorage.shared) {
        self.coreDataStorage = coreDataStorage
    }

    // MARK: - Private

    private func fetchRequest(
        for requestDto: MoviesRequestDTO
    ) -> NSFetchRequest<MoviesRequestEntity> {
        let request: NSFetchRequest = MoviesRequestEntity.fetchRequest()
        request.predicate = NSPredicate(format: "%K = %@ AND %K = %d",
                                        #keyPath(MoviesRequestEntity.query), requestDto.query,
                                        #keyPath(MoviesRequestEntity.page), requestDto.page)
        return request
    }

    private func deleteResponse(
        for requestDto: MoviesRequestDTO,
        in context: NSManagedObjectContext
    ) {
        let request = fetchRequest(for: requestDto)

        do {
            if let result = try context.fetch(request).first {
                context.delete(result)
            }
        } catch {
            print(error)
        }
    }
}

extension CoreDataMoviesResponseStorage: MoviesResponseStorage {

    func getResponse(
        for requestDto: MoviesRequestDTO,
        completion: @escaping (Result<MoviesResponseDTO?, Error>) -> Void
    ) {
        coreDataStorage.performBackgroundTask { context in
            do {
                let fetchRequest = self.fetchRequest(for: requestDto)
                let requestEntity = try context.fetch(fetchRequest).first

                completion(.success(requestEntity?.response?.toDTO()))
            } catch {
                completion(.failure(CoreDataStorageError.readError(error)))
            }
        }
    }

    func save(
        response responseDto: MoviesResponseDTO,
        for requestDto: MoviesRequestDTO
    ) {
        coreDataStorage.performBackgroundTask { context in
            do {
                self.deleteResponse(for: requestDto, in: context)

                let requestEntity = requestDto.toEntity(in: context)
                requestEntity.response = responseDto.toEntity(in: context)

                try context.save()
            } catch {
                // TODO: - Log to Crashlytics
                debugPrint("CoreDataMoviesResponseStorage Unresolved error \(error), \((error as NSError).userInfo)")
            }
        }
    }
}

```

### Core Architecture Module: `ExampleMVVM/Data/Repositories/Utils/RepositoryTask.swift`
```
import Foundation

class RepositoryTask: Cancellable {
    var networkTask: NetworkCancellable?
    var isCancelled: Bool = false
    
    func cancel() {
        networkTask?.cancel()
        isCancelled = true
    }
}

```

### Core Architecture Module: `ExampleMVVM/Mocks/DispatchQueueTypeMock.swift`
```
import Foundation

final class DispatchQueueTypeMock: DispatchQueueType {
    func async(execute work: @escaping () -> Void) {
        work()
    }
}

```

### Core Architecture Module: `ExampleMVVM/Presentation/Utils/AccessibilityIdentifier.swift`
```
import Foundation

struct AccessibilityIdentifier {
    static let movieDetailsView = "AccessibilityIdentifierMovieDetailsView"
    static let searchField = "AccessibilityIdentifierSearchMovies"
}

```

### Core Architecture Module: `ExampleMVVM/Presentation/Utils/Extensions/CGSize+ScaledSize.swift`
```
import Foundation
import UIKit

extension CGSize {
    var scaledSize: CGSize {
        .init(width: width * UIScreen.main.scale, height: height * UIScreen.main.scale)
    }
}

```

### Core Architecture Module: `ExampleMVVM/Presentation/Utils/Extensions/DataTransferError+ConnectionError.swift`
```
import Foundation

extension DataTransferError: ConnectionError {
    var isInternetConnectionError: Bool {
        guard case let DataTransferError.networkFailure(networkError) = self,
            case .notConnected = networkError else {
                return false
        }
        return true
    }
}

```

### Core Architecture Module: `ExampleMVVM/Presentation/Utils/Extensions/UIViewController+ActivityIndicator.swift`
```
import UIKit

extension UITableViewController {

    func makeActivityIndicator(size: CGSize) -> UIActivityIndicatorView {
        let style: UIActivityIndicatorView.Style
        if #available(iOS 12.0, *) {
            if self.traitCollection.userInterfaceStyle == .dark {
                style = .white
            } else {
                style = .gray
            }
        } else {
            style = .gray
        }

        let activityIndicator = UIActivityIndicatorView(style: style)
        activityIndicator.startAnimating()
        activityIndicator.isHidden = false
        activityIndicator.frame = .init(origin: .zero, size: size)

        return activityIndicator
    }
}

```

### Core Architecture Module: `ExampleMVVM/Presentation/Utils/Extensions/UIViewController+AddBehaviors.swift`
```
// View controller lifecycle behaviors https://irace.me/lifecycle-behaviors
// Behaviors are very useful to reuse logic for cases like Keyboard Behaviour.
// Where ViewController on didLoad adds behaviour which observes keyboard frame
// and scrollView content inset changes based on keyboard frame.

import UIKit

protocol ViewControllerLifecycleBehavior {
    func viewDidLoad(viewController: UIViewController)
    func viewWillAppear(viewController: UIViewController)
    func viewDidAppear(viewController: UIViewController)
    func viewWillDisappear(viewController: UIViewController)
    func viewDidDisappear(viewController: UIViewController)
    func viewWillLayoutSubviews(viewController: UIViewController)
    func viewDidLayoutSubviews(viewController: UIViewController)
}
// Default implementations
extension ViewControllerLifecycleBehavior {
    func viewDidLoad(viewController: UIViewController) {}
    func viewWillAppear(viewController: UIViewController) {}
    func viewDidAppear(viewController: UIViewController) {}
    func viewWillDisappear(viewController: UIViewController) {}
    func viewDidDisappear(viewController: UIViewController) {}
    func viewWillLayoutSubviews(viewController: UIViewController) {}
    func viewDidLayoutSubviews(viewController: UIViewController) {}
}

extension UIViewController {
    /*
     Add behaviors to be hooked into this view controller’s lifecycle.

     This method requires the view controller’s view to be loaded, so it’s best to call
     in `viewDidLoad` to avoid it being loaded prematurely.

     - parameter behaviors: Behaviors to be added.
     */
    func addBehaviors(_ behaviors: [ViewControllerLifecycleBehavior]) {
        let behaviorViewController = LifecycleBehaviorViewController(behaviors: behaviors)

        addChild(behaviorViewController)
        view.addSubview(behaviorViewController.view)
        behaviorViewController.didMove(toParent: self)
    }

    private final class LifecycleBehaviorViewController: UIViewController, UIGestureRecognizerDelegate {
        private let behaviors: [ViewControllerLifecycleBehavior]

        // MARK: - Lifecycle

        init(behaviors: [ViewControllerLifecycleBehavior]) {
            self.behaviors = behaviors

            super.init(nibName: nil, bundle: nil)
        }

        required init?(coder aDecoder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override func viewDidLoad() {
            super.viewDidLoad()

            view.isHidden = true

            applyBehaviors { behavior, viewController in
                behavior.viewDidLoad(viewController: viewController)
            }
        }

        override func viewWillAppear(_ animated: Bool) {
            super.viewWillAppear(animated)

            applyBehaviors { behavior, viewController in
                behavior.viewWillAppear(viewController: viewController)
            }
        }

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)

            applyBehaviors { behavior, viewController in
                behavior.viewDidAppear(viewController: viewController)
            }
        }

        override func viewWillDisappear(_ animated: Bool) {
            super.viewWillDisappear(animated)

            applyBehaviors { behavior, viewController in
                behavior.viewWillDisappear(viewController: viewController)
            }
        }

        override func viewDidDisappear(_ animated: Bool) {
            super.viewDidDisappear(animated)

            applyBehaviors { behavior, viewController in
                behavior.viewDidDisappear(viewController: viewController)
            }
        }

        override func viewWillLayoutSubviews() {
            super.viewWillLayoutSubviews()

            applyBehaviors { behavior, viewController in
                behavior.viewWillLayoutSubviews(viewController: viewController)
            }
        }

        override func viewDidLayoutSubviews() {
            super.viewDidLayoutSubviews()

            applyBehaviors { behavior, viewController in
                behavior.viewDidLayoutSubviews(viewController: viewController)
            }
        }

        // MARK: - Private

        private func applyBehaviors(body: (_ behavior: ViewControllerLifecycleBehavior, _ viewController: UIViewController) -> Void) {
            guard let parent = parent else { return }

            for behavior in behaviors {
                body(behavior, parent)
            }
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #45** (2026-06-21): **Main dev**
  *Symptoms*: 

- **Issue #43** (2026-05-17): **Dev**
  *Symptoms*: 

- **Issue #42** (2026-05-17): **Feature/movies enhancements**
  *Symptoms*: 

- **Issue #41** (2026-05-17): **Feature/genre filter**
  *Symptoms*: 

- **Issue #40** (2026-05-17): **Feature/movie details enhancements**
  *Symptoms*: feat: add favorite and watchlist support

- **Issue #39** (2026-05-17): **feat: add main tab bar**
  *Symptoms*: - Added a main tab bar with Home, Current Search, and Profile tabs - Reused the existing movies search flow for the Current Search tab

- **Issue #38** (2026-05-19): **Bump addressable from 2.8.0 to 2.9.0**
  *Symptoms*: Bumps [addressable](https://github.com/sporkmonger/addressable) from 2.8.0 to 2.9.0. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/sporkmonger/addressable/blob/main/CHANGELOG.md">addressable's changelog</a>.</em></p> <blockquote> <h2>Addressable 2.9.0 <!-- raw HTML omitted --></h2> <ul> <li>fixes ReDoS vulnerability in Addressable::Template#match (fixes incomplete remediation in 2.8.10)</li> </ul> <h2>Addressable 2.8.10 <!-- raw HTML omitted --></h2> <ul> <li>fixes ReDoS vulnerability in Addressable::Template#match</li> </ul> <h2>Addressable 2.8.9 <!-- raw HTML omitted --></h2> <ul> <li>Reduce gem size by excluding test files (<a href="https://redirect.github.com/sporkmonger/addressable/issues/569">#569</a>)</li> <li>No need for bundler as development dependency (<a href="https://redirect.github.com/sporkmonger/addressable/issues/571">#571</a>, <a href="https://github.com/sporkmonger/addressable/commit/5fc1d93">5fc1d93</a>)</li> <li>idna/pure: stop building the useless <code>COMPOSITION_TABLE</code> (removes the <code>Addressable::IDNA::COMPOSITION_TABLE</code> constant) (<a href="https://redirect.github.com/sporkmonger/addressable/issues/564">#564</a>)</li> </ul> <p><a href="https://redirect.github.com/sporkmonger/addressable/issues/569">#569</a>: <a href="https://redirect.github.com/sporkmonger/addressable/pull/569">sporkmonger/addressable#569</a> <a href="https://redirect.github.com/sporkmonger/addressable/issues/571">#571</a>: <a h

- **Issue #30** (2023-09-29): **Refector for transition from BodyEncoding enum to BodyEncoder protocol**
  *Symptoms*: 

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

### Incident Patch 1: `01e746f9` (2026-06-27)
**Commit Message**: Fix Medium post link in README

Updated the link to the Medium post about Clean Architecture and MVVM.

**File**: `README.md` (modified, +2/-1)
```diff
@@ -1,7 +1,8 @@
 
 # Template iOS App using Clean Architecture and MVVM
 
-iOS Project implemented with Clean Layered Architecture and MVVM. (Can be used as Template project by replacing item name “Movie”). **More information in medium post**: <a href="https://tech.olx.com/clean-architecture-and-mvvm-on-ios-c9d167d9f5b3">Medium Post about Clean Architecture + MVVM</a>
+iOS Project implemented with Clean Layered Architecture and MVVM. (Can be used as Template project by replacing item name “Movie”). **More information in medium post**: <a href="https://medium.com/olx-engineering/clean-architecture-and-mvvm-on-ios-c9d167d9f5b3">Medium Post about Clean Architecture + MVVM</a>
+
 
 
 ![Alt text](README_FILES/CleanArchitecture+MVVM.png?raw=true "Clean Architecture Layers")
```

---

### Incident Patch 2: `eaf3b265` (2026-03-08)
**Commit Message**: Fix warning

**File**: `ExampleMVVM/Presentation/Utils/Observable.swift` (modified, +2/-2)
```diff
@@ -2,12 +2,12 @@ import Foundation
 
 final class Observable<Value> {
     
-    struct Observer<Value> {
+    struct Observer {
         weak var observer: AnyObject?
         let block: (Value) -> Void
     }
     
-    private var observers = [Observer<Value>]()
+    private var observers = [Observer]()
     
     var value: Value {
         didSet { notifyObservers() }
```

---

### Incident Patch 3: `b22fb1f9` (2026-03-08)
**Commit Message**: Fix tests

**File**: `ExampleMVVMTests/Presentation/MoviesScene/MoviesListViewModelTests.swift` (modified, +0/-7)
```diff
@@ -59,7 +59,6 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertFalse(viewModel.hasMorePages)
         XCTAssertTrue(viewModel.items.value.isEmpty)
         XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
-        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
     
     func test_whenSearchMoviesUseCaseRetrievesFirstPage_thenViewModelContainsOnlyFirstPage() {
@@ -85,7 +84,6 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.currentPage, 1)
         XCTAssertTrue(viewModel.hasMorePages)
         XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
-        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
     
     func test_whenSearchMoviesUseCaseRetrievesFirstAndSecondPage_thenViewModelContainsTwoPages() {
@@ -118,7 +116,6 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.currentPage, 2)
         XCTAssertFalse(viewModel.hasMorePages)
         XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 2)
-        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
 
     func test_whenSearchMoviesUseCaseReturnsError_thenViewModelContainsError() {
@@ -139,7 +136,6 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertNotNil(viewModel.error)
         XCTAssertTrue(viewModel.items.value.isEmpty)
         XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
-        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
 
     func test_whenLastPage_thenHasNoPageIsTrue() {
@@ -167,7 +163,6 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.currentPage, 2)
         XCTAssertFalse(viewModel.hasMorePages)
         XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 2)
-        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
     
     func test_whenSearchMoviesUseCaseReturnsCachedData_thenViewModelShowsFirstCachedDataAndAfterFreshData() {
@@ -211,7 +206,6 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.currentPage, 1)
         XCTAssertTrue(viewModel.hasMorePages)
         XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
-        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
     
     func test_whenSearchMoviesUseCaseReturnsError_thenViewModelShowsCachedData() {
@@ -245,7 +239,6 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.currentPage, 1)
         XCTAssertTrue(viewModel.hasMorePages)
         XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
-        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
 
 }
```

---

### Incident Patch 4: `2cfa54ee` (2023-06-06)
**Commit Message**: fix typo

**File**: `ExampleMVVM/Infrastructure/Network/NetworkService.swift` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ extension DefaultNetworkService: NetworkService {
 // MARK: - Default Network Session Manager
 // Note: If authorization is needed NetworkSessionManager can be implemented by using,
 // for example, Alamofire SessionManager with its RequestAdapter and RequestRetrier.
-// And it can be incjected into NetworkService instead of default one.
+// And it can be injected into NetworkService instead of default one.
 
 final class DefaultNetworkSessionManager: NetworkSessionManager {
     func request(
```

---

### Incident Patch 5: `47fe88dd` (2023-03-26)
**Commit Message**: Add tests for memory leaks for list view model

**File**: `ExampleMVVMTests/Presentation/MoviesScene/MoviesListViewModelTests.swift` (modified, +20/-12)
```diff
@@ -16,7 +16,7 @@ class MoviesListViewModelTests: XCTestCase {
     }()
     
     class SearchMoviesUseCaseMock: SearchMoviesUseCase {
-        var callCount: Int = 0
+        var executeCallCount: Int = 0
 
         typealias ExecuteBlock = (
             SearchMoviesUseCaseRequestValue,
@@ -33,7 +33,7 @@ class MoviesListViewModelTests: XCTestCase {
             cached: @escaping (MoviesPage) -> Void,
             completion: @escaping (Result<MoviesPage, Error>) -> Void
         ) -> Cancellable? {
-            callCount += 1
+            executeCallCount += 1
             _execute(requestValue, cached, completion)
             return nil
         }
@@ -58,7 +58,8 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.currentPage, 1)
         XCTAssertFalse(viewModel.hasMorePages)
         XCTAssertTrue(viewModel.items.value.isEmpty)
-        XCTAssertEqual(searchMoviesUseCaseMock.callCount, 1)
+        XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
+        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
     
     func test_whenSearchMoviesUseCaseRetrievesFirstPage_thenViewModelContainsOnlyFirstPage() {
@@ -83,7 +84,8 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.items.value, expectedItems)
         XCTAssertEqual(viewModel.currentPage, 1)
         XCTAssertTrue(viewModel.hasMorePages)
-        XCTAssertEqual(searchMoviesUseCaseMock.callCount, 1)
+        XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
+        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
     
     func test_whenSearchMoviesUseCaseRetrievesFirstAndSecondPage_thenViewModelContainsTwoPages() {
@@ -99,7 +101,7 @@ class MoviesListViewModelTests: XCTestCase {
         )
         // when
         viewModel.didSearch(query: "query")
-        XCTAssertEqual(searchMoviesUseCaseMock.callCount, 1)
+        XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
         
         searchMoviesUseCaseMock._execute = { requestValue, _, completion in
             XCTAssertEqual(requestValue.page, 2)
@@ -115,7 +117,8 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.items.value, expectedItems)
         XCTAssertEqual(viewModel.currentPage, 2)
         XCTAssertFalse(viewModel.hasMorePages)
-        XCTAssertEqual(searchMoviesUseCaseMock.callCount, 2)
+        XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 2)
+        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
 
     func test_whenSearchMoviesUseCaseReturnsError_thenViewModelContainsError() {
@@ -135,7 +138,8 @@ class MoviesListViewModelTests: XCTestCase {
         // then
         XCTAssertNotNil(viewModel.error)
         XCTAssertTrue(viewModel.items.value.isEmpty)
-        XCTAssertEqual(searchMoviesUseCaseMock.callCount, 1)
+        XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
+        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
 
     func test_whenLastPage_thenHasNoPageIsTrue() {
@@ -150,7 +154,7 @@ class MoviesListViewModelTests: XCTestCase {
         )
         // when
         viewModel.didSearch(query: "query")
-        XCTAssertEqual(searchMoviesUseCaseMock.callCount, 1)
+        XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
 
         searchMoviesUseCaseMock._execute = { requestValue, _, completion in
             XCTAssertEqual(requestValue.page, 2)
@@ -162,7 +166,8 @@ class MoviesListViewModelTests: XCTestCase {
         // then
         XCTAssertEqual(viewModel.currentPage, 2)
         XCTAssertFalse(viewModel.hasMorePages)
-        XCTAssertEqual(searchMoviesUseCaseMock.callCount, 2)
+        XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 2)
+        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
     
     func test_whenSearchMoviesUseCaseReturnsCachedData_thenViewModelShowsFirstCachedDataAndAfterFreshData() {
@@ -179,7 +184,8 @@ class MoviesListViewModelTests: XCTestCase {
             mainQueue: DispatchQueueTypeMock()
         )
         
-        let testItemsBeforeFreshData = {
+        let testItemsBeforeFreshData = { [weak viewModel] in
+            guard let viewModel else { return }
             let expectedItems = cachedPage
                 .movies
                 .map { MoviesListItemViewModel(movie: $0) }
@@ -204,7 +210,8 @@ class MoviesListViewModelTests: XCTestCase {
         XCTAssertEqual(viewModel.items.value, expectedItems)
         XCTAssertEqual(viewModel.currentPage, 1)
         XCTAssertTrue(viewModel.hasMorePages)
-        XCTAssertEqual(searchMoviesUseCaseMock.callCount, 1)
+        XCTAssertEqual(searchMoviesUseCaseMock.executeCallCount, 1)
+        addTeardownBlock { [weak viewModel] in XCTAssertNil(viewModel) }
     }
     
     func test_whenSearchMoviesUseCaseReturnsError_thenViewModelShowsCachedData() {
@@ -237,7 +244,8 @@ class MoviesListViewModelTests
```

---

### Incident Patch 6: `51276365` (2023-03-01)
**Commit Message**: Fix cache response on main thread

**File**: `ExampleMVVM/Data/Repositories/DefaultMoviesRepository.swift` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ extension DefaultMoviesRepository: MoviesRepository {
         cache.getResponse(for: requestDTO) { result in
 
             if case let .success(responseDTO?) = result {
-                cached(responseDTO.toDomain())
+                DispatchQueue.main.async { cached(responseDTO.toDomain()) }
             }
             guard !task.isCancelled else { return }
 
```

---

### Incident Patch 7: `6a8c3162` (2023-02-25)
**Commit Message**: Fix typo

**File**: `ExampleMVVM/Data/PersistentStorages/MoviesQueriesStorage/UserDefaultsStorage/UserDefaultsMoviesQueriesStorage.swift` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ extension UserDefaultsMoviesQueriesStorage: MoviesQueriesStorage {
             var queries = self.fetchMoviesQueries()
             self.cleanUpQueries(for: query, in: &queries)
             queries.insert(query, at: 0)
-            self.persist(moviesQuries: queries)
+            self.persist(moviesQueries: queries)
 
             completion(.success(query))
         }
```

---

### Incident Patch 8: `c71b3e43` (2023-02-25)
**Commit Message**: Fix Typo

**File**: `ExampleMVVM/Data/PersistentStorages/MoviesQueriesStorage/UserDefaultsStorage/UserDefaultsMoviesQueriesStorage.swift` (modified, +5/-5)
```diff
@@ -17,7 +17,7 @@ final class UserDefaultsMoviesQueriesStorage {
         self.userDefaults = userDefaults
     }
 
-    private func fetchMoviesQuries() -> [MovieQuery] {
+    private func fetchMoviesQueries() -> [MovieQuery] {
         if let queriesData = userDefaults.object(forKey: recentsMoviesQueriesKey) as? Data {
             if let movieQueryList = try? JSONDecoder().decode(MovieQueriesListUDS.self, from: queriesData) {
                 return movieQueryList.list.map { $0.toDomain() }
@@ -26,9 +26,9 @@ final class UserDefaultsMoviesQueriesStorage {
         return []
     }
 
-    private func persist(moviesQuries: [MovieQuery]) {
+    private func persist(moviesQueries: [MovieQuery]) {
         let encoder = JSONEncoder()
-        let movieQueryUDSs = moviesQuries.map(MovieQueryUDS.init)
+        let movieQueryUDSs = moviesQueries.map(MovieQueryUDS.init)
         if let encoded = try? encoder.encode(MovieQueriesListUDS(list: movieQueryUDSs)) {
             userDefaults.set(encoded, forKey: recentsMoviesQueriesKey)
         }
@@ -41,7 +41,7 @@ extension UserDefaultsMoviesQueriesStorage: MoviesQueriesStorage {
         DispatchQueue.global(qos: .userInitiated).async { [weak self] in
             guard let self = self else { return }
 
-            var queries = self.fetchMoviesQuries()
+            var queries = self.fetchMoviesQueries()
             queries = queries.count < self.maxStorageLimit ? queries : Array(queries[0..<maxCount])
             completion(.success(queries))
         }
@@ -51,7 +51,7 @@ extension UserDefaultsMoviesQueriesStorage: MoviesQueriesStorage {
         DispatchQueue.global(qos: .userInitiated).async { [weak self] in
             guard let self = self else { return }
 
-            var queries = self.fetchMoviesQuries()
+            var queries = self.fetchMoviesQueries()
             self.cleanUpQueries(for: query, in: &queries)
             queries.insert(query, at: 0)
             self.persist(moviesQuries: queries)
```

**File**: `ExampleMVVMTests/Presentation/MoviesScene/MovieDetailsViewModelTests.swift` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ import XCTest
 
 class MovieDetailsViewModelTests: XCTestCase {
     
-    private enum PosterImageDowloadError: Error {
+    private enum PosterImageDownloadError: Error {
         case someError
     }
     
```

---

### Incident Patch 9: `ff7ae3c2` (2023-02-15)
**Commit Message**: Fix getMovies API

path end with slash will get a "The resource you requested could not be found." error

**File**: `ExampleMVVM/Data/Network/APIEndpoints.swift` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ struct APIEndpoints {
     
     static func getMovies(with moviesRequestDTO: MoviesRequestDTO) -> Endpoint<MoviesResponseDTO> {
 
-        return Endpoint(path: "3/search/movie/",
+        return Endpoint(path: "3/search/movie",
                         method: .get,
                         queryParametersEncodable: moviesRequestDTO)
     }
```

---

### Incident Patch 10: `73f319a2` (2022-11-03)
**Commit Message**: Fix file name <Cancellable.swift >

**File**: `ExampleMVVM.xcodeproj/project.pbxproj` (modified, +6/-6)
```diff
@@ -22,8 +22,8 @@
 		1F2AB95324278CC20010DEEE /* MoviesRequestDTO+Mapping.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F2AB95224278CC20010DEEE /* MoviesRequestDTO+Mapping.swift */; };
 		1F4102F4240BEE6A00EC014A /* UseCase.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F4102F3240BEE6A00EC014A /* UseCase.swift */; };
 		1F4102F5240BEE6A00EC014A /* UseCase.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F4102F3240BEE6A00EC014A /* UseCase.swift */; };
-		1F474F2222356B1E0092DB4B /* Cancelable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F474F2122356B1E0092DB4B /* Cancelable.swift */; };
-		1F474F2822356C7F0092DB4B /* Cancelable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F474F2122356B1E0092DB4B /* Cancelable.swift */; };
+		1F474F2222356B1E0092DB4B /* Cancellable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F474F2122356B1E0092DB4B /* Cancellable.swift */; };
+		1F474F2822356C7F0092DB4B /* Cancellable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F474F2122356B1E0092DB4B /* Cancellable.swift */; };
 		1F474F2A22356C7F0092DB4B /* Movie.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1FA533B1201EE2A500747E55 /* Movie.swift */; };
 		1F474F2B22356C7F0092DB4B /* MovieQuery.swift in Sources */ = {isa = PBXBuildFile; fileRef = FC7408192165574400FE52A5 /* MovieQuery.swift */; };
 		1F474F2D22356C7F0092DB4B /* SearchMoviesUseCase.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F05A6CB2220A2CB001E2801 /* SearchMoviesUseCase.swift */; };
@@ -145,7 +145,7 @@
 		1F2AB950242789B80010DEEE /* MoviesResponseDTO+Mapping.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = "MoviesResponseDTO+Mapping.swift"; sourceTree = "<group>"; };
 		1F2AB95224278CC20010DEEE /* MoviesRequestDTO+Mapping.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "MoviesRequestDTO+Mapping.swift"; sourceTree = "<group>"; };
 		1F4102F3240BEE6A00EC014A /* UseCase.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = UseCase.swift; sourceTree = "<group>"; };
-		1F474F2122356B1E0092DB4B /* Cancelable.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Cancelable.swift; sourceTree = "<group>"; };
+		1F474F2122356B1E0092DB4B /* Cancellable.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Cancellable.swift; sourceTree = "<group>"; };
 		1F53E2B523125896008D6A05 /* UIViewController+AddChild.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "UIViewController+AddChild.swift"; sourceTree = "<group>"; };
 		1F53E2B723125F71008D6A05 /* MoviesQueryListItemViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MoviesQueryListItemViewModel.swift; sourceTree = "<group>"; };
 		1F57F8D123C656F600981E09 /* AccessibilityIdentifier.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AccessibilityIdentifier.swift; sourceTree = "<group>"; };
@@ -757,7 +757,7 @@
 		1FEED0D520231F72000F4EAA /* Common */ = {
 			isa = PBXGroup;
 			children = (
-				1F474F2122356B1E0092DB4B /* Cancelable.swift */,
+				1F474F2122356B1E0092DB4B /* Cancellable.swift */,
 				1F0CEFCE23436B67004141FA /* ConnectionError.swift */,
 			);
 			path = Common;
@@ -1037,7 +1037,7 @@
 				1FE49D85230AA7C200D1D42E /* MoviesQueriesTableViewController.swift in Sources */,
 				1F160324242693DD00C173C6 /* MoviesSearchFlowCoordinator.swift in Sources */,
 				1F1CD656222368CA00B0143C /* AppConfigurations.swift in Sources */,
-				1F474F2222356B1E0092DB4B /* Cancelable.swift in Sources */,
+				1F474F2222356B1E0092DB4B /* Cancellable.swift in Sources */,
 				1FFFC833221B0041007D99D2 /* DefaultPosterImagesRepository.swift in Sources */,
 				FC740818216555C500FE52A5 /* UserDefaultsMoviesQueriesStorage.swift in Sources */,
 				1FCE68A1222C873A00CC3074 /* MoviesSceneDIContainer.swift in Sources */,
@@ -1084,7 +1084,7 @@
 				1FE49D9D230AEC5D00D1D42E /* MoviesQueryListViewModel.swift in Sources */,
 				1F474F2A22356C7F0092DB4B /* Movie.swift in Sources */,
 				1F90353723076B8A00DEA4BD /* MovieDetailsViewModelTests.swift in Sources */,
-				1F474F2822356C7F0092DB4B /* Cancelable.swift in Sources */,
+				1F474F2822356C7F0092DB4B /* Cancellable.swift in Sources */,
 				1F0CEFD023436B8B004141FA /* ConnectionError.swift in Sources */,
 				1FE49D9C230AEC5500D1D42E /* MovieDetailsViewModel.swift in Sources */,
 			);
```

---

### Incident Patch 11: `f46d26ef` (2022-06-03)
**Commit Message**: fix typo NetworkServiceTests

**File**: `ExampleMVVMTests/Infrastructure/Network/NetworkServiceTests.swift` (modified, +3/-3)
```diff
@@ -13,11 +13,11 @@ class NetworkServiceTests: XCTestCase {
         var path: String
         var isFullPath: Bool = false
         var method: HTTPMethodType
-        var headerParamaters: [String: String] = [:]
+        var headerParameters: [String: String] = [:]
         var queryParametersEncodable: Encodable?
         var queryParameters: [String: Any] = [:]
-        var bodyParamatersEncodable: Encodable?
-        var bodyParamaters: [String: Any] = [:]
+        var bodyParametersEncodable: Encodable?
+        var bodyParameters: [String: Any] = [:]
         var bodyEncoding: BodyEncoding = .stringEncodingAscii
         
         init(path: String, method: HTTPMethodType) {
```

---

### Incident Patch 12: `31ff6c98` (2022-06-03)
**Commit Message**: fix typo Network Endpoint

**File**: `ExampleMVVM/Infrastructure/Network/Endpoint.swift` (modified, +19/-19)
```diff
@@ -28,32 +28,32 @@ public class Endpoint<R>: ResponseRequestable {
     public let path: String
     public let isFullPath: Bool
     public let method: HTTPMethodType
-    public let headerParamaters: [String: String]
+    public let headerParameters: [String: String]
     public let queryParametersEncodable: Encodable?
     public let queryParameters: [String: Any]
-    public let bodyParamatersEncodable: Encodable?
-    public let bodyParamaters: [String: Any]
+    public let bodyParametersEncodable: Encodable?
+    public let bodyParameters: [String: Any]
     public let bodyEncoding: BodyEncoding
     public let responseDecoder: ResponseDecoder
     
     init(path: String,
          isFullPath: Bool = false,
          method: HTTPMethodType,
-         headerParamaters: [String: String] = [:],
+         headerParameters: [String: String] = [:],
          queryParametersEncodable: Encodable? = nil,
          queryParameters: [String: Any] = [:],
-         bodyParamatersEncodable: Encodable? = nil,
-         bodyParamaters: [String: Any] = [:],
+         bodyParametersEncodable: Encodable? = nil,
+         bodyParameters: [String: Any] = [:],
          bodyEncoding: BodyEncoding = .jsonSerializationData,
          responseDecoder: ResponseDecoder = JSONResponseDecoder()) {
         self.path = path
         self.isFullPath = isFullPath
         self.method = method
-        self.headerParamaters = headerParamaters
+        self.headerParameters = headerParameters
         self.queryParametersEncodable = queryParametersEncodable
         self.queryParameters = queryParameters
-        self.bodyParamatersEncodable = bodyParamatersEncodable
-        self.bodyParamaters = bodyParamaters
+        self.bodyParametersEncodable = bodyParametersEncodable
+        self.bodyParameters = bodyParameters
         self.bodyEncoding = bodyEncoding
         self.responseDecoder = responseDecoder
     }
@@ -63,11 +63,11 @@ public protocol Requestable {
     var path: String { get }
     var isFullPath: Bool { get }
     var method: HTTPMethodType { get }
-    var headerParamaters: [String: String] { get }
+    var headerParameters: [String: String] { get }
     var queryParametersEncodable: Encodable? { get }
     var queryParameters: [String: Any] { get }
-    var bodyParamatersEncodable: Encodable? { get }
-    var bodyParamaters: [String: Any] { get }
+    var bodyParametersEncodable: Encodable? { get }
+    var bodyParameters: [String: Any] { get }
     var bodyEncoding: BodyEncoding { get }
     
     func urlRequest(with networkConfig: NetworkConfigurable) throws -> URLRequest
@@ -110,23 +110,23 @@ extension Requestable {
         let url = try self.url(with: config)
         var urlRequest = URLRequest(url: url)
         var allHeaders: [String: String] = config.headers
-        headerParamaters.forEach { allHeaders.updateValue($1, forKey: $0) }
+        headerParameters.forEach { allHeaders.updateValue($1, forKey: $0) }
 
-        let bodyParamaters = try bodyParamatersEncodable?.toDictionary() ?? self.bodyParamaters
-        if !bodyParamaters.isEmpty {
-            urlRequest.httpBody = encodeBody(bodyParamaters: bodyParamaters, bodyEncoding: bodyEncoding)
+        let bodyParameters = try bodyParametersEncodable?.toDictionary() ?? self.bodyParameters
+        if !bodyParameters.isEmpty {
+            urlRequest.httpBody = encodeBody(bodyParameters: bodyParameters, bodyEncoding: bodyEncoding)
         }
         urlRequest.httpMethod = method.rawValue
         urlRequest.allHTTPHeaderFields = allHeaders
         return urlRequest
     }
     
-    private func encodeBody(bodyParamaters: [String: Any], bodyEncoding: BodyEncoding) -> Data? {
+    private func encodeBody(bodyParameters: [String: Any], bodyEncoding: BodyEncoding) -> Data? {
         switch bodyEncoding {
         case .jsonSerializationData:
-            return try? JSONSerialization.data(withJSONObject: bodyParamaters)
+            return try? JSONSerialization.data(withJSONObject: bodyParameters)
         case .stringEncodingAscii:
-            return bodyParamaters.queryString.data(using: String.Encoding.ascii, allowLossyConversion: true)
+            return bodyParameters.queryString.data(using: String.Encoding.ascii, allowLossyConversion: true)
         }
     }
 }
```

---

### Incident Patch 13: `d8ae78ce` (2022-06-03)
**Commit Message**: fix typo

**File**: `ExampleMVVM/Infrastructure/Network/Endpoint.swift` (modified, +2/-2)
```diff
@@ -142,7 +142,7 @@ private extension Dictionary {
 private extension Encodable {
     func toDictionary() throws -> [String: Any]? {
         let data = try JSONEncoder().encode(self)
-        let josnData = try JSONSerialization.jsonObject(with: data)
-        return josnData as? [String : Any]
+        let jsonData = try JSONSerialization.jsonObject(with: data)
+        return jsonData as? [String : Any]
     }
 }
```

---

### Incident Patch 14: `5daebb8e` (2022-02-02)
**Commit Message**: Revert "Update for iOS 15"

This reverts commit 3ca9af5a40a6ff421417874c1963d32e4c8bad97.

**File**: `ExampleMVVM.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -39,6 +39,7 @@
 		1F5CE1CD242C303700A9CDE3 /* CoreDataStorage.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F5CE1CC242C303700A9CDE3 /* CoreDataStorage.swift */; };
 		1F6B521323630016002FCDE9 /* RepositoryTask.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F6B521223630016002FCDE9 /* RepositoryTask.swift */; };
 		1F77930F222C0DF2004E034C /* StoryboardInstantiable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F77930E222C0DF2004E034C /* StoryboardInstantiable.swift */; };
+		1F794921247D869700552CC3 /* BlackStyleNavigationBarBehavior.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F794920247D869700552CC3 /* BlackStyleNavigationBarBehavior.swift */; };
 		1F7C1D19242117910014F011 /* Movie+Stub.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F7C1D17242117790014F011 /* Movie+Stub.swift */; };
 		1F84DECE2300677B00139F73 /* Observable.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1FEE31612218B17E00C160B9 /* Observable.swift */; };
 		1F84DED023006BDA00139F73 /* FetchRecentMovieQueriesUseCase.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1F84DECF23006BDA00139F73 /* FetchRecentMovieQueriesUseCase.swift */; };
@@ -151,6 +152,7 @@
 		1F5CE1CC242C303700A9CDE3 /* CoreDataStorage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CoreDataStorage.swift; sourceTree = "<group>"; };
 		1F6B521223630016002FCDE9 /* RepositoryTask.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RepositoryTask.swift; sourceTree = "<group>"; };
 		1F77930E222C0DF2004E034C /* StoryboardInstantiable.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = StoryboardInstantiable.swift; sourceTree = "<group>"; };
+		1F794920247D869700552CC3 /* BlackStyleNavigationBarBehavior.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = BlackStyleNavigationBarBehavior.swift; sourceTree = "<group>"; };
 		1F7C1D17242117790014F011 /* Movie+Stub.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Movie+Stub.swift"; sourceTree = "<group>"; };
 		1F84DECF23006BDA00139F73 /* FetchRecentMovieQueriesUseCase.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FetchRecentMovieQueriesUseCase.swift; sourceTree = "<group>"; };
 		1F9034C32306FDFE00DEA4BD /* NetworkServiceTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NetworkServiceTests.swift; sourceTree = "<group>"; };
@@ -569,6 +571,7 @@
 			isa = PBXGroup;
 			children = (
 				1FB0903C243766C200DBE132 /* BackButtonEmptyTitleNavigationBarBehavior.swift */,
+				1F794920247D869700552CC3 /* BlackStyleNavigationBarBehavior.swift */,
 			);
 			path = Behaviors;
 			sourceTree = "<group>";
@@ -1007,6 +1010,7 @@
 				1FFF1AD5243B966600937EE4 /* MoviesListItemViewModel.swift in Sources */,
 				1FC2C9632301FEC0001AE47E /* MovieQueryUDS+Mapping.swift in Sources */,
 				1FE49D90230AA7C200D1D42E /* MovieDetailsViewModel.swift in Sources */,
+				1F794921247D869700552CC3 /* BlackStyleNavigationBarBehavior.swift in Sources */,
 				1F1FC48A22E3693100BCBA8D /* DataTransferService.swift in Sources */,
 				1FEE31622218B17E00C160B9 /* Observable.swift in Sources */,
 				1FFFC836221B0041007D99D2 /* MoviesRepository.swift in Sources */,
```

**File**: `ExampleMVVM/Application/AppAppearance.swift` (modified, +9/-12)
```diff
@@ -11,17 +11,14 @@ import UIKit
 final class AppAppearance {
     
     static func setupAppearance() {
-        if #available(iOS 15, *) {
-            let appearance = UINavigationBarAppearance()
-            appearance.configureWithOpaqueBackground()
-            appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
-            appearance.backgroundColor = UIColor(red: 54.0/255.0, green: 54/255.0, blue: 49.0/255.0, alpha: 1.0)
-            UINavigationBar.appearance().standardAppearance = appearance
-            UINavigationBar.appearance().scrollEdgeAppearance = appearance
-        } else {
-            UINavigationBar.appearance().barTintColor = .black
-            UINavigationBar.appearance().tintColor = .white
-            UINavigationBar.appearance().titleTextAttributes = [NSAttributedString.Key.foregroundColor: UIColor.white]
-        }
+        UINavigationBar.appearance().barTintColor = .black
+        UINavigationBar.appearance().tintColor = .white
+        UINavigationBar.appearance().titleTextAttributes = [NSAttributedString.Key.foregroundColor: UIColor.white]
+    }
+}
+
+extension UINavigationController {
+    @objc override open var preferredStatusBarStyle: UIStatusBarStyle {
+        return .lightContent
     }
 }
```

**File**: `ExampleMVVM/Presentation/MoviesScene/Behaviors/BlackStyleNavigationBarBehavior.swift` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+//
+//  BlackStyleNavigationBarBehavior.swift
+//  ExampleMVVM
+//
+//  Created by Oleh Kudinov on 26/05/2020.
+//
+
+import UIKit
+
+struct BlackStyleNavigationBarBehavior: ViewControllerLifecycleBehavior {
+
+    func viewDidLoad(viewController: UIViewController) {
+
+        viewController.navigationController?.navigationBar.barStyle = .black
+    }
+}
```

**File**: `ExampleMVVM/Presentation/MoviesScene/MoviesList/View/MoviesListViewController.swift` (modified, +2/-3)
```diff
@@ -69,9 +69,8 @@ final class MoviesListViewController: UIViewController, StoryboardInstantiable,
     }
 
     private func setupBehaviours() {
-        addBehaviors([
-            BackButtonEmptyTitleNavigationBarBehavior()
-        ])
+        addBehaviors([BackButtonEmptyTitleNavigationBarBehavior(),
+                      BlackStyleNavigationBarBehavior()])
     }
 
     private func updateItems() {
```

---

### Incident Patch 15: `0be45ff4` (2021-03-04)
**Commit Message**: Merge pull request #13 from headonn5/fix-singleton

Fixed Singleton class.

**File**: `ExampleMVVM/Data/PersistentStorages/CoreDataStorage/CoreDataStorage.swift` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@ enum CoreDataStorageError: Error {
 final class CoreDataStorage {
 
     static let shared = CoreDataStorage()
+    
+    private init() {}
 
     // MARK: - Core Data stack
     private lazy var persistentContainer: NSPersistentContainer = {
```

#### Recent Merged Pull Requests:
- **PR #45** (closed): Main dev (@AzharGhurab)
- **PR #43** (closed): Dev (@AishaH14)
- **PR #42** (closed): Feature/movies enhancements (@AzharGhurab)
- **PR #41** (closed): Feature/genre filter (@AzharGhurab)
- **PR #40** (closed): Feature/movie details enhancements (@AzharGhurab)
- **PR #39** (closed): feat: add main tab bar (@AishaH14)
- **PR #38** (2026-05-19): Bump addressable from 2.8.0 to 2.9.0 (@dependabot[bot])
- **PR #30** (2023-09-29): Refector for transition from BodyEncoding enum to BodyEncoder protocol (@Jeon0976)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
