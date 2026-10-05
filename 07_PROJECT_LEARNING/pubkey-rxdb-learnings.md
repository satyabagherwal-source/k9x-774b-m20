# Forensic Learning Record (Deep Inspection): pubkey/rxdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/pubkey-rxdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pubkey/rxdb](https://github.com/pubkey/rxdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:47:33.228Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pubkey/rxdb`
- **Description**: The local-first database that runs on every JS runtime and replicates with your existing backend - no vendor, no lock-in - https://rxdb.info/
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 23398 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/no-console-dir-storage-sqlite.mjs`
```
#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook.
 *
 * Blocks any Write/Edit/MultiEdit that would introduce `console.dir(...)`
 * into the `src/plugins/storage-sqlite` code.
 *
 * `console.dir` is `undefined` in production React Native / Hermes runtimes,
 * so calling it inside the storage-sqlite code throws
 * `TypeError: undefined is not a function` and masks the real error.
 * See https://github.com/pubkey/rxdb/issues/8635
 */

const CONSOLE_DIR_REGEX = /console\s*\.\s*dir\b/;
const STORAGE_SQLITE_PATH = 'src/plugins/storage-sqlite';

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

function collectTexts(toolInput) {
    const texts = [];
    if (typeof toolInput.content === 'string') {
        texts.push(toolInput.content);
    }
    if (typeof toolInput.new_string === 'string') {
        texts.push(toolInput.new_string);
    }
    if (Array.isArray(toolInput.edits)) {
        for (const edit of toolInput.edits) {
            if (edit && typeof edit.new_string === 'string') {
                texts.push(edit.new_string);
            }
        }
    }
    return texts;
}

async function main() {
    let payload;
    try {
        payload = JSON.parse(await readStdin());
    } catch {
        // Could not parse the hook payload, do not block.
        process.exit(0);
    }

    const toolInput = payload.tool_input || {};
    const filePath = toolInput.file_path || '';

    if (!filePath.includes(STORAGE_SQLITE_PATH)) {
        process.exit(0);
    }

    const offends = collectTexts(toolInput).some(text => CONSOLE_DIR_REGEX.test(text));
    if (!offends) {
        process.exit(0);
    }

    const output = {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason:
                'Do not use console.dir inside src/plugins/storage-sqlite. ' +
                'console.dir is undefined in production React Native / Hermes runtimes and throws ' +
                'TypeError: undefined is not a function, masking the real error (see issue #8635). ' +
                'Use console.log(JSON.stringify(...)) or errorToPlainJson(...) instead.'
        }
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
}

main();

```

### Core Architecture Module: `examples/electron/renderer.js`
```
const { getDatabase } = require('./shared');
const renderTest = require('./test/render.test.js');
const electron = require('electron');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');
const { wrappedValidateAjvStorage } = require('rxdb/plugins/validate-ajv');
const { getRxStorageIpcRenderer } = require('../../plugins/electron');


const heroesList = document.querySelector('#heroes-list');

async function run() {
    /**
     * to check if rxdb works correctly, we run some integration-tests here
     * if you want to use this electron-example as boilerplate, remove this line
     */
    await renderTest();

    const dbSuffix = await window.getDBSuffix();


    const storage = getRxStorageIpcRenderer({
        key: 'main-storage',        
        ipcRenderer: electron.ipcRenderer
    });

    console.log('GET DATABASE');
    const db = await getDatabase(
        'heroesdb' + dbSuffix, // we add a random timestamp in dev-mode to reset the database on each start
        wrappedValidateAjvStorage({ storage: storage })
    );
    console.log('GET DATABASE DONE');

    /**
     * map the result of the find-query to the heroes-list in the dom
     */
    db.heroes.find()
        .sort({
            name: 'asc'
        })
        .$.subscribe(function (heroes) {
            if (!heroes) {
                heroesList.innerHTML = 'Loading..';
                return;
            }
            console.log('observable fired');
            console.dir(heroes);

            heroesList.innerHTML = heroes
                .map(hero => {
                    return '<li>' +
                        '<div class="color-box" style="background:' + hero.color + '"></div>' +
                        '<div class="name" name="' + hero.name + '">' + hero.name + '</div>' +
                        '</li>';
                })
                .reduce((pre, cur) => pre += cur, '');
        });

    window.addHero = async function () {
        const name = document.querySelector('input[name="name"]').value;
        const color = document.querySelector('input[name="color"]').value;
        const obj = {
            name: name,
            color: color
        };
        console.log('inserting hero:');
        console.dir(obj);
        await db.heroes.insert(obj);
        console.log('inserting hero DONE');
    };
}
run();

```

### Core Architecture Module: `examples/flutter/windows/runner/utils.cpp`
```
#include "utils.h"

#include <flutter_windows.h>
#include <io.h>
#include <stdio.h>
#include <windows.h>

#include <iostream>

void CreateAndAttachConsole() {
  if (::AllocConsole()) {
    FILE *unused;
    if (freopen_s(&unused, "CONOUT$", "w", stdout)) {
      _dup2(_fileno(stdout), 1);
    }
    if (freopen_s(&unused, "CONOUT$", "w", stderr)) {
      _dup2(_fileno(stdout), 2);
    }
    std::ios::sync_with_stdio();
    FlutterDesktopResyncOutputStreams();
  }
}

std::vector<std::string> GetCommandLineArguments() {
  // Convert the UTF-16 command line arguments to UTF-8 for the Engine to use.
  int argc;
  wchar_t** argv = ::CommandLineToArgvW(::GetCommandLineW(), &argc);
  if (argv == nullptr) {
    return std::vector<std::string>();
  }

  std::vector<std::string> command_line_arguments;

  // Skip the first argument as it's the binary name.
  for (int i = 1; i < argc; i++) {
    command_line_arguments.push_back(Utf8FromUtf16(argv[i]));
  }

  ::LocalFree(argv);

  return command_line_arguments;
}

std::string Utf8FromUtf16(const wchar_t* utf16_string) {
  if (utf16_string == nullptr) {
    return std::string();
  }
  int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, utf8_string.data(),
      target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `examples/flutter/windows/runner/utils.h`
```
#ifndef RUNNER_UTILS_H_
#define RUNNER_UTILS_H_

#include <string>
#include <vector>

// Creates a console for the process, and redirects stdout and stderr to
// it for both the runner and the Flutter library.
void CreateAndAttachConsole();

// Takes a null-terminated wchar_t* encoded in UTF-16 and returns a std::string
// encoded in UTF-8. Returns an empty std::string on failure.
std::string Utf8FromUtf16(const wchar_t* utf16_string);

// Gets the command line arguments passed in as a std::vector<std::string>,
// encoded in UTF-8. Returns an empty std::vector<std::string> on failure.
std::vector<std::string> GetCommandLineArguments();

#endif  // RUNNER_UTILS_H_

```

### Core Architecture Module: `examples/vue/src/registerServiceWorker.ts`
```
/* eslint-disable no-console */

import { register } from 'register-service-worker';

if (process.env.NODE_ENV === 'production') {
  register(`${process.env.BASE_URL}service-worker.js`, {
    ready () {
      console.log(
        'App is being served from cache by a service worker.\n' +
        'For more details, visit https://goo.gl/AFskqB'
      );
    },
    registered () {
      console.log('Service worker has been registered.');
    },
    cached () {
      console.log('Content has been cached for offline use.');
    },
    updatefound () {
      console.log('New content is downloading.');
    },
    updated () {
      console.log('New content is available; please refresh.');
    },
    offline () {
      console.log('No internet connection found. App is running in offline mode.');
    },
    error (error) {
      console.error('Error during service worker registration:', error);
    }
  });
}

```

### Core Architecture Module: `src/hooks.ts`
```

/**
 * hook-functions that can be extended by the plugin
 */
export const HOOKS = {
    /**
     * Runs before a plugin is added.
     * Use this to block the usage of non-compatible plugins.
     */
    preAddRxPlugin: [],
    /**
     * functions that run before the database is created
     */
    preCreateRxDatabase: [],
    /**
     * runs after the database is created and prepared
     * but before the instance is returned to the user
     * @async
     */
    createRxDatabase: [],
    preCreateRxCollection: [],
    createRxCollection: [],
    createRxState: [],
    /**
    * runs at the end of the close-process of a collection
    * @async
    */
    postCloseRxCollection: [],
    /**
     * Runs after a collection is removed.
     * @async
     */
    postRemoveRxCollection: [],
    /**
      * functions that get the json-schema as input
      * to do additionally checks/manipulation
      */
    preCreateRxSchema: [],
    /**
     * functions that run after the RxSchema is created
     * gets RxSchema as attribute
     */
    createRxSchema: [],
    prePrepareRxQuery: [],
    preCreateRxQuery: [],
    /**
     * Runs before a query is sent to the
     * prepareQuery function of the storage engine.
     */
    prePrepareQuery: [],
    createRxDocument: [],
    /**
     * runs after a RxDocument is created,
     * cannot be async
     */
    postCreateRxDocument: [],
    /**
     * Runs before a RxStorageInstance is created
     * gets the params of createStorageInstance()
     * as attribute so you can manipulate them.
     * Notice that you have to clone stuff before mutating the inputs.
     */
    preCreateRxStorageInstance: [],
    preStorageWrite: [],
    /**
     * runs on the document-data before the document is migrated
     * {
     *   doc: Object, // original doc-data
     *   migrated: // migrated doc-data after run through migration-strategies
     * }
     */
    preMigrateDocument: [],
    /**
     * runs after the migration of a document has been done
     */
    postMigrateDocument: [],
    /**
     * runs at the beginning of the close-process of a database
     */
    preCloseRxDatabase: [],
    /**
     * runs after a database has been removed
     * @async
     */
    postRemoveRxDatabase: [],


    postCleanup: [],

    /**
     * runs before the replication writes the rows to master
     * but before the rows have been modified
     * @async
     */
    preReplicationMasterWrite: [],

    /**
     * runs after the replication has been sent to the server
     * but before the new documents have been handled
     * @async
     */
    preReplicationMasterWriteDocumentsHandle: [],
};

export function runPluginHooks(hookKey: keyof typeof HOOKS, obj: any) {
    if (HOOKS[hookKey].length > 0) {
        HOOKS[hookKey].forEach(fun => (fun as any)(obj));
    }
}


/**
 * We do intentionally not run the hooks in parallel
 * because that makes stuff unpredictable and we use runAsyncPluginHooks()
 * only in places that are not that relevant for performance.
 */
export async function runAsyncPluginHooks(hookKey: keyof typeof HOOKS, obj: any): Promise<any> {
    for (const fn of HOOKS[hookKey]) {
        await (fn as any)(obj);
    }
}

/**
 * used in tests to remove hooks
 */
export function _clearHook(type: keyof typeof HOOKS, fun: Function) {
    HOOKS[type] = HOOKS[type].filter(h => h !== fun);
}

```

### Core Architecture Module: `src/plugins/attachments/attachments-utils.ts`
```
import { newRxError } from '../../rx-error.ts';
import type {
    RxAttachmentWriteData,
    RxStorageInstance,
    WithDeletedAndAttachments
} from '../../types/index.d.ts';
import { ensureNotFalsy } from '../utils/index.ts';

export function ensureSchemaSupportsAttachments(doc: any) {
    const schemaJson = doc.collection.schema.jsonSchema;
    if (!schemaJson.attachments) {
        throw newRxError('AT1', {
            link: 'https://pubkey.github.io/rxdb/rx-attachment.html'
        });
    }
}

export function assignMethodsToAttachment(attachment: any) {
    Object
        .entries(attachment.doc.collection.attachments)
        .forEach(([funName, fun]) => {
            Object.defineProperty(attachment, funName, {
                get: () => (fun as any).bind(attachment)
            });
        });
}

/**
 * Fill up the missing attachment.data of the newDocument
 * so that the new document can be sent to somewhere else
 * which could then receive all required attachments data
 * that it did not have before.
 */
export async function fillWriteDataForAttachmentsChange<RxDocType>(
    primaryPath: string,
    storageInstance: RxStorageInstance<RxDocType, any, any, any>,
    newDocument: WithDeletedAndAttachments<RxDocType>,
    originalDocument?: WithDeletedAndAttachments<RxDocType>
): Promise<WithDeletedAndAttachments<RxDocType>> {

    if (
        !newDocument._attachments ||
        (
            originalDocument &&
            !originalDocument._attachments
        )
    ) {
        throw newRxError('AT4', {
            document: newDocument
        });
    }

    const docId: string = (newDocument as any)[primaryPath];
    const originalAttachmentsIds = new Set(
        originalDocument && originalDocument._attachments
            ? Object.keys(originalDocument._attachments)
            : []
    );
    await Promise.all(
        Object
            .entries(newDocument._attachments)
            .map(async ([key, value]) => {
                if (
                    (
                        !originalAttachmentsIds.has(key) ||
                        (
                            originalDocument &&
                            ensureNotFalsy(originalDocument._attachments)[key].digest !== value.digest
                        )
                    ) &&
                    !(value as RxAttachmentWriteData).data
                ) {
                    const attachmentBlob = await storageInstance.getAttachmentData(
                        docId,
                        key,
                        value.digest
                    );
                    (value as RxAttachmentWriteData).data = attachmentBlob;
                }
            })
    );

    return newDocument;
}

```

### Core Architecture Module: `src/plugins/backup/file-util.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
    BackupMetaFileContent,
    BackupOptions,
    RxDatabase
} from '../../types/index.d.ts';
import { blobToString, now } from '../../plugins/utils/index.ts';

/**
 * ensure that the given folder exists
 */
export function ensureFolderExists(folderPath: string): void {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
}

/**
 * deletes and recreates the folder
 */
export function clearFolder(folderPath: string): void {
    deleteFolder(folderPath);
    ensureFolderExists(folderPath);
}

export function deleteFolder(folderPath: string): void {
    // only remove if exists to not raise warning
    if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true });
    }
}

export function prepareFolders(
    database: RxDatabase,
    options: BackupOptions
) {
    ensureFolderExists(options.directory);

    const metaLoc = metaFileLocation(options);

    if (!fs.existsSync(metaLoc)) {
        const currentTime = now();
        const metaData: BackupMetaFileContent = {
            createdAt: currentTime,
            updatedAt: currentTime,
            collectionStates: {}
        };
        fs.writeFileSync(metaLoc, JSON.stringify(metaData), 'utf-8');
    }

    Object.keys(database.collections).forEach(collectionName => {
        ensureFolderExists(
            path.join(
                options.directory,
                collectionName
            )
        );
    });
}

export async function writeToFile(
    location: string,
    data: string | Blob
): Promise<void> {
    if (typeof data !== 'string') {
        data = await blobToString(data);
    }
    return new Promise(function (res, rej) {
        fs.writeFile(
            location,
            data as string,
            'utf-8',
            (err: Error | null) => {
                if (err) {
                    rej(err);
                } else {
                    res();
                }
            }
        );
    });
}

export function writeJsonToFile(
    location: string,
    data: any
): Promise<void> {
    return writeToFile(
        location,
        JSON.stringify(data)
    );
}

export function metaFileLocation(options: BackupOptions): string {
    return path.join(
        options.directory,
        'backup_meta.json'
    );
}

export function getMeta(options: BackupOptions): Promise<BackupMetaFileContent> {
    const loc = metaFileLocation(options);
    return new Promise((res, rej) => {
        fs.readFile(loc, 'utf-8', (err: Error | null, data: string) => {
            if (err) {
                rej(err);
            } else {
                const metaContent = JSON.parse(data);
                res(metaContent);
            }
        });
    });
}

export function setMeta(
    options: BackupOptions,
    meta: BackupMetaFileContent
): Promise<void> {
    const loc = metaFileLocation(options);
    return writeJsonToFile(loc, meta);
}

export function documentFolder(
    options: BackupOptions,
    docId: string
): string {
    return path.join(
        options.directory,
        docId
    );
}

```

### Core Architecture Module: `src/plugins/cleanup/cleanup-state.ts`
```
import type { RxCleanupPolicy, RxState } from '../../types/index.d.ts';
import { PROMISE_RESOLVE_TRUE } from '../../plugins/utils/index.ts';
import { REPLICATION_STATE_BY_COLLECTION } from '../replication/index.ts';
import { DEFAULT_CLEANUP_POLICY } from './cleanup-helper.ts';
import { initialCleanupWait } from './cleanup.ts';
import { firstValueFrom } from 'rxjs';

let RXSTATE_CLEANUP_QUEUE: Promise<any> = PROMISE_RESOLVE_TRUE;

export async function startCleanupForRxState(state: RxState<unknown, unknown>) {
    const rxCollection = state.collection;
    const rxDatabase = rxCollection.database;
    const cleanupPolicy = Object.assign(
        {},
        DEFAULT_CLEANUP_POLICY,
        rxDatabase.cleanupPolicy ? rxDatabase.cleanupPolicy : {}
    );

    await initialCleanupWait(rxCollection, cleanupPolicy);
    if (rxCollection.closed) {
        return;
    }

    // initially cleanup the state
    await cleanupRxState(state, cleanupPolicy);

    /**
     * Afterwards we listen to writes
     * and only re-run the cleanup if there was a write
     * to the state.
     */
    await runCleanupAfterWrite(state, cleanupPolicy);
}
/**
 * Runs the cleanup for a single RxState
 */
