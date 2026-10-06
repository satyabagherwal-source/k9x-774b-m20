# Forensic Learning Record (Deep Inspection): MobileNativeFoundation/Store

> **Canonical Artifact**: `07_PROJECT_LEARNING/mobilenativefoundation-store-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MobileNativeFoundation/Store](https://github.com/MobileNativeFoundation/Store))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:15:52.606Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MobileNativeFoundation/Store`
- **Description**: A library for reading and writing data that lives in network, disk, and memory.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3422 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/src/commonMain/kotlin/org/mobilenativefoundation/store/core5/ExperimentalStoreApi.kt`
```
package org.mobilenativefoundation.store.core5

/**
 * Marks declarations that are still **experimental** in store API.
 * Declarations marked with this annotation are unstable and subject to change.
 */
@MustBeDocumented
@Retention(value = AnnotationRetention.BINARY)
@RequiresOptIn(level = RequiresOptIn.Level.WARNING)
annotation class ExperimentalStoreApi

```

### Core Architecture Module: `core/src/commonMain/kotlin/org/mobilenativefoundation/store/core5/InsertionStrategy.kt`
```
package org.mobilenativefoundation.store.core5

@ExperimentalStoreApi
enum class InsertionStrategy {
    APPEND,
    PREPEND,
    REPLACE,
}

```

### Core Architecture Module: `core/src/commonMain/kotlin/org/mobilenativefoundation/store/core5/KeyProvider.kt`
```
package org.mobilenativefoundation.store.core5

@ExperimentalStoreApi
interface KeyProvider<Id : Any, Single : StoreData.Single<Id>> {
    fun fromCollection(
        key: StoreKey.Collection<Id>,
        value: Single,
    ): StoreKey.Single<Id>

    fun fromSingle(
        key: StoreKey.Single<Id>,
        value: Single,
    ): StoreKey.Collection<Id>
}

```

### Core Architecture Module: `core/src/commonMain/kotlin/org/mobilenativefoundation/store/core5/StoreData.kt`
```
package org.mobilenativefoundation.store.core5

/**
 * An interface that defines items that can be uniquely identified.
 * Every item that implements the [StoreData] interface must have a means of identification.
 * This is useful in scenarios when data can be represented as singles or collections.
 */
@ExperimentalStoreApi
interface StoreData<out Id : Any> {
    /**
     * Represents a single identifiable item.
     */
    interface Single<Id : Any> : StoreData<Id> {
        val id: Id
    }

    /**
     * Represents a collection of identifiable items.
     */
    interface Collection<Id : Any, S : Single<Id>> : StoreData<Id> {
        val items: List<S>

        /**
         * Returns a new collection with the updated items.
         */
        fun copyWith(items: List<S>): Collection<Id, S>

        /**
         * Inserts items to the existing collection and returns the updated collection.
         */
        fun insertItems(
            strategy: InsertionStrategy,
            items: List<S>,
        ): Collection<Id, S>
    }
}

```

### Core Architecture Module: `core/src/commonMain/kotlin/org/mobilenativefoundation/store/core5/StoreKey.kt`
```
package org.mobilenativefoundation.store.core5

/**
 * An interface that defines keys used by Store for data-fetching operations.
 * Allows Store to fetch individual items and collections of items.
 * Provides mechanisms for ID-based fetch, page-based fetch, and cursor-based fetch.
 * Includes options for sorting and filtering.
 */
@ExperimentalStoreApi
interface StoreKey<out Id : Any> {
    /**
     * Represents a key for fetching an individual item.
     */
    interface Single<Id : Any> : StoreKey<Id> {
        val id: Id
    }

    /**
     * Represents a key for fetching collections of items.
     */
    interface Collection<out Id : Any> : StoreKey<Id> {
        val insertionStrategy: InsertionStrategy

        /**
         * Represents a key for page-based fetching.
         */
        interface Page : Collection<Nothing> {
            val page: Int
            val size: Int
            val sort: Sort?
            val filters: List<Filter<*>>?
        }

        /**
         * Represents a key for cursor-based fetching.
         */
        interface Cursor<out Id : Any> : Collection<Id> {
            val cursor: Id?
            val size: Int
            val sort: Sort?
            val filters: List<Filter<*>>?
        }
    }

    /**
     * An enum defining sorting options that can be applied during fetching.
     */
    enum class Sort {
        NEWEST,
        OLDEST,
        ALPHABETICAL,
        REVERSE_ALPHABETICAL,
    }

    /**
     * Defines filters that can be applied during fetching.
     */
    interface Filter<Value : Any> {
        operator fun invoke(items: List<Value>): List<Value>
    }
}

```

### Core Architecture Module: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/MutableStoreKeyState.kt`
```
package org.mobilenativefoundation.store.store5.impl

import kotlinx.coroutines.sync.Mutex
import org.mobilenativefoundation.store.store5.StoreWriteRequest
import org.mobilenativefoundation.store.store5.UpdaterResult

internal class MutableStoreKeyState<Key : Any, Output : Any> {
    val localMutex = Mutex()
    val remoteMutex = Mutex()
    val pending = ArrayDeque<PendingStoreWrite<Key, Output>>()
}

internal class PendingStoreWrite<Key : Any, Output : Any>(
    val request: StoreWriteRequest<Key, Output, *>,
) {
    var acknowledged: UpdaterResult.Success? = null
}

internal class MutableStoreSyncSnapshot<Key : Any, Output : Any>(
    val value: Output,
    val entries: List<PendingStoreWrite<Key, Output>>,
)

/** Called only with localMutex held; distinct admissions retain identity even for a reused request. */
internal fun <Key : Any, Output : Any> acknowledgeSnapshot(
    state: MutableStoreKeyState<Key, Output>,
    snapshot: MutableStoreSyncSnapshot<Key, Output>,
    result: UpdaterResult.Success,
): List<PendingStoreWrite<Key, Output>> {
    val completed = ArrayList<PendingStoreWrite<Key, Output>>(snapshot.entries.size)
    for (entry in snapshot.entries) {
        if (entry.acknowledged == null && state.pending.remove(entry)) {
            entry.acknowledged = result
            completed.add(entry)
        }
    }
    return completed
}

```

### Core Architecture Module: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/internal/definition/WriteRequestQueue.kt`
```
package org.mobilenativefoundation.store.store5.internal.definition

import org.mobilenativefoundation.store.store5.StoreWriteRequest

typealias WriteRequestQueue<Key, Output, Response> = ArrayDeque<StoreWriteRequest<Key, Output, Response>>

```

### Core Architecture Module: `cache/src/commonMain/kotlin/org/mobilenativefoundation/store/cache5/Cache.kt`
```
package org.mobilenativefoundation.store.cache5

interface Cache<Key : Any, Value : Any> {
    /**
     * @return [Value] associated with [key] or `null` if there is no cached value for [key].
     */
    fun getIfPresent(key: Key): Value?

    /**
     * @return [Value] associated with [key], obtaining the value from [valueProducer] if necessary.
     * No observable state associated with this cache is modified until loading completes.
     * @param [valueProducer] Must not return `null`. It may either return a non-null value or throw an exception.
     * @throws ExecutionExeption If a checked exception was thrown while loading the value.
     * @throws UncheckedExecutionException If an unchecked exception was thrown while loading the value.
     * @throws ExecutionError If an error was thrown while loading the value.
     */
    fun getOrPut(
        key: Key,
        valueProducer: () -> Value,
    ): Value

    /**
     * @return Map of the [Value] associated with each [Key] in [keys]. Returned map only contains entries already present in the cache.
     * The default implementation provided here throws a [NotImplementedError] to maintain backward compatibility for existing implementations.
     */
    fun getAllPresent(keys: List<*>): Map<Key, Value>

    /**
     * @return Map of the [Value] associated with each [Key] in the cache.
     */
    fun getAllPresent(): Map<Key, Value> = throw NotImplementedError()

    /**
     * Associates [value] with [key].
     * If the cache previously contained a value associated with [key], the old value is replaced by [value].
     * Prefer [getOrPut] when using the conventional "If cached, then return. Otherwise create, cache, and then return" pattern.
     */
    fun put(
        key: Key,
        value: Value,
    )

    /**
     * Copies all of the mappings from the specified map to the cache. The effect of this call is
     * equivalent to that of calling [put] on this map once for each mapping from [Key] to [Value] in the specified map.
     * The behavior of this operation is undefined if the specified map is modified while the operation is in progress.
     */
    fun putAll(map: Map<Key, Value>)

    /**
     * Discards any cached value associated with [key].
     */
    fun invalidate(key: Key)

    /**
     * Discards any cached value associated for [keys].
     */
    fun invalidateAll(keys: List<Key>)

    /**
     * Discards all entries in the cache.
     */
    fun invalidateAll()

    /**
     * @return Approximate number of entries in the cache.
     */
    fun size(): Long
}

```

### Core Architecture Module: `cache/src/commonMain/kotlin/org/mobilenativefoundation/store/cache5/LocalCache.kt`
```
/*
 * Copyright (C) 2009 The Guava Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * KMP conversion
 * Copyright (C) 2022 André Claßen
 */
package org.mobilenativefoundation.store.cache5

import kotlinx.atomicfu.AtomicArray
import kotlinx.atomicfu.AtomicRef
import kotlinx.atomicfu.atomic
import kotlinx.atomicfu.atomicArrayOfNulls
import kotlinx.atomicfu.locks.reentrantLock
import kotlinx.atomicfu.loop
import kotlin.math.min
import kotlin.time.Duration

internal class LocalCache<K : Any, V : Any>(builder: CacheBuilder<K, V>) {
    /**
     * Mask value for indexing into segments. The upper bits of a key's hash code are used to choose
     * the segment.
     */
    private val segmentMask: Int

    /**
     * Shift value for indexing within segments. Helps prevent entries that end up in the same segment
     * from also ending up in the same bucket.
     */
    private val segmentShift: Int

    /**
     * The segments, each of which is a specialized hash table.
     */

    private val segments: Array<Segment<K, V>?>

    /**
     * Strategy for referencing values.
     */
    private val valueStrength: Strength = Strength.Strong

    /**
     * The maximum weight of this map. UNSET_LONG if there is no maximum.
     */
    private val maxWeight: Long

    /**
     * Weigher to weigh cache entries.
     */
    private val weigher: Weigher<K, V>

    /**
     * How long after the last access to an entry the map will retain that entry.
     */
    private val expireAfterAccessNanos: Long

    /**
     * How long after the last write to an entry the map will retain that entry.
     */
    private val expireAfterWriteNanos: Long

    /**
     * Measures time in a testable way.
     */
    private val ticker: Ticker

    /**
     * Factory used to create new entries.
     */
    private val entryFactory: EntryFactory

    private val evictsBySize: Boolean get() = maxWeight >= 0

    private val customWeigher: Boolean get() = weigher !== OneWeigher

    private val expiresAfterWrite: Boolean get() = expireAfterWriteNanos > 0

    private val expiresAfterAccess: Boolean get() = expireAfterAccessNanos > 0

    private val usesAccessQueue: Boolean get() = expiresAfterAccess || evictsBySize

    private val usesWriteQueue: Boolean get() = expiresAfterWrite

    private val recordsWrite: Boolean get() = expiresAfterWrite

    private val recordsAccess: Boolean get() = expiresAfterAccess

    private val recordsTime: Boolean get() = recordsWrite || recordsAccess

    private val usesWriteEntries: Boolean get() = usesWriteQueue || recordsWrite

    private val usesAccessEntries: Boolean get() = usesAccessQueue || recordsAccess

    private sealed class Strength {
        /*
         * TODO(kevinb): If we strongly reference the value and aren't loading, we needn't wrap the
         * value. This could save ~8 bytes per entry.
         */
        object Strong : Strength() {
            override fun <K : Any, V : Any> referenceValue(
                segment: Segment<K, V>?,
                entry: ReferenceEntry<K, V>?,
                value: V,
                weight: Int,
            ): ValueReference<K, V> {
                return if (weight == 1) {
                    StrongValueReference(value)
                } else {
                    WeightedStrongValueReference(
                        value,
                        weight,
                    )
                }
            }
        }

        /**
         * Creates a reference for the given value according to this value strength.
         */
        abstract fun <K : Any, V : Any> referenceValue(
            segment: Segment<K, V>?,
            entry: ReferenceEntry<K, V>?,
            value: V,
            weight: Int,
        ): ValueReference<K, V>
    }

    /**
     * Creates new entries.
     */
    private sealed class EntryFactory {
        object Strong : EntryFactory() {
            override fun <K : Any, V : Any> newEntry(
                segment: Segment<K, V>?,
                key: K,
                hash: Int,
                next: ReferenceEntry<K, V>?,
            ): ReferenceEntry<K, V> {
                return StrongEntry(key, hash, next)
            }
        }

        object StrongAccess : EntryFactory() {
            override fun <K : Any, V : Any> newEntry(
                segment: Segment<K, V>?,
                key: K,
                hash: Int,
                next: ReferenceEntry<K, V>?,
            ): ReferenceEntry<K, V> {
                return StrongAccessEntry(key, hash, next)
            }

            override fun <K : Any, V : Any> copyEntry(
                segment: Segment<K, V>?,
                original: ReferenceEntry<K, V>,
                newNext: ReferenceEntry<K, V>?,
            ): ReferenceEntry<K, V> {
                val newEntry = super.copyEntry(segment, original, newNext)
                copyAccessEntry(original, newEntry)
                return newEntry
            }
        }

        object StrongWrite : EntryFactory() {
            override fun <K : Any, V : Any> newEntry(
                segment: Segment<K, V>?,
                key: K,
                hash: Int,
                next: ReferenceEntry<K, V>?,
            ): ReferenceEntry<K, V> {
                return StrongWriteEntry(key, hash, next)
            }

            override fun <K : Any, V : Any> copyEntry(
                segment: Segment<K, V>?,
                original: ReferenceEntry<K, V>,
                newNext: ReferenceEntry<K, V>?,
            ): ReferenceEntry<K, V> {
                val newEntry = super.copyEntry(segment, original, newNext)
                copyWriteEntry(original, newEntry)
                return newEntry
            }
        }

        object StrongAccessWrite : EntryFactory() {
            override fun <K : Any, V : Any> newEntry(
                segment: Segment<K, V>?,
                key: K,
                hash: Int,
                next: ReferenceEntry<K, V>?,
            ): ReferenceEntry<K, V> {
                return StrongAccessWriteEntry(key, hash, next)
            }

            override fun <K : Any, V : Any> copyEntry(
                segment: Segment<K, V>?,
                original: ReferenceEntry<K, V>,
                newNext: ReferenceEntry<K, V>?,
            ): ReferenceEntry<K, V> {
                val newEntry = super.copyEntry(segment, original, newNext)
                copyAccessEntry(original, newEntry)
                copyWriteEntry(original, newEntry)
                return newEntry
            }
        }

        /**
         * Creates a new entry.
         *
         * @param segment to create the entry for
         * @param key     of the entry
         * @param hash    of the key
         * @param next    entry in the same bucket
         */
        abstract fun <K : Any, V : Any> newEntry(
            segment: Segment<K, V>?,
            key: K,
            hash: Int,
            next: ReferenceEntry<K, V>?,
        ): ReferenceEntry<K, V>

        /**
         * Copies an entry, assigning it a new `next` entry.
         *
         * @param original the entry to copy
         * @param newNext  entry in the same bucket
         */
        // Guarded By Segment.this
        open fun <K : Any, V : Any> copyEntry(
            segment: Segment<K, V>?,
            original: ReferenceEntry<K, V>,
            newNext: ReferenceEntry<K, V>?,
        ): ReferenceEntry<K, V> {
            return newEntry(segment, original.key, original.hash, newNext)
        }

        // Guarded By Segment.this
        fun <K : Any, V : Any> copyAccessEntry(
            original: ReferenceEntry<K, V>,
            newEntry: ReferenceEntry<K, V>,
        ) {
            // TODO(fry): when we link values instead of entries this method can go
            // away, as can connectAccessOrder, nullifyAccessOrder.
            newEntry.accessTime = original.accessTime
            connectAccessOrder(original.previousInAccessQueue, newEntry)
            connectAccessOrder(newEntry, original.nextInAccessQueue)
            nullifyAccessOrder(original)
        }

        // Guarded By Segment.this
        fun <K : Any, V : Any> copyWriteEntry(
            original: ReferenceEntry<K, V>,
            newEntry: ReferenceEntry<K, V>,
        ) {
            // TODO(fry): when we link values instead of entries this method can go
            // away, as can connectWriteOrder, nullifyWriteOrder.
            newEntry.writeTime = original.writeTime
            connectWriteOrder(original.previousInWriteQueue, newEntry)
            connectWriteOrder(newEntry, original.nextInWriteQueue)
            nullifyWriteOrder(original)
        }

        companion object {
            /**
             * Masks used to compute indices in the following table.
             */
            private const val ACCESS_MASK = 1
            private const val WRITE_MASK = 2

            /**
             * Look-up table for factories.
             */
            private val factories = arrayOf(Strong, StrongAccess, StrongWrite, StrongAccessWrite)

            fun getFactory(
                usesAccessQueue: Boolean,
                usesWriteQueue: Boolean,
            ): EntryFactory {
                val flags = ((if (usesAccessQueue) ACCESS_MASK else 0) or if (usesWriteQueue) WRITE_MASK else 0)
                return factories[flags]
            }
        }
    }

    /**
     * A reference to a value.
     */
    private interface ValueReference<K
```

