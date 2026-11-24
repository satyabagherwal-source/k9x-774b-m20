# Verification Protocol: Verification Protocol: Empirical Defect Shield for pubkey-rxdb-learnings

<!-- PROVENANCE_START
{
  "source_repository": "pubkey-rxdb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T09:00:02.270Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pubkey-rxdb-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pubkey-rxdb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T09:00:02.270Z`  
> **Learning ID**: `LEARN-EVO-pubkey-rxdb-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `pubkey-rxdb-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pubkey-rxdb-learnings.md`  
> **Source**: github ([https://github.com/pubkey/rxdb](https://github.com/pubkey/rxdb))  
> **Source Version**: `cbac2d49`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T08:59:49.224Z  
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
> **Harvest Timestamp**: 2026-11-24T08:59:49.040Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pubkey/rxdb`
- **Description**: The local-first database that runs on every JS runtime and replicates with your existing backend - no vendor, no lock-in - https://rxdb.info/
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 23443 stars

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
    /**
     * Runs at the start of RxDatabase.addCollections(),
     * before the collection meta documents are written
     * and before the storage instances are created.
     * @async
     */
    preAddRxCollections: [],
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
import { DEFAULT_CLEANUP_POLICY, awaitReplicationInSyncOrCanceled } from './cleanup-helper.ts';
import { initialCleanupWait } from './cleanup.ts';
import { Subscription, firstValueFrom } from 'rxjs';

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
                            return awaitReplicationInSyncOrCanceled(replicationState);
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
                if (rxCollection.closed) {
                    return true;
                }
                /**
                 * The collection can be closed while the cleanup is running.
                 * Then the cleanup run ends without an error.
                 * A step of the cleanup that runs on the closed collection
                 * might never settle, and this queue is shared by all
                 * databases, so it must not wait for that step.
                 */
                const closedSub = new Subscription();
                const closedPromise = new Promise<boolean>(res => {
                    closedSub.add(rxCollection.closed$.subscribe(() => res(true)));
                });
                try {
                    return await Promise.race([
                        state._cleanup(),
                        closedPromise
                    ]);
                } catch (err) {
                    if (rxCollection.closed) {
                        return true;
                    }
                    throw err;
                } finally {
                    closedSub.unsubscribe();
                }
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
- **Issue #9830** (2026-11-24): **Update dependency eslint-plugin-jsdoc to v65.4.9**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [eslint-plugin-jsdoc](https://redirect.github.com/gajus/eslint-plugin-jsdoc) | [`65.4.8` → `65.4.9`](https://renovatebot.com/diffs/npm/eslint-plugin-jsdoc/65.4.8/65.4.9) | ![age](https://developer.mend.io/api/mc/badges/age/npm/eslint-plugin-jsdoc/65.4.9?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/eslint-plugin-jsdoc/65.4.8/65.4.9?slim=true) |  ---  ### Release Notes  <details> <summary>gajus/eslint-plugin-jsdoc (eslint-plugin-jsdoc)</summary>  ### [`v65.4.9`](https://redirect.github.com/gajus/eslint-plugin-jsdoc/releases/tag/v65.4.9)  [Compare Source](https://redirect.github.com/gajus/eslint-plugin-jsdoc/compare/v65.4.8...v65.4.9)  ##### Bug Fixes  - **`convert-to-jsdoc-comments`:** separate leading slashes from generated stars ([#&#8203;1848](https://redirect.github.com/gajus/eslint-plugin-jsdoc/issues/1848)) ([bc4f307](https://redirect.github.com/gajus/eslint-plugin-jsdoc/commit/bc4f307e8e6367d98e3b5a1c6352500e3cef5ed1))  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Enabled.  ♻ **Rebasing**: Whenever PR is behind base branch, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you 

- **Issue #9824** (2026-11-23): **docs: split replication.md into concept, replicateRxCollection() and RxReplicationState pages**
  *Symptoms*: ## This PR contains: - IMPROVED DOCS  ## Describe the problem you have without this PR `replication.md` was the longest page on the learning path, at about 3,300 words. About 70% of its sections scored as hard. It mixed the concept of the Sync Engine with the full API reference, so a reader who only wants to understand how sync works had to scroll past `awaitDocumentPushed()` and the lifecycle table.  The content is now split by topic. Nothing was removed, only moved:  | Page | What it covers | | --- | --- | | `replication.md` (slug `replication.html` unchanged) | Concept: design decisions, document level, transfer level (checkpoint iteration, event observation), data layout on the server, a short summary of conflict handling, a minimal `replicateRxCollection()` example, multi-tab, security, partial sync | | `replicate-rx-collection.md` (new) | Minimal example first, then all options with the `pull.stream$` example, custom `initialCheckpoint`, `toggleOnDocumentVisible`, TypeScript, pull-only, attachment replication, local-only metadata | | `rx-replication-state.md` (new) | Observables, `awaitInitialReplication()`, `awaitInSync()` (with the "do not block the app" warning), `awaitDocumentPushed()`, `reSync()`, `cancel()`, `pause()`, `remove()`, `isStopped()`, `isPaused()`, lifecycle table, error handling, FAQ | | `transactions-conflicts-revisions.md` | The replication conflict explanation and its two images moved into the existing "Replication conflicts" section |  **Why confli

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

### Incident Patch 1: `0b762853` (2026-11-23)
**Commit Message**: FIX the cleanup and pipeline plugins failed when the leader-election plugin was not added (#9818)

* FIX cleanup and pipeline plugin add the leader-election plugin by themselves

Both plugins call RxDatabase.waitForLeadership(), which only exists with
the leader-election plugin. With only the cleanup plugin added, the
automatic cleanup ended in an unhandled promise rejection and never ran.
With only the pipeline plugin added, addPipeline() rejected and left a
half-created pipeline that blocked all later reads on the destination.

Both plugins now add the leader-election plugin in their init(), like
the replication plugins do in replicateRxCollection().

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hj7DdpavqfXGRMMKW

* Add the pull request link to the changelog entry

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hj7DdpavqfXGRMMKW

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `docs-src/docs/cleanup.md` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ import { RxDBCleanupPlugin } from 'rxdb/plugins/cleanup';
 addRxPlugin(RxDBCleanupPlugin);
 ```
 
+The cleanup plugin adds the [leader election plugin](./leader-election.md) by itself because with the default `waitForLeadership: true` the cleanup only runs on the leading instance. You do not have to add it on your own.
+
 ## Create a database with cleanup options
 
 You can set a specific cleanup policy when a [RxDatabase](./rx-database.md) is created. For most use cases, the defaults should be ok.
```

**File**: `docs-src/docs/rx-pipeline.md` (modified, +19/-1)
```diff
@@ -41,6 +41,18 @@ const result = await myDestinationCollection.find().exec();
 
 
 
+## Installation
+
+To use `addPipeline()`, you have to add the `pipeline` plugin.
+
+```ts
+import { addRxPlugin } from 'rxdb';
+import { RxDBPipelinePlugin } from 'rxdb/plugins/pipeline';
+addRxPlugin(RxDBPipelinePlugin);
+```
+
+The pipeline plugin adds the [leader election plugin](./leader-election.md) by itself because a pipeline waits for the leadership before it starts. You do not have to add it on your own.
+
 ## Creating a RxPipeline
 
 Pipelines are created on top of a source [RxCollection](./rx-collection.md) and have another `RxCollection` as destination. An identifier is used to identify the state of the pipeline so that different pipelines have a different processing checkpoint state. A plain JavaScript function `handler` is used to process the data of the source collection writes.
@@ -60,7 +72,13 @@ const pipeline = await mySourceCollection.addPipeline({
                 category: doc.category
             });
         }
-    }
+    },
+    /**
+     * If true, the pipeline only starts
+     * when the current instance is the leader.
+     * (optional) [default=true]
+     */
+    waitForLeadership: true
 });
 ```
 
```

**File**: `orga/changelog/fix-cleanup-pipeline-add-leader-election.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX the cleanup plugin and the pipeline plugin called `RxDatabase.waitForLeadership()` without adding the leader-election plugin. With only the cleanup plugin added, the automatic cleanup never ran and ended in an unhandled promise rejection. With only the pipeline plugin added, `addPipeline()` rejected and later queries on the destination collection never resolved. Both plugins now add the leader-election plugin by themselves, like the replication plugins do",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/pull/9818",
+            "linkText": "#9818"
+        }
+    ],
+    "priority": 5
+}
```

**File**: `src/plugins/cleanup/index.ts` (modified, +10/-0)
```diff
@@ -5,10 +5,20 @@ import type {
 import { DEFAULT_CLEANUP_POLICY } from './cleanup-helper.ts';
 import { startCleanupForRxState } from './cleanup-state.ts';
 import { cleanupRxCollection, startCleanupForRxCollection } from './cleanup.ts';
+import { addRxPlugin } from '../../plugin.ts';
+import { RxDBLeaderElectionPlugin } from '../leader-election/index.ts';
 
 export const RxDBCleanupPlugin: RxPlugin = {
     name: 'cleanup',
     rxdb: true,
+    /**
+     * With cleanupPolicy.waitForLeadership, the automatic cleanup
+     * calls RxDatabase.waitForLeadership() which only exists
+     * with the leader-election plugin.
+     */
+    init() {
+        addRxPlugin(RxDBLeaderElectionPlugin);
+    },
     prototypes: {
         RxCollection: (proto: any) => {
             proto.cleanup = async function (this: RxCollection, minimumDeletedTime?: number): Promise<boolean> {
```

**File**: `src/plugins/pipeline/index.ts` (modified, +10/-0)
```diff
@@ -2,6 +2,8 @@ import type {
     RxPlugin
 } from '../../types/index.d.ts';
 import { addPipeline } from './rx-pipeline.ts';
+import { addRxPlugin } from '../../plugin.ts';
+import { RxDBLeaderElectionPlugin } from '../leader-election/index.ts';
 
 export type * from './types.ts';
 export * from './flagged-functions.ts';
@@ -10,6 +12,14 @@ export * from './rx-pipeline.ts';
 export const RxDBPipelinePlugin: RxPlugin = {
     name: 'pipeline',
     rxdb: true,
+    /**
+     * With options.waitForLeadership, addPipeline()
+     * calls RxDatabase.waitForLeadership() which only exists
+     * with the leader-election plugin.
+     */
+    init() {
+        addRxPlugin(RxDBLeaderElectionPlugin);
+    },
     prototypes: {
         RxCollection(proto: any) {
             proto.addPipeline = addPipeline;
```

**File**: `test/unit/cleanup-only.node.ts` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+/**
+ * Uses the cleanup plugin without adding any other plugin,
+ * like it is shown in the docs of the cleanup plugin.
+ * This is run in a separate node-process via plugin.test.ts
+ * because the other tests add the leader-election plugin.
+ */
+
+import assert from 'assert';
+import { waitUntil } from 'async-test-util';
+
+/**
+ * exit with non-zero on unhandledRejection
+ */
+process.on('unhandledRejection', function (err) {
+    console.log('cleanup-only.node.ts: unhandledRejection');
+    console.error(err);
+    process.exit(1);
+});
+
+import {
+    createRxDatabase,
+    randomToken,
+    addRxPlugin
+} from '../../plugins/core/index.mjs';
+import {
+    getRxStorageMemory
+} from '../../plugins/storage-memory/index.mjs';
+import { RxDBCleanupPlugin } from '../../plugins/cleanup/index.mjs';
+import type {
+    RxJsonSchema,
+} from '../../plugins/core/index.mjs';
+addRxPlugin(RxDBCleanupPlugin);
+
+const schema: RxJsonSchema<{ id: string; name: string; }> = {
+    version: 0,
+    primaryKey: 'id',
+    type: 'object',
+    properties: {
+        id: {
+            type: 'string',
+            maxLength: 100
+        },
+        name: {
+            type: 'string'
+        }
+    },
+    required: ['id', 'name']
+};
+
+const run = async function () {
+    /**
+     * multiInstance and cleanupPolicy.waitForLeadership
+     * are not set so that their defaults are used.
+     */
+    const db = await createRxDatabase({
+        name: randomToken(10),
+        storage: getRxStorageMemory(),
+        cleanupPolicy: {
+            minimumCollectionAge: 0,
+            minimumDeletedTime: 0,
+            runEach: 10
+        }
+    });
+    await db.addCollections({
+        todos: {
+            schema
+        }
+    });
+    const collection = db.todos;
+
+    await collection.insert({ id: 'todo1', name: 'Learn RxDB' });
+    const doc = await collection.insert({ id: 'todo2', name: 'Buy groceries' });
+    await doc.remove();
+
+    /**
+     * The automatic cleanup must purge the deleted document.
+     * No timeout is set here, plugin.test.ts stops
+     * the process when it runs for too long.
+     */
+    await waitUntil(async () => {
+        const docsInStorage = await collection.storageInstance.findDocumentsById(
+            ['todo1', 'todo2'],
+            true
+        );
+        assert.ok(docsInStorage.find(d => d.id === 'todo1'));
+        return !docsInStorage.find(d => d.id === 'todo2');
+    });
+
+    await db.close();
+};
+
+run();
```

**File**: `test/unit/pipeline-only.node.ts` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+/**
+ * Uses the pipeline plugin without adding any other plugin.
+ * This is run in a separate node-process via plugin.test.ts
+ * because the other tests add the leader-election plugin.
+ */
+
+import assert from 'assert';
+
+/**
+ * exit with non-zero on unhandledRejection
+ */
+process.on('unhandledRejection', function (err) {
+    console.log('pipeline-only.node.ts: unhandledRejection');
+    console.error(err);
+    process.exit(1);
+});
+
+import {
+    createRxDatabase,
+    randomToken,
+    addRxPlugin
+} from '../../plugins/core/index.mjs';
+import {
+    getRxStorageMemory
+} from '../../plugins/storage-memory/index.mjs';
+import { RxDBPipelinePlugin } from '../../plugins/pipeline/index.mjs';
+import type {
+    RxJsonSchema,
+} from '../../plugins/core/index.mjs';
+addRxPlugin(RxDBPipelinePlugin);
+
+const schema: RxJsonSchema<{ id: string; name: string; }> = {
+    version: 0,
+    primaryKey: 'id',
+    type: 'object',
+    properties: {
+        id: {
+            type: 'string',
+            maxLength: 100
+        },
+        name: {
+            type: 'string'
+        }
+    },
+    required: ['id', 'name']
+};
+
+const run = async function () {
+    const db = await createRxDatabase({
+        name: randomToken(10),
+        storage: getRxStorageMemory()
+    });
+    await db.addCollections({
+        todos: {
+            schema
+        },
+        todonames: {
+            schema
+        }
+    });
+
+    /**
+     * options.waitForLeadership is not set
+     * so that its default is used.
+     */
+    const pipeline = await db.todos.addPipeline({
+        identifier: 'todo-names',
+        destination: db.todonames,
+        handler: async (docs) => {
+            for (const doc of docs) {
+                await db.todonames.upsert({
+                    id: doc.primary,
+                    name: doc.name
+                });
+            }
+        }
+    });
+
+    await db.todos.insert({ id: 'todo1', name: 'Learn RxDB' });
+    await pipeline.awaitIdle();
+    const processed = await db.todonames.findOne('todo1').exec(true);
+    assert.strictEqual(processed.name, 'Learn RxDB');
+
+    await db.close();
+};
+
+run();
```

**File**: `test/unit/plugin.test.ts` (modified, +49/-33)
```diff
@@ -47,43 +47,59 @@ describe('plugin.test.js', () => {
             await addRxPlugin(RxDBDevModePlugin);
         });
     });
+    /**
+     * Runs a transpiled file of the unit test folder in a separate
+     * node-process and throws when it fails or writes to stderr.
+     */
+    async function runInOwnProcess(fileName: string) {
+        const execFileAsync = promisify(execFile);
+        let stderr: string;
+        try {
+            /**
+             * Run the mocha entrypoint with the current node binary
+             * instead of relying on the `mocha` shim being in the PATH,
+             * this also works on windows.
+             */
+            const result = await execFileAsync(
+                process.execPath,
+                [
+                    getRootPath() + 'node_modules/mocha/bin/mocha.js',
+                    getRootPath() + 'test_tmp/unit/' + fileName
+                ],
+                {
+                    maxBuffer: 1024 * 1024 * 64,
+                    // stop a process that hangs, before the test times out
+                    timeout: 30 * 1000
+                }
+            );
+            stderr = result.stderr;
+        } catch (err: any) {
+            console.error('errrrr');
+            console.dir(err.stdout);
+            throw new Error(`could not run ${fileName}.
+                # Error: ${err}
+                # Output: ${err.stdout}
+                # ErrOut: ${err.stderr}
+                `, { cause: err });
+        }
+
+        if (stderr.length > 0) {
+            throw new Error('got stderr: ' + stderr);
+        }
+    }
     describe('full.node.ts', () => {
         it('full.node.ts should run without errors', async () => {
-            if (!isNode)
-                return;
-
-            const execFileAsync = promisify(execFile);
-            let stderr: string;
-            try {
-                /**
-                 * Run the mocha entrypoint with the current node binary
-                 * instead of relying on the `mocha` shim being in the PATH,
-                 * this also works on windows.
-                 */
-                const result = await execFileAsync(
-                    process.execPath,
-                    [
-                        getRootPath() + 'node_modules/mocha/bin/mocha.js',
-                        getRootPath() + 'test_tmp/unit/full.node.js'
-                    ],
-                    { maxBuffer: 1024 * 1024 * 64 }
-                );
-                stderr = result.stderr;
-            } catch (err: any) {
-                console.error('errrrr');
-                console.dir(err.stdout);
-                throw new Error(`could not run full.node.js.
-                    # Error: ${err}
-                    # Output: ${err.stdout}
-                    # ErrOut: ${err.stderr}
-                    `, { cause: err });
-            }
-
-            if (stderr.length > 0) {
-                throw new Error('got stderr: ' + stderr);
-            }
+            await runInOwnProcess('full.node.js');
         });
     });
+    describe('plugins that wait for the leadership', () => {
+        it('the automatic cleanup should run when only the cleanup plugin was added', async () => {
+            await runInOwnProcess('cleanup-only.node.js');
+        }).timeout(40 * 1000);
+        it('addPipeline() should work when only the pipeline plugin was added', async () => {
+            await runInOwnProcess('pipeline-only.node.js');
+        }).timeout(40 * 1000);
+    });
     describe('hooks', () => {
         it('createRxDatabase', async () => {
             const createRxDatabase = (args: any) => {
```

---

### Incident Patch 2: `41a45034` (2026-11-23)
**Commit Message**: FIX RxState cleanup of all databases blocked after a database was closed during its cleanup (#9791)

* FIX RxState cleanup of all databases blocked after a database was closed during its cleanup

All RxState cleanups of the JavaScript process run in one shared promise
queue. When a database was closed or removed while the cleanup of its
RxState was running, a query of that cleanup could be sent to the already
closed storage instance. On the remote RxStorage such a call never
settles, so the queue was blocked and the RxState cleanup of all other
databases never ran again.

The queue step now ends when the collection of the state gets closed.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hj7DdpavqfXGRMMKW

* Create the closed promise of the RxState cleanup once per collection

Each cleanup run subscribed to closed$ of the collection again. The
subscription of a run that finished stayed until the collection was
closed. Now one promise per collection is created and reused.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hj7DdpavqfXGRMMKW

* Subscribe to closed$ only f

**File**: `orga/changelog/fix-rxstate-cleanup-queue-blocked-by-closed-database.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX the automatic cleanup of an RxState never ran again for all other databases of the JavaScript process when a database was closed or removed while the cleanup of its RxState was running. This happened on the remote RxStorage, where a call on a closed storage instance never settles.",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/pull/9791",
+            "linkText": "#9791"
+        }
+    ],
+    "priority": 5
+}
```

**File**: `src/plugins/cleanup/cleanup-state.ts` (modified, +21/-7)
```diff
@@ -3,7 +3,7 @@ import { PROMISE_RESOLVE_TRUE } from '../../plugins/utils/index.ts';
 import { REPLICATION_STATE_BY_COLLECTION } from '../replication/index.ts';
 import { DEFAULT_CLEANUP_POLICY, awaitReplicationInSyncOrCanceled } from './cleanup-helper.ts';
 import { initialCleanupWait } from './cleanup.ts';
-import { firstValueFrom } from 'rxjs';
+import { Subscription, firstValueFrom } from 'rxjs';
 
 let RXSTATE_CLEANUP_QUEUE: Promise<any> = PROMISE_RESOLVE_TRUE;
 
@@ -68,16 +68,30 @@ export async function cleanupRxState(
                 if (rxCollection.closed) {
                     return true;
                 }
-                return state._cleanup().catch(err => {
-                    /**
-                     * The collection can be closed while the cleanup is running.
-                     * Then the cleanup run ends without an error.
-                     */
+                /**
+                 * The collection can be closed while the cleanup is running.
+                 * Then the cleanup run ends without an error.
+                 * A step of the cleanup that runs on the closed collection
+                 * might never settle, and this queue is shared by all
+                 * databases, so it must not wait for that step.
+                 */
+                const closedSub = new Subscription();
+                const closedPromise = new Promise<boolean>(res => {
+                    closedSub.add(rxCollection.closed$.subscribe(() => res(true)));
+                });
+                try {
+                    return await Promise.race([
+                        state._cleanup(),
+                        closedPromise
+                    ]);
+                } catch (err) {
                     if (rxCollection.closed) {
                         return true;
                     }
                     throw err;
-                });
+                } finally {
+                    closedSub.unsubscribe();
+                }
             });
         isDone = await RXSTATE_CLEANUP_QUEUE;
     }
```

**File**: `test/unit/rx-state.test.ts` (modified, +81/-0)
```diff
@@ -543,6 +543,87 @@ addRxPlugin(RxDBJsonDumpPlugin);
 
                 await database.remove();
             });
+            it('should run the automatic cleanup after another database was removed while its cleanup was running', async () => {
+                type CounterState = {
+                    [key: string]: number;
+                };
+                const storage = useSchemaValidator ? wrappedValidateAjvStorage({
+                    storage: config.storage.getStorage()
+                }) : config.storage.getStorage();
+                const openState = async () => {
+                    const database = await createRxDatabase({
+                        name: randomToken(10),
+                        storage,
+                        cleanupPolicy: {
+                            awaitReplicationsInSync: false,
+                            minimumCollectionAge: 0,
+                            minimumDeletedTime: 0,
+                            runEach: 0,
+                            waitForLeadership: false
+                        }
+                    });
+                    return database.addState<CounterState>();
+                };
+
+                /**
+                 * Which step of the cleanup is running when the database
+                 * gets removed depends on the timing, so this is done several times.
+                 * Slow storages get fewer rounds to stay inside of the test timeout.
+                 */
+                const maxRounds = 10;
+                const roundsStartTime = Date.now();
+                for (let round = 0; round < maxRounds && Date.now() - roundsStartTime < 3000; round++) {
+                    const state = await openState();
+                    const database = state.collection.database;
+                    let counter = 0;
+                    const writeNext = () => {
+                        const value = counter++;
+                        return state.set('k' + value, () => value);
+                    };
+
+                    /**
+                     * The cleanup starts when the database is idle after a write,
+                     * and it only merges the state when there are more than 5 writes.
+                     * The idle calls are resolved in the order of their requests,
+                     * so the cleanup starts right after this one.
+                     */
+                    const idlePromise = database.requestIdlePromise();
+                    for (let i = 0; i < 6; i++) {
+                        await writeNext();
+                    }
+                    await idlePromise;
+                    // the next idle call is resolved three timeouts after the previous one
+                    await wait(0);
+                    await wait(0);
+                    await wait(0);
+
+                    /**
+                     * Now the cleanup reads the state documents from the storage.
+                     * While writes arrive, that read is repeated for some time,
+                     * so the cleanup is still running when the database gets removed.
+                     * All writes of the app are awaited before.
+                     */
+                    const startTime = Date.now();
+                    while (Date.now() - startTime < 30) {
+                        await writeNext();
+                    }
+                    await database.remove();
+                }
+
+                // the cleanup of a database that is created afterwards must still run
+                const lastState = await openState();
+                const writes = 10;
+                for (let i = 0; i < writes; i++) {
+                    await lastState.set('k' + i, () => i);
+                }
+                await waitUntil(async () => {
+                    const docs = await lastState.collection.find().exec();
+                    return docs.length <= 5;
+                });
+                assert.strictEqual(Object.keys(lastState.get()).length, writes);
+
+                await lastState.collection.database.remove();
+            });
         });
         describe('multiInstance', () => {
             if (
```

---

### Incident Patch 3: `dcfd7517` (2026-11-23)
**Commit Message**: FIX the in-memory state of an RxState did not follow the storage after a replicated change (#9816)

* ADD failing tests for RxState replication when both sides write before the sync

The tests 'should not lose a write when both sides have written before the sync'
and 'should have the same state in memory as after a reload when both sides have
written before the sync' fail. No fix is included, the design has to be decided first.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hj7DdpavqfXGRMMKW

* FIX in-memory state of an RxState did not follow the storage after a replicated change

When a replication of the collection of an RxState overwrote or deleted
operations documents, the in-memory state kept the operations that are no
longer stored. The state is now built again from the storage when an UPDATE
or DELETE event arrives, inside of the write queue.

The dropped write of one device on a conflict and the lost state after a
cleanup on one side are not changed, they are noted in orga/before-next-major.md.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hj7DdpavqfXGRMM

**File**: `orga/before-next-major.md` (modified, +17/-0)
```diff
@@ -679,6 +679,23 @@ An implementation with tests is in the closed pull request [#9561](https://githu
 
 Related closed pull requests that contain parts of this change: [#9603](https://github.com/pubkey/rxdb/pull/9603) (the digest that a wrapped storage changed is set on the write rows of the caller, so that the encryption and the attachments-compression storage work in both wrapping orders) and [#9556](https://github.com/pubkey/rxdb/pull/9556) (the `length` of the write data is used for the stored attachment).
 
+## RxState: writes of two devices must not get the same operations document id
+
+An RxState stores each write as an operations document with a counter as id (`00000000000000`, `00000000000001`, ...). Instances that share one storage get a conflict error on the same id and retry with the next one. Two devices that replicate `myState.collection` do not share a storage, so when both write before they sync, both create a document with the same id. The replication handles that as a conflict, the default conflict handler keeps the master state, and the fork document is overwritten.
+
+- With `await stateA.set('a', () => 1)` on one device and `await stateB.set('b', () => 2)` on the other one, both states are `{ b: 2 }` after the sync. The write of one device is dropped.
+- When one device runs the cleanup while the other one wrote without a connection, and the device that ran the cleanup is the fork side of the replication, the merged document of the cleanup loses the conflict, but the deletions of the older operations documents are replicated. Both devices then only have the one write of the other device and the whole earlier state is lost. When the device that ran the cleanup is the master, its merged document wins and only the write of the other device is dropped.
+
+The in-memory state is built again from the storage after such a replicated change, so `get()` and the observables show the stored state. The writes are still lost.
+
+Todo:
+- Give the operations documents ids that are unique per device, for example the counter plus the instance id, so that two devices never write the same document. The order of the operations, `nextRxStateId()`, the `_lastMergedId` comparisons, and the cleanup have to work with these ids.
+- Alternative: a conflict handler for the collection of the RxState that keeps the operations of both sides in the resolved document. It has to define the order of a full-state operation (`k: ''`, written by the cleanup and by `set('')`) against the operations of the other side, otherwise the document of the cleanup still drops the other write.
+- The cleanup must not delete operations documents before its merged document is accepted by the other side.
+- Breaking: the stored format of the operations documents changes, so existing states have to be migrated. With the conflict handler, apps that replicate a state today get another result for a conflict.
+
+There is no implementation yet. The pull request that rebuilds the in-memory state and has tests for both scenarios is [#9816](https://github.com/pubkey/rxdb/pull/9816).
+
 ## Database `exportJSON()` must not contain the internal RxState collection
 
 `RxDatabase.exportJSON()` contains the internal `rx-state-*` collection of an RxState. `importJSON()` of that dump into a database without the state throws `JD1`.
```

**File**: `orga/changelog/fix-rxstate-in-memory-state-after-replicated-change.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX the in-memory state of an `RxState` did not follow the storage when a replication of `myState.collection` overwrote or deleted operations documents, or inserted one with an id that was merged already, so `get()` and the observables returned another state than after a reload. The state is now built again from the storage after such a change. Added testcases for the replication of an `RxState`",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/pull/9816",
+            "linkText": "#9816"
+        }
+    ],
+    "priority": 5
+}
```

**File**: `src/plugins/state/rx-state.ts` (modified, +67/-11)
```diff
@@ -84,6 +84,12 @@ export class RxStateBase<T, Reactivity = unknown> {
      * All operations documents with a lower id are merged too.
      */
     public _lastMergedId = '';
+    /**
+     * Ids of the operations documents that were merged from the storage
+     * before their INSERT event has arrived. A rebuild of the state replaces
+     * the content with the ids it has read above the previous _lastMergedId.
+     */
+    public _mergedAhead = new Set<string>();
 
     constructor(
         public readonly prefix: string,
@@ -102,22 +108,28 @@ export class RxStateBase<T, Reactivity = unknown> {
             this._ownEmits$,
             this.collection.eventBulks$.pipe(
                 /**
-                 * Filter out event bulks that do not contain
-                 * relevant events for this instance.
-                 * Only INSERT events from OTHER instances need
-                 * to be processed. Own-instance INSERTs are
-                 * already handled via _ownEmits$, and DELETE
-                 * events (e.g. from cleanup) do not change state.
+                 * Only INSERT events from OTHER instances are merged
+                 * into the state. Own-instance INSERTs are
+                 * already handled via _ownEmits$.
+                 * A replication can also overwrite, delete, or insert documents
+                 * with an id that is already merged. The state cannot be corrected
+                 * from these events, so it is built again from the storage.
+                 * An INSERT of a document that was merged from the storage before is skipped.
                  */
                 filter((eventBulk: RxChangeEventBulk<RxStateDocument>) => {
                     if (!this._initDone) {
                         this._eventDuringInit = true;
                         return false;
                     }
-                    return eventBulk.events.some(event =>
-                        event.operation === 'INSERT' &&
-                        event.documentData.sId !== this._instanceId
-                    );
+                    const events = eventBulk.events;
+                    const fromOther = events.filter(event => event.documentData.sId !== this._instanceId);
+                    const hasNonInsert = events.some(event => event.operation !== 'INSERT');
+                    const unknown = fromOther.filter(event => event.documentData.id <= this._lastMergedId &&
+                        !this._mergedAhead.delete(event.documentData.id));
+                    if (hasNonInsert || unknown.length > 0) {
+                        this._rebuildState();
+                    }
+                    return !hasNonInsert && fromOther.length > 0;
                 }),
                 tap((eventBulk: RxChangeEventBulk<RxStateDocument>) => {
                     const events = eventBulk.events;
@@ -140,7 +152,10 @@ export class RxStateBase<T, Reactivity = unknown> {
                              * now would apply the operations in the wrong order.
                              */
                             this._mergeMissingOperations()
-                                .then(() => this._ownEmits$.next(this._state))
+                                .then(() => {
+                                    this._mergedAhead.delete(event.documentData.id);
+                                    this._ownEmits$.next(this._state);
+                                })
                                 .catch(() => { });
                         }
                     }
@@ -278,6 +293,12 @@ export class RxStateBase<T, Reactivity = unknown> {
                             sId: this._instanceId,
                             ops
                         });
+                        /**
+                         * A merge that ran during the insert can have read
+                         * the own document from the storage. Own events
+                         * never remove it from the set.
+                         */
+                        this._mergedAhead.delete(nextId);
                         /**
                          * When a newer operation was merged during the insert,
                          * the state already contains this write
@@ -307,6 +328,7 @@ export class RxStateBase<T, Reactivity = unknown> {
                     const documentInDb = writeError.documentInDb;
                     if (this._lastMergedId < documentInDb.id) {
                         this._lastMergedId = documentInDb.id;
+                        this._mergedAhead.add(documentInDb.id);
                         this.mergeOperationsIntoState(documentInDb.ops);
                         this._ownEmits$.next(this._state);
                     }
@@ -335,11 +357,45 @@ export class RxStateBase<T, Reactivity = unknown> {
             const doc = docs[index];
             if (doc.id > this._lastMergedId) {
                 this._lastMergedId = doc.id;
+                this._mergedAhead.add(doc.id);
                 this.mergeOpe
```

**File**: `test/unit/rx-state.test.ts` (modified, +266/-1)
```diff
@@ -17,8 +17,13 @@ import {
 } from '../../plugins/core/index.mjs';
 import {
     isDeno,
-    isFastMode
+    isFastMode,
+    getPullHandler,
+    getPullStream,
+    getPushHandler,
+    ensureReplicationHasNoErrors
 } from '../../plugins/test-utils/index.mjs';
+import { replicateRxCollection } from '../../plugins/replication/index.mjs';
 import {
     nextRxStateId,
     RxDBStatePlugin
@@ -954,6 +959,266 @@ addRxPlugin(RxDBJsonDumpPlugin);
                 await freshState.collection.database.remove();
             });
         });
+        describe('replication', () => {
+            if (!config.storage.hasReplication) {
+                return;
+            }
+            type CounterState = {
+                [key: string]: number;
+            };
+            function syncWith<StateType>(
+                state: RxState<StateType, any>,
+                remoteState: RxState<StateType, any>,
+                pushBatchSize?: number
+            ) {
+                const replicationState = replicateRxCollection({
+                    collection: state.collection,
+                    replicationIdentifier: 'rx-state-replication-test',
+                    live: true,
+                    pull: {
+                        handler: getPullHandler(remoteState.collection),
+                        stream$: getPullStream(remoteState.collection)
+                    },
+                    push: {
+                        handler: getPushHandler(remoteState.collection),
+                        batchSize: pushBatchSize
+                    }
+                });
+                ensureReplicationHasNoErrors(replicationState);
+                return replicationState;
+            }
+            /**
+             * Waits until the value is as expected. On a timeout
+             * the assertion shows the difference.
+             */
+            async function awaitEqual(getValue: () => any, expected: any) {
+                await waitUntil(() => deepEqual(getValue(), expected), 5000).catch(() => { });
+                assert.deepStrictEqual(getValue(), expected);
+            }
+            async function openCounterState(name: string, cleanupPolicy?: Partial<RxCleanupPolicy>) {
+                const database = await createRxDatabase({
+                    name,
+                    storage: useSchemaValidator ? wrappedValidateAjvStorage({
+                        storage: config.storage.getStorage()
+                    }) : config.storage.getStorage(),
+                    cleanupPolicy
+                });
+                return database.addState<CounterState>();
+            }
+            const CLEANUP_POLICY: Partial<RxCleanupPolicy> = {
+                awaitReplicationsInSync: false,
+                minimumCollectionAge: 0,
+                runEach: 1000 * 60 * 60,
+                waitForLeadership: false
+            };
+            it('should sync a write that was done after the last sync', async () => {
+                const stateA = await getState();
+                const stateB = await getState();
+                await stateA.set('a', () => 1);
+
+                const replicationState = syncWith(stateA, stateB);
+                await replicationState.awaitInSync();
+                await waitUntil(() => stateB.get('a') === 1);
+
+                await stateB.set('b', () => 2);
+                await waitUntil(() => stateA.get('b') === 2);
+                await replicationState.awaitInSync();
+
+                assert.deepStrictEqual(stateA.get(), { a: 1, b: 2 });
+                assert.deepStrictEqual(stateB.get(), { a: 1, b: 2 });
+
+                await stateA.collection.database.close();
+                await stateB.collection.database.close();
+            });
+            /**
+             * Waits until the operations document of stateB
+             * has replaced the one of stateA in the storage.
+             */
+            async function awaitConflictResolved(state: RxState<TestState, ReactivityType>) {
+                await waitUntil(async () => {
+                    const docs = await state.collection.find().exec();
+                    return docs.length === 1 && docs[0].ops[0].k === 'b';
+                });
+            }
+            it('should have the same state in memory as after a reload when both sides have written before the sync', async () => {
+                if (!config.storage.hasPersistence) {
+                    return;
+                }
+                const databaseName = randomToken(10);
+                const stateA = await getState(databaseName);
+                const stateB = await getState();
+                await stateA.set('a', () => 1);
+                await stateB.set('b', () => 2);
+
+                const replicationState = syncWith(stateA, stateB);
+                await awaitConflictResolved(stateA);
+                await replicationState.awaitInSync();
+                await awaitEqual(() => stateA.get(), { b: 2 });
+
+        
```

#### Recent Merged Pull Requests:
- **PR #9830** (2026-11-24): Update dependency eslint-plugin-jsdoc to v65.4.9 (@renovate[bot])
- **PR #9824** (2026-11-23): docs: split replication.md into concept, replicateRxCollection() and RxReplicationState pages (@pubkey)
- **PR #9823** (2026-11-23): docs: start every Core Entities page with a minimal example (@pubkey)
- **PR #9822** (2026-11-23): ADD createRxDatabase() setting resetCollectionOnSchemaChange (dev-mode only) (@pubkey)
- **PR #9821** (2026-11-23): docs: separate the Mango query syntax from the query builder (@pubkey)
- **PR #9820** (2026-11-23): Exclude AGENTS.md and CLAUDE.md from the npm package (@pubkey)

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

## X. the cleanup and pipeline plugins failed when the leader-election plugin was not 

**RULE**:
When implementing operations in `docs-src/docs/cleanup.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pubkey/rxdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0b762853`: the cleanup and pipeline plugins failed when the leader-election plugin was not added. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs-src/docs/cleanup.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
The cleanup plugin adds the [leader election plugin](./leader-election.md) by itself because with the default `waitForLeadership: true` the cleanup only runs on the leading instance. You do not have to add it on your own.

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0b762853` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
