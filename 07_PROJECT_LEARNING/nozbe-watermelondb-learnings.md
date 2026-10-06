# Forensic Learning Record (Deep Inspection): Nozbe/WatermelonDB

> **Canonical Artifact**: `07_PROJECT_LEARNING/nozbe-watermelondb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Nozbe/WatermelonDB](https://github.com/Nozbe/WatermelonDB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:37:34.543Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Nozbe/WatermelonDB`
- **Description**: 🍉 Reactive & asynchronous database for powerful React and React Native apps ⚡️
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11790 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `native/ios/WatermelonDB/FMDB/src/fmdb/FMDatabaseQueue.h`
```
//
//  FMDatabaseQueue.h
//  fmdb
//
//  Created by August Mueller on 6/22/11.
//  Copyright 2011 Flying Meat Inc. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "FMDatabase.h"

NS_ASSUME_NONNULL_BEGIN

/** To perform queries and updates on multiple threads, you'll want to use `FMDatabaseQueue`.

 Using a single instance of `<FMDatabase>` from multiple threads at once is a bad idea.  It has always been OK to make a `<FMDatabase>` object *per thread*.  Just don't share a single instance across threads, and definitely not across multiple threads at the same time.

 Instead, use `FMDatabaseQueue`. Here's how to use it:

 First, make your queue.

    FMDatabaseQueue *queue = [FMDatabaseQueue databaseQueueWithPath:aPath];

 Then use it like so:

    [queue inDatabase:^(FMDatabase *db) {
        [db executeUpdate:@"INSERT INTO myTable VALUES (?)", [NSNumber numberWithInt:1]];
        [db executeUpdate:@"INSERT INTO myTable VALUES (?)", [NSNumber numberWithInt:2]];
        [db executeUpdate:@"INSERT INTO myTable VALUES (?)", [NSNumber numberWithInt:3]];

        FMResultSet *rs = [db executeQuery:@"select * from foo"];
        while ([rs next]) {
            //…
        }
    }];

 An easy way to wrap things up in a transaction can be done like this:

    [queue inTransaction:^(FMDatabase *db, BOOL *rollback) {
        [db executeUpdate:@"INSERT INTO myTable VALUES (?)", [NSNumber numberWithInt:1]];
        [db executeUpdate:@"INSERT INTO myTable VALUES (?)", [NSNumber numberWithInt:2]];
        [db executeUpdate:@"INSERT INTO myTable VALUES (?)", [NSNumber numberWithInt:3]];

        if (whoopsSomethingWrongHappened) {
            *rollback = YES;
            return;
        }
        // etc…
        [db executeUpdate:@"INSERT INTO myTable VALUES (?)", [NSNumber numberWithInt:4]];
    }];

 `FMDatabaseQueue` will run the blocks on a serialized queue (hence the name of the class).  So if you call `FMDatabaseQueue`'s methods from multiple threads at the same time, they will be executed in the order they are received.  This way queries and updates won't step on each other's toes, and every one is happy.

 ### See also

 - `<FMDatabase>`

 @warning Do not instantiate a single `<FMDatabase>` object and use it across multiple threads. Use `FMDatabaseQueue` instead.
 
 @warning The calls to `FMDatabaseQueue`'s methods are blocking.  So even though you are passing along blocks, they will **not** be run on another thread.

 */

@interface FMDatabaseQueue : NSObject
/** Path of database */

@property (atomic, retain, nullable) NSString *path;

/** Open flags */

@property (atomic, readonly) int openFlags;

/**  Custom virtual file system name */

@property (atomic, copy, nullable) NSString *vfsName;

///----------------------------------------------------
/// @name Initialization, opening, and closing of queue
///----------------------------------------------------

/** Create queue using path.
 
 @param aPath The file path of the database.
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */

+ (nullable instancetype)databaseQueueWithPath:(NSString * _Nullable)aPath;

/** Create queue using file URL.
 
 @param url The file `NSURL` of the database.
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */

+ (nullable instancetype)databaseQueueWithURL:(NSURL * _Nullable)url;

/** Create queue using path and specified flags.
 
 @param aPath The file path of the database.
 @param openFlags Flags passed to the openWithFlags method of the database.
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */
+ (nullable instancetype)databaseQueueWithPath:(NSString * _Nullable)aPath flags:(int)openFlags;

/** Create queue using file URL and specified flags.
 
 @param url The file `NSURL` of the database.
 @param openFlags Flags passed to the openWithFlags method of the database.
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */
+ (nullable instancetype)databaseQueueWithURL:(NSURL * _Nullable)url flags:(int)openFlags;

/** Create queue using path.
 
 @param aPath The file path of the database.
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */

- (nullable instancetype)initWithPath:(NSString * _Nullable)aPath;

/** Create queue using file URL.
 
 @param url The file `NSURL of the database.
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */

- (nullable instancetype)initWithURL:(NSURL * _Nullable)url;

/** Create queue using path and specified flags.
 
 @param aPath The file path of the database.
 @param openFlags Flags passed to the openWithFlags method of the database.
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */

- (nullable instancetype)initWithPath:(NSString * _Nullable)aPath flags:(int)openFlags;

/** Create queue using file URL and specified flags.
 
 @param url The file path of the database.
 @param openFlags Flags passed to the openWithFlags method of the database.
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */

- (nullable instancetype)initWithURL:(NSURL * _Nullable)url flags:(int)openFlags;

/** Create queue using path and specified flags.
 
 @param aPath The file path of the database.
 @param openFlags Flags passed to the openWithFlags method of the database
 @param vfsName The name of a custom virtual file system
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */

- (nullable instancetype)initWithPath:(NSString * _Nullable)aPath flags:(int)openFlags vfs:(NSString * _Nullable)vfsName;

/** Create queue using file URL and specified flags.
 
 @param url The file `NSURL of the database.
 @param openFlags Flags passed to the openWithFlags method of the database
 @param vfsName The name of a custom virtual file system
 
 @return The `FMDatabaseQueue` object. `nil` on error.
 */

- (nullable instancetype)initWithURL:(NSURL * _Nullable)url flags:(int)openFlags vfs:(NSString * _Nullable)vfsName;

/** Returns the Class of 'FMDatabase' subclass, that will be used to instantiate database object.
 
 Subclasses can override this method to return specified Class of 'FMDatabase' subclass.
 
 @return The Class of 'FMDatabase' subclass, that will be used to instantiate database object.
 */

+ (Class)databaseClass;

/** Close database used by queue. */

- (void)close;

/** Interupt pending database operation. */

- (void)interrupt;

///-----------------------------------------------
/// @name Dispatching database operations to queue
///-----------------------------------------------

/** Synchronously perform database operations on queue.
 
 @param block The code to be run on the queue of `FMDatabaseQueue`
 */

- (void)inDatabase:(__attribute__((noescape)) void (^)(FMDatabase *db))block;

/** Synchronously perform database operations on queue, using transactions.

 @param block The code to be run on the queue of `FMDatabaseQueue`
 
 @warning    Unlike SQLite's `BEGIN TRANSACTION`, this method currently performs
             an exclusive transaction, not a deferred transaction. This behavior
             is likely to change in future versions of FMDB, whereby this method
             will likely eventually adopt standard SQLite behavior and perform
             deferred transactions. If you really need exclusive tranaction, it is
             recommended that you use `inExclusiveTransaction`, instead, not only
             to make your intent explicit, but also to future-proof your code.

 */

- (void)inTransaction:(__attribute__((noescape)) void (^)(FMDatabase *db, BOOL *rollback))block;

/** Synchronously perform database operations on queue, using deferred transactions.
 
 @param block The code to be run on the queue of `FMDatabaseQueue`
 */

- (void)inDeferredTransaction:(__attribute__((noescape)) void (^)(FMDatabase *db, BOOL *rollback))block;

/** Synchronously perform database operations on queue, using exclusive transactions.
 
 @param block The code to be run on the queue of `FMDatabaseQueue`
 */

- (void)inExclusiveTransaction:(__attribute__((noescape)) void (^)(FMDatabase *db, BOOL *rollback))block;

/** Synchronously perform database operations on queue, using immediate transactions.

 @param block The code to be run on the queue of `FMDatabaseQueue`
 */

- (void)inImmediateTransaction:(__attribute__((noescape)) void (^)(FMDatabase *db, BOOL *rollback))block;

///-----------------------------------------------
/// @name Dispatching database operations to queue
///-----------------------------------------------

/** Synchronously perform database operations using save point.

 @param block The code to be run on the queue of `FMDatabaseQueue`
 */

// NOTE: you can not nest these, since calling it will pull another database out of the pool and you'll get a deadlock.
// If you need to nest, use FMDatabase's startSavePointWithName:error: instead.
- (NSError * _Nullable)inSavePoint:(__attribute__((noescape)) void (^)(FMDatabase *db, BOOL *rollback))block;

///-----------------
/// @name Checkpoint
///-----------------

/** Performs a WAL checkpoint
 
 @param checkpointMode The checkpoint mode for sqlite3_wal_checkpoint_v2
 @param error The NSError corresponding to the error, if any.
 @return YES on success, otherwise NO.
 */
- (BOOL)checkpoint:(FMDBCheckpointMode)checkpointMode error:(NSError * _Nullable *)error;

