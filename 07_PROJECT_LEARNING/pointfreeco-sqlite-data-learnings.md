# Forensic Learning Record (Deep Inspection): pointfreeco/sqlite-data

> **Canonical Artifact**: `07_PROJECT_LEARNING/pointfreeco-sqlite-data-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pointfreeco/sqlite-data](https://github.com/pointfreeco/sqlite-data))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:31:47.750Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pointfreeco/sqlite-data`
- **Description**: A fast, lightweight replacement for SwiftData, powered by SQL and supporting CloudKit synchronization.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1937 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Examples/Integration/Regression Coverage/ParentRerenderAnimations.swift`
```
import SQLiteData
import SwiftUI

struct ParentRerenderAnimationsCaseStudy: SwiftUICaseStudy {
  let readMe = """
    This demonstrates that animations provided to the `@Fetch*` tools continue to work after a \
    parent view re-renders.

    The list below is loaded in the child view's `task` with an `animation` parameter, and so \
    tapping "Add fact" animates the new fact into the list. Tapping "Re-render parent" changes \
    `@State` in the parent view, which causes the child view (and its `@FetchAll`) to be \
    re-initialized. Adding a fact should continue to animate afterwards.
    """
  let caseStudyTitle = "Animations with re-rendered parent"

  @State private var rerenderCount = 0
  @Dependency(\.defaultDatabase) var database

  var body: some View {
    List {
      Section {
        Button("Re-render parent: \(rerenderCount)") {
          rerenderCount += 1
        }
        Button("Add fact") {
          withErrorReporting {
            try database.write { db in
              try Fact.insert {
                Fact.Draft(body: Date.now.formatted(date: .omitted, time: .standard))
              }
              .execute(db)
            }
          }
        }
      }
      FactsListView()
    }
  }
}

private struct FactsListView: View {
  @FetchAll(Fact.order { $0.id.desc() })
  private var facts

  var body: some View {
    Section {
      ForEach(facts) { fact in
        Text(fact.body)
      }
    }
    .task {
      await withErrorReporting {
        try await $facts.load(Fact.order { $0.id.desc() }, animation: .default).task
      }
    }
  }
}

@Table
nonisolated private struct Fact: Identifiable {
  let id: Int
  var body: String
}

extension DatabaseWriter where Self == DatabaseQueue {
  static var parentRerenderAnimationsDatabase: Self {
    let databaseQueue = try! DatabaseQueue()
    var migrator = DatabaseMigrator()
    migrator.registerMigration("Create 'facts' table") { db in
      try #sql(
        """
        CREATE TABLE "facts" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "body" TEXT NOT NULL
        ) STRICT
        """
      )
      .execute(db)
    }
    try! migrator.migrate(databaseQueue)
    return databaseQueue
  }
}

#Preview {
  let _ = prepareDependencies {
    $0.defaultDatabase = .parentRerenderAnimationsDatabase
  }
  NavigationStack {
    CaseStudyView {
      ParentRerenderAnimationsCaseStudy()
    }
  }
}

```

### Core Architecture Module: `Examples/Integration/Regression Coverage/ParentRerenderCancellation.swift`
```
import SQLiteData
import SwiftUI

struct ParentRerenderCancellationCaseStudy: SwiftUICaseStudy {
  let readMe = """
    This demonstrates that a cancelled observation survives a parent view re-render.

    The child view below observes a list of facts that grows every second, and toggling "Live \
    updates" off cancels the observation using the subscription's `task`, freezing the list. \
    Tapping "Re-render parent" changes `@State` in the parent view, which causes the child view \
    (and its `@FetchAll`) to be re-initialized. The list should remain frozen, and should not \
    silently resume live updates while the toggle remains off.
    """
  let caseStudyTitle = "Cancellation with re-rendered parent"

  @State private var rerenderCount = 0

  var body: some View {
    List {
      Section {
        Button("Re-render parent: \(rerenderCount)") {
          rerenderCount += 1
        }
      }
      FactsListView()
    }
  }
}

private struct FactsListView: View {
  @State private var isLive = true
  @FetchAll(Fact.order { $0.id.desc() })
  private var facts
  @Dependency(\.defaultDatabase) var database

  var body: some View {
    Section {
      Toggle("Live updates", isOn: $isLive)
      ForEach(facts) { fact in
        Text(fact.body)
      }
    }
    .task(id: isLive) {
      guard isLive else { return }
      await withErrorReporting {
        try await $facts.load(Fact.order { $0.id.desc() }).task
      }
    }
    .task {
      do {
        while true {
          try await Task.sleep(for: .seconds(1))
          try await database.write { db in
            try Fact.insert {
              Fact.Draft(body: Date.now.formatted(date: .omitted, time: .standard))
            }
            .execute(db)
          }
        }
      } catch {}
    }
  }
}

@Table
nonisolated private struct Fact: Identifiable {
  let id: Int
  var body: String
}

extension DatabaseWriter where Self == DatabaseQueue {
  static var parentRerenderCancellationDatabase: Self {
    let databaseQueue = try! DatabaseQueue()
    var migrator = DatabaseMigrator()
    migrator.registerMigration("Create 'facts' table") { db in
      try #sql(
        """
        CREATE TABLE "facts" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "body" TEXT NOT NULL
        ) STRICT
        """
      )
      .execute(db)
    }
    try! migrator.migrate(databaseQueue)
    return databaseQueue
  }
}

#Preview {
  let _ = prepareDependencies {
    $0.defaultDatabase = .parentRerenderCancellationDatabase
  }
  NavigationStack {
    CaseStudyView {
      ParentRerenderCancellationCaseStudy()
    }
  }
}

```

### Core Architecture Module: `Examples/Integration/Regression Coverage/ParentRerenderDynamicQuery.swift`
```
import SQLiteData
import SwiftUI

struct ParentRerenderDynamicQueryCaseStudy: SwiftUICaseStudy {
  let readMe = """
    This demonstrates that a dynamically loaded query survives a parent view re-render.

    The child view below starts with a query for all facts, and toggling "Favorites only" loads \
    a filtered query. Tapping "Re-render parent" changes `@State` in the parent view, which \
    causes the child view (and its `@FetchAll`) to be re-initialized. The filtered facts should \
    remain on screen, and should not silently revert to the unfiltered query while the toggle \
    remains on.
    """
  let caseStudyTitle = "Dynamic queries with re-rendered parent"

  @State private var rerenderCount = 0

  var body: some View {
    List {
      Section {
        Button("Re-render parent: \(rerenderCount)") {
          rerenderCount += 1
        }
      }
      FactsListView()
    }
  }
}

private struct FactsListView: View {
  @State private var isFavoritesOnly = false
  @FetchAll(Fact.all) private var facts

  var body: some View {
    Section {
      Toggle("Favorites only", isOn: $isFavoritesOnly)
      ForEach(facts) { fact in
        HStack {
          Text(fact.body)
          Spacer()
          if fact.isFavorite {
            Image(systemName: "star.fill")
              .foregroundStyle(.yellow)
          }
        }
      }
    }
    .task(id: isFavoritesOnly) {
      await withErrorReporting {
        if isFavoritesOnly {
          try await $facts.load(Fact.where(\.isFavorite)).task
        } else {
          try await $facts.load(Fact.all).task
        }
      }
    }
  }
}

@Table
nonisolated private struct Fact: Identifiable {
  let id: Int
  var body: String
  var isFavorite = false
}

extension DatabaseWriter where Self == DatabaseQueue {
  static var parentRerenderDynamicQueryDatabase: Self {
    let databaseQueue = try! DatabaseQueue()
    var migrator = DatabaseMigrator()
    migrator.registerMigration("Create 'facts' table") { db in
      try #sql(
        """
        CREATE TABLE "facts" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "body" TEXT NOT NULL,
          "isFavorite" INTEGER NOT NULL DEFAULT 0
        ) STRICT
        """
      )
      .execute(db)
      try Fact.insert {
        Fact.Draft(body: "SQLite was first released in the year 2000.", isFavorite: true)
        Fact.Draft(body: "SQLite is the most widely deployed database in the world.")
        Fact.Draft(body: "SQLite is a C library, not a client-server database.", isFavorite: true)
        Fact.Draft(body: "SQLite databases are a single file on disk.")
      }
      .execute(db)
    }
    try! migrator.migrate(databaseQueue)
    return databaseQueue
  }
}

#Preview {
  let _ = prepareDependencies {
    $0.defaultDatabase = .parentRerenderDynamicQueryDatabase
  }
  NavigationStack {
    CaseStudyView {
      ParentRerenderDynamicQueryCaseStudy()
    }
  }
}

```

### Core Architecture Module: `Examples/Integration/Regression Coverage/ParentRerenderLoadError.swift`
```
import GRDB
import SQLiteData
import SwiftUI

struct ParentRerenderLoadErrorCaseStudy: SwiftUICaseStudy {
  let readMe = """
    This demonstrates that a load error survives a parent view re-render.

    The child view below loads a query that always fails, and so it renders the `loadError` of \
    its `@Fetch` property. Tapping the stepper changes `@State` in the parent view, which causes \
    the child view (and its `@Fetch`) to be re-initialized. The error should remain on screen, \
    and should not be silently discarded, which would make the view appear healthy even though \
    its query failed.
    """
  let caseStudyTitle = "Load errors with re-rendered parent"

  @State private var count = 0

  var body: some View {
    List {
      Section {
        Stepper("Parent state: \(count)", value: $count)
      }
      FactsView(count: count)
    }
  }
}

private struct FactsView: View {
  let count: Int
  @Fetch private var facts = Facts.Value()

  var body: some View {
    Section("Facts (parent state: \(count))") {
      if let loadError = $facts.loadError {
        Label(loadError.localizedDescription, systemImage: "exclamationmark.triangle")
          .foregroundStyle(.red)
      } else {
        Text("Facts: \(facts.count)")
      }
    }
    .task {
      _ = try? await $facts.load(Facts())
    }
  }

  private struct Facts: FetchKeyRequest {
    struct Value {
      var count = 0
    }
    func fetch(_ db: Database) throws -> Value {
      struct QueryFailure: LocalizedError {
        var errorDescription: String? { "Something went wrong." }
      }
      throw QueryFailure()
    }
  }
}

extension DatabaseWriter where Self == DatabaseQueue {
  static var parentRerenderLoadErrorDatabase: Self {
    try! DatabaseQueue()
  }
}

#Preview {
  let _ = prepareDependencies {
    $0.defaultDatabase = .parentRerenderLoadErrorDatabase
  }
  NavigationStack {
    CaseStudyView {
      ParentRerenderLoadErrorCaseStudy()
    }
  }
}

```

### Core Architecture Module: `Examples/Integration/Regression Coverage/ParentRerenderLoadedData.swift`
```
import GRDB
import SQLiteData
import SwiftUI

struct ParentRerenderLoadedDataCaseStudy: SwiftUICaseStudy {
  let readMe = """
    This demonstrates that data loaded by the `@Fetch*` tools survives a parent view re-render.

    The child view below has a `@Fetch` property that begins with an empty default value and is \
    loaded in the view's `task`. Tapping the stepper changes `@State` in the parent view, which \
    causes the child view (and its `@Fetch`) to be re-initialized. The facts should remain on \
    screen, and should not revert to the empty default value. The same is true when any other \
    dynamic property in the parent changes, such as `@Environment`.
    """
  let caseStudyTitle = "Loaded data with re-rendered parent"

  @State private var count = 0

  var body: some View {
    List {
      Section {
        Stepper("Parent state: \(count)", value: $count)
      }
      FactsListView(count: count)
    }
  }
}

private struct FactsListView: View {
  let count: Int
  @Fetch private var facts = Facts.Value()

  var body: some View {
    Section("Facts (parent state: \(count))") {
      if facts.facts.isEmpty {
        Text("No facts loaded")
      }
      ForEach(facts.facts) { fact in
        Text(fact.body)
      }
    }
    .task {
      await withErrorReporting {
        try await $facts.load(Facts()).task
      }
    }
  }

  private struct Facts: FetchKeyRequest {
    struct Value {
      var facts: [Fact] = []
    }
    func fetch(_ db: Database) throws -> Value {
      try Value(facts: Fact.order { $0.id.desc() }.fetchAll(db))
    }
  }
}

@Table
nonisolated private struct Fact: Identifiable {
  let id: Int
  var body: String
}

extension DatabaseWriter where Self == DatabaseQueue {
  static var parentRerenderLoadedDataDatabase: Self {
    let databaseQueue = try! DatabaseQueue()
    var migrator = DatabaseMigrator()
    migrator.registerMigration("Create 'facts' table") { db in
      try #sql(
        """
        CREATE TABLE "facts" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "body" TEXT NOT NULL
        ) STRICT
        """
      )
      .execute(db)
      try Fact.insert {
        Fact.Draft(body: "SQLite was first released in the year 2000.")
        Fact.Draft(body: "SQLite is the most widely deployed database in the world.")
        Fact.Draft(body: "SQLite is a C library, not a client-server database.")
      }
      .execute(db)
    }
    try! migrator.migrate(databaseQueue)
    return databaseQueue
  }
}

#Preview {
  let _ = prepareDependencies {
    $0.defaultDatabase = .parentRerenderLoadedDataDatabase
  }
  NavigationStack {
    CaseStudyView {
      ParentRerenderLoadedDataCaseStudy()
    }
  }
}

```

### Core Architecture Module: `Sources/SQLiteData/CloudKit/DefaultSyncEngine.swift`
```
#if canImport(CloudKit)
  import CloudKit
  import GRDB
  public import Dependencies

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  extension DependencyValues {
    /// The default sync engine used by the application.
    ///
    /// Configure this as early as possible in your app's lifetime, like the app entry point in
    /// SwiftUI, using `prepareDependencies`:
    ///
    /// ```swift
    /// import SQLiteData
    /// import SwiftUI
    ///
    /// ```swift
    /// @main
    /// struct MyApp: App {
    ///   init() {
    ///     prepareDependencies {
    ///       $0.defaultDatabase = try! appDatabase()
    ///       $0.defaultSyncEngine = SyncEngine(
    ///         for: $0.defaultDatabase,
    ///         tables: Item.self
    ///       )
    ///     }
    ///   }
    ///   // ...
    /// }
    /// ```
    ///
    /// > Note: You can only prepare the default sync engine a single time in the lifetime of
    /// > your app. Attempting to do so more than once will produce a runtime warning.
    ///
    /// Once configured, access the default sync engine anywhere using `@Dependency`:
    ///
    /// ```swift
    /// @Dependency(\.defaultSyncEngine) var syncEngine
    ///
    /// syncEngine.acceptShare(metadata: metadata)
    /// ```
    ///
    /// See <doc:PreparingDatabase> for more info.
    public var defaultSyncEngine: SyncEngine {
      get { self[SyncEngine.self] }
      set { self[SyncEngine.self] = newValue }
    }
  }

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  extension SyncEngine: TestDependencyKey {
    public static var previewValue: SyncEngine {
      try! SyncEngine(for: DatabaseQueue())
    }

    public static var testValue: SyncEngine {
      try! SyncEngine(for: temporaryDatabasePool())
    }
  }
#endif

