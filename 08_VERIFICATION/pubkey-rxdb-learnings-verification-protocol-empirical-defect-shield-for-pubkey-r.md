# Verification Protocol: Verification Protocol: Empirical Defect Shield for pubkey-rxdb-learnings

<!-- PROVENANCE_START
{
  "source_repository": "pubkey-rxdb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T21:08:32.989Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pubkey-rxdb-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pubkey-rxdb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T21:08:32.989Z`  
> **Learning ID**: `LEARN-EVO-pubkey-rxdb-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `pubkey-rxdb-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pubkey-rxdb-learnings.md`  
> **Source**: github ([https://github.com/pubkey/rxdb](https://github.com/pubkey/rxdb))  
> **Source Version**: `f0c90aa3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T21:07:14.398Z  
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
> **Harvest Timestamp**: 2026-11-13T21:07:14.391Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pubkey/rxdb`
- **Description**: The local-first database that runs on every JS runtime and replicates with your existing backend - no vendor, no lock-in - https://rxdb.info/
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 23423 stars

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
- **Issue #9730** (2026-11-13): **docs: use the todos example in rx-database and fix the internalIndexes heading**
  *Symptoms*: ## This PR contains: - IMPROVED DOCS  ## Describe the problem you have without this PR - `rx-database.md` was the only Core Entities page that still used the old heroes example (`'heroesdb'`, a `heroes` collection with `mySchema`, and `const db`). All other pages use the shared todos example from `rx-schema.md`. This PR switches it to `myDatabase`, `'mydatabase'`, `todos`, and `todoSchema`. The `db1`/`db2` names in the duplicate-instance examples stay as they are, because those examples need two instances. - In `rx-schema.md`, `internalIndexes` was a second H1 (`#`), so it showed up as its own top-level section. It is now an H2 like the sections around it.  ## Assisted by - Yes, Claude Code  --- _Generated by [Claude Code](https://claude.ai/code/session_015P6w6ivw9hqEC6jJDaEn3g)_

- **Issue #9728** (2026-11-13): **Fix(test): do not index the encrypted field in the replication-graphql push tests (CI on master fails)**
  *Symptoms*: ## This PR contains:  - IMPROVED TESTS  ## Describe the problem you have without this PR The CI on `master` fails since [pubkey/rxdb#9710](https://github.com/pubkey/rxdb/pull/9710) was merged. That pull request added the dev-mode check `SC46` ("an encrypted field cannot be used in an index"), and two existing tests use such a schema. I missed them, because #9710 only ran its own test file.  - The CI run for commit f8c94ac7 on `master` has the failed jobs `storage-memory`, `storage-dexie`, `storage-localstorage`, `storage-mongodb`, `storage-sqlite-trial`, `storage-foundationdb`, `storage-remote`, and `windows`. In the logs of memory, dexie, remote, and windows the run stops at `replication-graphql.test.ts > push not working on slow db` with `RxError (SC46)`. The logs of the other four jobs were not read. - The tests "push not working on slow db" and "push not working when big amount of docs was pulled before" clone `humanWithTimestampAllIndex`, which has `indexes: ['name', 'age', 'updatedAt']`, and then set `encrypted: ['name']`. That is the usage that `SC46` rejects, because the index would be built on the ciphertext. - Both tests now set `indexes: ['age', 'updatedAt']`. They still run on the encrypted storage with the encrypted field `name` and two indexes. The `SC46` check is not changed. - No other schema in the tests, the test-utils, the examples, or the docs has an encrypted field in an index (searched with grep, and the full memory run has no other `SC46`). - No changel

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

### Incident Patch 1: `75b3da7a` (2026-11-13)
**Commit Message**: fix(ci): make the tauri example e2e test robust against a lost webdriver session (#9725)

The example-tauri job fails at random with "invalid session id" for every
webdriver command.

Evidence from the last 200 completed CI runs (163 example-tauri jobs,
2026-11-12 18:47 to 2026-11-13 09:47 UTC): 25 jobs failed. 5 of them never
reached the test (tsc errors of the branch, one npm ETARGET). The other 20
are flaky test failures, which is 20 of the 158 jobs that started the test
(12.7%), in three variants:

- 8x lost session: the first command `findElement("body > h1")` hangs for
  6 seconds, then WebKitWebDriver answers "Request failed with status 500
  due to unknown error", then "status 404 due to session deleted because of
  page crash or hang", and tauri-driver answers all following commands
  with "invalid session id". Both tests fail after 6.2s.
- 9x `element ("body[data-db-ready="true"]") still not existing after
  60000ms`: the page is there, but the database of the app never gets ready.
- 3x `element (".name[name="Iron Man"]") still not existing after 20000ms`:
  the inserted hero never shows up.

In all logs, passing and failing, creating the session takes about 25
seconds an

**File**: `examples/tauri/wdio.conf.cjs` (modified, +104/-8)
```diff
@@ -1,9 +1,98 @@
 const os = require('os');
+const net = require('net');
 const path = require('path');
-const { spawn, spawnSync } = require('child_process');
+const { spawn } = require('child_process');
+
+/**
+ * `tauri-driver` listens on DRIVER_PORT and proxies the webdriver requests
+ * to the `WebKitWebDriver` process that it spawns on NATIVE_DRIVER_PORT.
+ */
+const DRIVER_HOST = '127.0.0.1';
+const DRIVER_PORT = 4444;
+const NATIVE_DRIVER_PORT = 4445;
+const DRIVER_START_TIMEOUT = 30000;
+const DRIVER_STOP_TIMEOUT = 5000;
 
 // keep track of the `tauri-driver` child process
 let tauriDriver;
+let tauriDriverExit;
+
+function canConnect(port) {
+  return new Promise((resolve) => {
+    const socket = net.connect({ host: DRIVER_HOST, port });
+    socket.once('connect', () => {
+      socket.destroy();
+      resolve(true);
+    });
+    socket.once('error', () => {
+      socket.destroy();
+      resolve(false);
+    });
+  });
+}
+
+async function waitForPort(port) {
+  const start = Date.now();
+  while (!(await canConnect(port))) {
+    if (tauriDriver.exitCode !== null || tauriDriver.signalCode !== null) {
+      throw new Error(
+        'tauri-driver exited before port ' + port + ' was reachable'
+      );
+    }
+    if (Date.now() - start > DRIVER_START_TIMEOUT) {
+      throw new Error(
+        'port ' + port + ' not reachable after ' + DRIVER_START_TIMEOUT + 'ms'
+      );
+    }
+    await new Promise((resolve) => setTimeout(resolve, 100));
+  }
+}
+
+async function startTauriDriver() {
+  tauriDriver = spawn(
+    path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
+    ['--port', String(DRIVER_PORT), '--native-port', String(NATIVE_DRIVER_PORT)],
+    { stdio: [null, process.stdout, process.stderr] }
+  );
+  tauriDriverExit = new Promise((resolve) => {
+    tauriDriver.once('exit', (code, signal) => {
+      console.log(
+        'tauri-driver exited with code ' + code + ' and signal ' + signal
+      );
+      resolve();
+    });
+    tauriDriver.once('error', (err) => {
+      console.error('tauri-driver could not be started: ' + err.message);
+      resolve();
+    });
+  });
+
+  // the session must only be created when both drivers accept connections
+  await waitForPort(DRIVER_PORT);
+  await waitForPort(NATIVE_DRIVER_PORT);
+}
+
+async function stopTauriDriver() {
+  if (!tauriDriver) {
+    return;
+  }
+  tauriDriver.kill();
+  const forceKill = setTimeout(
+    () => tauriDriver.kill('SIGKILL'),
+    DRIVER_STOP_TIMEOUT
+  );
+
+  // wait for the exit so that the ports are free when the spec file is retried
+  await tauriDriverExit;
+  clearTimeout(forceKill);
+}
+
+// never leave a `tauri-driver` behind that blocks the ports for the next worker
+process.on('exit', () => {
+  if (tauriDriver) {
+    tauriDriver.kill('SIGKILL');
+  }
+});
 
 exports.config = {
   specs: ['./test/specs/**/*.js'],
@@ -23,14 +112,21 @@ exports.config = {
     timeout: 120000,
   },
 
+  /**
+   * On the CI runners the app sometimes dies or hangs right after it was started,
+   * which ends in an "invalid session id" error for all following commands.
+   * A lost session cannot be recovered from inside of the test,
+   * so the whole spec file is retried. Each retry runs in a new worker
+   * which runs beforeSession() and afterSession() again
+   * and therefore gets a new `tauri-driver`, a new session and a new app process.
+   */
+  specFileRetries: 3,
+  specFileRetriesDelay: 5,
+  specFileRetriesDeferred: false,
+
   // ensure we are running `tauri-driver` before the session starts so that we can proxy the webdriver requests
-  beforeSession: () =>
-    (tauriDriver = spawn(
-      path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
-      [],
-      { stdio: [null, process.stdout, process.stderr] }
-    )),
+  beforeSession: () => startTauriDriver(),
 
   // clean up the `tauri-driver` process we spawned at the start of the session
-  afterSession: () => tauriDriver.kill(),
+  afterSession: () => stopTauriDriver(),
 };
```

---

### Incident Patch 2: `f0c90aa3` (2026-11-13)
**Commit Message**: docs: use the todos example in rx-database and fix the internalIndexes heading (#9730)

* docs: use the todos example in rx-database and fix the internalIndexes heading level

- rx-database.md: replace 'heroesdb' and the heroes collection with the shared todos example (myDatabase, todoSchema)
- rx-schema.md: internalIndexes was a second H1, now an H2

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6ivw9hqEC6jJDaEn3g

* test: remove duplicate RxCollection import in rx-query.test.ts

The duplicate import (added in b3abe14) makes babel fail with
'Identifier RxCollection has already been declared', which breaks
npm run build:test on master and every PR.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6ivw9hqEC6jJDaEn3g

* test: use the dot-separated WebMCP tool names in the wait_changes tests

#9698 changed the tool name suffix to <database>.<collection>.<version>,
while the wait_changes tests from #9697 still looked up the old
underscore names, so executeTool() failed with 'Tool not found'.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.

**File**: `docs-src/docs/rx-database.md` (modified, +11/-11)
```diff
@@ -17,8 +17,8 @@ The database is created by the asynchronous `.createRxDatabase()` function of th
 import { createRxDatabase } from 'rxdb/plugins/core';
 import { getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage';
 
-const db = await createRxDatabase({
-  name: 'heroesdb',                   // <- name
+const myDatabase = await createRxDatabase({
+  name: 'mydatabase',                 // <- name
   storage: getRxStorageLocalstorage(),       // <- RxStorage
 
   /* Optional parameters: */
@@ -42,7 +42,7 @@ When you deploy your app to a staging area, prefix the database name with the st
 // and '' on production
 const stagingId = import.meta.env.VITE_STAGING_ID;
 
-const db = await createRxDatabase({
+const myDatabase = await createRxDatabase({
   name: stagingId ? stagingId + '-mydatabasename' : 'mydatabasename',
   storage: getRxStorageLocalstorage()
 });
@@ -64,7 +64,7 @@ For example you can use the [LocalStorage RxStorage](./rx-storage-localstorage.m
 // use the LocalStorage that stores data in the browser.
 import { getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage';
 
-const db = await createRxDatabase({
+const myDatabase = await createRxDatabase({
   name: 'mydatabase',
   storage: getRxStorageLocalstorage()
 });
@@ -107,12 +107,12 @@ In some rare cases like unit-tests, you want to do this intentionally by setting
 
 ```js
 const db1 = await createRxDatabase({
-  name: 'heroesdb',
+  name: 'mydatabase',
   storage: getRxStorageLocalstorage(),
   ignoreDuplicate: true
 });
 const db2 = await createRxDatabase({
-  name: 'heroesdb',
+  name: 'mydatabase',
   storage: getRxStorageLocalstorage(),
   // this create-call will not throw because
   // you explicitly allow it
@@ -127,12 +127,12 @@ Closes all other RxDatabase instances that have the same storage+name combinatio
 
 ```js
 const db1 = await createRxDatabase({
-  name: 'heroesdb',
+  name: 'mydatabase',
   storage: getRxStorageLocalstorage(),
   closeDuplicates: true
 });
 const db2 = await createRxDatabase({
-  name: 'heroesdb',
+  name: 'mydatabase',
   storage: getRxStorageLocalstorage(),
   closeDuplicates: true // this create-call will close db1
 });
@@ -158,7 +158,7 @@ async function myOwnHashFunction(input: string | ArrayBuffer | Blob) {
     }
     return sha256(input);
 }
-const db = await createRxDatabase({
+const myDatabase = await createRxDatabase({
   hashFunction: myOwnHashFunction
   /* ... */
 });
@@ -309,8 +309,8 @@ const sub = myDatabase.collections$.subscribe(event => {
 });
 
 await myDatabase.addCollections({
-  heroes: {
-    schema: mySchema
+  todos: {
+    schema: todoSchema
   }
 });
 
```

**File**: `docs-src/docs/rx-schema.md` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ const todoSchemaWithIndexes = {
 ```
 
 
-# internalIndexes
+## internalIndexes
 
 When you use RxDB on the server-side, you might want to use internalIndexes to speed up internal queries. [Read more](./rx-server.md#server-only-indexes)
 
```

**File**: `test/unit/rx-query.test.ts` (modified, +0/-1)
```diff
@@ -19,7 +19,6 @@ import {
     RxQuery,
     RxJsonSchema,
     RxError,
-    RxCollection,
     MangoQuery,
     MangoQueryNoLimit,
     promiseWait,
```

**File**: `test/unit/webmcp.test.ts` (modified, +3/-3)
```diff
@@ -169,7 +169,7 @@ describe('webmcp.test.ts', () => {
             }
         });
         db.registerWebMCP();
-        const waitToolName = `rxdb_wait_changes_${db.name}_withlocal_0`;
+        const waitToolName = `rxdb_wait_changes_${db.name}.withlocal.0`;
         let waitResolved = false;
         const waitPromise = executeTool(waitToolName, {}).then(() => {
             waitResolved = true;
@@ -192,7 +192,7 @@ describe('webmcp.test.ts', () => {
                 }
             }
         });
-        const waitTool = toolsByName.get(`rxdb_wait_changes_${db.name}_humans_0`);
+        const waitTool = toolsByName.get(`rxdb_wait_changes_${db.name}.humans.0`);
         const waitPromise: Promise<any> = waitTool.execute({});
         const settled = waitPromise.then(
             () => 'resolved',
@@ -231,7 +231,7 @@ describe('webmcp.test.ts', () => {
                     }
                 }
             });
-            const waitTool = toolsByName.get(`rxdb_wait_changes_${database.name}_humans_0`);
+            const waitTool = toolsByName.get(`rxdb_wait_changes_${database.name}.humans.0`);
             const settled = [waitTool.execute({}), waitTool.execute({})].map(
                 (waitPromise: Promise<any>) => waitPromise.then(
                     () => 'resolved',
```

---

### Incident Patch 3: `23563246` (2026-11-13)
**Commit Message**: Fix: RxState.set() lost writes and hung on close because the conflict retry depended on cross-instance events (#9628)

* fix: RxState.set() lost writes when the last id query is ahead of the merged state

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hnnyVPXwotts6YQ2F

* test: use the storage of the test config

The test created its own Dexie storage on fake-indexeddb. It now uses
config.storage.getStorage() like the other tests of the file, so each
CI run checks the storage of that run.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hnnyVPXwotts6YQ2F

* fix: RxState.set() conflict retry merges the conflicting operations instead of waiting for an event

On a CONFLICT the retry loop of RxState.set() waited with promiseWait(0)
for the change event of the other instance to update the last id query.
A closing database no longer gets these events, so set() and
RxDatabase.close() never settled.

The loop now merges the operations document of the conflict error
(documentInDb) into the state and retries with the next id. Each retry
moves the last merged id forward by one 

**File**: `orga/changelog/fix-rxstate-lost-write-with-delayed-cross-instance-events.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX `RxState.set()` ran the modifier on a stale state and lost writes of other instances when `eventReduce: false` is set on a multiInstance storage with asynchronous cross-instance events. The state now loads operations that are not merged yet from the storage before it runs the modifiers and no longer overwrites operations that were merged during the write",
+    "links": [],
+    "priority": 5
+}
```

**File**: `orga/changelog/fix-rxstate-set-conflict-retry-without-events.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX `RxState.set()` and `RxDatabase.close()` never settled when another instance wrote to the same state while the database was closing. On a conflict, `set()` now merges the conflicting operations from the write error and retries with the next id, instead of waiting for a cross-instance change event that never arrives",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/pull/9628",
+            "linkText": "#9628"
+        }
+    ],
+    "priority": 5
+}
```

**File**: `src/plugins/state/rx-state.ts` (modified, +80/-10)
```diff
@@ -19,6 +19,7 @@ import type {
     RxQuery,
     RxDocument,
     RxError,
+    RxStorageWriteErrorConflict,
     Paths
 } from '../../types';
 import {
@@ -29,8 +30,7 @@ import {
     clone,
     randomToken,
     deepEqual,
-    getFromMapOrCreate,
-    promiseWait
+    getFromMapOrCreate
 } from '../utils/index.ts';
 import {
     RX_STATE_COLLECTION_SCHEMA,
@@ -70,6 +70,11 @@ export class RxStateBase<T, Reactivity = unknown> {
     public _initDone = false;
     public _instanceId = randomToken(RX_STATE_COLLECTION_SCHEMA.properties.sId.maxLength);
     public _ownEmits$ = new Subject<T>();
+    /**
+     * Id of the newest operations document that is merged into _state.
+     * All operations documents with a lower id are merged too.
+     */
+    public _lastMergedId = '';
 
     constructor(
         public readonly prefix: string,
@@ -109,10 +114,24 @@ export class RxStateBase<T, Reactivity = unknown> {
                     for (let index = 0; index < events.length; index++) {
                         const event = events[index];
                         if (
-                            event.operation === 'INSERT' &&
-                            event.documentData.sId !== this._instanceId
+                            event.operation !== 'INSERT' ||
+                            event.documentData.sId === this._instanceId ||
+                            event.documentData.id <= this._lastMergedId
                         ) {
+                            continue;
+                        }
+                        if (event.documentData.id === nextRxStateId(this._lastMergedId || undefined)) {
+                            this._lastMergedId = event.documentData.id;
                             this.mergeOperationsIntoState(event.documentData.ops);
+                        } else {
+                            /**
+                             * The events of the operations between the last merged
+                             * one and this one did not arrive yet. Merging this one
+                             * now would apply the operations in the wrong order.
+                             */
+                            this._mergeMissingOperations()
+                                .then(() => this._ownEmits$.next(this._state))
+                                .catch(() => { });
                         }
                     }
                 })
@@ -151,9 +170,18 @@ export class RxStateBase<T, Reactivity = unknown> {
             let done = false;
             while (!done) {
                 const lastIdDoc = await this._lastIdQuery.exec();
+                /**
+                 * The query can return an operations document
+                 * before its change event has been merged into the state.
+                 * The modifiers must run on a state that
+                 * contains all operations with a lower id.
+                 */
+                if (lastIdDoc && lastIdDoc.id > this._lastMergedId) {
+                    await this._mergeMissingOperations();
+                }
                 useWrites = useWrites.concat(this._nonPersisted);
                 this._nonPersisted = [];
-                const nextId = nextRxStateId(lastIdDoc ? lastIdDoc.id : undefined);
+                const nextId = nextRxStateId(this._lastMergedId || undefined);
                 try {
                     /**
                      * TODO instead of a deep-clone we should
@@ -191,19 +219,35 @@ export class RxStateBase<T, Reactivity = unknown> {
                         sId: this._instanceId,
                         ops
                     });
-                    this._state = newState;
+                    /**
+                     * When a newer operation was merged during the insert,
+                     * the state already contains this write
+                     * and must not be replaced with the older newState.
+                     */
+                    if (this._lastMergedId < nextId) {
+                        this._lastMergedId = nextId;
+                        this._state = newState;
+                    }
                     this._ownEmits$.next(this._state);
                     done = true;
                 } catch (err) {
                     if ((err as RxError).code !== 'CONFLICT') {
                         throw err;
                     }
                     /**
-                     * Yield to the event loop so that cross-instance
-                     * change events can be processed and the _lastIdQuery
-                     * cache gets updated before retrying.
+                     * The conflict error contains the operations document
+                     * that another instance has stored with the same id.
+                     * Merging it here makes the next run use a higher id
+                     * even when the change event of that document never arrives,
+                     * like when the database is closing.
                      */
-                    awa
```

**File**: `test/unit/rx-state.test.ts` (modified, +88/-0)
```diff
@@ -8,6 +8,7 @@ import {
     createRxDatabase,
     randomToken,
     addRxPlugin,
+    deepEqual,
     lastOfArray,
     RxReactivityFactory,
     RxState,
@@ -379,6 +380,40 @@ addRxPlugin(RxDBJsonDumpPlugin);
                 state1.collection.database.close();
                 state2.collection.database.close();
             });
+            it('close() and a pending set() must settle when the other instance wrote at the same time', async () => {
+                const databaseName = randomToken(10);
+                const state1 = await getState(databaseName);
+                const state2 = await getState(databaseName);
+                await state1.set('a', () => 0);
+                await waitUntil(() => state2.a === 0);
+
+                const set2 = state2.set('b', () => 1);
+                const set1 = state1.set('a', () => 2);
+                const closePromise = state1.collection.database.close();
+
+                const settled = await Promise.race([
+                    Promise.all([set1, closePromise, set2]),
+                    wait(isFastMode() ? 2000 : 5000).then(() => 'timeout' as const)
+                ]);
+                if (settled === 'timeout') {
+                    // do not await the close of the hanging instance
+                    state2.collection.database.close();
+                    assert.fail('set() or close() did not settle');
+                }
+                assert.strictEqual(settled[1], true);
+
+                // the write of the closed instance is stored
+                await waitUntil(() => state2.a === 2 && state2.b === 1);
+
+                // the remaining instance still works and a new one recovers the same state
+                await state2.set('b', plusOne);
+                const state3 = await getState(databaseName);
+                assert.deepStrictEqual(state3.get(), { a: 2, b: 2 });
+                assert.deepStrictEqual(state3.get(), state2.get());
+
+                await state3.collection.database.close();
+                await state2.collection.database.close();
+            });
             runXTimes(1, () => {
                 it('should have a deterministic output when 2 instances write at the same time', async () => {
                     // TODO shouldn't we fix this test for these storages?
@@ -526,6 +561,59 @@ addRxPlugin(RxDBJsonDumpPlugin);
                 state1.collection.database.close();
                 state2.collection.database.close();
             });
+            it('should not lose a write when eventReduce is disabled and the events of the other instance arrive delayed', async () => {
+                type CounterState = {
+                    a?: number;
+                    cnt?: number;
+                };
+                const storage = useSchemaValidator ? wrappedValidateAjvStorage({
+                    storage: config.storage.getStorage()
+                }) : config.storage.getStorage();
+                const databaseName = randomToken(10);
+                const openState = async () => {
+                    const database = await createRxDatabase({
+                        name: databaseName,
+                        storage,
+                        multiInstance: true,
+                        ignoreDuplicate: true,
+                        eventReduce: false
+                    });
+                    const state: RxState<CounterState> = await database.addState<CounterState>();
+                    return state;
+                };
+                const increment = (v?: number) => (v ? v : 0) + 1;
+                const state1 = await openState();
+                const state2 = await openState();
+
+                const rounds = 20;
+                for (let round = 1; round <= rounds; round++) {
+                    await state1.set('a', () => round);
+                    await Promise.all([
+                        state1.set('a', () => round + 0.5),
+                        state1.set('cnt', increment),
+                        state2.set('cnt', increment)
+                    ]);
+                    const expected = { a: round + 0.5, cnt: round * 2 };
+                    try {
+                        await waitUntil(() => deepEqual(state1.get(), expected) && deepEqual(state2.get(), expected), 2000);
+                    } catch (err) {
+                        assert.deepStrictEqual(
+                            [state1.get(), state2.get()],
+                            [expected, expected],
+                            'wrong state in round ' + round
+                        );
+                    }
+                }
+
+                const freshState = await openState();
+                assert.deepStrictEqual(freshState.get(), { a: rounds + 0.5, cnt: rounds * 2 });
+                assert.deepStrictEqual(state1.get(), freshState.get());
+                assert.deepStrictEqual(state2.get(), freshState.get());
+
+                await state1.collection.database.close();
+          
```

#### Recent Merged Pull Requests:
- **PR #9730** (2026-11-13): docs: use the todos example in rx-database and fix the internalIndexes heading (@pubkey)
- **PR #9728** (2026-11-13): Fix(test): do not index the encrypted field in the replication-graphql push tests (CI on master fails) (@pubkey)
- **PR #9726** (2026-11-13): Add CLAUDE.md rule that usage checks belong into dev-mode (@pubkey)
- **PR #9725** (2026-11-13): Fix(ci): retry the tauri example e2e test with a fresh webdriver session (@pubkey)
- **PR #9723** (2026-11-13): DOCS: use a pixel arrow icon for the news slider link (@pubkey)
- **PR #9720** (2026-11-13): chore(deps): update dependency @expo/cli to v57.0.33 (@renovate[bot])

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

## X. ci): make the tauri example e2e test robust against a lost webdriver session

**RULE**:
When implementing operations in `examples/tauri/wdio.conf.cjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pubkey/rxdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `75b3da7a`: ci): make the tauri example e2e test robust against a lost webdriver session. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `examples/tauri/wdio.conf.cjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
const net = require('net');
const { spawn } = require('child_process');

/**
 * `tauri-driver` listens on DRIVER_PORT and proxies the webdriver requests
 * to the `WebKitWebDriver` process that it spawns on NATIVE_DRIVER_PORT.
 */
const DRIVER_HOST = '127.0.0.1';
const DRIVER_PORT = 4444;
const NATIVE_DRIVER_PORT = 4445;
const DRIVER_START_TIMEOUT = 30000;
const DRIVER_STOP_TIMEOUT = 5000;
let tauriDriverExit;

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: DRIVER_HOST, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port) {
  const start = Date.now();
  while (!(await canConnect(port))) {
    if (tauriDriver.exitCode !== null || tauriDriver.signalCode !== null) {
      throw new Error(
        'tauri-driver exited before port ' + port + ' was reachable'
      );
    }
    if (Date.now() - start > DRIVER_START_TIMEOUT) {
      throw new Error(
        'port ' + port + ' not reachable after ' + DRIVER_START_TIMEOUT + 'ms'
      );
    }
    await new Promise(
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
const { spawn, spawnSync } = require('child_process');
  beforeSession: () =>
    (tauriDriver = spawn(
      path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
      [],
      { stdio: [null, process.stdout, process.stderr] }
    )),
  afterSession: () => tauriDriver.kill(),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `75b3da7a` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
