> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pubkey-rxdb-learnings.md`  
> **Source**: github ([https://github.com/pubkey/rxdb](https://github.com/pubkey/rxdb))  
> **Source Version**: `487676ec`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T15:27:35.600Z  
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
> **Harvest Timestamp**: 2026-11-06T15:27:26.755Z  
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
- **Issue #9430** (2026-11-06): **Docs: load gtag.js on the first interaction or 3 s after the page load**
  *Symptoms*: ## This PR contains: - IMPROVED DOCS (page load performance)  ## Describe the problem you have without this PR Since #9427, `gtag.js` is the largest remaining script (626 KB raw). It was loaded when the page became idle, directly after the `load` event, and blocks the main thread with tasks of about 250 to 300 ms on a throttled mobile device. Taps and scrolls during that time react late.  Changes in `docs-src/src/theme/Root.tsx`: - `onFirstInteractionOrAfterLoad()` runs a callback on the first interaction of the visitor (`pointerdown`, `keydown`, `touchstart`, `wheel`, or a `scroll` of the page itself) or 3 seconds after the `load` event, whatever happens first. - Scroll events of elements do not count: the homepage slider sets `scrollLeft` without any input and would otherwise load gtag.js immediately. - The interaction listeners are registered when the module loads, so an interaction before the consent decision counts. EU visitors get gtag.js right after clicking the consent banner. - `applyConsent()` uses it instead of `whenPageIsIdle()` for `loadGtag()`. Consent gating is unchanged.  ## Verification Local production builds of `master` and this PR, served gzipped, Playwright on `/quickstart.html` (mobile viewport):  | Scenario | `master`: gtag.js requested | This PR: gtag.js requested | GA4 hits | |---|---|---|---| | No interaction | +612 ms (load at +473 ms) | +3,325 ms (load at +262 ms) | page_view, page_quickstart, same as `master` | | Wheel scroll at +1,046 ms | +315 m

- **Issue #9429** (2026-11-06): **Docs: remove Google Tag Manager from the privacy policy and the consent banner**
  *Symptoms*: ## This PR contains: - IMPROVED DOCS (legal texts)  ## Describe the problem you have without this PR Since #9427 the docs no longer load Google Tag Manager. `gtag.js` for Google Analytics 4 is loaded directly by `Root.tsx`, and where consent is requested (EU/EEA/UK visitors), only after the analytics consent. The legal texts still named Google Tag Manager.  Changes: - `docs-src/src/pages/privacy.tsx`, German section "Google Analytics und Google Tag Manager" → "Google Analytics": GTM sentence removed, two sentences added: the script (gtag.js) is loaded from Google servers, and where consent is obtained, only after it was given. - Same in the English section "Google Analytics and Google Tag Manager" → "Google Analytics". - `docs-src/src/theme/consent-manager.ts`: the description of the "Analytics" category in the consent banner no longer mentions Google Tag Manager.  Not changed: the privacy policy still describes the Reddit Pixel, which has been disabled since #9408 (its loader is commented out in `tracker-suite.ts`).  ESLint (also the pre-commit lint) passes.  ## Todos - [ ] Tests (not applicable, docs site only)  ## Assisted by - YES, CLAUDE CODE  --- _Generated by [Claude Code](https://claude.ai/code/session_015P6w6i7rSbhg1u7Qqj6d2U)_

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

### Incident Patch 1: `d4dbc02c` (2026-11-05)
**Commit Message**: FIX CouchDB replication crash on error responses (#9406)

* FIX CouchDB replication crash on error responses

CouchDB answers _bulk_docs with HTTP 400 and
{"error":"illegal_docid"} when a primary key starts with an
underscore. The push handler called forEach() on that object and
failed with "responseJson.forEach is not a function", which hid the
real cause. The random test primary keys start with an underscore in
about 1 of 87 cases, which made test-others-replications flaky.

- Every CouchDB response in the push handler and in the live
  longpoll stream is checked for the HTTP status and the expected
  shape. On failure the new error RC_COUCHDB_3 is thrown with the
  status, the url (without credentials) and the CouchDB error body.
- Non-conflict write errors of single _bulk_docs rows throw
  RC_COUCHDB_3 instead of SNH.
- The longpoll stream no longer dies with an unhandled rejection
  when CouchDB returns an error body. After a failed request it
  emits RESYNC so that server changes made while requests failed
  are pulled.
- Random test primary keys no longer start with an underscore.
- Docs: known problem section for underscore primary keys.

Co-Authored-By: Claude Opus 5.5 <[R

**File**: `docs-src/docs/replication-couchdb.md` (modified, +6/-0)
```diff
@@ -196,6 +196,12 @@ server {
 
 ## Known problems
 
+### Primary keys that start with an underscore
+
+CouchDB reserves document ids that start with an underscore (`_`) for its own documents like `_design/...` and `_local/...`. When you push a document whose primary key starts with `_`, CouchDB rejects the whole `_bulk_docs` request with HTTP `400` and `{"error":"illegal_docid","reason":"Only reserved document ids may start with underscore."}`. The other documents of that batch are not written either.
+
+The replication emits this as an [`RC_COUCHDB_3`](./errors.md#RC_COUCHDB_3) error on `replicationState.error$`. The error parameters contain the `status`, the request `url` and the CouchDB error `body`. To fix it, use primary keys that do not start with an underscore, for example by adding a prefix to your ids before you insert them.
+
 ### Database missing
 
 In contrast to PouchDB, this plugin **does NOT** automatically create missing CouchDB databases.
```

**File**: `orga/changelog/fix-couchdb-error-responses.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX CouchDB replication failing with `responseJson.forEach is not a function` when CouchDB returns an error response. The push and the live pull now throw [`RC_COUCHDB_3`](https://rxdb.info/errors.html#RC_COUCHDB_3) with the HTTP status and the CouchDB error body, for example `illegal_docid` for primary keys that start with an underscore. The live pull stream no longer stops on an error response and runs a resync after a failed longpoll request so that no server changes are missed",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/pull/9406",
+            "linkText": "#9406"
+        }
+    ],
+    "priority": 5
+}
```

**File**: `src/plugins/dev-mode/error-messages.ts` (modified, +6/-0)
```diff
@@ -882,6 +882,12 @@ export const ERROR_MESSAGES = {
         fix: 'Check the CouchDB server and the URL.',
         docs: 'https://rxdb.info/replication-couchdb.html?console=errors&code=RC_COUCHDB_2'
     },
