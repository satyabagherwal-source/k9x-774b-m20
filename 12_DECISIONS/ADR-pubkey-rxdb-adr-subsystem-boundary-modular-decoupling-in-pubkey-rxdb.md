# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in pubkey/rxdb

<!-- PROVENANCE_START
{
  "source_repository": "pubkey/rxdb",
  "source_url": "https://github.com/pubkey/rxdb",
  "source_version": "1135a741",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T12:50:59.614Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pubkey-rxdb",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pubkey/rxdb](https://github.com/pubkey/rxdb) (Revision: `1135a741`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T12:50:59.614Z`  
> **Learning ID**: `learn-github-pubkey-rxdb`


## Status
**ACCEPTED** (Empirically verified from pubkey/rxdb)

## Context
During deep inspection of pubkey/rxdb, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
# Forensic Learning Record (Deep Inspection): pubkey/rxdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/pubkey-rxdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pubkey/rxdb](https://github.com/pubkey/rxdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-18T12:50:58.481Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pubkey/rxdb`
- **Description**: The local-first database that runs on every JS runtime and replicates with your existing backend - no vendor, no lock-in - https://rxdb.info/
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 23441 stars

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
                if (rxCollection.closed) {
                    return true;
                }
                return state._cleanup().catch(err => {
                    /**
                     * The collection can be closed while the cleanup is running.
                     * Then the cleanup run ends without an error.
                     */
                    if (rxCollection.closed) {
                        return true;
                    }
                    throw err;
                });
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
- **Issue #9755** (2026-11-18): **fix(deps): update dependency graphql-ws to v6.4.2**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [graphql-ws](https://the-guild.dev/graphql/ws) ([source](https://redirect.github.com/enisdenjo/graphql-ws)) | [`6.4.1` → `6.4.2`](https://renovatebot.com/diffs/npm/graphql-ws/6.4.1/6.4.2) | ![age](https://developer.mend.io/api/mc/badges/age/npm/graphql-ws/6.4.2?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/graphql-ws/6.4.1/6.4.2?slim=true) |  ---  ### Release Notes  <details> <summary>enisdenjo/graphql-ws (graphql-ws)</summary>  ### [`v6.4.2`](https://redirect.github.com/enisdenjo/graphql-ws/blob/HEAD/CHANGELOG.md#642)  [Compare Source](https://redirect.github.com/enisdenjo/graphql-ws/compare/v6.4.1...v6.4.2)  ##### Patch Changes  - [#&#8203;705](https://redirect.github.com/enisdenjo/graphql-ws/pull/705) [`f86ce7e`](https://redirect.github.com/enisdenjo/graphql-ws/commit/f86ce7e64edd0de3bc0fb81121c2ab687d467a69) Thanks [@&#8203;mattkrick](https://redirect.github.com/mattkrick)! - Wait for each uWebSockets.js socket's own backpressure to drain, and complete the operations of a socket that closes while backpressured. Sockets used to share one drain callback, so an operation on a backpressured socket could stall until that socket closed  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule def

- **Issue #9754** (2026-11-17): **Remove "From" prefix from premium prices**
  *Symptoms*: ## This PR contains: - IMPROVED DOCS  ## Describe the problem you have without this PR The Pro and Pro Plus tiers on the premium pricing page showed a "From" prefix before the price. That suggested the price can vary, but prices are exactly the same for all customers. This PR removes the prefix. The empty prefix slot still renders `&nbsp;`, so the tier cards stay aligned.  ## Assisted by YES, CLAUDE CODE  --- _Generated by [Claude Code](https://claude.ai/code/session_015P6w6go1qTWCKtGAY4H3BE)_

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

### Incident Patch 1: `1135a741` (2026-11-18)
**Commit Message**: Fix: query result is wrong when the event of another instance arrives after a later own write (#9629)

* fix: query result is wrong when the event of another instance arrives after a later own write

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hnnyVPXwotts6YQ2F

* test: use the storage of the test config

The test created its own Dexie storage on fake-indexeddb because the bug
needs change events of another instance that arrive late.
It now runs on config.storage.getStorage(). A wrapper that only holds back
the change events of one instance makes the order of the events the same
on every storage with multiInstance support.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hnnyVPXwotts6YQ2F

* Simplify hasNewerState() of the ChangeEventBuffer to stay inside the bundle size limit

The test-builds job failed in "npm run test:bundle-size": memory-minimal
had 146950 bytes minified with a limit of 146885 bytes.

hasNewerState() now uses events.some() and builds the map of the newest
lwt per document with Math.max(). The behavior is the same: events of own
writes are skip

**File**: `orga/changelog/query-stale-event-of-other-instance.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX With `multiInstance: true`, the results of `find().$`, `find().exec()`, and `count().$` contained a document twice or with an outdated state when the event of a write from another instance arrived after the event of a later own write to the same document. The query now runs again over the storage when such an event arrives",
+    "links": [],
+    "priority": 5
+}
```

**File**: `src/change-event-buffer.ts` (modified, +39/-0)
```diff
@@ -41,6 +41,13 @@ export class ChangeEventBuffer<RxDocType> {
     */
     private buffer: RxStorageChangeEvent<RxDocType>[] = [];
 
+    /**
+     * Pointers lower than this value are out of bounds,
+     * so that queries which have not processed these events
+     * re-execute over the storage instead of using the buffer.
+     */
+    private minPointer: number = 0;
+
     public limit: number = 100;
 
 
@@ -76,6 +83,9 @@ export class ChangeEventBuffer<RxDocType> {
     private _handleChangeEvents(events: RxStorageChangeEvent<RxDocType>[]) {
         const counterBefore = this.counter;
         this.counter = this.counter + events.length;
+        if (this.hasNewerState(events)) {
+            this.minPointer = this.counter + 1;
+        }
         if (events.length > this.limit) {
             this.buffer = events.slice(events.length * -1);
         } else {
@@ -90,6 +100,32 @@ export class ChangeEventBuffer<RxDocType> {
         }
     }
 
+    /**
+     * Events of other instances arrive asynchronously,
+     * so they can arrive after the event of a later write to the same document.
+     * Applying such an event on top of the newer state gives a wrong query result.
+     * The revision ends with the token of the instance that has written it,
+     * so events of own writes are skipped which keeps this check cheap.
+     * @return true if the buffer contains a newer state of one of the event documents
+     */
+    private hasNewerState(events: RxStorageChangeEvent<RxDocType>[]): boolean {
+        const ownRevisionEnd = '-' + this.collection.database.token;
+        let lwtByDocId: Map<string, number> | undefined;
+        return events.some(event => {
+            if (event.documentData._rev.endsWith(ownRevisionEnd)) {
+                return false;
+            }
+            if (!lwtByDocId) {
+                const map = lwtByDocId = new Map<string, number>();
+                this.buffer.forEach(buffered => map.set(
+                    buffered.documentId,
+                    Math.max(map.get(buffered.documentId) || 0, buffered.documentData._meta.lwt)
+                ));
+            }
+            return (lwtByDocId.get(event.documentId) as number) > event.documentData._meta.lwt;
+        });
+    }
+
     getCounter() {
         this.processTasks();
         return this.counter;
@@ -105,6 +141,9 @@ export class ChangeEventBuffer<RxDocType> {
      */
     getArrayIndexByPointer(pointer: number): number | null {
         this.processTasks();
+        if (pointer < this.minPointer) {
+            return null;
+        }
         const oldestEvent = this.buffer[0];
         const oldestCounter = this.eventCounterMap.get(
             oldestEvent
```

**File**: `test/unit/cross-instance.test.ts` (modified, +64/-0)
```diff
@@ -140,6 +140,70 @@ describe('cross-instance.test.js', () => {
     });
 
     describe('RxQuery', () => {
+        it('should have the correct query results when the event of another instance arrives after the event of a later own write', async () => {
+            const name = randomToken(10);
+            async function createInstance(storage: RxStorage<any, any>): Promise<RxCollection<HumanDocumentType>> {
+                const db = await createRxDatabase<{ human: RxCollection<HumanDocumentType>; }>({
+                    name,
+                    storage,
+                    multiInstance: true,
+                    ignoreDuplicate: true
+                });
+                const collections = await db.addCollections({
+                    human: {
+                        schema: schemas.human
+                    }
+                });
+                return collections.human;
+            }
+            const heldEventsStorage = getStorageWithHeldEvents();
+            const c1 = await createInstance(heldEventsStorage.storage);
+            const c2 = await createInstance(config.storage.getStorage());
+            const query = c1.find({ sort: [{ passportId: 'asc' }] });
+            const toState = (docs: RxDocument<HumanDocumentType>[]) => docs.map(d => d.passportId + '|' + d.firstName);
+
+            let lastEmitted: string[] = [];
+            let lastCount = -1;
+            const eventsByDocId = new Map<string, number>();
+            const subs = [
+                query.$.subscribe(docs => lastEmitted = toState(docs)),
+                c1.count().$.subscribe(count => lastCount = count),
+                c1.$.subscribe(event => eventsByDocId.set(
+                    event.documentId,
+                    (eventsByDocId.get(event.documentId) ?? 0) + 1
+                ))
+            ];
+
+            const iterations = 3;
+            for (let i = 0; i < iterations; i++) {
+                const id = 'doc' + i;
+                /**
+                 * The upsert of c1 writes on top of the state of c2
+                 * and c1 gets its own event before the insert event of c2 arrives.
+                 */
+                heldEventsStorage.holdEvents = true;
+                await c2.insert(schemaObjects.humanData(id, 20, 'other'));
+                await waitUntil(() => heldEventsStorage.heldEvents() > 0);
+                heldEventsStorage.holdEvents = false;
+                await c1.upsert(schemaObjects.humanData(id, 20, 'own'));
+                await waitUntil(() => eventsByDocId.get(id) === 1);
+                heldEventsStorage.releaseEvents();
+                await waitUntil(() => eventsByDocId.get(id) === 2);
+
+                const storageState = toState(await c2.find({ sort: [{ passportId: 'asc' }] }).exec());
+                assert.strictEqual(storageState.length, i + 1);
+                assert.strictEqual(storageState[i], id + '|own');
+                assert.deepStrictEqual(toState(await query.exec()), storageState, 'exec() in iteration ' + i);
+                await waitUntil(() => lastEmitted.length === storageState.length, 1000).catch(() => { });
+                assert.deepStrictEqual(lastEmitted, storageState, 'find().$ in iteration ' + i);
+                assert.strictEqual(await c1.count().exec(), i + 1, 'count().exec() in iteration ' + i);
+                assert.strictEqual(lastCount, i + 1, 'count().$ in iteration ' + i);
+            }
+
+            subs.forEach(sub => sub.unsubscribe());
+            await c1.database.close();
+            await c2.database.close();
+        });
         it('should not apply a write of another instance twice when the query result already contains it', async () => {
             const name = randomToken(10);
             const createCollection = async (storage: RxStorage<any, any>) => {
```

---

### Incident Patch 2: `bafa39cc` (2026-11-18)
**Commit Message**: fix: cancel() and close() hang on non-live replication with failing handler (#9524)

Claude-Session: https://claude.ai/code/session_015P6w6hnnyVPXwotts6YQ2F

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/changelog/fix-non-live-replication-cancel-hang.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX `cancel()`, `remove()`, `collection.close()` and `database.close()` never resolved on a replication with `live: false` while the pull or push handler kept failing",
+    "links": [],
+    "priority": 5
+}
```

**File**: `src/plugins/replication/index.ts` (modified, +19/-4)
```diff
@@ -168,11 +168,21 @@ export class RxReplicationState<RxDocType, CheckpointType> {
         const startPromiseWithResolvers = createPromiseWithResolvers<void>();
         this.callOnStart = startPromiseWithResolvers.resolve;
         this.startPromise = startPromiseWithResolvers.promise;
+        const stopRequestedPromiseWithResolvers = createPromiseWithResolvers<void>();
+        this.callOnStopRequested = stopRequestedPromiseWithResolvers.resolve;
+        this.stopRequestedPromise = stopRequestedPromiseWithResolvers.promise;
     }
 
     private callOnStart: () => void = undefined as any;
     private cancelOnCollectionClose = () => this.cancel();
 
+    /**
+     * Resolves as soon as cancel() or remove() is called,
+     * before these calls are processed in the startQueue.
+     */
+    private stopRequestedPromise: Promise<void>;
+    private callOnStopRequested: () => void = undefined as any;
+
     public internalReplicationState?: RxStorageInstanceReplicationState<RxDocType>;
     public metaInstance?: RxStorageInstance<RxStorageReplicationMeta<RxDocType, CheckpointType>, any, {}, any>;
     public remoteEvents$: Subject<RxReplicationPullStreamItem<RxDocType, CheckpointType>> = new Subject();
@@ -539,20 +549,24 @@ export class RxReplicationState<RxDocType, CheckpointType> {
      * the waiting, otherwise it would not resolve while a handler keeps failing.
      * A paused non-live replication is not canceled,
      * the run goes on when start() is called again.
+     * cancel() and remove() are queued behind the run too,
+     * so the waiting also ends when a stop is requested.
+     * The queued cancel() or remove() then stops the replication.
      */
     private async awaitNonLiveDone(runQueued: Promise<any>): Promise<void> {
         const internalState = this.internalReplicationState;
         if (!this.live && internalState) {
-            const gotPaused = await Promise.race([
+            const hasFinished = await Promise.race([
                 firstValueFrom(
                     this.pendingPauses$.pipe(filter(pending => pending > 0))
-                ).then(() => true),
+                ).then(() => false),
+                this.stopRequestedPromise.then(() => false),
                 runQueued
                     .then(() => awaitRxStorageReplicationFirstInSync(internalState))
                     .then(() => awaitRxStorageReplicationInSync(internalState))
-                    .then(() => false)
+                    .then(() => true)
             ]);
-            if (gotPaused) {
+            if (!hasFinished) {
                 return;
             }
             await this._cancel();
@@ -773,6 +787,7 @@ export class RxReplicationState<RxDocType, CheckpointType> {
 
 
     async cancel() {
+        this.callOnStopRequested();
         this.startQueue = this.startQueue.catch(() => { }).then(async () => {
             await this._cancel(this.removeRequested);
         });
```

**File**: `test/unit/replication.test.ts` (modified, +45/-0)
```diff
@@ -851,6 +851,51 @@ describe('replication.test.ts', () => {
             localCollection.database.close();
             remoteCollection.database.close();
         });
+        it('cancel() and database.close() must resolve while the handler of a non-live replication keeps failing', async () => {
+            const startFailingReplication = async () => {
+                const collection = await humansCollection.createHumanWithTimestamp(0, randomToken(10), false);
+                let handlerCalls = 0;
+                const replicationState = replicateRxCollection<HumanWithTimestampDocumentType, any>({
+                    collection,
+                    replicationIdentifier: REPLICATION_IDENTIFIER_TEST,
+                    live: false,
+                    retryTime: 20,
+                    pull: {
+                        handler: async () => {
+                            handlerCalls++;
+                            await wait(0);
+                            throw new Error('server is offline');
+                        }
+                    }
+                });
+                await waitUntil(() => handlerCalls >= 2);
+                return {
+                    collection,
+                    replicationState,
+                    getHandlerCalls: () => handlerCalls
+                };
+            };
+            const resolvesInTime = (promise: Promise<any>) => Promise.race([
+                promise.then(() => true),
+                wait(2000).then(() => false)
+            ]);
+
+            // cancel()
+            const first = await startFailingReplication();
+            const cancelResolved = await resolvesInTime(first.replicationState.cancel());
+            assert.strictEqual(cancelResolved, true, 'cancel() must resolve');
+            assert.strictEqual(first.replicationState.isStopped(), true);
+            const callsAfterCancel = first.getHandlerCalls();
+            await wait(100);
+            assert.strictEqual(first.getHandlerCalls(), callsAfterCancel, 'handler must not be retried after cancel()');
+            await first.collection.database.close();
+
+            // database.close()
+            const second = await startFailingReplication();
+            const closeResolved = await resolvesInTime(second.collection.database.close());
+            assert.strictEqual(closeResolved, true, 'database.close() must resolve');
+            assert.strictEqual(second.replicationState.isStopped(), true);
+        });
     });
     describe('live replication', () => {
         it('should replicate all writes', async () => {
```

---

### Incident Patch 3: `98d3309e` (2026-11-17)
**Commit Message**: Fix failing CI on Deno KV and Windows: two tests waited for the wrong thing (#9752)

* test: wait for the local documents state of the second instance in the getLocal() read race test

The test hung on Deno KV in `await eventArrived`. The local documents state
of a database is created in the background after createRxDatabase(). On
Deno KV the state of db2 did not exist yet when db wrote the first
document, so the change event of that write was never emitted on db2.$
and the test waited for it until the mocha timeout.

The test now calls db2.getLocal() once before the loop, which awaits the
local documents state of db2 before the first write of db.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6hnnyVPXwotts6YQ2F

* test: wait for the write events in the failed backup run test

The test "live backup must continue after a failed run and emit the
error" waited until the files of both documents existed and then asserted
that the write events were emitted. The event is emitted after the file
was written, so on Windows the assertion ran before the event. The wait
now covers the files and the events.

Co-Authored-By: Claude Fable 

**File**: `test/unit/backup.test.ts` (modified, +5/-4)
```diff
@@ -402,13 +402,14 @@ describe('backup.test.ts', () => {
             // the backup directory is reachable again
             fs.renameSync(movedDirectory, directory);
             const doc3 = await collection.insert(schemaObjects.humanData());
+            /**
+             * The write event is emitted after the file was written,
+             * so both must be awaited.
+             */
             await waitUntil(() => {
                 return [doc2, doc3].every(doc => fs.existsSync(
                     path.join(directory, toFileName(doc.primary), 'document.json')
-                ));
-            });
-            [doc2, doc3].forEach(doc => {
-                assert.ok(emitted.find(ev => ev.documentId === doc.primary && !ev.deleted));
+                ) && emitted.find(ev => ev.documentId === doc.primary && !ev.deleted));
             });
 
             /**
```

**File**: `test/unit/local-documents.test.ts` (modified, +7/-0)
```diff
@@ -797,6 +797,13 @@ describe('local-documents.test.ts', () => {
                     localDocuments: true
                 });
 
+                /**
+                 * The local documents state of a database is created in the background.
+                 * Events of writes that are done by another instance before that state exists,
+                 * are not emitted on db2.$, so the state must exist before the first write.
+                 */
+                await db2.getLocal('foobar');
+
                 for (let i = 0; i < runs; i++) {
                     const id = 'foobar' + i;
                     await db.insertLocal<TestDocType>(id, { foo: 'bar' });
```

#### Recent Merged Pull Requests:
- **PR #9755** (2026-11-18): fix(deps): update dependency graphql-ws to v6.4.2 (@renovate[bot])
- **PR #9754** (2026-11-17): Remove "From" prefix from premium prices (@pubkey)
- **PR #9752** (2026-11-17): Fix failing CI on Deno KV and Windows: two tests waited for the wrong thing (@pubkey)
- **PR #9751** (2026-11-17): Fix failing master CI: webmcp changes test used an old tool name (@pubkey)
- **PR #9750** (2026-11-18): fix(deps): update dependency ws to v8.22.2 (@renovate[bot])
- **PR #9749** (2026-11-17): Docs: add rule about valid bugs to CLAUDE.md (@pubkey)

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

## X. query result is wrong when the event of another instance arrives after a later o

**RULE**:
When implementing operations in `orga/changelog/query-stale-event-of-other-instance.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pubkey/rxdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1135a741`: query result is wrong when the event of another instance arrives after a later own write. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `orga/changelog/query-stale-event-of-other-instance.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
{
    "$schema": "./schema.json",
    "text": "FIX With `multiInstance: true`, the results of `find().$`, `find().exec()`, and `count().$` contained a document twice or with an outdated state when the event of a write from another instance arrived after the event of a later own write to the same document. The query now runs again over the storage when such an event arrives",
    "links": [],
    "priority": 5
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1135a741` are properly handled with clean fallback behavior.


## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