/** Performs a WAL checkpoint
 
 @param checkpointMode The checkpoint mode for sqlite3_wal_checkpoint_v2
 @param name The db name for sqlite3_wal_checkpoint_v2
 @param error The NSError corresponding to the error, if any.
 @return YES on success, otherwise NO.
 */
- (BOOL)checkpoint:(FMDBCheckpointMode)checkpointMode name:(NSString * _Nullable)name error:(NSError * _Nullable *)error;

/** Performs a WAL checkpoint
 
 @param checkpointMode The checkpoint mode for sqlite3_wal_checkpoint_v2
 @param name The db name for sqlite3_wal_checkpoint_v2
 @param error The NSError corresponding to the error, if any.
 @param logFrameCount If not NULL, then this is set to the total number of frames in the log file or to -1 if the checkpoi
```

### Core Architecture Module: `src/Database/WorkQueue.d.ts`
```
import type Model from '../Model'
import type Database from './index'
import { $ReadOnlyArray } from '../types'

export interface ReaderInterface {
  callReader<T>(reader: () => Promise<T>): Promise<T>
}

export interface WriterInterface extends ReaderInterface {
  callWriter<T>(writer: () => Promise<T>): Promise<T>
  batch(...records: $ReadOnlyArray<Model | Model[] | null | void | false>): Promise<void>
}

type WorkQueueItem<T> = {
  work: (_: ReaderInterface | WriterInterface) => Promise<T>
  isWriter: boolean
  resolve: (value: T) => void
  reject: (reason: any) => void
  description?: string
}

export default class WorkQueue {
  _db: Database

  _queue: WorkQueueItem<any>[]

  _subActionIncoming: boolean

  constructor(db: Database)

  get isWriterRunning(): boolean

  enqueue<T>(
    work: (_: ReaderInterface | WriterInterface) => Promise<T>,
    description: string | undefined,
    isWriter: boolean,
  ): Promise<T>

  subAction<T>(work: () => Promise<T>): Promise<T>

  _executeNext(): Promise<void>

  _abortPendingWork(): void
}

```

### Core Architecture Module: `src/Database/WorkQueue.js`
```
// @flow
/* eslint-disable no-use-before-define */

import { invariant, logger } from '../utils/common'
import type Model from '../Model'
import type Database from './index'

export interface ReaderInterface {
  /**
   * Calls a Reader so that it runs as part of the current Reader (or Writer) instead of deadlocking.
   *
   * Specifically, the passed block should immediately call a method decorted with `@reader` or a
   * function whose implementation is wrapped in `db.read()` block.
   *
   * See docs for more details.
   *
   * @example
   * ```
   * db.read(async reader => {
   *   // ...
   *   reader.callReader(() => someOtherReader())
   * })
   * ```
   */
  callReader<T>(reader: () => Promise<T>): Promise<T>;
}

export interface WriterInterface extends ReaderInterface {
  /**
   * Calls another Writer so that it runs as part of the current Writer instead of deadlocking.
   *
   * Specifically, the passed block should immediately call a method decorated with `@writer` or
   * a function whose implementation is wrapped in `db.write()` block.
   *
   * See docs for more details.
   *
   * @example
   * ```
   * db.write(async writer => {
   *   // ...
   *   writer.callWriter(() => someOtherWriter())
   * })
   * ```
   */
  callWriter<T>(writer: () => Promise<T>): Promise<T>;

  /** @see {Database#batch} */
  batch(...records: $ReadOnlyArray<Model | Model[] | null | void | false>): Promise<void>;
}

class ReaderInterfaceImpl implements ReaderInterface {
  __workItem: WorkQueueItem<any>
  __workQueue: WorkQueue

  constructor(queue: WorkQueue, item: WorkQueueItem<any>): void {
    this.__workQueue = queue
    this.__workItem = item
  }

  __validateQueue(): void {
    invariant(
      this.__workQueue._queue[0] === this.__workItem,
      'Illegal call on a reader/writer that should no longer be running',
    )
  }

  callReader<T>(reader: () => Promise<T>): Promise<T> {
    this.__validateQueue()
    return this.__workQueue.subAction(reader)
  }
}

class WriterInterfaceImpl extends ReaderInterfaceImpl implements WriterInterface {
  callWriter<T>(writer: () => Promise<T>): Promise<T> {
    this.__validateQueue()
    return this.__workQueue.subAction(writer)
  }

  batch(...records: any): Promise<any> {
    this.__validateQueue()
    return this.__workQueue._db.batch(records)
  }
}

const actionInterface = (queue: WorkQueue, item: WorkQueueItem<any>) =>
  item.isWriter ? new WriterInterfaceImpl(queue, item) : new ReaderInterfaceImpl(queue, item)

type WorkQueueItem<T> = $Exact<{
  work: (ReaderInterface | WriterInterface) => Promise<T>,
  isWriter: boolean,
  resolve: (value: T) => void,
  reject: (reason: any) => void,
  description: ?string,
}>

export default class WorkQueue {
  _db: Database

  _queue: WorkQueueItem<any>[] = []

  _subActionIncoming: boolean = false

  constructor(db: Database): void {
    this._db = db
  }

  get isWriterRunning(): boolean {
    const [item] = this._queue
    return Boolean(item && item.isWriter)
  }

  enqueue<T>(
    work: ($FlowFixMe<ReaderInterface | WriterInterface>) => Promise<T>,
    description: ?string,
    isWriter: boolean,
  ): Promise<T> {
    // If a subAction was scheduled using subAction(), database.write/read() calls skip the line
    if (this._subActionIncoming) {
      this._subActionIncoming = false
      const currentWork = this._queue[0]
      if (!currentWork.isWriter) {
        invariant(!isWriter, 'Cannot call a writer block from a reader block')
      }
      return work(actionInterface(this, currentWork))
    }

    return new Promise((resolve, reject) => {
      const workItem: WorkQueueItem<T> = { work, isWriter, resolve, reject, description }

      if (process.env.NODE_ENV !== 'production' && this._queue.length) {
        setTimeout(() => {
          const queue = this._queue
          const current = queue[0]
          if (current === workItem || !queue.includes(workItem)) {
            return
          }

          const enqueuedKind = isWriter ? 'writer' : 'reader'
          const currentKind = current.isWriter ? 'writer' : 'reader'
          logger.warn(
            `The ${enqueuedKind} you're trying to run (${
              description || 'unnamed'
            }) can't be performed yet, because there are ${
              queue.length
            } other readers/writers in the queue.\n\nCurrent ${currentKind}: ${
              current.description || 'unnamed'
            }.\n\nIf everything is working fine, you can safely ignore this message (queueing is working as expected). But if your readers/writers are not running, it's because the current ${currentKind} is stuck.\nRemember that if you're calling a reader/writer from another reader/writer, you must use callReader()/callWriter(). See docs for more details.`,
          )
          logger.log(`Enqueued ${enqueuedKind}:`, work)
          logger.log(`Running ${currentKind}:`, current.work)
        }, 1500)
      }

      this._queue.push(workItem)

      if (this._queue.length === 1) {
        this._executeNext()
      }
    })
  }

  subAction<T>(work: () => Promise<T>): Promise<T> {
    try {
      this._subActionIncoming = true
      const promise = work()
      invariant(
        !this._subActionIncoming,
        'callReader/callWriter call must call a reader/writer synchronously',
      )
      return promise
    } catch (error) {
      this._subActionIncoming = false
      return Promise.reject(error)
    }
  }

  async _executeNext(): Promise<void> {
    const workItem = this._queue[0]
    const { work, resolve, reject, isWriter } = workItem

    try {
      const workPromise = work(actionInterface(this, workItem))

      if (process.env.NODE_ENV !== 'production') {
        invariant(
          workPromise instanceof Promise,
          `The function passed to database.${
            isWriter ? 'write' : 'read'
          }() or a method marked as @${
            isWriter ? 'writer' : 'reader'
          } must be asynchronous (marked as 'async' or always returning a promise) (in: ${
            workItem.description || 'unnamed'
          })`,
        )
      }

      resolve(await workPromise)
    } catch (error) {
      reject(error)
    }

    this._queue.shift()

    if (this._queue.length) {
      setTimeout(() => this._executeNext(), 0)
    }
  }

  _abortPendingWork(): void {
    invariant(this._queue.length >= 1, '_abortPendingWork can only be called from a reader/writer')
    const workToAbort = this._queue.splice(1) // leave only the caller on the queue
    workToAbort.forEach(({ reject }) => {
      reject(new Error('Reader/writer has been aborted because the database was reset'))
    })
  }
}

```

### Core Architecture Module: `src/adapters/lokijs/worker/DatabaseBridge.js`
```
// @flow

// don't import whole `utils` to keep worker size small
import type { Result } from '../../../utils/fp/Result'
import logError from '../../../utils/common/logError'
import invariant from '../../../utils/common/invariant'

import DatabaseDriver from './DatabaseDriver'
import type {
  WorkerAction,
  WorkerExecutorType,
  WorkerExecutorPayload,
  WorkerResponseData,
} from '../common'

export default class DatabaseBridge {
  workerContext: DedicatedWorkerGlobalScope

  driver: ?DatabaseDriver

  queue: WorkerAction[] = []

  _actionsExecuting: number = 0

  constructor(workerContext: DedicatedWorkerGlobalScope): void {
    this.workerContext = workerContext
    this.workerContext.onmessage = (e: MessageEvent) => {
      const action: WorkerAction = (e.data: any)
      // enqueue action
      this.queue.push(action)

      if (this.queue.length === 1) {
        this.executeNext()
      }
    }
  }