### Core Architecture Module: `cache/src/commonMain/kotlin/org/mobilenativefoundation/store/cache5/MonotonicTicker.kt`
```
package org.mobilenativefoundation.store.cache5

import kotlin.time.ExperimentalTime
import kotlin.time.TimeSource

@OptIn(ExperimentalTime::class)
internal val MonotonicTicker: Ticker = TimeSource.Monotonic.markNow().let { timeMark -> { timeMark.elapsedNow().inWholeNanoseconds } }

```

### Core Architecture Module: `cache/src/commonMain/kotlin/org/mobilenativefoundation/store/cache5/RemovalCause.kt`
```
package org.mobilenativefoundation.store.cache5

/**
 * The reason why a cached entry was removed.
 * @param wasEvicted True if entry removal was automatic due to eviction. That is, the cause of removal is neither [EXPLICIT] or [REPLACED].
 * @author Charles Fry
 * @since 10.0
 */
internal enum class RemovalCause(val wasEvicted: Boolean) {
    EXPLICIT(false),
    REPLACED(false),
    COLLECTED(true),
    EXPIRED(true),
    SIZE(true),
}

```

### Core Architecture Module: `cache/src/commonMain/kotlin/org/mobilenativefoundation/store/cache5/StoreMultiCache.kt`
```
@file:Suppress("UNCHECKED_CAST")

package org.mobilenativefoundation.store.cache5

import org.mobilenativefoundation.store.core5.KeyProvider
import org.mobilenativefoundation.store.core5.StoreData
import org.mobilenativefoundation.store.core5.StoreKey

/**
 * A class that represents a caching system with collection decomposition.
 * Manages data with utility functions to get, invalidate, and add items to the cache.
 * Depends on [StoreMultiCacheAccessor] for internal data management.
 * @see [Cache].
 */
class StoreMultiCache<Id : Any, Key : StoreKey<Id>, Single : StoreData.Single<Id>, Collection : StoreData.Collection<Id, Single>, Output : StoreData<Id>>(
    private val keyProvider: KeyProvider<Id, Single>,
    singlesCache: Cache<StoreKey.Single<Id>, Single> = CacheBuilder<StoreKey.Single<Id>, Single>().build(),
    collectionsCache: Cache<StoreKey.Collection<Id>, Collection> = CacheBuilder<StoreKey.Collection<Id>, Collection>().build(),
) : Cache<Key, Output> {
    private val accessor =
        StoreMultiCacheAccessor(
            singlesCache = singlesCache,
            collectionsCache = collectionsCache,
        )

    private fun Key.castSingle() = this as StoreKey.Single<Id>

    private fun Key.castCollection() = this as StoreKey.Collection<Id>

    private fun StoreKey.Collection<Id>.cast() = this as Key

    private fun StoreKey.Single<Id>.cast() = this as Key

    override fun getIfPresent(key: Key): Output? {
        return when (key) {
            is StoreKey.Single<*> -> accessor.getSingle(key.castSingle()) as? Output
            is StoreKey.Collection<*> -> accessor.getCollection(key.castCollection()) as? Output
            else -> {
                throw UnsupportedOperationException(invalidKeyErrorMessage(key))
            }
        }
    }

    override fun getOrPut(
        key: Key,
        valueProducer: () -> Output,
    ): Output {
        return when (key) {
            is StoreKey.Single<*> -> {
                val single = accessor.getSingle(key.castSingle()) as? Output
                if (single != null) {
                    single
                } else {
                    val producedSingle = valueProducer()
                    put(key, producedSingle)
                    producedSingle
                }
            }

            is StoreKey.Collection<*> -> {
                val collection = accessor.getCollection(key.castCollection()) as? Output
                if (collection != null) {
                    collection
                } else {
                    val producedCollection = valueProducer()
                    put(key, producedCollection)
                    producedCollection
                }
            }

            else -> {
                throw UnsupportedOperationException(invalidKeyErrorMessage(key))
            }
        }
    }

    override fun getAllPresent(keys: List<*>): Map<Key, Output> {
        val map = mutableMapOf<Key, Output>()
        keys.filterIsInstance<StoreKey<Id>>().forEach { key ->
            when (key) {
                is StoreKey.Collection<Id> -> {
                    val collection = accessor.getCollection(key)
                    collection?.let { map[key.cast()] = it as Output }
                }

                is StoreKey.Single<Id> -> {
                    val single = accessor.getSingle(key)
                    single?.let { map[key.cast()] = it as Output }
                }
            }
        }

        return map
    }

    override fun getAllPresent(): Map<Key, Output> {
        return accessor.getAllPresent().mapKeys { (key, _) ->
            when (key) {
                is StoreKey.Collection<Id> -> key.cast()
                is StoreKey.Single<Id> -> key.cast()
                else -> throw UnsupportedOperationException(invalidKeyErrorMessage(key))
            }
        } as Map<Key, Output>
    }

    override fun invalidateAll(keys: List<Key>) {
        keys.forEach { key -> invalidate(key) }
    }

    override fun invalidate(key: Key) {
        when (key) {
            is StoreKey.Single<*> -> accessor.invalidateSingle(key.castSingle())
            is StoreKey.Collection<*> -> accessor.invalidateCollection(key.castCollection())
        }
    }

    override fun putAll(map: Map<Key, Output>) {
        map.entries.forEach { (key, value) -> put(key, value) }
    }

    override fun put(
        key: Key,
        value: Output,
    ) {
        when (key) {
            is StoreKey.Single<*> -> {
                val single = value as Single
                accessor.putSingle(key.castSingle(), single)

                val collectionKey = keyProvider.fromSingle(key.castSingle(), single)
                val existingCollection = accessor.getCollection(collectionKey)
                if (existingCollection != null) {
                    val updatedItems =
                        existingCollection.items.toMutableList().map {
                            if (it.id == single.id) {
                                single
                            } else {
                                it
                            }
                        }
                    val updatedCollection = existingCollection.copyWith(items = updatedItems) as Collection
                    accessor.putCollection(collectionKey, updatedCollection)
                }
            }

            is StoreKey.Collection<*> -> {
                val collection = value as Collection
                accessor.putCollection(key.castCollection(), collection)

                collection.items.forEach {
                    val single = it as? Single
                    if (single != null) {
                        accessor.putSingle(keyProvider.fromCollection(key.castCollection(), single), single)
                    }
                }
            }
        }
    }

    override fun invalidateAll() {
        accessor.invalidateAll()
    }

    override fun size(): Long {
        return accessor.size()
    }

    companion object {
        fun invalidKeyErrorMessage(key: Any) = "Expected StoreKey.Single or StoreKey.Collection, but received ${key::class}"
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #761** (2026-09-08): **[BUG] MutableStore can discard pending writes or acknowledge unsynchronized changes**
  *Symptoms*: Overlapping operations for the same key in one `MutableStore` instance can leave a local write unsynchronized and remove the state needed to retry it.  **Queue replacement can discard a newer write**  Cleanup builds a replacement queue under the per-key mutex, then releases that mutex before installing the replacement. A newer write can enter the existing queue between those steps. See [queue cleanup](https://github.com/MobileNativeFoundation/Store/blob/fde07551688ae7f1e22a8da77f6cbcde1454f384/store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt#L169-L212).  Possible sequence:  1. Write A reaches the server successfully. 2. A’s cleanup computes an empty replacement queue and releases the per-key mutex. 3. Write B enters the existing queue and persists locally. 4. A installs its replacement queue, discarding B. 5. B’s synchronization attempt fails with `No writes found for key=…`.  B receives an error, but this path bypasses failed-sync bookkeeping. The server can hold A while local storage holds B, with no pending queue entry or failure marker for B.  B may still exist locally. The failure is that Store has lost the state needed to synchronize it through eager recovery.  **An older retry can acknowledge a newer failed write**  An eager retry triggered by a read captures a local value before posting it. When the request succeeds, cleanup uses the completion time as its cutoff. See [eager conflict resolution](https://github.com/MobileNati

- **Issue #732** (2026-04-15): **[BUG] not compiling on iOS in a KMP project.**
  *Symptoms*: Getting the following error when building my code for iOS  Compilation failed: No container found for type parameter 'Key' of 'CLASS IR_EXTERNAL_DECLARATION_STUB INTERFACE name:MutableStore modality:ABSTRACT visibility:public superTypes:[org.mobilenativefoundation.store.store5.Read.StreamWithConflictResolution<Key of org.mobilenativefoundation.store.store5.MutableStore, Output of org.mobilenativefoundation.store.store5.MutableStore>; org.mobilenativefoundation.store.store5.Write<Key of org.mobilenativefoundation.store.store5.MutableStore, Output of org.mobilenativefoundation.store.store5.MutableStore>; org.mobilenativefoundation.store.store5.Write.Stream<Key of org.mobilenativefoundation.store.store5.MutableStore, Output of org.mobilenativefoundation.store.store5.MutableStore>; org.mobilenativefoundation.store.store5.Clear.Key<Key of org.mobilenativefoundation.store.store5.MutableStore>; org.mobilenativefoundation.store.store5.Clear]'  It builds without errors for Android. I currently just have a single MutableStoreBuilder in my project, since I'm testing out this library.
  **Post-Mortem & Fix Analysis**:
  > This turned out to be a bug using koin. Where generic types won't work for DI. single<MutableStore<String, DeviceIconModel>> { create(::deviceIconStore) }

- **Issue #730** (2026-01-24): **[BUG]**
  *Symptoms*: > c4cb296af1300e0373eb483bb59d53bc41fb1dc2    _Originally posted by @mohmed1503-stack in [c4cb296](https://github.com/MobileNativeFoundation/Store/commit/c4cb296af1300e0373eb483bb59d53bc41fb1dc2#commitcomment-174378417)_
  **Post-Mortem & Fix Analysis**:
  > @mohmed1503-stack Hey, can you clarify what you're looking for?

- **Issue #726** (2026-01-04): **[BUG]**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Smartphone (please complete the following information):**  - Device: [e.g. Pixel 3]  - OS: [e.g. Android 10]  - Store Version [e.g. 4.0.0]  **Additional context** Add any other context about the problem here. 

- **Issue #724** (2026-01-04): **[BUG]**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Smartphone (please complete the following information):**  - Device: [e.g. Pixel 3]  - OS: [e.g. Android 10]  - Store Version [e.g. 4.0.0]  **Additional context** Add any other context about the problem here. 

- **Issue #722** (2026-01-11): **[BUG] MutableStore.write reports success when SourceOfTruth writer throws**
  *Symptoms*: Thanks for the awesome library, but I just ran into something odd while poking at mutable writes.  **Describe the bug**  When the SourceOfTruth writer throws, `MutableStore.write()` still returns `StoreWriteResponse.Success`, so callers get an explicit success even though nothing was persisted.  Maybe it's intentional to swallow Exceptions -?- , but I think that I shouldn't receive an excplicit success when my data was not written to store. , Also I've spent hours trying to catch this IllegalStateException thrown error but I couldn't  **To Reproduce**  Steps to see it fail:  1. Check out the current `main` of Store5. 2. Add this regression to `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/RealMutableStoreTest.kt` (around lines 301‑325):  ```kotlin @Test fun write_givenSourceOfTruthFailure_whenCalled_thenSurfacesWriteError() = runTest {     val failingKey = "sotFailKey"     testSourceOfTruth.throwOnWrite(failingKey) {         IllegalStateException("Catch me if you can")     }     val request = StoreWriteRequest.of<String, Note, Unit>(         key = failingKey,         value = Note("idFail", "contentFail"),         created = 3333L,         onCompletions = null,     )      val response = mutableStore.write(request)      val errorResponse = assertIs<StoreWriteResponse.Error.Exception>(response)     val writeException = assertIs<SourceOfTruth.WriteException>(errorResponse.error)     val cause = assertIs<IllegalStateException>(writeException.cause
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, @ahmounir. #727 will be included in the next release

- **Issue #708** (2025-08-16): **[BUG]**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Smartphone (please complete the following information):**  - Device: [e.g. Pixel 3]  - OS: [e.g. Android 10]  - Store Version [e.g. 4.0.0]  **Additional context** Add any other context about the problem here. 

- **Issue #707** (2025-08-16): **Shoofly**
  *Symptoms*: Mobile app to show and buy more type of woods and products by direct order or order something to provide The order sent by message in what's app to number+249994743707

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

### Incident Patch 1: `e169107e` (2026-08-29)
**Commit Message**: fix: derive a tagged logger instead of reconfiguring Kermit's global logger (#750)

`DefaultLogger` and `RealStore`'s companion both ran
`Logger.apply { setLogWriters(listOf(CommonWriter())); setTag("Store") }`
on `co.touchlab.kermit.Logger`, which is Kermit's process-global logger
singleton — not a Store-scoped instance. Constructing a Store therefore
reconfigured logging for the entire host application:

- `setLogWriters` replaces the global writer list, dropping any writer the
  host installed via `addLogWriter` (crash-reporter breadcrumbs, file writers).
- `setTag("Store")` overwrites the global default tag, so unrelated host logs
  start appearing under the "Store" tag.
- Because `withTag` shares the same `MutableLoggerConfig`, loggers the host
  derived earlier are affected too.

The usual ordering makes this the common case: hosts configure logging at
startup and build Stores later, so the Store construction silently wipes the
host's logging setup with no error.

Replace both sites with `Logger.withTag("Store")`, which derives a tagged
logger sharing the host's config and mutates no global state. Store's logs now
flow to whatever writers/severity the host configured; on an u

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/DefaultLogger.kt` (modified, +4/-6)
```diff
@@ -1,17 +1,15 @@
 package org.mobilenativefoundation.store.store5.impl
 
-import co.touchlab.kermit.CommonWriter
 import org.mobilenativefoundation.store.store5.Logger
 
 /**
  * Default implementation of [Logger] using the Kermit logging library.
+ *
+ * Derives a tagged logger from Kermit's global instance rather than reconfiguring it, so the host
+ * application's log writers and default tag are left untouched.
  */
 internal class DefaultLogger : Logger {
-    private val delegate =
-        co.touchlab.kermit.Logger.apply {
-            setLogWriters(listOf(CommonWriter()))
-            setTag("Store")
-        }
+    private val delegate = co.touchlab.kermit.Logger.withTag("Store")
 
     override fun debug(message: String) {
         delegate.d(message)
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealStore.kt` (modified, +3/-6)
```diff
@@ -15,7 +15,6 @@
  */
 package org.mobilenativefoundation.store.store5.impl
 
-import co.touchlab.kermit.CommonWriter
 import co.touchlab.kermit.Logger
 import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.CoroutineScope
@@ -367,10 +366,8 @@ internal class RealStore<Key : Any, Network : Any, Output : Any, Local : Any>(
     private fun fromMemCache(key: Key) = memCache?.getIfPresent(key)
 
     companion object {
-        private val logger =
-            Logger.apply {
-                setLogWriters(listOf(CommonWriter()))
-                setTag("Store")
-            }
+        // Derives a tagged logger instead of reconfiguring Kermit's global one, which would drop
+        // whatever log writers the host application installed.
+        private val logger = Logger.withTag("Store")
     }
 }
```

---

### Incident Patch 2: `f45df778` (2026-07-21)
**Commit Message**: Build modernization: Gradle 9.5, AGP 9.2, Kotlin 2.3, and tooling updates (#736)

* Update Gradle wrapper to 8.14.4 and foojay-resolver-convention plugin to 1.0.0

* Upgrade Gradle from 8.6 to 8.14.4
* Upgrade `org.gradle.toolchains.foojay-resolver-convention` from 0.8.0 to 1.0.0

Signed-off-by: Scott Olcott <[REDACTED_EMAIL]>

* Update GitHub Actions in CI workflow

* Upgrade `actions/checkout` to v6
* Upgrade `actions/setup-java` to v5
* Migrate `gradle/gradle-build-action@v3` to `gradle/actions/setup-gradle@v6`
* Upgrade `codecov/codecov-action` to v6

Signed-off-by: Scott Olcott <[REDACTED_EMAIL]>

* Remove redundant explicit nativeMain dependency on commonMain

The dependency is already added by Kotlin Target Hierarchy template

Signed-off-by: Scott Olcott <[REDACTED_EMAIL]>

* Remove deprecated kotlin.js.compiler=ir from gradle.properties

Signed-off-by: Scott Olcott <[REDACTED_EMAIL]>

* Move ktlint import-ordering rule to .editorconfig

Defining disabled rules was deprecated in build.gradle.kts files

Signed-off-by: Scott Olcott <[REDACTED_EMAIL]>

* Update Kotlin compiler options and multiplatform configuration

* Migrate deprecated `kotlinOptions` to `compilerOptions` usi

**File**: `.editorconfig` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+root = true
+
+[*.{kt,kts}]
+ktlint_standard_import-ordering = disabled
\ No newline at end of file
```

**File**: `.github/workflows/KMMBridge-Release.yml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Publish the release XCFramework to a GitHub Release.
+# Debug XCFrameworks are built locally on demand via `./gradlew <module>:spmDevBuild`.
+name: KMMBridge-Publish
+on:
+  workflow_dispatch:
+
+jobs:
+  call-publish:
+    permissions:
+      contents: write
+      packages: write
+    uses: ./.github/workflows/create_swift_package.yml
```

**File**: `.github/workflows/ci.yml` (modified, +9/-9)
```diff
@@ -16,7 +16,7 @@ jobs:
         api-level: [ 29 ]
     steps:
       - name: Checkout
-        uses: actions/checkout@v4
+        uses: actions/checkout@v6
         with:
           # PR builds (including forks) check out the PR head from its source repo;
           # push builds fall back to the pushed ref on this repo. Without the
@@ -31,26 +31,26 @@ jobs:
           persist-credentials: false
 
       - name: Set up JDK 17
-        uses: actions/setup-java@v4
+        uses: actions/setup-java@v5
         with:
           distribution: 'zulu'
           java-version: '17'
 
       - name: Setup Gradle
-        uses: gradle/gradle-build-action@v3
+        uses: gradle/actions/setup-gradle@v6
 
       - name: Grant execute permission for Gradlew
         run: chmod +x gradlew
 
       - name: Build and Test with Coverage
-        run: ./gradlew clean build koverXmlReport --stacktrace
+        run: ./gradlew clean build koverXmlReport --stacktrace --continue
 
       - name: Upload Coverage to Codecov
         # Secrets (including CODECOV_TOKEN) are not exposed to fork PRs, so the
         # upload would fail under fail_ci_if_error. Skip it for forks; coverage is
         # still uploaded and enforced for same-repo PRs and pushes to main.
         if: ${{ github.event.pull_request.head.repo.full_name == github.repository || github.event_name != 'pull_request' }}
-        uses: codecov/codecov-action@v4
+        uses: codecov/codecov-action@v6
         with:
           token: ${{ secrets.CODECOV_TOKEN }}
           files: build/reports/kover/coverage.xml
@@ -65,23 +65,23 @@ jobs:
     needs: build-and-test
     steps:
       - name: Checkout
-        uses: actions/checkout@v4
+        uses: actions/checkout@v6
 
       - name: Set up JDK 17
-        uses: actions/setup-java@v4
+        uses: actions/setup-java@v5
         with:
           distribution: 'zulu'
           java-version: '17'
 
       - name: Setup Gradle
-        uses: gradle/gradle-build-action@v3
+        uses: gradle/actions/setup-gradle@v6
 
       - name: Grant execute permission for Gradlew
         run: chmod +x gradlew
 
       - name: Retrieve Version
         run: |
-          echo "VERSION_NAME=$(grep -w 'VERSION_NAME' gradle.properties | cut -d'=' -f2)" >> $GITHUB_ENV
+          echo "VERSION_NAME=$(grep -E '^store[[:space:]]*=' gradle/libs.versions.toml | head -1 | cut -d'"' -f2)" >> $GITHUB_ENV
 
       - name: Publish to Maven Central (Central Portal)
         env:
```

**File**: `.github/workflows/create_swift_package.yml` (modified, +64/-4)
```diff
@@ -1,7 +1,67 @@
-name: Create Swift Package
+# Based on: https://github.com/touchlab/KMMBridgeSPMQuickStart/blob/main/.github/workflows/Base-Publish.yml
+# Publishes the release XCFrameworks to a GitHub Release.
+# For debugging Kotlin from Xcode, build a debug XCFramework locally with
+# `./gradlew <module>:spmDevBuild` instead.
+name: Base-Publish
 
 on:
-  workflow_dispatch:
+  workflow_call:
+
+permissions:
+  contents: write
+  packages: write
+
 jobs:
-  publish:
-    uses: touchlab/KMMBridgeGithubWorkflow/.github/workflows/faktorybuildbranches.yml@v0.6
\ No newline at end of file
+  kmmbridgepublish:
+    concurrency: "kmmbridgepublish-${{ github.repository }}"
+    runs-on: macos-latest
+    steps:
+      - name: Checkout the repo with tags
+        uses: actions/checkout@v6
+        with:
+          fetch-depth: 0
+          fetch-tags: true
+
+      - name: Retrieve Version
+        id: versionPropertyValue
+        run: |
+          VERSION=$(grep -E '^store[[:space:]]*=' gradle/libs.versions.toml | head -1 | cut -d'"' -f2)
+          echo "propVal=$VERSION" >> $GITHUB_OUTPUT
+
+      - name: Set up JDK 17
+        uses: actions/setup-java@v5
+        with:
+          distribution: 'zulu'
+          java-version: '17'
+
+      - name: Setup Gradle
+        uses: gradle/actions/setup-gradle@v6
+
+      - name: Grant execute permission for Gradlew
+        run: chmod +x gradlew
+
+      - name: Create or Find Artifact Release
+        id: devrelease
+        uses: softprops/action-gh-release@v2
+        with:
+          token: ${{ secrets.GITHUB_TOKEN }}
+          tag_name: "${{ steps.versionPropertyValue.outputs.propVal }}"
+
+      - name: Build and Publish
+        run: |
+          ./gradlew kmmBridgePublish \
+            -PNATIVE_BUILD_TYPE=RELEASE \
+            -PGITHUB_ARTIFACT_RELEASE_ID=${{ steps.devrelease.outputs.id }} \
+            -PGITHUB_PUBLISH_TOKEN=${{ secrets.GITHUB_TOKEN }} \
+            -PGITHUB_REPO=${{ github.repository }} \
+            -PENABLE_PUBLISHING=true \
+            --no-daemon --info --stacktrace
+        env:
+          GRADLE_OPTS: -Dkotlin.incremental=false -Dorg.gradle.jvmargs="-Xmx3g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:MaxMetaspaceSize=512m"
+
+      - uses: touchlab/ga-update-release-tag@v1
+        id: update-release-tag
+        with:
+          commitMessage: "KMP SPM package release for ${{ steps.versionPropertyValue.outputs.propVal }}"
+          tagMessage: "KMP release version ${{ steps.versionPropertyValue.outputs.propVal }}"
+          tagVersion: ${{ steps.versionPropertyValue.outputs.propVal }}
```

**File**: `build.gradle.kts` (modified, +25/-49)
```diff
@@ -1,63 +1,39 @@
+import org.jetbrains.kotlin.gradle.dsl.JvmTarget
+import org.jetbrains.kotlin.gradle.tasks.KotlinCompile
+
 plugins {
+    alias(libs.plugins.android.kotlin.multiplatform) apply false
+    alias(libs.plugins.android.library) apply false
+    alias(libs.plugins.kotlin.multiplatform) apply false
+    alias(libs.plugins.kotlin.serialization) apply false
+    alias(libs.plugins.dokka) apply false
+    alias(libs.plugins.vanniktech.maven.publish) apply false
+    alias(libs.plugins.atomicfu) apply false
+    alias(libs.plugins.kotlin.cocoapods) apply false
     alias(libs.plugins.ktlint)
-    id("com.diffplug.spotless") version "6.4.1"
-}
-
-buildscript {
-    repositories {
-        mavenCentral()
-        gradlePluginPortal()
-        google()
-    }
-
-    dependencies {
-        classpath(libs.android.gradle.plugin)
-        classpath(libs.kotlin.gradle.plugin)
-        classpath(libs.kotlin.serialization.plugin)
-        classpath(libs.dokka.gradle.plugin)
-        classpath(libs.ktlint.gradle.plugin)
-        classpath(libs.jacoco.gradle.plugin)
-        classpath(libs.maven.publish.plugin)
-        classpath(libs.atomic.fu.gradle.plugin)
-        classpath(libs.kmmBridge.gradle.plugin)
-        classpath(libs.binary.compatibility.validator)
-    }
-}
-
-allprojects {
-    repositories {
-        mavenCentral()
-        google()
-    }
-}
-
-subprojects {
-    apply(plugin = "org.jlleitschuh.gradle.ktlint")
-    apply(plugin = "com.diffplug.spotless")
-
-    ktlint {
-        disabledRules.add("import-ordering")
-    }
-
-    spotless {
-        kotlin {
-            target("src/**/*.kt")
-        }
-    }
+    alias(libs.plugins.spotless)
+    alias(libs.plugins.binary.compatibility.validator) apply false
+    alias(libs.plugins.kmmbridge.github) apply false
 }
 
 tasks {
-    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
-        kotlinOptions {
-            jvmTarget = "11"
+    withType<KotlinCompile> {
+        compilerOptions {
+            jvmTarget = JvmTarget.fromTarget(libs.versions.jvmCompat.get())
         }
     }
 
     withType<JavaCompile>().configureEach {
-        sourceCompatibility = JavaVersion.VERSION_11.name
-        targetCompatibility = JavaVersion.VERSION_11.name
+        sourceCompatibility = libs.versions.jvmCompat.get()
+        targetCompatibility = libs.versions.jvmCompat.get()
     }
 }
 
 // Workaround for https://youtrack.jetbrains.com/issue/KT-62040
 tasks.getByName("wrapper")
+
+tasks.named<UpdateDaemonJvm>("updateDaemonJvm") {
+    // JDK 17 is the minimum version supported by the org.gradle.toolchains.foojay-resolver-convention plugin
+    languageVersion = JavaLanguageVersion.of(17)
+    vendor.set(JvmVendorSpec.AZUL)
+}
```

**File**: `cache/api/android/cache.api` (removed, +0/-69)
```diff
@@ -1,69 +0,0 @@
-public abstract interface class org/mobilenativefoundation/store/cache5/Cache {
-	public abstract fun getAllPresent ()Ljava/util/Map;
-	public abstract fun getAllPresent (Ljava/util/List;)Ljava/util/Map;
-	public abstract fun getIfPresent (Ljava/lang/Object;)Ljava/lang/Object;
-	public abstract fun getOrPut (Ljava/lang/Object;Lkotlin/jvm/functions/Function0;)Ljava/lang/Object;
-	public abstract fun invalidate (Ljava/lang/Object;)V
-	public abstract fun invalidateAll ()V
-	public abstract fun invalidateAll (Ljava/util/List;)V
-	public abstract fun put (Ljava/lang/Object;Ljava/lang/Object;)V
-	public abstract fun putAll (Ljava/util/Map;)V
-	public abstract fun size ()J
-}
-
-public final class org/mobilenativefoundation/store/cache5/Cache$DefaultImpls {
-	public static fun getAllPresent (Lorg/mobilenativefoundation/store/cache5/Cache;)Ljava/util/Map;
-}
-
-public final class org/mobilenativefoundation/store/cache5/CacheBuilder {
-	public static final field Companion Lorg/mobilenativefoundation/store/cache5/CacheBuilder$Companion;
-	public fun <init> ()V
-	public final fun build ()Lorg/mobilenativefoundation/store/cache5/Cache;
-	public final fun concurrencyLevel (Lkotlin/jvm/functions/Function0;)Lorg/mobilenativefoundation/store/cache5/CacheBuilder;
-	public final fun expireAfterAccess-LRDsOJo (J)Lorg/mobilenativefoundation/store/cache5/CacheBuilder;
-	public final fun expireAfterWrite-LRDsOJo (J)Lorg/mobilenativefoundation/store/cache5/CacheBuilder;
-	public final fun maximumSize (J)Lorg/mobilenativefoundation/store/cache5/CacheBuilder;
-	public final fun ticker (Lkotlin/jvm/functions/Function0;)Lorg/mobilenativefoundation/store/cache5/CacheBuilder;
-	public final fun weigher (JLkotlin/jvm/functions/Function2;)Lorg/mobilenativefoundation/store/cache5/CacheBuilder;
-}
-
-public final class org/mobilenativefoundation/store/cache5/CacheBuilder$Companion {
-}
-
-public final class org/mobilenativefoundation/store/cache5/StoreMultiCache : org/mobilenativefoundation/store/cache5/Cache {
-	public static final field Companion Lorg/mobilenativefoundation/store/cache5/StoreMultiCache$Companion;
-	public fun <init> (Lorg/mobilenativefoundation/store/core5/KeyProvider;Lorg/mobilenativefoundation/store/cache5/Cache;Lorg/mobilenativefoundation/store/cache5/Cache;)V
-	public synthetic fun <init> (Lorg/mobilenativefoundation/store/core5/KeyProvider;Lorg/mobilenativefoundation/store/cache5/Cache;Lorg/mobilenativefoundation/store/cache5/Cache;ILkotlin/jvm/internal/DefaultConstructorMarker;)V
-	public fun getAllPresent ()Ljava/util/Map;
-	public fun getAllPresent (Ljava/util/List;)Ljava/util/Map;
-	public synthetic fun getIfPresent (Ljava/lang/Object;)Ljava/lang/Object;
-	public fun getIfPresent (Lorg/mobilenativefoundation/store/core5/StoreKey;)Lorg/mobilenativefoundation/store/core5/StoreData;
-	public synthetic fun getOrPut (Ljava/lang/Object;Lkotlin/jvm/functions/Function0;)Ljava/lang/Object;
-	public fun getOrPut (Lorg/mobilenativefoundation/store/core5/StoreKey;Lkotlin/jvm/functions/Function0;)Lorg/mobilenativefoundation/store/core5/StoreData;
-	public synthetic fun invalidate (Ljava/lang/Object;)V
-	public fun invalidate (Lorg/mobilenativefoundation/store/core5/StoreKey;)V
-	public fun invalidateAll ()V
-	public fun invalidateAll (Ljava/util/List;)V
-	public synthetic fun put (Ljava/lang/Object;Ljava/lang/Object;)V
-	public fun put (Lorg/mobilenativefoundation/store/core5/StoreKey;Lorg/mobilenativefoundation/store/core5/StoreData;)V
-	public fun putAll (Ljava/util/Map;)V
-	public fun size ()J
-}
-
-public final class org/mobilenativefoundation/store/cache5/StoreMultiCache$Companion {
-	public final fun invalidKeyErrorMessage (Ljava/lang/Object;)Ljava/lang/String;
-}
-
-public final class org/mobilenativefoundation/store/cache5/StoreMultiCacheAccessor {
-	public fun <init> (Lorg/mobilenativefoundation/store/cache5/Cache;Lorg/mobilenativefoundation/store/cache5/Cache;)V
-	public final fun getAllPresent ()Ljava/util/Map;
-	public final fun getCollection (Lorg/mobilenativefoundation/store/core5/StoreKey$Collection;)Lorg/mobilenativefoundation/store/core5/StoreData$Collection;
-	public final fun getSingle (Lorg/mobilenativefoundation/store/core5/StoreKey$Single;)Lorg/mobilenativefoundation/store/core5/StoreData$Single;
-	public final fun invalidateAll ()V
-	public final fun invalidateCollection (Lorg/mobilenativefoundation/store/core5/StoreKey$Collection;)Z
-	public final fun invalidateSingle (Lorg/mobilenativefoundation/store/core5/StoreKey$Single;)Z
-	public final fun putCollection (Lorg/mobilenativefoundation/store/core5/StoreKey$Collection;Lorg/mobilenativefoundation/store/core5/StoreData$Collection;)Z
-	public final fun putSingle (Lorg/mobilenativefoundation/store/core5/StoreKey$Single;Lorg/mobilenativefoundation/store/core5/StoreData$Single;)Z
-	public final fun size ()J
-}
-
```

**File**: `cache/api/jvm/cache.api` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 public abstract interface class org/mobilenativefoundation/store/cache5/Cache {
-	public abstract fun getAllPresent ()Ljava/util/Map;
+	public fun getAllPresent ()Ljava/util/Map;
 	public abstract fun getAllPresent (Ljava/util/List;)Ljava/util/Map;
 	public abstract fun getIfPresent (Ljava/lang/Object;)Ljava/lang/Object;
 	public abstract fun getOrPut (Ljava/lang/Object;Lkotlin/jvm/functions/Function0;)Ljava/lang/Object;
```

**File**: `cache/build.gradle.kts` (modified, +2/-6)
```diff
@@ -5,22 +5,18 @@ plugins {
 kotlin {
 
     sourceSets {
-        val commonMain by getting {
+        commonMain {
             dependencies {
                 api(libs.kotlinx.atomic.fu)
                 api(projects.core)
                 implementation(libs.kotlinx.coroutines.core)
             }
         }
-        val commonTest by getting {
+        commonTest {
             dependencies {
                 implementation(libs.junit)
                 implementation(libs.kotlinx.coroutines.test)
             }
         }
     }
 }
-
-android {
-    namespace = "org.mobilenativefoundation.store.cache"
-}
```

---

### Incident Patch 3: `8bfb9d67` (2026-07-12)
**Commit Message**: Fix multicaster race that leaves a new downstream without a producer (#740)

When the last downstream is removed, StoreChannelManager cancels the
producer but keeps the stale reference until the producer's async
UpstreamFinished message is processed. An AddChannel message that
arrives in between sees producer != null and does not restart the
upstream. If nothing was dispatched and piggybackingDownstream is
enabled, doHandleUpstreamClose then parks that downstream as
piggybacked without reactivation, so it never receives a value.

Store hits this via FetcherController (piggybackingDownstream = true):
cancelling a collector of store.stream() and immediately resubscribing
to the same key can hang the new collector forever until an unrelated
subscriber on the same key restarts the fetcher.

Clear the producer reference in doRemove right after cancelAndJoin so
a subsequent AddChannel starts a fresh producer. The stale
UpstreamFinished of the cancelled producer is already ignored by the
identity check in doHandleUpstreamClose.

Signed-off-by: Martin.Strambach <[REDACTED_EMAIL]>

**File**: `multicast/src/commonMain/kotlin/org/mobilenativefoundation/store/multicast5/ChannelManager.kt` (modified, +6/-0)
```diff
@@ -321,6 +321,12 @@ internal class StoreChannelManager<T>(
                 channels.removeAt(index)
                 if (!keepUpstreamAlive && channels.isEmpty()) {
                     producer?.cancelAndJoin()
+                    // Clear the dead producer reference right away instead of waiting for its
+                    // UpstreamFinished message. Otherwise a downstream added before that message
+                    // arrives would not restart the upstream and would never receive a value.
+                    // The stale UpstreamFinished is ignored by the identity check in
+                    // doHandleUpstreamClose.
+                    producer = null
                 }
             }
         }
```

**File**: `multicast/src/commonTest/kotlin/org/mobilenativefoundation/store/multicast5/StoreChannelManagerTests.kt` (modified, +46/-0)
```diff
@@ -3,6 +3,8 @@ package org.mobilenativefoundation.store.multicast5
 import app.cash.turbine.test
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.awaitCancellation
 import kotlinx.coroutines.channels.Channel
 import kotlinx.coroutines.flow.consumeAsFlow
 import kotlinx.coroutines.flow.filterIsInstance
@@ -11,10 +13,12 @@ import kotlinx.coroutines.flow.onEach
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
+import kotlinx.coroutines.test.advanceUntilIdle
 import kotlinx.coroutines.test.runTest
 import kotlin.test.Test
 import kotlin.test.assertEquals
 
+@OptIn(ExperimentalCoroutinesApi::class)
 class StoreChannelManagerTests {
     @Test
     fun cancelledDownstreamChannelShouldNotCancelOtherChannels() =
@@ -72,6 +76,48 @@ class StoreChannelManagerTests {
             }
         }
 
+    @Test
+    fun downstreamAddedWhileUpstreamCancellationIsInFlightShouldRestartUpstream() =
+        runTest {
+            var upstreamCollectionCount = 0
+            val upstreamFlow =
+                flow {
+                    upstreamCollectionCount++
+                    if (upstreamCollectionCount == 1) {
+                        awaitCancellation()
+                    } else {
+                        emit(1)
+                    }
+                }
+            val channelManager =
+                StoreChannelManager(
+                    scope = this,
+                    bufferSize = 0,
+                    upstream = upstreamFlow,
+                    piggybackingDownstream = true,
+                    keepUpstreamAlive = false,
+                    onEach = { },
+                )
+            val firstChannel = Channel<ChannelManager.Message.Dispatch.Value<Int>>(Channel.UNLIMITED)
+            val secondChannel = Channel<ChannelManager.Message.Dispatch.Value<Int>>(Channel.UNLIMITED)
+
+            channelManager.addDownstream(firstChannel)
+            advanceUntilIdle()
+
+            // Removing the last downstream makes the actor suspend in doRemove on
+            // producer.cancelAndJoin(). Adding the next downstream right away enqueues its
+            // AddChannel message ahead of the producer's UpstreamFinished message, so the add is
+            // processed while the dead producer reference is still set.
+            channelManager.removeDownstream(firstChannel)
+            channelManager.addDownstream(secondChannel)
+            advanceUntilIdle()
+
+            val dispatchedValue = secondChannel.tryReceive().getOrNull()
+            assertEquals(1, dispatchedValue?.value)
+
+            channelManager.close()
+        }
+
     private fun createChannels(count: Int): List<Channel<ChannelManager.Message.Dispatch<Int>>> {
         return (1..count).map { Channel(Channel.UNLIMITED) }
     }
```

---

### Incident Patch 4: `0225d8fe` (2026-06-10)
**Commit Message**: Fix RealMutableStore write-queue data race (inverted lock polarity) (#735)

* Fix RealMutableStore write-queue data race (inverted lock polarity)

The per-key write-request queue is a non-thread-safe ArrayDeque, but
withWriteRequestQueueLock guarded it with a Lightswitch — a shared/reader
lock that lets multiple holders run concurrently. So addWriteRequestToQueue
(add) and updateWriteRequestQueue (iterate + rebuild) could run on the same
deque at once. A structural add during iteration corrupts the backing array:
ConcurrentModificationException on the JVM, EXC_BAD_ACCESS on Kotlin/Native.
The only exclusive (mutex) holder was a pure read (getLatestWriteRequest) —
the polarity was inverted.

Guard all write-queue access with the per-key exclusive mutex instead, so
add/iterate/rebuild mutually exclude each other and getLatestWriteRequest.

Adds MutableStoreConcurrencyTest reproducing the race (red pre-fix on both
JVM and native, green after). Lightswitch is now unused in RealMutableStore;
left in place to keep the diff focused (can be removed as a follow-up).

Signed-off-by: Martin Strambach <[REDACTED_EMAIL]>

* Remove now-dead Lightswitch

After the previous commit nothing acquires

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt` (modified, +7/-6)
```diff
@@ -222,13 +222,14 @@ internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local :
         // Acquire the ThreadSafety object for this key without holding storeLock.
         val threadSafety = getThreadSafety(key)
 
-        // Now safely lock the queue's own mutex.
-        threadSafety.writeRequests.lightswitch.lock(threadSafety.writeRequests.mutex)
-        return try {
-            val queue = getQueue((key))
+        // Exclusively lock the queue's own mutex. The block both reads and structurally mutates the
+        // per-key ArrayDeque (add / iterate-and-rebuild), so callers must mutually exclude each other.
+        // A shared/reader lock here would allow a concurrent add() during iteration, corrupting the
+        // deque's backing array — a ConcurrentModificationException on the JVM and an EXC_BAD_ACCESS
+        // on Kotlin/Native.
+        return threadSafety.writeRequests.mutex.withLock {
+            val queue = getQueue(key)
             queue.block()
-        } finally {
-            threadSafety.writeRequests.lightswitch.unlock(threadSafety.writeRequests.mutex)
         }
     }
 
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/internal/concurrent/Lightswitch.kt` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-package org.mobilenativefoundation.store.store5.internal.concurrent
-
-import kotlinx.coroutines.sync.Mutex
-import kotlinx.coroutines.sync.withLock
-
-/**
- * Locks when first reader starts and unlocks when last reader finishes.
- * Lightswitch analogy: First one into a room turns on the light (locks the mutex), and the last one out turns off the light (unlocks the mutex).
- * @property counter Number of readers
- */
-internal class Lightswitch {
-    private var counter = 0
-    private val mutex = Mutex()
-
-    suspend fun lock(room: Mutex) {
-        mutex.withLock {
-            counter += 1
-            if (counter == 1) {
-                room.lock()
-            }
-        }
-    }
-
-    suspend fun unlock(room: Mutex) {
-        mutex.withLock {
-            counter -= 1
-            check(counter >= 0)
-            if (counter == 0) {
-                room.unlock()
-            }
-        }
-    }
-}
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/internal/concurrent/ThreadSafety.kt` (modified, +0/-1)
```diff
@@ -9,5 +9,4 @@ internal data class ThreadSafety(
 
 internal data class StoreThreadSafety(
     val mutex: Mutex = Mutex(),
-    val lightswitch: Lightswitch = Lightswitch(),
 )
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/MutableStoreConcurrencyTest.kt` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+@file:OptIn(ExperimentalCoroutinesApi::class, ExperimentalStoreApi::class)
+
+package org.mobilenativefoundation.store.store5.mutablestore
+
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.async
+import kotlinx.coroutines.awaitAll
+import kotlinx.coroutines.coroutineScope
+import kotlinx.coroutines.test.runTest
+import org.mobilenativefoundation.store.cache5.CacheBuilder
+import org.mobilenativefoundation.store.core5.ExperimentalStoreApi
+import org.mobilenativefoundation.store.store5.StoreWriteRequest
+import org.mobilenativefoundation.store.store5.StoreWriteResponse
+import org.mobilenativefoundation.store.store5.Updater
+import org.mobilenativefoundation.store.store5.UpdaterResult
+import org.mobilenativefoundation.store.store5.impl.RealMutableStore
+import org.mobilenativefoundation.store.store5.impl.RealStore
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestConverter
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestFetcher
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestLogger
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestValidator
+import org.mobilenativefoundation.store.store5.mutablestore.util.testStore
+import kotlin.test.Test
+import kotlin.test.assertTrue
+
+/**
+ * Regression test for a data race in [RealMutableStore]'s per-key write-request queue.
+ *
+ * The queue is a non-thread-safe `ArrayDeque`. Mutating access goes through
+ * `withWriteRequestQueueLock`, which historically guarded it with a shared/reader lock that lets
+ * multiple holders run concurrently. As a result two operations on the same key could run at once:
+ * `addWriteRequestToQueue` doing `add(...)` while `updateWriteRequestQueue` iterates the same deque
+ * (`for (writeRequest in this)`). A structural `add` during iteration corrupts the backing array.
+ *
+ * On Kotlin/Native this surfaces as `EXC_BAD_ACCESS` (a hard process crash). On the JVM the deque's
+ * fail-fast iterator throws `ConcurrentModificationException`, which `RealMutableStore` catches and
+ * converts into a [StoreWriteResponse.Error.Exception]. Either way, with correct mutual exclusion
+ * every write should succeed.
+ *
+ * The delegate is backed by a real thread-safe cache (cache5) with no source of truth, so the only
+ * unsynchronized shared mutable state exercised here is the write-request queue itself.
+ */
+@OptIn(ExperimentalCoroutinesApi::class, ExperimentalStoreApi::class)
+class MutableStoreConcurrencyTest {
+    private fun newMutableStore(): RealMutableStore<String, Int, Int, Int> {
+        val delegate: RealStore<String, Int, Int, Int> =
+            testStore(
+                fetcher = TestFetcher(),
+                sourceOfTruth = null,
+                converter = TestConverter(),
+                validator = TestValidator(),
+                memoryCache = CacheBuilder<String, Int>().build(),
+            )
+        return RealMutableStore(
+            delegate = delegate,
+            updater = Updater.by<String, Int, Int>({ _, value -> UpdaterResult.Success.Typed(value) }),
+            bookkeeper = null,
+            logger = TestLogger(),
+        )
+    }
+
+    @Test
+    fun sequentialWritesToSameKey_allSucceed() =
+        runTest {
+            val mutableStore = newMutableStore()
+            val key = "key"
+            val responses = (1..500).map { i -> mutableStore.write<Int>(StoreWriteRequest.of(key = key, value = i)) }
+            val failures = responses.filterIsInstance<StoreWriteResponse.Error.Exception>()
+            assertTrue(
+                failures.isEmpty(),
+                "Baseline sequential writes should all succeed, but ${failures.size} failed" +
+                    (failures.firstOrNull()?.let { ", first error = ${it.error}" } ?: ""),
+            )
+        }
+
+    @Test
+    fun concurrentWritesToSameKey_doNotCorruptWriteQueue() =
+        runTest {
+            val mutableStore = newMutableStore()
+            val key = "key"
+            val concurrentWriters = 64
+            val rounds = 50
+
+            repeat(rounds) { round ->
+                val responses =
+                    coroutineScope {
+                        (1..concurrentWriters)
+                            .map { i ->
+                                async(Dispatchers.Default) {
+                                    mutableStore.write<Int>(
+                                        StoreWriteRequest.of(key = key, value = round * concurrentWriters + i),
+                                    )
+                                }
+                            }
+                            .awaitAll()
+                    }
+
+                // A corrupted ArrayDeque surfaces as a memory-safety symptom: ConcurrentModificationException,
+                // NullPointerException, or IndexOutOfBoundsException on the JVM (EXC_BAD_ACCESS aborts the
+           
```

---

### Incident Patch 5: `80db9675` (2026-06-07)
**Commit Message**: Fix CI checkout and coverage upload for fork PRs (#737)

**File**: `.github/workflows/ci.yml` (modified, +13/-1)
```diff
@@ -18,7 +18,15 @@ jobs:
       - name: Checkout
         uses: actions/checkout@v4
         with:
-          ref: ${{ github.head_ref || github.ref }}
+          # PR builds (including forks) check out the PR head from its source repo;
+          # push builds fall back to the pushed ref on this repo. Without the
+          # repository override, fork-PR checkouts look for the head branch in the
+          # base repo and fail with "a branch or tag ... could not be found".
+          # Use the branch name (not the head SHA) so HEAD stays attached to a
+          # branch — the KMMBridge plugin runs `git pull --tags`, which fails on a
+          # detached HEAD with "you are not currently on a branch".
+          repository: ${{ github.event.pull_request.head.repo.full_name || github.repository }}
+          ref: ${{ github.event.pull_request.head.ref || github.ref }}
           fetch-depth: 0
           persist-credentials: false
 
@@ -38,6 +46,10 @@ jobs:
         run: ./gradlew clean build koverXmlReport --stacktrace
 
       - name: Upload Coverage to Codecov
+        # Secrets (including CODECOV_TOKEN) are not exposed to fork PRs, so the
+        # upload would fail under fail_ci_if_error. Skip it for forks; coverage is
+        # still uploaded and enforced for same-repo PRs and pushes to main.
+        if: ${{ github.event.pull_request.head.repo.full_name == github.repository || github.event_name != 'pull_request' }}
         uses: codecov/codecov-action@v4
         with:
           token: ${{ secrets.CODECOV_TOKEN }}
```

---

### Incident Patch 6: `cfb4ae05` (2026-01-11)
**Commit Message**: Fix MutableStore.write() ignoring SourceOfTruth write failures (#727)

Signed-off-by: Matt Ramotar <[REDACTED_EMAIL]>

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt` (modified, +23/-17)
```diff
@@ -24,6 +24,7 @@ import org.mobilenativefoundation.store.store5.impl.extensions.now
 import org.mobilenativefoundation.store.store5.internal.concurrent.ThreadSafety
 import org.mobilenativefoundation.store.store5.internal.definition.WriteRequestQueue
 import org.mobilenativefoundation.store.store5.internal.result.EagerConflictResolutionResult
+import org.mobilenativefoundation.store.store5.internal.result.StoreDelegateWriteResult
 
 @OptIn(ExperimentalStoreApi::class)
 internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local : Any>(
@@ -85,25 +86,30 @@ internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local :
                     val storeWriteResponse =
                         try {
                             // Always write to local first.
-                            delegate.write(writeRequest.key, writeRequest.value)
-
-                            // Try to sync to network.
-                            val updaterResult = tryUpdateServer(writeRequest)
-
-                            // Convert UpdaterResult -> StoreWriteResponse.
-                            when (updaterResult) {
-                                is UpdaterResult.Error.Exception -> StoreWriteResponse.Error.Exception(updaterResult.error)
-                                is UpdaterResult.Error.Message -> StoreWriteResponse.Error.Message(updaterResult.message)
-                                is UpdaterResult.Success.Typed<*> -> {
-                                    val typedValue = updaterResult.value as? Response
-                                    if (typedValue == null) {
-                                        StoreWriteResponse.Success.Untyped(updaterResult.value)
-                                    } else {
-                                        StoreWriteResponse.Success.Typed(updaterResult.value)
+                            // Only proceed to network if local write succeeded.
+                            when (val delegateWriteResult = delegate.write(writeRequest.key, writeRequest.value)) {
+                                is StoreDelegateWriteResult.Error.Exception -> {
+                                    StoreWriteResponse.Error.Exception(delegateWriteResult.error)
+                                }
+                                is StoreDelegateWriteResult.Error.Message -> {
+                                    StoreWriteResponse.Error.Message(delegateWriteResult.error)
+                                }
+                                is StoreDelegateWriteResult.Success -> {
+                                    // Try to sync to network.
+                                    when (val updaterResult = tryUpdateServer(writeRequest)) {
+                                        is UpdaterResult.Error.Exception -> StoreWriteResponse.Error.Exception(updaterResult.error)
+                                        is UpdaterResult.Error.Message -> StoreWriteResponse.Error.Message(updaterResult.message)
+                                        is UpdaterResult.Success.Typed<*> -> {
+                                            val typedValue = updaterResult.value as? Response
+                                            if (typedValue == null) {
+                                                StoreWriteResponse.Success.Untyped(updaterResult.value)
+                                            } else {
+                                                StoreWriteResponse.Success.Typed(updaterResult.value)
+                                            }
+                                        }
+                                        is UpdaterResult.Success.Untyped -> StoreWriteResponse.Success.Untyped(updaterResult.value)
                                     }
                                 }
-
-                                is UpdaterResult.Success.Untyped -> StoreWriteResponse.Success.Untyped(updaterResult.value)
                             }
                         } catch (throwable: Throwable) {
                             StoreWriteResponse.Error.Exception(throwable)
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealStore.kt` (modified, +7/-3)
```diff
@@ -332,9 +332,13 @@ internal class RealStore<Key : Any, Network : Any, Output : Any, Local : Any>(
         value: Output,
     ): StoreDelegateWriteResult =
         try {
-            memCache?.put(key, value)
-            sourceOfTruth?.write(key, converter.fromOutputToLocal(value))
-            StoreDelegateWriteResult.Success
+            val writeException = sourceOfTruth?.write(key, converter.fromOutputToLocal(value))
+            if (writeException != null) {
+                StoreDelegateWriteResult.Error.Exception(writeException)
+            } else {
+                memCache?.put(key, value)
+                StoreDelegateWriteResult.Success
+            }
         } catch (error: Throwable) {
             StoreDelegateWriteResult.Error.Exception(error)
         }
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/SourceOfTruthWithBarrier.kt` (modified, +24/-14)
```diff
@@ -144,11 +144,18 @@ internal class SourceOfTruthWithBarrier<Key : Any, Network : Any, Output : Any,
         }
     }
 
+    /**
+     * Writes a value to the underlying [SourceOfTruth] and returns any error that occurred.
+     *
+     * @return The [SourceOfTruth.WriteException] if the write failed, or null if successful.
+     *         Callers like [RealStore.write] can check this to determine if the write succeeded.
+     *         The barrier mechanism also notifies readers of the error via [BarrierMsg.Open.writeError].
+     */
     @Suppress("UNCHECKED_CAST")
     suspend fun write(
         key: Key,
         value: Local,
-    ) {
+    ): SourceOfTruth.WriteException? {
         val barrier = barriers.acquire(key)
         try {
             barrier.emit(BarrierMsg.Blocked(versionCounter.incrementAndGet()))
@@ -164,24 +171,27 @@ internal class SourceOfTruthWithBarrier<Key : Any, Network : Any, Output : Any,
                     }
                 }
 
+            // Avoid double-wrapping if the error is already a WriteException.
+            val writeException =
+                writeError?.let {
+                    writeError as? SourceOfTruth.WriteException
+                        ?: SourceOfTruth.WriteException(
+                            key = key,
+                            value = value,
+                            cause = writeError,
+                        )
+                }
+
             barrier.emit(
                 BarrierMsg.Open(
                     version = versionCounter.incrementAndGet(),
-                    writeError =
-                        writeError?.let {
-                            SourceOfTruth.WriteException(
-                                key = key,
-                                value = value,
-                                cause = writeError,
-                            )
-                        },
+                    writeError = writeException,
                 ),
             )
-            if (writeError is CancellationException) {
-                // only throw if it failed because of cancelation.
-                // otherwise, we take care of letting downstream know that there was a write error
-                throw writeError
-            }
+
+            // Return the error so callers know the operation failed.
+            // The barrier message above notifies readers of the error.
+            return writeException
         } finally {
             barriers.release(key, barrier)
         }
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/RealMutableStoreTest.kt` (modified, +110/-0)
```diff
@@ -11,6 +11,7 @@ import kotlinx.coroutines.flow.toList
 import kotlinx.coroutines.test.runTest
 import org.mobilenativefoundation.store.core5.ExperimentalStoreApi
 import org.mobilenativefoundation.store.store5.FetcherResult
+import org.mobilenativefoundation.store.store5.SourceOfTruth
 import org.mobilenativefoundation.store.store5.StoreReadRequest
 import org.mobilenativefoundation.store.store5.StoreReadResponse
 import org.mobilenativefoundation.store.store5.StoreWriteRequest
@@ -297,6 +298,115 @@ class RealMutableStoreTest {
             assertNotNull(testBookkeeper.getLastFailedSync("exceptionKey"))
         }
 
+    @Test
+    fun write_givenSourceOfTruthFailure_whenCalled_thenSurfacesWriteError() =
+        runTest {
+            // Given
+            val key = "key"
+            val errorMessage = "write error"
+            testSourceOfTruth.throwOnWrite(key) {
+                IllegalStateException(errorMessage)
+            }
+            val request =
+                StoreWriteRequest.of<String, Note, Unit>(
+                    key = key,
+                    value = Note(key, "content"),
+                    created = 3333L,
+                    onCompletions = null,
+                )
+
+            // When
+            val response = mutableStore.write(request)
+
+            // Then
+            val errorResponse = assertIs<StoreWriteResponse.Error.Exception>(response)
+            val writeException = assertIs<SourceOfTruth.WriteException>(errorResponse.error)
+            val cause = assertIs<IllegalStateException>(writeException.cause)
+            assertEquals(errorMessage, cause.message)
+        }
+
+    @Test
+    fun write_givenSourceOfTruthFailure_whenCalled_thenNetworkSyncNotAttempted() =
+        runTest {
+            // Given
+            val key = "key"
+            testUpdater.postCallCount = 0
+            testSourceOfTruth.throwOnWrite(key) { IllegalStateException("SOT failure") }
+
+            val request =
+                StoreWriteRequest.of<String, Note, Unit>(
+                    key = key,
+                    value = Note(key, "content"),
+                    created = 4444L,
+                    onCompletions = null,
+                )
+
+            // When
+            val response = mutableStore.write(request)
+
+            // Then
+            assertIs<StoreWriteResponse.Error.Exception>(response)
+            assertEquals(0, testUpdater.postCallCount, "Network updater should not be called when SOT write fails")
+        }
+
+    @Test
+    fun write_givenSourceOfTruthFailure_whenCalled_thenMemCacheNotUpdated() =
+        runTest {
+            // Given
+            val key = "key"
+            testSourceOfTruth.throwOnWrite(key) { IllegalStateException("SOT failure") }
+
+            val request =
+                StoreWriteRequest.of<String, Note, Unit>(
+                    key = key,
+                    value = Note(key, "content"),
+                    created = 6666L,
+                    onCompletions = null,
+                )
+
+            // When
+            val response = mutableStore.write(request)
+
+            // Then
+            assertIs<StoreWriteResponse.Error.Exception>(response)
+            assertNull(delegateStore.latestOrNull(key), "Value should not be in cache after SOT write failure")
+        }
+
+    @Test
+    fun write_givenNoSourceOfTruth_whenCalled_thenSucceeds() =
+        runTest {
+            // Given
+            val storeWithoutSot =
+                testStore(
+                    fetcher = testFetcher,
+                    sourceOfTruth = null,
+                    converter = testConverter,
+                    validator = testValidator,
+                    memoryCache = testCache,
+                )
+            val mutableStoreWithoutSot =
+                RealMutableStore(
+                    delegate = storeWithoutSot,
+                    updater = testUpdater,
+                    bookkeeper = testBookkeeper,
+                    logger = testLogger,
+                )
+
+            val request =
+                StoreWriteRequest.of<String, Note, Unit>(
+                    key = "noSotKey",
+                    value = Note("id", "content"),
+                    created = 5555L,
+                    onCompletions = null,
+                )
+
+            // When
+            val response = mutableStoreWithoutSot.write(request)
+
+            // Then
+            assertIs<StoreWriteResponse.Success>(response)
+        }
+
     @Test
     fun clearAll_givenSomeKeys_whenCalled_thenDelegateIsCleared() =
         runTest {
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/util/TestStore.kt` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ internal fun <Key : Any, Network : Any, Output : Any, Local : Any> testStore(
     dispatcher: CoroutineDispatcher = Dispatchers.Default,
     scope: CoroutineScope = CoroutineScope(dispatcher),
     fetcher: Fetcher<Key, Network> = TestFetcher(),
-    sourceOfTruth: SourceOfTruth<Key, Local, Output> = TestSourceOfTruth(),
+    sourceOfTruth: SourceOfTruth<Key, Local, Output>? = TestSourceOfTruth(),
     converter: Converter<Network, Local, Output> = TestConverter(),
     validator: Validator<Output> = TestValidator(),
     memoryCache: Cache<Key, Output> = TestCache(),
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/util/TestUpdater.kt` (modified, +2/-0)
```diff
@@ -8,11 +8,13 @@ class TestUpdater<Key : Any, Output : Any, Response : Any> : Updater<Key, Output
     var exception: Throwable? = null
     var errorMessage: String? = null
     var successValue: Response? = null
+    var postCallCount: Int = 0
 
     override suspend fun post(
         key: Key,
         value: Output,
     ): UpdaterResult {
+        postCallCount++
         exception?.let { return UpdaterResult.Error.Exception(it) }
         errorMessage?.let { return UpdaterResult.Error.Message(it) }
         successValue?.let { return UpdaterResult.Success.Typed(it) }
```

---

### Incident Patch 7: `68013443` (2025-02-25)
**Commit Message**: Fix Eager Conflict Resolution Deadlock and Improve Mutable Store Code Quality (#679)

* Fix and Cover Eager Conflict Resolution Deadlock

Signed-off-by: Matt Ramotar <[REDACTED_EMAIL]>

* Cover RealMutableStore

Signed-off-by: Matt Ramotar <[REDACTED_EMAIL]>

---------

Signed-off-by: Matt Ramotar <[REDACTED_EMAIL]>

**File**: `store/api/android/store.api` (modified, +9/-3)
```diff
@@ -123,6 +123,15 @@ public final class org/mobilenativefoundation/store/store5/FetcherResult$Error$M
 	public fun toString ()Ljava/lang/String;
 }
 
+public abstract interface class org/mobilenativefoundation/store/store5/Logger {
+	public abstract fun debug (Ljava/lang/String;)V
+	public abstract fun error (Ljava/lang/String;Ljava/lang/Throwable;)V
+}
+
+public final class org/mobilenativefoundation/store/store5/Logger$DefaultImpls {
+	public static synthetic fun error$default (Lorg/mobilenativefoundation/store/store5/Logger;Ljava/lang/String;Ljava/lang/Throwable;ILjava/lang/Object;)V
+}
+
 public final class org/mobilenativefoundation/store/store5/MemoryPolicy {
 	public static final field Companion Lorg/mobilenativefoundation/store/store5/MemoryPolicy$Companion;
 	public static final field DEFAULT_SIZE_POLICY J
@@ -612,9 +621,6 @@ public final class org/mobilenativefoundation/store/store5/impl/extensions/Store
 	public static final fun get (Lorg/mobilenativefoundation/store/store5/Store;Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
 }
 
-public abstract interface annotation class org/mobilenativefoundation/store/store5/internal/concurrent/AnyThread : java/lang/annotation/Annotation {
-}
-
 public abstract class org/mobilenativefoundation/store/store5/internal/result/EagerConflictResolutionResult {
 }
 
```

**File**: `store/api/jvm/store.api` (modified, +9/-3)
```diff
@@ -116,6 +116,15 @@ public final class org/mobilenativefoundation/store/store5/FetcherResult$Error$M
 	public fun toString ()Ljava/lang/String;
 }
 
+public abstract interface class org/mobilenativefoundation/store/store5/Logger {
+	public abstract fun debug (Ljava/lang/String;)V
+	public abstract fun error (Ljava/lang/String;Ljava/lang/Throwable;)V
+}
+
+public final class org/mobilenativefoundation/store/store5/Logger$DefaultImpls {
+	public static synthetic fun error$default (Lorg/mobilenativefoundation/store/store5/Logger;Ljava/lang/String;Ljava/lang/Throwable;ILjava/lang/Object;)V
+}
+
 public final class org/mobilenativefoundation/store/store5/MemoryPolicy {
 	public static final field Companion Lorg/mobilenativefoundation/store/store5/MemoryPolicy$Companion;
 	public static final field DEFAULT_SIZE_POLICY J
@@ -605,9 +614,6 @@ public final class org/mobilenativefoundation/store/store5/impl/extensions/Store
 	public static final fun get (Lorg/mobilenativefoundation/store/store5/Store;Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
 }
 
-public abstract interface annotation class org/mobilenativefoundation/store/store5/internal/concurrent/AnyThread : java/lang/annotation/Annotation {
-}
-
 public abstract class org/mobilenativefoundation/store/store5/internal/result/EagerConflictResolutionResult {
 }
 
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/Logger.kt` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+package org.mobilenativefoundation.store.store5
+
+/**
+ * A simple logging interface for logging error and debug messages.
+ */
+interface Logger {
+    /**
+     * Logs an error message, optionally with a throwable.
+     *
+     * @param message The error message to log.
+     * @param throwable An optional [Throwable] associated with the error.
+     */
+    fun error(
+        message: String,
+        throwable: Throwable? = null,
+    )
+
+    /**
+     * Logs a debug message.
+     *
+     * @param message The debug message to log.
+     */
+    fun debug(message: String)
+}
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/DefaultLogger.kt` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+package org.mobilenativefoundation.store.store5.impl
+
+import co.touchlab.kermit.CommonWriter
+import org.mobilenativefoundation.store.store5.Logger
+
+/**
+ * Default implementation of [Logger] using the Kermit logging library.
+ */
+internal class DefaultLogger : Logger {
+    private val delegate =
+        co.touchlab.kermit.Logger.apply {
+            setLogWriters(listOf(CommonWriter()))
+            setTag("Store")
+        }
+
+    override fun debug(message: String) {
+        delegate.d(message)
+    }
+
+    override fun error(
+        message: String,
+        throwable: Throwable?,
+    ) {
+        delegate.e(message, throwable)
+    }
+}
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt` (modified, +140/-76)
```diff
@@ -2,8 +2,6 @@
 
 package org.mobilenativefoundation.store.store5.impl
 
-import co.touchlab.kermit.CommonWriter
-import co.touchlab.kermit.Logger
 import kotlinx.coroutines.flow.Flow
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.flow
@@ -14,6 +12,7 @@ import kotlinx.coroutines.sync.withLock
 import org.mobilenativefoundation.store.core5.ExperimentalStoreApi
 import org.mobilenativefoundation.store.store5.Bookkeeper
 import org.mobilenativefoundation.store.store5.Clear
+import org.mobilenativefoundation.store.store5.Logger
 import org.mobilenativefoundation.store.store5.MutableStore
 import org.mobilenativefoundation.store.store5.StoreReadRequest
 import org.mobilenativefoundation.store.store5.StoreReadResponse
@@ -22,59 +21,77 @@ import org.mobilenativefoundation.store.store5.StoreWriteResponse
 import org.mobilenativefoundation.store.store5.Updater
 import org.mobilenativefoundation.store.store5.UpdaterResult
 import org.mobilenativefoundation.store.store5.impl.extensions.now
-import org.mobilenativefoundation.store.store5.internal.concurrent.AnyThread
 import org.mobilenativefoundation.store.store5.internal.concurrent.ThreadSafety
 import org.mobilenativefoundation.store.store5.internal.definition.WriteRequestQueue
 import org.mobilenativefoundation.store.store5.internal.result.EagerConflictResolutionResult
 
-@ExperimentalStoreApi
+@OptIn(ExperimentalStoreApi::class)
 internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local : Any>(
     private val delegate: RealStore<Key, Network, Output, Local>,
     private val updater: Updater<Key, Output, *>,
     private val bookkeeper: Bookkeeper<Key>?,
+    private val logger: Logger = DefaultLogger(),
 ) : MutableStore<Key, Output>, Clear.Key<Key> by delegate, Clear.All by delegate {
     private val storeLock = Mutex()
     private val keyToWriteRequestQueue = mutableMapOf<Key, WriteRequestQueue<Key, Output, *>>()
     private val keyToThreadSafety = mutableMapOf<Key, ThreadSafety>()
 
     override fun <Response : Any> stream(request: StoreReadRequest<Key>): Flow<StoreReadResponse<Output>> =
         flow {
+            // Ensure we are ready for this key.
             safeInitStore(request.key)
 
+            // Try to eagerly resolve conflicts before pulling from network.
             when (val eagerConflictResolutionResult = tryEagerlyResolveConflicts<Response>(request.key)) {
+                // TODO(#678): Many use cases will not want to pull immediately after failing to push local changes.
+                // We should enable configuration of conflict resolution strategies, such as logging, retrying, canceling.
+
                 is EagerConflictResolutionResult.Error.Exception -> {
-                    logger.e(eagerConflictResolutionResult.error.toString())
+                    logger.error(eagerConflictResolutionResult.error.toString())
                 }
 
                 is EagerConflictResolutionResult.Error.Message -> {
-                    logger.e(eagerConflictResolutionResult.message)
+                    logger.error(eagerConflictResolutionResult.message)
                 }
 
                 is EagerConflictResolutionResult.Success.ConflictsResolved -> {
-                    logger.d(eagerConflictResolutionResult.value.toString())
+                    logger.debug(eagerConflictResolutionResult.value.toString())
                 }
 
                 EagerConflictResolutionResult.Success.NoConflicts -> {
-                    logger.d(eagerConflictResolutionResult.toString())
+                    logger.debug("No conflicts.")
                 }
             }
 
+            // Now, we can just delegate to the underlying stream.
             delegate.stream(request).collect { storeReadResponse -> emit(storeReadResponse) }
         }
 
     @ExperimentalStoreApi
     override fun <Response : Any> stream(requestStream: Flow<StoreWriteRequest<Key, Output, Response>>): Flow<StoreWriteResponse> =
         flow {
+            // Each incoming write request is enqueued.
+            // Then we try to update the network and delegate.
+
             requestStream
                 .onEach { writeRequest ->
+                    // Prepare per-key data structures.
                     safeInitStore(writeRequest.key)
+
+                    // Enqueue the new write request.
                     addWriteRequestToQueue(writeRequest)
                 }
                 .collect { writeRequest ->
                     val storeWriteResponse =
                         try {
+                            // Always write to local first.
                             delegate.write(writeRequest.key, writeRequest.value)
-                            when (val updaterResult = tryUpdateServer(writeRequest)) {
+
+                            // Try to sync to network.
+                            val updaterResult = tryUpdateServer(writeRequest)
+
+                            // Convert UpdaterResult -> StoreWriteResponse.
+     
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/internal/concurrent/AnyThread.kt` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-package org.mobilenativefoundation.store.store5.internal.concurrent
-
-annotation class AnyThread
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/RealMutableStoreTest.kt` (added, +375/-0)
```diff
@@ -0,0 +1,375 @@
+@file:OptIn(ExperimentalCoroutinesApi::class, ExperimentalStoreApi::class)
+
+package org.mobilenativefoundation.store.store5.mutablestore
+
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.async
+import kotlinx.coroutines.flow.MutableSharedFlow
+import kotlinx.coroutines.flow.flowOf
+import kotlinx.coroutines.flow.take
+import kotlinx.coroutines.flow.toList
+import kotlinx.coroutines.test.runTest
+import org.mobilenativefoundation.store.core5.ExperimentalStoreApi
+import org.mobilenativefoundation.store.store5.FetcherResult
+import org.mobilenativefoundation.store.store5.StoreReadRequest
+import org.mobilenativefoundation.store.store5.StoreReadResponse
+import org.mobilenativefoundation.store.store5.StoreWriteRequest
+import org.mobilenativefoundation.store.store5.StoreWriteResponse
+import org.mobilenativefoundation.store.store5.impl.RealMutableStore
+import org.mobilenativefoundation.store.store5.impl.RealStore
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestCache
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestConverter
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestFetcher
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestInMemoryBookkeeper
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestLogger
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestSourceOfTruth
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestUpdater
+import org.mobilenativefoundation.store.store5.mutablestore.util.TestValidator
+import org.mobilenativefoundation.store.store5.mutablestore.util.testStore
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertIs
+import kotlin.test.assertNotNull
+import kotlin.test.assertNull
+import kotlin.test.assertTrue
+
+private data class Note(val id: String, val content: String)
+
+private data class NetworkNote(val id: String, val content: String)
+
+private data class DatabaseNote(val id: String, val content: String)
+
+@OptIn(ExperimentalCoroutinesApi::class, ExperimentalStoreApi::class)
+class RealMutableStoreTest {
+    private lateinit var testFetcher: TestFetcher<String, NetworkNote>
+    private lateinit var testConverter: TestConverter<NetworkNote, DatabaseNote, Note>
+    private lateinit var testValidator: TestValidator<Note>
+    private lateinit var testSourceOfTruth: TestSourceOfTruth<String, DatabaseNote, Note>
+    private lateinit var testCache: TestCache<String, Note>
+
+    private lateinit var testUpdater: TestUpdater<String, Note, NetworkNote>
+    private lateinit var testBookkeeper: TestInMemoryBookkeeper<String>
+    private lateinit var testLogger: TestLogger
+
+    private lateinit var delegateStore: RealStore<String, NetworkNote, Note, DatabaseNote>
+    private lateinit var mutableStore: RealMutableStore<String, NetworkNote, Note, DatabaseNote>
+
+    @BeforeTest
+    fun setUp() {
+        testFetcher = TestFetcher()
+        val defaultLocalValue = DatabaseNote("defaultLocalId", "defaultLocalContent")
+        testConverter =
+            TestConverter(
+                defaultNetworkToLocalConverter = { defaultLocalValue },
+                defaultOutputToLocalConverter = { defaultLocalValue },
+            )
+        testValidator = TestValidator()
+        testSourceOfTruth = TestSourceOfTruth()
+        testCache = TestCache()
+
+        testFetcher.whenever("key1") {
+            flowOf(FetcherResult.Data(NetworkNote("networkId", "networkContent")))
+        }
+
+        testUpdater = TestUpdater()
+        testBookkeeper = TestInMemoryBookkeeper()
+        testLogger = TestLogger()
+
+        delegateStore =
+            testStore(
+                fetcher = testFetcher,
+                sourceOfTruth = testSourceOfTruth,
+                converter = testConverter,
+                validator = testValidator,
+                memoryCache = testCache,
+            )
+
+        mutableStore =
+            RealMutableStore(
+                delegate = delegateStore,
+                updater = testUpdater,
+                bookkeeper = testBookkeeper,
+                logger = testLogger,
+            )
+    }
+
+    @Test
+    fun stream_givenNoConflicts_whenReading_thenEmitsFromDelegate() =
+        runTest {
+            // Given
+            val request = StoreReadRequest.Companion.cached("key1", refresh = true)
+
+            // When
+            val results = mutableStore.stream<Unit>(request).take(2).toList()
+
+            // Then
+            assertTrue(results.size >= 2)
+            assertIs<StoreReadResponse.Loading>(results[0])
+            assertIs<StoreReadResponse.Data<Note>>(results[1])
+        }
+
+    @Test
+    fun stream_givenConflictsAndBookkeeper_whenReading_thenAttemptsEagerConflictResolution() =
+        runTest {
+            // Given
+            val request = StoreReadRequest.Companion.c
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/mutablestore/util/TestCache.kt` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+package org.mobilenativefoundation.store.store5.mutablestore.util
+
+import org.mobilenativefoundation.store.cache5.Cache
+
+@Suppress("UNCHECKED_CAST")
+class TestCache<Key : Any, Value : Any> : Cache<Key, Value> {
+    private val map = HashMap<Key, Value>()
+    var getIfPresentCalls = 0
+    var getOrPutCalls = 0
+    var getAllPresentCalls = 0
+    var putCalls = 0
+    var putAllCalls = 0
+    var invalidateCalls = 0
+    var invalidateAllKeysCalls = 0
+    var invalidateAllCalls = 0
+    var sizeCalls = 0
+
+    override fun getIfPresent(key: Key): Value? {
+        getIfPresentCalls++
+        return map[key]
+    }
+
+    override fun getOrPut(
+        key: Key,
+        valueProducer: () -> Value,
+    ): Value {
+        getOrPutCalls++
+        return map.getOrPut(key, valueProducer)
+    }
+
+    override fun getAllPresent(keys: List<*>): Map<Key, Value> {
+        getAllPresentCalls++
+        return keys.mapNotNull { it as? Key }.associateWithNotNull { key -> map[key] }
+    }
+
+    override fun put(
+        key: Key,
+        value: Value,
+    ) {
+        putCalls++
+        map[key] = value
+    }
+
+    override fun putAll(map: Map<Key, Value>) {
+        putAllCalls++
+        map.forEach { (k, v) -> put(k, v) }
+    }
+
+    override fun invalidate(key: Key) {
+        invalidateCalls++
+        map.remove(key)
+    }
+
+    override fun invalidateAll(keys: List<Key>) {
+        invalidateAllKeysCalls++
+        keys.forEach { map.remove(it) }
+    }
+
+    override fun invalidateAll() {
+        invalidateAllCalls++
+        map.clear()
+    }
+
+    override fun size(): Long {
+        sizeCalls++
+        return map.size.toLong()
+    }
+
+    private inline fun <K, V> Iterable<K>.associateWithNotNull(transform: (K) -> V?): Map<K, V> {
+        val destination = mutableMapOf<K, V>()
+        for (element in this) {
+            transform(element)?.let { destination[element] = it }
+        }
+        return destination
+    }
+}
```

---

### Incident Patch 8: `2aa32134` (2025-02-23)
**Commit Message**: fix(deps): update dependency org.jetbrains.kotlinx:kotlinx-datetime to v0.6.2 (#688)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-
 kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "kotlinxCoroutines" }
 kotlinx-coroutines-core = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-core", version.ref = "kotlinxCoroutines" }
 kotlinx-coroutines-rx2 = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-rx2", version.ref = "kotlinxCoroutines" }
-kotlinx-datetime = { group = "org.jetbrains.kotlinx", name = "kotlinx-datetime", version = "0.6.1" }
+kotlinx-datetime = { group = "org.jetbrains.kotlinx", name = "kotlinx-datetime", version = "0.6.2" }
 molecule-gradle-plugin = { module = "app.cash.molecule:molecule-gradle-plugin", version.ref = "moleculeGradlePlugin" }
 molecule-runtime = { module = "app.cash.molecule:molecule-runtime", version.ref = "moleculeGradlePlugin" }
 rxjava = { group = "io.reactivex.rxjava2", name = "rxjava", version = "2.2.21" }
```

---

### Incident Patch 9: `0dff4e23` (2025-02-23)
**Commit Message**: fix(deps): update dependency org.jetbrains.dokka:dokka-gradle-plugin to v1.9.20 (#687)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ androidGradlePlugin = "7.4.2"
 androidTargetSdk = "33"
 atomicFu = "0.24.0"
 baseKotlin = "2.0.20"
-dokkaGradlePlugin = "1.9.10"
+dokkaGradlePlugin = "1.9.20"
 ktlintGradle = "12.1.0"
 jacocoGradlePlugin = "0.8.12"
 mavenPublishPlugin = "0.22.0"
```

---

### Incident Patch 10: `ffc1c367` (2025-02-23)
**Commit Message**: fix(deps): update dependency org.jacoco:org.jacoco.core to v0.8.12 (#686)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ atomicFu = "0.24.0"
 baseKotlin = "2.0.20"
 dokkaGradlePlugin = "1.9.10"
 ktlintGradle = "12.1.0"
-jacocoGradlePlugin = "0.8.7"
+jacocoGradlePlugin = "0.8.12"
 mavenPublishPlugin = "0.22.0"
 moleculeGradlePlugin = "1.2.1"
 pagingCompose = "3.3.0-alpha02"
```

---

### Incident Patch 11: `ed7c31b7` (2025-02-22)
**Commit Message**: fix(deps): update dependency jacoco to v0.8.12 (#684)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/jacoco.gradle` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 apply plugin: "jacoco"
 
 jacoco {
-    toolVersion = "0.8.7"
+    toolVersion = "0.8.12"
 }
 // Android Gradle Plugin out of the box supports only code coverage for instrumentation tests.
 // Creates a task that will merge coverage for all projects
```

---

### Incident Patch 12: `4f653811` (2025-02-22)
**Commit Message**: fix(deps): update dependency co.touchlab:kermit to v2.0.5 (#683)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ spotlessPluginGradle = "6.4.1"
 junit = "4.13.2"
 kotlinxCoroutines = "1.8.1"
 kotlinxSerialization = "1.6.3"
-kermit = "2.0.4"
+kermit = "2.0.5"
 testCore = "1.6.1"
 kmmBridge = "0.3.2"
 ktlint = "0.39.0"
```

---

### Incident Patch 13: `a7abd3a2` (2024-10-18)
**Commit Message**: Fix Failing Node JS Tests (#665)

* Remove failing test

Signed-off-by: matt-ramotar <[REDACTED_EMAIL]>

* Bump Kotlin, Coroutines, and AndroidX Test

Signed-off-by: matt-ramotar <[REDACTED_EMAIL]>

* Add back test

Signed-off-by: matt-ramotar <[REDACTED_EMAIL]>

---------

Signed-off-by: matt-ramotar <[REDACTED_EMAIL]>

**File**: `gradle/libs.versions.toml` (modified, +4/-4)
```diff
@@ -4,7 +4,7 @@ androidCompileSdk = "33"
 androidGradlePlugin = "7.4.2"
 androidTargetSdk = "33"
 atomicFu = "0.24.0"
-baseKotlin = "2.0.0"
+baseKotlin = "2.0.20"
 dokkaGradlePlugin = "1.9.10"
 ktlintGradle = "12.1.0"
 jacocoGradlePlugin = "0.8.7"
@@ -14,10 +14,10 @@ pagingCompose = "3.3.0-alpha02"
 pagingRuntime = "3.2.1"
 spotlessPluginGradle = "6.4.1"
 junit = "4.13.2"
-kotlinxCoroutines = "1.8.0"
-kotlinxSerialization = "1.5.1"
+kotlinxCoroutines = "1.8.1"
+kotlinxSerialization = "1.6.3"
 kermit = "2.0.4"
-testCore = "1.5.0"
+testCore = "1.6.1"
 kmmBridge = "0.3.2"
 ktlint = "0.39.0"
 kover = "0.6.0"
```

**File**: `paging/kover/coverage.xml` (modified, +11/-17)
```diff
@@ -2,20 +2,15 @@
 <report name="Intellij Coverage Report">
 <package name="org/mobilenativefoundation/store/paging5">
 <class name="org/mobilenativefoundation/store/paging5/BuildConfig" sourcefilename="BuildConfig.java">
-<method name="&lt;clinit&gt;" desc="()V">
-<counter type="INSTRUCTION" missed="3" covered="0"/>
-<counter type="BRANCH" missed="0" covered="0"/>
-<counter type="LINE" missed="1" covered="0"/>
-</method>
 <method name="&lt;init&gt;" desc="()V">
 <counter type="INSTRUCTION" missed="2" covered="0"/>
 <counter type="BRANCH" missed="0" covered="0"/>
 <counter type="LINE" missed="1" covered="0"/>
 </method>
-<counter type="INSTRUCTION" missed="5" covered="0"/>
+<counter type="INSTRUCTION" missed="2" covered="0"/>
 <counter type="BRANCH" missed="0" covered="0"/>
-<counter type="LINE" missed="2" covered="0"/>
-<counter type="METHOD" missed="2" covered="0"/>
+<counter type="LINE" missed="1" covered="0"/>
+<counter type="METHOD" missed="1" covered="0"/>
 </class>
 <class name="org/mobilenativefoundation/store/paging5/LaunchPagingStoreKt" sourcefilename="LaunchPagingStore.kt">
 <method name="launchPagingStore$lambda$1" desc="(Lorg/mobilenativefoundation/store/store5/MutableStore;Lorg/mobilenativefoundation/store/core5/StoreKey;)Lkotlinx/coroutines/flow/Flow;">
@@ -278,10 +273,9 @@
 </class>
 <sourcefile name="BuildConfig.java">
 <line nr="6" mi="2" ci="0" mb="0" cb="0"/>
-<line nr="7" mi="3" ci="0" mb="0" cb="0"/>
-<counter type="INSTRUCTION" missed="5" covered="0"/>
+<counter type="INSTRUCTION" missed="2" covered="0"/>
 <counter type="BRANCH" missed="0" covered="0"/>
-<counter type="LINE" missed="2" covered="0"/>
+<counter type="LINE" missed="1" covered="0"/>
 </sourcefile>
 <sourcefile name="LaunchPagingStore.kt">
 <line nr="21" mi="0" ci="2" mb="0" cb="0"/>
@@ -449,10 +443,10 @@
 <counter type="BRANCH" missed="11" covered="11"/>
 <counter type="LINE" missed="0" covered="119"/>
 </sourcefile>
-<counter type="INSTRUCTION" missed="46" covered="1702"/>
+<counter type="INSTRUCTION" missed="43" covered="1702"/>
 <counter type="BRANCH" missed="17" covered="27"/>
-<counter type="LINE" missed="4" covered="154"/>
-<counter type="METHOD" missed="4" covered="27"/>
+<counter type="LINE" missed="3" covered="154"/>
+<counter type="METHOD" missed="3" covered="27"/>
 <counter type="CLASS" missed="1" covered="19"/>
 </package>
 <package name="org/mobilenativefoundation/store/paging5/util">
@@ -1066,10 +1060,10 @@
 <counter type="METHOD" missed="13" covered="37"/>
 <counter type="CLASS" missed="11" covered="18"/>
 </package>
-<counter type="INSTRUCTION" missed="289" covered="2284"/>
+<counter type="INSTRUCTION" missed="286" covered="2284"/>
 <counter type="BRANCH" missed="45" covered="50"/>
-<counter type="LINE" missed="41" covered="257"/>
-<counter type="METHOD" missed="17" covered="64"/>
+<counter type="LINE" missed="40" covered="257"/>
+<counter type="METHOD" missed="16" covered="64"/>
 <counter type="CLASS" missed="12" covered="37"/>
 </report>
 
```

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt` (modified, +3/-8)
```diff
@@ -201,16 +201,11 @@ internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local :
     private suspend fun <Output : Any?> withThreadSafety(
         key: Key,
         block: suspend ThreadSafety.() -> Output,
-    ): Output {
-        storeLock.lock()
-        try {
+    ): Output =
+        storeLock.withLock {
             val threadSafety = requireNotNull(keyToThreadSafety[key])
-            val output = threadSafety.block()
-            return output
-        } finally {
-            storeLock.unlock()
+            threadSafety.block()
         }
-    }
 
     private suspend fun conflictsMightExist(key: Key): Boolean {
         val lastFailedSync = bookkeeper?.getLastFailedSync(key)
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/StoreWithInMemoryCacheTests.kt` (modified, +55/-53)
```diff
@@ -1,23 +1,21 @@
 package org.mobilenativefoundation.store.store5
 
-import kotlinx.coroutines.CoroutineScope
-import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.FlowPreview
 import kotlinx.coroutines.Job
-import kotlinx.coroutines.async
-import kotlinx.coroutines.awaitAll
-import kotlinx.coroutines.cancel
-import kotlinx.coroutines.flow.*
+import kotlinx.coroutines.flow.first
+import kotlinx.coroutines.flow.flowOf
+import kotlinx.coroutines.flow.launchIn
+import kotlinx.coroutines.flow.mapNotNull
 import kotlinx.coroutines.test.TestScope
 import kotlinx.coroutines.test.runTest
+import org.mobilenativefoundation.store.core5.ExperimentalStoreApi
 import org.mobilenativefoundation.store.store5.impl.extensions.get
 import kotlin.test.Test
 import kotlin.test.assertEquals
-import kotlin.test.assertIs
-import kotlin.test.assertNotNull
 import kotlin.time.Duration.Companion.hours
 
+@OptIn(ExperimentalStoreApi::class)
 @FlowPreview
 @ExperimentalCoroutinesApi
 class StoreWithInMemoryCacheTests {
@@ -51,82 +49,86 @@ class StoreWithInMemoryCacheTests {
 
     @Test
     fun storeDeadlock() =
-        testScope.runTest {
-            repeat(1000) {
-                val store =
+        runTest {
+            repeat(100) {
+                val store: MutableStore<Int, String> =
                     StoreBuilder
                         .from(
-                            fetcher = Fetcher.of { key: Int -> "fetcher_${key}" },
-                            sourceOfTruth = SourceOfTruth.Companion.of(
-                                reader = { key ->
-                                    flow<String> {
-                                        emit("source_of_truth_${key}")
-                                    }
-                                },
-                                writer = { key: Int, local: String ->
-
-                                }
-                            )
+                            fetcher = Fetcher.of { key: Int -> "fetcher_$key" },
+                            sourceOfTruth =
+                                SourceOfTruth.of(
+                                    reader = { key: Int ->
+                                        flowOf("source_of_truth_$key")
+                                    },
+                                    writer = { key: Int, local: String -> },
+                                ),
                         )
                         .disableCache()
                         .toMutableStoreBuilder(
-                            converter = object : Converter<String, String, String> {
-                                override fun fromNetworkToLocal(network: String): String {
-                                    return network
-                                }
+                            converter =
+                                object : Converter<String, String, String> {
+                                    override fun fromNetworkToLocal(network: String): String = network
 
-                                override fun fromOutputToLocal(output: String): String {
-                                    return output
-                                }
-                            },
+                                    override fun fromOutputToLocal(output: String): String = output
+                                },
                         )
                         .build(
-                            updater = object : Updater<Int, String, Unit> {
-                                var callCount = -1
-                                override suspend fun post(key: Int, value: String): UpdaterResult {
-                                    callCount += 1
-                                    if (callCount % 2 == 0) {
-                                        throw IllegalArgumentException(key.toString() + "value:$value")
-                                    } else {
-                                        return UpdaterResult.Success.Untyped("")
-                                    }
-                                }
+                            updater =
+                                object : Updater<Int, String, Unit> {
+                                    var callCount = -1
 
-                                override val onCompletion: OnUpdaterCompletion<Unit>?
-                                    get() = null
+                                    override suspend fun post(
+                                        key: Int,
+                                        value: String,
+                                    ): UpdaterResult {
+                                        callCount += 1
+                                        return if (callCount % 2 == 0) {
+                                            throw IllegalArgumentException("$key value: $value")
+                                        } else {
+                                            UpdaterResult.Success.Untyped("")
+             
```

---

### Incident Patch 14: `c6447af8` (2024-10-05)
**Commit Message**: Typo fix RealStore.kt (#662)

Signed-off-by: Shabinder Singh <[REDACTED_EMAIL]>

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealStore.kt` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ internal class RealStore<Key : Any, Network : Any, Output : Any, Local : Any>(
 
             val stream: Flow<StoreReadResponse<Output>> =
                 if (sourceOfTruth == null) {
-                    // piggypack only if not specified fresh data AND we emitted a value from the cache
+                    // piggyback only if not specified fresh data AND we emitted a value from the cache
                     val piggybackOnly = !request.refresh && cachedToEmit != null
                     @Suppress("UNCHECKED_CAST")
 
```

---

### Incident Patch 15: `067bd41d` (2024-10-04)
**Commit Message**: Avoid deadlock in RealMutableStore (#658)

* Add test case

Signed-off-by: Amr Yousef <[REDACTED_EMAIL]>

* Always Release storeLock

Signed-off-by: Amr Yousef <[REDACTED_EMAIL]>

* Update kermit to 2.0.4 (#655)

Fixes #653 and #654

Signed-off-by: Scott Olcott <[REDACTED_EMAIL]>
Signed-off-by: Amr Yousef <[REDACTED_EMAIL]>

* Revert "Update kermit to 2.0.4 (#655)"

This reverts commit 76f34d48973f8b810bf247219a933d9ff0d686a7.

Signed-off-by: Amr Yousef <[REDACTED_EMAIL]>

---------

Signed-off-by: Amr Yousef <[REDACTED_EMAIL]>
Signed-off-by: Scott Olcott <[REDACTED_EMAIL]>
Co-authored-by: Scott Olcott <[REDACTED_EMAIL]>

**File**: `store/src/commonMain/kotlin/org/mobilenativefoundation/store/store5/impl/RealMutableStore.kt` (modified, +7/-4)
```diff
@@ -203,10 +203,13 @@ internal class RealMutableStore<Key : Any, Network : Any, Output : Any, Local :
         block: suspend ThreadSafety.() -> Output,
     ): Output {
         storeLock.lock()
-        val threadSafety = requireNotNull(keyToThreadSafety[key])
-        val output = threadSafety.block()
-        storeLock.unlock()
-        return output
+        try {
+            val threadSafety = requireNotNull(keyToThreadSafety[key])
+            val output = threadSafety.block()
+            return output
+        } finally {
+            storeLock.unlock()
+        }
     }
 
     private suspend fun conflictsMightExist(key: Key): Boolean {
```

**File**: `store/src/commonTest/kotlin/org/mobilenativefoundation/store/store5/StoreWithInMemoryCacheTests.kt` (modified, +92/-0)
```diff
@@ -1,12 +1,21 @@
 package org.mobilenativefoundation.store.store5
 
+import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.FlowPreview
+import kotlinx.coroutines.Job
+import kotlinx.coroutines.async
+import kotlinx.coroutines.awaitAll
+import kotlinx.coroutines.cancel
+import kotlinx.coroutines.flow.*
 import kotlinx.coroutines.test.TestScope
 import kotlinx.coroutines.test.runTest
 import org.mobilenativefoundation.store.store5.impl.extensions.get
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertIs
+import kotlin.test.assertNotNull
 import kotlin.time.Duration.Companion.hours
 
 @FlowPreview
@@ -39,4 +48,87 @@ class StoreWithInMemoryCacheTests {
             assertEquals("result", c)
             assertEquals("result", d)
         }
+
+    @Test
+    fun storeDeadlock() =
+        testScope.runTest {
+            repeat(1000) {
+                val store =
+                    StoreBuilder
+                        .from(
+                            fetcher = Fetcher.of { key: Int -> "fetcher_${key}" },
+                            sourceOfTruth = SourceOfTruth.Companion.of(
+                                reader = { key ->
+                                    flow<String> {
+                                        emit("source_of_truth_${key}")
+                                    }
+                                },
+                                writer = { key: Int, local: String ->
+
+                                }
+                            )
+                        )
+                        .disableCache()
+                        .toMutableStoreBuilder(
+                            converter = object : Converter<String, String, String> {
+                                override fun fromNetworkToLocal(network: String): String {
+                                    return network
+                                }
+
+                                override fun fromOutputToLocal(output: String): String {
+                                    return output
+                                }
+                            },
+                        )
+                        .build(
+                            updater = object : Updater<Int, String, Unit> {
+                                var callCount = -1
+                                override suspend fun post(key: Int, value: String): UpdaterResult {
+                                    callCount += 1
+                                    if (callCount % 2 == 0) {
+                                        throw IllegalArgumentException(key.toString() + "value:$value")
+                                    } else {
+                                        return UpdaterResult.Success.Untyped("")
+                                    }
+                                }
+
+                                override val onCompletion: OnUpdaterCompletion<Unit>?
+                                    get() = null
+
+                            }
+                        )
+
+                val jobs = mutableListOf<Job>()
+                jobs.add(
+                    store.stream<Nothing>(StoreReadRequest.cached(1, refresh = true))
+                        .mapNotNull { it.dataOrNull() }
+                        .launchIn(CoroutineScope(Dispatchers.Default))
+                )
+                val job1 = store.stream<Nothing>(StoreReadRequest.cached(0, refresh = true))
+                    .mapNotNull { it.dataOrNull() }
+                    .launchIn(CoroutineScope(Dispatchers.Default))
+                jobs.add(
+                    store.stream<Nothing>(StoreReadRequest.cached(2, refresh = true))
+                        .mapNotNull { it.dataOrNull() }
+                        .launchIn(CoroutineScope(Dispatchers.Default)))
+                jobs.add(
+                    store.stream<Nothing>(StoreReadRequest.cached(3, refresh = true))
+                        .mapNotNull { it.dataOrNull() }
+                        .launchIn(CoroutineScope(Dispatchers.Default)))
+                job1.cancel()
+                assertEquals(
+                    expected = "source_of_truth_0",
+                    actual = store.stream<Nothing>(StoreReadRequest.cached(0, refresh = true))
+                        .mapNotNull { it.dataOrNull() }.first()
+                )
+                jobs.forEach {
+                    it.cancel()
+                    assertEquals(
+                        expected = "source_of_truth_0",
+                        actual = store.stream<Nothing>(StoreReadRequest.cached(0, refresh = true))
+                            .mapNotNull { it.dataOrNull() }.first()
+                    )
+                }
+            }
+        }
 }
```

#### Recent Merged Pull Requests:
- **PR #764** (2026-09-13): First alpha of Store 6 (@matt-ramotar)
- **PR #763** (2026-09-08): Release 5.1.0-beta01 (@matt-ramotar)
- **PR #762** (2026-09-08): fix(store): synchronize mutable writes by admitted batch (@matt-ramotar)
- **PR #759** (2026-08-29): Release 5.1.0-alpha11 (@matt-ramotar)
- **PR #758** (closed): chore(layout): drop store6- prefix from modules (@matt-ramotar)
- **PR #757** (closed): Adopt Agent Plugins v1 package layout (@matt-ramotar)
- **PR #756** (closed): Update baseKotlin to v2.4.10 - autoclosed (@renovate[bot])
- **PR #755** (closed): docs: alpha01 source documentation cleanup (@matt-ramotar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