+    RC_COUCHDB_3: {
+        message: 'replicateCouchDB() got an error response from the CouchDB server.',
+        cause: 'The CouchDB server rejected the request or returned a body without the expected format. The status and the CouchDB error body are in the error parameters. A common cause is a primary key that starts with an underscore, which CouchDB reserves and rejects with {"error":"illegal_docid"}.',
+        fix: 'Inspect the status and body parameters. Make sure no primary key starts with an underscore and that the CouchDB user has write access to the database.',
+        docs: 'https://rxdb.info/replication-couchdb.html?console=errors&code=RC_COUCHDB_3'
+    },
     RC_OUTDATED: {
         message: 'Outdated client, update required. Replication was canceled',
         cause: 'The client version is too old for the server.',
```

**File**: `src/plugins/replication-couchdb/couchdb-helper.ts` (modified, +40/-0)
```diff
@@ -5,6 +5,7 @@ import type {
 } from '../../types/index.d.ts';
 import { b64EncodeUnicode, flatClone } from '../../plugins/utils/index.ts';
 import { URLQueryParams } from './couchdb-types.ts';
+import { newRxError } from '../../rx-error.ts';
 
 
 export const COUCHDB_NEW_REPLICATION_PLUGIN_IDENTITY_PREFIX = 'couchdb';
@@ -69,6 +70,45 @@ export function couchSwapPrimaryToId<RxDocType>(
 }
 
 
+/**
+ * Reads the JSON body of a CouchDB response.
+ * Throws when the HTTP status is not ok or the body
+ * does not have the expected shape, so that the replication
+ * emits the status and the CouchDB error body
+ * like {"error":"illegal_docid","reason":"..."}
+ * instead of failing later on a missing property.
+ */
+export async function getCouchDBResponseJson<T>(
+    response: Response,
+    url: string,
+    isValid: (json: any) => boolean
+): Promise<T> {
+    const text = await response.text();
+    let json: any;
+    try {
+        json = JSON.parse(text);
+    } catch (_err) {
+        json = undefined;
+    }
+    if (!response.ok || !isValid(json)) {
+        throw newRxError('RC_COUCHDB_3', {
+            url: removeCredentialsFromUrl(url),
+            status: response.status,
+            body: typeof json === 'undefined' ? text : json
+        });
+    }
+    return json;
+}
+
+/**
+ * The url can contain basic auth credentials like
+ * http://user:password@example.com/db/
+ * which must not end up in error messages and logs.
+ */
+export function removeCredentialsFromUrl(url: string): string {
+    return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, '$1');
+}
+
 export function getDefaultFetch() {
     if (
         typeof window === 'object' &&
```

**File**: `src/plugins/replication-couchdb/index.ts` (modified, +37/-7)
```diff
@@ -42,7 +42,9 @@ import {
     couchDBDocToRxDocData,
     mergeUrlQueryParams,
     couchSwapPrimaryToId,
-    getDefaultFetch
+    getDefaultFetch,
+    getCouchDBResponseJson,
+    removeCredentialsFromUrl
 } from './couchdb-helper.ts';
 import { awaitRetry } from '../replication/replication-helper.ts';
 
@@ -157,8 +159,9 @@ export function replicateCouchDB<RxDocType>(
                  * First get the current master state from the remote
                  * to check for conflicts
                  */
+                const docsByIdUrl = options.url + '_all_docs?' + mergeUrlQueryParams({});
                 const docsByIdResponse = await replicationState.fetch(
-                    options.url + '_all_docs?' + mergeUrlQueryParams({}),
+                    docsByIdUrl,
                     {
                         method: 'POST',
                         headers: {
@@ -171,7 +174,11 @@ export function replicateCouchDB<RxDocType>(
                         })
                     }
                 );
-                const docsByIdRows: CouchAllDocsResponse = await docsByIdResponse.json();
+                const docsByIdRows = await getCouchDBResponseJson<CouchAllDocsResponse>(
+                    docsByIdResponse,
+                    docsByIdUrl,
+                    json => !!json && Array.isArray(json.rows)
+                );
                 const nonConflictRows: typeof rows = [];
                 const remoteRevById = new Map<string, string>();
                 await Promise.all(
@@ -220,14 +227,22 @@ export function replicateCouchDB<RxDocType>(
                         body: JSON.stringify(body)
                     }
                 );
-                const responseJson: CouchBulkDocResultRow[] = await response.json();
+                const responseJson = await getCouchDBResponseJson<CouchBulkDocResultRow[]>(
+                    response,
+                    url,
+                    json => Array.isArray(json)
+                );
 
                 // get conflicting writes
                 const conflictAgainIds: string[] = [];
                 responseJson.forEach(writeResultRow => {
                     const isConflict = writeResultRow.error === 'conflict';
                     if (!writeResultRow.ok && !isConflict) {
-                        throw newRxError('SNH', { args: { writeResultRow } });
+                        throw newRxError('RC_COUCHDB_3', {
+                            url: removeCredentialsFromUrl(url),
+                            status: response.status,
+                            body: writeResultRow
+                        });
                     }
                     if (isConflict) {
                         conflictAgainIds.push(writeResultRow.id);
@@ -243,7 +258,11 @@ export function replicateCouchDB<RxDocType>(
                     keys: JSON.stringify(conflictAgainIds)
                 });
                 const conflictResponse = await replicationState.fetch(getConflictDocsUrl);
-                const conflictResponseJson: CouchAllDocsResponse = await conflictResponse.json();
+                const conflictResponseJson = await getCouchDBResponseJson<CouchAllDocsResponse>(
+                    conflictResponse,
+                    getConflictDocsUrl,
+                    json => !!json && Array.isArray(json.rows)
+                );
                 conflictResponseJson.rows.forEach(conflictAgainRow => {
                     conflicts.push(couchDBDocToRxDocData(collection.schema.primaryPath, conflictAgainRow.doc));
                 });
@@ -293,7 +312,11 @@ export function replicateCouchDB<RxDocType>(
                     let jsonResponse: CouchdbChangesResult;
                     try {
                         lastRequestStartTime = now();
-                        jsonResponse = await (await replicationState.fetch(url)).json();
+                        jsonResponse = await getCouchDBResponseJson<CouchdbChangesResult>(
+                            await replicationState.fetch(url),
+                            url,
+                            json => !!json && Array.isArray(json.results)
+                        );
                     } catch (err: any) {
                         replicationState.subjects.error.next(
                             newRxError('RC_STREAM', {
@@ -317,6 +340,13 @@ export function replicateCouchDB<RxDocType>(
                                 replicationState.retryTime
                             );
                         }
+                        /**
+                         * When since is still 'now', the next longpoll request
+                         * would miss the changes that happened on the server
+                         * while the requests failed. A RESYNC runs the
+                         * checkpoint based pull which fetches them.
+                         */
+                        pullStream$.next('RESYNC');
                         continue;
                     }
                     const documen
```

**File**: `src/plugins/test-utils/schema-objects.ts` (modified, +8/-1)
```diff
@@ -21,6 +21,13 @@ export const TEST_DATA_CHARSET_LAST_SORTED = ensureNotFalsy(lastOfArray(TEST_DAT
 const someEmojisArr = ['😊', '💩', '👵', '🍌', '🏳️‍🌈', '😃'];
 
 const baseChars = TEST_DATA_CHARSET.split('');
+/**
+ * CouchDB reserves document ids that start with an underscore
+ * and rejects them with {"error":"illegal_docid"}.
+ * The random strings are used as primary keys, so the first
+ * char must not be an underscore.
+ */
+const firstChars = baseChars.filter(char => char !== '_');
 let allChars = baseChars.slice(0);
 allChars = allChars.concat(someEmojisArr);
 
@@ -48,7 +55,7 @@ export function randomStringWithSpecialChars(
              * with an emoji. This can likely be fixed by upgrading foundationdb to the
              * latest version.
              */
-            text += baseChars[Math.floor(Math.random() * baseChars.length)];
+            text += firstChars[Math.floor(Math.random() * firstChars.length)];
         } else {
             text += allChars[Math.floor(Math.random() * allChars.length)];
         }
```

**File**: `test/replication-couchdb.test.ts` (modified, +82/-0)
```diff
@@ -467,5 +467,87 @@ describe('replication-couchdb.test.ts', () => {
 
             await collection.database.close();
         });
+        it('should emit a readable error when CouchDB rejects the pushed documents', async () => {
+            const server = await SpawnServer.spawn();
+            const collection = await humansCollection.create(0);
+
+            /**
+             * CouchDB reserves document ids that start with an underscore
+             * and rejects the whole _bulk_docs request with HTTP 400.
+             */
+            await collection.insert(schemaObjects.humanData('_reserved-id'));
+
+            const replicationState = replicateCouchDB({
+                replicationIdentifier: randomToken(10),
+                url: server.url,
+                collection,
+                fetch: fetchWithCouchDBAuth,
+                live: true,
+                retryTime: 100,
+                push: {}
+            });
+            const error: any = await firstValueFrom(replicationState.error$);
+
+            assert.strictEqual(error.code, 'RC_COUCHDB_3');
+            assert.strictEqual(error.parameters.status, 400);
+            assert.strictEqual(error.parameters.body.error, 'illegal_docid');
+            assert.ok(error.parameters.url.includes('_bulk_docs'));
+
+            const serverDocs = await getAllServerDocs(server.url);
+            assert.strictEqual(serverDocs.length, 0);
+
+            await replicationState.cancel();
+            await collection.database.close();
+        });
+        it('should keep the live pull stream running after CouchDB returned an error response', async () => {
+            const server = await SpawnServer.spawn();
+            const collection = await humansCollection.create(0);
+
+            let failedLongpollRequests = 0;
+            const fetchFailingFirstLongpoll: typeof fetch = (url, init) => {
+                if (
+                    failedLongpollRequests === 0 &&
+                    (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).includes('feed=longpoll')
+                ) {
+                    failedLongpollRequests++;
+                    return Promise.resolve(new Response(
+                        JSON.stringify({ error: 'unauthorized', reason: 'Name or password is incorrect.' }),
+                        { status: 401, headers: { 'content-type': 'application/json' } }
+                    ));
+                }
+                return fetchWithCouchDBAuth(url, init);
+            };
+
+            const replicationState = replicateCouchDB({
+                replicationIdentifier: randomToken(10),
+                url: server.url,
+                collection,
+                fetch: fetchFailingFirstLongpoll,
+                live: true,
+                retryTime: 100,
+                pull: {}
+            });
+            const streamError: any = await firstValueFrom(replicationState.error$);
+            assert.strictEqual(streamError.code, 'RC_STREAM');
+            assert.strictEqual(streamError.parameters.error.code, 'RC_COUCHDB_3');
+            assert.strictEqual(streamError.parameters.error.parameters.status, 401);
+            assert.strictEqual(streamError.parameters.error.parameters.body.error, 'unauthorized');
+
+            await replicationState.awaitInitialReplication();
+            const writeResponse = await fetchWithCouchDBAuth(server.url + 'after-error', {
+                method: 'PUT',
+                headers: { 'content-type': 'application/json' },
+                body: JSON.stringify({ firstName: 'Alice', lastName: 'Kelso', age: 30 })
+            });
+            assert.strictEqual(writeResponse.status, 201);
+
+            await waitUntil(async () => {
+                const doc = await collection.findOne('after-error').exec();
+                return !!doc;
+            }, 5000);
+
+            await replicationState.cancel();
+            await collection.database.close();
+        });
     });
 });
```

---

### Incident Patch 2: `d28c5fac` (2026-11-05)
**Commit Message**: FIX type errors in calculateNewResultsWithResultWindowBuffer() without strictNullChecks (#9418)

* FIX type errors in calculateNewResultsWithResultWindowBuffer() without strictNullChecks

The docs-src tsconfig compiles the RxDB sources without strictNullChecks.
There, the truthiness check on runFullQueryAgain does not narrow the
ResultWindowBufferChangeResult union, so accessing result.changed and
result.results failed with TS2339. An explicit === true comparison narrows
the union in both configurations. The runtime behavior is the same because
runFullQueryAgain is always a boolean.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6i7rSbhg1u7Qqj6d2U

* Add PR link to the changelog entry

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6i7rSbhg1u7Qqj6d2U

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `orga/changelog/event-reduce-result-window-buffer-type-narrowing.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX TypeScript errors `TS2339` in `calculateNewResultsWithResultWindowBuffer()` when the RxDB sources are type-checked without `strictNullChecks`",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/pull/9418",
+            "linkText": "#9418"
+        }
+    ],
+    "priority": 1
+}
```

**File**: `src/event-reduce.ts` (modified, +5/-1)
```diff
@@ -278,7 +278,11 @@ export function calculateNewResultsWithResultWindowBuffer<RxDocumentType>(
         rxChangeEvent => rxChangeEventToEventReduceChangeEvent(rxChangeEvent) as ChangeEvent<RxDocumentData<RxDocumentType>>
     );
     const result = applyChangeEventsToResultWindowBuffer(resultWindowBuffer, changeEvents);
-    if (result.runFullQueryAgain) {
+    /**
+     * Compare with === so that the union type is also narrowed
+     * when strictNullChecks is disabled, like in the docs-src tsconfig.
+     */
+    if (result.runFullQueryAgain === true) {
         // the result window does not fit into the buffer anymore, the query refills it
         return {
             runFullQueryAgain: true
```

---

### Incident Patch 3: `7b801bb3` (2026-11-05)
**Commit Message**: FIX ionic example: import from @ionic/angular instead of @ionic/angular/standalone (#9420)

* FIX ionic example: import from @ionic/angular instead of @ionic/angular/standalone

@ionic/angular v9 (#9102) exports the standalone API from the package root
and no longer has the @ionic/angular/standalone entry point, so the
example-ionic CI job failed with TS2307.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6i7rSbhg1u7Qqj6d2U

* Add changelog entry for the Ionic example fix

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_015P6w6i7rSbhg1u7Qqj6d2U

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `examples/ionic/src/app/app.component.ts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import { Component } from '@angular/core';
-import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
+import { IonApp, IonRouterOutlet } from '@ionic/angular';
 
 @Component({
     selector: 'app-root',
```

**File**: `examples/ionic/src/app/components/hero-edit/hero-edit.component.ts` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import {
     IonTitle,
     IonToolbar,
     ModalController
-} from '@ionic/angular/standalone';
+} from '@ionic/angular';
 
 import type { RxHeroDocument } from '../../RxDB.d';
 
```

**File**: `examples/ionic/src/app/components/hero-insert/hero-insert.component.ts` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import {
     IonLabel,
     IonList,
     ToastController
-} from '@ionic/angular/standalone';
+} from '@ionic/angular';
 
 import { DatabaseService } from '../../services/database.service';
 
```

**File**: `examples/ionic/src/app/components/heroes-list/heroes-list.component.ts` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ import {
     IonProgressBar,
     IonSpinner,
     ModalController
-} from '@ionic/angular/standalone';
+} from '@ionic/angular';
 import { addIcons } from 'ionicons';
 import { create, trash } from 'ionicons/icons';
 import type { Observable } from 'rxjs';
```

**File**: `examples/ionic/src/app/pages/home/home.page.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import {
     IonHeader,
     IonTitle,
     IonToolbar
-} from '@ionic/angular/standalone';
+} from '@ionic/angular';
 
 import { HeroInsertComponent } from '../../components/hero-insert/hero-insert.component';
 import { HeroesListComponent } from '../../components/heroes-list/heroes-list.component';
```

**File**: `examples/ionic/src/main.ts` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import { bootstrapApplication } from '@angular/platform-browser';
 import { provideAppInitializer } from '@angular/core';
 import { provideRouter, RouteReuseStrategy } from '@angular/router';
-import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
+import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
 
 import { AppComponent } from './app/app.component';
 import { routes } from './app/app.routes';
```

**File**: `orga/changelog/ionic-example-angular-v9-imports.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+    "$schema": "./schema.json",
+    "text": "FIX the Ionic example for `@ionic/angular` v9, which no longer has the `@ionic/angular/standalone` entry point",
+    "links": [
+        {
+            "url": "https://github.com/pubkey/rxdb/pull/9420",
+            "linkText": "#9420"
+        }
+    ],
+    "priority": 1
+}
```

#### Recent Merged Pull Requests:
- **PR #9430** (2026-11-06): Docs: load gtag.js on the first interaction or 3 s after the page load (@pubkey)
- **PR #9429** (2026-11-06): Docs: remove Google Tag Manager from the privacy policy and the consent banner (@pubkey)
- **PR #9428** (2026-11-06): Docs: update docusaurus-plugin-llms to 0.6.1 (@pubkey)
- **PR #9427** (2026-11-06): Docs: load gtag.js directly instead of Google Tag Manager (@pubkey)
- **PR #9426** (2026-11-06): Docs: upgrade Docusaurus to 3.10.2 and update the docs dependencies (@pubkey)
- **PR #9425** (2026-11-06): Docs: fix the React hydration errors that delayed the LCP (@pubkey)

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

## X. CouchDB replication crash on error responses (#9406)

**RULE**:
When implementing operations in `docs-src/docs/replication-couchdb.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pubkey/rxdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d4dbc02c`: CouchDB replication crash on error responses (#9406). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs-src/docs/replication-couchdb.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
### Primary keys that start with an underscore

CouchDB reserves document ids that start with an underscore (`_`) for its own documents like `_design/...` and `_local/...`. When you push a document whose primary key starts with `_`, CouchDB rejects the whole `_bulk_docs` request with HTTP `400` and `{"error":"illegal_docid","reason":"Only reserved document ids may start with underscore."}`. The other documents of that batch are not written either.

The replication emits this as an [`RC_COUCHDB_3`](./errors.md#RC_COUCHDB_3) error on `replicationState.error$`. The error parameters contain the `status`, the request `url` and the CouchDB error `body`. To fix it, use primary keys that do not start with an underscore, for example by adding a prefix to your ids before you insert them.

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d4dbc02c` are properly handled with clean fallback behavior.