  executeNext(): void {
    const action = this.queue[0]
    try {
      invariant(this._actionsExecuting === 0, 'worker should not have ongoing actions') // sanity check
      this._actionsExecuting += 1

      const { type, payload } = action

      if (type === 'setUp' || type === 'unsafeResetDatabase') {
        this.processActionAsync(action)
      } else {
        const response = this._driverAction(type)(...payload)
        this.onActionDone(action, { value: response })
      }
    } catch (error) {
      this._onError(action, error)
    }
  }

  async processActionAsync(action: WorkerAction): Promise<void> {
    try {
      const { type, payload } = action

      if (type === 'setUp') {
        // app just launched, set up driver with options sent
        invariant(!this.driver, `Loki driver already set up - cannot set up again`)
        const [options] = payload
        const driver = new DatabaseDriver(options)

        // set up, make this.driver available only if successful
        await driver.setUp()
        this.driver = driver

        this.onActionDone(action, { value: null })
      } else {
        const response = await this._driverAction(type)(...payload)
        this.onActionDone(action, { value: response })
      }
    } catch (error) {
      this._onError(action, error)
    }
  }

  onActionDone(action: WorkerAction, result: Result<WorkerResponseData>): void {
    invariant(this._actionsExecuting === 1, 'worker should be executing 1 action') // sanity check
    this._actionsExecuting = 0
    this.queue.shift()

    try {
      const response = { id: action.id, result, cloneMethod: action.returnCloneMethod }
      this.workerContext.postMessage(response)
    } catch (error) {
      logError(error)
    }

    if (this.queue.length) {
      this.executeNext()
    }
  }

  _driverAction(type: WorkerExecutorType): (WorkerExecutorPayload) => WorkerResponseData {
    invariant(this.driver, `Cannot run actions because driver is not set up`)
    const action = (this.driver: any)[type].bind(this.driver)
    invariant(action, `Unknown worker action ${type}`)
    return action
  }

  _onError(action: WorkerAction, error: any): void {
    // Main process only receives error message (when using web workers) — this logError is to retain call stack
    logError(error)
    this.onActionDone(action, { error })
  }
}

```

### Core Architecture Module: `src/adapters/lokijs/worker/DatabaseDriver.js`
```
// @flow

// don't import the whole utils/ here!
import logger from '../../../utils/common/logger'
import invariant from '../../../utils/common/invariant'

import type {
  CachedQueryResult,
  CachedFindResult,
  BatchOperation,
  UnsafeExecuteOperations,
} from '../../type'
import type { TableName, AppSchema, SchemaVersion, TableSchema } from '../../../Schema'
import type {
  SchemaMigrations,
  CreateTableMigrationStep,
  AddColumnsMigrationStep,
  MigrationStep,
} from '../../../Schema/migrations'
import type { SerializedQuery } from '../../../Query'
import type { RecordId } from '../../../Model'
import { type RawRecord, sanitizedRaw, setRawSanitized, type DirtyRaw } from '../../../RawRecord'
import type { Loki, LokiCollection } from '../type'

import { newLoki, deleteDatabase, lokiFatalError } from './lokiExtensions'
import { executeQuery, executeCount } from './executeQuery'

import type { LokiAdapterOptions } from '../index'

const SCHEMA_VERSION_KEY = '_loki_schema_version'

let experimentalAllowsFatalError = false

export function setExperimentalAllowsFatalError(): void {
  experimentalAllowsFatalError = true
}

export default class DatabaseDriver {
  options: LokiAdapterOptions

  schema: AppSchema

  migrations: ?SchemaMigrations

  loki: Loki

  cachedRecords: Map<TableName<any>, Set<RecordId>> = new Map()

  // (experimental) if true, DatabaseDriver is in a broken state and should not be used anymore
  _isBroken: boolean = false

  constructor(options: LokiAdapterOptions): void {
    const { schema, migrations } = options
    this.options = options
    this.schema = schema
    this.migrations = migrations
  }

  async setUp(): Promise<void> {
    await this._openDatabase()
    await this._migrateIfNeeded()
  }

  isCached(table: TableName<any>, id: RecordId): boolean {
    const cachedSet = this.cachedRecords.get(table)
    return cachedSet ? cachedSet.has(id) : false
  }

  markAsCached(table: TableName<any>, id: RecordId): void {
    const cachedSet = this.cachedRecords.get(table)
    if (cachedSet) {
      cachedSet.add(id)
    } else {
      this.cachedRecords.set(table, new Set([id]))
    }
  }

  removeFromCache(table: TableName<any>, id: RecordId): void {
    const cachedSet = this.cachedRecords.get(table)
    if (cachedSet) {
      cachedSet.delete(id)
    }
  }

  clearCachedRecords(): void {
    this.cachedRecords = new Map()
  }

  getCache(table: TableName<any>): Set<RecordId> {
    const cache = this.cachedRecords.get(table)
    if (cache) {
      return cache
    }

    const newCache = new Set([])
    this.cachedRecords.set(table, newCache)
    return newCache
  }

  find(table: TableName<any>, id: RecordId): CachedFindResult {
    if (this.isCached(table, id)) {
      return id
    }

    const raw = this.loki.getCollection(table).by('id', id)

    if (!raw) {
      return null
    }

    this.markAsCached(table, id)
    return sanitizedRaw(raw, this.schema.tables[table])
  }

  query(query: SerializedQuery): CachedQueryResult {
    const records = executeQuery(query, this.loki)
    return this._compactQueryResults(records, query.table)
  }

  queryIds(query: SerializedQuery): RecordId[] {
    return executeQuery(query, this.loki).map((record) => record.id)
  }

  unsafeQueryRaw(query: SerializedQuery): any[] {
    return executeQuery(query, this.loki)
  }

  count(query: SerializedQuery): number {
    return executeCount(query, this.loki)
  }

  batch(operations: BatchOperation[]): void {
    // NOTE: Mutations to LokiJS db are *not* transactional!
    // This is terrible and lame for a database, but there's just no simple and good solution to this
    // Loki transactions rely on making a full copy of the data, and reverting to it if something breaks.
    // This is just unbearable for production-sized databases (too much memory required)
    // It could be done with some sort of advanced journaling/CoW structure scheme, but that would
    // be very complicated (in itself a source of bugs), and possibly quite expensive cpu-wise
    //
    // So instead, we assume that writes MUST succeed. If they don't, we put DatabaseDriver in a "broken"
    // state, refuse to persist or further mutate the DB, and notify the app (and user) about it.
    //
    // It can be assumed that Loki-level mutations that fail are WatermelonDB bugs that must be fixed
    this._assertNotBroken()
    try {
      const recordsToCreate: { [TableName<any>]: RawRecord[] } = {}

      operations.forEach((operation) => {
        const [type, table, raw] = operation
        switch (type) {
          case 'create':
            if (!recordsToCreate[table]) {
              recordsToCreate[table] = []
            }
            recordsToCreate[table].push((raw: $FlowFixMe<RawRecord>))

            break
          default:
            break
        }
      })

      // We're doing a second pass, because batch insert is much faster in Loki
      Object.entries(recordsToCreate).forEach((args: any) => {
        const [table, raws]: [TableName<any>, RawRecord[]] = args
        const shouldRebuildIndexAfterInsert = raws.length >= 1000 // only profitable for large inserts
        this.loki.getCollection(table).insert(raws, shouldRebuildIndexAfterInsert)

        const cache = this.getCache(table)
        raws.forEach((raw) => {
          cache.add(raw.id)
        })
      })

      operations.forEach((operation) => {
        const [type, table, rawOrId] = operation
        const collection = this.loki.getCollection(table)

        switch (type) {
          case 'update': {
            // Loki identifies records using internal $loki ID so we must find the saved record first
            const lokiId = collection.by('id', (rawOrId: any).id).$loki
            const raw: DirtyRaw = rawOrId
            raw.$loki = lokiId
            collection.update(raw)
            break
          }
          case 'markAsDeleted': {
            const id: RecordId = (rawOrId: any)
            const record = collection.by('id', id)
            if (record) {
              record._status = 'deleted'
              collection.update(record)
              this.removeFromCache(table, id)
            }
            break
          }
          case 'destroyPermanently': {
            const id: RecordId = (rawOrId: any)
            const record = collection.by('id', id)
            record && collection.remove(record)
            this.removeFromCache(table, id)
            break
          }
          default:
            break
        }
      })
    } catch (error) {
      this._fatalError(error)
    }
  }

  getDeletedRecords(table: TableName<any>): RecordId[] {
    return this.loki
      .getCollection(table)
      .find({ _status: { $eq: 'deleted' } })
      .map((record) => record.id)
  }

  unsafeExecute(operations: UnsafeExecuteOperations): void {
    if (process.env.NODE_ENV !== 'production') {
      invariant(
        operations &&
          typeof operations === 'object' &&
          Object.keys(operations).length === 1 &&
          typeof operations.loki === 'function',
        'unsafeExecute expects an { loki: loki => { ... } } object',
      )
    }
    const lokiBlock: (Loki) => void = (operations: any).loki
    lokiBlock(this.loki)
  }