export async function cleanupRxState(
    state: RxState<unknown, unknown>,
    cleanupPolicy: RxCleanupPolicy
) {
    const rxCollection = state.collection;
    const rxDatabase = rxCollection.database;

    // run cleanup() until it returns true
    let isDone = false;
    while (!isDone && !rxCollection.closed) {
        if (cleanupPolicy.awaitReplicationsInSync) {
            const replicationStates = REPLICATION_STATE_BY_COLLECTION.get(rxCollection);
            if (replicationStates) {
                await Promise.all(
                    replicationStates.map(replicationState => {
                        if (!replicationState.isStopped()) {
                            return replicationState.awaitInSync();
                        }
                    })
                );
            }
        }
        if (rxCollection.closed) {
            return;
        }
        RXSTATE_CLEANUP_QUEUE = RXSTATE_CLEANUP_QUEUE
            .then(async () => {
                if (rxCollection.closed) {
                    return true;
                }
                await rxDatabase.requestIdlePromise();
                return state._cleanup();
            });
        isDone = await RXSTATE_CLEANUP_QUEUE;
    }
}

export async function runCleanupAfterWrite(
    state: RxState<unknown, unknown>,
    cleanupPolicy: RxCleanupPolicy
) {
    const rxCollection = state.collection;
    while (!rxCollection.closed) {
        /**
         * We only start the timer if there was actually a write
         * to the collection. Otherwise the cleanup would
         * just run on intervals even if nothing has changed.
         */
        await firstValueFrom(rxCollection.eventBulks$).catch(() => { });
        await rxCollection.promiseWait(cleanupPolicy.runEach);
        if (rxCollection.closed) {
            return;
        }
        await cleanupRxState(state, cleanupPolicy);
    }
}

```

### Core Architecture Module: `src/plugins/electron/rx-storage-ipc-renderer.ts`
```
import { Subject } from 'rxjs';
import {
    getRxStorageRemote,
    RxStorageRemote,
    RxStorageRemoteSettings,
    MessageFromRemote
} from '../storage-remote/index.ts';
import {
    IPC_RENDERER_KEY_PREFIX
} from './electron-helper.ts';
import { PROMISE_RESOLVE_VOID } from '../utils/index.ts';

export type RxStorageIpcRendererSettings = {
    /**
     * Set the same key on both sides
     * to ensure that messages do not get mixed
     * up when you use more than one storage.
     */
    key: string;
    ipcRenderer: any;
    mode: RxStorageRemoteSettings['mode'];
};

export type RxStorageIpcRenderer = RxStorageRemote;
export function getRxStorageIpcRenderer(
    settings: RxStorageIpcRendererSettings
): RxStorageIpcRenderer {
    const channelId = [
        IPC_RENDERER_KEY_PREFIX,
        settings.key
    ].join('|');

    const storage = getRxStorageRemote({
        identifier: 'electron-ipc-renderer',
        mode: settings.mode,
        messageChannelCreator() {
            const messages$ = new Subject<MessageFromRemote>();
            const listener = (_event: any, message: any) => {
                messages$.next(message);
            };
            settings.ipcRenderer.on(channelId, listener);
            settings.ipcRenderer.postMessage(
                channelId,
                false
            );
            return Promise.resolve({
                messages$,
                send(msg) {
                    settings.ipcRenderer.postMessage(
                        channelId,
                        msg
                    );
                },
                close() {
                    settings.ipcRenderer.removeListener(channelId, listener);
                    return PROMISE_RESOLVE_VOID;
                }
            });
        },
    });
    return storage;
}

```

### Core Architecture Module: `src/plugins/migration-schema/rx-migration-state.ts`
```
import {
    Observable,
    Subject,
    distinctUntilChanged,
    filter,
    firstValueFrom,
    map,
    shareReplay
} from 'rxjs';
import {
    isBulkWriteConflictError,
    newRxError
} from '../../rx-error.ts';
import type {
    InternalStoreCollectionDocType,
    NumberFunctionMap,
    RxCollection,
    RxDatabase,
    RxError,
    RxReplicationWriteToMasterRow,
    RxStorageInstance,
    RxStorageInstanceReplicationState,
    RxTypeError
} from '../../types/index.d.ts';
import {
    MIGRATION_DEFAULT_BATCH_SIZE,
    MIGRATION_LEADER_TIMING,
    addMigrationStateToDatabase,
    getOldCollectionMeta,
    migrateDocumentData,
    mustMigrate
} from './migration-helpers.ts';
import {
    PROMISE_RESOLVE_TRUE,
    RXJS_SHARE_REPLAY_DEFAULTS,
    clone,
    deepEqual,
    ensureNotFalsy,
    errorToPlainJson,
    getDefaultRevision,
    getDefaultRxDocumentMeta,
    now,
    promiseWait
} from '../utils/index.ts';
import type {
    MigrationStatusUpdate,
    RxMigrationStatus,
    RxMigrationStatusDocument
} from './migration-types.ts';
import {
    getSingleDocument,
    hasEncryption,
    observeSingle,
    writeSingle
} from '../../rx-storage-helper.ts';
import {
    BroadcastChannel,
    createLeaderElection
} from 'broadcast-channel';
import {
    META_INSTANCE_SCHEMA_TITLE,
    awaitRxStorageReplicationFirstInSync,
    awaitRxStorageReplicationInSync,
    cancelRxStorageReplication,
    defaultConflictHandler,
    getRxReplicationMetaInstanceSchema,
    replicateRxStorageInstance,
    rxStorageInstanceToReplicationHandler
} from '../../replication-protocol/index.ts';
import { overwritable } from '../../overwritable.ts';
import {
    INTERNAL_CONTEXT_MIGRATION_STATUS,
    addConnectedStorageToCollection,
    getPrimaryKeyOfInternalDocument
} from '../../rx-database-internal-store.ts';
import { normalizeMangoQuery, prepareQuery } from '../../rx-query-helper.ts';



export class RxMigrationState {

    public database: RxDatabase;


    private started: boolean = false;
    public readonly oldCollectionMeta: ReturnType<typeof getOldCollectionMeta>;
    public readonly mustMigrate: ReturnType<typeof mustMigrate>;
    public readonly statusDocId: string;
    public readonly $: Observable<RxMigrationStatus>;

    /**
     * Contains ALL replication states
     * that are ever used in this migration state.
     */
    public replicationStates = new Set<RxStorageInstanceReplicationState<any>>();
    /**
     * All storage instances that are opened by the migration itself.
     * They have to be closed when the migration is canceled,
     * otherwise they stay open forever when the migration is interrupted,
     * for example when the database is closed while the migration is running.
     */
    public openStorageInstances = new Set<RxStorageInstance<any, any, any>>();
    public canceled: boolean = false;
    public broadcastChannel?: BroadcastChannel;
    public heartbeatInterval?: ReturnType<typeof setInterval>;
    constructor(
        public readonly collection: RxCollection,
        public readonly migrationStrategies: NumberFunctionMap,
        public readonly statusDocKey = [
            collection.name,
            'v',
            collection.schema.version
        ].join('-'),
    ) {
        this.database = collection.database;
        this.oldCollectionMeta = getOldCollectionMeta(this);
        this.mustMigrate = mustMigrate(this);
        this.statusDocId = getPrimaryKeyOfInternalDocument(
            this.statusDocKey,
            INTERNAL_CONTEXT_MIGRATION_STATUS
        );
        addMigrationStateToDatabase(this);

        this.$ = observeSingle<RxMigrationStatusDocument>(
            this.database.internalStore,
            this.statusDocId
        ).pipe(
            filter((d: RxMigrationStatusDocument | null) => !!d),
            map((d: RxMigrationStatusDocument | null) => ensureNotFalsy(d).data),
            /**
             * The heartbeat of the leader rewrites the status document
             * without changing its data, which must not emit here.
             */
            distinctUntilChanged((a, b) => deepEqual(a, b)),
            shareReplay(RXJS_SHARE_REPLAY_DEFAULTS)
        );
    }

    getStatus() {
        return firstValueFrom(this.$);
    }


    /**
     * Starts the migration.
     * Returns void so that people to not get the idea to await
     * this function.
     * Instead use migratePromise() if you want to await
     * the migration. This ensures it works even if the migration
     * is run on a different browser tab.
     */
    async startMigration(batchSize: number = MIGRATION_DEFAULT_BATCH_SIZE): Promise<void> {
        if (this.started) {
            throw newRxError('DM1');
        }
        /**
         * Block outside writes to the collection while the migration is running.
         * The migration replication fills the new storage and concurrent writes
         * could conflict with that process.
         * We set the flag synchronously (before the `mustMigrate` await) so that
         * any code calling `migratePromise()` and then immediately performing a
         * write will reliably observe the block.
         * If no migration is actually needed, the flag is cleared again below.
         */
        this.collection.migrationInProgress = true;
        const must = await this.mustMigrate;
        if (!must) {
            this.collection.migrationInProgress = false;
            return;
        }
        this.started = true;

        /**
         * Ensure the migration is cleaned up when the collection or the
         * database is closed. Registering this here (instead of inside
         * migrateStorage()) guarantees the broadcastChannel / leader
         * election is released even if the migration throws before the
         * replication is set up.
         */
        this.collection.onClose.push(() => this.cancel());
        this.database.onClose.push(() => this.cancel());

        try {
            await this.runMigration(batchSize);
        } finally {
            this.stopHeartbeat();
            /**
             * Always close the broadcastChannel so that the tab does not
             * stay leader forever if the migration throws on any code path.
             * @link https://github.com/pubkey/rxdb/pull/7827
             */
            if (this.broadcastChannel) {
                await this.broadcastChannel.close();
                this.broadcastChannel = undefined;
            }
        }
    }