```

### Core Architecture Module: `Sources/SQLiteData/CloudKit/Internal/MockSyncEngine.swift`
```
#if canImport(CloudKit)
  package import ConcurrencyExtras
  package import CloudKit
  import IssueReporting
  package import OrderedCollections

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  package final class MockSyncEngine: SyncEngineProtocol {
    package let database: MockCloudDatabase
    package let parentSyncEngine: SyncEngine
    package let state: MockSyncEngineState
    package let _fetchChangesScopes = LockIsolated<[CKSyncEngine.FetchChangesOptions.Scope]>([])
    package let _acceptedShareMetadata = LockIsolated<Set<ShareMetadata>>([])

    package init(
      database: MockCloudDatabase,
      parentSyncEngine: SyncEngine,
      state: MockSyncEngineState
    ) {
      self.database = database
      self.parentSyncEngine = parentSyncEngine
      self.state = state
    }

    package var scope: CKDatabase.Scope {
      database.databaseScope
    }

    package func acceptShare(metadata: ShareMetadata) {
      _ = _acceptedShareMetadata.withValue { $0.insert(metadata) }
    }

    package func fetchChanges(_ options: CKSyncEngine.FetchChangesOptions) async throws {
      let modifications: [CKRecord]
      let zoneIDs: [CKRecordZone.ID]
      switch options.scope {
      case .all:
        zoneIDs = Array(database.state.storage.keys)
      case .allExcluding(let excludedZoneIDs):
        zoneIDs = Array(Set(database.state.storage.keys).subtracting(excludedZoneIDs))
      case .zoneIDs(let includedZoneIDs):
        zoneIDs = includedZoneIDs
      @unknown default:
        fatalError()
      }

      modifications = database.state.withValue { state in
        zoneIDs.reduce(into: [CKRecord]()) {
          accum,
          zoneID in
          accum += ((state.storage[zoneID]?.records.values).map { Array($0) } ?? [])
            .map { $0.copy() as! CKRecord }
            .filter {
              precondition(
                $0._recordChangeTag != nil,
                "Records stored in database should have their 'recordChangeTag' assigned."
              )
              return $0._recordChangeTag! > self.state.changeTag.value
            }
        }
      }

      let deletions = database.state.withValue {
        let records = $0.deletedRecords.filter { recordID, _ in
          zoneIDs.contains(recordID.zoneID)
        }
        $0.deletedRecords.removeAll { lhsRecordID, _ in
          records.contains { rhsRecordID, _ in lhsRecordID == rhsRecordID }
        }
        return records
      }

      guard !modifications.isEmpty || !deletions.isEmpty
      else { return }

      state.changeTag.withValue { changeTag in
        changeTag = modifications.compactMap(\._recordChangeTag).max() ?? changeTag
      }

      await parentSyncEngine.handleEvent(
        .fetchedRecordZoneChanges(modifications: modifications, deletions: deletions),
        syncEngine: self
      )
    }

    package func sendChanges(_ options: CKSyncEngine.SendChangesOptions) async throws {

      if !parentSyncEngine.syncEngine(for: database.databaseScope).state.pendingDatabaseChanges
        .isEmpty
      {

        try await parentSyncEngine.processPendingDatabaseChanges(scope: database.databaseScope)
      }
      if !parentSyncEngine.syncEngine(for: database.databaseScope).state.pendingRecordZoneChanges
        .isEmpty
      {

        try await parentSyncEngine.processPendingRecordZoneChanges(scope: database.databaseScope)
      }
    }

    package func recordZoneChangeBatch(
      pendingChanges: [CKSyncEngine.PendingRecordZoneChange],
      recordProvider: @Sendable (CKRecord.ID) async -> CKRecord?
    ) async -> CKSyncEngine.RecordZoneChangeBatch? {
      var recordsToSave: [CKRecord] = []
      var recordIDsSkipped: [CKRecord.ID] = []
      var recordIDsToDelete: [CKRecord.ID] = []
      for pendingChange in pendingChanges {
        switch pendingChange {
        case .saveRecord(let recordID):
          guard let record = await recordProvider(recordID)
          else {
            recordIDsSkipped.append(recordID)
            continue
          }
          recordsToSave.append(record)
        case .deleteRecord(let recordID):
          recordIDsToDelete.append(recordID)
        @unknown default:
          fatalError()
        }
      }

      state.remove(pendingRecordZoneChanges: recordsToSave.map { .saveRecord($0.recordID) })

      return CKSyncEngine.RecordZoneChangeBatch(
        recordsToSave: recordsToSave,
        recordIDsToDelete: recordIDsToDelete
      )
    }

    package func cancelOperations() async {
    }
  }

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  package final class MockSyncEngineState: CKSyncEngineStateProtocol {
    package let changeTag = LockIsolated(0)
    package let _pendingRecordZoneChanges = LockIsolated<
      OrderedSet<CKSyncEngine.PendingRecordZoneChange>
    >([]
    )
    package let _pendingDatabaseChanges = LockIsolated<
      OrderedSet<CKSyncEngine.PendingDatabaseChange>
    >([])
    private let fileID: StaticString
    private let filePath: StaticString
    private let line: UInt
    private let column: UInt

    package init(
      fileID: StaticString = #fileID,
      filePath: StaticString = #filePath,
      line: UInt = #line,
      column: UInt = #column
    ) {
      self.fileID = fileID
      self.filePath = filePath
      self.line = line
      self.column = column
    }

    package var pendingRecordZoneChanges: [CKSyncEngine.PendingRecordZoneChange] {
      _pendingRecordZoneChanges.withValue { Array($0) }
    }

    package var pendingDatabaseChanges: [CKSyncEngine.PendingDatabaseChange] {
      _pendingDatabaseChanges.withValue { Array($0) }
    }

    package func removePendingChanges() {
      _pendingDatabaseChanges.withValue { $0.removeAll() }
      _pendingRecordZoneChanges.withValue { $0.removeAll() }
    }

    package func add(pendingRecordZoneChanges: [CKSyncEngine.PendingRecordZoneChange]) {
      self._pendingRecordZoneChanges.withValue {
        $0.append(contentsOf: pendingRecordZoneChanges)
      }
    }

    package func remove(pendingRecordZoneChanges: [CKSyncEngine.PendingRecordZoneChange]) {
      self._pendingRecordZoneChanges.withValue {
        $0.subtract(pendingRecordZoneChanges)
      }
    }

    package func add(pendingDatabaseChanges: [CKSyncEngine.PendingDatabaseChange]) {
      self._pendingDatabaseChanges.withValue {
        $0.append(contentsOf: pendingDatabaseChanges)
      }
    }

    package func remove(pendingDatabaseChanges: [CKSyncEngine.PendingDatabaseChange]) {
      self._pendingDatabaseChanges.withValue {
        $0.subtract(pendingDatabaseChanges)
      }
    }
  }

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  extension SyncEngine {
    package struct SendRecordsCallback {
      fileprivate let operation: @Sendable () async -> Void
      package func receive() async {
        await operation()
      }
    }

    package func sendPendingRecordZoneChanges(
      options: CKSyncEngine.SendChangesOptions = CKSyncEngine.SendChangesOptions(),
      scope: CKDatabase.Scope,
      forceAtomicByZone: Bool? = nil,
      fileID: StaticString = #fileID,
      filePath: StaticString = #filePath,
      line: UInt = #line,
      column: UInt = #column
    ) async throws -> SendRecordsCallback {
      let syncEngine = syncEngine(for: scope)
      guard !syncEngine.state.pendingRecordZoneChanges.isEmpty
      else {
        reportIssue(
          "Processing empty set of record zone changes.",
          fileID: fileID,
          filePath: filePath,
          line: line,
          column: column
        )
        return SendRecordsCallback {}
      }
      guard try await container.accountStatus() == .available
      else {
        reportIssue(
          """
          User must be logged in to process pending changes.
          """,
          fileID: fileID,
          filePath: filePath,
          line: line,
          column: column
        )
        return SendRecordsCallback {}
      }

      var batch = await nextRecordZoneChangeBatch(
        reason: .scheduled,
        options: options,
        syncEngine: {
          switch scope {
          case .private:
            self.private
          case .shared:
            self.shared
          case .public:
            fatalError("Public database not supported in tests.")
          @unknown default:
            fatalError("Unknown database scope not supported in tests.")
          }
        }()
      )
      if let forceAtomicByZone {
        batch?.atomicByZone = forceAtomicByZone
      }
      guard let batch
      else {
        return SendRecordsCallback {}
      }

      let (saveResults, deleteResults) = try syncEngine.database.modifyRecords(
        saving: batch.recordsToSave,
        deleting: batch.recordIDsToDelete,
        savePolicy: .ifServerRecordUnchanged,
        atomically: batch.atomicByZone
      )

      var savedRecords: [CKRecord] = []
      var failedRecordSaves: [(record: CKRecord, error: CKError)] = []
      var deletedRecordIDs: [CKRecord.ID] = []
      var failedRecordDeletes: [CKRecord.ID: CKError] = [:]
      for (recordID, result) in saveResults {
        switch result {
        case .success(let record):
          savedRecords.append(record)
        case .failure(let error as CKError):
          guard let record = batch.recordsToSave.first(where: { $0.recordID == recordID })
          else { fatalError("\(recordID.debugDescription) not found in pending changes") }
          failedRecordSaves.append((record: record, error: error))
        case .failure:
          fatalError("Mocks should only raise 'CKError' values.")
        }
      }
      for (recordID, result) in deleteResults {
        switch result {
        case .success:
          deletedRecordIDs.append(recordID)
        case .failure(let error as CKError):
          failedRecordDeletes[recordID] = error
        case .failure:
          fatalError("Mocks should only raise 'CKError' values.")
        }
      }
      syncEngine.state.remove(
        pendingRecor
```

### Core Architecture Module: `Sources/SQLiteData/CloudKit/Internal/StateSerialization.swift`
```
#if canImport(CloudKit)
  package import CloudKit
#if EXCLUDE_EXPORTS
  package import StructuredQueries
#endif

  @Table("sqlitedata_icloud_stateSerialization")
  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  package struct StateSerialization {
    @Column(as: CKDatabase.Scope.RawValueRepresentation.self, primaryKey: true)
    package var scope: CKDatabase.Scope
    @Column(as: CKSyncEngine.State.Serialization.JSONRepresentation.self)
    package var data: CKSyncEngine.State.Serialization
  }
#endif

```

### Core Architecture Module: `Sources/SQLiteData/CloudKit/Internal/SyncEngine.Event.swift`
```
#if canImport(CloudKit)
  package import CloudKit

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  extension SyncEngine {
    package enum Event: CustomStringConvertible, Sendable {
      case stateUpdate(stateSerialization: CKSyncEngine.State.Serialization)
      case accountChange(changeType: CKSyncEngine.Event.AccountChange.ChangeType)
      case fetchedDatabaseChanges(
        modifications: [CKRecordZone.ID],
        deletions: [(zoneID: CKRecordZone.ID, reason: CKDatabase.DatabaseChange.Deletion.Reason)]
      )
      case fetchedRecordZoneChanges(
        modifications: [CKRecord],
        deletions: [(recordID: CKRecord.ID, recordType: CKRecord.RecordType)]
      )
      case sentDatabaseChanges(
        savedZones: [CKRecordZone],
        failedZoneSaves: [(zone: CKRecordZone, error: CKError)],
        deletedZoneIDs: [CKRecordZone.ID],
        failedZoneDeletes: [CKRecordZone.ID: CKError]
      )
      case sentRecordZoneChanges(
        savedRecords: [CKRecord],
        failedRecordSaves: [(record: CKRecord, error: CKError)],
        deletedRecordIDs: [CKRecord.ID],
        failedRecordDeletes: [CKRecord.ID: CKError]
      )
      case willFetchChanges
      case willFetchRecordZoneChanges(zoneID: CKRecordZone.ID)
      case didFetchChanges
      case didFetchRecordZoneChanges(zoneID: CKRecordZone.ID, error: CKError?)
      case willSendChanges(context: CKSyncEngine.SendChangesContext)
      case didSendChanges(context: CKSyncEngine.SendChangesContext)

      init?(_ event: CKSyncEngine.Event) {
        switch event {
        case .stateUpdate(let event):
          self = .stateUpdate(stateSerialization: event.stateSerialization)
        case .accountChange(let event):
          self = .accountChange(changeType: event.changeType)
        case .fetchedDatabaseChanges(let event):
          self = .fetchedDatabaseChanges(
            modifications: event.modifications.map(\.zoneID),
            deletions: event.deletions.map { (zoneID: $0.zoneID, reason: $0.reason) }
          )
        case .fetchedRecordZoneChanges(let event):
          self = .fetchedRecordZoneChanges(
            modifications: event.modifications.map(\.record),
            deletions: event.deletions.map {
              (recordID: $0.recordID, recordType: $0.recordType)
            }
          )
        case .sentDatabaseChanges(let event):
          self = .sentDatabaseChanges(
            savedZones: event.savedZones,
            failedZoneSaves: event.failedZoneSaves.map { (zone: $0.zone, error: $0.error) },
            deletedZoneIDs: event.deletedZoneIDs,
            failedZoneDeletes: event.failedZoneDeletes
          )
        case .sentRecordZoneChanges(let event):
          self = .sentRecordZoneChanges(
            savedRecords: event.savedRecords,
            failedRecordSaves: event.failedRecordSaves.map { (record: $0.record, error: $0.error) },
            deletedRecordIDs: event.deletedRecordIDs,
            failedRecordDeletes: event.failedRecordDeletes
          )
        case .willFetchChanges:
          self = .willFetchChanges
        case .willFetchRecordZoneChanges(let event):
          self = .willFetchRecordZoneChanges(zoneID: event.zoneID)
        case .didFetchChanges:
          self = .didFetchChanges
        case .didFetchRecordZoneChanges(let event):
          self = .didFetchRecordZoneChanges(zoneID: event.zoneID, error: event.error)
        case .willSendChanges(let event):
          self = .willSendChanges(context: event.context)
        case .didSendChanges(let event):
          self = .didSendChanges(context: event.context)
        @unknown default:
          return nil
        }
      }

      package var description: String {
        switch self {
        case .stateUpdate: "stateUpdate"
        case .accountChange: "accountChange"
        case .fetchedDatabaseChanges: "fetchedDatabaseChanges"
        case .fetchedRecordZoneChanges: "fetchedRecordZoneChanges"
        case .sentDatabaseChanges: "sentDatabaseChanges"
        case .sentRecordZoneChanges: "sentRecordZoneChanges"
        case .willFetchChanges: "willFetchChanges"
        case .willFetchRecordZoneChanges: "willFetchRecordZoneChanges"
        case .didFetchRecordZoneChanges: "didFetchRecordZoneChanges"
        case .didFetchChanges: "didFetchChanges"
        case .willSendChanges: "willSendChanges"
        case .didSendChanges: "didSendChanges"
        }
      }
    }
  }
#endif

```

### Core Architecture Module: `Sources/SQLiteData/CloudKit/Internal/SyncEngineProtocol+Live.swift`
```
#if canImport(CloudKit)
  public import CloudKit

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  extension CKSyncEngine: SyncEngineProtocol {
    package func recordZoneChangeBatch(
      pendingChanges: [PendingRecordZoneChange],
      recordProvider: @Sendable (CKRecord.ID) async -> CKRecord?
    ) async -> RecordZoneChangeBatch? {
      await CKSyncEngine
        .RecordZoneChangeBatch(pendingChanges: pendingChanges, recordProvider: recordProvider)
    }
  }

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  extension CKSyncEngine.State: CKSyncEngineStateProtocol {
  }
#endif

```

### Core Architecture Module: `Sources/SQLiteData/CloudKit/Internal/SyncEngineProtocol.swift`
```
#if canImport(CloudKit)
  package import CloudKit

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  package protocol SyncEngineProtocol<Database, State>: AnyObject, Sendable {
    associatedtype State: CKSyncEngineStateProtocol
    associatedtype Database: CloudDatabase

    var database: Database { get }
    var state: State { get }

    func cancelOperations() async
    func fetchChanges(_ options: CKSyncEngine.FetchChangesOptions) async throws
    func recordZoneChangeBatch(
      pendingChanges: [CKSyncEngine.PendingRecordZoneChange],
      recordProvider: @Sendable (CKRecord.ID) async -> CKRecord?
    ) async -> CKSyncEngine.RecordZoneChangeBatch?
    func sendChanges(_ options: CKSyncEngine.SendChangesOptions) async throws
  }

  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  package protocol CKSyncEngineStateProtocol: Sendable {
    var pendingRecordZoneChanges: [CKSyncEngine.PendingRecordZoneChange] { get }
    var pendingDatabaseChanges: [CKSyncEngine.PendingDatabaseChange] { get }
    func add(pendingRecordZoneChanges: [CKSyncEngine.PendingRecordZoneChange])
    func remove(pendingRecordZoneChanges: [CKSyncEngine.PendingRecordZoneChange])
    func add(pendingDatabaseChanges: [CKSyncEngine.PendingDatabaseChange])
    func remove(pendingDatabaseChanges: [CKSyncEngine.PendingDatabaseChange])
  }
#endif

```

### Core Architecture Module: `Sources/SQLiteData/CloudKit/SyncEngine.swift`
```
#if canImport(CloudKit)
  public import CloudKit
  package import ConcurrencyExtras
  import Dependencies
  public import GRDB
  public import IssueReporting
  import OrderedCollections
  public import OSLog
  import Observation
  public import StructuredQueries
  import StructuredQueriesSQLite
  #if EXCLUDE_EXPORTS
    public import StructuredQueriesSQLiteCore
  #endif
  import SwiftData
  import TabularData

  #if canImport(UIKit)
    import UIKit
  #endif

  /// An object that manages the synchronization of local and remote SQLite data.
  ///
  /// See <doc:CloudKitSync> for more information.
  @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
  public final class SyncEngine: Observable, Sendable {
    package let userDatabase: UserDatabase
    package let logger: Logger
    package let metadatabase: any DatabaseWriter
    package let tables: [any SynchronizableTable]
    package let privateTables: [any SynchronizableTable]
    let tablesByName: [String: any SynchronizableTable]
    package let tablesByOrder: [String: Int]
    let foreignKeysByTableName: [String: [ForeignKey]]
    package let syncEngines = LockIsolated<SyncEngines>(SyncEngines())
    package let defaultZone: CKRecordZone
    let delegate: (any SyncEngineDelegate)?
    let defaultSyncEngines:
      @Sendable (any DatabaseReader, SyncEngine)
        -> (private: any SyncEngineProtocol, shared: any SyncEngineProtocol)
    package let container: any CloudContainer
    let dataManager = Dependency(\.dataManager)
    private let observationRegistrar = ObservationRegistrar()
    private let notificationsObserver = LockIsolated<(any NSObjectProtocol)?>(nil)
    private let activityCounts = LockIsolated(ActivityCounts())
    private let startTask = LockIsolated<Task<Void, Never>?>(nil)
    #if DEBUG && canImport(DeveloperToolsSupport)
      private let previewTimerTask = LockIsolated<Task<Void, Never>?>(nil)
    #endif

    /// The error message used when a write occurs to a record for which the current user does not
    /// have permission.
    ///
    /// This error is thrown from any database write to a row for which the current user does
    /// not have permissions to write, as determined by its `CKShare` (if applicable). To catch
    /// this error try casting it to `DatabaseError` and checking its message:
    ///
    /// ```swift
    /// do {
    ///   try await database.write { db in
    ///     Reminder.find(id)
    ///       .update { $0.title = "Personal" }
    ///       .execute(db)
    ///   }
    /// } catch let error as DatabaseError where error.message == SyncEngine.writePermissionError {
    ///   // User does not have permission to write to this record.
    /// }
    /// ```
    public static let writePermissionError =
      "co.pointfree.SQLiteData.CloudKit.write-permission-error"
    public static let invalidRecordNameError =
      "co.pointfree.SQLiteData.CloudKit.invalid-record-name-error"

    /// Initialize a sync engine.
    ///
    /// - Parameters:
    ///   - database: The database to synchronize to CloudKit.
    ///   - tables: A list of tables that you want to synchronize _and_ that you want to be
    ///     shareable with other users on CloudKit.
    ///   - privateTables: A list of tables that you want to synchronize to CloudKit but that
    ///     you do not want to be shareable with other users.
    ///   - containerIdentifier: The container identifier in CloudKit to synchronize to. If omitted
    ///     the container will be determined from the entitlements of your app.
    ///   - defaultZone: The zone for all records to be stored in.
    ///   - startImmediately: Determines if the sync engine starts right away or requires an
    ///     explicit call to ``start()``. By default this argument is `true`.
    ///   - delegate: A delegate object that can be notified of events and override default sync
    ///     engine behavior.
    ///   - logger: The logger used to log events in the sync engine. By default a `.disabled`
    ///     logger is used, which means logs are not printed.
    public convenience init<
      each T1: PrimaryKeyedTable & _SendableMetatype,
      each T2: PrimaryKeyedTable & _SendableMetatype
    >(
      for database: any DatabaseWriter,
      tables: repeat (each T1).Type,
      privateTables: repeat (each T2).Type,
      containerIdentifier: String? = nil,
      defaultZone: CKRecordZone = CKRecordZone(zoneName: "co.pointfree.SQLiteData.defaultZone"),
      startImmediately: Bool? = nil,
      delegate: (any SyncEngineDelegate)? = nil,
      logger: Logger = isTesting
        ? Logger(.disabled) : Logger(subsystem: "SQLiteData", category: "CloudKit")
    ) throws
    where
      repeat (each T1).PrimaryKey.QueryOutput: IdentifierStringConvertible,
      repeat (each T1).TableColumns.PrimaryColumn: WritableTableColumnExpression,
      repeat (each T2).PrimaryKey.QueryOutput: IdentifierStringConvertible,
      repeat (each T2).TableColumns.PrimaryColumn: WritableTableColumnExpression
    {
      @Dependency(\.context) var context
      let containerIdentifier =
        containerIdentifier
        ?? ModelConfiguration(groupContainer: .automatic).cloudKitContainerIdentifier
        ?? (context != .live ? "container" : nil)
      var allTables: [any SynchronizableTable] = []
      var allPrivateTables: [any SynchronizableTable] = []
      for table in repeat each tables {
        allTables.append(SynchronizedTable(for: table))
      }
      for privateTable in repeat each privateTables {
        allPrivateTables.append(SynchronizedTable(for: privateTable))
      }
      let userDatabase = UserDatabase(database: database)

      guard context == .live
      else {
        let privateDatabase = MockCloudDatabase(databaseScope: .private)
        let sharedDatabase = MockCloudDatabase(databaseScope: .shared)
        let container = MockCloudContainer(
          containerIdentifier: containerIdentifier ?? "iCloud.co.pointfree.SQLiteData.Tests",
          privateCloudDatabase: privateDatabase,
          sharedCloudDatabase: sharedDatabase
        )
        privateDatabase.set(container: container)
        sharedDatabase.set(container: container)
        try self.init(
          container: container,
          defaultZone: defaultZone,
          defaultSyncEngines: { _, syncEngine in
            (
              private: MockSyncEngine(
                database: privateDatabase,
                parentSyncEngine: syncEngine,
                state: MockSyncEngineState()
              ),
              shared: MockSyncEngine(
                database: sharedDatabase,
                parentSyncEngine: syncEngine,
                state: MockSyncEngineState()
              )
            )
          },
          userDatabase: userDatabase,
          logger: logger,
          delegate: delegate,
          tables: allTables,
          privateTables: allPrivateTables
        )
        try setUpSyncEngine()
        if startImmediately ?? !isTesting {
          _ = try start()
        }
        return
      }

      guard let containerIdentifier else {
        throw SchemaError.noCloudKitContainer
      }

      let container = CKContainer(identifier: containerIdentifier)
      try self.init(
        container: container,
        defaultZone: defaultZone,
        defaultSyncEngines: { metadatabase, syncEngine in
          (
            private: CKSyncEngine(
              CKSyncEngine.Configuration(
                database: container.privateCloudDatabase,
                stateSerialization: try? metadatabase.read { db in
                  try StateSerialization
                    .find(#bind(.private))
                    .select(\.data)
                    .fetchOne(db)
                },
                delegate: syncEngine
              )
            ),
            shared: CKSyncEngine(
              CKSyncEngine.Configuration(
                database: container.sharedCloudDatabase,
                stateSerialization: try? metadatabase.read { db in
                  try StateSerialization
                    .find(#bind(.shared))
                    .select(\.data)
                    .fetchOne(db)
                },
                delegate: syncEngine
              )
            )
          )
        },
        userDatabase: userDatabase,
        logger: logger,
        delegate: delegate,
        tables: allTables,
        privateTables: allPrivateTables
      )
      try setUpSyncEngine()
      if startImmediately ?? !isTesting {
        _ = try start()
      }
    }

    package init(
      container: any CloudContainer,
      defaultZone: CKRecordZone,
      defaultSyncEngines:
        @escaping @Sendable (
          any DatabaseReader,
          SyncEngine
        ) -> (private: any SyncEngineProtocol, shared: any SyncEngineProtocol),
      userDatabase: UserDatabase,
      logger: Logger,
      delegate: (any SyncEngineDelegate)?,
      tables: [any SynchronizableTable],
      privateTables: [any SynchronizableTable] = []
    ) throws {
      let allTables = OrderedSet((tables + privateTables).map(HashableSynchronizedTable.init))
        .map(\.type)
      self.tables = allTables
      self.privateTables = privateTables
      self.delegate = delegate

      let foreignKeysByTableName = Dictionary(
        uniqueKeysWithValues: try userDatabase.read { db in
          try allTables.map { table -> (String, [ForeignKey]) in
            func open<T>(
              _: some SynchronizableTable<T>
            ) throws -> (String, [ForeignKey]) {
              (
                T.tableName,
                try PragmaForeignKeyList<T>
                  .join(PragmaTableInfo<T>.all) { $0.from.eq($1.name) }
                  .select {
                    ForeignKey.Columns(
                      table: $0.table,
                      from: $0.from,
                      to: $0.to,
                      onUpdate: $0.onUpdate,
                      onDelete: $0.onDelete,
                      isNotNull: $1.
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #539** (2026-08-29): **sqlite-data 1.11.1 does not compile against swift-structured-queries 0.38.0**
  *Symptoms*: ### Description  Looks like structured-queries 0.38.0 moved the `Table` constraint from `Select`'s `From` parameter to `SelectStatement` and it's causing an issue at `extension Select {`.  Seems like adding `where From: StructuredQueriesCore.Table` fixes it.  ### Checklist  - [x] I wrote this in my own words, and aimed to be as succinct as possible, even if I used AI to help research its content. - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] I have determined whether this bug is also reproducible in a vanilla GRDB project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/sqlite-data/issues) or [discussion](https://github.com/pointfreeco/sqlite-data/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproducing project  _No response_  ### SQLiteData version information  1.11.1  ### Sharing version information  _No response_  ### GRDB version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  26.6  ### Swift Compiler version information  ```shell swift-driver version: 1.148.6 Apple Swift version 6.3.3 (swiftlang-6.3.3.1.3 clang-2100.1.1.101) Target: arm64-apple-macosx26.0 ```

- **Issue #509** (2026-07-28): **Issue recorded in `MyDelegate.deinit` crashes individual test runs in Xcode 27**
  *Symptoms*: ## Description  `SyncEngineDelegateTests.accountChanged` injects its delegate through a test trait:  ```swift @Test($syncEngineDelegate.set(MyDelegate())) func accountChanged() async throws { … } ```  Trait values seem to be constructed during test planning, so the `MyDelegate` instance is created for every run, including runs where `accountChanged` is not included.  In those runs the instance is discarded during planning, its `deinit` finds `wasCalled == false`, and records an issue outside of any running test:  ```swift deinit {   guard wasCalled.withValue(\.self)   else {     Issue.record("Delegate method 'syncEngine(_:accountChanged:)' was not called.")     return   } } ```  ## Consequences  In Xcode 27 (beta 3 and beta 4), running any individual test or suite from this package crashes the test runner, while the full suite runs fine. It seems that the crash happens when Xcode processes the issue recorded outside of a test, though it's unclear whether it's meant to handle that at all. Under `swift test` it seems to work fine.  The issue was initially observed while working on #508, although it’s unrelated.  ## Reproduction  On `main`, with Xcode 27 beta 3 or 4:  ```sh xcodebuild test -scheme sqlite-data-Package -destination 'platform=macOS' \   -only-testing:SQLiteDataTests/UserlandTests ```  fails with `Exceeded max restart count of 2. (Underlying Error: Crash: xctest at ABI.EncodedEvent.encode(to:))`.  ---  *Disclaimer: AI assistance (Claude Code with Fable model) was us
  **Post-Mortem & Fix Analysis**:
  > Think we got a fix here #511 
  > It got fixed in [ConcurrencyExtras 1.4.1](https://github.com/pointfreeco/swift-concurrency-extras/releases/tag/1.4.1). Should we close or wait until the library pins this version?
  > Yep will close, and I don't think we will pin it. It mostly only affects us, not people using SQLiteData, and people can always pin to a newer ConcurrencyExtras if they need.

- **Issue #493** (2026-07-13): **While the SyncUps app works on my IPhone, my simple test app shows <decode: bad range for [%@] got [offs:266 len:1104 within:0]> in the log**
  *Symptoms*: ### Description  I created a simple app (after my more complicated app shows the same error) to check if the error is reproducable.  The app contains only a single table with an ID and a text field. The iCloud container has been created, and the code for it should be correct. The specific zone co.pointfree... has also been created. However, when I try to insert data into the table, I always get the error message <decode: bad range...> in the log, and no data is written to the container.  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] I have determined whether this bug is also reproducible in a vanilla GRDB project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/sqlite-data/issues) or [discussion](https://github.com/pointfreeco/sqlite-data/discussions).  ### Expected behavior  sync data to the ICloud container  ### Actual behavior  When installing the app, everything looks fine in the log, but when I try to insert data into the table, I always get the error message <decode: bad range...> in the log, and no data is written to the container.   Log, when inserting: SQLiteData (private.db) stateUpdate SQLiteData (private.db) willFetchChanges SQLiteData (private.db) stateUpdate SQLiteData (private.db) didFetchChanges SQLiteData (private.db) willSendChanges **<decode: bad range for
  **Post-Mortem & Fix Analysis**:
  > I made a test with a different combination of packages, it works with the first combination, but not with the second.  Working package combination  <img width="560" height="722" alt="Image" src="https://github.com/user-attachments/assets/d77ceeae-40d2-4e06-be9c-4fc8d9d019f3" />  not working package combination  <img width="524" height="714" alt="Image" src="https://github.com/user-attachments/assets/928f2629-8d83-41de-8908-9a6e729a7f1e" />
  > I encountered the same issue in the CloudKitDemo example app from the sqlite-data 1.6.6 zip. After some investigation, I was able to narrow down the problem.  The issue appears when swift-structured-queries is updated to 0.33.1. Downgrading it back to 0.33.0 restores CloudKit sync functionality.  Destination operating system iOS 26.5.1  Xcode version information Version 26.4 (17E192)  Working package combination <img width="298" height="456" alt="Image" src="https://github.com/user-attachments/assets/cb9e9c53-3982-49a3-8cf9-ffc16e54b289" />  not working package combination <img width="331" height="472" alt="Image" src="https://github.com/user-attachments/assets/3286b912-bb4e-4dab-92e2-038d385f9bc2" />  Workaround: Add swift-structured-queries as an explicit dependency in your project's Package Dependencies with Exact Version 0.33.0. 
  > Hi @qedqed6, thanks for the report! This is a dupe of #492 so you can follow that issue for more information. Going to close this out for now.

- **Issue #484** (2026-07-13): **Support Date encoding with sub-millisecond precision**
  *Symptoms*: ### Description  Currently, Date is recorded a [String with millisecond precision](https://github.com/pointfreeco/sqlite-data/blob/672124e8ae934309ba7d801b5b52dd6072ed42b2/Sources/SQLiteData/Internal/ISO8601.swift#L15) (for most modern devices).  For applications expecting greater precision (e.g., Dates compared to nanosecond precision in existing logic), custom `@Column` and `#bind` work, but require dashes of ceremony everywhere.  Avoiding that ceremony is possible if these formatters could output by default (or as an option) with greater precision.  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] I have determined whether this bug is also reproducible in a vanilla GRDB project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/sqlite-data/issues) or [discussion](https://github.com/pointfreeco/sqlite-data/discussions).  ### Expected behavior  Record Date with same precision as default JSONEncoder/Decoder behavior.  ### Actual behavior  Rounded millisecond precision  ### SQLiteData version information  1.6.6 
  **Post-Mortem & Fix Analysis**:
  > Hi @importRyan, are you sure that SQLite supports sub-millisecond precision in dates? As far as I can tell it's just milliseconds.  Since this is not directly an issue with the library, and more of a feature request / discussion, I am going to convert it to a discussion. Let's continue the conversation over there and then we can decide if there is something new that needs to be added to the library.

- **Issue #481** (2026-06-27): **Compiler crash on Xcode 27 (b2)**
  *Symptoms*: ### Description  ```Begin Error in Function: '$s10SQLiteData18StateSerializationV12TableColumnsV08writableF0Say21StructuredQueriesCore08WritableE16ColumnExpression_pGvgZ' Error! Found a leaked owned value that was never consumed. Value:   %21 = apply %14(%10, %11, %12, %13) : $@convention(method) (Builtin.RawPointer, Builtin.Word, Builtin.Int1, @thin String.Type) -> @owned String  End Error in Function: '$s10SQLiteData18StateSerializationV12TableColumnsV08writableF0Say21StructuredQueriesCore08WritableE16ColumnExpression_pGvgZ' Found ownership error?! <unknown>:0: error: fatal error encountered during compilation; please submit a bug report (https://swift.org/contributing/#reporting-bugs) <unknown>:0: note: triggering standard assertion failure routine ```  Distinct from #478.  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [x] I have determined whether this bug is also reproducible in a vanilla GRDB project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/sqlite-data/issues) or [discussion](https://github.com/pointfreeco/sqlite-data/discussions).  ### Expected behavior  Compiles  ### Actual behavior  Errors out.  ### Reproducing project  _No response_  ### SQLiteData version information  _No response_  ### Sharing version information  _No response_  ### GRDB version information  
  **Post-Mortem & Fix Analysis**:
  > Going to close this out and move to https://github.com/pointfreeco/swift-structured-queries

- **Issue #478** (2026-06-11): **Crash when archiving using Xcode 27 beta 1**
  *Symptoms*: ### Description  Create a new Xcode project, only import SqliteData (1.6.5) as the package. Set it to Mac target, and then Archive  (Note: Debug build works)  It shows an error: ``` Begin Error in Function: '$s10SQLiteData18StateSerializationV12TableColumnsV08writableF0Say21StructuredQueriesCore08WritableE16ColumnExpression_pGvgZ' Error! Found a leaked owned value that was never consumed. Value:   %21 = apply %14(%10, %11, %12, %13) : $@convention(method) (Builtin.RawPointer, Builtin.Word, Builtin.Int1, @thin String.Type) -> @owned String  End Error in Function: '$s10SQLiteData18StateSerializationV12TableColumnsV08writableF0Say21StructuredQueriesCore08WritableE16ColumnExpression_pGvgZ' Found ownership error?! <unknown>:0: error: fatal error encountered during compilation; please submit a bug report (https://swift.org/contributing/#reporting-bugs) <unknown>:0: note: triggering standard assertion failure routine ```  <img width="2050" height="300" alt="Image" src="https://github.com/user-attachments/assets/0e8c807a-d7a5-48ae-9962-1e6cfe150afb" />  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] I have determined whether this bug is also reproducible in a vanilla GRDB project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/sqlite-data/issues) or [discussion](https://github.com/p
  **Post-Mortem & Fix Analysis**:
  > So the reason seems to be the beta optimizer. When I hand-expand the @Table macro and use `optimize(none)` on all computed properties returning `[any StructuredQueriesCore.TableColumnExpression]` I can successfully archive.  ```swift // StateSerialization.TableColumns @_optimize(none) public static var allColumns: [any StructuredQueriesCore.TableColumnExpression] {   var allColumns: [any StructuredQueriesCore.TableColumnExpression] = []   allColumns.append(contentsOf: QueryValue.columns.scope._allColumns)   allColumns.append(contentsOf: QueryValue.columns.data._allColumns)   return allColumns } @_optimize(none) public static var writableColumns: [any StructuredQueriesCore.WritableTableColumnExpression] {   var writableColumns: [any StructuredQueriesCore.WritableTableColumnExpression] = []   writableColumns.append(contentsOf: QueryValue.columns.scope._writableColumns)   writableColumns.append(contentsOf: QueryValue.columns.data._writableColumns)   return writableColumns } // ... // Stat
  > FWIW the line(s) that cause the problem are these in the expansion:  ```swift     public static var allColumns: [any StructuredQueriesCore.TableColumnExpression] {         var allColumns: [any StructuredQueriesCore.TableColumnExpression] = []         allColumns.append(contentsOf: QueryValue.columns.scope._allColumns)  👈         allColumns.append(contentsOf: QueryValue.columns.data._allColumns)         return allColumns     }     public static var writableColumns: [any StructuredQueriesCore.WritableTableColumnExpression] {         var writableColumns: [any StructuredQueriesCore.WritableTableColumnExpression] = []         writableColumns.append(contentsOf: QueryValue.columns.scope._writableColumns)  👈         writableColumns.append(contentsOf: QueryValue.columns.data._writableColumns)         return writableColumns     } ```  Seems to be related to `scope` being a primary key. Still digging into the problem to see if there's an easy workaround and a simple reduction that can be reporte
  > Should be fixed when you bump to https://github.com/pointfreeco/swift-structured-queries/releases/tag/0.31.2

- **Issue #472** (2026-06-06): **Main build with SQLiteDataTagged broke after InternalImportsByDefault**
  *Symptoms*: ### Description  When referencing the library using the `main` branch, and having the `SQLiteDataTagged` trait enabled, the project doesn't compile.   The error is `Cannot declare a public initializer in an extension with internal requirements` in the file `Tagged/Tagged.swift`.   Probably an oversight when @mbrandonw  enabled `InternalImportsByDefault` in commit `36137afbb71e4ee3519a94d7ce765002a62be596`  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] I have determined whether this bug is also reproducible in a vanilla GRDB project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/sqlite-data/issues) or [discussion](https://github.com/pointfreeco/sqlite-data/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproducing project  ```swift .package(       url: "https://github.com/pointfreeco/sqlite-data",       branch: "main",       traits: [         .trait(name: "SQLiteDataTagged")       ]     ), ```  ### SQLiteData version information  f58d5d4cd4f1fc417e9e0144d7e8f019cb49cdc4 -> latest main  ### Sharing version information  _No response_  ### GRDB version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell 6.3.2 ```
  **Post-Mortem & Fix Analysis**:
  > <img width="856" height="271" alt="Image" src="https://github.com/user-attachments/assets/9a31b0fa-ef1a-46ce-9340-c9b72de96e9e" />

- **Issue #469** (2026-06-04): **Using the library on TvOS fails**
  *Symptoms*: ### Description  When setting up a SQL database on tvOS, I always get an error `You don’t have permission to save the file “Application Support” in the folder “Library”.`  `Error Domain=NSCocoaErrorDomain Code=513`  Looking at the code I realize, in many places the library attempt to create  ``` swift try FileManager.default.createDirectory(       at: .applicationSupportDirectory,       withIntermediateDirectories: true     ) ``` like in `Metadatabase.swift`, `SyncEngine.swift` and in `DefaultDatabase.swift` These calls will always fail because tvOS apps can't have a support directory.  When I switch to in memory database, some of the errors disappear except the SyncEngine's. When called, the SyncEngine will try to create a `defaultMetadatabase` that in turn will try to create the `applicationSupportDirectory`. This will throw and the entire sync engine initialization fails.  For tvOS I think the best case scenario is to use `.cachesDirectory` and if the OS purges it, then on next App launch all data will be re-downloaded from iCloud.  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] I have determined whether this bug is also reproducible in a vanilla GRDB project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/sqlite-data/issues) or [discussion](https://github.com/pointfreeco
  **Post-Mortem & Fix Analysis**:
  > Hi @joseph-elmallah, I believe those calls to `FileManager.default.createDirectory` are just old and can be deleted. The way it should work now is that if you provide a URL when creating your database then we do not need to create the application support directory and we just use the URL you provide. Further, the metadatabase is stored right next to the main database, and so again we don't need to create the application support directory.  Want to delete those lines and test that everything works as expected, and if so, draft a PR?
  > @mbrandonw I opened a [PR](https://github.com/pointfreeco/sqlite-data/pull/470)

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

### Incident Patch 1: `f6bd67aa` (2026-08-19)
**Commit Message**: Fix database-access (#409)

Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>

**File**: `Sources/SQLiteData/CloudKit/CloudKitSharing.swift` (modified, +1/-1)
```diff
@@ -179,7 +179,7 @@
         )
 
       configure(sharedRecord)
-      let (saveResults, _) = try await container.privateCloudDatabase.modifyRecords(
+      let (saveResults, _) = try await container.database(for: sharedRecord.recordID).modifyRecords(
         saving: [sharedRecord, lastKnownServerRecord],
         deleting: []
       )
```

---

### Incident Patch 2: `a9c51726` (2026-08-19)
**Commit Message**: Wrap `@Fetch*` state in SwiftUI's `@State` when possible (#504)

* Add case studies for SwiftUI issue

* @State fix

* FetchBox

* wip

* New integration target

* wip

* fix

* wip

* cleanup

* Add some prints to make it clear queries are not being executed.

* wip

---------

Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>

**File**: `Examples/Examples.xcodeproj/project.pbxproj` (modified, +171/-34)
```diff
@@ -3,22 +3,24 @@
 	archiveVersion = 1;
 	classes = {
 	};
-	objectVersion = 100;
+	objectVersion = 77;
 	objects = {
 
 /* Begin PBXBuildFile section */
 		CA14DBC92DA884C400E36852 /* CasePaths in Frameworks */ = {isa = PBXBuildFile; productRef = CA14DBC82DA884C400E36852 /* CasePaths */; };
 		CA2908C92D4AF70E003F165F /* UIKitNavigation in Frameworks */ = {isa = PBXBuildFile; productRef = CA2908C82D4AF70E003F165F /* UIKitNavigation */; };
 		CA2BDE2A2E71C469000974D3 /* SQLiteData in Frameworks */ = {isa = PBXBuildFile; productRef = CA2BDE292E71C469000974D3 /* SQLiteData */; };
-		CA2BDE2C2E71C472000974D3 /* SQLiteData in Frameworks */ = {isa = PBXBuildFile; productRef = CA2BDE2B2E71C472000974D3 /* SQLiteData */; };
-		CA2BDE2E2E71C479000974D3 /* SQLiteData in Frameworks */ = {isa = PBXBuildFile; productRef = CA2BDE2D2E71C479000974D3 /* SQLiteData */; };
-		CA2BDE302E71C480000974D3 /* SQLiteData in Frameworks */ = {isa = PBXBuildFile; productRef = CA2BDE2F2E71C480000974D3 /* SQLiteData */; };
 		CA5E46912DEBB8570069E0F8 /* SwiftUINavigation in Frameworks */ = {isa = PBXBuildFile; productRef = CA5E46902DEBB8570069E0F8 /* SwiftUINavigation */; };
 		CA5E47072DECEF0F0069E0F8 /* InlineSnapshotTesting in Frameworks */ = {isa = PBXBuildFile; productRef = CA5E47062DECEF0F0069E0F8 /* InlineSnapshotTesting */; };
 		CA5E47092DECEFC80069E0F8 /* SnapshotTestingCustomDump in Frameworks */ = {isa = PBXBuildFile; productRef = CA5E47082DECEFC80069E0F8 /* SnapshotTestingCustomDump */; };
 		CA5E470B2DECF0280069E0F8 /* DependenciesTestSupport in Frameworks */ = {isa = PBXBuildFile; productRef = CA5E470A2DECF0280069E0F8 /* DependenciesTestSupport */; };
 		CAD001872D874F1F00FA977A /* DependenciesTestSupport in Frameworks */ = {isa = PBXBuildFile; productRef = CAD001862D874F1F00FA977A /* DependenciesTestSupport */; };
 		DC5FA7482D4C63D60082743E /* DependenciesMacros in Frameworks */ = {isa = PBXBuildFile; productRef = DC5FA7472D4C63D60082743E /* DependenciesMacros */; };
+		DCB8AD4A30363D3800ACF09E /* SQLiteData in Frameworks */ = {isa = PBXBuildFile; productRef = DCB8AD4930363D3800ACF09E /* SQLiteData */; };
+		DCB8AD4C30363DB100ACF09E /* UIKitNavigation in Frameworks */ = {isa = PBXBuildFile; productRef = DCB8AD4B30363DB100ACF09E /* UIKitNavigation */; };
+		DCB8AD4E30363F2100ACF09E /* SQLiteData in Frameworks */ = {isa = PBXBuildFile; productRef = DCB8AD4D30363F2100ACF09E /* SQLiteData */; };
+		DCB8AD5030363F2600ACF09E /* SQLiteData in Frameworks */ = {isa = PBXBuildFile; productRef = DCB8AD4F30363F2600ACF09E /* SQLiteData */; };
+		DCB8AD5230363F2A00ACF09E /* SQLiteData in Frameworks */ = {isa = PBXBuildFile; productRef = DCB8AD5130363F2A00ACF09E /* SQLiteData */; };
 		DCBE8A142D4842BF0071F499 /* CasePaths in Frameworks */ = {isa = PBXBuildFile; productRef = DCBE8A132D4842BF0071F499 /* CasePaths */; };
 		DCF267392D48437300B680BE /* SwiftUINavigation in Frameworks */ = {isa = PBXBuildFile; productRef = DCF267382D48437300B680BE /* SwiftUINavigation */; };
 /* End PBXBuildFile section */
@@ -56,6 +58,8 @@
 		CAF836982D4735620047AEB5 /* CaseStudies.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = CaseStudies.app; sourceTree = BUILT_PRODUCTS_DIR; };
 		CAF836A82D4735640047AEB5 /* CaseStudiesTests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = CaseStudiesTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
 		CAF836D82D4735AB0047AEB5 /* Reminders.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Reminders.app; sourceTree = BUILT_PRODUCTS_DIR; };
+		DC1584A630363595009DD95C /* Integration.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Integration.app; sourceTree = BUILT_PRODUCTS_DIR; };
+		DC55FADE30363BB000F2D8D3 /* sqlite-data */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = "sqlite-data"; path = "/Users/stephen/Developer/pointfreeco/sqlite-data"; sourceTree = "<absolute>"; };
 		DCBE89CC2D483FB90071F499 /* SyncUps.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = SyncUps.app; sourceTree = BUILT_PRODUCTS_DIR; };
 /* End PBXFileReference section */
 
@@ -75,6 +79,14 @@
 			);
 			target = CAF836972D4735620047AEB5 /* CaseStudies */;
 		};
+		DC15854C303636A7009DD95C /* Exceptions for "CaseStudies" folder in "Integration" target */ = {
+			isa = PBXFileSystemSynchronizedBuildFileExceptionSet;
+			membershipExceptions = (
+				Internal/CaseStudy.swift,
+				"Internal/Text+Template.swift",
+			);
+			target = DC1584A530363595009DD95C /* Integration */;
+		};
 		DCA44CFA2D5D9D1E008D4E76 /* Exceptions for "Reminders" folder in "Reminders" target */ = {
 			isa = PBXFileSystemSynchronizedBuildFileExceptionSet;
 			membershipExceptions = (
@@ -116,6 +128,7 @@
 			isa = PBXFileSystemSynchronizedRootGroup;
 			exceptions = (
 				CAD4819A2D584B510004799A /* Excep
```

**File**: `Examples/Examples.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "c133bf7d10c8ce1e5d6506c3d2f080eac8b4c8c2827044d53a9b925e903564fd",
+  "originHash" : "c56e7b70de4fe8bcc798354797a8405c0eeb2e9bc68bc0f202c14a8b11a0a97f",
   "pins" : [
     {
       "identity" : "combine-schedulers",
@@ -24,8 +24,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-case-paths",
       "state" : {
-        "revision" : "206cbce3882b4de9aee19ce62ac5b7306cadd45b",
-        "version" : "1.7.3"
+        "revision" : "794f4b0a9cf32042592388d014f6a1ea987d323a",
+        "version" : "1.9.1"
       }
     },
     {
```

**File**: `Examples/Examples.xcodeproj/xcshareddata/xcschemes/CloudKitDemo.xcscheme` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
                BuildableIdentifier = "primary"
                BlueprintIdentifier = "CA2BDD9C2E71C30B000974D3"
                BuildableName = "CloudKitDemo.app"
+               BlueprintName = "CloudKitDemo"
                ReferencedContainer = "container:Examples.xcodeproj">
             </BuildableReference>
          </BuildActionEntry>
@@ -46,6 +47,7 @@
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "CA2BDD9C2E71C30B000974D3"
             BuildableName = "CloudKitDemo.app"
+            BlueprintName = "CloudKitDemo"
             ReferencedContainer = "container:Examples.xcodeproj">
          </BuildableReference>
       </BuildableProductRunnable>
@@ -62,6 +64,7 @@
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "CA2BDD9C2E71C30B000974D3"
             BuildableName = "CloudKitDemo.app"
+            BlueprintName = "CloudKitDemo"
             ReferencedContainer = "container:Examples.xcodeproj">
          </BuildableReference>
       </BuildableProductRunnable>
```

**File**: `Examples/Examples.xcodeproj/xcshareddata/xcschemes/Integration.xcscheme` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<Scheme
+   LastUpgradeVersion = "2700"
+   version = "1.7">
+   <BuildAction
+      parallelizeBuildables = "YES"
+      buildImplicitDependencies = "YES"
+      buildArchitectures = "Automatic">
+      <BuildActionEntries>
+         <BuildActionEntry
+            buildForTesting = "YES"
+            buildForRunning = "YES"
+            buildForProfiling = "YES"
+            buildForArchiving = "YES"
+            buildForAnalyzing = "YES">
+            <BuildableReference
+               BuildableIdentifier = "primary"
+               BlueprintIdentifier = "DC1584A530363595009DD95C"
+               BuildableName = "Integration.app"
+               ReferencedContainer = "container:Examples.xcodeproj">
+            </BuildableReference>
+         </BuildActionEntry>
+      </BuildActionEntries>
+   </BuildAction>
+   <TestAction
+      buildConfiguration = "Debug"
+      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
+      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
+      shouldUseLaunchSchemeArgsEnv = "YES"
+      shouldAutocreateTestPlan = "YES">
+   </TestAction>
+   <LaunchAction
+      buildConfiguration = "Debug"
+      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
+      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
+      launchStyle = "0"
+      useCustomWorkingDirectory = "NO"
+      ignoresPersistentStateOnLaunch = "NO"
+      debugDocumentVersioning = "YES"
+      debugServiceExtension = "internal"
+      allowLocationSimulation = "YES"
+      queueDebuggingEnabled = "No">
+      <BuildableProductRunnable
+         runnableDebuggingMode = "0">
+         <BuildableReference
+            BuildableIdentifier = "primary"
+            BlueprintIdentifier = "DC1584A530363595009DD95C"
+            BuildableName = "Integration.app"
+            ReferencedContainer = "container:Examples.xcodeproj">
+         </BuildableReference>
+      </BuildableProductRunnable>
+   </LaunchAction>
+   <ProfileAction
+      buildConfiguration = "Release"
+      shouldUseLaunchSchemeArgsEnv = "YES"
+      savedToolIdentifier = ""
+      useCustomWorkingDirectory = "NO"
+      debugDocumentVersioning = "YES">
+      <BuildableProductRunnable
+         runnableDebuggingMode = "0">
+         <BuildableReference
+            BuildableIdentifier = "primary"
+            BlueprintIdentifier = "DC1584A530363595009DD95C"
+            BuildableName = "Integration.app"
+            ReferencedContainer = "container:Examples.xcodeproj">
+         </BuildableReference>
+      </BuildableProductRunnable>
+   </ProfileAction>
+   <AnalyzeAction
+      buildConfiguration = "Debug">
+   </AnalyzeAction>
+   <ArchiveAction
+      buildConfiguration = "Release"
+      revealArchiveInOrganizer = "YES">
+   </ArchiveAction>
+</Scheme>
```

**File**: `Examples/Integration/Assets.xcassets/AccentColor.colorset/Contents.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "colors" : [
+    {
+      "idiom" : "universal"
+    }
+  ],
+  "info" : {
+    "author" : "xcode",
+    "version" : 1
+  }
+}
```

**File**: `Examples/Integration/Assets.xcassets/AppIcon.appiconset/Contents.json` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+{
+  "images" : [
+    {
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    },
+    {
+      "appearances" : [
+        {
+          "appearance" : "luminosity",
+          "value" : "dark"
+        }
+      ],
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    },
+    {
+      "appearances" : [
+        {
+          "appearance" : "luminosity",
+          "value" : "tinted"
+        }
+      ],
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    }
+  ],
+  "info" : {
+    "author" : "xcode",
+    "version" : 1
+  }
+}
```

**File**: `Examples/Integration/Assets.xcassets/Contents.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "info" : {
+    "author" : "xcode",
+    "version" : 1
+  }
+}
```

**File**: `Examples/Integration/IntegrationApp.swift` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+import SwiftUI
+
+@main
+struct IntegrationApp: App {
+  var body: some Scene {
+    WindowGroup {
+    }
+  }
+}
```

---

### Incident Patch 3: `e3d13c01` (2026-08-19)
**Commit Message**: Improved UUID decoding (#528)

**File**: `Sources/SQLiteData/StructuredQueries+GRDB/QueryCursor.swift` (modified, +0/-23)
```diff
@@ -277,29 +277,6 @@ extension String {
   }
 }
 
-extension UUID {
-  func withLowercasedUTF8Text<R>(_ body: (UnsafePointer<CChar>, Int32) -> R) -> R {
-    withUnsafeTemporaryAllocation(of: UInt8.self, capacity: 36) { utf8 in
-      withUnsafeBytes(of: uuid) { bytes in
-        var offset = 0
-        for (byteIndex, byte) in bytes.enumerated() {
-          if byteIndex == 4 || byteIndex == 6 || byteIndex == 8 || byteIndex == 10 {
-            utf8[offset] = UInt8(ascii: "-")
-            offset += 1
-          }
-          utf8[offset] = hexDigits[Int(byte >> 4)]
-          utf8[offset + 1] = hexDigits[Int(byte & 0xF)]
-          offset += 2
-        }
-      }
-      return utf8.baseAddress!.withMemoryRebound(to: CChar.self, capacity: 36) {
-        body($0, 36)
-      }
-    }
-  }
-}
-
-private let hexDigits = Array("0123456789abcdef".utf8)
 
 @usableFromInline
 struct Int64OverflowError: Error {
```

**File**: `Sources/SQLiteData/StructuredQueries+GRDB/SQLiteFunctionDecoder.swift` (modified, +16/-2)
```diff
@@ -147,8 +147,22 @@ struct SQLiteFunctionDecoder: QueryDecoder {
 
   @usableFromInline
   mutating func decode(_ columnType: UUID.Type) throws(QueryDecodingError) -> UUID? {
-    guard let uuidString = try decode(String.self) else { return nil }
-    return UUID(uuidString: uuidString)
+    precondition(argumentCount > currentIndex)
+    let value = arguments?[Int(currentIndex)]
+    switch sqlite3_value_type(value) {
+    case SQLITE_NULL:
+      currentIndex += 1
+      return nil
+    case SQLITE_TEXT:
+      break
+    default:
+      try reportTypeMismatch(UUID.self)
+    }
+    defer { currentIndex += 1 }
+    let text = sqlite3_value_text(value)
+    let byteCount = Int(sqlite3_value_bytes(value))
+    let utf8 = UnsafeBufferPointer(start: text, count: byteCount)
+    return UUID(uuidUTF8: utf8) ?? UUID(uuidString: String(decoding: utf8, as: UTF8.self))
   }
 
   @usableFromInline
```

**File**: `Sources/SQLiteData/StructuredQueries+GRDB/SQLiteQueryDecoder.swift` (modified, +16/-2)
```diff
@@ -125,8 +125,22 @@ struct SQLiteQueryDecoder: QueryDecoder {
 
   @inlinable
   mutating func decode(_ columnType: UUID.Type) throws(QueryDecodingError) -> UUID? {
-    guard let uuidString = try decode(String.self) else { return nil }
-    guard let uuid = UUID(uuidString: uuidString) else { throw .other(InvalidUUID()) }
+    switch sqlite3_column_type(statement, currentIndex) {
+    case SQLITE_NULL:
+      currentIndex += 1
+      return nil
+    case SQLITE_TEXT:
+      break
+    default:
+      try reportTypeMismatch(UUID.self)
+    }
+    defer { currentIndex += 1 }
+    let text = sqlite3_column_text(statement, currentIndex)
+    let byteCount = Int(sqlite3_column_bytes(statement, currentIndex))
+    let utf8 = UnsafeBufferPointer(start: text, count: byteCount)
+    if let uuid = UUID(uuidUTF8: utf8) { return uuid }
+    guard let uuid = UUID(uuidString: String(decoding: utf8, as: UTF8.self))
+    else { throw .other(InvalidUUID()) }
     return uuid
   }
 
```

**File**: `Sources/SQLiteData/StructuredQueries+GRDB/UUID+UUIDString.swift` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+public import Foundation
+
+extension UUID {
+  @usableFromInline
+  init?(uuidUTF8 utf8: UnsafeBufferPointer<UInt8>) {
+    guard utf8.count == 36 else { return nil }
+    var raw: uuid_t = (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
+    let parsed = withUnsafeMutableBytes(of: &raw) { bytes in
+      var index = 0
+      for byteIndex in 0..<16 {
+        if byteIndex == 4 || byteIndex == 6 || byteIndex == 8 || byteIndex == 10 {
+          guard utf8[index] == UInt8(ascii: "-") else { return false }
+          index += 1
+        }
+        guard let high = hexValue(utf8[index]), let low = hexValue(utf8[index + 1])
+        else { return false }
+        bytes[byteIndex] = high << 4 | low
+        index += 2
+      }
+      return true
+    }
+    guard parsed else { return nil }
+    self.init(uuid: raw)
+  }
+
+  func withLowercasedUTF8Text<R>(_ body: (UnsafePointer<CChar>, Int32) -> R) -> R {
+    withUnsafeTemporaryAllocation(of: UInt8.self, capacity: 36) { utf8 in
+      withUnsafeBytes(of: uuid) { bytes in
+        var offset = 0
+        for (byteIndex, byte) in bytes.enumerated() {
+          if byteIndex == 4 || byteIndex == 6 || byteIndex == 8 || byteIndex == 10 {
+            utf8[offset] = UInt8(ascii: "-")
+            offset += 1
+          }
+          utf8[offset] = hexDigits[Int(byte >> 4)]
+          utf8[offset + 1] = hexDigits[Int(byte & 0xF)]
+          offset += 2
+        }
+      }
+      return utf8.baseAddress!.withMemoryRebound(to: CChar.self, capacity: 36) {
+        body($0, 36)
+      }
+    }
+  }
+}
+
+private func hexValue(_ byte: UInt8) -> UInt8? {
+  switch byte {
+  case UInt8(ascii: "0")...UInt8(ascii: "9"): byte - UInt8(ascii: "0")
+  case UInt8(ascii: "a")...UInt8(ascii: "f"): byte - UInt8(ascii: "a") + 10
+  case UInt8(ascii: "A")...UInt8(ascii: "F"): byte - UInt8(ascii: "A") + 10
+  default: nil
+  }
+}
+
+private let hexDigits = Array("0123456789abcdef".utf8)
```

**File**: `Tests/SQLiteDataTests/UUIDTests.swift` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import DependenciesTestSupport
+import Foundation
+import SQLiteData
+import Testing
+
+@Suite(.dependency(\.defaultDatabase, try DatabaseQueue()))
+struct UUIDTests {
+  @Dependency(\.defaultDatabase) var database
+
+  @Test func `decode matches Foundation parsing`() throws {
+    try database.read { db in
+      for text in [
+        "deadbeef-dead-beef-dead-beefdeadbeef",
+        "DEADBEEF-DEAD-BEEF-DEAD-BEEFDEADBEEF",
+        "A1b2C3d4-E5f6-7890-aB12-Cd34eF567890",
+        "00000000-0000-0000-0000-000000000000",
+      ] {
+        let decoded = try #sql("SELECT \(bind: text)", as: UUID.self).fetchOne(db)
+        #expect(decoded == UUID(uuidString: text), "\(text)")
+      }
+    }
+  }
+
+  @Test func roundtrip() throws {
+    let uuid = UUID()
+    try database.read { db in
+      let decoded = try #sql("SELECT \(bind: uuid)", as: UUID.self).fetchOne(db)
+      #expect(decoded == uuid)
+    }
+  }
+}
```

---

### Incident Patch 4: `10d5c95a` (2026-08-03)
**Commit Message**: Fix in-memory metadatabase creation in `defaultMetadatabase` (#508)

* Fix in-memory metadatabase creation in defaultMetadatabase

* Shorten test comment

**File**: `Sources/SQLiteData/CloudKit/Internal/Metadatabase.swift` (modified, +12/-4)
```diff
@@ -27,10 +27,18 @@
 
     var metadatabaseConfiguration = Configuration()
     metadatabaseConfiguration.observesSuspensionNotifications = configuration.observesSuspensionNotifications
-    let metadatabase = try DatabasePool(
-      path: url.path(percentEncoded: false),
-      configuration: metadatabaseConfiguration
-    )
+    let metadatabase: any DatabaseWriter =
+      if url.isInMemory {
+        try DatabaseQueue(
+          path: url.absoluteString,
+          configuration: metadatabaseConfiguration
+        )
+      } else {
+        try DatabasePool(
+          path: url.path(percentEncoded: false),
+          configuration: metadatabaseConfiguration
+        )
+      }
     try migrate(metadatabase: metadatabase)
     return metadatabase
   }
```

**File**: `Tests/SQLiteDataTests/CloudKitTests/MetadatabaseTests.swift` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+#if canImport(CloudKit)
+  import Foundation
+  import GRDB
+  import OSLog
+  @testable import SQLiteData
+  import Testing
+
+  @Suite struct MetadatabaseTests {
+    @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
+    @Test func inMemoryMetadatabase() throws {
+      let url = try URL.metadatabase(databasePath: ":memory:", containerIdentifier: nil)
+      #expect(url.isInMemory)
+
+      let metadatabase = try defaultMetadatabase(
+        logger: Logger(subsystem: "test", category: "test"),
+        url: url,
+        configuration: Configuration()
+      )
+      let mainDatabaseFile = try metadatabase.read { db in
+        try String.fetchOne(db, sql: "SELECT file FROM pragma_database_list WHERE name = 'main'")
+      }
+      // Metadatabase is in-memory
+      #expect(mainDatabaseFile == "")
+    }
+  }
+#endif
```

---

### Incident Patch 5: `8921198b` (2026-07-27)
**Commit Message**: Work around Swift parameter pack bug in `@FetchAll(sectionBy:)` (#512)

* Work around Swift parameter pack bug in `@FetchAll(sectionBy:)`

Inline sectioned fetches don't currently work if the query includes a
join due to a parameter pack bug. We can work around it in a way similar
to workarounds present in StructuredQueries: overloads.

- `Joins == ()`
- `Joins: Table`
- `Joins == (repeat each J)`

* Organize

* Clean up overloads

* revert

* Add `Statement.fetchAll(sectionBy:)` (#513)

* Add `Statement.fetchAll(sectionBy:)`

A parallel story to `@FetchAll(sectionBy:)` for use in
`FetchKeyRequest`s.

* wip

* Key path overloads

* Apply suggestion from @mbrandonw

* Nest suites

---------

Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>
Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>

---------

Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>
Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>

**File**: `Package.resolved` (modified, +2/-2)
```diff
@@ -60,8 +60,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-dependencies",
       "state" : {
-        "revision" : "706feb7858a7f6c242879d137b8ee30926aa5b26",
-        "version" : "1.12.0"
+        "revision" : "8dc1fbf2f6255a73dec53b4648164884898db4c5",
+        "version" : "1.14.1"
       }
     },
     {
```

**File**: `Sources/SQLiteData/Documentation.docc/Articles/Fetching.md` (modified, +33/-0)
```diff
@@ -195,6 +195,39 @@ and its value names each section:
 var reminders
 ```
 
+Sections are not limited to `@FetchAll`. Any query can be fetched into a
+``ResultsSectionCollection`` directly, which is useful when defining a custom
+``FetchKeyRequest``:
+
+```swift
+struct RemindersByCategory: FetchKeyRequest {
+  func fetch(_ db: Database) throws -> ResultsSectionCollection<Reminder, String?> {
+    try Reminder
+      .order(by: \.title)
+      .fetchAll(db, sectionBy: \.category)
+  }
+}
+```
+
+The request can be observed with ``Fetch``, and its sections drive a list just like
+``FetchAll/sections`` does:
+
+```swift
+@Fetch(RemindersByCategory()) var sections = ResultsSectionCollection<Reminder, String?>()
+```
+
+And while `@FetchAll` always names its sections with strings, this form can section by any
+`Hashable` value the database can decode, and supports joins and custom selections:
+
+```swift
+try Reminder
+  .order(by: \.title)
+  .join(RemindersList.all) { $0.listID.eq($1.id) }
+  .select { ReminderRow.Columns(title: $0.title, list: $1.name) }
+  .fetchAll(db, sectionBy: { $1.id })
+// ResultsSectionCollection<ReminderRow, Int?>
+```
+
 [sq-safe-sql-strings]: https://swiftpackageindex.com/pointfreeco/swift-structured-queries/~/documentation/structuredqueriescore/safesqlstrings
 [structured-queries-gh]: https://github.com/pointfreeco/swift-structured-queries
 [structured-queries-docs]: https://swiftpackageindex.com/pointfreeco/swift-structured-queries/main/documentation/structuredqueriescore/
```

**File**: `Sources/SQLiteData/FetchAll+Sections.swift` (modified, +902/-527)
```diff
@@ -37,52 +37,6 @@ extension FetchAll {
     return sectionedReader.wrappedValue
   }
 
-  fileprivate init<From: StructuredQueriesCore.Table>(
-    wrappedValue: [Element],
-    statement: Select<(), From, ()>,
-    sectionBy: _Sectioning,
-    database: (any DatabaseReader)?,
-    scheduler: (any ValueObservationScheduler & Hashable)?
-  )
-  where
-    Element == From.QueryOutput,
-    From.QueryOutput: Sendable
-  {
-    self.init(
-      wrappedValue: wrappedValue,
-      request: FetchAllSectionedStatementValueRequest(statement: statement, sectionBy: sectionBy),
-      sectionBy: sectionBy,
-      database: database,
-      scheduler: scheduler
-    )
-  }
-
-  fileprivate init<Value: QueryRepresentable>(
-    wrappedValue: [Element],
-    request: FetchAllSectionedStatementValueRequest<Value>,
-    sectionBy: _Sectioning,
-    database: (any DatabaseReader)?,
-    scheduler: (any ValueObservationScheduler & Hashable)?
-  )
-  where
-    Element == Value.QueryOutput,
-    Value.QueryOutput: Sendable
-  {
-    let sectionedReader = SharedReader(
-      wrappedValue: ResultsSectionCollection(elements: wrappedValue, sectionName: nil),
-      FetchKey(
-        request: request,
-        database: database,
-        scheduler: scheduler
-      )
-    )
-    self.sectionedReader = sectionedReader
-    self.sharedReader = sectionedReader.elements
-    self.sectioning.setValue(sectionBy)
-  }
-}
-
-extension FetchAll {
   /// Initializes this property with a query that fetches every row from a table, grouping results
   /// into sections.
   ///
@@ -99,7 +53,7 @@ extension FetchAll {
   ///     (`@Dependency(\.defaultDatabase)`).
   public init(
     wrappedValue: [Element] = [],
-    @_SectionBuilder sectionBy sectioning: (Element.TableColumns) -> _Sectioning?,
+    @_SectionBuilder<String?> sectionBy sectioning: (Element.TableColumns) -> _Sectioning<String?>?,
     database: (any DatabaseReader)? = nil
   )
   where Element: StructuredQueriesCore.Table, Element.QueryOutput == Element {
@@ -151,7 +105,7 @@ extension FetchAll {
   public init<S: SelectStatement>(
     wrappedValue: [Element] = [],
     _ statement: S,
-    @_SectionBuilder sectionBy sectioning: (S.From.TableColumns) -> _Sectioning?,
+    @_SectionBuilder<String?> sectionBy sectioning: (S.From.TableColumns) -> _Sectioning<String?>?,
     database: (any DatabaseReader)? = nil
   )
   where
@@ -179,30 +133,21 @@ extension FetchAll {
   ///
   /// - Parameters:
   ///   - wrappedValue: A default collection to associate with this property.
-  ///   - sectioning: A closure that returns a string expression, or an ordering of one, to group
-  ///     results by, or `nil` for no grouping.
+  ///   - sectionKeyPath: A key path to a string column to group results by.
   ///   - database: The database to read from. A value of `nil` will use the default database
   ///     (`@Dependency(\.defaultDatabase)`).
-  ///   - scheduler: The scheduler to observe from. By default, database observation is performed
-  ///     asynchronously on the main queue.
   public init(
     wrappedValue: [Element] = [],
-    @_SectionBuilder sectionBy sectioning: (Element.TableColumns) -> _Sectioning?,
-    database: (any DatabaseReader)? = nil,
-    scheduler: some ValueObservationScheduler & Hashable
+    sectionBy sectionKeyPath: KeyPath<
+      Element.TableColumns, some QueryExpression<some _OptionalPromotable<String?>>
+    >,
+    database: (any DatabaseReader)? = nil
   )
   where Element: StructuredQueriesCore.Table, Element.QueryOutput == Element {
-    let statement: Select<(), Element, ()> = Element.all.asSelect()
-    guard let sectioning = sectioning(Element.columns) else {
-      self.init(wrappedValue: wrappedValue, statement, database: database, scheduler: scheduler)
-      return
-    }
     self.init(
       wrappedValue: wrappedValue,
-      statement: statement,
-      sectionBy: sectioning,
-      database: database,
-      scheduler: scheduler
+      sectionBy: { $0[keyPath: sectionKeyPath] },
+      database: database
     )
   }
 
@@ -212,107 +157,147 @@ extension FetchAll {
   /// - Parameters:
   ///   - wrappedValue: A default collection to associate with this property.
   ///   - statement: A query associated with the wrapped value.
-  ///   - sectioning: A closure that returns a string expression, or an ordering of one, to group
-  ///     results by, or `nil` for no grouping.
+  ///   - sectionKeyPath: A key path to a string column to group results by.
   ///   - database: The database to read from. A value of `nil` will use the default database
   ///     (`@Dependency(\.defaultDatabase)`).
-  ///   - scheduler: The scheduler to observe from. By default, database observation is performed
-  ///     asynchronously on the main queue.
   public init<S: SelectStatement>(
     wrappedValue: [Element] = [],
     _ statement: S,
-    @_SectionBuilder sectionBy sectioning: (S.From.TableColumns) -> _Sectioning?,
-    database: (any DatabaseReader)? = n
```

**File**: `Sources/SQLiteData/FetchAll.swift` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ public struct FetchAll<Element: Sendable>: Sendable {
   var sectionedReader: SharedReader<ResultsSectionCollection<Element, String?>> =
     SharedReader(value: ResultsSectionCollection())
 
-  let sectioning = LockIsolated<_Sectioning?>(nil)
+  let sectioning = LockIsolated<_Sectioning<String?>?>(nil)
 
   /// A collection of data associated with the underlying query.
   public var wrappedValue: [Element] {
```

**File**: `Sources/SQLiteData/ResultsSectionCollection.swift` (modified, +5/-4)
```diff
@@ -31,7 +31,8 @@ public struct ResultsSectionCollection<Element, SectionName: Hashable> {
   let elements: [Element]
   private let elementIndicesBySectionName: OrderedDictionary<SectionName, ElementIndices>
 
-  init() {
+  /// Creates an empty collection of sections.
+  public init() {
     elements = []
     elementIndicesBySectionName = [:]
   }
@@ -71,10 +72,10 @@ public struct ResultsSectionCollection<Element, SectionName: Hashable> {
   }
 }
 
-extension ResultsSectionCollection where SectionName == String? {
-  init(cursor: QueryCursor<(Element, String?)>) throws {
+extension ResultsSectionCollection {
+  init(cursor: QueryCursor<(Element, SectionName)>) throws {
     var elements: [Element] = []
-    var elementIndicesBySectionName: OrderedDictionary<String?, ElementIndices> = [:]
+    var elementIndicesBySectionName: OrderedDictionary<SectionName, ElementIndices> = [:]
     while let (element, sectionName) = try cursor.next() {
       let index = elements.count
       elementIndicesBySectionName[sectionName, default: ElementIndices(range: index..<index)]
```

**File**: `Sources/SQLiteData/StructuredQueries+GRDB/QueryCursor.swift` (modified, +9/-8)
```diff
@@ -79,11 +79,10 @@ final class QueryValueCursor<QueryValue: QueryRepresentable>: QueryCursor<QueryV
 }
 
 @usableFromInline
-final class QuerySectionedValueCursor<QueryValue: QueryRepresentable>: QueryCursor<
-  (QueryValue.QueryOutput, String?)
-> {
-  public typealias Element = (QueryValue.QueryOutput, String?)
-
+final class QuerySectionedCursor<
+  Element: QueryRepresentable,
+  SectionName: QueryRepresentable
+>: QueryCursor<(Element.QueryOutput, SectionName.QueryOutput)> {
   // NB: Required to workaround a "Legacy previews execution" bug
   //     https://github.com/pointfreeco/sqlite-data/pull/60
   @usableFromInline
@@ -92,10 +91,12 @@ final class QuerySectionedValueCursor<QueryValue: QueryRepresentable>: QueryCurs
   }
 
   @inlinable
-  public override func _element(sqliteStatement _: SQLiteStatement) throws -> Element {
+  public override func _element(
+    sqliteStatement _: SQLiteStatement
+  ) throws -> (Element.QueryOutput, SectionName.QueryOutput) {
     do {
-      let element = try QueryValue(decoder: &decoder).queryOutput
-      let sectionName = try String?(decoder: &decoder)
+      let element = try Element(decoder: &decoder).queryOutput
+      let sectionName = try SectionName(decoder: &decoder).queryOutput
       decoder.next()
       return (element, sectionName)
     } catch QueryDecodingError.missingRequiredColumn {
```

**File**: `Sources/SQLiteData/StructuredQueries+GRDB/Statement+Sections.swift` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+public import GRDB
+public import StructuredQueriesCore
+
+extension SelectStatement where QueryValue == (), Joins == () {
+  /// Returns all values fetched from the database, grouped into sections.
+  ///
+  /// Results are ordered by the given expression and grouped into a section for each of its
+  /// distinct values:
+  ///
+  /// ```swift
+  /// try Reminder
+  ///   .order(by: \.title)
+  ///   .fetchAll(db, sectionBy: \.priority)
+  /// ```
+  ///
+  /// - Parameters:
+  ///   - db: A database connection.
+  ///   - sectioning: A closure that returns an expression, or an ordering of one, to group results
+  ///     by.
+  /// - Returns: A collection of all values decoded from the database, grouped into sections.
+  public func fetchAll<Key: QueryRepresentable>(
+    _ db: Database,
+    @_SectionBuilder<Key> sectionBy sectioning: (From.TableColumns) -> _Sectioning<Key>
+  ) throws -> ResultsSectionCollection<From.QueryOutput, Key.QueryOutput>
+  where Key.QueryOutput: Hashable {
+    let sectionBy = sectioning(From.columns)
+    let statement: Select<(), From, ()> = asSelect()
+    let prefix: Select<(From, Key), From, ()> = sectionedColumns(of: From.self, sectionBy)
+    let sectioned: Select<(From, Key), From, ()> = prefix + statement
+    return try sectionedResults(From.self, Key.self, db: db, query: sectioned.query)
+  }
+
+  /// Returns all values fetched from the database, grouped into sections.
+  ///
+  /// See ``StructuredQueriesCore/SelectStatement/fetchAll(_:sectionBy:)`` for more information.
+  ///
+  /// - Parameters:
+  ///   - db: A database connection.
+  ///   - sectionKeyPath: A key path to a column to group results by.
+  /// - Returns: A collection of all values decoded from the database, grouped into sections.
+  public func fetchAll<Key: QueryRepresentable>(
+    _ db: Database,
+    sectionBy sectionKeyPath: KeyPath<
+      From.TableColumns, some QueryExpression<some _OptionalPromotable<Key>>
+    >
+  ) throws -> ResultsSectionCollection<From.QueryOutput, Key.QueryOutput>
+  where Key.QueryOutput: Hashable {
+    try fetchAll(db, sectionBy: { $0[keyPath: sectionKeyPath] })
+  }
+}
+
+extension Select {
+  /// Returns all values fetched from the database, grouped into sections.
+  ///
+  /// See ``StructuredQueriesCore/SelectStatement/fetchAll(_:sectionBy:)`` for more information.
+  ///
+  /// - Parameters:
+  ///   - db: A database connection.
+  ///   - sectioning: A closure that returns an expression, or an ordering of one, to group results
+  ///     by.
+  /// - Returns: A collection of all values decoded from the database, grouped into sections.
+  @_documentation(visibility: private)
+  @_disfavoredOverload
+  public func fetchAll<Key: QueryRepresentable, each J: StructuredQueriesCore.Table>(
+    _ db: Database,
+    @_SectionBuilder<Key> sectionBy sectioning: (
+      From.TableColumns, repeat (each J).TableColumns
+    ) -> _Sectioning<Key>
+  ) throws -> ResultsSectionCollection<QueryValue.QueryOutput, Key.QueryOutput>
+  where QueryValue: QueryRepresentable, Joins == (repeat each J), Key.QueryOutput: Hashable {
+    let sectionBy = sectioning(From.columns, repeat (each J).columns)
+    return try sectionedResults(db, statement: self, sectionBy: sectionBy)
+  }
+
+  /// Returns all values fetched from the database, grouped into sections.
+  ///
+  /// See ``StructuredQueriesCore/SelectStatement/fetchAll(_:sectionBy:)`` for more information.
+  ///
+  /// - Parameters:
+  ///   - db: A database connection.
+  ///   - sectioning: A closure that returns an expression, or an ordering of one, to group results
+  ///     by.
+  /// - Returns: A collection of all values decoded from the database, grouped into sections.
+  @_documentation(visibility: private)
+  public func fetchAll<Key: QueryRepresentable>(
+    _ db: Database,
+    @_SectionBuilder<Key> sectionBy sectioning: (
+      From.TableColumns, Joins.TableColumns
+    ) -> _Sectioning<Key>
+  ) throws -> ResultsSectionCollection<QueryValue.QueryOutput, Key.QueryOutput>
+  where
+    QueryValue: QueryRepresentable,
+    Joins: StructuredQueriesCore.Table,
+    Key.QueryOutput: Hashable
+  {
+    let sectionBy = sectioning(From.columns, Joins.columns)
+    return try sectionedResults(db, statement: self, sectionBy: sectionBy)
+  }
+
+  /// Returns all values fetched from the database, grouped into sections.
+  ///
+  /// See ``StructuredQueriesCore/SelectStatement/fetchAll(_:sectionBy:)`` for more information.
+  ///
+  /// - Parameters:
+  ///   - db: A database connection.
+  ///   - sectionKeyPath: A key path to a column to group results by.
+  /// - Returns: A collection of all values decoded from the database, grouped into sections.
+  public func fetchAll<Key: QueryRepresentable>(
+    _ db: Database,
+    sectionBy sectionKeyPath: KeyPath<
+      From.TableColumns, some QueryExpression<some _OptionalPromotable<Key>>
+    >
+  ) throws -> ResultsSectionCollection<QueryValue.QueryOutput, 
```

**File**: `Tests/SQLiteDataTests/FetchAllSectionsTests.swift` (modified, +195/-41)
```diff
@@ -341,11 +341,13 @@ struct FetchAllSectionsTests {
   }
 
   @Test func selectionSectionBy() async throws {
-    let statement =
+    @FetchAll(
       SectionedReminder
-      .order(by: \.id)
-      .select { SectionedRow.Columns(title: $0.title, label: $0.category) }
-    @FetchAll(statement, sectionBy: { $0.category }) var rows
+        .order(by: \.id)
+        .select { SectionedRow.Columns(title: $0.title, label: $0.category) },
+      sectionBy: { $0.category }
+    )
+    var rows
     try await $rows.load()
 
     #expect(rows.map(\.title) == ["Groceries", "Dishes", "Laundry", "Standup", "Review"])
@@ -354,12 +356,14 @@ struct FetchAllSectionsTests {
   }
 
   @Test func joinedSectionBy() async throws {
-    let statement =
+    @FetchAll(
       SectionedReminder
-      .order(by: \.id)
-      .join(SectionedCategory.all) { $0.category.eq($1.name) }
-      .select { SectionedRow.Columns(title: $0.title, label: $1.label) }
-    @FetchAll(statement, sectionBy: { $1.label }) var rows
+        .order(by: \.id)
+        .join(SectionedCategory.all) { $0.category.eq($1.name) }
+        .select { SectionedRow.Columns(title: $0.title, label: $1.label) },
+      sectionBy: { $1.label }
+    )
+    var rows
     try await $rows.load()
 
     #expect(rows.map(\.title) == ["Dishes", "Laundry", "Standup", "Review", "Groceries"])
@@ -369,40 +373,47 @@ struct FetchAllSectionsTests {
   }
 
   @Test func joinedDescendingSectionBy() async throws {
-    let statement =
+    @FetchAll(
       SectionedReminder
-      .order(by: \.id)
-      .join(SectionedCategory.all) { $0.category.eq($1.name) }
-      .select { SectionedRow.Columns(title: $0.title, label: $1.label) }
-    @FetchAll(statement, sectionBy: { $1.label.desc() }) var rows
+        .order(by: \.id)
+        .join(SectionedCategory.all) { $0.category.eq($1.name) }
+        .select { SectionedRow.Columns(title: $0.title, label: $1.label) },
+      sectionBy: { $1.label.desc() }
+    )
+    var rows
     try await $rows.load()
 
     #expect($rows.sections.sectionNames == ["Out & About", "At Work", "At Home"])
   }
 
   @Test func loadJoinedSectionBy() async throws {
-    let statement =
+    @FetchAll(
       SectionedReminder
-      .order(by: \.id)
-      .join(SectionedCategory.all) { $0.category.eq($1.name) }
-      .select { SectionedRow.Columns(title: $0.title, label: $1.label) }
-    @FetchAll(statement) var rows
+        .order(by: \.id)
+        .join(SectionedCategory.all) { $0.category.eq($1.name) }
+        .select { SectionedRow.Columns(title: $0.title, label: $1.label) }
+    )
+    var rows
     try await $rows.load()
     #expect($rows.sections.sectionNames == [nil])
 
-    try await $rows.load(statement, sectionBy: { $1.label })
+    try await $rows.load(
+      SectionedReminder
+        .order(by: \.id)
+        .join(SectionedCategory.all) { $0.category.eq($1.name) }
+        .select { SectionedRow.Columns(title: $0.title, label: $1.label) },
+      sectionBy: { $1.label }
+    )
     #expect(rows.map(\.title) == ["Dishes", "Laundry", "Standup", "Review", "Groceries"])
     #expect($rows.sections.sectionNames == ["At Home", "At Work", "Out & About"])
   }
 
   @Test(arguments: [true, false]) func dynamicJoinedSectionBy(isSectioned: Bool) async throws {
-    let statement =
-      SectionedReminder
-      .order(by: \.id)
-      .join(SectionedCategory.all) { $0.category.eq($1.name) }
-      .select { SectionedRow.Columns(title: $0.title, label: $1.label) }
     @FetchAll(
-      statement,
+      SectionedReminder
+        .order(by: \.id)
+        .join(SectionedCategory.all) { $0.category.eq($1.name) }
+        .select { SectionedRow.Columns(title: $0.title, label: $1.label) },
       sectionBy: {
         if isSectioned {
           $1.label
@@ -420,13 +431,16 @@ struct FetchAllSectionsTests {
   }
 
   @Test func twoJoinsSectionBy() async throws {
-    let statement =
+    @FetchAll(
       SectionedReminder
-      .order(by: \.id)
-      .join(SectionedCategory.all) { $0.category.eq($1.name) }
-      .join(SectionedPriority.all) { reminder, _, priority in reminder.priority.eq(priority.name) }
-      .select { SectionedRow.Columns(title: $0.title, label: $2.label) }
-    @FetchAll(statement, sectionBy: { $2.label }) var rows
+        .order(by: \.id)
+        .join(SectionedCategory.all) { $0.category.eq($1.name) }
+        .join(SectionedPriority.all) { reminder, _, priority in reminder.priority.eq(priority.name)
+        }
+        .select { SectionedRow.Columns(title: $0.title, label: $2.label) },
+      sectionBy: { $2.label }
+    )
+    var rows
     try await $rows.load()
 
     #expect(rows.map(\.title) == ["Dishes", "Standup", "Groceries"])
@@ -436,16 +450,19 @@ struct FetchAllSectionsTests {
   }
 
   @Test func threeJoinsSectionBy() async throws {
-    let statement =
+    @FetchAll(
       SectionedReminder
-      .order(by: \.id)
-      .join(SectionedCategory.all) { $0.category.eq($1.name) }
-      .join(SectionedPr
```

---

### Incident Patch 6: `f7bedfec` (2026-07-17)
**Commit Message**: Revert "Box `@Fetch*` property wrappers in SwiftUI state when possible (#486)" (#501)

This reverts commit a5856cba925a96e7849d600d03c1a4aa66f78439.

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@ jobs:
     name: macOS
     strategy:
       matrix:
-        xcode: ["26.6"]
+        xcode: ["26.2"]
         config: ["debug", "release"]
     runs-on: macos-26
     steps:
@@ -32,7 +32,7 @@ jobs:
     name: Examples
     strategy:
       matrix:
-        xcode: ["26.6"]
+        xcode: ["26.2"]
         config: ["debug"]
         scheme: ["Reminders", "CaseStudies", "SyncUps"]
     runs-on: macos-26
```

**File**: `Examples/Examples.xcodeproj/project.pbxproj` (modified, +5/-1)
```diff
@@ -1100,7 +1100,6 @@
 			isa = XCLocalSwiftPackageReference;
 			relativePath = ..;
 			traits = (
-				CasePaths,
 				LazyInitializableByDefault,
 			);
 		};
@@ -1122,6 +1121,9 @@
 				kind = upToNextMajorVersion;
 				minimumVersion = 1.7.0;
 			};
+			traits = (
+				Clocks,
+			);
 		};
 		DCBE8A122D4842BF0071F499 /* XCRemoteSwiftPackageReference "swift-case-paths" */ = {
 			isa = XCRemoteSwiftPackageReference;
@@ -1138,6 +1140,8 @@
 				kind = upToNextMajorVersion;
 				minimumVersion = 2.2.3;
 			};
+			traits = (
+			);
 		};
 /* End XCRemoteSwiftPackageReference section */
 
```

**File**: `Examples/Examples.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +21/-21)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "c133bf7d10c8ce1e5d6506c3d2f080eac8b4c8c2827044d53a9b925e903564fd",
+  "originHash" : "c56e7b70de4fe8bcc798354797a8405c0eeb2e9bc68bc0f202c14a8b11a0a97f",
   "pins" : [
     {
       "identity" : "combine-schedulers",
@@ -15,17 +15,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/groue/GRDB.swift",
       "state" : {
-        "revision" : "b83108d10f42680d78f23fe4d4d80fc88dab3212",
-        "version" : "7.11.1"
+        "revision" : "9ed8c8457e00ff9c7aedb3bf213f20a2cfdf509e",
+        "version" : "7.11.0"
       }
     },
     {
       "identity" : "swift-case-paths",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-case-paths",
       "state" : {
-        "revision" : "1197e80bc7e4b177051b6869ef93d8ac3ad677da",
-        "version" : "1.8.0"
+        "revision" : "206cbce3882b4de9aee19ce62ac5b7306cadd45b",
+        "version" : "1.7.3"
       }
     },
     {
@@ -60,17 +60,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-custom-dump",
       "state" : {
-        "revision" : "a8cd6c976f335ed361dcecddb0dc39ebda51bc3e",
-        "version" : "1.6.1"
+        "revision" : "b9b59eb58c946236d6f16305c576ad194c36444e",
+        "version" : "1.6.0"
       }
     },
     {
       "identity" : "swift-dependencies",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-dependencies",
       "state" : {
-        "revision" : "8dc1fbf2f6255a73dec53b4648164884898db4c5",
-        "version" : "1.14.1"
+        "revision" : "16f7dd14ee28d04617090f2a73198b8b316ffa12",
+        "version" : "1.13.1"
       }
     },
     {
@@ -87,44 +87,44 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-navigation",
       "state" : {
-        "revision" : "fad75807c596fecd724b0fc81cd61c94008faad4",
-        "version" : "2.10.3"
+        "revision" : "32f35241b8be0719c4c7f00eb27713b1cadb6248",
+        "version" : "2.8.0"
       }
     },
     {
       "identity" : "swift-perception",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-perception",
       "state" : {
-        "revision" : "de219a1cf34e958134e75a9ebb134cf09bf52fc6",
-        "version" : "2.0.11"
+        "revision" : "25ac73741c3436605d61eceb5207e896973918e7",
+        "version" : "2.0.10"
       }
     },
     {
       "identity" : "swift-sharing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-sharing",
       "state" : {
-        "revision" : "8244fe63bf43e58188ab13851ad693eecf6a9e90",
-        "version" : "2.9.1"
+        "revision" : "e47a2f545bafa3c0c702600f3e6ce02b3d566b6f",
+        "version" : "2.8.2"
       }
     },
     {
       "identity" : "swift-snapshot-testing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-snapshot-testing.git",
       "state" : {
-        "revision" : "1bc16f430d8410e7f087d4c787767b26fd32fe30",
-        "version" : "1.19.3"
+        "revision" : "ad5e3190cc63dc288f28546f9c6827efc1e9d495",
+        "version" : "1.19.2"
       }
     },
     {
       "identity" : "swift-structured-queries",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-structured-queries",
       "state" : {
-        "revision" : "e61b3713460507ce93ed4ca4d8f9e4423bf342ca",
-        "version" : "0.33.0"
+        "revision" : "50a429884d7a6c0613df2a31a24009cc436bfb18",
+        "version" : "0.33.2"
       }
     },
     {
@@ -141,8 +141,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/xctest-dynamic-overlay",
       "state" : {
-        "revision" : "8f6abcf4c8950e2679d5b2fee4ca284fd7c34886",
-        "version" : "1.11.0"
+        "revision" : "cb281f343fd953280336dcbd3822cdf47c182f5b",
+        "version" : "1.10.0"
       }
     }
   ],
```

**File**: `Package.resolved` (modified, +14/-14)
```diff
@@ -15,8 +15,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/groue/GRDB.swift",
       "state" : {
-        "revision" : "b83108d10f42680d78f23fe4d4d80fc88dab3212",
-        "version" : "7.11.1"
+        "revision" : "9ed8c8457e00ff9c7aedb3bf213f20a2cfdf509e",
+        "version" : "7.11.0"
       }
     },
     {
@@ -51,17 +51,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-custom-dump",
       "state" : {
-        "revision" : "a8cd6c976f335ed361dcecddb0dc39ebda51bc3e",
-        "version" : "1.6.1"
+        "revision" : "b9b59eb58c946236d6f16305c576ad194c36444e",
+        "version" : "1.6.0"
       }
     },
     {
       "identity" : "swift-dependencies",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-dependencies",
       "state" : {
-        "revision" : "8dc1fbf2f6255a73dec53b4648164884898db4c5",
-        "version" : "1.14.1"
+        "revision" : "f80552807ec92f72fe3fe4543d71879182b0bfd5",
+        "version" : "1.13.0"
       }
     },
     {
@@ -105,26 +105,26 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-sharing",
       "state" : {
-        "revision" : "8244fe63bf43e58188ab13851ad693eecf6a9e90",
-        "version" : "2.9.1"
+        "revision" : "e47a2f545bafa3c0c702600f3e6ce02b3d566b6f",
+        "version" : "2.8.2"
       }
     },
     {
       "identity" : "swift-snapshot-testing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-snapshot-testing",
       "state" : {
-        "revision" : "1bc16f430d8410e7f087d4c787767b26fd32fe30",
-        "version" : "1.19.3"
+        "revision" : "ad5e3190cc63dc288f28546f9c6827efc1e9d495",
+        "version" : "1.19.2"
       }
     },
     {
       "identity" : "swift-structured-queries",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-structured-queries",
       "state" : {
-        "revision" : "9c2935e47b0ed9627e4278c566e0ac386be5472e",
-        "version" : "0.33.3"
+        "revision" : "50a429884d7a6c0613df2a31a24009cc436bfb18",
+        "version" : "0.33.2"
       }
     },
     {
@@ -141,8 +141,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/xctest-dynamic-overlay",
       "state" : {
-        "revision" : "8f6abcf4c8950e2679d5b2fee4ca284fd7c34886",
-        "version" : "1.11.0"
+        "revision" : "cb281f343fd953280336dcbd3822cdf47c182f5b",
+        "version" : "1.10.0"
       }
     }
   ],
```

**File**: `Package.swift` (modified, +2/-0)
```diff
@@ -68,6 +68,7 @@ let package = Package(
     .target(
       name: "SQLiteData",
       dependencies: [
+        .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
         .product(name: "Dependencies", package: "swift-dependencies"),
         .product(name: "GRDB", package: "GRDB.swift"),
         .product(name: "IssueReporting", package: "xctest-dynamic-overlay"),
@@ -86,6 +87,7 @@ let package = Package(
       name: "SQLiteDataTestSupport",
       dependencies: [
         "SQLiteData",
+        .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
         .product(name: "ConcurrencyExtrasTestSupport", package: "swift-concurrency-extras"),
         .product(name: "CustomDump", package: "swift-custom-dump"),
         .product(name: "Dependencies", package: "swift-dependencies"),
```

**File**: `Package@swift-6.0.swift` (modified, +2/-0)
```diff
@@ -35,6 +35,7 @@ let package = Package(
     .target(
       name: "SQLiteData",
       dependencies: [
+        .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
         .product(name: "Dependencies", package: "swift-dependencies"),
         .product(name: "GRDB", package: "GRDB.swift"),
         .product(name: "IssueReporting", package: "xctest-dynamic-overlay"),
@@ -47,6 +48,7 @@ let package = Package(
       name: "SQLiteDataTestSupport",
       dependencies: [
         "SQLiteData",
+        .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
         .product(name: "CustomDump", package: "swift-custom-dump"),
         .product(name: "Dependencies", package: "swift-dependencies"),
         .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
```

**File**: `Sources/SQLiteData/CloudKit/CloudKitSharing.swift` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 #if canImport(CloudKit)
   public import CloudKit
+  import ConcurrencyExtras
   import GRDB
   import IssueReporting
   public import StructuredQueries
@@ -240,7 +241,7 @@
     }
 
     func unshare(share: CKShare) async throws {
-      let result = try await syncEngines.withLock(\.private)?.database.modifyRecords(
+      let result = try await syncEngines.private?.database.modifyRecords(
         saving: [],
         deleting: [share.recordID]
       )
```

**File**: `Sources/SQLiteData/CloudKit/Internal/DataManager.swift` (modified, +4/-3)
```diff
@@ -1,4 +1,5 @@
 #if canImport(CloudKit) && canImport(CryptoKit)
+  package import ConcurrencyExtras
   import CryptoKit
   import Dependencies
   package import Foundation
@@ -54,7 +55,7 @@
     package init() {}
 
     package func load(_ url: URL) throws -> Data {
-      try storage.withLock { storage in
+      try storage.withValue { storage in
         guard let data = storage[url]
         else {
           struct FileNotFound: Error {}
@@ -65,11 +66,11 @@
     }
 
     package func save(_ data: Data, to url: URL) throws {
-      storage.withLock { $0[url] = data }
+      storage.withValue { $0[url] = data }
     }
 
     package func sha256(of fileURL: URL) -> Data? {
-      storage.withLock {
+      storage.withValue {
         $0[fileURL].map {
           Data(SHA256.hash(data: $0))
         }
```

---

### Incident Patch 7: `a5856cba` (2026-07-16)
**Commit Message**: Box `@Fetch*` property wrappers in SwiftUI state when possible (#486)

* wip

* wip

* wip

* cleanup

* Remove ConcurrencyExtras (#498)

* Use LockIsolated in FetchBox

* fix

* fix

* Bump CI Xcode

* Fix?

* wip

* Revert library test CI runner change

* Smaller bump

* fix

---------

Co-authored-by: Stephen Celis <[REDACTED_EMAIL]>

---------

Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>
Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@ jobs:
     name: macOS
     strategy:
       matrix:
-        xcode: ["26.2"]
+        xcode: ["26.6"]
         config: ["debug", "release"]
     runs-on: macos-26
     steps:
@@ -32,7 +32,7 @@ jobs:
     name: Examples
     strategy:
       matrix:
-        xcode: ["26.2"]
+        xcode: ["26.6"]
         config: ["debug"]
         scheme: ["Reminders", "CaseStudies", "SyncUps"]
     runs-on: macos-26
```

**File**: `Examples/Examples.xcodeproj/project.pbxproj` (modified, +1/-5)
```diff
@@ -1100,6 +1100,7 @@
 			isa = XCLocalSwiftPackageReference;
 			relativePath = ..;
 			traits = (
+				CasePaths,
 				LazyInitializableByDefault,
 			);
 		};
@@ -1121,9 +1122,6 @@
 				kind = upToNextMajorVersion;
 				minimumVersion = 1.7.0;
 			};
-			traits = (
-				Clocks,
-			);
 		};
 		DCBE8A122D4842BF0071F499 /* XCRemoteSwiftPackageReference "swift-case-paths" */ = {
 			isa = XCRemoteSwiftPackageReference;
@@ -1140,8 +1138,6 @@
 				kind = upToNextMajorVersion;
 				minimumVersion = 2.2.3;
 			};
-			traits = (
-			);
 		};
 /* End XCRemoteSwiftPackageReference section */
 
```

**File**: `Examples/Examples.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +21/-21)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "c56e7b70de4fe8bcc798354797a8405c0eeb2e9bc68bc0f202c14a8b11a0a97f",
+  "originHash" : "c133bf7d10c8ce1e5d6506c3d2f080eac8b4c8c2827044d53a9b925e903564fd",
   "pins" : [
     {
       "identity" : "combine-schedulers",
@@ -15,17 +15,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/groue/GRDB.swift",
       "state" : {
-        "revision" : "9ed8c8457e00ff9c7aedb3bf213f20a2cfdf509e",
-        "version" : "7.11.0"
+        "revision" : "b83108d10f42680d78f23fe4d4d80fc88dab3212",
+        "version" : "7.11.1"
       }
     },
     {
       "identity" : "swift-case-paths",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-case-paths",
       "state" : {
-        "revision" : "206cbce3882b4de9aee19ce62ac5b7306cadd45b",
-        "version" : "1.7.3"
+        "revision" : "1197e80bc7e4b177051b6869ef93d8ac3ad677da",
+        "version" : "1.8.0"
       }
     },
     {
@@ -60,17 +60,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-custom-dump",
       "state" : {
-        "revision" : "b9b59eb58c946236d6f16305c576ad194c36444e",
-        "version" : "1.6.0"
+        "revision" : "a8cd6c976f335ed361dcecddb0dc39ebda51bc3e",
+        "version" : "1.6.1"
       }
     },
     {
       "identity" : "swift-dependencies",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-dependencies",
       "state" : {
-        "revision" : "16f7dd14ee28d04617090f2a73198b8b316ffa12",
-        "version" : "1.13.1"
+        "revision" : "8dc1fbf2f6255a73dec53b4648164884898db4c5",
+        "version" : "1.14.1"
       }
     },
     {
@@ -87,44 +87,44 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-navigation",
       "state" : {
-        "revision" : "32f35241b8be0719c4c7f00eb27713b1cadb6248",
-        "version" : "2.8.0"
+        "revision" : "fad75807c596fecd724b0fc81cd61c94008faad4",
+        "version" : "2.10.3"
       }
     },
     {
       "identity" : "swift-perception",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-perception",
       "state" : {
-        "revision" : "25ac73741c3436605d61eceb5207e896973918e7",
-        "version" : "2.0.10"
+        "revision" : "de219a1cf34e958134e75a9ebb134cf09bf52fc6",
+        "version" : "2.0.11"
       }
     },
     {
       "identity" : "swift-sharing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-sharing",
       "state" : {
-        "revision" : "e47a2f545bafa3c0c702600f3e6ce02b3d566b6f",
-        "version" : "2.8.2"
+        "revision" : "8244fe63bf43e58188ab13851ad693eecf6a9e90",
+        "version" : "2.9.1"
       }
     },
     {
       "identity" : "swift-snapshot-testing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-snapshot-testing.git",
       "state" : {
-        "revision" : "ad5e3190cc63dc288f28546f9c6827efc1e9d495",
-        "version" : "1.19.2"
+        "revision" : "1bc16f430d8410e7f087d4c787767b26fd32fe30",
+        "version" : "1.19.3"
       }
     },
     {
       "identity" : "swift-structured-queries",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-structured-queries",
       "state" : {
-        "revision" : "50a429884d7a6c0613df2a31a24009cc436bfb18",
-        "version" : "0.33.2"
+        "revision" : "e61b3713460507ce93ed4ca4d8f9e4423bf342ca",
+        "version" : "0.33.0"
       }
     },
     {
@@ -141,8 +141,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/xctest-dynamic-overlay",
       "state" : {
-        "revision" : "cb281f343fd953280336dcbd3822cdf47c182f5b",
-        "version" : "1.10.0"
+        "revision" : "8f6abcf4c8950e2679d5b2fee4ca284fd7c34886",
+        "version" : "1.11.0"
       }
     }
   ],
```

**File**: `Package.resolved` (modified, +14/-14)
```diff
@@ -15,8 +15,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/groue/GRDB.swift",
       "state" : {
-        "revision" : "9ed8c8457e00ff9c7aedb3bf213f20a2cfdf509e",
-        "version" : "7.11.0"
+        "revision" : "b83108d10f42680d78f23fe4d4d80fc88dab3212",
+        "version" : "7.11.1"
       }
     },
     {
@@ -51,17 +51,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-custom-dump",
       "state" : {
-        "revision" : "b9b59eb58c946236d6f16305c576ad194c36444e",
-        "version" : "1.6.0"
+        "revision" : "a8cd6c976f335ed361dcecddb0dc39ebda51bc3e",
+        "version" : "1.6.1"
       }
     },
     {
       "identity" : "swift-dependencies",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-dependencies",
       "state" : {
-        "revision" : "f80552807ec92f72fe3fe4543d71879182b0bfd5",
-        "version" : "1.13.0"
+        "revision" : "8dc1fbf2f6255a73dec53b4648164884898db4c5",
+        "version" : "1.14.1"
       }
     },
     {
@@ -105,26 +105,26 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-sharing",
       "state" : {
-        "revision" : "e47a2f545bafa3c0c702600f3e6ce02b3d566b6f",
-        "version" : "2.8.2"
+        "revision" : "8244fe63bf43e58188ab13851ad693eecf6a9e90",
+        "version" : "2.9.1"
       }
     },
     {
       "identity" : "swift-snapshot-testing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-snapshot-testing",
       "state" : {
-        "revision" : "ad5e3190cc63dc288f28546f9c6827efc1e9d495",
-        "version" : "1.19.2"
+        "revision" : "1bc16f430d8410e7f087d4c787767b26fd32fe30",
+        "version" : "1.19.3"
       }
     },
     {
       "identity" : "swift-structured-queries",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-structured-queries",
       "state" : {
-        "revision" : "50a429884d7a6c0613df2a31a24009cc436bfb18",
-        "version" : "0.33.2"
+        "revision" : "9c2935e47b0ed9627e4278c566e0ac386be5472e",
+        "version" : "0.33.3"
       }
     },
     {
@@ -141,8 +141,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/xctest-dynamic-overlay",
       "state" : {
-        "revision" : "cb281f343fd953280336dcbd3822cdf47c182f5b",
-        "version" : "1.10.0"
+        "revision" : "8f6abcf4c8950e2679d5b2fee4ca284fd7c34886",
+        "version" : "1.11.0"
       }
     }
   ],
```

**File**: `Package.swift` (modified, +0/-2)
```diff
@@ -68,7 +68,6 @@ let package = Package(
     .target(
       name: "SQLiteData",
       dependencies: [
-        .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
         .product(name: "Dependencies", package: "swift-dependencies"),
         .product(name: "GRDB", package: "GRDB.swift"),
         .product(name: "IssueReporting", package: "xctest-dynamic-overlay"),
@@ -87,7 +86,6 @@ let package = Package(
       name: "SQLiteDataTestSupport",
       dependencies: [
         "SQLiteData",
-        .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
         .product(name: "ConcurrencyExtrasTestSupport", package: "swift-concurrency-extras"),
         .product(name: "CustomDump", package: "swift-custom-dump"),
         .product(name: "Dependencies", package: "swift-dependencies"),
```

**File**: `Package@swift-6.0.swift` (modified, +0/-2)
```diff
@@ -35,7 +35,6 @@ let package = Package(
     .target(
       name: "SQLiteData",
       dependencies: [
-        .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
         .product(name: "Dependencies", package: "swift-dependencies"),
         .product(name: "GRDB", package: "GRDB.swift"),
         .product(name: "IssueReporting", package: "xctest-dynamic-overlay"),
@@ -48,7 +47,6 @@ let package = Package(
       name: "SQLiteDataTestSupport",
       dependencies: [
         "SQLiteData",
-        .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
         .product(name: "CustomDump", package: "swift-custom-dump"),
         .product(name: "Dependencies", package: "swift-dependencies"),
         .product(name: "InlineSnapshotTesting", package: "swift-snapshot-testing"),
```

**File**: `Sources/SQLiteData/CloudKit/CloudKitSharing.swift` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 #if canImport(CloudKit)
   public import CloudKit
-  import ConcurrencyExtras
   import GRDB
   import IssueReporting
   public import StructuredQueries
@@ -241,7 +240,7 @@
     }
 
     func unshare(share: CKShare) async throws {
-      let result = try await syncEngines.private?.database.modifyRecords(
+      let result = try await syncEngines.withLock(\.private)?.database.modifyRecords(
         saving: [],
         deleting: [share.recordID]
       )
```

**File**: `Sources/SQLiteData/CloudKit/Internal/DataManager.swift` (modified, +3/-4)
```diff
@@ -1,5 +1,4 @@
 #if canImport(CloudKit) && canImport(CryptoKit)
-  package import ConcurrencyExtras
   import CryptoKit
   import Dependencies
   package import Foundation
@@ -55,7 +54,7 @@
     package init() {}
 
     package func load(_ url: URL) throws -> Data {
-      try storage.withValue { storage in
+      try storage.withLock { storage in
         guard let data = storage[url]
         else {
           struct FileNotFound: Error {}
@@ -66,11 +65,11 @@
     }
 
     package func save(_ data: Data, to url: URL) throws {
-      storage.withValue { $0[url] = data }
+      storage.withLock { $0[url] = data }
     }
 
     package func sha256(of fileURL: URL) -> Data? {
-      storage.withValue {
+      storage.withLock {
         $0[fileURL].map {
           Data(SHA256.hash(data: $0))
         }
```

---

### Incident Patch 8: `ea310aef` (2026-07-15)
**Commit Message**: Update bug_report.yml

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@ body:
   attributes:
     label: Checklist
     options:
+    - label: I wrote this in my own words, and aimed to be as succinct as possible, even if I used AI to help research its content.
+      required: true
     - label: I have determined whether this bug is also reproducible in a vanilla SwiftUI project.
       required: false
     - label: I have determined whether this bug is also reproducible in a vanilla GRDB project.
```

---

### Incident Patch 9: `f8f23112` (2026-06-10)
**Commit Message**: Work around `@_exported`-`public import` bug (#477)

We've relied on fine-grained GRDB exports via, e.g.:

```swift
@_exported import class GRDB.Database
```

But it turns out this breaks as soon as you have an explicit `public import` in the same module:

```swift
public import class GRDB.Database
```

To work around this bug, we can use `#if` blocks to make each mutually exclusive.

**File**: `Examples/Examples.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +27/-27)
```diff
@@ -1,49 +1,49 @@
 {
-  "originHash" : "c56e7b70de4fe8bcc798354797a8405c0eeb2e9bc68bc0f202c14a8b11a0a97f",
+  "originHash" : "c133bf7d10c8ce1e5d6506c3d2f080eac8b4c8c2827044d53a9b925e903564fd",
   "pins" : [
     {
       "identity" : "combine-schedulers",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/combine-schedulers",
       "state" : {
-        "revision" : "fd16d76fd8b9a976d88bfb6cacc05ca8d19c91b6",
-        "version" : "1.1.0"
+        "revision" : "dcccb979a2183b8df3334237e3dc1ae2b4116a86",
+        "version" : "1.2.0"
       }
     },
     {
       "identity" : "grdb.swift",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/groue/GRDB.swift",
       "state" : {
-        "revision" : "aa0079aeb82a4bf00324561a40bffe68c6fe1c26",
-        "version" : "7.9.0"
+        "revision" : "9ed8c8457e00ff9c7aedb3bf213f20a2cfdf509e",
+        "version" : "7.11.0"
       }
     },
     {
       "identity" : "swift-case-paths",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-case-paths",
       "state" : {
-        "revision" : "6989976265be3f8d2b5802c722f9ba168e227c71",
-        "version" : "1.7.2"
+        "revision" : "206cbce3882b4de9aee19ce62ac5b7306cadd45b",
+        "version" : "1.7.3"
       }
     },
     {
       "identity" : "swift-clocks",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-clocks",
       "state" : {
-        "revision" : "cc46202b53476d64e824e0b6612da09d84ffde8e",
-        "version" : "1.0.6"
+        "revision" : "72d749bf341b78851203066ab421869b783ec42a",
+        "version" : "1.1.0"
       }
     },
     {
       "identity" : "swift-collections",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-collections",
       "state" : {
-        "revision" : "7b847a3b7008b2dc2f47ca3110d8c782fb2e5c7e",
-        "version" : "1.3.0"
+        "revision" : "a0cb0954ecb21e4e31b0070e6ed5674e8556685a",
+        "version" : "1.6.0"
       }
     },
     {
@@ -60,17 +60,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-custom-dump",
       "state" : {
-        "revision" : "82645ec760917961cfa08c9c0c7104a57a0fa4b1",
-        "version" : "1.3.3"
+        "revision" : "b9b59eb58c946236d6f16305c576ad194c36444e",
+        "version" : "1.6.0"
       }
     },
     {
       "identity" : "swift-dependencies",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-dependencies",
       "state" : {
-        "revision" : "a10f9feeb214bc72b5337b6ef6d5a029360db4cc",
-        "version" : "1.10.0"
+        "revision" : "16f7dd14ee28d04617090f2a73198b8b316ffa12",
+        "version" : "1.13.1"
       }
     },
     {
@@ -87,35 +87,35 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-navigation",
       "state" : {
-        "revision" : "bf498690e1f6b4af790260f542e8428a4ba10d78",
-        "version" : "2.6.0"
+        "revision" : "32f35241b8be0719c4c7f00eb27713b1cadb6248",
+        "version" : "2.8.0"
       }
     },
     {
       "identity" : "swift-perception",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-perception",
       "state" : {
-        "revision" : "4f47ebafed5f0b0172cf5c661454fa8e28fb2ac4",
-        "version" : "2.0.9"
+        "revision" : "25ac73741c3436605d61eceb5207e896973918e7",
+        "version" : "2.0.10"
       }
     },
     {
       "identity" : "swift-sharing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-sharing",
       "state" : {
-        "revision" : "3bfc408cc2d0bee2287c174da6b1c76768377818",
-        "version" : "2.7.4"
+        "revision" : "e47a2f545bafa3c0c702600f3e6ce02b3d566b6f",
+        "version" : "2.8.2"
       }
     },
     {
       "identity" : "swift-snapshot-testing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-snapshot-testing.git",
       "state" : {
-        "revision" : "a8b7c5e0ed33d8ab8887d1654d9b59f2cbad529b",
-        "version" : "1.18.7"
+        "revision" : "ad5e3190cc63dc288f28546f9c6827efc1e9d495",
+        "version" : "1.19.2"
       }
     },
     {
@@ -132,17 +132,17 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/swiftlang/swift-syntax",
       "state" : {
-        "revision" : "4799286537280063c85a32f09884cfbca301b1a1",
-        "version" : "602.0.0"
+        "revision" : "79e4b74a295b6eb74a8b585e3a39d29e70c1dbd1",
+        "version" : "603.0.2"
       }
     },
     {
       "identity" : "xctest-dynamic-overlay",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/xctest-dynamic-overlay",
       "state" : {
-        "revision" : "4c27acf5394b645b70d8ba19dc249c0472d5f618",
-       
```

**File**: `Examples/Reminders/RemindersApp.swift` (modified, +3/-3)
```diff
@@ -34,7 +34,7 @@ struct RemindersApp: App {
           isPresented: $syncEngineDelegate.isDeleteLocalDataAlertPresented
         ) {
           Button("Reset", role: .destructive) {
-            Task {
+            _ = Task {
               try await syncEngine.deleteLocalData()
             }
           }
@@ -100,7 +100,7 @@ class SceneDelegate: UIResponder, UIWindowSceneDelegate {
     _ windowScene: UIWindowScene,
     userDidAcceptCloudKitShareWith cloudKitShareMetadata: CKShare.Metadata
   ) {
-    Task {
+    _ = Task {
       try await syncEngine.acceptShare(metadata: cloudKitShareMetadata)
     }
   }
@@ -114,7 +114,7 @@ class SceneDelegate: UIResponder, UIWindowSceneDelegate {
     else {
       return
     }
-    Task {
+    _ = Task {
       try await syncEngine.acceptShare(metadata: cloudKitShareMetadata)
     }
   }
```

**File**: `Examples/Reminders/RemindersDetail.swift` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ class RemindersDetailModel: HashableObject {
     }
   }
 
-  private var remindersQuery: some StructuredQueriesCore.Statement<Row> {
+  private var remindersQuery: some Statement<Row> & Sendable {
     Reminder
       .where {
         if !showCompleted {
```

**File**: `Examples/Reminders/Schema.swift` (modified, +1/-1)
```diff
@@ -390,7 +390,7 @@ nonisolated func handleReminderStatusUpdate() {
 
 @DatabaseFunction
 nonisolated func createDefaultRemindersList() {
-  Task {
+  _ = Task {
     @Dependency(\.defaultDatabase) var database
     try await database.write { db in
       try RemindersList.insert {
```

**File**: `Examples/Reminders/SearchReminders.swift` (modified, +1/-2)
```diff
@@ -1,4 +1,3 @@
-import GRDB
 import IssueReporting
 import SQLiteData
 import SwiftUI
@@ -227,7 +226,7 @@ struct SearchRemindersView: View {
         }
         Spacer()
         Button(model.showCompletedInSearchResults ? "Hide" : "Show") {
-          Task { try await model.showCompletedButtonTapped() }
+          _ = Task { try await model.showCompletedButtonTapped() }
         }
       }
     }
```

**File**: `Examples/Reminders/TagsForm.swift` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-import GRDB
 import SQLiteData
 import SwiftUI
 import SwiftUINavigation
```

**File**: `Package.resolved` (modified, +27/-27)
```diff
@@ -1,40 +1,40 @@
 {
-  "originHash" : "725d8f778c84290ef81225fe8c548ff0a0169261b1f4fb6567dc64db04374bbd",
+  "originHash" : "0ab18ed31f19c7e2b527b6bcc8ba2fc8708fcc9962e7bd79c8d049cb9595154d",
   "pins" : [
     {
       "identity" : "combine-schedulers",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/combine-schedulers",
       "state" : {
-        "revision" : "fd16d76fd8b9a976d88bfb6cacc05ca8d19c91b6",
-        "version" : "1.1.0"
+        "revision" : "dcccb979a2183b8df3334237e3dc1ae2b4116a86",
+        "version" : "1.2.0"
       }
     },
     {
       "identity" : "grdb.swift",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/groue/GRDB.swift",
       "state" : {
-        "revision" : "36e30a6f1ef10e4194f6af0cff90888526f0c115",
-        "version" : "7.10.0"
+        "revision" : "9ed8c8457e00ff9c7aedb3bf213f20a2cfdf509e",
+        "version" : "7.11.0"
       }
     },
     {
       "identity" : "swift-clocks",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-clocks",
       "state" : {
-        "revision" : "cc46202b53476d64e824e0b6612da09d84ffde8e",
-        "version" : "1.0.6"
+        "revision" : "72d749bf341b78851203066ab421869b783ec42a",
+        "version" : "1.1.0"
       }
     },
     {
       "identity" : "swift-collections",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-collections",
       "state" : {
-        "revision" : "7b847a3b7008b2dc2f47ca3110d8c782fb2e5c7e",
-        "version" : "1.3.0"
+        "revision" : "a0cb0954ecb21e4e31b0070e6ed5674e8556685a",
+        "version" : "1.6.0"
       }
     },
     {
@@ -51,26 +51,26 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-custom-dump",
       "state" : {
-        "revision" : "2a2a938798236b8fa0bc57c453ee9de9f9ec3ab0",
-        "version" : "1.4.1"
+        "revision" : "b9b59eb58c946236d6f16305c576ad194c36444e",
+        "version" : "1.6.0"
       }
     },
     {
       "identity" : "swift-dependencies",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-dependencies",
       "state" : {
-        "revision" : "c79f72b3e67a1eb64f66f76704c22ed6a5c1ed84",
-        "version" : "1.11.0"
+        "revision" : "16f7dd14ee28d04617090f2a73198b8b316ffa12",
+        "version" : "1.13.1"
       }
     },
     {
       "identity" : "swift-docc-plugin",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-docc-plugin",
       "state" : {
-        "revision" : "e977f65879f82b375a044c8837597f690c067da6",
-        "version" : "1.4.6"
+        "revision" : "647c708be89f834fa6a6d4945442793a77ddf5b6",
+        "version" : "1.5.0"
       }
     },
     {
@@ -96,53 +96,53 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-perception",
       "state" : {
-        "revision" : "4f47ebafed5f0b0172cf5c661454fa8e28fb2ac4",
-        "version" : "2.0.9"
+        "revision" : "25ac73741c3436605d61eceb5207e896973918e7",
+        "version" : "2.0.10"
       }
     },
     {
       "identity" : "swift-sharing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-sharing",
       "state" : {
-        "revision" : "3bfc408cc2d0bee2287c174da6b1c76768377818",
-        "version" : "2.7.4"
+        "revision" : "e47a2f545bafa3c0c702600f3e6ce02b3d566b6f",
+        "version" : "2.8.2"
       }
     },
     {
       "identity" : "swift-snapshot-testing",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-snapshot-testing",
       "state" : {
-        "revision" : "bf8d8c27f0f0c6d5e77bff0db76ab68f2050d15d",
-        "version" : "1.18.9"
+        "revision" : "ad5e3190cc63dc288f28546f9c6827efc1e9d495",
+        "version" : "1.19.2"
       }
     },
     {
       "identity" : "swift-structured-queries",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/swift-structured-queries",
       "state" : {
-        "revision" : "20db4a2a446f51e67e1207d54a23ad0a03471a7b",
-        "version" : "0.31.0"
+        "revision" : "8da8818fccd9959bd683934ddc62cf45bb65b3c8",
+        "version" : "0.31.1"
       }
     },
     {
       "identity" : "swift-syntax",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/swiftlang/swift-syntax",
       "state" : {
-        "revision" : "4799286537280063c85a32f09884cfbca301b1a1",
-        "version" : "602.0.0"
+        "revision" : "79e4b74a295b6eb74a8b585e3a39d29e70c1dbd1",
+        "version" : "603.0.2"
       }
     },
     {
       "identity" : "xctest-dynamic-overlay",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/pointfreeco/xctest-dynamic-overlay",
       "state" : {
-        "revision" : "dfd70507def84cb5fb82127844
```

**File**: `Sources/SQLiteData/CloudKit/CloudKitSharing.swift` (modified, +7/-5)
```diff
@@ -1,11 +1,13 @@
 #if canImport(CloudKit)
   public import CloudKit
-  public import Dependencies
+  import ConcurrencyExtras
   import GRDB
-  public import SwiftUI
+  import IssueReporting
   public import StructuredQueries
 
-  #if canImport(UIKit)
+  #if canImport(SwiftUI) && canImport(UIKit) && !os(tvOS) && !os(watchOS)
+    public import Dependencies
+    public import SwiftUI
     public import UIKit
   #endif
 
@@ -255,7 +257,7 @@
     }
   }
 
-  #if canImport(UIKit) && !os(tvOS) && !os(watchOS)
+  #if canImport(SwiftUI) && canImport(UIKit) && !os(tvOS) && !os(watchOS)
     /// A view that presents standard screens for adding and removing people from a CloudKit share \
     /// record.
     ///
@@ -348,7 +350,7 @@
               }
 
               Button("Stop Sharing", role: .destructive) {
-                Task {
+                _ = Task {
                   try await syncEngine.unshare(share: sharedRecord.share)
                   try await syncEngine.fetchChanges()
                   dismiss()
```

---

### Incident Patch 10: `59b3b401` (2026-06-06)
**Commit Message**: Fix compile error by making Tagged import public (#476)

* Fix compile error by making Tagged import public

* Enable SQLiteDataTagged trait in CI.

---------

Co-authored-by: Brandon Williams <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ jobs:
       - name: Build ${{ matrix.config }} without exports
         run: swift build -c ${{ matrix.config }} -Xswiftc -D -Xswiftc EXCLUDE_EXPORTS
       - name: Run ${{ matrix.config }} tests
-        run: swift test -c ${{ matrix.config }}
+        run: swift test -c ${{ matrix.config }} --traits SQLiteDataTagged
 
   examples:
     name: Examples
```

**File**: `Sources/SQLiteData/Traits/Tagged.swift` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 #if SQLiteDataTagged
-  import Tagged
+  public import Tagged
 
   extension Tagged: IdentifierStringConvertible where RawValue: IdentifierStringConvertible {
     public init?(rawIdentifier: String) {
```

---

### Incident Patch 11: `f58d5d4c` (2026-06-04)
**Commit Message**: fix (#456)

**File**: `Sources/SQLiteData/CloudKit/SyncEngine.swift` (modified, +3/-3)
```diff
@@ -19,7 +19,7 @@
 
   /// An object that manages the synchronization of local and remote SQLite data.
   ///
-  /// See <doc:CloudKit> for more information.
+  /// See <doc:CloudKitSync> for more information.
   @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
   public final class SyncEngine: Observable, Sendable {
     package let userDatabase: UserDatabase
@@ -900,7 +900,7 @@
 
     /// Whether or not the ``SyncEngine`` is currently writing changes to the database.
     ///
-    /// See <doc:CloudKit#Updating-triggers-to-be-compatible-with-synchronization> for more info.
+    /// See <doc:CloudKitSync#Updating-triggers-to-be-compatible-with-synchronization> for more info.
     @DatabaseFunction("sqlitedata_icloud_syncEngineIsSynchronizingChanges")
     public static var isSynchronizing: Bool {
       if _isCreatingTemporaryTrigger {
@@ -2201,7 +2201,7 @@
     /// Attaches the metadatabase to an existing database connection.
     ///
     /// Invoke this method when preparing your database connection in order to allow querying the
-    /// ``SyncMetadata`` table (see <doc:CloudKit#Accessing-CloudKit-metadata> for more info):
+    /// ``SyncMetadata`` table (see <doc:CloudKitSync#Accessing-CloudKit-metadata> for more info):
     ///
     /// ```swift
     /// func appDatabase() -> any DatabaseWriter {
```

**File**: `Sources/SQLiteData/CloudKit/SyncMetadata.swift` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
   /// application is the number of rows this one single table holds. However, this table is held
   /// in a database separate from your app's database.
   ///
-  /// See <doc:CloudKit#Accessing-CloudKit-metadata> for more info.
+  /// See <doc:CloudKitSync#Accessing-CloudKit-metadata> for more info.
   @available(iOS 17, macOS 14, tvOS 17, watchOS 10, *)
   @Table("sqlitedata_icloud_metadata")
   public struct SyncMetadata: Hashable, Identifiable, Sendable {
```

**File**: `Sources/SQLiteData/Documentation.docc/Articles/AddingToGRDB.md` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@ Learn how to add SQLiteData to an existing app that uses GRDB.
 to interact with SQLite under the hood, such as performing queries and observing changes to the
 database. If you have an existing application using GRDB, and would like to use the tools of this
 library, such as [`@FetchAll`](<doc:FetchAll>), the SQL query builder, and
-[CloudKit synchronization](<doc:CloudKit>), then there are a few steps you must take.
+[CloudKit synchronization](<doc:CloudKitSync>), then there are a few steps you must take.
 
 ## Replace PersistableRecord and FetchableRecord with @Table
 
@@ -169,7 +169,7 @@ try Reminder.insert {
 
 ## CloudKit synchronization
 
-The library's [CloudKit](<doc:CloudKit>) synchronization tools require that the tables being
+The library's [CloudKit](<doc:CloudKitSync>) synchronization tools require that the tables being
 synchronized have a primary key, and this is enforced through the `PrimaryKeyedTable` protocol.
 The `@Table` macro automatically applies this protocol for you when your type has an `id` field,
 but if you use a different name for your primary key you will need to use the `@Column` macro
@@ -186,6 +186,6 @@ to specify that:
 The library further requires your tables use globally unique identifiers (such as UUID) for their
 primary keys, and in particular auto-incrementing integer IDs do _not_ work. You will need to
 migrate your tables to use UUIDs, see
-<doc:CloudKit#Preparing-an-existing-schema-for-synchronization> for more information.
+<doc:CloudKitSync#Preparing-an-existing-schema-for-synchronization> for more information.
 
 [GRDB]: http://github.com/groue/GRDB.swift
```

**File**: `Sources/SQLiteData/Documentation.docc/Articles/CloudKitSharing.md` (modified, +3/-3)
```diff
@@ -179,7 +179,7 @@ you can share root records, like reminders lists. If you do invoke
 ``SyncEngine/share(record:configure:)`` with a non-root record, an error will be thrown.
 
 > Note: A reminder can still be shared as an association to a shared reminders list, as discussed
-> [in the next section](<doc:CloudKit#Sharing-foreign-key-relationships>). However, a single
+> [in the next section](<doc:CloudKitSync#Sharing-foreign-key-relationships>). However, a single
 > reminder cannot be shared on its own.
 
 For a more complex example, consider the following diagrammatic schema for a reminders app:
@@ -336,7 +336,7 @@ excels at.
 
 One-to-"at most one" relationships in SQLite allow you to associate zero or one records with
 another record. For an example of this, suppose we wanted to hold onto a cover image for reminders
-lists (see <doc:CloudKit#Assets> for more information on synchronizing assets such as images). It
+lists (see <doc:CloudKitSync#Assets> for more information on synchronizing assets such as images). It
 is perfectly fine to hold onto large binary data in SQLite, such as image data, but typically one
 should put this data in a separate table.
 
@@ -384,7 +384,7 @@ do {
 }
 ```
 
-See <doc:CloudKit#Accessing-CloudKit-metadata> for more information on accessing the metadata
+See <doc:CloudKitSync#Accessing-CloudKit-metadata> for more information on accessing the metadata
 associated with your user's data.
 
 Ideally your app would not allow the user to write to records that they do not have permissions for.
```

**File**: `Sources/SQLiteData/Documentation.docc/Articles/CloudKitSync.md` (renamed, +3/-3)
```diff
@@ -117,7 +117,7 @@ This will allow you to query the ``SyncMetadata`` table, which gives you access
 stored for each of your records, as well as the `CKShare` for any shared records.
 
 See the ``GRDB/Database/attachMetadatabase(containerIdentifier:)`` for more information, as well
-as <doc:CloudKit#Accessing-CloudKit-metadata> below.
+as <doc:CloudKitSync#Accessing-CloudKit-metadata> below.
 
 ## Designing your schema with synchronization in mind
 
@@ -538,7 +538,7 @@ exposed for you to query it in whichever way you want.
 > Important: In order to query the `SyncMetadata` table from your database connection you will need
 to attach the metadatabase to your database connection. This can be done with the
 ``GRDB/Database/attachMetadatabase(containerIdentifier:)`` method defined on `Database`. See
-<doc:CloudKit#Setting-up-a-SyncEngine> for more information on how to do this.
+<doc:CloudKitSync#Setting-up-a-SyncEngine> for more information on how to do this.
 
 With that done you can use the ``StructuredQueriesCore/PrimaryKeyedTable/syncMetadataID`` property
 to construct a SQL query for fetching the metadata associated with one of your records.
@@ -705,7 +705,7 @@ And in previews you can use it like so:
 
 If you have an existing app deployed to the app store using SQLite, then you may have to perform
 a migration on your schema to prepare it for synchronization. The most important requirement
-detailed above in <doc:CloudKit#Designing-your-schema-with-synchronization-in-mind> is that
+detailed above in <doc:CloudKitSync#Designing-your-schema-with-synchronization-in-mind> is that
 all tables _must_ have a primary key, and all primary keys must be globally unique identifiers
 such as UUID, and cannot be simple auto-incrementing integers.
 
```

**File**: `Sources/SQLiteData/Documentation.docc/Articles/ComparisonWithSwiftData.md` (modified, +6/-6)
```diff
@@ -931,17 +931,17 @@ SQLiteData has only one of these limitations:
 * Unique constraints on columns (except for the primary key) cannot be upheld on a distributed
 schema. For example, if you have a `Tag` table with a unique `title` column, then what
 are you to do if two different devices create a tag with the title "family" at the same time?
-See <doc:CloudKit#Uniqueness-constraints> for more information.
+See <doc:CloudKitSync#Uniqueness-constraints> for more information.
 * Columns on freshly created tables do not need to have default values or be nullable. Only
 newly added columns to existing tables need to either be nullable or have a default. See
-<doc:CloudKit#Adding-columns> for more info.
+<doc:CloudKitSync#Adding-columns> for more info.
 * Relationships on freshly created do not need to be nullable. Only newly added columns to
-existing tables need to be nullable. See <doc:CloudKit#Adding-columns> for more info.
+existing tables need to be nullable. See <doc:CloudKitSync#Adding-columns> for more info.
 
 For more information about requirements of your schema in order to use CloudKit synchronization,
-see <doc:CloudKit#Designing-your-schema-with-synchronization-in-mind> and
-<doc:CloudKit#Backwards-compatible-migrations>, and for more general
-information about CloudKit synchronization, see <doc:CloudKit>.
+see <doc:CloudKitSync#Designing-your-schema-with-synchronization-in-mind> and
+<doc:CloudKitSync#Backwards-compatible-migrations>, and for more general
+information about CloudKit synchronization, see <doc:CloudKitSync>.
 
 ### Supported Apple platforms
 
```

**File**: `Sources/SQLiteData/Documentation.docc/Articles/ManuallyMigratingPrimaryKeys.md` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ struct ReminderTag {
 ```
 
 And a migration must be run to add that column to the table. However, you must perform a multi-step
-migration similar to what is described above in <doc:CloudKit#Convert-Int-primary-keys-to-UUID>.
+migration similar to what is described above in <doc:CloudKitSync#Convert-Int-primary-keys-to-UUID>.
 You must 1) create a new table with the new primary key column, 2) copy data from the old table
 to the new table, 3) delete the old table, and finally 4) rename the new table.
 
```

**File**: `Sources/SQLiteData/Documentation.docc/Articles/PreparingDatabase.md` (modified, +1/-1)
```diff
@@ -303,4 +303,4 @@ func feature() {
 
 If you plan on synchronizing your local database to CloudKit so that your user's data is available
 on all of their devices, there is an additional step you must take. See
-<doc:CloudKit> for more information.
+<doc:CloudKitSync> for more information.
```

---

### Incident Patch 12: `9adec29a` (2026-04-28)
**Commit Message**: docs: fix a typo in `synchronize` (#452)

**File**: `Sources/SQLiteData/Documentation.docc/Articles/CloudKit.md` (modified, +1/-1)
```diff
@@ -223,7 +223,7 @@ facilitate synchronizing to CloudKit.
 
 Foreign keys are a SQL feature that allow one to express relationships between tables. This library
 uses that information to correctly implement synchronization behavior, such as knowing what order
-to syncrhonize records (parent first, then children), and knowing what associated records to
+to synchronize records (parent first, then children), and knowing what associated records to
 share when sharing a root record.
 
 To express a foreign key relationship between tables you use the `REFERENCES` clause in the table's
```

---

### Incident Patch 13: `6bb9d555` (2026-04-28)
**Commit Message**: docs: fix a repeated typo `after` in test comments (#453)

**File**: `Tests/SQLiteDataTests/CloudKitTests/ForeignKeyConstraintTests.swift` (modified, +2/-2)
```diff
@@ -599,7 +599,7 @@
       // * Create 3 reminders lists and a reminder
       // * Sync to CloudKit
       // * Move reminder to different list on CloudKit, do not synchronize it right away.
-      // * A moment ater, move local reminder to different list
+      // * A moment after, move local reminder to different list
       // * Sync CloudKit to local
       // * Then send local to CloudKit
       // => Local edit wins
@@ -695,7 +695,7 @@
       // * Create 3 reminders lists and a reminder
       // * Sync to CloudKit
       // * Move reminder to different list on CloudKit, do not synchronize it right away.
-      // * A moment ater, move local reminder to different list
+      // * A moment after, move local reminder to different list
       // * Send local data to CloudKit
       // * The synchronize CloudKit to local
       // => Local edit wins
```

---

### Incident Patch 14: `0eed8230` (2026-03-25)
**Commit Message**: Fix flakey delete() test.

**File**: `Tests/SQLiteDataTests/CloudKitTests/PreviewTests.swift` (modified, +1/-0)
```diff
@@ -87,6 +87,7 @@
         #expect(remindersLists.count == 0)
 
         await testClock.advance(by: .seconds(1))
+        try await $remindersLists.load()
         #expect(remindersLists.count == 0)
         assertInlineSnapshot(of: container, as: .customDump) {
           """
```

---

### Incident Patch 15: `da3a94ed` (2026-03-23)
**Commit Message**: Rename CKRecord.setValue overload to setBytes to fix unexpected Xcode 26.4 overload resolution (#425)

**File**: `Sources/SQLiteData/CloudKit/CloudKit+StructuredQueries.swift` (modified, +2/-2)
```diff
@@ -190,7 +190,7 @@
     }
 
     @discardableResult
-    package func setValue(
+    package func setBytes(
       _ newValue: [UInt8],
       forKey key: CKRecord.FieldKey,
       at userModificationTime: Int64
@@ -252,7 +252,7 @@
           let value = Value(queryOutput: row[keyPath: keyPath])
           switch value.queryBinding {
           case .blob(let value):
-            setValue(value, forKey: column.name, at: userModificationTime)
+            setBytes(value, forKey: column.name, at: userModificationTime)
           case .bool(let value):
             setValue(value, forKey: column.name, at: userModificationTime)
           case .double(let value):
```

**File**: `Tests/SQLiteDataTests/CloudKitTests/AssetsTests.swift` (modified, +1/-1)
```diff
@@ -285,7 +285,7 @@
           recordID: RemindersListAsset.recordID(for: 1)
         )
         remindersListAssetRecord.setValue("1", forKey: "id", at: now)
-        remindersListAssetRecord.setValue(
+        remindersListAssetRecord.setBytes(
           Array("image".utf8),
           forKey: "coverImage",
           at: now
```

**File**: `Tests/SQLiteDataTests/CloudKitTests/SchemaChangeTests.swift` (modified, +4/-4)
```diff
@@ -716,7 +716,7 @@
           let personalListRecord = try syncEngine.private.database.record(
             for: RemindersList.recordID(for: 1)
           )
-          personalListRecord.setValue(Array("image".utf8), forKey: "image", at: now)
+          personalListRecord.setBytes(Array("image".utf8), forKey: "image", at: now)
 
           try await syncEngine.modifyRecords(
             scope: .private,
@@ -775,15 +775,15 @@
           let personalListRecord = try syncEngine.private.database.record(
             for: RemindersList.recordID(for: 1)
           )
-          personalListRecord.setValue(Array("personal-image".utf8), forKey: "image", at: now)
+          personalListRecord.setBytes(Array("personal-image".utf8), forKey: "image", at: now)
           let businessListRecord = try syncEngine.private.database.record(
             for: RemindersList.recordID(for: 2)
           )
-          businessListRecord.setValue(Array("business-image".utf8), forKey: "image", at: now)
+          businessListRecord.setBytes(Array("business-image".utf8), forKey: "image", at: now)
           let secretListRecord = try syncEngine.private.database.record(
             for: RemindersList.recordID(for: 3)
           )
-          secretListRecord.setValue(Array("secret-image".utf8), forKey: "image", at: now)
+          secretListRecord.setBytes(Array("secret-image".utf8), forKey: "image", at: now)
 
           try await syncEngine.modifyRecords(
             scope: .private,
```

#### Recent Merged Pull Requests:
- **PR #546** (2026-09-14): Update CloudKit sync docs link (@DominikGrodl)
- **PR #544** (closed): Disable unused Sharing traits (@Econa77)
- **PR #540** (2026-08-29): StructuredQueries 0.38 support (@stephencelis)
- **PR #538** (2026-08-26): Nest temporary databases in a single directory (@stephencelis)
- **PR #537** (2026-08-26): Clean up test databases at exit (@stephencelis)
- **PR #533** (closed): feat: expose recovery actions only for recoverable `SyncEngine.SharingError`s (@MojtabaHs)
- **PR #532** (2026-08-31): User-defined collating sequences (@stephencelis)
- **PR #529** (2026-08-19): Use sectionBy in CloudKit demo. (@mbrandonw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