  async unsafeResetDatabase(): Promise<void> {
    await deleteDatabase(this.loki)

    this.cachedRecords.clear()
    logger.log('[Loki] Database is now reset')

    await this._openDatabase()
    this._setUpSchema()
  }

  // *** LocalStorage ***

  getLocal(key: string): ?string {
    const record = this._findLocal(key)
    return record ? record.value : null
  }

  setLocal(key: string, value: string): void {
    this._assertNotBroken()
    try {
      const record = this._findLocal(key)

      if (record) {
        record.value = value
        this._localStorage.update(record)
      } else {
        const newRecord = { key, value }
        this._localStorage.insert(newRecord)
      }
    } catch (error) {
      this._fatalError(error)
    }
  }

  removeLocal(key: string): void {
    this._assertNotBroken()
    try {
      const record = this._findLocal(key)

      if (record) {
        this._localStorage.remove(record)
      }
    } catch (error) {
      this._fatalError(error)
    }
  }

  // *** Internals ***

  async _openDatabase(): Promise<void> {
    logger.log('[Loki] Initializing IndexedDB')

    this.loki = await newLoki(this.options)

    logger.log('[Loki] Database loaded')
  }

  _setUpSchema(): void {
    logger.log('[Loki] Setting up schema')

    // Add collections
    const tables: TableSchema[] = (Object.values(this.schema.tables): any)
    tables.forEach((tableSchema) => {
      this._addCollection(tableSchema)
    })

    this.loki.addCollection('local_storage', {
      unique: ['key'],
      indices: [],
      disableMeta: true,
    })

    // Set database version
    this._databaseVersion = this.schema.version

    logger.log('[Loki] Database collections set up')
  }

  _addCollection(tableSchema: TableSchema): void {
    const { name, columnArray } = tableSchema
    const indexedColumns: string[] = columnArray.reduce(
      (indexes: string[], column) =>
        column.isIndexed ? indexes.concat([(column.name: string)]) : indexes,
      [],
    )

    this.loki.addCollection(name, {
      unique: ['id'],
      indices: ['_status', ...indexedColumns],
      disableMeta: true,
    })
  }

  get _databaseVersion(): SchemaVersion {
    const databaseVersionRaw = this.getLocal(SCHEMA_VERSION_KEY) || ''
    return parseInt(databaseVersionRaw, 10) || 0
  }

  set _databaseVersion(version: SchemaVersion): void {
    this.setLocal(SCHEMA_VERSION_KEY, `${version}`)
  }

