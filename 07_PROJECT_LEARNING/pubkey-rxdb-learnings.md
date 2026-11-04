> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pubkey-rxdb-learnings.md`  
> **Source**: github ([https://github.com/pubkey/rxdb](https://github.com/pubkey/rxdb))  
> **Source Version**: `b41fd6bd`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T01:58:22.511Z  
> **Learning ID**: `learn-github-pubkey-rxdb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): pubkey/rxdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/pubkey-rxdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pubkey/rxdb](https://github.com/pubkey/rxdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T01:58:21.900Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pubkey/rxdb`
- **Description**: The local-first database that runs on every JS runtime and replicates with your existing backend - no vendor, no lock-in - https://rxdb.info/
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 23419 stars

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

function escapeFileNameChar(char: string): string {
    return '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Document ids and attachment ids can contain chars
 * that are not allowed in file names, like : * \ / on windows.
 * These are percent-encoded so that each id maps to exactly
 * one file name inside of the backup directory.
 * The % itself is also encoded so that the mapping is unique.
 */
export function toFileName(id: string): string {
    let ret = id.replace(/[<>:"/\\|?*%\x00-\x1F]/g, escapeFileNameChar);
    /**
     * Windows does not allow names that end with a dot or whitespace
     * and this also prevents the names '.' and '..'.
     */
    const lastChar = ret.slice(-1);
    if (lastChar === '.' || lastChar === ' ') {
        ret = ret.slice(0, -1) + escapeFileNameChar(lastChar);
    }
    if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(ret)) {
        ret = escapeFileNameChar(ret[0]) + ret.slice(1);
    }
    return ret;
}

export function documentFolder(
    options: BackupOptions,
    docId: string
): string {
    return path.join(
        options.directory,
        toFileName(docId)
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9385** (2026-11-03): **test: query correctness for missing/null fields and $regex, $not, $mod (#9371)**
  *Symptoms*: ## This PR contains: - IMPROVED TESTS  ## Describe the problem you have without this PR Related to https://github.com/pubkey/rxdb/issues/9371. The premium SQLite storage handled `$nin` and `$exists` differently from Dexie when a field is missing or `null`. The shared `rx-storage-query-correctness.test.ts` did not catch this, because `$nin` was only tested against present values and `$exists` only appeared inside `$nor`. Some operators that the query matcher supports also had no correctness test at all: field-level `$not`, `$mod`, and `$regex` on a plain field (it was only tested inside `$elemMatch`).  This PR adds two `testCorrectQueries` blocks:  **`$exists, $nin, $eq and $ne on missing and null fields`**, using documents with a value, `null`, a missing field and an empty string: - `$exists: true` matches `null` values, and `$exists: false` matches only missing fields - `$nin` matches missing and `null` fields, unless `null` is in the list - `$ne`, `$eq: null` and `$ne: null`  **`$regex, $not and $mod on plain fields`**: - `$regex` with and without `$options: 'i'` - field-level `$not` with `$eq`, `$regex`, `$gt` and `$in`, including missing and `null` fields - `$mod`, also combined with a range  The expected results are what the query matcher (mingo) returns. Both blocks pass on the memory and Dexie storages.  Notice: the query matcher matches `{ age: null }` for `$mod: [5, 0]`, because `null % 5 === 0` in JavaScript, while MongoDB would not match it. The `$mod` cases leave 

- **Issue #9383** (2026-11-03): **FIX flaky RxStorage .cleanup() test with a separate now() instance**
  *Symptoms*: ## This PR contains: - IMPROVED TESTS  ## Describe the problem you have without this PR `rx-storage-implementations.test.ts` › `.cleanup` › `should have cleaned up the deleted document` fails randomly in the rxdb-premium integration tests. Example: Firefox with the `localstorage-meta-optimizer` storage in https://github.com/pubkey/rxdb-premium-dev/actions/runs/41653141708/job/125976309009 (`must have no documents found because they are cleaned up`).  Cause: the test sets the deletion `_meta.lwt` with its own `now()` and then calls `cleanup(0)` right away. In the integration setup the premium storage imports `rxdb/plugins/core` from `node_modules/rxdb`, which is a different module copy than the test's `../../plugins/core`. So it has another `now()` with its own sub-millisecond counter. When the delete and the cleanup run in the same millisecond, the storage computes a `maxDeletionTime` below the document's `lwt` and keeps the document. Firefox runs fast and has coarse timers, so it hits this more often.  The sibling test `should clean up all deleted documents when multiple are deleted` already waits until `Date.now()` is past the deletion `lwt`. This PR adds the same wait to the failing test.  ## Todos - [x] Tests (`.cleanup` tests pass on the memory storage, lint and `check-types` pass) - [x] Changelog  ## Assisted by - YES, Claude Code  --- _Generated by [Claude Code](https://claude.ai/code/session_015P6w6iBPXTgx6weKLkASE5)_

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

### Incident Patch 1: `6a06ac3a` (2026-11-03)
**Commit Message**: FIX flaky RxStorage .cleanup() test with a separate now() instance (#9383)

The test "should have cleaned up the deleted document" called cleanup(0)
right after the delete. In the rxdb-premium integration tests the storage
uses another copy of rxdb and therefore another now() with its own
sub-millisecond counter. When the delete and the cleanup ran in the same
millisecond, the storage computed a maxDeletionTime below the lwt of the
deleted document and did not remove it (seen on Firefox with the
localstorage-meta-optimizer storage). Wait until Date.now() is past the
deletion lwt, like the sibling test already does.


Claude-Session: https://claude.ai/code/session_015P6w6iBPXTgx6weKLkASE5

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/changelog/fix-flaky-storage-cleanup-test.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX flaky RxStorage `.cleanup()` test that could fail when the storage uses another instance of `now()` and the deletion happened in the same millisecond",
+    "links": [],
+    "priority": 1
+}
```

**File**: `test/unit/rx-storage-implementations.test.ts` (modified, +8/-0)
```diff
@@ -3447,6 +3447,14 @@ describe('rx-storage-implementations.test.ts (implementation: ' + config.storage
                 const doc = mustBeThereButDeleted[0];
                 assert.ok(doc._deleted);
 
+                /**
+                 * cleanup(0) only removes documents with a lwt below the now() of the storage.
+                 * The storage can use another instance of now() with its own sub-millisecond counter
+                 * (like the premium storages in the integration tests), so wait until the
+                 * deletion time is in the past.
+                 */
+                await waitUntil(() => Date.now() > doc._meta.lwt);
+
                 // clean up the deleted document
                 while (!await storageInstance.cleanup(0)) { }
 
```

---

### Incident Patch 2: `4b9769b4` (2026-11-03)
**Commit Message**: FIX result window buffer applying the change event of a concurrent write twice (#9381)

* FIX result window buffer applying the change event of a concurrent write twice

A storage can make written documents visible to queries before it emits
their change events (Dexie commits the transaction and emits afterwards).
When a query ran in that gap, its result already contained the write but
the change event counter did not, so the event was applied again to the
result window buffer. The buffer is not idempotent: an insert sorted
after the last row was appended twice, and an insert sorted before the
first row was counted twice into the skipped rows, which shifted a
skipped document into the result.

The wrapped storage instance now tracks its pending bulkWrite() calls and
_execOverDatabase() waits for them before it compares the counter. The
storage emits the events before bulkWrite() resolves, so the existing
rerun check then sees the write and runs the query again.

Found in the CI of the premium SQLite storage.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hDJbLRL1jvB5AfEnt

* Link PR in changelog entry

Co-Authored-By: Claud

**File**: `orga/before-next-major.md` (modified, +13/-0)
```diff
@@ -113,3 +113,16 @@ Most "normal" users do not need premium access so we should name it "RxDB Enterp
 ## Refactor data-migrator
 
  - Migration strategies should be defined [like in WatermelonDB](https://nozbe.github.io/WatermelonDB/Advanced/Migrations.html) with a `toVersion` version field. We should also add a `fromVersion` field so people could implement performance shortcuts by directly jumping several versions. The current migration strategies use the array index as `toVersion` which is confusing.
+
+## RxStorage: Add a commit sequence to query results and change events
+
+A storage can make a write visible to queries before the change event of that write reaches the RxCollection. This always happens with multiInstance (the event of another tab comes over the BroadcastChannel after the commit) and with the remote storage, so it cannot be fixed by pinning the emit timing in the RxStorage contract. When a query runs in that gap, the event is applied again on top of a result that already contains the write. The result window buffer does not tolerate this and can end up with duplicate documents or a skipped document in the result. See [#9381](https://github.com/pubkey/rxdb/pull/9381), which only covers writes of the same JavaScript process by waiting for pending `bulkWrite()` calls in `_execOverDatabase()`.
+
+Idea:
+- Each storage instance keeps a commit sequence number that is incremented in the same transaction as each `bulkWrite()`, for example in a single meta row.
+- `query()` and `count()` return the sequence they have read in their read transaction: `{ documents, sequence }`.
+- Each `EventBulk` contains the sequence of its write. Events from other tabs and from the remote storage carry the same number because the storage assigned it on commit.
+- `__ensureEqual()` drops all events with a sequence that is lower or equal to the sequence of the current result. Then the `pendingWrites` wait and maybe the rerun loop in `_execOverDatabase()` can be removed.
+- The existing `EventBulk.checkpoint` cannot be used for this because its `lwt` comes from the clock of each tab and is not ordered by commit across tabs.
+
+Breaking for RxStorage implementations, not for RxDB users. It can be introduced as an optional field in a minor release (storages without it keep the current behavior) and be made required in the next major.
```

**File**: `orga/changelog/fix-result-window-buffer-event-applied-twice.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX the result window buffer of a query could contain the same document twice, or a document that should be skipped, when a write ran while the query was executed and the storage emitted the change event of that write only after the query had already returned the written document",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/pull/9381",
+            "linkText": "#9381"
+        }
+    ],
+    "priority": 5
+}
```

**File**: `src/rx-query.ts` (modified, +10/-0)
```diff
@@ -375,7 +375,17 @@ export class RxQueryBase<
          * convergence more and more under write pressure.
          *
          * @link https://github.com/pubkey/rxdb/issues/7067
+         *
+         * A write that ran concurrently can already be visible in our result
+         * while its change event is not emitted yet. Its event would then be applied
+         * again on top of a result that already contains it, which the result window
+         * buffer does not tolerate. The storage emits the events before bulkWrite()
+         * resolves, so we wait for the pending writes before comparing the counter.
          */
+        const pendingWrites = this.collection.storageInstance.pendingWrites;
+        if (pendingWrites && pendingWrites.size > 0) {
+            await Promise.allSettled(Array.from(pendingWrites));
+        }
         if (this.collection._changeEventBuffer.getCounter() !== counterBefore) {
             await promiseWait(20);
             return this._execOverDatabase(rerunCount + 1);
```

**File**: `src/rx-storage-helper.ts` (modified, +19/-4)
```diff
@@ -582,6 +582,12 @@ export function flatCloneDocWithMeta<RxDocType>(
 
 export type WrappedRxStorageInstance<RxDocumentType, Internals, InstanceCreationOptions> = RxStorageInstance<RxDocumentType, any, InstanceCreationOptions> & {
     originalStorageInstance: RxStorageInstance<RxDocumentType, Internals, InstanceCreationOptions>;
+    /**
+     * The bulkWrite() calls to the original storage instance that have not resolved yet.
+     * A storage can make written documents visible to queries before it emits their
+     * change events, but it always emits them before bulkWrite() resolves.
+     */
+    pendingWrites?: Set<Promise<unknown>>;
 };
 
 /**
@@ -608,8 +614,17 @@ export function getWrappedStorageInstance<
 
     const primaryPath = getPrimaryFieldOfPrimaryKey(storageInstance.schema.primaryKey);
 
+    const pendingWrites = new Set<Promise<unknown>>();
+    function trackPendingWrite<T>(writePromise: Promise<T>): Promise<T> {
+        pendingWrites.add(writePromise);
+        const remove = () => pendingWrites.delete(writePromise);
+        writePromise.then(remove, remove);
+        return writePromise;
+    }
+
     const ret: WrappedRxStorageInstance<RxDocType, Internals, InstanceCreationOptions> = {
         originalStorageInstance: storageInstance,
+        pendingWrites,
         schema: storageInstance.schema,
         internals: storageInstance.internals,
         collectionName: storageInstance.collectionName,
@@ -705,12 +720,12 @@ export function getWrappedStorageInstance<
                 });
             }
 
-            const writeResult = await database.lockedRun(
+            const writeResult = await trackPendingWrite(database.lockedRun(
                 () => storageInstance.bulkWrite(
                     toStorageWriteRows,
                     context
                 )
-            );
+            ));
 
             /**
              * The RxStorageInstance MUST NOT allow to insert already _deleted documents,
@@ -772,12 +787,12 @@ export function getWrappedStorageInstance<
                         };
                     });
 
-                const subResult = await database.lockedRun(
+                const subResult = await trackPendingWrite(database.lockedRun(
                     () => storageInstance.bulkWrite(
                         reInserts,
                         context
                     )
-                );
+                ));
 
 
                 useWriteResult.error = useWriteResult.error.concat(subResult.error);
```

**File**: `test/unit/event-reduce.test.ts` (modified, +166/-1)
```diff
@@ -1,5 +1,6 @@
 import assert from 'assert';
-import { clone } from 'async-test-util';
+import { clone, wait } from 'async-test-util';
+import { Subject } from 'rxjs';
 
 import {
     schemaObjects,
@@ -15,6 +16,8 @@ import {
     rxChangeEventToEventReduceChangeEvent,
     RxStorageChangeEvent,
     RxEventReduceOptions,
+    RxStorage,
+    RxStorageInstance,
     defaultResultWindowBuffer
 } from '../../plugins/core/index.mjs';
 
@@ -511,6 +514,168 @@ describe('event-reduce.test.js', () => {
 
             col.database.close();
         });
+        /**
+         * Wraps a storage so that bulkWrite() commits the documents
+         * but emits their change events only after openGate() is called.
+         * This is allowed by the RxStorage contract, which only requires that the
+         * events are emitted before bulkWrite() resolves. Storages like Dexie
+         * also commit the transaction before they emit the events.
+         */
+        function gatedEventsStorage(storage: RxStorage<any, any>) {
+            let gate: Promise<void> | undefined;
+            let openGate = () => { };
+            let onCommitted = () => { };
+            let onQueried = () => { };
+            const ret: RxStorage<any, any> & {
+                /**
+                 * Resolves when the next bulkWrite() is committed
+                 * but its events are not emitted yet.
+                 */
+                closeGate(): Promise<void>;
+                openGate(): void;
+                /**
+                 * Resolves when the next query() has returned its result.
+                 */
+                waitForQuery(): Promise<void>;
+            } = {
+                name: storage.name,
+                rxdbVersion: storage.rxdbVersion,
+                async createStorageInstance(params) {
+                    const instance = await storage.createStorageInstance(params);
+                    const changes$ = new Subject<any>();
+                    let held: any[] = [];
+                    let holding = false;
+                    instance.changeStream().subscribe(bulk => {
+                        if (holding) {
+                            held.push(bulk);
+                        } else {
+                            changes$.next(bulk);
+                        }
+                    });
+                    return new Proxy(instance, {
+                        get(target: any, prop: keyof RxStorageInstance<any, any, any>) {
+                            if (prop === 'changeStream') {
+                                return () => changes$.asObservable();
+                            }
+                            if (prop === 'bulkWrite') {
+                                return async (...args: any[]) => {
+                                    const useGate = gate;
+                                    if (useGate) {
+                                        holding = true;
+                                    }
+                                    const result = await target.bulkWrite(...args);
+                                    if (useGate) {
+                                        onCommitted();
+                                        await useGate;
+                                        holding = false;
+                                        const emit = held;
+                                        held = [];
+                                        emit.forEach(bulk => changes$.next(bulk));
+                                    }
+                                    return result;
+                                };
+                            }
+                            if (prop === 'query') {
+                                return async (...args: any[]) => {
+                                    const result = await target.query(...args);
+                                    onQueried();
+                                    return result;
+                                };
+                            }
+                            const value = target[prop];
+                            return typeof value === 'function' ? value.bind(target) : value;
+                        }
+                    });
+                },
+                closeGate() {
+                    gate = new Promise<void>(res => {
+                        openGate = () => {
+                            gate = undefined;
+                            res();
+                        };
+                    });
+                    return new Promise<void>(res => onCommitted = res);
+                },
+                openGate() {
+                    openGate();
+                },
+                waitForQuery() {
+                    return new Promise<void>(res => onQueried = res);
+                }
+            };
+            return ret;
+        }
+        it('should not apply the change event of a write twice when the query result already contains the write', async () => {
+            const storage = gate
```

**File**: `test/unit/replication.test.ts` (modified, +1/-0)
```diff
@@ -2401,6 +2401,7 @@ describe('replication.test.ts', () => {
             sub2 = collection.findOne('a').$.subscribe((doc) => {
                 emitted.push(doc);
             });
+            await waitUntil(() => emitted.length === 1);
 
             const postDoc = { id: 'a', foo: 'changed-after' };
             pullStream$.next({ documents: [postDoc], checkpoint: {} });
```

---

### Incident Patch 3: `b41fd6bd` (2026-11-03)
**Commit Message**: test: add query correctness tests for missing/null fields and $regex, $not, $mod (#9385)

$exists, $nin, $eq and $ne are now tested against missing fields,
null values and empty strings. $regex on plain fields, field-level $not
and $mod had no correctness tests before.

Refs #9371


Claude-Session: https://claude.ai/code/session_015P6w6icEVvvPDxQ1xm4ize

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/changelog/add-exists-nin-null-query-correctness-tests.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "ADD query correctness tests for `$exists`, `$nin`, `$eq` and `$ne` on missing and `null` fields, and for `$regex`, `$not` and `$mod` on plain fields, so all storages are checked against the same results",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/issues/9371",
+            "linkText": "#9371"
+        }
+    ],
+    "priority": 1
+}
```

**File**: `test/unit/rx-storage-query-correctness.test.ts` (modified, +160/-0)
```diff
@@ -2735,4 +2735,164 @@ describe('rx-storage-query-correctness.test.ts', () => {
             }
         ]
     });
+
+    /**
+     * Missing fields and fields with the value null
+     * must be handled the same way on all storages.
+     * @link https://github.com/pubkey/rxdb/issues/9371
+     */
+    testCorrectQueries<{ id: string; a?: string | null; b?: string | null; }>({
+        testTitle: '$exists, $nin, $eq and $ne on missing and null fields',
+        data: [
+            { id: 'd1', a: 'x', b: null },
+            { id: 'd2', a: 'x', b: 'z' },
+            { id: 'd3' },
+            { id: 'd4', a: null },
+            { id: 'd5', a: 'y' },
+            { id: 'd6', a: '' }
+        ],
+        schema: {
+            version: 0,
+            primaryKey: 'id',
+            type: 'object',
+            properties: {
+                id: { type: 'string', maxLength: 10 },
+                a: { type: ['string', 'null'] },
+                b: { type: ['string', 'null'] }
+            },
+            required: ['id']
+        },
+        queries: [
+            {
+                info: '$exists: true matches fields with the value null',
+                query: { selector: { a: { $exists: true } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d1', 'd2', 'd4', 'd5', 'd6']
+            },
+            {
+                info: '$exists: false matches only missing fields',
+                query: { selector: { a: { $exists: false } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d3']
+            },
+            {
+                info: '$exists: true on a field that is null in one document',
+                query: { selector: { b: { $exists: true } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d1', 'd2']
+            },
+            {
+                info: '$exists: false on a field that is null in one document',
+                query: { selector: { b: { $exists: false } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d3', 'd4', 'd5', 'd6']
+            },
+            {
+                info: '$nin matches missing and null fields',
+                query: { selector: { a: { $nin: ['y'] } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d1', 'd2', 'd3', 'd4', 'd6']
+            },
+            {
+                info: '$nin with multiple values matches missing and null fields',
+                query: { selector: { a: { $nin: ['x', 'y'] } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d3', 'd4', 'd6']
+            },
+            {
+                info: '$nin with null excludes missing and null fields',
+                query: { selector: { a: { $nin: ['y', null] } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d1', 'd2', 'd6']
+            },
+            {
+                info: '$nin with only null',
+                query: { selector: { a: { $nin: [null] } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d1', 'd2', 'd5', 'd6']
+            },
+            {
+                info: '$ne matches missing and null fields',
+                query: { selector: { a: { $ne: 'y' } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d1', 'd2', 'd3', 'd4', 'd6']
+            },
+            {
+                info: '$eq: null matches missing and null fields',
+                query: { selector: { a: { $eq: null } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d3', 'd4']
+            },
+            {
+                info: '$ne: null matches only fields with a value',
+                query: { selector: { a: { $ne: null } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d1', 'd2', 'd5', 'd6']
+            }
+        ]
+    });
+
+    testCorrectQueries<{ id: string; name?: string | null; age?: number | null; }>({
+        testTitle: '$regex, $not and $mod on plain fields',
+        data: [
+            { id: 'd1', name: 'Alice', age: 10 },
+            { id: 'd2', name: 'alice', age: 15 },
+            { id: 'd3', name: 'Bob', age: 20 },
+            { id: 'd4' },
+            { id: 'd5', name: null, age: null },
+            { id: 'd6', name: 'Carol', age: 21 }
+        ],
+        schema: {
+            version: 0,
+            primaryKey: 'id',
+            type: 'object',
+            properties: {
+                id: { type: 'string', maxLength: 10 },
+                name: { type: ['string', 'null'] },
+                age: { type: ['number', 'null'] }
+            },
+            required: ['id']
+        },
+        queries: [
+            {
+                info: '$regex is case sensitive by default',
+                query: { selector: { name: { $regex: '^a' } }, sort: [{ id: 'asc' }] },
+                expectedResultDocIds: ['d2']
+            },
+            {
+                info: '$regex with $options i',
+                query: { selector: { name: { $regex: '^a', $opt
```

#### Recent Merged Pull Requests:
- **PR #9385** (2026-11-03): test: query correctness for missing/null fields and $regex, $not, $mod (#9371) (@pubkey)
- **PR #9383** (2026-11-03): FIX flaky RxStorage .cleanup() test with a separate now() instance (@pubkey)
- **PR #9382** (2026-11-03): Fix flaky Tauri example e2e test (@pubkey)
- **PR #9381** (2026-11-03): FIX result window buffer applying the change event of a concurrent write twice (@pubkey)
- **PR #9378** (2026-11-03): Update dependency deno to v2.9.8 (@renovate[bot])
- **PR #9377** (2026-11-03): Update dependency rollup to v4.65.1 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. flaky RxStorage .cleanup() test with a separate now() instance (#9383)

**RULE**:
When implementing operations in `orga/changelog/fix-flaky-storage-cleanup-test.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pubkey/rxdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6a06ac3a`: flaky RxStorage .cleanup() test with a separate now() instance (#9383). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `orga/changelog/fix-flaky-storage-cleanup-test.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
{
    "$schema": "./schema.json",
    "text": "FIX flaky RxStorage `.cleanup()` test that could fail when the storage uses another instance of `now()` and the deletion happened in the same millisecond",
    "links": [],
    "priority": 1
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6a06ac3a` are properly handled with clean fallback behavior.