    private async runMigration(batchSize: number): Promise<void> {
        /**
         * To ensure that multiple tabs do not migrate the same collection,
         * we use a new broadcastChannel/leaderElector for each collection.
         * This is required because collections can be added dynamically and
         * not all tabs might know about this collection.
         */
        if (this.database.multiInstance) {
            this.broadcastChannel = new BroadcastChannel([
                'rx-migration-state',
                this.database.name,
                this.collection.name,
                this.collection.schema.version
            ].join('|'));
            const leaderElector = createLeaderElection(this.broadcastChannel);
            const waitResult = await this.awaitLeadershipOrStalledLeader(
                () => leaderElector.awaitLeadership()
            );
            if (waitResult === 'DONE' || this.canceled) {
                this.collection.migrationInProgress = false;
                return;
            }
            this.startHeartbeat();
        }

        /**
         * Instead of writing a custom migration protocol,
         * we do a push-only replication from the old collection data to the new one.
         * This also ensure that restarting the replication works without problems.
         */
        const oldCollectionMeta = await this.oldCollectionMeta;
        const oldStorageInstance = await this.database.storage.createStorageInstance({
            databaseName: this.database.name,
            collectionName: this.collection.name,
            databaseInstanceToken: this.database.token,
            multiInstance: this.database.multiInstance,
            options: {},
            schema: ensureNotFalsy(oldCollectionMeta).data.schema,
            password: this.database.password,
            devMode: overwritable.isDevMode()
        });
        this.openStorageInstances.add(oldStorageInstance);


        const connectedInstances = await this.getConnectedStorageInstances();


        /**
         * Initially write the migration status into a meta document.
         */
        const totalCount = await this.countAllDocuments(
            [oldStorageInstance].concat(connectedInstances.map(r => r.oldStorage))
        );
        await this.updateStatus(s => {
            s.count.total = totalCount;
            return s;
        });


        try {
            /**
             * First migrate the connected storages,
             * afterwards migrate the normal collection.
            */
            await Promise.all(
                connectedInstances.map(async (connectedInstance) => {
                    await addConnectedStorageToCollection(
                        this.collection,
                        connectedInstance.newStorage.collectionName,
                        connectedInstance.newStorage.schema
                    );
                    await this.migrateStorage(
                        connectedInstance.oldStorage,
                        connectedInstance.newStorage,
                        batchSize
                    );
                    this.openStorageInstances.delete(connectedInstance.newStorage);
                    await connectedInstance.newStorage.close();
                })
            );

            await this.migrateStorage(
                oldStorageInstance,
                /**
                 * Use the originalStorageInstance here
                 * so that the _meta.lwt time keeps the same
    
```

### Core Architecture Module: `src/plugins/react/hooks/index.ts`
```
export * from './use-rx-collection.ts';
export * from './use-rx-database.ts';
export * from './use-rx-query.ts';
export * from './use-live-rx-query.ts';
export * from './use-rx-document.ts';
export * from './use-replication-status.ts';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9196** (2026-10-05): **FIX DB6 on unchanged schema after device locale change**
  *Symptoms*: ## This PR contains: - A BUGFIX  ## Describe the problem you have without this PR Closes https://github.com/pubkey/rxdb/issues/9128. This is an alternative to https://github.com/pubkey/rxdb/pull/9129.  `sortObject()` uses `localeCompare()` without a locale, so the schema hash depends on the device locale. In Czech and Slovak "ch" sorts after "h", so a schema with `chunk_id` and `hint` gets a different hash after the device language changes, and `addCollections()` throws `DB6` for an unchanged schema.  Differences to https://github.com/pubkey/rxdb/pull/9129: - `localeCompare()` is **not** hardcoded to `'en'`. That would make sorting slower for every non-en user and changes nothing about the normalization itself. - In `addCollections()`, when the stored `schemaHash` differs, the stored schema is compared with `deepEqual()` (key order independent). `DB6` is only thrown when the content differs. The check only runs on a hash mismatch, so the normal startup path is unchanged. Nothing is written to the internal store. - `orga/before-next-major.md` gets a note to change the normalization to no longer use `localeCompare()` and to remove the `deepEqual()` fallback again in the next major.  ## Todos - [x] Tests: a database created with a `cs` collation reopens without `DB6` (fails without the fix), and a stored schema with different content still throws `DB6`. - [x] Changelog  `npm run test:fast:memory`: 1441 passing. `npm run check-types` and eslint pass.  🤖 Generated with [Claude Co
  **Post-Mortem & Fix Analysis**:
  > <!-- test-without-fix-bot --> ## ✅ Verify Test Reproduction: Tests FAILED without the fix (expected)  This confirms the changed tests correctly reproduce the bug that the source changes fix.  _This workflow runs the changed tests **without** the source fix to verify they reproduce the bug._  <details> <summary>Show output</summary>  ``` ...(truncated, showing last 200 of 1638 lines) 	  "indexes": [ 	    [ 	      "_deleted", 	      "id" 	    ], 	    [ 	      "_meta.lwt", 	      "id" 	    ] 	  ], 	  "keyCompression": false, 	  "primaryKey": "id", 	  "properties": { 	    "_attachments": { 	      "type": "object" 	    }, 	    "_deleted": { 	      "type": "boolean" 	    }, 	    "_meta": { 	      "additionalProperties": true, 	      "properties": { 	        "lwt": { 	          "maximum": 1000000000000000, 	          "minimum": 1, 	          "multipleOf": 0.01, 	          "type": "number" 	        } 	      }, 	      "required": [ 	        "lwt" 	      ], 	      "type": "object" 	    }, 	    "

- **Issue #9195** (2026-10-05): **FIX schema migration blocked forever by a frozen leader tab (#9191)**
  *Symptoms*: ## This PR contains: - A BUGFIX - IMPROVED TESTS  ## Describe the problem you have without this PR Fixes https://github.com/pubkey/rxdb/issues/9191  With `multiInstance: true`, `runMigration()` awaited `awaitLeadership()` without any bound. When the tab that won the election was frozen, throttled or discarded, it never wrote `DONE`, and `addCollections()` hung in every other tab.  Changes in `src/plugins/migration-schema/`: - **Heartbeat**: while it runs the migration, the leader rewrites the migration status document every `heartbeatInterval` (default 5s), so its `_meta.lwt` keeps moving. Frozen tabs do not run timers, so the heartbeat stops when the leader stops. - **Bounded wait**: `awaitLeadershipOrStalledLeader()` races leadership against a poll of the status document. When the document was not written for `timeout` (default 60s, measured from when the wait started), the waiting tab takes over. When it sees `DONE`, it stops waiting and does not migrate. - **Configurable**: `MIGRATION_LEADER_TIMING` and `setMigrationLeaderTiming(timeout, heartbeatInterval?)` are exported. - **Concurrency guard**: a leader that thaws after a takeover can fail because the old storages are gone already. Its error no longer overwrites a `DONE` status with `ERROR`. - `$` now uses `distinctUntilChanged(deepEqual)`, so heartbeat writes do not emit duplicate statuses.  The 60s default stays above Chrome's intensive timer throttling (1 wake-up per minute) for hidden tabs. A throttled leader that i
  **Post-Mortem & Fix Analysis**:
  > <!-- test-without-fix-bot --> ## ✅ Verify Test Reproduction: Tests FAILED without the fix (expected)  This confirms the changed tests correctly reproduce the bug that the source changes fix.  _This workflow runs the changed tests **without** the source fix to verify they reproduce the bug._  <details> <summary>Show output</summary>  ``` ...(truncated, showing last 200 of 1952 lines)     nostr signaling       [32m✓ [39mshould throw on invalid options       [32m✓ [39mshould sync over Nostr relays and only accept allowed public keys       [32m✓ [39mshould not spin when the relays are not reachable    encryption.test.ts     init       [32m✓ [39mcreate storage     basics       .encryptString()         [32m✓ [39mstring       .decryptString()         [32m✓ [39mstring         [32m✓ [39mshould encrypt and decrypt an extremely long string         [32m✓ [39mshould encrypt and decrypt an extremely long password     RxDatabase creation       [32m✓ [39mshould crash with invalid pas

- **Issue #9194** (2026-10-05): **Show all logo animations on the brand guidelines page**
  *Symptoms*: ## This PR contains: - IMPROVED DOCS  ## Describe the problem you have without this PR The logo animations lived twice: as React components in `docs-src/src/components/animations/` and as plain HTML/JS in the static demo page `docs-src/static/logo-animations/index.html`. The demo page was not linked from the site and had to be kept in sync by hand.  This PR: - **Deletes** `docs-src/static/logo-animations/index.html`. Every animated card from it already exists as a React component (39 components). - **Adds** `docs-src/src/components/animations/index.ts`, a registry with title, description, component name and file of every animation, in three groups: Logo and Wordmark, Motion That Explains the Database, One Animation per Core Feature. - **Adds** a "Logo Animations" section to `/brand-guidelines/` that renders all animations as a gallery, with the component name of each one and an example of how to embed an animation in the docs with `DocsAnimation`. Animations are only mounted while their card is near the viewport, so only the visible ones run.  Checked in headless Chromium: all 39 cards render, previews stay within 200px height, no console errors. Lint and codespell pass on the changed files.  ## Todos - [x] Documentation  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01BMwkZwXscNESZMb1iFjeLU  --- _Generated by [Claude Code](https://claude.ai/code/session_01BMwkZwXscNESZMb1iFjeLU)_

- **Issue #9193** (2026-10-05): **FIX flaky encrypted attachment test that decoded binary ciphertext as base64**
  *Symptoms*: ## This PR contains: - IMPROVED TESTS  ## Describe the problem you have without this PR `attachments.test.ts` > `encryption` > `should store the data encrypted` failed in the premium `encryption-web-crypto` integration run (pubkey/rxdb-premium-dev#577) with:  ``` SyntaxError: Malformed padding: exactly one additional character   at Uint8Array.fromBase64 (core-js ...)   at decode (js-base64 ...)   at b64DecodeUnicode (src/plugins/utils/utils-base64.ts:21:12)   at test/unit/attachments.test.ts:528 ```  The test read the stored attachment as a string and base64-decoded it. The premium web-crypto encryption stores the ciphertext as binary, not base64. js-base64 drops all non-base64 characters, and the core-js `Uint8Array.fromBase64` polyfill throws when the remaining length leaves exactly one extra character. With random IVs this happens in about 1 of 4 runs.  Measured: - decoding random 39-byte ciphertexts with js-base64 + core-js: 509 of 2000 throw. - the test with the premium web-crypto storage in Node.js, before: 4 of 12 runs failed with the same error. - after: 0 of 12 runs failed.  The test now checks that the raw stored data does not contain the plain text. This still works for `encryption-crypto-js`, which stores the ciphertext as a string.  ## Todos - [x] Tests - [x] Changelog  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_017UTvNGpZmN9fFZbTaeBnSF  --- _Generated by [Claude Code](https://claude.ai/code/session_017UTvNGpZm

- **Issue #9192** (2026-10-05): **FIX webmcp and cleanup tests that failed in the premium integration runs**
  *Symptoms*: ## This PR contains: - IMPROVED TESTS - A BUGFIX  ## Describe the problem you have without this PR Two tests in the RxDB suite failed in the rxdb-premium integration jobs. These jobs run this suite against the premium storages.  ### 1. `webmcp.test.ts` in browsers with native WebMCP support Chromium 154 ships a native `document.modelContext`. The `@mcp-b/webmcp-polyfill` does not install itself when a native registry exists (`initializeWebMCPPolyfill()` returns early when `document.modelContext` is set), so it also skips the testing shim. `navigator.modelContextTesting` is then `undefined` and `getTools()` returns `[]`. The plugin registers its tools at the native registry, and `should register query tool when registerWebMCP is called` fails with `0 !== 7`. The rxdb-premium `memory-mapped` job runs the suite with the Chromium launcher and failed on this test. In CI the assertion message was hidden, because `source-map-support` threw `path.dirname is not a function` while formatting it.  Reproduced locally with Chrome for Testing 154.0.8037.92 and the memory-mapped custom storage: - Debug output inside the test showed `document.modelContext` as a native object (not the polyfill), `Document.prototype.modelContext` as a native configurable getter, and `navigator.modelContextTesting` as `undefined`. - Before: `Executed 1199 of 1289 (1 FAILED)`, `0 !== 7`. The same test passes in Chrome 141, which has no native WebMCP.  Fix: in `before()`, the test calls `cleanupWebMCPPolyfill()` 

- **Issue #9191** (2026-10-05): **Schema migration leader election has no timeout, so a frozen tab blocks addCollections() in every other tab**
  *Symptoms*: ## Summary  When a schema migration runs with `multiInstance: true`, each collection's migration elects a leader tab. The wait for that leadership has no timeout and no visibility awareness. When the tab that wins the election is then frozen, throttled or discarded by the browser, it never finishes the migration and never writes the `DONE` status document. Every other tab stays blocked in `addCollections()` for as long as that tab exists. The visible tab cannot take over, and a reload does not help.  The user-visible result is an app that hangs on its loading spinner in all tabs until the user finds and closes the one tab that holds the lock.  ## Where  `src/plugins/migration-schema/rx-migration-state.ts`, in `runMigration()`:  ```ts if (this.database.multiInstance) {     this.broadcastChannel = new BroadcastChannel([         'rx-migration-state',         this.database.name,         this.collection.name,         this.collection.schema.version     ].join('|'));     const leaderElector = createLeaderElection(this.broadcastChannel);     await leaderElector.awaitLeadership(); } ```  That `await` is unbounded. On browsers with the Web Locks API, `broadcast-channel` elects via `navigator.locks`, and such a lock is held until the page is destroyed. Freezing a tab does not release it.  ## Why the existing mitigations do not cover this  The replication plugin has handling for exactly this class of problem, and the migration plugin has none of it:  - `toggleOnDocumentVisible` exists on

- **Issue #9190** (2026-10-05): **docs: rewrite the React IndexedDB article**
  *Symptoms*: ## This PR contains: - IMPROVED DOCS  ## Describe the problem you have without this PR `articles/react-indexeddb.md` is the best ranking page for "indexeddb react", but it only showed RxDB setup and did not answer what people searching that query need. The code samples also had bugs: inserts without the required primary key, and the localStorage storage used on an IndexedDB page.  The rewrite covers: - IndexedDB vs localStorage facts table for React apps - Plain IndexedDB with a cached open promise and a custom `useTodos()` hook, plus where that approach breaks (no reactivity, no multi-tab, schema upgrades, transaction cost with sourced numbers) - Comparison of idb, idb-keyval, localForage, and RxDB (Dexie.js is intentionally not listed), including when a simpler library is enough - RxDB with the official React plugin (`RxDatabaseProvider`, `useLiveRxQuery`, `useRxCollection`, `useRxDocument`, `useReplicationStatus`), using the Dexie/IndexedDB RxStorages and a typed schema - Next.js SSR (`indexedDB is not defined`), React StrictMode double effects, testing with Jest/Vitest (fake-indexeddb or the memory storage) - Storage quotas, Safari's 7-day cap, `navigator.storage.persist()`, and performance tips - FAQ extended with long-tail questions; existing FAQ items kept and corrected (for example `CryptoKey` does not need to be extractable) - Inbound in-text links from `react-database.md`, `reactjs-storage.md`, `browser-database.md`, `indexeddb-tutorial.md`, and `best-indexeddb-wrap

- **Issue #9189** (2026-10-05): **docs: add NCAGE code CNP90 to the legal notice**
  *Symptoms*: ## This PR contains:  IMPROVED DOCS  ## Describe the problem you have without this PR  The legal notice at `/legal-notice/` lists the entity name, the address and the VAT ID, but not the NCAGE code. The German National Codification Bureau at the Logistikkommando der Bundeswehr assigned the NCAGE code `CNP90` to the entity on October 5, 2026 under the NATO Codification System. Defense and public sector procurement departments ask for that code when they set a supplier up in their systems, and right now there is no page on rxdb.info where they can look it up.  This PR adds it to the legal notice, directly below the VAT ID, because both are entity identifiers and that is where a procurement reader looks for them. Two lines:  ``` NCAGE Code (NATO Commercial and Government Entity Code) CNP90 ```  The heading expands the acronym and that is the whole of it. No explanatory paragraph, because the people who look up an NCAGE code already know what one is, and the VAT ID above carries no explanation either.  No badge, no seal, no shield, and no wording like "NATO registered" or "NATO certified". An NCAGE code identifies a supplier in NATO logistics systems. It is not a product certification and not a security approval, and a plain text identifier does not suggest otherwise.  The page already carries `<meta name="robots" content="noindex">`, which stays. This is a record for people who go looking for it, not an SEO page.  ## Todos  - [ ] ~~Tests~~ (no source code change) - [x] Documenta

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

### Incident Patch 1: `4c8c9f70` (2026-10-05)
**Commit Message**: FIX schema migration blocked forever by a frozen leader tab (#9191) (#9195)

* FIX schema migration blocked forever by a frozen leader tab

The per-collection migration leader election had no timeout. When the
tab that won the election was frozen, throttled or discarded, every other
tab stayed blocked in addCollections(). The leader now writes a heartbeat
into the migration status document and waiting tabs take over when it
goes quiet for MIGRATION_LEADER_TIMING.timeout (default 60s).

Fixes #9191

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01WpW3dVskPBfgiyQnoEZ9Na

* Fix codespell typo in migration leader comment

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01WpW3dVskPBfgiyQnoEZ9Na

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/changelog/fix-migration-frozen-leader-blocks-tabs.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX schema migration with `multiInstance: true` blocked `addCollections()` in every tab forever when the tab that won the leader election of the migration was frozen, throttled or discarded by the browser. The migration leader now writes a heartbeat into the migration status document and waiting tabs take over the migration when the status document was not written for 60 seconds (configurable with `setMigrationLeaderTiming()`). Fixes [#9191](https://github.com/pubkey/rxdb/issues/9191).
```

**File**: `src/plugins/migration-schema/migration-helpers.ts` (modified, +22/-0)
```diff
@@ -149,6 +149,28 @@ export async function mustMigrate(
 }
 export const MIGRATION_DEFAULT_BATCH_SIZE = 200;
 
+/**
+ * With multiInstance: true, only the leader tab runs the migration.
+ * The leader refreshes the migration status document every
+ * `heartbeatInterval` milliseconds. When the status document of a migration
+ * was not written for `timeout` milliseconds, the waiting tabs assume
+ * that the leader is frozen, throttled or discarded by the browser
+ * and take over the migration.
+ * @link https://github.com/pubkey/rxdb/issues/9191
+ */
+export const MIGRATION_LEADER_TIMING = {
+    timeout: 60 * 1000,
+    heartbeatInterval: 5 * 1000
+};
+
+export function setMigrationLeaderTiming(
+    timeout: number,
+    heartbeatInterval: number = Math.max(1, Math.floor(timeout / 4))
+) {
+    MIGRATION_LEADER_TIMING.timeout = timeout;
+    MIGRATION_LEADER_TIMING.heartbeatInterval = heartbeatInterval;
+}
+
 
 export type MigrationStateWithCollection = {
     collection: RxCollection;
```

**File**: `src/plugins/migration-schema/rx-migration-state.ts` (modified, +126/-1)
```diff
@@ -1,6 +1,7 @@
 import {
     Observable,
     Subject,
+    distinctUntilChanged,
     filter,
     firstValueFrom,
     map,
@@ -23,6 +24,7 @@ import type {
 } from '../../types/index.d.ts';
 import {
     MIGRATION_DEFAULT_BATCH_SIZE,
+    MIGRATION_LEADER_TIMING,
     addMigrationStateToDatabase,
     getOldCollectionMeta,
     migrateDocumentData,
@@ -37,6 +39,7 @@ import {
     errorToPlainJson,
     getDefaultRevision,
     getDefaultRxDocumentMeta,
+    now,
     promiseWait
 } from '../utils/index.ts';
 import type {
@@ -99,6 +102,7 @@ export class RxMigrationState {
     public openStorageInstances = new Set<RxStorageInstance<any, any, any>>();
     public canceled: boolean = false;
     public broadcastChannel?: BroadcastChannel;
+    public heartbeatInterval?: ReturnType<typeof setInterval>;
     constructor(
         public readonly collection: RxCollection,
         public readonly migrationStrategies: NumberFunctionMap,
@@ -123,6 +127,11 @@ export class RxMigrationState {
         ).pipe(
             filter((d: RxMigrationStatusDocument | null) => !!d),
             map((d: RxMigrationStatusDocument | null) => ensureNotFalsy(d).data),
+            /**
+             * The heartbeat of the leader rewrites the status document
+             * without changing its data, which must not emit here.
+             */
+            distinctUntilChanged((a, b) => deepEqual(a, b)),
             shareReplay(RXJS_SHARE_REPLAY_DEFAULTS)
         );
     }
@@ -174,6 +183,7 @@ export class RxMigrationState {
         try {
             await this.runMigration(batchSize);
         } finally {
+            this.stopHeartbeat();
             /**
              * Always close the broadcastChannel so that the tab does not
              * stay leader forever if the migration throws on any code path.
@@ -201,7 +211,14 @@ export class RxMigrationState {
                 this.collection.schema.version
             ].join('|'));
             const leaderElector = createLeaderElection(this.broadcastChannel);
-            await leaderElector.awaitLeadership();
+            const waitResult = await this.awaitLeadershipOrStalledLeader(
+                () => leaderElector.awaitLeadership()
+            );
+            if (waitResult === 'DONE' || this.canceled) {
+                this.collection.migrationInProgress = false;
+                return;
+            }
+            this.startHeartbeat();
         }
 
         /**
@@ -276,6 +293,15 @@ export class RxMigrationState {
             await oldStorageInstance.close();
             this.collection.migrationInProgress = false;
             await this.updateStatus(s => {
+                /**
+                 * When a frozen leader was taken over by another tab
+                 * and continues later, it can fail because the other tab
+                 * has already finished the migration and removed the old storages.
+                 * A finished migration must not be marked as failed.
+                 */
+                if (s.status === 'DONE') {
+                    return s;
+                }
                 s.status = 'ERROR';
                 s.error = errorToPlainJson(err as Error);
                 return s;
@@ -330,6 +356,104 @@ export class RxMigrationState {
         });
     }
 
+    /**
+     * Waits until this instance is the leader of the migration.
+     * Returns 'STALLED' when the current leader did not write
+     * the status document for longer than MIGRATION_LEADER_TIMING.timeout,
+     * because then the leader is likely frozen, throttled or discarded
+     * by the browser and this instance takes over the migration.
+     * Returns 'DONE' when another instance has finished the migration.
+     * @link https://github.com/pubkey/rxdb/issues/9191
+     */
+    public async awaitLeadershipOrStalledLeader(
+        awaitLeadership: () => Promise<any>
+    ): Promise<'LEADER' | 'STALLED' | 'DONE'> {
+        let waiting = true;
+        const startTime = now();
+        const leadershipPromise = awaitLeadership().then(() => 'LEADER' as const);
+        const stalledPromise = (async () => {
+            while (waiting && !this.canceled) {
+                await promiseWait(MIGRATION_LEADER_TIMING.heartbeatInterval);
+                if (!waiting || this.canceled) {
+                    break;
+                }
+                const statusDoc = await getSingleDocument<RxMigrationStatusDocument>(
+                    this.database.internalStore,
+                    this.statusDocId
+                );
+                if (statusDoc && statusDoc.data.status === 'DONE') {
+                    return 'DONE' as const;
+                }
+                const lastActivity = Math.max(
+                    startTime,
+                    statusDoc ? statusDoc._meta.lwt : 0
+                );
+                if (now() - lastActivity > MIGRATION_LEADER_TIMING.timeout) {
+                    return 'STALLED' as const;
+                }
+            }
+    
```

**File**: `test/unit/migration-schema.test.ts` (modified, +106/-1)
```diff
@@ -37,8 +37,14 @@ import {
 import {
     RxMigrationState,
     RxMigrationStatus,
-    getOldCollectionMeta
+    getOldCollectionMeta,
+    MIGRATION_LEADER_TIMING,
+    setMigrationLeaderTiming
 } from '../../plugins/migration-schema/index.mjs';
+import {
+    BroadcastChannel,
+    createLeaderElection
+} from 'broadcast-channel';
 
 import { RxDBMigrationPlugin } from '../../plugins/migration-schema/index.mjs';
 import { RxDBAttachmentsPlugin } from '../../plugins/attachments/index.mjs';
@@ -1620,6 +1626,105 @@ describe('migration-schema.test.ts', function () {
         });
 
 
+        /**
+         * When the tab that won the leader election of the migration
+         * is frozen, throttled or discarded by the browser, it never finishes
+         * the migration. The other tabs must not wait forever for it,
+         * otherwise addCollections() never resolves in any tab.
+         * @link https://github.com/pubkey/rxdb/issues/9191
+         */
+        it('#9191 must not block addCollections() forever when the migration leader is frozen', async () => {
+            if (!config.storage.hasMultiInstance) {
+                return;
+            }
+            const dbName = randomToken(10);
+            const schema0 = {
+                version: 0,
+                primaryKey: 'id',
+                type: 'object',
+                properties: {
+                    id: { type: 'string', maxLength: 100 },
+                    name: { type: 'string' }
+                },
+                required: ['id', 'name']
+            };
+            const schema1 = clone(schema0);
+            schema1.version = 1;
+
+            const db = await createRxDatabase({
+                name: dbName,
+                storage: config.storage.getStorage(),
+                multiInstance: true,
+                ignoreDuplicate: true
+            });
+            await db.addCollections({
+                items: { schema: schema0 }
+            });
+            await db.items.bulkInsert([
+                { id: 'doc1', name: 'Document 1' },
+                { id: 'doc2', name: 'Document 2' }
+            ]);
+            await db.close();
+
+            /**
+             * Simulate a frozen tab that has won the leader election
+             * of the migration but never does any work.
+             */
+            const frozenChannel = new BroadcastChannel([
+                'rx-migration-state',
+                dbName,
+                'items',
+                1
+            ].join('|'));
+            const frozenLeader = createLeaderElection(frozenChannel);
+            await frozenLeader.awaitLeadership();
+
+            const timingBefore = Object.assign({}, MIGRATION_LEADER_TIMING);
+            setMigrationLeaderTiming(500, 100);
+            try {
+                const db2 = await createRxDatabase({
+                    name: dbName,
+                    storage: config.storage.getStorage(),
+                    multiInstance: true,
+                    ignoreDuplicate: true
+                });
+                let timeoutRef: ReturnType<typeof setTimeout> | undefined;
+                await Promise.race([
+                    db2.addCollections({
+                        items: {
+                            schema: schema1,
+                            migrationStrategies: {
+                                1: (doc: any) => {
+                                    doc.name = doc.name + '-migrated';
+                                    return doc;
+                                }
+                            }
+                        }
+                    }),
+                    new Promise((_res, rej) => {
+                        timeoutRef = setTimeout(
+                            () => rej(new Error('addCollections() is blocked by the frozen migration leader')),
+                            10 * 1000
+                        );
+                    })
+                ]);
+                clearTimeout(timeoutRef);
+
+                const docs = await db2.items.find({ sort: [{ id: 'asc' }] }).exec();
+                assert.deepStrictEqual(
+                    docs.map((d: any) => d.name),
+                    ['Document 1-migrated', 'Document 2-migrated']
+                );
+                const status = await db2.items.getMigrationState().getStatus();
+                assert.strictEqual(status.status, 'DONE');
+
+                await db2.close();
+            } finally {
+                setMigrationLeaderTiming(timingBefore.timeout, timingBefore.heartbeatInterval);
+                await frozenChannel.close();
+            }
+        });
+
         it('#7008 migrate schema with multiple connected storages', async () => {
             // create a schema
             const mySchema = {
```

---

### Incident Patch 2: `24f959ff` (2026-10-05)
**Commit Message**: FIX DB6 on unchanged schema after device locale change (#9196)

* FIX DB6 on unchanged schema after device locale change

sortObject() uses localeCompare() so the schema hash depends on the
device locale. Instead of hardcoding a locale (slower for non-en users
and it changes hashes), addCollections() now runs a deepEqual() check
on the stored schema only when the hashes differ.

Closes #9128

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_014eko3HQhS62b9jhqFai3CE

* Close instead of remove the database after the expected DB6 in the test

The remote storage server keeps the instance of the failed addCollections()
with the other schema, so removing the collection storages with the stored
schema is refused.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_014eko3HQhS62b9jhqFai3CE

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/before-next-major.md` (modified, +10/-0)
```diff
@@ -6,6 +6,16 @@ This list contains things that have to be done but will create breaking changes.
 
 https://github.com/pubkey/rxdb/pull/9153
 
+## Schema normalization must not depend on the device locale
+
+`sortObject()` sorts the keys with `localeCompare()` without a fixed locale. The order, and with it the schema hash, depends on the device locale. For example in Czech and Slovak "ch" sorts after "h", so a schema with the keys `chunk_id` and `hint` gets a different hash when the device or app language changes. See https://github.com/pubkey/rxdb/issues/9128
+
+For now `addCollections()` runs a `deepEqual()` check on the stored schema when the hashes differ and does not throw `DB6` when the content is equal.
+
+In the next major:
+- Change the normalization in `sortObject()` to no longer use `localeCompare()`, for example a plain code unit comparison (`a < b`). This is faster and does not depend on the locale, but it changes the hash of existing schemas, which is why it is a breaking change.
+- Remove the `deepEqual()` fallback check in `addCollections()` again.
+
 ## Add end-to-end TypeScript typings for mango queries
 
 https://github.com/pubkey/rxdb/pull/8941
```

**File**: `orga/changelog/fix-schema-hash-device-locale.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX `addCollections()` threw `DB6` for an unchanged schema after the device or app language changed. `sortObject()` uses `localeCompare()`, so in Czech and Slovak ("ch" sorts after "h") the schema hash differed. When the hashes differ, the stored schema is now compared with `deepEqual()` and no error is thrown when the content is equal. [#9128](https://github.com/pubkey/rxdb/issues/9128)
```

**File**: `src/rx-database.ts` (modified, +13/-2)
```diff
@@ -44,7 +44,8 @@ import {
     getDefaultRevision,
     getDefaultRxDocumentMeta,
     defaultHashSha256,
-    RXDB_VERSION
+    RXDB_VERSION,
+    deepEqual
 } from './plugins/utils/index.ts';
 import {
     newRxError
@@ -460,7 +461,17 @@ export class RxDatabaseBase<
                     const collectionName = docInDb.data.name;
                     const schema = (schemas as any)[collectionName];
                     // collection already exists but has different schema
-                    if (docInDb.data.schemaHash !== await schema.hash) {
+                    if (
+                        docInDb.data.schemaHash !== await schema.hash &&
+                        /**
+                         * sortObject() uses localeCompare() which depends on the device locale,
+                         * so the same schema can produce a different key order and hash
+                         * on another device. Only when the hashes differ, we compare the content
+                         * so that this expensive check does not run on each startup.
+                         * @link https://github.com/pubkey/rxdb/issues/9128
+                         */
+                        !deepEqual(docInDb.data.schema, schema.jsonSchema)
+                    ) {
                         throw newRxError('DB6', {
                             database: this.name,
                             collection: collectionName,
```

**File**: `test/unit/rx-database.test.ts` (modified, +61/-0)
```diff
@@ -534,6 +534,67 @@ describe('rx-database.test.ts', () => {
             });
         });
     });
+    describe('schema hash depending on the device locale', () => {
+        /**
+         * @link https://github.com/pubkey/rxdb/issues/9128
+         */
+        it('should open a collection whose stored schema hash was created with a different locale', async () => {
+            if (!config.storage.hasPersistence) {
+                return;
+            }
+            const name = randomToken(10);
+            const storage = config.storage.getStorage();
+            const schema = {
+                version: 0,
+                primaryKey: 'id',
+                type: 'object',
+                properties: {
+                    id: { type: 'string', maxLength: 100 },
+                    hint: { type: 'string' },
+                    chunk_id: { type: 'number' }
+                },
+                required: ['id']
+            } as const;
+
+            const originalLocaleCompare = String.prototype.localeCompare;
+            String.prototype.localeCompare = function (this: string, that: string) {
+                return originalLocaleCompare.call(this, that, 'cs');
+            } as any;
+            let db1;
+            try {
+                db1 = await createRxDatabase({ name, storage });
+                await db1.addCollections({ items: { schema } });
+            } finally {
+                String.prototype.localeCompare = originalLocaleCompare;
+            }
+            await db1.items.insert({ id: 'a', hint: 'h', chunk_id: 1 });
+            await db1.close();
+
+            const db2 = await createRxDatabase({ name, storage });
+            await db2.addCollections({ items: { schema } });
+            const doc = await db2.items.findOne('a').exec(true);
+            assert.strictEqual(doc.hint, 'h');
+            await db2.remove();
+        });
+        it('should still throw DB6 when the stored schema has a different content', async () => {
+            if (!config.storage.hasPersistence) {
+                return;
+            }
+            const name = randomToken(10);
+            const storage = config.storage.getStorage();
+            const db1 = await createRxDatabase({ name, storage });
+            await db1.addCollections({ items: { schema: schemas.human } });
+            await db1.close();
+
+            const db2 = await createRxDatabase({ name, storage });
+            await AsyncTestUtil.assertThrows(
+                () => db2.addCollections({ items: { schema: { ...schemas.human, description: 'changed' } } }),
+                'RxError',
+                'DB6'
+            );
+            await db2.close();
+        });
+    });
     describe('.close()', () => {
         describe('positive', () => {
             it('should not crash on close', async () => {
```

---

### Incident Patch 3: `2cce20b4` (2026-10-05)
**Commit Message**: Show all logo animations on the brand guidelines page and remove the static demo page (#9194)

All animations from logo-animations/index.html are React components in
docs-src/src/components/animations/. A registry in animations/index.ts lists
them in groups, and the brand guidelines page renders them as a gallery that
only mounts animations near the viewport.


Claude-Session: https://claude.ai/code/session_01BMwkZwXscNESZMb1iFjeLU

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `docs-src/src/components/animations/index.ts` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+import type { ComponentType } from 'react';
+import { AttachmentsMail } from './attachments-mail';
+import { BackupCopy } from './backup-copy';
+import { CleanupSweep } from './cleanup-sweep';
+import { ConflictHandling } from './conflict-handling';
+import { CrdtMerge } from './crdt-merge';
+import { DocumentSwarm } from './document-swarm';
+import { EncryptionLogo } from './encryption-logo';
+import { FulltextSearchLens } from './fulltext-search-lens';
+import { GlitchLogo } from './glitch-logo';
+import { HeroMark } from './hero-mark';
+import { IsometricStack } from './isometric-stack';
+import { KeyCompressionLogo } from './key-compression-logo';
+import { LeaderElectionTabs } from './leader-election-tabs';
+import { LocalDocuments } from './local-documents';
+import { LogoBuildIn } from './logo-build-in';
+import { LogoLoader } from './logo-loader';
+import { MiddlewareHook } from './middleware-hook';
+import { OfflineQueue } from './offline-queue';
+import { P2pReplicationMesh } from './p2p-replication-mesh';
+import { PartialSyncChunks } from './partial-sync-chunks';
+import { Population } from './population';
+import { QueryCacheScan } from './query-cache-scan';
+import { ReactiveStream } from './reactive-stream';
+import { ReplicationPushPull } from './replication-push-pull';
+import { RevisionsLogo } from './revisions-logo';
+import { RxPipelineFlow } from './rx-pipeline-flow';
+import { RxQueryLogo } from './rx-query-logo';
+import { RxServerRack } from './rx-server-rack';
+import { RxStateBars } from './rx-state-bars';
+import { SchemaMigrationLogo } from './schema-migration-logo';
+import { SchemaValidationLogo } from './schema-validation-logo';
+import { ShardingSplit } from './sharding-split';
+import { StorageSwap } from './storage-swap';
+import { VectorDatabase } from './vector-database';
+import { WordmarkColorSweep } from './wordmark-color-sweep';
+import { WordmarkReactiveX } from './wordmark-reactive-x';
+import { WordmarkReveal } from './wordmark-reveal';
+import { WordmarkTypewriter } from './wordmark-typewriter';
+import { WorkerStorage } from './worker-storage';
+
+export type AnimationEntry = {
+    title: string;
+    description: string;
+    /**
+     * Exported name of the component.
+     */
+    name: string;
+    /**
+     * File name in src/components/animations without the extension.
+     */
+    file: string;
+    component: ComponentType;
+};
+
+export type AnimationGroup = {
+    title: string;
+    animations: AnimationEntry[];
+};
+
+/**
+ * All logo animations, grouped like they are shown on the brand guidelines page.
+ */
+export const ANIMATION_GROUPS: AnimationGroup[] = [
+    {
+        title: 'Logo and Wordmark',
+        animations: [
+            { title: 'Hero', name: 'HeroMark', file: 'hero-mark', component: HeroMark, description: 'The three layers extend into the feature list and the runtime name cycles below.' },
+            { title: 'Wordmark Reveal', name: 'WordmarkReveal', file: 'wordmark-reveal', component: WordmarkReveal, description: 'The letters of the wordmark build up next to the logo, followed by the claim.' },
+            { title: 'Typewriter', name: 'WordmarkTypewriter', file: 'wordmark-typewriter', component: WordmarkTypewriter, description: 'The wordmark is typed and deleted letter by letter.' },
+            { title: 'Reactive x', name: 'WordmarkReactiveX', file: 'wordmark-reactive-x', component: WordmarkReactiveX, description: 'A wave runs through the letters of the wordmark and into the layers of the icon.' },
+            { title: 'Color Sweep', name: 'WordmarkColorSweep', file: 'wordmark-color-sweep', component: WordmarkColorSweep, description: 'The three layer colors sweep through the letters of the wordmark.' },
+            { title: 'Glitch', name: 'GlitchLogo', file: 'glitch-logo', component: GlitchLogo, description: 'An RGB split glitch that plays every few seconds.' },
+            { title: 'Document Swarm', name: 'DocumentSwarm', file: 'document-swarm', component: DocumentSwarm, description: 'The logo built from small documents that scatter on pointer movement and spring back.' }
+        ]
+    },
+    {
+        title: 'Motion That Explains the Database',
+        animations: [
+            { title: 'Build-in', name: 'LogoBuildIn', file: 'logo-build-in', component: LogoBuildIn, description: 'The outline is drawn, then the layers slide in like documents written to storage.' },
+            { title: 'Reactive Stream', name: 'ReactiveStream', file: 'reactive-stream', component: ReactiveStream, description: 'Query results stream to the UI on every write.' },
+            { title: 'Replication', name: 'ReplicationPushPull', file: 'replication-push-pull', component: ReplicationPushPull, description: 'An RxDB client pushes and pulls documents with any server.' },
+            { title: 'Offline-First', name: 'OfflineQueue', file: 'offline-queue', component: OfflineQueue, description: 'Writes are queued while offl
```

**File**: `docs-src/src/pages/brand-guidelines.tsx` (modified, +73/-1)
```diff
@@ -1,6 +1,8 @@
 import Head from '@docusaurus/Head';
 import Layout from '@theme/Layout';
-import React from 'react';
+import React, { useEffect, useRef, useState } from 'react';
+import type { ReactNode } from 'react';
+import { ANIMATION_GROUPS } from '@site/src/components/animations';
 
 type LogoAsset = {
     title: string;
@@ -126,6 +128,29 @@ const styles = {
     },
 } as const;
 
+/**
+ * Renders the children only while they are near the viewport,
+ * so that only the visible animations run at the same time.
+ */
+function MountWhenVisible({ children }: { children: ReactNode; }) {
+    const ref = useRef<HTMLDivElement>(null);
+    const [visible, setVisible] = useState(false);
+    useEffect(() => {
+        const el = ref.current;
+        if (!el || typeof IntersectionObserver === 'undefined') {
+            setVisible(true);
+            return;
+        }
+        const observer = new IntersectionObserver(
+            entries => setVisible(entries.some(entry => entry.isIntersecting)),
+            { rootMargin: '200px' }
+        );
+        observer.observe(el);
+        return () => observer.disconnect();
+    }, []);
+    return <div ref={ref} className="brand-animation-preview">{visible ? children : null}</div>;
+}
+
 export default function BrandGuidelinesPage() {
     return (
         <>
@@ -249,6 +274,53 @@ export default function BrandGuidelinesPage() {
                             </p>
                         </div>
                     </div>
+                    <div className="block dark">
+                        <div className="content">
+                            <h2>Logo Animations</h2>
+                            <p>
+                                These <b>animated versions of the RxDB logo</b> are built from the shapes of the original mark and each one shows something the database does.
+                                They are React components in <code>docs-src/src/components/animations/</code>, respect <code>prefers-reduced-motion</code>,
+                                and can be used in talks, videos, and articles about RxDB. In the RxDB docs, wrap an animation in the <code>DocsAnimation</code> frame
+                                which centers it, limits its size, and shows a one-line subtitle below it:
+                            </p>
+                            <pre style={{ marginTop: 16 }}><code>{`import {DocsAnimation} from '@site/src/components/docs-animation';
+import {ReplicationPushPull} from '@site/src/components/animations/replication-push-pull';
+
+<DocsAnimation subtitle="Pushing and pulling documents between client and server">
+<ReplicationPushPull />
+</DocsAnimation>`}</code></pre>
+                            <style>{`
+                                .brand-animation-preview { height: 200px; background: #0D0F18; display: flex; align-items: center; justify-content: center; line-height: 0; }
+                                .brand-animation-preview > * { width: 100%; }
+                                .brand-animation-preview > * > svg,
+                                .brand-animation-preview > * > .stage,
+                                .brand-animation-preview > * > .dsw-stage { max-height: 200px; }
+                                .brand-animation-preview > .glitch-logo { width: 110px !important; }
+                            `}</style>
+                            {ANIMATION_GROUPS.map(group => (
+                                <div key={group.title}>
+                                    <h3 style={{ marginTop: 32 }}>{group.title}</h3>
+                                    <div style={styles.grid}>
+                                        {group.animations.map(animation => {
+                                            const Animation = animation.component;
+                                            return (
+                                                <div key={animation.name} style={styles.card}>
+                                                    <MountWhenVisible>
+                                                        <Animation />
+                                                    </MountWhenVisible>
+                                                    <div style={styles.cardBody}>
+                                                        <h4 style={{ marginBottom: 8 }}>{animation.title}</h4>
+                                                        <p style={{ fontSize: '0.9rem' }}>{animation.description}</p>
+                                                        <code style={{ fontSize: '0.8rem' }}>{'<' + animation.name + ' />'}</code>
+                                                    </div>
+                                                </div>
+                                            );
+                                        })}
+                                    </div>
+                                </div>
+                            ))}
+                        </div>
+                    </div>
 
```

---

### Incident Patch 4: `f5ecb04d` (2026-10-05)
**Commit Message**: FIX flaky encrypted attachment test that decoded binary ciphertext as base64 (#9193)

* FIX flaky encrypted attachment test that decoded binary ciphertext as base64

The premium encryption-web-crypto storage stores encrypted attachments as
binary. The test read that binary as a string and base64-decoded it. With the
core-js Uint8Array.fromBase64 polyfill this threw 'Malformed padding' whenever
the leftover base64 characters had an invalid length, which happened in
about 1 of 4 runs. The test now checks that the raw stored data does not
contain the plain text.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_017UTvNGpZmN9fFZbTaeBnSF

* changelog: link #9193

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_017UTvNGpZmN9fFZbTaeBnSF

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/changelog/test-attachments-encrypted-binary-data.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX flaky `attachments.test.ts` encryption test that decoded binary ciphertext as base64 and failed about 1 in 4 runs with storages that store the encrypted attachment data as binary [#9193](https://github.com/pubkey/rxdb/pull/9193)
```

**File**: `test/unit/attachments.test.ts` (modified, +7/-5)
```diff
@@ -24,7 +24,6 @@ import {
     WithAttachmentsData,
     RxCollection,
     ensureNotFalsy,
-    b64DecodeUnicode,
     RxStorageInstance,
     blobToBase64String,
     createBlobFromBase64,
@@ -521,12 +520,15 @@ describe('attachments.test.ts', () => {
             });
 
 
-            // the data stored in the storage must be encrypted
+            /**
+             * The data stored in the storage must be encrypted.
+             * Encryption plugins can store the ciphertext as binary
+             * which is not valid base64, so the raw stored data is compared.
+             */
             const lowLevelStorage: RxStorageInstance<HumanDocumentType, any, any> = (doc.collection.storageInstance.originalStorageInstance as any).originalStorageInstance;
             const encryptedData = await lowLevelStorage.getAttachmentData(doc.primary, 'cat.txt', attachment.digest);
-            const dataStringBase64 = await blobToString(encryptedData);
-            const dataString = b64DecodeUnicode(dataStringBase64);
-            assert.notStrictEqual(dataString, insertData);
+            const storedString = await blobToString(encryptedData);
+            assert.ok(!storedString.includes(insertData));
 
             // getting the data again must be decrypted
             const data = await attachment.getStringData();
```

---

### Incident Patch 5: `4cafd121` (2026-10-05)
**Commit Message**: FIX webmcp and cleanup tests that failed in the premium integration runs (#9192)

* FIX webmcp.test.ts in browsers with native WebMCP support

Chromium 154 provides a native document.modelContext. The WebMCP polyfill
does not install itself or its testing shim when a native registry exists,
so navigator.modelContextTesting was undefined, getTools() returned [] and
'should register query tool when registerWebMCP is called' failed with
0 !== 7. This made the premium memory-mapped job, which runs the suite in
Chromium, fail.

The test now removes the native getter in before() and restores it in
after(), so the polyfill and its testing shim are used in every browser.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_017UTvNGpZmN9fFZbTaeBnSF

* FIX flaky cleanup test when the storage uses another now() instance

'should clean up all deleted documents when multiple are deleted' writes
the deletes with the now() of the test and calls cleanup(0) directly after.
cleanup(0) only removes documents with a lwt below the now() of the storage.
In the premium integration tests the storage bundles its own rxdb copy, so
there are two now() instances w

**File**: `orga/changelog/test-cleanup-multiple-deleted-now-instances.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX the storage test `should clean up all deleted documents when multiple are deleted` failed from time to time when the storage uses another instance of `now()` than the test, like the premium storages in their integration tests. The test now waits until the deletion time is in the past before it runs `cleanup(0)`.
```

**File**: `orga/changelog/test-webmcp-native-model-context.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX `webmcp.test.ts` failed in browsers with native WebMCP support (like Chromium 154) because the polyfill does not install its testing shim when `document.modelContext` already exists. The test now removes the native getter while it runs and restores it afterwards.
```

**File**: `test/unit/rx-storage-implementations.test.ts` (modified, +9/-0)
```diff
@@ -3272,6 +3272,15 @@ describe('rx-storage-implementations.test.ts (implementation: ' + config.storage
                 const deleteResult = await storageInstance.bulkWrite(deleteRows, testContext);
                 assert.deepStrictEqual(deleteResult.error, [], 'all deletes must succeed');
 
+                /**
+                 * cleanup(0) only removes documents with a lwt below the now() of the storage.
+                 * The storage can use another instance of now() with its own sub-millisecond counter
+                 * (like the premium storages in the integration tests), so wait until the
+                 * deletion time is in the past.
+                 */
+                const maxDeletedLwt = Math.max(...deleteRows.map(row => row.document._meta.lwt));
+                await waitUntil(() => Date.now() > maxDeletedLwt);
+
                 /**
                  * Run cleanup(0) to remove all deleted docs.
                  */
```

**File**: `test/unit/webmcp.test.ts` (modified, +20/-0)
```diff
@@ -40,13 +40,33 @@ describe('webmcp.test.ts', () => {
      */
     const itWithDom = isDeno ? it.skip : it;
     let removeDom: (() => void) | undefined;
+
+    /**
+     * Browsers with native WebMCP support (like Chromium 154) provide
+     * document.modelContext. The polyfill does not install itself
+     * and its testing shim when a native registry exists, so the native
+     * getter is removed while these tests run and restored afterwards.
+     */
+    let nativeModelContextDescriptor: PropertyDescriptor | undefined;
     before(async () => {
         if (typeof document === 'undefined' && !isDeno) {
             const { default: globalJsdom } = await import(/* webpackIgnore: true */ 'global-jsdom');
             removeDom = globalJsdom();
         }
+        cleanupWebMCPPolyfill();
+        if (typeof Document !== 'undefined') {
+            const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'modelContext');
+            if (descriptor && descriptor.configurable) {
+                nativeModelContextDescriptor = descriptor;
+                delete (Document.prototype as any).modelContext;
+            }
+        }
     });
     after(() => {
+        cleanupWebMCPPolyfill();
+        if (nativeModelContextDescriptor) {
+            Object.defineProperty(Document.prototype, 'modelContext', nativeModelContextDescriptor);
+        }
         if (removeDom) {
             removeDom();
         }
```

---

### Incident Patch 6: `50e76537` (2026-10-02)
**Commit Message**: Docs: render articles as blog posts, add "RxDB in the Press" and brand guidelines pages (#9170)

* docs: render articles as blog posts, add RxDB Library and logo page

- Pages under docs/articles/ get an author byline below the H1 with
  publish date, update date and reading time. Dates come from git.
  Adds BlogPosting JSON-LD plus og:type=article and article:* meta tags
  so search and AI answer engines can attribute the articles.
- New /library/ page: curated list of papers, theses, books, news and
  talks that cite RxDB, with search, type filter and a submission form
  that opens a prefilled GitHub issue.
- New /logo/ page with logo downloads, usage rules and brand colors.
- Footer links to both new pages.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01RaGTDEgzXRzU8Xrz1vyzfE

* codespell: ignore "theses" and the author name "Musil"

Both appear on the new /library/ page and are false positives.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01RaGTDEgzXRzU8Xrz1vyzfE

* library: replace en dash in a citation title to pass the dash check

Co-Authored-By: Claude Opus 5.5 <[REDA

**File**: `config/codespellignore.txt` (modified, +2/-0)
```diff
@@ -4,3 +4,5 @@ nin
 shouldBe
 Guage
 guage
+musil
+theses
```

**File**: `docs-src/docusaurus.config.ts` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@ import rehypePrettyCode from 'rehype-pretty-code';
 import type { Options as RehypePrettyCodeOptions, Theme } from 'rehype-pretty-code';
 import { createCssVariablesTheme, ThemeRegistrationAny } from 'shiki';
 import { EU_EEA_REGION_CODES } from './src/theme/eu-consent';
+import remarkArticleByline from './src/remark/article-byline';
 
 /**
  * The RxDB version from the root package.json, used for the
@@ -405,6 +406,7 @@ Topic-specific documentation files:
                     path: './docs',
                     showLastUpdateTime: true,
                     breadcrumbs: false,
+                    remarkPlugins: [remarkArticleByline],
                     // I disabled the editUrl because it just confuses users and does not look professional
                     // editUrl: 'https://github.com/pubkey/rxdb/tree/master/docs-src/',
                     beforeDefaultRehypePlugins: [
```

**File**: `docs-src/src/components/article-byline.tsx` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+import React from 'react';
+import Head from '@docusaurus/Head';
+import useBaseUrl from '@docusaurus/useBaseUrl';
+import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
+import { useDoc } from '@docusaurus/plugin-content-docs/client';
+import { JsonLd } from './json-ld';
+
+/**
+ * The author of the articles under docs/articles/.
+ * Used for the visible byline and for the schema.org Person in the JSON-LD.
+ */
+export const ARTICLE_AUTHOR = {
+    name: 'Daniel Meyer',
+    jobTitle: 'Creator of RxDB',
+    url: 'https://github.com/pubkey',
+    image: 'https://rxdb.info/files/authors/daniel-meyer.jpg',
+    avatar: '/files/authors/daniel-meyer.jpg',
+    sameAs: [
+        'https://github.com/pubkey',
+        'https://www.linkedin.com/in/danielmeyerdev',
+    ],
+} as const;
+
+type ArticleBylineProps = {
+    /**
+     * ISO day of the commit that added the article, set by src/remark/article-byline.ts.
+     */
+    published?: string;
+    /**
+     * ISO day of the last commit that changed the article.
+     */
+    modified?: string;
+    readingMinutes?: string;
+    wordCount?: string;
+};
+
+/**
+ * Formats in UTC so server render and hydration produce the same string.
+ */
+function formatDay(isoDay: string): string {
+    return new Date(isoDay + 'T00:00:00Z').toLocaleDateString('en-US', {
+        year: 'numeric',
+        month: 'long',
+        day: 'numeric',
+        timeZone: 'UTC',
+    });
+}
+
+/**
+ * Renders an article like a blog post: author byline with publish and update
+ * dates plus the BlogPosting structured data and the article meta tags.
+ * Inserted automatically below the H1 of every page in docs/articles/.
+ */
+export function ArticleByline(props: ArticleBylineProps) {
+    const { metadata, frontMatter } = useDoc();
+    const { siteConfig } = useDocusaurusContext();
+    const pageUrl = siteConfig.url + metadata.permalink;
+    const imagePath = (frontMatter as { image?: string; }).image;
+    const imageUrl = useBaseUrl(imagePath ?? '', { absolute: true });
+
+    const published = props.published;
+    const modified = props.modified ?? published;
+    const showUpdated = !!modified && modified !== published;
+
+    const authorJsonLd = {
+        '@type': 'Person',
+        name: ARTICLE_AUTHOR.name,
+        jobTitle: ARTICLE_AUTHOR.jobTitle,
+        url: ARTICLE_AUTHOR.url,
+        image: ARTICLE_AUTHOR.image,
+        sameAs: ARTICLE_AUTHOR.sameAs,
+    };
+    const blogPostingJsonLd = {
+        '@context': 'https://schema.org',
+        '@type': 'BlogPosting',
+        headline: metadata.title,
+        description: metadata.description,
+        url: pageUrl,
+        mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
+        ...(imagePath ? { image: imageUrl } : {}),
+        ...(published ? { datePublished: published } : {}),
+        ...(modified ? { dateModified: modified } : {}),
+        ...(props.wordCount ? { wordCount: parseInt(props.wordCount, 10) } : {}),
+        inLanguage: 'en',
+        author: authorJsonLd,
+        publisher: {
+            '@type': 'Organization',
+            name: 'RxDB',
+            url: 'https://rxdb.info',
+            logo: {
+                '@type': 'ImageObject',
+                url: 'https://rxdb.info/files/logo/logo.svg',
+            },
+        },
+    };
+
+    return (
+        <>
+            <Head>
+                <meta property="og:type" content="article" />
+                <meta name="author" content={ARTICLE_AUTHOR.name} />
+                <meta property="article:author" content={ARTICLE_AUTHOR.url} />
+                {published && <meta property="article:published_time" content={published} />}
+                {modified && <meta property="article:modified_time" content={modified} />}
+            </Head>
+            <JsonLd data={blogPostingJsonLd} />
+            <div className="article-byline">
+                <img
+                    className="article-byline-avatar"
+                    src={ARTICLE_AUTHOR.avatar}
+                    alt={ARTICLE_AUTHOR.name}
+                    width={44}
+                    height={44}
+                    loading="lazy"
+                />
+                <div className="article-byline-text">
+                    <div className="article-byline-author">
+                        <a href={ARTICLE_AUTHOR.url} rel="author" target="_blank">{ARTICLE_AUTHOR.name}</a>
+                        <span className="article-byline-role">{ARTICLE_AUTHOR.jobTitle}</span>
+                    </div>
+                    <div className="article-byline-meta">
+                        {published && (
+                            <span>Published <time dateTime={published}>{formatDay(published)}</time></span>
+                        )}
+                        {showUpdated && (
+                            <span>Updated <time dateTime={modified}>{formatDay(modified)}</time></span>
+                        )}
+                     
```

**File**: `docs-src/src/components/press-data.ts` (added, +279/-0)
```diff
@@ -0,0 +1,279 @@
+export type CitationType = 'paper' | 'thesis' | 'book' | 'news' | 'article' | 'talk' | 'video' | 'podcast' | 'report';
+
+export const CITATION_TYPE_LABELS: Record<CitationType, string> = {
+    paper: 'Research Paper',
+    thesis: 'Thesis',
+    book: 'Book',
+    news: 'News',
+    article: 'Article',
+    talk: 'Talk',
+    video: 'Video',
+    podcast: 'Podcast',
+    report: 'Report',
+};
+
+export type Citation = {
+    title: string;
+    /**
+     * Author, publisher, journal or conference.
+     */
+    source: string;
+    type: CitationType;
+    /**
+     * As precise as known: YYYY, YYYY-MM or YYYY-MM-DD.
+     */
+    date: string;
+    url: string;
+    /**
+     * One sentence about how the publication covers or uses RxDB.
+     */
+    summary: string;
+};
+
+/**
+ * Third-party publications that cite or mention RxDB, newest first.
+ * Rendered on the "RxDB in the Press" page at /press/. New entries come in via the form on that page,
+ * which opens a GitHub issue with the "[Press]" title prefix.
+ */
+export const CITATIONS: Citation[] = [
+    {
+        'title': 'Offline-First Mobile Apps: Designing for Unreliable Connectivity',
+        'source': 'Mehran Khan, Cubix',
+        'type': 'article',
+        'date': '2026-09-24',
+        'url': 'https://www.cubix.co/blog/offline-first-mobile-apps-connectivity/',
+        'summary': 'Lists RxDB with Redux Offline and PouchDB as libraries that handle queuing, caching, and sync for offline-first mobile apps.'
+    },
+    {
+        'title': 'Why Fetch When You Can Sync? Building Local-First Apps on a Sync Engine Architecture',
+        'source': 'James Arthur, QCon San Francisco 2025 (InfoQ)',
+        'type': 'talk',
+        'date': '2026-08-20',
+        'url': 'https://www.infoq.com/presentations/local-first-sync-engine/',
+        'summary': 'Conference talk that names RxDB among local-first sync engines and among third-party collection implementations for TanStack DB.'
+    },
+    {
+        'title': 'Web Development Tools - 8 innovative Optionen',
+        'source': 'Matthew Tyson, Computerwoche',
+        'type': 'news',
+        'date': '2026-06-16',
+        'url': 'https://www.computerwoche.de/article/4183646/web-development-tools-8-innovative-optionen.html',
+        'summary': 'German edition of the InfoWorld article, describing RxDB as a NoSQL, offline-first, reactive local-first datastore.'
+    },
+    {
+        'title': '8 web development tools reimagining web development',
+        'source': 'Matthew Tyson, InfoWorld',
+        'type': 'news',
+        'date': '2026-06-09',
+        'url': 'https://www.infoworld.com/article/4181872/8-web-development-tools-reimagining-web-development.html',
+        'summary': 'Mentions RxDB next to PowerSync as a NoSQL, offline-first, reactive database that exposes queries as observable streams.'
+    },
+    {
+        'title': 'Local-First Software for SaaS Builders: Honest Guide 2026',
+        'source': 'BuildMVP Fast',
+        'type': 'article',
+        'date': '2026-05',
+        'url': 'https://www.buildmvpfast.com/blog/local-first-software-saas-rxdb-pouchdb-sync-2026',
+        'summary': 'Compares RxDB with PouchDB, Zero, PowerSync, and ElectricSQL for building local-first SaaS products.'
+    },
+    {
+        'title': 'RxDB 17: Sync without server, access for AI agents',
+        'source': 'Moritz Förster, heise online (iX)',
+        'type': 'news',
+        'date': '2026-04-01',
+        'url': 'https://www.heise.de/en/news/RxDB-17-Sync-without-server-access-for-AI-agents-11242448.html',
+        'summary': 'News article on the RxDB 17 release, covering serverless cloud sync, AI agent access, and the limits of cloud storage sync.'
+    },
+    {
+        'title': 'Why local-first matters for JavaScript',
+        'source': 'Matthew Tyson, InfoWorld',
+        'type': 'news',
+        'date': '2026-03-06',
+        'url': 'https://www.infoworld.com/article/4140812/why-local-first-matters-for-javascript.html',
+        'summary': 'Names RxDB and PGlite as local databases developers use to build data storage directly in the browser.'
+    },
+    {
+        'title': 'The browser is your database: Local-first comes of age',
+        'source': 'Matthew Tyson, InfoWorld',
+        'type': 'news',
+        'date': '2026-02-26',
+        'url': 'https://www.infoworld.com/article/4133648/the-browser-is-your-database-local-first-comes-of-age.html',
+        'summary': 'Feature with a dedicated section on RxDB as the NoSQL counterpart to PGlite, including a reactive query code sample.'
+    },
+    {
+        'title': 'RxDB: Reactive NoSQL Database for Local-First Applications',
+        'source': 'DevRadar Open Research',
+        'type': 'article',
+        'date': '2026-01',
+        'url': 'https://devradar-dev.github.io/open-research/databases/rxdb/',
+        'summary': 'Profile page describing RxDB as a reactive NoSQL database for local-first applications.'
```

**File**: `docs-src/src/css/custom.css` (modified, +37/-0)
```diff
@@ -3991,3 +3991,40 @@ pre[data-theme] span[style*="--shiki-token-keyword"] {
 .rxdb-timeline li>p:first-child>strong:first-child {
     color: var(--color-top);
 }
+
+/* Author byline below the H1 of pages in docs/articles/ */
+.article-byline {
+    display: flex;
+    align-items: center;
+    gap: 12px;
+    margin: -8px 0 28px 0;
+    padding-bottom: 16px;
+    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
+    font-size: 0.9rem;
+}
+
+.article-byline-avatar {
+    width: 44px;
+    height: 44px;
+    border-radius: 50%;
+    flex-shrink: 0;
+}
+
+.article-byline-author a {
+    color: var(--fontColor-offwhite);
+    font-weight: 600;
+}
+
+.article-byline-role,
+.article-byline-meta {
+    color: var(--expo-theme-text-secondary, #b0b0b0);
+}
+
+.article-byline-role {
+    margin-left: 8px;
+}
+
+.article-byline-meta span:not(:last-child)::after {
+    content: '·';
+    margin: 0 8px;
+}
```

**File**: `docs-src/src/pages/brand-guidelines.tsx` (added, +256/-0)
```diff
@@ -0,0 +1,256 @@
+import Head from '@docusaurus/Head';
+import Layout from '@theme/Layout';
+import React from 'react';
+
+type LogoAsset = {
+    title: string;
+    file: string;
+    usage: string;
+    width: number;
+    height: number;
+    formats: { label: string; href: string; }[];
+    background: 'dark' | 'light';
+};
+
+const LOGOS: LogoAsset[] = [
+    {
+        title: 'Logo with Wordmark',
+        file: '/files/logo/logo_text_white.svg',
+        usage: 'The default logo. Use it on dark backgrounds, for example in headers, slides, and footers.',
+        width: 394,
+        height: 140,
+        formats: [
+            { label: 'SVG', href: '/files/logo/logo_text_white.svg' },
+            { label: 'PNG', href: '/files/logo/png/logo_text_white.png' },
+        ],
+        background: 'dark',
+    },
+    {
+        title: 'Logo with Wordmark (Outlined)',
+        file: '/files/logo/logo_text.svg',
+        usage: 'Use it on light or colored backgrounds where the white wordmark would not be readable.',
+        width: 226,
+        height: 140,
+        formats: [
+            { label: 'SVG', href: '/files/logo/logo_text.svg' },
+            { label: 'PNG', href: '/files/logo/png/logo_text.png' },
+        ],
+        background: 'light',
+    },
+    {
+        title: 'Icon',
+        file: '/files/logo/logo.svg',
+        usage: 'Use it where space is limited, for example as an avatar, favicon, app icon, or in a list of technologies.',
+        width: 103,
+        height: 140,
+        formats: [
+            { label: 'SVG', href: '/files/logo/logo.svg' },
+            { label: 'PNG', href: '/files/logo/png/logo.png' },
+            { label: 'ICO', href: '/files/logo/icon.ico' },
+        ],
+        background: 'dark',
+    },
+    {
+        title: 'Logo with Claim',
+        file: '/files/logo/rxdb_javascript_database.svg',
+        usage: 'Use it when your readers do not know RxDB yet, for example in articles, talks, and comparison tables.',
+        width: 282,
+        height: 140,
+        formats: [
+            { label: 'SVG', href: '/files/logo/rxdb_javascript_database.svg' },
+            { label: 'PNG', href: '/files/logo/png/rxdb_javascript_database.png' },
+        ],
+        background: 'dark',
+    },
+];
+
+const COLORS = [
+    { name: 'RxDB Pink', hex: '#ED168F' },
+    { name: 'RxDB Magenta', hex: '#B2218B' },
+    { name: 'RxDB Purple', hex: '#752A8A' },
+    { name: 'Background Dark', hex: '#0D0F18' },
+    { name: 'White', hex: '#FFFFFF' },
+];
+
+const ALLOWED = [
+    'Show that your project, product, or company uses RxDB, for example in a "Built with RxDB" section or a list of technologies.',
+    'Illustrate articles, blog posts, tutorials, books, videos, and conference talks about RxDB.',
+    'Add RxDB to comparison tables and overviews of databases and sync engines.',
+    'Link the logo to https://rxdb.info/ when you use it on a website.',
+];
+
+const NOT_ALLOWED = [
+    'Change the colors, proportions, or shapes of the logo, or add effects like shadows, outlines, or gradients.',
+    'Rotate, stretch, or crop the logo, or place it on a background where it is hard to read.',
+    'Use the logo or the name "RxDB" as part of your own product name, logo, domain, or app icon.',
+    'Use the logo in a way that suggests RxDB sponsors, endorses, or partners with you, unless there is a written agreement.',
+    'Sell merchandise with the logo without asking first.',
+];
+
+const styles = {
+    grid: {
+        display: 'grid',
+        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
+        gap: 24,
+        marginTop: 24,
+        marginBottom: 48,
+    },
+    card: {
+        border: '1px solid rgba(255, 255, 255, 0.12)',
+        borderRadius: 8,
+        overflow: 'hidden',
+        display: 'flex',
+        flexDirection: 'column',
+    },
+    preview: {
+        height: 180,
+        display: 'flex',
+        alignItems: 'center',
+        justifyContent: 'center',
+        padding: 24,
+    },
+    cardBody: {
+        padding: 16,
+        flexGrow: 1,
+    },
+    downloads: {
+        display: 'flex',
+        gap: 12,
+        flexWrap: 'wrap',
+    },
+    swatch: {
+        width: '100%',
+        height: 72,
+        borderRadius: 6,
+        border: '1px solid rgba(255, 255, 255, 0.2)',
+    },
+} as const;
+
+export default function BrandGuidelinesPage() {
+    return (
+        <>
+            <Head>
+                <body className="homepage" />
+            </Head>
+            <Layout
+                title="RxDB Brand Guidelines - Logo Downloads and Usage Rules"
+                description="Download the RxDB logo as SVG or PNG and learn how you can use it in articles, talks, and 'Built with RxDB' sections."
+            >
+                <main>
+                    <div className="block first">
+                        <div className="content">
+                            <h1>RxDB Brand Guidelines</h1>
+                 
```

**File**: `docs-src/src/pages/press.tsx` (added, +241/-0)
```diff
@@ -0,0 +1,241 @@
+import Head from '@docusaurus/Head';
+import Layout from '@theme/Layout';
+import React, { useState } from 'react';
+import { CITATIONS, CITATION_TYPE_LABELS, type CitationType } from '../components/press-data';
+import { JsonLd } from '../components/json-ld';
+
+const NEW_ISSUE_URL = 'https://github.com/pubkey/rxdb/issues/new';
+
+const styles = {
+    filters: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0 24px 0' },
+    list: { listStyle: 'none', padding: 0 },
+    item: {
+        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
+        padding: '16px 0',
+    },
+    meta: { fontSize: '0.85rem', color: 'var(--expo-theme-text-secondary, #b0b0b0)' },
+    tag: {
+        display: 'inline-block',
+        fontSize: '0.75rem',
+        padding: '2px 8px',
+        borderRadius: 4,
+        border: '1px solid var(--color-top)',
+        marginRight: 8,
+    },
+    form: { display: 'grid', gap: 12, maxWidth: 640 },
+    input: {
+        width: '100%',
+        padding: 8,
+        borderRadius: 4,
+        border: '1px solid rgba(255, 255, 255, 0.3)',
+        background: 'rgba(255, 255, 255, 0.06)',
+        color: 'var(--fontColor-offwhite)',
+        fontSize: '1rem',
+    },
+} as const;
+
+function FilterButton(props: { active: boolean; onClick: () => void; children: React.ReactNode; }) {
+    return (
+        <button
+            type="button"
+            onClick={props.onClick}
+            className={'button' + (props.active ? '' : ' light')}
+            style={{
+                cursor: 'pointer',
+                padding: '4px 12px',
+                borderRadius: 4,
+                border: '1px solid var(--color-top)',
+                background: props.active ? 'var(--color-top)' : 'transparent',
+                color: 'var(--fontColor-offwhite)',
+            }}
+        >
+            {props.children}
+        </button>
+    );
+}
+
+function SubmitSourceForm() {
+    const [title, setTitle] = useState('');
+    const [url, setUrl] = useState('');
+    const [type, setType] = useState<CitationType>('article');
+    const [source, setSource] = useState('');
+    const [date, setDate] = useState('');
+    const [context, setContext] = useState('');
+
+    function onSubmit(event: React.FormEvent) {
+        event.preventDefault();
+        const body = [
+            'A publication that cites or mentions RxDB, for the list at https://rxdb.info/press/',
+            '',
+            '- **Title**: ' + title,
+            '- **URL**: ' + url,
+            '- **Type**: ' + CITATION_TYPE_LABELS[type],
+            '- **Author / Publisher**: ' + source,
+            '- **Date**: ' + date,
+            '',
+            '**How RxDB is mentioned:**',
+            '',
+            context,
+        ].join('\n');
+        const issueUrl = NEW_ISSUE_URL +
+            '?title=' + encodeURIComponent('[Press] ' + title) +
+            '&body=' + encodeURIComponent(body);
+        window.open(issueUrl, '_blank', 'noopener');
+    }
+
+    return (
+        <form onSubmit={onSubmit} style={styles.form}>
+            <label>
+                Title of the publication *
+                <input style={styles.input} required value={title} onChange={e => setTitle(e.target.value)} />
+            </label>
+            <label>
+                URL *
+                <input style={styles.input} type="url" required placeholder="https:// (for example a YouTube link)" value={url} onChange={e => setUrl(e.target.value)} />
+            </label>
+            <label>
+                Type
+                <select style={styles.input} value={type} onChange={e => setType(e.target.value as CitationType)}>
+                    {(Object.keys(CITATION_TYPE_LABELS) as CitationType[]).map(key => (
+                        <option key={key} value={key}>{CITATION_TYPE_LABELS[key]}</option>
+                    ))}
+                </select>
+            </label>
+            <label>
+                Author, publisher, journal or conference *
+                <input style={styles.input} required value={source} onChange={e => setSource(e.target.value)} />
+            </label>
+            <label>
+                Publication date
+                <input style={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
+            </label>
+            <label>
+                How is RxDB mentioned or used? *
+                <textarea style={{ ...styles.input, minHeight: 100 }} required value={context} onChange={e => setContext(e.target.value)} />
+            </label>
+            <div>
+                <button type="submit" className="button" style={{ cursor: 'pointer' }}>
+                    Submit via GitHub
+                </button>
+            </div>
+            <p style={styles.meta}>
+                Submitting opens a prefilled GitHub issue in a new tab, which you then have to confirm.
+                Every submission is reviewed before it is added to the 
```

**File**: `docs-src/src/remark/article-byline.ts` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+import { execFileSync } from 'node:child_process';
+import path from 'node:path';
+
+/**
+ * Remark plugin that renders every page under docs/articles/ like a blog post.
+ * It inserts the <ArticleByline /> component directly below the H1 and passes
+ * the publish date, the last modification date and the reading time.
+ *
+ * The dates come from git so they never have to be maintained by hand:
+ * - published: the author date of the commit that added the file (following renames)
+ * - modified: the author date of the last commit that touched the file
+ *
+ * In a shallow clone the oldest available commit is not the real one, so the
+ * publish date is left out instead of rendering a wrong one. The docs:build
+ * script unshallows the repository before building.
+ */
+
+const ARTICLES_DIR = path.sep + path.join('docs', 'articles') + path.sep;
+const WORDS_PER_MINUTE = 200;
+
+type MdastNode = {
+    type: string;
+    depth?: number;
+    value?: string;
+    children?: MdastNode[];
+    [key: string]: unknown;
+};
+
+type VFileLike = {
+    path?: string;
+    history?: string[];
+};
+
+let isShallowRepository: boolean | undefined;
+function isShallow(cwd: string): boolean {
+    if (typeof isShallowRepository === 'undefined') {
+        try {
+            isShallowRepository = git(cwd, ['rev-parse', '--is-shallow-repository']) === 'true';
+        } catch {
+            isShallowRepository = true;
+        }
+    }
+    return isShallowRepository;
+}
+
+function git(cwd: string, args: string[]): string {
+    return execFileSync('git', args, {
+        cwd,
+        encoding: 'utf-8',
+        stdio: ['ignore', 'pipe', 'ignore'],
+    }).trim();
+}
+
+function toIsoDay(gitDate: string | undefined): string | undefined {
+    if (!gitDate) {
+        return undefined;
+    }
+    const match = /^(\d{4}-\d{2}-\d{2})/.exec(gitDate);
+    return match ? match[1] : undefined;
+}
+
+export function getArticleDates(filePath: string): { published?: string; modified?: string; } {
+    const cwd = path.dirname(filePath);
+    const fileName = path.basename(filePath);
+    try {
+        const modified = toIsoDay(git(cwd, ['log', '-1', '--format=%aI', '--', fileName]));
+        let published: string | undefined;
+        if (!isShallow(cwd)) {
+            const added = git(cwd, ['log', '--follow', '--diff-filter=A', '--format=%aI', '--', fileName])
+                .split('\n')
+                .filter(Boolean);
+            published = toIsoDay(added[added.length - 1]);
+        }
+        return { published, modified };
+    } catch {
+        return {};
+    }
+}
+
+function countWords(node: MdastNode): number {
+    let words = 0;
+    if (typeof node.value === 'string' && (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code')) {
+        words += node.value.split(/\s+/).filter(Boolean).length;
+    }
+    if (node.children) {
+        for (const child of node.children) {
+            words += countWords(child);
+        }
+    }
+    return words;
+}
+
+function attribute(name: string, value: string) {
+    return { type: 'mdxJsxAttribute', name, value };
+}
+
+export default function remarkArticleByline() {
+    return (tree: MdastNode, file: VFileLike) => {
+        const filePath = file.path ?? file.history?.[0];
+        if (!filePath || !filePath.includes(ARTICLES_DIR) || !tree.children) {
+            return;
+        }
+
+        const { published, modified } = getArticleDates(filePath);
+        const wordCount = countWords(tree);
+        const readingMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
+
+        const attributes = [
+            attribute('readingMinutes', String(readingMinutes)),
+            attribute('wordCount', String(wordCount)),
+        ];
+        if (published) {
+            attributes.push(attribute('published', published));
+        }
+        if (modified) {
+            attributes.push(attribute('modified', modified));
+        }
+
+        const bylineNode: MdastNode = {
+            type: 'mdxJsxFlowElement',
+            name: 'ArticleByline',
+            attributes,
+            children: [],
+        };
+
+        const h1Index = tree.children.findIndex(node => node.type === 'heading' && node.depth === 1);
+        tree.children.splice(h1Index === -1 ? 0 : h1Index + 1, 0, bylineNode);
+    };
+}
```

---

### Incident Patch 7: `8b524a8e` (2026-10-01)
**Commit Message**: FIX query-builder where(object) crash on selector shorthand values (#9164)

`find({ selector: { age: 7 } }).where({ age: { $gt: 3 } })` threw
`TypeError: Cannot create property '$gt' on number '7'` because merge()
tried to write operator keys into the primitive shorthand value. The
other direction, `.where({ age: 7 })` on `{ age: { $lt: 7 } }`, silently
dropped the existing operator. Shorthand values are now converted to
`$eq` before merging so both conditions are kept.


Claude-Session: https://claude.ai/code/session_01X2QtntH1oQFALEFRLoWt6R

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/changelog/fix-query-builder-where-object-shorthand-merge.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX query-builder: `.where({ age: { $gt: 3 } })` on a query whose selector had a shorthand value for the same field (for example `find({ selector: { age: 7 } })`) threw `TypeError: Cannot create property '$gt' on number '7'`. In the other direction, `.where({ age: 7 })` silently dropped an existing operator like `{ $lt: 7 }`. The shorthand value is now converted to `$eq` so both conditions are merged. Added a test case in `test/unit/query-builder.test.ts`.
```

**File**: `src/plugins/query-builder/mquery/nosql-query-builder.ts` (modified, +38/-3)
```diff
@@ -333,8 +333,9 @@ export class NoSqlQueryBuilderClass<DocType> {
         if (source instanceof NoSqlQueryBuilderClass) {
             // if source has a feature, apply it to ourselves
 
-            if (source._conditions)
-                merge(this._conditions, source._conditions);
+            if (source._conditions) {
+                merge(this._conditions, normalizeShorthandsBeforeMerge(this._conditions, source._conditions));
+            }
 
             if (source._fields) {
                 if (!this._fields) this._fields = {};
@@ -353,7 +354,7 @@ export class NoSqlQueryBuilderClass<DocType> {
         }
 
         // plain object
-        merge(this._conditions, source);
+        merge(this._conditions, normalizeShorthandsBeforeMerge(this._conditions, source));
 
         return this as any;
     }
@@ -583,6 +584,40 @@ function _pushArr(opts: any, field: string, value: any) {
 }
 
 
+function isOperatorObject(value: any): boolean {
+    return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
+
+/**
+ * A selector field can either have a shorthand value like { age: 5 }
+ * or an operator object like { age: { $gt: 3 } }.
+ * When one side of a merge has the shorthand and the other side
+ * has the operator object, the shorthand is converted to { $eq: value }
+ * so that both conditions can be merged into the same operator object.
+ * Returns a flat copy of the source so the input object is not mutated.
+ */
+function normalizeShorthandsBeforeMerge(conditions: any, source: any): any {
+    const ret = { ...source };
+    Object.keys(ret).forEach(field => {
+        if (field.startsWith('$')) {
+            return;
+        }
+        const existing = conditions[field];
+        const incoming = ret[field];
+        if (existing === undefined || incoming === undefined) {
+            return;
+        }
+        const existingIsOperator = isOperatorObject(existing);
+        const incomingIsOperator = isOperatorObject(incoming);
+        if (existingIsOperator && !incomingIsOperator) {
+            ret[field] = { $eq: incoming };
+        } else if (!existingIsOperator && incomingIsOperator) {
+            conditions[field] = { $eq: existing };
+        }
+    });
+    return ret;
+}
+
 /**
  * Determines if `conds` can be merged using `mquery().merge()`
  */
```

**File**: `test/unit/query-builder.test.ts` (modified, +42/-3)
```diff
@@ -1,13 +1,18 @@
 import assert from 'assert';
 
-import type {
-    MangoQuery
+import {
+    addRxPlugin,
+    type MangoQuery
 } from '../../plugins/core/index.mjs';
 
 import {
     NoSqlQueryBuilder,
-    createQueryBuilder
+    createQueryBuilder,
+    RxDBQueryBuilderPlugin
 } from '../../plugins/query-builder/index.mjs';
+addRxPlugin(RxDBQueryBuilderPlugin);
+
+import { humansCollection } from '../../plugins/test-utils/index.mjs';
 
 import './config.ts';
 
@@ -180,4 +185,38 @@ describe('query-builder.test.js', () => {
             });
         });
     });
+    describe('RxQuery', () => {
+        it('should merge an operator into a selector shorthand value via .where(object)', async () => {
+            const c = await humansCollection.create(0);
+            await c.bulkInsert([
+                { passportId: 'a', firstName: 'Alice', lastName: 'A', age: 5 },
+                { passportId: 'b', firstName: 'Bob', lastName: 'B', age: 7 },
+                { passportId: 'c', firstName: 'Carol', lastName: 'C', age: 7 }
+            ]);
+
+            const shorthandFirst = await c.find({
+                selector: {
+                    age: 7
+                }
+            }).where({
+                age: {
+                    $gt: 3
+                }
+            }).exec();
+            assert.deepStrictEqual(shorthandFirst.map(d => d.passportId), ['b', 'c']);
+
+            const operatorFirst = await c.find({
+                selector: {
+                    age: {
+                        $lt: 7
+                    }
+                }
+            }).where({
+                age: 7
+            }).exec();
+            assert.deepStrictEqual(operatorFirst.map(d => d.passportId), []);
+
+            c.database.close();
+        });
+    });
 });
```

---

### Incident Patch 8: `4208fa23` (2026-10-01)
**Commit Message**: FIX sort by nested field throws when the parent object is null (#9162)

objectPathMonad() only stopped at undefined values, so a query with
sort: [{ 'address.city': 'asc' }] threw
"TypeError: Cannot read properties of null" in the sort comparator
when a document had address: null. A null parent is now treated like
a missing one and the lookup returns undefined.


Claude-Session: https://claude.ai/code/session_01AjRSGo7kgznNrn9qF4KYuR

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/changelog/fix-sort-nested-field-null-parent.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX queries that sort by a nested field (for example `sort: [{ 'address.city': 'asc' }]`) threw `TypeError: Cannot read properties of null` when a document had `null` as the value of the parent object (`address: null`). The nested path lookup now treats a `null` parent like a missing one. Added a test case in `test/unit/rx-query.test.ts`.
```

**File**: `src/plugins/utils/utils-object.ts` (modified, +13/-13)
```diff
@@ -65,7 +65,7 @@ export function objectPathMonad<T, R = any>(objectPath: string): ObjectPathMonad
         const key1 = split[1];
         fn = (obj: T) => {
             const v = (obj as any)[key0];
-            return v === undefined ? v : v[key1];
+            return v === undefined || v === null ? undefined : v[key1];
         };
     } else if (splitLength === 3) {
         /**
@@ -77,9 +77,9 @@ export function objectPathMonad<T, R = any>(objectPath: string): ObjectPathMonad
         const key2 = split[2];
         fn = (obj: T) => {
             const v = (obj as any)[key0];
-            if (v === undefined) return v;
+            if (v === undefined || v === null) return undefined;
             const v2 = v[key1];
-            return v2 === undefined ? v2 : v2[key2];
+            return v2 === undefined || v2 === null ? undefined : v2[key2];
         };
     } else if (splitLength === 4) {
         /**
@@ -92,11 +92,11 @@ export function objectPathMonad<T, R = any>(objectPath: string): ObjectPathMonad
         const key3 = split[3];
         fn = (obj: T) => {
             const v = (obj as any)[key0];
-            if (v === undefined) return v;
+            if (v === undefined || v === null) return undefined;
             const v2 = v[key1];
-            if (v2 === undefined) return v2;
+            if (v2 === undefined || v2 === null) return undefined;
             const v3 = v2[key2];
-            return v3 === undefined ? v3 : v3[key3];
+            return v3 === undefined || v3 === null ? undefined : v3[key3];
         };
     } else if (splitLength === 5) {
         /**
@@ -110,22 +110,22 @@ export function objectPathMonad<T, R = any>(objectPath: string): ObjectPathMonad
         const key4 = split[4];
         fn = (obj: T) => {
             const v = (obj as any)[key0];
-            if (v === undefined) return v;
+            if (v === undefined || v === null) return undefined;
             const v2 = v[key1];
-            if (v2 === undefined) return v2;
+            if (v2 === undefined || v2 === null) return undefined;
             const v3 = v2[key2];
-            if (v3 === undefined) return v3;
+            if (v3 === undefined || v3 === null) return undefined;
             const v4 = v3[key3];
-            return v4 === undefined ? v4 : v4[key4];
+            return v4 === undefined || v4 === null ? undefined : v4[key4];
         };
     } else {
         fn = (obj: T) => {
             let currentVal: any = obj;
             for (let i = 0; i < splitLength; ++i) {
-                currentVal = currentVal[split[i]];
-                if (currentVal === undefined) {
-                    return currentVal;
+                if (currentVal === undefined || currentVal === null) {
+                    return undefined;
                 }
+                currentVal = currentVal[split[i]];
             }
             return currentVal;
         };
```

**File**: `test/unit/rx-query.test.ts` (modified, +81/-0)
```diff
@@ -2200,4 +2200,85 @@ describe('rx-query.test.ts', () => {
             c.database.close();
         });
     });
+    describe('sort by nested field', () => {
+        it('should not throw when a parent object of the sort field is null', async () => {
+            type DocType = {
+                id: string;
+                address: {
+                    city: string;
+                } | null;
+            };
+            const schema: RxJsonSchema<DocType> = {
+                version: 0,
+                primaryKey: 'id',
+                type: 'object',
+                properties: {
+                    id: {
+                        type: 'string',
+                        maxLength: 100
+                    },
+                    address: {
+                        type: ['object', 'null'],
+                        properties: {
+                            city: {
+                                type: 'string'
+                            }
+                        },
+                        required: ['city']
+                    }
+                },
+                required: ['id', 'address']
+            };
+            const db = await createRxDatabase({
+                name: randomToken(10),
+                storage: config.storage.getStorage()
+            });
+            const collections = await db.addCollections({
+                docs: {
+                    schema
+                }
+            });
+            const collection = collections.docs;
+            await collection.bulkInsert([
+                { id: 'a', address: { city: 'Tokyo' } },
+                { id: 'b', address: null },
+                { id: 'c', address: { city: 'Berlin' } }
+            ]);
+
+            const query = collection.find({
+                sort: [{ 'address.city': 'asc' }]
+            });
+            const results = await query.exec();
+            assert.deepStrictEqual(
+                results.map(d => d.id).sort(),
+                ['a', 'b', 'c']
+            );
+            assert.deepStrictEqual(
+                results.filter(d => d.address !== null).map(d => d.id),
+                ['c', 'a']
+            );
+
+            /**
+             * Inserting a document with a null parent object
+             * while the query is subscribed must also work.
+             */
+            const emitted: string[][] = [];
+            const sub = query.$.subscribe(docs => emitted.push(docs.map(d => d.id)));
+            await waitUntil(() => emitted.length === 1);
+            await collection.insert({ id: 'd', address: null });
+            await collection.insert({ id: 'e', address: { city: 'Amsterdam' } });
+            await waitUntil(() => {
+                const last = emitted[emitted.length - 1];
+                return last.length === 5;
+            });
+            const lastResult = await query.exec();
+            assert.deepStrictEqual(
+                lastResult.filter(d => d.address !== null).map(d => d.id),
+                ['e', 'c', 'a']
+            );
+
+            sub.unsubscribe();
+            await db.close();
+        });
+    });
 });
```

---

### Incident Patch 9: `be89887a` (2026-09-26)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.4.1 (#9135)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `examples/angular/android/build.gradle` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ buildscript {
         mavenCentral()
     }
     dependencies {
-        classpath 'com.android.tools.build:gradle:9.4.0'
+        classpath 'com.android.tools.build:gradle:9.4.1'
         classpath 'com.google.gms:google-services:4.5.0'
 
         // NOTE: Do not place your application dependencies here; they belong
```

**File**: `examples/flutter/android/build.gradle` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ buildscript {
     }
 
     dependencies {
-        classpath 'com.android.tools.build:gradle:9.4.0'
+        classpath 'com.android.tools.build:gradle:9.4.1'
         classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
     }
 }
```

---

### Incident Patch 10: `e6ced47a` (2026-09-25)
**Commit Message**: FIX WebRTC replication reliability (#9125)

* FIX WebRTC replication reliability

- Reconnect to the signaling server with exponential backoff instead of
  a tight loop, and handle socket errors so Node.js does not crash when
  the server is unreachable.
- Give peer connections a connect timeout, reconnect them with backoff
  from the initiator side only, and tag signals with a connectionId so
  signals of outdated attempts are ignored instead of throwing.
- Answer replication requests from one global message handler so the
  first request of a peer is not lost when it arrives before the own
  handshake finished.
- Let requests fail on disconnect, timeout (new requestTimeout option)
  and remote errors so the replication retries instead of hanging.
- Filter the master change stream by peer so that with 3+ peers the
  events of one master are not applied to other replications.
- Send a RESYNC when the change stream starts so no changes are missed.
- Split messages over the data channel size limit into chunks.
- Signaling server: notify the room when a peer leaves, fix the
  duplicate-join check, guard sends to closed sockets.
- Re-enable the WebRTC tests and add tests for unreachabl

**File**: `docs-src/docs/replication-webrtc.md` (modified, +20/-0)
```diff
@@ -222,6 +222,26 @@ const replicationPool = await replicateWebRTC(
 );
 ```
 
+## Connection Handling and Timeouts
+
+The simple-peer connection handler reconnects on its own when the connection to the signaling server or to another peer breaks. Reconnects run with an exponential backoff that starts at `500ms` and is capped at `15s`, so that an unreachable signaling server does not cause a busy loop. A peer connection that is not established within `15s` is dropped and a new attempt is started. Existing WebRTC connections keep replicating while the signaling server is offline.
+
+Messages that are bigger than the message size limit of the WebRTC data channel (which can be as low as `64 KiB` depending on the browser) are split into chunks, so you can replicate big documents.
+
+Each request to another peer fails when no answer arrives in time. The replication then retries after `retryTime`. You can change the timeout with the `requestTimeout` option:
+
+```ts
+const replicationPool = await replicateWebRTC(
+    {
+        /* ... */
+        // (optional) time in milliseconds [default=20000]
+        requestTimeout: 30000,
+        pull: {},
+        push: {}
+    }
+);
+```
+
 ## Conflict detection in WebRTC replication
 
 RxDB's conflict handling works by detecting and resolving conflicts that may arise when multiple clients in a decentralized database system attempt to modify the same data concurrently.
```

**File**: `orga/changelog/fix-webrtc-replication-reliability.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+- FIX WebRTC replication was flaky and could spin or stop syncing:
+  - The simple-peer connection handler reconnected to the signaling server in a tight loop without delay and crashed in Node.js when the server was not reachable. Reconnects now use an exponential backoff.
+  - A failed peer connection was recreated in an endless loop. Peer connections now have a connect timeout, reconnect with a backoff, and signals of outdated connection attempts are ignored instead of throwing.
+  - The first replication request of a peer could get lost when it arrived before the own handshake was done, which made the sync hang forever. Requests are now answered independently of the handshake state.
+  - Requests to a disconnected peer never resolved. They now fail on disconnect, on timeout (new `requestTimeout` option) and when the remote peer throws, so the replication retries.
+  - With three or more peers, change stream events of one master were applied to the replications of all other masters.
+  - Messages bigger than the data channel size limit failed. They are now split into chunks.
+  - The signaling server now tells the other peers of a room when a peer leaves.
+  - Re-enabled the WebRTC replication tests and added tests for an unreachable signaling server, a signaling server restart and big documents with three peers.
+  - `RxWebRTCReplicationPool.cancel()` now awaits the cancelation of all replications, so they do not write to the storage after the database was closed.
+- FIX replication-protocol: when the upstream had push conflicts, `persistToMaster()` wrote the resolved conflicts to the fork and meta instance even when the replication was canceled while the conflicts were resolved. This caused "already closed" errors when a database was closed during a replication.
```

**File**: `src/plugins/replication-webrtc/connection-handler-simple-peer.ts` (modified, +426/-119)
```diff
@@ -1,9 +1,8 @@
 import { Subject } from 'rxjs';
 import {
     ensureNotFalsy,
-    getFromMapOrThrow,
+    errorToPlainJson,
     PROMISE_RESOLVE_VOID,
-    promiseWait,
     randomToken
 } from '../../plugins/utils/index.ts';
 import type {
@@ -52,7 +51,13 @@ export type SimplePeerSignalMessage = {
     room: string;
     senderPeerId: string;
     receiverPeerId: string;
-    data: string;
+    data: any;
+    /**
+     * Identifies the connection attempt so that signals
+     * of outdated attempts are not mixed up with the current one.
+     * Optional because older RxDB versions do not send it.
+     */
+    connectionId?: string;
 };
 export type SimplePeerPingMessage = {
     type: 'ping';
@@ -66,8 +71,17 @@ export type PeerMessage =
     SimplePeerPingMessage;
 
 
-function sendMessage(ws: WebSocket, msg: PeerMessage) {
-    ws.send(JSON.stringify(msg));
+const WEBSOCKET_STATE_OPEN = 1;
+function sendMessage(ws: WebSocket | undefined, msg: PeerMessage): boolean {
+    if (!ws || ws.readyState !== WEBSOCKET_STATE_OPEN) {
+        return false;
+    }
+    try {
+        ws.send(JSON.stringify(msg));
+        return true;
+    } catch (err) {
+        return false;
+    }
 }
 
 const DEFAULT_SIGNALING_SERVER_HOSTNAME = 'signaling.rxdb.info';
@@ -122,6 +136,38 @@ export type SimplePeerConnectionHandlerOptions = {
 
 export const SIMPLE_PEER_PING_INTERVAL = 1000 * 60 * 2;
 
+/**
+ * If a peer connection is not established in this time,
+ * it is destroyed and a new connection attempt is started.
+ */
+export const SIMPLE_PEER_CONNECT_TIMEOUT = 1000 * 15;
+
+/**
+ * Min and max delay between reconnection attempts
+ * to the signaling server and to other peers.
+ * The delay doubles on each failed attempt.
+ */
+export const SIMPLE_PEER_RECONNECT_DELAY_MIN = 500;
+export const SIMPLE_PEER_RECONNECT_DELAY_MAX = 1000 * 15;
+
+/**
+ * Messages bigger than this are split into chunks
+ * because WebRTC data channels have a message size limit
+ * which can be as low as 64 KiB depending on the browser.
+ * The size is measured in string length and one character can
+ * be up to 3 bytes in UTF-8.
+ */
+export const SIMPLE_PEER_MAX_MESSAGE_LENGTH = 1024 * 16;
+
+type SimplePeerChunk = {
+    chunk: {
+        id: string;
+        index: number;
+        total: number;
+        data: string;
+    };
+};
+
 /**
  * Returns a connection handler that uses simple-peer and the signaling server.
  */
@@ -159,136 +205,356 @@ export function getConnectionHandlerSimplePeer({
         const response$ = new Subject<PeerWithResponse<SimplePeer>>();
         const error$ = new Subject<RxError | RxTypeError>();
 
-        const peers = new Map<string, SimplePeer>();
+        /**
+         * The current peer connection by remote peer id.
+         */
+        const peers = new Map<string, SimplePeerState>();
+        /**
+         * The ids of the other peers that are in the room,
+         * as reported by the signaling server.
+         */
+        let roomPeerIds = new Set<string>();
+        const peerReconnectDelay = new Map<string, number>();
+        const peerReconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
+
         let closed = false;
-        let ownPeerId: string;
+        let ownPeerId: string | undefined;
         let socket: WebSocket | undefined = undefined;
-        createSocket();
-
+        let socketReconnectDelay = SIMPLE_PEER_RECONNECT_DELAY_MIN;
+        let socketReconnectTimeout: ReturnType<typeof setTimeout> | undefined;
 
         /**
          * Send ping signals to the server.
          */
-        (async () => {
-            while (true) {
-                await promiseWait(SIMPLE_PEER_PING_INTERVAL / 2);
-                if (closed) {
-                    break;
+        const pingInterval = setInterval(() => {
+            sendMessage(socket, { type: 'ping' });
+        }, SIMPLE_PEER_PING_INTERVAL / 2);
+
+        type SimplePeerState = {
+            remotePeerId: string;
+            connectionId?: string;
+            initiator: boolean;
+            peer: SimplePeer;
+            connected: boolean;
+            ended: boolean;
+            connectTimeout?: ReturnType<typeof setTimeout>;
+            chunks: Map<string, string[]>;
+        };
+
+        function isInitiator(remotePeerId: string) {
+            return remotePeerId > ensureNotFalsy(ownPeerId);
+        }
+
+        function endPeer(state: SimplePeerState) {
+            if (state.ended) {
+                return;
+            }
+            state.ended = true;
+            if (state.connectTimeout) {
+                clearTimeout(state.connectTimeout);
+            }
+            if (peers.get(state.remotePeerId) === state) {
+                peers.delete(state.remotePeerId);
+            }
+            state.chunks.clear();
+            try {
+                state.peer.destroy();
+            } catch (err) { }
+            if (state.connected && !closed) {
+                disconnect$.next(state.peer);

```

**File**: `src/plugins/replication-webrtc/index.ts` (modified, +174/-70)
```diff
@@ -17,19 +17,23 @@ import type {
 } from '../../types/index.d.ts';
 import {
     ensureNotFalsy,
-    getFromMapOrThrow,
+    errorToPlainJson,
+    PROMISE_RESOLVE_TRUE,
+    PROMISE_RESOLVE_VOID,
     randomToken
 } from '../../plugins/utils/index.ts';
 import { RxDBLeaderElectionPlugin } from '../leader-election/index.ts';
 import { replicateRxCollection } from '../replication/index.ts';
 import {
     isMasterInWebRTCReplication,
-    sendMessageAndAwaitAnswer
+    sendMessageAndAwaitAnswer,
+    WEBRTC_DEFAULT_REQUEST_TIMEOUT
 } from './webrtc-helper.ts';
 import type {
     PeerWithMessage,
     PeerWithResponse,
     WebRTCConnectionHandler,
+    WebRTCMessage,
     WebRTCPeerState,
     WebRTCReplicationCheckpoint,
     WebRTCResponse,
@@ -39,6 +43,15 @@ import type {
 import { newRxError } from '../../rx-error.ts';
 
 
+/**
+ * The methods of the master replication handler
+ * that remote peers are allowed to call.
+ */
+const WEBRTC_MASTER_METHODS: string[] = [
+    'masterChangesSince',
+    'masterWrite'
+];
+
 export async function replicateWebRTC<RxDocType, PeerType>(
     options: SyncOptionsWebRTC<RxDocType, PeerType>
 ): Promise<RxWebRTCReplicationPool<RxDocType, PeerType>> {
@@ -75,24 +88,68 @@ export async function replicateWebRTC<RxDocType, PeerType>(
         options,
         await options.connectionHandlerCreator(options)
     );
+    const requestTimeout = options.requestTimeout ? options.requestTimeout : WEBRTC_DEFAULT_REQUEST_TIMEOUT;
+    const masterHandler = pool.masterReplicationHandler;
 
+    function sendToPeer(peer: PeerType, messageOrResponse: WebRTCMessage | WebRTCResponse) {
+        return Promise.resolve()
+            .then(() => pool.connectionHandler.send(peer, messageOrResponse))
+            .catch(() => {
+                /**
+                 * Sending fails when the peer disconnected in the meantime.
+                 * This is handled by the disconnect$ stream so it can be ignored here.
+                 */
+            });
+    }
 
     pool.subs.push(
         pool.connectionHandler.error$.subscribe((err: RxError | RxTypeError) => pool.error$.next(err)),
-        pool.connectionHandler.disconnect$.subscribe((peer: PeerType) => pool.removePeer(peer))
+        pool.connectionHandler.disconnect$.subscribe((peer: PeerType) => {
+            pool.connectedPeers.delete(peer);
+            pool.peerValidity.delete(peer);
+            pool.removePeer(peer);
+        })
     );
 
     /**
-     * Answer if someone requests our storage token
+     * Answer the requests of other peers.
+     * This is subscribed once for all peers
+     * and independent of which side is master,
+     * so that no request gets lost when the remote peer
+     * finishes its handshake before the own side has finished it.
      */
     pool.subs.push(
-        pool.connectionHandler.message$.pipe(
-            filter((data: PeerWithMessage<PeerType>) => data.message.method === 'token')
-        ).subscribe((data: PeerWithMessage<PeerType>) => {
-            pool.connectionHandler.send(data.peer, {
-                id: data.message.id,
-                result: storageToken
-            });
+        pool.connectionHandler.message$.subscribe(async (data: PeerWithMessage<PeerType>) => {
+            const { peer, message } = data;
+            if (message.method === 'token') {
+                sendToPeer(peer, {
+                    id: message.id,
+                    result: storageToken
+                });
+                return;
+            }
+            if (!WEBRTC_MASTER_METHODS.includes(message.method)) {
+                return;
+            }
+            const isValid = await pool.isPeerValid(peer);
+            if (!isValid || pool.canceled) {
+                return;
+            }
+            let response: WebRTCResponse;
+            try {
+                const result = await (masterHandler as any)[message.method](...message.params);
+                response = {
+                    id: message.id,
+                    result
+                };
+            } catch (err: any) {
+                response = {
+                    id: message.id,
+                    result: null,
+                    error: errorToPlainJson(err)
+                };
+            }
+            sendToPeer(peer, response);
         })
     );
 
@@ -101,11 +158,10 @@ export async function replicateWebRTC<RxDocType, PeerType>(
             filter(() => !pool.canceled)
         )
         .subscribe(async (peer: PeerType) => {
-            if (options.isPeerValid) {
-                const isValid = await options.isPeerValid(peer);
-                if (!isValid) {
-                    return;
-                }
+            pool.connectedPeers.add(peer);
+            const isValid = await pool.isPeerValid(peer);
+            if (!isValid || !pool.isPeerConnected(peer)) {
+                return;
             }
 
             let peerToken: string;
@@ -117,60 +173,47 @@ export async function rep
```

**File**: `src/plugins/replication-webrtc/signaling-server.ts` (modified, +41/-18)
```diff
@@ -61,17 +61,41 @@ export async function startSignalingServerSimplePeer(
     function disconnectSocket(peerId: string, reason: string) {
         console.log('# disconnect peer ' + peerId + ' reason: ' + reason);
         const peer = peerById.get(peerId);
+        peerById.delete(peerId);
         if (peer) {
-            peer.socket.close && peer.socket.close(undefined, reason);
+            try {
+                peer.socket.close && peer.socket.close(undefined, reason);
+            } catch (err) { }
             peer.rooms.forEach(roomId => {
                 const room = peersByRoom.get(roomId);
-                room?.delete(peerId);
-                if (room && room.size === 0) {
+                if (!room) {
+                    return;
+                }
+                room.delete(peerId);
+                if (room.size === 0) {
                     peersByRoom.delete(roomId);
+                } else {
+                    // tell the remaining peers about the new room state
+                    sendRoomState(room);
                 }
             });
         }
-        peerById.delete(peerId);
+    }
+
+    function sendRoomState(room: Set<string>) {
+        const otherPeerIds = Array.from(room);
+        room.forEach(otherPeerId => {
+            const otherPeer = peerById.get(otherPeerId);
+            if (otherPeer) {
+                sendMessage(
+                    otherPeer.socket,
+                    {
+                        type: 'joined',
+                        otherPeerIds
+                    }
+                );
+            }
+        });
     }
 
     wss.on('connection', function (ws: WebSocket) {
@@ -102,7 +126,13 @@ export async function startSignalingServerSimplePeer(
 
         ws.on('message', (msgEvent: any) => {
             peer.lastPing = Date.now();
-            const message = JSON.parse(msgEvent.toString());
+            let message: any;
+            try {
+                message = JSON.parse(msgEvent.toString());
+            } catch (err) {
+                disconnectSocket(peerId, 'invalid message');
+                return;
+            }
             const type = message.type;
             switch (type) {
                 case 'join':
@@ -115,7 +145,7 @@ export async function startSignalingServerSimplePeer(
                         return;
                     }
 
-                    if (peer.rooms.has(peerId)) {
+                    if (peer.rooms.has(roomId)) {
                         return;
                     }
                     peer.rooms.add(roomId);
@@ -130,18 +160,7 @@ export async function startSignalingServerSimplePeer(
                     room.add(peerId);
 
                     // tell everyone about new room state
-                    room.forEach(otherPeerId => {
-                        const otherPeer = peerById.get(otherPeerId);
-                        if (otherPeer) {
-                            sendMessage(
-                                otherPeer.socket,
-                                {
-                                    type: 'joined',
-                                    otherPeerIds: Array.from(room)
-                                }
-                            );
-                        }
-                    });
+                    sendRoomState(room);
                     break;
                 case 'signal':
                     if (
@@ -175,7 +194,11 @@ export async function startSignalingServerSimplePeer(
 }
 
 
+const WEBSOCKET_STATE_OPEN = 1;
 function sendMessage(ws: WebSocket, message: PeerMessage) {
+    if (ws.readyState !== WEBSOCKET_STATE_OPEN) {
+        return;
+    }
     const msgString = JSON.stringify(message);
     ws.send(msgString);
 }
```

**File**: `src/plugins/replication-webrtc/webrtc-helper.ts` (modified, +71/-15)
```diff
@@ -7,7 +7,9 @@ import type {
     WebRTCResponse,
     PeerWithResponse
 } from './webrtc-types.ts';
-import { filter, firstValueFrom, map } from 'rxjs';
+import { filter, map, Subscription } from 'rxjs';
+import { newRxError } from '../../rx-error.ts';
+import { errorToPlainJson } from '../utils/index.ts';
 
 
 
@@ -30,26 +32,80 @@ export async function isMasterInWebRTCReplication(
     return isMaster;
 }
 
+export const WEBRTC_DEFAULT_REQUEST_TIMEOUT = 1000 * 20;
+
 /**
  * Send a message to the peer and await the answer.
- * @throws with an EmptyErrorImpl if the peer connection
- * was closed before an answer was received.
+ * @throws with an RxError if the peer disconnected,
+ * the connection handler was closed,
+ * the remote peer responded with an error
+ * or no answer was received before the timeout.
  */
 export function sendMessageAndAwaitAnswer<PeerType>(
     handler: WebRTCConnectionHandler<PeerType>,
     peer: PeerType,
-    message: WebRTCMessage
+    message: WebRTCMessage,
+    timeout: number = WEBRTC_DEFAULT_REQUEST_TIMEOUT
 ): Promise<WebRTCResponse> {
-
-
     const requestId = message.id;
-    const answerPromise = firstValueFrom(
-        handler.response$.pipe(
-            filter((d: PeerWithResponse<PeerType>) => d.peer === peer),
-            filter((d: PeerWithResponse<PeerType>) => d.response.id === requestId),
-            map((d: PeerWithResponse<PeerType>) => d.response)
-        )
-    );
-    handler.send(peer, message);
-    return answerPromise;
+    return new Promise<WebRTCResponse>((res, rej) => {
+        let done = false;
+        let timeoutId: ReturnType<typeof setTimeout> | undefined;
+        const subs: Subscription[] = [];
+        function finish(fn: () => void) {
+            if (done) {
+                return;
+            }
+            done = true;
+            if (timeoutId) {
+                clearTimeout(timeoutId);
+            }
+            subs.forEach(sub => sub.unsubscribe());
+            fn();
+        }
+        function fail(errorText: string, error?: any) {
+            finish(() => rej(newRxError('RC_WEBRTC_PEER', {
+                errorText,
+                error,
+                args: {
+                    method: message.method,
+                    id: requestId
+                }
+            })));
+        }
+
+        subs.push(
+            handler.response$.pipe(
+                filter((d: PeerWithResponse<PeerType>) => d.peer === peer),
+                filter((d: PeerWithResponse<PeerType>) => d.response.id === requestId),
+                map((d: PeerWithResponse<PeerType>) => d.response)
+            ).subscribe({
+                next: (response: WebRTCResponse) => {
+                    if (response.error) {
+                        fail('remote peer responded with an error', response.error);
+                    } else {
+                        finish(() => res(response));
+                    }
+                },
+                complete: () => fail('connection handler closed')
+            }),
+            handler.disconnect$.pipe(
+                filter((p: PeerType) => p === peer)
+            ).subscribe({
+                next: () => fail('peer disconnected'),
+                complete: () => fail('connection handler closed')
+            })
+        );
+        if (done) {
+            subs.forEach(sub => sub.unsubscribe());
+            return;
+        }
+        timeoutId = setTimeout(
+            () => fail('request timed out after ' + timeout + 'ms'),
+            timeout
+        );
+        Promise.resolve()
+            .then(() => handler.send(peer, message))
+            .catch((err: any) => fail('could not send message', errorToPlainJson(err)));
+    });
 }
```

**File**: `src/plugins/replication-webrtc/webrtc-types.ts` (modified, +15/-1)
```diff
@@ -1,6 +1,7 @@
 import { Observable, Subscription } from 'rxjs';
 import type {
     MaybePromise,
+    PlainJsonError,
     ReplicationOptions,
     ReplicationPullOptions,
     ReplicationPushOptions,
@@ -19,7 +20,12 @@ export type WebRTCReplicationCheckpoint = RxStorageDefaultCheckpoint;
 export type WebRTCMessage = Omit<WebsocketMessageType, 'method' | 'collection'> & {
     method: StringKeys<RxReplicationHandler<any, any>> | 'token';
 };
-export type WebRTCResponse = Omit<WebsocketMessageResponseType, 'collection'>;
+export type WebRTCResponse = Omit<WebsocketMessageResponseType, 'collection'> & {
+    /**
+     * Set when the remote peer could not process the request.
+     */
+    error?: PlainJsonError;
+};
 export type PeerWithMessage<PeerType> = {
     peer: PeerType;
     message: WebRTCMessage;
@@ -75,6 +81,12 @@ export type SyncOptionsWebRTC<RxDocType, PeerType> = Omit<
      * If returns false, it will drop the peer.
      */
     isPeerValid?: (peer: PeerType) => MaybePromise<boolean>;
+    /**
+     * Time in milliseconds after which a request
+     * to another peer fails when no answer was received.
+     * [default=20000]
+     */
+    requestTimeout?: number;
     pull?: WebRTCSyncPullOptions<RxDocType>;
     push?: WebRTCSyncPushOptions<RxDocType>;
 };
@@ -84,6 +96,8 @@ export type RxWebRTCReplicationState<RxDocType> = RxReplicationState<RxDocType,
 
 export type WebRTCPeerState<RxDocType, PeerType> = {
     peer: PeerType;
+    // the storage token of the remote peer
+    peerToken: string;
     // only exists when the peer was picked as master and the own client was picked as fork.
     replicationState?: RxWebRTCReplicationState<RxDocType>;
     // clean this up when removing the peer
```

**File**: `src/replication-protocol/upstream.ts` (modified, +9/-1)
```diff
@@ -515,6 +515,14 @@ export async function startReplicationUpstream<RxDocType, CheckpointType>(
                         })
                 );
 
+                /**
+                 * The replication might have been canceled while the conflicts
+                 * were resolved. Then the storage instances might already be closed.
+                 */
+                if (state.events.canceled.getValue()) {
+                    return false;
+                }
+
                 if (conflictWriteFork.length > 0) {
                     hadConflictWrites = true;
 
@@ -559,7 +567,7 @@ export async function startReplicationUpstream<RxDocType, CheckpointType>(
                                 conflictWriteMeta[docId]
                             );
                         });
-                    if (useMetaWrites.length > 0) {
+                    if (useMetaWrites.length > 0 && !state.events.canceled.getValue()) {
                         await state.input.metaInstance.bulkWrite(
                             stripAttachmentsDataFromMetaWriteRows(state, useMetaWrites),
                             'replication-up-write-conflict-meta'
```

---

### Incident Patch 11: `212ca1fc` (2026-09-12)
**Commit Message**: Update dependency com.android.tools.build:gradle to v9.4.0 (#9092)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `examples/angular/android/build.gradle` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ buildscript {
         mavenCentral()
     }
     dependencies {
-        classpath 'com.android.tools.build:gradle:9.3.2'
+        classpath 'com.android.tools.build:gradle:9.4.0'
         classpath 'com.google.gms:google-services:4.5.0'
 
         // NOTE: Do not place your application dependencies here; they belong
```

**File**: `examples/flutter/android/build.gradle` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ buildscript {
     }
 
     dependencies {
-        classpath 'com.android.tools.build:gradle:9.3.2'
+        classpath 'com.android.tools.build:gradle:9.4.0'
         classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #9196** (2026-10-05): FIX DB6 on unchanged schema after device locale change (@pubkey)
- **PR #9195** (2026-10-05): FIX schema migration blocked forever by a frozen leader tab (#9191) (@pubkey)
- **PR #9194** (2026-10-05): Show all logo animations on the brand guidelines page (@pubkey)
- **PR #9193** (2026-10-05): FIX flaky encrypted attachment test that decoded binary ciphertext as base64 (@pubkey)
- **PR #9192** (2026-10-05): FIX webmcp and cleanup tests that failed in the premium integration runs (@pubkey)
- **PR #9190** (2026-10-05): docs: rewrite the React IndexedDB article (@pubkey)
- **PR #9189** (2026-10-05): docs: add NCAGE code CNP90 to the legal notice (@pubkey)
- **PR #9188** (2026-10-05): Update dependency sharp to v0.35.5 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