  async _migrateIfNeeded(): Promise<void> {
    const dbVersion = this._databaseVersion
    const schemaVersion = this.schema.version

    if (dbVersion === schemaVersion) {
      // All good!
    } else if (dbVersion === 0) {
      logger.log('[Loki] Empty database, setting up')
      await this.unsafeResetDatabase()
    } else
```

### Core Architecture Module: `src/adapters/lokijs/worker/cloneMessage/index.js`
```
// @flow

// shallow-clones objects (without checking their contents), but copies arrays
export function shallowCloneDeepObjects(value: any): any {
  if (Array.isArray(value)) {
    const returned = new Array(value.length)
    for (let i = 0, len = value.length; i < len; i += 1) {
      returned[i] = shallowCloneDeepObjects(value[i])
    }
    return returned
  } else if (value && typeof value === 'object') {
    return Object.assign({}, value)
  }

  return value
}

export default function cloneMessage(data: any): any {
  // TODO: Even better, it would be great if we had zero-copy architecture (COW RawRecords?) and we didn't have to clone
  const method = data.cloneMethod
  if (method === 'shallowCloneDeepObjects') {
    const clonedData = data
    clonedData.payload = shallowCloneDeepObjects(clonedData.payload)
    return clonedData
  } else if (method === 'immutable') {
    // we get a pinky promise that the payload is immutable so we don't need to copy
    return data
  }

  throw new Error('Unknown data.clone method for cloneMessage')
}

```

### Core Architecture Module: `src/adapters/lokijs/worker/encodeQuery/index.js`
```
// @flow
/* eslint-disable no-use-before-define */

// don't import whole `utils` to keep worker size small
import invariant from '../../../../utils/common/invariant'
import likeToRegexp from '../../../../utils/fp/likeToRegexp'

import type { QueryAssociation, SerializedQuery } from '../../../../Query'
import type {
  Operator,
  WhereDescription,
  On,
  And,
  Or,
  Where,
  Clause,
  Comparison,
} from '../../../../QueryDescription'
import { type TableName, type ColumnName } from '../../../../Schema'

export type LokiRawQuery = Object | typeof undefined
type LokiOperator =
  | '$aeq'
  | '$eq'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$ne'
  | '$in'
  | '$nin'
  | '$between'
  | '$regex'
  | '$containsString'
type LokiKeyword = LokiOperator | '$and' | '$or'

export type LokiJoin = $Exact<{
  table: TableName<any>,
  query: LokiRawQuery,
  mapKey: ColumnName,
  joinKey: ColumnName,
}>

export type LokiQuery = $Exact<{
  table: TableName<any>,
  query: LokiRawQuery,
  hasJoins: boolean,
}>

const weakNotNull = { $not: { $aeq: null } }

const encodeComparison = (comparison: Comparison, value: any): LokiRawQuery => {
  // TODO: It's probably possible to improve performance of those operators by making them
  // binary-search compatible (i.e. don't use $and, $not)
  // TODO: We might be able to use $jgt, $jbetween, etc. — but ensure the semantics are right
  // and it won't break indexing

  const { operator } = comparison

  if (comparison.right.column) {
    // Encode for column comparisons
    switch (operator) {
      case 'eq':
        return { $$aeq: value }
      case 'notEq':
        return { $not: { $$aeq: value } }
      case 'gt':
        return { $$gt: value }
      case 'gte':
        return { $$gte: value }
      case 'weakGt':
        return { $$gt: value }
      case 'lt':
        return { $and: [{ $$lt: value }, weakNotNull] }
      case 'lte':
        return { $and: [{ $$lte: value }, weakNotNull] }
      default:
        throw new Error(`Illegal operator ${operator} for column comparisons`)
    }
  } else {
    switch (operator) {
      case 'eq':
        return { $aeq: value }
      case 'notEq':
        return { $not: { $aeq: value } }
      case 'gt':
        return { $gt: value }
      case 'gte':
        return { $gte: value }
      case 'weakGt':
        return { $gt: value } // Note: yup, this is correct (for non-column comparisons)
      case 'lt':
        return { $and: [{ $lt: value }, weakNotNull] }
      case 'lte':
        return { $and: [{ $lte: value }, weakNotNull] }
      case 'oneOf':
        return { $in: value }
      case 'notIn':
        return { $and: [{ $nin: value }, weakNotNull] }
      case 'between':
        return { $between: value }
      case 'like':
        return { $regex: likeToRegexp(value) }
      case 'notLike':
        return {
          $and: [{ $not: { $eq: null } }, { $not: { $regex: likeToRegexp(value) } }],
        }
      case 'includes':
        return { $containsString: value }
      default:
        throw new Error(`Unknown operator ${operator}`)
    }
  }
}

const columnCompRequiresColumnNotNull: { [$FlowFixMe<Operator>]: boolean } = {
  gt: true,
  gte: true,
  lt: true,
  lte: true,
}

const encodeWhereDescription: (WhereDescription) => LokiRawQuery = ({ left, comparison }) => {
  const { operator, right } = comparison
  const col: string = left
  // $FlowFixMe - NOTE: order of ||s is important here, since .value can be falsy, but .column and .values are either truthy or are undefined
  const comparisonRight: any = right.column || right.values || right.value

  if (typeof right.value === 'string') {
    // we can do fast path as we know that eq and aeq do the same thing for strings
    if (operator === 'eq') {
      return { [col]: { $eq: comparisonRight } }
    } else if (operator === 'notEq') {
      return { [col]: { $ne: comparisonRight } }
    }
  }
  const colName: ?string = (right: any).column
  const encodedComparison = encodeComparison(comparison, comparisonRight)

  if (colName && columnCompRequiresColumnNotNull[operator]) {
    return { $and: [{ [col]: encodedComparison }, { [colName]: weakNotNull }] }
  }
  return { [col]: encodedComparison }
}

const encodeCondition: (QueryAssociation[]) => (Clause) => LokiRawQuery =
  (associations) => (clause) => {
    switch (clause.type) {
      case 'and':
        return encodeAnd(associations, clause)
      case 'or':
        return encodeOr(associations, clause)
      case 'where':
        return encodeWhereDescription(clause)
      case 'on':
        return encodeJoin(associations, clause)
      case 'loki':
        return clause.expr
      default:
        throw new Error(`Unknown clause ${clause.type}`)
    }
  }

const encodeConditions: (QueryAssociation[], Where[]) => LokiRawQuery[] = (
  associations,
  conditions,
) => conditions.map(encodeCondition(associations))

const encodeAndOr =
  (op: LokiKeyword) =>
  (associations: QueryAssociation[], clause: And | Or): LokiRawQuery => {
    const conditions = encodeConditions(associations, clause.conditions)
    // flatten
    return conditions.length === 1
      ? conditions[0]
      : // $FlowFixMe
        { [op]: conditions }
  }

const encodeAnd: (QueryAssociation[], And) => LokiRawQuery = encodeAndOr('$and')
const encodeOr: (QueryAssociation[], Or) => LokiRawQuery = encodeAndOr('$or')

// Note: empty query returns `undefined` because
// Loki's Collection.count() works but count({}) doesn't
const concatRawQueries = (queries: LokiRawQuery[]): LokiRawQuery => {
  switch (queries.length) {
    case 0:
      return undefined
    case 1:
      return queries[0]
    default:
      return { $and: queries }
  }
}

const encodeRootConditions: (QueryAssociation[], Where[]) => LokiRawQuery = (
  associations,
  conditions,
) => concatRawQueries(encodeConditions(associations, conditions))

const encodeJoin = (associations: QueryAssociation[], on: On): LokiRawQuery => {
  const { table, conditions } = on
  const association = associations.find(({ to }) => table === to)
  invariant(
    association,
    'To nest Q.on inside Q.and/Q.or you must explicitly declare Q.experimentalJoinTables at the beginning of the query',
  )
  const { info } = association
  return {
    $join: {
      table,
      query: encodeRootConditions(associations, (conditions: any)),
      mapKey: info.type === 'belongs_to' ? 'id' : info.foreignKey,
      joinKey: info.type === 'belongs_to' ? info.key : 'id',
    },
  }
}

export default function encodeQuery(query: SerializedQuery): LokiQuery {
  const {
    table,
    description: { where, joinTables, sql },
    associations,
  } = query

  invariant(!sql, '[Loki] Q.unsafeSqlQuery are not supported with LokiJSAdapter')

  return {
    table,
    query: encodeRootConditions(associations, where),
    hasJoins: !!joinTables.length,
  }
}

```

### Core Architecture Module: `src/adapters/lokijs/worker/executeQuery.js`
```
// @flow

import type { SerializedQuery } from '../../../Query'

import type { DirtyRaw } from '../../../RawRecord'

import encodeQuery from './encodeQuery'
import performJoins from './performJoins'
import type { Loki, LokiResultset } from '../type'
import type { LokiJoin } from './encodeQuery'

// Finds IDs of matching records on foreign table
function performJoin(join: LokiJoin, loki: Loki): DirtyRaw[] {
  const { table, query } = join

  const collection = loki.getCollection(table).chain()
  const records = collection.find(query).data()

  return records
}

function performQuery(query: SerializedQuery, loki: Loki): LokiResultset {
  // Step one: perform all inner queries (JOINs) to get the single table query
  const lokiQuery = encodeQuery(query)
  const mainQuery = performJoins(lokiQuery, (join) => performJoin(join, loki))

  // Step two: fetch all records matching query
  const collection = loki.getCollection(query.table).chain()
  let resultset = collection.find(mainQuery)

  // Step three: sort, skip, take
  const { sortBy, take, skip } = query.description
  if (sortBy.length) {
    resultset = resultset.compoundsort(
      sortBy.map(({ sortColumn, sortOrder }) => [sortColumn, sortOrder === 'desc']),
    )
  }
  if (skip) {
    resultset = resultset.offset(skip)
  }
  if (take) {
    resultset = resultset.limit(take)
  }

  return resultset
}

export function executeQuery(query: SerializedQuery, loki: Loki): DirtyRaw[] {
  const { lokiTransform } = query.description
  const results = performQuery(query, loki).data()

  if (lokiTransform) {
    return lokiTransform(results, loki)
  }

  return results
}

export function executeCount(query: SerializedQuery, loki: Loki): number {
  const { lokiTransform } = query.description
  const resultset = performQuery(query, loki)

  if (lokiTransform) {
    const records = lokiTransform(resultset.data(), loki)
    return records.length
  }
  return resultset.count()
}

```

### Core Architecture Module: `src/adapters/lokijs/worker/loki.worker.js`
```
// @flow
/* eslint-disable no-restricted-globals */

import DatabaseBridge from './DatabaseBridge'
import type Worker from './synchronousWorker'

const getDefaultExport = (): any => {
  self.workerClass = new DatabaseBridge(self)
  return self
}

export default (getDefaultExport(): Worker)

```

### Core Architecture Module: `src/adapters/lokijs/worker/lokiExtensions.js`
```
// @flow
/* eslint-disable no-undef */

// don't import the whole utils/ here!
import logger from '../../../utils/common/logger'
import type { LokiAdapterOptions } from '../index'
import type { Loki } from '../type'

const isIDBAvailable = (onQuotaExceededError: ?(error: Error) => void) => {
  return new Promise((resolve) => {
    // $FlowFixMe
    if (typeof indexedDB === 'undefined') {
      resolve(false)
    }

    // in Firefox private mode, IDB will be available, but will fail to open
    // $FlowFixMe
    const checkRequest: IDBOpenDBRequest = indexedDB.open('WatermelonIDBChecker')
    checkRequest.onsuccess = (e) => {
      const db: IDBDatabase = e.target.result
      db.close()
      resolve(true)
    }
    checkRequest.onerror = (event) => {
      const error: ?Error = event?.target?.error
      // this is what Firefox in Private Mode returns:
      // DOMException: "A mutation operation was attempted on a database that did not allow mutations."
      // code: 11, name: InvalidStateError
      logger.error(
        '[Loki] IndexedDB checker failed to open. Most likely, user is in Private Mode. It could also be a quota exceeded error. Will fall back to in-memory database.',
        event,
        error,
      )
      if (error && error.name === 'QuotaExceededError') {
        logger.log('[Loki] Looks like disk quota was exceeded: ', error)
        onQuotaExceededError && onQuotaExceededError(error)
      }
      resolve(false)
    }
    checkRequest.onblocked = () => {
      logger.error('IndexedDB checker call is blocked')
    }
  })
}

async function getLokiAdapter(options: LokiAdapterOptions): mixed {
  const {
    useIncrementalIndexedDB,
    _testLokiAdapter: adapter,
    onQuotaExceededError,
    dbName,
    extraIncrementalIDBOptions = {},
  } = options
  if (adapter) {
    return adapter
  } else if (await isIDBAvailable(onQuotaExceededError)) {
    if (useIncrementalIndexedDB) {
      const IncrementalIDBAdapter = options._betaLoki
        ? require('lokijs/src/incremental-indexeddb-adapter')
        : require('lokijs/src/incremental-indexeddb-adapter')
      // $FlowFixMe
      return new IncrementalIDBAdapter(extraIncrementalIDBOptions)
    }
    const LokiIndexedAdapter = require('lokijs/src/loki-indexed-adapter')
    return new LokiIndexedAdapter(dbName)
  }

  // if IDB is unavailable (that happens in private mode), fall back to memory adapter
  // we could also fall back to localstorage adapter, but it will fail in all but the smallest dbs
  const { LokiMemoryAdapter } = options._betaLoki ? require('lokijs') : require('lokijs')
  return new LokiMemoryAdapter()
}

export async function newLoki(options: LokiAdapterOptions): Loki {
  const { extraLokiOptions = {} } = options
  const LokiDb = options._betaLoki ? require('lokijs') : require('lokijs')
  // $FlowFixMe
  const loki: Loki = new LokiDb(options.dbName, {
    adapter: await getLokiAdapter(options),
    autosave: true,
    autosaveInterval: 500,
    verbose: true,
    ...extraLokiOptions,
  })

  // force load database now
  await new Promise((resolve, reject) => {
    loki.loadDatabase({}, (error) => {
      error ? reject(error) : resolve()
    })
  })

  return loki
}

export async function deleteDatabase(loki: Loki): Promise<void> {
  await new Promise((resolve, reject) => {
    // Works around a race condition - Loki doesn't disable autosave or drain save queue before
    // deleting database, so it's possible to delete and then have the database be saved
    loki.close(() => {
      loki.deleteDatabase({}, (response) => {
        // LokiIndexedAdapter responds with `{ success: true }`, while
        // LokiMemory adapter just calls it with no params
        if ((response && response.success) || response === undefined) {
          resolve()
        } else {
          reject(response)
        }
      })
    })
  })
}

// In case of a fatal error, break Loki so that it cannot save its contents to disk anymore
// This might result in a loss of data in recent changes, but we assume that whatever caused the
// fatal error has corrupted the database, so we want to prevent it from being persisted
// There's no recovery from this, app must be restarted with a fresh LokiJSAdapter.
export function lokiFatalError(loki: Loki): void {
  try {
    // below is some very ugly defensive coding, but we're fatal and don't trust anyone anymore
    const fatalHandler = () => {
      throw new Error('Illegal attempt to save Loki database after a fatal error')
    }
    loki.save = fatalHandler
    loki.saveDatabase = fatalHandler
    loki.saveDatabaseInternal = fatalHandler
    // disable autosave
    loki.autosave = false
    loki.autosaveDisable()
    // close db
    loki.close()
  } catch (error) {
    logger.error('Failed to perform loki fatal error')
    logger.error(error)
  }
}

```

### Core Architecture Module: `src/adapters/lokijs/worker/performJoins/index.js`
```
// @flow

import type { LokiQuery, LokiJoin, LokiRawQuery } from '../encodeQuery'
import type { DirtyRaw } from '../../../../RawRecord'

type QueryPerformer = (join: LokiJoin) => DirtyRaw[]

function performJoinsImpl(query: LokiRawQuery, performer: QueryPerformer): LokiRawQuery {
  if (!query) {
    return query
  } else if (query.$join) {
    const join: LokiJoin = query.$join
    const joinQuery = performJoinsImpl(join.query, performer)
    join.query = joinQuery
    const records = performer(join)

    // for queries on `belongs_to` tables, matchingIds will be IDs of the parent table records
    //   (e.g. task: { project_id in ids })
    // and for `has_many` tables, it will be IDs of the main table records
    //   (e.g. task: { id in (ids from tag_assignment.task_id) })
    const matchingIds = records.map((record) => record[join.mapKey])
    return { [(join.joinKey: string)]: { $in: matchingIds } }
  } else if (query.$and) {
    return { $and: query.$and.map((clause) => performJoinsImpl(clause, performer)) }
  } else if (query.$or) {
    return { $or: query.$or.map((clause) => performJoinsImpl(clause, performer)) }
  }
  return query
}

export default function performJoins(
  lokiQuery: LokiQuery,
  performer: QueryPerformer,
): LokiRawQuery {
  const { query, hasJoins } = lokiQuery

  if (!hasJoins) {
    return query
  }

  return performJoinsImpl(query, performer)
}

```

### Core Architecture Module: `src/adapters/lokijs/worker/synchronousWorker.js`
```
// @flow

import DatabaseBridge from './DatabaseBridge'
import cloneMessage from './cloneMessage'

// Simulates the web worker API
export default class SynchronousWorker {
  _bridge: DatabaseBridge

  _workerContext: DedicatedWorkerGlobalScope

  onmessage: ({ data: any }) => void = () => {}

  constructor(): void {
    // $FlowFixMe
    this._workerContext = {
      postMessage: (data) => {
        this.onmessage({ data: cloneMessage(data) })
      },
      onmessage: () => {},
    }
    // $FlowFixMe
    this._bridge = new DatabaseBridge(this._workerContext)
  }

  postMessage(data: any): void {
    this._workerContext.onmessage(({ data: cloneMessage(data) }: any))
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1976** (2026-09-11): **The documentation page/website is not working...**
  *Symptoms*: Environment: Kolkata, India Problem: Documentation page won't load. Symptom: Browser freezes at TLS handshake with watermelon.dev; connection reset (PR_CONNECT_RESET_ERROR).

- **Issue #1972** (2026-08-18): **Chore/add agents md**
  *Symptoms*: 

- **Issue #1960** (2026-02-16): **fix: ENT-1500 upgrade OpenSSL for 16KB page size compliance**
  *Symptoms*: ## Summary - Replace `com.android.ndk.thirdparty:openssl:1.1.1l-beta-1` with `io.github.ronickg:openssl:3.6.0-1` - OpenSSL 3.6.0 is the first version with native 16KB ELF alignment for Android - The SQLCipher amalgamation already has OpenSSL 3.x dual-path support (conditional compilation at line ~107971 of sqlite3.c) - Add `scripts/bundle.sh` for building local tarball for testing  ## Context Google Play requires 16KB memory page size support. The old OpenSSL prefab (`1.1.1l-beta-1`) ships `.so` files with 4KB alignment, causing Play Store warnings for `libcrypto.so` and `libssl.so`. 

- **Issue #1959** (2026-07-28): **Add Onemoodapp logo to README**
  *Symptoms*: Added a new app logo for Onemoodapp to the README. Onemoodapp uses watermelondb underhood now.
  **Post-Mortem & Fix Analysis**:
  > Btw this is my first pull request. I developed a social app locally till now.  help me to upload the logo in assets folder. thanks

- **Issue #1958** (2026-01-23): **Feat/slice import**
  *Symptoms*: 

- **Issue #1957** (2026-01-15): **Ent 1060 2**
  *Symptoms*: 

- **Issue #1955** (2026-05-28): **Fix/tag not found**
  *Symptoms*: Fixing race condition where database connection might not have been initialized yet.  
  **Post-Mortem & Fix Analysis**:
  > Closing — handled in our internal fork.

- **Issue #1944** (2025-09-11): **Is watermelon execute queries on js thread when jsi is enabled?**
  *Symptoms*: >>> Watermelon fixes it by being lazy. Nothing is loaded until it's requested. And since all querying is performed directly on the rock-solid [SQLite database](https://www.sqlite.org/index.html) on a separate native thread, most queries resolve in an instant.  From README.md But I can't find any thread creation or queue manipulation in shared cpp code, and in jsi bindings is only install database call. 
  **Post-Mortem & Fix Analysis**:
  > Yes, it's on the JS thread
  > @radex may be lets update misleading documentation? This is a **very important** factor.

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

### Incident Patch 1: `2db46eff` (2025-07-03)
**Commit Message**: Merge pull request #1921 from Nozbe/kokusGr/fix-multitab-sync

Fixes multitab sync issues

**File**: `package.json` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@
     "@nozbe/simdjson": "3.9.4",
     "@nozbe/sqlite": "3.46.0",
     "hoist-non-react-statics": "^3.3.2",
-    "lokijs": "npm:@nozbe/lokijs@1.5.12-wmelon6",
+    "lokijs": "npm:@nozbe/lokijs@1.5.12-wmelon8",
     "rxjs": "^7.8.1",
     "sql-escape-string": "^1.1.0"
   },
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -7299,10 +7299,10 @@ logkitty@^0.7.1:
     dayjs "^1.8.15"
     yargs "^15.1.0"
 
-"lokijs@npm:@nozbe/lokijs@1.5.12-wmelon6":
-  version "1.5.12-wmelon6"
-  resolved "https://registry.yarnpkg.com/@nozbe/lokijs/-/lokijs-1.5.12-wmelon6.tgz#e457d934d614d5df80105c86314252a6e614df9b"
-  integrity sha512-GXsaqY8qTJ6xdCrGyno2t+ON2aj6PrUDdvhbrkxK/0Fp12C4FGvDg1wS+voLU9BANYHEnr7KRWfItDZnQkjoAg==
+"lokijs@npm:@nozbe/lokijs@1.5.12-wmelon8":
+  version "1.5.12-wmelon8"
+  resolved "https://registry.yarnpkg.com/@nozbe/lokijs/-/lokijs-1.5.12-wmelon8.tgz#38ad7884d9cfd574a645c8201ad0cdbc93076dd6"
+  integrity sha512-WnqtKrWDh48FvuxnFv2LKurxeSAp8Q3TtQ4akwKFC7CkBaZYgn2P7F3YuBXguj4AgXhSEogxJmJWN8xQq7zPRQ==
 
 loose-envify@^1.0.0, loose-envify@^1.1.0, loose-envify@^1.3.1, loose-envify@^1.4.0:
   version "1.4.0"
```

---

### Incident Patch 2: `71326cea` (2025-06-13)
**Commit Message**: Bump LokiJS version (alternative fix for multitab sync issue)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@
     "@nozbe/simdjson": "3.9.4",
     "@nozbe/sqlite": "3.46.0",
     "hoist-non-react-statics": "^3.3.2",
-    "lokijs": "npm:@nozbe/lokijs@1.5.12-wmelon7",
+    "lokijs": "npm:@nozbe/lokijs@1.5.12-wmelon8",
     "rxjs": "^7.8.1",
     "sql-escape-string": "^1.1.0"
   },
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -7299,10 +7299,10 @@ logkitty@^0.7.1:
     dayjs "^1.8.15"
     yargs "^15.1.0"
 
-"lokijs@npm:@nozbe/lokijs@1.5.12-wmelon7":
-  version "1.5.12-wmelon7"
-  resolved "https://registry.yarnpkg.com/@nozbe/lokijs/-/lokijs-1.5.12-wmelon7.tgz#5ee61fd9f3b46b61458cdcf05a4b41ba1ad0a9fc"
-  integrity sha512-+VgIoge2ClCNlvhJFLRUE7HaFlgH00u1LRaJ4hqrrIHMNBQ2Ercn9JGW8Q/1/63FfV41/KPUuk1RRcuU4q6f5w==
+"lokijs@npm:@nozbe/lokijs@1.5.12-wmelon8":
+  version "1.5.12-wmelon8"
+  resolved "https://registry.yarnpkg.com/@nozbe/lokijs/-/lokijs-1.5.12-wmelon8.tgz#38ad7884d9cfd574a645c8201ad0cdbc93076dd6"
+  integrity sha512-WnqtKrWDh48FvuxnFv2LKurxeSAp8Q3TtQ4akwKFC7CkBaZYgn2P7F3YuBXguj4AgXhSEogxJmJWN8xQq7zPRQ==
 
 loose-envify@^1.0.0, loose-envify@^1.1.0, loose-envify@^1.3.1, loose-envify@^1.4.0:
   version "1.4.0"
```

---

### Incident Patch 3: `ba2b94ec` (2025-06-10)
**Commit Message**: Merge pull request #1922 from itsramiel/fix/expose-catch-error-to-ts

fix: make catchError visible to typescript

**File**: `src/utils/rx/__wmelonRxShim/index.d.ts` (modified, +1/-0)
```diff
@@ -24,5 +24,6 @@ export {
   switchMap,
   throttleTime,
   startWith,
+  catchError
 } from 'rxjs/operators'
 export type { ConnectableObservable } from 'rxjs'
```

**File**: `src/utils/rx/index.d.ts` (modified, +1/-0)
```diff
@@ -22,5 +22,6 @@ export {
   switchMap,
   throttleTime,
   startWith,
+  catchError
 } from './__wmelonRxShim'
 export type { ConnectableObservable } from './__wmelonRxShim'
```

---

### Incident Patch 4: `f5c36873` (2025-06-10)
**Commit Message**: fix: make catchError visible to typescript

**File**: `src/utils/rx/__wmelonRxShim/index.d.ts` (modified, +1/-0)
```diff
@@ -24,5 +24,6 @@ export {
   switchMap,
   throttleTime,
   startWith,
+  catchError
 } from 'rxjs/operators'
 export type { ConnectableObservable } from 'rxjs'
```

**File**: `src/utils/rx/index.d.ts` (modified, +1/-0)
```diff
@@ -22,5 +22,6 @@ export {
   switchMap,
   throttleTime,
   startWith,
+  catchError
 } from './__wmelonRxShim'
 export type { ConnectableObservable } from './__wmelonRxShim'
```

---

### Incident Patch 5: `ce062693` (2025-06-06)
**Commit Message**: Bump LokiJS version (fixes multitab sync issues)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@
     "@nozbe/simdjson": "3.9.4",
     "@nozbe/sqlite": "3.46.0",
     "hoist-non-react-statics": "^3.3.2",
-    "lokijs": "npm:@nozbe/lokijs@1.5.12-wmelon6",
+    "lokijs": "npm:@nozbe/lokijs@1.5.12-wmelon7",
     "rxjs": "^7.8.1",
     "sql-escape-string": "^1.1.0"
   },
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -7299,10 +7299,10 @@ logkitty@^0.7.1:
     dayjs "^1.8.15"
     yargs "^15.1.0"
 
-"lokijs@npm:@nozbe/lokijs@1.5.12-wmelon6":
-  version "1.5.12-wmelon6"
-  resolved "https://registry.yarnpkg.com/@nozbe/lokijs/-/lokijs-1.5.12-wmelon6.tgz#e457d934d614d5df80105c86314252a6e614df9b"
-  integrity sha512-GXsaqY8qTJ6xdCrGyno2t+ON2aj6PrUDdvhbrkxK/0Fp12C4FGvDg1wS+voLU9BANYHEnr7KRWfItDZnQkjoAg==
+"lokijs@npm:@nozbe/lokijs@1.5.12-wmelon7":
+  version "1.5.12-wmelon7"
+  resolved "https://registry.yarnpkg.com/@nozbe/lokijs/-/lokijs-1.5.12-wmelon7.tgz#5ee61fd9f3b46b61458cdcf05a4b41ba1ad0a9fc"
+  integrity sha512-+VgIoge2ClCNlvhJFLRUE7HaFlgH00u1LRaJ4hqrrIHMNBQ2Ercn9JGW8Q/1/63FfV41/KPUuk1RRcuU4q6f5w==
 
 loose-envify@^1.0.0, loose-envify@^1.1.0, loose-envify@^1.3.1, loose-envify@^1.4.0:
   version "1.4.0"
```

---

### Incident Patch 6: `a7b4f60e` (2025-06-02)
**Commit Message**: added linker flag for building with 16kb native alignment

**File**: `native/android-jsi/src/main/cpp/CMakeLists.txt` (modified, +3/-0)
```diff
@@ -83,6 +83,9 @@ add_library(watermelondb-jsi SHARED
         # seems wrong to compile a file that's already getting compiled as part of the app, but ¯\_(ツ)_/¯
         ${NODE_MODULES_PATH_RN}/react-native/ReactCommon/jsi/jsi/jsi.cpp)
 
+# Enable Android 16kb native library alignment
+target_link_options(watermelondb-jsi PRIVATE "-Wl,-z,max-page-size=16384")
+
 target_link_libraries(watermelondb-jsi
                       # link with these libraries:
                       android
```

---

### Incident Patch 7: `9f338b51` (2025-04-07)
**Commit Message**: docs fixes

**File**: `CONTRIBUTING.md` (modified, +0/-5)
```diff
@@ -1,8 +1,3 @@
----
-title: Contributing
-hide_title: true
----
-
 <img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/needyou.jpg" alt="We need you" width="220" />
 
 **WatermelonDB is an open-source project and it needs your help to thrive!**
```

**File**: `docs-website/docs/docs/CHANGELOG.md` (modified, +6/-6)
```diff
@@ -58,7 +58,7 @@ All React/React Native helpers for Watermelon are now available from a new `@noz
 - `DatabaseProvider`, `useDatabase`, `withDatabase`
 - NEW: `withObservables` - `@nozbe/with-observables` as a separate package is deprecated, and is now bundled with WatermelonDB
 - NEW: HOC helpers: `compose`, `withHooks`
-- NEW: `<WithObservables />` component, a component version of `withObservables` HOC. Useful when a value being observed is localized to a small part of a larger component, because you can effortlessly narrow down which parts of the component are re-rendered when the value changes without having to extract a new component.
+- NEW: `&lt;WithObservables />` component, a component version of `withObservables` HOC. Useful when a value being observed is localized to a small part of a larger component, because you can effortlessly narrow down which parts of the component are re-rendered when the value changes without having to extract a new component.
 
 Imports from previous `@nozbe/watermelondb/DatabaseProvider` and `@nozbe/watermelondb/hooks` folders are deprecated and will be removed in a future version.
 
@@ -76,7 +76,7 @@ All debug/dev/diagnostics tools for Watermelon are now available from a new `@no
 
 Changes unlikely to cause issues:
 
-- [iOS] If `import WatermelonDB` is used in your Swift app (for Turbo sync), remove it and replace with `#import <WatermelonDB/WatermelonDB.h>` in the bridging header
+- [iOS] If `import WatermelonDB` is used in your Swift app (for Turbo sync), remove it and replace with `#import &lt;WatermelonDB/WatermelonDB.h>` in the bridging header
 - [iOS] If you use `_watermelonDBLoggingHook`, remove it. No replacement is provided at this time, feel free to contribute if you need this
 - [iOS] If you use `-DENABLE_JSLOCK_PERFORMANCE_HACK`, remove it. JSLockPerfHack has been non-functional for some time already, and has now been removed. Please file an issue if you relied on it.
 
@@ -257,7 +257,7 @@ help to do this! See: https://github.com/Nozbe/WatermelonDB/issues/1481
 ### Fixes
 
 - [TypeScript] Improve typings: add unsafeExecute method, localStorage property to Database
-- [android] Fixed compilation on some setups due to a missing `<cassert>` import
+- [android] Fixed compilation on some setups due to a missing `&lt;cassert>` import
 - [sync] Fixed marking changes as synced for users that don't keep globally unique (only per-table unique) IDs
 - Fix `Model.experimentalMarkAsDeleted/experimentalDestroyPermanently()` throwing an error in some cases
 - Fixes included in updated `withObservables`
@@ -414,7 +414,7 @@ Please don't get scared off the long list of breaking changes - they are all eit
 - [adapters] `onSetUpError: Error => void` option is added to both `SQLiteAdapter` and `LokiJSAdapter`. Supply this option to catch initialization errors and offer the user to reload or log out
 - [LokiJS] new `extraLokiOptions` and `extraIncrementalIDBOptions` options
 - [Android] Autolinking is now supported.
-  - If You upgrade to `<= v0.21.0` **AND** are on a version of React Native which supports Autolinking, you will need to remove the config manually linking WatermelonDB.
+  - If You upgrade to `&lt;= v0.21.0` **AND** are on a version of React Native which supports Autolinking, you will need to remove the config manually linking WatermelonDB.
   - You can resolve this issue by **REMOVING** the lines of config from your project which are _added_ in the `Manual Install ONLY` section of the [Android Install docs](https://nozbe.github.io/WatermelonDB/Installation.html#android-react-native).
 
 ### Performance
@@ -733,7 +733,7 @@ This is a **massive** new update to WatermelonDB! 🍉
 - [withObservables] Improved performance and debuggability (update withObservables package separately)
 - Improved debuggability of Watermelon -- shortened Rx stacks and added function names to aid in understanding
   call stacks and profiles
-- [adapters] The adapters interface has changed. `query()` and `count()` methods now receive a `SerializedQuery`, and `batch()` now takes `TableName<any>` and `RawRecord` or `RecordId` instead of `Model`.
+- [adapters] The adapters interface has changed. `query()` and `count()` methods now receive a `SerializedQuery`, and `batch()` now takes `TableName&lt;any>` and `RawRecord` or `RecordId` instead of `Model`.
 - [Typescript] Typing improvements
   - Added 3 missing properties `collections`, `database` and `asModel` in Model type definition.
   - Removed optional flag on `actionsEnabled` in the Database constructor options since its mandatory since 0.13.0.
@@ -896,7 +896,7 @@ Hotfix for rambdax crash
 - [Sync] Improved documentation for backends that can't distinguish between `created` and `updated` records
 - [Sync] Improved diagnostics / protection against edge cases
 - [iOS] Add missing `header search path` to support **ejected** expo project.
-- [Android] Fix crash on android < 5.0
+- [Android] Fix crash on android &lt; 5.0
 - [iOS] `SQLiteAdapte
```

**File**: `docs-website/docs/docs/README.md` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ Watermelon fixes it **by being lazy**. Nothing is loaded until it's requested. A
 But unlike using SQLite directly, Watermelon is **fully observable**. So whenever you change a record, all UI that depends on it will automatically re-render. For example, completing a task in a to-do app will re-render the task component, the list (to reorder), and all relevant task counters. [**Learn more**](https://www.youtube.com/watch?v=UlZ1QnFF4Cw).
 
 | <a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw"><img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/watermelon-talk-thumbnail.jpg" alt="React Native EU: Next-generation React Databases" width="300" /></a> |
-| ---- | --- |
+| ---- |
 | <p align="center"><a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw">📺 <strong>Next-generation React databases</strong><br/>(a talk about WatermelonDB)</a></p> |
 
 ## Usage
```

**File**: `scripts/replace-docs-path.mjs` (modified, +4/-8)
```diff
@@ -4,18 +4,14 @@ import { promisify } from 'node:util'
 const readFileAsync = promisify(fs.readFile)
 const writeFileAsync = promisify(fs.writeFile)
 
-function replaceAll(str, find, replace) {
-  return str.replace(new RegExp(find, 'g'), replace)
-}
-
 const filePath = process.argv[2]
 
 async function main() {
   const result = await readFileAsync(filePath, 'utf8')
-  
-  const newResult = replaceAll(result, 'docs-website/docs/docs/', '')
-  
+
+  const newResult = result.replaceAll('docs-website/docs/docs/', '').replaceAll('<', '&lt;')
+
   await writeFileAsync(filePath, newResult, 'utf8')
 }
 
-main()
\ No newline at end of file
+main()
```

---

### Incident Patch 8: `9b7258ab` (2025-04-07)
**Commit Message**: fix readme

**File**: `README.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ Watermelon fixes it **by being lazy**. Nothing is loaded until it's requested. A
 But unlike using SQLite directly, Watermelon is **fully observable**. So whenever you change a record, all UI that depends on it will automatically re-render. For example, completing a task in a to-do app will re-render the task component, the list (to reorder), and all relevant task counters. [**Learn more**](https://www.youtube.com/watch?v=UlZ1QnFF4Cw).
 
 | <a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw"><img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/watermelon-talk-thumbnail.jpg" alt="React Native EU: Next-generation React Databases" width="300" /></a> |
-| ---- | --- |
+| ---- |
 | <p align="center"><a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw">📺 <strong>Next-generation React databases</strong><br/>(a talk about WatermelonDB)</a></p> |
 
 ## Usage
```

---

### Incident Patch 9: `a565e2ff` (2025-04-07)
**Commit Message**: ci: fix xcode version - set to 16.2

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ jobs:
       - name: Set Xcode version
         uses: maxim-lobanov/setup-xcode@v1.2.1
         with:
-          xcode-version: 16.3
+          xcode-version: 16.2
       - name: ccache
         uses: hendrikmuhs/ccache-action@v1
       - name: cache node_modules
```

---

### Incident Patch 10: `d44d3c51` (2025-03-14)
**Commit Message**: add `<!--truncate-->` to fix warning: `Docusaurus found blog posts without truncation markers`

**File**: `docs-website/blog/2021-08-01-mdx-blog-post.mdx` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ tags: [docusaurus]
 
 Blog posts support [Docusaurus Markdown features](https://docusaurus.io/docs/markdown-features), such as [MDX](https://mdxjs.com/).
 
+<!--truncate-->
+
 :::tip
 
 Use the power of React to create interactive blog posts.
```

---

### Incident Patch 11: `ad63d41b` (2025-03-14)
**Commit Message**: run `npx docusaurus-mdx-checker` to fix docs compile error

**File**: `docs-website/docs/docs/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -859,7 +859,7 @@ Hotfix for rambdax crash
 ### Changes
 
 - [Android] Changed `compile` to `implementation` in Library Gradle file
-  - ⚠️ might break build if you are using Android Gradle Plugin <3.X
+  - ⚠️ might break build if you are using Android Gradle Plugin &lt;3.X
 - Updated `peerDependency` `react-native` to `0.57.0`
 - [Sync] Added `hasUnsyncedChanges()` helper method
 - [Sync] Improved documentation for backends that can't distinguish between `created` and `updated` records
```

---

### Incident Patch 12: `380a1e14` (2025-03-14)
**Commit Message**:  fix docusaurus light & dark theme not fond error

**File**: `docs-website/docusaurus.config.js` (modified, +5/-4)
```diff
@@ -1,8 +1,9 @@
 // @ts-check
 // Note: type annotations allow type checking and IDEs autocompletion
 
-const lightCodeTheme = require('prism-react-renderer/themes/github')
-const darkCodeTheme = require('prism-react-renderer/themes/dracula')
+const { themes } = require('prism-react-renderer')
+const lightTheme = themes.github
+const darkTheme = themes.dracula
 const { version } = require('./package.json')
 
 /** @type {import('@docusaurus/types').Config} */
@@ -153,8 +154,8 @@ const config = {
         copyright: `WatermelonDB by <a href="https://radex.io">Radek Pietruszewski</a> and <a href="https://nozbe.com">Nozbe</a>.`,
       },
       prism: {
-        theme: lightCodeTheme,
-        darkTheme: darkCodeTheme,
+        theme: lightTheme,
+        darkTheme: darkTheme,
       },
     }),
 }
```

---

### Incident Patch 13: `c3be1493` (2025-01-22)
**Commit Message**: Merge pull request #1879 from gmacmaster/fix/sqlite-method-error

Update sqlite makeDispatcher to show correct method name in error

**File**: `src/adapters/sqlite/makeDispatcher/index.native.js` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ class SqliteJsiDispatcher implements SqliteDispatcher {
       const method = this._db[methodName]
       if (!method) {
         throw new Error(
-          `Cannot run database method ${method} because database failed to open. Hint: Did you install JSI correctly? This happens if you forgot to configure Proguard correctly ${Object.keys(
+          `Cannot run database method ${methodName} because database failed to open. Hint: Did you install JSI correctly? This happens if you forgot to configure Proguard correctly ${Object.keys(
             this._db,
           ).join(',')}`,
         )
```

---

### Incident Patch 14: `c3f55bcd` (2025-01-13)
**Commit Message**: Fix WMDatabaseBridge compatibility with Bridgeless architecture

This commit updates WMDatabaseBridge to use getJSMessageQueueThread()
instead of getCatalystInstance().getReactQueueConfiguration().getJSQueueThread().
The change addresses a NullPointerException when running on the Bridgeless architecture,
which no longer supports CatalystInstance.

**File**: `native/android/src/main/java/com/nozbe/watermelondb/WMDatabaseBridge.java` (modified, +1/-1)
```diff
@@ -248,7 +248,7 @@ public WritableArray getRandomBytes(int count) {
     public void invalidate() {
         // NOTE: See Database::install() for explanation
         super.invalidate();
-        reactContext.getCatalystInstance().getReactQueueConfiguration().getJSQueueThread().runOnQueue(() -> {
+        reactContext.getJSMessageQueueThread().runOnQueue(() -> {
             try {
                 Class<?> clazz = Class.forName("com.nozbe.watermelondb.jsi.WatermelonJSI");
                 Method method = clazz.getDeclaredMethod("onCatalystInstanceDestroy");
```

---

### Incident Patch 15: `7ff9154b` (2024-12-05)
**Commit Message**: Fix small typo

**File**: `docs-website/docs/docs/Advanced/Migrations.md` (modified, +2/-2)
```diff
@@ -132,7 +132,7 @@ Before shipping a new version of the app, please check that your database change
 
 ### Why is this order important
 
-It's simply because React Native simulator (and often React web projects) are configured to automatically refresh when you save a file. You don't want to database to accidentally migrate (upgrade) with changes that have a mistake, or changes you haven't yet completed making. By making migrations first, and bumping version last, you can double check you haven't made a mistake.
+It's simply because React Native simulator (and often React web projects) are configured to automatically refresh when you save a file. You don't want the database to accidentally migrate (upgrade) with changes that have a mistake, or changes you haven't yet completed making. By making migrations first, and bumping version last, you can double check you haven't made a mistake.
 
 ## Migrations API
 
@@ -180,7 +180,7 @@ schemaMigrations({
 
 1. When you're **not** using migrations, the database will reset (delete all its contents) whenever you change the schema version.
 2. If the migration fails, the database will fail to initialize, and will roll back to previous version. This is unlikely, but could happen if you, for example, create a migration that tries to create the same table twice. The reason why the database will fail instead of reset is to avoid losing user data (also it's less confusing in development). You can notice the problem, fix the migration, and ship it again without data loss.
-3. When database in the running app has *newer* database version than the schema version defined in code, the database will reset (clear its contents). This is useful in development
+3. When database in the running app has *newer* database version than the schema version defined in code, the database will reset (clear its contents). This is useful in development.
 4. If there's no available migrations path (e.g. user has app with database version 4, but oldest migration is from version 10 to 11), the database will reset.
 
 ### Rolling back changes
```

#### Recent Merged Pull Requests:
- **PR #1972** (closed): Chore/add agents md (@StasDoskalenko)
- **PR #1960** (closed): fix: ENT-1500 upgrade OpenSSL for 16KB page size compliance (@dmytech462)
- **PR #1959** (closed): Add Onemoodapp logo to README (@rohitpadile)
- **PR #1958** (closed): Feat/slice import (@jdicami)
- **PR #1957** (closed): Ent 1060 2 (@jinsoo601)
- **PR #1955** (closed): Fix/tag not found (@jdicami)
- **PR #1943** (2025-08-11): Update Installation.mdx (@mayank-01-ms)
- **PR #1935** (2025-07-12): Add ezypack logo (@wglad)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
